/**
 * L'ÉCRAN DES SÉRIES, et la saison lue sur ses feuilles.
 *
 * JP : *make a better UI for the season and playoffs, not going to games directly*. Les séries se pilotent : ta série en tête,
 * les boutons qui font avancer le temps (un match, la ronde, jusqu'à la Coupe), et des onglets qui disent où on en est — ta
 * série, le tableau, la ronde, les meneurs, les équipes. Le direct (js/direct.js) ne s'ouvre que sur demande, « Regarder le
 * match », un match à la fois. L'écran RÉVÈLE, il ne décide de rien : le tableau ne dessine que les matchs révélés, les
 * meneurs se cumulent des feuilles vues.
 *
 * Le jour à jour de la saison (`ouvrirSaison`, le Bureau et sa boîte) est parti avec l'ancien Rogue (V28, tranche 4) : la
 * saison du 82-0 file droit au bilan (js/banc.js), la run en carte a ses scènes (js/run-scenes.js).
 *
 * Le module est aveugle aux données du jeu : `ctx` porte les fonctions d'affichage de js/game.js (noms, écussons,
 * échappement, portraits).
 */

import { SLOTS, compterFeuilles, tirsTotal, jouerMatchSeries, accordsDeLigne } from './sim.js';
import { choixOuvert, resumeLignes } from './gerant.js';
import { diffuserMatch, pastilles } from './direct.js';
import { inscrireHub, retirerHub, signalerVue } from './coquille.js';
import { animerComptes } from './mouvement.js';
import { brancherEntractes } from './entracte.js';
import { cap, nom, pct3, varsEquipe, pageDuClub } from './util.js';

/* La saison d'un club lue sur les feuilles jouées : ce que les séries n'ont plus en fiche, et les forces du bilan. */

export function saisonDesFeuilles(calendrier) {
  const out = new Map();
  const de = t => { if (!out.has(t)) out.set(t, { n: 0, GF: 0, GA: 0, SF: 0, SA: 0, PKO: 0, CO: 0, serresV: 0, serresD: 0, ANB: 0, ANO: 0, INB: 0 }); return out.get(t); };
  for (const m of (calendrier || []).flat()) {
    if (!m || !m.joue || !m.feuille) continue;
    const f = m.feuille;
    for (const [t, c, gf, ga] of [[m.A, 'A', m.gfA, m.gfB], [m.B, 'B', m.gfB, m.gfA]]) {
      const S = de(t);
      S.n++; S.GF += gf; S.GA += ga; S.SF += tirsTotal(f, c); S.SA += tirsTotal(f, c === 'A' ? 'B' : 'A');
      if (Math.abs(gf - ga) === 1) { if (gf > ga) S.serresV++; else S.serresD++; }
      S.PKO += (f.punitions || []).filter(x => x.cote === c).length;
      S.CO += (f.coups && f.coups[c]) || 0;
      // Les unités spéciales : tes buts en avantage, tes avantages (les punitions de l'autre), ses buts en avantage.
      S.ANB += f.buts.filter(b => b.cote === c && b.an).length;
      S.ANO += (f.punitions || []).filter(x => x.cote !== c).length;
      S.INB += f.buts.filter(b => b.cote !== c && b.an).length;
    }
  }
  return out;
}

/* « 1er trio · AG », « 2e paire · DD », « Partant », « Réserve D ». */
const caseCourte = s => (s.group === 'F' && !s.scratch ? `${s.unit + 1}${s.unit ? 'e' : 'er'} trio · ${s.role}`
  : s.group === 'D' && !s.scratch ? `${s.unit + 1}${s.unit ? 'e' : 're'} paire · ${s.role}` : s.role);

/* ---------- la coquille : en-tête, carte, actions, onglets, volet ---------- */

