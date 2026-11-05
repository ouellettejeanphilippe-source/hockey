/*
 * LE RELAIS DES ADJOINTS (V23 D, docs/refonte-v23.md § D ; js/adjoints.js `relaisDeLaPeriode`). JP, 2 nov. 2026 :
 * *l'adjoint peut être ce que tu veux*. Chaque adjoint a un signal, lu période par période comme un pouvoir, et relaie
 * sur un de ses canaux la période où il se lit ; la chaîne s'arrête à deux maillons. Ce qu'on exige :
 *   1. les tables : chaque adjoint a un signal (une ligne sans chiffre, une condition, sa part de périodes) et un relais
 *      sur un de SES canaux ; la reprise monte avec le niveau (`RELAIS_NIV`) ; un seul second maillon (`chaine`) ;
 *   2. pur : les relais d'une période se lisent sans dé, à deux maillons jamais trois, et `sansRelais` (la mesure) les tait ;
 *   3. EN PAIRES, match par match (CLAUDE.md), chaque adjoint au Pilier en poste chez le coach de sa voie, N matchs par
 *      club : a. il relaie exactement les périodes que son signal lit dans la feuille (les pouvoirs notés, le pointage,
 *      les tirs, le soir) ; b. (MESURE) le soir où il relaie, la feuille change contre la même soirée sans relais
 *      (±2 tirs, ±0,3 but, ±0,5 punition, ±4 mises en échec, ±3 blessures par saison) ;
 *   4. (MESURE) la paire coach-adjoint rend 1,2 à 1,6 fois la somme de ses pièces (le pouvoir I seul, l'adjoint seul),
 *      en moyenne sur les huit voies, et aucune paire ne rend moins que ses pièces ; le second maillon (🦓) ajoute ;
 *   5. la saison : la feuille garde chaque relais, le banc l'allume avec ses périodes (js/profil-style.js `banc`), à
 *      l'entracte les périodes jouées seulement, et la même graine rejoue les mêmes relais.
 * `N` : matchs par club et par adjoint (400, deux minutes sur quatre processus, `FILS`). `MESURE=0 N=20` (la CI, dix
 * secondes) : 1, 2, 3a et 5, sans les chiffres de valeur.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, simulateLeague } from '../js/sim.js';
import { POUVOIRS, SEUILS_NIVEAU } from '../js/pouvoirs.js';
import { ADJOINTS, RELAIS_NIV, NIV_DEFAUT, effetDuRelais, relaisDeLaPeriode, styleAuNiveau } from '../js/adjoints.js';
import { nomDuNiveau } from '../js/niveaux.js';
import { COACHS } from '../js/coachs.js';
import { banc } from '../js/profil-style.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';
import '../js/greffes.js';   // V25 : les greffes du Rogue se branchent sur le moteur

const N = Number(process.env.N ?? 400);
const MESURE = process.env.MESURE !== '0';
const FILS = Math.max(1, Number(process.env.FILS ?? 4)), ICI = fileURLToPath(import.meta.url);
/* Un relais joue une période, le tiers d'un soir : il se voit au tiers de ce qu'un effet de toute la soirée doit montrer (check_effets). */
const VISIBLE = { tirs: 2 / 3, buts: 0.1, punitions: 0.5 / 3, coups: 4 / 3, blessures: 1 };
const BUTS_PAR_V = 6;
/*
 * La paire : de 1,2 à 1,6 fois la somme de ses pièces. Un adjoint seul est un style, à peu près zéro : ce que la paire
 * rend de plus que ses pièces, c'est ce que le relais ajoute (la paire moins la même paire sans relais), ramené à ce
 * que le pouvoir rend seul — sommé sur les huit voies, pour que le bruit d'une paire ne juge pas. Aucun relais ne nuit.
 */
const PAIRE = [1.2, 1.6], BRUIT_V = 0.3;
const somme = a => (a || []).reduce((x, y) => x + y, 0);
const f1 = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;

