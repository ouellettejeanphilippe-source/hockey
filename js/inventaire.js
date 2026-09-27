/**
 * L'INVENTAIRE ET LE CLASSEUR (S79).
 *
 * JP : *en roguelike, avoir une vraie interface pour voir les cartes qu'on a
 * de façon permanente, et les consommables (certaines permanentes dans
 * l'inventaire, d'autres bonnes pour une saison seulement)*.
 *
 * TROIS POCHES, et chacune dit la vie de ses cartes :
 *   CETTE SAISON  ce que les packs de la partie ont donné et qu'on n'a pas
 *                 encore joué — un événement, un style, une carte de match,
 *                 un consommable « 1 utilisation ». Elle se DÉDUIT des
 *                 décisions (les achats, les cartes jouées, les ventes) : une
 *                 partie reprise retrouve exactement sa poche.
 *   PERMANENT     (mode Rogue) le personnel qu'on possède — on l'engage à
 *                 chaque run — et les consommables permanents, gardés d'une
 *                 run à l'autre dans le méta (\`cap82_rogue\`, js/rogue.js).
 *   LE DECK       le deck de match de la partie (js/combat.js \`deckDe\`).
 * Et le CLASSEUR : toute la banque, possédée ou non, par famille et rareté.
 *
 * Jouer une carte est une DÉCISION (js/banque.js \`payloadDe\`) : le contrôleur
 * (js/game.js) choisit la cible, écrit la décision, et la saison continue.
 */
import { BANQUE, CATEGORIES, ORDRE_CATEGORIES, ROLES, VIES, reglesDe, carteBanque, idsDe } from './banque.js';
import { tirerCartesPack } from './packs.js';
import { RARETES } from './cartes.js';
import { puces, optionDeCarteMatch } from './gerant.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);

/* Les paliers de la saison donnent un pack mixte gratuit (S79) : ses cartes de saison, jamais un permanent. */
export const PALIERS_PACK = [20, 40, 60];

/*
 * LA POCHE DE LA PARTIE, pure : les cartes des packs achetés (\`achat.cartes\`)
 * et des paliers atteints, moins celles jouées (\`joue.ref\`) et vendues
 * (\`vend.refs\`). \`rogue\` : les permanents sont partis au méta à l'ouverture.
 */
export function pocheDeLaPartie({ decisions = [], graine = 0, jour = 0, rogue = false } = {}) {
  const items = [];
  const achats = decisions.filter(d => d && d.achat && d.achat.sorte === 'cartes');
  for (const d of achats) (d.achat.cartes || []).forEach((id, t) => {
    if (!BANQUE[id]) return;
    if (rogue && BANQUE[id].vie === 'permanent') return;
    if ((d.achat.vendus || []).includes(t)) return;
    items.push({ ref: `${d.achat.n}:${t}`, id, source: `Pack · journée ${(d.jour || 0) + 1}` });
  });
  for (const p of PALIERS_PACK) {
    if (jour < p) continue;
    tirerCartesPack('mixte', graine, `palier${p}`).forEach((id, t) => {
      if (!BANQUE[id] || BANQUE[id].vie === 'permanent') return;
      items.push({ ref: `p${p}:${t}`, id, source: `Palier de la journée ${p}` });
    });
  }
  const parties = new Set();
  for (const d of decisions) {
    if (d && d.joue && d.joue.src === 'partie') parties.add(d.joue.ref);
    if (d && d.vend && Array.isArray(d.vend.refs)) d.vend.refs.forEach(r => parties.add(r));
  }
  return items.filter(x => !parties.has(x.ref));
}

/* La valeur de vente rapide d'une carte, en jetons (selon sa rareté). */
export const VENTE = { commune: 2, peu: 5, rare: 12, legendaire: 30, maudite: 1 };
export const valeurDe = id => VENTE[(BANQUE[id] || {}).rarete] || 1;

