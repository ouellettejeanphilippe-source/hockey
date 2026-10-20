/**
 * L'INVENTAIRE ET LE CLASSEUR (S79).
 *
 * JP : *en roguelike, avoir une vraie interface pour voir les cartes qu'on a
 * de façon permanente, et les consommables (certaines permanentes dans
 * l'inventaire, d'autres bonnes pour une saison seulement)*.
 *
 * TROIS RANGS, et chacun dit la vie de ses cartes :
 *   TES PLACES    (V9) ce que les packs et les paliers de la partie ont donné
 *                 et qu'on n'a pas encore joué — un style, un consommable,
 *                 un contrat —, `PLACES` au plus. Elles se DÉDUISENT des
 *                 décisions (les achats, les cartes jouées, les ventes) : une
 *                 partie reprise retrouve exactement ses places.
 *   PERMANENT     (mode Rogue) le personnel qu'on possède — on l'engage à
 *                 chaque run — et les consommables permanents, gardés d'une
 *                 run à l'autre dans le méta (\`cap82_rogue\`, js/rogue.js).
 *   LE DECK       le deck de match de la partie (js/combat.js \`deckDe\`).
 * Et le CLASSEUR : toute la banque, possédée ou non, par famille et rareté.
 *
 * Jouer une carte est une DÉCISION (js/banque.js \`payloadDe\`) : le contrôleur
 * (js/game.js) choisit la cible, écrit la décision, et la saison continue.
 */
import { BANQUE, CATEGORIES, ORDRE_CATEGORIES, VIES, MOMENTS, reglesDe, carteBanque, idsDe, etiquetteBanque } from './banque.js';
import { COACHS } from './coachs.js';
import { tirerCartesPack, sortDUnPack } from './packs.js';
import { RARETES } from './cartes.js';
import { puces, optionDeCarteMatch, chiffresOuverts, basculerChiffres, carteDeBanqueHtml } from './gerant.js';
import { esc, money as M, jaugePlafond } from './util.js';

const $ = id => document.getElementById(id);

/*
 * LES PLACES (V9, tranche 5b — docs/refonte-v9.md § 6.4). La poche, la main de la semaine et sa limite de deux cartes
 * par semaine sont parties. Ce qui se joue hors du combat tient dans `PLACES` places, comme les potions de Slay the
 * Spire : une carte de pack (un consommable, une modif à poser, un contrat) va droit à une place et se joue quand on
 * veut, sans limite. Le personnel (le coach, les patrons) a ses postes ; les cartes de match, le cahier (le deck) ; les
 * événements, des gestes du DG, sont devenus les routes de la semaine (js/noeuds.js). Plus de cartes que de places :
 * À faire demande laquelle vendre (js/saison.js), et la journée attend.
 */
export const PLACES = 3;
export const SEMAINE = 7;
/*
 * LES PALIERS DE LA SAISON (S79 ; V9, tranche 5b) : aux matchs 9, 18 et 26, une carte parmi trois, pour une place.
 * Avant, un pack gratuit de cinq cartes, qui aurait débordé trois places d'un coup. Ni carte de match, ni personnel, ni
 * permanent : ce qui se joue d'une place (et aucun pack ne donne plus d'événement). Pur : la graine et le palier.
 */
export const PALIERS_PACK = [9, 18, 26];
const CARTES_DU_PALIER = 3;
export function cartesDuPalier(graine, p) {
  const out = [];
  for (let k = 0; out.length < CARTES_DU_PALIER && k < 12; k++) {
    for (const id of tirerCartesPack('mixte', graine, `palier${p}${k ? `:${k}` : ''}`, { sans: ['match', 'patron'] })) {
      if (out.length < CARTES_DU_PALIER && BANQUE[id] && BANQUE[id].vie !== 'permanent' && !out.includes(id)) out.push(id);
    }
  }
  return out;
}