/* ---------- 1. les tables ---------- */
{
  const fautes = [];
  let chaines = 0;
  for (const [k, A] of Object.entries(ADJOINTS)) {
    const S = A.signal, R = A.relais;
    if (!S || !R) { fautes.push(`${k} : sans signal ou sans relais`); continue; }
    if (!S.dit || /\d(?!e\b)/.test(S.dit) || typeof S.quand !== 'function' || !(S.part > 0 && S.part <= 1)) fautes.push(`${k} : la forme du signal`);
    if (!A[R.cote] || A[R.cote][R.canal] == null) fautes.push(`${k} : relaie ${R.cote}.${R.canal}, qui n'est pas un de ses canaux`);
    if (S.chaine) chaines++;
    const fx = effetDuRelais(k);
    if (!fx || JSON.stringify(effetDuRelais(k, 1)) === JSON.stringify(effetDuRelais(k, 5))) fautes.push(`${k} : le relais ne suit pas le niveau`);
  }
  exiger(`${Object.keys(ADJOINTS).length} adjoints, chacun un signal sans chiffre et un relais sur un de ses canaux`, !fautes.length, fautes.slice(0, 4).join(' · ') || Object.values(ADJOINTS).map(A => `${A.ico}→${A.relais.canal}`).join(' '));
  const monte = RELAIS_NIV.every((r, i) => i === 0 || r > RELAIS_NIV[i - 1]) && RELAIS_NIV.length === 5 && RELAIS_NIV[0] > 0;
  exiger(`la reprise monte avec le niveau (${RELAIS_NIV.map(x => `×${String(x).replace('.', ',')}`).join(' · ')})`, monte, RELAIS_NIV.join(' · '));
  exiger('un seul second maillon : la chaîne s\'arrête à deux', chaines === 1, `${chaines} adjoint(s) qui lisent un relais`);
}

/* ---------- 2. pur ---------- */
{
  const main = cles => cles.map(cle => ({ cle, depuis: 0, fin: null, sejours: [] }));
  const P = { cle: 'essaim', main: main(['canonnier', 'arbitre', 'mur']) };
  const e0 = { k: 2, moi: 2, lui: 1, tirsMoi: 20, tirsLui: 18, der: null, series: false, gros: false, soir: {} };
  const avec = relaisDeLaPeriode(P, 3, { ...e0, pouvoirs: [{ cle: 'ruee', nom: 'La ruée', ico: '🐝' }] });
  const sans = relaisDeLaPeriode(P, 3, { ...e0, pouvoirs: [] });
  const vide = relaisDeLaPeriode({ ...P, sansRelais: true }, 3, { ...e0, pouvoirs: [{ cle: 'ruee', nom: 'La ruée', ico: '🐝' }] });
  const par = (xs, cle) => xs.find(x => x.cle === cle);
  exiger('un pouvoir qui joue allume le canonnier (premier maillon), qui allume l\'arbitre (second) ; le mur lit le pointage',
    par(avec, 'canonnier') && par(avec, 'canonnier').sur.genre === 'pouvoir' && par(avec, 'canonnier').maillon === 1
    && par(avec, 'arbitre') && par(avec, 'arbitre').sur.genre === 'relais' && par(avec, 'arbitre').maillon === 2
    && par(avec, 'mur') && par(avec, 'mur').sur.genre === 'moment' && avec.every(x => x.maillon <= 2),
    avec.map(x => `${x.ico} sur ${x.sur.ico || ''}${x.sur.nom}`).join(' · '));
  exiger('sans pouvoir, le canonnier se tait ; l\'arbitre relaie encore sur le mur, jamais sur lui-même ; sansRelais tait tout',
    !par(sans, 'canonnier') && par(sans, 'arbitre') && par(sans, 'arbitre').sur.cle === 'mur' && !vide.length && JSON.stringify(avec) === JSON.stringify(relaisDeLaPeriode(P, 3, { ...e0, pouvoirs: [{ cle: 'ruee', nom: 'La ruée', ico: '🐝' }] })),
    sans.map(x => `${x.ico} sur ${x.sur.ico || ''}${x.sur.nom}`).join(' · '));
  const phenomene = relaisDeLaPeriode({ cle: 'essaim', main: [{ cle: 'canonnier', niv: 5, depuis: 0, fin: null }] }, 3, { ...e0, pouvoirs: [{ cle: 'ruee', nom: 'La ruée', ico: '🐝' }] })[0];
  const soutien = relaisDeLaPeriode({ cle: 'essaim', main: [{ cle: 'canonnier', niv: 1, depuis: 0, fin: null }] }, 3, { ...e0, pouvoirs: [{ cle: 'ruee', nom: 'La ruée', ico: '🐝' }] })[0];
  exiger('un adjoint excellent relaie plus fort', phenomene && soutien && phenomene.valeur > soutien.valeur && phenomene.valeur > 1 && soutien.valeur > 1,
    `${nomDuNiveau(0)} ×${soutien ? soutien.valeur.toFixed(3) : '?'} · ${nomDuNiveau(4)} ×${phenomene ? phenomene.valeur.toFixed(3) : '?'}`);
}

