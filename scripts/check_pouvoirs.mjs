/*
 * LES POUVOIRS DU COACH ET SON STAFF (V21, docs/refonte-v21.md — js/pouvoirs.js, js/adjoints.js). Le coach est un
 * personnage : un niveau gagné en jouant, trois pouvoirs qui s'ouvrent aux niveaux 1, 3 et 5, deux talents ; son staff,
 * trois adjoints au plus, chacun un système de jeu, un échange. Ce qu'on exige :
 *   1. les tables : huit coachs, trois pouvoirs chacun ; douze adjoints, chacun un gain ET un prix ; tous sur des
 *      canaux que le moteur connaît ;
 *   2. le niveau : les seuils, les pouvoirs ouverts, les talents dus ; les adjoints offerts sont purs, distincts,
 *      jamais un déjà en poste ; un staff qui déborde garde ses derniers entrés ; les vraies cartes d'entraîneur
 *      (data/coachs.json) : un coach par club-saison, une philosophie connue, un loto pur de trois philosophies ouvertes ;
 *   3. EN PAIRES, match par match (CLAUDE.md) : deux copies d'un même vrai club, le même match sur les mêmes dés,
 *      une fois avec un coach muet (trois périodes, aucun pouvoir : la soirée en périodes a son propre tirage), une
 *      fois avec le pouvoir seul. Chaque pouvoir :
 *        a. joue exactement les périodes que sa condition lit dans la feuille (le pointage, les tirs, le soir) ;
 *        b. hors de ses périodes, rien : un match où il ne joue pas rend la même feuille ;
 *        c. se voit dans la feuille d'un soir où il joue (±2 tirs, ±0,3 but, ±0,5 punition, ±4 mises en échec, ±3
 *           blessures par saison) ;
 *        d. aide sans casser : au plus `BORNE_V` victoires sur une saison (le premier et le deuxième d'un arbre ; l'ultime
 *           plus), jamais un piège ;
 *   3'. EN PAIRES aussi, chaque adjoint seul, tous les matchs : il se voit dans la feuille, et c'est un échange — ni un
 *      cadeau ni un piège sur un club ordinaire (`ECHANGE_V`), et il ne vaut pas la même chose partout ;
 *   3''. légers d'abord (oct.) : sous le niveau `NIVEAU_DES_LOURDS`, l'offre n'a que des légers, sans le bras droit ; un
 *      lourd pèse plus d'un club à l'autre qu'un léger ;
 *   4. le personnage complet (niveau 5, ses deux talents) peut casser le jeu — c'est la récompense d'une run qui a
 *      duré (docs/refonte-v3.md, principe 5) — sans s'emballer ; avec son bras droit (la synergie, oct.), plus encore,
 *      et toujours sans s'emballer ;
 *   5. la saison : l'expérience compte les victoires, la même graine rejoue le même personnage, ses adjoints jouent.
 * `N` : matchs par club et par pouvoir (600, cinq minutes sur quatre processus, `FILS`). `COACHS=a,b` : quelques coachs.
 * `MESURE=0 N=20` (la CI, une demi-minute) : a, b et la saison, sans les chiffres de valeur.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, simulateLeague } from '../js/sim.js';
import { POUVOIRS, XP, SEUILS_NIVEAU, NIVEAU_MAX, niveauDe, pouvoirsOuverts, talentsDus, forceDuPouvoir } from '../js/pouvoirs.js';
import { ADJOINTS, ADJOINTS_MAX, BRAS_DROIT, NIVEAU_DES_LOURDS, adjointsOfferts, avecAdjoint, adjointsQuiJouent, brasDroitDe, lignesDeLAdjoint } from '../js/adjoints.js';
import { MAITRISE, maitriseDu, carteDuCoach, lotoDesCoachs, DU_CARTABLE } from '../js/coachs-reels.js';
import fs from 'node:fs';
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
/* Un adjoint est un échange : sur la moyenne des clubs témoins, ni plus ni moins que `ECHANGE_V` victoires sur une saison. */
const ECHANGE_V = 1.5;
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
      if (!P.ico || !P.nom || !P.dit || typeof P.quand !== 'function') fautes.push(`${c}/${P.cle} : la forme`);
      const canaux = [...Object.keys(P.effet || {}), ...Object.keys(P.adv || {})];
      if (!canaux.length || canaux.some(k => !CANAUX.has(k))) fautes.push(`${c}/${P.cle} : ${canaux.join(', ')}`);
    }
  }
  exiger('huit coachs, trois pouvoirs chacun, sur des canaux que le moteur connaît', !fautes.length, fautes.slice(0, 4).join(' · ') || `${Object.keys(POUVOIRS).length} arbres`);
  // UN ADJOINT EST UN ÉCHANGE : au moins une ligne qui aide, au moins une qui coûte, sur des canaux connus.
  const pasEchange = Object.entries(ADJOINTS).filter(([k, A]) => {
    const l = lignesDeLAdjoint(k), canaux = [...Object.keys(A.effet || {}), ...Object.keys(A.adv || {})];
    return !A.ico || !A.nom || !l.some(x => x.bon) || !l.some(x => !x.bon) || canaux.some(c => !CANAUX.has(c)) || (A.adv && Object.keys(A.adv).some(c => c !== 'volume'));
  }).map(([k]) => k);
  exiger(`${Object.keys(ADJOINTS).length} adjoints, chacun un gain et un prix`, Object.keys(ADJOINTS).length >= 10 && !pasEchange.length, pasEchange.join(', ') || Object.values(ADJOINTS).map(A => A.ico).join(' '));
}

