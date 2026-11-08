/*
 * LE DUEL À UN CHOIX (V27, tranche 6 ; docs/refonte-v27.md § 4.7, docs/refonte-v27-6a.md). En Rogue, le gros match se
 * joue en trois périodes ; avant chacune, l'adversaire annonce son intention (son plan, qui vise tes joueurs). Ta
 * réponse est UN choix avant le match : un plan fort parmi deux ou trois que ton banc propose (`plansDuDuel`,
 * js/impact.js), chiffrés contre leur jeu (`leurJeuDuDuel`, js/greffes.js), ou Ton match. Ce juge :
 *   1. le duel a trois périodes, chacune son intention ; le plan pris avant le match joue les trois, Ton match aucune ;
 *   2. leur jeu, avant le match : sans dominante, l'intention que le moteur joue en 1re ; avec, la dominante ;
 *   3. LA DOMINANTE : un rival qui en a une l'annonce plus souvent que chacune des quatre autres ;
 *   4. le banc propose deux ou trois plans distincts, chacun en vraies stats du match, tirés de ses pièces ou du coach ;
 *   5. AUCUN TRIO DOMINÉ : chaque trio de plans que le banc peut proposer (dix, sur les cinq plans de la banque de pièces),
 *      deux clubs égaux, n'a aucun plan meilleur ou égal aux deux autres contre chacune des cinq intentions et meilleur
 *      contre une — un vrai choix, qui dépend de leur jeu ;
 *   6. LA MESURE : deux clubs égaux — deux copies du même vrai club, ton banc posé —, le même duel au meilleur plan
 *      (l'attentif, ce que l'écran propose) contre « Ton match » tout le long, sur les mêmes dés (SEMÉS : la graine de
 *      chaque match), à domicile et au loin. Mis en face à face (l'écart de leurs logits contre la même IA), le meilleur
 *      plan gagne nettement, mais sous 60 % : un plan change la forme, pas la force.
 * `N` : matchs par club et par bras (1200). `FILS` : processus (2). `TRIOS=0` saute le 5 (le CI le garde).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulerGrosMatch } from '../js/sim.js';
import { leurJeuDuDuel, INTENTIONS, PERIODES_DU_DUEL, PLANS } from '../js/greffes.js';
import { plansDuDuel } from '../js/impact.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { robotDuel } from './lib/duel.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 1200);
const FILS = Math.max(1, Number(process.env.FILS ?? 2));
const TRIOS = process.env.TRIOS !== '0';
const ICI = fileURLToPath(import.meta.url);

/* Le banc de l'essai : un coach du Frelon et quatre pièces qui ont un plan (tirer, fermer, forechecker, discipliné). */
const BANC = { cle: 'essaim', maitrise: 1, banc: ['ruee', 'canonnier', 'mur', 'cogneur', 'moine'] };
/* La pièce de chaque plan (js/impact.js `PLAN_DE_LA_PIECE`) : un banc fait d'elles seules propose ces plans-là. */
const PIECE_DU_PLAN = { tirer: 'canonnier', centre: 'mur', assaut: 'cogneur', discipline: 'moine', ombre: 'vedettiste' };
const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
/* Deux copies d'un même vrai club : toi (Rogue, ton banc) et l'IA. */
function deuxClubs(s, t, perso = BANC) {
  const un = equipeReelle(s, t);
  const toi = equipe('Toi', t, un, s), adv = equipe('Eux', t, un, s);
  toi.isPlayer = true; toi.courbe = true; adv.courbe = true;
  toi.perso = structuredClone(perso);
  return { toi, adv };
}

/* UN BRAS DE LA MESURE (un processus fils) : `n` duels par club témoin, sous une politique. */
function bras(politique, n) {
  const out = { v: 0, n: 0, periodes: 0, changes: 0, intentions: {} };
  for (const [lab, s, t] of TEMOINS) {
    const { toi, adv } = deuxClubs(s, t);
    toi.robotDuel = robotDuel(politique);
    for (let i = 0; i < n; i++) {
      const r = simulerGrosMatch(toi, adv, { graine: `duel-${lab}`, cle: `m${i}`, visiteur: i % 2 === 1 });
      out.n++; if (r.gagne) out.v++;
      for (const h of r.gros.duelJoue.periodes) {
        out.periodes++; if (h.plan !== 'match') out.changes++;
        out.intentions[h.intention.cle] = (out.intentions[h.intention.cle] || 0) + 1;
      }
    }
  }
  return out;
}
if (process.env.BRAS) {
  process.stdout.write(JSON.stringify(bras(process.env.BRAS, Number(process.env.NBRAS))));
  process.exit(0);
}
const lancer = (politique, n) => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, BRAS: politique, NBRAS: String(n) } });
  let txt = '';
  p.stdout.on('data', x => { txt += x; });
  p.stderr.on('data', x => process.stderr.write(x));
  p.on('close', c => (c === 0 ? ok(JSON.parse(txt)) : ko(new Error(`le bras ${politique} a échoué (${c})`))));
});
async function enParallele(taches) {
  const res = new Array(taches.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, async () => { while (i < taches.length) { const k = i++; res[k] = await taches[k](); } }));
  return res;
}