/* ---------- 3 et 4. en paires ---------- */
const VESTIAIRES = TEMOINS.map(([lab, s, t]) => [lab, s, t, equipeReelle(s, t)]);
const club = i => { const [lab, s, t, un] = VESTIAIRES[i]; const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(p), { season: s }); };
POUVOIRS.__muet = [{ cle: 'muet', ico: '·', nom: 'Muet', dit: '', quand: () => false, effet: { volume: 1 } }];
const MUET = { cle: '__muet', xp: 0, talents: [] };
/* Un match isolé, comme check_pouvoirs : des clubs neufs, les dés de la graine, ton personnage posé. */
function match(i, j, graine, visiteur, perso, { soir = null, series = false, aux = false } = {}) {
  const toi = club(i), adv = club(j);
  toi.luck = 0; adv.luck = 0;
  toi.perso = perso; toi.xpSaison = 0;
  if (soir) toi._lireMoment = soir;
  toi.jourCourant = 0; toi._filetForce = { jour: 0, qui: aux ? 'aux' : 'partant' };
  grainerHasard(graine);
  const f = feuilleVierge();
  const r = visiteur ? playGame(adv, toi, 1, false, series, f) : playGame(toi, adv, 1, false, series, f);
  const moi = visiteur ? 'B' : 'A', eux = visiteur ? 'A' : 'B';
  return { f, moi, v: r.winner === toi ? 1 : 0, gf: visiteur ? r.gfB : r.gfA, ga: visiteur ? r.gfA : r.gfB,
    tp: somme(f.tirs[moi]), tc: somme(f.tirs[eux]), pun: f.punitions.filter(p => p.cote === moi).length, punEux: f.punitions.filter(p => p.cote === eux).length,
    coups: f.coups[moi], bl: f.blessures.filter(b => b.cote === moi).length };
}
/* Ce qu'un signal lit avant la période `k`, relu dans la feuille : le pointage, les tirs, le soir, et les pouvoirs notés. */
function etatLu(f, moi, k, series) {
  const eux = moi === 'A' ? 'B' : 'A';
  const buts = (c, a, b) => f.buts.filter(x => x.cote === c && x.instant >= a && x.instant < b).length;
  let tirsMoi = 0, tirsLui = 0;
  for (let i = 1; i <= k; i++) { tirsMoi += f.tirs[moi][i]; tirsLui += f.tirs[eux][i]; }
  const der = k ? { tirsMoi: f.tirs[moi][k], tirsLui: f.tirs[eux][k], moi: buts(moi, 20 * (k - 1), 20 * k), lui: buts(eux, 20 * (k - 1), 20 * k) } : null;
  const soir = Object.fromEntries((f.moments ? f.moments[moi] : []).map(x => [x, true]));
  const pouvoirs = f.pouvoirs.filter(x => x.cote === moi && x.k === k && !x.ombre);
  return { k, moi: buts(moi, 0, 20 * k), lui: buts(eux, 0, 20 * k), tirsMoi, tirsLui, der, series, gros: false, soir, pouvoirs };
}
/* Comme check_pouvoirs, plus l'infirmerie qui déborde un soir sur quatre (49 soirs sur 82 dans une vraie saison) : des clubs neufs n'ont pas de blessés. */
const soirDuMatch = g => ({ visiteur: g % 2 === 1, soir: Math.floor(g / 2) % 4 === 1 ? 'dosADos' : Math.floor(g / 2) % 4 === 3 ? 'infirmerie' : null, series: Math.floor(g / 2) % 8 === 3, aux: Math.floor(g / 4) % 4 === 2 });
const main = (cles, niv = NIV_DEFAUT) => cles.map(cle => ({ cle, niv, depuis: 0, fin: null, sejours: [] }));
const coachDe = cle => Object.keys(COACHS).find(c => ADJOINTS[cle].voie === c) || 'essaim';
/*
 * Un adjoint (`cle`) au Pilier, en poste chez le coach de sa voie (le pouvoir I ouvert), `n` matchs par club : ses
 * relais contre la feuille, la soirée avec et sans relais (b), et les quatre pièces de la paire (4).
 */
