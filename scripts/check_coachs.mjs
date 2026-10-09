/**
 * LES COACHS (v2, js/coachs.js) — les builds tiennent ce qu'ils promettent.
 *
 *   node scripts/check_coachs.mjs            (LIGUES=6 par défaut, dix minutes : l'équilibre se lit à ±0,4 V)
 *   LIGUES=0 node scripts/check_coachs.mjs   (sans l'équilibre, cinq secondes : la CI)
 *
 * Vérifie :
 *   1. la banque : chaque coach a sa couleur dans au moins trois familles et
 *      assez de cartes pour bâtir (au moins 13), une carte neutre sur cinq environ, et le
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
 *      sur un vrai club moins que sur l'équipe bâtie pour elle (check_voies) —
 *      jamais un piège.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, effetsDeSaison, partsDuRoulement, joueursDesCoachs, systemeDe, bonusDuCoach, fitUnite, activeLineup, coachDuJoueur, PALIER_DU_COACH } from '../js/sim.js';
import { POIDS_TRIO } from '../js/ratings.js';
import { BANQUE, PATRONS, CONSOMMABLES, ORDRE_CATEGORIES, buildDe, palierAllume, coachsActifs, coachDeCarte, idsDuCoach, payloadDe, EVENEMENTS, modificateurs, plafondDe, reglesDe } from '../js/banque.js';
import { COACHS, ORDRE_COACHS, SEUILS, effetDePalier, GAIN_SYSTEME, ROLE_BON, COACH_DU_ROLE, coachDesRoles, porteParSesJoueurs, JOUEUR_COACH, PALIERS_COACH_MAX } from '../js/coachs.js';
import { tirerCartesPack, coachDuPack, niveauxDuPack, tirerJoueursDuPack } from '../js/packs.js';
import { PRESTIGES, rangDePrestige } from '../js/rogue.js';
import { poserClubLu } from '../js/impact.js';
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
// v2 (JP : *faudrait quand même des cartes qui sont pas liées à un coach*) : une carte sur cinq environ reste neutre.
borne('les cartes neutres (sans signal, à peine, ou à parts égales)', neutres.length / tous.length, 0.12, 0.3);
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
  // V5 : c'est jouer la carte qui compte, pas la gagner ni l'acheter.
  exiger('une carte jouée dans la main d\'un gros match compte pour son coach', buildDe([{ jour: 3, main: { jouees: ['bloquer+'], enMain: [] } }]).tortue === 1, 'Bloquer des tirs+');
  exiger('une carte gagnée à un gros match ne compte pas tant qu\'elle n\'est pas jouée', buildDe([{ jour: 3, recompense: 'bloquer+' }]).tortue === 0, 'Bloquer des tirs+');
}

/* 2b. Les systèmes se tiennent : la confiance II fait apprendre son système. */
{
  const cartes = idsDuCoach('essaim').slice(0, 6);
  const decs = [];
  let ii = null;
  cartes.forEach((id, i) => { const d = { jour: i, joue: { src: 'partie', id } }; const a = palierAllume(decs, d); if (a && a.coach.palier === 2) ii = a; decs.push({ ...d, ...(a || {}) }); });
  exiger('la confiance II du Frelon fait apprendre son système à tes avants', !!ii && ii.maitrise && ii.maitrise.tac === COACHS.essaim.systeme && ii.maitrise.gain === GAIN_SYSTEME,
    ii ? JSON.stringify(ii.maitrise) : 'pas de confiance II');
}