/*
 * TES PLACES, pures : les cartes des packs achetés (`achat.cartes`), du report de la saison d'avant (`poche`), d'un
 * palier du deck gardé (`garde`) et des paliers de la saison (`place`), moins celles jouées (`joue.ref`) et vendues
 * (`vend.refs`). `rogue` : les permanents sont partis au méta à l'ouverture. Une partie reprise retrouve ses places.
 */
export function placesDeLaPartie({ decisions = [], rogue = false } = {}) {
  const items = [];
  // Les packs de cartes, et les cartes des packs mixtes (Jalon P2), dont les revendues sont `cartesVendues`.
  const achats = decisions.filter(d => d && d.achat && Array.isArray(d.achat.cartes));
  for (const d of achats) d.achat.cartes.forEach((id, t) => {
    if (!BANQUE[id]) return;
    if (rogue && BANQUE[id].vie === 'permanent') return;
    // Une carte de match va droit au cahier à l'ouverture (`deckDe`, js/combat.js) ; un patron, au personnel.
    if (BANQUE[id].cat === 'match') return;
    if (((d.achat.sorte === 'cartes' ? d.achat.vendus : d.achat.cartesVendues) || []).includes(t)) return;
    items.push({ ref: `${d.achat.n}:${t}`, id, source: `Pack · journée ${(d.jour || 0) + 1}` });
  });
  // Jalon Q : les places de la saison d'avant, reportées au jour 0 (leurs cartes gardent leur rang : `r<i>`).
  for (const d of decisions) if (d && Array.isArray(d.poche)) d.poche.forEach((id, i) => { if (BANQUE[id]) items.push({ ref: `r${i}`, id, source: 'La saison d\'avant' }); });
  // S80 : une amélioration ou une retouche de l'atelier prise à un palier du deck SE GARDE (`garde`), comme une carte de pack.
  for (const d of decisions) if (d && d.garde && BANQUE[d.garde]) items.push({ ref: `deck:${d.palier}`, id: d.garde, source: `Main de la journée ${d.palier}` });
  // V9, tranche 5b : la carte prise à un palier de la saison (`pp:<match>`) ; V10 : ou au verdict du proprio (`v:<jour>`).
  for (const d of decisions) if (d && d.place && BANQUE[d.place] && typeof d.palier === 'string') items.push({ ref: d.palier, id: d.place, source: d.palier.startsWith('v:') ? 'Le proprio' : d.palier.startsWith('trou:') ? 'La case vide' : `Le ${d.palier.slice(3)}e match` });
  const parties = new Set();
  for (const d of decisions) {
    if (d && d.joue && d.joue.src === 'partie') parties.add(d.joue.ref);
    if (d && d.vend && Array.isArray(d.vend.refs)) d.vend.refs.forEach(r => parties.add(r));
  }
  return items.filter(x => !parties.has(x.ref));
}

/*
 * La valeur de vente rapide d'une carte, en jetons (selon sa rareté). S82 :
 * à 2/5/12/30, une carte valait 4,94 🪙 en moyenne aux cotes 55/30/12/3 des
 * packs (js/packs.js), et acheter un pack pour tout revendre RAPPORTAIT
 * (Consommables 15 🪙 → 24,7 🪙). Un consommable ne se revend pas (cinq par
 * pack, vie courte) ; le reste vaut 1,24 🪙 en moyenne, soit au plus le tiers
 * du prix d'un pack. scripts/check_packs.mjs le mesure pour chaque pack.
 */
export const VENTE = { commune: 1, peu: 1, hors: 1, rare: 2, legendaire: 5, maudite: 0 };
export const valeurDe = id => { const c = BANQUE[id] || {}; return c.cat === 'consommable' ? 0 : (VENTE[c.rarete] ?? 1); };

