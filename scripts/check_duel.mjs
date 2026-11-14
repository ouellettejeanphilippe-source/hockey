/*
 * LE DUEL SANS PLAN (V29, tranche 1 bis ; JP, 14 nov. 2026 : *le plan part*). En Rogue, le gros match (le rival, l'élite,
 * chaque match de série) se joue en trois périodes ; avant chacune, l'adversaire annonce son intention (son plan, qui
 * vise tes joueurs). Plus aucun choix avant le match : ta réponse est le banc que tu as bâti. Ce juge :
 *   1. le duel a trois périodes, chacune son intention, et sa feuille ne garde aucun plan ; il ne laisse rien derrière
 *      lui (ni effet de match, ni canal de joueur) ; la même graine rejoue le même duel ;
 *   2. leur jeu, avant le match : sans dominante, l'intention que le moteur joue en 1re ; avec, la dominante ;
 *   3. LA DOMINANTE : un rival qui en a une l'annonce plus souvent que chacune des quatre autres ;
 *   4. LEUR JEU SE LIT : pour chacune des cinq intentions, ce qu'elle te coûte se dit en vraies stats du match
 *      (`leurJeuEnStats`, js/impact.js : la feuille du duel), et la lecture ne touche à aucun dé du match ;
 *   5. LA MESURE : deux copies d'un même vrai club, `N` duels semés par club témoin, à domicile et au loin : les cinq
 *      intentions sortent, et leur intention change la forme du match sans le donner (ta part de victoires contre ton
 *      double reste entre 40 et 55 %).
 * `N` : duels par club témoin (600 ; une demi-minute). Le plan d'avant-match (V27, tranche 6), ses robots
 * (scripts/lib/duel.mjs) et leur mesure sont partis : le meilleur plan ne gagnait plus que 0,3 % de matchs.
 */
import { autoRoster, registerHiddenRatings, createTeam, simulerGrosMatch } from '../js/sim.js';
import { leurJeuDuDuel, INTENTIONS, PERIODES_DU_DUEL } from '../js/greffes.js';
import { leurJeuEnStats, motsDeStats } from '../js/impact.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 600);
/* Le banc de l'essai : un coach du Frelon et sa pièce de départ. */
const BANC = { cle: 'essaim', maitrise: 1, banc: ['gros'] };
const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
/* Deux copies d'un même vrai club : toi (Rogue, ton banc) et l'IA. */
function deuxClubs(s, t) {
  const un = equipeReelle(s, t);
  const toi = equipe('Toi', t, un, s), adv = equipe('Eux', t, un, s);
  toi.isPlayer = true; toi.courbe = true; adv.courbe = true;
  toi.perso = structuredClone(BANC);
  return { toi, adv };
}
const soigner = (...clubs) => { for (const x of clubs) if (x.injured) x.injured.clear(); };
const empreinte = r => JSON.stringify([r.feuille.buts.map(b => [b.cote, b.instant.toFixed(3)]), r.feuille.tirs, r.gros.duelJoue.periodes.map(h => h.intention.cle)]);
const t0 = Date.now();
console.log(`\n  Le duel sans plan (V29, tranche 1 bis) · ${N} duels par club, ${TEMOINS.length} clubs\n`);

