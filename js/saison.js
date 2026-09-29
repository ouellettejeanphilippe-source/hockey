/**
 * L'ÉCRAN DE SAISON ET L'ÉCRAN DES SÉRIES : le poste du directeur général
 * pendant que ça se joue.
 *
 * JP : *make a better UI for the season and playoffs, not going to games
 * directly*. Avant, cliquer « Simuler » ouvrait le direct et les 82
 * journées défilaient toutes seules ; « Jouer les séries » entrait dans le
 * premier match sans passer par le tableau. Maintenant on arrive sur un
 * écran qu'on PILOTE : le prochain match de ta formation en tête, les
 * boutons qui font avancer le temps (une journée, dix, jusqu'à la fin ; un
 * match, la ronde, jusqu'à la Coupe), et des onglets qui disent où on en
 * est — la journée, le classement, les meneurs, ton équipe, ta fiche ; le
 * tableau des séries, ta série, la ronde. Le direct (js/direct.js) ne
 * s'ouvre plus que sur demande, « Regarder le match », un match à la fois.
 *
 * Tout est déjà joué (`simulateLeague`, `playSeries`) : cet écran RÉVÈLE,
 * il ne décide de rien. Le mystère tient à ce qu'on ne montre rien avant
 * que le joueur y arrive — le classement du jour se recalcule depuis le
 * calendrier, les meneurs se cumulent des feuilles de match, et le tableau
 * des séries ne dessine que les matchs révélés.
 *
 * Le module est aveugle aux données du jeu : `ctx` porte les fonctions
 * d'affichage de js/game.js (noms, écussons, échappement, portraits).
 */

import { SLOTS, compterFeuilles, tirsTotal, soirEreintant, CARTES, PALIERS_CARTES, mainDeCartes, SITUATIONS, jouerJusqua, jouerMatchSeries, echelleTardive,
  JOURS_SITUATIONS,
  MOMENTS, JOURS_MOMENTS, momentDuJour, SEQUENCES, RECUL_SEQUENCE,
  OBJECTIFS, JOURS_OBJECTIFS, objectifsOfferts, etatObjectif, MATCHS_OBJECTIF,
  getPlayerKey, ciblesDe, effetsEnCours, OBJECTIF_RATE, periodeDe,
  lignesDe, lignesDeGros, planProbable, IMPORTANCES, cibleMutation, dureeOption, TACTIQUES, SYSTEMES_D, systemeDe, fitUnite, MUTATIONS, motsDeMutation,
  contreDe, AJUSTEMENTS, ajustementsOfferts, MINI_BOSS, ELAN, SONNE,
  PLANS_ADV, AVANT_GROS, avantDuGros, ENTRACTES, INCIDENTS, entractesOfferts,
  mainDuDeck, SORTES_DECK, GAIN_STAGE, rolesOfferts, tactiquesDuStage, editionsDuJour, apprentissagePhoto, flechesDe,
  activeLineup, facteurGardienDe, lancersRelDe, filetDuSoir, jambesGardien, totauxDuSoir, motsDesTotaux } from './sim.js';
import { seasonLancers } from './ratings.js';
import { pronostic, conseilsDuMatch, chancesDesObjectifs, motDeChance } from './pronostic.js';
import { artJoueur, photoAction } from './cartes.js';
import { ouvrirChoix, choixOuvert, ouvrirLignes, resumeLignes, puces, planAdverseHtml, ouvrirMainDeMatch, ouvrirDeck, optionDeCarteMatch, mainAdverseHtml, depistageHtml, pistesDuRapport } from './gerant.js';
import { CARTES_MATCH, deckDe, mainDuMatch, recompensesOffertes, mainAdverse, energieAdverse, ENERGIE_MAIN, mainDeLAdjoint } from './combat.js';
import { diffuserMatch, pastilles } from './direct.js';
import { inscrireHub, retirerHub, signalerVue } from './coquille.js';
import { tempsRestant, NOM_PERIODE } from './recit.js';
import { animerComptes } from './mouvement.js';
import { ord, ordF, cap, nom, pct3 } from './util.js';

/*
 * APRÈS LE CHOIX DU DEUXIÈME ENTRACTE (S70), la saison se rejoue et l'écran
 * rouvre : il doit enchaîner sur la troisième période (le direct à 40:00, ou
 * la journée révélée) au lieu de rendre la main. Rien de ça n'est sauvegardé
 * — un rechargement redonne l'affiche, et « Journée suivante » la suite.
 */
let suiteEntracte = null, suiteEntracteSerie = null;

/*
 * LA BOÎTE DE RÉCEPTION SURVIT AUX REPRISES (S78). Chaque décision rejoue la
 * saison et reconstruit l'écran : ce qu'on a lu, archivé ou réglé sans
 * décision (« Garder mon alignement ») se garde donc ici, par graine de
 * saison, le temps de la page. Rien ne va dans la sauvegarde : un
 * rechargement redemande au pire de régler le dernier message, pas de rejouer.
 */
const BOITES = new Map();
function boiteDe(graine) {
  const k = String(graine);
  if (!BOITES.has(k)) BOITES.set(k, { lus: new Set(), archives: new Set(), traites: new Set(), ouvert: null });
  return BOITES.get(k);
}
/* Les pronostics déjà calculés (js/pronostic.js) : une même journée ne se rejoue pas deux fois. */
const PRONOS = new Map();
/* « 2e 14:05 » : l'instant d'un but, pour le tableau de l'entracte. */
// Un but à l'entracte : sa période et l'horloge du direct (le temps qu'il reste, `tempsRestant`).
const instantMot = t => { const per = Math.min(3, Math.floor(t / 20) + 1); return `${per === 1 ? '1re' : `${per}e`} ${tempsRestant(t)}`; };
/* Ce qui s'est passé au deuxième entracte d'un gros match, en une ligne. */
function motEntracte(ctx, mb) {
  const bits = [];
  if (mb.apres40) bits.push(`${mb.apres40.moi}–${mb.apres40.lui} après deux périodes`);
  const e = mb.entracte;
  const src = e ? (ENTRACTES[e.cle] || (e.incident && INCIDENTS[e.incident] ? INCIDENTS[e.incident].option : null)) : null;
  if (src) bits.push(`à l'entracte : ${src.ico} ${src.nom}`);
  const P = PLANS_ADV[mb.plan];
  // « Les canons de la pointe » perdait son « Le » et devenait « s canons » : on cite le plan tel quel.
  if (P) bits.push(`leur plan ${P.ico} « ${P.nom} » ${mb.contre ? 'contré' : 'pas contré'}`);
  return ctx.esc(bits.join(' · '));
}

/* « 1er », « 12e » : le rang d'un but ou d'une passe. */
/* La rivalité d'une saison (S69) : le club croisé le plus souvent dans les
   gros matchs, au moins deux fois, avant la journée `jusque`. */
function rivaliteDe(you, jusque = Infinity) {
  const par = new Map();
  for (const mb of you.minisBoss || []) {
    if (mb.jour >= jusque) continue;
    const x = par.get(mb.adv) || { adv: mb.adv, v: 0, d: 0 };
    if (mb.gagne) x.v++; else x.d++;
    par.set(mb.adv, x);
  }
  return [...par.values()].filter(x => x.v + x.d >= 2).sort((a, b) => (b.v + b.d) - (a.v + a.d) || b.d - a.d)[0] || null;
}
/* « 1er trio · AG », « 2e paire · DD », « Partant », « Réserve D ». */
const caseCourte = s => (s.group === 'F' && !s.scratch ? `${s.unit + 1}${s.unit ? 'e' : 'er'} trio · ${s.role}`
  : s.group === 'D' && !s.scratch ? `${s.unit + 1}${s.unit ? 'e' : 're'} paire · ${s.role}` : s.role);
const pct = (sv, sa) => pct3(sv / Math.max(1, sa));

/* ---------- la coquille : en-tête, carte, actions, onglets, volet ---------- */

function coquille(label) {
  const modal = document.getElementById('hubModal');
  if (!modal) return null;
  const $ = s => modal.querySelector(s);
  const sheet = $('.hub-sheet');
  if (sheet) sheet.setAttribute('aria-label', label);
  // LES OUTILS DE L'EN-TÊTE (S79) : tes cartes et la boutique, toujours en vue. Chaque écran pose les siens.
  const outils = $('.hub-outils');
  if (outils) outils.innerHTML = '';
  return { modal, head: $('.hub-head'), outils, carte: $('.hub-carte'), actions: $('.hub-actions'), barre: $('.hub-onglets'), volet: $('.hub-volet'), close: $('.hub-close') };
}

/*
 * LES ONGLETS DE L'ÉCRAN — EN BAS, comme la barre du jeu, et dans la même
 * langue (une icône, un mot). L'écran de saison est plein écran, donc la
 * barre du jeu est derrière lui : il n'y a JAMAIS qu'une barre d'onglets à
 * l'écran, et elle est toujours au même endroit. `rendre(cle)` fabrique le
 * volet au moment où on l'ouvre, et `rafraichir` le refait après chaque
 * journée ou chaque match.
 */
