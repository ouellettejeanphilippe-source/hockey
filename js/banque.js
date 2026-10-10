/**
 * LA BANQUE DE CARTES (S79).
 *
 * JP : *créer une vraie banque de cartes (patrons, événements équipes, modifs
 * de joueurs, modifs de match, etc.) digne d'un vrai deck builder*.
 *
 * UN SEUL REGISTRE pour tout ce qui se joue : les cartes de saison (CARTES,
 * js/sim.js), le deck de match (CARTES_MATCH, js/combat.js), les changements
 * de carte d'un joueur (MUTATIONS : améliorations, atelier, styles, contrats)
 * — et trois familles neuves : les PATRONS (le personnel, des reliques), les
 * ÉVÉNEMENTS d'équipe et les CONSOMMABLES. Chaque carte a un identifiant
 * (\`cat:cle\`), une catégorie, une rareté, une durée de vie, et sa RÈGLE en
 * chiffres de match (\`reglesDe\`) : « ≈ +0,2 but marqué par match », « ≈ −2 blessures
 * par saison », jamais un pourcentage, jamais « un peu ».
 *
 * RIEN DE NEUF DANS LE MOTEUR, OU PRESQUE. Une carte jouée est une DÉCISION
 * (\`payloadDe\`) faite des champs que \`appliquerDecision\` connaît déjà :
 * \`effet\` (des canaux d'équipe pour quelques journées), \`mutation\` (un
 * joueur), \`carte\` (une carte de saison), \`recompense\` (une carte de match
 * au deck), \`retrait\` et \`aiguise\` (le deck), \`maitrise\` (un système) —
 * plus deux qu'il a fallu ajouter : \`patron\` (le personnel, lu comme une
 * carte de saison, séries comprises) et \`gestes\` (un soin, de l'énergie).
 * La décision porte ses CHIFFRES : une partie reprise rejoue exactement ce
 * qui a été joué, même si la banque change entre-temps.
 *
 * LES POIDS (mesurés, voir CARTES dans js/sim.js) : 1 % de précision ou de
 * tirs ≈ 0,18 victoire sur une saison, 1 % de buts contre ≈ 0,24 à 0,32, un
 * point de robustesse ≈ 0,5. Un patron vaut de +0,3 (commun) à +1,2 victoire
 * (légendaire) pour toute la saison ; trois postes au plus. Un événement ne
 * dure que quelques journées : il change la FORME d'un bout de saison.
 */
import { CARTES, MUTATIONS, EDITIONS_REGLEMENT, systemeDe } from './sim.js';
import { motsEnChiffres, motsDeMutationEnChiffres } from './impact.js';
import { formeDe } from './gerant.js';
import { CARTES_MATCH, estPlus, DECK_DEPART } from './combat.js';
import { money, hache } from './util.js';
import { EVENEMENTS_VIE } from './evenements-vie.js';
import { CONSOMMABLES_VIE, CONTRATS_VIE, RARETE_MODIFS_VIE } from './cartes-vie.js';
import { COACHS, ORDRE_COACHS, coachDesCanaux, palierDe, effetDePalier, GAIN_SYSTEME, SEUILS } from './coachs.js';

export const CATEGORIES = {
  patron: { ico: '👔', nom: 'Patrons', un: 'Patron', mot: 'Le personnel : un effet pour toute la saison, séries comprises. Un poste par rôle ; deux postes au départ, le prestige en ouvre d\'autres.' },
  evenement: { ico: '📰', nom: 'Événements', un: 'Événement', mot: 'Ce qui arrive à ton équipe : quelques journées, un bonus et son prix.' },
  joueur: { ico: '🧬', nom: 'Modifs de joueurs', un: 'Modif de joueur', mot: 'Un style, une clause, une amélioration ou une édition : elle se pose au verso d\'un joueur de ton choix, pour la saison.' },
  consommable: { ico: '🧴', nom: 'Consommables', un: 'Consommable', mot: 'Une utilisation : un soin, des jambes, le filet, les minutes, des jetons, le deck, ou un trou dans le règlement.' },
  match: { ico: '🃏', nom: 'Cartes de match', un: 'Carte de match', mot: 'Ton deck des gros matchs et des séries : jouée, elle entre dans le deck.' },
  plafond: { ico: '💵', nom: 'Masse salariale', un: 'Contrat', mot: 'Le plafond salarial se manipule, comme dans la vraie LNH : de l\'espace, une retenue, un blessé à long terme, un rachat.' },
  saison: { ico: '📘', nom: 'Cartes de saison', un: 'Carte de saison', mot: 'Un réglage pour toute la saison : un bonus payé par un malus.' },
};
export const ORDRE_CATEGORIES = ['patron', 'evenement', 'joueur', 'consommable', 'plafond', 'match', 'saison'];

/* ---------- LES PATRONS : le personnel, des reliques ---------- */

export const ROLES = {
  chef: { nom: 'Entraîneur-chef', ico: '🧑‍💼' },
  attaque: { nom: 'Adjoint à l\'attaque', ico: '🎯' },
  defense: { nom: 'Adjoint à la défensive', ico: '❄️' },
  gardiens: { nom: 'Entraîneur des gardiens', ico: '🥅' },
  physique: { nom: 'Préparateur physique', ico: '🏋️' },
  soins: { nom: 'Soins', ico: '🩺' },
  depistage: { nom: 'Dépistage', ico: '🔭' },
  direction: { nom: 'Direction', ico: '🏢' },
};
/*
 * \`effet\` : les canaux de l'équipe, pour la saison. \`econ\` : ce que le
 * patron change à la boutique et aux jetons (\`rabais\` sur le prix des packs,
 * \`jetonsVictoire\` de plus par victoire, \`holo\` multiplie la chance d'une
 * holo ou mieux dans un pack de joueurs, \`carteExtra\`, \`sansBase\`).
 * \`synergie\` : si un patron du rôle \`avec\` est déjà engagé, l'effet de plus.
 */
