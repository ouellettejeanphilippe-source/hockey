/*
 * LES POUVOIRS DU COACH (V21, docs/refonte-v21.md — js/pouvoirs.js). Le coach est un personnage : un niveau gagné en
 * jouant, trois pouvoirs qui s'ouvrent aux niveaux 1, 3 et 5, deux talents, des bienfaits. Ce qu'on exige :
 *   1. les tables : huit coachs, trois pouvoirs chacun, sur des canaux que le moteur connaît ; « plus tôt » joue au
 *      moins quand le pouvoir joue ;
 *   2. le niveau : les seuils, les pouvoirs ouverts, les talents dus ; les bienfaits offerts sont purs, distincts, sur
 *      des pouvoirs ouverts, jamais un pris ni un pouvoir plein ;
 *   3. EN PAIRES, match par match (CLAUDE.md) : deux copies d'un même vrai club, le même match sur les mêmes dés,
 *      une fois avec un coach muet (trois périodes, aucun pouvoir : la soirée en périodes a son propre tirage), une
 *      fois avec le pouvoir seul. Chaque pouvoir :
 *        a. joue exactement les périodes que sa condition lit dans la feuille (le pointage, les tirs, le soir) ;
 *        b. hors de ses périodes, rien : un match où il ne joue pas rend la même feuille ;
 *        c. se voit dans la feuille d'un soir où il joue (±2 tirs, ±0,3 but, ±0,5 punition, ±4 mises en échec, ±3
 *           blessures par saison) ;
 *        d. aide sans casser : au plus `BORNE_V` victoires sur une saison (le premier et le deuxième d'un arbre ; l'ultime
 *           plus), jamais un piège ;
 *   4. le personnage complet (niveau 5, ses deux talents, des bienfaits « plus fort ») peut casser le jeu — c'est la
 *      récompense d'une run qui a duré (docs/refonte-v3.md, principe 5) — sans s'emballer ;
 *   5. la saison : l'expérience compte les victoires, la même graine rejoue le même personnage ; un bienfait payant paie
 *      ses buts, un contagieux entraîne un autre pouvoir à moitié.
 * `N` : matchs par club et par pouvoir (600, cinq minutes sur quatre processus, `FILS`). `COACHS=a,b` : quelques coachs.
 * `MESURE=0 N=20` (la CI, une demi-minute) : a, b et la saison, sans les chiffres de valeur.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, simulateLeague } from '../js/sim.js';
import { POUVOIRS, BIENFAITS, XP, SEUILS_NIVEAU, NIVEAU_MAX, niveauDe, pouvoirsOuverts, talentsDus, bienfaitsOfferts, forceDuPouvoir, jetonsDesPouvoirs } from '../js/pouvoirs.js';
import { COACHS } from '../js/coachs.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 600);
/* `MESURE=0` (la CI) : les périodes, la feuille hors des soirs et la saison, sans les chiffres de valeur ni les bornes, que le bruit d'un petit N fausserait. */
const MESURE = process.env.MESURE !== '0';
const FILS = Math.max(1, Number(process.env.FILS ?? 4)), ICI = fileURLToPath(import.meta.url);
const QUELS = process.env.COACHS ? process.env.COACHS.split(',') : Object.keys(POUVOIRS);
const VISIBLE = { tirs: 2, buts: 0.3, punitions: 0.5, coups: 4, blessures: 3 };
/* La borne d'un pouvoir seul, à sa force de départ, en victoires sur une saison : I et II, puis l'ultime. */
const BORNE_V = [2.5, 2.5, 4];
const PIEGE_V = -0.5, BUTS_PAR_V = 6, COMPLET_MAX_V = 16;
const CANAUX = new Set(['volume', 'finition', 'defense', 'discipline', 'blessure', 'robustesse', 'F']);
const somme = a => (a || []).reduce((x, y) => x + y, 0);

