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
import { BANQUE, CATEGORIES, ORDRE_CATEGORIES, ROLES, VIES, MOMENTS, momentDe, reglesDe, carteBanque, idsDe, etiquetteBanque, reglesDePalier, idsDuCoach, coachsActifs } from './banque.js';
import { COACHS, ORDRE_COACHS, SEUILS, ROMAINS, palierDe, avantProchain, JOUEUR_COACH } from './coachs.js';
import { tirerCartesPack, sortDUnPack } from './packs.js';
import { RARETES } from './cartes.js';
import { puces, optionDeCarteMatch, enMotsEtChiffres, chiffresOuverts, basculerChiffres } from './gerant.js';
import { esc, hache, money as M } from './util.js';

const $ = id => document.getElementById(id);

/* Les paliers de la saison donnent un pack mixte gratuit (S79) : ses cartes de saison, jamais un permanent. */
export const PALIERS_PACK = [9, 18, 26];
/*
 * LA MAIN DE LA SEMAINE (V4.3). JP : *ça pioche x cartes, pis tu choisis ce que tu joues pour la semaine, ce qui
 * force à les jouer ou pas les jouer consciemment, tout en gardant de bâtir un deck de bonnes cartes pour de bonnes
 * pioches*. La poche est ta pile : chaque semaine (`SEMAINE` jours), `MAIN_SEMAINE` de ses cartes sortent en main,
 * et tu en joues `JOUEES_SEMAINE` au plus ; les autres retournent dans la poche. Acheter ajoute des cartes à la
 * pile, vendre l'amincit : une poche de bonnes cartes pige de bonnes mains.
 */
export const SEMAINE = 7, MAIN_SEMAINE = 4, JOUEES_SEMAINE = 2;

/*
 * LA POCHE DE LA PARTIE, pure : les cartes des packs achetés (\`achat.cartes\`)
 * et des paliers atteints, moins celles jouées (\`joue.ref\`) et vendues
 * (\`vend.refs\`). \`rogue\` : les permanents sont partis au méta à l'ouverture.
 */
export function pocheDeLaPartie({ decisions = [], graine = 0, nMatch = 0, rogue = false } = {}) {
  const items = [];
  const achats = decisions.filter(d => d && d.achat && d.achat.sorte === 'cartes');
  for (const d of achats) (d.achat.cartes || []).forEach((id, t) => {
    if (!BANQUE[id]) return;
    if (rogue && BANQUE[id].vie === 'permanent') return;
    // Une carte de match va droit au deck à l'ouverture (`deckDe`, js/combat.js) : la poche est ce qui se joue en semaine.
    if (BANQUE[id].cat === 'match') return;
    if ((d.achat.vendus || []).includes(t)) return;
    items.push({ ref: `${d.achat.n}:${t}`, id, source: `Pack · journée ${(d.jour || 0) + 1}` });
  });
  // S80 : une amélioration ou une édition de l'atelier prise à un palier du deck SE GARDE (`garde`), comme une carte de pack.
  for (const d of decisions) if (d && d.garde && BANQUE[d.garde]) items.push({ ref: `deck:${d.palier}`, id: d.garde, source: `Main de la journée ${d.palier}` });
  for (const p of PALIERS_PACK) {
    if (nMatch < p) continue;
    tirerCartesPack('mixte', graine, `palier${p}`, { sans: ['match'] }).forEach((id, t) => {
      // V5 : un permanent ne se joue pas en semaine ; sa place se repige (même graine, autre clé) au lieu de laisser
      // un pack gratuit de cinq cartes en donner trois. Une partie d'avant ne l'avait jamais vue : rien à rejouer.
      for (let k = 0; k < 8 && BANQUE[id] && BANQUE[id].vie === 'permanent'; k++) id = tirerCartesPack('mixte', graine, `palier${p}:${t}:${k}`, { sans: ['match'] })[t];
      if (!BANQUE[id] || BANQUE[id].vie === 'permanent') return;
      items.push({ ref: `p${p}:${t}`, id, source: `Main du match ${p}` });
    });
  }
  const parties = new Set();
  for (const d of decisions) {
    if (d && d.joue && d.joue.src === 'partie') parties.add(d.joue.ref);
    if (d && d.vend && Array.isArray(d.vend.refs)) d.vend.refs.forEach(r => parties.add(r));
  }
  return items.filter(x => !parties.has(x.ref));
}