export const PATRONS = {
  chef_tacticien: { role: 'chef', nom: 'Le tacticien', ico: '📋', rarete: 'peu', texte: 'Il dessine chaque présence au tableau.',
    effet: { defense: 0.93, finition: 0.972 }, synergie: { avec: 'defense', effet: { defense: 0.972 } } },
  chef_motivateur: { role: 'chef', nom: 'Le motivateur', ico: '📣', rarete: 'peu', texte: 'Ses discours entre les périodes sont restés célèbres.',
    effet: { finition: 1.084, discipline: 1.224 }, synergie: { avec: 'attaque', effet: { finition: 1.028 } } },
  chef_legende: { role: 'chef', nom: 'La légende derrière le banc', ico: '🏆', rarete: 'legendaire', texte: 'Neuf bagues de la Coupe, et il le rappelle au besoin.',
    effet: { finition: 1.042, defense: 0.958, robustesse: 0.6, discipline: 1.14, volume: 0.972 } },
  att_adjoint: { role: 'attaque', nom: 'L\'adjoint à l\'attaque', ico: '🏒', rarete: 'commune', texte: 'Il fait tirer tout le monde après les pratiques.',
    effet: { volume: 1.07, defense: 1.021 } },
  att_avantage: { role: 'attaque', nom: 'Le spécialiste de l\'avantage', ico: '⚡', rarete: 'peu', texte: 'Son avantage numérique a un nom de code.',
    effet: { finition: 1.084, volume: 0.965 } },
  att_transition: { role: 'attaque', nom: 'Le maître des transitions', ico: '🔀', rarete: 'rare', texte: 'La rondelle sort de la zone en deux passes.',
    effet: { volume: 1.112, finition: 1.028, energie: 1.084, defense: 1.028 } },
  def_adjoint: { role: 'defense', nom: 'L\'adjoint à la défensive', ico: '🧱', rarete: 'commune', texte: 'Il revoit chaque but accordé, image par image.',
    effet: { defense: 0.944, volume: 0.986 } },
  def_inferiorite: { role: 'defense', nom: 'Le spécialiste de l\'infériorité', ico: '🦺', rarete: 'peu', texte: 'Quatre joueurs en losange, et un bâton dans chaque couloir.',
    effet: { defense: 0.944, discipline: 0.832 } },
  def_systeme: { role: 'defense', nom: 'Le gourou du système', ico: '🕸️', rarete: 'rare', texte: 'Personne ne sait expliquer son système. Personne ne passe.',
    effet: { defense: 0.902, volume: 0.958 } },
  gar_technicien: { role: 'gardiens', nom: 'Le technicien des gardiens', ico: '🥅', rarete: 'commune', texte: 'Des angles, des angles, des angles.',
    effet: { defense: 0.986 } },
  gar_psy: { role: 'gardiens', nom: 'Le psychologue des gardiens', ico: '🧠', rarete: 'peu', texte: 'Le but d\'hier n\'existe plus.',
    effet: { defense: 0.944, blessure: 0.65 } },
  gar_maitre: { role: 'gardiens', nom: 'Le maître des gardiens', ico: '🧤', rarete: 'rare', texte: 'Il a formé trois gagnants du Vézina.',
    effet: { defense: 0.916, volume: 0.972 }, synergie: { avec: 'defense', effet: { defense: 0.979 } } },
  phy_cardio: { role: 'physique', nom: 'Le préparateur cardio', ico: '🫀', rarete: 'commune', texte: 'Vélo stationnaire après chaque match.',
    effet: { energie: 0.93 } },
  phy_force: { role: 'physique', nom: 'Le préparateur en force', ico: '🏋️', rarete: 'peu', texte: 'Squats, et encore des squats.',
    effet: { robustesse: 0.75, energie: 1.056 } },
  phy_elite: { role: 'physique', nom: 'Le préparateur d\'élite', ico: '🥇', rarete: 'rare', texte: 'Il a préparé une équipe olympique.',
    effet: { energie: 0.804, robustesse: 0.6, finition: 0.979 }, synergie: { avec: 'soins', effet: { blessure: 0.72 } } },
  soi_soigneur: { role: 'soins', nom: 'Le soigneur', ico: '🩹', rarete: 'commune', texte: 'Du ruban, de la glace, et il connaît tout le monde.',
    effet: { blessure: 0.3 } },
  soi_therapeute: { role: 'soins', nom: 'Le thérapeute du sport', ico: '💆', rarete: 'peu', texte: 'Il voit la blessure venir avant le joueur.',
    effet: { blessure: 0.23 } },
  soi_medecin: { role: 'soins', nom: 'Le médecin-chef', ico: '⚕️', rarete: 'rare', texte: 'Une clinique à lui tout seul.',
    effet: { blessure: 0.09, robustesse: 0.4, volume: 0.979 } },
  dep_local: { role: 'depistage', nom: 'Le dépisteur régional', ico: '🔭', rarete: 'commune', texte: 'Il connaît chaque aréna de la province.',
    econ: { holo: 1.25 } },
  dep_europe: { role: 'depistage', nom: 'Le dépisteur européen', ico: '🌍', rarete: 'peu', texte: 'Un carnet plein de noms que personne ne sait prononcer.',
    econ: { carteExtra: 1 } },
  dep_chef: { role: 'depistage', nom: 'Le chef du dépistage', ico: '🕵️', rarete: 'rare', texte: 'Il ne se trompe jamais deux fois.',
    econ: { sansBase: true, holo: 1.2 } },
  dir_negociateur: { role: 'direction', nom: 'Le DG négociateur', ico: '🤝', rarete: 'peu', texte: 'Il obtient toujours un rabais.',
    econ: { rabais: 0.85 } },
  dir_proprio: { role: 'direction', nom: 'Le proprio généreux', ico: '💼', rarete: 'rare', texte: 'Une victoire, une enveloppe.',
    econ: { jetonsVictoire: 2 } },
  // V3.6 — le feu qui paie : la quatrième pièce du combo de la lancée (`LANCEE`, js/sim.js).
  dir_chandails: { role: 'direction', nom: 'Le vendeur de chandails', ico: '🛍️', rarete: 'rare', texte: 'Un joueur en feu, et les chandails partent par boîtes.',
    econ: { jetonsLancee: 1 } },
  dir_magnat: { role: 'direction', nom: 'Le magnat', ico: '🎩', rarete: 'legendaire', texte: 'Il a acheté l\'équipe pour la gagner.',
    effet: { finition: 1.042, defense: 1.021 }, econ: { jetonsVictoire: 3, rabais: 0.9 } },
  // V2.3 : le Comptable n'est plus un coach de départ ; il est un patron, à côté de n'importe quel coach.
  dir_comptable: { role: 'direction', nom: 'Le comptable', ico: '🏦', rarete: 'commune', texte: 'Chaque jeton, chaque dollar du plafond.',
    econ: { rabais: 0.92 } },
  dir_flexible: { role: 'direction', nom: 'Le DG du plafond flexible', ico: '🧮', rarete: 'rare', texte: 'Il connaît chaque clause de la convention collective.',
    econ: { plafond: 0.05 } },
  /*
   * v2 — LES ADJOINTS DES COACHS (js/coachs.js). Un patron par coach qui
   * GRANDIT avec lui : `echelle.par` s'ajoute à son effet pour chaque carte de
   * son coach déjà jouée cette saison (au plus `max`), lu au moment de
   * l'engager — la décision porte le chiffre. Engagé tôt, il vaut peu ; engagé
   * quand huit cartes du coach sont jouées, il vaut un légendaire. C'est le « scaling » d'un
   * vrai roguelike, sur les canaux qui existent.
   */
  att_volume: { role: 'attaque', nom: 'Le maître du volume', ico: '📊', rarete: 'rare', coach: 'essaim', texte: 'Trente lancers par soir, sinon on recommence la pratique.',
    effet: { volume: 1.028, defense: 1.028 }, echelle: { par: { volume: 0.006 }, max: 10 } },
  att_mains: { role: 'attaque', nom: 'Le spécialiste des mains', ico: '🙌', rarete: 'rare', coach: 'rapaces', texte: 'Il fait des feintes avec une balle de tennis dans le corridor.',
    effet: { finition: 1.028, volume: 0.979 }, echelle: { par: { finition: 0.006 }, max: 10 } },
  def_verrou: { role: 'defense', nom: 'L\'architecte du verrou', ico: '⛓️', rarete: 'rare', coach: 'tortue', texte: 'Son tableau n\'a qu\'une flèche, et elle recule.',
    effet: { defense: 0.972, volume: 0.979 }, echelle: { par: { defense: -0.005 }, max: 10 } },
  phy_combat: { role: 'physique', nom: 'Le préparateur de combat', ico: '🥋', rarete: 'rare', coach: 'rhinos', texte: 'Il a déjà entraîné des lutteurs.',
    effet: { robustesse: 0.4, discipline: 1.084 }, echelle: { par: { robustesse: 0.12 }, max: 10 } },
  soi_herboriste: { role: 'soins', nom: 'L\'herboriste du vestiaire', ico: '🌿', rarete: 'rare', coach: 'souffle', texte: 'Des tisanes qui sentent mauvais, et personne ne se blesse.',
    effet: { blessure: 0.79, energie: 0.986, volume: 0.986 }, echelle: { par: { blessure: -0.04, energie: -0.004 }, max: 10 } },
  chef_cure: { role: 'chef', nom: 'Le curé de la paroisse', ico: '⛪', rarete: 'rare', coach: 'choeur', texte: 'Il dit la messe le dimanche et le cahier de jeux le lundi.',
    effet: { discipline: 0.902, volume: 0.979 }, echelle: { par: { discipline: -0.016 }, max: 10 } },
  phy_quatre: { role: 'physique', nom: 'Le chronométreur des trios', ico: '🔢', rarete: 'rare', coach: 'profondeur', texte: 'Il connaît le nom de famille du treizième attaquant.',
    effet: { F: [0.96, 1, 1.04, 1.1], energie: 0.944 }, echelle: { par: { energie: -0.007 }, max: 10 } },
  att_scene: { role: 'attaque', nom: 'Le metteur en scène', ico: '🎭', rarete: 'rare', coach: 'etoiles', texte: 'Les vedettes jouent la dernière minute. Toujours.',
    effet: { F: [1.1, 1.04, 0.96, 0.9], finition: 1.014, defense: 1.014 }, echelle: { par: { finition: 0.004 }, max: 10 } },
  dir_tresorier: { role: 'direction', nom: 'Le trésorier', ico: '💳', rarete: 'peu', coach: 'banque', texte: 'Il sait où dort chaque dollar du club.',
    econ: { rabais: 0.95, jetonsVictoire: 1 } },
  // ---- v2 : sept de plus, pour que chaque poste ait de quoi choisir ----
  gar_video: { role: 'gardiens', nom: 'Le monteur vidéo des gardiens', ico: '🎞️', rarete: 'commune', texte: 'Chaque but accordé, sous trois angles.',
    effet: { defense: 0.986, energie: 0.986 } },
  dep_itinerant: { role: 'depistage', nom: 'Le dépisteur itinérant', ico: '🗺️', rarete: 'commune', texte: 'Il dort dans son auto, entre deux arénas de bantam.',
    econ: { holo: 1.15 } },
  soi_nutrition: { role: 'soins', nom: 'La nutritionniste', ico: '🥦', rarete: 'commune', texte: 'Plus de poutine dans l\'autobus.',
    effet: { energie: 0.888, blessure: 0.65 } },
  chef_jardinier: { role: 'chef', nom: 'Le jardinier de la relève', ico: '🪴', rarete: 'peu', texte: 'Il fait jouer les jeunes, et les jeunes courent.',
    effet: { volume: 1.049, energie: 0.888, defense: 1.021 } },
  def_durs: { role: 'defense', nom: 'L\'adjoint des durs', ico: '⛏️', rarete: 'peu', texte: 'Il a encore ses propres dents. Presque toutes.',
    effet: { robustesse: 0.8, discipline: 1.168 } },
  dir_agent: { role: 'direction', nom: 'L\'avocat de la convention', ico: '📑', rarete: 'peu', texte: 'Il lit les petits caractères pour le plaisir.',
    econ: { plafond: 0.025 } },
  chef_renard: { role: 'chef', nom: 'Le vieux renard', ico: '🦊', rarete: 'peu', texte: 'Trente ans derrière un banc : il sent le match tourner.',
    effet: { defense: 0.951, discipline: 0.86 } },
  chef_ancienne: { role: 'chef', nom: 'L\'entraîneur à l\'ancienne', ico: '🐃', rarete: 'peu', texte: 'Des pratiques de deux heures, sans rondelle.',
    effet: { robustesse: 1, finition: 0.965 } },
  def_paires: { role: 'defense', nom: 'L\'adjoint de la troisième paire', ico: '🔃', rarete: 'commune', texte: 'Ses deux défenseurs du bas jouent vingt minutes, et ils aiment ça.',
    effet: { D: [0.88, 1, 1.25], energie: 0.944 } },
  def_echecs: { role: 'defense', nom: 'L\'adjoint des mises en échec', ico: '💢', rarete: 'commune', texte: 'Il compte les mises en échec, pas les buts.',
    effet: { robustesse: 0.35, volume: 0.993 } },
  att_premier: { role: 'attaque', nom: 'L\'adjoint du premier trio', ico: '📌', rarete: 'peu', texte: 'Il ne dessine des jeux que pour trois joueurs.',
    effet: { F: [1.14, 1.04, 0.94, 0.88], finition: 1.028 } },
};

/* ---------- LA MASSE SALARIALE : le plafond se manipule (S79) ---------- */
/*
 * JP : *garder aspect masse salariale même en roguelike, mais avec cartes qui
 * peuvent le manipuler*. Les vrais mécanismes de la convention collective,
 * chacun une décision (`plafond`) : de l'espace de plus cette saison, une
 * RETENUE salariale (son ancien club en paie une part), un joueur blessé à
 * long terme (LTIR : son salaire sort du plafond tant qu'il est à
 * l'infirmerie), un RACHAT de contrat (un rabais, contre des
 * jetons), le contrat d'entrée d'une recrue, une clause de bonis. Et une
 * malédiction : la taxe de luxe. `cible` : un joueur, un blessé, une recrue.
 */
export const CONTRATS = {
  espace: { nom: 'Espace sous le plafond', ico: '💵', rarete: 'commune', vie: 'usage', cible: 'aucune', espace: 2_000_000, texte: 'Une clause d\'indexation négociée en ta faveur.' },
  grosEspace: { nom: 'La marge de manœuvre', ico: '💰', rarete: 'rare', vie: 'permanent', cible: 'aucune', espace: 5_000_000, texte: 'Le proprio signe un chèque pour l\'espace sous le plafond.' },
  retenue: { nom: 'Retenue salariale', ico: '✂️', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.65, texte: 'Son ancien club paie une part de son salaire.' },
  ltir: { nom: 'Blessé à long terme', ico: '🏥', rarete: 'peu', vie: 'usage', cible: 'blesse', ltir: true, texte: 'Son salaire sort du plafond tant qu\'il est à l\'infirmerie.' },
  rachat: { nom: 'Rachat de contrat', ico: '🧾', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.833, cout: 10, texte: 'Le reste de son contrat étalé : moins cette saison, 10 jetons de frais.' },
  entree: { nom: 'Le contrat d\'entrée', ico: '🐣', rarete: 'commune', vie: 'usage', cible: 'recrue', facteur: 0.72, texte: 'Une recrue sous contrat d\'entrée compte pour moins.' },
  bonis: { nom: 'La clause de bonis', ico: '🎯', rarete: 'commune', vie: 'usage', cible: 'joueur', facteur: 0.895, texte: 'Une part de son salaire devient des bonis de performance, hors du plafond.' },
  enterre: { nom: 'Le contrat enterré', ico: '🗃️', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.86, texte: 'Une part de son salaire est réputée au club-école. Il compte pour moins, et il joue encore.' },
  // v2 : cinq de plus.
  aRabais: { nom: 'Le contrat à rabais', ico: '🏷️', rarete: 'commune', vie: 'usage', cible: 'joueur', facteur: 0.93, texte: 'Il signe sous sa valeur pour courir après une bague.' },
  clubEcole: { nom: 'Le passage au club-école', ico: '🚍', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.825, cout: 5, texte: 'Trois jours dans la ligue américaine, le temps que la paperasse passe. 5 jetons de frais.' },
  anticipee: { nom: 'La prolongation anticipée', ico: '✍️', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.895, texte: 'Signé un an d\'avance, à l\'ancien prix.' },
  hausse: { nom: 'La hausse du plafond', ico: '🆙', rarete: 'rare', vie: 'permanent', cible: 'aucune', espace: 3_000_000, texte: 'Les revenus de la ligue montent : le plafond aussi.' },
  signature: { nom: 'Le bonus de signature', ico: '🖊️', rarete: 'commune', vie: 'usage', cible: 'aucune', espace: 1_500_000, texte: 'Payé d\'avance, cet été : il ne compte plus cette saison.' },
  ...CONTRATS_VIE,
  taxe: { nom: 'La taxe de luxe', ico: '💸', rarete: 'maudite', vie: 'saison', cible: 'aucune', espace: -3_000_000, texte: 'La ligue sévit : ton plafond fond de 3\u00a0M$ cette saison.' },
};
/*
 * LE PLAFOND EFFECTIF À UNE JOURNÉE, pur : la base, l'espace gagné, la taxe,
 * le pourcentage du DG, et le « cap hit » de chaque joueur (sa retenue, son
 * rachat, son contrat d'entrée, ses bonis ; zéro s'il est au LTIR et blessé
 * ce jour-là). `blesses` : l'ensemble des clés à l'infirmerie à cette journée.
 * Rend { cap, lignes [{ nom, montant }], facteurs Map(clé → facteur), ltir Set }.
 */