/* ---------- 1. les tables ---------- */
{
  const fautes = [];
  if (Object.keys(POUVOIRS).sort().join() !== Object.keys(COACHS).sort().join()) fautes.push('les coachs et les arbres');
  for (const [c, arbre] of Object.entries(POUVOIRS)) {
    if (arbre.length !== 3) fautes.push(`${c} : ${arbre.length} pouvoirs`);
    if (new Set(arbre.map(P => P.cle)).size !== arbre.length) fautes.push(`${c} : deux clés pareilles`);
    for (const P of arbre) {
      if (!P.ico || !P.nom || !P.dit || typeof P.quand !== 'function' || typeof P.tot !== 'function') fautes.push(`${c}/${P.cle} : la forme`);
      const canaux = [...Object.keys(P.effet || {}), ...Object.keys(P.adv || {})];
      if (!canaux.length || canaux.some(k => !CANAUX.has(k))) fautes.push(`${c}/${P.cle} : ${canaux.join(', ')}`);
    }
  }
  exiger('huit coachs, trois pouvoirs chacun, sur des canaux que le moteur connaît', !fautes.length, fautes.slice(0, 4).join(' · ') || `${Object.keys(POUVOIRS).length} arbres`);
  // « Plus tôt » : partout où le pouvoir joue, sa version tôt joue aussi.
  const etats = [];
  for (let k = 0; k < 3; k++) for (const [moi, lui] of [[0, 0], [1, 0], [0, 1], [2, 2], [3, 1], [1, 3]]) for (const der of [null, [8, 12], [12, 8]]) for (const soir of [{}, { dosADos: true }, { visiteur: true }, { domicile: true }, { rival: true }]) for (const series of [false, true]) {
    if (k === 0 && (moi || lui || der)) continue;
    etats.push({ k, moi, lui, tirsMoi: 0, tirsLui: 0, der: k && der ? { tirsMoi: der[0], tirsLui: der[1], moi: 0, lui: 0 } : null, series, gros: false, soir });
  }
  const pasTot = [];
  for (const [c, arbre] of Object.entries(POUVOIRS)) for (const P of arbre) if (etats.some(e => P.quand(e) && !P.tot(e))) pasTot.push(`${c}/${P.cle}`);
  exiger('« plus tôt » joue au moins partout où le pouvoir joue', !pasTot.length, pasTot.join(', ') || `${etats.length} états lus`);
}

/* ---------- 2. le niveau, les talents, les bienfaits offerts ---------- */
{
  exiger('le niveau : 1 au départ, un de plus à chaque seuil, cinq au plus', niveauDe(0) === 1 && SEUILS_NIVEAU.every((s, i) => niveauDe(s) === i + 1 && (i === 0 || niveauDe(s - 1) === i)) && niveauDe(9999) === NIVEAU_MAX && NIVEAU_MAX === 5,
    SEUILS_NIVEAU.join(' · '));
  exiger('les pouvoirs s\'ouvrent aux niveaux 1, 3 et 5', [1, 2, 3, 4, 5].map(n => pouvoirsOuverts(n).length).join() === '1,1,2,2,3');
  exiger('un talent au niveau 2, un autre au 4', talentsDus(1) === 0 && talentsDus(2) === 1 && talentsDus(4) === 2 && talentsDus(4, [0]) === 1 && talentsDus(5, [0, 1]) === 0);
  const perso = { cle: 'essaim', xp: SEUILS_NIVEAU[2], talents: [], bienfaits: [{ p: 0, b: 'fort' }, { p: 0, b: 'tot' }, { p: 1, b: 'payant' }] };
  const a = bienfaitsOfferts(perso, 'g', 'pp:9'), b = bienfaitsOfferts(perso, 'g', 'pp:9');
  const ouverts = pouvoirsOuverts(niveauDe(perso.xp));
  const bons = a.length === 3 && JSON.stringify(a) === JSON.stringify(b) && new Set(a.map(x => `${x.p}:${x.b}`)).size === 3
    && a.every(x => ouverts.includes(x.p) && x.p !== 0 && !(x.p === 1 && x.b === 'payant') && BIENFAITS[x.b]);
  exiger('trois bienfaits offerts, purs, distincts, sur un pouvoir ouvert qui n\'est pas plein, jamais un déjà pris', bons, a.map(x => `${x.p}:${x.b}`).join(' · '));
  const autres = new Set();
  for (let g = 0; g < 40; g++) autres.add(JSON.stringify(bienfaitsOfferts(perso, `g${g}`, 'pp:9')));
  exiger('deux graines n\'offrent pas les mêmes', autres.size > 5, `${autres.size} offres sur 40 graines`);
  const plein = { cle: 'essaim', xp: 0, talents: [], bienfaits: [{ p: 0, b: 'fort' }, { p: 0, b: 'tot' }] };
  exiger('rien à offrir : la liste est vide (le moment fort paie de l\'expérience)', bienfaitsOfferts(plein, 'g', 'x').length === 0);
  const f = forceDuPouvoir({ talents: [1], bienfaits: [{ p: 1, b: 'fort' }, { p: 1, b: 'series' }] }, 1, { series: true });
  exiger('un talent et « plus fort » grandissent de moitié chacun, « des séries » double en séries', f === 4 && forceDuPouvoir({ talents: [], bienfaits: [] }, 0) === 1, `force ${f}`);
}