function onglets(barre, volet, liste, rendre) {
  let courant = liste[0].cle;
  barre.innerHTML = liste.map(o => `<button type="button" role="tab" data-onglet="${o.cle}" class="navtab${o.cle === courant ? ' on' : ''}" aria-selected="${o.cle === courant}">
    <svg class="ico" aria-hidden="true"><use href="#${o.ico}"/></svg>
    <span class="navtab-lbl">${o.titre}</span>
  </button>`).join('');
  // La pastille choisie reste en vue : la rangée des équipes en compte
  // trente-trois, et la tienne est rarement la première.
  const apresRendu = () => {
    // On déplace la RANGÉE de pastilles, jamais le volet : `scrollIntoView`
    // faisait descendre le volet jusqu'aux pastilles du bas et on ouvrait le
    // classement final au 21e rang.
    volet.querySelectorAll('.hub-chips').forEach(rangee => {
      const on = rangee.querySelector('button.on');
      if (on) rangee.scrollLeft = on.offsetLeft - (rangee.clientWidth - on.offsetWidth) / 2;
    });
    // LES CHIFFRES D'UN VOLET SE COMPTENT (S77, js/mouvement.js) : ce qui
    // porte `data-compte` roule depuis sa valeur d'hier — les tuiles du
    // portail, d'une journée à l'autre.
    animerComptes(volet);
  };
  const sheet = volet.closest('.hub-sheet');
  const pageDe = cle => (liste.find(o => o.cle === cle) || {}).page || null;
  const montrer = cle => {
    // UN AUTRE ONGLET S'OUVRE EN HAUT (S77). Au téléphone c'est la feuille
    // entière qui défile (S67) : le classement s'ouvrait à la hauteur où l'on
    // avait laissé l'affiche du match, au 3e rang. Le même onglet refait
    // après une journée garde sa place — on lit sous ses yeux.
    if (cle !== courant && sheet) sheet.scrollTop = 0;
    courant = cle;
    barre.querySelectorAll('button').forEach(b => {
      const on = b.dataset.onglet === cle;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    // LA VUE DE LA COQUILLE (S67) : la feuille de style en déduit ce qui se
    // montre — le match et ses boutons sur « Match », le volet seul ailleurs.
    if (sheet) sheet.dataset.vue = pageDe(cle) || '';
    volet.innerHTML = rendre(cle);
    volet.scrollTop = 0;
    // LE CHANGEMENT D'ONGLET SE VOIT (S77) : le volet entre en glissant, une
    // fois par changement — pas à chaque journée, où le classement se met à
    // jour sous les yeux (`rafraichir`) et un glissement serait du bruit.
    volet.classList.remove('volet-entre');
    void volet.offsetWidth;
    volet.classList.add('volet-entre');
    apresRendu();
    signalerVue();
  };
  barre.querySelectorAll('button').forEach(b => { b.onclick = () => montrer(b.dataset.onglet); });
  const rafraichir = () => { volet.innerHTML = rendre(courant); apresRendu(); };
  /*
   * APRÈS UNE AVANCE, on reste sur la page qu'on lit : le classement se met à
   * jour sous les yeux au lieu de sauter à la journée. On ne change de volet
   * que si on était sur « Match ».
   */
  const suivre = cle => { if (pageDe(courant) === 'match') montrer(cle); else rafraichir(); };
  const hub = { onglets: () => liste, montrer, courant: () => courant };
  inscrireHub(hub);
  return { montrer, rafraichir, suivre, courant: () => courant, hub };
}

/* =====================================================================
   LES TABLEAUX DE JOUEURS — le menu, pas la vitrine

   JP : *penser comme un menu de NHL avec des onglets, séries et saison,
   aussi, meneurs, plus de joueurs, possible de voir chaque équipe, avec
   tris, plus moins, tirs, pourcentage, etc.* Les meneurs montraient quinze
   pointeurs, dix buteurs, dix gardiens, dans un ordre imposé, et on ne
   pouvait pas ouvrir une autre équipe que la sienne. Maintenant : TOUS ceux
   qui ont joué, toutes les colonnes d'une fiche de hockey, et chaque
   en-tête trie. Les chiffres viennent des feuilles de match révélées
   (`compterFeuilles`), donc ils ne disent jamais plus que ce que le joueur
   a déjà vu.
   ===================================================================== */

const plusMoins = n => (n > 0 ? `+${n}` : `${n}`);
const VIDE = { g: 0, a: 0, pts: 0, gp: 0, w: 0, l: 0, sa: 0, sv: 0, ga: 0, bl: 0, pm: 0, sh: 0, pim: 0 };

/*
 * Les colonnes : lire (`v`), écrire (`fmt`), trier. `bas` dit que le
 * meilleur est le plus petit — la moyenne de buts alloués, et elle seule.
 */
const COL_PAT = [
  { cle: 'gp', t: 'PJ', v: c => c.gp },
  { cle: 'b', t: 'B', v: c => c.g },
  { cle: 'a', t: 'A', v: c => c.a },
  { cle: 'pts', t: 'PTS', v: c => c.pts, heros: true },
  { cle: 'pm', t: '+/-', v: c => c.pm, fmt: plusMoins },
  { cle: 'sh', t: 'T', v: c => c.sh },
  { cle: 'pct', t: '%T', v: c => (c.sh ? 100 * c.g / c.sh : 0), fmt: x => x.toFixed(1) },
  { cle: 'pim', t: 'PUN', v: c => c.pim },
];
const COL_GAR = [
  { cle: 'gp', t: 'PJ', v: c => c.gp },
  { cle: 'v', t: 'V', v: c => c.w, heros: true },
  { cle: 'd', t: 'D', v: c => c.l },
  { cle: 'arr', t: '%ARR', v: c => c.sv / Math.max(1, c.sa), fmt: pct3 },
  { cle: 'mba', t: 'MBA', v: c => c.ga / Math.max(1, c.gp), fmt: x => x.toFixed(2), bas: true },
  { cle: 'bl', t: 'BL', v: c => c.bl },
];

/** Le tri par défaut d'une colonne : du plus grand au plus petit, sauf la MBA. */
const triDe = (colonnes, cle) => ({ cle, asc: !!(colonnes.find(c => c.cle === cle) || {}).bas });

/* Les quatre tableaux du menu et leurs colonnes, pour que le tri s'applique
   au bon endroit sans que l'écran ait à le savoir. */
const COLS_DE = { meneursPAT: COL_PAT, meneursGAR: COL_GAR, eqPat: COL_PAT, eqGar: COL_GAR };

/** L'état d'un menu : la vue des meneurs, les tris, l'équipe ouverte, la limite. */
const menuNeuf = () => ({
  vue: 'PAT', limite: 60, equipe: null,
  tris: {
    meneursPAT: triDe(COL_PAT, 'pts'), meneursGAR: triDe(COL_GAR, 'v'),
    eqPat: triDe(COL_PAT, 'pts'), eqGar: triDe(COL_GAR, 'v'),
  },
});

/** Une clé d'équipe stable dans le DOM : le code et la saison. */
const cleEquipe = t => `${t.tag}|${t.season || ''}`;

/*
 * LES FICHES DE LA SAISON, AU FORMAT DU MENU. L'écran des séries montre
 * aussi la saison qui vient de finir — un menu de jeu laisse toujours
 * revenir en arrière — et la saison, elle, est entièrement connue : ses
 * chiffres se lisent directement des fiches du moteur plutôt que des
 * feuilles révélées.
 */
function compteDeFiches(teams) {
  const compte = new Map();
  const pose = p => {
    if (!p) return;
    compte.set(p, p.p === 'G'
      ? { g: 0, a: 0, pts: 0, gp: p.simGP || 0, w: p.simW || 0, l: (p.simL || 0) + (p.simOTL || 0),
          sa: p.simSA || 0, sv: p.simSV || 0, ga: p.simGA || 0, bl: p.simSO || 0, pm: 0, sh: 0, pim: 0 }
      : { g: p.simG || 0, a: p.simA || 0, pts: p.simPTS || 0, gp: p.simGP || 0, w: 0, l: 0,
          sa: 0, sv: 0, ga: 0, bl: 0, pm: p.simPM || 0, sh: p.simSH || 0, pim: p.simPIM || 0 });
  };
  for (const t of teams) { for (const s of SLOTS) pose(t.roster[s.i]); pose(t.rappelG); }
  return compte;
}

/*
 * UN NOM SE CLIQUE, ET SA FICHE NE DÉVOILE RIEN. `ctx.fiche` vient de
 * js/game.js et ouvre la fiche du joueur avec ce qu'il a fait JUSQU'ICI —
 * les feuilles révélées, jamais les compteurs `sim*` du moteur, qui portent
 * déjà les 82 matchs. Sans `ctx.fiche` (un appel d'un écran qui n'en fournit
 * pas), le nom reste du texte : l'écran ne casse pas.
 */
const nomLie = (ctx, l) => (ctx.fiche && l.p ? ctx.fiche(l.p, l.t, ctx.esc(l.nom)) : ctx.esc(l.nom));

/*
 * UN CODE D'ÉQUIPE OUVRE SON CLUB — DANS L'ÉCRAN, pas dans une modale.
 * L'onglet « Équipes » montre déjà n'importe quel club à ce jour ; l'ouvrir
 * en modale demanderait une deuxième version de la même chose, qui, elle,
 * lirait les compteurs de fin d'année. `brancherMenu` sait déjà lire
 * `data-equipe` ; `data-ouvrir` lui dit d'aller aussi à l'onglet.
 */
const versEquipe = (ctx, t, texte) => (t
  ? `<button type="button" class="lien-equipe" data-equipe="${ctx.esc(cleEquipe(t))}" data-ouvrir="equipes" title="L'alignement de ${ctx.esc(ctx.teamLabel(t))} à ce jour">${ctx.esc(texte)}</button>`
  : ctx.esc(texte));

/**
 * Un tableau de joueurs triable. `id` préfixe les `data-tri` pour que deux
 * tableaux du même volet ne se marchent pas dessus ; `tete` est la colonne
 * de gauche — le code d'équipe aux meneurs, la case dans une équipe.
 */
function tableJoueurs(ctx, { titre, id, colonnes, lignes, tri, tete = 'eq', limite = 0, note = '' }) {
  if (!lignes.length) return `<div class="live-tableau"><div class="live-tableau-titre">${ctx.esc(titre)}</div><div class="live-vide">Aucun match joué encore.</div></div>`;
  const col = colonnes.find(c => c.cle === tri.cle) || colonnes[colonnes.length - 1];
  const rangs = lignes.slice().sort((x, y) => {
    const d = col.v(x.c) - col.v(y.c);
    return (tri.asc ? d : -d) || (y.c.pts - x.c.pts) || (y.c.gp - x.c.gp);
  });
  const vues = limite && rangs.length > limite ? rangs.slice(0, limite) : rangs;
  const th = c => `<th data-tri="${id}|${c.cle}" role="button" tabindex="0" title="Trier par ${ctx.esc(c.t)}"
    class="tri${c.cle === col.cle ? ' tri-on' : ''}${c.heros ? ' heros' : ''}">${c.t}${c.cle === col.cle ? `<i>${tri.asc ? '▲' : '▼'}</i>` : ''}</th>`;
  const cellules = l => colonnes.map(c => {
    const val = c.v(l.c);
    return `<td class="${c.heros ? 'heros' : ''}${c.cle === col.cle ? ' tri-on' : ''}">${c.fmt ? c.fmt(val) : val}</td>`;
  }).join('');
  // Onze colonnes ne tiennent pas dans 390 px : le tableau défile en x dans
  // son propre conteneur, comme tous les tableaux du jeu.
  return `<div class="live-tableau hub-table"><div class="live-tableau-titre">${ctx.esc(titre)}</div>
    <div class="hub-scroll"><table><thead><tr><th>#</th><th>Joueur</th><th>${tete === 'eq' ? 'Éq.' : 'Profil'}</th>${colonnes.map(th).join('')}</tr></thead>
    <tbody>${vues.map((l, i) => `<tr class="${l.toi ? 'toi' : ''}${l.blesse ? ' blesse' : ''}${l.parti ? ' parti' : ''}">
      <td>${i + 1}</td><td class="nom">${nomLie(ctx, l)}${l.blesse ? ` <span class="hub-bl" title="Blessé">🩹 ${l.blesse}</span>` : ''}</td>
      <td class="${tete === 'eq' ? 'eq' : 'role'}">${tete === 'eq' ? versEquipe(ctx, l.t, l.eq) : ctx.esc(l.role)}</td>${cellules(l)}</tr>`).join('')}</tbody></table></div>
    ${vues.length < rangs.length ? `<button type="button" class="hub-plus" data-plus="${id}">Voir les ${rangs.length - vues.length} autres</button>` : ''}
    ${note ? `<div class="hub-note hub-table-note">${note}</div>` : ''}</div>`;
}

/** Une rangée de pastilles de choix (vue, équipe) : c'est le menu. */
const chips = (liste, actif, attr) => `<div class="hub-chips">${liste.map(o =>
  `<button type="button" data-${attr}="${o.cle}" class="${o.cle === actif ? 'on' : ''}"${o.titre ? ` title="${o.titre}"` : ''}>${o.html || o.nom}</button>`).join('')}</div>`;

/**
 * LES MENEURS : tous ceux qui ont joué, patineurs ou gardiens, triables sur
 * n'importe quelle colonne. `etat` garde la vue, le tri et la limite
 * d'affichage entre deux rendus — le volet se refait à chaque journée.
 */
function meneursHtml(ctx, compte, equipeDe, you, titre, menu, minGardien = 1) {
  const entrees = [...compte.entries()];
  if (!entrees.length) return '<div class="live-vide">Aucun match joué encore.</div>';
  const ligne = ([p, c]) => {
    const t = equipeDe.get(p) || null;
    return { p, t, nom: nom(p), eq: ctx.tagCourt(t || { tag: '—' }), toi: t === you, c };
  };
  const gardiens = menu.vue === 'GAR';
  const lignes = entrees.filter(([p, c]) => (gardiens ? p.p === 'G' && c.gp >= minGardien : p.p !== 'G' && c.gp > 0)).map(ligne);
  return chips([{ cle: 'PAT', nom: 'Patineurs' }, { cle: 'GAR', nom: 'Gardiens' }], menu.vue, 'vue')
    + tableJoueurs(ctx, {
      titre: `${gardiens ? 'Gardiens' : 'Patineurs'} · ${titre}`, id: `meneurs${menu.vue}`,
      colonnes: gardiens ? COL_GAR : COL_PAT, lignes,
      tri: menu.tris[`meneurs${menu.vue}`], limite: menu.limite,
      note: 'Touche un en-tête pour trier ; glisse le tableau pour voir toutes les colonnes.',
    });
}

/**
 * LES ÉQUIPES : n'importe quel club de la ligue, son alignement et ce que
 * chacun a fait à ce jour. La case de chaque joueur reste affichée — c'est
 * une feuille d'équipe, pas un palmarès — et les colonnes se trient pareil.
 */
function equipesHtml(ctx, { teams, compte, you, menu, ficheDe, matchsDe, blessesDe, anciens = () => [] }) {
  if (!teams.length) return '<div class="live-vide">Aucune équipe.</div>';
  const t = teams.find(x => x === menu.equipe) || (teams.includes(you) ? you : teams[0]);
  menu.equipe = t;
  const pastille = x => ({
    cle: cleEquipe(x), nom: ctx.tagCourt(x), titre: ctx.teamLabel(x),
    html: `${ctx.logo(x.tag, 15)}<span>${ctx.esc(ctx.tagCourt(x))}</span>`,
  });
  const choix = chips(teams.map(pastille), cleEquipe(t), 'equipe');
  const joues = matchsDe(t);
  const blesses = blessesDe ? blessesDe(t, joues) : new Map();
  const rangee = s => {
    const p = t.roster[s.i];
    if (!p) return null;
    // Pas de rangée en or ici : c'est une feuille d'équipe, l'or ne dirait
    // rien de plus que l'en-tête. Il reste aux meneurs, où il te trouve.
    return { p, t, nom: nom(p), role: ctx.quiEst ? ctx.quiEst(p, { stats: false }) : caseCourte(s), blesse: blesses.get(p) || 0, c: compte.get(p) || VIDE };
  };
  const pat = SLOTS.filter(s => s.group !== 'G').map(rangee).filter(Boolean);
  const gar = SLOTS.filter(s => s.group === 'G').map(rangee).filter(Boolean);
  // Le gardien de rappel n'a pas de case, mais il a gardé des matchs.
  if (t.rappelG && compte.get(t.rappelG)) gar.push({ p: t.rappelG, t, nom: nom(t.rappelG), role: 'Rappel', c: compte.get(t.rappelG) });
  /*
   * CEUX QUI SONT PARTIS (S80). JP : *voir joueurs échangés dans les stats de l'équipe quand même,
   * ben, retirés de l'alignement*. Un joueur sorti de l'alignement (qui sort, ballottage, relâché)
   * garde sa ligne : ce qu'il a fait chez toi, grisé, avec le mot qui dit qu'il n'y est plus.
   */
  for (const p of anciens(t)) {
    const r = { p, t, nom: nom(p), role: "Retiré de l'alignement", parti: true, c: compte.get(p) || VIDE };
    (p.p === 'G' ? gar : pat).push(r);
  }
  const f = ficheDe(t);
  return `${choix}
    <div class="hub-eq-entete" style="--eq-band:${ctx.band(t.tag).bg};--eq-ink:${ctx.band(t.tag).ink};--eq-stripe:${ctx.band(t.tag).stripe}">
      <div class="hub-eq-entete-band">${ctx.logo(t.tag, 24)}<span>${ctx.esc(ctx.teamLabel(t))}</span></div>
      <div class="hub-eq-entete-fiche">${ctx.esc(f)}</div>
    </div>
    ${tableJoueurs(ctx, { titre: `Patineurs · ${joues} match${joues > 1 ? 's' : ''}`, id: 'eqPat', colonnes: COL_PAT, lignes: pat, tri: menu.tris.eqPat, tete: 'role' })}
    ${tableJoueurs(ctx, { titre: 'Gardiens', id: 'eqGar', colonnes: COL_GAR, lignes: gar, tri: menu.tris.eqGar, tete: 'role' })}`;
}

/**
 * Le menu réagit : trier une colonne, changer de vue, ouvrir une équipe,
 * voir tout le monde. Un seul écouteur par écran, posé sur le volet — c'est
 * le contenu du volet qui est refait à chaque journée, pas le volet.
 */
function brancherMenu(volet, menu, equipes, rafraichir, ouvrirOnglet = null, carte = null) {
  const zones = [volet, carte].filter(Boolean);
  const agir = ev => {
    const el = ev.target.closest('[data-tri], [data-vue], [data-equipe], [data-plus]');
    if (!el || !zones.some(z => z.contains(el))) return;
    const d = el.dataset;
    if (d.tri) {
      const [id, cle] = d.tri.split('|');
      const colonnes = COLS_DE[id];
      if (!colonnes) return;
      const t = menu.tris[id];
      menu.tris[id] = t && t.cle === cle ? { cle, asc: !t.asc } : triDe(colonnes, cle);
    } else if (d.vue) menu.vue = d.vue === 'GAR' ? 'GAR' : 'PAT';
    else if (d.equipe) {
      menu.equipe = equipes().find(t => cleEquipe(t) === d.equipe) || menu.equipe;
      // Le code d'équipe d'un tableau de meneurs vient d'un AUTRE onglet :
      // changer le club sans changer d'onglet ne montrerait rien.
      if (d.ouvrir && ouvrirOnglet) { ev.preventDefault(); ouvrirOnglet(d.ouvrir); return; }
    } else if (d.plus) menu.limite = 0;
    ev.preventDefault();
    rafraichir();
  };
  const touche = ev => { if (ev.key === 'Enter' || ev.key === ' ') agir(ev); };
  for (const z of zones) { z.addEventListener('click', agir); z.addEventListener('keydown', touche); }
  // LE VOLET EST PARTAGÉ par l'écran de saison et l'écran des séries (la même
  // coquille `#hubModal`) : sans débrancher en fermant, le menu de la saison
  // répondait encore aux clics de celui des séries et réécrivait le volet
  // avec son propre classement.
  return () => { for (const z of zones) { z.removeEventListener('click', agir); z.removeEventListener('keydown', touche); } };
}


/*
 * LA ROUTE DE LA SAISON, à la carte de Slay the Spire : ce qui s'en vient se
 * VOIT. Les moments sont à des journées fixes — dilemmes, cartes, proprio,
 * vestiaire — et une route qu'on voit venir se planifie ; une surprise qu'on
 * ne voit jamais venir ne se joue pas, elle se subit.
 */
function routeHtml(jour, N) {
  const pos = j => `${(100 * Math.min(j, N) / N).toFixed(1)}%`;
  // Deux rangées : ce qu'on GAGNE au-dessus de la ligne (le proprio, les
  // cartes), ce qui ARRIVE dessous (les dilemmes, le vestiaire). Sur 82
  // journées dans 350 px, une rangée seule les empilait.
  const marque = (j, ico, titre, rang) => `<span class="hub-route-m ${rang}${j < jour ? ' passe' : ''}" style="left:${pos(j)}" title="Journée ${j} · ${titre}">${ico}</span>`;
  const marques = [
    ...JOURS_OBJECTIFS.map(j => marque(j, '🏢', 'le proprio fixe un objectif', 'haut')),
    ...PALIERS_CARTES.map(j => marque(j, '🃏', 'une carte à prendre', 'haut')),
    ...JOURS_MOMENTS.map(j => marque(j, '❓', 'un dilemme', 'bas')),
    ...JOURS_SITUATIONS.map(j => marque(j, '💬', 'le vestiaire vit quelque chose', 'bas')),
  ].join('');
  return `<div class="hub-route" aria-hidden="true"><span class="hub-route-fait" style="width:${pos(jour)}"></span>${marques}<span class="hub-route-ici" style="left:${pos(jour)}"></span></div>`;
}

/*
 * Le bloc d'une équipe dans la carte du prochain match : écusson, nom, fiche,
 * et sa forme (S79). Ta fiche vit dans l'en-tête : ton bloc ne la répète pas.
 */
function blocEquipe(ctx, t, ligne, pos, forme = '') {
  const b = ctx.band(t.tag);
  return `<div class="hub-eq ${pos}" style="--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
    <div class="hub-eq-band">${ctx.logo(t.tag, 26)}<span>${ctx.esc(ctx.tagCourt(t))}</span></div>
    <div class="hub-eq-nom">${versEquipe(ctx, t, ctx.teamLabel(t))}</div>
    ${ligne ? `<div class="hub-eq-fiche">${ctx.esc(ligne)}</div>` : ''}
    ${forme ? `<div class="hub-eq-forme">${forme}</div>` : ''}
  </div>`;
}

/*
 * LA SUITE À PORTÉE DU POUCE (S74). Un soir de gros match, « Journée
 * suivante » tombait à 1 300 px de haut sur un téléphone : sous le plan, sa
 * main, l'affiche. Quand le vrai bouton n'est pas à l'écran, un bouton
 * flottant le remplace au-dessus de la barre — le même, qui clique le vrai.
 * Rien au-delà de 1 200 px : la colonne de gauche y tient ses boutons.
 */
function boutonFlottant(actions, termine) {
  let f = document.getElementById('hubFlottant');
  if (!f) {
    f = document.createElement('button');
    f.id = 'hubFlottant'; f.type = 'button'; f.className = 'btn go hub-flottant'; f.hidden = true;
    document.body.appendChild(f);
  }
  if (f._io) { f._io.disconnect(); f._io = null; }
  const cible = actions && actions.querySelector('.hub-jour, .hub-traiter');
  if (!cible || termine) { f.hidden = true; return; }
  f.textContent = `${cible.textContent.trim()} ▶`;
  // Un bouton sorti du DOM (l'écran s'est redessiné sans lui) garde son onclick :
  // le cliquer rejouerait un vieux geste — « Ronde 5 · 0 série » (QA S74b).
  f.onclick = () => { f.hidden = true; if (cible.isConnected) cible.click(); };
  f._io = new IntersectionObserver(([e]) => { f.hidden = e.isIntersecting || window.innerWidth >= 1200; }, { threshold: 0.6 });
  f._io.observe(cible);
}
function cacherBoutonFlottant() {
  const f = document.getElementById('hubFlottant');
  if (f) { f.hidden = true; if (f._io) { f._io.disconnect(); f._io = null; } }
}

/* =====================================================================
   La saison, journée par journée
   ===================================================================== */

/**
 * Ouvre l'écran de saison. RIEN N'EST JOUÉ D'AVANCE (S79) : `ligue` est la
 * ligue du moteur (`creerLigue`), et chaque journée se joue au moment où
 * l'écran la révèle (`appliquerJour`). L'écran appelle `onTermine` quand on
 * passe au bilan.
 *
 *   calendrier  [jour][match] = { A, B } — la cédule, posée d'avance ; une
 *               journée jouée y ajoute { gfA, gfB, ot, feuille, joue }
 *   ligue       la ligue du moteur, ou null (une saison déjà jouée en entier)
 *   teams       les 32 équipes (leurs compteurs sont ceux du jour joué : le
 *               classement de l'écran se recalcule quand même du calendrier)
 *   you         ton équipe
 *   enSeries    combien d'équipes vont en séries (seize, ou moins dans une petite ligue)
 *   epoque      la saison jouée quand la ligue est fixée à une année, sinon null
 *   ctx         { esc, teamLabel, teamShort, tagCourt, logo, band, mug }
 *   depuis      la journée déjà révélée quand on REPREND une partie : le
 *               moteur est déterministe, donc la même graine rejoue la même
 *               saison et l'écran n'a qu'à réappliquer les journées d'avant
 *               avant de dessiner
 *   onJour      appelé à chaque avance avec le numéro de journée révélée :
 *               c'est ce que le contrôleur écrit dans la sauvegarde
 */
export function ouvrirSaison({ calendrier, ligue = null, teams, you, enSeries = 16, epoque = null, ctx, onTermine, depuis = 0, onJour = null, onBanc = null, graine = 0, cartesPrises = [], onCarte = null, onTrou = null, trousPris = [], decisions = [], onDecision = null }) {
  const ui = coquille('La saison');
  if (!ui || !calendrier.length) { onTermine(); return; }
  const { modal, head, carte, actions, barre, volet } = ui;
  const N = calendrier.length;
  let jour = 0, termine = false;

  // Les feuilles de match, cumulées journée après journée : les meneurs, ton
  // équipe, le xième but. Et la fiche de chaque club, pour le classement.
  const compte = new Map();
  const equipeDe = new Map();
  for (const t of teams) for (const p of Object.values(t.roster || {})) if (p) equipeDe.set(p, t);
  // Le gardien de rappel n'a pas de case, mais il a une équipe.
  for (const t of teams) if (t.rappelG) equipeDe.set(t.rappelG, t);
  // Les tirs pour et contre, et les unités spéciales (S78) : ce que le dépisteur
  // compare, lu sur les feuilles révélées — jamais sur une cote.
  const fiche = new Map(teams.map(t => [t, { W: 0, L: 0, OTL: 0, GF: 0, GA: 0, PTS: 0, SF: 0, SA: 0, PPG: 0, PPO: 0, PKGA: 0, PKO: 0 }]));
  // Les résultats de chaque club dans l'ordre ('V', 'D', 'DP') : la séquence
  // et les dix derniers matchs, les deux colonnes qu'un journal donne toujours.
  const resultats = new Map(teams.map(t => [t, []]));
  const miens = [];   // { j, k, m } : tes matchs joués, dans l'ordre
  const cumuler = m => {
    const a = fiche.get(m.A), b = fiche.get(m.B);
    if (!a || !b) return;
    a.GF += m.gfA; a.GA += m.gfB; b.GF += m.gfB; b.GA += m.gfA;
    const gagneA = m.gfA > m.gfB;
    if (gagneA) { a.W++; if (m.ot) b.OTL++; else b.L++; } else { b.W++; if (m.ot) a.OTL++; else a.L++; }
    a.PTS = a.W * 2 + a.OTL; b.PTS = b.W * 2 + b.OTL;
    const f = m.feuille;
    if (f) {
      const tA = tirsTotal(f, 'A'), tB = tirsTotal(f, 'B');
      a.SF += tA; a.SA += tB; b.SF += tB; b.SA += tA;
      // `cote` d'une punition : l'équipe punie ; l'autre a l'avantage.
      const punA = (f.punitions || []).filter(x => x.cote === 'A').length, punB = (f.punitions || []).filter(x => x.cote === 'B').length;
      const anA = f.buts.filter(x => x.cote === 'A' && x.an).length, anB = f.buts.filter(x => x.cote === 'B' && x.an).length;
      a.PPO += punB; b.PPO += punA; a.PKO += punA; b.PKO += punB;
      a.PPG += anA; b.PPG += anB; a.PKGA += anB; b.PKGA += anA;
    }
    resultats.get(m.A).push(gagneA ? 'V' : m.ot ? 'DP' : 'D');
    resultats.get(m.B).push(gagneA ? (m.ot ? 'DP' : 'D') : 'V');
  };
  /* « V3 », « D2 » : la séquence en cours (une défaite en prolongation compte comme une défaite). */
  const sequenceDe = t => {
    const r = resultats.get(t) || [];
    if (!r.length) return '—';
    const gagne = x => x === 'V';
    let n = 0;
    for (let i = r.length - 1; i >= 0 && gagne(r[i]) === gagne(r[r.length - 1]); i--) n++;
    return `${gagne(r[r.length - 1]) ? 'V' : 'D'}${n}`;
  };
  /* « 7-2-1 » : les dix derniers matchs. */
  const dixDerniers = t => {
    const r = (resultats.get(t) || []).slice(-10);
    return r.length ? `${r.filter(x => x === 'V').length}-${r.filter(x => x === 'D').length}-${r.filter(x => x === 'DP').length}` : '—';
  };
  const classement = () => teams.slice().sort((x, y) => {
    const a = fiche.get(x), b = fiche.get(y);
    // Le même bris d'égalité que le classement final de js/sim.js, puis le
    // club : deux fiches identiques se rangeaient dans l'ordre du tableau
    // `teams`, et une saison REPRISE (derrière le banc) le rebâtit — le rang
    // en tête passait de 6e à 7e sans qu'un match ait changé.
    return b.PTS - a.PTS || b.W - a.W || (b.GF - b.GA) - (a.GF - a.GA) || b.GF - a.GF
      || String(`${x.tag}${x.season || ''}`).localeCompare(String(`${y.tag}${y.season || ''}`));
  });
  const rangDe = t => classement().indexOf(t) + 1;
  const ficheTexte = t => { const f = fiche.get(t); return `${f.W}-${f.L}-${f.OTL}`; };
  const gagne = (m, t) => (m.A === t) === (m.gfA > m.gfB);
  const indexMien = j => calendrier[j].findIndex(m => m.A === you || m.B === you);
  /* Ton prochain match : la première journée à venir où tu joues. */
  const prochain = () => {
    for (let j = jour; j < N; j++) { const k = indexMien(j); if (k >= 0) return { j, k, m: calendrier[j][k] }; }
    return null;
  };
  /* « V3 », « D2 » : la séquence en cours. */
  const sequence = () => {
    if (!miens.length) return '';
    const dernier = gagne(miens[miens.length - 1].m, you);
    let n = 0;
    for (let i = miens.length - 1; i >= 0 && gagne(miens[i].m, you) === dernier; i--) n++;
    return `${dernier ? 'V' : 'D'}${n}`;
  };

  function appliquerJour(j) {
    // La journée se JOUE ici, au moment d'être révélée — jamais avant (S79).
    if (ligue) jouerJusqua(ligue, j + 1);
    const matchs = calendrier[j];
    for (const m of matchs) cumuler(m);
    compterFeuilles(matchs.map(m => m.feuille), compte);
    const k = indexMien(j);
    if (k >= 0) miens.push({ j, k, m: matchs[k] });
  }
/*
   * UNE BLESSURE ARRÊTE LA SAISON. JP : *plus de moment roguelike dans la
   * saison, comme devoir faire les remplacements lors de blessures*.
   *
   * Le moteur blesse déjà — `applyInjuries` retire le joueur de l'alignement
   * du jour et promeut un réserviste à sa place — mais la saison défilait
   * par-dessus : on l'apprenait après coup, dans l'onglet des équipes, une
   * fois les dix journées passées. Il n'y avait donc aucun MOMENT.
   *
   * Rien n'est inventé ici : la blessure a déjà eu lieu dans la simulation,
   * et l'écran ne fait que s'arrêter dessus. Ce qui la rend jouable, c'est le
   * rail qui existe — « Derrière le banc » remanie l'alignement, pousse une
   * décision et REJOUE depuis ce jour-là (`reprendreSaison`, js/game.js). La
   * blessure devient donc une vraie décision, et elle se rejoue comme tout
   * le reste.
   *
   * Le seuil existe parce qu'un match raté n'est pas un événement : sous
   * `BLESSURE_MOMENT` matchs, la saison continue sans rien dire.
   */
  /*
   * LES CARTES DE SAISON. À trois paliers, on prend une carte parmi trois —
   * un bonus payé par un malus (`CARTES`, js/sim.js). La main offerte se
   * tire de la GRAINE et du jour, donc la même partie rejouée offre
   * exactement les mêmes trois cartes ; et prendre une carte est une
   * DÉCISION, donc la saison se rejoue de la graine avec elle.
   *
   * Un palier ARRÊTE l'avance UNE FOIS : c'est un moment, pas une
   * notification qu'on dépasse. Il ne bloque rien — « Journée suivante »
   * reste dessous et l'offre tient tant qu'on ne l'a pas prise — mais il ne
   * s'arrête pas deux fois, sans quoi « +10 journées » avancerait d'UNE
   * journée par clic pour qui a décidé de ne pas choisir. C'est la règle
   * des blessures, appliquée aux paliers.
   *
   * DEUX CLÉS, PAS UNE. Le PALIER dit quelle offre est déjà servie ; le JOUR
   * où la carte a été prise, lui, est celui où elle entre en vigueur, et les
   * deux diffèrent dès qu'on laisse passer un palier sans choisir. Les
   * confondre rembobinerait la saison au palier — on perdrait les journées
   * déjà lues pour une carte prise après coup.
   */
  const prises = new Set(cartesPrises.map(x => x.palier));
  // Les cartes DÉJÀ prises ne reparaissent pas dans une main : on compose
  // une saison, on n'empile pas trois fois le même curseur.
  const dejaPrises = cartesPrises.map(x => x.carte).filter(Boolean);
  const palierOuvert = () => (onCarte ? PALIERS_CARTES.find(j => jour >= j && !prises.has(j)) : undefined);
  const paliersVus = new Set();      // les paliers qui ont déjà arrêté l'avance
  /*
   * LES PALIERS DÉJÀ PROPOSÉS À CE PASSAGE (S74). La main s'ouvrait seulement
   * quand un clic s'arrêtait sur le palier ; un choix forcé tombé le même jour
   * (le verdict du proprio arrive aux journées 20, 40 et 60) passait devant,
   * la saison se rejouait sans « arrêt », et la main ne s'ouvrait plus jamais
   * — l'agent de test l'a perdue trois fois sur trois au bureau. Maintenant :
   * tant qu'un palier est ouvert, sa main s'ouvre d'elle-même une fois par
   * passage de l'écran, dès qu'aucun autre choix n'est à l'écran.
   */
  const palProposes = new Set();

  /*
   * LES SITUATIONS. Elles ne sont pas une décision — elles ARRIVENT, tirées
   * de la graine (voir `SITUATIONS`, js/sim.js) — donc l'écran n'a rien à
   * sauvegarder : il s'arrête dessus, les nomme, et laisse « Derrière le
   * banc » faire le reste. C'est la seule des trois interruptions qui ne
   * demande AUCUN clic : ne rien faire est une réponse parfaitement valable,
   * elle est simplement moins bonne que de monter le joueur en feu.
   */
  const situVues = new Set();
  /*
   * LES ACCIDENTS DE CARTE (S68) : ils arrivent tout seuls, tirés de la
   * graine — l'écran s'arrête dessus et dit, en chiffres, ce qui change sur
   * la carte du joueur. Comme une situation : rien à cliquer, la réponse est
   * l'alignement (et « Mes lignes », puisque son fit a bougé).
   */
  const accVus = new Set();
  const accidentsNeufs = () => (you.mutations || []).filter(m => m.source === 'accident' && m.jour <= jour && !accVus.has(m));
  let accident = null;
  const situationsNeuves = () => (you.situations || []).filter(f => !situVues.has(f) && f.jour <= jour);
  let situation = null;

  /*
   * LA CASE VIDE. JP : *pour les blessures, faire que si pas de joueur à la
   * position, carte random pigée*. Quand `activeLineup` ne trouve plus aucun
   * réserviste compatible, la case reste vide et le moteur y met un joueur de
   * remplacement — c'est le pire moment d'une saison, et il arrive **1,02
   * fois par équipe par saison** (mesuré sur 96 équipes-saisons : médiane 1,
   * 90e centile 2, maximum 5). Une par saison : un vrai moment, pas une
   * nuisance, et le budget de cartes passe de trois à quatre dans les
   * mauvaises années.
   *
   * LA CARTE EST TIRÉE, PAS CHOISIE, et c'est tout l'intérêt : tu n'as pas
   * décidé de perdre ton auxiliaire, tu ne décides pas de la compensation.
   * Comme toutes les cartes portent un bonus ET un malus, ce n'est même pas
   * un cadeau — c'est un ajustement qui peut ne pas te convenir, ce qui est
   * exactement ce qu'est une crise d'effectif.
   *
   * Le tirage passe par `mainDeCartes`, donc il est PUR (même graine, même
   * épisode, même carte) et il ne retend jamais une carte déjà prise.
   */
  /*
   * LES ÉPISODES DÉJÀ ENCAISSÉS survivent à la reprise. Encaisser la carte
   * rejoue la saison depuis ce jour-là, donc `ouvrirSaison` est reconstruit
   * et `trousVus` repart vide : sans cette liste, le même trou retendrait sa
   * carte à l'infini, et chaque clic en ajouterait une à la partie.
   */
  const trousFaits = new Set(trousPris);
  const trousVus = new Set();
  const trousNeufs = () => (you.trous || [])
    .filter(t => !trousVus.has(t) && !trousFaits.has(t.at) && t.at <= miens.length);
  let trou = null;
  const carteDuTrou = t => mainDeCartes(graine, 1000 + t.at, dejaPrises)[0] || null;

  const BLESSURE_MOMENT = 4;

  /*
   * LES MOMENTS (S66). Tout ce qui est déjà décidé se lit dans `decisions` —
   * il n'y a pas d'autre état, et une reprise retrouve exactement les mêmes
   * offres. Les trois familles FORCÉES (le dilemme, la séquence, le proprio)
   * cachent « Journée suivante » tant qu'on n'a pas choisi : c'est ce que JP
   * a demandé, un choix qu'on ne peut pas dépasser. « La fin » passe
   * par-dessus — qui demande la fin demande la fin.
   */
  const decs = decisions || [];
  /*
   * LES TOTAUX DU SOIR (1.0, C5). Ce que le moteur appliquera au match de la
   * journée `j` : les effets déjà posés, plus les décisions pas encore jouées
   * d'ici là (le moteur ne les applique qu'en jouant la journée). `brouillon`
   * remplace la consigne et les lignes de ce soir-là (« Préparer le match »).
   */
  const totauxDuMatch = (j, brouillon = null) => {
    const aVenir = decs.filter(d => d.jour >= jour && d.jour <= j && !d.entracte && !(brouillon && d.jour === j && (d.match || d.lignes)));
    if (brouillon) aVenir.push({ jour: j, ...brouillon });
    const jc = you.jourCourant;
    you.jourCourant = j;
    try { return totauxDuSoir(you, null, null, aVenir); } finally { you.jourCourant = jc; }
  };
  const pris = new Set(decs.filter(d => typeof d.palier === 'string').map(d => d.palier));
  const momentsAvant = J => decs.filter(d => d.moment && d.moment.famille === 'moment'
    && typeof d.palier === 'string' && Number(d.palier.slice(2)) < J).map(d => d.moment.cle);
  const dilemmeOuvert = () => {
    if (!onDecision || jour >= N) return null;
    // PAS LE SOIR D'UN GROS MATCH (S79, JP : *un jour de match important… ça devrait pas être
    // synchro*) : le dilemme attend le lendemain — il reste ouvert tant qu'il n'est pas pris.
    if (grosDuJour(jour)) return null;
    const J = JOURS_MOMENTS.find(j => jour >= j && !pris.has(`m:${j}`));
    if (J === undefined) return null;
    const faits = faitsAvant(J);
    const cle = momentDuJour(graine, J, momentsAvant(J), faits);
    if (!cle) return null;
    return { J, cle, faits: MOMENTS[cle].faits ? MOMENTS[cle].faits(faits) : null };
  };
  /*
   * CE QUI EST VRAIMENT ARRIVÉ AVANT UN DILEMME (S80). JP : *les trucs comme,
   * après neuf buts encaissés… faut que ça soit arrivé pour vrai*. Un dilemme
   * qui affirme un fait de match (le gardien laissé devant le filet, le doublé
   * de l'ailier, la séquence de la barbe) ne se tire que si ce fait est vrai,
   * lu sur tes matchs d'AVANT la journée prévue — le même avant et après un
   * report —, et il dit les vrais chiffres (`MOMENTS[c].faits`, js/sim.js).
   */
  const faitsAvant = J => {
    const avant = miens.filter(x => x.j < J);
    const coteDe = m => (m.A === you ? 'A' : 'B');
    const d = avant[avant.length - 1];
    let dernier = null;
    if (d) {
      const m = d.m, cote = coteDe(m), f = m.feuille || { buts: [], lancers: [], punitions: [] };
      const buteurs = new Map();
      for (const b of f.buts) if (b.cote === cote && b.marqueur) buteurs.set(b.marqueur, (buteurs.get(b.marqueur) || 0) + 1);
      // Ton gardien : celui qui a reçu les tirs d'en face.
      const recus = new Map();
      for (const l of f.lancers || []) if (l.cote !== cote && l.gardien) recus.set(l.gardien, (recus.get(l.gardien) || 0) + 1);
      const gardien = [...recus].sort((a, b) => b[1] - a[1])[0];
      const blesses = (f.blessures || []).filter(x => x.cote === cote).map(x => x.joueur);
      dernier = {
        domicile: cote === 'A', pour: cote === 'A' ? m.gfA : m.gfB, contre: cote === 'A' ? m.gfB : m.gfA,
        gardien: gardien ? gardien[0] : null,
        buteurs: [...buteurs].map(([p, buts]) => ({ p, buts, avant: p.p !== 'G' && !/D$/.test(p.p || '') })),
        punitionsTard: (f.punitions || []).filter(x => x.cote === cote && x.instant >= 55 && x.instant < 60).length,
        gardienBlesse: blesses.find(p => p && p.p === 'G') || null,
      };
    }
    let serieV = 0;
    for (let i = avant.length - 1; i >= 0 && gagne(avant[i].m, you); i--) serieV++;
    // Les buts de chacun sur tes douze derniers matchs.
    const recents = avant.slice(-12), butsRecents = new Map();
    for (const { m } of recents) for (const b of (m.feuille ? m.feuille.buts : [])) if (b.cote === coteDe(m) && b.marqueur) butsRecents.set(b.marqueur, (butsRecents.get(b.marqueur) || 0) + 1);
    const habilles = g => SLOTS.filter(s => !s.scratch && s.group === g).map(s => you.roster[s.i]).filter(Boolean);
    const age = p => (p.bd && p.s ? parseInt(p.s, 10) - parseInt(p.bd, 10) : 0);
    return {
      J, dernier, serieV, recents: recents.length,
      joueurs: habilles('F').map(p => ({ p, marqueur: (p.g || 0) >= 25, butsRecents: butsRecents.get(p) || 0 })),
      veteransD: habilles('D').filter(p => age(p) >= 33).sort((a, b) => age(b) - age(a)),
    };
  };
  /* Tes matchs sous la forme que les objectifs lisent. */
  const mesMatchs = depuisJ => miens.filter(x => x.j >= depuisJ).map(({ m }) => {
    const cote = m.A === you ? 'A' : 'B';
    const pour = m.A === you ? m.gfA : m.gfB, contre = m.A === you ? m.gfB : m.gfA;
    return { v: pour > contre, pour, contre, buts: (m.feuille?.buts || []).filter(b => b.cote === cote) };
  });
  const derniereSequence = () => decs.filter(d => d.moment && d.moment.famille === 'sequence')
    .reduce((a, d) => Math.max(a, d.jour), -Infinity);
  const sequenceOuverte = () => {
    if (!onDecision || jour >= N || !miens.length) return null;
    let v = 0, d = 0;
    for (let i = miens.length - 1; i >= 0 && gagne(miens[i].m, you); i--) v++;
    for (let i = miens.length - 1; i >= 0 && !gagne(miens[i].m, you); i--) d++;
    const cle = d >= SEQUENCES.defaites.seuil ? 'defaites' : v >= SEQUENCES.victoires.seuil ? 'victoires' : null;
    if (!cle) return null;
    // L'identité d'une séquence est le match où elle a franchi son seuil :
    // elle ne se représente pas quand elle s'allonge, et la reprise la
    // reconnaît.
    const palier = `s:${miens.length - (cle === 'defaites' ? d : v) + SEQUENCES[cle].seuil}`;
    if (pris.has(palier) || jour - derniereSequence() < RECUL_SEQUENCE) return null;
    // UNE FOIS PAR SAISON CHACUNE (QA S74b) : une bonne équipe enfilait quatre
    // victoires aux jours 4, 14, 32 et 53, et la même carte revenait quatre
    // fois. Un moment qui revient n'est plus un moment.
    if (decs.some(x => x.moment && x.moment.famille === 'sequence' && x.moment.cle === cle)) return null;
    // La longueur VRAIE : le recul a pu la faire attendre, et à six victoires
    // le titre ne dit plus « quatre ».
    return { cle, palier, n: cle === 'defaites' ? d : v };
  };
  const objectifDe = j0 => decs.find(d => d.objectif && d.palier === `o:${j0}`);
  const offreObjectif = () => {
    if (!onDecision || jour >= N) return null;
    const j0 = JOURS_OBJECTIFS.find(j => jour >= j && !pris.has(`o:${j}`));
    return j0 === undefined ? null : { j0, offerts: objectifsOfferts(graine, j0) };
  };
  const objectifEnCours = () => {
    for (const j0 of JOURS_OBJECTIFS) {
      const d = objectifDe(j0);
      if (!d) continue;
      const e = etatObjectif(d.objectif.cle, mesMatchs(d.objectif.debut));
      if (!pris.has(`v:${j0}`)) return { j0, d, e };
    }
    return null;
  };
  const verdictObjectif = () => {
    if (!onDecision) return null;
    const o = objectifEnCours();
    return o && o.e.fini ? o : null;
  };
  const forceOuvert = () => !!(offreObjectif() || verdictObjectif() || dilemmeOuvert() || sequenceOuverte() || avantOuvert());

  /*
   * LES GROS MATCHS MIS EN SCÈNE (S70). L'avant-match est un choix forcé
   * comme un dilemme ; le deuxième entracte arrête « Journée suivante » et le
   * direct. « La fin » ne s'arrête pas : qui demande la fin demande la fin.
   */
  // Joué, il est dans `minisBoss` ; à venir, le moteur l'a ANNONCÉ au matin (`grosAnnonces`,
  // S80 : deux journées d'avance, sur ce qui était connu ce jour-là), sans rien jouer.
  const grosDuJour = j => (you.minisBoss || []).find(x => x.jour === j)
    || (ligue && ligue.grosAnnonces && ligue.grosAnnonces[j]) || null;
  const entracteAttendu = j => !!(onDecision && grosDuJour(j) && !decs.some(d => d.jour === j && d.entracte));
  // Le prochain gros match annoncé : son avant-match arrive À L'ANNONCE, pas le soir même (S80).
  const grosAnnonce = () => (ligue && ligue.grosAnnonces
    ? Object.values(ligue.grosAnnonces).filter(x => x && x.jour >= jour).sort((x, y) => x.jour - y.jour)[0] : null) || null;
  function avantOuvert() {
    if (!onDecision || jour >= N) return null;
    const mb = grosAnnonce();
    const p = mb ? { j: mb.jour } : null;
    if (!mb || decs.some(d => d.jour === p.j && d.avant)) return null;
    const deja = decs.filter(d => d.avant && d.jour < p.j).map(d => d.avant.cle);
    return { p, mb, cle: avantDuGros(graine, p.j, deja) };
  }
  let entracteDemande = false;

  /*
   * LE DECK DE MATCH (S74, js/combat.js). Avant un gros match — une fois
   * l'avant-match choisi — ta MAIN s'ouvre en plein écran : cinq cartes,
   * trois d'énergie. Après une victoire dans un gros match, une RÉCOMPENSE :
   * une carte parmi trois, ou passer. Les deux sont des décisions ; le deck se
   * déduit d'elles, donc une reprise retrouve les mêmes mains.
   */
  const cicatrices = () => ({
    pertes: (you.minisBoss || []).filter(m => !m.gagne && m.raison === 'nemesis').map(m => m.jour + 1),
    blessures: (you.injuriesLog || []).filter(i => i.games >= 15 && i.jour != null).map(i => i.jour + 1),
  });
  const deckAvant = j => deckDe(decs, { avant: j + 1, ...cicatrices() });
  function mainOuverte() {
    if (!onDecision || jour >= N) return null;
    const p = prochain();
    const mb = p ? grosDuJour(p.j) : null;
    if (!mb || decs.some(d => d.jour === p.j && d.main)) return null;
    if (!decs.some(d => d.jour === p.j && d.avant)) return null;
    return { p, mb };
  }
  function recompenseOuverte() {
    // « La fin » passe par-dessus tout : pas une chaîne de récompenses après coup.
    if (!onDecision || jour >= N) return null;
    return (you.minisBoss || []).find(mb => mb.gagne && mb.jour < jour && !decs.some(d => d.palier === `r:${mb.jour}`)) || null;
  }
  function ouvrirMainGros(mo) {
    const deck = deckAvant(mo.p.j);
    const { main, pioche } = mainDuMatch(graine, `j${mo.p.j}`, deck);
    const adv = mo.mb.adv;
    ouvrirMainDeMatch({
      titre: 'Avant le match', sousTitre: `Match important · journée ${mo.p.j + 1} · contre ${ctx.teamShort(adv)}`,
      recit: 'Le dépistage dit ce qu\'ils vont probablement jouer : prépare-toi pour une piste, puis joue tes cartes — cinq cartes, trois d\'élan, pour ce match seulement.',
      depistage: mo.mb.depistage, planReel: mo.mb.plan, nomAdv: ctx.teamShort(adv),
      contexte: mainAdverseHtml(mainAdverse(graine, `j${mo.p.j}`, energieAdverse({ jour: mo.p.j })), { nomAdv: ctx.teamShort(adv), energie: energieAdverse({ jour: mo.p.j }), echelle: echelleTardive({ jour: mo.p.j }) }),
      // S80 : l'échelle du soir — ce qui vise l'adversaire grandit avec la saison.
      echelle: echelleTardive({ jour: mo.p.j }),
      equipe: you, main, pioche, deck,
      onJouer: (jouees, enMain, _aj, prep) => { const j = jour; quitter(); onDecision({ jour: mo.p.j, main: { jouees, enMain }, prep }, j); },
    });
  }

  /*
   * Les cases vides, nommées comme partout ailleurs (`slotShort` est le seul
   * propriétaire de cette règle). Au-delà de deux on compte, parce qu'une
   * énumération de cinq cases ne se lit pas dans un bandeau.
   */
  const nomsDesCases = cases => {
    const noms = cases.map(i => SLOTS[i]).filter(Boolean)
      .map(s => (ctx.slotShort ? ctx.slotShort(s) : s.role));
    if (!noms.length) return 'Une case vide';
    if (noms.length === 1) return `${noms[0]} : personne pour jouer là`;
    if (noms.length === 2) return `${noms[0]} et ${noms[1]} : personne pour jouer là`;
    return `${noms.length} cases sans personne pour les jouer`;
  };

  /* Ce qu'est le blessé (S79) : ses positions et son rôle — JP, *jamais identifier les joueurs avec leurs places dans l'alignement*. */
  // …et où il joue (S80, JP : *dire que x est sur la xième ligne*) : « C / AG · 🎯 Sniper · 2e trio ».
  const caseDe = p => [ctx.quiEst ? ctx.quiEst(p, { stats: false }) : '', ctx.ouJoue ? ctx.ouJoue(p) : ''].filter(Boolean).join(' · ');
  /*
   * QUI PREND SA PLACE. `activeLineup` promeut le premier réserviste
   * compatible, sinon la case reste vide et le moteur y met un rappel — et
   * c'est précisément ce qu'il faut dire : une case vide coûte cher, et
   * c'est la raison d'aller derrière le banc.
   */
  const remplacant = p => {
    const s = SLOTS.find(x => you.roster[x.i] === p);
    if (!s || s.scratch) return 'il était réserviste';
    const libre = SLOTS.filter(x => x.scratch)
      .map(x => you.roster[x.i])
      .find(r => r && !you.injured.has(r) && (s.group === 'G' ? r.p === 'G' : s.group === 'D' ? r.p === 'D' : r.p === 'F'));
    return libre ? `${libre.n} monte` : 'aucun réserviste ne peut le remplacer';
  };
  let alerte = null;                 // la blessure à annoncer, ou null
  const vues = new Set();            // les entrées du journal déjà annoncées

  /* Les blessures survenues jusqu'ici et jamais annoncées, la plus longue en tête. */
  function blessuresNeuves() {
    const joues = miens.length;
    return (you.injuriesLog || [])
      .filter(b => !vues.has(b) && b.at <= joues && b.games >= BLESSURE_MOMENT
        // Elle doit encore courir : annoncer une blessure déjà finie n'a
        // aucun sens quand on avance de dix journées d'un coup.
        && b.at + b.games > joues)
      .sort((x, y) => y.games - x.games);
  }

  /*
   * `stop` : on s'arrête à la première blessure d'importance. « Journée
   * suivante » et « +10 » s'arrêtent, « La fin » non — qui demande la fin
   * demande la fin.
   */
  /*
   * `infos` : les messages À LIRE (la situation du vestiaire, la carte qui
   * change) arrêtent aussi l'avance ; « Jusqu'à la prochaine décision » ne
   * s'arrête que sur ce qui demande le joueur. Rend `true` si l'avance s'est
   * arrêtée sur quelque chose.
   */
  const avancer = (n, stop = false, infos = true) => {
    let premier = true, arrete = false;
    entracteDemande = false;
    while (n-- > 0 && jour < N) {
      // LE DEUXIÈME ENTRACTE D'UN GROS MATCH (S70) : on n'y passe pas sans choisir.
      if (stop && entracteAttendu(jour)) { if (premier) entracteDemande = true; arrete = true; break; }
      premier = false;
      appliquerJour(jour++);
      const pal = palierOuvert();
      // LES RAISONS DE S'ARRÊTER, et chacune n'arrête qu'UNE fois — c'est la
      // règle du palier, étendue aux blessures, aux situations et aux cases
      // vides : un moment qu'on dépasse ne revient pas bloquer l'avance.
      if (stop && (blessuresNeuves().length || trousNeufs().length || (infos && (situationsNeuves().length || accidentsNeufs().length))
        || (pal !== undefined && !paliersVus.has(pal)) || forceOuvert() || mainOuverte() || recompenseOuverte())) { arrete = true; break; }
    }
    const pal = palierOuvert();
    if (pal !== undefined) paliersVus.add(pal);
    const neuves = blessuresNeuves();
    alerte = neuves.length ? neuves[0] : null;
    if (alerte) vues.add(alerte);
    const tn = trousNeufs();
    trou = tn.length ? tn[0] : null;
    if (trou) trousVus.add(trou);
    const sn = situationsNeuves();
    situation = sn.length ? sn[sn.length - 1] : null;
    for (const f of sn) situVues.add(f);
    const an = accidentsNeufs();
    accident = an.length ? an[an.length - 1] : null;
    for (const a of an) accVus.add(a);
    // La journée révélée est la seule chose que la reprise a besoin de savoir :
    // tout le reste se rejoue de la graine.
    if (onJour) onJour(jour);
    return arrete;
  };
  // REPRISE : on réapplique les journées déjà vues avant le premier dessin.
  if (depuis > 0) {
    avancer(Math.min(depuis, N));
    // Une reprise suit une décision : tout ce qui précède le dernier match
    // révélé a déjà été annoncé. Sans ça, `vues` repart vide et la plus longue
    // blessure encore en cours revenait en alerte après CHAQUE choix — « 20
    // matchs d'absence » pour un blessé du match 25, au jour 40 (QA S74b).
    const joues = miens.length;
    for (const b of you.injuriesLog || []) if (b.at < joues) vues.add(b);
    if (alerte && alerte.at < joues) { const n = blessuresNeuves(); alerte = n.length ? n[0] : null; if (alerte) vues.add(alerte); }
    // Même règle pour « Sa carte change » et « Dans le vestiaire » : l'accident
    // du jour 22 revenait après chaque choix jusqu'au jour 76 (QA S74b). Ce qui
    // est arrivé avant la dernière journée révélée a été vu ; la dernière, et
    // ce qui s'annonce pour ce soir, restent dits.
    const dernier = jour - 1;
    for (const m of you.mutations || []) if (m.source === 'accident' && m.jour < dernier) accVus.add(m);
    for (const f of you.situations || []) if (f.jour < dernier) situVues.add(f);
    if (accident && accident.jour < dernier) accident = null;
    if (situation && situation.jour < dernier) situation = null;
  }
  /* Ce qu'il lui reste à manquer, d'après les matchs joués à ce jour. */
  const restantDe = b => Math.max(1, Math.min(b.games, b.at + b.games - miens.length));

  /* ---------- la boîte de réception, le dépistage, le sommaire (S78) ---------- */

  const boite = boiteDe(graine);
  // CE QUE LA DERNIÈRE AVANCE A RÉVÉLÉ : tes matchs de `joues0 + 1` à
  // `miens.length`. Une reprise (après une décision) redit le dernier.
  let dernierAvance = depuis > 0 ? { joues0: Math.max(0, miens.length - 1) } : null;
  // UN SOMMAIRE EST À L'ÉCRAN : les choix forcés attendent qu'il se ferme (ils
  // passeraient devant, et ouvrir l'un fermerait l'autre sans un mot).
  let retenir = false;
  // UN MATCH ORDINAIRE NE S'OUVRE PLUS EN PLEIN ÉCRAN (1.0, J2-8) : son
  // résultat monte en tête du volet (`hierFrais` = la journée), et s'anime une
  // fois (`hierAnimer`). « Sommaire › » l'ouvre au besoin.
  let hierFrais = -1, hierAnimer = false;

  const gpDe = t => { const g = fiche.get(t); return g ? g.W + g.L + g.OTL : 0; };
  const virgule = (x, d = 1) => Number(x).toFixed(d).replace('.', ',');
  const pctMot = x => `${Math.round(100 * x)} %`;
  const rangMot = r => (r === 1 ? '1er' : `${r}e`);
  /* Le rang d'un club sur une mesure, parmi ceux qui en ont une (1 = le meilleur). */
  const rangSur = (t, val, basMieux = false) => {
    const liste = teams.filter(x => Number.isFinite(val(x)));
    if (!liste.includes(t)) return null;
    liste.sort((a, b) => (basMieux ? val(a) - val(b) : val(b) - val(a)));
    return { rang: liste.indexOf(t) + 1, sur: liste.length };
  };
  const svLigueDe = g => (g && g.s ? 1 - seasonLancers(g.s)[1] / 100 : null);
  const svMot = x => (Number.isFinite(x) ? pct3(x) : '—');
  const partantDe = t => SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => t.roster[s.i]).find(Boolean) || null;

  /*
   * LES MESURES DE LA LIGUE, lues sur les feuilles révélées (S78). Rien n'est
   * une cote : des buts, des tirs, des punitions, comptés. `bas` : plus petit
   * est meilleur. Sous trois matchs joués, un club n'a pas encore de mesure.
   */
  const parMatch = (t, k) => { const n = gpDe(t); return n >= 3 ? fiche.get(t)[k] / n : NaN; };
  const MESURES = {
    attaque: { ico: '⚔️', nom: 'Attaque', val: t => parMatch(t, 'GF'), mot: x => `${virgule(x, 2)} buts par match` },
    defense: { ico: '🛡️', nom: 'Défense', bas: true, val: t => parMatch(t, 'SA'), mot: x => `${virgule(x)} tirs accordés par match` },
    vitesse: { ico: '⚡', nom: 'Vitesse', val: t => parMatch(t, 'SF'), mot: x => `${virgule(x)} tirs par match` },
    gardiens: { ico: '🥅', nom: 'Devant le filet', val: t => { const g = fiche.get(t); return gpDe(t) >= 3 && g.SA ? 1 - g.GA / g.SA : NaN; }, mot: x => `${svMot(x)} d'arrêts` },
    an: { ico: '🎯', nom: 'Avantage numérique', val: t => { const g = fiche.get(t); return gpDe(t) >= 3 && g.PPO >= 5 ? g.PPG / g.PPO : NaN; }, mot: x => `${pctMot(x)} en avantage` },
    inf: { ico: '🧱', nom: 'Infériorité', val: t => { const g = fiche.get(t); return gpDe(t) >= 3 && g.PKO >= 5 ? 1 - g.PKGA / g.PKO : NaN; }, mot: x => `${pctMot(x)} des punitions tuées` },
    discipline: { ico: '🟨', nom: 'Discipline', bas: true, val: t => parMatch(t, 'PKO'), mot: x => `${virgule(x)} punitions par match` },
  };
  const mesureDe = (t, k) => { const M = MESURES[k], v = M.val(t); return Number.isFinite(v) ? { v, ...(rangSur(t, M.val, M.bas) || {}) } : null; };
  const moyenneLigue = k => { const vs = teams.map(MESURES[k].val).filter(Number.isFinite); return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : NaN; };

  /*
   * L'ALIGNEMENT D'UN DE TES MATCHS, tel que le moteur l'a habillé (S78). JP :
   * *si joueur change de place dans l'alignement, je dois le voir*. C'est
   * `activeLineup` lui-même, sur tes cases d'aujourd'hui, avec les blessés et
   * les absents de ce soir-là : un réserviste monte à la première case
   * compatible, et c'est exactement ce qu'on lit ici.
   */
  const alignementDuMatch = g => {
    const injured = new Map();
    for (const b of you.injuriesLog || []) if (b.at < g && b.at + b.games >= g) injured.set(b.player, b.at + b.games - g + 1);
    const x = miens[g - 1];
    return { lineup: activeLineup({ ...you, injured, jourCourant: x ? x.j : jour }), injured };
  };
  function mouvements(g0, g1) {
    const out = [], vus = new Set();
    for (let g = Math.max(2, g0 + 1); g <= g1; g++) {
      const avant = alignementDuMatch(g - 1), apres = alignementDuMatch(g);
      for (const s of SLOTS) {
        if (s.scratch) continue;
        const a = avant.lineup[s.i], b = apres.lineup[s.i];
        // Une case qui se vide a son propre message (la case vide) : ici, qui ENTRE.
        if (a === b || !b) continue;
        const ou = ctx.slotShort ? ctx.slotShort(s) : s.role;
        const revient = you.roster[s.i] === b;
        const pourquoi = !a ? '' : apres.injured.has(a) ? ` à la place de ${a.n}, blessé` : revient ? '' : ` à la place de ${a.n}, absent`;
        const txt = revient ? `${b.n} revient à sa place (${ou})${a ? ` : ${a.n} retourne en réserve` : ''}` : `${b.n} monte : ${ou}${pourquoi}`;
        if (!vus.has(txt)) { vus.add(txt); out.push({ j: miens[g - 1].j, txt }); }
      }
    }
    return out;
  }

  /*
   * LE PRONOSTIC D'AVANT-MATCH (S78, js/pronostic.js) : 300 matchs rejoués
   * par le moteur, isolés du hasard de la saison. Calculé à la demande (le
   * volet du dépistage), gardé tant que rien n'a changé — la même journée,
   * les mêmes décisions.
   */
  const pronosticDe = p => {
    const cle = `${graine}|${p.j}|${jour}|${decs.length}`;
    if (!PRONOS.has(cle)) {
      if (PRONOS.size > 40) PRONOS.clear();
      PRONOS.set(cle, pronostic({ A: p.m.A, B: p.m.B, calendrier, jourMatch: p.j, jourRevele: jour }));
    }
    return PRONOS.get(cle);
  };
  /*
   * LES CINQ FORCES COMPARÉES. Cette saison (trois matchs et plus) : des
   * mesures de feuilles et leur rang dans la ligue. Avant ça, ce que le moteur
   * voit des deux alignements — en RANG seulement, jamais une cote. Le gardien
   * est celui de CE SOIR (la rotation du moteur), jugé sur sa vraie saison.
   * La vitesse est le canal du moteur qui porte ce nom : le volume de lancers.
   */
  const lancersEquipe = t => {
    const ps = SLOTS.filter(s => !s.scratch && s.group !== 'G').map(s => t.roster[s.i]).filter(Boolean);
    return ps.length ? ps.reduce((a, p) => a + lancersRelDe(p), 0) / ps.length : NaN;
  };
  function axesDuMatch(A, B, gardiens) {
    const saison = gpDe(A) >= 3 && gpDe(B) >= 3;
    const moteur = (t, v, bas = false) => rangSur(t, v, bas);
    const ligne = (ico, nom, cA, cB) => ({ ico, nom, a: cA, b: cB });
    const cote = (t, k) => { const m = mesureDe(t, k); return m ? { ...m, mot: MESURES[k].mot(m.v) } : null; };
    const avantSaison = (t, v, bas = false) => { const r = moteur(t, v, bas); return r ? { ...r, mot: 'sur papier' } : null; };
    const gardien = (t, g) => {
      if (!g) return null;
      const r = rangSur(t, x => { const gx = x === t ? g : partantDe(x); return gx ? -facteurGardienDe(gx) : NaN; });
      const lig = svLigueDe(g);
      return r ? { ...r, mot: `${g.n.split(' ').slice(-1)[0]} · ${svMot(g.sv)} (ligue ${svMot(lig)})` } : null;
    };
    return [
      saison ? ligne('⚔️', 'Attaque', cote(A, 'attaque'), cote(B, 'attaque'))
        : ligne('⚔️', 'Attaque', avantSaison(A, t => (t.strength ? t.strength.att : NaN)), avantSaison(B, t => (t.strength ? t.strength.att : NaN))),
      saison ? ligne('🛡️', 'Défense', cote(A, 'defense'), cote(B, 'defense'))
        : ligne('🛡️', 'Défense', avantSaison(A, t => (t.strength ? t.strength.def : NaN)), avantSaison(B, t => (t.strength ? t.strength.def : NaN))),
      ligne('🥅', 'Gardien ce soir', gardien(A, gardiens.A), gardien(B, gardiens.B)),
      ligne('💪', 'Robustesse', avantSaison(A, t => (t.strength ? t.strength.rob : NaN)), avantSaison(B, t => (t.strength ? t.strength.rob : NaN))),
      saison ? ligne('⚡', 'Vitesse · volume de tirs', cote(A, 'vitesse'), cote(B, 'vitesse'))
        : ligne('⚡', 'Vitesse · volume de tirs', avantSaison(A, lancersEquipe), avantSaison(B, lancersEquipe)),
    ];
  }
  /* Le meilleur buteur d'un club cette saison, lu sur les feuilles révélées. */
  const buteurDe = t => {
    let best = null;
    for (const s of SLOTS) {
      const p = t.roster[s.i];
      const c = p && compte.get(p);
      if (c && c.g && (!best || c.g > best.c.g)) best = { p, c };
    }
    return best;
  };
  /*
   * LE DÉPISTAGE, OUTIL DE DÉCISION (S79). JP, sur sa capture : *spas si
   * lisible le haut, pis le bas aide fuck all aucun processus décisionnel*.
   *   1. Les chances : une barre, deux pourcentages, les buts attendus (le
   *      moteur, 300 matchs rejoués — js/pronostic.js).
   *   2. Les forces en TABLEAU : un rang par club et par ligne, et l'avantage
   *      marqué (◀ ▶) quand l'écart compte (un huitième de la ligue, trois
   *      rangs au moins). Les unités spéciales s'y ajoutent dès trois matchs.
   *   3. Ce que tu peux faire ce soir (`conseilsDuMatch`) : des réglages de
   *      TES lignes, de ta fermeture ou de ta consigne, avec les chiffres du
   *      moteur, et « Appliquer » — une décision comme une autre, qui se rejoue.
   * Les « conditions » (« s'il marque quatre buts, il gagne 79 % du temps »)
   * sont parties : elles ne décidaient de rien.
   */
  const conseilsVus = new Map();   // journée → les conseils affichés, pour « Appliquer »
  function depistageMatchHtml(p) {
    const moiA = p.m.A === you, adv = moiA ? p.m.B : p.m.A;
    const pr = pronosticDe(p);
    const v = (moiA ? pr.vA : pr.vB) / pr.n;
    const bMoi = moiA ? pr.butsA : pr.butsB, bLui = moiA ? pr.butsB : pr.butsA;
    const bandeA = ctx.band(you.tag), bandeB = ctx.band(adv.tag);
    const chances = `<div class="dep2-chances" style="--moi:${bandeA.bg};--lui:${bandeB.bg}">
      <div class="dep2-chances-mots"><span><b>${pctMot(v)}</b> ${ctx.esc(ctx.tagCourt(you))}</span><span class="dep2-prol">${pctMot(pr.prol / pr.n)} en prolongation</span><span>${ctx.esc(ctx.tagCourt(adv))} <b>${pctMot(1 - v)}</b></span></div>
      <div class="dep2-barre" role="img" aria-label="${pctMot(v)} de victoires contre ${pctMot(1 - v)}"><span class="moi" style="width:${(100 * v).toFixed(1)}%"></span><span class="lui"></span></div>
      <div class="dep2-note">Buts attendus ${virgule(bMoi, 1)} – ${virgule(bLui, 1)} · ${pr.n} matchs rejoués par le moteur, les deux clubs tels qu'ils sont ce matin.</div>
    </div>`;
    const gMoi = moiA ? pr.gardiens.A : pr.gardiens.B, gLui = moiA ? pr.gardiens.B : pr.gardiens.A;
    const axes = axesDuMatch(you, adv, { A: gMoi, B: gLui });
    const mes = (t, k) => { const m = mesureDe(t, k); return m && m.rang ? { ...m, mot: MESURES[k].mot(m.v) } : null; };
    const speciales = gpDe(you) >= 3 && gpDe(adv) >= 3 ? ['an', 'inf'].map(k => ({ ico: MESURES[k].ico, nom: MESURES[k].nom, a: mes(you, k), b: mes(adv, k) })) : [];
    const rangTxt = c => (c ? `${c.rang}<sup>${c.rang === 1 ? 'er' : 'e'}</sup>` : '—');
    const nomMoi = ctx.tagCourt(you), nomLui = ctx.tagCourt(adv);
    const rangee = x => {
      const d = x.a && x.b ? x.b.rang - x.a.rang : 0;
      const s = x.a ? Math.max(3, Math.round(x.a.sur / 8)) : Infinity;
      const av = d >= s ? 'moi' : -d >= s ? 'lui' : '';
      const cell = (c, cote) => `<td class="dep3-${cote}${av === cote ? ' av' : ''}"><b>${rangTxt(c)}</b>${c && c.mot ? `<small>${ctx.esc(c.mot)}</small>` : ''}</td>`;
      return `<tr><th scope="row">${x.ico} ${ctx.esc(x.nom)}</th>${cell(x.a, 'moi')}<td class="dep3-av" title="${av === 'moi' ? `Avantage ${ctx.esc(nomMoi)}` : av === 'lui' ? `Avantage ${ctx.esc(nomLui)}` : 'Pas d\'écart qui compte'}">${av === 'moi' ? '◀' : av === 'lui' ? '▶' : '='}</td>${cell(x.b, 'lui')}</tr>`;
    };
    const table = `<table class="dep3-table">
      <caption>Rang dans la ligue · ◀ ▶ l'avantage</caption>
      <thead><tr><th></th><th class="dep3-moi">${ctx.logo(you.tag, 16)} ${ctx.esc(nomMoi)}</th><th></th><th class="dep3-lui">${ctx.esc(nomLui)} ${ctx.logo(adv.tag, 16)}</th></tr></thead>
      <tbody>${[...axes, ...speciales].map(rangee).join('')}</tbody>
    </table>`;
    // Leur meilleur buteur : ce qu'il est (ses positions, son rôle) et ce qu'il a fait.
    const b = buteurDe(adv);
    const surveiller = b ? `<div class="dep3-surveiller">👀 Chez eux : <b>${ctx.esc(b.p.n)}</b>${ctx.quiEst ? ` · ${ctx.esc(ctx.quiEst(b.p, { stats: false }))}` : ''} — ${b.c.g} but${b.c.g > 1 ? 's' : ''} en ${gpDe(adv)} matchs.</div>` : '';
    // CE QUE TU PEUX FAIRE CE SOIR.
    const snap = t => (t.jourLignes && t.jourLignes[Math.max(0, Math.min(jour, t.jourLignes.length - 1))]) || {};
    const matchPris = decs.find(d => d.match && d.jour === p.j);
    const conseils = conseilsDuMatch({
      lineup: you.roster, lignes: lignesDe(you, you.roster, { duSoir: false }), fermeture: you.fermeture, energie: snap(you).energie || {},
      adv: { lignes: lignesDe(adv, activeLineup(adv), { duSoir: false }), chimie: snap(adv).chimie || [], lineup: adv.roster },
      forces: { moi: { attaque: axes[0].a, defense: axes[1].a }, lui: { attaque: axes[0].b, gardien: axes[2].b } },
      consigne: matchPris ? matchPris.match.ad : null,
    });
    conseilsVus.set(p.j, conseils);
    const conseilsHtml = `<div class="dep3-conseils"><div class="gl-k">🧭 Ce que tu peux faire ce soir</div>${conseils.length ? conseils.map((c, i) => `<div class="dep3-conseil${c.genre === 'deja' ? ' deja' : ''}">
        <div class="dep3-conseil-t">${c.genre === 'deja' ? '✓ ' : ''}<b>${ctx.esc(c.titre)}</b></div>
        <div class="dep3-conseil-p">${ctx.esc(c.pourquoi)}</div>
        ${c.chiffres.length || (onDecision && c.genre !== 'deja') ? `<div class="dep3-conseil-pied">${c.chiffres.length ? `<span class="choix-puces">${puces(c.chiffres)}</span>` : ''}${onDecision && c.genre !== 'deja' ? `<button type="button" class="btn dep3-appliquer" data-conseil="${i}" data-j="${p.j}">Appliquer</button>` : ''}</div>` : ''}
      </div>`).join('') : '<div class="dep3-conseil-p">Rien à changer : tes systèmes, ta fermeture, ton agressivité et ta glace sont déjà les bons pour ce match.</div>'}</div>`;
    return `${chances}${table}${surveiller}${conseilsHtml}`;
  }
  /* « Appliquer » : le conseil devient une décision de la journée du match, et la saison se rejoue d'ici. */
  const brancherConseils = el => {
    if (!el || !onDecision) return;
    el.querySelectorAll('.dep3-appliquer').forEach(b => {
      b.onclick = () => {
        const j = Number(b.dataset.j), c = (conseilsVus.get(j) || [])[Number(b.dataset.conseil)];
        if (!c) return;
        const d = c.lignes ? { jour: j, lignes: c.lignes } : c.fermeture != null ? { jour: j, fermeture: c.fermeture } : c.match ? { jour: j, match: c.match } : null;
        if (!d) return;
        const ici = jour; quitter(); onDecision(d, ici);
      };
    });
  };

  /*
   * LE RAPPORT DU DÉPISTEUR (S78), tous les dix matchs. JP : *avoir scouting de
   * l'équipe avec forces, faiblesses, etc, style courriel, au cours de la
   * saison et écran avec infos pour prise de décision*. Ce qu'il écrit se
   * compte sur les feuilles : tes rangs dans la ligue, ce que chaque ligne a
   * marqué à forces égales, qui est chaud et qui ne produit plus.
   */
  const RAPPORT_CHAQUE = 10;
  function rapportHtml() {
    const forces = [], faiblesses = [];
    for (const k of Object.keys(MESURES)) {
      const m = mesureDe(you, k);
      if (!m || !m.sur) continue;
      const q = Math.ceil(m.sur / 4);
      const l = { k, rang: m.rang, sur: m.sur, txt: `${MESURES[k].ico} ${MESURES[k].nom} : ${MESURES[k].mot(m.v)} — ${rangMot(m.rang)} sur ${m.sur}` };
      if (m.rang <= q) forces.push(l); else if (m.rang > m.sur - q) faiblesses.push(l);
    }
    forces.sort((a, b) => a.rang - b.rang); faiblesses.sort((a, b) => b.rang - a.rang);
    const cote = x => (x.m.A === you ? 'A' : 'B');
    // Tes lignes à forces égales, sur toute la saison révélée.
    const L = [0, 1, 2, 3].map(() => ({ t: 0, b: 0 }));
    for (const x of miens) for (const l of (x.m.feuille && x.m.feuille.lancers) || []) {
      if (l.ligne == null || l.mode !== 'FE' || l.cote !== cote(x) || !L[l.ligne]) continue;
      L[l.ligne].t++; if (l.but) L[l.ligne].b++;
    }
    const NOMS = ['1re', '2e', '3e', '4e'];
    // Chaud et froid : les dix derniers matchs, contre la saison.
    const dix = compterFeuilles(miens.slice(-10).map(x => x.m.feuille));
    const miensJ = SLOTS.filter(s => !s.scratch && s.group !== 'G').map(s => you.roster[s.i]).filter(Boolean);
    const chaud = miensJ.map(p => ({ p, c: dix.get(p) })).filter(x => x.c && x.c.pts).sort((a, b) => b.c.pts - a.c.pts)[0];
    const top6 = miensJ.filter(p => p.p !== 'D').map(p => ({ p, s: compte.get(p) })).filter(x => x.s).sort((a, b) => b.s.pts - a.s.pts).slice(0, 6);
    const froid = top6.map(x => ({ ...x, d: dix.get(x.p) || { pts: 0, gp: 0 } })).filter(x => x.d.gp >= 5 && x.d.pts <= 1).sort((a, b) => a.d.pts - b.d.pts)[0];
    const n10 = Math.min(10, miens.length);
    const liste = (xs, cls) => xs.slice(0, 3).map(x => `<div class="hub-rap-l ${cls}">${ctx.esc(x.txt)}</div>`).join('');
    return `<div class="hub-rapport">
      <div class="hub-rap-s">Ce qui marche</div>${forces.length ? liste(forces, 'bon') : '<div class="hub-rap-l">Rien ne sort du lot : tu es dans la moyenne partout.</div>'}
      <div class="hub-rap-s">Ce qui coule</div>${faiblesses.length ? liste(faiblesses, 'prix') : '<div class="hub-rap-l">Aucune faiblesse franche.</div>'}
      <div class="hub-rap-s">Tes lignes à forces égales</div>
      <div class="hub-rap-lignes">${L.map((x, u) => `<span><b>${NOMS[u]}</b> ${x.b} but${x.b > 1 ? 's' : ''} · ${x.t} tirs</span>`).join('')}</div>
      <div class="hub-rap-s">Tes ${n10} derniers matchs</div>
      ${chaud ? `<div class="hub-rap-l bon">🔥 ${ctx.esc(chaud.p.n)} : ${chaud.c.pts} point${chaud.c.pts > 1 ? 's' : ''} (${chaud.c.g} but${chaud.c.g > 1 ? 's' : ''})</div>` : ''}
      ${froid ? `<div class="hub-rap-l prix">🥶 ${ctx.esc(froid.p.n)} : ${froid.d.pts} point en ${froid.d.gp} matchs, après ${froid.s.pts} cette saison</div>` : ''}
      ${!chaud && !froid ? '<div class="hub-rap-l">Personne ne sort du lot.</div>' : ''}
    </div>`;
  }

  /*
   * LES OBJECTIFS DU PROPRIO, À L'ÉPREUVE (S78). JP : *donner vague idée de si
   * c'est possible, genre si goaler à chier, blanchissage tough*. Le mot vient
   * du moteur (vingt matchs rejoués trente fois contre tes vrais prochains
   * adversaires, `chancesDesObjectifs`) ; la raison, de tes vrais chiffres.
   */
  const chancesObjectifs = (j0, cles) => {
    const cle = `${graine}|o${j0}|${jour}|${decs.length}`;
    if (!PRONOS.has(cle)) PRONOS.set(cle, chancesDesObjectifs({ you, calendrier, jourRevele: jour, cles, chemins: 30 }));
    return PRONOS.get(cle);
  };
  function raisonObjectif(cle) {
    const f = fiche.get(you), gp = gpDe(you), assez = gp >= 5;
    const g = partantDe(you), lig = svLigueDe(g);
    const par = k => virgule(f[k] / Math.max(1, gp), 1);
    const r = resultats.get(you) || [];
    const plusLongue = gagnant => { let b = 0, c = 0; for (const x of r) { c = (x === 'V') === gagnant ? c + 1 : 0; b = Math.max(b, c); } return b; };
    const gardienMot = g ? `${g.n} : ${svMot(g.sv)} d'arrêts dans sa vraie saison, ${g.sv >= lig ? 'au-dessus de' : 'sous'} la ligue (${svMot(lig)}).` : 'Pas de gardien partant.';
    if (cle === 'attaque') return assez ? `Tu marques ${par('GF')} buts par match ; il en faut 3,2.` : 'Il faut 3,2 buts par match.';
    if (cle === 'brigade') return assez ? `Tu en accordes ${par('GA')} par match ; il faut 2,9 ou moins.` : gardienMot;
    if (cle === 'blanchissages') return gardienMot;
    if (cle === 'victoires') return assez ? `Ta fiche : ${f.W}-${f.L}-${f.OTL} ; il faut 11 victoires sur 20.` : 'Il faut gagner un peu plus d\'un match sur deux.';
    if (cle === 'sequence') return assez ? `Ta plus longue séquence cette saison : ${plusLongue(true)} victoire${plusLongue(true) > 1 ? 's' : ''}.` : 'Quatre de suite, n\'importe quand dans les vingt.';
    if (cle === 'regulier') return assez ? `Ta pire glissade cette saison : ${plusLongue(false)} défaite${plusLongue(false) > 1 ? 's' : ''} de suite.` : 'Jamais trois défaites de suite, sur vingt matchs.';
    if (cle === 'vedette') {
      const ps = SLOTS.filter(s => !s.scratch && s.group !== 'G').map(s => you.roster[s.i]).filter(Boolean);
      if (assez) {
        const b = ps.map(p => ({ p, c: compte.get(p) })).filter(x => x.c).sort((a, b) => b.c.pts - a.c.pts)[0];
        if (b) return `Ton meilleur pointeur, ${b.p.n}, a ${b.c.pts} points en ${gp} matchs ; il en faut 21 en 20.`;
      }
      const b = ps.filter(p => p.gp).map(p => ({ p, x: ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / p.gp })).sort((a, b) => b.x - a.x)[0];
      return b ? `Ton meilleur pointeur, ${b.p.n}, a fait ${virgule(b.x, 2)} point par match dans sa vraie saison ; il en faut 1,05.` : '';
    }
    return '';
  }

  /*
   * LE SOMMAIRE DE LA JOURNÉE (S78). JP : *si jour suivant, mettre sommaire
   * avant retour à écran principal si match*. Après une avance où ta formation
   * a joué : le pointage (et ses buts), le classement qui bouge, les blessés
   * neufs, ceux qui ont changé de place, le gros match — puis le hub.
   */
  function ouvrirSommaire(avant) {
    const nouveaux = miens.slice(avant.joues);
    if (!nouveaux.length) return false;
    const attend = messagesCourants().filter(m => m.bloque);
    /*
     * LE PLEIN ÉCRAN SE MÉRITE (1.0, J2-8). JP ne voulait pas tout relire à
     * chaque journée : un seul match ordinaire, sans gros match, sans
     * blessure neuve et sans courrier à régler, se lit au bureau — le
     * résultat monte en tête du volet. Le plein écran reste pour les avances
     * de plusieurs journées, les gros matchs, les blessures et l'attente.
     */
    const grosVu = (you.minisBoss || []).some(mb => mb.jour >= avant.jour && mb.jour < jour);
    const blesse = (you.injuriesLog || []).some(b => b.at > avant.joues && b.at <= miens.length);
    if (nouveaux.length === 1 && !grosVu && !blesse && !attend.length) { hierFrais = jour; hierAnimer = true; return false; }
    const f = fiche.get(you), rang = rangDe(you);
    const W = nouveaux.filter(x => gagne(x.m, you)).length;
    const OTL = nouveaux.filter(x => !gagne(x.m, you) && x.m.ot).length, L = nouveaux.length - W - OTL;
    const pour = nouveaux.reduce((a, x) => a + (x.m.A === you ? x.m.gfA : x.m.gfB), 0), contre = nouveaux.reduce((a, x) => a + (x.m.A === you ? x.m.gfB : x.m.gfA), 0);
    const un = nouveaux.length === 1 ? nouveaux[0] : null;
    const titre = un ? `Journée ${un.j + 1} · ${gagne(un.m, you) ? 'Victoire' : un.m.ot ? 'Défaite en prolongation' : 'Défaite'} ${scoreDe(un.j, un.m)}`
      : `${nouveaux.length} matchs · ${W}-${L}-${OTL}`;
    const bouge = avant.rang - rang;
    const blocs = [];
    if (un) blocs.push(scoreboard(un));
    else {
      blocs.push(`<div class="hub-jeux">${nouveaux.map(({ j, k, m }) => {
        const adv = m.A === you ? m.B : m.A, v = gagne(m, you);
        return `<div class="hub-jeu${v ? ' v' : ' d'}" data-sommaire="saison|${j}|${k}"><span class="hub-jeu-n">J${j + 1}</span><span class="hub-jeu-res">${v ? 'V' : m.ot ? 'DP' : 'D'}</span><span class="hub-jeu-score">${scoreDe(j, m)}</span>${ctx.logo(adv.tag, 15)}<span class="hub-jeu-adv">${ctx.esc(ctx.teamLabel(adv))}</span></div>`;
      }).join('')}</div>`);
      const pts = compterFeuilles(nouveaux.map(x => x.m.feuille));
      const tete = [...pts].filter(([p]) => Object.values(you.roster).includes(p) && p.p !== 'G').sort((a, b) => b[1].pts - a[1].pts || b[1].g - a[1].g).slice(0, 3);
      if (tete.length) blocs.push(`<div class="som-l">⭐ ${tete.map(([p, c]) => `${ctx.esc(p.n)} ${c.g}-${c.a}-${c.pts}`).join(' · ')}</div>`);
      blocs.push(`<div class="som-l">${pour} buts pour, ${contre} contre</div>`);
    }
    blocs.push(`<div class="som-l som-rang">📊 ${rangMot(rang)} de la ligue${bouge ? ` <span class="${bouge > 0 ? 'bon' : 'prix'}">${bouge > 0 ? '▲' : '▼'} ${Math.abs(bouge)}</span>` : ' · sans bouger'} · ${f.W}-${f.L}-${f.OTL}, ${f.PTS} pts</div>`);
    for (const b of (you.injuriesLog || []).filter(b => b.at > avant.joues && b.at <= miens.length)) blocs.push(`<div class="som-l prix">🚑 ${ctx.esc(b.player.n)} blessé : ${b.games} match${b.games > 1 ? 's' : ''}</div>`);
    for (const x of mouvements(avant.joues, miens.length).slice(0, 4)) blocs.push(`<div class="som-l">🔁 ${ctx.esc(x.txt)}</div>`);
    for (const mb of (you.minisBoss || []).filter(mb => mb.jour >= avant.jour && mb.jour < jour)) {
      blocs.push(`<div class="som-l ${mb.gagne ? 'bon' : 'prix'}">${MINI_BOSS[mb.raison] ? MINI_BOSS[mb.raison].ico : '⭐'} Gros match ${mb.gagne ? 'gagné' : 'perdu'} : ${mb.gagne ? `${ELAN.ico} ${ELAN.nom}` : `${SONNE.ico} ${SONNE.nom}`} pour ${mb.gagne ? ELAN.duree : SONNE.duree} matchs</div>`);
    }
    retenir = true;
    ouvrirChoix({
      // UN SEUL BOUTON (JP : *jamais dédoubler information*) : retour au hub, ou à la boîte s'il y a du courrier à régler.
      ico: un ? (gagne(un.m, you) ? '✅' : '❌') : '🗓️', titre, genre: 'sommaire', fermable: true,
      motFermer: attend.length ? '📥 Voir ma boîte de réception' : 'Retour au bureau',
      contexte: `<div class="som">${blocs.join('')}</div>${attend.length ? `<div class="som-attente">📥 ${attend.length} message${attend.length > 1 ? 's' : ''} à traiter t'attend${attend.length > 1 ? 'ent' : ''} au bureau : ${ctx.esc(attend[0].sujet)}</div>` : ''}`,
      options: [],
      onChoix: () => { retenir = false; dessiner(); },
      onFerme: () => { retenir = false; dessiner(); },
    });
    return true;
  }

  /*
   * AVANCER, PUIS LE SOMMAIRE (S78). JP : *si jour suivant, mettre sommaire
   * avant retour à écran principal si match*. Le sommaire passe devant les
   * choix forcés du jour ; ils s'ouvrent quand on le ferme.
   */
  /*
   * JUSQU'À LA PROCHAINE DÉCISION (S79). JP : *pas possible de sauter la
   * saison, mais possible de simuler jusqu'à la prochaine action forcée*. Une
   * journée à la fois, jouée et révélée, jusqu'à la première qui demande le
   * joueur — une blessure et son ballottage, une case vide, un palier, un
   * choix forcé, un gros match (son avant-match, sa main, son entracte), une
   * récompense — ou la fin de la saison. On s'arrête LE JOUR de l'événement,
   * jamais après. Le bouton dit où on en est (« J24 … J31 ») : le fil rend la
   * main au navigateur entre deux paquets de journées.
   */
  let enRoute = false;
  async function avancerJusquaDecision() {
    if (enRoute || jour >= N) return;
    enRoute = true;
    const avant = { jour, joues: miens.length, rang: rangDe(you) };
    retenir = true;
    const depart = jour;
    const bouton = actions.querySelector('.hub-prochaine');
    for (const b of actions.querySelectorAll('button')) b.disabled = true;
    let t0 = performance.now();
    // Les messages À LIRE croisés en route (la situation du jour 46, la carte
    // qui change) : chaque `avancer(1)` les remet à zéro, on garde le dernier.
    let situ = null, acc = null;
    try {
      while (jour < N) {
        const arrete = avancer(1, true, false);
        situ = situation || situ; acc = accident || acc;
        if (arrete) break;
        if (performance.now() - t0 > 50) {
          if (bouton) bouton.textContent = `J${depart + 1} … J${jour}`;
          await new Promise(r => setTimeout(r, 0));
          t0 = performance.now();
        }
      }
    } finally { enRoute = false; }
    situation = situ; accident = acc;
    dernierAvance = { joues0: avant.joues };
    boite.ouvert = null;
    dessiner();
    tabs.suivre('journee');
    if (entracteDemande) { retenir = false; ouvrirEntracte(); return; }
    if (!ouvrirSommaire(avant)) { retenir = false; dessiner(); }
  }

  function avancerPuisResumer(n) {
    const avant = { jour, joues: miens.length, rang: rangDe(you) };
    retenir = true;
    avancer(n, true);
    dernierAvance = { joues0: avant.joues };
    boite.ouvert = null;
    dessiner();
    tabs.suivre('journee');
    if (entracteDemande) { retenir = false; ouvrirEntracte(); return; }
    if (!ouvrirSommaire(avant)) { retenir = false; dessiner(); }
  }

  /* ---------- les volets ---------- */

  const scoreboard = ({ j, k, m }) => {
    const gagneA = m.gfA > m.gfB;
    const cote = (t, buts, pos, g) => {
      const b = ctx.band(t.tag);
      return `<div class="live-eq ${pos}${g ? '' : ' perdant'}" style="--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
        <div class="live-eq-band">${ctx.logo(t.tag, 22)}<span>${ctx.esc(ctx.tagCourt(t))}</span></div>
        <div class="live-eq-nom">${ctx.esc(ctx.teamLabel(t))}</div>
        <div class="live-eq-buts">${buts}</div>
      </div>`;
    };
    // Les buts de ton match, avec le rang de chacun dans la saison — « son
    // 12e but » — le compte d'AVANT cette journée plus les buts du match.
    const avant = compterFeuilles(calendrier.slice(0, j).flat().map(x => x.feuille));
    const local = new Map();
    const rang = (p, cle) => { const c = avant.get(p); const base = c ? c[cle] : 0; local.set(p, local.get(p) || { g: 0, a: 0 }); local.get(p)[cle]++; return base + local.get(p)[cle]; };
    /*
     * LES BUTS SE RANGENT PAR PÉRIODE (JP : *corriger le sommaire*). L'heure
     * est celle du tableau indicateur (le temps qu'il reste, comme le direct) :
     * sans la période, « 02:09 » puis « 10:21 » puis « 00:41 » se lisait comme
     * un désordre. Un intertitre par période qui a vu un but, pas plus.
     */
    let per = 0;
    const buts = m.feuille ? m.feuille.buts.slice().sort((x, y) => x.instant - y.instant).map(b => {
      const t = b.cote === 'A' ? m.A : m.B;
      const p = periodeDe(b.instant);
      const tete = p !== per ? `<div class="live-but-per">${NOM_PERIODE[p]}</div>` : '';
      per = p;
      const aides = b.passeurs.map(p => `${ctx.esc(nom(p))} (${ordF(rang(p, 'a'))} passe)`).join(', ');
      return `${tete}<div class="live-but-ligne${t === you ? ' toi' : ''}"><span class="live-tps">${tempsRestant(b.instant)}</span>${ctx.logo(t.tag, 13)}<span><b>${ctx.esc(nom(b.marqueur))}</b> <span class="live-xe">(${ord(rang(b.marqueur, 'g'))} but)</span>${aides ? `, ${aides}` : ''}${b.an ? ' · AN' : b.dn ? ' · DN' : ''}${b.gagnant && m.ot ? ' · en prolongation' : ''}</span></div>`;
    }).join('') : '';
    const somm = m.feuille ? ` data-sommaire="saison|${j}|${k}" role="button" tabindex="0" title="Le sommaire du match"` : '';
    return `<div class="live-board hub-board"${somm}>${cote(m.A, m.gfA, 'a', gagneA)}
      <div class="live-horloge"><span class="live-per">FINAL</span><span class="live-temps">${m.ot ? 'PROL.' : '—'}</span><span class="live-tirs">${gagne(m, you) ? 'Victoire' : m.ot ? 'Défaite en prolongation' : 'Défaite'}${m.feuille ? ` · tirs ${tirsTotal(m.feuille, 'A')} – ${tirsTotal(m.feuille, 'B')}` : ''}</span></div>
      ${cote(m.B, m.gfB, 'b', !gagneA)}
      ${buts ? `<div class="live-buteurs">${buts}</div>` : ''}</div>`;
  };

  /*
   * HIER SOIR, EN UNE LIGNE (S79). JP : *l'écran de match a trop
   * d'informations, ça devient bordel*. Le sommaire du match s'ouvre déjà
   * après chaque journée où tu joues : l'écran Match n'en répète plus les
   * buts. Il dit le résultat, et le toucher rouvre le sommaire.
   */
  const resultatHier = ({ j, k, m }) => {
    const v = gagne(m, you);
    const eq = (t, buts) => `<span class="hub-hier-eq${t === you ? ' toi' : ''}">${ctx.logo(t.tag, 18)}<b>${ctx.esc(ctx.tagCourt(t))}</b><em>${buts}</em></span>`;
    const somm = m.feuille ? ` data-sommaire="saison|${j}|${k}" role="button" tabindex="0" title="Le sommaire du match"` : '';
    // Le résultat neuf, lu au bureau plutôt qu'en plein écran (J2-8) : il s'anime une fois.
    const neuf = hierFrais === j + 1 && hierAnimer ? ' neuf' : '';
    if (neuf) hierAnimer = false;
    return `<div class="hub-hier ${v ? 'v' : 'd'}${neuf}"${somm}>
      <span class="hub-hier-quand">Journée ${j + 1} · <b>${v ? 'Victoire' : m.ot ? 'Défaite en prolongation' : 'Défaite'}</b></span>
      <span class="hub-hier-score">${eq(m.A, m.gfA)}<i>–</i>${eq(m.B, m.gfB)}${m.ot ? '<small>P</small>' : ''}</span>
      ${m.feuille ? '<span class="hub-hier-voir">Sommaire ›</span>' : ''}
    </div>`;
  };
  // LES RÉSULTATS DE LA JOURNÉE (S79) : ils font le classement, donc ils vivent avec lui.
  const resultatsDuJour = () => {
    if (!jour) return afficheJour1();
    const j = jour - 1, matchs = calendrier[j] || [];
    return `<details class="hub-plie hub-autres"><summary>Les résultats de la journée ${jour} · ${matchs.length}</summary><div class="cal-grille">${matchs.map((m, i) => carteMatch(m, j, i)).join('')}</div></details>`;
  };
  // LA FORME D'UN CLUB, sur l'affiche : ses cinq derniers matchs, le plus récent à droite.
  const formeHtml = t => {
    const cinq = (resultats.get(t) || []).slice(-5);
    if (!cinq.length) return '';
    const mot = x => (x === 'V' ? 'Victoire' : x === 'DP' ? 'Défaite en prolongation' : 'Défaite');
    return `<span class="forme" aria-label="Ses cinq derniers matchs">${cinq.map(x => `<span class="forme-p ${x === 'V' ? 'v' : x === 'DP' ? 'dp' : 'd'}" title="${mot(x)}">${x}</span>`).join('')}</span>`;
  };

  const carteMatch = (m, j, k) => {
    const gagneA = m.gfA > m.gfB;
    const eq = (t, buts, g) => `<div class="cal-eq ${g ? 'win' : 'lose'}${t === you ? ' toi' : ''}">${ctx.logo(t.tag, 16)}<span>${ctx.esc(ctx.tagCourt(t))}</span><b>${buts}</b></div>`;
    const somm = m.feuille ? ` data-sommaire="saison|${j}|${k}" role="button" tabindex="0" title="Sommaire du match"` : '';
    return `<div class="cal-match${m.A === you || m.B === you ? ' toi' : ''}${m.feuille ? ' ouvrable' : ''}"${somm}>${eq(m.A, m.gfA, gagneA)}${eq(m.B, m.gfB, !gagneA)}${m.ot ? '<span class="cal-ot">P</span>' : ''}</div>`;
  };

  /*
   * LA JOURNÉE 0 MONTRE L'AFFICHE DE LA LIGUE, pas un écran noir.
   *
   * Avant le premier match il n'y a rien à révéler — et le volet restait
   * vide, donc l'écran où l'on passe une saison entière s'ouvrait sur 400 px
   * de noir. Or le CALENDRIER, lui, est connu : qui joue contre qui à la
   * journée 1 n'est pas un résultat, c'est une affiche. On la montre, sans
   * un seul chiffre — les pointages arrivent quand la journée est jouée.
   */
  const afficheJour1 = () => {
    const matchs = calendrier[0] || [];
    if (!matchs.length) return '';
    const eq = t => `<div class="cal-eq${t === you ? ' toi' : ''}">${ctx.logo(t.tag, 16)}<span>${ctx.esc(ctx.tagCourt(t))}</span></div>`;
    const cartes = matchs.map(m => `<div class="cal-match cal-affiche${m.A === you || m.B === you ? ' toi' : ''}">${eq(m.A)}${eq(m.B)}</div>`).join('');
    // S79 : pliée, avec le classement — l'écran Match n'a que TON affiche.
    return `<details class="hub-plie hub-autres"><summary>L'affiche de la journée 1 · ${matchs.length}</summary><div class="cal-grille">${cartes}</div></details>`;
  };

  /*
   * LE RAPPORT DU MATCH PAR LIGNE (S68), comme HockeyArena : ce que chaque
   * ligne a fait à forces égales — ses lancers, ses buts, ceux qu'on a
   * marqués contre elle, ses actions spéciales réussies et étouffées. C'est
   * là qu'on apprend ce qui marche.
   */
  const rapportLignes = m => {
    if (!m.feuille || !m.feuille.lancers) return '';
    const cote = m.A === you ? 'A' : 'B', autre = cote === 'A' ? 'B' : 'A';
    const L = [0, 1, 2, 3].map(() => ({ t: 0, b: 0, s: 0, e: 0, bc: 0 }));
    for (const l of m.feuille.lancers) {
      if (l.ligne == null || l.mode !== 'FE') continue;
      if (l.cote === cote) { const x = L[l.ligne]; x.t++; if (l.but) x.b++; if (l.special === 'reussie') x.s++; if (l.special === 'etouffee') x.e++; }
    }
    // Les buts contre, par la ligne d'en face qui a marqué : on n'a pas celle
    // qui défendait, alors on dit ce que la ligne adverse du même rang a fait.
    for (const b of m.feuille.buts) if (b.cote === autre && b.ligne != null && !b.an && !b.dn) L[b.ligne].bc++;
    const lignes = lignesDe(you, you.roster);
    const noms = ['1re', '2e', '3e', '4e'];
    return `<div class="live-tableau"><div class="live-tableau-titre">Tes lignes, à forces égales</div>
      <table class="rl-table"><thead><tr><th>Ligne</th><th>Systèmes</th><th>Tirs</th><th>Buts</th><th title="Buts de la ligne adverse du même rang">Contre</th><th title="Actions spéciales réussies">Spéc.</th><th title="Actions spéciales étouffées par le système adverse">Étouf.</th></tr></thead>
      <tbody>${L.map((x, u) => `<tr><td>${noms[u]}</td><td>${TACTIQUES[lignes[u].tac].ico} ${ctx.esc(TACTIQUES[lignes[u].tac].nom)}${u < 3 && SYSTEMES_D[lignes[u].tacD] && lignes[u].tacD !== 'hourra' ? ` · ${SYSTEMES_D[lignes[u].tacD].ico}` : ''}</td><td>${x.t}</td><td>${x.b}</td><td>${x.bc}</td><td>${x.s}</td><td>${x.e}</td></tr>`).join('')}</tbody></table></div>`;
  };

  // LE VOLET « MATCH » (S79) : l'état de la saison (`etatHtml`), puis hier soir en une ligne.
  // Au bureau, il coiffe la colonne de droite ; l'affiche et les boutons tiennent la gauche.
  // Le soir d'un match lu au bureau (J2-8), son résultat passe devant l'état de la saison.
  const voletJournee = () => (hierFrais === jour ? voletJourneeSeul() + etatHtml() : etatHtml() + voletJourneeSeul());
  const voletJourneeSeul = () => {
    if (!jour) return '';
    const j = jour - 1, k = indexMien(j), matchs = calendrier[j];
    // PLIÉ PAR DÉFAUT (S78) : le rapport de tes lignes et les quinze autres
    // matchs se déplient au toucher. Au téléphone, ils faisaient deux écrans.
    const rl = k >= 0 ? rapportLignes(matchs[k]) : '';
    const mien = k >= 0 ? resultatHier({ j, k, m: matchs[k] }) + (rl ? `<details class="hub-plie"><summary>Tes lignes à forces égales, ce soir</summary>${rl}</details>` : '') : `<div class="hub-hier conge"><span class="hub-hier-quand">Journée ${jour} · <b>congé</b></span></div>`;
    const mbHier = (you.minisBoss || []).find(x => x.jour === j);
    const mbMot = mbHier ? `<div class="hub-miniboss ${mbHier.gagne ? 'gagne' : 'perdu'}">${MINI_BOSS[mbHier.raison].ico} ${mbHier.gagne ? `<b>Gros match gagné</b> : ${ELAN.ico} ${ELAN.nom} pour trois matchs, et les partisans montent` : `<b>Gros match perdu</b> : ${SONNE.ico} ${SONNE.nom} pour trois matchs, et les médias s'acharnent`}.<div class="hub-gros-detail">${motEntracte(ctx, mbHier)}</div></div>` : '';
    return `${mbMot}${mien}${portailHtml()}`;
  };

  /*
   * LE PORTAIL DU BUREAU (1.0, J2-7). Au bureau, la colonne de droite restait
   * vide 80 soirs sur 82. Quatre tuiles d'un coup d'oeil, chacune s'ouvre sur
   * son onglet (`ouvrirTuile`) : le classement autour de toi, tes cinq
   * prochains matchs, tes trois meneurs, ton deck. Sur téléphone, ces onglets
   * sont à un toucher dans la barre : le portail ne s'y montre pas, pour
   * qu'aucun onglet ne devienne une longue page.
   */
  const portailHtml = () => {
    if (!jour || jour >= N) return '';
    const cl = classement(), r = cl.indexOf(you);
    const de = Math.max(0, Math.min(r - 2, cl.length - 5));
    const rangs = cl.slice(de, de + 5).map((t, i) => `<div class="hp-l${t === you ? ' toi' : ''}"><span class="hp-n">${de + i + 1}</span>${ctx.logo(t.tag, 14)}<b>${ctx.esc(t === you ? 'NHL Stars' : ctx.tagCourt(t))}</b><em>${fiche.get(t).PTS} pts</em></div>`).join('');
    const avenir = [];
    for (let d = jour; d < N && avenir.length < 5; d++) { const k = indexMien(d); if (k >= 0) avenir.push({ d, m: calendrier[d][k] }); }
    const prochains = avenir.map(({ d, m }) => {
      const adv = m.A === you ? m.B : m.A;
      return `<div class="hp-l"><span class="hp-n">J${d + 1}</span>${ctx.logo(adv.tag, 14)}<b>${m.A === you ? '' : '@ '}${ctx.esc(ctx.tagCourt(adv))}</b><em>${ficheTexte(adv)}</em></div>`;
    }).join('');
    const tete = Object.values(you.roster || {}).filter(p => p && p.p !== 'G').map(p => ({ p, s: compte.get(p) }))
      .filter(x => x.s && x.s.pts).sort((a, b) => b.s.pts - a.s.pts || b.s.g - a.s.g).slice(0, 3);
    const meneurs = tete.map(({ p, s }) => `<div class="hp-l"><b>${ctx.esc(p.n)}</b><em>${s.g}-${s.a}-${s.pts}</em></div>`).join('')
      || '<div class="hp-l"><b>Personne n\'a encore de point.</b></div>';
    const deck = deckAvant(jour);
    const maudites = deck.filter(c => CARTES_MATCH[c] && CARTES_MATCH[c].maudite).length;
    return `<div class="hub-portail">
      <div class="hub-tuile" data-ouvre="classement" role="button" tabindex="0"><div class="hp-t">Classement</div>${rangs}</div>
      <div class="hub-tuile" data-ouvre="fiche" role="button" tabindex="0"><div class="hp-t">Tes ${avenir.length} prochains</div>${prochains}</div>
      <div class="hub-tuile" data-ouvre="meneurs" role="button" tabindex="0"><div class="hp-t">Tes meneurs</div>${meneurs}</div>
      <div class="hub-tuile hub-deck" role="button" tabindex="0"><div class="hp-t">Ton deck</div><div class="hp-l"><b>${deck.length} cartes</b><em>${ENERGIE_MAIN} d'élan par main</em></div>${maudites ? `<div class="hp-l prix"><b>${maudites} malédiction${maudites > 1 ? 's' : ''}</b></div>` : ''}<div class="hp-l"><small>Touche pour le voir</small></div></div>
    </div>`;
  };

  const voletClassement = () => {
    // LE CLASSEMENT COMME DANS LE JOURNAL (S30) : la fiche, les points, les
    // buts, et les deux colonnes qui disent la forme du moment — la séquence
    // en cours et les dix derniers matchs.
    const rangee = (t, i) => { const g = fiche.get(t); return `<tr class="${t === you ? 'toi' : ''}${i === enSeries - 1 ? ' cut' : ''}"><td>${i + 1}</td><td class="nom">${ctx.logo(t.tag, 14)} <span class="nom-long">${ctx.esc(ctx.teamShort(t))}</span><span class="nom-court">${ctx.esc(ctx.tagCourt(t))}</span></td><td>${g.W + g.L + g.OTL}</td><td>${g.W}</td><td>${g.L}</td><td>${g.OTL}</td><td class="heros">${g.PTS}</td><td>${g.GF}</td><td>${g.GA}</td><td>${g.GF - g.GA > 0 ? '+' : ''}${g.GF - g.GA}</td><td>${sequenceDe(t)}</td><td>${dixDerniers(t)}</td></tr>`; };
    return `${resultatsDuJour()}<div class="live-tableau hub-classement"><div class="live-tableau-titre">Classement · journée ${jour} · les ${enSeries} premiers vont en séries</div>
      <table><thead><tr><th>#</th><th>Équipe</th><th>PJ</th><th>V</th><th>D</th><th>DP</th><th class="heros">PTS</th><th>BP</th><th>BC</th><th>Diff</th><th title="La séquence en cours">Séq.</th><th title="Les dix derniers matchs : V-D-DP">10 derniers</th></tr></thead>
      <tbody>${classement().map(rangee).join('')}</tbody></table></div>`;
  };

  /*
   * TON HISTOIRE (S69). JP : *j'aime l'idée d'avoir quelque chose qui fait
   * storyline, style Slay the Spire ou un RPG tactique léger, dans comment
   * chaque run va avoir son histoire*. Rien d'inventé : le récit relit ce que
   * la saison a VRAIMENT été jusqu'ici — les attentes du proprio, les
   * dilemmes et ce que tu as choisi, les cartes qui ont changé, les gros
   * matchs et leur issue, les séquences — rangé en trois actes. La rivalité
   * qui s'en dégage suit ta formation jusqu'aux séries.
   */
  const rivalite = () => rivaliteDe(you, jour);
  const ACTES = [[0, 'Acte I', "L'automne"], [28, 'Acte II', "L'hiver"], [56, 'Acte III', 'Le sprint']];
  const nomJoueur = cle => { const p = cle && Object.values(you.roster || {}).find(x => x && getPlayerKey(x) === cle); return p ? p.n : ''; };
  const scoreDe = (j, m) => { const pour = m.A === you ? m.gfA : m.gfB, contre = m.A === you ? m.gfB : m.gfA; return `${pour}–${contre}${m.ot ? ' (P)' : ''}`; };
  const recitHtml = () => {
    const ev = [];
    for (const d of decs) {
      if (d.jour == null || d.jour > jour) continue;
      if (d.objectif && OBJECTIFS[d.objectif.cle]) ev.push({ j: d.jour, t: `🏢 Le proprio exige : <b>${ctx.esc(OBJECTIFS[d.objectif.cle].nom)}</b>` });
      else if (d.recompense && CARTES_MATCH[d.recompense] && typeof d.palier === 'string') ev.push({ j: d.jour, t: `🎁 Nouvelle carte dans ton deck : ${CARTES_MATCH[d.recompense].ico} <b>${ctx.esc(CARTES_MATCH[d.recompense].nom)}</b>` });
      else if (typeof d.palier === 'string' && d.palier.startsWith('v:')) ev.push({ j: d.jour, t: d.carte && CARTES[d.carte] ? `🏆 Objectif atteint — le proprio paie : ${CARTES[d.carte].ico} <b>${ctx.esc(CARTES[d.carte].nom)}</b>` : '😬 Objectif raté : le savon dans le bureau du proprio' });
      else if (d.moment) {
        const cat = d.moment.famille === 'sequence' ? SEQUENCES[d.moment.cle] : MOMENTS[d.moment.cle];
        if (!cat) continue;
        const o = (cat.options || []).find(x => x.cle === d.moment.choix);
        const titre = String(cat.titre).replace(/\{nom\}/g, nomJoueur(d.moment.joueur) || 'un joueur');
        ev.push({ j: d.jour, t: `${cat.ico} ${ctx.esc(titre)}${o ? ` — tu as choisi : <b>${ctx.esc(o.nom)}</b>` : ''}` });
      } else if (d.deck && SORTES_DECK[d.deck]) {
        const S = SORTES_DECK[d.deck], M = d.mutation && MUTATIONS[d.mutation.cle], T = d.maitrise && systemeDe(d.maitrise.tac);
        const qui = d.deck === 'recrue' ? nomJoueur(d.ballottage && d.ballottage.entre) : d.mutation ? nomJoueur(d.mutation.joueur) : '';
        // S80 : la modif gardée au palier (`garde`, « joueur:affute ») attend dans l'inventaire.
        const MG = d.garde ? MUTATIONS[String(d.garde).split(':')[1]] : null;
        const t = d.deck === 'camp' && CARTES_MATCH[`${d.aiguise}+`] ? `Le camp d'entraînement : ${CARTES_MATCH[d.aiguise].ico} <b>${ctx.esc(CARTES_MATCH[`${d.aiguise}+`].nom)}</b>`
          : d.deck === 'menage' && CARTES_MATCH[d.retrait] ? `Le ménage : ${CARTES_MATCH[d.retrait].ico} <b>${ctx.esc(CARTES_MATCH[d.retrait].nom)}</b> quitte ton deck`
          : d.deck === 'recrue' ? `Recrue : <b>${ctx.esc(qui || 'un joueur')}</b> signé`
          : MG ? `${MG.ico} <b>${ctx.esc(MG.nom)}</b> gardée dans ton inventaire`
          : M ? `${M.ico} ${ctx.esc(M.nom)} pour <b>${ctx.esc(qui || 'un joueur')}</b>`
            : T ? `Stage de système : ${T.ico} <b>${ctx.esc(T.nom)}</b>` : ctx.esc(S.nom);
        ev.push({ j: d.jour, t: `${S.ico} ${t}` });
      } else if (d.joue && d.mutation && MUTATIONS[d.mutation.cle]) ev.push({ j: d.jour, t: `${MUTATIONS[d.mutation.cle].ico} ${ctx.esc(MUTATIONS[d.mutation.cle].nom)} posée au verso de <b>${ctx.esc(nomJoueur(d.mutation.joueur) || 'un joueur')}</b>` });
      else if (d.carte && typeof d.palier === 'number' && CARTES[d.carte]) ev.push({ j: d.jour, t: `🎁 La main de la journée : ${CARTES[d.carte].ico} <b>${ctx.esc(CARTES[d.carte].nom)}</b>` });
      else if (d.ballottage) ev.push({ j: d.jour, t: '📋 Un joueur réclamé au ballottage pour boucher un trou' });
    }
    for (const m of you.mutations || []) if (m.jour < jour && m.source !== 'choix' && MUTATIONS[m.cle]) ev.push({ j: m.jour, t: `${MUTATIONS[m.cle].ico} Le hasard s'en mêle : ${ctx.esc(m.p ? m.p.n : '')} — ${ctx.esc(MUTATIONS[m.cle].nom)}` });
    for (const x of you.paris || []) if (x.jour != null && x.jour < jour) ev.push({ j: x.jour, t: `🎲 ${ctx.esc(x.titre)} — ${ctx.esc(x.choix || '')} : ${x.gagne ? '<b>le pari a payé</b>' : '<b>le pari a mal tourné</b>'}` });
    for (const mb of you.minisBoss || []) {
      if (mb.jour >= jour || !MINI_BOSS[mb.raison]) continue;
      const m = (calendrier[mb.jour] || []).find(x => x.A === you || x.B === you);
      const Av = mb.avant && AVANT_GROS[mb.avant.cle];
      const Ao = Av && Av.options.find(o => o.cle === mb.avant.choix);
      ev.push({ j: mb.jour, t: `${MINI_BOSS[mb.raison].ico} Gros match contre ${ctx.esc(ctx.teamShort(mb.adv))} (${ctx.esc(MINI_BOSS[mb.raison].nom.toLowerCase())}) — ${mb.gagne ? '<b>gagné</b>' : '<b>perdu</b>'}${m ? ` ${scoreDe(mb.jour, m)}` : ''}${Ao ? ` · avant : ${Av.ico} ${ctx.esc(Ao.nom.toLowerCase())}` : ''}${mb.cartes && mb.cartes.jouees.length ? ` · 🃏 ${mb.cartes.jouees.map(c => CARTES_MATCH[c] ? CARTES_MATCH[c].ico : '').join('')}` : ''}${mb.prepJuste === true ? ' · 🎯 préparation juste' : mb.prepJuste === false ? ' · 💥 préparation ratée' : ''}<small class="recit-detail">${motEntracte(ctx, mb)}</small>` });
    }
    // Les séquences marquantes : cinq victoires de suite ou plus, cinq défaites.
    let run = 0, sens = null, debut = 0;
    const fermerRun = () => { if (run >= 5) ev.push({ j: debut, t: sens ? `🔥 ${run} victoires de suite` : `🥶 ${run} défaites de suite` }); };
    for (const { j, m } of miens) { const v = gagne(m, you); if (v === sens) run++; else { fermerRun(); sens = v; run = 1; debut = j; } }
    fermerRun();
    if (!ev.length) return '';
    ev.sort((a, b) => a.j - b.j);
    const riv = rivalite();
    const actes = ACTES.map(([d0, nom, sous], i) => {
      const fin = ACTES[i + 1] ? ACTES[i + 1][0] : Infinity;
      const ici = ev.filter(e => e.j >= d0 && e.j < fin);
      return ici.length ? `<div class="recit-acte"><div class="recit-acte-t">${nom} · ${sous}</div>${ici.map(e => `<div class="recit-ev"><span class="recit-j">J${e.j + 1}</span><span>${e.t}</span></div>`).join('')}</div>` : '';
    }).join('');
    return `<div class="recit"><div class="hub-titre">📖 Ton histoire</div>${riv ? `<div class="recit-rival">⚔️ Ta rivalité : <b>${ctx.esc(ctx.teamLabel(riv.adv))}</b> · ${riv.v}-${riv.d} dans les gros matchs</div>` : ''}${actes}</div>`;
  };
  /*
   * LA ROUTE DE LA SAISON (S66) quitte l'écran Match (S79) : quatre rangées
   * d'icônes au-dessus de l'affiche, sans légende, se lisaient mal. Elle vit
   * avec ton histoire, et elle dit ce que veut dire chaque marque.
   */
  const routeFiche = () => `<div class="hub-titre">La route de la saison</div>${routeHtml(jour, N)}
    <div class="hub-route-legende">🏢 le proprio fixe un objectif · 🃏 une carte à prendre · ❓ un dilemme · 💬 le vestiaire</div>`;
  const voletFiche = () => {
    if (!miens.length) return `${routeFiche()}<div class="hub-note">Aucun match joué encore.</div>`;
    const lignes = miens.slice().reverse().map(({ j, k, m }) => {
      const adv = m.A === you ? m.B : m.A;
      const pour = m.A === you ? m.gfA : m.gfB, contre = m.A === you ? m.gfB : m.gfA;
      const v = gagne(m, you);
      const somm = m.feuille ? ` data-sommaire="saison|${j}|${k}" role="button" tabindex="0" title="Le sommaire du match"` : '';
      return `<div class="hub-jeu${v ? ' v' : ' d'}"${somm}><span class="hub-jeu-n">J${j + 1}</span><span class="hub-jeu-res">${v ? 'V' : m.ot ? 'DP' : 'D'}</span><span class="hub-jeu-score">${pour}–${contre}</span>${ctx.logo(adv.tag, 15)}<span class="hub-jeu-adv">${ctx.esc(ctx.teamLabel(adv))}</span>${m.ot ? '<em>P</em>' : ''}</div>`;
    }).join('');
    const f = fiche.get(you);
    return `${routeFiche()}${recitHtml()}<div class="hub-titre">Tes ${miens.length} matchs · ${f.W}-${f.L}-${f.OTL} · ${f.GF} BP · ${f.GA} BC${sequence() ? ` · séquence ${sequence()}` : ''}</div><div class="hub-jeux">${lignes}</div>`;
  };

  /*
   * LE MENU : les meneurs de toute la ligue et la feuille de n'importe
   * quelle équipe, triables. L'état (vue, tris, équipe ouverte) survit aux
   * rendus — le volet se refait à chaque journée.
   */
  const menu = menuNeuf();
  const matchsDe = t => { const g = fiche.get(t); return g ? g.W + g.L + g.OTL : 0; };
  /* Les blessés d'une équipe à ce jour : on ne révèle que ce qui est arrivé. */
  const blessesDe = (t, joues) => {
    const m = new Map();
    for (const b of (t.injuriesLog || [])) {
      const reste = b.at + b.games - (joues + 1);
      if (b.at <= joues + 1 && reste > 0) m.set(b.player, reste);
    }
    return m;
  };

  const tabs = onglets(barre, volet, [
    { cle: 'journee', ico: 'i-cal', titre: 'Journée', page: 'match' }, { cle: 'classement', ico: 'i-chart', titre: 'Classement', page: 'classement' },
    { cle: 'meneurs', ico: 'i-star', titre: 'Meneurs', page: 'meneurs' }, { cle: 'equipes', ico: 'i-jersey', titre: 'Équipes', page: 'equipes' },
    { cle: 'fiche', ico: 'i-target', titre: 'Ma fiche', page: 'calendrier' },
  ], cle => {
    if (cle === 'classement') return voletClassement();
    if (cle === 'meneurs') return meneursHtml(ctx, compte, equipeDe, you, `journée ${jour}`, menu);
    if (cle === 'equipes') return equipesHtml(ctx, {
      teams: classement(), compte, you, menu, matchsDe, blessesDe,
      anciens: t => (t === you ? [...compte.keys()].filter(p => !equipeDe.has(p) && (compte.get(p).gp || 0) > 0) : []),
      ficheDe: t => { const g = fiche.get(t); return `${g.W}-${g.L}-${g.OTL} · ${g.PTS} pts · ${rangDe(t)}${rangDe(t) === 1 ? 'er' : 'e'} · ${g.GF} BP · ${g.GA} BC`; },
    });
    if (cle === 'fiche') return voletFiche();
    return voletJournee();
  });
  // MES CARTES, DE PARTOUT (S79) : le cartable du jeu (l'onglet Vestiaire) les ouvre avec la décision du hub.
  if (onDecision && ctx.inventaire) tabs.hub.cartes = () => ctx.inventaire.ouvrir(jour, d => { const j = jour; quitter(); onDecision(d, j); });
  // LE MARCHÉ (1.0, R1) : la boutique du jour, de la section Marché de la coquille.
  if (onDecision && ctx.boutique) tabs.hub.boutique = () => ctx.boutique.ouvrir(jour, d => { const j = jour; quitter(); onDecision(d, j); });
  // LA DÉCISION DU JOUR, PRÊTÉE (S80) : une carte posée au verso d'une fiche ouverte n'importe où pendant la saison.
  if (onDecision) { tabs.hub.decider = d => { const j = jour; quitter(); onDecision({ jour: j, ...d }, j); }; tabs.hub.jour = () => jour; }
  /*
   * UNE TUILE S'OUVRE SUR SA CARTE (S77) : la forme sur « Ma fiche », le
   * classement sur le classement, le deck sur le deck. Un seul écouteur,
   * délégué au volet qui est refait chaque jour, et débranché avec le menu —
   * le volet est partagé avec l'écran des séries (voir `brancherMenu`).
   */
  const ouvrirTuile = ev => {
    const t = ev.target.closest('.hub-tuile');
    if (!t || !volet.contains(t) || ev.target.closest('.lien-joueur')) return;
    if (t.dataset.ouvre) tabs.montrer(t.dataset.ouvre);
    else if (t.classList.contains('hub-deck')) ouvrirDeck({ deck: deckAvant(jour) });
  };
  volet.addEventListener('click', ouvrirTuile);
  const debrancherMenuSeul = brancherMenu(volet, menu, () => classement(), () => tabs.rafraichir(), cle => tabs.montrer(cle), carte);
  const debrancherMenu = () => { debrancherMenuSeul(); volet.removeEventListener('click', ouvrirTuile); };

  /* ---------- l'en-tête, la carte, les actions ---------- */

  /*
   * LA MAIN DU PALIER, EN PLEIN ÉCRAN (S73). JP : *quand y'a un choix, c'est
   * un fullscreen modal pis ça se passe là, sauf si carte à utiliser plus
   * tard* ; *pense vraiment à un kid qui joue avec ses cartes Upper Deck
   * comme si c'était Slay the Spire*. Trois cartes de sortes différentes
   * (`mainDuDeck`) ; une carte qui demande un deuxième choix — quel joueur,
   * quel rôle, quel système — l'ouvre dans le même plein écran, et « Retour à
   * la main » y ramène. Toutes finissent en UNE décision datée d'aujourd'hui,
   * portant son palier : c'est ce qui ferme la main.
   */
  const RARETE_SORTE = { effet: 'rare', recrue: 'legendaire', amelioration: 'peu', profil: 'peu', strategie: 'commune', menage: 'peu', camp: 'peu', atelier: 'rare' };
  /*
   * UNE CARTE DU DECK SE DATE DU SOIR DU PROCHAIN MATCH (S74), pas d'aujourd'hui.
   * Son sel tire des dés neufs à partir de sa journée : datée d'aujourd'hui,
   * elle rebrassait les journées d'ici au prochain match de ta formation — et
   * le classement, donc le gros match qu'on avait préparé. Entre les deux, ta
   * formation ne joue pas : rien d'autre ne change.
   */
  const soirDuProchain = () => { const p = prochain(); return p ? p.j : jour; };
  const deciderDeck = (p0, d) => { const j = jour, s = soirDuProchain(); quitter(); onDecision({ jour: s, palier: p0, ...d }, j); };
  const POSTE_CARTE = { G: 'Gardien', D: 'Défenseur', LD: 'Défenseur', RD: 'Défenseur', C: 'Centre', LW: 'Ailier', RW: 'Ailier' };
  // Le visage du joueur, l'écusson en médaillon (S74, l'agent de test : « le logo au lieu du visage »).
  const joueurArt = p => artJoueur({ portraitHtml: ctx.mug ? ctx.mug(p) : '', logoHtml: ctx.logo(p.t, ctx.mug ? 24 : 60), pos: ctx.esc(POSTE_CARTE[p.p] || 'Avant'), saison: ctx.esc(p.s), club: ctx.esc(p.t), actionSrc: ctx.mug ? photoAction(p) : '' });
  const connait = x => (x >= 0.6 ? 'le connaît bien' : x >= 0.3 ? 'le connaît un peu' : x > 0.02 ? 'le connaît à peine' : 'ne le connaît pas encore');
  function ouvrirMain(p0) {
    const main = mainDuDeck(graine, p0, dejaPrises);
    const recrues = ctx.recrues ? (ctx.recrues(p0) || []) : [];
    const roles = rolesOfferts(you, graine, p0);
    const options = main.map(c => {
      const S = SORTES_DECK[c.sorte], rarete = RARETE_SORTE[c.sorte];
      if (c.sorte === 'effet') {
        const C = CARTES[c.cle];
        return { cle: `effet:${c.cle}`, rarete, ico: C.ico, nom: C.nom, type: `${S.nom} · toute la saison`, bon: C.bon, prix: C.prix, effet: C };
      }
      if (c.sorte === 'recrue') return { cle: 'recrue', rarete, ico: S.ico, nom: 'Joueur au choix', type: 'Recrue · un vrai joueur',
        texte: 'Trois vrais joueurs de clubs absents de ta ligue : un avant, un défenseur, un gardien. Tu en signes un ; il arrive en réserve, et le plafond compte toujours.',
        desactive: recrues.length ? '' : 'Personne ne rentre sous ton plafond' };
      if (c.sorte === 'amelioration') {
        const M = MUTATIONS[c.cle];
        // S80 : elle va dans ton inventaire, et se pose au verso d'un joueur quand tu veux.
        return { cle: `amelioration:${c.cle}`, rarete, ico: M.ico, nom: M.nom, type: `${S.nom} · se pose au verso`, mutation: c.cle };
      }
      if (c.sorte === 'profil') return { cle: 'profil', rarete, ico: S.ico, nom: 'Nouveau rôle', type: `${S.nom} · pour de bon`,
        texte: roles.length ? `Un de tes joueurs change de rôle pour de bon. Tu choisis lequel : ${roles.map(x => x.p.n).join(' · ')}` : '',
        desactive: roles.length ? '' : 'Personne à convertir' };
      if (c.sorte === 'atelier') return { cle: 'atelier', rarete, ico: S.ico, nom: S.nom, type: `${S.nom} · se pose au verso`,
        texte: `Trois éditions : ${editionsDuJour(graine, p0).map(k => `${MUTATIONS[k].ico} ${MUTATIONS[k].nom}`).join(' · ')}. Tu en gardes une, et tu la poses au verso d'un joueur quand tu veux.` };
      if (c.sorte === 'camp') return { cle: 'camp', rarete, ico: S.ico, nom: 'Le camp d\'entraînement', type: `${S.nom} · ton deck de match`,
        texte: 'Une carte de ton deck de match devient sa version « + » : moitié plus forte, ou un élan de moins.',
        desactive: deckAvant(jour).some(k => CARTES_MATCH[`${k}+`]) ? '' : 'Tout ton deck est déjà amélioré' };
      if (c.sorte === 'menage') return { cle: 'menage', rarete, ico: S.ico, nom: 'Le ménage du vestiaire', type: `${S.nom} · ton deck de match`,
        texte: `Une carte de moins dans ton deck de match (${deckAvant(jour).length} cartes) : les autres sortent plus souvent. Tu choisis laquelle.` };
      return { cle: 'strategie', rarete, ico: S.ico, nom: 'Stage de système', type: `${S.nom} · toute la formation`,
        texte: `Une semaine de pratiques sur un seul système : ta formation fait ${Math.round(GAIN_STAGE * 100)} % du chemin vers sa maîtrise d'un coup. Trois systèmes offerts.` };
    });
    ouvrirChoix({
      ico: '🎁', titre: `La main de la journée ${p0}`, cartes: true, genre: 'palier', fermable: true, motFermer: 'Plus tard',
      recit: 'Trois cartes, trois sortes. Touche celle que tu gardes pour le reste de la saison ; les deux autres retournent dans le jeu.',
      options,
      onChoix: cle => suiteDeLaMain(p0, cle, recrues, roles),
    });
  }
  function suiteDeLaMain(p0, cle, recrues, roles) {
    const retour = () => ouvrirMain(p0);
    const [sorte, arg] = cle.split(':');
    if (sorte === 'effet') { const j = jour, s = soirDuProchain(); quitter(); onCarte(p0, s, arg, j); return; }
    const suite = { cartes: true, genre: 'palier', fermable: true, motFermer: 'Retour aux trois cartes', onFerme: retour };
    if (sorte === 'recrue') {
      ouvrirChoix({ ...suite, ico: '🎟️', titre: 'Joueur au choix',
        recit: 'Trois vrais joueurs, style loto. Touche une carte pour sa fiche, « Signer » pour le prendre — puis tu choisis qui lui laisse sa place.',
        options: recrues.map(x => ({ cle: x.cle, rarete: x.rarete || 'legendaire', nom: x.nom, type: `${x.poste} · ${x.club}`, coin: x.salaire,
          art: joueurArt(x.p), carteJoueur: ctx.carteMini ? ctx.carteMini(x.p) : '', texte: x.ligne, apercu: ctx.apercu ? () => ctx.apercu(x.p) : null })),
        onChoix: k => {
          const x = recrues.find(y => y.cle === k);
          if (!x) return;
          const decide = ({ i, sort }) => deciderDeck(p0, { deck: 'recrue', ballottage: { i, entre: x.cle, sort } });
          if (ctx.quiSort) ctx.quiSort(x.p, { roster: you.roster, genre: 'palier', onChoix: decide, onFerme: () => suiteDeLaMain(p0, 'recrue', recrues, roles) });
          else decide({ i: x.i, sort: x.sort });
        } });
      return;
    }
    /*
     * L'AMÉLIORATION ET L'ATELIER SE GARDENT (S80). JP : *je veux que les
     * upgrades de joueurs se fassent au verso de la carte, pas nécessairement
     * quand on la pige*. La carte prise au palier (l'amélioration, ou
     * l'édition gardée des trois de l'atelier) va dans ton inventaire
     * (`garde`, lu par `pocheDeLaPartie`) ; on la pose au verso d'un joueur
     * quand on veut. La décision ferme le palier et ne touche pas le moteur.
     */
    if (sorte === 'atelier') {
      ouvrirChoix({ ...suite, ico: '🛠️', titre: 'L\'atelier',
        recit: 'Trois éditions : touche celle que tu gardes. Elle va dans ton inventaire, et tu la poses au verso d\'un joueur quand tu veux ; elle vaut pour le reste de la saison.',
        options: editionsDuJour(graine, p0).map(k => ({ cle: k, rarete: 'rare', ico: MUTATIONS[k].ico, nom: MUTATIONS[k].nom, type: 'L\'atelier', texte: MUTATIONS[k].quoi, mots: motsDeMutation(k) })),
        onChoix: k => deciderDeck(p0, { deck: 'atelier', garde: `joueur:${k}` }) });
      return;
    }
    if (sorte === 'amelioration') { deciderDeck(p0, { deck: 'amelioration', garde: `joueur:${arg}` }); return; }
    if (sorte === 'profil') {
      ouvrirChoix({ ...suite, ico: '🔄', titre: 'Nouveau rôle',
        recit: 'Trois conversions possibles dans ton alignement. Le joueur change de rôle pour de bon : son fit dans chaque système suit.',
        options: roles.map(x => ({ cle: `${x.cle}|${getPlayerKey(x.p)}`, rarete: 'peu', ico: MUTATIONS[x.cle].ico, nom: MUTATIONS[x.cle].nom,
          // Où il joue (S80) : « Hal Gill · 3e paire ».
          type: ctx.ouJoue && ctx.ouJoue(x.p) ? `${x.p.n} · ${ctx.ouJoue(x.p)}` : x.p.n,
          art: joueurArt(x.p), carteJoueur: ctx.carteMini ? ctx.carteMini(x.p) : '', mutation: x.cle, motChoix: 'Choisir', apercu: ctx.apercu ? () => ctx.apercu(x.p) : null })),
        onChoix: k => { const [m, joueur] = k.split('|'); deciderDeck(p0, { deck: 'profil', mutation: { cle: m, joueur } }); } });
      return;
    }
    if (sorte === 'camp') {
      const uniques = [...new Set(deckAvant(jour))].filter(k => CARTES_MATCH[`${k}+`]);
      ouvrirChoix({ ...suite, ico: '🏋️', titre: 'Le camp d\'entraînement',
        recit: 'Une semaine de pratiques sur une seule chose : choisis la carte qui devient sa version « + ». On voit ici la version améliorée.',
        options: uniques.map(k => ({ ...optionDeCarteMatch(`${k}+`), cle: k })),
        onChoix: k => deciderDeck(p0, { deck: 'camp', aiguise: k }) });
      return;
    }
    if (sorte === 'menage') {
      // Les malédictions d'abord : c'est d'elles qu'on veut se débarrasser.
      const uniques = [...new Set(deckAvant(jour))].sort((a, b) => (CARTES_MATCH[b].maudite ? 1 : 0) - (CARTES_MATCH[a].maudite ? 1 : 0));
      ouvrirChoix({ ...suite, ico: '🗑️', titre: 'Le ménage du vestiaire',
        recit: 'Une carte quitte ton deck de match pour de bon. Une malédiction, une carte faible, un doublon : un deck mince pige plus souvent ses meilleures.',
        options: uniques.map(k => ({ ...optionDeCarteMatch(k), rarete: CARTES_MATCH[k].maudite ? 'commune' : CARTES_MATCH[k].rarete })),
        onChoix: k => deciderDeck(p0, { deck: 'menage', retrait: k }) });
      return;
    }
    if (sorte === 'strategie') {
      const dresses = SLOTS.filter(sl => !sl.scratch && sl.group !== 'G').map(sl => you.roster[sl.i]).filter(p => p && p.p !== 'G');
      // La maîtrise À CE JOUR (la photo de la journée), pas celle de fin de saison :
      // le moteur a déjà joué les 82 matchs quand l'écran s'ouvre.
      const jl = you.jourLignes && you.jourLignes[Math.max(0, Math.min(jour, you.jourLignes.length - 1))];
      const app = jl && jl.apprentissage ? apprentissagePhoto(jl.apprentissage) : null;
      // Un système de trio s'apprend par les avants, un système de paire par les défenseurs (S79).
      const estD = p => p.p === 'D' || p.p === 'LD' || p.p === 'RD';
      const maitrise = tac => { const D = systemeDe(tac).groupe === 'D'; const qui = dresses.filter(p => estD(p) === D); return app ? qui.reduce((a, p) => a + ((app.maitrise(p) || {})[tac] || 0), 0) / (qui.length || 1) : 0; };
      const NOMS = { F: ['1er trio', '2e trio', '3e trio', '4e trio'], D: ['1re paire', '2e paire', '3e paire'] };
      ouvrirChoix({ ...suite, ico: '📘', titre: 'Stage de système',
        recit: `Toute ta formation apprend le système choisi : ${Math.round(GAIN_STAGE * 100)} % du chemin vers la maîtrise, d'un coup. La chimie de chaque ligne qui le joue monte avec.`,
        options: tactiquesDuStage(graine, p0).map(tac => {
          const T = systemeDe(tac);
          const fits = NOMS[T.groupe].map((_, u) => fitUnite(you.roster, T.groupe, u, tac) ?? 0);
          const meilleure = fits.indexOf(Math.max(...fits));
          return { cle: tac, rarete: 'commune', ico: T.ico, nom: T.nom, type: T.groupe === 'D' ? 'Stage · système de paire' : 'Stage · système de trio',
            texte: `${T.mot} ${T.groupe === 'D' ? 'Tes défenseurs' : 'Tes avants'} : ${connait(maitrise(tac))}.`,
            mots: [{ txt: `Taillé pour ta ${NOMS[T.groupe][meilleure]}`, bon: fits[meilleure] >= 55 }] };
        }),
        onChoix: tac => deciderDeck(p0, { deck: 'strategie', maitrise: { tac, gain: GAIN_STAGE } }) });
    }
  }

  /*
   * L'ÉTAT DE LA SAISON (S79), à la place du portail de S77 : ce que le
   * proprio attend et qui manque, en une ou deux lignes.
   */
  function etatHtml() {
    /*
     * S79 : les cinq tuiles répétaient ce que l'en-tête, l'affiche et les
     * onglets disent déjà (la fiche trois fois, le rang deux fois, le deck qui
     * est dans « Mes cartes »). Il reste ce qui n'a pas d'autre place : ce que
     * le proprio attend, et qui manque. Rien quand il n'y a rien.
     */
    const lignes = [];
    // LA RUN ROGUE (S80) : sa saison, et ce que le proprio exige pour qu'elle continue.
    const run = ctx.rogue && ctx.rogue.mandat ? ctx.rogue.mandat() : null;
    if (run) {
      // 1.0 (R4) : le barème des jetons, lu dans la run (jamais tapé), et le mandat d'après.
      const B = run.bareme || {};
      const bareme = [['Victoire', B.victoire], ['prolongation', B.prolongation], ['défaite', B.defaite], ['gros match', B.grosMatch, '+'], ['objectif', B.objectif, '+'], ['ronde de séries', B.serie, '+']]
        .filter(([, v]) => v != null).map(([k, v, plus]) => `${k} ${plus || ''}${v}`).join(' · ');
      lignes.push(`<div class="hub-etat-l hub-etat-run" title="Manque le mandat et la run est finie ; gagne la Coupe et elle est gagnée">
        <span class="hub-etat-k">💀 La run</span>
        <span class="hub-etat-v">Saison ${run.saison} · le proprio veut : <b>${ctx.esc(run.mot)}</b>${run.suivant ? ` <small class="hub-run-suite">· puis : ${ctx.esc(run.suivant)}</small>` : ''}</span>
        ${bareme ? `<small class="hub-run-bareme" title="Ce que chaque résultat rapporte, en jetons">🪙 ${ctx.esc(bareme)}</small>` : ''}
      </div>`);
    }
    const oc = onDecision ? objectifEnCours() : null;
    if (oc && OBJECTIFS[oc.d.objectif.cle]) {
      const O = OBJECTIFS[oc.d.objectif.cle];
      const part = Math.max(0, Math.min(1, oc.e.val / Math.max(1, oc.e.cible)));
      const etat = oc.e.reussi ? ' fait' : oc.e.rate ? ' rate' : O.sens < 0 && part >= 0.8 ? ' serre' : '';
      lignes.push(`<div class="hub-etat-l hub-etat-proprio" title="${ctx.esc(O.nom)}">
        <span class="hub-etat-k">🏢 Le proprio</span>
        <span class="hub-etat-v">${O.ico} ${ctx.esc(O.court)} · <b class="chiffre" data-compte="t-obj">${oc.e.val}</b> / ${oc.e.cible} ${ctx.esc(O.unite)}</span>
        <span class="tuile-jauge${O.sens < 0 ? ' mur' : ''}${etat}" aria-hidden="true"><span style="width:${(100 * part).toFixed(1)}%"></span></span>
        <small>${oc.e.joues}/${MATCHS_OBJECTIF} matchs</small>
      </div>`);
    }
    // L'INFIRMERIE : qui manque, et pour combien de matchs — à ce jour seulement (`blessesDe` ne révèle que ce qui est arrivé).
    const bl = [...blessesDe(you, matchsDe(you))].sort((a, b) => b[1] - a[1]);
    const lien = p => (ctx.fiche ? ctx.fiche(p, you, ctx.esc(p.n)) : ctx.esc(p.n));
    if (bl.length) lignes.push(`<div class="hub-etat-l hub-etat-infirmerie">
        <span class="hub-etat-k">🚑 Infirmerie</span>
        <span class="hub-etat-v">${bl.slice(0, 3).map(([p, n]) => `${lien(p)} <b>${n} m.</b>`).join(' · ')}${bl.length > 3 ? ` · et ${bl.length - 3} autre${bl.length - 3 > 1 ? 's' : ''}` : ''}</span>
      </div>`);
    return lignes.length ? `<div class="hub-etat" role="group" aria-label="Ta saison">${lignes.join('')}</div>` : '';
  }

  function dessiner() {
    // Le ✕ ne passe au bilan qu'une fois la saison jouée (S79).
    ui.close.hidden = jour < N;
    // Le flottant se rebranche plus bas s'il y a une journée à jouer ; la fin
    // de saison n'en a pas, et il restait par-dessus « Voir le bilan » (QA S74b).
    cacherBoutonFlottant();
    const f = fiche.get(you);
    const rang = rangDe(you);
    const seq = sequence();
    // L'EN-TÊTE DU CLUB, à la FM24 (S77) : le bandeau prend les couleurs du
    // club qu'on dirige et porte son écusson — on sait chez qui on est avant
    // d'avoir lu un mot. L'écusson des NHL Stars est un SVG qui ÉCRIT (« NHL
    // STARS » sur sa bande) : ce mot entre dans le texte de l'en-tête, pareil
    // à chaque rendu, et le test de fumée n'y cherche que « Journée N ».
    head.innerHTML = `<span class="hub-ecusson" aria-hidden="true">${ctx.logo(you.tag, 24)}</span><span class="live-ronde">${epoque ? `Saison ${ctx.esc(epoque)}` : 'Saison régulière'}</span>
      <span class="live-match">Journée ${jour} / ${N}</span>
      <span class="live-serie">${jour ? `${f.W}-${f.L}-${f.OTL} · ${f.PTS} pts · ${rang}${rang === 1 ? 'er' : 'e'}${seq ? ` · ${seq}` : ''}` : 'La saison commence'}</span>`;

    const p = prochain();
    if (jour >= N) {
      if (ui.outils) ui.outils.innerHTML = '';
      carte.innerHTML = `<div class="live-bilan ${rang <= enSeries ? 'gagne' : 'perdu'}"><div class="live-bilan-titre">Saison terminée · ${f.W}-${f.L}-${f.OTL} · ${rang}${rang === 1 ? 'er' : 'e'} de ${teams.length}${rang <= enSeries ? ' · en séries' : ' · éliminé'}</div></div>`;
      // Une main de palier encore ouverte (on a passé à la fin) : elle vaut encore
      // pour les séries — les cartes de saison y jouent — donc elle s'offre ici.
      const palFin = palierOuvert();
      actions.innerHTML = `${palFin !== undefined ? '<button class="btn hub-main-ouvrir">🎁 La main de la journée t\'attend : trois cartes</button>' : ''}<button class="btn gold hub-suite">Voir le bilan de la saison</button>`;
      actions.querySelector('.hub-suite').onclick = fermer;
      const vm = actions.querySelector('.hub-main-ouvrir');
      if (vm) vm.onclick = () => ouvrirMain(palFin);
      if (palFin !== undefined && !palProposes.has(palFin) && !choixOuvert()) { palProposes.add(palFin); ouvrirMain(palFin); }
      return;
    }
    if (p) {
      const adv = p.m.A === you ? p.m.B : p.m.A;
      // Ta fiche est dans l'en-tête ; celle d'en face, ici. La forme des deux clubs, sous leur nom.
      const fa = t => (jour ? (t === you ? '' : `${ficheTexte(t)} · ${rangDe(t)}${rangDe(t) === 1 ? 'er' : 'e'}`) : (t.season ? `saison ${t.season}` : ''));
      // Le dernier affrontement contre ce club, s'il y en a eu un.
      const deja = miens.filter(x => (x.m.A === adv || x.m.B === adv));
      const dernierMot = deja.length
        ? `${deja.filter(x => gagne(x.m, you)).length} victoire${deja.filter(x => gagne(x.m, you)).length > 1 ? 's' : ''} en ${deja.length} match${deja.length > 1 ? 's' : ''} contre ce club cette saison.`
        : 'Premier affrontement de la saison contre ce club.';
      // L'AFFICHE DU MATCH (S30) : qui reçoit qui. `A` est à domicile dans le
      // moteur — c'est lui qui a le dernier changement — et une affiche le dit.
      const domicile = p.m.A === you;
      /*
       * TES LIGNES ET LA CONSIGNE DU MATCH (S68), à la HockeyArena : la
       * tactique et la chimie de chaque ligne se lisent sur l'affiche, et
       * « Préparer le match » ouvre le poste de gérant en plein écran — les
       * lignes, leurs profils, la tactique d'en face, l'importance du match.
       * Appliquer rejoue la saison depuis aujourd'hui, avec des dés neufs.
       */
      const etat = (you.jourLignes && you.jourLignes[jour]) || { chimie: you.chimie || [0, 0, 0, 0], energie: {} };
      const lignesToi = lignesDe(you, you.roster);
      const matchPris = decs.find(d => d.match && d.jour === p.j);
      const imp = IMPORTANCES[(matchPris && matchPris.match.importance) || 'normale'] || IMPORTANCES.normale;
      const planSoir = `<div class="hub-lignes">
        <span class="gl-k">Tes lignes</span> ${resumeLignes(lignesToi, etat.chimie)}
        <span class="hub-lignes-imp" title="L'importance de ce match">${imp.ico} ${ctx.esc(imp.nom)}</span>
        ${onDecision ? '<button type="button" class="btn gold hub-preparer">Préparer le match</button>' : ''}
      </div>`;
      /*
       * LE GROS MATCH (S69, S70) : annoncé avant, jamais son issue. Le plan
       * de l'adversaire se lit comme un rapport d'éclaireur — ce qu'il règle
       * sur ses lignes, ce qui le contre et si tes lignes le contrent déjà.
       */
      const mb = grosDuJour(p.j);
      const avantPris = mb && decs.find(d => d.jour === p.j && d.avant);
      const Av = avantPris && AVANT_GROS[avantPris.avant.cle];
      const Ao = Av && Av.options.find(o => o.cle === avantPris.avant.choix);
      /*
       * AU TÉLÉPHONE, UNE LIGNE (S78). JP : *page trop longue, ça fait qu'on
       * perd parfois l'info*. Le gros match s'annonce en une ligne sur
       * l'affiche ; ce qu'on en sait (leurs pistes, leur main, l'enjeu) vit
       * dans le dépistage, qui s'ouvre au toucher.
       */
      const miniBoss = mb && MINI_BOSS[mb.raison] ? `<div class="hub-gros">
        <div class="hub-gros-tete">${MINI_BOSS[mb.raison].ico} <b>Match important · ${ctx.esc(MINI_BOSS[mb.raison].nom)}</b> — ${ctx.esc(MINI_BOSS[mb.raison].mot)}</div>
        ${Ao ? `<div class="hub-gros-avant">${Av.ico} ${ctx.esc(Av.titre)} : <b>${ctx.esc(Ao.nom)}</b></div>` : ''}
      </div>` : '';
      const grosDepistage = mb && MINI_BOSS[mb.raison] ? `<div class="hub-gros-dep">
        ${onDecision ? depistageHtml(pistesDuRapport(mb.depistage), { nomAdv: ctx.teamShort(adv) }) + mainAdverseHtml(mainAdverse(graine, `j${p.j}`, energieAdverse({ jour: p.j })), { nomAdv: ctx.teamShort(adv), energie: energieAdverse({ jour: p.j }) }) : ''}
        <div class="choix-puces">${puces([{ txt: `Victoire : ${ELAN.ico} ${ELAN.nom}, précision ${flechesDe(ELAN.finition)} · ${ELAN.duree} matchs`, bon: true }, { txt: `Défaite : ${SONNE.ico} ${SONNE.nom}, précision ${flechesDe(SONNE.finition)} · ${SONNE.duree} matchs`, bon: false }])}</div>
        ${onDecision ? '<div class="hub-gros-note">🎬 Au deuxième entracte, un choix t\'attend.</div>' : ''}
      </div>` : '';
      /*
       * LE DÉPISTAGE D'AVANT-MATCH (S78). JP : *forces comparatives attaque,
       * déf, gardien, robustesse et vitesse … avec chances de victoire et
       * conditions de victoire et de défaite pour chaque équipe, basé dans les
       * vraies probabilités*. Il se calcule au toucher (300 matchs du moteur),
       * pas à chaque journée qui passe.
       */
      const depistage = `<details class="hub-depistage"${boite.depOuvert === p.j ? ' open' : ''}>
        <summary><span>🔎 Le dépistage</span><small>chances, forces comparées, quoi faire ce soir</small></summary>
        <div class="hub-dep-corps">${grosDepistage}<div class="hub-dep-calc" data-dep="${p.j}">${boite.depOuvert === p.j ? depistageMatchHtml(p) : ''}</div></div>
      </details>`;
      // CE QUI JOUE SUR TA FORMATION (S72), en une ligne ; le détail est dans « Préparer le match ».
      const ecJ = effetsEnCours(you, p.j);
      const enJeu = [...ecJ.effets.filter(e => e.nom).map(e => `${e.ico || '✨'} ${e.nom}`), ...ecJ.absents.map(a => `👥 ${a.p.n} au vestiaire`), ...(ecJ.gardienAux ? ['🧤 l\'auxiliaire au filet'] : [])];
      const enJeuHtml = onDecision && enJeu.length ? `<div class="hub-encours" title="Le détail est dans « Préparer le match »">En cours : ${enJeu.map(x => ctx.esc(x)).join(' · ')}</div>` : '';
      // LES TOTAUX DU SOIR (1.0, C5) : ce que le moteur appliquera, effets multipliés et bornés.
      const totJ = motsDesTotaux(totauxDuMatch(p.j));
      const totauxHtml = `<div class="hub-totaux" title="Les effets se multiplient entre eux. Le détail est dans « Préparer le match »."><b>${p.j === jour ? 'Ce soir' : 'Au prochain match'} :</b> <span class="choix-puces">${totJ.length ? puces(totJ) : '<span class="puce neutre">aucun effet</span>'}</span></div>`;
      carte.innerHTML = `${miniBoss}<div class="hub-match">
        <div class="hub-match-titre">Prochain match · journée ${p.j + 1} <span class="hub-lieu" title="L'équipe à domicile a le dernier changement : son appariement de trios tient mieux.">${domicile ? 'à domicile' : `chez ${ctx.esc(ctx.teamShort(adv))}`}</span></div>
        <div class="hub-face">${blocEquipe(ctx, p.m.A, fa(p.m.A), 'a', formeHtml(p.m.A))}<div class="hub-vs">VS</div>${blocEquipe(ctx, p.m.B, fa(p.m.B), 'b', formeHtml(p.m.B))}</div>
        <div class="hub-match-note">${dernierMot}</div>
        ${totauxHtml}
        ${enJeuHtml}
        ${soirEreintant(p.j) ? '<div class="hub-match-note hub-ereintant" title="Un match sur quatre est éreintant : la finition de chaque club suit l\'écart de robustesse entre les deux. Derrière le banc, tu peux habiller tes joueurs les plus robustes.">🥵 Soir éreintant — la robustesse pèse ce soir</div>' : ''}
        ${depistage}
        ${planSoir}
      </div>`;
      // Le dépistage se calcule quand on l'ouvre, et reste ouvert d'un rendu à l'autre le même soir.
      const det = carte.querySelector('.hub-depistage');
      brancherConseils(det);
      if (det) det.addEventListener('toggle', () => {
        boite.depOuvert = det.open ? p.j : null;
        const cible = det.querySelector('.hub-dep-calc');
        if (det.open && cible && !cible.innerHTML.trim()) {
          cible.innerHTML = '<div class="hub-dep-attente">Le moteur rejoue le match…</div>';
          setTimeout(() => { if (cible.isConnected) { cible.innerHTML = depistageMatchHtml(p); brancherConseils(cible); } }, 30);
        }
      });
      const prep = carte.querySelector('.hub-preparer');
      if (prep) prep.onclick = () => ouvrirLignes({
        titre: 'Préparer le match', sousTitre: `Journée ${p.j + 1} · ${domicile ? 'contre' : 'chez'} ${ctx.teamShort(adv)}`,
        lineup: you.roster, lignes: lignesToi, chimie: etat.chimie, energie: etat.energie, apprentissage: etat.apprentissage,
        // Un gros match (J1-N) : les indices « tu étouffes » lisent leurs lignes SOUS LE PLAN LE PLUS
        // PROBABLE du dépistage (le vrai reste caché), sur l'alignement qui jouera (blessés retirés).
        adv: { nom: ctx.teamShort(adv), lignes: lignesDeGros(adv, activeLineup(adv), mb ? planProbable(mb.depistage) : null), selonDepistage: !!mb },
        depistage: mb ? mb.depistage : null,
        effets: { ...effetsEnCours(you, p.j), cartes: decs.filter(d => d.carte && d.jour <= p.j).map(d => d.carte) },
        // « Normale » par défaut, même un gros match (J1-O) : « Haute » a un prix (blessures, énergie) et se choisit.
        match: (matchPris && matchPris.match) || { importance: 'normale', ad: 0 },
        grosMatch: !!mb,
        totaux: (match, lignes) => motsDesTotaux(totauxDuMatch(p.j, { match, lignes })),
        // DEVANT LE FILET CE SOIR (1.0, C4) : la rotation du matin, et ton choix s'il y en a un.
        filet: etat.filet ? { ...etat.filet, choix: (decs.find(d => d.jour === p.j && d.filet) || {}).filet || 'auto' } : null,
        motAppliquer: 'Appliquer — la saison reprend ici',
        onBanc: onBanc ? () => { quitter(); onBanc(jour); } : null,
        onAppliquer: (lignes, match, filet) => { const j = jour; quitter(); onDecision({ jour: p.j, lignes, match, ...(filet ? { filet } : {}) }, j); },
      });
    } else {
      carte.innerHTML = `<div class="hub-match"><div class="hub-match-titre">Congé</div><div class="hub-match-note">Les NHL Stars ne jouent plus d'ici la fin de la saison.</div></div>`;
    }
    /*
     * LA BOÎTE DE RÉCEPTION (S78). JP, sur sa capture du hub : *t'as plusieurs
     * call to action, y'avait aussi un ballottage, c'est beaucoup pour un
     * écran, le joueur va en oublier … faire une boîte de réception et forcer
     * que le joueur agisse avant de continuer*. Tout ce qui arrivait en
     * bandeaux empilés — la blessure et son ballottage, la case vide, le
     * palier, les choix forcés, le vestiaire, la carte qui change — arrive
     * maintenant en MESSAGES, d'un expéditeur (le médecin, le DG, le proprio,
     * l'entraîneur, le dépisteur). Ceux qui demandent une décision BLOQUENT la
     * suite : « Journée suivante » cède sa place à « règle d'abord », « +10 »
     * disparaît, « Fin de saison » attend. Les autres se lisent et s'archivent.
     */
    rendreActions(messagesCourants(), p);
  }

  const DE = {
    medecin: { ico: '🩺', nom: 'Le médecin' },
    dg: { ico: '📋', nom: 'Le DG' },
    proprio: { ico: '🏢', nom: 'Le proprio' },
    coach: { ico: '🧑‍🏫', nom: 'L\'entraîneur' },
    depisteur: { ico: '🔎', nom: 'Le dépisteur' },
  };

  /*
   * LES CHOIX FORCÉS (S66), un à la fois et dans cet ordre : la récompense
   * d'une victoire, le verdict du proprio (il clôt ce qui était promis), le
   * nouvel objectif, la séquence, le dilemme, l'avant-match puis la main.
   * EN PLEIN ÉCRAN depuis S68 : chaque option dit en chiffres ce qu'elle
   * achète, ce qu'elle coûte et pendant combien de matchs. Depuis S78, chacun
   * est aussi un message de la boîte, qui bloque tant qu'on n'a pas choisi.
   */
  function choixForce() {
    // LA RÉCOMPENSE D'ABORD (QA S74b) : elle suit la victoire qu'on vient de voir.
    const rc = recompenseOuverte();
    const vo = rc ? null : verdictObjectif(), oo = rc || vo ? null : offreObjectif();
    const sq = rc || vo || oo ? null : sequenceOuverte();
    const dl = rc || vo || oo || sq ? null : dilemmeOuvert();
    const av = vo || oo || sq || dl || rc ? null : avantOuvert();
    const mo = vo || oo || sq || dl || av || rc ? null : mainOuverte();
    // Chaque choix est une décision : elle entre dans la liste, et la saison
    // se rejoue depuis aujourd'hui, avec des dés neufs.
    const decider = d => { quitter(); onDecision({ jour, ...d }, jour); };
    if (vo) {
      const o = OBJECTIFS[vo.d.objectif.cle];
      return vo.e.reussi
        ? { de: DE.proprio, ico: '🏢', titre: `Objectif atteint : ${o.court}`,
          recit: `Le proprio est ravi (${o.ico} ${vo.e.val} ${o.unite}). Il t'offre de quoi renforcer le club : pige une carte. Elle vaut pour le reste de la saison.`,
          options: mainDeCartes(graine, 2000 + vo.j0, dejaPrises).map(cle => ({ cle, ico: CARTES[cle].ico, nom: CARTES[cle].nom, bon: CARTES[cle].bon, prix: CARTES[cle].prix, effet: CARTES[cle] })),
          onChoix: cle => decider({ palier: `v:${vo.j0}`, carte: cle }) }
        : { de: DE.proprio, ico: '🏢', titre: `Objectif raté : ${o.court}`,
          recit: `${o.ico} ${vo.e.val} ${o.unite}, pour ${o.cible} promis. Le proprio te fait venir dans son bureau.`,
          options: [{ cle: 'encaisser', nom: 'Encaisser', prix: 'Le proprio coupe les vols nolisés : les voyages fatiguent', energie: OBJECTIF_RATE.energie, duree: OBJECTIF_RATE.duree }],
          onChoix: () => decider({ palier: `v:${vo.j0}`, effet: { ...OBJECTIF_RATE } }) };
    }
    if (oo) {
      /*
       * CE QUE LE MOTEUR EN PENSE (S78). JP : *donner vague idée de si c'est
       * possible*. Le mot (probable, jouable, coriace, très dur) vient de tes
       * vingt prochains matchs rejoués trente fois ; la raison, de tes vrais
       * chiffres. La carte gagnée et la vis serrée sont les mêmes pour les
       * trois : elles se disent une fois, en tête, pas trois.
       */
      const ch = chancesObjectifs(oo.j0, oo.offerts);
      return { de: DE.proprio, ico: '🏢', titre: oo.j0 ? 'Le proprio veut une deuxième moitié' : 'Le proprio fixe ses attentes',
        recit: `Choisis un défi pour tes ${MATCHS_OBJECTIF} prochains matchs. Ton adjoint a rejoué ces vingt matchs contre tes vrais adversaires : voici ce que ça donne.`,
        options: oo.offerts.map(cle => {
          const x = ch[cle], m = Number.isFinite(x) ? motDeChance(x) : null;
          return { cle, ico: OBJECTIFS[cle].ico, nom: OBJECTIFS[cle].nom, sous: raisonObjectif(cle),
            mots: m ? [{ txt: `${m.mot} · environ ${Math.max(1, Math.round(x * 10))} chance${Math.round(x * 10) > 1 ? 's' : ''} sur 10`, bon: x >= 0.7 ? true : x < 0.45 ? false : undefined }] : [] };
        }),
        contexte: `<div class="choix-puces"><span class="puce bon">Réussi : 🃏 une carte</span><span class="puce prix">Raté : les voyages fatiguent ↑ · ${OBJECTIF_RATE.duree} matchs</span></div>`,
        onChoix: cle => decider({ palier: `o:${oo.j0}`, objectif: { cle, debut: jour } }) };
    }
    if (sq) {
      const s = SEQUENCES[sq.cle];
      const EN_LETTRES = ['', '', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix'];
      const titre = sq.n > s.seuil ? `${EN_LETTRES[sq.n] || sq.n} ${sq.cle === 'defaites' ? 'défaites' : 'victoires'} de suite` : s.titre;
      return { de: DE.coach, ico: s.ico, titre, recit: s.recit,
        options: s.options.map(o => ({ ...o, duree: dureeOption(o, 'sequence') })),
        onChoix: cle => decider({ palier: sq.palier, moment: { famille: 'sequence', cle: sq.cle, choix: cle } }) };
    }
    if (dl) {
      const m = MOMENTS[dl.cle];
      // Ce qui est vraiment arrivé (S80) : le joueur en cause et les vrais chiffres.
      const f = dl.faits || {};
      // LE JOUEUR VISÉ est nommé avant le choix : c'est lui dont la carte change.
      const optMut = m.options.find(o => o.mutation);
      const cible = optMut ? (f.joueur || cibleMutation(you, optMut.mutation)) : null;
      // LES JOUEURS QU'UN GESTE TOUCHE (S72) : nommés avant le choix — celui des faits d'abord.
      const cibles = m.cible ? (f.joueur ? [f.joueur] : ciblesDe(you, m.cible, graine, dl.J)) : [];
      const recit = String(m.recit).replace(/\{n\}/g, f.n ?? '').replace(/\{m\}/g, f.m ?? '').replace(/\{vieux\}/g, f.vieux || 'Ton vieux défenseur');
      return { de: DE.coach, ico: m.ico, titre: m.titre, irl: m.irl, recit, joueur: cible || f.joueur || null, joueurs: cibles, ouDe: ctx.ouJoue,
        options: m.options.map(o => ({ ...o, duree: o.mutation || o.rien ? null : dureeOption(o, 'moment'),
          desactive: (o.mutation && !cible) || (m.cible && !cibles.length && o.action) ? 'Personne dans ton alignement pour ça' : null })),
        onChoix: cle => decider({ palier: `m:${dl.J}`, moment: { famille: 'moment', cle: dl.cle, choix: cle, joueur: cible ? getPlayerKey(cible) : null, joueurs: cibles.map(getPlayerKey) } }) };
    }
    if (av) {
      // L'AVANT-MATCH (S70) : daté du soir du match, pas d'aujourd'hui.
      const A = AVANT_GROS[av.cle], advG = av.mb.adv;
      const ciblesA = A.cible ? ciblesDe(you, A.cible, graine, av.p.j) : [];
      // Il arrive à l'annonce, quelques jours avant (S80) : le récit dit quand est le match.
      const dans = av.p.j - jour;
      const quand = dans <= 0 ? 'Ce soir' : dans === 1 ? 'Demain' : `Dans ${dans} jours`;
      return { de: DE.depisteur, ico: A.ico, titre: A.titre, irl: A.irl, joueurs: ciblesA, ouDe: ctx.ouJoue,
        recit: `${quand}, le gros match contre ${ctx.teamLabel(advG)}. ${A.recit}`,
        contexte: depistageHtml(pistesDuRapport(av.mb.depistage), { nomAdv: ctx.teamShort(advG) }),
        options: A.options.map(o => ({ ...o, duree: 1 })),
        onChoix: cle => { const j = jour; quitter(); onDecision({ jour: av.p.j, avant: { cle: av.cle, choix: cle, joueurs: ciblesA.map(getPlayerKey) } }, j); } };
    }
    if (rc) {
      // LA RÉCOMPENSE D'UNE VICTOIRE (S74) : une carte parmi trois, ou passer.
      return { de: DE.dg, ico: '🎁', titre: 'Récompense', cartes: true, genre: 'recompense', fermable: true, motFermer: 'Passer',
        recit: `Victoire dans le gros match contre ${ctx.teamLabel(rc.adv)} ! Touche une carte pour l'ajouter à ton deck — ou passe : un deck mince pige plus souvent ses meilleures cartes.`,
        options: recompensesOffertes(graine, `r${rc.jour}`).map(optionDeCarteMatch),
        onChoix: k => { const j = jour, s = soirDuProchain(); quitter(); onDecision({ jour: s, palier: `r:${rc.jour}`, recompense: k }, j); },
        onFerme: () => { const j = jour, s = soirDuProchain(); quitter(); onDecision({ jour: s, palier: `r:${rc.jour}`, recompense: null }, j); } };
    }
    if (mo) return { de: DE.depisteur, ico: '🃏', titre: 'Ta main pour le gros match', recit: 'Cinq cartes, trois d\'élan, pour ce match seulement — et le dépistage de leurs pistes.', ouvrir: () => ouvrirMainGros(mo) };
    return null;
  }
  const titreDuChoix = spec => String(spec.titre).replace(/\{nom\}/g, spec.joueur ? spec.joueur.n : (spec.joueurs && spec.joueurs[0] ? spec.joueurs[0].n : ''));

  /*
   * LES MESSAGES DU JOUR. Tout se DÉDUIT de l'état de la saison — rien n'est
   * posé nulle part : un message existe tant que sa cause existe (le palier
   * ouvert, la blessure qui court, le choix qui attend). Seuls « lu »,
   * « archivé » et « réglé sans décision » se retiennent (`boite`).
   */
  function messagesCourants() {
    const out = [];
    const spec = onDecision ? choixForce() : null;
    if (spec) {
      out.push({ id: `c:${spec.titre}`, genre: 'choix', bloque: true, de: spec.de, sujet: titreDuChoix(spec), spec,
        corps: `<div class="hub-msg-mot">${ctx.esc(String(spec.recit || '').replace(/\{nom\}/g, spec.joueur ? spec.joueur.n : 'ton joueur').replace(/\{noms\}/g, (spec.joueurs || []).map(x => x.n).join(', ') || 'tes joueurs'))}</div>
          <button type="button" class="btn gold hub-choix-rouvrir" data-defaut>Ouvrir : ${ctx.esc(titreDuChoix(spec))}</button>` });
    }
    /*
     * LA CASE VIDE : la carte est déjà tirée — on ne choisit pas — et le
     * bouton ne fait que l'encaisser, parce qu'une décision doit être VUE
     * avant d'être écrite. `.hub-tiree` et non `.hub-pige` : une carte qu'on
     * ne choisit pas n'est pas une pige (voir S54 et `smoke.mjs`).
     */
    /*
     * UN PACK OUVERT, PERSONNE DE SIGNÉ (1.0, J1-B) : l'achat est enregistré
     * (`k:n`), la signature manque (`k:n:signe`) — la page a été rechargée en
     * plein choix. Le même tirage se rouvre ; rien n'est retiré ni repayé.
     */
    const packOuvert = onDecision && ctx.boutique && ctx.boutique.rouvrir
      ? decs.find(d => d && d.achat && d.achat.sorte === 'joueurs' && typeof d.palier === 'string' && /^k:\d+$/.test(d.palier) && !pris.has(`${d.palier}:signe`)) || null
      : null;
    if (packOuvert) {
      out.push({ id: packOuvert.palier, genre: 'pack', bloque: true, de: DE.dg, sujet: 'Un pack ouvert : signe un joueur, ou passe', achat: packOuvert.achat,
        corps: `<div class="hub-msg-mot">Ton pack est payé et ses cartes sont au classeur. Il reste à signer un des joueurs — ou à ne signer personne.</div>
          <button type="button" class="btn gold hub-pack-rouvrir" data-defaut>Ouvrir le pack</button>` });
    }
    const cTrou = trou ? carteDuTrou(trou) : null;
    if (trou && cTrou && onTrou) {
      out.push({ id: `t:${trou.at}`, genre: 'trou', bloque: true, de: DE.dg, sujet: nomsDesCases(trou.cases),
        corps: `<div class="hub-trou" role="status">
          <div class="hub-trou-tete">🕳️ ${ctx.esc(nomsDesCases(trou.cases))}</div>
          <div class="hub-trou-note">Aucun réserviste ne pouvait prendre la place. Le vestiaire s'ajuste comme il peut — tu ne choisis pas celle-là.</div>
          <div class="hub-tiree">
            <span class="hub-tiree-nom">${CARTES[cTrou].ico} ${ctx.esc(CARTES[cTrou].nom)}</span>
            <span class="hub-tiree-bon">+ ${ctx.esc(CARTES[cTrou].bon)}</span>
            <span class="hub-tiree-prix">− ${ctx.esc(CARTES[cTrou].prix)}</span>
          </div>
          <button class="btn gold hub-trou-prendre" data-trou="${trou.at}" data-defaut>Compris</button>
        </div>` });
    }
    // LE PALIER : une main de trois cartes, une à garder. Elle se joue en plein
    // écran (S73) ; le message en montre le dos et de quoi l'ouvrir.
    const pal = palierOuvert();
    if (pal !== undefined) {
      out.push({ id: `p:${pal}`, genre: 'palier', bloque: !!onDecision, de: DE.dg, sujet: `La main de la journée ${pal} : trois cartes`, pal,
        corps: `<div class="hub-cartes hub-main" role="group" aria-label="Une main de trois cartes">
          <div class="hub-dos-rang">${mainDuDeck(graine, pal, dejaPrises).map(c => `<span class="hub-dos tc-${RARETE_SORTE[c.sorte]}" data-sorte="${c.sorte}" title="${ctx.esc(SORTES_DECK[c.sorte].nom)}">${SORTES_DECK[c.sorte].ico}</span>`).join('')}</div>
          <button type="button" class="btn gold hub-main-ouvrir" data-defaut>Voir les cartes</button>
          <div class="hub-cartes-note">Tu en gardes une pour le reste de la saison. La journée suivante attend ton choix.</div>
        </div>` });
    }
    /*
     * LA BLESSURE ET SON BALLOTTAGE, en un seul message (JP : *y'avait aussi
     * un ballottage, c'est beaucoup pour un écran*). Trois réponses, et il en
     * faut une : réclamer quelqu'un au ballottage, remanier derrière le banc,
     * ou garder l'alignement — le réserviste monte, c'est un choix aussi.
     */
    if (alerte) {
      const idB = `b:${alerte.at}:${getPlayerKey(alerte.player)}`;
      const palierB = idB;
      const bal = onDecision && ctx.ballottage && !pris.has(palierB) ? ctx.ballottage(alerte.player, alerte.at) : null;
      const n = restantDe(alerte);
      out.push({ id: idB, genre: 'blessure', bloque: !!onDecision && !boite.traites.has(idB), de: DE.medecin, sujet: `${alerte.player.n} est blessé : ${n} match${n > 1 ? 's' : ''}`, bal, palierB,
        corps: `<div class="hub-alerte" role="status">
          <div class="hub-alerte-tete">🚑 ${ctx.esc(alerte.player.n)} est blessé</div>
          <div class="hub-alerte-note">${n} match${n > 1 ? 's' : ''} d'absence${n < alerte.games ? ` (${alerte.games} en tout)` : ''}${caseDe(alerte.player) ? ` · ${ctx.esc(caseDe(alerte.player))}` : ''} · ${ctx.esc(remplacant(alerte.player))}</div>
          <div class="hub-alerte-choix">
            ${bal && bal.candidats.length ? `<button type="button" class="btn hub-ballottage-ouvrir">📋 Au ballottage : ${bal.candidats.length} joueurs</button>` : ''}
            ${onBanc ? '<button class="btn gold hub-alerte-banc">Derrière le banc</button>' : ''}
            ${onDecision && !boite.traites.has(idB) ? '<button type="button" class="btn hub-alerte-garder" data-defaut>Garder mon alignement</button>' : ''}
          </div>
        </div>` });
    }
    // LA CARTE QUI CHANGE (S68) : rien à cliquer, la réponse est l'alignement.
    if (accident && MUTATIONS[accident.cle]) {
      out.push({ id: `a:${accident.jour}:${getPlayerKey(accident.p)}`, genre: 'accident', de: DE.coach, sujet: `Sa carte change : ${accident.p.n}`,
        corps: `<div class="hub-situ hub-accident" role="status">
          <div class="hub-situ-tete">${MUTATIONS[accident.cle].ico} Sa carte change : ${ctx.esc(accident.p.n)}</div>
          <div class="hub-situ-quoi">${ctx.esc(MUTATIONS[accident.cle].nom)} — ${ctx.esc(MUTATIONS[accident.cle].quoi)}</div>
          <div class="choix-puces">${puces(motsDeMutation(accident.cle))}</div>
        </div>` });
    }
    // LES SITUATIONS : deux hommes nommés, le porté d'abord — c'est lui qui appelle une décision.
    if (situation) {
      out.push({ id: `s:${situation.jour}`, genre: 'situation', de: DE.coach, sujet: `Dans le vestiaire : ${situation.porte.p.n} et ${situation.pese.p.n}`,
        corps: `<div class="hub-situ" role="status">
          <div class="hub-situ-tete">Dans le vestiaire</div>
          <div class="hub-situ-rang">${[['porte', situation.porte], ['pese', situation.pese]].map(([sens, b]) => {
            const c = SITUATIONS[b.cle];
            return `<div class="hub-situ-bout hub-situ-${sens}">
              <span class="hub-situ-nom">${c.ico} ${ctx.esc(b.p.n)}</span>
              <span class="hub-situ-quoi">${ctx.esc(c.nom)} — ${ctx.esc(c.quoi.toLowerCase())}</span>
              <span class="hub-situ-mot">${ctx.esc(c.mot)}</span>
            </div>`;
          }).join('')}</div>
          ${onBanc ? '<button class="btn hub-situ-banc">Revoir mon alignement</button>' : ''}
        </div>` });
    }
    // QUI A CHANGÉ DE PLACE à la dernière avance (JP : *je dois le voir*).
    if (dernierAvance && miens.length > dernierAvance.joues0) {
      const mv = mouvements(dernierAvance.joues0, miens.length);
      if (mv.length) out.push({ id: `mv:${miens.length}:${mv.length}`, genre: 'mouvements', de: DE.coach,
        sujet: mv.length === 1 ? mv[0].txt : `${mv.length} changements dans ton alignement`,
        corps: `<div class="hub-mouvements">${mv.map(x => `<div class="hub-mv">🔁 <span class="hub-mv-j">J${x.j + 1}</span> ${ctx.esc(x.txt)}</div>`).join('')}
          <div class="hub-msg-note">Le moteur monte le premier réserviste qui peut jouer la case. ${onBanc ? 'Tu peux tout remanier derrière le banc (onglet Alignement).' : ''}</div></div>` });
    }
    // LE RAPPORT DU DÉPISTEUR, tous les dix matchs, jusqu'au suivant.
    const nRap = Math.floor(miens.length / RAPPORT_CHAQUE) * RAPPORT_CHAQUE;
    if (nRap >= RAPPORT_CHAQUE) {
      out.push({ id: `r:${nRap}`, genre: 'rapport', de: DE.depisteur, sujet: `Rapport après ${nRap} matchs : forces et faiblesses`,
        corps: `${rapportHtml()}${onBanc ? '<button class="btn hub-rap-banc">Revoir mes lignes</button>' : ''}` });
    }
    return out.filter(m => m.bloque || !boite.archives.has(m.id));
  }

  /* La boîte et les boutons qui font avancer le temps. */
  function rendreActions(msgs, p) {
    const bloquants = msgs.filter(m => m.bloque);
    const premier = bloquants[0] || null;
    // Un choix forcé s'ouvre de lui-même, comme avant — sauf derrière un sommaire (il attend qu'on le ferme).
    const spec = (msgs.find(m => m.genre === 'choix') || {}).spec || null;
    const pal = (msgs.find(m => m.genre === 'palier') || {}).pal;
    if (!retenir) {
      if (spec && !choixOuvert()) { if (spec.ouvrir) spec.ouvrir(); else ouvrirChoix(spec); }
      else if (!spec && pal !== undefined && !palProposes.has(pal) && !choixOuvert()) { palProposes.add(pal); ouvrirMain(pal); }
    }
    // LE MESSAGE OUVERT : celui qu'on a touché, sinon le premier à traiter. Les autres, pliés.
    const ouvert = boite.ouvert && msgs.some(m => m.id === boite.ouvert) ? boite.ouvert
      : boite.ouvert === false ? null : (premier ? premier.id : null);
    for (const m of msgs) if (m.id === ouvert && !m.bloque) boite.lus.add(m.id);
    const nonLus = msgs.filter(m => !m.bloque && !boite.lus.has(m.id)).length;
    const compteur = [bloquants.length ? `<b class="a-traiter">${bloquants.length} à traiter</b>` : '', nonLus ? `<b class="non-lus">${nonLus} non lu${nonLus > 1 ? 's' : ''}</b>` : ''].filter(Boolean).join('') || '<span class="a-jour">À jour</span>';
    // Vide, elle ne prend pas de place (S79) : « À jour » était une rangée pour rien.
    const boiteHtml = !msgs.length ? '' : `<section class="hub-boite" aria-label="Boîte de réception">
      <div class="hub-boite-tete"><span class="hub-boite-titre">📥 Boîte de réception</span><span class="hub-boite-compte">${compteur}</span></div>
      ${msgs.length ? `<div class="hub-msgs">${msgs.map(m => {
        const o = m.id === ouvert, lu = boite.lus.has(m.id);
        return `<article class="hub-msg${o ? ' ouvert' : ''}${m.bloque ? ' bloque' : ''}${!m.bloque && !lu ? ' non-lu' : ''}" data-msg="${m.genre}" data-id="${ctx.esc(m.id)}">
          <button type="button" class="hub-msg-tete" aria-expanded="${o}">
            <span class="hub-msg-ico" aria-hidden="true">${m.de.ico}</span>
            <span class="hub-msg-txt"><span class="hub-msg-de">${ctx.esc(m.de.nom)}</span><span class="hub-msg-sujet">${ctx.esc(m.sujet)}</span></span>
            <span class="hub-msg-etat">${m.bloque ? 'À traiter' : lu ? '' : 'Nouveau'}</span>
          </button>
          <div class="hub-msg-corps">${m.corps}${m.bloque ? '' : '<button type="button" class="btn hub-msg-archiver">Archiver</button>'}</div>
        </article>`;
      }).join('')}</div>` : ''}
    </section>`;
    // UNE SEULE ACTION EN TÊTE : la journée suivante, ou ce qui la retient.
    const primaire = premier
      ? `<button type="button" class="btn hub-traiter" title="La journée suivante attend tes réponses">⏳ À régler avant le match${bloquants.length > 1 ? ` (${bloquants.length})` : ''} : ${ctx.esc(premier.sujet)}</button>`
      : '<button class="btn go hub-jour" title="Une journée de plus : tous les résultats, le classement du jour">Journée suivante</button>';
    // « Le banc » a quitté la rangée : l'onglet Alignement de la barre fait la même chose (JP : jamais deux fois la même chose).
    actions.innerHTML = `${primaire}
      <div class="hub-actions-rang">
      ${p && !premier ? '<button class="btn gold hub-regarder" title="Le prochain match de ta formation, lancer par lancer">Regarder</button>' : ''}
      ${premier ? '' : '<button class="btn hub-prochaine" title="Jouer les journées une à une, jusqu\'à la première qui demande une décision">Jusqu\'à la prochaine décision</button>'}
      </div>
      ${boiteHtml}`;
    // TES CARTES ET LA BOUTIQUE, DANS L'EN-TÊTE (S79) : toujours en vue, sans prendre une rangée de boutons.
    if (ui.outils) ui.outils.innerHTML = [
      onDecision && ctx.inventaire ? (n => `<button type="button" class="hub-outil hub-inventaire" title="Mes cartes : celles qui se gardent jusqu'au moment voulu, le personnel, le deck, le classeur" aria-label="Mes cartes${n ? ` : ${n} à jouer` : ''}">🎒<span class="hub-outil-mot">Cartes</span>${n ? `<b class="hub-inv-n">${n}</b>` : ''}</button>`)(ctx.inventaire.compte(jour)) : '',
      onDecision && ctx.boutique ? (n => `<button type="button" class="hub-outil hub-boutique" title="La boutique : des packs de joueurs et de cartes" aria-label="La boutique : ${n} jetons">🛒<b>${n}</b>🪙</button>`)(ctx.boutique.jetons(jour)) : '',
    ].join('');

    const redessinerBoite = () => rendreActions(messagesCourants(), p);
    // Plier et déplier un message ; le lire, c'est l'ouvrir.
    actions.querySelectorAll('.hub-msg-tete').forEach(b => {
      b.onclick = () => {
        const id = b.closest('.hub-msg').dataset.id;
        boite.ouvert = ouvert === id ? false : id;
        redessinerBoite();
      };
    });
    actions.querySelectorAll('.hub-msg-archiver').forEach(b => {
      b.onclick = () => { const id = b.closest('.hub-msg').dataset.id; boite.archives.add(id); boite.lus.add(id); boite.ouvert = null; redessinerBoite(); };
    });
    const traiter = actions.querySelector('.hub-traiter');
    if (traiter) traiter.onclick = () => {
      if (premier.genre === 'choix') { (premier.spec.ouvrir ? premier.spec.ouvrir() : ouvrirChoix(premier.spec)); return; }
      if (premier.genre === 'palier') { ouvrirMain(premier.pal); return; }
      boite.ouvert = premier.id;
      redessinerBoite();
      const el = actions.querySelector(`.hub-msg[data-id="${CSS.escape(premier.id)}"]`);
      if (el) { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); const d = el.querySelector('[data-defaut]'); if (d) d.focus({ preventScroll: true }); }
    };
    // LA BOUTIQUE (Rogue, S77) : ses décisions passent par le même chemin que les autres choix.
    const boutique = ui.outils && ui.outils.querySelector('.hub-boutique');
    if (boutique) boutique.onclick = () => ctx.boutique.ouvrir(jour, d => { const j = jour; quitter(); onDecision(d, j); });
    const sac = ui.outils && ui.outils.querySelector('.hub-inventaire');
    if (sac) sac.onclick = () => ctx.inventaire.ouvrir(jour, d => { const j = jour; quitter(); onDecision(d, j); });
    const rouvrir = actions.querySelector('.hub-choix-rouvrir');
    if (rouvrir && spec) rouvrir.onclick = () => (spec.ouvrir ? spec.ouvrir() : ouvrirChoix(spec));
    const mPack = msgs.find(m => m.genre === 'pack');
    const rouvrirPack = actions.querySelector('.hub-pack-rouvrir');
    if (rouvrirPack && mPack) rouvrirPack.onclick = () => ctx.boutique.rouvrir(mPack.achat, jour, d => { const j = jour; quitter(); onDecision(d, j); });
    // LE BALLOTTAGE, en plein écran : trois joueurs en CARTES (S76), ou garder son réserviste.
    const mB = msgs.find(m => m.genre === 'blessure');
    const voirBal = actions.querySelector('.hub-ballottage-ouvrir');
    const ouvrirBallottage = () => ouvrirChoix({
      ico: '📋', titre: 'Au ballottage', cartes: true, genre: 'ballottage', fermable: true, motFermer: 'Garder mon alignement',
      recit: `${alerte.player.n}${ctx.ouJoue && ctx.ouJoue(alerte.player) ? ` (${ctx.ouJoue(alerte.player)})` : ''} est absent ${restantDe(alerte)} match${restantDe(alerte) > 1 ? 's' : ''}. Trois réguliers de la ligue, sous 3 % du plafond : un dépanneur, pas une vedette. Touche une carte pour sa fiche, « Signer » pour le réclamer${mB.bal.cout ? ` (${mB.bal.cout} 🪙)` : ''} — puis tu choisis qui lui laisse sa place. Le plafond compte toujours.`,
      options: mB.bal.candidats.map(c => ({ cle: c.cle, rarete: c.rarete || 'commune', nom: c.nom, type: `${c.poste || c.pos} · ${c.club}`, coin: c.salaire,
        art: c.p ? joueurArt(c.p) : '', carteJoueur: c.p && ctx.carteMini ? ctx.carteMini(c.p) : '', texte: c.ligne, apercu: c.p && ctx.apercu ? () => ctx.apercu(c.p) : null })),
      onChoix: cle => {
        const c = mB.bal.candidats.find(x => x.cle === cle);
        const decide = ({ i, sort }) => { boite.traites.add(mB.id); quitter(); onDecision({ jour, palier: mB.palierB, ballottage: { i, entre: cle, sort, ...(mB.bal.cout ? { cout: mB.bal.cout } : {}) } }, jour); };
        if (c && c.p && ctx.quiSort) ctx.quiSort(c.p, { roster: you.roster, genre: 'ballottage', onChoix: decide, onFerme: ouvrirBallottage });
        else decide({ i: mB.bal.i, sort: mB.bal.sort });
      },
    });
    if (voirBal && mB && mB.bal) voirBal.onclick = ouvrirBallottage;
    const garder = actions.querySelector('.hub-alerte-garder');
    if (garder && mB) garder.onclick = () => { boite.traites.add(mB.id); boite.ouvert = null; dessiner(); };
    const alBanc = actions.querySelector('.hub-alerte-banc');
    if (alBanc) alBanc.onclick = () => { if (mB) boite.traites.add(mB.id); quitter(); onBanc(jour); };
    for (const sel of ['.hub-situ-banc', '.hub-rap-banc']) {
      const b = actions.querySelector(sel);
      if (b) b.onclick = () => { quitter(); onBanc(jour); };
    }
    const regarder = actions.querySelector('.hub-regarder');
    if (regarder) regarder.onclick = () => regarderProchain();
    const prendre = actions.querySelector('.hub-trou-prendre');
    if (prendre) prendre.onclick = () => { const t = trou, j = jour; quitter(); onTrou(t.at, j, carteDuTrou(t)); };
    // Le palier ET la journée courante : la carte vaut à partir de MAINTENANT.
    const voirMain = actions.querySelector('.hub-main-ouvrir');
    if (voirMain && pal !== undefined) voirMain.onclick = () => ouvrirMain(pal);
    boutonFlottant(actions, termine);
    const bj = actions.querySelector('.hub-jour'), bp = actions.querySelector('.hub-prochaine');
    if (bj) bj.onclick = () => avancerPuisResumer(1);
    if (bp) bp.onclick = () => { avancerJusquaDecision(); };
  }

  /*
   * LE DEUXIÈME ENTRACTE (S70), en plein écran : le pointage après deux
   * périodes, les buts, l'incident de la soirée, leur plan, et quatre choix
   * pour la troisième. Choisir rejoue la saison depuis ce soir : les deux
   * premières périodes ne bougent pas, la troisième se joue sur des dés neufs.
   */
  function ouvrirEntracte(direct = false) {
    const p = prochain();
    if (!p || termine || !entracteAttendu(p.j)) return;
    // Le gros match se joue jusqu'au bout pour montrer ses deux premières périodes ;
    // le choix de l'entracte le rejouera depuis 40:00 (`continuerSaison`, js/game.js).
    while (jour < p.j) appliquerJour(jour++);
    if (ligue) jouerJusqua(ligue, p.j + 1);
    const mb = grosDuJour(p.j), f = p.m.feuille, e = f && f.entracte;
    if (!e) return;
    const moiA = p.m.A === you, cMoi = moiA ? 'A' : 'B', cLui = moiA ? 'B' : 'A';
    const moi = moiA ? e.gfA : e.gfB, lui = moiA ? e.gfB : e.gfA;
    const etat = moi > lui ? 'devant' : moi < lui ? 'derriere' : 'egal';
    const off = entractesOfferts(graine, p.j, etat);
    const INC = INCIDENTS[off.incident];
    const adv = mb.adv;
    const tirs = c => ((f.tirs[c] || [])[1] || 0) + ((f.tirs[c] || [])[2] || 0);
    const buts = f.buts.filter(b => b.instant < 40)
      .map(b => `<span class="ent2-but ${b.cote === cMoi ? 'moi' : 'lui'}">${instantMot(b.instant)} · ${ctx.esc(b.marqueur ? b.marqueur.n : '')}</span>`).join('');
    const contexte = `<div class="ent2">
      <div class="ent2-score"><span>${ctx.logo(you.tag, 22)} ${ctx.esc(ctx.teamShort(you))} <b>${moi}</b></span><span class="ent2-sep">–</span><span><b>${lui}</b> ${ctx.esc(ctx.teamShort(adv))} ${ctx.logo(adv.tag, 22)}</span></div>
      <div class="ent2-note">Après deux périodes · tirs ${tirs(cMoi)}–${tirs(cLui)}</div>
      ${buts ? `<div class="ent2-buts">${buts}</div>` : ''}
      <div class="ent2-incident">${INC.ico} ${ctx.esc(INC.titre)}.</div>
      ${planAdverseHtml(mb.plan, mb.contre, { nomAdv: ctx.teamShort(adv), prepJuste: mb.prepJuste ?? null })}
    </div>`;
    ouvrirChoix({
      ico: '🎬', titre: `Deuxième entracte · ${moi}–${lui}`, genre: 'entracte',
      recit: etat === 'devant' ? 'Tu mènes. Vingt minutes à tenir.' : etat === 'derriere' ? 'Tu tires de l\'arrière. Vingt minutes pour renverser ça.' : 'C\'est égal. Vingt minutes pour faire la différence.',
      contexte,
      options: off.options.map(o => ({ ...o, quand: '3e période' })),
      onChoix: cle => {
        const o = off.options.find(x => x.cle === cle);
        suiteEntracte = { j: p.j, direct };
        const j = jour;
        quitter();
        onDecision({ jour: p.j, entracte: { cle, incident: o && o.incident ? o.incident : null } }, j);
      },
    });
  }

  /* REGARDER LE MATCH : le direct rejoue ta prochaine feuille, puis la journée
     est révélée entière, comme si on l'avait passée. Un gros match s'arrête
     au deuxième entracte (S70) ; `depuis` reprend à 40:00 après le choix. */
  function regarderProchain(depuis = 0) {
    const p = prochain();
    if (!p || termine) return;
    const attente = !depuis && entracteAttendu(p.j);
    // Les journées de congé d'ici là passent d'elles-mêmes.
    dernierAvance = { joues0: miens.length };
    while (jour < p.j) appliquerJour(jour++);
    // Le soir du direct se JOUE maintenant, pour être montré (S79) — pas avant.
    if (ligue) jouerJusqua(ligue, p.j + 1);
    const f = fiche.get(you);
    const apresA = { ...fiche.get(p.m.A) }, apresB = { ...fiche.get(p.m.B) };
    diffuserMatch({
      feuille: p.m.feuille, A: p.m.A, B: p.m.B,
      titre: 'Saison régulière', sousTitre: `Journée ${p.j + 1}`,
      etat: jour ? `${f.W}-${f.L}-${f.OTL} · ${rangDe(you)}${rangDe(you) === 1 ? 'er' : 'e'}` : 'Premier match de la saison',
      graine: (p.j + 1) * 100 + p.k, avant: compte, ctx,
      arret: attente ? 40 : null, onArret: attente ? () => { dessiner(); ouvrirEntracte(true); } : null, depuis,
      onTermine: () => { if (termine) return; avancer(1); dessiner(); tabs.suivre('journee'); },
    });
    void apresA; void apresB;
  }

  /* Quitter l'écran SANS finir la saison : le banc. Rien n'est révélé de plus. */
  const quitter = () => {
    if (termine) return;
    termine = true;
    cacherBoutonFlottant();
    debrancherMenu();
    retirerHub(tabs.hub);
    window.removeEventListener('keydown', clavier);
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };
  const fermer = () => {
    if (termine) return;
    quitter();
    onTermine();
  };
  // L'onglet « Alignement » de la barre ouvre le banc en pleine saison (S67).
  if (onBanc) tabs.hub.banc = () => { quitter(); onBanc(jour); };
  /*
   * ✕ NE SAUTE PLUS LA SAISON (S79). JP : *pas possible de sauter la saison*.
   * Il sautait au bilan après une question ; il n'apparaît plus qu'une fois la
   * saison jouée, pour passer au bilan (`dessiner` le montre ou le cache).
   */
  ui.close.onclick = () => { if (jour >= N) fermer(); };
  ui.close.setAttribute('aria-label', 'Passer au bilan de la saison');
  ui.close.title = 'Passer au bilan de la saison';
  // Entrée ou la barre d'espace : la journée suivante, sans viser le bouton.
  const clavier = ev => {
    if ((ev.key !== ' ' && ev.key !== 'Enter') || ev.target.closest('input, textarea, select, button, [role="button"], a')) return;
    if (document.getElementById('liveModal')?.style.display === 'flex') return;
    // UN CHOIX OUVERT (S74) passe devant : Espace ne révèle pas un match derrière la main.
    if (choixOuvert()) return;
    // L'écran ancré mais caché (on lit une autre page) n'avance pas le temps.
    if (document.body.classList.contains('hub-cache')) return;
    ev.preventDefault();
    const b = actions.querySelector('.hub-jour') || actions.querySelector('.hub-traiter') || actions.querySelector('.hub-suite');
    if (b) b.click();
  };
  window.addEventListener('keydown', clavier);

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  dessiner();
  tabs.montrer('journee');
  // LA TROISIÈME PÉRIODE (S70) : le choix de l'entracte vient d'être pris.
  if (suiteEntracte) {
    const se = suiteEntracte, p = prochain();
    suiteEntracte = null;
    if (p && p.j === se.j && !entracteAttendu(p.j)) {
      if (se.direct) regarderProchain(40);
      else avancerPuisResumer(1);
    }
  }
}

/* =====================================================================
   Les séries, match par match, ronde par ronde
   ===================================================================== */

/** `DAL mène 2-1`, `Égalité 1-1`, `DAL remporte la série 4-2`. */
function etatDeSerie(ctx, s, wA, wB) {
  const nA = ctx.teamShort(s.A), nB = ctx.teamShort(s.B);
  if (wA >= 4) return `${nA} remporte la série ${wA}-${wB}`;
  if (wB >= 4) return `${nB} remporte la série ${wB}-${wA}`;
  if (wA === wB) return `Égalité ${wA}-${wB}`;
  return wA > wB ? `${nA} mène ${wA}-${wB}` : `${nB} mène ${wB}-${wA}`;
}

/**
 * Ouvre l'écran des séries. Toutes les séries sont déjà jouées (`playSeries`,
 * G.series) ; l'écran les révèle un match à la fois, ronde après ronde, et
 * appelle `onTermine` quand on passe au tableau complet.
 *
 *   series   toutes les séries, avec `ronde`, `i`, `A`, `B`, `wA`, `wB`,
 *            `winner`, `feuilles`
 *   rondes   les noms des rondes
 *   you      ton équipe
 *   ctx      { esc, teamLabel, teamShort, tagCourt, logo, band, mug }
 *   depuis   l'état de révélation d'où repartir : { ronde, revele[] }, le
 *            nombre de matchs vus de chaque série, indexé par `s.i`
 *   onRevele appelé à chaque changement de cet état, pour la sauvegarde
 */
/*
 * LA RÉVÉLATION EST LE SEUL ÉTAT QUE LA REPRISE A BESOIN DE CONNAÎTRE, comme
 * la journée l'est pour la saison. Tout est déjà joué et le moteur est
 * déterministe : rejouer les séries depuis la même graine redonne les mêmes
 * feuilles, donc on ne sauve pas ce qui s'est passé, seulement jusqu'où le
 * joueur l'a regardé.
 */
/*
 * LES SÉRIES À L'ÉCRAN, JOUÉES AU MOMENT D'ÊTRE MONTRÉES (S79). `moteur` est
 * le moteur des séries (`creerSeries`, js/sim.js) : `series` est sa liste
 * VIVANTE (`S.toutes`) — une ronde y entre quand la précédente est décidée,
 * une feuille quand son match est joué. `jouerSerie(r, k)` joue ce qu'il faut
 * pour montrer le match k de la ronde r ; rien ne se joue avant.
 */
export function ouvrirSeries({ series, moteur = null, nRondes: nR = null, rondes, you, saison = null, ctx, onTermine, depuis = null, onRevele = null, graine = 0, decisions = [], onDecision = null, onBanc = null, decisionsSaison = [] }) {
  const ui = coquille('Les séries');
  if (!ui || !series.length) { onTermine(); return; }
  const { modal, head, carte, actions, barre, volet } = ui;
  const nRondes = nR || Math.max(...series.map(s => s.ronde)) + 1;
  const deRonde = r => series.filter(s => s.ronde === r).sort((a, b) => a.i - b.i);
  // Ce qui est révélé : le nombre de matchs qu'on a vus de chaque série.
  // Une reprise repart d'où elle s'était arrêtée ; `Math.min` borne un état
  // sauvegardé par une version qui jouait des séries plus longues.
  const vus = (depuis && depuis.revele) || [];
  const revele = new Map(series.map(s => [s, Math.min(Math.max(0, vus[s.i] || 0), s.feuilles.length)]));
  // Les séries qui naissent en cours de route (la ronde suivante) entrent à zéro match vu.
  const suivre = () => { for (const s of series) if (!revele.has(s)) revele.set(s, 0); };
  // Jouer ce qu'il faut pour MONTRER le match k de la ronde r — jamais plus.
  const jouerSerie = (r, k) => {
    if (!moteur) return;
    while (!moteur.fini && (moteur.ronde < r || (moteur.ronde === r && moteur.k <= k))) jouerMatchSeries(moteur);
    suivre();
  };
  // Une série est COMPLÈTE quand elle est décidée ET que tous ses matchs sont vus.
  const complete = s => !!s.winner && revele.get(s) >= s.feuilles.length;
  const gains = s => { let wA = 0, wB = 0; for (const f of s.feuilles.slice(0, revele.get(s))) { if (f.vainqueur === 'A') wA++; else wB++; } return { wA, wB }; };
  const rondeComplete = r => deRonde(r).every(complete);
  let ronde = Math.min(Math.max(0, (depuis && depuis.ronde) || 0), nRondes - 1), termine = false;
  const maSerie = r => deRonde(r).find(s => s.A === you || s.B === you) || null;
  const equipeDe = new Map();
  for (const s of series) for (const t of [s.A, s.B]) {
    for (const p of Object.values(t.roster || {})) if (p) equipeDe.set(p, t);
    if (t.rappelG) equipeDe.set(t.rappelG, t);
  }
  const feuillesRevelees = () => series.flatMap(s => s.feuilles.slice(0, revele.get(s)));
  const nomRonde = r => rondes[r] || `Ronde ${r + 1}`;
  const nomRondeCourt = r => nomRonde(r).replace('Finale de la Coupe Stanley', 'Finale');

  /* Un match de plus dans chaque série encore ouverte de la ronde. */
  const matchSuivant = () => {
    for (const s of deRonde(ronde)) {
      if (complete(s)) continue;
      jouerSerie(ronde, revele.get(s));
      if (s.feuilles.length > revele.get(s)) revele.set(s, revele.get(s) + 1);
    }
  };
  const finirRonde = () => {
    if (moteur) { while (!moteur.fini && moteur.ronde <= ronde) jouerMatchSeries(moteur); suivre(); }
    for (const s of deRonde(ronde)) revele.set(s, s.feuilles.length);
  };
  const toutReveler = () => {
    if (moteur) { while (!moteur.fini) jouerMatchSeries(moteur); suivre(); }
    for (const s of series) revele.set(s, s.feuilles.length); ronde = nRondes - 1;
  };
  /*
   * CE QUE LA SAUVEGARDE EMPORTE, et le seul endroit qui le compose. Appelé
   * au début de `dessiner()` — donc après CHAQUE changement, puisque rien ne
   * bouge à l'écran sans redessiner — et à la fermeture, qui elle ne
   * redessine pas. Semer l'appel dans les quatre fonctions qui touchent à
   * `revele` serait quatre endroits à ne pas oublier au prochain bouton.
   */
  const noter = () => {
    if (!onRevele) return;
    const tab = [];
    for (const s of series) tab[s.i] = revele.get(s);
    onRevele({ ronde, revele: tab });
  };
  /* Le tour où ta formation est tombée, s'il y en a un. */
  const elimination = () => {
    for (let r = 0; r < nRondes; r++) { const s = maSerie(r); if (s && complete(s) && s.winner !== you) return r; }
    return -1;
  };

  /* ---------- les volets ---------- */

  const ligneMatch = (s, k) => {
    const f = s.feuilles[k];
    const gA = f.buts.filter(b => b.cote === 'A').length, gB = f.buts.length - gA;
    const vainqueur = f.vainqueur === 'A' ? s.A : s.B;
    const { wA, wB } = (() => { let a = 0, b = 0; for (const x of s.feuilles.slice(0, k + 1)) { if (x.vainqueur === 'A') a++; else b++; } return { wA: a, wB: b }; })();
    const decisif = k === s.feuilles.length - 1;
    const toi = s.A === you || s.B === you;
    return `<div class="hub-jeu${toi ? (vainqueur === you ? ' v' : ' d') : ''}${decisif ? ' or' : ''}" data-sommaire="series|${s.i}|${k}" role="button" tabindex="0" title="Le sommaire du match">
      <span class="hub-jeu-n">M${k + 1}</span>${ctx.logo(vainqueur.tag, 15)}<span class="hub-jeu-adv">${ctx.esc(ctx.teamShort(vainqueur))}</span>
      <span class="hub-jeu-score">${Math.max(gA, gB)}–${Math.min(gA, gB)}</span>${f.ot ? '<em>P</em>' : ''}<span class="hub-jeu-serie">${wA}-${wB}</span></div>`;
  };

  /* =====================================================================
     LE COMBAT DE BOSS (S69). JP : *séries, c'est des boss, chaque match étant
     un round contre le dit boss*. La série se lit comme un combat : deux
     barres de vie (les victoires qu'il reste à chacun), le rapport
     d'éclaireur du boss (ses lignes, leurs tactiques et ce qui les contre, sa
     vedette, son gardien), tes lignes et leur chimie. Entre deux rounds, un
     ajustement à prendre ; avant chaque round, tout se règle.
     ===================================================================== */
  const decsSerie = decisions || [];
  const etatSerie = s => { const { wA, wB } = gains(s); const moi = s.A === you ? wA : wB, lui = s.A === you ? wB : wA; return { moi, lui, etat: moi > lui ? 'devant' : moi < lui ? 'derriere' : 'egal' }; };
  const vedetteDe = t => Object.values(t.roster || {}).filter(p => p && p.p !== 'G')
    .sort((a, b) => (b.simPTS || 0) - (a.simPTS || 0))[0] || null;
  const gardienDe = t => { const g = SLOTS.find(x => x.group === 'G' && !x.scratch); return g ? t.roster[g.i] : null; };
  const vies = (n, cls) => `<span class="boss-vie ${cls}">${[0, 1, 2, 3].map(i => `<i class="${i < n ? 'plein' : ''}"></i>`).join('')}</span>`;
  function bossHtml(s) {
    const boss = s.A === you ? s.B : s.A;
    const { moi, lui } = etatSerie(s);
    const lb = lignesDe(boss, boss.roster);
    const lt = lignesDe(you, you.roster);
    const ved = vedetteDe(boss), gar = gardienDe(boss);
    const chim = (you.jourLignes && you.jourLignes[you.jourLignes.length - 1] && you.jourLignes[you.jourLignes.length - 1].chimie) || you.chimie || [0, 0, 0, 0];
    return `<div class="boss">
      <div class="boss-tete">⚔️ <b>Contre ${ctx.esc(ctx.teamLabel(boss))}</b> · match ${revele.get(s) + 1}</div>
      ${(() => { const r = rivaliteDe(you); if (r && r.adv === boss) return `<div class="recit-rival">📖 La suite de l'histoire : ta rivalité de la saison, ${r.v}-${r.d} dans les gros matchs. ${r.d > r.v ? "L'heure de la revanche." : 'Ils veulent la leur.'}</div>`; const mb = (you.minisBoss || []).filter(x => x.adv === boss); return mb.length ? `<div class="recit-rival">📖 Déjà croisés dans un gros match cette saison : ${mb.filter(x => x.gagne).length}-${mb.filter(x => !x.gagne).length}.</div>` : ''; })()}
      <div class="boss-vies"><span title="Victoires qu'il te reste à gagner">Toi ${vies(4 - moi, 'toi')}</span><span title="Victoires qu'il lui reste à gagner">${vies(4 - lui, 'lui')} ${ctx.esc(ctx.teamShort(boss))}</span></div>
      <div class="boss-eclaireur">
        <div class="gl-k">Rapport d'éclaireur</div>
        <div class="boss-lignes">${lb.map((l, u) => { const T = TACTIQUES[l.tac], c = contreDe(l.tac), D = u < 3 && SYSTEMES_D[l.tacD] && l.tacD !== 'hourra' ? SYSTEMES_D[l.tacD] : null; return `<span title="Sa ${u + 1}${u ? 'e' : 're'} ligne : trio en ${ctx.esc(T.nom)}${D ? `, paire en ${ctx.esc(D.nom)}` : ''}${c ? ` — étouffé par ${ctx.esc(TACTIQUES[c].nom)}` : ''}">${u + 1}. ${T.ico} ${ctx.esc(T.nom)}${D ? ` · ${D.ico}` : ''}${c ? ` <small>↪ ${TACTIQUES[c].ico}</small>` : ''}</span>`; }).join('')}</div>
        ${ved ? `<div>⭐ Sa vedette : <b>${ctx.esc(ved.n)}</b> · ${ved.simPTS || 0} pts en saison</div>` : ''}
        ${gar ? `<div>🥅 Son gardien : <b>${ctx.esc(gar.n)}</b>${gar.simSA ? ` · ${pct3((gar.simSV || 0) / gar.simSA)} en saison` : ''}</div>` : ''}
      </div>
      ${planDuMatch(s) ? depistageHtml(pistesDuRapport(planDuMatch(s).depistage), { nomAdv: ctx.teamShort(boss) }) + `<div class="dep-suite">${ctx.esc(suiteDuPlan(s))}</div>` : ''}
      ${onDecision ? mainAdverseHtml(mainAdverse(graine, `po${ronde}:${revele.get(s)}`, energieAdverse({ serie: true, ronde })), { nomAdv: ctx.teamShort(boss), energie: energieAdverse({ serie: true, ronde }) }) : ''}
      <div class="hub-lignes"><span class="gl-k">Tes lignes</span> ${resumeLignes(lt, chim)}</div>
    </div>`;
  }
  /*
   * LE PLAN DE L'ADVERSAIRE EN SÉRIES (S70) : celui du match qui vient. Il
   * garde le plan qui a gagné et en change après une défaite — c'est ce que
   * le rapport d'éclaireur raconte, pour qu'on cherche le contre.
   */
  const planDuMatch = s => (s && s.plans && !complete(s) ? s.plans[revele.get(s)] || null : null);
  /*
   * CE QUE LE DERNIER MATCH DIT DU PROCHAIN (S76) — sans le dévoiler : le plan
   * d'hier, et s'il a marché. Le rapport en tient déjà compte (un plan gagnant
   * se garde souvent, un plan perdant presque jamais).
   */
  const suiteDuPlan = s => {
    const k = revele.get(s), pl = s.plans || [];
    if (!k || !pl[k - 1]) return 'Premier match de la série : le dépisteur n\'a que leur saison.';
    const P = PLANS_ADV[pl[k - 1].plan];
    const nom = P ? P.nom.toLowerCase() : 'leur plan';
    return pl[k - 1].gagne ? `Au dernier match, ${nom} n'a pas marché : ils vont sûrement changer.` : `Au dernier match, ${nom} a marché : ils risquent de le garder.`;
  };
  // Le prochain match de ta série a son plan d'avance (le moteur le pose sans jouer) :
  // son deuxième entracte s'attend. Une fois joué, sa feuille le confirme.
  const entracteSerieAttendu = s => {
    if (!onDecision || !s || complete(s)) return false;
    const k = revele.get(s);
    return !!(s.plans && s.plans[k] && (!s.feuilles[k] || s.feuilles[k].entracte))
      && !decsSerie.some(d => d.ronde === ronde && d.match_no === k && d.entracte);
  };
  /* La série confiée à l'adjoint (J2-13) : une décision `auto` dans cette ronde, et il la finit. */
  const serieDelegue = () => decsSerie.some(d => d.ronde === ronde && d.auto);
  /* LE DEUXIÈME ENTRACTE D'UN MATCH DE SÉRIES (S70), comme en saison. */
  function ouvrirEntracteSerie(direct = false) {
    const s = maSerie(ronde);
    if (!entracteSerieAttendu(s) || termine) return;
    if (serieDelegue()) {
      suiteEntracteSerie = { ronde, k: revele.get(s), direct };
      const r = ronde, k0 = revele.get(s); quitter();
      onDecision({ ronde: r, match_no: k0, entracte: { cle: 'garder', incident: null }, auto: true });
      return;
    }
    // Le match se joue pour montrer ses deux premières périodes ; le choix le
    // rejouera depuis 40:00 (`deciderSerie`, js/game.js).
    jouerSerie(ronde, revele.get(s));
    const k = revele.get(s), f = s.feuilles[k], e = f && f.entracte, pl = s.plans[k];
    if (!e) { matchSuivant(); dessiner(); tabs.suivre('serie'); return; }
    const boss = s.A === you ? s.B : s.A;
    const moiA = e.toi === 'A', cMoi = moiA ? 'A' : 'B', cLui = moiA ? 'B' : 'A';
    const moi = moiA ? e.gfA : e.gfB, lui = moiA ? e.gfB : e.gfA;
    const etatM = moi > lui ? 'devant' : moi < lui ? 'derriere' : 'egal';
    const off = entractesOfferts(graine, `po${ronde}:${k}`, etatM);
    const INC = INCIDENTS[off.incident];
    const tirs = c => ((f.tirs[c] || [])[1] || 0) + ((f.tirs[c] || [])[2] || 0);
    const buts = f.buts.filter(b => b.instant < 40)
      .map(b => `<span class="ent2-but ${b.cote === cMoi ? 'moi' : 'lui'}">${instantMot(b.instant)} · ${ctx.esc(b.marqueur ? b.marqueur.n : '')}</span>`).join('');
    const { wA, wB } = gains(s);
    const contexte = `<div class="ent2">
      <div class="ent2-score"><span>${ctx.logo(you.tag, 22)} ${ctx.esc(ctx.teamShort(you))} <b>${moi}</b></span><span class="ent2-sep">–</span><span><b>${lui}</b> ${ctx.esc(ctx.teamShort(boss))} ${ctx.logo(boss.tag, 22)}</span></div>
      <div class="ent2-note">Match ${k + 1} · après deux périodes · tirs ${tirs(cMoi)}–${tirs(cLui)} · série ${s.A === you ? wA : wB}-${s.A === you ? wB : wA}</div>
      ${buts ? `<div class="ent2-buts">${buts}</div>` : ''}
      <div class="ent2-incident">${INC.ico} ${ctx.esc(INC.titre)}.</div>
      ${planAdverseHtml(pl.plan, pl.contre, { nomAdv: ctx.teamShort(boss), prepJuste: pl.prepJuste ?? null })}
    </div>`;
    ouvrirChoix({
      ico: '🎬', titre: `Deuxième entracte · ${moi}–${lui}`, genre: 'entracte',
      recit: etatM === 'devant' ? 'Tu mènes. Vingt minutes à tenir.' : etatM === 'derriere' ? 'Tu tires de l\'arrière. Vingt minutes pour renverser ça.' : 'C\'est égal. Vingt minutes pour faire la différence.',
      contexte,
      options: off.options.map(o => ({ ...o, quand: '3e période' })),
      onChoix: cle => {
        const o = off.options.find(x => x.cle === cle);
        suiteEntracteSerie = { ronde, k, direct };
        const r = ronde; quitter();
        onDecision({ ronde: r, match_no: k, entracte: { cle, incident: o && o.incident ? o.incident : null } });
      },
    });
  }
  /* Le match d'avant, en une phrase (S74) : l'agent de test ne voyait jamais le pointage entre deux matchs. */
  const resultatPrecedent = (s, k) => {
    const f = k >= 1 && s.feuilles[k - 1];
    if (!f) return '';
    const moiA = s.A === you, gA = f.buts.filter(b => b.cote === 'A').length, gB = f.buts.length - gA;
    const pour = moiA ? gA : gB, contre = moiA ? gB : gA;
    return `Match ${k} : ${pour > contre ? 'victoire' : 'défaite'} ${pour}-${contre}${f.ot ? ' en prolongation' : ''}. `;
  };
  /* Le deck en séries : la saison, et les cartes gagnées aux séries d'avant. */
  const deckDeSerie = (k = maSerie(ronde) ? revele.get(maSerie(ronde)) : Infinity) => deckDe(decisionsSaison, { serie: decsSerie, ronde, k,
    pertes: (you.minisBoss || []).filter(m => !m.gagne && m.raison === 'nemesis').map(m => m.jour + 1),
    blessures: (you.injuriesLog || []).filter(i => i.games >= 15 && i.jour != null).map(i => i.jour + 1) });
  /* La récompense d'une série gagnée (S74) : une carte plus rare, ou passer. */
  function recompenseSerie() {
    if (!onDecision || choixOuvert()) return false;
    for (let r = 0; r < nRondes; r++) {
      const s = maSerie(r);
      if (r >= nRondes - 1 || !s || !complete(s) || s.winner !== you || decsSerie.some(d => d.ronde === r && d.recompense !== undefined)) continue;
      const boss = s.A === you ? s.B : s.A;
      const quitterR = f => { quitter(); f(); };
      ouvrirChoix({
        ico: '🏆', titre: `Série gagnée · ${nomRondeCourt(r)}`, cartes: true, genre: 'recompense', fermable: true, motFermer: 'Passer',
        recit: `Tu as sorti ${ctx.teamLabel(boss)}. Une carte rare pour la suite des séries — ou passe.`,
        options: recompensesOffertes(graine, `po${r}`, { serie: true }).map(optionDeCarteMatch),
        onChoix: k => quitterR(() => onDecision({ ronde: r, match_no: -1, recompense: k })),
        onFerme: () => quitterR(() => onDecision({ ronde: r, match_no: -1, recompense: null })),
      });
      return true;
    }
    return false;
  }
  function brancherBoss(s) {
    if (!s || complete(s) || !onDecision) return;
    const k = revele.get(s);
    const boss = s.A === you ? s.B : s.A;
    const quitterPour = f => { const r = ronde; quitter(); f(r); };
    const prep = actions.querySelector('.hub-preparer');
    if (prep) prep.onclick = () => ouvrirLignes({
      titre: `Préparer le match ${k + 1}`, sousTitre: `${nomRondeCourt(ronde)} · contre ${ctx.teamShort(boss)}`,
      lineup: you.roster, lignes: lignesDe(you, you.roster),
      chimie: (you.jourLignes && you.jourLignes[you.jourLignes.length - 1] || {}).chimie || [0, 0, 0, 0],
      energie: { ...((you.jourLignes && you.jourLignes[you.jourLignes.length - 1] || {}).energie || {}),
        ...Object.fromEntries(Object.values(you.roster).filter(g => g && g.p === 'G').map(g => [getPlayerKey(g), Math.round(jambesGardien(g))])) },
      filet: { ...filetDuSoir(you), choix: (decsSerie.find(d => d.ronde === ronde && d.match_no === k && d.filet) || {}).filet || 'auto' },
      adv: { nom: ctx.teamShort(boss), lignes: lignesDe(boss, boss.roster) },
      depistage: planDuMatch(s) ? planDuMatch(s).depistage : null,
      match: (decsSerie.find(d => d.ronde === ronde && d.match_no === k && d.match) || {}).match || { importance: 'haute', ad: 0 },
      // LES TOTAUX DU SOIR (1.0, C5) : les effets du match précédent tombent, ceux de ce match-ci s'ajoutent.
      totaux: (match, lignes) => {
        const aVenir = decsSerie.filter(d => d.ronde === ronde && d.match_no === k && !d.entracte && !d.match && !d.lignes);
        aVenir.push({ match, lignes });
        const es = you.effetsSerie, jc = you.jourCourant;
        you.effetsSerie = []; you.jourCourant = Infinity;
        try { return motsDesTotaux(totauxDuSoir(you, null, null, aVenir)); } finally { you.effetsSerie = es; you.jourCourant = jc; }
      },
      motAppliquer: `Appliquer — le match ${k + 1} se joue comme ça`,
      onBanc: onBanc ? () => quitterPour(r => onBanc(r, k)) : null,
      onAppliquer: (lignes, match, filet) => quitterPour(r => onDecision({ ronde: r, match_no: k, lignes, match, ...(filet ? { filet } : {}) })),
    });
    const bb = actions.querySelector('.hub-banc-serie');
    if (bb) bb.onclick = () => quitterPour(r => onBanc(r, k));
    /*
     * AVANT CHAQUE MATCH DE TA SÉRIE (S74b) : UN plein écran, pas deux. L'agent
     * de test : « un tapis roulant de modales » — l'ajustement « Entre deux
     * matchs », puis la main. L'ajustement est maintenant une rangée en tête de
     * la main, et les deux partent en UNE décision (le moteur les applique
     * ensemble, dans `appliquerDecisionSerie`). Au premier match, la main seule.
     */
    const dejaAjuste = k === 0 || decsSerie.some(d => d.ronde === ronde && d.match_no === k && d.ajustement);
    if (!decsSerie.some(d => d.ronde === ronde && d.match_no === k && d.main) && !choixOuvert()) {
      const deck = deckDeSerie();
      const { main, pioche } = mainDuMatch(graine, `po${ronde}:${k}`, deck);
      const pl = planDuMatch(s);
      const { moi, lui, etat } = etatSerie(s);
      const offres = dejaAjuste ? null : ajustementsOfferts(graine, ronde, k, etat);
      // L'ADJOINT JOUE CETTE SÉRIE (1.0, J2-13) : sa main, la piste la plus probable, un ajustement sans pari.
      const parLAdjoint = () => {
        const { jouees, enMain } = mainDeLAdjoint(main);
        const ajustement = offres ? offres.find(c => !AJUSTEMENTS[c].pari && !AJUSTEMENTS[c].gardienAux) || offres[0] : null;
        const piste = pl ? planProbable(pl.depistage) : null;
        quitterPour(r => onDecision({ ronde: r, match_no: k, ...(ajustement ? { ajustement } : {}), main: { jouees, enMain }, prep: piste ? [piste] : [], auto: true }));
      };
      if (serieDelegue()) { setTimeout(() => { if (!termine) parLAdjoint(); }, 0); return; }
      ouvrirMainDeMatch({
        titre: `Avant le match ${k + 1}`,
        sousTitre: `${nomRondeCourt(ronde)} · match ${k + 1} · contre ${ctx.teamShort(boss)} · série ${moi}-${lui}`,
        recit: `${resultatPrecedent(s, k)}${k === 0 ? '' : etat === 'derriere' ? 'Ta formation tire de l\'arrière. ' : etat === 'devant' ? 'Ta formation mène la série. ' : 'La série est à égalité. '}${suiteDuPlan(s)} Prépare-toi pour une piste${dejaAjuste ? '' : ', choisis ton ajustement'}, puis joue tes cartes.`,
        depistage: pl ? pl.depistage : null, planReel: pl ? pl.plan : null, nomAdv: ctx.teamShort(boss),
        contexte: mainAdverseHtml(mainAdverse(graine, `po${ronde}:${k}`, energieAdverse({ serie: true, ronde })), { nomAdv: ctx.teamShort(boss), energie: energieAdverse({ serie: true, ronde }), echelle: echelleTardive({ serie: true, ronde }) }),
        echelle: echelleTardive({ serie: true, ronde }),
        ajustements: offres ? offres.map(c => ({ cle: c, ...AJUSTEMENTS[c] })) : null,
        equipe: you, main, pioche, deck, onAdjoint: parLAdjoint,
        onJouer: (jouees, enMain, ajustement, prep) => quitterPour(r => onDecision({ ronde: r, match_no: k, ...(ajustement ? { ajustement } : {}), main: { jouees, enMain }, prep })),
      });
    }
  }

  const carteSerie = (s, grande) => {
    const { wA, wB } = gains(s);
    const fini = complete(s);
    const rangee = (t, w, pos) => {
      const b = ctx.band(t.tag);
      const vain = fini && s.winner === t;
      return `<div class="hub-sr ${pos}${fini ? (vain ? ' win' : ' lose') : ''}${t === you ? ' toi' : ''}" style="--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
        <span class="hub-sr-band">${ctx.logo(t.tag, grande ? 24 : 18)}<span>${ctx.esc(ctx.tagCourt(t))}</span></span>
        <span class="hub-sr-nom">${ctx.esc(grande ? ctx.teamLabel(t) : ctx.teamShort(t))}</span>
        ${pastilles(w)}<b class="hub-sr-w">${w}</b></div>`;
    };
    return `<div class="hub-serie${grande ? ' grande' : ''}${s.A === you || s.B === you ? ' toi' : ''}">${rangee(s.A, wA, 'a')}${rangee(s.B, wB, 'b')}
      <div class="hub-serie-etat">${ctx.esc(cap(revele.get(s) ? etatDeSerie(ctx, s, wA, wB) : 'La série commence'))}${!fini ? ` · match ${revele.get(s) + 1}` : ''}</div></div>`;
  };

  const voletSerie = () => {
    const s = maSerie(ronde);
    if (!s) {
      const r = elimination();
      // Une fois la Coupe remise, plus rien « ne se joue » (QA S74b).
      const tout = ronde === nRondes - 1 && rondeComplete(ronde);
      return `<div class="hub-note">${r >= 0 ? `Ta formation est tombée au ${nomRonde(r).toLowerCase()}. ${tout ? 'Les séries sont finies.' : 'La ronde se joue sans elle.'}` : 'Ta formation ne joue pas cette ronde.'}</div>`;
    }
    const jeux = s.feuilles.slice(0, revele.get(s)).map((f, k) => ligneMatch(s, k)).reverse().join('');
    // La carte du haut porte déjà la série ; le volet liste ses matchs.
    return `<div class="hub-titre">Les matchs de la série</div>${jeux ? `<div class="hub-jeux">${jeux}</div>` : '<div class="hub-note">Aucun match joué encore.</div>'}`;
  };

  const voletRonde = () => `<div class="hub-titre">${ctx.esc(nomRonde(ronde))}</div>
    <div class="hub-series">${deRonde(ronde).map(s => carteSerie(s, false)).join('')}</div>`;

  /*
   * LE TABLEAU, RÉVÉLÉ AU FUR ET À MESURE. La structure ne dépend pas des
   * gagnants : la série j d'une ronde oppose les gagnants des séries j et
   * n−1−j de la ronde d'avant (c'est ainsi que `runPlayoffs` apparie). Une
   * série dont les deux clubs ne sont pas encore connus s'affiche « à
   * venir », avec le club déjà qualifié s'il y en a un.
   */
  const voletTableau = () => {
    // Une ronde ne naît que la précédente décidée (S79) : d'ici là, ses séries
    // sont des places « à venir », dans l'ordre où elles naîtront.
    const places = new Map();
    const rondeDe = r => {
      const vraies = deRonde(r);
      if (vraies.length) return vraies;
      if (!places.has(r)) places.set(r, Array.from({ length: Math.max(1, deRonde(0).length >> r) }, () => ({ ronde: r, A: null, B: null, feuilles: [] })));
      return places.get(r);
    };
    const enfants = s => {
      if (s.ronde === 0) return [];
      const prev = rondeDe(s.ronde - 1), j = rondeDe(s.ronde).indexOf(s);
      return [prev[j], prev[prev.length - 1 - j]];
    };
    const qualifie = s => (complete(s) ? s.winner : null);
    const connu = s => s.ronde === 0 || enfants(s).every(complete);
    const noeud = (s, pos) => {
      const { wA, wB } = gains(s);
      const fini = complete(s);
      const rangee = (t, w, vain) => (t
        ? `<span class="bk-row ${fini ? (vain ? 'win' : 'lose') : 'en-cours'}">${ctx.logo(t.tag, 16)}<span class="bk-nom">${ctx.esc(ctx.tagCourt(t))}</span><b>${connu(s) ? w : ''}</b></span>`
        : `<span class="bk-row a-venir"><span class="bk-nom">À venir</span></span>`);
      if (connu(s)) return `<div class="bk-serie ${pos}${s.A === you || s.B === you ? ' you' : ''}${fini ? '' : ' en-cours'}">${rangee(s.A, wA, s.winner === s.A)}${rangee(s.B, wB, s.winner === s.B)}</div>`;
      const [c1, c2] = enfants(s);
      return `<div class="bk-serie ${pos} a-venir">${rangee(qualifie(c1), 0, false)}${rangee(qualifie(c2), 0, false)}</div>`;
    };
    const finale = rondeDe(nRondes - 1)[0];
    const cote = t0 => {
      const colonnes = Array.from({ length: nRondes - 1 }, () => []);
      const descendre = x => { if (!x) return; colonnes[x.ronde].push(x); for (const e of enfants(x)) descendre(e); };
      descendre(t0);
      return colonnes;
    };
    const [g0, d0] = enfants(finale);
    const gauche = cote(g0), droite = cote(d0);
    const colonne = (liste, pos, r) => `<div class="bk-col ${pos}" data-ronde="${r}"><div class="bk-ronde">${ctx.esc(nomRondeCourt(r))}</div><div class="bk-noeuds">${liste.map(s => noeud(s, pos)).join('')}</div></div>`;
    const colsG = gauche.map((l, r) => colonne(l, 'g', r)).join('');
    const colsD = droite.slice().reverse().map((l, k) => colonne(l, 'd', nRondes - 2 - k)).join('');
    const champion = complete(finale) ? finale.winner : null;
    return `<div class="bracket-scroll"><div class="bracket" style="--rondes:${nRondes}">
      ${colsG}
      <div class="bk-col finale"><div class="bk-ronde">Finale</div><div class="bk-noeuds">
        <div class="bk-champion${champion ? '' : ' a-venir'}">${champion ? ctx.logo(champion.tag, 34) : ''}<span class="bk-champ-mot">Champion</span><b>${champion ? ctx.esc(ctx.teamShort(champion)) : '?'}</b></div>
        ${noeud(finale, 'f')}</div></div>
      ${colsD}
    </div></div>`;
  };

  /*
   * LE MÊME MENU QU'À LA SAISON : les meneurs des séries et la feuille de
   * n'importe quelle équipe encore en vie, triables. Les chiffres ne
   * comptent que les matchs révélés.
   */
  const menu = menuNeuf();
  /* Les clubs des séries, dans l'ordre où ils sont tombés : les survivants d'abord. */
  const clubs = () => {
    const vus = [];
    for (let r = nRondes - 1; r >= 0; r--) for (const s of deRonde(r)) for (const t of [s.A, s.B]) if (!vus.includes(t)) vus.push(t);
    return vus;
  };
  const ficheSeries = t => {
    let v = 0, d = 0;
    for (const s of series) {
      if (s.A !== t && s.B !== t) continue;
      const cote = s.A === t ? 'A' : 'B';
      for (const f of s.feuilles.slice(0, revele.get(s))) { if (f.vainqueur === cote) v++; else d++; }
    }
    return { v, d };
  };

  /*
   * LA SAISON RESTE À UN ONGLET. Une fois les séries commencées, le
   * classement final et les meneurs de la saison n'étaient plus consultables
   * qu'en fermant l'écran : un menu de jeu laisse revenir en arrière.
   */
  const compteSaison = saison && saison.teams ? compteDeFiches(saison.teams) : null;
  const voletSaison = () => {
    const ts = saison.teams;
    const rangee = (t, i) => `<tr class="${t === you ? 'toi' : ''}${i === (saison.enSeries || 16) - 1 ? ' cut' : ''}">
      <td>${i + 1}</td><td class="nom">${ctx.logo(t.tag, 14)} ${ctx.esc(ctx.teamShort(t))}</td>
      <td>${t.W + t.L + t.OTL}</td><td>${t.W}</td><td>${t.L}</td><td>${t.OTL}</td><td class="heros">${t.PTS}</td>
      <td>${t.GF}</td><td>${t.GA}</td><td>${t.GF - t.GA > 0 ? '+' : ''}${t.GF - t.GA}</td></tr>`;
    return `<div class="live-tableau hub-classement"><div class="live-tableau-titre">Classement final · saison régulière</div>
      <div class="hub-scroll"><table><thead><tr><th>#</th><th>Équipe</th><th>PJ</th><th>V</th><th>D</th><th>DP</th><th class="heros">PTS</th><th>BP</th><th>BC</th><th>Diff</th></tr></thead>
      <tbody>${ts.map(rangee).join('')}</tbody></table></div></div>
      ${meneursHtml(ctx, compteSaison, equipeDe, you, 'saison régulière', menu, 25)}`;
  };

  const tabs = onglets(barre, volet, [
    { cle: 'serie', ico: 'i-target', titre: 'Ma série', page: 'match' }, { cle: 'tableau', ico: 'i-cup', titre: 'Tableau', page: 'classement' },
    { cle: 'ronde', ico: 'i-cal', titre: 'La ronde', page: 'calendrier' }, { cle: 'meneurs', ico: 'i-star', titre: 'Meneurs', page: 'meneurs' },
    { cle: 'equipes', ico: 'i-jersey', titre: 'Équipes', page: 'equipes' },
  ], cle => {
    // La saison régulière se relit SOUS le tableau (S67) : un menu laisse
    // revenir en arrière, et le classement est l'onglet où on la cherche.
    if (cle === 'tableau') return `${voletTableau()}${compteSaison ? voletSaison() : ''}`;
    if (cle === 'serie') return voletSerie();
    if (cle === 'ronde') return voletRonde();
    if (cle === 'meneurs') return meneursHtml(ctx, compterFeuilles(feuillesRevelees()), equipeDe, you, 'séries', menu, 1);
    if (cle === 'equipes') return equipesHtml(ctx, {
      teams: clubs(), compte: compterFeuilles(feuillesRevelees()), you, menu,
      anciens: t => { const c = compterFeuilles(feuillesRevelees()); return t === you ? [...c.keys()].filter(p => !equipeDe.has(p) && (c.get(p).gp || 0) > 0) : []; },
      matchsDe: t => { const f = ficheSeries(t); return f.v + f.d; },
      ficheDe: t => { const f = ficheSeries(t); return `${f.v}-${f.d} en séries`; },
    });
    return voletTableau();
  });
  const debrancherMenu = brancherMenu(volet, menu, clubs, () => tabs.rafraichir(), cle => tabs.montrer(cle), carte);
  // L'onglet « Alignement » ouvre le banc pendant ta série (S69).
  if (onBanc) tabs.hub.banc = () => {
    const s = maSerie(ronde);
    if (!s || complete(s)) return;
    const r = ronde, k = revele.get(s);
    quitter(); onBanc(r, k);
  };

  /* ---------- l'en-tête, la carte, les actions ---------- */

  function dessiner() {
    noter();
    cacherBoutonFlottant();   // idem aux séries : le champion couronné n'a plus de « Match suivant »
    const s = maSerie(ronde);
    const finale = deRonde(nRondes - 1)[0];
    const toutFini = ronde === nRondes - 1 && rondeComplete(ronde);
    // Le ✕ ne saute pas tes matchs (S79) : il n'apparaît que lorsqu'il a quelque chose à faire.
    ui.close.hidden = !(toutFini || !you || elimination() >= 0);
    const etat = s ? cap(revele.get(s) ? etatDeSerie(ctx, s, gains(s).wA, gains(s).wB) : `contre ${ctx.teamShort(s.A === you ? s.B : s.A)}`) : (elimination() >= 0 ? `Éliminé au ${nomRonde(elimination()).toLowerCase()}` : '');
    head.innerHTML = `<span class="live-ronde">Séries éliminatoires</span>
      <span class="live-match">${ctx.esc(nomRondeCourt(ronde))}${s && !complete(s) ? ` · match ${revele.get(s) + 1}` : ''}</span>
      <span class="live-serie">${ctx.esc(etat)}</span>`;

    // LA CARTE : ta série tant qu'elle se joue, son verdict quand elle est
    // finie, le champion quand tout l'est.
    if (toutFini) {
      const champ = finale.winner;
      carte.innerHTML = `<div class="live-bilan ${champ === you ? 'gagne' : 'perdu'}">
        <div class="live-bilan-titre">${champ === you ? 'Ta formation soulève la Coupe Stanley' : `${ctx.esc(ctx.teamLabel(champ))} soulève la Coupe`}</div>
        <div class="hub-carte-note">${ctx.esc(cap(etatDeSerie(ctx, finale, finale.wA, finale.wB)))}.</div></div>`;
      actions.innerHTML = `<button class="btn gold hub-suite">Voir le tableau des séries</button>`;
      actions.querySelector('.hub-suite').onclick = fermer;
      return;
    }
    if (s) {
      if (complete(s)) {
        const gagne = s.winner === you;
        carte.innerHTML = `<div class="live-bilan ${gagne ? 'gagne' : 'perdu'}"><div class="live-bilan-titre">${gagne ? 'Série remportée' : 'Éliminé'} ${Math.max(s.wA, s.wB)}-${Math.min(s.wA, s.wB)} · ${ctx.esc(nomRondeCourt(ronde))}</div>
          <div class="hub-carte-note">${rondeComplete(ronde) ? (gagne ? `La ronde est finie. ${ronde + 1 < nRondes ? 'La suivante t\'attend.' : ''}` : 'La ronde est finie ; les séries continuent sans ta formation.') : 'Les autres séries de la ronde se poursuivent.'}</div></div>`;
      } else carte.innerHTML = carteSerie(s, true) + (serieDelegue() ? '<div class="hub-carte-note hub-adjoint">L\'adjoint joue cette série.</div>' : '') + bossHtml(s);
    } else {
      const r = elimination();
      carte.innerHTML = `<div class="hub-match"><div class="hub-match-titre">${ctx.esc(nomRonde(ronde))}</div><div class="hub-match-note">${r >= 0 ? `Ta formation est tombée au ${ctx.esc(nomRonde(r).toLowerCase())}. ` : ''}${deRonde(ronde).length} série${deRonde(ronde).length > 1 ? 's' : ''} : ${rondeComplete(ronde) ? 'la ronde est finie.' : 'la ronde se joue.'}</div></div>`;
    }

    const boutons = [];
    if (s && !complete(s)) boutons.push(`<button class="btn gold hub-regarder" title="Le prochain match de ta série, lancer par lancer">Regarder le match ${revele.get(s) + 1}</button>`);
    /*
     * PAS DE SAUT PAR-DESSUS TA SÉRIE (S79). JP : *pas possible de sauter la
     * saison*. « Finir la ronde » n'existe que ta série décidée (ou sans toi) ;
     * « Passer à la fin », que tu n'aies plus rien à décider (éliminé).
     */
    const plusRienADecider = !you || elimination() >= 0;
    if (!rondeComplete(ronde)) {
      boutons.push(`<button class="btn go hub-jour" title="Un match de plus dans chaque série de la ronde">Match suivant</button>`);
      if (!s || complete(s)) boutons.push(`<button class="btn hub-ronde" title="Jouer la ronde jusqu'au bout">Finir la ronde</button>`);
    } else if (ronde + 1 < nRondes) {
      boutons.push(`<button class="btn go hub-jour" title="${ctx.esc(nomRonde(ronde + 1))}">${ctx.esc(nomRondeCourt(ronde + 1))}</button>`);
    }
    // PRÉPARER LE ROUND ET LE BANC (S69) : tant que ta série se joue.
    if (s && !complete(s) && onDecision) boutons.unshift(`<div class="hub-actions-rang"><button class="btn gold hub-preparer">Préparer le match ${revele.get(s) + 1}</button>${onBanc ? '<button class="btn hub-banc-serie">Le banc</button>' : ''}</div>`);
    if (plusRienADecider) boutons.push(`<button class="btn hub-fin" title="Jouer toutes les séries et voir le tableau">Passer à la fin</button>`);
    if (onDecision) boutons.push(`<button class="btn hub-deck" title="Tes cartes de match : tu en piges cinq avant chaque match de ta série">🃏 Mon deck · ${deckDeSerie().length}</button>`);
    actions.innerHTML = boutons.join('');
    const vd = actions.querySelector('.hub-deck');
    if (vd) vd.onclick = () => ouvrirDeck({ deck: deckDeSerie() });
    boutonFlottant(actions, termine);
    const regarder = actions.querySelector('.hub-regarder');
    if (regarder) regarder.onclick = () => regarderProchain();
    const jour = actions.querySelector('.hub-jour');
    if (jour) jour.onclick = () => {
      if (rondeComplete(ronde)) { ronde++; dessiner(); tabs.suivre('serie'); return; }
      if (entracteSerieAttendu(maSerie(ronde))) { ouvrirEntracteSerie(false); return; }
      matchSuivant(); dessiner(); tabs.suivre('serie');
    };
    const fr = actions.querySelector('.hub-ronde');
    if (fr) fr.onclick = () => { finirRonde(); dessiner(); tabs.suivre('serie'); };
    const hf = actions.querySelector('.hub-fin');
    if (hf) hf.onclick = () => { toutReveler(); dessiner(); tabs.suivre('serie'); };
    if (!recompenseSerie()) brancherBoss(s);
  }

  /* REGARDER LE MATCH : le direct rejoue le prochain match de ta série, puis
     la ronde avance d'un match partout, comme si on l'avait passé. */
  function regarderProchain(depuis = 0) {
    const s = maSerie(ronde);
    if (!s || complete(s) || termine) return;
    const k = revele.get(s);
    const attente = !depuis && entracteSerieAttendu(s);
    const { wA, wB } = gains(s);
    // Le match se JOUE maintenant, pour être montré (S79).
    jouerSerie(ronde, k);
    const f = s.feuilles[k];
    const apres = etatDeSerie(ctx, s, wA + (f.vainqueur === 'A' ? 1 : 0), wB + (f.vainqueur === 'B' ? 1 : 0));
    diffuserMatch({
      feuille: f, A: s.A, B: s.B,
      titre: nomRonde(ronde), sousTitre: `Match ${k + 1}`,
      etat: k ? etatDeSerie(ctx, s, wA, wB) : `${ctx.teamShort(s.A)} contre ${ctx.teamShort(s.B)}`,
      tally: { wA, wB }, graine: (s.i + 1) * 1000 + k,
      avant: compterFeuilles(feuillesRevelees()), apres: `${cap(apres)}.`, ctx,
      arret: attente ? 40 : null, onArret: attente ? () => ouvrirEntracteSerie(true) : null, depuis,
      onTermine: () => { if (termine) return; matchSuivant(); dessiner(); tabs.suivre('serie'); },
    });
  }

  /* Quitter SANS finir les séries (S69) : une décision ou le banc, puis on revient. */
  const quitter = () => {
    if (termine) return;
    termine = true;
    cacherBoutonFlottant();
    noter();
    debrancherMenu();
    retirerHub(tabs.hub);
    window.removeEventListener('keydown', clavier);
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };
  const fermer = () => {
    if (termine) return;
    quitter();
    onTermine();
  };
  // Le ✕ ne saute pas tes matchs : il ferme quand tout est vu, ou quand tu n'as plus rien à décider (S79).
  ui.close.onclick = () => {
    if (ronde === nRondes - 1 && rondeComplete(ronde)) { fermer(); return; }
    if (!you || elimination() >= 0) { toutReveler(); fermer(); }
  };
  ui.close.setAttribute('aria-label', 'Passer au tableau des séries');
  ui.close.title = 'Jouer le reste des séries et voir le tableau';
  const clavier = ev => {
    if ((ev.key !== ' ' && ev.key !== 'Enter') || ev.target.closest('input, textarea, select, button, [role="button"], a')) return;
    if (document.getElementById('liveModal')?.style.display === 'flex') return;
    // UN CHOIX OUVERT (S74) passe devant : Espace ne révèle pas un match derrière la main.
    if (choixOuvert()) return;
    // L'écran ancré mais caché (on lit une autre page) n'avance pas le temps.
    if (document.body.classList.contains('hub-cache')) return;
    ev.preventDefault();
    const b = actions.querySelector('.hub-jour') || actions.querySelector('.hub-suite');
    if (b) b.click();
  };
  window.addEventListener('keydown', clavier);

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  dessiner();
  tabs.montrer(maSerie(0) ? 'serie' : 'tableau');
  // LA TROISIÈME PÉRIODE (S70) : le choix de l'entracte vient d'être pris.
  if (suiteEntracteSerie) {
    const se = suiteEntracteSerie, sm = maSerie(ronde);
    suiteEntracteSerie = null;
    if (sm && se.ronde === ronde && revele.get(sm) === se.k && !entracteSerieAttendu(sm)) {
      if (se.direct) regarderProchain(40);
      else { matchSuivant(); dessiner(); tabs.suivre('serie'); }
    }
  }
}
