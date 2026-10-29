/**
 * L'INVENTAIRE ET LE CLASSEUR (S79).
 *
 * JP : *en roguelike, avoir une vraie interface pour voir les cartes qu'on a
 * de façon permanente, et les consommables (certaines permanentes dans
 * l'inventaire, d'autres bonnes pour une saison seulement)*.
 *
 * DEUX RANGS, et chacun dit la vie de ses cartes :
 *   LA PARTIE     ce que les packs et les paliers de la partie ont donné et
 *                 qu'on n'a pas encore joué — un soin, une retouche, un
 *                 contrat. Elles se DÉDUISENT des décisions (les achats, les
 *                 cartes jouées, les ventes) : une partie reprise les retrouve.
 *                 V16 : plus de places ni de limite ; chacune se joue chez ce
 *                 qu'elle touche.
 *   PERMANENT     (mode Rogue) les cartes rares permanentes, gardées d'une
 *                 run à l'autre dans le méta (\`cap82_rogue\`, js/rogue.js).
 * Et le CLASSEUR : toute la banque, possédée ou non, par famille et rareté.
 *
 * Jouer une carte est une DÉCISION (js/banque.js \`payloadDe\`) : le contrôleur
 * (js/game.js) choisit la cible, écrit la décision, et la saison continue.
 */
import { BANQUE, CATEGORIES, ORDRE_CATEGORIES, VIES, reglesDe, carteBanque, idsDe, etiquetteBanque } from './banque.js';
import { sortDUnPack } from './packs.js';
import { RARETES } from './cartes.js';
import { puces, chiffresOuverts, basculerChiffres, carteDeBanqueHtml } from './gerant.js';
import { esc, money as M, jaugePlafond } from './util.js';

const $ = id => document.getElementById(id);

export const SEMAINE = 7;
/*
 * LES PALIERS DE LA SAISON (S79 ; V9, tranche 5b) : aux matchs 9, 18 et 26, au verdict du proprio et au butin d'un gros
 * match gagné. V21 : un bienfait parmi trois pour le coach (js/pouvoirs.js `bienfaitsOfferts`, js/saison.js).
 */
export const PALIERS_PACK = [9, 18, 26];

/*
 * LES CARTES DE LA PARTIE, pures : les cartes des packs achetés (`achat.cartes`), du report de la saison d'avant (`poche`), d'un
 * palier du deck gardé (`garde`) et des paliers de la saison (`place`), moins celles jouées (`joue.ref`) et vendues
 * (`vend.refs`). `rogue` : les permanents sont partis au méta à l'ouverture. Une partie reprise les retrouve ; une carte que la banque ne connaît plus (une place, un équipement d'avant la V16) s'ignore.
 */