export function plafondDe(decisions = [], jusqua = Infinity, { base = 0 } = {}) {
  const lignes = [];
  let cap = base;
  const facteurs = new Map(), ltir = new Set(), ecole = new Set();
  for (const d of [...decisions].filter(Boolean).sort((a, b) => (a.jour || 0) - (b.jour || 0))) {
    if ((d.jour || 0) >= jusqua) continue;
    // Le rappel du club-école (js/ballottage.js, `rappelDuClubEcole`) ne compte pas au plafond.
    if (d.ballottage && d.ballottage.ecole && d.ballottage.entre) ecole.add(d.ballottage.entre);
    const p = d.plafond;
    if (p) {
      if (p.espace) { cap += p.espace; lignes.push({ nom: p.nom || 'Espace', montant: p.espace }); }
      if (p.joueur && p.facteur) facteurs.set(p.joueur, (facteurs.get(p.joueur) || 1) * p.facteur);
      if (p.joueur && p.ltir) ltir.add(p.joueur);
    }
    for (const id of (d.achat && d.achat.maudites) || []) {
      const C = CONTRATS[String(id).split(':')[1]];
      if (C && C.espace) { cap += C.espace; lignes.push({ nom: C.nom, montant: C.espace }); }
    }
  }
  // Le pourcentage du DG, et celui de la banque au palier III (v2) : chacun sa ligne, nommée.
  for (const x of [...patronsActifs(decisions, jusqua), ...coachsActifs(decisions, jusqua)]) {
    const pct = (x.econ && x.econ.plafond) || 0;
    if (pct) { const m = Math.round(base * pct); cap += m; lignes.push({ nom: x.nom, montant: m }); }
  }
  return { cap, lignes, facteurs, ltir, ecole };
}

/* ---------- LES ÉVÉNEMENTS D'ÉQUIPE : quelques journées ---------- */
/* \`duree\` en journées ; les canaux comme les moments (\`effet\` d'une décision). */
export const EVENEMENTS = {
  voyage: { nom: 'Le voyage dans l\'Ouest', ico: '✈️', rarete: 'commune', retire: true, duree: 8, texte: 'Trois villes, cinq fuseaux horaires, un seul autobus.', effet: { finition: 1.105, energie: 1.21 } },
  souper: { nom: 'Le souper d\'équipe', ico: '🍝', rarete: 'commune', retire: true, duree: 7, texte: 'Le capitaine paie la facture.', effet: { finition: 1.07, discipline: 0.825 } },
  video: { nom: 'La séance vidéo', ico: '📼', rarete: 'commune', retire: true, duree: 6, texte: 'Quatre heures dans le noir.', effet: { volume: 0.93, defense: 0.895 } },
  rumeur: { nom: 'La rumeur d\'échange', ico: '📱', rarete: 'peu', duree: 10, texte: 'Tout le monde lit les journaux.', effet: { volume: 1.112, finition: 0.895 } },
  hopital: { nom: 'La visite à l\'hôpital', ico: '🏥', rarete: 'commune', retire: true, duree: 7, texte: 'Des sourires qui valent tous les trophées.', effet: { finition: 1.07, defense: 0.965 } },
  chandail: { nom: 'Le chandail retiré', ico: '🎖️', rarete: 'peu', duree: 3, texte: 'Une bannière monte au plafond.', effet: { finition: 1.112, defense: 0.895 } },
  tempete: { nom: 'La tempête de neige', ico: '🌨️', rarete: 'commune', duree: 5, texte: 'Pratiques annulées : tout le monde dort.', effet: { finition: 0.93, energie: 0.72 } },
  bagarre: { nom: 'La bagarre à l\'entraînement', ico: '🥊', rarete: 'peu', duree: 8, texte: 'Ça a brassé. Ça brasse encore.', effet: { discipline: 1.42, blessure: 1.7, robustesse: 1.5 } },
  arbitres: { nom: 'La réunion avec les arbitres', ico: '🦓', rarete: 'commune', duree: 10, texte: 'On a compris ce qu\'ils siffleront.', effet: { discipline: 0.65 } },
  veteran: { nom: 'Le vétéran parle', ico: '🧓', rarete: 'peu', retire: true, duree: 10, texte: 'Dix minutes, porte fermée.', effet: { defense: 0.93, discipline: 0.72 } },
  huisClos: { nom: 'La réunion à huis clos', ico: '🚪', rarete: 'peu', retire: true, duree: 6, texte: 'On a entendu crier jusque dans le corridor.', effet: { finition: 1.112, blessure: 1.606 } },
  relache: { nom: 'La semaine de relâche', ico: '🏖️', rarete: 'peu', duree: 3, texte: 'Une semaine au soleil.', effet: { finition: 0.944 }, gestes: { energieTous: 20 } },
  campMiSaison: { nom: 'Le camp de mi-saison', ico: '🏕️', rarete: 'rare', retire: true, duree: 12, texte: 'Deux jours dans le bois, sans téléphone.', effet: { finition: 1.084, defense: 0.916, energie: 1.336 } },
  nouveauChandail: { nom: 'Le nouveau chandail', ico: '👕', rarete: 'commune', retire: true, duree: 5, texte: 'Le troisième chandail, enfin sorti.', effet: { finition: 1.105, discipline: 1.175 } },
  gala: { nom: 'La soirée de gala', ico: '🎆', rarete: 'peu', retire: true, duree: 4, texte: 'Les anciens sont dans les estrades.', effet: { volume: 1.07, finition: 1.112, energie: 1.175 } },
  controverse: { nom: 'La controverse', ico: '📰', rarete: 'maudite', retire: true, duree: 8, texte: 'Une photo de trop sur les réseaux.', effet: { finition: 0.895, discipline: 1.35 } },
  grippe: { nom: 'La grippe au vestiaire', ico: '🤧', rarete: 'maudite', retire: true, duree: 6, texte: 'Un joueur tousse. Puis tous.', effet: { blessure: 1.7, energie: 1.35 } },
  recrueSurprise: { nom: 'La recrue surprise', ico: '🌱', rarete: 'peu', retire: true, duree: 10, texte: 'Rappelé du club-école, il ne veut plus repartir.', effet: { volume: 1.105, energie: 0.895 } },
  pacte: { nom: 'Le pacte', ico: '🤞', rarete: 'rare', duree: 15, texte: 'Personne ne se rase avant la fin de la séquence.', effet: { finition: 1.056, defense: 0.916, blessure: 1.28 } },
  retourBlesse: { nom: 'Le retour au jeu', ico: '🔙', rarete: 'commune', retire: true, duree: 5, texte: 'Le physio donne le feu vert plus tôt que prévu.', effet: { finition: 1.056 }, gestes: { soin: 2, tousLesBlesses: true } },
  derby: { nom: 'La semaine du derby', ico: '⚔️', rarete: 'peu', duree: 3, texte: 'Personne n\'a oublié le dernier match.', effet: { finition: 1.112, discipline: 1.42, robustesse: 1.25 } },
  domicile: { nom: 'La série à domicile', ico: '🏠', rarete: 'commune', duree: 8, texte: 'Huit soirs dans son lit.', effet: { volume: 1.105, energie: 0.825 } },
  anciens: { nom: 'Le banquet des anciens', ico: '🍷', rarete: 'peu', retire: true, duree: 10, texte: 'Les histoires de 1971 font le tour de la table.', effet: { defense: 0.965, robustesse: 1.25 } },
  photo: { nom: 'La photo d\'équipe', ico: '📸', rarete: 'commune', retire: true, duree: 5, texte: 'Tout le monde en complet, les cheveux peignés.', effet: { finition: 1.035, discipline: 0.65 } },
  engueulade: { nom: 'L\'entraîneur sort de ses gonds', ico: '🤬', rarete: 'peu', duree: 5, texte: 'Un bâton cassé sur le banc.', effet: { finition: 1.112, discipline: 1.35, blessure: 1.7 } },
  brunch: { nom: 'Le brunch des familles', ico: '🥞', rarete: 'commune', retire: true, duree: 7, texte: 'Les enfants dans le vestiaire.', effet: { volume: 0.944, energie: 0.72 } },
  public: { nom: 'L\'œil du public', ico: '👁️', rarete: 'rare', retire: true, duree: 10, texte: 'Chaque match est télévisé d\'un océan à l\'autre.', effet: { finition: 1.095, defense: 0.937, energie: 1.158 } },
  arena: { nom: 'Le déménagement d\'aréna', ico: '🏟️', rarete: 'peu', retire: true, duree: 6, texte: 'La glace neuve est rapide.', effet: { volume: 1.112, defense: 1.07 } },
  batons: { nom: 'L\'atelier des bâtons', ico: '📏', rarete: 'peu', retire: true, duree: 8, regle: true, texte: 'Tout le vestiaire a la même courbe, un cran au-delà du gabarit.', effet: { finition: 1.105, discipline: 1.28 } },
  siffletPoche: { nom: 'Le sifflet dans la poche', ico: '🦓', rarete: 'commune', duree: 6, regle: true, texte: 'Les arbitres laissent jouer. On en profite dans les coins.', effet: { defense: 0.895, discipline: 1.35 } },
  planDesert: { nom: 'Le plan du filet désert', ico: '🚪', rarete: 'peu', duree: 4, regle: true, texte: 'Le sixième attaquant sort trop tôt, plusieurs soirs de suite.', effet: { volume: 1.112, defense: 1.112 } },
  obstruction: { nom: 'L\'obstruction oubliée', ico: '🪝', rarete: 'peu', duree: 8, regle: true, texte: 'On joue le hockey d\'avant la règle : les bâtons retiennent, les corps bloquent.', effet: { volume: 0.895, defense: 0.895, discipline: 1.28 } },
  /*
   * v2 — LES ÉVÉNEMENTS DES COACHS : un par coach, qui grandit comme ses
   * adjoints (`echelle`, par carte de son coach déjà jouée, au plus `max`).
   * Au départ un petit échange ; sur un build bâti, une vraie semaine.
   */
  concours: { nom: 'Le concours de lancers', ico: '🎳', rarete: 'peu', coach: 'essaim', duree: 8, texte: 'Un chronomètre, un filet, et une caisse de rondelles.', effet: { volume: 1.077, energie: 1.154 }, echelle: { par: { volume: 0.01 }, max: 8 } },
  regard: { nom: 'Le regard du tueur', ico: '🧿', rarete: 'peu', coach: 'rapaces', duree: 8, texte: 'Personne ne parle dans le vestiaire. Tout le monde vise.', effet: { finition: 1.07, discipline: 1.14 }, echelle: { par: { finition: 0.01 }, max: 8 } },
  bunker: { nom: 'Le bunker', ico: '🛖', rarete: 'peu', coach: 'tortue', duree: 8, texte: 'Les rideaux tirés, et on ne sort plus de sa zone.', effet: { volume: 0.93, defense: 0.93 }, echelle: { par: { defense: -0.008 }, max: 8 } },
  steak: { nom: 'Le steak d\'avant-match', ico: '🥩', rarete: 'peu', coach: 'rhinos', duree: 8, texte: 'Saignant, à trois heures pile.', effet: { discipline: 1.175, robustesse: 0.75 }, echelle: { par: { robustesse: 0.2 }, max: 8 } },
  spa: { nom: 'La semaine au spa', ico: '🧖', rarete: 'peu', coach: 'souffle', duree: 8, texte: 'Des peignoirs, des concombres, et personne à l\'infirmerie.', effet: { volume: 0.944, blessure: 0.44 }, gestes: { energieTous: 8 }, echelle: { par: { blessure: -0.08 }, max: 8 } },
  retraite: { nom: 'La retraite fermée', ico: '📿', rarete: 'peu', coach: 'choeur', duree: 8, texte: 'Trois jours au monastère, sans téléphone ni bière.', effet: { finition: 0.965, discipline: 0.72 }, echelle: { par: { discipline: -0.03 }, max: 8 } },
  garage: { nom: 'La ligue de garage', ico: '🧃', rarete: 'peu', coach: 'profondeur', duree: 8, texte: 'Le quatrième trio a gagné le tournoi du dimanche.', effet: { energie: 0.895, F: [0.925, 1, 1.075, 1.18] }, echelle: { par: { energie: -0.012 }, max: 8 } },
  une: { nom: 'La une des journaux', ico: '🗞️', rarete: 'peu', coach: 'etoiles', duree: 8, texte: 'Leurs visages sur chaque kiosque de la ville.', effet: { finition: 1.035, F: [1.18, 1.06, 0.94, 0.82] }, echelle: { par: { finition: 0.008 }, max: 8 } },
  commanditaires: { nom: 'La soirée des commanditaires', ico: '🥂', rarete: 'peu', coach: 'banque', duree: 3, texte: 'Des petits fours et des chèques.', effet: { finition: 0.944 }, gain: 8, echelle: { gain: 3, max: 8 } },
  // ---- v2 : dix-sept de plus, des échanges ----
  pleinAir: { nom: 'Le match en plein air', ico: '❄️', rarete: 'commune', retire: true, duree: 3, texte: 'Un stade de football, moins vingt, et la neige qui tombe.', effet: { volume: 1.105, finition: 0.93, energie: 1.175 } },
  repechageSoir: { nom: 'Le soir du repêchage', ico: '🎓', rarete: 'commune', retire: true, duree: 5, texte: 'Tout le monde regarde qui le club a choisi.', effet: { finition: 0.944, energie: 0.832 } },
  balado: { nom: 'Le balado du capitaine', ico: '🎧', rarete: 'commune', retire: true, duree: 8, texte: 'Une heure par semaine, et le vestiaire écoute.', effet: { volume: 0.965, discipline: 0.755 } },
  bagages: { nom: 'Les bagages perdus', ico: '🧳', rarete: 'commune', retire: true, duree: 4, texte: 'Des patins empruntés, et on joue fâché.', effet: { defense: 0.93, energie: 1.28 } },
  centenaire: { nom: 'Le centenaire du club', ico: '🎂', rarete: 'peu', retire: true, duree: 4, texte: 'Le vieux chandail, les anciens au centre de la glace.', effet: { finition: 1.112, discipline: 1.28 } },
  autobus: { nom: 'Le fan-club en autobus', ico: '🚌', rarete: 'commune', duree: 6, texte: 'Quarante partisans dans les estrades de l\'adversaire.', effet: { volume: 1.105, discipline: 1.175 } },
  invite: { nom: 'L\'entraîneur invité', ico: '🧑‍🏫', rarete: 'peu', retire: true, duree: 10, texte: 'Un ancien de l\'équipe nationale, pour deux semaines.', effet: { volume: 0.93, defense: 0.93 } },
  dossier: { nom: 'Le dossier des gardiens', ico: '🗂️', rarete: 'commune', duree: 8, texte: 'La mitaine de chaque gardien de la ligue, à la loupe.', effet: { volume: 0.895, finition: 1.105 } },
  fondante: { nom: 'La glace fondante', ico: '☀️', rarete: 'commune', retire: true, duree: 5, texte: 'Avril en mars : la rondelle roule sur la tranche.', effet: { volume: 0.895, defense: 0.93 } },
  infernal: { nom: 'Le calendrier infernal', ico: '🥾', rarete: 'peu', retire: true, duree: 7, texte: 'Cinq matchs en sept soirs.', effet: { volume: 1.105, energie: 1.35 } },
  bebe: { nom: 'Le bébé du capitaine', ico: '🍼', rarete: 'commune', retire: true, duree: 5, texte: 'Il ne dort plus, et il n\'a jamais aussi bien joué.', effet: { finition: 1.105, energie: 1.14 } },
  lockout: { nom: 'La menace de lock-out', ico: '🪧', rarete: 'peu', retire: true, duree: 8, texte: 'Les négociations traînent : on joue serré.', effet: { finition: 0.93, discipline: 0.72 } },
  mascotte: { nom: 'La nouvelle mascotte', ico: '🦦', rarete: 'commune', retire: true, duree: 6, texte: 'Une loutre géante qui lance des t-shirts.', effet: { volume: 1.087, defense: 1.035 } },
  soiree: { nom: 'La soirée du hockey', ico: '📡', rarete: 'peu', duree: 3, texte: 'Le pays au complet devant sa télé.', effet: { finition: 1.112, defense: 1.105 } },
  surfaceuse: { nom: 'La surfaceuse en panne', ico: '🚜', rarete: 'commune', retire: true, duree: 3, texte: 'La glace est une route de gravier.', effet: { volume: 0.888, defense: 0.888 } },
  golf: { nom: 'Le tournoi de golf de la fondation', ico: '⛳', rarete: 'commune', retire: true, duree: 5, texte: 'Dix-huit trous pour une bonne cause.', effet: { finition: 0.944, energie: 0.72 } },
  rivalite: { nom: 'La rivalité rallumée', ico: '🧨', rarete: 'peu', retire: true, duree: 6, texte: 'Un double-échec de trop, en novembre.', effet: { discipline: 1.42, robustesse: 1.5 } },
  lutte: { nom: 'La lutte à l\'entraînement', ico: '🤼', rarete: 'commune', retire: true, duree: 6, texte: 'Un contre un dans le coin, jusqu\'à ce que quelqu\'un abandonne.', effet: { blessure: 1.606, robustesse: 1.5 } },
  sousSol: { nom: 'Le gymnase du sous-sol', ico: '🏚️', rarete: 'commune', duree: 10, texte: 'Des poids rouillés et un vieux sac de sable.', effet: { volume: 0.944, robustesse: 1.5 } },
  plombiers: { nom: 'La soirée des plombiers', ico: '🪛', rarete: 'commune', retire: true, duree: 5, texte: 'Le quatrième trio a marqué deux fois hier : il joue plus.', effet: { finition: 0.965, energie: 0.895, F: [0.925, 1, 1.06, 1.225] } },
  reservistes: { nom: 'Le match des réservistes', ico: '🎛️', rarete: 'peu', duree: 6, texte: 'Les réservistes jouent une partie entre eux, et reviennent affamés.', effet: { finition: 0.965, blessure: 0.394, F: [0.94, 0.97, 1.075, 1.18], D: [0.925, 1, 1.12] } },
  etoiles: { nom: 'La semaine du match des étoiles', ico: '🤩', rarete: 'peu', retire: true, duree: 5, texte: 'Tes vedettes reviennent de la fête avec un trophée et des cernes.', effet: { finition: 1.07, energie: 1.14, F: [1.15, 1.045, 0.955, 0.85] } },
  policiers: { nom: 'Le retour des policiers', ico: '👮', rarete: 'peu', retire: true, duree: 8, texte: 'Deux durs rappelés du club-école : plus personne ne touche aux vedettes.', effet: { discipline: 1.35, robustesse: 1.5 } },
  code: { nom: 'Le code de conduite', ico: '📜', rarete: 'commune', retire: true, duree: 10, texte: 'Affiché au-dessus de chaque casier.', effet: { discipline: 0.65, robustesse: -0.5 } },
  ...EVENEMENTS_VIE,
};
/*
 * UN ÉVÉNEMENT SE SENT, DES DEUX CÔTÉS (V3.4). JP : *tu scores plus, mais l'adversaire aussi ; ton gardien arrête
 * plus, mais plus de rebonds, donc plus de tirs* ; *pas nécessairement ça, mais dans ce sens-là*. Mesuré avant
 * (scripts/check_evenements.mjs) : un événement changeait 0,18 but marqué et 0,08 accordé par match en médiane,
 * sur six matchs — moins d'un but en tout, qu'on ne sentait pas. L'écart de chaque canal est donc multiplié
 * (`AMPLEUR_EVENEMENT`), le gain ET son prix : la feuille change vraiment, et l'échange reste un échange. Les
 * canaux qui s'additionnent (la robustesse) et la glace des trios gardent leur valeur ; rien ne passe sous la
 * moitié ni au-dessus du double (`BORNES_EVENEMENT`).
 */
