/*
 * L'AFFINITÉ ET LA CHIMIE (S73, V7, V18) — ce qui doit tenir.
 *
 *   node scripts/check_affinite.mjs
 *
 * V18, JP : *enlever [la chimie] comme avant, mais permettre affinité entre joueurs dont les styles marchent
 * ensemble*. La chimie d'une ligne vient de ses accords : deux joueurs de la ligne dont les badges s'accordent
 * (`AFFINITES`, `accordsDeLigne`), chacun au plus petit des deux badges (`chimieLigne`). On exige :
 *   1. rien ne s'apprend : après une saison, ni entente ni maîtrise, et les mêmes lignes lisent la même chimie
 *      qu'au premier soir ;
 *   2. les accords : chaque rôle d'un accord existe, chaque badge en a au moins un ; un accord est porté par deux
 *      joueurs différents de la ligne, à leur plus petit badge ; plus d'accords, plus de chimie ; une ligne sans
 *      accord joue quand même ensemble, une ligne incomplète n'a pas de chimie ;
 *   3. la pénalité d'un joueur hors position fond en jouant à cette case (S73) ;
 *   4. la ligue garde son bonus moyen (AFF_BASE, AFF_PALIER : la chimie qu'elle avait avec ses systèmes) ;
 *   5. (1.0 · J1-M) le levier : chimie 100 contre 0 vaut au moins 8 % de buts ;
 *   6. (1.0 · J1-K) l'étiquette d'une case nomme les zones qui y sont chez elles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, activeLineup,
  chimieLigne, penaliteAdaptee, copieDeJoueur, getPositionPenalty, bonusChimie, fits,
  AFFINITES, PROFILS, accordsDeLigne, joueursDeLigne, badgesDe, chimieMax, AFF_BASE,
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
  out[0].isPlayer = true;
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

console.log('\n  L\'affinité et la chimie (V18 : les accords de ses joueurs)\n');

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

/* ---------- 1. rien ne s'apprend ---------- */
{
  const t = base[0];
  const appris = Object.values(t.roster).filter(p => p && p._maitrise);
  exiger('après une saison, ni entente ni maîtrise', !t.entente && !appris.length, `${appris.length} joueurs avec une maîtrise`);
  // Les mêmes joueurs aux mêmes cases : la chimie après 82 matchs, et sur des copies neuves (rien de la saison).
  const L = activeLineup(t);
  const neuf = Object.fromEntries(Object.entries(L).map(([k, p]) => [k, p && copieDeJoueur(p)]));
  const apres = [0, 1, 2, 3].map(u => chimieLigne(L, u)), avant = [0, 1, 2, 3].map(u => chimieLigne(neuf, u));
  exiger('les mêmes lignes lisent la même chimie au premier soir et au 82e', apres.every((c, u) => Math.abs(c - avant[u]) < 1e-9),
    `${avant.map(c => c.toFixed(0)).join(' · ')} → ${apres.map(c => c.toFixed(0)).join(' · ')}`);
  informer('chimie moyenne de tes lignes', `journée 5 : ${moy(bases.map(b => moy(b[0].jourLignes[5].chimie))).toFixed(0)} % · 40 : ${moy(bases.map(b => moy(b[0].jourLignes[40].chimie))).toFixed(0)} % (les blessures cassent des lignes)`);
}

/* ---------- 2. les accords ---------- */
{
  const roles = AFFINITES.flatMap(a => [a.a, a.b]);
  const inconnus = roles.filter(([g, r]) => !(PROFILS[g] && PROFILS[g][r])).map(x => x.join(':'));
  exiger('chaque rôle d\'un accord est un badge de son groupe', !inconnus.length, inconnus.join(' · ') || `${AFFINITES.length} accords`);
  const seuls = Object.entries(PROFILS).flatMap(([g, P]) => Object.keys(P).filter(r => !roles.some(([g2, r2]) => g2 === g && r2 === r)).map(r => `${g}:${r}`));
  exiger('chaque badge s\'accorde avec au moins un autre', !seuls.length, seuls.join(' · ') || 'les douze badges');
  // Sur les vraies lignes de six ligues : deux joueurs différents de la ligne, au plus petit de leurs deux badges.
  const pal = (p, r) => { const b = badgesDe(p).find(x => x.cle === r); return b ? (b.second && !b.plein ? b.palier / 2 : b.palier) : 0; };
  const faux = [];
  let n = 0, sans = 0;
  for (const t of bases.flat()) {
    const L = activeLineup(t);
    for (let u = 0; u < 4; u++) {
      const js = joueursDeLigne(L, u), dans = new Set(Object.values(js).filter(Boolean));
      const acc = accordsDeLigne(L, u);
      if (!acc.length) sans++;
      for (const x of acc) {
        n++;
        if (x.a === x.b || !dans.has(x.a) || !dans.has(x.b)) faux.push(`${t.name} ${u + 1} ${x.aff.cle} : hors de la ligne`);
        else if (Math.abs(x.force - Math.min(pal(x.a, x.aff.a[1]), pal(x.b, x.aff.b[1]))) > 1e-9) faux.push(`${t.name} ${u + 1} ${x.aff.cle} : force ${x.force}`);
      }
    }
  }
  exiger('un accord : deux joueurs de la ligne, au plus petit de leurs badges', !faux.length, faux.slice(0, 4).join(' · ') || `${n} accords sur ${bases.flat().length * 4} lignes, ${sans} sans aucun`);
  // Les cases du club, pas son alignement du dernier soir : une fin de saison a ses blessés, et une ligne trouée n'a pas de chimie.
  const L = base[0].roster;
  const c = [0, 1, 2, 4, 8].map(a => chimieLigne(L, 0, a));
  exiger('plus d\'accords, plus de chimie', c.every((x, i) => !i || x > c[i - 1]), c.map(x => x.toFixed(0)).join(' < '));
  exiger('une ligne sans accord joue quand même ensemble', c[0] > 0 && Math.abs(c[0] - chimieMax(AFF_BASE) * 0.9) < 1e-9, `${c[0].toFixed(1)}`);
  const trou = { ...L };
  const s0 = SLOTS.find(s => !s.scratch && s.group === 'F' && s.unit === 0);
  trou[s0.i] = null;
  exiger('une ligne incomplète n\'a pas de chimie', chimieLigne(trou, 0) === 0, `${chimieLigne(trou, 0)}`);
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

verdict('L\'affinité');
