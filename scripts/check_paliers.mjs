/**
 * MONTER UN PALIER (V2.4) — ce que vaut une carte qui monte un badge, EN PAIRES.
 *
 *   node scripts/check_paliers.mjs            (LIGUES=4 par défaut, deux minutes)
 *
 * « L'été de travail » (le premier badge d'un joueur monte au suivant) et « Le mentor » (ses compagnons de ligne
 * montent tant qu'ils jouent avec lui), posés au premier soir sur le centre du premier trio de chaque club traité.
 * L'été de travail est une peu commune (±1,5 V, CLAUDE.md), le mentor une rare (±2,5 V) ; ce sont des gains purs
 * (aucun prix), donc jamais un piège — au bruit près (−0,5 V à quatre ligues). Un palier sur un seul joueur est
 * petit : mesuré −0,1 V, c'est-à-dire rien qu'on distingue du bruit ; check_atelier prouve que le moteur le joue.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, getPlayerKey } from '../js/sim.js';
import { payloadDe } from '../js/banque.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 4);
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
  return out;
}
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const signe = x => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`;
const CENTRE = SLOTS.find(s => s.group === 'F' && s.unit === 0 && s.role === 'C' && !s.scratch);

/* La même ligue deux fois : la carte aux pairs, puis aux impairs ; chaque club contre lui-même. */
function paires(cle) {
  const dv = [];
  for (let Lg = 0; Lg < LIGUES; Lg++) {
    const bras = [];
    for (const parite of [0, 1]) {
      const teams = ligue(6100 + Lg);
      const decisions = teams.map((t, i) => [t, i]).filter(([t, i]) => i % 2 === parite && t.roster[CENTRE.i])
        .map(([t, equipe]) => ({ jour: 0, equipe, ...payloadDe(`joueur:${cle}`, { joueur: getPlayerKey(t.roster[CENTRE.i]) }) }));
      simulateLeague(teams, 82, { graine: `paliers-${Lg}`, decisions });
      bras.push(teams.map(t => t.W));
    }
    for (let i = 0; i < 32; i++) dv.push(bras[i % 2][i] - bras[1 - (i % 2)][i]);
  }
  return moy(dv);
}

console.log(`\n  MONTER UN PALIER · ${LIGUES} ligues × 32 équipes, en paires\n`);
const ete = paires('entrainement'), mentor = paires('mentorTrio');
informer('l\'été de travail, sur le centre du premier trio', `${signe(ete)} V`);
informer('le mentor, sur le centre du premier trio', `${signe(mentor)} V`);
borne('l\'été de travail : jamais un piège, borné comme une peu commune', ete, -0.5, 1.5, ' V');
borne('le mentor : jamais un piège, borné comme une rare', mentor, -0.5, 2.5, ' V');
verdict();