/* ---------- 2. le niveau, les talents, les adjoints offerts ---------- */
{
  exiger('le niveau : 1 au départ, un de plus à chaque seuil, cinq au plus', niveauDe(0) === 1 && SEUILS_NIVEAU.every((s, i) => niveauDe(s) === i + 1 && (i === 0 || niveauDe(s - 1) === i)) && niveauDe(9999) === NIVEAU_MAX && NIVEAU_MAX === 5,
    SEUILS_NIVEAU.join(' · '));
  exiger('les pouvoirs s\'ouvrent aux niveaux 1, 3 et 5', [1, 2, 3, 4, 5].map(n => pouvoirsOuverts(n).length).join() === '1,1,2,2,3');
  exiger('un talent au niveau 2, un autre au 4, chacun grandit un pouvoir de moitié', talentsDus(1) === 0 && talentsDus(2) === 1 && talentsDus(4) === 2 && talentsDus(4, [0]) === 1 && talentsDus(5, [0, 1]) === 0
    && forceDuPouvoir({ talents: [1, 1] }, 1) === 2 && forceDuPouvoir({ talents: [] }, 0) === 1);
  const staff = ['canonnier', 'numeroUn'];
  const a = adjointsOfferts(staff, 'g', 'pp9'), b = adjointsOfferts(staff, 'g', 'pp9');
  exiger('trois adjoints offerts, purs, distincts, jamais un déjà en poste', a.length === 3 && JSON.stringify(a) === JSON.stringify(b) && new Set(a).size === 3 && a.every(k => ADJOINTS[k] && !staff.includes(k)), a.join(' · '));
  const autres = new Set();
  for (let g = 0; g < 40; g++) autres.add(JSON.stringify(adjointsOfferts(staff, `g${g}`, 'pp9')));
  exiger('deux graines n\'offrent pas les mêmes', autres.size > 10, `${autres.size} offres sur 40 graines`);
  // LÉGERS D'ABORD ; SON BRAS DROIT (oct.) : un par coach, l'adjoint de sa voie ; il n'arrive qu'avec les lourds.
  const bras = Object.keys(COACHS).map(brasDroitDe);
  exiger('chaque coach a son bras droit, un adjoint de sa voie, un seul', bras.every(Boolean) && new Set(bras).size === bras.length && Object.values(ADJOINTS).filter(A => A.voie).length === bras.length,
    Object.keys(COACHS).map(c => `${COACHS[c].ico} ${ADJOINTS[brasDroitDe(c)].ico}`).join(' '));
  const tot = [];
  for (const c of Object.keys(COACHS)) for (let g = 0; g < 30; g++) for (const n of [1, 2]) tot.push(...adjointsOfferts([], `g${g}`, `pp${n}`, 3, { cle: c, niveau: n }).filter(k => ADJOINTS[k].lourd || ADJOINTS[k].voie === c).map(k => `${c}/${k}`));
  const tard = new Set();
  for (let g = 0; g < 60; g++) for (const k of adjointsOfferts([], `g${g}`, 'pp9', 3, { cle: 'tortue', niveau: NIVEAU_DES_LOURDS })) tard.add(k);
  exiger(`légers d'abord : sous le niveau ${NIVEAU_DES_LOURDS}, ni lourd ni bras droit ; à ce niveau, tous`, !tot.length && tard.has('mur') && Object.keys(ADJOINTS).every(k => tard.has(k)),
    tot.slice(0, 3).join(', ') || `${Object.values(ADJOINTS).filter(A => !A.lourd).map(A => A.ico).join('')} d'abord, puis ${Object.values(ADJOINTS).filter(A => A.lourd).map(A => A.ico).join('')}`);
  exiger(`son bras droit en poste grandit ses pouvoirs de ${Math.round(BRAS_DROIT * 100)} %, un autre adjoint rien`, forceDuPouvoir({ cle: 'essaim', talents: [], adjoints: ['canonnier'] }, 0) === 1 + BRAS_DROIT
    && forceDuPouvoir({ cle: 'essaim', talents: [], adjoints: ['tireur'] }, 0) === 1 && forceDuPouvoir({ cle: 'rapaces', talents: [], adjoints: ['canonnier', 'tireur'] }, 2) === 1 + BRAS_DROIT);
  const plein = avecAdjoint(['canonnier', 'tireur', 'mur'], 'soigneur');
  exiger(`un staff de plus de ${ADJOINTS_MAX} garde ses derniers entrés, en attendant qui part`, plein.length === 4 && adjointsQuiJouent(plein).join() === 'tireur,mur,soigneur' && avecAdjoint(plein, 'tireur').at(-1) === 'tireur',
    adjointsQuiJouent(plein).join(', '));
}

