/*
 * CAP 82, LE JEU PUR (1.0, Jalon K) — ce que rend une saison sans carte ni décision.
 *
 * JP : *Le mode CAP 82 devrait avoir le standard que tu fais juste voir un
 * résultat avec team, sans les stratégies, packs de cartes, etc*. Le moteur
 * n'y reçoit que l'alignement du repêchage (décision 0, `fermeture: 'auto'`,
 * les systèmes choisis par `lignesCalculees`) : ce script mesure ce qu'une
 * équipe bien ou mal bâtie en tire, sur N saisons sous graine, séries
 * comprises, à trois niveaux de repêchage :
 *
 *   - LE ROBOT « premier Signer » (scripts/check_robot.mjs) : la première carte
 *     permise du vestiaire, rangé comme à l'écran ;
 *   - LE CHIFFRE : ce que le test de fumée joue — parmi les cartes qui tiennent
 *     dans le budget du choix, une qui va à sa position naturelle, et le plus
 *     gros chiffre clé (points, victoires d'un gardien) ;
 *   - L'EXPERT : il lit les cotes cachées (ce qu'aucun joueur ne voit) et prend
 *     la plus grande valeur qui tient dans le budget, à sa position — le
 *     plafond de ce qu'un repêchage peut donner.
 *
 * Cibles : le robot ne gagne pas la Coupe (au plus 5 %) ; une équipe bien
 * bâtie (le chiffre) fait les séries au moins une fois sur deux ; même
 * l'expert ne fait pas 82-0 (au plus 1 %) : le 82-0 reste le Graal.
 *
 *   node scripts/check_cap82.mjs                 60 saisons par niveau
 *   SAISONS=200 FILS=6 node scripts/check_cap82.mjs
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  CASES_DE_BASE, CAP, fits, getPositionPenalty, getPersonKey, registerHiddenRatings, getHiddenRatings, unitesIdeales,
  createTeam, creerLigue, jouerJusqua, bilanLigue, creerSeries, jouerMatchSeries, photoAlignement, autoRoster,
} from '../js/sim.js';
import { SAISONS, shard, generateur, groupe } from './lib/rogue_sim.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const MIN_SAL = 775_000;                 // js/game.js `MIN_SAL` : le salaire plancher d'une case
const copie = p => ({ ...p });
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const points = p => (p.p === 'G' ? (p.w || 0) : (p.pt ?? ((p.g || 0) + (p.a || 0))));
const NIVEAUX = ['robot', 'chiffre', 'expert'];

/* Le vestiaire rangé comme à l'écran (js/game.js, vue « par poste ») : pour le robot, la première carte permise. */
const COLONNES = ['AG', 'C', 'AD', 'DG', 'DD', 'G'];
function colonneDe(p) {
  if (p.p === 'G') return 'G';
  if (groupe(p) === 'D') return (p.np === 'RD' || p.np === 'R' || p.p === 'RD') ? 'DD' : 'DG';
  return p.np === 'L' || p.np === 'AG' ? 'AG' : p.np === 'R' || p.np === 'AD' ? 'AD' : 'C';
}
const vestiaireAffiche = joueurs => COLONNES.flatMap(c => joueurs.filter(p => colonneDe(p) === c).sort((a, b) => points(b) - points(a)));
/*
 * LA CASE QUE L'ÉCRAN PROPOSE, et la zone : recopiés de js/game.js (`slotFitScore`, `zoneEcart`), qui touche
 * au DOM. Les réservistes en dernier ; sinon la position, puis l'écart à ses trios idéaux.
 */
function caseScore(p, s) {
  const pen = getPositionPenalty(p, s);
  if (s.scratch) return 1000 + pen * 40 + s.i;
  const ideal = unitesIdeales(p, getHiddenRatings(p).v);
  const dist = Math.min(...ideal.map(u => Math.abs(u - s.unit)));
  return pen * 40 + (dist === 0 ? 0 : 12 + dist * 6) + s.unit;
}
function horsZone(p, s) {
  if (s.scratch || s.group === 'G' || p.p === 'G') return false;
  const ideal = unitesIdeales(p, getHiddenRatings(p).v);
  return s.unit > Math.max(...ideal) || s.unit < Math.min(...ideal);
}
const chiffreCle = p => (p.p === 'G' ? Number(p.sv) || 0 : points(p));

