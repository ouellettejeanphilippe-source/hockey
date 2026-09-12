/*
 * LE MATCH SUR TABLE — est-ce que ça donne du hockey ?
 *
 * Le mode bonus « Sur table » (js/table.js) est un jeu de plateau, pas le
 * moteur par événements : il ne cherche pas à reproduire une saison, il
 * cherche à être JOUABLE. Mais un match de hockey qui finit 11-9 ou 0-0 n'est
 * pas du hockey, et une partie qui dure quarante gestes n'est pas rapide.
 * Ce script mesure les quatre choses dont le réglage dépend :
 *
 *   les buts par équipe par match   cible 5 à 6. JP : *faut pas faire comme la
 *                                   vraie NHL, c'est un mode arcade, oui avec
 *                                   stratégie et deepness, mais pas genre
 *                                   vraie hockey*. Le moteur par événements
 *                                   (js/sim.js) tient la crédibilité, avec
 *                                   ses 3,1 buts ; le plateau est une borne
 *   les gestes par présence         cible 4 à 6 : assez pour que la présence
 *                                   raconte quelque chose, assez peu pour
 *                                   qu'elle se joue en trente secondes
 *   la part de nulles après 3 périodes  la prolongation doit rester l'exception
 *   l'écart fort/faible             une meilleure équipe doit gagner plus
 *                                   souvent : c'est la monotonie, en petit
 *
 *   node scripts/check_table.mjs
 *   MATCHS=400 node scripts/check_table.mjs
 *
 * RÉGLAGE ACTUEL (240 matchs) : 5,0 buts par équipe par match, 17 % de
 * prolongations, 5,1 gestes par présence, 14 mises en échec, 21 % des pièces
 * essoufflées, et les pointages les plus fréquents sont 5-4, 6-5, 4-3, 6-4 —
 * une borne. La parité va de 73 victoires sur 100 pour le premier décile
 * contre le dixième à 51 sur 100 entre deux équipes du même décile.
 *
 * Chaque réglage est sorti d'ici, aucun n'a été deviné : `md` (deux crans de
 * talent pour un point de dé), le 6 qui réussit toujours et le 1 qui casse
 * toujours, la sortie de zone du gardien, une pièce qui bouge une fois et
 * agit une fois, la glace à neuf rangées, le seuil du tir à 4+, patiner sur
 * une rondelle libre pour la ramasser, qui enlève la rondelle repart avec,
 * le retour devant le filet, la durée au sol d'un joueur frappé, et la
 * protection du porteur.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, getHiddenRatings, SLOTS } from '../js/sim.js';
import { equipeDeTable, jouerMatchAuto, nouveauMatch, iaPresence, resultatDe,
         statsDeTable, PERIODES, PRESENCES_PAR_PERIODE, GABARITS, TIRS,
         surLaGlace, essouffle } from '../js/table.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const MATCHS = Number(process.env.MATCHS ?? 240);

/* ---------- de vraies équipes, alignées comme le jeu les aligne ---------- */
const clubs = [];
for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const parEquipe = {};
  for (const p of shard.players) (parEquipe[p.t] = parEquipe[p.t] || []).push(p);
  for (const [t, ps] of Object.entries(parEquipe)) {
    if (ps.length < 20) continue;
    const pool = ps.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    const roster = autoRoster(pool);
    if (Object.keys(roster).length < 20) continue;
    const vals = Object.values(roster).map(p => getHiddenRatings(p).v);
    clubs.push({ nom: `${t} ${shard.season}`, tag: t, roster, force: vals.reduce((a, b) => a + b, 0) / vals.length });
  }
}
clubs.sort((a, b) => b.force - a.force);
console.log(`${clubs.length} vraies équipes alignées.\n`);