function mesurer(cle, n) {
  const c = coachDe(cle), chaine = !!ADJOINTS[cle].signal.chaine;
  // Le second maillon se mesure avec un premier qui relaie sur les pouvoirs : le canonnier chez le Frelon.
  const cartes = chaine ? ['canonnier', cle] : [cle];
  const P = { cle: c, xp: 0, talents: [] };
  const m = { cle, c, n: 0, faux: 0, fois: 0, soirs: 0, sv: { tp: 0, tc: 0, gf: 0, ga: 0, pun: 0, punEux: 0, coups: 0, bl: 0 }, d: { p: 0, a: 0, pa: 0, pa0: 0 } };
  for (let i = 0; i < VESTIAIRES.length; i++) for (let g = 0; g < n; g++) {
    const j = (i + 1 + (g % (VESTIAIRES.length - 1))) % VESTIAIRES.length;
    const o = soirDuMatch(g), graine = `rl${cle}:${i}:${g}`;
    const muet = match(i, j, graine, o.visiteur, MUET, o);
    const p = match(i, j, graine, o.visiteur, P, o);
    const a = match(i, j, graine, o.visiteur, { ...MUET, main: main(cartes) }, o);
    const pa = match(i, j, graine, o.visiteur, { ...P, main: main(cartes) }, o);
    const pa0 = match(i, j, graine, o.visiteur, { ...P, main: main(cartes), sansRelais: true }, o);
    m.n++;
    // a. Les périodes relayées sont celles que le signal lit dans la feuille (le second maillon lit les relais du premier).
    const notes = pa.f.relais.filter(x => x.cote === pa.moi && x.cle === cle).map(x => x.k);
    const attendues = [0, 1, 2].filter(k => {
      const e = etatLu(pa.f, pa.moi, k, o.series), autres = pa.f.relais.filter(x => x.cote === pa.moi && x.k === k && x.cle !== cle && x.maillon === 1).map(x => x.cle);
      return ADJOINTS[cle].signal.quand({ ...e, relais: chaine ? autres : [], postes: cartes });
    });
    if (notes.join() !== attendues.join()) m.faux++;
    m.fois += notes.length;
    if (notes.length) { m.soirs++; for (const k of Object.keys(m.sv)) m.sv[k] += pa[k] - pa0[k]; }
    const net = x => (x.gf - x.ga) - (muet.gf - muet.ga);
    m.d.p += net(p); m.d.a += net(a); m.d.pa += net(pa); m.d.pa0 += net(pa0);
  }
  return m;
}
if (process.env.PART) {
  process.stdout.write(JSON.stringify(process.env.PART.split(',').map(cle => mesurer(cle, N))));
  process.exit(0);
}
console.log(`\n  Le relais des adjoints (V23 D) · ${N} matchs par club${MESURE ? '' : ' · sans les chiffres de valeur'}\n`);
const taches = Object.keys(ADJOINTS);
const lancer = l => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, PART: l.join(',') } });
  let t = '';
  p.stdout.on('data', x => { t += x; }); p.stderr.on('data', x => process.stderr.write(x));
  p.on('close', code => (code === 0 ? ok(JSON.parse(t)) : ko(new Error(`fils ${code}`))));
});
const lots = Array.from({ length: FILS }, (_, k) => taches.filter((_, i) => i % FILS === k)).filter(l => l.length);
const mesures = (await Promise.all(lots.map(lancer))).flat().sort((a, b) => taches.indexOf(a.cle) - taches.indexOf(b.cle));
const nomDe = m => `${ADJOINTS[m.cle].ico} ${ADJOINTS[m.cle].nom}`;
exiger('a. chaque adjoint relaie exactement les périodes que son signal lit dans la feuille', mesures.every(m => !m.faux), mesures.filter(m => m.faux).map(m => `${nomDe(m)} (${m.faux})`).join(', ') || `${mesures.reduce((x, m) => x + m.fois, 0)} périodes relayées`);
exiger('chaque adjoint relaie des soirs', mesures.every(m => m.soirs > 0), mesures.filter(m => !m.soirs).map(nomDe).join(', ') || mesures.map(m => `${ADJOINTS[m.cle].ico} ${(m.soirs / m.n * 100).toFixed(0)} %`).join(' · '));
if (MESURE) {
  const parSaison = (m, x) => (x / m.n) * 82 / BUTS_PAR_V;
  for (const m of mesures) {
    const s = m.soirs || 1, x = Object.fromEntries(Object.entries(m.sv).map(([k, v]) => [k, v / s]));
    m.vue = Math.max(Math.abs(x.tp) / VISIBLE.tirs, Math.abs(x.tc) / VISIBLE.tirs, Math.abs(x.tp + x.tc) / VISIBLE.tirs, (Math.abs(x.gf) + Math.abs(x.ga)) / VISIBLE.buts,
      Math.abs(x.pun) / VISIBLE.punitions, Math.abs(x.punEux) / VISIBLE.punitions, Math.abs(x.coups) / VISIBLE.coups, Math.abs(parSaison(m, m.sv.bl) * BUTS_PAR_V) / VISIBLE.blessures);
    m.v = { p: parSaison(m, m.d.p), a: parSaison(m, m.d.a), pa: parSaison(m, m.d.pa), pa0: parSaison(m, m.d.pa0) };
    m.relais = m.v.pa - m.v.pa0;
    informer(`${nomDe(m)} chez ${COACHS[m.c].ico}`.padEnd(30), `relaie ${(m.soirs / m.n * 100).toFixed(0)} % des soirs · ce soir-là : tirs ${f1(x.tp)} / ${f1(x.tc)} · buts ${f1(x.gf, 2)} / ${f1(x.ga, 2)} · pun. ${f1(x.pun, 2)} / ${f1(x.punEux, 2)} · coups ${f1(x.coups)} · blessures ${f1(parSaison(m, m.sv.bl) * BUTS_PAR_V)}/saison · vu ${m.vue.toFixed(1)} · pouvoir ${f1(m.v.p)} V, adjoint ${f1(m.v.a)}, la paire ${f1(m.v.pa)}, le relais y ajoute ${f1(m.relais)}`);
  }
  exiger('b. chaque relais se voit dans la feuille du soir où il joue (au tiers d\'un soir)', mesures.every(m => m.vue >= 1), mesures.filter(m => m.vue < 1).map(m => `${nomDe(m)} (${m.vue.toFixed(2)})`).join(', ') || 'tous');
  const paires = mesures.filter(m => !ADJOINTS[m.cle].signal.chaine);
  const pouvoirs = paires.reduce((a, m) => a + m.v.p, 0), relais = paires.reduce((a, m) => a + m.relais, 0);
  const ratio = 1 + relais / Math.max(0.1, pouvoirs);
  const nuit = mesures.filter(m => m.relais < -BRUIT_V);
  exiger(`4. la paire coach-adjoint rend de ${String(PAIRE[0]).replace('.', ',')} à ${String(PAIRE[1]).replace('.', ',')} fois ses pièces, sur les huit voies`, ratio >= PAIRE[0] && ratio <= PAIRE[1], `×${ratio.toFixed(2)} : les pouvoirs I ${f1(pouvoirs)} V en tout, les relais ${f1(relais)}`);
  exiger(`aucun relais ne nuit (à ${String(BRUIT_V).replace('.', ',')} V près)`, !nuit.length, nuit.map(m => `${nomDe(m)} ${f1(m.relais)}`).join(', ') || 'aucun');
  const chaine = mesures.find(m => ADJOINTS[m.cle].signal.chaine);
  if (chaine) exiger('le second maillon ajoute à la chaîne', chaine.relais >= -BRUIT_V, `🏹 et ${nomDe(chaine)} chez ${COACHS[chaine.c].ico} : ${f1(chaine.v.pa)} V avec relais, ${f1(chaine.v.pa0)} sans`);
}

