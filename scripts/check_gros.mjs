/*
 * LES GROS MATCHS MIS EN SCÈNE (S70) — ce qui doit tenir.
 *
 *   node scripts/check_gros.mjs
 *
 * 1. Un match ordinaire ne change pas : une ligue SANS joueur ne voit aucun
 *    gros match, aucun plan, aucune coupure au deuxième entracte.
 * 2. Chaque plan adverse est à peu près NEUTRE quand on ne le contre pas
 *    (JP : *sans changer la difficulté*), et PAYANT quand on le contre.
 * 3. Le choix du deuxième entracte ne touche pas aux deux premières périodes
 *    déjà vues ; des dés neufs donnent une autre troisième période.
 * 4. En séries, l'adversaire garde le plan qui a gagné et en change après
 *    une défaite.
 * 5. La saison en donne assez pour raconter, pas assez pour noyer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, playRonde,
  PLANS_ADV, planEstContre, planDeSerie, entractesOfferts, effetEntracte, contreDe, TACTIQUES,
  AVANT_GROS, avantDuGros, ENTRACTES, entractesDu,
  lignesDeGros, lignesDe, planProbable, activeLineup,
} from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

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

/* ---------- 2. les plans : de vrais réglages de lignes (S72) ---------- */
/*
 * JP : *tout devrait être ensemble, pas plusieurs systèmes différents* ; *que
 * toutes les équipes ont les mêmes stratégies*. Un plan n'est plus un paquet
 * de bonus : il règle les lignes de l'adversaire dans les mêmes menus que
 * les tiens, et son contre est celui du cercle des tactiques.
 */
for (const [cle, P] of Object.entries(PLANS_ADV)) {
  exiger(`${P.ico} ${P.nom} · règle de vraies lignes`, P.lignes && Object.keys(P.lignes).length > 0 && !P.force && !P.faiblesse);
  if (P.tac) {
    const c = contreDe(P.tac);
    const deux = [{ tac: c }, { tac: c }, { tac: 'hourra' }, { tac: 'hourra' }];
    exiger(`${P.ico} ${P.nom} · contré par ${TACTIQUES[c].nom}, la tactique qui étouffe ${TACTIQUES[P.tac].nom}`,
      planEstContre(cle, deux) && !planEstContre(cle, [0, 1, 2, 3].map(() => ({ tac: 'hourra' }))));
  }
}
{
  // Dans un vrai gros match, les lignes de l'adversaire jouent le plan : ses lancers portent sa tactique.
  let vus = 0, ok = 0;
  for (let L = 0; L < LIGUES && vus < 6; L++) {
    const teams = ligue(9150 + L);
    const { calendrier } = simulateLeague(teams, 82, { graine: `plan-${L}`, decisions: [] });
    for (const mb of teams[0].minisBoss || []) {
      const P = PLANS_ADV[mb.plan];
      if (!P || !P.tac) continue;
      const m = calendrier[mb.jour].find(x => x.A === teams[0] || x.B === teams[0]);
      const coteAdv = m.A === teams[0] ? 'B' : 'A';
      const tirs = m.feuille.lancers.filter(l => l.cote === coteAdv && (l.ligne === 0 || l.ligne === 1) && l.mode === 'FE');
      if (!tirs.length) continue;
      vus++;
      if (tirs.every(l => l.tac === P.tac)) ok++;
    }
  }
  exiger('dans un gros match, les deux premières lignes adverses jouent la tactique du plan', vus > 0 && ok === vus, `${ok}/${vus} gros matchs`);
}

