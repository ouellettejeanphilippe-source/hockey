/*
 * LA FICHE D'UN JOUEUR (sortie de js/game.js en 1.0) : la carte recto verso,
 * ses rôles, l'impact sur l'alignement, le profil mesuré et les liens.
 */

import { TRAITS } from './traits.js';
import { MT } from './charge-table.js';
import { esc, estD, glyphe, money, pct3, ord, pmMatch } from './util.js';
import { seasonLancers, passesRelatives, ageAtSeason, seasonGames } from './ratings.js';
import { compterFeuilles, getPlayerKey, getPositionPenalty, SLOTS, badgesDe, EFFET_ROLE, COUP_JAMBES, coutDuCoup, maitrise, fragiliteDe, FRAGILE_DES } from './sim.js';
import { teamLabel, cleDeSommaire, ficheReelleDe } from './bilan.js';
import { TEAM_COLORS, nhlPlayerUrl, getTeamLogoHtml, teamSeasonUrl } from './logos.js';
import { sesRolesHtml, barresProfils, motDuBadge, raisonDuBadge, carrureDe, courbeJambes, courbeJambesHtml } from './gerant.js';
import { RARETES, numeroDeCarte, sensRarete, brillante, finiHtml, tirageLimite, TAILLE_SERIE, serieDe, SERIES } from './cartes.js';
import { NOM_VARIANTE } from './rarete.js';
import { motDeClub } from './equipes.js';
import { axesDe, surTable, tableStats, tagsTableHtml } from './alignement.js';
import { LEGENDES, legendesDe } from './cartable.js';
import { cartonDe, choisirCarteAPoser, destinationFor, identiteTag, mesure, ouvrirVersoPourPoser, rareteJoueur, sectionMods, signPlayer, slotShort, traitsJoueur, varsEquipe } from './repechage.js';
import { $, G, capLeft, chiffreCle, closeModal, displayStats, formatName, ico, isPicked, maxForPick, openModal, ouvrirModale, positionLabel, realTag, slotsLeft, traitTags, zoneEcart, zoneTag, coachTag } from './game.js';

/* =====================================================================
   Hexagone (seulement si le brouillard est levé)
   ===================================================================== */

/**
 * Le profil mesuré : les mêmes axes que ceux qui décident de l'archétype et
 * de la valeur, exprimés en écart au régulier moyen de la saison du joueur.
 * 1,00 = exactement le régulier moyen ; 2,00 = le double.
 */
/* La fiche en mode Sur table : les nombres du plateau dans la grille du
   profil, un axe par cellule, le laiton sur celui qu'un trait majore. */
function ficheTable(p) {
  const st = tableStats(p);
  const cell = k => {
    const tr = (st.traits || {})[k], T = tr && TRAITS[tr];
    return `<div class="profil-cell${T ? ' majore' : ''}" title="${esc(MT.AXE_MOT[k])}${T ? ` — ${T.icon} ${T.label} : +1` : ''}"><div class="k">${k}</div><div class="v">${st[k]}<span class="profil-sur">/6</span></div></div>`;
  };
  return `<div class="profil-grid">${axesDe(p).map(cell).join('')}</div>
  <div class="tags fiche-table-tags">${tagsTableHtml(p, true)}</div>`;
}

/*
 * SUR LA GLACE (1.0, les badges en refonte 1). JP : *pas nécessairement une cote, mais quelque chose qui me dit comment
 * le joueur va jouer et impacter le jeu* ; puis *mets juste pas de stats*. Des mots, tirés de ce que le moteur fera de
 * lui : l'effet de chacun de ses badges À SON PALIER, avec le chiffre NET que le moteur joue (V2.2) : EFFET_ROLE × son
 * badge moins le badge moyen de la ligue (`maitrise`) — un Checker Platine étouffe 7,6 %, pas 8 —, et ce qu'un coup lui coûte selon sa carrure (`coutDuCoup`, son physique). Les mots du moteur,
 * jamais ses cotes, et aucune statistique de plus.
 */
const pctMot = x => `${String(Math.round(x * 1000) / 10).replace('.', ',')} %`;
const EFFETS_GLACE = {
  sniper: x => `en avantage numérique, c'est lui qui tire — ${(1 + x).toFixed(1).replace('.', ',')} fois plus souvent`,
  passeur: () => 'il fait jouer son trio : sa chimie monte plus haut dans son système',
  manieur: () => 'il fait jouer sa ligne : sa chimie monte plus haut dans son système',
  deuxsens: x => `il étouffe les lancers adverses pendant ses présences (−${pctMot(x)})`,
  checker: x => `il étouffe les lancers adverses pendant ses présences (−${pctMot(x)})`,
  defensif: x => `il étouffe les lancers adverses pendant ses présences (−${pctMot(x)})`,
  physique: x => `il étouffe les lancers adverses pendant ses présences (−${pctMot(x)})`,
  bagarreur: x => `il intimide le trio d'en face : sa finition tombe de ${pctMot(x)} pendant ses présences`,
  power: x => `devant le filet, ses coéquipiers de trio finissent ${pctMot(x)} mieux`,
  energie: x => `il garde ses jambes : son match lui coûte ${pctMot(x)} de moins`,
  offensif: x => `il lance de la pointe : sa paire tire ${pctMot(x)} de plus`,
};
function surLaGlaceHtml(p) {
  if (surTable()) return '';
  const li = (txt, cls = '') => `<li${cls ? ` class="${cls}"` : ''}>${txt}</li>`;
  const lignes = [];
  // FRAGILE (V2.2) : ce que sa vraie saison a de matchs manqués pèse sur ses blessures — le moteur le lit, la fiche le dit.
  const fr = fragiliteDe(p);
  if (fr >= FRAGILE_DES) lignes.push(li(`Il n'a joué que ${p.gp || 0} matchs sur ${seasonGames(p.s)} dans sa vraie saison : il se blesse environ ${Math.round(fr)} fois plus qu'un joueur qui les a tous joués.`, 'prix'));
  if (p.p === 'G') {
    lignes.push(li('Son % d\'arrêts est le chiffre que le moteur lit sur chaque lancer ; son style dit comment il les fait.'));
    lignes.push(li('Il garde ses jambes trois départs de suite ; au quatrième, elles baissent et il accorde plus.'));
    return `<ul class="glace">${lignes.join('')}</ul>`;
  }
  for (const b of badgesDe(p)) {
    const E = EFFETS_GLACE[b.cle], x = (EFFET_ROLE[b.cle] || 0) * maitrise(p, b.cle);
    const raison = raisonDuBadge(b);
    lignes.push(li(`<b class="badge pal-${b.palier}">${glyphe(b.ico)} ${esc(motDuBadge(b))}${raison ? ` · ${esc(raison)}` : ''}</b>${E ? ` : ${esc(E(x))}${b.second ? ' (son second badge)' : ''}.` : '.'}`));
  }
  // SANS BADGE QUI DÉFEND (V2.2) : le moteur centre chaque badge sur la ligue, donc un joueur qui n'en a pas tire son unité
  // un peu sous zéro. Ça se dit, avec le chiffre net, plutôt que de se cacher.
  const defR = estD(p) ? ['defensif', 'physique'] : ['checker', 'deuxsens'];
  if (!badgesDe(p).some(b => defR.includes(b.cle))) {
    const net = defR.reduce((a, r) => a + (EFFET_ROLE[r] || 0) * maitrise(p, r), 0);
    if (net < -0.0005) lignes.push(li(`Sans badge qui défend, il est un peu sous le joueur moyen : les lancers adverses passent ${pctMot(-net)} mieux pendant ses présences.`, 'prix'));
  }
  const c = carrureDe(p);
  if (c) {
    // SON coût, pas l'extrême de sa carrure (V2.2) : le moteur le lit en continu sur son physique (`coutDuCoup`).
    const cout = coutDuCoup(p).toFixed(2).replace('.', ',');
    lignes.push(li(c.ico === '🪨' ? `<b>${c.ico} ${c.mot}</b> : un coup reçu ne lui coûte que ${cout} jambe (${String(COUP_JAMBES).replace('.', ',')} à un joueur moyen), et le jeu physique de sa ligne rapporte.` : `<b>${c.ico} ${c.mot}</b> : un coup reçu lui coûte ${cout} jambes (${String(COUP_JAMBES).replace('.', ',')} à un joueur moyen), et sa ligne prend des punitions en rentre-dedans.`, c.ico === '🪨' ? 'bon' : 'prix'));
  }
  return lignes.length ? `<ul class="glace">${lignes.join('')}</ul>` : '';
}

