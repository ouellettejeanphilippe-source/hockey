/*
 * LA CHIMIE APPRISE (S73) — ce qui doit tenir.
 *
 *   node scripts/check_chimie.mjs
 *
 * JP : *l'important est que je puisse m'adapter aux adversaires, mais pas
 * complètement, d'où l'apprentissage de la chimie entre les joueurs et avec
 * les stratégies, mais sans punir les ajustements* ; *plus une ligne joue une
 * stratégie, mieux c'est* ; *les joueurs s'adaptent à leur position dans
 * l'alignement* ; *comme un deck de deckbuilder*. On exige :
 *   1. plus une ligne joue un système, plus sa chimie monte ;
 *   2. s'adapter UN soir (changer de tactique pour contrer) ne coûte presque
 *      rien à la chimie de la saison — l'ancienne règle la coupait de moitié ;
 *   3. mais s'adapter n'est pas complet : un système peu joué a moins de
 *      chimie ce soir-là que le système maîtrisé ;
 *   4. la pénalité d'un joueur hors position fond en jouant à cette case ;
 *   5. la ligue garde son bonus moyen (calibrage de CHIMIE_BONUS).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, activeLineup, lignesDe, contreDe,
  chimieLigne, apprentissagePhoto, penaliteAdaptee, getPositionPenalty, CHIMIE_BONUS, fits,
} from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed) {
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
  out[0].isPlayer = true;   // la photo de l'apprentissage n'est prise que pour ta formation
  return out;
}
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

console.log('\n  La chimie apprise (S73)\n');

/* ---------- 1. plus une ligne joue, mieux c'est ---------- */
const base = ligue(8100);
simulateLeague(base, 82, { graine: 'chimie', decisions: [] });
{
  const J = base[0].jourLignes;
  const c = j => moy(J[j].chimie);
  informer('chimie moyenne de tes lignes', `journée 5 : ${c(5).toFixed(0)} % · 20 : ${c(20).toFixed(0)} % · 40 : ${c(40).toFixed(0)} % · 80 : ${c(80).toFixed(0)} %`);
  exiger('plus une ligne joue son système, plus sa chimie monte', c(5) < c(20) && c(20) < c(40) && c(40) <= c(80) + 2, `${c(5).toFixed(0)} → ${c(80).toFixed(0)} %`);
}

/* ---------- 2 et 3. s'adapter un soir : pas puni, pas complet ---------- */
{
  const J0 = 30;
  const t = ligue(8100);
  const L = activeLineup(t[0]);
  const saison = lignesDe(t[0], L);
  // Contrer quelqu'un un soir : les deux premières lignes dans la tactique qui étouffe la leur.
  const soir = saison.map((l, u) => (u < 2 ? { ...l, tac: contreDe(l.tac) || 'defensive' } : { ...l }));
  simulateLeague(t, 82, { graine: 'chimie', decisions: [
    { jour: J0, equipe: 0, lignes: soir },
    { jour: J0 + 1, equipe: 0, lignes: saison.map(l => ({ ...l })) },
  ] });
  const apres = moy(t[0].jourLignes[J0 + 3].chimie), temoin = moy(base[0].jourLignes[J0 + 3].chimie);
  exiger('s\'adapter un soir ne défait pas la chimie de la saison', Math.abs(apres - temoin) < 3,
    `${temoin.toFixed(1)} % sans l'ajustement, ${apres.toFixed(1)} % avec (l'ancienne règle l'aurait coupée de moitié)`);
  // Pas complet : ce soir-là, le système peu joué a moins de chimie que le système maîtrisé.
  const photo = apprentissagePhoto(base[0].jourLignes[J0].apprentissage);
  const maitrise = chimieLigne(photo, L, 0, saison[0].tac), nouveau = chimieLigne(photo, L, 0, soir[0].tac);
  exiger('mais s\'adapter n\'est pas complet : un système peu joué a moins de chimie ce soir-là', nouveau < maitrise,
    `${saison[0].tac} ${maitrise.toFixed(0)} % contre ${soir[0].tac} ${nouveau.toFixed(0)} %`);
}

/* ---------- 4. la position s'apprend ---------- */
{
  const t = base[0];
  let p = null, slot = null;
  for (const s of SLOTS) {
    if (s.scratch || s.group !== 'F') continue;
    const c = Object.values(t.roster).find(x => x && x.p !== 'G' && fits(x, s) && getPositionPenalty(x, s) > 0);
    if (c) { p = c; slot = s; break; }
  }
  if (!p) informer('position', 'aucun avant hors position trouvé pour l\'épreuve');
  else {
    const garde = p._adapt;
    p._adapt = {};
    const neuf = penaliteAdaptee(p, slot);
    p._adapt = { [slot.role]: 15 };
    const rode = penaliteAdaptee(p, slot);
    p._adapt = garde;
    exiger('un joueur hors position s\'adapte en jouant à sa case', rode < neuf * 0.5 && neuf === getPositionPenalty(p, slot),
      `pénalité ${neuf.toFixed(1)} au premier match, ${rode.toFixed(1)} après quinze`);
  }
}

/* ---------- 5. le calibrage ---------- */
{
  const tous = [];
  for (const t of base) for (const j of t.jourLignes || []) if (j) tous.push(moy(j.chimie));
  borne('bonus de chimie moyen de la ligue', CHIMIE_BONUS * moy(tous) / 100, 1.4, 2.3, ' pt');
}

verdict('La chimie apprise');
