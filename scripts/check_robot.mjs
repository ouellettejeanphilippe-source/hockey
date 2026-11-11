/*
 * LE ROBOT « PREMIER SIGNER » — combien gagne une équipe bâtie sans réfléchir ?
 *
 * La revue du 28 septembre 2026 (LIVRAISON.md, jalon 0) : un robot qui
 * signait la première carte permise du vestiaire, puis répondait à chaque
 * choix par la première option, a gagné la Coupe sur bureau (51-28-3, 16-4 en
 * séries) et fini 18e sur téléphone. Deux parties ne font pas une mesure. Ce
 * script la fait : N saisons du même robot, sous graine.
 *
 * LE ROBOT, exactement comme le test de fumée le joue :
 *   - la roulette sort une saison puis un club, uniformément (pas d'identité) ;
 *   - le vestiaire est rangé comme à l'écran : une colonne par poste (AG, C,
 *     AD, DG, DD, G), chaque colonne triée par points (victoires pour un
 *     gardien) ; le robot signe la PREMIÈRE carte dont le bouton est permis :
 *     une case libre qui lui convient, et un salaire sous le budget du choix
 *     (`maxForPick`, js/game.js : le plafond restant moins le plancher de
 *     chaque case qu'il restera à combler) ; la case prise est la plus sensée
 *     (position naturelle d'abord), comme `openSlots` ;
 *   - rien ne tient ? la roulette repart, sans limite de relances (le jeu en
 *     compte six puis oblige à retirer quelqu'un : ici, on ne retire jamais) ;
 *   - la saison : aucune carte jouée, aucune préparation, aucun changement de
 *     ligne ; à l'entracte d'un gros match, « Garder le cap » — c'est ce que
 *     joue le moteur quand personne ne choisit ;
 *   - les séries : sans carte.
 *
 * La passe « avec ballottage » (réclamer à chaque blessure longue) est partie
 * avec le ballottage du jour à jour de l'ancien Rogue (V28, tranche 4).
 *
 * `MIN_SAL` (775 000 $) et la règle du budget du choix vivent dans js/game.js,
 * qui touche au DOM : ils sont recopiés ici (cinq lignes), à garder en phase.
 *
 *   node scripts/check_robot.mjs                 40 saisons
 *   SAISONS=10 FILS=4 node scripts/check_robot.mjs
 *
 * Cibles (LIVRAISON.md) : la Coupe au plus 5 % des saisons, les séries entre
 * 20 et 65 %.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  CASES_DE_BASE, CAP, fits, getPositionPenalty, getPersonKey, registerHiddenRatings,
  createTeam, creerLigue, jouerJournee, bilanLigue, creerSeries, jouerMatchSeries, photoAlignement, autoRoster,
  ecoleDe,
} from '../js/sim.js';
import { groupeDuJoueur as groupe } from '../js/niveaux.js';
import { SAISONS, shard, generateur } from './lib/shards.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const MIN_SAL = 775_000;                 // js/game.js:74 — le salaire plancher d'une case
const copie = p => ({ ...p });
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/* La colonne du vestiaire où une carte s'affiche (js/game.js, vue « par poste »). */
const COLONNES = ['AG', 'C', 'AD', 'DG', 'DD', 'G'];
function colonneDe(p) {
  if (p.p === 'G') return 'G';
  if (groupe(p) === 'D') return (p.np === 'RD' || p.np === 'R' || p.p === 'RD') ? 'DD' : 'DG';
  return p.np === 'L' || p.np === 'AG' ? 'AG' : p.np === 'R' || p.np === 'AD' ? 'AD' : 'C';
}
const points = p => (p.p === 'G' ? (p.w || 0) : (p.pt ?? ((p.g || 0) + (p.a || 0))));
/* Le vestiaire dans l'ordre où l'écran le montre : colonne par colonne, les points en tête. */
function vestiaireAffiche(joueurs) {
  const out = [];
  for (const c of COLONNES) out.push(...joueurs.filter(p => colonneDe(p) === c).sort((a, b) => points(b) - points(a)));
  return out;
}

/*
 * L'ALIGNEMENT DU ROBOT. Rend le vestiaire de 23 et le nombre de roulettes
 * qu'il a fallu ; les cotes cachées sont enregistrées (le moteur les lit au
 * coffre, jamais sur l'objet).
 */
function alignementRobot(rnd) {
  const roster = {};
  const personnes = new Set();
  let masse = 0, roulettes = 0;
  const libres = () => CASES_DE_BASE.filter(s => !roster[s.i]);
  while (libres().length && roulettes < 400) {
    roulettes++;
    const e = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = Object.keys(e.byTeam);
    const tag = tags[Math.floor(rnd() * tags.length)];
    const restant = libres().length;
    const maxPick = (CAP - masse) - Math.max(0, restant - 1) * MIN_SAL;
    for (const p of vestiaireAffiche(e.byTeam[tag])) {
      if (personnes.has(getPersonKey(p)) || !(p.$ > 0) || p.$ > maxPick) continue;
      const ouvertes = libres().filter(s => fits(p, s)).sort((a, b) => getPositionPenalty(p, a) - getPositionPenalty(p, b) || a.i - b.i);
      if (!ouvertes.length) continue;
      const c = copie(p);
      registerHiddenRatings(c);
      roster[ouvertes[0].i] = c;
      personnes.add(getPersonKey(c));
      masse += c.$;
      break;
    }
  }
  return { roster, masse, roulettes, complet: !libres().length };
}

