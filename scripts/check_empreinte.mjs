/*
 * L'EMPREINTE DU MOTEUR (V5, docs/organisation-equilibrage.md). JP : *que changer certaines mécaniques ait moins de
 * chance de briser le jeu lorsqu'on tente d'équilibrer*. Une saison en cours se REJOUE de sa graine : un réglage du
 * moteur qui change les matchs sans faire monter `VERSION_MOTEUR` (js/game.js) rejoue en silence un autre passé dans
 * les sauvegardes. Ce script joue une petite ligue FIXE (des saisons NOMMÉES, jamais « la 4e du dossier », et
 * quelques cartes brillantes posées), hache ses feuilles, et compare à l'empreinte rangée dans
 * scripts/empreinte.json avec la version du moteur et celle des cotes :
 *   - même empreinte : une refonte qui ne change rien ; vert ;
 *   - autre empreinte, mêmes versions : un réglage oublié ; ROUGE (fais monter VERSION_MOTEUR ou RATINGS_VERSION) ;
 *   - autre empreinte, version montée : un réglage voulu ; `EMPREINTE=ecrire node scripts/check_empreinte.mjs`
 *     range la nouvelle.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, getPlayerKey } from '../js/sim.js';
import { RATINGS_VERSION } from '../js/ratings.js';
import { carteDe } from '../js/rarete.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FICHIER = path.join(ROOT, 'scripts', 'empreinte.json');
const versionMoteur = (fs.readFileSync(path.join(ROOT, 'js', 'game.js'), 'utf8').match(/const VERSION_MOTEUR = '([^']+)'/) || [])[1];

// Des saisons anciennes et nommées : l'Action hebdomadaire ne rafraîchit que la saison en cours.
const CLUBS = [['1985-86', 'MTL'], ['1985-86', 'EDM'], ['1995-96', 'DET'], ['1995-96', 'COL'], ['2005-06', 'CAR'], ['2005-06', 'OTT'], ['2015-16', 'PIT'], ['2015-16', 'SJS']];
const equipes = CLUBS.map(([s, tag], i) => {
  const ps = equipeReelle(s, tag).flat().map(x => ({ ...x }));
  ps.forEach(registerHiddenRatings);
  // Le premier club porte des cartes brillantes : les variantes et leurs badges sont dans l'empreinte.
  if (i === 0) ps.slice(0, 6).forEach((p, k) => { p._carte = carteDe(['peu', 'rare', 'legendaire'][k % 3]); });
  return createTeam(`${tag} ${s}`, tag, autoRoster(ps), { season: s });
});
const L = creerLigue(equipes, 82, { graine: 'empreinte' });
jouerJusqua(L, L.calendrier.length);
const h = crypto.createHash('sha256');
let matchs = 0;
for (const jour of L.calendrier) for (const m of jour) {
  if (!m.feuille) continue;
  matchs++;
  h.update(`${m.A.tag}${m.gfA}-${m.gfB}${m.B.tag}|`);
  for (const l of m.feuille.lancers || []) h.update(`${l.cote}${l.instant}${l.but ? 1 : 0}${l.tireur ? getPlayerKey(l.tireur) : ''};`);
}
const empreinte = h.digest('hex').slice(0, 16);
const actuel = { moteur: versionMoteur, cotes: RATINGS_VERSION, empreinte };
informer('la ligue', `${CLUBS.length} clubs, ${matchs} matchs · moteur ${versionMoteur} · cotes v${RATINGS_VERSION} · ${empreinte}`);

if (process.env.EMPREINTE === 'ecrire') {
  fs.writeFileSync(FICHIER, `${JSON.stringify(actuel, null, 2)}\n`);
  informer('rangée', path.relative(ROOT, FICHIER));
} else {
  const range = fs.existsSync(FICHIER) ? JSON.parse(fs.readFileSync(FICHIER, 'utf8')) : null;
  exiger('une empreinte est rangée', !!range, 'EMPREINTE=ecrire node scripts/check_empreinte.mjs');
  if (range) {
    const memesVersions = range.moteur === actuel.moteur && range.cotes === actuel.cotes;
    exiger('un match qui change fait monter la version du moteur ou des cotes', range.empreinte === actuel.empreinte || !memesVersions,
      range.empreinte === actuel.empreinte ? 'les matchs sont les mêmes' : `les matchs ont changé (${range.empreinte} → ${empreinte}) sans que VERSION_MOTEUR ni RATINGS_VERSION ne monte`);
    exiger('l\'empreinte rangée est celle de la version actuelle', range.empreinte === actuel.empreinte || memesVersions,
      `version montée (${range.moteur} → ${actuel.moteur}) : range la nouvelle avec EMPREINTE=ecrire`);
  }
}
verdict('L\'empreinte du moteur');
