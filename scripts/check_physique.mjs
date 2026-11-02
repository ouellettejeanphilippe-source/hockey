/*
 * SUR GLACE — LA PHYSIQUE ET LES RÈGLES SE MESURENT (31 oct. 2026). JP : *faire un jeu 2D avec une physique
 * crédible, pas refaire un jeu de 30 ans* ; *avoir toutes les mécaniques de hockey*. Chaque chiffre que
 * js/physique.js promet se rejoue ici, en Node, sans écran, sur un pas fixe :
 *
 *   la rondelle   une passe meurt où le frottement le dit, un rebond garde sa vitesse le long de la bande et rend
 *                 55 % en travers, le coin la garde dans la patinoire ;
 *   le patineur   une pointe autour de 38 km/h en moins de trois secondes, un arrêt en moins d'une seconde et
 *                 demie, la roue libre qui s'arrête, un virage à pleine vitesse qui fait des mètres de rayon ;
 *   la lame       la rondelle reste à la lame en ligne droite, la passe et le tir partent à la vitesse dite, le
 *                 bâton droit vise le centre et à fond de côté rate le filet ;
 *   le filet      un but se compte quand la rondelle entière passe la ligne, le poteau se compte, le gardien gèle
 *                 ou rend un retour, et la remise suit ;
 *   le choc       l'élan se conserve, le plot tombe sous une vraie mise en échec et reste debout sous un frôlement ;
 *   le gardien    des tirs de l'enclave le battent parfois, des tirs de la bleue presque jamais ; il colle au
 *                 poteau à angle fermé, couvre la rondelle lente, envoie ses rebonds au coin, harponne le porteur ;
 *   le match      deux clubs joués par l'IA (js/glace-ia.js) vont au bout : trois périodes, des mises en jeu, des
 *                 tirs, des buts, des changements de ligne ; le hors-jeu, le dégagement refusé, la punition et son
 *                 avantage numérique se sifflent quand leur fait est là ; la prolongation à trois, les tirs de
 *                 barrage décident un match nul ; la même graine rend la même empreinte ;
 *   la hauteur    la rondelle retombe et rebondit, passe par-dessus la barre, sonne la barre, se soulève quand la
 *                 passe est barrée ; le patin recule, coupe à prix, sprinte ; les passes décisives, les trois
 *                 étoiles, le gardien retiré, le tir de punition, la prolongation des séries, deux humains, la
 *                 difficulté ; une collision de course n'est jamais punie (1er nov. 2026).
 *
 *   node scripts/check_physique.mjs
 */
import { exiger, borne, informer, verdict } from './verdict.mjs';
import { nouvelleGlace, nouveauMatch, avancer, remise, empreinte, reglesDeLaGlace, lame, bander, surGlace, droitSurGlace, retirerGardien, parametresDuPatineur, parametresDuGardien, DIFFICULTES, L, W, LIGNE_BUT, BLEUE, POINT, FILET, PATIN, FOULEE, BATON, RONDELLE, GARDIEN, CHUTE, MATCH } from '../js/physique.js';
import { decisionIA, ECART_D } from '../js/glace-ia.js';

const t0 = Date.now();
const G = 9.81;
const DT = 1 / 60;
const v = o => Math.hypot(o.vx, o.vy);
const BOUT = L / 2;   // la bande du fond : les positions des essais se disent à leur distance d'elle, quelle que soit la glace

/* Une glace où personne ne gêne : toi et le plot loin dans le coin gauche, le plot sans poste. */
function glaceVide(graine = 'mesure') {
  const e = nouvelleGlace(graine);
  const [toi, plot] = e.patineurs;
  Object.assign(toi, { x: -(BOUT - 6.5), y: 9 }); Object.assign(plot, { x: -(BOUT - 4.5), y: -10, poste0: null });
  return e;
}
/* Jouer `s` secondes avec les mêmes entrées, en ramassant les événements. */
function jouer(e, entrees, s) {
  const ev = [];
  for (let t = 0; t < s - 1e-9; t += DT) ev.push(...avancer(e, entrees, DT));
  return ev;
}

/* ---------- la rondelle ---------- */
{
  const e = glaceVide();
  Object.assign(e.rondelle, { x: -(BOUT - 2.5), y: 6, vx: 10, vy: 0 });
  jouer(e, {}, 14);
  const d = e.rondelle.x + (BOUT - 2.5);
  borne('une rondelle à 36 km/h glisse ce que le frottement dit (v² / 2µg)', d, 10 * 10 / (2 * RONDELLE.frottement * G) - 2, 10 * 10 / (2 * RONDELLE.frottement * G) + 2, ' m');
  exiger('… et elle finit immobile', v(e.rondelle) < 0.01, `${v(e.rondelle).toFixed(3)} m/s`);
}
{
  const e = glaceVide();
  Object.assign(e.rondelle, { x: 0, y: 0, vx: 7, vy: 7 });
  let apres = null, avant = null;
  for (let t = 0; t < 4 && !apres; t += DT) {
    const juste = { vx: e.rondelle.vx, vy: e.rondelle.vy };
    const ev = avancer(e, {}, DT);
    if (ev.some(x => x.type === 'bande')) { avant = juste; apres = { vx: e.rondelle.vx, vy: e.rondelle.vy }; }
  }
  exiger('la bande se fait entendre', !!apres, apres ? `vx ${apres.vx.toFixed(2)} vy ${apres.vy.toFixed(2)}` : 'aucun événement « bande »');
  if (apres) {
    borne('le rebond garde la vitesse le long de la bande (moins le frottement)', apres.vx / avant.vx, 0.97, 1);
    borne('… et rend 55 % en travers, dans l\'autre sens', -apres.vy / avant.vy, RONDELLE.bande - 0.03, RONDELLE.bande + 0.01);
  }
}
{
  const e = glaceVide();
  Object.assign(e.rondelle, { x: 20, y: 8, vx: 12, vy: 6 });
  const v0 = v(e.rondelle);
  let dehors = false, bandes = 0;
  for (let t = 0; t < 5; t += DT) {
    bandes += avancer(e, {}, DT).filter(x => x.type === 'bande').length;
    if (Math.abs(e.rondelle.x) > L / 2 || Math.abs(e.rondelle.y) > W / 2) dehors = true;
  }
  exiger('le coin garde la rondelle dans la patinoire', !dehors && bandes >= 1, `${bandes} bande(s), fin à (${e.rondelle.x.toFixed(1)}, ${e.rondelle.y.toFixed(1)})`);
  exiger('… et elle y a perdu de la vitesse', v(e.rondelle) < v0 * 0.7, `${v0.toFixed(1)} → ${v(e.rondelle).toFixed(1)} m/s`);
}
{
  const o = { x: L / 2 - 0.2, y: W / 2 - 0.2, vx: 5, vy: 5 };
  bander(o, 0.04, 0.5);
  exiger('un cercle poussé dans le coin en ressort vers le centre', o.vx < 0 && o.vy < 0 && Math.hypot(o.x, o.y) < Math.hypot(L / 2, W / 2), `v (${o.vx.toFixed(1)}, ${o.vy.toFixed(1)})`);
}

