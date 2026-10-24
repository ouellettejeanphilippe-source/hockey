/*
 * LE DUEL EN TROIS PÉRIODES (V9, tranche 5 — docs/refonte-v9.md § 6.3 ; V17, docs/refonte-v17.md). En Rogue, le gros
 * match se joue en trois périodes ; avant chacune, l'adversaire annonce son intention (son plan, qui vise tes joueurs),
 * et ton adjoint te propose deux ou trois plans (`propositionsDuDuel`, js/impact.js) : tu en prends un, ou tu gardes
 * le tien. Ce juge :
 *   1. le duel a trois périodes, chacune son intention, et les cinq intentions sortent ;
 *   2. les périodes vues ne bougent pas : la décision de la 2e garde la 1re à l'identique, celle de la 3e les deux
 *      premières (les buts, leurs instants, les tirs) ;
 *   3. l'intention que l'écran annonce avant le match (`apercuDuDuel`) est celle que le moteur joue, et le plan pris
 *      pour une période est celui qu'elle joue (`duelJoue`) ;
 *   4. l'adjoint propose deux ou trois plans, jamais celui en force ;
 *   5. LA MESURE : deux clubs égaux — deux copies du même vrai club —, le même duel bien joué (l'attentif prend, à
 *      chaque période, la proposition qui rend le plus) et « Garder » tout le long, sur les mêmes dés (SEMÉS : la
 *      graine de chaque match et celle du robot), à domicile et au loin. Mis en face à face (l'écart de leurs logits
 *      contre la même IA), le bien joué gagne nettement, mais sous 60 % : un plan change la forme, pas la force.
 * `N` : matchs par club et par bras (1200). `FILS` : processus (2).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulerGrosMatch, apercuDuDuel, INTENTIONS, PERIODES_DU_DUEL, PLANS } from '../js/sim.js';
import { propositionsDuDuel } from '../js/impact.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { robotDuel } from './lib/duel.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 1200);
const FILS = Math.max(1, Number(process.env.FILS ?? 2));
const ICI = fileURLToPath(import.meta.url);

const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
/* Deux copies d'un même vrai club : toi (Rogue) et l'IA. */
function deuxClubs(s, t) {
  const un = equipeReelle(s, t);
  const toi = equipe('Toi', t, un, s), adv = equipe('Eux', t, un, s);
  toi.isPlayer = true; toi.courbe = true; adv.courbe = true;
  return { toi, adv };
}
const generateur = graine => { let x = graine >>> 0 || 7; return () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; };