/*
 * LA MAIN DE LA SEMAINE, pure. Elle se pige dans la poche du premier jour de la semaine, dans l'ordre que la graine
 * donne à chaque carte (`hache`) ; une carte reçue en cours de semaine complète une main qui n'est pas pleine, sans
 * déplacer celles déjà là. Une carte jouée ou vendue cette semaine reste dans la main, marquée. `nMatchDebut` et
 * `nMatch` : les matchs joués au premier jour et aujourd'hui (les packs gratuits des paliers).
 * Rend { w, debut, fin, main: [{ ref, id, jouee, vendue }], taille, reste, reglee }.
 */
export function mainDeLaSemaine({ decisions = [], graine = 0, jour = 0, nMatchDebut = 0, nMatch = 0, rogue = false } = {}) {
  const w = Math.floor(jour / SEMAINE), debut = w * SEMAINE, fin = debut + SEMAINE;
  /*
   * V5 : LA MAIN SE DISTRIBUE APRÈS LA BOUTIQUE. La boutique du Rogue n'ouvre qu'au début de la semaine : ce qu'on y
   * achète le lundi entre dans la pile où la main pige, tant qu'aucune carte de la semaine n'a été jouée ni vendue
   * (la main est alors figée : racheter ne la rebrasse pas). Après, une carte reçue complète la main si elle a de la place.
   */
  const premier = decisions.findIndex(d => d && (d.jour ?? 0) >= debut && (d.jour ?? 0) < fin && (d.joue || d.vend));
  const avant = decisions.filter((d, i) => d && ((d.jour ?? 0) < debut || ((d.jour ?? 0) === debut && d.achat && (premier < 0 || i < premier))));
  const pile = pocheDeLaPartie({ decisions: avant, graine, nMatch: nMatchDebut, rogue });
  /*
   * LES COACHS PIGENT LEURS CARTES (V4.3). JP : *ce système justifie encore plus les coachs*. Une carte de la couleur
   * d'un coach auquel l'équipe croit sort plus souvent en main : son tirage (0 à 1) est élevé à la puissance 1 + sa
   * confiance (I, II, III), donc tiré plus tôt. Au jeu, elle grandit déjà avec ses cartes jouées (`grandi`, js/banque.js).
   */
  const confiance = new Map(coachsActifs(decisions, debut).map(c => [c.cle, c.palier]));
  const tirage = x => hache(graine, 'main', w, x.ref) ** (1 + (confiance.get(BANQUE[x.id].coach) || 0));
  const tiree = pile.map(x => ({ x, k: tirage(x) })).sort((a, b) => a.k - b.k).map(o => o.x);
  const deja = new Set(pile.map(x => x.ref));
  // Reçues cette semaine : sans retirer ce qu'on y a joué ou vendu, pour qu'une place ne se libère pas d'elle-même.
  const recues = pocheDeLaPartie({ decisions: decisions.filter(d => d && ((d.jour ?? 0) < debut || ((d.jour ?? 0) < fin && !d.joue && !d.vend))), graine, nMatch, rogue })
    .filter(x => !deja.has(x.ref));
  const cette = decisions.filter(d => d && (d.jour ?? 0) >= debut && (d.jour ?? 0) < fin);
  const jouees = new Set(cette.filter(d => d.joue && d.joue.src === 'partie').map(d => d.joue.ref));
  const vendues = new Set(cette.flatMap(d => (d.vend && Array.isArray(d.vend.refs) ? d.vend.refs : [])));
  // Une carte jouée ou vendue cette semaine n'est plus dans la poche d'aujourd'hui : on la garde dans la main, marquée.
  const main = [...tiree, ...recues].slice(0, MAIN_SEMAINE).map(x => ({ ...x, jouee: jouees.has(x.ref), vendue: vendues.has(x.ref), confiance: confiance.get(BANQUE[x.id].coach) || 0 }));
  const nJouees = main.filter(x => x.jouee).length;
  // `taille` : les cartes où la semaine a pigé (la poche du lundi et celles reçues depuis), pour le dire à l'écran.
  return { w, debut, fin, main, taille: pile.length + recues.length, reste: Math.max(0, JOUEES_SEMAINE - nJouees), reglee: decisions.some(d => d && d.palier === `main:${w}`) };
}

