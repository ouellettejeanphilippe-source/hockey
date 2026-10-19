/**
 * LA BANQUE DE CARTES (S79 ; le jeu neuf de la V10, docs/refonte-v10.md).
 *
 * JP : *créer une vraie banque de cartes […] digne d'un vrai deck builder* ; puis (V10) *jeter toutes les cartes et
 * créer de zéro avec la nouvelle philosophie en tête*.
 *
 * UN SEUL REGISTRE pour tout ce qui se joue, en quatre piles : le CAHIER (les cartes de match, CARTES_MATCH,
 * js/combat.js, nées de js/cahier.js), les PLACES (les consommables, js/places.js), l'ÉQUIPEMENT (les changements de
 * carte d'un joueur, MUTATIONS, js/equipement.js) et le PERSONNEL (les patrons, js/personnel.js), plus les contrats du
 * plafond. Presque chaque carte attend son MOMENT (`si`, `MOMENTS_SI`, js/sim.js). Chaque carte a un identifiant
 * (\`cat:cle\`), une catégorie, une rareté, une durée de vie, et sa RÈGLE en chiffres de match (\`reglesDe\`) :
 * « ≈ +0,2 but marqué par match », « ≈ −2 blessures par saison », jamais un pourcentage, jamais « un peu ».
 *
 * RIEN DE NEUF DANS LE MOTEUR. Une carte jouée est une DÉCISION (\`payloadDe\`) faite des champs que
 * \`appliquerDecision\` connaît déjà : \`effet\` (des canaux d'équipe pour quelques matchs), \`mutation\` (un joueur),
 * \`recompense\` (une carte de match au deck), \`retrait\` et \`aiguise\` (le deck), \`patron\` (le personnel, séries
 * comprises) et \`gestes\` (un soin, de l'énergie). La décision porte ses CHIFFRES : une partie reprise rejoue exactement
 * ce qui a été joué, même si la banque change entre-temps.
 *
 * LES POIDS (mesurés) : 1 % de précision ou de tirs ≈ 0,18 victoire sur une saison, 1 % de buts contre ≈ 0,24 à 0,32,
 * un point de robustesse ≈ 0,5. Chaque carte se mesure en paires, sur les soirs de son moment (`check_places`,
 * `check_cartes`).
 */
import { MUTATIONS, EDITIONS_REGLEMENT, MOMENTS_SI } from './sim.js';
import { PLACES_NEUVES } from './places.js';
import { PERSONNEL, CONTRATS_MAUDITS } from './personnel.js';
import { motsEnChiffres, motsDeMutationEnChiffres } from './impact.js';
import { formeDe } from './gerant.js';
import { CARTES_MATCH, estPlus, DECK_DEPART } from './combat.js';
import { money, hache } from './util.js';
import { NIVEAUX } from './niveaux.js';
import { CONSOMMABLES_VIE, CONTRATS_VIE, RARETE_MODIFS_VIE } from './cartes-vie.js';
import { COACHS, ORDRE_COACHS, coachDesCanaux, palierDe, effetDePalier, SEUILS } from './coachs.js';

export const CATEGORIES = {
  patron: { ico: '👔', nom: 'Patrons', un: 'Patron', mot: 'Le personnel : un effet pour toute la saison, séries comprises. Un poste par rôle ; deux postes au départ, le prestige en ouvre d\'autres.' },
  joueur: { ico: '🧬', nom: 'Modifs de joueurs', un: 'Modif de joueur', mot: 'Un style, une clause, une amélioration ou une retouche de l\'atelier : elle se pose au verso d\'un joueur de ton choix, pour la saison.' },
  consommable: { ico: '🧴', nom: 'Consommables', un: 'Consommable', mot: 'Une utilisation : un soin, des jambes, le filet, les minutes, des jetons, le deck, ou un trou dans le règlement.' },
  match: { ico: '🃏', nom: 'Cartes de match', un: 'Carte de match', mot: 'Ton deck des gros matchs et des séries : jouée, elle entre dans le deck.' },
  plafond: { ico: '💵', nom: 'Masse salariale', un: 'Contrat', mot: 'Le plafond salarial se manipule, comme dans la vraie LNH : de l\'espace, une retenue, un blessé à long terme, un rachat.' },
};
export const ORDRE_CATEGORIES = ['patron', 'joueur', 'consommable', 'plafond', 'match'];