const t0 = Date.now();
console.log(`\n  Le duel à un choix (V27, tranche 6) · ${N} matchs par club et par bras, ${TEMOINS.length} clubs\n`);

/* ---------- 1 à 4 : la forme du duel ---------- */
{
  const [lab, s, t] = TEMOINS[0];
  const { toi, adv } = deuxClubs(s, t);
  // 1. Trois périodes ; le plan d'avant le match les joue toutes ; Ton match n'en joue aucun.
  let trois = 0, joue = 0, rien = 0, pareil = 0;
  for (let i = 0; i < 40; i++) {
    for (const x of [toi, adv]) if (x.injured) x.injured.clear();
    const I = leurJeuDuDuel(toi, adv, { graine: `ap-${lab}`, cle: `a${i}` });
    const b = simulerGrosMatch(toi, adv, { graine: `ap-${lab}`, cle: `a${i}`, plan: null });
    const a = simulerGrosMatch(toi, adv, { graine: `ap-${lab}`, cle: `a${i}`, plan: { cle: 'centre' } });
    const P = a.gros.duelJoue.periodes;
    if (P.length === PERIODES_DU_DUEL.length && P.every(h => INTENTIONS[h.intention.cle])) trois++;
    if (P.every(h => h.plan === 'centre')) joue++;
    if (b.gros.duelJoue.periodes.every(h => h.plan === 'match')) rien++;
    // 2. Sans dominante (un match de séries), leur jeu est l'intention que le moteur joue en 1re.
    if (b.gros.duelJoue.periodes[0].intention.cle === I.cle && b.gros.duelJoue.periodes[0].intention.cible === I.cible) pareil++;
  }
  exiger('chaque duel a trois périodes, chacune son intention', trois === 40, `${trois} sur 40`);
  exiger('le plan pris avant le match joue les trois périodes', joue === 40, `${joue} sur 40`);
  exiger('Ton match ne pose aucun plan', rien === 40, `${rien} sur 40`);
  exiger('sans dominante, leur jeu annoncé est l\'intention que le moteur joue en 1re', pareil === 40, `${pareil} sur 40`);
  // 2 et 3. La dominante : leur jeu annoncé, et l'intention qui sort le plus.
  const parts = [];
  let annonce = 0, devant = 0;
  for (const dom of Object.keys(INTENTIONS)) {
    if (leurJeuDuDuel(toi, adv, { graine: 'dom', cle: 'x', dominante: dom }).cle === dom) annonce++;
    const n = {};
    for (let i = 0; i < 60; i++) {
      for (const x of [toi, adv]) if (x.injured) x.injured.clear();
      const r = simulerGrosMatch(toi, adv, { graine: `dom-${dom}`, cle: `d${i}`, plan: null, dominante: dom, visiteur: i % 2 === 1 });
      for (const h of r.gros.duelJoue.periodes) n[h.intention.cle] = (n[h.intention.cle] || 0) + 1;
    }
    const tot = Object.values(n).reduce((a, x) => a + x, 0);
    if (Object.keys(INTENTIONS).every(c => c === dom || (n[c] || 0) < (n[dom] || 0))) devant++;
    parts.push(`${INTENTIONS[dom].ico} ${Math.round((100 * (n[dom] || 0)) / tot)} %`);
  }
  exiger('avec une dominante, leur jeu annoncé est elle', annonce === 5, `${annonce} sur 5`);
  exiger('la dominante sort plus souvent que chacune des quatre autres', devant === 5, `${devant} sur 5 · sa part des périodes : ${parts.join(' · ')}`);
  // 4. Le banc propose deux ou trois plans distincts, en stats du match, de ses pièces ou du coach.
  let bonnes = 0;
  const cles = Object.keys(INTENTIONS);
  for (let i = 0; i < 10; i++) {
    const I = leurJeuDuDuel(toi, adv, { graine: 'pr', cle: `p${i}`, dominante: cles[i % 5] });
    const pr = plansDuDuel(toi, adv, { intention: I });
    if (pr.length >= 2 && pr.length <= 3 && new Set(pr.map(x => x.cle)).size === pr.length && pr.every(x => PLANS[x.cle] && x.cle !== 'match' && x.stats && x.qui && x.plan)) bonnes++;
  }
  const seul = deuxClubs(s, t, { cle: 'essaim', maitrise: 1, banc: ['ruee'] });
  const deSeul = plansDuDuel(seul.toi, seul.adv, { intention: leurJeuDuDuel(seul.toi, seul.adv, { dominante: 'assaut' }) });
  exiger('le banc propose deux ou trois plans distincts, chacun en vraies stats du match', bonnes === 10, `${bonnes} sur 10`);
  exiger('un banc sans pièce à plan : le coach propose le sien et complète par ce qui répond à leur jeu', deSeul.length === 2 && deSeul[0].cle === 'tirer' && deSeul.every(x => x.qui.genre === 'coach'),
    deSeul.map(x => `${PLANS[x.cle].ico} ${PLANS[x.cle].nom}`).join(' · '));
}

