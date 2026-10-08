/*
 * LA LANCÉE ET LE DOUTE DU ROGUE (V3.6). JP : *sa performance influence ses
 * performances plus tard*. Ce qu'on exige :
 *   1. le 82-0 n'en a pas : une ligue sans `courbe` ne pose jamais la lancée ni le doute ;
 *   2. la même graine rejoue la même saison Rogue, au but près ;
 *   3. en Rogue, un joueur SUR SA LANCÉE marque plus qu'un joueur dans le même
 *      état sans l'effet (la même lecture de ses feuilles, dans une ligue 82-0),
 *      et un marqueur qui DOUTE marque moins — c'est ce que le jeu promet ;
 *   4. combien de joueurs, combien de soirs : du chaos, pas un régime.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, lanceeDe, LANCEE } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
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

/* Une saison, et, pour chaque patineur-soir, son état lu sur ses feuilles d'avant et ses buts de ce soir. */
function saison(seed, courbe) {
  const teams = ligue(seed);
  const L = creerLigue(teams, 82, { graine: `lancee:${seed}`, courbe });
  jouerJusqua(L, Infinity);
  const recents = new Map(), etats = { lancee: [], doute: [], aucun: [] };
  let poses = 0, buts = 0;
  for (const jour of L.calendrier) for (const m of jour) {
    const f = m.feuille;
    for (const cote of ['A', 'B']) for (const p of f.alignes[cote]) {
      const r = recents.get(p) || [];
      const n = f.buts.filter(b => b.cote === cote && b.marqueur === p).length;
      etats[lanceeDe(p, r) || 'aucun'].push(n);
      r.push(n); if (r.length > LANCEE.doute.matchs) r.shift();
      recents.set(p, r);
      buts += n;
    }
  }
  for (const t of teams) for (const p of Object.values(t.roster)) if (p && (p._lancee || p._recents)) poses++;
  return { etats, poses, buts, fiche: teams.map(t => `${t.W}-${t.L}-${t.OTL}`).join(' ') };
}

console.log('\n  LA LANCÉE ET LE DOUTE DU ROGUE\n');
const moy = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const SEEDS = [11, 23, 37, 41, 53, 67];
const rogue = SEEDS.map(s => saison(s, true)), classique = SEEDS.map(s => saison(s, false));
const tous = (xs, k) => xs.flatMap(x => x.etats[k]);

exiger('le 82-0 n\'a ni lancée ni doute : aucun joueur ne les porte', classique.every(x => x.poses === 0), classique.map(x => x.poses).join(' · '));
const encore = saison(SEEDS[0], true);
exiger('la même graine rejoue la même saison Rogue', encore.fiche === rogue[0].fiche && encore.buts === rogue[0].buts, `${encore.buts} buts`);

const chR = moy(tous(rogue, 'lancee')), chC = moy(tous(classique, 'lancee'));
const frR = moy(tous(rogue, 'doute')), frC = moy(tous(classique, 'doute'));
informer('sur sa lancée : buts par soir', `Rogue ${chR.toFixed(3)} (${tous(rogue, 'lancee').length} soirs) · sans l'effet ${chC.toFixed(3)} (${tous(classique, 'lancee').length} soirs)`);
informer('qui doute : buts par soir', `Rogue ${frR.toFixed(3)} (${tous(rogue, 'doute').length} soirs) · sans l'effet ${frC.toFixed(3)} (${tous(classique, 'doute').length} soirs)`);
// Le repère : l'effet se voit dans le sens promis, sans devenir une caricature (au plus +30 % / −30 %).
borne('sur sa lancée, il marque plus qu\'à état égal sans l\'effet (rapport)', chR / chC, 1.02, 1.30);
borne('quand il doute, il marque moins qu\'à état égal sans l\'effet (rapport)', frR / frC, 0.70, 0.99);
const part = k => tous(rogue, k).length / (tous(rogue, 'lancee').length + tous(rogue, 'doute').length + tous(rogue, 'aucun').length);
borne('soirs sur sa lancée ou dans le doute : du chaos, pas un régime', part('lancee') + part('doute'), 0.005, 0.10);
informer('buts par saison', `Rogue ${(moy(rogue.map(x => x.buts)) / 32).toFixed(1)} par club · sans l'effet ${(moy(classique.map(x => x.buts)) / 32).toFixed(1)}`);
verdict();
