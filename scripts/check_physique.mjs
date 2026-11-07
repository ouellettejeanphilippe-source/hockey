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
 *                 difficulté ; une collision de course n'est jamais punie (1er nov. 2026) ;
 *   la mise en jeu  le placement de la LNH à chaque point (personne dans le cercle, les défenseurs dans la zone, le
 *                 hors-jeu tenu), un duel : le bouton à la chute, le bâton qui dit où, le Jeu, la rondelle libre ;
 *                 l'IA presse le même bouton ; la passe en route, la bleue qu'on ne dépasse pas (2 nov. 2026) ;
 *   le lot 2      la prise qui serait hors-jeu, l'IA qui tague la bleue, le lancer au fond, la sortie de zone, le
 *                 dégagement, le cycle, l'écran et la déviation, l'avant au filet ; des matchs de l'IA mesurés : le
 *                 hors-jeu, la passe, la sortie, l'enclave, les buts (2 nov. 2026) ;
 *   le lot 3      protéger la rondelle (le harpon qui passe moins, l'IA dans le coin), la feinte (le harpon et la
 *                 charge qui mordent, l'IA qui feinte), le revers et la main du joueur, la passe laissée, le trio
 *                 choisi à l'arrêt de jeu, le changement à la volée par la porte du banc, le gardien remis qui attend
 *                 qu'un patineur sorte ; dans les matchs mesurés, le cycle et jamais un patineur de trop (2 nov. 2026) ;
 *   le lot 4      soulever le bâton (il vole la rondelle d'un porteur qui protège, sans punition), les fautes de bâton
 *                 (l'accrochage, le cinglage, le bâton élevé : chacune son fait et son dé), la bagarre (les durs
 *                 seulement, le duel au bouton, cinq minutes chacun, les deux clubs à cinq) ; dans les matchs mesurés,
 *                 les punitions par match (2 nov. 2026).
 *
 *   node scripts/check_physique.mjs
 */
import { exiger, borne, informer, verdict } from './verdict.mjs';
import { nouvelleGlace, nouveauMatch, avancer, remise, empreinte, reglesDeLaGlace, lame, bander, surGlace, droitSurGlace, retirerGardien, parametresDuPatineur, parametresDuGardien, porteDuBanc, leveraitLeBaton, DIFFICULTES, L, W, LIGNE_BUT, BLEUE, POINT, FILET, PATIN, FOULEE, BATON, RONDELLE, GARDIEN, CHUTE, MATCH, MEJ, REVERS, PROTEGE, FEINTE, LAISSEE, BANC, JAMBES, HARPON, FAUTES, BAGARRE, LEVE, CELEBRATION, OBSTRUCTION, CONTOUR, DOUBLE, RUDESSE } from '../js/physique.js';
import { PATINEURS, DROITIERS, ANCRE } from '../js/sprites.js';
import { decisionIA, styleDuClub, ECART_D, SORTIE, ECRAN_D, FOND, UNE_TEMPS } from '../js/glace-ia.js';

const t0 = Date.now();
const G = 9.81;
const DT = 1 / 60;
const v = o => Math.hypot(o.vx, o.vy);
const dec1 = x => x.toFixed(1).replace('.', ',');
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
    // Le long de la bande, elle perd `longe` × la poussée qui la frappe ((1 + bande) × la vitesse en travers ; ici, en travers = le long).
    const garde = 1 - RONDELLE.longe * (1 + RONDELLE.bande);
    borne(`le rebond garde la vitesse le long de la bande, moins le frottement contre elle (${Math.round(garde * 100)} % à 45°)`, apres.vx / avant.vx, garde - 0.02, garde + 0.005);
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

{
  // LA RONDELLE QUI LONGE LA BANDE : elle la frôle (moins de `colle` m/s en travers) : elle y reste collée et roule le long.
  const e = glaceVide();
  Object.assign(e.rondelle, { x: -5, y: W / 2 - 0.4, vx: 10, vy: 1 });
  let touche = false, n = 0, colle = 0;
  for (let t = 0; t < 1.2; t += DT) {
    avancer(e, {}, DT);
    if (!touche && e.rondelle.y >= W / 2 - RONDELLE.rayon - 1e-6) touche = true;
    if (touche) { n++; if (W / 2 - e.rondelle.y < 0.1) colle++; }
  }
  exiger('la rondelle qui frôle la bande la longe, collée, au lieu de repartir net', touche && colle === n && e.rondelle.vx > 6, touche ? `${colle}/${n} pas collée, ${e.rondelle.vx.toFixed(1)} m/s le long` : 'elle n\'a pas touché la bande');
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
  while (!e.match.fini && pas < 120 * 60 * 30) {
    for (const x of avancer(e, {}, DT)) { compte[x.type] = (compte[x.type] || 0) + 1; if (x.type === 'tir' && x.uneTemps) compte.uneTemps = (compte.uneTemps || 0) + 1; }
    pas++;
  }
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
  borne('… des tirs sur réception de l\'IA (3 × 2 min)', compte.uneTemps || 0, 1, 40, ' tirs');
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

/* ---------- l'IA : le tir sur réception (la revue de novembre, § 9) ---------- */
{
  // Une passe des siens arrive au receveur dans l'enclave, ou loin du filet ; personne d'autre près.
  const scene = (loin) => {
    const e = nouveauMatch({ graine: 'unetemps', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
    for (let t = 0; t < 10 && (e.mej || e.arret || !e.enJeu); t += DT) avancer(e, {}, DT);
    const aA = e.equipes.A.attaque, A = surGlace(e, 'A'), B = surGlace(e, 'B');
    const passeur = A.find(s => s.poste === 'D'), recoit = A.find(s => s.poste === 'AD');
    Object.assign(recoit, { x: aA * (LIGNE_BUT - loin), y: 2.5, vx: 0, vy: 0, cap: aA > 0 ? 0 : Math.PI });
    const dep = { x: aA * (LIGNE_BUT - 9), y: -6 };
    Object.assign(passeur, { x: -aA * 15, y: dep.y, vx: 0, vy: 0 });   // il a passé et file au banc : loin de la rondelle
    for (const s of [...A, ...B]) if (s !== passeur && s !== recoit) Object.assign(s, { x: -aA * 15, y: s.y, vx: 0, vy: 0 });
    const dx = recoit.x - dep.x, dy = recoit.y - dep.y, d = Math.hypot(dx, dy);
    Object.assign(e.rondelle, { x: dep.x, y: dep.y, z: 0, vz: 0, vx: dx / d * 12, vy: dy / d * 12, porteur: null, passeDe: passeur.id, passeVers: recoit.id, dernier: { equipe: 'A', id: passeur.id, t: e.t, x: dep.x, lance: false } });
    let pas = [];
    for (let t = 0; t < 1.5; t += DT) { pas = avancer(e, {}, DT); if (pas.some(x => x.type === 'prise')) break; }
    const prise = pas.find(x => x.type === 'prise'), tir = pas.find(x => x.type === 'tir');
    return { prise, tir, recoit };
  };
  const pres = scene(7), dehors = scene(16);
  exiger(`la passe des siens dans l'enclave (à ${UNE_TEMPS.loin} m du filet au plus) : l'IA la lance sur réception`, !!pres.prise && pres.prise.qui === pres.recoit.id && !!pres.tir && pres.tir.uneTemps && pres.tir.qui === pres.recoit.id, pres.prise ? (pres.tir ? `tir à ${Math.round(pres.tir.v * 3.6)} km/h` : 'reçue, pas de tir') : 'pas reçue');
  exiger('… et loin du filet, elle la reçoit', !!dehors.prise && dehors.prise.qui === dehors.recoit.id && !dehors.tir, dehors.prise ? (dehors.tir ? 'un tir' : 'reçue') : 'pas reçue');
}

/* ---------- la mise en jeu : le placement de la LNH (JP, 2 nov. : *les défenseurs sont pas dans la zone à la mise au jeu*) ---------- */
/* Une mise en jeu au point dit : le sifflet tout juste fini, tout le monde placé, la rondelle pas encore tombée. */
const auPoint = (graine, point, humain = null, clubs = {}) => {
  const e = nouveauMatch({ graine, A: clubs.A || club('AAA', 100), B: clubs.B || club('BBB', 200), periode: 120, humain, ia: decisionIA });
  jouer(e, {}, 0.6);
  e.mej = null; e.enJeu = false; e.arret = { genre: 'essai', reste: 1e-6, point };
  avancer(e, {}, 1 / 120);
  return e;
};
{
  const POINTS = [
    ['le centre', { x: 0, y: 0 }, true],
    ['la zone de B, à droite', { x: POINT.x, y: POINT.y }, true], ['la zone de B, à gauche', { x: POINT.x, y: -POINT.y }, true],
    ['la zone de A, à droite', { x: -POINT.x, y: POINT.y }, true], ['la zone de A, à gauche', { x: -POINT.x, y: -POINT.y }, true],
    ['la neutre, près de B', { x: POINT.neutre, y: POINT.y }, false], ['la neutre, près de A', { x: -POINT.neutre, y: -POINT.y }, false],
  ];
  const fautes = { centres: [], cercle: [], horsjeu: [], zone: [], deca: [], traits: [] };
  for (const [nom, P, cercle] of POINTS) {
    const e = auPoint(`placement-${nom}`, P);
    for (const eq of ['A', 'B']) {
      const s = e.equipes[eq].attaque, sur = surGlace(e, eq), c = sur.find(p => p.id === e.mej.centres[eq]);
      if (!c || Math.abs(Math.hypot(c.x - P.x, c.y - P.y) - MEJ.face) > 0.01 || (P.x - c.x) * s <= 0) fautes.centres.push(`${nom} ${eq}`);
      for (const p of sur) {
        const d = Math.hypot(p.x - P.x, p.y - P.y);
        if (p !== c && cercle && d < POINT.r) fautes.cercle.push(`${nom} ${eq} ${p.poste} à ${d.toFixed(2)} m`);
        // le hors-jeu : jamais dans sa zone d'attaque si le point n'y est pas ; au centre, chacun dans sa moitié
        const zoneAttaque = P.x * s > BLEUE;
        if ((!zoneAttaque && p.x * s > BLEUE) || (Math.abs(P.x) < 0.5 && p.x * s > 0)) fautes.horsjeu.push(`${nom} ${eq} ${p.poste}`);
        if (p.poste === 'D' && Math.abs(P.x) > BLEUE && !(p.x * Math.sign(P.x) > BLEUE)) fautes.zone.push(`${nom} ${eq} D à x ${p.x.toFixed(1)}`);
        if (p.poste === 'D' && !(p.x * s < c.x * s)) fautes.deca.push(`${nom} ${eq}`);
        if ((p.poste === 'AG' || p.poste === 'AD') && cercle && Math.abs(Math.abs(p.y - P.y) - (POINT.r + MEJ.horsCercle)) > 0.01) fautes.traits.push(`${nom} ${eq} ${p.poste}`);
      }
    }
  }
  exiger('à la mise en jeu, les deux centres face à face au point, chacun de son côté', !fautes.centres.length, fautes.centres.join(', ') || `${POINTS.length} points, à ${MEJ.face} m du point`);
  exiger('… personne d\'autre dans le cercle', !fautes.cercle.length, fautes.cercle.join(', ') || `rayon ${POINT.r.toFixed(2)} m`);
  exiger('… les ailiers sur les traits du cercle', !fautes.traits.length, fautes.traits.join(', ') || 'au rayon, de part et d\'autre');
  exiger('… personne hors-jeu (sa zone d\'attaque seulement si le point y est ; au centre, sa moitié)', !fautes.horsjeu.length, fautes.horsjeu.join(', ') || 'aucun');
  exiger('… dans une zone, les quatre défenseurs dedans — ceux de l\'attaque à la bleue', !fautes.zone.length, fautes.zone.join(', ') || `${MEJ.bleue} m en dedans de la bleue`);
  exiger('… et chaque défenseur en deçà de son centre', !fautes.deca.length, fautes.deca.join(', ') || 'partout');
}

/* ---------- la mise en jeu : un duel (JP, 2 nov. : *l'absence de mécanique de mise au jeu*) ---------- */
/*
 * Toi au centre de A, contre l'IA : la rondelle tombe `MEJ.chute` s après le placement ; `appui` : quand tu presses,
 * en s par rapport à la chute (null : jamais) ; `baton` : où tu le tiens. Rend la mise en jeu et la première prise.
 */
const duel = (graine, point, appui, baton, clubs) => {
  const e = auPoint(graine, point, 'A', clubs);
  const c = e.mej.centres.A;
  let mej = null, prise = null;
  for (let k = 0; k < 120 * 4 && !prise; k++) {
    const t = e.mej ? MEJ.chute - e.mej.reste : 9;
    const ev = avancer(e, { [c]: { x: baton.x, y: baton.y, passe: appui != null && t >= MEJ.chute + appui - 1e-9 } }, 1 / 120);
    for (const v of ev) { if (v.type === 'mej') mej = v; else if (v.type === 'prise' && mej && !prise) prise = e.patineurs.find(p => p.id === v.qui); }
  }
  return { e, mej, prise };
};
{
  const N = 60, DZ = { x: -POINT.x, y: -POINT.y };   // ta zone, à gauche : la bande est du côté des −y
  const serie = (appui, baton, point = DZ, clubs) => Array.from({ length: N }, (_, k) => duel(`duel-${k}`, point, appui, baton, clubs));
  const derriere = serie(0, { x: -1, y: 0 }), cote = serie(0, { x: 0, y: -1 }), sans = serie(null, { x: -1, y: 0 });
  const gagne = r => r.mej && r.mej.equipe === 'A' && !r.mej.libre;
  const part = (l, f) => l.filter(f).length / Math.max(1, l.length);
  borne('la mise en jeu : le bouton à la chute pile, tu gagnes la plupart', part(derriere, gagne), 0.6, 0.95);
  borne('… sans le bouton, beaucoup moins (le Jeu et le dé seuls contre l\'IA qui presse)', part(derriere, gagne) - part(sans, gagne), 0.25, 0.9, ' de moins');
  const auD = derriere.filter(gagne);
  borne('… gagnée le bâton vers l\'arrière, elle va à ton défenseur', part(auD, r => r.prise && r.prise.equipe === 'A' && r.prise.poste === 'D'), 0.8, 1);
  const auAilier = cote.filter(gagne);
  borne('… le bâton vers la bande, à ton ailier de ce côté', part(auAilier, r => r.prise && r.prise.equipe === 'A' && r.prise.poste === 'AG'), 0.7, 1);
  const tous = [...derriere, ...cote, ...sans];
  borne('… serrée, la rondelle reste libre au point : une petite bataille', part(tous, r => r.mej && r.mej.libre), 0.03, 0.3);
  // Le Jeu : deux IA, le centre de A à 18, celui de B à 4 (le reste égal).
  const fort = (tag, k0, jeu) => { const cl = club(tag, k0); cl.patineurs = cl.patineurs.map(j => (j.poste === 'C' ? { ...j, p: parametresDuPatineur({ cote: 10, jeu }) } : j)); return cl; };
  let gA = 0, nettes = 0, appuisIA = 0, mises = 0;
  for (let k = 0; k < N; k++) {
    const e = auPoint(`jeu-${k}`, { x: 0, y: 0 }, null, { A: fort('AAA', 100, 18), B: fort('BBB', 200, 4) });
    for (let i = 0; i < 240; i++) for (const v of avancer(e, {}, 1 / 120)) if (v.type === 'mej') { mises++; if (v.timing.A != null && v.timing.B != null) appuisIA++; if (!v.libre) { nettes++; if (v.equipe === 'A') gA++; } }
  }
  borne('… le Jeu du centre pèse : un 18 bat un 4', gA / Math.max(1, nettes), 0.6, 0.9);
  exiger('… et l\'IA joue la même mise en jeu : elle presse le bouton, à son moment', appuisIA === mises && mises === N, `${appuisIA} appuis sur ${mises} mises en jeu`);
}

/* ---------- l'IA : le positionnement (JP, 2 nov. : *le positionnement des joueurs*) ---------- */
{
  // UNE PASSE EN ROUTE : les coéquipiers du receveur prennent leur poste, ils ne foncent pas tous sur la rondelle.
  const e = nouveauMatch({ graine: 'en-route', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
  jouer(e, {}, 0.6); e.mej = null; e.enJeu = true;
  const A = surGlace(e, 'A'), B = surGlace(e, 'B');
  for (const s of B) Object.assign(s, { x: -18, y: 10, vx: 0, vy: 0 });
  const [passeur, receveur, voisin, ...autres] = A;
  autres.forEach((s, i) => Object.assign(s, { x: -16, y: -8 + i * 4, vx: 0, vy: 0 }));
  Object.assign(passeur, { x: -4, y: -5, vx: 0, vy: 0 }); Object.assign(receveur, { x: 8, y: -5, vx: 0, vy: 0 }); Object.assign(voisin, { x: 3, y: -1.5, vx: 0, vy: 0 });
  Object.assign(e.rondelle, { x: 1, y: -5, vx: 14, vy: 0, z: 0, vz: 0, porteur: null, passeDe: passeur.id, passeVers: receveur.id, dernier: { equipe: 'A', id: passeur.id, t: e.t, x: 1, lance: false } });
  const d = decisionIA(e, voisin);
  // le couloir de la passe est à y = −5, sous lui : y foncer, c'est pousser le bâton vers les −y
  exiger('une passe des siens en route : le coéquipier près du chemin ne fonce pas sur la rondelle, il prend son poste', d.y > -0.3, `${d.y.toFixed(2)} de son bâton vers le couloir de la passe`);
}
{
  // LE HORS-JEU, sans la rondelle : elle vient de sortir de leur zone, l'avant de A qui y traîne en ressort.
  const e = nouveauMatch({ graine: 'remise-en-jeu', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
  jouer(e, {}, 0.6); e.mej = null; e.enJeu = true;
  const A = surGlace(e, 'A'), B = surGlace(e, 'B');
  const ailier = A.find(s => s.poste === 'AG'), chasseur = A.find(s => s.poste === 'C'), porteurB = B[0];
  for (const s of [...A, ...B]) if (s !== ailier && s !== porteurB) Object.assign(s, { x: -16, y: 10, vx: 0, vy: 0 });
  Object.assign(chasseur, { x: BLEUE - 3.5, y: -2 });   // le centre chasse le porteur ; l'ailier, lui, marque
  B[1].x = BLEUE + 8; B[1].y = 4;   // un adversaire au fond de la zone, que l'ailier marquerait
  Object.assign(ailier, { x: BLEUE + 3, y: 4, vx: 0, vy: 0, cap: 0 });
  Object.assign(porteurB, { x: BLEUE - 1.5, y: -2, vx: -3, vy: 0, cap: Math.PI });
  Object.assign(e.rondelle, { x: BLEUE - 2.5, y: -2, vx: -3, vy: 0, porteur: porteurB.id });
  const d = decisionIA(e, ailier);
  exiger('la rondelle sortie de leur zone : l\'avant qui y traîne en ressort, pour ne pas être hors-jeu', d.x < -0.3, `${d.x.toFixed(2)} vers sa bleue`);
}
{
  // … et le porteur qui la reprend juste hors de la zone, un coéquipier encore dedans, ressort avec elle.
  const e = nouveauMatch({ graine: 'ressort', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
  jouer(e, {}, 0.6); e.mej = null; e.enJeu = true;
  const A = surGlace(e, 'A'), B = surGlace(e, 'B');
  const porteur = A[0], dedans = A[1];
  for (const s of [...A, ...B]) if (s !== porteur && s !== dedans) Object.assign(s, { x: -18, y: s.equipe === 'A' ? -10 : 10, vx: 0, vy: 0 });
  Object.assign(dedans, { x: BLEUE + 4, y: 6, vx: 0, vy: 0 });
  Object.assign(porteur, { x: BLEUE + 0.4, y: -4, vx: 0, vy: 0, cap: Math.PI });
  Object.assign(e.rondelle, { x: BLEUE - 0.6, y: -4, vx: 0, vy: 0, porteur: porteur.id });
  const d = decisionIA(e, porteur);
  exiger('… le porteur qui la reprend à la bleue, un coéquipier dedans, ressort avec elle au lieu d\'y rentrer', d.x < 0 && !d.tir, `${d.x.toFixed(2)} vers sa bleue${d.passe ? ', une passe' : ''}`);
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
  jouer(e, {}, 4 + MATCH.pauses.but - 2.5);   // la pause du but (allongée de la célébration au lot 5), la mise en jeu
  // Remis en plein jeu, il attend qu'un patineur sorte par la porte du banc (le lot 3 : il revenait avec les six sur la glace).
  const GdB = e.gardiens.find(g => g.equipe === 'B');
  retirerGardien(e, 'B', false);
  const attend = e.enJeu && GdB.retire && GdB.retour && surGlace(e, 'B').length === 6;
  exiger('… remis en plein jeu, il attend qu\'un patineur sorte par la porte du banc : jamais six patineurs et lui', attend, `${surGlace(e, 'B').length} B, ${GdB.retire ? 'le filet désert' : 'au filet'}`);
  for (let t = 0; t < 40 && GdB.retire && !e.mej; t += DT) avancer(e, {}, DT);
  exiger('… à l\'arrêt de jeu, le gardien remis revient dans son filet', !GdB.retire && droitSurGlace(e, 'B') === 5 && surGlace(e, 'B').length <= 5, `${surGlace(e, 'B').length} B`);
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
  for (let g = 0; g < 40 && !(e && e.match.prolongation && !e.match.penalites.length && !e.match.enAttente); g++) {
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

/* ---------- le lot 2 (2 nov. 2026) : que ça joue comme du hockey, pas comme dix joueurs qui courent ---------- */
/* Une glace de match mise en scène : le coup d'envoi placé, puis tout le monde loin, A attaque vers les +x. */
const enScene = (graine, humain = null, bx = 15) => {
  const e = nouveauMatch({ graine, A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain, ia: decisionIA });
  jouer(e, {}, 0.6); e.mej = null; e.enJeu = true;
  for (const s of surGlace(e, 'A')) Object.assign(s, { x: -15, y: -8 + surGlace(e, 'A').indexOf(s) * 3, vx: 0, vy: 0, cap: 0 });
  for (const s of surGlace(e, 'B')) Object.assign(s, { x: bx, y: -8 + surGlace(e, 'B').indexOf(s) * 3, vx: 0, vy: 0, cap: Math.PI });
  return e;
};
const ailierDe = (e, eq) => surGlace(e, eq).filter(s => s.poste === 'AG' || s.poste === 'AD');
{
  // LE HORS-JEU DES MÊLÉES (mesuré : 4,3 à 5,9 par match de 6 min, l'IA contre l'IA). Le bras levé, la rondelle passe à la
  // lame d'un attaquant resté dans la zone, à côté de son corps : s'il ne la vise pas, il ne la prend pas ; s'il la vise, il
  // la prend, et c'est le sifflet.
  const essai = vise => {
    const e = enScene(`vise-${vise}`, null, -18);
    const A = surGlace(e, 'A'), fautif = A[1], passeur = A[0];
    Object.assign(fautif, { x: BLEUE + 6, y: -6, cap: Math.PI, lachee: 0 });
    Object.assign(passeur, { x: BLEUE - 5, y: -5.1, cap: 0 });
    Object.assign(e.rondelle, { x: BLEUE - 2.2, y: -5.1, vx: 14, vy: 0, z: 0, vz: 0, porteur: null, dernier: { equipe: 'A', id: passeur.id, t: e.t, x: BLEUE - 2.2, lance: true } });
    return jouer(e, { [fautif.id]: vise ? { x: -1, y: 0.5 } : { x: 0, y: 0 } }, 1.2);
  };
  const sans = essai(false), avec = essai(true);
  exiger('le bras levé, un attaquant dans la zone ne prend pas la rondelle qui passe à sa lame s\'il ne la vise pas', sans.some(x => x.type === 'horsjeuDiffere') && !sans.some(x => x.type === 'horsjeu') && !sans.some(x => x.type === 'prise'), sans.filter(x => x.type !== 'bande').map(x => x.type).join(' ') || 'rien');
  exiger('… et la prend s\'il la vise : le sifflet', avec.some(x => x.type === 'horsjeu' && x.genre === 'touche'), avec.filter(x => x.type !== 'bande').map(x => x.type).join(' ') || 'rien');
  // La rondelle hors de la zone, sa lame dedans, un coéquipier dedans : la prendre la ramènerait dans la zone, il ne la prend pas.
  const ramene = dedans => {
    const e = enScene(`ramene-${dedans}`);
    const A = surGlace(e, 'A'), d = A.find(s => s.poste === 'D'), autre = A.find(s => s.poste !== 'D');
    Object.assign(d, { x: BLEUE - 0.5, y: 3, cap: 0 });
    Object.assign(autre, { x: dedans ? BLEUE + 6 : BLEUE - 8, y: -6 });
    Object.assign(e.rondelle, { x: BLEUE - 0.25, y: 3.4, vx: 0, vy: 0, z: 0, vz: 0, porteur: null, dernier: { equipe: 'B', id: surGlace(e, 'B')[0].id, t: e.t, x: BLEUE, lance: false } });
    return { ev: jouer(e, { [d.id]: { x: 0, y: 0 } }, 0.3), d, e };
  };
  const r1 = ramene(true), r2 = ramene(false);
  exiger('la rondelle hors de la zone, un coéquipier dedans : la lame encore dans la zone ne la ramène pas', !r1.ev.some(x => x.type === 'prise') && !r1.ev.some(x => x.type === 'horsjeu'), r1.ev.map(x => x.type).join(' ') || 'rien');
  exiger('… personne dedans, la même lame la prend', r2.e.rondelle.porteur === r2.d.id && !r2.ev.some(x => x.type === 'horsjeu'), r2.ev.map(x => x.type).join(' ') || 'rien');
  // L'IA, le bras levé : celui qui est dehors attend à la bleue hors de portée (il « tague » la bleue), personne ne siffle.
  const e = enScene('tague', null, -18);
  const A = surGlace(e, 'A'), dehors = A[0], dedans = A[1];
  Object.assign(dehors, { x: BLEUE - 1.2, y: 0.5, cap: 0 }); Object.assign(dedans, { x: BLEUE + 11, y: 8, cap: Math.PI });
  Object.assign(e.rondelle, { x: BLEUE + 1.8, y: 0, vx: 0, vy: 0, z: 0, vz: 0, porteur: null, dernier: { equipe: 'A', id: dedans.id, t: e.t - 1, x: BLEUE - 1, lance: true } });
  e.match.horsJeuDiffere = 'A';
  const evT = jouer(e, {}, 1.2);
  borne('… et l\'IA, le bras levé, attend dehors hors de portée de la rondelle (elle « tague » la bleue)', BLEUE - dehors.x, BATON.lame[0] + PATIN.portee, 6, ' m de la bleue');
  exiger('… sans toucher la rondelle', !evT.some(x => x.type === 'horsjeu'), evT.filter(x => x.type !== 'bande').map(x => x.type).join(' ') || 'rien');
}
{
  // HORS DE LA ZONE, le tir part où pointe le bâton (le lancer au fond) ; dans la zone, la visée assistée le ramène au filet.
  const ou = x0 => {
    const g = glaceVide('fond');
    g.gardien.x = LIGNE_BUT + 4; g.gardien.y = 10;
    Object.assign(g.patineurs[0], { x: x0, y: 0, cap: 0.45 });
    const lm = lame(g.patineurs[0]);
    Object.assign(g.rondelle, { x: lm.x, y: lm.y });
    avancer(g, { toi: { x: 0, y: 0 } }, DT);
    avancer(g, { toi: { x: 0, y: 0, tir: true } }, DT);
    const ev = avancer(g, { toi: { x: Math.cos(0.45), y: Math.sin(0.45), tir: false } }, DT);
    return { ang: Math.atan2(g.rondelle.vy, g.rondelle.vx), fond: (ev.find(x => x.type === 'tir') || {}).fond };
  };
  const neutre = ou(1), zone = ou(LIGNE_BUT - 9);
  exiger('de la zone neutre, le tir part où pointe le bâton : le lancer au fond, pas un tir au but', Math.abs(neutre.ang - 0.45) < 0.12 && neutre.fond === true, `${neutre.ang.toFixed(2)} rad (le bâton à 0,45)`);
  exiger('… de la zone, le même bâton, le tir va au filet', Math.abs(zone.ang - 0.45) > 0.2 && zone.fond === false, `${zone.ang.toFixed(2)} rad`);
}
{
  // LA SORTIE DE ZONE : le défenseur derrière son filet, libre, attend que les siens se placent, puis passe à un avant.
  const e = enScene('sortie');
  const A = surGlace(e, 'A'), d = A.find(s => s.poste === 'D');
  Object.assign(d, { x: -(LIGNE_BUT + 2), y: 0.4, cap: Math.PI / 2 });
  const lm = lame(d); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: d.id });
  let passe = null, prise = null;
  for (let t = 0; t < 4 && !prise; t += DT) for (const x of avancer(e, {}, DT)) { if (x.type === 'passe' && x.qui === d.id && !passe) passe = { ...x, t }; if (x.type === 'prise' && passe && !prise) prise = x; }
  const recu = prise && e.patineurs.find(s => s.id === prise.qui);
  exiger('la sortie de zone : le défenseur libre derrière son filet attend que les siens se placent', !!passe && passe.t >= SORTIE.attente - 0.05, passe ? `il passe après ${passe.t.toFixed(2)} s` : 'aucune passe');
  exiger('… puis passe à un avant, qui la reçoit', !!recu && recu.equipe === 'A' && recu.poste !== 'D', recu ? `${recu.poste} à (${recu.x.toFixed(1)}, ${recu.y.toFixed(1)})` : 'personne');
  // Pressé dans son coin, personne d'ouvert : il la dégage le long de la bande, vers son ailier même couvert.
  const e2 = enScene('degage');
  const A2 = surGlace(e2, 'A'), B2 = surGlace(e2, 'B'), d2 = A2.find(s => s.poste === 'D'), ail = ailierDe(e2, 'A').find(s => s.poste === 'AG');
  Object.assign(d2, { x: -(LIGNE_BUT - 1), y: -9, cap: Math.PI });
  const lm2 = lame(d2); Object.assign(e2.rondelle, { x: lm2.x, y: lm2.y, vx: 0, vy: 0, porteur: d2.id });
  Object.assign(B2[0], { x: d2.x - 1.3, y: -8.6, cap: 0 });
  Object.assign(ail, { x: -(BLEUE + 3), y: -11 }); Object.assign(B2[1], { x: -(BLEUE + 3.8), y: -10.6 });
  for (const s of A2) if (s !== d2 && s !== ail) Object.assign(s, { x: 5, y: s.y });
  const dec = decisionIA(e2, d2);
  const versAilier = Math.atan2(ail.y - d2.y, ail.x - d2.x), angle = Math.atan2(dec.y, dec.x);
  exiger('… pressé dans son coin, personne d\'ouvert : il la dégage le long de la bande, vers son ailier couvert', !!dec.passe && Math.abs(angle - versAilier) < 0.05, `${dec.passe ? 'une passe' : 'pas de passe'}, ${angle.toFixed(2)} rad (l'ailier à ${versAilier.toFixed(2)})`);
}
{
  // LE LANCER AU FOND : la bleue bouchée par leurs deux défenseurs, personne des siens dedans : au fond, puis la course.
  // La scène juge la RÈGLE, pas le dé : `FOND.part` (le lancer au fond, une décision sur trois) est mis à 1 le temps de la
  // scène, sinon un autre générateur (V25 A2) la faisait réussir ou rater selon le tirage — une loterie, pas un test.
  const partAvant = FOND.part; FOND.part = 1;
  const e = enScene('fond', null, -18);
  const A = surGlace(e, 'A'), B = surGlace(e, 'B'), porteur = A.find(s => s.poste === 'C');
  Object.assign(porteur, { x: 2.5, y: -1, cap: 0, vx: 5 });
  const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 5, vy: 0, porteur: porteur.id });
  B.filter(s => s.poste === 'D').forEach((s, i) => Object.assign(s, { x: BLEUE + 0.5, y: i ? 4 : 1, cap: Math.PI }));
  for (const s of A) if (s !== porteur) Object.assign(s, { x: -1 - A.indexOf(s), y: s.y });
  let fond = null, profond = false, horsjeu = false;
  for (let t = 0; t < 3; t += DT) for (const x of avancer(e, {}, DT)) {
    if (x.type === 'tir' && x.qui === porteur.id && !fond) fond = x;
    if (fond && e.rondelle.x > LIGNE_BUT - 2) profond = true;
    if (x.type === 'horsjeu') horsjeu = true;
  }
  const chasseurs = A.filter(s => s.poste !== 'D' && s.x > BLEUE).length;
  exiger('le lancer au fond : la bleue bouchée, le porteur la lance dans le coin, pas au filet', !!fond && fond.fond && profond, fond ? `${Math.round(fond.v * 3.6)} km/h, ${profond ? 'au fond' : 'pas au fond'}` : 'aucun lancer');
  exiger('… et les siens courent après, sans hors-jeu', chasseurs >= 1 && !horsjeu, `${chasseurs} avant(s) dans la zone après 3 s${horsjeu ? ', hors-jeu' : ''}`);
  FOND.part = partAvant;
}
{
  // LE CYCLE : au coin, pressé, il la remonte le long de la bande au coéquipier qui l'attend en haut.
  const e = enScene('cycle', null, -18);
  const A = surGlace(e, 'A'), B = surGlace(e, 'B'), porteur = A.find(s => s.poste === 'AG'), haut = A.find(s => s.poste === 'C');
  Object.assign(porteur, { x: LIGNE_BUT - 2.8, y: -8.3, cap: 0 });
  const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: porteur.id });
  Object.assign(B[0], { x: LIGNE_BUT - 0.6, y: -6.4, cap: Math.PI });
  Object.assign(haut, { x: LIGNE_BUT - 8, y: -9.5 });
  for (const s of A) if (s !== porteur && s !== haut) Object.assign(s, { x: BLEUE + 2.5, y: 4 + A.indexOf(s) });
  const dec = decisionIA(e, porteur);
  const versHaut = Math.atan2(haut.y - porteur.y, haut.x - porteur.x), angle = Math.atan2(dec.y, dec.x);
  exiger('le cycle : au coin et pressé, il remonte la rondelle le long de la bande au coéquipier en haut', !!dec.passe && Math.abs(angle - versHaut) < 0.05, `${dec.passe ? 'une passe' : 'pas de passe'}, ${angle.toFixed(2)} rad (le coéquipier à ${versHaut.toFixed(2)})`);
}
{
  // L'ÉCRAN : le même tir, du même point, à la même vitesse ; un plot sur la ligne du gardien, à côté du chemin du tir.
  const taux = avecEcran => {
    const e = glaceVide('ecran');
    const plot = e.patineurs[1];
    let arrets = 0, buts = 0;
    for (let i = 0; i < 80; i++) {
      remise(e, 'but');
      const y0 = -3 + (i % 8) * 0.75, x0 = LIGNE_BUT - 10;
      const cible = { x: LIGNE_BUT, y: (i % 2 ? 1 : -1) * (0.65 + 0.05 * (i % 5)) };
      Object.assign(e.rondelle, { x: x0, y: y0, vx: 0, vy: 0, porteur: null });
      // le plot à 2 m devant le gardien, sur la ligne rondelle-gardien, décalé du côté opposé au tir (le tir passe à côté)
      const gx = LIGNE_BUT - GARDIEN.sortie, gdx = x0 - gx, gdy = y0, gd = Math.hypot(gdx, gdy), cote = cible.y > 0 ? 1 : -1;
      const px = gx + gdx / gd * 2 - gdy / gd * 0.62 * cote, py = gdy / gd * 2 + gdx / gd * 0.62 * cote;
      Object.assign(plot, avecEcran ? { x: px, y: py, cap: Math.atan2(gdx / gd * cote, -gdy / gd * cote), vx: 0, vy: 0, poste0: null } : { x: -(BOUT - 4.5), y: -10, poste0: null });
      jouer(e, {}, 0.5);
      const dx = cible.x - x0, dy = cible.y - y0, d = Math.hypot(dx, dy);
      Object.assign(e.rondelle, { x: x0, y: y0, vx: dx / d * 36, vy: dy / d * 36 });
      let fini = false;
      for (let t = 0; t < 1.5 && !fini; t += DT) for (const x of avancer(e, {}, DT)) { if (x.type === 'but') { buts++; fini = true; } if (x.type === 'arret') { arrets++; fini = true; } if (x.type === 'bloc' || x.type === 'deviation') fini = true; }
    }
    return { arrets, buts, part: arrets / Math.max(1, arrets + buts) };
  };
  const sans = taux(false), avec = taux(true);
  exiger('l\'écran : le même tir, du même point, à la même vitesse, est arrêté plus souvent sans écran qu\'avec', sans.part > avec.part + 0.08, `${(sans.part * 100).toFixed(0)} % d'arrêts sans écran (${sans.arrets} sur ${sans.arrets + sans.buts}), ${(avec.part * 100).toFixed(0)} % avec (${avec.arrets} sur ${avec.arrets + avec.buts}), le gardien ${Math.round(GARDIEN.ecran * 1000)} ms plus lent à voir`);
}
{
  // LA DÉVIATION : un tir qui frappe une lame devant le filet change de route.
  const route = avecBaton => {
    const e = glaceVide('devie');
    const plot = e.patineurs[1];
    e.gardien.x = LIGNE_BUT + 4; e.gardien.y = 10;
    // la lame du plot à 3 m du filet, juste sur le chemin du tir ; le corps à côté
    Object.assign(plot, avecBaton ? { x: LIGNE_BUT - 3, y: 1.0, cap: -Math.PI / 2, poste0: null } : { x: -(BOUT - 4.5), y: -10, poste0: null });
    Object.assign(e.rondelle, { x: LIGNE_BUT - 10, y: 0.05, vx: 28, vy: 0, z: 0, vz: 0, porteur: null, dernier: { equipe: 'A', id: 'toi', t: e.t, x: LIGNE_BUT - 10, lance: true, tir: true } });
    const ev = jouer(e, {}, 0.35);
    return { ang: Math.atan2(e.rondelle.vy, e.rondelle.vx), dev: ev.find(x => x.type === 'deviation') };
  };
  const droit = route(false), devie = route(true);
  exiger('la déviation : un tir qui frappe une lame devant le filet change de route', !!devie.dev && devie.dev.voulue === false && Math.abs(devie.ang - droit.ang) > 0.03, `${droit.ang.toFixed(3)} rad sans bâton, ${devie.ang.toFixed(3)} rad après la lame`);
}
{
  // L'IA AU FILET : le porteur à la pointe, un avant va se placer devant le gardien, sur la ligne du tir.
  const e = enScene('au-filet', 'A', -18);
  for (const s of surGlace(e, 'A')) Object.assign(s, { x: 2 });
  const A = surGlace(e, 'A'), porteur = A.find(s => s.poste === 'D');
  Object.assign(porteur, { x: BLEUE + 2.5, y: 6, cap: 0 });
  const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: porteur.id });
  e.controles.A = porteur.id;
  for (const s of surGlace(e, 'B')) Object.assign(s, { x: -18, y: s.y });
  jouer(e, { [porteur.id]: { x: 0, y: 0 } }, 3);
  const Gd = e.gardiens.find(g => g.equipe === 'B');
  const ligne = s => { const dx = e.rondelle.x - Gd.x, dy = e.rondelle.y - Gd.y, d = Math.hypot(dx, dy), t = ((s.x - Gd.x) * dx + (s.y - Gd.y) * dy) / d; return { t, ecart: Math.abs((s.x - Gd.x) * dy - (s.y - Gd.y) * dx) / d }; };
  const auFilet = A.filter(s => s !== porteur && s.poste !== 'D').map(s => ({ s, ...ligne(s) })).sort((p, q) => p.ecart - q.ecart)[0];
  exiger('l\'IA envoie un avant au filet, sur la ligne de la rondelle au gardien : l\'écran', auFilet.ecart < GARDIEN.ecranLarge + PATIN.rayon && auFilet.t > GARDIEN.ecranPres && auFilet.t < 3.5, `${auFilet.s.poste} à ${auFilet.t.toFixed(1)} m devant le gardien, ${auFilet.ecart.toFixed(2)} m de la ligne (le poste : ${ECRAN_D.distance} m)`);
}
{
  // LES MATCHS DE L'IA CONTRE L'IA, mesurés (GLACE_MATCHS, 6 par défaut ; 24 pour le rapport) : le hors-jeu, la passe, la
  // sortie de zone, l'enclave, les buts.
  const N = +(process.env.GLACE_MATCHS || 6);
  const S = { hj: 0, passes: 0, passesOk: 0, sortT: 0, sortOk: 0, oz: 0, ozFilet: 0, buts: 0, tirs: 0, fonds: 0, masques: 0, cycles: 0, trop: 0, revers: 0, volees: 0, punitions: 0, leves: 0, gants: 0, auBut: 0, ecarts: [], joue: 0, refuses: 0, obstrue: 0, contours: 0, rudesses: 0, doubles: 0 };
  for (let g = 0; g < N; g++) {
    const e = nouveauMatch({ graine: `serie-${g}`, A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: null, ia: decisionIA });
    let passe = null, sortie = null, k = 0;
    while (!e.match.fini && k < 120 * 60 * 20) {
      k++;
      for (const v of avancer(e, {}, DT)) {
        if (v.type === 'horsjeu') S.hj++;
        if (v.type === 'tir') { if (v.fond) S.fonds++; else { S.tirs++; if (v.ecran) S.masques++; } }
        if (v.type === 'passe') {
          S.passes++;
          const s = e.patineurs.find(p => p.id === v.qui), r = v.vers && e.patineurs.find(p => p.id === v.vers), a = e.equipes[s.equipe].attaque;
          passe = s.equipe;
          // le cycle : du coin, le long de la bande, au coéquipier qui attend en haut
          if (r && s.x * a > LIGNE_BUT - 6 && Math.abs(s.y) > 4.5 && Math.sign(r.y) === Math.sign(s.y) && Math.abs(r.y) > 5 && r.x * a < s.x * a - 2.5 && r.x * a > BLEUE) S.cycles++;
        }
        if (v.type === 'tir' && !v.fond && v.revers) S.revers++;
        if (v.type === 'volee') S.volees++;
        if (v.type === 'punition') S.punitions++;
        if (v.type === 'leve') S.leves++;
        if (v.type === 'gants') S.gants++;
        if (v.type === 'jeuDuGardien') S.joue++;
        if (v.type === 'butRefuse') S.refuses++;
        if (v.type === 'tir' && v.contour) S.contours++;
        if (v.type === 'rudesse') S.rudesses++;
        if (v.type === 'punition' && v.genre === 'double-échec') S.doubles++;
        if (v.type === 'obstrue') S.obstrue++;
        if (v.type === 'prise') {
          const s = e.patineurs.find(p => p.id === v.qui);
          if (passe) { if (s.equipe === passe) S.passesOk++; passe = null; }
          // une sortie : prise dans sa zone ; réussie si la rondelle en sort à elle et qu'elle la reprend dehors
          if (sortie && sortie.dehors) { if (s.equipe === sortie.eq) S.sortOk++; sortie = null; }
          else if (sortie && s.equipe !== sortie.eq) sortie = null;
          if (!sortie && e.rondelle.x * e.equipes[s.equipe].attaque < -BLEUE) { sortie = { eq: s.equipe, dehors: false }; S.sortT++; }
        }
        if (['horsjeu', 'degagement', 'gel', 'but', 'vitre', 'punition', 'periode'].includes(v.type) && sortie) { if (!sortie.dehors) S.sortT--; else if (v.type !== 'degagement') S.sortOk++; sortie = null; }
      }
      for (const eq of ['A', 'B']) if (surGlace(e, eq).length > MATCH.surglace + (e.gardiens.find(g => g.equipe === eq).retire ? 1 : 0)) S.trop++;
      if (!e.enJeu || e.mej || e.arret || e.match.ronde) continue;
      const R = e.rondelle;
      if (sortie && !sortie.dehors && R.x * e.equipes[sortie.eq].attaque > -BLEUE && R.dernier && R.dernier.equipe === sortie.eq) sortie.dehors = true;
      const porteur = R.porteur && e.patineurs.find(p => p.id === R.porteur);
      for (const eq of ['A', 'B']) {
        const a = e.equipes[eq].attaque;
        if (R.x * a > BLEUE && R.dernier && R.dernier.equipe === eq) {
          S.oz++;
          if (surGlace(e, eq).some(s => s !== porteur && s.x * a > LIGNE_BUT - 4.5 && s.x * a < LIGNE_BUT - 0.6 && Math.abs(s.y) < 2.5)) S.ozFilet++;
        }
      }
    }
    S.buts += e.match.pointage.A + e.match.pointage.B;
    // LE COMPTE DES TIRS (le lot 5) : pour chaque club, ses tirs au but = les arrêts du gardien d'en face + ses buts (hors tirs de barrage).
    for (const eq of ['A', 'B']) {
      const arrets = e.gardiens.find(x => x.equipe !== eq).arrets, buts = e.match.journal.filter(j => j.equipe === eq && !j.fusillade).length;
      S.auBut += e.match.tirs[eq];
      if (e.match.tirs[eq] !== arrets + buts) S.ecarts.push(`${g}${eq} : ${e.match.tirs[eq]} tirs, ${arrets} arrêts, ${buts} buts`);
    }
  }
  informer(`${N} matchs de l'IA contre l'IA (3 × 2 min)`, `${(S.buts / N).toFixed(1)} buts, ${(S.tirs / N).toFixed(0)} tirs (${(100 * S.masques / Math.max(1, S.tirs)).toFixed(0)} % masqués), ${(S.fonds / N).toFixed(0)} lancers au fond par match`);
  borne('le hors-jeu des mêlées : au plus un et demi par match de 6 min (4,3 à 5,9 avant)', S.hj / N, 0, 1.5, ' par match');
  borne('… et la passe réussit autant (64 % avant)', S.passesOk / Math.max(1, S.passes), 0.6, 0.8);
  borne('la sortie de zone réussie : la rondelle sortie et reprise dehors (13 à 15 % avant)', S.sortOk / Math.max(1, S.sortT), 0.22, 0.6);
  borne('en zone offensive, un joueur dans l\'enclave (19 à 25 % du temps avant)', S.ozFilet / Math.max(1, S.oz), 0.28, 0.8);
  borne('… et des buts, mais pas une pluie (5 par match au plus, environ)', S.buts / N, 2, 7, ' par match');
  borne('les punitions, au rythme de la LNH : ≈ 0,6 par club et par 6 min de jeu, donc vers 0,6 à 0,9 par match (1,9 après le lot 4)', S.punitions / N, 0.2, 1.5, ' par match');
  exiger('les tirs au but se comptent comme la LNH : pour chaque club, tirs = arrêts du gardien adverse + buts (2 tirs pour 1 but et 0 arrêt avant le lot 5)', S.ecarts.length === 0, S.ecarts.length ? S.ecarts.slice(0, 3).join(' ; ') : `${2 * N} clubs, ${(S.auBut / N).toFixed(0)} tirs au but par match (${(S.tirs / N).toFixed(0)} tentés de la zone)`);
  informer('… le gardien joue la rondelle derrière son filet (le lot 5)', `${S.joue} fois en ${N} matchs`);
  informer('… le double-échec et la rudesse après le sifflet', `${S.doubles} et ${S.rudesses} en ${N} matchs`);
  informer('… le contournement du filet, la lame au poteau', `${S.contours} tirs en ${N} matchs`);
  borne("… l'IA ne fonce pas dans le gardien : les buts refusés pour obstruction restent rares (la LNH : un sur dix matchs, environ)", S.refuses / N, 0, 0.35, ` par match (${S.obstrue} contacts dans l'enclave en ${N} matchs)`);
  borne("… et l'IA soulève le bâton du porteur, collée à lui", S.leves / N, 5, 60, ' par match');
  informer('… les bagarres (des clubs inventés, des défenseurs de Robustesse 14 : rares)', `${S.gants} en ${N} matchs`);
  informer('… les gestes du lot 3', `${(100 * S.revers / Math.max(1, S.tirs)).toFixed(0)} % des tirs du revers, ${(S.volees / N).toFixed(0)} changements à la volée par match`);
  borne('le cycle vit : la rondelle remontée du coin le long de la bande (1,0 à 1,4 par match avant)', S.cycles / N, 1.5, 12, ' par match');
  exiger('… et jamais un patineur de trop sur la glace (le gardien remis revenait avec six)', S.trop === 0, `${S.trop} images`);
}

/* ---------- le lot 3 (2 nov. 2026) : le porteur a des gestes, et on choisit ses lignes ---------- */
/* Toi, la rondelle à la lame, immobile au milieu de la glace d'entraînement, le cap dit ; le plot loin. */
const tonPorteur = (graine, cap, main = 'G') => {
  const e = glaceVide(graine);
  const [toi, plot] = e.patineurs;
  toi.p = parametresDuPatineur({ main }); toi.lat = toi.p.main * BATON.cote;
  Object.assign(toi, { x: 0, y: 0, vx: 0, vy: 0, cap });
  const lm = lame(toi); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: 'toi' });
  e.gardien.x = LIGNE_BUT + 4; e.gardien.y = 10;
  return { e, toi, plot };
};
/* Le plot, à (x, y), harponne la rondelle (son bâton pointé vers elle) ; `avant` : ce que toi fais d'abord. Réussi ? */
const harponDuPlot = (graine, cap, x, y, avant = null, regler = null) => {
  const { e, toi, plot } = tonPorteur(graine, cap);
  Object.assign(plot, { x, y, vx: 0, vy: 0, poste0: null });
  if (regler) regler(e, toi, plot);
  jouer(e, { toi: { x: 0, y: 0 }, plot: { x: 0, y: 0 } }, 0.3);   // la lame se place
  if (avant) avancer(e, { toi: avant, plot: { x: 0, y: 0 } }, DT);
  plot.cap = Math.atan2(e.rondelle.y - plot.y, e.rondelle.x - plot.x);
  const protege = toi.protege, lat = toi.lat;
  const ev = [...avancer(e, { toi: { x: 0, y: 0 }, plot: { x: 0, y: 0, tir: true } }, DT), ...jouer(e, { toi: { x: 0, y: 0 }, plot: { x: 0, y: 0 } }, 0.3)];
  return { ok: ev.some(x => x.type === 'harpon' && x.qui === 'plot'), mordu: ev.some(x => x.type === 'mordu'), lue: ev.some(x => x.type === 'feinteLue'), protege, lat, toi, e };
};
{
  // PROTÉGER : le même harpon, du même mètre et demi, dans ton dos (ton corps entre lui et la rondelle) ou de face.
  const N = 60;
  let dos = 0, face = 0, protege = 0, cache = 0;
  for (let i = 0; i < N; i++) {
    const a = harponDuPlot(`protege-dos-${i}`, 0, -1.3, 0.3), b = harponDuPlot(`protege-face-${i}`, Math.PI, -1.3, 0.3);
    if (a.ok) dos++; if (b.ok) face++;
    if (a.protege) protege++;
    // la lame de l'autre côté du corps : la rondelle à l'opposé du plot, en travers du cap
    if (Math.sign(a.lat) === -Math.sign(0.3) && Math.abs(a.lat) > 0.9 * PROTEGE.cote) cache++;
  }
  exiger('protéger la rondelle : lent, un adversaire collé, le porteur passe sa lame de l\'autre côté de son corps, de lui-même', protege === N && cache === N, `${protege} fois sur ${N} il protège, la lame à ${PROTEGE.cote} m de l'autre côté`);
  exiger('… et le harpon qui doit passer par son corps réussit moins (le dos tourné au poursuivant) que de face', dos / N < 0.6 * face / N && face / N > 0.3, `${dos} harpons réussis sur ${N} dans son dos, ${face} sur ${N} de face (× ${PROTEGE.harpon})`);
}
{
  // L'IA PROTÈGE DANS LE COIN : pressé, sans passe, elle tourne le dos au poursuivant et file lentement le long de la bande.
  const e = enScene('coin', null, -18);
  const A = surGlace(e, 'A'), B = surGlace(e, 'B'), porteur = A.find(s => s.poste === 'AD');
  Object.assign(porteur, { x: LIGNE_BUT - 2.5, y: 9, cap: 0, vx: 0, vy: 0 });
  const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: porteur.id });
  Object.assign(B[0], { x: LIGNE_BUT - 4, y: 8, cap: 0, vx: 0, vy: 0 });
  for (const s of A) if (s !== porteur) Object.assign(s, { x: -2, y: -6 + A.indexOf(s) });
  const dec = decisionIA(e, porteur);
  const loin = (dec.x * (porteur.x - B[0].x) + dec.y * (porteur.y - B[0].y)) > 0;
  let protegees = 0, images = 0, v = 0;
  for (let t = 0; t < 0.5; t += DT) { avancer(e, { [B[0].id]: { x: 0, y: 0 } }, DT); images++; if (porteur.protege) protegees++; if (Math.hypot(porteur.x - B[0].x, porteur.y - B[0].y) < 3) v = Math.max(v, Math.hypot(porteur.vx, porteur.vy)); }
  exiger('l\'IA protège dans le coin : pressée, sans passe, elle file lentement, dos au poursuivant, la lame cachée', loin && Math.hypot(dec.x, dec.y) < 0.5 && e.rondelle.porteur === porteur.id && protegees >= images / 2 && v < PROTEGE.vitesse, `le bâton à ${Math.hypot(dec.x, dec.y).toFixed(2)}, ${loin ? 'loin de lui' : 'vers lui'}, au plus ${(v * 3.6).toFixed(0)} km/h pressée, elle protège ${protegees} images sur ${images}`);
}
{
  // LA FEINTE : le même harpon, de face, lancé pendant la feinte (Y) ou sans elle, par un défenseur faible (Défense 6 sur
  // 20) ou fort (18) ; puis la feinte répétée, 1,5 s après la précédente, devant un défenseur ordinaire (10).
  const N = 60;
  const defenseur = (def, deja = false) => (e, toi, plot) => { plot.p = parametresDuPatineur({ defense: def }); if (deja) toi.feinteT = e.t - 1.5; };
  const essais = (nom, def, deja, feinte = true) => {
    let ok = 0, mordus = 0, lues = 0;
    for (let i = 0; i < N; i++) {
      const r = harponDuPlot(`${nom}-${i}`, Math.PI, -1.4, 0.2, feinte ? { x: 0, y: 0, feinte: true } : null, defenseur(def, deja));
      if (r.ok) ok++; if (r.mordu) mordus++;
      if (r.lue) lues++;
    }
    return { ok, mordus, lues, passe: N - ok };
  };
  const faible = essais('feinte-faible', 6, false), fort = essais('feinte-forte', 18, false), sansF = essais('feinte-sans', 18, false, false);
  const unique = essais('feinte-une', 10, false), repetee = essais('feinte-repetee', 10, true);
  let ecart = 0;
  { const { e, toi } = tonPorteur('feinte-lame', 0); const lat0 = toi.lat; jouer(e, { toi: { x: 0, y: 0, feinte: true } }, 0.15); ecart = Math.abs(toi.lat - lat0); }
  exiger('la feinte (Y) déporte la lame d\'un mètre, un instant', ecart > 0.8 * FEINTE.ecart && ecart <= FEINTE.ecart + 0.01, `${ecart.toFixed(2)} m en 0,15 s (${FEINTE.ecart} m, ${FEINTE.duree} s)`);
  exiger('… un harpon lancé pendant la feinte rate : un défenseur faible (Défense 6) mord toujours', faible.ok === 0 && faible.mordus === N, `la feinte passe ${faible.passe} fois sur ${N} (${faible.mordus} ont mordu)`);
  exiger('… un défenseur fort (Défense 18) la lit parfois, et son harpon se joue alors comme sans feinte', fort.lues > N * 0.2 && fort.lues < N * 0.6 && fort.ok > 0 && fort.passe > N / 2 && sansF.ok > fort.ok,
    `il la lit ${fort.lues} fois sur ${N} (${Math.round(FEINTE.lit * (18 - FEINTE.aveugle) * 100)} % attendus) ; la feinte passe ${fort.passe} fois sur ${N}, son harpon sans feinte réussit ${sansF.ok} fois sur ${N}`);
  exiger('… et la feinte répétée trop vite se lit mieux', repetee.lues > unique.lues + N * 0.15 && repetee.passe < unique.passe,
    `Défense 10 : lue ${unique.lues} fois sur ${N} la première, ${repetee.lues} répétée en moins de ${FEINTE.usee} s ; elle passe ${unique.passe}, puis ${repetee.passe}`);
  // La charge lancée pendant la feinte : le plot fonce sur toi, l'élan pressé, à 9 m/s.
  const charge = feinte => {
    const { e, toi, plot } = tonPorteur(`charge-${feinte}`, 0);
    plot.p = parametresDuPatineur({ defense: 6 });   // un défenseur faible : il mord toujours
    Object.assign(plot, { x: -3, y: 0, vx: 9, vy: 0, cap: 0, poste0: null });
    if (feinte) avancer(e, { toi: { x: 0, y: 0, feinte: true } }, DT);
    const ev = jouer(e, { toi: { x: 0, y: 0 }, plot: { x: 1, y: 0, echec: true } }, 0.4);
    return { tombe: toi.auSol > 0, contact: ev.some(x => x.type === 'echec') };
  };
  const cs = charge(false), ca = charge(true);
  exiger('… une mise en échec lancée pendant la feinte ne le renverse pas (sans elle, il tombe)', cs.tombe && !ca.tombe && ca.contact, `sans la feinte, ${cs.tombe ? 'il tombe' : 'il reste debout'} ; avec, ${ca.tombe ? 'il tombe' : 'il reste debout'}${ca.contact ? ' (le contact a eu lieu)' : ''}`);
  // L'IA feinte parfois devant un défenseur seul.
  const e = enScene('feinte-ia', null, 18);
  const A = surGlace(e, 'A'), B = surGlace(e, 'B'), porteur = A.find(s => s.poste === 'C');
  Object.assign(porteur, { x: 4, y: 0, cap: 0, vx: 6, vy: 0 });
  const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 6, vy: 0, porteur: porteur.id });
  Object.assign(B[0], { x: 6.7, y: 0.3, cap: Math.PI });
  for (const s of A) if (s !== porteur) Object.assign(s, { x: -20, y: s.y });
  let n = 0;
  for (let k = 0; k < 60; k++) { porteur.memo = {}; if (decisionIA(e, porteur).feinte) n++; }
  exiger('… et l\'IA feinte parfois devant un défenseur seul', n > 0 && n < 30, `${n} décisions sur 60`);
}
{
  // LE STYLE D'UN VRAI CLUB (le lot 6), lu dans les joueurs de sa saison : trois clubs de dix patineurs et un gardien,
  // pareils sauf un trait — LAN lance 30 % de plus, FRA frappe 30 % de plus, TIE reçoit 15 % de tirs de moins.
  const saison = [];
  for (const [t, sh, ht, sa] of [['LAN', 130, 2, 2000], ['FRA', 100, 2.6, 2000], ['TIE', 100, 2, 1700], ['MOY', 100, 2, 2000], ['AUT', 100, 2, 2000]]) {
    for (let i = 0; i < 10; i++) saison.push({ t, p: i < 6 ? 'F' : 'D', gp: 60, sh, ht, pim: 30 });
    saison.push({ t, p: 'G', gp: 60, sa });
  }
  const sLan = styleDuClub('LAN', saison), sFra = styleDuClub('FRA', saison), sTie = styleDuClub('TIE', saison), sMoy = styleDuClub('MOY', saison);
  exiger('le style d\'un vrai club se lit dans ses vraies stats : qui lance, qui frappe, qui tient sa zone', sLan.tir > 0.15 && sLan.strategie === 'offensive' && sFra.frappe > 0.15 && sFra.tir < 0 && sTie.contre < -0.07 && sTie.strategie === 'defensive' && sMoy.mots.length === 0 && sMoy.strategie === 'equilibree',
    `LAN : tirs +${Math.round(sLan.tir * 100)} %, ${sLan.strategie} (${sLan.mots}) ; FRA : mises en échec +${Math.round(sFra.frappe * 100)} % (${sFra.mots}) ; TIE : tirs contre ${Math.round(sTie.contre * 100)} %, ${sTie.strategie} (${sTie.mots}) ; MOY : ${sMoy.strategie}`);
  // Le même porteur, à 11,2 m du filet, le couloir libre : le club qui lance tire, l'autre non.
  const tire = style => {
    const e = enScene('style-tir', null, -18);
    const porteur = surGlace(e, 'A').find(s => s.poste === 'C');
    e.equipes.A.style = style;
    Object.assign(porteur, { x: 8.5, y: 4, cap: 0, vx: 2, vy: 0 });
    const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 2, vy: 0, porteur: porteur.id });
    return !!decisionIA(e, porteur).tir;
  };
  exiger('… le porteur d\'un club qui lance tire de plus loin', tire(sLan) && !tire(sMoy), `à 11,2 m du filet : le club qui lance ${tire(sLan) ? 'tire' : 'ne tire pas'}, le club ordinaire ${tire(sMoy) ? 'tire' : 'ne tire pas'}`);
  // Le même chasseur, de face, à 3,2 m du porteur qui vient sur lui : le club qui frappe s'élance, l'autre non.
  const charge = style => {
    const e = enScene('style-charge', null, 18);
    const A = surGlace(e, 'A'), B = surGlace(e, 'B'), s = A.find(q => q.poste === 'C'), porteur = B.find(q => q.poste === 'C');
    e.equipes.A.style = style;
    for (const q of [...A, ...B]) Object.assign(q, { x: 15, y: 10 + [...A, ...B].indexOf(q) % 3, vx: 0, vy: 0 });
    Object.assign(porteur, { x: -5, y: 0, cap: Math.PI, vx: -4, vy: 0 });
    Object.assign(s, { x: -8.2, y: 0, cap: 0, vx: 3.5, vy: 0, elanRepos: 0 });
    const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: -4, vy: 0, porteur: porteur.id });
    return !!decisionIA(e, s).echec;
  };
  exiger('… et le chasseur d\'un club qui frappe s\'élance de plus loin', charge(sFra) && !charge(sMoy), `à 3,2 m, de face : le club qui frappe ${charge(sFra) ? "s'élance" : "ne s'élance pas"}, le club ordinaire ${charge(sMoy) ? "s'élance" : "ne s'élance pas"}`);
}
{
  // L'AVANTAGE NUMÉRIQUE ET LE DÉSAVANTAGE (le lot 6 ; mesuré, l'avantage ne valait rien : le club à cinq marquait 0,9 fois
  // son rythme à forces égales, le club à quatre aussi). Un ailier du club `eq` au cachot, deux minutes.
  const aQuatre = (e, eq) => {
    const s = surGlace(e, eq).find(q => q.poste === 'AG');
    Object.assign(s, { surGlace: false, boxe: true, x: 3, y: -(W / 2 + 1.2), vx: 0, vy: 0 });
    e.match.penalites.push({ id: s.id, equipe: eq, genre: 'accrochage', reste: MATCH.punition, avantage: MATCH.punition });
  };
  // Le porteur à la pointe, à 12,5 m du filet, un coéquipier devant le gardien, personne sur lui : en avantage, il lance à
  // travers l'écran ; à forces égales, non (trop loin pour un bon tir).
  const pointe = (avantage, ecran) => {
    let n = 0;
    for (let k = 0; k < 40; k++) {
      const e = enScene(`pointe-${k}`, null, 18);
      if (avantage) aQuatre(e, 'B');
      const A = surGlace(e, 'A'), porteur = A.find(q => q.poste === 'D'), devant = A.find(q => q.poste === 'C');
      for (const q of surGlace(e, 'B')) Object.assign(q, { x: 2 + surGlace(e, 'B').indexOf(q) * 2, y: -11 });
      Object.assign(porteur, { x: BLEUE + 0.5, y: 6, cap: -0.5, vx: 0, vy: 0 });
      if (ecran) Object.assign(devant, { x: LIGNE_BUT - 2, y: 0.5 });
      const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: porteur.id });
      if (decisionIA(e, porteur).tir) n++;
    }
    return n;
  };
  const pp = pointe(true, true), ppSans = pointe(true, false), egal = pointe(false, true);
  exiger('l\'avantage numérique : le tir de la pointe à travers l\'écran', pp > 5 && ppSans === 0 && egal === 0, `sur 40 décisions, à 12,5 m : ${pp} tirs en avantage avec l'écran, ${ppSans} sans écran, ${egal} à forces égales`);
  // Le porteur dans sa zone, deux adversaires devant : en désavantage, il la dégage au fond ; à forces égales, non.
  const degage = desavantage => {
    const e = enScene('degage', null, 18);
    if (desavantage) aQuatre(e, 'A');
    const A = surGlace(e, 'A'), porteur = A.find(q => q.poste === 'D');
    for (const q of A) if (q !== porteur) Object.assign(q, { x: -10, y: -8 + A.indexOf(q) * 4 });
    surGlace(e, 'B').forEach((q, i) => Object.assign(q, { x: -9 + i, y: 6 - i * 3 }));
    Object.assign(porteur, { x: -15, y: 3, cap: 0, vx: 0, vy: 0 });
    const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: porteur.id });
    const d = decisionIA(e, porteur);
    return !!d.tir && d.x > 0.5;
  };
  exiger('… le désavantage : de sa zone, le porteur la dégage au fond', degage(true) && !degage(false), `en désavantage, ${degage(true) ? 'il la dégage' : 'il la garde'} ; à forces égales, ${degage(false) ? 'il la dégage' : 'il la garde'}`);
  // L'autre club la porte dans sa zone : à quatre, pas d'échec avant, on l'attend en deçà de notre bleue ; à cinq, on presse.
  const attend = desavantage => {
    const e = enScene('attend', null, 18);
    if (desavantage) aQuatre(e, 'A');
    const B = surGlace(e, 'B'), porteur = B.find(q => q.poste === 'D');
    Object.assign(porteur, { x: 15, y: 3, cap: Math.PI, vx: 0, vy: 0 });
    const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: porteur.id });
    jouer(e, { [porteur.id]: { x: 0, y: 0 } }, 3.5);
    return Math.max(...surGlace(e, 'A').map(q => q.x));
  };
  const xPK = attend(true), xEgal = attend(false);
  exiger('… et sans la rondelle, pas d\'échec avant : on attend en deçà de sa bleue', xPK < 0 && xEgal > BLEUE, `le plus avancé des siens après 3,5 s : à ${xPK.toFixed(1)} m à quatre, à ${xEgal.toFixed(1)} m à cinq (la bleue à ${BLEUE} m)`);
}
{
  // LE REVERS ET LA MAIN : le même tir du poignet, du même point, le même cap, le filet à 86° à sa gauche : un droitier le
  // lance du coup droit, un gaucher du revers.
  const salve = main => {
    const vit = [], ang = [];
    let revers = 0;
    for (let i = 0; i < 60; i++) {
      const { e, toi } = tonPorteur(`revers-${main}-${i}`, -1.5, main);
      Object.assign(toi, { x: LIGNE_BUT - 9, y: 0 });
      const lm = lame(toi); Object.assign(e.rondelle, { x: lm.x, y: lm.y });
      avancer(e, { toi: { x: 0, y: 0, tir: true } }, DT);
      const ev = avancer(e, { toi: { x: 0, y: 0, tir: false } }, DT);
      const t = ev.find(x => x.type === 'tir');
      if (!t) continue;
      if (t.revers) revers++;
      vit.push(Math.hypot(e.rondelle.vx, e.rondelle.vy)); ang.push(Math.atan2(e.rondelle.vy, e.rondelle.vx));
    }
    const m = a => a.reduce((x, y) => x + y, 0) / a.length;
    const ma = m(ang), sd = Math.sqrt(m(ang.map(a => (a - ma) ** 2)));
    return { v: m(vit), sd, revers, n: vit.length };
  };
  const droit = salve('D'), gauche = salve('G');
  exiger('la main du joueur : le filet sur sa gauche, un droitier tire du coup droit, un gaucher du revers', droit.revers === 0 && gauche.revers === gauche.n && gauche.n === 60, `${droit.revers} revers sur ${droit.n} pour le droitier, ${gauche.revers} sur ${gauche.n} pour le gaucher`);
  exiger('… et le tir du revers part moins fort et moins précis', gauche.v < droit.v * (REVERS.tir + 0.05) && gauche.sd > droit.sd * 1.3, `${(droit.v * 3.6).toFixed(0)} km/h du coup droit, ${(gauche.v * 3.6).toFixed(0)} du revers ; un écart de ${(droit.sd * 57.3).toFixed(1)}° contre ${(gauche.sd * 57.3).toFixed(1)}°`);
}
{
  // LA PASSE LAISSÉE : tu files à 7 m/s, un coéquipier te suit à 3 m ; A, le bâton tiré vers l'arrière.
  const laisse = suit => {
    const e = enScene(`laissee-${suit}`, 'A', 18);
    const A = surGlace(e, 'A'), porteur = A.find(s => s.poste === 'C'), suiveur = A.find(s => s.poste === 'AG');
    Object.assign(porteur, { x: -2, y: 0, cap: 0, vx: 7, vy: 0 });
    const lm = lame(porteur); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 7, vy: 0, porteur: porteur.id });
    Object.assign(suiveur, { x: -5, y: 0.4, cap: 0, vx: suit ? 7 : 0, vy: 0 });
    for (const s of A) if (s !== porteur && s !== suiveur) Object.assign(s, { x: -18, y: s.y });
    e.controles.A = porteur.id;
    const ev = [...avancer(e, { [porteur.id]: { x: -1, y: 0, passe: true } }, DT), ...jouer(e, { [porteur.id]: { x: 1, y: 0 } }, 1.5)];
    const p = ev.find(x => x.type === 'passe');
    const prise = ev.find(x => x.type === 'prise');
    return { p, prise, suiveur, porteur };
  };
  const a = laisse(true), b = laisse(false);
  exiger('la passe laissée : A, le bâton vers l\'arrière, la rondelle reste derrière toi au coéquipier qui suit, qui la prend', !!a.p && a.p.laissee && !!a.prise && a.prise.qui === a.suiveur.id, a.p ? `${a.p.laissee ? 'laissée' : 'une passe'}, prise par ${a.prise ? (a.prise.qui === a.suiveur.id ? 'celui qui suit' : a.prise.qui) : 'personne'}` : 'aucune passe');
  exiger('… personne ne te suit : c\'est une passe, pas une rondelle laissée', !!b.p && !b.p.laissee, b.p ? (b.p.laissee ? 'laissée' : 'une passe') : 'aucune passe');
}
{
  // CHOISIR SON TRIO : à l'arrêt de jeu, Y passe au trio suivant ; il saute sur la glace, même fatigué.
  const e = nouveauMatch({ graine: 'trio', A: club('AAA', 100), B: club('BBB', 200), periode: 120, humain: 'A', ia: decisionIA });
  const E = e.equipes.A;
  for (const id of E.lignes.F[1]) e.patineurs.find(s => s.id === id).jambes = 40;
  const y = on => ({ [e.controles.A]: { x: 0, y: 0, ligne: on } });
  avancer(e, y(true), DT); avancer(e, y(false), DT);
  for (let t = 0; t < 2 && !e.mej; t += DT) avancer(e, {}, DT);
  const avants = () => surGlace(e, 'A').filter(s => s.poste !== 'D').map(s => s.id).sort().join(',');
  const deux = avants() === E.lignes.F[1].slice().sort().join(',');
  avancer(e, y(true), DT); avancer(e, y(false), DT);
  const trois = avants() === E.lignes.F[2].slice().sort().join(',') && e.mej && e.mej.reste > MEJ.chute - 0.1;
  exiger('choisir son trio : à l\'arrêt de jeu, Y, et le trio choisi est celui qui joue, même à 40 jambes', deux, `le trio 2 sur la glace : ${deux ? 'oui' : 'non'}`);
  exiger('… encore Y pendant la mise en jeu : le trio suivant saute sur la glace, la mise en jeu se replace', trois, `le trio 3 : ${trois ? 'oui' : 'non'}`);
}
{
  // LE CHANGEMENT À LA VOLÉE : les trois avants de A à 45 jambes, un trio frais au banc, la rondelle à leur défenseur
  // au-delà du centre ; B se tient loin, immobile.
  const e = enScene('volee', null, 16);
  const A = surGlace(e, 'A'), E = e.equipes.A, d = A.find(s => s.poste === 'D');
  const fatigues = A.filter(s => s.poste !== 'D');
  for (const s of e.patineurs.filter(p => p.equipe === 'A')) s.jambes = 100;
  for (const s of fatigues) Object.assign(s, { jambes: 45, x: 6, y: -6 + fatigues.indexOf(s) * 6 });
  Object.assign(d, { x: 1, y: 0, cap: 0 });
  const lm = lame(d); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: d.id });
  const immobiles = { [d.id]: { x: 0, y: 0 } };
  for (const s of surGlace(e, 'B')) immobiles[s.id] = { x: 0, y: 0 };
  const porte = porteDuBanc('A');
  let plus = 0, entrees = [], sorties = 0;
  for (let t = 0; t < 8; t += DT) {
    for (const x of avancer(e, immobiles, DT)) if (x.type === 'volee' && x.equipe === 'A') { sorties++; const r = e.patineurs.find(s => s.id === x.entre); entrees.push(Math.hypot(r.x - porte.x, r.y - porte.y)); }
    plus = Math.max(plus, surGlace(e, 'A').length);
  }
  const frais = surGlace(e, 'A').filter(s => s.poste !== 'D');
  const uneLigne = E.lignes.F.some(l => frais.every(s => l.includes(s.id))) && !frais.some(s => fatigues.includes(s));
  exiger('le changement à la volée : la rondelle loin, les avants fatigués filent au banc et un trio frais saute sur la glace', sorties === 3 && uneLigne, `${sorties} changements, les avants : ${frais.map(s => s.nom).join(', ')}`);
  exiger('… par la porte du banc, pas téléportés : chacun entre à la porte', entrees.length === 3 && entrees.every(x => x < 0.1), `à ${entrees.map(x => x.toFixed(2)).join(', ')} m de la porte`);
  exiger('… jamais un patineur de trop sur la glace', plus <= 5, `au plus ${plus}`);
  exiger('… et au banc, les jambes du trio qui sort remontent', fatigues.every(s => !s.surGlace && s.jambes > 45 + JAMBES.repos), fatigues.map(s => Math.round(s.jambes)).join(', ') + ` jambes (le banc en rend ${JAMBES.repos} par seconde)`);
}
{
  // LE GARDIEN REMIS EN JEU attend qu'un patineur sorte par la porte : il revient alors, de la porte à son filet.
  const e = enScene('retour', null, 16);
  retirerGardien(e, 'A', true);
  const d = surGlace(e, 'A').find(s => s.poste === 'D');
  Object.assign(d, { x: 1, y: 0, cap: 0 });
  const lm = lame(d); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: d.id });
  const immobiles = { [d.id]: { x: 0, y: 0 } };
  for (const s of surGlace(e, 'B')) immobiles[s.id] = { x: 0, y: 0 };
  retirerGardien(e, 'A', false);
  const Gd = e.gardiens.find(g => g.equipe === 'A');
  let trop = false, revenu = null;
  for (let t = 0; t < 10 && !revenu; t += DT) {
    for (const x of avancer(e, immobiles, DT)) if (x.type === 'volee' && x.gardien) revenu = x;
    if (surGlace(e, 'A').length + (Gd.retire ? 0 : 1) > 6) trop = true;
  }
  jouer(e, immobiles, 4);
  exiger('le gardien remis en jeu : un patineur sort par la porte, et le gardien revient à son filet, jamais un de trop', !!revenu && !trop && !Gd.retire && surGlace(e, 'A').length === 5 && Math.abs(Gd.x) > LIGNE_BUT - 2, revenu ? `${surGlace(e, 'A').length} patineurs, le gardien à x ${Gd.x.toFixed(1)}` : 'il attend toujours');
}