/* ---------- 5 : aucun trio dominé ---------- */
if (TRIOS) {
  const [, s, t] = TEMOINS[0];
  const cles = Object.keys(PIECE_DU_PLAN), intentions = Object.keys(INTENTIONS);
  const trios = [];
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) trios.push([cles[a], cles[b], cles[c]]);
  const domines = [];
  for (const trio of trios) {
    const { toi, adv } = deuxClubs(s, t, { cle: 'aucun', banc: trio.map(k => PIECE_DU_PLAN[k]) });
    const net = {};
    for (const I of intentions) for (const x of plansDuDuel(toi, adv, { intention: leurJeuDuDuel(toi, adv, { dominante: I }), n: 1500 })) (net[x.cle] = net[x.cle] || {})[I] = x.net;
    const domine = trio.find(p => trio.every(q => q === p || (intentions.every(I => net[p][I] >= net[q][I]) && intentions.some(I => net[p][I] > net[q][I]))));
    if (domine) domines.push(`${trio.map(k => PLANS[k].ico).join('')} : ${PLANS[domine].nom}`);
  }
  exiger('aucun trio de plans n\'a un plan qui domine les deux autres sur les cinq intentions', !domines.length, domines.length ? domines.join(' · ') : `${trios.length} trios, chacun un vrai choix`);
}

/* ---------- 6 : la mesure ---------- */
const [bien, mal, distrait] = await enParallele([
  () => lancer('attentif', N), () => lancer('rien', N), () => lancer('distrait', Math.ceil(N / 4)),
]);
const p = x => x.v / x.n, pc = x => `${(100 * x).toFixed(1).replace('.', ',')} %`;
const logit = x => Math.log(x / (1 - x));
const faceAFace = 1 / (1 + Math.exp(-(logit(p(bien)) - logit(p(mal)))));
exiger('les cinq intentions sortent', Object.keys(INTENTIONS).every(k => (bien.intentions[k] || 0) >= 0.03 * bien.periodes),
  Object.keys(INTENTIONS).map(k => `${INTENTIONS[k].ico} ${pc((bien.intentions[k] || 0) / bien.periodes)}`).join(' · '));
informer('l\'attentif prend un plan', `${pc(bien.changes / bien.periodes)} des périodes`);
informer('contre la même IA', `meilleur plan ${pc(p(bien))} · le distrait ${pc(p(distrait))} · Ton match ${pc(p(mal))}`);
// L'écart d'un bras à l'autre, en erreurs types (les deux bras jouent les mêmes dés : c'est une borne prudente).
const et = Math.sqrt(p(bien) * (1 - p(bien)) / bien.n + p(mal) * (1 - p(mal)) / mal.n);
exiger('le meilleur plan gagne plus que Ton match', p(bien) - p(mal) >= 2 * et, `${pc(p(bien) - p(mal))} (${((p(bien) - p(mal)) / et).toFixed(1).replace('.', ',')} erreurs types)`);
borne('deux clubs égaux, le meilleur plan contre Ton match, en face à face', Math.round(faceAFace * 1000) / 1000, 0.5, 0.6);
informer('le temps', `${Math.round((Date.now() - t0) / 1000)} s (${FILS} fils)`);
verdict();
