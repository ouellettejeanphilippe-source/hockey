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
 * chiffres (\`reglesDe\`) : « Précision +3 % », « Blessures −35 % », jamais
 * « un peu ».
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
import { CARTES, MUTATIONS, motsDEffet, motsDeMutation } from './sim.js';
import { CARTES_MATCH, estPlus } from './combat.js';

export const CATEGORIES = {
  patron: { ico: '👔', nom: 'Patrons', un: 'Patron', mot: 'Le personnel : un effet pour toute la saison, séries comprises. Trois postes au plus, un par rôle.' },
  evenement: { ico: '📰', nom: 'Événements', un: 'Événement', mot: 'Ce qui arrive à ton équipe : quelques journées, un bonus et son prix.' },
  joueur: { ico: '🧬', nom: 'Modifs de joueurs', un: 'Modif de joueur', mot: 'Un style, un contrat, une amélioration ou une édition : au joueur de ton choix, pour la saison.' },
  consommable: { ico: '🧴', nom: 'Consommables', un: 'Consommable', mot: 'Un soin, de l\'énergie, des jetons, un coup de pouce au deck : une utilisation.' },
  match: { ico: '🃏', nom: 'Cartes de match', un: 'Carte de match', mot: 'Ton deck des gros matchs et des séries : jouée, elle entre dans le deck.' },
  saison: { ico: '📘', nom: 'Cartes de saison', un: 'Carte de saison', mot: 'Un réglage pour toute la saison : un bonus payé par un malus.' },
};
export const ORDRE_CATEGORIES = ['patron', 'evenement', 'joueur', 'consommable', 'match', 'saison'];
export const RARETES_BANQUE = ['commune', 'peu', 'rare', 'legendaire', 'maudite'];

/* ---------- LES PATRONS : le personnel, des reliques ---------- */
export const MAX_PATRONS = 3;
export const ROLES = {
  chef: { nom: 'Entraîneur-chef', ico: '🧑‍💼' },
  attaque: { nom: 'Adjoint à l\'attaque', ico: '🎯' },
  defense: { nom: 'Adjoint à la défensive', ico: '🛡️' },
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
    effet: { defense: 0.975, finition: 0.99 }, synergie: { avec: 'defense', effet: { defense: 0.99 } } },
  chef_motivateur: { role: 'chef', nom: 'Le motivateur', ico: '📣', rarete: 'peu', texte: 'Ses discours entre les périodes sont restés célèbres.',
    effet: { finition: 1.03, discipline: 1.08 }, synergie: { avec: 'attaque', effet: { finition: 1.01 } } },
  chef_legende: { role: 'chef', nom: 'La légende derrière le banc', ico: '🏆', rarete: 'legendaire', texte: 'Neuf bagues de la Coupe, et il le rappelle au besoin.',
    effet: { finition: 1.015, defense: 0.985, robustesse: 0.3 } },
  att_adjoint: { role: 'attaque', nom: 'L\'adjoint à l\'attaque', ico: '🏒', rarete: 'commune', texte: 'Il fait tirer tout le monde après les pratiques.',
    effet: { volume: 1.025 } },
  att_avantage: { role: 'attaque', nom: 'Le spécialiste de l\'avantage', ico: '⚡', rarete: 'peu', texte: 'Son avantage numérique a un nom de code.',
    effet: { finition: 1.03, volume: 0.99 } },
  att_transition: { role: 'attaque', nom: 'Le maître des transitions', ico: '🔀', rarete: 'rare', texte: 'La rondelle sort de la zone en deux passes.',
    effet: { volume: 1.04, finition: 1.01, energie: 1.03 } },
  def_adjoint: { role: 'defense', nom: 'L\'adjoint à la défensive', ico: '🧱', rarete: 'commune', texte: 'Il revoit chaque but accordé, image par image.',
    effet: { defense: 0.985 } },
  def_inferiorite: { role: 'defense', nom: 'Le spécialiste de l\'infériorité', ico: '🦺', rarete: 'peu', texte: 'Quatre joueurs en losange, et un bâton dans chaque couloir.',
    effet: { defense: 0.98, discipline: 0.93 } },
  def_systeme: { role: 'defense', nom: 'Le gourou du système', ico: '🕸️', rarete: 'rare', texte: 'Personne ne sait expliquer son système. Personne ne passe.',
    effet: { defense: 0.965, volume: 0.985 } },
  gar_technicien: { role: 'gardiens', nom: 'Le technicien des gardiens', ico: '🥅', rarete: 'commune', texte: 'Des angles, des angles, des angles.',
    effet: { defense: 0.99 } },
  gar_psy: { role: 'gardiens', nom: 'Le psychologue des gardiens', ico: '🧠', rarete: 'peu', texte: 'Le but d\'hier n\'existe plus.',
    effet: { defense: 0.98, blessure: 0.95 } },
  gar_maitre: { role: 'gardiens', nom: 'Le maître des gardiens', ico: '🧤', rarete: 'rare', texte: 'Il a formé trois gagnants du Vézina.',
    effet: { defense: 0.97 }, synergie: { avec: 'defense', effet: { defense: 0.99 } } },
  phy_cardio: { role: 'physique', nom: 'Le préparateur cardio', ico: '🫀', rarete: 'commune', texte: 'Vélo stationnaire après chaque match.',
    effet: { energie: 0.95 } },
  phy_force: { role: 'physique', nom: 'Le préparateur en force', ico: '🏋️', rarete: 'peu', texte: 'Squats, et encore des squats.',
    effet: { robustesse: 0.5, energie: 1.02 } },
  phy_elite: { role: 'physique', nom: 'Le préparateur d\'élite', ico: '🥇', rarete: 'rare', texte: 'Il a préparé une équipe olympique.',
    effet: { energie: 0.92, robustesse: 0.3 }, synergie: { avec: 'soins', effet: { blessure: 0.9 } } },
  soi_soigneur: { role: 'soins', nom: 'Le soigneur', ico: '🩹', rarete: 'commune', texte: 'Du ruban, de la glace, et il connaît tout le monde.',
    effet: { blessure: 0.8 } },
  soi_therapeute: { role: 'soins', nom: 'Le thérapeute du sport', ico: '💆', rarete: 'peu', texte: 'Il voit la blessure venir avant le joueur.',
    effet: { blessure: 0.65 } },
  soi_medecin: { role: 'soins', nom: 'Le médecin-chef', ico: '⚕️', rarete: 'rare', texte: 'Une clinique à lui tout seul.',
    effet: { blessure: 0.5, robustesse: 0.2 } },
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
  dir_magnat: { role: 'direction', nom: 'Le magnat', ico: '🎩', rarete: 'legendaire', texte: 'Il a acheté l\'équipe pour la gagner.',
    effet: { finition: 1.01 }, econ: { jetonsVictoire: 3, rabais: 0.9 } },
};

/* ---------- LES ÉVÉNEMENTS D'ÉQUIPE : quelques journées ---------- */
/* \`duree\` en journées ; les canaux comme les moments (\`effet\` d'une décision). */
export const EVENEMENTS = {
  voyage: { nom: 'Le voyage dans l\'Ouest', ico: '✈️', rarete: 'commune', duree: 8, texte: 'Trois villes, cinq fuseaux horaires, un seul autobus.', effet: { finition: 1.03, energie: 1.06 } },
  souper: { nom: 'Le souper d\'équipe', ico: '🍝', rarete: 'commune', duree: 7, texte: 'Le capitaine paie la facture.', effet: { finition: 1.02, discipline: 0.95 } },
  video: { nom: 'La séance vidéo', ico: '📼', rarete: 'commune', duree: 6, texte: 'Quatre heures dans le noir.', effet: { defense: 0.97, volume: 0.98 } },
  rumeur: { nom: 'La rumeur d\'échange', ico: '📱', rarete: 'peu', duree: 10, texte: 'Tout le monde lit les journaux.', effet: { finition: 0.97, volume: 1.05 } },
  hopital: { nom: 'La visite à l\'hôpital', ico: '🏥', rarete: 'commune', duree: 7, texte: 'Des sourires qui valent tous les trophées.', effet: { finition: 1.02, defense: 0.99 } },
  chandail: { nom: 'Le chandail retiré', ico: '🎖️', rarete: 'peu', duree: 3, texte: 'Une bannière monte au plafond.', effet: { finition: 1.05, defense: 0.97 } },
  tempete: { nom: 'La tempête de neige', ico: '🌨️', rarete: 'commune', duree: 5, texte: 'Pratiques annulées : tout le monde dort.', effet: { energie: 0.85, finition: 0.98 } },
  bagarre: { nom: 'La bagarre à l\'entraînement', ico: '🥊', rarete: 'peu', duree: 8, texte: 'Ça a brassé. Ça brasse encore.', effet: { robustesse: 1, discipline: 1.2, blessure: 1.2 } },
  arbitres: { nom: 'La réunion avec les arbitres', ico: '🦓', rarete: 'commune', duree: 10, texte: 'On a compris ce qu\'ils siffleront.', effet: { discipline: 0.85 } },
  veteran: { nom: 'Le vétéran parle', ico: '🧓', rarete: 'peu', duree: 10, texte: 'Dix minutes, porte fermée.', effet: { defense: 0.98, discipline: 0.92 } },
  huisClos: { nom: 'La réunion à huis clos', ico: '🚪', rarete: 'peu', duree: 6, texte: 'On a entendu crier jusque dans le corridor.', effet: { finition: 1.04, blessure: 1.1 } },
  relache: { nom: 'La semaine de relâche', ico: '🏖️', rarete: 'peu', duree: 3, texte: 'Une semaine au soleil.', effet: { finition: 0.99 }, gestes: { energieTous: 20 } },
  campMiSaison: { nom: 'Le camp de mi-saison', ico: '🏕️', rarete: 'rare', duree: 12, texte: 'Deux jours dans le bois, sans téléphone.', effet: { finition: 1.02, defense: 0.98, energie: 1.08 } },
  nouveauChandail: { nom: 'Le nouveau chandail', ico: '👕', rarete: 'commune', duree: 5, texte: 'Le troisième chandail, enfin sorti.', effet: { finition: 1.03, discipline: 1.05 } },
  gala: { nom: 'La soirée de gala', ico: '🎆', rarete: 'peu', duree: 4, texte: 'Les anciens sont dans les estrades.', effet: { finition: 1.04, volume: 1.02, energie: 1.05 } },
  controverse: { nom: 'La controverse', ico: '📰', rarete: 'maudite', duree: 8, texte: 'Une photo de trop sur les réseaux.', effet: { finition: 0.97, discipline: 1.1 } },
  grippe: { nom: 'La grippe au vestiaire', ico: '🤧', rarete: 'maudite', duree: 6, texte: 'Un joueur tousse. Puis tous.', effet: { energie: 1.15, blessure: 1.2 } },
  recrueSurprise: { nom: 'La recrue surprise', ico: '🌱', rarete: 'peu', duree: 10, texte: 'Rappelé du club-école, il ne veut plus repartir.', effet: { volume: 1.03, energie: 0.97 } },
  pacte: { nom: 'Le pacte', ico: '🤞', rarete: 'rare', duree: 15, texte: 'Personne ne se rase avant la fin de la séquence.', effet: { defense: 0.97, finition: 1.02, blessure: 1.1 } },
  retourBlesse: { nom: 'Le retour au jeu', ico: '🔙', rarete: 'commune', duree: 5, texte: 'Le physio donne le feu vert plus tôt que prévu.', effet: { finition: 1.01 }, gestes: { soin: 2, tousLesBlesses: true } },
  derby: { nom: 'La semaine du derby', ico: '⚔️', rarete: 'peu', duree: 3, texte: 'Personne n\'a oublié le dernier match.', effet: { finition: 1.05, robustesse: 0.5, discipline: 1.15 } },
  domicile: { nom: 'La série à domicile', ico: '🏠', rarete: 'commune', duree: 8, texte: 'Huit soirs dans son lit.', effet: { volume: 1.03, energie: 0.95 } },
  anciens: { nom: 'Le banquet des anciens', ico: '🍷', rarete: 'peu', duree: 10, texte: 'Les histoires de 1971 font le tour de la table.', effet: { robustesse: 0.5, defense: 0.99 } },
  photo: { nom: 'La photo d\'équipe', ico: '📸', rarete: 'commune', duree: 5, texte: 'Tout le monde en complet, les cheveux peignés.', effet: { discipline: 0.9, finition: 1.01 } },
  engueulade: { nom: 'Le coach sort de ses gonds', ico: '🤬', rarete: 'peu', duree: 5, texte: 'Un bâton cassé sur le banc.', effet: { finition: 1.05, discipline: 1.1, blessure: 1.05 } },
  brunch: { nom: 'Le brunch des familles', ico: '🥞', rarete: 'commune', duree: 7, texte: 'Les enfants dans le vestiaire.', effet: { energie: 0.94, volume: 0.99 } },
  public: { nom: 'L\'oeil du public', ico: '👁️', rarete: 'rare', duree: 10, texte: 'Chaque match est télévisé d\'un océan à l\'autre.', effet: { finition: 1.03, defense: 0.98, energie: 1.05 } },
  arena: { nom: 'Le déménagement d\'aréna', ico: '🏟️', rarete: 'peu', duree: 6, texte: 'La glace neuve est rapide.', effet: { volume: 1.04, defense: 1.02 } },
};

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
  chirurgie: { nom: 'La chirurgie éclair', ico: '🏥', rarete: 'rare', vie: 'permanent', cible: 'blesse', gestes: { soin: 12 }, texte: 'Le meilleur chirurgien du pays a une plage libre.' },
  infirmerie: { nom: 'La ronde de l\'infirmerie', ico: '🩺', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { soin: 2, tousLesBlesses: true }, texte: 'Le médecin passe voir tout le monde.' },
  boisson: { nom: 'La boisson énergétique', ico: '🥤', rarete: 'commune', vie: 'usage', cible: 'joueur', gestes: { energie: 25 }, texte: 'Bleue, et on ne veut pas savoir ce qu\'il y a dedans.' },
  bainGlace: { nom: 'Le bain de glace', ico: '🛁', rarete: 'commune', vie: 'usage', cible: 'aucune', gestes: { energieTous: 6 }, texte: 'Personne n\'aime ça. Tout le monde le fait.' },
  conge: { nom: 'La journée de congé', ico: '🛌', rarete: 'peu', vie: 'usage', cible: 'aucune', gestes: { energieTous: 12 }, texte: 'Pas de patin, pas de gym, pas de vidéo.' },
  hyperbare: { nom: 'La chambre hyperbare', ico: '🫧', rarete: 'rare', vie: 'permanent', cible: 'joueur', gestes: { energie: 40, energieTous: 8 }, texte: 'Une heure dans le tube, et il repart comme en septembre.' },
  cure: { nom: 'La cure thermale', ico: '♨️', rarete: 'peu', vie: 'permanent', cible: 'aucune', effet: { blessure: 0.6 }, duree: 10, texte: 'Dix jours de sources chaudes pour les corps usés.' },
  enveloppe: { nom: 'L\'enveloppe brune', ico: '✉️', rarete: 'peu', vie: 'usage', cible: 'aucune', gain: 20, texte: 'On ne pose pas de question.' },
  coffre: { nom: 'Le coffre du proprio', ico: '🧰', rarete: 'rare', vie: 'permanent', cible: 'aucune', gain: 40, texte: 'Le proprio a trouvé la clé.' },
  billet: { nom: 'Le billet de loterie', ico: '🎟️', rarete: 'commune', vie: 'usage', cible: 'aucune', pari: { chance: 0.5, gain: 30 }, texte: 'Une chance sur deux de gratter 30 jetons.' },
  exorciste: { nom: 'L\'exorciste', ico: '🕯️', rarete: 'rare', vie: 'permanent', cible: 'malediction', texte: 'Il chasse une malédiction de ton deck de match.' },
  campExpress: { nom: 'Le camp express', ico: '⛺', rarete: 'peu', vie: 'usage', cible: 'carteMatch', texte: 'Une carte de ton deck de match devient sa version « + ».' },
  stageExpress: { nom: 'Le stage express', ico: '📘', rarete: 'peu', vie: 'usage', cible: 'tactique', maitrise: 0.25, texte: 'Ta formation fait 25 % du chemin vers la maîtrise d\'un système.' },
};

/* ---------- LES MODIFS DE JOUEURS : des MUTATIONS au joueur de ton choix ---------- */
const SOURCES_MOD = ['amelioration', 'atelier', 'style', 'contrat'];
const RARETE_MOD = {
  affute: 'peu', moteur: 'peu', mur: 'peu', vision: 'peu', coach: 'peu',
  partout: 'rare', cran: 'rare', physio: 'peu', lustre: 'legendaire',
  style_sniper: 'peu', style_faiseur: 'peu', style_ancre: 'peu', style_locomotive: 'peu', style_chasseur: 'peu',
  style_architecte: 'rare', style_sentinelle: 'rare', style_canonnier: 'rare', style_buteur: 'legendaire', style_pieuvre: 'rare',
  masque_neuf: 'commune', baton_neuf: 'commune', contrat_annee: 'peu', contrat_prolonge: 'commune', contrat_bonus: 'rare', contrat_leader: 'rare',
};
export const MODS_JOUEUR = Object.keys(MUTATIONS).filter(k => SOURCES_MOD.includes(MUTATIONS[k].source));

/* ---------- LE REGISTRE ---------- */
const fait = (cat, cle, def) => ({ id: `${cat}:${cle}`, cat, cle, ...def });
function construire() {
  const B = {};
  const mettre = c => { B[c.id] = c; };
  for (const [cle, P] of Object.entries(PATRONS)) mettre(fait('patron', cle, { nom: P.nom, ico: P.ico, rarete: P.rarete, texte: P.texte, vie: 'permanent', role: P.role }));
  for (const [cle, E] of Object.entries(EVENEMENTS)) mettre(fait('evenement', cle, { nom: E.nom, ico: E.ico, rarete: E.rarete, texte: E.texte, vie: 'saison', duree: E.duree }));
  for (const cle of MODS_JOUEUR) {
    const M = MUTATIONS[cle];
    mettre(fait('joueur', cle, { nom: M.nom, ico: M.ico, rarete: RARETE_MOD[cle] || 'peu', texte: M.quoi, vie: 'saison', gardien: !!M.gardien, source: M.source }));
  }
  for (const [cle, C] of Object.entries(CONSOMMABLES)) mettre(fait('consommable', cle, { nom: C.nom, ico: C.ico, rarete: C.rarete, texte: C.texte, vie: C.vie, cible: C.cible }));
  for (const [cle, C] of Object.entries(CARTES_MATCH)) {
    if (estPlus(cle)) continue;
    mettre(fait('match', cle, { nom: C.nom, ico: C.ico, rarete: C.rarete, texte: C.texte, vie: 'saison', cout: C.cout, genre: C.genre }));
  }
  for (const [cle, C] of Object.entries(CARTES)) mettre(fait('saison', cle, { nom: C.nom, ico: C.ico, rarete: 'rare', texte: `${C.bon}. ${C.prix}.`, vie: 'saison' }));
  return B;
}
export const BANQUE = construire();
export const carteBanque = id => BANQUE[id] || null;
export const idsDe = cat => Object.values(BANQUE).filter(c => c.cat === cat).map(c => c.id);
export const compteParCategorie = () => Object.fromEntries(ORDRE_CATEGORIES.map(c => [c, idsDe(c).length]));

/* Les étiquettes de durée de vie, telles que l'inventaire les affiche. */
export const VIES = {
  permanent: { nom: 'Permanent', mot: 'Reste dans ton inventaire tant que tu ne t\'en sers pas, d\'une run à l\'autre.' },
  saison: { nom: 'Cette saison', mot: 'Vaut pour la saison en cours ; elle expire à la fin de la run.' },
  usage: { nom: '1 utilisation', mot: 'S\'use en la jouant, cette saison.' },
};

/*
 * LA RÈGLE EN CHIFFRES d'une carte : des mots \`{ txt, bon }\`, les mêmes que
 * partout (\`motsDEffet\`, \`motsDeMutation\`). Les cartes de match ont la leur
 * (\`optionDeCarteMatch\`, js/gerant.js) : l'écran la lit là.
 */
export function reglesDe(id) {
  const c = carteBanque(id);
  if (!c) return [];
  if (c.cat === 'patron') {
    const P = PATRONS[c.cle];
    const out = [...motsDEffet(P.effet || {})];
    const e = P.econ || {};
    if (e.rabais) out.push({ txt: `Packs ${Math.round((e.rabais - 1) * 100)} %`, bon: true });
    if (e.jetonsVictoire) out.push({ txt: `+${e.jetonsVictoire} 🪙 par victoire`, bon: true });
    if (e.holo) out.push({ txt: `Packs de joueurs : holo ou mieux +${Math.round((e.holo - 1) * 100)} %`, bon: true });
    if (e.carteExtra) out.push({ txt: `Packs de joueurs : +${e.carteExtra} carte`, bon: true });
    if (e.sansBase) out.push({ txt: 'Packs de joueurs : jamais une carte de base', bon: true });
    if (P.synergie) out.push({ txt: `Avec ${ROLES[P.synergie.avec].nom.toLowerCase()} : ${motsDEffet(P.synergie.effet).map(x => x.txt).join(', ')}`, bon: true });
    out.push({ txt: 'Toute la saison, séries comprises', bon: null, duree: true });
    return out;
  }
  if (c.cat === 'evenement') {
    const E = EVENEMENTS[c.cle];
    const out = motsDEffet(E.effet || {}, E.duree);
    if (E.gestes) out.unshift(...motsDesGestes(E.gestes));
    return out;
  }
  if (c.cat === 'joueur') return motsDeMutation(c.cle);
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    const out = [...motsDesGestes(C.gestes || {})];
    if (C.effet) out.push(...motsDEffet(C.effet, C.duree));
    if (C.gain) out.push({ txt: `+${C.gain} 🪙`, bon: true });
    if (C.pari) out.push({ txt: `${Math.round(C.pari.chance * 100)} % : +${C.pari.gain} 🪙`, bon: true });
    if (C.maitrise) out.push({ txt: `Maîtrise d'un système +${Math.round(C.maitrise * 100)} %`, bon: true });
    if (C.cible === 'malediction') out.push({ txt: 'Retire 1 malédiction du deck', bon: true });
    if (C.cible === 'carteMatch') out.push({ txt: '1 carte du deck devient « + »', bon: true });
    return out;
  }
  if (c.cat === 'saison') return motsDEffet(CARTES[c.cle]);
  return [];
}
function motsDesGestes(g) {
  const out = [];
  if (g.soin) out.push({ txt: `${g.tousLesBlesses ? 'Tous tes blessés' : 'Un blessé'} : −${g.soin} match${g.soin > 1 ? 's' : ''} d'infirmerie`, bon: true });
  if (g.energie) out.push({ txt: `Un joueur : énergie +${g.energie}`, bon: true });
  if (g.energieTous) out.push({ txt: `Tes patineurs : énergie +${g.energieTous}`, bon: true });
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
  const m = { rabais: 1, holo: 1, carteExtra: 0, sansBase: false, jetonsVictoire: [] };
  for (const p of patronsActifs(decisions, jusqua)) {
    const e = p.econ || {};
    if (e.rabais) m.rabais *= e.rabais;
    if (e.holo) m.holo *= e.holo;
    if (e.carteExtra) m.carteExtra += e.carteExtra;
    if (e.sansBase) m.sansBase = true;
    if (e.jetonsVictoire) m.jetonsVictoire.push({ depuis: p.jour || 0, n: e.jetonsVictoire, cle: p.cle });
  }
  return m;
}

