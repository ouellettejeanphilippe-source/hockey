/**
 * LA FICHE RECONSTITUÉE D'UN CLUB, jugée sur les 1396 clubs des 55 saisons.
 *
 *   node scripts/check_fiches.mjs
 *
 * Un shard porte des JOUEURS, pas un classement : la fiche d'un club se
 * reconstitue de ses gardiens (V-D), de ses patineurs (buts pour) et de la
 * moyenne de ses gardiens (buts contre). `ficheDeClub` (js/equipes.js) en est
 * le seul propriétaire, et cinq écrans la montrent.
 *
 * CE QUE CE SCRIPT VÉRIFIE SANS AUCUNE VÉRITÉ EXTÉRIEURE. Le total de buts
 * d'une saison se dérive du shard lui-même, en dédoublonnant les joueurs par
 * identifiant (un échangé répète sa ligne sous chacun de ses clubs). On peut
 * donc juger les deux colonnes contre ce total — et surtout leur ÉCART, qui
 * est ce que le joueur lit : avant S61, les buts pour étaient sous-comptés de
 * 9 % et les buts contre SUR-comptés de 8 %, donc le différentiel d'un club
 * était pessimiste de 17 % d'une saison de buts sans que rien ne le dise.
 *
 * Et trois clubs d'anthologie servent de repères LISIBLES : leur fiche est
 * connue par coeur de n'importe quel amateur, et la reconstitution doit
 * tomber dessus au match près. Ils ne sont pas une mesure de plus — ils
 * disent, en une ligne, si le calendrier se déduit encore correctement.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ficheDeClub, ligneDeClub, tauxDeClub } from '../js/equipes.js';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS = path.join(ROOT, 'data', 'seasons');
const saisons = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8'));
const liste = Array.isArray(saisons) ? saisons : (saisons.seasons || saisons.saisons);

/*
 * TROIS FICHES QUE TOUT LE MONDE CONNAÎT. Elles viennent du palmarès de la
 * ligue, pas du dépôt — c'est le seul endroit de ce script qui repose sur
 * autre chose que les shards, et c'est assumé : les trois sont tombées juste
 * du premier coup, ce qu'un jeu de nombres inventés ne fait pas trois fois.
 * Seuls V-D-N sont exigés ; les buts pour et contre sous-comptent PAR
 * CONSTRUCTION (les échangés sortent des deux), et ça se juge plus bas.
 */
const ANTHOLOGIE = [
  ['1976-77', 'MTL', '60-8-12'],
  ['1977-78', 'MTL', '59-10-11'],
  ['1970-71', 'BOS', '57-14-7'],
];

const clubs = [];               // { s, tag, f }
const parSaison = new Map();    // saison -> { vraiButs, calendrier }

for (const s of liste) {
  const sh = JSON.parse(fs.readFileSync(path.join(SEASONS, `${s}.json`), 'utf8'));
  const vus = new Set();
  let vraiButs = 0;
  for (const p of sh.players) {
    if (p.p === 'G' || vus.has(p.id)) continue;
    vus.add(p.id);
    vraiButs += p.g || 0;
  }
  // Le calendrier de l'époque : le plus grand nombre de matchs joués par un
  // joueur NON échangé. Un échangé peut DÉPASSER le calendrier — ses deux
  // clubs n'avaient pas joué autant de matchs au moment de l'échange — et
  // 2005-06 se lisait ainsi à 84 alors qu'elle en comptait 82.
  const calendrier = Math.max(0, ...sh.players.filter(p => !p.x).map(p => p.gp || 0));
  parSaison.set(s, { vraiButs, calendrier });
  const par = {};
  for (const p of sh.players) (par[p.t] ||= []).push(p);
  for (const [tag, pool] of Object.entries(par)) clubs.push({ s, tag, f: ficheDeClub(pool) });
}

const n = clubs.length;
const lisibles = clubs.filter(c => c.f.V != null);
const complets = lisibles.filter(c => !c.f.exclus);

/* ---------- les invariants ---------- */

const trop = lisibles.filter(c => c.f.V + c.f.D > c.f.mj);
exiger('V + D tient dans le calendrier', !trop.length,
  trop.length ? trop.slice(0, 3).map(c => `${c.tag} ${c.s}`).join(', ') : `${lisibles.length} clubs`);

