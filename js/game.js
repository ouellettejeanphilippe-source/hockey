/**
 * Contrôleur d'interface — poste de directeur général.
 *
 * Trois zones : la roulette (quelle saison, quelle équipe, quelle unité), le
 * tableau de bord (ce qu'il reste à combler et avec quel budget) et les deux
 * volets main / alignement.
 *
 * DEUX TIRAGES. En VESTIAIRE — le jeu d'origine — la roulette sort une
 * équipe et tout son club : trente cartes, six colonnes par poste, tri,
 * recherche, et les relances d'année, d'équipe et de passe. En LOTO, elle
 * sort trois équipes et ne montre que le joueur que chacune met à la case
 * qu'on comble : une main de trois cartes, DÉRIVÉE à chaque rendu du tirage
 * et de la case courante, donc viser une autre case dans l'alignement
 * recompose la main sans relancer.
 *
 * Règle ferme : aucune cote cachée dans le DOM avant la simulation. Les
 * cotes vivent dans le coffre de js/sim.js ; seules la zone d'efficacité
 * (`lz`) et l'archétype (`ak`), qui sont dans le shard et volontairement
 * publics, sont affichés. L'hexagone n'apparaît que si le joueur lève
 * lui-même le brouillard de guerre dans les options.
 */

import { loadIndex, loadSeason, prefetch, state, cacheClear } from './data.js';
import {
  SLOTS, CAP, REROLLS, fits, simulate, getPositionPenalty, registerHiddenRatings,
  getHiddenRatings, getUnitSynergy, getPlayerKey, getPersonKey, createTeam, creerLigue, jouerJusqua, bilanLigue, photoAlignement, trioDeFermetureAuto, soirEreintant,
  autoRoster, MODES, modeDe, casesDuMode, joueurEquivalent, nouvelleGraine, compterFeuilles,
  CARTES, PLANS, ROULEMENTS, planDe, roulementDe, connaitre, lignesDe, profilPrincipal, roleSecond, identiteUnite, systemeDe, MUTATIONS, effetsEnCours,
  unitesIdeales, mutationNuit, editionsDuJour, motsDeMutation, poserAlignementDuJour } from './sim.js';
import { LOGOS_LOCAUX } from './logos_locaux.js';
import { getTeamLogoHtml, TEAM_COLORS, couleurVive, encreSur, fondEquipe, viveSurFond, getTeamBand, teamSeasonUrl, nhlPlayerUrl } from './logos.js';
import { ouvrirSaison } from './saison.js';
import { hubActif, voletPour, surCoquille } from './coquille.js';
import { strategieDeLigne, effetsHtml, barresProfils, ouvrirChoix, optionDeCarteMatch, puces } from './gerant.js';
import { IDENTITES, scoreIdentite, identitesOffertes } from './identites.js';
import { albumHtml } from './album.js';
import { RARETES, rareteDeSalaire, gemmeJoueur, sensRarete, artJoueur, brille, brillante, tirageLimite, numeroDeCarte, TAILLE_SERIE, brancherInclinaison, ereDe, anneeDeCarte, dessinDe } from './cartes.js';
import { CARTES_MATCH, recompensesOffertes, deckDe } from './combat.js';
import { COTES_VARIANTES, varianteTiree, carteDe, traitsDeCarte, NOM_VARIANTE } from './rarete.js';
import { ouvrirEquipes, motDeClub } from './equipes.js';
import { nouveauTournoi, ouvrirTournoi, classement as classementTournoi, etatDuTournoi, relireTournoi, CLUBS as CLUBS_TOURNOI } from './tournoi.js';
import { ouvrirTable } from './plateau.js';
import { reglesDuPlateau, statsDeTable, GABARITS, TIRS, HABILETES, habileteDe, AXE_MOT, equipeDeTable, gagnantDuMatch } from './table.js';
import { brancherBilan, renderResult, runPlayoffs, ouvrirEcranSeries, teamShort, teamLabel, tagCourt, cleDeSommaire, nombreEnSeries, ONGLETS_BILAN, ficheReelleDe } from './bilan.js';
import { brancherEntractes } from './entracte.js';
import { FRANCHISES, codeDeFranchise, saisonsDeFranchise } from './franchises.js';
import { migrer, lireIndex, lirePartieActive, ecrirePartieActive, nouvellePartie, activer } from './sauvegardes.js';
import { afficherMenu, fermerMenu } from './menu.js';
import { ouvrirExhibition } from './exhibition.js';
import { BANQUE, PATRONS, CONSOMMABLES, CONTRATS, ROLES, MAX_PATRONS, CATEGORIES, VIES, payloadDe, patronsActifs, modificateurs, reglesDe, plafondDe } from './banque.js';
import { PACKS_TOUS, PITIE, SKILLS, cotesDuPack, tirerVariante, tirerCartesPack, packDuJour, packsSansHolo } from './packs.js';
import { ouvrirInventaire, pocheDeLaPartie, valeurDe, VENTE } from './inventaire.js';
import { ouvrirMagasin } from './magasin.js';
import { rendreCartable, ajouterAuCartable, migrerHistorique, lireCartable } from './cartable.js';
import { JETONS, jetonsDe, PACKS, DEBLOCAGES, lireMeta, aDebloque, nombreGardes, jetonsDeDepart, packsOuverts, peutAcheter, acheterDeblocage,
  ajouterCollection, payerEcussons, ecussonsDeLaSaison, ecussonsDesSeries, hache, rareteTiree, recevoirPermanents, retirerDuMeta, plafondDuVestiaire } from './rogue.js';

/* Une icône du sprite de `index.html` : trait de 2, couleur du texte. */
const ico = n => `<svg class="ico" aria-hidden="true"><use href="#${n}"/></svg>`;
import { getArchetype, getEraFactor, getEraSalary, getLineZone, ageAtSeason, SEASON_ERA_CAP, getSecondaryPosition, seasonLancers, passesRelatives, mesuresDeSaison, SEUIL_MESURE } from './ratings.js';
import { getTraits, TRAITS } from './traits.js';
import { activerSons } from './sons.js';

const $ = id => document.getElementById(id);
const rnd = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Salaire plancher de la LNH dans le barème du jeu : sert au calcul du budget restant. */
const MIN_SAL = 775_000;

const money = n => {
  const m = n / 1e6;
  const s = Math.abs(m) >= 10 ? m.toFixed(1) : m.toFixed(2);
  return (n < 0 ? '−$' : '$') + s.replace('-', '').replace(/\.?0+$/, '') + 'M';
};
const pctCap = n => (n / CAP * 100).toFixed(1) + ' %';

const TEAMFULL = {
  QUE: 'Nordiques de Québec', HFD: 'Whalers de Hartford', MNS: 'North Stars du Minnesota',
  AFM: "Flames d'Atlanta", ATL: "Thrashers d'Atlanta", KCS: 'Scouts de Kansas City',
  CLR: 'Rockies du Colorado', CLE: 'Barons de Cleveland', CGS: 'Golden Seals de Californie',
  OAK: "Seals d'Oakland", WIN: 'Jets de Winnipeg (1979-96)', PHX: 'Coyotes de Phoenix',
  ARI: "Coyotes de l'Arizona", MDA: "Mighty Ducks d'Anaheim",
  MTL: 'Canadiens de Montréal', TOR: 'Maple Leafs de Toronto', BOS: 'Bruins de Boston',
  NYR: 'Rangers de New York', DET: 'Red Wings de Détroit', CHI: 'Blackhawks de Chicago',
  EDM: "Oilers d'Edmonton", CGY: 'Flames de Calgary', VAN: 'Canucks de Vancouver',
  OTT: "Sénateurs d'Ottawa", WPG: 'Jets de Winnipeg', PIT: 'Penguins de Pittsburgh',
  PHI: 'Flyers de Philadelphie', STL: 'Blues de St. Louis', LAK: 'Kings de Los Angeles',
  BUF: 'Sabres de Buffalo', NYI: 'Islanders de New York', WSH: 'Capitals de Washington',
  NJD: 'Devils du New Jersey', COL: 'Avalanche du Colorado', DAL: 'Stars de Dallas',
  SJS: 'Sharks de San Jose', TBL: 'Lightning de Tampa Bay', FLA: 'Panthers de la Floride',
  ANA: "Ducks d'Anaheim", NSH: 'Predators de Nashville', CBJ: 'Blue Jackets de Columbus',
  MIN: 'Wild du Minnesota', CAR: 'Hurricanes de la Caroline', VGK: 'Golden Knights de Vegas',
  SEA: 'Kraken de Seattle', UTA: 'Utah', UTM: 'Utah',
  YOU: 'NHL Stars',
};
const DEFUNCT = new Set(['QUE', 'HFD', 'MNS', 'AFM', 'ATL', 'KCS', 'CLR', 'CLE', 'CGS', 'OAK', 'WIN', 'PHX', 'MDA', 'ARI']);

/* =====================================================================
   État
   ===================================================================== */

const G = {
  roster: {},
  /*
   * Ce que la roulette a sorti : une liste de vestiaires `{ season, team,
   * pool }` — un seul en tirage VESTIAIRE, trois en tirage LOTO. La main
   * qu'on te tend s'en déduit à chaque rendu (`candidats`).
   */
  tirage: [],
  left: { ...REROLLS }, // relances d'année, d'équipe et de passe (tirage VESTIAIRE)
  relances: 0,          // relances restantes (tirage LOTO)
  target: null,         // case ciblée par le joueur
  selectedSlot: null,   // case sélectionnée pour un déplacement
  filter: 'ALL',
  /*
   * Deux façons de lire le même vestiaire, et c'est un vrai choix de lecture.
   * 'POS' range en six colonnes, une par poste — sur téléphone on les balaie
   * du doigt plutôt que de dérouler six sections empilées, parce qu'un
   * vestiaire de trente joueurs faisait six écrans de haut. 'LIST' les met
   * tous ensemble dans l'ordre du tri : c'est la vue du chasseur d'aubaine,
   * qui veut voir le meilleur pointeur du vestiaire sans se demander à quel
   * poste il joue.
   */
  /*
   * LA PALETTE. JP : *bleu foncé pis jaune, ça fait cheap* ; *plusieurs
   * palettes ?* ; *je joue sur écrans OLED, donc pas de limites de noir*.
   * Trois jeux de jetons dans style.css, posés sur <html> : graphite (le
   * défaut, neutre et laiton), oled (le vrai noir) et glace (ardoise et
   * acier). Rien d'autre ne change dans l'interface.
   */
  palette: 'graphite',  // graphite | oled | glace
  franchise: 'MTL',     // la franchise du repêchage « Une franchise » (S73, js/franchises.js)
  /* Les effets sonores du plateau (js/sons.js). Une préférence d'affichage,
     pas un réglage de partie : couper le son ne change rien à ce qui est joué. */
  sons: true,
  /*
   * LE NIVEAU DE L'ADVERSAIRE SUR TABLE (S75). Une préférence, comme les sons :
   * elle ne touche ni au repêchage ni au tournoi déjà joué, seulement à la
   * tête de l'IA d'en face dans TES prochains matchs (`nouveauMatch`, `recrue`).
   * Recrue par défaut : le passage du testeur a perdu neuf matchs de 0-6 à 1-16.
   */
  niveauTable: 'RECRUE',  // RECRUE | PRO
  /*
   * LE MODE BONUS. JP : *mode bonus genre blood bowl, fft et autres jeux de
   * sport de table*. Ce réglage ne touche PAS au repêchage : les 23 cases, le
   * plafond et la roulette sont exactement les mêmes. Il dit ce qu'on fait de
   * l'alignement une fois bâti — la saison de 82 matchs (le jeu d'origine) ou
   * le tournoi sur table (js/tournoi.js, js/plateau.js, js/table.js).
   */
  bonus: 'SAISON',      // SAISON | TABLE
  /*
   * LES VARIANTES DE CARTES (S78, js/rarete.js) : la graine de la partie, d'où
   * chaque joueur tire sa variante (base, parallèle, holo, or) et son bonus,
   * et celles qu'un pack du mode Rogue a sorties (`cartes`, clé → variante).
   */
  variantes: { graine: null, cartes: {} },
  poolView: 'POS',      // POS | LIST
  sortBy: 'PTS',
  search: '',
  onlyFit: false,
  statsProrata: false,
  salaryMode: '2026',   // '2026' | 'ERA'
  /*
   * LE BROUILLON DE L'ÉCRAN « NOUVELLE PARTIE ». Les cinq réglages de partie
   * s'y posent sans toucher au jeu ; `demarrerPartie` les applique d'un coup.
   * Semé depuis l'état VIVANT `G`, jamais depuis les préférences :
   * `restoreSave` écrase G sans rappeler `saveOpts`, donc `cap82_opts` peut
   * être en désaccord avec la partie qu'on joue. Jamais persisté.
   */
  brouillon: null,      // { mode, epoque, epoqueChoisie, repechage, bonus } | null
  banc: null,           // derrière le banc : { jour, compte, blesses, fermeture, prochain, fiche } — jamais sauvegardé
  mode: 'CLASSIQUE',    // CLASSIQUE | LOTO | EXPRESS | LOTO_EXPRESS (voir MODES dans sim.js)
  /*
   * UNE SAISON, LA COUPE CETTE ANNÉE-LÀ. JP : *ajouter un mode : choisir une
   * saison et tenter de gagner la Coupe cette année-là*. `epoque` est une
   * saison (« 1985-86 ») ou null. Fixée, la roulette ne sort que des clubs
   * de cette année-là tant que le repêchage y reste (voir `repechage` : la
   * relance d'année n'a alors plus de sens et se retire), le renfort express
   * en vient aussi, et la ligue est faite de TOUS ses vrais
   * clubs plutôt que de 31 clubs tirés dans 55 ans — quatorze en 1970-71,
   * vingt et un en 1985-86, trente-deux en 2024-25 — PLUS la tienne, qui ne
   * retranche personne (la cédule sait jouer un effectif impair). Les séries prennent
   * seize équipes, ou la plus grande puissance de deux qui tient.
   */
  epoque: null,
  /*
   * LE FANTASY DRAFT TOUTES ÉPOQUES, DANS UNE SAISON À GAGNER. JP : *possible
   * de fantasy draft toutes les saisons en mode saison avec année à gagner*.
   * La ligue (`epoque`) dit CONTRE QUI tu joues ; le repêchage dit D'OÙ
   * viennent tes joueurs. « SAISON » est le jeu d'origine — les clubs de
   * l'année choisie seulement ; « TOUTES » ouvre la roulette aux 55 saisons
   * et te laisse bâtir une équipe de rêve pour aller chercher la Coupe de
   * 1970-71. Sans saison fixée le réglage ne veut rien dire : la roulette
   * sort déjà n'importe quelle année.
   */
  repechage: 'SAISON',  // SAISON | TOUTES (n'a d'effet qu'avec une saison fixée)
  /*
   * LA CASE DE LA MAIN (tirage LOTO). JP : *déplacer joueur en mode loto
   * devrait pas changer le choix de joueur*. La main se dérivait de la
   * PREMIÈRE CASE VIDE à chaque rendu : déplacer un signé d'un trio à
   * l'autre changeait donc la case courante, et les trois joueurs offerts
   * changeaient avec elle — on rangeait son alignement et son choix se
   * dérobait. La case de la main est maintenant épinglée : elle ne bouge
   * qu'en signant, en relançant, ou en visant expressément une autre case.
   */
  mainCase: null,       // index de case, ou null (se recalcule alors)
  /*
   * LE RANG DE LA MAIN, FIGÉ AVEC ELLE (S71). JP : *pas reseed si joueur
   * déplacé dans la sélection des joueurs*. Épingler la CASE ne suffisait
   * pas : déplacer un signé DANS la case de la main la remplissait, la main
   * se recalculait sur la première case vide — un autre trio, donc un autre
   * rang — et les trois joueurs offerts changeaient. Le rang se fige quand la
   * main se compose ; un déplacement qui remplit la case de la main passe
   * l'épingle à la case qu'il libère (même poste), rang compris. Seuls signer,
   * relancer ou viser une autre case recomposent la main.
   */
  mainRang: null,
  /*
   * L'ÉCHELLE DU LOTO, ET LA DETTE DE TOUR. Deux compteurs qui existent pour
   * la même raison : retirer un joueur ne doit rien RENDRE.
   *
   * `echelle` : le rang le plus bas déjà atteint à chaque poste. Le rang de la
   * main se calculait sur les joueurs SIGNÉS, donc vider une case le faisait
   * remonter et trois nouveaux numéros un se retendaient — le même exploit que
   * le déplacement de trio, rouvert par le ✕.
   *
   * `dette` : le nombre de cases vidées dont le tour n'a pas encore été
   * repayé. Signer fait tourner la roulette ; retirer rendait la masse
   * salariale ET gardait le vestiaire neuf, donc « signer le moins cher puis
   * ✕ » était un « Passer » gratuit et illimité. La roulette ne tourne plus
   * tant que la dette n'est pas payée : on peut toujours changer d'idée, ça ne
   * donne simplement plus de tour de plus.
   */
  echelle: {},
  dette: 0,
  journee: 0,          // la journée de saison déjà révélée (pour reprendre après un rafraîchissement)
  lbId: null,          // l'entrée d'historique de la saison en cours, que les séries viendront compléter
  seriesVues: null,    // les séries révélées : { ronde, revele[] }, null tant qu'elles n'ont pas commencé
  renfort: null,        // EXPRESS : l'équipe qui fournit le reste de l'alignement
  view: 'pool',         // volet affiché sur petit écran
  page: 'repechage',    // l'onglet du bas : repechage, alignement, equipes, historique, regles
  done: false,
  loading: false,
  shards: new Map(),
};

/*
 * LE MODE ROGUE (S77, js/rogue.js). S79 : il a son plafond, 82 M$ (le nom du
 * jeu) — mesuré, des plombiers coûtent de 29 à 51 M$ (médiane 39) ; une
 * vingtaine de signatures à 4 M$ le remplissent, des étoiles à 6-11 M$ le
 * crèvent : les cartes de masse salariale font le reste. Le plafond d'une run
 * est fixé à son départ (`G.rogue.plafond`) ; une vieille run n'en a pas.
 */
const PLAFOND_ROGUE = 82_000_000;
const MODE_ROGUE = { ...MODES.CLASSIQUE, nom: 'Rogue', cap: PLAFOND_ROGUE };
const MODE = () => (G.bonus === 'ROGUE' ? MODE_ROGUE : (MODES[G.mode] || MODES.CLASSIQUE));
/**
 * La saison à laquelle la ROULETTE est tenue : celle de la ligue quand elle
 * est fixée et que le repêchage reste dans l'année, sinon null — et null veut
 * dire « n'importe laquelle des 55 ». La ligue, elle, lit toujours `G.epoque`.
 */
const epoqueDuTirage = () => (G.epoque && G.repechage === 'SAISON') ? G.epoque : null;
/*
 * L'HISTOIRE D'UNE FRANCHISE (S73). JP : *ajouter possible de juste piger
 * dans l'histoire d'une équipe, comme l'équivalent dans une même saison pour
 * l'alignement*. Le repêchage « Une franchise » ne sort que les vestiaires de
 * ce club, n'importe quelle saison de son histoire, relocalisations comprises
 * (js/franchises.js). La ligue, elle, ne change pas.
 */
const franchiseDuTirage = () => (G.repechage === 'FRANCHISE' && FRANCHISES[G.franchise]) ? G.franchise : null;
/* Le repêchage d'une sauvegarde ou d'un brouillon : les trois valeurs connues, et la saison par défaut. */
const normRepechage = v => (v === 'TOUTES' || v === 'FRANCHISE' ? v : 'SAISON');
/*
 * L'IDENTITÉ DE DÉPART (S73, js/identites.js) : la roulette tire deux clubs et
 * garde celui dont le joueur offert colle le mieux. `undefined` : pas encore
 * choisie pour cette partie (le choix s'offre au démarrage) ; `null` : pas de
 * préférence.
 */
const identite = () => (IDENTITES[G.identite] ? G.identite : null);
/* Le seuil d'une carte qui « colle » à l'identité : le même que scripts/check_identite.mjs. */
const SEUIL_IDENTITE = 0.62;
/* En loto : le joueur que ce club tend pour la case de la main. */
function scoreDeLaMain(v) {
  const c = caseDeLaMain();
  if (!c || !v) return -1;
  const p = joueurEquivalent(v.pool, c, new Set(picked().map(getPersonKey)), G.mainRang ?? rangDeLaMain(c));
  return p ? scoreIdentite(identite(), p) : -1;
}
/* Au vestiaire : la moyenne des cinq joueurs signables qui collent le mieux. */
function scoreDuVestiaire(pool) {
  const xs = pool.filter(p => !isPicked(p) && openSlots(p).length).map(p => scoreIdentite(identite(), p)).sort((a, b) => b - a).slice(0, 5);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : -1;
}
/* Une saison de la franchise, autre que `sauf` quand il y en a une autre. */
function saisonDeFranchise(fr, sauf = null) {
  const ss = saisonsDeFranchise(fr, state.index.seasons).map(([x]) => x);
  const autres = ss.filter(x => x !== sauf);
  return rnd(autres.length ? autres : ss);
}
/** Les cases que TU combles : les 23 d'habitude, six en express. */
const casesActives = () => casesDuMode(G.mode);

/** Les cinq réglages qui définissent LA PARTIE : ils n'existent que sur #partieModal. */
const REGLAGES_PARTIE = new Set(['format', 'tirage', 'ligue', 'repechage', 'bonus']);
/** Un démarrage à la fois : deux clics ne doivent pas mettre deux roulettes en vol. */
let demarrageEnCours = false;
/** Le premier vestiaire sorti — celui qui colore l'interface en tirage VESTIAIRE. */
const vestiaire = () => G.tirage[0] || null;
/** Un renfort est fourni par le mode express : il occupe une case, ne coûte rien. */
const estRenfort = p => !!(p && p._renfort);

const picked = () => Object.values(G.roster);
/** Les joueurs que tu as signés toi-même — les seuls qui touchent au plafond. */
const signes = () => picked().filter(p => !estRenfort(p));
/**
 * Ce joueur-SAISON est-il déjà signé ? Comparer les objets ne suffit pas :
 * un joueur échangé est dans le vestiaire de chacune de ses équipes, avec un
 * objet par équipe, et on pouvait donc le signer deux fois.
 */
const isPicked = p => {
  const k = getPersonKey(p);
  return picked().some(x => getPersonKey(x) === k);
};
/*
 * LA MASSE SALARIALE MANIPULÉE (S79, js/banque.js `CONTRATS`). Avant la
 * saison, le plafond du mode et la somme des salaires, comme toujours. En
 * saison, le plafond EFFECTIF de la journée (l'espace gagné, la taxe, le DG
 * du plafond flexible) et le « cap hit » de chacun : sa retenue, son rachat,
 * son contrat d'entrée, ses bonis — zéro s'il est blessé à long terme ET à
 * l'infirmerie ce jour-là. Tout se déduit des décisions. `G.roster` est
 * l'alignement même du moteur : il suit les signatures de la saison.
 */
function plafondEffectif(j = G.journee || 0) {
  const r = G.bonus === 'ROGUE' ? ((G.rogue && G.rogue.plafond) || null) : null;
  const base = G.bonus === 'ROGUE' ? (r ? r.cap : 1e12) : MODE().cap;
  const depart = r ? r.lignes || [] : [];
  if (!G.ligue) return { cap: base, base, lignes: depart, facteurs: new Map(), ltir: new Set(), blesses: new Set() };
  const pl = plafondDe(decisionsDeLaPartie(), j + 1, { base });
  const blesses = new Set(pl.ltir.size ? blessesAuJour(j).map(x => getPlayerKey(x.p)) : []);
  return { ...pl, base, lignes: [...depart, ...pl.lignes], blesses };
}
/* Ce qu'un joueur de ton alignement compte au plafond aujourd'hui. */
const capHitDuJour = q => (G.ligue ? capHit(q, plafondEffectif()) : (q.$ || 0));
/* Ce que ce joueur compte au plafond (`pl` : `plafondEffectif`). */
function capHit(p, pl) {
  if (!p) return 0;
  const k = getPlayerKey(p);
  if (pl && pl.ltir.has(k) && pl.blesses.has(k)) return 0;
  return Math.round((p.$ || 0) * ((pl && pl.facteurs.get(k)) || 1));
}
const capUsed = (pl = G.ligue ? plafondEffectif() : null) => signes().reduce((s, p) => s + (pl ? capHit(p, pl) : p.$), 0);
const capLeft = () => { const pl = plafondEffectif(); return pl.cap - capUsed(G.ligue ? pl : null); };
const slotsLeft = () => casesActives().filter(s => !G.roster[s.i]).length;
const totalCases = () => casesActives().length;

/**
 * Où ce joueur va-t-il naturellement ? On classe les cases libres par ordre
 * de bon sens : d'abord sa vraie position, puis sa zone d'efficacité, puis
 * l'unité la plus haute de cette zone. Un joueur de calibre quatrième trio
 * se propose donc au quatrième trio, pas au premier parce qu'il était vide.
 */
function slotFitScore(p, s) {
  const pen = getPositionPenalty(p, s);
  if (s.scratch) return 1000 + pen * 40 + s.i;      // les réservistes en dernier
  const ideal = unitesIdeales(p, getHiddenRatings(p).v);
  const dist = Math.min(...ideal.map(u => Math.abs(u - s.unit)));
  return pen * 40 + (dist === 0 ? 0 : 12 + dist * 6) + s.unit;
}

/**
 * Où ce joueur se situe par rapport à sa zone dans cette case : 'sous' (un
 * Top 6 au 4e trio, le talent gaspillé que le moteur punit fort), 'dessus'
 * (un Bottom 6 au 1er trio, puni à peine) ou null. Les gardiens et les
 * réservistes n'ont pas de malus de zone.
 */
function zoneEcart(p, s) {
  if (!p || !s || s.scratch || s.group === 'G' || p.p === 'G') return null;
  const ideal = unitesIdeales(p, getHiddenRatings(p).v);
  if (s.unit > Math.max(...ideal)) return 'sous';
  if (s.unit < Math.min(...ideal)) return 'dessus';
  return null;
}

const ZONE_SOUS_TITLE = 'Sous sa zone : ici, son talent est gaspillé et toute l\'unité porte un malus proportionnel à ce qu\'on perd. Vise une autre case dans l\'alignement ou déplace quelqu\'un.';
const ZONE_DESSUS_TITLE = 'Au-dessus de sa zone : −3 par cran, léger. Il tient la case faute de mieux.';

const nextNeed = () => casesActives().find(s => !G.roster[s.i]) || null;

/**
 * LA CASE COURANTE : celle que tu vises, sinon la première vide dans l'ordre
 * de l'alignement (premier trio, puis le deuxième… les paires, les gardiens,
 * les réservistes). En tirage LOTO c'est elle qui dit quel joueur exact les
 * trois clubs te tendent.
 */
const caseCourante = () => (G.target !== null && !G.roster[G.target] && casesActives().includes(SLOTS[G.target]))
  ? SLOTS[G.target] : nextNeed();

/**
 * LA CASE DE LA MAIN, en LOTO : celle pour laquelle les trois clubs t'ont
 * tendu un joueur. Elle est ÉPINGLÉE — elle ne change qu'en signant (la case
 * se remplit), en relançant, ou en visant expressément une autre case, parce
 * que viser est un geste volontaire. Déplacer ou permuter des joueurs déjà
 * signés ne la touche pas : ranger son alignement ne doit pas dérober le
 * choix qu'on est en train de faire.
 */
function caseDeLaMain() {
  // Viser une case recompose la main des mêmes trois clubs : c'est voulu.
  if (G.target !== null && !G.roster[G.target] && casesActives().includes(SLOTS[G.target])) {
    if (G.mainCase !== G.target) G.mainRang = null;
    G.mainCase = G.target;
  }
  const epinglee = G.mainCase !== null ? SLOTS[G.mainCase] : null;
  if (epinglee && !G.roster[G.mainCase] && casesActives().includes(epinglee)) return epinglee;
  const s = nextNeed();
  if ((s ? s.i : null) !== G.mainCase) G.mainRang = null;
  G.mainCase = s ? s.i : null;
  return s;
}

/**
 * LE RANG AUQUEL LES TROIS CLUBS TE TENDENT UN JOUEUR, EN LOTO.
 *
 * C'était le rang de la CASE (le deuxième ailier gauche pour le deuxième
 * trio), et ça se contournait : on signait le numéro un à la première case,
 * on le DÉPLAÇAIT au quatrième trio, la case du premier trio redevenait
 * libre, et les trois clubs retendaient leurs numéros un. JP : *patcher que
 * je peux repêcher pleins d'étoiles en mode loto en changeant joueur de
 * trio*. Le rang ne peut donc plus remonter : c'est le rang de la case OU le
 * nombre de joueurs que tu as déjà signés à cette position-là, le plus bas
 * des deux — l'échelle descend, peu importe où tu les ranges ensuite. En
 * remplissant les cases dans l'ordre, les deux nombres sont égaux et rien ne
 * change. Les renforts de l'express ne comptent pas : ils ne sont pas de ton
 * repêchage.
 */
function rangDeLaMain(c) {
  if (c.scratch) return 0;
  const deja = signes().filter(p => fits(p, c) && getPositionPenalty(p, c) === 0).length;
  // Le plancher : le rang le plus bas déjà atteint à ce poste. Sans lui, le ✕
  // faisait remonter l'échelle — on signait, on retirait, et trois numéros un
  // se retendaient. « L'échelle descend quoi qu'on fasse de ses joueurs
  // ensuite » vaut aussi pour les retirer.
  return Math.max(c.unit, deja, G.echelle[c.role] || 0);
}

/** Le plancher se pose APRÈS chaque signature : c'est elle qui fait descendre. */
function poserEchelle() {
  for (const c of casesActives()) {
    if (c.scratch) continue;
    const deja = signes().filter(p => fits(p, c) && getPositionPenalty(p, c) === 0).length;
    if (deja > (G.echelle[c.role] || 0)) G.echelle[c.role] = deja;
  }
}

/**
 * LES JOUEURS QU'ON TE PROPOSE À CE TOUR. En VESTIAIRE, tout le club sorti.
 * En LOTO, la main : le joueur que chacun des trois clubs met à la case de
 * la main (épinglée, voir `caseDeLaMain`) — viser une autre case la
 * recompose des mêmes clubs, déplacer un joueur signé n'y touche pas. Les
 * joueurs déjà signés sont exclus de l'alignement, donc un club qui ressort
 * montre son trio recomposé sans eux.
 */
function candidats() {
  if (!G.tirage.length) return [];
  if (!MODE().loto) return vestiaire().pool;
  const c = caseDeLaMain();
  if (!c) return [];
  const exclude = new Set(picked().map(getPersonKey));
  if (G.mainRang == null) G.mainRang = rangDeLaMain(c);
  const rang = G.mainRang;
  const vus = new Set();
  const out = [];
  for (const v of G.tirage) {
    const p = joueurEquivalent(v.pool, c, exclude, rang);
    if (!p || vus.has(getPersonKey(p))) continue;
    vus.add(getPersonKey(p));
    out.push(p);
  }
  return out;
}

/**
 * Cases ouvertes pour un joueur, la plus sensée d'abord. En VESTIAIRE,
 * n'importe quelle case libre qui lui convient ; en LOTO, la main est celle
 * d'une seule case, et il n'y en a pas d'autre.
 */
const openSlots = p => {
  let libres = casesActives().filter(s => !G.roster[s.i] && fits(p, s));
  if (MODE().loto) { const c = caseDeLaMain(); libres = libres.filter(s => s === c); }
  return libres.sort((a, b) => slotFitScore(p, a) - slotFitScore(p, b) || a.i - b.i);
};

/**
 * Somme maximale qu'on peut mettre sur ce joueur-ci sans se rendre incapable
 * de remplir les cases suivantes au salaire plancher. C'est le vrai budget
 * du directeur général, pas seulement le plafond restant.
 */
const maxForPick = () => capLeft() - Math.max(0, slotsLeft() - 1) * MIN_SAL;

/* ---------- sauvegarde ---------- */

/*
 * LA SAUVEGARDE VA JUSQU'AU BOUT DE LA SAISON. Elle s'ARRÊTAIT au repêchage :
 * `if (G.done) { clearSave(); return; }` — dès que la simulation partait, la
 * partie était effacée du disque plutôt qu'enrichie. Un rafraîchissement à la
 * journée 40 rendait un alignement complet et un bouton « Simuler », comme si
 * les quarante journées n'avaient jamais eu lieu.
 *
 * Ce qu'on écrit tient en quatre nombres, parce que LE MOTEUR EST
 * DÉTERMINISTE (`check_graine.mjs` le vérifie à chaque PR) : la graine, les
 * adversaires par leur clé `saison_équipe`, la journée révélée, et le format
 * de la partie. Reprendre coûte un `simulateLeague` de la même graine, pas
 * 1312 feuilles de match à sérialiser.
 *
 * Les adversaires sont des CLÉS, pas des alignements : 31 clubs × 23 joueurs
 * dans localStorage, ce sont des mégaoctets, et `rebatirAdversaires` rejoue
 * exactement la boucle de `buildOpponents` — même ordre, même `exclude` qui
 * s'accumule, donc les mêmes alignements.
 */
/*
 * LA VERSION DU MOTEUR DANS LA SAUVEGARDE (S74). Une saison se REJOUE de sa
 * graine et de ses décisions : quand le moteur change (S74 : la main de
 * l'adversaire aux gros matchs, l'affiche tirée avant les dés neufs), une
 * partie en cours se rejoue autrement, journées déjà vues comprises. On ne
 * peut pas l'empêcher sans garder deux moteurs ; on peut le DIRE.
 */
const VERSION_MOTEUR = 'S80';  // S80 : le pesé des situations pèse plus, et un soir de gros match n'a ni situation, ni accident, ni dilemme (ils attendent le lendemain)
function saveGame() {
  try {
    // S77 : la partie ACTIVE de l'index (js/sauvegardes.js), avec son résumé pour le menu.
    ecrirePartieActive(({
      moteur: VERSION_MOTEUR,
      roster: G.roster,
      partie: G.done && G.ligue ? {
        graine: G.ligue.graine,
        adversaires: G.ligue.cles || [],
        journee: G.journee || 0,
        decisions: G.ligue.decisions || [],
        // LES SÉRIES SE REPRENNENT COMME LA SAISON : elles se rejouent depuis
        // la même graine — le générateur reste en place après
        // `simulateLeague` — donc on ne sauve que jusqu'où on les a
        // regardées. `lbId` suit, sinon la reprise coudrait la Coupe sur une
        // entrée d'historique neuve au lieu de celle qu'on joue.
        series: G.seriesVues || null,
        decisionsSeries: G.ligue.decisionsSeries || [],
        lbId: G.lbId || null,
      } : null,
      /*
       * LE TOURNOI SUR TABLE. Mêmes clés de clubs que la ligue, mais la
       * moitié seulement se rejoue : les matchs joués À VIDE repartent de
       * leur graine, TES matchs sont relus depuis leur feuille compacte —
       * aucune graine ne redonne tes décisions (voir `etatDuTournoi`).
       */
      tournoi: G.bonus === 'TABLE' && G.done && G.tournoi ? {
        ...etatDuTournoi(G.tournoi),
        clubs: (G.tournoi.clubs || []).slice(1).map(c => `${c.season}|${c.tag}`),
      } : null,
      relances: G.relances,
      left: G.left,
      tirage: G.tirage.map(v => ({ season: v.season, team: v.team })),
      target: G.target,
      mainCase: G.mainCase,
      mainRang: G.mainRang,
      echelle: G.echelle,
      lignes: G.lignes || null,
      dette: G.dette,
      mode: G.mode,
      epoque: G.epoque,
      repechage: G.repechage,
      franchise: G.franchise,
      identite: G.identite ?? null,
      bonus: G.bonus,
      renfort: G.renfort,
      rogue: G.rogue || null,
      variantes: G.variantes,
    }), resumePartie());
  } catch { /* stockage indisponible */ }
}

/*
 * « EFFACER » EST DEVENU « COMMENCER UNE AUTRE » (S77). Une partie neuve ne
 * jette plus la précédente : elle prend une nouvelle place dans l'index, du
 * genre de son mode, et l'ancienne reste au menu.
 */
const genreCourant = () => (G.bonus === 'TABLE' ? 'table' : G.bonus === 'ROGUE' ? 'rogue' : 'saison');
function clearSave() { nouvellePartie(genreCourant()); }

/*
 * LE RÉSUMÉ D'UNE PARTIE, tel que le menu le lit : où on en est, en une
 * ligne (« Journée 34 · 20-12-2 », « Repêchage · 12/23 signés »). `vierge`
 * dit qu'il n'y a encore rien à perdre : la partie neuve suivante la
 * réutilise au lieu d'en ajouter une vide.
 */
function resumePartie() {
  const signes = Object.values(G.roster || {}).filter(Boolean).length;
  const total = casesDuMode(G.mode).length;
  const L = G.ligue;
  let etape = `Repêchage · ${signes}/${total} signés`;
  if (G.bonus === 'TABLE' && G.done && G.tournoi) etape = 'Le tournoi sur table';
  else if (L && G.done && Array.isArray(L.calendrier)) {
    const toi = (L.teams || []).find(t => t.isPlayer);
    const j = Math.min(G.journee || 0, L.calendrier.length);
    let W = 0, D = 0, P = 0;
    for (const jour of L.calendrier.slice(0, j)) for (const m of jour) {
      if (m.A !== toi && m.B !== toi) continue;
      const pour = m.A === toi ? m.gfA : m.gfB, contre = m.A === toi ? m.gfB : m.gfA;
      if (pour > contre) W++; else if (m.ot) P++; else D++;
    }
    etape = G.seriesVues ? `Les séries · saison ${W}-${D}-${P}` : j >= L.calendrier.length ? `Bilan · ${W}-${D}-${P}` : `Journée ${j} / ${L.calendrier.length} · ${W}-${D}-${P}`;
  }
  const qui = [MODES[G.mode] ? MODES[G.mode].nom : '', G.repechage === 'FRANCHISE' && FRANCHISES[G.franchise] ? FRANCHISES[G.franchise].nom : '', G.epoque || ''].filter(Boolean).join(' · ');
  return { etape, qui, vierge: !signes && !L };
}

const PALETTES = ['graphite', 'oled', 'glace'];
/** Pose la palette sur <html> : c'est le seul endroit qui la connaît. */
function appliquerPalette() {
  document.documentElement.dataset.palette = G.palette;
}

function saveOpts() {
  try {
    localStorage.setItem('cap82_opts', JSON.stringify({
      statsProrata: G.statsProrata, salaryMode: G.salaryMode, mode: G.mode, epoque: G.epoque,
      repechage: G.repechage, franchise: G.franchise, palette: G.palette, bonus: G.bonus, sons: G.sons, niveauTable: G.niveauTable,
      onlyFit: G.onlyFit, sortBy: G.sortBy, poolView: G.poolView,
    }));
  } catch { /* ignore */ }
}

function loadOpts() {
  try {
    const o = JSON.parse(localStorage.getItem('cap82_opts') || '{}');
    if (typeof o.statsProrata === 'boolean') G.statsProrata = o.statsProrata;
    if (o.salaryMode === 'ERA' || o.salaryMode === '2026') G.salaryMode = o.salaryMode;
    if (typeof o.onlyFit === 'boolean') G.onlyFit = o.onlyFit;
    if (typeof o.sortBy === 'string') G.sortBy = o.sortBy;
    if (o.poolView === 'POS' || o.poolView === 'LIST') G.poolView = o.poolView;
    if (PALETTES.includes(o.palette)) G.palette = o.palette;
    if (typeof o.sons === 'boolean') G.sons = o.sons;
    if (o.niveauTable === 'RECRUE' || o.niveauTable === 'PRO') G.niveauTable = o.niveauTable;
    // Un mode disparu (l'ancien « Par unité ») retombe sur le classique.
    if (o.mode && MODES[o.mode]) G.mode = o.mode;
    // Les saisons ne sont pas encore chargées ici : `boot` vérifie après.
    if (o.bonus === 'TABLE' || o.bonus === 'SAISON') G.bonus = o.bonus;
    if (typeof o.epoque === 'string') G.epoque = o.epoque;
    if (o.repechage === 'SAISON' || o.repechage === 'TOUTES' || o.repechage === 'FRANCHISE') G.repechage = o.repechage;
    if (FRANCHISES[o.franchise]) G.franchise = o.franchise;
  } catch { /* ignore */ }
}

async function restoreSave() {
  try {
    const data = lirePartieActive();
    if (!data) return false;
    // Une sauvegarde d'avant les mains (`cur` au lieu de `tirage`) ne se
    // reprend pas : le vestiaire qu'elle décrit n'existe plus sous ces règles.
    // Une run Rogue n'a pas de tirage : elle part d'une équipe de plombiers (S77).
    if (!data || !Array.isArray(data.tirage) || (!data.tirage.length && data.bonus !== 'ROGUE') || !MODES[data.mode]) return false;

    const tirage = [];
    for (const v of data.tirage) {
      const shard = await getShard(v.season);
      if (!shard || !shard.byTeam[v.team]) return false;
      tirage.push({ season: v.season, team: v.team, pool: shard.byTeam[v.team] });
    }

    // Recharger les saisons des joueurs signés pour repeupler le coffre de cotes
    if (data.roster) {
      const seasons = new Set(Object.values(data.roster).filter(Boolean).map(p => p.s));
      for (const label of seasons) {
        if (label && !G.shards.has(label)) {
          try { await getShard(label); } catch { /* saison indisponible */ }
        }
      }
      // Relier chaque joueur sauvegardé à l'objet frais du shard
      for (const [i, saved] of Object.entries(data.roster)) {
        if (!saved) continue;
        const entry = G.shards.get(saved.s);
        const key = getPlayerKey(saved);
        const fresh = entry && entry.players.find(q => getPlayerKey(q) === key);
        // Un renfort reste un renfort : sans la marque, il compterait au
        // plafond au rechargement et la partie deviendrait injouable.
        data.roster[i] = saved._renfort ? { ...(fresh || saved), _renfort: true } : (fresh || saved);
      }
    }

    // Le mode fait partie de la partie, pas des préférences : une partie
    // express reprise en classique n'aurait plus le bon plafond.
    G.mode = data.mode;
    G.epoque = typeof data.epoque === 'string' && state.index.seasons.includes(data.epoque) ? data.epoque : null;
    G.repechage = normRepechage(data.repechage);
    if (FRANCHISES[data.franchise]) G.franchise = data.franchise;
    // Une partie d'avant S73 n'a jamais vu le choix : il s'offrira au prochain démarrage.
    G.identite = 'identite' in data ? (IDENTITES[data.identite] ? data.identite : null) : undefined;
    G.bonus = data.bonus === 'TABLE' || data.bonus === 'ROGUE' ? data.bonus : 'SAISON';
    G.rogue = data.rogue || null;
    // Une partie d'avant S78 n'a pas de graine de variantes : elle en reçoit une au premier rendu.
    G.variantes = data.variantes && typeof data.variantes === 'object'
      ? { graine: data.variantes.graine || null, cartes: { ...(data.variantes.cartes || {}) }, numeros: { ...(data.variantes.numeros || {}) } }
      : { graine: null, cartes: {} };
    G.renfort = data.renfort || null;
    G.tirage = tirage;
    G.roster = data.roster || {};
    G.relances = Number.isFinite(data.relances) ? data.relances : MODE().relances;
    G.left = data.left || { ...REROLLS };
    G.target = data.target ?? null;
    G.mainCase = Number.isInteger(data.mainCase) && SLOTS[data.mainCase] ? data.mainCase : null;
    G.mainRang = Number.isInteger(data.mainRang) ? data.mainRang : null;
    // Les deux compteurs qui empêchent le ✕ d'être une relance : une partie
    // reprise doit les retrouver, sinon recharger la page les remet à zéro et
    // rouvre l'exploit.
    G.echelle = (data.echelle && typeof data.echelle === 'object') ? { ...data.echelle } : {};
    G.dette = Number.isFinite(data.dette) && data.dette > 0 ? data.dette : 0;
    G.lignes = Array.isArray(data.lignes) ? data.lignes : null;
    applyTeamColors(MODE().loto || !tirage.length ? null : tirage[0].team);
    // LA SAISON EN COURS. Elle se REJOUE, elle ne se relit pas : la graine et
    // les clés des adversaires suffisent, `runSeason` refait exactement la
    // même ligue et l'écran reprend à la journée révélée. `reprise` est rendu
    // au démarrage, qui l'exécute après le premier rendu — sans quoi on
    // simulerait 1312 matchs devant un écran de chargement vide.
    if (data.tournoi && data.tournoi.graine) {
      const etat = data.tournoi;
      return { reprise: async () => { await reprendreTournoi(etat); } };
    }
    if (data.partie && data.partie.graine) {
      const { graine, adversaires = [], journee = 0, decisions = [], series = null, lbId = null, decisionsSeries = [] } = data.partie;
      if (data.moteur !== VERSION_MOTEUR) setTimeout(() => toast('Le jeu a changé depuis ta dernière visite : ta saison en cours se rejoue avec les nouvelles règles, et des matchs déjà vus peuvent finir autrement.'), 1500);
      G.lbId = lbId;
      G.dsReprise = decisionsSeries;
      G.seriesVues = series;
      return { reprise: async () => {
        // Les joueurs du ballottage d'abord : l'exclusion des adversaires et
        // la décision 0 les nomment.
        await connaitreBallottages(decisions);
        const clubs = await rebatirAdversaires(adversaires, decisions);
        if (!clubs.length) return;
        // Les séries reprises rejouent d'abord la saison ENTIÈRE : c'est elle
        // qui pose le générateur à l'endroit exact où `playSeries` l'a pris,
        // et le bilan est l'hôte du tableau des séries.
        // `Infinity` et non 82 : une ligue impaire compte 85 journées, et un
        // nombre écrit à la main rouvrirait l'écran de saison sur ses trois
        // dernières au lieu d'aller au bilan.
        await sousVoile(series ? 'On retrouve tes séries…' : 'On retrouve ta saison…', async () => {
          await runSeason({ adversaires: clubs, graine, depuis: series ? Infinity : journee, decisions, reprise: true });
          if (series) reprendreSeries(series);
        });
      } };
    }
    return true;
  } catch {
    return false;
  }
}

/* =====================================================================
   Outils d'affichage
   ===================================================================== */

/**
 * L'INTERFACE PREND LES COULEURS D'UNE ÉQUIPE.
 *
 * JP : *je voudrais plus noir, et tout le reste, couleurs des équipes, donc
 * noir et orange et blanc pendant la saison, couleurs des équipes pendant le
 * draft* ; *je veux de la couleur, mais en accents et dans les cartes* ; *les
 * vraies couleurs des équipes, pas délavées*.
 *
 * Le décor est noir. Tout ce qui portait du laiton — l'onglet ouvert, le
 * titre d'une section, la colonne vedette, les points d'un carton, le chiffre
 * qui compte — prend la COULEUR VIVE du club courant : celle du vestiaire
 * sorti pendant le repêchage, celle des NHL Stars (noir, blanc, orange) dès
 * que la saison commence. Une seule variable fait tout ça, `--gold`, parce
 * qu'elle était déjà l'accent de toute la feuille de style ; l'encre qui va
 * dessus se mesure (`encreSur`), sinon un accent clair porterait du blanc.
 *
 * Sans équipe (tirage LOTO : trois clubs, aucun ne domine), c'est ta propre
 * équipe qui donne le ton — tu es le directeur général, c'est ton bureau.
 */
function applyTeamColors(team) {
  const code = team && TEAM_COLORS[team] ? team : 'YOU';
  const c = TEAM_COLORS[code];
  const vive = couleurVive(code);
  const root = document.documentElement.style;
  root.setProperty('--team-primary', c.primary);
  root.setProperty('--team-accent', c.accent);
  // Le fond d'un bloc aux couleurs du club : sa vraie couleur, assombrie.
  const fond = fondEquipe(code);
  root.setProperty('--team-fond', fond || 'var(--panel-0)');
  // L'accent À L'INTÉRIEUR d'une carte ou d'une case, mesuré sur le fond du
  // club : le rouge de Washington ne se lit pas sur le rouge de Washington.
  root.setProperty('--team-or', viveSurFond(code, fond));
  // La VRAIE couleur du club, jamais éclaircie : c'est elle qui cerne une
  // carte et qui borde une case (voir `couleurVive`, js/logos.js).
  root.setProperty('--team-line', vive);
  // Le bandeau garde la couleur BRUTE : un aplat n'a pas besoin d'être clair
  // pour se voir, il a besoin d'une encre qui contraste (getTeamBand).
  const band = getTeamBand(code);
  root.setProperty('--team-band', band.bg);
  root.setProperty('--team-ink', band.ink);
  root.setProperty('--team-stripe', band.stripe);
  root.setProperty('--team-stripe-ink', band.stripeInk);
  root.setProperty('--team-bouton', band.bouton);
  root.setProperty('--team-bouton-ink', band.boutonInk);
  // LA PLAQUE : la SECONDE couleur du club, en aplat. Un bandeau de diffusion
  // est bicolore, et c'est le deuxième bloc qui fait qu'on reconnaît un club.
  root.setProperty('--team-plaque', band.plaque);
  root.setProperty('--team-plaque-ink', band.plaqueInk);
  // L'accent de toute l'interface suit le club.
  root.setProperty('--gold', vive);
  root.setProperty('--gold-soft', `color-mix(in srgb, ${vive} 15%, transparent)`);
  root.setProperty('--sur-or', encreSur(vive));
}

const isD = p => p && (p.p === 'D' || p.p === 'LD' || p.p === 'RD');

function positionLabel(p) {
  if (!p) return '';
  if (p.p === 'G') return 'G';
  let primary = 'F';
  if (isD(p)) primary = (p.np === 'RD' || p.np === 'DD' || p.np === 'R') ? 'DD' : 'DG';
  else if (p.np === 'C') primary = 'C';
  else if (p.np === 'R' || p.np === 'AD') primary = 'AD';
  else if (p.np === 'L' || p.np === 'AG') primary = 'AG';

  const sec = getSecondaryPosition(p);
  if (!sec) return primary;
  let secLabel = sec;
  if (sec === 'LD') secLabel = 'DG';
  if (sec === 'RD') secLabel = 'DD';
  if (sec === 'L') secLabel = 'AG';
  if (sec === 'R') secLabel = 'AD';
  return `${primary} / ${secLabel}`;
}

/*
 * UN JOUEUR SE NOMME PAR CE QU'IL EST (S79). JP : *jamais identifier les
 * joueurs avec leurs places dans l'alignement, mais leurs vrais traits,
 * stats et positions*. « C / AG · 🎯 Sniper · 45 B · 82 PTS » : ses
 * positions, son rôle (lu dans ses vraies stats), sa vraie saison, ses
 * traits. La case ne se nomme que là où c'est ELLE qu'on choisit.
 */
function quiEst(p, { role = true, stats = true } = {}) {
  if (!p) return '';
  const pp = role ? profilPrincipal(p) : null;
  const st = stats ? displayStats(p) : null;
  const saison = !st ? '' : p.p === 'G' ? `${st.w} V${p.sv != null ? ` · ${p.sv} %ARR` : ''}` : `${st.g} B · ${st.pt} PTS`;
  const traits = getTraits(p).map(t => TRAITS[t.cle] && TRAITS[t.cle].icon).filter(Boolean).join('');
  return [positionLabel(p), pp ? `${pp.ico} ${pp.nom}` : '', saison, traits].filter(Boolean).join(' · ');
}
/* Le poste écrit au long, pour le bandeau de carte. */
const POSTE_LONG = {
  AG: 'Ailier gauche', C: 'Centre', AD: 'Ailier droit',
  DG: 'Défenseur gauche', DD: 'Défenseur droit', G: 'Gardien', F: 'Attaquant',
};
const posteLong = p => POSTE_LONG[positionLabel(p).split(' / ')[0]] || '';

function positionClass(p) {
  if (!p) return 'pos-f';
  if (p.p === 'G') return 'pos-g';
  if (isD(p)) return 'pos-d';
  return 'pos-f';
}

function positionColor(p) {
  if (!p) return 'var(--line)';
  if (p.p === 'G') return '#fcd34d';
  if (isD(p)) return '#c4b5fd';
  return '#7dd3fc';
}

function formatName(full) {
  if (!full) return '';
  const parts = String(full).trim().split(' ');
  if (parts.length === 1) return `<strong class="lname">${esc(full)}</strong>`;
  const last = parts.pop();
  return `<span class="fname">${esc(parts.join(' '))}</span> <strong class="lname">${esc(last)}</strong>`;
}

const seasonMaxGP = season =>
  (season === '1994-95' || season === '2012-13') ? 48
    : season === '2020-21' ? 56
    : season === '2019-20' ? 70
    : 82;

/** Statistiques telles qu'affichées, selon les options (prorata, salaire). */
function displayStats(p) {
  const maxGP = seasonMaxGP(p.s);
  const factor = (G.statsProrata && maxGP < 82) ? (82 / maxGP) : 1;
  const eraF = G.statsProrata ? getEraFactor(p.s) : 1;

  const gp = Math.round((p.gp || 0) * factor);
  const g = Math.round((p.g || 0) * factor * eraF);
  const a = Math.round((p.a || 0) * factor * eraF);
  const pt = Math.round((p.pt || 0) * factor * eraF);
  const pm = Math.round((p.pm || 0) * factor);
  const w = Math.round((p.w ?? 0) * factor);
  const l = Math.round((p.l ?? 0) * factor);
  const so = p.so ?? 0;

  const ppg = p.p === 'G' ? null : (gp > 0 ? pt / gp : 0);
  const eraSal = p.realSal ?? getEraSalary(p.$, p.s);
  const isEra = G.salaryMode === 'ERA';

  return {
    factor, gp, g, a, pt, pm, w, l, so,
    ppg, ppgStr: ppg == null ? '' : ppg.toFixed(2),
    eraSal, isReal: !!p.isReal,
    salaryMain: isEra ? money(eraSal) : money(p.$),
    salarySub: isEra
      ? `${p.s} · 2026 : ${money(p.$)}`
      : `${pctCap(p.$)} du plafond`,
  };
}

/**
 * Les dates de naissance (`bd`) ne sont dans les shards que si le build a pu
 * joindre l'endpoint bios de la LNH. Sans elles, on masque tout ce qui parle
 * d'âge plutôt que d'afficher des tirets partout.
 */
function agesAvailable() {
  return G.tirage.some(v => v.pool.some(p => p.bd)) || picked().some(p => p.bd);
}

function zoneTag(p, mini = false) {
  const v = getHiddenRatings(p).v;
  const z = getLineZone(p, v);
  // LA ZONE QUI A GRANDI (l'atelier, S78) : « ⏫ Monte d'un cran » lui ouvre
  // une unité de plus vers le haut. L'étiquette dit la zone qu'il a
  // MAINTENANT (`unitesIdeales`) — « T2-3 » mentirait sur un joueur qui rend
  // désormais au 1er trio.
  const ideal = p.p === 'G' ? z.idealUnits : unitesIdeales(p, v);
  const grandie = ideal.length !== z.idealUnits.length;
  const where = ideal.map(u => u + 1).join(', ');
  const unit = isD(p) ? 'paires' : p.p === 'G' ? 'rôles' : 'trios';
  let court = mini ? (z.mini || z.short) : z.short;
  if (grandie) {
    const lo = Math.min(...ideal) + 1, hi = Math.max(...ideal) + 1;
    const ord = n => (n === 1 ? (isD(p) ? '1re' : '1er') : `${n}e`);
    court = mini ? `${isD(p) ? 'P' : 'T'}${lo}-${hi}` : `${ord(lo)}-${ord(hi)} ${isD(p) ? 'paire' : 'trio'}`;
  }
  return `<span class="tag tag-zone lz${z.level}" title="${esc(z.label)}${grandie ? ', monté d\'un cran' : ''}. Rend à 100 % sur les ${unit} ${where}.">${esc(court)}</span>`;
}


/*
 * SON RÔLE, EN UN MOT (S71). JP : *la carte des joueurs est rendue trop
 * complexe à lire*. La carte portait cinq sortes de pastilles, la plupart en
 * icône seule (« 🎯 98 », 🧊, 🪨, l'archétype, les traits) : elle dit
 * maintenant ce qu'il est — son meilleur rôle, en mots — et où il rend. Le
 * reste vit dans la fiche, à un toucher.
 */
function roleTag(p) {
  const marques = clesDesMods(p).map(k => MUTATIONS[k] ? `<span class="tag tag-mut" title="${esc(MUTATIONS[k].nom)} — ${esc(MUTATIONS[k].quoi)}">${MUTATIONS[k].ico} ${esc(MUTATIONS[k].nom)}</span>` : '').join('');
  const pp = profilPrincipal(p);
  const r2 = pp && roleSecond(p);
  if (pp) return `<span class="tag tag-role" title="${esc(pp.nom)} — lu dans ${esc(pp.mot)}${r2 ? ` · second rôle : ${esc(r2.nom)}` : ''}">${pp.ico} ${esc(pp.nom)}${r2 ? ` <small>· ${r2.ico}</small>` : ''}</span>${marques}`;
  const a = getArchetype(p, getHiddenRatings(p));
  return `<span class="tag tag-role" title="${esc(a.desc)}">${a.icon} ${esc(a.label)}</span>${marques}`;
}


/**
 * Les traits : rares, donc ils ont leur place sur la carte. Un joueur sur cent
 * en porte un, et c'est la seule chose que la feuille de pointage ne dit pas —
 * afficher une icône ne coûte rien à la lisibilité et signale exactement ce
 * qu'on ne peut pas déduire des colonnes.
 */
function traitTagList(p, full = false) {
  return getTraits(p).map(t => {
    const meta = TRAITS[t.cle];
    const niveau = t.niveau === 0 ? 'Lauréat' : 'Finaliste';
    const txt = full ? ` ${esc(meta.label)}${t.niveau ? ' (finaliste)' : ''}` : '';
    return `<span class="tag tag-trait${t.niveau ? ' est-finaliste' : ''}"`
      + ` title="${esc(meta.short)} ${esc(p.s)} — ${niveau}. ${esc(meta.desc)}.">`
      + `${meta.icon}${txt}</span>`;
  });
}
const traitTags = (p, full = false) => traitTagList(p, full).join('');

function ageTag(p) {
  const age = ageAtSeason(p.bd, p.s);
  return age ? `<span class="tag tag-age" title="Âge au début de la saison ${p.s}">${age} ans</span>` : '';
}

function elcTag(p, full = false) {
  if (!p.elc) return '';
  const txt = full ? " Contrat d'entrée" : '';
  return `<span class="tag tag-elc" title="Contrat d'entrée : premier contrat d'un joueur de 24 ans ou moins. Base plafonnée selon l'époque, plus bonis.">🐣${esc(txt)}</span>`;
}

function realTag(p) {
  return p.isReal
    ? `<span class="tag tag-real" title="Salaire réellement publié cette saison-là, converti au prorata du plafond de l'année.">Salaire réel</span>`
    : `<span class="tag tag-est" title="Salaire estimé par le barème de cote globale : aucun montant publié pour cette saison.">Salaire estimé</span>`;
}

/*
 * Les portraits que le réseau a refusés. `onerror` retire l'image, mais le
 * rendu suivant la recréait et la redemandait : le test de fumée comptait
 * 1330 requêtes en échec sur une partie, du trafic mobile pour rien. Un
 * identifiant tombé ici ne sort plus que l'émoji de secours.
 */
const PORTRAITS_ABSENTS = new Set();
const portraitAbsent = id => { PORTRAITS_ABSENTS.add(Number(id)); };
/*
 * LES PORTRAITS DU JEU (S78, scripts/portraits.mjs). JP : *télécharger toutes
 * les faces sur le device* ; *assurer que les portraits soient toujours bien
 * cadrés, partout*. Chaque visage de la LNH est recadré une fois, à la
 * fabrication — la tête fait la même part du cadre, à la même hauteur, pour
 * une vieille photo de 1972 comme pour une photo détourée de 2024 — et voyage
 * avec le jeu (img/mugs/{id}.webp). `data/portraits.json` dit qui en a un :
 * un joueur absent n'est jamais demandé. Sans la liste (une copie qui n'a pas
 * passé le script), on retombe sur le réseau de la LNH.
 */
let PORTRAITS_LOCAUX = null;
async function chargerPortraits() {
  try {
    const r = await fetch('data/portraits.json');
    if (r.ok) PORTRAITS_LOCAUX = new Set((await r.json()).ids);
  } catch { /* hors ligne sans la liste : le réseau prendra le relais */ }
}

/*
 * TOUT SUR L'APPAREIL, UNE FOIS (S78). L'APK et l'exe emportent déjà
 * img/ ; la version Web demande au travailleur de service de tout garder,
 * en arrière-plan, après le premier rendu. `cap82_visages` retient le lot
 * déjà gardé : un nouveau lot (plus de joueurs) se complète tout seul.
 */
async function prechargerVisages() {
  try {
    if (window.Capacitor || !PORTRAITS_LOCAUX || !navigator.serviceWorker || !location.protocol.startsWith('http')) return;
    const cle = `${PORTRAITS_LOCAUX.size}+${LOGOS_LOCAUX.size}`;
    if (localStorage.getItem('cap82_visages') === cle) return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return;
    navigator.serviceWorker.addEventListener('message', ev => {
      if (!ev.data || ev.data.visagesPrets !== cle) return;
      try { localStorage.setItem('cap82_visages', cle); } catch { /* stockage plein */ }
      if (ev.data.nouveaux) toast(`📥 Les ${PORTRAITS_LOCAUX.size.toLocaleString('fr-CA')} visages et ${LOGOS_LOCAUX.size} écussons sont sur ton appareil : le jeu marche hors ligne.`);
    });
    reg.active.postMessage({ cle, precharger: [...[...LOGOS_LOCAUX].map(c => `img/logos/${c}.svg`), ...[...PORTRAITS_LOCAUX].map(id => `img/mugs/${id}.webp`)] });
  } catch { /* pas de travailleur : les visages viendront à l'usage */ }
}

function headshotHtml(p) {
  const fallback = `<span class="headshot-fallback">👤</span>`;
  if (!p || !p.id) return fallback;
  const id = Number(p.id);
  // La classe `visage` porte le cadrage commun (style.css) : aucun écran ne zoome à sa façon.
  // Sans photo à la LNH : sa silhouette générique, recadrée comme les autres.
  if (PORTRAITS_LOCAUX) return `${fallback}<img class="visage${PORTRAITS_LOCAUX.has(id) ? '' : ' silhouette'}" src="img/mugs/${PORTRAITS_LOCAUX.has(id) ? id : 'silhouette'}.webp" alt="" loading="lazy" onerror="this.remove()">`;
  if (PORTRAITS_ABSENTS.has(id)) return fallback;
  return `${fallback}<img src="https://assets.nhle.com/mugs/nhl/latest/${id}.png" alt="" loading="lazy" onerror="this.remove();cap82.portraitAbsent(${id})">`;
}

/* ---------- toast ---------- */

let toastTimer = null;
function toast(msg, kind = '') {
  const el = $('toast');
  if (!el) return;
  el.className = 'toast on' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

/* =====================================================================
   Démarrage
   ===================================================================== */

async function boot() {
  // La page de départ, posée AVANT tout rendu : la feuille de style lit
  // `body[data-page]` pour décider ce que chaque onglet montre, et sans elle
  // le premier dessin se ferait sans page.
  marquerPage('repechage');
  // Le bilan (js/bilan.js) reçoit ici tout ce qu'il lui faut du contrôleur.
  brancherBilan({
    $, G, TEAMFULL, bar, capUsed, esc, formatName, headshotHtml, ico, lienEquipe, lienJoueur, porteeRevele,
    capMax: () => MODE().cap,
    money, openModal, ouvrirNouvellePartie, picked, rejouerSaison, renderMain,
    saveLeaderboard, majLeaderboard, lireSeriesHistorique, saveGame, montrerPage, statsSim, toast, deciderSerie, bancSerie, finDesSeriesRogue,
    // L'onglet « La ligue » reconstitue la VRAIE fiche des 31 adversaires :
    // il lui faut le shard de leur saison, et le chargeur le met en cache.
    getShard,
  });
  // S77 : l'ancienne sauvegarde unique devient la première partie de l'index.
  migrer();
  // PREMIÈRE VISITE : ni préférences ni partie. Lu AVANT `loadOpts`, qui écrit.
  let vierge = false;
  try { vierge = !localStorage.getItem('cap82_opts') && !lireIndex().parties.length; } catch { /* stockage indisponible */ }
  try {
    loadOpts();
    appliquerPalette();
    activerSons(G.sons);
    await Promise.all([loadIndex(), chargerPortraits()]);
    if (!state.index.seasons.length) throw new Error('aucune saison disponible');
    if (G.epoque && !state.index.seasons.includes(G.epoque)) G.epoque = null;
    setupEvents();
    // Les cartes se penchent sous le doigt (S77) : un seul écouteur délégué, pour tout le jeu.
    brancherInclinaison(document);
    // Les segments démarrent sur la valeur écrite dans le HTML : sans cette
    // ligne, un réglage relu du stockage s'appliquait au rendu mais pas au
    // bouton, qui montrait alors autre chose que ce qu'on regardait.
    syncOptionsUI();
    /*
     * LE MENU AU DÉPART (S77). JP : *un menu au départ pour choisir*. Au
     * premier lancement d'une SESSION (l'appli qu'on ouvre), le menu d'abord :
     * continuer, un mode, une partie. Recharger la page pendant qu'on joue
     * reste un rechargement — on retombe dans la partie, pas au menu.
     */
    let dejaVu = true;
    try { dejaVu = sessionStorage.getItem('cap82_session') === '1'; } catch { /* stockage indisponible */ }
    if (!dejaVu) {
      $('boot').style.display = 'none';
      afficherMenu(contexteDuMenu({ vierge, enJeu: false }));
      return;
    }
    await continuerBoot();
  } catch (e) {
    $('boot').innerHTML = `<div class="err">Impossible de charger les données.<br>
      <span class="mono">${esc(e.message)}</span><br><br>
      Vérifie que <span class="mono">data/index.json</span> existe, ou lance
      <span class="mono">python3 scripts/build_shards.py</span>.</div>`;
  }
}

/*
 * LA SUITE DU DÉMARRAGE, une fois la partie choisie : reprendre la partie
 * active (elle se rejoue de sa graine), ou en bâtir une si elle est neuve.
 * `apres` dit ce qu'on ouvre ensuite — l'écran « Nouvelle partie » d'un mode.
 */
let demarre = false;
async function continuerBoot(apres = null) {
  try { sessionStorage.setItem('cap82_session', '1'); } catch { /* ignore */ }
  let suite = apres;
  try { suite = suite || sessionStorage.getItem('cap82_apres'); sessionStorage.removeItem('cap82_apres'); } catch { /* ignore */ }
  const restored = await restoreSave();
  if (!restored) await demarrerPartie();     // une seule séquence, plus de copie ici
  demarre = true;
  $('boot').style.display = 'none';
  $('game').style.display = '';
  $('actionbar').style.display = '';
  render();
  // Les visages et les écussons sur l'appareil, en arrière-plan (S78).
  setTimeout(prechargerVisages, 4000);
  // Une saison était en cours : on la rejoue sous sa graine et l'écran
  // rouvre à la journée où on l'avait laissée. Après `render()`, pour que la
  // page soit là pendant la simulation.
  if (restored && restored.reprise) await restored.reprise();
  if (suite === 'nouvelle-saison') ouvrirNouvellePartie('SAISON');
  else if (suite === 'nouvelle-table') ouvrirNouvellePartie('TABLE');
  else if (suite === 'nouvelle-rogue' && typeof ouvrirRogue === 'function') ouvrirRogue();
}
/*
 * CE QUE LE MENU PEUT FAIRE. Changer de partie RECHARGE la page : une partie
 * se rejoue de sa graine au démarrage, et c'est la seule façon sûre de ne
 * rien garder de la précédente en mémoire (la ligue, les séries, le tournoi,
 * les cotes déjà connues).
 */
function contexteDuMenu({ vierge = false, enJeu = true, choix = false } = {}) {
  const ailleurs = (apres = null) => {
    if (!demarre) { fermerMenu(); continuerBoot(apres).catch(() => toast('Impossible de reprendre cette partie.', 'bad')); return; }
    try { sessionStorage.setItem('cap82_session', '1'); if (apres) sessionStorage.setItem('cap82_apres', apres); } catch { /* ignore */ }
    location.reload();
  };
  return {
    vierge, enJeu, choix,
    continuer: () => { if (demarre) fermerMenu(); else ailleurs(); },
    reprendre: id => { activer(id); ailleurs(); },
    nouvelle: genre => { nouvellePartie(genre); ailleurs(`nouvelle-${genre}`); },
    options: () => openModal('optionsModal'),
    // L'EXHIBITION (S78, js/exhibition.js) : aucune partie, on revient au menu en la fermant.
    exhibition: () => { fermerMenu(); ouvrirExhibition(ctxExhibition(() => afficherMenu(contexteDuMenu({ vierge, enJeu, choix })))); },
    rogue: {
      resume: () => { const m = lireMeta(); return `🏅 ${m.ecussons || 0} écussons · 🗂️ ${(m.collection || []).length} joueurs · ${m.runs || 0} run${(m.runs || 0) > 1 ? 's' : ''}`; },
      nouvelle: () => { nouvellePartie('rogue'); ailleurs('nouvelle-rogue'); },
      vestiaire: () => ouvrirVestiaire(() => { if (document.getElementById('menuDepart')) afficherMenu(contexteDuMenu({ vierge, enJeu })); }),
      // L'INVENTAIRE PERMANENT ET LE CLASSEUR (S79) : hors saison, on regarde ; on joue du hub.
      inventaire: () => ouvrirInventaireJeu(null, null),
    },
  };
}

/* Ce que l'exhibition lit du jeu : les saisons, le chargeur de shards, l'affichage — et le direct. */
const ctxExhibition = onFerme => ({
  saisons: state.index.seasons, shard: getShard, esc, logo: getTeamLogoHtml, band: getTeamBand, mug: headshotHtml,
  nom: code => TEAMFULL[code] || code,
  direct: { esc, teamLabel, teamShort, tagCourt, logo: getTeamLogoHtml, band: getTeamBand, mug: headshotHtml },
  onFerme,
});

/* =====================================================================
   LE MODE ROGUE (S77) — voir js/rogue.js pour la règle et le méta.
   ===================================================================== */
/*
 * LA BARRE DU HAUT EN ROGUE (S79) : le plafond restant — le plafond EFFECTIF
 * de la run, et ce qui le tord (le titre les nomme) — et les jetons 🪙, la
 * monnaie de la boutique, à côté.
 */
function renderJetons() {
  const g = $('capGauge');
  if (!g) return;
  const pl = plafondEffectif();
  const used = capUsed(G.ligue ? pl : null), rem = pl.cap - used;
  const lbl = g.querySelector('.capgauge-label');
  if (lbl) lbl.textContent = 'Plafond restant';
  const meta = lireMeta();
  const amt = $('capAmt');
  amt.textContent = pl.cap >= 1e11 ? '—' : money(rem);
  amt.classList.toggle('over', rem < 0);
  amt.classList.toggle('tight', rem >= 0 && rem < 3_000_000);
  const tordu = pl.lignes.length + pl.facteurs.size + pl.ltir.size;
  $('capMaxLbl').textContent = pl.cap >= 1e11 ? '' : `/ ${money(pl.cap)}${tordu ? ' ✦' : ''}`;
  const lignes = [...pl.lignes.map(l => `${l.nom} ${l.montant > 0 ? '+' : '−'}${money(Math.abs(l.montant))}`),
    ...[...pl.facteurs].map(([k, f]) => `${(signes().find(p => getPlayerKey(p) === k) || {}).n || 'Un ancien'} : ${Math.round(f * 100)} % de son salaire`),
    ...[...pl.ltir].map(k => `${(signes().find(p => getPlayerKey(p) === k) || {}).n || 'Un ancien'} : blessé à long terme${pl.blesses.has(k) ? ' (hors plafond)' : ''}`)];
  g.title = `Plafond de la run : ${money(pl.cap)}${lignes.length ? ` — ${lignes.join(' · ')}` : ''}. Masse : ${money(used)}. Jetons : ${jetonsRogue()} 🪙 (la boutique du hub vend des packs).`;
  $('capFill').style.width = Math.min(100, Math.max(0, (used / pl.cap) * 100)) + '%';
  $('capFill').classList.toggle('over', rem < 0);
  $('capFill').classList.toggle('tight', rem >= 0 && rem < 3_000_000);
  $('cnt').textContent = `${signes().length} / ${totalCases()}`;
  const perSlot = $('perSlotLbl');
  if (perSlot) { perSlot.textContent = `🪙 ${jetonsRogue()} · ${meta.ecussons || 0} 🏅`; perSlot.className = ''; }
}
/* Ce que la saison a rapporté jusqu'à la journée `j` (révélée), pour les jetons. */
function resultatsRogue(j) {
  const L = G.ligue;
  if (!L || !Array.isArray(L.calendrier)) return {};
  const toi = L.you;
  let W = 0, D = 0, P = 0;
  for (const jour of L.calendrier.slice(0, j)) for (const m of jour) {
    if (m.A !== toi && m.B !== toi) continue;
    const pour = m.A === toi ? m.gfA : m.gfB, contre = m.A === toi ? m.gfB : m.gfA;
    if (pour > contre) W++; else if (m.ot) P++; else D++;
  }
  const gros = ((toi && toi.minisBoss) || []).filter(mb => mb.gagne && mb.jour < j).length;
  // Un objectif du proprio réussi, c'est une carte prise à son verdict (`v:`).
  const objectifs = (L.decisions || []).filter(d => typeof d.palier === 'string' && d.palier.startsWith('v:') && d.carte).length;
  return { W, L: D, OTL: P, gros, objectifs };
}
/*
 * LES JETONS DE LA PARTIE (S79), dans les DEUX modes : les résultats
 * (`JETONS`), plus les ventes (les doublons revendus à l'ouverture, les cartes
 * vendues de l'inventaire), les coffres et les billets gagnants, plus ce que
 * la direction verse par victoire (un patron), moins ce que la boutique a
 * coûté. Tout se DÉDUIT des décisions : rien n'est stocké. Le mode Rogue part
 * de sa caisse (`G.rogue.depart`) ; une saison part de zéro.
 */
function decisionsDeLaPartie() {
  const L = G.ligue;
  return [...((L && L.decisions) || []), ...((L && L.decisionsSeries) || [])];
}
function victoiresEntre(de, a) {
  const L = G.ligue;
  if (!L || !Array.isArray(L.calendrier)) return 0;
  let n = 0;
  for (const jour of L.calendrier.slice(de, a)) for (const m of jour) {
    if (m.A !== L.you && m.B !== L.you) continue;
    if ((m.A === L.you ? m.gfA : m.gfB) > (m.A === L.you ? m.gfB : m.gfA)) n++;
  }
  return n;
}
function jetonsRogue(j = G.journee || 0) {
  const L = G.ligue;
  const decs = decisionsDeLaPartie();
  const depenses = decs.reduce((a, d) => a + ((d.achat || d.rogue || {}).prix || 0) + ((d.plafond || {}).cout || 0), 0);
  const ventes = decs.reduce((a, d) => a + ((d.achat || {}).vente || 0) + (d.gain || 0) + ((d.vend || {}).jetons || 0), 0);
  const direction = modificateurs(decs).jetonsVictoire.reduce((a, x) => a + x.n * victoiresEntre(x.depuis, j), 0);
  const depart = G.bonus === 'ROGUE' ? ((G.rogue && G.rogue.depart) || JETONS.depart) : 0;
  return jetonsDe(L ? resultatsRogue(j) : {}, depenses, depart) + ventes + direction;
}

/*
 * LA BOUTIQUE (S79, js/magasin.js) : des rayons de packs à la HUT, dans les
 * deux modes. En Rogue, quelques packs se débloquent au vestiaire (le méta).
 */
/* L'espace sous le plafond, pour la boutique : ce qu'un pack de joueurs peut tirer. */
function plafondPourBoutique() {
  const pl = plafondEffectif();
  if (pl.cap >= 1e11) return null;
  const rem = capLeft();
  return { cap: pl.cap, espace: rem, salaireMax: salaireMaxDePack(), tordu: pl.lignes.length + pl.facteurs.size + pl.ltir.size };
}
/* Le plus gros salaire qu'un pack peut tirer : l'espace, plus le plus gros « cap hit » qu'une sortie libérerait. */
function salaireMaxDePack() {
  const pl = G.ligue ? plafondEffectif() : null;
  return capLeft() + Math.max(0, ...signes().map(q => (pl ? capHit(q, pl) : q.$ || 0)));
}
const VERROUS_ROGUE = { 'j:defensif': 'packDefenseurs', 'j:gardien': 'packGardiens', 'j:ere80': 'packAnnees80', 'j:etoiles': 'packVedettes', 'j:legendes': 'packVedettes' };
function packsOuvertsBoutique() {
  const meta = G.bonus === 'ROGUE' ? lireMeta() : null;
  return Object.fromEntries(Object.keys(PACKS_TOUS).map(k => {
    const d = meta && VERROUS_ROGUE[k];
    return [k, !d || aDebloque(meta, d) ? true : `Débloque « ${DEBLOCAGES[d].nom} » au vestiaire des déblocages`];
  }));
}
function ouvrirBoutique(j, decider) {
  const decs = decisionsDeLaPartie();
  const n = decs.filter(d => d.achat || d.rogue).length;
  ouvrirMagasin({
    jetons: jetonsRogue(j), mode: G.bonus === 'ROGUE' ? 'rogue' : 'saison', ouverts: packsOuvertsBoutique(),
    mods: modificateurs(decs, j + 1), sansHolo: G.bonus === 'ROGUE' ? packsSansHolo(decs) : 0, plafond: plafondPourBoutique(),
    duJour: packDuJour(new Date()),
    franchises: Object.entries(FRANCHISES).map(([cle, F]) => ({ cle, nom: F.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    saisons: state.index.seasons.slice().reverse(),
    acheter: (cle, { prix, params }) => {
      const P = PACKS_TOUS[cle];
      const suite = P.sorte === 'cartes' ? ouvrirPackCartes(cle, prix, j, n, decider) : ouvrirPackJoueurs(cle, prix, params, j, n, decider);
      Promise.resolve(suite).catch(() => toast('Impossible d\'ouvrir ce pack : une saison n\'a pas pu se charger.', 'bad'));
    },
  });
}

/*
 * LES JOUEURS D'UN PACK (S79) : purs, de la graine de la ligue, du pack et du
 * numéro de l'achat. La FAMILLE du pack dit où l'on pige :
 *   hasard     la moitié productive de n'importe quelle saison ;
 *   equipe     une franchise, toutes époques (choisie à l'achat, ou au hasard) ;
 *   annee      une saison (choisie, ou au hasard) ; ere  une décennie ;
 *   skill      un talent lu dans les VRAIES fiches (js/packs.js `SKILLS`) ;
 *   trio       une vraie ligne d'un même club-saison ;
 *   etoiles    les étoiles de leur saison (`estEtoile`) ; legendes : d'avant 1995.
 * Puis, par-dessus chaque joueur, sa VARIANTE tirée au barème du tier (et le
 * numéro d'une or). Jamais un joueur qui joue déjà dans la ligue, ni un
 * salaire qu'aucune sortie ne ferait entrer sous le plafond (les deux modes).
 */
async function tirerPackJoueurs(cle, n, params = {}, mods = {}, garantie = false) {
  const P = PACKS_TOUS[cle], Lg = G.ligue, graine = Lg.graine;
  const dansLaLigue = new Set();
  for (const t of Lg.teams || []) for (const p of Object.values(t.roster || {})) if (p) dansLaLigue.add(getPersonKey(p));
  const an = s => Number(String(s).slice(0, 4));
  let saisons = state.index.seasons.slice();
  const reglage = { ...params };
  if (P.famille === 'ere') saisons = saisons.filter(s => an(s) >= P.decennie && an(s) < P.decennie + 10);
  if (P.famille === 'legendes') saisons = saisons.filter(s => an(s) < 1995);
  if (P.famille === 'annee') {
    if (!reglage.saison || !saisons.includes(reglage.saison)) reglage.saison = saisons[Math.floor(hache(graine, 'pack-annee', n) * saisons.length)];
    saisons = [reglage.saison];
  }
  if (P.famille === 'equipe') {
    if (!reglage.franchise || !FRANCHISES[reglage.franchise]) { const fs = Object.keys(FRANCHISES); reglage.franchise = fs[Math.floor(hache(graine, 'pack-equipe', n) * fs.length)]; }
    saisons = saisonsDeFranchise(reglage.franchise, saisons);
  }
  const cotes = cotesDuPack(cle, mods);
  const nb = P.n + (P.famille === 'trio' ? 0 : (mods.carteExtra || 0));
  // Jamais un salaire qu'aucune sortie ne ferait entrer sous le plafond (effectif : les cartes 💵 comptent).
  const salaireMax = salaireMaxDePack();
  const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));
  const libre = (p, out) => p && p.$ > 0 && p.$ <= salaireMax && !dansLaLigue.has(getPersonKey(p)) && !isPicked(p) && !out.some(x => getPersonKey(x.p) === getPersonKey(p));
  const productifs = (joueurs, part = 2) => ['F', 'D', 'G'].flatMap(g => {
    const r = joueurs.filter(p => groupeDe(p) === g && (p.gp || 0) >= (g === 'G' ? 15 : 30)).sort((a, b) => prod(b) - prod(a));
    return r.slice(0, Math.ceil(r.length / part));
  });
  const out = [];
  if (P.famille === 'trio') {
    // UNE VRAIE LIGNE : un club-saison tiré ; son meilleur centre et ses meilleurs ailiers — ou, une fois sur trois, sa première paire et son gardien.
    for (let t = 0; t < 12 && !out.length; t++) {
      const sa = saisons[Math.floor(hache(graine, 'pack-trio-saison', n, t) * saisons.length)];
      const e = await getShard(sa);
      const clubs = Object.keys(e.byTeam);
      const tag = clubs[Math.floor(hache(graine, 'pack-trio-club', n, t) * clubs.length)];
      const eff = (e.byTeam[tag] || []).filter(p => (p.gp || 0) >= 30 && libre(p, out)).sort((a, b) => prod(b) - prod(a));
      const paire = hache(graine, 'pack-trio-genre', n, t) < 1 / 3;
      const aile = c => eff.find(p => !isD(p) && p.p !== 'G' && (p.np === c || (p.p === c)));
      const ligne = paire
        ? [eff.filter(p => isD(p))[0], eff.filter(p => isD(p))[1], (e.byTeam[tag] || []).filter(p => p.p === 'G' && (p.gp || 0) >= 20 && libre(p, out)).sort((a, b) => (b.gp || 0) - (a.gp || 0))[0]]
        : [eff.find(p => !isD(p) && p.p !== 'G' && (p.np === 'C' || p.p === 'C')), aile('L') || aile('LW'), aile('R') || aile('RW')];
      if (!ligne.every(Boolean) || new Set(ligne.map(getPersonKey)).size !== 3) continue;
      ligne.forEach((p, i) => out.push({ p, ...tirerVariante(cotes, graine, cle, n, i) }));
      reglage.club = `${tag} ${sa}`;
    }
  } else {
    for (let t = 0; out.length < nb && t < nb * 5; t++) {
      const sa = saisons[Math.floor(hache(graine, 'pack-saison', cle, n, t) * saisons.length)];
      if (!sa) break;
      const e = await getShard(sa);
      let pool;
      if (P.famille === 'equipe') pool = (e.byTeam[codeDeFranchise(reglage.franchise, sa)] || []).filter(p => (p.gp || 0) >= 20);
      else if (P.famille === 'skill') {
        const S = SKILLS[P.skill];
        const c = e.players.filter(p => (p.gp || 0) >= S.min && (!S.groupe || groupeDe(p) === S.groupe) && (!S.skaters || p.p !== 'G')
          && (!S.filtre || S.filtre(p, ageAtSeason(p.bd, p.s)))).sort((a, b) => S.score(b) - S.score(a));
        pool = S.filtre ? c : c.slice(0, Math.ceil(c.length / 4));
      } else if (P.famille === 'etoiles' || P.famille === 'legendes') pool = e.players.filter(p => estEtoile(p));
      else pool = productifs(e.players, P.famille === 'annee' ? 1 : 2);
      pool = pool.filter(p => libre(p, out));
      if (!pool.length) continue;
      pool.sort((a, b) => hache(graine, 'pack-joueur', cle, n, t, getPlayerKey(a)) - hache(graine, 'pack-joueur', cle, n, t, getPlayerKey(b)));
      out.push({ p: pool[0], ...tirerVariante(cotes, graine, cle, n, t) });
    }
  }
  // LA GARANTIE : le pack garanti, ou la pitié de la run (js/packs.js `PITIE`) — la dernière carte monte à holo.
  if ((P.garanti || garantie) && out.length && !out.some(x => x.rar === 'rare' || x.rar === 'legendaire')) out[out.length - 1].rar = 'rare';
  return { cartes: out, reglage };
}
/* La valeur de vente d'un joueur doublon : sa variante, et son numéro s'il en a un. */
const NUM_VENTE = { '/99': 1, '/25': 2, '/10': 4, '1 de 1': 10 };
const venteJoueur = x => (VENTE[x.rar] || 2) * (NUM_VENTE[x.num] || 1);
/* La carte mini d'un joueur tiré, AVEC la variante du tirage (la carte ne lit que la sienne). */
function miniAvecVariante(p, rar) {
  const k = getPlayerKey(p), avant = G.variantes.cartes[k];
  G.variantes.cartes[k] = rar;
  try { return carteMiniHtml(p); } finally { if (avant === undefined) delete G.variantes.cartes[k]; else G.variantes.cartes[k] = avant; }
}
/*
 * L'OUVERTURE D'UN PACK DE JOUEURS. Le paquet se déchire (js/gerant.js) ; on
 * en signe UN (« Signer », puis QUI SORT — `choisirQuiSort`), les autres vont
 * au classeur ; un joueur déjà au classeur est un doublon, revendu tout seul.
 * L'achat est une décision, qu'on signe ou non.
 */
async function ouvrirPackJoueurs(cle, prix, params, j, n, decider) {
  const P = PACKS_TOUS[cle];
  const decs = decisionsDeLaPartie();
  const mods = modificateurs(decs, j + 1);
  const pitie = G.bonus === 'ROGUE' && packsSansHolo(decs) >= PITIE - 1;
  const { cartes, reglage } = await tirerPackJoueurs(cle, n, params, mods, pitie);
  const avant = new Set(lireMeta().collection || []);
  const vendus = [];
  let vente = 0;
  cartes.forEach((x, t) => { x.doublon = avant.has(getPlayerKey(x.p)); if (x.doublon) { vendus.push(t); vente += venteJoueur(x); } });
  ajouterCollection({ joueurs: cartes.map(x => getPlayerKey(x.p)) });
  ajouterAuCartable(cartes.map(x => ({ cle: getPlayerKey(x.p), rar: x.rar, num: x.num || null })));
  const meilleure = ['legendaire', 'rare', 'peu', 'commune'].find(r => cartes.some(x => x.rar === r)) || 'commune';
  const achat = { pack: cle, n, prix, sorte: 'joueurs', params: reglage, meilleure, vente, ...(vendus.length ? { vendus } : {}), ...(pitie ? { pitie: true } : {}) };
  const palier = `k:${n}`;
  for (const x of cartes) ballottageVu.set(getPlayerKey(x.p), x.p);
  const titre = `${P.nom}${reglage.franchise ? ` · ${FRANCHISES[reglage.franchise].nom}` : reglage.saison ? ` · ${reglage.saison}` : reglage.club ? ` · ${reglage.club}` : ''}`;
  const offrir = () => ouvrirChoix({
    ico: P.ico, titre, cartes: true, genre: 'recompense', fermable: true, motFermer: 'Ne signer personne',
    recit: `${cartes.length} vrais joueurs${pitie ? ' — la garantie a joué : une holo, au moins' : ''}. Tu en signes un, et tu choisis qui lui laisse sa place ; les autres vont à ton classeur.${vente ? ` Les doublons se revendent : +${vente} 🪙.` : ''}`,
    options: cartes.map(x => {
      const g = groupeDe(x.p);
      const bonus = traitsDeCarte(carteDe(x.rar, g === 'G', graineVariantes(), getPlayerKey(x.p)));
      return {
        cle: getPlayerKey(x.p), rarete: x.rar, nom: x.p.n, type: `${POSTE_GROUPE[g]} · ${x.p.t} ${x.p.s}`, coin: money(x.p.$),
        art: artJoueur({ portraitHtml: headshotHtml(x.p), logoHtml: getTeamLogoHtml(x.p.t, 24), pos: esc(POSTE_GROUPE[g]), saison: esc(x.p.s), club: esc(x.p.t) }),
        carteJoueur: miniAvecVariante(x.p, x.rar),
        texte: [ligneDuChoix(x.p), x.num ? `✦ Or numérotée ${x.num}` : '', ...bonus.map(b => `${b.ico} ${b.nom} — ${b.mot}`)].filter(Boolean).join('\n'),
        desactive: x.doublon ? `Doublon : revendu ${venteJoueur(x)} 🪙` : '',
        apercu: () => apercuJoueur(x.p),
      };
    }),
    onChoix: k => {
      const x = cartes.find(y => getPlayerKey(y.p) === k);
      if (!x || x.doublon) return;
      const signer = sortie => {
        if (!sortie) return;
        G.variantes.cartes[k] = x.rar;
        if (x.num) (G.variantes.numeros = G.variantes.numeros || {})[k] = x.num;
        decider({ jour: j, palier, achat, ballottage: { i: sortie.i, entre: k, sort: sortie.sort, rar: x.rar, ...(x.num ? { num: x.num } : {}) } });
      };
      // QUI SORT : la sortie doit faire entrer son salaire sous le plafond (effectif), ou au moins ne pas l'empirer.
      choisirQuiSort(x.p, { roster: G.roster, genre: 'recompense', bloque: q => bloqueParLePlafond(x.p, q), note: q => `libère ${money(capHitDuJour(q))}`, onChoix: signer, onFerme: offrir });
    },
    onFerme: () => decider({ jour: j, palier, achat }),
  });
  offrir();
}
/*
 * UNE SORTIE QUE LE PLAFOND REFUSE : l'arrivée de `p` à la place de `q`
 * laisserait la masse au-dessus du plafond, et plus haut qu'avant. Rend la
 * raison, ou ''. Un échange qui fait baisser la masse passe toujours.
 */
function bloqueParLePlafond(p, q) {
  const pl = G.ligue ? plafondEffectif() : null;
  const libere = pl ? capHit(q, pl) : (q.$ || 0);
  if ((p.$ || 0) <= libere) return '';
  const reste = capLeft() + libere - (p.$ || 0);
  return reste < 0 ? `Plafond : il manque ${money(-reste)}` : '';
}
/* Une carte de la banque en option d'`ouvrirChoix` (l'ouverture d'un pack de cartes). */
function optionDeBanque(id) {
  const c = BANQUE[id];
  if (c.cat === 'match') return optionDeCarteMatch(c.cle);
  return { cle: id, rarete: c.rarete === 'maudite' ? 'commune' : c.rarete, ico: c.ico, nom: c.nom,
    type: c.rarete === 'maudite' ? `Malédiction · ${CATEGORIES[c.cat].un}` : `${CATEGORIES[c.cat].un} · ${(VIES[c.vie] || VIES.saison).nom}`, texte: c.texte, mots: reglesDe(id) };
}
/*
 * L'OUVERTURE D'UN PACK DE CARTES : tout va dans l'inventaire. En Rogue, le
 * personnel et les consommables permanents partent au MÉTA (gardés d'une run
 * à l'autre) — une fois, par achat (`recevoirPermanents`) ; un patron qu'on
 * possède déjà est un doublon, revendu. Le reste va dans la poche de la saison.
 * UNE MALÉDICTION (la taxe de luxe, que certains packs cachent) ne se range
 * pas : elle frappe à l'ouverture (`achat.maudites`, lu par `plafondDe`).
 */
function ouvrirPackCartes(cle, prix, j, n, decider) {
  const P = PACKS_TOUS[cle], Lg = G.ligue;
  const tirees = tirerCartesPack(P.cle, Lg.graine, n);
  const ids = tirees.filter(id => BANQUE[id].rarete !== 'maudite');
  const maudites = tirees.filter(id => BANQUE[id].rarete === 'maudite');
  const rogue = G.bonus === 'ROGUE';
  const meta = lireMeta();
  const perso = new Set(meta.personnel || []);
  const vendus = [];
  let vente = 0;
  ids.forEach((id, t) => {
    const c = BANQUE[id];
    const dejaVu = c.cat === 'patron' && (perso.has(c.cle) || ids.slice(0, t).includes(id));
    if (rogue && dejaVu) { vendus.push(t); vente += valeurDe(id); }
  });
  if (rogue) recevoirPermanents(ids.filter((id, t) => !vendus.includes(t) && BANQUE[id].vie === 'permanent'), `${Lg.graine}:k:${n}`);
  ajouterCollection({ cartes: ids });
  const achat = { pack: cle, n, prix, sorte: 'cartes', cartes: ids, ...(vendus.length ? { vendus, vente } : {}), ...(maudites.length ? { maudites } : {}) };
  const dec = { jour: j, palier: `k:${n}`, achat };
  ouvrirChoix({
    ico: P.ico, titre: P.nom, cartes: true, genre: 'recompense', fermable: true, motFermer: 'Tout ranger',
    recit: (rogue
      ? `Tout va dans ton inventaire : le personnel et les consommables permanents y restent d'une run à l'autre, le reste vaut pour cette saison.${vente ? ` Doublons revendus : +${vente} 🪙.` : ''}`
      : 'Tout va dans ton inventaire : joue chaque carte quand tu veux, du hub (🎒).')
      + (maudites.length ? ` Pas de chance : ${maudites.map(id => `« ${BANQUE[id].nom} »`).join(', ')} frappe tout de suite.` : ''),
    options: [...ids.map((id, t) => ({ ...optionDeBanque(id), cle: String(t), prix: vendus.includes(t) ? `Doublon : revendu ${valeurDe(id)} 🪙` : '' })),
      ...maudites.map((id, t) => ({ ...optionDeBanque(id), cle: `m${t}`, prix: 'Malédiction : elle frappe tout de suite' }))],
    onChoix: () => decider(dec),
    onFerme: () => decider(dec),
  });
}

/*
 * QUI EST À L'INFIRMERIE À LA JOURNÉE `j` : lu dans le journal des blessures
 * (le match où il s'est blessé, combien il en rate) et le nombre de tes
 * matchs joués avant ce jour — jamais dans l'infirmerie de fin de saison.
 */
function blessesAuJour(j) {
  const Lg = G.ligue, you = Lg && Lg.you;
  if (!you) return [];
  let joues = 0;
  for (const jour of (Lg.calendrier || []).slice(0, j)) for (const m of jour) if (m.A === you || m.B === you) joues++;
  return (you.injuriesLog || []).filter(b => b.at <= joues && joues < b.at - 1 + b.games)
    .map(b => ({ p: b.player, reste: b.at - 1 + b.games - joues }));
}

/*
 * L'INVENTAIRE (S79, js/inventaire.js), du hub ou du menu. `decider` absent
 * (le menu, hors saison) : on regarde, on ne joue pas.
 */
function ouvrirInventaireJeu(j = null, decider = null) {
  const Lg = G.ligue, decs = decisionsDeLaPartie();
  const rogue = G.bonus === 'ROGUE';
  const meta = lireMeta();
  const enSaison = !!(Lg && decider && j !== null);
  const possedees = new Set((meta.cartes || []).map(k => (BANQUE[k] ? k : BANQUE[`match:${k}`] ? `match:${k}` : null)).filter(Boolean));
  ouvrirInventaire({
    titre: 'Ton inventaire', mode: rogue ? 'rogue' : 'saison', enSaison, peutJouer: enSaison, jetons: enSaison ? jetonsRogue(j) : null,
    partie: enSaison ? pocheDeLaPartie({ decisions: decs, graine: Lg.graine, jour: j, rogue }) : [],
    meta: rogue ? Object.entries(meta.inventaire || {}).map(([id, n]) => ({ id, n })).filter(x => BANQUE[x.id] && x.n > 0) : [],
    personnel: rogue ? (meta.personnel || []).filter(k => PATRONS[k]) : [],
    patronsActifs: enSaison ? patronsActifs(decs, j + 1) : [], maxPatrons: MAX_PATRONS,
    deck: enSaison ? deckDe(Lg.decisions || []) : [],
    possedees, joueursCollection: Object.keys(lireCartable().joueurs).length,
    plafond: plafondPourInventaire(enSaison ? j : (G.journee || 0)),
    jouer: item => jouerCarte(item, j, decider),
    vendre: item => decider({ jour: j, vend: { refs: [item.ref], jetons: valeurDe(item.id) } }),
  });
}
/* Le plafond, pour l'inventaire : la masse, le plafond effectif, et ce qui le tord (nommé). */
function plafondPourInventaire(j) {
  const pl = plafondEffectif(j);
  if (pl.cap >= 1e11 || !signes().length) return null;
  const nom = k => (signes().find(p => getPlayerKey(p) === k) || {}).n || 'Un ancien';
  return {
    cap: pl.cap, base: pl.base, masse: capUsed(G.ligue ? pl : null),
    lignes: [...pl.lignes.map(l => ({ nom: l.nom, montant: l.montant })),
      ...[...pl.facteurs].map(([k, f]) => ({ nom: `${nom(k)} : ${Math.round(f * 100)} % de son salaire`, joueur: true })),
      ...[...pl.ltir].map(k => ({ nom: `${nom(k)} : blessé à long terme${pl.blesses.has(k) ? ', hors du plafond' : ', revenu au jeu'}`, joueur: true }))],
  };
}
/* Le nombre de cartes à jouer, pour le bouton du hub. */
function cartesAJouer(j) {
  const Lg = G.ligue;
  if (!Lg) return 0;
  const rogue = G.bonus === 'ROGUE';
  const meta = rogue ? lireMeta() : null;
  return pocheDeLaPartie({ decisions: decisionsDeLaPartie(), graine: Lg.graine, jour: j, rogue }).length
    + (meta ? Object.values(meta.inventaire || {}).reduce((a, n) => a + n, 0) : 0);
}
/*
 * JOUER UNE CARTE DE L'INVENTAIRE : sa cible (un joueur, un blessé, une
 * malédiction du deck, une carte à améliorer, un système), puis UNE décision
 * datée d'aujourd'hui (`joue` dit d'où elle sort, pour la poche). Un
 * consommable permanent quitte le méta à ce moment-là.
 */
function jouerCarte(item, j, decider) {
  const c = BANQUE[item.id];
  if (!c || !decider) return;
  const Lg = G.ligue, decs = decisionsDeLaPartie(), you = Lg.you;
  const joue = { src: item.src, id: item.id, ...(item.ref ? { ref: item.ref } : {}) };
  const retour = () => ouvrirInventaireJeu(j, decider);
  const ecrire = payload => {
    if (!payload) return;
    if (item.src === 'meta') retirerDuMeta(item.id);
    decider({ jour: j, joue, ...payload });
  };
  const listeJoueurs = (titre, recit, liste, choisir, mots = null) => ouvrirChoix({
    ico: c.ico, titre, compact: true, fermable: true, motFermer: 'Retour', recit,
    contexte: mots ? `<div class="choix-puces">${puces(mots)}</div>` : '',
    options: liste.map(({ p, sous }) => ({ cle: getPlayerKey(p), visage: headshotHtml(p), nom: p.n, sous })),
    onChoix: choisir, onFerme: retour,
  });
  if (c.cat === 'patron') {
    const actifs = patronsActifs(decs, j + 1);
    if (!actifs.some(x => x.role === c.role) && actifs.length >= MAX_PATRONS) {
      ouvrirChoix({ ico: '👔', titre: `${c.nom} : qui part ?`, compact: true, fermable: true, motFermer: 'Retour',
        recit: `${MAX_PATRONS} postes au plus. ${c.nom} prend la place de qui ?`,
        options: actifs.map(x => ({ cle: x.cle, ico: x.ico, nom: x.nom, sous: ROLES[x.role] ? ROLES[x.role].nom : '' })),
        onChoix: k => { const p = payloadDe(item.id, { patrons: actifs }); p.patron.remplace = [...(p.patron.remplace || []), k]; ecrire(p); },
        onFerme: retour });
      return;
    }
    ecrire(payloadDe(item.id, { patrons: actifs }));
    return;
  }
  if (c.cat === 'joueur') {
    if (['partout', 'cran', 'physio', 'lustre'].includes(c.cle)) { ouvrirAtelier(c.cle, { jour: j, you, onChoix: mut => ecrire({ mutation: mut }), onFerme: retour }); return; }
    const M = MUTATIONS[c.cle];
    const liste = SLOTS.filter(sl => !sl.scratch && (M.gardien ? sl.group === 'G' : sl.group !== 'G')).map(sl => ({ p: G.roster[sl.i], sous: slotShort(sl) }))
      .filter(x => x.p && (M.gardien ? x.p.p === 'G' : x.p.p !== 'G'));
    listeJoueurs(`${M.nom} : à qui ?`, `${M.quoi} Pour le reste de la saison.`, liste, k => ecrire(payloadDe(item.id, { joueur: k })), motsDeMutation(c.cle));
    return;
  }
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    if (C.cible === 'blesse') {
      const bl = blessesAuJour(j);
      if (!bl.length) { toast('Personne à l\'infirmerie : garde-la pour plus tard.'); retour(); return; }
      listeJoueurs(`${c.nom} : qui soigner ?`, c.texte, bl.map(x => ({ p: x.p, sous: `${x.reste} match${x.reste > 1 ? 's' : ''} d'infirmerie` })), k => ecrire(payloadDe(item.id, { joueur: k })), reglesDe(item.id));
      return;
    }
    if (C.cible === 'joueur') {
      const liste = SLOTS.filter(sl => !sl.scratch && sl.group !== 'G').map(sl => ({ p: G.roster[sl.i], sous: slotShort(sl) })).filter(x => x.p);
      listeJoueurs(`${c.nom} : pour qui ?`, c.texte, liste, k => ecrire(payloadDe(item.id, { joueur: k })), reglesDe(item.id));
      return;
    }
    if (C.cible === 'malediction' || C.cible === 'carteMatch') {
      const deck = deckDe(Lg.decisions || []);
      const uniques = [...new Set(deck)].filter(k => (C.cible === 'malediction' ? CARTES_MATCH[k] && CARTES_MATCH[k].maudite : CARTES_MATCH[`${k}+`]));
      if (!uniques.length) { toast(C.cible === 'malediction' ? 'Aucune malédiction dans ton deck.' : 'Tout ton deck est déjà amélioré.'); retour(); return; }
      ouvrirChoix({ ico: c.ico, titre: c.nom, cartes: true, genre: 'palier', fermable: true, motFermer: 'Retour', recit: c.texte,
        options: uniques.map(k => ({ ...optionDeCarteMatch(C.cible === 'carteMatch' ? `${k}+` : k), cle: k })),
        onChoix: k => ecrire(payloadDe(item.id, { carte: k })), onFerme: retour });
      return;
    }
    if (C.cible === 'tactique') {
      ouvrirChoix({ ico: c.ico, titre: c.nom, compact: true, fermable: true, motFermer: 'Retour', recit: c.texte,
        options: Object.entries(TACTIQUES).filter(([k]) => k !== 'hourra').map(([k, T]) => ({ cle: k, ico: T.ico, nom: T.nom, sous: T.mot })),
        onChoix: k => ecrire(payloadDe(item.id, { tactique: k })), onFerme: retour });
      return;
    }
    ecrire(payloadDe(item.id, { alea: hache(Lg.graine, 'billet', item.ref || item.id, j) }));
    return;
  }
  if (c.cat === 'plafond') {
    // LA MASSE SALARIALE : un joueur (sa retenue, son rachat, ses bonis), une recrue (son contrat d'entrée), un blessé (le LTIR).
    const C = CONTRATS[c.cle];
    if (C.cout && jetonsRogue(j) < C.cout) { toast(`Il faut ${C.cout} 🪙 pour ce rachat.`, 'bad'); retour(); return; }
    if (C.cible === 'aucune') { ecrire(payloadDe(item.id)); return; }
    const pl = plafondEffectif(j);
    const deja = k => pl.facteurs.has(k) || pl.ltir.has(k);
    const apres = p => `${money(capHit(p, pl))} → ${money(Math.round(capHit(p, pl) * (C.facteur || 0)))}`;
    let liste;
    if (C.cible === 'blesse') {
      liste = blessesAuJour(j).filter(x => signes().some(q => getPlayerKey(q) === getPlayerKey(x.p)) && !deja(getPlayerKey(x.p)))
        .map(x => ({ p: x.p, sous: `${x.reste} match${x.reste > 1 ? 's' : ''} d'infirmerie · ${money(x.p.$)} hors du plafond` }));
      if (!liste.length) { toast('Personne à l\'infirmerie sous contrat : garde-la pour plus tard.'); retour(); return; }
    } else {
      liste = signes().filter(p => !deja(getPlayerKey(p)) && (C.cible !== 'recrue' || ageAtSeason(p.bd, p.s) <= 23))
        .sort((a, b) => (b.$ || 0) - (a.$ || 0)).map(p => ({ p, sous: `${apres(p)}${C.cible === 'recrue' ? ` · ${ageAtSeason(p.bd, p.s)} ans` : ''}` }));
      if (!liste.length) { toast(C.cible === 'recrue' ? 'Aucune recrue de 23 ans ou moins dans ton alignement.' : 'Tous tes contrats sont déjà retouchés.'); retour(); return; }
    }
    listeJoueurs(`${c.nom} : pour qui ?`, c.texte, liste, k => ecrire(payloadDe(item.id, { joueur: k })), reglesDe(item.id));
    return;
  }
  ecrire(payloadDe(item.id));
}
/* Un joueur retrouvé par sa clé (« saison_club_id ») : ceux qu'on garde d'une run à l'autre. */
async function joueurDeCle(cle) {
  const [s] = String(cle).split('_');
  try { const e = await getShard(s); return e.players.find(p => getPlayerKey(p) === cle) || null; } catch { return null; }
}
/*
 * LES PLOMBIERS : vingt-trois vrais joueurs, les moins productifs de huit
 * saisons tirées au hasard — des réguliers, pas des rappelés d'un match (du
 * 10e au 30e centile de production). Le déblocage « Des plombiers moins pires »
 * les prend un cran plus haut (30e au 50e). `autoRoster` les range, et
 * les joueurs gardés de la dernière run passent devant.
 */
async function plombiers(meta, gardes = []) {
  const saisons = state.index.seasons.slice(), choisies = [];
  while (choisies.length < 8 && saisons.length) choisies.push(saisons.splice(Math.floor(Math.random() * saisons.length), 1)[0]);
  const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));
  // Mesuré : le fond absolu (0-20 %) faisait 6 à 12 points, une run perdue d'avance ; 10-30 % en fait 12 à 33.
  const [bas, haut] = aDebloque(meta, 'plombiersPlus') ? [0.3, 0.5] : [0.1, 0.3];
  const gardesPersonnes = new Set(gardes.map(getPersonKey));
  const pool = [];
  for (const s of choisies) {
    const e = await getShard(s);
    for (const g of ['F', 'D', 'G']) {
      const reg = e.players.filter(p => groupeDe(p) === g && (p.gp || 0) >= (g === 'G' ? 10 : 30) && !gardesPersonnes.has(getPersonKey(p)))
        .sort((a, b) => prod(a) - prod(b));
      const tranche = reg.slice(Math.floor(reg.length * bas), Math.max(1, Math.floor(reg.length * haut)));
      const n = g === 'F' ? 3 : g === 'D' ? 2 : 1;
      for (let i = 0; i < n && tranche.length; i++) pool.push(tranche.splice(Math.floor(Math.random() * tranche.length), 1)[0]);
    }
  }
  return autoRoster([...gardes, ...pool]);
}
/* Le choix d'un joueur à garder de la dernière run, en cartes. */
function choisirGarde(joueurs, i, total) {
  return new Promise(resolve => {
    ouvrirChoix({
      ico: '🤝', titre: `Garder un joueur · ${i + 1} sur ${total}`, cartes: true, genre: 'recompense', fermable: true, motFermer: 'Personne',
      recit: 'Ta dernière équipe : celui que tu touches te suit dans cette run, avec ta nouvelle bande de plombiers.',
      options: joueurs.map(p => ({ cle: getPlayerKey(p), rarete: rareteJoueur(p), nom: p.n, type: `${POSTE_GROUPE[groupeDe(p)]} · ${p.t} ${p.s}`, coin: money(p.$),
        art: artJoueur({ portraitHtml: headshotHtml(p), logoHtml: getTeamLogoHtml(p.t, 24), pos: esc(POSTE_GROUPE[groupeDe(p)]), saison: esc(p.s), club: esc(p.t) }),
        carteJoueur: carteMiniHtml(p), motChoix: 'Garder', apercu: () => apercuJoueur(p) })),
      onChoix: k => resolve(joueurs.find(p => getPlayerKey(p) === k) || null),
      onFerme: () => resolve(null),
    });
  });
}
/*
 * UNE RUN QUI COMMENCE : l'écran de la run (ce qu'on a débloqué), les
 * joueurs à garder s'il y en a, puis vingt-trois plombiers et l'alignement.
 */
async function ouvrirRogue() {
  const meta = lireMeta();
  const k = nombreGardes(meta);
  const go = await new Promise(resolve => ouvrirChoix({
    ico: '💀', titre: 'Le mode Rogue', fermable: true, motFermer: 'Pas maintenant',
    recit: `Tu pars avec vingt-trois plombiers : de vrais joueurs, les moins productifs de leurs saisons. Chaque résultat rapporte des jetons (🪙 ${jetonsDeDepart(meta)} au départ), et la boutique du hub vend des packs de joueurs et de cartes. Le plafond salarial tient : ${money(PLAFOND_ROGUE + plafondDuVestiaire(meta))}, que des cartes 💵 peuvent tordre. À la fin de la saison, tes écussons 🏅 débloquent la suite au vestiaire du menu.`,
    options: [{ cle: 'go', ico: '▶', nom: 'Commencer la run',
      bon: [`${Object.keys(PACKS_TOUS).filter(k => !VERROUS_ROGUE[k] || aDebloque(meta, VERROUS_ROGUE[k])).length} packs à la boutique`, k ? `tu gardes ${k} joueur${k > 1 ? 's' : ''} de ta dernière équipe` : '', aDebloque(meta, 'deckPlus') ? 'un deck aiguisé' : ''].filter(Boolean).join(' · '),
      prix: `🏅 ${meta.ecussons || 0} écussons · ${meta.runs || 0} run${(meta.runs || 0) > 1 ? 's' : ''} jouée${(meta.runs || 0) > 1 ? 's' : ''} · 🗂️ ${(meta.collection || []).length} joueurs dans ta collection` }],
    onChoix: () => resolve(true),
    onFerme: () => resolve(false),
  }));
  if (!go) return;
  const gardes = [];
  if (k && (meta.derniereEquipe || []).length) {
    const joueurs = (await Promise.all(meta.derniereEquipe.map(joueurDeCle))).filter(Boolean);
    for (let i = 0; i < k; i++) {
      const p = await choisirGarde(joueurs.filter(x => !gardes.includes(x)), i, k);
      if (!p) break;
      gardes.push(p);
    }
  }
  await sousVoile('On rassemble tes plombiers…', () => demarrerRogue(gardes));
}
async function demarrerRogue(gardes = []) {
  const meta = lireMeta();
  G.bonus = 'ROGUE';
  G.mode = 'CLASSIQUE'; G.epoque = null; G.repechage = 'TOUTES'; G.identite = null;
  clearSave();
  G.variantes = { graine: nouvelleGraine(), cartes: {} };
  G.roster = {}; poserCartes(); G.tirage = []; G.echelle = {}; G.dette = 0; G.renfort = null;
  G.ligue = null; G.tournoi = null; G.relances = 0; G.left = { ...REROLLS };
  G.target = null; G.mainCase = null; G.mainRang = null; G.selectedSlot = null; G.done = false; G.lignes = null;
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  $('game').classList.remove('bilan');
  G.roster = await plombiers(meta, gardes);
  G.rogue = { depart: jetonsDeDepart(meta), deckPlus: aDebloque(meta, 'deckPlus'), gardes: gardes.map(getPlayerKey), plafond: plafondDeDepart(meta) };
  saveGame(); syncOptionsUI(); render();
  setView('roster');
  toast(`Tes plombiers sont là${gardes.length ? `, avec ${gardes.map(p => p.n).join(' et ')}` : ''}. Lance la saison quand tu veux : la boutique t'attend au hub.`);
}
/*
 * LE PLAFOND D'UNE RUN, fixé à son départ : 82 M$, plus ce que le vestiaire a
 * débloqué, et au moins 12 M$ d'espace au-dessus de la masse de départ (trois
 * vedettes gardées de la dernière run ne doivent pas bloquer la saison).
 */
const ESPACE_DE_DEPART = 12_000_000;
function plafondDeDepart(meta) {
  const lignes = [];
  let cap = PLAFOND_ROGUE;
  const v = plafondDuVestiaire(meta);
  if (v) { cap += v; lignes.push({ nom: 'Le vestiaire', montant: v }); }
  const masse = signes().reduce((a, p) => a + (p.$ || 0), 0);
  const min = Math.ceil((masse + ESPACE_DE_DEPART) / 100_000) * 100_000;
  if (cap < min) { lignes.push({ nom: 'Ta masse de départ', montant: min - cap }); cap = min; }
  return { cap, lignes };
}
/* Les écussons d'une saison Rogue, payés une fois (`payerEcussons` s'en souvient). */
function finDeSaisonRogue() {
  if (G.bonus !== 'ROGUE' || !G.ligue || !G.ligue.you) return;
  const t = G.ligue.you;
  const pts = t.PTS || 0;
  const n = payerEcussons(G.ligue.graine, 'saison', ecussonsDeLaSaison(pts), {
    equipe: Object.values(G.roster || {}).filter(Boolean).map(getPlayerKey),
    bilan: { pts, W: t.W, L: t.L, OTL: t.OTL },
  });
  if (n) setTimeout(() => toast(`🏅 +${n} écussons pour ta saison (${pts} points) — dépense-les au vestiaire, dans le menu.`), 900);
}
/* Et ceux des séries : dix par ronde gagnée, vingt de plus pour la Coupe. */
function finDesSeriesRogue(rondes, coupe) {
  if (G.bonus !== 'ROGUE' || !G.ligue) return;
  const n = payerEcussons(G.ligue.graine, 'series', ecussonsDesSeries(rondes, coupe), { bilan: { ronde: rondes, coupe: !!coupe } });
  if (n) setTimeout(() => toast(`🏅 +${n} écussons pour tes séries${coupe ? ' — et la Coupe !' : ''}`), 900);
}
/* LE VESTIAIRE DES DÉBLOCAGES : ce que les écussons achètent, d'une run à l'autre. */
function ouvrirVestiaire(apres = null) {
  const meta = lireMeta();
  ouvrirChoix({
    ico: '🏅', titre: `Le vestiaire · ${meta.ecussons || 0} écussons`, fermable: true, motFermer: 'Fermer',
    recit: `Tes écussons se gagnent à la fin de chaque run (un par tranche de quatre points, dix par ronde de séries gagnée, vingt de plus pour la Coupe). Ce que tu débloques reste pour toutes les runs. Ta collection : ${(meta.collection || []).length} joueurs, ${(meta.cartes || []).length} cartes.`,
    options: Object.entries(DEBLOCAGES).map(([k, D]) => {
      const pris = aDebloque(meta, k);
      const manque = D.requis && !aDebloque(meta, D.requis) ? `Demande d'abord : ${DEBLOCAGES[D.requis].nom}` : null;
      return { cle: k, ico: D.ico, nom: `${D.nom}${pris ? ' ✓' : ` · ${D.prix} 🏅`}`, bon: D.texte,
        desactive: pris ? 'Débloqué' : manque || ((meta.ecussons || 0) < D.prix ? `Il te manque ${D.prix - (meta.ecussons || 0)} 🏅` : null) };
    }),
    onChoix: k => {
      if (peutAcheter(lireMeta(), k) && acheterDeblocage(k)) toast(`${DEBLOCAGES[k].ico} ${DEBLOCAGES[k].nom} : débloqué.`);
      ouvrirVestiaire(apres);
      if (apres) apres();
    },
  });
}

function setupEvents() {
  // Recherche et tri (tirage VESTIAIRE)
  const search = $('searchInput');
  if (search) {
    search.value = G.search;
    search.oninput = () => { G.search = search.value.trim(); renderPool(); renderPoolMeta(); };
  }
  const sort = $('sortSelect');
  if (sort) {
    sort.value = G.sortBy;
    sort.onchange = () => { G.sortBy = sort.value; saveOpts(); renderPool(); };
  }
  syncAgeControls();

  // LA BARRE D'ONGLETS DU BAS : la seule navigation du jeu. C'est
  // `majNavbar` qui la bâtit et qui branche ses boutons.

  // Modales
  // Les équipes, l'historique et les règles sont des PAGES, pas des modales :
  // `montrerPage` les remplit. Il ne reste en haut que ce qui est une ACTION.
  bindModal('optionsModal', 'openOptionsBtn', 'closeOptionsBtn', syncOptionsUI);
  // « Nouvelle » ramène au CHOIX DU MODE (S79, JP) ; l'écran « Nouvelle partie » s'ouvre ensuite, réglé sur le mode choisi.
  bindModal('partieModal', null, 'closePartieBtn', semerBrouillon, oublierBrouillon);
  const nouvelleBtn = $('openPartieBtn');
  if (nouvelleBtn) nouvelleBtn.onclick = () => { saveGame(); afficherMenu(contexteDuMenu({ enJeu: true, choix: true })); };
  const menuBtn = $('menuBtn');
  if (menuBtn) menuBtn.onclick = () => { saveGame(); afficherMenu(contexteDuMenu({ enJeu: true })); };
  // MES LIGNES AU REPÊCHAGE (S68) : réglées avant la saison, elles entrent
  // dans la décision 0. Depuis S78, elles se règlent SOUS chaque trio de
  // l'alignement (`tiroirStrategie`) : le bouton « Mes lignes » est parti.
  bindModal('hockeyCardModal', null, 'closeHockeyCardBtn');
  bindModal('gameModal', null, 'closeGameBtn');

  // Options
  document.querySelectorAll('.seg').forEach(seg => {
    seg.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        // Un réglage de PARTIE ne fait que garnir le brouillon : pas de
        // newGame, et pas de render() non plus — reconstruire le bassin
        // derrière une modale ouverte coûte un `ajusterCartes` pour rien.
        if (REGLAGES_PARTIE.has(seg.dataset.opt)) { poserBrouillon(seg.dataset.opt, b.dataset.val); return; }
        setOption(seg.dataset.opt, b.dataset.val);
        syncOptionsUI();
        render();
      };
    });
  });

  /*
   * LE BOUTON DU PIED. C'est le SEUL endroit d'où part une partie neuve, et il
   * ne peut pas partir deux fois : `demarrageEnCours` tient la porte pendant
   * que les shards chargent. L'écran reste OUVERT pendant ce temps — il bloque
   * le reste de l'interface, et si un shard ne répond pas on a encore un
   * endroit où revenir.
   */
  // L'exhibition ne passe PAS par le pied : elle n'applique rien, elle ouvre
  // un match. C'est un deuxième bouton, avec sa propre porte.
  const ex = $('npExhibition');
  if (ex) ex.onclick = () => jouerExhibition();
  /*
   * COMMENT ON JOUE, EN CINQ CARTES (S74). Pour un kid qui ouvre le jeu : la
   * boucle entière, une carte par étape, en plein écran — à lire, pas à
   * prendre. Par-dessus « Nouvelle partie », qui reste là dessous.
   */
  const aide = $('npAide');
  if (aide) aide.onclick = () => ouvrirChoix({
    ico: '❓', titre: 'Comment on joue', cartes: true, lecture: true, genre: 'aide', fermable: true, motFermer: 'Compris !',
    recit: 'Cap 82-0, c\'est bâtir une équipe de vrais joueurs et aller chercher la Coupe. Balaie les cartes.',
    options: [
      { cle: 'a1', rarete: 'commune', ico: '🎰', nom: '1. Repêche', type: 'Le repêchage', texte: 'La roulette sort de vrais clubs de 55 saisons. Signe 23 joueurs sous le plafond : trouver les aubaines, c\'est le métier.' },
      { cle: 'a2', rarete: 'peu', ico: '🧬', nom: '2. Ton identité', type: 'Avant le premier tour', texte: 'Une carte parmi trois colore ton repêchage : la roulette sort plus souvent tes francs-tireurs, tes costauds, tes aubaines…' },
      { cle: 'a3', rarete: 'peu', ico: '🏒', nom: '3. Tes lignes', type: 'Derrière le banc', texte: 'Chaque ligne joue une tactique. Plus elle la joue, plus sa chimie monte — mais contre un gros adversaire, il faut parfois changer.' },
      { cle: 'a4', rarete: 'rare', ico: '🃏', nom: '4. Tes cartes', type: 'Gros matchs et séries', texte: 'Cinq cartes, trois d\'énergie. Tu vois la main de l\'adversaire : réponds-lui. Gagne, et ton deck grandit.' },
      { cle: 'a5', rarete: 'legendaire', ico: '🏆', nom: '5. La Coupe', type: 'Le but', texte: '82 matchs, puis les séries, match par match, contre des boss. La Coupe est le vrai but ; le 82-0, le Graal. Tout ce que tu gagnes va dans ton album.' },
    ],
    onChoix: () => {},
  });

  const go = $('npGo');
  if (go) {
    go.onclick = async () => {
      if (demarrageEnCours || !G.brouillon) return;
      const b = { ...G.brouillon };
      // Le dé se jette ici, une fois : une partie « au hasard » repart toujours.
      const auHasard = resoudreHasard(b);
      const act = auHasard.length ? 'DEMARRER' : actionDuBouton(b);
      if (act === 'RIEN') { closeModal('partieModal'); return; }
      if (act === 'BONUS') {
        // Le mode bonus ne touche pas au repêchage : c'est le seul réglage de
        // partie qu'on bascule l'alignement à moitié bâti, et il le reste.
        G.bonus = b.bonus;
        closeModal('partieModal');
        // Tout se redessine, pas seulement le bouton : depuis que le
        // repêchage montre les nombres du plateau en Sur table, la carte, le
        // tri, la case et les tuiles dépendent du mode bonus.
        saveOpts(); saveGame(); syncOptionsUI(); render();
        toast(b.bonus === 'TABLE'
          ? 'Sur table : ton alignement ira jouer un tournoi de six clubs sur un plateau.'
          : 'La saison : 82 matchs et les séries.');
        return;
      }
      demarrageEnCours = true;
      go.disabled = true;
      try {
        // L'identité se choisit AVANT la roulette, par-dessus cet écran.
        const choix = await choisirIdentite();
        await demarrerPartie({ ...b, identite: choix });
        closeModal('partieModal');
        toast(`${auHasard.length ? `🎲 Le hasard a choisi ${auHasard.join(' et ')}. ` : ''}${MODES[b.mode].nom}${b.epoque ? ` · ${b.epoque}` : ''}${b.repechage === 'FRANCHISE' && FRANCHISES[b.franchise] ? ` · ${FRANCHISES[b.franchise].nom}` : ''} : la roulette repart à zéro.`);
      } catch {
        toast('Impossible de charger cette saison. Réessaie ou change de ligue.');
      } finally {
        demarrageEnCours = false;
        go.disabled = false;
        majPiedPartie();
      }
    };
  }

  window.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      // L'écran de saison et le direct ont leur propre sortie : Échap ne
      // les ferme pas, ça laisserait la saison à moitié révélée. Et parmi
      // celles qui restent, on ne ferme que CELLE DU DESSUS.
      const ouvertes = [...document.querySelectorAll('.modal-backdrop:not(.live)')]
        .filter(m => m.style.display && m.style.display !== 'none');
      if (ouvertes.length) {
        ouvertes.sort((a, b) => Number(b.dataset.rang || 0) - Number(a.dataset.rang || 0));
        fermerModale(ouvertes[0]);
      }
      if (G.selectedSlot !== null || G.target !== null) {
        G.selectedSlot = null; G.target = null; render();
      }
    }
    if (ev.key === 'Tab') piegerFocus(ev);
  });

  $('mainBtn').onclick = runSeason;
}

/*
 * LE FOCUS RESTE DANS LA MODALE. Au clavier, Tab sortait de la fiche sans
 * qu'on s'en rende compte et continuait dans la page derrière. Une modale
 * qui s'ouvre prend le focus (son bouton de fermeture, sinon son premier
 * élément focalisable), Tab et Maj+Tab tournent à l'intérieur, et la
 * fermeture rend le focus à ce qui l'avait avant.
 */
const FOCALISABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let focusAvantModale = null;

const modaleOuverte = () => [...document.querySelectorAll('.modal-backdrop')].filter(m => m.style.display !== 'none' && m.offsetParent !== null).pop() || null;

/*
 * L'ORDRE D'OUVERTURE, pour qu'Échap ne ferme que la modale du DESSUS. Les
 * modales s'empilent depuis que l'écran des équipes ouvre la fiche d'un
 * joueur : tout fermer d'un coup voulait dire qu'on ne pouvait pas refermer
 * une fiche sans sortir de l'écran qui l'avait ouverte. L'ordre du DOM ne dit
 * rien de l'ordre d'ouverture, d'où ce compteur.
 */
let rangModale = 0;
function ouvrirModale(m) {
  if (!m) return;
  if (!modaleOuverte()) focusAvantModale = document.activeElement;
  m.dataset.rang = String(++rangModale);
  m.style.display = 'flex';
  const cible = m.querySelector('.close-btn') || m.querySelector(FOCALISABLE);
  if (cible) cible.focus({ preventScroll: true });
}

function fermerModale(m) {
  if (!m || m.style.display === 'none') return;
  m.style.display = 'none';
  if (m._auFermer) m._auFermer();
  if (!modaleOuverte() && focusAvantModale && document.contains(focusAvantModale)) {
    focusAvantModale.focus({ preventScroll: true });
    focusAvantModale = null;
  }
}

function piegerFocus(ev) {
  const m = modaleOuverte();
  if (!m) return;
  const items = [...m.querySelectorAll(FOCALISABLE)].filter(el => el.offsetParent !== null);
  if (!items.length) { ev.preventDefault(); return; }
  const premier = items[0], dernier = items[items.length - 1];
  if (!m.contains(document.activeElement)) { ev.preventDefault(); premier.focus(); return; }
  if (ev.shiftKey && document.activeElement === premier) { ev.preventDefault(); dernier.focus(); }
  else if (!ev.shiftKey && document.activeElement === dernier) { ev.preventDefault(); premier.focus(); }
}

function bindModal(modalId, openId, closeId, onOpen, onClose) {
  const modal = $(modalId);
  if (!modal) return;
  // Les trois sorties — ✕, clic sur le fond, Échap — passent toutes par
  // `fermerModale` : une seule ligne les couvre.
  modal._auFermer = onClose || null;
  if (openId && $(openId)) $(openId).onclick = () => { if (onOpen) onOpen(); ouvrirModale(modal); };
  if (closeId && $(closeId)) $(closeId).onclick = () => fermerModale(modal);
  modal.onclick = ev => { if (ev.target === modal) fermerModale(modal); };
}

const closeModal = id => fermerModale($(id));
const openModal = id => ouvrirModale($(id));

function setOption(key, val) {
  if (key === 'poolView') {
    G.poolView = val === 'LIST' ? 'LIST' : 'POS';
    // Demander les six colonnes quand un filtre n'en laisse qu'une seule ne
    // voudrait rien dire : le bouton lève le filtre plutôt que de ne rien
    // faire. Une commande visible doit toujours faire quelque chose.
    if (G.poolView === 'POS' && G.filter !== 'ALL') { G.filter = 'ALL'; renderFilters(); }
  }
  else if (key === 'palette') {
    // La palette ne touche qu'à des couleurs : pas de nouvelle partie.
    if (!PALETTES.includes(val) || val === G.palette) return;
    G.palette = val;
    appliquerPalette();
    saveOpts();
    syncOptionsUI();
    return;
  }
  else if (key === 'sons') { G.sons = val === 'on'; activerSons(G.sons); }
  else if (key === 'niveauTable') G.niveauTable = val === 'PRO' ? 'PRO' : 'RECRUE';
  else if (key === 'stats') G.statsProrata = val === 'prorata';
  else if (key === 'salary') G.salaryMode = val;
  else if (key === 'onlyFit') G.onlyFit = val === 'on';
  saveOpts();
}

/* =====================================================================
   L'ÉCRAN « NOUVELLE PARTIE » : on compose, puis on lance
   =====================================================================
   JP : *faire bouton new game aussi, qui permet de choisir les options du jeu
   au lieu d'un menu option, pour faire plus « jeu »*.

   DEUX INVARIANTS. (1) Un réglage de PARTIE ne touche jamais `G` avant le
   bouton du pied, et UN SEUL `demarrerPartie()` part par clic — `setOption`
   lançait un `newGame()` non attendu dans quatre branches, donc changer le
   format puis le tirage mettait deux `chargerRenfort()` et deux `nextSpin()`
   en vol, et le plus lent écrivait `G.tirage`. (2) Un réglage qui, changé,
   oblige à jeter l'alignement est un réglage de PARTIE ; les quatre qui
   restent dans les options peuvent changer au milieu d'un tour sans rien
   perdre.
   ===================================================================== */

/*
 * « AU HASARD » (S78). JP : *ajouter random au mode saison années ou au mode
 * piger dans une équipe seulement*. La saison de la ligue et la franchise du
 * repêchage peuvent se laisser au dé : le tirage se fait AU DÉPART, une fois,
 * et le toast le dit. La partie porte ensuite la vraie saison, la vraie
 * franchise — la sauvegarde ne connaît jamais « au hasard ».
 */
const HASARD = 'HASARD';
function resoudreHasard(b) {
  const mots = [];
  if (b.epoqueChoisie === HASARD || b.epoque === HASARD) {
    const x = rnd(state.index.seasons);
    if (b.epoque === HASARD) { b.epoque = x; mots.push(`la saison ${x}`); }
    b.epoqueChoisie = x;
  }
  if (b.repechage === 'FRANCHISE' && b.franchise === HASARD) {
    b.franchise = rnd(Object.keys(FRANCHISES).filter(k => saisonsDeFranchise(k, state.index.seasons).length));
    mots.push(FRANCHISES[b.franchise].nom);
  }
  return mots;
}

/** Les valeurs de départ viennent de l'état VIVANT, jamais des préférences. */
function semerBrouillon() {
  const dernier = state.index.seasons[state.index.seasons.length - 1];
  G.brouillon = {
    mode: G.mode, epoque: G.epoque, repechage: G.repechage, franchise: G.franchise, bonus: G.bonus,
    // La saison RETENUE, même quand la ligue est « toutes les époques » : un
    // aller-retour ne doit pas ramener la dernière saison de la liste.
    epoqueChoisie: G.epoque || dernier,
  };
  syncOptionsUI();
  majPiedPartie();
}

function oublierBrouillon() { G.brouillon = null; syncOptionsUI(); }

function poserBrouillon(key, val) {
  const b = G.brouillon;
  if (!b) return;
  if (key === 'format' || key === 'tirage') {
    // Le mode est le PRODUIT des deux : la clé se compose une seule fois, ici.
    const M = MODES[b.mode] || MODES.CLASSIQUE;
    b.mode = modeDe(key === 'format' ? val : M.format, key === 'tirage' ? val : M.tirage);
  } else if (key === 'ligue') b.epoque = val === 'UNE' ? b.epoqueChoisie : null;
  else if (key === 'repechage') {
    b.repechage = normRepechage(val);
    if (b.repechage === 'FRANCHISE' && !FRANCHISES[b.franchise]) b.franchise = ($('franchiseSelect') && $('franchiseSelect').value) || 'MTL';
  }
  else if (key === 'bonus') b.bonus = val === 'TABLE' ? 'TABLE' : 'SAISON';
  syncOptionsUI();
  majPiedPartie();
}

/**
 * Ce que le bouton du pied va faire : RIEN (rien n'est signé et rien n'a
 * changé — on referme), BONUS (le seul réglage qui ne touche pas au
 * repêchage : on garde l'alignement) ou DEMARRER.
 */
function actionDuBouton(b) {
  const enPartie = !G.done && G.tirage.length > 0;
  const memeRepechage = b.mode === G.mode && b.epoque === G.epoque && b.repechage === G.repechage
    && (b.repechage !== 'FRANCHISE' || b.franchise === G.franchise);
  if (!enPartie || !memeRepechage) return 'DEMARRER';
  // Une partie encore vide qui n'a pas choisi son identité (S73) repart avec le
  // choix — même quand on ne bascule que le mode bonus : rien n'est perdu.
  if (!signes().length && G.identite === undefined) return 'DEMARRER';
  if (b.bonus !== G.bonus) return 'BONUS';
  return signes().length ? 'DEMARRER' : 'RIEN';
}

function majPiedPartie() {
  const b = G.brouillon;
  if (!b) return;
  const M = MODES[b.mode] || MODES.CLASSIQUE;
  // Aucun chiffre recopié à la main : tout vient de MODES, casesDuMode et
  // REROLLS. Une constante recopiée est une constante qui ment tôt ou tard —
  // le dépôt en porte déjà la preuve dans deux `desc` de MODES.
  $('npResume').textContent = [
    `${casesDuMode(b.mode).length} cases`,
    money(M.cap),
    M.loto ? `trois clubs par case · ${M.relances} relances`
      : `un vestiaire au complet · ${REROLLS.season}/${REROLLS.team}/${REROLLS.pass} relances`,
    b.epoque === HASARD ? 'ligue 🎲 au hasard' : b.epoque ? `ligue ${b.epoque}` : 'toutes les époques',
    b.repechage === 'FRANCHISE' && b.franchise === HASARD ? 'repêchage : 🎲 une franchise au hasard'
      : b.repechage === 'FRANCHISE' && FRANCHISES[b.franchise] ? `repêchage : ${FRANCHISES[b.franchise].nom}`
      : b.epoque && b.repechage === 'TOUTES' ? 'repêchage toutes époques' : null,
    b.bonus === 'TABLE' ? 'sur table' : null,
  ].filter(Boolean).join(' · ');

  const n = signes().length;
  const enPartie = !G.done && G.tirage.length > 0;
  const rep = $('npReprise');
  rep.hidden = !(enPartie && n > 0);
  if (!rep.hidden) rep.textContent = `Une partie est en cours : ${n} joueur${n > 1 ? 's' : ''} signé${n > 1 ? 's' : ''}. Ferme cet écran (✕) pour y revenir.`;

  const act = actionDuBouton(b);
  const efface = act === 'DEMARRER' && enPartie && n > 0;
  $('npGoVerbe').textContent = efface ? 'Recommencer' : act === 'BONUS' ? 'Appliquer' : 'Commencer';
  // La note n'est JAMAIS vide : le bouton ne change pas de hauteur.
  $('npGoNote').textContent = efface ? `efface ${n} joueur${n > 1 ? 's' : ''}`
    : act === 'DEMARRER' ? 'la roulette repart' : "rien n'est effacé";
  $('npGo').classList.toggle('efface', efface);
}

function ouvrirNouvellePartie(bonus = null) {
  semerBrouillon();
  // Du menu (S77) : la carte « Sur table » ouvre l'écran déjà réglé sur table.
  if (bonus && G.brouillon) { G.brouillon.bonus = bonus; syncOptionsUI(); majPiedPartie(); }
  openModal('partieModal');
}

/*
 * LE CHOIX DE L'IDENTITÉ (S73), en plein écran et en cartes : trois
 * identités tirées au hasard, ou « Pas de préférence ». Il se prend AVANT la
 * première roulette, pour que le tout premier tour la porte déjà.
 */
function choisirIdentite() {
  return new Promise(resolve => {
    ouvrirChoix({
      ico: '🧬', titre: 'Ton identité', cartes: true, genre: 'identite', fermable: true, motFermer: 'Pas de préférence',
      recit: 'Avant le premier tour, une carte qui colore tout ton repêchage : la roulette sortira plus souvent ce genre de joueurs — plus souvent, pas toujours. Touche celle que tu veux.',
      options: identitesOffertes().map(k => ({ cle: k, rarete: IDENTITES[k].rarete, ico: IDENTITES[k].ico, nom: IDENTITES[k].nom,
        type: 'Identité · tout le repêchage', texte: IDENTITES[k].texte })),
      onChoix: k => resolve(k),
      onFerme: () => resolve(null),
    });
  });
}

function syncOptionsUI() {
  // Le BROUILLON gagne tant qu'il existe : l'écran montre ce qu'on est en
  // train de composer, pas la partie en cours. `G` porte les mêmes noms de
  // champs, donc une seule ligne suffit.
  const src = G.brouillon || G;
  const M = MODES[src.mode] || MODES.CLASSIQUE;
  const cur = {
    stats: G.statsProrata ? 'prorata' : 'real',
    salary: G.salaryMode,
    onlyFit: G.onlyFit ? 'on' : 'off',
    poolView: G.poolView,
    palette: G.palette,
    sons: G.sons ? 'on' : 'off',
    niveauTable: G.niveauTable,
    format: M.format,
    tirage: M.tirage,
    ligue: src.epoque ? 'UNE' : 'TOUTES',
    // Sans ligue fixée, « dans la saison » ne veut rien dire : le bouton allumé est « toutes les époques ».
    repechage: src.repechage === 'FRANCHISE' ? 'FRANCHISE' : src.epoque ? src.repechage : 'TOUTES',
    bonus: src.bonus,
  };
  const sel = $('epoqueSelect');
  if (sel) {
    if (!sel.options.length) {
      sel.innerHTML = `<option value="${HASARD}">🎲 Au hasard</option>` + state.index.seasons.slice().reverse().map(x => `<option value="${x}">${x}</option>`).join('');
      // Choisir dans la liste ne relance plus rien : ça garnit le brouillon.
      sel.onchange = () => {
        if (!G.brouillon) return;
        G.brouillon.epoqueChoisie = sel.value;
        G.brouillon.epoque = sel.value;
        majPiedPartie();
      };
    }
    sel.value = (G.brouillon ? G.brouillon.epoqueChoisie : G.epoque) || state.index.seasons[state.index.seasons.length - 1];
    // ON DÉSACTIVE, ON NE CACHE PLUS. `piegerFocus` filtre sur `offsetParent`,
    // donc une rangée qui disparaît change l'ordre de tabulation à chaque
    // clic — et « on réserve la place, on ne la prend pas ».
    sel.disabled = !src.epoque;
  }
  const rep = $('repechageRow');
  if (rep) {
    rep.hidden = false;
    rep.classList.remove('desactive');
    // « Dans la saison » demande une ligue fixée ; les deux autres valent toujours.
    rep.querySelectorAll('.seg button').forEach(x => { x.disabled = x.dataset.val === 'SAISON' && !src.epoque; });
  }
  const fsel = $('franchiseSelect');
  if (fsel) {
    if (!fsel.options.length) {
      fsel.innerHTML = `<option value="${HASARD}">🎲 Au hasard</option>` + Object.entries(FRANCHISES).sort((a, b) => a[1].nom.localeCompare(b[1].nom, 'fr'))
        .map(([k, F]) => `<option value="${k}">${esc(F.nom)}</option>`).join('');
      // Choisir une franchise, c'est choisir ce repêchage-là.
      fsel.onchange = () => {
        if (!G.brouillon) return;
        G.brouillon.franchise = fsel.value;
        G.brouillon.repechage = 'FRANCHISE';
        syncOptionsUI();
        majPiedPartie();
      };
    }
    fsel.value = (G.brouillon ? G.brouillon.franchise : G.franchise) || 'MTL';
    fsel.disabled = src.repechage !== 'FRANCHISE';
    const F = FRANCHISES[fsel.value];
    const lig = $('franchiseLignee');
    if (lig) lig.textContent = src.repechage !== 'FRANCHISE' ? '' : fsel.value === HASARD ? 'Le dé choisit la franchise au départ.' : F && F.lignee ? F.lignee : '';
  }
  document.querySelectorAll('.seg').forEach(seg => {
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.val === cur[seg.dataset.opt]);
    });
  });
}

/* ======================================================================
   UN ONGLET, UNE RAISON D'ÊTRE
   ======================================================================
   JP : *mettre onglets en bas, pages séparées de l'accueil* ; *un onglet, une
   raison d'être genre* ; *je veux pas avoir tout restant dans la page, picks,
   alignement, match du jour/calendrier, standings, leaders, C'EST TOUS DES
   ONGLETS DIFFÉRENTS*.

   Le jeu avait TROIS systèmes d'onglets à trois endroits — les deux volets
   en bas, le bilan au milieu, l'écran de saison au milieu aussi — et trois
   destinations enfermées dans des modales ouvertes par des icônes du haut.
   Il n'y en a plus qu'un : la barre du bas. Ce qui reste en haut est ce qui
   n'est pas une destination — la jauge de plafond, Nouvelle partie, Options.

   `document.body.dataset.page` est le seul état, et la feuille de style en
   déduit tout : c'est elle qui décide que la roulette ne s'affiche pas sur
   l'onglet de l'alignement, plutôt qu'un `hidden` posé à la main quelque part.
   ====================================================================== */
/*
 * LES ENTRÉES DE LA BARRE SUIVENT LA PHASE DE LA PARTIE. JP : *picks,
 * alignement, match du jour/calendrier, standings, leaders, C'EST TOUS DES
 * ONGLETS DIFFÉRENTS*. Le classement, le calendrier et les meneurs étaient
 * des onglets du bilan, dans une DEUXIÈME barre collée sous la barre du
 * haut : deux barres sur le même écran, et celle du bas ne parlait plus de
 * ce qu'on regardait. Ils sont maintenant des onglets de la SEULE barre,
 * et c'est la phase qui décide desquels on a besoin — on bâtit, puis on lit.
 *
 * `alignement` est dans les deux listes exprès : c'est la même raison d'être
 * (l'alignement), et c'est son CONTENU qui change — le tableau de profondeur
 * qu'on remplit pendant le repêchage, la fiche des 23 après la saison.
 */
const ONGLETS_REF = [
  { cle: 'equipes', ico: 'i-jersey', titre: 'Équipes' },
  { cle: 'historique', ico: 'i-trophy', titre: 'Saisons' },
  { cle: 'regles', ico: 'i-book', titre: 'Règles' },
];

/*
 * LA BARRE NE CHANGE PLUS JAMAIS (S67). JP : *faire que l'interface soit
 * toujours, peu importe le moment, même organisation*. Elle suivait la phase
 * — deux onglets au repêchage, neuf au bilan — et l'écran de saison, les
 * séries et le tournoi avaient chacun la leur, plein écran par-dessus. Il n'y
 * en a plus qu'une, et ses entrées sont FIXES : ce qui change avec la phase,
 * c'est ce que chaque onglet MONTRE.
 *
 *   Match       ce qui se joue : lancer la saison, le prochain match et ses
 *               boutons, la série en cours, le bilan
 *   Vestiaire   le repêchage (la main en loto)
 *   Alignement  le tableau de profondeur ; en pleine saison, le banc
 *   Classement  le classement du jour, le tableau des séries, le final
 *   Calendrier  tes matchs, la ronde, le calendrier de la saison
 *   Meneurs     les meneurs à ce jour, ou de la saison
 *   Équipes · Saisons · Règles
 *
 * Un onglet qui n'a encore rien à montrer ne disparaît pas : il dit pourquoi
 * et offre la suite (`remplirVide`). Une barre dont les entrées bougent se
 * réapprend à chaque phase ; une barre fixe s'apprend une fois.
 */
const ALIAS_PAGE = { bilan: 'match', series: 'match', stats: 'meneurs', ligue: 'classement' };
/* Les sections du bilan que montre chaque onglet. */
const VOLETS_DU_BILAN = {
  match: ['series', 'bilan'], classement: ['classement', 'ligue'], calendrier: ['calendrier'],
  meneurs: ['stats'], alignement: ['alignement'],
};
const PAGES_DE_SAISON = ['match', 'classement', 'calendrier', 'meneurs', 'equipes'];

/*
 * UN VOLET VIDE EST UN VOLET SANS RIEN À LIRE, et c'est `textContent` qui le
 * dit — pas `innerHTML` : le volet des séries porte d'avance le conteneur que
 * `dessinerTableauDesSeries` remplira.
 */
function voletsPrets() {
  return new Set([...document.querySelectorAll('#resultHost .result-pane')]
    .filter(p => p.textContent.trim() !== '').map(p => p.dataset.volet));
}
const bilanPret = () => voletsPrets().size > 0;
const enRepechage = () => !G.done && !bilanPret() && !hubActif();

function ongletsCourants() {
  const loto = MODE().loto;
  const draft = enRepechage();
  return [
    { cle: 'match', ico: 'i-cup', titre: 'Match' },
    { cle: 'repechage', ico: 'i-dice', titre: loto ? 'Le loto' : 'Vestiaire', badge: draft ? String(poolFiltered().length) : '' },
    { cle: 'alignement', ico: 'i-list', titre: 'Alignement', badge: draft ? `${signes().length}/${totalCases()}` : '' },
    { cle: 'classement', ico: 'i-chart', titre: 'Classement' },
    { cle: 'calendrier', ico: 'i-cal', titre: 'Calendrier' },
    { cle: 'meneurs', ico: 'i-star', titre: 'Meneurs' },
    ...ONGLETS_REF,
  ];
}

const PAGES = () => ongletsCourants().map(o => o.cle);

/*
 * LA BARRE. Elle se rebâtit quand ses entrées changent (un badge), jamais à
 * chaque rendu : sur un téléphone elle défile en x, et un `innerHTML` par
 * rendu remettrait ce défilement à zéro.
 */
function majNavbar(cle, liste = ongletsCourants()) {
  const nav = $('navbar');
  if (!nav) return;
  const sig = liste.map(o => `${o.cle}:${o.titre}:${o.badge || ''}`).join('|');
  if (nav.dataset.sig !== sig) {
    nav.dataset.sig = sig;
    nav.innerHTML = liste.map(o => `<button class="navtab" type="button" role="tab" data-page="${o.cle}" aria-selected="false">
      <svg class="ico" aria-hidden="true"><use href="#${o.ico}"/></svg>
      <span class="navtab-lbl">${esc(o.titre)}</span>
      ${o.badge ? `<span class="navtab-badge">${esc(o.badge)}</span>` : ''}
    </button>`).join('');
    nav.querySelectorAll('.navtab').forEach(b => { b.onclick = () => montrerPage(b.dataset.page); });
  }
  let ouvert = null;
  nav.querySelectorAll('.navtab').forEach(b => {
    const on = b.dataset.page === cle;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) ouvert = b;
  });
  // L'onglet ouvert reste en vue : on déplace LA BARRE, jamais la page.
  if (ouvert && nav.scrollWidth > nav.clientWidth + 1) {
    const g = ouvert.offsetLeft - 8, d = ouvert.offsetLeft + ouvert.offsetWidth + 8 - nav.clientWidth;
    if (nav.scrollLeft > g) nav.scrollTo({ left: g, behavior: 'smooth' });
    else if (nav.scrollLeft < d) nav.scrollTo({ left: d, behavior: 'smooth' });
  }
}

/*
 * OÙ VIT UN ONGLET, À CE MOMENT-CI. Quatre endroits, et un seul à la fois :
 *   'hub'   un volet de l'écran de saison, des séries ou du tournoi
 *   'jeu'   le repêchage, l'alignement, ou une section du bilan (#game)
 *   'ref'   une page de référence (équipes, saisons, règles)
 *   'vide'  rien encore : la page dit pourquoi et offre la suite
 */
function zoneDe(cle) {
  const hub = hubActif();
  if (hub && voletPour(cle)) return 'hub';
  if (ONGLETS_REF.some(o => o.cle === cle)) return 'ref';
  // LE CARTABLE (S79) : le Vestiaire, une fois le repêchage fini (le Rogue ne repêche jamais).
  if (cle === 'repechage' && (!enRepechage() || G.bonus === 'ROGUE')) return 'cartable';
  if (bilanPret() && !hub) return VOLETS_DU_BILAN[cle] ? 'jeu' : 'vide';
  if (cle === 'repechage') return enRepechage() ? 'jeu' : 'vide';
  // Pendant les séries et le tournoi, l'alignement est figé : rien à y faire.
  if (cle === 'alignement') return hub ? 'vide' : 'jeu';
  return 'vide';
}

/** Pose la page courante. Ne remplit rien d'autre que l'état vide. */
function marquerPage(cle) {
  cle = ALIAS_PAGE[cle] || cle;
  const liste = ongletsCourants();
  if (!liste.some(o => o.cle === cle)) cle = 'match';
  G.page = cle;
  const zone = zoneDe(cle);
  document.body.dataset.page = cle;
  document.body.dataset.zone = zone;
  // L'ÉCRAN DE SAISON S'ANCRE DANS LA PAGE (S67) : entre la barre du haut et
  // celle du bas, jamais par-dessus. Quand l'onglet ouvert n'est pas l'un des
  // siens (le vestiaire, les règles), il se retire sans se fermer.
  const hub = hubActif();
  document.body.classList.toggle('hub-docke', !!hub);
  document.body.classList.toggle('hub-cache', !!hub && zone !== 'hub');
  if (zone === 'hub') {
    const v = voletPour(cle);
    if (v && hub.courant() !== v) hub.montrer(v);
  }
  // Les sections du bilan que cet onglet porte, et elles seules.
  const vis = VOLETS_DU_BILAN[cle] || [];
  document.querySelectorAll('#resultHost .result-pane').forEach(p => {
    p.hidden = !vis.includes(p.dataset.volet) || !p.textContent.trim();
  });
  if (G.done) brancherEntractes($('resultHost'));   // un deck caché mesure zéro
  majNavbar(cle, liste);
  for (const id of ['pageEquipes', 'pageHistorique', 'pageRegles']) {
    const el = $(id);
    if (el) el.hidden = !(zone === 'ref' && id === `page${cle[0].toUpperCase()}${cle.slice(1)}`);
  }
  const vide = $('pageVide');
  if (vide) {
    vide.hidden = zone !== 'vide';
    if (zone === 'vide') remplirVide(cle);
  }
  const cartable = $('pageCartable');
  if (cartable) {
    cartable.hidden = zone !== 'cartable';
    if (zone === 'cartable') remplirCartable();
  }
}

/*
 * LE CARTABLE (S79, js/cartable.js). JP : *page vestiaire devrait contenir
 * toutes les cartes, comme un cartable de carte, clickables, etc, avec stats
 * de la saison en cours et saisons réelles comme vraie carte. Je veux
 * collectionner.* Ton équipe — sa saison RÉVÉLÉE (`compteRevele`, jamais la
 * fin de l'année) et sa vraie saison — puis la collection, par saison et par
 * club. « Mes cartes » ouvre les cartes de jeu (l'inventaire) : du hub avec
 * sa décision quand une saison se joue, en lecture sinon.
 */
function ligneDeSaison(p, S) {
  if (!S || !S.GP) return 'pas encore joué';
  return p.p === 'G'
    ? `${S.GP} PJ · ${S.W || 0} V · ${S.SA ? (S.SV / S.SA).toFixed(3).replace(/^0/, '') : '—'}`
    : `${S.GP} PJ · ${S.G || 0} B · ${S.A || 0} A · ${S.PTS || 0} PTS`;
}
function ligneVraieSaison(p) {
  const st = displayStats(p);
  return p.p === 'G' ? `${st.gp} PJ · ${st.w} V · ${(p.sv || 0).toFixed(3).replace(/^0/, '')}` : `${st.gp} PJ · ${st.g} B · ${st.a} A · ${st.pt} PTS`;
}
function remplirCartable() {
  const host = $('pageCartableCorps');
  if (!host) return;
  const L = G.ligue;
  const portee = L ? porteeRevele('saison') : null;
  const statsDe = p => (!L ? null : portee === 'jour' ? compteEnGrille(compteRevele('jour').get(p)) : statsSim(p, 'saison'));
  const hub = hubActif();
  // Les joueurs des anciennes parties (l'historique) y entrent une fois.
  migrerHistorique(lireHistorique().flatMap(e => (e.alignement || []).filter(a => a && !a.r && a.k).map(a => a.k)));
  rendreCartable(host, {
    esc,
    equipe: signes().map(p => ({ p, cle: getPlayerKey(p), mini: carteMiniHtml(p), saison: ligneDeSaison(p, statsDe(p)), vraie: ligneVraieSaison(p) })),
    titreSaison: !L ? 'La saison n\'a pas commencé.' : portee === 'jour' ? `Cette saison : jusqu'à la journée ${G.journee || 0}.` : 'Cette saison : les 82 matchs.',
    nCartes: L ? cartesAJouer(G.journee || 0) : 0,
    ouvrirCartes: () => {
      // En pleine saison : l'inventaire du hub, qui joue une carte comme décision du jour.
      if (hub && hub.cartes) { montrerPage('match'); hub.cartes(); return; }
      ouvrirInventaireJeu(null, null);
    },
    ficheEquipe: p => (L ? ouvrirFiche(p, L.you, portee === 'jour' ? 'jour' : 'saison') : showPlayerModal(p, { apercu: true })),
    fiche: (cle, p) => showPlayerModal(p, { apercu: true }),
    charger: s => getShard(s),
    mini: (p, rar) => miniAvecVariante(p, rar),
    cleDe: getPlayerKey,
    club: t => TEAMFULL[t] || t,
    vraie: ligneVraieSaison,
  });
}
/* L'alignement entre au cartable au départ d'une saison (une variante neuve compte, pas un doublon). */
const alignementAuCartable = () => ajouterAuCartable(signes().map(p => ({ cle: getPlayerKey(p), rar: varianteJoueur(p), num: (G.variantes.numeros || {})[getPlayerKey(p)] || null })), { doublons: false });

/*
 * L'ÉTAT VIDE : un onglet qui n'a encore rien à montrer dit pourquoi, et
 * offre ce qu'on peut faire maintenant. On ne cache pas un onglet parce qu'il
 * est vide — c'est ce qui faisait bouger la barre.
 */
function remplirVide(cle) {
  const titre = $('pageVideTitre'), corps = $('pageVideCorps');
  if (!titre || !corps) return;
  const o = ongletsCourants().find(x => x.cle === cle) || { titre: '', ico: 'i-cup' };
  titre.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#${o.ico}"/></svg>${esc(o.titre)}`;
  const bouton = (id, mot, go = false) => `<button type="button" class="btn ${go ? 'go' : 'gold'}" data-vide="${id}">${esc(mot)}</button>`;
  let msg = '', btns = '';
  const manque = totalCases() - signes().length;
  const QUOI = { classement: 'Le classement du jour', calendrier: 'Tes matchs, journée par journée,', meneurs: 'Les meneurs de la ligue' };
  if (enRepechage()) {
    if (cle === 'match') {
      msg = manque > 0
        ? `Ta formation n'est pas complète : il reste <b>${manque}</b> case${manque > 1 ? 's' : ''} à combler sous le plafond. La saison se lance d'ici dès que les ${totalCases()} sont signés.`
        : 'Ta formation est complète. La saison t\'attend.';
      btns = manque > 0
        ? bouton('repechage', MODE().loto ? 'Au loto' : 'Au vestiaire', true)
        : bouton('lancer', G.bonus === 'TABLE' ? 'Lancer le tournoi' : 'Lancer la saison', true);
    } else {
      msg = `La saison n'a pas commencé. ${QUOI[cle] || 'Tout ça'} s'affichera ici dès le premier match.`;
      btns = bouton('match', 'Au match');
    }
  } else if (G.banc) {
    msg = 'Tu es derrière le banc. La saison reprend là où tu l\'as laissée.';
    btns = bouton('reprendre', 'Retour au match', true);
  } else if (cle === 'repechage') {
    msg = 'Le repêchage est terminé : ta formation joue.';
    btns = bouton('match', 'Au match', true) + bouton('nouvelle', 'Nouvelle partie');
  } else if (cle === 'alignement' && hubActif()) {
    msg = 'Ton alignement est figé : on ne touche plus aux trios quand ça compte.';
    btns = bouton('match', 'Au match', true);
  } else if (cle === 'calendrier' && hubActif()) {
    msg = 'Le tournoi n\'a pas de calendrier à lui : ses journées se lisent sous le match.';
    btns = bouton('match', 'Au match', true);
  } else {
    msg = 'Rien à lire ici pour l\'instant.';
    btns = bouton('match', 'Au match', true);
  }
  corps.innerHTML = `<div class="vide"><p class="vide-mot">${msg}</p><div class="vide-btns">${btns}</div></div>`;
  corps.querySelectorAll('[data-vide]').forEach(b => {
    b.onclick = () => {
      const quoi = b.dataset.vide;
      if (quoi === 'lancer') $('mainBtn').click();
      else if (quoi === 'reprendre') reprendreSaison();
      else if (quoi === 'nouvelle') ouvrirNouvellePartie();
      else montrerPage(quoi);
    };
  });
}

function montrerPage(cle) {
  cle = ALIAS_PAGE[cle] || cle;
  if (!PAGES().includes(cle)) cle = 'match';
  const hub = hubActif();
  // DERRIÈRE LE BANC, les onglets de la saison y RAMÈNENT : la saison reprend
  // (même graine, même jour), puis l'onglet demandé s'ouvre.
  if (G.banc && PAGES_DE_SAISON.includes(cle)) { G.pageVoulue = cle; reprendreSaison(); return; }
  // EN PLEINE SAISON, L'ALIGNEMENT EST LE BANC : c'est là qu'on y touche.
  if (hub && cle === 'alignement' && hub.banc) { hub.banc(); return; }
  if (cle === 'repechage' && enRepechage()) setView('pool');
  else if (cle === 'alignement' && !bilanPret() && !hub) setView('roster');
  else {
    marquerPage(cle);
    if (document.body.dataset.zone === 'ref') {
      if (cle === 'historique') showLeaderboard();
      else if (cle === 'regles') remplirReglesDuPlateau();
      else if (cle === 'equipes') ouvrirEquipes({
        ctx: {
          esc, ico, logo: getTeamLogoHtml, band: getTeamBand, teamSeasonUrl,
          teamFull: t => TEAMFULL[t] || t,
          // La fiche d'un joueur de la ligue en cours ouvre ses statistiques
          // SIMULÉES, la vraie saison dessous. On y arrive aussi de derrière
          // le banc, en pleine saison, d'où `porteeRevele` : la fiche s'arrête
          // alors à la dernière journée révélée. Hors ligue, la vraie seule.
          fiche: (p, enLigue) => (enLigue ? ouvrirFiche(p, null, porteeRevele('saison')) : showPlayerModal(p, {})),
          statsSim,
        },
        saisons: (state.index.seasons || []).slice().reverse(),
        saison: G.epoque || (G.tirage[0] && G.tirage[0].season) || null,
        charger: getShard,
        // LA LIGUE EN COURS, si elle existe : ses clubs, avec leurs
        // alignements. Les objets joueurs y portent DÉJÀ leurs compteurs
        // simulés et leur vraie saison.
        ligue: () => (G.ligue && G.ligue.teams && G.ligue.teams.length > 1 ? G.ligue.teams : null),
      });
    }
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/*
 * L'ÉCRAN DE SAISON PRÉVIENT LA COQUILLE (js/coquille.js). Quand il change
 * de volet de lui-même, la barre suit ; quand il s'ouvre, il prend l'onglet
 * qu'on avait demandé de derrière le banc ; quand il se ferme, la page
 * courante se recalcule (le bilan, ou l'état vide).
 */
surCoquille(ev => {
  if (ev.type === 'vue') {
    if (G.pageVoulue) {
      const cible = G.pageVoulue;
      G.pageVoulue = null;
      if (voletPour(cible)) { marquerPage(cible); return; }
    }
    // Un volet que l'écran ouvre de lui-même ne déplace la barre que si on
    // regardait l'écran ; sinon on reste sur la page qu'on lisait.
    if (!ev.page) return;
    const ici = document.body.dataset.zone === 'hub' || !G.page || voletPour(G.page) === null
      ? ev.page : G.page;
    marquerPage(document.body.dataset.zone === 'hub' ? ev.page : ici);
    return;
  }
  if (ev.type === 'ferme') {
    document.body.classList.remove('hub-docke', 'hub-cache');
    marquerPage(G.page || 'match');
  }
});

function setView(view) {
  G.view = view;
  $('panes').dataset.view = view;
  marquerPage(view === 'roster' ? 'alignement' : 'repechage');
}

/* =====================================================================
   Roulette
   ===================================================================== */

/*
 * LA VRAIE SAISON RECRUE (S79, data/recrues.json, écrit par scripts/recrues.mjs).
 * JP : *je vois Crosby recrue avec stats de sa deuxième saison ?*. Le ruban
 * « Recrue » suivait le contrat d'entrée, qui dure jusqu'à trois saisons ; il
 * suit maintenant la saison recrue, une par joueur (`p.rk`). Le contrat
 * d'entrée garde son effet de jeu (« Le jeune progresse ») : rien ne se rejoue
 * autrement.
 */
let RECRUES = null;
async function chargerRecrues() {
  if (RECRUES) return RECRUES;
  try { const r = await fetch('data/recrues.json'); RECRUES = r.ok ? await r.json() : {}; } catch { RECRUES = {}; }
  return RECRUES;
}
const estRecrue = p => !!(p && p.rk);
async function getShard(label) {
  if (G.shards.has(label)) return G.shards.get(label);
  const shard = await loadSeason(label);
  const recrues = new Set((await chargerRecrues())[label] || []);
  const byTeam = {};
  for (const p of shard.players) {
    if (recrues.has(p.id)) p.rk = 1;
    if (isD(p) && (!p.np || p.np === 'D')) {
      p.np = (p.shootsCatches === 'R' || p.shoots === 'R') ? 'RD' : 'LD';
    }
    registerHiddenRatings(p);
    (byTeam[p.t] = byTeam[p.t] || []).push(p);
  }
  // Les deux mesures que la carte ne disait pas (défensive, robustesse),
  // rangées parmi les réguliers de la saison : voir `mesuresDeSaison`.
  const entry = { players: shard.players, byTeam, mesures: mesuresDeSaison(shard.players) };
  G.shards.set(label, entry);
  return entry;
}

/*
 * LA VARIANTE D'UNE CARTE DE JOUEUR (S78, js/rarete.js). JP : *pas par
 * joueur, mais par-dessus joueur, comme un shiny dans pokemon*. Elle ne lit ni
 * le salaire ni une cote : elle se tire de la graine de la partie et de la clé
 * du joueur — la même carte d'un rendu à l'autre et d'une reprise à l'autre —
 * sauf celle qu'un pack du mode Rogue a sortie (`G.variantes.cartes`).
 */
function graineVariantes() {
  if (!G.variantes.graine) G.variantes.graine = nouvelleGraine();
  return G.variantes.graine;
}
function varianteJoueur(p) {
  if (!p) return 'commune';
  // La carte posée pour la saison dit la vérité, lustre compris (l'atelier).
  if (p._carte && p._carte.rar) return p._carte.rar;
  const cle = getPlayerKey(p);
  return G.variantes.cartes[cle] || varianteTiree(COTES_VARIANTES, graineVariantes(), cle);
}
const rareteJoueur = varianteJoueur;
/* La carte d'un joueur : sa variante, son bonus tiré au hasard, et la recrue qui progresse. */
function carteJoueur(p) {
  const c = carteDe(varianteJoueur(p), groupeDe(p) === 'G', graineVariantes(), getPlayerKey(p));
  if (p.elc) c.recrue = true;
  return c;
}
/* Ce que la carte d'un joueur fait sur la glace, en mots (`traitsDeCarte`) : pour l'écran. */
const traitsJoueur = p => (p ? traitsDeCarte(p._carte || carteJoueur(p)) : []);
/*
 * L'ATELIER (S78) : le joueur qui reçoit une édition, choisi dans ton
 * alignement. Chaque rangée dit ce que l'édition lui ferait À CE JOUR — il
 * joue hors position, au-dessus de sa zone, il traîne un malus, sa carte
 * passe de holo à or — et celles qui ne lui feraient rien sont grisées. Les
 * utiles d'abord. Le deck (js/saison.js) et la boutique Rogue passent par ici.
 */
const VARIANTE_SUIVANTE = { commune: 'peu', peu: 'rare', rare: 'legendaire' };
/*
 * LES SOUS-SÉRIES (S78), comme dans une vraie collection : la RECRUE (son
 * contrat d'entrée) et l'ÉTOILE — les meilleurs de leur saison, lus dans
 * leurs VRAIES fiches, jamais dans une cote : le 4 % du haut des pointeurs
 * réguliers, le 8 % du haut des gardiens partants au pourcentage d'arrêts.
 * Une saison en cours (moins de matchs) abaisse le seuil de « régulier ».
 */
const SEUILS_ETOILE = new Map();
function estEtoile(p) {
  const e = p && p.s && G.shards.get(p.s);
  if (!e) return false;
  let s = SEUILS_ETOILE.get(p.s);
  if (!s) {
    const gpMax = Math.max(1, ...e.players.map(x => x.gp || 0));
    const minP = Math.min(40, Math.floor(gpMax * 0.5)), minG = Math.min(30, Math.floor(gpMax * 0.35));
    const pts = x => x.pt ?? ((x.g || 0) + (x.a || 0));
    const pat = e.players.filter(x => x.p !== 'G' && (x.gp || 0) >= minP).map(pts).sort((a, b) => b - a);
    const gar = e.players.filter(x => x.p === 'G' && (x.gp || 0) >= minG).map(x => x.sv || 0).sort((a, b) => b - a);
    s = { minP, minG, pts: pat.length ? pat[Math.max(0, Math.ceil(pat.length * 0.04) - 1)] : Infinity, sv: gar.length ? gar[Math.max(0, Math.ceil(gar.length * 0.08) - 1)] : Infinity };
    SEUILS_ETOILE.set(p.s, s);
  }
  return p.p === 'G' ? (p.gp || 0) >= s.minG && (p.sv || 0) >= s.sv
    : (p.gp || 0) >= s.minP && (p.pt ?? ((p.g || 0) + (p.a || 0))) >= s.pts;
}
/* Les classes de la carte : l'époque, la série, la sous-série. */
const classesDeCarte = p => `${dessinDe(p.s)}${estRecrue(p) ? ' ss-recrue' : ''}${estEtoile(p) ? ' ss-etoile' : ''}`;
/*
 * LA CARTE MINI (S78). JP : *versions normales et version mini, pour genre
 * les picks*. Le même dessin que la carte normale — l'époque, la série, la
 * sous-série, la variante, les couleurs du club — en petit : la photo, le
 * nom, et UNE ligne (le chiffre clé et le salaire). Elle sert aux choix d'un
 * joueur (pack, ballottage, recrue, garder, nouveau rôle), où trois cartes
 * se comparent côte à côte ; la fiche reste la version complète.
 */
function carteMiniHtml(p) {
  const rarete = rareteJoueur(p);
  const band = getTeamBand(p.t);
  const st = displayStats(p);
  const cle = p.p === 'G' ? `${st.w}<small>V</small>` : `${st.pt}<small>PTS</small>`;
  return `<span class="cj-recto cj-mini-carte ${classesDeCarte(p)} tc-${rarete}" style="--team-logo:${logoFiligrane(p.t)};--team-band:${band.bg};--team-ink:${band.ink};--team-stripe:${band.stripe};--team-fond:${fondEquipe(p.t) || ''};--team-line:${couleurVive(p.t)}">
    <span class="cj-fenetre">
      <span class="cj-filigrane" aria-hidden="true"></span>
      ${brille(rarete) ? '<span class="cj-holo" aria-hidden="true"></span>' : ''}
      ${headshotHtml(p)}
      <span class="cj-dessus" aria-hidden="true"></span>
      <span class="cj-rondelle ${positionClass(p)}">${esc(positionLabel(p))}</span>
      <span class="cj-coin-logo">${getTeamLogoHtml(p.t, 18)}</span>
      <span class="cj-annee">${esc(anneeDeCarte(p.s))}</span>
      ${rubanDe(p)}
    </span>
    <span class="cj-bandeau"><span class="pcard-full-name">${formatName(p.n)}</span></span>
    <span class="cjm-ligne"><b>${cle}</b><span>${st.salaryMain}</span></span>
  </span>`;
}
/*
 * SES CARTES (S78). JP : *pour les cartes, ajouter section au verso ou
 * ajouter les cartes de modifs de joueurs*. Ce qu'on a joué SUR lui cette
 * saison — l'atelier, une amélioration, un nouveau rôle — et ce que le hasard
 * lui a fait (un accident de carte), dans l'ordre, chacune avec son effet en
 * chiffres. Seulement ce qui est DÉJÀ arrivé : le moteur joue la saison
 * d'avance (`p._mutCles` porte la fin de l'année), et un accident de la
 * journée 55 ne se lit pas à la journée 20. Sans saison (le repêchage), rien :
 * un joueur n'a pas encore de carte jouée sur lui.
 */
const SOURCE_MOD = { atelier: 'L\'atelier', amelioration: 'Amélioration', choix: 'Nouveau rôle', accident: 'Le hasard' };
function modsDuJoueur(p) {
  const t = G.ligue && G.ligue.you;
  if (!p || !t || !Array.isArray(t.mutations)) return null;
  const cle = getPlayerKey(p);
  const jusqua = porteeRevele('saison') === 'jour' ? (G.journee || 0) : Infinity;
  return t.mutations.filter(m => m.joueur === cle && m.jour < jusqua && MUTATIONS[m.cle]);
}
const clesDesMods = p => (modsDuJoueur(p) || []).map(m => m.cle);
function sectionMods(p) {
  const mods = modsDuJoueur(p);
  // Seulement un joueur de TON équipe (un adversaire n'a pas de cartes jouées par toi).
  if (!mods || !Object.values(G.roster || {}).some(x => x && getPlayerKey(x) === getPlayerKey(p))) return '';
  // Un malus que le physio a effacé depuis se lit barré.
  const physio = Math.max(-1, ...mods.filter(m => m.cle === 'physio').map(m => m.jour));
  const items = mods.map(m => {
    const M = MUTATIONS[m.cle];
    const efface = m.jour < physio && mutationNuit(m.cle);
    const effets = motsDeMutation(m.cle).map(x => `<span class="${x.bon ? 'bon' : 'prix'}">${esc(x.txt)}</span>`).join('');
    return `<div class="fc-mod src-${M.source}${efface ? ' efface' : ''}" title="${esc(M.quoi)}">
      <span class="fc-mod-ico" aria-hidden="true">${M.ico}</span>
      <span class="fc-mod-txt"><span class="fc-mod-tete"><b>${esc(M.nom)}</b><small>${esc(SOURCE_MOD[M.source] || 'Carte')} · J${m.jour + 1}${efface ? ' · effacé par le physio' : ''}</small></span>
      ${effets ? `<span class="fc-mod-effets">${effets}</span>` : ''}</span>
    </div>`;
  }).join('');
  return `<div class="fc-sec">Ses cartes${mods.length ? ` · ${mods.length}` : ''}</div>
    <div class="fc-mods">${items || '<p class="fc-mods-vide">Aucune carte jouée sur lui cette saison.</p>'}</div>`;
}
/*
 * QUI SORT ? (S78). JP : *choisir qui swap si nouveau joueur, pas swap
 * automatique*. Un joueur qui arrive (pack, ballottage, recrue) ne remplace
 * plus d'office le réserviste de sa position : on choisit, parmi les cases
 * qu'il peut jouer, qui lui laisse sa place — les réservistes d'abord, puis
 * les autres, avec leur visage, et ce que la case lui coûterait (hors
 * position). Rend `{ i, sort }` pour la décision de ballottage.
 */
function choisirQuiSort(p, { roster, onChoix, onFerme, genre = '', bloque = null, note = null }) {
  const cases = SLOTS.filter(sl => roster && roster[sl.i] && fits(p, sl))
    .sort((a, b) => (b.scratch ? 1 : 0) - (a.scratch ? 1 : 0) || a.i - b.i);
  const nomDe = n => String(n).split(' ').slice(-1)[0];
  ouvrirChoix({
    ico: '🔁', titre: `${p.n} arrive : qui sort ?`, compact: true, fermable: true, motFermer: 'Retour', genre,
    recit: `${p.n} prend la case de celui qui sort ; celui-là quitte l'équipe. Tu choisis.`,
    options: cases.map(sl => {
      const q = roster[sl.i];
      const pen = getPositionPenalty(p, sl);
      return { cle: String(sl.i), visage: headshotHtml(q), nom: q.n,
        sous: [quiEst(q), pen ? `${nomDe(p.n)} y jouerait hors position (−${pen})` : '', note ? note(q) : ''].filter(Boolean).join(' · '),
        // S79 : la sortie que le plafond refuse reste visible, avec sa raison.
        desactive: bloque ? bloque(q) : '' };
    }),
    onChoix: k => { const sl = SLOTS[Number(k)]; if (sl && roster[sl.i] && !(bloque && bloque(roster[sl.i]))) onChoix({ i: sl.i, sort: getPlayerKey(roster[sl.i]) }); },
    onFerme,
  });
}
/* La fiche d'un joueur offert, en aperçu. */
const apercuJoueur = p => showPlayerModal(p, { apercu: true });
/* La ligne d'un joueur offert : ce que la carte mini ne dit pas (elle dit déjà les points, ou les victoires). */
const ligneDuChoix = p => (p.p === 'G'
  ? `${p.gp} PJ · ${p.l ?? 0} D · ${(p.sv || 0).toFixed(3).replace(/^0/, '')}`
  : `${p.gp} PJ · ${p.g} B · ${p.a} A`);
/*
 * L'écusson du club en filigrane derrière un portrait détouré (img/logos, S78).
 * Des guillemets SIMPLES (S79) : la valeur entre aussi dans un attribut
 * `style="…"` (la mini, la fiche), où un guillemet double fermait l'attribut —
 * toutes les couleurs du club qui suivaient tombaient, et la carte sortait grise.
 */
const logoFiligrane = t => (LOGOS_LOCAUX.has(t) ? `url('img/logos/${t}.svg')` : 'none');
/*
 * LE RUBAN DE LA SOUS-SÉRIE, au bas de la photo : « ★ Étoile », « Recrue »,
 * ou les deux. Il remplace le tampon « Recrue » d'avant — et garde son
 * infobulle (ce que la recrue gagne en faisant ses classes).
 */
function rubanDe(p) {
  const etoile = estEtoile(p);
  const rk = estRecrue(p);
  if (!rk && !etoile) return '';
  const recrue = rk && p.elc ? traitsJoueur(p).find(t => t.nom === 'Le jeune progresse') : null;
  const titre = [etoile ? 'Étoile : parmi les meilleurs de sa vraie saison' : '', recrue ? `${recrue.ico} ${recrue.nom} — ${recrue.mot}` : ''].filter(Boolean).join(' · ');
  return `<span class="cj-ruban${etoile ? ' etoile' : ''}${rk ? ' recrue' : ''}" title="${esc([rk ? 'Recrue : sa première saison dans la LNH' : '', titre].filter(Boolean).join(' · '))}">${etoile ? '★ ' : ''}${rk ? 'Recrue' : 'Étoile'}${etoile && rk ? ' ★' : ''}</span>`;
}
function ouvrirAtelier(cle, { jour, you, onChoix, onFerme, suite = {} }) {
  const M = MUTATIONS[cle];
  if (!M || !you) return;
  // Les malus DÉJÀ arrivés (le moteur a joué la saison d'avance), depuis le dernier passage du physio.
  const malus = p => {
    const k = getPlayerKey(p), siens = (you.mutations || []).filter(m => m.joueur === k && m.jour < jour);
    const physio = Math.max(-1, ...siens.filter(m => m.cle === 'physio').map(m => m.jour));
    return siens.filter(m => m.jour >= physio && m.cle !== 'physio' && mutationNuit(m.cle)).map(m => MUTATIONS[m.cle]);
  };
  const rangs = SLOTS.filter(sl => !sl.scratch).map(sl => ({ sl, p: you.roster[sl.i] })).filter(x => x.p).map(({ sl, p }) => {
    const g = p.p === 'G';
    let sous = '', desactive = '', utile = false, extra = {};
    if (cle === 'partout') {
      if (g) desactive = 'Un gardien garde les buts';
      else if (p._partout) desactive = 'Il joue déjà partout';
      else { utile = getPositionPenalty(p, sl) > 0; sous = utile ? 'joue hors position en ce moment' : 'à sa position en ce moment'; }
    } else if (cle === 'cran') {
      if (g) desactive = 'Un gardien n\'a pas de trio';
      else { utile = zoneEcart(p, sl) === 'dessus'; sous = `${getLineZone(p, getHiddenRatings(p).v).short}${utile ? ' · au-dessus de sa zone ici' : ''}`; }
    } else if (cle === 'physio') {
      const ms = malus(p);
      if (!ms.length) desactive = 'Aucun malus';
      else { utile = true; sous = ms.map(x => `${x.ico} ${x.nom}`).join(' · '); }
    } else if (cle === 'lustre') {
      const r = varianteJoueur(p), n = VARIANTE_SUIVANTE[r];
      if (!n) desactive = 'Sa carte est déjà en or';
      else {
        const carte = carteDe(n, g, graineVariantes(), getPlayerKey(p));
        extra = { carte: { rar: carte.rar, bonus: carte.bonus } }; utile = true;
        sous = `${NOM_VARIANTE[r]} → ${NOM_VARIANTE[n]} : ${traitsDeCarte(carte).map(b => `${b.ico} ${b.nom}`).join(' + ')}`;
      }
    }
    return { sl, p, sous, desactive, utile, extra };
  }).sort((a, b) => (a.desactive ? 1 : 0) - (b.desactive ? 1 : 0) || (b.utile ? 1 : 0) - (a.utile ? 1 : 0));
  ouvrirChoix({
    fermable: true, motFermer: 'Retour', ...suite, cartes: false, compact: true, ico: M.ico, titre: `${M.nom} : à qui ?`,
    recit: `${M.quoi} C'est pour le reste de la saison.`,
    options: rangs.map(x => ({ cle: getPlayerKey(x.p), ico: '', nom: x.p.n, sous: [quiEst(x.p, { stats: false }), x.sous].filter(Boolean).join(' · '), desactive: x.desactive })),
    onChoix: k => { const x = rangs.find(y => getPlayerKey(y.p) === k); if (x && !x.desactive) onChoix({ cle, joueur: k, ...x.extra }); },
    onFerme,
  });
}
/*
 * LES CARTES QUI JOUENT (S78) : celles de TON alignement, et de ceux qui y
 * entreront en cours de saison (ballottage, recrue, pack). Les clubs
 * adverses jouent leurs joueurs, pas des cartes : on retire celles d'avant.
 */
const CARTES_POSEES = new Set();
function poserCartes(decisions = []) {
  for (const p of CARTES_POSEES) delete p._carte;
  CARTES_POSEES.clear();
  const miens = Object.values(G.roster || {}).filter(Boolean);
  for (const d of decisions) {
    const b = d && d.ballottage;
    if (!b || !b.entre) continue;
    if (b.rar) G.variantes.cartes[b.entre] = b.rar;
    const p = ballottageVu.get(b.entre);
    if (p) miens.push(p);
  }
  for (const p of miens) { p._carte = carteJoueur(p); CARTES_POSEES.add(p); }
}
/*
 * LES BRILLANTES DÉJÀ VUES (S78) : l'éclat d'une variante brillante (« ✦ »)
 * ne part qu'à sa PREMIÈRE apparition au vestiaire — le bassin se redessine à
 * chaque geste, et un éclat qui repart à chaque toucher n'est plus un
 * événement. Rien à sauvegarder : au pire, un rechargement le rejoue une fois.
 */
const VARIANTES_VUES = new Set();

/** La défensive et la robustesse mesurées d'un joueur, ou null (gardien, moins de 20 matchs). */
function mesure(p) {
  const entry = p && G.shards.get(p.s);
  return (entry && entry.mesures && entry.mesures.get(p)) || null;
}

/*
 * 🛡️ Défensif, 🪨 Robuste : les étiquettes de ce que le joueur a fait sans la
 * rondelle, au 85e centile des réguliers de sa saison et de sa position. Elles
 * sont sur la carte pour qu'un bâti défensif ou robuste se trouve sans ouvrir
 * chaque fiche ; la fiche donne les colonnes derrière.
 */
/* L'IDENTITÉ DE DÉPART (S73) : pendant le repêchage, un joueur qui y colle porte son icône. */
function identiteTag(p, full = false) {
  const I = identite() && enRepechage() && scoreIdentite(identite(), p) >= SEUIL_IDENTITE ? IDENTITES[identite()] : null;
  return I ? `<span class="tag tag-identite" title="Colle à ton identité : ${esc(I.nom)}">${I.ico}${full ? ` ${esc(I.nom)}` : ''}</span>` : '';
}
/* `deja` : le texte des rôles que la fiche affiche à côté (S78) — une étiquette
   « Défensif » ne se répète pas sous un rôle « Défensif · bon ». */
function mesureTags(p, full = false, deja = '') {
  const tagI = identiteTag(p, full);
  const m = mesure(p);
  if (!m) return tagI;
  const tags = tagI ? [tagI] : [];
  if (m.def != null && m.def >= SEUIL_MESURE && !/Défensif/.test(deja)) tags.push(`<span class="tag tag-mesure" title="Défensif — ${Math.round(m.def * 100)}e centile des réguliers de ${esc(p.s)} à sa position : différentiel corrigé de son club, points en désavantage, temps de glace.">🧊${full ? ' Défensif' : ''}</span>`);
  if (m.rob != null && m.rob >= SEUIL_MESURE) tags.push(`<span class="tag tag-mesure" title="Robuste — ${Math.round(m.rob * 100)}e centile des réguliers de ${esc(p.s)} à sa position : minutes de punition et mises en échec. Il pèse les soirs éreintants et en séries.">🪨${full ? ' Robuste' : ''}</span>`);
  return tags.join('');
}

/* L'identité choisie, en une puce dans la roulette : ce qu'elle oriente se lit au survol. */
const identitePuce = () => (identite() ? `<span class="spin-identite" title="${esc(IDENTITES[identite()].texte)}">${IDENTITES[identite()].ico} ${esc(IDENTITES[identite()].nom)}</span>` : '');

/**
 * Un vestiaire au hasard : une saison, une équipe qui a de quoi s'aligner,
 * jamais un club déjà dans `deja` (le tirage précédent, ou les deux autres
 * clubs du même loto).
 */
async function vestiaireAuHasard(deja) {
  const seasons = state.index.seasons;
  const fr = franchiseDuTirage();
  for (let essai = 0; essai < 12; essai++) {
    const season = fr ? saisonDeFranchise(fr) : (epoqueDuTirage() || rnd(seasons));
    let shard;
    try { shard = await getShard(season); } catch { continue; }
    const teams = Object.keys(shard.byTeam)
      .filter(t => shard.byTeam[t].length >= 8 && !deja.has(`${season}_${t}`) && (!fr || t === codeDeFranchise(fr, season)));
    if (!teams.length) continue;
    const team = rnd(teams);
    return { season, team, pool: shard.byTeam[team] };
  }
  return null;
}

/**
 * LA ROULETTE TOURNE.
 *
 * En VESTIAIRE (le jeu d'origine) : une saison et une équipe au hasard ;
 * `newSeason` et `newTeam` disent ce qu'une relance garde — « autre année »
 * change la saison et l'équipe, « autre équipe » garde la saison. Le club
 * doit avoir au moins un joueur plaçable ; le budget, c'est aux relances et
 * à la bande de secours de s'en occuper, comme avant.
 *
 * En LOTO : trois clubs, et la main doit contenir au moins un joueur qui a
 * une case et qui tient dans le budget du choix — vingt essais sur ce
 * critère, puis sous le plafond restant, puis plaçable.
 */
async function nextSpin(newSeason = true, newTeam = true) {
  G.loading = true;
  G.selectedSlot = null;
  renderSpin();

  const besoin = nextNeed();
  const seasons = state.index.seasons;

  if (!MODE().loto) {
    const cur = vestiaire();
    const fr = franchiseDuTirage();
    for (let attempt = 0; attempt < 25 && besoin; attempt++) {
      // UNE FRANCHISE : chaque tour sort une AUTRE saison de son histoire.
      const season = fr ? saisonDeFranchise(fr, cur && cur.season) : (epoqueDuTirage() || ((!newSeason && cur) ? cur.season : rnd(seasons)));
      let shard;
      try { shard = await getShard(season); } catch { continue; }

      let teams = Object.keys(shard.byTeam).filter(t => shard.byTeam[t].length >= 8);
      if (fr) {
        teams = teams.filter(t => t === codeDeFranchise(fr, season));
      } else if (!newTeam && cur && shard.byTeam[cur.team]?.length >= 8) {
        teams = [cur.team];
      } else if (cur) {
        teams = teams.filter(t => !(season === cur.season && t === cur.team));
      }
      if (!teams.length) continue;

      let team = rnd(teams);
      // L'IDENTITÉ : un deuxième club de la même saison, et on garde celui qui colle le mieux.
      if (identite() && teams.length > 1) {
        const autre = rnd(teams.filter(t => t !== team));
        if (scoreDuVestiaire(shard.byTeam[autre]) > scoreDuVestiaire(shard.byTeam[team])) team = autre;
      }
      const pool = shard.byTeam[team];
      if (!pool.some(p => !isPicked(p) && openSlots(p).length)) continue;

      G.tirage = [{ season, team, pool }];
      break;
    }
    G.loading = false;
    applyTeamColors(vestiaire()?.team);
    saveGame();
    if (!epoqueDuTirage()) prefetch([rnd(seasons), rnd(seasons)]);
    return;
  }

  const n = 3;
  const avant = new Set(G.tirage.map(v => `${v.season}_${v.team}`));
  let dernier = null;

  // Une petite franchise (le Kraken, cinq saisons) ne peut pas toujours
  // sortir trois clubs neufs : elle peut reprendre ceux du tour d'avant.
  const petite = franchiseDuTirage() && saisonsDeFranchise(franchiseDuTirage(), state.index.seasons).length < 8;
  for (let attempt = 0; attempt < 30 && besoin; attempt++) {
    const deja = new Set(petite ? [] : avant);
    const tirage = [];
    for (let k = 0; k < n; k++) {
      let v = await vestiaireAuHasard(deja);
      if (!v) break;
      // L'IDENTITÉ : un deuxième club, et on garde celui dont le joueur offert colle le mieux.
      if (identite()) {
        const autre = await vestiaireAuHasard(new Set([...deja, `${v.season}_${v.team}`]));
        if (autre && scoreDeLaMain(autre) > scoreDeLaMain(v)) v = autre;
      }
      deja.add(`${v.season}_${v.team}`);
      tirage.push(v);
    }
    if (tirage.length < n) continue;

    G.tirage = tirage;
    const main = candidats().filter(p => !isPicked(p) && openSlots(p).length);
    if (!main.length) continue;
    dernier = tirage;
    const plafond = attempt < 20 ? maxForPick() : attempt < 26 ? capLeft() : Infinity;
    if (!main.some(p => p.$ <= plafond)) continue;
    break;
  }

  if (dernier) G.tirage = dernier;
  G.loading = false;
  applyTeamColors(null);
  saveGame();
  if (!epoqueDuTirage()) prefetch([rnd(seasons), rnd(seasons)]);
}

/* =====================================================================
   Rendu — plafond, roulette, tableau de bord
   ===================================================================== */

function renderCap() {
  if (G.bonus === 'ROGUE') { renderJetons(); return; }
  const lbl = $('capGauge') && $('capGauge').querySelector('.capgauge-label');
  if (lbl) lbl.textContent = 'Plafond restant';
  const used = capUsed(), rem = capLeft(), left = slotsLeft();
  const isEra = G.salaryMode === 'ERA';
  const season = vestiaire()?.season || '2025-26';
  const eraCap = SEASON_ERA_CAP[season] || CAP;

  const amt = $('capAmt');
  amt.textContent = isEra ? money(getEraSalary(rem, season)) : money(rem);

  // Serré quand il reste moins de 1,5 M$ par case à combler
  const tight = left > 0 && rem < left * 1_500_000;
  amt.classList.toggle('over', rem < 0);
  amt.classList.toggle('tight', rem >= 0 && tight);

  $('capMaxLbl').textContent = isEra ? `/ ${money(eraCap)} (${season})` : `/ ${money(MODE().cap)}`;
  // Le `title` était écrit en dur à 95,5 M$ dans le HTML : il mentait en Express.
  $('capGauge').title = `Plafond salarial de ${money(MODE().cap)} (valeur 2026)`;

  const fill = $('capFill');
  fill.style.width = Math.min(100, Math.max(0, (used / MODE().cap) * 100)) + '%';
  fill.classList.toggle('over', rem < 0);
  fill.classList.toggle('tight', rem >= 0 && tight);

  // Repère : masse salariale « au rythme » pour 23 joueurs
  const marker = $('capMarker');
  if (marker) marker.style.left = Math.min(100, (signes().length / totalCases()) * 100) + '%';

  $('cnt').textContent = `${signes().length} / ${totalCases()}`;

  const perSlot = $('perSlotLbl');
  if (perSlot) {
    perSlot.textContent = left > 0
      ? `${money(rem / left)} / case`
      : (rem >= 0 ? 'Sous le plafond ✓' : 'Plafond dépassé');
    perSlot.className = left === 0 && rem < 0 ? 'dash-bad' : '';
  }
}

function renderSpin() {
  const host = $('spin');
  if (!host) return;

  if (G.loading || !G.tirage.length) {
    host.innerHTML = `<div class="spin-card"><div class="spin-top">
      <div class="spin-logo">${ico('i-dice')}</div>
      <div class="spin-id"><div class="spin-name">La roulette tourne…</div>
      <div class="spin-full">Chargement du vestiaire</div></div></div></div>`;
    return;
  }

  const need = nextNeed();
  const c = caseCourante();
  const targetSlot = G.target !== null ? SLOTS[G.target] : null;
  const instruction = targetSlot
    ? `${ico('i-target')} Case ciblée : <span class="target-on">${esc(slotShort(targetSlot))}</span> — touche-la à nouveau pour annuler.`
    : need ? ''
      : `Alignement complet : permute tes joueurs ou simule.`;

  if (MODE().loto) {
    // TROIS CLUBS, UN CHOIX. La carte porte la case qu'on comble en gros —
    // c'est elle qu'on décide — et les trois clubs en pastilles, chacune
    // vers sa vraie saison sur Hockey-Reference. Les cartes de la main
    // portent déjà chacune la couleur de leur vestiaire.
    const clubs = G.tirage.map(v => {
      const url = teamSeasonUrl(v.team, v.season);
      const dead = DEFUNCT.has(v.team) ? ' spin-club-dead' : '';
      const inner = `${getTeamLogoHtml(v.team, 18)}<span class="spin-club-code">${esc(v.team)}</span><span class="spin-club-season">${esc(v.season)}</span>`;
      return url
        ? `<a class="spin-club${dead}" href="${url}" target="_blank" rel="noopener" title="${esc(TEAMFULL[v.team] || v.team)} ${esc(v.season)} sur Hockey-Reference">${inner}</a>`
        : `<span class="spin-club${dead}">${inner}</span>`;
    }).join('');
    host.innerHTML = `
      <div class="spin-card spin-loto">
        <div class="spin-top">
          <div class="spin-logo">${ico('i-dice')}</div>
          <div class="spin-id">
            <div class="spin-kicker"><span class="spin-code">Loto</span><span class="spin-season">${G.tirage.length} clubs</span>${identitePuce()}</div>
            <div class="spin-name">${c ? esc(slotShort(c)) : 'Alignement complet'}</div>
          </div>
        </div>
        <div class="spin-clubs">${clubs}</div>
        ${instruction ? `<div class="spin-instruction">${instruction}</div>` : ''}
        <div class="rerolls">
          <button id="rrL" class="reroll" ${G.relances > 0 && need ? '' : 'disabled'} title="Relancer les trois clubs d'un coup">
            <span class="rr-lbl">${ico('i-dice')}Relancer les trois</span><span class="rr-count">${G.relances}</span></button>
        </div>
      </div>`;
    ajusterCartes(host);
    $('rrL').onclick = async () => {
      if (G.relances <= 0 || !need) return;
      G.relances--;
      await nextSpin();
      render();
    };
    return;
  }

  // UN CLUB, TOUT SON VESTIAIRE — le jeu d'origine. La carte se lit comme
  // une carte de pointage : le code et l'année en surtitre, le NOM de
  // l'équipe en gros, l'écusson en filigrane, et les trois relances en pied.
  // Le lien mène à la vraie saison de ce club sur Hockey-Reference.
  const v = vestiaire();
  const full = TEAMFULL[v.team] || v.team;
  const dead = DEFUNCT.has(v.team) ? ` <span class="spin-dead">· disparue</span>` : '';
  const url = teamSeasonUrl(v.team, v.season);
  host.innerHTML = `
    <div class="spin-card">
      <div class="spin-top">
        <!-- L'écusson fantôme vit DANS le bandeau, pas derrière tout le bloc :
             c'est le grand logo en filigrane d'un bandeau de diffusion. -->
        <div class="spin-watermark" aria-hidden="true">${getTeamLogoHtml(v.team, 150)}</div>
        <div class="spin-logo">${getTeamLogoHtml(v.team, 40)}</div>
        <div class="spin-id">
          <div class="spin-kicker"><span class="spin-code">${esc(v.team)}</span><span class="spin-season">${esc(v.season)}</span>${dead}${identitePuce()}</div>
          <div class="spin-name">${esc(full)}</div>
        </div>
        ${url ? `<a class="spin-ext" href="${url}" target="_blank" rel="noopener" title="La saison ${esc(v.season)} de cette équipe sur Hockey-Reference">${ico('i-ext')}</a>` : ''}
      </div>
      ${instruction ? `<div class="spin-instruction">${instruction}</div>` : ''}
      <div class="rerolls">
        <button id="rrS" class="reroll" ${G.left.season && need && !epoqueDuTirage() ? '' : 'disabled'} title="${epoqueDuTirage() ? `Le repêchage est fixé à ${esc(G.epoque)} : pas d'autre année` : 'Retirer une autre saison au hasard'}">
          <span class="rr-lbl">${ico('i-dice')}Autre année</span><span class="rr-count">${G.left.season}</span></button>
        <button id="rrT" class="reroll" ${G.left.team && need && !franchiseDuTirage() ? '' : 'disabled'} title="${franchiseDuTirage() ? `Le repêchage est fixé à la franchise : ${esc(FRANCHISES[G.franchise].nom)}` : 'Garder la saison, changer d\'équipe'}">
          <span class="rr-lbl">${ico('i-swap')}Autre équipe</span><span class="rr-count">${G.left.team}</span></button>
        <button id="rrP" class="reroll" ${G.left.pass && need ? '' : 'disabled'} title="Passer ce vestiaire au complet">
          <span class="rr-lbl">${ico('i-skip')}Passer</span><span class="rr-count">${G.left.pass}</span></button>
      </div>
    </div>`;

  const reroll = async (kind, ns, nt) => {
    if (!G.left[kind] || !need) return;
    G.left[kind]--;
    await nextSpin(ns, nt);
    render();
  };
  ajusterCartes(host);
  $('rrS').onclick = () => reroll('season', true, false);
  $('rrT').onclick = () => reroll('team', false, true);
  $('rrP').onclick = () => reroll('pass', true, true);
}

/*
 * UNE CASE SE NOMME PAR SON RANG, PAS PAR SA ZONE. « Top 6 · C » désignait
 * aussi bien le premier trio que le deuxième — Lemieux allait « au Top 6 »
 * et on ne savait pas lequel. « 2e trio · C » le dit. La zone reste sur la
 * pastille du joueur, là où elle sert à décider.
 */
const uniteNom = s => !s ? '' : s.scratch ? 'Réserve' : s.group === 'G' ? 'Gardiens'
  : s.group === 'D' ? UNIT_NAMES_D[s.unit] : UNIT_NAMES_F[s.unit];
const slotShort = s => s ? `${uniteNom(s)} · ${s.role}` : '—';

function renderDash() {
  const host = $('dash');
  if (!host) return;

  const left = slotsLeft(), rem = capLeft();
  const maxPick = maxForPick();
  const need = caseCourante();
  const pool = candidats();
  const affordable = pool.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= rem).length;
  const safe = pool.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= maxPick).length;

  const budgetCls = left === 0 ? (rem >= 0 ? 'dash-good' : 'dash-bad')
    : maxPick < MIN_SAL ? 'dash-bad'
    : maxPick < 2_000_000 ? 'dash-warn' : '';
  const poolCls = affordable === 0 && left > 0 ? 'dash-bad' : safe === 0 ? 'dash-warn' : '';

  // Les explications vivent dans l'infobulle et dans les règles : le tableau
  // de bord ne montre que le chiffre qui sert à trancher.
  const needTitle = need
    ? (MODE().loto
      ? `Case qu'on comble : ${slotShort(need)}. Le loto, c'est le joueur que trois clubs mettent à cette case exacte. Touche une autre case vide dans l'alignement pour la viser à la place : les mêmes clubs te tendent leur joueur de cette case.`
      : `Prochaine case libre de l'alignement : ${slotShort(need)}. Touche une autre case dans l'alignement pour la viser à la place.`)
    : `Les ${totalCases()} cases sont comblées.`;
  const budgetTitle = left === 0
    ? (rem >= 0 ? `Masse salariale : ${money(capUsed())}, sous le plafond de ${money(MODE().cap)}.` : `Tu dépasses le plafond de ${money(-rem)} : retire un joueur.`)
    : `Le maximum que tu peux mettre sur ce joueur-ci en gardant de quoi combler les ${left - 1} case${left - 1 > 1 ? 's' : ''} suivantes au salaire plancher de ${money(MIN_SAL)}. Il te reste ${money(rem)} pour ${left} cases.`;
  const poolTitle = `${safe} joueur${safe > 1 ? 's' : ''} de ${MODE().loto ? 'cette main' : 'ce vestiaire'} tiennent dans le budget du prochain choix, ${affordable} sous le plafond restant, ${pool.length} au total.`
    + (MODE().loto ? ` Relances : ${G.relances}.` : ` Relances : ${G.left.season} année${G.left.season > 1 ? 's' : ''}, ${G.left.team} équipe${G.left.team > 1 ? 's' : ''}, ${G.left.pass} passe${G.left.pass > 1 ? 's' : ''}.`);

  host.innerHTML = `
    <div class="dash-card" title="${esc(needTitle)}">
      <h3>À combler</h3>
      <div class="dash-big sm">${need ? esc(slotShort(need)) : 'Complet'}</div>
    </div>
    <div class="dash-card" title="${esc(budgetTitle)}">
      <h3>Budget <span class="h3-long">du choix</span></h3>
      <div class="dash-big ${budgetCls}">${left ? money(Math.max(0, maxPick)) : money(rem)}</div>
    </div>
    <div class="dash-card" title="${esc(poolTitle)}">
      <h3>${MODE().loto ? '<span class="h3-long">Cette </span>main' : '<span class="h3-long">Ce </span>vestiaire'}</h3>
      <div class="dash-big ${poolCls}">${safe}<span class="dash-unit">signables</span></div>
    </div>
    ${G.renfort ? `<div class="dash-card" title="Les dix-sept autres cases sont comblées par cette vraie équipe. Elles ne coûtent rien au plafond et ne se modifient pas.">
      <h3>Renfort</h3>
      <div class="dash-big sm">${getTeamLogoHtml(G.renfort.team, 15)} ${esc(G.renfort.team)} <span class="dash-unit">${esc(G.renfort.season)}</span></div>
    </div>` : ''}`;
}

/* =====================================================================
   Rendu — bassin
   ===================================================================== */

/* Besoins par position (réservistes exclus) */
const POS_NEED = [
  { key: 'AG', label: 'AG', role: 'AG', req: 4 },
  { key: 'C', label: 'C', role: 'C', req: 4 },
  { key: 'AD', label: 'AD', role: 'AD', req: 4 },
  { key: 'LD', label: 'DG', role: 'DG', req: 3 },
  { key: 'RD', label: 'DD', role: 'DD', req: 3 },
  { key: 'G', label: 'G', group: 'G', req: 2 },
];

function signedCount(def) {
  return SLOTS.filter(s => !s.scratch && G.roster[s.i] &&
    (def.group ? s.group === def.group : s.role === def.role)).length;
}

/** Valeur de tri « points par million », utile pour repérer les aubaines. */
const valuePerM = p => ((p.p === 'G' ? (p.w ?? 0) * 2.4 : (p.pt || 0)) / Math.max(0.775, p.$ / 1e6));

function renderFilters() {
  const host = $('filters');
  if (!host) return;
  /*
   * TOUJOURS AG, C, AD, DG, DD, G — le même ordre et les mêmes sigles que les
   * colonnes du bassin, les rangées du tableau de profondeur et les bandeaux
   * de carte. Les pastilles disaient « Centres » avant « Ailiers G. », donc
   * dans un ordre qui n'était celui de rien d'autre dans le jeu, et les
   * libellés longs débordaient la rangée à 390 px : on ne voyait plus les
   * gardiens. Le mot complet reste dans l'infobulle.
   */
  const defs = [
    ['ALL', 'Tous', 'Tout le vestiaire', null],
    ['AG', 'AG', 'Ailiers gauches', POS_NEED[0]],
    ['C', 'C', 'Centres', POS_NEED[1]],
    ['AD', 'AD', 'Ailiers droits', POS_NEED[2]],
    ['LD', 'DG', 'Défenseurs gauches', POS_NEED[3]],
    ['RD', 'DD', 'Défenseurs droits', POS_NEED[4]],
    ['G', 'G', 'Gardiens', POS_NEED[5]],
  ];
  host.innerHTML = defs.map(([key, label, titre, def]) => {
    let badge = '';
    if (key === 'ALL') {
      badge = `<span class="chip-need${slotsLeft() === 0 ? ' full' : ''}">${signes().length}/${totalCases()}</span>`;
    } else if (def) {
      const n = signedCount(def);
      badge = `<span class="chip-need${n >= def.req ? ' full' : ''}">${n}/${def.req}</span>`;
    }
    return `<button class="chip${G.filter === key ? ' on' : ''}" data-f="${key}" role="tab"`
      + ` title="${esc(titre)}" aria-label="${esc(titre)}" aria-selected="${G.filter === key}">${esc(label)}${badge}</button>`;
  }).join('');

  host.querySelectorAll('.chip').forEach(b => {
    b.onclick = () => { G.filter = b.dataset.f; renderFilters(); renderPool(); renderPoolMeta(); };
  });
}

/*
 * En VESTIAIRE, le club entier passe par le filtre de position, la recherche,
 * l'option « signables seulement » et le tri. En LOTO, la main se lit telle
 * quelle, dans l'ordre des trois clubs : trois cartes n'ont besoin de rien.
 */
function poolFiltered() {
  if (MODE().loto) return candidats();
  let list = candidats().slice();

  const f = G.filter;
  if (f === 'C') list = list.filter(p => !isD(p) && p.p !== 'G' && p.np === 'C');
  else if (f === 'AG') list = list.filter(p => !isD(p) && p.p !== 'G' && (p.np === 'L' || p.np === 'AG'));
  else if (f === 'AD') list = list.filter(p => !isD(p) && p.p !== 'G' && (p.np === 'R' || p.np === 'AD'));
  else if (f === 'LD') list = list.filter(p => isD(p) && (p.np === 'LD' || p.np === 'DG' || p.np === 'L'));
  else if (f === 'RD') list = list.filter(p => isD(p) && (p.np === 'RD' || p.np === 'DD' || p.np === 'R'));
  else if (f === 'G') list = list.filter(p => p.p === 'G');

  if (G.search) {
    const q = G.search.toLowerCase();
    list = list.filter(p => p.n.toLowerCase().includes(q));
  }

  if (G.onlyFit) {
    const rem = capLeft();
    list = list.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= rem);
  }

  const key = p => (surTable() ? p.$ : p.p === 'G' ? (p.w ?? 0) : (p.pt ?? 0));
  // Sur table, un axe du plateau ; le gardien se range sur son AR quel que
  // soit l'axe demandé, puisqu'il n'en a qu'un.
  const axe = k => p => tableStats(p)[p.p === 'G' ? 'AR' : k];
  const parAxe = k => (a, b) => axe(k)(b) - axe(k)(a) || key(b) - key(a);
  const cmp = {
    TI: parAxe('TI'), MA: parAxe('MA'), FO: parAxe('FO'), DE: parAxe('DE'), PA: parAxe('PA'), SO: parAxe('SO'),
    PTS: (a, b) => key(b) - key(a) || b.$ - a.$,
    PPG: (a, b) => (displayStats(b).ppg ?? -1) - (displayStats(a).ppg ?? -1) || key(b) - key(a),
    SAL: (a, b) => b.$ - a.$ || key(b) - key(a),
    VAL: (a, b) => valuePerM(b) - valuePerM(a),
    PM: (a, b) => (b.pm ?? 0) - (a.pm ?? 0) || key(b) - key(a),
    DEF: (a, b) => ((mesure(b) || {}).def ?? -1) - ((mesure(a) || {}).def ?? -1) || key(b) - key(a),
    ROB: (a, b) => ((mesure(b) || {}).rob ?? -1) - ((mesure(a) || {}).rob ?? -1) || key(b) - key(a),
    AGE: (a, b) => (ageAtSeason(a.bd, a.s) ?? 99) - (ageAtSeason(b.bd, b.s) ?? 99) || key(b) - key(a),
    NAME: (a, b) => a.n.localeCompare(b.n, 'fr'),
  }[G.sortBy] || ((a, b) => key(b) - key(a));

  return list.sort(cmp);
}

/** Masque le tri par âge quand aucune date de naissance n'est disponible. */
function syncAgeControls() {
  syncSortOptions();
  const sort = $('sortSelect');
  if (!sort) return;
  const opt = sort.querySelector('option[value="AGE"]');
  if (!opt) return;
  const ok = agesAvailable();
  opt.hidden = !ok;
  opt.disabled = !ok;
  if (!ok && G.sortBy === 'AGE') { G.sortBy = 'PTS'; saveOpts(); }
  sort.value = G.sortBy;
}

/* Une colonne par position, comme au tableau d'un vrai vestiaire. */
const POOL_COLS = [
  { key: 'AG', title: 'AG · ailier g.', need: POS_NEED[0], test: p => p.p === 'F' && (p.np === 'L' || p.np === 'AG') },
  { key: 'C',  title: 'C · centre',         need: POS_NEED[1], test: p => p.p === 'F' && p.np !== 'L' && p.np !== 'AG' && p.np !== 'R' && p.np !== 'AD' },
  { key: 'AD', title: 'AD · ailier d.',  need: POS_NEED[2], test: p => p.p === 'F' && (p.np === 'R' || p.np === 'AD') },
  { key: 'DG', title: 'DG · déf. gauche', need: POS_NEED[3], test: p => isD(p) && p.np !== 'RD' && p.np !== 'DD' && p.np !== 'R' },
  { key: 'DD', title: 'DD · déf. droit',  need: POS_NEED[4], test: p => isD(p) && (p.np === 'RD' || p.np === 'DD' || p.np === 'R') },
  { key: 'G',  title: 'G · gardien',        need: POS_NEED[5], test: p => p.p === 'G' },
];

function renderPoolMeta() {
  syncSortOptions();
  const list = poolFiltered();
  const loto = MODE().loto;
  // Le volet change de nom avec le tirage : « Vestiaire » (tout le club) ou
  // « La main » (trois cartes) — et cache ses outils en loto.
  $('panePool')?.classList.toggle('loto', loto);
  const titre = $('poolTitle');
  if (titre) titre.textContent = loto ? 'Le loto' : 'Vestiaire';
  /*
   * LA BARRE SE MET À JOUR ICI, et elle se rebâtit toute seule si ses entrées
   * ont changé — le nom du premier onglet suit le tirage (« Vestiaire » ou
   * « La main »), et la phase décide de la liste entière.
   */
  majNavbar(G.page);
  const meta = $('poolCount');
  if (meta) {
    const c = caseCourante();
    meta.textContent = loto
      ? (c ? `${list.length} joueur${list.length > 1 ? 's' : ''} · ${slotShort(c)}` : 'Complet')
      : `${list.length} joueur${list.length > 1 ? 's' : ''}`;
  }
  const rMeta = $('rosterMeta');
  if (rMeta) rMeta.textContent = `${signes().length} / ${totalCases()} · ${money(capUsed())}`;
}

/** Case où irait ce joueur : la cible si compatible, sinon la moins pénalisée. */
function destinationFor(p) {
  const vise = G.target !== null ? SLOTS[G.target] : null;
  const viseOK = vise && !G.roster[G.target] && fits(p, vise) && (!MODE().loto || vise === caseCourante());
  if (viseOK) return vise;
  return openSlots(p)[0] || null;
}

function playerCardEl(p) {
  const already = isPicked(p);
  const slot = destinationFor(p);
  const rem = capLeft();
  const over = p.$ > rem;
  const risky = !over && p.$ > maxForPick();
  const pen = slot ? getPositionPenalty(p, slot) : 0;
  const st = displayStats(p);
  const isTargeted = G.target !== null && slot === SLOTS[G.target];

  // UNE CARTE DE HOCKEY (S76) : `cj` pose le cadre, le reflet et la fenêtre
  // du portrait ; `tc-<rareté>` le métal du cadre, le même que les cartes
  // de match. La rareté vient du salaire (`rareteJoueur`), jamais d'une cote.
  const rarete = rareteJoueur(p);
  const el = document.createElement('div');
  /*
   * LA CARTE EST DEBOUT, DESSINÉE PAR SON ÉPOQUE (S78). JP : *Devant de carte
   * vertical, pour stats et face complète car portraits* ; *couleur et style
   * de carte différentes selon années, pis couleurs de l'équipe du joueur*.
   * `pv` la met debout (la photo en haut, le visage entier), `e70`…`e10` lui
   * donne le dessin de sa saison (`ereDe`), les couleurs du club font la
   * palette, et `tc-<variante>` n'est que la FINITION par-dessus : la
   * parallèle, l'holographique, la dorée. Au VESTIAIRE (`cj-meme-club`), toutes
   * les cartes sont du club et de la saison que l'en-tête affiche déjà : ni
   * l'écusson ni l'année ne s'y répètent. Au loto, trois clubs de trois
   * saisons : chaque carte dit les siens.
   */
  const cleVue = `${getPlayerKey(p)}|${rarete}`;
  const neuve = brillante(rarete) && !VARIANTES_VUES.has(cleVue);
  if (neuve) VARIANTES_VUES.add(cleVue);
  el.className = `pcard cj pv ${classesDeCarte(p)} tc-${rarete}${MODE().loto ? '' : ' cj-meme-club'}${neuve ? ' cj-apparait' : ''}`
    + (already ? ' signed' : '')
    + ((already || !slot || over) ? ' locked' : '');
  el.title = 'Toucher la carte pour la fiche complète';
  const band = getTeamBand(p.t);
  el.style.setProperty('--team-line', couleurVive(p.t));
  el.style.setProperty('--team-logo', logoFiligrane(p.t));
  // LE CORPS DE LA CARTE PORTE LA VRAIE COULEUR DU CLUB, assombrie juste
  // assez pour qu'un nom blanc se lise dessus (`fondEquipe`, js/logos.js).
  el.style.setProperty('--team-fond', fondEquipe(p.t) || '');
  el.style.setProperty('--team-band', band.bg);
  el.style.setProperty('--team-ink', band.ink);
  el.style.setProperty('--team-stripe', band.stripe);
  // Le bouton « Signer » porte la couleur secondaire du club (voir style.css).
  el.style.setProperty('--team-stripe-ink', band.stripeInk);
  el.style.setProperty('--team-bouton', band.bouton);
  el.style.setProperty('--team-bouton-ink', band.boutonInk);
  // La plaque de l'écusson : la SECONDE couleur du club. Elle se pose ici et
  // pas seulement sur `:root` — en loto, trois clubs sont à l'écran en même
  // temps, et la plaque de chacun doit être la sienne.
  el.style.setProperty('--team-plaque', band.plaque);
  el.style.setProperty('--team-plaque-ink', band.plaqueInk);

  // La carte ne porte que l'essentiel : qui, combien, ce qu'il vaut et où il
  // va. Le détail des statistiques est dans la fiche, à un clic.
  const bigVal = p.p === 'G' ? st.w : st.pt;
  const bigUnit = p.p === 'G' ? 'V' : 'PTS';

  // Sur table, la carte porte les nombres du plateau à la place du chiffre
  // clé, et le gabarit, le tir et l'habileté à la place de l'archétype, des
  // mesures et de la zone — ce que le plateau lit, rien de ce qu'il ignore.
  const mid = surTable()
    ? `<span class="pcard-axes">${axesTableHtml(p)}</span><div class="tags">${tagsTableHtml(p)}</div>`
    : `<div class="pcard-big"><b>${bigVal}</b><span>${bigUnit}</span></div>
          <div class="tags">${[identiteTag(p), roleTag(p), zoneTag(p)].filter(Boolean).join('')}</div>`;

  let dest;
  if (already) {
    const cur = SLOTS.find(s => G.roster[s.i] === p);
    dest = `<span class="dest-ok">✓ signé</span>${cur ? ` · ${esc(slotShort(cur))}` : ''}`;
  } else if (!slot) {
    dest = `<span class="dest-bad">aucune case libre</span>`;
  } else if (over) {
    dest = `<span class="dest-bad">hors budget</span>`;
  } else {
    // La destination n'est dite que quand elle mérite un avertissement : la
    // case visée, une pénalité de position, ou une case hors de sa zone. Le
    // « sous sa zone » est celui qui coûte cher, il se dit en rouge AVANT la
    // signature plutôt qu'après dans le volet de l'alignement.
    const ecart = zoneEcart(p, slot);
    const bits = [];
    if (isTargeted) bits.push(`<span class="dest-target">${ico('i-target')} ${esc(slotShort(slot))}</span>`);
    if (risky) bits.push(`<span class="dest-bad" title="Ce salaire laisse moins que le plancher pour les cases restantes : tu ne pourrais plus compléter les ${totalCases()}.">⚠ bloque la fin</span>`);
    // Le plateau ne lit ni la pénalité de position ni la zone : on ne
    // menace pas d'un malus que le mode bonus ne jouera pas.
    if (!surTable()) {
      if (pen > 0) bits.push(`<span class="dest-bad">−${pen} hors position</span>`);
      if (ecart === 'sous') bits.push(`<span class="dest-bad" title="${esc(ZONE_SOUS_TITLE)}">▼ sous sa zone${isTargeted ? '' : ` : ${esc(slotShort(slot))}`}</span>`);
      else if (ecart === 'dessus') bits.push(`<span class="dest-warn" title="${esc(ZONE_DESSUS_TITLE)}">▲ au-dessus de sa zone</span>`);
    }
    dest = bits.join(' · ');
  }

  const label = already ? '✓ Signé' : !slot ? 'Position pleine' : over ? 'Hors budget' : 'Signer';

  // Le bandeau dit d'un coup d'oeil ce qu'on regarde — le poste — et change
  // de couleur quand la carte change d'état. Il porte un fond, jamais du
  // texte de contenu : la même règle que les couleurs d'équipe.
  const etat = already ? 'signe' : over || !slot ? 'off' : '';
  // LE BANDEAU PORTE LA COULEUR DE L'ÉQUIPE, le poste et la provenance : tout
  // ce qui identifie la carte tient sur une ligne au lieu d'être éparpillé.
  // Le corps range le reste sur deux lignes à côté du portrait, plutôt que de
  // l'empiler : même information, deux fois moins de hauteur.
  // Sur la photo : le poste en rondelle, l'écusson et l'ANNÉE (JP : *au lieu de
  // côte sur la face, année ?* — le tirage « 71/99 » s'y lisait comme une note
  // sur 99 ; il vit au verso), la gemme de la variante et ce qu'elle joue, le
  // tampon « Recrue ». Un éclat quand une brillante sort pour la première fois.
  el.innerHTML = `
    <div class="pcard-band">
      <span class="pb-pos ${positionClass(p)} ${etat}">${esc(positionLabel(p))}</span>
      <span class="pb-team">${getTeamLogoHtml(p.t, 16)}<span>${esc(p.t)}</span></span>
      ${gemmeJoueur(rarete, traitsJoueur(p))}
    </div>
    <div class="pcard-inner">
      <div class="pcard-avatar"><span class="cj-filigrane" aria-hidden="true"></span>${brille(rarete) ? '<span class="cj-holo" aria-hidden="true"></span>' : ''}${headshotHtml(p)}<span class="cj-dessus" aria-hidden="true"></span><span class="cj-annee">${esc(anneeDeCarte(p.s))}</span>${rubanDe(p)}${neuve ? '<span class="cj-eclat" aria-hidden="true"></span>' : ''}</div>
      <div class="pcard-body">
        <div class="pcard-head">
          <div class="pcard-name">${formatName(p.n)}</div>
          <div class="pcard-price">${st.salaryMain}</div>
        </div>
        <div class="pcard-mid">
          ${mid}
        </div>
      </div>
      <div class="pcard-dest">${dest}</div>
      <button class="btn-sign${already ? ' is-signed' : ''}" ${already || !slot || over ? 'disabled' : ''}>${label}</button>
    </div>`;

  el.onclick = ev => {
    if (ev.target.closest('.btn-sign')) return;
    showPlayerModal(p);
  };
  el.querySelector('.btn-sign').onclick = ev => {
    ev.stopPropagation();
    signPlayer(p, el);
  };
  return el;
}

/*
 * LA CARTE VA AU CARTABLE (S77). Signer faisait disparaître la carte — la
 * roulette tourne, un autre vestiaire la remplace — sans qu'on la voie partir.
 * Une vignette de la carte (son visage, le métal de sa rareté) saute de la
 * photo et file vers l'onglet de l'alignement, où sa case luit à l'arrivée
 * (`cj-arrive`). Une vignette et non un clone de la carte : un clone est un
 * `.pcard` de plus dans le DOM, avec un bouton « Signer » qui ne fait rien.
 * Transformation et opacité seulement ; rien sous `prefers-reduced-motion`.
 */
function voleAuCartable(el, rarete) {
  if (!el || !el.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const src = el.querySelector('.pcard-avatar');
  const r = (src && src.offsetParent ? src : el).getBoundingClientRect();
  if (!r.width) return;
  const cible = [...document.querySelectorAll('.navtab[data-page="alignement"]')].find(b => b.offsetParent) || $('cnt');
  const rc = cible ? cible.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight - 40, width: 0, height: 0 };
  const img = src && src.querySelector('img');
  const v = document.createElement('div');
  v.className = `cj-vole tc-${rarete}`;
  v.setAttribute('aria-hidden', 'true');
  v.innerHTML = img ? `<img src="${img.src}" alt="">` : '<span class="headshot-fallback">👤</span>';
  const w = 46, h = 62;
  v.style.left = `${r.left + r.width / 2 - w / 2}px`;
  v.style.top = `${r.top + r.height / 2 - h / 2}px`;
  v.style.setProperty('--vx', `${Math.round(rc.left + rc.width / 2 - (r.left + r.width / 2))}px`);
  v.style.setProperty('--vy', `${Math.round(rc.top + rc.height / 2 - (r.top + r.height / 2))}px`);
  document.body.appendChild(v);
  const ote = () => v.remove();
  v.addEventListener('animationend', ote);
  setTimeout(ote, 1400);
}

async function signPlayer(p, el = null) {
  if (isPicked(p)) { toast(`${p.n} est déjà dans ton alignement.`, 'warn'); return; }
  const slot = destinationFor(p);
  if (!slot) { toast('Aucune case libre pour ce joueur.', 'bad'); return; }
  if (p.$ > capLeft()) { toast('Hors budget : il te reste ' + money(capLeft()) + '.', 'bad'); return; }

  const risky = p.$ > maxForPick();
  voleAuCartable(el, rareteJoueur(p));
  G.dernierSigne = { p, t: Date.now() };
  G.roster[slot.i] = p;
  G.target = null;
  G.selectedSlot = null;

  const pen = getPositionPenalty(p, slot);
  const sous = zoneEcart(p, slot) === 'sous';
  toast(`${p.n} → ${slotShort(slot)}`
    + (pen > 0 ? ` (−${pen} hors position)` : '')
    + (sous ? ' · ▼ sous sa zone' : ''), pen > 0 || sous ? 'warn' : '');
  if (risky && slotsLeft() > 0) {
    // Le message se compose maintenant : composé au déclenchement, il disait
    // « pour 0 cases » quand la dernière signature arrivait entre-temps.
    const msg = `Attention : ${money(capLeft())} pour ${slotsLeft()} cases, sous le plancher.`;
    setTimeout(() => toast(msg, 'warn'), 2700);
  }

  poserEchelle();
  // Une signature, un tour : la roulette tourne à chaque fois, dans les deux
  // tirages. Ton premier trio sort de trois clubs, pas d'un seul. SAUF si une
  // case a été vidée depuis : ce tour-là a déjà été joué, la signature le
  // repaie et la roulette reste où elle est.
  if (G.dette > 0) G.dette--;
  else await nextSpin();
  saveGame();
  render();
  document.getElementById('topbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Impasse : plus aucune signature possible dans ce vestiaire (tout est hors
 * budget ou sans case libre). C'est récupérable — il faut libérer de la masse
 * salariale — mais il faut le dire clairement plutôt que de laisser le joueur
 * devant une grille de cartes toutes grisées.
 */
function blockedState() {
  if (G.done || slotsLeft() === 0 || !G.tirage.length) return null;
  const rem = capLeft();
  const free = candidats().filter(p => !isPicked(p) && openSlots(p).length);
  if (free.some(p => p.$ <= rem)) return null;
  const cheapest = free.length ? free.reduce((a, b) => (b.$ < a.$ ? b : a)) : null;
  // Seuls tes propres contrats se libèrent : un renfort ne coûte rien.
  const priciest = signes().slice().sort((a, b) => b.$ - a.$)[0] || null;
  const rerolls = MODE().loto ? G.relances : G.left.season + G.left.team + G.left.pass;
  return { rem, cheapest, priciest, rerolls };
}

function blockedBannerEl(st) {
  const el = document.createElement('div');
  el.className = 'blocked';
  const slot = st.priciest ? SLOTS.find(s => G.roster[s.i] === st.priciest) : null;
  const vise = G.target !== null;
  const issue = st.rerolls
    ? `Tu peux relancer (${st.rerolls} relance${st.rerolls > 1 ? 's' : ''} restante${st.rerolls > 1 ? 's' : ''})${vise ? ', viser une autre case' : ''} ou libérer de la masse salariale.`
    : vise ? 'Vise une autre case, ou libère de la masse salariale.'
      : 'Tes relances sont épuisées : il faut libérer de la masse salariale.';
  const ici = MODE().loto ? 'cette main' : 'ce vestiaire';
  el.innerHTML = `
    <div class="blocked-title">⚠ Aucune signature possible ici</div>
    <p>Il te reste <strong>${money(st.rem)}</strong> pour <strong>${slotsLeft()} case${slotsLeft() > 1 ? 's' : ''}</strong>.
      ${st.cheapest ? `Le moins cher de ${ici} qui a une case libre coûte ${money(st.cheapest.$)}.` : `Aucun joueur de ${ici} ne convient à une case libre.`}
      ${issue}</p>
    ${st.priciest ? `<button class="btn danger" id="freeCapBtn">Retirer ${esc(st.priciest.n)} · ${money(st.priciest.$)}${slot ? ` (${esc(slot.role)})` : ''}</button>` : ''}`;
  const btn = el.querySelector('#freeCapBtn');
  if (btn && slot) {
    btn.onclick = () => {
      delete G.roster[slot.i];
      G.selectedSlot = null;
      G.dette++;   // une case vidée est une case vidée, même pour se sortir d'une impasse
      saveGame();
      render();
      toast(`${st.priciest.n} retiré. ${money(capLeft())} de disponible, `
        + `et la roulette ne tournera pas pour cette case.`, 'warn');
    };
  }
  return el;
}

function renderPool() {
  const host = $('pool');
  if (!host) return;

  /*
   * L'avertissement d'impasse a son propre conteneur, au-dessus du bassin.
   * Dans le bassin il devenait une colonne de la bande qu'on balaie — donc
   * un panneau de plus à faire défiler, alors que c'est justement le moment
   * où le joueur est bloqué et doit le lire tout de suite.
   */
  const notice = $('poolNotice');
  if (notice) notice.innerHTML = '';

  if (G.loading) {
    host.className = 'pool';
    host.innerHTML = `<div class="empty-msg">Ouverture du vestiaire…</div>`;
    return;
  }

  const blocked = blockedState();
  if (blocked && notice) notice.appendChild(blockedBannerEl(blocked));

  const list = poolFiltered();
  if (!list.length) {
    host.className = 'pool';
    host.innerHTML = `<div class="empty-msg">${MODE().loto
      ? (slotsLeft() === 0 ? 'Alignement complet : permute tes joueurs ou simule.'
        : 'Ce tirage ne met personne à cette case.<br>Vise une autre case dans l\'alignement' + (G.relances ? ' ou relance.' : '.'))
      : `Aucun joueur ne correspond.<br>${G.search ? 'Efface la recherche' : G.onlyFit ? 'Désactive « signables seulement » dans les options' : 'Change de filtre'} ou utilise une relance.`}</div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  /*
   * En VESTIAIRE : six colonnes, une par poste — sauf si on a demandé la liste
   * complète, ou si un filtre de position ne laisse déjà qu'un seul poste :
   * ranger une colonne en six colonnes n'a pas de sens. La feuille de style
   * décide ensuite de leur forme : de vraies colonnes côte à côte sur grand
   * écran, une bande qu'on balaie du doigt sur téléphone. En LOTO : la main,
   * trois cartes dans l'ordre des clubs, rien d'autre à ranger.
   */
  const byPos = !MODE().loto && G.poolView === 'POS' && G.filter === 'ALL';
  host.className = 'pool' + (byPos ? ' by-pos' : '');

  if (byPos) {
    for (const col of POOL_COLS) {
      const players = list.filter(col.test);
      const n = signedCount(col.need);
      const el = document.createElement('div');
      el.className = 'pool-col';
      // Le liseré relie l'en-tête à la couleur des cartes de la colonne :
      // on retrouve son poste sans relire le titre.
      const ton = col.key === 'G' ? 'pos-g' : (col.key === 'DG' || col.key === 'DD') ? 'pos-d' : 'pos-f';
      el.innerHTML = `<div class="pool-col-head ${ton}">
        <span class="pool-col-title">${esc(col.title)}</span>
        <span class="pool-col-meta"><span>${players.length} dispo</span>
        <span class="chip-need${n >= col.need.req ? ' full' : ''}" title="Signés sur requis à cette position">${n}/${col.need.req}</span></span>
      </div>`;
      const cards = document.createElement('div');
      cards.className = 'pool-col-cards';
      if (!players.length) cards.innerHTML = `<div class="empty-msg small">Aucun</div>`;
      else for (const p of players) cards.appendChild(playerCardEl(p));
      el.appendChild(cards);
      frag.appendChild(el);
    }
  } else {
    for (const p of list) frag.appendChild(playerCardEl(p));
  }

  host.innerHTML = '';
  host.appendChild(frag);
  ajusterCartes(host);
}

/*
 * LE NOM DE FAMILLE, LES POINTS, LE SALAIRE ET LES ICÔNES SONT TOUJOURS
 * ENTIERS. C'est la règle de JP, et elle remplace les points de suspension
 * sur ces quatre-là : une carte qu'on signe sans avoir lu le nom ne sert à
 * rien. La boîte ne grandit toujours pas — les hauteurs restent fixes — mais
 * le contenu s'adapte : le nom rétrécit sa police jusqu'à tenir (plancher
 * 10 px), et la rangée d'étiquettes se réduit à l'échelle quand elle est
 * plus large que sa place (elle est alignée à droite, on la réduit vers la
 * droite). Les points et le salaire ne rétrécissent jamais : c'est le nom
 * qui cède la place, puisque c'est lui qui a le plus de marge.
 *
 * Lectures d'abord, écritures ensuite : mesurer puis écrire élément par
 * élément forcerait une remise en page par carte.
 */
function ajusterCartes(root) {
  const noms = [...root.querySelectorAll('.pcard-name .lname, .slot-name, .spin-name')];
  const tags = [...root.querySelectorAll('.pcard-mid .tags, .slot-tags')];
  for (const el of noms) el.style.fontSize = '';
  for (const el of tags) el.style.transform = '';
  const mesN = noms.map(el => [el, el.scrollWidth, el.clientWidth, parseFloat(getComputedStyle(el).fontSize)]);
  const mesT = tags.map(el => [el, el.scrollWidth, el.clientWidth]);
  for (const [el, sw, cw, fs] of mesN) {
    // Le nom du vestiaire a un plancher plus haut : c'est un titre, pas une étiquette.
    const plancher = el.classList.contains('spin-name') ? 17 : 10;
    if (sw > cw && cw > 0) el.style.fontSize = `${Math.max(plancher, Math.floor(fs * cw / sw * 10) / 10 - 0.2)}px`;
  }
  for (const [el, sw, cw] of mesT) {
    if (sw > cw && cw > 0) el.style.transform = `scale(${Math.max(0.6, cw / sw).toFixed(3)})`;
  }
}
let ajusteTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(ajusteTimer);
  ajusteTimer = setTimeout(() => {
    ajusterCartes(document);
    // L'onglet ouvert reste en vue quand la barre change de forme (S67).
    if (G.page) majNavbar(G.page);
  }, 120);
});
// La police d'affichage arrive après le premier rendu : on remesure avec elle.
if (document.fonts?.ready) document.fonts.ready.then(() => ajusterCartes(document));

// LA HAUTEUR RÉELLE DE LA BARRE DU HAUT. Elle fait 84 px sur téléphone et
// 55 px à partir de 680 px, et deux choses se collent dessous — le volet de
// l'alignement en grand écran, la barre d'onglets du bilan. `--topbar-h`
// était une constante à 88 px, donc un jour de 33 px en grand écran ; on la
// mesure, et elle suit la police et le redimensionnement.
const topbar = document.querySelector('.topbar');
if (topbar && 'ResizeObserver' in window) {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--topbar-h', `${Math.round(topbar.offsetHeight)}px`);
  }).observe(topbar);
}

/* =====================================================================
   Rendu — alignement
   ===================================================================== */

/*
 * LE BANDEAU D'UNE CASE EST ÉTROIT — trois cases par trio sur un quart de
 * l'écran, soit environ cent pixels. « Réserve F » n'y tient pas à côté du
 * salaire, et le libellé se coupait à « RÉ… ». On abrège donc dans le
 * bandeau seulement, et seulement là où c'est nécessaire : la case vide, elle,
 * garde le mot entier puisqu'elle a toute la place, et les gardiens gardent
 * « Partant » et « Auxiliaire » puisqu'ils ne sont que deux par rangée.
 */
const ROLE_COURT = {
  'Réserve F': 'Rés. F', 'Réserve D': 'Rés. D', 'Réserve': 'Rés.',
};
const roleCourt = r => ROLE_COURT[r] || r;

/*
 * LA CASE NE PORTE QUE LE VERDICT DE PLACEMENT : la zone d'efficacité,
 * l'écart à cette zone, la pénalité de position. Rien d'autre.
 *
 * Elle portait aussi les traits et l'archétype, et c'est ce qui la salissait :
 * quatre cases par trio sur un quart d'écran font des cases de cent pixels,
 * où la quatrième étiquette se coupait en deux et laissait un moignon au
 * bord. Les traits n'ont pas disparu — ils sont sur la carte du bassin, au
 * moment où on décide de signer, et sur la fiche. Le tableau de profondeur,
 * lui, répond à une seule question : ce joueur est-il à sa place ?
 */
const SLOT_TAGS_MAX = 8;   // les icônes de traits devant le verdict, la rangée se réduit à l'échelle au besoin
/*
 * La case porte le verdict de placement — zone, écart, pénalité — et, devant,
 * les ICÔNES du joueur : ses traits et ses étiquettes mesurées. JP : *à voir
 * les icônes dans l'alignement* — on lit d'un coup d'œil son trio
 * d'étouffement et ses colosses une fois l'alignement monté.
 */
/* =====================================================================
   SUR TABLE : le repêchage montre les nombres du PLATEAU
   =====================================================================
   JP : *le mode Blood Bowl, montrer les stats du jeu de table, pas les
   vraies stats*. On repêchait sous un jeu de règles et on jouait sous un
   autre : la carte disait 78 PTS, la case disait « ▼ sous sa zone », la
   rangée disait « chimie +2/+2 », les tuiles comptaient les unités
   « optimales » — et le plateau se joue sur PA MA TI FO SO, le gabarit, le
   tir signature et l'habileté. Pire que les vraies stats : `js/table.js` ne
   lit NI les zones, NI la pénalité de position, NI la chimie (vérifié : zéro
   occurrence), donc ces verdicts-là parlaient d'un moteur qui n'allait pas
   jouer.

   Quand `G.bonus` vaut TABLE, le repêchage lit donc `statsDeTable` — la
   même fonction que la carte du plateau, aucun nombre neuf — et tait ce que
   le plateau ignore. Le repêchage lui-même ne change pas : mêmes 23 cases,
   même plafond, même roulette.
   ===================================================================== */
const surTable = () => G.bonus === 'TABLE';

/* Les cinq nombres d'un joueur, mémorisés : le tri les demande n log n fois. */
const STATS_TABLE = new WeakMap();
function tableStats(p) {
  let st = STATS_TABLE.get(p);
  if (!st) { st = statsDeTable(p); STATS_TABLE.set(p, st); }
  return st;
}

const AXES_PATINEUR = ['PA', 'MA', 'TI', 'FO', 'DE', 'SO'];
const axesDe = p => (p.p === 'G' ? ['AR'] : AXES_PATINEUR);

/* Un axe : son sigle, son nombre, et le trait qui le majore dans l'infobulle
   — « le trait EST le nombre », comme sur la carte du plateau. */
function axeHtml(p, k, cls = 't-axe') {
  const st = tableStats(p);
  const tr = (st.traits || {})[k];
  const T = tr && TRAITS[tr];
  return `<span class="${cls}${T ? ' majore' : ''}" title="${esc(AXE_MOT[k])}${T ? ` — ${T.icon} ${T.label} : +1` : ''}"><i>${k}</i><b>${st[k]}</b></span>`;
}
const axesTableHtml = p => axesDe(p).map(k => axeHtml(p, k)).join('');

/* Le gabarit, le tir signature et l'habileté : ce qui nomme une pièce. Pas
   d'étiquette de trait à côté — ⚡ Vitesse et ⚡ Coup de patin se liraient
   comme un doublon, et le second vient du premier. */
function tagsTableHtml(p, full = false) {
  const st = tableStats(p);
  const gab = GABARITS[st.gb], tir = TIRS[st.ts] || TIRS.P;
  const hab = HABILETES[habileteDe(p)];
  const tag = (o, t) => `<span class="tag tag-table" title="${esc(t)}">${o.icon}${full ? ` ${esc(o.nom)}` : ''}</span>`;
  return [
    tag(gab, `${gab.nom} — ${gab.desc}`),
    p.p === 'G' ? '' : tag(tir, `${tir.nom} — ${tir.desc}`),
    hab ? tag(hab, `${hab.nom}, une fois par période — ${hab.desc}`) : '',
  ].join('');
}

/* Dans la case de l'alignement, étroite : les trois nombres qui décident
   d'un geste, serrés ; le patin et le souffle passent en étiquette. */
function slotAxesTexte(p) {
  const st = tableStats(p);
  // Neuf caractères tiennent sur la ligne d'une case de trio à 390 px, à
  // côté du visage — « TI2 MA2 FO6 » se coupait. Deux nombres par rôle ici,
  // les trois autres dans l'étiquette, qui se réduit à l'échelle.
  return p.p === 'G' ? `AR${st.AR}` : isD(p) ? `FO${st.FO} MA${st.MA}` : `TI${st.TI} MA${st.MA}`;
}
function slotAxesReste(p) {
  const st = tableStats(p);
  return p.p === 'G' ? '' : isD(p) ? `TI${st.TI} PA${st.PA} SO${st.SO}` : `FO${st.FO} PA${st.PA} SO${st.SO}`;
}

/*
 * LE TRI SUIT LE JEU. Trier sur les points, en mode Sur table, c'est trier
 * sur un nombre que le plateau ne lit pas. Les options du `<select>` sont
 * donc bâties d'ici, par mode, et un choix qui n'existe plus dans l'autre
 * mode retombe sur le premier de la liste.
 */
const SORTS_SAISON = [
  ['PTS', 'Points / V'], ['PPG', 'Pts par match'], ['SAL', 'Salaire'], ['VAL', 'Pts par M$'],
  ['PM', 'Différentiel'], ['DEF', 'Défensive'], ['ROB', 'Robustesse'], ['AGE', 'Âge'], ['NAME', 'Nom'],
];
const SORTS_TABLE = [
  ['TI', 'Tir'], ['MA', 'Maniement'], ['FO', 'Force'], ['DE', 'Défense'], ['PA', 'Patin'], ['SO', 'Souffle'],
  ['SAL', 'Salaire'], ['NAME', 'Nom'],
];
function syncSortOptions() {
  const sort = $('sortSelect');
  if (!sort) return;
  const jeu = surTable() ? 'table' : 'saison';
  const liste = surTable() ? SORTS_TABLE : SORTS_SAISON;
  if (sort.dataset.jeu !== jeu) {
    sort.innerHTML = liste.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    sort.dataset.jeu = jeu;
  }
  if (!liste.some(([v]) => v === G.sortBy)) { G.sortBy = liste[0][0]; saveOpts(); }
  sort.value = G.sortBy;
}

/** La fiche d'un joueur à ce jour, telle que le banc la lit : « 12-18-30 · +7 », « 14-6 · ,918 ». */
function ficheDuJour(p) {
  const c = G.banc && G.banc.compte.get(p);
  if (!c || !c.gp) return 'aucun match';
  // 1,000 : un blanchissage en début de saison s'écrivait « 1.000 » (le remplacement ne visait que « 0. »).
  if (p.p === 'G') return `${c.w}-${c.l} · ${c.sa ? (c.sv / c.sa).toFixed(3).replace(/^0\./, ',').replace('.', ',') : '—'}`;
  return `${c.g}-${c.a}-${c.pts} · ${c.pm > 0 ? '+' : ''}${c.pm}`;
}

function slotTags(p, zoneEcartTag, penTag) {
  if (surTable()) {
    // Le plateau ne lit ni zone ni pénalité : la case porte le gabarit, le
    // tir et l'habileté, et les deux nombres qui n'ont pas tenu sur la ligne.
    const st = tableStats(p);
    const gab = GABARITS[st.gb], tir = TIRS[st.ts] || TIRS.P, hab = HABILETES[habileteDe(p)];
    const icones = [gab, p.p === 'G' ? null : tir, hab].filter(Boolean);
    return `<span class="slot-icones" title="${esc(icones.map(i => i.nom).join(' · '))}">${icones.map(i => i.icon).join('')}</span>`
      + (p.p === 'G' ? '' : `<span class="tag tag-table" title="${esc(isD(p) ? AXE_MOT.TI : AXE_MOT.FO)} · ${esc(AXE_MOT.PA)} · ${esc(AXE_MOT.SO)}">${slotAxesReste(p)}</span>`);
  }
  /*
   * SES RÔLES D'ABORD (S79). JP : *ce qu'on voit sur la page d'alignement …
   * ses icônes, ça doit aider à savoir d'un coup d'oeil ce que les joueurs
   * peuvent faire pour matcher comme des vraies lignes*. Le rôle premier et,
   * s'il en a un, le second : lus dans ses vraies stats, jamais une cote.
   */
  const pp = profilPrincipal(p), r2 = pp && roleSecond(p);
  const roles = pp ? `<span class="slot-roles" title="${esc(pp.nom)}${r2 ? ` · second rôle : ${esc(r2.nom)}` : ''}">${pp.ico}${r2 ? r2.ico : ''}</span>` : '';
  // Les icônes, serrées, sans cadre : la case est étroite. Le survol donne le mot.
  const icones = [...getTraits(p).map(t => TRAITS[t.cle]), ...mesureIcones(p)];
  const compact = icones.length
    ? `<span class="slot-icones" title="${esc(icones.map(i => i.short).join(' · '))}">${icones.map(i => i.icon).join('')}</span>` : '';
  // LES VERDICTS D'ABORD (S78) : sa zone, puis ce qui cloche — c'est ce qu'on
  // lit pour ranger un alignement ; les icônes suivent, et c'est elles qui
  // rétrécissent quand la rangée déborde.
  return [roles, zoneTag(p, true), zoneEcartTag, penTag, compact]
    .filter(Boolean).slice(0, SLOT_TAGS_MAX).join('');
}

/** Les étiquettes mesurées d'un joueur, en icônes : `[{ icon, short }]`. */
function mesureIcones(p) {
  const m = mesure(p);
  if (!m) return [];
  const out = [];
  if (m.def != null && m.def >= SEUIL_MESURE) out.push({ icon: '🧊', short: 'Défensif' });
  if (m.rob != null && m.rob >= SEUIL_MESURE) out.push({ icon: '🪨', short: 'Robuste' });
  return out;
}

function slotEl(s) {
  const p = G.roster[s.i];
  const el = document.createElement('div');
  const pen = p ? getPositionPenalty(p, s) : 0;

  el.className = 'slot'
    + (p ? '' : ' empty')
    + (G.selectedSlot === s.i ? ' selected' : '')
    + (!p && G.target === s.i ? ' target' : '')
    + (pen > 0 ? ' oop' : '');

  if (p) {
    el.style.setProperty('--slot-line', couleurVive(p.t));
    el.style.setProperty('--slot-fond', fondEquipe(p.t, 0.035) || '');
    const band = getTeamBand(p.t);
    el.style.setProperty('--slot-band', band.bg);
    el.style.setProperty('--slot-ink', band.ink);
    el.style.setProperty('--slot-stripe', band.stripe);
    const st = displayStats(p);
    const main = p.p === 'G' ? `${st.w} V` : `${st.pt} PTS`;
    /* La case est étroite : la ligne de statistiques y tient en une seule,
       donc on abrège « PTS/M » en « /M ». La fiche donne le libellé complet. */
    const secondary = p.p === 'G' ? `${p.sv ?? '—'} %ARR` : `${st.ppgStr}/M`;
    // Sur table : les nombres du plateau, et rien de ce qu'il ne lit pas.
    // Derrière le banc : la fiche À CE JOUR, jamais celle de fin de saison.
    const ligneStats = G.banc ? ficheDuJour(p) : surTable() ? slotAxesTexte(p) : `${main} · ${secondary}`;
    const blesseTag = G.banc && G.banc.blesses.has(p)
      ? `<span class="tag tag-pen" title="Blessé : il lui reste ${G.banc.blesses.get(p)} match${G.banc.blesses.get(p) > 1 ? 's' : ''}. Un réserviste prend sa place le soir du match.">🩹 ${G.banc.blesses.get(p)}</span>` : '';
    const penTag = !surTable() && pen > 0 ? `<span class="tag tag-pen" title="Pénalité de position : −${pen}">−${pen}</span>` : '';
    const ecart = zoneEcart(p, s);
    /* Une flèche seule : « ▼ zone » et « ▲ zone » poussaient la pénalité de
       position hors de la case sur les écrans où un trio n'a que cent pixels
       par joueur. L'infobulle dit la phrase entière. */
    const zoneEcartTag = surTable() ? '' : ecart === 'sous' ? `<span class="tag tag-pen" title="${esc(ZONE_SOUS_TITLE)}">▼</span>`
      : ecart === 'dessus' ? `<span class="tag tag-zone-up" title="${esc(ZONE_DESSUS_TITLE)}">▲</span>` : '';
    if (estRenfort(p)) el.classList.add('renfort');
    /*
     * LA CASE D'ABORD LISIBLE (S78). JP : *améliorer l'alignement pour que
     * l'information soit plus claire, quitte à être moins beau et complexe*.
     * La case était une carte en miniature : un visage de 34 px, le poste
     * DEUX fois (la pastille de la case et « AG / AD » dans la ligne), le club
     * deux fois (l'écusson et « EDM '94 »), et un nom de famille qui n'avait
     * que 60 px — six noms coupés à 390 px, dix à 1 280. Elle garde ce qui
     * DÉCIDE d'un alignement, chacun une fois, dans cet ordre de lecture :
     *   1. la bande : la case qu'il occupe (sa pastille), son club (l'écusson),
     *      son salaire ;
     *   2. son NOM, sur toute la largeur de la case ;
     *   3. sa production (au repêchage) ou sa fiche à ce jour (derrière le banc) ;
     *   4. les verdicts : 🩹 blessé, sa zone (T1-3), ▼ ▲ hors de sa zone, −N
     *      hors position, puis ses icônes.
     * Le visage, la saison et ses positions naturelles sont dans la fiche, à un
     * toucher. Une case n'est PAS debout comme la carte du vestiaire : trois
     * cartes debout par trio feraient un alignement trois fois plus haut, qu'on
     * ne lirait plus d'un coup d'oeil. Elle reste une carte par sa bande aux
     * couleurs du club et son cadre ; une variante brillante y garde un liseré.
     */
    const rarete = rareteJoueur(p);
    el.classList.add('cj-case', `tc-${rarete}`);
    if (ecart === 'sous') el.classList.add('sous-zone');
    // LA CARTE QU'ON VIENT DE SIGNER ENTRE DANS LE CARTABLE (S77) : sa case
    // luit une fois, là où elle vient d'arriver. Rien ne se rejoue au rendu
    // suivant : l'horodatage vieillit.
    if (G.dernierSigne && G.dernierSigne.p === p && Date.now() - G.dernierSigne.t < 1500) el.classList.add('cj-arrive');
    el.innerHTML = `
      ${estRenfort(p) || G.banc ? ''
        : `<button class="slot-remove" title="Retirer ${esc(p.n)}" aria-label="Retirer ${esc(p.n)}">✕</button>`}
      <div class="slot-band${estRenfort(p) ? ' off' : ''}">
        <span class="sb-role ${positionClass(p)}" title="Ses positions : ce qu'il peut jouer (la case, elle, se lit à sa place dans le trio)">${esc(positionLabel(p))}</span>
        <span class="sb-logo">${getTeamLogoHtml(p.t, 12)}</span>
        ${estRenfort(p)
          ? '<span class="slot-salary renfort" title="Fourni par ton club de renfort : ne coûte rien au plafond et ne se modifie pas.">renfort</span>'
          : `<span class="slot-salary">${st.salaryMain}</span>`}
      </div>
      <div class="slot-inner">
        <div class="slot-name">${formatName(p.n)}</div>
        <div class="slot-visage" aria-hidden="true">${headshotHtml(p)}</div>
        <div class="slot-meta slot-faits">${ligneStats}</div>
        <div class="slot-tags">${blesseTag}${slotTags(p, zoneEcartTag, penTag)}</div>
      </div>`;
    el.querySelector('.slot-remove')?.addEventListener('click', ev => {
      ev.stopPropagation();
      delete G.roster[s.i];
      G.selectedSlot = null;
      // Le tour est déjà joué : la prochaine signature comble cette case sans
      // faire tourner la roulette. Sans ça, « signer le moins cher puis ✕ »
      // était un « Passer » gratuit et illimité.
      if (!estRenfort(p)) G.dette++;
      saveGame();
      render();
      toast(`${p.n} retiré. ${money(capLeft())} de disponible, `
        + `et la roulette ne tournera pas pour cette case.`, 'warn');
    });
  } else {
    // Sur table, la case vide ne promet pas de zone : le plateau n'en lit pas.
    el.innerHTML = `<div class="slot-role">${esc(s.role)}</div><div class="slot-sub">${surTable() ? '' : esc(s.label)}</div>`;
  }

  el.onclick = () => {
    if (estRenfort(p)) { toast('Les renforts sont fournis : tu ne peux pas les déplacer.', 'warn'); return; }
    if (G.selectedSlot !== null) {
      if (G.selectedSlot === s.i) {
        G.selectedSlot = null;
      } else {
        const src = G.selectedSlot;
        const a = G.roster[src], b = G.roster[s.i];
        if (a) G.roster[s.i] = a; else delete G.roster[s.i];
        if (b) G.roster[src] = b; else delete G.roster[src];
        // RANGER NE RECOMPOSE PAS LA MAIN (S71) : si le déplacement remplit la
        // case de la main, l'épingle passe à la case libérée, du même poste.
        if (MODE().loto && G.mainCase === s.i && !G.roster[src] && SLOTS[src] && SLOTS[src].role === SLOTS[s.i].role) G.mainCase = src;
        G.selectedSlot = null;
        G.target = null;
        saveGame();
        toast(b ? 'Joueurs permutés.' : 'Joueur déplacé.');
      }
    } else if (p) {
      G.selectedSlot = s.i;
      toast('Touche une autre case pour déplacer ou permuter.');
    } else {
      G.target = (G.target === s.i ? null : s.i);
      // Retirer sa visée rend la main à la première case vide.
      if (G.target === null) { G.mainCase = null; G.mainRang = null; }
      if (G.target !== null) {
        setView('pool');
        toast(`Case ciblée : ${slotShort(s)}. ${MODE().loto ? 'Les trois clubs te tendent leur joueur de cette case.' : 'Les signatures iront là.'}`);
      }
    }
    render();
  };
  return el;
}

/*
 * Titres des rangées du tableau de profondeur. On les nomme par leur RANG —
 * 1er trio, 2e paire — et non par leur zone : deux rangées s'appelaient
 * « Top 6 » et deux autres « Top 4 », si bien qu'on ne savait plus laquelle
 * on regardait. La zone reste écrite sur la case vide et sur l'étiquette du
 * joueur, là où elle sert à décider.
 */
const UNIT_NAMES_F = ['1er trio', '2e trio', '3e trio', '4e trio'];
const UNIT_NAMES_D = ['1re paire', '2e paire', '3e paire'];

/* Version courte des libellés de chimie : l'en-tête d'une unité est étroit,
   le texte complet reste dans l'infobulle. */
const CHEM_SHORT = {
  'Chimie parfaite 🌟': '🌟 Parfaite',
  'Tandem moteur 🎯': '🎯 Tandem',
  'Conflit de rôles ⚠️': '⚠️ Conflit',
  'Chimie standard 👍': '👍 Standard',
  'Paire équilibrée ⚖️': '⚖️ Équilibrée',
  'Paire hyper-offensive 🚀': '🚀 Hyper-off.',
  'Paire hermétique 🔒': '🔒 Hermétique',
  'Paire standard 👍': '👍 Standard',
  'Trio standard 👍': '👍 Standard',
};
const chemShort = name => CHEM_SHORT[name] || name;
const ZONE_SHORT = { optimal: '✨ Optimal', mal: '⚠️ Mal assorti', hors: '🚨 Hors de ses lignes' };
const zoneShort = (tag, etat) => ZONE_SHORT[etat]
  || (!tag ? '' : tag.replace('Trio ', '').replace('Paire ', '').replace('optimale', 'optimal'));

function lineEl(title, slots, group, unit, cls = '') {
  const wrap = document.createElement('div');
  wrap.className = 'line';

  let chemHtml = '<span class="line-chem">incomplet</span>';
  // Sur table, pas de chimie : le plateau joue chaque pièce sur ses nombres,
  // et annoncer « +2/+2 » serait promettre un bonus que rien n'applique.
  if (group != null && !surTable()) {
    /*
     * LA LIGNE, DANS LA LANGUE DES LIGNES (S72). L'en-tête d'un trio disait
     * « Trio complet · optimal +2/+2 » — une autre chimie que celle de « Mes
     * lignes ». Il dit si ses joueurs sont à leur place ; la paire aussi.
     * La tactique et le fit ne s'y écrivent plus depuis S78 : ils ont leur
     * tiroir sous le trio (`strategieDeLigne`), et l'en-tête les répétait —
     * coupés, en plus, à 1 280 px (« ⚠️ un joueur ma… »).
     */
    const syn = getUnitSynergy(G.roster, group, unit);
    const filled = slots.filter(s => G.roster[s.i]).length;
    const place = syn.zoneEtat === 'optimal' ? '✨ à leur place' : syn.zoneEtat === 'hors' ? '🚨 hors de leurs lignes' : syn.zoneEtat === 'mal' ? '⚠️ un joueur mal placé' : '';
    if (filled === slots.length) {
      const kind = syn.zoneEtat === 'optimal' ? 'good' : syn.zoneEtat ? 'bad' : '';
      if (kind) wrap.classList.add(kind);
      chemHtml = place ? `<span class="line-chem ${kind}" title="${kind === 'good' ? 'Chacun joue dans sa zone : l\'unité rend à plein.' : 'Au moins un joueur joue hors de sa zone : voir ▼ ▲ sur sa case.'}">${esc(place)}</span>` : '';
    } else {
      chemHtml = `<span class="line-chem">${filled}/${slots.length} comblés</span>`;
    }
  } else {
    const filled = slots.filter(s => G.roster[s.i]).length;
    chemHtml = `<span class="line-chem">${filled}/${slots.length} comblés</span>`;
  }

  // Derrière le banc, chaque trio porte son 🔒 : le trio de fermeture prend le
  // premier trio adverse (voir FERMETURE_DEFAUT dans js/sim.js).
  let fermHtml = '';
  if (G.banc && group === 'F') {
    const ferm = fermetureCourante();
    const on = ferm === unit;
    fermHtml = `<button type="button" class="line-ferm${on ? ' on' : ''}" data-unit="${unit}" title="${on ? 'Ton trio de fermeture : il prend le premier trio adverse. Touche pour le libérer.' : 'En faire ton trio de fermeture : il prendra le premier trio adverse. Son blocage est celui de ses trois joueurs.'}">🔒${on ? ' Fermeture' : ''}</button>`;
    if (on) wrap.classList.add('fermeture');
  }
  // QUI EST CETTE UNITÉ (S79) : « Trio de snipers », « Paire classique » — les icônes sont dans les cases.
  const id = (group === 'F' || group === 'D') && !surTable() ? identiteUnite(G.roster, group, unit) : null;
  const idHtml = id ? `<span class="line-id" title="${esc(id.roles.join(' · '))}">${esc(id.nom)}</span>` : '';
  wrap.innerHTML = `<div class="line-head"><span class="line-name">${esc(title)}</span>${idHtml}${fermHtml}${chemHtml}</div>`;
  const fermBtn = wrap.querySelector('.line-ferm');
  if (fermBtn) fermBtn.onclick = ev => {
    ev.stopPropagation();
    G.banc.fermeture = fermetureCourante() === unit ? null : unit;
    render();
  };
  const row = document.createElement('div');
  row.className = 'line-slots' + (cls ? ' ' + cls : '');
  slots.forEach(s => row.appendChild(slotEl(s)));
  wrap.appendChild(row);
  // LA STRATÉGIE SOUS SON TRIO (S78). Sur table, rien : le plateau ne lit ni
  // tactique ni glace, et un tiroir de réglages y promettrait ce que rien
  // n'applique.
  if ((group === 'F' || group === 'D') && !surTable()) wrap.appendChild(tiroirStrategie(unit, group));
  return wrap;
}

/*
 * LE TIROIR DE STRATÉGIE D'UN TRIO (S78). JP : *Alignement et stratégie et
 * trio, ça devrait être ensemble* ; *sur mobile … dropdown, modals … pour
 * gagner espace, page trop longue*. Un <details> par trio, et un seul ouvert
 * à la fois (`name`, l'accordéon natif) : l'alignement reste court, et le
 * tiroir fermé dit déjà la tactique, le fit et la glace.
 *
 * Un réglage s'applique TOUT DE SUITE — il n'y a plus de modale à valider :
 * avant la saison il va dans `G.lignes` (sauvegardé), derrière le banc dans
 * `G.banc.lignes`, qui part avec la décision au « Retour au match ». Seul le
 * tiroir se redessine : l'alignement ne bouge pas sous le doigt.
 */
function specStrategie() {
  const b = G.banc;
  if (!b) return { lineup: G.roster, lignes: lignesDe({ lignes: G.lignes }, G.roster), chimie: [0, 0, 0, 0], adv: null };
  return {
    lineup: G.roster, lignes: b.lignes, chimie: b.chimie, apprentissage: b.apprentissage,
    adv: b.prochain ? { nom: teamShort(b.prochain.adv), lignes: lignesDe(b.prochain.adv, b.prochain.adv.roster) } : null,
  };
}
function tiroirStrategie(unit, groupe = 'F') {
  const d = document.createElement('details');
  const ici = `${groupe}${unit}`;
  d.className = `ln-strat${groupe === 'D' ? ' ln-strat-d' : ''}`;
  d.setAttribute('name', 'strategie');
  d.dataset.u = unit;
  d.dataset.g = groupe;
  if (G.stratOuverte === ici) d.open = true;
  // Le corps n'existe que tiroir ouvert : fermé, il n'y a rien à calculer ni
  // à peindre, et rien de caché qui dépasserait de sa rangée.
  d.addEventListener('toggle', () => {
    if (d.open) G.stratOuverte = ici;
    else if (G.stratOuverte === ici) G.stratOuverte = null;
    dessiner();
  });
  const dessiner = () => {
    const spec = specStrategie();
    const { sommaire, corps } = strategieDeLigne(spec, unit, d.open, groupe);
    d.innerHTML = `<summary class="ln-som">${sommaire}</summary>${d.open ? `<div class="ln-corps">${corps}</div>` : ''}`;
    const regler = patch => {
      const lignes = spec.lignes.map(l => ({ ...l }));
      Object.assign(lignes[unit], patch);
      if (G.banc) G.banc.lignes = lignes;
      else { G.lignes = lignes; saveGame(); }
      // Les secondes d'une ligne déplacent la glace des TROIS autres (les
      // minutes se partagent soixante) : chaque tiroir se redessine.
      document.querySelectorAll('#rosterBoard .ln-strat').forEach(x => x._dessiner && x._dessiner());
    };
    d.querySelectorAll('[data-tac]').forEach(b => { b.onclick = () => regler({ tac: b.dataset.tac }); });
    d.querySelectorAll('[data-tacd]').forEach(b => { b.onclick = () => regler({ tacD: b.dataset.tacd }); });
    d.querySelectorAll('[data-agr]').forEach(b => { b.onclick = () => regler({ agr: Number(b.dataset.agr) }); });
    const s = d.querySelector('.gl-sec');
    if (s) s.onchange = () => regler({ sec: Number(s.value) });
  };
  d._dessiner = dessiner;
  dessiner();
  return d;
}

function renderRoster() {
  const host = $('rosterBoard');
  if (!host) return;
  host.innerHTML = '';

  UNIT_NAMES_F.forEach((name, u) => {
    const slots = SLOTS.filter(s => s.group === 'F' && s.unit === u && !s.scratch);
    host.appendChild(lineEl(name, slots, 'F', u));
  });
  UNIT_NAMES_D.forEach((name, u) => {
    const slots = SLOTS.filter(s => s.group === 'D' && s.unit === u && !s.scratch);
    host.appendChild(lineEl(name, slots, 'D', u, 'pair'));
  });
  host.appendChild(lineEl('Gardiens', SLOTS.filter(s => s.group === 'G' && !s.scratch), null, null, 'pair'));
  host.appendChild(lineEl('Réservistes', SLOTS.filter(s => s.scratch), null, null));
  ajusterCartes(host);
}

function renderTeamSummary() {
  const host = $('teamSummary');
  if (!host) return;

  const oop = SLOTS.filter(s => G.roster[s.i] && getPositionPenalty(G.roster[s.i], s) > 0).length;
  let optimal = 0, miscast = 0, hors = 0;
  const units = [...Array(4).keys()].map(u => ['F', u]).concat([...Array(3).keys()].map(u => ['D', u]));
  for (const [g, u] of units) {
    const syn = getUnitSynergy(G.roster, g, u);
    // `zoneEtat`, PAS l'émoji du libellé : ajouter une étiquette (S62 en a
    // ajouté une, « hors de ses lignes ») ferait sinon rater les pires unités
    // sans que rien ne casse.
    if (syn.zoneEtat === 'optimal') optimal++;
    if (syn.zoneEtat === 'mal' || syn.zoneEtat === 'hors') miscast++;
    if (syn.zoneEtat === 'hors') hors++;
  }

  const tile = (k, v, cls, title) =>
    `<div class="sum-item" title="${esc(title)}"><div class="k">${k}</div><div class="v ${cls || ''}">${v}</div></div>`;

  if (surTable()) {
    // Sur table, ni zone ni chimie ni pénalité : les tuiles disent ce que
    // le plateau va lire — le tir des attaquants, la force des patineurs,
    // l'arrêt du partant. Des moyennes de nombres qui existent, rien de neuf.
    const habilles = SLOTS.filter(s => !s.scratch && G.roster[s.i]).map(s => [s, G.roster[s.i]]);
    const moy = (xs, k) => (xs.length ? (xs.reduce((a, p) => a + tableStats(p)[k], 0) / xs.length).toFixed(1) : '—');
    const att = habilles.filter(([s, p]) => s.group === 'F' && p.p !== 'G').map(([, p]) => p);
    const pat = habilles.filter(([, p]) => p.p !== 'G').map(([, p]) => p);
    const partant = habilles.find(([s]) => s.group === 'G')?.[1];
    host.innerHTML =
      tile('Masse', money(capUsed()), '', `Somme des salaires signés, sur un plafond de ${money(MODE().cap)}. Il reste ${money(capLeft())}.`)
      + tile('Vides', slotsLeft(), slotsLeft() ? 'dash-warn' : 'dash-good', `Cases encore à combler sur les ${totalCases()}.`)
      + tile('Tir', moy(att, 'TI'), '', `TI moyen des ${att.length} attaquants habillés — ${AXE_MOT.TI.toLowerCase()}. Sur six.`)
      + tile('Force', moy(pat, 'FO'), '', `FO moyen des ${pat.length} patineurs habillés — ${AXE_MOT.FO.toLowerCase()}. Sur six.`)
      + tile('Arrêt', partant ? tableStats(partant).AR : '—', '', `AR de ton partant — ${AXE_MOT.AR.toLowerCase()}. Sur six.`);
    return;
  }
  host.innerHTML =
    tile('Masse', money(capUsed()), '', `Somme des salaires signés, sur un plafond de ${money(MODE().cap)}. Il reste ${money(capLeft())}.`)
    + tile('Vides', slotsLeft(), slotsLeft() ? 'dash-warn' : 'dash-good', `Cases encore à combler sur les ${totalCases()}.`)
    // TROIS TUILES, DEUX UNITÉS DE COMPTE (S78) : les deux premières comptent des
    // TRIOS ET PAIRES (sur 7), la dernière des JOUEURS. Le libellé le dit ; il
    // disait « Mal placées » à côté de « Hors position » et on lisait deux fois
    // la même chose.
    + tile('Unités en place', `${optimal}/7`, optimal ? 'dash-good' : '', "Trios et paires dont tous les joueurs sont dans leur zone : le trio rend à plein. Les quatre trios et les trois paires comptent.")
    + tile('Unités mal placées', hors ? `${miscast} · ${hors}🚨` : miscast, miscast ? 'dash-bad' : '',
      `Unités où au moins un joueur joue hors de sa zone. Un cran d'écart ne coûte presque rien ; ${hors ? `${hors} unité${hors > 1 ? 's' : ''} est à deux crans ou plus, et là ça coûte cher.` : 'à deux crans ou plus, ça coûte cher.'}`)
    + tile('Joueurs hors position', oop, oop ? 'dash-warn' : '', 'Joueurs placés ailleurs qu\'à leur position naturelle. Chacun perd de 2 à 5 points sur toutes ses cotes.');
}

function renderMain() {
  const b = $('mainBtn');
  const reste = slotsLeft();
  const over = capLeft() < 0;
  if (G.banc) {
    b.disabled = reste > 0;
    b.textContent = `Retour au match · journée ${G.banc.jour}`;
    return;
  }
  b.disabled = reste > 0 || G.done || over;
  b.textContent = G.done ? (G.bonus === 'TABLE' ? 'Tournoi joué' : 'Saison jouée')
    : over ? `Plafond dépassé de ${money(-capLeft())}`
    : reste === 0 ? (G.bonus === 'TABLE' ? `Au tournoi sur table · ${CLUBS_TOURNOI} clubs` : 'Lancer la saison · 82 matchs')
    : `Encore ${reste} joueur${reste > 1 ? 's' : ''}`;
}

function render() {
  syncAgeControls();
  renderCap();
  renderSpin();
  renderDash();
  renderFilters();
  renderPool();
  renderPoolMeta();
  renderRoster();
  renderBanc();
  renderTeamSummary();
  renderMain();
  const hint = $('rosterHint');
  if (hint) {
    hint.textContent = G.selectedSlot !== null
      ? 'Touche une case pour le déplacer.'
      : G.target !== null
        ? 'Case ciblée : la prochaine signature ira là.'
        // LA LÉGENDE DES VERDICTS (S78) : ce que disent les marques d'une case,
        // une fois, au-dessus de l'alignement. Sur table, ni zone ni position.
        : surTable() ? 'Touche un joueur, puis sa case.'
          : 'Touche un joueur, puis sa case. ▼ ▲ hors de sa zone · −N hors position.';
  }
}

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
    return `<div class="profil-cell${T ? ' majore' : ''}" title="${esc(AXE_MOT[k])}${T ? ` — ${T.icon} ${T.label} : +1` : ''}"><div class="k">${k}</div><div class="v">${st[k]}<span class="profil-sur">/6</span></div></div>`;
  };
  return `<div class="profil-grid">${axesDe(p).map(cell).join('')}</div>
  <div class="tags fiche-table-tags">${tagsTableHtml(p, true)}</div>`;
}

function profilMesure(p) {
  const gp = Math.max(1, p.gp || 1);
  const [, pctTir, shF, shD, ptF, ptD, partButs, pimF] = seasonLancers(p.s);
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
  const prod = (p.pt || 0) / gp / (est_D ? (ptD || 0.35) : (ptF || 0.62));
  const vol = (p.sh || 0) / gp / (est_D ? (shD || 1.35) : (shF || 1.75));
  const pen = (p.pt || 0) >= 15 ? (p.g || 0) / p.pt - (partButs || 0.40) : 0;
  const dur = (p.pim || 0) / gp / (pimF || 0.90);

  // Avec la rondelle, puis sans : la seconde rangée porte ce qui décide des
  // étiquettes 🛡️ Défensif et 🪨 Robuste, en colonnes claires.
  const m = mesure(p);
  const signe = x => (x >= 0 ? '+' : '') + Math.round(x);
  return `<div class="profil-titre">Avec la rondelle</div>
  <div class="profil-grid">
    ${cell('PRODUCTION', r(prod), `Points par match, sur le régulier moyen de ${p.s}. 1,00 = la moyenne.`)}
    ${cell('LANCERS', r(vol), `Lancers par match, sur le régulier moyen de ${p.s}.`)}
    ${cell('CRÉATION', r(passesRelatives(p)), `Passes par match, sur le régulier moyen de ${p.s} à sa position. C'est ce qu'il apporte aux lancers des autres : ses coéquipiers finissent mieux à ses côtés.`)}
    ${cell('PENCHANT', (pen >= 0 ? '+' : '') + pen.toFixed(2), pen >= 0
      ? 'Il finit plus que la moyenne : ses points sont surtout des buts.'
      : 'Il sert plus qu\'il ne finit : ses points sont surtout des passes.')}
  </div>
  <div class="profil-titre">Sans la rondelle${m ? ` · défensive ${Math.round(m.def * 100)}e centile, robustesse ${Math.round(m.rob * 100)}e` : ''}</div>
  <div class="profil-grid">
    ${m ? cell('DIFFÉRENTIEL', signe(m.diff82), `Son +/- par 82 matchs, corrigé à moitié de celui de son club — un bon joueur d'un mauvais club n'est pas puni deux fois.`) : ''}
    ${m && m.dn82 != null ? cell('DÉSAVANTAGE', Math.round(m.dn82), `Points en désavantage numérique par 82 matchs : qui tue les punitions.`) : ''}
    ${p.toi ? cell('MINUTES', p.toi.toFixed(1), 'Temps de glace par match, en minutes.') : ''}
    ${cell('ROBUSTESSE', r(dur), `Minutes de punition par match, sur le régulier moyen de ${p.s}${p.ht != null ? ` · ${p.ht} mises en échec par match` : ''}.`)}
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
function statsSim(p, mode = 'saison') {
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
const compteEnGrille = c => c && {
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
function compteRevele(portee = 'jour') {
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
function porteeRevele(quoi = 'saison') {
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
function lienJoueur(p, t, mode = 'saison', html = null) {
  if (!p) return html ?? '';
  const cle = `${getPlayerKey(p)}|${mode}`;
  FICHES.set(cle, { p, t, mode });
  return `<button type="button" class="lien-joueur" data-fiche="${esc(cle)}" title="Fiche et statistiques ${MOT_MODE[mode] || MOT_MODE.saison}">${html ?? formatName(p.n)}</button>`;
}
const EQUIPES = new Map();
function lienEquipe(t, mode = 'saison', html = null) {
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
function ouvrirFiche(p, t, mode = 'saison') {
  if (mode !== 'jour' && mode !== 'jourSeries') { showPlayerModal(p, { sim: mode, team: t }); return; }
  showPlayerModal(p, {
    sim: compteEnGrille(compteRevele(mode).get(p)) || {}, team: t,
    titreSim: mode === 'jourSeries' ? 'Ses séries, à ce jour' : 'Sa saison, à ce jour',
  });
}

const cellStat = (k, v, hl = false) => `<div class="stat-cell${hl ? ' hl' : ''}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
const signe = n => (n > 0 ? `+${n}` : `${n}`);

/** La grille de statistiques simulées d'un joueur (patineur ou gardien). */
function grilleSim(p, S) {
  if (!S) return '<div class="dash-note">Aucun match joué.</div>';
  if (p.p === 'G') {
    const pct = S.SA ? (S.SV / S.SA).toFixed(3).slice(1) : '—';
    return cellStat('PJ', S.GP || 0) + cellStat('V', S.W || 0, true) + cellStat('D', S.L || 0)
      + (S.OTL === undefined ? '' : cellStat('DP', S.OTL))
      + cellStat('BL', S.SO || 0) + cellStat('MBA', ((S.GA || 0) / Math.max(1, S.GP || 1)).toFixed(2)) + cellStat('%ARR', pct)
      + cellStat('ARR', S.SV || 0) + cellStat('TIRS', S.SA || 0);
  }
  return cellStat('PJ', S.GP || 0) + cellStat('B', S.G || 0) + cellStat('A', S.A || 0) + cellStat('PTS', S.PTS || 0, true)
    + cellStat('PTS/M', S.GP ? ((S.PTS || 0) / S.GP).toFixed(2) : '—') + cellStat('+/-', signe(S.PM || 0))
    + cellStat('PUN', S.PIM || 0) + cellStat('L', S.SH || 0) + cellStat('%', S.SH ? (100 * (S.G || 0) / S.SH).toFixed(1) : '—')
    + (S.PPG === undefined ? '' : cellStat('BAN', S.PPG)) + (S.Inj ? cellStat('RATÉS', S.Inj) : '');
}

/**
 * La fiche. Sans option, c'est celle du bassin : la vraie saison, le profil,
 * l'impact sur ton alignement et le bouton Signer. Avec `sim`, c'est la
 * fiche d'APRÈS : les statistiques simulées d'abord (saison ou séries),
 * la vraie saison dessous pour comparer, et ni destination ni signature.
 */
function showPlayerModal(p, opts = {}) {
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
  const pmStr = signe(st.pm);
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
    + (p.ht != null ? cell('MÉ/M', p.ht) : '') + (p.fo != null ? cell('MJ %', Math.round(p.fo * 100)) : '');
  const plusDeDetails = `<details class="fiche-plus"><summary>Plus de détails</summary>
       ${detailStats ? `<div class="stat-grid">${detailStats}</div>` : ''}
       <div class="section-label">Profil mesuré, en écart au régulier moyen de sa saison</div>
       ${ratings}</details>`;

  const label = already ? '✓ Déjà signé' : !slot ? 'Aucune case libre' : over ? 'Hors budget' : `Signer · ${slot.role}`;
  const destNote = already ? ''
    : !slot ? `<div class="dash-note dash-bad">Toutes les cases compatibles sont prises. Déplace un joueur ou vise une autre position.</div>`
    : over ? `<div class="dash-note dash-bad">${money(p.$)} pour ${money(rem)} restants.</div>`
    : surTable() ? `<div class="dash-note">Ira au <strong>${esc(slotShort(slot))}</strong>. Sur table, ni zone ni pénalité de position : il joue sur ses nombres, où qu'on le mette. Il resterait ${money(rem - p.$)} pour ${slotsLeft() - 1} case${slotsLeft() - 1 > 1 ? 's' : ''}.</div>`
    : `<div class="dash-note${zoneEcart(p, slot) === 'sous' ? ' dash-bad' : ''}">Ira au <strong>${esc(slotShort(slot))}</strong>${pen > 0 ? ` avec une pénalité de <strong>−${pen}</strong> hors position` : ' sans pénalité de position'}${zoneEcart(p, slot) === 'sous' ? `, <strong>sous sa zone</strong> : son talent y est gaspillé et l'unité porte un malus. Vise une autre case ou déplace quelqu'un.` : zoneEcart(p, slot) === 'dessus' ? ', au-dessus de sa zone (−3 par cran, léger).' : ', dans sa zone.'} Il resterait ${money(rem - p.$)} pour ${slotsLeft() - 1} case${slotsLeft() - 1 > 1 ? 's' : ''}.</div>`;

  const nhlUrl = p.id ? `https://www.nhl.com/player/${p.id}` : `https://www.nhl.com/search?q=${encodeURIComponent(p.n)}`;
  const hdbUrl = `https://www.hockeydb.com/ihdb/stats/findplayer.php?full_name=${encodeURIComponent(p.n)}`;

  const equipeSim = opts.team ? `<span class="pcard-full-club">${getTeamLogoHtml(opts.team.tag, 14)} ${esc(teamLabel(opts.team))}</span>` : '';
  const corps = apercu ? plusDeDetails : apres
    ? `<div class="section-label">${esc(opts.titreSim || (opts.sim === 'series' ? 'Statistiques des séries' : 'Statistiques de la saison simulée'))} ${equipeSim}</div>
       <div class="stat-grid">${grilleSim(p, sim)}</div>
       ${opts.sim === 'series' && statsSim(p, 'saison') ? `<div class="section-label">Saison régulière simulée</div><div class="stat-grid">${grilleSim(p, statsSim(p, 'saison'))}</div>` : ''}
       ${plusDeDetails}`
    : surTable()
    ? `<div class="section-label">Sur la glace de table</div>
       ${ficheTable(p)}
       <div class="section-label">Impact sur ton alignement</div>
       ${destNote}`
    : `<div class="section-label">Impact sur ton alignement</div>
       ${destNote}
       ${plusDeDetails}`;

  /*
   * LA FICHE EST UNE CARTE, RECTO ET VERSO (S78). JP : *devant de carte
   * vertical, pour stats et face complète car portraits* ; puis *les cartes
   * devraient être verticales, pis recto verso même style, avec largeur
   * pleine*. Une seule carte debout, sur toute la largeur de la fiche (420 px
   * au plus, au bureau), dans le dessin de son ÉPOQUE et aux couleurs de son
   * CLUB (`ereDe`, style.css « LES ÈRES ») ; la variante n'est que la
   * finition, la même sur les deux faces. Les deux faces s'empilent dans la
   * même case : la carte a la taille de la plus haute, et elle ne change pas
   * de taille quand on la retourne.
   *   RECTO — le visage entier, la rondelle du poste, l'écusson et l'année ;
   *     le nom et le club ; la vraie saison (six nombres) ; le salaire.
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
  const band = getTeamBand(p.t);
  const numero = numeroDeCarte(getPlayerKey(p));
  const ere = classesDeCarte(p);
  const joue = traitsJoueur(p);
  const roles = p.p === 'G' ? '' : barresProfils(p);
  const saCarte = `<div class="cj-sa-carte"><span class="cj-sa-rarete tc-${rarete}" title="${esc(sensRarete(rarete))}">${R.gemme}${brillante(rarete) ? '✦' : ''} ${esc(NOM_VARIANTE[rarete] || R.nom)}</span>${joue.length
    ? joue.map(t => `<span class="cj-sa-trait"><b>${t.ico} ${esc(t.nom)}</b> — ${esc(t.mot)}</span>`).join('')
    : '<span class="cj-sa-trait">La carte de base : elle ne joue rien de plus.</span>'}</div>`;
  // La vraie saison, sur la carte : six nombres, comme au dos d'une vraie carte… mais au recto, où on les cherche.
  const nb = (k, v, hl = false) => `<div class="fc-stat${hl ? ' hl' : ''}"><span class="k">${k}</span><b>${v}</b></div>`;
  const statsCarte = p.p === 'G'
    ? nb('PJ', st.gp) + nb('V', st.w, true) + nb('D', st.l) + nb('BL', st.so) + nb('%ARR', p.sv ?? '—') + nb('MBA', p.ga ?? '—')
    : nb('PJ', st.gp) + nb('B', st.g) + nb('A', st.a) + nb('PTS', st.pt, true) + nb('+/-', pmStr) + nb('PUN', p.pim ?? '—');
  const etiquettes = `${traitTags(p, true)}${surTable() && !apres ? '' : mesureTags(p, true, roles) + zoneTag(p)}${realTag(p)}`;
  const milieuVerso = `${roles ? `<div class="fc-sec">Ce qu'il sait faire</div><div class="fiche-profils">${roles}</div>` : ''}
    ${etiquettes.trim() ? `<div class="tags fc-tags">${etiquettes}</div>` : ''}
    ${saCarte}
    ${sectionMods(p)}`;
  const verso = versoDeCarte(p, numero, rarete, milieuVerso, ere);
  body.innerHTML = `
    <div class="pcard-full" style="--team-logo:${logoFiligrane(p.t)};--card-primary:${colors.primary};--card-accent:${colors.accent};--team-band:${band.bg};--team-stripe:${band.stripe};--team-ink:${band.ink};--team-fond:${fondEquipe(p.t) || ''};--team-line:${couleurVive(p.t)}">
      <div class="fiche-carte">
        <div class="fc-faces">
          <div class="fc-face fc-recto pcard-full-photo cj-recto ${ere} tc-${rarete}" title="Touche la carte pour la retourner">
            <div class="cj-fenetre">
              <span class="cj-filigrane" aria-hidden="true"></span>
              ${brille(rarete) ? '<span class="cj-holo" aria-hidden="true"></span>' : ''}
              ${headshotHtml(p)}
              <span class="cj-dessus" aria-hidden="true"></span>
              ${rubanDe(p)}
              <span class="cj-rondelle ${positionClass(p)}">${esc(positionLabel(p))}</span>
              <span class="cj-coin-logo">${getTeamLogoHtml(p.t, 26)}</span>
              <span class="cj-annee">${esc(anneeDeCarte(p.s))}</span>
            </div>
            <div class="cj-bandeau"><div class="pcard-full-name">${formatName(p.n)}</div></div>
            <div class="fc-club">${esc(TEAMFULL[p.t] || p.t)}</div>
            <div class="fc-legende">Sa vraie saison${G.statsProrata ? ' · prorata 82 matchs, ajusté à l\'époque' : ''}</div>
            <div class="fc-stats">${statsCarte}</div>
            <div class="fc-pied">
              <span class="fc-salaire"><b>${st.salaryMain}</b><small>${[st.salarySub, G.salaryMode === 'ERA' ? '' : `${p.s} : ${money(st.eraSal)}`].filter(Boolean).join(' · ')}</small></span>
              <button type="button" class="cj-retourner" aria-label="Retourner la carte">↻ Verso</button>
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
        ${apres || apercu ? '' : `<button class="btn go" id="modalSignBtn" ${already || !slot || over ? 'disabled' : ''}>${label}</button>`}
      </div>
    </div>`;

  const btn = $('modalSignBtn');
  if (btn) {
    btn.onclick = () => {
      closeModal('hockeyCardModal');
      signPlayer(p);
    };
  }
  brancherRetournement(body.querySelector('.fiche-carte'));
  modal.classList.toggle('au-dessus', apercu);
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
function versoDeCarte(p, numero, rarete, milieu = '', ere = '') {
  const prim = positionLabel(p).split(' / ')[0];
  const vit = [];
  if (p.hgt) vit.push(['Taille', `${Math.floor(p.hgt / 12)}′${p.hgt % 12}″`]);
  if (p.wgt) vit.push(['Poids', `${p.wgt} lb`]);
  if (p.bd) { const [a, m, j] = String(p.bd).split('-').map(Number); if (a && m && j) vit.push(['Naissance', `${String(j).padStart(2, '0')}-${String(m).padStart(2, '0')}-${a}`]); }
  const age = ageAtSeason(p.bd, p.s);
  if (age) vit.push(['Âge', `${age} ans`]);
  const faits = [];
  if (p.x) faits.push('Échangé en cours de saison : il a porté deux chandails cette année-là.');
  if (rarete === 'legendaire') faits.push(`Tirage limité · exemplaire ${tirageLimite(getPlayerKey(p))}`);
  return `<div class="fc-face fc-verso cj-verso ${ere} tc-${rarete} fc-cachee" aria-hidden="true">
    <div class="cjv-tete"><span class="cjv-no" title="Numéro de la carte dans la série">${numero}</span><span class="cjv-nom">${esc(p.n)}</span><span class="cjv-pos">${esc(POSTE_MOT[prim] || 'Joueur')}</span></div>
    ${vit.length ? `<div class="cjv-table-wrap"><table class="cjv-table"><thead><tr>${vit.map(([k]) => `<th scope="col">${k}</th>`).join('')}</tr></thead><tbody><tr>${vit.map(([, v]) => `<td>${esc(v)}</td>`).join('')}</tr></tbody></table></div>` : ''}
    ${milieu}
    ${faits.map(f => `<p class="cjv-bio">${esc(f)}</p>`).join('')}
    <div class="fc-filigrane" aria-hidden="true">${getTeamLogoHtml(p.t, 120)}</div>
    <div class="cjv-pied"><span>© Cap 82-0 · ${TAILLE_SERIE} cartes</span><button type="button" class="cj-retourner" aria-label="Revenir au recto">↻ Recto</button></div>
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
    <td class="stat heros">${S.PTS || 0}</td><td class="stat">${signe(S.PM || 0)}</td><td class="stat">${S.PIM || 0}</td>
    <td class="stat">${S.SH || 0}</td><td class="stat">${S.PPG || 0}</td></tr>`;
  const ligneG = ([p, S]) => `<tr>
    <td class="left"><div class="team-cell">${lienJoueur(p, t, mode, `<span>${esc(p.n)}</span>`)}</div></td>
    <td class="sub-cell">G</td>
    <td class="stat">${S.GP || 0}</td><td class="stat heros">${S.W || 0}</td><td class="stat">${S.L || 0}</td><td class="stat">${S.OTL || 0}</td>
    <td class="stat">${((S.GA || 0) / Math.max(1, S.GP || 1)).toFixed(2)}</td><td class="stat">${S.SA ? (S.SV / S.SA).toFixed(3).slice(1) : '—'}</td>
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
      <thead><tr><th class="left">Joueur</th><th>Pos</th><th>PJ</th><th>B</th><th>A</th><th class="heros">PTS</th><th>+/-</th><th>PUN</th><th>L</th><th>BAN</th></tr></thead>
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

/* =====================================================================
   Historique
   ===================================================================== */

const lireHistorique = () => {
  try { return JSON.parse(localStorage.getItem('cap82_leaderboard') || '[]'); } catch { return []; }
};
const ecrireHistorique = list => {
  try { localStorage.setItem('cap82_leaderboard', JSON.stringify(list.slice(0, 20))); } catch { /* ignore */ }
};

/**
 * L'entrée est écrite au bilan de la SAISON, donc avant la première série :
 * elle porte donc un identifiant, et `majLeaderboard` vient y coudre le
 * verdict des séries quand elles sont jouées. Sans ça, le seul but du jeu —
 * la Coupe — n'était enregistré nulle part.
 */
/*
 * UNE SAISON, UNE ENTRÉE — et c'est la reprise qui l'a rendu nécessaire. Le
 * bilan se redessine à CHAQUE reprise, puisqu'un rafraîchissement rejoue la
 * saison depuis sa graine : chaque rafraîchissement empilait donc une entrée
 * de plus, et trois allers-retours dans les séries laissaient trois fois la
 * même saison dans l'historique. Pire, `G.lbId` pointait alors sur la
 * dernière, et la Coupe allait se coudre sur une entrée sans séries pendant
 * que celle qu'on regardait restait muette.
 *
 * L'identifiant est donc rendu à l'appelant : tant qu'il le repasse, c'est la
 * même entrée qu'on réécrit, à sa place dans la liste, avec son verdict de
 * séries intact (`entry` ne porte pas `series`).
 */
function saveLeaderboard(entry, id = null) {
  const list = lireHistorique();
  const deja = id ? list.find(x => x.id === id) : null;
  if (deja) { Object.assign(deja, entry); ecrireHistorique(list); return id; }
  const neuf = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  list.unshift({ id: neuf, ...entry });
  ecrireHistorique(list);
  return neuf;
}

/** Le verdict des séries d'une entrée, ou null : le texte de partage le lit. */
function lireSeriesHistorique(id) {
  const e = lireHistorique().find(x => x.id === id);
  return (e && e.series) || null;
}

/** Coudre le verdict des séries à l'entrée déjà écrite. */
function majLeaderboard(id, champs) {
  if (!id) return;
  const list = lireHistorique();
  const e = list.find(x => x.id === id);
  if (!e) return;
  Object.assign(e, champs);
  ecrireHistorique(list);
}

function showLeaderboard() {
  const body = $('leaderboardBody');
  if (!body) return;
  const list = lireHistorique();
  /*
   * DEUX VUES, UNE PAGE (S74) : tes saisons, et TON ALBUM — les cartes de
   * match gagnées d'une partie à l'autre, tes identités, et le cartable des
   * joueurs (js/album.js). L'album se déduit de cette même liste.
   */
  const vue = G.vueHistorique === 'album' ? 'album' : 'saisons';
  const bascule = `<div class="seg lb-vues" role="tablist"><button type="button" data-vue="saisons" class="${vue === 'saisons' ? 'on' : ''}">Tes saisons</button><button type="button" data-vue="album" class="${vue === 'album' ? 'on' : ''}">Ton album</button></div>`;
  const brancher = () => body.querySelectorAll('.lb-vues [data-vue]').forEach(b => { b.onclick = () => { G.vueHistorique = b.dataset.vue; showLeaderboard(); }; });
  if (vue === 'album') {
    body.innerHTML = bascule + albumHtml(list, { logo: getTeamLogoHtml, mug: headshotHtml });
    brancher();
    return;
  }

  if (!list.length) {
    body.innerHTML = bascule + `<div class="empty-msg">Aucune saison enregistrée.<br>Complète un alignement de 23 et simule pour apparaître ici.</div>`;
    brancher();
    return;
  }
  /*
   * « MEILLEURE » SE COMPARE À FORMAT ÉGAL. Un Express à six cases sous 34 M$
   * hors plafond ne se compare pas à un Complet : le meilleur total était
   * calculé tous formats confondus, donc une seule partie express suffisait à
   * couronner ou à écraser tout le reste.
   */
  const meilleur = {};
  for (const i of list) {
    const k = i.mode || 'CLASSIQUE';
    meilleur[k] = Math.max(meilleur[k] || 0, i.points || 0);
  }
  const coupes = list.filter(i => i.series && i.series.coupe).length;
  const tete = `<div class="lb-tete">${list.length} saison${list.length > 1 ? 's' : ''}`
    + (coupes ? ` · <strong>${coupes} Coupe${coupes > 1 ? 's' : ''}</strong> 🏆` : ' · aucune Coupe')
    + `</div>`;

  body.innerHTML = bascule + tete + list.map((i, idx) => {
    // LE VERDICT DES SÉRIES. Une entrée d'avant ce changement n'en a pas :
    // elle ne dit rien plutôt que de prétendre que la Coupe a été perdue.
    const po = i.series;
    const verdict = !po ? ''
      : po.coupe ? `<span class="lb-coupe">🏆 Coupe</span>`
      : `<span class="lb-sortie">${esc(po.ronde || 'éliminé')}</span>`;
    const fiche = po && Number.isFinite(po.V) ? ` · séries ${po.V}-${po.D}` : '';
    const format = MODES[i.mode] ? MODES[i.mode].nom : null;
    return `
    <div class="lb-item${po && po.coupe ? ' champion' : ''}">
      <div>
        <div class="lb-score ${i.W === 82 ? 'perfect' : ''}">${i.W}-${i.L}-${i.OTL}</div>
        <div class="dash-note">${i.points} pts · différentiel ${i.GF - i.GA > 0 ? '+' : ''}${i.GF - i.GA}${i.points === meilleur[i.mode || 'CLASSIQUE'] ? ' · <span class="dash-warn">meilleure</span>' : ''}</div>
        ${verdict ? `<div class="lb-verdict">${verdict}${fiche}</div>` : ''}
      </div>
      <div class="lb-details">
        <div>${i.rank ? `${i.rank === 1 ? '1er' : `${i.rank}e`} de ${i.nTeams}` : ''}${i.epoque ? ` · saison ${esc(i.epoque)}` : ''}</div>
        <div>${format ? `${esc(format)} · ` : ''}Masse : ${money(i.capUsed)}</div>
        <div>${esc(i.date)}</div>
        ${Array.isArray(i.alignement) ? `<button class="btn small lb-replay" data-idx="${idx}" title="Relire ces 23 joueurs et jouer une nouvelle saison">${ico('i-dice')}Rejouer</button>` : ''}
      </div>
    </div>`;
  }).join('');
  body.querySelectorAll('.lb-replay').forEach(b => {
    b.onclick = () => reprendreAlignement(list[Number(b.dataset.idx)]);
  });
  brancher();
}

/* =====================================================================
   Simulation
   ===================================================================== */

const bar = (label, val) => {
  const pct = Math.max(0, Math.min(100, (val - 25) / 74 * 100));
  return `<div class="bar"><div class="bl">${label}</div>
    <div class="bt"><div class="bf" style="width:${pct}%"></div></div>
    <div class="bv">${Math.round(val)}</div></div>`;
};

/**
 * Adversaires : de vraies équipes historiques prises dans les saisons déjà
 * chargées, alignées automatiquement. Les joueurs déjà signés sont exclus.
 * `epoque` borne le tirage à une saison (celle de la ligue, par défaut) et
 * `tous` dit qu'on prend TOUS ses clubs, dans l'ordre du shard — c'est la
 * ligue d'une saison — plutôt que `count` clubs tirés au hasard : le tournoi
 * dans les 55 saisons, ou l'exhibition dans une saison donnée.
 */
async function buildOpponents(count, { epoque = G.epoque, tous = !!epoque } = {}) {
  // Par joueur-SAISON : sans ça, un adversaire pouvait aligner le même homme
  // que toi sous les couleurs de l'autre équipe où il a passé cette année-là.
  const exclude = new Set(picked().map(getPersonKey));
  const cands = [], seen = new Set();
  // UNE SAISON : la ligue, c'est tous les vrais clubs de cette année-là.
  if (epoque) { try { await getShard(epoque); } catch { /* le shard est déjà là depuis la roulette */ } }
  const collect = () => {
    for (const [season, entry] of G.shards) {
      if (epoque && season !== epoque) continue;
      for (const [team, pool] of Object.entries(entry.byTeam)) {
        const key = `${season}_${team}`;
        if (seen.has(key)) continue;
        const nF = pool.filter(p => p.p === 'F').length;
        const nD = pool.filter(p => isD(p)).length;
        const nG = pool.filter(p => p.p === 'G').length;
        if (nF < 12 || nD < 6 || nG < 2) continue;
        seen.add(key);
        cands.push({ season, team, pool });
      }
    }
  };
  collect();
  let tries = 0;
  while (!epoque && cands.length < count && tries++ < 12) {
    try { await getShard(rnd(state.index.seasons)); } catch { /* on réessaie */ }
    collect();
  }
  // `exclude` s'accumule : deux équipes de la ligue ne peuvent pas habiller
  // le même joueur-saison, ce qui arrivait pour un joueur échangé quand les
  // deux clubs de la transaction sortaient tous les deux au tirage.
  // Une saison fixée prend TOUS ses clubs, dans l'ordre du shard, et personne
  // n'est retranché : ta formation est la 33e équipe (voir runSeason).
  const out = [];
  for (const c of tous ? cands : cands.sort(() => Math.random() - 0.5)) {
    if (!tous && out.length >= count) break;
    const roster = autoRoster(c.pool, exclude);
    for (const p of Object.values(roster)) exclude.add(getPersonKey(p));
    out.push(createTeam(`${c.team} ${c.season}`, c.team, roster, { season: c.season }));
  }
  return out;
}

/**
 * La saison. Sans option, 31 vraies équipes sont tirées et le moteur tire
 * sa graine ; `adversaires` rejoue les mêmes 31 clubs (« Rejouer la
 * saison ») et `graine` la même suite de dés. La ligue jouée garde les deux
 * dans `G.ligue`, et l'historique les emporte.
 */
/**
 * REBÂTIR LES ADVERSAIRES D'UNE PARTIE REPRISE. La sauvegarde ne porte que
 * leurs clés `saison_équipe`, dans l'ORDRE où `buildOpponents` les avait
 * tirées — et c'est l'ordre qui compte : `exclude` s'accumule d'un club au
 * suivant (deux équipes ne peuvent pas habiller le même joueur-saison), donc
 * rejouer la même liste dans le même ordre redonne exactement les mêmes
 * alignements. Les shards manquants se rechargent.
 */
async function rebatirAdversaires(cles, decisions = []) {
  const exclude = new Set(picked().map(getPersonKey));
  // Un joueur libéré au ballottage était repêché quand la ligue s'est bâtie :
  // il reste exclu, sinon un adversaire rebâti pourrait l'habiller.
  for (const d of decisions) if (d.ballottage) for (const cle of [d.ballottage.entre, d.ballottage.sort]) {
    const p = cle && ballottageVu.get(cle);
    if (p) exclude.add(getPersonKey(p));
  }
  const out = [];
  for (const cle of cles) {
    const [season, team] = String(cle).split('|');
    if (!season || !team) continue;
    let entry = G.shards.get(season);
    if (!entry) { try { entry = await getShard(season); } catch { continue; } }
    const pool = entry?.byTeam?.[team];
    if (!pool) continue;
    const roster = autoRoster(pool, exclude);
    for (const p of Object.values(roster)) exclude.add(getPersonKey(p));
    out.push({ name: `${team} ${season}`, tag: team, roster, season });
  }
  return out;
}

/* ======================================================================
   DERRIÈRE LE BANC — les choix en saison
   ======================================================================
   JP : *faire que ya plus de choix à faire pendant la saison* ; *ça peut être
   nice de pouvoir faire des lockdown lines qui bloquent mieux les
   adversaires*. La saison se jouait d'un coup et l'écran révélait ; ce qu'on
   avait signé au repêchage était l'alignement des 82 matchs, blessures
   comprises. Le moteur étant déterministe, une décision au jour k rejoue les
   k premières journées à l'identique et diverge ensuite (`simulateLeague`,
   `decisions`) — c'est ce qui permet de fermer l'écran de saison, de
   toucher à ses trios, et de reprendre exactement là.

   Ce qu'on voit derrière le banc est CE QUI EST ARRIVÉ, jamais ce qui va
   arriver : les fiches se cumulent des feuilles des journées révélées
   (`compterFeuilles`), les blessés sont ceux du jour avec les matchs qu'il
   leur reste. Les compteurs `sim*` des joueurs, eux, portent la fin de la
   saison — on ne les lit pas ici.
   ====================================================================== */

/** L'écran de saison se retire ; l'alignement s'ouvre avec les fiches à ce jour. */
function ouvrirBanc(jour) {
  const L = G.ligue;
  if (!L || !L.calendrier) return;
  const vus = L.calendrier.slice(0, jour);
  const compte = compterFeuilles(vus.flat().map(m => m.feuille));
  const miens = vus.map(j => j.find(m => m.A === L.you || m.B === L.you)).filter(Boolean);
  const fiche = { W: 0, L: 0, OTL: 0 };
  for (const m of miens) {
    const gagne = (m.A === L.you) === (m.gfA > m.gfB);
    if (gagne) fiche.W++; else if (m.ot) fiche.OTL++; else fiche.L++;
  }
  // Les blessés à ce jour, comme l'écran de saison les compte (`at` est le
  // numéro du match de l'équipe, pas de la journée).
  const joues = miens.length;
  const blesses = new Map();
  for (const b of (L.you.injuriesLog || [])) {
    const reste = b.at + b.games - (joues + 1);
    if (b.at <= joues + 1 && reste > 0) blesses.set(b.player, reste);
  }
  let prochain = null;
  for (let j = jour; j < L.calendrier.length && !prochain; j++) {
    const m = L.calendrier[j].find(x => x.A === L.you || x.B === L.you);
    if (m) prochain = { j, adv: m.A === L.you ? m.B : m.A };
  }
  const derniere = (L.decisions || [])[L.decisions.length - 1] || {};
  /*
   * LES RÉGLAGES EN VIGUEUR SE LISENT SUR L'ÉQUIPE, jamais sur la dernière
   * décision : celle-ci peut être une CARTE, qui ne porte ni fermeture, ni
   * plan, ni roulement — et le banc remettrait alors tout à « auto » en
   * écrivant sa décision, donc effacerait un choix en silence.
   */
  G.banc = {
    jour, compte, blesses, prochain, fiche, N: L.calendrier.length,
    fermeture: L.you.fermeture ?? derniere.fermeture ?? 'auto',
    plan: planDe(L.you), roulement: roulementDe(L.you),
    // Les lignes EN VIGUEUR et leur état au jour du banc (S68).
    lignes: lignesDe(L.you, G.roster),
    chimie: ((L.you.jourLignes || [])[jour] || {}).chimie || [0, 0, 0, 0],
    energie: ((L.you.jourLignes || [])[jour] || {}).energie || {},
    apprentissage: ((L.you.jourLignes || [])[jour] || {}).apprentissage || null,
  };
  $('game').classList.add('banc');
  G.selectedSlot = null; G.target = null;
  setView('roster');
  render();
  // Le panneau du banc est la première chose à voir : on remonte après le
  // rendu, pas avant (l'écran de saison vient de rendre le défilement au corps).
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

/** Le trio de fermeture tel que le banc le montre : le désigné, ou celui que 'auto' prendrait. */
function fermetureCourante() {
  if (!G.banc) return null;
  return G.banc.fermeture === 'auto' ? trioDeFermetureAuto() : G.banc.fermeture;
}

/** Retour au match : la décision entre dans la liste, la saison se rejoue de la graine et reprend là. */
async function reprendreSaison() {
  const b = G.banc;
  if (!b || !G.ligue) return;
  // EN SÉRIES (S69), le banc renvoie aux séries : c'est une décision de série.
  if (b.serie) {
    G.banc = null;
    $('game').classList.remove('banc');
    await deciderSerie({ ronde: b.serie.ronde, match_no: b.serie.k, cases: photoAlignement(G.roster), fermeture: b.fermeture, lignes: b.lignes });
    return;
  }
  // Le SEL (S68) : des dés neufs pour la suite, voir `simulateLeague`.
  const d = { jour: b.jour, cases: photoAlignement(G.roster), fermeture: b.fermeture, lignes: b.lignes, sel: nouvelleGraine() };
  // On ne remplace que la décision de BANC du même jour : une carte, un plan
  // du soir ou un dilemme pris ce jour-là restent.
  const decisions = (G.ligue.decisions || []).filter(x => x.jour !== b.jour || x.jour === 0 || !x.cases);
  decisions.push(d);
  G.banc = null;
  $('game').classList.remove('banc');
  renderMain();
  // La MÊME saison, avec une décision de plus : elle garde son entrée d'historique.
  await continuerSaison(decisions, b.jour, 'La saison reprend avec ton alignement…');
}

/*
 * PRENDRE UNE CARTE DE SAISON. C'est une DÉCISION comme le banc : elle entre
 * dans `G.ligue.decisions`, donc dans la sauvegarde, et la saison se rejoue
 * de la graine avec elle. Un palier ne se prend qu'une fois — le filtre
 * enlève une carte déjà prise au même PALIER, pour qu'un rechargement ou un
 * double clic n'en empile pas deux.
 *
 * `palier` et `jour` sont deux choses : le palier est l'offre, le jour est
 * l'instant où elle entre en vigueur. Rejouer depuis le PALIER rembobinerait
 * la saison pour qui a laissé passer l'offre et l'a prise vingt journées
 * plus tard ; on rejoue donc depuis le jour courant.
 */
/*
 * LA CARTE QU'ON N'A PAS CHOISIE. JP : *pour les blessures, faire que si pas
 * de joueur à la position, carte random pigée*. Quand un match se joue avec
 * une case que personne ne peut remplir, le vestiaire s'ajuste — et la carte
 * est TIRÉE, pas offerte. Elle passe par exactement la même machinerie qu'un
 * palier (une décision `{ jour, carte, palier }`, donc rejouée de la graine),
 * avec un palier nommé `trou:<match>` pour qu'elle n'entre jamais en
 * collision avec les paliers 20 / 40 / 60 et qu'un même épisode ne puisse
 * pas en donner deux.
 *
 * Ce n'est PAS une compensation : toutes les cartes portent un bonus ET un
 * malus, donc celle-ci peut très bien ne pas t'arranger. C'est ce qu'est une
 * crise d'effectif — un ajustement qu'on subit. Mesuré : 1,02 épisode par
 * équipe par saison, donc le budget passe de trois cartes à quatre dans les
 * mauvaises années, jamais plus de huit au pire cas observé.
 */
async function subirCarte(at, jour, cle) {
  if (!G.ligue || !CARTES[cle]) return;
  const palier = `trou:${at}`;
  const decisions = (G.ligue.decisions || []).filter(x => !(x.carte && x.palier === palier));
  decisions.push({ jour, carte: cle, palier, sel: nouvelleGraine() });
  await continuerSaison(decisions, jour, 'La saison reprend…');
}

/*
 * UN MOMENT (S66) : plan du soir, dilemme, séquence, objectif, verdict du
 * proprio. Une seule porte d'entrée : la décision entre dans la liste (en
 * remplaçant celle du même palier, ou le plan du même soir), et la saison se
 * rejoue de la graine depuis la journée où on est.
 */
async function deciderSaison(d, depuis) {
  if (!G.ligue) return;
  // Le joueur réclamé doit être connu du moteur AVANT la saison rejouée.
  if (d.ballottage) connaitre(ballottageVu.get(d.ballottage.entre));
  if (d.ballottage && d.ballottage.entre) ajouterAuCartable([{ cle: d.ballottage.entre, rar: d.ballottage.rar || 'commune', num: d.ballottage.num || null }], { doublons: false });
  const decisions = (G.ligue.decisions || []).filter(x =>
    !(d.palier !== undefined && x.palier === d.palier) && !(d.soir && x.soir && x.jour === d.jour)
    && !(d.lignes && x.lignes && !x.cases && x.jour === d.jour) && !(d.match && x.match && x.jour === d.jour)
    // LES GROS MATCHS (S70) : un avant-match et un entracte par soir. Toute
    // autre décision rejoue le match depuis le début : l'entracte déjà choisi
    // ne vaut plus, il sera redemandé sur le nouveau pointage.
    && !(d.avant && x.avant && x.jour === d.jour) && !(x.entracte && (d.entracte ? x.jour === d.jour : x.jour >= d.jour)));
  // UNE DÉCISION QUI NE TOUCHE QUE LE DECK DE MATCH (une récompense, un
  // ménage) ne tire pas de dés neufs : le moteur ne la lit pas, les matchs ne
  // doivent pas bouger (S74).
  // S79 : ni une carte de masse salariale, ni une vente, ni un pack ouvert sans signature — le moteur ne les lit pas.
  const deckSeul = d.recompense !== undefined || d.deck === 'menage' || d.deck === 'camp' || !!d.plafond || !!d.vend || (!!d.achat && !d.ballottage);
  decisions.push(deckSeul ? { ...d } : { ...d, sel: nouvelleGraine() });
  await continuerSaison(decisions, depuis, 'La saison reprend avec ton choix…');
  // Le plafond de la barre du haut suit une recrue ou un joueur réclamé.
  if (d.ballottage || d.plafond || d.patron || d.achat) renderCap();
  confirmerDecision(d);
}

/*
 * UNE DÉCISION S'APPLIQUE À PARTIR D'AUJOURD'HUI (S79). La ligue ne joue que
 * ce qui est révélé : une décision datée d'aujourd'hui ou plus tard entre dans
 * la liste de la ligue EN MÉMOIRE, et l'écran se rouvre sur la même journée —
 * rien n'est rejoué, pas de voile. Seule une décision datée d'une journée
 * DÉJÀ jouée (l'entracte d'un gros match qu'on regarde en direct : le soir
 * est joué pour être montré) reconstruit la ligue, et seulement jusqu'à
 * aujourd'hui : le passé se rejoue à l'identique de la graine, rien d'avance.
 */
async function continuerSaison(decisions, depuis, mot) {
  const L = G.ligue, M = L && L.moteur;
  const avant = new Set(L.decisions || []), apres = new Set(decisions);
  const touchees = [...decisions.filter(d => !avant.has(d)), ...(L.decisions || []).filter(d => !apres.has(d))];
  const jourMin = touchees.length ? Math.min(...touchees.map(d => d.jour)) : Infinity;
  if (M && jourMin >= M.jour) {
    L.decisions = M.decisions = decisions;
    // Le joueur signé (un pack, le ballottage) entre dans l'alignement tout de suite (S79).
    poserAlignementDuJour(M);
    G.done = true;
    ouvrirEcranSaison(depuis);
    saveGame();
    return;
  }
  G.done = false;
  renderMain();
  await sousVoile(mot, () => runSeason({ adversaires: L.adversaires, graine: L.graine, depuis, decisions, reprise: true }));
}

/*
 * LE VOILE DE L'ATTENTE (S74b). Une décision rejoue la saison — deux à quatre
 * secondes de calcul sur un téléphone — et l'écran disparaissait sans un mot
 * entre le choix et la saison rouverte. Un voile le dit, peint AVANT le calcul
 * (deux images d'animation : le calcul bloque le fil, et un voile posé juste
 * avant ne serait jamais dessiné).
 */
function voile(on, mot = 'On rejoue la saison avec ton choix…') {
  let v = $('voile');
  if (!v) {
    v = document.createElement('div');
    v.id = 'voile'; v.className = 'voile'; v.hidden = true;
    v.setAttribute('role', 'status');
    v.innerHTML = '<div class="voile-boite"><span class="voile-glace"><i class="voile-rondelle"></i></span><span class="voile-mot"></span></div>';
    document.body.appendChild(v);
  }
  v.querySelector('.voile-mot').textContent = mot;
  v.hidden = !on;
}
const peindre = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
async function sousVoile(mot, f) {
  voile(true, mot);
  await peindre();
  try { return await f(); } finally { voile(false); }
}

/*
 * CE QUE TU VIENS DE FAIRE, DIT (S74). L'agent de test : « rien ne confirme
 * qu'on a pris une récompense, fait le ménage ou amélioré un joueur », et une
 * recrue restait en réserve sans qu'on sache qu'il fallait la monter.
 */
function confirmerDecision(d) {
  const M = d.mutation && MUTATIONS[d.mutation.cle];
  const qui = cle => { const p = Object.values(G.roster).find(x => x && getPlayerKey(x) === cle) || ballottageVu.get(cle); return p ? p.n : 'ton joueur'; };
  const C = k => CARTES_MATCH[k];
  let mot = null;
  if (d.recompense && C(d.recompense)) mot = `🎁 ${C(d.recompense).nom} rejoint ton deck.`;
  else if (d.deck === 'menage' && C(d.retrait)) mot = `🗑️ ${C(d.retrait).nom} quitte ton deck.`;
  else if (d.deck === 'camp' && C(`${d.aiguise}+`)) mot = `🏋️ ${C(`${d.aiguise}+`).nom} : ta carte est améliorée.`;
  else if (d.deck === 'recrue' && d.ballottage) mot = `🎟️ ${qui(d.ballottage.entre)} arrive en réserve. Monte-le dans un trio : derrière le banc.`;
  else if ((d.deck === 'amelioration' || d.deck === 'profil' || d.deck === 'atelier') && M) mot = `${M.ico} ${qui(d.mutation.joueur)} : ${M.nom.toLowerCase()}.`;
  else if (d.deck === 'strategie' && d.maitrise && systemeDe(d.maitrise.tac)) mot = `📘 ${systemeDe(d.maitrise.tac).groupe === 'D' ? 'Tes défenseurs apprennent' : 'Tes avants apprennent'} : ${systemeDe(d.maitrise.tac).nom.toLowerCase()}.`;
  // La carte du proprio (objectif atteint) : la seule carte prise sans un mot (QA S74b).
  else if (d.carte && CARTES[d.carte]) mot = `${CARTES[d.carte].ico} ${CARTES[d.carte].nom} : pour le reste de la saison.`;
  if (mot) toast(mot);
}

/*
 * LE BALLOTTAGE (S66). JP : *ballottage sur blessure*. Quand un joueur se
 * blesse pour de bon, trois vrais joueurs pas chers sont au ballottage : de la
 * même position, des MÊMES saisons que la ligue, mais de clubs qui n'y sont
 * pas, et personne qui y joue déjà. En réclamer un le met dans la case de
 * réserve de sa position ; celui qui l'occupait est libéré, et le plafond
 * compte toujours. Le tirage est PUR (la graine et le match), donc la même
 * blessure offre les mêmes trois noms à la reprise.
 */
const RESERVE_DE = { F: 'Réserve F', D: 'Réserve D', G: 'Réserve' };
const POSTE_GROUPE = { F: 'Avant', D: 'Défenseur', G: 'Gardien' };
const PLAFOND_BALLOTTAGE = 0.03;          // la part du plafond qu'un joueur réclamé peut coûter
const groupeDe = p => (p.p === 'G' ? 'G' : isD(p) ? 'D' : 'F');
const ballottageVu = new Map();
function candidatsBallottage(blesse, at) {
  const L = G.ligue;
  if (!L || !blesse || !L.cles) return null;
  const g = groupeDe(blesse);
  const slot = SLOTS.find(s => s.scratch && s.role === RESERVE_DE[g]);
  if (!slot) return null;
  const sort = G.roster[slot.i] || null;
  const budget = Math.min(capLeft() + (sort ? sort.$ : 0), MODE().cap * PLAFOND_BALLOTTAGE);
  const dansLaLigue = new Set();
  for (const t of L.teams || []) for (const p of Object.values(t.roster || {})) if (p) dansLaLigue.add(getPersonKey(p));
  const clubs = new Set(L.cles);
  const pool = [];
  for (const s of new Set(L.cles.map(c => String(c).split('|')[0]))) {
    const e = G.shards.get(s);
    if (!e) continue;
    for (const [tag, joueurs] of Object.entries(e.byTeam)) {
      if (clubs.has(`${s}|${tag}`)) continue;
      for (const p of joueurs) {
        if ((p.gp || 0) < 20 || !(p.$ > 0) || p.$ > budget || groupeDe(p) !== g || dansLaLigue.has(getPersonKey(p))) continue;
        pool.push(p);
      }
    }
  }
  const h = str => { let x = ((Number(L.graine) >>> 0) ^ Math.imul(at + 1, 2654435761)) >>> 0; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
  // Des offres qui valent la peine : les quinze meilleurs producteurs pas
  // chers (points par match, ou % d'arrêts), puis trois d'entre eux tirés
  // de la graine. Un tirage parmi TOUS les pas chers offrait des joueurs à
  // deux points en trente-sept matchs.
  const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? (p.g + p.a)) || 0) / Math.max(1, p.gp));
  pool.sort((a, b) => prod(b) - prod(a));
  pool.length = Math.min(pool.length, 15);
  pool.sort((a, b) => h(getPlayerKey(a)) - h(getPlayerKey(b)));
  const out = [], vus = new Set();
  for (const p of pool) {
    if (vus.has(getPersonKey(p))) continue;
    vus.add(getPersonKey(p)); out.push(p);
    if (out.length === 3) break;
  }
  for (const p of out) ballottageVu.set(getPlayerKey(p), p);
  const ligne = ligneDuChoix;
  // Le joueur et sa rareté voyagent avec l'offre (S76) : le ballottage se
  // présente en CARTES de joueur, portrait et métal compris, comme la recrue.
  return {
    i: slot.i, sort: sort ? getPlayerKey(sort) : null, sortNom: sort ? sort.n : null,
    candidats: out.map(p => ({ cle: getPlayerKey(p), p, nom: p.n, club: `${p.t} ${p.s}`, pos: p.p, poste: POSTE_GROUPE[g], salaire: money(p.$), ligne: ligne(p), rarete: rareteJoueur(p) })),
  };
}
/*
 * LA RECRUE DU DECK (S73). JP : *des cartes style événement qui permettent
 * d'aller chercher un joueur au choix, loto*. La carte « Joueur au choix »
 * d'une main de palier offre trois vrais joueurs — UN PAR POSITION (avant,
 * défenseur, gardien), parce que le choix intéressant est « où est-ce que je
 * renforce », pas « lequel des trois centres ». Mieux que le ballottage, qui
 * bouche un trou : le budget est TOUT l'espace sous le plafond plus le salaire
 * du réserviste libéré (pas 3 % du plafond), et on tire parmi les huit
 * meilleurs producteurs qui y rentrent, pas les quinze. Mêmes règles pour le
 * reste : des saisons de la ligue, des clubs qui n'y sont pas, personne qui y
 * joue déjà. La recrue prend la case de réserve de sa position ; c'est une
 * décision de ballottage, donc la reprise la retrouve comme les autres.
 */
const RECRUE_MEILLEURS = 8;
function candidatsRecrue(palier) {
  const L = G.ligue;
  if (!L || !L.cles) return [];
  const dansLaLigue = new Set();
  for (const t of L.teams || []) for (const p of Object.values(t.roster || {})) if (p) dansLaLigue.add(getPersonKey(p));
  const clubs = new Set(L.cles);
  const saisons = [...new Set(L.cles.map(c => String(c).split('|')[0]))];
  const h = str => { let x = ((Number(L.graine) >>> 0) ^ Math.imul(palier + 7919, 2654435761)) >>> 0; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
  const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? (p.g + p.a)) || 0) / Math.max(1, p.gp));
  const ligne = ligneDuChoix;
  const out = [];
  for (const g of ['F', 'D', 'G']) {
    const slot = SLOTS.find(sl => sl.scratch && sl.role === RESERVE_DE[g]);
    if (!slot) continue;
    const sort = G.roster[slot.i] || null;
    const budget = capLeft() + (sort && !estRenfort(sort) ? sort.$ : 0);
    const pool = [];
    for (const sa of saisons) {
      const e = G.shards.get(sa);
      if (!e) continue;
      for (const [tag, joueurs] of Object.entries(e.byTeam)) {
        if (clubs.has(`${sa}|${tag}`)) continue;
        for (const p of joueurs) {
          if ((p.gp || 0) < (g === 'G' ? 20 : 40) || !(p.$ > 0) || p.$ > budget || groupeDe(p) !== g || dansLaLigue.has(getPersonKey(p)) || isPicked(p)) continue;
          pool.push(p);
        }
      }
    }
    if (!pool.length) continue;
    pool.sort((a, b) => prod(b) - prod(a));
    pool.length = Math.min(pool.length, RECRUE_MEILLEURS);
    pool.sort((a, b) => h(getPlayerKey(a)) - h(getPlayerKey(b)));
    const p = pool[0];
    ballottageVu.set(getPlayerKey(p), p);
    out.push({
      cle: getPlayerKey(p), p, nom: p.n, poste: POSTE_GROUPE[g], club: `${p.t} ${p.s}`, salaire: money(p.$), ligne: ligne(p),
      i: slot.i, sort: sort ? getPlayerKey(sort) : null, sortNom: sort ? sort.n : null,
      // Sa carte a la rareté de son salaire, comme partout (S76) — plus une
      // légendaire d'office parce que la carte du deck qui l'offre l'est.
      rarete: rareteJoueur(p),
    });
  }
  return out;
}

/* À la reprise : les joueurs d'un ballottage (réclamés et libérés) se retrouvent dans leurs shards. */
async function connaitreBallottages(decisions) {
  for (const d of decisions || []) {
    if (!d.ballottage) continue;
    for (const cle of [d.ballottage.entre, d.ballottage.sort]) {
      if (!cle) continue;
      const [s, t] = String(cle).split('_');
      let e = G.shards.get(s);
      if (!e) { try { e = await getShard(s); } catch { continue; } }
      const p = (e.byTeam[t] || []).find(x => getPlayerKey(x) === cle);
      if (p) { connaitre(p); ballottageVu.set(cle, p); }
    }
  }
}

/*
 * UNE DÉCISION DE SÉRIES (S69) : trios, lignes, consigne, ajustement entre
 * deux rounds. Elle remplace celle du même genre au même match, porte son
 * sel, et les séries se rejouent — la saison d'abord, qui pose le
 * générateur, puis les rondes jusqu'où on les avait regardées.
 */
async function deciderSerie(d) {
  if (!G.ligue) return;
  const meme = x => x.ronde === d.ronde && x.match_no === d.match_no && (
    (d.cases && x.cases) || (d.lignes && !d.cases && x.lignes && !x.cases) || (d.match && x.match) || (d.ajustement && x.ajustement)
    // S74 : une main par match, une récompense par série.
    || (d.main && x.main) || (d.recompense !== undefined && x.recompense !== undefined)
    // S70 : un entracte par match, et toute autre décision pour ce match l'annule.
    || !!x.entracte);
  // Une récompense de série ne touche que le deck : pas de dés neufs (S74).
  const avant = G.ligue.decisionsSeries || [];
  G.ligue.decisionsSeries = [...avant.filter(x => !meme(x)), d.recompense !== undefined ? { ...d } : { ...d, sel: nouvelleGraine() }];
  const vues = G.seriesVues;
  saveGame();
  /*
   * EN AVANT (S79) : une décision pour un match PAS ENCORE JOUÉ (ou une
   * récompense, que le moteur ne lit pas) entre dans le moteur des séries en
   * mémoire, et l'écran se rouvre — rien n'est rejoué. Seul l'entracte d'un
   * match qu'on regarde (joué pour être montré) reconstruit, jusque-là.
   */
  const S = G.seriesMoteur;
  const pasJoue = S && (d.match_no < 0 || d.ronde > S.ronde || (d.ronde === S.ronde && d.match_no >= S.k));
  const retire = avant.filter(meme);
  const retireJoue = S && retire.some(x => x.match_no >= 0 && (x.ronde < S.ronde || (x.ronde === S.ronde && x.match_no < S.k)));
  if (pasJoue && !retireJoue) {
    S.decisions = G.ligue.decisionsSeries;
    ouvrirEcranSeries(vues);
    if (d.recompense) confirmerDecision(d);
    return;
  }
  G.done = false;
  renderMain();
  await sousVoile('On rejoue les séries avec ton choix…', async () => {
    await runSeason({ adversaires: G.ligue.adversaires, graine: G.ligue.graine, depuis: Infinity, decisions: G.ligue.decisions, reprise: true });
    reprendreSeries(vues);
  });
  if (d.recompense) confirmerDecision(d);
}
/* Le banc pendant les séries : l'alignement de fin de saison, et le retour renvoie aux séries. */
function bancSerie(ronde, k) {
  if (!G.ligue || !G.ligue.calendrier) return;
  ouvrirBanc(G.ligue.calendrier.length);
  if (G.banc) { G.banc.serie = { ronde, k }; renderBanc(); }
}

async function choisirCarte(palier, jour, cle, depuis = jour) {
  if (!G.ligue || !CARTES[cle]) return;
  const decisions = (G.ligue.decisions || []).filter(x => !(x.carte && x.palier === palier));
  decisions.push({ jour, carte: cle, palier, sel: nouvelleGraine() });
  await continuerSaison(decisions, Math.min(depuis, jour), 'La saison reprend avec ta carte…');
  toast(`${CARTES[cle].ico} ${CARTES[cle].nom} : pour le reste de la saison.`);
}

/** Le panneau du banc : la journée, la fiche, le prochain match, les blessés, la consigne. */
function renderBanc() {
  const host = $('bancPanel');
  if (!host) return;
  const b = G.banc;
  host.hidden = !b;
  if (!b) return;
  const L = G.ligue;
  const adv = b.prochain ? L.teams.find(t => t === b.prochain.adv) || b.prochain.adv : null;
  const blesses = [...b.blesses].map(([p, reste]) => `${esc(p.n)} <span class="banc-reste">${reste} match${reste > 1 ? 's' : ''}</span>`);
  /*
   * UN ÉCRAN, PAS DEUX (S78). « Tes lignes » et son bouton « Mes lignes »
   * répétaient en icônes ce que chaque trio dit maintenant sous ses cases, et
   * « pour l'instant, le 3e trio » répétait le 🔒 Fermeture du trio. Ce qui
   * reste ici est ce que l'alignement ne dit pas : la journée, la fiche, le
   * prochain match, l'infirmerie — et ce qui joue sur ta formation, replié,
   * qui vivait dans la modale « Mes lignes » (JP, S72 : *les bonus et malus
   * devraient être avec les stratégies*).
   */
  const toi = L && (L.teams || []).find(t => t.isPlayer);
  const fx = toi ? { ...effetsEnCours(toi, b.jour), cartes: (L.decisions || []).filter(d => d.carte && d.jour <= b.jour).map(d => d.carte) } : null;
  const nbFx = fx ? (fx.effets || []).length + fx.cartes.length + (fx.absents || []).length + (fx.gardienAux ? 1 : 0) : 0;
  const effets = nbFx ? `<details class="banc-plus banc-effets"><summary>Ce qui joue sur ta formation · ${nbFx}</summary>${effetsHtml(fx)}</details>` : '';
  host.innerHTML = `
    <div class="banc-tete">
      <div class="banc-titre">Derrière le banc <span class="banc-jour">journée ${b.jour} sur ${b.N}</span></div>
      <div class="banc-fiche" title="Ta fiche à ce jour : victoires, défaites, défaites en prolongation">${b.fiche.W}-${b.fiche.L}-${b.fiche.OTL}</div>
    </div>
    ${adv ? `<div class="banc-ligne">Prochain match · journée ${b.prochain.j + 1} · ${getTeamLogoHtml(adv.tag, 16)} ${esc(teamLabel(adv))}${soirEreintant(b.prochain.j) ? ' <span class="banc-ereintant" title="Un match sur quatre est éreintant : la finition suit l\'écart de robustesse entre les deux clubs. Habille tes joueurs les plus robustes.">🥵 soir éreintant</span>' : ''}</div>` : ''}
    <div class="banc-ligne">${blesses.length ? `🩹 ${blesses.join(' · ')}` : 'Personne à l\'infirmerie.'}</div>
    <div class="banc-ligne banc-aide">Déplace, permute, monte un réserviste : le fit de chaque ligne suit ses joueurs. Sous chaque trio, sa <b>stratégie</b> ; 🔒 désigne ton <b>trio de fermeture</b>.</div>
    ${effets}
    <details class="banc-plus"><summary>Les lignes et le trio de fermeture</summary>
      <div class="banc-ligne"><b>Chaque ligne a sa tactique</b>, comme dans HockeyArena : chacune demande un profil par poste, et le fit plafonne la chimie. Changer un joueur coûte de la chimie ; une ligne soudée joue son système plus souvent.</div>
      <div class="banc-ligne"><b>Le trio de fermeture</b> prendra le premier trio adverse, surtout à domicile, où le dernier changement est à toi. Son blocage est celui de ses trois joueurs : désigner un trio ordinaire, c'est l'envoyer se faire marquer dessus.${b.fermeture === 'auto' ? ' Par défaut c\'est le 3e trio, comme chaque club de la ligue.' : ''}</div>
    </details>
    <button class="btn go banc-retour" id="bancRetour" title="La saison reprend à cette journée, avec ces trios, ce plan et cette glace. Ce qui est joué reste joué.">Retour au match</button>`;
  $('bancRetour').onclick = reprendreSaison;
  // MES LIGNES, derrière le banc (S68) : elles se règlent sous chaque trio
  // depuis S78 (`tiroirStrategie`), et partent avec la décision du banc au
  // « Retour au match ».
  /*
   * UN SEUL ÉCOUTEUR, DÉLÉGUÉ, et il est reposé à chaque rendu parce que
   * `innerHTML` vient de jeter les anciens boutons : brancher chaque bouton
   * un par un en laisserait un derrière au premier réglage qu'on ajoute.
   */
  host.querySelectorAll('.banc-seg-btn').forEach(btn => {
    btn.onclick = () => {
      const champ = btn.dataset.champ;
      if (!G.banc || G.banc[champ] === btn.dataset.cle) return;
      G.banc[champ] = btn.dataset.cle;
      renderBanc();
    };
  });
}

/*
 * UNE RANGÉE DE SEGMENTS : le plan de match, la glace. Le mot du réglage
 * choisi porte ce qu'il achète et ce qu'il paie — c'est la seule chose à lire
 * pour décider, et elle vient de `PLANS` / `ROULEMENTS`, jamais d'un texte
 * recopié ici : un réglage retouché ferait sinon mentir l'écran.
 */
function segments(titre, champ, table, choisi) {
  const cour = table[choisi] || Object.values(table)[0];
  const btns = Object.entries(table).map(([cle, x]) => {
    const on = cle === choisi;
    return `<button type="button" class="banc-seg-btn${on ? ' on' : ''}" data-champ="${champ}" data-cle="${cle}"
      title="${esc(x.nom)}${x.bon ? ` — ${esc(x.bon)}` : ''}${x.prix ? `, mais ${esc(x.prix.charAt(0).toLowerCase() + x.prix.slice(1))}` : ''}"
      aria-pressed="${on}">${x.ico} <span class="banc-seg-nom">${esc(x.nom)}</span></button>`;
  }).join('');
  return `<div class="banc-seg">
    <div class="banc-seg-tete">${titre}</div>
    <div class="banc-seg-btns">${btns}</div>
    <div class="banc-seg-mot">${cour.bon ? `<b>${esc(cour.bon)}</b>` : ''}${cour.prix ? ` · ${esc(cour.prix)}` : ''}</div>
  </div>`;
}

/*
 * REPRENDRE LES SÉRIES APRÈS UN RAFRAÎCHISSEMENT. La saison vient d'être
 * rejouée en entier : le classement est donc le même, les appariements sont
 * les mêmes, et surtout le générateur est à l'endroit exact où `playSeries`
 * l'avait pris la première fois — `grainerHasard` n'est appelé que par
 * `simulateLeague`, et il reste en place ensuite (js/sim.js). Rejouer les
 * séries redonne donc les mêmes feuilles, au but près. Il ne reste qu'à dire
 * à l'écran jusqu'où le joueur les avait regardées.
 */
function reprendreSeries(vues) {
  const teams = G.ligue && G.ligue.teams;
  if (!teams || teams.length < 2) return;
  runPlayoffs(teams.slice(0, nombreEnSeries(teams.length)), { depuis: vues });
}

async function runSeason(opts = {}) {
  if (G.banc && !opts.adversaires) { await reprendreSaison(); return; }
  if (slotsLeft() > 0 || G.done || (capLeft() < 0 && !opts.adversaires)) return;
  if (!opts.reprise) alignementAuCartable();
  // SUR TABLE : le même alignement, un autre jeu. On n'entre jamais dans
  // simulateLeague ici — le tournoi a son propre moteur, celui du plateau.
  if (G.bonus === 'TABLE' && !opts.adversaires) { await lancerTournoi(); return; }
  /*
   * UNE SAISON QUI COMMENCE N'A NI SÉRIES NI ENTRÉE D'HISTORIQUE ; une
   * REPRISE garde les deux, puisque c'est la même saison qu'on rouvre. Un
   * seul endroit décide, sinon « Rejouer la saison » réécrirait l'entrée de
   * la saison d'avant et hériterait de ses séries.
   */
  if (!opts.reprise) { G.seriesVues = null; G.lbId = null; }
  // Les décisions de SÉRIES suivent une reprise (S69), jamais une saison neuve.
  const dsPrec = opts.reprise ? ((G.ligue && G.ligue.decisionsSeries) || G.dsReprise || []) : [];
  G.dsReprise = null;
  G.done = true;
  // LA SAISON SE JOUE DANS TES COULEURS : noir, blanc, orange. Le repêchage
  // portait celles du vestiaire sorti ; à partir d'ici, c'est ton club.
  applyTeamColors('YOU');
  const mb = $('mainBtn');
  mb.disabled = true;
  mb.textContent = 'La ligue joue ses 82 matchs…';
  await new Promise(r => setTimeout(r, 20));

  let opponents = [];
  if (opts.adversaires) {
    opponents = opts.adversaires.map(a => createTeam(a.name, a.tag, a.roster, { season: a.season }));
  } else {
    try { opponents = await buildOpponents(31); } catch { opponents = []; }
  }
  // TU ES LA 33e ÉQUIPE. Une saison fixée met dans la ligue TOUS ses vrais
  // clubs, et la tienne par-dessus : trente-trois en 2024-25, vingt-deux en
  // 1985-86. C'était le club le plus faible qui cédait sa place pour garder
  // l'effectif pair ; la cédule sait maintenant faire jouer un nombre impair
  // d'équipes (une en congé chaque journée, 82 matchs pour tout le monde —
  // voir `simulateLeague`), donc plus personne n'est retranché.

  const you = createTeam('NHL Stars', 'YOU', G.roster, { isPlayer: true });
  // LES DÉCISIONS EN SAISON (voir `simulateLeague`) : la décision 0 est
  // l'alignement du repêchage, les suivantes viennent du banc. Une reprise
  // rejoue exactement les mêmes.
  const decisions = opts.decisions && opts.decisions.length
    ? opts.decisions
    : [{ jour: 0, cases: photoAlignement(G.roster), fermeture: 'auto', lignes: G.lignes || undefined },
      // UN DECK AIGUISÉ (Rogue, S77) : deux cartes de départ commencent en « + ».
      ...(G.bonus === 'ROGUE' && G.rogue && G.rogue.deckPlus ? [{ jour: 0, deck: 'camp', aiguise: 'lancer', rogue: { depart: true } }, { jour: 0, deck: 'camp', aiguise: 'bloquer', rogue: { depart: true } }] : [])];
  // Tes cartes brillantes jouent (S78) ; personne d'autre n'en porte.
  poserCartes(decisions);
  /*
   * LA LIGUE NE SE JOUE PAS D'AVANCE (S79). JP : *tu devrais jamais simuler
   * d'avance*. Elle se CRÉE ici — les équipes, la cédule, le hasard — et ne
   * joue que les journées déjà révélées (une reprise : la sauvegarde, ou une
   * décision prise après un match déjà joué pour le direct). L'écran de saison
   * joue chaque journée suivante au moment de la révéler (`ouvrirSaison`,
   * `ligue`), et le bilan se compose à la dernière (`terminerSaison`).
   */
  let r = null, teams, leaders = [], calendrier = [], graine = null, moteur = null;
  if (opponents.length) {
    moteur = creerLigue([you, ...opponents], 82, { graine: opts.graine || null, decisions });
    jouerJusqua(moteur, opts.depuis || 0);
    // Un joueur signé aujourd'hui est dans l'alignement dès maintenant, pas au matin (S79).
    poserAlignementDuJour(moteur);
    teams = moteur.teams;
    calendrier = moteur.calendrier;
    graine = moteur.graine;
  } else {
    r = simulate(G.roster, { graine: opts.graine || null });
    graine = r.graine;
    Object.assign(you, { W: r.W, L: r.L, OTL: r.OTL, GF: r.GF, GA: r.GA, PTS: r.points });
    teams = [you];
  }
  G.journee = 0;
  G.ligue = {
    you, teams, calendrier, graine, epoque: G.epoque, moteur,
    // Les clés des adversaires, dans l'ordre du tirage : c'est tout ce que la
    // sauvegarde emporte, et `rebatirAdversaires` les redéploie à l'identique.
    cles: opponents.map(t => `${t.season}|${t.tag}`),
    decisions,
    decisionsSeries: dsPrec,
    // Les trois réglages sont FIGÉS ici, avec la graine : l'écran « Nouvelle
    // partie » peut muter G pendant qu'un bilan est encore à l'écran, et
    // l'historique doit enregistrer la partie qui a été jouée, pas celle
    // qu'on est en train de composer.
    mode: G.mode, repechage: G.repechage, franchise: G.franchise, bonus: G.bonus,
    // De quoi rejouer : les mêmes 31 clubs, à partir des mêmes alignements.
    adversaires: opponents.map(t => ({ name: t.name, tag: t.tag, roster: t.roster, season: t.season })),
  };

  if (!moteur) {
    // La saison solo (aucun adversaire) : `simulate` a tout joué, il n'y a rien à révéler.
    G.journee = calendrier.length; saveGame(); finDeSaisonRogue();
    renderResult(r, you, teams, leaders, calendrier);
    return;
  }
  ouvrirEcranSaison(opts.depuis || 0);
}

/*
 * LA FIN DE LA SAISON : le classement, les meneurs et la fiche, composés à la
 * dernière journée — jamais avant, puisque rien n'était joué d'avance.
 */
function terminerSaison() {
  const L = G.ligue, M = L && L.moteur;
  if (!M) return;
  jouerJusqua(M, Infinity);
  const b = bilanLigue(M);
  const you = L.you;
  L.teams = b.standings;
  const r = {
    W: you.W, L: you.L, OTL: you.OTL, GF: you.GF, GA: you.GA, points: you.PTS,
    attaque: you.strength.att, brigade: you.strength.def,
    rob: you.strength.rob, clu: you.strength.clu, gRating: you.strength.g,
  };
  G.journee = M.calendrier.length;
  finDeSaisonRogue();
  renderResult(r, you, b.standings, b.leaders, M.calendrier);
}

/*
 * L'ÉCRAN DE SAISON, sur la ligue EN MÉMOIRE : ouvrir, rouvrir après une
 * décision, reprendre une partie — sans jamais rejouer ce qui est joué.
 */
function ouvrirEcranSaison(depuis = 0) {
  const L = G.ligue, M = L.moteur;
  const { you, teams, calendrier, graine } = L;
  const decisions = L.decisions;
  // Une saison reprise APRÈS sa dernière journée va droit au bilan : rouvrir
  // l'écran sur « journée 82 sur 82 » ferait relire un écran déjà fini.
  if (calendrier.length && depuis < calendrier.length) {
    ouvrirSaison({
      calendrier, teams, you, enSeries: nombreEnSeries(teams.length), epoque: G.epoque,
      // LA LIGUE EN MÉMOIRE (S79) : l'écran joue chaque journée au moment de la révéler.
      ligue: M,
      ctx: {
        esc, teamLabel, teamShort, tagCourt, logo: getTeamLogoHtml, band: getTeamBand, mug: headshotHtml,
        // Le bouton du son du plateau bascule la même préférence que les options.
        basculerSons: () => { setOption('sons', G.sons ? 'off' : 'on'); syncOptionsUI(); },
        /*
         * UN NOM SE CLIQUE PENDANT LA SAISON, SANS DÉVOILER LA FIN. Le mode
         * 'jour' fait lire les feuilles RÉVÉLÉES au moment du clic — les
         * compteurs `sim*`, eux, portent les 82 matchs dès que le moteur a
         * joué. Les meneurs, la feuille d'une équipe et le fil du match en
         * direct passent tous par là (ils partagent ce `ctx`).
         */
        fiche: (p, t, html) => lienJoueur(p, t, porteeRevele('saison'), html),
        // UNE CASE SE NOMME PAR SON RANG, et `slotShort` en est le seul
        // propriétaire : l'alerte de blessure le lit plutôt que d'écrire sa
        // propre version (« 2e trio · AD », jamais « Top 6 »).
        slotShort,
        // UN JOUEUR SE NOMME PAR CE QU'IL EST (S79) : ses positions, son rôle, sa saison.
        quiEst,
        // LE BALLOTTAGE (S66) : trois joueurs offerts sur une vraie blessure.
        ballottage: candidatsBallottage,
        // LA RECRUE DU DECK (S73) : trois vrais joueurs, un par position.
        recrues: candidatsRecrue,
        // L'ATELIER (S78) : le joueur qui reçoit l'édition.
        atelier: ouvrirAtelier,
        // LA CARTE MINI (S78) : un joueur offert se voit en carte de joueur.
        carteMini: carteMiniHtml,
        // Sa fiche en aperçu, et « qui sort ? » quand il arrive (S78).
        apercu: apercuJoueur,
        // S79 : toute signature de la saison (ballottage, recrue) respecte le plafond effectif, et dit ce que libère chaque sortie.
        quiSort: (p, o) => choisirQuiSort(p, { bloque: q => bloqueParLePlafond(p, q), note: q => `libère ${money(capHitDuJour(q))}`, ...o }),
        // LE MODE ROGUE (S77) : les jetons à ce jour, et la boutique.
        rogue: G.bonus === 'ROGUE' ? { jetons: j => jetonsRogue(j), boutique: (j, decider) => ouvrirBoutique(j, decider) } : null,
        // LA BOUTIQUE ET L'INVENTAIRE (S79), dans les deux modes.
        boutique: { jetons: j => jetonsRogue(j), ouvrir: (j, decider) => ouvrirBoutique(j, decider) },
        inventaire: { compte: j => cartesAJouer(j), ouvrir: (j, decider) => ouvrirInventaireJeu(j, decider) },
      },
      onTermine: () => terminerSaison(),
      depuis,
      // À chaque journée révélée, la sauvegarde suit. C'est le seul état que
      // la reprise a besoin de connaître.
      onJour: j => { G.journee = j; saveGame(); if (G.bonus === 'ROGUE') renderCap(); },
      // LES CARTES DE SAISON : la graine décide de la main offerte à chaque
      // palier (sans toucher au hasard du moteur), et les paliers déjà pris
      // se lisent dans les décisions — il n'y a pas d'autre état.
      graine,
      // Une main de palier se ferme par n'importe laquelle de ses cartes (S73) :
      // un effet (`carte`), ou une recrue, une amélioration, un rôle, un stage (`deck`).
      cartesPrises: (decisions || []).filter(d => d.carte || (d.deck && typeof d.palier === 'number'))
        .map(d => ({ palier: d.palier ?? d.jour, carte: d.carte || null })),
      onCarte: choisirCarte,
      onTrou: subirCarte,
      // Les épisodes de case vide déjà encaissés, pour qu'un trou ne retende
      // pas sa carte à chaque reprise (voir `trousFaits`, js/saison.js).
      trousPris: (decisions || []).filter(d => typeof d.palier === 'string' && d.palier.startsWith('trou:'))
        .map(d => Number(d.palier.slice(5))),
      // DERRIÈRE LE BANC : l'écran se retire, l'alignement s'ouvre avec les
      // fiches à ce jour, et « Retour au match » rejoue la saison depuis la
      // graine avec la décision (voir `ouvrirBanc`).
      onBanc: j => ouvrirBanc(j),
      decisions,
      onDecision: deciderSaison,
    });
  } else { terminerSaison(); saveGame(); }
}

/* ======================================================================
   LE TOURNOI SUR TABLE
   ======================================================================
   JP : *mode bonus genre blood bowl, fft et autres jeux de sport de table* ;
   puis *viser un modèle à la blood bowl, mais plus rapide, surtout pour genre
   les séries, ou faire mini saisons et séries*.

   Le repêchage ne change pas d'un poil : mêmes 23 cases, même plafond, même
   roulette. C'est l'aval qui change — au lieu des 82 matchs de
   `simulateLeague`, ton alignement va jouer un tournoi de six clubs sur un
   plateau, cinq matchs de saison et deux rondes de séries, et tu joues chaque
   geste toi-même.
   ====================================================================== */

/* Le niveau de l'adversaire se lit et se change d'ici (S75) : le plateau le lit, l'écran du tournoi le bascule. */
const ctxTable = () => ({
  esc, band: getTeamBand, vive: couleurVive, logo: getTeamLogoHtml, mug: headshotHtml,
  niveau: () => G.niveauTable,
  choisirNiveau: v => { setOption('niveauTable', v); syncOptionsUI(); },
});

/*
 * LES RÈGLES DU PLATEAU DANS LA PAGE DES RÈGLES, depuis la même source que
 * l'écran du match (`reglesDuPlateau`, js/table.js). `CLAUDE.md` a annoncé
 * pendant tout un temps « cinq présences par période » quand le code en
 * jouait six : une règle recopiée est une règle qui ment tôt ou tard.
 */
function remplirReglesDuPlateau() {
  const hote = $('reglesPlateau');
  if (!hote || hote.dataset.pret) return;
  hote.dataset.pret = '1';
  hote.innerHTML = reglesDuPlateau().map(sec => `
    <h4>${esc(sec.titre)}</h4>
    ${sec.points ? `<ul>${sec.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${sec.rangees ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr>${sec.colonnes.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${sec.rangees.map(r => `<tr>${r.map((v, i) => `<td${i === 0 ? ' class="t-regle-nom"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>` : ''}`).join('');
}

async function lancerTournoi() {
  applyTeamColors('YOU');
  const mb = $('mainBtn');
  mb.disabled = true;
  mb.textContent = `Tirage des ${CLUBS_TOURNOI - 1} clubs du tournoi…`;
  await new Promise(r => setTimeout(r, 20));
  let rivaux = [];
  try { rivaux = await buildOpponents(CLUBS_TOURNOI - 1); } catch { rivaux = []; }
  if (rivaux.length < CLUBS_TOURNOI - 1) {
    toast('Impossible de réunir assez de clubs pour le tournoi.');
    mb.disabled = false; renderMain();
    return;
  }
  // `G.done` est posé par `afficherTournoi` : un seul endroit ouvre un
  // tournoi, qu'il vienne d'un tirage neuf ou d'une reprise.
  // LA SAISON DE CHAQUE CLUB EST GARDÉE : c'est la moitié de sa clé, et sans
  // elle la reprise n'a aucun moyen de rebâtir les cinq rivaux.
  const clubs = [
    { nom: 'NHL Stars', tag: 'YOU', roster: G.roster },
    ...rivaux.slice(0, CLUBS_TOURNOI - 1).map(t => ({ nom: t.name, tag: t.tag, roster: t.roster, season: t.season })),
  ];
  afficherTournoi(nouveauTournoi(clubs, nouvelleGraine()));
}

/* L'écran du tournoi, d'où qu'il vienne — un tirage neuf ou une reprise. */
function afficherTournoi(T) {
  G.done = true;
  G.tournoi = T;
  applyTeamColors('YOU');
  ouvrirTournoi({
    T, ctx: ctxTable(), onTermine: montrerBilanTournoi,
    // Le tournoi bouge, la sauvegarde suit — comme la journée en saison.
    onAvance: () => saveGame(),
  });
}

/*
 * REPRENDRE UN TOURNOI SUR TABLE. Les cinq rivaux se rebâtissent par leurs
 * clés, exactement comme les 31 clubs d'une ligue (`rebatirAdversaires` rejoue
 * la boucle de `buildOpponents`, même ordre et même `exclude` qui s'accumule),
 * puis `relireTournoi` rejoue les matchs joués à vide et relit les tiens.
 * Rend faux si quoi que ce soit ne se recolle pas : on retombe alors sur
 * l'alignement complet, prêt à repartir, plutôt que sur un tournoi troué.
 */
async function reprendreTournoi(etat) {
  const rivaux = await rebatirAdversaires(etat.clubs || []);
  if (rivaux.length !== CLUBS_TOURNOI - 1) return false;
  const clubs = [
    { nom: 'NHL Stars', tag: 'YOU', roster: G.roster },
    ...rivaux.map(t => ({ nom: t.name, tag: t.tag, roster: t.roster, season: t.season })),
  ];
  const T = relireTournoi(etat, clubs);
  if (!T) return false;
  afficherTournoi(T);
  return true;
}

/**
 * Le bilan du tournoi : le classement final, les séries, et ce que TES
 * joueurs ont fait sur le plateau. Les fiches se cumulent des feuilles de
 * chaque match — comme `compterFeuilles` le fait pour la saison, en plus
 * petit : un match sur table ne compte que des buts et des passes.
 */
function montrerBilanTournoi(T) {
  const cl = classementTournoi(T);
  const finale = T.series && T.series.rondes[1][0];
  // Ce que les tiens ont fait, cumulé des feuilles de tes matchs.
  const fiches = new Map();
  for (const mt of [...T.journees.flat(), ...(T.series ? T.series.rondes.flat() : [])]) {
    if (!mt.r) continue;
    for (const cote of ['A', 'B']) {
      const idx = cote === 'A' ? mt.a : mt.b;
      if (idx !== 0) continue;
      for (const l of mt.r[cote].marqueurs) {
        const f = fiches.get(l.p) || { p: l.p, b: 0, a: 0 };
        f.b += l.buts; f.a += l.passes;
        fiches.set(l.p, f);
      }
    }
  }
  const meneurs = [...fiches.values()].sort((x, y) => (y.b + y.a) - (x.b + x.a) || y.b - x.b).slice(0, 10);
  const gagne = T.champion === 0;
  $('gameModalTitle').textContent = 'Le tournoi sur table';
  $('gameModalBody').innerHTML = `
    <p class="tr-verdict ${gagne ? 'gagne' : ''}">${gagne
      ? 'Tu remportes le tournoi sur table.'
      : `${esc(T.clubs[T.champion ?? 0].nom)} remporte le tournoi.`}</p>
    ${finale && finale.r ? `<p class="tr-note">Finale : ${esc(T.clubs[finale.a].nom)} ${finale.r.gfA} – ${finale.r.gfB} ${esc(T.clubs[finale.b].nom)}.</p>` : ''}
    <h3 class="tr-jour">Le classement de la saison</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>#</th><th>Club</th><th>PJ</th><th>V</th><th>D</th><th>BP</th><th>BC</th><th>PTS</th></tr></thead>
      <tbody>${cl.map((x, n) => `<tr class="${x.i === 0 ? 'mien' : ''}">
        <td>${n + 1}</td><td>${getTeamLogoHtml(x.c.tag, 18)} ${esc(x.c.nom)}</td>
        <td>${x.f.PJ}</td><td>${x.f.V}</td><td>${x.f.D}</td><td>${x.f.BP}</td><td>${x.f.BC}</td><td><b>${x.f.PTS}</b></td>
      </tr>`).join('')}</tbody></table></div>
    ${meneurs.length ? `<h3 class="tr-jour">Tes meneurs sur le plateau</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Joueur</th><th>B</th><th>A</th><th>PTS</th></tr></thead>
      <tbody>${meneurs.map(f => `<tr><td>${lienJoueur(f.p)}</td><td>${f.b}</td><td>${f.a}</td><td><b>${f.b + f.a}</b></td></tr>`).join('')}</tbody>
    </table></div>` : ''}
    <div class="tr-actions"><button type="button" id="tournoiNouveau" class="btn">Nouvelle partie</button></div>`;
  openModal('gameModal');
  const b = $('tournoiNouveau');
  if (b) b.onclick = () => { closeModal('gameModal'); ouvrirNouvellePartie(); };
  renderMain();
}

/* ======================================================================
   L'EXHIBITION : LE PLATEAU TOUT DE SUITE, SANS REPÊCHAGE
   ======================================================================
   JP : *créer exhibition pour jeu de table pour plus facile de tester ?*.

   Pour toucher le plateau, il fallait bâtir vingt-trois cases, lancer le
   tournoi, puis ouvrir son premier match : dix minutes avant le premier
   geste, sur le mode qu'on retouche le plus. Un match d'exhibition tire deux
   vrais clubs — dans la saison que l'écran « Nouvelle partie » affiche, sinon
   dans les 55 — et ouvre le plateau directement ; ta formation prend la
   place du premier club si elle est complète, parce qu'un alignement qu'on
   vient de bâtir est ce qu'on a le plus envie d'essayer.

   RIEN N'EST ÉCRIT : ni la partie en cours, ni la sauvegarde, ni
   l'historique. C'est une partie de pratique. Le match fini, la feuille sort
   comme au tournoi, puis un mot du résultat offre un autre match — deux
   clubs neufs, ou les mêmes sur d'autres dés — parce que tester, c'est
   rejouer.
   ====================================================================== */

let exhibition = null;        // { epoque, A, B } — le dernier match, pour le rejouer
let exhibitionEnCours = false;

async function jouerExhibition({ memes = false } = {}) {
  if (exhibitionEnCours) return;
  exhibitionEnCours = true;
  const bouton = $('npExhibition');
  const libelle = bouton ? bouton.textContent : '';
  if (bouton) { bouton.disabled = true; bouton.textContent = 'Tirage des clubs…'; }
  try {
    // La saison est celle que l'ÉCRAN montre tant que le brouillon existe :
    // l'exhibition suit ce qu'on lit, sans rien appliquer à la partie. Le
    // brouillon est jeté à la fermeture, donc « Un autre match » relit la
    // saison mémorisée au premier tirage.
    const epoque = G.brouillon ? G.brouillon.epoque : exhibition ? exhibition.epoque : G.epoque;
    let A, B;
    if (memes && exhibition) ({ A, B } = exhibition);
    else {
      const mienne = slotsLeft() === 0 && capLeft() >= 0;
      const n = mienne ? 1 : 2;
      // Deux saisons de plus dans le sac avant de tirer : `buildOpponents` ne
      // charge que s'il manque des clubs, et au premier match il n'y a que la
      // saison de la roulette — l'exhibition ressortait 1978-79 contre 1978-79
      // à chaque coup. Une saison, c'est une requête, et le cache la garde.
      if (!epoque) for (let i = 0; i < 2; i++) { try { await getShard(rnd(state.index.seasons)); } catch { /* on tire avec ce qu'on a */ } }
      let clubs = [];
      try { clubs = await buildOpponents(n, { epoque, tous: false }); } catch { clubs = []; }
      if (clubs.length < n) { toast('Impossible de réunir deux clubs pour l\'exhibition.', 'bad'); return; }
      const club = t => ({ nom: t.name, tag: t.tag, roster: t.roster });
      A = mienne ? { nom: 'NHL Stars', tag: 'YOU', roster: { ...G.roster } } : club(clubs[0]);
      B = club(clubs[n - 1]);
    }
    exhibition = { epoque, A, B };
    closeModal('partieModal');
    ouvrirTable({
      A: equipeDeTable(A.nom, A.tag, A.roster, 'A'),
      B: equipeDeTable(B.nom, B.tag, B.roster, 'B'),
      graine: nouvelleGraine(), ctx: ctxTable(),
      titre: 'Exhibition', sousTitre: `${A.nom} contre ${B.nom}`,
      onTermine: r => montrerFinExhibition(A, B, r),
    });
  } finally {
    exhibitionEnCours = false;
    if (bouton) { bouton.disabled = false; bouton.textContent = libelle; }
  }
}

/** Le mot du résultat, et la suite : un autre match, les mêmes clubs, ou rien. */
function montrerFinExhibition(A, B, r) {
  if (!r) return;
  const gagneA = gagnantDuMatch(r) === 'A';
  const mienne = A.tag === 'YOU';
  $('gameModalTitle').textContent = 'Match d\'exhibition';
  $('gameModalBody').innerHTML = `
    <p class="tr-verdict ${mienne && gagneA ? 'gagne' : ''}">${getTeamLogoHtml(A.tag, 22)} ${esc(A.nom)} ${r.gfA} – ${r.gfB} ${esc(B.nom)} ${getTeamLogoHtml(B.tag, 22)}${r.fusillade ? ` <i>TB ${r.fusillade.A}-${r.fusillade.B}</i>` : r.prolongation ? ' <i>PROL.</i>' : ''}</p>
    <p class="tr-note">${esc(gagneA ? A.nom : B.nom)} l'emporte${r.fusillade ? ' aux tirs de barrage' : ''}. Rien n'est écrit : la partie en cours et l'historique ne bougent pas.</p>
    <div class="tr-actions">
      <button type="button" id="exhibitionEncore" class="btn">Un autre match</button>
      <button type="button" id="exhibitionMemes" class="btn">Les mêmes clubs</button>
      <button type="button" id="exhibitionFin" class="btn">Fermer</button>
    </div>`;
  openModal('gameModal');
  $('exhibitionEncore').onclick = () => { closeModal('gameModal'); jouerExhibition(); };
  $('exhibitionMemes').onclick = () => { closeModal('gameModal'); jouerExhibition({ memes: true }); };
  $('exhibitionFin').onclick = () => closeModal('gameModal');
}

/**
 * EXPRESS : le reste de l'alignement vient d'une vraie équipe, tirée au
 * hasard. Ces joueurs occupent leur case, ne coûtent rien au plafond et ne
 * se déplacent pas — ils sont le club dont tu hérites, et c'est par-dessus
 * qu'on te demande de bâtir un trio, une paire et un partant.
 */
async function chargerRenfort() {
  G.renfort = null;
  const actives = new Set(casesActives().map(s => s.i));
  const fr = franchiseDuTirage();
  for (let essai = 0; essai < 14; essai++) {
    const season = fr ? saisonDeFranchise(fr) : (epoqueDuTirage() || rnd(state.index.seasons));
    let shard;
    try { shard = await getShard(season); } catch { continue; }
    const teams = Object.keys(shard.byTeam).filter(t => shard.byTeam[t].length >= 20 && (!fr || t === codeDeFranchise(fr, season)));
    if (!teams.length) continue;
    const team = rnd(teams);
    const roster = autoRoster(shard.byTeam[team]);
    // Le club doit combler CHAQUE case qu'on lui demande : 62 des 1 395
    // clubs alignés laissent un trou (une réserve D en 1970-71, un DD chez
    // les Bruins de la même année), et le seuil « au moins 20 » les laissait
    // passer — l'Express héritait d'un alignement à 22 et le bouton restait
    // gris. On tire un autre club plutôt que d'accepter le trou.
    if (!SLOTS.every(s => actives.has(s.i) || roster[s.i])) continue;
    for (const s of SLOTS) {
      if (actives.has(s.i) || !roster[s.i]) continue;
      G.roster[s.i] = { ...roster[s.i], _renfort: true };
    }
    G.renfort = { season, team };
    return true;
  }
  return false;
}

/**
 * REJOUER LA SAISON : le même alignement, les mêmes 31 clubs, d'autres dés.
 * Après vingt minutes à bâtir 23 joueurs, une seule saison ne dit pas grand-
 * chose — la variance du moteur vaut facilement cinq victoires. Les équipes
 * sont recréées à partir des mêmes alignements (le moteur remet les fiches à
 * zéro), le moteur tire une nouvelle graine, et l'écran rejoue tout.
 */
async function rejouerSaison() {
  if (!G.ligue || !G.done) return;
  const adversaires = G.ligue.adversaires || [];
  G.done = false;
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  // Le repêchage revient avec le bilan qui s'en va : les deux sont frères
  // dans `#game`, et c'est la classe qui décide lequel occupe l'écran.
  $('game').classList.remove('bilan');
  renderMain();
  await runSeason(adversaires.length ? { adversaires } : {});
}

/**
 * REPRENDRE UN ALIGNEMENT DE L'HISTORIQUE : les 23 joueurs sont relus dans
 * leurs shards (rechargés au besoin), le mode de l'époque est remis, et la
 * saison part tout de suite — contre 31 nouveaux clubs, sur de nouveaux dés.
 */
async function reprendreAlignement(entree) {
  if (!entree || !Array.isArray(entree.alignement)) return;
  montrerPage('repechage');   // l'historique était une modale ; c'est une page
  toast('On relit l\'alignement…');
  const roster = {};
  for (const a of entree.alignement) {
    if (!a) continue;
    if (!G.shards.has(a.s)) { try { await getShard(a.s); } catch { /* saison indisponible */ } }
    const entry = G.shards.get(a.s);
    const fresh = entry && entry.players.find(q => getPlayerKey(q) === a.k);
    if (!fresh) { toast(`La saison ${a.s} n'est plus disponible : impossible de reprendre cet alignement.`, 'bad'); return; }
    roster[a.i] = a.r ? { ...fresh, _renfort: true } : fresh;
  }
  if (entree.mode && MODES[entree.mode] && entree.mode !== G.mode) { G.mode = entree.mode; saveOpts(); }
  G.epoque = typeof entree.epoque === 'string' && state.index.seasons.includes(entree.epoque) ? entree.epoque : null;
  // Sans ces deux-là, reprendre un vieil alignement pendant que « Sur table »
  // traîne l'envoyait au plateau au lieu des 82 matchs.
  G.repechage = normRepechage(entree.repechage);
  if (FRANCHISES[entree.franchise]) G.franchise = entree.franchise;
  G.bonus = entree.bonus === 'TABLE' ? 'TABLE' : 'SAISON';
  saveOpts(); syncOptionsUI();
  clearSave();
  G.roster = roster;
  G.tirage = [];
  G.echelle = {};
  G.dette = 0;
  G.target = null;
  G.mainCase = null; G.mainRang = null;
  G.selectedSlot = null;
  G.done = false;
  G.ligue = null;
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  // Le repêchage revient avec le bilan qui s'en va : les deux sont frères
  // dans `#game`, et c'est la classe qui décide lequel occupe l'écran.
  $('game').classList.remove('bilan');
  render();
  await runSeason();
}

/**
 * DÉMARRER UNE PARTIE. Le SEUL endroit qui pose les réglages de partie et qui
 * fait tourner la roulette. `boot` en portait une copie, et `newGame` l'autre :
 * deux séquences à garder d'accord, donc une qui dérive.
 *
 * L'ORDRE EST UN INVARIANT : les réglages, puis les DEUX compteurs de relances
 * (ils sont distincts — `G.relances` en loto, `G.left` en vestiaire), puis le
 * renfort (il écrit dans le roster), puis la roulette. L'inverse écraserait
 * des signatures.
 */
async function demarrerPartie(r = {}) {
  if (r.mode && MODES[r.mode]) G.mode = r.mode;
  // La saison se valide ICI aussi : `boot` en était le seul garde-fou, et une
  // saison absente de l'index donne ZÉRO adversaire à `buildOpponents` — la
  // saison bascule alors en solo, sans classement ni séries, sans un mot.
  if ('epoque' in r) G.epoque = (typeof r.epoque === 'string' && state.index.seasons.includes(r.epoque)) ? r.epoque : null;
  if (r.repechage) G.repechage = normRepechage(r.repechage);
  if (FRANCHISES[r.franchise]) G.franchise = r.franchise;
  if ('identite' in r) G.identite = IDENTITES[r.identite] ? r.identite : null;
  if (r.bonus) G.bonus = r.bonus === 'TABLE' || r.bonus === 'ROGUE' ? r.bonus : 'SAISON';
  if (G.bonus !== 'ROGUE') G.rogue = null;

  clearSave();
  G.variantes = { graine: nouvelleGraine(), cartes: {} };
  G.roster = {};
  poserCartes();
  G.tirage = [];
  G.echelle = {};
  G.dette = 0;
  // TROIS ÉTATS QUE `newGame` NE REMETTAIT PAS À ZÉRO. `chargerRenfort` était
  // le seul endroit qui nullifiait `G.renfort`, et il n'est appelé qu'en
  // express : la carte « Renfort » du tableau de bord survivait donc à un
  // Express → Complet, en annonçant un club qui ne fournit plus personne.
  G.renfort = null;
  G.ligue = null;
  G.tournoi = null;
  G.relances = MODE().relances;
  G.left = { ...REROLLS };
  G.target = null;
  G.mainCase = null; G.mainRang = null;
  G.selectedSlot = null;
  G.done = false;
  G.search = '';
  G.filter = 'ALL';
  const search = $('searchInput');
  if (search) search.value = '';
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  // Le repêchage revient avec le bilan qui s'en va : les deux sont frères
  // dans `#game`, et c'est la classe qui décide lequel occupe l'écran.
  $('game').classList.remove('bilan');
  setView('pool');
  if (MODE().renfort) await chargerRenfort();
  await nextSpin();
  saveOpts();            // les cinq restent les valeurs de départ de la prochaine fois
  saveGame();
  syncOptionsUI();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// `dev` : de quoi dresser une planche de cartes dans un script de capture (scripts/planche_cartes.mjs), rien de plus.
window.cap82 = { G, cacheClear, simulate, portraitAbsent, dev: { playerCardEl, carteMiniHtml, getShard } };
boot();
