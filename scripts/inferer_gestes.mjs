/*
 * LES GESTES ESTIMÉS (oct. 2026 ; JP : *inférer plus de données avec ce qui existe, des trucs qu'on a pas de 1970*).
 * Les mises en échec et les tirs bloqués n'arrivent qu'en 2005-06, les punitions tirées en 2009-10 ; avant, le moteur
 * estime le geste d'un patineur en écart réduit dans sa saison (`zGeste`, js/sim.js) : une droite sur ses dix traits
 * (`traitsDeGeste` : buts, passes, lancers, points en avantage et en désavantage, punitions par match, temps de glace,
 * poids, grandeur, gabarit, chacun en écart réduit). Ce script AJUSTE la droite sur 2015-16 à 2025-26 et L'ÉPROUVE EN
 * RETENUE, VERS LE PASSÉ, sur les premières saisons mesurées (2005-06 à 2012-13 ; 2009-10 à 2012-13 pour les
 * punitions tirées), puis juge les coefficients écrits dans le jeu (`GESTES_ESTIMES`). Ce qui se prouve :
 *   1. en retenue, l'estimation range qui frappe, qui bloque, qui attire les punitions : corrélation de rang ≥ 0,5
 *      (c'est un POIDS du moteur — qui fait le geste —, jamais une statistique affichée ; une valeur par match ne se
 *      prédit pas assez bien pour s'écrire : R² de 0,2 à 0,45) ;
 *   2. elle fait mieux que le repli d'avant : les punitions seules pour les coups, la mesure défensive pour les blocs ;
 *   3. les coefficients du jeu font l'erreur de l'ajustement du jour à 0,01 près (sinon : recopier la ligne « à coller ») ;
 *   4. sur une saison que la ligue ne mesurait pas, l'estimation est centrée (le joueur moyen à 0) et étalée comme une
 *      mesure rétrécie (écart type entre 0,3 et 0,8 : les blocs d'un attaquant se prédisent peu, et le temps de glace
 *      inféré d'avant 1998 est lui-même rétréci), sans valeur hors bornes.
 *
 *   node scripts/inferer_gestes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { traitsDeGeste, zGeste } from '../js/sim.js';
import { exiger, informer, verdict } from './verdict.mjs';

const DIR = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'data', 'seasons');
const AJUSTE = [2015, 2025];
const GESTES = {
  ht: { nom: 'mises en échec', retenue: [2005, 2012], repli: p => (p.pim || 0) / Math.max(1, p.gp || 1), repliNom: 'les punitions seules' },
  bl: { nom: 'tirs bloqués', retenue: [2005, 2012], repli: p => p.md ?? 0, repliNom: 'la mesure défensive' },
  pd: { nom: 'punitions tirées', retenue: [2009, 2012], repli: p => (p.pim || 0) / Math.max(1, p.gp || 1), repliNom: 'les punitions seules' },
};

const saisons = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
const an = s => parseInt(s.season.slice(0, 4), 10);
const estD = p => p.p === 'D' || p.p === 'LD' || p.p === 'RD';

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
/* La corrélation de rang (Spearman) de deux listes. */
function rho(a, b) {
  const rangs = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]), r = new Array(v.length); o.forEach(([, i], k) => { r[i] = k; }); return r; };
  const ra = rangs(a), rb = rangs(b), ma = (ra.length - 1) / 2, mb = ma;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < ra.length; i++) { sab += (ra[i] - ma) * (rb[i] - mb); saa += (ra[i] - ma) ** 2; sbb += (rb[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
}
/* La cible en écart réduit dans sa saison, à son poste, parmi les réguliers (20 matchs et plus) qui ont la mesure. */
function ciblesDe(s, cle) {
  const out = new Map();
  for (const pos of ['F', 'D']) {
    const groupe = s.players.filter(p => p.p !== 'G' && (estD(p) ? 'D' : 'F') === pos && p[cle] != null);
    const reg = groupe.filter(p => (p.gp || 0) >= 20);
    if (reg.length < 30) continue;
    const m = reg.reduce((a, p) => a + p[cle], 0) / reg.length;
    const sd = Math.sqrt(reg.reduce((a, p) => a + (p[cle] - m) ** 2, 0) / reg.length) || 1;
    for (const p of groupe) out.set(p, Math.max(-3.5, Math.min(3.5, (p[cle] - m) / sd)));
  }
  return out;
}
/* Les traits d'un patineur SANS sa mesure : la copie où le geste manque, comme avant sa collecte. */
const sansMesure = (p, cle) => { const q = { ...p }; delete q[cle]; return q; };

for (const [cle, G] of Object.entries(GESTES)) {
  const ajuste = saisons.filter(s => an(s) >= AJUSTE[0] && an(s) <= AJUSTE[1]);
  const retenue = saisons.filter(s => an(s) >= G.retenue[0] && an(s) <= G.retenue[1]);
  for (const pos of ['F', 'D']) {
    const X = [], Y = [];
    for (const s of ajuste) for (const [p, y] of ciblesDe(s, cle)) if ((estD(p) ? 'D' : 'F') === pos) { X.push(traitsDeGeste(sansMesure(p, cle))); Y.push(y); }
    if (!X.length) { exiger(`${G.nom}, ${pos} : des saisons mesurées pour ajuster`, false, 'aucune'); continue; }
    const b = moindresCarres(X, Y);
    const pred = [], vrai = [], repli = [], jeu = [];
    for (const s of retenue) for (const [p, y] of ciblesDe(s, cle)) {
      if ((estD(p) ? 'D' : 'F') !== pos) continue;
      const q = sansMesure(p, cle), x = traitsDeGeste(q);
      pred.push(b.reduce((a, c, i) => a + c * x[i], 0)); vrai.push(y); repli.push(G.repli(p)); jeu.push(zGeste(q, cle));
    }
    const se = pred.reduce((a, v, i) => a + (v - vrai[i]) ** 2, 0), st = vrai.reduce((a, v) => a + v * v, 0);
    const r = rho(pred, vrai), rRepli = rho(repli, vrai), rJeu = rho(jeu, vrai);
    const nom = `${G.nom}, ${pos === 'F' ? 'avants' : 'défenseurs'}`;
    informer(`${nom} : ${X.length} ajustés (${AJUSTE.join('–')}), ${vrai.length} en retenue (${G.retenue.join('–')})`, `rang ${r.toFixed(3)} (${G.repliNom} : ${rRepli.toFixed(3)}), R² ${(1 - se / st).toFixed(3)} ; le jeu ${rJeu.toFixed(3)}`);
    informer(`${nom} : à coller dans GESTES_ESTIMES.${cle}`, `${pos}: [${b.map(v => +v.toFixed(2)).join(', ')}]`);
    exiger(`${nom} : en retenue, vers le passé, l'estimation range qui fait le geste (rang ≥ 0,5)`, r >= 0.5, `${r.toFixed(3)}`);
    exiger(`${nom} : mieux que ${G.repliNom}`, r > rRepli, `${r.toFixed(3)} contre ${rRepli.toFixed(3)}`);
    exiger(`${nom} : les coefficients du jeu valent l'ajustement du jour (rang à 0,01 près)`, rJeu >= r - 0.01, `jeu ${rJeu.toFixed(3)}, ajustement ${r.toFixed(3)}`);
  }
  // Une saison que la ligue ne mesurait pas : l'estimation est centrée et rétrécie, et aucune valeur ne sort des bornes.
  const vieille = saisons.find(s => s.season === '1985-86');
  for (const pos of ['F', 'D']) {
    const reg = vieille.players.filter(p => p.p !== 'G' && (estD(p) ? 'D' : 'F') === pos && (p.gp || 0) >= 20).map(p => zGeste(p, cle));
    const m = reg.reduce((a, v) => a + v, 0) / reg.length, sd = Math.sqrt(reg.reduce((a, v) => a + (v - m) ** 2, 0) / reg.length);
    exiger(`${G.nom}, ${pos} 1985-86 : l'estimation est centrée (|moyenne| < 0,25) et rétrécie (écart type 0,3 à 0,8), sans valeur hors bornes`,
      Math.abs(m) < 0.25 && sd >= 0.3 && sd <= 0.8 && reg.every(v => Number.isFinite(v) && Math.abs(v) <= 3.5), `moyenne ${m.toFixed(2)}, écart type ${sd.toFixed(2)}, ${reg.length} réguliers`);
  }
}
verdict('Les gestes estimés');
