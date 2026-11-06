/*
 * LES BLESSÉS QUI JOUENT (V9, tranche 6 — docs/refonte-v9.md § 6.6). En Rogue, un blessé peut jouer diminué ; une
 * commotion se garde. De vraies ligues de 32 vestiaires, ton club en Rogue. Ce qu'on exige :
 *   1. « Le jouer blessé » : il sort de l'infirmerie le jour même, joue le soir suivant, diminué (« Il joue amoché »)
 *      le temps qu'il lui restait ; s'il se blesse encore, l'absence s'allonge de ce temps-là ;
 *   2. une commotion se garde : la suivante d'un même joueur porte sa mémoire, en Rogue seulement ; le report d'une
 *      saison à l'autre (`commotions`) compte aussi.
 * Les fils qui revenaient (§ 6.7, `CHOIX_DES_FILS`) sont partis en V25 C1 : la promesse d'une histoire se juge dans check_suivis.
 * `GRAINES` : les ligues (83,85,86 par défaut).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, getPlayerKey, SITUATIONS, JOUER_BLESSE_MAX, JAMAIS_BLESSE } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';
import '../js/greffes.js';   // V25 : une ligue de run (courbe) joue avec les greffes du Rogue branchées

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const RECRUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'recrues.json'), 'utf8'));
const GRAINES = String(process.env.GRAINES || '83,85,86').split(',').map(Number);
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => {
  const rk = new Set(RECRUES[s] || []);
  const p = un.flat().map(x => ({ ...x, ...(rk.has(x.id) ? { rk: 1 } : {}) }));
  p.forEach(registerHiddenRatings);
  return createTeam(nom, tag, autoRoster(p), { season: s });
};
function ligue(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
/* Une saison de Rogue, ton club en tête, avec ces décisions, jouée jusqu'à la journée `jusqua`. */
function saison(seed, decisions = [], { jusqua = Infinity, courbe = true } = {}) {
  const teams = ligue(seed);
  teams[0].isPlayer = true;
  const L = creerLigue(teams, 82, { graine: `retours-${seed}`, decisions, courbe });
  jouerJusqua(L, jusqua);
  return { L, you: teams[0] };
}
const tes = (L, you) => L.calendrier.flatMap((jour, j) => jour.filter(m => m.joue && (m.A === you || m.B === you)).map(m => ({ j, m })));
const empreinte = (L, avant) => L.calendrier.slice(0, avant).map(jour => jour.map(m => `${m.gfA}-${m.gfB}`).join(',')).join('|');
const parCle = (you, k) => Object.values(you.roster).find(p => p && getPlayerKey(p) === k);

console.log('\n  LES BLESSÉS QUI JOUENT (V9, tranche 6)\n');
const t0 = Date.now();
const fautes = [];
let blesses = 0, sortis = 0, joue = 0, amoche = 0, aggravees = 0, aggraveesOk = 0, memoires = 0, memoiresOk = 0, memoiresHors = 0, reports = 0, reportsOk = 0;
const faute = t => { if (fautes.length < 10) fautes.push(t); };