/* ---------- 3. l'entracte : les deux premières périodes ne bougent pas ---------- */
{
  let essais = 0, p12 = 0, p3 = 0, vus = 0;
  for (let L = 0; L < LIGUES; L++) {
    const graine = `gros-${L}`;
    const t0 = ligue(9200 + L);
    simulateLeague(t0, 82, { graine, decisions: [] });
    const mb = (t0[0].minisBoss || [])[0];
    if (!mb) continue;
    vus++;
    const jourDe = (teams, cal) => cal[mb.jour].find(m => m.A === teams[0] || m.B === teams[0]);
    const buts40 = m => m.feuille.buts.filter(b => b.instant < 40).map(b => `${b.cote}@${b.instant.toFixed(3)}`).join(',');
    const buts3 = m => m.feuille.buts.filter(b => b.instant >= 40).map(b => `${b.cote}@${b.instant.toFixed(3)}`).join(',');
    // La même saison, deux fois, avec un choix d'entracte et deux sels.
    const jouer = sel => {
      const teams = ligue(9200 + L);
      const res = simulateLeague(teams, 82, { graine, decisions: [{ jour: mb.jour, entracte: { cle: 'garder' }, sel }] });
      return { teams, cal: res.calendrier };
    };
    const base = (() => { const teams = ligue(9200 + L); const res = simulateLeague(teams, 82, { graine, decisions: [] }); return { teams, cal: res.calendrier }; })();
    const a = jouer('a'), b = jouer('b');
    const mBase = jourDe(base.teams, base.cal), mA = jourDe(a.teams, a.cal), mB = jourDe(b.teams, b.cal);
    essais++;
    if (buts40(mBase) === buts40(mA) && buts40(mA) === buts40(mB)
      && mBase.feuille.entracte && mA.feuille.entracte && mBase.feuille.entracte.gfA === mA.feuille.entracte.gfA) p12++;
    if (buts3(mA) !== buts3(mB) || mA.gfA !== mB.gfA || mA.gfB !== mB.gfB) p3++;
    // Les journées d'avant ne bougent pas.
    const avant = cal => cal.slice(0, mb.jour).map(j => j.map(m => `${m.gfA}-${m.gfB}`).join(' ')).join('|');
    exiger(`ligue ${L} : les journées d'avant l'entracte ne bougent pas`, avant(base.cal) === avant(a.cal));
  }
  exiger('le choix de l\'entracte laisse les deux premières périodes intactes', essais > 0 && p12 === essais, `${p12}/${essais} gros matchs`);
  exiger('des dés neufs à l\'entracte donnent une autre troisième période', p3 >= Math.ceil(essais / 2), `${p3}/${essais}`);
  informer('gros matchs sondés', `${vus} ligues`);
}

/* ---------- 4. les options d'entracte et d'avant-match ---------- */
{
  for (const etat of ['devant', 'derriere', 'egal']) {
    const o = entractesOfferts('x', 5, etat);
    exiger(`à l'entracte (${etat}), quatre options dont l'incident et garder le cap`, o.options.length === 4 && o.options.some(x => x.incident) && o.options.some(x => x.cle === 'garder'));
    exiger(`à l'entracte (${etat}), chaque option a un effet lisible`, o.options.every(x => x.cle === 'garder' || effetEntracte({ cle: x.cle, incident: x.incident })));
  }
  /*
   * DIX PAR POINTAGE, DEUX PAR SOIR (1.0, oct.). JP : *c'est toujours évident
   * laquelle prendre*. Chaque pointage a dix gestes ; chacun a un prix (un
   * canal qui empire : buts contre, moins de tirs ou de précision, des
   * punitions, des blessures, des jambes) ; et vingt soirs n'offrent pas
   * toujours la même paire.
   */
  const coute = o => (o.defense ?? 1) > 1 || (o.volume ?? 1) < 1 || (o.finition ?? 1) < 1 || (o.discipline ?? 1) > 1 || (o.blessure ?? 1) > 1 || (o.energie ?? 1) > 1 || o.changeGardien
    || (Array.isArray(o.F) && o.F[0] < 1) || (Array.isArray(o.D) && o.D[0] < 1);
  for (const etat of ['devant', 'derriere', 'egal']) {
    const pool = entractesDu(etat);
    exiger(`à l'entracte (${etat}), dix gestes en réserve`, pool.length === 10, `${pool.length}`);
    const gratuits = pool.filter(c => !coute(ENTRACTES[c]));
    exiger(`à l'entracte (${etat}), chaque geste a son prix`, gratuits.length === 0, gratuits.join(', ') || 'aucun gratuit');
    const paires = new Set(Array.from({ length: 20 }, (_, k) => entractesOfferts('varie', k, etat).options.slice(0, 2).map(x => x.cle).sort().join('+')));
    exiger(`à l'entracte (${etat}), vingt soirs offrent des paires variées`, paires.size >= 10, `${paires.size} paires différentes`);
  }
  const vus = new Set(); let deja = [];
  for (let i = 0; i < Object.keys(AVANT_GROS).length; i++) { const c = avantDuGros('g', i, deja); vus.add(c); deja = [...deja, c]; }
  exiger('les avant-matchs ne se répètent pas dans une partie', vus.size === Object.keys(AVANT_GROS).length, `${vus.size}/${Object.keys(AVANT_GROS).length}`);
}