/* ---------- la carte de la banque, en petit ---------- */
export function carteBanqueHtml(id, { compte = 0, actions = '', possede = true, vie = null } = {}) {
  const c = carteBanque(id);
  if (!c) return '';
  const mots = c.cat === 'match' ? optionDeCarteMatch(c.cle).mots : reglesDe(id);
  const R = RARETES[c.rarete] || { gemme: '◆', nom: c.rarete };
  const sous = c.cat === 'patron' ? ROLES[c.role].nom : c.cat === 'match' ? `${c.cout} énergie` : c.cat === 'evenement' ? `${c.duree} journées` : CATEGORIES[c.cat].un;
  const v = vie || c.vie;
  return `<div class="bq-carte bq-${c.cat} tc-${c.rarete}${possede ? '' : ' pas-a-moi'}" data-id="${esc(id)}">
    <div class="bq-tete"><span class="bq-ico" aria-hidden="true">${c.ico}</span><span class="bq-nom">${esc(c.nom)}</span>${compte > 1 ? `<span class="bq-compte">×${compte}</span>` : ''}</div>
    <div class="bq-sous"><span>${esc(CATEGORIES[c.cat].un)}</span><span>${esc(sous)}</span></div>
    ${possede ? `<div class="bq-regle">${puces(mots)}</div><div class="bq-texte">${esc(c.texte || '')}</div>` : '<div class="bq-regle bq-cache">Pas encore dans ta collection</div>'}
    <div class="bq-pied"><span class="bq-vie vie-${v}" title="${esc(VIES[v] ? VIES[v].mot : '')}">${esc(VIES[v] ? VIES[v].nom : '')}</span><span class="bq-gemme" title="${esc(R.nom)}">${R.gemme}</span></div>
    ${actions ? `<div class="bq-actions">${actions}</div>` : ''}
  </div>`;
}

/* ---------- l'écran ---------- */
let etat = { onglet: null, cat: 'tout', rar: 'tout' };
/*
 * ctx : { titre, mode ('rogue' | 'saison'), enSaison, jetons, partie: [{ref, id, source}],
 *         meta: [{id, n}], personnel: [cles], patronsActifs: [{cle, role}], maxPatrons,
 *         deck: [cles], possedees: Set(ids), joueursCollection: n,
 *         jouer(item), vendre(item), onFerme() }
 */