/* ---------- la distribution des quatre nombres ---------- */
const axes = { PA: [], MA: [], TI: [], FO: [], AR: [] };
for (const c of clubs) for (const p of Object.values(c.roster)) {
  const st = statsDeTable(p);
  if (p.p === 'G') axes.AR.push(st.AR);
  else { axes.PA.push(st.PA); axes.MA.push(st.MA); axes.TI.push(st.TI); axes.FO.push(st.FO); }
}
const moy = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
console.log('Les quatre nombres (1 à 6), sur tous les joueurs alignés :');
for (const [k, a] of Object.entries(axes)) {
  const h = [1, 2, 3, 4, 5, 6].map(n => a.filter(x => x === n).length);
  console.log(`  ${k}  moyenne ${moy(a).toFixed(2)}   répartition ${h.map((n, i) => `${i + 1}:${(100 * n / a.length).toFixed(0)}%`).join(' ')}`);
}

/* ---------- le gabarit et le tir signature ---------- */
{
  const gab = [0, 0, 0], tir = {};
  for (const c of clubs) for (const p of Object.values(c.roster)) {
    if (p.p === 'G') continue;
    const st = statsDeTable(p);
    gab[st.gb]++;
    tir[st.ts] = (tir[st.ts] || 0) + 1;
  }
  const n = gab[0] + gab[1] + gab[2];
  console.log('\nLe gabarit (rang dans la saison) et le tir signature :');
  console.log(`  ${[0, 1, 2].map(i => `${GABARITS[i].icon} ${GABARITS[i].nom} ${(100 * gab[i] / n).toFixed(0)} %`).join('   ')}`);
  console.log(`  ${Object.entries(tir).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${TIRS[k].icon} ${TIRS[k].nom} ${(100 * v / n).toFixed(0)} %`).join('   ')}`);
}

/* ---------- les matchs ---------- */
const tire = (n) => clubs[Math.floor(Math.random() * n)];
let buts = 0, tirs = 0, nuls3 = 0, prolongations = 0, n = 0, garde = 0;
let echecs = 0, vols = 0, revirements = 0;
const mods = [];
const pointages = new Map();

for (let i = 0; i < MATCHS; i++) {
  const a = clubs[Math.floor(Math.random() * clubs.length)];
  const b = clubs[Math.floor(Math.random() * clubs.length)];
  const A = equipeDeTable(a.nom, a.tag, a.roster, 'A');
  const B = equipeDeTable(b.nom, b.tag, b.roster, 'B');
  const m = nouveauMatch(A, B, `t${i}`);
  let presences = 0;
  while (!m.fini && presences++ < 200) { if (m.periode === PERIODES + 1 && !m.prolongation) break; iaPresence(m); }
  const r = resultatDe(m);
  if (m.prolongation) prolongations++;
  buts += r.gfA + r.gfB; tirs += r.A.tirs + r.B.tirs; n += 2;
  echecs += r.A.echecs + r.B.echecs;
  revirements += r.A.revirements + r.B.revirements;
  for (const f of [r.A, r.B]) for (const l of (f.physique || [])) vols += l.vols;
  for (const f of [r.A, r.B]) for (const v of f.modsTir) mods.push(v.mod);
  const cle = `${Math.max(r.gfA, r.gfB)}-${Math.min(r.gfA, r.gfB)}`;
  pointages.set(cle, (pointages.get(cle) || 0) + 1);
}
/* ---------- les égalités de la feuille ----------
   La même exigence que `check_feuilles.mjs` sur le moteur par événements : la
   feuille d'un match sur table doit se refermer sur elle-même, par
   construction et jamais par un ajustement après coup. C'est cette
   vérification qui a trouvé que `poser()` effaçait les compteurs d'un joueur
   à chaque mise au jeu. */
{
  /*
   * DÉTERMINISTE, et ce n'est pas un détail : la première version tirait ses
   * clubs avec `Math.random`, donc elle passait quatorze fois et rougissait
   * la quinzième — sur `main`, une fois. Une vérification d'égalité qui
   * dépend du tirage n'est pas une vérification, c'est une loterie. Les
   * clubs sont maintenant pris à pas fixe dans la liste triée.
   */
  const casses = [];
  for (let i = 0; i < 120; i++) {
    const a = clubs[(i * 37) % clubs.length];
    const b = clubs[(i * 91 + 13) % clubs.length];
    const r = jouerMatchAuto(equipeDeTable(a.nom, a.tag, a.roster, 'A'), equipeDeTable(b.nom, b.tag, b.roster, 'B'), `e${i}`);
    const somme = f => f.marqueurs.reduce((x, y) => x + y.buts, 0);
    if (somme(r.A) !== r.gfA) casses.push(`match ${i} : les buts des joueurs (${somme(r.A)}) ne font pas ceux de l'équipe (${r.gfA})`);
    if (somme(r.B) !== r.gfB) casses.push(`match ${i} : idem de l'autre bord`);
    if (r.A.gardien.alloues !== r.gfB) casses.push(`match ${i} : le gardien A a alloué ${r.A.gardien.alloues} pour ${r.gfB} buts`);
    if (r.B.gardien.alloues !== r.gfA) casses.push(`match ${i} : le gardien B a alloué ${r.B.gardien.alloues} pour ${r.gfA} buts`);
    if (r.A.gardien.arrets + r.A.gardien.alloues !== r.B.tirs) casses.push(`match ${i} : les lancers de B (${r.B.tirs}) ne font pas les arrêts + buts du gardien A (${r.A.gardien.arrets + r.A.gardien.alloues})`);
    if (r.B.gardien.arrets + r.B.gardien.alloues !== r.A.tirs) casses.push(`match ${i} : idem de l'autre bord`);
    /*
     * LES PASSES. Première version, et elle était fausse : elle comparait les
     * passes d'un joueur à `ses buts + 2 fois le nombre de marqueurs`, un
     * seuil inventé qui ne veut rien dire — un fabricant de jeu sur une
     * équipe qui marque six fois le dépassait sans qu'aucune règle ne soit
     * cassée, et l'Action est tombée là-dessus sur `main`.
     *
     * La VRAIE égalité est exacte, et elle vient du moteur : un but crédite
     * au plus UNE passe (`appliquerTir` : `piece.derniere`, s'il y en a une).
     * Donc les passes d'une équipe ne peuvent jamais dépasser ses buts.
     */
    for (const [f, gf] of [[r.A, r.gfA], [r.B, r.gfB]]) {
      const pa = f.marqueurs.reduce((x, y) => x + y.passes, 0);
      if (pa > gf) casses.push(`match ${i} : ${pa} passes pour ${gf} buts (un but en crédite au plus une)`);
    }
  }
  console.log(`\nLes égalités de la feuille, sur 120 matchs :`);
  if (casses.length) { console.log(`  ÉCHEC — ${casses.length} :\n    ${casses.slice(0, 5).join('\n    ')}`); process.exitCode = 1; }
  else console.log('  buts des joueurs = buts de l\'équipe · buts alloués = buts de l\'autre · lancers = arrêts + buts · passes ≤ buts ✓');
}