/* Sur qui une carte se joue : ce que dit le coin de la carte (sa famille est déjà en haut). */
const CIBLES = { blesse: 'Un blessé', joueur: 'Un joueur', recrue: 'Une recrue', aucune: 'L\'équipe', malediction: 'Le deck', carteMatch: 'Le deck', tactique: 'Un système' };
/*
 * La valeur de vente rapide d'une carte, en jetons (selon sa rareté). S82 :
 * à 2/5/12/30, une carte valait 4,94 🪙 en moyenne aux cotes 55/30/12/3 des
 * packs (js/packs.js), et acheter un pack pour tout revendre RAPPORTAIT
 * (Consommables 15 🪙 → 24,7 🪙). Un consommable ne se revend pas (cinq par
 * pack, vie courte) ; le reste vaut 1,24 🪙 en moyenne, soit au plus le tiers
 * du prix d'un pack. scripts/check_packs.mjs le mesure pour chaque pack.
 */
export const VENTE = { commune: 1, peu: 1, rare: 2, legendaire: 5, maudite: 0 };
export const valeurDe = id => { const c = BANQUE[id] || {}; return c.cat === 'consommable' ? 0 : (VENTE[c.rarete] ?? 1); };

/* ---------- la carte de la banque, en petit ---------- */
function carteBanqueHtml(id, { compte = 0, actions = '', possede = true, vie = null } = {}) {
  const c = carteBanque(id);
  if (!c) return '';
  const mots = c.cat === 'match' ? optionDeCarteMatch(c.cle).mots : reglesDe(id);
  const R = RARETES[c.rarete] || { gemme: '◆', nom: c.rarete };
  const forme = etiquetteBanque(id);
  const sous = c.cat === 'patron' ? ROLES[c.role].nom : c.cat === 'match' ? `${c.cout} élan` : c.cat === 'evenement' ? `${c.duree} match${c.duree === 1 ? '' : 's'}`
    : c.cat === 'saison' ? 'Toute la saison' : c.cat === 'joueur' ? 'Un joueur' : (CIBLES[c.cible] || CATEGORIES[c.cat].un);
  const v = vie || c.vie;
  return `<div class="bq-carte bq-${c.cat} tc-${c.rarete}${possede ? '' : ' pas-a-moi'}" data-id="${esc(id)}">
    <div class="bq-tete"><span class="bq-ico" aria-hidden="true">${c.ico}</span><span class="bq-nom">${esc(c.nom)}</span>${compte > 1 ? `<span class="bq-compte">×${compte}</span>` : ''}</div>
    <div class="bq-sous"><span>${esc(CATEGORIES[c.cat].un)}</span>${forme ? `<span class="choix-forme">${esc(forme)}</span>` : ''}<span>${esc(sous)}</span></div>
    ${COACHS[c.coach] ? `<div class="bq-coach" title="${esc(COACHS[c.coach].mot)}">${COACHS[c.coach].ico} ${esc(COACHS[c.coach].nom)}</div>` : '<div class="bq-coach" title="Elle ne compte pour aucun coach">Neutre</div>'}
    ${possede ? `<div class="bq-regle">${puces(enMotsEtChiffres(mots), m => !!m.chiffre)}</div><div class="bq-texte">${esc(c.texte || '')}</div>` : '<div class="bq-regle bq-cache">Pas encore dans ta collection</div>'}
    <div class="bq-pied"><span class="bq-moment moment-${momentDe(id)}" title="${esc(MOMENTS[momentDe(id)].mot)}">${MOMENTS[momentDe(id)].ico} ${esc(MOMENTS[momentDe(id)].nom)}</span><span class="bq-vie vie-${v}" title="${esc(VIES[v] ? VIES[v].mot : '')}">${esc(VIES[v] ? VIES[v].nom : '')}</span><span class="bq-gemme" title="${esc(R.nom)}">${R.gemme}</span></div>
    ${actions ? `<div class="bq-actions">${actions}</div>` : ''}
  </div>`;
}

