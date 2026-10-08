/*
 * UN ÉVÉNEMENT SE SENT, DES DEUX CÔTÉS (V3.4). JP : *tu scores plus, mais
 * l'adversaire aussi ; ton gardien arrête plus, mais plus de rebonds* ; *dans
 * ce sens-là*. Chaque événement de la banque est lu pour un club contre un
 * adversaire, le soir où il joue (`chiffresDuSoir`, la même lecture que les
 * chiffres à l'écran, que check_chiffres garantit égale au moteur) :
 *   1. il change la feuille : au moins un dixième de but par match, d'un côté
 *      ou de l'autre, pour presque tous ceux qui touchent aux buts ;
 *   2. la médiane se sent : un tiers de but marqué par match, au moins ;
 *   3. ça reste un échange : le net sur toute sa durée, en médiane, sous deux
 *      buts (la mesure en victoires, en paires, est check_banque).
 * Avant l'ampleur (`AMPLEUR_EVENEMENT`, js/banque.js) : 0,18 but marqué et
 * 0,08 accordé par match en médiane, 31 événements sous le dixième.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam } from '../js/sim.js';
import { chiffresDuSoir } from '../js/impact.js';
import { BANQUE, payloadDe, AMPLEUR_EVENEMENT } from '../js/banque.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed, n) {
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

console.log('\n  UN ÉVÉNEMENT SE SENT, DES DEUX CÔTÉS\n');
const [A, B] = ligue(4242, 2);
const base = chiffresDuSoir(A, null, B);
const BUTS = ['volume', 'finition', 'defense', 'discipline'];
const lignes = [];
for (const [id, c] of Object.entries(BANQUE)) {
  if (c.cat !== 'evenement') continue;
  const p = payloadDe(id);
  if (!p || !p.effet) continue;
  const { nom, ico: _i, duree, regle: _r, ...e } = p.effet;
  A._effetMatch = [e];
  const av = chiffresDuSoir(A, null, B);
  delete A._effetMatch;
  const bp = av.butsPour - base.butsPour, bc = av.butsContre - base.butsContre;
  lignes.push({ nom, duree: duree || 0, bp, bc, total: (bp - bc) * (duree || 0), buts: BUTS.some(k => k in e) });
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const f2 = x => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2).replace('.', ',')}`;
const touchent = lignes.filter(l => l.buts);
const muets = touchent.filter(l => Math.max(Math.abs(l.bp), Math.abs(l.bc)) < 0.1);
informer('l\'ampleur', `×${AMPLEUR_EVENEMENT} sur l'écart de chaque canal, le gain et son prix`);
informer('médianes par match', `${f2(med(lignes.map(l => Math.abs(l.bp))))} but marqué · ${f2(med(lignes.map(l => Math.abs(l.bc))))} accordé · sur ${med(lignes.map(l => l.duree))} matchs`);
const ouverts = lignes.filter(l => l.bp >= 0.25 && l.bc >= 0.25).sort((a, b) => b.bp + b.bc - a.bp - a.bc).slice(0, 3);
if (ouverts.length) informer('les matchs qui s\'ouvrent', ouverts.map(l => `${l.nom} ${f2(l.bp)} / ${f2(l.bc)}`).join(' · '));
borne('presque tous ceux qui touchent aux buts changent la feuille (part sous un dixième de but)', muets.length / touchent.length, 0, 0.1);
borne('la médiane se sent : buts marqués par match', med(lignes.map(l => Math.abs(l.bp))), 0.3, 1);
borne('ça reste un échange : le net sur toute la durée, en médiane (buts)', med(lignes.map(l => Math.abs(l.total))), 0, 2);
exiger('aucun événement ne dépasse deux buts par match d\'un côté', lignes.every(l => Math.abs(l.bp) <= 2 && Math.abs(l.bc) <= 2), lignes.filter(l => Math.abs(l.bp) > 2 || Math.abs(l.bc) > 2).map(l => l.nom).join(', ') || `${lignes.length} événements`);
verdict();
