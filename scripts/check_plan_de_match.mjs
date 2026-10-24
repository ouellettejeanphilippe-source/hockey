/*
 * LE PLAN DE MATCH (V17 — docs/refonte-v17.md). Ton club (un vrai club moyen) contre six vrais adversaires de
 * profils différents, chaque plan contre « Ton match », EN PAIRES : les mêmes dés, à domicile et au loin. Ce juge :
 *   1. Ton match ne change rien : la feuille est celle d'un match sans plan, et un plan ne laisse rien derrière lui
 *      (ni effet de match, ni canal de joueur) une fois le match joué ;
 *   2. LA BORNE d'une commune : joué tous les soirs, un plan vaut au plus ±1 V sur une saison, en moyenne des
 *      adversaires ;
 *   3. IL SE VOIT dans la feuille : au moins ±2 tirs (les tiens ou les leurs), ±0,5 punition, ou ±0,3 point à la ligne
 *      de la vedette collée ;
 *   4. AUCUN NE DOMINE : chaque plan est le meilleur (au bruit près) contre au moins un adversaire, et aucun n'est le
 *      meilleur contre tous.
 * `N` : matchs par adversaire et par plan (4000). `FILS` : processus (3).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, SLOTS, PLANS, getPlayerKey } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 4000);
const FILS = Math.max(1, Number(process.env.FILS ?? 3));
const ICI = fileURLToPath(import.meta.url);
const TOI = ['NYI 92-93', '1992-93', 'NYI'];
const ADVERSAIRES = [
  ['MTL 76-77 (le club complet)', '1976-77', 'MTL'], ['BOS 70-71 (l\'attaque d\'Esposito)', '1970-71', 'BOS'],
  ['PHI 74-75 (les robustes)', '1974-75', 'PHI'], ['NJD 94-95 (la trappe)', '1994-95', 'NJD'],
  ['EDM 83-84 (Gretzky)', '1983-84', 'EDM'], ['DET 76-77 (le faible)', '1976-77', 'DET'],
];
const CLES = Object.keys(PLANS);
const SAISON = 82;

const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
const somme = a => (a || []).reduce((x, y) => x + y, 0);
function remettre(t) {
  for (const sl of SLOTS) { const p = t.roster[sl.i]; if (p) p.energie = 100; }
  if (t.injured) t.injured.clear();
  t.jourCourant = 0;
}
/* Un match, ton plan posé ; ce que la feuille en dit, de ton côté. */
function match(toi, adv, graine, visiteur, cle) {
  remettre(toi); remettre(adv);
  toi.plan = cle === 'match' ? null : { cle };
  grainerHasard(graine);
  const f = feuilleVierge();
  const r = visiteur ? playGame(adv, toi, 1, false, false, f) : playGame(toi, adv, 1, false, false, f);
  toi.plan = null;
  const moi = visiteur ? 'B' : 'A', eux = visiteur ? 'A' : 'B';
  const pts = p => f.buts.filter(b => b.marqueur === p || (b.passeurs || []).includes(p)).length;
  return { f, v: r.winner === toi ? 1 : 0, gd: (visiteur ? r.gfB - r.gfA : r.gfA - r.gfB), tp: somme(f.tirs[moi]), tc: somme(f.tirs[eux]),
    pun: f.punitions.filter(x => x.cote === moi).length, pts };
}
/* La vedette qu'un plan 🥷 colle : leur meilleur marqueur habillé, comme le moteur la désigne. */
const vedetteDe = adv => Object.values(adv.roster).filter(p => p && p.p !== 'G').sort((a, b) => (b.gp ? b.pt / b.gp : 0) - (a.gp ? a.pt / a.gp : 0))[0];

/* UN ADVERSAIRE (un processus fils) : chaque plan, `n` matchs en paires. */
function mesurer(i, n) {
  const [lab, s, t] = ADVERSAIRES[i];
  // Créer un club tire du hasard : semé d'abord, la mesure se rejoue d'un processus à l'autre.
  grainerHasard(`clubs:${lab}`);
  const toi = equipe('Toi', TOI[2], equipeReelle(TOI[1], TOI[2]), TOI[1]), adv = equipe(lab, t, equipeReelle(s, t), s);
  toi.isPlayer = true;
  const vedette = vedetteDe(adv);
  const out = {};
  for (const cle of CLES) {
    const m = { v: 0, gd: 0, tp: 0, tc: 0, pun: 0, ved: 0, gd2: 0, n: 0 };
    for (let k = 0; k < n; k++) {
      const x = match(toi, adv, `plan:${lab}:${k}`, k % 2 === 1, cle);
      m.v += x.v; m.gd += x.gd; m.gd2 += x.gd * x.gd; m.tp += x.tp; m.tc += x.tc; m.pun += x.pun; m.ved += vedette ? x.pts(vedette) : 0; m.n++;
    }
    out[cle] = m;
  }
  return { lab, vedette: vedette ? vedette.n : '', out };
}
if (process.env.ADV) {
  process.stdout.write(JSON.stringify(mesurer(Number(process.env.ADV), Number(process.env.NADV))));
  process.exit(0);
}
const lancer = i => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, ADV: String(i), NADV: String(N) } });
  let o = '', e = '';
  p.stdout.on('data', d => { o += d; }); p.stderr.on('data', d => { e += d; });
  p.on('close', c => (c ? ko(new Error(e)) : ok(JSON.parse(o))));
});

