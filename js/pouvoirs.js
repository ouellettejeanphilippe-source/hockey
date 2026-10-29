/*
 * LE COACH, UN PERSONNAGE (V21, docs/refonte-v21.md ; JP : *coach-personnage à la Hades*). Pur : le moteur (js/sim.js)
 * et l'écran (js/rogue-jeu.js) lisent les mêmes tables et les mêmes fonctions.
 *
 *   LE NIVEAU     de 1 à 5, gagné en jouant (`XP`, `SEUILS_NIVEAU`) ; il suit la run d'une saison à l'autre
 *   L'ARBRE       trois pouvoirs par coach, ouverts aux niveaux 1, 3 et 5 (`NIVEAU_DES_POUVOIRS`)
 *   LES TALENTS   aux niveaux 2 et 4, un pouvoir débloqué grandit de moitié (`TALENT`)
 *   LES BIENFAITS un adjoint modifie un pouvoir (`BIENFAITS`) ; deux au plus par pouvoir
 *
 * UN POUVOIR SE JOUE PÉRIODE PAR PÉRIODE. Avant chaque période, il lit ce qui est déjà joué (`etat` : la période `k`,
 * le pointage, les tirs, la dernière période, le soir) et, s'il se déclenche, frappe la période qui vient sur les
 * canaux que le moteur connaît : `effet` sur ton club, `adv` sur l'adversaire. La feuille le garde.
 */

import { hache } from './util.js';

/* ---------- le niveau ---------- */
export const XP = { victoire: 1, gros: 2, serie: 5 };
export const SEUILS_NIVEAU = [0, 10, 25, 45, 70];
export const NIVEAU_MAX = SEUILS_NIVEAU.length;
export const niveauDe = xp => SEUILS_NIVEAU.filter(s => (xp || 0) >= s).length;
/* Ce qu'il manque pour le niveau suivant (null au dernier). */
export const xpAvantProchain = xp => { const s = SEUILS_NIVEAU.find(x => (xp || 0) < x); return s == null ? null : s - (xp || 0); };
export const NIVEAU_DES_POUVOIRS = [1, 3, 5];
const NIVEAUX_TALENT = [2, 4];
export const TALENT = 0.5;
/* Les pouvoirs ouverts à un niveau : leurs index (0, 1, 2). */
export const pouvoirsOuverts = niveau => NIVEAU_DES_POUVOIRS.map((n, i) => (niveau >= n ? i : -1)).filter(i => i >= 0);
/* Les talents dus à un niveau, moins ceux déjà pris. */
export const talentsDus = (niveau, pris = []) => Math.max(0, NIVEAUX_TALENT.filter(n => niveau >= n).length - pris.length);

/* ---------- les pouvoirs ---------- */
/*
 * `quand(e)` : se déclenche-t-il avant la période `e.k` ? `tot(e)` : la même lecture, avec le bienfait « plus tôt ».
 * `e` : { k, moi, lui (buts), tirsMoi, tirsLui, der: { moi, lui, tirsMoi, tirsLui } | null (la période d'avant),
 * series, gros, soir (les moments du soir, `MOMENTS_SI`) }. `defense` : un pouvoir qui protège (le bienfait payant
 * paie les périodes sans but contre plutôt que les buts).
 */
const k3 = e => e.k === 2;
const mene = e => e.moi > e.lui;
const derriere = e => e.moi < e.lui;
const serre = e => Math.abs(e.moi - e.lui) <= 1;
const perduAuxTirs = e => !!e.der && e.der.tirsMoi < e.der.tirsLui;
const soirDe = (e, ...ms) => !!e.soir && ms.some(m => e.soir[m]);

/*
 * LA MESURE (`check_pouvoirs`) : un pouvoir joue à peu près un soir sur deux, et le soir où il joue, il se voit dans la
 * feuille (deux tirs, trois dixièmes de but, une demi-punition) ; seul, il reste sous sa borne (I et II : 2,5 victoires
 * sur une saison ; l'ultime : 4). Un pouvoir de tous les soirs ne peut pas être les deux : il se voit à +4 victoires.
 */