/* ---------- 3. chaque pouvoir, en paires ---------- */
const VESTIAIRES = TEMOINS.map(([lab, s, t]) => [lab, s, t, equipeReelle(s, t)]);
const club = i => { const [lab, s, t, un] = VESTIAIRES[i]; const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(p), { season: s }); };
// Le coach muet : la soirée en trois périodes, aucun pouvoir.
POUVOIRS.__muet = [{ cle: 'muet', ico: '·', nom: 'Muet', dit: '', quand: () => false, tot: () => false, effet: { volume: 1 } }];
/*
 * Un match isolé : des clubs neufs, les dés de la graine. `soir` : un moment posé pour la lecture (`_lireMoment`) ;
 * `series` : un match de séries. Rend la feuille et les chiffres de ton club.
 */
function match(i, j, graine, visiteur, perso, { soir = null, series = false } = {}) {
  const toi = club(i), adv = club(j);
  // Un soir, pas une saison : la chance de saison se tire à la création du club, hors de la graine.
  toi.luck = 0; adv.luck = 0;
  toi.perso = perso; toi.xpSaison = 0;
  if (soir) toi._lireMoment = soir;
  grainerHasard(graine);
  const f = feuilleVierge();
  const r = visiteur ? playGame(adv, toi, 1, false, series, f) : playGame(toi, adv, 1, false, series, f);
  const moi = visiteur ? 'B' : 'A', eux = visiteur ? 'A' : 'B';
  return { f, moi, v: r.winner === toi ? 1 : 0, gf: visiteur ? r.gfB : r.gfA, ga: visiteur ? r.gfA : r.gfB,
    tp: somme(f.tirs[moi]), tc: somme(f.tirs[eux]), pun: f.punitions.filter(p => p.cote === moi).length, punEux: f.punitions.filter(p => p.cote === eux).length,
    coups: f.coups[moi], bl: f.blessures.filter(b => b.cote === moi).length };
}
/* Ce que la condition d'un pouvoir lit avant la période `k`, relu dans la feuille. */
function etatLu(f, moi, k, series) {
  const eux = moi === 'A' ? 'B' : 'A';
  const buts = (c, a, b) => f.buts.filter(x => x.cote === c && x.instant >= a && x.instant < b).length;
  let tirsMoi = 0, tirsLui = 0;
  for (let i = 1; i <= k; i++) { tirsMoi += f.tirs[moi][i]; tirsLui += f.tirs[eux][i]; }
  const der = k ? { tirsMoi: f.tirs[moi][k], tirsLui: f.tirs[eux][k], moi: buts(moi, 20 * (k - 1), 20 * k), lui: buts(eux, 20 * (k - 1), 20 * k) } : null;
  const soir = Object.fromEntries((f.moments ? f.moments[moi] : []).map(x => [x, true]));
  return { k, moi: buts(moi, 0, 20 * k), lui: buts(eux, 0, 20 * k), tirsMoi, tirsLui, der, series, gros: false, soir };
}
/* Le soir d'un match isolé, à peu près comme une saison les sert : à l'étranger un soir sur deux, un dos-à-dos sur quatre, des séries sur huit. */
const soirDuMatch = g => ({ visiteur: g % 2 === 1, soir: Math.floor(g / 2) % 4 === 1 ? 'dosADos' : null, series: Math.floor(g / 2) % 8 === 3 });
/* Un pouvoir seul (`c:idx`), en paires contre le coach muet, `n` matchs par club : ses périodes, ses soirs, ses chiffres. */
function mesurerPouvoir(c, idx, n) {
  const P = POUVOIRS[c][idx];
  POUVOIRS.__seul = [P];
  const perso = { cle: '__seul', xp: 0, talents: [], bienfaits: [] };
  const m = { c, idx, n: 0, fois: 0, soirs: 0, faux: 0, horsDiff: 0, dv: 0, dgf: 0, dga: 0, dbl: 0, sv: { tp: 0, tc: 0, gf: 0, ga: 0, pun: 0, punEux: 0, coups: 0 } };
  for (let i = 0; i < VESTIAIRES.length; i++) for (let g = 0; g < n; g++) {
    const j = (i + 1 + (g % (VESTIAIRES.length - 1))) % VESTIAIRES.length;
    const o = soirDuMatch(g), graine = `pv${c}${idx}:${i}:${g}`;
    const a = match(i, j, graine, o.visiteur, MUET, o), b = match(i, j, graine, o.visiteur, perso, o);
    m.n++;
    const notes = b.f.pouvoirs.filter(x => x.cote === b.moi).map(x => x.k);
    // a. Les périodes jouées sont celles que la condition lit.
    const attendues = [0, 1, 2].filter(k => P.quand(etatLu(b.f, b.moi, k, o.series)));
    if (notes.join() !== attendues.join()) m.faux++;
    m.fois += notes.length;
    if (!notes.length) {
      // b. Hors de ses périodes, la même feuille.
      if (JSON.stringify([a.gf, a.ga, a.f.tirs, a.pun, a.punEux, a.coups]) !== JSON.stringify([b.gf, b.ga, b.f.tirs, b.pun, b.punEux, b.coups])) m.horsDiff++;
    } else {
      m.soirs++;
      for (const k of Object.keys(m.sv)) m.sv[k] += b[k] - a[k];
    }
    m.dv += b.v - a.v; m.dgf += b.gf - a.gf; m.dga += b.ga - a.ga; m.dbl += b.bl - a.bl;
  }
  delete POUVOIRS.__seul;
  return m;
}
/* Le personnage complet d'un coach : niveau 5, ses deux talents, « plus fort » sur ses trois pouvoirs ; en victoires. */
function mesurerComplet(c, n) {
  const perso = { cle: c, xp: SEUILS_NIVEAU[4], talents: [0, 2], bienfaits: [0, 1, 2].map(p => ({ p, b: 'fort' })) };
  let k = 0, d = 0;
  for (let i = 0; i < VESTIAIRES.length; i++) for (let g = 0; g < n; g++) {
    const j = (i + 1 + (g % (VESTIAIRES.length - 1))) % VESTIAIRES.length;
    const o = soirDuMatch(g), graine = `cp${c}:${i}:${g}`;
    const a = match(i, j, graine, o.visiteur, MUET, o), b = match(i, j, graine, o.visiteur, perso, o);
    k++; d += (b.gf - b.ga) - (a.gf - a.ga);
  }
  return { c, v: (d / k) * 82 / BUTS_PAR_V };
}
const MUET = { cle: '__muet', xp: 0, talents: [], bienfaits: [] };
// UN FILS : ses tâches (« p:coach:idx », « c:coach »), rendues en JSON.
if (process.env.PART) {
  const out = process.env.PART.split(',').map(t => { const [s, c, idx] = t.split(':'); return s === 'p' ? mesurerPouvoir(c, Number(idx), N) : mesurerComplet(c, N); });
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}
console.log(`\n  Les pouvoirs du coach (V21) · ${N} matchs par club${MESURE ? '' : ' · sans les bornes'}\n`);
const taches = [...QUELS.flatMap(c => POUVOIRS[c].map((_, idx) => `p:${c}:${idx}`)), ...(MESURE ? QUELS.map(c => `c:${c}`) : [])];
const lancer = l => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, PART: l.join(',') } });
  let t = '';
  p.stdout.on('data', x => { t += x; }); p.stderr.on('data', x => process.stderr.write(x));
  p.on('close', code => (code === 0 ? ok(JSON.parse(t)) : ko(new Error(`fils ${code}`))));
});
const lots = Array.from({ length: FILS }, (_, k) => taches.filter((_, i) => i % FILS === k)).filter(l => l.length);
const rendus = (await Promise.all(lots.map(lancer))).flat();
const mesures = rendus.filter(x => 'idx' in x).sort((a, b) => taches.indexOf(`p:${a.c}:${a.idx}`) - taches.indexOf(`p:${b.c}:${b.idx}`));
for (const m of mesures) {
  m.P = POUVOIRS[m.c][m.idx];
  const s = m.soirs || 1, parSaison = x => (x / m.n) * 82;
  // Comme check_effets : les tirs d'un côté ou des deux, les buts des deux clubs, les punitions, les mises en échec, les blessures d'une saison.
  m.vue = Math.max(Math.abs(m.sv.tp / s) / VISIBLE.tirs, Math.abs(m.sv.tc / s) / VISIBLE.tirs, Math.abs((m.sv.tp + m.sv.tc) / s) / VISIBLE.tirs, (Math.abs(m.sv.gf / s) + Math.abs(m.sv.ga / s)) / VISIBLE.buts,
    Math.abs(m.sv.pun / s) / VISIBLE.punitions, Math.abs(m.sv.punEux / s) / VISIBLE.punitions, Math.abs(m.sv.coups / s) / VISIBLE.coups, Math.abs(parSaison(m.dbl)) / VISIBLE.blessures);
  m.vButs = parSaison(m.dgf - m.dga) / BUTS_PAR_V;
  informer(`${m.P.ico} ${m.P.nom}`.padEnd(26), `${(m.soirs / m.n * 100).toFixed(0)} % des soirs · le soir où il joue : tirs ${(m.sv.tp / s).toFixed(1)} / ${(m.sv.tc / s).toFixed(1)} · buts ${(m.sv.gf / s).toFixed(2)} / ${(m.sv.ga / s).toFixed(2)} · pun. ${(m.sv.pun / s).toFixed(2)} / ${(m.sv.punEux / s).toFixed(2)} · coups ${(m.sv.coups / s).toFixed(1)} · blessures ${parSaison(m.dbl).toFixed(1)}/saison · ${m.vButs >= 0 ? '+' : ''}${m.vButs.toFixed(1)} V`);
}
const nomDe = m => `${m.P.ico} ${m.P.nom}`;
exiger('a. chaque pouvoir joue exactement les périodes que sa condition lit dans la feuille', mesures.every(m => !m.faux), mesures.filter(m => m.faux).map(m => `${nomDe(m)} (${m.faux})`).join(', ') || `${mesures.reduce((x, m) => x + m.fois, 0)} périodes jouées`);
exiger('b. hors de ses périodes, rien : la même feuille', mesures.every(m => !m.horsDiff), mesures.filter(m => m.horsDiff).map(m => `${nomDe(m)} (${m.horsDiff})`).join(', ') || 'aucune feuille changée');
exiger('chaque pouvoir joue des soirs', mesures.every(m => m.soirs > 0), mesures.filter(m => !m.soirs).map(nomDe).join(', ') || 'tous');
if (MESURE) {
  exiger('c. chaque pouvoir se voit dans la feuille d\'un soir où il joue', mesures.every(m => m.vue >= 1), mesures.filter(m => m.vue < 1).map(m => `${nomDe(m)} (${m.vue.toFixed(2)})`).join(', ') || 'tous');
  exiger('d. un pouvoir seul reste sous sa borne (I et II : 2,5 V ; l\'ultime : 4 V)', mesures.every(m => m.vButs <= BORNE_V[m.idx]), mesures.filter(m => m.vButs > BORNE_V[m.idx]).map(m => `${nomDe(m)} +${m.vButs.toFixed(1)}`).join(', ') || 'tous');
  exiger('d. aucun pouvoir n\'est un piège', mesures.every(m => m.vButs >= PIEGE_V), mesures.filter(m => m.vButs < PIEGE_V).map(m => `${nomDe(m)} ${m.vButs.toFixed(1)}`).join(', ') || 'aucun');
  /* ---------- 4. le personnage complet ---------- */
  const complets = rendus.filter(x => !('idx' in x));
  informer('le personnage complet, en victoires sur une saison', complets.map(x => `${COACHS[x.c].ico} ${x.v >= 0 ? '+' : ''}${x.v.toFixed(1)}`).join(' · '));
  const trop = complets.filter(x => x.v > COMPLET_MAX_V || x.v < 1);
  exiger(`le personnage complet aide pour de vrai, sans s'emballer (de 1 à ${COMPLET_MAX_V} V)`, !trop.length, trop.map(x => `${COACHS[x.c].nom} ${x.v.toFixed(1)}`).join(', ') || 'tous');
}

