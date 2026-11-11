/*
 * LA VÉRITÉ DES CHIFFRES (refonte coachs-cartes-incidents, tranche 2 ; JP,
 * 27 oct. 2026 : *l'écran et le moteur disent des chiffres différents*).
 * Chaque affichage lit la valeur du moteur ; un test par accroc :
 *
 *   1. LA GRAINE COMPTE pour les tirages purs (les situations du
 *      vestiaire) : une graine en base 36 valait 0 par `Number(graine)`,
 *      et toutes les parties tiraient pareil.
 *   2. LE COACH : chacun a sa pièce de départ, celle de sa philosophie, et
 *      le départ de la run la montre ; les pièces offertes se tirent de la
 *      graine.
 *   3. LE PLAFOND EFFECTIF : la jauge, la phrase du budget et le bilan lisent
 *      `plafondDeJauge`, jamais `MODE().cap` seul.
 *
 * La pitié des packs, la main du deck et les objectifs du proprio sont partis
 * avec l'ancien Rogue (V28, tranche 4) : leurs trois accrocs aussi.
 *
 *   node scripts/check_verite.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, verdict } from './verdict.mjs';
import { entierDeGraine } from '../js/util.js';
import { situationsDuJour, JOURS_SITUATIONS, PROFILS,
  autoRoster, registerHiddenRatings, createTeam } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { COACHS, COACH_DU_ROLE } from '../js/coachs.js';
import { PIECES, PIECE_DU_COACH, piecesOffertes } from '../js/pieces.js';
import '../js/greffes.js';   // V25 : les greffes du Rogue se branchent sur le moteur

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* Une ligue de vrais clubs, comme les juges du moteur la bâtissent. */
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed, n = 12) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const sh = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}

/* ---------- 1. la graine compte ---------- */
{
  const a = 'k7q2z9', b = 'm3x8p1';   // deux graines comme `nouvelleGraine` les fait (base 36) : Number() en faisait 0
  exiger('une graine en base 36 n\'est pas 0', entierDeGraine(a) !== 0 && entierDeGraine(b) !== 0 && entierDeGraine(a) !== entierDeGraine(b), `${entierDeGraine(a)} · ${entierDeGraine(b)} (Number : ${Number(a) >>> 0})`);
  exiger('la même graine donne le même entier, en chaîne ou en nombre', entierDeGraine(12345) === entierDeGraine('12345') && entierDeGraine(`${a}:q`) !== entierDeGraine(a));
  const teams = ligue(7), you = teams[0];
  you.isPlayer = true;
  const sa = situationsDuJour(you, a, JOURS_SITUATIONS[0], 0), sb = situationsDuJour(you, b, JOURS_SITUATIONS[0], 0);
  const cle = x => (x ? `${x.porte && x.porte.p ? x.porte.p.n : ''}|${x.pese && x.pese.p ? x.pese.p.n : ''}|${x.nom || x.cle || ''}` : '');
  exiger('deux graines, deux situations du vestiaire', !!sa && !!sb && JSON.stringify(sa) !== JSON.stringify(sb), `${cle(sa)} / ${cle(sb)}`);
}

/* ---------- 2. le coach ---------- */
{
  // Le départ de la run dit la pièce de départ de l'entraîneur, celle du code (js/pieces.js `PIECE_DU_COACH`).
  const scenes = lire('js/run-scenes.js');
  exiger('le choix du coach dit sa pièce de départ', /PIECE_DU_COACH\[c\.cle\]/.test(scenes) && Object.keys(COACHS).every(k => PIECES[PIECE_DU_COACH[k]] && PIECES[PIECE_DU_COACH[k]].voie === k),
    Object.keys(COACHS).map(k => PIECES[PIECE_DU_COACH[k]] ? PIECES[PIECE_DU_COACH[k]].ico : '?').join(' '));
  // Les pièces offertes se tirent de la graine : deux graines, deux offres ; la même, la même.
  const a = piecesOffertes(null, 'g1', 'bq0'), b = piecesOffertes(null, 'g2', 'bq0');
  exiger('deux graines, deux offres de pièces ; la même graine, la même offre', JSON.stringify(a) !== JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(piecesOffertes(null, 'g1', 'bq0')), `${a.join(', ')} · ${b.join(', ')}`);
  exiger('les rôles de COACH_DU_ROLE existent', Object.entries(COACH_DU_ROLE).every(([g2, roles]) => Object.keys(roles).every(r => PROFILS[g2][r])));
}

/* ---------- 3. le plafond effectif ---------- */
{
  const rep = lire('js/repechage.js'), g = lire('js/game.js');
  const fautes = [];
  for (const [f, src] of [['repechage.js', rep], ['game.js', g]]) {
    src.split('\n').forEach((l, k) => { if (/money\(MODE\(\)\.cap\)/.test(l) && !/de base, tordu/.test(l)) fautes.push(`${f}:${k + 1}`); });
  }
  exiger('la jauge, le budget et le bilan lisent plafondDeJauge, pas MODE().cap', fautes.length === 0 && /capMax: \(\) => plafondDeJauge\(\)/.test(g), fautes.join(' · ') || 'plafondDeJauge partout');
}

verdict('La vérité des chiffres');
