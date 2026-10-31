/*
 * LE TEMPS DE GLACE INFÉRÉ (RATINGS_VERSION 30 ; JP, 31 oct. 2026 : *inférer plus de données avec ce qui existe, des
 * trucs qu'on a pas de 1970, ça permettrait d'avoir un moteur plus complet et réaliste*). Avant 1997-98, la ligue ne
 * comptait pas les minutes ; `glaceInferee` (js/ratings.js) les prédit des colonnes de toutes les époques. Ce script
 * AJUSTE la régression sur 2010-11 à 2025-26 et L'ÉPROUVE EN RETENUE, VERS LE PASSÉ, sur 1997-98 à 2005-06 — les
 * saisons mesurées les plus proches de celles qu'on infère —, puis vérifie que les coefficients écrits dans le jeu
 * (`GLACE_INFEREE`) font aussi bien que ceux qu'il vient d'ajuster. Ce qui se prouve :
 *   1. en retenue, la régression explique les minutes (R² ≥ 0,75 chez les avants, ≥ 0,6 chez les défenseurs) ;
 *   2. la zone de déploiement lue de ces minutes tombe juste au moins aussi souvent que celle du rang d'usage seul
 *      (`usageSansGlace`, ce que les zones lisaient avant) ;
 *   3. la mise à l'échelle par saison ne bouge guère une saison mesurée (facteur à ±8 % de 1 en retenue) ;
 *   4. les coefficients du jeu ne sont pas périmés : sur la retenue, ils font à 0,1 minute près l'erreur de l'ajustement
 *      du jour — sinon, recopier la ligne « à coller » dans js/ratings.js et monter RATINGS_VERSION.
 *
 *   node scripts/inferer_glace.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { traitsDeGlace, glaceInferee } from '../js/ratings.js';
import { exiger, informer, verdict } from './verdict.mjs';

const DIR = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'data', 'seasons');
const AJUSTE = [2010, 2025], RETENUE = [1997, 2005];
/* Les bornes de rang des zones de déploiement (`RANGS_DE_ZONE`, js/ratings.js) : les quatre premiers attaquants, les deux premiers défenseurs… */
const RANGS = { F: [4, 8, 11], D: [2, 4, 6] };
const MATCHS_REGULIER = 25;

const saisons = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
const an = s => parseInt(s.season.slice(0, 4), 10);
const mesuree = s => s.players.some(p => p.p !== 'G' && p.toi > 0 && !p.toiE);
const ajuste = saisons.filter(s => mesuree(s) && an(s) >= AJUSTE[0] && an(s) <= AJUSTE[1]);
const retenue = saisons.filter(s => mesuree(s) && an(s) >= RETENUE[0] && an(s) <= RETENUE[1]);

/* Moindres carrés : les équations normales, résolues par Gauss. */
function moindresCarres(X, Y) {
  const n = X[0].length, A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  X.forEach((x, k) => { for (let i = 0; i < n; i++) { A[i][n] += x[i] * Y[k]; for (let j = 0; j < n; j++) A[i][j] += x[i] * x[j]; } });
  for (let i = 0; i < n; i++) A[i][i] += 1e-6;
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((row, i) => row[n] / row[i]);
}
const zoneDuRang = (pos, rang) => 1 + RANGS[pos].filter(b => rang > b).length;
/* La zone de chaque patineur d'un club, par le rang d'une clé parmi ses réguliers. */
function zones(club, pos, cle) {
  const regs = club.filter(c => (c.e.gp || 0) >= MATCHS_REGULIER).map(cle);
  return club.map(e => zoneDuRang(pos, 1 + regs.filter(x => x > cle(e)).length));
}