/* Une carte de la banque en option de carte (`ouvrirChoix`, `carteDeBanqueHtml`) : sa famille, sa vie, sa couleur, sa règle. */
export function optionDeBanque(id, vie = null) {
  const c = BANQUE[id];
  if (c.cat === 'match') return optionDeCarteMatch(c.cle);
  const etiquette = etiquetteBanque(id);
  return { cle: id, rarete: c.rarete === 'maudite' ? 'commune' : c.rarete, ico: c.ico, nom: c.nom,
    type: c.rarete === 'maudite' ? `Malédiction · ${CATEGORIES[c.cat].un}` : `${CATEGORIES[c.cat].un} · ${(VIES[vie || c.vie] || VIES.saison).nom}${COACHS[c.coach] ? ` · ${COACHS[c.coach].ico} ${COACHS[c.coach].nom}` : ' · Neutre'}`, texte: c.texte, mots: reglesDe(id), famille: c.cat, ...(etiquette ? { etiquette } : {}) };
}

/*
 * SUR QUI, SUR QUOI (Jalon U, JP : *jouer les cartes du menu Cartes, on ne comprend pas*). Une ligne, avant le
 * bouton : ce que « Jouer » va te demander, ou que rien ne sera demandé.
 */
const CIBLES = { joueur: '👤 Sur un joueur de ton alignement', blesse: '🚑 Sur un blessé', recrue: '🐣 Sur une recrue de 23 ans ou moins',
  cartable: '📟 Un joueur de ton cartable entre', coach: '🔁 Change ton coach', malediction: '🗑 Retire une malédiction de ton deck', carteMatch: '🏋 Améliore une carte de ton deck' };
function cibleDe(id) {
  const c = BANQUE[id];
  if (!c) return '';
  if (c.cat === 'joueur') return CIBLES.joueur;
  if (c.cat === 'patron') return '👔 Un poste de ton personnel';
  if (c.echange) return '📟 Un doublon contre un joueur de sa série';
  return CIBLES[c.cible] || (c.cat === 'plafond' ? '💵 Ta masse salariale, tout de suite' : '⚡ Tout de suite');
}
/* ---------- la carte de la banque : la face d'un pack (Jalon U), son compte, ses boutons ---------- */
function carteBanqueHtml(id, { compte = 0, actions = '', possede = true, vie = null } = {}) {
  const c = carteBanque(id);
  if (!c) return '';
  return `<div class="bq-carte bq-${c.cat}${possede ? '' : ' pas-a-moi'}" data-id="${esc(id)}">${carteDeBanqueHtml(optionDeBanque(id, vie), { cache: !possede })}${compte > 1 ? `<span class="bq-compte">×${compte}</span>` : ''}${actions ? `<div class="bq-actions">${actions}</div>` : ''}</div>`;
}

/* ---------- l'écran ---------- */
let etat = { onglet: null, cat: 'tout', rar: 'tout' };
/*
 * ctx : { titre, mode ('rogue' | 'saison'), enSaison, jetons, partie: [{ref, id, source}],
 *         meta: [{id, n}],
 *         deck: [cles], possedees: Set(ids), joueursCollection: n,
 *         jouer(item), vendre(item), onFerme() }
 */
/* LA MASSE SALARIALE (S79) : le plafond effectif, et ce qui le tord — les cartes 💵 jouées, le vestiaire, le DG. En Rogue, chez le proprio (V12-3). */
export const masseSalarialeHtml = P => (P ? jaugePlafond({ masse: P.masse, cap: P.cap,
  mot: P.lignes.length ? puces(P.lignes.map(l => ({ txt: l.joueur ? l.nom : `${l.nom} ${l.montant > 0 ? '+' : '−'}${M(Math.abs(l.montant))}`, bon: l.joueur ? true : l.montant > 0 }))) : `<span class="inv-pl-rien">Plafond de base : ${M(P.base)}. Les cartes 💵 le tordent.</span>` }) : '');