/* ---------- 5. la saison ---------- */
{
  const ligue = () => VESTIAIRES.map((_, i) => club(i));
  const decisions = [{ jour: 0, equipe: 0, coach: { cle: 'essaim', xp: SEUILS_NIVEAU[2], talents: [] } },
    { jour: 10, equipe: 0, embauche: { cle: 'canonnier' } }, { jour: 10, equipe: 0, embauche: { cle: 'arbitre' } },
    { jour: 20, equipe: 0, poste: { cle: 'canonnier' } }, { jour: 20, equipe: 0, poste: { cle: 'arbitre' } }];
  const joue = () => { const t = ligue(); const L = simulateLeague(t, 82, { graine: 'relais', decisions: decisions.map(d => ({ ...d })) }); return { toi: t[0], L }; };
  const A = joue(), B = joue();
  const soirs = x => x.L.ligue.calendrier.flat().filter(m => m.feuille && (m.A === x.toi || m.B === x.toi)).map(m => ({ f: m.feuille, cote: m.A === x.toi ? 'A' : 'B' }));
  const sA = soirs(A);
  const relais = sA.flatMap(x => (x.f.relais || []).filter(r => r.cote === x.cote));
  const fautes = [];
  let cartes = 0;
  for (const { f, cote } of sA) {
    const notes = (f.relais || []).filter(r => r.cote === cote);
    const b = banc(A.toi, f).filter(c => c.genre === 'relais');
    cartes += b.length;
    for (const cle of new Set(notes.map(r => r.cle))) {
      const c = b.find(x => x.nom.startsWith(ADJOINTS[cle].nom)), ks = [...new Set(notes.filter(r => r.cle === cle).map(r => r.k))].sort((p, q) => p - q);
      if (!c || !c.joue || c.periodes.join() !== ks.join()) fautes.push(`${ADJOINTS[cle].nom} : ${c ? c.periodes.join('·') : 'absent'} contre ${ks.join('·')}`);
    }
    if (b.length !== new Set(notes.map(r => r.cle)).size) fautes.push(`${b.length} cartes pour ${new Set(notes.map(r => r.cle)).size} relayeurs`);
    for (const k of [1, 2]) if (banc(A.toi, f, { jusqua: k }).some(c => c.genre === 'relais' && c.periodes.some(p => p >= k))) fautes.push('un relais d\'une période à venir à l\'entracte');
  }
  const empreinte = x => soirs(x).map(s => (s.f.relais || []).filter(r => r.cote === s.cote).map(r => `${r.cle}${r.k}${r.maillon}`).join(',')).join('/');
  exiger('5. la feuille garde chaque relais, et le banc l\'allume avec ses périodes (à l\'entracte, les jouées seulement)', relais.length > 0 && !fautes.length && cartes > 0, fautes.slice(0, 3).join(' ; ') || `${relais.length} relais sur la saison, ${cartes} cartes au banc · le second maillon ${relais.filter(r => r.maillon === 2).length} fois`);
  exiger('5. la même graine rejoue les mêmes relais', empreinte(A) === empreinte(B) && relais.some(r => r.maillon === 2), `${sA.length} soirs`);
}

verdict('Le relais des adjoints');
