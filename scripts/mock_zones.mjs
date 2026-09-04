/*
 * Le malus de zone ferme-t-il l'empilement ?
 *
 * L'idée du jeu : la chasse aux aubaines est permise, mais un joueur hors de
 * sa zone rend moins, donc on ne peut pas empiler douze vedettes. Ce script
 * vérifie si les nombres actuels livrent cette promesse.
 *
 * Il bâtit le MEILLEUR alignement légal sous le plafond, en cueillette
 * totalement libre sur les 55 saisons — la borne supérieure absolue de ce
 * qu'un joueur peut atteindre — puis le compare à de vraies équipes, avec et
 * sans malus de zone.
 *
 * Reproduit getUnitSynergy de js/sim.js : +2 quand toute l'unité est à sa
 * place, sinon -min(ZONE_PEN_MAX, somme des écarts x pénalité asymétrique).
 *
 *   node scripts/mock_zones.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAP, ZONE_PEN_SOUS, ZONE_PEN_DESSUS, ZONE_PEN_MAX } from '../js/sim.js';
import { ZONE_THRESHOLDS, LINE_ZONES } from '../js/ratings.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');

const POIDS_TRIO = [0.34, 0.28, 0.22, 0.16];
const POIDS_PAIRE = [0.40, 0.34, 0.26];
const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

const zoneDe = (pos, v) => {
  const t = ZONE_THRESHOLDS[pos];
  for (let i = 0; i < t.length; i++) if (v >= t[i]) return i + 1;
  return t.length + 1;
};
const idealDe = (pos, niveau) => LINE_ZONES[pos][Math.min(LINE_ZONES[pos].length, niveau) - 1].idealUnits;
const calibreAttendu = (pos, unit) => {
  const zones = LINE_ZONES[pos];
  for (let i = 0; i < zones.length; i++) if (zones[i].idealUnits.includes(unit)) return ZONE_THRESHOLDS[pos][i] ?? 40;
  return 40;
};

/**
 * Indice composite d'un alignement.
 * `sous`   : pénalité par cran quand le joueur joue SOUS sa zone (talent gaspillé)
 * `dessus` : pénalité par cran quand il joue AU-DESSUS (il n'a pas mieux)
 * Par défaut : les constantes en vigueur, importées de js/sim.js.
 */
function indice(F, D, G, { sous = ZONE_PEN_SOUS, dessus = ZONE_PEN_DESSUS, plafond = ZONE_PEN_MAX, malus = true } = {}) {
  const unite = (js, poids, taille, pos) => {
    let off = 0, def = 0;
    for (let u = 0; u < poids.length; u++) {
      const t = js.slice(u * taille, (u + 1) * taille);
      if (!t.length) { off += poids[u] * 40; def += poids[u] * 40; continue; }
      let o = moy(t.map(p => p.o)), d = moy(t.map(p => p.d));
      if (malus && t.length === taille) {
        let pen = 0, parfait = true;
        for (const p of t) {
          const ideal = idealDe(pos, zoneDe(pos, p.v));
          if (ideal.includes(u)) continue;
          parfait = false;
          const ecart = Math.min(...ideal.map(x => Math.abs(x - u)));
          // même formule que getUnitSynergy : proportionnel sous la zone,
          // forfaitaire au-dessus
          pen += u > Math.max(...ideal)
            ? sous * Math.max(0, p.v - calibreAttendu(pos, u))
            : dessus * ecart;
        }
        const b = parfait ? 2 : -Math.min(plafond, pen);
        o += b; d += b;
      }
      off += poids[u] * o; def += poids[u] * d;
    }
    return [off, def];
  };
  const [fo, fd] = unite(F, POIDS_TRIO, 3, 'F');
  const [dof, dd] = unite(D, POIDS_PAIRE, 2, 'D');
  const g = G.length ? 0.6 * G[0].o + 0.4 * G[0].d : 40;
  return 0.5 * (0.62 * fo + 0.38 * dof) + 0.3 * (0.62 * fd + 0.38 * dd) + 0.2 * g;
}

/* --- tous les joueurs de toutes les époques --- */
const best = new Map();
for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  for (const p of JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8')).players) {
    if (p.gp < 20) continue;
    const k = `${p.id}|${p.s}`;
    if (!best.has(k) || p.v > best.get(k).v) best.set(k, p);
  }
}
const tous = [...best.values()];

/* --- meilleur alignement légal : remplir au moins cher, puis améliorer au
       meilleur gain par dollar tant que le plafond le permet --- */
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
const tri = a => a.slice().sort((x, y) => y.v - x.v);
const EMP = [tri(roster.F), tri(roster.D), tri(roster.G)];

/* --- vraies équipes témoins --- */
const TEMOINS = [['MTL 76-77', '1976-77', 'MTL'], ['BOS 70-71', '1970-71', 'BOS'],
                 ['NYI 92-93', '1992-93', 'NYI'], ['DET 76-77', '1976-77', 'DET']];
const refs = TEMOINS.map(([lab, s, t]) => {
  const ps = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, `${s}.json`), 'utf8'))
    .players.filter(p => p.t === t && p.gp >= 10);
  return [lab, [tri(ps.filter(p => p.p === 'F')).slice(0, 12),
                tri(ps.filter(p => p.p === 'D')).slice(0, 6),
                ps.filter(p => p.p === 'G').sort((a, b) => b.gp - a.gp)]];
});

console.log(`\nMeilleur alignement légal, cueillette libre sur 55 saisons : ${(masse / 1e6).toFixed(1)} / ${(CAP / 1e6).toFixed(1)} M$`);
console.log(`  Premier trio : ${EMP[0].slice(0, 3).map(p => `${p.n} ${p.s} (${(p.$ / 1e6).toFixed(1)}M, cote ${p.v})`).join(', ')}`);
console.log(`  4e trio      : ${EMP[0].slice(9, 12).map(p => `${p.n} (${(p.$ / 1e6).toFixed(2)}M, cote ${p.v})`).join(', ')}`);
console.log(`\n  Repère : meilleure vraie équipe de l'histoire = 68,0 ; médiane = 57,7\n`);

const ligne = (lab, opts) => {
  const e = indice(...EMP, opts);
  const r = refs.map(([, a]) => indice(...a, opts));
  console.log(`  ${lab.padEnd(24)} ${e.toFixed(1).padStart(6)}  ${r.map(x => x.toFixed(1).padStart(9)).join('  ')}`);
};
console.log(`  ${'réglage'.padEnd(24)} ${'EMPILÉ'.padStart(6)}  ${refs.map(([l]) => l.padStart(9)).join('  ')}`);
ligne('aucun malus', { malus: false });
ligne('proportionnel 0,3', { sous: 0.30, plafond: 40 });
ligne('proportionnel 0,45', { sous: 0.45, plafond: 40 });
ligne(`EN VIGUEUR (${ZONE_PEN_SOUS}/${ZONE_PEN_DESSUS}, cap ${ZONE_PEN_MAX})`, {});
ligne('proportionnel 0,8', { sous: 0.80, plafond: 55 });
console.log(`
  Empiler = jouer SOUS sa zone (un top 6 au 4e trio, du talent gaspillé).
  Une mauvaise équipe joue AU-DESSUS de la sienne, faute de mieux. Punir
  lourdement le premier et légèrement le second ferme l'empilement sans
  toucher aux vraies équipes.
`);
