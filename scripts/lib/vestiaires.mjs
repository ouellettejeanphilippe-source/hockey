/*
 * Les vestiaires que les scripts d'analyse se partagent.
 *
 * Deux d'entre eux posent la même question sous deux angles : `mock_zones.mjs`
 * demande ce que vaut le meilleur alignement légal sur l'INDICE de cotes,
 * `check_plafond.mjs` demande combien de matchs il GAGNE. Ils doivent donc
 * partir du même vestiaire, sinon on compare deux choses différentes en
 * croyant mesurer un écart.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAP } from '../../js/sim.js';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');

export const tri = a => a.slice().sort((x, y) => y.v - x.v);

/** Tous les joueurs des 55 saisons, une ligne par joueur-saison. */
export function tousLesJoueurs(minGP = 20) {
  const best = new Map();
  for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
    for (const p of JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8')).players) {
      if (p.gp < minGP) continue;
      const k = `${p.id}|${p.s}`;
      if (!best.has(k) || p.v > best.get(k).v) best.set(k, p);
    }
  }
  return [...best.values()];
}

/**
 * Le meilleur alignement légal atteignable sous le plafond, cueillette libre
 * sur les 55 saisons : on remplit au moins cher, puis on améliore au meilleur
 * gain de cote par dollar tant que le plafond le permet.
 */
export function meilleurAlignementLegal(tous = tousLesJoueurs()) {
  const BESOIN = { F: 12, D: 6, G: 2 };
  const roster = {};
  for (const [pos, n] of Object.entries(BESOIN)) {
    roster[pos] = tous.filter(p => p.p === pos).sort((a, b) => a.$ - b.$).slice(0, n);
  }
  let masse = Object.values(roster).flat().reduce((s, p) => s + p.$, 0);
  for (let tour = 0; tour < 4000; tour++) {
    let meilleur = null;
    for (const pos of Object.keys(BESOIN)) {
      const cur = roster[pos];
      const pire = cur.reduce((a, b) => (a.v <= b.v ? a : b));
      const ids = new Set(cur.map(p => `${p.id}|${p.s}`));
      for (const c of tous) {
        if (c.p !== pos || ids.has(`${c.id}|${c.s}`) || c.v <= pire.v) continue;
        const cout = c.$ - pire.$;
        if (masse + cout > CAP) continue;
        const r = cout > 0 ? (c.v - pire.v) / cout : Infinity;
        if (!meilleur || r > meilleur.r) meilleur = { r, pos, pire, c, cout };
      }
    }
    if (!meilleur) break;
    roster[meilleur.pos] = roster[meilleur.pos].filter(p => p !== meilleur.pire).concat(meilleur.c);
    masse += meilleur.cout;
  }
  return { unites: [tri(roster.F), tri(roster.D), tri(roster.G)], masse };
}

/** Quatre vraies équipes témoins : deux sommets, un plafond moderne, un fond. */
export const TEMOINS = [
  ['MTL 76-77', '1976-77', 'MTL'], ['BOS 70-71', '1970-71', 'BOS'],
  ['NYI 92-93', '1992-93', 'NYI'], ['DET 76-77', '1976-77', 'DET'],
];

export function equipeReelle(saison, tag, minGP = 10) {
  const ps = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, `${saison}.json`), 'utf8'))
    .players.filter(p => p.t === tag && p.gp >= minGP);
  return [tri(ps.filter(p => p.p === 'F')).slice(0, 12),
          tri(ps.filter(p => p.p === 'D')).slice(0, 6),
          ps.filter(p => p.p === 'G').sort((a, b) => b.gp - a.gp)];
}

export const equipesTemoins = () => TEMOINS.map(([lab, s, t]) => [lab, equipeReelle(s, t)]);
