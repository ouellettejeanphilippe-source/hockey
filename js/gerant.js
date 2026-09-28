/**
 * LE POSTE DE GÉRANT (S68) : deux écrans plein écran.
 *
 * JP : *c'est pas clair l'impact des trucs, aussi décisions dans modals plein
 * écran, tout devrait être clair* ; *chaque ligne peut avoir stratégie
 * différente, qui doit fitter avec profils, style hockeyarena.net* ;
 * *pouvoir en tout temps changer les trios et cie et ça a un impact*.
 *
 *   ouvrirChoix   UNE décision : une histoire, le joueur visé s'il y en a un,
 *                 et des options qui disent chacune en CHIFFRES ce qu'elles
 *                 achètent, ce qu'elles coûtent, combien de matchs, et
 *                 quelles factions elles bougent
 *   ouvrirLignes  les quatre lignes : les joueurs avec leur profil et leur
 *                 énergie, les sept tactiques avec le fit de CETTE ligne, la
 *                 chimie, l'agressivité, les secondes de présence ; la
 *                 tactique d'en face et celle qui la contre ; la consigne du
 *                 match. Rien ne s'applique avant « Appliquer ». Depuis S78,
 *                 il ne sert plus qu'à la préparation d'avant-match.
 *   strategieDeLigne  la même stratégie, ligne par ligne, dans un tiroir
 *                 SOUS son trio de l'alignement (S78) : l'alignement, la
 *                 stratégie et les trios sont un seul écran.
 *
 * Le module est aveugle au jeu : `ctx` porte l'échappement et les écussons,
 * les données arrivent en arguments, et les décisions repartent par rappel.
 */

import {
  PROFILS, TACTIQUES, SYSTEMES_D, AGRESSIVITES, IMPORTANCES, SEC_MIN, SEC_MAX, SEC_DEFAUT,
  profilsDe, profilPrincipal, roleSecond, fitUnite, fitDeLigne, meilleureTactique, meilleurSystemeD, echelleFit, identiteUnite, effetsDeSysteme,
  joueursDeLigne, contreDe, contreDeD, motsDEffet, motsDeMutation, chimieMax,
  MUTATIONS, SLOTS, getPlayerKey, getHiddenRatings, getPositionPenalty, CARTES,
  PLANS_ADV, commentContrer, planEstContre, reglageDuPlan,
  physiqueDe, physiqueLigne, bilanAgressivite, flechesDe,
  chimieLigne, ententeLigne, maitriseLigne, apprentissagePhoto, penaliteAdaptee, unitesIdeales,
} from './sim.js';
import { POIDS_TRIO } from './ratings.js';
import { carteHtml, RARETES, paquetHtml } from './cartes.js';
import { CARTES_MATCH, ENERGIE_MAIN, coutDe, energieDepensee } from './combat.js';
import { effetsDesCartes, PREP_JUSTE, PREP_RATEE } from './sim.js';
import { jouerSon } from './sons.js';
import { avecArticle } from './commentaire.js';

const $ = id => document.getElementById(id);
/* Une phrase qui suit un point commence par une majuscule. */
const majuscule = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Les puces d'un effet : vert s'il aide, rouge s'il coûte, gris s'il ne fait que déplacer. */
export function puces(mots) {
  return (mots || []).map(m => `<span class="puce ${m.bon === true ? 'bon' : m.bon === false ? 'prix' : 'neutre'}${m.duree ? ' duree' : ''}">${esc(m.txt)}</span>`).join('');
}
/*
 * CE QU'UNE CARTE FAIT, EN PUCES (S72). JP : *varie les cartes* ; *faut le
 * faire pour vrai*. Un cadeau n'a que du vert, un moindre mal que du rouge ;
 * un pari dit sa chance et ses deux issues, un investissement ce qui vient
 * plus tard, un geste réel qui il touche et ce qui lui arrive.
 */
const plur = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
export function motsDAction(a, noms = '') {
  if (!a) return [];
  const qui = noms || 'le joueur visé';
  const out = [];
  if (a.absents) out.push({ txt: `👥 ${qui} au vestiaire ${plur(a.absents, 'match')} — un réserviste ou un rappelé joue`, bon: null });
  if (a.energie) out.push({ txt: `👥 ${qui} : énergie ${a.energie > 0 ? '+' : '−'}${Math.abs(a.energie)}`, bon: a.energie > 0 });
  if (a.energieTous) out.push({ txt: `👥 Toute l'équipe : énergie ${a.energieTous > 0 ? '+' : '−'}${Math.abs(a.energieTous)}`, bon: a.energieTous > 0 });
  if (a.gardienAux) out.push({ txt: `🧤 L'auxiliaire garde le filet ${plur(a.gardienAux, 'match')}`, bon: null });
  return out;
}
export function motsDeCarte(o, noms = '') {
  const out = [];
  if (o.action) out.push(...motsDAction(o.action, noms));
  if (o.changeGardien) out.push({ txt: '🧤 L\'auxiliaire prend le filet', bon: null });
  if (o.gardienAux === true) out.push({ txt: '🧤 L\'auxiliaire au filet ce match-là', bon: null });
  if (o.enjeu) out.push({ txt: '⚖️ Après le match, l\'élan ou le contrecoup dure deux fois plus', bon: null });
  if (o.pari) {
    const p = Math.round(o.pari.chance * 100);
    const issue = e => { const { duree, action, ...c } = e || {}; const m = [...motsDEffet(c, duree), ...motsDAction(action, noms)]; return m.length ? m.map(x => x.txt).join(', ') : 'rien'; };
    out.push({ txt: `🎲 ${p} % : ${issue(o.pari.gagne)}`, bon: true });
    out.push({ txt: `🎲 sinon : ${issue(o.pari.perd)}`, bon: false });
  }
  if (o.ensuite) {
    const { apres, duree, ...c } = o.ensuite;
    out.push({ txt: `⏳ Dans ${plur(apres || 0, 'match')} : ${motsDEffet(c, duree).map(x => x.txt).join(', ')}`, bon: true });
  }
  if (o.rien) out.push({ txt: 'Rien ne change', bon: null });
  return out;
}

/*
 * LE PLAN DE L'ADVERSAIRE (S70, S72), tel que le rapport d'éclaireur le lit :
 * ce qu'il règle sur ses lignes, ce que ce système fait, ce qui le contre, et
 * si tes lignes le contrent.
 */
export function planAdverseHtml(cle, contre, { nomAdv = 'Ils', suite = '', prepJuste } = {}) {
  const P = PLANS_ADV[cle];
  if (!P) return '';
  // Le plan est un réglage de lignes (S72) : ce qu'il règle, et ce que ce système fait.
  const T = P.tac ? TACTIQUES[P.tac] : null;
  const mots = T ? effetsDeSysteme(T, 75).map(m => ({ txt: `${nomAdv} : ${m.txt}`, bon: !m.bon })) : [];
  return `<div class="plan-adv${contre ? ' contre' : ''}">
    <div class="plan-adv-t">${P.ico} Leur plan : <b>${esc(P.nom)}</b>${suite ? ` <small>${esc(suite)}</small>` : ''}</div>
    <div class="plan-adv-mot">${esc(P.mot)} <b>${esc(majuscule(reglageDuPlan(cle)))}</b>.</div>
    ${mots.length ? `<div class="choix-puces">${puces(mots)}</div>` : ''}
    ${prepJuste === undefined ? `<div class="plan-adv-contre"><b>${contre ? '✓ Tu le contres' : '✗ Pas contré'}</b> · pour le contrer : ${esc(commentContrer(cle))}.</div>`
      : `<div class="plan-adv-contre ${prepJuste ? 'juste' : prepJuste === false ? 'ratee' : ''}"><b>${prepJuste ? '🎯 Ta préparation visait juste : leur plan est tombé' : prepJuste === false ? '💥 T\'as chié ta préparation' : 'Pas de préparation'}</b></div>`}
  </div>`;
}

/*
 * CE QU'UN JOUEUR SAIT FAIRE, EN MOTS (S71). JP : *la carte des joueurs est
 * rendue trop complexe à lire* ; *pas besoin de stats chiffrées aussi
 * complexes*. Six barres chiffrées disaient tout et ne disaient rien : on
 * garde ses deux ou trois vrais rôles, avec un mot pour le niveau, et sa
 * carrure quand elle compte (le jeu physique en dépend).
 */
export const niveauDe = x => (x >= 85 ? 'élite' : x >= 70 ? 'très bon' : x >= 55 ? 'bon' : x >= 40 ? 'correct' : 'faible');
export const carrureDe = p => { const ph = physiqueDe(p); return ph >= 0.62 ? { ico: '🪨', mot: 'Costaud' } : ph <= 0.38 ? { ico: '🪶', mot: 'Léger' } : null; };
export function rolesDe(p) {
  const pp = profilPrincipal(p);
  if (!pp) return '';
  const r2 = roleSecond(p);
  const c = carrureDe(p);
  const puce = (r, premier) => `<span class="puce ${premier ? 'bon' : 'neutre'}" title="${premier ? 'Son rôle' : 'Son second rôle'} — lu dans ${esc(r.mot)}, comparés aux joueurs de sa saison">${r.ico} ${esc(r.nom)} · ${niveauDe(r.fit)}</span>`;
  return `<div class="gj-roles">${puce(pp, true)}${r2 ? puce(r2, false) : ''}${c ? `<span class="puce neutre" title="Son physique : le jeu robuste lui ${c.ico === '🪨' ? 'réussit' : 'coûte des punitions'}">${c.ico} ${c.mot}</span>` : ''}</div>`;
}
/* L'ancien nom : la fiche l'appelle encore. */
export const barresProfils = rolesDe;
/* « Brodeur, Stevens et Niedermayer » : une liste de noms, en français. */
export const listeNoms = ns => (ns.length <= 1 ? ns[0] || '' : `${ns.slice(0, -1).join(', ')} et ${ns[ns.length - 1]}`);
/* Les canaux d'effet d'un objet : ce que motsDEffet sait dire. */
const CANAUX = ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
const canauxDe = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => CANAUX.includes(k)));

/* `ligne` (S80) : où il joue dans ton alignement (« 3e paire ») — on le dit, on ne le nomme pas par là. */
export function carteJoueur(p, ligne = '') {
  if (!p) return '';
  const barres = barresProfils(p);
  const marques = (p._mutCles || []).map(k => MUTATIONS[k] ? `<span class="puce neutre">${MUTATIONS[k].ico} ${esc(MUTATIONS[k].nom)}</span>` : '').join('');
  return `<div class="gj-joueur"><div class="gj-joueur-nom">${esc(p.n)} <span>${esc(p.p)} · ${esc(p.t)} ${esc(p.s)}</span>${ligne ? ` <span class="gj-ligne">${esc(ligne)}</span>` : ''}</div>${marques ? `<div class="gj-marques">${marques}</div>` : ''}${barres}</div>`;
}

/* ======================================================================
   UNE DÉCISION, EN PLEIN ÉCRAN
   ====================================================================== */