export function cartesDeLaPartie({ decisions = [], rogue = false } = {}) {
  const items = [];
  // Les packs de cartes, et les cartes des packs mixtes (Jalon P2), dont les revendues sont `cartesVendues`.
  const achats = decisions.filter(d => d && d.achat && Array.isArray(d.achat.cartes));
  for (const d of achats) d.achat.cartes.forEach((id, t) => {
    if (!BANQUE[id]) return;
    if (rogue && BANQUE[id].vie === 'permanent') return;
    if ((d.achat.cartesVendues || []).includes(t)) return;
    items.push({ ref: `${d.achat.n}:${t}`, id, source: `Pack · journée ${(d.jour || 0) + 1}` });
  });
  // Jalon Q : les cartes de la saison d'avant, reportées au jour 0 (leurs cartes gardent leur rang : `r<i>`).
  for (const d of decisions) if (d && Array.isArray(d.poche)) d.poche.forEach((id, i) => { if (BANQUE[id]) items.push({ ref: `r${i}`, id, source: 'La saison d\'avant' }); });
  // S80 : une amélioration ou une retouche de l'atelier prise à un palier du deck SE GARDE (`garde`), comme une carte de pack.
  for (const d of decisions) if (d && d.garde && BANQUE[d.garde]) items.push({ ref: `deck:${d.palier}`, id: d.garde, source: `Main du ${d.palier}e match` });
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

/* Une carte de la banque en option de carte (`ouvrirChoix`, `carteDeBanqueHtml`) : sa famille, sa vie, sa règle. */
export function optionDeBanque(id, vie = null) {
  const c = BANQUE[id];
  const etiquette = etiquetteBanque(id);
  return { cle: id, rarete: c.rarete === 'maudite' ? 'commune' : c.rarete, ico: c.ico, nom: c.nom,
    type: c.rarete === 'maudite' ? `Malédiction · ${CATEGORIES[c.cat].un}` : `${CATEGORIES[c.cat].un} · ${(VIES[vie || c.vie] || VIES.saison).nom}`, texte: c.texte, mots: reglesDe(id), famille: c.cat, ...(etiquette ? { etiquette } : {}) };
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
 * ctx : { titre, mode ('rogue' | 'saison'), enSaison, jetons, meta: [{id, n}],
 *         possedees: Set(ids), joueursCollection: n, jouer(item), onFerme() }
 * Les cartes gagnées dans la partie (`cartesDeLaPartie`) se jouent chez ce qu'elles touchent (js/rogue-jeu.js
 * `cartesDeLaMaison`), une retouche au verso de son joueur.
 */
/* LA MASSE SALARIALE (S79) : le plafond effectif, et ce qui le tord — les cartes 💵 jouées, le vestiaire, le DG. En Rogue, chez le proprio (V12-3). */
export const masseSalarialeHtml = P => (P ? jaugePlafond({ masse: P.masse, cap: P.cap,
  mot: P.lignes.length ? puces(P.lignes.map(l => ({ txt: l.joueur ? l.nom : `${l.nom} ${l.montant > 0 ? '+' : '−'}${M(Math.abs(l.montant))}`, bon: l.joueur ? true : l.montant > 0 }))) : `<span class="inv-pl-rien">Plafond de base : ${M(P.base)}. Les cartes 💵 le tordent.</span>` }) : '');

export function ouvrirInventaire(ctx) {
  // Dans une page du Marché (`ctx.dans`, `ctx.fermer`, js/game.js) ou dans sa fenêtre.
  const m = ctx.dans || $('inventaireModal');
  if (!m) return;
  const onglets = [
    ...(ctx.mode === 'rogue' ? [['permanent', 'Permanent', ctx.meta.reduce((a, x) => a + x.n, 0)]] : []),
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
    if (etat.onglet === 'permanent') {
      const conso = ctx.meta.filter(x => garde(x.id));
      // V12-2 ; V16, tranche 6 : chaque carte rare se joue chez ce qu'elle monte ; ici, elle se lit.
      corps = `<p class="inv-mot">${VIES.permanent.mot} Chaque carte se joue chez ce qu'elle monte : le stage et la formation chez le coach, les soins à l'infirmerie, les cartes de joueur à l'effectif.</p>
        ${filtres(['consommable'])}
        <h3 class="inv-sec">🧴 Tes cartes permanentes · ${ctx.meta.reduce((a, x) => a + x.n, 0)}</h3>
        <div class="inv-grille">${conso.map(x => carteBanqueHtml(x.id, { compte: x.n,
          actions: `<button type="button" class="btn gold inv-jouer-meta" data-id="${esc(x.id)}"${ctx.peutJouer ? '' : ' disabled'}>Jouer</button>` })).join('') || vide('Aucune carte gardée d\'une run à l\'autre.')}</div>`;
    } else {
      // V6 : une carte retirée (elle ne se tire plus) ne se montre qu'à qui l'a déjà.
      const ids = Object.keys(BANQUE).filter(id => garde(id)).sort((a, b) => ORDRE_CATEGORIES.indexOf(BANQUE[a].cat) - ORDRE_CATEGORIES.indexOf(BANQUE[b].cat));
      // Le dénominateur ne compte que ce qu'un pack peut donner (V2.2) ; le reste se gagne en jouant.
      const par = ORDRE_CATEGORIES.map(c => [c, idsDe(c).filter(id => sortDUnPack(id) && ctx.possedees.has(id)).length, idsDe(c).filter(sortDUnPack).length]).filter(([, , n]) => n > 0);
      const horsPack = Object.keys(BANQUE).filter(id => !sortDUnPack(id)).length;
      corps = `<p class="inv-mot">Toute la banque : ${Object.keys(BANQUE).filter(sortDUnPack).length} cartes à tirer des packs, et ${horsPack} qui se gagnent en jouant (les malédictions). Celles que tu as déjà tirées sont en couleur.${ctx.joueursCollection ? ` Tes ${ctx.joueursCollection} cartes de joueur sont dans ton cartable (la section Collection).` : ''}</p>
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
