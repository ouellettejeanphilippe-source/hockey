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

import { SLOTS, compterFeuilles, tirsTotal } from './sim.js';
import { diffuserMatch, pastilles } from './direct.js';
import { tempsRestant } from './recit.js';

/* « 1er », « 12e » : le rang d'un but ou d'une passe. */
const ord = n => (n === 1 ? '1er' : `${n}e`);
const ordF = n => (n === 1 ? '1re' : `${n}e`);
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
 * LES ONGLETS DE L'ÉCRAN. Une barre plate, l'onglet ouvert souligné d'or
 * comme ceux du bilan ; `rendre(cle)` fabrique le volet au moment où on
 * l'ouvre, et `rafraichir` le refait après chaque journée ou chaque match.
 */
function onglets(barre, volet, liste, rendre) {
  let courant = liste[0].cle;
  barre.innerHTML = liste.map(o => `<button type="button" data-onglet="${o.cle}" class="${o.cle === courant ? 'on' : ''}">${o.titre}</button>`).join('');
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
  const montrer = cle => {
    courant = cle;
    barre.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.onglet === cle));
    volet.innerHTML = rendre(cle);
    volet.scrollTop = 0;
    apresRendu();
  };
  barre.querySelectorAll('button').forEach(b => { b.onclick = () => montrer(b.dataset.onglet); });
  return { montrer, rafraichir: () => { volet.innerHTML = rendre(courant); apresRendu(); }, courant: () => courant };
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
      <td>${i + 1}</td><td class="nom">${ctx.esc(l.nom)}${l.blesse ? ` <span class="hub-bl" title="Blessé">🩹 ${l.blesse}</span>` : ''}</td>
      <td class="${tete === 'eq' ? 'eq' : 'role'}">${ctx.esc(tete === 'eq' ? l.eq : l.role)}</td>${cellules(l)}</tr>`).join('')}</tbody></table></div>
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
  const ligne = ([p, c]) => ({ nom: nom(p), eq: ctx.tagCourt(equipeDe.get(p) || { tag: '—' }), toi: equipeDe.get(p) === you, c });
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
    return { nom: nom(p), role: caseCourte(s), blesse: blesses.get(p) || 0, c: compte.get(p) || VIDE };
  };
  const pat = SLOTS.filter(s => s.group !== 'G').map(rangee).filter(Boolean);
  const gar = SLOTS.filter(s => s.group === 'G').map(rangee).filter(Boolean);
  // Le gardien de rappel n'a pas de case, mais il a gardé des matchs.
  if (t.rappelG && compte.get(t.rappelG)) gar.push({ nom: nom(t.rappelG), role: 'Rappel', c: compte.get(t.rappelG) });
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
function brancherMenu(volet, menu, equipes, rafraichir) {
  const agir = ev => {
    const el = ev.target.closest('[data-tri], [data-vue], [data-equipe], [data-plus]');
    if (!el || !volet.contains(el)) return;
    const d = el.dataset;
    if (d.tri) {
      const [id, cle] = d.tri.split('|');
      const colonnes = COLS_DE[id];
      if (!colonnes) return;
      const t = menu.tris[id];
      menu.tris[id] = t && t.cle === cle ? { cle, asc: !t.asc } : triDe(colonnes, cle);
    } else if (d.vue) menu.vue = d.vue === 'GAR' ? 'GAR' : 'PAT';
    else if (d.equipe) menu.equipe = equipes().find(t => cleEquipe(t) === d.equipe) || menu.equipe;
    else if (d.plus) menu.limite = 0;
    ev.preventDefault();
    rafraichir();
  };
  const touche = ev => { if (ev.key === 'Enter' || ev.key === ' ') agir(ev); };
  volet.addEventListener('click', agir);
  volet.addEventListener('keydown', touche);
  // LE VOLET EST PARTAGÉ par l'écran de saison et l'écran des séries (la même
  // coquille `#hubModal`) : sans débrancher en fermant, le menu de la saison
  // répondait encore aux clics de celui des séries et réécrivait le volet
  // avec son propre classement.
  return () => { volet.removeEventListener('click', agir); volet.removeEventListener('keydown', touche); };
}

