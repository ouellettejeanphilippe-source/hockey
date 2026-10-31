/*
 * SUR GLACE — LA PHYSIQUE SE MESURE (31 oct. 2026). JP : *faire un jeu 2D avec une physique crédible, pas refaire
 * un jeu de 30 ans*. Chaque chiffre que js/physique.js promet se rejoue ici, en Node, sans écran, sur un pas fixe :
 *
 *   la rondelle   une passe meurt où le frottement le dit, un rebond garde sa vitesse le long de la bande et rend
 *                 55 % en travers, le coin la garde dans la patinoire ;
 *   le patineur   une pointe autour de 30 km/h en moins de six secondes, un arrêt en moins de deux secondes et
 *                 demie, un virage à pleine vitesse qui fait des mètres de rayon, un pivot sur place ;
 *   la lame       la rondelle reste à la lame en ligne droite, la passe et le tir partent à la vitesse dite, le
 *                 lancer frappé plus vite que le tir du poignet ;
 *   le filet      un but se compte quand la rondelle entière passe la ligne, le poteau se compte, le gardien gèle
 *                 ou rend un retour, et la remise suit ;
 *   le choc       l'élan se conserve, le plot tombe sous une vraie mise en échec et reste debout sous un frôlement ;
 *   le gardien    des tirs de l'enclave le battent parfois, des tirs de la bleue presque jamais ;
 *   la graine     les mêmes entrées sur la même graine rendent la même empreinte.
 *
 *   node scripts/check_physique.mjs
 */
import { exiger, borne, informer, verdict } from './verdict.mjs';
import { nouvelleGlace, avancer, remise, empreinte, reglesDeLaGlace, lame, bander, L, W, LIGNE_BUT, FILET, PATIN, BATON, RONDELLE, GARDIEN, CHUTE } from '../js/physique.js';

const t0 = Date.now();
const G = 9.81;
const DT = 1 / 60;
const v = o => Math.hypot(o.vx, o.vy);

/* Une glace où personne ne gêne : toi et le plot loin dans le coin gauche, le plot sans poste. */
function glaceVide(graine = 'mesure') {
  const e = nouvelleGlace(graine);
  const [toi, plot] = e.patineurs;
  Object.assign(toi, { x: -24, y: 9 }); Object.assign(plot, { x: -26, y: -11, poste: null });
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
  Object.assign(e.rondelle, { x: -28, y: 6, vx: 10, vy: 0 });
  jouer(e, {}, 14);
  const d = e.rondelle.x + 28;
  borne('une rondelle à 36 km/h glisse ce que le frottement dit (v² / 2µg)', d, 10 * 10 / (2 * RONDELLE.frottement * G) - 2, 10 * 10 / (2 * RONDELLE.frottement * G) + 2, ' m');
  exiger('… et elle finit immobile', v(e.rondelle) < 0.01, `${v(e.rondelle).toFixed(3)} m/s`);
}
{
  const e = glaceVide();
  Object.assign(e.rondelle, { x: 0, y: 0, vx: 6, vy: 6 });
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
  // La fonction nue : un point lancé droit sur le coin rebondit vers l'intérieur.
  const o = { x: L / 2 - 0.2, y: W / 2 - 0.2, vx: 5, vy: 5 };
  bander(o, 0.04, 0.5);
  exiger('un cercle poussé dans le coin en ressort vers le centre', o.vx < 0 && o.vy < 0 && Math.hypot(o.x, o.y) < Math.hypot(L / 2, W / 2), `v (${o.vx.toFixed(1)}, ${o.vy.toFixed(1)})`);
}

