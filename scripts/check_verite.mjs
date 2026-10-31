/*
 * LA VÉRITÉ DES CHIFFRES (refonte coachs-cartes-incidents, tranche 2 ; JP,
 * 27 oct. 2026 : *l'écran et le moteur disent des chiffres différents*).
 * Chaque affichage lit la valeur du moteur ; un test par accroc :
 *
 *   1. LA GRAINE COMPTE pour les tirages purs (situations,
 *      objectifs, ajustements) : une graine en base 36 valait 0 par
 *      `Number(graine)`, et toutes les runs tiraient pareil.
 *   2. LE COACH (V21) : son choix dit ses pouvoirs et les niveaux qui les
 *      ouvrent ; les adjoints offerts se tirent de la graine ; « Tes cartes
 *      jouées » ne se promet plus.
 *   3. LA PITIÉ : « au plus tard au N+1e pack » et le moteur garantit le
 *      N+1e, pas le Ne.
 *   4. LES MATCHS, PAS LES JOURNÉES : les paliers du personnel et la main du
 *      deck se comptent en matchs du club, et l'écran le dit.
 *   5. LE PLAFOND EFFECTIF : la jauge, la phrase du budget et le bilan lisent
 *      `plafondDeJauge`, jamais `MODE().cap` seul (le Rogue tord le plafond).
 *
 *   node scripts/check_verite.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, verdict } from './verdict.mjs';
import { chainesDe } from './lib/chaines.mjs';
import { entierDeGraine, objectifsOfferts, ajustementsOfferts, situationsDuJour, JOURS_SITUATIONS, PALIERS_CARTES, PROFILS,
  autoRoster, registerHiddenRatings, createTeam } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { COACHS, COACH_DU_ROLE } from '../js/coachs.js';
import { POUVOIRS, NIVEAU_DES_POUVOIRS } from '../js/pouvoirs.js';
import { adjointsOfferts } from '../js/adjoints.js';
import { PITIE, packsSansHolo } from '../js/packs.js';
import { PALIERS_PACK } from '../js/inventaire.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const prose = f => chainesDe(lire(`js/${f}`));

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
  const oa = objectifsOfferts(a, 0).join(), ob = objectifsOfferts(b, 0).join();
  exiger('deux graines, deux offres du proprio', oa !== ob, `${oa} / ${ob}`);
  const sa = situationsDuJour(you, a, JOURS_SITUATIONS[0], 0), sb = situationsDuJour(you, b, JOURS_SITUATIONS[0], 0);
  const cle = x => (x ? `${x.porte && x.porte.p ? x.porte.p.n : ''}|${x.pese && x.pese.p ? x.pese.p.n : ''}|${x.nom || x.cle || ''}` : '');
  exiger('deux graines, deux situations du vestiaire', !!sa && !!sb && JSON.stringify(sa) !== JSON.stringify(sb), `${cle(sa)} / ${cle(sb)}`);
  exiger('deux graines, deux ajustements offerts', ajustementsOfferts(a, 0, 0, 'egal').join() !== ajustementsOfferts(b, 0, 0, 'egal').join());
}

/* ---------- 2. le coach ---------- */
{
  const sa = prose('saison.js'), g = prose('game.js');
  // V21 : le loto de l'entraîneur dit les trois pouvoirs de sa philosophie et les niveaux qui les ouvrent, ceux du code.
  const rj = lire('js/rogue-jeu.js');
  exiger('le choix du coach dit ses pouvoirs et les niveaux qui les ouvrent', /POUVOIRS\[c\.cle\]\.map/.test(rj) && /NIVEAU_DES_POUVOIRS/.test(rj) && Object.keys(COACHS).every(k => POUVOIRS[k] && POUVOIRS[k].length === NIVEAU_DES_POUVOIRS.length),
    `${Object.keys(COACHS).length} coachs, pouvoirs aux niveaux ${NIVEAU_DES_POUVOIRS.join(', ')}`);
  exiger('« tes cartes jouées » ne se promet plus', !sa.some(s => /cartes jouées viennent ici/.test(s)) && !g.some(s => /cartes de sa couleur/.test(s)));
  // Les adjoints offerts se tirent de la graine : deux graines, deux offres ; la même, la même.
  const a = adjointsOfferts([], 'g1', 'pp9'), b = adjointsOfferts([], 'g2', 'pp9');
  exiger('deux graines, deux offres d\'adjoints ; la même graine, la même offre', JSON.stringify(a) !== JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(adjointsOfferts([], 'g1', 'pp9')), `${a.join(', ')} · ${b.join(', ')}`);
  exiger('les rôles de COACH_DU_ROLE existent', Object.entries(COACH_DU_ROLE).every(([g2, roles]) => Object.keys(roles).every(r => PROFILS[g2][r])));
}

/* ---------- 3. la pitié ---------- */
{
  const achats = n => Array.from({ length: n }, (_, i) => ({ achat: { sorte: 'joueurs', n: i + 1, meilleure: 'commune' } }));
  exiger('PITIE packs sans Or ni Holo se comptent PITIE', packsSansHolo(achats(PITIE)) === PITIE && packsSansHolo([...achats(3), { achat: { sorte: 'joueurs', n: 4, meilleure: 'rare' } }]) === 0);
  const m = prose('magasin.js').find(s => /au plus tard au/.test(s)) || '';
  exiger('la boutique promet le PITIE + 1e pack', /PITIE \+ 1/.test(lire('js/magasin.js').split('au plus tard au')[1].slice(0, 20)), m.slice(0, 60));
  exiger('le moteur garantit au PITIE + 1e (packsSansHolo >= PITIE)', /packsSansHolo\(decs\) >= PITIE\b/.test(lire('js/rogue-jeu.js')));
}

/* ---------- 4. les matchs, pas les journées ---------- */
{
  const sa = lire('js/saison.js');
  exiger('les paliers de la saison se comptent en matchs du club (jEv)', /PALIERS_CARTES\.find\(j => jour >= jEv\(j\)/.test(sa), `main aux ${PALIERS_CARTES.join(', ')}e matchs, adjoints aux ${PALIERS_PACK.join(', ')}e`);
  const inv = prose('inventaire.js');
  exiger('la main du deck se dit « du Ne match », pas « de la journée »', inv.some(s => /^Main du $/.test(s)) && !inv.some(s => /Main de la journée/.test(s)));
  const html = lire('index.html').replace(/<!--[\s\S]*?-->/g, '');
  exiger('les règles disent les paliers en matchs', new RegExp(`${PALIERS_CARTES[0]}e, ${PALIERS_CARTES[1]}e et ${PALIERS_CARTES[2]}e matchs`).test(html) && new RegExp(`${PALIERS_PACK[0]}e, ${PALIERS_PACK[1]}e et ${PALIERS_PACK[2]}e matchs`).test(html));
}

/* ---------- 5. le plafond effectif ---------- */
{
  const rep = lire('js/repechage.js'), g = lire('js/game.js');
  const fautes = [];
  for (const [f, src] of [['repechage.js', rep], ['game.js', g]]) {
    src.split('\n').forEach((l, k) => { if (/money\(MODE\(\)\.cap\)/.test(l) && !/de base, tordu/.test(l)) fautes.push(`${f}:${k + 1}`); });
  }
  exiger('la jauge, le budget et le bilan lisent plafondDeJauge, pas MODE().cap', fautes.length === 0 && /capMax: \(\) => plafondDeJauge\(\)/.test(g), fautes.join(' · ') || 'plafondDeJauge partout');
}

verdict('La vérité des chiffres');