/* ---------- 2b. les vrais entraîneurs (js/coachs-reels.js, data/coachs.json) ---------- */
{
  const donnees = JSON.parse(fs.readFileSync(new URL('../data/coachs.json', import.meta.url), 'utf8'));
  const index = JSON.parse(fs.readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).seasons;
  const cartes = Object.entries(donnees).flatMap(([saison, clubs]) => Object.keys(clubs).map(tag => carteDuCoach(donnees, saison, tag)));
  const fautes = cartes.filter(c => !c || !c.n || !POUVOIRS[c.cle] || !(c.rang >= 1) || c.maitrise < 1 || c.maitrise > MAITRISE[0][1] || !(c.fiche.gp > 0));
  exiger('un vrai entraîneur pour chaque club de chaque saison, une philosophie connue', !fautes.length && index.every(s => donnees[s]) && cartes.length > 1000,
    `${cartes.length} cartes · ${Object.keys(POUVOIRS).map(k => `${k} ${cartes.filter(c => c.cle === k).length}`).join(' · ')}`);
  const bowman = carteDuCoach(donnees, '1976-77', 'MTL');
  exiger('Scotty Bowman, Canadiens 1976-77 : sa fiche, sa Coupe, son Jack Adams', bowman && bowman.n === 'Scotty Bowman' && bowman.fiche.v === 60 && bowman.coupe && bowman.jack, bowman ? `${bowman.n} · ${bowman.cle} · ${bowman.rang}e · ×${bowman.maitrise}` : 'absent');
  exiger('la maîtrise : ×1,2 aux deux premiers rangs, ×1,1 aux cinq premiers, ×1 ensuite', maitriseDu(1) === 1.2 && maitriseDu(2) === 1.2 && maitriseDu(3) === 1.1 && maitriseDu(6) === 1);
  const ouverts = ['tortue', 'essaim', 'rhinos'];
  const a = lotoDesCoachs(donnees, ouverts, 'g'), b = lotoDesCoachs(donnees, ouverts, 'g'), c = lotoDesCoachs(donnees, ouverts, 'h');
  exiger('le loto de l\'entraîneur : trois cartes, trois philosophies ouvertes, pur', a.length === 3 && new Set(a.map(x => x.cle)).size === 3 && a.every(x => ouverts.includes(x.cle))
    && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), a.map(x => `${x.n} ${x.saison} ${x.tag}`).join(' · '));
  // Le cartable d'abord, comme le classeur : les moins jouées, DU_CARTABLE au plus, et une carte neuve chaque fois.
  const siens = { [a[0].id]: { r: 3 }, [a[1].id]: { r: 1 }, [a[2].id]: { r: 2 } };
  const d = lotoDesCoachs(donnees, ouverts, 'h', 3, siens);
  exiger(`le loto tire d'abord dans ton cartable, les moins jouées, ${DU_CARTABLE} au plus, et une carte neuve`,
    d.length === 3 && d.filter(x => !x.neuf).length === DU_CARTABLE && d.filter(x => !x.neuf).every(x => siens[x.id]) && d.some(x => x.neuf && !siens[x.id])
    && d.find(x => !x.neuf).id === a[1].id && new Set(d.map(x => x.cle)).size === 3, d.map(x => `${x.n} ${x.saison}${x.neuf ? ' (neuve)' : ''}`).join(' · '));
}