for (const seed of GRAINES) {
  const base = saison(seed);
  const empreinteAvant = J => empreinte(base.L, J);
  // 1. Le jouer blessé : la première blessure qui s'y prête, décidée le matin d'après.
  const b0 = base.you.injuriesLog.find(b => b.player.p !== 'G' && !JAMAIS_BLESSE.includes(b.genre) && b.games >= 2 && b.games <= JOUER_BLESSE_MAX && Number.isFinite(b.jour));
  if (b0) {
    blesses++;
    const J = b0.jour + 1, cle = getPlayerKey(b0.player);
    const r = saison(seed, [{ jour: J, palier: `b:${b0.at}:${cle}`, blesse: { joueur: cle }, sel: 't6-blesse' }]);
    const p = parCle(r.you, cle);
    const log = r.you.injuriesLog.find(x => x.player === p && x.at === b0.at);
    if (empreinte(r.L, J) === empreinteAvant(J) && log && log.joueBlesse && log.at + log.games <= tes(r.L, r.you).filter(x => x.j < J).length) sortis++;
    else faute(`jouer blessé : il ne sort pas de l'infirmerie (${JSON.stringify(log && { at: log.at, games: log.games, jb: log.joueBlesse })})`);
    const suivant = tes(r.L, r.you).find(x => x.j >= J);
    const cote = suivant && (suivant.m.A === r.you ? 'A' : 'B');
    if (suivant && (suivant.m.feuille.alignes[cote] || []).includes(p)) joue++; else faute('jouer blessé : il ne joue pas le soir suivant');
    const A = SITUATIONS.amoche;
    const e = (r.you.effetsCibles || []).find(x => x.source === 'blesse' && x.joueur === p);
    if (e && e.debut === J && e.finition === A.finition && e.lancers === A.lancers && e.blessure === A.blessure) amoche++; else faute('jouer blessé : le profil « Il joue amoché » manque');
    // L'aggravation : une nouvelle blessure pendant qu'il jouait blessé porte sa dette.
    const ag = r.you.injuriesLog.filter(x => x.player === p && x.aggrave);
    for (const x of ag) { aggravees++; if (x.aggrave === log.joueBlesse && x.games > x.aggrave) aggraveesOk++; }
  }
  // 2. La mémoire des commotions, en Rogue ; jamais hors du Rogue.
  for (const x of base.you.injuriesLog.filter(y => y.genre === 'commotion')) {
    const avant = base.you.injuriesLog.filter(y => y.player === x.player && y.genre === 'commotion' && y.at < x.at).length;
    if (avant) { memoires++; if (x.memoire === avant) memoiresOk++; } else if (x.memoire) faute('une première commotion porte une mémoire');
  }
  const hors = saison(seed, [], { courbe: false });
  memoiresHors += hors.you.injuriesLog.filter(y => y.memoire).length;
  // Le report d'une saison à l'autre : chacun de tes patineurs a déjà eu une commotion.
  const commotions = Object.fromEntries(Object.values(base.you.roster).filter(p => p && p.p !== 'G').map(p => [getPlayerKey(p), 1]));
  const rep = saison(seed, [{ jour: 0, commotions, report: true }]);
  for (const x of rep.you.injuriesLog.filter(y => y.genre === 'commotion')) {
    reports++;
    const avant = rep.you.injuriesLog.filter(y => y.player === x.player && y.genre === 'commotion' && y.at < x.at).length;
    if (x.memoire === avant + 1) reportsOk++;
  }
}

exiger('jouer blessé : il sort de l\'infirmerie le jour même, rien d\'avant ne bouge', blesses > 0 && sortis === blesses, `${sortis} sur ${blesses}`);
exiger('jouer blessé : il joue le soir suivant', joue === blesses, `${joue} sur ${blesses}`);
exiger('jouer blessé : diminué, « Il joue amoché », le temps qu\'il lui restait', amoche === blesses, `${amoche} sur ${blesses}`);
exiger('l\'aggravation porte ce qu\'il avait emprunté', aggraveesOk === aggravees, `${aggraveesOk} sur ${aggravees} aggravation(s)`);
exiger('une commotion se garde : la suivante d\'un joueur en porte la mémoire', memoiresOk === memoires, `${memoiresOk} sur ${memoires}`);
exiger('hors du Rogue, aucune mémoire', memoiresHors === 0, `${memoiresHors}`);
exiger('le report d\'une saison à l\'autre compte', reportsOk === reports && reports > 0, `${reportsOk} sur ${reports} commotion(s)`);
if (fautes.length) informer('les fautes', fautes.join(' · '));
informer('le temps', `${Math.round((Date.now() - t0) / 1000)} s (${GRAINES.length} ligues)`);
verdict();