/* ---------- le patineur ---------- */
{
  const e = glaceVide();
  const toi = e.patineurs[0];
  Object.assign(toi, { x: -27, y: 9, cap: 0 });
  let vmax = 0, t95 = null, t = 0;
  for (; t < 8; t += DT) { avancer(e, { toi: { x: 1, y: 0 } }, DT); vmax = Math.max(vmax, v(toi)); if (t95 === null && v(toi) >= 0.95 * 8.3) t95 = t; }
  borne('la pointe d\'un patineur, en ligne droite', vmax * 3.6, 28, 33, ' km/h');
  exiger('… atteinte à 95 % en moins de six secondes', t95 !== null && t95 < 6, t95 === null ? 'jamais' : `${t95.toFixed(1)} s`);
  // Le frein : le bâton à l'envers.
  const x0 = toi.x, tf = e.t;
  while (v(toi) > 0.3 && e.t - tf < 5) avancer(e, { toi: { x: -1, y: 0 } }, DT);
  borne('le frein : de la pointe à l\'arrêt', e.t - tf, 0.6, 2.5, ' s');
  borne('… sur quelques mètres', toi.x - x0, 2, 12, ' m');
}
{
  const e = glaceVide();
  const toi = e.patineurs[0];
  Object.assign(toi, { x: -27, y: -8, cap: 0 });
  jouer(e, { toi: { x: 1, y: 0 } }, 7);
  const xv = toi.x, vv = v(toi);
  let maxX = -1e9;
  for (let t = 0; t < 3; t += DT) { avancer(e, { toi: { x: 0, y: 1 } }, DT); maxX = Math.max(maxX, toi.x); }
  borne('à pleine vitesse, le virage le plus serré a un rayon de plusieurs mètres', maxX - xv, 5, 12, ' m');
  exiger('… et il a bel et bien tourné vers le bâton', Math.abs(toi.cap - Math.PI / 2) < 0.3, `cap ${toi.cap.toFixed(2)} rad à ${(vv * 3.6).toFixed(0)} km/h`);
}
{
  const e = glaceVide();
  const toi = e.patineurs[0];
  Object.assign(toi, { x: -20, y: 0, cap: 0, vx: 0, vy: 0 });
  let tPivot = null;
  for (let t = 0; t < 2; t += DT) { avancer(e, { toi: { x: -1, y: 0.01 } }, DT); if (tPivot === null && Math.abs(Math.abs(toi.cap) - Math.PI) < 0.3) tPivot = t; }
  exiger('à l\'arrêt, il pivote d\'un demi-tour en moins d\'une seconde et demie', tPivot !== null && tPivot < 1.5, tPivot === null ? 'jamais' : `${tPivot.toFixed(2)} s`);
}