/* ---------- l'écran ---------- */
let etat = { onglet: null, cat: 'tout', rar: 'tout' };
/*
 * ctx : { titre, mode ('rogue' | 'saison'), enSaison, jetons, partie: [{ref, id, source}],
 *         meta: [{id, n}], personnel: [cles], patronsActifs: [{cle, role}], maxPatrons,
 *         deck: [cles], possedees: Set(ids), joueursCollection: n,
 *         build: { coach: n } (v2), coachsActifs: [{cle, palier}], coachRun: le coach de la run,
 *         jouer(item), vendre(item), onFerme() }
 */
export function ouvrirInventaire(ctx) {
  // Dans une page du Marché (`ctx.dans`, `ctx.fermer`, js/game.js) ou dans sa fenêtre.
  const m = ctx.dans || $('inventaireModal');
  if (!m) return;
  const onglets = [
    ...(ctx.enSaison ? [['partie', 'Cette saison', ctx.partie.length]] : []),
    ...(ctx.mode === 'rogue' ? [['permanent', 'Permanent', ctx.meta.reduce((a, x) => a + x.n, 0) + ctx.personnel.length]] : []),
    ...(ctx.enSaison ? [['deck', 'Le deck', ctx.deck.length]] : []),
    // v2 : tes coachs — ce que tes cartes jouées font croire au vestiaire (js/coachs.js).
    ...(ctx.build ? [['coachs', 'Tes coachs', (ctx.coachsActifs || []).length]] : []),
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
      const cats = ORDRE_CATEGORIES.filter(c => c !== 'saison' && [...piles.keys()].some(id => BANQUE[id].cat === c));
      const cartes = [...piles.entries()].filter(([id]) => garde(id)).sort((a, b) => ORDRE_CATEGORIES.indexOf(BANQUE[a[0]].cat) - ORDRE_CATEGORIES.indexOf(BANQUE[b[0]].cat));
      // V4.3 : en Rogue, une carte ne se joue que de ta main de la semaine (`ctx.nonJouable` dit pourquoi pas).
      const nonJouable = ref => (ctx.nonJouable ? ctx.nonJouable(ref) : '');
      corps = `<p class="inv-mot">${ctx.mode === 'rogue' ? `🃏 Chaque semaine, ${MAIN_SEMAINE} cartes de ta poche en main ; tu en joues ${JOUEES_SEMAINE}. Elle expire à la fin de la saison.` : `${MOMENTS.garde.ico} ${esc(MOMENTS.garde.mot)}`}</p>
                ${filtres(cats)}
        <div class="inv-grille">${cartes.map(([id, pile]) => {
          const x = pile.find(c => !nonJouable(c.ref)) || pile[0], non = nonJouable(x.ref);
          return carteBanqueHtml(id, { compte: pile.length, vie: ['consommable', 'plafond'].includes(BANQUE[id].cat) ? 'usage' : 'saison',
          actions: `<button type="button" class="btn gold inv-jouer" data-ref="${esc(x.ref)}" data-id="${esc(id)}"${ctx.peutJouer && !non ? '' : ' disabled'}>${non ? esc(non) : 'Jouer'}</button>${valeurDe(id) > 0 ? `<button type="button" class="btn inv-vendre" data-ref="${esc(pile[0].ref)}" data-id="${esc(id)}">Vendre · ${valeurDe(id)} 🪙</button>` : ''}` });
        }).join('') || vide(`Rien dans ta poche : ouvre des packs à la boutique, ou attends la prochaine main (matchs ${PALIERS_PACK.join(', ')}).`)}</div>`;
    } else if (etat.onglet === 'permanent') {
      const engages = new Set((ctx.patronsActifs || []).map(p => p.cle));
      const perso = ctx.personnel.filter(k => garde(`patron:${k}`));
      const conso = ctx.meta.filter(x => garde(x.id));
      corps = `<p class="inv-mot">${VIES.permanent.mot} Le personnel ne s'use pas : tu l'engages à chaque saison, ${ctx.maxPatrons} postes au plus, un par rôle.</p>
        ${filtres(['patron', 'consommable', 'plafond'])}
        <h3 class="inv-sec">👔 Ton personnel · ${ctx.personnel.length}</h3>
        <div class="inv-grille">${perso.map(k => carteBanqueHtml(`patron:${k}`, {
          actions: engages.has(k) ? '<span class="inv-engage">✓ Engagé</span>' : `<button type="button" class="btn gold inv-engager" data-id="patron:${esc(k)}"${ctx.peutJouer ? '' : ' disabled'}>Engager</button>`,
        })).join('') || vide('Aucun patron : les packs Personnel en donnent.')}</div>
        <h3 class="inv-sec">🧴 Tes cartes permanentes · ${ctx.meta.reduce((a, x) => a + x.n, 0)}</h3>
        <div class="inv-grille">${conso.map(x => carteBanqueHtml(x.id, { compte: x.n,
          actions: `<button type="button" class="btn gold inv-jouer-meta" data-id="${esc(x.id)}"${ctx.peutJouer ? '' : ' disabled'}>Jouer</button>` })).join('') || vide('Aucun consommable permanent.')}</div>`;
    } else if (etat.onglet === 'deck') {
      const piles = new Map();
      for (const k of ctx.deck) piles.set(k, (piles.get(k) || 0) + 1);
      corps = `<p class="inv-mot">Ton deck de match : tu en piges cinq avant chaque gros match et chaque match de séries.</p>
        <div class="inv-grille">${[...piles.entries()].map(([k, n]) => carteBanqueHtml(`match:${String(k).replace(/\+$/, '')}`, { compte: n })).join('')}</div>`;
    } else if (etat.onglet === 'coachs') {
      /*
       * TES COACHS (v2) : chaque carte jouée compte pour le coach de sa couleur ;
       * à 3, 6 et 9, le vestiaire croit à lui et sa philosophie joue toute la
       * saison. Le coach choisi au départ vient en tête ; puis ceux qui ont le
       * plus de cartes.
       */
      const allumes = new Map((ctx.coachsActifs || []).map(x => [x.cle, x.palier]));
      const ordre = ORDRE_COACHS.slice().sort((a, b) => (b === ctx.coachRun) - (a === ctx.coachRun) || (ctx.build[b] || 0) - (ctx.build[a] || 0));
      corps = `<p class="inv-mot">Chaque carte jouée compte pour le coach de sa couleur. À ${SEUILS.join(', ')} cartes, l'équipe croit à lui (${ROMAINS.slice(1).join(', ')}) : sa philosophie joue pour le reste de la saison, séries comprises. Chaque joueur de sa couleur habillé la fait jouer ${Math.round(JOUEUR_COACH * 100)} % plus fort (jusqu'à ${JOUEURS_MAX}).${ctx.mode === 'rogue' ? ' Le compte suit ta run d\'une saison à l\'autre.' : ''}</p>
        <div class="inv-coachs">${ordre.map(k => {
          const C = COACHS[k], n = ctx.build[k] || 0, pal = Math.max(palierDe(n), allumes.get(k) || 0), manque = avantProchain(n);
          const cible = SEUILS[Math.min(pal, SEUILS.length - 1)];
          return `<div class="inv-coach${pal ? ' allume' : ''}${k === ctx.coachRun ? ' tien' : ''}" data-coach="${k}">
            <div class="inv-coach-tete"><span class="inv-coach-ico" aria-hidden="true">${C.ico}</span><b>${esc(C.nom)}</b>${pal ? `<span class="inv-coach-rang">${ROMAINS[pal]}</span>` : ''}${k === ctx.coachRun ? '<span class="inv-coach-tien">Ton coach</span>' : ''}</div>
            <div class="inv-coach-mot">${esc(C.mot)}${k === ctx.coachRun ? ` Son dépisteur recrute ${esc(C.recrute)}.` : ''}</div>
            <div class="inv-coach-jauge" aria-label="${n} carte${n > 1 ? 's' : ''} sur ${cible}"><i style="width:${Math.min(100, Math.round((n / SEUILS[SEUILS.length - 1]) * 100))}%"></i>${SEUILS.map(x => `<em style="left:${Math.round((x / SEUILS[SEUILS.length - 1]) * 100)}%"${n >= x ? ' class="fait"' : ''}></em>`).join('')}</div>
            <div class="inv-coach-compte">${n} carte${n > 1 ? 's' : ''} jouée${n > 1 ? 's' : ''}${manque ? ` · encore ${manque} pour ${ROMAINS[pal + 1]}` : ' · confiance au sommet'} · ${idsDuCoach(k).length} cartes de sa couleur</div>
            ${k !== 'banque' ? (() => { const J = (ctx.joueurs || {})[k] || { joueurs: 0, paliers: 0 }; return `<div class="inv-coach-compte">${J.joueurs} joueur${J.joueurs > 1 ? 's' : ''} de sa couleur habillé${J.joueurs > 1 ? 's' : ''}, ${J.paliers} palier${J.paliers > 1 ? 's' : ''}${pal && J.paliers ? ` : sa confiance joue ×${String(Math.round((1 + JOUEUR_COACH * J.paliers) * 10) / 10).replace('.', ',')}` : ''}</div>`; })() : ''}
            ${pal ? `<div class="inv-coach-regle"><span>Joue :</span> ${puces(reglesDePalier(k, pal))}</div>` : ''}
            ${manque ? `<div class="inv-coach-regle suite"><span>${ROMAINS[pal + 1]} :</span> ${puces(reglesDePalier(k, pal + 1))}</div>` : ''}
          </div>`;
        }).join('')}</div>`;
    } else {
      const ids = Object.keys(BANQUE).filter(garde).sort((a, b) => ORDRE_CATEGORIES.indexOf(BANQUE[a].cat) - ORDRE_CATEGORIES.indexOf(BANQUE[b].cat));
      // Le dénominateur ne compte que ce qu'un pack peut donner (V2.2) ; le reste se gagne en jouant.
      const par = ORDRE_CATEGORIES.map(c => [c, idsDe(c).filter(id => sortDUnPack(id) && ctx.possedees.has(id)).length, idsDe(c).filter(sortDUnPack).length]).filter(([, , n]) => n > 0);
      const horsPack = Object.keys(BANQUE).filter(id => !sortDUnPack(id)).length;
      corps = `<p class="inv-mot">Toute la banque : ${Object.keys(BANQUE).length - horsPack} cartes à tirer des packs, et ${horsPack} qui se gagnent en jouant (les cartes de saison, les malédictions). Celles que tu as déjà tirées sont en couleur.${ctx.joueursCollection ? ` Tes ${ctx.joueursCollection} cartes de joueur sont dans ton cartable (la section Collection).` : ''}</p>
        <div class="inv-progres">${par.map(([c, a, n]) => `<span class="inv-prog"><b>${CATEGORIES[c].ico} ${a}/${n}</b> ${esc(CATEGORIES[c].nom)}</span>`).join('')}</div>
        ${filtres(ORDRE_CATEGORIES)}${rars}
        <div class="inv-grille">${ids.map(id => carteBanqueHtml(id, { possede: ctx.possedees.has(id) })).join('')}</div>`;
    }
    // LA MASSE SALARIALE (S79) : le plafond effectif, et ce qui le tord — les cartes 💵 jouées, le vestiaire, le DG.
    const P = ctx.plafond;
    const plafond = P ? `<div class="inv-plafond${P.masse > P.cap ? ' over' : ''}">
      <div class="inv-pl-tete"><span>💵 Masse salariale</span><b>${M(P.masse)} / ${M(P.cap)}</b></div>
      <div class="inv-pl-barre" aria-hidden="true"><i style="width:${Math.min(100, Math.round((P.masse / P.cap) * 100))}%"></i></div>
      <div class="inv-pl-lignes">${P.lignes.length ? puces(P.lignes.map(l => ({ txt: l.joueur ? l.nom : `${l.nom} ${l.montant > 0 ? '+' : '−'}${M(Math.abs(l.montant))}`, bon: l.joueur ? true : l.montant > 0 }))) : `<span class="inv-pl-rien">Plafond de base : ${M(P.base)}. Les cartes 💵 le tordent.</span>`}</div>
    </div>` : '';
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
    m.querySelectorAll('.inv-engager').forEach(b => { b.onclick = () => { fermer(true); ctx.jouer({ src: 'personnel', id: b.dataset.id }); }; });
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
