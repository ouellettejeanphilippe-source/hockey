/*
 * LES INCIDENTS (V19, tranche 5 ; JP : *les incidents, ça devrait être liés à des joueurs tout le temps* ; *plus « randoms »*).
 * Les sources d'incidents du Rogue — les dilemmes (`MOMENTS`), les séquences, les dossiers de la semaine, les choix des
 * fils, les réponses de la vie du DG — ont une seule forme : une voix, un titre, des options qui disent leurs lignes.
 * Ce que le script tient :
 *   1. chaque incident a une voix de `EXPEDITEURS`, un titre et au moins deux options (ou une, si c'est un constat) ;
 *   2. la part des incidents qui NOMMENT un joueur (leur fait, ou `joueur`) ne baisse pas : dilemmes ≥ 70 %, dossiers ≥ 25 % —
 *      le but est de la monter (le rapport dit lesquels n'en nomment pas) ;
 *   3. les dates : un dilemme tombe à −2…+2 matchs de sa grille (`matchDuMoment`), jamais deux le même jour.
 *   node scripts/check_incidents.mjs
 */
import { MOMENTS, SEQUENCES, JOURS_MOMENTS, matchDuMoment } from '../js/sim.js';
import { DOSSIERS } from '../js/dossiers.js';
import { CHOIX_DES_FILS, EXPEDITEURS } from '../js/vie-gm.js';
import { exiger, informer, verdict } from './verdict.mjs';

const FAITS_DE_JOUEUR = new Set(['gardienBattu', 'punitionTard', 'gardienCharge', 'panneGardien', 'punitions', 'blesses', 'jambes', 'chaud', 'disetteMarqueur', 'recrue', 'parti', 'quatrieme', 'passoirePaire', 'tirsContre', 'plombier', 'veteranD', 'tirsD']);
const sources = [
  ['dilemmes', MOMENTS], ['séquences', SEQUENCES], ['dossiers', DOSSIERS], ['choix des fils', CHOIX_DES_FILS],
];
for (const [nom, S] of sources) {
  const mal = Object.entries(S).filter(([, x]) => !x.titre || !Array.isArray(x.options) || x.options.length < 1).map(([k]) => k);
  exiger(`${nom} : chacun a un titre et des options`, Object.keys(S).length > 0 && mal.length === 0, mal.join(' · ') || `${Object.keys(S).length}`);
}
const sansVoix = [...Object.entries(MOMENTS), ...Object.entries(DOSSIERS)].filter(([, x]) => x.de && !EXPEDITEURS[x.de]).map(([k]) => k);
exiger('chaque voix existe (`EXPEDITEURS`)', sansVoix.length === 0, sansVoix.join(' · ') || 'toutes');

const nommeUnJoueur = Object.entries(MOMENTS).filter(([, m]) => FAITS_DE_JOUEUR.has(m.fait));
const part = nommeUnJoueur.length / Object.keys(MOMENTS).length;
const sansEffetSurLui = nommeUnJoueur.filter(([, m]) => !m.options.some(o => o.lui || o.action || o.mutation)).map(([k]) => k);
informer('dilemmes qui nomment un joueur sans rien lui faire', sansEffetSurLui.join(', ') || 'aucun');
exiger('au moins 70 % des dilemmes nomment un joueur', part >= 0.7, `${nommeUnJoueur.length} sur ${Object.keys(MOMENTS).length}`);
const dossiersJoueur = Object.entries(DOSSIERS).filter(([, d]) => d.joueur);
informer('dossiers qui nomment un joueur', dossiersJoueur.map(([k]) => k).join(', '));
exiger('au moins 25 % des dossiers nomment un joueur', dossiersJoueur.length / Object.keys(DOSSIERS).length >= 0.25, `${dossiersJoueur.length} sur ${Object.keys(DOSSIERS).length}`);

const graines = Array.from({ length: 60 }, (_, i) => `g${i}`);
const mauvais = graines.filter(g => { const m = JOURS_MOMENTS.map(k => matchDuMoment(g, k)); return m.some((x, i) => i && x <= m[i - 1]) || m.some((x, i) => Math.abs(x - JOURS_MOMENTS[i]) > 2); });
exiger('les dates tirées restent dans l\'ordre de la grille, à deux matchs près, sans jamais se confondre', mauvais.length === 0, `${mauvais.length} graines sur ${graines.length}`);
verdict('Les incidents');