export const AMPLEUR_EVENEMENT = 2.6;   // V5 : 2 → 2,1, la médiane mesurée sur quatre paires de clubs était sous le tiers de but (0,29) ; V6 : → 2,6, la défense qui pèse deux fois plus (K_DEFENSE) l'avait ramenée à 0,28, et les bornes des canaux font monter la médiane lentement (2,4 : 0,296)
const BORNES_EVENEMENT = [0.5, 2];
const AMPLIFIES = ['volume', 'finition', 'defense', 'discipline', 'energie', 'blessure'];
for (const E of Object.values(EVENEMENTS)) {
  if (!E.effet) continue;
  for (const k of AMPLIFIES) if (typeof E.effet[k] === 'number') {
    const v = 1 + (E.effet[k] - 1) * AMPLEUR_EVENEMENT;
    E.effet[k] = Math.round(Math.min(BORNES_EVENEMENT[1], Math.max(BORNES_EVENEMENT[0], v)) * 10000) / 10000;
  }
}

/* ---------- LES CONSOMMABLES : une utilisation ---------- */
/*
 * \`vie\` : « usage » s'use cette saison (une utilisation) ; « permanent »
 * reste dans l'inventaire tant qu'on ne s'en sert pas, d'une run à l'autre
 * (mode Rogue). \`cible\` : ce qu'on vise en la jouant — un blessé, un joueur,
 * une malédiction du deck, une carte de match, un système, ou rien.
 */