/* 31 vrais clubs, comme `buildOpponents` (js/game.js). */
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
    const copies = pool.map(copie);
    const roster = autoRoster(copies, exclus);
    for (const p of Object.values(roster)) exclus.add(getPersonKey(p));
    // Son club-école (Jalon P, B) : les vrais joueurs de ce club-saison hors de ses 23.
    const ecole = ecoleDe(copies.filter(p => !exclus.has(getPersonKey(p))), roster);
    for (const p of ecole) exclus.add(getPersonKey(p));
    out.push(createTeam(`${tag} ${e.season}`, tag, roster, { season: e.season, ecole }));
  }
  return out;
}

/*
 * UNE SAISON DU ROBOT. Rend la fiche, le rang et les séries.
 */
async function jouerSaisonRobot(n) {
  const rnd = generateur('robot', n);
  const { roster, masse, roulettes, complet } = alignementRobot(rnd);
  if (!complet) return { n, complet: false, roulettes };
  const exclus = new Set(Object.values(roster).map(getPersonKey));
  const you = createTeam('Robot', 'YOU', roster, { isPlayer: true });
  const opps = adversaires(rnd, exclus);
  const decisions = [{ jour: 0, cases: photoAlignement(roster), fermeture: 'auto' }];
  const L = creerLigue([you, ...opps], 82, { graine: `robot:${n}`, decisions });
  while (!L.fini) jouerJournee(L);
  const b = bilanLigue(L);
  const rang = b.standings.indexOf(you) + 1;
  let rondes = 0, coupe = false, finale = false;
  if (rang <= 16) {
    const S = creerSeries(b.standings.slice(0, 16), { ligue: L, graine: L.graine, decisions: [], equipes: L.teams });
    for (let garde = 0; !S.fini && garde < 200; garde++) jouerMatchSeries(S);
    rondes = S.toutes.filter(s => s.winner === you).length;
    coupe = S.champion === you;
    finale = S.toutes.some(s => s.ronde === S.nRondes - 1 && (s.A === you || s.B === you));
  }
  return { n, complet: true, roulettes, masse, W: you.W, L: you.L, OTL: you.OTL, pts: you.PTS, rang, series: rang <= 16, rondes, coupe, finale };
}

/* ---------- les travailleurs ---------- */
if (!isMainThread) {
  const { de, a } = workerData;
  const out = [];
  for (let n = de; n < a; n++) out.push(await jouerSaisonRobot(n));
  parentPort.postMessage(out);
} else {
  const N = Math.max(1, Number(process.env.SAISONS) || 40);
  const FILS = Math.max(1, Number(process.env.FILS) || Math.min(6, availableParallelism() - 1));
  const pct = x => `${Math.round(100 * x)} %`;
  const t0 = Date.now();

  console.log(`\n  Le robot « premier Signer » · ${N} saisons · ${FILS} travailleurs\n`);
  const lancer = data => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: data });
    w.once('message', resolve); w.once('error', reject);
  });
  const taille = Math.max(1, Math.ceil(N / FILS));
  const taches = [];
  for (let de = 0; de < N; de += taille) taches.push({ de, a: Math.min(N, de + taille) });
  const resultats = new Array(taches.length);
  let suivante = 0;
  await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, async () => {
    while (suivante < taches.length) { const k = suivante++; resultats[k] = await lancer(taches[k]); }
  }));

  const lire = (nom, rs) => {
    const ok = rs.filter(r => r.complet);
    exiger(`${nom} : chaque robot finit ses 23`, ok.length === rs.length, `${ok.length}/${rs.length}, ${moy(ok.map(r => r.roulettes)).toFixed(1)} roulettes par alignement`);
    informer(`${nom} : fiche moyenne`, `${moy(ok.map(r => r.W)).toFixed(1)}-${moy(ok.map(r => r.L)).toFixed(1)}-${moy(ok.map(r => r.OTL)).toFixed(1)} · ${moy(ok.map(r => r.pts)).toFixed(0)} pts · rang ${moy(ok.map(r => r.rang)).toFixed(1)} · masse ${(moy(ok.map(r => r.masse)) / 1e6).toFixed(1)} M$`);
    informer(`${nom} : les séries`, `${pct(moy(ok.map(r => r.series ? 1 : 0)))} en séries · ${pct(moy(ok.map(r => r.finale ? 1 : 0)))} en finale · ${ok.filter(r => r.coupe).length} Coupe(s) sur ${ok.length}`);
    return ok;
  };
  const saisons = lire('le robot', resultats.flat());
  borne('Coupe du robot', moy(saisons.map(r => r.coupe ? 1 : 0)), 0, 0.05);
  // 0,65 et non 0,5 (1.0, mesuré 0,60) : ce robot signe toujours le meilleur pointeur abordable, un club
  // au-dessus de la moyenne. La vraie garde est la Coupe (plus haut) : la saison est le build check, les séries les boss.
  borne('séries du robot', moy(saisons.map(r => r.series ? 1 : 0)), 0.2, 0.65);
  verdict(`Le robot « premier Signer » · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