/* ---------- le patineur ---------- */
{
  const e = glaceVide();
  const toi = e.patineurs[0];
  Object.assign(toi, { x: -(BOUT - 3.5), y: 9, cap: 0 });
  let vmax = 0, t95 = null, t = 0;
  for (; t < 4; t += DT) { avancer(e, { toi: { x: 1, y: 0 } }, DT); vmax = Math.max(vmax, v(toi)); if (t95 === null && v(toi) >= 0.95 * PATIN.vMax) t95 = t; }
  borne('la pointe d\'un patineur, en ligne droite', vmax * 3.6, 35, 40, ' km/h');
  exiger('… atteinte à 95 % en moins de trois secondes (arcade)', t95 !== null && t95 < 3, t95 === null ? 'jamais' : `${t95.toFixed(1)} s`);
  // Le frein : le bâton à l'envers, jusqu'à ce qu'il n'avance plus (ensuite, il repart dans l'autre sens).
  const x0 = toi.x, tf = e.t;
  while (toi.vx > 0.3 && e.t - tf < 5) avancer(e, { toi: { x: -1, y: 0 } }, DT);
  borne('le frein : de la pointe à l\'arrêt', e.t - tf, 0.4, 1.5, ' s');
  borne('… sur quelques mètres', toi.x - x0, 1.5, 8, ' m');
  // La roue libre : le bâton lâché à pleine vitesse, on s'arrête vite (JP : *ça glisse trop*).
  Object.assign(toi, { x: -(BOUT - 3.5), y: 9, cap: 0, vx: 0, vy: 0 });
  jouer(e, { toi: { x: 1, y: 0 } }, 3);   // trois secondes d'élan : la pointe est atteinte, la bande du fond encore loin
  const tr = e.t;
  while (v(toi) > 0.3 && e.t - tr < 8) avancer(e, { toi: { x: 0, y: 0 } }, DT);
  borne('la roue libre : le bâton lâché, l\'arrêt vient vite', e.t - tr, 1, 3.5, ' s');
}
{
  // LA FOULÉE (1er nov. 2026) : on pousse par coups de patin, une jambe puis l'autre, au rythme que les règles disent ;
  // la vitesse y monte par à-coups, et la phase s'arrête quand on glisse.
  const e = glaceVide('foulee');
  const toi = e.patineurs[0];
  Object.assign(toi, { x: -(BOUT - 3.5), y: 9, cap: 0 });
  let avant = 0;
  const acc = [];
  for (let t = 0; t < 2; t += DT) { avancer(e, { toi: { x: 1, y: 0 } }, DT); acc.push((v(toi) - avant) / DT); avant = v(toi); }
  const coups = acc.filter((a, i) => i > 0 && i < acc.length - 1 && a > acc[i - 1] && a >= acc[i + 1]).length;   // chaque sommet de l'accélération, un coup de patin
  const aMin = Math.min(...acc.slice(6)), aMax = Math.max(...acc.slice(6));
  const attendu = 2 * 2 * (FOULEE.cadence + FOULEE.parVitesse * PATIN.vMax / 2);
  borne('la poussée vient par coups de patin, au rythme dit', coups, attendu - 2, attendu + 2, ' coups en 2 s');
  exiger('… la vitesse monte par à-coups, pas comme un moteur', aMax > 1.8 * Math.max(0.5, aMin), `de ${aMin.toFixed(1)} à ${aMax.toFixed(1)} m/s²`);
  const phase = toi.foulee;
  jouer(e, { toi: { x: 0, y: 0 } }, 0.5);
  exiger('… et la foulée s\'arrête quand il glisse', toi.foulee === phase && toi.pousse === 0, `phase ${phase.toFixed(3)} → ${toi.foulee.toFixed(3)}`);
}
{
  const e = glaceVide();
  const toi = e.patineurs[0];
  Object.assign(toi, { x: -(BOUT - 3.5), y: -8, cap: 0 });
  jouer(e, { toi: { x: 1, y: 0 } }, 4);
  const xv = toi.x, vv = v(toi);
  let maxX = -1e9;
  for (let t = 0; t < 3; t += DT) { avancer(e, { toi: { x: 0, y: 1 } }, DT); maxX = Math.max(maxX, toi.x); }
  borne('à pleine vitesse, le virage le plus serré a un rayon de quelques mètres (arcade, mais pas sur place)', maxX - xv, 2.5, 8, ' m');
  exiger('… et il a bel et bien tourné vers le bâton', Math.abs(toi.cap - Math.PI / 2) < 0.3, `cap ${toi.cap.toFixed(2)} rad à ${(vv * 3.6).toFixed(0)} km/h`);
}
{
  const e = glaceVide();
  const toi = e.patineurs[0];
  Object.assign(toi, { x: -(BOUT - 8), y: 0, cap: 0, vx: 0, vy: 0 });
  let tPivot = null;
  for (let t = 0; t < 2; t += DT) { avancer(e, { toi: { x: -1, y: 0.01 } }, DT); if (tPivot === null && Math.abs(Math.abs(toi.cap) - Math.PI) < 0.3) tPivot = t; }
  exiger('à l\'arrêt, il pivote d\'un demi-tour en moins d\'une demi-seconde', tPivot !== null && tPivot < 0.5, tPivot === null ? 'jamais' : `${tPivot.toFixed(2)} s`);
}

/* ---------- la lame ---------- */
{
  const e = glaceVide();
  const toi = e.patineurs[0];
  Object.assign(toi, { x: -(BOUT - 3.5), y: 9, cap: 0 });
  Object.assign(e.rondelle, { x: -(BOUT - 4.6), y: 9.3 });
  let gardee = true, loin = 0;
  for (let t = 0; t < 5; t += DT) {
    avancer(e, { toi: { x: 1, y: 0 } }, DT);
    if (e.rondelle.porteur !== 'toi') gardee = false;
    const lm = lame(toi); loin = Math.max(loin, Math.hypot(e.rondelle.x - lm.x, e.rondelle.y - lm.y));
  }
  exiger('en ligne droite, la rondelle reste à la lame', gardee && loin < PATIN.portee, `au plus ${loin.toFixed(2)} m de la lame`);
  const e2 = glaceVide();
  Object.assign(e2.patineurs[0], { x: -(BOUT - 8), y: 0, cap: 0 });
  Object.assign(e2.rondelle, { x: -(BOUT - 9.1), y: 0.3 });
  avancer(e2, { toi: { x: 0, y: 0 } }, DT);
  const evP = avancer(e2, { toi: { x: 0, y: 0, passe: true } }, DT);
  exiger('la passe part', evP.some(x => x.type === 'passe') && e2.rondelle.porteur === null, evP.map(x => x.type).join(' '));
  borne('… à la vitesse de la passe (sans coéquipier, un renvoi dans le bâton)', v(e2.rondelle), BATON.passe - 0.5, BATON.passe + 0.5, ' m/s');
  const tir = (charge) => {
    const g = glaceVide('tir');
    Object.assign(g.patineurs[0], { x: -(BOUT - 8), y: 0, cap: 0 });
    Object.assign(g.rondelle, { x: -(BOUT - 9.1), y: 0.3 });
    avancer(g, { toi: { x: 0, y: 0 } }, DT);
    jouer(g, { toi: { x: 0, y: 0, tir: true } }, charge);
    const ev = avancer(g, { toi: { x: 0, y: 0, tir: false } }, DT);
    const t = ev.find(x => x.type === 'tir');
    return t ? t.v : 0;
  };
  const poignet = tir(DT), frappe = tir(1);
  borne('le tir du poignet part à la vitesse dite', poignet, BATON.tirMin - 0.5, BATON.tirMin + 3, ' m/s');
  borne('le lancer frappé chargé, plus vite', frappe, BATON.tirMax - 0.5, BATON.tirMax + 3, ' m/s');
  const ou = (bx, by) => {
    const g = glaceVide('ou');
    g.gardien.x = LIGNE_BUT + 4; g.gardien.y = 10;
    Object.assign(g.patineurs[0], { x: LIGNE_BUT - 5, y: 0, cap: 0 });
    Object.assign(g.rondelle, { x: LIGNE_BUT - 3.9, y: 0.3 });
    avancer(g, { toi: { x: 0, y: 0 } }, DT);
    avancer(g, { toi: { x: 0, y: 0, tir: true } }, DT);
    avancer(g, { toi: { x: bx, y: by, tir: false } }, DT);
    const R = g.rondelle, t = (LIGNE_BUT - R.x) / R.vx;
    return R.y + R.vy * t;
  };
  const centre = ou(1, 0), cote = ou(0, 1);
  borne('le bâton droit vers le but : le tir vise le centre', Math.abs(centre), 0, 0.5, ' m');
  borne('le bâton à fond de côté : à côté du filet', Math.abs(cote), FILET.large / 2, FILET.large / 2 + 0.9, ' m');
}

