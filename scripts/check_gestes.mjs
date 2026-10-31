/*
 * LES GESTES DANS LA FEUILLE (oct. 2026 ; JP : *inférer plus de données avec ce qui existe […] un moteur plus complet et
 * réaliste*). Les tirs bloqués, les punitions tirées, les départs de qualité, les mises en échec comptées — ce qui doit
 * tenir, sur une petite ligue fixe de huit vrais clubs (celle de l'empreinte) jouée au complet :
 *   1. les blocs : de 11 à 19 par club et par match (la ligue : 14 à 16) ; chacun crédité à un patineur habillé du club
 *      qui défend ; les défenseurs en prennent de 52 à 76 % (la ligue : 64 %) ; un défenseur pèse plus qu'un attaquant au
 *      même geste (`BLOCS_D_SUR_F`) ; le volume de lancers ne bouge pas (check_feuilles tient les égalités) ;
 *   2. les punitions tirées : chaque punition nomme qui l'a tirée, un patineur habillé du club qui en profite ; les
 *      facteurs de tirage des clubs tournent autour de 1 (la ligue ne bouge pas) ;
 *   3. le compte des feuilles (`compterFeuilles`) rend à chaque patineur ses coups et ses blocs, et à chaque gardien des
 *      départs de qualité, pas plus que ses matchs, à un taux de 35 à 75 % (la vraie LNH : autour de 55 %) ;
 *   4b. les minutes de chacun : un club fait 300 minutes de patineurs moins celles où il tue une punition, toutes à des
 *      habillés ; chaque match sans tirs de barrage a un but gagnant, un seul ;
 *   4. un lancer bloqué blesse : au moins une blessure « au pied » dans la saison, et les matchs-hommes perdus par club
 *      restent ceux de la vraie LNH (180 à 220 ; de 120 à 280 ici) — le bloc choisit qui se blesse, pas combien ;
 *   5. l'estimation d'un geste (`zGeste`) est finie pour tout patineur, mesuré ou pas.
 *
 *   node scripts/check_gestes.mjs
 */
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, compterFeuilles, getPlayerKey, zGeste, blocsDe, tirageDe, K_TIRAGE, BLOCS_PAR_TIR, BLOCS_D_SUR_F, BLOCS_QUI_BLESSENT } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const CLUBS = [['1985-86', 'MTL'], ['1985-86', 'EDM'], ['1995-96', 'DET'], ['1995-96', 'COL'], ['2005-06', 'CAR'], ['2005-06', 'OTT'], ['2015-16', 'PIT'], ['2015-16', 'SJS']];
const equipes = CLUBS.map(([s, tag]) => {
  const ps = equipeReelle(s, tag).flat().map(x => ({ ...x }));
  ps.forEach(registerHiddenRatings);
  return createTeam(`${tag} ${s}`, tag, autoRoster(ps), { season: s });
});
const estD = p => p.p === 'D' || p.p === 'LD' || p.p === 'RD';
const L = creerLigue(equipes, 82, { graine: 'gestes' });
jouerJusqua(L, L.calendrier.length);

const feuilles = [];
let matchs = 0, blocs = 0, blocsD = 0, blocsHabilles = 0, punitions = 0, tirees = 0, tireesHabillees = 0, lancers = 0;
for (const jour of L.calendrier) for (const m of jour) {
  const f = m.feuille;
  if (!f) continue;
  matchs++; feuilles.push(f); lancers += (f.lancers || []).length;
  for (const e of f.physique || []) {
    if (e.type !== 'bloc') continue;
    blocs++;
    if (estD(e.joueur)) blocsD++;
    if ((f.alignes?.[e.cote] || []).includes(e.joueur)) blocsHabilles++;
  }
  for (const pu of f.punitions || []) {
    punitions++;
    if (pu.tiree) { tirees++; if ((f.alignes?.[pu.cote === 'A' ? 'B' : 'A'] || []).includes(pu.tiree)) tireesHabillees++; }
  }
}
informer('la ligue', `${CLUBS.length} clubs, ${matchs} matchs, ${lancers} lancers, ${blocs} blocs, ${punitions} punitions`);

/* ---------- 1. les blocs ---------- */
borne('des blocs par club et par match', blocs / (2 * matchs), 11, 19);
exiger('chaque bloc est crédité à un patineur habillé du club qui défend', blocsHabilles === blocs, `${blocsHabilles} sur ${blocs}`);
borne('la part des blocs qui va aux défenseurs', blocsD / Math.max(1, blocs), 0.52, 0.76);
informer('un bloc par lancer au but, en moyenne', `${BLOCS_PAR_TIR} attendu, ${(blocs / Math.max(1, lancers)).toFixed(3)} joué`);
const unF = equipes[0].roster && Object.values(equipes[0].roster).find(p => p && !estD(p) && p.p !== 'G'), unD = Object.values(equipes[0].roster).find(p => p && estD(p));
exiger('un défenseur pèse plus qu\'un attaquant au même geste', !!unF && !!unD && blocsDe({ ...unD, bl: 0.5, s: unD.s }) > blocsDe({ ...unF, bl: 0.5, s: unF.s }) && BLOCS_D_SUR_F > 1, `×${BLOCS_D_SUR_F}`);

