/*
 * Étape 3 de MOTEUR.md : la suppression de lancers se dérive-t-elle de
 * l'ALIGNEMENT ?
 *
 * La maquette du moteur (scripts/mock_moteur.mjs) triche sur un point : elle
 * lit les VRAIS lancers contre de chaque équipe. Le moteur, lui, n'aura que
 * les 18 patineurs et le gardien que le joueur a signés. S'il ne sait pas
 * déduire d'un alignement combien de lancers il concède, alors une brigade de
 * six défenseurs offensifs limite autant qu'une brigade défensive, et le choix
 * des défenseurs ne veut plus rien dire.
 *
 * Ce script mesure, saison par saison, la corrélation entre les lancers contre
 * réels d'une équipe et ce que son alignement laisse prévoir. Trois candidats,
 * du plus physique au plus douteux :
 *
 *   1. la POSSESSION   une équipe qui tire beaucoup passe moins de temps dans
 *                      sa zone. Le disque est à somme nulle.
 *   2. la BRIGADE      cote défensive `d`, pondérée par la part de glace de
 *                      chaque paire.
 *   3. les ATTAQUANTS  même chose sur les quatre trios (le repli défensif).
 *
 * Puis il ajuste un modèle log-linéaire sur les trois et regarde ce qui reste :
 * combien de l'écart réel entre la meilleure et la pire défensive de chaque
 * saison l'alignement explique-t-il vraiment ?
 *
 * Les trois pièges de mesure de MOTEUR.md section 8.3 sont refermés ici aussi :
 * échanges écartés des deux côtés avec correction par l'identité de ligue,
 * prorata sur les matchs réellement joués, agrégat des gardiens plutôt que le
 * seul partant.
 *
 *   node scripts/check_suppression.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');

/* Mêmes parts de temps de glace que js/sim.js et que la maquette. */
const POIDS_TRIO = [0.34, 0.28, 0.22, 0.16];
const POIDS_PAIRE = [0.40, 0.34, 0.26];

const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const ect = (a) => { const m = moy(a); return Math.sqrt(moy(a.map(x => (x - m) ** 2))); };
function pearson(xs, ys) {
  const mx = moy(xs), my = moy(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.max(1e-9, Math.sqrt(dx * dy));
}

/** Moindres carrés sur k prédicteurs + constante, par élimination de Gauss. */
function moindresCarres(X, y) {
  const n = X.length, k = X[0].length;
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) for (let r = 0; r < n; r++) A[i][j] += X[r][i] * X[r][j];
    for (let r = 0; r < n; r++) A[i][k] += X[r][i] * y[r];
  }
  for (let i = 0; i < k; i++) {
    let piv = i;
    for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    if (Math.abs(A[i][i]) < 1e-12) continue;
    for (let r = 0; r < k; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c <= k; c++) A[r][c] -= f * A[i][c];
    }
  }
  return A.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[i][0] === undefined ? row[k] / row[i] : row[k] / row[i]));
}

/** Cote défensive pondérée par la part de glace des unités. */
function coteUnites(joueurs, poids, taille) {
  let s = 0, w = 0;
  for (let u = 0; u < poids.length; u++) {
    const unite = joueurs.slice(u * taille, (u + 1) * taille);
    if (!unite.length) continue;
    s += poids[u] * moy(unite.map(p => p.d || 50));
    w += poids[u];
  }
  return w ? s / w : 50;
}

/* ---------- une saison ---------- */
/*
 * Les échanges, autrement. La maquette du moteur écartait les `x:1` des deux
 * côtés ; ici c'est impossible. Écarter un GARDIEN échangé retire d'un coup
 * tous les lancers contre de son équipe, et l'écart entre la meilleure et la
 * pire défensive explose à 185 % au lieu des 18 à 30 % mesurés. On répartit
 * donc les totaux d'un joueur également entre ses k équipes : faux dans le
 * détail, mais sans biais systématique, et ça garde chaque équipe complète.
 */