export const CONSOMMABLES = {
  glace: { nom: 'Glace et compression', ico: '🧊', rarete: 'commune', vie: 'usage', cible: 'blesse', gestes: { soin: 2 }, texte: 'Vingt minutes, trois fois par jour.' },
  physio: { nom: 'La séance de physio', ico: '💆', rarete: 'peu', vie: 'usage', cible: 'blesse', gestes: { soin: 5 }, texte: 'Des ultrasons et de la patience.' },
  chirurgie: { nom: 'La chirurgie éclair', ico: '🏥', rarete: 'rare', vie: 'permanent', cible: 'blesse', gestes: { soin: 12 }, effet: { blessure: 1.56 }, duree: 5, texte: 'Le meilleur chirurgien a une plage libre. Le vestiaire paie la salle d\'attente.' },
  infirmerie: { nom: 'La ronde de l\'infirmerie', ico: '🩺', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { soin: 2, tousLesBlesses: true }, texte: 'Le médecin passe voir tout le monde.' },
  boisson: { nom: 'La boisson', ico: '🥤', rarete: 'commune', vie: 'usage', cible: 'joueur', gestes: { energie: 25 }, texte: 'Bleue, et on ne veut pas savoir ce qu\'il y a dedans.' },
  bainGlace: { nom: 'Le bain de glace', ico: '🛁', rarete: 'commune', vie: 'usage', cible: 'aucune', gestes: { energieTous: 10 }, effet: { blessure: 1.42 }, duree: 4, texte: 'Le froid remet les jambes. Les corps restent fragiles.' },
  conge: { nom: 'La journée de congé', ico: '🛌', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { energieTous: 12 }, texte: 'Pas de patin, pas de gym, pas de vidéo.' },
  hyperbare: { nom: 'La chambre hyperbare', ico: '🫧', rarete: 'rare', vie: 'permanent', cible: 'joueur', gestes: { energie: 40 }, effet: { volume: 0.888 }, duree: 3, texte: 'Une heure dans le tube. La pratique du matin saute.' },
  cure: { nom: 'La cure thermale', ico: '♨️', rarete: 'peu', vie: 'permanent', cible: 'aucune', effet: { blessure: 0.16 }, duree: 10, texte: 'Dix jours de sources chaudes pour les corps usés.' },
  enveloppe: { nom: 'L\'enveloppe brune', ico: '✉️', rarete: 'peu', vie: 'usage', cible: 'aucune', gain: 20, texte: 'On ne pose pas de question.' },
  coffre: { nom: 'Le coffre du proprio', ico: '🧰', rarete: 'rare', vie: 'permanent', cible: 'aucune', gain: 45, effet: { discipline: 1.168 }, duree: 5, texte: 'Le proprio a trouvé la clé. La ligue a trouvé la photo.' },
  billet: { nom: 'Le billet de loterie', ico: '🎟️', rarete: 'commune', vie: 'usage', cible: 'aucune', pari: { chance: 0.5, gain: 30 }, texte: 'Une chance sur deux de gratter 30 jetons.' },
  exorciste: { nom: 'L\'exorciste', ico: '🕯️', rarete: 'rare', vie: 'permanent', cible: 'malediction', texte: 'Il chasse une malédiction de ton deck de match.' },
  campExpress: { nom: 'Le camp express', ico: '⛺', rarete: 'peu', vie: 'usage', cible: 'carteMatch', texte: 'Une carte de ton deck de match devient sa version « + ».' },
  stageExpress: { nom: 'Le stage express', ico: '📘', rarete: 'peu', vie: 'usage', cible: 'tactique', maitrise: 0.25, texte: 'Ta formation fait 25 % du chemin vers la maîtrise d\'un système.' },
  gabarit: { nom: 'Le gabarit de poche', ico: '📐', rarete: 'peu', vie: 'usage', cible: 'aucune', regle: true, effet: { finition: 1.105, discipline: 1.28 }, duree: 3, texte: 'Tu mesures leurs bâtons. Les tiens restent dans le sac.' },
  repos: { nom: 'Le repos du partant', ico: '🧤', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { gardienAux: 3 }, texte: 'Le partant regarde. L\'auxiliaire prend les trois prochains.' },
  bancCourt: { nom: 'Le banc court', ico: '🔥', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { F: [1.4, 1.04, 0.84, 0.6], blessure: 1.525, energie: 1.21 }, duree: 4, texte: 'Le premier trio ne sort plus. Le quatrième rouille.' },
  profondeur: { nom: 'La glace du bas', ico: '🔋', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { F: [0.76, 1.04, 1.16, 1.32], volume: 0.93, blessure: 0.65 }, duree: 5, texte: 'Le bas de l\'alignement joue. Les vedettes respirent.' },
  crochet: { nom: 'Le crochet de poche', ico: '🪝', rarete: 'commune', vie: 'usage', cible: 'aucune', regle: true, effet: { defense: 0.895, discipline: 1.28 }, duree: 3, texte: 'Trois soirs, on accroche. L\'arbitre finit par le voir.' },
  // ---- v2 : treize de plus ----
  vitamines: { nom: 'Les vitamines', ico: '💊', rarete: 'commune', vie: 'usage', cible: 'joueur', gestes: { energie: 15 }, effet: { blessure: 0.825 }, duree: 5, texte: 'Une poignée chaque matin, avec le jus d\'orange.' },
  ruban: { nom: 'Le ruban magique', ico: '🎗️', rarete: 'commune', vie: 'usage', cible: 'blesse', gestes: { soin: 3 }, effet: { blessure: 1.35 }, duree: 3, texte: 'Trois rouleaux autour de la cheville, et il retourne au jeu.' },
  aiguilles: { nom: 'L\'acupuncteur', ico: '🪡', rarete: 'peu', vie: 'usage', cible: 'blesse', gestes: { soin: 4 }, texte: 'Quarante aiguilles, et le dos se replace.' },
  cafe: { nom: 'Le café de l\'aréna', ico: '☕', rarete: 'commune', vie: 'usage', cible: 'aucune', gestes: { energieTous: 6 }, texte: 'Filtre, noir, dans un verre en styromousse.' },
  rondelles: { nom: 'Le seau de rondelles', ico: '🪣', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { finition: 1.14, energie: 1.175 }, duree: 3, texte: 'Une heure de tirs après la pratique, pour tout le monde.' },
  proprioParle: { nom: 'Le discours du proprio', ico: '📯', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { finition: 1.105, volume: 1.07, discipline: 1.21 }, duree: 3, texte: 'Il descend au vestiaire en complet. Personne n\'ose respirer.' },
  depanneur: { nom: 'La commandite du dépanneur', ico: '🏪', rarete: 'commune', vie: 'usage', cible: 'aucune', gain: 12, texte: 'Le logo sur la surfaceuse, et un chèque.' },
  barSportif: { nom: 'Le pari au bar sportif', ico: '🍺', rarete: 'peu', vie: 'usage', cible: 'aucune', pari: { chance: 0.35, gain: 50 }, texte: 'Une chance sur trois de rafler 50 jetons.' },
  visualisation: { nom: 'La visualisation', ico: '🔮', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { defense: 0.895, finition: 1.035 }, duree: 3, texte: 'Yeux fermés, il voit chaque arrêt avant de le faire.' },
  cryo: { nom: 'La cryothérapie', ico: '🥶', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { energieTous: 15 }, effet: { finition: 0.93 }, duree: 3, texte: 'Trois minutes à moins cent dix. Les mains gèlent aussi.' },
  vacances: { nom: 'Le partant en vacances', ico: '🏝️', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { gardienAux: 5 }, effet: { energie: 0.895 }, duree: 5, texte: 'Une semaine au soleil pour le partant ; l\'auxiliaire a sa chance.' },
  pizza: { nom: 'Le souper des trios', ico: '🍕', rarete: 'commune', vie: 'usage', cible: 'tactique', maitrise: 0.15, texte: 'Chaque trio à sa table, et le cahier de jeux entre les pointes.' },
  epaulettes: { nom: 'Les épaulettes de football', ico: '🏈', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { robustesse: 1.6, energie: 1.175 }, duree: 4, texte: 'Trop grosses, trop lourdes, et plus personne n\'a peur de la bande.' },
  coudieres: { nom: 'Les coudières de bois', ico: '🪵', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { robustesse: 1.6, discipline: 1.28 }, duree: 4, texte: 'Des protège-coudes d\'une autre époque. L\'arbitre fronce les sourcils.' },
  carteBlanche: { nom: 'La carte blanche au quatrième', ico: '📝', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { F: [0.84, 1, 1.1, 1.4], energie: 0.825, finition: 0.965 }, duree: 4, texte: 'Le quatrième trio commence les matchs, et il les finit.' },
  premierTrio: { nom: 'Le premier trio ce soir', ico: '🔝', rarete: 'peu', vie: 'usage', cible: 'aucune', effet: { F: [1.4, 1.06, 0.8, 0.6], finition: 1.035, energie: 1.175 }, duree: 2, texte: 'Deux soirs, tes trois meilleurs sautent sur la glace un tour sur deux.' },
  reglement: { nom: 'Le livre des règlements', ico: '📕', rarete: 'commune', vie: 'usage', cible: 'aucune', effet: { discipline: 0.58, volume: 0.965 }, duree: 5, texte: 'Chaque joueur le lit dans l\'autobus. Il ne tire plus de peur de cingler.' },
  /*
   * v2 — LES CARTES DE VESTIAIRE : une par coach (le Comptable n'a pas de
   * joueurs), qui grandit avec les JOUEURS de sa couleur habillés quand on la
   * joue (`parJoueur`, js/coachs.js `coachDesRoles`) : cinq snipers font de
   * « La clé du coin supérieur » une vraie semaine. Des cartes de joueurs qui
   * font vivre des cartes de banque.
   */
  tambourPointe: { nom: 'Le tambour de la pointe', ico: '🥁', rarete: 'commune', vie: 'usage', cible: 'aucune', coach: 'essaim', effet: { volume: 1.022 }, duree: 5, parJoueur: { par: { volume: 0.0128 }, max: 5 }, texte: 'Tes défenseurs offensifs et tes power forwards donnent le rythme.' },
  cleCoin: { nom: 'La clé du coin supérieur', ico: '🗝️', rarete: 'commune', vie: 'usage', cible: 'aucune', coach: 'rapaces', effet: { finition: 1.022 }, duree: 5, parJoueur: { par: { finition: 0.0128 }, max: 5 }, texte: 'Tes snipers ont trouvé le trou au-dessus de l\'épaule du gardien.' },
  murPierre: { nom: 'Le mur de pierre', ico: '🗿', rarete: 'commune', vie: 'usage', cible: 'aucune', coach: 'tortue', effet: { defense: 0.978 }, duree: 5, parJoueur: { par: { defense: -0.0096 }, max: 5 }, texte: 'Tes joueurs de devoir ne sortent plus de leur zone.' },
  tambourGuerre: { nom: 'Le tambour de guerre', ico: '🪘', rarete: 'commune', vie: 'usage', cible: 'aucune', coach: 'rhinos', effet: { robustesse: 0.16 }, duree: 5, parJoueur: { par: { robustesse: 0.24 }, max: 5 }, texte: 'Tes durs frappent le banc avec leurs bâtons avant la mise au jeu.' },
  brise: { nom: 'La brise du quatrième', ico: '🎐', rarete: 'commune', vie: 'usage', cible: 'aucune', coach: 'souffle', effet: { energie: 0.955, blessure: 0.933 }, duree: 5, parJoueur: { par: { energie: -0.024, blessure: -0.032 }, max: 5 }, texte: 'Tes plombiers patinent pour tout le monde.' },
  partition: { nom: 'La partition des manieurs', ico: '🎼', rarete: 'commune', vie: 'usage', cible: 'aucune', coach: 'choeur', effet: { discipline: 0.933 }, duree: 5, parJoueur: { par: { discipline: -0.048 }, max: 5 }, texte: 'Tes défenseurs manieurs gardent la rondelle, et personne ne s\'énerve.' },
  epingles: { nom: 'Les épingles du tableau', ico: '🧷', rarete: 'commune', vie: 'usage', cible: 'aucune', coach: 'profondeur', effet: { F: [0.952, 1, 1.048, 1.128], energie: 0.978 }, duree: 5, parJoueur: { par: { energie: -0.016 }, max: 5 }, texte: 'Tes checkers ont chacun leur épingle au tableau des présences.' },
  disco: { nom: 'La boule disco', ico: '🪩', rarete: 'commune', vie: 'usage', cible: 'aucune', coach: 'etoiles', effet: { F: [1.08, 1.032, 0.968, 0.92], finition: 1.011 }, duree: 5, parJoueur: { par: { finition: 0.0096 }, max: 5 }, texte: 'Tes passeurs allument le vestiaire après chaque victoire.' },
  ...CONSOMMABLES_VIE,
  // V5 : comme dans la LNH, on change de coach en cours de saison en congédiant l'entraîneur — le nouveau arrive avec
  // sa philosophie, à la confiance I, et l'ancienne part avec son bonus. Le seul chemin vers un autre coach en saison.
  congediement: { nom: 'Le congédiement', ico: '📋', rarete: 'peu', vie: 'usage', cible: 'coach', texte: 'L\'entraîneur vide son bureau au matin. Le nouveau arrive avec son cahier de jeux, et tout est à rebâtir.' },
  capitaineC: { nom: 'Le C cousu en réserve', ico: '🪢', rarete: 'rare', vie: 'permanent', cible: 'aucune', effet: { discipline: 0.72, defense: 0.944, volume: 0.958 }, duree: 10, texte: 'Un deuxième capitaine, prêt quand le premier se tait.' },
};

/* ---------- LES MODIFS DE JOUEURS : des MUTATIONS au joueur de ton choix ---------- */
const SOURCES_MOD = ['amelioration', 'atelier', 'style', 'contrat'];
const RARETE_MOD = {
  affute: 'peu', moteur: 'peu', mur: 'peu', vision: 'peu', coach: 'peu',
  partout: 'rare', cran: 'rare', physio: 'peu', lustre: 'legendaire', enBas: 'rare', chasse: 'rare', entrainement: 'peu', mentorTrio: 'rare',
  domicile: 'peu', route: 'peu', printemps: 'rare', etincelle: 'rare', braise: 'rare', poudre: 'rare',
  style_sniper: 'peu', style_faiseur: 'peu', style_ancre: 'peu', style_locomotive: 'peu', style_chasseur: 'peu',
  style_architecte: 'rare', style_sentinelle: 'rare', style_canonnier: 'rare', style_buteur: 'legendaire', style_pieuvre: 'rare',
  masque_neuf: 'commune', baton_neuf: 'commune', contrat_annee: 'peu', contrat_prolonge: 'commune', contrat_bonus: 'rare', contrat_leader: 'rare',
  style_courbe: 'peu', style_accrocheur: 'peu', style_fantome: 'rare',
  ...RARETE_MODIFS_VIE,
};
const MODS_JOUEUR = Object.keys(MUTATIONS).filter(k => SOURCES_MOD.includes(MUTATIONS[k].source));

