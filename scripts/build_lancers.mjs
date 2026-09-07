/*
 * Régénère la table `SEASON_LANCERS` de js/ratings.js depuis les shards.
 *
 * Neuf nombres par saison, tous mesurés, aucun réglé à la main :
 *
 *   [0] lancers par équipe par match     le rythme de l'époque
 *   [1] % de tir de la ligue             la finition de l'époque
 *   [2] lancers par match d'un attaquant régulier (20 PJ et plus)
 *   [3] lancers par match d'un défenseur régulier
 *   [4] POINTS par match d'un attaquant régulier
 *   [5] POINTS par match d'un défenseur régulier
 *   [6] part des points d'un attaquant régulier qui vient de ses BUTS
 *   [7] minutes de punition par match d'un attaquant régulier
 *   [8] part des points d'un défenseur régulier qui vient de ses buts
 *
 * Les quatre derniers servent à exprimer le volume de tirs et la production
 * d'un joueur en ÉCART À SA LIGUE, pour qu'un ailier de 1981 et un ailier de
 * 2015 se comparent. La production sert à la chimie de trio, qui se calcule
 * sur les vraies statistiques et non sur une cote. Les deux premiers portent la normalisation par époque du
 * moteur : le rythme est presque constant, la finition ne l'est pas.
 *
 * Les totaux d'un joueur échangé sont répartis entre ses k équipes — le
 * shard porte une ligne par équipe avec les totaux de SAISON COMPLÈTE, donc
 * les sommer tels quels compte le joueur deux fois.
 *
 *   node scripts/build_lancers.mjs           écrit la table dans js/ratings.js
 *   node scripts/build_lancers.mjs --check   la compare sans rien écrire
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const RATINGS = path.join(ROOT, 'js', 'ratings.js');
const DEBUT = '  /* <lancers> */';
const FIN = '  /* </lancers> */';

const lignes = [];
for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const k = new Map();
  for (const p of shard.players) k.set(p.id, (k.get(p.id) || 0) + 1);
  const w = p => 1 / Math.max(1, k.get(p.id) || 1);

  const patineurs = shard.players.filter(p => p.p !== 'G');
  const gardiens = shard.players.filter(p => p.p === 'G');
  const lancers = gardiens.reduce((s, g) => s + w(g) * (g.sa || 0), 0);
  const buts = patineurs.reduce((s, p) => s + w(p) * (p.g || 0), 0);
  if (!lancers || !buts) continue;

  const matchsPar = {};
  for (const p of shard.players) matchsPar[p.t] = Math.max(matchsPar[p.t] || 0, p.gp || 0);
  const matchs = Object.values(matchsPar).reduce((a, b) => a + b, 0);

  const reguliers = patineurs.filter(p => (p.gp || 0) >= 20);
  const moyenne = (a, k) => a.reduce((s, p) => s + (p[k] || 0) / p.gp, 0) / (a.length || 1);
  const F = reguliers.filter(p => p.p === 'F');
  const D = reguliers.filter(p => p.p === 'D');
  if (!F.length || !D.length) continue;

  lignes.push([shard.season,
    +(lancers / matchs).toFixed(2),
    +(100 * buts / lancers).toFixed(2),
    +moyenne(F, 'sh').toFixed(2),
    +moyenne(D, 'sh').toFixed(2),
    +moyenne(F, 'pt').toFixed(2),
    +moyenne(D, 'pt').toFixed(2),
    +(F.reduce((a, p) => a + (p.g || 0), 0)
      / Math.max(1, F.reduce((a, p) => a + (p.pt || 0), 0))).toFixed(3),
    +moyenne(F, 'pim').toFixed(2),
    +(D.reduce((a, p) => a + (p.g || 0), 0)
      / Math.max(1, D.reduce((a, p) => a + (p.pt || 0), 0))).toFixed(3)]);
}

let bloc = '';
for (let i = 0; i < lignes.length; i += 1) {
  bloc += '  ' + lignes.slice(i, i + 3)
    .map(([s, ...v]) => `'${s}': [${v.map((x, j) => x.toFixed(j === 6 || j === 8 ? 3 : 2)).join(', ')}],`)
    .join('\n  ') + '\n';
}

const src = fs.readFileSync(RATINGS, 'utf8');
const i0 = src.indexOf(DEBUT), i1 = src.indexOf(FIN);
if (i0 < 0 || i1 < 0) {
  console.error(`Marqueurs ${DEBUT} / ${FIN} introuvables dans js/ratings.js`);
  process.exit(1);
}
const neuf = src.slice(0, i0 + DEBUT.length) + '\n' + bloc + src.slice(i1);

if (process.argv.includes('--check')) {
  console.log(neuf === src
    ? `à jour — ${lignes.length} saisons`
    : `PÉRIMÉE — relancer sans --check (${lignes.length} saisons)`);
  process.exit(neuf === src ? 0 : 1);
}
fs.writeFileSync(RATINGS, neuf);
console.log(`js/ratings.js : SEASON_LANCERS réécrite, ${lignes.length} saisons`);
