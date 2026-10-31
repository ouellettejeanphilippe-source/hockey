/**
 * LES CARTES DE MATCH (S74) — depuis la V13-2 (docs/refonte-v13.md), celles de l'ADVERSAIRE seulement : ta main est
 * partie avec la main du duel, qui se jouait presque aussi bien par l'adjoint, sans rien lire. Un gros match qui n'est
 * pas un duel (le 82-0) garde la main de l'adversaire, son plan et son dépistage. Ce qui suit dit d'où elles viennent.
 *
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
 * de match qui tombe (« La vidéo »), un pari tiré de la graine, de l'énergie rendue à tes joueurs, ou
 * une synergie qui lit ta formation (tes snipers, tes défenseurs défensifs,
 * tes lignes qui ont chacune un accord). Rien ne se lit d'une cote.
 *
 * TOUT EST PUR. Le deck se DÉDUIT des décisions (récompenses, retraits,
 * malédictions) ; la main d'un match se tire de la graine et du match ; les
 * récompenses offertes aussi. Une partie reprise retrouve les mêmes mains.
 */
import { hache, SENS_DES_CANAUX } from './util.js';

export const ENERGIE_MAIN = 3;

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
 * déduit des champs (`regleDeCarte`) — « ≈ +1,2 tir par match », « Pige 2
 * cartes », « Eux : ≈ +0,9 punition par match » (js/impact.js) — et `regle`
 * ne s'écrit à la main que pour une carte conditionnelle ; `quand` et `plein`
 * (la condition, et l'effet à son maximum) la disent en chiffres de match
 * (`check_combat` prouve que `plein` est celui de `regle`). Et de nouvelles
 * MÉCANIQUES, pas seulement de nouveaux pourcentages :
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
  bloquer: { nom: 'Bloquer des tirs', ico: '🧲', cout: 1, rarete: 'commune', genre: 'defense',
    texte: 'Tout le monde se jette devant la rondelle.', effet: { defense: 0.95 } },
  // LE DÉPISTAGE (S76) : la vidéo n'abat plus leur plan, elle ÉCARTE une piste
  // du rapport — c'est à toi de viser juste avec ce qui reste.

  // ---- communes ----
  echecAvant: { nom: 'Échec avant', ico: '🥊', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Deux attaquants au fond de leur zone, et le défenseur n\'a pas le temps de lever la tête.', effet: { volume: 1.08, discipline: 1.1 } },
  trappe: { nom: 'La trappe', ico: '🧊', cout: 1, rarete: 'commune', genre: 'defense',
    texte: 'Cinq joueurs en zone neutre. Personne ne passe.', effet: { defense: 0.93, volume: 0.95 } },
  frapper: { nom: 'On frappe tout ce qui bouge', ico: '🦍', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Chaque présence, une mise en échec.', effet: { robustesse: 1.4, discipline: 1.1 } },
  partout: { nom: 'Tirer de partout', ico: '🎯', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Tout ce qui ressemble à un angle, on lance.', effet: { volume: 1.1, finition: 0.97 } },
  retour: { nom: 'Au filet pour le retour', ico: '🥅', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Deux joueurs dans l\'enclave, à chaque lancer.', effet: { finition: 1.05, energie: 1.05 } },
  conge: { nom: 'Matinée de congé', ico: '😴', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'La pratique du matin est annulée : les gars dorment jusqu\'à midi.', energieTous: 15 },
  provoquer: { nom: 'Les provoquer', ico: '😈', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Un mot de trop après chaque sifflet : ils vont au banc des punitions.', adv: { discipline: 1.25 } },
  enclave: { nom: 'Devant le filet', ico: '🏗', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Un gros bonhomme plante sa tente devant leur gardien.', effet: { finition: 1.04, robustesse: 1.2 } },
  poignets: { nom: 'Le tir des poignets', ico: '🌀', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Vite, précis, sans élan : le gardien ne le voit pas partir.', effet: { finition: 1.03, volume: 1.03 } },
  blitz: { nom: 'Le blitz', ico: '⚡', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Tout de suite, tout le monde : on veut les sortir du match avant qu\'ils y entrent.', effet: { volume: 1.12, energie: 1.12 } },
  presse: { nom: 'La conférence de presse', ico: '🎤', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Tu as dit ce qu\'il fallait dire la veille : ils jouent crispés.', adv: { discipline: 1.2, finition: 0.97 } },

  // ---- peu communes ----
  doublePresence: { nom: 'Double présence', ico: '🔥', cout: 1, rarete: 'peu', genre: 'attaque',
    texte: 'Ta première ligne saute sur la glace un tour sur deux.', effet: { F: [1.3, 1, 0.9, 0.8], energie: 1.05 } },
  // Le contre parfait (S74) devient le PLAN B (S76) : deux pistes préparées au lieu d'une.
  gardienFeu: { nom: 'Le gardien en feu', ico: '🧤', cout: 2, rarete: 'peu', genre: 'defense',
    texte: 'Il a vu la rondelle grosse comme un ballon toute la journée.', effet: { defense: 0.92 } },
  avantage: { nom: 'L\'avantage numérique en or', ico: '💥', cout: 2, rarete: 'peu', genre: 'attaque',
    texte: 'Répété toute la semaine, jusqu\'à la dernière passe dans l\'enclave.', effet: { finition: 1.07 } },
  systeme: { nom: 'Les lignes soudées', ico: '📘', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Tout le monde connaît sa case les yeux fermés.', regle: 'Si deux de tes lignes ont chacune un accord : précision +6 %.', synergie: 'systeme', quand: 'Si deux de tes lignes ont chacune un accord', plein: { finition: 1.06 }, seuil: true },
  gachettes: { nom: 'Les gâchettes', ico: '🎯', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Ils ne passent pas : ils lancent.', regle: 'Précision +2 % par sniper dans tes deux premiers trios (jusqu\'à +6 %).', synergie: 'gachettes', quand: 'Par sniper dans tes deux premiers trios', plein: { finition: 1.06 } },
  murBleu: { nom: 'Le mur bleu', ico: '🧱', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Trois défenseurs qui ne montent jamais.', regle: 'Buts contre −2 % par défenseur 🛑 Défensif habillé (jusqu\'à −6 %).', synergie: 'mur', quand: 'Par défenseur 🛑 Défensif habillé', plein: { defense: 0.94 } },
  jambes: { nom: 'Les jambes', ico: '⚡', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Ça part en contre-attaque avant la ligne rouge.', regle: 'Tirs +2 % par plombier 🪠 habillé (jusqu\'à +8 %).', synergie: 'jambes', quand: 'Par plombier 🪠 habillé', plein: { volume: 1.08 } },
  // LES CARTES D'ORIGINE (1.0) : JP, *des cartes qui activent bonus s'il même équipe*. Elles lisent d'où viennent tes joueurs
  // (js/sim.js `originesDe`) ; l'alignement montre la puce d'une unité qui les déclenche. `origine` : l'adversaire ne les joue
  // pas — une vraie équipe est tout entière d'un club et d'une saison, elle les aurait toutes au maximum.
  user: { nom: 'Les user', ico: '😮‍💨', cout: 1, rarete: 'peu', genre: 'tactique',
    texte: 'On les fait patiner : leurs jambes brûlent plus vite ce soir.', adv: { energie: 1.15 } },
  ombre: { nom: 'Une ombre sur leur vedette', ico: '👤', cout: 2, rarete: 'peu', genre: 'defense',
    texte: 'Ton meilleur défensif la suit jusqu\'au banc.', adv: { finition: 0.94 } },
  fermeture: { nom: 'La paire de fermeture', ico: '🔐', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Ta première paire joue la moitié du match.', effet: { D: [1.25, 1, 0.8], defense: 0.95 } },
  barrage: { nom: 'Le barrage', ico: '🚧', cout: 2, rarete: 'peu', genre: 'defense',
    texte: 'Cinq joueurs entre la rondelle et ton filet, toute la soirée.', effet: { defense: 0.9, volume: 0.92, energie: 1.05 } },
  vieux: { nom: 'Le vétéran parle', ico: '🧓', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Pas de panique : on joue notre match, on ne donne rien.', effet: { discipline: 0.85, defense: 0.97 } },
  tueur: { nom: 'L\'instinct du tueur', ico: '🗡', cout: 2, rarete: 'peu', genre: 'attaque',
    texte: 'Quand on mène, on en veut un autre.', apres40: { siMene: { finition: 1.06 }, sinon: {} } },

  // ---- rares ----
  miracle: { nom: 'Le miracle sur glace', ico: '✨', cout: 3, rarete: 'rare', genre: 'attaque',
    texte: 'Une soirée comme celle de 1980.', effet: { finition: 1.08, defense: 0.93 } },
  legende: { nom: 'Le gardien de légende', ico: '🏆', cout: 2, rarete: 'rare', genre: 'defense',
    texte: 'Le genre de soirée qu\'on raconte trente ans plus tard.', effet: { defense: 0.88 } },
  chapeau: { nom: 'Le soir du tour du chapeau', ico: '🎩', cout: 2, rarete: 'rare', genre: 'attaque',
    texte: 'Les chapeaux vont pleuvoir.', effet: { finition: 1.1, discipline: 1.1 } },
  capitaine: { nom: 'Le capitaine prend le match', ico: '©', cout: 2, rarete: 'rare', genre: 'attaque',
    texte: 'Il saute sur la glace un tour sur deux, et tout le monde le suit.', effet: { F: [1.35, 1, 0.9, 0.75], finition: 1.04, energie: 1.08 } },
  mur: { nom: 'Le mur de briques', ico: '🧱', cout: 3, rarete: 'rare', genre: 'defense',
    texte: 'Qu\'ils tirent toute la soirée : rien ne passe.', effet: { defense: 0.85, volume: 0.95 } },

  // ---- légendaires (seulement après une série gagnée) ----
  ferveur: { nom: 'La ferveur', ico: '📣', cout: 1, rarete: 'rare', genre: 'attaque',
    texte: 'L\'aréna tremble dès la mise au jeu.', effet: { finition: 1.05, volume: 1.05, energie: 1.1 } },

  /*
   * ---- LES NOUVELLES MÉCANIQUES (S76) ----
   * Le dépistage : ta préparation contre LEUR plan, qu'on ne connaît qu'en
   * probabilités (voir `depistageDe`, js/sim.js).
   */
  // Les combos : ce que les autres cartes de la main font monter.
  elan: { nom: 'La lancée', ico: '🌊', cout: 1, rarete: 'peu', genre: 'attaque',
    texte: 'Une vague, puis une autre, puis une autre.', parGenre: { genre: 'attaque', effet: { volume: 1.03 } } },
  forteresse: { nom: 'La forteresse', ico: '🏰', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Chaque planche de la bande est un mur.', parGenre: { genre: 'defense', effet: { defense: 0.97 } } },
  // Répondre à LEUR main, qu'on connaît d'avance.
  riposte: { nom: 'La riposte', ico: '🤺', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Ils vont attaquer ? On les attend.', selonLeurMain: { genre: 'attaque', effet: { defense: 0.96 } } },
  contreAttaque: { nom: 'La contre-attaque', ico: '🏹', cout: 1, rarete: 'peu', genre: 'attaque',
    texte: 'Ils se replient ? On passe par-dessus.', selonLeurMain: { genre: 'defense', effet: { volume: 1.04 } } },
  // ÉPUISÉES : fortes, une seule fois dans la course.

  // ---- LA BANQUE (S79) : dix de plus, sur les mécaniques que le moteur joue déjà ----
  pressionHaute: { nom: 'La pression haute', ico: '🌪', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Deux attaquants dans leur zone à chaque sortie de territoire.', effet: { volume: 1.07, energie: 1.06 } },
  enclaveNette: { nom: 'Dégager l\'enclave', ico: '🧹', cout: 1, rarete: 'commune', genre: 'defense',
    texte: 'Personne ne reste planté devant ton gardien.', effet: { defense: 0.96, robustesse: 1.1 } },
  tirRebond: { nom: 'Le tir pour le rebond', ico: '🔄', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'On lance bas, sur les jambières, et on arrive.', effet: { finition: 1.02, volume: 1.04 } },
  gardienRelance: { nom: 'Le gardien repart l\'attaque', ico: '🥏', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Il arrête la rondelle derrière le filet et repart l\'attaque tout de suite.', effet: { defense: 0.95, energie: 0.97 } },
  cinqPuissance: { nom: 'Le cinq de puissance', ico: '⚡', cout: 2, rarete: 'peu', genre: 'attaque',
    texte: 'Tes cinq meilleurs, en avantage comme à forces égales.', effet: { finition: 1.06, volume: 1.04 } },
  rideauFer: { nom: 'Le rideau de fer', ico: '🧱', cout: 2, rarete: 'rare', genre: 'defense',
    texte: 'Cinq joueurs sous les cercles de mise au jeu.', effet: { defense: 0.9, volume: 0.94 } },
  feuSacre: { nom: 'Le feu sacré', ico: '🔥', cout: 2, rarete: 'rare', genre: 'attaque',
    texte: 'Ce soir, ils jouent comme en avril.', effet: { finition: 1.08, volume: 1.05, energie: 1.1 } },

  /*
   * CONTOURNER LE RÈGLEMENT. Les mêmes canaux, un prix à chaque trou :
   * un joueur de trop, une courbe hors gabarit, une carte d'attaque qui
   * coûte moins, le filet désert, le jeu retardé.
   */
  sixGlace: { nom: 'Six sur la glace', ico: '🧢', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Le changement de trop, fait exprès : un joueur de plus le temps d\'un jeu.', effet: { volume: 1.07, discipline: 1.18 } },
  courbeIllegale: { nom: 'La courbe illégale', ico: '📏', cout: 1, rarete: 'peu', genre: 'attaque',
    texte: 'Le tir tombe. L\'arbitre a un gabarit dans la poche.',
    pari: { chance: 0.5, gagne: { finition: 1.08 }, perd: { discipline: 1.22 } } },
  filetDesert: { nom: 'Le filet désert', ico: '🚪', cout: 2, rarete: 'rare', genre: 'attaque',
    texte: 'Le sixième attaquant sort trop tôt, et il reste sorti.', effet: { volume: 1.08, finition: 1.04, defense: 1.08 } },
  retardement: { nom: 'Retarder le jeu', ico: '🕐', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'La rondelle glacée, le dégagement dans la vitre, le gardien qui fige.', effet: { defense: 0.97, volume: 0.97 }, adv: { volume: 0.96 } },

  /*
   * v2 — HUIT DE PLUS, pour que chaque école (js/ecoles.js) ait ses cartes de
   * match : le rouleau compresseur (les rhinocéros), les quatre trios (la
   * profondeur), le héros du soir (les étoiles), la prière et la provocation
   * (les enfants de chœur). Les mêmes champs que les autres, rien de neuf.
   * `horsAdverse` : l'adversaire ne les pige pas — sa main est calibrée
   * (check_gros, check_robot), et la v2 ne change pas la difficulté.
   */

};

/* Les canaux qu'une carte touche (1.0, J1-G) : ce qui est bon quand ça monte, et quand ça baisse (js/util.js). */
const SENS = SENS_DES_CANAUX;
/*
 * DES CARTES DE MATCH PLUS FRANCHES (JP, 13 oct. : *les cartes de matchs, plus gros effet*). Une carte ne joue qu'un
 * soir : à ±6 %, on ne la voyait pas dans la feuille. Chaque écart au 1 de ses canaux (et des minutes des lignes) est
 * multiplié par `FRANCHISE_MATCH`, son prix compris ; un canal ne descend
 * jamais sous `PLANCHER_MATCH`. La face lit ces chiffres-là : ce sont eux que le moteur joue. La main ADVERSE, elle,
 * joue à l'échelle d'avant (js/sim.js, `poserGros`) : elle est calibrée, la difficulté ne bouge pas.
 */
export const FRANCHISE_MATCH = 1.8;
const PLANCHER_MATCH = 0.4;
const CHAMPS_DE_CANAUX = ['effet', 'adv', 'improvise', 'piege', 'siVide'];
const plusFranche = v => Math.max(PLANCHER_MATCH, Math.round((1 + (v - 1) * FRANCHISE_MATCH) * 1000) / 1000);
const rendreFranche = e => {
  if (!e || typeof e !== 'object') return;
  // La robustesse est une somme (« +1,4 ») que le moteur multiplie (`grandirEffet`) : elle se multiplie aussi.
  for (const k of Object.keys(SENS)) if (typeof e[k] === 'number') e[k] = k === 'robustesse' ? Math.round(e[k] * FRANCHISE_MATCH * 1000) / 1000 : plusFranche(e[k]);
  for (const k of ['F', 'D']) if (Array.isArray(e[k])) e[k] = e[k].map(plusFranche);
};
for (const C of Object.values(CARTES_MATCH)) {
  for (const k of CHAMPS_DE_CANAUX) rendreFranche(C[k]);
  if (C.apres40) { rendreFranche(C.apres40.siMene); rendreFranche(C.apres40.sinon); }
  for (const k of ['parGenre', 'selonLeurMain']) if (C[k]) rendreFranche(C[k].effet);
  if (C.pari) { rendreFranche(C.pari.gagne); rendreFranche(C.pari.perd); }
}
/*
 * LA MAIN DE L'ADVERSAIRE (V10, tranche 6). Les cartes que pige l'adversaire d'un gros match (`POOL_ADVERSE`) — sa
 * main est calibrée (`check_gros`, `check_robot`). Elles ne s'offrent jamais à toi : ni récompense, ni pack, ni banque.
 */
for (const C of Object.values(CARTES_MATCH)) C.adverse = true;

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
  // Ni dépistage, ni rabais, ni épuisée (S76) : ce sont des gestes de TA préparation et de TON deck.
  if (C.revele || C.ecarte || C.planB || C.improvise || C.piege || C.rabais || C.epuise || C.siVide) return false;
  // Ni une carte d'origine (1.0) : une vraie équipe est d'un seul club et d'une saison, elle les aurait toutes au maximum.
  if (C.origine) return false;
  if (C.horsAdverse) return false;
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
 * d'un deckbuilder : quatre d'élan à partir du 55e match, et dès la troisième
 * ronde des séries. L'écran l'annonce avec la main.
 */
export const MATCH_ADVERSE_FORT = 55;
const RONDE_ADVERSE_FORTE = 2;
export function energieAdverse({ nMatch = 0, serie = false, ronde = 0 } = {}) {
  return (serie ? ronde >= RONDE_ADVERSE_FORTE : nMatch >= MATCH_ADVERSE_FORT) ? ENERGIE_MAIN + 1 : ENERGIE_MAIN;
}
/* Un interrupteur de MESURE : `check_combat.mjs` compare avec et sans la main adverse. */
export const OPTIONS_COMBAT = { adverses: true };

/*
 * CE QU'UNE CARTE COÛTE DANS CETTE MAIN (S76) : son coût, moins un si une
 * carte jouée fait le RABAIS de son genre (« Le système défensif » : tes
 * cartes de défense coûtent 1 de moins). Sans ordre : la carte au rabais
 * peut être jouée avant ou après, comme sur une table.
 */
function coutDe(cle, jouees = []) {
  const C = CARTES_MATCH[cle];
  if (!C) return 0;
  const rabais = jouees.some(x => CARTES_MATCH[x] && CARTES_MATCH[x].rabais === C.genre);
  return Math.max(0, C.cout - (rabais ? 1 : 0));
}
/* Une main est-elle jouable telle quelle ? Le coût, l'énergie gagnée et les cartes injouables. */
export function energieDepensee(jouees, elan = ENERGIE_MAIN) {
  let e = elan;
  for (const c of jouees) { const C = CARTES_MATCH[c]; if (!C) continue; e -= coutDe(c, jouees); e += C.energiePlus || 0; }
  return e;
}