/*
 * LES CASES D'AMÉLIORATION, AU VERSO (S80). JP : *je veux que les upgrades de
 * joueurs se fassent au verso de la carte, pas nécessairement quand on la
 * pige* ; *je clique sur le joueur, pis je dois aller au verso pour l'ajouter
 * dans une des slots joueurs?*. Une modif de joueur (une amélioration, une
 * édition de l'atelier, un style, un contrat) se GARDE dans l'inventaire, et
 * se POSE sur une case du verso d'un joueur de ton alignement. La carte a DEUX
 * cases ; une holo ou une or en a une de plus — la finition est la rareté de
 * la carte, et une carte rare en porte plus. Chaque carte posée prend une case
 * pour le reste de la saison, le lustre compris : monter une parallèle en holo
 * rend la case qu'il a prise.
 *
 * Ce qui est posé se lit dans les DÉCISIONS, pas dans le moteur : une carte
 * posée aujourd'hui ne s'applique qu'au matin de sa journée (rien ne se joue
 * d'avance), mais sa case est prise tout de suite. Les changements de carte
 * qui ne sont pas des modifs (un dilemme, un nouveau rôle, un accident) ne
 * prennent pas de case : ils sont ce qui lui est ARRIVÉ.
 */
export const CASES_DE_BASE = 2;
export const casesDAmelioration = variante => CASES_DE_BASE + (variante === 'rare' || variante === 'legendaire' ? 1 : 0);
/* Une modif qui se pose (et prend une case). */
export const sePose = cle => !!MUTATIONS[cle] && SOURCES_MOD.includes(MUTATIONS[cle].source);
/* Pour qui : une carte de gardien aux gardiens, les autres aux patineurs (avants et défenseurs). */
export const pourCeJoueur = (cle, estGardien) => !!MUTATIONS[cle] && !!MUTATIONS[cle].gardien === !!estGardien;
/* Les modifs posées sur un joueur, dans l'ordre : `{ cle, jour, carte }` (la variante d'un lustre). */
export function poseesSur(decisions = [], joueur) {
  return decisions.filter(d => d && d.mutation && d.mutation.joueur === joueur && sePose(d.mutation.cle))
    .sort((a, b) => (a.jour || 0) - (b.jour || 0))
    .map(d => ({ cle: d.mutation.cle, jour: d.jour || 0, carte: d.mutation.carte || null, joue: d.joue || null, deck: d.deck || null }));
}
/* La variante qu'a sa carte une fois ses lustres posés (chaque décision de lustre porte la suivante). */
export function varianteApres(variante, posees = []) {
  const l = posees.filter(x => x.carte && x.carte.rar).pop();
  return l ? l.carte.rar : variante;
}
/* Combien de cases il lui reste : celles de sa carte (lustres compris), moins les posées. */
export function casesLibres(variante, posees = []) {
  return Math.max(0, casesDAmelioration(varianteApres(variante, posees)) - posees.length);
}

/* ---------- LE REGISTRE ---------- */
const fait = (cat, cle, def) => ({ id: `${cat}:${cle}`, cat, cle, ...def });
/*
 * CE QU'UNE CARTE FAIT, pour lire son COACH (v2, js/coachs.js) : les champs
 * de sa famille ramenés à la même forme. Une carte de match lit aussi ce que
 * ses mécaniques promettent (un combo, une réponse à leur main, un pari
 * gagné) ; une carte de synergie, ce qu'elle lit dans ta formation.
 */
const SYNERGIES = { systeme: 'rapaces', gachettes: 'rapaces', mur: 'tortue', jambes: 'essaim', coequipiers: 'etoiles', famille: 'tortue',
  decennie: 'essaim', vieilleGarde: 'tortue', releve: 'essaim', ligneOrigine: 'etoiles', dynastieClub: 'etoiles' };
function coachDeLaFamille(cat, cle) {
  const lu = o => coachDesCanaux(o);
  if (cat === 'patron') { const P = PATRONS[cle]; return P.coach || lu({ effet: P.effet, econ: P.econ }); }
  if (cat === 'evenement') { const E = EVENEMENTS[cle]; return E.coach || lu({ effet: E.effet, gestes: E.gestes, gain: E.gain }); }
  if (cat === 'joueur') return lu({ mutation: MUTATIONS[cle] });
  if (cat === 'consommable') { const C = CONSOMMABLES[cle]; return C.coach || lu({ effet: C.effet, gestes: C.gestes, gain: C.gain, pari: C.pari }); }
  if (cat === 'plafond') return 'banque';
  if (cat === 'saison') return lu({ effet: CARTES[cle] });
  if (cat === 'match') {
    const C = CARTES_MATCH[cle];
    if (C.synergie && SYNERGIES[C.synergie]) return SYNERGIES[C.synergie];
    const e = { ...(C.effet || {}) };
    for (const x of [C.parGenre && C.parGenre.effet, C.selonLeurMain && C.selonLeurMain.effet, C.apres40 && C.apres40.siMene, C.pari && C.pari.gagne, C.improvise, C.piege, C.siVide]) {
      if (x) for (const [k, v] of Object.entries(x)) if (typeof v === 'number') e[k] = k === 'robustesse' ? (e[k] || 0) + v : (e[k] ?? 1) * v;
    }
    return lu({ effet: e, adv: C.adv, gestes: C.energieTous ? { energieTous: C.energieTous } : null });
  }
  return null;
}
function construire() {
  const B = {};
  const mettre = c => { B[c.id] = { ...c, coach: coachDeLaFamille(c.cat, c.cle) }; };
  for (const [cle, P] of Object.entries(PATRONS)) mettre(fait('patron', cle, { nom: P.nom, ico: P.ico, rarete: P.rarete, texte: P.texte, vie: 'permanent', role: P.role }));
  for (const [cle, E] of Object.entries(EVENEMENTS)) mettre(fait('evenement', cle, { nom: E.nom, ico: E.ico, rarete: E.rarete, texte: E.texte, vie: 'saison', duree: E.duree, ...(E.regle ? { regle: true } : {}), ...(E.retire ? { retire: true } : {}) }));
  for (const cle of MODS_JOUEUR) {
    const M = MUTATIONS[cle];
    mettre(fait('joueur', cle, { nom: M.nom, ico: M.ico, rarete: RARETE_MOD[cle] || 'peu', texte: M.quoi, vie: 'saison', gardien: !!M.gardien, source: M.source }));
  }
  for (const [cle, C] of Object.entries(CONSOMMABLES)) mettre(fait('consommable', cle, { nom: C.nom, ico: C.ico, rarete: C.rarete, texte: C.texte, vie: C.vie, cible: C.cible, ...(C.regle ? { regle: true } : {}) }));
  for (const [cle, C] of Object.entries(CONTRATS)) mettre(fait('plafond', cle, { nom: C.nom, ico: C.ico, rarete: C.rarete, texte: C.texte, vie: C.vie, cible: C.cible }));
  for (const [cle, C] of Object.entries(CARTES_MATCH)) {
    if (estPlus(cle)) continue;
    mettre(fait('match', cle, { nom: C.nom, ico: C.ico, rarete: C.rarete, texte: C.texte, vie: 'saison', cout: C.cout, genre: C.genre }));
  }
  for (const [cle, C] of Object.entries(CARTES)) mettre(fait('saison', cle, { nom: C.nom, ico: C.ico, rarete: 'rare', texte: `${C.bon}. ${C.prix}.`, vie: 'saison' }));
  return B;
}
export const BANQUE = construire();
export const carteBanque = id => BANQUE[id] || null;
/*
 * LES DEUX PATRONS IMPOSÉS AU DÉPART D'UNE RUN (V2.3) : des passifs neutres, utiles à tous — un patron sans couleur
 * de coach, ou de celle du Comptable (l'argent) —, tirés de la graine de la run parmi les raretés que le prestige
 * ouvre (js/rogue.js `PRESTIGES`), deux rôles différents. Rend leurs id de banque.
 */
export const PATRONS_IMPOSES = 2;
export function patronsDeDepart(graine, raretes) {
  const out = [];
  const pool = Object.values(BANQUE).filter(c => c.cat === 'patron' && (!c.coach || c.coach === 'banque') && raretes.includes(c.rarete))
    .sort((a, b) => hache(graine, 'patron', a.id) - hache(graine, 'patron', b.id));
  for (const c of pool) if (out.length < PATRONS_IMPOSES && !out.some(x => BANQUE[x].role === c.role)) out.push(c.id);
  return out;
}
/* Un canal d'équipe, du bon côté : buts contre, punitions, blessures et usure descendent. */
const canalBon = (k, v) => (k === 'robustesse' ? v > 0 : (k === 'defense' || k === 'discipline' || k === 'blessure' || k === 'energie' ? v < 1 : v > 1));
const bitsDEffet = e => {
  const out = [];
  if (!e) return out;
  for (const k of ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse']) {
    const v = e[k];
    if (v == null || (k === 'robustesse' ? v === 0 : v === 1)) continue;
    out.push(canalBon(k, v));
  }
  return out;
};
/* La forme d'un consommable, lue sur toute la carte. Le mot dit le verbe, pas « un peu ». */
function formeDeConsommable(C) {
  if (!C) return '';
  if (C.pari) return 'Pari';
  if (C.regle) return 'Règlement';
  const e = C.effet || {};
  if (Array.isArray(e.F) || Array.isArray(e.D)) return 'Minutes';
  const bits = bitsDEffet(e);
  const g = C.gestes || {};
  if (g.soin) bits.push(true);
  if (g.energie) bits.push(g.energie > 0);
  if (g.energieTous) bits.push(g.energieTous > 0);
  if (C.gain) bits.push(true);
  if (bits.some(Boolean) && bits.some(b => !b)) return 'Échange';
  if (C.cible === 'malediction') return 'Malédiction';
  if (C.cible === 'carteMatch') return 'Plus';
  if (C.cible === 'tactique') return 'Système';
  if (C.cible === 'coach') return 'Coach';
  if (C.gain) return 'Jetons';
  if (g.gardienAux) return 'Filet';
  if (g.soin) return 'Soin';
  if (g.energie || g.energieTous) return 'Jambes';
  if (!bits.length) return '';
  if (bits.every(Boolean)) return 'Cadeau';
  return 'Moindre mal';
}
/* Un événement qui soigne ou repose en plus de son effet n'est pas qu'un moindre mal. */
function formeDEvenement(E) {
  if (!E) return '';
  if (E.regle) return 'Règlement';
  const base = formeDe({ effet: E.effet || {} });
  const g = E.gestes;
  if (!g) return base;
  const bon = !!(g.soin || g.energie > 0 || g.energieTous > 0 || g.gardienAux);
  const mal = !!((g.energie && g.energie < 0) || (g.energieTous && g.energieTous < 0));
  if ((bon && base === 'Moindre mal') || (mal && base === 'Cadeau')) return 'Échange';
  if (!base && g.gardienAux) return 'Filet';
  if (!base && g.soin) return 'Soin';
  if (!base && (g.energie || g.energieTous)) return 'Jambes';
  return base;
}
function formeDePlafond(C) {
  if (!C) return '';
  if (C.espace < 0) return 'Moindre mal';
  if (C.cout) return 'Échange';
  if (C.espace || C.ltir) return 'Plafond';
  if (C.facteur) return 'Salaire';
  return '';
}
/* La forme d'une carte de la banque, le mot qu'on lit avant les chiffres. Pas les cartes de joueur : elles disent leur édition. */
export function etiquetteBanque(id) {
  const c = carteBanque(id);
  if (!c) return '';
  if (c.cat === 'joueur') return (c.regle || EDITIONS_REGLEMENT.includes(c.cle)) ? 'Règlement' : '';
  if (c.regle) return 'Règlement';
  if (c.cat === 'match') return formeDe({ genreCarte: c.genre, dessin: c.cle });
  if (c.cat === 'evenement') return formeDEvenement(EVENEMENTS[c.cle]);
  if (c.cat === 'saison') return formeDe({ effet: CARTES[c.cle] });
  if (c.cat === 'patron') {
    const P = PATRONS[c.cle] || {};
    return formeDe({ effet: P.effet || {} }) || (P.econ ? 'Boutique' : '');
  }
  if (c.cat === 'consommable') return formeDeConsommable(CONSOMMABLES[c.cle]);
  if (c.cat === 'plafond') return formeDePlafond(CONTRATS[c.cle]);
  return '';
}
/*
 * LES CARTES QUI SE TIRENT. Une carte RETIRÉE (\`retire\`, V6 : les événements passés de 160 à une quarantaine) ne
 * sort plus d'aucun tirage — packs, nœuds de la semaine, packs des paliers —, mais sa définition reste : une partie
 * d'avant qui la porte dans sa poche ou dans ses décisions la charge, la joue et la rejoue pareil.
 */