/* ---------- 2. les punitions tirées ---------- */
exiger('chaque punition nomme qui l\'a tirée', tirees === punitions && punitions > 100, `${tirees} sur ${punitions}`);
exiger('qui l\'a tirée est un patineur habillé du club qui en profite', tireesHabillees === tirees, `${tireesHabillees} sur ${tirees}`);
const facteurs = L.teams.map(t => Math.exp(K_TIRAGE * (tirageDe({ patineurs: Object.values(t.roster || {}).filter(p => p && p.p !== 'G') }) - 0.064)));
const moyenF = facteurs.reduce((a, c) => a + c, 0) / facteurs.length;
borne('les facteurs de tirage des clubs tournent autour de 1 (la ligue ne bouge pas)', moyenF, 0.92, 1.08);
informer('les facteurs de tirage', facteurs.map(x => x.toFixed(2)).join(' · '));

/* ---------- 3. le compte des feuilles ---------- */
const compte = compterFeuilles(feuilles);
let coupsComptes = 0, coupsFeuilles = 0, blocsComptes = 0, dq = 0, departs = 0, dqTrop = 0;
for (const f of feuilles) for (const e of f.physique || []) { if (e.type === 'coup') coupsFeuilles++; }
for (const [p, c] of compte) {
  if (p.p === 'G') { dq += c.dq; departs += c.gp; if (c.dq > c.gp) dqTrop++; continue; }
  coupsComptes += c.coups; blocsComptes += c.blocs;
}
exiger('le compte des feuilles rend à chaque patineur ses coups et ses blocs', coupsComptes === coupsFeuilles && blocsComptes === blocs, `${coupsComptes} coups, ${blocsComptes} blocs`);
exiger('un gardien n\'a jamais plus de départs de qualité que de matchs', dqTrop === 0 && departs > 0, `${dq} sur ${departs} départs`);
borne('le taux de départs de qualité', dq / Math.max(1, departs), 0.35, 0.75);

/* ---------- 4. un lancer bloqué blesse ---------- */
const blessures = L.teams.flatMap(t => t.injuriesLog || []);
const pieds = blessures.filter(b => b.genre === 'pied').length;
exiger(`un lancer bloqué blesse : au moins une blessure au pied dans la saison (${BLOCS_QUI_BLESSENT} blocs et plus le soir même)`, pieds >= 1, `${pieds} sur ${blessures.length} blessures`);
// La LNH perd de 180 à 220 matchs-hommes par club et par saison (js/sim.js, BLESSURES_LNH) : la blessure du bloc n'en ajoute pas, elle choisit qui.
borne('les matchs-hommes perdus par club restent ceux de la vraie LNH', blessures.reduce((a, b) => a + (b.games || 0), 0) / L.teams.length, 120, 280);

/* ---------- 4b. les minutes de chacun, le but gagnant ---------- */
let ecartMax = 0, depasse = 0, pleins = 0, minutesHorsAlignes = 0, gagnants = 0, sansBarrage = 0;
for (const f of feuilles) {
  const pk = { A: 0, B: 0 };
  for (const x of f.punitions || []) pk[x.cote] += Math.max(0, Math.min(60, x.fin ?? x.instant + 2) - Math.min(60, x.instant));
  for (const cote of ['A', 'B']) {
    const al = f.alignes?.[cote] || [], m = (f.minutes && f.minutes[cote]) || {}, cles = new Set(al.map(getPlayerKey));
    const total = Object.values(m).reduce((a, c) => a + c, 0), attendu = 300 - pk[cote];
    // Un club qui habille ses dix-huit patineurs remplit ses minutes ; un club à court (dix avants, trois défenseurs dans
    // cette ligue d'essai) en fait moins, jamais plus.
    if (al.filter(p => !estD(p)).length === 12 && al.filter(estD).length === 6) { pleins++; ecartMax = Math.max(ecartMax, Math.abs(total - attendu)); }
    if (total > attendu + 1) depasse++;
    for (const k of Object.keys(m)) if (!cles.has(k)) minutesHorsAlignes++;
  }
  if (!f.fusillade) sansBarrage++;
}
const compte2 = compterFeuilles(feuilles);
for (const [, c] of compte2) gagnants += c.gwg || 0;
exiger('un club de dix-huit patineurs fait 300 minutes moins celles où il tue une punition (à une minute près) ; aucun club n\'en fait plus', pleins > 100 && ecartMax < 1 && depasse === 0, `${pleins} alignements pleins, écart au pire ${ecartMax.toFixed(2)} min, ${depasse} au-dessus`);
exiger('chaque minute va à un patineur habillé', minutesHorsAlignes === 0, `${minutesHorsAlignes} hors alignement`);
exiger('chaque match sans tirs de barrage a son but gagnant, et un seul', gagnants === sansBarrage, `${gagnants} buts gagnants pour ${sansBarrage} matchs`);

/* ---------- 5. l'estimation d'un geste ---------- */
const patineurs = L.teams.flatMap(t => Object.values(t.roster || {}).filter(p => p && p.p !== 'G'));
const finis = patineurs.every(p => ['ht', 'bl', 'pd'].every(k => Number.isFinite(zGeste(p, k))));
exiger('l\'estimation d\'un geste est finie pour tout patineur, mesuré ou pas', finis, `${patineurs.length} patineurs, de 1985-86 à 2015-16`);

verdict('Les gestes dans la feuille');
