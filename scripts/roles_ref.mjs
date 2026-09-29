/**
 * LA RÉFÉRENCE DES RÔLES (S79) : pour chaque saison et chaque groupe
 * (avants, défenseurs), la moyenne et l'écart type des statistiques que les
 * rôles lisent — parmi les RÉGULIERS (20 matchs et plus). Un rôle se juge
 * dans SA saison : 40 buts en 1981 et 40 buts en 2003 ne pèsent pas pareil.
 *
 *   node scripts/roles_ref.mjs        → écrit js/roles_ref.js
 *
 * Une statistique absente d'une époque (les mises en échec et les tirs
 * bloqués avant 2005) n'a pas de référence : le rôle s'en passe (js/sim.js,
 * `rolesBase`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
export const STATS = {
  gpg: p => p.g / p.gp,
  apg: p => p.a / p.gp,
  ptpg: p => (p.pt ?? (p.g + p.a)) / p.gp,
  shpg: p => (p.sh || 0) / p.gp,
  shpct: p => ((p.sh || 0) >= 20 ? p.g / p.sh : null),
  pimpg: p => (p.pim || 0) / p.gp,
  ppppg: p => (p.ppp == null ? null : p.ppp / p.gp),
  shppg: p => (p.shp == null ? null : p.shp / p.gp),
  toi: p => (p.toi > 0 ? p.toi : null),
  ht: p => (p.ht == null ? null : p.ht),
  bl: p => (p.bl == null ? null : p.bl),
  gb: p => (p.gb == null ? null : Number(p.gb)),
};
const ref = {};
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const saison = d.season || f.replace('.json', '');
  ref[saison] = {};
  for (const g of ['F', 'D']) {
    const reg = d.players.filter(p => p.p !== 'G' && (p.gp || 0) >= 20 && ((p.p === 'D' || p.p === 'LD' || p.p === 'RD') === (g === 'D')));
    ref[saison][g] = {};
    for (const [k, f] of Object.entries(STATS)) {
      const v = reg.map(f).filter(x => x != null && Number.isFinite(x));
      // Une stat que moins de 60 % des réguliers portent n'est pas une référence.
      if (v.length < Math.max(10, 0.6 * reg.length)) continue;
      const m = v.reduce((a, x) => a + x, 0) / v.length;
      const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / v.length) || 1e-6;
      ref[saison][g][k] = [Math.round(m * 1e4) / 1e4, Math.round(sd * 1e4) / 1e4];
    }
  }
}
const sortie = path.join(ROOT, 'js', 'roles_ref.js');
fs.writeFileSync(sortie, `/* Écrit par scripts/roles_ref.mjs (S79) : [moyenne, écart type] des statistiques des réguliers, par saison et par groupe. Ne pas éditer à la main. */
export const ROLES_REF = ${JSON.stringify(ref)};
`);
console.log(`${Object.keys(ref).length} saisons → ${path.relative(ROOT, sortie)} (${Math.round(fs.statSync(sortie).size / 1024)} ko)`);
