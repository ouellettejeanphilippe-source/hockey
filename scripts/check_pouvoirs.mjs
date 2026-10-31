/*
 * LES POUVOIRS DU COACH ET SA MAIN D'ADJOINTS (V21, docs/refonte-v21.md — js/pouvoirs.js ; V22, docs/refonte-v22.md —
 * js/adjoints.js). Le coach est un personnage : un niveau gagné en jouant, trois pouvoirs qui s'ouvrent aux niveaux 1, 3
 * et 5, deux talents ; sa main d'adjoints, des cartes qu'on poste pour un séjour de `SEJOUR` matchs. Ce qu'on exige :
 *   1. les tables : huit coachs, trois pouvoirs chacun, tous sur des canaux que le moteur connaît ; huit adjoints,
 *      chacun un style — un gain ET un prix —, deux canaux au plus de chaque côté, un par philosophie (`voie`) ;
 *   2. le niveau : les seuils, les pouvoirs ouverts, les talents dus ; les vraies cartes d'entraîneur
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
 *   3'. EN PAIRES aussi, chaque adjoint seul en poste, tous les soirs : il se voit dans la feuille (le soir où il joue,
 *      les mêmes bornes que c.) et, ramené à ce qu'une carte peut jouer sur une saison (`SEJOUR / (SEJOUR + REPOS)` des
 *      matchs), il reste sous `ECHANGE_V` victoires, cadeau comme piège ;
 *   4. le personnage complet (niveau 5, ses deux talents) peut casser le jeu — c'est la récompense d'une run qui a
 *      duré (docs/refonte-v3.md, principe 5) — sans s'emballer ;
 *   5. la saison : l'expérience compte les victoires, la même graine rejoue le même personnage ; une carte embauchée
 *      puis postée joue exactement son séjour (la feuille la nomme), revient dans la main, se repose `REPOS` matchs
 *      (une pose pendant le repos ne fait rien) et garde sa fiche ; la main se borne à `MAIN_MAX` ; une vieille décision
 *      `adjoint`, `staff` ou `perdAdjoint` (V21) ne change rien.
 * `N` : matchs par club et par pouvoir (600, cinq minutes sur quatre processus, `FILS`). `COACHS=a,b` : quelques coachs.
 * `MESURE=0 N=20` (la CI, une demi-minute) : a, b et la saison, sans les chiffres de valeur.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, simulateLeague } from '../js/sim.js';
import { POUVOIRS, XP, SEUILS_NIVEAU, NIVEAU_MAX, niveauDe, pouvoirsOuverts, talentsDus, forceDuPouvoir } from '../js/pouvoirs.js';
import { MAITRISE, maitriseDu, carteDuCoach, lotoDesCoachs, DU_CARTABLE } from '../js/coachs-reels.js';
import { ADJOINTS, SEJOUR, SEJOUR_SYNERGIE, REPOS, MAIN_MAX, CASES_PAR_NIVEAU, adjointsOfferts, lignesDeLAdjoint, mainDe, enPoste, auRepos, embaucher, poster, quiPartDeLaMain, casesDuNiveau } from '../js/adjoints.js';
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
/* Un adjoint est un style, pas une force : sur une saison, au plus `ECHANGE_V` victoires, en plus comme en moins ; une carte
   joue au plus `MATCHS_PAR_SAISON` matchs (son séjour, son repos, et ainsi de suite). */