/* ---------- 3. chaque pouvoir, en paires ---------- */
const VESTIAIRES = TEMOINS.map(([lab, s, t]) => [lab, s, t, equipeReelle(s, t)]);
const club = i => { const [lab, s, t, un] = VESTIAIRES[i]; const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(p), { season: s }); };
// Le coach muet : la soirée en trois périodes, aucun pouvoir.
POUVOIRS.__muet = [{ cle: 'muet', ico: '·', nom: 'Muet', dit: '', quand: () => false, effet: { volume: 1 } }];
/*
 * Un match isolé : des clubs neufs, les dés de la graine. `soir` : un moment posé pour la lecture (`_lireMoment`) ;
 * `series` : un match de séries. Rend la feuille et les chiffres de ton club.
 */
function match(i, j, graine, visiteur, perso, { soir = null, series = false, aux = false } = {}) {
  const toi = club(i), adv = club(j);
  // Un soir, pas une saison : la chance de saison se tire à la création du club, hors de la graine.
  toi.luck = 0; adv.luck = 0;
  toi.perso = perso; toi.xpSaison = 0;
  if (soir) toi._lireMoment = soir;
  // Ton gardien n° 1 part trois soirs sur quatre, ton n° 2 le quatrième, comme sur une saison (le premier soir d'un club
  // neuf, la rotation enverrait le n° 2).
  toi.jourCourant = 0; toi._filetForce = { jour: 0, qui: aux ? 'aux' : 'partant' };
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
const soirDuMatch = g => ({ visiteur: g % 2 === 1, soir: Math.floor(g / 2) % 4 === 1 ? 'dosADos' : null, series: Math.floor(g / 2) % 8 === 3, aux: Math.floor(g / 4) % 4 === 2 });
/* Un pouvoir seul (`c:idx`), en paires contre le coach muet, `n` matchs par club : ses périodes, ses soirs, ses chiffres. */
function mesurerPouvoir(c, idx, n) {
  const P = POUVOIRS[c][idx];
  POUVOIRS.__seul = [P];
  const perso = { cle: '__seul', xp: 0, talents: [], adjoints: [] };
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
/* Le personnage complet d'un coach : niveau 5, ses deux talents ; en victoires. */
/* Un adjoint seul (`cle`), en paires contre le coach muet sans staff, tous les matchs : ce qu'il change, club par club. */
function mesurerAdjoint(cle, n) {
  // Les soirs du n° 1 et ceux du n° 2, à part : un adjoint des gardiens se lit le soir où son gardien joue.
  const vide = () => ({ n: 0, tp: 0, tc: 0, gf: 0, ga: 0, pun: 0, punEux: 0, coups: 0, bl: 0 });
  const m = { cle, soirs: [vide(), vide(), vide()], parClub: [] };
  for (let i = 0; i < VESTIAIRES.length; i++) {
    let d = 0;
    for (let g = 0; g < n; g++) {
      const j = (i + 1 + (g % (VESTIAIRES.length - 1))) % VESTIAIRES.length;
      const o = soirDuMatch(g), graine = `ad${cle}:${i}:${g}`;
      const a = match(i, j, graine, o.visiteur, MUET, o), b = match(i, j, graine, o.visiteur, { ...MUET, adjoints: [cle] }, o);
      for (const sv of [m.soirs[0], m.soirs[o.aux ? 2 : 1]]) { sv.n++; for (const k of Object.keys(sv)) if (k !== 'n') sv[k] += b[k] - a[k]; }
      d += (b.gf - b.ga) - (a.gf - a.ga);
    }
    m.parClub.push((d / n) * 82 / BUTS_PAR_V);
  }
  return m;
}
/* `bras` : avec son bras droit en poste (la synergie, js/adjoints.js), son échange compris. */
function mesurerComplet(c, n, bras = false) {
  const perso = { cle: c, xp: SEUILS_NIVEAU[4], talents: [0, 2], adjoints: bras ? [brasDroitDe(c)] : [] };
  let k = 0, d = 0;
  for (let i = 0; i < VESTIAIRES.length; i++) for (let g = 0; g < n; g++) {
    const j = (i + 1 + (g % (VESTIAIRES.length - 1))) % VESTIAIRES.length;
    const o = soirDuMatch(g), graine = `cp${c}:${i}:${g}`;
    const a = match(i, j, graine, o.visiteur, MUET, o), b = match(i, j, graine, o.visiteur, perso, o);
    k++; d += (b.gf - b.ga) - (a.gf - a.ga);
  }
  return { c, bras, v: (d / k) * 82 / BUTS_PAR_V };
}
const MUET = { cle: '__muet', xp: 0, talents: [], adjoints: [] };
// UN FILS : ses tâches (« p:coach:idx », « c:coach »), rendues en JSON.
if (process.env.PART) {
  const out = process.env.PART.split(',').map(t => { const [s, c, idx] = t.split(':'); return s === 'p' ? mesurerPouvoir(c, Number(idx), N) : s === 'a' ? mesurerAdjoint(c, N) : mesurerComplet(c, N, s === 'b'); });
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}
console.log(`\n  Les pouvoirs du coach (V21) · ${N} matchs par club${MESURE ? '' : ' · sans les bornes'}\n`);
const taches = [...QUELS.flatMap(c => POUVOIRS[c].map((_, idx) => `p:${c}:${idx}`)), ...(MESURE ? [...QUELS.flatMap(c => [`c:${c}`, `b:${c}`]), ...Object.keys(ADJOINTS).map(k => `a:${k}`)] : [])];
const lancer = l => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, PART: l.join(',') } });
  let t = '';
  p.stdout.on('data', x => { t += x; }); p.stderr.on('data', x => process.stderr.write(x));
  p.on('close', code => (code === 0 ? ok(JSON.parse(t)) : ko(new Error(`fils ${code}`))));
});
const lots = Array.from({ length: FILS }, (_, k) => taches.filter((_, i) => i % FILS === k)).filter(l => l.length);
const rendus = (await Promise.all(lots.map(lancer))).flat();
const mesures = rendus.filter(x => 'idx' in x && !('parClub' in x)).sort((a, b) => taches.indexOf(`p:${a.c}:${a.idx}`) - taches.indexOf(`p:${b.c}:${b.idx}`));
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
  const complets = rendus.filter(x => 'v' in x && !x.bras), avecBras = rendus.filter(x => 'v' in x && x.bras);
  const signe = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
  informer('le personnage complet, en victoires sur une saison', complets.map(x => `${COACHS[x.c].ico} ${signe(x.v)}`).join(' · '));
  informer('… avec son bras droit (son échange compris)', avecBras.map(x => `${COACHS[x.c].ico}${ADJOINTS[brasDroitDe(x.c)].ico} ${signe(x.v)}`).join(' · '));
  const trop = complets.filter(x => x.v > COMPLET_MAX_V || x.v < 1);
  exiger(`le personnage complet aide pour de vrai, sans s'emballer (de 1 à ${COMPLET_MAX_V} V)`, !trop.length, trop.map(x => `${COACHS[x.c].nom} ${x.v.toFixed(1)}`).join(', ') || 'tous');
  // LA SYNERGIE (oct., JP : *un gros impact, tant que c'est lié à une synergie logique*) : son bras droit le grandit pour vrai,
  // sans que le personnage complet s'emballe.
  const sans = c => (complets.find(x => x.c === c) || {}).v ?? 0;
  const mou = avecBras.filter(x => x.v < sans(x.c) + 1 || x.v > COMPLET_MAX_V);
  exiger(`son bras droit le grandit d'une victoire au moins, sans passer ${COMPLET_MAX_V} V`, !mou.length, mou.map(x => `${COACHS[x.c].nom} ${signe(sans(x.c))} → ${signe(x.v)}`).join(', ') || 'tous');
  /* ---------- 3'. chaque adjoint, un échange ---------- */
  const adj = rendus.filter(x => 'parClub' in x);
  const parSoir = sv => Object.fromEntries(Object.entries(sv).map(([k, v]) => [k, v / (sv.n || 1)]));
  const vueDe = x => Math.max(Math.abs(x.tp) / VISIBLE.tirs, Math.abs(x.tc) / VISIBLE.tirs, Math.abs(x.tp + x.tc) / VISIBLE.tirs, (Math.abs(x.gf) + Math.abs(x.ga)) / VISIBLE.buts,
    Math.abs(x.pun) / VISIBLE.punitions, Math.abs(x.punEux) / VISIBLE.punitions, Math.abs(x.coups) / VISIBLE.coups, Math.abs(x.bl * 82) / VISIBLE.blessures);
  for (const m of adj) {
    const x = parSoir(m.soirs[0]);
    // Tous les soirs ; un adjoint des gardiens, aussi les soirs de son n° 1 et ceux de son n° 2.
    m.vue = Math.max(...(ADJOINTS[m.cle].gardiens ? m.soirs : m.soirs.slice(0, 1)).map(sv => vueDe(parSoir(sv))));
    m.v = m.parClub.reduce((a, b) => a + b, 0) / m.parClub.length;
    const A = ADJOINTS[m.cle], f = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
    informer(`${A.ico} ${A.nom}`.padEnd(30), `par soir : tirs ${f(x.tp)} / ${f(x.tc)} · buts ${f(x.gf, 2)} / ${f(x.ga, 2)} · pun. ${f(x.pun, 2)} / ${f(x.punEux, 2)} · coups ${f(x.coups)} · blessures ${f(x.bl * 82)}/saison · ${f(m.v)} V (${m.parClub.map(v => f(v)).join(' ')})`);
  }
  exiger('chaque adjoint se voit dans la feuille', adj.every(m => m.vue >= 1), adj.filter(m => m.vue < 1).map(m => `${ADJOINTS[m.cle].nom} (${m.vue.toFixed(2)})`).join(', ') || 'tous');
  exiger(`chaque adjoint est un échange : ni cadeau ni piège en moyenne (±${String(ECHANGE_V).replace('.', ',')} V)`, adj.every(m => Math.abs(m.v) <= ECHANGE_V), adj.filter(m => Math.abs(m.v) > ECHANGE_V).map(m => `${ADJOINTS[m.cle].nom} ${m.v.toFixed(1)}`).join(', ') || 'tous');
}

