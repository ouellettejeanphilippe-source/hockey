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
 * 4. V27 (docs/refonte-v27-2.md) : les gros matchs d'une saison sont les trois rivaux des actes, posés dans la cédule
 *    (js/actes.js `poserLesRivaux`, le crochet `placer`) ; sans eux (le 82-0), la saison n'en a plus aucun.
 * 5. En Rogue, le duel à un choix (V27, tranche 6) et leur coach en séries (V23 F).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, playRonde, creerSeries, jouerMatchSeries, simulerGrosMatch,
  activeLineup, SONNE, playGame, grainerHasard, feuilleVierge,
} from '../js/sim.js';
import { PIECE_DU_COACH, persoAdverse, COACH_DU_STYLE, OMBRE } from '../js/pieces.js';
import { COACHS } from '../js/coachs.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { poserLesRivaux } from '../js/actes.js';
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
/* La saison en actes du Rogue : ses rivaux posés dans la cédule (V27). */
const EN_ACTES = { placer: X => poserLesRivaux(X) };

console.log(`\n  Les gros matchs mis en scène (S70) · ${LIGUES} ligues\n`);

/* ---------- 1. une ligue sans joueur n'a aucun gros match ---------- */
{
  const teams = ligue(9100, false);
  simulateLeague(teams, 82, { graine: 'gros-sans', decisions: [] });
  exiger('une ligue sans joueur ne voit aucun gros match', teams.every(t => !(t.minisBoss || []).length));
}

/* ---------- 2. le gros match du 82-0 : trois périodes vues, rien d'autre (V25) ---------- */
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
  exiger('un gros match du 82-0 se joue en trois périodes vues', trois === n, `${trois}/${n}`);
  exiger('ses trois pointages font le pointage ; ni main adverse, ni plan, ni entracte à choix', propres === n, `${propres}/${n}`);
}

