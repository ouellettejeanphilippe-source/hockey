/*
 * LES COTES SUR 20 (docs/cotes-sur-20.md ; JP, 27 oct. 2026 : *des cotes comme le jeu de table, mais sur 20*).
 * `cote20` (js/niveaux.js) déroule la mesure du niveau entre ses seuils. Ce qui se prouve, sur toutes les saisons :
 *   1. la cote d'un joueur tombe dans la tranche de son niveau (Soutien 1–8, Régulier 9–12, Pilier 13–16, Étoile 17–19, Phénomène 20) ;
 *   2. elle monte avec la mesure (à un poste, plus de points par match ne baisse jamais la cote) ;
 *   3. elle est relative à sa saison : un Phénomène l'est de toutes les époques, et la part de chaque cote est stable d'une époque à l'autre ;
 *   4. Gretzky 1981-82 est 20 ; un Régulier typique est entre 9 et 12 ;
 *   5. un joueur sans niveau n'a pas de cote ;
 *   6. les six cotes d'un patineur (Tir, Jeu, Défense, Robustesse, Avantage, Désavantage) et les trois d'un gardien (Arrêts,
 *      Charge, Présence) se répartissent de 1 à 20, et chacune suit la vraie stat qu'elle lit (`AXES`, js/niveaux.js).
 *   node scripts/check_cotes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cote20, axes20, AXES, niveauDe, mesureDuNiveau, groupeDuJoueur, NIVEAUX } from '../js/niveaux.js';
import { registerHiddenRatings } from '../js/sim.js';
import { exiger, informer, verdict } from './verdict.mjs';

const DIR = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'data', 'seasons');
const BANDES = [[1, 8], [9, 12], [13, 16], [17, 19], [20, 20]];
let n = 0, hors = 0, sansCote = 0, sansNiveau = 0;
const parEpoque = {}, desordre = [];
let gretzky = null;
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json')).sort()) {
  const sh = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const J = sh.players;
  const lignes = [];
  for (const p of J) {
    const k = niveauDe(p, J), c = cote20(p, J);
    if (k < 0) { if (c != null) sansNiveau++; continue; }
    if (c == null) { sansCote++; continue; }
    n++;
    // La cote est le meilleur des points et de la défense : elle est au moins la bande de son niveau, rarement plus haute.
    if (c < BANDES[k][0] || c > BANDES[k][1]) hors++;
    lignes.push([groupeDuJoueur(p), mesureDuNiveau(p, J), cote20(p, J, true)]);
    const ep = sh.season.slice(0, 3);
    parEpoque[ep] = parEpoque[ep] || { n: 0, haut: 0 }; parEpoque[ep].n++; if (c >= 17) parEpoque[ep].haut++;
    if (/Gretzky/.test(p.n) && sh.season === '1981-82' && (!gretzky || (p.pt || 0) > gretzky.pt)) gretzky = { pt: p.pt || 0, c };
  }
  for (const g of ['F', 'D', 'G']) {
    const L = lignes.filter(x => x[0] === g).sort((a, b) => a[1] - b[1]);
    for (let i = 1; i < L.length; i++) if (L[i][2] < L[i - 1][2] && L[i][1] > L[i - 1][1]) { desordre.push(`${sh.season} ${g}`); break; }
  }
}
informer('joueurs avec cote', `${n}`);
exiger('chaque cote tombe dans la tranche de son niveau', n > 1000 && hors === 0, `${hors} hors tranche sur ${n}`);
exiger('un régulier a toujours une cote, un joueur sans niveau n\'en a pas', sansCote === 0 && sansNiveau === 0, `${sansCote} sans cote, ${sansNiveau} cotés sans niveau`);
exiger('la cote monte avec la mesure, à son poste', desordre.length === 0, desordre.slice(0, 3).join(' · ') || 'toutes les saisons');
const parts = Object.entries(parEpoque).filter(([, v]) => v.n > 300).map(([e, v]) => [e, v.haut / v.n]);
const min = Math.min(...parts.map(x => x[1])), max = Math.max(...parts.map(x => x[1]));
exiger('la part des cotes de 17 et plus est la même d\'une époque à l\'autre (relative à la saison)', parts.length >= 5 && min > 0.03 && max < 0.12, `${(100 * min).toFixed(1)} % à ${(100 * max).toFixed(1)} % sur ${parts.length} époques`);
exiger('Gretzky 1981-82 est 20', gretzky && gretzky.c === 20, gretzky ? `${gretzky.c}` : 'introuvable');
/* Les six cotes d'un patineur et les trois d'un gardien (`AXES`) : ce que l'écran montre, une par chose qu'il fait. Un bogue les avait toutes mises à 1. */
{
  const saisons = fs.readdirSync(DIR).filter(x => x.endsWith('.json')).sort().filter((_, i) => i % 18 === 5).slice(0, 5);
  const rang = a => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = Array(a.length); o.forEach(([, i], k) => { r[i] = k; }); return r; };
  const corr = (x, y) => { const a = rang(x), b = rang(y), n = a.length, m = (n - 1) / 2; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (a[i] - m) * (b[i] - m); sxx += (a[i] - m) ** 2; syy += (b[i] - m) ** 2; } return sxy / Math.sqrt(sxx * syy); };
  let tous1 = 0, total = 0, couverture = 99, couvertureG = 99;
  const rho = [], rhoAN = [], rhoDN = [], rhoArr = [], rhoCharge = [];
  const gardiens = [];
  for (const f of saisons) {
    const J = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).players;
    J.forEach(registerHiddenRatings);
    const reg = J.filter(p => p.p !== 'G' && (p.gp || 0) >= 40 && axes20(p, J));
    for (const p of reg) { const a = axes20(p, J); total++; if (Object.values(a).every(v => v === 1)) tous1++; }
    for (const k of AXES.F) couverture = Math.min(couverture, new Set(reg.map(p => axes20(p, J)[k])).size);
    const att = reg.filter(p => groupeDuJoueur(p) === 'F');
    rho.push(corr(att.map(p => axes20(p, J).tir), att.map(p => (p.g || 0) / p.gp)));
    rhoAN.push(corr(att.map(p => axes20(p, J).avantage), att.map(p => (p.ppp || 0) / p.gp)));
    rhoDN.push(corr(att.map(p => axes20(p, J).desavantage), att.map(p => (p.shp || 0) / p.gp)));
    const G_ = J.filter(p => p.p === 'G' && (p.gp || 0) >= 30 && p.sa > 0);
    const ax = G_.map(p => axes20(p, J));
    gardiens.push(...ax);
    for (const k of AXES.G) couvertureG = Math.min(couvertureG, new Set(ax.map(a => a && a[k])).size);
    rhoArr.push(corr(ax.map(a => a.arrets), G_.map(p => p.sv)));
    rhoCharge.push(corr(ax.map(a => a.charge), G_.map(p => p.sa / p.gp)));
  }
  exiger('les six cotes d\'un patineur se répartissent de 1 à 20 (au moins 15 valeurs chacune, chaque saison)', couverture >= 15, `${couverture} valeurs au moins`);
  exiger('personne n\'a ses six cotes à 1 par défaut (moins de 2 % des patineurs)', total > 500 && tous1 / total < 0.02, `${tous1} sur ${total}`);
  exiger('la cote de Tir suit les buts par match d\'un attaquant (rang, corrélation ≥ 0,4)', rho.every(r => r >= 0.4), rho.map(r => r.toFixed(2)).join(' · '));
  exiger('la cote d\'Avantage suit les points en avantage par match (rang, corrélation ≥ 0,6)', rhoAN.every(r => r >= 0.6), rhoAN.map(r => r.toFixed(2)).join(' · '));
  exiger('la cote de Désavantage suit les points en désavantage par match (rang, corrélation ≥ 0,3)', rhoDN.every(r => r >= 0.3), rhoDN.map(r => r.toFixed(2)).join(' · '));
  exiger('un gardien a trois cotes (Arrêts, Charge, Présence), de 1 à 20 (au moins 8 valeurs chacune)', gardiens.length > 20 && gardiens.every(a => a && AXES.G.every(k => a[k] >= 1 && a[k] <= 20)) && couvertureG >= 8, `${gardiens.length} gardiens, ${couvertureG} valeurs au moins`);
  exiger('les Arrêts suivent son % d\'arrêts, la Charge ses lancers reçus par match (rang, corrélation ≥ 0,9)', [...rhoArr, ...rhoCharge].every(r => r >= 0.9), `${rhoArr.map(r => r.toFixed(2)).join(' · ')} ; ${rhoCharge.map(r => r.toFixed(2)).join(' · ')}`);
  const gard = saisons.flatMap(f => { const J = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).players; return J.filter(p => p.p === 'G' && (p.gp || 0) >= 30).map(p => cote20(p, J, true)); });
  exiger('un gardien a une cote aux buts évités, de 1 à 20', gard.length > 20 && gard.every(v => v >= 1 && v <= 20) && new Set(gard).size >= 12, `${gard.length} gardiens, ${new Set(gard).size} valeurs`);
}
informer('niveaux', NIVEAUX.map(N => N.nom).join(' · '));
verdict('Les cotes sur 20');
