/*
 * L'INSTANTANÉ D'UN GROS MATCH rejoue-t-il ce que la saison rejouée jouerait ?
 *
 * L'entracte d'un duel (V9) est une décision datée d'un soir déjà joué : le jeu
 * rejouait toute la saison de la graine pour la prendre (JP : *rend instantané,
 * c'est la base*). Le moteur retient maintenant son état au matin d'un gros
 * match (`instantanes`, js/sim.js) et `rembobiner` le remet en place. Ce script
 * joue la même ligue deux fois : une fois rembobinée à chaque entracte, une fois
 * rejouée de la graine avec les mêmes décisions et les mêmes dés, et exige des
 * saisons identiques, feuille par feuille, joueur par joueur.
 *
 *   node scripts/check_instantane.mjs        (GROS=3 : le nombre de duels pris)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJournee, jouerJusqua, rembobiner, rembobinerSeries, creerSeries, jouerMatchSeries, bilanLigue, generateur, getPlayerKey } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const saisons = fs.readdirSync(DIR).filter(x => /^\d{4}.*\.json$/.test(x)).sort();
const GROS = Number(process.env.GROS || 3);

const choix = generateur('check_instantane');
const vestiaires = [], vus = new Set();
while (vestiaires.length < 32) {
  const f = saisons[Math.floor(choix() * saisons.length)];
  const shard = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const tags = [...new Set(shard.players.map(p => p.t))];
  const tag = tags[Math.floor(choix() * tags.length)];
  if (vus.has(`${shard.season}|${tag}`)) continue;
  let u;
  try { u = equipeReelle(shard.season, tag); } catch { continue; }
  if (u[0].length < 12 || u[1].length < 6 || !u[2].length) continue;
  vus.add(`${shard.season}|${tag}`);
  vestiaires.push({ tag, season: shard.season, pool: u.flat() });
}
const equipes = () => {
  const eq = vestiaires.map(v => {
    const pool = v.pool.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    return createTeam(`${v.tag} ${v.season}`, v.tag, autoRoster(pool), { season: v.season });
  });
  eq[0].isPlayer = true;
  return eq;
};

/* Tout ce qu'une saison a joué, dit en texte : les feuilles, les fiches, les joueurs, les gros matchs, les arcs. */
const nom = (k, v) => (v && typeof v === 'object' && v.roster && v.name ? `#${v.name}` : v && typeof v === 'object' && v.n && v.p && v.s ? `@${getPlayerKey(v)}` : typeof v === 'function' ? undefined : v);
function empreinte(L, jusqua) {
  const out = [];
  for (const jour of L.calendrier.slice(0, jusqua)) for (const m of jour) out.push(`${m.A.name}|${m.B.name}|${m.gfA}-${m.gfB}${m.ot ? 'p' : ''}|${JSON.stringify(m.feuille, nom)}`);
  for (const t of L.teams) {
    out.push(`${t.name} ${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`);
    for (const s of SLOTS) { const p = t.roster[s.i]; if (p) out.push(`${p.n} ${p.simGP} ${p.simG} ${p.simA} ${p.simPM} ${p.simSV || 0} ${Math.round(p.energie)}`); }
  }
  const toi = L.teams[0];
  out.push(JSON.stringify(toi.minisBoss || [], nom), JSON.stringify((toi.arcs || []).map(a => a.cle || a.titre || ''), nom));
  return out;
}

// Une ligue rembobinée à chaque entracte : trois plans par duel, pris l'un après l'autre comme au jeu.
const des = { matins: [], soirs: [], series: {} };
const A = creerLigue(equipes(), 82, { graine: 'inst', decisions: [], courbe: true, des, instantanes: true });
const decisions = [];
let pris = 0, rembobines = 0, refus = 0;
const jours = [];
const PLANS_PRIS = ['tirer', 'centre', 'assaut'];
while (!A.fini && pris < GROS) {
  const gros = !!A.grosAVenir;
  jouerJournee(A);
  if (!gros) continue;
  const r = A.jour - 1;
  jours.push(r);
  for (const [p, cle] of [[1, PLANS_PRIS[pris % 3]], [2, PLANS_PRIS[(pris + 1) % 3]]]) {
    const d = { jour: r, main: { jouees: [] }, duel: { p, plan: { cle } }, sel: `s${r}:${p}` };
    const liste = [...A.decisions, d];
    if (rembobiner(A, liste, r)) { rembobines++; jouerJusqua(A, r + 1); } else refus++;
  }
  pris++;
}
const fin = Math.min(A.calendrier.length, A.jour + 5);
jouerJusqua(A, fin);
exiger('chaque entracte se rembobine (aucun rejeu de la graine)', rembobines === 2 * pris && !refus && pris > 0, `${pris} duels (journées ${jours.join(', ')}), ${rembobines} rembobinés, ${refus} refusés`);
exiger('l\'instantané se reprend après le rembobinage', !!A._instant || pris === 0);

