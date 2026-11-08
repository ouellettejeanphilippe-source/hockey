/*
 * LE BANC DE CINQ (V27, tranche 5 ; docs/refonte-v27.md § 4.6, § 5, § 10 ; docs/refonte-v27-5a.md — js/pieces.js). Les
 * pouvoirs du coach et les adjoints sont devenus une seule famille, *PIECES* : cinq cases pour la run, sans séjour, repos,
 * salaire ni niveau. Ce juge les réécrit tous (ses bornes de 2,5 V, 4 V et 16 V sur une saison sont parties avec eux).
 * Ce qu'on exige :
 *   1. les tables : chaque pièce a son icône, son nom, sa condition en mots et en fonction, une réplique sans chiffre, des
 *      canaux que le moteur connaît, trois au plus de son côté, deux de l'autre, un relais sur un de SES canaux ; chaque
 *      coach a sa pièce de départ, de sa philosophie ; l'arbitre seul est hors des voies ;
 *   2. le banc, pur : une pièce entre dans la première case libre, jamais deux fois ; plein, elle prend la case de celle qui
 *      sort, et sans elle rien ne bouge ; trois offertes, pures, jamais une déjà posée, celles du rival battu de la
 *      philosophie du coach et de ses voisines ; la maîtrise ne règle que la pièce de départ ; les vrais entraîneurs ;
 *   3. LA PRÉSENCE (§ 4.6) : sur des saisons de run (le robot attentif), chaque pièce se lit 30 à 50 % des soirs (`PRESENCE`), sauf celles d'un
 *      moment rare (`rare` : les séries, le gros match) ;
 *   4. EN PAIRES, match par match (CLAUDE.md) : deux copies d'un même vrai club, le même match sur les mêmes dés, une fois
 *      avec un banc vide (trois périodes, aucune pièce), une fois avec la pièce seule. Chaque pièce :
 *        a. joue exactement les périodes que sa condition lit dans la feuille (la pièce de la soirée, les trois) ;
 *        b. hors de ses périodes, rien : un match où elle ne joue pas rend la même feuille ;
 *        c. se voit dans la feuille d'un soir où elle joue (±2 tirs, ±0,3 but, ±0,5 punition, ±4 mises en échec, ±3
 *           blessures par saison) ;
 *        d. sur un acte (`ACTE` matchs, à sa présence), n'est jamais un piège (au-dessus de `PIEGE_V`) et rend au plus le
 *           net d'un pouvoir d'avant sur la même durée (`BORNE_ACTE_V` ; l'ultime, son cadre de ★ Phénomène,
 *           `BORNE_ULTIME_V`) : le net d'un adjoint d'aujourd'hui, × 1, jamais × 2,7 (§ 4.6) ;
 *   5. le banc complet (cinq pièces d'un coach) rend au plus `BANC_MAX_V` sur un acte contre un banc vide, et aide ;
 *   6. la saison : la même graine rejoue le même banc ; le coach pose sa pièce de départ ; une décision `piece` entre, le
 *      banc plein laisse partir `sort` ; une vieille décision (`talent`, `xpCoach`, `embauche`, `poste`, `adjoint`,
 *      `staff`, `perdAdjoint`) ne change rien ; la feuille nomme la pièce aux soirs où elle joue.
 * `N` : matchs par club et par pièce (600, quelques minutes sur `FILS` processus). `PIECES=a,b` : quelques pièces.
 * `MESURE=0 N=20` (la CI, une demi-minute) : 1, 2, a, b et 6, sans les chiffres de valeur ni la présence.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, simulateLeague, MOMENTS_SI } from '../js/sim.js';
import { PIECES, PIECE_DU_COACH, CASES_DU_BANC, PIECES_OFFERTES, bancDe, poserLaPiece, piecesOffertes, forceDeLaPiece, bancPlein } from '../js/pieces.js';
import { maitriseDu, niveauDuCoach, carteDuCoach, lotoDesCoachs, DU_CARTABLE } from '../js/coachs-reels.js';
import { NIVEAUX } from '../js/niveaux.js';
import { COACHS, VOIES } from '../js/coachs.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { jouerSaison, shard, metaAuNiveau } from './lib/rogue_sim.mjs';
import { NIVEAUX_PLEINS } from '../js/rogue.js';
import { exiger, informer, verdict } from './verdict.mjs';
import '../js/greffes.js';   // V25 : les greffes du Rogue se branchent sur le moteur

const N = Number(process.env.N ?? 600);
/* `MESURE=0` (la CI) : les périodes, la feuille hors des soirs et la saison, sans les chiffres de valeur ni les bornes, que le bruit d'un petit N fausserait. */
const MESURE = process.env.MESURE !== '0';
const FILS = Math.max(1, Number(process.env.FILS ?? 4)), ICI = fileURLToPath(import.meta.url);
const QUELLES = process.env.PIECES ? process.env.PIECES.split(',') : Object.keys(PIECES);
const VISIBLE = { tirs: 2, buts: 0.3, punitions: 0.5, coups: 4, blessures: 3 };
/*
 * LES BORNES D'UNE PIÈCE, sur un acte de `ACTE` matchs (devis § 4.6 et § 5). Un pouvoir I ou II d'avant restait sous 2,5 V
 * sur une saison, l'ultime sous 4 V ; ramenés à un acte au même rythme, 2,5 × 27 / 82 et 4 × 27 / 82. Un adjoint d'avant
 * au ★ Étoile (±2,5 V sur ses matchs joués) donne le même plafond : c'est « le net d'un adjoint d'aujourd'hui sur la même
 * durée ». Jamais un piège : au-dessus de −0,5 V sur l'acte. Le banc complet : au plus +5 V sur l'acte (§ 5).
 */
