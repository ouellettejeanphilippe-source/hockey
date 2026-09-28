/*
 * LE ROBOT « PREMIER SIGNER » — combien gagne une équipe bâtie sans réfléchir ?
 *
 * La revue du 28 septembre 2026 (LIVRAISON.md, jalon 0) : un robot qui
 * signait la première carte permise du vestiaire, puis répondait à chaque
 * choix par la première option, a gagné la Coupe sur bureau (51-28-3, 16-4 en
 * séries) et fini 18e sur téléphone. Deux parties ne font pas une mesure. Ce
 * script la fait : N saisons du même robot, sous graine, avec et sans le
 * ballottage — le cadeau qu'une blessure de sept matchs apporte.
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
 *   - le ballottage (passe `BALLOTTAGE=1`) : à chaque blessure d'au moins
 *     sept matchs chez un habillé, réclamer le PREMIER candidat offert, à la
 *     case de réserve de son groupe (celui qui l'occupait est libéré) ;
 *   - les séries : sans carte.
 *
 * Le ballottage se lit dans `js/ballottage.js` (`candidatsBallottage`), la
 * fonction pure que le jeu et ce script partagent. Tant qu'elle n'existe pas,
 * la passe avec ballottage est sautée et le rapport le dit.
 *
 * `MIN_SAL` (775 000 $) et la règle du budget du choix vivent dans js/game.js,
 * qui touche au DOM : ils sont recopiés ici (cinq lignes), à garder en phase.
 *
 *   node scripts/check_robot.mjs                 40 saisons, deux passes
 *   SAISONS=10 FILS=4 node scripts/check_robot.mjs
 *   MODE=rogue node scripts/check_robot.mjs      le robot du Rogue (scripts/lib/rogue_sim.mjs)
 *
 * Cibles (LIVRAISON.md) : la Coupe au plus 5 % des saisons, les séries entre
 * 20 et 50 %, et le ballottage au plus +3 victoires.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, CASES_DE_BASE, CAP, fits, getPositionPenalty, getPersonKey, getPlayerKey, registerHiddenRatings,
  createTeam, creerLigue, jouerJournee, bilanLigue, creerSeries, jouerMatchSeries, connaitre, photoAlignement, autoRoster,
} from '../js/sim.js';
import { SAISONS, shard, generateur, groupe, jouerRun, metaAuNiveau } from './lib/rogue_sim.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const MIN_SAL = 775_000;                 // js/game.js:74 — le salaire plancher d'une case
const BLESSURE_LONGUE = 7;               // la blessure qui ouvre le ballottage au robot
const RESERVE_DE = { F: 'Réserve F', D: 'Réserve D', G: 'Réserve' };   // js/game.js `RESERVE_DE`
const copie = p => ({ ...p });
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/* La fonction pure du ballottage, si elle existe déjà. */
let candidatsBallottage = null;
try { ({ candidatsBallottage } = await import('../js/ballottage.js')); } catch { candidatsBallottage = null; }

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

/* 31 vrais clubs, comme `buildOpponents` (copie de scripts/lib/rogue_sim.mjs, qui ne l'exporte pas). */
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

const masseDe = roster => Object.values(roster).filter(Boolean).reduce((a, p) => a + (p.$ || 0), 0);

/*
 * UNE SAISON DU ROBOT. `ballottage` : réclamer à chaque blessure longue.
 * Rend la fiche, le rang, les séries, et le nombre de joueurs réclamés.
 */
