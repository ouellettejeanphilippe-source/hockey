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

import { REROLLS, MODES, AFFICHAGE_COURBE, teamStrength, echelleTardive, joueurEquivalent, getPersonKey, casesDuMode, SLOTS, getPlayerKey, getPositionPenalty, positionsAvant, unitesIdeales, joueEnBas, getHiddenRatings, fits, badgesDe, PALIERS, MUTATIONS, autoRoster, createTeam, CASES_DE_BASE as CASES_ALIGNEMENT_DE_BASE, nouvelleGraine, simulate, coachDuJoueur, ZONE_PEN_DESSUS, ZONE_PUISSANCE, fragiliteDe, FRAGILE_DES, matchsDeSaSaison, ecoleDe } from './sim.js';
import { COACHS, JOUEUR_COACH } from './coachs.js';
import { PLAFOND_ROGUE, lireMeta, ecrireMeta, mandatDe, convertirAuJeuNeuf } from './rogue.js';
import { FRANCHISES, saisonsDeFranchise, codeDeFranchise } from './franchises.js';
import { IDENTITES, scoreIdentite } from './identites.js';
import { state, loadIndex, cacheClear } from './data.js';
import { plafondDe } from './banque.js';
import { ecrirePartieActive, nouvellePartie, lirePartieActive, migrer, lireIndex, activer, retirerLesRuns } from './sauvegardes.js';
import { TEAM_COLORS, couleurVive, fondEquipe, viveSurFond, getTeamBand, encreSur, getTeamLogoHtml, teamSeasonUrl } from './logos.js';
import { estD as isD, esc, money, pct3, pmMatch } from './util.js';
import { getEraFactor, getEraSalary, getLineZone, nomDeFenetre, getArchetype } from './ratings.js';
import { getTraits, TRAITS } from './traits.js';
import { surAppareil, demarrerVisages, imgVisage } from './visages.js';
import { actionsDisponibles, demarrerActions, photoDeFond } from './actions.js';
import { appliquerClub, nomDuClub } from './club.js';
import { LOGOS_LOCAUX } from './logos_locaux.js';
import { brancherBilan, teamLabel, teamShort, tagCourt } from './bilan.js';
import { activerSons, jouerSon } from './sons.js';
import { brancherRetour } from './pile.js';
import { brancherGlisser } from './glisser.js';
import { brancherManette } from './manette.js';
import { brancherInclinaison } from './cartes.js';
import { afficherMenu, fermerMenu } from './menu.js';
import { MT, chargerTable } from './charge-table.js';
import { ouvrirChoix, titreDuBadge, motDuBadge } from './gerant.js';
import { poserClubLu } from './impact.js';
import { hubActif, voletPour, surCoquille } from './coquille.js';
import { brancherEntractes } from './entracte.js';
import { migrerHistorique, rendreCartable, ajouterAuCartable, marquerJouees } from './cartable.js';
import { ouvrirEquipes } from './equipes.js';
import { albumHtml } from './album.js';
import { blessesAuJour, decisionsDeLaPartie, finDesSeriesRogue, jetonsRogue, miniAvecVariante, motDeRun, ouvrirInventaireJeu, ouvrirRogue, ouvrirVestiaire } from './rogue-jeu.js';
import { ajusterCartes, carteMiniHtml, clesDesMods, compteSignables, getShard, nextSpin, playerCardEl, poserCartes, renderCap, renderDash, renderFilters, renderPool, renderPoolMeta, renderSpin, syncAgeControls, varianteJoueur } from './repechage.js';
import { ballottageVu, bancSerie, connaitreBallottages, deciderSerie, personneDeCle, reprendreSaison, reprendreSeries, runSeason, sousVoile } from './banc.js';
import { compteEnGrille, compteRevele, lienEquipe, lienJoueur, ouvrirFiche, porteeRevele, showPlayerModal, statsSim } from './fiche.js';
import { actionDuBouton, choisirIdentite, majPiedPartie, oublierBrouillon, ouvrirNouvellePartie, poserBrouillon, resoudreHasard, semerBrouillon, syncOptionsUI } from './partie.js';
import { renderMain, renderRoster, renderTeamSummary } from './alignement.js';
import { remplirJoueurs } from './joueurs.js';

/* Une icône du sprite de `index.html` : trait de 2, couleur du texte. */
export const ico = n => `<svg class="ico" aria-hidden="true"><use href="#${n}"/></svg>`;

export const $ = id => document.getElementById(id);
export const rnd = a => a[Math.floor(Math.random() * a.length)];

/** Salaire plancher de la LNH dans le barème du jeu : sert au calcul du budget restant. */
export const MIN_SAL = 775_000;

/* LA MÊME JAUGE PARTOUT (V2.2) : « x % du plafond » se lit sur le plafond qu'on joue (`plafondDeJauge`), jamais sur 95,5 M$ en Express ou en Rogue. */
export const plafondDeJauge = () => { const c = plafondEffectif().cap; return c > 0 && c < 1e11 ? c : MODE().cap; };
const pctCap = n => (n / plafondDeJauge() * 100).toFixed(1).replace('.', ',') + ' %';