/* ---------- le filet et le gardien ---------- */
{
  const e = glaceVide();
  Object.assign(e.rondelle, { x: LIGNE_BUT - 2, y: 0.78, vx: 30, vy: 0 });
  const ev = jouer(e, {}, 0.5);
  exiger('un tir au ras du poteau, trop vite pour le gardien, est un but', ev.some(x => x.type === 'but') && e.compte.buts === 1, ev.map(x => x.type).join(' ') || 'rien');
  const ev2 = jouer(e, {}, 2.1);
  exiger('… et la remise suit, au centre', ev2.some(x => x.type === 'remise') && e.rondelle.x === 0 && e.rondelle.y === 0 && !e.arret, `rondelle à (${e.rondelle.x}, ${e.rondelle.y})`);
}
{
  const e = glaceVide();
  Object.assign(e.rondelle, { x: LIGNE_BUT - 2, y: FILET.large / 2 + 0.01, vx: 30, vy: 0 });
  const ev = jouer(e, {}, 0.5);
  exiger('le poteau se compte, et la rondelle reste en jeu', ev.some(x => x.type === 'poteau') && e.compte.poteaux === 1 && e.compte.buts === 0, ev.map(x => x.type).join(' ') || 'rien');
}
{
  const e = glaceVide();
  Object.assign(e.rondelle, { x: LIGNE_BUT - 8, y: 0, vx: 25, vy: 0 });
  const ev = jouer(e, {}, 1);
  const a = ev.find(x => x.type === 'arret');
  exiger('un tir droit sur le gardien est un arrêt', !!a && e.compte.arrets === 1 && e.compte.buts === 0, ev.map(x => x.type).join(' ') || 'rien');
  if (a) exiger('… gelé (la remise au point) ou rendu (la rondelle repart vers la glace)', a.gele ? !!e.arret && e.arret.genre === 'gel' : e.rondelle.vx < 0, a.gele ? 'gelé' : `retour à ${v(e.rondelle).toFixed(1)} m/s`);
}
{
  const taux = (dist, vit, n, graine) => {
    const e = glaceVide(graine);
    let buts = 0, arrets = 0;
    for (let i = 0; i < n; i++) {
      remise(e, 'but');
      const y = (e.de() - 0.5) * 6, cible = (e.de() - 0.5) * 1.7;
      const x = LIGNE_BUT - dist;
      const dx = LIGNE_BUT - x, dy = cible - y, d = Math.hypot(dx, dy);
      Object.assign(e.rondelle, { x, y, vx: 0, vy: 0, porteur: null });
      jouer(e, {}, 0.5);
      Object.assign(e.rondelle, { x, y, vx: dx / d * vit, vy: dy / d * vit });
      let fini = false;
      for (let t = 0; t < 2 && !fini; t += DT) {
        for (const x of avancer(e, {}, DT)) { if (x.type === 'but') { buts++; fini = true; } if (x.type === 'arret') { arrets++; fini = true; } }
      }
    }
    return { buts, arrets, part: arrets / Math.max(1, buts + arrets) };
  };
  const aLaBleue = Math.round(LIGNE_BUT - BLEUE);   // la bleue, à son mètre près (la glace de Sur glace est plus courte que celle de la LNH)
  const enclave = taux(8, 32, 120, 'enclave'), bleue = taux(aLaBleue, 40, 120, 'bleue');
  informer('les tirs de l\'enclave (8 m, 115 km/h)', `${enclave.buts} buts, ${enclave.arrets} arrêts`);
  borne('le gardien arrête la plupart des tirs de l\'enclave, pas tous', enclave.part, 0.55, 0.95);
  informer(`les tirs de la bleue (${aLaBleue} m, 144 km/h)`, `${bleue.buts} buts, ${bleue.arrets} arrêts`);
  borne('… et presque tous ceux de la bleue', bleue.part, 0.85, 1);
  exiger('la bleue est plus facile à arrêter que l\'enclave', bleue.part > enclave.part, `${(bleue.part * 100).toFixed(0)} % contre ${(enclave.part * 100).toFixed(0)} %`);
}

/* ---------- le gardien, mieux (JP, 1er nov. : *améliorer comportement des gardiens*) ---------- */
{
  // À angle fermé, il colle au poteau : la rondelle portée sur la ligne des buts, de côté.
  const e = glaceVide('angle');
  const [toi] = e.patineurs;
  Object.assign(toi, { x: LIGNE_BUT - 1, y: 7, cap: Math.PI / 2 });
  Object.assign(e.rondelle, { x: LIGNE_BUT - 0.3, y: 7, porteur: 'toi' });
  jouer(e, { toi: { x: 0, y: 0 } }, 1.5);
  borne('à angle fermé, le gardien colle au poteau, sans le dépasser', e.gardien.y, FILET.large / 2 - 0.25, FILET.large / 2 + 0.05, ' m');
}
{
  // La rondelle libre et lente dans son demi-cercle, personne autour : il va la couvrir.
  const e = glaceVide('couvrir');
  Object.assign(e.rondelle, { x: LIGNE_BUT - 1.3, y: 0.9, vx: 0.4, vy: 0, porteur: null });
  const ev = jouer(e, {}, 1.5);
  exiger('une rondelle libre et lente dans son demi-cercle, il va la couvrir', ev.some(x => x.type === 'gel') && !!e.arret, ev.map(x => x.type).join(' ') || 'rien');
}
{
  // Le même rebond, contrôlé ou non : un gardien qui contrôle tout envoie ses rebonds de côté, vers le coin.
  const angles = controle => {
    const e = glaceVide('rebond');
    e.gardien.p = { ...e.gardien.p, controle };
    GARDIEN.couvre = 0; const mitaine = GARDIEN.mitaine; GARDIEN.mitaine = 0;
    const L = [];
    for (let i = 0; i < 60; i++) {
      remise(e, 'but');
      Object.assign(e.gardien, { x: LIGNE_BUT - 1, y: 0, vx: 0, vy: 0, memoire: [] });
      Object.assign(e.rondelle, { x: LIGNE_BUT - 9, y: 0, z: 0, vz: 0, vx: 25, vy: 0, porteur: null });
      for (let t = 0; t < 1; t += DT) if (avancer(e, {}, DT).some(x => x.type === 'arret')) { L.push(Math.abs(Math.atan2(e.rondelle.vy, -e.rondelle.vx))); break; }
    }
    GARDIEN.couvre = 0.5; GARDIEN.mitaine = mitaine;
    return L.reduce((a, b) => a + b, 0) / Math.max(1, L.length);
  };
  const tout = angles(1), rien = angles(0);
  exiger('un rebond contrôlé part de côté, vers le coin, loin de l\'enclave', tout >= GARDIEN.coin[0] && tout > rien + 0.3, `${tout.toFixed(2)} rad de l'axe, contre ${rien.toFixed(2)} sans contrôle`);
}
{
  // Le harpon du gardien : le porteur qui arrive seul sur lui, à portée de son bâton.
  const e = glaceVide('harpon');
  e.gardien.p = { ...e.gardien.p, harpon: 1 };
  const [toi] = e.patineurs;
  Object.assign(toi, { x: LIGNE_BUT - 4, y: 0, cap: 0, vx: 3, vy: 0 });
  Object.assign(e.rondelle, { x: LIGNE_BUT - 3, y: 0, porteur: 'toi' });
  const ev = jouer(e, { toi: { x: 0.3, y: 0 } }, 1.5);
  exiger('le gardien harponne le porteur qui arrive seul sur lui', ev.some(x => x.type === 'harpon' && x.gardien) && e.rondelle.porteur !== 'toi', ev.map(x => x.type).join(' ') || 'rien');
}

/* ---------- la vitesse : deux patineurs ne sont jamais loin (JP, 1er nov. : *pas trop différents côté vitesse*) ---------- */
{
  const lent = parametresDuPatineur({ cote: 1, poidsLb: 235 }), vite = parametresDuPatineur({ cote: 20, poidsLb: 165, vitesse: true });
  borne('le plus vite et le plus lent : leur pointe reste proche', vite.vMax / lent.vMax, 1, 1 + 3 * PATIN.ecart, '×');
  borne('… et leur virage aussi, le poids n\'y fait presque rien', vite.agilite / lent.agilite, 1, 1 + 2.2 * PATIN.agilite, '×');
  const d = parametresDuPatineur({ cote: 10, poidsLb: 215 }), f = parametresDuPatineur({ cote: 10, poidsLb: 180 });
  exiger('un défenseur plus lourd, à la même cote, patine aussi vite qu\'un avant, et frappe plus fort', d.vMax === f.vMax && d.accel === f.accel && d.masse > f.masse, `${(d.vMax * 3.6).toFixed(1)} et ${(f.vMax * 3.6).toFixed(1)} km/h, ${d.masse.toFixed(0)} et ${f.masse.toFixed(0)} kg`);
}

