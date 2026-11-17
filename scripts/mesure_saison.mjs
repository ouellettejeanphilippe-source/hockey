/*
 * LA SAISON DE 82 SOIRS, MESURÉE AVANT D'ÊTRE CODÉE (V30, tranche 0 ; docs/refonte-v30.md § 3.3, § 12).
 *
 * JP, 16 nov. 2026 : chaque soir, tes lignes et ton gardien, *mais faire que ça a un impact*. Les systèmes de ligne de la
 * V18 sont morts « dans le bruit » : avant une seule ligne de jeu, on mesure ce que ce choix pèse, en points sur 82.
 *
 * Un club de 23 repêché dans des clubs faibles (la bande `BANDE`, 4 M$ d'espace gardé), posé dans une vraie ligue de 32
 * (`creerLigue`, `jouerJournee` : la cédule, les dos-à-dos, les jambes, les blessures, rien de simulé d'avance). Quatre
 * directeurs jouent la même ligue, la même graine :
 *
 *   « borne »    le pire soir après soir : le partant devant le filet tous les soirs, les lignes jamais touchées ;
 *   « auto »     ne touche à rien : le moteur fait tourner les gardiens comme un club de l'IA ;
 *   « gardien »  choisit son gardien chaque soir (l'auxiliaire quand le partant s'userait, ou le second soir d'un
 *                dos-à-dos), les lignes jamais touchées ;
 *   « dg »       le gardien de même, et il assoit un patineur aux jambes lourdes quand un réserviste frais vaut mieux ce soir.
 *
 * Deux critères (jugés à 64 graines ou plus), un par geste, en paires, au-delà de deux écarts-types : « gardien » fait
 * plus de points que « borne » ; « dg » fait plus de points que « gardien ». Ce qui s'imprime sans se juger : chaque
 * directeur contre « auto », le rang final, la part des soirs où un geste est posé.
 * Mesuré le 17 nov. 2026 sur 64 graines : le gardien, +5,4 points sur « borne » mais +1,1 ±1,2 sur « auto » (la rotation
 * du moteur fait déjà presque aussi bien) ; asseoir les jambes lourdes, −2,4 ±0,8 (rouge : ce geste-là coûte).
 * Les dés d'un soir sont un seul flux pour toute la ligue : un geste décale les matchs des autres, les paires ne
 * partagent donc que la ligue et le club, pas les dés (le bruit est celui de deux saisons).
 *
 *   node scripts/mesure_saison.mjs                  `GRAINES` graines (64), `FILS` processus (3)
 *   GRAINES=6 FILS=2 node scripts/mesure_saison.mjs l'essai court : rien ne se juge
 * Mesure seulement : jamais lu par le jeu.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, CAP, creerLigue, jouerJournee, bilanLigue, createTeam, trioAuMieux, fits, getPersonKey, getHiddenRatings,
  remettreAZero, energieDe, facteurEnergie, jambesGardien, dosADos,
} from '../js/sim.js';
import { groupeDuJoueur as groupeDe } from '../js/niveaux.js';
import { PIECE_DU_COACH } from '../js/pieces.js';
import { RUN, creerLaRun, prixDe } from '../js/run.js';
import { hache } from '../js/util.js';
import { DONNEES } from './lib/run_robot.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ICI = fileURLToPath(import.meta.url);
const GRAINES = Number(process.env.GRAINES ?? 64), FILS = Math.max(1, Number(process.env.FILS ?? 3)), G0 = Number(process.env.GRAINE0 ?? 0);
const DIRECTEURS = (process.env.DIRECTEURS || 'borne,auto,gardien,dg').split(',');
/* Le repêchage : la bande de force des vestiaires, en rang centile (JP, 16 nov. : des clubs faibles), l'espace gardé. */
const BANDE = [0.2, 0.6], PLANCHER = 800_000, PART = 2.5;
/* « dg » assoit un patineur sous `LOURD` de jambes si un réserviste vaut mieux ce soir. */
const LOURD = Number(process.env.LOURD ?? 85);
const v = p => getHiddenRatings(p).v;
const COACHS = Object.keys(PIECE_DU_COACH);
const CASES = SLOTS.filter(s => !s.extra);

