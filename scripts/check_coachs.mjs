/**
 * LES COACHS (v2, js/coachs.js) — les builds tiennent ce qu'ils promettent.
 *
 *   node scripts/check_coachs.mjs            (LIGUES=6 par défaut, dix minutes : l'équilibre se lit à ±0,4 V)
 *   LIGUES=0 node scripts/check_coachs.mjs   (sans l'équilibre, cinq secondes : la CI)
 *
 * Vérifie :
 *   1. la banque : chaque coach a sa couleur dans au moins trois familles et
 *      assez de cartes pour bâtir (au moins 13), peu de cartes neutres, et le
 *      coach de quelques cartes témoins se lit comme on l'attend ;
 *   2. la confiance : la 3e, la 6e et la 9e carte d'un coach allument I, II,
 *      III, une seule fois ; le report d'une run et le coach du départ
 *      comptent ; une carte « + » compte pour sa carte de base ;
 *   3. le scaling : une carte de coach grandit avec les cartes de son coach,
 *      jusqu'à son plafond, et la décision porte le chiffre ;
 *   4. la boutique et le plafond : le Comptable change les packs, les jetons
 *      et le plafond comme un patron ; le pack du coach ne tire que sa
 *      couleur, pur ;
 *   5. le moteur : une confiance entre dans `team.coachs`, dans les effets de
 *      la saison et les minutes des trios, et la saison se rejoue ;
 *   6. l'équilibre, EN PAIRES : la confiance I vaut un patron commun, la III
 *      un légendaire — jamais un piège, jamais la saison à elle seule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, effetsDeSaison, partsDuRoulement } from '../js/sim.js';
import { POIDS_TRIO } from '../js/ratings.js';
import { BANQUE, ORDRE_CATEGORIES, buildDe, palierAllume, coachsActifs, coachDeCarte, idsDuCoach, payloadDe, modificateurs, plafondDe } from '../js/banque.js';
import { COACHS, ORDRE_COACHS, SEUILS, effetDePalier } from '../js/coachs.js';
import { tirerCartesPack, coachDuPack } from '../js/packs.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 6);
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const signe = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const fiche = t => `${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`;

console.log('\n  Les coachs (v2)\n');

/* 1. La banque. */
const tous = Object.values(BANQUE);
const neutres = tous.filter(c => !c.coach);
informer('les cartes', `${tous.length} · ${ORDRE_COACHS.map(k => `${COACHS[k].ico} ${idsDuCoach(k).length}`).join(' · ')} · neutres ${neutres.length}`);
const minces = ORDRE_COACHS.filter(k => idsDuCoach(k).length < 13 || new Set(idsDuCoach(k).map(id => BANQUE[id].cat)).size < 3);
exiger('chaque coach a au moins 13 cartes, dans au moins trois familles', !minces.length,
  ORDRE_COACHS.map(k => `${COACHS[k].nom} ${idsDuCoach(k).length}/${new Set(idsDuCoach(k).map(id => BANQUE[id].cat)).size}`).join(' · '));
borne('les cartes neutres (piocher, lire leur plan)', neutres.length / tous.length, 0, 0.1);
exiger('le registre a grandi : plus de 280 cartes', tous.length >= 280, `${tous.length}`);
const TEMOINS = { 'match:lancer': 'essaim', 'match:bloquer': 'tortue', 'match:sagesse': 'choeur', 'match:quatrieme': 'profondeur', 'match:capitaine': 'etoiles',
  'patron:soi_medecin': 'souffle', 'patron:phy_force': 'rhinos', 'patron:att_avantage': 'rapaces', 'plafond:ltir': 'banque', 'evenement:arbitres': 'choeur', 'saison:cadenas': 'tortue' };
const faux = Object.entries(TEMOINS).filter(([id, k]) => coachDeCarte(id) !== k).map(([id, k]) => `${id} → ${coachDeCarte(id)} (attendu ${k})`);
exiger('le coach d\'une carte se lit sur ce qu\'elle fait', !faux.length, faux.join(' · ') || `${Object.keys(TEMOINS).length} témoins`);
exiger('chaque famille a des cartes de coach', ORDRE_CATEGORIES.every(c => tous.some(x => x.cat === c && x.coach)), ORDRE_CATEGORIES.join(' · '));