export const POUVOIRS = {
  essaim: [
    { cle: 'ruee', ico: '🐝', nom: 'La ruée', dit: 'En 3e période, à égalité ou derrière : +40 % de tirs.', quand: e => k3(e) && e.moi <= e.lui, tot: e => e.k >= 1 && e.moi <= e.lui, effet: { volume: 1.4 } },
    { cle: 'bourdon', ico: '🔊', nom: 'Le bourdonnement', dit: 'En 3e période, avec plus de tirs qu\'eux jusque-là : +25 % de tirs.', quand: e => k3(e) && e.tirsMoi > e.tirsLui, tot: e => e.k >= 1 && e.tirsMoi > e.tirsLui, effet: { volume: 1.25 } },
    { cle: 'essaim', ico: '🌪', nom: 'L\'essaim', dit: 'Derrière au pointage : +35 % de tirs, +5 % de précision.', quand: derriere, tot: e => derriere(e) || (e.k > 0 && e.moi === e.lui), effet: { volume: 1.35, finition: 1.05 } },
  ],
  rapaces: [
    { cle: 'riposte', ico: '🦅', nom: 'La riposte', dit: 'Après une période perdue aux tirs, sans mener : +28 % de précision.', quand: e => perduAuxTirs(e) && e.moi <= e.lui, tot: e => e.k === 0 || perduAuxTirs(e), effet: { finition: 1.28 } },
    { cle: 'tueur', ico: '🗡', nom: 'Le tueur', dit: 'Quand tu mènes : +17 % de précision.', quand: mene, tot: e => mene(e) || (e.k > 0 && e.moi === e.lui), effet: { finition: 1.17 } },
    { cle: 'parfait', ico: '🎯', nom: 'Le tir parfait', dit: 'En 3e période, à un but d\'écart ou moins : +45 % de précision.', quand: e => k3(e) && serre(e), tot: e => e.k >= 1 && serre(e), effet: { finition: 1.45 } },
  ],
  tortue: [
    { cle: 'verrou', ico: '🐢', nom: 'Le verrou', dit: 'Quand tu mènes : −25 % de buts contre.', defense: true, quand: mene, tot: e => mene(e) || (e.k > 0 && e.moi === e.lui), effet: { defense: 0.75 } },
    { cle: 'tranchee', ico: '⛏', nom: 'La tranchée', dit: 'En 1re période, à l\'étranger : −25 % de leurs tirs.', defense: true, quand: e => e.k === 0 && soirDe(e, 'visiteur'), tot: e => e.k <= 1 && soirDe(e, 'visiteur'), adv: { volume: 0.75 } },
    { cle: 'forteresse', ico: '🏰', nom: 'La forteresse', dit: 'En 3e période, en avant ou à égalité : −30 % de buts contre, −20 % de leurs tirs.', defense: true, quand: e => k3(e) && e.moi >= e.lui, tot: e => e.k >= 1 && e.moi >= e.lui, effet: { defense: 0.7 }, adv: { volume: 0.8 } },
  ],
  rhinos: [
    { cle: 'usure', ico: '🦏', nom: 'L\'usure', dit: 'En 3e période : plus de mises en échec, et leur précision −10 %.', quand: k3, tot: e => e.k >= 1, effet: { robustesse: 2.5 }, adv: { finition: 0.9 } },
    { cle: 'choc', ico: '💥', nom: 'Le choc', dit: 'En 1re période, à domicile : plus de mises en échec, et leur précision −10 %.', defense: true, quand: e => e.k === 0 && soirDe(e, 'domicile'), tot: e => e.k <= 1 && soirDe(e, 'domicile'), effet: { robustesse: 2 }, adv: { finition: 0.9 } },
    { cle: 'charge', ico: '🐂', nom: 'La charge', dit: 'Derrière au pointage : +25 % de tirs, leur précision −12 %.', quand: derriere, tot: e => derriere(e) || (e.k > 0 && e.moi === e.lui), effet: { volume: 1.25, robustesse: 1 }, adv: { finition: 0.88 } },
  ],
  souffle: [
    { cle: 'souffle', ico: '🫁', nom: 'Le second souffle', dit: 'En 3e période, un soir de dos-à-dos ou de jambes lourdes : +20 % de tirs, −20 % de buts contre.', quand: e => k3(e) && soirDe(e, 'dosADos', 'jambesLourdes'), tot: e => e.k >= 1 && soirDe(e, 'dosADos', 'jambesLourdes'), effet: { volume: 1.2, defense: 0.8 } },
    { cle: 'rotation', ico: '🩺', nom: 'La rotation', dit: 'Toute la soirée : −40 % de blessures.', defense: true, quand: () => true, tot: () => true, effet: { blessure: 0.6 } },
    { cle: 'resurrection', ico: '⚡', nom: 'La résurrection', dit: 'Derrière en 3e période : +40 % de tirs, +25 % de précision.', quand: e => k3(e) && derriere(e), tot: e => e.k >= 1 && derriere(e), effet: { volume: 1.4, finition: 1.25 } },
  ],
  choeur: [
    { cle: 'sangfroid', ico: '😇', nom: 'Le sang-froid', dit: 'En 2e période : −45 % de punitions.', defense: true, quand: e => e.k === 1, tot: e => e.k <= 1, effet: { discipline: 0.55 } },
    { cle: 'provocation', ico: '📢', nom: 'La provocation', dit: 'En 3e période : leurs punitions +90 %.', quand: k3, tot: e => e.k >= 1, adv: { discipline: 1.9 } },
    { cle: 'miracle', ico: '✨', nom: 'Le miracle', dit: 'En 3e période, à un but d\'écart ou moins : +30 % de précision, −50 % de punitions.', quand: e => k3(e) && serre(e), tot: e => e.k >= 1 && serre(e), effet: { finition: 1.3, discipline: 0.5 } },
  ],
  profondeur: [
    { cle: 'quatre', ico: '🪜', nom: 'Les quatre trios', dit: 'En 3e période, à un but d\'écart ou moins : tes quatre trios jouent autant, −25 % de buts contre.', quand: e => k3(e) && serre(e), tot: e => e.k >= 1 && serre(e), effet: { F: [0.8, 0.95, 1.2, 1.45], defense: 0.75 } },
    { cle: 'atelier', ico: '🛠', nom: 'L\'atelier', dit: 'Un soir de dos-à-dos : +12 % de tirs, −8 % de buts contre.', quand: e => soirDe(e, 'dosADos'), tot: e => soirDe(e, 'dosADos', 'visiteur'), effet: { volume: 1.12, defense: 0.92 } },
    { cle: 'releve', ico: '🔄', nom: 'La relève', dit: 'Derrière au pointage : tes quatre trios jouent autant, +30 % de tirs, +10 % de précision.', quand: derriere, tot: e => derriere(e) || (e.k > 0 && e.moi === e.lui), effet: { F: [0.8, 0.95, 1.2, 1.45], volume: 1.3, finition: 1.1 } },
  ],
  etoiles: [
    { cle: 'spectacle', ico: '🌠', nom: 'Le spectacle', dit: 'En 3e période, à égalité ou derrière d\'un but : ton 1er trio joue 40 % plus, +32 % de précision.', quand: e => k3(e) && e.moi <= e.lui && e.lui - e.moi <= 1, tot: e => e.k >= 1 && e.moi <= e.lui && e.lui - e.moi <= 1, effet: { F: [1.4, 1, 0.85, 0.75], finition: 1.32 } },
    { cle: 'duo', ico: '🎭', nom: 'Le duo vedette', dit: 'En 1re période, à domicile : ton 1er trio joue 30 % plus, +35 % de précision.', quand: e => e.k === 0 && soirDe(e, 'domicile'), tot: e => e.k <= 1 && soirDe(e, 'domicile'), effet: { F: [1.3, 1, 0.85, 0.8], finition: 1.35 } },
    { cle: 'grandsoir', ico: '🎬', nom: 'Le grand soir', dit: 'En séries ou en gros match : +25 % de précision toute la soirée.', quand: e => e.series || e.gros, tot: e => e.series || e.gros || soirDe(e, 'rival'), effet: { finition: 1.25 } },
  ],
};

