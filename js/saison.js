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

import { SLOTS, compterFeuilles, tirsTotal, soirEreintant, CARTES, PALIERS_CARTES, mainDeCartes, SITUATIONS,
  PLANS, ROULEMENTS, planDe, roulementDe, JOURS_SITUATIONS,
  STYLES, MOMENTS, JOURS_MOMENTS, momentDuJour, SEQUENCES, RECUL_SEQUENCE,
  OBJECTIFS, JOURS_OBJECTIFS, objectifsOfferts, etatObjectif, MATCHS_OBJECTIF,
  getPlayerKey, ciblesDe, effetsEnCours, OBJECTIF_RATE,
  lignesDe, IMPORTANCES, cibleMutation, dureeOption, TACTIQUES, MUTATIONS, motsDeMutation,
  contreDe, AJUSTEMENTS, ajustementsOfferts, MINI_BOSS, ELAN, SONNE,
  PLANS_ADV, AVANT_GROS, avantDuGros, ENTRACTES, INCIDENTS, entractesOfferts,
  mainDuDeck, SORTES_DECK, GAIN_STAGE, rolesOfferts, tactiquesDuStage, fitLigne, profilPrincipal, apprentissagePhoto } from './sim.js';
import { artJoueur } from './cartes.js';
import { ouvrirChoix, choixOuvert, ouvrirLignes, resumeLignes, puces, planAdverseHtml, ouvrirMainDeMatch, ouvrirDeck, optionDeCarteMatch, mainAdverseHtml, planReplie } from './gerant.js';
import { CARTES_MATCH, deckDe, mainDuMatch, recompensesOffertes, mainAdverse } from './combat.js';
import { diffuserMatch, pastilles } from './direct.js';
import { inscrireHub, retirerHub, signalerVue } from './coquille.js';
import { tempsRestant } from './recit.js';

/*
 * APRÈS LE CHOIX DU DEUXIÈME ENTRACTE (S70), la saison se rejoue et l'écran
 * rouvre : il doit enchaîner sur la troisième période (le direct à 40:00, ou
 * la journée révélée) au lieu de rendre la main. Rien de ça n'est sauvegardé
 * — un rechargement redonne l'affiche, et « Journée suivante » la suite.
 */
let suiteEntracte = null, suiteEntracteSerie = null;
/* « 2e 14:05 » : l'instant d'un but, pour le tableau de l'entracte. */
const instantMot = t => { const per = Math.min(3, Math.floor(t / 20) + 1), r = t - (per - 1) * 20; return `${per === 1 ? '1re' : `${per}e`} ${Math.floor(r)}:${String(Math.floor((r % 1) * 60)).padStart(2, '0')}`; };
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
const ord = n => (n === 1 ? '1er' : `${n}e`);
const ordF = n => (n === 1 ? '1re' : `${n}e`);
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
const nom = p => (p && p.n) || '';
const cap = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
/* « 1er trio · AG », « 2e paire · DD », « Partant », « Réserve D ». */
const caseCourte = s => (s.group === 'F' && !s.scratch ? `${s.unit + 1}${s.unit ? 'e' : 'er'} trio · ${s.role}`
  : s.group === 'D' && !s.scratch ? `${s.unit + 1}${s.unit ? 'e' : 're'} paire · ${s.role}` : s.role);
const pct = (sv, sa) => (sv / Math.max(1, sa)).toFixed(3).replace(/^0/, '');

/* ---------- la coquille : en-tête, carte, actions, onglets, volet ---------- */