export function ouvrirInventaire(ctx) {
  // Dans une page du Marché (`ctx.dans`, `ctx.fermer`, js/game.js) ou dans sa fenêtre.
  const m = ctx.dans || $('inventaireModal');
  if (!m) return;
  const onglets = [
    ...(ctx.enSaison ? [['partie', ctx.mode === 'rogue' ? 'Tes places' : 'Cette saison', ctx.partie.length]] : []),
    ...(ctx.mode === 'rogue' ? [['permanent', 'Permanent', ctx.meta.reduce((a, x) => a + x.n, 0)]] : []),
    ...(ctx.enSaison ? [['deck', 'Le deck', ctx.deck.length]] : []),
    ['classeur', 'La banque', `${[...ctx.possedees].filter(sortDUnPack).length}/${Object.keys(BANQUE).filter(sortDUnPack).length}`],
  ];
  if (!etat.onglet || !onglets.some(o => o[0] === etat.onglet)) etat.onglet = onglets[0][0];
  const dessiner = () => {
    const filtres = (cats) => `<div class="inv-filtres" role="group" aria-label="Filtrer">
      ${['tout', ...cats].map(c => `<button type="button" class="inv-filtre${etat.cat === c ? ' on' : ''}" data-cat="${c}">${c === 'tout' ? 'Tout' : `${CATEGORIES[c].ico} ${CATEGORIES[c].nom}`}</button>`).join('')}
    </div>`;
    const rars = `<div class="inv-filtres inv-rar" role="group" aria-label="Rareté">
      ${['tout', 'commune', 'peu', 'rare', 'legendaire'].map(r => `<button type="button" class="inv-filtre${etat.rar === r ? ' on' : ''}" data-rar="${r}">${r === 'tout' ? 'Toutes' : `${RARETES[r].gemme} ${RARETES[r].nom}`}</button>`).join('')}
    </div>`;
    const garde = id => (etat.cat === 'tout' || BANQUE[id].cat === etat.cat) && (etat.rar === 'tout' || BANQUE[id].rarete === etat.rar);
    const vide = mot => `<p class="inv-vide">${mot}</p>`;
    let corps = '';
    if (etat.onglet === 'partie') {
      // Les cartes identiques s'empilent : une carte, son compte, et ses références (on joue la première).
      const piles = new Map();
      for (const x of ctx.partie) { if (!piles.has(x.id)) piles.set(x.id, []); piles.get(x.id).push(x); }
      const cats = ORDRE_CATEGORIES.filter(c => [...piles.keys()].some(id => BANQUE[id].cat === c));
      const cartes = [...piles.entries()].filter(([id]) => garde(id)).sort((a, b) => ORDRE_CATEGORIES.indexOf(BANQUE[a[0]].cat) - ORDRE_CATEGORIES.indexOf(BANQUE[b[0]].cat));
      /*
       * CE QUI SE JOUE D'ABORD (Jalon U, JP : *trop de cartes injouables*). Une carte en place se joue quand on veut (V9) ;
       * hors de la saison (le menu), rien ne se joue : « Pas maintenant ».
       */
      const rangee = ([id, pile]) => ({ id, pile, x: pile[0], non: ctx.peutJouer ? '' : 'Pas maintenant' });
      const toutes = cartes.map(rangee), jouables = toutes.filter(r => !r.non), autres = toutes.filter(r => r.non);
      const raison = autres.length && autres.every(r => r.non === autres[0].non) ? autres[0].non : '';
      // V12-3 : une carte qui a sa maison (un soin, un contrat, le congédiement) s'y joue ; ici, son bouton y mène.
      const ou = id => (ctx.renvoyer && ctx.ouSeJoue ? ctx.ouSeJoue(id) : null);
      const carte = ({ id, pile, x, non }) => carteBanqueHtml(id, { compte: pile.length, vie: ['consommable', 'plafond'].includes(BANQUE[id].cat) ? 'usage' : 'saison',
        actions: `<p class="bq-cible">${esc(cibleDe(id))}</p>${ou(id) ? `<button type="button" class="btn gold inv-renvoi" data-maison="${esc(ou(id).cle)}">${esc(ou(id).mot)} ›</button>` : `<button type="button" class="btn gold inv-jouer" data-ref="${esc(x.ref)}" data-id="${esc(id)}"${non ? ' disabled' : ''}>${non ? esc(raison ? 'Plus tard' : non) : 'Jouer'}</button>`}${valeurDe(id) > 0 ? `<button type="button" class="btn inv-vendre" data-ref="${esc(pile[0].ref)}" data-id="${esc(id)}">Vendre · ${valeurDe(id)} 🪙</button>` : ''}` });
      corps = `<p class="inv-mot">${ctx.mode === 'rogue' ? `🃏 Tes ${PLACES} places : chaque carte se joue quand tu veux ; une de trop se vend. Elles te suivent d'une saison à l'autre de la run.` : `${MOMENTS.garde.ico} ${esc(MOMENTS.garde.mot)}`}</p>
                ${filtres(cats)}
        ${jouables.length ? `<div class="inv-grille">${jouables.map(carte).join('')}</div>` : ''}
        ${autres.length ? `<h3 class="inv-sec">Pas maintenant · ${autres.length}${raison ? ` — ${esc(raison)}` : ''}</h3><div class="inv-grille">${autres.map(carte).join('')}</div>` : ''}
        ${toutes.length ? '' : vide(`Aucune carte en place : ouvre des packs à la boutique, ou attends les matchs ${PALIERS_PACK.slice(0, -1).join(', ')} et ${PALIERS_PACK.at(-1)}.`)}`;
    } else if (etat.onglet === 'permanent') {
      const conso = ctx.meta.filter(x => garde(x.id));
      // V12-2 : ton personnel et le congédiement sont au sous-onglet de l'entraîneur (Bureau › Entraîneur), avec ton coach.
      corps = `<p class="inv-mot">${VIES.permanent.mot} Chaque carte se joue chez ce qu'elle touche : le personnel chez l'entraîneur, les soins à l'infirmerie, les contrats chez le proprio.</p>
        ${filtres(['consommable', 'plafond'])}
        <h3 class="inv-sec">🧴 Tes cartes permanentes · ${ctx.meta.reduce((a, x) => a + x.n, 0)}</h3>
        <div class="inv-grille">${conso.map(x => carteBanqueHtml(x.id, { compte: x.n,
          actions: `<button type="button" class="btn gold inv-jouer-meta" data-id="${esc(x.id)}"${ctx.peutJouer ? '' : ' disabled'}>Jouer</button>` })).join('') || vide('Aucun consommable permanent.')}</div>`;
    } else if (etat.onglet === 'deck') {
      const piles = new Map();
      for (const k of ctx.deck) piles.set(k, (piles.get(k) || 0) + 1);
      corps = `<p class="inv-mot">Ton deck de match : tu en piges cinq avant chaque gros match et chaque match de séries.</p>
        <div class="inv-grille">${[...piles.entries()].map(([k, n]) => carteBanqueHtml(`match:${String(k).replace(/\+$/, '')}`, { compte: n })).join('')}</div>`;
    } else {
      // V6 : une carte retirée (elle ne se tire plus) ne se montre qu'à qui l'a déjà.
      const ids = Object.keys(BANQUE).filter(id => garde(id)).sort((a, b) => ORDRE_CATEGORIES.indexOf(BANQUE[a].cat) - ORDRE_CATEGORIES.indexOf(BANQUE[b].cat));
      // Le dénominateur ne compte que ce qu'un pack peut donner (V2.2) ; le reste se gagne en jouant.
      const par = ORDRE_CATEGORIES.map(c => [c, idsDe(c).filter(id => sortDUnPack(id) && ctx.possedees.has(id)).length, idsDe(c).filter(sortDUnPack).length]).filter(([, , n]) => n > 0);
      const horsPack = Object.keys(BANQUE).filter(id => !sortDUnPack(id)).length;
      corps = `<p class="inv-mot">Toute la banque : ${Object.keys(BANQUE).filter(sortDUnPack).length} cartes à tirer des packs, et ${horsPack} qui se gagnent en jouant (les cartes de saison, les événements, les malédictions). Celles que tu as déjà tirées sont en couleur.${ctx.joueursCollection ? ` Tes ${ctx.joueursCollection} cartes de joueur sont dans ton cartable (la section Collection).` : ''}</p>
        <div class="inv-progres">${par.map(([c, a, n]) => `<span class="inv-prog"><b>${CATEGORIES[c].ico} ${a}/${n}</b> ${esc(CATEGORIES[c].nom)}</span>`).join('')}</div>
        ${filtres(ORDRE_CATEGORIES)}${rars}
        <div class="inv-grille">${ids.map(id => carteBanqueHtml(id, { possede: ctx.possedees.has(id) })).join('')}</div>`;
    }
    const plafond = masseSalarialeHtml(ctx.plafond);
    m.innerHTML = `<div class="choix-sheet inv-sheet${chiffresOuverts() ? ' chiffres' : ''}" role="dialog" aria-modal="true" aria-label="${esc(ctx.titre)}">
      <div class="choix-tete">
        <span class="choix-ico">🎒</span>
        <div class="choix-titres"><div class="choix-titre">${esc(ctx.titre)}</div>${ctx.jetons != null ? `<div class="choix-irl">🪙 ${ctx.jetons} jetons</div>` : ''}</div>
        <button type="button" class="close-btn choix-fermer" aria-label="Fermer" title="Fermer">✕</button>
      </div>
      ${plafond}
      <div class="inv-onglets" role="tablist">${onglets.map(([k, nom, n]) => `<button type="button" role="tab" class="inv-onglet${etat.onglet === k ? ' on' : ''}" data-onglet="${k}" aria-selected="${etat.onglet === k}">${esc(nom)} <span>${n}</span></button>`).join('')}</div>
      <div class="choix-corps inv-corps">${corps}${corps.includes('puce') && corps.includes(' detail') ? `<button type="button" class="choix-chiffres" aria-pressed="${chiffresOuverts()}">Les chiffres</button>` : ''}</div>
    </div>`;
    // LES CHIFFRES (V3) : une carte se lit en mots ; ses nombres se déplient pour tout l'inventaire, comme dans un choix.
    const btnChiffres = m.querySelector('.choix-chiffres');
    if (btnChiffres) btnChiffres.onclick = () => { const o = basculerChiffres(); m.querySelector('.choix-sheet').classList.toggle('chiffres', o); btnChiffres.setAttribute('aria-pressed', String(o)); };
    m.querySelector('.choix-fermer').onclick = fermer;
    m.querySelectorAll('[data-onglet]').forEach(b => { b.onclick = () => { etat.onglet = b.dataset.onglet; etat.cat = 'tout'; dessiner(); }; });
    m.querySelectorAll('[data-cat]').forEach(b => { b.onclick = () => { etat.cat = b.dataset.cat; dessiner(); }; });
    m.querySelectorAll('[data-rar]').forEach(b => { b.onclick = () => { etat.rar = b.dataset.rar; dessiner(); }; });
    m.querySelectorAll('.inv-jouer').forEach(b => { b.onclick = () => { fermer(true); ctx.jouer({ src: 'partie', ref: b.dataset.ref, id: b.dataset.id }); }; });
    m.querySelectorAll('.inv-vendre').forEach(b => { b.onclick = () => { fermer(true); ctx.vendre({ src: 'partie', ref: b.dataset.ref, id: b.dataset.id }); }; });
    m.querySelectorAll('.inv-renvoi').forEach(b => { b.onclick = () => { fermer(true); ctx.renvoyer(b.dataset.maison); }; });
    m.querySelectorAll('.inv-jouer-meta').forEach(b => { b.onclick = () => { fermer(true); ctx.jouer({ src: 'meta', id: b.dataset.id }); }; });
  };
  const fermer = (silencieux = false) => {
    // Dans une page, seul un geste de fermeture la ferme : une carte jouée laisse « Tes cartes » en place (js/game.js, `remplirMarche`).
    if (ctx.dans) { if (ctx.fermer && !silencieux) ctx.fermer(); }
    else { m.hidden = true; m.innerHTML = ''; document.body.classList.remove('choix-ouvert'); }
    if (!silencieux && ctx.onFerme) ctx.onFerme();
  };
  if (!ctx.dans) { m.hidden = false; document.body.classList.add('choix-ouvert'); }
  dessiner();
}