/* ---------- la mise en échec ---------- */
{
  const choc = vit => {
    const e = glaceVide('choc');
    const [toi, plot] = e.patineurs;
    Object.assign(toi, { x: -10, y: 0, cap: 0, vx: vit, vy: 0 });
    Object.assign(plot, { x: -8, y: 0, cap: Math.PI, vx: 0, vy: 0, poste0: null });
    Object.assign(e.rondelle, { x: 10, y: 10 });
    let avant = null, apres = null, echec = false;
    for (let t = 0; t < 0.6; t += DT) {
      const juste = toi.masse * toi.vx + plot.masse * plot.vx;
      const ev = avancer(e, { toi: { x: 0, y: 0 } }, DT);
      if (ev.some(x => x.type === 'echec')) { echec = echec || ev.some(x => x.fort); if (avant === null) { avant = juste; apres = toi.masse * toi.vx + plot.masse * plot.vx; } }
    }
    return { avant: avant ?? 0, apres: apres ?? 0, tombe: plot.auSol > 0, echec };
  };
  const fort = choc(7), doux = choc(1.5);
  exiger('un plot frappé à 25 km/h tombe', fort.tombe && fort.echec, `écart d'élan ${(85 * 7).toFixed(0)} kg·m/s contre un seuil de ${CHUTE.seuil}`);
  exiger('… et l\'élan s\'est conservé (à la glisse près)', fort.avant > 0 && Math.abs(fort.apres - fort.avant) / fort.avant < 0.05, `${fort.avant.toFixed(0)} → ${fort.apres.toFixed(0)} kg·m/s`);
  exiger('un frôlement à 5 km/h ne renverse personne', !doux.tombe, doux.tombe ? 'tombé' : 'debout');
}

/* ---------- la graine (l'entraînement) ---------- */
{
  const partie = graine => {
    const e = nouvelleGlace(graine);
    const plan = t => (t < 3 ? { x: 1, y: 0 } : t < 4 ? { x: 0, y: 1, tir: true } : t < 4.5 ? { x: 1, y: 0.3 } : t < 6 ? { x: 1, y: 0, passe: t > 5.5 } : { x: -1, y: 0 });
    for (let t = 0; t < 8; t += DT) avancer(e, { toi: plan(t) }, DT);
    return empreinte(e);
  };
  exiger('les mêmes entrées sur la même graine rejouent la même glace', partie('abc') === partie('abc'), partie('abc'));
}

