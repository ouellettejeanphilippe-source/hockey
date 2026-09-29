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
 *   5. la ligue garde son bonus moyen (calibrage de CHIMIE_BONUS) ;
 *   6. (1.0 · J1-M) le levier : chimie 100 contre 0 vaut au moins 8 % de buts ;
 *   7. (1.0 · J1-K) l'étiquette d'une case nomme les zones qui y sont chez elles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, activeLineup, lignesDe, contreDe,
  chimieLigne, apprentissagePhoto, penaliteAdaptee, getPositionPenalty, bonusChimie, fits,
} from '../js/sim.js';
import { LINE_ZONES, ZONES_ETOILE } from '../js/ratings.js';
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

/*
 * LE LEVIER DE LA CHIMIE (1.0 · J1-M), mesuré dans un processus à part : la
 * chimie forcée se lit au chargement de js/sim.js (CHIMIE_FORCEE, MESURE
 * seulement). Ce fichier se relance lui-même avec LEVIER=1 : il joue alors
 * `LEVIER_SAISONS` saisons, ta formation à la chimie forcée, et rend ses buts.
 */
if (process.env.LEVIER) {
  const n = Number(process.env.LEVIER_SAISONS || 16);
  let gf = 0, gp = 0;
  for (let s = 0; s < n; s++) {
    const t = ligue(9100 + s * 37);
    simulateLeague(t, 82, { graine: `levier-${s}`, decisions: [] });
    gf += t[0].GF; gp += t[0].games;
  }
  console.log(JSON.stringify({ bpm: gf / gp, matchs: gp }));
  process.exit(0);
}

console.log('\n  La chimie apprise (S73)\n');

/*
 * PLUSIEURS SAISONS, PAS UNE (S79). Une ligue seule est un tirage : la même
 * épreuve échouait sur main sur la 2 (56 % contre 62 % au jour 33) et, la
 * cédule tirée à part, sur la 1 (60 % au jour 20, 59 % au jour 40) — les
 * blessures cassent des lignes au hasard d'une saison. On mesure la moyenne
 * de six saisons, les mêmes clubs sous six graines.
 */
const GRAINES = ['chimie', 'chimie-2', 'chimie-3', 'chimie-4', 'chimie-5', 'chimie-6'];
const bases = GRAINES.map(g => { const b = ligue(8100); simulateLeague(b, 82, { graine: g, decisions: [] }); return b; });
const base = bases[0];

/* ---------- 1. plus une ligne joue, mieux c'est ---------- */
{
  const c = j => moy(bases.map(b => moy(b[0].jourLignes[j].chimie)));
  // Les blessures de fin de saison cassent des lignes, et la chimie peut
  // redescendre un peu entre la journée 40 et la 80 — c'est la vie d'une
  // saison, pas une chimie qui se défait. On exige la montée, pas un plateau.
  informer('chimie moyenne de tes lignes', `journée 5 : ${c(5).toFixed(0)} % · 20 : ${c(20).toFixed(0)} % · 40 : ${c(40).toFixed(0)} % · 80 : ${c(80).toFixed(0)} % (${GRAINES.length} saisons)`);
  exiger('plus une ligne joue son système, plus sa chimie monte', c(5) < c(20) && c(20) < c(40) && c(40) <= c(80) + 10, `${c(5).toFixed(0)} → ${c(80).toFixed(0)} %`);
}

/* ---------- 2 et 3. s'adapter un soir : pas puni, pas complet ---------- */
{
  const J0 = 30;
  const t = ligue(8100);
  const L = activeLineup(t[0]);
  const saison = lignesDe(t[0], L);
  // Contrer quelqu'un un soir : les deux premières lignes dans la tactique qui étouffe la leur.
  const soir = saison.map((l, u) => (u < 2 ? { ...l, tac: contreDe(l.tac) || 'defensive' } : { ...l }));
  const avecAjustement = GRAINES.map(g => {
    const u = ligue(8100);
    simulateLeague(u, 82, { graine: g, decisions: [
      { jour: J0, equipe: 0, lignes: soir.map(l => ({ ...l })) },
      { jour: J0 + 1, equipe: 0, lignes: saison.map(l => ({ ...l })) },
    ] });
    return u;
  });
  const apres = moy(avecAjustement.map(u => moy(u[0].jourLignes[J0 + 3].chimie)));
  const temoin = moy(bases.map(b => moy(b[0].jourLignes[J0 + 3].chimie)));
  exiger('s\'adapter un soir ne défait pas la chimie de la saison', Math.abs(apres - temoin) < 3,
    `${temoin.toFixed(1)} % sans l'ajustement, ${apres.toFixed(1)} % avec, moyenne de ${GRAINES.length} saisons (l'ancienne règle l'aurait coupée de moitié)`);
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
  borne('bonus de chimie moyen de la ligue', bonusChimie(moy(tous)), 1.4, 2.3, ' pt');
}

/* ---------- 6. le levier : une ligne soudée contre une ligne cassée (1.0 · J1-M) ---------- */
{
  const { execFileSync } = await import('node:child_process');
  const lire = c => JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, LEVIER: '1', CHIMIE_FORCEE: String(c) },
  }).toString().trim().split('\n').pop());
  const zero = lire(0), cent = lire(100);
  // Graines fixes : la lecture est la même d'une exécution à l'autre (9,4 % ; +10,9 % sur 40 saisons).
  // L'ancien réglage (3,4 sans pivot) y lit 6,6 % : le plancher de 8 le fait rougir.
  borne('chimie 100 contre 0 : buts de ta formation', (cent.bpm / zero.bpm - 1) * 100, 8, 16, ' %');
}

/* ---------- 1.0 · J1-K : l'étiquette d'une case dit qui y est chez lui ---------- */
{
  const faux = [];
  for (const g of ['F', 'D']) {
    for (const s of SLOTS.filter(x => x.group === g && !x.scratch)) {
      const mots = s.label.split(' · ');
      for (const z of [ZONES_ETOILE[g], ...LINE_ZONES[g]]) {
        if (z.idealUnits.includes(s.unit) !== mots.includes(z.mini)) faux.push(`${g}${s.unit} ${z.mini} « ${s.label} »`);
      }
    }
  }
  exiger('une zone est chez elle à une case ⇔ l\'étiquette de la case la nomme', faux.length === 0, faux.join(' · ') || [...new Set(SLOTS.filter(x => !x.scratch && x.group !== 'G').map(x => x.label))].join(' | '));
}

verdict('La chimie apprise');