/* ---------- le club repêché ---------- */
function repecher(S, g) {
  const vestiaires = S.clubs.filter(c => c.rang >= BANDE[0] && c.rang <= BANDE[1]);
  const pris = new Set(), joueurs = [];
  let reste = CAP - RUN.ESPACE;
  // Les cases qui jouent d'abord : le budget va aux habillés, les réservistes prennent ce qui reste.
  const ordre = [...CASES.filter(s => !s.scratch), ...CASES.filter(s => s.scratch)];
  const prendre = p => { pris.add(getPersonKey(p)); reste -= prixDe(S, p); const q = { ...p }; remettreAZero(q); joueurs.push(q); };
  ordre.forEach((s, k) => {
    // Jamais plus que `PART` fois sa part de ce qui reste : les premières cases ne vident pas la caisse.
    const aVenir = ordre.length - k - 1, max = Math.min(reste - PLANCHER * aVenir, PART * reste / (aVenir + 1));
    const libres = club => club.pool.filter(x => fits(x, s) && !pris.has(getPersonKey(x)));
    for (let essai = 0; essai < 40; essai++) {
      const club = vestiaires[Math.floor(hache(g, 'vestiaire', k, essai) * vestiaires.length)];
      const p = libres(club).filter(x => prixDe(S, x) <= max).sort((a, b) => v(b) - v(a))[0];
      if (p) return prendre(p);
    }
    // Rien qui tienne dans quarante vestiaires : le moins cher de la bande, à cette case.
    const p = vestiaires.flatMap(libres).sort((a, b) => prixDe(S, a) - prixDe(S, b) || v(b) - v(a))[0];
    if (!p) throw new Error(`repêchage : aucune carte pour la case ${s.i} (graine ${g})`);
    prendre(p);
  });
  return { joueurs, masse: CAP - RUN.ESPACE - reste };
}
/* Les 31 autres : un club par franchise, tirés de tout le monde de la run. */
function ligueDe(S, g) {
  const vus = new Set(), clubs = [];
  for (let k = 0; clubs.length < 31 && k < 4000; k++) {
    const c = S.clubs[Math.floor(hache(g, 'ligue', k) * S.clubs.length)];
    if (vus.has(c.t)) continue;
    vus.add(c.t); clubs.push(c);
  }
  return clubs;
}

/* ---------- les gestes du soir ---------- */
const gardiens = t => CASES.filter(s => s.group === 'G').map(s => t.roster[s.i]).filter(p => p && !t.injured.has(p));
function choisirLeFilet(t, jour) {
  const [partant, aux] = gardiens(t).sort((a, b) => v(b) - v(a));
  if (!partant || !aux) { t._filetMatch = 'partant'; return false; }
  // L'auxiliaire quand un départ de plus userait le partant, ou le second soir d'un dos-à-dos.
  const use = jambesGardien({ ...partant, _suite: (partant._suite || 0) + 1 }) < 100 || dosADos(t, jour);
  t._filetMatch = use ? 'aux' : 'partant';
  return use;
}
function asseoirLesLourds(t) {
  let gestes = 0;
  const ceSoir = p => v(p) * facteurEnergie(p);
  for (const r of CASES.filter(s => s.scratch)) {
    const res = t.roster[r.i];
    if (!res || t.injured.has(res) || groupeDe(res) === 'G') continue;
    const cible = CASES.filter(s => !s.scratch && s.group !== 'G' && t.roster[s.i] && !t.injured.has(t.roster[s.i])
      && fits(res, s) && fits(t.roster[s.i], r) && energieDe(t.roster[s.i]) < LOURD && ceSoir(res) > ceSoir(t.roster[s.i]))
      .sort((a, b) => ceSoir(t.roster[a.i]) - ceSoir(t.roster[b.i]))[0];
    if (!cible) continue;
    [t.roster[r.i], t.roster[cible.i]] = [t.roster[cible.i], res];
    gestes++;
  }
  return gestes;
}

/* ---------- une saison ---------- */
function jouerLaSaison(directeur, graine) {
  const g = `v30:${graine}`;
  const S = creerLaRun(DONNEES, { graine: g, coach: { cle: COACHS[graine % COACHS.length] } });
  const { joueurs, masse } = repecher(S, g);
  const toi = createTeam('Ton club', 'YOU', trioAuMieux(joueurs), { isPlayer: true });
  const L = creerLigue([toi, ...ligueDe(S, g).map(c => c.team)], 82, { graine: g });
  let soirs = 0, gestes = 0;
  while (!L.fini) {
    const joue = L.calendrier[L.jour].some(m => m.A === toi || m.B === toi);
    if (joue) {
      soirs++;
      if (directeur === 'borne') toi._filetMatch = 'partant';
      if (directeur === 'gardien' || directeur === 'dg') { if (choisirLeFilet(toi, L.jour)) gestes++; }
      if (directeur === 'dg' && asseoirLesLourds(toi)) gestes++;
    }
    jouerJournee(L);
  }
  const rang = bilanLigue(L).standings.indexOf(toi) + 1;
  return { directeur, graine, pts: toi.PTS, rang, gf: toi.GF, ga: toi.GA, soirs, gestes, masse };
}