/* ---------- le lot 4 (2 nov. 2026) : le jeu physique et les fautes ---------- */
/* Une glace de match où personne ne bouge : chacun reçoit un bâton au neutre (`immobiles`), sauf ceux qu'on joue. */
const immobilesDe = e => Object.fromEntries(e.patineurs.filter(s => s.surGlace).map(s => [s.id, { x: 0, y: 0 }]));
{
  // SOULEVER LE BÂTON : A porte la rondelle, lent, et la protège de B collé à lui ; B presse X. De côté, c'est le bâton
  // soulevé ; dans son dos, le harpon (qui doit passer par son corps).
  const essai = (graine, dx, dy) => {
    const e = enScene(graine, null, 18);
    const p = surGlace(e, 'A').find(s => s.poste === 'C'), b = surGlace(e, 'B').find(s => s.poste === 'D');
    Object.assign(p, { x: 0, y: 0, cap: 0, vx: 0, vy: 0 });
    const lm = lame(p); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: p.id });
    Object.assign(b, { x: dx, y: dy, vx: 0, vy: 0, cap: Math.atan2(-dy, -dx) });
    const im = immobilesDe(e);
    jouer(e, im, 0.3);   // la lame se cache de l'autre côté de son corps
    b.cap = Math.atan2(e.rondelle.y - b.y, e.rondelle.x - b.x);
    const leve = !!leveraitLeBaton(e, b), protege = p.protege;
    const ev = [...avancer(e, { ...im, [b.id]: { x: 0, y: 0, tir: true } }, DT), ...jouer(e, im, 0.5)];
    return { leve, protege, vole: e.rondelle.porteur === b.id, punition: ev.some(x => x.type === 'punition'), harpon: ev.some(x => x.type === 'harpon' && x.qui === b.id) };
  };
  const N = 60;
  let cote = 0, dos = 0, leves = 0, proteges = 0, punis = 0;
  for (let i = 0; i < N; i++) {
    const a = essai(`leve-${i}`, 0.2, -1.2), h = essai(`leve-dos-${i}`, -1.3, 0.3);
    if (a.vole) cote++; if (h.vole || h.harpon) dos++; if (a.leve && !h.leve) leves++; if (a.protege) proteges++; if (a.punition) punis++;
  }
  exiger('soulever le bâton : collé au porteur, de côté, X lui lève le bâton (dans son dos, c\'est le harpon)', leves === N && proteges === N, `${leves} fois sur ${N} (à ${dec1(LEVE.pres)} m de lui au plus), le porteur protégeant ${proteges} fois`);
  exiger('… contre un porteur qui protège, il vole la rondelle plus souvent que le harpon', cote > 2 * dos && cote >= N * 0.25, `${cote} rondelles volées sur ${N} de côté, ${dos} harpons réussis sur ${N} dans son dos`);
  exiger('… sans contact ni punition', punis === 0, `${punis} punition(s)`);
}
{
  // LES FAUTES DE BÂTON : un harpon raté sur le porteur, mis en scène des centaines de fois. Le porteur a le Jeu d'un 20 et le
  // harponneur la Défense d'un 1 : le harpon rate souvent ; chaque essai, un seul appui, et le dé dit la faute.
  const essais = (graine, N, place) => {
    const e = enScene(graine, null, 18), M = e.match;
    const p = surGlace(e, 'A').find(s => s.poste === 'C'), h = surGlace(e, 'B').find(s => s.poste === 'D');
    p.p = { ...p.p, passe: parametresDuPatineur({ jeu: 20 }).passe }; h.p = { ...h.p, defense: 1 / 20 };
    const im = immobilesDe(e);
    const n = { rates: 0, genres: {} };
    for (let i = 0; i < N; i++) {
      M.enAttente = null; M.penalites = []; e.arret = null; e.enJeu = true; e.mej = null;
      for (const s of [p, h]) Object.assign(s, { surGlace: true, boxe: false, auSol: 0, harponRepos: 0, harpon: 0, tenaitTir: false, lachee: 0, protege: false, feinte: 0, lat: s.p.main * BATON.cote, av: BATON.lame[0] });
      place(p, h);
      const lm = lame(p); Object.assign(e.rondelle, { x: lm.x, y: lm.y, z: 0, vx: p.vx, vy: p.vy, porteur: p.id, passeDe: null, passeVers: null });
      const ev = avancer(e, { ...im, [p.id]: { x: Math.cos(p.cap), y: Math.sin(p.cap) }, [h.id]: { x: Math.cos(h.cap), y: Math.sin(h.cap), tir: true } }, DT);
      if (!ev.some(x => x.type === 'harpon')) n.rates++;
      for (const x of ev) if (x.type === 'punition') n.genres[x.genre] = (n.genres[x.genre] || 0) + 1;
    }
    return n;
  };
  const taux = (n, g) => (n.genres[g] || 0) / Math.max(1, n.rates);
  // L'ACCROCHAGE : par-derrière, le porteur lancé à 8 m/s (à 3 m/s, il ne l'est pas).
  const derriere = v => (p, h) => { Object.assign(p, { x: 0, y: 0, cap: 0, vx: v, vy: 0 }); Object.assign(h, { x: -1.15, y: 0, cap: 0, vx: v, vy: 0 }); };
  const vite = essais('accroche', 400, derriere(8)), lent = essais('accroche-lent', 400, derriere(3));
  const attendu = FAUTES.accroche * (1 - HARPON.trebuche);
  exiger('l\'accrochage : un harpon raté par-derrière sur un porteur lancé, au dé', taux(vite, 'accrochage') > 0.6 * attendu && taux(vite, 'accrochage') < 1.5 * attendu && !lent.genres.accrochage, `${vite.genres.accrochage || 0} sur ${vite.rates} harpons ratés à 8 m/s (le dé : ${Math.round(attendu * 100)} %), ${lent.genres.accrochage || 0} à 3 m/s`);
  // LE BÂTON ÉLEVÉ : le même harpon par-derrière, le porteur lent qui protège : le harpon passe par son corps.
  exiger('le bâton élevé : un harpon raté à travers le corps du porteur, au dé', taux(lent, 'bâton élevé') > 0.6 * FAUTES.eleve * (1 - HARPON.trebuche) && taux(lent, 'bâton élevé') < 1.5 * FAUTES.eleve, `${lent.genres['bâton élevé'] || 0} sur ${lent.rates} (le dé : ${Math.round(FAUTES.eleve * 100)} %)`);
  // LE CINGLAGE : de face, en fonçant sur lui à 8 m/s, le porteur qui vient à 3 m/s ; arrêté, jamais.
  const face = v => (p, h) => { Object.assign(p, { x: 0, y: 0, cap: Math.PI, vx: -3, vy: 0 }); Object.assign(h, { x: -3.0, y: 0.25, cap: 0, vx: v, vy: 0 }); };
  const fonce = essais('cingle', 900, face(8)), arrete = essais('cingle-arrete', 300, face(0));
  exiger('le cinglage : un harpon raté en fonçant sur le porteur, au dé', taux(fonce, 'cinglage') > 0.5 * FAUTES.cinglage && taux(fonce, 'cinglage') < 1.7 * FAUTES.cinglage && !arrete.genres.cinglage, `${fonce.genres.cinglage || 0} sur ${fonce.rates} en fonçant (le dé : ${dec1(FAUTES.cinglage * 100)} %), ${arrete.genres.cinglage || 0} arrêté`);
}
{
  // LA BAGARRE : un gros coup (plus de BAGARRE.gros fois le seuil de chute) entre deux durs à cuire (Robustesse 18, trois
  // minutes de punition par match), toi qui martèles A huit fois par seconde ; ou deux joueurs ordinaires.
  const gros = (graine, dur, appuis) => {
    const e = enScene(graine, 'A', 18);
    const victime = surGlace(e, 'A').find(s => s.poste === 'D'), frappeur = surGlace(e, 'B').find(s => s.poste === 'D');
    for (const s of [victime, frappeur]) s.p = { ...s.p, robuste: dur ? 0.9 : 0.5, pim: dur ? 3 : 0.5 };
    e.controles.A = victime.id;
    Object.assign(victime, { x: 0, y: W / 2 - 1.2, cap: 0, vx: 0, vy: 0 });
    Object.assign(frappeur, { x: -1.3, y: W / 2 - 1.2, cap: 0, vx: 10, vy: 0, masse: 110 });
    const im = immobilesDe(e);
    const ev = jouer(e, { ...im, [frappeur.id]: { x: 1, y: 0 } }, 0.2);
    const g = ev.find(x => x.type === 'gants');
    if (!g) return { g, ev, e, poids: Math.max(0, ...ev.filter(x => x.type === 'echec').map(x => x.poids || 0)) };
    let k = 0;
    for (let t = 0; t < BAGARRE.duree + 0.5; t += DT, k++) ev.push(...avancer(e, { [victime.id]: { x: 0, y: 0, passe: appuis && k % 8 === 0 } }, DT));
    ev.push(...jouer(e, {}, MATCH.pauses.bagarre + 0.5));
    return { g, ev, e, victime, frappeur, fin: ev.find(x => x.type === 'bagarre') };
  };
  const a = gros('bagarre', true, true), b = gros('bagarre-sans', true, false);
  exiger('la bagarre : un gros coup entre deux durs à cuire, les gants tombent et le jeu s\'arrête', !!a.g && !!a.fin, a.g ? `${a.fin ? 'le duel est allé au bout' : 'le duel ne finit pas'}` : `pas de bagarre (le coup : ${a.poids} kg·m/s)`);
  if (a.fin && b.fin) {
    exiger('… le duel au bouton : toi qui martèles A la gagnes, sans le bouton tu la perds', a.fin.gagnant === 'A' && b.fin.gagnant === 'B', `en martelant, ${a.fin.gagnant || 'nulle'} ; sans, ${b.fin.gagnant || 'nulle'} (${JSON.stringify(a.e.match.bagarres[0].coups)} contre ${JSON.stringify(b.e.match.bagarres[0].coups)})`);
    const M = a.e.match;
    exiger('… cinq minutes chacun au cachot, et les deux clubs restent à cinq', M.pim.A === BAGARRE.minutes && M.pim.B === BAGARRE.minutes && a.victime.boxe && a.frappeur.boxe && droitSurGlace(a.e, 'A') === 5 && droitSurGlace(a.e, 'B') === 5 && surGlace(a.e, 'A').length === 5 && surGlace(a.e, 'B').length === 5, `${M.pim.A} et ${M.pim.B} minutes, ${surGlace(a.e, 'A').length} contre ${surGlace(a.e, 'B').length} à la mise en jeu`);
    // Les cinq minutes faites, ils rentrent au banc : leur club est déjà à cinq.
    a.e.mej = null; a.e.enJeu = true;
    for (const p of M.penalites) p.reste = 0.05;
    jouer(a.e, {}, 0.2);
    exiger('… et sortis du cachot, ils rentrent au banc : jamais un patineur de trop', !a.victime.boxe && !a.victime.surGlace && surGlace(a.e, 'A').length === 5 && surGlace(a.e, 'B').length === 5, `${surGlace(a.e, 'A').length} contre ${surGlace(a.e, 'B').length}`);
  }
  let ordinaires = 0, essais = 0;
  for (let i = 0; i < 30; i++) { const o = gros(`bagarre-ordinaire-${i}`, false, false); if (o.g) ordinaires++; if (o.ev.some(x => x.type === 'echec' && x.poids > CHUTE.seuil * BAGARRE.gros)) essais++; }
  exiger('… deux joueurs ordinaires (Robustesse 10) ne se battent jamais', ordinaires === 0 && essais === 30, `${ordinaires} bagarres en ${essais} gros coups`);
}