export const idsDe = cat => Object.values(BANQUE).filter(c => c.cat === cat && !c.retire).map(c => c.id);
export const compteParCategorie = () => Object.fromEntries(ORDRE_CATEGORIES.map(c => [c, idsDe(c).length]));

/* Les étiquettes de durée de vie, telles que l'inventaire les affiche. */
export const VIES = {
  permanent: { nom: 'Permanente', mot: 'Reste dans ton inventaire tant que tu ne t\'en sers pas, d\'une run à l\'autre.' },
  // S80 : une run dure plusieurs saisons — une carte « cette saison » expire à la fin de SA saison, pas de la run.
  saison: { nom: 'Cette saison', mot: 'Vaut pour la saison en cours ; elle expire à la fin de la saison.' },
  usage: { nom: '1 utilisation', mot: 'S\'use en la jouant, cette saison.' },
};
/*
 * QUAND UNE CARTE JOUE (S79). JP : *tu dois pouvoir toujours voir tes cartes
 * et certaines se gardent jusqu'au moment voulu dans la saison*. Une carte
 * de pack SE GARDE : elle attend dans l'inventaire que tu la joues (une
 * décision datée du jour, qui se rejoue). Une malédiction et une carte de
 * saison (prise à un palier) sont JOUÉES IMMÉDIATEMENT.
 */
export const MOMENTS = {
  garde: { nom: 'Se garde', ico: '⏳', mot: 'Dans ta poche jusqu\'à ce que tu la joues.' },
  immediat: { nom: 'Jouée immédiatement', ico: '⚡', mot: 'Jouée immédiatement : elle s\'applique dès que tu la reçois.' },
};
export const momentDe = id => { const c = BANQUE[id]; return c && (c.rarete === 'maudite' || c.cat === 'saison') ? 'immediat' : 'garde'; };

/*
 * LA RÈGLE EN CHIFFRES d'une carte : des mots \`{ txt, bon }\`, les mêmes que
 * partout (\`motsEnChiffres\`, \`motsDeMutationEnChiffres\`). Les cartes de match ont la leur
 * (\`optionDeCarteMatch\`, js/gerant.js) : l'écran la lit là.
 */
/* `joueur` : le joueur qui la recevra (le verso d'une carte) — une modif se lit alors sur lui, pas sur sa cible par défaut. */
export function reglesDe(id, { joueur = null } = {}) {
  const c = carteBanque(id);
  if (!c) return [];
  if (c.cat === 'patron') {
    const P = PATRONS[c.cle];
    const out = [...motsEnChiffres(P.effet || {})];
    const e = P.econ || {};
    if (e.rabais) out.push({ txt: `Packs ${Math.round((e.rabais - 1) * 100)} %`, bon: true });
    if (e.jetonsVictoire) out.push({ txt: `+${e.jetonsVictoire} 🪙 par victoire`, bon: true });
    if (e.jetonsLancee) out.push({ txt: `+${e.jetonsLancee} 🪙 par joueur sur sa lancée, chaque soir`, bon: true });
    if (e.holo) out.push({ txt: `Packs de joueurs : holo ou mieux +${Math.round((e.holo - 1) * 100)} %`, bon: true });
    if (e.carteExtra) out.push({ txt: `Packs de joueurs : +${e.carteExtra} carte`, bon: true });
    if (e.sansBase) out.push({ txt: 'Packs de joueurs : jamais une carte de base', bon: true });
    if (e.plafond) out.push({ txt: `Plafond salarial +${Math.round(e.plafond * 100)} %`, bon: true });
    if (P.synergie) out.push({ txt: `Avec ${ROLES[P.synergie.avec].nom.toLowerCase()} : ${motsEnChiffres(P.synergie.effet).map(x => x.txt).join(', ')}`, bon: true });
    if (P.echelle) out.push(motDEchelle(P.echelle, c.coach));
    out.push({ txt: 'Toute la saison, séries comprises', bon: null, duree: true });
    return out;
  }
  if (c.cat === 'evenement') {
    const E = EVENEMENTS[c.cle];
    const out = motsEnChiffres(E.effet || {}, E.duree);
    if (E.gestes) out.unshift(...motsDesGestes(E.gestes));
    if (E.gain) out.unshift({ txt: `+${E.gain} 🪙`, bon: true });
    if (E.echelle) out.push(motDEchelle(E.echelle, c.coach));
    return out;
  }
  if (c.cat === 'joueur') return motsDeMutationEnChiffres(c.cle, joueur);
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    const out = [...motsDesGestes(C.gestes || {})];
    if (C.effet) out.push(...motsEnChiffres(C.effet, C.duree));
    if (C.gain) out.push({ txt: `+${C.gain} 🪙`, bon: true });
    if (C.pari) out.push({ txt: `${Math.round(C.pari.chance * 100)} % : +${C.pari.gain} 🪙`, bon: true });
    if (C.maitrise) out.push({ txt: `Maîtrise d'un système +${Math.round(C.maitrise * 100)} %`, bon: true }, { txt: '🔗 Carte de trio : forte au début de la saison, elle plafonne (une ligne apprend son système en jouant)', bon: null });
    if (C.cible === 'malediction') out.push({ txt: 'Retire 1 malédiction du deck', bon: true });
    if (C.cible === 'carteMatch') out.push({ txt: '1 carte du deck devient « + »', bon: true });
    if (C.cible === 'coach') out.push({ txt: 'Un autre coach, à la confiance I', bon: true }, { txt: 'Ton coach part, avec sa confiance', bon: false });
    if (C.parJoueur) out.push(motDeJoueurs(C.parJoueur, c.coach));
    return out;
  }
  if (c.cat === 'plafond') {
    const C = CONTRATS[c.cle];
    const out = [];
    if (C.espace) out.push({ txt: `Plafond ${C.espace > 0 ? '+' : '−'}${money(Math.abs(C.espace))} cette saison`, bon: C.espace > 0 });
    if (C.facteur) out.push({ txt: `${C.cible === 'recrue' ? 'Une recrue (23 ans ou moins)' : 'Un joueur'} : son salaire compte ${Math.round((C.facteur - 1) * 100)} %`, bon: true });
    if (C.ltir) out.push({ txt: 'Un blessé : 100 % de son salaire hors du plafond, tant qu\'il est blessé', bon: true });
    if (C.cout) out.push({ txt: `−${C.cout} 🪙`, bon: false });
    return out;
  }
  if (c.cat === 'saison') return motsEnChiffres(CARTES[c.cle]);
  return [];
}
/*
 * UN PAS, EN MOTS. Un pas s'AJOUTE à l'effet (js/banque.js `grandi`) : ce qu'une carte de coach gagne avec chaque
 * carte jouée, ou chaque joueur habillé, est trop petit pour se lire seul. On dit donc où elle arrive à son
 * plafond, en chiffres de match : « jusqu'à ≈ +0,6 tir par match avec 10 cartes du Frelon jouées ».
 */
function auPlafond(par = {}, max) {
  const e = Object.fromEntries(Object.entries(par).map(([k, v]) => [k, k === 'robustesse' ? v * max : 1 + v * max]));
  // Les deux chiffres qui comptent : on laisse de côté les tirs accordés, simple conséquence d'un volume.
  return motsEnChiffres(e).filter(m => m.cle !== 'rien' && m.cle !== 'tir accordé').slice(0, 2).map(m => m.txt);
}
/* « jusqu'à ≈ +0,6 tir par match avec 10 cartes 🐝 du Frelon jouées » : ce qu'une carte de coach gagne en grandissant. */
function motDEchelle(E, coach) {
  const Ec = COACHS[coach] || { ico: '', nom: '' };
  const pas = [...auPlafond(E.par, E.max), ...(E.gain ? [`+${E.gain} 🪙 par carte`] : [])].join(', ');
  return { txt: pas ? `Jusqu'à ${pas} avec ${E.max} cartes ${Ec.ico} ${Ec.de} jouées` : `Grandit avec chaque carte ${Ec.ico} ${Ec.de} jouée (au plus ${E.max})`, bon: true };
}
/* « jusqu'à ≈ +0,1 but marqué par match avec 5 joueurs de l'Aigle habillés » : ce qu'une carte gagne de tes joueurs. */
function motDeJoueurs(J, coach) {
  const Ec = COACHS[coach] || { de: '' };
  const pas = auPlafond(J.par, J.max).join(', ');
  return { txt: pas ? `Jusqu'à ${pas} avec ${J.max} joueurs ${Ec.de} habillés` : `Grandit avec chaque joueur ${Ec.de} habillé (au plus ${J.max})`, bon: true };
}
function motsDesGestes(g) {
  const out = [];
  if (g.soin) out.push({ txt: `${g.tousLesBlesses ? 'Tous tes blessés' : 'Un blessé'} : −${g.soin} match${g.soin > 1 ? 's' : ''} d'infirmerie`, bon: true });
  if (g.energie) out.push({ txt: `Un joueur : jambes ${g.energie > 0 ? '+' : '−'}${Math.abs(g.energie)}`, bon: g.energie > 0 });
  if (g.energieTous) out.push({ txt: `Tes patineurs : jambes ${g.energieTous > 0 ? '+' : '−'}${Math.abs(g.energieTous)}`, bon: g.energieTous > 0 });
  if (g.gardienAux) out.push({ txt: `L'auxiliaire garde le filet ${g.gardienAux} match${g.gardienAux > 1 ? 's' : ''}`, bon: null });
  return out;
}

/*
 * LES PATRONS ENGAGÉS à une journée : ce que les décisions ont posé, un par
 * rôle (le dernier engagé remplace l'autre). \`jusqua\` : journée exclue.
 */
export function patronsActifs(decisions = [], jusqua = Infinity) {
  const par = new Map();
  for (const d of [...decisions].filter(x => x && x.patron && x.patron.cle).sort((a, b) => (a.jour || 0) - (b.jour || 0))) {
    if ((d.jour || 0) >= jusqua) continue;
    const role = d.patron.role || (PATRONS[d.patron.cle] || {}).role;
    for (const r of d.patron.remplace || []) for (const [k, v] of par) if (v.cle === r) par.delete(k);
    par.set(role, { ...d.patron, role, jour: d.jour });
  }
  return [...par.values()];
}
/* Ce que les patrons engagés changent à la boutique (la décision d'engagement porte \`econ\`). */
export function modificateurs(decisions = [], jusqua = Infinity) {
  const m = { rabais: 1, holo: 1, carteExtra: 0, sansBase: false, jetonsVictoire: [], jetonsLancee: [] };
  // v2 : un coach qui a la confiance du vestiaire change la boutique comme un patron (le Comptable).
  for (const p of [...patronsActifs(decisions, jusqua), ...coachsActifs(decisions, jusqua)]) {
    const e = p.econ || {};
    if (e.rabais) m.rabais *= e.rabais;
    if (e.holo) m.holo *= e.holo;
    if (e.carteExtra) m.carteExtra += e.carteExtra;
    if (e.sansBase) m.sansBase = true;
    if (e.jetonsVictoire) m.jetonsVictoire.push({ depuis: p.jour || 0, n: e.jetonsVictoire, cle: p.cle });
    if (e.jetonsLancee) m.jetonsLancee.push({ depuis: p.jour || 0, n: e.jetonsLancee, cle: p.cle });
  }
  return m;
}

/*
 * CE QU'UNE CARTE DE COACH VAUT AUJOURD'HUI (v2) : son effet, plus `echelle.par`
 * pour chaque carte de son coach déjà jouée (`build`, au plus `max`) — et ses
 * jetons (`gain`, plus `echelle.gain` par carte). Une carte sans échelle rend
 * son effet tel quel. Les chiffres entrent dans la décision.
 */