let fermerChoixCourant = null;
/*
 * L'OUVERTURE D'UN PAQUET (S77). JP : *rends ça plus dynamique et beau*. Une
 * récompense (un gros match gagné, une série gagnée) arrive dans un PAQUET
 * scellé qui luit de la couleur de sa meilleure carte ; on le touche, le rabat
 * se déchire, les cartes sortent face cachée et se retournent une à une — la
 * meilleure en DERNIER, avec un éclat plus grand. Toucher encore montre tout
 * d'un coup. Puis le choix se fait comme avant : le contenu était déjà décidé
 * (`recompensesOffertes`), le paquet n'est qu'une façon de le montrer. Un
 * paquet ne s'ouvre qu'une fois : rouvrir le choix (« Voir la récompense »)
 * montre les cartes. Sous `prefers-reduced-motion`, pas de paquet.
 */
const RANG_RARETE = { commune: 0, peu: 1, rare: 2, legendaire: 3 };
const PAQUETS_OUVERTS = new Set();
const REVELE_PAS = 320;          // ms entre deux cartes qui se retournent
const REVELE_CARTE = 900;        // ms pour qu'une carte sorte et se retourne
const DECHIRE = 460;             // ms du rabat qui se déchire
const mouvementCalme = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/**
 * spec : { ico, titre, irl, recit, joueur, options: [{ cle, nom, bon, prix, effet, duree, jauges,
 *          mutation, desactive }], fermable, motFermer, onChoix(cle), onFerme() }
 */
export function ouvrirChoix(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  const nom = spec.joueur ? spec.joueur.n : (spec.joueurs && spec.joueurs[0] ? spec.joueurs[0].n : '');
  // OÙ IL JOUE (S80, JP : *dire que x est sur la xième ligne*) : `ouDe(p)` rend « 3e paire », dit à côté du nom.
  const ou = p => (typeof spec.ouDe === 'function' && p ? spec.ouDe(p) || '' : '');
  // {noms} : les joueurs visés par un geste réel, nommés (S72) — et où ils jouent (S80).
  const noms = spec.joueurs && spec.joueurs.length ? listeNoms(spec.joueurs.map(p => (ou(p) ? `${p.n} (${ou(p)})` : p.n))) : '';
  const sub = s => esc(String(s || '').replace(/\{nom\}/g, nom || 'ton joueur').replace(/\{noms\}/g, noms || 'tes joueurs'));
  const clePaquet = `${spec.titre}|${spec.options.map(o => o.cle).join(',')}`;
  const paquet = spec.genre === 'recompense' && spec.cartes && !spec.lecture && spec.options.length > 0
    && !PAQUETS_OUVERTS.has(clePaquet) && !mouvementCalme();
  // L'ordre du retournement : la meilleure carte en dernier (l'ordre à l'écran ne bouge pas) ; à rareté égale, le meilleur joueur (`rang`, son niveau, S80).
  const ordre = spec.options.map((o, i) => i).sort((a, b) => (RANG_RARETE[spec.options[a].rarete] || 0) - (RANG_RARETE[spec.options[b].rarete] || 0)
    || (spec.options[a].rang || 0) - (spec.options[b].rang || 0) || a - b);
  const rangDe = i => ordre.indexOf(i);
  const meilleure = spec.options.reduce((b, o) => ((RANG_RARETE[o.rarete] || 0) > (RANG_RARETE[b] || 0) ? o.rarete : b), 'commune');
  m.innerHTML = `<div class="choix-sheet${spec.cartes ? ' choix-cartes' : ''}${paquet ? ' paquet-ferme' : ''}"${spec.genre ? ` data-genre="${esc(spec.genre)}"` : ''} role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
    <div class="choix-tete">
      <span class="choix-ico">${spec.ico || '❓'}</span>
      <div class="choix-titres"><div class="choix-titre">${sub(spec.titre)}</div>${spec.irl ? `<div class="choix-irl">${esc(spec.irl)}</div>` : ''}</div>
      ${spec.fermable ? `<button type="button" class="close-btn choix-fermer" aria-label="${esc(spec.motFermer || 'Plus tard')}" title="${esc(spec.motFermer || 'Plus tard')}">✕</button>` : ''}
    </div>
    <div class="choix-corps">
      ${spec.recit ? `<p class="choix-recit">${sub(spec.recit)}</p>` : ''}
      ${spec.joueur ? carteJoueur(spec.joueur, ou(spec.joueur)) : ''}
      ${spec.contexte || ''}
      ${paquet ? `<div class="paquet-scene">${paquetHtml({ n: spec.options.length, meilleure, serie: spec.titre })}</div>` : ''}
      <div class="choix-options${spec.cartes ? ` choix-main${paquet ? '' : ' donne'}` : ''}${spec.compact ? ' compact' : ''}${spec.cartes && spec.options.length && spec.options.every(o => o.carteJoueur) ? ' joueurs' : ''}">${spec.options.map((o, i) => {
        const { duree: _d, ...canaux } = o.effet || o;
        const mots = [...(o.rien ? [] : motsDEffet(canaux, Object.keys(canauxDe(canaux)).length ? o.duree : null)), ...(o.mutation ? motsDeMutation(o.mutation) : []), ...motsDeCarte(o, noms), ...(o.mots || [])];
        // EN CARTES (S73) : le même choix, dans le costume d'une carte à collectionner.
        if (spec.cartes) return carteHtml({
          cle: esc(o.cle), rarete: o.rarete, i, ico: o.ico, nomHtml: sub(o.nom), typeHtml: esc(o.type || ''),
          artHtml: o.art || '', texteHtml: o.texte ? sub(o.texte) : (o.mutation ? esc(MUTATIONS[o.mutation].quoi) : ''),
          bonHtml: o.bon ? sub(o.bon) : '', prixHtml: o.prix ? sub(o.prix) : '', coinHtml: o.coin ? esc(o.coin) : '',
          pucesHtml: puces(mots.map(x => ({ ...x, txt: String(x.txt).replace(/\{nom\}/g, nom).replace(/\{noms\}/g, noms) }))) + (o.quand ? `<span class="puce neutre duree">${esc(o.quand)}</span>` : ''),
          desactive: o.desactive ? esc(o.desactive) : '',
          dos: paquet, r: paquet ? rangDe(i) : null, meilleure: paquet && rangDe(i) === ordre.length - 1 && ((RANG_RARETE[o.rarete] || 0) >= 2 || !!o.eclat),
          joueurHtml: o.carteJoueur || '', motChoixHtml: o.motChoix ? esc(o.motChoix) : '',
        });
        return `<button type="button" class="choix-option${o.visage ? ' avec-visage' : ''}" data-choix="${esc(o.cle)}"${o.desactive ? ' disabled' : ''}>
          ${o.visage ? `<span class="choix-option-visage" aria-hidden="true">${o.visage}</span>` : ''}
          <span class="choix-option-nom">${o.ico ? `${o.ico} ` : ''}${sub(o.nom)}</span>
          ${o.sous ? `<span class="choix-option-sous">${sub(o.sous)}</span>` : ''}
          ${o.bon ? `<span class="choix-option-bon">+ ${sub(o.bon)}</span>` : ''}
          ${o.prix ? `<span class="choix-option-prix">− ${sub(o.prix)}</span>` : ''}
          ${o.mutation ? `<span class="choix-option-mut">${MUTATIONS[o.mutation].ico} ${esc(MUTATIONS[o.mutation].quoi)}</span>` : ''}
          <span class="choix-puces">${puces(mots.map(x => ({ ...x, txt: String(x.txt).replace(/\{nom\}/g, nom).replace(/\{noms\}/g, noms) })))}${o.quand ? `<span class="puce neutre duree">${esc(o.quand)}</span>` : ''}</span>
          ${o.desactive ? `<span class="choix-option-non">${esc(o.desactive)}</span>` : ''}
        </button>`;
      }).join('')}</div>
      ${(spec.cartes || spec.genre) && spec.fermable ? `<button type="button" class="btn choix-plus-tard">${esc(spec.motFermer || 'Plus tard')}</button>` : ''}
    </div>
  </div>`;
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  // Un paquet se tait tant qu'il est scellé : ses sons sont ceux de l'ouverture.
  if (spec.cartes && !spec.lecture && !paquet) jouerSon(spec.genre === 'recompense' ? 'recompense' : 'donne');
  const fermer = (silencieux = false) => {
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
    if (!silencieux && spec.onFerme) spec.onFerme();
  };
  fermerChoixCourant = fermer;
  // UNE VUE À LIRE (S74, « Mon deck ») : les cartes ne se prennent pas.
  m.querySelectorAll('[data-choix]').forEach(b => { if (spec.lecture) { b.classList.add('lecture'); return; } b.onclick = () => { fermer(true); spec.onChoix(b.dataset.choix); }; });
  // LA CARTE D'UN JOUEUR OFFERT se touche pour voir sa fiche (`apercu` de l'option), sans le choisir (S78).
  const apercus = new Map(spec.options.filter(o => typeof o.apercu === 'function').map(o => [String(o.cle), o.apercu]));
  m.querySelectorAll('[data-apercu] .tcj-carte').forEach(el => {
    const voir = apercus.get(el.closest('[data-apercu]').dataset.apercu);
    if (!voir) return;
    el.onclick = () => voir();
    el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); voir(); } };
  });
  for (const x of m.querySelectorAll('.choix-fermer, .choix-plus-tard')) x.onclick = () => fermer();
  pointsDeBande(m);
  if (paquet) brancherPaquet(m, spec.options.length, () => PAQUETS_OUVERTS.add(clePaquet));
  const premier = m.querySelector(paquet ? '.paquet' : '.choix-option:not([disabled])');
  if (premier) premier.focus({ preventScroll: true });
  return () => fermer(true);
}

/*
 * CHOISIR DANS L'ALIGNEMENT (S80). JP : *le screen de choix pour les upgrades
 * et les remplacements sont à chier* ; *donne l'alignement, je clique sur le
 * joueur* ; *dire que x est sur la xième ligne*. « Qui sort ? » était une
 * liste de dix-neuf rangées — visage, nom, rôle, stats, « libère X $ » — où
 * l'on cherchait son troisième défenseur gauche en lisant des noms. Le choix
 * se fait maintenant DANS L'ALIGNEMENT, en petit : les quatre trios, les trois
 * paires, les gardiens et la réserve, chaque rangée titrée par ce qu'elle est
 * (« 1er trio », « 2e paire »), chaque case avec son visage, son nom et ses
 * positions. On voit OÙ joue chacun sans qu'on le nomme par sa case.
 *
 * Deux façons de toucher, jamais d'action sans bouton :
 *   SÉLECTION  (`onChoix`) toucher surligne la case, la barre du bas dit ce
 *              qui va se passer (« Hal Gill (3e paire) sort, … »), et c'est
 *              « Confirmer » qui décide ;
 *   APERÇU     (`onApercu`) toucher ouvre quelque chose par-dessus (la fiche
 *              du joueur, retournée au verso) — l'action est là-bas.
 * Une case qu'on ne peut pas prendre reste visible, grisée, avec sa raison ;
 * quand toute une rangée l'est pour la même raison, la raison se dit une fois,
 * dans son titre.
 *
 * spec : { ico, titre, recit, contexte, aide, motFermer, motConfirmer,
 *          rangees: [{ titre, cases: [{ cle, vide, visage, nom, nomLong, pos, marque, marqueMot, note, non }] }],
 *          barre(cle) → html, onChoix(cle) | onApercu(cle), onFerme() }
 */