/* ---------- le lot 5 (2 nov. 2026) : la charge, le compte des tirs, la main des sprites, le gardien qui joue la rondelle, la célébration ---------- */
{
  // LA CHARGE PAR-DERRIÈRE, SEULEMENT SUR UN DOS DÉJÀ TOURNÉ (mesuré au lot 4 : 0,8 punition par match sur 1,9, chaque
  // fois un joueur chargé de face qui venait de passer et se détournait). Le même coup que la punition du lot 1 (plus
  // haut), mais la victime ne lui montrait pas le dos quand il s'est élancé : le coup porte, pas de punition.
  const e = enScene('detourne', null, -18);
  const A = surGlace(e, 'A'), B = surGlace(e, 'B');
  const victime = A[0], frappeur = B[0];
  for (const q of [...A, ...B]) Object.assign(q, { x: -20, y: 10, vx: 0, vy: 0 });
  Object.assign(B[1], { x: 15, y: 8, cap: 0 });
  Object.assign(e.rondelle, { x: 16.1, y: 8.3, vx: 0, vy: 0, porteur: B[1].id });
  Object.assign(victime, { x: 0, y: -6, cap: 0, vx: 0, vy: 0, touche: e.t });   // il vient de passer : pas d'obstruction
  Object.assign(frappeur, { x: -2.5, y: -6, cap: 0, vx: 9, vy: 0, elan: 0.35, elanDos: [] });
  const ev = jouer(e, { [frappeur.id]: { x: 1, y: 0 }, [B[1].id]: { x: 0, y: 0 } }, 1.2);
  exiger('la charge par-derrière ne se siffle que sur un dos déjà tourné quand le frappeur s\'élance : celui qui se détourne pendant l\'élan ne la vaut pas', ev.some(x => x.type === 'echec' && x.qui === frappeur.id && x.fort) && !ev.some(x => x.type === 'punition'), ev.filter(x => x.type !== 'prise').map(x => x.type).join(' ') || 'rien');
  informer('les dés des fautes de bâton (le lot 5 : 25, 3,5 et 10 % au lot 4)', `l'accrochage ${Math.round(FAUTES.accroche * 100)} %, le cinglage ${dec1(FAUTES.cinglage * 100)} %, le bâton élevé ${Math.round(FAUTES.eleve * 100)} %`);
}
{
  // LE COMPTE DES TIRS : un tir au but est un arrêt ou un but, comme la LNH le compte. A attaque vers les +x ; la rondelle
  // part de 8 m, lancée par un avant de A ; le gardien de B l'attend.
  const tir = (graine, y, vise, avant = () => {}) => {
    const e = enScene(graine, null, -18);
    const tireur = surGlace(e, 'A')[0], Gd = e.gardiens.find(g => g.equipe === 'B');
    const x0 = Gd.sens * (LIGNE_BUT - 8), d = Math.hypot(Gd.sens * LIGNE_BUT - x0, vise - y);
    Object.assign(tireur, { x: x0 - Gd.sens * 4, y, vx: 0, vy: 0 });   // loin derrière : sa lame ne la reprend pas
    Object.assign(e.rondelle, { x: x0, y, z: 0, vz: 0, vx: (Gd.sens * LIGNE_BUT - x0) / d * 25, vy: (vise - y) / d * 25, porteur: null, dernier: { equipe: 'A', id: tireur.id, t: e.t, x: x0, lance: true, tir: true } });
    avant(e, Gd);
    // le tir sur le poteau se juge au poteau : le rebond que le gardien arrête ensuite est un autre fait
    const ev = [];
    for (let t = 0; t < 1 && !ev.some(x => x.type === 'poteau'); t += DT) ev.push(...avancer(e, {}, DT));
    return { e, ev, M: e.match, Gd, tireur };
  };
  const auGardien = tir('sog-arret', 0, 0), aCote = tir('sog-cote', 0, FILET.large / 2 + 1.2), bloque = tir('sog-bloc', 0, 0, e => Object.assign(surGlace(e, 'B')[0], { x: e.rondelle.x + Math.sign(e.rondelle.vx) * 1.5, y: 0, vx: 0, vy: 0, cap: e.rondelle.vx > 0 ? 0 : Math.PI }));   // dos au tireur : le corps dans la ligne, la lame au-delà
  const dedans = tir('sog-but', 0, 0.6, (e, Gd) => Object.assign(Gd, { y: -FILET.large / 2 - 1.5, memoire: [] }));
  const poteau = tir('sog-poteau', FILET.large / 2 + 0.01, FILET.large / 2 + 0.01, (e, Gd) => Object.assign(Gd, { y: -FILET.large / 2 - 1.5, memoire: [] }));
  exiger('un tir arrêté est un tir au but, et un arrêt', auGardien.ev.some(x => x.type === 'arret') && auGardien.M.tirs.A === 1 && auGardien.Gd.arrets === 1 && auGardien.tireur.stats.tirs === 1, `${auGardien.M.tirs.A} tir, ${auGardien.Gd.arrets} arrêt`);
  exiger('… un but aussi', dedans.ev.some(x => x.type === 'but') && dedans.M.tirs.A === 1 && dedans.Gd.arrets === 0, `${dedans.M.tirs.A} tir, ${dedans.M.pointage.A} but`);
  exiger('… mais pas le tir à côté, sur le poteau ou bloqué : tenté, pas au but', aCote.M.tirs.A === 0 && poteau.M.tirs.A === 0 && bloque.M.tirs.A === 0 && bloque.M.blocs.B === 1 && poteau.ev.some(x => x.type === 'poteau'), `à côté ${aCote.M.tirs.A}, poteau ${poteau.M.tirs.A}, bloqué ${bloque.M.tirs.A} (${bloque.M.blocs.B} bloc)`);
}
{
  // LA MAIN DES SPRITES : la lame dessinée tombe où le moteur tient la rondelle (`lame`), du côté de la main — le gaucher
  // à sa gauche (PATINEURS), le droitier à sa droite (DROITIERS) ; au repos et à la foulée, dans les huit directions.
  // Le jeu dessine la glace à quatorze pixels par mètre, tassée en long par la plongée (cos 0,45).
  const deplier = l => l.replace(/\d+/g, n => '.'.repeat(+n));
  const lameDessinee = lignes => { let sx = 0, sy = 0, n = 0; lignes.map(deplier).forEach((l, y) => [...l].forEach((ch, x) => { if (ch === 'b') { sx += x; sy += y; n++; } })); return n >= 2 ? { x: sx / n - ANCRE[0], y: sy / n - ANCRE[1] } : null; };
  const HUIT = ['E', 'SE', 'S', 'SO', 'O', 'NO', 'N', 'NE'];
  let ecartMax = 0, vus = 0, cotes = 0;
  const pire = [];
  for (const [main, planche] of [[-1, PATINEURS], [1, DROITIERS]]) for (const pose of ['repos', 'patin1', 'patin5', 'glisse']) HUIT.forEach((dir, k) => {
    const b = lameDessinee(planche[dir][pose]);
    if (!b) return;
    const cap = k * Math.PI / 4 + Math.PI / 2, s = { x: 0, y: 0, cap, av: BATON.lame[0], lat: main * BATON.cote };
    const l = lame(s), ex = l.y * 14, ey = -l.x * Math.cos(0.45) * 14;   // l'écran : y en travers, x en long
    const ecart = Math.hypot(b.x - ex, b.y - ey);
    vus++; if (ecart > ecartMax) ecartMax = ecart;
    // le côté : la lame dessinée est du même côté de l'axe du patineur que celle du moteur
    const ax = Math.cos(cap - Math.PI / 2), ay = Math.sin(cap - Math.PI / 2), cote = v => Math.sign(ax * v.y - ay * v.x);
    if (cote(b) === cote({ x: ex, y: ey })) cotes++; else pire.push(`${main > 0 ? 'droitier' : 'gaucher'} ${dir} ${pose}`);
  });
  exiger('les sprites tiennent le bâton de la bonne main : la lame dessinée est du côté de la lame du moteur', vus >= 40 && cotes === vus, `${cotes} sur ${vus} images où la lame se voit${pire.length ? ` ; à revoir : ${pire.slice(0, 4).join(', ')}` : ''}`);
  borne('… et à quelques pixels de la rondelle', ecartMax, 0, 4.5, ' pixels au plus');
  exiger('… le droitier a ses poses avec la rondelle, et protéger la sienne', ['repos', 'patin1', 'glisse', 'protege', 'charge', 'tir', 'passe'].every(p => DROITIERS.S[p]) && !!PATINEURS.S.protege, Object.keys(DROITIERS.S).length + ' poses');
}
{
  // LE GARDIEN JOUE LA RONDELLE. Une rondelle immobile derrière le filet de B, dans le trapèze ; les patineurs de A loin
  // (à 15 m de leur bleue), ceux de B près de la ligne rouge : il sort, la remet au défenseur ouvert, et revient.
  const derriere = (graine, y, bx, avant = () => {}) => {
    const e = enScene(graine, null, bx);
    const Gd = e.gardiens.find(g => g.equipe === 'B'), s = Gd.sens;
    Object.assign(e.rondelle, { x: s * (LIGNE_BUT + 1.6), y, vx: 0, vy: 0, z: 0, vz: 0, porteur: null, dernier: null });
    avant(e, Gd);
    // Où sa rondelle est allée : là où quelqu'un la prend après lui (ou à 3 s), pas où le jeu qui suit la laisse.
    const ev = []; let loin = -Infinity, ou = null;
    for (let t = 0; t < 3; t += DT) {
      const pas = avancer(e, {}, DT); ev.push(...pas); loin = Math.max(loin, Gd.x * s - LIGNE_BUT);
      if (!ou && pas.some(x => x.type === 'prise') && ev.some(x => x.type === 'jeuDuGardien')) ou = { x: e.rondelle.x, y: e.rondelle.y };
    }
    ou = ou || { x: e.rondelle.x, y: e.rondelle.y };
    ev.push(...jouer(e, {}, 3));
    return { e, ev, Gd, s, loin, ou, j: ev.find(x => x.type === 'jeuDuGardien') };
  };
  const r = derriere('g-remise', 1, 8), b = derriere('g-bande', -1.2, -12), dehors = derriere('g-dehors', GARDIEN.jouer.trapeze[1] + 0.8, 8);
  const D = r.j && r.e.patineurs.find(p => p.id === r.j.vers);
  exiger('le gardien sort jouer la rondelle lente derrière son filet, dans le trapèze : une remise à son défenseur', !!r.j && r.j.equipe === 'B' && !!D && D.poste === 'D' && r.loin > 0.5, r.j ? `vers ${D ? D.nom : r.j.vers}, sorti à ${dec1(r.loin)} m derrière sa ligne` : r.ev.map(x => x.type).join(' ') || 'rien');
  exiger('… puis il revient devant son filet', r.Gd.x * r.s < LIGNE_BUT - 0.5 && Math.abs(r.Gd.y) < FILET.large / 2, `à ${dec1(LIGNE_BUT - r.Gd.x * r.s)} m devant sa ligne`);
  exiger('… personne d\'ouvert, il la dégage le long de la bande, vers le haut de la glace', !!b.j && !b.j.vers && Math.abs(b.ou.y) > 5 && b.ou.x * b.s < LIGNE_BUT - 4, b.j ? `la rondelle prise à (${dec1(b.ou.x)}, ${dec1(b.ou.y)})` : 'il ne la joue pas');
  exiger('… hors du trapèze, il ne la joue pas', !dehors.j && dehors.loin < 0.3, `sorti à ${dec1(dehors.loin)} m`);
  // LE TRAPÈZE (la règle de 2005) : il l'a vue dedans (sa mémoire, 170 ms en retard), elle a glissé dehors : deux minutes,
  // purgées par un patineur de son club, le jeu arrêté sur-le-champ.
  const e = enScene('g-trapeze', null, 8);
  const Gd = e.gardiens.find(g => g.equipe === 'B'), s = Gd.sens, u = 1.6;
  const bord = GARDIEN.jouer.trapeze[0] + (GARDIEN.jouer.trapeze[1] - GARDIEN.jouer.trapeze[0]) * u / (L / 2 - LIGNE_BUT);
  Object.assign(e.rondelle, { x: s * (LIGNE_BUT + u), y: bord + 0.15, vx: 0, vy: 0, z: 0, vz: 0, porteur: null, dernier: null });
  Object.assign(Gd, { x: s * (LIGNE_BUT + u), y: bord - 0.55, vx: 0, vy: 0, memoire: Array(40).fill({ x: s * (LIGNE_BUT + u), y: bord - 0.3, vx: 0, vy: 0, libre: true }) });
  const ev = jouer(e, {}, 1);
  const p = ev.find(x => x.type === 'punition');
  exiger('le gardien qui joue la rondelle hors du trapèze : deux minutes, purgées par un patineur', !!p && p.gardien && p.equipe === 'B' && e.match.pim.B === MATCH.punition / 60 && !e.patineurs.find(q => q.id === p.qui).surGlace && droitSurGlace(e, 'B') === 4, p ? `${p.genre}, ${e.match.pim.B} min, ${droitSurGlace(e, 'B')} B à la mise en jeu` : ev.map(x => x.type).join(' ') || 'rien');
}
{
  // LA CÉLÉBRATION : un but de A ; le jeu arrêté, ses coéquipiers patinent au buteur et s'y serrent, ceux de B non.
  const e = enScene('fete', null, -18);
  const A = surGlace(e, 'A'), buteur = A[0], Gd = e.gardiens.find(g => g.equipe === 'B');
  A.forEach((q, i) => Object.assign(q, { x: Gd.sens * (LIGNE_BUT - 6 - 3 * i), y: i % 2 ? 7 : -7, vx: 0, vy: 0 }));
  Object.assign(buteur, { x: Gd.sens * (LIGNE_BUT - 5), y: 2, vx: 0, vy: 0 });
  Object.assign(Gd, { y: -FILET.large / 2 - 1.5, memoire: [] });
  Object.assign(e.rondelle, { x: Gd.sens * (LIGNE_BUT - 3), y: 0, z: 0, vz: 0, vx: Gd.sens * 20, vy: 0, porteur: null, dernier: { equipe: 'A', id: buteur.id, t: e.t, x: 0, lance: true, tir: true } });
  const loinDe = (eq, q) => surGlace(e, eq).filter(x => x !== q).map(x => Math.hypot(x.x - q.x, x.y - q.y));
  let but = false;
  for (let t = 0; t < 1 && !but; t += DT) but = avancer(e, {}, DT).some(x => x.type === 'but');
  const avant = loinDe('A', buteur), avantB = loinDe('B', buteur);
  jouer(e, {}, CELEBRATION.duree);
  const apres = loinDe('A', buteur), apresB = loinDe('B', buteur), moy = l => l.reduce((a, b) => a + b, 0) / l.length;
  exiger('la célébration : après un but, ses coéquipiers se regroupent sur le buteur, les autres non', but && !!e.arret && e.arret.genre === 'but' && moy(apres) < 2.6 && moy(avant) > 5 && Math.abs(moy(apresB) - moy(avantB)) < 2, `${dec1(moy(avant))} → ${dec1(moy(apres))} m du buteur (B : ${dec1(moy(avantB))} → ${dec1(moy(apresB))} m), ${dec1(CELEBRATION.duree)} s`);
  const ev = jouer(e, {}, MATCH.pauses.but);
  exiger('… puis la mise en jeu au centre', ev.some(x => x.type === 'remise' && x.point && x.point.x === 0), ev.map(x => x.type).join(' ') || 'rien');
}