function poidsEchange(shard) {
  const k = new Map();
  for (const p of shard.players) k.set(p.id, (k.get(p.id) || 0) + 1);
  return (p) => 1 / Math.max(1, k.get(p.id) || 1);
}

function saisonDe(shard) {
  const w = poidsEchange(shard);
  const patineurs = shard.players.filter(p => p.p !== 'G');
  const gardiens = shard.players.filter(p => p.p === 'G');
  if (!patineurs.some(p => p.sh > 0) || !gardiens.some(g => g.sa > 0)) return null;

  const lancersContreLigue = gardiens.reduce((s, g) => s + w(g) * (g.sa || 0), 0);

  const matchsPar = {};
  for (const p of shard.players) matchsPar[p.t] = Math.max(matchsPar[p.t] || 0, p.gp || 0);
  const matchsLigue = Object.values(matchsPar).reduce((s, x) => s + x, 0);
  const lancersParMatchLigue = lancersContreLigue / Math.max(1, matchsLigue);

  const parEquipe = {};
  for (const p of shard.players) (parEquipe[p.t] = parEquipe[p.t] || []).push(p);

  const equipes = [];
  for (const [t, tous] of Object.entries(parEquipe)) {
    const prod = p => (p.pt || 0) / Math.max(1, p.gp);
    const F = tous.filter(p => p.p === 'F' && p.gp >= 10).sort((a, b) => prod(b) - prod(a)).slice(0, 12);
    const D = tous.filter(p => p.p === 'D' && p.gp >= 10).sort((a, b) => prod(b) - prod(a)).slice(0, 6);
    const G = tous.filter(p => p.p === 'G');
    if (F.length < 12 || D.length < 6 || !G.length) continue;

    const matchs = matchsPar[t] || 82;
    const patineursT = tous.filter(p => p.p !== 'G');
    const lancersPour = patineursT.reduce((s, p) => s + w(p) * (p.sh || 0), 0);
    const lancersContre = G.reduce((s, g) => s + w(g) * (g.sa || 0), 0);
    if (lancersContre <= 0) continue;

    // % d'arrêts d'équipe, pondéré par les lancers (pas celui du seul partant),
    // et buts alloués qui en découlent : tout lancer est un but ou un arrêt.
    const saT = G.reduce((s2, g) => s2 + w(g) * (g.sa || 0), 0);
    const svEquipe = G.reduce((s2, g) => s2 + w(g) * (g.sa || 0) * (g.sv || 0), 0) / Math.max(1, saT);
    const butsContre = lancersContre * (1 - svEquipe);

    equipes.push({
      t,
      pression: (lancersPour / matchs) / lancersParMatchLigue,
      suppression: (lancersContre / matchs) / lancersParMatchLigue,
      // ce que l'alignement, lui, donne à voir
      brigade: coteUnites(D, POIDS_PAIRE, 2),
      trios: coteUnites(F, POIDS_TRIO, 3),
      pm: patineursT.reduce((s, p) => s + w(p) * (p.pm || 0), 0) / matchs,
      sv: svEquipe,
      gardiens: G,
      butsContre: butsContre / matchs,
    });
  }
  if (equipes.length < 6) return null;

  // Tout en écart à la saison : les cotes sont déjà relatives, mais la moyenne
  // d'une saison à 18 équipes n'est pas celle d'une saison à 32.
  const mb = moy(equipes.map(e => e.brigade)), sb = ect(equipes.map(e => e.brigade)) || 1;
  const mt = moy(equipes.map(e => e.trios)), st = ect(equipes.map(e => e.trios)) || 1;
  const mp = moy(equipes.map(e => e.pm)), sp = ect(equipes.map(e => e.pm)) || 1;
  for (const e of equipes) {
    e.zBrigade = (e.brigade - mb) / sb;
    e.zTrios = (e.trios - mt) / st;
    e.zPm = (e.pm - mp) / sp;
  }
  const mg = moy(equipes.map(e => e.butsContre));
  const ms = moy(equipes.map(e => e.sv));
  for (const e of equipes) {
    e.butsContreRel = e.butsContre / (mg || 1);   // 1 = la moyenne de sa saison
    e.svRel = e.sv - ms;                          // en écart d'arrêts
  }
  return { saison: shard.season, equipes };
}