const ACTE = 27, BUTS_PAR_V = 6;
const BORNE_ACTE_V = 2.5 * ACTE / 82, BORNE_ULTIME_V = 4 * ACTE / 82, PIEGE_V = -0.5, BANC_MAX_V = 5;
/* La présence (§ 4.6) : 30 à 50 % des soirs. */
const PRESENCE = [0.3, 0.5];
const CANAUX = new Set(['volume', 'finition', 'defense', 'discipline', 'blessure', 'robustesse', 'F', 'energie']);
const GENRES = new Set(['attaque', 'defense', 'tactique', 'synergie']);
const somme = a => (a || []).reduce((x, y) => x + y, 0);
const f1 = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;

/* ---------- 1. les tables ---------- */
{
  const fautes = [];
  for (const [k, P] of Object.entries(PIECES)) {
    if (!P.ico || !P.nom || !P.quandMot || !P.dit || /\d/.test(P.dit) || typeof P.quand !== 'function') fautes.push(`${k} : la forme`);
    if (!GENRES.has(P.genre) || !(P.cadre >= 0 && P.cadre <= 4)) fautes.push(`${k} : le genre ou le cadre`);
    const canaux = [...Object.keys(P.canaux || {}), ...Object.keys(P.adv || {})];
    if (!canaux.length || canaux.some(c => !CANAUX.has(c)) || Object.keys(P.canaux || {}).length > 3 || Object.keys(P.adv || {}).length > 2) fautes.push(`${k} : ${canaux.join(', ')}`);
    if (P.voie ? !COACHS[P.voie] : k !== 'arbitre') fautes.push(`${k} : sa voie`);
    if (P.relais && (!P.relais.mot || typeof P.relais.quand !== 'function' || !(P[P.relais.cote] && P[P.relais.cote][P.relais.canal] != null))) fautes.push(`${k} : son relais`);
  }
  exiger(`${Object.keys(PIECES).length} pièces, chacune une condition en mots, une réplique sans chiffre, des canaux connus, un relais sur un de ses canaux`, !fautes.length && Object.keys(PIECES).length >= 30,
    fautes.slice(0, 4).join(' · ') || Object.values(PIECES).map(P => P.ico).join(''));
  exiger('chaque coach a sa pièce de départ, de sa philosophie', VOIES.every(c => PIECES[PIECE_DU_COACH[c]] && PIECES[PIECE_DU_COACH[c]].voie === c) && Object.keys(PIECE_DU_COACH).length === VOIES.length,
    VOIES.map(c => `${COACHS[c].ico}${PIECES[PIECE_DU_COACH[c]] ? PIECES[PIECE_DU_COACH[c]].ico : '?'}`).join(' '));
}