const ECHANGE_V = 1.5, MATCHS_PAR_SAISON = 82 * SEJOUR / (SEJOUR + REPOS);
const CANAUX = new Set(['volume', 'finition', 'defense', 'discipline', 'blessure', 'robustesse', 'F', 'energie']);
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
  // UN ADJOINT EST UN STYLE : une ligne qui aide, une qui coûte, deux canaux au plus de chaque côté, sur des canaux connus ; un par coach.
  const pasStyle = Object.entries(ADJOINTS).filter(([k, A]) => {
    const l = lignesDeLAdjoint(k), canaux = [...Object.keys(A.effet || {}), ...Object.keys(A.adv || {})];
    return !A.ico || !A.nom || !A.style || !A.dit || /\d/.test(A.dit) || !l.some(x => x.bon) || !l.some(x => !x.bon) || canaux.some(c => !CANAUX.has(c))
      || Object.keys(A.effet || {}).length > 3 || Object.keys(A.adv || {}).length > 1 || !COACHS[A.voie];
  }).map(([k]) => k);
  const voies = Object.values(ADJOINTS).map(A => A.voie);
  exiger(`${Object.keys(ADJOINTS).length} adjoints, chacun un style : un gain, un prix, une réplique sans chiffre, un par coach`, Object.keys(ADJOINTS).length >= 8 && !pasStyle.length && new Set(voies).size === Object.keys(COACHS).length,
    pasStyle.join(', ') || Object.values(ADJOINTS).map(A => `${A.ico}${COACHS[A.voie].ico}`).join(' '));
}