/*
 * LA DÉCISION D'UNE CARTE JOUÉE : les champs que le moteur connaît, et ses
 * chiffres. \`cible\` : { joueur, tactique, carte }. \`patrons\` : ceux déjà
 * engagés (pour le remplacement et la synergie). \`sel\` : de quoi tirer un
 * pari (le billet de loterie), pur.
 */
export function payloadDe(id, { joueur = null, tactique = null, carte = null, patrons = [], alea = null } = {}) {
  const c = carteBanque(id);
  if (!c) return null;
  if (c.cat === 'patron') {
    const P = PATRONS[c.cle];
    const effet = { ...(P.effet || {}) };
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
    return { effet: { nom: E.nom, ico: E.ico, duree: E.duree, ...(E.effet || {}) }, ...(E.gestes ? { gestes: { ...E.gestes } } : {}) };
  }
  if (c.cat === 'joueur') return joueur ? { mutation: { cle: c.cle, joueur } } : null;
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    if (C.cible === 'blesse' || C.cible === 'joueur') { if (!joueur) return null; return { gestes: { ...C.gestes, joueurs: [joueur] } }; }
    if (C.cible === 'malediction') return carte ? { deck: 'menage', retrait: carte } : null;
    if (C.cible === 'carteMatch') return carte ? { deck: 'camp', aiguise: carte } : null;
    if (C.cible === 'tactique') return tactique ? { deck: 'strategie', maitrise: { tac: tactique, gain: C.maitrise } } : null;
    const out = {};
    if (C.gestes) out.gestes = { ...C.gestes };
    if (C.effet) out.effet = { nom: C.nom, ico: C.ico, duree: C.duree, ...C.effet };
    if (C.gain) out.gain = C.gain;
    if (C.pari) out.gain = alea !== null && alea < C.pari.chance ? C.pari.gain : 0;
    return out;
  }
  if (c.cat === 'match') return { recompense: c.cle };
  if (c.cat === 'saison') return { carte: c.cle };
  return null;
}