/*
 * LE REPÊCHAGE D'UN NIVEAU. Chaque tour, la roulette sort une saison et un
 * club ; on signe UN joueur de ce vestiaire, ou on relance si rien ne tient
 * dans le budget du choix (le plafond restant moins le plancher des cases
 * qu'il restera à combler).
 */
function repecher(niveau, rnd) {
  const roster = {};
  const personnes = new Set();
  let masse = 0, roulettes = 0;
  const libres = () => CASES_DE_BASE.filter(s => !roster[s.i]);
  while (libres().length && roulettes < 600) {
    roulettes++;
    const e = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = Object.keys(e.byTeam);
    const tag = tags[Math.floor(rnd() * tags.length)];
    const maxPick = (CAP - masse) - Math.max(0, libres().length - 1) * MIN_SAL;
    const offres = [];
    for (const p of (niveau === 'robot' ? vestiaireAffiche(e.byTeam[tag]) : e.byTeam[tag])) {
      if (personnes.has(getPersonKey(p)) || !(p.$ > 0) || p.$ > maxPick) continue;
      const c = copie(p);
      registerHiddenRatings(c);
      // Le robot prend la case de sa position (`openSlots`) ; les deux autres, celle que l'écran propose (`slotFitScore`).
      const ouvertes = libres().filter(s => fits(c, s)).sort(niveau === 'robot'
        ? (a, b) => getPositionPenalty(c, a) - getPositionPenalty(c, b) || a.i - b.i
        : (a, b) => caseScore(c, a) - caseScore(c, b));
      if (!ouvertes.length) continue;
      const s = ouvertes[0];
      // « Propre » : ce que la carte dit en rouge à l'écran — hors position, ou hors de sa zone.
      offres.push({ c, s, propre: getPositionPenalty(c, s) === 0 && !horsZone(c, s) });
      if (niveau === 'robot') break;
    }
    if (!offres.length) continue;
    let pris = offres[0];
    // Le chiffre clé de la carte : les points d'un patineur, le % d'arrêts d'un gardien (« ,912 », que le test lit 0,912).
    if (niveau === 'chiffre') pris = offres.slice().sort((a, b) => b.propre - a.propre || chiffreCle(b.c) - chiffreCle(a.c))[0];
    if (niveau === 'expert') pris = offres.slice().sort((a, b) => b.propre - a.propre || getHiddenRatings(b.c).v - getHiddenRatings(a.c).v || a.c.$ - b.c.$)[0];
    const c = pris.c;
    roster[pris.s.i] = c;
    personnes.add(getPersonKey(c));
    masse += c.$;
  }
  return { roster, masse, roulettes, complet: !libres().length };
}