/* ---------- 5. la saison ---------- */
{
  const ligue = () => VESTIAIRES.map((_, i) => club(i));
  const avec = adjoints => [{ jour: 0, equipe: 0, coach: { cle: 'essaim', xp: 0, talents: [], adjoints } }, { jour: 20, equipe: 0, xpCoach: SEUILS_NIVEAU[2] },
    { jour: 30, equipe: 0, adjoint: { cle: 'numeroUn' } }];
  const joue = decisions => { const t = ligue(); const L = simulateLeague(t, 82, { graine: 'pouvoirs', decisions: decisions.map(d => ({ ...d })) }); return { t, L }; };
  const A = joue(avec(['canonnier'])), B = joue(avec(['canonnier'])), S = joue(avec([]));
  const toi = A.t[0];
  const fiche = x => `${x.t[0].W}-${x.t[0].L}-${x.t[0].OTL} ${x.t[0].GF}-${x.t[0].GA} xp ${x.t[0].xpSaison}`;
  exiger('la même graine rejoue le même personnage', fiche(A) === fiche(B), fiche(A));
  exiger('l\'expérience de la saison compte les victoires', toi.xpSaison === toi.W * XP.victoire, `${toi.W} victoires, ${toi.xpSaison} points`);
  exiger('ses adjoints entrent dans le staff et jouent', toi.perso.adjoints.join() === 'canonnier,numeroUn' && fiche(A) !== fiche(S), `${toi.perso.adjoints.join(', ')} · ${fiche(A)} contre ${fiche(S)} sans eux`);
}

verdict('Les pouvoirs du coach et son staff');