/* Le bloc d'une équipe dans la carte du prochain match : écusson, nom, fiche. */
function blocEquipe(ctx, t, ligne, pos) {
  const b = ctx.band(t.tag);
  return `<div class="hub-eq ${pos}" style="--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
    <div class="hub-eq-band">${ctx.logo(t.tag, 26)}<span>${ctx.esc(ctx.tagCourt(t))}</span></div>
    <div class="hub-eq-nom">${ctx.esc(ctx.teamLabel(t))}</div>
    <div class="hub-eq-fiche">${ctx.esc(ligne)}</div>
  </div>`;
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
 */
export function ouvrirSaison({ calendrier, teams, you, enSeries = 16, epoque = null, ctx, onTermine }) {
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
  const miens = [];   // { j, k, m } : tes matchs joués, dans l'ordre
  const cumuler = m => {
    const a = fiche.get(m.A), b = fiche.get(m.B);
    if (!a || !b) return;
    a.GF += m.gfA; a.GA += m.gfB; b.GF += m.gfB; b.GA += m.gfA;
    const gagneA = m.gfA > m.gfB;
    if (gagneA) { a.W++; if (m.ot) b.OTL++; else b.L++; } else { b.W++; if (m.ot) a.OTL++; else a.L++; }
    a.PTS = a.W * 2 + a.OTL; b.PTS = b.W * 2 + b.OTL;
  };
  const classement = () => teams.slice().sort((x, y) => {
    const a = fiche.get(x), b = fiche.get(y);
    return b.PTS - a.PTS || b.W - a.W || (b.GF - b.GA) - (a.GF - a.GA);
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
  const avancer = n => { while (n-- > 0 && jour < N) appliquerJour(jour++); };

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

  const voletJournee = () => {
    if (!jour) {
      const p = prochain();
      return `<div class="hub-note">La saison commence. ${p ? `Ton premier match : ${ctx.esc(ctx.teamLabel(p.m.A === you ? p.m.B : p.m.A))}.` : ''} Regarde-le en direct, ou passe la journée : tout se lit ici après.</div>`;
    }
    const j = jour - 1, k = indexMien(j), matchs = calendrier[j];
    const mien = k >= 0 ? scoreboard({ j, k, m: matchs[k] }) : `<div class="live-board hub-board"><div class="live-horloge"><span class="live-per">CONGÉ</span><span class="live-tirs">Les NHL Stars ne jouent pas aujourd'hui</span></div></div>`;
    const autres = matchs.map((m, i) => (i === k ? '' : carteMatch(m, j, i))).join('');
    return `<div class="hub-titre">Journée ${jour}</div>${mien}
      <div class="hub-titre">Les autres matchs</div><div class="cal-grille">${autres}</div>`;
  };

  const voletClassement = () => {
    const rangee = (t, i) => { const g = fiche.get(t); return `<tr class="${t === you ? 'toi' : ''}${i === enSeries - 1 ? ' cut' : ''}"><td>${i + 1}</td><td class="nom">${ctx.logo(t.tag, 14)} ${ctx.esc(ctx.teamShort(t))}</td><td>${g.W + g.L + g.OTL}</td><td>${g.W}</td><td>${g.L}</td><td>${g.OTL}</td><td class="heros">${g.PTS}</td><td>${g.GF}</td><td>${g.GA}</td><td>${g.GF - g.GA > 0 ? '+' : ''}${g.GF - g.GA}</td></tr>`; };
    return `<div class="live-tableau hub-classement"><div class="live-tableau-titre">Classement · journée ${jour} · les ${enSeries} premiers vont en séries</div>
      <table><thead><tr><th>#</th><th>Équipe</th><th>PJ</th><th>V</th><th>D</th><th>DP</th><th class="heros">PTS</th><th>BP</th><th>BC</th><th>Diff</th></tr></thead>
      <tbody>${classement().map(rangee).join('')}</tbody></table></div>`;
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
    return `<div class="hub-titre">Tes ${miens.length} matchs · ${f.W}-${f.L}-${f.OTL} · ${f.GF} BP · ${f.GA} BC${sequence() ? ` · séquence ${sequence()}` : ''}</div><div class="hub-jeux">${lignes}</div>`;
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
    { cle: 'journee', titre: 'Journée' }, { cle: 'classement', titre: 'Classement' }, { cle: 'meneurs', titre: 'Meneurs' },
    { cle: 'equipes', titre: 'Équipes' }, { cle: 'fiche', titre: 'Ma fiche' },
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
  const debrancherMenu = brancherMenu(volet, menu, () => classement(), () => tabs.rafraichir());

  /* ---------- l'en-tête, la carte, les actions ---------- */

  function dessiner() {
    const f = fiche.get(you);
    const rang = rangDe(you);
    const seq = sequence();
    head.innerHTML = `<span class="live-ronde">${epoque ? `Saison ${ctx.esc(epoque)}` : 'Saison régulière'}</span>
      <span class="live-match">Journée ${jour} / ${N}</span>
      <span class="live-serie">${jour ? `${f.W}-${f.L}-${f.OTL} · ${f.PTS} pts · ${rang}${rang === 1 ? 'er' : 'e'}${seq ? ` · ${seq}` : ''}` : 'La saison commence'}</span>`;

    const p = prochain();
    if (jour >= N) {
      carte.innerHTML = `<div class="live-bilan ${rang <= enSeries ? 'gagne' : 'perdu'}"><div class="live-bilan-titre">Saison terminée · ${f.W}-${f.L}-${f.OTL} · ${rang}${rang === 1 ? 'er' : 'e'} de ${teams.length}${rang <= enSeries ? ' · en séries' : ' · éliminé'}</div>
        <div class="hub-carte-note">${rang <= enSeries ? 'Le bilan de la saison t\'attend, puis les séries.' : 'Le bilan de la saison dit où le bât blesse.'}</div></div>`;
      actions.innerHTML = `<button class="btn gold hub-suite">Voir le bilan de la saison</button>`;
      actions.querySelector('.hub-suite').onclick = fermer;
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
      carte.innerHTML = `<div class="hub-match">
        <div class="hub-match-titre">Prochain match · Journée ${p.j + 1}</div>
        <div class="hub-face">${blocEquipe(ctx, p.m.A, fa(p.m.A), 'a')}<div class="hub-vs">VS</div>${blocEquipe(ctx, p.m.B, fa(p.m.B), 'b')}</div>
        <div class="hub-match-note">${dernierMot}</div>
      </div>`;
    } else {
      carte.innerHTML = `<div class="hub-match"><div class="hub-match-titre">Congé</div><div class="hub-match-note">Les NHL Stars ne jouent plus d'ici la fin de la saison.</div></div>`;
    }
    actions.innerHTML = `${p ? `<button class="btn gold hub-regarder" title="Le prochain match de ta formation, lancer par lancer">Regarder le match</button>` : ''}
      <button class="btn go hub-jour" title="Une journée de plus : tous les résultats, le classement du jour">Journée suivante</button>
      <button class="btn hub-dix" title="Dix journées d'un coup">+10 journées</button>
      <button class="btn hub-fin" title="Jouer le reste de la saison et lire le résultat">Passer à la fin</button>`;
    const regarder = actions.querySelector('.hub-regarder');
    if (regarder) regarder.onclick = regarderProchain;
    actions.querySelector('.hub-jour').onclick = () => { avancer(1); dessiner(); tabs.montrer('journee'); };
    actions.querySelector('.hub-dix').onclick = () => { avancer(10); dessiner(); tabs.montrer('fiche'); };
    actions.querySelector('.hub-fin').onclick = () => { avancer(N); dessiner(); tabs.montrer('classement'); };
  }

  /* REGARDER LE MATCH : le direct rejoue ta prochaine feuille, puis la journée
     est révélée entière, comme si on l'avait passée. */
  function regarderProchain() {
    const p = prochain();
    if (!p || termine) return;
    // Les journées de congé d'ici là passent d'elles-mêmes.
    while (jour < p.j) appliquerJour(jour++);
    const f = fiche.get(you);
    const apresA = { ...fiche.get(p.m.A) }, apresB = { ...fiche.get(p.m.B) };
    diffuserMatch({
      feuille: p.m.feuille, A: p.m.A, B: p.m.B,
      titre: 'Saison régulière', sousTitre: `Journée ${p.j + 1}`,
      etat: jour ? `${f.W}-${f.L}-${f.OTL} · ${rangDe(you)}${rangDe(you) === 1 ? 'er' : 'e'}` : 'Premier match de la saison',
      graine: (p.j + 1) * 100 + p.k, avant: compte, ctx,
      onTermine: () => { if (termine) return; avancer(1); dessiner(); tabs.montrer('journee'); },
    });
    void apresA; void apresB;
  }

  const fermer = () => {
    if (termine) return;
    termine = true;
    debrancherMenu();
    window.removeEventListener('keydown', clavier);
    modal.style.display = 'none';
    document.body.style.overflow = '';
    onTermine();
  };
  /* ✕ : le reste de la saison se joue, et on passe au bilan. */
  ui.close.onclick = () => { avancer(N); fermer(); };
  ui.close.setAttribute('aria-label', 'Passer au bilan de la saison');
  ui.close.title = 'Jouer le reste de la saison et passer au bilan';
  // Entrée ou la barre d'espace : la journée suivante, sans viser le bouton.
  const clavier = ev => {
    if ((ev.key !== ' ' && ev.key !== 'Enter') || ev.target.closest('input, textarea, select, button, [role="button"], a')) return;
    if (document.getElementById('liveModal')?.style.display === 'flex') return;
    ev.preventDefault();
    const b = actions.querySelector('.hub-jour') || actions.querySelector('.hub-suite');
    if (b) b.click();
  };
  window.addEventListener('keydown', clavier);

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  dessiner();
  tabs.montrer('journee');
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
 */
export function ouvrirSeries({ series, rondes, you, saison = null, ctx, onTermine }) {
  const ui = coquille('Les séries');
  if (!ui || !series.length) { onTermine(); return; }
  const { modal, head, carte, actions, barre, volet } = ui;
  const nRondes = Math.max(...series.map(s => s.ronde)) + 1;
  const deRonde = r => series.filter(s => s.ronde === r).sort((a, b) => a.i - b.i);
  // Ce qui est révélé : le nombre de matchs qu'on a vus de chaque série.
  const revele = new Map(series.map(s => [s, 0]));
  const complete = s => revele.get(s) >= s.feuilles.length;
  const gains = s => { let wA = 0, wB = 0; for (const f of s.feuilles.slice(0, revele.get(s))) { if (f.vainqueur === 'A') wA++; else wB++; } return { wA, wB }; };
  const rondeComplete = r => deRonde(r).every(complete);
  let ronde = 0, termine = false;
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
    return `<div class="hub-titre">Les matchs de la série</div>${jeux ? `<div class="hub-jeux">${jeux}</div>` : '<div class="hub-note">Aucun match joué encore. Regarde le premier en direct, ou passe au match suivant.</div>'}`;
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
    { cle: 'tableau', titre: 'Tableau' }, { cle: 'serie', titre: 'Ma série' }, { cle: 'ronde', titre: 'La ronde' },
    { cle: 'meneurs', titre: 'Meneurs' }, { cle: 'equipes', titre: 'Équipes' },
    ...(compteSaison ? [{ cle: 'saison', titre: 'Saison' }] : []),
  ], cle => {
    if (cle === 'saison') return voletSaison();
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
  const debrancherMenu = brancherMenu(volet, menu, clubs, () => tabs.rafraichir());

  /* ---------- l'en-tête, la carte, les actions ---------- */

  function dessiner() {
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
        <div class="hub-carte-note">${ctx.esc(cap(etatDeSerie(ctx, finale, finale.wA, finale.wB)))}. Le tableau complet, les sommaires et les statistiques des séries t'attendent au bilan.</div></div>`;
      actions.innerHTML = `<button class="btn gold hub-suite">Voir le tableau des séries</button>`;
      actions.querySelector('.hub-suite').onclick = fermer;
      return;
    }
    if (s) {
      if (complete(s)) {
        const gagne = s.winner === you;
        carte.innerHTML = `<div class="live-bilan ${gagne ? 'gagne' : 'perdu'}"><div class="live-bilan-titre">${gagne ? 'Série remportée' : 'Éliminé'} ${Math.max(s.wA, s.wB)}-${Math.min(s.wA, s.wB)} · ${ctx.esc(nomRondeCourt(ronde))}</div>
          <div class="hub-carte-note">${rondeComplete(ronde) ? (gagne ? `La ronde est finie. ${ronde + 1 < nRondes ? 'La suivante t\'attend.' : ''}` : 'La ronde est finie ; les séries continuent sans ta formation.') : 'Les autres séries de la ronde se poursuivent.'}</div></div>`;
      } else carte.innerHTML = carteSerie(s, true);
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
    boutons.push(`<button class="btn hub-fin" title="Jouer toutes les séries et voir le tableau">Passer à la fin</button>`);
    actions.innerHTML = boutons.join('');
    const regarder = actions.querySelector('.hub-regarder');
    if (regarder) regarder.onclick = regarderProchain;
    const jour = actions.querySelector('.hub-jour');
    if (jour) jour.onclick = () => {
      if (rondeComplete(ronde)) { ronde++; dessiner(); tabs.montrer(maSerie(ronde) ? 'serie' : 'ronde'); return; }
      matchSuivant(); dessiner(); tabs.montrer(maSerie(ronde) && revele.get(maSerie(ronde)) ? 'serie' : 'ronde');
    };
    const fr = actions.querySelector('.hub-ronde');
    if (fr) fr.onclick = () => { finirRonde(); dessiner(); tabs.montrer('ronde'); };
    actions.querySelector('.hub-fin').onclick = () => { toutReveler(); dessiner(); tabs.montrer('tableau'); };
  }

  /* REGARDER LE MATCH : le direct rejoue le prochain match de ta série, puis
     la ronde avance d'un match partout, comme si on l'avait passé. */
  function regarderProchain() {
    const s = maSerie(ronde);
    if (!s || complete(s) || termine) return;
    const k = revele.get(s);
    const { wA, wB } = gains(s);
    const f = s.feuilles[k];
    const apres = etatDeSerie(ctx, s, wA + (f.vainqueur === 'A' ? 1 : 0), wB + (f.vainqueur === 'B' ? 1 : 0));
    diffuserMatch({
      feuille: f, A: s.A, B: s.B,
      titre: nomRonde(ronde), sousTitre: `Match ${k + 1}`,
      etat: k ? etatDeSerie(ctx, s, wA, wB) : `${ctx.teamShort(s.A)} contre ${ctx.teamShort(s.B)}`,
      tally: { wA, wB }, graine: (s.i + 1) * 1000 + k,
      avant: compterFeuilles(feuillesRevelees()), apres: `${cap(apres)}.`, ctx,
      onTermine: () => { if (termine) return; matchSuivant(); dessiner(); tabs.montrer('serie'); },
    });
  }

  const fermer = () => {
    if (termine) return;
    termine = true;
    debrancherMenu();
    window.removeEventListener('keydown', clavier);
    modal.style.display = 'none';
    document.body.style.overflow = '';
    onTermine();
  };
  /* ✕ : le reste des séries se joue, et on passe au tableau. */
  ui.close.onclick = () => { toutReveler(); fermer(); };
  ui.close.setAttribute('aria-label', 'Passer au tableau des séries');
  ui.close.title = 'Jouer le reste des séries et voir le tableau';
  const clavier = ev => {
    if ((ev.key !== ' ' && ev.key !== 'Enter') || ev.target.closest('input, textarea, select, button, [role="button"], a')) return;
    if (document.getElementById('liveModal')?.style.display === 'flex') return;
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