console.log(`\n${MATCHS} matchs :`);
console.log(`  buts par équipe par match   ${(buts / n).toFixed(2)}   (cible arcade : 5 à 6)`);
console.log(`  tirs par équipe par match   ${(tirs / n).toFixed(2)}`);
console.log(`  mises en échec              ${(echecs / n).toFixed(2)} par équipe par match`);
console.log(`  vols de rondelle            ${(vols / n).toFixed(2)} par équipe par match`);
console.log(`  revirements                 ${(revirements / n).toFixed(2)} par équipe par match`);
{
  const moy = mods.reduce((a, b) => a + b, 0) / Math.max(1, mods.length);
  const h = {};
  for (const v of mods) { const k = Math.max(-3, Math.min(3, v)); h[k] = (h[k] || 0) + 1; }
  console.log(`  qualité des tirs tentés     modificateur moyen ${moy.toFixed(2)}   ${Object.entries(h).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${(100 * v / mods.length).toFixed(0)}%`).join(' ')}`);
}
console.log(`  prolongation                ${(100 * prolongations / MATCHS).toFixed(1)} %   (la vraie ligue : ~23 %)`);
const top = [...pointages.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6);
console.log(`  pointages les plus fréquents  ${top.map(([k, v]) => `${k} (${(100 * v / MATCHS).toFixed(0)}%)`).join(', ')}`);

/* ---------- les gestes par présence : la vitesse du jeu ---------- */
{
  let gestes = 0, presences = 0;
  for (let i = 0; i < 40; i++) {
    const a = clubs[Math.floor(Math.random() * clubs.length)];
    const b = clubs[Math.floor(Math.random() * clubs.length)];
    const m = nouveauMatch(equipeDeTable(a.nom, a.tag, a.roster, 'A'), equipeDeTable(b.nom, b.tag, b.roster, 'B'), `g${i}`);
    let garde2 = 0;
    while (!m.fini && garde2++ < 200) { gestes += iaPresence(m).length; presences++; }
  }
  console.log(`  gestes par présence         ${(gestes / presences).toFixed(2)}   (cible : 4 à 6)`);
}

/* ---------- la fatigue : est-ce qu'elle mord, et combien ---------- */
{
  let essouffles = 0, mesures = 0;
  for (let i = 0; i < 24; i++) {
    const a = clubs[Math.floor(Math.random() * clubs.length)];
    const b = clubs[Math.floor(Math.random() * clubs.length)];
    const m = nouveauMatch(equipeDeTable(a.nom, a.tag, a.roster, 'A'), equipeDeTable(b.nom, b.tag, b.roster, 'B'), `f${i}`);
    let g = 0;
    while (!m.fini && g++ < 200) {
      for (const x of surLaGlace(m)) { mesures++; if (essouffle(m, x)) essouffles++; }
      iaPresence(m);
    }
  }
  console.log(`  pièces essoufflées          ${(100 * essouffles / mesures).toFixed(1)} % des présences`);
}

/* ---------- la monotonie, en petit : le fort bat-il le faible ? ----------
   PREMIÈRE VERSION, ET ELLE MENTAIT : elle prenait UN club par décile et
   jouait cent fois le même duel. Le résultat dépendait donc du club tiré, pas
   du décile — d'où des lectures intransitives (le 1er battait le 5e plus
   souvent que le 10e). On tire maintenant plusieurs clubs par décile et on
   joue tout le monde contre tout le monde. */
const PAR_DECILE = Number(process.env.PAR_DECILE ?? 10);
const decile = i => {
  const bas = Math.floor(i * clubs.length / 10);
  const haut = Math.floor((i + 1) * clubs.length / 10);
  const pas = Math.max(1, Math.floor((haut - bas) / PAR_DECILE));
  const out = [];
  for (let k = bas; k < haut && out.length < PAR_DECILE; k += pas) out.push(clubs[k]);
  return out;
};

console.log(`\nLe fort contre le faible (${PAR_DECILE} clubs par décile, tout le monde contre tout le monde, aller-retour) :`);
for (const [ia, ib, mot] of [[0, 9, 'le 1er décile contre le 10e'], [0, 4, 'le 1er contre le 5e'], [4, 9, 'le 5e contre le 10e'], [2, 2, 'deux équipes du 3e décile']]) {
  const A = decile(ia), B = decile(ib);
  let v = 0, bu = 0, n = 0;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
    if (ia === ib && i === j) continue;
    for (const inverse of [false, true]) {
      const a = A[i], b = B[j];
      const eqA = equipeDeTable(a.nom, a.tag, a.roster, inverse ? 'B' : 'A');
      const eqB = equipeDeTable(b.nom, b.tag, b.roster, inverse ? 'A' : 'B');
      const r = jouerMatchAuto(inverse ? eqB : eqA, inverse ? eqA : eqB, `p${ia}${ib}${i}${j}${inverse}`);
      const butsA = inverse ? r.gfB : r.gfA, butsB = inverse ? r.gfA : r.gfB;
      if (butsA > butsB) v++;
      bu += butsA - butsB;
      n++;
    }
  }
  console.log(`  ${mot.padEnd(32)} ${(100 * v / n).toFixed(0)} victoires sur 100 (${n} matchs), différentiel ${(bu / n).toFixed(2)} par match`);
}