/* 2. La confiance. */
{
  const cartes = idsDuCoach('tortue').filter(id => BANQUE[id].cat === 'evenement');
  const decs = [];
  const allumes = [];
  for (let i = 0; i < 10; i++) {
    const d = { jour: i, joue: { src: 'partie', id: cartes[i % cartes.length], ref: `x${i}` } };
    const a = palierAllume(decs, d);
    if (a) allumes.push(`${i + 1}:${a.coach.palier}`);
    decs.push({ ...d, ...(a || {}) });
  }
  exiger('les cartes 3, 6 et 9 allument I, II, III, une fois chacune', allumes.join(' ') === '3:1 6:2 9:3', allumes.join(' ') || 'rien');
  exiger('les confiances actives gardent la plus haute', coachsActifs(decs).length === 1 && coachsActifs(decs)[0].palier === 3, JSON.stringify(coachsActifs(decs).map(x => [x.cle, x.palier])));
  exiger('une journée à venir ne compte pas encore', buildDe(decs, 5).tortue === 5, `${buildDe(decs, 5).tortue} au matin du jour 5`);
  const base = [{ jour: 0, coachsDeBase: { essaim: SEUILS[0] }, coach: effetDePalier('essaim', 1) }];
  const deux = idsDuCoach('essaim').slice(0, 3).map((id, i) => ({ jour: 1 + i, joue: { src: 'partie', id } }));
  const d4 = palierAllume([...base, ...deux.slice(0, 2)], deux[2]);
  exiger('le coach du départ compte trois cartes, et la 6e allume II', !palierAllume(base, deux[0]) && d4 && d4.coach.palier === 2, d4 ? `II au jour ${deux[2].jour}` : 'rien');
  exiger('une carte gagnée à un gros match compte pour son coach', buildDe([{ jour: 3, recompense: 'bloquer+' }]).tortue === 1, 'Bloquer des tirs+');
}

/* 3. Le scaling. */
{
  const p0 = payloadDe('patron:att_volume', { patrons: [], build: {} }).patron.volume;
  const p5 = payloadDe('patron:att_volume', { patrons: [], build: { essaim: 5 } }).patron.volume;
  const p30 = payloadDe('patron:att_volume', { patrons: [], build: { essaim: 30 } }).patron.volume;
  exiger('un adjoint de coach grandit avec les cartes de son coach, jusqu\'à son plafond', p0 === 1.01 && Math.abs(p5 - 1.03) < 1e-9 && Math.abs(p30 - 1.05) < 1e-9, `tirs ×${p0} → ×${p5} (5 cartes) → ×${p30} (30, plafonné à 10)`);
  const e8 = payloadDe('evenement:bunker', { build: { tortue: 8 } }).effet.defense;
  exiger('un événement de coach aussi, et une autre couleur ne compte pas', Math.abs(e8 - 0.948) < 1e-9 && payloadDe('evenement:bunker', { build: { essaim: 8 } }).effet.defense === 0.98, `buts contre ×${e8} avec huit cartes de la Tortue`);
  const g = payloadDe('evenement:commanditaires', { build: { banque: 4 } }).gain;
  exiger('les jetons d\'un événement du Comptable grandissent', g === 8 + 3 * 4, `+${g} 🪙 avec quatre cartes`);
}

/* 4. La boutique, le plafond, le pack du coach. */
{
  const d = [{ jour: 2, coach: effetDePalier('banque', 3) }];
  const m = modificateurs(d, 10);
  exiger('le Comptable III : packs −15 %, +2 🪙 par victoire', Math.abs(m.rabais - 0.85) < 1e-9 && m.jetonsVictoire.some(x => x.n === 2 && x.depuis === 2), `rabais ×${m.rabais} · ${JSON.stringify(m.jetonsVictoire)}`);
  const pl = plafondDe(d, 10, { base: 82_000_000 });
  exiger('le Comptable III : plafond +3 %', pl.cap === 82_000_000 + Math.round(82_000_000 * 0.03), `${(pl.cap / 1e6).toFixed(2)} M$`);
  let hors = 0, impurs = 0;
  for (let n = 0; n < 300; n++) for (const k of ORDRE_COACHS) {
    const a = tirerCartesPack('coach', `g${n}`, n, { coach: k });
    if (a.some(id => BANQUE[id].coach !== k)) hors++;
    if (JSON.stringify(a) !== JSON.stringify(tirerCartesPack('coach', `g${n}`, n, { coach: k }))) impurs++;
  }
  exiger('le pack du coach ne tire que sa couleur, et il est pur', !hors && !impurs, `${hors} hors couleur, ${impurs} impur(s) sur ${300 * ORDRE_COACHS.length}`);
  const auHasard = new Set(Array.from({ length: 200 }, (_, n) => coachDuPack('g', n, {})));
  exiger('au hasard, le pack du coach tire tous les coachs', auHasard.size === ORDRE_COACHS.length, `${auHasard.size} coachs sur 200 packs`);
}