/* ---------- 2. le niveau et les talents ---------- */
{
  exiger('le niveau : 1 au départ, un de plus à chaque seuil, cinq au plus', niveauDe(0) === 1 && SEUILS_NIVEAU.every((s, i) => niveauDe(s) === i + 1 && (i === 0 || niveauDe(s - 1) === i)) && niveauDe(9999) === NIVEAU_MAX && NIVEAU_MAX === 5,
    SEUILS_NIVEAU.join(' · '));
  exiger('les pouvoirs s\'ouvrent aux niveaux 1, 3 et 5', [1, 2, 3, 4, 5].map(n => pouvoirsOuverts(n).length).join() === '1,1,2,2,3');
  exiger('un talent au niveau 2, un autre au 4, chacun grandit un pouvoir de moitié', talentsDus(1) === 0 && talentsDus(2) === 1 && talentsDus(4) === 2 && talentsDus(4, [0]) === 1 && talentsDus(5, [0, 1]) === 0
    && forceDuPouvoir({ talents: [1, 1] }, 1) === 2 && forceDuPouvoir({ talents: [] }, 0) === 1);
  // LA MAIN (V22) : trois offerts, purs, jamais un déjà dans la main ; une main pleine laisse partir la plus ancienne hors poste.
  const P = { cle: 'essaim', talents: [], main: [{ cle: 'canonnier', depuis: null, fin: null, sejours: [] }] };
  const a = adjointsOfferts(P, 'g', 'pp9'), b = adjointsOfferts(P, 'g', 'pp9');
  exiger('trois adjoints offerts, purs, distincts, jamais un déjà dans la main', a.length === 3 && JSON.stringify(a) === JSON.stringify(b) && new Set(a).size === 3 && a.every(k => ADJOINTS[k] && k !== 'canonnier'), a.join(', '));
  const autres = new Set();
  for (let g = 0; g < 40; g++) autres.add(JSON.stringify(adjointsOfferts(P, `g${g}`, 'pp9')));
  exiger('deux graines n\'offrent pas les mêmes', autres.size > 10, `${autres.size} offres sur 40 graines`);
  let M = { ...P };
  for (const k of ['lunette', 'mur', 'cogneur']) M = { ...M, main: embaucher(M, k, 0) };
  const pleine = { ...M, main: poster(M, 'mur', 5, 3, { W: 3, L: 2, OTL: 0 }) };
  const part = quiPartDeLaMain(pleine, 6), apres = { ...pleine, main: embaucher(pleine, 'moine', 6) };
  exiger(`une main de ${MAIN_MAX} : pleine, la plus ancienne hors poste part à l'arrivée suivante`, M.main.length === MAIN_MAX && part === 'canonnier' && apres.main.length === MAIN_MAX
    && !apres.main.some(c => c.cle === 'canonnier') && apres.main.some(c => c.cle === 'moine') && enPoste(apres.main.find(c => c.cle === 'mur'), 6, 'essaim'), `${part} part · ${apres.main.map(c => c.cle).join(', ')}`);
  exiger(`les cases suivent le niveau : ${CASES_PAR_NIVEAU.join(', ')} ; une pose sans case libre ou au repos ne fait rien`, casesDuNiveau(1) === 1 && casesDuNiveau(3) === 2 && casesDuNiveau(5) === 3
    && JSON.stringify(poster(pleine, 'lunette', 6, 1)) === JSON.stringify(mainDe(pleine)) && poster({ ...P, main: [{ cle: 'canonnier', depuis: null, fin: 10, sejours: [] }] }, 'canonnier', 12, 5).every(c => c.depuis === null)
    && auRepos({ cle: 'canonnier', depuis: null, fin: 10 }, 12) && !auRepos({ cle: 'canonnier', depuis: null, fin: 10 }, 10 + REPOS));
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
  const perso = { cle: '__seul', xp: 0, talents: [] };
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
/* Un adjoint seul (`cle`), en poste, en paires contre le coach muet sans main, tous les soirs : ce qu'il change. */
function mesurerAdjoint(cle, n) {
  const m = { cle, soirs: { n: 0, tp: 0, tc: 0, gf: 0, ga: 0, pun: 0, punEux: 0, coups: 0, bl: 0 }, d: 0 };
  for (let i = 0; i < VESTIAIRES.length; i++) for (let g = 0; g < n; g++) {
    const j = (i + 1 + (g % (VESTIAIRES.length - 1))) % VESTIAIRES.length;
    const o = soirDuMatch(g), graine = `ad${cle}:${i}:${g}`;
    const a = match(i, j, graine, o.visiteur, MUET, o), b = match(i, j, graine, o.visiteur, { ...MUET, main: [{ cle, depuis: 0, fin: null, sejours: [] }] }, o);
    m.soirs.n++; for (const k of Object.keys(m.soirs)) if (k !== 'n') m.soirs[k] += b[k] - a[k];
    m.d += (b.gf - b.ga) - (a.gf - a.ga);
    if (!b.f.adjoints.some(x => x.cote === b.moi && x.cle === cle)) m.sansNote = (m.sansNote || 0) + 1;
  }
  return m;
}
function mesurerComplet(c, n) {
  const perso = { cle: c, xp: SEUILS_NIVEAU[4], talents: [0, 2] };
  let k = 0, d = 0;
  for (let i = 0; i < VESTIAIRES.length; i++) for (let g = 0; g < n; g++) {
    const j = (i + 1 + (g % (VESTIAIRES.length - 1))) % VESTIAIRES.length;
    const o = soirDuMatch(g), graine = `cp${c}:${i}:${g}`;
    const a = match(i, j, graine, o.visiteur, MUET, o), b = match(i, j, graine, o.visiteur, perso, o);
    k++; d += (b.gf - b.ga) - (a.gf - a.ga);
  }
  return { c, v: (d / k) * 82 / BUTS_PAR_V };
}
const MUET = { cle: '__muet', xp: 0, talents: [] };
// UN FILS : ses tâches (« p:coach:idx », « c:coach »), rendues en JSON.
if (process.env.PART) {
  const out = process.env.PART.split(',').map(t => { const [s, c, idx] = t.split(':'); return s === 'p' ? mesurerPouvoir(c, Number(idx), N) : s === 'a' ? mesurerAdjoint(c, N) : mesurerComplet(c, N); });
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}
console.log(`\n  Les pouvoirs du coach (V21) · ${N} matchs par club${MESURE ? '' : ' · sans les bornes'}\n`);
const taches = [...QUELS.flatMap(c => POUVOIRS[c].map((_, idx) => `p:${c}:${idx}`)), ...(MESURE ? [...QUELS.map(c => `c:${c}`), ...Object.keys(ADJOINTS).map(k => `a:${k}`)] : [])];
const lancer = l => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, PART: l.join(',') } });
  let t = '';
  p.stdout.on('data', x => { t += x; }); p.stderr.on('data', x => process.stderr.write(x));
  p.on('close', code => (code === 0 ? ok(JSON.parse(t)) : ko(new Error(`fils ${code}`))));
});
const lots = Array.from({ length: FILS }, (_, k) => taches.filter((_, i) => i % FILS === k)).filter(l => l.length);
const rendus = (await Promise.all(lots.map(lancer))).flat();
const mesures = rendus.filter(x => 'idx' in x && !('soirs' in x && 'd' in x)).sort((a, b) => taches.indexOf(`p:${a.c}:${a.idx}`) - taches.indexOf(`p:${b.c}:${b.idx}`));
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
  const complets = rendus.filter(x => 'v' in x && !('d' in x));
  const signe = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
  informer('le personnage complet, en victoires sur une saison', complets.map(x => `${COACHS[x.c].ico} ${signe(x.v)}`).join(' · '));
  const trop = complets.filter(x => x.v > COMPLET_MAX_V || x.v < 1);
  exiger(`le personnage complet aide pour de vrai, sans s'emballer (de 1 à ${COMPLET_MAX_V} V)`, !trop.length, trop.map(x => `${COACHS[x.c].nom} ${x.v.toFixed(1)}`).join(', ') || 'tous');
  /* ---------- 3'. chaque adjoint, un style ---------- */
  const adj = rendus.filter(x => 'soirs' in x && 'd' in x);
  const f = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
  for (const m of adj) {
    const x = Object.fromEntries(Object.entries(m.soirs).map(([k, v]) => [k, v / (m.soirs.n || 1)]));
    m.vue = Math.max(Math.abs(x.tp) / VISIBLE.tirs, Math.abs(x.tc) / VISIBLE.tirs, Math.abs(x.tp + x.tc) / VISIBLE.tirs, (Math.abs(x.gf) + Math.abs(x.ga)) / VISIBLE.buts,
      Math.abs(x.pun) / VISIBLE.punitions, Math.abs(x.punEux) / VISIBLE.punitions, Math.abs(x.coups) / VISIBLE.coups, Math.abs(x.bl * 82) / VISIBLE.blessures);
    m.v = (m.d / m.soirs.n) * MATCHS_PAR_SAISON / BUTS_PAR_V;
    const A = ADJOINTS[m.cle];
    informer(`${A.ico} ${A.nom}`.padEnd(26), `par soir : tirs ${f(x.tp)} / ${f(x.tc)} · buts ${f(x.gf, 2)} / ${f(x.ga, 2)} · pun. ${f(x.pun, 2)} / ${f(x.punEux, 2)} · coups ${f(x.coups)} · blessures ${f(x.bl * 82)}/saison · vu ${m.vue.toFixed(1)} · ${f(m.v)} V sur ${Math.round(MATCHS_PAR_SAISON)} matchs`);
  }
  exiger('chaque adjoint en poste est nommé à la feuille, chaque soir', adj.every(m => !m.sansNote), adj.filter(m => m.sansNote).map(m => `${ADJOINTS[m.cle].nom} (${m.sansNote})`).join(', ') || 'tous');
  exiger('chaque adjoint se voit dans la feuille', adj.every(m => m.vue >= 1), adj.filter(m => m.vue < 1).map(m => `${ADJOINTS[m.cle].nom} (${m.vue.toFixed(2)})`).join(', ') || 'tous');
  exiger(`chaque adjoint est un style : ni cadeau ni piège sur une saison (±${String(ECHANGE_V).replace('.', ',')} V)`, adj.every(m => Math.abs(m.v) <= ECHANGE_V), adj.filter(m => Math.abs(m.v) > ECHANGE_V).map(m => `${ADJOINTS[m.cle].nom} ${f(m.v)}`).join(', ') || 'tous');
}