function coquille(label) {
  const modal = document.getElementById('hubModal');
  if (!modal) return null;
  const $ = s => modal.querySelector(s);
  const sheet = $('.hub-sheet');
  if (sheet) sheet.setAttribute('aria-label', label);
  /*
   * LES PAGES DU CLUB (1.0, R3). JP : *j'hais le nouveau club ; au lieu de modals, faire des pages pour chaque, et
   * les icônes sont un lien*. Le dépistage, la préparation et le sommaire ne s'ouvrent plus
   * en fenêtre par-dessus le bureau : chacun est une PAGE de la feuille, avec « ‹ » pour revenir au bureau. La page
   * vit à côté de l'affiche et du volet (`.hub-page`, montrée par `data-page` sur la feuille) : elle survit aux
   * rendus de l'affiche, et se referme d'elle-même quand la saison repart (`quitter`) ou qu'une autre page s'ouvre.
   */
  let pageOuverte = null;
  const fermerPage = (silencieux = false) => {
    if (!pageOuverte) return false;
    const { el, onFerme } = pageOuverte;
    pageOuverte = null;
    el.remove();
    if (sheet) { delete sheet.dataset.page; delete sheet.dataset.pageVue; delete sheet.dataset.pageAilleurs; }
    if (!silencieux && onFerme) onFerme();
    return true;
  };
  const ouvrirPage = ({ genre, ico = '', titre, sousTitre = '', html = '', pied = '', onFerme = null }) => {
    fermerPage(true);
    const el = pageDuClub({ genre, retour: 'Retour au bureau', ico, titre, sous: sousTitre, corps: html, pied, fermer: () => fermerPage() });
    sheet.appendChild(el);
    sheet.dataset.page = genre;
    // V8 : la page appartient à l'onglet qui l'a ouverte (la semaine au Bureau) : ailleurs, elle s'efface.
    sheet.dataset.pageVue = sheet.dataset.vue || '';
    sheet.scrollTop = 0;
    pageOuverte = { el, onFerme };
    return el.querySelector('.hub-page-corps');
  };
  return { modal, head: $('.hub-head'), carte: $('.hub-carte'), actions: $('.hub-actions'), barre: $('.hub-onglets'), volet: $('.hub-volet'), close: $('.hub-close'), ouvrirPage, fermerPage };
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
    brancherEntractes(volet);
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
    if (sheet) {
      sheet.dataset.vue = pageDe(cle) || '';
      // V8 (la run du 14 oct. : Ligue › Classement montrait la page de la semaine) : une page ne couvre que son onglet.
      if (sheet.dataset.page) { if (sheet.dataset.pageVue !== sheet.dataset.vue) sheet.dataset.pageAilleurs = ''; else delete sheet.dataset.pageAilleurs; }
    }
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

const VIDE = { g: 0, a: 0, pts: 0, gp: 0, w: 0, l: 0, sa: 0, sv: 0, ga: 0, bl: 0, pm: 0, sh: 0, pim: 0, toi: 0, coups: 0, blocs: 0, gwg: 0, dq: 0 };

/*
 * Les colonnes : lire (`v`), écrire (`fmt`), trier. `bas` dit que le meilleur est le plus petit — la moyenne de buts
 * alloués, et elle seule. Six colonnes avec le rang et le nom, jamais un glissement à 390 px (nov. 2026 ; JP : *where the
 * infos are*) : le reste (les minutes, les tirs, les blocs, les buts gagnants) vit à la fiche du joueur.
 */
const COL_PAT = [
  { cle: 'gp', t: 'PJ', v: c => c.gp },
  { cle: 'b', t: 'B', v: c => c.g },
  { cle: 'a', t: 'A', v: c => c.a },
  { cle: 'pts', t: 'PTS', v: c => c.pts, heros: true },
];
const COL_GAR = [
  { cle: 'gp', t: 'PJ', v: c => c.gp },
  { cle: 'v', t: 'V', v: c => c.w, heros: true },
  { cle: 'arr', t: '%ARR', v: c => c.sv / Math.max(1, c.sa), fmt: pct3 },
  { cle: 'mba', t: 'MBA', v: c => c.ga / Math.max(1, c.gp), fmt: x => x.toFixed(2), bas: true },
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
          sa: p.simSA || 0, sv: p.simSV || 0, ga: p.simGA || 0, bl: p.simSO || 0, pm: 0, sh: 0, pim: 0, dq: null }
      : { g: p.simG || 0, a: p.simA || 0, pts: p.simPTS || 0, gp: p.simGP || 0, w: 0, l: 0,
          sa: 0, sv: 0, ga: 0, bl: 0, pm: p.simPM || 0, sh: p.simSH || 0, pim: p.simPIM || 0, toi: null, coups: null, blocs: null, gwg: null });
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
function tableJoueurs(ctx, { titre = '', id, colonnes, lignes, tri, tete = 'eq', limite = 0 }) {
  // Nov. 2026 : sans `titre`, pas de titre (les meneurs : le jeton Patineurs · Gardiens le dit déjà).
  const entete = titre ? `<div class="live-tableau-titre">${ctx.esc(titre)}</div>` : '';
  if (!lignes.length) return `<div class="live-tableau">${entete}<div class="live-vide">Aucun match joué encore</div></div>`;
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
  // V23 : aux meneurs, chaque rangée porte le filet de son club et le podium se lit sur l'or.
  // Nov. 2026 : le club (ou la case) se lit sous le nom, pas dans une colonne — six colonnes à 390 px, jamais un glissement.
  return `<div class="live-tableau hub-table${tete === 'eq' ? ' meneurs' : ''}">${entete}
    <div class="hub-scroll"><table><thead><tr><th>#</th><th>Joueur</th>${colonnes.map(th).join('')}</tr></thead>
    <tbody>${vues.map((l, i) => `<tr class="${l.toi ? 'toi' : ''}${l.parti ? ' parti' : ''}"${tete === 'eq' && l.t ? ` style="${varsEquipe(ctx.band(l.t.tag))}"` : ''}>
      <td>${i + 1}</td><td class="nom">${nomLie(ctx, l)}<small class="${tete === 'eq' ? 'eq' : 'role'}">${tete === 'eq' ? versEquipe(ctx, l.t, l.eq) : ctx.esc(l.role)}</small></td>${cellules(l)}</tr>`).join('')}</tbody></table></div>
    ${vues.length < rangs.length ? `<button type="button" class="hub-plus" data-plus="${id}">Voir les ${rangs.length - vues.length} autres</button>` : ''}</div>`;
}

