/**
 * LE DECK DE MATCH (S74) — des cartes qu'on JOUE, pas qu'on subit.
 *
 * JP : *prends vraiment inspiration d'un jeu de deckbuilder avec choix et
 * cartes d'effets et autres, mais avec un simulateur de hockey en plus, et
 * fais une énorme variété de possibilités* ; *quand y'a un choix, c'est un
 * fullscreen modal pis ça se passe là, sauf si carte à utiliser plus tard* ;
 * *pense vraiment à un kid qui joue avec ses cartes Upper Deck comme si
 * c'était Slay the Spire*.
 *
 * LA BOUCLE, celle de Slay the Spire, posée sur le hockey :
 *   - tu commences la saison avec un DECK DE DÉPART de dix cartes simples
 *     (lancer, bloquer, changements courts, le discours du capitaine, la
 *     vidéo de l'adversaire) ;
 *   - avant chaque GROS MATCH et chaque match de tes SÉRIES, tu piges une
 *     MAIN de cinq cartes et tu as TROIS D'ÉNERGIE pour en jouer ;
 *   - une victoire dans un gros match te donne une RÉCOMPENSE (une carte
 *     parmi trois, ou passer) ; gagner une série, une carte plus rare ;
 *   - le ménage du vestiaire (une carte de palier) en RETIRE une ;
 *   - un objectif raté du proprio glisse une MALÉDICTION dans ton deck.
 *
 * CE QU'UNE CARTE FAIT EST RÉEL, et c'est le moteur qui le joue (js/sim.js,
 * `effetsDesCartes`) : un canal d'effet pour CE match (finition, volume,
 * défensive, discipline, énergie, robustesse, les minutes des lignes), un
 * effet sur l'ADVERSAIRE (ses punitions, son énergie, sa finition), son plan
 * de match qui tombe (« La vidéo »), tes deux premières lignes qui jouent son
 * contre, un pari tiré de la graine, de l'énergie rendue à tes joueurs, ou
 * une synergie qui lit ta formation (tes snipers, tes défenseurs défensifs,
 * tes lignes qui jouent le même système). Rien ne se lit d'une cote.
 *
 * TOUT EST PUR. Le deck se DÉDUIT des décisions (récompenses, retraits,
 * malédictions) ; la main d'un match se tire de la graine et du match ; les
 * récompenses offertes aussi. Une partie reprise retrouve les mêmes mains.
 */
import { hache } from './util.js';

export const ENERGIE_MAIN = 3;
export const TAILLE_MAIN = 5;
/* Les cicatrices (le doute, une blessure qui traîne) qu'un deck porte au plus, en même temps (1.0). */
export const CICATRICES_MAX = 2;

/*
 * Les cartes. `cout` en énergie ; `effet` : les canaux de CE match pour ta
 * formation ; `adv` : ceux de l'adversaire ; `pioche` : cartes de plus dans
 * la main ; `energiePlus` : énergie de plus ce match ; `lire` : son plan
 * tombe ; `contre` : tes deux premières lignes jouent le contre de son plan ;
 * `energieTous` : de l'énergie rendue à tes patineurs avant le match ;
 * `pari` : une chance, ce qu'on gagne, ce qu'on perd ; `synergie` : un effet
 * qui se calcule sur ta formation ; `maudite` : une malédiction ;
 * `injouable` : elle encombre la main ; `enMain` : ce qu'elle coûte si elle
 * est dans ta main au match.
 *
 * LES MATHS SE LISENT (S76). JP : *les cartes manquent de variété, aussi,
 * faudrait des maths plus claires sur les effets, comme dans un vrai
 * deckbuilder*. `texte` n'est plus que l'ambiance ; la RÈGLE, chiffrée, se
 * déduit des champs (`regleDeCarte`) — « Tirs +6 % », « Pige 2 cartes »,
 * « Eux : punitions +25 % » — et `regle` ne s'écrit à la main que pour une
 * carte conditionnelle. Et de nouvelles MÉCANIQUES, pas seulement de
 * nouveaux pourcentages :
 *   `apres40`       (1.0) un effet posé à la troisième période seulement, selon le
 *                   pointage après deux : `siMene` quand on mène, `sinon` autrement ;
 *   `ecarte`        le dépistage écarte N plans qu'ils ne joueront pas ;
 *   `revele`        tu SAIS leur plan : ta préparation vise juste ;
 *   `planB`         ta préparation couvre deux plans ;
 *   `improvise`     si ta préparation rate : pas de malus, et cet effet ;
 *   `piege`         si elle vise juste : cet effet de plus ;
 *   `parGenre`      un effet par carte de ce genre jouée ce match ;
 *   `selonLeurMain` un effet par carte de ce genre dans LEUR main ;
 *   `siVide`        un effet si tu dépenses toute ton énergie ;
 *   `rabais`        les cartes de ce genre coûtent 1 de moins ce match ;
 *   `epuise`        jouée, elle quitte ton deck pour le reste de la course.
 */