/* ---------- 5. la saison ---------- */
{
  const ligue = () => VESTIAIRES.map((_, i) => club(i));
  const avec = (plus = []) => [{ jour: 0, equipe: 0, coach: { cle: 'essaim', xp: 0, talents: [] } }, { jour: 20, equipe: 0, xpCoach: SEUILS_NIVEAU[2] }, ...plus];
  const joue = decisions => { const t = ligue(); const L = simulateLeague(t, 82, { graine: 'pouvoirs', decisions: decisions.map(d => ({ ...d })) }); return { t, L }; };
  const A = joue(avec()), B = joue(avec());
  const toi = A.t[0];
  const fiche = x => `${x.t[0].W}-${x.t[0].L}-${x.t[0].OTL} ${x.t[0].GF}-${x.t[0].GA} xp ${x.t[0].xpSaison}`;
  exiger('la même graine rejoue le même personnage', fiche(A) === fiche(B), fiche(A));
  exiger('l\'expérience de la saison compte les victoires', toi.xpSaison === toi.W * XP.victoire, `${toi.W} victoires, ${toi.xpSaison} points`);
  // V22 : les adjoints du staff de la V21 sont partis ; leurs décisions, dans une vieille partie, ne changent rien.
  const V = joue(avec([{ jour: 30, equipe: 0, adjoint: { cle: 'numeroUn' } }, { jour: 50, equipe: 0, staff: ['numeroUn'] }, { jour: 60, equipe: 0, perdAdjoint: 'numeroUn' }]));
  exiger('une vieille décision adjoint, staff ou perdAdjoint ne change rien', fiche(V) === fiche(A) && !('adjoints' in toi.perso) && !('staff' in toi.perso), `${fiche(V)} contre ${fiche(A)}`);
  // LE SÉJOUR (V22) : embauché au jour 10, posté au jour 20 : la feuille le nomme exactement SEJOUR matchs (SEJOUR_SYNERGIE chez son coach),
  // puis il revient dans la main avec sa fiche et se repose ; une pose pendant le repos ne fait rien ; la main et les cartes suivent la run.
  const S = joue(avec([{ jour: 10, equipe: 0, embauche: { cle: 'mur' } }, { jour: 10, equipe: 0, embauche: { cle: 'canonnier' } }, { jour: 20, equipe: 0, poste: { cle: 'mur' } }, { jour: 20, equipe: 0, poste: { cle: 'canonnier' } },
    { jour: 60, equipe: 0, poste: { cle: 'mur' } }]));
  const feuilles = S.L.ligue.calendrier.flat().filter(m => (m.A === S.t[0] || m.B === S.t[0]) && m.feuille).map(m => ({ j: S.L.ligue.calendrier.findIndex(d => d.includes(m)), cote: m.A === S.t[0] ? 'A' : 'B', f: m.feuille }));
  const notes = cle => feuilles.filter(x => (x.f.adjoints || []).some(a => a.cote === x.cote && a.cle === cle));
  const nMur = notes('mur'), nCan = notes('canonnier'), premier = feuilles.findIndex(x => x.j >= 20);
  const main = mainDe(S.t[0].perso), mur = main.find(c => c.cle === 'mur');
  // L'expérience du jour 20 ouvre le niveau 3 le jour même : deux cases ; le canonnier, de la voie du Frelon, fait SEJOUR_SYNERGIE.
  exiger(`un séjour joue exactement ${SEJOUR} matchs dès la pose (${SEJOUR_SYNERGIE} chez son coach), et la feuille le nomme`, nMur.length === SEJOUR && feuilles.indexOf(nMur[0]) === premier && feuilles.indexOf(nMur.at(-1)) === premier + SEJOUR - 1,
    `le mur : ${nMur.length} matchs, du ${nMur.length ? nMur[0].j + 1 : '?'}e au ${nMur.length ? nMur.at(-1).j + 1 : '?'}e jour · le canonnier, chez le Frelon : ${nCan.length}`);
  exiger(`chez son coach, le séjour fait ${SEJOUR_SYNERGIE} matchs`, nCan.length === SEJOUR_SYNERGIE, `${nCan.length}`);
  exiger('la carte revient dans la main avec sa fiche, et une pose au repos ne fait rien', !!mur && mur.depuis === null && mur.sejours.length === 1 && mur.sejours[0].v + mur.sejours[0].d + mur.sejours[0].dp === SEJOUR
    && (S.t[0].sejoursFinis || []).some(x => x.cle === 'mur' && x.v === mur.sejours[0].v) && main.length === 2, mur ? `${mur.sejours[0].v}-${mur.sejours[0].d}-${mur.sejours[0].dp}` : 'pas de mur');
  exiger('le séjour change la saison, et la même graine le rejoue pareil', fiche(S) !== fiche(A) && fiche(joue(avec([{ jour: 10, equipe: 0, embauche: { cle: 'mur' } }, { jour: 20, equipe: 0, poste: { cle: 'mur' } }]))) !== fiche(A), `${fiche(S)} contre ${fiche(A)}`);
}

verdict('Les pouvoirs du coach et sa main d\'adjoints');