/* ---------- 2. le banc, pur ---------- */
{
  const b1 = poserLaPiece(['verrou'], 'mur'), b2 = poserLaPiece(b1, 'mur'), plein = ['verrou', 'mur', 'ruee', 'tueur', 'choc'];
  exiger(`${CASES_DU_BANC} cases : une pièce entre dans la première libre, jamais deux fois ; plein, elle prend la case de celle qui sort, sans elle rien ne bouge`,
    b1.join() === 'verrou,mur' && b2.join() === b1.join() && poserLaPiece(plein, 'duo', 'ruee').join() === 'verrou,mur,duo,tueur,choc'
    && poserLaPiece(plein, 'duo').join() === plein.join() && poserLaPiece(plein, 'duo', 'inconnue').join() === plein.join() && poserLaPiece(['verrou'], 'inconnue').join() === 'verrou'
    && bancPlein({ banc: plein }) && !bancPlein({ banc: b1 }) && bancDe({ banc: [...plein, 'duo'] }).length === CASES_DU_BANC, poserLaPiece(plein, 'duo', 'ruee').join(' · '));
  const P = { cle: 'tortue', banc: ['verrou', 'mur'] };
  const a = piecesOffertes(P, 'g', 'bq14'), b = piecesOffertes(P, 'g', 'bq14');
  const autres = new Set(Array.from({ length: 40 }, (_, g) => piecesOffertes(P, `g${g}`, 'bq14').join()));
  exiger(`${PIECES_OFFERTES} pièces offertes, pures, distinctes, jamais une déjà sur le banc ; deux graines n'offrent pas les mêmes`,
    a.length === PIECES_OFFERTES && a.join() === b.join() && new Set(a).size === a.length && !a.some(k => P.banc.includes(k)) && autres.size > 10, `${a.join(', ')} · ${autres.size} offres sur 40 graines`);
  const voisines = Array.from({ length: 60 }, (_, g) => piecesOffertes(P, `g${g}`, 'r:26', undefined, { voisines: true })).flat();
  const i = VOIES.indexOf('tortue'), permises = new Set([VOIES[i], VOIES[(i + 1) % VOIES.length], VOIES[(i + VOIES.length - 1) % VOIES.length], null]);
  exiger('le rival battu offre les pièces de la philosophie du coach et de ses voisines', voisines.every(k => permises.has(PIECES[k].voie)) && new Set(voisines.map(k => PIECES[k].voie)).size >= 3,
    [...new Set(voisines.map(k => PIECES[k].voie || 'hors des voies'))].join(', '));
  exiger('la maîtrise de l\'entraîneur règle sa pièce de départ seule, de ×0,9 à ×1,3', forceDeLaPiece({ cle: 'tortue', maitrise: 1.2 }, 'verrou') === 1.2 && forceDeLaPiece({ cle: 'tortue', maitrise: 1.2 }, 'mur') === 1
    && forceDeLaPiece({ cle: 'tortue', maitrise: 2 }, 'verrou') === 1.3 && forceDeLaPiece({ cle: 'tortue', maitrise: 0.5 }, 'verrou') === 0.9);
}