/* ---------- un bras ---------- */
if (process.env.BRAS) {
  const k = Number(process.env.BRAS);
  for (let i = k; i < GRAINES; i += FILS) for (const d of DIRECTEURS) console.log(JSON.stringify(jouerLaSaison(d, G0 + i)));
  process.exit(0);
}

/* ---------- le juge ---------- */
const lancer = k => new Promise((ok, non) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, BRAS: String(k) }, stdio: ['ignore', 'pipe', 'inherit'] });
  let s = '';
  p.stdout.on('data', d => { s += d; });
  p.on('close', c => (c ? non(new Error(`bras ${k} : code ${c}`)) : ok(s.trim().split('\n').filter(Boolean).map(x => JSON.parse(x)))));
});
const t0 = Date.now();
const runs = (await Promise.all(Array.from({ length: Math.min(FILS, GRAINES) }, (_, k) => lancer(k)))).flat();
const de = d => runs.filter(r => r.directeur === d).sort((a, b) => a.graine - b.graine);
const moy = l => l.reduce((a, x) => a + x, 0) / (l.length || 1);
const ecart = l => { const m = moy(l); return Math.sqrt(moy(l.map(x => (x - m) ** 2)) * l.length / Math.max(1, l.length - 1)); };
const un = x => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
/* L'écart moyen en paires (la même graine), et son erreur type. */
function paires(a, b) {
  const A = de(a), B = new Map(de(b).map(r => [r.graine, r]));
  const d = A.filter(r => B.has(r.graine)).map(r => r.pts - B.get(r.graine).pts);
  return { n: d.length, m: moy(d), se: ecart(d) / Math.sqrt(d.length || 1) };
}
for (const d of DIRECTEURS) {
  const l = de(d);
  informer(`« ${d} »`, `${un(moy(l.map(r => r.pts)))} points (écart-type ${un(ecart(l.map(r => r.pts)))}), rang ${un(moy(l.map(r => r.rang)))} sur 32, dans les 16 premiers ${Math.round(100 * moy(l.map(r => (r.rang <= 16 ? 1 : 0))))} % ; ${un(moy(l.map(r => r.gf)))} buts pour, ${un(moy(l.map(r => r.ga)))} contre ; un geste ${Math.round(100 * moy(l.map(r => r.gestes / r.soirs)))} % des soirs`);
}
const dit = (a, b) => { const p = paires(a, b); return `${p.m >= 0 ? '+' : ''}${un(p.m)} points sur 82 (erreur type ±${un(p.se)}, ${p.n} paires)`; };
for (const d of DIRECTEURS.filter(x => x !== 'auto' && DIRECTEURS.includes('auto'))) informer(`« ${d} » contre « auto »`, dit(d, 'auto'));
/* Deux critères, un par geste : jugés ensemble (« dg » contre « borne »), le gardien cachait les lignes (17 nov. 2026). */
const juger = (nom, a, b) => {
  if (!DIRECTEURS.includes(a) || !DIRECTEURS.includes(b)) return;
  const p = paires(a, b);
  if (GRAINES >= 64) exiger(`${nom}, au-delà de deux écarts-types`, p.m > 2 * p.se, dit(a, b));
  else informer(`${nom} (jugé à 64 graines ou plus)`, dit(a, b));
};
juger('Choisir son gardien paie : « gardien » fait plus de points que « borne »', 'gardien', 'borne');
juger('Régler ses lignes paie : « dg » fait plus de points que « gardien »', 'dg', 'gardien');
informer('La mesure', `${runs.length} saisons, ${Math.round((Date.now() - t0) / 1000)} s ; masse moyenne du repêchage ${un(moy(runs.map(r => r.masse)) / 1e6)} M$`);
verdict('La saison de 82 soirs : les lignes et le gardien pèsent-ils ?');
