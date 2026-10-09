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
import { conseilDuBilan } from '../js/recit.js';
import { fragiliteDe, FRAGILE_DES } from '../js/sim.js';
import { seasonGames } from '../js/ratings.js';

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

/* ---------- le conseil du bilan cite ses chiffres (1.0, J2-18) ---------- */
{
  // Une saison construite : quatre trios, le 4e convertit le moins mais on ne le lui reproche pas, le 3e ensuite ; puis une saison ratée, où la défense est la pire.
  const moi = { isPlayer: true, GF: 250, GA: 290 };
  const autres = Array.from({ length: 7 }, (_, i) => ({ GF: 240 + i * 5, GA: 220 + i * 5 }));
  const tir = (ligne, but) => ({ ligne, mode: 'FE', cote: 'A', but });
  const lancers = [];
  for (const [u, t, b] of [[0, 90, 12], [1, 70, 8], [2, 50, 5], [3, 40, 2]]) for (let k = 0; k < t; k++) lancers.push(tir(u, k < b));
  const calendrier = [[{ A: moi, B: autres[0], feuille: { lancers } }]];
  const bon = conseilDuBilan({ W: 46, L: 30, OTL: 6, GF: 250, GA: 290 }, moi, [moi, ...autres], calendrier);
  exiger('le conseil nomme le trio qui convertit le moins (hors 4e), avec ses buts et ses tirs', /3e trio a marqué 5 buts en 50 tirs/.test(bon), bon);
  const fort = conseilDuBilan({ W: 50, L: 26, OTL: 6, GF: 300, GA: 290 }, { ...moi, GF: 300 }, [{ ...moi, GF: 300 }, ...autres], calendrier);
  exiger('une bonne saison portée par son attaque se dit comme une force', /c'est elle qui a porté ta saison/.test(fort), fort);
  const rate = conseilDuBilan({ W: 32, L: 40, OTL: 10, GF: 250, GA: 290 }, moi, [moi, ...autres], calendrier);
  exiger('sous 41 victoires, le conseil nomme la défense et son rang', /accordé 290 buts, 8e de la ligue sur 8/.test(rate), rate);
}

/* ---------- ce qui se lit sans se juger ---------- */

informer('clubs', `${n} sur ${liste.length} saisons`);
informer('fiches partielles', `${lisibles.length - complets.length} (${(100 * (lisibles.length - complets.length) / n).toFixed(0)} %) — un gardien échangé, hors du total`);
informer('fiches illisibles', clubs.filter(c => c.f.V == null).map(c => `${c.tag} ${c.s}`).join(', ') || 'aucune');

/*
 * LA FRAGILITÉ SE DIT (V2.2). Un joueur qui a manqué sa vraie saison se blesse plus (js/sim.js, `injuryChance`) ;
 * la carte et la fiche le disent dès le double (`fragileTag`, `fragiliteDe`). Un joueur de toute la saison : ×1 ;
 * de vingt matchs sur 82 : près de sept fois ; et le tri aux points par match ne le met plus en tête.
 */
{
  const s82 = '2023-24';
  const plein = fragiliteDe({ s: s82, gp: seasonGames(s82) }), vingt = fragiliteDe({ s: s82, gp: 20 }), soixante = fragiliteDe({ s: s82, gp: 60 });
  exiger('la fragilité suit les matchs manqués : ×1 pour une saison pleine, croissante à mesure qu\'il en manque', plein === 1 && vingt > soixante && soixante > plein,
    `82 matchs ×${plein.toFixed(1)} · 60 ×${soixante.toFixed(1)} · 20 ×${vingt.toFixed(1)}`);
  exiger('un joueur de vingt matchs est dit fragile', vingt >= FRAGILE_DES && vingt > 6, `×${vingt.toFixed(1)}`);
  const src = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  exiger('la carte et la fiche le disent', /fragileTag\(p\)/.test(src('repechage.js')) && /fragiliteDe\(p\)/.test(src('fiche.js')));
  exiger('le tri aux points par match divise par vingt matchs au moins', /PPG: \(a, b\) => ppgTri\(b\) - ppgTri\(a\)/.test(src('repechage.js')) && /const PPG_MATCHS_MIN = 20;/.test(src('repechage.js')));
}

verdict('La fiche reconstituée d\'un club');