// La même ligue rejouée de la graine, avec les décisions de A et ses dés : ce que le jeu faisait avant.
const B = creerLigue(equipes(), 82, { graine: 'inst', decisions: A.decisions.slice(), courbe: true, des: structuredClone(des) });
jouerJusqua(B, fin);
const eA = empreinte(A, fin), eB = empreinte(B, fin);
const diff = eA.findIndex((x, i) => x !== eB[i]);
exiger('la saison rembobinée est la saison rejouée, au caractère près', diff < 0 && eA.length === eB.length,
  diff < 0 ? `${eA.length} lignes, ${fin} journées` : `ligne ${diff} :\n    ${String(eA[diff]).slice(0, 300)}\n    ${String(eB[diff]).slice(0, 300)}`);

// Le témoin : sans les plans des entractes, la saison n'est pas la même — sinon le test ne prouve rien.
const C = creerLigue(equipes(), 82, { graine: 'inst', decisions: A.decisions.filter(d => !d.duel), courbe: true, des: structuredClone(des) });
jouerJusqua(C, fin);
exiger('le témoin : sans les plans des entractes, la saison change', empreinte(C, fin).some((x, i) => x !== eA[i]));

// Un rembobinage refusé : une décision d'avant le matin retenu se rejoue de la graine.
exiger('une décision d\'avant le matin retenu ne se rembobine pas', !rembobiner(A, A.decisions, 0));

/*
 * LES SÉRIES : chaque duel de ta série se rembobine au matin de son match (`rembobinerSeries`), et les séries
 * rejouées de la graine — la saison d'abord, puis les matchs jusque-là — disent les mêmes feuilles.
 */
const qualifies = L => {
  const t = bilanLigue(L).standings.slice(0, 16);
  if (!t.includes(L.teams[0])) t[15] = L.teams[0];
  return t;
};
const empreinteSeries = S => S.toutes.flatMap(x => [`${x.A.name}|${x.B.name} ${x.wA}-${x.wB}`, ...x.feuilles.map(f => JSON.stringify(f, nom))])
  .concat(S.equipes.flatMap(t => SLOTS.map(sl => t.roster[sl.i]).filter(Boolean).map(p => `${p.n} ${JSON.stringify(p.po || {})} ${Math.round(p.energie)}`)));
jouerJusqua(A, Infinity);
const dS = [];
const SA = creerSeries(qualifies(A), { ligue: A, graine: A.graine, decisions: dS, equipes: A.teams, des: des.series = {}, instantanes: true });
let duelsS = 0, rembS = 0;
const sienne = S => S.courante.some(x => x.wA < 4 && x.wB < 4 && (x.A === S.toi || x.B === S.toi));
for (let garde = 0; !SA.fini && garde < 40 && duelsS < 4; garde++) {
  const avec = sienne(SA), r = SA.ronde, k = SA.k;
  jouerMatchSeries(SA);
  if (!avec) continue;
  for (const p of [1, 2]) {
    const liste = [...SA.decisions, { ronde: r, match_no: k, main: { jouees: [] }, duel: { p, plan: { cle: PLANS_PRIS[(duelsS + p) % 3] } }, sel: `po${r}:${k}:${p}` }];
    if (rembobinerSeries(SA, liste, r, k)) { rembS++; jouerMatchSeries(SA); }
  }
  duelsS++;
}
exiger('chaque entracte de séries se rembobine', duelsS > 0 && rembS === 2 * duelsS, `${duelsS} matchs de ta série, ${rembS} rembobinés`);
const B2 = jouerJusqua(creerLigue(equipes(), 82, { graine: 'inst', decisions: A.decisions.slice(), courbe: true, des: structuredClone(des) }), Infinity);
const SB = creerSeries(qualifies(B2), { ligue: B2, graine: B2.graine, decisions: SA.decisions.slice(), equipes: B2.teams, des: structuredClone(des.series) });
while (!SB.fini && (SB.ronde < SA.ronde || (SB.ronde === SA.ronde && SB.k < SA.k))) jouerMatchSeries(SB);
const sA = empreinteSeries(SA), sB = empreinteSeries(SB);
const dif = sA.findIndex((x, i) => x !== sB[i]);
exiger('les séries rembobinées sont les séries rejouées, au caractère près', dif < 0 && sA.length === sB.length,
  dif < 0 ? `${sA.length} lignes` : `ligne ${dif} :\n    ${String(sA[dif]).slice(0, 300)}\n    ${String(sB[dif]).slice(0, 300)}`);
verdict('L\'instantané');