/* 2c. Le prestige du club : il ouvre les Étoiles et les Phénomènes, run après run. */
{
  const rangs = [{}, { ecussonsAVie: 200 }, { ecussonsAVie: 400 }, { ecussonsAVie: 400, jalons: { series: 1 } }, { ecussonsAVie: 5000, jalons: { series: 1, ronde: 1, finale: 1 } }].map(rangDePrestige);
  exiger('le prestige demande des écussons à vie ET un exploit à chaque rang', rangs.join(',') === '0,1,1,2,4', rangs.join(', '));
  const lire = (cle, r) => niveauxDuPack(cle, { prestige: PRESTIGES[r] });
  const somme = t => Object.values(t).reduce((a, b) => a + b, 0);
  const or = PRESTIGES.map((_, r) => lire('j:hasard_or', r));
  exiger('au garage, aucun Phénomène ; les Étoiles montent avec chaque rang', or[0].phenomene === 0 && or.every((t, r) => !r || (t.etoile > or[r - 1].etoile && t.phenomene >= or[r - 1].phenomene)),
    or.map(t => `${t.etoile.toFixed(1)}/${t.phenomene.toFixed(2)}`).join(' → ') + ' % (Étoile/Phénomène, pack Or)');
  exiger('les taux font toujours 100 %, pack d\'étoiles compris', PRESTIGES.every((_, r) => Math.abs(somme(lire('j:hasard_bronze', r)) - 100) < 1e-9 && Math.abs(somme(lire('j:etoiles', r)) - 100) < 1e-9 && lire('j:etoiles', r).pilier === 0),
    `Étoiles au garage : ${lire('j:etoiles', 0).etoile.toFixed(0)} % d'étoiles, ${lire('j:etoiles', 0).phenomene.toFixed(0)} % de Phénomènes`);
}