/* ---------- les bienfaits ---------- */
export const BIENFAITS_PAR_POUVOIR = 2;
export const XP_SANS_BIENFAIT = 5;
const PAYE = { but: 2, blanchie: 3 };
export const BIENFAITS = {
  tot: { ico: '⏩', nom: 'Plus tôt', dit: 'Le pouvoir joue aussi plus tôt.' },
  fort: { ico: '💪', nom: 'Plus fort', dit: 'L\'effet grandit de moitié.', grandit: 0.5 },
  payant: { ico: '🪙', nom: 'Payant', dit: `Chaque but pendant le pouvoir : +${PAYE.but} 🪙 (un pouvoir qui protège : chaque période sans but contre, +${PAYE.blanchie} 🪙).` },
  series: { ico: '🏆', nom: 'Des séries', dit: 'En séries, l\'effet double.' },
  contagieux: { ico: '🔁', nom: 'Contagieux', dit: 'Quand il joue, un autre de tes pouvoirs joue aussi, à moitié.' },
};
/*
 * LE PERSONNAGE D'UNE ÉQUIPE : `{ cle, xp, talents: [p…], bienfaits: [{ p, b }…] }`, porté par la décision `coach`
 * du jour 0 de chaque saison (l'expérience et les choix d'avant), puis par les décisions `talent` et `bienfait`.
 * Le moteur y ajoute l'expérience de la saison (`xpSaison`).
 */