/* ---------- LES PATRONS : le personnel, des reliques ---------- */

export const ROLES = {
  chef: { nom: 'Entraîneur-chef', ico: '🧑‍💼' },
  attaque: { nom: 'Adjoint à l\'attaque', ico: '🎯' },
  defense: { nom: 'Adjoint à la défensive', ico: '❄' },
  gardiens: { nom: 'Entraîneur des gardiens', ico: '🥅' },
  physique: { nom: 'Préparateur physique', ico: '🏋' },
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
  // V10 (tranche 6) : le personnel d'avant est parti. Restent le DG du plafond flexible (un déblocage le donne) et le
  // vendeur de chandails (une pièce du premier combo, la lancée : `check_combo`).
  dir_chandails: { role: 'direction', nom: 'Le vendeur de chandails', ico: '🛍', rarete: 'rare', texte: 'Un joueur en feu, et les chandails partent par boîtes.',
    econ: { jetonsLancee: 1 } },
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
  ...PERSONNEL,
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
  retenue: { nom: 'Retenue salariale', ico: '✂', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.65, texte: 'Son ancien club paie une part de son salaire.' },
  ltir: { nom: 'Blessé à long terme', ico: '🏥', rarete: 'peu', vie: 'usage', cible: 'blesse', ltir: true, texte: 'Son salaire sort du plafond tant qu\'il est à l\'infirmerie.' },
  rachat: { nom: 'Rachat de contrat', ico: '🧾', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.833, cout: 10, texte: 'Le reste de son contrat étalé : moins cette saison, 10 jetons de frais.' },
  entree: { nom: 'Le contrat d\'entrée', ico: '🐣', rarete: 'commune', vie: 'usage', cible: 'recrue', facteur: 0.72, texte: 'Une recrue sous contrat d\'entrée compte pour moins.' },
  bonis: { nom: 'La clause de bonis', ico: '🎯', rarete: 'commune', vie: 'usage', cible: 'joueur', facteur: 0.895, texte: 'Une part de son salaire devient des bonis de performance, hors du plafond.' },
  enterre: { nom: 'Le contrat enterré', ico: '🗃', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.86, texte: 'Une part de son salaire est réputée au club-école. Il compte pour moins, et il joue encore.' },
  // v2 : cinq de plus.
  aRabais: { nom: 'Le contrat à rabais', ico: '🏷', rarete: 'commune', vie: 'usage', cible: 'joueur', facteur: 0.93, texte: 'Il signe sous sa valeur pour courir après une bague.' },
  clubEcole: { nom: 'Le passage au club-école', ico: '🚍', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.825, cout: 5, texte: 'Trois jours dans la ligue américaine, le temps que la paperasse passe. 5 jetons de frais.' },
  anticipee: { nom: 'La prolongation anticipée', ico: '✍', rarete: 'peu', vie: 'usage', cible: 'joueur', facteur: 0.895, texte: 'Signé un an d\'avance, à l\'ancien prix.' },
  hausse: { nom: 'La hausse du plafond', ico: '🆙', rarete: 'rare', vie: 'permanent', cible: 'aucune', espace: 3_000_000, texte: 'Les revenus de la ligue montent : le plafond aussi.' },
  signature: { nom: 'Le bonus de signature', ico: '🖊', rarete: 'commune', vie: 'usage', cible: 'aucune', espace: 1_500_000, texte: 'Payé d\'avance, cet été : il ne compte plus cette saison.' },
  ...CONTRATS_VIE,
  // Les contrats lourds (V10, tranche 4) : l'argent tout de suite, un prix certains soirs.
  ...CONTRATS_MAUDITS,
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

/* V10 (tranche 6) : les événements ont quitté la banque ; ce qui arrive au club est un dossier d'À faire (js/dossiers.js). */

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
  chirurgie: { nom: 'La chirurgie éclair', ico: '🏥', rarete: 'rare', vie: 'permanent', cible: 'blesse', gestes: { soin: 12 }, effet: { blessure: 1.56 }, duree: 5, texte: 'Le meilleur chirurgien a une plage libre. Le retour presse, et les corps le paient.' },
  exorciste: { nom: 'L\'exorciste', ico: '🕯', rarete: 'rare', vie: 'permanent', cible: 'malediction', texte: 'Il chasse une malédiction de ton deck de match.' },
  campExpress: { nom: 'Le camp express', ico: '⛺', rarete: 'peu', vie: 'usage', cible: 'carteMatch', texte: 'Une carte de ton deck de match devient sa version « + ».' },
  // ---- v2 : treize de plus ----
  ruban: { nom: 'Le ruban magique', ico: '🎗', rarete: 'commune', vie: 'usage', cible: 'blesse', gestes: { soin: 3 }, effet: { blessure: 1.35 }, duree: 3, texte: 'Trois rouleaux autour de la cheville, et il retourne au jeu.' },
  aiguilles: { nom: 'L\'acupuncteur', ico: '🪡', rarete: 'peu', vie: 'usage', cible: 'blesse', gestes: { soin: 4 }, texte: 'Quarante aiguilles, et le dos se replace.' },
  /*
   * v2 — LES CARTES DE VESTIAIRE : une par coach (le Comptable n'a pas de
   * joueurs), qui grandit avec les JOUEURS de sa couleur habillés quand on la
   * joue (`parJoueur`, js/coachs.js `coachDesRoles`) : cinq snipers font de
   * « La clé du coin supérieur » une vraie semaine. Des cartes de joueurs qui
   * font vivre des cartes de banque.
   */
  ...CONSOMMABLES_VIE,
  // Les places neuves (V10, tranche 3 — js/places.js) : chacune attend un moment de la semaine.
  ...PLACES_NEUVES,
  // V5 : comme dans la LNH, on change de coach en cours de saison en congédiant l'entraîneur — le nouveau arrive avec
  // sa philosophie, à la confiance I, et l'ancienne part avec son bonus. Le seul chemin vers un autre coach en saison.
  congediement: { nom: 'Le congédiement', ico: '📋', rarete: 'peu', vie: 'usage', cible: 'coach', texte: 'L\'entraîneur vide son bureau au matin. Le nouveau arrive avec son cahier de jeux, et tout est à rebâtir.' },
  /*
   * LE RAPPEL DU CLUB-ÉCOLE (Jalon P3). JP : *ajouter des cartes qui permettent de piger dans tes cartes pour signer* ;
   * *les cartes sont genre le club-école*. Trois joueurs de TON cartable (`offres`), au plus de leur niveau
   * (`niveauMax`, js/niveaux.js), sous le plafond ; un se signe comme au ballottage (une décision `ballottage`).
   */
  rappel: { nom: 'Le rappel du club-école', ico: '📟', rarete: 'commune', vie: 'usage', cible: 'cartable', offres: 3, niveauMax: 1, texte: 'Un coup de fil à la ferme : trois de tes cartes répondent.' },
  rappelPilier: { nom: 'Le rappel d\'un pilier', ico: '📟', rarete: 'rare', vie: 'usage', cible: 'cartable', offres: 3, niveauMax: 2, texte: 'Celui-là, il n\'aurait jamais dû descendre.' },
  // Le retour d'un ancien (P3) : trois cartes de ton cartable qui ont porté tes couleurs dans une run d'avant (`anciens`).
  // L'échange d'un doublon (P3) : ton doublon le plus fourni part ; trois joueurs de la même série de cartons, hors de ton cartable (`echange`).
  echangeDoublon: { nom: 'L\'échange d\'un doublon', ico: '📟', rarete: 'peu', vie: 'usage', cible: 'cartable', offres: 3, niveauMax: 2, echange: true, texte: 'Un doublon de trop, contre un joueur de sa série.' },
  rappelAncien: { nom: 'Le retour d\'un ancien', ico: '📟', rarete: 'peu', vie: 'usage', cible: 'cartable', offres: 3, niveauMax: 2, anciens: true, texte: 'Il a déjà porté tes couleurs. Il connaît le vestiaire.' },
};

