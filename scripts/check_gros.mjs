/*
 * LES GROS MATCHS MIS EN SCÈNE (S70) — ce qui doit tenir.
 *
 *   node scripts/check_gros.mjs
 *
 * 1. Un match ordinaire ne change pas : une ligue SANS joueur ne voit aucun gros match.
 * 2. Au 82-0 (V25, docs/refonte-v25.md § A ; JP : *périodes vues sans choix*), un gros match se joue en trois
 *    périodes vues : la feuille garde leurs trois pointages, et il ne porte ni plan adverse, ni main adverse, ni
 *    entracte à choix ; une vieille décision d'entracte ne change aucun match.
 * 3. En séries, chaque match de ta série est un gros match en trois périodes.
 * 4. Une saison n'a plus aucun gros match : les rivaux des actes, posés dans la cédule de l'ancien Rogue, sont partis
 *    avec elle (V28, tranche 4). La run en carte joue ses duels en matchs isolés (`simulerGrosMatch` : `check_duel`,
 *    `check_run`).
 * 5. En séries d'une run, leur banc (V29).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, playRonde, creerSeries, jouerMatchSeries, simulerGrosMatch,
  activeLineup, playGame, grainerHasard, feuilleVierge,
} from '../js/sim.js';
import { BANC_DES_SERIES, persoAdverse, bancDuMatch, COACH_DU_STYLE } from '../js/pieces.js';
import { COACHS } from '../js/coachs.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';
import '../js/greffes.js';   // V25 : les greffes du Rogue se branchent sur le moteur

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 6);
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed, joueur = true) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < 32) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  if (joueur) out[0].isPlayer = true;
  return out;
}
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

console.log(`\n  Les gros matchs mis en scène (S70) · ${LIGUES} ligues\n`);

/* ---------- 1. une ligue sans joueur n'a aucun gros match ---------- */
{
  const teams = ligue(9100, false);
  simulateLeague(teams, 82, { graine: 'gros-sans', decisions: [] });
  exiger('une ligue sans joueur ne voit aucun gros match', teams.every(t => !(t.minisBoss || []).length));
}

/* ---------- 2. un gros match : trois périodes vues, rien d'autre (V25) ---------- */
{
  const teams = ligue(9150);
  const [toi, adv] = [teams[0], teams[1]];
  let n = 0, trois = 0, propres = 0;
  for (let k = 0; k < 60; k++) {
    const r = simulerGrosMatch(toi, adv, { graine: 'periodes-vues', cle: `m${k}` });
    n++;
    const per = r.feuille.periodes || [];
    if (per.length === 3) trois++;
    const sA = per.reduce((a, h) => a + h.gfA, 0), sB = per.reduce((a, h) => a + h.gfB, 0);
    // La prolongation ou les tirs de barrage ajoutent un but au pointage, pas aux périodes.
    if (sA + sB === r.gf + r.ga - (r.feuille.ot ? 1 : 0) && !r.feuille.cartes && !r.feuille.entracte && !r.gros.plan && !r.gros.depistage) propres++;
  }
  exiger('un gros match se joue en trois périodes vues', trois === n, `${trois}/${n}`);
  exiger('ses trois pointages font le pointage ; ni main adverse, ni plan, ni entracte à choix', propres === n, `${propres}/${n}`);
}

/* ---------- 3. une vieille décision d'entracte ne change rien (V25) ---------- */
{
  let essais = 0, memes = 0;
  const texte = cal => cal.map(j => j.map(m => `${m.gfA}-${m.gfB}`).join(' ')).join('|');
  for (let L = 0; L < LIGUES; L++) {
    const graine = `gros-${L}`;
    const r0 = simulateLeague(ligue(9200 + L), 82, { graine, decisions: [] });
    // Le soir d'un de tes matchs : la décision d'entracte d'une vieille partie y est datée.
    const t1 = ligue(9200 + L), jour = r0.calendrier.findIndex((j, i) => i >= 25 && j.some(m => m.A.isPlayer || m.B.isPlayer));
    const r1 = simulateLeague(t1, 82, { graine, decisions: [{ jour, entracte: { cle: 'garder' }, sel: 'a' }] });
    essais++;
    if (texte(r0.calendrier) === texte(r1.calendrier)) memes++;
  }
  exiger('une vieille décision d\'entracte (le 82-0 d\'avant la V25) ne change aucun match', essais > 0 && memes === essais, `${memes}/${essais}`);
}

/* ---------- 5. les séries : chaque match de ta série est un gros match en trois périodes ---------- */
{
  for (let L = 0; L < LIGUES; L++) {
    const teams = ligue(9300 + L);
    simulateLeague(teams, 82, { graine: `po-${L}`, decisions: [] });
    const top = teams.slice().sort((a, b) => b.PTS - a.PTS).slice(0, 16);
    if (!top.includes(teams[0])) { top.pop(); top.push(teams[0]); }
    const paires = [];
    for (let i = 0; i < 8; i++) paires.push([top[i], top[15 - i]]);
    const series = playRonde(paires, 0, null, `po-${L}`);
    const s = series.find(x => x.A === teams[0] || x.B === teams[0]);
    exiger(`ligue ${L} : chaque match de ta série porte ses trois périodes`, s.plans.length === s.wA + s.wB
      && s.plans.every(p => Array.isArray(p.periodes) && p.periodes.length === 3) && s.feuilles.every(f => f.periodes && f.periodes.length === 3));
    exiger(`ligue ${L} : les autres séries n'ont pas de plan`, series.every(x => x === s || !x.plans.length));
  }
}