/** Une rangée de pastilles de choix (vue, équipe) : c'est le menu. */
const chips = (liste, actif, attr) => `<div class="hub-chips">${liste.map(o =>
  `<button type="button" data-${attr}="${o.cle}" class="${o.cle === actif ? 'on' : ''}"${o.titre ? ` title="${o.titre}"` : ''}>${o.html || o.nom}</button>`).join('')}</div>`;

/**
 * LES MENEURS : tous ceux qui ont joué, patineurs ou gardiens, triables sur
 * n'importe quelle colonne. `etat` garde la vue, le tri et la limite
 * d'affichage entre deux rendus — le volet se refait à chaque journée.
 */
function meneursHtml(ctx, compte, equipeDe, you, menu, minGardien = 1) {
  const entrees = [...compte.entries()];
  if (!entrees.length) return '<div class="live-vide">Aucun match joué encore</div>';
  const ligne = ([p, c]) => {
    // Un joueur sans case qui a joué a joué pour toi : un rappelé renvoyé, un joueur cédé (comme les « anciens » de l'onglet Équipes).
    const t = equipeDe.get(p) || you;
    return { p, t, nom: nom(p), eq: ctx.tagCourt(t), toi: t === you, c };
  };
  const gardiens = menu.vue === 'GAR';
  const lignes = entrees.filter(([p, c]) => (gardiens ? p.p === 'G' && c.gp >= minGardien : p.p !== 'G' && c.gp > 0)).map(ligne);
  return chips([{ cle: 'PAT', nom: 'Patineurs' }, { cle: 'GAR', nom: 'Gardiens' }], menu.vue, 'vue')
    + tableJoueurs(ctx, { id: `meneurs${menu.vue}`, colonnes: gardiens ? COL_GAR : COL_PAT, lignes, tri: menu.tris[`meneurs${menu.vue}`], limite: menu.limite });
}