const coefs = {}, rapport = [];
for (const pos of ['F', 'D']) {
  const X = [], Y = [];
  for (const s of ajuste) for (const [e, t] of traitsDeGlace(s.players)) if (t.pos === pos && e.toi > 0) { X.push(t.x); Y.push(e.toi); }
  const b = moindresCarres(X, Y);
  coefs[pos] = b;
  // La retenue : l'erreur, le R², la zone, et le facteur d'échelle qu'une saison mesurée recevrait.
  let se = 0, st = 0, n = 0, biais = 0, zonesJustes = 0, zonesUsage = 0, nz = 0;
  const facteurs = [];
  const copieErr = [];
  for (const s of retenue) {
    const traits = traitsDeGlace(s.players);
    const ys = [...traits].filter(([e, t]) => t.pos === pos && e.toi > 0).map(([e]) => e.toi);
    const moy = ys.reduce((a, c) => a + c, 0) / ys.length;
    const matchs = Math.max(1, ...s.players.map(e => e.gp || 0));
    const sommes = new Map(), vraies = new Map(), parClub = new Map();
    for (const [e, t] of traits) {
      if (t.pos !== pos || !(e.toi > 0)) continue;
      const m = b.reduce((a, c, i) => a + c * t.x[i], 0);
      se += (m - e.toi) ** 2; st += (e.toi - moy) ** 2; biais += m - e.toi; n++;
      sommes.set(e.t, (sommes.get(e.t) || 0) + m * (e.gp || 0) / matchs);
      vraies.set(e.t, (vraies.get(e.t) || 0) + e.toi * (e.gp || 0) / matchs);
      if (!parClub.has(e.t)) parClub.set(e.t, []);
      parClub.get(e.t).push({ e, m, rang: t.x[8] });
    }
    const tri = [...vraies.values()].sort((a, c) => a - c);
    facteurs.push(tri[tri.length >> 1]);
    for (const club of parClub.values()) {
      const vraies = zones(club, pos, c => c.e.toi), modele = zones(club, pos, c => c.m), usage = club.map(c => zoneDuRang(pos, c.rang));
      club.forEach((c, i) => { nz++; zonesJustes += vraies[i] === modele[i]; zonesUsage += vraies[i] === usage[i]; });
    }
    // Les coefficients du jeu, sur une copie sans minutes : la chaîne entière, échelle et arrondi compris.
    const copie = s.players.map(e => { const { toi, toiE, ...r } = e; return r; });
    glaceInferee(copie);
    copie.forEach((c, i) => { const e = s.players[i]; if (e.p === pos && e.toi > 0) copieErr.push(c.toi - e.toi); });
  }
  const rmse = Math.sqrt(se / n), r2 = 1 - se / st, rmseJeu = Math.sqrt(copieErr.reduce((a, c) => a + c * c, 0) / copieErr.length);
  const medianeRetenue = facteurs.sort((a, c) => a - c)[facteurs.length >> 1];
  const nom = pos === 'F' ? 'avants' : 'défenseurs';
  rapport.push({ pos, nom, rmse, r2, biais: biais / n, zonesJustes: zonesJustes / nz, zonesUsage: zonesUsage / nz, medianeRetenue, rmseJeu });
  informer(`${nom} : ${X.length} patineurs ajustés (${AJUSTE.join('–')}), ${n} en retenue (${RETENUE.join('–')})`,
    `erreur type ${rmse.toFixed(2)} min, biais ${biais / n >= 0 ? '+' : ''}${(biais / n).toFixed(2)}, R² ${r2.toFixed(3)} ; zone juste ${(100 * zonesJustes / nz).toFixed(1)} % (rang d'usage seul : ${(100 * zonesUsage / nz).toFixed(1)} %) ; vraies minutes par club et par match, médiane ${medianeRetenue.toFixed(1)}`);
  informer(`${nom} : à coller dans GLACE_INFEREE`, `${pos}: { b: [${b.map(x => +x.toFixed(2)).join(', ')}], parClub: ${medianeRetenue.toFixed(1)} }`);
  exiger(`${nom} : en retenue, vers le passé, la régression explique les minutes (R² ≥ ${pos === 'F' ? '0,75' : '0,6'})`, r2 >= (pos === 'F' ? 0.75 : 0.6), `R² ${r2.toFixed(3)}`);
  exiger(`${nom} : la zone lue des minutes inférées tombe juste au moins aussi souvent que celle du rang d'usage`, zonesJustes >= zonesUsage - 0.01 * nz, `${(100 * zonesJustes / nz).toFixed(1)} % contre ${(100 * zonesUsage / nz).toFixed(1)} %`);
  exiger(`${nom} : les coefficients du jeu font l'erreur de l'ajustement du jour, à 0,1 minute près (sinon : recopier, monter RATINGS_VERSION)`, rmseJeu <= rmse + 0.1, `jeu ${rmseJeu.toFixed(2)} min, ajustement ${rmse.toFixed(2)} min`);
}

// La mise à l'échelle par saison : sur une saison mesurée, le facteur reste à ±8 % de 1 (la médiane d'une vraie saison
// varie déjà de ±5 % autour de la constante) — c'est une saison des années 70, aux clubs moins nombreux en patineurs,
// qu'elle corrige d'un bon dixième, pas une saison qui ressemble aux mesurées.
const facteurs = [];
for (const s of retenue) {
  const copie = s.players.map(e => { const { toi, toiE, ...r } = e; return r; });
  glaceInferee(copie);
  const traits = traitsDeGlace(s.players);
  for (const pos of ['F', 'D']) {
    let brut = 0, final = 0;
    copie.forEach((c, i) => {
      const e = s.players[i], t = traits.get(e);
      if (e.p !== pos || !(e.toi > 0) || !t || !(c.toi > 3)) return;
      brut += coefs[pos].reduce((a, k, j) => a + k * t.x[j], 0); final += c.toi;
    });
    facteurs.push({ s: s.season, pos, f: final / brut });
  }
}
const pire = facteurs.reduce((a, c) => (Math.abs(c.f - 1) > Math.abs(a.f - 1) ? c : a));
exiger('la mise à l\'échelle par saison laisse une saison mesurée à ±8 % de 1 (en retenue)', Math.abs(pire.f - 1) <= 0.08, `au pire ${pire.f.toFixed(3)} (${pire.s}, ${pire.pos})`);

// Un regard sur ce qu'on infère pour vrai : 1972-73, le haut et le bas, et les minutes par club.
const vieille = saisons.find(s => s.season === '1972-73');
if (vieille) {
  const copie = vieille.players.map(e => ({ ...e }));
  glaceInferee(copie);
  for (const pos of ['F', 'D']) {
    const l = copie.filter(e => e.p === pos).sort((a, c) => c.toi - a.toi);
    informer(`1972-73, ${pos === 'F' ? 'avants' : 'défenseurs'} inférés`, `${l.slice(0, 3).map(e => `${e.n} ${e.toi}`).join(' · ')} … ${l.slice(-2).map(e => `${e.n} ${e.toi}`).join(' · ')}`);
  }
}
exiger('les saisons d\'avant 1997-98 sont inférées sur le disque, les mesurées intactes', saisons.filter(s => an(s) < 1997).every(s => s.players.every(p => p.p === 'G' || (p.toi > 0 && p.toiE)))
  && saisons.filter(s => mesuree(s)).every(s => s.players.every(p => !p.toiE)), `${saisons.filter(s => s.players.some(p => p.toiE)).length} saisons inférées sur le disque`);

verdict('Le temps de glace inféré');