export function ouvrirInventaire(ctx) {
  const m = $('inventaireModal');
  if (!m) return;
  const onglets = [
    ...(ctx.enSaison ? [['partie', 'Cette saison', ctx.partie.length]] : []),
    ...(ctx.mode === 'rogue' ? [['permanent', 'Permanent', ctx.meta.reduce((a, x) => a + x.n, 0) + ctx.personnel.length]] : []),
    ...(ctx.enSaison ? [['deck', 'Le deck', ctx.deck.length]] : []),
    ['classeur', 'Le classeur', `${ctx.possedees.size}/${Object.keys(BANQUE).length}`],
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
      const cats = ORDRE_CATEGORIES.filter(c => c !== 'saison' && [...piles.keys()].some(id => BANQUE[id].cat === c));
      const cartes = [...piles.entries()].filter(([id]) => garde(id)).sort((a, b) => ORDRE_CATEGORIES.indexOf(BANQUE[a[0]].cat) - ORDRE_CATEGORIES.indexOf(BANQUE[b[0]].cat));
      corps = `<p class="inv-mot">Ce que tes packs de la partie ont donné. ${VIES.saison.mot} Jouer une carte, c'est une décision : elle vaut à partir d'aujourd'hui.</p>
        ${filtres(cats)}
        <div class="inv-grille">${cartes.map(([id, pile]) => carteBanqueHtml(id, { compte: pile.length, vie: BANQUE[id].cat === 'consommable' ? 'usage' : 'saison',
          actions: `<button type="button" class="btn gold inv-jouer" data-ref="${esc(pile[0].ref)}" data-id="${esc(id)}"${ctx.peutJouer ? '' : ' disabled'}>${BANQUE[id].cat === 'match' ? 'Au deck' : 'Jouer'}</button><button type="button" class="btn inv-vendre" data-ref="${esc(pile[0].ref)}" data-id="${esc(id)}">Vendre · ${valeurDe(id)} 🪙</button>` })).join('') || vide('Rien dans ta poche : ouvre des packs à la boutique, ou attends le prochain palier.')}</div>`;
    } else if (etat.onglet === 'permanent') {
      const engages = new Set((ctx.patronsActifs || []).map(p => p.cle));
      const perso = ctx.personnel.filter(k => garde(`patron:${k}`));
      const conso = ctx.meta.filter(x => garde(x.id));
      corps = `<p class="inv-mot">${VIES.permanent.mot} Le personnel ne s'use pas : tu l'engages à chaque saison, ${ctx.maxPatrons} postes au plus, un par rôle.</p>
        ${filtres(['patron', 'consommable'])}
        <h3 class="inv-sec">👔 Ton personnel · ${ctx.personnel.length}</h3>
        <div class="inv-grille">${perso.map(k => carteBanqueHtml(`patron:${k}`, {
          actions: engages.has(k) ? '<span class="inv-engage">✓ Engagé</span>' : `<button type="button" class="btn gold inv-engager" data-id="patron:${esc(k)}"${ctx.peutJouer ? '' : ' disabled'}>Engager</button>`,
        })).join('') || vide('Aucun patron : les packs Personnel en donnent.')}</div>
        <h3 class="inv-sec">🧴 Tes consommables permanents · ${ctx.meta.reduce((a, x) => a + x.n, 0)}</h3>
        <div class="inv-grille">${conso.map(x => carteBanqueHtml(x.id, { compte: x.n,
          actions: `<button type="button" class="btn gold inv-jouer-meta" data-id="${esc(x.id)}"${ctx.peutJouer ? '' : ' disabled'}>Jouer</button>` })).join('') || vide('Aucun consommable permanent.')}</div>`;
    } else if (etat.onglet === 'deck') {
      const piles = new Map();
      for (const k of ctx.deck) piles.set(k, (piles.get(k) || 0) + 1);
      corps = `<p class="inv-mot">Ton deck de match : tu en piges cinq avant chaque gros match et chaque match de séries.</p>
        <div class="inv-grille">${[...piles.entries()].map(([k, n]) => carteBanqueHtml(`match:${String(k).replace(/\+$/, '')}`, { compte: n })).join('')}</div>`;
    } else {
      const ids = Object.keys(BANQUE).filter(garde).sort((a, b) => ORDRE_CATEGORIES.indexOf(BANQUE[a].cat) - ORDRE_CATEGORIES.indexOf(BANQUE[b].cat));
      const par = ORDRE_CATEGORIES.map(c => [c, idsDe(c).filter(id => ctx.possedees.has(id)).length, idsDe(c).length]);
      corps = `<p class="inv-mot">Toute la banque : ${Object.keys(BANQUE).length} cartes. Celles que tu as déjà tirées sont en couleur.${ctx.joueursCollection ? ` Et ${ctx.joueursCollection} vrais joueurs tirés de tes packs.` : ''}</p>
        <div class="inv-progres">${par.map(([c, a, n]) => `<span class="inv-prog"><b>${CATEGORIES[c].ico} ${a}/${n}</b> ${esc(CATEGORIES[c].nom)}</span>`).join('')}</div>
        ${filtres(ORDRE_CATEGORIES)}${rars}
        <div class="inv-grille">${ids.map(id => carteBanqueHtml(id, { possede: ctx.possedees.has(id) })).join('')}</div>`;
    }
    m.innerHTML = `<div class="choix-sheet inv-sheet" role="dialog" aria-modal="true" aria-label="${esc(ctx.titre)}">
      <div class="choix-tete">
        <span class="choix-ico">🎒</span>
        <div class="choix-titres"><div class="choix-titre">${esc(ctx.titre)}</div>${ctx.jetons != null ? `<div class="choix-irl">🪙 ${ctx.jetons} jetons</div>` : ''}</div>
        <button type="button" class="close-btn choix-fermer" aria-label="Fermer" title="Fermer">✕</button>
      </div>
      <div class="inv-onglets" role="tablist">${onglets.map(([k, nom, n]) => `<button type="button" role="tab" class="inv-onglet${etat.onglet === k ? ' on' : ''}" data-onglet="${k}" aria-selected="${etat.onglet === k}">${esc(nom)} <span>${n}</span></button>`).join('')}</div>
      <div class="choix-corps inv-corps">${corps}</div>
    </div>`;
    m.querySelector('.choix-fermer').onclick = fermer;
    m.querySelectorAll('[data-onglet]').forEach(b => { b.onclick = () => { etat.onglet = b.dataset.onglet; etat.cat = 'tout'; dessiner(); }; });
    m.querySelectorAll('[data-cat]').forEach(b => { b.onclick = () => { etat.cat = b.dataset.cat; dessiner(); }; });
    m.querySelectorAll('[data-rar]').forEach(b => { b.onclick = () => { etat.rar = b.dataset.rar; dessiner(); }; });
    m.querySelectorAll('.inv-jouer').forEach(b => { b.onclick = () => { fermer(true); ctx.jouer({ src: 'partie', ref: b.dataset.ref, id: b.dataset.id }); }; });
    m.querySelectorAll('.inv-vendre').forEach(b => { b.onclick = () => { fermer(true); ctx.vendre({ src: 'partie', ref: b.dataset.ref, id: b.dataset.id }); }; });
    m.querySelectorAll('.inv-engager').forEach(b => { b.onclick = () => { fermer(true); ctx.jouer({ src: 'personnel', id: b.dataset.id }); }; });
    m.querySelectorAll('.inv-jouer-meta').forEach(b => { b.onclick = () => { fermer(true); ctx.jouer({ src: 'meta', id: b.dataset.id }); }; });
  };
  const fermer = (silencieux = false) => {
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('choix-ouvert');
    if (!silencieux && ctx.onFerme) ctx.onFerme();
  };
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  dessiner();
}