/**
 * LES ÉQUIPES : n'importe quel club de la ligue, son alignement et ce que
 * chacun a fait à ce jour. La case de chaque joueur reste affichée — c'est
 * une feuille d'équipe, pas un palmarès — et les colonnes se trient pareil.
 */
function equipesHtml(ctx, { teams, compte, you, menu, ficheDe, matchsDe, anciens = () => [] }) {
  if (!teams.length) return '<div class="live-vide">Aucune équipe.</div>';
  const t = teams.find(x => x === menu.equipe) || (teams.includes(you) ? you : teams[0]);
  menu.equipe = t;
  const pastille = x => ({
    cle: cleEquipe(x), nom: ctx.tagCourt(x), titre: ctx.teamLabel(x),
    html: `${ctx.logo(x.tag, 15)}<span>${ctx.esc(ctx.tagCourt(x))}</span>`,
  });
  const choix = chips(teams.map(pastille), cleEquipe(t), 'equipe');
  const joues = matchsDe(t);
  const rangee = s => {
    const p = t.roster[s.i];
    if (!p) return null;
    // Pas de rangée en or ici : c'est une feuille d'équipe, l'or ne dirait
    // rien de plus que l'en-tête. Il reste aux meneurs, où il te trouve.
    return { p, t, nom: nom(p), role: caseCourte(s), c: compte.get(p) || VIDE };
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
  // LE VOLET EST PARTAGÉ par les écrans de la coquille `#hubModal` (les séries, le tournoi Sur table) : sans débrancher en
  // fermant, un menu fermé répondrait encore aux clics du suivant.
  return () => { for (const z of zones) { z.removeEventListener('click', agir); z.removeEventListener('keydown', touche); } };
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
  f.textContent = cible.textContent.trim();
  // Un bouton sorti du DOM (l'écran s'est redessiné sans lui) garde son onclick :
  // le cliquer rejouerait un vieux geste — « Ronde 5 · 0 série » (QA S74b).
  f.onclick = () => { f.hidden = true; if (cible.isConnected) cible.click(); };
  // Sa VRAIE hauteur (« ⏳ À régler avant le match : … » passe sur deux lignes) : le volet la réserve sous sa dernière rangée.
  // Masqué par une règle d'affichage sans être `hidden`, il mesure 0 : on garde alors la dernière hauteur vraie.
  const mesurer = () => { const h = f.hidden ? 0 : Math.ceil(f.getBoundingClientRect().height); if (h) document.documentElement.style.setProperty('--flottant-h', `${h}px`); };
  f._io = new IntersectionObserver(([e]) => { f.hidden = e.isIntersecting || window.innerWidth >= 1200; mesurer(); }, { threshold: 0.6 });
  f._io.observe(cible);
}
function cacherBoutonFlottant() {
  const f = document.getElementById('hubFlottant');
  if (f) { f.hidden = true; if (f._io) { f._io.disconnect(); f._io = null; } }
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
export function ouvrirSeries({ series, moteur = null, nRondes: nR = null, rondes, you, saison = null, ctx, onTermine, depuis = null, onRevele = null }) {
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

  /*
   * TA SÉRIE SE LIT COMME UN COMBAT (S69) : deux barres de vie (les victoires qu'il reste à chacun), le rapport d'éclaireur
   * de l'adversaire (ses lignes et leurs accords, sa vedette, son gardien), tes lignes et leur chimie.
   */
  const etatSerie = s => { const { wA, wB } = gains(s); const moi = s.A === you ? wA : wB, lui = s.A === you ? wB : wA; return { moi, lui, etat: moi > lui ? 'devant' : moi < lui ? 'derriere' : 'egal' }; };
  const vedetteDe = t => Object.values(t.roster || {}).filter(p => p && p.p !== 'G')
    .sort((a, b) => (b.simPTS || 0) - (a.simPTS || 0))[0] || null;
  const gardienDe = t => { const g = SLOTS.find(x => x.group === 'G' && !x.scratch); return g ? t.roster[g.i] : null; };
  const vies = (n, cls) => `<span class="boss-vie ${cls}">${[0, 1, 2, 3].map(i => `<i class="${i < n ? 'plein' : ''}"></i>`).join('')}</span>`;
  function bossHtml(s) {
    const boss = s.A === you ? s.B : s.A;
    const { moi, lui } = etatSerie(s);
    const ved = vedetteDe(boss), gar = gardienDe(boss);
    const chim = (you.jourLignes && you.jourLignes[you.jourLignes.length - 1] && you.jourLignes[you.jourLignes.length - 1].chimie) || you.chimie || [0, 0, 0, 0];
    return `<div class="boss">
      <div class="boss-tete">⚔ <b>Contre ${ctx.esc(ctx.teamLabel(boss))}</b> · match ${revele.get(s) + 1}</div>
      <div class="boss-vies"><span title="Victoires qu'il te reste à gagner">Toi ${vies(4 - moi, 'toi')}</span><span title="Victoires qu'il lui reste à gagner">${vies(4 - lui, 'lui')} ${ctx.esc(ctx.teamShort(boss))}</span></div>
      <div class="boss-eclaireur">
        <div class="gl-k">Rapport d'éclaireur</div>
        <div class="boss-lignes">${[0, 1, 2, 3].map(u => { const a = accordsDeLigne(boss.roster, u); return `<span title="Sa ${u + 1}${u ? 'e' : 're'} ligne : ${a.length ? ctx.esc(a.map(x => x.aff.nom).join(', ')) : 'aucun accord'}">${u + 1}. ${a.length ? `${ctx.esc(a[0].aff.nom)}${a.length > 1 ? ` <small>+${a.length - 1}</small>` : ''}` : '—'}</span>`; }).join('')}</div>
        ${ved ? `<div>⭐ Sa vedette : <b>${ctx.esc(ved.n)}</b> · ${ved.simPTS || 0} pts en saison</div>` : ''}
        ${gar ? `<div>🥅 Son gardien : <b>${ctx.esc(gar.n)}</b>${gar.simSA ? ` · ${pct3((gar.simSV || 0) / gar.simSA)} en saison` : ''}</div>` : ''}
      </div>
      <div class="hub-lignes"><span class="gl-k">Tes lignes</span> ${resumeLignes(you.roster, chim)}</div>
    </div>`;
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
    return `<div class="hub-titre">Les matchs de la série</div>${jeux ? `<div class="hub-jeux">${jeux}</div>` : '<div class="hub-note">Aucun match joué encore</div>'}`;
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
      ${meneursHtml(ctx, compteSaison, equipeDe, you, menu, 25)}`;
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
    if (cle === 'meneurs') return meneursHtml(ctx, compterFeuilles(feuillesRevelees()), equipeDe, you, menu, 1);
    if (cle === 'equipes') return equipesHtml(ctx, {
      teams: clubs(), compte: compterFeuilles(feuillesRevelees()), you, menu,
      anciens: t => { const c = compterFeuilles(feuillesRevelees()); return t === you ? [...c.keys()].filter(p => !equipeDe.has(p) && (c.get(p).gp || 0) > 0) : []; },
      matchsDe: t => { const f = ficheSeries(t); return f.v + f.d; },
      ficheDe: t => { const f = ficheSeries(t); return `${f.v}-${f.d} en séries`; },
    });
    return voletTableau();
  });
  const debrancherMenu = brancherMenu(volet, menu, clubs, () => tabs.rafraichir(), cle => tabs.montrer(cle), carte);
  tabs.hub.ouvrirPage = ui.ouvrirPage;
  tabs.hub.fermerPage = (silencieux = false) => ui.fermerPage(silencieux);
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
          <div class="hub-carte-note">${rondeComplete(ronde) ? (gagne ? `La ronde est finie. ${ronde + 1 < nRondes ? 'La suivante t\'attend.' : ''}` : 'La ronde est finie ; le printemps continue sans ta formation.') : 'Les autres séries de la ronde se poursuivent.'}</div></div>`;
      } else {
        carte.innerHTML = carteSerie(s, true) + bossHtml(s);
      }
    } else {
      const r = elimination();
      carte.innerHTML = `<div class="hub-match"><div class="hub-match-titre">${ctx.esc(nomRonde(ronde))}</div><div class="hub-match-note">${r >= 0 ? `Ta formation est tombée au ${ctx.esc(nomRonde(r).toLowerCase())}. ` : ''}${deRonde(ronde).length} série${deRonde(ronde).length > 1 ? 's' : ''} : ${rondeComplete(ronde) ? 'la ronde est finie.' : 'la ronde se joue.'}</div></div>`;
    }

    const boutons = [];
    if (s && !complete(s)) boutons.push(`<button class="btn go hub-regarder" title="Le prochain match de ta série, lancer par lancer">Regarder le match ${revele.get(s) + 1}</button>`);
    /*
     * PAS DE SAUT PAR-DESSUS TA SÉRIE (S79). JP : *pas possible de sauter la
     * saison*. « Finir la ronde » n'existe que ta série décidée (ou sans toi) ;
     * « Passer à la fin », que tu n'aies plus rien à décider (éliminé).
     */
    const plusRienADecider = !you || elimination() >= 0;
    if (!rondeComplete(ronde)) {
      // Regarder ton match est le chemin par défaut ; « Match suivant » le saute, en second.
      boutons.push(`<button class="btn ${s && !complete(s) ? '' : 'go '}hub-jour" title="Un match de plus dans chaque série de la ronde">Match suivant</button>`);
      if (!s || complete(s)) boutons.push(`<button class="btn hub-ronde" title="Jouer la ronde jusqu'au bout">Finir la ronde</button>`);
    } else if (ronde + 1 < nRondes) {
      boutons.push(`<button class="btn go hub-jour" title="${ctx.esc(nomRonde(ronde + 1))}">${ctx.esc(nomRondeCourt(ronde + 1))}</button>`);
    }
    if (plusRienADecider) boutons.push(`<button class="btn hub-fin" title="Jouer toutes les séries et voir le tableau">Passer à la fin</button>`);
    actions.innerHTML = `<div class="hub-barre">${boutons.join('')}</div>`;
    boutonFlottant(actions, termine);
    const regarder = actions.querySelector('.hub-regarder');
    if (regarder) regarder.onclick = () => regarderLeMatch();
    const jour = actions.querySelector('.hub-jour');
    if (jour) jour.onclick = () => {
      if (rondeComplete(ronde)) { ronde++; dessiner(); tabs.suivre('serie'); return; }
      matchSuivant(); dessiner(); tabs.suivre('serie');
    };
    const fr = actions.querySelector('.hub-ronde');
    if (fr) fr.onclick = () => { finirRonde(); dessiner(); tabs.suivre('serie'); };
    const hf = actions.querySelector('.hub-fin');
    if (hf) hf.onclick = () => { toutReveler(); dessiner(); tabs.suivre('serie'); };
  }

  /* REGARDER LE MATCH : le direct rejoue le prochain match de ta série, puis
     la ronde avance d'un match partout, comme si on l'avait passé. */
  function regarderLeMatch() {
    const s = maSerie(ronde);
    if (!s || complete(s) || termine) return;
    const k = revele.get(s);
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
      pauses: [20, 40],
      onTermine: () => { if (termine) return; matchSuivant(); dessiner(); tabs.suivre('serie'); },
    });
  }

  /* L'écran se retire : l'état révélé est noté, le hub rendu à la coquille. */
  const quitter = () => {
    if (termine) return;
    termine = true;
    cacherBoutonFlottant();
    ui.fermerPage(true);
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
}