/* 2d. Les joueurs ont une couleur, et ils portent leur coach et ses cartes. */
{
  const tousLesRoles = Object.values(COACH_DU_ROLE).flatMap(g => Object.values(g));
  exiger('chaque coach de la glace a des rôles de sa couleur (le Comptable paie, il n\'a pas de joueurs)',
    ORDRE_COACHS.filter(k => k !== 'banque').every(k => tousLesRoles.includes(k)) && !tousLesRoles.includes('banque'), ORDRE_COACHS.map(k => `${COACHS[k].ico} ${tousLesRoles.filter(x => x === k).length}`).join(' · '));
  exiger(`un rôle maîtrisé (${ROLE_BON} et plus) donne sa couleur ; en dessous, aucune`,
    coachDesRoles({ sniper: 80, passeur: 60 }, 'F') === 'rapaces' && coachDesRoles({ sniper: ROLE_BON - 1 }, 'F') === null && coachDesRoles({ defensif: 70, offensif: 40 }, 'D') === 'tortue', 'sniper 80 → Aigle · sniper 54 → aucune · défensif 70 → Tortue');
  const t = ligue(79, 2)[0];
  const n = joueursDesCoachs(t);
  const total = Object.values(n).reduce((a, b) => a + b.joueurs, 0);
  informer('les couleurs d\'une vraie équipe', `${t.name || ''} : ${Object.entries(n).map(([k, v]) => `${COACHS[k].ico} ${v.joueurs} (${v.paliers} paliers)`).join(' · ')} (${total} joueurs de couleur sur 20 habillés)`);
  exiger('une vraie équipe a des joueurs de plusieurs couleurs', Object.keys(n).length >= 3 && total >= 8, `${Object.keys(n).length} couleurs, ${total} joueurs`);
  const k = Object.keys(n).sort((a, b) => n[b].paliers - n[a].paliers)[0];
  const avec = effetsDeSaison({ ...t, coachs: [effetDePalier(k, 3)] }), sans = effetsDeSaison({ ...t, roster: {}, coachs: [effetDePalier(k, 3)] });
  const canal = Object.keys(COACHS[k].paliers[2]).find(c => ['finition', 'defense', 'volume', 'discipline', 'blessure'].includes(c)) || 'robustesse';
  const attendu = porteParSesJoueurs(effetDePalier(k, 3), n[k].paliers)[canal];
  exiger('sa confiance joue plus fort par PALIER de sa couleur habillé (V2.3)', Math.abs((avec[canal] ?? 0) - attendu) < 1e-9 && Math.abs(avec[canal] - (canal === 'robustesse' ? 0 : 1)) > Math.abs(sans[canal] - (canal === 'robustesse' ? 0 : 1)),
    `${COACHS[k].nom} III, ${n[k].joueurs} joueurs, ${n[k].paliers} paliers : ${canal} ${sans[canal].toFixed(3)} sans eux → ${avec[canal].toFixed(3)} (×${(1 + JOUEUR_COACH * n[k].paliers).toFixed(2)} de l'écart)`);
  const un = porteParSesJoueurs(effetDePalier(k, 3), 1), quatre = porteParSesJoueurs(effetDePalier(k, 3), 4), vingt = porteParSesJoueurs(effetDePalier(k, 3), 20);
  // L'écart d'un canal à 1, en puissance (V2.3 : ×0,88 porté deux fois vaut ×0,77) ; la robustesse, une somme, en produit.
  const ec = x => (canal === 'robustesse' ? x[canal] : Math.log(x[canal]));
  const cap = porteParSesJoueurs(effetDePalier(k, 3), PALIERS_COACH_MAX), trop = porteParSesJoueurs(effetDePalier(k, 3), 3 * PALIERS_COACH_MAX);
  exiger(`un Platine compte pour quatre Bronze, jusqu'à ${PALIERS_COACH_MAX} paliers`, Math.abs(ec(quatre) / ec(un) - (1 + 4 * JOUEUR_COACH) / (1 + JOUEUR_COACH)) < 1e-9
    && Math.abs(ec(vingt)) > Math.abs(ec(quatre)) * 1.5 && ec(trop) === ec(cap),
    `1, 4, 20 et ${3 * PALIERS_COACH_MAX} paliers : ${[un, quatre, vingt, trop].map(x => x[canal].toFixed(3)).join(' · ')}`);
  const c5 = payloadDe('consommable:cleCoin', { joueurs: { rapaces: { joueurs: 9, paliers: 20 } } }).effet.finition, c0 = payloadDe('consommable:cleCoin', {}).effet.finition;
  const CC = CONSOMMABLES.cleCoin;
  exiger('une carte de vestiaire grandit avec les joueurs de sa couleur, jusqu\'à son plafond', c0 === CC.effet.finition && Math.abs(c5 - (c0 + CC.parJoueur.par.finition * CC.parJoueur.max)) < 1e-9, `précision ×${c0} sans joueur → ×${c5} (neuf joueurs, plafonné à cinq)`);
  // L'écran lit les pas en chiffres de match pour TON club (js/impact.js) : « jusqu'à ≈ +0,6 tir par match avec 10 cartes ».
  poserClubLu(() => ({ team: t }));
  const pas = Object.keys(BANQUE).flatMap(id => reglesDe(id).filter(m => /^Jusqu'à |^Grandit avec chaque /.test(m.txt)).map(m => `${id} : ${m.txt}`));
  const mauvais = pas.filter(x => /%/.test(x) || /≈ [+−]\d{2,}[,\d]* (tirs?|buts?)/.test(x) || /≈ −(?:[5-9]|\d{2,})[,\d]* (tirs?|buts?)/.test(x));
  poserClubLu(null);
  exiger('un pas se lit comme un pas, en chiffres de match (« jusqu\'à ≈ +0,6 tir par match avec 10 cartes »), jamais un « % »', pas.length > 0 && !mauvais.length, mauvais.slice(0, 3).join(' · ') || `${pas.length} cartes · ${(pas[0] || '').slice(0, 120)}`);
}

/* 3. Le scaling. */
{
  const p0 = payloadDe('patron:att_volume', { patrons: [], build: {} }).patron.volume;
  const p5 = payloadDe('patron:att_volume', { patrons: [], build: { essaim: 5 } }).patron.volume;
  const p30 = payloadDe('patron:att_volume', { patrons: [], build: { essaim: 30 } }).patron.volume;
  const AV = PATRONS.att_volume, pas = AV.echelle.par.volume;
  exiger('un adjoint de coach grandit avec les cartes de son coach, jusqu\'à son plafond', p0 === AV.effet.volume && Math.abs(p5 - (p0 + 5 * pas)) < 1e-9 && Math.abs(p30 - (p0 + AV.echelle.max * pas)) < 1e-9, `tirs ×${p0} → ×${p5} (5 cartes) → ×${p30} (30, plafonné à 10)`);
  const e8 = payloadDe('evenement:bunker', { build: { tortue: 8 } }).effet.defense;
  // Les valeurs viennent de l'événement lui-même : une règle recopiée est une règle qui ment tôt ou tard.
  const BK = EVENEMENTS.bunker, base = BK.effet.defense, attendu8 = base + Math.min(8, BK.echelle.max) * BK.echelle.par.defense;
  exiger('un événement de coach aussi, et une autre couleur ne compte pas', Math.abs(e8 - attendu8) < 1e-9 && payloadDe('evenement:bunker', { build: { essaim: 8 } }).effet.defense === base, `buts contre ×${e8} avec huit cartes de la Tortue (base ×${base})`);
  const g = payloadDe('evenement:commanditaires', { build: { banque: 4 } }).gain;
  exiger('les jetons d\'un événement du Comptable grandissent', g === 8 + 3 * 4, `+${g} 🪙 avec quatre cartes`);
}

/* 4. La boutique, le plafond, le pack du coach. */
{
  const d = [{ jour: 2, coach: effetDePalier('banque', 3) }];
  const m = modificateurs(d, 10);
  exiger('le Comptable III : packs −20 %, +3 🪙 par victoire', Math.abs(m.rabais - 0.80) < 1e-9 && m.jetonsVictoire.some(x => x.n === 3 && x.depuis === 2), `rabais ×${m.rabais} · ${JSON.stringify(m.jetonsVictoire)}`);
  const pl = plafondDe(d, 10, { base: 82_000_000 });
  exiger('le Comptable III : plafond +5 %', pl.cap === 82_000_000 + Math.round(82_000_000 * 0.05), `${(pl.cap / 1e6).toFixed(2)} M$`);
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
  // Portée par ses joueurs habillés ce soir-là (2d) : la Tortue par ses joueurs de devoir, le Showman par ses passeurs.
  const nj = joueursDesCoachs(moi);
  const d0 = porteParSesJoueurs(effetDePalier('tortue', 3), (nj.tortue || {}).paliers).defense, f0 = porteParSesJoueurs(effetDePalier('etoiles', 3), (nj.etoiles || {}).paliers).finition;
  exiger('une confiance joue pour la saison', (moi.coachs || []).length === 2 && Math.abs(e.defense - d0) < 1e-9 && Math.abs(e.finition - f0) < 1e-9, `buts contre ×${e.defense.toFixed(3)} · précision ×${e.finition.toFixed(3)} (${(nj.tortue || {}).paliers || 0} et ${(nj.etoiles || {}).paliers || 0} paliers de leur couleur)`);
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
    if (v1 < -0.8 || v1 > 2.2 || v3 < -0.5 || v3 > 6) hors.push(`${COACHS[k].nom} ${signe(v1)}/${signe(v3)}`);
  }
  /*
   * V2.3 (check_voies) : un vrai club porte un à huit paliers de chaque couleur, donc sa III tombe entre la III
   * sans joueurs (≈ +2 V) et la III sur une équipe bâtie pour elle (+6 à +8 V) — jamais au-dessus de celle-ci.
   */
  exiger('aucune confiance n\'est un piège ni la voie à elle seule (I : −0,8 à +2,2 · III : −0,5 à +6)', !hors.length, hors.join(' · ') || `${I.length} coachs`);
  borne('en moyenne, la confiance I vaut un patron commun', moy(I), -0.2, 1.5, ' V');
  borne('en moyenne, la confiance III sur un vrai club, sous ce qu\'elle vaut sur son équipe', moy(III), 1, 5.5, ' V');
  exiger('la III vaut plus que la I, en moyenne', moy(III) > moy(I), `${signe(moy(I))} → ${signe(moy(III))} V`);
}

/*
 * TOUT SE PARLE (V2.3). Le système d'un coach DEMANDE ses joueurs (des cases de sa couleur), il le joue un
 * palier plus haut à sa confiance II (`bonusDuCoach`), et son dépisteur recrute sa couleur.
 */
{
  const mal = ORDRE_COACHS.filter(k => k !== 'banque').filter(k => {
    const S = systemeDe(COACHS[k].systeme);
    return !S || !Object.values(S.slots).some(r => COACH_DU_ROLE[S.groupe][r] === k);
  });
  exiger('le système de chaque coach demande des joueurs de sa couleur', mal.length === 0,
    mal.map(k => COACHS[k].nom).join(', ') || ORDRE_COACHS.filter(k => COACHS[k].systeme).map(k => `${COACHS[k].ico} ${systemeDe(COACHS[k].systeme).ico}`).join(' · '));
  const t = ligue(79, 2)[0];
  const k = 'rapaces', sys = COACHS[k].systeme;
  const avec = { ...t, coachs: [effetDePalier(k, 2)] }, avecI = { ...t, coachs: [effetDePalier(k, 1)] };
  exiger('à sa confiance II, son système joue un palier plus haut (une case du bon badge)', bonusDuCoach(avec, sys) === PALIER_DU_COACH && bonusDuCoach(avecI, sys) === 0 && bonusDuCoach(avec, 'defensive') === 0,
    `${COACHS[k].nom} II : ${systemeDe(sys).nom} +${PALIER_DU_COACH} palier`);
  // Huit clubs, pas un (V5) : un club tiré peut n'avoir que des cases sans badge (52) ou déjà plafonnées (100), où le
  // palier de plus n'a rien à monter. Le fit ne baisse jamais, et il monte là où un badge a de la place.
  const mesures = ligue(79, 8).map(c => { const l = activeLineup(c); return { f0: [0, 1, 2, 3].map(u => fitUnite(l, 'F', u, sys)), f1: [0, 1, 2, 3].map(u => fitUnite(l, 'F', u, sys, 1)) }; });
  const monte = mesures.find(m => m.f1.some((x, u) => x > m.f0[u])) || mesures[0];
  exiger('… et le fit monte là où le badge est là', mesures.every(m => m.f1.every((x, u) => x >= m.f0[u])) && mesures.some(m => m.f1.some((x, u) => x > m.f0[u])), `${monte.f0.join('/')} → ${monte.f1.join('/')}`);
}
{
  // Le dépisteur : sur 60 packs de joueurs, le coach de la run en tire plus de sa couleur qu'un club sans coach.
  const saisons = fs.readdirSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seasons')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  const C = new Map();
  const shard = s => {
    if (!C.has(s)) {
      const d = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seasons', `${s}.json`), 'utf8'));
      const byTeam = {};
      for (const p of d.players) { registerHiddenRatings(p); (byTeam[p.t] = byTeam[p.t] || []).push(p); }
      C.set(s, { players: d.players, byTeam });
    }
    return C.get(s);
  };
  const part = async coach => {
    let n = 0, de = 0;
    for (let i = 0; i < 60; i++) {
      const { cartes } = await tirerJoueursDuPack('j:hasard_argent', { graine: `depisteur-${i}`, n: i, mods: coach ? { coach } : {}, saisons: saisons.slice(20, 50), shard: async s => shard(s) });
      for (const x of cartes) { n++; if (coachDuJoueur(x.p) === 'rapaces') de++; }
    }
    return de / Math.max(1, n);
  };
  const sans = await part(null), avec = await part('rapaces');
  exiger('le dépisteur de l\'Aigle recrute plus de joueurs de sa couleur', avec > sans + 0.03, `${Math.round(sans * 100)} % sans coach → ${Math.round(avec * 100)} % avec l'Aigle`);
}

verdict('Les coachs');