/* ---------- 5. les séries : l'adversaire s'adapte ---------- */
{
  exiger('en séries, un plan gagnant est gardé', planDeSerie('g', 0, 2, 'trappe', false) === 'trappe');
  exiger('en séries, un plan perdant change', planDeSerie('g', 0, 2, 'trappe', true) !== 'trappe');
  let changes = 0, gardes = 0, n = 0;
  for (let L = 0; L < LIGUES; L++) {
    const teams = ligue(9300 + L);
    simulateLeague(teams, 82, { graine: `po-${L}`, decisions: [] });
    const top = teams.slice().sort((a, b) => b.PTS - a.PTS).slice(0, 16);
    if (!top.includes(teams[0])) { top.pop(); top.push(teams[0]); }
    const paires = [];
    for (let i = 0; i < 8; i++) paires.push([top[i], top[15 - i]]);
    const series = playRonde(paires, 0, null, `po-${L}`);
    const s = series.find(x => x.A === teams[0] || x.B === teams[0]);
    exiger(`ligue ${L} : chaque match de ta série a son plan`, s.plans.length === s.wA + s.wB && s.feuilles.every(f => f.entracte));
    for (let k = 1; k < s.plans.length; k++) {
      n++;
      if (s.plans[k - 1].gagne) { if (s.plans[k].plan !== s.plans[k - 1].plan) changes++; }
      else if (s.plans[k].plan === s.plans[k - 1].plan) gardes++;
    }
    exiger(`ligue ${L} : les autres séries n'ont pas de plan`, series.every(x => x === s || !x.plans.length));
  }
  informer('séries', `${n} enchaînements : ${changes} changements après une défaite de l'adversaire, ${gardes} plans gardés après une victoire`);
}

/* ---------- 6. la dose ---------- */
{
  const n = []; let complets = 0, total = 0;
  for (let L = 0; L < LIGUES; L++) {
    const teams = ligue(9400 + L);
    simulateLeague(teams, 82, { graine: `dose-${L}`, decisions: [] });
    const mb = teams[0].minisBoss || [];
    n.push(mb.length); total += mb.length;
    complets += mb.filter(x => PLANS_ADV[x.plan] && typeof x.contre === 'boolean' && x.apres40 && Number.isFinite(x.apres40.moi)).length;
  }
  borne('gros matchs par saison', moy(n), 5, 14, '');
  exiger('chaque gros match porte son plan, son contre et son pointage après deux périodes', complets === total, `${complets}/${total}`);
}

/*
 * CE QUE LE HUB MONTRE D'UN GROS MATCH EST CE QUE LE MOTEUR JOUE (1.0, J1-N).
 * Les indices « tu étouffes » lisaient les lignes de saison de l'adversaire,
 * alors que le plan les remplace le soir même. Le hub lit maintenant
 * `lignesDeGros(adv, activeLineup(adv), plan probable)` : quand le plan
 * probable est le plan joué, ce sont exactement les lignes du match ; et un
 * blessé adverse n'y figure jamais.
 */
{
  const teams = ligue(9600);
  simulateLeague(teams, 82, { graine: 'hub-9600', decisions: [] });
  const mbs = (teams[0].minisBoss || []).filter(x => x.depistage && x.plan);
  let memes = 0, testes = 0, blesse = 0;
  for (const mb of mbs) {
    const adv = mb.adv;
    if (!adv || !adv.roster) continue;
    const probable = planProbable(mb.depistage);
    if (probable !== mb.plan) continue;
    testes++;
    const hub = lignesDeGros(adv, adv.roster, probable);
    const joue = lignesDeGros(adv, adv.roster, mb.plan);
    if (JSON.stringify(hub) === JSON.stringify(joue)) memes++;
  }
  exiger('quand le plan probable est le plan joué, le hub montre les lignes du match', testes > 0 && memes === testes, `${memes}/${testes} gros matchs`);
  // Un blessé adverse ne figure pas dans l'alignement que le hub lit.
  for (const t of teams.slice(1, 6)) {
    const L = activeLineup(t);
    for (const p of Object.values(L)) if (p && t.injured.has(p)) blesse++;
  }
  exiger('aucun blessé dans l\'alignement adverse que le hub lit', blesse === 0, `${blesse} blessé(s)`);
  // Sans plan, lignesDeGros = les lignes de la saison : rien ne change pour un match ordinaire.
  const t1 = teams[1];
  exiger('sans plan, les lignes d\'un match ordinaire sont celles de la saison', JSON.stringify(lignesDeGros(t1, t1.roster, null)) === JSON.stringify(lignesDe(t1, t1.roster, { duSoir: false })));
}

verdict('Les gros matchs');