function grandi(X, coach, build = {}, joueurs = {}) {
  const effet = { ...(X.effet || {}) };
  let gain = X.gain || 0;
  const ajouter = (par, n) => { for (const [k, v] of Object.entries(par || {})) effet[k] = Math.round(((effet[k] ?? (k === 'robustesse' ? 0 : 1)) + v * n) * 10000) / 10000; };
  const E = X.echelle;
  const n = E ? Math.min(E.max || Infinity, (build && build[X.coach || coach]) || 0) : 0;
  if (n) { ajouter(E.par, n); gain += (E.gain || 0) * n; }
  // v2 : ses JOUEURS — ceux de la couleur de la carte, habillés quand on la joue.
  const J = X.parJoueur;
  const nj = J ? Math.min(J.max || Infinity, ((joueurs && joueurs[X.coach || coach]) || {}).joueurs || 0) : 0;
  if (nj) ajouter(J.par, nj);
  return { effet, gain, n, nj };
}
/*
 * LA DÉCISION D'UNE CARTE JOUÉE : les champs que le moteur connaît, et ses
 * chiffres. \`cible\` : { joueur, tactique, carte }. \`patrons\` : ceux déjà
 * engagés (pour le remplacement et la synergie). \`sel\` : de quoi tirer un
 * pari (le billet de loterie), pur.
 */
export function payloadDe(id, { joueur = null, tactique = null, carte = null, coach = null, patrons = [], alea = null, build = {}, joueurs = {} } = {}) {
  const c = carteBanque(id);
  if (!c) return null;
  if (c.cat === 'patron') {
    const P = PATRONS[c.cle];
    const effet = grandi(P, c.coach, build, joueurs).effet;
    let synergie = false;
    if (P.synergie && patrons.some(x => x.role === P.synergie.avec)) {
      synergie = true;
      for (const [k, v] of Object.entries(P.synergie.effet)) effet[k] = k === 'robustesse' ? (effet[k] || 0) + v : (effet[k] ?? 1) * v;
    }
    const remplace = patrons.filter(x => x.role === P.role && x.cle !== c.cle).map(x => x.cle);
    return { patron: { cle: c.cle, role: P.role, nom: P.nom, ico: P.ico, ...effet, ...(P.econ ? { econ: { ...P.econ } } : {}), ...(synergie ? { synergie: true } : {}), ...(remplace.length ? { remplace } : {}) } };
  }
  if (c.cat === 'evenement') {
    const E = EVENEMENTS[c.cle];
    const { effet, gain } = grandi(E, c.coach, build, joueurs);
    return { effet: { nom: E.nom, ico: E.ico, duree: E.duree, ...effet, ...(E.regle ? { regle: true } : {}) }, ...(E.gestes ? { gestes: { ...E.gestes } } : {}), ...(gain ? { gain } : {}) };
  }
  if (c.cat === 'joueur') return joueur ? { mutation: { cle: c.cle, joueur } } : null;
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    const effet = C.effet ? { nom: C.nom, ico: C.ico, duree: C.duree, ...grandi(C, c.coach, build, joueurs).effet, ...(C.regle ? { regle: true } : {}) } : null;
    if (C.cible === 'blesse' || C.cible === 'joueur') {
      if (!joueur) return null;
      return { gestes: { ...C.gestes, joueurs: [joueur] }, ...(effet ? { effet } : {}) };
    }
    if (C.cible === 'malediction') return carte ? { deck: 'menage', retrait: carte } : null;
    if (C.cible === 'carteMatch') return carte ? { deck: 'camp', aiguise: carte } : null;
    if (C.cible === 'tactique') return tactique ? { deck: 'strategie', maitrise: { tac: tactique, gain: C.maitrise } } : null;
    if (C.cible === 'coach') return coach && COACHS[coach] ? coachNeuf(coach) : null;
    const out = {};
    if (C.gestes) out.gestes = { ...C.gestes };
    if (effet) out.effet = effet;
    if (C.gain) out.gain = C.gain;
    if (C.pari) out.gain = alea !== null && alea < C.pari.chance ? C.pari.gain : 0;
    return out;
  }
  if (c.cat === 'plafond') {
    const C = CONTRATS[c.cle];
    if (C.cible !== 'aucune' && !joueur) return null;
    return { plafond: { cle: c.cle, nom: C.nom, ...(C.espace ? { espace: C.espace } : {}), ...(C.facteur ? { facteur: C.facteur } : {}),
      ...(C.ltir ? { ltir: true } : {}), ...(C.cout ? { cout: C.cout } : {}), ...(joueur ? { joueur } : {}) } };
  }
  if (c.cat === 'match') return { recompense: c.cle };
  if (c.cat === 'saison') return { carte: c.cle };
  return null;
}

/* =====================================================================
   LE BUILD (v2) — les coachs que tes cartes jouées font croire au vestiaire
   ===================================================================== */
/* Le coach d'une carte de la banque (une carte « + » du deck lit sa carte de base), ou null (neutre). */
export const coachDeCarte = id => { const c = BANQUE[id] || BANQUE[String(id).replace(/\+$/, '')]; return c ? c.coach : null; };
export const idsDuCoach = coach => Object.values(BANQUE).filter(c => c.coach === coach && !c.retire).map(c => c.id);
/* La carte qu'une décision fait jouer : l'inventaire, le personnel, le deck (`joue.id`), ou la carte d'un gros match (`recompense`). */
/* Les cartes qu'une décision fait JOUER : la carte jouée de la main ou du personnel, et (V5) les cartes de match
 * jouées dans la main d'un gros match. Une carte de match achetée en pack ou gagnée en récompense entre au deck
 * sans compter : c'est la jouer qui fait croire le vestiaire (docs/refonte-v5.md, phase 0). Une carte de match
 * « Au deck » d'une partie d'avant oct. (`joue.src === 'partie'` avec `recompense`) ne compte pas non plus. */
const cartesJouees = d => [
  ...(d.joue && d.joue.id && !(d.recompense && d.joue.src === 'partie') ? [d.joue.id] : []),
  ...(d.main && Array.isArray(d.main.jouees) ? d.main.jouees.map(k => `match:${String(k).replace(/\+$/, '')}`) : []),
];
/*
 * LE COMPTE DE CHAQUE COACH à une journée (`jusqua` exclue), pur : le report
 * d'une run (`coachsDeBase` : la saison d'avant, et le coach choisi au
 * départ), plus chaque carte jouée de sa couleur. Rend { cle: n }.
 */
/*
 * UNE CARTE DE MATCH COMPTE UNE FOIS (V5, la run de JP gagnée du premier coup) : rejouée à chaque gros match, elle
 * comptait à chaque fois — « Changements » joué huit fois montait le Doc à III, « Bloquer » la Tortue, sans qu'on bâtisse
 * rien. Une carte de match compte la première fois qu'elle est jouée, et celles du deck de départ (`DECK_DEPART`) ne
 * comptent pas : elles sont à tout le monde. `vues` : les cartes de match déjà comptées.
 */
const quiComptent = (d, vues) => cartesJouees(d).filter(id => {
  if (!id.startsWith('match:')) return true;
  if (vues.has(id) || DECK_DEPART.includes(id.slice(6))) return false;
  vues.add(id);
  return true;
});
export function buildDe(decisions = [], jusqua = Infinity, vues = new Set()) {
  const n = Object.fromEntries(ORDRE_COACHS.map(k => [k, 0]));
  for (const d of decisions) {
    if (!d || (d.jour || 0) >= jusqua) continue;
    if (d.coachsDeBase) for (const [k, v] of Object.entries(d.coachsDeBase)) if (k in n) n[k] += v || 0;
    // UN COACH NEUF (« Le virage », ou un autre choisi au début d'une saison) repart à la confiance I : ses cartes d'avant ne comptent plus.
    if (d.coachNeuf && d.coach && d.coach.cle in n) n[d.coach.cle] = SEUILS[0];
    for (const id of quiComptent(d, vues)) { const e = coachDeCarte(id); if (e) n[e]++; }
  }
  return n;
}
/*
 * LE COACH EN POSTE (V5, JP : *juste un coach peut être actif à la fois* ; *le coach, choisi au début de la saison,
 * ou changé avec une carte qui enlève l'autre bonus*). Un seul : la dernière confiance posée. Rend [] ou [coach].
 */
export function coachsActifs(decisions = [], jusqua = Infinity) {
  let dernier = null;
  for (const d of decisions) {
    if (!d || !d.coach || !d.coach.cle || (d.jour || 0) >= jusqua) continue;
    if (!dernier || (d.jour || 0) >= dernier.jour) dernier = { ...d.coach, jour: d.jour || 0 };
  }
  return dernier ? [dernier] : [];
}
/* La décision d'un coach neuf : sa confiance I, et son compte qui repart (`coachNeuf`). */
export const coachNeuf = cle => ({ coach: effetDePalier(cle, 1), coachNeuf: true });
/*
 * LA CONFIANCE QU'ALLUME UNE CARTE : la décision `d` fait-elle franchir un
 * seuil au coach de sa carte ? Rend `{ coach }` à ajouter à la décision (les
 * chiffres de la confiance atteinte), ou null. Pur : les décisions d'avant et
 * celle-ci.
 */
export function palierAllume(decisions = [], d) {
  // Le premier coach dont les cartes de cette décision (un pack en porte plusieurs) font franchir un seuil.
  const ajout = {}, vues = new Set();
  const build = buildDe(decisions, Infinity, vues);
  for (const id of d ? quiComptent(d, vues) : []) { const k = coachDeCarte(id); if (k) ajout[k] = (ajout[k] || 0) + 1; }
  // Seul le coach en poste monte (V5) : les cartes d'une autre couleur jouent leur effet, sans changer de coach.
  const [actif] = coachsActifs(decisions);
  const e = actif ? (ajout[actif.cle] && palierDe(build[actif.cle] + ajout[actif.cle]) > actif.palier ? actif.cle : null)
    : Object.keys(ajout).find(k => palierDe(build[k] + ajout[k]) > palierDe(build[k]));
  if (!e) return null;
  const p = palierDe(build[e] + ajout[e]);
  // La confiance II fait apprendre son système à tes avants (le stage de système, une décision `maitrise`).
  const sys = p === 2 && COACHS[e].systeme;
  return { coach: effetDePalier(e, p), ...(sys ? { maitrise: { tac: sys, gain: GAIN_SYSTEME } } : {}) };
}
/* Ce qu'une confiance fait, en mots — les canaux, les minutes, la boutique. */
export function reglesDePalier(cle, palier) {
  const P = effetDePalier(cle, palier);
  if (!P) return [];
  const { cle: _c, palier: _p, nom: _n, ico: _i, econ, plafonds, ...canaux } = P;
  void _c; void _p; void _n; void _i;
  const out = [...motsEnChiffres(canaux)];
  // V2.3 : la III relève le plafond du canal que la voie vise (js/sim.js `plafondsDe`).
  const MOT_PLAFOND = { finition: 'Plafond de précision relevé', pression: 'Plafond des tirs relevé', robustesse: 'Plafond de robustesse relevé', discipline: 'Plancher des punitions abaissé' };
  for (const [k, v] of Object.entries(plafonds || {})) if (v) out.push({ txt: MOT_PLAFOND[k], bon: true });
  if (econ && econ.rabais) out.push({ txt: `Packs ${Math.round((econ.rabais - 1) * 100)} %`, bon: true });
  if (econ && econ.jetonsVictoire) out.push({ txt: `+${econ.jetonsVictoire} 🪙 par victoire`, bon: true });
  if (econ && econ.plafond) out.push({ txt: `Plafond salarial +${Math.round(econ.plafond * 100)} %`, bon: true });
  const sys = palier === 2 && COACHS[cle].systeme && systemeDe(COACHS[cle].systeme);
  if (sys) out.push({ txt: `Tes ${sys.groupe === 'D' ? 'défenseurs' : 'avants'} apprennent ${sys.ico} ${sys.nom} (+${Math.round(GAIN_SYSTEME * 100)} % de maîtrise), et le jouent chacun un cran plus haut (Bronze → Argent…)`, bon: true });
  return out;
}