/* 31 vrais clubs, comme `buildOpponents` (le même tirage que scripts/check_robot.mjs). */
function adversaires(rnd, exclus, n = 31) {
  const out = [], vus = new Set();
  while (out.length < n) {
    const e = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = Object.keys(e.byTeam);
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${e.season}|${tag}`)) continue;
    const pool = e.byTeam[tag];
    if (pool.filter(p => groupe(p) === 'F').length < 12 || pool.filter(p => groupe(p) === 'D').length < 6 || pool.filter(p => p.p === 'G').length < 2) continue;
    vus.add(`${e.season}|${tag}`);
    const roster = autoRoster(pool.map(copie), exclus);
    for (const p of Object.values(roster)) exclus.add(getPersonKey(p));
    out.push(createTeam(`${tag} ${e.season}`, tag, roster, { season: e.season }));
  }
  return out;
}

/* UNE SAISON DE CAP 82 : l'alignement du repêchage, 82 matchs, les séries, et rien d'autre. */
function saison(niveau, n) {
  const rnd = generateur('cap82', niveau, n);
  const { roster, masse, roulettes, complet } = repecher(niveau, rnd);
  if (!complet) return { n, complet: false, roulettes };
  const exclus = new Set(Object.values(roster).map(getPersonKey));
  const you = createTeam('NHL Stars', 'YOU', roster, { isPlayer: true });
  const L = creerLigue([you, ...adversaires(rnd, exclus)], 82, { graine: `cap82:${niveau}:${n}`, decisions: [{ jour: 0, cases: photoAlignement(roster), fermeture: 'auto' }] });
  jouerJusqua(L, Infinity);
  const b = bilanLigue(L);
  const rang = b.standings.indexOf(you) + 1;
  const enSeries = Math.min(16, 2 ** Math.floor(Math.log2(Math.max(2, b.standings.length))));
  let rondes = 0, coupe = false;
  if (rang <= enSeries) {
    const S = creerSeries(b.standings.slice(0, enSeries), { ligue: L, graine: L.graine, decisions: [], equipes: L.teams });
    for (let garde = 0; !S.fini && garde < 200; garde++) jouerMatchSeries(S);
    rondes = S.toutes.filter(s => s.winner === you).length;
    coupe = S.champion === you;
  }
  return { n, complet: true, roulettes, masse, W: you.W, L: you.L, OTL: you.OTL, rang, series: rang <= enSeries, rondes, coupe };
}

if (!isMainThread) {
  const { niveau, de, a } = workerData;
  const out = [];
  for (let n = de; n < a; n++) out.push(saison(niveau, n));
  parentPort.postMessage(out);
} else {
  const N = Math.max(1, Number(process.env.SAISONS) || 60);
  const FILS = Math.max(1, Number(process.env.FILS) || Math.min(6, availableParallelism() - 1));
  const pct = x => `${(Math.round(1000 * x) / 10).toString().replace('.', ',')} %`;
  const t0 = Date.now();
  console.log(`\n  Cap 82, le jeu pur · ${N} saisons par niveau · ${FILS} travailleurs\n`);
  const lancer = data => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: data });
    w.once('message', resolve); w.once('error', reject);
  });
  const taille = Math.max(1, Math.ceil(N / FILS));
  const taches = [];
  for (const niveau of NIVEAUX) for (let de = 0; de < N; de += taille) taches.push({ niveau, de, a: Math.min(N, de + taille) });
  const resultats = new Array(taches.length);
  let suivante = 0;
  await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, async () => {
    while (suivante < taches.length) { const k = suivante++; resultats[k] = await lancer(taches[k]); }
  }));
  const par = Object.fromEntries(NIVEAUX.map(k => [k, []]));
  taches.forEach((t, k) => par[t.niveau].push(...resultats[k]));
  const lus = {};
  for (const niveau of NIVEAUX) {
    const rs = par[niveau], ok = rs.filter(r => r.complet);
    exiger(`${niveau} : chaque repêchage finit ses 23`, ok.length === rs.length, `${ok.length}/${rs.length}, ${moy(ok.map(r => r.roulettes)).toFixed(1)} roulettes`);
    const meilleur = ok.slice().sort((a, b) => b.W - a.W || a.L - b.L)[0];
    informer(`${niveau} : fiche moyenne`, `${moy(ok.map(r => r.W)).toFixed(1)}-${moy(ok.map(r => r.L)).toFixed(1)}-${moy(ok.map(r => r.OTL)).toFixed(1)} · rang ${moy(ok.map(r => r.rang)).toFixed(1)} · masse ${(moy(ok.map(r => r.masse)) / 1e6).toFixed(1)} M$`);
    informer(`${niveau} : séries et Coupe`, `${pct(moy(ok.map(r => (r.series ? 1 : 0))))} en séries · ${moy(ok.map(r => r.rondes)).toFixed(2)} ronde(s) gagnée(s) · Coupe ${pct(moy(ok.map(r => (r.coupe ? 1 : 0))))}`);
    informer(`${niveau} : la meilleure fiche`, meilleur ? `${meilleur.W}-${meilleur.L}-${meilleur.OTL} · 82-0 : ${ok.filter(r => r.L + r.OTL === 0).length} sur ${ok.length}` : '—');
    lus[niveau] = ok;
  }
  const taux = (niveau, f) => moy(lus[niveau].map(r => (f(r) ? 1 : 0)));
  borne('Coupe du robot', taux('robot', r => r.coupe), 0, 0.05);
  borne('séries d\'une équipe bien bâtie (le chiffre)', taux('chiffre', r => r.series), 0.5, 1);
  borne('82-0, même pour l\'expert', taux('expert', r => r.L + r.OTL === 0), 0, 0.01);
  exiger('l\'expert fait mieux que le robot', moy(lus.expert.map(r => r.W)) > moy(lus.robot.map(r => r.W)), `${moy(lus.expert.map(r => r.W)).toFixed(1)} contre ${moy(lus.robot.map(r => r.W)).toFixed(1)} victoires`);
  verdict(`Cap 82, le jeu pur · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