/* UN BRAS DE LA MESURE (un processus fils) : `n` duels par club témoin, sous une politique. */
function bras(politique, n) {
  const out = { v: 0, n: 0, periodes: 0, changes: 0, intentions: {} };
  for (const [lab, s, t] of TEMOINS) {
    const { toi, adv } = deuxClubs(s, t);
    toi.robotDuel = robotDuel(politique, generateur(lab.length * 97 + 13));
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
console.log(`\n  Le duel en trois périodes (V9 ; V17, l'adjoint) · ${N} matchs par club et par bras, ${TEMOINS.length} clubs\n`);

/* ---------- 1 à 4 : la forme du duel ---------- */
{
  const [lab, s, t] = TEMOINS[0];
  const { toi, adv } = deuxClubs(s, t);
  // 2. Les périodes vues ne bougent pas.
  const d0 = { plan: { cle: 'centre' } };
  const d1 = { plan: { cle: 'tirer' }, graine: 'x:p1' }, d2 = { snap: true, graine: 'x:p2' };
  const empreinte = (f, fin) => JSON.stringify(f.buts.filter(b => b.instant < fin).map(b => [b.cote, b.instant.toFixed(3), b.marqueur ? b.marqueur.n : '']));
  const tirs = (f, k) => [f.tirs.A.slice(1, k + 1), f.tirs.B.slice(1, k + 1)].join('|');
  let p1 = 0, p12 = 0, change = 0, essais = 0, joue = 0;
  for (let i = 0; i < 40; i++) {
    const a = simulerGrosMatch(toi, adv, { graine: `forme-${lab}`, cle: `g${i}`, periodes: [d0] });
    const b = simulerGrosMatch(toi, adv, { graine: `forme-${lab}`, cle: `g${i}`, periodes: [d0, d1] });
    const c = simulerGrosMatch(toi, adv, { graine: `forme-${lab}`, cle: `g${i}`, periodes: [d0, d1, d2] });
    essais++;
    if (empreinte(a.feuille, 20) === empreinte(b.feuille, 20) && tirs(a.feuille, 1) === tirs(b.feuille, 1)) p1++;
    if (empreinte(b.feuille, 40) === empreinte(c.feuille, 40) && tirs(b.feuille, 2) === tirs(c.feuille, 2)) p12++;
    if (empreinte(a.feuille, 60) !== empreinte(b.feuille, 60)) change++;
    // Le plan pris est celui que la période joue ; une période sans décision garde celui d'avant.
    const P = c.gros.duelJoue.periodes.map(h => h.plan);
    if (P[0] === 'centre' && P[1] === 'tirer' && P[2] === 'tirer') joue++;
  }
  exiger('le plan pris pour une période est celui qu\'elle joue, et la suivante le garde', joue === essais, `${joue} sur ${essais}`);
  exiger('la décision de la 2e période garde la 1re à l\'identique', p1 === essais, `${p1} sur ${essais}`);
  exiger('la décision de la 3e garde les deux premières à l\'identique', p12 === essais, `${p12} sur ${essais}`);
  exiger('la décision de la 2e période rejoue bien la suite sur des dés neufs', change >= essais / 3, `${change} matchs sur ${essais} changent après 20:00`);
  // 1 et 3. Trois périodes, chacune son intention, et celle d'avant le match est celle que le moteur joue.
  let trois = 0, pareil = 0;
  for (let i = 0; i < 40; i++) {
    for (const x of [toi, adv]) if (x.injured) x.injured.clear();
    const ap = apercuDuDuel(toi, adv, { graine: `ap-${lab}`, cle: `a${i}` });
    const r = simulerGrosMatch(toi, adv, { graine: `ap-${lab}`, cle: `a${i}` });
    const P = r.gros.duelJoue.periodes;
    if (P.length === PERIODES_DU_DUEL.length && P.every(h => INTENTIONS[h.intention.cle])) trois++;
    if (P[0].intention.cle === ap.intention.cle && P[0].intention.cible === ap.intention.cible) pareil++;
  }
  exiger('chaque duel a trois périodes, chacune son intention', trois === 40, `${trois} sur 40`);
  exiger('l\'intention annoncée avant le match est celle que le moteur joue', pareil === 40, `${pareil} sur 40`);
  // 4. L'adjoint : deux ou trois plans, jamais celui en force.
  let bonnes = 0;
  const cles = Object.keys(INTENTIONS);
  for (let i = 0; i < 20; i++) {
    const ap = apercuDuDuel(toi, adv, { graine: `pr-${lab}`, cle: `p${i}` });
    const I = { ...ap.intention, cle: cles[i % cles.length] };
    const enForce = Object.keys(PLANS)[i % 6];
    const pr = propositionsDuDuel(toi, adv, { intention: I, plan: enForce === 'match' ? null : { cle: enForce }, k: i % 3, pointage: { moi: i % 3, lui: 1 } });
    if (pr.length >= 2 && pr.length <= 3 && pr.every(x => PLANS[x.cle] && x.cle !== enForce && x.stats)) bonnes++;
  }
  exiger('l\'adjoint propose deux ou trois plans, jamais celui en force, chacun en vraies stats', bonnes === 20, `${bonnes} sur 20`);
}

/* ---------- 5 : la mesure ---------- */
const [bien, mal, distrait] = await enParallele([
  () => lancer('attentif', N), () => lancer('rien', N), () => lancer('distrait', Math.ceil(N / 4)),
]);
const p = x => x.v / x.n, pc = x => `${(100 * x).toFixed(1).replace('.', ',')} %`;
const logit = x => Math.log(x / (1 - x));
const faceAFace = 1 / (1 + Math.exp(-(logit(p(bien)) - logit(p(mal)))));
exiger('les cinq intentions sortent', Object.keys(INTENTIONS).every(k => (bien.intentions[k] || 0) >= 0.03 * bien.periodes),
  Object.keys(INTENTIONS).map(k => `${INTENTIONS[k].ico} ${pc((bien.intentions[k] || 0) / bien.periodes)}`).join(' · '));
informer('l\'attentif change de plan', `${pc(bien.changes / bien.periodes)} des périodes`);
informer('contre la même IA', `bien joué ${pc(p(bien))} · le distrait ${pc(p(distrait))} · en gardant ${pc(p(mal))}`);
// L'écart d'un bras à l'autre, en erreurs types (les deux bras jouent les mêmes dés : c'est une borne prudente).
const et = Math.sqrt(p(bien) * (1 - p(bien)) / bien.n + p(mal) * (1 - p(mal)) / mal.n);
exiger('le duel bien joué gagne plus que celui qu\'on laisse filer', p(bien) - p(mal) >= 2 * et, `${pc(p(bien) - p(mal))} (${((p(bien) - p(mal)) / et).toFixed(1).replace('.', ',')} erreurs types)`);
borne('deux clubs égaux, le duel bien joué contre « Garder », en face à face', Math.round(faceAFace * 1000) / 1000, 0.5, 0.6);
informer('le temps', `${Math.round((Date.now() - t0) / 1000)} s (${FILS} fils)`);
verdict();