export function ouvrirAlignement(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  const apercu = typeof spec.onApercu === 'function';
  // La raison commune d'une rangée entière (« pas sa position ») se dit une fois, dans son titre…
  const communeDe = r => { const pleines = r.cases.filter(c => !c.vide); return pleines.length && pleines.every(c => c.non && c.non === pleines[0].non) ? pleines[0].non : ''; };
  // …et une fois pour toutes quand toutes les rangées grisées le sont pour la même (une carte de gardien : sept rangées).
  const communes = spec.rangees.map(communeDe).filter(Boolean);
  const partout = communes.length >= 3 && communes.every(x => x === communes[0]) ? communes[0] : '';
  const rangee = r => {
    const commune = communeDe(r);
    return `<section class="aln-rangee${commune ? ' grisee' : ''}" data-cases="${r.cases.length}">
      <h3 class="aln-titre">${esc(r.titre)}${commune && !partout ? ` <small>· ${esc(commune)}</small>` : ''}</h3>
      <div class="aln-cases">${r.cases.map(c => (c.vide
        ? `<div class="aln-case aln-vide" aria-label="Case vide"><span class="aln-nom">Case vide</span>${c.pos ? `<span class="aln-pos">${esc(c.pos)}</span>` : ''}</div>`
        : `<button type="button" class="aln-case${c.non ? ' non' : ''}" data-aln="${esc(c.cle)}" aria-pressed="false"${c.non ? ' disabled' : ''} title="${esc([c.nomLong || c.nom, c.pos, c.marqueMot, c.non].filter(Boolean).join(' · '))}">
            <span class="aln-visage" aria-hidden="true">${c.visage || ''}</span>
            <span class="aln-nom">${esc(c.nom)}</span>
            <span class="aln-pos"><span>${esc(c.pos || '')}</span>${c.marque ? `<b class="aln-marque" aria-label="${esc(c.marqueMot || c.marque)}">${esc(c.marque)}</b>` : ''}</span>
            ${c.non && !commune ? `<span class="aln-non">${esc(c.non)}</span>` : !c.non && c.note ? `<span class="aln-note">${esc(c.note)}</span>` : ''}
          </button>`)).join('')}</div>
    </section>`;
  };
  m.innerHTML = `<div class="choix-sheet choix-aln" data-genre="alignement" role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
    <div class="choix-tete">
      <span class="choix-ico">${spec.ico || '🔁'}</span>
      <div class="choix-titres"><div class="choix-titre">${esc(spec.titre)}</div></div>
      <button type="button" class="close-btn choix-fermer" aria-label="${esc(spec.motFermer || 'Retour')}" title="${esc(spec.motFermer || 'Retour')}">✕</button>
    </div>
    <div class="choix-corps">
      ${spec.recit ? `<p class="choix-recit">${esc(spec.recit)}</p>` : ''}
      ${spec.contexte || ''}
      ${partout ? `<p class="aln-grises">Grisées : ${esc(partout)}.</p>` : ''}
      <div class="aln">${spec.rangees.map(rangee).join('')}</div>
    </div>
    <div class="aln-barre">
      <p class="aln-barre-mot" aria-live="polite">${esc(spec.aide || 'Touche un joueur.')}</p>
      <div class="aln-barre-boutons">
        <button type="button" class="btn aln-retour">${esc(spec.motFermer || 'Retour')}</button>
        ${apercu ? '' : `<button type="button" class="btn gold aln-confirmer" disabled>${esc(spec.motConfirmer || 'Confirmer')}</button>`}
      </div>
    </div>
  </div>`;
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  const fermer = (silencieux = false) => {
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
    if (!silencieux && spec.onFerme) spec.onFerme();
  };
  fermerChoixCourant = fermer;
  const mot = m.querySelector('.aln-barre-mot');
  const ok = m.querySelector('.aln-confirmer');
  let choisie = null;
  m.querySelectorAll('.aln-case[data-aln]').forEach(b => {
    b.onclick = () => {
      if (b.disabled) return;
      if (apercu) { spec.onApercu(b.dataset.aln); return; }
      // Toucher la case choisie la relâche ; toucher une autre la remplace.
      choisie = choisie === b.dataset.aln ? null : b.dataset.aln;
      m.querySelectorAll('.aln-case[data-aln]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.aln === choisie)));
      m.querySelector('.aln-barre').classList.toggle('pret', !!choisie);
      mot.innerHTML = choisie && spec.barre ? spec.barre(choisie) : esc(spec.aide || 'Touche un joueur.');
      ok.disabled = !choisie;
    };
  });
  if (ok) ok.onclick = () => { if (!choisie) return; const k = choisie; fermer(true); spec.onChoix(k); };
  for (const x of m.querySelectorAll('.choix-fermer, .aln-retour')) x.onclick = () => fermer();
  // La première case qu'on peut prendre se montre : une carte de gardien ouvre sur les gardiens, pas sur le 1er trio grisé.
  const premier = m.querySelector('.aln-case[data-aln]:not([disabled])');
  if (premier) {
    premier.focus({ preventScroll: true });
    const corps = m.querySelector('.choix-corps'), r = premier.getBoundingClientRect(), rc = corps.getBoundingClientRect();
    if (r.bottom > rc.bottom) premier.closest('.aln-rangee').scrollIntoView({ block: 'center' });
  }
  return () => fermer(true);
}

/*
 * Le paquet en trois temps, portés par des classes sur la feuille :
 * `paquet-ferme` (il luit, il attend), `paquet-dechire` (le rabat part, le
 * paquet tremble), `paquet-revele` (les cartes sortent et se retournent, dans
 * l'ordre `--tc-r`), puis `paquet-fini` : on choisit. Tant que ce n'est pas
 * fini, un toucher n'importe où dans la feuille est intercepté (en capture)
 * — il ouvre, puis il montre tout — pour qu'un doigt pressé ne prenne pas une
 * carte encore face cachée. Le ✕ reste le ✕ : on peut passer sans ouvrir.
 */
function brancherPaquet(m, n, ouvert) {
  const feuille = m.querySelector('.choix-sheet');
  if (!feuille) return;
  let etat = 'ferme', minuteur = 0, dechire = 0;
  const finir = () => {
    if (etat === 'fini') return;
    etat = 'fini';
    clearTimeout(minuteur); clearTimeout(dechire);
    feuille.classList.remove('paquet-ferme', 'paquet-dechire');
    feuille.classList.add('paquet-revele', 'paquet-fini');
    ouvert();
    pointsDeBande(m);
    const premiere = feuille.querySelector('.choix-option:not([disabled])');
    if (premiere) premiere.focus({ preventScroll: true });
  };
  const ouvrir = () => {
    etat = 'ouvre';
    jouerSon('donne');
    feuille.classList.remove('paquet-ferme');
    feuille.classList.add('paquet-dechire');
    // Le paquet a fini de tomber : on l'enlève et les cartes sortent. `paquet-dechire`
    // doit PARTIR ici : tant qu'il est posé, la bande reste invisible, et les cartes se
    // retournaient derrière elle — face cachée à l'écran quand le minuteur finissait.
    dechire = setTimeout(() => { if (etat === 'ouvre') { feuille.classList.replace('paquet-dechire', 'paquet-revele'); jouerSon('recompense'); } }, DECHIRE);
    minuteur = setTimeout(finir, DECHIRE + (n - 1) * REVELE_PAS + REVELE_CARTE + 200);
  };
  feuille.addEventListener('click', ev => {
    if (etat === 'fini' || ev.target.closest('.choix-fermer')) return;
    ev.stopPropagation();
    ev.preventDefault();
    if (etat === 'ferme') ouvrir();
    else { feuille.classList.add('paquet-tout'); finir(); }
  }, true);
}
export const choixOuvert = () => !!fermerChoixCourant;

/*
 * LES POINTS D'UNE BANDE DE CARTES (S74). Sur téléphone, une main se balaie :
 * sans repère, la deuxième carte qui dépasse à droite ne dit pas qu'il y en a
 * trois. Un point par carte, allumé sur celle qu'on regarde. Rien sur grand
 * écran, où toutes les cartes sont côte à côte (la bande ne défile pas).
 */
function pointsDeBande(m) {
  const bande = m.querySelector('.choix-main');
  if (!bande) return;
  const n = bande.children.length;
  let pts = m.querySelector('.choix-points');
  if (!pts) { pts = document.createElement('div'); pts.className = 'choix-points'; pts.setAttribute('aria-hidden', 'true'); bande.after(pts); }
  const maj = () => {
    const defile = bande.scrollWidth - bande.clientWidth > 4;
    pts.hidden = !defile || n < 2;
    if (pts.hidden) return;
    const pas = bande.children[1] ? bande.children[1].offsetLeft - bande.children[0].offsetLeft : bande.clientWidth;
    const i = Math.max(0, Math.min(n - 1, Math.round(bande.scrollLeft / (pas || 1))));
    pts.innerHTML = Array.from({ length: n }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
  };
  bande.addEventListener('scroll', maj, { passive: true });
  maj();
}

/* ======================================================================
   MES LIGNES, EN PLEIN ÉCRAN
   ====================================================================== */
const NOMS_LIGNE = ['1re ligne', '2e ligne', '3e ligne', '4e ligne'];
const ROLES = ['AG', 'C', 'AD', 'DG', 'DD'];
/* Les minutes à forces égales qu'une ligne jouera, ses secondes appliquées. */
function minutes(lignes) {
  const w = POIDS_TRIO.map((x, u) => x * lignes[u].sec / SEC_DEFAUT);
  const s = w.reduce((a, b) => a + b, 0) || 1;
  return w.map(x => x / s * 60);
}
const mmss = m => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`;
/* Le fit d'une ligne à une tactique, et sa chimie, en mots (S71). */
export const motFit = f => (f >= 70 ? 'Sur mesure' : f >= 55 ? 'Bon fit' : f >= 40 ? 'Fit moyen' : 'Mauvais fit');
const motChimie = c => (c >= 70 ? 'excellente' : c >= 45 ? 'bonne' : c >= 20 ? 'correcte' : 'naissante');
/* L'entente et la maîtrise, de 0 à 1, en mots (S73). */
const motAppris = x => (x >= 0.75 ? 'solide' : x >= 0.45 ? 'bonne' : x >= 0.2 ? 'en route' : 'à bâtir');
const plafondChimie = c => (c >= 70 ? 'haut' : c >= 45 ? 'bon' : c >= 20 ? 'bas' : 'très bas');

const nomSys = k => { const S = TACTIQUES[k] || SYSTEMES_D[k]; return S ? `${S.ico} ${esc(S.nom)}` : ''; };
/*
 * LES SYSTÈMES D'UNE UNITÉ (S79), pour le tiroir de l'alignement et la
 * préparation du match : les systèmes et leur fit, le conseil quand un autre
 * lui irait nettement mieux (un toucher l'applique), ce que fait le sien (en
 * chiffres, au prorata du fit), qui il étouffe et qui l'étouffe, ce qu'il
 * demande à chaque poste — et ce qu'il y a en face.
 */
export function systemesHtml({ lineup, u, groupe, l, adv = null, advNom = '', chimieDe = null }) {
  const D = groupe === 'D';
  const SYS = D ? SYSTEMES_D : TACTIQUES;
  const attr = D ? 'tacd' : 'tac';
  const cle = SYS[D ? l.tacD : l.tac] ? (D ? l.tacD : l.tac) : 'hourra';
  const S = SYS[cle];
  const fit = S.slots ? fitUnite(lineup, groupe, u, cle) : 0;
  const classeFit = f => (f >= 55 ? ' bon' : f < 40 ? ' prix' : '');
  const meilleur = D ? meilleurSystemeD(lineup, u) : meilleureTactique(lineup, u);
  const fM = SYS[meilleur] && SYS[meilleur].slots ? fitUnite(lineup, groupe, u, meilleur) : 0;
  const conseil = meilleur !== cle && fM >= fit + 10
    ? `<div class="ln-conseil">💡 ${D ? 'Cette paire' : 'Ce trio'} irait mieux en <button type="button" class="ln-conseil-btn" data-${attr}="${meilleur}">${nomSys(meilleur)}</button> <small>${motFit(fM).toLowerCase()}</small></div>` : '';
  // En face : le trio adverse de même rang, et sa paire.
  const a = adv && adv[u];
  const aF = a && TACTIQUES[a.tac] && TACTIQUES[a.tac].slots ? a.tac : null;
  const aD = a && u < 3 && SYSTEMES_D[a.tacD] && SYSTEMES_D[a.tacD].slots ? a.tacD : null;
  let enFace = '';
  if (aF && !D) {
    const menace = TACTIQUES[aF].bat === cle || (aD && SYSTEMES_D[aD].bat === cle);
    const pour = contreDe(aF);
    enFace = `<div class="gl-adv">En face, ${esc(advNom)} : <b>${nomSys(aF)}</b>${aD ? ` et une paire en <b>${nomSys(aD)}</b>` : ''}${S.bat === aF ? ' · <span class="ok">✓ tu étouffes ses actions spéciales</span>' : pour ? ` · pour l'étouffer : <b>${nomSys(pour)}</b>` : ''}${menace ? ' · <span class="prix">⚠️ son système étouffe le tien</span>' : ''}</div>`;
  } else if (aF) {
    const pour = contreDeD(aF);
    enFace = `<div class="gl-adv">En face, le trio ${esc(avecArticle('de', advNom || 'Eux'))} : <b>${nomSys(aF)}</b>${S.bat === aF ? ' · <span class="ok">✓ ta paire étouffe ses actions spéciales</span>' : pour ? ` · ta paire l'étouffe en <b>${nomSys(pour)}</b>` : ''}</div>`;
  }
  const boutons = Object.entries(SYS).map(([k, X]) => {
    const f = X.slots ? fitUnite(lineup, groupe, u, k) : null;
    return `<button type="button" class="gl-tac${cle === k ? ' on' : ''}${aF && X.bat === aF ? ' contre' : ''}" data-${attr}="${k}" aria-pressed="${cle === k}" title="${esc(X.mot)}"><b>${X.ico} ${esc(X.nom)}</b><span class="gl-tac-fit${f == null ? '' : classeFit(f)}">${f == null ? 'rien à assortir' : motFit(f)}</span>${f != null && chimieDe ? `<small class="gl-tac-soir">chimie ${motChimie(chimieDe(k))}</small>` : ''}</button>`;
  }).join('');
  const effets = effetsDeSysteme(S, fit);
  const etouffe = S.bat ? (D ? ` Étouffe l'action spéciale d'un trio en ${nomSys(S.bat)}.` : ` Étouffe ${nomSys(S.bat)}.`) : '';
  const cT = !D && S.slots ? contreDe(cle) : null, cD = !D && S.slots ? contreDeD(cle) : null;
  const parQui = cT || cD ? ` Étouffé par ${[cT && `un trio en ${nomSys(cT)}`, cD && `une paire en ${nomSys(cD)}`].filter(Boolean).join(' ou ')}.` : '';
  const choisie = `<div class="ln-choisie"><span class="gl-mot">${esc(S.mot)}${etouffe}${parQui}</span>${effets.length ? `<span class="choix-puces">${puces(effets)}<span class="puce neutre" title="Le gain d'un système suit le fit de ses joueurs : rien au mauvais fit, tout sur mesure. Son prix se paie toujours.">gain à ${Math.round(100 * echelleFit(fit))} %</span></span>` : ''}</div>`;
  // Ce qu'il demande, poste par poste : le rôle, et si le joueur de la case l'a.
  const js = joueursDeLigne(lineup, u);
  const demande = S.slots ? (D ? ['DG', 'DD'] : ['AG', 'C', 'AD']).filter(r => r in js && S.slots[r]).map(r => {
    const prof = S.slots[r], P = PROFILS[groupe][prof], p = js[r];
    const fr = p ? ((profilsDe(p) || {})[prof] ?? 0) : null;
    const marque = fr == null ? '' : fr >= 60 ? '✓' : fr < 40 ? '✗' : '≈';
    return `<span class="ln-dem${fr == null ? '' : fr >= 60 ? ' fit-bon' : fr < 40 ? ' fit-mauvais' : ''}" title="${esc(P.nom)}, lu dans ${esc(P.mot)}${p ? ` — ${esc(p.n)} : ${niveauDe(fr)}` : ' — case vide'}"><b>${r}</b> ${P.ico} ${esc(P.nom)}${marque ? ` <i>${marque}</i>` : ''}</span>`;
  }).join('') : '';
  return `${enFace}<div class="gl-tacs ln-tacs">${boutons}</div>${conseil}${choisie}${demande ? `<div class="ln-demande"><span class="gl-k">Il demande</span>${demande}</div>` : ''}`;
}
/**
 * spec : {
 *   titre, lineup (case → joueur), lignes [{ tac, tacD, agr, sec }] × 4, chimie [4], energie { clé: 0-100 },
 *   adv: { nom, lignes [{ tac }] } | null, match: { importance, ad } | null,
 *   onAppliquer(lignes, match), onBanc() | null, sousTitre
 * }
 */
/*
 * LE PLACEMENT D'UN JOUEUR DANS SA LIGNE (S72) : ▼ trop bas (son talent est
 * gaspillé, l'unité porte un malus), ▲ trop haut (un cran, léger), ↔ hors de
 * sa position naturelle. Rien s'il est à sa place.
 */
function placementDe(p, role, u) {
  const g = role === 'DG' || role === 'DD' ? 'D' : 'F';
  const unite = g === 'D' ? u : u;
  const slot = SLOTS.find(s => !s.scratch && s.role === role && s.unit === unite && s.group === g);
  const bits = [];
  // La zone GRANDIT avec « ⏫ Monte d'un cran » (l'atelier, S78) : `unitesIdeales`,
  // jamais la zone brute de `getLineZone`, qui ignorerait l'édition.
  const ideal = unitesIdeales(p, getHiddenRatings(p).v) || [];
  if (ideal.length && unite > Math.max(...ideal)) bits.push(['▼', 'Trop bas : son talent est gaspillé ici, l\'unité porte un malus']);
  else if (ideal.length && unite < Math.min(...ideal)) bits.push(['▲', 'Un cran trop haut : léger malus']);
  const pen = slot ? getPositionPenalty(p, slot) : 0;
  if (pen > 0) {
    const reste = penaliteAdaptee(p, slot);
    bits.push(['↔', reste < pen * 0.6 ? 'Hors de sa position naturelle, mais il s\'y adapte' : 'Hors de sa position naturelle : il s\'y fera en jouant là']);
  }
  return bits.length ? { html: bits.map(([m, t]) => ` <span class="gl-j-place" title="${esc(t)}">${m}</span>`).join(''), bits } : null;
}
/*
 * CE QUI JOUE SUR TA FORMATION (S72). JP : *les bonus et malus devraient être
 * avec les stratégies, tout devrait être ensemble*. Les effets en cours —
 * dilemmes, séquences, élan, paris, investissements, cartes — et les absents
 * se lisent ici, à côté des lignes, avec le nombre de matchs qui restent.
 */
export function effetsHtml(e) {
  if (!e) return '';
  const lignes = [];
  for (const x of e.effets || []) {
    const mots = motsDEffet(canauxDe(x));
    if (!mots.length) continue;
    lignes.push(`<div class="gl-effet"><span class="gl-effet-nom">${x.ico ? `${x.ico} ` : ''}${esc(x.nom || 'Effet')}${x.choix ? ` <small>· ${esc(x.choix)}</small>` : ''}</span><span class="choix-puces">${puces(mots)}<span class="puce neutre duree">${plur(x.reste, 'match')}</span></span></div>`);
  }
  for (const c of e.cartes || []) if (CARTES[c]) lignes.push(`<div class="gl-effet"><span class="gl-effet-nom">${CARTES[c].ico} ${esc(CARTES[c].nom)} <small>· carte</small></span><span class="choix-puces">${puces(motsDEffet(canauxDe(CARTES[c])))}<span class="puce neutre duree">la saison</span></span></div>`);
  for (const a of e.absents || []) lignes.push(`<div class="gl-effet"><span class="gl-effet-nom">👥 ${esc(a.p.n)} <small>· au vestiaire</small></span><span class="choix-puces"><span class="puce neutre duree">${plur(a.reste, 'match')}</span></span></div>`);
  if (e.gardienAux) lignes.push(`<div class="gl-effet"><span class="gl-effet-nom">🧤 L'auxiliaire au filet</span><span class="choix-puces"><span class="puce neutre duree">${plur(e.gardienAux, 'match')}</span></span></div>`);
  return `<section class="gl-effets"><div class="gl-sec-titre">Ce qui joue sur ta formation</div>${lignes.length ? lignes.join('') : '<div class="gl-mot">Rien pour l\'instant : tes lignes jouent sur leur propre valeur.</div>'}</section>`;
}
export function ouvrirLignes(spec) {
  const m = $('lignesModal');
  if (!m) return;
  /*
   * LA CHIMIE DE CE SOIR (S73) : entente × maîtrise × fit, pour la tactique
   * que tu choisis. Sans photo de l'apprentissage (avant la saison), la chimie
   * que l'appelant a donnée.
   */
  const app = spec.apprentissage ? apprentissagePhoto(spec.apprentissage) : null;
  const chimieDe = (u, l) => (app ? chimieLigne(app, spec.lineup, u, l) : (spec.chimie || [])[u] || 0);
  const brouillon = spec.lignes.map(l => ({ ...l }));
  const match = spec.match ? { importance: spec.match.importance || 'normale', ad: spec.match.ad || 0 } : null;
  let ouverte = 0;

  const joueurLigne = (u, role) => {
    const js = joueursDeLigne(spec.lineup, u);
    if (!(role in js)) return '';
    const p = js[role];
    const T = role === 'DG' || role === 'DD' ? SYSTEMES_D[brouillon[u].tacD] : TACTIQUES[brouillon[u].tac];
    const voulu = T && T.slots ? T.slots[role] : null;
    const pr = p && profilsDe(p);
    const pp = p && profilPrincipal(p);
    const g = role === 'DG' || role === 'DD' ? 'D' : 'F';
    const e = p ? (spec.energie[getPlayerKey(p)] ?? 100) : 0;
    const fitRole = voulu && pr ? pr[voulu] : null;
    const c = p ? carrureDe(p) : null;
    const marque = fitRole == null ? '' : fitRole >= 60 ? '✓' : fitRole < 40 ? '✗' : '≈';
    // TOUT CE QUI JOUE SUR LE TRIO, ICI (S72) : sa zone (le rang de ligne où
    // il rend) et sa position (mauvaise aile, centre à l'aile).
    const place = p ? placementDe(p, role, u) : null;
    return `<div class="gl-j${fitRole != null ? (fitRole >= 60 ? ' fit-bon' : fitRole < 40 ? ' fit-mauvais' : '') : ''}">
      <span class="gl-j-role">${role}</span>
      <span class="gl-j-nom">${p ? esc(p.n) : '<i>vide</i>'}${place ? place.html : ''}</span>
      <span class="gl-j-prof" title="${pp ? `Son meilleur rôle : ${esc(pp.nom)} (${niveauDe(pp.fit)})${c ? ` · ${c.mot}` : ''}` : ''}">${c ? c.ico : ''}</span>
      ${voulu ? `<span class="gl-j-voulu" title="Ce que ${esc(T.nom)} demande à ce poste : ${esc(PROFILS[g][voulu].nom)} — il y est ${niveauDe(fitRole ?? 0)}">${PROFILS[g][voulu].ico} <b class="gl-j-marque">${marque}</b></span>` : '<span class="gl-j-voulu"></span>'}
      <span class="gl-j-energie" title="Énergie ${e} %"><span style="width:${e}%" class="${e < 60 ? 'bas' : e < 85 ? 'moyen' : ''}"></span></span>
      ${(p && p._mutCles || []).map(k => MUTATIONS[k] ? `<span class="gl-j-mut" title="${esc(MUTATIONS[k].nom)}">${MUTATIONS[k].ico}</span>` : '').join('')}
    </div>`;
  };

  function dessiner() {
    const mins = minutes(brouillon);
    const tete = `<div class="choix-tete">
      <span class="choix-ico">🏒</span>
      <div class="choix-titres"><div class="choix-titre">${esc(spec.titre || 'Mes lignes')}</div>${spec.sousTitre ? `<div class="choix-irl">${esc(spec.sousTitre)}</div>` : ''}</div>
      <button type="button" class="close-btn gl-annuler" aria-label="Fermer sans rien changer" title="Fermer sans rien changer">✕</button>
    </div>`;
    /*
     * LA CONSIGNE TIENT EN UNE RANGÉE (S71). JP : *avoir les bonnes infos au
     * bon endroit, lisible*. Trois grandes cases poussaient les lignes — ce
     * qu'on vient régler — sous le premier écran du téléphone. Trois boutons
     * courts, et l'effet du choix courant en une ligne dessous.
     */
    const Icour = match ? IMPORTANCES[match.importance] || IMPORTANCES.normale : null;
    const consigne = match ? `<section class="gl-consigne">
      <div class="gl-sec-titre">Consigne du match</div>
      <div class="gl-seg gl-seg-court">${Object.entries(IMPORTANCES).map(([k, I]) => `<button type="button" class="gl-seg-btn${match.importance === k ? ' on' : ''}" data-importance="${k}">
        <b>${I.ico} ${esc(I.nom)}</b><span class="choix-puces">${puces(motsDEffet(I))}</span></button>`).join('')}</div>
      <div class="gl-consigne-effet"><small>${esc(Icour.mot)}</small> <span class="choix-puces">${puces(motsDEffet(Icour))}</span></div>
      <div class="gl-ad"><span>🛡️ Défense</span><input type="range" min="-2" max="2" step="1" value="${match.ad}" class="gl-ad-range" aria-label="Attaque ou défense"><span>Attaque 🎯</span></div>
      <div class="choix-puces gl-ad-puces">${puces(motsDEffet({ finition: 1 + 0.025 * match.ad, defense: 1 + 0.02 * match.ad }))}${match.ad ? '' : '<span class="puce neutre">Équilibré</span>'}</div>
    </section>` : '';
    const onglets = `<div class="gl-onglets" role="tablist">${NOMS_LIGNE.map((n, u) => {
      const T = TACTIQUES[brouillon[u].tac] || TACTIQUES.hourra, D = u < 3 ? SYSTEMES_D[brouillon[u].tacD] || SYSTEMES_D.hourra : null;
      return `<button type="button" role="tab" class="gl-onglet${u === ouverte ? ' on' : ''}" data-ligne="${u}" aria-selected="${u === ouverte}">
        <b>${n}</b><span>${T.ico}${D ? ` ${D.ico}` : ''} ${esc(T.nom)}</span><small>chimie ${motChimie(chimieDe(u, brouillon[u]))} · ${mmss(mins[u])}</small></button>`;
    }).join('')}</div>`;
    const u = ouverte, l = brouillon[u];
    const sansSysteme = l.tac === 'hourra' && (u > 2 || l.tacD === 'hourra');
    const fitCourant = fitDeLigne(spec.lineup, u, l);
    // LA CARRURE DE LA LIGNE (S71) : c'est elle qui dit si le jeu physique paie.
    const ph = physiqueLigne(spec.lineup, u);
    const carrureLigne = ph >= 0.56 ? '🪨 ligne costaude' : ph <= 0.44 ? '🪶 ligne légère' : '⚖️ ligne moyenne';
    // UN SYSTÈME POUR LE TRIO, UN AUTRE POUR LA PAIRE (S79), chacun sous le nom de ce que ses joueurs sont.
    const choixDe = groupe => {
      const id = identiteUnite(spec.lineup, groupe, u);
      const titre = `<div class="gl-sec-titre">Système ${groupe === 'D' ? 'de la paire' : 'du trio'}${id ? ` · <span class="ln-id">${id.ico} ${esc(id.nom)}</span>` : ''}</div>`;
      return titre + systemesHtml({ lineup: spec.lineup, u, groupe, l, adv: spec.adv && spec.adv.lignes, advNom: spec.adv ? spec.adv.nom : '',
        chimieDe: app ? k => chimieDe(u, { ...l, [groupe === 'D' ? 'tacD' : 'tac']: k }) : null });
    };
    const detail = `<section class="gl-ligne">
      <div class="gl-joueurs">${ROLES.map(r => joueurLigne(u, r)).join('')}</div>
      <div class="gl-etat">
        <div><span class="gl-k">Fit</span> <b>${sansSysteme ? '—' : motFit(fitCourant)}</b> <small>${sansSysteme ? 'aucune chimie' : `plafond de chimie : ${plafondChimie(chimieMax(fitCourant))}`}</small></div>
        <div><span class="gl-k">Chimie ce soir</span> <span class="gj-barre gl-chimie"><span style="width:${Math.round(chimieDe(u, l))}%"></span></span> <b>${motChimie(chimieDe(u, l))}</b></div>
        ${app && !sansSysteme ? `<div class="gl-appris"><span>🤝 Entente : <b>${motAppris(ententeLigne(app, spec.lineup, u))}</b></span><span>📘 Maîtrise des systèmes : <b>${motAppris(maitriseLigne(app, spec.lineup, u, l))}</b></span></div>
        <div class="gl-mot">La chimie s'apprend et ne se perd pas : changer de système ou de joueur un soir ne défait rien. Plus une ligne joue un système, mieux elle le joue.</div>` : ''}
      </div>
      ${choixDe('F')}
      ${u < 3 ? choixDe('D') : ''}
      <div class="gl-sec-titre">Agressivité · ${carrureLigne}</div>
      <div class="gl-mot">Le jeu physique rapporte aux lignes costaudes 🪨. Une ligne légère 🪶 accroche au lieu de frapper : elle prend des punitions.</div>
      <div class="gl-seg">${AGRESSIVITES.map((A, i) => {
        const b = bilanAgressivite(i, ph);
        const verdict = i === 1 ? { txt: 'Par défaut', bon: null } : b.net > 0.006 ? { txt: '✓ Payant pour cette ligne', bon: true } : b.net < -0.006 ? { txt: '✗ Coûteux pour cette ligne', bon: false } : { txt: '≈ Neutre pour cette ligne', bon: null };
        const effets = i === 1 ? [] : [
          { txt: `Défense ${flechesDe(1 + b.defense)}`, bon: b.defense > 0 },
          { txt: `Punitions ${flechesDe(1 + b.punitions, [0.1, 0.3])}`, bon: b.punitions < 0 },
          ...motsDEffet({ energie: A.energie })];
        return `<button type="button" class="gl-seg-btn${l.agr === i ? ' on' : ''}" data-agr="${i}">
        <b>${A.ico} ${esc(A.nom)}</b><span class="choix-puces">${puces([verdict, ...effets])}</span></button>`;
      }).join('')}</div>
      <div class="gl-sec-titre">Glace : ${l.sec} s par présence · ≈ ${mmss(mins[u])} à forces égales</div>
      <input type="range" class="gl-sec" min="${SEC_MIN}" max="${SEC_MAX}" step="5" value="${l.sec}" aria-label="Secondes de présence de la ${NOMS_LIGNE[u]}">
      <div class="gl-mot">Plus de glace, plus de lancers pour cette ligne — et plus de fatigue : un joueur usé rend moins et, sous 60 % d'énergie, se blesse plus.</div>
    </section>`;
    m.innerHTML = `<div class="choix-sheet gl-sheet" role="dialog" aria-modal="true" aria-label="Mes lignes">
      ${tete}
      <div class="choix-corps">${effetsHtml(spec.effets)}${spec.depistage ? depistageHtml(pistesDuRapport(spec.depistage), { nomAdv: spec.adv ? spec.adv.nom : 'Eux' }) : ''}${consigne}${onglets}${detail}</div>
      <div class="gl-pied">
        ${spec.onBanc ? '<button type="button" class="btn gl-banc">Changer les trios</button>' : ''}
        <button type="button" class="btn go gl-appliquer">${esc(spec.motAppliquer || 'Appliquer')}</button>
      </div>
    </div>`;
    brancher();
  }
  function brancher() {
    m.querySelectorAll('[data-ligne]').forEach(b => { b.onclick = () => { ouverte = Number(b.dataset.ligne); dessiner(); }; });
    m.querySelectorAll('[data-tac]').forEach(b => { b.onclick = () => { brouillon[ouverte].tac = b.dataset.tac; dessiner(); }; });
    m.querySelectorAll('[data-tacd]').forEach(b => { b.onclick = () => { brouillon[ouverte].tacD = b.dataset.tacd; dessiner(); }; });
    m.querySelectorAll('[data-agr]').forEach(b => { b.onclick = () => { brouillon[ouverte].agr = Number(b.dataset.agr); dessiner(); }; });
    const s = m.querySelector('.gl-sec');
    if (s) s.onchange = () => { brouillon[ouverte].sec = Number(s.value); dessiner(); };
    m.querySelectorAll('[data-importance]').forEach(b => { b.onclick = () => { match.importance = b.dataset.importance; dessiner(); }; });
    const ad = m.querySelector('.gl-ad-range');
    if (ad) ad.onchange = () => { match.ad = Number(ad.value); dessiner(); };
    m.querySelector('.gl-annuler').onclick = fermer;
    m.querySelector('.gl-appliquer').onclick = () => { fermer(); spec.onAppliquer(brouillon, match); };
    const bb = m.querySelector('.gl-banc');
    if (bb) bb.onclick = () => { fermer(); spec.onBanc(); };
  }
  const fermer = () => { m.hidden = true; m.innerHTML = ''; document.body.classList.remove('choix-ouvert'); };
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  dessiner();
}

/* Le résumé d'une ligne pour l'affiche du match : sa tactique et sa chimie. */
export function resumeLignes(lignes, chimie) {
  return lignes.map((l, u) => {
    const T = TACTIQUES[l.tac] || TACTIQUES.hourra, D = u < 3 && SYSTEMES_D[l.tacD] && l.tacD !== 'hourra' ? SYSTEMES_D[l.tacD] : null;
    const c = chimie[u] || 0;
    return `<span class="gl-resume" title="${esc(NOMS_LIGNE[u])} : trio en ${esc(T.nom)}${D ? `, paire en ${esc(D.nom)}` : ''}, chimie ${motChimie(c)}">${T.ico}${D ? D.ico : ''}<small>${'•'.repeat(c >= 70 ? 3 : c >= 35 ? 2 : 1)}</small></span>`;
  }).join('');
}
void SLOTS;

/* ======================================================================
   LA STRATÉGIE D'UNE LIGNE, DANS L'ALIGNEMENT (S78)
   ======================================================================
   JP : *Alignement et stratégie et trio, ça devrait être ensemble*, et *sur
   mobile, trucs comme stratégie … dropdown, modals … pour gagner espace,
   page trop longue, ça fait qu'on perd parfois l'info*.

   « Mes lignes » était une modale À CÔTÉ de l'alignement : on y relisait les
   cinq joueurs qu'on venait de quitter, la tactique que l'en-tête du trio
   répétait déjà, et le banc la répétait une troisième fois en icônes. Les
   réglages vivent maintenant SOUS leur trio, dans un tiroir : fermé, il dit
   en une ligne la tactique, le fit et la glace ; ouvert, il montre les
   commandes et le résumé se tait (il dirait ce que les boutons disent).
   Les noms ne s'y répètent pas — ils sont dans les cases, juste au-dessus :
   ce qui dépend du joueur, la marque du profil demandé, s'écrit par POSTE.

   `ouvrirLignes` reste : la préparation d'avant-match (js/saison.js) a sa
   consigne et son dépistage, et c'est un moment à part.

   spec : { lineup, lignes, chimie, apprentissage, adv: { nom, lignes } | null }
   Rend { sommaire, corps } ; l'appelant pose le tiroir et branche ses
   boutons ([data-tac], [data-tacd], [data-agr], .gl-sec). Le corps ne se
   calcule que pour un tiroir OUVERT (`ouvert`) : l'alignement se redessine
   à chaque signature, et huit fits × sept unités pour des tiroirs fermés,
   c'est du travail que personne ne lit.

   S79 : UN TIROIR PAR TRIO, UN PAR PAIRE (`groupe`). JP : *stratégie des
   def et attaquants différents?* Sous le trio, son système (`tac`), et
   l'agressivité et la glace de la ligne ; sous la paire, son système
   (`tacD`). Le corps commun est `systemesHtml`.
*/
const NOMS_TRIO = ['1er trio', '2e trio', '3e trio', '4e trio'];
export function strategieDeLigne(spec, u, ouvert = true, groupe = 'F') {
  // La photo de l'apprentissage, une fois par rendu pour les sept tiroirs.
  if (spec._app === undefined) spec._app = spec.apprentissage ? apprentissagePhoto(spec.apprentissage) : null;
  const app = spec._app;
  const D = groupe === 'D';
  const l = spec.lignes[u];
  const SYS = D ? SYSTEMES_D : TACTIQUES;
  const cle = SYS[D ? l.tacD : l.tac] ? (D ? l.tacD : l.tac) : 'hourra';
  const S = SYS[cle];
  // La chimie est celle de la LIGNE (trio et paire) : elle s'écrit sous le trio.
  const chimie = patch => (app ? chimieLigne(app, spec.lineup, u, { ...l, ...patch }) : (spec.chimie || [])[u] || 0);
  const mins = minutes(spec.lignes);
  const sansFit = !S.slots;
  const fit = sansFit ? 0 : fitUnite(spec.lineup, groupe, u, cle);
  const classeFit = f => (f >= 55 ? ' bon' : f < 40 ? ' prix' : '');

  // FERMÉ : une ligne. La chimie ne s'y écrit que derrière le banc — avant
  // la saison, elle est « naissante » pour les quatre, et le dire quatre fois
  // n'apprend rien.
  const sommaire = `<span class="ln-som-k">Système</span><span class="ln-som-detail"><b>${S.ico} ${esc(S.nom)}</b>${sansFit ? '' : `<span class="ln-som-fit${classeFit(fit)}">${motFit(fit)}</span>`}${D ? '' : `${app ? `<span>chimie ${motChimie(chimie({}))}</span>` : ''}<span>${mmss(mins[u])} de glace</span>`}</span><span class="ln-som-ouvre" aria-hidden="true"></span>`;
  if (!ouvert) return { sommaire, corps: '' };

  const choix = systemesHtml({ lineup: spec.lineup, u, groupe, l, adv: spec.adv && spec.adv.lignes, advNom: spec.adv ? spec.adv.nom : '',
    chimieDe: app ? k => chimie({ [D ? 'tacD' : 'tac']: k }) : null });
  if (D) return { sommaire, corps: `${choix}<div class="gl-mot">Elle joue avec le ${NOMS_TRIO[u]} : leur chimie, leur agressivité et leur glace se lisent et se règlent sous le trio.</div>` };

  const ph = physiqueLigne(spec.lineup, u);
  const carrure = ph >= 0.56 ? '🪨 ligne costaude' : ph <= 0.44 ? '🪶 ligne légère' : '⚖️ ligne moyenne';
  const agr = AGRESSIVITES.map((A, i) => {
    const b = bilanAgressivite(i, ph);
    const verdict = i === 1 ? 'par défaut' : b.net > 0.006 ? '✓ payant' : b.net < -0.006 ? '✗ coûteux' : '≈ neutre';
    return `<button type="button" class="gl-seg-btn${l.agr === i ? ' on' : ''}" data-agr="${i}" aria-pressed="${l.agr === i}"><b>${A.ico} ${esc(A.nom)}</b><small>${verdict}</small></button>`;
  }).join('');
  const bAgr = bilanAgressivite(l.agr, ph);
  const effetsAgr = l.agr === 1 ? [] : [
    { txt: `Défense ${flechesDe(1 + bAgr.defense)}`, bon: bAgr.defense > 0 },
    { txt: `Punitions ${flechesDe(1 + bAgr.punitions, [0.1, 0.3])}`, bon: bAgr.punitions < 0 },
    ...motsDEffet({ energie: AGRESSIVITES[l.agr].energie })];
  const avecPaire = u < 3 && !(l.tac === 'hourra' && l.tacD === 'hourra');
  const corps = `
    ${choix}
    ${sansFit && !avecPaire ? '' : `<div class="ln-etat"><span>Plafond de chimie${u < 3 ? ' (trio et paire)' : ''} : <b>${plafondChimie(chimieMax(fitDeLigne(spec.lineup, u, l)))}</b></span>${app ? `<span>Ce soir : <b>${motChimie(chimie({}))}</b></span><span>🤝 Entente : <b>${motAppris(ententeLigne(app, spec.lineup, u))}</b></span><span>📘 Maîtrise : <b>${motAppris(maitriseLigne(app, spec.lineup, u, l))}</b></span>` : ''}</div>`}
    <div class="gl-sec-titre">Agressivité · ${carrure}</div>
    <div class="gl-seg gl-seg-court ln-agr">${agr}</div>
    ${effetsAgr.length ? `<div class="choix-puces ln-agr-effets">${puces(effetsAgr)}</div>` : ''}
    <div class="gl-sec-titre">Glace : ${l.sec} s par présence · ≈ ${mmss(mins[u])} à forces égales</div>
    <input type="range" class="gl-sec" min="${SEC_MIN}" max="${SEC_MAX}" step="5" value="${l.sec}" aria-label="Secondes de présence de la ${NOMS_LIGNE[u]}">
    <div class="gl-mot">Plus de glace, plus de lancers — et plus de fatigue : sous 60 % d'énergie, un joueur rend moins et se blesse plus.</div>`;
  return { sommaire, corps };
}

/* ======================================================================
   LE DÉPISTAGE ET TA PRÉPARATION (S76)
   ======================================================================
   JP : *contrer, ça devrait être un scouting de leur stratégie potentielles
   avec taux de succès, qui fait que parfois, t'as chié ta préparation*. Le
   rapport montre trois pistes et leurs chances (`depistageDe`, js/sim.js) ;
   on se prépare pour une. Les cartes de dépistage le resserrent : la vidéo
   RAYE une piste fausse (jamais la bonne — la moins probable d'abord), la
   filature dit la vraie. */
export function pistesDuRapport(dep, { planReel = null, ecarte = 0, revele = false } = {}) {
  if (!dep || !dep.length) return [];
  if (revele && planReel) return dep.map(x => ({ ...x, p: x.plan === planReel ? 100 : 0, ecarte: x.plan !== planReel }));
  const fausses = dep.filter(x => x.plan !== planReel).sort((a, b) => a.p - b.p);
  const rayees = new Set(planReel ? fausses.slice(0, ecarte).map(x => x.plan) : []);
  const tot = dep.filter(x => !rayees.has(x.plan)).reduce((a, x) => a + x.p, 0) || 1;
  return dep.map(x => (rayees.has(x.plan) ? { ...x, p: 0, ecarte: true } : { ...x, p: Math.round(100 * x.p / tot) }));
}
export function depistageHtml(pistes, { nomAdv = 'Eux', prep = [], choisir = false, fx = null } = {}) {
  if (!pistes || !pistes.length) return '';
  const qui = nomAdv === 'Eux' ? '' : ' ' + esc(avecArticle('de', nomAdv));
  const ligne = x => {
    const P = PLANS_ADV[x.plan];
    if (!P) return '';
    const on = prep.includes(x.plan);
    const corps = `<span class="dep-ico">${P.ico}</span><span class="dep-nom"><b>${esc(P.nom)}</b><small>${esc(reglageDuPlan(x.plan))}</small></span>
      <span class="dep-p">${x.ecarte ? '<b>✗</b>' : `<b>${x.p} %</b>`}<i style="--p:${x.p}%"></i></span>`;
    return choisir
      ? `<button type="button" class="dep-piste${on ? ' on' : ''}${x.ecarte ? ' ecarte' : ''}" data-plan="${x.plan}"${x.ecarte ? ' disabled' : ''}>${corps}<span class="dep-prep">${x.ecarte ? 'Écarté' : on ? '🎯 Préparé' : 'Me préparer'}</span></button>`
      : `<div class="dep-piste${x.ecarte ? ' ecarte' : ''}">${corps}</div>`;
  };
  const txt = e => motsDEffet(e).map(m => m.txt).join(' · ');
  const juste = `Leur plan tombe · ${txt(PREP_JUSTE)}${fx && fx.piege ? ` · et ${txt(fx.piege)} (le piège)` : ''}`;
  const rate = fx && fx.improvise ? `pas de malus, et ${txt(fx.improvise)} (l'improvisation)` : txt(PREP_RATEE);
  return `<div class="depistage${choisir ? ' choisir' : ''}">
    <div class="gl-k">🔎 Le dépistage${qui} : leur plan probable</div>
    <div class="dep-pistes">${pistes.map(ligne).join('')}</div>
    ${choisir ? `<div class="dep-regle"><span class="puce bon">🎯 Vise juste : ${esc(juste)}</span><span class="puce prix">💥 Rate : ${esc(rate)}</span><span class="puce neutre">Sans préparation : rien ne change</span></div>` : ''}
  </div>`;
}

/* ======================================================================
   LE DECK DE MATCH (S74) : la main, le deck, les cartes en options
   ====================================================================== */
const GENRES_CARTE = { attaque: 'Attaque', defense: 'Défense', tactique: 'Tactique', synergie: 'Synergie', malediction: 'Malédiction' };
const DE_GENRE = { attaque: 'd\'attaque', defense: 'de défense', tactique: 'tactique', synergie: 'de synergie' };
/*
 * LA RÈGLE D'UNE CARTE, EN CHIFFRES (S76). JP : *des maths plus claires sur
 * les effets, comme dans un vrai deckbuilder*. Tout ce qu'une carte fait se
 * lit ici, déduit de ses champs — jamais écrit deux fois : « Tirs +6 % »,
 * « Eux : punitions +25 % », « Pige 2 cartes », « Écarte 1 plan ». En vert ce
 * qui t'aide, en rouge ce qui coûte. `regle` n'est écrite à la main que pour
 * une carte qui lit ta formation.
 */
export function regleDeCarte(C) {
  if (!C) return [];
  const out = [];
  const txt = e => motsDEffet(e).map(m => m.txt).join(', ');
  if (C.regle) out.push({ txt: C.regle, bon: C.maudite ? false : true });
  out.push(...motsDEffet(C.effet || null));
  for (const m of motsDEffet(C.adv || null)) out.push({ txt: `Eux : ${m.txt}`, bon: m.bon == null ? null : !m.bon });
  if (C.pioche) out.push({ txt: `Pige ${C.pioche} carte${C.pioche > 1 ? 's' : ''}`, bon: true });
  if (C.energiePlus) out.push({ txt: `+${C.energiePlus} énergie`, bon: true });
  if (C.energieTous) out.push({ txt: `Tes patineurs : énergie +${C.energieTous}`, bon: true });
  if (C.lire) out.push({ txt: 'Leur plan tombe', bon: true });
  if (C.annule) out.push({ txt: 'Leur main ne fait rien', bon: true });
  if (C.contre) out.push({ txt: 'Tes 2 premières lignes sur leur contre', bon: null });
  if (C.ecarte) out.push({ txt: `🔎 Écarte ${C.ecarte} plan${C.ecarte > 1 ? 's' : ''} qu'ils ne joueront pas`, bon: true });
  if (C.revele) out.push({ txt: '🔎 Tu sais leur plan : ta préparation vise juste', bon: true });
  if (C.planB) out.push({ txt: '🎯 Tu te prépares pour 2 plans', bon: true });
  if (C.improvise) out.push({ txt: `Si ta préparation rate : pas de malus, et ${txt(C.improvise)}`, bon: true });
  if (C.piege) out.push({ txt: `Si ta préparation vise juste : ${txt(C.piege)} de plus`, bon: true });
  if (C.parGenre) out.push({ txt: `${txt(C.parGenre.effet)} par carte ${DE_GENRE[C.parGenre.genre] || ''} jouée ce match`, bon: true });
  if (C.selonLeurMain) out.push({ txt: `${txt(C.selonLeurMain.effet)} par carte ${DE_GENRE[C.selonLeurMain.genre] || ''} dans leur main`, bon: true });
  if (C.siVide) out.push({ txt: `Si tu dépenses toute ton énergie : ${txt(C.siVide)}`, bon: true });
  if (C.rabais) out.push({ txt: `Tes cartes ${DE_GENRE[C.rabais] || ''} coûtent 1 de moins ce match`, bon: true });
  if (C.pari) out.push({ txt: `🎲 ${Math.round(C.pari.chance * 100)} % : ${txt(C.pari.gagne)} — sinon : ${txt(C.pari.perd)}`, bon: null });
  if (C.enMain) for (const m of motsDEffet(C.enMain)) out.push({ ...m, txt: `Dans ta main : ${m.txt}` });
  if (C.injouable) out.push({ txt: 'Injouable', bon: false });
  if (C.epuise) out.push({ txt: '⌛ Épuisée : elle quitte ton deck après ce match', bon: null });
  return out;
}
/* L'ancien nom : les écrans de récompense et de deck l'appellent encore. */
export const motsDeCarteMatch = regleDeCarte;
/* Une carte de LEUR main, en puces de ton point de vue : ce qui les aide est rouge pour toi. */
export function motsDeCarteAdverse(C) {
  if (!C) return [];
  const out = [];
  for (const m of motsDEffet(C.effet || null)) out.push({ txt: `Eux : ${m.txt}`, bon: m.bon == null ? null : !m.bon });
  for (const m of motsDEffet(C.adv || null)) out.push({ txt: `Toi : ${m.txt}`, bon: m.bon });
  if (C.pari) out.push({ txt: '🎲 Leur pari', bon: null });
  if (C.synergie) out.push({ txt: 'Lit leur formation', bon: null });
  if (C.parGenre) for (const m of motsDEffet(C.parGenre.effet)) out.push({ txt: `Eux : ${m.txt} par carte ${DE_GENRE[C.parGenre.genre] || ''} qu'ils jouent`, bon: m.bon == null ? null : !m.bon });
  if (C.selonLeurMain) for (const m of motsDEffet(C.selonLeurMain.effet)) out.push({ txt: `Eux : ${m.txt} par carte ${DE_GENRE[C.selonLeurMain.genre] || ''} que TU joues`, bon: m.bon == null ? null : !m.bon });
  if (C.energieTous) out.push({ txt: `Leurs patineurs +${C.energieTous} d'énergie`, bon: false });
  return out;
}
/*
 * LEUR MAIN (S74) : les « intentions » de Slay the Spire. On la connaît avant
 * de jouer la sienne — c'est tout le jeu : répondre.
 */
export function mainAdverseHtml(cartes, { nomAdv = 'Eux', energie = ENERGIE_MAIN } = {}) {
  if (!cartes || !cartes.length) return '';
  return `<div class="main-adverse"><div class="gl-k">🂠 La main ${nomAdv === 'Eux' ? 'adverse' : esc(avecArticle('de', nomAdv))} ce soir${energie > ENERGIE_MAIN ? ` · <span class="main-adverse-fort" title="En fin de saison et dans les dernières rondes des séries, l'adversaire joue avec une énergie de plus">⚡ ${energie} d'énergie</span>` : ''}</div><div class="main-adverse-cartes">${cartes.map(c => {
    const C = CARTES_MATCH[c];
    return C ? `<span class="main-adverse-carte tc-${C.rarete}" title="${esc(C.texte)}"><b>${C.ico} ${esc(C.nom)}</b><span class="choix-puces">${puces(motsDeCarteAdverse(C))}</span></span>` : '';
  }).join('')}</div></div>`;
}
/* Le plan de l'adversaire, replié dans l'écran de la main (S74) : une ligne, et le détail au toucher. */
export function planReplie(html, resume) {
  return html ? `<details class="main-plan"><summary>${resume}</summary>${html}</details>` : '';
}
/* Une carte de match en option d'`ouvrirChoix` (une récompense, un retrait). */
export function optionDeCarteMatch(cle) {
  const C = CARTES_MATCH[cle];
  return {
    cle, rarete: C.maudite ? 'commune' : C.rarete, ico: C.ico, nom: C.nom,
    type: `${GENRES_CARTE[C.genre] || ''} · ${C.injouable ? 'injouable' : `${C.cout} énergie`}`,
    texte: C.texte, coin: C.injouable ? '✕' : String(C.cout), mots: motsDeCarteMatch(C),
  };
}
const carteDeMatch = (cle, i, etat, cout = null) => {
  const o = optionDeCarteMatch(cle);
  const coin = cout != null && CARTES_MATCH[cle] && cout < CARTES_MATCH[cle].cout ? `<s>${CARTES_MATCH[cle].cout}</s>${cout}` : esc(o.coin);
  return carteHtml({
    cle: String(i), rarete: o.rarete, i, ico: o.ico, nomHtml: esc(o.nom), typeHtml: esc(o.type),
    texteHtml: `<i class="tc-ambiance">${esc(o.texte)}</i>`, coinHtml: coin, pucesHtml: puces(o.mots),
  }).replace('class="choix-option tc', `class="choix-option tc main-carte${String(cle).endsWith('+') ? ' plus' : ''}${etat ? ` ${etat}` : ''}`);
};