{
  // L'OBSTRUCTION SUR LE GARDIEN ET LE BUT REFUSÉ (7 nov. 2026 ; JP : *l'obstruction sur le gardien*). Un attaquant de A
  // entre dans le gardien de B, dans son enclave ; `apres` s plus tard, un coéquipier marque dans ce filet.
  const obstruer = (graine, { v = 3, pousse = false, apres = 0.3 } = {}) => {
    const e = enScene(graine, null, -18);
    const Gd = e.gardiens.find(g => g.equipe === 'B'), sg = Gd.sens, A = surGlace(e, 'A'), fonceur = A[0], tireur = A[1];
    Object.assign(Gd, { x: sg * (LIGNE_BUT - 0.6), y: 0, vx: 0, vy: 0, memoire: [] });
    Object.assign(fonceur, { x: Gd.x - sg * 1.3, y: 0, vx: sg * v, vy: 0, cap: sg > 0 ? 0 : Math.PI });
    if (pousse) surGlace(e, 'B')[0].choc = { sur: fonceur.id, t: e.t };   // un défenseur de B vient de le pousser
    const ev = jouer(e, { [fonceur.id]: { x: sg, y: 0 } }, 0.35);
    ev.push(...jouer(e, { [fonceur.id]: { x: 0, y: 0 } }, apres));
    // le tir : le fonceur ressorti de l'enclave, le gardien de côté, la rondelle lancée au filet
    Object.assign(fonceur, { x: sg * (LIGNE_BUT - 5), y: -6, vx: 0, vy: 0 });
    Object.assign(Gd, { y: -FILET.large / 2 - 1.5, vx: 0, vy: 0, memoire: [] });
    Object.assign(e.rondelle, { x: sg * (LIGNE_BUT - 3), y: 0.3, z: 0, vz: 0, vx: sg * 20, vy: 0, porteur: null, dernier: { equipe: 'A', id: tireur.id, t: e.t, x: 0, lance: true, tir: true } });
    for (let t = 0; t < 1 && !ev.some(x => x.type === 'but' || x.type === 'butRefuse'); t += DT) ev.push(...avancer(e, {}, DT));
    return { e, ev, sg, fonceur, refuse: ev.find(x => x.type === 'butRefuse'), but: ev.some(x => x.type === 'but'), punition: ev.find(x => x.type === 'punition') };
  };
  const r = obstruer('obstruction');
  exiger("l'obstruction sur le gardien : un attaquant entre dans le gardien dans l'enclave, le but qui suit est refusé", !!r.refuse && !r.but && r.refuse.qui === r.fonceur.id && r.e.match.pointage.A === 0 && r.e.match.refuses.A === 1, r.refuse ? `refusé, ${r.e.match.pointage.A} but` : r.ev.filter(x => x.type !== 'prise').map(x => x.type).join(' ') || 'rien');
  exiger('… le sifflet, et le tir ne compte pas au but', !!r.e.arret && r.e.arret.genre === 'refuse' && r.e.match.tirs.A === 0, r.e.arret ? `${r.e.arret.genre}, ${r.e.match.tirs.A} tir` : 'le jeu continue');
  exiger("… la mise en jeu au point de la zone neutre, du côté de ce filet", !!r.e.arret && r.e.arret.point && Math.abs(r.e.arret.point.x - r.sg * POINT.neutre) < 0.01, r.e.arret && r.e.arret.point ? `(${r.e.arret.point.x.toFixed(2)}, ${r.e.arret.point.y.toFixed(2)})` : 'aucune');
  exiger('… un contact léger : pas de punition', !r.punition, r.punition ? r.punition.genre : 'aucune');
  const pousse = obstruer('obstruction-poussee', { pousse: true });
  exiger("… poussé dedans par un défenseur, il n'y est pour rien : le but compte", pousse.but && !pousse.refuse && pousse.e.match.pointage.A === 1, pousse.refuse ? 'refusé' : `${pousse.e.match.pointage.A} but`);
  const tard = obstruer('obstruction-tard', { apres: OBSTRUCTION.fenetre + 0.2 });
  exiger(`… le but marqué plus de ${dec1(OBSTRUCTION.fenetre)} s après le contact compte`, tard.but && !tard.refuse, tard.refuse ? 'refusé' : 'compté');
  const fort = obstruer('obstruction-forte', { v: 6.5 });
  exiger(`… entré à plus de ${Math.round(OBSTRUCTION.fort * 3.6)} km/h : deux minutes pour obstruction sur le gardien`, !!fort.punition && fort.punition.genre === 'obstruction sur le gardien' && fort.punition.qui === fort.fonceur.id, fort.punition ? fort.punition.genre : fort.ev.filter(x => x.type === 'obstrue').map(x => `contact à ${x.v} m/s`).join(' ') || 'aucun contact');
}