/* ---------- 5. la saison ---------- */
{
  const ligue = () => VESTIAIRES.map((_, i) => club(i));
  const decisions = [{ jour: 0, equipe: 0, coach: { cle: 'essaim', xp: 0, talents: [], bienfaits: [{ p: 0, b: 'payant' }, { p: 0, b: 'contagieux' }] } }, { jour: 20, equipe: 0, xpCoach: SEUILS_NIVEAU[2] }];
  const joue = () => { const t = ligue(); const L = simulateLeague(t, 82, { graine: 'pouvoirs', decisions: decisions.map(d => ({ ...d })) }); return { t, L }; };
  const A = joue(), B = joue();
  const toi = A.t[0];
  const fiche = x => `${x.t[0].W}-${x.t[0].L}-${x.t[0].OTL} ${x.t[0].GF}-${x.t[0].GA} xp ${x.t[0].xpSaison}`;
  exiger('la même graine rejoue le même personnage', fiche(A) === fiche(B), fiche(A));
  exiger('l\'expérience de la saison compte les victoires', toi.xpSaison === toi.W * XP.victoire, `${toi.W} victoires, ${toi.xpSaison} points`);
  const feuilles = [];
  for (const j of (A.L && A.L.calendrier ? A.L.calendrier.flat() : [])) if (j.feuille && (j.A === toi || j.B === toi)) feuilles.push({ feuille: j.feuille, cote: j.A === toi ? 'A' : 'B' });
  const notes = feuilles.flatMap(x => x.feuille.pouvoirs.filter(n => n.cote === x.cote));
  const payes = notes.filter(n => n.payant).reduce((a, n) => a + 2 * n.buts, 0);
  exiger('un bienfait payant paie 2 jetons par but marqué pendant son pouvoir', feuilles.length > 0 && payes > 0 && jetonsDesPouvoirs(feuilles) === payes, `${payes} 🪙 sur ${feuilles.length} matchs`);
  exiger('un pouvoir contagieux entraîne un autre pouvoir ouvert, à moitié', notes.some(n => n.contagion && n.p !== 0) && notes.filter(n => n.contagion).every(n => !n.payant), `${notes.filter(n => n.contagion).length} périodes entraînées`);
}

verdict('Les pouvoirs du coach');