/* ---------- 2b. les vrais entraîneurs (js/coachs-reels.js, data/coachs.json) ---------- */
{
  const donnees = JSON.parse(fs.readFileSync(new URL('../data/coachs.json', import.meta.url), 'utf8'));
  const index = JSON.parse(fs.readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).seasons;
  const cartes = Object.entries(donnees).flatMap(([saison, clubs]) => Object.keys(clubs).map(tag => carteDuCoach(donnees, saison, tag)));
  const fautes = cartes.filter(c => !c || !c.n || !PIECE_DU_COACH[c.cle] || !(c.rang >= 1) || c.maitrise < NIVEAUX[0].maitrise || c.maitrise > NIVEAUX[4].maitrise || c.maitrise !== maitriseDu(c.rang) || !(c.fiche.gp > 0));
  exiger('un vrai entraîneur pour chaque club de chaque saison, une philosophie connue', !fautes.length && index.every(s => donnees[s]) && cartes.length > 1000,
    `${cartes.length} cartes · ${VOIES.map(k => `${k} ${cartes.filter(c => c.cle === k).length}`).join(' · ')}`);
  const bowman = carteDuCoach(donnees, '1976-77', 'MTL');
  exiger('Scotty Bowman, Canadiens 1976-77 : sa fiche, sa Coupe, son Jack Adams', bowman && bowman.n === 'Scotty Bowman' && bowman.fiche.v === 60 && bowman.coupe && bowman.jack, bowman ? `${bowman.n} · ${bowman.cle} · ${bowman.rang}e · ×${bowman.maitrise}` : 'absent');
  exiger('la maîtrise suit le niveau : ★ Phénomène ×1,3 au 1er rang, ★ Étoile ×1,2 aux 3 premiers, Pilier ×1,1 aux 8, Régulier ×1 aux 16, Soutien ×0,9 ensuite',
    [[1, 5, 1.3], [2, 4, 1.2], [3, 4, 1.2], [4, 3, 1.1], [8, 3, 1.1], [9, 2, 1], [16, 2, 1], [17, 1, 0.9], [32, 1, 0.9]].every(([r, n, m]) => niveauDuCoach(r) === n && maitriseDu(r) === m));
  const ouverts = ['tortue', 'essaim', 'rhinos'];
  const a = lotoDesCoachs(donnees, ouverts, 'g'), b = lotoDesCoachs(donnees, ouverts, 'g'), c = lotoDesCoachs(donnees, ouverts, 'h');
  exiger('le loto de l\'entraîneur : trois cartes, trois philosophies ouvertes, pur', a.length === 3 && new Set(a.map(x => x.cle)).size === 3 && a.every(x => ouverts.includes(x.cle))
    && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), a.map(x => `${x.n} ${x.saison} ${x.tag}`).join(' · '));
  const siens = { [a[0].id]: { r: 3 }, [a[1].id]: { r: 1 }, [a[2].id]: { r: 2 } };
  const d = lotoDesCoachs(donnees, ouverts, 'h', 3, siens);
  exiger(`le loto tire d'abord dans ton cartable, les moins jouées, ${DU_CARTABLE} au plus, et une carte neuve`,
    d.length === 3 && d.filter(x => !x.neuf).length === DU_CARTABLE && d.filter(x => !x.neuf).every(x => siens[x.id]) && d.some(x => x.neuf && !siens[x.id])
    && d.find(x => !x.neuf).id === a[1].id && new Set(d.map(x => x.cle)).size === 3, d.map(x => `${x.n} ${x.saison}${x.neuf ? ' (neuve)' : ''}`).join(' · '));
}

/* ---------- les matchs en paires ---------- */
const VESTIAIRES = TEMOINS.map(([lab, s, t]) => [lab, s, t, equipeReelle(s, t)]);
const club = i => { const [lab, s, t, un] = VESTIAIRES[i]; const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(lab, t, autoRoster(p), { season: s }); };
const MUET = { cle: '__muet', banc: [] };
/*
 * Un match isolé : des clubs neufs, les dés de la graine. `soir` : un moment posé pour la lecture (`_lireMoment`) ;
 * `series` : un match de séries. Rend la feuille et les chiffres de ton club.
 */