/* ---------- mesure ---------- */
const saisons = [];
for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  const s = saisonDe(JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8')));
  if (s) saisons.push(s);
}
if (!saisons.length) {
  console.error('Aucune saison avec `sh` et `sa` — un build complet est requis.');
  process.exit(1);
}

const toutes = saisons.flatMap(s => s.equipes);

console.log(`\n${saisons.length} saisons, ${toutes.length} équipes-saisons\n`);

console.log('  CE QUE CHAQUE SIGNAL EXPLIQUE, SEUL');
console.log('  (corrélation avec les lancers contre réels, moyenne des saisons)\n');
const corrParSaison = (fn) => moy(saisons.map(s => pearson(s.equipes.map(fn), s.equipes.map(e => e.suppression))));
const signaux = [
  ['possession (lancers pour)', e => e.pression],
  ['brigade défensive (cote d)', e => e.zBrigade],
  ['quatre trios (cote d)', e => e.zTrios],
  ['+/- de l\'équipe', e => e.zPm],
];
for (const [nom, fn] of signaux) {
  console.log(`    ${nom.padEnd(30)} ${corrParSaison(fn).toFixed(3).padStart(7)}`);
}

/* Modèle log-linéaire sur les trois signaux de l'alignement. */
const X = toutes.map(e => [1, Math.log(Math.max(0.3, e.pression)), e.zBrigade, e.zTrios]);
const y = toutes.map(e => Math.log(e.suppression));
const b = moindresCarres(X, y);
const pred = X.map(x => Math.exp(x.reduce((s, v, i) => s + v * b[i], 0)));

console.log(`
  LE MODÈLE

    log(suppression) = ${b[0].toFixed(4)}
                     + ${b[1].toFixed(4)} × log(possession)
                     + ${b[2].toFixed(4)} × z(brigade)
                     + ${b[3].toFixed(4)} × z(trios)
`);

const rGlobal = pearson(pred, toutes.map(e => e.suppression));
const erreur = moy(toutes.map((e, i) => Math.abs(pred[i] - e.suppression) / e.suppression));
console.log(`    corrélation prédit / réel      ${rGlobal.toFixed(3)}`);
console.log(`    erreur moyenne par équipe      ${(100 * erreur).toFixed(1)} %`);
console.log(`    écart-type réel                ${(100 * ect(toutes.map(e => e.suppression))).toFixed(1)} %`);
console.log(`    écart-type reproduit           ${(100 * ect(pred)).toFixed(1)} %`);

/* L'écart entre la meilleure et la pire défensive, saison par saison : le
 * nombre que MOTEUR.md section 1 donne comme cible (18 à 30 %). */
let i0 = 0;
const amplitudes = [];
for (const s of saisons) {
  const p = pred.slice(i0, i0 + s.equipes.length);
  i0 += s.equipes.length;
  const reel = s.equipes.map(e => e.suppression);
  amplitudes.push({
    saison: s.saison,
    reelle: 100 * (Math.max(...reel) / Math.min(...reel) - 1),
    predite: 100 * (Math.max(...p) / Math.min(...p) - 1),
    r: pearson(p, reel),
  });
}
console.log('\n  ÉCART ENTRE LA MEILLEURE ET LA PIRE DÉFENSIVE\n');
console.log('    saison      réel    prédit    corrélation');
for (const a of amplitudes.filter((_, i) => i % 6 === 0 || i === amplitudes.length - 1)) {
  console.log(`    ${a.saison}   ${a.reelle.toFixed(0).padStart(4)} %  ${a.predite.toFixed(0).padStart(6)} %   ${a.r.toFixed(3).padStart(10)}`);
}
console.log(`\n    moyenne des 55 saisons : réel ${moy(amplitudes.map(a => a.reelle)).toFixed(0)} %, `
  + `prédit ${moy(amplitudes.map(a => a.predite)).toFixed(0)} %, corrélation ${moy(amplitudes.map(a => a.r)).toFixed(3)}\n`);