/* ---------- 1 à 4 : la forme du duel ---------- */
{
  const [lab, s, t] = TEMOINS[0];
  const { toi, adv } = deuxClubs(s, t);
  let trois = 0, sansPlan = 0, pareil = 0, propre = 0, rejoue = 0;
  const traces = () => [toi, adv].some(x => x._effetMatch || x._gros || Object.values(x.roster).some(p => p && p._duelFx));
  for (let i = 0; i < 40; i++) {
    soigner(toi, adv);
    const I = leurJeuDuDuel(toi, adv, { graine: `ap-${lab}`, cle: `a${i}` });
    const a = simulerGrosMatch(toi, adv, { graine: `ap-${lab}`, cle: `a${i}` });
    const P = a.gros.duelJoue.periodes;
    if (P.length === PERIODES_DU_DUEL.length && P.every(h => INTENTIONS[h.intention.cle])) trois++;
    if (P.every(h => !('plan' in h)) && !('choix' in a.gros)) sansPlan++;
    // 2. Sans dominante (un match de séries), leur jeu est l'intention que le moteur joue en 1re.
    if (P[0].intention.cle === I.cle && P[0].intention.cible === I.cible) pareil++;
    if (!traces()) propre++;
    soigner(toi, adv);
    if (empreinte(simulerGrosMatch(toi, adv, { graine: `ap-${lab}`, cle: `a${i}` })) === empreinte(a)) rejoue++;
  }
  exiger('chaque duel a trois périodes, chacune son intention', trois === 40, `${trois} sur 40`);
  exiger('aucun plan : ni dans la feuille du duel, ni dans le gros match', sansPlan === 40, `${sansPlan} sur 40`);
  exiger('sans dominante, leur jeu annoncé est l\'intention que le moteur joue en 1re', pareil === 40, `${pareil} sur 40`);
  exiger('un duel ne laisse rien derrière lui (ni effet de match, ni canal de joueur)', propre === 40, `${propre} sur 40`);
  exiger('la même graine rejoue le même duel', rejoue === 40, `${rejoue} sur 40`);
  // 2 et 3. La dominante : leur jeu annoncé, et l'intention qui sort le plus.
  const parts = [];
  let annonce = 0, devant = 0;
  for (const dom of Object.keys(INTENTIONS)) {
    if (leurJeuDuDuel(toi, adv, { graine: 'dom', cle: 'x', dominante: dom }).cle === dom) annonce++;
    const n = {};
    for (let i = 0; i < 60; i++) {
      soigner(toi, adv);
      const r = simulerGrosMatch(toi, adv, { graine: `dom-${dom}`, cle: `d${i}`, dominante: dom, visiteur: i % 2 === 1 });
      for (const h of r.gros.duelJoue.periodes) n[h.intention.cle] = (n[h.intention.cle] || 0) + 1;
    }
    const tot = Object.values(n).reduce((a, x) => a + x, 0);
    if (Object.keys(INTENTIONS).every(c => c === dom || (n[c] || 0) < (n[dom] || 0))) devant++;
    parts.push(`${INTENTIONS[dom].ico} ${Math.round((100 * (n[dom] || 0)) / tot)} %`);
  }
  exiger('avec une dominante, leur jeu annoncé est elle', annonce === 5, `${annonce} sur 5`);
  exiger('la dominante sort plus souvent que chacune des quatre autres', devant === 5, `${devant} sur 5 · sa part des périodes : ${parts.join(' · ')}`);
  // 4. Leur jeu se lit : chaque intention dit ce qu'elle te coûte, en vraies stats, sans toucher aux dés du match.
  soigner(toi, adv);
  const avant = empreinte(simulerGrosMatch(toi, adv, { graine: 'lu', cle: 'x' }));
  const lus = Object.keys(INTENTIONS).map(dom => [dom, motsDeStats(leurJeuEnStats(toi, adv, leurJeuDuDuel(toi, adv, { graine: 'lu', cle: 'x', dominante: dom })), 3)]);
  soigner(toi, adv);
  exiger('chacune des cinq intentions dit ce qu\'elle te coûte, en vraies stats du match', lus.every(([, m]) => m.length > 0 && m.some(x => x.bon === false)),
    lus.map(([dom, m]) => `${INTENTIONS[dom].ico} ${m.map(x => x.txt).join(', ') || 'rien'}`).join(' · '));
  exiger('lire leur jeu ne touche à aucun dé : le même duel avant et après', empreinte(simulerGrosMatch(toi, adv, { graine: 'lu', cle: 'x' })) === avant && leurJeuEnStats(toi, adv, null) === null);
}

/* ---------- 5 : la mesure ---------- */
{
  let v = 0, n = 0, periodes = 0;
  const intentions = {};
  for (const [lab, s, t] of TEMOINS) {
    const { toi, adv } = deuxClubs(s, t);
    for (let i = 0; i < N; i++) {
      const r = simulerGrosMatch(toi, adv, { graine: `duel-${lab}`, cle: `m${i}`, visiteur: i % 2 === 1 });
      n++; if (r.gagne) v++;
      for (const h of r.gros.duelJoue.periodes) { periodes++; intentions[h.intention.cle] = (intentions[h.intention.cle] || 0) + 1; }
    }
  }
  const pc = x => `${(100 * x).toFixed(1).replace('.', ',')} %`;
  exiger('les cinq intentions sortent', Object.keys(INTENTIONS).every(k => (intentions[k] || 0) >= 0.03 * periodes),
    Object.keys(INTENTIONS).map(k => `${INTENTIONS[k].ico} ${pc((intentions[k] || 0) / periodes)}`).join(' · '));
  borne('deux clubs égaux en duel : leur intention change la forme sans donner le match (ta part de victoires)', Math.round((1000 * v) / n) / 1000, 0.4, 0.55);
}
informer('le temps', `${Math.round((Date.now() - t0) / 1000)} s`);
verdict();