const dessus = clubs.filter(c => c.f.mj > parSaison.get(c.s).calendrier);
exiger('le calendrier d\'un club ne dépasse pas celui de sa saison', !dessus.length,
  dessus.length ? dessus.slice(0, 3).map(c => `${c.tag} ${c.s} : ${c.f.mj}`).join(', ') : `${n} clubs`);

// Le troisième nombre n'existe QUE sur un effectif complet : sur un club à qui
// il manque un gardien, le reste porte aussi les matchs de ce gardien-là.
const nMalPose = lisibles.filter(c => (c.f.N == null) !== !!c.f.exclus);
exiger('les nuls ne se déduisent que d\'un effectif complet', !nMalPose.length,
  nMalPose.length ? `${nMalPose.length} clubs` : `${complets.length} complets, ${lisibles.length - complets.length} partiels`);

for (const [s, tag, attendu] of ANTHOLOGIE) {
  const c = clubs.find(x => x.s === s && x.tag === tag);
  exiger(`${tag} ${s}`, c && ligneDeClub(c.f) === attendu,
    c ? `${ligneDeClub(c.f)} (attendu ${attendu})` : 'club introuvable');
}

/* ---------- les repères ---------- */

// LE RESTE, sur les clubs complets, EST le compte de nuls (ou de défaites en
// prolongation) du club. La vraie ligue en distribue une dizaine par club et
// par an : une médiane qui s'en écarte veut dire que le calendrier se déduit
// mal, et c'est le seul symptôme qu'on ait sans aller chercher le palmarès.
const restes = complets.map(c => c.f.N).sort((a, b) => a - b);
const q = p => restes[Math.floor(restes.length * p)];
borne('les nuls d\'un club complet, médiane', q(0.5), 8, 16, ' matchs');
borne('les nuls d\'un club complet, maximum', restes[restes.length - 1], 0, 40, ' matchs');

// LES DEUX COLONNES SOUS-COMPTENT ENSEMBLE, parce que les deux sautent les
// échangés. C'est assumé — on ne sait pas découper la saison d'un échangé —
// mais elles doivent sous-compter du MÊME ordre, sinon le différentiel penche.
const somme = (f, cle) => f.reduce((a, x) => a + (x || 0), 0);
let ecartBP = 0, ecartBC = 0, ecartDiff = 0;
for (const s of liste) {
  const vrai = parSaison.get(s).vraiButs || 1;
  const dedans = clubs.filter(c => c.s === s);
  const bp = somme(dedans.map(c => c.f.BP));
  const bc = somme(dedans.map(c => c.f.BC));
  ecartBP += 100 * (bp / vrai - 1);
  ecartBC += 100 * (bc / vrai - 1);
  ecartDiff += Math.abs(bp - bc) / vrai * 100;
}
borne('buts pour, écart au vrai total de la ligue', ecartBP / liste.length, -15, 0, ' %');
borne('buts contre, écart au vrai total de la ligue', ecartBC / liste.length, -15, 0, ' %');
// C'EST LA LIGNE QUI COMPTE : les deux colonnes se lisent l'une contre
// l'autre. Avant S61 elle valait 17 % — buts pour à −9, buts contre à +8.
borne('l\'écart ENTRE les deux colonnes', ecartDiff / liste.length, 0, 5, ' %');

const taux = lisibles.map(c => tauxDeClub(c.f)).filter(x => x != null).sort((a, b) => a - b);
borne('le taux de victoires médian d\'un club', taux[Math.floor(taux.length / 2)], 0.45, 0.55, '');

/* ---------- ce qui se lit sans se juger ---------- */

informer('clubs', `${n} sur ${liste.length} saisons`);
informer('fiches partielles', `${lisibles.length - complets.length} (${(100 * (lisibles.length - complets.length) / n).toFixed(0)} %) — un gardien échangé, hors du total`);
informer('fiches illisibles', clubs.filter(c => c.f.V == null).map(c => `${c.tag} ${c.s}`).join(', ') || 'aucune');

verdict('La fiche reconstituée d\'un club');