/* Combine des effets de match : les facteurs se multiplient, les minutes aussi. */
function combiner(effets) {
  const out = {};
  for (const e of effets) for (const [k, v] of Object.entries(e)) {
    if (['source', 'nom', 'ico'].includes(k)) continue;
    if (Array.isArray(v)) out[k] = (out[k] || v.map(() => 1)).map((x, i) => x * (v[i] ?? 1));
    else if (typeof v === 'number') out[k] = (out[k] ?? 1) * v;
  }
  return out;
}

/*
 * LA MAIN D'UN MATCH (S74), en plein écran. Cinq cartes, trois d'énergie :
 * on touche une carte pour la jouer, et ce qu'elle fait s'ajoute à l'aperçu —
 * calculé par le moteur lui-même (`effetsDesCartes`), synergies comprises,
 * sauf l'issue d'un pari, qui ne se sait qu'au match. Une carte qui pige
 * ajoute la suite de la pioche à la main. « Recommencer » rend la main du
 * début ; « Jouer ces cartes » décide (zéro carte, c'est aussi un choix).
 *
 * spec : { titre, sousTitre, recit, contexte, equipe, main, pioche, deck,
 *          ajustements (séries : [{ cle, ico, nom, bon, prix, … }] ou null),
 *          onJouer(jouees, enMain, ajustement), motJouer }
 */