function profilMesure(p) {
  const gp = Math.max(1, p.gp || 1);
  const [, pctTir, shF, shD, , , , pimF] = seasonLancers(p.s);
  const cell = (k, v, t) =>
    `<div class="profil-cell" title="${esc(t)}"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;

  if (p.p === 'G') {
    const svLigue = 1 - (pctTir || 10.5) / 100;
    const ecart = ((p.sv ?? svLigue) - svLigue) * 1000;
    return `<div class="profil-grid">
      ${cell('ARRÊTS', (ecart >= 0 ? '+' : '') + ecart.toFixed(1), `Millièmes d'arrêts au-dessus de sa ligue en ${p.s} (${(svLigue * 1000).toFixed(0)}).`)}
      ${cell('CHARGE', ((p.sa || 0) / gp).toFixed(1), 'Lancers vus par match.')}
      ${cell('DÉPARTS', p.gp, 'Matchs joués — un partant se reconnaît autant à sa charge qu\'à son pourcentage.')}
    </div>`;
  }

  const est_D = p.p === 'D';
  const r = (x) => x.toFixed(2);
  const vol = (p.sh || 0) / gp / (est_D ? (shD || 1.35) : (shF || 1.75));
  const dur = (p.pim || 0) / gp / (pimF || 0.90);

  // Avec la rondelle, puis sans. 1.0 (C2) : seulement ce que le moteur lit —
  // PRODUCTION (les points, déjà sur la carte) et PENCHANT (l'ancienne chimie
  // de trio, retirée en S72) sont partis.
  const m = mesure(p);
  return `<div class="profil-titre">Avec la rondelle</div>
  <div class="profil-grid">
    ${cell('LANCERS', r(vol), `Lancers par match, sur le régulier moyen de ${p.s}.`)}
    ${cell('CRÉATION', r(passesRelatives(p)), `Passes par match, sur le régulier moyen de ${p.s} à sa position. C'est ce qu'il apporte aux lancers des autres : ses coéquipiers finissent mieux à ses côtés.`)}
  </div>
  <div class="profil-titre">Sans la rondelle${m ? ` · défensive ${Math.round(m.def * 100)}e centile, jeu physique ${Math.round(m.rob * 100)}e` : ''}</div>
  <div class="profil-grid">
    ${m ? cell('DIFFÉRENTIEL', pmMatch(m.diff82, 82), `Son +/- par match, corrigé à moitié de celui de son club — un bon joueur d'un mauvais club n'est pas puni deux fois.`) : ''}
    ${m && m.dn82 != null ? cell('DÉSAVANTAGE', Math.round(m.dn82), `Points en désavantage numérique par 82 matchs : qui tue les punitions.`) : ''}
    ${p.toi ? cell('MINUTES', p.toi.toFixed(1), 'Temps de glace par match, en minutes.') : ''}
    ${cell('PUN / MATCH', r(dur), `Minutes de punition par match, sur le régulier moyen de ${p.s} : c'est ce qui décide de ses punitions${p.ht != null ? ` · ${p.ht} mises en échec par match` : ''}.`)}
  </div>`;
}


/* =====================================================================
   Fiche complète du joueur
   ===================================================================== */

/*
 * LES STATISTIQUES SIMULÉES D'UN JOUEUR, saison ou séries, sous une même
 * forme. La saison vit dans les compteurs `sim*` que le moteur écrit ; les
 * séries dans `p.po`, posé par `separerSeries` une fois les séries jouées.
 */
export function statsSim(p, mode = 'saison') {
  if (mode === 'series') return p.po || null;
  if (p.simGP === undefined) return null;
  const o = {};
  for (const k of ['GP', 'G', 'A', 'PTS', 'PM', 'Inj', 'SH', 'PIM', 'PPG', 'W', 'L', 'OTL', 'GA', 'SO', 'SA', 'SV']) {
    if (p['sim' + k] !== undefined) o[k] = p['sim' + k];
  }
  return o;
}

/*
 * CE QUE `compterFeuilles` COMPTE, DANS LA FORME DE LA GRILLE. Deux tables
 * existent pour de bonnes raisons — le moteur écrit `simG` sur le joueur, les
 * feuilles cumulent `g` dans une Map — et la fiche n'en sait lire qu'une.
 * Ce qu'une feuille ne porte pas (la défaite en prolongation, le but en
 * avantage) n'est PAS posé à zéro : une case absente se tait, un zéro ment.
 */
export const compteEnGrille = c => c && {
  GP: c.gp, G: c.g, A: c.a, PTS: c.pts, PM: c.pm, SH: c.sh, PIM: c.pim,
  W: c.w, L: c.l, GA: c.ga, SO: c.bl, SA: c.sa, SV: c.sv,
};

/*
 * LES COMPTEURS À CE JOUR, cumulés des feuilles RÉVÉLÉES — jamais des
 * compteurs `sim*`, qui portent les 82 matchs dès que `simulateLeague` a
 * joué (la leçon de `G.done`, S49). C'est la même lecture que « Derrière le
 * banc » et que les meneurs de l'écran de saison : on ne montre rien que le
 * joueur n'ait déjà vu.
 *
 * Mémorisé sur la journée (et sur l'état des séries) parce qu'un tableau de
 * meneurs porte sept cents noms : recompter 1312 feuilles par nom serait
 * une seconde par rendu. La clé change à chaque révélation, donc le cache
 * ne peut pas servir un chiffre périmé.
 */
let COMPTE_JOUR = { cle: null, map: null };
export function compteRevele(portee = 'jour') {
  const L = G.ligue;
  const vues = G.seriesVues;
  const cle = portee === 'jourSeries'
    ? `s|${vues ? (vues.revele || []).join(',') : ''}`
    : `j|${G.journee || 0}`;
  if (COMPTE_JOUR.cle === cle) return COMPTE_JOUR.map;
  let map = new Map();
  if (portee === 'jourSeries') {
    const rev = (vues && vues.revele) || [];
    for (const s of (G.series || [])) compterFeuilles(s.feuilles.slice(0, rev[s.i] || 0), map);
  } else if (L && L.calendrier) {
    map = compterFeuilles(L.calendrier.slice(0, G.journee || 0).flat().map(m => m.feuille));
  }
  COMPTE_JOUR = { cle, map };
  return map;
}

/*
 * JUSQU'OÙ UN NOM A LE DROIT DE PARLER. La règle tient en une ligne — tant
 * qu'il reste une journée ou un match à révéler, une fiche ne dit que ce qui
 * est joué DEVANT le joueur — et elle n'a qu'UN propriétaire : l'écran de
 * saison, le bilan, le sommaire d'un match et l'onglet des équipes la lisent
 * tous ici plutôt que d'en garder chacun sa version.
 */
export function porteeRevele(quoi = 'saison') {
  if (quoi === 'series') {
    const vues = (G.seriesVues && G.seriesVues.revele) || null;
    if (!vues) return 'series';
    return (G.series || []).some(s => (vues[s.i] || 0) < s.feuilles.length) ? 'jourSeries' : 'series';
  }
  const cal = G.ligue && G.ligue.calendrier;
  return cal && (G.journee || 0) < cal.length ? 'jour' : 'saison';
}

/*
 * UN NOM CLIQUABLE OUVRE LA FICHE. Partout où un joueur est nommé après la
 * simulation — feuille de match, palmarès, sommaire, alignement d'une
 * équipe — son nom est un bouton qui ouvre sa fiche avec ses statistiques
 * SIMULÉES, saison ou séries. Le registre relie l'identifiant du DOM à
 * l'objet joueur ; un seul écouteur délégué sert tout le document.
 */
const MOT_MODE = {
  saison: 'de la saison simulée', series: 'des séries',
  jour: 'à ce jour', jourSeries: 'des séries, à ce jour',
};
const FICHES = new Map();
export function lienJoueur(p, t, mode = 'saison', html = null) {
  if (!p) return html ?? '';
  const cle = `${getPlayerKey(p)}|${mode}`;
  FICHES.set(cle, { p, t, mode });
  return `<button type="button" class="lien-joueur" data-fiche="${esc(cle)}" title="Fiche et statistiques ${MOT_MODE[mode] || MOT_MODE.saison}">${html ?? formatName(p.n)}</button>`;
}
const EQUIPES = new Map();
export function lienEquipe(t, mode = 'saison', html = null) {
  if (!t) return html ?? '';
  const cle = `${t.tag}|${t.season || ''}|${mode}`;
  EQUIPES.set(cle, { t, mode });
  return `<button type="button" class="lien-equipe" data-equipe="${esc(cle)}" title="L'alignement et la saison complète de cette équipe">${html ?? esc(teamLabel(t))}</button>`;
}
document.addEventListener('click', ev => {
  const bj = ev.target.closest('[data-fiche]');
  if (bj && FICHES.has(bj.dataset.fiche)) {
    ev.preventDefault(); ev.stopPropagation();
    const { p, t, mode } = FICHES.get(bj.dataset.fiche);
    ouvrirFiche(p, t, mode);
    return;
  }
  const be = ev.target.closest('[data-equipe]');
  if (be && EQUIPES.has(be.dataset.equipe)) {
    ev.preventDefault(); ev.stopPropagation();
    const { t, mode } = EQUIPES.get(be.dataset.equipe);
    showTeamModal(t, mode);
  }
});

/*
 * LA FICHE D'UN JOUEUR, BORNÉE À CE QU'IL A VU. Les modes 'saison' et
 * 'series' lisent les compteurs du moteur — toute l'année ; les modes en
 * cours lisent les feuilles révélées.
 *
 * LE COMPTE SE FAIT AU CLIC, pas au rendu. Un tableau de meneurs porte sept
 * cents noms et se refait à chaque journée : cumuler les feuilles pour
 * chacun coûterait une seconde par rendu, pour une fiche sur mille qu'on
 * ouvre. Et au clic, le compte est forcément à jour.
 */
export function ouvrirFiche(p, t, mode = 'saison', extra = {}) {
  if (mode !== 'jour' && mode !== 'jourSeries') { showPlayerModal(p, { sim: mode, team: t, ...extra }); return; }
  showPlayerModal(p, {
    sim: compteEnGrille(compteRevele(mode).get(p)) || {}, team: t,
    titreSim: mode === 'jourSeries' ? 'Ses séries, à ce jour' : 'Sa saison, à ce jour',
    // La courbe des jambes s'arrête au matin de la journée révélée : rien d'un soir pas encore vu.
    jambesJusqua: mode === 'jour' ? (G.journee || 0) : Infinity, ...extra,
  });
}

const cellStat = (k, v, hl = false) => `<div class="stat-cell${hl ? ' hl' : ''}"><div class="k">${k}</div><div class="v">${v}</div></div>`;

/** La grille de statistiques simulées d'un joueur (patineur ou gardien). */
function grilleSim(p, S) {
  if (!S) return '<div class="dash-note">Aucun match joué.</div>';
  if (p.p === 'G') {
    const pct = S.SA ? pct3(S.SV / S.SA) : '—';
    return cellStat('PJ', S.GP || 0) + cellStat('V', S.W || 0, true) + cellStat('D', S.L || 0)
      + (S.OTL === undefined ? '' : cellStat('DP', S.OTL))
      + cellStat('BL', S.SO || 0) + cellStat('MBA', ((S.GA || 0) / Math.max(1, S.GP || 1)).toFixed(2)) + cellStat('%ARR', pct)
      + cellStat('ARR', S.SV || 0) + cellStat('TIRS', S.SA || 0);
  }
  return cellStat('PJ', S.GP || 0) + cellStat('B', S.G || 0) + cellStat('A', S.A || 0) + cellStat('PTS', S.PTS || 0, true)
    + cellStat('PTS/M', S.GP ? ((S.PTS || 0) / S.GP).toFixed(2) : '—') + cellStat('+/M', pmMatch(S.PM || 0, S.GP || 0))
    + cellStat('PUN', S.PIM || 0) + cellStat('L', S.SH || 0) + cellStat('%', S.SH ? (100 * (S.G || 0) / S.SH).toFixed(1) : '—')
    + (S.PPG === undefined ? '' : cellStat('BAN', S.PPG)) + (S.Inj ? cellStat('RATÉS', S.Inj) : '');
}

/**
 * La fiche. Sans option, c'est celle du bassin : la vraie saison, le profil,
 * l'impact sur ton alignement et le bouton Signer. Avec `sim`, c'est la
 * fiche d'APRÈS : les statistiques simulées d'abord (saison ou séries),
 * la vraie saison dessous pour comparer, et ni destination ni signature.
 */
export function showPlayerModal(p, opts = {}) {
  const modal = $('hockeyCardModal');
  const body = $('hockeyCardBody');
  if (!modal || !body) return;

  /*
   * `opts.sim` dit CE QU'ON MONTRE, et il a trois formes.
   *
   * 'saison' et 'series' lisent les compteurs du moteur — la saison ENTIÈRE.
   * C'est juste au bilan, et c'est un SPOILER en cours de saison : `simG` et
   * ses voisins portent les 82 matchs dès que `simulateLeague` a joué, bien
   * avant que l'écran ne les révèle (la leçon de `G.done`, S49). Un nom
   * cliqué à la journée 20 annoncerait donc la fin de l'année.
   *
   * La troisième forme est un OBJET de compteurs déjà cumulés — ce que
   * `compterFeuilles` rend pour les journées révélées, exactement ce que
   * « Derrière le banc » affiche déjà. `titreSim` dit alors jusqu'où on
   * compte, sinon la fiche ne se distingue pas de celle de fin d'année.
   */
  const sim = opts.sim ? (typeof opts.sim === 'object' ? opts.sim : statsSim(p, opts.sim)) : null;
  const apres = !!opts.sim;
  // L'APERÇU (S78) : la fiche d'un joueur OFFERT (un pack, le ballottage, une recrue), par-dessus le choix,
  // sans « Signer » ni « où il irait » — c'est le bouton de sa carte qui le prend.
  const apercu = !!opts.apercu;
  const already = isPicked(p);
  const slot = apres ? null : destinationFor(p);
  const rem = capLeft();
  const over = p.$ > rem;
  const pen = slot ? getPositionPenalty(p, slot) : 0;
  const st = displayStats(p);
  const colors = TEAM_COLORS[p.t] || { primary: '#112236', accent: '#38bdf8' };

  const cell = cellStat;
  const pmStr = pmMatch(st.pm, st.gp);
  // La vraie saison (six colonnes, S71) se lit au RECTO de la carte (`statsCarte`, plus bas) ;
  // le temps de glace, les mises en échec et les mises au jeu vivent dans le détail.

  /*
   * Plus de cotes sur la fiche. Un joueur se juge sur ce qu'il a fait, et
   * « ce qu'il a fait » se lit en écart au régulier moyen de SA saison —
   * sinon 60 points en 1981 et 60 points en 2003 auraient l'air pareils.
   */
  const ratings = profilMesure(p);
  // LE DÉTAIL SE REPLIE (S71) : le profil mesuré, le temps de glace, les
  // mises en échec, les mises au jeu — là pour qui les cherche.
  const detailStats = p.p === 'G' ? '' : cell('PTS/M', st.ppgStr) + cell('TG/M', p.toi ? Number(p.toi).toFixed(1) : '—')
    + (p.ht != null ? cell('MÉ/M', p.ht) : '');   // 1.0 (C2) : le MJ % ne joue pas dans la saison ; il est parti
  // 1.0 (J2-5) : au bureau, la colonne de droite était vide sous deux lignes ; le détail s'y ouvre de lui-même.
  const plusDeDetails = `<details class="fiche-plus"${matchMedia('(min-width: 900px)').matches ? ' open' : ''}><summary>Plus de détails</summary>
       ${detailStats ? `<div class="stat-grid">${detailStats}</div>` : ''}
       <div class="section-label">Profil mesuré, en écart au régulier moyen de sa saison</div>
       ${ratings}</details>`;

  const risky = !already && !over && !!slot && p.$ > maxForPick();
  const label = already ? '✓ Déjà signé' : !slot ? 'Aucune case libre' : over ? 'Hors budget' : risky ? 'Signer · bloque la fin' : `Signer · ${slot.role}`;
  const destNote = already ? ''
    : !slot ? `<div class="dash-note dash-bad">Toutes les cases compatibles sont prises. Déplace un joueur ou vise une autre position.</div>`
    : over ? `<div class="dash-note dash-bad">${money(p.$)} pour ${money(rem)} restants.</div>`
    : surTable() ? `<div class="dash-note">Ira au <strong>${esc(slotShort(slot))}</strong>. Sur table, ni zone ni pénalité de position : il joue sur ses nombres, où qu'on le mette. Il resterait ${money(rem - p.$)} pour ${slotsLeft() - 1} case${slotsLeft() - 1 > 1 ? 's' : ''}.</div>`
    : `<div class="dash-note${zoneEcart(p, slot) === 'sous' ? ' dash-bad' : ''}">Ira au <strong>${esc(slotShort(slot))}</strong>${pen > 0 ? ` avec une pénalité de <strong>−${pen}</strong> hors position` : ' sans pénalité de position'}${zoneEcart(p, slot) === 'sous' ? `, <strong>sous sa zone</strong> : son talent y est gaspillé et l'unité porte un malus. Vise une autre case ou déplace quelqu'un.` : zoneEcart(p, slot) === 'dessus' ? ', au-dessus de sa zone (−3 par cran, léger).' : ', dans sa zone.'} Il resterait ${money(rem - p.$)} pour ${slotsLeft() - 1} case${slotsLeft() - 1 > 1 ? 's' : ''}.</div>`;

  const nhlUrl = nhlPlayerUrl(p.id) || `https://www.nhl.com/search?q=${encodeURIComponent(p.n)}`;
  const hdbUrl = `https://www.hockeydb.com/ihdb/stats/findplayer.php?full_name=${encodeURIComponent(p.n)}`;

  const equipeSim = opts.team ? `<span class="pcard-full-club">${getTeamLogoHtml(opts.team.tag, 14)} ${esc(teamLabel(opts.team))}</span>` : '';
  // SES RÔLES (1.0, C2) : sa maîtrise de chaque rôle, qui décide du fit dans un système, à un toucher.
  // LE PROFIL EN CRANS (1.0) : d'un coup d'oeil, où il se range dans sa saison sur ce que le moteur lit — avant ses rôles.
  const glace = surLaGlaceHtml(p);
  // GRAVÉ SUR SA CARTE (V2.2) : les moments légendaires d'une run se relisent ici, pas seulement dans un toast.
  const legendes = surTable() ? [] : legendesDe(getPlayerKey(p));
  const grave = legendes.length ? `<div class="section-label">Gravé sur sa carte</div><ul class="glace">${legendes.map(l => `<li class="bon">${LEGENDES[l.type].ico} <b>${esc(LEGENDES[l.type].nom)}</b>${l.saison ? ` · saison ${l.saison} d'une run` : ''}</li>`).join('')}</ul>` : '';
  const profil = grave + (glace ? `<div class="section-label">Sur la glace</div>${glace}` : '');
  const sesRoles = p.p === 'G' || surTable() ? '' : `<div class="section-label">Ses rôles</div>${sesRolesHtml(p)}`;
  // SES JAMBES, JOURNÉE PAR JOURNÉE (1.0, le suivi des jambes) : l'instantané du moteur de son club.
  const courbe = apres && opts.team ? courbeJambesHtml(courbeJambes(opts.team, p, opts.jambesJusqua ?? Infinity), { large: true }) : '';
  const corps = apercu ? profil + sesRoles + plusDeDetails : apres
    ? `<div class="section-label">${esc(opts.titreSim || (opts.sim === 'series' ? 'Statistiques des séries' : 'Statistiques de la saison simulée'))} ${equipeSim}</div>
       <div class="stat-grid">${grilleSim(p, sim)}</div>
       ${opts.sim === 'series' && statsSim(p, 'saison') ? `<div class="section-label">Saison régulière simulée</div><div class="stat-grid">${grilleSim(p, statsSim(p, 'saison'))}</div>` : ''}
       ${courbe ? `<div class="section-label">Ses jambes, journée par journée</div>${courbe}` : ''}
       ${profil}${sesRoles}
       ${plusDeDetails}`
    : surTable()
    ? `<div class="section-label">Sur la glace de table</div>
       ${ficheTable(p)}
       <div class="section-label">Impact sur ton alignement</div>
       ${destNote}`
    : `<div class="section-label">Impact sur ton alignement</div>
       ${destNote}
       ${profil}${sesRoles}
       ${plusDeDetails}`;

  /*
   * LA FICHE EST UNE CARTE, RECTO ET VERSO (S78). JP : *devant de carte
   * vertical, pour stats et face complète car portraits* ; puis *les cartes
   * devraient être verticales, pis recto verso même style, avec largeur
   * pleine*. Une seule carte debout, sur toute la largeur de la fiche (400 px
   * au plus, au bureau), dans le dessin de sa SÉRIE et aux couleurs de son
   * CLUB (1.0, `cartonDe`, style.css « LES SÉRIES ») ; la variante en est la
   * parallèle, la même sur les deux faces. Les deux faces s'empilent dans la
   * même case : la carte a la taille de la plus haute, et elle ne change pas
   * de taille quand on la retourne.
   *   RECTO — le carton (le visage, le poste, le niveau, la gemme, le nom, le
   *     club, les petits caractères), puis la plaque : la vraie saison (six
   *     nombres) et le salaire.
   *   VERSO — le numéro de la carte, le nom et le poste ; les mensurations ;
   *     ce qu'il sait faire ; les traits, les mesures et la zone ; ce que sa
   *     carte JOUE (la variante et son bonus, en toutes lettres) ; l'échange
   *     et le tirage d'une or.
   * Chaque fait a UNE place (JP : *jamais dédoubler information*) : la fiche
   * sous la carte ne dit plus la vraie saison, seulement ce qui DÉCIDE (où il
   * ira, ou sa saison simulée).
   */
  const rarete = rareteJoueur(p);
  const R = RARETES[rarete];
  const numero = numeroDeCarte(getPlayerKey(p));
  const serie = serieDe(p.s);
  const joue = traitsJoueur(p);
  const roles = p.p === 'G' ? '' : barresProfils(p);
  const saCarte = `<div class="cj-sa-carte"><span class="cj-sa-rarete tc-${rarete}" title="${esc(sensRarete(rarete))}">${R.gemme}${brillante(rarete) ? '✦' : ''} ${esc(NOM_VARIANTE[rarete] || R.nom)}</span>${joue.length
    ? joue.map(t => `<span class="cj-sa-trait"><b>${t.ico} ${esc(t.nom)}</b> — ${esc(t.mot)}</span>`).join('')
    : '<span class="cj-sa-trait">La carte de base : elle ne joue rien de plus.</span>'}</div>`;
  // La vraie saison, sur la carte : six nombres, comme au dos d'une vraie carte… mais au recto, où on les cherche.
  // Le nombre en évidence est son chiffre clé (`chiffreCle`) : les punitions d'un bagarreur, les mises en échec d'un checker.
  const cle = chiffreCle(p);
  const nb = (k, v, hl = false) => `<div class="fc-stat${hl ? ' hl' : ''}"><span class="k">${k}</span><b>${v}</b></div>`;
  const statsCarte = p.p === 'G'
    ? nb('PJ', st.gp) + nb('V', st.w, true) + nb('D', st.l) + nb('BL', st.so) + nb('%ARR', p.sv != null ? pct3(Number(p.sv)) : '—') + nb('MBA', p.ga != null ? String(p.ga).replace('.', ',') : '—')
    : nb('PJ', st.gp) + nb('B', st.g) + nb('A', st.a) + nb('PTS', st.pt, cle.u === 'PTS')
      + (cle.u === 'MÉ/M' || cle.u === 'TB/M' ? nb(cle.u, cle.v, true) : nb('+/M', pmStr, cle.u === '+/M')) + nb('PUN', p.pim ?? '—', cle.u === 'PUN');
  const etiquettes = `${traitTags(p, true)}${surTable() && !apres ? '' : identiteTag(p, true) + zoneTag(p) + coachTag(p)}${realTag(p)}`;
  const milieuVerso = `${roles ? `<div class="fc-sec">Ce qu'il sait faire</div><div class="fiche-profils">${roles}</div>` : ''}
    ${etiquettes.trim() ? `<div class="tags fc-tags">${etiquettes}</div>` : ''}
    ${saCarte}
    ${sectionMods(p, opts.attente || null)}`;
  const verso = versoDeCarte(p, numero, rarete, milieuVerso, serie);
  body.innerHTML = `
    <div class="pcard-full" style="${varsEquipe(p)};--card-primary:${colors.primary};--card-accent:${colors.accent}">
      <div class="fiche-carte">
        <div class="fc-faces">
          <div class="fc-face fc-recto cs-${serie} tc-${rarete}" title="Touche la carte pour la retourner">
            ${cartonDe(p, { nomClasse: 'pcard-full-name' })}
            <div class="fc-plaque">
            <div class="fc-legende">Sa vraie saison${G.statsProrata ? ' · prorata 82 matchs, ajusté à l\'époque' : ''}</div>
            <div class="fc-stats">${statsCarte}</div>
            <div class="fc-pied">
              <span class="fc-salaire"><b>${st.salaryMain}</b><small>${[st.salarySub, G.salaryMode === 'ERA' ? '' : `${p.s} : ${money(st.eraSal)}`].filter(Boolean).join(' · ')}</small></span>
              <button type="button" class="cj-retourner" aria-label="Retourner la carte">↻ Verso</button>
            </div>
            </div>
          </div>
          ${verso}
        </div>
      </div>
      <div class="modal-body">${corps}</div>
      <div class="pcard-full-foot">
        <div class="ext-links">
          <a class="ext-link" href="${nhlUrl}" target="_blank" rel="noopener">Fiche LNH ${ico('i-ext')}</a>
          <a class="ext-link" href="${hdbUrl}" target="_blank" rel="noopener">HockeyDB ${ico('i-ext')}</a>
          ${teamSeasonUrl(p.t, p.s) ? `<a class="ext-link" href="${teamSeasonUrl(p.t, p.s)}" target="_blank" rel="noopener" title="La saison ${esc(p.s)} de son équipe sur Hockey-Reference">La saison du club ${ico('i-ext')}</a>` : ''}
        </div>
        ${apres || apercu ? '' : `<button class="btn go${risky ? ' risque' : ''}" id="modalSignBtn" ${already || !slot || over ? 'disabled' : ''}>${label}</button>`}
      </div>
    </div>`;

  const btn = $('modalSignBtn');
  if (btn) {
    btn.onclick = () => {
      // Deux touchers pour une signature qui bloque la fin : le premier dit ce qu'il restera, le second signe.
      if (btn.classList.contains('risque') && btn.dataset.confirme !== '1') {
        btn.dataset.confirme = '1';
        btn.textContent = `Confirmer ? ${money(capLeft() - p.$)} pour ${slotsLeft() - 1} case${slotsLeft() - 1 > 1 ? 's' : ''}`;
        return;
      }
      closeModal('hockeyCardModal');
      signPlayer(p);
    };
  }
  const carte = body.querySelector('.fiche-carte');
  brancherRetournement(carte);
  // S80 : la fiche s'ouvre AU VERSO quand on y vient pour poser une carte — sans tourner, elle y est déjà.
  if (opts.verso && carte) {
    carte.classList.add('au-verso');
    const recto = carte.querySelector('.fc-recto'), dos = carte.querySelector('.fc-verso');
    if (recto && dos) { recto.classList.add('fc-cachee'); dos.classList.remove('fc-cachee'); recto.setAttribute('aria-hidden', 'true'); dos.setAttribute('aria-hidden', 'false'); }
  }
  // LES CASES DU VERSO (S80) : « Poser ici » pose la carte en attente ; « + Poser une amélioration » ouvre tes cartes.
  const poser = body.querySelector('[data-poser]');
  if (poser && opts.attente) poser.onclick = () => opts.attente.poser();
  const plus = body.querySelector('[data-plus]');
  if (plus) plus.onclick = () => {
    closeModal('hockeyCardModal');
    choisirCarteAPoser(p, opts.rouvrir || (x => ouvrirVersoPourPoser(p, x)));
  };
  modal.classList.toggle('au-dessus', apercu || !!opts.auDessus);
  ouvrirModale(modal);
}

/*
 * RETOURNER LA CARTE. Toucher la carte (ailleurs que sur un lien) ou « ↻ » la
 * fait tourner d'un quart, change de face sur la tranche — là où elle est
 * invisible — et finit son tour. Un faux 3D (`rotateY` sur la carte elle-même,
 * sans `preserve-3d`) : la carte porte `isolation` et `overflow`, qui aplatissent
 * les enfants, et deux faces superposées en vrai 3D demanderaient de les
 * enlever. Sous `prefers-reduced-motion`, la face change sans tourner.
 *
 * « ↻ RECTO NE MARCHAIT PAS » (S78, JP : *Sur une carte, bouton recto marche
 * pas*). Le tour se chaînait sur `animationend`, et la seconde moitié
 * (`tourne-2`) prenait sa courbe dans `var(--ressort)` — une propriété posée
 * sur les cartes, PAS sur `.fiche-carte` : la déclaration `animation` devenait
 * invalide, aucune animation ne partait, aucun `animationend` n'arrivait, et
 * la carte restait « en cours » pour toujours — le premier tour passait, plus
 * rien ensuite. Le tour se règle maintenant à la MINUTERIE (les deux durées
 * sont connues) : une animation absente, coupée ou refusée par la feuille ne
 * peut plus bloquer la carte ; et la courbe est écrite en toutes lettres.
 */
const TOUR_1 = 200, TOUR_2 = 340;   // les deux moitiés du tour, en ms (style.css, `cj-tourne-1/2`)
function brancherRetournement(carte) {
  if (!carte) return;
  const recto = carte.querySelector('.fc-recto');
  const dos = carte.querySelector('.fc-verso');
  if (!recto || !dos) return;
  let enCours = false;
  // Les deux faces restent dans la case (`visibility`, pas `hidden`) : la carte garde sa taille.
  const changer = () => {
    const auVerso = carte.classList.toggle('au-verso');
    recto.classList.toggle('fc-cachee', auVerso);
    dos.classList.toggle('fc-cachee', !auVerso);
    recto.setAttribute('aria-hidden', String(auVerso));
    dos.setAttribute('aria-hidden', String(!auVerso));
  };
  const retourner = () => {
    if (enCours) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { changer(); return; }
    enCours = true;
    carte.classList.add('tourne-1');
    setTimeout(() => {
      carte.classList.remove('tourne-1');
      changer();
      carte.classList.add('tourne-2');
      setTimeout(() => { carte.classList.remove('tourne-2'); enCours = false; }, TOUR_2);
    }, TOUR_1);
  };
  // Toucher la carte, l'une ou l'autre face, ou « ↻ » : elle tourne.
  carte.addEventListener('click', ev => {
    if (ev.target.closest('a, details, summary') || (ev.target.closest('button') && !ev.target.closest('.cj-retourner'))) return;
    if (!ev.target.closest('.fc-face, .cj-retourner')) return;
    retourner();
  });
}

/* Le poste en mots, pour le dos d'une carte. */
const POSTE_MOT = { AG: 'Ailier gauche', AD: 'Ailier droit', C: 'Centre', DG: 'Défenseur gauche', DD: 'Défenseur droit', G: 'Gardien', F: 'Attaquant' };
/*
 * LE VERSO NE DIT QUE CE QUE LE RECTO NE DIT PAS (S78). JP : *jamais dédoubler
 * information dans l'interface*. Le verso de S77 portait le tableau de la
 * saison — que les tuiles « Statistiques » de la fiche répétaient juste
 * dessous — et une notice faite de ce que les étiquettes du recto disaient
 * déjà (le trophée, la réputation, l'échange, le salaire publié), plus sa
 * traduction anglaise. Chaque fait a maintenant UNE place :
 *   — au recto et dans la fiche, ce qui DÉCIDE : la production (les tuiles),
 *     les traits, les mesures, la zone, le salaire, ce que la carte joue ;
 *   — au verso, ce qui dit QUI il est : le numéro de la carte, son nom et son
 *     poste en toutes lettres, la taille, le poids, la naissance et l'âge (qui
 *     ont quitté les étiquettes du recto), l'échange de la saison, et le
 *     tirage d'une légendaire (qui a quitté sa photo : « 71/99 » s'y lisait
 *     comme une cote).
 */
/*
 * SA LIGUE EN UNE LIGNE (1.0), comme la bio d'un vrai verso : son rang dans sa
 * vraie saison — aux points parmi les patineurs, au % d'arrêts parmi les
 * gardiens de 25 matchs et plus. Le recto dit ses nombres ; le verso, ce
 * qu'ils valaient dans la ligue. Rien au-delà du 30e (du 10e gardien).
 */
function rangDansLaLigue(p) {
  const e = G.shards.get(p.s);
  if (!e) return '';
  if (p.p === 'G') {
    if (p.sv == null || (p.gp || 0) < 25) return '';
    const r = 1 + e.players.filter(x => x.p === 'G' && (x.gp || 0) >= 25 && x.sv != null && Number(x.sv) > Number(p.sv)).length;
    return r <= 10 ? `${ord(r)} % d'arrêts de la ligue en ${p.s}, parmi les gardiens de 25 matchs et plus.` : '';
  }
  const pts = x => x.pt ?? ((x.g || 0) + (x.a || 0));
  const r = 1 + e.players.filter(x => x.p !== 'G' && pts(x) > pts(p)).length;
  return r <= 30 ? `${ord(r)} pointeur de la ligue en ${p.s}.` : '';
}
function versoDeCarte(p, numero, rarete, milieu = '', serie = 'signature') {
  const prim = positionLabel(p).split(' / ')[0];
  const vit = [];
  if (p.hgt) vit.push(['Taille', `${Math.floor(p.hgt / 12)}′${p.hgt % 12}″`]);
  if (p.wgt) vit.push(['Poids', `${p.wgt} lb`]);
  if (p.bd) { const [a, m, j] = String(p.bd).split('-').map(Number); if (a && m && j) vit.push(['Naissance', `${String(j).padStart(2, '0')}-${String(m).padStart(2, '0')}-${a}`]); }
  const age = ageAtSeason(p.bd, p.s);
  if (age) vit.push(['Âge', `${age} ans`]);
  const faits = [rangDansLaLigue(p)].filter(Boolean);
  if (p.x) faits.push('Échangé en cours de saison : il a porté deux chandails cette année-là.');
  if (rarete === 'legendaire') faits.push(`Tirage limité · exemplaire ${tirageLimite(getPlayerKey(p), (G.variantes.numeros || {})[getPlayerKey(p)] || '/99')}`);
  /*
   * LE PIED D'UN VRAI VERSO (S80) : la ligne légale de l'imprimeur, en petits
   * caractères — « © 1985 O-Pee-Chee » disait l'année de la série sans la
   * nommer. Ici : l'année où la série sort (le début de la saison), la marque,
   * le nombre de cartes. Rien que le recto dise déjà en toutes lettres.
   */
  const anneeSerie = String(p.s || '').slice(0, 4);
  return `<div class="fc-face fc-verso cj-verso cs-${serie} tc-${rarete} fc-cachee" aria-hidden="true">
    ${finiHtml(rarete)}
    <div class="cjv-tete"><span class="cjv-no" title="Numéro de la carte dans la série"><small aria-hidden="true">Nº</small>${numero}</span><span class="cjv-nom">${esc(p.n)}</span><span class="cjv-pos">${esc(POSTE_MOT[prim] || 'Joueur')}</span><span class="cjv-logo">${getTeamLogoHtml(p.t, 22)}</span></div>
    ${vit.length ? `<div class="cjv-table-wrap"><table class="cjv-table"><thead><tr>${vit.map(([k]) => `<th scope="col">${k}</th>`).join('')}</tr></thead><tbody><tr>${vit.map(([, v]) => `<td>${esc(v)}</td>`).join('')}</tr></tbody></table></div>` : ''}
    ${milieu}
    ${faits.map(f => `<p class="cjv-bio">${esc(f)}</p>`).join('')}
    <div class="fc-filigrane" aria-hidden="true">${getTeamLogoHtml(p.t, 120)}</div>
    <div class="cjv-pied"><span class="cjv-legal">© ${anneeSerie} Cap 82-0 · ${SERIES[serie].nom} · série de ${TAILLE_SERIE} cartes</span><button type="button" class="cj-retourner" aria-label="Revenir au recto">↻ Recto</button></div>
  </div>`;
}

