/**
 * LE CALAGE DES BADGES (refonte 1) : les seuils des paliers et le badge
 * moyen de la ligue, lus sur les réguliers (40 matchs et plus) de toutes les
 * saisons.
 *
 *   node scripts/badges_calibre.mjs      → imprime SEUILS_PALIER et BADGE_LIGUE à recopier (js/sim.js)
 *
 * Le palier d'un badge est le rang de son score parmi les rôles PREMIERS des
 * réguliers de son groupe : 💎 Platine le top 3 %, Or le top 15 %, Argent le
 * top 40 %, Bronze le reste. Le score d'un rôle est déjà lu dans SA saison
 * (`ROLES_REF`), donc un seuil vaut pour toutes les époques.
 * `BADGE_LIGUE` : la valeur moyenne d'un joueur dans chaque badge (palier/4 en
 * premier, la moitié en second, 0 sans) — le moteur la retranche, pour que la
 * ligue entière, qui porte des badges, ne bouge pas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { profilsDe, PROFILS } from '../js/sim.js';
import { borne, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PARTS = [0.40, 0.15, 0.03];   // au-dessus d'Argent, d'Or, de Platine
const SECOND_MIN = 60;               // BADGE_SECOND_MIN (js/sim.js) : le second badge vaut 60 et plus

const joueurs = { F: [], D: [] };
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8'));
  for (const p of d.players) {
    if (p.p === 'G' || (p.gp || 0) < 40) continue;
    const g = (p.p === 'D' || p.p === 'LD' || p.p === 'RD') ? 'D' : 'F';
    const tri = Object.entries(profilsDe(p)).sort((a, b) => b[1] - a[1]);
    joueurs[g].push(tri);
  }
}

const out = { seuils: {}, ligue: {} };
const lignes = [];
for (const g of ['F', 'D']) {
  const premiers = joueurs[g].map(t => t[0][1]).sort((a, b) => b - a);
  const seuil = q => premiers[Math.max(0, Math.round(q * premiers.length) - 1)];
  const S = [seuil(PARTS[0]), seuil(PARTS[1]), seuil(PARTS[2])];
  out.seuils[g] = S;
  const palier = x => (x >= S[2] ? 4 : x >= S[1] ? 3 : x >= S[0] ? 2 : 1);
  const somme = Object.fromEntries(Object.keys(PROFILS[g]).map(k => [k, 0]));
  const n = [0, 0, 0, 0, 0];
  for (const t of joueurs[g]) {
    const [k1, x1] = t[0];
    n[palier(x1)]++;
    somme[k1] += palier(x1) / 4;
    const [k2, x2] = t[1] || [];
    if (k2 && x2 >= SECOND_MIN) somme[k2] += palier(x2) / 8;
  }
  out.ligue[g] = Object.fromEntries(Object.entries(somme).map(([k, s]) => [k, Math.round(1000 * s / joueurs[g].length) / 1000]));
  const N = joueurs[g].length;
  lignes.push(`${g} : ${N} réguliers · seuils ${S.join(' / ')} · Bronze ${(100 * n[1] / N).toFixed(0)} % · Argent ${(100 * n[2] / N).toFixed(0)} % · Or ${(100 * n[3] / N).toFixed(0)} % · Platine ${(100 * n[4] / N).toFixed(1)} %`);
  out[`n${g}`] = n;
}
for (const l of lignes) console.log(l);
const fmt = o => JSON.stringify(o).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ');
console.log(`\nexport const SEUILS_PALIER = ${fmt(out.seuils)};`);
console.log(`const BADGE_LIGUE = ${fmt(out.ligue)};`);

for (const g of ['F', 'D']) {
  const n = out[`n${g}`], N = n.reduce((a, b) => a + b, 0);
  // Le score d'un rôle est un entier qui sature près de 99 : les ex aequo au seuil poussent le Platine des avants vers 5 %.
  borne(`${g} : le Platine est rare`, 100 * n[4] / N, 2, 5, ' %');
  borne(`${g} : le Bronze est la majorité`, 100 * n[1] / N, 50, 65, ' %');
}
verdict('Le calage des badges');