/* ---------- 1 : Ton match ne change rien, et un plan ne laisse rien derrière lui ---------- */
{
  grainerHasard('clubs:neutre');
  const toi = equipe('Toi', TOI[2], equipeReelle(TOI[1], TOI[2]), TOI[1]), adv = equipe('Eux', 'MTL', equipeReelle('1976-77', 'MTL'), '1976-77');
  toi.isPlayer = true;
  const sig = f => JSON.stringify({ b: f.buts.map(b => [b.cote, b.instant, getPlayerKey(b.marqueur)]), t: f.tirs, p: f.punitions.map(x => [x.cote, x.instant]) });
  const sans = sig(match(toi, adv, 'neutre', false, 'match').f);
  delete toi.plan;
  remettre(toi); remettre(adv); grainerHasard('neutre');
  const f0 = feuilleVierge(); playGame(toi, adv, 1, false, false, f0);
  exiger('Ton match : la feuille d\'un match sans plan', sig(f0) === sans);
  const photo = t => JSON.stringify([('_effetMatch' in t) ? t._effetMatch : '∅', Object.values(t.roster).filter(Boolean).map(p => p._duelFx || null)]);
  const avant = [photo(toi), photo(adv)];
  for (const cle of CLES) match(toi, adv, `trace:${cle}`, false, cle);
  exiger('un plan ne laisse rien derrière lui : ni effet de match, ni canal de joueur', photo(toi) === avant[0] && photo(adv) === avant[1]);
  const apres = sig(match(toi, adv, 'neutre', false, 'match').f);
  exiger('le match d\'après, sans plan, rejoue au caractère près', apres === sans);
}

/* ---------- 2 à 4 : la mesure ---------- */
const res = [];
for (let i = 0; i < ADVERSAIRES.length; i += FILS) res.push(...await Promise.all(ADVERSAIRES.slice(i, i + FILS).map((_, j) => lancer(i + j))));
const v = x => x.toFixed(2).replace('.', ',');
const delta = (r, cle, k) => (r.out[cle][k] - r.out.match[k]) / r.out[cle].n;
const seGD = (r, cle) => { const m = r.out[cle]; const moy = m.gd / m.n; return Math.sqrt(Math.max(0, m.gd2 / m.n - moy * moy) / m.n); };
for (const r of res) {
  informer(r.lab, CLES.filter(c => c !== 'match').map(c => `${PLANS[c].ico} ${v(delta(r, c, 'v') * SAISON)} V · ${v(delta(r, c, 'gd'))} but · tirs ${v(delta(r, c, 'tp'))}/${v(delta(r, c, 'tc'))} · pun ${v(delta(r, c, 'pun'))}${c === 'ombre' ? ` · ${r.vedette} ${v(delta(r, c, 'ved'))} pt` : ''}`).join('  |  '));
}
for (const cle of CLES.filter(c => c !== 'match')) {
  const P = PLANS[cle];
  const net = res.reduce((a, r) => a + delta(r, cle, 'v'), 0) / res.length * SAISON;
  exiger(`${P.ico} ${P.nom} : sous la borne d'une commune (±1 V sur une saison)`, Math.abs(net) <= 1, `${v(net)} V en moyenne des adversaires`);
  const tp = res.reduce((a, r) => a + Math.abs(delta(r, cle, 'tp')), 0) / res.length, tc = res.reduce((a, r) => a + Math.abs(delta(r, cle, 'tc')), 0) / res.length;
  const pun = res.reduce((a, r) => a + Math.abs(delta(r, cle, 'pun')), 0) / res.length, ved = res.reduce((a, r) => a + Math.abs(delta(r, cle, 'ved')), 0) / res.length;
  exiger(`${P.ico} ${P.nom} : il se voit dans la feuille`, tp >= 2 || tc >= 2 || pun >= 0.5 || ved >= 0.3,
    `tirs ±${v(tp)} pour, ±${v(tc)} contre · punitions ±${v(pun)} · la vedette ±${v(ved)} pt`);
}
// Le meilleur plan contre chacun, au bruit près (un écart type du but net).
const plans = CLES.filter(c => c !== 'match');
const meilleurs = res.map(r => {
  const d = plans.map(c => [c, delta(r, c, 'gd')]);
  const max = Math.max(...d.map(x => x[1]));
  const se = Math.max(...plans.map(c => seGD(r, c))) * Math.SQRT2;
  return { lab: r.lab, tete: d.filter(x => x[1] >= max - se).map(x => x[0]), seul: d.filter(x => x[1] === max).map(x => x[0])[0], se };
});
informer('le meilleur, adversaire par adversaire', meilleurs.map(m => `${m.lab} : ${m.tete.map(c => PLANS[c].ico).join('')}`).join(' · '));
for (const cle of plans) exiger(`${PLANS[cle].ico} ${PLANS[cle].nom} : le meilleur contre au moins un adversaire`, meilleurs.some(m => m.tete.includes(cle)));
const partout = plans.filter(c => meilleurs.every(m => m.tete.length === 1 && m.tete[0] === c));
exiger('aucun plan n\'est le meilleur contre tous', partout.length === 0, partout.map(c => PLANS[c].nom).join(', ') || `${meilleurs.length} adversaires`);
verdict('Le plan de match');