/*
 * L'ALIGNEMENT COMPLET D'UNE ÉQUIPE, ET SA SAISON. Ce que la ligue a joué
 * se vérifie ici, équipe par équipe : les 23 fiches simulées (patineurs par
 * points, gardiens à part), puis les 82 résultats dans l'ordre du calendrier.
 * En mode séries, ce sont les statistiques et les matchs des séries.
 */
function showTeamModal(t, mode = 'saison') {
  const joueurs = SLOTS.map(s => t.roster[s.i]).filter(Boolean);
  const pat = joueurs.filter(p => p.p !== 'G').map(p => [p, statsSim(p, mode)]).filter(([, S]) => S)
    .sort((a, b) => (b[1].PTS || 0) - (a[1].PTS || 0) || (b[1].G || 0) - (a[1].G || 0));
  const gar = joueurs.filter(p => p.p === 'G').map(p => [p, statsSim(p, mode)]).filter(([, S]) => S)
    .sort((a, b) => (b[1].GP || 0) - (a[1].GP || 0));
  const ligneP = ([p, S]) => `<tr>
    <td class="left"><div class="team-cell">${lienJoueur(p, t, mode, `<span>${esc(p.n)}</span>`)}</div></td>
    <td class="sub-cell">${esc(positionLabel(p).split(' / ')[0])}</td>
    <td class="stat">${S.GP || 0}</td><td class="stat">${S.G || 0}</td><td class="stat">${S.A || 0}</td>
    <td class="stat heros">${S.PTS || 0}</td><td class="stat">${pmMatch(S.PM || 0, S.GP || 0)}</td><td class="stat">${S.PIM || 0}</td>
    <td class="stat">${S.SH || 0}</td><td class="stat">${S.PPG || 0}</td></tr>`;
  const ligneG = ([p, S]) => `<tr>
    <td class="left"><div class="team-cell">${lienJoueur(p, t, mode, `<span>${esc(p.n)}</span>`)}</div></td>
    <td class="sub-cell">G</td>
    <td class="stat">${S.GP || 0}</td><td class="stat heros">${S.W || 0}</td><td class="stat">${S.L || 0}</td><td class="stat">${S.OTL || 0}</td>
    <td class="stat">${((S.GA || 0) / Math.max(1, S.GP || 1)).toFixed(2)}</td><td class="stat">${S.SA ? pct3(S.SV / S.SA) : '—'}</td>
    <td class="stat">${S.SO || 0}</td></tr>`;

  const journal = mode === 'series' ? (t.poJournal || []) : (t.journal || []);
  // Chaque match de la liste ouvre son sommaire, quand sa feuille existe.
  const resultats = journal.map(m => { const cle = cleDeSommaire(m.feuille); return `<tr class="${m.win ? 'gagne' : 'perdu'}${cle ? ' ouvrable' : ''}"${cle ? ` data-sommaire="${esc(cle)}" title="Sommaire du match"` : ''}>
    <td class="sub-cell">${m.n}</td>
    <td class="left"><div class="team-cell">${getTeamLogoHtml(m.adv.tag, 14)}${lienEquipe(m.adv, mode, `<span>${esc(teamLabel(m.adv))}</span>`)}</div></td>
    <td class="stat ${m.win ? 'v' : 'd'}">${m.win ? 'V' : m.ot ? 'DP' : 'D'}</td>
    <td class="stat">${m.gf}-${m.ga}${m.ot ? ' <small>P</small>' : ''}</td>
    <td class="sub-cell">${m.gardien ? esc(m.gardien.n) : ''}</td></tr>`; }).join('');

  const bilan = mode === 'series' && t.po ? t.po : t;
  /*
   * LE LIEN EXTERNE, comme sur la fiche d'un joueur : la vraie saison du
   * club chez Hockey-Reference (`teamSeasonUrl`, adresse vérifiée sur les 44
   * codes). Ta propre formation n'en a pas — les NHL Stars n'ont pas de
   * saison 1976-77 à consulter.
   */
  const urlClub = t.isPlayer ? null : teamSeasonUrl(t.tag, t.season);
  $('gameModalTitle').innerHTML = `${getTeamLogoHtml(t.tag, 20)} ${esc(teamLabel(t))} <span class="som-ot">${mode === 'series' ? 'séries' : `${bilan.W}-${bilan.L}-${bilan.OTL} · ${bilan.PTS} pts`}</span>`
    + (urlClub ? ` <a class="modal-lien" href="${esc(urlClub)}" target="_blank" rel="noopener" title="La saison du club sur Hockey-Reference">${ico('i-ext')}</a>` : '');
  $('gameModalBody').innerHTML = `
    <div class="section-label">${mode === 'series' ? 'Statistiques des séries' : 'Alignement et statistiques de la saison'}</div>
    <div class="table-wrap haute"><table class="data">
      <thead><tr><th class="left">Joueur</th><th>Pos</th><th>PJ</th><th>B</th><th>A</th><th class="heros">PTS</th><th>+/M</th><th>PUN</th><th>L</th><th>BAN</th></tr></thead>
      <tbody>${pat.map(ligneP).join('') || '<tr><td colspan="10">Aucun patineur.</td></tr>'}</tbody>
    </table></div>
    <div class="table-wrap" style="margin-top:8px"><table class="data">
      <thead><tr><th class="left">Gardien</th><th>Pos</th><th>PJ</th><th class="heros">V</th><th>D</th><th>DP</th><th>MBA</th><th>%ARR</th><th>BL</th></tr></thead>
      <tbody>${gar.map(ligneG).join('') || '<tr><td colspan="9">Aucun gardien.</td></tr>'}</tbody>
    </table></div>
    <div class="section-label" style="margin-top:14px">${mode === 'series' ? 'Les matchs des séries' : `Les ${journal.length} matchs de la saison`}</div>
    <div class="table-wrap haute"><table class="data calendrier-equipe">
      <thead><tr><th>#</th><th class="left">Adversaire</th><th>R</th><th>Pointage</th><th class="left">Gardien</th></tr></thead>
      <tbody>${resultats || '<tr><td colspan="5">Aucun match.</td></tr>'}</tbody>
    </table></div>
    <div class="section-label" id="eqVraieTitre">Sa vraie saison ${esc(t.season || '')} · reconstituée</div>
    <div class="stat-grid" id="eqVraie"><div class="dash-note eq-vraie-attente">On reconstitue la vraie saison…</div></div>`;
  /*
   * LA VRAIE SAISON ARRIVE EN ASYNCHRONE, comme dans l'onglet « La ligue » :
   * elle sort du shard du club, pas de la ligue en cours. Ce qui est
   * RECONSTITUÉ est dit comme tel — un shard porte des joueurs et pas un
   * classement, donc la fiche V-D vient des gardiens et le troisième nombre
   * est ce qui reste.
   *
   * UNE CASE ABSENTE SE TAIT (la règle de `grilleSim`, S60) : un club dont
   * un gardien a été échangé n'a pas de nuls déductibles, et quatre clubs
   * sur 1396 n'ont aucun gardien à eux. `motDeClub` dit alors pourquoi,
   * plutôt que de laisser un zéro l'affirmer.
   */
  if (t.isPlayer || !t.season) { $('eqVraie')?.remove(); $('eqVraieTitre')?.remove(); }
  else ficheReelleDe(t).then(f => {
    const h = $('eqVraie');
    if (!h) return;
    if (!f) { h.innerHTML = '<div class="dash-note eq-vraie-attente">Sa vraie saison n\'a pas pu être lue.</div>'; return; }
    const mot = motDeClub(f);
    h.innerHTML = cellStat('PJ', f.mj)
      + (f.V == null ? '' : cellStat('V', f.V, true) + cellStat('D', f.D))
      + (f.N == null ? '' : cellStat('N', f.N))
      + cellStat('BP', f.BP) + (f.BC == null ? '' : cellStat('BC', f.BC))
      + (mot ? `<div class="dash-note eq-vraie-mot">${esc(mot)}</div>` : '');
  });
  openModal('gameModal');
}