/* ---------- la lame ---------- */
{
  const e = glaceVide();
  const toi = e.patineurs[0];
  Object.assign(toi, { x: -27, y: 9, cap: 0 });
  Object.assign(e.rondelle, { x: -25.9, y: 9.3 });
  let gardee = true, loin = 0;
  for (let t = 0; t < 5; t += DT) {
    avancer(e, { toi: { x: 1, y: 0 } }, DT);
    if (e.rondelle.porteur !== 'toi') gardee = false;
    const lm = lame(toi); loin = Math.max(loin, Math.hypot(e.rondelle.x - lm.x, e.rondelle.y - lm.y));
  }
  exiger('en ligne droite, la rondelle reste à la lame', gardee && loin < PATIN.portee, `au plus ${loin.toFixed(2)} m de la lame`);
  // La passe, à l'arrêt.
  const e2 = glaceVide();
  Object.assign(e2.patineurs[0], { x: -20, y: 0, cap: 0 });
  Object.assign(e2.rondelle, { x: -18.9, y: 0.3 });
  avancer(e2, { toi: { x: 0, y: 0 } }, DT);
  const evP = avancer(e2, { toi: { x: 0, y: 0, passe: true } }, DT);
  exiger('la passe part', evP.some(x => x.type === 'passe') && e2.rondelle.porteur === null, evP.map(x => x.type).join(' '));
  borne('… à la vitesse de la passe', v(e2.rondelle), BATON.passe - 0.5, BATON.passe + 0.5, ' m/s');
  // Le tir du poignet (un appui) et le lancer frappé (chargé une seconde).
  const tir = (charge) => {
    const g = glaceVide('tir');
    Object.assign(g.patineurs[0], { x: -20, y: 0, cap: 0 });
    Object.assign(g.rondelle, { x: -18.9, y: 0.3 });
    avancer(g, { toi: { x: 0, y: 0 } }, DT);
    jouer(g, { toi: { x: 0, y: 0, tir: true } }, charge);
    const ev = avancer(g, { toi: { x: 0, y: 0, tir: false } }, DT);
    const t = ev.find(x => x.type === 'tir');
    return t ? t.v : 0;
  };
  const poignet = tir(DT), frappe = tir(1);
  borne('le tir du poignet part à la vitesse dite', poignet, BATON.tirMin - 0.5, BATON.tirMin + 3, ' m/s');
  borne('le lancer frappé chargé, plus vite', frappe, BATON.tirMax - 0.5, BATON.tirMax + 3, ' m/s');
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
  /* Les arrêts, mesurés : des tirs tirés au hasard dans le filet, de l'enclave puis de la bleue. */
  const taux = (dist, vit, n, graine) => {
    const e = glaceVide(graine);
    let buts = 0, arrets = 0;
    for (let i = 0; i < n; i++) {
      remise(e, 'but');
      const y = (e.de() - 0.5) * 6, cible = (e.de() - 0.5) * 1.7;
      const x = LIGNE_BUT - dist;
      const dx = LIGNE_BUT - x, dy = cible - y, d = Math.hypot(dx, dy);
      // La rondelle attend là un instant : le gardien se place devant elle, comme devant un porteur.
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
  const enclave = taux(8, 30, 120, 'enclave'), bleue = taux(18, 35, 120, 'bleue');
  informer('les tirs de l\'enclave (8 m, 108 km/h)', `${enclave.buts} buts, ${enclave.arrets} arrêts`);
  borne('le gardien arrête la plupart des tirs de l\'enclave, pas tous', enclave.part, 0.55, 0.95);
  informer('les tirs de la bleue (18 m, 126 km/h)', `${bleue.buts} buts, ${bleue.arrets} arrêts`);
  borne('… et presque tous ceux de la bleue', bleue.part, 0.85, 1);
  exiger('la bleue est plus facile à arrêter que l\'enclave', bleue.part > enclave.part, `${(bleue.part * 100).toFixed(0)} % contre ${(enclave.part * 100).toFixed(0)} %`);
}

/* ---------- la mise en échec ---------- */
{
  const choc = vit => {
    const e = glaceVide('choc');
    const [toi, plot] = e.patineurs;
    Object.assign(toi, { x: -10, y: 0, cap: 0, vx: vit, vy: 0 });
    Object.assign(plot, { x: -8, y: 0, cap: Math.PI, vx: 0, vy: 0, poste: null });
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

/* ---------- la graine ---------- */
{
  const partie = graine => {
    const e = nouvelleGlace(graine);
    const plan = t => (t < 3 ? { x: 1, y: 0 } : t < 4 ? { x: 0, y: 1, tir: true } : t < 4.5 ? { x: 1, y: 0.3 } : t < 6 ? { x: 1, y: 0, passe: t > 5.5 } : { x: -1, y: 0 });
    for (let t = 0; t < 8; t += DT) avancer(e, { toi: plan(t) }, DT);
    return empreinte(e);
  };
  exiger('les mêmes entrées sur la même graine rejouent la même glace', partie('abc') === partie('abc'), partie('abc'));
}

/* ---------- les règles, écrites de là ---------- */
{
  const r = reglesDeLaGlace();
  exiger('les règles de la glace se lisent du code', r.length >= 8 && r.every(l => /\d/.test(l)), `${r.length} lignes`);
  exiger('… et disent les constantes', r.some(l => l.includes(`${Math.round(RONDELLE.masse * 1000)} g`)) && r.some(l => l.includes(`${Math.round(GARDIEN.reaction * 1000)} ms`)) && r.some(l => l.includes(`${PATIN.masse} kg`)), 'la masse, la réaction, le poids');
}

verdict(`La physique de Sur glace · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