{
  // LE CONTOURNEMENT DU FILET (7 nov. 2026) : le centre de A sort de derrière le filet de B, vers l'axe, la lame à côté du
  // poteau (0,3 m devant la ligne, 0,4 m au-dehors) ; un tir du poignet, au bouton (toi) ou à l'IA.
  const contour = (graine, gardienY, humain) => {
    const e = enScene(graine, humain, -18);
    const Gd = e.gardiens.find(g => g.equipe === 'B'), sg = Gd.sens, p = surGlace(e, 'A').find(q => q.poste === 'C');
    Object.assign(p, { x: sg * (LIGNE_BUT + 0.2), y: -2.2, cap: Math.PI / 2, vx: 0, vy: 2.5 });
    const cible = { x: sg * (LIGNE_BUT - 0.3), y: -(FILET.large / 2 + 0.4) }, lm = lame(p);
    p.x += cible.x - lm.x; p.y += cible.y - lm.y;
    Object.assign(e.rondelle, { x: cible.x, y: cible.y, z: 0, vx: 0, vy: 2.5, vz: 0, porteur: p.id, dernier: { equipe: 'A', id: p.id, t: e.t, x: cible.x, lance: false } });
    Object.assign(Gd, { x: sg * (LIGNE_BUT - 0.4), y: gardienY, vx: 0, vy: 0, memoire: [] });
    if (humain) e.controles.A = p.id;
    const ev = humain ? jouer(e, { [p.id]: { x: 0, y: 1, tir: true } }, DT) : [];
    ev.push(...jouer(e, humain ? { [p.id]: { x: 0, y: 1, tir: false } } : {}, 1));
    const tir = ev.find(x => x.type === 'tir' && x.qui === p.id);
    return { tir, but: ev.some(x => x.type === 'but' && x.equipe === 'A'), arret: ev.some(x => x.type === 'arret' || x.type === 'poteau'), ev };
  };
  const ouvert = contour('contour', 0.75, 'A'), ferme = contour('contour-ferme', -0.6, 'A'), ia = contour('contour-ia', 0.75, null);
  exiger(`le contournement du filet : la lame à côté du poteau, le gardien à l'autre, le tir la glisse au ras du poteau`, !!ouvert.tir && ouvert.tir.contour && ouvert.but, ouvert.tir ? `${ouvert.tir.contour ? 'au poteau' : 'pas au contour'}, ${ouvert.but ? 'but' : 'pas de but'}` : ouvert.ev.map(x => x.type).join(' ') || 'pas de tir');
  exiger("… le gardien qui couvre ce poteau l'arrête", !!ferme.tir && ferme.tir.contour && !ferme.but, ferme.but ? 'but' : ferme.arret ? 'arrêt' : 'rien');
  exiger("… l'IA la glisse aussi, du même bouton", !!ia.tir && ia.tir.contour && ia.but, ia.tir ? `${ia.tir.contour ? 'au poteau' : 'pas au contour'}, ${ia.but ? 'but' : 'pas de but'}` : 'pas de tir');
}

