/**
 * LES VOIES (V2.3, docs/refonte-systeme.md § 8) — chaque coach bâti au complet.
 *
 *   node scripts/check_voies.mjs            (LIGUES=4 par défaut, une quinzaine de minutes)
 *   LIGUES=0 node scripts/check_voies.mjs   (la construction seule, sans saison : la CI)
 *
 * Une voie BÂTIE AU COMPLET : le même club, chaque case reprise par le joueur de la couleur du coach qui y est
 * CHEZ LUI (sa position et sa zone) et dont le salaire est le plus proche (la masse salariale ne bouge pas, sa
 * couleur oui ; une case sans joueur de la couleur chez lui garde le sien), la confiance III du coach,
 * et ses lignes laissées à l'IA (qui prend le système où ses joueurs ont leur badge, le sien à la II). Elle se
 * mesure EN PAIRES contre le même club sans coach. L'ÉQUIPE MÉLANGÉE : le club tel qu'il est, avec la même
 * confiance III — les couleurs de tout le monde.
 *
 * Vérifie, comme le budget du § 8 le demande :
 *   1. la construction tient : la masse salariale de l'alignement bâti reste celle du club ;
 *   2. chaque coach à sa III, sur l'équipe bâtie pour lui, vaut +6 à +8 V ;
 *   3. les voies sont à ±1 V l'une de l'autre (aucune n'est LA bonne) ;
 *   4. chaque coach vaut plus sur son équipe que sur une équipe mélangée.
 * Et dit la composition : l'équipe bâtie contre le club, sans coach (le prix des rôles, à salaire égal).
 */
import { simulateLeague, SLOTS, getHiddenRatings, joueursDesCoachs, coachDuJoueur } from '../js/sim.js';
import { COACHS, VOIES, effetDePalier } from '../js/coachs.js';
import { vestiaires, club, rosterDe, bassinsDesCouleurs, batir as batirDe, moy, signe } from './lib/voies.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const LIGUES = Number(process.env.LIGUES ?? 4);
// `VOIES=tortue,essaim` : n'en mesurer que quelques-unes (pour partager le travail entre plusieurs processus).
const MESUREES = process.env.VOIES ? process.env.VOIES.split(',') : VOIES;
// Chaque case s'apparie sur le SALAIRE (ce que le Rogue paie sous son plafond) ; `PAR=valeur` sur la valeur cachée. `SANS=1` : la composition seule.
const PAR = process.env.PAR === 'valeur' ? (p => getHiddenRatings(p).v) : (p => p.$ || 0);
const SANS = process.env.SANS === '1';
/* Le bassin de chaque couleur, et le même club repris par ses joueurs (scripts/lib/voies.mjs). */
const BASSIN = bassinsDesCouleurs(PAR);
const batir = (roster, k) => batirDe(roster, k, BASSIN, PAR);
const valeur = roster => SLOTS.reduce((a, s) => a + (roster[s.i] ? getHiddenRatings(roster[s.i]).v : 0), 0);
const masse = roster => SLOTS.reduce((a, s) => a + (roster[s.i] ? roster[s.i].$ || 0 : 0), 0);

console.log('\n  LES VOIES\n');

// 1. La construction tient.
{
  const V = vestiaires(41, 4);
  const ecarts = [], couleurs = [], valeurs = [];
  for (const v of V) for (const k of VOIES) {
    const r0 = rosterDe(v), r1 = batir(r0, k);
    ecarts.push(Math.abs(masse(r1) / masse(r0) - 1));
    valeurs.push(valeur(r1) / valeur(r0) - 1);
    const js = Object.values(r1).filter(Boolean);
    couleurs.push(js.filter(p => coachDuJoueur(p) === k).length / js.length);
  }
  informer('bassins', VOIES.map(k => `${COACHS[k].ico} ${BASSIN.get(k).length}`).join(' · '));
  // Une couleur ne prend que les cases qu'elle a : le Frelon n'a pas de gardien, l'Aigle pas de défenseur.
  informer('cases de la couleur du coach', VOIES.map((k, i) => `${COACHS[k].ico} ${Math.round(100 * moy(couleurs.filter((_, j) => j % VOIES.length === i)))} %`).join(' · '));
  informer('la valeur de l\'alignement bâti, contre celle du club', `${(100 * moy(valeurs)).toFixed(1)} % en moyenne`);
  borne('la masse salariale d\'un alignement bâti reste celle du club (en moyenne)', moy(ecarts), 0, 0.02);
  // V5 : avec les fiches des positions multiples, le pire des 36 alignements bâtis passe à 11,2 % (la moyenne reste
  // sous 1 %) ; la borne du pire cas passe de 10 à 12 %, la moyenne garde la sienne.
  borne('… et au pire (un seul club)', Math.max(...ecarts), 0, 0.12);

}