export const TEAMFULL = {
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
export const DEFUNCT = new Set(['QUE', 'HFD', 'MNS', 'AFM', 'ATL', 'KCS', 'CLR', 'CLE', 'CGS', 'OAK', 'WIN', 'PHX', 'MDA', 'ARI']);

/* =====================================================================
   État
   ===================================================================== */

export const G = {
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
   * LE FORMAT SUR TABLE (oct. 2026) : Complet (trois périodes) ou Éclair (une
   * seule, js/table.js `PERIODES_ECLAIR`). Une préférence aussi : le tournoi
   * le fixe à son tirage et le garde ; l'exhibition le lit à chaque match.
   */
  formatTable: 'COMPLET',  // COMPLET | ECLAIR
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
const MODE_ROGUE = { ...MODES.CLASSIQUE, nom: 'Rogue', cap: PLAFOND_ROGUE };
export const MODE = () => (G.bonus === 'ROGUE' ? MODE_ROGUE : (MODES[G.mode] || MODES.CLASSIQUE));
/*
 * LA COURBE À L'ÉCRAN (1.0, J2-16, R6) : une carte ne parle de sa courbe
 * qu'en Rogue, et sa jauge allume le cran du soir — la journée révélée, ou la
 * ronde des séries. Avant la saison, la jauge dit la courbe entière.
 */
AFFICHAGE_COURBE.actif = () => G.bonus === 'ROGUE';
AFFICHAGE_COURBE.echelle = () => {
  if (G.bonus !== 'ROGUE') return null;
  if (G.seriesVues) return echelleTardive({ serie: true, ronde: G.seriesVues.ronde || 0 });
  if (G.ligue) return echelleTardive({ jour: G.journee || 0 });
  return null;
};
/**
 * La saison à laquelle la ROULETTE est tenue : celle de la ligue quand elle
 * est fixée et que le repêchage reste dans l'année, sinon null — et null veut
 * dire « n'importe laquelle des 55 ». La ligue, elle, lit toujours `G.epoque`.
 */
export const epoqueDuTirage = () => (G.epoque && G.repechage === 'SAISON') ? G.epoque : null;
/*
 * L'HISTOIRE D'UNE FRANCHISE (S73). JP : *ajouter possible de juste piger
 * dans l'histoire d'une équipe, comme l'équivalent dans une même saison pour
 * l'alignement*. Le repêchage « Une franchise » ne sort que les vestiaires de
 * ce club, n'importe quelle saison de son histoire, relocalisations comprises
 * (js/franchises.js). La ligue, elle, ne change pas.
 */
export const franchiseDuTirage = () => (G.repechage === 'FRANCHISE' && FRANCHISES[G.franchise]) ? G.franchise : null;
/* Le repêchage d'une sauvegarde ou d'un brouillon : les trois valeurs connues, et la saison par défaut. */
export const normRepechage = v => (v === 'TOUTES' || v === 'FRANCHISE' ? v : 'SAISON');
/*
 * L'IDENTITÉ DE DÉPART (S73, js/identites.js) : la roulette tire deux clubs et
 * garde celui dont le joueur offert colle le mieux. `undefined` : pas encore
 * choisie pour cette partie (le choix s'offre au démarrage) ; `null` : pas de
 * préférence.
 */
export const identite = () => (IDENTITES[G.identite] ? G.identite : null);
/* Le seuil d'une carte qui « colle » à l'identité : le même que scripts/check_identite.mjs. */
export const SEUIL_IDENTITE = 0.62;
/* En loto : le joueur que ce club tend pour la case de la main. */
export function scoreDeLaMain(v) {
  const c = caseDeLaMain();
  if (!c || !v) return -1;
  const p = joueurEquivalent(v.pool, c, new Set(picked().map(getPersonKey)), G.mainRang ?? rangDeLaMain(c));
  return p ? scoreIdentite(identite(), p) : -1;
}
/* Au vestiaire : la moyenne des cinq joueurs signables qui collent le mieux. */
export function scoreDuVestiaire(pool) {
  const xs = pool.filter(p => !isPicked(p) && openSlots(p).length).map(p => scoreIdentite(identite(), p)).sort((a, b) => b - a).slice(0, 5);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : -1;
}
/* Une saison de la franchise, autre que `sauf` quand il y en a une autre. */
export function saisonDeFranchise(fr, sauf = null) {
  const ss = saisonsDeFranchise(fr, state.index.seasons).map(([x]) => x);
  const autres = ss.filter(x => x !== sauf);
  return rnd(autres.length ? autres : ss);
}
/** Les cases que TU combles : les 23 d'habitude, six en express. */
const casesActives = () => (G.bonus === 'ROGUE' ? casesDeLaRun() : casesDuMode(G.mode));
/*
 * LES CASES D'UNE RUN ROGUE (S80) : les 23, plus les cases de réserve que le
 * vestiaire a débloquées pour cette run (`G.rogue.reserves`, fixé au départ).
 * Une case de réserve peut rester LIBRE en Rogue : on relâche un réserviste
 * pour faire de la place ou de l'espace sous le plafond (JP : *possible de
 * discard les cartes de remplaçants*), et un joueur signé y entre sans que
 * personne sorte.
 */
const reservesOuvertes = () => (G.bonus === 'ROGUE' && G.rogue ? G.rogue.reserves || 0 : 0);
export const caseOuverte = s => !s.extra || s.extra <= reservesOuvertes();
const casesDeLaRun = () => SLOTS.filter(caseOuverte);

/** Les cinq réglages qui définissent LA PARTIE : ils n'existent que sur #partieModal. */
const REGLAGES_PARTIE = new Set(['format', 'tirage', 'ligue', 'repechage', 'bonus']);
/** Un démarrage à la fois : deux clics ne doivent pas mettre deux roulettes en vol. */
let demarrageEnCours = false;
/** Le premier vestiaire sorti — celui qui colore l'interface en tirage VESTIAIRE. */
export const vestiaire = () => G.tirage[0] || null;
/** Un renfort est fourni par le mode express : il occupe une case, ne coûte rien. */
export const estRenfort = p => !!(p && p._renfort);

const picked = () => Object.values(G.roster);
/** Les joueurs que tu as signés toi-même — les seuls qui touchent au plafond. */
export const signes = () => picked().filter(p => !estRenfort(p));
/**
 * Ce joueur-SAISON est-il déjà signé ? Comparer les objets ne suffit pas :
 * un joueur échangé est dans le vestiaire de chacune de ses équipes, avec un
 * objet par équipe, et on pouvait donc le signer deux fois.
 */
export const isPicked = p => {
  const k = getPersonKey(p);
  return picked().some(x => getPersonKey(x) === k);
};
/*
 * LA MASSE SALARIALE MANIPULÉE (S79 ; V16, tranche 6 : le dossier du proprio, js/dossiers.js `laMasse`). Avant la
 * saison, le plafond du mode et la somme des salaires, comme toujours. En
 * saison, le plafond EFFECTIF de la journée (l'espace gagné, la taxe, le DG
 * du plafond flexible) et le « cap hit » de chacun : sa retenue, son rachat,
 * son contrat d'entrée, ses bonis — zéro s'il est blessé à long terme ET à
 * l'infirmerie ce jour-là. Tout se déduit des décisions. `G.roster` est
 * l'alignement même du moteur : il suit les signatures de la saison.
 */
export function plafondEffectif(j = G.journee || 0) {
  const r = G.bonus === 'ROGUE' ? ((G.rogue && G.rogue.plafond) || null) : null;
  const base = G.bonus === 'ROGUE' ? (r ? r.cap : 1e12) : MODE().cap;
  const depart = r ? r.lignes || [] : [];
  if (!G.ligue) return { cap: base, base, lignes: depart, facteurs: new Map(), ltir: new Set(), ecole: new Set(), blesses: new Set() };
  const pl = plafondDe(decisionsDeLaPartie(), j + 1, { base });
  const blesses = new Set(pl.ltir.size ? blessesAuJour(j).map(x => getPlayerKey(x.p)) : []);
  return { ...pl, base, lignes: [...depart, ...pl.lignes], blesses };
}
/* Ce qu'un joueur de ton alignement compte au plafond aujourd'hui. */
export const capHitDuJour = q => (G.ligue ? capHit(q, plafondEffectif()) : (q.$ || 0));
/* Ce que ce joueur compte au plafond (`pl` : `plafondEffectif`). */
export function capHit(p, pl) {
  if (!p) return 0;
  const k = getPlayerKey(p);
  if (pl && pl.ltir.has(k) && pl.blesses.has(k)) return 0;
  if (pl && pl.ecole && pl.ecole.has(k)) return 0;
  return Math.round((p.$ || 0) * ((pl && pl.facteurs.get(k)) || 1));
}
export const capUsed = (pl = G.ligue ? plafondEffectif() : null) => signes().reduce((s, p) => s + (pl ? capHit(p, pl) : p.$), 0);
export const capLeft = () => { const pl = plafondEffectif(); return pl.cap - capUsed(G.ligue ? pl : null); };
// En Rogue, une case de réserve libre n'est pas « à combler » (S80) : seules les cases habillées bloquent la saison.
export const slotsLeft = () => casesActives().filter(s => !G.roster[s.i] && !(G.bonus === 'ROGUE' && s.scratch)).length;
export const totalCases = () => casesActives().length;

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
export function zoneEcart(p, s) {
  if (!p || !s || s.scratch || s.group === 'G' || p.p === 'G') return null;
  const ideal = unitesIdeales(p, getHiddenRatings(p).v);
  if (s.unit > Math.max(...ideal)) return joueEnBas(p, s.group, s.unit) ? null : 'sous';
  if (s.unit < Math.min(...ideal)) return 'dessus';
  return null;
}

export const ZONE_SOUS_TITLE = 'Sous sa zone : ici, son talent est gaspillé et toute l\'unité porte un malus proportionnel à ce qu\'on perd. Vise une autre case dans l\'alignement ou déplace quelqu\'un.';
// Les chiffres du moteur (`malusZoneJoueur`, js/sim.js) : ZONE_PEN_DESSUS × crans^ZONE_PUISSANCE (V2.2, les bons chiffres).
const malusDessus = n => String(Math.round(ZONE_PEN_DESSUS * n ** ZONE_PUISSANCE * 10) / 10).replace('.', ',');
export const ZONE_DESSUS_TITLE = `Au-dessus de sa zone : −${malusDessus(1)} à un cran, −${malusDessus(2)} à deux, −${malusDessus(3)} à trois. Il tient la case faute de mieux.`;

export const nextNeed = () => casesActives().find(s => !G.roster[s.i]) || null;

/**
 * LA CASE COURANTE : celle que tu vises, sinon la première vide dans l'ordre
 * de l'alignement (premier trio, puis le deuxième… les paires, les gardiens,
 * les réservistes). En tirage LOTO c'est elle qui dit quel joueur exact les
 * trois clubs te tendent.
 */
export const caseCourante = () => (G.target !== null && !G.roster[G.target] && casesActives().includes(SLOTS[G.target]))
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
export function poserEchelle() {
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
export function candidats() {
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
export const openSlots = p => {
  let libres = casesActives().filter(s => !G.roster[s.i] && fits(p, s));
  if (MODE().loto) { const c = caseDeLaMain(); libres = libres.filter(s => s === c); }
  return libres.sort((a, b) => slotFitScore(p, a) - slotFitScore(p, b) || a.i - b.i);
};

/**
 * Somme maximale qu'on peut mettre sur ce joueur-ci sans se rendre incapable
 * de remplir les cases suivantes au salaire plancher. C'est le vrai budget
 * du directeur général, pas seulement le plafond restant.
 */
export const maxForPick = () => capLeft() - Math.max(0, slotsLeft() - 1) * MIN_SAL;

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
const VERSION_MOTEUR = 'S120';  // S120 (V17) : le duel se joue au plan — leur intention est leur plan, à la force du duel (FORCE_DUEL), ton adjoint propose le tien à chaque entracte ; le tableau, ses portes et la contrée sont partis ; une saison de Rogue en cours se rejoue. S119 (oct.) : la part de sa saison qu'un joueur a jouée se compte sur les matchs de SON équipe, lus du shard (`matchsDeSaSaison`, js/sim.js) — 2026-27 n'en compte qu'une dizaine, 1985-86 en comptait 80 ; sa chance de blessure et le gardien de fer changent. S118 (V15) : en Rogue, les badges des joueurs ouvrent les styles d'une unité (`styleOuvert`), et leur force suit leurs métaux ; le plan (les familles payées, le coach qui les compte) est parti ; une saison de Rogue en cours se rejoue. S117 (V13-2) : le duel se joue à ton tableau, sans main ni cahier ; ce qu'une intention contrée rend pèse 0,75 (FORCE_CONTRE) ; le butin d'un gros match gagné va à une place ; une saison de Rogue en cours se rejoue. S116 (V10) : le jeu de cartes neuf — chaque carte attend son moment (`si`, MOMENTS_SI), le cahier, les places, l'équipement, le personnel et les dossiers neufs ; l'ancien jeu est parti, les runs en cours repartent de zéro (`convertirAuJeuNeuf`, js/rogue.js). S115 (V9, tranche 8) : en Rogue, la ligue qui monte (les adversaires les plus faibles d'un tirage plus large, puis leurs cartes d'une édition par niveau, `habillerLaLigue`) et les exigences ; une saison de Rogue en cours se rejoue. S114 (V9) : en Rogue, le plan qui paie ses familles, le duel en trois périodes, les fils qui reviennent, le jouer blessé et la commotion qui se garde, les galons de la run (`_galon`) ; une saison de Rogue en cours se rejoue. S113 : chaque question du point de presse a ses réponses (js/vie-gm.js) ; une réponse d'avant ne se retrouve plus. S112 : le but en prolongation d'un trio vide appartient à un patineur habillé (il entrait au pointage sans marqueur). S111 (Jalon P) : les blessures au nombre de la vraie LNH (la part fragile ×9, BLESSURES_LNH), la robustesse d'en face qui blesse (FRAPPE), l'infirmerie qui ne déborde pas (INFIRMERIE_PLEINE), le club-école de l'IA (`ecoleDe`) et la blessure nommée par sa cause ; les arcs du Rogue (js/arcs.js). S110 (V7) : les mécaniques reviennent aux joueurs — l'agressivité d'une ligne est celle de sa carrure (agressiviteDeLigne), plus un réglage ; la chimie ne s'apprend plus (ni entente ni maîtrise, CHIMIE_FIT, CHIMIE_PART), le stage de système et ses cartes sont retirés, le plan « Le matraquage » aussi ; AMPLEUR_EVENEMENT 2,2 → 2,0. S109 : le Two-way d'un attaquant lit la défense d'abord ; à 35 points ou moins au rythme de 82 matchs (ATTAQUANT_DEFENSIF), sa défense seule, jusqu'à Or ; un attaquant qui a des votes au Selke est au moins Two-way Or. S108 (V6) : de vrais coéquipiers (même club, même saison) arrivent avec leur entente, ENTENTE_COEQUIPIERS matchs, pour toi comme pour l'IA. S107 (V6) : la défense compte — le malus « trop bas » ne retire plus de défense (le levier A), K_DEFENSE 0,05 → 0,10, le plan à domicile sur 80 % des présences, AMPLEUR_EVENEMENT 2,1 → 2,6. S106 (V6) : le plan d'appariement — l'équipe à domicile dit quel trio affronte lequel (PLAN_DOMICILE), et l'IA qui te reçoit envoie ses contres (planDeLIA). S105 : un seul coach en poste (V5) — une confiance neuve remplace l'autre, les cartes d'une autre couleur ne montent plus personne, et « Le congédiement » change de coach. S104 : un événement pèse un peu plus (AMPLEUR_EVENEMENT 2 → 2,1). S103 (V5) : les positions multiples réelles (positionsAvant) et les variantes qui brillent (la holo monte ses deux badges et son second rend plein, l'or de deux métaux) ; scripts/check_empreinte.mjs garde maintenant ce numéro honnête. S102 : un club de l'IA s'aligne au mieux depuis ses joueurs triés par clé — la reprise en mémoire rejouait un autre passé, et le gros match changeait de pointage après l'entracte. S101 : un palier gagné (variante, entraînement, mentor) rend du talent dans le canal de son badge (EFFET_PALIER) ; ce qui ne se voit pas dans les stats de base pèse le double (EFFET_ROLE, EFFET_GARDIEN) ; le Constant joue chaque soir, l'Acrobate les soirs chargés. S100 : les clubs de l'IA s'alignent au mieux en entrant dans la ligue et, quand un des leurs manque, tout le monde monte (lineupQuiMonte) ; 🛤 Le joueur de route finit à ×1,2 à l'étranger. S99 : un choix pèse (V4) — l'écart des options de dilemme, de séquence, d'avant-match et de réponse est multiplié par AMPLEUR_CHOIX. S98 : le feu qui s'entretient (V3.6) — l'étincelle, la braise et la traînée de poudre jouent sur la lancée, et elle peut être vive (LANCEE, lanceesDeLigne). S97 : la lancée et le doute du Rogue (V3.6) — un joueur qui marque beaucoup finit mieux, un vrai marqueur en panne doute (lanceeDe). S96 : monter un palier (V2.4) — la variante monte les badges au lieu d'un bonus tiré au hasard, l'été de travail et le mentor de trio. S95 : les voies des coachs recalibrées (V2.3, check_voies : JOUEUR_COACH 0,10 jusqu'à 24 paliers, en puissance ; la III relève le plafond de sa voie) et la robustesse lue sur la carrure. S94 : les systèmes lisent les badges (V2.3, fitDeCase). S93 : le cycle des systèmes fermé (V2.2) — l'enclave, les plombiers et le jeu à deux sens étouffent enfin quelqu'un. S92 : le tempo — le style d'un club ferme ou ouvre le jeu des deux côtés (tempoDe), la possession ne lit que les joueurs. S91 : les badges à paliers — chaque joueur rend son badge par joueur (Bronze à Platine), le passeur et le manieur montent la chimie. S90 : chaque journée tire ses dés à son matin, et la sauvegarde les garde (`deDuJour`) ; un pari se tranche au sel du choix. S89 : le fit d'un système se lit au style, à talent égal (PENTE_TALENT). S88 : un gros match date ses blessures dans la troisième période (le choix de l'entracte ne réécrit plus les deux premières). S87 : les ailes d'un système s'assortissent (AG et AD dans le sens où les ailiers rendent le mieux). S86 : la force et le style des clubs se mesurent après la remise à zéro des joueurs (la reprise rendait un autre passé). S85 : le partant blessé, l'auxiliaire prend le filet (le rappel ne joue plus tous les soirs). S84 : le vrai calendrier (82 matchs en 186 jours, des congés, des dos-à-dos ; la récupération par jour, les durées en matchs, les événements la veille). S83 : le gros match s'annonce la veille (ANNONCE_GROS = 1). S82 : la carte du New Jersey recentrée (0,945 · 0,935). S81 : le gros match s'annonce deux journées d'avance, et son avant-match arrive à l'annonce (S80 : le pesé pèse plus ; un soir de gros match, ni situation, ni accident, ni dilemme)
export function saveGame() {
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
        // Les dés déjà tirés, journée par journée et soir de séries par soir (`deDuJour`, js/sim.js).
        des: G.ligue.des || null,
        lbId: G.lbId || null,
      } : null,
      /*
       * LE TOURNOI SUR TABLE. Mêmes clés de clubs que la ligue, mais la
       * moitié seulement se rejoue : les matchs joués À VIDE repartent de
       * leur graine, TES matchs sont relus depuis leur feuille compacte —
       * aucune graine ne redonne tes décisions (voir `etatDuTournoi`).
       */
      tournoi: G.bonus === 'TABLE' && G.done && G.tournoi ? {
        ...MT.etatDuTournoi(G.tournoi),   // un tournoi existe : le mode table est chargé (js/charge-table.js)
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
export function clearSave() { nouvellePartie(genreCourant()); }

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
  const qui = [G.bonus !== 'ROGUE' && MODES[G.mode] ? MODES[G.mode].nom : '', G.repechage === 'FRANCHISE' && FRANCHISES[G.franchise] ? FRANCHISES[G.franchise].nom : '', G.epoque || ''].filter(Boolean).join(' · ');
  // S80 : une run Rogue dit sa saison, au menu comme au hub.
  if (G.bonus === 'ROGUE' && G.rogue && G.rogue.saison) etape = `Run ${G.rogue.numero || ''} · saison ${G.rogue.saison} · ${etape}`.replace('Run  ·', 'Run ·');
  return { etape, qui, vierge: !signes && !L };
}

const PALETTES = ['graphite', 'oled', 'glace'];
/** Pose la palette sur <html> : c'est le seul endroit qui la connaît. */
function appliquerPalette() {
  document.documentElement.dataset.palette = G.palette;
}

export function saveOpts() {
  try {
    localStorage.setItem('cap82_opts', JSON.stringify({
      statsProrata: G.statsProrata, salaryMode: G.salaryMode, mode: G.mode, epoque: G.epoque,
      repechage: G.repechage, franchise: G.franchise, palette: G.palette, bonus: G.bonus, sons: G.sons, niveauTable: G.niveauTable, formatTable: G.formatTable,
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
    if (o.formatTable === 'COMPLET' || o.formatTable === 'ECLAIR') G.formatTable = o.formatTable;
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
      return { reprise: async () => { await (await chargerTable()).reprendreTournoi(etat); } };
    }
    if (data.partie && data.partie.graine) {
      const { graine, adversaires = [], journee = 0, decisions = [], series = null, lbId = null, decisionsSeries = [], des = null } = data.partie;
      if (data.moteur !== VERSION_MOTEUR) setTimeout(() => toast('Le jeu a changé depuis ta dernière visite : ta saison en cours se rejoue avec les nouvelles règles, et des matchs déjà vus peuvent finir autrement.'), 1500);
      G.lbId = lbId;
      G.dsReprise = decisionsSeries;
      G.desReprise = des;
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
/*
 * TON CLUB (1.0, oct.) : le nom, les couleurs et l'écusson choisis au vestiaire (js/club.js). Au
 * démarrage et après chaque choix : le nom complet de `YOU`, l'en-tête, et les couleurs de l'interface.
 */
export function poserLeClub() {
  appliquerClub();
  TEAMFULL.YOU = nomDuClub();
  const nom = document.querySelector('.tete-nom');
  if (nom) nom.textContent = nomDuClub();
  // L'écusson de l'en-tête se redessine au prochain `majEntete`.
  const ecu = $('teteEcu');
  if (ecu) ecu.innerHTML = '';
}

export function applyTeamColors(team) {
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
  // LA PHOTO DE FOND (1.0, oct.) : ta vedette en saison, celle du vestiaire tiré au repêchage ; sous un voile noir (style.css, --scene).
  const v = vestiaire();
  const src = photoDeFond(code === 'YOU' ? signes() : v && v.team === team ? v.pool : []);
  root.setProperty('--photo', src ? `url("${src}")` : 'none');
  root.setProperty('--voile-photo', src ? 'var(--voile-noir)' : 'none');
}

export function positionLabel(p) {
  if (!p) return '';
  if (p.p === 'G') return 'G';
  let primary = 'F';
  if (isD(p)) primary = (p.np === 'RD' || p.np === 'DD' || p.np === 'R') ? 'DD' : 'DG';
  // Un défenseur qui a joué les deux côtés dans sa vraie saison (`dc`) le dit : « DG/DD ».
  if (isD(p) && p.dc) return primary === 'DG' ? 'DG/DD' : 'DD/DG';
  else if (p.np === 'C') primary = 'C';
  else if (p.np === 'R' || p.np === 'AD') primary = 'AD';
  else if (p.np === 'L' || p.np === 'AG') primary = 'AG';
  // V5 : un attaquant qui a vraiment joué ailleurs le dit, comme dans un pool (« C/AG », « AG/AD »).
  if (primary === 'C' || primary === 'AG' || primary === 'AD') {
    const autres = ['C', 'AG', 'AD'].filter(x => x !== primary && positionsAvant(p).has(x));
    if (autres.length) return [primary, ...autres].join('/');
  }
  return primary;
}

/*
 * UN JOUEUR SE NOMME PAR CE QU'IL EST (S79). JP : *jamais identifier les
 * joueurs avec leurs places dans l'alignement, mais leurs vrais traits,
 * stats et positions*. « C / AG · 🎯 Sniper · 45 B · 82 PTS » : ses
 * positions, son rôle (lu dans ses vraies stats), sa vraie saison, ses
 * traits. La case ne se nomme que là où c'est ELLE qu'on choisit.
 */
export function quiEst(p, { role = true, stats = true } = {}) {
  if (!p) return '';
  const pp = role ? badgesDe(p)[0] : null;
  const st = stats ? displayStats(p) : null;
  const saison = !st ? '' : p.p === 'G' ? `${st.w} V${p.sv != null ? ` · ${p.sv} %ARR` : ''}` : `${st.g} B · ${st.pt} PTS`;
  const traits = getTraits(p).map(t => TRAITS[t.cle] && TRAITS[t.cle].icon).filter(Boolean).join('');
  return [positionLabel(p), pp ? `${pp.ico} ${motDuBadge(pp)}` : '', saison, traits].filter(Boolean).join(' · ');
}

export function positionClass(p) {
  if (!p) return 'pos-f';
  if (p.p === 'G') return 'pos-g';
  if (isD(p)) return 'pos-d';
  return 'pos-f';
}

export function formatName(full) {
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

/* Le % d'arrêts d'un gardien, à la façon d'une carte (« ,912 ») : son chiffre clé depuis 1.0 (C2), le seul que le moteur lit. */
const svCourt = p => (p.sv == null ? '—' : pct3(Number(p.sv)));
/*
 * LE CHIFFRE CLÉ D'UN JOUEUR SUIT SON RÔLE (1.0). JP : *on ne distingue pas
 * bien les joueurs selon position ; un excellent bagarreur de quatrième trio
 * devrait être impactant*. Les points disaient tout de tout le monde, donc un
 * bagarreur lisait « 3 PTS » et rien de ce qu'il fait. Une vraie stat, jamais
 * une cote : un gardien son % d'arrêts ; un bagarreur ses minutes de punition ;
 * un checker, un plombier ou un défenseur physique ses mises en échec par
 * match (comptées dès 2005-06 — avant, les punitions pour le physique, les
 * points pour les autres) ; un défenseur défensif ses tirs bloqués par match
 * (dès 2005-06, sinon son différentiel par match — un total de saison à côté
 * de ses points a l'air d'une copie) ; les autres leurs points. La carte du
 * vestiaire, la carte mini, la case de l'alignement et la fiche lisent tous
 * ici — un seul chiffre par joueur, le même partout.
 */
const parMatch = x => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
export function chiffreCle(p) {
  if (p.p === 'G') return { v: svCourt(p), u: '%ARR', mot: 'son % d\'arrêts' };
  const st = displayStats(p);
  const cle = (badgesDe(p)[0] || {}).cle;
  if (cle === 'bagarreur') return { v: p.pim ?? 0, u: 'PUN', mot: 'ses minutes de punition' };
  if (cle === 'checker' || cle === 'energie' || cle === 'physique') {
    if (p.ht != null) return { v: parMatch(p.ht), u: 'MÉ/M', mot: 'ses mises en échec par match' };
    if (cle === 'physique') return { v: p.pim ?? 0, u: 'PUN', mot: 'ses minutes de punition' };
  }
  if (cle === 'defensif') {
    if (p.bl != null) return { v: parMatch(p.bl), u: 'TB/M', mot: 'ses tirs bloqués par match' };
    return { v: pmMatch(st.pm, st.gp), u: '+/M', mot: 'son différentiel par match' };
  }
  return { v: st.pt, u: 'PTS', mot: 'ses points' };
}

/** Statistiques telles qu'affichées, selon les options (prorata, salaire). */
export function displayStats(p) {
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
export function agesAvailable() {
  return G.tirage.some(v => v.pool.some(p => p.bd)) || picked().some(p => p.bd);
}

/* SA COULEUR (v2, js/coachs.js) : le coach de son meilleur rôle maîtrisé — ses cartes et la confiance de ce coach comptent sur lui. */
export function coachTag(p) {
  const C = COACHS[coachDuJoueur(p)];
  return C ? `<span class="tag" title="Joueur ${esc(C.de)} : il porte la confiance de ce coach (+${Math.round(JOUEUR_COACH * 100)} % s'il est Bronze, +${Math.round(JOUEUR_COACH * 400)} % Platine, habillé) et fait grandir les cartes de sa couleur.">${C.ico} ${esc(C.nom)}</span>` : '';
}
export function zoneTag(p, mini = false) {
  const v = getHiddenRatings(p).v;
  const z = getLineZone(p, v);
  // LA ZONE QUI A GRANDI (l'atelier, S78) : « ⏫ Monte d'un cran » lui ouvre
  // une unité de plus vers le haut. L'étiquette dit la zone qu'il a
  // MAINTENANT (`unitesIdeales`) — « Middle 6 » mentirait sur un joueur qui
  // rend désormais au 1er trio : il est « Top 9 ».
  const ideal = p.p === 'G' ? z.idealUnits : unitesIdeales(p, v);
  const grandie = ideal.length !== z.idealUnits.length;
  const where = ideal.map(u => u + 1).join(', ');
  const unit = isD(p) ? 'paires' : p.p === 'G' ? 'rôles' : 'trios';
  let court = mini ? (z.mini || z.short) : z.short;
  if (grandie) court = nomDeFenetre(isD(p) ? 'D' : 'F', ideal) || court;
  const enBas = p.p !== 'G' && p._enBas;
  const titreBas = enBas ? ` Le ${isD(p) ? '3e paire' : '4e trio'} ne le punit plus.` : '';
  return `<span class="tag tag-zone lz${z.level}" title="Zone : ${esc(z.label)}${grandie ? ', monté d\'un cran' : ''}.${titreBas} Rend à 100 % sur les ${unit} ${where}. Elle dit OÙ il joue ; son badge dit ce qu'il y fait.">${esc(court)}</span>`;
}


/*
 * SON RÔLE, EN UN MOT (S71). JP : *la carte des joueurs est rendue trop
 * complexe à lire*. La carte portait cinq sortes de pastilles, la plupart en
 * icône seule (« 🎯 98 », 🧊, 🪨, l'archétype, les traits) : elle dit
 * maintenant ce qu'il est — son meilleur rôle, en mots — et où il rend. Le
 * reste vit dans la fiche, à un toucher.
 */
/* FRAGILE (V2.2) : il a manqué assez de sa vraie saison pour se blesser au moins deux fois plus (`fragiliteDe`, js/sim.js). */
export function fragileTag(p) {
  if (!p || G.bonus === 'TABLE') return '';
  const x = fragiliteDe(p);
  if (x < FRAGILE_DES) return '';
  const n = Math.round(x);
  return `<span class="tag tag-fragile" title="${p.gp || 0} matchs sur ${matchsDeSaSaison(p)} dans sa vraie saison : il se blesse environ ${n} fois plus qu'un joueur qui les a tous joués.">Fragile ×${n}</span>`;
}
export function roleTag(p) {
  const marques = clesDesMods(p).map(k => MUTATIONS[k] ? `<span class="tag tag-mut" title="${esc(MUTATIONS[k].nom)} — ${esc(MUTATIONS[k].quoi)}">${MUTATIONS[k].ico} ${esc(MUTATIONS[k].nom)}</span>` : '').join('');
  const [pp, r2] = badgesDe(p);
  if (pp) return `<span class="tag tag-role" title="${esc(titreDuBadge(pp))}${r2 ? ` · second badge : ${esc(motDuBadge(r2))}` : ''}"><i class="badge pal-${pp.palier}">${pp.ico}</i> ${esc(pp.nom)} <b class="badge pal-${pp.palier}">${PALIERS[pp.palier].nom}</b>${r2 ? ` <small>· <i class="badge pal-${r2.palier}">${r2.ico}</i></small>` : ''}</span>${marques}`;
  // 1.0 (C2) : l'archétype ne se lit que pour un gardien ; un patineur sans rôle lu (trop peu joué) n'en porte pas.
  if (p.p !== 'G') return marques;
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
  // Dans la fiche (`full`), un trait qu'un badge porte déjà (« Two-way Or · Selke ») ne se redit pas (JP : *ça sert à
  // rien de redire si le badge peut faire la job*).
  const portes = full && p && p.p !== 'G' ? new Set(badgesDe(p).map(b => b.trait).filter(Boolean)) : new Set();
  return getTraits(p).filter(t => !portes.has(t.cle)).map(t => {
    const meta = TRAITS[t.cle];
    // Une réputation n'est pas un vote : ni lauréat ni finaliste (V2.1).
    const niveau = meta.reputation ? 'Réputation' : t.niveau === 0 ? 'Lauréat' : 'Finaliste';
    const txt = full ? ` ${esc(meta.label)}${t.niveau ? ' (finaliste)' : ''}` : '';
    return `<span class="tag tag-trait${t.niveau ? ' est-finaliste' : ''}"`
      + ` title="${esc(meta.short)} ${esc(p.s)} — ${niveau}. ${esc(meta.desc)}.">`
      + `${meta.icon}${txt}</span>`;
  });
}
export const traitTags = (p, full = false) => traitTagList(p, full).join('');

export function realTag(p) {
  return p.isReal
    ? `<span class="tag tag-real" title="Salaire réellement publié cette saison-là, converti au prorata du plafond de l'année.">Salaire réel</span>`
    : `<span class="tag tag-est" title="Salaire estimé d'après sa saison : aucun montant publié cette année-là.">Salaire estimé</span>`;
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
 * TOUT SUR L'APPAREIL, UNE FOIS (S78, 1.0). Sur le Web, la page demande au
 * travailleur de service de garder les visages et les écussons, en
 * arrière-plan, après le premier rendu ; `cap82_visages` retient le lot déjà
 * gardé, et un nouveau lot se complète tout seul. Les photos d'action
 * (img/actions, 1.0) suivent le même chemin. Dans l'application Android,
 * l'APK n'emporte ni les visages ni les photos : l'appareil les télécharge à
 * la LNH et les recadre lui-même (js/visages.js, puis js/actions.js, une fois
 * les visages gardés).
 */
async function prechargerVisages() {
  try {
    if (!PORTRAITS_LOCAUX) return;
    if (surAppareil()) { demarrerVisages([...PORTRAITS_LOCAUX], { toast }).catch(() => {}).then(demarrerActions); return; }
    if (!navigator.serviceWorker || !location.protocol.startsWith('http')) return;
    const actions = await actionsDisponibles();
    // Le lot : le nombre de visages, d'écussons et de photos, et leur taille (S80 : 320 px) — des images neuves se regardent.
    const cle = `${PORTRAITS_LOCAUX.size}+${LOGOS_LOCAUX.size}+${actions.length}@320`;
    if (localStorage.getItem('cap82_visages') === cle) return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return;
    navigator.serviceWorker.addEventListener('message', ev => {
      if (!ev.data || ev.data.visagesPrets !== cle) return;
      try { localStorage.setItem('cap82_visages', cle); } catch { /* stockage plein */ }
      if (ev.data.nouveaux) toast(`📥 Les ${PORTRAITS_LOCAUX.size.toLocaleString('fr-CA')} visages et ${LOGOS_LOCAUX.size} écussons sont sur ton appareil : le jeu marche hors ligne.`);
    });
    reg.active.postMessage({ cle, precharger: [...[...LOGOS_LOCAUX].map(c => `img/logos/${c}.svg`), ...[...PORTRAITS_LOCAUX].map(id => `img/mugs/${id}.webp`), ...actions.map(id => `img/actions/${id}.webp`)] });
  } catch { /* pas de travailleur : les visages viendront à l'usage */ }
}

export function headshotHtml(p) {
  const fallback = `<span class="headshot-fallback">👤</span>`;
  if (!p || !p.id) return fallback;
  const id = Number(p.id);
  // La classe `visage` porte le cadrage commun (style.css) : aucun écran ne zoome à sa façon.
  // Sans photo à la LNH : sa silhouette générique, recadrée comme les autres — elle, toujours locale.
  if (PORTRAITS_LOCAUX) return PORTRAITS_LOCAUX.has(id)
    ? `${fallback}${surAppareil() ? imgVisage(id) : `<img class="visage" src="img/mugs/${id}.webp" alt="" loading="lazy" onerror="this.remove()">`}`
    : `${fallback}<img class="visage silhouette" src="img/mugs/silhouette.webp" alt="" loading="lazy" onerror="this.remove()">`;
  if (PORTRAITS_ABSENTS.has(id)) return fallback;
  return `${fallback}<img src="https://assets.nhle.com/mugs/nhl/latest/${id}.png" alt="" loading="lazy" onerror="this.remove();cap82.portraitAbsent(${id})">`;
}

/* ---------- toast ---------- */

/*
 * UNE FILE D'ATTENTE (Jalon M, B8) : un seul élément, et chaque message effaçait celui d'avant — de trois galons en
 * 900 ms, seul le dernier se lisait. Un message répond d'habitude au geste qu'on vient de faire : il remplace celui
 * d'avant. Ceux d'une suite (la fin d'une saison : les médailles, la découverte, les jalons, le panthéon) passent
 * `attendre` : ils attendent leur tour, chacun le temps qu'on le lise. Un message déjà affiché ou en attente ne se
 * répète pas.
 */
let toastTimer = null, toastCourant = null;
const fileDesToasts = [];
const TOASTS_EN_ATTENTE = 4;
export function toast(msg, kind = '', { attendre = false } = {}) {
  if (!$('toast')) return;
  if (toastCourant && toastCourant.msg === msg) return;
  if (fileDesToasts.some(x => x.msg === msg)) return;
  if (!attendre || !toastCourant) { montrerToast({ msg, kind }); return; }
  if (fileDesToasts.length < TOASTS_EN_ATTENTE) fileDesToasts.push({ msg, kind });
}
function montrerToast(x) {
  const el = $('toast');
  clearTimeout(toastTimer);
  if (!x || !el) { toastCourant = null; return; }
  toastCourant = x;
  el.className = 'toast on' + (x.kind ? ' ' + x.kind : '');
  el.textContent = x.msg;
  // Un long message reste le temps qu'on le lise ; le suivant attend que celui-ci soit parti.
  toastTimer = setTimeout(() => { el.className = 'toast'; toastTimer = setTimeout(() => montrerToast(fileDesToasts.shift()), 250); }, Math.min(6000, Math.max(1800, x.msg.length * 45)));
}

/* =====================================================================
   Démarrage
   ===================================================================== */

async function boot() {
  // La page de départ, posée AVANT tout rendu : la feuille de style lit
  // `body[data-page]` pour décider ce que chaque onglet montre, et sans elle
  // le premier dessin se ferait sans page.
  marquerPage('repechage');
  document.body.dataset.effectif = 'F';
  // Le bilan (js/bilan.js) reçoit ici tout ce qu'il lui faut du contrôleur.
  brancherBilan({
    $, G, TEAMFULL, capUsed, esc, formatName, headshotHtml, ico, lienEquipe, lienJoueur, porteeRevele,
    capMax: () => MODE().cap,
    money, openModal, ouvrirNouvellePartie, picked, rejouerSaison, renderMain,
    saveLeaderboard, majLeaderboard, lireSeriesHistorique, saveGame, montrerPage, statsSim, toast, deciderSerie, bancSerie, finDesSeriesRogue,
    // L'onglet « La ligue » reconstitue la VRAIE fiche des 31 adversaires :
    // il lui faut le shard de leur saison, et le chargeur le met en cache.
    getShard,
  });
  // S77 : l'ancienne sauvegarde unique devient la première partie de l'index.
  migrer();
  // V10 : le jeu de cartes neuf, une fois — les runs en cours repartent de zéro, l'inventaire de cartes se vide.
  const meta = lireMeta(), converti = convertirAuJeuNeuf(meta);
  if (converti) {
    const runs = retirerLesRuns();
    ecrireMeta(converti);
    if (runs || Object.keys(meta.inventaire || {}).length || (meta.personnel || []).length) {
      setTimeout(() => toast('Le Rogue a un jeu de cartes neuf : ta run repart de zéro, et tes cartes d\'avant sont parties. Ton cartable, tes médailles et tes déblocages restent.'), 1500);
    }
  }
  // PREMIÈRE VISITE : ni préférences ni partie. Lu AVANT `loadOpts`, qui écrit.
  let vierge = false;
  try { vierge = !localStorage.getItem('cap82_opts') && !lireIndex().parties.length; } catch { /* stockage indisponible */ }
  try {
    loadOpts();
    appliquerPalette();
    poserLeClub();
    activerSons(G.sons);
    await Promise.all([loadIndex(), chargerPortraits(), actionsDisponibles()]);
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
export function contexteDuMenu({ vierge = false, enJeu = true } = {}) {
  const ailleurs = (apres = null) => {
    if (!demarre) { fermerMenu(); continuerBoot(apres).catch(() => toast('Impossible de reprendre cette partie.', 'bad')); return; }
    try { sessionStorage.setItem('cap82_session', '1'); if (apres) sessionStorage.setItem('cap82_apres', apres); } catch { /* ignore */ }
    location.reload();
  };
  return {
    vierge, enJeu,
    continuer: () => { if (demarre) fermerMenu(); else ailleurs(); },
    reprendre: id => { activer(id); ailleurs(); },
    nouvelle: genre => { nouvellePartie(genre); ailleurs(`nouvelle-${genre}`); },
    options: () => { syncOptionsUI(); openModal('optionsModal'); },
    regles: ouvrirRegles,
    // L'EXHIBITION (S78, js/exhibition.js) : aucune partie, on revient au menu en la fermant.
    // 1.0 (J3-6) : l'écran d'exhibition se charge au clic, pas avec le premier écran.
    exhibition: () => { fermerMenu(); import('./exhibition.js').then(({ ouvrirExhibition }) => ouvrirExhibition(ctxExhibition(() => afficherMenu(contexteDuMenu({ vierge, enJeu }))))); },
    rogue: {
      // 1.0 (R7, R8) : la dernière run sur le carton, rien à la première visite.
      resume: () => {
        const m = lireMeta();
        if (!(m.runs > 0)) return '';
        const d = m.derniereRun;
        const vitrine = m.coupes ? ` · 🏆 ${m.coupes}` : '';
        if (d && d.numero === m.runs) return `Run ${d.numero} · ${esc(motDeRun(d))} · 🏅 ${m.ecussons || 0}${vitrine}`;
        return `Run ${m.runs} en cours · 🏅 ${m.ecussons || 0}${vitrine}`;
      },
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

  // LES CINQ SECTIONS : la seule navigation du jeu. C'est `majNavbar` qui
  // les bâtit et qui branche leurs boutons.

  // Modales
  // Les équipes et tes saisons sont des PAGES, pas des modales : `montrerPage`
  // les remplit. L'en-tête ne garde que le Menu : une nouvelle partie, les
  // options et les règles y vivent (1.0, R1).
  bindModal('optionsModal', null, 'closeOptionsBtn');
  // Un mode choisi au Menu ouvre l'écran « Nouvelle partie », réglé sur ce mode (S79).
  bindModal('partieModal', null, 'closePartieBtn', semerBrouillon, oublierBrouillon);
  const menuBtn = $('menuBtn');
  if (menuBtn) menuBtn.onclick = () => { saveGame(); afficherMenu(contexteDuMenu({ enJeu: true })); };
  // MES LIGNES AU REPÊCHAGE (S68) : réglées avant la saison, elles entrent
  // dans la décision 0. Depuis S78, elles se règlent SOUS chaque trio de
  // l'alignement (`rangeeStrategie`, en fenêtre) : le bouton « Mes lignes » est parti.
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
  if (ex) ex.onclick = () => chargerTable().then(m => m.jouerExhibition());
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
      { cle: 'a1', rarete: 'commune', ico: '🎰', nom: '1. Repêche', type: 'La roulette', texte: 'Elle sort une saison et un vrai club de la LNH. Dans son vestiaire, tu piges un joueur.' },
      { cle: 'a2', rarete: 'peu', ico: '💰', nom: '2. Le plafond', type: '23 joueurs', texte: 'Signe-les tous sous le plafond salarial : trouver les aubaines, c\'est le métier.' },
      { cle: 'a3', rarete: 'peu', ico: '🏒', nom: '3. Tes lignes', type: 'L\'alignement', texte: 'Chaque joueur à sa case, chaque ligne son système. Un joueur mal placé rend moins.' },
      { cle: 'a4', rarete: 'rare', ico: '⏩', nom: '4. La saison', type: '82 matchs', texte: 'Elle se joue d\'un coup. Ton classement dit si ton équipe tient.' },
      { cle: 'a5', rarete: 'legendaire', ico: '🏆', nom: '5. La Coupe', type: 'Le but', texte: 'Les séries se regardent match par match. La Coupe est le vrai but ; le 82-0, le Graal.' },
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
          : 'Le 82-0 : 82 matchs d\'un coup, puis les séries.');
        return;
      }
      demarrageEnCours = true;
      go.disabled = true;
      try {
        // Le toast ne dit que ce qu'on ne voit pas (1.0, J2-6g) : le hasard qui
        // a choisi, ou une partie en cours qu'on vient d'effacer. Au premier tour
        // d'une partie neuve, la roulette à l'écran suffit.
        const effacee = !G.done && signes().length > 0;
        // L'identité se choisit AVANT la roulette, par-dessus cet écran.
        // Le 82-0 classique, c'est juste les joueurs : pas de carte d'identité (elle reste à Sur table).
        const choix = b.bonus === 'TABLE' ? await choisirIdentite() : null;
        await demarrerPartie({ ...b, identite: choix });
        closeModal('partieModal');
        if (auHasard.length || effacee) toast(`${auHasard.length ? `🎲 Le hasard a choisi ${auHasard.join(' et ')}. ` : ''}${MODES[b.mode].nom}${b.epoque ? ` · ${b.epoque}` : ''}${b.repechage === 'FRANCHISE' && FRANCHISES[b.franchise] ? ` · ${FRANCHISES[b.franchise].nom}` : ''} : la roulette repart à zéro.`);
      } catch {
        toast('Impossible de charger cette saison. Réessaie ou change de ligue.');
      } finally {
        demarrageEnCours = false;
        go.disabled = false;
        majPiedPartie();
      }
    };
  }

  /*
   * LE RETOUR, UN NIVEAU À LA FOIS (1.0, R1, js/pile.js) : Échap, B, le bouton
   * d'Android et « ‹ Retour » passent tous par ici, du plus haut au plus bas.
   */
  // GLISSER D'UN ONGLET À L'AUTRE (V6, js/glisser.js), à tous les niveaux.
  brancherGlisser();
  brancherRetour([
    fermerCoucheDuDessus,
    // Le direct et le plateau ont leur propre sortie : la saison ne se laisse
    // pas à moitié révélée, et un match sur table ne s'abandonne pas d'une touche.
    () => ['liveModal', 'tableModal'].some(id => $(id) && $(id).style.display === 'flex'),
    // L'exhibition, ouverte du Menu, se referme sur lui.
    () => { const b = document.querySelector('#exhibitionModal .exh-fermer'); if (!b) return false; b.click(); return true; },
    fermerRegles,
    // Le Menu en pleine partie : « Retour à la partie ». Au lancement, il est
    // l'écran titre, et rien n'est sous lui.
    () => { if (!$('menuDepart')) return false; if (demarre) fermerMenu(); return true; },
    // Une page du Club (le dépistage, la préparation, le sommaire) : retour au bureau.
    () => { const h = hubActif(); return !!(h && h.fermerPage && h.fermerPage()); },
    // La boutique : la fiche d'un pack se replie d'abord (la page elle-même est un sous-onglet, le retour suivant mène au Bureau).
    () => {
      const fiche = marcheOuvert && document.querySelector('#pageMarcheCorps .pk-fiche');
      if (!fiche) return false;
      fiche.remove();
      return true;
    },
    // Une case visée ou un joueur choisi dans l'alignement.
    () => {
      if (G.selectedSlot === null && G.target === null) return false;
      G.selectedSlot = null; G.target = null; render();
      return true;
    },
    // Une section : on remonte au Club. Au Club, rien — on y est.
    () => { if (!demarre || document.body.dataset.page === 'match') return false; montrerPage('match'); return true; },
  ]);
  brancherManette();
  window.addEventListener('keydown', ev => { if (ev.key === 'Tab') piegerFocus(ev); });

  $('mainBtn').onclick = runSeason;
}

/*
 * LA COUCHE DU DESSUS SE FERME, ET ELLE SEULE. 1.0 (R5) : les plein écran
 * `.choix-modal` (la boutique, l'inventaire, le classeur, un choix) passent
 * AVANT les modales à fond. La fiche d'un pack se replie d'abord ; un écran
 * qui a son ✕ se ferme comme par son ✕ ; un choix forcé (sans ✕) reste, et
 * rien en dessous ne bouge. Parmi les modales, on ne ferme que CELLE DU
 * DESSUS : la fiche « au-dessus » (z 120) passe avant un plein écran (96), qui
 * passe avant une modale à fond (90) — l'ordre de la feuille de style.
 * Vrai s'il y avait une couche.
 */
function fermerCoucheDuDessus() {
  const pleins = [...document.querySelectorAll('.choix-modal:not([hidden])')].filter(m => m.firstElementChild);
  const ouvertes = [...document.querySelectorAll('.modal-backdrop:not(.live)')]
    .filter(m => m.style.display && m.style.display !== 'none');
  if (!pleins.length && !ouvertes.length) return false;
  const z = el => Number(getComputedStyle(el).zIndex) || 0;
  const zPleins = pleins.length ? Math.max(...pleins.map(z)) : -1;
  const zOuvertes = ouvertes.length ? Math.max(...ouvertes.map(z)) : -1;
  if (pleins.length && zPleins >= zOuvertes) {
    const haut = pleins[pleins.length - 1];
    const ficheDePack = haut.querySelector('.pk-fiche');
    if (ficheDePack) ficheDePack.remove();
    else { const croix = haut.querySelector('.choix-fermer'); if (croix) croix.click(); }
    return true;
  }
  ouvertes.sort((a, b) => z(b) - z(a) || Number(b.dataset.rang || 0) - Number(a.dataset.rang || 0));
  fermerModale(ouvertes[0]);
  return true;
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
export function ouvrirModale(m) {
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

export const closeModal = id => fermerModale($(id));
export const openModal = id => ouvrirModale($(id));

export function setOption(key, val) {
  if (key === 'poolView') {
    G.poolView = val === 'LIST' ? 'LIST' : 'POS';
    // Demander les six colonnes quand un filtre n'en laisse qu'une seule ne
    // voudrait rien dire : le bouton lève le filtre plutôt que de ne rien
    // faire. Une commande visible doit toujours faire quelque chose.
    if (G.poolView === 'POS' && G.filter !== 'ALL') { G.filter = 'ALL'; renderFilters(); }
  }
  else if (key === 'effectif') {
    // L'onglet de l'alignement au téléphone (1.0, R4) : un état d'écran, jamais sauvegardé.
    // V6 : l'onglet Équipe — le plan de match derrière le banc, et le résumé d'équipe.
    document.body.dataset.effectif = ['E', 'F', 'D', 'S', 'G'].includes(val) ? val : 'F';
    document.querySelectorAll('.seg-effectif button').forEach(b => b.classList.toggle('on', b.dataset.val === document.body.dataset.effectif));
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
  else if (key === 'formatTable') G.formatTable = val === 'ECLAIR' ? 'ECLAIR' : 'COMPLET';
  else if (key === 'stats') G.statsProrata = val === 'prorata';
  else if (key === 'salary') G.salaryMode = val;
  else if (key === 'onlyFit') G.onlyFit = val === 'on';
  saveOpts();
}

/* ======================================================================
   LA COQUILLE : CINQ SECTIONS (1.0, R1)
   ======================================================================
   JP : *je me sens comme une balle de pinball* ; *que si je le montre à
   quelqu'un, ça ait pas l'air d'un jeu web, mais d'un jeu console, PC ou
   mobile*. La barre portait neuf onglets, dont trois pages de référence :
   c'était un site. Un jeu de gestion a cinq portes, toujours les mêmes, dans
   le même ordre, dans tous les modes ; ce qui change avec la phase, c'est ce
   que chaque porte MONTRE, jamais la barre (S67).

     Club        le bureau : la saison à lancer, le prochain match, la série, le bilan
     Effectif    l'alignement ; en pleine saison, derrière le banc
     Marché      le vestiaire (ou le loto) au repêchage ; ensuite la boutique et tes cartes
     Ligue       Classement · Calendrier · Meneurs · Équipes
     Collection  Saisons · Cartable

   Une section de plusieurs pages a ses onglets internes, sous l'en-tête du
   club. Les règles, les options et une nouvelle partie vivent dans le Menu.
   Une page qui n'a encore rien à montrer ne disparaît pas : elle dit pourquoi
   et offre la suite (`remplirVide`).

   `document.body.dataset.page` reste le seul état de la page, et la feuille
   de style en déduit tout ; `data-section` dit quelle porte est ouverte.
   ====================================================================== */
const SECTIONS = [
  { cle: 'bureau', ico: 'i-club', titre: 'Bureau' },
  { cle: 'joueurs', ico: 'i-jersey', titre: 'Joueurs' },
  { cle: 'lignes', ico: 'i-list', titre: 'Lignes' },
  { cle: 'ligue', ico: 'i-chart', titre: 'Ligue' },
];
/*
 * LE ROGUE, RANGÉ PAR INTENTION (V8, docs/refonte-v8.md). JP : *organiser l'information de façon claire, actionnable et
 * basée sur l'intention du joueur* ; *travailler surtout le roguelike, pas le reste*. Quatre portes, une intention chacune :
 *   Bureau    qu'est-ce que j'ai à faire, qu'est-ce qui s'en vient ? (À faire, la route, hier soir, avancer)
 *   Effectif  gérer mes joueurs (le tableau, les fiches, tes lignes, le dépistage de ton prochain adversaire)
 *             JP, 23 oct. : *Lignes dans effectif, pas ce soir* ; *pas besoin d'écran par match* ; *organise plus comme EHM*
 *   Marché    améliorer l'équipe (la boutique, l'album)
 *   Ligue     où j'en suis ?
 * Les autres modes gardent les leurs (`SECTIONS`).
 */
const SECTIONS_ROGUE = [
  { cle: 'bureau', ico: 'i-club', titre: 'Bureau' },
  { cle: 'effectif', ico: 'i-jersey', titre: 'Effectif' },
  { cle: 'marche', ico: 'i-marche', titre: 'Marché' },
  { cle: 'ligue', ico: 'i-chart', titre: 'Ligue' },
];
/* Le vestiaire (ou le loto) tant qu'on repêche. En saison, le Rogue bâtit par packs ; son repêchage vient entre deux saisons. */
const auVestiaire = () => enRepechage() && G.bonus !== 'ROGUE';
/*
 * LES PAGES DE CHAQUE SECTION (V7, docs/refonte-v7.md). JP : *revoir ce qui va où, de zéro ; on avait un dragon,
 * on veut un cheval*. Un onglet répond à UNE question de gérant, et chaque info a une seule maison :
 *   Bureau   qu'est-ce qui se passe aujourd'hui ? (le prochain match, ce qui attend ta décision)
 *   Joueurs  qui j'ai, et dans quel état ? (le tableau de l'effectif ; au repêchage du 82-0, le vestiaire)
 *   Lignes   comment on joue ce soir ? (les trios, les paires, les systèmes, le plan de match)
 *   Cartes   avec quoi je bâtis ? (tes cartes et ton deck ; la boutique ; l'album) — la main et ce qui est en jeu : au Bureau
 *   Ligue    où j'en suis ? (le classement, ta saison, les meneurs, les équipes, le palmarès)
 */
/* Un volet de l'écran de saison, ou que l'écran rouvrira : derrière le banc, il est fermé, et toucher le volet l'y ramène. */
const voletDeSaison = v => !!voletPour(v) || !!(G.banc && !G.banc.serie && G.bonus === 'ROGUE');
/* V12 (docs/refonte-v12.md) : les maisons de la boîte, chacune un sous-onglet de sa section, un usage chacune. */
const MAISONS_DE = { bureau: ['proprio', 'entraineur', 'presse', 'vestiaire'], effectif: ['infirmerie'], marche: ['butin'] };
const maisonsDe = sec => (G.bonus === 'ROGUE' ? MAISONS_DE[sec].filter(voletDeSaison) : []);
const PAGES_DE = {
  bureau: () => ['match', ...maisonsDe('bureau')],
  joueurs: () => [auVestiaire() ? 'repechage' : 'joueurs'],
  lignes: () => ['alignement'],
  // Le Rogue : l'Effectif, ses Lignes et le dépistage (le volet de l'écran de saison), le Marché.
  effectif: () => ['joueurs', 'alignement', ...(voletDeSaison('depistage') ? ['depistage'] : []), ...maisonsDe('effectif')],
  // V16 (tranche 6) : « Tes cartes » est parti — chaque carte rare se joue chez ce qu'elle monte.
  marche: () => ['marche', ...maisonsDe('marche'), 'cartable'],
  // En saison, le calendrier n'a pas de volet (ta route et tes matchs sont dans « Ta saison ») : l'onglet attend le bilan.
  ligue: () => ['classement', ...(hubActif() && !bilanPret() && !voletPour('calendrier') ? [] : ['calendrier']), ...(voletDeSaison('saison') ? ['saison'] : []), 'meneurs', 'equipes', 'historique'],
};
/* L'icône et le titre de chaque page : l'onglet interne, l'état vide. */
const PAGE = {
  match: ['i-club', 'Match'], depistage: ['i-list', 'Dépistage'], saison: ['i-saison', 'Ta saison'], alignement: ['i-list', 'Lignes'], joueurs: ['i-jersey', 'Joueurs'], repechage: ['i-dice', 'Vestiaire'], marche: ['i-marche', 'Boutique'],
  classement: ['i-chart', 'Classement'], calendrier: ['i-cal', 'Calendrier'], meneurs: ['i-star', 'Meneurs'], equipes: ['i-jersey', 'Équipes'],
  historique: ['i-trophy', 'Palmarès'], cartable: ['i-cartes', 'Album'],
  proprio: ['i-club', 'Proprio'], entraineur: ['i-cal', 'Entraîneur'], presse: ['i-list', 'Presse'], vestiaire: ['i-jersey', 'Vestiaire'],
  infirmerie: ['i-jersey', 'Infirmerie'], butin: ['i-cartes', 'Butin'],
};
/* En Rogue, le Bureau s'ouvre sur la boîte (V12) : ses sous-onglets en sont les maisons. */
const motDePage = p => (p === 'match' && G.bonus === 'ROGUE' ? 'Boîte' : PAGE[p][1]);
const ALIAS_PAGE = { bilan: 'match', series: 'match', stats: 'meneurs', ligue: 'classement', jambes: 'joueurs' };
/* Les sections du bilan que montre chaque page. */
const VOLETS_DU_BILAN = {
  match: ['series', 'bilan'], classement: ['classement', 'ligue'], calendrier: ['calendrier'],
  meneurs: ['stats'], alignement: ['alignement'],
};
/* Les pages de lecture, pareilles à tout moment de la partie. */
const PAGES_REF = ['equipes', 'historique'];

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
export const enRepechage = () => !G.done && !bilanPret() && !hubActif();

/*
 * AUCUNE CARTE HORS DU ROGUE (JP, oct. : *jeu de table, 82-0, draft sans cartes, aucune carte en dehors du roguelike*).
 * Le 82-0, Sur table et l'exhibition, c'est les joueurs et leurs stats : la section Cartes n'y est pas.
 */
const sectionsDuMode = () => (G.bonus === 'ROGUE' ? SECTIONS_ROGUE : SECTIONS);
const sectionDe = cle => (sectionsDuMode().find(s => PAGES_DE[s.cle]().includes(cle)) || SECTIONS[0]).cle;
const PAGES = () => sectionsDuMode().flatMap(s => PAGES_DE[s.cle]());
/* La dernière page ouverte de chaque section : la Ligue rouvre sur le calendrier qu'on lisait. */
const dernierePage = {};
/* La page du Marché ouverte ('marche'), ou null. Elle survit à la saison rejouée (un achat, une carte jouée). */
let marcheOuvert = null;

function sectionsCourantes() {
  const draft = enRepechage();
  return sectionsDuMode().map(s => ({
    ...s,
    // ESTOMPÉE PENDANT LE REPÊCHAGE (1.0, J2-6e) : la Ligue n'a rien avant le
    // premier match et le dit d'un coup d'oeil. La toucher reste permis.
    mort: draft && s.cle === 'ligue' ? 'Dès le premier match' : '',
    // Au repêchage, les Joueurs comptent ce qui se signe, les Lignes ce qui est signé.
    badge: !draft ? '' : s.cle === 'joueurs' && auVestiaire() ? String(compteSignables())
      : s.cle === 'lignes' || s.cle === 'effectif' ? `${signes().length}/${totalCases()}` : '',
  }));
}

/*
 * LA BARRE (un rail à gauche dès 1000 px, des onglets en bas au téléphone).
 * Elle se rebâtit quand un badge change, jamais à chaque rendu. Ses entrées,
 * elles, ne changent jamais.
 */
export function majNavbar(cle = G.page) {
  const nav = $('navbar');
  if (!nav) return;
  const liste = sectionsCourantes();
  const sig = liste.map(o => `${o.cle}:${o.badge}:${o.mort ? 1 : 0}`).join('|');
  if (nav.dataset.sig !== sig) {
    nav.dataset.sig = sig;
    nav.innerHTML = `<div class="rail-logo" aria-hidden="true">CAP <b>82-0</b></div>${liste.map(o => `<button class="navtab${o.mort ? ' mort' : ''}" type="button" role="tab" data-section="${o.cle}" aria-selected="false"${o.mort ? ` title="${esc(o.mort)}"` : ''}>
      ${ico(o.ico)}<span class="navtab-lbl">${esc(o.titre)}</span>${o.badge ? `<span class="navtab-badge">${esc(o.badge)}</span>` : ''}
    </button>`).join('')}`;
    nav.querySelectorAll('.navtab').forEach(b => { b.onclick = () => ouvrirSection(b.dataset.section); });
  }
  const sec = sectionDe(cle);
  nav.querySelectorAll('.navtab').forEach(b => {
    const on = b.dataset.section === sec;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  majSousNav(cle, sec);
}

/* LES ONGLETS INTERNES d'une section de plusieurs pages, sous l'en-tête du club. */
function majSousNav(cle, sec) {
  const sous = $('sousNav');
  if (!sous) return;
  const pages = PAGES_DE[sec]();
  sous.hidden = pages.length < 2;
  // Un sous-onglet de la boîte compte ce qui y attend (V12).
  const h = hubActif(), n = p => (h && h.aRegler ? h.aRegler(p) : 0);
  const sig = sous.hidden ? '' : pages.map(p => `${p}:${n(p)}`).join('|');
  if (sous.dataset.sig !== sig) {
    sous.dataset.sig = sig;
    sous.innerHTML = sous.hidden ? '' : pages.map(p => `<button type="button" class="soustab" role="tab" data-page="${p}" aria-selected="false">${esc(motDePage(p))}${n(p) ? ` <span>${n(p)}</span>` : ''}</button>`).join('');
    sous.querySelectorAll('.soustab').forEach(b => { b.onclick = () => { jouerSon('valide'); montrerPage(b.dataset.page); }; });
  }
  sous.querySelectorAll('.soustab').forEach(b => {
    const on = b.dataset.page === cle;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

/* Toucher une section rouvre la page qu'on y lisait, sinon sa première. Le Bureau rouvre toujours sur la boîte (V12) : ses
   sous-onglets sont les maisons où elle renvoie. */
function ouvrirSection(sec) {
  const pages = PAGES_DE[sec]();
  jouerSon('valide');
  montrerPage(sec !== 'bureau' && pages.includes(dernierePage[sec]) ? dernierePage[sec] : pages[0]);
}

/*
 * OÙ VIT UNE PAGE, À CE MOMENT-CI. Un seul endroit à la fois :
 *   'hub'       un volet de l'écran de saison, des séries ou du tournoi
 *   'jeu'       le repêchage, l'alignement, ou une section du bilan (#game)
 *   'ref'       une page de lecture (les équipes, tes saisons)
 *   'marche'    tes cartes et la boutique (jamais dans la feuille du Club)
 *   'cartable'  tes joueurs gagnés
 *   'vide'      rien encore : la page dit pourquoi et offre la suite
 */
function zoneDe(cle) {
  const hub = hubActif();
  if (hub && voletPour(cle)) return 'hub';
  if (PAGES_REF.includes(cle)) return 'ref';
  if (PAGES_DU_MARCHE[cle]) return 'marche';
  if (cle === 'cartable' || cle === 'joueurs') return cle;
  if (bilanPret() && !hub) return VOLETS_DU_BILAN[cle] ? 'jeu' : 'vide';
  if (cle === 'repechage') return 'jeu';
  // Pendant les séries et le tournoi, l'alignement est figé : rien à y faire.
  if (cle === 'alignement') return hub ? 'vide' : 'jeu';
  return 'vide';
}

/* Une page d'avant la coquille (une sauvegarde, un rappel) retombe sur ses pieds. */
function normaliser(cle) {
  cle = ALIAS_PAGE[cle] || cle;
  // Le vestiaire n'existe qu'au repêchage ; le tableau des joueurs prend sa place ensuite, et réciproquement.
  if (cle === 'repechage' || cle === 'joueurs') cle = PAGES_DE.joueurs()[0];
  return PAGES().includes(cle) ? cle : 'match';
}

/** Pose la page courante. Ne remplit rien d'autre que les pages de la coquille. */
function marquerPage(cle) {
  cle = normaliser(cle);
  const avant = document.body.dataset.page;
  G.page = cle;
  const sec = sectionDe(cle);
  dernierePage[sec] = cle;
  const zone = zoneDe(cle);
  // Quitter la boutique la referme : elle n'est jamais ailleurs.
  marcheOuvert = PAGES_DU_MARCHE[cle] ? cle : null;
  // Une page du Marché quittée se redessine au retour : celle de la saison ne reste pas après elle.
  if (!marcheOuvert && $('pageMarcheCorps')) delete $('pageMarcheCorps').dataset.rendu;
  document.body.dataset.page = cle;
  document.body.dataset.section = sec;
  document.body.dataset.zone = zone;
  // L'ÉCRAN DE SAISON S'ANCRE DANS LA PAGE (S67) : sous l'en-tête, à côté du
  // rail ou au-dessus des onglets, jamais par-dessus. Quand la page ouverte
  // n'est pas l'un de ses volets (le marché, tes saisons), il se retire sans se fermer.
  const hub = hubActif();
  document.body.classList.toggle('hub-docke', !!hub);
  document.body.classList.toggle('hub-cache', !!hub && zone !== 'hub');
  if (zone === 'hub') {
    const v = voletPour(cle);
    if (v && hub.courant() !== v) hub.montrer(v);
  }
  // Les sections du bilan que cette page porte, et elles seules.
  const vis = VOLETS_DU_BILAN[cle] || [];
  document.querySelectorAll('#resultHost .result-pane').forEach(p => {
    p.hidden = !vis.includes(p.dataset.volet) || !p.textContent.trim();
  });
  if (G.done) brancherEntractes($('resultHost'));   // un deck caché mesure zéro
  /*
   * UNE RANGÉE CACHÉE MESURE ZÉRO (1.0, J2-4). `ajusterCartes` réduit les
   * noms et les étiquettes qui débordent — mais l'alignement se dessine
   * pendant qu'on est au vestiaire, onglet caché : chaque rangée mesurait 0,
   * rien n'était réduit, et à l'ouverture de l'onglet les icônes d'une case
   * sortaient coupées à droite. On remesure l'onglet une fois montré.
   */
  requestAnimationFrame(() => ajusterCartes(document));
  majNavbar(cle);
  majEntete();
  for (const [id, p] of [['pageEquipes', 'equipes'], ['pageHistorique', 'historique']]) {
    const el = $(id);
    if (el) el.hidden = !(zone === 'ref' && cle === p);
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
  const joueurs = $('pageJoueurs');
  if (joueurs) {
    joueurs.hidden = zone !== 'joueurs';
    if (zone === 'joueurs') remplirJoueurs();
  }
  const marche = $('pageMarche');
  if (marche) {
    marche.hidden = zone !== 'marche';
    if (zone === 'marche') remplirMarche();
  }
  if (avant && avant !== cle) animerEntree(zone);
}

/*
 * L'ÉCRAN QUI ARRIVE SE VOIT ARRIVER (1.0, R1) : il se fond en moins d'un
 * quart de seconde (rien sous prefers-reduced-motion). L'écran de saison a
 * déjà son propre glissement de volet (S77).
 */
function animerEntree(zone) {
  if (zone === 'hub') return;
  const el = document.querySelector('.page:not([hidden]):not(#pageRegles)') || $('game');
  if (!el) return;
  el.classList.remove('ecran-entre');
  void el.offsetWidth;
  el.classList.add('ecran-entre');
}

/*
 * L'EN-TÊTE DU CLUB (1.0, R1) : ton écusson, où en est la partie, et trois
 * chiffres — la fiche et le rang à la DERNIÈRE JOURNÉE RÉVÉLÉE (jamais la fin
 * de l'année : on ne lit que ce qui est arrivé), puis le plafond, que
 * `renderCap` tient déjà. Le rang suit le bris d'égalité du classement de
 * l'écran de saison (js/saison.js).
 */
let ficheEnCache = null;
function ficheEtRang() {
  const L = G.ligue;
  if (!L || !L.you || !Array.isArray(L.calendrier) || !Array.isArray(L.teams)) return null;
  const jour = Math.min(G.journee || 0, L.calendrier.length);
  if (!jour) return null;
  if (ficheEnCache && ficheEnCache.L === L && ficheEnCache.jour === jour) return ficheEnCache.r;
  const f = new Map(L.teams.map(t => [t, { W: 0, L: 0, OTL: 0, PTS: 0, GF: 0, GA: 0 }]));
  for (const m of L.calendrier.slice(0, jour).flat()) {
    const a = f.get(m.A), b = f.get(m.B);
    if (!a || !b) continue;
    a.GF += m.gfA; a.GA += m.gfB; b.GF += m.gfB; b.GA += m.gfA;
    if (m.gfA > m.gfB) { a.W++; if (m.ot) b.OTL++; else b.L++; } else { b.W++; if (m.ot) a.OTL++; else a.L++; }
  }
  for (const x of f.values()) x.PTS = x.W * 2 + x.OTL;
  const rang = L.teams.slice().sort((x, y) => {
    const a = f.get(x), b = f.get(y);
    return b.PTS - a.PTS || b.W - a.W || (b.GF - b.GA) - (a.GF - a.GA) || b.GF - a.GF
      || String(`${x.tag}${x.season || ''}`).localeCompare(String(`${y.tag}${y.season || ''}`));
  }).indexOf(L.you) + 1;
  const y = f.get(L.you);
  const r = y ? { fiche: `${y.W}-${y.L}-${y.OTL}`, rang } : null;
  ficheEnCache = { L, jour, r };
  return r;
}
function etatDeLaPartie() {
  const L = G.ligue, N = L && Array.isArray(L.calendrier) ? L.calendrier.length : 0;
  const j = Math.min(G.journee || 0, N);
  const hub = hubActif();
  if (enRepechage()) {
    return G.bonus === 'ROGUE' ? `Rogue · run ${(G.rogue && G.rogue.numero) || 1} · avant la saison`
      : `Repêchage · ${MODE().nom}`;
  }
  if (G.bonus === 'TABLE') return hub ? 'Sur table · le tournoi' : 'Sur table · le tournoi est joué';
  if (G.banc) return `Derrière le banc · journée ${j} / ${N}`;
  if (hub && hub.onglets().some(o => o.cle === 'serie')) return 'Séries éliminatoires';
  if (hub && N && j < N) {
    // Comme le prototype (oct.) : le jour, et ce qu'il est pour toi — un match ce soir ou un congé.
    const ceSoir = (L.calendrier[j] || []).some(m => m.A === L.you || m.B === L.you);
    return `Journée ${j} sur ${N} · ${ceSoir ? 'match ce soir' : 'congé'}`;
  }
  return hub ? 'Saison régulière · terminée' : 'La saison est jouée';
}
export function majEntete() {
  const etat = $('teteEtat');
  if (!etat) return;
  etat.textContent = etatDeLaPartie();
  const ecu = $('teteEcu');
  if (ecu && !ecu.firstElementChild) ecu.innerHTML = getTeamLogoHtml('YOU', 34);
  const fr = enRepechage() ? null : ficheEtRang();
  const poser = (id, v) => {
    const el = $(id);
    if (!el) return;
    el.hidden = !v;
    if (v) el.querySelector('.tete-ch-v').textContent = v;
  };
  poser('teteFiche', fr && fr.fiche);
  poser('teteRang', fr && `${fr.rang}${fr.rang === 1 ? 'er' : 'e'}`);
  // V5 : la caisse du Rogue se lit en saison, au téléphone aussi (la jauge du repêchage, qui la portait, y est cachée).
  poser('teteJetons', G.bonus === 'ROGUE' && fr ? `🪙 ${jetonsRogue()}` : null);
  // Les compteurs de la jauge (les signés, le budget par case, les jetons) : au repêchage et au Rogue.
  document.body.classList.toggle('au-repechage', enRepechage());
  document.body.classList.toggle('mode-rogue', G.bonus === 'ROGUE');
  document.body.classList.toggle('mode-table', G.bonus === 'TABLE');
  // DERRIÈRE LE BANC, un écran secondaire de la saison : « ‹ Retour » y ramène au match.
  const retour = $('retourBtn');
  if (retour) retour.hidden = !G.banc;
}

/*
 * LA BOUTIQUE (1.0, R1 ; V7 : Cartes › Boutique), une fois le repêchage fini : les packs de joueurs et de
 * cartes, entre deux journées, et tes cartes. Les déblocages vivent au Menu, entre deux runs.
 *
 * LA BOUTIQUE EST AU MARCHÉ, ET NULLE PART AILLEURS (1.0, oct.). JP : *wtf la boutique en accueil ; si j'achète
 * un pack, retourne juste pas à l'accueil* ; *je veux RIEN de la boutique dans club/accueil*. La boutique et
 * « Tes cartes » se rendent DANS #pageMarcheCorps, jamais dans la feuille du Club (#hubModal). Un achat reste une
 * décision du jour (l'écran de saison se ferme, la saison se rejoue, il se rouvre) : tout cela se passe en
 * coulisse, `marcheOuvert` garde la page ouverte, et l'écran de saison qui revient la redessine au Marché
 * (`remplirMarche`, le signal `vue` de `surCoquille`). Le Club n'apparaît à aucun moment.
 */
/*
 * UN MOT SE TOUCHE (V8, docs/refonte-v8.md). JP : *des menus clairs qui s'expliquent d'eux-mêmes*. Au téléphone, le
 * `title` d'une étiquette (Fragile ×8, T2-3, Parallèle, un rôle, un coach…) ne se voyait jamais : toucher une étiquette
 * qui en porte un l'affiche dans une bulle, sous elle. Un bouton n'en ouvre pas : lui fait ce qu'il dit. Le toucher
 * suivant, ou un défilement, la referme.
 */
let bulleDef = null;
const fermerBulle = () => { if (bulleDef) { bulleDef.remove(); bulleDef = null; } };
document.addEventListener('click', ev => {
  fermerBulle();
  const el = ev.target.closest('[title]');
  if (!el || !el.title.trim() || el.closest('button, a, input, select, textarea, summary, [role="button"], [role="tab"]')) return;
  bulleDef = document.createElement('div');
  bulleDef.className = 'bulle-def';
  bulleDef.setAttribute('role', 'status');
  bulleDef.textContent = el.title;
  document.body.appendChild(bulleDef);
  const r = el.getBoundingClientRect(), w = bulleDef.offsetWidth, h = bulleDef.offsetHeight;
  bulleDef.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  bulleDef.style.top = `${r.bottom + 6 + h < innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)}px`;
});
window.addEventListener('scroll', fermerBulle, true);
document.addEventListener('cap82:marche', ev => {
  // Une signature attend (la Boîte du Club le dit, sans nommer la boutique) : on va au Marché et on rouvre l'offre.
  // V5 : le nœud de la semaine y mène aussi, sur « Tes cartes » (`page`).
  // Jalon Q : la signature s'ouvre sur place, par-dessus le bureau — plus de détour par la boutique.
  const d = ev.detail || {};
  const h = hubActif();
  if (d.signer) { if (h && h.signer) h.signer(); return; }
  const cle = Object.keys(PAGES_DU_MARCHE).find(k => PAGES_DU_MARCHE[k] === d.page);
  if (cle) montrerPage(cle);
});
/* La page du Marché, et ce que l'écran de saison y rend (`hub.boutique`). */
const PAGES_DU_MARCHE = { marche: 'boutique' };
/* « Un joueur à signer » : un pack ouvert, personne de signé — il se traite ici, au Marché. */
function brancherSignature(host, hub) {
  const b = host.querySelector('.marche-signer');
  if (b) b.onclick = () => hub.signer();
}
const signatureHtml = hub => (hub && hub.signature && hub.signature()
  ? '<div class="marche-signature"><button type="button" class="btn gold marche-signer">Un joueur à signer · voir les cartes</button></div>' : '');
/*
 * UN SOUS-ONGLET, UNE PAGE (JP : *limiter d'avoir à chercher et se promener partout*). « Tes cartes » et « Boutique »
 * s'ouvrent d'un toucher, sans liste à deux tuiles ni seconde tête « ‹ » : le sous-onglet allumé dit où l'on est, les
 * jetons sont dans l'en-tête.
 */
function remplirMarche() {
  const host = $('pageMarcheCorps');
  if (!host) return;
  const quoi = PAGES_DU_MARCHE[marcheOuvert];
  if (!quoi) return;
  const hub = hubActif();
  // L'écran de saison se rejoue en coulisse (un achat, une carte jouée) : la page reste telle quelle jusqu'à son retour.
  if (!hub && host.dataset.rendu === quoi) return;
  if (hub && hub[quoi]) {
    host.innerHTML = `${signatureHtml(hub)}<section class="hub-page" data-genre="${quoi}"><div class="hub-page-corps"></div></section>`;
    host.dataset.rendu = quoi;
    brancherSignature(host, hub);
    // V12-3 : une carte qui a sa maison (un soin, un contrat) y renvoie : « À l'infirmerie › » ouvre son sous-onglet.
    hub[quoi]({ dans: host.querySelector('.hub-page-corps'), fermer: () => montrerPage('match'), renvoyer: k => montrerPage(k) });
    return;
  }
  delete host.dataset.rendu;
  // Hors saison, la boutique attend la saison.
  host.innerHTML = '<p class="empty-msg">La boutique ouvre avec la saison.</p>';
}

/*
 * LES RÈGLES (1.0, R1) : un écran secondaire du Menu, par-dessus tout. Le
 * Retour (Échap, B, le bouton d'Android, « ‹ Retour ») le referme et rend le
 * Menu qui l'a ouvert.
 */
function ouvrirRegles() {
  const p = $('pageRegles');
  if (!p) return;
  p.hidden = false;
  document.body.classList.add('regles-ouvertes');
  chargerTable().then(m => m.remplirReglesDuPlateau());
  const b = p.querySelector('[data-retour]');
  if (b) b.focus({ preventScroll: true });
}
function fermerRegles() {
  const p = $('pageRegles');
  if (!p || p.hidden) return false;
  p.hidden = true;
  document.body.classList.remove('regles-ouvertes');
  return true;
}

/*
 * LE CARTABLE (S79, js/cartable.js). JP : *page vestiaire devrait contenir
 * toutes les cartes, comme un cartable de carte, clickables, etc, avec stats
 * de la saison en cours et saisons réelles comme vraie carte. Je veux
 * collectionner.* Ton équipe — sa saison RÉVÉLÉE (`compteRevele`, jamais la
 * fin de l'année) et sa vraie saison — puis la collection, par saison et par
 * club. « Tes cartes » ouvre les cartes de jeu (l'inventaire) : du hub avec
 * sa décision quand une saison se joue, en lecture sinon.
 */
function ligneDeSaison(p, S) {
  if (!S || !S.GP) return 'pas encore joué';
  return p.p === 'G'
    ? `${S.GP} PJ · ${S.W || 0} V · ${S.SA ? pct3(S.SV / S.SA) : '—'}`
    : `${S.GP} PJ · ${S.G || 0} B · ${S.A || 0} A · ${S.PTS || 0} PTS`;
}
function ligneVraieSaison(p) {
  const st = displayStats(p);
  return p.p === 'G' ? `${st.gp} PJ · ${st.w} V · ${pct3(p.sv || 0)}` : `${st.gp} PJ · ${st.g} B · ${st.a} A · ${st.pt} PTS`;
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
    // Tes cartes de jeu, en lecture : la collection du personnel et de la banque (V16 : elles se jouent chez ce qu'elles montent).
    ouvrirCartes: () => ouvrirInventaireJeu(null, null),
    ficheEquipe: p => (L ? ouvrirFiche(p, L.you, portee === 'jour' ? 'jour' : 'saison') : showPlayerModal(p, { apercu: true })),
    fiche: (cle, p) => showPlayerModal(p, { apercu: true }),
    charger: s => getShard(s),
    mini: (p, rar) => miniAvecVariante(p, rar),
    cleDe: getPlayerKey,
    club: t => TEAMFULL[t] || t,
    vraie: ligneVraieSaison,
    saisons: state.index.seasons,
  });
}
/* L'alignement entre au cartable au départ d'une saison (une variante neuve compte, pas un doublon). */
export const alignementAuCartable = () => {
  ajouterAuCartable(signes().map(p => ({ cle: getPlayerKey(p), rar: varianteJoueur(p), num: (G.variantes.numeros || {})[getPlayerKey(p)] || null })), { doublons: false });
  // 1.0 : en Rogue, chaque carte de l'alignement compte une run jouée de plus (js/cartable.js `marquerJouees`).
  if (G.bonus === 'ROGUE' && G.rogue) marquerJouees(signes().map(getPlayerKey), G.rogue.numero || 0);
};

/*
 * L'ÉTAT VIDE : un onglet qui n'a encore rien à montrer dit pourquoi, et
 * offre ce qu'on peut faire maintenant. On ne cache pas un onglet parce qu'il
 * est vide — c'est ce qui faisait bouger la barre.
 */
function remplirVide(cle) {
  const titre = $('pageVideTitre'), corps = $('pageVideCorps');
  if (!titre || !corps) return;
  const [icone, mot] = PAGE[cle] || PAGE.match;
  titre.innerHTML = `${ico(icone)}${esc(mot)}`;
  const bouton = (id, mot, go = false) => `<button type="button" class="btn ${go ? 'go' : 'gold'}" data-vide="${id}">${esc(mot)}</button>`;
  let msg = '', btns = '';
  const manque = totalCases() - signes().length;
  const QUOI = { classement: 'Le classement du jour', calendrier: 'Tes matchs, journée par journée,', meneurs: 'Les meneurs de la ligue' };
  if (enRepechage()) {
    if (cle === 'match') {
      msg = manque > 0
        ? `Encore <b>${manque}</b> case${manque > 1 ? 's' : ''} à combler.`
        : `Ta formation est complète.${G.bonus === 'ROGUE' && G.rogue ? ` Le proprio veut : ${esc(mandatDe(G.rogue.saison, G.rogue.exigence || 0).mot)}.` : ''}`;
      btns = manque > 0
        ? (auVestiaire() ? bouton('repechage', MODE().loto ? 'Au loto' : 'Au vestiaire', true) : bouton('alignement', 'Aux lignes', true))
        : bouton('lancer', G.bonus === 'TABLE' ? 'Lancer le tournoi' : 'Lancer la saison', true);
    } else {
      msg = `${QUOI[cle] || 'Tout ça'} s'affichera ici dès le premier match.`;
      btns = bouton('match', 'Au bureau');
    }
  } else if (G.banc) {
    msg = 'Tu es derrière le banc. La saison reprend là où tu l\'as laissée.';
    btns = bouton('reprendre', 'Retour au match', true);
  } else if (cle === 'alignement' && hubActif()) {
    msg = 'Ton alignement est figé : on ne touche plus aux trios quand ça compte.';
    btns = bouton('match', 'Au bureau', true);
  } else if (cle === 'calendrier' && hubActif()) {
    msg = 'Le tournoi n\'a pas de calendrier à lui : ses journées se lisent au club.';
    btns = bouton('match', 'Au bureau', true);
  } else {
    msg = 'Rien à lire ici pour l\'instant.';
    btns = bouton('match', 'Au bureau', true);
  }
  corps.innerHTML = `<div class="vide"><p class="vide-mot">${msg}</p><div class="vide-btns">${btns}</div></div>`;
  corps.querySelectorAll('[data-vide]').forEach(b => {
    b.onclick = () => {
      const quoi = b.dataset.vide;
      if (quoi === 'lancer') $('mainBtn').click();
      else if (quoi === 'reprendre') reprendreSaison();
      else montrerPage(quoi);
    };
  });
}

export function montrerPage(cle) {
  cle = normaliser(cle);
  const hub = hubActif();
  // DERRIÈRE LE BANC, les onglets de la saison y RAMÈNENT : la saison reprend
  // (même graine, même jour), puis l'onglet demandé s'ouvre.
  // V8 : QUITTER LES LIGNES LES APPLIQUE, par n'importe quelle porte (JP : *aucun moment où je ne suis pas en contrôle*) :
  // ce qu'on a changé compte, sans bouton à trouver. Un alignement incomplet reste derrière le banc, à finir.
  if (G.banc && cle !== 'alignement' && !slotsLeft()) { G.pageVoulue = cle; reprendreSaison(); return; }
  // EN PLEINE SAISON, L'ALIGNEMENT EST LE BANC : c'est là qu'on y touche.
  if (hub && cle === 'alignement' && hub.banc) { hub.banc(); return; }
  if (cle === 'repechage' && enRepechage()) setView('pool');
  else if (cle === 'alignement' && !bilanPret() && !hub) setView('roster');
  else {
    marquerPage(cle);
    if (document.body.dataset.zone === 'ref') {
      if (cle === 'historique') showLeaderboard();
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
  if (ev.type === 'compte') { if (G.page) majSousNav(G.page, sectionDe(G.page)); return; }
  if (ev.type === 'vue') {
    // L'écran de saison se rouvre derrière le Marché (un achat, une carte jouée) : la boutique reste à l'écran, le Club n'apparaît pas.
    if (marcheOuvert) { marquerPage(marcheOuvert); return; }
    if (G.pageVoulue) {
      const cible = G.pageVoulue;
      G.pageVoulue = null;
      if (voletPour(cible)) { marquerPage(cible); return; }
      // Une page hors de l'écran de saison (Joueurs, Cartes) s'ouvre une fois la saison reprise.
      if (PAGES().includes(cible)) { montrerPage(cible); return; }
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

export function setView(view) {
  G.view = view;
  $('panes').dataset.view = view;
  marquerPage(view === 'roster' ? 'alignement' : 'repechage');
}

export function render() {
  // LE MODE TABLE SE CHARGE À LA DEMANDE (1.0, J3-6) : son premier rendu attend ses modules, puis se refait.
  if (G.bonus === 'TABLE' && !MT.pret) { chargerTable().then(() => render()); return; }
  syncAgeControls();
  renderCap();
  majEntete();
  renderSpin();
  renderDash();
  renderFilters();
  renderPool();
  renderPoolMeta();
  renderRoster();
  renderTeamSummary();
  renderMain();
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
  // L'album est un album de cartes : en Rogue seulement (aucune carte hors du Rogue).
  const avecAlbum = G.bonus === 'ROGUE';
  const vue = avecAlbum && G.vueHistorique === 'album' ? 'album' : 'saisons';
  const bascule = !avecAlbum ? '' : `<div class="seg lb-vues" role="tablist"><button type="button" data-vue="saisons" class="${vue === 'saisons' ? 'on' : ''}">Tes saisons</button><button type="button" data-vue="album" class="${vue === 'album' ? 'on' : ''}">Ton album</button></div>`;
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
        ${Array.isArray(i.alignement) ? `<button class="btn small lb-replay" data-idx="${idx}" title="Relire ces 23 joueurs et jouer une nouvelle saison">${ico('i-dice')}Reprendre l'alignement</button>` : ''}
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

/**
 * Adversaires : de vraies équipes historiques prises dans les saisons déjà
 * chargées, alignées automatiquement. Les joueurs déjà signés sont exclus.
 * `epoque` borne le tirage à une saison (celle de la ligue, par défaut) et
 * `tous` dit qu'on prend TOUS ses clubs, dans l'ordre du shard — c'est la
 * ligue d'une saison — plutôt que `count` clubs tirés au hasard : le tournoi
 * dans les 55 saisons, ou l'exhibition dans une saison donnée.
 */
export async function buildOpponents(count, { epoque = G.epoque, tous = !!epoque, part = 1 } = {}) {
  // LA LIGUE QUI MONTE (V9, tranche 8, js/rogue.js `ligueDe`) : en Rogue, aux premiers niveaux, les plus faibles d'un tirage plus large.
  const tirage = tous ? count : Math.ceil(count / part);
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
  while (!epoque && cands.length < tirage && tries++ < 12) {
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
    if (!tous && out.length >= tirage) break;
    const roster = autoRoster(c.pool, exclude);
    // Ses cartes se posent à chaque saison (`habillerLaLigue`) : un club bâti n'en garde aucune d'une ligue d'avant.
    for (const p of Object.values(roster)) if (p) delete p._carte;
    for (const p of Object.values(roster)) exclude.add(getPersonKey(p));
    // SON CLUB-ÉCOLE (Jalon P, B, `ecoleDe`) : les vrais joueurs de ce club-saison hors de ses 23, rappelés quand les blessés manquent.
    const ecole = ecoleDe(c.pool.filter(p => !exclude.has(getPersonKey(p))), roster);
    for (const p of ecole) exclude.add(getPersonKey(p));
    out.push(createTeam(`${c.team} ${c.season}`, c.team, roster, { season: c.season, ecole }));
  }
  return !tous && out.length > count ? out.map(t => [teamStrength(t), t]).sort((a, b) => a[0] - b[0]).slice(0, count).map(x => x[1]) : out;
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
export async function rebatirAdversaires(cles, decisions = []) {
  const exclude = new Set(picked().map(getPersonKey));
  // Un joueur libéré au ballottage était repêché quand la ligue s'est bâtie :
  // il reste exclu, sinon un adversaire rebâti pourrait l'habiller.
  for (const d of decisions) if (d.ballottage) for (const cle of [d.ballottage.entre, d.ballottage.sort]) {
    const p = cle && ballottageVu.get(cle);
    if (p) exclude.add(getPersonKey(p));
  }
  /*
   * S80 : TOUT JOUEUR QU'UNE DÉCISION A MIS DANS TON ALIGNEMENT était exclu
   * quand la ligue s'est bâtie — le jour 0 compris — et un réserviste relâché
   * depuis n'est plus dans `picked()`. Sans lui, son vrai club rebâti
   * l'habillerait et la saison se rejouerait autrement. Exclure un joueur
   * qu'aucun club n'avait pris ne change rien : l'alignement automatique ne
   * l'avait pas choisi.
   */
  for (const d of decisions) {
    if (d.cases) for (const cle of Object.values(d.cases)) if (cle) exclude.add(personneDeCle(cle));
    for (const x of d.relache || []) if (x && x.sort) exclude.add(personneDeCle(x.sort));
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
    for (const p of Object.values(roster)) if (p) delete p._carte;
    for (const p of Object.values(roster)) exclude.add(getPersonKey(p));
    // Son club-école, comme `buildOpponents` l'a bâti (B) : sans lui, la reprise jouait d'autres séries.
    const ecole = ecoleDe(pool.filter(p => !exclude.has(getPersonKey(p))), roster);
    for (const p of ecole) exclude.add(getPersonKey(p));
    out.push({ name: `${team} ${season}`, tag: team, roster, season, ecole });
  }
  return out;
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
    // Les 23 cases de toujours (S80) : les cases de réserve de plus du Rogue ne se remplissent jamais ici.
    if (!CASES_ALIGNEMENT_DE_BASE.every(s => actives.has(s.i) || roster[s.i])) continue;
    for (const s of CASES_ALIGNEMENT_DE_BASE) {
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

/*
 * LE CLUB QU'ON LIT (js/impact.js) : tout effet qu'un joueur lit à l'écran se dit en chiffres de match pour SON club.
 * En saison, c'est le club de la ligue ; au repêchage, un club provisoire fait de l'alignement du moment.
 */
let clubProvisoire = null;
poserClubLu(() => {
  const toi = G.ligue && G.ligue.you;
  if (toi) return { team: toi };
  if (!Object.values(G.roster).some(Boolean)) return null;
  if (!clubProvisoire || clubProvisoire.roster !== G.roster) clubProvisoire = createTeam(nomDuClub(), 'YOU', G.roster, { isPlayer: true });
  return { team: clubProvisoire };
});

// `dev` : de quoi dresser une planche de cartes dans un script de capture (scripts/planche_cartes.mjs), rien de plus.
window.cap82 = { G, cacheClear, simulate, portraitAbsent, dev: { playerCardEl, carteMiniHtml, getShard } };
boot();