function match(i, j, graine, visiteur, perso, { soir = null, series = false, aux = false } = {}) {
  const toi = club(i), adv = club(j);
  toi.luck = 0; adv.luck = 0;
  toi.perso = perso;
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
/* Ce que la condition d'une pièce lit avant la période `k`, relu dans la feuille. */
function etatLu(f, moi, k, series) {
  const eux = moi === 'A' ? 'B' : 'A';
  const buts = (c, a, b) => f.buts.filter(x => x.cote === c && x.instant >= a && x.instant < b).length;
  let tirsMoi = 0, tirsLui = 0;
  for (let i = 1; i <= k; i++) { tirsMoi += f.tirs[moi][i]; tirsLui += f.tirs[eux][i]; }
  const der = k ? { tirsMoi: f.tirs[moi][k], tirsLui: f.tirs[eux][k], moi: buts(moi, 20 * (k - 1), 20 * k), lui: buts(eux, 20 * (k - 1), 20 * k) } : null;
  const soir = Object.fromEntries((f.moments ? f.moments[moi] : []).map(x => [x, true]));
  return { k, moi: buts(moi, 0, 20 * k), lui: buts(eux, 0, 20 * k), tirsMoi, tirsLui, der, series, gros: false, soir, pieces: [], relais: [] };
}
/* Le moment du soir qu'une pièce lit (`dosADos`, `apresDefaite`…), s'il en faut un : la mesure le pose, sinon elle ne jouerait jamais dans un match isolé. */
const ETATS = [0, 1, 2].flatMap(k => [[0, 0], [1, 0], [0, 1], [2, 0], [0, 2]].map(([moi, lui]) => ({ k, moi, lui, tirsMoi: 9, tirsLui: 10, der: k ? { tirsMoi: 8, tirsLui: 10, moi: 0, lui: 0 } : null, series: false, gros: false, pieces: [], relais: [] })));
const momentDe = P => {
  if (ETATS.some(e => P.quand({ ...e, soir: {} }))) return null;
  return Object.keys(MOMENTS_SI).filter(m => !MOMENTS_SI[m].duel && !['domicile', 'visiteur', 'series'].includes(m)).find(m => ETATS.some(e => P.quand({ ...e, soir: { [m]: true } }))) || null;
};
/* Le soir d'un match isolé : à l'étranger un soir sur deux, des séries sur huit ; le moment de la pièce, posé. */
const soirDuMatch = (g, P) => ({ visiteur: g % 2 === 1, soir: momentDe(P), series: P.rare ? Math.floor(g / 2) % 2 === 0 : Math.floor(g / 2) % 8 === 3, aux: Math.floor(g / 4) % 4 === 2 });
/* Une pièce seule, en paires contre le banc vide, `n` matchs par club : ses périodes, ses soirs, ses chiffres. */
function mesurerPiece(cle, n) {
  const P = PIECES[cle], perso = { cle: '__muet', banc: [cle] };
  const m = { cle, n: 0, fois: 0, soirs: 0, faux: 0, horsDiff: 0, dgfSoir: 0, dgaSoir: 0, dbl: 0, sv: { tp: 0, tc: 0, gf: 0, ga: 0, pun: 0, punEux: 0, coups: 0 } };
  for (let i = 0; i < VESTIAIRES.length; i++) for (let g = 0; g < n; g++) {
    const j = (i + 1 + (g % (VESTIAIRES.length - 1))) % VESTIAIRES.length;
    const o = soirDuMatch(g, P), graine = `pc${cle}:${i}:${g}`;
    const a = match(i, j, graine, o.visiteur, MUET, o), b = match(i, j, graine, o.visiteur, perso, o);
    m.n++;
    const notes = b.f.pieces.filter(x => x.cote === b.moi && x.cle === cle).map(x => x.k);
    // a. Les périodes jouées sont celles que la condition lit.
    const attendues = [0, 1, 2].filter(k => P.quand(etatLu(b.f, b.moi, k, o.series)));
    if (notes.join() !== attendues.join()) m.faux++;
    m.fois += notes.length;
    // Son relais joue aussi ses périodes (son signal, pas sa condition) : un soir sans l'une ni l'autre, rien.
    const relaie = b.f.relais.some(x => x.cote === b.moi && x.cle === cle);
    if (!notes.length && !relaie) {
      // b. Hors de ses périodes, la même feuille.
      if (JSON.stringify([a.gf, a.ga, a.f.tirs, a.pun, a.punEux, a.coups]) !== JSON.stringify([b.gf, b.ga, b.f.tirs, b.pun, b.punEux, b.coups])) m.horsDiff++;
    } else if (notes.length) {
      m.soirs++;
      for (const k of Object.keys(m.sv)) m.sv[k] += b[k] - a[k];
      m.dbl += b.bl - a.bl;
    }
  }
  return m;
}
/* LE BANC COMPLET d'un coach : sa pièce de départ, les deux autres de sa voie, sa pièce d'adjoint et l'arbitre ; en paires contre le banc vide. */
const bancComplet = c => [PIECE_DU_COACH[c], ...Object.keys(PIECES).filter(k => PIECES[k].voie === c && k !== PIECE_DU_COACH[c]), 'arbitre'].slice(0, CASES_DU_BANC);
/* Les moments que le banc complet voit, à peu près comme une saison : un dos-à-dos, une défaite, trois victoires, une infirmerie pleine sur huit soirs chacun. */
const MOMENTS_DU_BANC = [null, 'dosADos', null, 'apresDefaite', null, 'enFeu', 'infirmerie', 'apresDefaite'];
function mesurerBanc(c, n) {
  const perso = { cle: c, banc: bancComplet(c), maitrise: 1 };
  let k = 0, d = 0;
  for (let i = 0; i < VESTIAIRES.length; i++) for (let g = 0; g < n; g++) {
    const j = (i + 1 + (g % (VESTIAIRES.length - 1))) % VESTIAIRES.length;
    const o = { visiteur: g % 2 === 1, soir: MOMENTS_DU_BANC[Math.floor(g / 2) % MOMENTS_DU_BANC.length], series: Math.floor(g / 2) % 8 === 3 }, graine = `bc${c}:${i}:${g}`;
    const a = match(i, j, graine, o.visiteur, MUET, o), b = match(i, j, graine, o.visiteur, perso, o);
    k++; d += (b.gf - b.ga) - (a.gf - a.ga);
  }
  return { c, v: (d / k) * ACTE / BUTS_PAR_V };
}
// UN FILS : ses tâches (« p:cle », « b:coach »), rendues en JSON.
if (process.env.PART) {
  const out = process.env.PART.split(',').map(t => { const [s, x] = t.split(':'); return s === 'p' ? mesurerPiece(x, N) : mesurerBanc(x, N); });
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

/* ---------- 3. la présence, sur des saisons jouées ---------- */
/*
 * Des saisons de run (le robot attentif, un club de 2005-06 par graine, comme check_moments_si : ses jambes, ses défaites et
 * son infirmerie sont celles d'une vraie saison) : chaque soir de ton club, la condition de chaque pièce relue dans sa
 * feuille, période par période. Une pièce « joue un soir » si elle se lit à une période au moins.
 */
function presences(graines) {
  const soirs = new Map(Object.keys(PIECES).map(k => [k, 0]));
  let total = 0;
  const clubs = Object.values(shard('2005-06').byTeam).filter(ps => ps.length >= 23);
  for (const g of graines) {
    const etat = { roster: autoRoster(clubs[g % clubs.length].filter(p => (p.gp || 0) >= 10).map(p => ({ ...p }))), variantes: new Map(), jetons: 0 };
    const r = jouerSaison(metaAuNiveau(0), etat, { graine: g, saison: 1, politique: 'attentif', ligue: NIVEAUX_PLEINS });
    for (const jour of r.L.calendrier) for (const m of jour) {
      if (!m.feuille || (m.A !== r.you && m.B !== r.you)) continue;
      const moi = m.A === r.you ? 'A' : 'B';
      total++;
      for (const k of Object.keys(PIECES)) if ([0, 1, 2].some(q => PIECES[k].quand(etatLu(m.feuille, moi, q, false)))) soirs.set(k, soirs.get(k) + 1);
    }
  }
  return new Map([...soirs].map(([k, n]) => [k, n / Math.max(1, total)]));
}

console.log(`\n  Le banc de cinq (V27) · ${N} matchs par club et par pièce${MESURE ? '' : ' · sans les bornes'}\n`);
const taches = [...QUELLES.map(k => `p:${k}`), ...(MESURE ? VOIES.map(c => `b:${c}`) : [])];
/* Une tâche par processus, `FILS` à la fois : la mémoire d'un fils ne grandit pas avec le nombre de tâches. */
const lancer = l => new Promise((ok, ko) => {
  const p = spawn(process.execPath, ['--max-old-space-size=2048', ICI], { env: { ...process.env, PART: l.join(',') } });
  let t = '';
  p.stdout.on('data', x => { t += x; }); p.stderr.on('data', x => process.stderr.write(x));
  p.on('close', code => (code === 0 ? ok(JSON.parse(t)) : ko(new Error(`fils ${code}`))));
});
const file = [...taches], faits = [];
await Promise.all(Array.from({ length: Math.min(FILS, file.length) }, async () => { while (file.length) faits.push(...await lancer([file.shift()])); }));
const rendus = faits;
const mesures = rendus.filter(x => 'cle' in x).sort((a, b) => QUELLES.indexOf(a.cle) - QUELLES.indexOf(b.cle));
const pres = MESURE ? presences([1, 2, 3]) : null;
const nomDe = m => `${PIECES[m.cle].ico} ${PIECES[m.cle].nom}`;
for (const m of mesures) {
  const s = m.soirs || 1;
  m.vue = Math.max(Math.abs(m.sv.tp / s) / VISIBLE.tirs, Math.abs(m.sv.tc / s) / VISIBLE.tirs, Math.abs((m.sv.tp + m.sv.tc) / s) / VISIBLE.tirs, (Math.abs(m.sv.gf / s) + Math.abs(m.sv.ga / s)) / VISIBLE.buts,
    Math.abs(m.sv.pun / s) / VISIBLE.punitions, Math.abs(m.sv.punEux / s) / VISIBLE.punitions, Math.abs(m.sv.coups / s) / VISIBLE.coups, Math.abs((m.dbl / s) * 82) / VISIBLE.blessures);
  // Le net d'un soir où elle joue, ramené à un acte à sa présence (`pres`) : ce que la pièce rend sur la durée d'un acte.
  m.parSoir = (m.sv.gf - m.sv.ga) / s;
  m.presence = pres ? pres.get(m.cle) : null;
  m.vActe = m.presence == null ? null : (m.parSoir * m.presence * ACTE) / BUTS_PAR_V;
  if (MESURE) informer(nomDe(m).padEnd(26), `${m.presence == null ? '' : `${Math.round(m.presence * 100)} % des soirs · `}le soir où elle joue : tirs ${f1(m.sv.tp / s)} / ${f1(m.sv.tc / s)} · buts ${f1(m.sv.gf / s, 2)} / ${f1(m.sv.ga / s, 2)} · pun. ${f1(m.sv.pun / s, 2)} / ${f1(m.sv.punEux / s, 2)} · coups ${f1(m.sv.coups / s)} · blessures ${f1((m.dbl / s) * 82)}/saison · ${m.vActe == null ? '' : `${f1(m.vActe, 2)} V sur un acte`}`);
}
exiger('a. chaque pièce joue exactement les périodes que sa condition lit dans la feuille', mesures.every(m => !m.faux), mesures.filter(m => m.faux).map(m => `${nomDe(m)} (${m.faux})`).join(', ') || `${mesures.reduce((x, m) => x + m.fois, 0)} périodes jouées`);
exiger('b. hors de ses périodes, rien : la même feuille', mesures.every(m => !m.horsDiff), mesures.filter(m => m.horsDiff).map(m => `${nomDe(m)} (${m.horsDiff})`).join(', ') || 'aucune feuille changée');
exiger('chaque pièce joue des soirs', mesures.every(m => m.soirs > 0), mesures.filter(m => !m.soirs).map(nomDe).join(', ') || 'toutes');
if (MESURE) {
  const horsBande = mesures.filter(m => !PIECES[m.cle].rare && (m.presence < PRESENCE[0] || m.presence > PRESENCE[1]));
  exiger(`3. chaque pièce se lit ${PRESENCE[0] * 100} à ${PRESENCE[1] * 100} % des soirs (sauf un moment rare)`, !horsBande.length, horsBande.map(m => `${nomDe(m)} ${Math.round(m.presence * 100)} %`).join(', ') || 'toutes');
  exiger('c. chaque pièce se voit dans la feuille d\'un soir où elle joue', mesures.every(m => m.vue >= 1), mesures.filter(m => m.vue < 1).map(m => `${nomDe(m)} (${m.vue.toFixed(2)})`).join(', ') || 'toutes');
  const borne = m => (PIECES[m.cle].cadre === 4 ? BORNE_ULTIME_V : BORNE_ACTE_V);
  exiger(`d. sur un acte, une pièce rend au plus le net d'un pouvoir d'avant sur la même durée (${f1(BORNE_ACTE_V, 2)} V ; l'ultime, ${f1(BORNE_ULTIME_V, 2)} V)`, mesures.every(m => m.vActe <= borne(m)),
    mesures.filter(m => m.vActe > borne(m)).map(m => `${nomDe(m)} ${f1(m.vActe, 2)}`).join(', ') || 'toutes');
  exiger(`d. aucune pièce n'est un piège (au-dessus de ${f1(PIEGE_V, 1)} V sur un acte)`, mesures.every(m => m.vActe >= PIEGE_V), mesures.filter(m => m.vActe < PIEGE_V).map(m => `${nomDe(m)} ${f1(m.vActe, 2)}`).join(', ') || 'aucune');
  /* ---------- 5. le banc complet ---------- */
  const bancs = rendus.filter(x => 'c' in x);
  informer('le banc complet de chaque coach, en victoires sur un acte', bancs.map(x => `${COACHS[x.c].ico} ${f1(x.v)}`).join(' · '));
  const trop = bancs.filter(x => x.v > BANC_MAX_V || x.v < 0);
  exiger(`5. le banc complet aide pour de vrai, sans s'emballer (de 0 à ${BANC_MAX_V} V sur un acte)`, !trop.length, trop.map(x => `${COACHS[x.c].nom} ${f1(x.v)}`).join(', ') || 'tous');
}

/* ---------- 6. la saison ---------- */
{
  const ligue = () => VESTIAIRES.map((_, i) => club(i));
  const avec = (plus = []) => [{ jour: 0, equipe: 0, coach: { cle: 'essaim', maitrise: 1.1 } }, ...plus];
  const joue = decisions => { const t = ligue(); const L = simulateLeague(t, 82, { graine: 'banc', decisions: decisions.map(d => ({ ...d })), courbe: true }); return { t, L }; };
  const fiche = x => `${x.t[0].W}-${x.t[0].L}-${x.t[0].OTL} ${x.t[0].GF}-${x.t[0].GA} ${bancDe(x.t[0].perso).join(',')}`;
  const A = joue(avec()), B = joue(avec());
  exiger('la même graine rejoue le même banc', fiche(A) === fiche(B), fiche(A));
  exiger('le coach pose sa pièce de départ dans la première case, à sa maîtrise', bancDe(A.t[0].perso).join() === PIECE_DU_COACH.essaim && A.t[0].perso.maitrise === 1.1, bancDe(A.t[0].perso).join());
  const V = joue(avec([{ jour: 10, equipe: 0, talent: { p: 0 } }, { jour: 20, equipe: 0, xpCoach: 25 }, { jour: 30, equipe: 0, embauche: { cle: 'mur' } }, { jour: 31, equipe: 0, poste: { cle: 'mur' } },
    { jour: 40, equipe: 0, adjoint: { cle: 'numeroUn' } }, { jour: 50, equipe: 0, staff: ['numeroUn'] }, { jour: 60, equipe: 0, perdAdjoint: 'numeroUn' }]));
  exiger('une vieille décision talent, xpCoach, embauche, poste, adjoint, staff ou perdAdjoint ne change rien', fiche(V) === fiche(A), `${fiche(V)} contre ${fiche(A)}`);
  // UNE PIÈCE POSÉE au jour 20 : elle joue dès son jour, aux soirs que sa condition lit, et la feuille la nomme ; le banc plein, `sort` part.
  const S = joue(avec([{ jour: 20, equipe: 0, piece: { cle: 'canonnier' } }, { jour: 21, equipe: 0, piece: { cle: 'mur' } }, { jour: 22, equipe: 0, piece: { cle: 'tueur' } }, { jour: 23, equipe: 0, piece: { cle: 'choc' } },
    { jour: 60, equipe: 0, piece: { cle: 'verrou' } }, { jour: 61, equipe: 0, piece: { cle: 'verrou', sort: 'mur' } }]));
  const toi = S.t[0];
  const feuilles = S.L.ligue.calendrier.flatMap((d, j) => d.filter(m => (m.A === toi || m.B === toi) && m.feuille).map(m => ({ j, cote: m.A === toi ? 'A' : 'B', f: m.feuille })));
  const chez = x => x.cote === 'A' && !x.f.moments[x.cote].includes('dosADos');
  const canon = feuilles.filter(x => x.f.pieces.some(n => n.cote === x.cote && n.cle === 'canonnier'));
  exiger('une pièce posée joue dès son jour, aux soirs que sa condition lit (le canonnier : à domicile, sans dos-à-dos), et la feuille la nomme',
    canon.length > 0 && canon.every(x => x.j >= 20 && chez(x)) && feuilles.filter(x => x.j >= 20 && chez(x)).every(x => canon.includes(x)), `${canon.length} soirs`);
  exiger('plein, une pièce neuve sans `sort` n\'entre pas ; avec, elle prend la case de celle qui part', bancDe(toi.perso).join() === 'ruee,canonnier,verrou,tueur,choc'
    && feuilles.every(x => (x.f.banc[x.cote] || []).length <= CASES_DU_BANC), bancDe(toi.perso).join(', '));
  exiger('la feuille garde le banc de chaque soir', feuilles.filter(x => x.j < 20).every(x => x.f.banc[x.cote].join() === 'ruee') && feuilles.filter(x => x.j > 61).every(x => x.f.banc[x.cote].join() === bancDe(toi.perso).join()),
    `${feuilles.length} feuilles`);
  exiger('le banc change la saison, et la même graine le rejoue pareil', fiche(S) !== fiche(A) && fiche(joue(avec([{ jour: 20, equipe: 0, piece: { cle: 'canonnier' } }]))) !== fiche(A), `${fiche(S)} contre ${fiche(A)}`);
}

verdict('Le banc de cinq');