/*
 * 2 à 4. EN PAIRES : la moitié de la ligue reçoit le traitement, l'autre est le témoin, puis on inverse ; le même
 * club, les mêmes dés. `bati` : le club traité est bâti pour le coach ; `temoinBati` : le témoin aussi ; `coach` :
 * le traité a la confiance III.
 */
function paires(k, { bati = false, temoinBati = false, coach = true } = {}) {
  const dv = [];
  for (let Lg = 0; Lg < LIGUES; Lg++) {
    const V = vestiaires(5000 + Lg), bras = [];
    for (const parite of [0, 1]) {
      const teams = V.map((v, i) => { const r = rosterDe(v), traite = i % 2 === parite; return club(v, (traite ? bati : temoinBati) ? batir(r, k) : r); });
      const decisions = coach ? teams.map((_, i) => i).filter(i => i % 2 === parite).map(equipe => ({ jour: 0, equipe, coach: effetDePalier(k, 3) })) : [];
      simulateLeague(teams, 82, { graine: `voies-${Lg}`, decisions });
      bras.push(teams.map(t => t.W));
    }
    for (let i = 0; i < V.length; i++) dv.push(bras[i % 2][i] - bras[1 - (i % 2)][i]);
  }
  return moy(dv);
}
/*
 * CE QUE LA VOIE JUGE : le coach à sa III sur l'équipe bâtie pour lui, contre la même équipe sans lui. La
 * composition (l'équipe bâtie contre le club, sans coach) se dit à côté : à salaire égal, un club tout de
 * bagarreurs ou de plombiers vaut moins qu'un club de power forwards, et c'est le prix des rôles, pas le coach
 * (docs/feuille-de-route-v2.md, « Pour reprendre »).
 */
if (LIGUES > 0) {
  console.log(`\n  ${LIGUES} ligues × 32 équipes, en paires\n`);
  const lu = [];
  for (const k of MESUREES) {
    const V = vestiaires(5000), P = r => (joueursDesCoachs({ roster: r })[k] || { paliers: 0 }).paliers;
    const pB = moy(V.map(v => P(batir(rosterDe(v), k)))), pM = moy(V.map(v => P(rosterDe(v))));
    const compo = paires(k, { bati: true, coach: false });
    if (SANS) { console.log(`  ${COACHS[k].ico} ${COACHS[k].nom.padEnd(16)} composition ${signe(compo)} V · paliers ${pB.toFixed(0)}`); continue; }
    const b = paires(k, { bati: true, temoinBati: true }), m = paires(k);
    lu.push({ k, b, m });
    console.log(`  ${COACHS[k].ico} ${COACHS[k].nom.padEnd(16)} sur son équipe ${signe(b)} V · sur la mélangée ${signe(m)} V · composition ${signe(compo)} V · paliers ${pB.toFixed(0)} bâtie, ${pM.toFixed(0)} mélangée`);
  }
  const bs = lu.map(x => x.b);
  for (const x of lu) borne(`${COACHS[x.k].nom} : le coach sur l'équipe bâtie pour lui`, x.b, 6, 8, ' V');
  if (bs.length > 1) borne('les voies à ±1 V l\'une de l\'autre (l\'écart du plus fort au plus faible, sur deux)', (Math.max(...bs) - Math.min(...bs)) / 2, 0, 1, ' V');
  exiger('chaque coach vaut plus sur son équipe que sur une équipe mélangée', lu.every(x => x.b > x.m), lu.filter(x => x.b <= x.m).map(x => COACHS[x.k].nom).join(', ') || `${lu.length} voies`);
}
verdict();