/* ---------- où passe vraiment la défensive ---------- */
/*
 * Si l'alignement ne prédit pas le VOLUME de lancers concédés, la question
 * suivante est : prédit-il les BUTS concédés ? Un but alloué se décompose
 * exactement en deux facteurs, sans reste :
 *
 *     buts contre = lancers contre × (1 − % d'arrêts)
 *
 * Le premier facteur est le volume, le second est le gardien (et la qualité
 * des chances qu'on lui laisse). Savoir lequel des deux l'alignement touche
 * décide par où le moteur doit faire passer la défensive.
 */
console.log('  OÙ PASSE LA DÉFENSIVE : VOLUME OU QUALITÉ ?\n');
console.log('    (corrélation moyenne par saison)\n');
const corrAvec = (fx, fy) => moy(saisons.map(s => pearson(s.equipes.map(fx), s.equipes.map(fy))));
const cibles = [
  ['lancers contre', e => e.suppression],
  ['% d\'arrêts', e => e.svRel],
  ['buts contre', e => e.butsContreRel],
];
console.log('    signal                          ' + cibles.map(c => c[0].padStart(16)).join(''));
for (const [nom, fn] of signaux) {
  console.log('    ' + nom.padEnd(30) + cibles.map(c => corrAvec(fn, c[1]).toFixed(3).padStart(16)).join(''));
}
const decomp = [
  ['lancers contre → buts contre', e => e.suppression, e => e.butsContreRel],
  ['% d\'arrêts → buts contre', e => e.svRel, e => e.butsContreRel],
];
console.log('');
for (const [nom, fx, fy] of decomp) {
  console.log('    ' + nom.padEnd(30) + corrAvec(fx, fy).toFixed(3).padStart(16));
}
console.log('');

/* ---------- le test qui débusque la circularité ---------- */
/*
 * La corrélation ci-dessus est suspecte : la cote `d` est bâtie sur le +/-,
 * et le +/- d'un patineur dépend des buts que SON gardien a alloués. Un bon
 * gardien gonfle donc la cote défensive de tout son vestiaire, et on
 * retrouverait la corrélation même si les patineurs ne défendaient pas du
 * tout. Deux indices que le doute est fondé : la brigade (0,45) et les quatre
 * trios (0,45) prédisent le % d'arrêts EXACTEMENT aussi bien, alors qu'un
 * vrai signal défensif devrait pencher du côté des défenseurs.
 *
 * Le test qui tranche : le même gardien, d'une saison à l'autre. On compare
 * son % d'arrêts d'une saison à SA PROPRE moyenne de carrière, corrigée de
 * l'époque. Si l'alignement devant lui explique cet écart-là, la défensive
 * est réelle ; si elle ne l'explique pas, la corrélation d'en haut n'était
 * que le gardien qui se regardait dans le miroir.
 */
const carriere = new Map();   // id -> [écarts à la ligue, saison par saison]
for (const s of saisons) {
  const svLigue = moy(s.equipes.map(e => e.sv));
  for (const e of s.equipes) {
    for (const g of e.gardiens) {
      if ((g.gp || 0) < 20) continue;
      const acc = carriere.get(g.id) || [];
      acc.push({ ecart: (g.sv || 0) - svLigue, saison: s.saison, equipe: e });
      carriere.set(g.id, acc);
    }
  }
}
const xs = [], ysB = [], ysT = [];
for (const [, saisonsDuGardien] of carriere) {
  if (saisonsDuGardien.length < 3) continue;
  const base = moy(saisonsDuGardien.map(x => x.ecart));
  for (const x of saisonsDuGardien) {
    xs.push(x.ecart - base);          // au-dessus ou en dessous de lui-même
    ysB.push(x.equipe.zBrigade);
    ysT.push(x.equipe.zTrios);
  }
}
console.log('  LE MÊME GARDIEN, D\'UNE ÉQUIPE À L\'AUTRE\n');
console.log(`    ${xs.length} saisons de gardiens, ${[...carriere.values()].filter(v => v.length >= 3).length} gardiens à 3 saisons et plus\n`);
console.log(`    brigade défensive → écart du gardien à lui-même   ${pearson(ysB, xs).toFixed(3).padStart(7)}`);
console.log(`    quatre trios      → écart du gardien à lui-même   ${pearson(ysT, xs).toFixed(3).padStart(7)}`);
console.log('');