{
  // LE DOUBLE-ÉCHEC (7 nov. 2026) : un avant de B charge de face le porteur de A, le bouton d'échec pendant le coup de
  // bâton (l'élan et le harpon en même temps) ; les mêmes scènes sans le bâton levé.
  const charge = (graine, deuxMains) => {
    const e = enScene(graine, null, 15);
    const A = surGlace(e, 'A'), B = surGlace(e, 'B'), victime = A.find(q => q.poste !== 'D'), frappeur = B.find(q => q.poste !== 'D');
    for (const q of [...A, ...B]) Object.assign(q, { x: -20, y: 10, vx: 0, vy: 0 });
    Object.assign(victime, { x: 0, y: -6, cap: 0, vx: 0, vy: 0 });
    const lm = lame(victime); Object.assign(e.rondelle, { x: lm.x, y: lm.y, vx: 0, vy: 0, porteur: victime.id });
    Object.assign(frappeur, { x: 2.6, y: -6, cap: Math.PI, vx: -9, vy: 0, elan: 0.35 });
    if (deuxMains) frappeur.harponT = e.t;   // le coup de bâton vient de partir
    const ev = jouer(e, { [frappeur.id]: { x: -1, y: 0 }, [victime.id]: { x: 0, y: 0 } }, 0.4);
    const ch = ev.find(x => x.type === 'echec' && x.qui === frappeur.id);
    return { poids: ch ? ch.poids : 0, double: ev.some(x => x.type === 'punition' && x.genre === 'double-échec') };
  };
  const NC = 40, avec = Array.from({ length: NC }, (_, i) => charge(`double-${i}`, true)), sans = Array.from({ length: NC }, (_, i) => charge(`double-${i}`, false));
  const moy = l => l.reduce((a, b) => a + b, 0) / l.length;
  borne(`le double-échec : la charge donnée le bâton levé à deux mains se siffle ${Math.round(DOUBLE.siffle * 100)} fois sur 100`, avec.filter(r => r.double).length / NC, DOUBLE.siffle - 0.2, DOUBLE.siffle + 0.2, ` (${NC} charges)`);
  exiger('… la même charge sans le bâton levé : jamais', sans.every(r => !r.double), `${sans.filter(r => r.double).length} sur ${NC}`);
  borne(`… et le manche pèse : le coup ${dec1(DOUBLE.force)} fois plus lourd`, moy(avec.map(r => r.poids)) / Math.max(1, moy(sans.map(r => r.poids))), DOUBLE.force - 0.1, DOUBLE.force + 0.1, ' fois');
}
{
  // LA RUDESSE APRÈS LE SIFFLET : le jeu arrêté, ton joueur presse l'échec à 1 m d'un adversaire ; puis à 3 m.
  const bouscule = (graine, d) => {
    const e = enScene(graine, 'A', 15);
    const s = surGlace(e, 'A').find(q => q.poste !== 'D'), q = surGlace(e, 'B').find(o => o.poste !== 'D');
    Object.assign(s, { x: 10, y: 0, vx: 0, vy: 0 }); Object.assign(q, { x: 10 + d, y: 0, vx: 0, vy: 0 });
    e.controles.A = s.id;
    e.enJeu = false; e.arret = { genre: 'gel', reste: 1.2, point: { x: POINT.x, y: POINT.y } };
    const ev = jouer(e, { [s.id]: { x: 0, y: 0, echec: true } }, DT);
    const pn = ev.find(x => x.type === 'punition' && x.qui === s.id);
    ev.push(...jouer(e, {}, 1.4));
    return { e, s, pn, ev, recul: q.x - 10 };
  };
  const pres = bouscule('rudesse', 1), loin = bouscule('rudesse-loin', 3);
  exiger("la rudesse après le sifflet : le bouton d'échec près d'un adversaire le bouscule, deux minutes sur-le-champ", !!pres.pn && pres.pn.genre === 'rudesse' && !pres.e.patineurs.find(x => x.id === pres.s.id).surGlace && pres.e.match.pim.A === MATCH.punition / 60 && pres.recul > 1 + RUDESSE.recul - 0.05, pres.pn ? `${pres.pn.genre}, ${pres.e.match.pim.A} min, reculé de ${dec1(pres.recul - 1)} m` : pres.ev.map(x => x.type).join(' ') || 'rien');
  exiger('… la mise en jeu, son club à quatre', droitSurGlace(pres.e, 'A') === 4 && surGlace(pres.e, 'A').length === 4, `${surGlace(pres.e, 'A').length} de A sur la glace`);
  exiger(`… à plus de ${dec1(RUDESSE.portee)} m de tout adversaire, rien`, !loin.pn, loin.pn ? loin.pn.genre : 'rien');
}

/* ---------- les règles, écrites de là ---------- */
{
  const r = reglesDeLaGlace();
  exiger('les règles de la glace se lisent du code', r.length >= 11 && r.every(l => /\d/.test(l)), `${r.length} lignes`);
  exiger('… et disent les constantes', r.some(l => l.includes(`${Math.round(RONDELLE.masse * 1000)} g`)) && r.some(l => l.includes(`${Math.round(GARDIEN.reaction * 1000)} ms`)) && r.some(l => l.includes(`${PATIN.masse} kg`)) && r.some(l => l.includes(`${MATCH.punition / 60} minutes`)) && r.some(l => l.includes(`${Math.round(GARDIEN.trous.haut * 100)} %`)) && r.some(l => l.includes(`${MATCH.retraitGardien} s`)), 'la masse, la réaction, le poids, la punition, les trous, le retrait');
}

verdict(`La physique de Sur glace · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