export const CARTES_MATCH = {
  // ---- le deck de départ ----
  lancer: { nom: 'Lancer de la pointe', ico: '🏒', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Les défenseurs décochent à la moindre ouverture.', effet: { volume: 1.06 } },
  bloquer: { nom: 'Bloquer des tirs', ico: '🛡️', cout: 1, rarete: 'commune', genre: 'defense',
    texte: 'Tout le monde se jette devant la rondelle.', effet: { defense: 0.95 } },
  changements: { nom: 'Changements courts', ico: '⏱️', cout: 0, rarete: 'commune', genre: 'tactique',
    texte: 'Des présences de trente secondes : des jambes fraîches toute la soirée.', effet: { energie: 0.9 } },
  discours: { nom: 'Le discours du capitaine', ico: '🧭', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Il se lève, et le vestiaire se tait.', pioche: 2 },
  // LE DÉPISTAGE (S76) : la vidéo n'abat plus leur plan, elle ÉCARTE une piste
  // du rapport — c'est à toi de viser juste avec ce qui reste.
  video: { nom: 'La vidéo de l\'adversaire', ico: '📼', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Trois soirs de leurs matchs, image par image.', ecarte: 1 },

  // ---- communes ----
  echecAvant: { nom: 'Échec avant', ico: '🥊', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'On va chercher la rondelle dans leur zone.', effet: { volume: 1.08, discipline: 1.1 } },
  trappe: { nom: 'La trappe', ico: '🧊', cout: 1, rarete: 'commune', genre: 'defense',
    texte: 'Cinq joueurs en zone neutre. Personne ne passe.', effet: { defense: 0.93, volume: 0.95 } },
  sagesse: { nom: 'Pas de punition bête', ico: '🧘', cout: 0, rarete: 'commune', genre: 'defense',
    texte: 'Les bâtons en bas, les mains à soi.', effet: { discipline: 0.8 } },
  frapper: { nom: 'On frappe tout ce qui bouge', ico: '🦍', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Chaque présence, une mise en échec.', effet: { robustesse: 1.4, discipline: 1.1 } },
  partout: { nom: 'Tirer de partout', ico: '🎯', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Tout ce qui ressemble à un angle, on lance.', effet: { volume: 1.1, finition: 0.97 } },
  retour: { nom: 'Au filet pour le retour', ico: '🥅', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Deux joueurs dans l\'enclave, à chaque lancer.', effet: { finition: 1.05, energie: 1.05 } },
  conge: { nom: 'Matinée de congé', ico: '😴', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Pas de patin ce matin, les jambes reposent.', energieTous: 15 },
  prudence: { nom: 'Jouer de prudence', ico: '🔒', cout: 0, rarete: 'commune', genre: 'defense',
    texte: 'On ne force rien.', effet: { defense: 0.97, finition: 0.97 } },
  provoquer: { nom: 'Les provoquer', ico: '😈', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Un mot de trop après chaque sifflet : ils vont au banc des punitions.', adv: { discipline: 1.25 } },
  quatrieme: { nom: 'Le trio de plombiers', ico: '🔋', cout: 0, rarete: 'commune', genre: 'tactique',
    texte: 'Ton quatrième trio joue plus, et tes vedettes respirent.', effet: { F: [0.95, 0.95, 1, 1.25], energie: 0.93 } },
  enclave: { nom: 'Devant le filet', ico: '🏗️', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Un gros bonhomme plante sa tente devant leur gardien.', effet: { finition: 1.04, robustesse: 1.2 } },
  poignets: { nom: 'Le tir des poignets', ico: '🌀', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Vite, précis, sans élan : le gardien ne le voit pas partir.', effet: { finition: 1.03, volume: 1.03 } },
  blitz: { nom: 'Le blitz', ico: '⚡', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Tout de suite, tout le monde : on veut les sortir du match avant qu\'ils y entrent.', effet: { volume: 1.12, energie: 1.12 } },
  presse: { nom: 'La conférence de presse', ico: '🎤', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Tu as dit ce qu\'il fallait dire la veille : ils jouent crispés.', adv: { discipline: 1.12, finition: 0.98 } },

  // ---- peu communes ----
  doublePresence: { nom: 'Double présence', ico: '🔥', cout: 1, rarete: 'peu', genre: 'attaque',
    texte: 'Ta première ligne saute sur la glace un tour sur deux.', effet: { F: [1.3, 1, 0.9, 0.8], energie: 1.05 } },
  // Le contre parfait (S74) devient le PLAN B (S76) : deux pistes préparées au lieu d'une.
  contrePlan: { nom: 'Le plan B', ico: '🧠', cout: 1, rarete: 'peu', genre: 'tactique',
    texte: 'Deux cahiers de jeux sur le tableau du vestiaire.', planB: true },
  gardienFeu: { nom: 'Le gardien en feu', ico: '🧤', cout: 2, rarete: 'peu', genre: 'defense',
    texte: 'Il a vu la rondelle grosse comme un ballon toute la journée.', effet: { defense: 0.92 } },
  avantage: { nom: 'L\'avantage numérique en or', ico: '💥', cout: 2, rarete: 'peu', genre: 'attaque',
    texte: 'Le jeu de puissance répété toute la semaine.', effet: { finition: 1.07 } },
  systeme: { nom: 'Le système maison', ico: '📘', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Tout le monde connaît sa case les yeux fermés.', regle: 'Si deux de tes lignes jouent le même système : précision +6 %.', synergie: 'systeme' },
  gachettes: { nom: 'Les gâchettes', ico: '🎯', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Ils ne passent pas : ils lancent.', regle: 'Précision +2 % par sniper dans tes deux premiers trios (jusqu\'à +6 %).', synergie: 'gachettes' },
  murBleu: { nom: 'Le mur bleu', ico: '🧱', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Trois défenseurs qui ne montent jamais.', regle: 'Buts contre −2 % par défenseur pur habillé (jusqu\'à −6 %).', synergie: 'mur' },
  jambes: { nom: 'Les jambes', ico: '⚡', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Ça part en contre-attaque avant la ligne rouge.', regle: 'Tirs +2 % par patineur rapide dans ton top 6 (jusqu\'à +8 %).', synergie: 'jambes' },
  // LES CARTES D'ORIGINE (1.0) : JP, *des cartes qui activent bonus s'il même équipe*. Elles lisent d'où viennent tes joueurs
  // (js/sim.js `originesDe`) ; l'alignement montre la puce d'une unité qui les déclenche. `origine` : l'adversaire ne les joue
  // pas — une vraie équipe est tout entière d'un club et d'une saison, elle les aurait toutes au maximum.
  coequipiers: { nom: 'Les vrais coéquipiers', ico: '👬', cout: 1, rarete: 'peu', genre: 'synergie', origine: true,
    texte: 'Ils ont gagné ensemble pour vrai : ils savent où l\'autre sera.', regle: 'Précision +2 % par paire de vrais coéquipiers (même club, même saison) dans tes deux premiers trios et tes deux premières paires (jusqu\'à +6 %).', synergie: 'coequipiers' },
  famille: { nom: 'La même famille', ico: '🎽', cout: 1, rarete: 'peu', genre: 'synergie', origine: true,
    texte: 'Le même chandail, d\'une génération à l\'autre.', regle: 'Buts contre −2 % par joueur habillé de ta franchise la plus nombreuse, à partir du troisième (jusqu\'à −6 %).', synergie: 'famille' },
  decennie: { nom: 'La décennie', ico: '🕰️', cout: 1, rarete: 'peu', genre: 'synergie', origine: true,
    texte: 'Ils ont appris le même hockey.', regle: 'Tirs +2 % par trio dont les trois joueurs sont de la même décennie (jusqu\'à +8 %).', synergie: 'decennie' },
  vieilleGarde: { nom: 'La vieille garde', ico: '🪖', cout: 1, rarete: 'peu', genre: 'synergie', origine: true,
    texte: 'Ils ont tout vu, et ils ne paniquent plus.', regle: 'Buts contre −1 % par joueur habillé de 31 ans et plus (jusqu\'à −6 %).', synergie: 'vieilleGarde' },
  releve: { nom: 'La relève', ico: '🔰', cout: 1, rarete: 'peu', genre: 'synergie', origine: true,
    texte: 'Des jambes de vingt ans.', regle: 'Tirs +1 % par joueur habillé de 23 ans et moins (jusqu\'à +8 %).', synergie: 'releve' },
  ligneOrigine: { nom: 'La ligne d\'origine', ico: '🧩', cout: 1, rarete: 'rare', genre: 'synergie', origine: true,
    texte: 'La ligne telle qu\'elle a joué, remontée d\'un bloc.', regle: 'Tirs +4 % et précision +2 % par ligne d\'origine — un trio ou une paire d\'un même club, la même saison (jusqu\'à deux lignes).', synergie: 'ligneOrigine' },
  des: { nom: 'Coup de dés', ico: '🎲', cout: 0, rarete: 'peu', genre: 'tactique',
    texte: 'Une soirée où tout rentre, ou une soirée où rien ne tient.',
    pari: { chance: 0.5, gagne: { finition: 1.1 }, perd: { defense: 1.08 } } },
  user: { nom: 'Les user', ico: '😮‍💨', cout: 1, rarete: 'peu', genre: 'tactique',
    texte: 'On les fait patiner : leurs jambes brûlent plus vite ce soir.', adv: { energie: 1.15 } },
  ombre: { nom: 'Une ombre sur leur vedette', ico: '👤', cout: 2, rarete: 'peu', genre: 'defense',
    texte: 'Ton meilleur défensif la suit jusqu\'au banc.', adv: { finition: 0.94 } },
  adrenaline: { nom: 'Adrénaline', ico: '💉', cout: 0, rarete: 'peu', genre: 'tactique',
    texte: 'Le cœur bat dans les oreilles dès l\'hymne national.', energiePlus: 1, effet: { energie: 1.08 } },
  fermeture: { nom: 'La paire de fermeture', ico: '🔐', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Ta première paire joue la moitié du match.', effet: { D: [1.25, 1, 0.8], defense: 0.97 } },
  barrage: { nom: 'Le barrage', ico: '🚧', cout: 2, rarete: 'peu', genre: 'defense',
    texte: 'Cinq joueurs entre la rondelle et ton filet, toute la soirée.', effet: { defense: 0.9, volume: 0.92, energie: 1.05 } },
  zamboni: { nom: 'La glace molle', ico: '🧽', cout: 0, rarete: 'peu', genre: 'tactique',
    texte: 'Le préposé à la surfaceuse est un ami : la rondelle roule mal pour tout le monde.', effet: { volume: 0.97 }, adv: { volume: 0.94 } },
  vieux: { nom: 'Le vétéran parle', ico: '🧓', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Pas de panique : on joue notre match, on ne donne rien.', effet: { discipline: 0.85, defense: 0.97 } },
  tueur: { nom: 'L\'instinct du tueur', ico: '🗡️', cout: 2, rarete: 'peu', genre: 'attaque',
    texte: 'Quand on mène, on en veut un autre.', apres40: { siMene: { finition: 1.06 }, sinon: {} } },

  // ---- rares ----
  miracle: { nom: 'Le miracle sur glace', ico: '✨', cout: 3, rarete: 'rare', genre: 'attaque',
    texte: 'Une soirée comme celle de 1980.', effet: { finition: 1.08, defense: 0.93 } },
  legende: { nom: 'Le gardien de légende', ico: '🏆', cout: 2, rarete: 'rare', genre: 'defense',
    texte: 'Le genre de soirée qu\'on raconte trente ans plus tard.', effet: { defense: 0.88 } },
  chapeau: { nom: 'Le soir du tour du chapeau', ico: '🎩', cout: 2, rarete: 'rare', genre: 'attaque',
    texte: 'Les chapeaux vont pleuvoir.', effet: { finition: 1.1, discipline: 1.1 } },
  coach: { nom: 'Le coach dans leur tête', ico: '🎙️', cout: 2, rarete: 'rare', genre: 'tactique',
    texte: 'Leur plan tombe, et ils perdent leur calme.', lire: true, adv: { discipline: 1.15 } },
  preparation: { nom: 'Préparation totale', ico: '📋', cout: 1, rarete: 'rare', genre: 'tactique',
    texte: 'Chaque scénario a sa page dans le cahier.', pioche: 3 },
  espion: { nom: 'Leur cahier de jeux', ico: '🕵️', cout: 2, rarete: 'rare', genre: 'tactique',
    texte: 'Tu connais leur cahier par cœur.', annule: true },
  capitaine: { nom: 'Le capitaine prend le match', ico: '©️', cout: 2, rarete: 'rare', genre: 'attaque',
    texte: 'Il saute sur la glace un tour sur deux, et tout le monde le suit.', effet: { F: [1.35, 1, 0.9, 0.75], finition: 1.04, energie: 1.08 } },
  mur: { nom: 'Le mur de briques', ico: '🧱', cout: 3, rarete: 'rare', genre: 'defense',
    texte: 'Ils peuvent tirer toute la soirée.', effet: { defense: 0.85, volume: 0.95 } },

  // ---- légendaires (seulement après une série gagnée) ----
  butEnOr: { nom: 'Le but en or', ico: '🥇', cout: 3, rarete: 'legendaire', genre: 'attaque',
    texte: 'Le genre de soirée qui finit sur une affiche dans une chambre d\'enfant.', effet: { finition: 1.12, defense: 0.92 } },
  dynastie: { nom: 'La dynastie', ico: '👑', cout: 2, rarete: 'legendaire', genre: 'synergie',
    texte: 'Tes lignes jouent leur système les yeux fermés.', regle: 'Si deux de tes lignes jouent le même système : précision +6 %.', synergie: 'systeme', annule: true },
  dynastieClub: { nom: 'La dynastie de club', ico: '🏛️', cout: 2, rarete: 'legendaire', genre: 'synergie', origine: true,
    texte: 'Les bannières au plafond, et leurs noms dessus.', regle: 'Si 5 joueurs habillés ou plus viennent de la même franchise : précision +6 % et buts contre −4 %.', synergie: 'dynastieClub' },
  ferveur: { nom: 'La ferveur', ico: '📣', cout: 1, rarete: 'rare', genre: 'attaque',
    texte: 'L\'aréna tremble dès la mise au jeu.', effet: { finition: 1.05, volume: 1.05, energie: 1.1 } },

  /*
   * ---- LES NOUVELLES MÉCANIQUES (S76) ----
   * Le dépistage : ta préparation contre LEUR plan, qu'on ne connaît qu'en
   * probabilités (voir `depistageDe`, js/sim.js).
   */
  filature: { nom: 'La filature', ico: '🔎', cout: 1, rarete: 'peu', genre: 'tactique',
    texte: 'Ton dépisteur a dormi dans leur hôtel.', revele: true },
  improvisation: { nom: 'L\'improvisation', ico: '🎷', cout: 0, rarete: 'commune', genre: 'tactique',
    texte: 'Pas de plan ? On en fait un sur le banc.', improvise: { volume: 1.05 } },
  piege: { nom: 'Le piège tendu', ico: '🕸️', cout: 1, rarete: 'rare', genre: 'tactique',
    texte: 'On leur laisse croire que ça marche.', piege: { finition: 1.05, defense: 0.95 } },
  // Les combos : ce que les autres cartes de la main font monter.
  elan: { nom: 'L\'élan', ico: '🌊', cout: 1, rarete: 'peu', genre: 'attaque',
    texte: 'Une vague, puis une autre, puis une autre.', parGenre: { genre: 'attaque', effet: { volume: 1.03 } } },
  forteresse: { nom: 'La forteresse', ico: '🏰', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Chaque planche de la bande est un mur.', parGenre: { genre: 'defense', effet: { defense: 0.97 } } },
  toutOuRien: { nom: 'Tout ou rien', ico: '🎰', cout: 0, rarete: 'rare', genre: 'attaque',
    texte: 'On vide le réservoir dès la première période.', siVide: { finition: 1.07 } },
  // Répondre à LEUR main, qu'on connaît d'avance.
  riposte: { nom: 'La riposte', ico: '🤺', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Ils vont attaquer ? On les attend.', selonLeurMain: { genre: 'attaque', effet: { defense: 0.96 } } },
  contreAttaque: { nom: 'La contre-attaque', ico: '🏹', cout: 1, rarete: 'peu', genre: 'attaque',
    texte: 'Ils se replient ? On passe par-dessus.', selonLeurMain: { genre: 'defense', effet: { volume: 1.04 } } },
  systemeDef: { nom: 'Le système défensif', ico: '📐', cout: 1, rarete: 'peu', genre: 'tactique',
    texte: 'Tout le monde sait où se placer.', rabais: 'defense', effet: { defense: 0.98 } },
  lecture: { nom: 'La lecture du jeu', ico: '👀', cout: 0, rarete: 'commune', genre: 'tactique',
    texte: 'Un coup d\'œil au banc d\'en face.', pioche: 1 },
  // ÉPUISÉES : fortes, une seule fois dans la course.
  grandSoir: { nom: 'Le grand soir', ico: '🌟', cout: 1, rarete: 'rare', genre: 'attaque', epuise: true,
    texte: 'Tu gardais celle-là pour le bon moment.', effet: { finition: 1.1, volume: 1.06 } },
  sacrifice: { nom: 'Le sacrifice', ico: '🩸', cout: 0, rarete: 'peu', genre: 'defense', epuise: true,
    texte: 'Un joueur bloque un tir avec le visage.', effet: { defense: 0.9 } },
  cartouche: { nom: 'La dernière cartouche', ico: '🧨', cout: 0, rarete: 'peu', genre: 'tactique', epuise: true,
    texte: 'Tout ce qui restait dans le coffre.', energiePlus: 2 },

  // ---- LA BANQUE (S79) : dix de plus, sur les mécaniques que le moteur joue déjà ----
  pressionHaute: { nom: 'La pression haute', ico: '🌪️', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Deux attaquants dans leur zone à chaque sortie de territoire.', effet: { volume: 1.07, energie: 1.06 } },
  enclaveNette: { nom: 'Dégager l\'enclave', ico: '🧹', cout: 1, rarete: 'commune', genre: 'defense',
    texte: 'Personne ne reste planté devant ton gardien.', effet: { defense: 0.96, robustesse: 1.1 } },
  tirRebond: { nom: 'Le tir pour le rebond', ico: '🔄', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'On lance bas, sur les jambières, et on arrive.', effet: { finition: 1.02, volume: 1.04 } },
  gardienRelance: { nom: 'Le gardien relance', ico: '🥏', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Il arrête la rondelle derrière le filet et relance tout de suite.', effet: { defense: 0.95, energie: 0.97 } },
  cinqPuissance: { nom: 'Le cinq de puissance', ico: '⚡', cout: 2, rarete: 'peu', genre: 'attaque',
    texte: 'Tes cinq meilleurs, en avantage comme à forces égales.', effet: { finition: 1.06, volume: 1.04 } },
  tempsArret: { nom: 'Le temps d\'arrêt', ico: '⏸️', cout: 0, rarete: 'peu', genre: 'tactique', epuise: true,
    texte: 'Trente secondes pour respirer, au bon moment.', energiePlus: 1, effet: { energie: 0.95 } },
  coupGenie: { nom: 'Le coup de génie', ico: '💡', cout: 1, rarete: 'rare', genre: 'tactique', epuise: true,
    texte: 'Une idée griffonnée sur une serviette de table.', pioche: 2, energiePlus: 1 },
  rideauFer: { nom: 'Le rideau de fer', ico: '🧱', cout: 2, rarete: 'rare', genre: 'defense',
    texte: 'Cinq joueurs sous les cercles de mise au jeu.', effet: { defense: 0.9, volume: 0.94 } },
  feuSacre: { nom: 'Le feu sacré', ico: '🔥', cout: 2, rarete: 'rare', genre: 'attaque',
    texte: 'Ce soir, ils jouent comme en avril.', effet: { finition: 1.08, volume: 1.05, energie: 1.1 } },
  nuitMagique: { nom: 'La nuit magique', ico: '🌌', cout: 2, rarete: 'legendaire', genre: 'tactique', epuise: true,
    texte: 'Tout le monde s\'en souviendra encore dans trente ans.', effet: { finition: 1.06, defense: 0.95, energie: 0.95 } },

  // ---- malédictions ----
  distraction: { nom: 'La distraction', ico: '📰', cout: 1, rarete: 'maudite', genre: 'malediction', maudite: true,
    texte: 'Le proprio fait les manchettes.', regle: 'Elle encombre ta main : la jouer coûte 1 élan et ne fait rien.' },
  doute: { nom: 'Le doute', ico: '🌧️', cout: 0, rarete: 'maudite', genre: 'malediction', maudite: true, injouable: true,
    texte: 'La défaite contre ta rivale te trotte dans la tête.', enMain: { finition: 0.97 } },
  trainee: { nom: 'Une blessure qui traîne', ico: '🩹', cout: 0, rarete: 'maudite', genre: 'malediction', maudite: true, injouable: true,
    texte: 'Il joue quand même, mais il boite.', enMain: { energie: 1.05 } },
};

/*
 * LES CARTES AMÉLIORÉES (S74) — les « + » de Slay the Spire. Chaque carte a sa
 * version améliorée, DÉRIVÉE, jamais écrite à la main : une carte chère
 * (deux et plus), une carte qui lit la formation ou qui défait leur plan
 * coûte une énergie de moins ; les autres font moitié plus (chaque canal
 * s'éloigne de moitié plus de 1 : lancers +6 % devient +9 %), piochent une
 * carte de plus, rendent dix d'énergie de plus, ou gagnent leur pari plus
 * souvent. Une malédiction ne s'améliore pas. La clé est celle de la carte
 * suivie de « + » : partout où une carte se lit, sa version se lit pareil.
 */
export const estPlus = cle => String(cle).endsWith('+');
export const carteDeBase = cle => String(cle).replace(/\+$/, '');
/*
 * LE SENS D'UN CANAL (1.0, J1-G) : ce qui est bon quand ça monte (finition,
 * volume, robustesse) et ce qui est bon quand ça baisse (défensive, énergie,
 * discipline, blessure). Une carte « + » n'amplifie que dans le BON sens,
 * jamais son inconvénient (« Tirer de partout+ » garde précision −3 %, pas
 * −4,5 %) ; sur l'adversaire (`adv`), le bon sens est l'inverse. Les minutes
 * des lignes (F, D) restent telles quelles.
 */
const SENS = { finition: 1, volume: 1, robustesse: 1, defense: -1, energie: -1, discipline: -1, blessure: -1 };
const plusDe = (v, k = null, cote = 1) => {
  if (typeof v !== 'number') return v;
  const s = k ? SENS[k] : null;
  if (s && Math.sign(v - 1) !== s * cote) return v;
  return 1 + (v - 1) * 1.5;
};
const canauxPlus = (e, cote = 1) => (e ? Object.fromEntries(Object.entries(e).map(([k, v]) => [k, plusDe(v, k, cote)])) : e);
for (const [cle, C] of Object.entries(CARTES_MATCH)) {
  if (C.maudite) continue;
  const moinsCher = C.cout >= 2 || C.synergie || C.lire || C.annule || C.revele || C.planB || C.rabais;
  const P = { ...C, nom: `${C.nom}+`, plus: true };
  if (moinsCher && C.cout > 0) P.cout = C.cout - 1;
  else {
    if (C.effet) P.effet = canauxPlus(C.effet);
    if (C.adv) P.adv = canauxPlus(C.adv, -1);
    if (C.apres40) P.apres40 = { siMene: canauxPlus(C.apres40.siMene), sinon: canauxPlus(C.apres40.sinon) };
    if (C.pioche) P.pioche = C.pioche + 1;
    if (C.energieTous) P.energieTous = C.energieTous + 10;
    if (C.pari) P.pari = { ...C.pari, chance: Math.min(0.8, C.pari.chance + 0.15) };
    if (C.energiePlus && !C.effet) P.energiePlus = C.energiePlus + 1;
    // S76 : les mécaniques neuves s'améliorent comme les autres — moitié plus.
    if (C.ecarte) P.ecarte = C.ecarte + 1;
    if (C.improvise) P.improvise = canauxPlus(C.improvise);
    if (C.piege) P.piege = canauxPlus(C.piege);
    if (C.siVide) P.siVide = canauxPlus(C.siVide);
    if (C.parGenre) P.parGenre = { ...C.parGenre, effet: canauxPlus(C.parGenre.effet) };
    if (C.selonLeurMain) P.selonLeurMain = { ...C.selonLeurMain, effet: canauxPlus(C.selonLeurMain.effet) };
  }
  const quoi = P.cout < C.cout ? 'un élan de moins' : C.pioche ? 'une carte de plus'
    : C.energieTous ? 'dix de jambes de plus' : C.pari ? 'le pari rentre plus souvent' : C.ecarte ? 'écarte un plan de plus' : 'moitié plus forte';
  P.texte = `${C.texte} — Améliorée : ${quoi}.`;
  CARTES_MATCH[`${cle}+`] = P;
}

export const DECK_DEPART = ['lancer', 'lancer', 'lancer', 'bloquer', 'bloquer', 'bloquer', 'changements', 'changements', 'discours', 'video'];

/*
 * LE DECK À UN MOMENT DE LA SAISON : le départ, plus les récompenses, moins
 * les retraits, plus les malédictions. `avant` borne les décisions de saison
 * (celles prises avant ce jour-là) ; `serie` ajoute les récompenses de séries
 * gagnées avant la ronde `ronde`.
 */
export function deckDe(decisions = [], { avant = Infinity, serie = [], ronde = Infinity, k = Infinity, pertes = [], blessures = [] } = {}) {
  // LA SAISON SUIVANTE D'UNE RUN ROGUE (S80) : le deck repart de celui de la fin de la saison d'avant (`deckDeBase`).
  const base = decisions.find(d => d && Array.isArray(d.deckDeBase));
  const deck = base ? base.deckDeBase.filter(c => CARTES_MATCH[c]) : DECK_DEPART.slice();
  const retirer = cle => { const i = deck.lastIndexOf(cle); if (i >= 0) deck.splice(i, 1); };
  const saison = decisions.filter(d => d && d.jour != null && d.jour < avant).slice().sort((a, b) => a.jour - b.jour);
  // Les retraits se font APRÈS tous les ajouts : « Le ménage » peut retirer une
  // malédiction de cicatrice (le doute, une blessure qui traîne), qui s'ajoute
  // plus bas. Le retrait vise une carte qui est dans le deck à ce moment-là.
  const retraits = [];
  for (const d of saison) {
    if (d.recompense && CARTES_MATCH[d.recompense]) deck.push(d.recompense);
    if (d.retrait && CARTES_MATCH[d.retrait]) retraits.push(d.retrait);
    // LE CAMP D'ENTRAÎNEMENT (S74) : une carte du deck devient sa version « + ».
    if (d.aiguise && CARTES_MATCH[`${d.aiguise}+`]) { const i = deck.indexOf(d.aiguise); if (i >= 0) deck[i] = `${d.aiguise}+`; }
    // Un objectif raté : le proprio fait les manchettes, et ça te suit.
    if (typeof d.palier === 'string' && d.palier.startsWith('v:') && d.effet) deck.push('distraction');
  }
  for (const d of serie) if (d && d.ronde < ronde && d.recompense && CARTES_MATCH[d.recompense]) deck.push(d.recompense);
  /*
   * CE QUE LA SAISON LAISSE (S74) : un gros match perdu contre ta RIVALITÉ
   * glisse le doute dans ton deck, une blessure de quinze matchs et plus une
   * blessure qui traîne. Ce sont des résultats du moteur — donc des faits de
   * la graine et des décisions, comme le reste du deck.
   */
  /*
   * DEUX CICATRICES AU PLUS (1.0, J1-F) : elles s'empilaient sans plafond et
   * traversaient les saisons d'une run — un deck de dix plus quatre cicatrices
   * tirait une malédiction dans la plupart des mains. La plus ancienne tombe
   * au-delà de CICATRICES_MAX, et chaque série gagnée en efface une (la plus
   * ancienne). Au report d'une run (`deckDeBase`), la saison neuve repart sans.
   */
  const cicatrices = [...pertes.filter(j => j < avant).map(j => ({ j, cle: 'doute' })), ...blessures.filter(j => j < avant).map(j => ({ j, cle: 'trainee' }))]
    .sort((a, b) => a.j - b.j).slice(-CICATRICES_MAX);
  const effacees = serie.filter(d => d && d.ronde < ronde && d.recompense !== undefined).length;
  for (const c of cicatrices.slice(Math.min(cicatrices.length, effacees))) deck.push(c.cle);
  for (const cle of retraits) retirer(cle);
  /*
   * LES CARTES ÉPUISÉES (S76) : jouées à un match, elles quittent le deck
   * pour le reste de la course — celles des gros matchs de saison, puis
   * celles des matchs de séries joués AVANT celui-ci (ronde, puis match).
   */
  const joueesAvant = [
    ...saison.filter(d => d.main && Array.isArray(d.main.jouees)).flatMap(d => d.main.jouees),
    ...serie.filter(d => d && d.main && Array.isArray(d.main.jouees) && (d.ronde < ronde || (d.ronde === ronde && d.match_no < k))).flatMap(d => d.main.jouees),
  ];
  for (const c of joueesAvant) if (CARTES_MATCH[c] && CARTES_MATCH[c].epuise) retirer(c);
  return deck;
}

/* La main d'un match : le deck battu par la graine et le match, cinq cartes, et la pioche dans l'ordre. */
export function mainDuMatch(graine, cle, deck, n = TAILLE_MAIN) {
  const ordre = deck.map((c, i) => [c, hache(graine, 'main', cle, i, c)]).sort((a, b) => a[1] - b[1]).map(([c]) => c);
  return { main: ordre.slice(0, n), pioche: ordre.slice(n) };
}

/*
 * LES RÉCOMPENSES : trois cartes différentes, jamais une malédiction ni une
 * carte du départ. Après un gros match, surtout des communes ; après une
 * série gagnée, des peu communes et des rares.
 */
export function recompensesOffertes(graine, cle, { serie = false } = {}) {
  const poids = serie ? { commune: 0, peu: 50, rare: 42, legendaire: 8 } : { commune: 60, peu: 30, rare: 10, legendaire: 0 };
  const pool = Object.keys(CARTES_MATCH).filter(k => !estPlus(k) && !CARTES_MATCH[k].maudite && !DECK_DEPART.includes(k) && poids[CARTES_MATCH[k].rarete] > 0);
  const out = [];
  for (let t = 0; out.length < 3 && t < 40; t++) {
    const r = hache(graine, 'recompense', cle, t) * 100;
    const rarete = r < poids.commune ? 'commune' : r < poids.commune + poids.peu ? 'peu' : r < poids.commune + poids.peu + poids.rare ? 'rare' : 'legendaire';
    const choix = pool.filter(k => CARTES_MATCH[k].rarete === rarete && !out.includes(k));
    if (!choix.length) continue;
    out.push(choix[Math.floor(hache(graine, 'recompense-carte', cle, t) * choix.length)]);
  }
  return out;
}

/*
 * LA MAIN DE L'ADVERSAIRE (S74). JP : *les adversaires aussi ont des bonus,
 * malus, stratégies, et le jeu est de trouver comment contrer, surtout en
 * séries — sans changer la difficulté*. Dans un gros match et en séries,
 * l'adversaire joue AUSSI trois d'énergie de cartes, et on le SAIT d'avance :
 * ce sont les « intentions » de Slay the Spire. Sa main se tire de la graine et
 * du match — l'écran la montre, le moteur la joue, la même. Il ne joue que des
 * cartes qui ont un sens pour lui (pas de pioche, pas de plan à lire), et les
 * rares moins souvent. Ta main répond : « Pas de punition bête » contre « Les
 * provoquer », « Leur cahier de jeux » pour l'annuler toute.
 */
const POIDS_ADVERSE = { commune: 3, peu: 2, rare: 1, legendaire: 0 };
const POOL_ADVERSE = Object.keys(CARTES_MATCH).filter(k => {
  const C = CARTES_MATCH[k];
  if (estPlus(k)) return false;
  // Ni dépistage, ni rabais, ni épuisée (S76) : ce sont des gestes de TA préparation et de TON deck.
  if (C.revele || C.ecarte || C.planB || C.improvise || C.piege || C.rabais || C.epuise || C.siVide) return false;
  // Ni une carte d'origine (1.0) : une vraie équipe est d'un seul club et d'une saison, elle les aurait toutes au maximum.
  if (C.origine) return false;
  return !C.maudite && !C.lire && !C.pioche && !C.energiePlus && !C.annule && C.cout > 0 && C.rarete !== 'legendaire'
    && (C.effet || C.adv || C.pari || C.synergie || C.energieTous || C.parGenre || C.selonLeurMain || C.apres40);
});
export function mainAdverse(graine, cle, energie = ENERGIE_MAIN) {
  const out = [];
  let e = energie;
  for (let t = 0; t < 12 && e > 0; t++) {
    const choix = POOL_ADVERSE.filter(k => CARTES_MATCH[k].cout <= e);
    if (!choix.length) break;
    const total = choix.reduce((a, k) => a + POIDS_ADVERSE[CARTES_MATCH[k].rarete], 0);
    let r = hache(graine, 'adverse', cle, t) * total, k = choix[0];
    for (const c of choix) { r -= POIDS_ADVERSE[CARTES_MATCH[c].rarete]; if (r < 0) { k = c; break; } }
    out.push(k);
    e -= CARTES_MATCH[k].cout;
  }
  return out;
}
/*
 * L'ÉNERGIE DE L'ADVERSAIRE MONTE AVEC LA COURSE (S74b). Ton deck grandit —
 * récompenses, cartes « + » — et une main adverse fixe rendait la fin de
 * saison et les séries plus faciles à mesure qu'on y avance. Comme les boss
 * d'un deckbuilder : quatre d'énergie à partir de la journée 55, et dès la
 * troisième ronde des séries. L'écran l'annonce avec la main.
 */
export const JOUR_ADVERSE_FORT = 55, RONDE_ADVERSE_FORTE = 2;
export function energieAdverse({ jour = 0, serie = false, ronde = 0 } = {}) {
  return (serie ? ronde >= RONDE_ADVERSE_FORTE : jour >= JOUR_ADVERSE_FORT) ? ENERGIE_MAIN + 1 : ENERGIE_MAIN;
}
/* Un interrupteur de MESURE : `check_combat.mjs` compare avec et sans la main adverse. */
export const OPTIONS_COMBAT = { adverses: true };

/*
 * CE QU'UNE CARTE COÛTE DANS CETTE MAIN (S76) : son coût, moins un si une
 * carte jouée fait le RABAIS de son genre (« Le système défensif » : tes
 * cartes de défense coûtent 1 de moins). Sans ordre : la carte au rabais
 * peut être jouée avant ou après, comme sur une table.
 */
export function coutDe(cle, jouees = []) {
  const C = CARTES_MATCH[cle];
  if (!C) return 0;
  const rabais = jouees.some(x => CARTES_MATCH[x] && CARTES_MATCH[x].rabais === C.genre);
  return Math.max(0, C.cout - (rabais ? 1 : 0));
}
/* Une main est-elle jouable telle quelle ? Le coût, l'énergie gagnée et les cartes injouables. */
export function energieDepensee(jouees) {
  let e = ENERGIE_MAIN;
  for (const c of jouees) { const C = CARTES_MATCH[c]; if (!C) continue; e -= coutDe(c, jouees); e += C.energiePlus || 0; }
  return e;
}