/* ---------- les constantes que le moteur doit porter ---------- */
/*
 * Deux canaux, et un seul des deux mérite un curseur d'alignement.
 *
 *   VOLUME   lancers concédés. L'alignement n'en explique presque rien
 *            (corrélation 0,21, écart reproduit 8 % contre 56 % de réel).
 *            Ce qui reste tient à la possession, pas à la brigade.
 *   QUALITÉ  probabilité qu'un lancer devienne un but. C'est là que le
 *            signal survit au contrôle par l'identité du gardien.
 */
const zDef = xs.map((_, i) => 0.5 * (ysB[i] + ysT[i]));
const mzd = moy(zDef), mx = moy(xs);
let num = 0, den = 0;
for (let i = 0; i < xs.length; i++) { num += (zDef[i] - mzd) * (xs[i] - mx); den += (zDef[i] - mzd) ** 2; }
const penteArrets = num / Math.max(1e-9, den);   // points d'arrêts par écart-type d'alignement

/* La borne haute : la même pente, SANS contrôler l'identité du gardien. Elle
 * contient le gardien qui gonfle son vestiaire, donc elle surestime ; la pente
 * contrôlée ci-dessus contient l'équipe qui suit le gardien d'un club à
 * l'autre, donc elle sous-estime. Le vrai chiffre est entre les deux. */
const zdBrut = [], svBrut = [];
for (const s of saisons) for (const e of s.equipes) { zdBrut.push(0.5 * (e.zBrigade + e.zTrios)); svBrut.push(e.svRel); }
const mzb = moy(zdBrut), msb = moy(svBrut);
let n2 = 0, d2 = 0;
for (let i = 0; i < zdBrut.length; i++) { n2 += (zdBrut[i] - mzb) * (svBrut[i] - msb); d2 += (zdBrut[i] - mzb) ** 2; }
const penteBrute = n2 / Math.max(1e-9, d2);

const svMoyenne = moy(saisons.flatMap(s => s.equipes.map(e => e.sv)));
const kDefense = penteArrets / Math.max(1e-6, 1 - svMoyenne);

console.log('  CONSTANTES POUR LE MOTEUR\n');
console.log(`    VOLUME    lancers = base × possession^${(-b[1]).toFixed(3)}`);
console.log('              la brigade n\'y entre pas : coefficient '
  + `${b[2].toFixed(4)}, soit ${(100 * Math.abs(b[2])).toFixed(1)} % par écart-type.\n`);
console.log(`    QUALITÉ   un écart-type d'alignement défensif vaut `
  + `${(1000 * penteArrets).toFixed(1)} millièmes d'arrêts,`);
console.log(`              soit un facteur ${(1 - kDefense).toFixed(3)} sur la probabilité qu'un`);
console.log('              lancer devienne un but.\n');
console.log(`              Borne haute, sans contrôler le gardien : `
  + `${(1000 * penteBrute).toFixed(1)} millièmes, facteur ${(1 - penteBrute / (1 - svMoyenne)).toFixed(3)}.`);
console.log('              Le vrai chiffre est entre les deux — la borne basse efface\n'
  + '              l\'équipe qui suit son gardien, la haute contient le gardien\n'
  + '              qui gonfle son vestiaire.\n');
console.log(`              P(but) = %tir_du_tireur × facteur_gardien × (1 − K × z_def_adverse)`);
console.log(`              avec K entre ${kDefense.toFixed(3)} et ${(penteBrute / (1 - svMoyenne)).toFixed(3)}\n`);