function coquille(label) {
  const modal = document.getElementById('hubModal');
  if (!modal) return null;
  const $ = s => modal.querySelector(s);
  const sheet = $('.hub-sheet');
  if (sheet) sheet.setAttribute('aria-label', label);
  return { modal, head: $('.hub-head'), carte: $('.hub-carte'), actions: $('.hub-actions'), barre: $('.hub-onglets'), volet: $('.hub-volet'), close: $('.hub-close') };
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
  };
  const sheet = volet.closest('.hub-sheet');
  const pageDe = cle => (liste.find(o => o.cle === cle) || {}).page || null;
  const montrer = cle => {
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

const pct3 = x => x.toFixed(3).replace(/^0/, '');
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
    <div class="hub-scroll"><table><thead><tr><th>#</th><th>Joueur</th><th>${tete === 'eq' ? 'Éq.' : 'Case'}</th>${colonnes.map(th).join('')}</tr></thead>
    <tbody>${vues.map((l, i) => `<tr class="${l.toi ? 'toi' : ''}${l.blesse ? ' blesse' : ''}">
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
function equipesHtml(ctx, { teams, compte, you, menu, ficheDe, matchsDe, blessesDe }) {
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
    return { p, t, nom: nom(p), role: caseCourte(s), blesse: blesses.get(p) || 0, c: compte.get(p) || VIDE };
  };
  const pat = SLOTS.filter(s => s.group !== 'G').map(rangee).filter(Boolean);
  const gar = SLOTS.filter(s => s.group === 'G').map(rangee).filter(Boolean);
  // Le gardien de rappel n'a pas de case, mais il a gardé des matchs.
  if (t.rappelG && compte.get(t.rappelG)) gar.push({ p: t.rappelG, t, nom: nom(t.rappelG), role: 'Rappel', c: compte.get(t.rappelG) });
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
 * LE PLAN ET LA GLACE SE LISENT SUR L'AFFICHE (S62). Deux décisions qui valent
 * toute la saison et qui se changent derrière le banc : si l'écran ne les dit
 * pas, on oublie ce qu'on a choisi en janvier. Les mots viennent de `PLANS` et
 * `ROULEMENTS` — jamais recopiés ici, sinon un réglage retouché fait mentir
 * l'affiche.
 */
function motDuPlan(ctx, you, onBanc) {
  const pl = PLANS[planDe(you)], ro = ROULEMENTS[roulementDe(you)];
  if (!pl || !ro) return '';
  const dit = x => `${x.ico} ${ctx.esc(x.nom)}`;
  const inf = x => `${x.nom}${x.bon ? ` — ${x.bon}` : ''}${x.prix ? `, mais ${x.prix.charAt(0).toLowerCase()}${x.prix.slice(1)}` : ''}`;
  return `<div class="hub-match-note hub-plan">
    <span title="${ctx.esc(inf(pl))}">${dit(pl)}</span> · <span title="${ctx.esc(inf(ro))}">${dit(ro)}</span>${onBanc ? ' <span class="hub-plan-ou">derrière le banc</span>' : ''}
  </div>`;
}

/*
 * UN CHOIX, À LA FAÇON D'UN ÉVÉNEMENT DE SLAY THE SPIRE (S66) : une histoire,
 * et des options qui disent chacune ce qu'elles achètent, ce qu'elles coûtent
 * et quelles factions elles bougent. C'est le même gabarit pour les dilemmes,
 * les séquences et les objectifs, pour qu'un seul langage s'apprenne.
 */

function panneauChoix(ctx, { classe, ico, titre, irl, recit, options, attr }) {
  return `<div class="hub-choix ${classe}" role="group" aria-label="${ctx.esc(titre)}">
    <div class="hub-choix-tete"><span class="hub-choix-ico">${ico}</span><span class="hub-choix-titre">${ctx.esc(titre)}</span>${irl ? `<span class="hub-choix-irl">${ctx.esc(irl)}</span>` : ''}</div>
    ${recit ? `<div class="hub-choix-recit">${ctx.esc(recit)}</div>` : ''}
    <div class="hub-choix-rang">${options.map(o => `<button type="button" class="hub-option" ${attr}="${ctx.esc(o.cle)}">
      <span class="hub-option-nom">${o.ico ? `${o.ico} ` : ''}${ctx.esc(o.nom)}</span>
      ${o.bon ? `<span class="hub-option-bon">+ ${ctx.esc(o.bon)}</span>` : ''}
      ${o.prix ? `<span class="hub-option-prix">− ${ctx.esc(o.prix)}</span>` : ''}
    </button>`).join('')}</div>
  </div>`;
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

/* Le bloc d'une équipe dans la carte du prochain match : écusson, nom, fiche. */
function blocEquipe(ctx, t, ligne, pos) {
  const b = ctx.band(t.tag);
  return `<div class="hub-eq ${pos}" style="--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
    <div class="hub-eq-band">${ctx.logo(t.tag, 26)}<span>${ctx.esc(ctx.tagCourt(t))}</span></div>
    <div class="hub-eq-nom">${versEquipe(ctx, t, ctx.teamLabel(t))}</div>
    <div class="hub-eq-fiche">${ctx.esc(ligne)}</div>
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
  const cible = actions && actions.querySelector('.hub-jour');
  if (!cible || termine) { f.hidden = true; return; }
  f.textContent = `${cible.textContent.trim()} ▶`;
  f.onclick = () => { f.hidden = true; cible.click(); };
  f._io = new IntersectionObserver(([e]) => { f.hidden = e.isIntersecting || window.innerWidth >= 1200; }, { threshold: 0.6 });
  f._io.observe(cible);
}
export function cacherBoutonFlottant() {
  const f = document.getElementById('hubFlottant');
  if (f) { f.hidden = true; if (f._io) { f._io.disconnect(); f._io = null; } }
}

/* =====================================================================
   La saison, journée par journée
   ===================================================================== */

/**
 * Ouvre l'écran de saison. Les 82 journées sont déjà jouées (`simulateLeague`
 * a rendu le calendrier) ; l'écran les révèle au rythme du joueur et appelle
 * `onTermine` quand on passe au bilan.
 *
 *   calendrier  [jour][match] = { A, B, gfA, gfB, ot, feuille }
 *   teams       les 32 équipes (leurs compteurs sont ceux de FIN de saison :
 *               le classement du jour se recalcule à partir du calendrier)
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
export function ouvrirSaison({ calendrier, teams, you, enSeries = 16, epoque = null, ctx, onTermine, depuis = 0, onJour = null, onBanc = null, graine = 0, cartesPrises = [], onCarte = null, onTrou = null, trousPris = [], decisions = [], onDecision = null }) {
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
  const fiche = new Map(teams.map(t => [t, { W: 0, L: 0, OTL: 0, GF: 0, GA: 0, PTS: 0 }]));
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
  const pris = new Set(decs.filter(d => typeof d.palier === 'string').map(d => d.palier));
  const momentsAvant = J => decs.filter(d => d.moment && d.moment.famille === 'moment'
    && typeof d.palier === 'string' && Number(d.palier.slice(2)) < J).map(d => d.moment.cle);
  const dilemmeOuvert = () => {
    if (!onDecision || jour >= N) return null;
    const J = JOURS_MOMENTS.find(j => jour >= j && !pris.has(`m:${j}`));
    if (J === undefined) return null;
    const cle = momentDuJour(graine, J, momentsAvant(J));
    return cle ? { J, cle } : null;
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
    return { cle, palier };
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
  const grosDuJour = j => (you.minisBoss || []).find(x => x.jour === j) || null;
  const entracteAttendu = j => !!(onDecision && grosDuJour(j) && !decs.some(d => d.jour === j && d.entracte));
  function avantOuvert() {
    if (!onDecision || jour >= N) return null;
    const p = prochain();
    const mb = p ? grosDuJour(p.j) : null;
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
      titre: 'Ta main', sousTitre: `Match important · journée ${mo.p.j + 1} · contre ${ctx.teamShort(adv)}`,
      recit: 'Cinq cartes, trois d\'énergie. Ce que tu joues vaut pour ce match seulement ; le reste retourne dans le deck.',
      contexte: planReplie(planAdverseHtml(mo.mb.plan, mo.mb.contre, { nomAdv: ctx.teamShort(adv) }), `${PLANS_ADV[mo.mb.plan] ? PLANS_ADV[mo.mb.plan].ico : '📋'} Leur plan : <b>${ctx.esc(PLANS_ADV[mo.mb.plan] ? PLANS_ADV[mo.mb.plan].nom : '')}</b> · ${mo.mb.contre ? '✓ contré' : '✗ pas contré'}`) + mainAdverseHtml(mainAdverse(graine, `j${mo.p.j}`), { nomAdv: ctx.teamShort(adv) }),
      equipe: you, main, pioche, deck,
      onJouer: (jouees, enMain) => { const j = jour; quitter(); onDecision({ jour: mo.p.j, main: { jouees, enMain } }, j); },
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

  /* La case qu'occupait le blessé, nommée comme partout ailleurs. */
  const caseDe = p => {
    const s = SLOTS.find(x => you.roster[x.i] === p);
    return s ? (ctx.slotShort ? ctx.slotShort(s) : s.role) : 'Réserviste';
  };
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
  const avancer = (n, stop = false) => {
    let premier = true;
    entracteDemande = false;
    while (n-- > 0 && jour < N) {
      // LE DEUXIÈME ENTRACTE D'UN GROS MATCH (S70) : on n'y passe pas sans choisir.
      if (stop && entracteAttendu(jour)) { if (premier) entracteDemande = true; break; }
      premier = false;
      appliquerJour(jour++);
      const pal = palierOuvert();
      // TROIS RAISONS DE S'ARRÊTER, et chacune n'arrête qu'UNE fois — c'est
      // la règle du palier, étendue aux situations et aux cases vides : un
      // moment qu'on dépasse ne doit pas bloquer « +10 journées » à chaque
      // clic pour qui a décidé de ne rien faire.
      if (stop && (blessuresNeuves().length || trousNeufs().length || situationsNeuves().length || accidentsNeufs().length
        || (pal !== undefined && !paliersVus.has(pal)) || forceOuvert())) break;
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
  };
  // REPRISE : on réapplique les journées déjà vues avant le premier dessin.
  if (depuis > 0) avancer(Math.min(depuis, N));

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
    const buts = m.feuille ? m.feuille.buts.slice().sort((x, y) => x.instant - y.instant).map(b => {
      const t = b.cote === 'A' ? m.A : m.B;
      const aides = b.passeurs.map(p => `${ctx.esc(nom(p))} (${ordF(rang(p, 'a'))} passe)`).join(', ');
      return `<div class="live-but-ligne${t === you ? ' toi' : ''}"><span class="live-tps">${tempsRestant(b.instant)}</span>${ctx.logo(t.tag, 13)}<span><b>${ctx.esc(nom(b.marqueur))}</b> <span class="live-xe">(${ord(rang(b.marqueur, 'g'))} but)</span>${aides ? `, ${aides}` : ''}${b.an ? ' · AN' : b.dn ? ' · DN' : ''}${b.gagnant && m.ot ? ' · en prolongation' : ''}</span></div>`;
    }).join('') : '';
    const somm = m.feuille ? ` data-sommaire="saison|${j}|${k}" role="button" tabindex="0" title="Le sommaire du match"` : '';
    return `<div class="live-board hub-board"${somm}>${cote(m.A, m.gfA, 'a', gagneA)}
      <div class="live-horloge"><span class="live-per">FINAL</span><span class="live-temps">${m.ot ? 'PROL.' : '—'}</span><span class="live-tirs">${gagne(m, you) ? 'Victoire' : m.ot ? 'Défaite en prolongation' : 'Défaite'}${m.feuille ? ` · tirs ${tirsTotal(m.feuille, 'A')} – ${tirsTotal(m.feuille, 'B')}` : ''}</span></div>
      ${cote(m.B, m.gfB, 'b', !gagneA)}
      ${buts ? `<div class="live-buteurs">${buts}</div>` : ''}</div>`;
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
    return `<div class="hub-titre">L'affiche de la journée 1</div><div class="cal-grille">${cartes}</div>`;
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
      <table class="rl-table"><thead><tr><th>Ligne</th><th>Tactique</th><th>Tirs</th><th>Buts</th><th title="Buts de la ligne adverse du même rang">Contre</th><th title="Actions spéciales réussies">Spéc.</th><th title="Actions spéciales étouffées par la tactique adverse">Étouf.</th></tr></thead>
      <tbody>${L.map((x, u) => `<tr><td>${noms[u]}</td><td>${TACTIQUES[lignes[u].tac].ico} ${ctx.esc(TACTIQUES[lignes[u].tac].nom)}</td><td>${x.t}</td><td>${x.b}</td><td>${x.bc}</td><td>${x.s}</td><td>${x.e}</td></tr>`).join('')}</tbody></table></div>`;
  };

  const voletJournee = () => {
    if (!jour) return afficheJour1();
    const j = jour - 1, k = indexMien(j), matchs = calendrier[j];
    const mien = k >= 0 ? scoreboard({ j, k, m: matchs[k] }) + rapportLignes(matchs[k]) : `<div class="live-board hub-board"><div class="live-horloge"><span class="live-per">CONGÉ</span><span class="live-tirs">Les NHL Stars ne jouent pas aujourd'hui</span></div></div>`;
    const autres = matchs.map((m, i) => (i === k ? '' : carteMatch(m, j, i))).join('');
    const mbHier = (you.minisBoss || []).find(x => x.jour === j);
    const mbMot = mbHier ? `<div class="hub-miniboss ${mbHier.gagne ? 'gagne' : 'perdu'}">${MINI_BOSS[mbHier.raison].ico} ${mbHier.gagne ? `<b>Gros match gagné</b> : ${ELAN.ico} ${ELAN.nom} pour trois matchs, et les partisans montent` : `<b>Gros match perdu</b> : ${SONNE.ico} ${SONNE.nom} pour trois matchs, et les médias s'acharnent`}.<div class="hub-gros-detail">${motEntracte(ctx, mbHier)}</div></div>` : '';
    return `<div class="hub-titre">Journée ${jour}</div>${mbMot}${mien}
      <div class="hub-titre">Les autres matchs</div><div class="cal-grille">${autres}</div>`;
  };

  const voletClassement = () => {
    // LE CLASSEMENT COMME DANS LE JOURNAL (S30) : la fiche, les points, les
    // buts, et les deux colonnes qui disent la forme du moment — la séquence
    // en cours et les dix derniers matchs.
    const rangee = (t, i) => { const g = fiche.get(t); return `<tr class="${t === you ? 'toi' : ''}${i === enSeries - 1 ? ' cut' : ''}"><td>${i + 1}</td><td class="nom">${ctx.logo(t.tag, 14)} ${ctx.esc(ctx.teamShort(t))}</td><td>${g.W + g.L + g.OTL}</td><td>${g.W}</td><td>${g.L}</td><td>${g.OTL}</td><td class="heros">${g.PTS}</td><td>${g.GF}</td><td>${g.GA}</td><td>${g.GF - g.GA > 0 ? '+' : ''}${g.GF - g.GA}</td><td>${sequenceDe(t)}</td><td>${dixDerniers(t)}</td></tr>`; };
    return `<div class="live-tableau hub-classement"><div class="live-tableau-titre">Classement · journée ${jour} · les ${enSeries} premiers vont en séries</div>
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
        const S = SORTES_DECK[d.deck], M = d.mutation && MUTATIONS[d.mutation.cle], T = d.maitrise && TACTIQUES[d.maitrise.tac];
        const qui = d.deck === 'recrue' ? nomJoueur(d.ballottage && d.ballottage.entre) : d.mutation ? nomJoueur(d.mutation.joueur) : '';
        const t = d.deck === 'camp' && CARTES_MATCH[`${d.aiguise}+`] ? `Le camp d'entraînement : ${CARTES_MATCH[d.aiguise].ico} <b>${ctx.esc(CARTES_MATCH[`${d.aiguise}+`].nom)}</b>`
          : d.deck === 'menage' && CARTES_MATCH[d.retrait] ? `Le ménage : ${CARTES_MATCH[d.retrait].ico} <b>${ctx.esc(CARTES_MATCH[d.retrait].nom)}</b> quitte ton deck`
          : d.deck === 'recrue' ? `Recrue : <b>${ctx.esc(qui || 'un joueur')}</b> signé`
          : M ? `${M.ico} ${ctx.esc(M.nom)} pour <b>${ctx.esc(qui || 'un joueur')}</b>`
            : T ? `Stage de système : ${T.ico} <b>${ctx.esc(T.nom)}</b>` : ctx.esc(S.nom);
        ev.push({ j: d.jour, t: `${S.ico} ${t}` });
      } else if (d.carte && typeof d.palier === 'number' && CARTES[d.carte]) ev.push({ j: d.jour, t: `🎁 Le palier : ${CARTES[d.carte].ico} <b>${ctx.esc(CARTES[d.carte].nom)}</b>` });
      else if (d.ballottage) ev.push({ j: d.jour, t: '📋 Un joueur réclamé au ballottage pour boucher un trou' });
    }
    for (const m of you.mutations || []) if (m.jour < jour && m.source !== 'choix' && MUTATIONS[m.cle]) ev.push({ j: m.jour, t: `${MUTATIONS[m.cle].ico} Le hasard s'en mêle : ${ctx.esc(m.p ? m.p.n : '')} — ${ctx.esc(MUTATIONS[m.cle].nom)}` });
    for (const x of you.paris || []) if (x.jour != null && x.jour < jour) ev.push({ j: x.jour, t: `🎲 ${ctx.esc(x.titre)} — ${ctx.esc(x.choix || '')} : ${x.gagne ? '<b>le pari a payé</b>' : '<b>le pari a mal tourné</b>'}` });
    for (const mb of you.minisBoss || []) {
      if (mb.jour >= jour || !MINI_BOSS[mb.raison]) continue;
      const m = (calendrier[mb.jour] || []).find(x => x.A === you || x.B === you);
      const Av = mb.avant && AVANT_GROS[mb.avant.cle];
      const Ao = Av && Av.options.find(o => o.cle === mb.avant.choix);
      ev.push({ j: mb.jour, t: `${MINI_BOSS[mb.raison].ico} Gros match contre ${ctx.esc(ctx.teamShort(mb.adv))} (${ctx.esc(MINI_BOSS[mb.raison].nom.toLowerCase())}) — ${mb.gagne ? '<b>gagné</b>' : '<b>perdu</b>'}${m ? ` ${scoreDe(mb.jour, m)}` : ''}${Ao ? ` · avant : ${Av.ico} ${ctx.esc(Ao.nom.toLowerCase())}` : ''}${mb.cartes && mb.cartes.jouees.length ? ` · 🃏 ${mb.cartes.jouees.map(c => CARTES_MATCH[c] ? CARTES_MATCH[c].ico : '').join('')}` : ''}<small class="recit-detail">${motEntracte(ctx, mb)}</small>` });
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
  const voletFiche = () => {
    if (!miens.length) return '<div class="hub-note">Aucun match joué encore.</div>';
    const lignes = miens.slice().reverse().map(({ j, k, m }) => {
      const adv = m.A === you ? m.B : m.A;
      const pour = m.A === you ? m.gfA : m.gfB, contre = m.A === you ? m.gfB : m.gfA;
      const v = gagne(m, you);
      const somm = m.feuille ? ` data-sommaire="saison|${j}|${k}" role="button" tabindex="0" title="Le sommaire du match"` : '';
      return `<div class="hub-jeu${v ? ' v' : ' d'}"${somm}><span class="hub-jeu-n">J${j + 1}</span><span class="hub-jeu-res">${v ? 'V' : m.ot ? 'DP' : 'D'}</span><span class="hub-jeu-score">${pour}–${contre}</span>${ctx.logo(adv.tag, 15)}<span class="hub-jeu-adv">${ctx.esc(ctx.teamLabel(adv))}</span>${m.ot ? '<em>P</em>' : ''}</div>`;
    }).join('');
    const f = fiche.get(you);
    return `${recitHtml()}<div class="hub-titre">Tes ${miens.length} matchs · ${f.W}-${f.L}-${f.OTL} · ${f.GF} BP · ${f.GA} BC${sequence() ? ` · séquence ${sequence()}` : ''}</div><div class="hub-jeux">${lignes}</div>`;
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
      ficheDe: t => { const g = fiche.get(t); return `${g.W}-${g.L}-${g.OTL} · ${g.PTS} pts · ${rangDe(t)}${rangDe(t) === 1 ? 'er' : 'e'} · ${g.GF} BP · ${g.GA} BC`; },
    });
    if (cle === 'fiche') return voletFiche();
    return voletJournee();
  });
  const debrancherMenu = brancherMenu(volet, menu, () => classement(), () => tabs.rafraichir(), cle => tabs.montrer(cle), carte);

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
  const RARETE_SORTE = { effet: 'rare', recrue: 'legendaire', amelioration: 'peu', profil: 'peu', strategie: 'commune', menage: 'peu', camp: 'peu' };
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
  const joueurArt = p => artJoueur({ portraitHtml: ctx.mug ? ctx.mug(p) : '', logoHtml: ctx.logo(p.t, ctx.mug ? 24 : 60), pos: ctx.esc(POSTE_CARTE[p.p] || 'Avant'), saison: ctx.esc(p.s), club: ctx.esc(p.t) });
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
        return { cle: `amelioration:${c.cle}`, rarete, ico: M.ico, nom: M.nom, type: `${S.nom} · au joueur de ton choix`, mutation: c.cle };
      }
      if (c.sorte === 'profil') return { cle: 'profil', rarete, ico: S.ico, nom: 'Nouveau rôle', type: `${S.nom} · pour de bon`,
        texte: roles.length ? `Un de tes joueurs change de rôle pour de bon. Tu choisis lequel : ${roles.map(x => x.p.n).join(' · ')}` : '',
        desactive: roles.length ? '' : 'Personne à convertir' };
      if (c.sorte === 'camp') return { cle: 'camp', rarete, ico: S.ico, nom: 'Le camp d\'entraînement', type: `${S.nom} · ton deck de match`,
        texte: 'Une carte de ton deck de match devient sa version « + » : moitié plus forte, ou une énergie de moins.',
        desactive: deckAvant(jour).some(k => CARTES_MATCH[`${k}+`]) ? '' : 'Tout ton deck est déjà amélioré' };
      if (c.sorte === 'menage') return { cle: 'menage', rarete, ico: S.ico, nom: 'Le ménage du vestiaire', type: `${S.nom} · ton deck de match`,
        texte: `Une carte de moins dans ton deck de match (${deckAvant(jour).length} cartes) : les autres sortent plus souvent. Tu choisis laquelle.` };
      return { cle: 'strategie', rarete, ico: S.ico, nom: 'Stage de système', type: `${S.nom} · toute la formation`,
        texte: `Une semaine de pratiques sur un seul système : ta formation fait ${Math.round(GAIN_STAGE * 100)} % du chemin vers sa maîtrise d'un coup. Trois systèmes offerts.` };
    });
    ouvrirChoix({
      ico: '🎁', titre: `Le palier de la journée ${p0}`, cartes: true, genre: 'palier', fermable: true, motFermer: 'Plus tard',
      recit: 'Trois cartes, trois sortes. Touche celle que tu gardes pour le reste de la saison ; les deux autres retournent dans le jeu.',
      options,
      onChoix: cle => suiteDeLaMain(p0, cle, recrues, roles),
    });
  }
  function suiteDeLaMain(p0, cle, recrues, roles) {
    const retour = () => ouvrirMain(p0);
    const [sorte, arg] = cle.split(':');
    if (sorte === 'effet') { const j = jour, s = soirDuProchain(); quitter(); onCarte(p0, s, arg, j); return; }
    const suite = { cartes: true, genre: 'palier', fermable: true, motFermer: 'Retour au palier', onFerme: retour };
    if (sorte === 'recrue') {
      ouvrirChoix({ ...suite, ico: '🎟️', titre: 'Joueur au choix',
        recit: 'Trois vrais joueurs, style loto. Celui que tu signes prend la place de réserve de sa position ; le réserviste qui l\'occupait est libéré.',
        options: recrues.map(x => ({ cle: x.cle, rarete: 'legendaire', nom: x.nom, type: `${x.poste} · ${x.club}`, coin: x.salaire,
          art: joueurArt(x.p), texte: x.ligne, prix: x.sortNom ? `${x.sortNom} est libéré` : '' })),
        onChoix: k => { const x = recrues.find(y => y.cle === k); if (x) deciderDeck(p0, { deck: 'recrue', ballottage: { i: x.i, entre: x.cle, sort: x.sort } }); } });
      return;
    }
    if (sorte === 'amelioration') {
      const M = MUTATIONS[arg];
      const js = SLOTS.filter(sl => !sl.scratch && sl.group !== 'G').map(sl => ({ sl, p: you.roster[sl.i] })).filter(x => x.p && x.p.p !== 'G');
      ouvrirChoix({ ...suite, cartes: false, compact: true, ico: M.ico, titre: `${M.nom} : à qui ?`,
        recit: `${M.quoi} C'est pour de bon : choisis bien.`,
        contexte: `<div class="choix-puces">${puces(motsDeMutation(arg))}</div>`,
        options: js.map(({ sl, p }) => { const pr = profilPrincipal(p); return { cle: getPlayerKey(p), ico: pr ? pr.ico : '', nom: p.n, sous: `${ctx.slotShort(sl)}${pr ? ` · ${pr.nom}` : ''}` }; }),
        onChoix: k => deciderDeck(p0, { deck: 'amelioration', mutation: { cle: arg, joueur: k } }) });
      return;
    }
    if (sorte === 'profil') {
      ouvrirChoix({ ...suite, ico: '🔄', titre: 'Nouveau rôle',
        recit: 'Trois conversions possibles dans ton alignement. Le joueur change de profil pour de bon : son fit dans chaque tactique suit.',
        options: roles.map(x => ({ cle: `${x.cle}|${getPlayerKey(x.p)}`, rarete: 'peu', ico: MUTATIONS[x.cle].ico, nom: MUTATIONS[x.cle].nom, type: x.p.n,
          art: joueurArt(x.p), mutation: x.cle })),
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
      const maitrise = tac => (app ? dresses.reduce((a, p) => a + ((app.maitrise(p) || {})[tac] || 0), 0) / (dresses.length || 1) : 0);
      const NOMS = ['1re', '2e', '3e', '4e'];
      ouvrirChoix({ ...suite, ico: '📘', titre: 'Stage de système',
        recit: `Toute ta formation apprend le système choisi : ${Math.round(GAIN_STAGE * 100)} % du chemin vers la maîtrise, d'un coup. La chimie de chaque ligne qui le joue monte avec.`,
        options: tactiquesDuStage(graine, p0).map(tac => {
          const T = TACTIQUES[tac];
          const fits = [0, 1, 2, 3].map(u => fitLigne(you.roster, u, tac));
          const meilleure = fits.indexOf(Math.max(...fits));
          return { cle: tac, rarete: 'commune', ico: T.ico, nom: T.nom, type: 'Stage de système',
            texte: `${T.mot} Ta formation ${connait(maitrise(tac))}.`,
            mots: [{ txt: `Taillé pour ta ${NOMS[meilleure]} ligne`, bon: fits[meilleure] >= 55 }] };
        }),
        onChoix: tac => deciderDeck(p0, { deck: 'strategie', maitrise: { tac, gain: GAIN_STAGE } }) });
    }
  }

  function dessiner() {
    const f = fiche.get(you);
    const rang = rangDe(you);
    const seq = sequence();
    head.innerHTML = `<span class="live-ronde">${epoque ? `Saison ${ctx.esc(epoque)}` : 'Saison régulière'}</span>
      <span class="live-match">Journée ${jour} / ${N}</span>
      <span class="live-serie">${jour ? `${f.W}-${f.L}-${f.OTL} · ${f.PTS} pts · ${rang}${rang === 1 ? 'er' : 'e'}${seq ? ` · ${seq}` : ''}` : 'La saison commence'}</span>`;

    const p = prochain();
    if (jour >= N) {
      carte.innerHTML = `<div class="live-bilan ${rang <= enSeries ? 'gagne' : 'perdu'}"><div class="live-bilan-titre">Saison terminée · ${f.W}-${f.L}-${f.OTL} · ${rang}${rang === 1 ? 'er' : 'e'} de ${teams.length}${rang <= enSeries ? ' · en séries' : ' · éliminé'}</div></div>`;
      // Une main de palier encore ouverte (on a passé à la fin) : elle vaut encore
      // pour les séries — les cartes de saison y jouent — donc elle s'offre ici.
      const palFin = palierOuvert();
      actions.innerHTML = `${palFin !== undefined ? '<button class="btn hub-main-ouvrir">🎁 Le palier t\'attend : trois cartes</button>' : ''}<button class="btn gold hub-suite">Voir le bilan de la saison</button>`;
      actions.querySelector('.hub-suite').onclick = fermer;
      const vm = actions.querySelector('.hub-main-ouvrir');
      if (vm) vm.onclick = () => ouvrirMain(palFin);
      if (palFin !== undefined && !palProposes.has(palFin) && !choixOuvert()) { palProposes.add(palFin); ouvrirMain(palFin); }
      return;
    }
    if (p) {
      const adv = p.m.A === you ? p.m.B : p.m.A;
      const fa = t => (jour ? `${ficheTexte(t)} · ${rangDe(t)}${rangDe(t) === 1 ? 'er' : 'e'}` : ctx.esc(t.season ? `saison ${t.season}` : ''));
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
      const miniBoss = mb && MINI_BOSS[mb.raison] ? `<div class="hub-gros">
        <div class="hub-gros-tete">${MINI_BOSS[mb.raison].ico} <b>Match important · ${ctx.esc(MINI_BOSS[mb.raison].nom)}</b> — ${ctx.esc(MINI_BOSS[mb.raison].mot)}</div>
        ${onDecision ? planAdverseHtml(mb.plan, mb.contre, { nomAdv: ctx.teamShort(adv) }) + mainAdverseHtml(mainAdverse(graine, `j${p.j}`), { nomAdv: ctx.teamShort(adv) }) : ''}
        ${Ao ? `<div class="hub-gros-avant">${Av.ico} ${ctx.esc(Av.titre)} : <b>${ctx.esc(Ao.nom)}</b></div>` : ''}
        <div class="choix-puces">${puces([{ txt: `Victoire : ${ELAN.ico} ${ELAN.nom}, finition ↑ · 3 matchs`, bon: true }, { txt: `Défaite : ${SONNE.ico} ${SONNE.nom}, finition ↓ · 3 matchs`, bon: false }])}</div>
        ${onDecision ? '<div class="hub-gros-note">🎬 Au deuxième entracte, un choix t\'attend.</div>' : ''}
      </div>` : '';
      // CE QUI JOUE SUR TA FORMATION (S72), en une ligne ; le détail est dans « Préparer le match ».
      const ecJ = effetsEnCours(you, p.j);
      const enJeu = [...ecJ.effets.filter(e => e.nom).map(e => `${e.ico || '✨'} ${e.nom}`), ...ecJ.absents.map(a => `👥 ${a.p.n} au vestiaire`), ...(ecJ.gardienAux ? ['🧤 l\'auxiliaire au filet'] : [])];
      const enJeuHtml = onDecision && enJeu.length ? `<div class="hub-encours" title="Le détail est dans « Préparer le match »">En cours : ${enJeu.map(x => ctx.esc(x)).join(' · ')}</div>` : '';
      carte.innerHTML = `${routeHtml(jour, N)}${enJeuHtml}${miniBoss}<div class="hub-match">
        <div class="hub-match-titre">Prochain match · Journée ${p.j + 1} <span class="hub-lieu" title="L'équipe à domicile a le dernier changement : son appariement de trios tient mieux.">${domicile ? 'à domicile' : `chez ${ctx.esc(ctx.teamShort(adv))}`}</span></div>
        <div class="hub-face">${blocEquipe(ctx, p.m.A, fa(p.m.A), 'a')}<div class="hub-vs">VS</div>${blocEquipe(ctx, p.m.B, fa(p.m.B), 'b')}</div>
        <div class="hub-match-note">${dernierMot}</div>
        ${soirEreintant(p.j) ? '<div class="hub-match-note hub-ereintant" title="Un match sur quatre est éreintant : la finition de chaque club suit l\'écart de robustesse entre les deux. Derrière le banc, tu peux habiller tes joueurs les plus robustes.">🥵 Soir éreintant — la robustesse pèse ce soir</div>' : ''}
        ${planSoir}
      </div>`;
      const prep = carte.querySelector('.hub-preparer');
      if (prep) prep.onclick = () => ouvrirLignes({
        titre: 'Préparer le match', sousTitre: `Journée ${p.j + 1} · ${domicile ? 'contre' : 'chez'} ${ctx.teamShort(adv)}`,
        lineup: you.roster, lignes: lignesToi, chimie: etat.chimie, energie: etat.energie, apprentissage: etat.apprentissage,
        adv: { nom: ctx.teamShort(adv), lignes: lignesDe(adv, adv.roster) },
        plan: mb ? mb.plan : null,
        effets: { ...effetsEnCours(you, p.j), cartes: decs.filter(d => d.carte && d.jour <= p.j).map(d => d.carte) },
        match: (matchPris && matchPris.match) || { importance: mb ? 'haute' : 'normale', ad: 0 },
        motAppliquer: 'Appliquer — la saison reprend ici',
        onBanc: onBanc ? () => { quitter(); onBanc(jour); } : null,
        onAppliquer: (lignes, match) => { const j = jour; quitter(); onDecision({ jour: p.j, lignes, match }, j); },
      });
    } else {
      carte.innerHTML = `<div class="hub-match"><div class="hub-match-titre">Congé</div><div class="hub-match-note">Les NHL Stars ne jouent plus d'ici la fin de la saison.</div></div>`;
    }
    // DEUX RANGÉES, PAS QUATRE (S30) : « Journée suivante » en grand, et les
    // quatre autres en une rangée compacte — le direct, le banc, dix
    // journées, la fin. Sur téléphone, les cinq boutons prenaient 280 px.
    // LE MOMENT DE LA BLESSURE : il prend la tête des actions, parce que
    // c'est ce qu'il faut lire et décider maintenant. Il ne bloque rien —
    // « Journée suivante » reste dessous, et ne rien faire est un choix.
    // LE PALIER : une main de trois cartes, une à garder. Il passe AVANT la
    // blessure — c'est le choix qui engage le reste de la saison. La main se
    // joue en plein écran (S73) ; ici, le dos des trois cartes et de quoi la
    // rouvrir, tant qu'on n'en a pas pris une.
    const pal = palierOuvert();
    const cartes = pal === undefined ? '' : `<div class="hub-cartes hub-main" role="group" aria-label="Une main de trois cartes">
      <div class="hub-cartes-tete">🎁 Le palier de la journée ${pal} · trois cartes</div>
      <div class="hub-dos-rang">${mainDuDeck(graine, pal, dejaPrises).map(c => `<span class="hub-dos tc-${RARETE_SORTE[c.sorte]}" data-sorte="${c.sorte}" title="${ctx.esc(SORTES_DECK[c.sorte].nom)}">${SORTES_DECK[c.sorte].ico}</span>`).join('')}</div>
      <button type="button" class="btn gold hub-main-ouvrir">Voir les cartes</button>
      <div class="hub-cartes-note">Tu en gardes une pour le reste de la saison. Rien ne presse : l'offre tient jusqu'à la fin.</div>
    </div>`;
    /*
     * LA CASE VIDE passe AVANT le palier : c'est la seule des quatre
     * interruptions qui parle d'un match qu'on ne peut pas aligner. La carte
     * est déjà tirée — on ne choisit pas — et le bouton ne fait que
     * l'encaisser, parce qu'une décision doit être VUE avant d'être écrite.
     */
    const cTrou = trou ? carteDuTrou(trou) : null;
    /*
     * `.hub-tiree` ET NON `.hub-pige` : `.hub-pige` veut dire « une carte
     * qu'on peut PRENDRE », et c'est ce que `smoke.mjs` compte pour vérifier
     * qu'un palier en offre trois. La carte du trou l'a portée un temps, et
     * la cascade a été exacte : la boucle qui avance jusqu'au palier s'est
     * arrêtée sur elle, a lu « un palier qui offre une carte au lieu de
     * trois », a sauté tout le bloc du palier — et les clics suivants ont
     * dépassé la case vide, que le garde-fou d'après n'a donc plus trouvée.
     * Un défaut, deux garde-fous muets. C'est la leçon de `.hub-carte`
     * (S54), et elle vaut dans l'autre sens : un nom de classe dit ce que la
     * chose EST, et une carte qu'on ne choisit pas n'est pas une pige.
     */
    const vide = trou && cTrou && onTrou ? `<div class="hub-trou" role="status">
      <div class="hub-trou-tete">🕳️ ${ctx.esc(nomsDesCases(trou.cases))}</div>
      <div class="hub-trou-note">Aucun réserviste ne pouvait prendre la place. Le vestiaire s'ajuste comme il peut — tu ne choisis pas celle-là.</div>
      <div class="hub-tiree">
        <span class="hub-tiree-nom">${CARTES[cTrou].ico} ${ctx.esc(CARTES[cTrou].nom)}</span>
        <span class="hub-tiree-bon">+ ${ctx.esc(CARTES[cTrou].bon)}</span>
        <span class="hub-tiree-prix">− ${ctx.esc(CARTES[cTrou].prix)}</span>
      </div>
      <button class="btn gold hub-trou-prendre" data-trou="${trou.at}">Compris</button>
    </div>` : '';
    /*
     * LES SITUATIONS. Deux hommes nommés, rien à cliquer : la réponse est
     * l'alignement. On met le PORTÉ en premier parce que c'est lui qui appelle
     * une décision — monter un joueur qu'on n'aurait pas monté.
     */
    const situ = situation ? `<div class="hub-situ" role="status">
      <div class="hub-situ-tete">Dans le vestiaire</div>
      <div class="hub-situ-rang">${[['porte', situation.porte], ['pese', situation.pese]].map(([sens, b]) => {
        const c = SITUATIONS[b.cle];
        return `<div class="hub-situ-bout hub-situ-${sens}">
          <span class="hub-situ-nom">${c.ico} ${ctx.esc(b.p.n)}</span>
          <span class="hub-situ-quoi">${ctx.esc(c.nom)} — ${ctx.esc(c.quoi.toLowerCase())}</span>
          <span class="hub-situ-mot">${ctx.esc(c.mot)}</span>
        </div>`;
      }).join('')}</div>
      ${onBanc ? `<button class="btn hub-situ-banc">Revoir mon alignement</button>` : ''}
    </div>` : '';
    /*
     * LE BALLOTTAGE (S66) : sous l'alerte, trois vrais joueurs pas chers de la
     * même position. En réclamer un est une décision ; ne rien faire aussi.
     */
    const palierB = alerte ? `b:${alerte.at}:${getPlayerKey(alerte.player)}` : null;
    const bal = alerte && onDecision && ctx.ballottage && !pris.has(palierB) ? ctx.ballottage(alerte.player, alerte.at) : null;
    const ballottage = bal && bal.candidats.length ? `<div class="hub-ballottage">
      <button type="button" class="btn hub-ballottage-ouvrir">📋 Au ballottage : ${bal.candidats.length} joueurs${bal.sortNom ? ` · ${ctx.esc(bal.sortNom)} serait libéré` : ''}</button>
    </div>` : '';
    const bless = alerte ? `<div class="hub-alerte" role="status">
      <div class="hub-alerte-tete">🚑 ${ctx.esc(alerte.player.n)} est blessé</div>
      <div class="hub-alerte-note">${alerte.games} match${alerte.games > 1 ? 's' : ''} d'absence · ${ctx.esc(caseDe(alerte.player))} · ${ctx.esc(remplacant(alerte.player))}</div>
      ${ballottage}
      ${onBanc ? `<button class="btn gold hub-alerte-banc">Derrière le banc</button>` : ''}
    </div>` : '';
    /*
     * LES CHOIX FORCÉS (S66), un à la fois et dans cet ordre : le verdict du
     * proprio (il clôt ce qui était promis), le nouvel objectif, la séquence
     * (elle parle des derniers matchs) puis le dilemme. EN PLEIN ÉCRAN depuis
     * S68 (JP : *décisions dans modals plein écran, tout devrait être clair*) :
     * chaque option dit en chiffres ce qu'elle achète, ce qu'elle coûte,
     * pendant combien de matchs, et quelles factions elle bouge.
     */
    const vo = verdictObjectif(), oo = vo ? null : offreObjectif();
    const sq = vo || oo ? null : sequenceOuverte();
    const dl = vo || oo || sq ? null : dilemmeOuvert();
    const rc = vo || oo || sq || dl ? null : recompenseOuverte();
    const av = vo || oo || sq || dl || rc ? null : avantOuvert();
    const mo = vo || oo || sq || dl || av || rc ? null : mainOuverte();
    // Chaque choix est une décision : elle entre dans la liste, et la saison
    // se rejoue depuis aujourd'hui, avec des dés neufs.
    const decider = d => { quitter(); onDecision({ jour, ...d }, jour); };
    let spec = null;
    if (vo) {
      const o = OBJECTIFS[vo.d.objectif.cle];
      spec = vo.e.reussi
        ? { ico: '🏢', titre: `Objectif atteint : ${o.court}`,
          recit: `Le proprio est ravi (${o.ico} ${vo.e.val} ${o.unite}). Il t'offre de quoi renforcer le club : pige une carte. Elle vaut pour le reste de la saison.`,
          options: mainDeCartes(graine, 2000 + vo.j0, dejaPrises).map(cle => ({ cle, ico: CARTES[cle].ico, nom: CARTES[cle].nom, bon: CARTES[cle].bon, prix: CARTES[cle].prix, effet: CARTES[cle] })),
          onChoix: cle => decider({ palier: `v:${vo.j0}`, carte: cle }) }
        : { ico: '🏢', titre: `Objectif raté : ${o.court}`,
          recit: `${o.ico} ${vo.e.val} ${o.unite}, pour ${o.cible} promis. Le proprio te fait venir dans son bureau.`,
          options: [{ cle: 'encaisser', nom: 'Encaisser', prix: 'Le proprio coupe les vols nolisés : les voyages fatiguent', energie: OBJECTIF_RATE.energie, duree: OBJECTIF_RATE.duree }],
          onChoix: () => decider({ palier: `v:${vo.j0}`, effet: { ...OBJECTIF_RATE } }) };
    } else if (oo) {
      spec = { ico: '🏢', titre: oo.j0 ? 'Le proprio veut une deuxième moitié' : 'Le proprio fixe ses attentes',
        recit: `Choisis un défi pour tes ${MATCHS_OBJECTIF} prochains matchs.`,
        options: oo.offerts.map(cle => ({ cle, ico: OBJECTIFS[cle].ico, nom: OBJECTIFS[cle].nom,
          bon: 'Réussi : tu piges une carte de plus', prix: 'Raté : le proprio serre la vis' })),
        contexte: `<div class="choix-puces"><span class="puce bon">Réussi : 🃏 une carte</span><span class="puce prix">Raté : les voyages fatiguent ↑ · ${OBJECTIF_RATE.duree} matchs</span></div>`,
        onChoix: cle => decider({ palier: `o:${oo.j0}`, objectif: { cle, debut: jour } }) };
    } else if (sq) {
      const s = SEQUENCES[sq.cle];
      spec = { ico: s.ico, titre: s.titre, recit: s.recit,
        options: s.options.map(o => ({ ...o, duree: dureeOption(o, 'sequence') })),
        onChoix: cle => decider({ palier: sq.palier, moment: { famille: 'sequence', cle: sq.cle, choix: cle } }) };
    } else if (dl) {
      const m = MOMENTS[dl.cle];
      // LE JOUEUR VISÉ est nommé avant le choix : c'est lui dont la carte change.
      const optMut = m.options.find(o => o.mutation);
      const cible = optMut ? cibleMutation(you, optMut.mutation) : null;
      // LES JOUEURS QU'UN GESTE TOUCHE (S72) : nommés avant le choix.
      const cibles = m.cible ? ciblesDe(you, m.cible, graine, dl.J) : [];
      spec = { ico: m.ico, titre: m.titre, irl: m.irl, recit: m.recit, joueur: cible, joueurs: cibles,
        options: m.options.map(o => ({ ...o, duree: o.mutation || o.rien ? null : dureeOption(o, 'moment'),
          desactive: (o.mutation && !cible) || (m.cible && !cibles.length && o.action) ? 'Personne dans ton alignement pour ça' : null })),
        onChoix: cle => decider({ palier: `m:${dl.J}`, moment: { famille: 'moment', cle: dl.cle, choix: cle, joueur: cible ? getPlayerKey(cible) : null, joueurs: cibles.map(getPlayerKey) } }) };
    } else if (av) {
      // L'AVANT-MATCH (S70) : daté du soir du match, pas d'aujourd'hui.
      const A = AVANT_GROS[av.cle], advG = av.mb.adv;
      const ciblesA = A.cible ? ciblesDe(you, A.cible, graine, av.p.j) : [];
      spec = { ico: A.ico, titre: A.titre, irl: A.irl, joueurs: ciblesA,
        recit: `Avant le gros match contre ${ctx.teamLabel(advG)}. ${A.recit}`,
        contexte: planAdverseHtml(av.mb.plan, av.mb.contre, { nomAdv: ctx.teamShort(advG) }),
        options: A.options.map(o => ({ ...o, duree: 1 })),
        onChoix: cle => { const j = jour; quitter(); onDecision({ jour: av.p.j, avant: { cle: av.cle, choix: cle, joueurs: ciblesA.map(getPlayerKey) } }, j); } };
    } else if (rc) {
      // LA RÉCOMPENSE D'UNE VICTOIRE (S74) : une carte parmi trois, ou passer.
      spec = { ico: '🎁', titre: 'Récompense', cartes: true, genre: 'recompense', fermable: true, motFermer: 'Passer',
        recit: `Victoire dans le gros match contre ${ctx.teamLabel(rc.adv)} ! Touche une carte pour l'ajouter à ton deck — ou passe : un deck mince pige plus souvent ses meilleures cartes.`,
        options: recompensesOffertes(graine, `r${rc.jour}`).map(optionDeCarteMatch),
        onChoix: k => { const j = jour, s = soirDuProchain(); quitter(); onDecision({ jour: s, palier: `r:${rc.jour}`, recompense: k }, j); },
        onFerme: () => { const j = jour, s = soirDuProchain(); quitter(); onDecision({ jour: s, palier: `r:${rc.jour}`, recompense: null }, j); } };
    } else if (mo) {
      spec = { ico: '🃏', titre: 'Ta main pour le gros match', ouvrir: () => ouvrirMainGros(mo) };
    }
    if (spec && !choixOuvert()) { if (spec.ouvrir) spec.ouvrir(); else ouvrirChoix(spec); }
    else if (!spec && pal !== undefined && !palProposes.has(pal) && !choixOuvert()) { palProposes.add(pal); ouvrirMain(pal); }
    const force = spec ? `<button type="button" class="btn gold hub-choix-rouvrir">⏳ Un choix t'attend : ${ctx.esc(String(spec.titre).replace(/\{nom\}/g, spec.joueur ? spec.joueur.n : (spec.joueurs && spec.joueurs[0] ? spec.joueurs[0].n : '')))}</button>` : '';
    // L'objectif en cours se lit sous le match : où on en est, ce qui manque.
    const enCours = objectifEnCours();
    const suivi = enCours && !enCours.e.fini ? `<div class="hub-objectif" title="${ctx.esc(OBJECTIFS[enCours.d.objectif.cle].nom)}">🏢 Le proprio veut <b>${ctx.esc(OBJECTIFS[enCours.d.objectif.cle].court)}</b> · tu en es à <b>${enCours.e.val}</b> ${ctx.esc(OBJECTIFS[enCours.d.objectif.cle].unite)}, ${enCours.e.joues} match${enCours.e.joues > 1 ? 's' : ''} sur ${MATCHS_OBJECTIF}</div>` : '';
    const acc = accident && MUTATIONS[accident.cle] ? `<div class="hub-situ hub-accident" role="status">
      <div class="hub-situ-tete">${MUTATIONS[accident.cle].ico} Sa carte change : ${ctx.esc(accident.p.n)}</div>
      <div class="hub-situ-quoi">${ctx.esc(MUTATIONS[accident.cle].nom)} — ${ctx.esc(MUTATIONS[accident.cle].quoi)}</div>
      <div class="choix-puces">${puces(motsDeMutation(accident.cle))}</div>
    </div>` : '';
    actions.innerHTML = `${force}${vide}${cartes}${acc}${situ}${bless}${suivi}${force ? '' : '<button class="btn go hub-jour" title="Une journée de plus : tous les résultats, le classement du jour">Journée suivante</button>'}
      <div class="hub-actions-rang">
      ${p && !force ? `<button class="btn gold hub-regarder" title="Le prochain match de ta formation, lancer par lancer">Regarder</button>` : ''}
      ${onBanc && p ? `<button class="btn hub-banc" title="Changer tes trios, tes paires, ton gardien, désigner ton trio de fermeture — avec les fiches à ce jour. La saison reprend de là.">Le banc</button>` : ''}
      ${force ? '' : '<button class="btn hub-dix" title="Dix journées d\'un coup">+10 jours</button>'}
      <button class="btn hub-fin" title="Jouer le reste de la saison et lire le résultat">Fin de saison</button>
      ${onDecision ? `<button class="btn hub-deck" title="Tes cartes de match : tu en piges cinq avant chaque gros match">🃏 Deck · ${deckAvant(jour).length}</button>` : ''}
      </div>`;
    const voirDeck = actions.querySelector('.hub-deck');
    if (voirDeck) voirDeck.onclick = () => ouvrirDeck({ deck: deckAvant(jour) });
    const rouvrir = actions.querySelector('.hub-choix-rouvrir');
    if (rouvrir) rouvrir.onclick = () => (spec.ouvrir ? spec.ouvrir() : ouvrirChoix(spec));
    // LE BALLOTTAGE, en plein écran lui aussi : trois joueurs, ou garder son réserviste.
    const voirBal = actions.querySelector('.hub-ballottage-ouvrir');
    if (voirBal) voirBal.onclick = () => ouvrirChoix({
      ico: '📋', titre: 'Au ballottage', fermable: true, motFermer: 'Garder mon réserviste',
      recit: `${alerte.player.n} est absent ${alerte.games} matchs. Trois joueurs pas chers de sa position sont disponibles${bal.sortNom ? ` ; en réclamer un libère ${bal.sortNom}` : ''}. Le plafond compte toujours.`,
      options: [...bal.candidats.map(c => ({ cle: c.cle, nom: `${c.pos} · ${c.nom}`, bon: c.ligne, prix: `${c.club} · ${c.salaire}` })),
        { cle: 'rien', nom: 'Garder mon réserviste', bon: 'Rien ne change', prix: 'Personne de neuf' }],
      onChoix: cle => { if (cle !== 'rien') decider({ palier: palierB, ballottage: { i: bal.i, entre: cle, sort: bal.sort } }); },
    });
    const regarder = actions.querySelector('.hub-regarder');
    if (regarder) regarder.onclick = () => regarderProchain();
    const banc = actions.querySelector('.hub-banc');
    if (banc) banc.onclick = () => { quitter(); onBanc(jour); };
    const alBanc = actions.querySelector('.hub-alerte-banc');
    if (alBanc) alBanc.onclick = () => { quitter(); onBanc(jour); };
    const sitBanc = actions.querySelector('.hub-situ-banc');
    if (sitBanc) sitBanc.onclick = () => { quitter(); onBanc(jour); };
    const prendre = actions.querySelector('.hub-trou-prendre');
    if (prendre) prendre.onclick = () => { const t = trou, j = jour; quitter(); onTrou(t.at, j, carteDuTrou(t)); };
    // Le palier ET la journée courante : la carte vaut à partir de MAINTENANT.
    const voirMain = actions.querySelector('.hub-main-ouvrir');
    if (voirMain) voirMain.onclick = () => ouvrirMain(pal);
    boutonFlottant(actions, termine);
    const bj = actions.querySelector('.hub-jour'), bd = actions.querySelector('.hub-dix');
    if (bj) bj.onclick = () => { avancer(1, true); dessiner(); tabs.suivre('journee'); if (entracteDemande) ouvrirEntracte(); };
    if (bd) bd.onclick = () => { avancer(10, true); dessiner(); tabs.suivre('journee'); if (entracteDemande) ouvrirEntracte(); };
    // « La fin » ne s'arrête pas : qui demande la fin demande la fin.
    actions.querySelector('.hub-fin').onclick = () => { avancer(N); dessiner(); tabs.suivre('journee'); };
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
      ${planAdverseHtml(mb.plan, mb.contre, { nomAdv: ctx.teamShort(adv) })}
    </div>`;
    ouvrirChoix({
      ico: '🎬', titre: `Deuxième entracte · ${moi}–${lui}`,
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
    while (jour < p.j) appliquerJour(jour++);
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
   * ✕ : le reste de la saison se joue, et on passe au bilan — APRÈS une
   * question (S74). Un kid qui touche ✕ pour « fermer » sautait du jour 40 au
   * bilan et perdait ses paliers et ses gros matchs.
   */
  ui.close.onclick = () => {
    if (jour >= N) { fermer(); return; }
    ouvrirChoix({
      ico: '⏩', titre: 'Jouer le reste de la saison ?', genre: 'confirmer', fermable: true, motFermer: 'Rester',
      recit: `Il reste ${N - jour} journées. Tout se joue d'un coup, et tu passes au bilan.`,
      options: [
        { cle: 'fin', ico: '⏩', nom: 'Oui, jusqu\'au bilan', bon: 'Tout se joue d\'un coup', prix: 'Les paliers et les gros matchs d\'ici là passent sans toi' },
        { cle: 'rester', ico: '🏒', nom: 'Non, je reste', bon: 'On continue journée par journée' },
      ],
      onChoix: k => { if (k === 'fin') { avancer(N); fermer(); } },
    });
  };
  ui.close.setAttribute('aria-label', 'Passer au bilan de la saison');
  ui.close.title = 'Jouer le reste de la saison et passer au bilan';
  // Entrée ou la barre d'espace : la journée suivante, sans viser le bouton.
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
  tabs.montrer('journee');
  // LA TROISIÈME PÉRIODE (S70) : le choix de l'entracte vient d'être pris.
  if (suiteEntracte) {
    const se = suiteEntracte, p = prochain();
    suiteEntracte = null;
    if (p && p.j === se.j && !entracteAttendu(p.j)) {
      if (se.direct) regarderProchain(40);
      else { avancer(1, true); dessiner(); tabs.suivre('journee'); }
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
export function ouvrirSeries({ series, rondes, you, saison = null, ctx, onTermine, depuis = null, onRevele = null, graine = 0, decisions = [], onDecision = null, onBanc = null, decisionsSaison = [] }) {
  const ui = coquille('Les séries');
  if (!ui || !series.length) { onTermine(); return; }
  const { modal, head, carte, actions, barre, volet } = ui;
  const nRondes = Math.max(...series.map(s => s.ronde)) + 1;
  const deRonde = r => series.filter(s => s.ronde === r).sort((a, b) => a.i - b.i);
  // Ce qui est révélé : le nombre de matchs qu'on a vus de chaque série.
  // Une reprise repart d'où elle s'était arrêtée ; `Math.min` borne un état
  // sauvegardé par une version qui jouait des séries plus longues.
  const vus = (depuis && depuis.revele) || [];
  const revele = new Map(series.map(s => [s, Math.min(Math.max(0, vus[s.i] || 0), s.feuilles.length)]));
  const complete = s => revele.get(s) >= s.feuilles.length;
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
  const matchSuivant = () => { for (const s of deRonde(ronde)) if (!complete(s)) revele.set(s, revele.get(s) + 1); };
  const finirRonde = () => { for (const s of deRonde(ronde)) revele.set(s, s.feuilles.length); };
  const toutReveler = () => { for (const s of series) revele.set(s, s.feuilles.length); ronde = nRondes - 1; };
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
        <div class="boss-lignes">${lb.map((l, u) => { const T = TACTIQUES[l.tac], c = contreDe(l.tac); return `<span title="Sa ${u + 1}${u ? 'e' : 're'} ligne : ${ctx.esc(T.nom)}${c ? ` — étouffée par ${ctx.esc(TACTIQUES[c].nom)}` : ''}">${u + 1}. ${T.ico} ${ctx.esc(T.nom)}${c ? ` <small>↪ ${TACTIQUES[c].ico}</small>` : ''}</span>`; }).join('')}</div>
        ${ved ? `<div>⭐ Sa vedette : <b>${ctx.esc(ved.n)}</b> · ${ved.simPTS || 0} pts en saison</div>` : ''}
        ${gar ? `<div>🥅 Son gardien : <b>${ctx.esc(gar.n)}</b>${gar.simSA ? ` · ${((gar.simSV || 0) / gar.simSA).toFixed(3).replace(/^0/, '')} en saison` : ''}</div>` : ''}
      </div>
      ${planDuMatch(s) ? planAdverseHtml(planDuMatch(s).plan, planDuMatch(s).contre, { nomAdv: ctx.teamShort(boss), suite: suiteDuPlan(s) }) : ''}
      ${onDecision ? mainAdverseHtml(mainAdverse(graine, `po${ronde}:${revele.get(s)}`), { nomAdv: ctx.teamShort(boss) }) : ''}
      <div class="hub-lignes"><span class="gl-k">Tes lignes</span> ${resumeLignes(lt, chim)}</div>
    </div>`;
  }
  /*
   * LE PLAN DE L'ADVERSAIRE EN SÉRIES (S70) : celui du match qui vient. Il
   * garde le plan qui a gagné et en change après une défaite — c'est ce que
   * le rapport d'éclaireur raconte, pour qu'on cherche le contre.
   */
  const planDuMatch = s => (s && s.plans && !complete(s) ? s.plans[revele.get(s)] || null : null);
  const suiteDuPlan = s => {
    const k = revele.get(s), pl = s.plans || [];
    if (!k || !pl[k] || !pl[k - 1]) return 'au premier match';
    const P = PLANS_ADV[pl[k - 1].plan];
    return pl[k].plan === pl[k - 1].plan ? 'ils le gardent : il a marché au dernier match' : `ils changent : ${P ? P.nom.toLowerCase() : 'leur plan'} n'a pas marché`;
  };
  const entracteSerieAttendu = s => {
    if (!onDecision || !s || complete(s)) return false;
    const k = revele.get(s);
    return !!(s.plans && s.plans[k] && s.feuilles[k] && s.feuilles[k].entracte)
      && !decsSerie.some(d => d.ronde === ronde && d.match_no === k && d.entracte);
  };
  /* LE DEUXIÈME ENTRACTE D'UN MATCH DE SÉRIES (S70), comme en saison. */
  function ouvrirEntracteSerie(direct = false) {
    const s = maSerie(ronde);
    if (!entracteSerieAttendu(s) || termine) return;
    const k = revele.get(s), f = s.feuilles[k], e = f.entracte, pl = s.plans[k];
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
      ${planAdverseHtml(pl.plan, pl.contre, { nomAdv: ctx.teamShort(boss) })}
    </div>`;
    ouvrirChoix({
      ico: '🎬', titre: `Deuxième entracte · ${moi}–${lui}`,
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
  const deckDeSerie = () => deckDe(decisionsSaison, { serie: decsSerie, ronde,
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
      energie: (you.jourLignes && you.jourLignes[you.jourLignes.length - 1] || {}).energie || {},
      adv: { nom: ctx.teamShort(boss), lignes: lignesDe(boss, boss.roster) },
      plan: planDuMatch(s) ? planDuMatch(s).plan : null, planSuite: suiteDuPlan(s),
      match: (decsSerie.find(d => d.ronde === ronde && d.match_no === k && d.match) || {}).match || { importance: 'haute', ad: 0 },
      motAppliquer: `Appliquer — le match ${k + 1} se joue comme ça`,
      onBanc: onBanc ? () => quitterPour(r => onBanc(r, k)) : null,
      onAppliquer: (lignes, match) => quitterPour(r => onDecision({ ronde: r, match_no: k, lignes, match })),
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
      ouvrirMainDeMatch({
        titre: dejaAjuste ? 'Ta main' : `Entre deux matchs · ${moi}-${lui}`,
        sousTitre: `${nomRondeCourt(ronde)} · match ${k + 1} · contre ${ctx.teamShort(boss)} · série ${moi}-${lui}`,
        recit: dejaAjuste ? 'Cinq cartes, trois d\'énergie. Ce que tu joues vaut pour ce match de la série.'
          : `${resultatPrecedent(s, k)}${etat === 'derriere' ? 'Ta formation tire de l\'arrière.' : etat === 'devant' ? 'Ta formation mène la série.' : 'La série est à égalité.'} Choisis ton ajustement, puis joue tes cartes.`,
        contexte: (pl ? planReplie(planAdverseHtml(pl.plan, pl.contre, { nomAdv: ctx.teamShort(boss) }), `${PLANS_ADV[pl.plan] ? PLANS_ADV[pl.plan].ico : '📋'} Leur plan : <b>${ctx.esc(PLANS_ADV[pl.plan] ? PLANS_ADV[pl.plan].nom : '')}</b> · ${pl.contre ? '✓ contré' : '✗ pas contré'}`) : '') + mainAdverseHtml(mainAdverse(graine, `po${ronde}:${k}`), { nomAdv: ctx.teamShort(boss) }),
        ajustements: dejaAjuste ? null : ajustementsOfferts(graine, ronde, k, etat).map(c => ({ cle: c, ...AJUSTEMENTS[c] })),
        equipe: you, main, pioche, deck,
        onJouer: (jouees, enMain, ajustement) => quitterPour(r => onDecision({ ronde: r, match_no: k, ...(ajustement ? { ajustement } : {}), main: { jouees, enMain } })),
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
      return `<div class="hub-note">${r >= 0 ? `Ta formation est tombée au ${nomRonde(r).toLowerCase()}. La ronde se joue sans elle.` : 'Ta formation ne joue pas cette ronde.'}</div>`;
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
    const enfants = s => {
      if (s.ronde === 0) return [];
      const prev = deRonde(s.ronde - 1), j = deRonde(s.ronde).indexOf(s);
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
    const finale = deRonde(nRondes - 1)[0];
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
    const s = maSerie(ronde);
    const finale = deRonde(nRondes - 1)[0];
    const toutFini = ronde === nRondes - 1 && rondeComplete(ronde);
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
      } else carte.innerHTML = carteSerie(s, true) + bossHtml(s);
    } else {
      const r = elimination();
      carte.innerHTML = `<div class="hub-match"><div class="hub-match-titre">${ctx.esc(nomRonde(ronde))}</div><div class="hub-match-note">${r >= 0 ? `Ta formation est tombée au ${ctx.esc(nomRonde(r).toLowerCase())}. ` : ''}${deRonde(ronde).length} série${deRonde(ronde).length > 1 ? 's' : ''} : ${rondeComplete(ronde) ? 'la ronde est finie.' : 'la ronde se joue.'}</div></div>`;
    }

    const boutons = [];
    if (s && !complete(s)) boutons.push(`<button class="btn gold hub-regarder" title="Le prochain match de ta série, lancer par lancer">Regarder le match ${revele.get(s) + 1}</button>`);
    if (!rondeComplete(ronde)) {
      boutons.push(`<button class="btn go hub-jour" title="Un match de plus dans chaque série de la ronde">Match suivant</button>`);
      boutons.push(`<button class="btn hub-ronde" title="Jouer la ronde jusqu'au bout">Finir la ronde</button>`);
    } else if (ronde + 1 < nRondes) {
      boutons.push(`<button class="btn go hub-jour" title="${ctx.esc(nomRonde(ronde + 1))}">${ctx.esc(nomRondeCourt(ronde + 1))}</button>`);
    }
    // PRÉPARER LE ROUND ET LE BANC (S69) : tant que ta série se joue.
    if (s && !complete(s) && onDecision) boutons.unshift(`<div class="hub-actions-rang"><button class="btn gold hub-preparer">Préparer le match ${revele.get(s) + 1}</button>${onBanc ? '<button class="btn hub-banc-serie">Le banc</button>' : ''}</div>`);
    boutons.push(`<button class="btn hub-fin" title="Jouer toutes les séries et voir le tableau">Passer à la fin</button>`);
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
    actions.querySelector('.hub-fin').onclick = () => { toutReveler(); dessiner(); tabs.suivre('serie'); };
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
  /* ✕ : le reste des séries se joue, et on passe au tableau. */
  // ✕ : le reste des séries se joue — après une question (S74), comme en saison.
  ui.close.onclick = () => {
    ouvrirChoix({
      ico: '⏩', titre: 'Jouer le reste des séries ?', genre: 'confirmer', fermable: true, motFermer: 'Rester',
      recit: 'Toutes les séries se jouent d\'un coup, et tu passes au tableau final.',
      options: [
        { cle: 'fin', ico: '⏩', nom: 'Oui, jusqu\'au tableau', bon: 'Tout se joue d\'un coup', prix: 'Tes mains et tes ajustements passent sans toi' },
        { cle: 'rester', ico: '🏒', nom: 'Non, je reste', bon: 'On continue match par match' },
      ],
      onChoix: k => { if (k === 'fin') { toutReveler(); fermer(); } },
    });
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