async function jouerSaisonRobot(n, ballottage) {
  const rnd = generateur('robot', n);
  const { roster, masse, roulettes, complet } = alignementRobot(rnd);
  if (!complet) return { n, complet: false, roulettes };
  const exclus = new Set(Object.values(roster).map(getPersonKey));
  const you = createTeam('Robot', 'YOU', roster, { isPlayer: true });
  const opps = adversaires(rnd, exclus);
  const decisions = [{ jour: 0, cases: photoAlignement(roster), fermeture: 'auto' }];
  const L = creerLigue([you, ...opps], 82, { graine: `robot:${n}`, decisions });
  // Ce que le ballottage du jeu lit : les clubs de la ligue (saison|club) et la graine.
  L.cles = opps.map(t => `${t.season}|${t.tag}`);
  let shards = null;
  const reclames = [];
  const aReclamer = [];   // les blessés longs vus hier soir : on réclame le matin
  let vus = 0;
  while (!L.fini) {
    if (ballottage && candidatsBallottage && aReclamer.length) {
      shards = shards || new Map(SAISONS.map(s => [s, shard(s)]));
      for (const blesse of aReclamer.splice(0)) {
        const g = groupe(blesse);
        const slot = SLOTS.find(s => s.scratch && s.role === RESERVE_DE[g]);
        if (!slot) continue;
        const sort = you.roster[slot.i] || null;
        const budget = Math.min(CAP - masseDe(you.roster) + (sort ? sort.$ || 0 : 0), CAP * 0.03);
        let offerts = [];
        try { offerts = await candidatsBallottage({ shards, ligue: L, blesse, budget, graine: L.graine, at: L.jour, niveauMax: 1 }) || []; }
        catch (e) { informer('ballottage', `candidatsBallottage a échoué : ${e.message}`); offerts = []; }
        if (!offerts.length) continue;
        const p = copie(offerts[0].p || offerts[0]);
        if (!fits(p, slot)) continue;
        registerHiddenRatings(p);
        connaitre(p);
        decisions.push({ jour: L.jour, ballottage: { i: slot.i, entre: getPlayerKey(p), sort: sort ? getPlayerKey(sort) : null, rar: 'commune' }, sel: `b${L.jour}` });
        reclames.push({ jour: L.jour, entre: p.n, pts: points(p), $: p.$, sort: sort ? sort.n : null });
      }
    }
    jouerJournee(L);
    // Les blessures de la journée : un habillé absent pour sept matchs ou plus ouvre le ballottage.
    for (const b of you.injuriesLog.slice(vus)) {
      const i = Object.entries(you.roster).find(([, p]) => p === b.player)?.[0];
      if (b.games >= BLESSURE_LONGUE && i !== undefined && !SLOTS[i].scratch) aReclamer.push(b.player);
    }
    vus = you.injuriesLog.length;
  }
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
  return { n, complet: true, roulettes, masse, W: you.W, L: you.L, OTL: you.OTL, pts: you.PTS, rang, series: rang <= 16, rondes, coupe, finale, reclames };
}