/* 5. Le moteur. */
{
  const t = ligue(79, 16), moi = t[0];
  const decs = [{ jour: 5, equipe: 0, coach: effetDePalier('tortue', 3) }, { jour: 6, equipe: 0, coach: effetDePalier('etoiles', 3) }];
  simulateLeague(t, 82, { graine: 'coachs', decisions: decs });
  const e = effetsDeSaison(moi);
  exiger('une confiance joue pour la saison', (moi.coachs || []).length === 2 && Math.abs(e.defense - 0.95) < 1e-9 && Math.abs(e.finition - 1.04) < 1e-9, `buts contre ×${e.defense.toFixed(3)} · précision ×${e.finition.toFixed(3)}`);
  const parts = partsDuRoulement(POIDS_TRIO, 'F', moi), sans = partsDuRoulement(POIDS_TRIO, 'F', { ...moi, coachs: [] });
  exiger('le Showman donne plus de glace au premier trio', parts[0] > sans[0] && parts[3] < sans[3], `1er trio ${sans[0].toFixed(3)} → ${parts[0].toFixed(3)}`);
  const a = ligue(79, 16), b = ligue(79, 16);
  simulateLeague(a, 82, { graine: 'coachs', decisions: decs });
  simulateLeague(b, 82, { graine: 'coachs', decisions: decs });
  exiger('la saison se rejoue au but près avec les coachs', a.every((x, i) => fiche(x) === fiche(b[i])), `${fiche(a[0])} puis ${fiche(b[0])}`);
}

/* 6. L'équilibre, en paires (voir check_cartes.mjs). */
function paires(fabrique) {
  const dv = [];
  for (let Lg = 0; Lg < LIGUES; Lg++) {
    const bras = [];
    for (const parite of [0, 1]) {
      const teams = ligue(3000 + Lg);
      const decisions = teams.map((_, i) => i).filter(i => i % 2 === parite).flatMap(equipe => fabrique(equipe));
      simulateLeague(teams, 82, { graine: `coachs-${Lg}`, decisions });
      bras.push(teams.map(x => x.W));
    }
    for (let i = 0; i < 32; i++) dv.push(bras[i % 2 === 0 ? 0 : 1][i] - bras[i % 2 === 0 ? 1 : 0][i]);
  }
  return moy(dv);
}
// Sans ligue (LIGUES=0, la CI), l'équilibre se lit à la main.
if (LIGUES > 0) {
  const hors = [], I = [], III = [];
  console.log(`\n  ${LIGUES} ligues × 32 équipes, en paires\n`);
  for (const k of ORDRE_COACHS) {
    if (!Object.keys(COACHS[k].paliers[0]).some(x => x !== 'econ')) continue;   // le Comptable joue à la boutique, pas sur la glace
    const v1 = paires(equipe => [{ jour: 0, equipe, coach: effetDePalier(k, 1) }]);
    const v3 = paires(equipe => [{ jour: 0, equipe, coach: effetDePalier(k, 3) }]);
    I.push(v1); III.push(v3);
    console.log(`  ${COACHS[k].ico} ${COACHS[k].nom.padEnd(16)} I ${signe(v1)} V · III ${signe(v3)} V`);
    if (v1 < -0.8 || v1 > 1.8 || v3 < -0.5 || v3 > 4) hors.push(`${COACHS[k].nom} ${signe(v1)}/${signe(v3)}`);
  }
  exiger('aucune confiance n\'est un piège ni la saison à elle seule (I : −0,8 à +1,8 · III : −0,5 à +4)', !hors.length, hors.join(' · ') || `${I.length} coachs`);
  borne('en moyenne, la confiance I vaut un patron commun', moy(I), -0.2, 1.2, ' V');
  borne('en moyenne, la confiance III vaut un légendaire et un peu plus', moy(III), 0.6, 3, ' V');
  exiger('la III vaut plus que la I, en moyenne', moy(III) > moy(I), `${signe(moy(I))} → ${signe(moy(III))} V`);
}

verdict('Les coachs');