/* ---------- 3. une vieille décision d'entracte ne change rien (V25) ---------- */
{
  let essais = 0, memes = 0;
  const texte = cal => cal.map(j => j.map(m => `${m.gfA}-${m.gfB}`).join(' ')).join('|');
  for (let L = 0; L < LIGUES; L++) {
    const graine = `gros-${L}`;
    const t0 = ligue(9200 + L);
    const r0 = simulateLeague(t0, 82, { graine, decisions: [], ...EN_ACTES });
    const mb = (t0[0].minisBoss || [])[0];
    if (!mb) continue;
    const t1 = ligue(9200 + L);
    const r1 = simulateLeague(t1, 82, { graine, decisions: [{ jour: mb.jour, entracte: { cle: 'garder' }, sel: 'a' }], ...EN_ACTES });
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
  const n = []; let complets = 0, total = 0;
  for (let L = 0; L < LIGUES; L++) {
    const teams = ligue(9400 + L);
    simulateLeague(teams, 82, { graine: `dose-${L}`, decisions: [], ...EN_ACTES });
    const mb = teams[0].minisBoss || [];
    n.push(mb.length); total += mb.length;
    complets += mb.filter(x => Array.isArray(x.periodes) && x.periodes.length === 3 && x.plan == null && !x.depistage && !x.apres40).length;
  }
  exiger('trois gros matchs par saison : les rivaux des actes', n.every(x => x === 3), n.join(' · '));
  const nu = ligue(9450);
  simulateLeague(nu, 82, { graine: 'dose-82-0', decisions: [] });
  exiger('au 82-0 (sans rivaux posés), la saison n\'a plus aucun gros match', !(nu[0].minisBoss || []).length, `${(nu[0].minisBoss || []).length}`);
  exiger('chaque gros match porte ses trois pointages de période, et ni plan ni dépistage', complets === total, `${complets}/${total}`);
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
 * LE DUEL À UN CHOIX (V27, tranche 6 ; scripts/check_duel.mjs mesure sa force). Dans une ligue de Rogue (`courbe`), chaque
 * gros match se joue en trois périodes, sans plan à dépister ; le plan pris avant le match (la décision du soir, `main`)
 * joue les trois périodes ; une vieille décision d'entracte (`duel.p` 1 ou 2, avec sa mise doublée, d'avant la V27) se
 * relit sans planter et ne change aucun match ; un rival perdu laisse ses sonnés, sans doublement ; le rival montre son
 * intention dominante dès son annonce, et le duel la joue.
 */
{
  let essais = 0, duels = 0, complets = 0, plans = 0, vieilles = 0, sonnes = 0, perdus = 0, dominantes = 0, rivaux = 0;
  for (let L = 0; L < LIGUES; L++) {
    const graine = `duel-${L}`;
    const base = ligue(9700 + L);
    const res0 = simulateLeague(base, 82, { graine, decisions: [], courbe: true, ...EN_ACTES });
    const mbs = base[0].minisBoss || [];
    duels += mbs.length;
    complets += mbs.filter(x => x.duel && x.duel.periodes.length === 3 && x.plan == null && !x.depistage).length;
    for (const mb of mbs) if (!mb.gagne) { perdus++; if (mb.duree === SONNE.duree) sonnes++; }
    const annonces = (res0.ligue && res0.ligue.rivaux) || [];
    for (const R of annonces) { rivaux++; if (R.dominante && R.jeu && (mbs.find(x => x.jour === R.jour) || {}).duel?.dominante === R.dominante) dominantes++; }
    const mb = mbs[0];
    if (!mb) continue;
    const jouer = decisions => { const teams = ligue(9700 + L); const res = simulateLeague(teams, 82, { graine, decisions, courbe: true, ...EN_ACTES }); return { teams, cal: res.calendrier }; };
    const p0 = { jour: mb.jour, main: { jouees: [] }, duel: { p: 0, plan: { cle: 'centre' } }, sel: 's0' };
    // Une vieille partie : ses décisions d'entracte, la mise doublée comprise.
    const dp1 = { jour: mb.jour, main: { jouees: [] }, duel: { p: 1, plan: { cle: 'tirer' } }, sel: 's1' };
    const dp2 = { jour: mb.jour, main: { jouees: [] }, duel: { p: 2, snap: true }, sel: 's2' };
    const r0 = jouer([p0]), r2 = jouer([p0, dp1, dp2]);
    const leSoir = r => r.cal[mb.jour].find(m => m.A === r.teams[0] || m.B === r.teams[0]);
    const empreinte = r => r.cal.map(j => j.map(m => `${m.gfA}-${m.gfB}`).join(' ')).join('|');
    essais++;
    if ((leSoir(r0).feuille.duel || { periodes: [] }).periodes.every(h => h.plan === 'centre')) plans++;
    if (empreinte(r0) === empreinte(r2)) vieilles++;
    const avant = cal => cal.slice(0, mb.jour).map(j => j.map(m => `${m.gfA}-${m.gfB}`).join(' ')).join('|');
    exiger(`ligue ${L} : les journées d'avant le duel ne bougent pas`, avant(r0.cal) === avant(jouer([]).cal));
  }
  exiger('en Rogue, chaque gros match est un duel de trois périodes, sans plan à dépister', duels > 0 && complets === duels, `${complets}/${duels}`);
  exiger('le plan pris avant le match joue ses trois périodes', essais > 0 && plans === essais, `${plans}/${essais}`);
  exiger('une vieille décision d\'entracte (et sa mise doublée) se relit sans planter et ne change aucun match', vieilles === essais, `${vieilles}/${essais}`);
  exiger('un duel perdu laisse ses sonnés, sans doublement', sonnes === perdus, `${sonnes}/${perdus} duels perdus · ${SONNE.duree} matchs`);
  exiger('chaque rival montre son jeu et son intention dominante à son annonce, et son duel la joue', rivaux > 0 && dominantes === rivaux, `${dominantes}/${rivaux} rivaux`);
}

/*
 * LEUR COACH EN SÉRIES (V23 F, js/pieces.js `persoAdverse`). Dans une ligue de Rogue, chaque adversaire des séries
 * porte un coach-personnage pur — une philosophie lue sur son style ou tirée de son nom —, dont la pièce de départ joue sa
 * condition et son ombre le reste du temps ; la feuille le note (`ombre`) ; en saison, rien. Neutre en V : en paires
 * sur les mêmes dés, un match de séries contre un club avec son coach et sans, `N_LEUR` matchs par club, l'écart reste
 * sous `NEUTRE_V` victoires par saison (la difficulté de l'adversaire ne bouge pas, `.claude/rules/rogue.md`).
 */
{
  const graine = 'leur-coach';
  const teams = ligue(9800);
  const res = simulateLeague(teams, 82, { graine, decisions: [], courbe: true, ...EN_ACTES });
  // Ton club dans les seize, quel que soit son rang : c'est sa série qu'on lit.
  const top = [teams[0], ...(res.standings || teams).filter(t => t !== teams[0])].slice(0, 16);
  const enSaison = teams.filter(t => !t.isPlayer && t.perso).length;
  const S = creerSeries(top, { ligue: res.ligue || null, graine, decisions: [], equipes: teams });
  const avecCoach = teams.filter(t => !t.isPlayer && t.persoSeries && PIECE_DU_COACH[t.persoSeries.cle] && t.persoSeries.adverse).length;
  for (let garde = 0; !S.fini && garde < 200; garde++) jouerMatchSeries(S);
  const toi = teams[0];
  const mienne = S.toutes.filter(x => x.A === toi || x.B === toi);
  // Chaque note porte la pièce du coach de CETTE série : ton club peut passer une ronde et changer d'adversaire.
  const notes = mienne.flatMap(x => x.feuilles.flatMap(f => (f.pieces || []).filter(n => n.cote === (x.A === toi ? 'B' : 'A'))
    .map(n => ({ ...n, attendue: PIECE_DU_COACH[(x.A === toi ? x.B : x.A).persoSeries.cle] }))));
  const styles = new Set(teams.filter(t => t.persoSeries).map(t => t.persoSeries.cle));
  const duStyle = teams.filter(t => t.persoSeries && COACH_DU_STYLE[t.style]);
  exiger('leur philosophie se lit sur le style du club (offensif, défensif, robuste), pure', duStyle.length > 0 && duStyle.every(t => t.persoSeries.cle === COACH_DU_STYLE[t.style]) && teams.filter(t => t.persoSeries).every(t => persoAdverse(t).cle === t.persoSeries.cle),
    `${duStyle.length} clubs au style marqué · l'ombre joue l'inverse à ×${OMBRE}`);
  exiger('en séries, chaque adversaire a son coach-personnage (une pièce), aucun en saison, et le tien reste le tien', avecCoach === teams.length - 1 && enSaison === 0 && !toi.persoSeries,
    `${avecCoach} coachs adverses · ${[...styles].map(c => COACHS[c].ico).join(' ')} · ${mienne.length ? `ta série contre ${COACHS[(mienne[0].A === toi ? mienne[0].B : mienne[0].A).persoSeries.cle].nom}` : 'pas de série (hors des 16)'}`);
  exiger('leur pièce joue sa condition et son ombre le reste du temps, la feuille le note', !mienne.length || (notes.some(n => !n.ombre) && notes.some(n => n.ombre) && notes.every(n => n.attendue === n.cle)),
    `${notes.filter(n => !n.ombre).length} périodes jouées, ${notes.filter(n => n.ombre).length} à l'ombre sur ${mienne.reduce((a, x) => a + x.feuilles.length, 0)} matchs`);
  // Neutre en V : le même match de séries, mêmes dés, leur coach contre aucun.
  const N_LEUR = Number(process.env.N_LEUR ?? 60), NEUTRE_V = 1.5;
  let d = 0, n = 0, joues = 0;
  // Les mêmes clubs que la ligue, neufs à chaque match (deux clubs, pas trente-deux).
  const vest = t => ({ tag: t.tag, s: t.season, un: equipeReelle(t.season, t.tag) });
  const v0 = vest(teams[0]);
  for (let i = 1; i < Math.min(teams.length, 9); i++) for (let g = 0; g < N_LEUR; g++) {
    const vi = vest(teams[i]);
    const jouer = coach => {
      const you = eq(teams[0].name, v0.tag, v0.un, v0.s), adv = eq(teams[i].name, vi.tag, vi.un, vi.s);
      you.isPlayer = true; you.courbe = true; adv.style = teams[i].style;
      you.luck = 0; adv.luck = 0; you.jourCourant = 0; adv.jourCourant = 0;
      adv.persoSeries = coach ? persoAdverse(adv) : null;
      grainerHasard(`leur:${i}:${g}`);
      const f = feuilleVierge();
      const r = g % 2 ? playGame(adv, you, 1, false, true, f) : playGame(you, adv, 1, false, true, f);
      const gf = g % 2 ? r.gfB : r.gfA, ga = g % 2 ? r.gfA : r.gfB;
      return { net: gf - ga, notes: f.pieces.filter(x => x.cote === (g % 2 ? 'A' : 'B')).length };
    };
    const a = jouer(false), b = jouer(true);
    d += b.net - a.net; n++; joues += b.notes;
  }
  const v = (d / n) * 82 / 6;
  exiger(`leur coach est neutre en V sur une saison (à ${String(NEUTRE_V).replace('.', ',')} V près, ${n} matchs de séries en paires)`, Math.abs(v) <= NEUTRE_V && joues === n * 3, `${v >= 0 ? '+' : ''}${v.toFixed(2)} V pour toi · ${joues} périodes notées sur ${n * 3}`);
}

verdict('Les gros matchs');
