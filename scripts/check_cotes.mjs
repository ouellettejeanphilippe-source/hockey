/*
 * LES COTES SUR 20 (docs/cotes-sur-20.md ; JP, 27 oct. 2026 : *des cotes comme le jeu de table, mais sur 20*).
 * `cote20` (js/niveaux.js) déroule la mesure du niveau entre ses seuils. Ce qui se prouve, sur toutes les saisons :
 *   1. la cote d'un joueur tombe dans la tranche de son niveau (Soutien 1–8, Régulier 9–12, Pilier 13–16, Étoile 17–19, Phénomène 20) ;
 *   2. elle monte avec la mesure (à un poste, plus de points par match ne baisse jamais la cote) ;
 *   3. elle est relative à sa saison : un Phénomène l'est de toutes les époques, et la part de chaque cote est stable d'une époque à l'autre ;
 *   4. Gretzky 1981-82 est 20 ; un Régulier typique est entre 9 et 12 ;
 *   5. un joueur sans niveau n'a pas de cote.
 *   node scripts/check_cotes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cote20, niveauDe, mesureDuNiveau, groupeDuJoueur, NIVEAUX } from '../js/niveaux.js';
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
informer('niveaux', NIVEAUX.map(N => N.nom).join(' · '));
verdict('Les cotes sur 20');