export function ouvrirMainDeMatch(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  let main, pioche, jouees, energie, voirDeck = false, aj = null, prep = [];
  const depart = () => { main = spec.main.slice(); pioche = (spec.pioche || []).slice(); jouees = []; energie = ENERGIE_MAIN; };
  depart();
  const joue = new Set();          // les rangs de la main déjà joués
  let premier = true, pigees = new Set();
  const dessiner = () => {
    const defile = m.querySelector('.choix-main');
    const x = defile ? defile.scrollLeft : 0;
    // Leur plan, déplié, le reste d'une carte à l'autre : il se refermait à
    // chaque carte touchée, et on le lit justement en choisissant (QA S74b).
    const planOuvert = !!m.querySelector('.main-plan[open]');
    const cartes = main.map((c, i) => {
      const C = CARTES_MATCH[c];
      const etat = joue.has(i) ? 'jouee' : C.injouable ? 'injouable' : energieDepensee([...jouees, c]) < 0 ? 'trop-cher' : '';
      return carteDeMatch(c, i, [etat, pigees.has(i) ? 'pige' : ''].filter(Boolean).join(' '), joue.has(i) ? null : coutDe(c, [...jouees, c]));
    }).join('');
    const sansPari = jouees.filter(c => !CARTES_MATCH[c].pari);
    const fx = effetsDesCartes(spec.equipe, { jouees: sansPari, enMain: main.filter((c, i) => !joue.has(i) && CARTES_MATCH[c].enMain) }, 'apercu');
    const mots = [...motsDEffet(combiner(fx.effets))];
    for (const x2 of motsDEffet(combiner(fx.adv))) mots.push({ txt: `Eux : ${x2.txt}`, bon: x2.bon == null ? null : !x2.bon });
    if (fx.lire) mots.push({ txt: 'Leur plan tombe', bon: true });
    if (fx.annule) mots.push({ txt: 'Leur main ne fait rien', bon: true });
    if (fx.contre) mots.push({ txt: 'Tes 2 premières lignes sur leur contre', bon: null });
    if (fx.energieTous) mots.push({ txt: `Tes patineurs : énergie +${fx.energieTous}`, bon: true });
    // LE DÉPISTAGE DU SOIR (S76) : les cartes jouées le resserrent, et ta préparation suit.
    const pistes = pistesDuRapport(spec.depistage, { planReel: spec.planReel, ecarte: fx.ecarte, revele: fx.revele });
    if (fx.revele && spec.planReel) prep = [spec.planReel];
    prep = prep.filter(k => pistes.some(x => x.plan === k && !x.ecarte)).slice(-(fx.planB ? 2 : 1));
    const chance = pistes.filter(x => prep.includes(x.plan)).reduce((a, x) => a + x.p, 0);
    if (prep.length) mots.push({ txt: `🎯 Préparé : ${prep.map(k => PLANS_ADV[k] ? PLANS_ADV[k].nom : k).join(' et ')} · ${chance} % de viser juste`, bon: chance >= 50 ? true : null });
    for (const c of jouees) if (CARTES_MATCH[c].pari) mots.push({ txt: `🎲 ${CARTES_MATCH[c].nom} : au match`, bon: null });
    const orbes = Array.from({ length: Math.max(ENERGIE_MAIN, energie) }, (_, i) => `<i class="main-orbe${i < energie ? ' plein' : ''}"></i>`).join('');
    const deck = (spec.deck || []).slice().sort((a, b) => CARTES_MATCH[a].cout - CARTES_MATCH[b].cout || CARTES_MATCH[a].nom.localeCompare(CARTES_MATCH[b].nom, 'fr'));
    m.innerHTML = `<div class="choix-sheet choix-cartes main-sheet" data-genre="main" role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
      <div class="choix-tete">
        <span class="choix-ico">🃏</span>
        <div class="choix-titres"><div class="choix-titre">${esc(spec.titre)}</div>${spec.sousTitre ? `<div class="choix-irl">${esc(spec.sousTitre)}</div>` : ''}</div>
      </div>
      <div class="choix-corps">
        ${spec.recit ? `<p class="choix-recit">${esc(spec.recit)}</p>` : ''}
        ${spec.depistage ? depistageHtml(pistes, { nomAdv: spec.nomAdv || 'Eux', prep, choisir: true, fx }) : ''}
        ${spec.contexte || ''}
        ${spec.ajustements ? `<div class="main-ajuste"><div class="gl-k">Ton ajustement pour ce match</div><div class="main-ajuste-rang">${spec.ajustements.map(o => {
          const { cle: _c, ico: _i, nom: _n, bon: _b, prix: _p, si: _s, pari: _pa, gardienAux: _g, ...canaux } = o;
          const mots = [...motsDEffet(canaux), ...(o.pari ? [{ txt: '🎲 Pari', bon: null }] : []), ...(o.gardienAux ? [{ txt: '🧤 L\'auxiliaire au filet', bon: null }] : [])];
          return `<button type="button" class="main-aj${aj === o.cle ? ' on' : ''}" data-aj="${esc(o.cle)}"><b>${o.ico} ${esc(o.nom)}</b><small>${esc(o.bon || '')}</small><span class="choix-puces">${puces(mots)}</span></button>`;
        }).join('')}</div></div>` : ''}
        <div class="main-energie" aria-label="Énergie : ${energie}"><span class="gl-k">Énergie</span><span class="main-orbes">${orbes}</span><b>${energie}</b>
          <span class="main-pioche" title="Les cartes qui restent à piger ce match">🂠 ${pioche.length}</span></div>
        <div class="choix-options choix-main${premier ? ' donne' : ''}">${cartes}</div>
        <div class="main-apercu">
          <div class="gl-k">Ce soir, sur la glace</div>
          ${jouees.length ? `<div class="main-jouees">${jouees.map(c => `<span class="main-jouee">${CARTES_MATCH[c].ico} ${esc(CARTES_MATCH[c].nom)}</span>`).join('')}</div>` : '<div class="main-vide">Aucune carte jouée. Touche une carte pour la jouer.</div>'}
          ${mots.length ? `<div class="choix-puces">${puces(mots)}</div>` : ''}
        </div>
        <div class="main-boutons">
          <button type="button" class="btn go main-jouer"${spec.ajustements && !aj ? ' disabled' : ''}>${esc(spec.ajustements && !aj ? 'Choisis ton ajustement' : jouees.length ? (spec.motJouer || 'Jouer ces cartes') : 'Ne rien jouer')}</button>
        </div>
        <div class="main-outils">
          <button type="button" class="btn main-reprendre"${jouees.length ? '' : ' disabled'}>Recommencer la main</button>
          <button type="button" class="btn main-deck">${voirDeck ? 'Cacher mon deck' : `Mon deck · ${deck.length}`}</button>
        </div>
        ${voirDeck ? `<div class="deck-grille">${deck.map(c => `<span class="deck-mini tc-${CARTES_MATCH[c].maudite ? 'commune' : CARTES_MATCH[c].rarete}${CARTES_MATCH[c].maudite ? ' maudite' : ''}" title="${esc(CARTES_MATCH[c].texte)}"><b>${CARTES_MATCH[c].injouable ? '✕' : CARTES_MATCH[c].cout}</b>${CARTES_MATCH[c].ico} ${esc(CARTES_MATCH[c].nom)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
    const nd = m.querySelector('.choix-main');
    if (nd) nd.scrollLeft = x;
    if (planOuvert) { const pl = m.querySelector('.main-plan'); if (pl) pl.open = true; }
    pointsDeBande(m);
    premier = false; pigees = new Set();
    m.querySelectorAll('.main-carte').forEach(b => {
      b.onclick = () => {
        const i = Number(b.dataset.choix), c = main[i], C = CARTES_MATCH[c];
        if (joue.has(i) || C.injouable || energieDepensee([...jouees, c]) < 0) { jouerSon('refus'); return; }
        jouerSon('joue');
        joue.add(i); jouees.push(c);
        // Le coût se relit sur TOUTE la main : un rabais joué après rend l'énergie des cartes d'avant (S76).
        energie = energieDepensee(jouees);
        if (C.pioche) { const n0 = main.length; main.push(...pioche.splice(0, C.pioche)); for (let k = n0; k < main.length; k++) pigees.add(k); }
        dessiner();
      };
    });
    m.querySelector('.main-jouer').onclick = () => {
      if (spec.ajustements && !aj) return;
      const enMain = main.filter((c, i) => !joue.has(i) && CARTES_MATCH[c].enMain);
      fermer(true);
      spec.onJouer(jouees.slice(), enMain, aj, prep.slice());
    };
    // Me préparer : toucher une piste. Une seule (deux avec « Le plan B ») ; la dernière touchée reste.
    m.querySelectorAll('.dep-piste[data-plan]').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.plan;
        prep = prep.includes(k) ? prep.filter(x => x !== k) : [...prep, k];
        jouerSon('joue');
        dessiner();
      };
    });
    m.querySelectorAll('.main-aj').forEach(b => { b.onclick = () => { aj = b.dataset.aj; jouerSon('joue'); dessiner(); }; });
    m.querySelector('.main-reprendre').onclick = () => { depart(); joue.clear(); premier = true; aj = null; prep = []; dessiner(); };
    m.querySelector('.main-deck').onclick = () => { voirDeck = !voirDeck; dessiner(); };
    // Le focus reste DANS la main : le clavier ne tombe jamais sur la page dessous.
    m.querySelector('.main-jouer').focus({ preventScroll: true });
  };
  const fermer = (silencieux = false) => {
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
    void silencieux;
  };
  fermerChoixCourant = fermer;
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  jouerSon('donne');
  dessiner();
  return () => fermer(true);
}

/* Mon deck, à lire : toutes les cartes, rangées par coût. */
export function ouvrirDeck({ deck, titre = 'Mon deck', recit = '' }) {
  const tri = deck.slice().sort((a, b) => CARTES_MATCH[a].cout - CARTES_MATCH[b].cout || CARTES_MATCH[a].nom.localeCompare(CARTES_MATCH[b].nom, 'fr'));
  const compte = new Map();
  for (const c of tri) compte.set(c, (compte.get(c) || 0) + 1);
  return ouvrirChoix({
    ico: '🃏', titre: `${titre} · ${deck.length} cartes`, cartes: true, genre: 'deck', fermable: true, motFermer: 'Fermer',
    recit: recit || 'Tes cartes de match : avant chaque gros match et chaque match de séries, tu en piges cinq et tu as trois d\'énergie pour les jouer.',
    lecture: true,
    options: [...compte.entries()].map(([c, n]) => ({ ...optionDeCarteMatch(c), cle: `vue:${c}`, nom: n > 1 ? `${CARTES_MATCH[c].nom} ×${n}` : CARTES_MATCH[c].nom })),
    onChoix: () => {},
  });
}
void RARETES;