/* ---------- les travailleurs ---------- */
if (!isMainThread) {
  const { de, a, ballottage } = workerData;
  const out = [];
  for (let n = de; n < a; n++) out.push(await jouerSaisonRobot(n, ballottage));
  parentPort.postMessage(out);
} else {
  const N = Math.max(1, Number(process.env.SAISONS) || 40);
  const MODE = process.env.MODE || 'saison';
  const FILS = Math.max(1, Number(process.env.FILS) || Math.min(6, availableParallelism() - 1));
  const pct = x => `${Math.round(100 * x)} %`;
  const t0 = Date.now();

  if (MODE === 'rogue') {
    /*
     * LE ROBOT DU ROGUE : `jouerRun` (scripts/lib/rogue_sim.mjs), sans
     * aucun déblocage. Sa boutique n'est pas jouée au hasard mais par sa
     * politique fixe (`packVoulu` : le pack de talent qu'il peut payer, sinon
     * l'Argent) : `jouerRun` n'offre pas de crochet pour l'achat. Un crochet
     * `{ acheter(meta, jetons, n) → cle | null, choisir(cartes) → carte }`
     * passé dans ses options suffirait ; on le note, on ne le modifie pas ici.
     */
    console.log(`\n  Le robot du Rogue · ${N} runs, sans déblocage\n`);
    const runs = [];
    for (let n = 0; n < N; n++) {
      const r = jouerRun(metaAuNiveau(0), { graine: `robot:${n}`, jalons: false });
      runs.push(r);
    }
    const coupes = runs.filter(r => r.coupe).length;
    const saisons = moy(runs.map(r => r.nSaisons));
    informer('runs jouées', `${N} · ${saisons.toFixed(2).replace('.', ',')} saisons par run · ${pct(moy(runs.map(r => r.series1)))} font les séries dès la saison 1`);
    borne('Coupe par run, robot du Rogue sans déblocage', coupes / N, 0, 0.1);
    informer('boutique', 'politique fixe de rogue_sim.mjs (packVoulu), pas de tirage au hasard : jouerRun n\'a pas de crochet d\'achat');
    verdict(`Le robot du Rogue · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } else {
    console.log(`\n  Le robot « premier Signer » · ${N} saisons · ${FILS} travailleurs\n`);
    const lancer = data => new Promise((resolve, reject) => {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: data });
      w.once('message', resolve); w.once('error', reject);
    });
    const passes = [false];
    if (candidatsBallottage) passes.push(true);
    else informer('ballottage', 'module js/ballottage.js absent, passe sautée');
    const taille = Math.max(1, Math.ceil(N / FILS));
    const taches = [];
    for (const ballottage of passes) for (let de = 0; de < N; de += taille) taches.push({ de, a: Math.min(N, de + taille), ballottage });
    const resultats = new Array(taches.length);
    let suivante = 0;
    await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, async () => {
      while (suivante < taches.length) { const k = suivante++; resultats[k] = await lancer(taches[k]); }
    }));
    const par = { sans: [], avec: [] };
    taches.forEach((t, k) => par[t.ballottage ? 'avec' : 'sans'].push(...resultats[k]));

    const lire = (nom, rs) => {
      const ok = rs.filter(r => r.complet);
      exiger(`${nom} : chaque robot finit ses 23`, ok.length === rs.length, `${ok.length}/${rs.length}, ${moy(ok.map(r => r.roulettes)).toFixed(1)} roulettes par alignement`);
      informer(`${nom} : fiche moyenne`, `${moy(ok.map(r => r.W)).toFixed(1)}-${moy(ok.map(r => r.L)).toFixed(1)}-${moy(ok.map(r => r.OTL)).toFixed(1)} · ${moy(ok.map(r => r.pts)).toFixed(0)} pts · rang ${moy(ok.map(r => r.rang)).toFixed(1)} · masse ${(moy(ok.map(r => r.masse)) / 1e6).toFixed(1)} M$`);
      informer(`${nom} : les séries`, `${pct(moy(ok.map(r => r.series ? 1 : 0)))} en séries · ${pct(moy(ok.map(r => r.finale ? 1 : 0)))} en finale · ${ok.filter(r => r.coupe).length} Coupe(s) sur ${ok.length}`);
      return ok;
    };
    const sans = lire('sans ballottage', par.sans);
    borne('Coupe du robot', moy(sans.map(r => r.coupe ? 1 : 0)), 0, 0.05);
    borne('séries du robot', moy(sans.map(r => r.series ? 1 : 0)), 0.2, 0.5);
    if (par.avec.length) {
      const avec = lire('avec ballottage', par.avec);
      const parN = new Map(sans.map(r => [r.n, r]));
      const deltas = avec.filter(r => parN.has(r.n)).map(r => r.W - parN.get(r.n).W);
      const nReclames = moy(avec.map(r => r.reclames.length));
      informer('apport du ballottage', `${deltas.length ? (moy(deltas) >= 0 ? '+' : '−') + Math.abs(moy(deltas)).toFixed(1) : '?'} victoire(s) par saison · ${nReclames.toFixed(1)} réclamé(s) par saison · Coupe ${pct(moy(avec.map(r => r.coupe ? 1 : 0)))}`);
      borne('le ballottage ne vaut pas plus de trois victoires', moy(deltas), -3, 3, ' V');
      const ex = avec.flatMap(r => r.reclames).slice(0, 3).map(x => `${x.entre} (${x.pts} pts, ${(x.$ / 1e6).toFixed(2)} M$)`);
      if (ex.length) informer('réclamés, par exemple', ex.join(' · '));
    }
    verdict(`Le robot « premier Signer » · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