export function niveauDuPerso(perso) {
  return perso ? niveauDe((perso.xp || 0) + (perso.xpSaison || 0)) : 0;
}
/* Prendre un bienfait (une fois chacun). Rend la liste neuve. */
export function avecBienfait(bienfaits, b) {
  return [...(bienfaits || []).filter(x => !(x.p === b.p && x.b === b.b)), { p: b.p, b: b.b }];
}
/* Une option d'écran (`ouvrirChoix`) pour un bienfait offert : son adjoint, sur son pouvoir. */
export function optionDeBienfait(coach, b) {
  const P = POUVOIRS[coach][b.p], B = BIENFAITS[b.b];
  return { cle: `${b.p}:${b.b}`, ico: B.ico, nom: `${B.nom} · ${P.nom}`, sous: B.dit, mots: [{ txt: `${P.ico} ${P.dit}`, bon: null }] };
}
/* La force d'un pouvoir : 1, plus ses talents, plus « plus fort ». */
export function forceDuPouvoir(perso, p, { series = false } = {}) {
  const talents = (perso.talents || []).filter(x => x === p).length;
  const bs = (perso.bienfaits || []).filter(x => x.p === p).map(x => x.b);
  let f = 1 + TALENT * talents + (bs.includes('fort') ? BIENFAITS.fort.grandit : 0);
  if (series && bs.includes('series')) f *= 2;
  return f;
}
/* Un effet grandi : chaque canal s'écarte de 1 (ou de 0, la robustesse) `f` fois plus. */
export function grandir(effet, f) {
  if (!effet) return null;
  const out = {};
  for (const [k, v] of Object.entries(effet)) {
    if (Array.isArray(v)) out[k] = v.map(x => 1 + (x - 1) * f);
    else if (k === 'robustesse') out[k] = v * f;
    else out[k] = Math.max(0.05, 1 + (v - 1) * f);
  }
  return out;
}

/*
 * LES POUVOIRS D'UNE PÉRIODE : ceux du personnage qui se déclenchent avant la période `e.k`, chacun avec sa force.
 * Rend [{ p, P, f, effet, adv, contagion }] — `contagion` : joué à moitié parce qu'un autre l'a entraîné.
 */
export function pouvoirsDeLaPeriode(perso, e) {
  if (!perso || !POUVOIRS[perso.cle]) return [];
  const niveau = niveauDuPerso(perso);
  const ouverts = pouvoirsOuverts(niveau);
  const bs = p => (perso.bienfaits || []).filter(x => x.p === p).map(x => x.b);
  const out = [];
  for (const p of ouverts) {
    const P = POUVOIRS[perso.cle][p];
    const joue = bs(p).includes('tot') ? P.tot(e) : P.quand(e);
    if (!joue) continue;
    const f = forceDuPouvoir(perso, p, { series: e.series });
    out.push({ p, P, f, effet: grandir(P.effet, f), adv: grandir(P.adv, f), contagion: false });
  }
  // CONTAGIEUX : un pouvoir qui joue entraîne le premier autre pouvoir ouvert qui ne joue pas déjà, à moitié.
  for (const x of [...out]) {
    if (!bs(x.p).includes('contagieux')) continue;
    const autre = ouverts.find(q => q !== x.p && !out.some(y => y.p === q));
    if (autre == null) continue;
    const P = POUVOIRS[perso.cle][autre], f = forceDuPouvoir(perso, autre, { series: e.series }) / 2;
    out.push({ p: autre, P, f, effet: grandir(P.effet, f), adv: grandir(P.adv, f), contagion: true });
  }
  return out;
}

/*
 * LES BIENFAITS OFFERTS (un parmi trois, gratuits, aux moments forts) : tirés de la graine parmi ceux pas encore pris
 * des pouvoirs ouverts qui en portent moins de deux. Quand il n'y en a plus, le moment fort paie de l'expérience
 * (`XP_SANS_BIENFAIT`). `cle` : le moment fort (le palier, le gros match) ; deux moments n'offrent pas les mêmes.
 */
export function bienfaitsOfferts(perso, graine, cle, n = 3) {
  if (!perso || !POUVOIRS[perso.cle]) return [];
  const pris = new Set((perso.bienfaits || []).map(x => `${x.p}:${x.b}`));
  const plein = p => (perso.bienfaits || []).filter(x => x.p === p).length >= BIENFAITS_PAR_POUVOIR;
  const tous = [];
  for (const p of pouvoirsOuverts(niveauDuPerso(perso))) if (!plein(p)) for (const b of Object.keys(BIENFAITS)) if (!pris.has(`${p}:${b}`)) tous.push({ p, b });
  return tous.sort((a, b) => hache(String(graine), 'bienfait', cle, `${a.p}:${a.b}`) - hache(String(graine), 'bienfait', cle, `${b.p}:${b.b}`)).slice(0, n);
}

/*
 * LES JETONS DES BIENFAITS PAYANTS, lus dans les feuilles jouées : chaque but de ton club pendant un pouvoir payant,
 * ou chaque période d'un pouvoir payant qui protège sans but contre. `feuilles` : celles de ton club ; `cote` de chacune.
 */
export function jetonsDesPouvoirs(feuilles) {
  let n = 0;
  for (const { feuille, cote } of feuilles) {
    for (const x of (feuille && feuille.pouvoirs) || []) {
      if (x.cote !== cote || !x.payant) continue;
      n += x.defense ? (x.contre === 0 ? PAYE.blanchie : 0) : PAYE.but * (x.buts || 0);
    }
  }
  return n;
}