/* Un effet de contrat lourd tient la saison : plus que ses 82 matchs, séries comprises. */
const DUREE_SAISON = 120;
/* ---------- LES MODIFS DE JOUEURS : des MUTATIONS au joueur de ton choix ---------- */
const SOURCES_MOD = ['atelier', 'contrat', 'equipement'];
/* V10 (tranche 6) : l'ancien jeu est parti — les améliorations, les styles, l'atelier générique. Restent l'équipement, les
 * retouches d'édition, les modifs d'un moment d'avant, le feu qui s'entretient et les clauses de contrat. */
const RARETE_MOD = {
  pinceau: 'commune', fenetre: 'peu', dorure: 'rare', lustre: 'legendaire', mentorTrio: 'rare',
  domicile: 'peu', route: 'peu', printemps: 'rare', etincelle: 'rare', braise: 'rare', poudre: 'rare',
  contrat_annee: 'peu', contrat_prolonge: 'commune', contrat_bonus: 'rare', contrat_leader: 'rare',
  ...RARETE_MODIFS_VIE,
};
// Le mentor (`mentorTrio`) n'est pas une carte : il vient du choix d'un fil (js/vie-gm.js `CHOIX_DES_FILS`).
const MODS_JOUEUR = Object.keys(MUTATIONS).filter(k => SOURCES_MOD.includes(MUTATIONS[k].source) && !MUTATIONS[k].mentor);

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
  // V9 (tranche 7) : une modif offerte pour la saison seulement (`saison`, le vétéran mentor d'un fil) ne prend pas de case.
  return decisions.filter(d => d && d.mutation && d.mutation.joueur === joueur && sePose(d.mutation.cle) && !d.mutation.saison)
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
  if (cat === 'joueur') return lu({ mutation: MUTATIONS[cle] });
  if (cat === 'consommable') { const C = CONSOMMABLES[cle]; return C.coach || lu({ effet: C.effet, gestes: C.gestes, gain: C.gain, pari: C.pari }); }
  if (cat === 'plafond') return 'banque';
  if (cat === 'match') {
    const C = CARTES_MATCH[cle];
    if (C.synergie && SYNERGIES[C.synergie]) return SYNERGIES[C.synergie];
    // Le cahier neuf (V10, js/cahier.js) : le deck de départ est neutre ; un pari est au Comptable.
    if (DECK_DEPART.includes(cle)) return null;
    if (C.si && C.pari) return 'banque';
    const e = { ...(C.effet || {}) };
    // Une carte sur un joueur (V11) : ses tirs se lisent comme les tirs du club, le reste sur le même canal.
    const surLui = C.joueur && { volume: C.joueur.lancers, finition: C.joueur.finition, defense: C.joueur.defense, blessure: C.joueur.blessure };
    for (const x of [C.parGenre && C.parGenre.effet, C.selonLeurMain && C.selonLeurMain.effet, C.apres40 && C.apres40.siMene, C.pari && C.pari.gagne, C.improvise, C.piege, C.siVide, surLui]) {
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
  for (const cle of MODS_JOUEUR) {
    const M = MUTATIONS[cle];
    mettre(fait('joueur', cle, { nom: M.nom, ico: M.ico, rarete: RARETE_MOD[cle] || M.rarete || 'peu', texte: M.quoi, vie: 'saison', gardien: !!M.gardien, source: M.source }));
  }
  for (const [cle, C] of Object.entries(CONSOMMABLES)) mettre(fait('consommable', cle, { nom: C.nom, ico: C.ico, rarete: C.rarete, texte: C.texte, vie: C.vie, cible: C.cible, ...(C.regle ? { regle: true } : {}), ...(C.echange ? { echange: true } : {}) }));
  for (const [cle, C] of Object.entries(CONTRATS)) mettre(fait('plafond', cle, { nom: C.nom, ico: C.ico, rarete: C.rarete, texte: C.texte, vie: C.vie, cible: C.cible }));
  for (const [cle, C] of Object.entries(CARTES_MATCH)) {
    // V10 : la main de l'adversaire n'est pas une carte de la banque (js/combat.js `adverse`).
    if (estPlus(cle) || C.adverse) continue;
    mettre(fait('match', cle, { nom: C.nom, ico: C.ico, rarete: C.rarete, texte: C.texte, vie: 'saison', cout: C.cout, genre: C.genre }));
  }
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
  if (C.cible === 'coach') return 'Coach';
  if (C.cible === 'cartable') return 'Rappel';
  if (C.gain) return 'Jetons';
  if (g.gardienAux) return 'Filet';
  if (g.soin) return 'Soin';
  if (g.energie || g.energieTous) return 'Jambes';
  if (!bits.length) return '';
  if (bits.every(Boolean)) return 'Cadeau';
  return 'Moindre mal';
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
/*
 * LA PLACE D'UNE CARTE (V8). JP : *chaque chose sous-entend ce à quoi elle sert ; c'est pas clair comment jouer les
 * cartes*. Où elle agit, combien de temps, et le verbe de son bouton — lus sur la carte (sa catégorie, sa cible, sa vie).
 */
const CIBLE_MOT = { joueur: 'un joueur', blesse: 'un blessé', recrue: 'une recrue' };
export function placeDe(id) {
  const c = carteBanque(id);
  if (!c) return null;
  const sur = CIBLE_MOT[c.cible];
  const duree = c.vie === 'usage' ? 'une fois' : c.vie === 'permanent' ? 'pour de bon' : c.duree ? `${c.duree} matchs` : 'la saison';
  if (c.cat === 'joueur') return { ou: 'Sur un joueur', duree: 'la saison', verbe: 'Poser sur un joueur' };
  if (c.cat === 'patron') return { ou: 'Ton personnel', duree: 'toute la run', verbe: 'Engager' };
  if (c.cat === 'match') return { ou: 'Ton deck de match', duree: 'les gros matchs', verbe: 'Mettre au deck' };
  if (sur) return { ou: c.cat === 'plafond' ? `Le contrat d'${sur}` : `Sur ${sur}`, duree, verbe: `Choisir ${sur}` };
  if (c.cat === 'plafond') return { ou: 'Ton plafond', duree, verbe: 'Signer la clause' };
  if (c.cible === 'malediction' || c.cible === 'carteMatch') return { ou: 'Ton deck de match', duree, verbe: 'Choisir la carte' };
  if (c.cible === 'coach') return { ou: 'Ton coach', duree, verbe: 'Choisir le coach' };
  if (c.cible === 'cartable') return { ou: 'Ton cartable', duree, verbe: 'Choisir le joueur' };
  return { ou: 'Ton équipe', duree, verbe: 'Jouer pour l\'équipe' };
}
export function etiquetteBanque(id) {
  const c = carteBanque(id);
  if (!c) return '';
  if (c.cat === 'joueur') return (c.regle || EDITIONS_REGLEMENT.includes(c.cle)) ? 'Règlement' : '';
  if (c.regle) return 'Règlement';
  if (c.cat === 'match') return formeDe({ genreCarte: c.genre, dessin: c.cle });
  if (c.cat === 'patron') {
    const P = PATRONS[c.cle] || {};
    return formeDe({ effet: P.effet || {} }) || (P.econ ? 'Boutique' : '');
  }
  if (c.cat === 'consommable') return formeDeConsommable(CONSOMMABLES[c.cle]);
  if (c.cat === 'plafond') return formeDePlafond(CONTRATS[c.cle]);
  return '';
}
/* Les cartes d'une famille. V10 (tranche 6) : l'ancien jeu est parti, chaque carte de la banque se tire. */
export const idsDe = cat => Object.values(BANQUE).filter(c => c.cat === cat).map(c => c.id);
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
  garde: { nom: 'Se garde', ico: '⏳', mot: 'À une place jusqu\'à ce que tu la joues.' },
  immediat: { nom: 'Jouée immédiatement', ico: '⚡', mot: 'Jouée immédiatement : elle s\'applique dès que tu la reçois.' },
};

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
    // V10 : son moment d'abord.
    const out = [...(P.si && MOMENTS_SI[P.si] ? [{ txt: `${MOMENTS_SI[P.si].mot} : ses soirs, toute la saison`, bon: null, duree: true }] : []), ...motsEnChiffres(P.effet || {})];
    const e = P.econ || {};
    if (e.rabais) out.push({ txt: `Packs ${Math.round((e.rabais - 1) * 100)} %`, bon: true });
    if (e.jetonsVictoire) out.push({ txt: `+${e.jetonsVictoire} 🪙 par victoire`, bon: true });
    if (e.jetonsLancee) out.push({ txt: `+${e.jetonsLancee} 🪙 par joueur sur sa lancée, chaque soir`, bon: true });
    if (e.holo) out.push({ txt: `Packs de joueurs : Or ou mieux +${Math.round((e.holo - 1) * 100)} %`, bon: true });
    if (e.carteExtra) out.push({ txt: `Packs de joueurs : +${e.carteExtra} carte`, bon: true });
    if (e.sansBase) out.push({ txt: 'Packs de joueurs : jamais une carte de base', bon: true });
    if (e.plafond) out.push({ txt: `Plafond salarial +${Math.round(e.plafond * 100)} %`, bon: true });
    if (P.synergie) out.push({ txt: `Avec ${ROLES[P.synergie.avec].nom.toLowerCase()} : ${motsEnChiffres(P.synergie.effet).map(x => x.txt).join(', ')}`, bon: true });
    if (P.echelle) out.push(motDEchelle(P.echelle, c.coach));
    if (!P.si) out.push({ txt: 'Toute la saison, séries comprises', bon: null, duree: true });
    return out;
  }
  if (c.cat === 'joueur') return motsDeMutationEnChiffres(c.cle, joueur);
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    const out = [...motsDesGestes(C.gestes || {})];
    // V10 : son moment d'abord, et ses chiffres un soir de ce moment.
    if (C.si && MOMENTS_SI[C.si]) out.push({ txt: `${MOMENTS_SI[C.si].mot} : ses soirs, les ${C.duree} prochains matchs`, bon: null, duree: true }, ...motsEnChiffres(C.effet || {}));
    else if (C.effet) out.push(...motsEnChiffres(C.effet, C.duree));
    if (C.gain) out.push({ txt: `+${C.gain} 🪙`, bon: true });
    if (C.pari) out.push({ txt: `${Math.round(C.pari.chance * 100)} % : +${C.pari.gain} 🪙`, bon: true });
    if (C.cible === 'malediction') out.push({ txt: 'Retire 1 malédiction du deck', bon: true });
    if (C.cible === 'carteMatch') out.push({ txt: '1 carte du deck devient « + »', bon: true });
    if (C.cible === 'coach') out.push({ txt: 'Un autre coach, à la confiance I', bon: true }, { txt: 'Ton coach part, avec sa confiance', bon: false });
    if (C.cible === 'cartable') out.push({ txt: `${C.offres} joueurs de ton cartable, ${NIVEAUX[C.niveauMax].nom} au plus : un signé`, bon: true });
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
    if (C.effet && C.si && MOMENTS_SI[C.si]) out.push({ txt: `${MOMENTS_SI[C.si].mot} : ses soirs, toute la saison`, bon: null, duree: true }, ...motsEnChiffres(C.effet));
    return out;
  }
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
/* « jusqu'à ≈ +0,4 pt de précision par match avec 5 joueurs de l'Aigle habillés » : ce qu'une carte gagne de tes joueurs. */
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
 * chiffres. \`cible\` : { joueur, carte }. \`patrons\` : ceux déjà
 * engagés (pour le remplacement et la synergie). \`sel\` : de quoi tirer un
 * pari (le billet de loterie), pur.
 */
export function payloadDe(id, { joueur = null, carte = null, coach = null, patrons = [], alea = null, build = {}, joueurs = {}, sortie = null, rar = null } = {}) {
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
    return { patron: { cle: c.cle, role: P.role, nom: P.nom, ico: P.ico, ...effet, ...(P.si ? { si: P.si } : {}), ...(P.econ ? { econ: { ...P.econ } } : {}), ...(synergie ? { synergie: true } : {}), ...(remplace.length ? { remplace } : {}) } };
  }
  if (c.cat === 'joueur') return joueur ? { mutation: { cle: c.cle, joueur } } : null;
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    // V10 : une place d'un moment (`si`) porte son moment sur son effet ; le moteur ne le joue que ses soirs (`joueCeSoir`).
    const effet = C.effet ? { nom: C.nom, ico: C.ico, duree: C.duree, ...grandi(C, c.coach, build, joueurs).effet, ...(C.regle ? { regle: true } : {}), ...(C.si ? { si: C.si } : {}) } : null;
    if (C.cible === 'blesse' || C.cible === 'joueur') {
      if (!joueur) return null;
      return { gestes: { ...C.gestes, joueurs: [joueur] }, ...(effet ? { effet } : {}) };
    }
    if (C.cible === 'malediction') return carte ? { deck: 'menage', retrait: carte } : null;
    if (C.cible === 'carteMatch') return carte ? { deck: 'camp', aiguise: carte } : null;
    if (C.cible === 'coach') return coach && COACHS[coach] ? coachNeuf(coach) : null;
    // Le rappel : le joueur du cartable entre à la case que `sortie` libère, comme au ballottage.
    if (C.cible === 'cartable') return joueur ? { ballottage: { entre: joueur, i: sortie ? sortie.i : null, sort: sortie ? sortie.sort : null, ...(rar ? { rar } : {}) }, ...(sortie && sortie.cases ? { cases: sortie.cases } : {}) } : null;
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
      ...(C.ltir ? { ltir: true } : {}), ...(C.cout ? { cout: C.cout } : {}), ...(joueur ? { joueur } : {}) },
      // V10 : un contrat lourd porte son prix, certains soirs, toute la saison.
      ...(C.effet ? { effet: { nom: C.nom, ico: C.ico, duree: DUREE_SAISON, ...C.effet, ...(C.si ? { si: C.si } : {}) } } : {}) };
  }
  if (c.cat === 'match') return { recompense: c.cle };
  return null;
}

/* =====================================================================
   LE BUILD (v2) — les coachs que tes cartes jouées font croire au vestiaire
   ===================================================================== */
/* Le coach d'une carte de la banque (une carte « + » du deck lit sa carte de base), ou null (neutre). */
export const coachDeCarte = id => { const c = BANQUE[id] || BANQUE[String(id).replace(/\+$/, '')]; return c ? c.coach : null; };
export const idsDuCoach = coach => Object.values(BANQUE).filter(c => c.coach === coach).map(c => c.id);
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
  return { coach: effetDePalier(e, p) };
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
  // V9 : à sa confiance II et III, son plan compte plus fort (`COACH_DU_PLAN`, js/sim.js).
  if (palier >= 2 && COACHS[cle].familles) out.push({ txt: 'Son plan compte plus fort', bon: true });
  return out;
}