/* ---------- le match : deux clubs joués par l'IA ---------- */
const club = (tag, k0) => ({ nom: tag, tag, patineurs: [
  ...[0, 1, 2].flatMap(l => ['AG', 'C', 'AD'].map((poste, i) => ({ id: k0 + l * 3 + i, nom: `${tag} ${poste}${l}`, poste, ligne: l, p: parametresDuPatineur({ cote: 8 + ((l * 3 + i) % 7), tir: 9 + (i * 3) % 8, jeu: 8 + (l * 5) % 9 }) }))),
  ...[0, 1].flatMap(l => [0, 1].map(i => ({ id: k0 + 20 + l * 2 + i, nom: `${tag} D${l}${i}`, poste: 'D', ligne: l, p: parametresDuPatineur({ cote: 9, robustesse: 14, poidsLb: 210 }) }))),
], gardien: { nom: `${tag} G`, p: parametresDuGardien({ arrets: 12 }) } });
const matchComplet = (graine, periode = 120, prolongation = MATCH.prolongation) => {
  const e = nouveauMatch({ graine, A: club('AAA', 100), B: club('BBB', 200), periode, prolongation, humain: null, ia: decisionIA });
  const compte = {};
  let pas = 0;
  while (!e.match.fini && pas < 120 * 60 * 30) { for (const x of avancer(e, {}, DT)) compte[x.type] = (compte[x.type] || 0) + 1; pas++; }
  return { e, compte };
};
{
  const { e, compte } = matchComplet('mesure', 120);
  const M = e.match;
  exiger('un match de l\'IA contre l\'IA va au bout : trois périodes et un vainqueur', M.fini && M.periode >= 3 && !!M.vainqueur, `${M.pointage.A}–${M.pointage.B}, ${M.periode} période(s)${M.prolongation ? ', prolongation' : ''}${M.fusillade ? ', tirs de barrage' : ''}`);
  borne('… avec des tirs des deux côtés (3 × 2 min)', M.tirs.A + M.tirs.B, 12, 160, ' tirs');
  borne('… des buts, mais pas une pluie', M.pointage.A + M.pointage.B, 1, 12, ' buts');
  borne('… des mises en jeu gagnées des deux côtés', Math.min(M.mej.A, M.mej.B), 1, 60);
  exiger('… des passes, des prises, des mises en échec', (compte.passe || 0) > 10 && (compte.prise || 0) > 20 && (compte.echec || 0) > 0, `${compte.passe || 0} passes, ${compte.prise || 0} prises, ${compte.echec || 0} contacts`);
  borne('… et pas plus de punitions qu\'un match de la LNH n\'en voit (par 6 min ; JP : *ya trop de pénalités*)', compte.punition || 0, 0, 4);
  informer('ce que le match a vu', Object.entries(compte).map(([k, n]) => `${k} ${n}`).join(' · '));
  const lignes = e.equipes.A.lignes.F;
  exiger('les trois trios sont là, et les deux paires', lignes.every(l => l.length === 3) && e.equipes.A.lignes.D.every(l => l.length === 2), `${lignes.map(l => l.length).join('+')} avants, ${e.equipes.A.lignes.D.map(l => l.length).join('+')} défenseurs`);
  const ontJoue = e.patineurs.filter(s => s.stats.tg > 10).length;
  exiger('les jambes ont joué : les lignes ont changé, et personne n\'a joué seul tout le match', ontJoue > 10 && e.patineurs.some(s => s.jambes < 100), `${ontJoue} patineurs ont plus de 10 s de glace`);
}
/* ---------- l'IA : le défenseur ne se laisse pas déborder (JP, 1er nov. : *éviter trop d'échappées*) ---------- */
{
  const e = nouveauMatch({ graine: 'ecart', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
  for (let t = 0; t < 10 && (e.mej || e.arret || !e.enJeu); t += DT) avancer(e, {}, DT);   // la rondelle tombe, le jeu commence
  const aA = e.equipes.A.attaque;
  const porteur = surGlace(e, 'A').find(s => s.poste === 'C');
  const D = surGlace(e, 'B').filter(s => s.poste === 'D');
  // Le porteur part du centre à pleine vitesse vers leur filet ; les deux défenseurs l'attendent à leur bleue, immobiles,
  // les autres sont loin derrière lui.
  Object.assign(porteur, { x: 0, y: 0, vx: aA * 11, vy: 0, cap: aA > 0 ? 0 : Math.PI });
  Object.assign(e.rondelle, { x: aA * 1, y: 0, vx: 0, vy: 0, z: 0, porteur: porteur.id });
  D.forEach((d, i) => Object.assign(d, { x: aA * (BLEUE + 1), y: i ? 4.5 : -4.5, vx: 0, vy: 0 }));
  for (const s of e.patineurs) if (s.surGlace && s !== porteur && !D.includes(s)) Object.assign(s, { x: -aA * 20, y: s.y, vx: 0, vy: 0 });
  const recule = D.map(d => decisionIA(e, d)).map(r => r.x * aA);
  exiger('le porteur arrive à pleine vitesse : les défenseurs reculent avant d\'être dépassés', recule.every(v => v > 0.2), `${recule.map(v => v.toFixed(2)).join(' et ')} vers leur filet (l'écart : ${ECART_D.base} m + ${ECART_D.parVitesse} m par m/s)`);
}

{
  const e = nouveauMatch({ graine: 'cinq', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
  jouer(e, {}, 0.6);
  exiger('cinq patineurs par club sur la glace au coup d\'envoi, et un gardien chacun', surGlace(e, 'A').length === 5 && surGlace(e, 'B').length === 5 && e.gardiens.length === 2, `${surGlace(e, 'A').length} et ${surGlace(e, 'B').length}`);
}
{
  const a = matchComplet('graine-x', 60).e, b = matchComplet('graine-x', 60).e;
  exiger('la même graine rejoue le même match, IA comprise', empreinte(a) === empreinte(b), `${empreinte(a)} · ${a.match.pointage.A}–${a.match.pointage.B}`);
}
{
  // La prolongation à trois contre trois, puis les tirs de barrage : des périodes de dix secondes, personne ne marque.
  // Une série fixe de graines ; la première qui finit à égalité ET dont la prolongation reste blanche sert (le même résultat à chaque fois).
  let e = null;
  for (let k = 0; k < 40 && !e; k++) { const essai = matchComplet(`nul-${k}`, 8, 8).e; if (essai.match.prolongation && essai.match.fusillade) e = essai; }
  const M = e ? e.match : { pointage: { A: '?', B: '?' } };
  exiger('un match nul va en prolongation, puis aux tirs de barrage, et finit avec un vainqueur', !!e && M.prolongation && !!M.fusillade && M.fini && !!M.vainqueur, `${M.pointage.A}–${M.pointage.B}, ronde ${M.fusillade ? M.fusillade.ronde : '-'}, ${M.fusillade ? `${M.fusillade.essais.A}+${M.fusillade.essais.B} essais` : ''}`);
}
{
  // LES RÈGLES, UNE À UNE, sur une glace de match mise en scène.
  const scene = graine => {
    const e = nouveauMatch({ graine, A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
    jouer(e, {}, 0.6);   // le coup d'envoi placé
    e.mej = null; e.enJeu = true;
    return e;
  };
  // Le hors-jeu : un attaquant de A déjà dans la zone adverse quand A pousse la rondelle par-dessus la bleue.
  {
    const e = scene('horsjeu');
    const A = surGlace(e, 'A'), porteur = A[0], fautif = A[1];
    for (const s of surGlace(e, 'B')) { s.x = -20; s.y = 10; }
    Object.assign(porteur, { x: BLEUE - 3, y: 0, cap: 0, vx: 0, vy: 0 });
    Object.assign(fautif, { x: BLEUE + 3, y: 5, vx: 0, vy: 0 });
    Object.assign(e.rondelle, { x: BLEUE - 1.9, y: 0.3, vx: 0, vy: 0 });
    const ev = jouer(e, { [porteur.id]: { x: 1, y: 0 } }, 1.5);
    exiger('le hors-jeu se siffle quand un attaquant précède la rondelle dans la zone', ev.some(x => x.type === 'horsjeu' && x.equipe === 'A' && x.qui === fautif.id) && e.arret && e.arret.genre === 'horsjeu', ev.filter(x => x.type !== 'prise').map(x => x.type).join(' ') || 'rien');
    exiger('… et la mise en jeu suivante est au point de la zone neutre', e.arret && Math.abs(Math.abs(e.arret.point.x) - POINT.neutre) < 0.01, e.arret ? `(${e.arret.point.x.toFixed(2)}, ${e.arret.point.y.toFixed(2)})` : 'aucun');
  }
  // Le dégagement refusé : A lance de sa moitié, la rondelle passe la ligne de but adverse sans être touchée.
  {
    const e = scene('degagement');
    const A = surGlace(e, 'A'), porteur = A[0];
    for (const s of [...surGlace(e, 'A'), ...surGlace(e, 'B')]) { if (s !== porteur) { s.x = -24; s.y = 10; s.vx = 0; s.vy = 0; } }
    Object.assign(porteur, { x: -24, y: 10, cap: 0, vx: 0, vy: 0 });
    // La rondelle, lancée de sa moitié vers le coin adverse, que personne ne touche (le gardien est hors du chemin).
    const G2 = e.gardiens.find(g => g.equipe === 'B'); G2.x = LIGNE_BUT - 1; G2.y = -8;
    Object.assign(e.rondelle, { x: -5, y: 6, vx: 26, vy: 1.5, porteur: null, dernier: { equipe: 'A', id: porteur.id, t: e.t, x: -5, lance: true } });
    const ev = jouer(e, {}, 3);
    const dg = ev.find(x => x.type === 'remise' && x.point);
    exiger('le dégagement refusé se siffle quand la rondelle lancée de sa moitié passe la ligne de but', ev.some(x => x.type === 'degagement' && x.equipe === 'A'), ev.filter(x => x.type !== 'prise').map(x => x.type).join(' ') || 'rien');
    exiger('… et la mise en jeu revient dans la zone des fautifs', !!dg && dg.point.x < -POINT.x + 0.01, dg ? `(${dg.point.x.toFixed(2)}, ${dg.point.y.toFixed(2)})` : 'aucune');
  }
  // La punition : B charge par-derrière un joueur de A qui n'a pas la rondelle ; B joue à quatre ; un but de A le libère.
  {
    const e = scene('punition');
    const A = surGlace(e, 'A'), B = surGlace(e, 'B');
    const victime = A[0], frappeur = B[0];
    for (const s of [...A, ...B]) { s.x = -20; s.y = 10; s.vx = 0; s.vy = 0; }
    Object.assign(victime, { x: 0, y: -6, cap: 0, vx: 0, vy: 0 });
    Object.assign(frappeur, { x: -2.5, y: -6, cap: 0, vx: 9, vy: 0, elan: 0.35 });   // le bouton pressé : l'élan court encore au contact
    // Les fautifs ont la rondelle (un coéquipier du frappeur la porte) : la punition tombe tout de suite.
    const porteurB = B[1];
    Object.assign(porteurB, { x: 15, y: 8, cap: 0, vx: 0, vy: 0 });
    Object.assign(e.rondelle, { x: 16.1, y: 8.3, vx: 0, vy: 0, porteur: porteurB.id });
    const ev = jouer(e, { [frappeur.id]: { x: 1, y: 0 }, [porteurB.id]: { x: 0, y: 0 } }, 1.2);
    const p = ev.find(x => x.type === 'punition');
    exiger('une charge par-derrière sur un joueur sans la rondelle est une punition', !!p && p.equipe === 'B' && p.qui === frappeur.id, p ? p.genre : ev.filter(x => x.type !== 'prise').map(x => x.type).join(' ') || 'rien');
    const avant = e.match.penalites.length;
    const evR = jouer(e, {}, 2);   // la pause, puis la mise en jeu
    const rm = evR.find(x => x.type === 'remise' && x.point);
    exiger('… le puni est au cachot et son club joue à quatre', avant === 1 && droitSurGlace(e, 'B') === 4 && surGlace(e, 'B').length === 4 && !frappeur.surGlace, `${surGlace(e, 'B').length} B sur la glace, ${e.match.penalites.length} puni(s), ${e.match.pim.B} min`);
    exiger('… la mise en jeu est dans la zone des fautifs', !!rm && rm.point.x * e.equipes.B.attaque < 0, rm ? `(${rm.point.x.toFixed(1)}, ${rm.point.y.toFixed(1)})` : 'aucune');
    // Un but de A en avantage numérique libère le puni.
    e.mej = null; e.enJeu = true;
    for (const s of [...surGlace(e, 'A'), ...surGlace(e, 'B')]) { s.x = -20; s.y = -10; s.vx = 0; s.vy = 0; }
    const G2 = e.gardiens.find(g => g.equipe === 'B'); G2.x = LIGNE_BUT + 2; G2.y = 8;
    Object.assign(e.rondelle, { x: LIGNE_BUT - 3, y: 0, vx: 25, vy: 0, porteur: null, dernier: { equipe: 'A', id: victime.id, t: e.t, x: LIGNE_BUT - 3, lance: true } });
    const ev2 = jouer(e, {}, 0.5);
    exiger('… et un but en avantage numérique le libère', ev2.some(x => x.type === 'but' && x.equipe === 'A') && ev2.some(x => x.type === 'liberation') && e.match.penalites.length === 0, ev2.map(x => x.type).join(' '));
  }
  // La punition à retardement : les fautifs n'ont pas la rondelle, le sifflet attend qu'ils la touchent.
  {
    const e = scene('retard');
    const A = surGlace(e, 'A'), B = surGlace(e, 'B');
    const porteurA = A[2], victime = A[0], frappeur = B[0];
    for (const s of [...A, ...B]) { s.x = -20; s.y = 10; s.vx = 0; s.vy = 0; }
    Object.assign(porteurA, { x: 5, y: 8, cap: 0, vx: 0, vy: 0 });
    Object.assign(e.rondelle, { x: 6.1, y: 8.3, vx: 0, vy: 0 });
    avancer(e, { [porteurA.id]: { x: 0, y: 0 } }, DT);
    Object.assign(victime, { x: 0, y: -6, cap: 0, vx: 0, vy: 0 });
    Object.assign(frappeur, { x: -2.5, y: -6, cap: 0, vx: 9, vy: 0, elan: 0.35 });   // le bouton pressé : l'élan court encore au contact
    const ev = jouer(e, { [frappeur.id]: { x: 1, y: 0 }, [porteurA.id]: { x: 0, y: 0 } }, 1);
    const p = ev.find(x => x.type === 'punition');
    exiger('la punition à retardement : le sifflet attend tant que l\'équipe lésée a la rondelle', !!p && p.attente && !e.arret && e.match.enAttente && e.match.enAttente.id === frappeur.id, p ? `${p.genre}, en attente` : 'rien');
    // … et tombe à l'instant où les fautifs la touchent : A la lance vers un B placé devant.
    const receveurB = B[2];
    Object.assign(receveurB, { x: 12, y: 8, cap: Math.PI, vx: 0, vy: 0 });
    Object.assign(e.rondelle, { x: 7, y: 8, vx: 9, vy: 0, z: 0, vz: 0, porteur: null, passeDe: null, dernier: { equipe: 'A', id: porteurA.id, t: e.t, x: 7, lance: true } });
    const ev2 = jouer(e, {}, 1.2);
    exiger('… et tombe dès que les fautifs touchent la rondelle (JP : *pénalité à retardement brisée*)', !e.match.enAttente && e.match.penalites.some(q => q.id === frappeur.id) && e.arret && e.arret.genre === 'punition' && frappeur.boxe, `${e.match.penalites.length} puni(s), ${e.arret ? e.arret.genre : 'le jeu continue'}, ${ev2.filter(x => x.type !== 'prise').map(x => x.type).join(' ')}`);
  }
  // LE HORS-JEU DIFFÉRÉ : la rondelle passée dans la zone avec un attaquant déjà dedans, le bras se lève, le jeu continue.
  {
    const e = scene('differe');
    const A = surGlace(e, 'A'), fautif = A[1], passeur = A[0];
    for (const s of surGlace(e, 'B')) { s.x = -20; s.y = 10; }
    for (const s of A) { s.x = -15; s.y = -8; s.vx = 0; s.vy = 0; }
    Object.assign(fautif, { x: BLEUE + 4, y: 6, cap: Math.PI, vx: 0, vy: 0 });
    Object.assign(passeur, { x: BLEUE - 5, y: -6, cap: 0, vx: 0, vy: 0 });
    Object.assign(e.rondelle, { x: BLEUE - 2.2, y: -6, vx: 14, vy: 0, z: 0, vz: 0, porteur: null, dernier: { equipe: 'A', id: passeur.id, t: e.t, x: BLEUE - 2.2, lance: true } });   // déjà loin de la lame du passeur
    const ev = jouer(e, { [fautif.id]: { x: -1, y: 0 } }, 0.6);
    exiger('le hors-jeu différé : lancée dans la zone avec un attaquant dedans, le bras se lève et le jeu continue', ev.some(x => x.type === 'horsjeuDiffere' && x.equipe === 'A') && !ev.some(x => x.type === 'horsjeu') && !e.arret && e.match.horsJeuDiffere === 'A', ev.filter(x => x.type !== 'prise').map(x => x.type).join(' ') || 'rien');
    // L'attaquant ressort : le bras tombe.
    const ev2 = jouer(e, { [fautif.id]: { x: -1, y: 0 } }, 2.5);
    exiger('… il tombe quand les attaquants ressortent de la zone', ev2.some(x => x.type === 'horsjeuLeve') && !e.match.horsJeuDiffere && !ev2.some(x => x.type === 'horsjeu'), ev2.filter(x => x.type !== 'prise').map(x => x.type).join(' ') || 'rien');
  }
  {
    const e = scene('differe-touche');
    const A = surGlace(e, 'A'), fautif = A[1], passeur = A[0];
    for (const s of surGlace(e, 'B')) { s.x = -20; s.y = 10; }
    for (const s of A) { s.x = -15; s.y = -8; s.vx = 0; s.vy = 0; }
    Object.assign(fautif, { x: BLEUE + 6, y: -6, cap: Math.PI, vx: 0, vy: 0, lachee: 0 });
    Object.assign(passeur, { x: BLEUE - 5, y: -6, cap: 0, vx: 0, vy: 0 });
    Object.assign(e.rondelle, { x: BLEUE - 2.2, y: -6, vx: 14, vy: 0, z: 0, vz: 0, porteur: null, dernier: { equipe: 'A', id: passeur.id, t: e.t, x: BLEUE - 2.2, lance: true } });   // déjà loin de la lame du passeur
    const ev = jouer(e, { [fautif.id]: { x: 0, y: 0 } }, 1.5);
    exiger('… et siffle si un attaquant la touche dans la zone pendant ce temps', ev.some(x => x.type === 'horsjeuDiffere') && ev.some(x => x.type === 'horsjeu' && x.genre === 'touche') && e.arret && e.arret.genre === 'horsjeu', ev.filter(x => x.type !== 'prise').map(x => x.type).join(' ') || 'rien');
  }
}

/* ---------- la hauteur de la rondelle (1er nov. 2026) ---------- */
{
  const e = glaceVide('haut');
  Object.assign(e.rondelle, { x: -20, y: 6, vx: 4, vy: 0, z: 1, vz: 0 });
  let rebond = 0, posee = false;
  for (let t = 0; t < 3; t += DT) { avancer(e, {}, DT); if (e.rondelle.z <= 0) posee = true; if (posee && e.rondelle.z > rebond) rebond = e.rondelle.z; }
  exiger('la rondelle en l\'air retombe sous la gravité et finit au sol', e.rondelle.z === 0 && e.rondelle.vz === 0, `z ${e.rondelle.z}`);
  borne('… après un rebond qui rend ce que le sol dit', rebond, RONDELLE.rebondSol ** 2 * 1 * 0.8, RONDELLE.rebondSol ** 2 * 1 * 1.05, ' m (depuis 1 m)');
}
{
  const tirHaut = z => {
    const e = glaceVide('barre');
    e.gardiens[0].y = -8;
    Object.assign(e.rondelle, { x: LIGNE_BUT - 1, y: 0, vx: 22, vy: 0, z, vz: 0 });   // à un mètre : la gravité n'a pas le temps
    return jouer(e, {}, 0.5);
  };
  const dessus = tirHaut(FILET.haut + 0.3), dedans = tirHaut(0.6), barre = tirHaut(FILET.haut);
  exiger('un tir par-dessus la barre horizontale n\'est pas un but', !dessus.some(x => x.type === 'but') && !dessus.some(x => x.type === 'poteau'), dessus.map(x => x.type).join(' ') || 'rien');
  exiger('… le même tir à 60 cm du sol en est un', dedans.some(x => x.type === 'but'), dedans.map(x => x.type).join(' ') || 'rien');
  exiger('… et juste à la barre, elle sonne et revient', barre.some(x => x.type === 'poteau' && x.barre) && !barre.some(x => x.type === 'but'), barre.map(x => x.type).join(' ') || 'rien');
}
{
  // La passe soulevée : un adversaire couché sur la ligne de passe, la rondelle passe par-dessus.
  const e = nouveauMatch({ graine: 'saucer', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: 'A', ia: decisionIA });
  jouer(e, {}, 0.6); e.mej = null; e.enJeu = true;
  const A = surGlace(e, 'A'), B = surGlace(e, 'B');
  for (const s of [...A, ...B]) { s.x = -20; s.y = 10; s.vx = 0; s.vy = 0; }
  const porteur = A[0], receveur = A[1], barreur = B[0];
  Object.assign(porteur, { x: 0, y: -5, cap: 0, vx: 0, vy: 0 });
  Object.assign(receveur, { x: 8, y: -5, cap: 0, vx: 0, vy: 0 });
  Object.assign(barreur, { x: 4, y: -5, cap: Math.PI, vx: 0, vy: 0, lachee: 2 });
  Object.assign(e.rondelle, { x: 1.1, y: -4.7, vx: 0, vy: 0, porteur: porteur.id });
  e.controles.A = porteur.id;
  let zMax = 0;
  const ev = [];
  for (let t = 0; t < 0.8; t += DT) { ev.push(...avancer(e, { [porteur.id]: { x: 1, y: 0, passe: t > 0.05 } }, DT)); zMax = Math.max(zMax, e.rondelle.z); }
  const p = ev.find(x => x.type === 'passe');
  exiger('une passe dont la ligne est barrée se soulève', !!p && p.soulevee && p.vers === receveur.id, p ? `vers ${p.vers}, soulevée ${p.soulevee}` : 'aucune passe');
  borne('… et monte assez pour passer un bâton', zMax, 0.3, 1.2, ' m');
}

{
  // LA DIRECTION D'ABORD (1er nov. 2026) : le coéquipier que le bâton pointe, couvert, contre un autre libre à 35° de là.
  const e = nouveauMatch({ graine: 'visee', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: 'A', ia: decisionIA });
  jouer(e, {}, 0.6); e.mej = null; e.enJeu = true;
  const A = surGlace(e, 'A'), B = surGlace(e, 'B');
  for (const s of [...A, ...B]) { s.x = -20; s.y = 10; s.vx = 0; s.vy = 0; }
  const porteur = A[0], vise = A[1], libre = A[2], couvreur = B[0];
  Object.assign(porteur, { x: 0, y: -5, cap: 0 });
  Object.assign(vise, { x: 10, y: -5, cap: 0 });
  Object.assign(libre, { x: 8, y: 0.6, cap: 0 });
  Object.assign(couvreur, { x: 5, y: -5, cap: Math.PI, lachee: 2 });
  Object.assign(e.rondelle, { x: 1.1, y: -4.7, vx: 0, vy: 0, porteur: porteur.id });
  e.controles.A = porteur.id;
  const ev = [];
  for (let t = 0; t < 0.3; t += DT) ev.push(...avancer(e, { [porteur.id]: { x: 1, y: 0, passe: t > 0.05 } }, DT));
  const p = ev.find(x => x.type === 'passe');
  exiger('la passe va au coéquipier que le bâton pointe, même couvert, pas au libre à 35°', !!p && p.vers === vise.id, p ? `vers ${p.vers === vise.id ? 'le pointé' : p.vers === libre.id ? 'le libre' : p.vers}` : 'aucune passe');
}

/* ---------- le patin de plus : reculer, couper, sprinter ---------- */
{
  const e = glaceVide('recul');
  const toi = e.patineurs[0];
  Object.assign(toi, { x: BOUT - 12, y: 9, cap: 0, vx: 0, vy: 0 });
  jouer(e, { toi: { x: -1, y: 0, recul: true } }, 2);
  let somme = 0, n = 0;   // la vitesse bat au rythme des coups de patin : sa moyenne sur une demi-seconde
  for (let t = 0; t < 0.5; t += DT) { avancer(e, { toi: { x: -1, y: 0, recul: true } }, DT); somme -= toi.vx; n++; }
  exiger('à reculons, on va vers l\'arrière le cap tenu devant', toi.vx < -3 && Math.abs(toi.cap) < 0.3, `vx ${toi.vx.toFixed(1)} m/s, cap ${toi.cap.toFixed(2)} rad`);
  borne('… moins vite qu\'en avant', somme / n / PATIN.vMax, PATIN.recul - 0.12, PATIN.recul + 0.02);
}
{
  const vitesseApres = tourne => {
    const e = glaceVide('coupe');
    const toi = e.patineurs[0];
    Object.assign(toi, { x: -(BOUT - 3.5), y: 6, cap: 0, vx: 0, vy: 0 });   // à côté du filet du fond
    jouer(e, { toi: { x: 1, y: 0 } }, 3);
    jouer(e, { toi: tourne ? { x: 0, y: 1 } : { x: 1, y: 0 } }, 0.5);
    return v(toi);
  };
  const droit = vitesseApres(false), coupe = vitesseApres(true);
  exiger('couper sec coûte de la vitesse', coupe < droit * 0.9, `${(droit * 3.6).toFixed(0)} km/h tout droit, ${(coupe * 3.6).toFixed(0)} km/h en coupant`);
}
{
  const course = sprint => {
    const e = glaceVide('turbo');
    const toi = e.patineurs[0];
    Object.assign(toi, { x: -(BOUT - 3.5), y: 9, cap: 0, vx: 0, vy: 0, jambes: 100 });
    let vmax = 0;
    for (let t = 0; t < 3; t += DT) { avancer(e, { toi: { x: 1, y: 0, sprint } }, DT); vmax = Math.max(vmax, v(toi)); }
    return { vmax, jambes: toi.jambes };
  };
  const sans = course(false), avec = course(true);
  exiger('le turbo va plus vite que la pointe ordinaire', avec.vmax > sans.vmax * 1.08, `${(sans.vmax * 3.6).toFixed(0)} → ${(avec.vmax * 3.6).toFixed(0)} km/h`);
  exiger('… et use les jambes bien plus vite', 100 - avec.jambes > (100 - sans.jambes) * 2.5, `${(100 - sans.jambes).toFixed(1)} contre ${(100 - avec.jambes).toFixed(1)} jambes en 3 s`);
}

/* ---------- ce qui fait qu'un match se raconte ---------- */
{
  const e = nouveauMatch({ graine: 'aides', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
  jouer(e, {}, 0.6); e.mej = null; e.enJeu = true;
  const A = surGlace(e, 'A'), B = surGlace(e, 'B');
  for (const s of [...A, ...B]) { s.x = -20; s.y = -10; s.vx = 0; s.vy = 0; }
  const passeur = A[0], marqueur = A[1];
  e.match.touches.A = [{ id: passeur.id, t: e.t - 2 }];
  const G2 = e.gardiens.find(g => g.equipe === 'B'); G2.x = LIGNE_BUT + 2; G2.y = 8;
  Object.assign(e.rondelle, { x: LIGNE_BUT - 3, y: 0, vx: 25, vy: 0, z: 0.3, vz: 0, porteur: null, dernier: { equipe: 'A', id: marqueur.id, t: e.t, x: LIGNE_BUT - 3, lance: true } });
  const ev = jouer(e, {}, 0.5);
  const b = ev.find(x => x.type === 'but');
  exiger('un but porte sa passe décisive : le dernier coéquipier à avoir touché la rondelle', !!b && b.qui === marqueur.id && b.aides.length === 1 && b.aides[0] === passeur.id, b ? `${b.qui}, aides ${b.aides.join(',')}` : 'aucun but');
  exiger('… et chacun la compte dans ses stats', marqueur.stats.buts === 1 && passeur.stats.aides === 1 && e.match.journal[0].aides[0] === passeur.id, `${marqueur.stats.buts} B, ${passeur.stats.aides} A`);
}
{
  const { e } = matchComplet('etoiles', 90);
  const E = e.match.etoiles;
  exiger('la fin du match nomme trois étoiles, à leur note', E.length === 3 && E.every(x => x.nom && x.equipe) && E[0].note >= E[1].note && E[1].note >= E[2].note, E.map(x => `${x.nom} ${x.note.toFixed(1)}`).join(' · '));
}
{
  const e = nouveauMatch({ graine: 'desert', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: 'B', ia: decisionIA });
  jouer(e, {}, 0.6); e.mej = null; e.enJeu = true;
  retirerGardien(e, 'B', true);
  const six = surGlace(e, 'B').length;
  exiger('le gardien retiré, un sixième attaquant saute sur la glace', six === 6 && droitSurGlace(e, 'B') === 6 && e.gardiens.find(g => g.equipe === 'B').retire, `${six} B sur la glace`);
  for (const s of [...surGlace(e, 'A'), ...surGlace(e, 'B')]) { s.x = -20; s.y = -10; s.vx = 0; s.vy = 0; }
  const tireur = surGlace(e, 'A')[0];
  Object.assign(e.rondelle, { x: LIGNE_BUT - 6, y: 0, vx: 18, vy: 0, z: 0, vz: 0, porteur: null, dernier: { equipe: 'A', id: tireur.id, t: e.t, x: LIGNE_BUT - 6, lance: true } });
  const ev = jouer(e, {}, 0.8);
  exiger('… et un tir vers le filet désert entre', ev.some(x => x.type === 'but' && x.equipe === 'A') && e.match.pointage.A === 1, ev.map(x => x.type).join(' '));
  jouer(e, {}, 4);
  exiger('… à l\'arrêt de jeu, le gardien remis revient dans son filet', (retirerGardien(e, 'B', false), !e.gardiens.find(g => g.equipe === 'B').retire && droitSurGlace(e, 'B') === 5), `${surGlace(e, 'B').length} B`);
}
{
  // LE TIR DE PUNITION : un harpon raté par-derrière accroche le porteur en échappée. Le dé décide ; sur une série
  // fixe de graines, il arrive, et le match reprend après la ronde.
  let trouve = null, essais = 0;
  for (let k = 0; k < 400 && !trouve; k++) {
    const e = nouveauMatch({ graine: `echappee-${k}`, A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: 'B', ia: decisionIA });
    jouer(e, {}, 0.6); e.mej = null; e.enJeu = true;
    const A = surGlace(e, 'A'), B = surGlace(e, 'B');
    for (const s of [...A, ...B]) { s.x = -20; s.y = -10; s.vx = 0; s.vy = 0; }
    const porteur = A[0], chasseur = B[0];
    Object.assign(porteur, { x: 6, y: 0, cap: 0, vx: 7, vy: 0 });
    Object.assign(chasseur, { x: 4.95, y: 0.3, cap: 0, vx: 7, vy: 0 });   // dans son dos, à portée de harpon, sans le toucher
    Object.assign(e.rondelle, { x: 7.1, y: 0.3, vx: 7, vy: 0, porteur: porteur.id });
    e.controles.B = chasseur.id;
    const ev = [];
    // Le harpon part à l'appui, pas tenu : on presse par coups, tous les 0,8 s.
    for (let t = 0; t < 2 && !ev.some(x => x.type === 'tirpunition'); t += DT) ev.push(...avancer(e, { [chasseur.id]: { x: 1, y: 0, tir: (t % 0.8) < 0.3 } }, DT));
    essais++;
    if (ev.some(x => x.type === 'tirpunition')) trouve = { e, ev };
  }
  exiger('un harpon raté par-derrière sur une échappée vaut un tir de punition', !!trouve && trouve.e.match.tirDePunition && trouve.e.match.tirDePunition.eq === 'A', trouve ? `à la graine ${essais}` : `jamais en ${essais} essais`);
  if (trouve) {
    const { e } = trouve;
    const ev = jouer(e, {}, 3);
    exiger('… joué seul devant le gardien, comme une ronde', ev.some(x => x.type === 'remise') && e.match.ronde && e.match.ronde.genre === 'punition' && surGlace(e, 'A').length === 1 && surGlace(e, 'B').length === 0, e.match.ronde ? `ronde ${e.match.ronde.genre}, ${surGlace(e, 'A').length} A sur la glace` : 'pas de ronde');
    const ev2 = jouer(e, {}, MATCH.tirDePunition + 4);
    exiger('… puis le match reprend', ev2.some(x => x.type === 'ronde' && x.genre === 'punition') && !e.match.ronde && !e.match.tirDePunition && !e.match.fini && surGlace(e, 'A').length === 5, `${surGlace(e, 'A').length} A, ronde ${e.match.ronde ? 'encore' : 'finie'}`);
  }
}
{
  // En séries, pas de trois contre trois ni de tirs de barrage : une prolongation à cinq, de la longueur d'une période.
  // Un match nul après le temps réglementaire, cherché graine après graine (le pointage dépend de l'IA, pas la règle).
  let e = null;
  for (let g = 0; g < 30 && !(e && e.match.prolongation); g++) {
    e = nouveauMatch({ graine: `nul${g}`, A: club('AAA', 100), B: club('BBB', 200), periode: 8, prolongation: 8, humain: null, ia: decisionIA, series: true });
    let pas = 0;
    while (!e.match.prolongation && !e.match.fini && pas < 120 * 60) { avancer(e, {}, DT); pas++; }
  }
  const M = e.match;
  exiger('en séries, la prolongation se joue à cinq, une période entière, sans tirs de barrage', M.prolongation && !M.fusillade && M.series && M.reste <= 8 && M.reste > 7 && droitSurGlace(e, 'A') === 5, `${M.pointage.A}–${M.pointage.B}, P${M.periode}, ${M.reste.toFixed(1)} s, ${droitSurGlace(e, 'A')} sur la glace`);
}
{
  const e = nouveauMatch({ graine: 'deux', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humains: ['A', 'B'], ia: decisionIA });
  jouer(e, {}, 0.6);
  const a = e.patineurs.find(s => s.id === e.controles.A), b = e.patineurs.find(s => s.id === e.controles.B);
  exiger('à deux joueurs, chacun contrôle un patineur de son club', !!a && !!b && a.equipe === 'A' && b.equipe === 'B' && a.surGlace && b.surGlace, `${e.controles.A} et ${e.controles.B}`);
}
{
  const dur = nouveauMatch({ graine: 'dur', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: 'A', ia: decisionIA, difficulte: 'difficile' });
  const base = club('BBB', 200).patineurs[0].p.vMax;
  const b = dur.patineurs.find(s => s.equipe === 'B'), a = dur.patineurs.find(s => s.equipe === 'A');
  exiger('la difficulté pèse sur le club de l\'IA seulement', Math.abs(b.p.vMax / base - DIFFICULTES.difficile) < 1e-9 && Math.abs(a.p.vMax - club('AAA', 100).patineurs[0].p.vMax) < 1e-9, `B ×${(b.p.vMax / base).toFixed(2)}, A ×${(a.p.vMax / club('AAA', 100).patineurs[0].p.vMax).toFixed(2)}`);
}
{
  // Une collision de course, sans le bouton : elle renverse peut-être, elle n'est jamais punie.
  const e = nouveauMatch({ graine: 'course', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
  jouer(e, {}, 0.6); e.mej = null; e.enJeu = true;
  const A = surGlace(e, 'A'), B = surGlace(e, 'B');
  for (const s of [...A, ...B]) { s.x = -20; s.y = 10; s.vx = 0; s.vy = 0; }
  const victime = A[0], coureur = B[0];
  Object.assign(victime, { x: 0, y: -6, cap: 0, vx: 0, vy: 0 });
  Object.assign(coureur, { x: -2.5, y: -6, cap: 0, vx: 10, vy: 0, elan: 0 });
  const porteurB = B[1];
  Object.assign(porteurB, { x: 15, y: 8, cap: 0, vx: 0, vy: 0 });
  Object.assign(e.rondelle, { x: 16.1, y: 8.3, vx: 0, vy: 0, porteur: porteurB.id });
  const ev = jouer(e, { [coureur.id]: { x: 1, y: 0 }, [porteurB.id]: { x: 0, y: 0 } }, 1.2);
  exiger('une collision de course, par-derrière mais sans le bouton, n\'est pas une punition', ev.some(x => x.type === 'echec' && x.qui === coureur.id) && !ev.some(x => x.type === 'punition'), ev.filter(x => x.type !== 'prise').map(x => x.type).join(' ') || 'rien');
}

/* ---------- les règles, écrites de là ---------- */
{
  const r = reglesDeLaGlace();
  exiger('les règles de la glace se lisent du code', r.length >= 11 && r.every(l => /\d/.test(l)), `${r.length} lignes`);
  exiger('… et disent les constantes', r.some(l => l.includes(`${Math.round(RONDELLE.masse * 1000)} g`)) && r.some(l => l.includes(`${Math.round(GARDIEN.reaction * 1000)} ms`)) && r.some(l => l.includes(`${PATIN.masse} kg`)) && r.some(l => l.includes(`${MATCH.punition / 60} minutes`)) && r.some(l => l.includes(`${Math.round(GARDIEN.trous.haut * 100)} %`)) && r.some(l => l.includes(`${MATCH.retraitGardien} s`)), 'la masse, la réaction, le poids, la punition, les trous, le retrait');
}

verdict(`La physique de Sur glace · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