/* ---------- 6. la dose ---------- */
{
  let aucun = 0;
  for (let L = 0; L < LIGUES; L++) {
    const teams = ligue(9400 + L);
    simulateLeague(teams, 82, { graine: `dose-${L}`, decisions: [] });
    if (!(teams[0].minisBoss || []).length) aucun++;
  }
  exiger('une saison n\'a aucun gros match : les rivaux posés dans la cédule sont partis', aucun === LIGUES, `${aucun}/${LIGUES} saisons`);
}

/* Un blessé adverse ne figure jamais dans l'alignement que le hub lit (1.0, J1-N). */
{
  const teams = ligue(9600);
  simulateLeague(teams, 82, { graine: 'hub-9600', decisions: [] });
  let blesse = 0;
  for (const t of teams.slice(1, 6)) {
    const L = activeLineup(t);
    for (const p of Object.values(L)) if (p && t.injured.has(p)) blesse++;
  }
  exiger('aucun blessé dans l\'alignement adverse que le hub lit', blesse === 0, `${blesse} blessé(s)`);
}

/*
 * LEUR BANC EN SÉRIES (V29, js/pieces.js `persoAdverse` ; JP, 14 nov. 2026 : « les séries sont le mur »). L'adversaire
 * d'une série porte un vrai banc, qui grandit à chaque ronde et compte tout son club : sa philosophie se lit sur son style,
 * pure ; ses pièces qui ont atteint une marche sont notées à la feuille aux trois périodes ; et ce banc te coûte des buts,
 * davantage en finale qu'à la première ronde — en paires sur les mêmes dés, `N_LEUR` matchs par club. (Le coach d'une
 * seule pièce et son ombre, neutres en victoires, sont partis avec le banc à conditions.)
 */
{
  const teams = ligue(9800);
  simulateLeague(teams, 82, { graine: 'leur-banc', decisions: [] });   // une saison jouée pose le style de chaque club
  const adversaires = teams.slice(1, 9), marques = adversaires.filter(t => COACH_DU_STYLE[t.style]);
  exiger('leur philosophie se lit sur le style du club (offensif, défensif, robuste), pure', marques.length > 0 && marques.every(t => persoAdverse(t, 0).cle === COACH_DU_STYLE[t.style]) && adversaires.every(t => persoAdverse(t, 1).banc.join() === persoAdverse(t, 1).banc.join() && COACHS[persoAdverse(t, 2).cle]),
    `${marques.length} clubs au style marqué sur ${adversaires.length}`);
  exiger(`leur banc grandit à chaque ronde : ${BANC_DES_SERIES.join(', ')} pièces`, adversaires.every(t => BANC_DES_SERIES.every((n, r) => persoAdverse(t, r).banc.length === n)), `${adversaires.length} clubs`);
  // En paires : le même match de séries, les mêmes dés, leur banc de la ronde contre aucun.
  const N_LEUR = Number(process.env.N_LEUR ?? 40);
  const vest = t => ({ tag: t.tag, s: t.season, un: equipeReelle(t.season, t.tag) });
  const v0 = vest(teams[0]), parRonde = BANC_DES_SERIES.map(() => ({ d: 0, n: 0, notes: 0, attendues: 0, fausses: 0 }));
  // La première ronde qui porte un banc (depuis la V30, la toute première n'en porte aucun), et la finale.
  const DEBUT = BANC_DES_SERIES.findIndex(n => n > 0), FINALE = BANC_DES_SERIES.length - 1;
  for (let i = 1; i <= adversaires.length; i++) for (let g = 0; g < N_LEUR; g++) for (const ronde of [DEBUT, FINALE]) {
    const vi = vest(teams[i]);
    const jouer = banc => {
      const you = eq(teams[0].name, v0.tag, v0.un, v0.s), adv = eq(teams[i].name, vi.tag, vi.un, vi.s);
      you.isPlayer = true; you.courbe = true; adv.style = teams[i].style;
      you.luck = 0; adv.luck = 0; you.jourCourant = 0; adv.jourCourant = 0;
      adv.persoSeries = banc ? persoAdverse(adv, ronde) : null;
      const attendu = banc ? bancDuMatch(adv.persoSeries, Object.values(adv.roster).filter(Boolean)).filter(x => x.marche > 0) : [];
      grainerHasard(`leur:${i}:${g}`);
      const f = feuilleVierge();
      const r = g % 2 ? playGame(adv, you, 1, false, true, f) : playGame(you, adv, 1, false, true, f);
      const gf = g % 2 ? r.gfB : r.gfA, ga = g % 2 ? r.gfA : r.gfB, notes = f.pieces.filter(x => x.cote === (g % 2 ? 'A' : 'B'));
      return { net: gf - ga, notes, attendu };
    };
    const a = jouer(false), b = jouer(true), R = parRonde[ronde];
    R.d += b.net - a.net; R.n++; R.notes += b.notes.length; R.attendues += 3 * b.attendu.length;
    if (b.notes.some(x => !b.attendu.some(y => y.cle === x.cle && y.marche === x.marche))) R.fausses++;
  }
  const premiere = parRonde[DEBUT], finale = parRonde[FINALE];
  exiger('leurs pièces qui ont atteint une marche sont notées à la feuille, aux trois périodes, à leur marche', [premiere, finale].every(R => R.notes === R.attendues && R.attendues > 0 && !R.fausses),
    `${premiere.notes} notes à leur première ronde avec un banc (la ${DEBUT + 1}e), ${finale.notes} en finale, sur ${premiere.n} matchs chacune`);
  exiger('leur banc est le mur : il te coûte des buts, et davantage en finale qu\'à sa première ronde', premiere.d < 0 && finale.d < premiere.d,
    `${(premiere.d / premiere.n).toFixed(2)} but par match à la ${DEBUT + 1}e ronde, ${(finale.d / finale.n).toFixed(2)} en finale (${premiere.n} matchs en paires)`);
}

verdict('Les gros matchs');
