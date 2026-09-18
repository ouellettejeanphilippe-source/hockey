/**
 * SUR TABLE — le mode bonus, un match de hockey joué comme un jeu de plateau.
 *
 * JP : *mode bonus genre blood bowl, fft et autres jeux de sport de table* ;
 * puis *viser un modèle à la blood bowl, mais plus rapide, surtout pour genre
 * les séries, ou faire mini saisons et séries*.
 *
 * CE QUE BLOOD BOWL DONNE, ET POURQUOI ÇA TOMBE PILE SUR LE HOCKEY
 *
 *   LE REVIREMENT. Dans Blood Bowl tu joues tant que tu réussis ; le premier
 *   jet raté coupe ton tour SEC et le ballon change de camp. C'est
 *   littéralement ce qu'est un revirement au hockey. Rien à inventer : une
 *   passe manquée, une rondelle échappée, une mise en échec ratée, et c'est
 *   fini pour ta présence. C'est ça qui fait la tension, et c'est ça qui rend
 *   le mode RAPIDE — une présence dure trois gestes en moyenne, pas quinze.
 *
 *   LE TOUR BORNÉ. Blood Bowl n'a pas d'horloge : huit tours par demie, point.
 *   Ici c'est PRESENCES_PAR_PERIODE tours par période (un tour : les dix
 *   pièces, une à la fois, en alternance), et le match finit quand les tours
 *   sont épuisés. C'est ce qui garantit qu'un
 *   match sur table se joue en quelques minutes et qu'un tournoi entier tient
 *   dans une soirée.
 *
 *   LA ZONE DE BÂTON. Le « tackle zone » de Blood Bowl, c'est l'échec avant :
 *   chaque pièce contrôle les huit cases autour d'elle, et quitter une case
 *   contrôlée avec la rondelle demande un jet d'esquive. C'est ce qui fait
 *   qu'on ne traverse pas la glace en ligne droite.
 *
 *   LA RELANCE D'ÉQUIPE. Le « team re-roll », une par période. Le mot existe
 *   déjà dans ce dépôt (REROLLS au repêchage) et il veut dire la même chose :
 *   une seconde chance qui coûte quelque chose, donc qu'on garde pour le
 *   moment où ça compte.
 *
 * CE QUE FFT DONNE : l'habileté. Chaque pièce porte UN geste spécial tiré de
 * son ARCHÉTYPE — celui que `js/ratings.js` a déjà mesuré sur sa vraie saison
 * — utilisable une fois par période. Gretzky 1981-82 sort franc-tireur et
 * porte Décoché ; Gretzky 1985-86 sort fabricant et porte Passe voilée. Les
 * deux ne se jouent pas pareil sur le plateau, et c'est le dépôt qui l'a dit,
 * pas moi.
 *
 * CE QUE CE MODULE NE TOUCHE PAS : `js/sim.js`. Le moteur par événements, les
 * 23 cases, le plafond, les cotes, les égalités de la feuille de match — rien
 * ne bouge. Ce fichier LIT un alignement et rend un pointage. Les quatre
 * nombres d'une pièce sont dérivés de formules qui existent déjà
 * (`pctTirRelDe`, `lancersRelDe`, `passesRelDe`, `facteurGardienDe`, `p.mr`) :
 * aucune cote neuve n'est créée, donc rien à recalibrer.
 *
 * TOUT LE HASARD PASSE PAR `dTable()`, greffé sur `generateur()` de sim.js :
 * même graine, même match. C'est la règle du dépôt, et c'est ce qui permet de
 * rejouer un tournoi.
 */

import { generateur, getHiddenRatings, SLOTS } from './sim.js';
import { pctTirRelDe, lancersRelDe, passesRelDe, facteurGardienDe } from './sim.js';
import { archetypeKey, ARCHETYPES, GABARIT_PETIT, GABARIT_MOYEN, GABARIT_MATADOR } from './ratings.js';
import { getTraits } from './traits.js';

/* Les interrupteurs de MESURE (`scripts/`), jamais du jeu : le navigateur n'a pas de `process` et prend les valeurs écrites. */
const MESURE = typeof process !== 'undefined' && process.env ? process.env : {};

/* ======================================================================
   LE PLATEAU
   ======================================================================
   Neuf colonnes, onze rangées. Les rangées 0 et 10 sont les filets : seuls
   les gardiens y vont. Les patineurs vivent sur les neuf rangées du milieu,
   soit 81 cases.

     r0    filet adverse           (gardien adverse)
     r1    l'enclave adverse       +3 au tir, et un retour si ça rate
     r2-3  la zone offensive       on peut tirer, sans le bonus
     r4-6  la zone neutre          r5 = la ligne rouge, la mise au jeu
     r7-9  ton territoire
     r10   ton filet               (ton gardien)

   JP, après avoir joué : *ya pas assez de cases et c'est trop facile aller
   vers l'enclave, limiter déplacement et agrandir le rink*. La glace faisait
   sept sur neuf — 49 cases jouables — et un ailier à PA 6 la traversait
   presque d'un seul élan. Trois choses ont bougé ENSEMBLE, parce qu'aucune ne
   tient seule (mesuré sur 130 matchs par géométrie) :

     agrandir seul       7×11 à patin plein : 3,96 buts, et 30,5 cases
                         allumées d'un coup — illisible ET plat
     raccourcir seul     7×11 plafonné à 3 pas : 1,85 but. C'est l'ancienne
                         note du dépôt, et elle disait vrai
     les deux ensemble   9×11, patin plafonné à 4, huit présences par période,
                         l'enclave ramenée à UNE rangée qui vaut +3

   Ce qui rend la combinaison jouable, c'est que la zone offensive garde sa
   taille pendant que la glace s'allonge : allonger le rink allonge la ZONE
   NEUTRE, pas le territoire où on marque. Et le patin est plafonné en absolu
   (4) sur une glace plus grande, donc il est limité en RELATIF : quatre pas
   sur neuf rangées jouables au lieu de six sur sept.

   Mesuré après (130 matchs) : 81 cases jouables au lieu de 49, l'enclave
   atteinte dans 10 % des présences au lieu de 26, et la part du plateau
   allumée d'un coup passe de 50 % à 40 %.

   LE PATIN EN LIGNE DROITE a été essayé et écarté : huit rayons au lieu d'un
   éventail ramènent les cases allumées de 24,6 à 12,9, mais l'IA ne sait plus
   contourner le trafic et le score tombe à 1,9 but. C'est une bonne idée qui
   demande une autre IA.

   Tu attaques TOUJOURS vers le haut. Le plateau ne se retourne jamais : à
   la troisième période on ne veut pas se demander de quel bord on joue.
   ====================================================================== */

/*
 * DERRIÈRE LE FILET. JP : *une glace avec plus de cases, derrière le but*.
 *
 * Le filet occupait toute une rangée à chaque bout, donc la ligne des buts
 * était le bord du monde : pas de bureau de Gretzky, pas de tour du filet,
 * pas de passe de derrière que le gardien ne voit pas venir. Le filet est
 * maintenant UNE case (`estFilet`), posée sur sa ligne des buts ; les cases
 * à côté de lui se jouent, et une rangée entière existe derrière chaque
 * filet. La distance d'une ligne des buts à l'autre ne bouge pas
 * (`LONGUEUR`, huit rangées) : on n'allonge pas le chemin vers le filet —
 * c'est ce qui avait fait tomber les buts à 3,96 quand on l'avait essayé —
 * on ajoute du terrain derrière lui.
 */
/*
 * LA GLACE SE SUBDIVISE (S38). JP : *subdiviser beaucoup plus la glace*. Treize
 * colonnes sur dix-neuf rangées — seize d'une ligne des buts à l'autre, une
 * derrière chaque filet, 245 cases jouables au lieu de 117. Le pas d'une pièce
 * suit sa vitesse (`pasDe`, 3 à 6) et son souffle : traverser prend de trois à
 * six tours, et le rayon d'un défenseur (`rayonDe`) a la place d'exister.
 */
export const COLS = 13;
/*
 * VINGT-TROIS RANGÉES (S42). JP, après avoir joué : *je pense juste que les
 * joueurs peuvent trop rapidement traverser la glace*. Il avait raison sur
 * la PROPORTION : à seize rangées entre les lignes des buts, un ailier à PA
 * 6 en couvrait cinq d'un seul élan, soit 31 % de la glace en un clic, et un
 * patineur moyen traversait en quatre mains.
 *
 * RALENTIR LE PAS A ÉTÉ ESSAYÉ TROIS FOIS ET ÉCARTÉ, mesuré : le porteur
 * seul (il devient une proie, buts 4,66 → 3,35), tout le monde (2-3-4 pas :
 * la zone offensive tombe de 13 à 11 % des mains et les buts à 4,50 ; 2-2-3 :
 * 8 % et 3,05), et tout le monde avec une passe qui porte plus loin (aucun
 * effet, 4,37). C'est la vieille trouvaille du dépôt : raccourcir le patin
 * sans agrandir la glace la rend plate, parce que la rondelle meurt encore
 * plus au neutre.
 *
 * C'est donc la GLACE qui s'allonge, pas le pas qui raccourcit — et la zone
 * offensive suit (`PORTEE_TIR` 5 → 7) pour que le neutre ne soit pas le seul
 * à grandir, ce qui était l'erreur des essais de S13. Vingt rangées à
 * traverser au lieu de seize : cinq mains pour un patineur moyen au lieu de
 * quatre, et un rapide couvre 25 % de la glace par élan au lieu de 31 %.
 * Mesuré (30 matchs) : la zone offensive garde ses 13 % des mains, les
 * possessions avec un tir passent de 40 à 42 %, les lancers de 14,0 à 15,1,
 * les buts de 5,13 à 5,22, et le sens d'attaque change une main sur 5,2 au
 * lieu de 4,8. La case du plateau descend de 29,4 à 26,4 px sur un téléphone
 * de 390 px, et la glace s'approche des proportions d'une vraie patinoire.
 */
export const RANGS = Number(MESURE.RANGS) || 23;
export const FILET_HAUT = 1;                  // la ligne des buts du haut ; la rangée 0 est derrière
export const FILET_BAS = RANGS - 2;           // celle du bas ; la dernière rangée est derrière
export const BUT_COL = (COLS - 1) / 2;        // le centre du filet
export const RANG_MIN = 0, RANG_MAX = RANGS - 1;   // les patineurs vont partout, sauf dans les deux filets
export const MI_GLACE = (RANGS - 1) / 2;      // la ligne du centre, où on met au jeu
export const LONGUEUR = FILET_BAS - FILET_HAUT;   // d'une ligne des buts à l'autre
/** Le filet lui-même : une seule case, où personne ne va sauf le gardien. */
export const estFilet = (r, c) => (r === FILET_HAUT || r === FILET_BAS) && c === BUT_COL;

/*
 * LA GLACE EST DÉCRITE PAR SA TAILLE, JAMAIS PAR SES NOMBRES.
 *
 * `BUT_COL`, les bandes de `natureCase`, les places de départ et la valeur
 * qu'une case a pour l'IA étaient écrites en dur pour une glace de 7 sur 9 :
 * le centre du filet valait 3, l'enclave allait de la colonne 1 à la 5, le
 * repli commençait à six cases du filet, et la valeur d'une case était
 * `10 − distance`. Changer une seule dimension cassait les quatre en silence
 * — une valeur de case NÉGATIVE au fond de la glace, une enclave décentrée,
 * deux pièces hors du plateau à la mise au jeu. Tout se dérive maintenant de
 * COLS et RANGS, donc la géométrie se règle en changeant deux nombres.
 */

/** La zone offensive garde la MÊME taille quelle que soit la longueur de la glace. */
export const RANGS_ENCLAVE = 2;               // les deux rangées collées au filet (S38 : la glace a doublé)
export const DEMI_ENCLAVE = 3;                // sa largeur, de part et d'autre du filet
/*
 * LA PLACE PORTE LE SEUIL DU TIR, LE JOUEUR PORTE LE MODIFICATEUR.
 *
 * Mesuré sur 5 492 occasions de tir (S26) : la place — +4 d'enclave, −2 de
 * distance, −1 de coin, les bâtons — remplissait à elle seule la borne ±2
 * dans 64 % des cas. Sur deux tirs sur trois, ni le TI du tireur, ni l'AR du
 * gardien, ni l'habileté, ni le tir signature ne changeaient quoi que ce
 * soit : la place décidait tout, le joueur rien. La place fixe donc le SEUIL
 * (3+ de l'enclave, 4+ de la deuxième rangée, 5+ de la pointe et des coins,
 * 6+ pour le tour du filet), et la borne ±2 est tout entière au joueur.
 */
/*
 * LA PLACE, C'EST CE QUE LE GARDIEN AJOUTE À SON DÉ (S40). Collé au filet il
 * n'ajoute rien, à la deuxième rangée de l'enclave +1, de la pointe et des
 * angles +2, sur un tour du filet +3. Le tireur, lui, ajoute son TI, sa
 * signature, moins les bâtons devant lui. TI 4 contre AR 4 : 42 % collé au
 * filet, 28 % à la deuxième rangée, 17 % de loin — les buts viennent du
 * volume et des retours, comme au hockey.
 */
export const PLACE_GARDIEN = { enclave: 1, rangee2: 2, pointe: 3, coin: 3, tour: 4 };

/*
 * LA PORTÉE DU TIR : on ne tire que de la zone offensive.
 *
 * JP, après avoir joué : *buts randoms du milieu ?*. Mesuré sur 200 matchs,
 * il avait raison et c'était pire qu'aléatoire — la géométrie du jeu était à
 * l'ENVERS :
 *
 *   distance 1-2 (l'enclave)      74 % et 64 % des tirs entraient
 *   distance 3   (la pointe)      40 %
 *   distance 5   (le centre)      78 %
 *   distance 7   (son propre bout) 75 %
 *
 * Vingt-huit pour cent des buts venaient de la zone neutre ou de plus loin,
 * et un tir pris du fond de son territoire avait un MEILLEUR modificateur
 * (+1,09) qu'un tir de l'enclave (+0,84). La raison : la pénalité de distance
 * était plafonnée à −2 pendant le réglage arcade, alors que les bâtons qui
 * gênent un tir devant le filet valent −2 à −3. Se planter au centre de la
 * glace, où il n'y a personne, était donc le meilleur endroit pour marquer.
 *
 * Une pénalité plus forte n'aurait rien réglé : la borne à ±2 écrase déjà
 * tout ce qui dépasse (le brut valait −4,6 à la pointe et −2,4 au centre, et
 * les deux tombaient à −2), et le 6 qui réussit toujours donne un but à
 * n'importe quel tir une fois sur six. C'est une RÈGLE qui manquait, pas un
 * chiffre : on ne tire pas de sa propre zone. Au-delà de la ligne bleue,
 * ce n'est pas un tir, c'est un dégagement, et le geste n'est pas offert.
 *
 * ELLE RESTE À TROIS, MÊME SUR UNE GLACE PLUS LARGE. Portée à quatre, elle
 * laisserait tirer de la ligne rouge sur neuf rangées — exactement ce que
 * cette règle avait retiré. C'est l'ENCLAVE qui a rétréci, pas le droit de
 * tirer : on tire toujours d'aussi loin, mais le point qui paie est plus petit.
 */
/*
 * HUIT RANGÉES DE ZONE OFFENSIVE (S42). Sept tenait la proportion de S38,
 * mais la diagonale à deux pas rend le filet plus dur à atteindre en biais :
 * à sept, les buts tombaient à 4,70 et la zone offensive ne voyait que 11 %
 * des mains. À huit, on tire d'un peu plus loin et le jeu s'y installe —
 * 18 % des mains s'y jouent au lieu de 11, 41 % des possessions finissent
 * par un tir, et la conversion descend à 30 % : le gardien travaille.
 */
export const PORTEE_TIR = Number(MESURE.TIR_PORTEE) || 8;

/** Le filet qu'une équipe attaque : 'A' monte, 'B' descend. */
export const filetDe = cote => (cote === 'A' ? FILET_HAUT : FILET_BAS);
/** Le sens de l'attaque vers ce filet : +1 quand les rangées croissent en s'en éloignant. */
export const sensDe = but => (but === FILET_HAUT ? 1 : -1);
/**
 * LA PROFONDEUR d'une case devant le filet qu'on attaque : 1 collé au filet,
 * 3 à la ligne bleue, 0 SUR la ligne des buts (à côté du filet), négative
 * DERRIÈRE. C'est le nombre que toute la géométrie lit — jamais une distance
 * absolue, qui ferait d'une case derrière le filet une case collée devant.
 */
export const profondeur = (r, but) => (r - but) * sensDe(but);

/** « 1re », « 2e » : l'ordinal féminin d'une période. */
export const ordP = n => (n === 1 ? '1re' : `${n}e`);

/** La profondeur d'une pièce devant le filet qu'elle attaque (négative : derrière). */
export const distanceAuFilet = (m, piece) => profondeur(piece.r, eqDe(m, piece.eq).but);

/**
 * Peut-elle tirer d'où elle est ? Depuis la zone offensive — et depuis les
 * deux cases collées au filet sur la ligne des buts : c'est le TOUR DU FILET,
 * un tir de coin. Jamais de derrière.
 */
/** D'où l'on peut tirer, par les coordonnées : la zone offensive, ou les deux cases collées au filet sur la ligne des buts. */
export const peutTirerDe = (r, c, but, vide = false) => {
  const s = profondeur(r, but);
  /*
   * LE PRIX DU FILET DÉSERT (S46). JP : *fix le prix du filet désert*.
   * Retirer son gardien donnait un patineur de plus et ne coûtait presque
   * rien : mesuré, le 5e décile cessait de battre le 10e (54 sur 100 au
   * lieu de 60 au plancher) — ce sont les équipes FAIBLES qui en profitaient,
   * parce qu'elles tirent de l'arrière plus souvent.
   *
   * Le prix manquait, et c'est une règle de hockey, pas un chiffre : DANS UN
   * BUT VIDE, ON TIRE DE PARTOUT. Un dégagement du fond de sa zone est un
   * but s'il trouve le filet — c'est l'image même du « empty netter », et
   * c'est ce que risque l'équipe qui retire son gardien. La portée de tir
   * ne la protège plus.
   */
  if (vide) return s >= 1 || (s === 0 && Math.abs(c - BUT_COL) === 1);
  return (s >= 1 && s <= PORTEE_TIR) || (s === 0 && Math.abs(c - BUT_COL) === 1);
};
/** Le filet visé par cette pièce est-il vide ? */
export const filetVide = (m, piece) => !!eqDe(m, adverse(piece.eq)).piece_g.sorti;
export const peutTirer = (m, piece) => !piece.gardien
  && peutTirerDe(piece.r, piece.c, eqDe(m, piece.eq).but, filetVide(m, piece));

/** La nature d'une case, du point de vue de l'équipe qui attaque vers `but`. */
/*
 * L'ÉCHELLE DES ZONES NE LAISSE AUCUN TROU.
 *
 * Elle en avait un : l'enclave ramenée à UNE rangée, la pointe fixée à la
 * troisième, la rangée d = 2 tombait dans le `neutre` — alors qu'on y tire
 * (`PORTEE_TIR` vaut 3) et qu'elle est collée au filet. Les coins collés au
 * but disparaissaient du même coup, donc tirer de l'angle ne coûtait plus
 * rien. La zone offensive se dérive maintenant de PORTEE_TIR : tout ce d'où
 * l'on peut tirer est de la zone offensive, l'enclave en est le coeur, et
 * tout ce qui déborde en largeur est un coin, quelle que soit la distance.
 */
export function natureCase(r, c, but) {
  const s = profondeur(r, but);
  if (s === 0 && c === BUT_COL) return 'filet';
  // DERRIÈRE LE FILET, et sur la ligne des buts à côté de lui : on n'y tire
  // pas, on y passe. Les deux cases collées au filet sont un coin — le tour
  // du filet se tente de là.
  if (s < 0) return 'derriere';
  if (s === 0) return Math.abs(c - BUT_COL) === 1 ? 'coin' : 'derriere';
  const large = Math.abs(c - BUT_COL) > DEMI_ENCLAVE;
  if (s <= RANGS_ENCLAVE) return large ? 'coin' : 'enclave';
  if (s <= PORTEE_TIR) return large ? 'coin' : 'pointe';
  // La zone neutre est ce qui reste entre les deux zones offensives ; au-delà,
  // c'est chez soi — jusque derrière son propre filet.
  if (s <= LONGUEUR - PORTEE_TIR) return 'neutre';
  return 'repli';
}

/** Une case où un patineur peut être : sur la glace, et pas dans un filet. */
const dansLaGlace = (r, c) => r >= RANG_MIN && r <= RANG_MAX && c >= 0 && c < COLS && !estFilet(r, c);
export const caseJouable = dansLaGlace;
/** La distance du plateau : un roi d'échecs, donc les diagonales valent un. */
export const dist = (a, b) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));

/* ======================================================================
   LES QUATRE NOMBRES D'UNE PIÈCE
   ======================================================================
   Tous dérivés de formules qui existent déjà dans le dépôt, tous ramenés sur
   la même échelle de 1 à 6 — l'échelle d'un dé, parce que c'est ce qu'on
   lit sur une carte de jeu de table et que le modificateur se calcule de
   tête : un nombre vaut `nombre − 3` au jet.

     PA  patin       de combien de cases tu bouges
     MA  maniement   passer, recevoir, esquiver, ramasser
     TI  tir         faire entrer la rondelle
     FO  force       enlever la rondelle, et la garder
     SO  souffle     combien de présences il tient avant de changer

   Le gardien n'en a qu'un, AR (arrêt), et il vient de `facteurGardienDe` —
   le même rapport au % d'arrêts de SA ligue que le moteur par événements
   utilise. Un ,920 de 1975 et un ,920 de 2015 ne valent donc pas pareil,
   comme partout ailleurs ici.
   ====================================================================== */

const borne = (x, a, b) => Math.max(a, Math.min(b, x));
const surSix = x => borne(Math.round(x), 1, 6);

/** Le centile de robustesse mesuré, posé dans le shard (`mr`) ; 0,5 par défaut. */
const robu = p => (typeof p?.mr === 'number' ? p.mr : 0.5);

export function statsDeTable(p) {
  if (!p) return { PA: 3, MA: 3, TI: 3, FO: 3, SO: 3, AR: 3, gb: GABARIT_MOYEN, ts: 'P' };
  if (p.p === 'G') {
    // facteurGardienDe : combien il laisse passer. Plus c'est bas, meilleur.
    const tg = new Set(getTraits(p).map(t => t.cle));
    const vole = tg.has('VEZINA') ? 'VEZINA' : tg.has('VOLEUR') ? 'VOLEUR' : null;
    return {
      PA: 2, MA: 3, TI: 1, FO: 3, DE: 3, SO: 9,
      AR: surSix(8 - 4.2 * facteurGardienDe(p) + (vole ? 1 : 0)),
      gb: gabaritDe(p), ts: 'P', traits: vole ? { AR: vole } : {},
    };
  }
  const vol = lancersRelDe(p);        // 0,25 à 2,60 — son volume de rondelles
  const fin = pctTirRelDe(p);         // 0,35 à 2,20 — sa finition
  const pas = passesRelDe(p);         // 0,25 à 3,00 — ses passes
  const traits = new Set(getTraits(p).map(t => t.cle));
  const estD = p.p === 'D' || p.p === 'LD' || p.p === 'RD';

  // LE PATIN. Un joueur de la LNH patine ; l'écart est mince et c'est voulu,
  // sinon la moitié du plateau devient injouable. Trois cases de base, une de
  // plus pour une réputation de vitesse ou pour qui va chercher beaucoup de
  // rondelles, une de moins pour un défenseur et une autre pour un gros.
  //
  // Trois et non quatre, et c'est un choix d'ÉCRAN autant que de jeu : à
  // quatre pas sur une glace de sept colonnes, une pièce atteignait
  // trente-sept cases, et trente-sept cases allumées d'un coup, ça ne se lit
  // pas — on choisit au hasard faute de pouvoir comparer. À trois, on voit
  // ses options.
  /*
   * ON REPÊCHE SOUS UN JEU DE RÈGLES ET ON JOUE SOUS UN AUTRE. Le plateau
   * importait `getTraits` et n'en interrogeait QU'UN sur onze : ⚡ Vitesse.
   * La carte de sélection nommait le joueur par son archétype, son gabarit,
   * son tir signature et son habileté — et le Selke, le Norris, le Colosse
   * ou le Lancer redouté qu'on avait payés au repêchage ne changeaient
   * strictement rien une fois sur la glace.
   *
   * Chaque trait passe donc par un nombre QUI EXISTE DÉJÀ — « aucune cote
   * neuve » vaut ici aussi — et vaut +1, jamais plus :
   *
   *   ⚡ Vitesse                            PA, le patin
   *   💣 Lancer redouté                     TI, faire entrer la rondelle
   *   🪄 Créateur, 🛡️ Selke, 🧱 Norris,
   *   🔁 Bidirectionnel                     MA, le maniement — passer, et
   *                                         enlever la rondelle du bâton
   *   🥊 Colosse                            FO, la force
   *   🥅 Vezina, 🧤 Voleur                   AR, le gardien
   *
   * DEUX NE SONT PAS TRADUITS, ET C'EST DIT. 🧭 Meneur rend en prolongation
   * et en séries : le plateau n'a ni l'un ni l'autre comme canal, et lui
   * inventer un effet serait inventer une mécanique. 🏆 Conn Smythe ne rend
   * qu'en avril, et `statsDeTable` ne sait pas si le match est une série.
   *
   * Deux traits sur le même nombre ne s'additionnent pas — c'est la règle
   * des canaux d'équipe de `js/traits.js`, et elle vaut d'autant plus sur un
   * d6 où un point vaut deux crans de talent.
   *
   * ET LE NOMBRE RESTE SUR SIX. Premier jet : le bonus s'ajoutait APRÈS
   * `surSix`, donc Lidström sortait à MA 7 et Shanahan à TI 7 — hors de
   * l'échelle d'un dé. Pire, `md` vaut `round((stat − 3,5) / 1,8)`, donc un 7
   * rendait 2 au lieu de 1 : le trait aurait valu DEUX points de dé, quand
   * toute la règle « deux crans de talent pour un point » existe justement
   * pour que le talent ne décide pas seul.
   */
  const marques = {};
  const majore = (axe, ...cles) => {
    const t = cles.find(c => traits.has(c));
    if (t) marques[axe] = t;
    return t ? 1 : 0;
  };
  /*
   * DE, LA DÉFENSE (S38). JP : *ajouter rayon d'action autour des joueurs,
   * selon niveau défensif, où c'est plus difficile les passer*. Le sixième
   * nombre vient de `md`, la mesure défensive que le shard porte déjà (le
   * centile du différentiel corrigé, des points en désavantage et du temps
   * de glace, celui de l'étiquette 🧊 du repêchage) — aucune cote neuve. Il
   * fixe le RAYON du bâton (`rayonDe`), il est ce qu'on oppose au maniement
   * du porteur quand on tend le bâton (`modVol`) et ce que le porteur affronte
   * quand il déjoue (`modDejouer`). Le Selke, le Norris et le Bidirectionnel
   * le majorent, puisque c'est de ça qu'ils parlent ; le Créateur reste au
   * maniement.
   */
  const def = typeof p.md === 'number' ? p.md : 0.5;
  const bDE = majore('DE', 'SELKE', 'NORRIS', 'BIDIR');
  const bMA = majore('MA', 'CREATEUR');
  const bTI = majore('TI', 'TIR');
  const bFO = majore('FO', 'COLOSSE');

  let PA = 4;
  if (majore('PA', 'VITESSE')) PA++;
  if (vol >= 1.35) PA++;
  if (estD && robu(p) >= 0.85) PA--;
  if (estD) PA--;

  /*
   * LE SOUFFLE : combien de présences il tient avant d'être vidé. Il vient de
   * `r`, la sous-cote d'usure — c'est SA raison d'être dans ce dépôt (« le
   * moteur lit `d` pour la défensive d'équipe, `r` pour l'usure »). Le
   * nombre qu'on affiche est le souffle, jamais la cote : la règle « aucune
   * cote dans le DOM » tient, exactement comme PA vient de `lancersRelDe`.
   */
  const usure = getHiddenRatings(p).r ?? 50;
  const g = gabaritDe(p);

  return {
    PA: borne(PA + (g === GABARIT_PETIT ? 1 : g === GABARIT_MATADOR ? -1 : 0), 2, 6),
    MA: surSix(1.4 + 2.2 * pas + bMA),
    TI: surSix(0.9 + 2.6 * vol * fin + bTI),
    DE: surSix(1.2 + 5.0 * def + bDE),
    FO: borne(surSix(1.5 + 4.0 * robu(p)) + (g === GABARIT_MATADOR ? 1 : g === GABARIT_PETIT ? -1 : 0) + bFO, 1, 6),
    SO: borne(Math.round(1.4 + 3.1 * (usure - 30) / 45) + (g === GABARIT_MOYEN ? 1 : g === GABARIT_PETIT ? -1 : 0), 2, 6),
    AR: 3,
    gb: g,
    ts: TIRS[p.ts] ? p.ts : tirParDefaut(p),
    traits: marques,
  };
}

/* ======================================================================
   LES CINQ TIRS — la variété des gestes
   ======================================================================
   JP : *mises en échec, tirs, vitesse plus élevées, etc, faire variété
   d'actions* ; *t'as peut-être même accès aux informations de vitesse et
   pourcentage de tir et cie par la LNH*.

   Oui, en partie : `skater/shottype` de l'API donne les tirs et les buts de
   chaque joueur PAR TYPE, et `scripts/build_shards.py --gestes-only` en tire
   la signature de chacun (`ts` dans le shard). Ovechkin sort frappé,
   Draisaitl sur réception, Crosby et McDavid revers, les deux Tkachuk
   déviation, Matthews poignet — ça se reconnaît sans explication.

   La signature est ce qui DÉPASSE LA LIGUE, pas ce qui domine son propre
   total : à comparer les types entre eux, 774 joueurs sur 797 sortaient
   « poignet » en 2021-22, parce que tout le monde tire surtout du poignet.

   La colonne ne couvre que 2009-10 et après. Les quarante-cinq autres
   saisons prennent `tirParDefaut` — la position et l'archétype — et le jeu
   est le même pour tout le monde : c'est l'APTITUDE qui vient de la donnée
   quand elle existe, jamais l'existence de l'action. Même principe que
   `AVANTAGES_EPOQUE` pour l'avantage numérique.

   Chaque tir a un contexte où il vaut mieux que les autres, et c'est là tout
   l'intérêt : le plateau ne demande plus « tires-tu ? » mais « d'où ? ».
   ====================================================================== */

/*
 * LES ICÔNES NE SE RÉPÈTENT JAMAIS SUR LA MÊME CARTE. Le poignet portait 🎯,
 * la même icône que l'habileté Décoché, et la réception portait ⚡, celle du
 * trait Vitesse et de l'habileté Coup de patin — sur une carte qui nomme le
 * joueur par son tir ET son habileté, deux 🎯 côte à côte se lisaient comme
 * un doublon. Le poignet est le bâton (🏒), la réception est la flèche qui
 * part sans s'arrêter (🏹) ; les deux sont libres dans tout l'inventaire du
 * dépôt (archétypes, traits, gabarits, habiletés, mesures).
 */
export const TIRS = {
  P: { nom: 'Tir du poignet', icon: '🏒', desc: 'Bon partout, mauvais nulle part.', mod: () => 0 },
  F: { nom: 'Tir frappé', icon: '💣', desc: '+1 de loin (la pointe), −1 collé au filet.',
       mod: c => (c.loin >= 3 ? 1 : c.loin <= 1 ? -1 : 0) },
  E: { nom: 'Tir sur réception', icon: '🏹', desc: '+2 s\'il vient de recevoir la passe : le une-deux.',
       mod: c => (c.recu ? 2 : 0) },
  R: { nom: 'Revers', icon: '🌀', desc: '+1 sous la pression d\'un bâton adverse.',
       mod: c => (c.batons > 0 ? 1 : 0) },
  D: { nom: 'Déviation', icon: '🔻', desc: '+2 dans l\'enclave, −2 ailleurs : il vit devant le filet.',
       mod: c => (c.enclave ? 2 : -2) },
};

/* Avant 2009-10 : la position et l'archétype disent le tir. Un défenseur
 * décoche de la pointe, un franc-tireur tire du poignet, un attaquant de
 * puissance dévie devant le filet. */
function tirParDefaut(p) {
  if (!p) return 'P';
  const estD = p.p === 'D' || p.p === 'LD' || p.p === 'RD';
  const ak = archetypeKey(p);
  if (estD) return ak === 'OFF_D' || ak === 'TWO_WAY_D' ? 'F' : 'F';
  if (ak === 'POWER_FWD' || ak === 'ENERGY' || ak === 'CHECKER') return 'D';
  if (ak === 'OFF_PLAYMAKER' || ak === 'PLAYMAKER') return 'R';
  if (ak === 'SNIPER') return 'E';
  return 'P';
}

/* ======================================================================
   LE GABARIT — petit et rapide, moyen, matador
   ======================================================================
   JP : *donner différent bonus selon petit joueur rapide, moyen, matador*.

   Le gabarit (`gb` dans le shard) est un RANG DANS LA SAISON, calculé à
   l'étage 2 des cotes sur la vraie taille et le vrai poids de la LNH
   (`gabaritDeSaison`, js/ratings.js) : 6 pi 2 po et 200 livres, c'était un
   gros en 1975 et c'est la moyenne en 2020, donc un club de 1975 a autant de
   matadors qu'un club de 2020. C'est ce qu'il faut d'un jeu qui mélange les
   époques.

   Trois jeux de bonus, et c'est un vrai triangle — chacun bat un autre :

     🐇 PETIT ET RAPIDE   il patine (+1 PA) et se faufile (+1 à l'esquive),
                          mais il encaisse mal (−1 FO, et une mise en échec
                          le laisse au sol une présence de plus) et il donne
                          tout (−1 de souffle)
     ⚖️ MOYEN             il joue toute la soirée (+1 de souffle) et il garde
                          le jeu vivant (+1 à la passe) ; aucune faiblesse
     🐂 MATADOR           il frappe (+1 FO), une mise en échec ratée ne lui
                          coûte pas la présence, et il protège la rondelle
                          (un bâton adverse de moins à l'esquive) ; mais il
                          est lourd (−1 PA)

   Le petit se sauve du matador, le matador écrase le moyen dans le coin, le
   moyen est encore là en troisième période quand les deux autres soufflent.
   ====================================================================== */

export const GABARITS = {
  [GABARIT_PETIT]:   { cle: 'PETIT',   nom: 'Petit et rapide', icon: '🐇', desc: 'Il patine et se faufile, mais il encaisse mal et il s\'essouffle.' },
  // 🐇 🐎 🐂 : un triangle qui se retient sans légende. Le moyen portait ⚖️,
  // la même icône que l'archétype « Complet » de ratings.js — deux étiquettes
  // identiques côte à côte sur la carte, ça se lit comme un doublon.
  [GABARIT_MOYEN]:   { cle: 'MOYEN',   nom: 'Gabarit moyen',   icon: '🐎', desc: 'Aucune faiblesse : il joue toute la soirée et garde le jeu vivant.' },
  [GABARIT_MATADOR]: { cle: 'MATADOR', nom: 'Matador',         icon: '🐂', desc: 'Il frappe, il protège la rondelle, mais il est lourd.' },
};

/** Le gabarit d'un joueur ; moyen quand la taille et le poids manquent. */
export const gabaritDe = p => (p && (p.gb === 0 || p.gb === 1 || p.gb === 2) ? p.gb : GABARIT_MOYEN);

/* ======================================================================
   LES HABILETÉS — l'étage FFT
   ======================================================================
   Une par pièce, tirée de son ARCHÉTYPE, une utilisation par période. Chacune
   donne +2 sur UN type de geste : c'est assez pour renverser un jet difficile
   sans jamais le rendre automatique, et ça se retient sans tableau.

   L'archétype décrit la SAISON, pas la légende (règle du dépôt) : le même
   joueur porte Décoché l'année où il a marqué 92 buts et Passe voilée
   l'année où il a fait 163 passes. C'est exactement ce qu'on veut d'un jeu
   de table — deux cartes différentes pour deux saisons différentes.
   ====================================================================== */

export const HABILETES = {
  DECOCHE: { nom: 'Décoché', icon: '🎯', geste: 'tir', desc: 'Il tire sans s\'arrêter : +2 au tir.' },
  VOILEE:  { nom: 'Passe voilée', icon: '🪄', geste: 'passe', desc: 'La passe traverse les bâtons : +2 à la passe.' },
  ACTIF:   { nom: 'Bâton actif', icon: '🧊', geste: 'echec', desc: 'Il lit le jeu : +2 à la mise en échec.' },
  EPAULE:  { nom: 'Coup d\'épaule', icon: '🥊', geste: 'echec', desc: 'Il finit sa mise en échec : +2, et un échec ne cause pas de revirement.' },
  PATIN:   { nom: 'Coup de patin', icon: '⚡', geste: 'esquive', desc: 'Il se défait de la couverture : +2 à l\'esquive.' },
};

const HABILETE_PAR_ARCHETYPE = {
  SNIPER: 'DECOCHE', POWER_FWD: 'EPAULE', SKILLED_FWD: 'DECOCHE', OFF_D: 'DECOCHE',
  OFF_PLAYMAKER: 'VOILEE', PLAYMAKER: 'VOILEE', TWO_WAY_D: 'VOILEE',
  TWO_WAY_FWD: 'ACTIF', STAY_D: 'ACTIF', CHECKER_D: 'ACTIF', CHECKER: 'ACTIF',
  ENERGY: 'EPAULE', DEF_D: 'EPAULE',
};

export function habileteDe(p) {
  if (!p || p.p === 'G') return null;
  const traits = new Set(getTraits(p).map(t => t.cle));
  // Une réputation de vitesse prime : c'est ce qu'un amateur nommerait en
  // premier de ce joueur-là, avant son archétype de la saison.
  if (traits.has('VITESSE')) return 'PATIN';
  return HABILETE_PAR_ARCHETYPE[archetypeKey(p)] || 'ACTIF';
}

/* ======================================================================
   LES DÉS
   ======================================================================
   Un d6, visible. On réussit à 4 et plus, modificateurs compris — donc un
   geste ordinaire passe une fois sur deux, et c'est le modificateur qui fait
   toute la différence entre un joueur et un autre.

   Tout passe par le générateur graine de sim.js : même graine, même match.
   ====================================================================== */

/*
 * LE DUEL : UN DÉ CHACUN, PLUS SA STAT (S40). JP : *ça devrait être un check
 * de la stat du joueur de l'action, du joueur adverse si nécessaire, et un
 * dé chaque, non ?* ; et *toutes les stats doivent amener des résultats
 * réalistes, avec des % qui font que rien n'est systématique, mais probable
 * réaliste*. C'était un seul d6 plus la DIFFÉRENCE des deux cotes ramenées
 * sur trois crans, contre un seuil : juste en probabilité, illisible sur la
 * glace. Maintenant : celui qui agit lance un d6 et ajoute SA stat ; celui
 * qui subit lance le sien et ajoute la SIENNE (le gardien son AR, le
 * défenseur son DE ou son FO) ; le plus haut l'emporte, l'égalité reste au
 * défenseur. Quand personne ne s'oppose (une passe que rien ne couvre, un
 * dégagement), le geste se compare à une DIFFICULTÉ fixe. Les stats entrent
 * telles quelles, de 1 à 6 : l'écart de talent se lit dans le duel, et les
 * situations (la place du tir, la distance de la passe, la protection du
 * porteur, la couverture, le souffle) s'ajoutent d'un côté ou de l'autre.
 *
 * RIEN N'EST SYSTÉMATIQUE : le 6 de l'attaquant réussit toujours, son 1
 * échoue toujours. Tout reste donc entre 17 et 83 %, quel que soit l'écart —
 * et entre deux joueurs égaux, un geste passe 42 fois sur 100 (l'égalité au
 * défenseur), +1 de stat en vaut 58, +2 en vaut 72, −1 en vaut 28. C'est
 * l'échelle du hockey : un tir de l'enclave, TI 4 contre AR 4, entre 42 fois
 * sur 100 ; de la pointe (le gardien +2), 17 ; une passe libre à courte
 * distance, 83 ; la même sous un bon bâton, 28.
 */
export const AXE_MOT = {
  PA: 'Patin : de combien de cases il bouge',
  MA: 'Maniement : passer, esquiver, protéger la rondelle',
  TI: 'Tir : faire entrer la rondelle',
  FO: 'Force : enlever la rondelle, et la garder',
  DE: 'Défense : le rayon de son bâton — plus dur à passer, à contourner, à déjouer',
  SO: 'Souffle : chaque geste en coûte un, et le manque ralentit tout',
  AR: 'Arrêt : ce que le gardien laisse passer, ramené sur un dé',
};

/**
 * Un duel : `a` ce que celui qui agit ajoute à son dé, `b` ce que l'autre
 * ajoute au sien (ou la difficulté fixe si `opp` est faux), `mots` les deux
 * stats qu'on lit, `rondelle` vrai quand celui qui agit A la rondelle.
 *
 * L'ÉGALITÉ VA À LA RONDELLE (S41). Elle allait à celui qui subit, donc le
 * porteur était le perdant présumé de chaque duel : 42 % pour garder,
 * passer, feinter à talent égal — et les possessions mouraient en une
 * main. Au hockey, la rondelle appartient à qui l'a : l'égalité est au
 * porteur, qu'il agisse (esquive, passe, feinte, tir) ou qu'on la lui
 * dispute (frapper, harponner). Sans rondelle en jeu, elle reste à qui subit.
 */
export const duel = (a, b, opp, mots, rondelle = false, brut = null) => ({ a, b, opp, mots, rondelle, brut });
/** Le même duel avec un bonus d'habileté sur l'attaquant. */
export const avec = (d, n) => (n ? { ...d, a: d.a + n } : d);
/** L'écart entre ce qu'on ajoute au dé et la stat brute : ce que la situation a donné ou retiré. */
export const ecartDuel = d => (d.brut ? [d.a - d.brut[0], d.opp && d.brut[1] !== null ? d.b - d.brut[1] : 0] : [0, 0]);

/*
 * UN 6 NATUREL GAGNE, UN 1 NATUREL PERD — DES DEUX CÔTÉS. La règle ne
 * valait que pour l'attaquant : le pire tireur devant le meilleur gardien
 * gardait son 6 (17 %), mais le meilleur devant le pire n'échouait que sur
 * son 1 (83 %). Étendue aux deux dés, l'échelle va de 25 à 72 % au lieu de
 * 17 à 83, et la pente au centre ne bouge pas (33 / 44 / 56 / 64) : le
 * talent décide autant, les extrêmes ne sont plus une formalité. Quand les
 * deux font 6 (ou 1), c'est le total qui tranche.
 */
const haut = d => d === 6, bas = d => d === 1;
const naturel = (dA, dB) => (haut(dA) && !haut(dB) ? true : haut(dB) && !haut(dA) ? false : bas(dA) && !bas(dB) ? false : bas(dB) && !bas(dA) ? true : null);
/** Le gagnant d'un duel : les naturels d'abord, sinon le plus haut total, l'égalité au défenseur. */
const gagneLeDuel = (de, total, de2, total2, rondelle = false) => {
  const n = de2 === null ? (haut(de) ? true : bas(de) ? false : null) : naturel(de, de2);
  return n !== null ? n : (rondelle ? total >= total2 : total > total2);
};
const d6 = m => Math.floor(m.de() * 6) + 1;

/** Les chances de l'attaquant : les naturels, sinon dé + a > dé + b (ou > b sans adversaire). */
export function chances(a, b, opp = true, rondelle = false) {
  let n = 0, tot = 0;
  for (let dA = 1; dA <= 6; dA++) {
    if (opp) for (let dB = 1; dB <= 6; dB++) { tot++; if (gagneLeDuel(dA, dA + a, dB, dB + b, rondelle)) n++; }
    else { tot++; if (gagneLeDuel(dA, dA + a, null, b, rondelle)) n++; }
  }
  return n / tot;
}
export const chancesDe = d => chances(d.a, d.b, d.opp, d.rondelle);

/* ======================================================================
   LE MATCH
   ====================================================================== */

export const PERIODES = 3;
/*
 * CINQ PRÉSENCES PAR ÉQUIPE PAR PÉRIODE, quinze par match. Mesuré à six :
 * 2,78 buts au lieu de 2,53, mais le match s'allonge d'un cinquième et le
 * premier décile repasse à 97 victoires sur 100 contre le dixième. JP a
 * demandé « plus rapide » ; cinq est le réglage qui donne des pointages de
 * hockey (2-1, 3-2, 4-3, 1-0) dans le moins de tours possible.
 */
/*
 * UN TOUR, C'EST UNE MAIN CHACUN (S38). JP : *le bouger et action, c'est pour
 * un tour ; un joueur peut être utilisé à nouveau, mais selon son souffle et
 * vitesse, ça change ce qu'il peut faire*. Plus de plafond de mains, plus de
 * pièce épuisée pour le tour : à ta main, un déplacement et une action ;
 * puis la sienne ; c'est un tour. La même pièce peut jouer à chaque tour —
 * et c'est son souffle qui la freine (voir `pasDe`).
 */
/*
 * QUARANTE-QUATRE TOURS (S39). L'alternance stricte donne à la défense une
 * main entre chaque main d'attaque, et une attaque doit aboutir en une main :
 * à 35 tours, 3,2 buts avant la montée, 4,4 après ; 40 → 5,0, 44 → 5,4,
 * 48 → 6,0. `TOURS` dans l'environnement ne sert qu'à la mesure.
 */
/*
 * LE TEMPO VIENT DES POSSESSIONS (S41). Le nombre de tours par période est
 * passé de 6 à 52 au fil des chantiers : chaque fois qu'une règle faisait
 * tomber les buts, on remontait les tours au lieu de régler la règle. Une
 * période, c'est maintenant un nombre de fois que la rondelle CHANGE DE CAMP
 * (`donner` les compte), et elle finit au premier arrêt de jeu après. Les
 * buts viennent de ce qu'on fait de chaque possession — le tir qu'on crée,
 * le gardien qu'on affronte — jamais d'un bouchon de tours. Le plafond de
 * tours reste, comme garde-fou seulement : une possession qui n'en finit
 * pas ne bloque pas le match. `POSS` dans l'environnement ne sert qu'à la
 * mesure.
 */
/*
 * VINGT-DEUX POSSESSIONS (S42). C'était 26, et chaque possession durait 3,3
 * mains ; elles en durent 4,0 depuis que la rondelle perdue tombe sur place
 * au lieu d'être donnée à celui qui te l'a enlevée. À 26 le match montait à
 * 256 mains ; à 22 il en fait 218 — un peu plus qu'avant (191), et c'est ce
 * que les possessions ont gagné en longueur, pas du remplissage.
 *
 * VINGT ET UNE (S43). L'esquive ne se demande plus qu'à un bâton COLLÉ, donc
 * une possession meurt moins souvent en chemin : à 23, le plateau lisait
 * 6,21 buts et 19,7 tirs, au-dessus de la cible arcade. Trois réglages
 * mesurés à 240 matchs — 23 : 6,21 · 22 : 5,86 · 21 : 5,64 — et c'est 21
 * qui est retenu, pas 22 : 5,86 est DANS la cible mais sur son bord, et le
 * dépôt a déjà payé cette erreur-là (S38 lisait 5,95 au banc d'essai et
 * l'Action pouvait le lire rouge). À 21, les tirs retombent à 17,5, tout
 * près des 18,1 d'avant la règle : le curseur rend le tempo, il ne change
 * pas ce qu'une possession vaut.
 */
/*
 * QUATORZE (S45). JP : *les buts, ça devrait être 0-6 par équipe genre*. La
 * cible arcade était la MOYENNE, 5 à 6 — ce qui donne du 7-6 et du 8-6 tous
 * les soirs et jamais un blanchissage : une moyenne ne dit pas ce qu'un
 * pointage a l'air. Ce qu'il demande est une FOURCHETTE, et c'est elle que
 * `check_table` juge maintenant.
 *
 * Deux leviers mesurés à 240 matchs. LE GARDIEN (`GARDIEN_PLUS` à 2) garde
 * les tirs (16,6) mais ne descend qu'à 4,82, et il est DISQUALIFIÉ par sa
 * propre mesure : 62 % des tirs tombent au plancher du duel (−3 et moins),
 * là où les naturels décident seuls et où le TI du tireur ne change plus
 * rien — exactement le défaut que S26 avait corrigé. LES POSSESSIONS
 * descendent, et le plancher du duel reste à 46 % comme à 21 : c'est le
 * seul levier qui ne touche pas à ce qu'un duel VAUT.
 *
 *   possessions   buts   tirs   pointages les plus fréquents        blanchissages
 *        21       5,47   15,8   7-6 (8 %), 8-6, 6-5                      0 %
 *        14       3,71   10,8   4-3 (13 %), 3-2 (10 %), 5-4             2,9 %
 *        12       3,02    9,3   3-2 (18 %), 4-3 (12 %), 2-1 (11 %)      4,4 %
 *
 * DOUZE, parce que JP a précisé : *ça peut dépasser 6, je veux dire que on
 * devrait rester dans les classiques 3-2 de hockey en général*. À 12 le 3-2
 * est le pointage le plus fréquent du plateau, le blanchissage redevient
 * possible, et 4 % des fiches dépassent encore six — permis, pas ordinaire.
 * Le prix est la longueur du match : 9,3 tirs par équipe au lieu de 15,8.
 */
export const POSSESSIONS_PAR_PERIODE = Number(MESURE.POSS) || 12;
/*
 * LA PROLONGATION EST COURTE, pour que la FUSILLADE existe. À huit
 * possessions et trois contre trois, la glace est si ouverte que quelqu'un
 * marque toujours : mesuré, 18 prolongations sur 120 matchs et ZÉRO
 * fusillade. Une règle qui ne se joue jamais est une règle qu'on casse sans
 * le savoir. Mesuré sur 160 matchs, 27 prolongations :
 *
 *   possessions   réglées en prolongation   allées en fusillade
 *        8                  18                       0
 *        3                  12                      15
 *        4                  16                      11
 *
 * QUATRE, parce que 59 % contre 41 % est le partage de la vraie ligue (la
 * LNH règle environ 60 % de ses prolongations avant la fusillade). On ne
 * règle pas un nombre sur un goût quand le hockey en donne un.
 * `POSS_PROL` dans l'environnement pour la mesure.
 */
export const POSSESSIONS_PROLONGATION = Number(MESURE.POSS_PROL) || 4;
export const PRESENCES_PAR_PERIODE = 60;   // le garde-fou : jamais plus de tours que ça dans une période
export const PRESENCES_PROLONGATION = 30;
/*
 * UNE SEULE PROLONGATION, PUIS LES TIRS DE BARRAGE (S46). Il y en avait
 * jusqu'à VINGT, et au-delà un bris d'égalité ÉCRIT — les lancers, puis les
 * mises en échec, puis l'équipe locale. Ce n'est pas du hockey, c'est un
 * pense-bête pour que le tournoi ait un gagnant. La vraie ligue joue une
 * prolongation à TROIS CONTRE TROIS, puis une fusillade, et les deux sont
 * des moments de match que le plateau savait déjà jouer : trois pièces au
 * lieu de cinq, et un duel TI contre AR par tireur.
 */
export const PROLONGATIONS_MAX = 1;
/*
 * TROIS CONTRE TROIS. La glace se vide, et c'est ce qui rend la
 * prolongation différente du reste du match plutôt qu'un rallongement.
 * `ROLES_PROLONGATION` — un centre, un ailier, un défenseur : la formation
 * que les vraies équipes envoient.
 */
export const ROLES_PROLONGATION = ['C', 'AG', 'DG'];
/** Les rôles qu'une équipe habille en ce moment : cinq, ou trois en prolongation. */
export const rolesEnJeu = m => (m && m.prolongation ? ROLES_PROLONGATION : null);

/* Les cinq cases d'une unité, et l'unité de chaque groupe. */
const CASES_F = ['AG', 'C', 'AD'];
const CASES_D = ['DG', 'DD'];

/**
 * Les cinq patineurs d'une présence : le trio `tri` et la paire `pai` de
 * l'alignement. C'est ici que le repêchage compte — quatre trios, trois
 * paires, et c'est toi qui décides qui saute sur la glace après chaque but.
 */
export function uniteDe(roster, tri, pai) {
  const par = (group, unit, role) => {
    const s = SLOTS.find(x => x.group === group && x.unit === unit && x.role === role && !x.scratch);
    return s ? roster[s.i] || null : null;
  };
  return [
    ...CASES_F.map(role => ({ role, p: par('F', tri, role) })),
    ...CASES_D.map(role => ({ role, p: par('D', pai, role) })),
  ];
}

/** Le gardien : le partant, sinon l'auxiliaire. */
export function gardienDe(roster) {
  const g0 = SLOTS.find(s => s.group === 'G' && s.unit === 0);
  const g1 = SLOTS.find(s => s.group === 'G' && s.unit === 1);
  return roster[g0.i] || roster[g1.i] || null;
}

/*
 * LES NEUF POINTS DE MISE AU JEU (S45). JP : *intégrer pénalités, hors jeux,
 * mise aux jeux*. La patinoire DESSINE ses neuf points depuis S33 — le
 * centre, quatre en fond de zone, quatre au neutre — et le moteur les
 * IGNORAIT : toute mise au jeu se jouait au centre, en reposant les dix
 * pièces à leur place de départ. Mesuré : 14 mises au jeu par match, toutes
 * au centre, toutes après un but ou une période. Les points étaient de la
 * décoration.
 *
 * Ils se déduisent de la taille de la glace, comme tout le reste ici : deux
 * colonnes d'aile (`MJ_COL`), la rangée de fond à trois du filet, la rangée
 * neutre juste à l'extérieur de chaque ligne bleue, et le centre. C'est le
 * MOTEUR qui les porte et `patinoireSvg` qui les lit — l'inverse aurait
 * laissé deux définitions libres de diverger.
 */
export const MJ_COL = [Math.round(COLS / 6), COLS - 1 - Math.round(COLS / 6)];
export const MJ_FOND = [FILET_HAUT + 3, FILET_BAS - 3];
export const MJ_NEUTRE = [FILET_HAUT + PORTEE_TIR + 2, FILET_BAS - PORTEE_TIR - 2];
export const MJ_CENTRE = { r: MI_GLACE, c: BUT_COL, nom: 'au centre' };
/*
 * LES POINTS SE DÉDOUBLONNENT, parce que la géométrie peut les faire
 * coïncider : à `PORTEE_TIR` 8 sur 23 rangées, la zone neutre ne fait
 * qu'UNE rangée, donc les deux points neutres tombent tous deux sur la
 * rangée du centre. Sept points distincts, pas neuf — et c'est la glace qui
 * le dit, pas une liste écrite à la main.
 */
export const POINTS_MJ = [
  MJ_CENTRE,
  ...MJ_FOND.flatMap(r => MJ_COL.map(c => ({ r, c, nom: 'en fond de zone' }))),
  ...MJ_NEUTRE.flatMap(r => MJ_COL.map(c => ({ r, c, nom: 'au neutre' }))),
].filter((pt, i, all) => all.findIndex(x => x.r === pt.r && x.c === pt.c) === i);
/** Le point de cette famille le plus proche d'un endroit. */
function pointProche(r, c, liste) {
  return liste.slice().sort((a, b) =>
    (Math.abs(a.r - r) + Math.abs(a.c - c)) - (Math.abs(b.r - r) + Math.abs(b.c - c)))[0];
}
/** Le point de fond de la zone que ce camp DÉFEND (une punition, un gel du gardien). */
const pointDeFond = (m, cote, c) =>
  pointProche(eqDe(m, cote).but, c, POINTS_MJ.filter(x => MJ_FOND.includes(x.r) && Math.abs(x.r - eqDe(m, cote).but) < RANGS / 2));
/** Le point neutre du bord de cette ligne bleue (un hors-jeu). */
const pointNeutre = (m, but, c) =>
  pointProche(but, c, POINTS_MJ.filter(x => MJ_NEUTRE.includes(x.r) && Math.abs(x.r - but) < RANGS / 2));

/* Les places d'une mise au jeu, en écart au POINT. Symétriques, jamais en
 * conflit, et chaque pièce dans son couloir : l'ailier gauche à gauche.
 * Le signe de la rangée va vers SON PROPRE filet — A défend en bas. */
/*
 * `X` EST L'ATTAQUANT SUPPLÉMENTAIRE : le sixième patineur qui entre quand
 * le gardien sort. Il lui faut un rôle à LUI — la clé d'un jeton est
 * l'équipe et le rôle, et les cinq autres sont pris — et une place, entre
 * le centre et l'aile.
 */
const ECARTS = {
  A: { AG: [1, -3], C: [1, 0], AD: [1, 3], DG: [4, -2], DD: [4, 2], X: [2, -1] },
  B: { AG: [-1, 3], C: [-1, 0], AD: [-1, -3], DG: [-4, 2], DD: [-4, -2], X: [-2, 1] },
};

/**
 * Une équipe sur le plateau. `roster` est un alignement de 23 (le tien, ou
 * celui d'un vrai club aligné par `autoRoster`) ; la table n'en habille que
 * cinq à la fois, plus le gardien.
 */
export function equipeDeTable(nom, tag, roster, cote) {
  return {
    nom, tag, roster, cote,
    gardien: gardienDe(roster),
    tri: 0, pai: 0,              // l'unité qui saute : premier trio, première paire
    relance: true,               // la relance d'équipe de la période
    buts: 0, tirs: 0, revirements: 0, echecs: 0,
    /*
     * LA FICHE VIT SUR L'ÉQUIPE, PAS SUR LA PIÈCE. `poser()` reconstruit les
     * cinq pièces à CHAQUE mise au jeu — donc après chaque but et chaque
     * période. Les compteurs portés par la pièce repartaient de zéro, et le
     * bilan d'un tournoi ne montrait que les buts marqués depuis la dernière
     * mise au jeu. Le joueur (`p`) est la clé, il ne change jamais.
     */
    fiches: new Map(),           // joueur -> { p, buts, passes, tirs, echecs, vols }
    arrets: 0, alloues: 0,       // ceux du gardien, pour la même raison
    /*
     * LE SOUFFLE. JP : *fatigue (changement)*. Chaque présence passée sur la
     * glace coûte un point ; à zéro, la pièce est essoufflée — un de moins à
     * tous ses jets et un pas de patin en moins. Un joueur au banc en reprend
     * un par présence. C'est ce qui rend les quatre trios et les trois paires
     * NÉCESSAIRES plutôt que décoratifs : on ne finit pas un match avec son
     * premier trio, comme on ne le fait pas dans la vraie vie.
     * Sur l'équipe, clé = le joueur : `poser()` reconstruit les pièces à
     * chaque mise au jeu, elles ne peuvent rien retenir (voir `fiches`).
     */
    souffle: new Map(),          // joueur -> souffle restant
    penalites: [],               // les punis : [{ role, tours, p }] — deux au plus (S38, S46)
    punitions: 0,
    // Le modificateur BRUT de chaque tir tenté, avant que la borne l'écrase :
    // c'est la seule façon de voir si le plateau offre des occasions ou si
    // tout le monde tire du fond de la patinoire (`check_table.mjs`).
    modsTir: [],
    modsPasse: [],
    pieces: [],
    but: filetDe(cote),
  };
}

/** La ligne de fiche d'un joueur dans son équipe, créée au besoin. */
function fiche(eq, joueur) {
  let f = eq.fiches.get(joueur);
  if (!f) { f = { p: joueur, buts: 0, passes: 0, tirs: 0, echecs: 0, vols: 0, punitions: 0 }; eq.fiches.set(joueur, f); }
  return f;
}

/**
 * La case libre la plus proche d'une case voulue, en spirale. Sert au
 * changement de trio : les cinq entrent par TON bout de glace, mais
 * l'adversaire est peut-être déjà campé là.
 */
function caseProche(prises, r0, c0) {
  for (let rayon = 0; rayon <= Math.max(COLS, RANGS); rayon++) {
    for (let dr = -rayon; dr <= rayon; dr++) for (let dc = -rayon; dc <= rayon; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== rayon) continue;
      const r = r0 + dr, c = c0 + dc;
      if (!dansLaGlace(r, c)) continue;
      if (prises.has(`${r},${c}`)) continue;
      return { r, c };
    }
  }
  return { r: r0, c: c0 };
}

/**
 * Pose les cinq patineurs d'une équipe à leurs places de mise au jeu.
 *
 * DEUX PIÈCES NE PARTAGENT JAMAIS UNE CASE, et c'est `changerUnite` qui l'a
 * cassé : à une mise au jeu on repose les DEUX équipes, et leurs places de
 * départ sont disjointes par construction (A rentre par les rangées 5 et 7, B
 * par les rangées 1 et 3) — mais un changement de trio en cours de jeu ne
 * repose QUE la tienne, et l'adversaire est peut-être campé sur ta place.
 * Mesuré par `check_regles.mjs` : deux pièces en 3,1 pendant trois présences.
 * Quand `m` est donné, la place occupée cède à la case libre la plus proche.
 */
/** Une pièce neuve pour un rôle, posée là ; son souffle part du maximum si elle n'a pas encore joué. */
function pieceNeuve(eq, role, p, r, c) {
  const st = statsDeTable(p);
  if (p && !eq.souffle.has(p)) eq.souffle.set(p, souffleMax(st));
  return {
    role, p, eq: eq.cote, r, c, st,
    hab: habileteDe(p),
    habDispo: true,      // une fois par période
    etourdi: 0,          // tours où la pièce ne peut pas agir
    agi: false,          // a déjà agi dans la main courante
    deplace: false,      // a déjà patiné dans la main courante
    buts: 0, passes: 0, tirs: 0,
  };
}

/*
 * `evite` ne sert QU'À NE PAS SE SUPERPOSER : c'est le match dont on lit les
 * pièces déjà posées, et il est nul pour la première équipe (l'autre n'a
 * pas encore bougé). `permis` est autre chose — les rôles qu'on habille —
 * et il devait être un paramètre à lui : lu depuis `evite`, l'équipe posée
 * en premier gardait cinq patineurs en prolongation.
 */
function poser(eq, evite = null, point = MJ_CENTRE, permis = null) {
  const unite = uniteDe(eq.roster, eq.tri, eq.pai);
  const prises = new Set();
  if (evite) {
    const autre = eq.cote === 'A' ? evite.B : evite.A;
    for (const x of autre.pieces || []) prises.add(`${x.r},${x.c}`);
  }
  eq.pieces = [];
  for (const { role, p } of unite) {
    // AU CACHOT (S38) : le rôle puni ne saute pas, l'équipe joue à quatre.
    if (eq.penalites.some(x => x.role === role)) continue;
    if (permis && !permis.includes(role)) continue;   // trois contre trois (S46)
    // LES PLACES SUIVENT LE POINT (S45) : les mêmes écarts qu'au centre,
    // ramenés dans la glace — en fond de zone, la ligne des buts est là et
    // un défenseur à quatre rangées derrière le point sortirait du monde.
    const [dr, dc] = ECARTS[eq.cote][role];
    const r0 = borne(point.r + dr, RANG_MIN, RANG_MAX);
    const c0 = borne(point.c + dc, 0, COLS - 1);
    const { r, c } = caseProche(prises, r0, c0);
    prises.add(`${r},${c}`);
    eq.pieces.push(pieceNeuve(eq, role, p, r, c));
  }
  const g = statsDeTable(eq.gardien);
  eq.piece_g = {
    role: 'G', p: eq.gardien, eq: eq.cote, gardien: true,
    r: eq.cote === 'A' ? FILET_BAS : FILET_HAUT, c: BUT_COL, st: g,
    arrets: 0, alloues: 0,
  };
}

/**
 * Un match sur table. `graine` le rend rejouable ; `presences` permet de le
 * raccourcir (les matchs de l'IA du tournoi se jouent au même nombre de
 * tours que le tien, sinon le classement ne voudrait rien dire).
 */
export function nouveauMatch(A, B, graine) {
  const de = generateur(graine);
  const m = {
    A, B, de,
    periode: 1,
    presence: 1,           // 1 à PRESENCES_PAR_PERIODE × 2 : un TOUR (les dix pièces) en vaut deux
    tour: 'A',             // à qui la main
    premier: 'A',          // qui ouvre la période
    dernier: null,         // le camp qui vient de jouer sa main : il ne rejoue jamais tout de suite (S39)
    main: mainNeuve(),   // le BUDGET de la main (S42) : un patin, une action, un placement, qui a patiné, et si on a changé de ligne
    mains: { A: 0, B: 0 },  // les mains jouées ce tour-ci : une chacune (S38)
    rondelle: null,        // { piece } ou { libre: {r, c} }
    possesseur: null,      // le camp qui a eu la rondelle en dernier (S41)
    possessions: 0,        // les changements de camp de la période : c'est ce qu'elle compte
    fil: [],               // les événements, le plus récent en tête
    fini: false,
    graine,
  };
  poser(A); poser(B);
  miseAuJeu(m, 'Mise au jeu au centre');
  return m;
}

/** Toutes les pièces sur la glace, gardiens compris. */
export const surLaGlace = m => [...m.A.pieces, ...m.B.pieces];
export const adverse = cote => (cote === 'A' ? 'B' : 'A');
export const eqDe = (m, cote) => (cote === 'A' ? m.A : m.B);
export const porteur = m => (m.rondelle && m.rondelle.piece) || null;
export const libre = m => (m.rondelle && m.rondelle.libre) || null;
export const caseLibre = (m, r, c) => !occupee(m, r, c);
const occupee = (m, r, c) => surLaGlace(m).find(x => x.r === r && x.c === c) || null;

/*
 * UN GESTE DÉPENSE L'ACTION DU TOUR (S36). JP : *un tour, ça devrait être un
 * déplacement et une action, pas nécessairement du même joueur*. La pièce
 * a agi (elle n'agira plus ce tour-ci) et le budget d'action de l'équipe
 * est dépensé ; le déplacement du tour, lui, reste à qui ne l'a pas encore
 * pris. Une pièce peut donc patiner puis agir, ou agir puis patiner, dans
 * le même tour d'équipe — ou laisser l'un des deux à un coéquipier.
 */
const agir = (m, piece) => { piece.agi = true; piece.libre = false; m.main.agi = true; depenser(m, piece); };

/*
 * CHAQUE GESTE COÛTE UN SOUFFLE (S38). Le souffle se payait par présence, quel
 * que soit ce qu'on y faisait ; maintenant qu'une pièce peut jouer à chaque
 * tour, c'est le GESTE qui coûte — patiner ou agir, un point chacun — et le
 * banc qui rend un point par tour. Une vedette qu'on fait jouer à tous les
 * tours se vide ; c'est là que les quatre trios servent.
 */
function depenser(m, piece) {
  if (!piece.p || piece.gardien) return;
  const eq = eqDe(m, piece.eq);
  eq.souffle.set(piece.p, Math.max(0, souffleDe(m, piece) - 1));
}
/** Le réservoir d'une pièce : deux gestes par point de SO. */
export const souffleMax = st => st.SO * 2;
/** Frais, fatigué (moins de la moitié), vide : ce que le souffle fait à la pièce. */
export const etatSouffle = (m, piece) => {
  const s = souffleDe(m, piece), max = souffleMax(piece.st);
  return s <= 0 ? 'vide' : s * 2 <= max ? 'fatigue' : 'frais';
};

/** Le souffle restant d'une pièce. */
export const souffleDe = (m, piece) => {
  if (!piece || !piece.p) return souffleMax(piece?.st || { SO: 3 });
  const eq = eqDe(m, piece.eq);
  const v = eq.souffle.get(piece.p);
  return v === undefined ? souffleMax(piece.st) : v;
};

/** Essoufflée : plus de souffle du tout. Un de moins à tous ses jets. */
export const essouffle = (m, piece) => souffleDe(m, piece) <= 0;
const malusSouffle = (m, piece) => (essouffle(m, piece) ? -1 : 0);

/** Les pas de patin d'une pièce, essoufflement compris. */
/*
 * LE PATIN EST PLAFONNÉ. `PA` va de 2 à 6 ; sans plafond, un ailier rapide
 * traversait presque la glace d'un seul élan, et le nombre de cases allumées
 * croît comme le CARRÉ du nombre de pas (un éventail de k pas en atteint
 * (2k+1)²). Le plafond est ce qui permet d'agrandir la glace sans rendre le
 * choix illisible : quatre pas sur neuf rangées jouables, au lieu de six sur
 * sept. Le talent se voit encore entre 2 et 4 ; il ne traverse plus le rink.
 */
/*
 * S42 : les quatre réglages du positionnement, lisibles dans
 * l'environnement POUR LA MESURE seulement (comme POSS et TOURS) ; le
 * navigateur n'a pas de `process` et prend les valeurs écrites.
 */
const PLACEMENT = MESURE.PLACEMENT !== '0';          // le deuxième déplacement de la main
const POSTES = MESURE.POSTES !== '0';                // chaque pièce tient son poste
const LIBRE_SUR_PERTE = MESURE.LIBRE_SUR_PERTE !== '0';   // la rondelle perdue tombe sur place
const RELANCE_RAMASSAGE = MESURE.RAMASSE !== '0';         // qui ramasse repart avec
const HORSJEU_FILTRE = MESURE.HJ_FILTRE === '1';          // S45 : 1 remet l'ancien filtre muet
/*
 * LE BUDGET DE PAS PARTAGÉ (S42). JP : *et si un tour, c'est une action et
 * un nombre de déplacement x, utilisable sur plusieurs joueurs ? Ça serait
 * plus dynamique, mais peut-être ça casse le jeu*. La main achète UNE action
 * et `POOL` pas à répartir sur n'importe quelles pièces — chacune bornée par
 * son propre PA, une fois par main — au lieu d'un patin entier pour une
 * pièce et d'un placement pour une autre.
 *
 * ÇA NE CASSE PAS LE JEU, ET C'EST MESURÉ à 0, 4, 6, 8 et 10 pas (40
 * matchs chacun, puis check_table à 6 et 8). L'éventail ne bouge pas
 * (chaque pièce garde son plafond : 25 cases allumées à tous les crans), la
 * zone offensive monte de 19 % des mains à 26 (X=6) et 29 (X=10), les pièces
 * qui bougent par main de 1,73 à 2,14 et 2,88, la rondelle immobile tombe
 * de 41 % à 35, et le match RACCOURCIT (215 → 201 mains) parce qu'une main
 * fait plus. X=4 est un recul : deux patins entiers font déjà six à dix pas.
 * Le prix monte avec X, et c'est le jeu physique qui le paie — personne
 * n'attrape plus personne : 15,7 mises en échec par équipe aujourd'hui,
 * 14,8 à 6, 12,3 à 8, 9,9 à 10 ; et à 8 les buts passent à 6,56, hors cible
 * sans ramener les possessions à 21. SIX garde le jeu physique, tient les
 * buts (5,73) et la parité (89 / 67 / 68 / 52) sans rien retoucher d'autre.
 *
 * ET IL EST ÉTEINT (S44). JP, après l'avoir joué : *un seul joueur
 * finalement vu souffle et vitesse*. C'est la réponse exacte à son propre
 * « utilisable sur plusieurs joueurs » d'en haut, et la raison qu'il donne
 * est la bonne : depuis S38, ce qui règle ce qu'une pièce peut faire, c'est
 * SON souffle (un point par geste, un réservoir de deux fois son SO) et SA
 * vitesse (son PA en pas) — deux quantités qui appartiennent au joueur.
 * Répartir un budget d'équipe par-dessus mettait une troisième limite, qui
 * n'appartenait à personne, devant les deux qui portent déjà le talent.
 * La main achète donc de nouveau UN patin, UNE action, et le PLACEMENT.
 * Mesuré à 240 matchs : 5,39 buts, 16,7 tirs, 12,8 mises en échec, 2,60
 * gestes par main (c'était 5,64 / 17,5 / 13,3 / 3,20 à six pas partagés).
 * `POOL` reste dans l'environnement pour la MESURE : 6 rend la main partagée.
 */
const POOL = MESURE.POOL !== undefined ? Number(MESURE.POOL) : 0;
/*
 * Ce que la place du gardien vaut EN PLUS. À +2 le tir cessait d'être pile
 * ou face (33 % au lieu de 47), mais 43 % des tirs tombaient AU PLANCHER —
 * sous −4, là où les naturels décident seuls et où le TI du tireur ne
 * change plus rien. À +1 il n'en reste que 30 %, l'écart va de −5 à +2, et
 * le tireur compte encore : c'est le réglage qui rend le gardien réel sans
 * rendre le tir aveugle.
 */
export const GARDIEN_PLUS = MESURE.GARDIEN !== undefined ? Number(MESURE.GARDIEN) : 1;
const TIR_AU_TIREUR = MESURE.TIR_EGALITE === '1';    // l'égalité au tireur : écartée, voir modTir
const VAL_RETOUR = MESURE.VAL_RETOUR !== undefined ? Number(MESURE.VAL_RETOUR) : 3;
export const PAS_MAX = 6;   // S38 : sur seize rangées, un ailier à PA 6 en fait six
/*
 * LE PATIN SUIT LA VITESSE, ET TRAVERSER PREND DES TOURS (S35). JP : *limite
 * les déplacements selon la vitesse du joueur, ça devrait prendre 3-5 tours
 * pour traverser la glace*. Un PA de 2 ou 3 vaut deux cases, 4 ou 5 en
 * valent trois, 6 en vaut quatre : de son propre territoire à l'enclave
 * adverse (sept rangées), un lent met quatre tours, un moyen trois, un
 * rapide deux — plus le tour du tir.
 */
/*
 * LE PAS SUIT LA VITESSE ET LE SOUFFLE (S38). Sur seize rangées, PA 2-3
 * donne trois cases, PA 4 quatre, PA 5 cinq, PA 6 six : le lent traverse en
 * six tours, le rapide en trois. Fatigué (moins de la moitié du souffle), une
 * case de moins ; vide, deux — et un de moins à tous ses jets, et plus
 * d'épaule. Une vedette qu'on fait jouer à tous les tours finit par patiner
 * comme un défenseur de quatrième paire : c'est ce qui fait changer de trio.
 */
/*
 * RALENTIR LE PORTEUR A ÉTÉ ESSAYÉ ET ÉCARTÉ (S42). L'idée se défendait :
 * si la rondelle voyage moins vite que les joueurs, on peut se placer
 * DEVANT le jeu. Mesuré sur 40 matchs, à deux cases de moins pour le
 * porteur, c'est l'inverse qui arrive — le porteur ralenti n'est pas un
 * jeu de position, c'est une proie : le sens d'attaque changeait 63 fois
 * par match au lieu de 57, la zone offensive tombait de 10 à 8 % des
 * mains, et les buts de 4,66 à 3,35. Ce qui manquait n'était pas de la
 * lenteur, c'était des JOUEURS AILLEURS QUE SUR LA RONDELLE (voir le
 * placement et les postes). Noté ici pour qu'on ne le redécouvre pas.
 */
export const pasDe = (m, piece) => {
  // S40 : trois pas à PA 2-3, quatre à PA 4-5, cinq à PA 6 — la vitesse se voit sans décider le match.
  const base = Math.min(PAS_MAX, piece.st.PA <= 3 ? 3 : piece.st.PA <= 5 ? 4 : 5);
  const etat = etatSouffle(m, piece);
  return Math.max(1, base - (etat === 'fatigue' ? 1 : etat === 'vide' ? 2 : 0));
};

/** Les vingt patineurs d'un alignement : les quatre trios et les trois paires. */
function tousLesPatineurs(roster) {
  const out = [];
  for (let u = 0; u < 4; u++) for (const { p } of uniteDe(roster, u, 0).slice(0, 3)) if (p) out.push(p);
  for (let u = 0; u < 3; u++) for (const { p } of uniteDe(roster, 0, u).slice(3)) if (p) out.push(p);
  return out;
}

/**
 * Le souffle après une présence : les cinq qui étaient sur la glace en
 * perdent un, tous les autres en reprennent un. Personne ne descend sous
 * zéro et personne ne dépasse son maximum.
 */
function respirer(eq) {
  // Sur la glace, le geste a déjà coûté (`depenser`) ; au banc, on reprend
  // un point par tour. Personne ne dépasse son maximum.
  const glace = new Set(eq.pieces.map(x => x.p).filter(Boolean));
  for (const p of tousLesPatineurs(eq.roster)) {
    if (glace.has(p)) continue;
    const max = souffleMax(statsDeTable(p));
    eq.souffle.set(p, Math.min(max, (eq.souffle.get(p) ?? max) + 1));
  }
}

/*
 * LA PRESSION (S41). JP : *on dirait que tu comprends pas le jeu, que c'est
 * juste random, tu as pas attaché les mécaniques ensemble de façon
 * cohérente*. Il y avait quatre mécaniques défensives passives (le rayon,
 * le poke passif, le bâton tendu, l'écran) et deux actives à 33 % qui
 * coûtaient l'échec, chacune avec ses constantes. Il n'y en a plus qu'UNE :
 * la pression sur la rondelle. Chaque patineur debout couvre les cases à une
 * de lui (deux pour un vrai défenseur, DE 5 et plus) : c'est son rayon, et
 * c'est SA POSTURE — il n'a rien à déclarer. La pression sur une case est le
 * nombre de rayons adverses qui la couvrent, et le meilleur DE d'entre eux.
 * Elle entre dans TOUS les duels du porteur, des deux bords : quand il
 * esquive, passe ou feinte, c'est ce DE-là qu'il affronte, et chaque bâton
 * de plus lui retire un ; quand on le frappe ou le harponne, c'est le même
 * malus qui joue contre lui. Un seul nombre, calculé d'une seule façon, et
 * l'écran le montre.
 */
export const rayonDe = piece => (piece.gardien ? 0 : piece.st.DE >= 5 ? 2 : 1);
/** Les adversaires debout dont le rayon couvre cette case. */
export const couvreurs = (m, cote, r, c) =>
  surLaGlace(m).filter(x => x.eq !== cote && !x.gardien && !x.etourdi && dist(x, { r, c }) <= rayonDe(x));
/** La pression sur une case, pour qui joue pour `cote` : combien de bâtons, et le meilleur. */
export function pression(m, cote, r, c) {
  const qui = couvreurs(m, cote, r, c);
  return { n: Math.min(3, qui.length), fort: qui.length ? Math.max(...qui.map(x => x.st.DE)) : 0, qui };
}
export const pressionDe = (m, piece) => pression(m, piece.eq, piece.r, piece.c);
/** Ce que la pression retire au porteur dans tout duel : un bâton, une chance ; chaque bâton de plus, −1 (deux au plus). */
export const malusPression = n => Math.min(2, Math.max(0, n - 1));
/** Le bâton le plus fort d'une pression, celui à qui la rondelle va quand le porteur la perd. */
const meilleurBaton = qui => qui.slice().sort((a, b) => b.st.DE - a.st.DE)[0] || null;

/*
 * UN BÂTON COLLÉ N'EST PAS UN RAYON (S43). JP : *éviter perte rondelle
 * déplacement SANS joueur adverse proche*. Le rayon d'un vrai défenseur
 * (DE 5 et plus) porte à DEUX cases, et l'esquive le lisait comme tous les
 * autres duels : on patinait avec personne à côté de soi, un dé tombait, et
 * la rondelle partait — de l'écran, ça ne se lit pas comme une couverture,
 * ça se lit comme du hasard. Le rayon garde tous ses autres emplois : il
 * coupe une ligne de passe, il pèse dans la feinte, la passe et le contact,
 * et il fait patiner le porteur au double du prix. Mais il ne DÉPOUILLE
 * personne à distance : le rayon coûte du TEMPS, le bâton collé coûte la
 * RONDELLE. `collesSur` est le seul endroit qui dit ce qu'est un bâton sur
 * la rondelle, et `batons` comme l'esquive le lisent là.
 */
export const collesSur = (m, cote, r, c) =>
  surLaGlace(m).filter(x => x.eq !== cote && !x.gardien && !x.etourdi && dist(x, { r, c }) === 1);
/** Un bâton adverse collé à cette case (le contact demande d'être collé). */
export function batons(m, cote, r, c) {
  return collesSur(m, cote, r, c).length;
}

/**
 * Un bloqueur de tirs vaut double devant le filet, par défaut : `bl`, les
 * tirs bloqués par match que `skater/realtime` donne depuis 2005-06 ; avant,
 * c'est la mesure défensive `md` qui répond. C'est l'aptitude qui vient de
 * la colonne, l'action existe pour les 55 saisons.
 */
export function ecranVaut(p) {
  if (!p) return 1;
  if (typeof p.bl === 'number') return p.bl >= 1.4 ? 2 : 1;
  return (p.md ?? 0) >= 0.80 ? 2 : 1;
}

/*
 * UN BÂTON NE GÊNE UN TIR QUE S'IL EST ENTRE LE TIREUR ET LE FILET. Un
 * défenseur dans le dos du tireur ne bloque rien ; celui qui est devant lui
 * compte un, deux si c'est un vrai bloqueur. C'est la seule pression qui
 * pèse sur un tir : de derrière, on ne bloque pas une rondelle.
 */
export function batonsTir(m, cote, r, c) {
  const but = eqDe(m, cote).but;
  const moi = profondeur(r, but);
  let n = 0;
  for (const x of surLaGlace(m)) {
    if (x.eq === cote || x.gardien || x.etourdi || dist(x, { r, c }) !== 1) continue;
    const sx = profondeur(x.r, but);
    if (sx > moi || sx < 0) continue;      // derrière le tireur, ou derrière le filet : il ne bloque rien
    n += ecranVaut(x.p);
  }
  return n;
}

/** Un voleur de rondelle : `tk`, les vols par match (2005-06+), sinon `md`. */
export const bonVoleur = p => (typeof p?.tk === 'number' ? p.tk >= 0.70 : (p?.md ?? 0) >= 0.80);
/** Un frappeur : `ht`, les mises en échec par match (2005-06+), sinon la robustesse mesurée. */
export const bonFrappeur = p => (typeof p?.ht === 'number' && p.ht > 0 ? p.ht >= 2.2 : (p?.mr ?? 0) >= 0.80);

function dire(m, texte, genre = '') {
  m.fil.unshift({ texte, genre, periode: m.periode, presence: m.presence });
}

/*
 * LA POSSESSION SE COMPTE À UN SEUL ENDROIT (S41). `donner` est la seule
 * façon de mettre la rondelle dans les mains de quelqu'un ; quand elle
 * change de camp, c'est un changement de possession, et c'est ce que la
 * période compte (voir `finirPresence`). Une rondelle libre n'est à
 * personne : la possession ne change que quand l'autre équipe la ramasse.
 */
/*
 * `compte` est faux quand c'est l'ARBITRE qui pose la rondelle (S45). Une
 * période, c'est N changements de camp — et une mise au jeu n'en est pas
 * un : c'est une reprise. En la comptant, chaque sifflet brûlait une
 * possession et raccourcissait la période ; mesuré, les tirs tombaient de
 * 16,7 à 13,2 et les buts de 5,39 à 4,52 le jour où les sifflets sont
 * arrivés. Le tempo n'avait pas changé, le compteur mentait.
 */
function donner(m, piece, compte = true) {
  const avant = m.possesseur;
  m.rondelle = { piece };
  piece.derniere = null;
  m.possesseur = piece.eq;
  if (compte && avant && avant !== piece.eq) m.possessions++;
}

/* ---------- la mise au jeu ---------- */

function miseAuJeu(m, mot, point = MJ_CENTRE) {
  // LE GARDIEN REVIENT À LA MISE AU JEU : on ne rejoue pas à six après un
  // but ni après un sifflet — on décide de ressortir, ou non.
  for (const cote of ['A', 'B']) if (eqDe(m, cote).desert) remettreGardien(m, cote);
  m.pointMJ = point;
  const permis = rolesEnJeu(m);
  poser(m.A, null, point, permis); poser(m.B, m, point, permis);
  const cA = m.A.pieces.find(x => x.role === 'C') || m.A.pieces[0];
  const cB = m.B.pieces.find(x => x.role === 'C') || m.B.pieces[0];
  // Le maniement ET la force : on gagne une mise au jeu des mains et du corps (S39).
  const jA = Math.floor(m.de() * 6) + 1 + Math.round((cA.st.MA + cA.st.FO) / 2);
  const jB = Math.floor(m.de() * 6) + 1 + Math.round((cB.st.MA + cB.st.FO) / 2);
  const gagnant = jA === jB ? (m.tour === 'A' ? cA : cB) : (jA > jB ? cA : cB);
  donner(m, gagnant, false);   // l'arbitre la pose : ce n'est pas un changement de camp
  dire(m, `${mot} — mise au jeu ${point.nom}, ${nomDe(gagnant)} la gagne.`, 'mj');
}

/*
 * L'ARRÊT DE JEU (S45). Le plateau n'en avait que deux — le but et la fin de
 * période — et tout le reste se réglait sans sifflet : le gardien qui gèle
 * la rondelle la gardait et la relançait, la punition retirait une pièce
 * sans rien arrêter, le hors-jeu n'existait pas. Un sifflet, c'est une
 * présence qui finit et une mise au jeu AU BON POINT : c'est ce qui donne
 * aux neuf points une raison d'être, et à la mise au jeu un enjeu.
 */
function arretDeJeu(m, mot, point) {
  m.arrets = (m.arrets || 0) + 1;
  m.siffle = { mot, point };
  finirPresence(m);
}

export const nomDe = piece => (piece && piece.p && piece.p.n) || 'Rappel';

/* ======================================================================
   LES SIX GESTES
   ======================================================================
   Patiner, Passer, Tirer et Feinter pour le porteur ; Frapper et Harponner
   pour qui défend. Chacun est un DUEL — un dé chacun plus sa stat, la
   pression en moins pour le porteur — et l'échec a UN tarif : avec la
   rondelle, c'est un revirement (elle va au défenseur qui t'a arrêté) ;
   un contact raté te laisse hors position jusqu'à la fin du tour. Rien
   d'autre, nulle part.
   ====================================================================== */

/**
 * L'ESQUIVE : quitter ou rejoindre une case où un bâton adverse est COLLÉ,
 * avec la rondelle. Ton maniement, +1 d'élan (au hockey, garder la rondelle
 * est le cas courant), +1 au petit gabarit, moins les bâtons de trop, contre
 * le meilleur de ceux qui te touchent au départ ou à l'arrivée. Un rayon qui
 * porte à deux cases ne prend pas la rondelle : voir `collesSur`.
 */
/** Les bâtons collés à un départ et à une arrivée, sans doublon. */
const batonsDuPatin = (m, piece, vers) =>
  [...new Set([...collesSur(m, piece.eq, piece.r, piece.c), ...collesSur(m, piece.eq, vers.r, vers.c)])];
export function modEsquive(m, piece, vers) {
  const qui = batonsDuPatin(m, piece, vers);
  const fort = qui.length ? Math.max(...qui.map(x => x.st.DE)) : 0;
  const petit = piece.st.gb === GABARIT_PETIT ? 1 : 0;
  return duel(piece.st.MA + 1 + petit + malusSouffle(m, piece) - malusPression(Math.min(3, qui.length)), fort, true, ['MA', 'DE'], true, [piece.st.MA, fort]);
}
/** Faut-il esquiver pour aller là ? (avec la rondelle, et un bâton COLLÉ au départ ou à l'arrivée) */
export const esquiveRequise = (m, piece, vers) =>
  porteur(m) === piece && !piece.libre && batonsDuPatin(m, piece, vers).length > 0;

/**
 * LA PASSE : à un coéquipier, ou au fond de la zone adverse (la case d'un
 * coin, ou derrière le filet — c'est le dump-and-chase, et la rondelle y
 * est libre). Ton maniement, la distance (+1 à trois cases, −1 à sept, −2 à
 * dix), +1 au gabarit moyen, +1 de derrière le filet vers l'enclave, −1 si
 * le receveur est maladroit (MA 1-2), moins la pression sur toi — contre le
 * meilleur bâton qui couvre la ligne ou le receveur (−1, parce qu'un bâton
 * sur une ligne n'est pas un bâton sur la rondelle), +1 par bâton de plus.
 * Rien sur la ligne : difficulté 3, la passe se rend sauf accident.
 */
export function modPasse(m, piece, cible) {
  const d = dist(piece, cible);
  const loin = d <= 3 ? 1 : d <= 6 ? 0 : d <= 9 ? -1 : -2;
  const moyen = piece.st.gb === GABARIT_MOYEN ? 1 : 0;
  const but = eqDe(m, piece.eq).but;
  const bureau = profondeur(piece.r, but) <= 0 && natureCase(cible.r, cible.c, but) === 'enclave' ? 1 : 0;
  const maladroit = cible.st && cible.st.MA <= 2 ? -1 : 0;
  const a = piece.st.MA + loin + moyen + bureau + maladroit + malusSouffle(m, piece) - malusPression(pressionDe(m, piece).n);
  const qui = batonsSurLaLigne(m, piece, cible);
  if (!cible.st) {
    // Au fond, libre : personne ne s'oppose, un bâton près de l'endroit visé rend ça plus dur.
    return duel(a, 3 + (pression(m, piece.eq, cible.r, cible.c).n ? 1 : 0), false, ['MA', null], true, [piece.st.MA, null]);
  }
  if (!qui.length) return duel(a, 3, false, ['MA', null], true, [piece.st.MA, null]);
  const fort = Math.max(...qui.map(x => x.st.DE));
  return duel(a, fort - 1 + malusPression(Math.min(3, qui.length)), true, ['MA', 'DE'], true, [piece.st.MA, fort]);
}
/** Les bâtons qui couvrent la ligne d'une passe ou son receveur : chacun une fois. */
export function batonsSurLaLigne(m, piece, cible) {
  const vus = new Set(couvreurs(m, piece.eq, cible.r, cible.c));
  const n = dist(piece, cible);
  for (let i = 1; i < n; i++) {
    const r = Math.round(piece.r + (cible.r - piece.r) * i / n), c = Math.round(piece.c + (cible.c - piece.c) * i / n);
    for (const x of couvreurs(m, piece.eq, r, c)) vus.add(x);
  }
  return [...vus];
}

/** Les cases du fond où l'on peut envoyer la rondelle : de la zone neutre seulement. */
export function ciblesFondDe(m, piece) {
  if (porteur(m) !== piece || piece.agi || piece.gardien) return [];
  const but = eqDe(m, piece.eq).but;
  const s = profondeur(piece.r, but);
  /*
   * ON PEUT MAINTENANT DÉGAGER DE SA PROPRE ZONE (S45) — et c'est un
   * DÉGAGEMENT REFUSÉ. Le geste était simplement interdit de là (`s <=
   * PORTEE_TIR` rendait une liste vide), donc l'icing n'existait pas : la
   * même faute que le hors-jeu, une règle de hockey remplacée par une case
   * qui ne s'allume pas. Sous pression dans son coin, se débarrasser de la
   * rondelle est une vraie décision — elle coûte une mise au jeu CHEZ TOI.
   */
  if (s > LONGUEUR - PORTEE_TIR) return [];
  const out = [];
  for (let r = 0; r < RANGS; r++) for (let c = 0; c < COLS; c++) {
    if (!dansLaGlace(r, c) || occupee(m, r, c)) continue;
    const n = natureCase(r, c, but);
    if (n === 'coin' || n === 'derriere') out.push({ r, c });
  }
  return out;
}

/** Ce que le gardien ajoute à son dé selon d'où l'on tire (voir PLACE_GARDIEN). */
export function placeGardien(m, piece, ou = piece) {
  const but = eqDe(m, piece.eq).but;
  const d = profondeur(ou.r, but);
  const nature = natureCase(ou.r, ou.c, but);
  if (d === 0) return PLACE_GARDIEN.tour;                    // le tour du filet
  if (nature === 'coin') return PLACE_GARDIEN.coin;
  if (nature === 'enclave') return d <= 1 ? PLACE_GARDIEN.enclave : PLACE_GARDIEN.rangee2;
  return PLACE_GARDIEN.pointe;
}

/**
 * LE TIR : ton dé + ton TI (+ ta signature, − les bâtons devant toi, deux
 * au plus) contre son dé + son AR + la place. La pression qui compte ici est
 * celle qui est ENTRE toi et le filet ; de derrière, on ne bloque rien.
 */
export function modTir(m, piece, ou = piece) {
  const eq = eqDe(m, piece.eq);
  const g = eqDe(m, adverse(piece.eq)).piece_g;
  const d = profondeur(ou.r, eq.but);
  const nature = natureCase(ou.r, ou.c, eq.but);
  const gene = Math.min(2, batonsTir(m, piece.eq, ou.r, ou.c));
  const tir = TIRS[piece.st.ts] || TIRS.P;
  const signature = tir.mod({ loin: d, enclave: nature === 'enclave', batons: gene, recu: !!piece.derniere });
  /*
   * L'ÉGALITÉ VA AU GARDIEN (S42). JP : *sans que ça soit revirement but
   * direct*. Le tir était le seul duel où le défenseur est un SPÉCIALISTE,
   * et il était le seul où l'égalité allait à l'attaquant : 10,6 lancers
   * pour 5,4 buts, soit **51 % de conversion** — le gardien était un
   * tourniquet, et la rondelle qu'on venait de voler entrait une fois sur
   * deux. Un tir doit être une occasion, pas une formalité : l'égalité lui
   * revient, et sa place vaut un cran de plus (`GARDIEN_PLUS`).
   */
  /*
   * UN FILET DÉSERT N'A PAS D'ADVERSAIRE (S46) : il n'y a plus de dé en
   * face, seulement la difficulté d'atteindre un but vide de la distance
   * où l'on est. C'est le même `duel` sans opposant, celui de la passe que
   * rien ne couvre — pas une exception, la forme sans défenseur.
   */
  if (g.sorti) {
    /*
     * Pas d'adversaire, donc pas de dé en face : seulement la distance. De
     * l'enclave c'est donné, du fond de sa propre zone c'est un coup de
     * dé — mais c'est possible, et c'est là tout le risque de sortir son
     * gardien. `PORTEE_TIR` ne borne plus rien ici (voir `peutTirerDe`).
     */
    const att = piece.st.TI + signature + malusSouffle(m, piece) - gene;
    return duel(att, 2 + placeGardien(m, piece, ou) + Math.max(0, d - PORTEE_TIR), false, ['TI', null], true, [piece.st.TI, null]);
  }
  return duel(piece.st.TI + signature + malusSouffle(m, piece) - gene, g.st.AR + placeGardien(m, piece, ou) + GARDIEN_PLUS, true, ['TI', 'AR'], TIR_AU_TIREUR, [piece.st.TI, g.st.AR]);
}

/**
 * FRAPPER : force contre force sur n'importe quel adversaire collé. Sur le
 * porteur, la pression joue contre lui — tes coéquipiers qui le couvrent
 * lui retirent un chacun — et sur la bande il perd un de plus : c'est là
 * qu'on le coince. Un frappeur reconnu (mises en échec par match) a +1.
 */
export const surLaBande = (r, c) => c === 0 || c === COLS - 1 || r === RANG_MIN || r === RANG_MAX;
export function modEchec(m, piece, cible) {
  const porte = porteur(m) === cible;
  const bande = porte && surLaBande(cible.r, cible.c) ? 1 : 0;
  const pres = porte ? malusPression(pression(m, cible.eq, cible.r, cible.c).n) : 0;
  return duel(piece.st.FO + (bonFrappeur(piece.p) ? 1 : 0) + malusSouffle(m, piece), cible.st.FO - pres - bande, true, ['FO', 'FO'], false, [piece.st.FO, cible.st.FO]);
}

/**
 * HARPONNER : ta défense contre le maniement du porteur collé à toi, la
 * pression contre lui. Tu prends la rondelle sans le toucher : c'est le
 * geste du Selke, et le deuxième chemin de qui ne frappe pas.
 */
export function modVol(m, piece, cible) {
  const pres = malusPression(pression(m, cible.eq, cible.r, cible.c).n);
  return duel(piece.st.DE + (bonVoleur(piece.p) ? 1 : 0) + malusSouffle(m, piece), cible.st.MA - pres, true, ['DE', 'MA'], false, [piece.st.DE, cible.st.MA]);
}

/**
 * FEINTER : le porteur prend UN défenseur collé en un contre un — son
 * maniement (+1 au petit gabarit, la pression en moins) contre la défense de
 * l'autre. Battu, le défenseur est hors position jusqu'à la fin du tour et le
 * porteur repart libre, sans esquive ; raté, le défenseur lui prend la rondelle.
 */
export function modDejouer(m, piece, cible) {
  const petit = piece.st.gb === GABARIT_PETIT ? 1 : 0;
  return duel(piece.st.MA + petit + malusSouffle(m, piece) - malusPression(pressionDe(m, piece).n), cible.st.DE, true, ['MA', 'DE'], true, [piece.st.MA, cible.st.DE]);
}

/* ---------- le jet, la relance, le revirement ---------- */

/**
 * Un jet. Rend `{ de, mod, total, de2, mod2, total2, reussi }`. La relance
 * d'équipe se demande APRÈS avoir vu les dés — c'est tout l'intérêt du team
 * re-roll de Blood Bowl : on le dépense en connaissance de cause.
 */
export function jeter(m, quoi, d) {
  const de = d6(m);
  const de2 = d.opp ? d6(m) : null;
  const total = de + d.a, total2 = d.opp ? de2 + d.b : d.b;
  return { de, mod: d.a, total, de2, mod2: d.b, total2, opp: d.opp, mots: d.mots, rondelle: d.rondelle, seuil: total2, reussi: gagneLeDuel(de, total, de2, total2, d.rondelle), quoi };
}

export function relancer(m, jet, cote) {
  const eq = eqDe(m, cote);
  if (!eq.relance) return jet;
  eq.relance = false;
  // On relance SON dé ; celui de l'adversaire reste sur la table.
  const de = d6(m);
  return { ...jet, de, total: de + jet.mod, reussi: gagneLeDuel(de, de + jet.mod, jet.de2, jet.total2, jet.rondelle), relance: true };
}

/**
 * La rondelle rebondit sur une case LIBRE, la plus proche possible ; le
 * rayon s'élargit jusqu'à trouver. `devant` (le filet attaqué) garde le
 * rebond d'un TIR en profondeur positive : un retour reste devant le filet.
 */
function rebondir(m, r, c, devant = null) {
  for (let rayon = 1; rayon <= 8; rayon++) {
    const cases = [];
    for (let dr = -rayon; dr <= rayon; dr++) for (let dc = -rayon; dc <= rayon; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== rayon) continue;
      const nr = r + dr, nc = c + dc;
      if (devant !== null && profondeur(nr, devant) < 1) continue;
      if (dansLaGlace(nr, nc) && !occupee(m, nr, nc)) cases.push({ r: nr, c: nc });
    }
    if (cases.length) {
      const ou = cases[Math.floor(m.de() * cases.length)];
      m.rondelle = { libre: ou };
      return ou;
    }
  }
  const prises = new Set(surLaGlace(m).map(x => `${x.r},${x.c}`));
  const ou = caseProche(prises, borne(r, RANG_MIN, RANG_MAX), borne(c, 0, COLS - 1));
  m.rondelle = { libre: ou };
  return ou;
}

/** Le revirement : la rondelle a changé de camp, la main passe sur-le-champ. */
function revirement(m, texte) {
  const eq = eqDe(m, m.tour);
  eq.revirements++;
  dire(m, `${texte} Revirement.`, 'revirement');
  finirMain(m);
}

/* ======================================================================
   EXÉCUTER UN GESTE
   ======================================================================
   `jeter` rend le jet, `appliquer*` applique la suite : l'écran humain les
   appelle séparément pour offrir la relance entre les deux, l'IA les
   enchaîne (`jouerGeste`).
   ====================================================================== */

/*
 * LE HORS-JEU (S38, S39). Sans la rondelle, on n'entre pas en zone offensive
 * avant elle : tant qu'elle n'a pas passé la ligne bleue — portée par
 * n'importe qui, ou libre — la zone est fermée à qui ne l'a pas, et ceux qui
 * y sont doivent en SORTIR. Une passe au fond l'ouvre : le dump-and-chase.
 */
export const rondelleEnZone = (m, cote) => {
  const but = eqDe(m, cote).but;
  const pos = porteur(m) || libre(m);
  return !!pos && profondeur(pos.r, but) <= PORTEE_TIR;
};
const horsJeu = (m, piece, r, c) => {
  if (rondelleEnZone(m, piece.eq)) return false;
  const but = eqDe(m, piece.eq).but;
  const s = profondeur(r, but);
  if (s > PORTEE_TIR) return false;
  // Déjà dans la zone sans la rondelle : on ne peut que RECULER vers la ligne bleue.
  return !(profondeur(piece.r, but) <= PORTEE_TIR && s > profondeur(piece.r, but));
};
/*
 * LE HORS-JEU SE SIFFLE (S45). JP : *intégrer pénalités, hors jeux, mise aux
 * jeux*. Il existait — et il n'était PAS une règle : c'était un filtre de
 * déplacement, les cases de la zone ne s'allumaient simplement pas avant la
 * rondelle. Donc aucun hors-jeu ne pouvait être commis, aucun n'a jamais été
 * sifflé, et la ligne bleue ne décidait de rien. Mesuré : zéro appel.
 *
 * Maintenant on PEUT y entrer, et la rondelle qui entre ensuite trouve un
 * coéquipier déjà là : c'est un hors-jeu, sifflet, mise au jeu au point
 * neutre de ce bord. Le porteur, lui, n'est jamais hors-jeu — il apporte la
 * rondelle. L'IA, elle, tient sa ligne comme un vrai trio : `sesCases`
 * écarte les cases qui la mettraient hors-jeu et `posteDe` clame son poste
 * à la ligne bleue. C'est le JOUEUR qui décide de devancer la rondelle, et
 * qui le paie. L'ancien filtre muet ne survit que comme interrupteur de
 * MESURE (`HJ_FILTRE=1`), pour rejouer le plateau d'avant.
 */
/** Ceux qui devancent la rondelle en ce moment : à saisir AVANT que le geste ne la déplace. */
const devantLaRondelle = (m, cote) => {
  if (rondelleEnZone(m, cote)) return null;
  const but = eqDe(m, cote).but;
  return new Set(eqDe(m, cote).pieces.filter(x => profondeur(x.r, but) <= PORTEE_TIR));
};
export const enPositionHorsJeu = (m, piece) => {
  if (piece.gardien || porteur(m) === piece) return false;
  const but = eqDe(m, piece.eq).but;
  return profondeur(piece.r, but) <= PORTEE_TIR && !rondelleEnZone(m, piece.eq);
};
/** La rondelle vient d'entrer en zone : un coéquipier déjà dedans, et c'est le sifflet. */
function verifierHorsJeu(m, cote, avant) {
  /*
   * LE HORS-JEU SE JUGE À L'ENTRÉE, PAS DANS LA ZONE. `avant` est l'ensemble
   * de ceux qui devançaient la rondelle JUSTE AVANT le geste ; il est nul
   * quand elle était déjà en zone, et alors il n'y a rien à siffler. Sans
   * cette ligne, toute passe à l'intérieur de la zone était un hors-jeu —
   * `check_regles` l'a trouvé en une passe : le une-deux ne se jouait plus
   * du tout, parce qu'une passe en zone offensive finissait au sifflet.
   */
  if (!avant || !avant.size) return false;
  const but = eqDe(m, cote).but;
  const pos = porteur(m) || libre(m);
  if (!pos || profondeur(pos.r, but) > PORTEE_TIR) return false;   // elle n'est pas entrée
  // Le porteur apporte la rondelle : il n'est jamais hors-jeu — SAUF s'il
  // vient de la RECEVOIR en étant déjà dans la zone (`avant` le dit).
  const dedans = x => profondeur(x.r, but) <= PORTEE_TIR;
  const sur = eqDe(m, cote).pieces;
  const fautif = [...avant].find(x => sur.includes(x) && dedans(x));
  if (!fautif) return false;
  dire(m, `HORS-JEU — ${nomDe(fautif)} avait devancé la rondelle.`, 'horsjeu');
  m.horsJeux = (m.horsJeux || 0) + 1;
  eqDe(m, cote).horsJeux = (eqDe(m, cote).horsJeux || 0) + 1;
  arretDeJeu(m, 'Hors-jeu', pointNeutre(m, but, pos.c));
  return true;
}

/** Les cases où cette pièce peut aller : ses pas, en contournant les pièces ; avec la rondelle, une case sous pression en coûte deux. */
/*
 * L'ÉVENTAIL ALLUME BEAUCOUP, ET C'EST MESURÉ (S42) : 43 cases en moyenne
 * quand on choisit une pièce, jusqu'à 116 — 14 % du plateau d'un seul coup.
 * C'est ce qu'on lit comme « les joueurs traversent la glace trop vite » :
 * un clic peut poser la pièce à peu près n'importe où.
 *
 * Trois façons de le resserrer ont été mesurées, et deux échouent :
 *   quatre lignes SÈCHES (pas de diagonales)   9,8 cases — mais le jeu MEURT :
 *     un seul adversaire ferme le couloir, les buts tombent de 5,22 à 2,03,
 *     la rondelle traîne libre 72 % des mains, les mises en échec montent à
 *     36 et le match gonfle à 351 mains. C'est le mur.
 *   quatre lignes AVEC UN VIRAGE              41,7 cases — aucun gain : un
 *     trajet en L rejoint presque tout le losange, donc autant garder
 *     l'éventail.
 *   huit rayons (lignes, diagonales comprises) 19,2 cases, et le jeu TIENT :
 *     16,8 lancers, 31 % de conversion, 5,27 buts, le sens d'attaque change
 *     une main sur 5,9. Il coûte 20 % de mains en plus (223 → 268) et fait
 *     passer les mises en échec de 13 à 21. S13 l'avait écarté parce que son
 *     IA ne savait plus contourner le trafic (1,9 but) ; celle de S42, qui
 *     tient des postes et dispose d'un placement, y arrive.
 * C'est une décision de JEU, pas un réglage : elle attend JP.
 */
/*
 * LE PAS SE COMPTE EN DEMIS. Un pas droit vaut 2, une diagonale `COUT_DIAG`,
 * et le budget vaut `pasDe` × 2 : ça permet de doser la diagonale entre un
 * pas (2) et deux pas (4) sans inventer de fractions. `DIAG` dans
 * l'environnement pour la MESURE.
 */
const DEMI = 2;
const COUT_DIAG = MESURE.DIAG !== undefined ? Number(MESURE.DIAG) : 3;
/**
 * JUSQU'OÙ CETTE PIÈCE-LÀ PEUT PATINER, en demis : son PA, borné par ce
 * qu'il reste dans la réserve de la main — sauf l'échappée, qui est un élan
 * à part. C'est le nombre que le bouton « Patiner » affiche, et il n'a
 * qu'une définition : `deplacementsDe` la lit ici aussi.
 */
export const porteeDe = (m, piece) =>
  (POOL && !piece.echappee ? Math.min(pasDe(m, piece) * DEMI, m.main.reserve) : pasDe(m, piece) * DEMI);
/*
 * LE CHEMIN EST CALCULÉ UNE FOIS, ET IL SERT DEUX FOIS (S44). JP : *ajouter
 * « ligne » qui montre déplacement*. Le losange dit OÙ l'on peut aller et
 * ce que ça coûte, jamais PAR OÙ l'on passe — et le trajet n'est pas droit :
 * il contourne les pièces, et le porteur paie double dans une case couverte,
 * donc il contourne aussi les rayons. Un pas de biais coûtant un et demi, la
 * route la moins chère fait des coudes qu'on ne devine pas.
 *
 * Le Dijkstra retient donc D'OÙ il est arrivé dans chaque case (`venant`),
 * et `cheminVers` remonte la chaîne. Il est SORTI de `deplacementsDe` plutôt
 * que rendu avec chaque destination : l'IA appelle `deplacementsDe` à chaque
 * geste de chaque pièce, et bâtir cent tableaux de route à chaque appel
 * coûterait des minutes de mesure pour un trait que seul l'écran dessine.
 */
function routes(m, piece) {
  const pas = porteeDe(m, piece);
  const avecRondelle = porteur(m) === piece;
  /*
   * UNE DIAGONALE COÛTE UN PAS ET DEMI. JP : *pour diagonale, tu dois faire
   * genre deux cases droites, une vers le haut*. Un pas de biais valait un
   * pas droit, donc l'éventail était un CARRÉ de (2k+1)² cases — 43 allumées
   * en moyenne, jusqu'à 116 — et traverser la glace en biais ne coûtait pas
   * plus cher que tout droit. Il vaut maintenant COUT_DIAG demis (trois, soit
   * un pas et demi ; à quatre, la diagonale pleine, le 5e décile ne battait
   * plus le 10e que 57 fois sur 100) : l'éventail devient un LOSANGE, on
   * contourne encore le trafic (ce qui manquait aux quatre lignes sèches, qui
   * tuaient le jeu à 2,03 buts), mais le biais se paie.
   */
  const cout = (r, c, dr, dc) => (dr && dc ? COUT_DIAG : DEMI) * (avecRondelle && couvreurs(m, piece.eq, r, c).length ? 2 : 1);
  const meilleur = new Map([[`${piece.r},${piece.c}`, 0]]);
  const venant = new Map();
  const file = [{ r: piece.r, c: piece.c, n: 0 }];
  while (file.length) {
    file.sort((a, b) => a.n - b.n);
    const cur = file.shift();
    if (cur.n > (meilleur.get(`${cur.r},${cur.c}`) ?? Infinity)) continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = cur.r + dr, c = cur.c + dc, cle = `${r},${c}`;
      if (!dansLaGlace(r, c) || occupee(m, r, c)) continue;
      // LE HORS-JEU N'EST PLUS UN FILTRE (S45) : on peut devancer la rondelle,
      // et c'est l'arbitre qui tranche quand elle entre. Voir `verifierHorsJeu`.
      if (HORSJEU_FILTRE && !avecRondelle && horsJeu(m, piece, r, c)) continue;
      const n = cur.n + cout(r, c, dr, dc);
      if (n > pas || n >= (meilleur.get(cle) ?? Infinity)) continue;
      meilleur.set(cle, n);
      venant.set(cle, `${cur.r},${cur.c}`);
      file.push({ r, c, n });
    }
  }
  return { meilleur, venant };
}
export function deplacementsDe(m, piece) {
  const { meilleur } = routes(m, piece);
  const out = [];
  for (const [cle, n] of meilleur) {
    if (!n) continue;
    const [r, c] = cle.split(',').map(Number);
    out.push({ r, c, pas: Math.ceil(n / DEMI), demis: n });
  }
  return out;
}
/**
 * LA ROUTE jusqu'à cette case : la suite des cases traversées, du départ à
 * l'arrivée, celle-là même que le moteur facture. Rien si la case n'est pas
 * atteignable — l'écran ne dessine jamais un trajet que le moteur refuse.
 */
export function cheminVers(m, piece, vers) {
  const { meilleur, venant } = routes(m, piece);
  const fin = `${vers.r},${vers.c}`;
  if (!meilleur.has(fin)) return [];
  const chemin = [];
  for (let cle = fin; cle; cle = venant.get(cle)) {
    const [r, c] = cle.split(',').map(Number);
    chemin.unshift({ r, c });
  }
  return chemin;
}

/** Les coéquipiers à qui cette pièce peut passer (pas en zone offensive avant la rondelle : hors-jeu). */
export const receveursDe = (m, piece) =>
  eqDe(m, piece.eq).pieces.filter(x => x !== piece && !x.etourdi);

/*
 * ON NE FRAPPE PAS EN PLEINE COURSE (S36, S41). Une main, c'est un
 * déplacement et une action : si le défenseur pouvait traverser la glace et
 * frapper dans la même main, le porteur ne verrait jamais rien venir — 38
 * mises en échec par équipe par match, mesuré, et plus une passe. Le contact
 * demande donc d'être DÉJÀ LÀ : collé à lui au début de ta main. La pièce
 * qui vient de patiner ne frappe pas ; un coéquipier déjà en place le fait,
 * ou elle, à la main d'après — et entre les deux, le porteur a une main
 * pour réagir. La défense est un plan à deux mains, comme l'attaque.
 * (Essayé à « un pas de lui » : 18 mises en échec et 13 harponnages par
 * match finissaient les possessions, 3 tirs par équipe par match.)
 */
/** Une main neuve : rien de dépensé, et la réserve de pas pleine en mode partagé. */
export const mainNeuve = () => ({ bouge: false, agi: false, place: false, mobiles: [], pas: 0, change: false, reserve: POOL * DEMI });
/** Le budget de pas de la main, et ce qu'il en reste, en pas entiers : ce que la barre d'ancrage affiche. */
export const PAS_PAR_MAIN = POOL;
export const pasRestants = m => Math.ceil(m.main.reserve / DEMI);
export const enCourse = (m, piece) => m.main.mobiles.includes(piece);

/** Les cibles d'une mise en échec : n'importe quel adversaire collé — pas avec la rondelle, pas vidé, pas en pleine course. */
export const ciblesEchecDe = (m, piece) =>
  (porteur(m) === piece || piece.gardien || essouffle(m, piece) || enCourse(m, piece) ? []
    : eqDe(m, adverse(piece.eq)).pieces.filter(x => !x.etourdi && dist(x, piece) === 1));
/** Les cibles d'un harponnage : le porteur adverse collé, et lui seul. */
export const ciblesVolDe = (m, piece) => {
  const p = porteur(m);
  if (piece.gardien || enCourse(m, piece)) return [];
  return p && p.eq !== piece.eq && !p.gardien && !p.etourdi && dist(p, piece) === 1 ? [p] : [];
};
/** Les cibles d'une feinte : un défenseur collé au porteur. */
export const ciblesDejouerDe = (m, piece) =>
  (porteur(m) !== piece || piece.agi || piece.gardien) ? []
    : eqDe(m, adverse(piece.eq)).pieces.filter(x => !x.gardien && !x.etourdi && dist(piece, x) === 1);

/**
 * Le déplacement. Sans la rondelle, patiner est libre. Avec, une case sous
 * pression au départ ou à l'arrivée demande une esquive ; patiner sur une
 * rondelle libre qu'un adversaire touche, c'est une bataille.
 */
export function deplacer(m, piece, vers) {
  const avecRondelle = porteur(m) === piece;
  piece.deplace = true;
  piece.echappee = false;
  // Le patin de la main d'abord ; sinon c'est le PLACEMENT, réservé à qui
  // n'a pas la rondelle (`peutBouger` l'a déjà vérifié).
  if (!m.main.bouge) m.main.bouge = true; else m.main.place = true;
  if (POOL && !piece.echappee) {
    const opt = deplacementsDe(m, piece).find(v => v.r === vers.r && v.c === vers.c);
    m.main.reserve = Math.max(0, m.main.reserve - (opt ? opt.demis : DEMI));
  }
  m.main.mobiles.push(piece);
  m.main.pas = dist(piece, vers);
  m.reception = null;
  depenser(m, piece);
  if (!avecRondelle && bataillePossible(m, piece, vers)) {
    piece.libre = false;
    return { ok: true, jet: jeter(m, 'bataille', modBataille(m, piece, vers)), bataille: true };
  }
  if (!esquiveRequise(m, piece, vers)) {
    piece.libre = false;
    const avant = avecRondelle ? devantLaRondelle(m, piece.eq) : null;
    deposer(m, piece, vers.r, vers.c);
    if (avecRondelle) verifierHorsJeu(m, piece.eq, avant);
    return { ok: true, jet: null };
  }
  const d = avec(modEsquive(m, piece, vers), piece.hab === 'PATIN' && piece.habDispo ? 2 : 0);
  return { ok: true, jet: jeter(m, 'esquive', d), vers, piece };
}

/**
 * LA RONDELLE LIBRE APPARTIENT À QUI MET LE PIED DESSUS : sans dé, sans
 * dépenser son geste, qu'on y patine, qu'on y soit poussé ou qu'on y rentre
 * en changeant de trio. Une pièce au sol, elle, ne ramasse rien. `deposer`
 * est le seul endroit qui pose une pièce sur une case.
 */
function deposer(m, piece, r, c) {
  piece.r = r; piece.c = c;
  const l = libre(m);
  if (!l || l.r !== r || l.c !== c) return false;
  if (piece.etourdi) return false;
  donner(m, piece);
  /*
   * QUI LA RAMASSE REPART AVEC. JP : *c'est correct que la rondelle change
   * de possession plusieurs fois, tant qu'elle reste pas prise là*.
   * Ramasser une rondelle libre coûtait le déplacement de la main, donc le
   * nouveau porteur restait PLANTÉ sur la case où il venait de la prendre —
   * et l'autre camp la lui reprenait au même endroit. Mesuré : la rondelle
   * restait dans le même rayon de deux cases pendant 3,9 mains d'affilée,
   * jusqu'à 25. Le vol et la mise en échec rendaient déjà l'élan
   * (`echappee`) pour exactement cette raison ; le ramassage le rend aussi.
   * Un changement de possession déplace la rondelle, il ne la fige pas.
   */
  if (RELANCE_RAMASSAGE) { piece.deplace = false; piece.echappee = true; }
  dire(m, `${nomDe(piece)} met le pied sur la rondelle libre et la récupère.`, 'ok');
  return true;
}

/** Un adversaire debout collé à la case de la rondelle libre : la bataille. */
export const bataillePossible = (m, piece, vers) => {
  const l = libre(m);
  if (!l || l.r !== vers.r || l.c !== vers.c) return false;
  return eqDe(m, adverse(piece.eq)).pieces.some(x => !x.gardien && !x.etourdi && dist(x, vers) === 1);
};
export function modBataille(m, piece, vers) {
  const rivaux = eqDe(m, adverse(piece.eq)).pieces.filter(x => !x.gardien && !x.etourdi && dist(x, vers) === 1);
  const fort = Math.max(...rivaux.map(x => x.st.FO));
  return duel(piece.st.FO + (bonFrappeur(piece.p) ? 1 : 0) + malusSouffle(m, piece), fort, true, ['FO', 'FO'], false, [piece.st.FO, fort]);
}
export function appliquerBataille(m, piece, vers, jet) {
  if (jet.reussi) {
    dire(m, `${nomDe(piece)} gagne la bataille dans le trafic.`, 'bataille');
    deposer(m, piece, vers.r, vers.c);
    return true;
  }
  piece.r = vers.r; piece.c = vers.c;
  rebondir(m, vers.r, vers.c);
  dire(m, `${nomDe(piece)} perd la bataille — la rondelle ricoche.`, 'rate');
  return false;
}

export function appliquerEsquive(m, piece, vers, jet) {
  if (piece.hab === 'PATIN' && piece.habDispo) piece.habDispo = false;
  const qui = batonsDuPatin(m, piece, vers);
  if (jet.reussi) {
    const avant = porteur(m) === piece ? devantLaRondelle(m, piece.eq) : null;
    deposer(m, piece, vers.r, vers.c);
    dire(m, `${nomDe(piece)} se défait de la couverture.`, 'ok');
    if (avant) verifierHorsJeu(m, piece.eq, avant);
    return true;
  }
  /*
   * LE TARIF DE L'ÉCHEC : la rondelle est LIBRE, sur place (S42). Elle était
   * DONNÉE au meilleur bâton, donc le camp basculait d'un coup — la rondelle
   * ET la main changeaient de bord dans le même souffle, et le voleur
   * repartait face au filet. Maintenant elle tombe où elle s'est perdue, et
   * c'est celui qui a des corps autour qui la ramasse : c'est là que le
   * positionnement paie. Un vol PROPRE — frapper, harponner — prend encore
   * la rondelle net : c'est la récompense d'un geste défensif joué exprès.
   */
  const voleur = meilleurBaton(qui);
  if (LIBRE_SUR_PERTE || !voleur) { rebondir(m, piece.r, piece.c); revirement(m, `${nomDe(piece)} échappe la rondelle — elle est libre.`); }
  else { donner(m, voleur); revirement(m, `${nomDe(voleur)} harponne ${nomDe(piece)} et prend la rondelle.`); }
  return false;
}

/** Une passe : à un coéquipier, ou à une case du fond (la rondelle y sera libre). */
export function passer(m, piece, cible) {
  const d = avec(modPasse(m, piece, cible), cible.st && piece.hab === 'VOILEE' && piece.habDispo ? 2 : 0);
  eqDe(m, piece.eq).modsPasse.push({ mod: d.a - d.b, d: dist(piece, cible), opp: d.opp });
  return jeter(m, cible.st ? 'passe' : 'fond', d);
}

export function appliquerPasse(m, piece, cible, jet) {
  if (cible.st && piece.hab === 'VOILEE' && piece.habDispo) piece.habDispo = false;
  agir(m, piece);
  // Qui devançait la rondelle AVANT la passe : c'est eux que l'arbitre regarde
  // quand elle entre — le receveur compris, s'il attendait déjà dans la zone.
  const avant = devantLaRondelle(m, piece.eq);
  if (!cible.st) {
    // AU FOND : réussie, la rondelle est libre là où on l'a envoyée ; ratée,
    // elle rebondit autour. Elle est libre dans les deux cas — on l'a donnée.
    if (jet.reussi) {
      const deChezNous = profondeur(piece.r, eqDe(m, piece.eq).but) <= PORTEE_TIR;
      m.rondelle = { libre: { r: cible.r, c: cible.c } }; piece.derniere = null;
      dire(m, `${nomDe(piece)} envoie la rondelle au fond — elle est libre.`, 'degage');
      // LE DÉGAGEMENT REFUSÉ : parti de sa propre zone, il est sifflé, et la
      // mise au jeu revient CHEZ LE FAUTIF. Un hors-jeu ne peut pas suivre :
      // la rondelle n'est pas entrée en zone offensive, elle l'a traversée.
      if (deChezNous) {
        dire(m, `DÉGAGEMENT REFUSÉ — ${nomDe(piece)} l'a envoyée de sa propre zone.`, 'icing');
        m.icings = (m.icings || 0) + 1;
        arretDeJeu(m, 'Dégagement refusé', pointDeFond(m, piece.eq, piece.c));
        return true;
      }
      verifierHorsJeu(m, piece.eq, avant);
      return true;
    }
    rebondir(m, cible.r, cible.c);
    dire(m, `La rondelle de ${nomDe(piece)} file le long de la bande et rebondit.`, 'degage');
    return false;
  }
  if (jet.reussi) {
    donner(m, cible);
    cible.derniere = piece;      // qui a donné la rondelle : le passeur du but
    m.reception = { receveur: cible, passeur: piece };   // le une-deux est ouvert
    dire(m, `${nomDe(piece)} rejoint ${nomDe(cible)}.`, 'ok');
    if (verifierHorsJeu(m, piece.eq, avant)) return false;
    return true;
  }
  // LE TARIF DE L'ÉCHEC : le bâton qui couvrait la ligne l'intercepte.
  const voleur = meilleurBaton(batonsSurLaLigne(m, piece, cible));
  if (voleur) { donner(m, voleur); revirement(m, `${nomDe(voleur)} intercepte la passe de ${nomDe(piece)}.`); }
  else { rebondir(m, cible.r, cible.c); revirement(m, `La passe de ${nomDe(piece)} est ratée.`); }
  return false;
}

export function tirer(m, piece) {
  const d = avec(modTir(m, piece), piece.hab === 'DECOCHE' && piece.habDispo ? 2 : 0);
  // `vide` est noté ICI, au moment du tir : un but dans le filet désert fait
  // rentrer le gardien, donc après coup on ne peut plus savoir si le tir de
  // la zone neutre était permis. C'est ce que `check_regles` lit.
  eqDe(m, piece.eq).modsTir.push({ mod: d.a - d.b, d: profondeur(piece.r, eqDe(m, piece.eq).but), place: placeGardien(m, piece), vide: filetVide(m, piece) });
  return jeter(m, 'tir', d);
}

export function appliquerTir(m, piece, jet) {
  if (piece.hab === 'DECOCHE' && piece.habDispo) piece.habDispo = false;
  const eq = eqDe(m, piece.eq);
  const advG = eqDe(m, adverse(piece.eq)).piece_g;
  eq.tirs++; piece.tirs++; agir(m, piece);
  fiche(eq, piece.p).tirs++;
  if (jet.reussi) {
    eq.buts++; piece.buts++;
    advG.alloues++; eqDe(m, adverse(piece.eq)).alloues++;
    fiche(eq, piece.p).buts++;
    const passeur = piece.derniere && piece.derniere !== piece ? piece.derniere : null;
    if (passeur) { passeur.passes++; fiche(eq, passeur.p).passes++; }
    dire(m, `BUT — ${nomDe(piece)}${passeur ? ` (${nomDe(passeur)})` : ''}. ${m.A.buts} – ${m.B.buts}`, 'but');
    m.dernierBut = { piece, passeur, periode: m.periode };
    finirPresence(m, true);
    return true;
  }
  /*
   * DANS UN FILET DÉSERT, UN TIR RATÉ N'EST PAS UN ARRÊT : personne ne l'a
   * arrêté. Il manque le but, et la rondelle reste en jeu derrière — c'est
   * ce qui fait que retirer son gardien est un PARI et pas une formalité.
   */
  if (advG.sorti) {
    /*
     * UN TIR RATÉ DANS UN BUT VIDE N'EST PAS UN LANCER. L'égalité de la
     * feuille dit « lancers d'une équipe = arrêts + buts alloués du gardien
     * d'en face » : sans gardien, un tir manqué n'est NI l'un NI l'autre, et
     * la feuille cassait (6 fois sur 240 matchs). Une vraie feuille de match
     * ne compte pas non plus : un tir qui rate le filet n'est pas un lancer.
     * On le décompte donc, plutôt que d'inventer un arrêt que personne n'a fait.
     */
    eq.tirs--; piece.tirs--; fiche(eq, piece.p).tirs--;
    rebondir(m, advG.r, advG.c, eq.but);
    dire(m, `${nomDe(piece)} rate le filet désert.`, 'rate');
    return false;
  }
  advG.arrets++; eqDe(m, adverse(piece.eq)).arrets++;
  /*
   * LE RETOUR. Un tir pris DE L'ENCLAVE, ou raté de justesse, ou mal contrôlé
   * (le gardien jette son dé : son AR contre 5+) laisse un retour libre
   * devant le filet, et la main continue : c'est la deuxième chance qui fait
   * le mode. Un tir de la pointe finit dans la mitaine : le gardien la garde,
   * revirement.
   */
  const enclave = natureCase(piece.r, piece.c, eq.but) === 'enclave';
  const deJustesse = jet.total === jet.total2 - 1;
  const controle = Math.floor(m.de() * 6) + 1 + advG.st.AR > 7;
  if (enclave || deJustesse || !controle) {
    /*
     * LE RETOUR PART DU GARDIEN, PAS DU TIREUR (S45). JP : *retours moins
     * « loins » des gardiens*. Il rebondissait autour de la case du TIR :
     * un tir de la pointe laissait donc le retour à la pointe. Mesuré sur
     * 40 matchs : 5,92 rangées du filet en moyenne, 79 % au-delà de la
     * troisième rangée — une rondelle qui n'a jamais touché le gardien.
     * Elle sort maintenant de LUI, en profondeur positive : c'est la mêlée
     * devant le filet, et c'est ce qu'un retour est.
     */
    rebondir(m, advG.r, advG.c, eq.but);
    dire(m, `${nomDe(advG)} repousse le tir de ${nomDe(piece)} — retour devant le filet.`, 'retour');
    return false;
  }
  /*
   * LE GARDIEN QUI GÈLE LA RONDELLE, C'EST UN SIFFLET (S45). Il la gardait
   * et la relançait à un défenseur : l'équipe qui subissait le tir repartait
   * avec la rondelle et toute sa présence, sans que rien ne s'arrête. Dans
   * un vrai match c'est un arrêt de jeu et une mise au jeu DANS CETTE
   * ZONE-LÀ — donc une chance sur deux de la ravoir, et une raison de
   * mettre un bon centre sur la glace.
   */
  /*
   * IL NE GÈLE QUE SOUS PRESSION. Premier jet de S45 : tout arrêt contrôlé
   * était un sifflet — et la SORTIE DE ZONE, la relance du gardien à son
   * défenseur, n'a plus jamais été jouée (mesuré : 0,00 par match sur 30).
   * Une mécanique que le moteur porte et ne joue jamais est une mécanique
   * morte. Un vrai gardien ne gèle que quand quelqu'un est sur lui : sans
   * personne devant son filet, il garde la rondelle et la relance, et le
   * jeu continue. Les deux vivent, et c'est la présence adverse qui décide
   * laquelle — donc aller au filet vaut aussi un arrêt de jeu.
   */
  donner(m, advG);
  if (batons(m, advG.eq, advG.r, advG.c) > 0) {
    dire(m, `${nomDe(advG)} bloque le tir de ${nomDe(piece)} et la gèle sous la pression.`, 'arret');
    arretDeJeu(m, 'Gelée par le gardien', pointDeFond(m, advG.eq, piece.c));
    return false;
  }
  dire(m, `${nomDe(advG)} bloque le tir de ${nomDe(piece)} et garde la rondelle.`, 'arret');
  revirement(m, `Le gardien la relancera.`);
  return false;
}

export function mettreEnEchec(m, piece, cible) {
  return jeter(m, 'echec', avec(modEchec(m, piece, cible), (piece.hab === 'ACTIF' || piece.hab === 'EPAULE') && piece.habDispo ? 2 : 0));
}

export function appliquerEchec(m, piece, cible, jet) {
  const solide = (piece.hab === 'EPAULE' && piece.habDispo) || piece.st.gb === GABARIT_MATADOR;
  if ((piece.hab === 'ACTIF' || piece.hab === 'EPAULE') && piece.habDispo) piece.habDispo = false;
  const eq = eqDe(m, piece.eq);
  const avaitLaRondelle = porteur(m) === cible;
  agir(m, piece);
  eq.echecs++;
  if (jet.reussi) {
    fiche(eq, piece.p).echecs++;
    // Le porteur frappé reste au sol un tour (deux pour un petit gabarit) ; un autre se relève à la fin du tour.
    cible.etourdi = avaitLaRondelle ? (cible.st.gb === GABARIT_PETIT ? 3 : 2) : 1;
    pousser(m, piece, cible);
    /*
     * Qui enlève la rondelle repart avec : la contre-attaque. Retirer cette
     * échappée a été essayé en S42 pour couper le up-and-down, et c'est
     * PIRE — le voleur restait planté collé à ceux qu'il venait de
     * dépouiller et se faisait reprendre aussitôt : le sens d'attaque
     * changeait 69 fois par match au lieu de 57. Le up-and-down ne se
     * coupe pas ici, il se coupe en remplissant la glace (les postes).
     */
    if (avaitLaRondelle) { donner(m, piece); piece.deplace = false; piece.echappee = true; }
    dire(m, `${nomDe(piece)} frappe ${nomDe(cible)}${avaitLaRondelle ? ' et récupère' : ''}.`, 'echec');
    return true;
  }
  if (punir(m, piece, jet)) return false;
  // LE TARIF DE L'ÉCHEC : un contact raté te laisse hors position (le matador et le Coup d'épaule restent debout).
  if (!solide) piece.etourdi = 1;
  dire(m, `${nomDe(piece)} manque ${nomDe(cible)}${solide ? ', mais reste debout' : ' et se retrouve hors position'}.`, 'rate');
  return false;
}

/** La poussée : le frappé recule d'une case, s'il y a de la place — jamais sur la rondelle. */
function pousser(m, piece, cible) {
  const dr = Math.sign(cible.r - piece.r), dc = Math.sign(cible.c - piece.c);
  const r = cible.r + dr, c = cible.c + dc;
  const l = libre(m);
  if (l && l.r === r && l.c === c) return;
  if (dansLaGlace(r, c) && !occupee(m, r, c)) deposer(m, cible, r, c);
}

/* ---------- harponner ---------- */

export function voler(m, piece, cible) {
  return jeter(m, 'vol', avec(modVol(m, piece, cible), piece.hab === 'ACTIF' && piece.habDispo ? 2 : 0));
}

export function appliquerVol(m, piece, cible, jet) {
  if (piece.hab === 'ACTIF' && piece.habDispo) piece.habDispo = false;
  const eq = eqDe(m, piece.eq);
  agir(m, piece);
  if (jet.reussi) {
    fiche(eq, piece.p).vols++;
    donner(m, piece);
    piece.deplace = false; piece.echappee = true;      // il repart avec : la contre-attaque
    dire(m, `${nomDe(piece)} harponne ${nomDe(cible)} et prend la rondelle.`, 'vol');
    return true;
  }
  if (punir(m, piece, jet)) return false;
  piece.etourdi = 1;
  dire(m, `${nomDe(cible)} contourne le bâton de ${nomDe(piece)} — hors position.`, 'rate');
  return false;
}

/* ---------- les punitions : le cachot ---------- */

/*
 * LA PUNITION (S38). Un contact qui sort sur un 1 passe devant l'arbitre :
 * deux fois sur trois, c'est une mineure. La pièce sort pour
 * `PUNITION_TOURS` tours et son équipe joue à quatre patineurs — un rayon
 * de moins à traverser. Le rôle reste vide même si on change de trio : c'est
 * l'ÉQUIPE qui est punie. Une seule à la fois.
 */
export const PUNITION_TOURS = 4;
/*
 * LE FILET DÉSERT (S46). C'est le moment le plus reconnaissable d'un match
 * de hockey, et le plateau ne l'avait pas : le gardien restait dans son
 * filet jusqu'à la sirène, donc une équipe menée d'un but à la fin n'avait
 * RIEN à décider — elle jouait la même chose qu'à la première minute.
 *
 * Il tient en trois règles, et chacune existe déjà ailleurs : le gardien
 * sort (on le retire de la glace), un sixième patineur entre (le premier
 * rôle libre de l'unité, comme `liberer`), et un tir dans un filet vide ne
 * rencontre personne — le duel n'a plus d'adversaire, donc il se gagne sauf
 * naturel perdant. Le prix est symétrique et c'est ce qui en fait une
 * DÉCISION : l'autre camp tire aussi, dans un but ouvert.
 *
 * `DESERT_POSSESSIONS` : à combien de possessions de la fin on peut le
 * faire. `DESERT_ECART` : de combien de buts on doit tirer de l'arrière.
 */
export const DESERT_POSSESSIONS = MESURE.DESERT !== undefined ? Number(MESURE.DESERT) : 3;
export const DESERT_ECART = 2;
/** Peut-on retirer son gardien maintenant ? (dernière période, mené, pas trop loin) */
export function peutRetirerGardien(m, cote) {
  const eq = eqDe(m, cote);
  if (!DESERT_POSSESSIONS) return false;   // DESERT=0 : le filet désert éteint, pour la mesure
  if (eq.desert || m.fini || m.prolongation) return false;
  if (m.periode < PERIODES) return false;
  const ecart = eqDe(m, adverse(cote)).buts - eq.buts;
  if (ecart <= 0 || ecart > DESERT_ECART) return false;
  return POSSESSIONS_PAR_PERIODE - m.possessions <= DESERT_POSSESSIONS;
}
/*
 * LE SIXIÈME PATINEUR. Il vient d'un AUTRE trio — premier jet : on cherchait
 * un rôle libre dans l'unité sur la glace, il n'y en a jamais, les cinq y
 * sont, et la mesure a dit 0 état à six sur 120 matchs (le gardien sortait
 * et l'équipe jouait à cinq avec un but ouvert : strictement pire). Jamais
 * quelqu'un qui est DÉJÀ sur la glace, sinon le même homme s'y trouve deux
 * fois. Et il se REMPLACE, parce qu'un changement de trio peut l'avaler.
 * `check_regles` a dit les trois, l'un après l'autre.
 */
/*
 * L'EFFECTIF EST UN INVARIANT, ET IL A UN SEUL PROPRIÉTAIRE (S46). Le
 * filet désert ajoute une pièce hors unité (`X`), et quatre chemins peuvent
 * la toucher : le retrait du gardien, son retour, le changement de trio et
 * la sortie du cachot. Rapiécer les quatre a donné, l'un après l'autre :
 * DEUX attaquants supplémentaires, un joueur sur la glace DEUX FOIS, et une
 * équipe à cinq patineurs avec un puni. Chacun était un cas de plus qu'un
 * seul des quatre connaissait.
 *
 * `normaliserEffectif` est la règle, écrite une fois : au plus un `X`,
 * aucun joueur en double, pas de `X` quand le gardien est rentré, et un
 * `X` s'il manque pendant que le filet est désert. Les quatre chemins
 * l'appellent en finissant, et aucun n'a plus à savoir ce que font les
 * trois autres.
 */
function normaliserEffectif(m, eq) {
  const vus = new Set();
  const gardes = new Set();
  /*
   * LE SIXIÈME EST L'INTRUS, DONC C'EST LUI QUI CÈDE (S46). Les rôles se
   * lisent AVANT `X`, et la raison est un vrai cas : le C sort du cachot
   * pendant que son propre homme est déjà sur la glace en sixième attaquant
   * (les trios ont changé entre-temps). Dédoublonner dans l'ordre du tableau
   * gardait l'intrus et jetait le rôle — l'équipe restait à CINQ avec un but
   * ouvert, et `check_regles` l'a dit au 248e match. Le rôle reste, le
   * sixième saute, et la ligne d'après en renvoie un AUTRE : `envoyerLeSixieme`
   * ne prend que des hommes qui ne sont pas déjà sur la glace.
   */
  for (const x of [...eq.pieces.filter(x => x.role !== 'X'), ...eq.pieces.filter(x => x.role === 'X')]) {
    if (x.role === 'X' && !eq.desert) continue;          // le gardien est rentré
    if (x.role === 'X' && vus.has('X')) continue;        // un seul sixième
    if (x.p && vus.has(x.p)) continue;                   // jamais deux fois le même homme
    if (x.role === 'X') vus.add('X');
    if (x.p) vus.add(x.p);
    gardes.add(x);
  }
  // On filtre dans l'ordre D'ORIGINE : la priorité ne sert qu'à choisir qui reste.
  const sortis = eq.pieces.filter(x => !gardes.has(x));
  eq.pieces = eq.pieces.filter(x => gardes.has(x));
  // Une pièce qui quitte la glace n'emporte pas la rondelle avec elle.
  for (const x of sortis) if (porteur(m) === x) rebondir(m, x.r, x.c);
  if (eq.desert && !eq.pieces.some(x => x.role === 'X') && !eq.penalites.some(x => x.role === 'X')) {
    envoyerLeSixieme(m, eq);
  }
}

function envoyerLeSixieme(m, eq) {
  if (eq.pieces.some(x => x.role === 'X')) return null;
  const surGlace = new Set(surLaGlace(m).map(x => x.p).filter(Boolean));
  const ailleurs = [0, 1, 2, 3].flatMap(t => uniteDe(eq.roster, t, eq.pai))
    .filter(x => x.p && !surGlace.has(x.p));
  const qui = ailleurs.find(x => x.role === 'C') || ailleurs[0];
  if (!qui) return null;
  const prises = new Set(surLaGlace(m).map(x => `${x.r},${x.c}`));
  const [dr, dc] = ECARTS[eq.cote].X;
  const { r, c } = caseProche(prises, borne(MJ_CENTRE.r + dr, RANG_MIN, RANG_MAX), borne(MJ_CENTRE.c + dc, 0, COLS - 1));
  const piece = pieceNeuve(eq, 'X', qui.p, r, c);
  eq.pieces.push(piece);
  deposer(m, piece, r, c);
  return qui;
}

/** Le gardien sort, un sixième patineur entre. */
export function retirerGardien(m, cote) {
  if (!peutRetirerGardien(m, cote)) return false;
  const eq = eqDe(m, cote);
  eq.desert = true;
  const g = eq.piece_g;
  const suivant = envoyerLeSixieme(m, eq);
  // Le gardien quitte la glace : il n'est plus une pièce qu'on voit ni qu'on vise.
  if (porteur(m) === g) rebondir(m, g.r, g.c);
  g.sorti = true;
  normaliserEffectif(m, eq);
  dire(m, `FILET DÉSERT — ${eq.nom} retire ${nomDe(g)}${suivant ? ` pour ${nomJoueur(suivant.p)}` : ''}.`, 'desert');
  return true;
}
/** Le gardien revient : après un but, ou à la fin de la période. */
function remettreGardien(m, cote) {
  const eq = eqDe(m, cote);
  if (!eq.desert) return;
  eq.desert = false;
  eq.piece_g.sorti = false;
  /*
   * LA PUNITION DU SIXIÈME MEURT AVEC LE FILET DÉSERT. Sa place n'existe
   * que tant que le gardien est sorti : la garder au cachot faisait compter
   * un patineur de moins à une équipe qui en avait cinq. C'est le dernier
   * cas qu'il a fallu pour que `normaliserEffectif` suffise — et il ne
   * s'est montré qu'au 146e match.
   */
  eq.penalites = eq.penalites.filter(x => x.role !== 'X');
  // L'attaquant supplémentaire ressort : l'équipe redescend à cinq. S'il
  // porte la rondelle, elle reste sur la glace — elle ne quitte jamais le
  // plateau avec un joueur.
  const extra = eq.pieces.find(x => x.role === 'X');
  if (extra && porteur(m) === extra) rebondir(m, extra.r, extra.c);
  normaliserEffectif(m, eq);
  dire(m, `${nomDe(eq.piece_g)} reprend son filet.`, 'ok');
}

/*
 * DEUX PUNITIONS À LA FOIS (S46) : le cinq contre trois. Le cachot ne
 * tenait QU'UNE punition (`if (eq.penalite) return false`), donc la
 * deuxième faute d'une équipe déjà punie était simplement effacée — et le
 * cinq contre trois, le moment le plus décisif d'un match de hockey,
 * n'existait pas. `PUNITIONS_MAX` est deux, comme dans la vraie ligue : une
 * équipe ne descend jamais sous trois patineurs, la troisième faute est
 * différée jusqu'à la sortie d'un puni.
 */
export const PUNITIONS_MAX = 2;
function punir(m, piece, jet) {
  if (jet.de !== 1 || piece.gardien) return false;
  const eq = eqDe(m, piece.eq);
  if (eq.penalites.length >= PUNITIONS_MAX) return false;
  if (Math.floor(m.de() * 6) + 1 > 4) return false;
  eq.punitions++;
  fiche(eq, piece.p).punitions++;
  eq.penalites.push({ role: piece.role, tours: PUNITION_TOURS, p: piece.p });
  eq.pieces = eq.pieces.filter(x => x !== piece);
  if (porteur(m) === piece) rebondir(m, piece.r, piece.c);
  m.main.mobiles = m.main.mobiles.filter(x => x !== piece);
  dire(m, `PUNITION — ${nomDe(piece)} va au cachot pour ${PUNITION_TOURS} tours. ${eq.nom} joue à quatre.`, 'punition');
  // UN COUP DE SIFFLET (S45) : l'arbitre arrête le jeu, et la mise au jeu se
  // fait DANS LA ZONE de l'équipe punie — l'avantage numérique commence donc
  // là où il vaut quelque chose, comme dans la vraie ligue.
  arretDeJeu(m, 'Punition', pointDeFond(m, piece.eq, piece.c));
  return true;
}
/** Le puni revient : à la place de départ de son rôle, ou la case libre la plus proche. */
function liberer(m, eq) {
  const pen = eq.penalites.shift();
  if (!pen) return;
  /*
   * EN PROLONGATION IL NE RENTRE PAS À SON RÔLE. À trois contre trois, le
   * puni peut être un rôle qui ne saute plus : le remettre faisait jouer son
   * équipe à QUATRE (mesuré : 8 états sur 865). Il rentre donc au premier
   * rôle permis qui n'est pas déjà sur la glace, et si tous y sont, il ne
   * rentre pas — la punition l'a simplement fait manquer la prolongation.
   */
  // L'ATTAQUANT SUPPLÉMENTAIRE NE REVIENT PAS SI LE GARDIEN EST RENTRÉ : sa
  // place n'existe plus. Sans ça il ressortait du cachot en « Rappel » et
  // l'équipe jouait à six avec son gardien.
  if (pen.role === 'X' && !eq.desert) return;
  const permis = rolesEnJeu(m);
  let role = pen.role;
  if (permis && !permis.includes(role)) {
    const dehors = permis.find(x => !eq.pieces.some(y => y.role === x));
    if (!dehors) return;
    role = dehors;
  }
  const pen2 = { ...pen, role };
  const { p } = uniteDe(eq.roster, eq.tri, eq.pai).find(x => x.role === role) || {};
  const prises = new Set(surLaGlace(m).map(x => `${x.r},${x.c}`));
  // Il sort du cachot par la bande, au centre — c'est là qu'est la porte.
  const [dr, dc] = ECARTS[eq.cote][pen2.role];
  const { r, c } = caseProche(prises, borne(MJ_CENTRE.r + dr, RANG_MIN, RANG_MAX), borne(MJ_CENTRE.c + dc, 0, COLS - 1));
  const piece = pieceNeuve(eq, pen2.role, p || null, r, c);
  eq.pieces.push(piece);
  deposer(m, piece, r, c);
  normaliserEffectif(m, eq);
  dire(m, `${nomDe(piece)} sort du cachot.`, 'ok');
}

/* ---------- feinter : le un contre un du porteur ---------- */

export function dejouer(m, piece, cible) {
  return jeter(m, 'dejouer', avec(modDejouer(m, piece, cible), piece.hab === 'PATIN' && piece.habDispo ? 2 : 0));
}
export function appliquerDejouer(m, piece, cible, jet) {
  if (piece.hab === 'PATIN' && piece.habDispo) piece.habDispo = false;
  agir(m, piece);
  if (jet.reussi) {
    cible.etourdi = 1;                            // battu : hors position jusqu'à la fin du tour
    piece.deplace = false; piece.libre = true;    // et le porteur repart, sans esquive
    dire(m, `${nomDe(piece)} feinte ${nomDe(cible)} et s'en va.`, 'dejoue');
    return true;
  }
  // S42 : la feinte ratée laisse la rondelle sur place, à qui la ramasse.
  if (LIBRE_SUR_PERTE) { rebondir(m, piece.r, piece.c); revirement(m, `${nomDe(cible)} lit la feinte de ${nomDe(piece)} — la rondelle est libre.`); }
  else { donner(m, cible); revirement(m, `${nomDe(cible)} lit la feinte de ${nomDe(piece)} et lui prend la rondelle.`); }
  return false;
}

/*
 * LE TIR SUR RÉCEPTION (S35). Après une passe RÉUSSIE, le receveur peut
 * tirer sur-le-champ, dans la même main, s'il est debout et en zone de tir ;
 * sa signature 🏹 vaut +2 exactement là. C'est le une-deux, et c'est ce qui
 * fait qu'une passe crée un tir avant que la défense ait joué.
 */
export const receptionPossible = m => {
  const r = m.reception;
  if (!r || m.fini) return null;
  const x = r.receveur;
  if (m.tour !== x.eq || porteur(m) !== x || x.etourdi || !peutTirer(m, x)) return null;
  return x;
};
export function tirerSurReception(m) {
  const x = receptionPossible(m);
  if (!x) return null;
  m.reception = null;
  activer(m, x);
  return tirer(m, x);
}

/* ======================================================================
   LE TOUR
   ====================================================================== */

/*
 * UNE PIÈCE BOUGE UNE FOIS ET AGIT UNE FOIS PAR TOUR, comme un joueur de
 * Blood Bowl. Sans cette borne, l'IA repatinait la même pièce jusqu'à ce que
 * le garde-fou la coupe : seize gestes par présence (`check_table.mjs`), donc
 * un match qui n'en finissait plus. C'est la borne qui fait la vitesse.
 */
export const peutJouer = x => !x.etourdi;   // S38 : une pièce sert à chaque tour ; seul le sol l'arrête
/*
 * UN DÉPLACEMENT ET UNE ACTION PAR TOUR D'ÉQUIPE, EN ALTERNANCE (S36). JP
 * (S32) : *un joueur à la fois* ; puis (S36) : *je voulais dire qu'un tour, ça
 * devrait être un déplacement et une action, pas nécessairement du même
 * joueur*. À ta main, tu disposes d'UN déplacement et d'UNE action (`m.main`)
 * : n'importe laquelle de tes pièces patine, n'importe laquelle agit — la
 * même ou deux différentes, dans l'ordre que tu veux — puis la main passe.
 * Chaque pièce ne patine qu'une fois et n'agit qu'une fois par tour ; le
 * tour est fini quand plus personne n'a rien. C'est l'ailier qui va au filet
 * ET la passe qui le trouve, dans la même main — le une-deux devient un plan.
 */
/*
 * L'ÉCHAPPÉE (S41) : qui enlève la rondelle REPART AVEC, même si le
 * déplacement de la main est déjà pris — un défenseur s'est approché, un
 * autre a frappé, et c'est lui qui part en contre-attaque. Sans ça, le
 * nouveau porteur restait planté collé à ceux qu'il venait de dépouiller et
 * se faisait frapper à la main d'après : la rondelle en ping-pong, une main
 * par possession, mesuré.
 */
/*
 * À CHAQUE MAIN, UN JOUEUR SANS LA RONDELLE SE PLACE (S42). JP : *ya aucun
 * jeu de positionnement ou de stratégie, c'est up and down*.
 *
 * Mesuré : UNE pièce sur dix changeait de case par main. Le budget était un
 * patin et une action, et les deux partaient sur le porteur — parce
 * qu'avancer la rondelle est toujours plus urgent que se placer. Il n'y
 * avait donc jamais de formation à bâtir : le porteur montait seul, et ses
 * quatre coéquipiers regardaient depuis la case où la mise au jeu les avait
 * posés.
 *
 * La main achète maintenant un patin, une action, ET un PLACEMENT : un
 * deuxième déplacement, réservé à une pièce qui n'a PAS la rondelle. La
 * rondelle n'avance pas plus vite pour autant — c'est le seul geste de la
 * main qui ne peut pas la toucher — mais l'équipe, elle, se déploie. Le
 * une-deux, la présence au filet, la ligne de passe couverte, l'échec
 * avant : tout ça demande un joueur qui arrive AVANT la rondelle, et c'est
 * ce placement qui le paie.
 */
export const peutBouger = (m, x) => !x.etourdi && !x.deplace &&
  (POOL ? (m.main.reserve >= DEMI || !!x.echappee)
        : (!m.main.bouge || !!x.echappee || (PLACEMENT && !m.main.place && porteur(m) !== x)));
export const peutAgir = (m, x) => !x.etourdi && !x.agi && !m.main.agi;
export const actives = m => eqDe(m, m.tour).pieces.filter(x => peutBouger(m, x) || peutAgir(m, x));

/** Choisir une pièce : le une-deux ne survit qu'au receveur. */
export function activer(m, piece) {
  if (!m.reception || m.reception.receveur !== piece) m.reception = null;
}

/**
 * LA MAIN PASSE : à l'adversaire s'il lui reste une pièce qui peut jouer,
 * sinon elle reste ici ; quand plus personne n'a de pièce, le tour est fini
 * pour les deux. Le gardien qui a la rondelle la relance à chaque fois que
 * la main revient à son équipe (la sortie de zone).
 */
/*
 * CINQ MAINS PAR TOUR, CHACUNE (S37). JP : *le cpu bypass encore tours
 * normaux*. L'IA dépense souvent un seul geste par main (1,7 mesuré), le
 * joueur deux : ses pièces s'épuisaient en cinq mains, celles de l'IA en
 * huit ou neuf, et l'IA finissait chaque tour SEULE, trois ou quatre mains
 * de suite — vu de l'écran, elle sautait les tours. Une main est une main :
 * cinq par tour, qu'on y dépense un geste ou deux. Ce qu'on n'a pas joué en
 * cinq mains est perdu, pour les deux camps.
 */
/*
 * UNE MAIN CHACUN, ET C'EST UN TOUR (S38). Les cinq mains de S37 existaient
 * parce qu'une pièce ne jouait qu'une fois par tour ; maintenant qu'elle
 * rejoue à chaque tour, le tour est simplement : ta main, la sienne. Les
 * compteurs de la pièce se remettent à zéro à chaque main.
 */
export const aLaMain = (m, cote) => m.mains[cote] < 1 && eqDe(m, cote).pieces.some(peutJouer);
export function finirMain(m) {
  m.main = mainNeuve();
  m.reception = null;
  if (m.fini) return;
  m.mains[m.tour]++;
  m.dernier = m.tour;
  for (const x of eqDe(m, m.tour).pieces) { x.agi = false; x.deplace = false; x.libre = false; x.echappee = false; }
  const autre = adverse(m.tour);
  if (aLaMain(m, autre)) { m.tour = autre; sortieDeZone(m); return; }
  finirPresence(m);
}
/** Le budget de la main est-il vide, ou plus personne ne peut-il s'en servir ? */
export const mainEpuisee = m => !actives(m).length;

/** Renoncer au reste de sa présence : toutes ses pièces sont épuisées, l'adversaire enchaîne. */
export function renoncer(m) {
  finirMain(m);
}

/** Le tour est fini pour les DEUX équipes : souffle, compteurs, et l'autre ouvre le suivant. */
export function finirPresence(m, butMarque = false) {
  m.main = mainNeuve();
  m.mains = { A: 0, B: 0 };
  m.tours = (m.tours || 0) + 1;   // les tours joués : ce que les scripts comptent
  for (const cote of ['A', 'B']) {
    const eq = eqDe(m, cote);
    respirer(eq);
    for (const x of eq.pieces) { x.agi = false; x.deplace = false; x.libre = false; }
    // LE CACHOT SE VIDE avec le temps (S38) — jamais sur un but, comme dans
    // la vraie ligue : le but marqué en avantage numérique libère le puni.
    /*
     * LE CACHOT SE VIDE avec le temps, jamais sur un but SAUF pour l'équipe
     * qui l'encaisse en désavantage — la règle de la vraie ligue, et elle ne
     * libère QU'UN puni : marquer contre un cinq contre trois le ramène à
     * cinq contre quatre, pas à égalité.
     */
    if (eq.penalites.length) {
      for (const pen of eq.penalites) pen.tours--;
      const butContreNous = butMarque && m.dernierBut && m.dernierBut.piece.eq !== cote;
      if (eq.penalites[0].tours <= 0 || butContreNous) liberer(m, eq);
      if (eq.penalites.length && eq.penalites[0].tours <= 0) liberer(m, eq);
    }
  }
  for (const x of surLaGlace(m)) { if (x.etourdi) x.etourdi--; }

  // MORT SUBITE : en prolongation, le premier but finit tout.
  if (m.prolongation && butMarque) { m.fini = true; dire(m, `Fin du match. ${m.A.buts} \u2013 ${m.B.buts}`, 'fin'); return; }

  /*
   * LE COMPTEUR NE DÉPASSE JAMAIS LA DERNIÈRE PRÉSENCE. Il montait AVANT de
   * vérifier la fin de période, donc un match fini restait à « présence 13
   * sur 12 » et le tableau indicateur calculait un nombre de présences
   * restantes négatif. On vérifie d'abord, on avance ensuite.
   */
  // Une prolongation est courte : deux présences chacune, puis on recommence.
  // Un tour vaut deux présences (une par équipe) : le compte de la période
  // ne change pas, il avance de deux à la fois.
  const parPeriode = (m.prolongation ? PRESENCES_PROLONGATION : PRESENCES_PAR_PERIODE) * 2;
  // LA PÉRIODE FINIT AU PREMIER ARRÊT DE JEU après la dernière possession (S41) ; le plafond de tours n'est qu'un garde-fou.
  const possessionsFaites = m.possessions >= (m.prolongation ? POSSESSIONS_PROLONGATION : POSSESSIONS_PAR_PERIODE);
  if (possessionsFaites || m.presence + 1 >= parPeriode) {
    if (m.prolongation) { finirMatch(m); return; }
    dire(m, `Fin de la ${ordP(m.periode)} période. ${m.A.buts} – ${m.B.buts}`, 'periode');
    // LA PÉRIODE NE DÉPASSE JAMAIS LA TROISIÈME. Le compteur montait AVANT
    // de vérifier la fin, donc un match réglé en temps normal se terminait à
    // « période 4 » et le tableau indicateur affichait « 4e période ·
    // Terminé ». `finirMatch` pose lui-même la période quand il ouvre une
    // prolongation ; ici, on n'avance que s'il reste une période à jouer.
    if (m.periode >= PERIODES) { finirMatch(m); return; }
    m.periode++;
    m.presence = 1;
    m.possessions = 0;
    m.A.relance = true; m.B.relance = true;
    for (const x of surLaGlace(m)) { x.etourdi = 0; x.habDispo = true; }
    m.premier = m.periode % 2 === 1 ? 'A' : 'B';   // on change de bord de mise au jeu
    m.tour = m.premier;
    m.siffle = null;   // une période neuve repart du centre, quel que soit le sifflet
    miseAuJeu(m, `${ordP(m.periode)} période`, MJ_CENTRE);
    return;
  }
  m.presence += 2;
  /*
   * LES MAINS ALTERNENT STRICTEMENT (S39). JP : *je vois encore le cpu jouer
   * plusieurs joueurs à la suite*. L'ouvreur du tour changeait à chaque tour
   * — ce qui, à une main chacun, donnait A, B, B, A, A, B : le cpu jouait deux
   * mains de suite un tour sur deux. Le tour suivant s'ouvre par le camp qui
   * n'a PAS joué la dernière main, après un but comme après un tour plein.
   */
  m.tour = adverse(m.dernier || adverse(m.premier));
  // UN SIFFLET REPART D'UNE MISE AU JEU, à son point ; un but repart du centre.
  if (m.siffle) { const { mot, point } = m.siffle; m.siffle = null; miseAuJeu(m, mot, point); return; }
  if (butMarque) miseAuJeu(m, 'But', MJ_CENTRE);
  else sortieDeZone(m);
}

/*
 * LA SORTIE DE ZONE. Un arrêt laisse la rondelle au gardien, et le gardien
 * n'est pas une pièce qu'on joue : sans cette relance, l'équipe qui récupère
 * passait sa présence entière à converger vers son PROPRE filet. Le gardien
 * remet donc la rondelle à son défenseur le plus proche dès que la présence
 * commence — c'est ce qu'il fait dans la vraie vie, et ça rend à cette
 * équipe-là la présence qu'elle venait de perdre.
 */
function sortieDeZone(m) {
  const p = porteur(m);
  if (!p || !p.gardien) return;
  const eq = eqDe(m, p.eq);
  if (p.eq !== m.tour) return;
  // LA SORTIE DE ZONE VA VERS L'AVANT. Le gardien relançait au plus PROCHE,
  // donc au fond de sa propre zone : sur une glace de onze rangées, l'équipe
  // repartait de zéro à chaque arrêt et n'atteignait plus jamais le filet.
  // Il relance à la pièce la plus avancée — c'est la passe de sortie de zone.
  const relais = eq.pieces.filter(x => !x.etourdi)
    .sort((a, b) => Math.abs(a.r - eq.but) - Math.abs(b.r - eq.but))[0];
  if (!relais) return;
  donner(m, relais);
  dire(m, `${nomDe(p)} relance la rondelle à ${nomDe(relais)}.`, 'ok');
}

function finirMatch(m) {
  m.fini = true;
  if (m.A.buts === m.B.buts) {
    // LA PROLONGATION : une présence chacune, mort subite, et on recommence
    // tant que personne n'a marqué. Blood Bowl finit sur une nulle ; le
    // hockey, non, et un tournoi a besoin d'un gagnant.
    m.fini = false;
    // ON VÉRIFIE D'ABORD, ON AVANCE ENSUITE — la leçon du compteur de
    // période : monter `prolongation` avant de décider laissait l'état
    // incohérent (prolongation 2 en période 4) dès que la fusillade
    // s'ouvrait, et `check_regles` l'a dit en quarante matchs.
    const suivante = (m.prolongation || 0) + 1;
    /*
     * UN MATCH FINIT TOUJOURS SUR UN GAGNANT. Le tournoi est à élimination :
     * une nulle n'y veut rien dire, et `gagnantDe` aurait donné la victoire à
     * l'équipe B par accident (`gfA > gfB` étant faux). Douze prolongations
     * de deux présences chacune ne sont jamais arrivées en 200 matchs
     * mesurés — mais « jamais arrivé » n'est pas une règle. Au-delà, le bris
     * d'égalité est écrit : les lancers, puis les mises en échec, puis
     * l'équipe locale. Voir `gagnantDuMatch`.
     */
    if (suivante > PROLONGATIONS_MAX) { fusillade(m); return; }
    m.prolongation = suivante;
    m.periode = PERIODES + m.prolongation;
    m.presence = 1;
    m.possessions = 0;
    m.A.relance = true; m.B.relance = true;
    for (const x of surLaGlace(m)) { x.etourdi = 0; x.habDispo = true; }
    m.main = mainNeuve();
    m.premier = m.prolongation % 2 === 1 ? 'A' : 'B';
    m.tour = m.premier;
    dire(m, 'Prolongation — mort subite.', 'periode');
    miseAuJeu(m, 'Prolongation');
    return;
  }
  dire(m, `Fin du match. ${m.A.buts} – ${m.B.buts}`, 'fin');
}


/* ======================================================================
   L'ADVERSAIRE
   ======================================================================
   Un glouton honnête, et c'est assez : il évalue chaque geste par sa
   probabilité de réussir (`chances`) multipliée par ce qu'il rapporte, et
   joue le meilleur. Il ne triche pas — il lance les mêmes dés, sous la même
   graine, avec les mêmes modificateurs.

   La MÊME fonction sert aux matchs du tournoi joués à vide : les cinq clubs
   que tu n'affrontes pas ce soir-là jouent leur match sous les mêmes règles
   que toi. Un seul jeu de règles pour tout le tournoi, donc un classement
   qui veut dire quelque chose.
   ====================================================================== */

/* ======================================================================
   LE POSTE : OÙ UNE PIÈCE DOIT ÊTRE
   ======================================================================
   JP : *je veux que le positionnement soit logique et force à faire des
   risques pour gagner, sans que ça soit revirement but direct*.

   Il n'y avait AUCUNE notion de position défensive dans le moteur.
   `valeurCase` disait une seule chose — « plus proche du filet adverse et du
   centre » — et elle la disait pour TOUTES les pièces des DEUX équipes. Une
   pièce sans la rondelle ne bougeait donc que vers le filet adverse (« aller
   au filet ») ou vers le porteur (« fermer ») : personne ne rentrait jamais
   chez soi, et les dix patineurs s'empilaient là où était la rondelle.

   Mesuré, et c'est l'envers du hockey : la pression sur le porteur valait
   1,84 bâton dans la ZONE NEUTRE et 0,77 en zone OFFENSIVE, où le porteur
   était seul au monde une fois sur deux. Le neutre était un mur, et le
   devant du filet un désert — d'où le revirement qui devient un but direct :
   quand la rondelle changeait de camp, il n'y avait personne à la maison.

   Chaque pièce a donc un POSTE, et il se déduit de deux choses seulement :
   son RÔLE (un défenseur ne joue pas où joue un ailier) et OÙ EST LA
   RONDELLE. En attaque, les avants passent devant elle et les défenseurs
   tiennent la pointe derrière ; en défense, les défenseurs se placent ENTRE
   la rondelle et leur filet, et les avants couvrent au-dessus. La colonne
   suit l'aile : un AG et un DG tiennent la gauche, un AD et un DD la droite,
   le centre le milieu.

   C'est de là que vient le risque que JP demande. Les deux défenseurs
   rentrés, une attaque est un trois contre deux plus le gardien : pour
   créer mieux, il faut MONTER un défenseur — et la pointe qu'il laisse est
   exactement le contre que l'autre attend. Le jeu ne l'impose pas, il le
   rend payant : c'est une décision, pas une règle.
   ====================================================================== */
const ROLE_COL = { AG: -1, C: 0, AD: 1, DG: -1, DD: 1 };
const estDefenseur = piece => piece.role === 'DG' || piece.role === 'DD';
/* La profondeur d'un poste, en rangées depuis le filet attaqué. */
export const POSTE = {
  avanceF: 2,   // en attaque, l'avant passe DEVANT la rondelle
  reculD: 4,    // en attaque, le défenseur tient la pointe DERRIÈRE elle
  couvF: 1,     // en défense, l'avant couvre au-dessus de la rondelle
  couvD: 2,     // en défense, le défenseur se met ENTRE la rondelle et son filet
};
export const LARGEUR_POSTE = Math.round((COLS - 1) / 4);   // l'écart d'une aile au centre
/* Combien de pièces vont à la rondelle : les autres tiennent leur poste. */
export const FORECHECK = 2;

/**
 * Le poste d'une pièce : la case qu'elle doit occuper, vu son rôle et où est
 * la rondelle. Trois situations, et elles se lisent sur la glace :
 *
 *   EN ATTAQUE       l'avant passe DEVANT la rondelle, le défenseur tient la
 *                    pointe derrière elle ; chacun sur son aile.
 *   EN DÉFENSE, LOIN l'avant couvre au-dessus de la rondelle, le défenseur
 *                    se met entre elle et son filet ; chacun sur son aile.
 *   DANS SA ZONE     LE REPLI EN BOÎTE : les deux défenseurs collapsent
 *                    DEVANT LEUR FILET, côte à côte, et les avants couvrent
 *                    la pointe. C'est ce qui manquait — ils tenaient leur
 *                    colonne à trois cases du but, donc un porteur arrivé
 *                    dans l'enclave n'avait personne sur lui : la pression
 *                    en zone offensive valait 0,41 bâton et le devant du
 *                    filet était un désert. Un revirement devenait un but
 *                    parce que personne n'était à la maison.
 */
export function posteDe(m, piece) {
  const eq = eqDe(m, piece.eq);
  const but = eq.but;
  const pos = porteur(m) || libre(m);
  const sP = pos ? borne(profondeur(pos.r, but), 0, LONGUEUR) : LONGUEUR / 2;
  const nous = !!porteur(m) && porteur(m).eq === piece.eq;
  const d = estDefenseur(piece);
  const aile = ROLE_COL[piece.role] ?? 0;
  const chezNous = !nous && sP >= LONGUEUR - PORTEE_TIR;
  let s, larg;
  if (chezNous) {
    // Le repli : les défenseurs devant le filet, les avants sur la pointe.
    s = d ? LONGUEUR - 1 : LONGUEUR - PORTEE_TIR + 1;
    larg = d ? 1 : LARGEUR_POSTE;
  } else {
    s = sP + (nous ? (d ? POSTE.reculD : -POSTE.avanceF) : (d ? POSTE.couvD : -POSTE.couvF));
    larg = LARGEUR_POSTE;
  }
  s = borne(s, 1, LONGUEUR - 1);
  /*
   * ON NE DEVANCE PAS LA RONDELLE (S45). Le poste d'un avant est DEVANT
   * elle : tant que le hors-jeu n'était qu'un filtre de déplacement, ça ne
   * coûtait rien — les cases ne s'allumaient pas, et l'IA s'arrêtait là.
   * Depuis qu'il se siffle, ce même poste met tout le trio hors-jeu à la
   * première entrée de zone : mesuré, 44 mises au jeu par match. Un poste
   * sans la rondelle s'arrête donc à la ligne bleue, exactement comme un
   * vrai ailier qui attend que la rondelle entre avant lui.
   */
  if (!rondelleEnZone(m, piece.eq) && porteur(m) !== piece) s = Math.min(s, LONGUEUR - PORTEE_TIR - 1);
  const r = borne(but + s * sensDe(but), RANG_MIN, RANG_MAX);
  const c = borne(BUT_COL + aile * larg, 0, COLS - 1);
  return { r, c };
}

/*
 * L'IA TIENT SA LIGNE (S45). Le hors-jeu n'est plus un filtre pour tout le
 * monde — le joueur peut devancer la rondelle, et l'arbitre tranche — mais
 * une IA qui se met hors-jeu ne prend aucun risque calculé : elle se siffle
 * dessus. Sans ce garde, mesuré : 29 hors-jeu et 42 mises au jeu par match,
 * un match qui ne fait que repartir. Elle écarte donc les cases qui la
 * mettraient hors-jeu ; c'est la même règle que celle du poste, appliquée
 * au geste plutôt qu'à l'intention.
 */
const sesCases = (m, piece) => {
  const cases = deplacementsDe(m, piece);
  if (porteur(m) === piece || rondelleEnZone(m, piece.eq)) return cases;
  const but = eqDe(m, piece.eq).but;
  return cases.filter(v => profondeur(v.r, but) > PORTEE_TIR);
};

/** Cette pièce est-elle une des `FORECHECK` plus proches de la rondelle ? */
/*
 * UNE RONDELLE LIBRE AMÈNE DU MONDE. JP : *c'est correct que la rondelle
 * change de possession plusieurs fois, tant qu'elle reste pas prise là*.
 * Deux pièces suffisent à harceler un PORTEUR — les trois autres tiennent
 * leur poste, c'est ce qui donne la forme. Mais sur une rondelle LIBRE,
 * deux, c'est ce qui la laisse traîner : mesuré, elle restait immobile
 * 48 % des mains et dans le même rayon de deux cases pendant 4,3 mains
 * d'affilée, jusqu'à 29. Au hockey, une rondelle libre est une mêlée :
 * `FORECHECK_LIBRE` pièces y vont.
 */
export const FORECHECK_LIBRE = Number(MESURE.CHASSE) || 4;
/* Ce que vaut la course à la rondelle libre, en plus : `CHASSEV` pour la MESURE. */
const CHASSE_VAL = MESURE.CHASSEV !== undefined ? Number(MESURE.CHASSEV) : 5;
/* Ce que coûte un dégagement refusé dans la balance de l'IA : la mise au jeu revient chez elle. */
const COUT_ICING = MESURE.ICING !== undefined ? Number(MESURE.ICING) : 2.2;
function vaALaRondelle(m, piece, vise) {
  const amis = eqDe(m, piece.eq).pieces.filter(x => !x.gardien && !x.etourdi);
  const combien = libre(m) ? FORECHECK_LIBRE : FORECHECK;
  return amis.slice().sort((a, b) => dist(a, vise) - dist(b, vise)).indexOf(piece) < combien;
}

/* Ce que vaut une case pour qui attaque `but` : proche du filet et au centre. */
function valeurCase(r, c, but) {
  const s = profondeur(r, but);
  // Derrière le filet et la ligne des buts valent la pointe, pas l'enclave : on n'y va que pour la passe qui en sort.
  const d = s >= 1 ? s : 3 - s * 0.5;
  return (LONGUEUR + 1 - d) * 1.0 + (BUT_COL - Math.abs(c - BUT_COL)) * 0.6;
}

/*
 * L'IA PÈSE CHAQUE GESTE AVEC LA MÊME BALANCE (S41) : ses chances (le duel,
 * lu par `chancesDe`) fois ce que le geste rapporte s'il passe, moins ses
 * chances de rater fois ce que l'échec coûte — et l'échec a le même tarif
 * qu'à l'écran : la rondelle perdue (3), la pièce hors position (1,5). Ce
 * qu'un geste rapporte se lit toujours dans la même unité : un but vaut 11,
 * une chance de tir vaut 9 fois cette chance, une case gagnée vaut sa
 * valeur (`valeurCase`). Rien d'autre n'entre.
 */
const COUT_RONDELLE = 3, COUT_POSITION = 1.5;

/** Le meilleur geste d'une pièce, et ce qu'il vaut. */
/* ======================================================================
   CE QUE L'IA PÈSE, UNE FAMILLE DE GESTE À LA FOIS (S46).

   JP : *check que ya pas de fonctions spaghettis, que tout est tight, bien
   codé*. `meilleurGeste` faisait 180 lignes et tenait TOUT : le tir, les
   passes, le dégagement, la feinte, la montée, le contact, le poste et la
   course à la rondelle, dans une seule suite de `if` imbriqués partageant
   une dizaine de variables locales. On ne pouvait ni lire une décision sans
   lire les huit autres, ni en changer une sans risquer les sept voisines.

   Chaque famille est maintenant sa propre fonction, qui rend les options
   qu'elle propose et rien d'autre. `meilleurGeste` ne fait plus que les
   appeler dans l'ordre et garder la meilleure.

   L'ORDRE EST UNE RÈGLE, PAS UN DÉTAIL : `sort` est stable, donc à valeur
   ÉGALE c'est l'option poussée en premier qui gagne. Changer l'ordre des
   appels change les matchs. L'empreinte du moteur (40 matchs à graine fixe,
   le fil entier condensé) le prouve : elle est identique avant et après.
   ====================================================================== */

/** Le bonus d'habileté d'une pièce pour un geste donné : +2, une fois par période. */
const bonusDe = (piece, h) => (piece.hab === h && piece.habDispo ? 2 : 0);

/*
 * TIRER POUR LE RETOUR (S42). Un tir raté valait 0,3 — une miette — parce
 * qu'avant les postes, personne n'était devant le filet pour ramasser le
 * retour. Maintenant que les avants s'y placent, le retour est une vraie
 * deuxième chance : le tir en vaut `VAL_RETOUR` de plus par coéquipier
 * posté devant le gardien. C'est ce qui fait qu'on lance au filet au lieu
 * de chercher la passe parfaite — et ce qui crée la mêlée devant le but.
 */
function optionTir(m, piece, eq) {
  if (!peutTirer(m, piece)) return [];
  const devant = eq.pieces.filter(x => x !== piece && !x.gardien && !x.etourdi &&
    profondeur(x.r, eq.but) <= 2).length;
  const c = chancesDe(avec(modTir(m, piece), bonusDe(piece, 'DECOCHE')));
  return [{ type: 'tir', val: c * 11 + (1 - c) * devant * VAL_RETOUR + 0.3 }];
}

/** PASSER : au coéquipier qui gagne du terrain, ou qui tire mieux que toi d'où il est. */
function optionsPasse(m, piece, eq) {
  const out = [];
  const tirIci = peutTirer(m, piece) ? chancesDe(modTir(m, piece)) : 0;
  for (const cible of receveursDe(m, piece)) {
    const gain = valeurCase(cible.r, cible.c, eq.but) - valeurCase(piece.r, piece.c, eq.but);
    const tir = (peutTirer(m, cible) ? chancesDe(modTir(m, cible)) : 0) - tirIci;
    if (gain <= 0 && tir <= 0.02) continue;
    const c = chancesDe(avec(modPasse(m, piece, cible), bonusDe(piece, 'VOILEE')));
    out.push({ type: 'passe', cible, val: c * (2.5 + gain * 2.0 + tir * 9) - (1 - c) * COUT_RONDELLE });
  }
  return out;
}

/*
 * AU FOND : la sortie d'un porteur sous pression, quand un coéquipier est
 * plus près du fond que l'adversaire.
 *
 * ELLE DÉGAGE DE SA ZONE AUSSI, MAIS ÇA LUI COÛTE. Premier jet : on le lui
 * interdisait, et le dégagement refusé devenait une règle que SEUL un
 * humain pouvait commettre — donc qu'aucune mesure ne touchait jamais
 * (0,00 sur 30 matchs). Une règle qu'aucun script n'exerce est une règle
 * qu'on casse sans le savoir. Elle le joue donc, au prix du sifflet :
 * `COUT_ICING` le rend perdant tant qu'autre chose tient debout, et gagnant
 * quand plus rien ne tient — ce qui est exactement quand un vrai joueur le
 * fait.
 */
function optionFond(m, piece, eq) {
  let mieux = null;
  const amis = eq.pieces.filter(x => x !== piece && !x.etourdi);
  const rivaux = eqDe(m, adverse(piece.eq)).pieces.filter(x => !x.etourdi);
  const deChezNous = profondeur(piece.r, eq.but) <= PORTEE_TIR;
  for (const v of ciblesFondDe(m, piece)) {
    const proche = Math.min(...amis.map(x => dist(x, v)), 9);
    const rival = Math.min(...rivaux.map(x => dist(x, v)), 9);
    // De sa PROPRE zone, on ne dégage pas pour récupérer — on dégage pour
    // s'en débarrasser : la course au fond ne se juge pas.
    if (!deChezNous && proche > rival) continue;
    const val = chancesDe(modPasse(m, piece, v)) * (2.0 + Math.max(0, 3 - proche) * 0.6) - 1.2
      - (deChezNous ? COUT_ICING : 0);
    if (!mieux || val > mieux.val) mieux = { type: 'passe', cible: v, val };
  }
  return mieux ? [mieux] : [];
}

/** FEINTER : sous pression, prendre le bâton qui te tient en un contre un. */
function optionsFeinte(m, piece, eq) {
  return ciblesDejouerDe(m, piece).map(cible => {
    const devant = Math.max(0, LONGUEUR - profondeur(piece.r, eq.but));
    const c = chancesDe(avec(modDejouer(m, piece, cible), bonusDe(piece, 'PATIN')));
    return { type: 'dejouer', cible, val: c * (3.5 + devant * 0.3) - (1 - c) * COUT_RONDELLE };
  });
}

/*
 * LA MONTÉE (S39) : le patin du porteur vaut le terrain gagné ET le tir
 * qu'il ouvre dans la même main. Finir collé à un adversaire, c'est offrir
 * le contact à la main d'après (deux fois sur trois, la rondelle) ; en
 * partir, c'est s'en sortir. La même balance que le reste : chances fois
 * ce que ça rapporte, moins le risque fois ce que ça coûte.
 */
function optionMontee(m, piece, eq) {
  let mieux = null;
  const tenu = batons(m, piece.eq, piece.r, piece.c) > 0;
  for (const v of sesCases(m, piece)) {
    const gain = valeurCase(v.r, v.c, eq.but) - valeurCase(piece.r, piece.c, eq.but);
    // Reculer pour se sortir d'un bâton vaut la peine ; reculer pour rien, non.
    if (gain <= 0 && !tenu) continue;
    const c = esquiveRequise(m, piece, v) ? chancesDe(avec(modEsquive(m, piece, v), bonusDe(piece, 'PATIN'))) : 1;
    const contact = batons(m, piece.eq, v.r, v.c) > 0 ? 0.65 * COUT_RONDELLE : 0;
    const sortie = tenu ? 0.65 * COUT_RONDELLE : 0;
    const tirOuvert = !m.main.agi && !piece.agi && peutTirerDe(v.r, v.c, eq.but, filetVide(m, piece))
      ? chancesDe(avec(modTir(m, piece, v), bonusDe(piece, 'DECOCHE'))) * 9 : 0;
    const val = c * (2 + gain * 0.9 + tirOuvert + sortie - contact) - (1 - c) * COUT_RONDELLE;
    if (!mieux || val > mieux.val) mieux = { type: 'deplacer', vers: v, val };
  }
  return mieux ? [mieux] : [];
}

/** FRAPPER et HARPONNER : le porteur vaut la rondelle, un autre vaut la voie qu'il ouvre. */
function optionsContact(m, piece) {
  const p = porteur(m);
  const out = [];
  for (const cible of ciblesEchecDe(m, piece)) {
    const porte = p === cible;
    const solide = (piece.hab === 'EPAULE' && piece.habDispo) || piece.st.gb === GABARIT_MATADOR;
    const c = chancesDe(avec(modEchec(m, piece, cible), bonusDe(piece, 'ACTIF') + bonusDe(piece, 'EPAULE')));
    out.push({ type: 'echec', cible, val: c * (porte ? 9 : 2.0) - (1 - c) * (solide ? 0.3 : COUT_POSITION) });
  }
  for (const cible of ciblesVolDe(m, piece)) {
    const c = chancesDe(avec(modVol(m, piece, cible), bonusDe(piece, 'ACTIF')));
    out.push({ type: 'vol', cible, val: c * 9 - (1 - c) * COUT_POSITION });
  }
  return out;
}

/*
 * TENIR SON POSTE (S42). Une pièce sans la rondelle rejoint la case que son
 * rôle lui donne (`posteDe`) : l'avant devant la rondelle, le défenseur
 * derrière elle en attaque et entre elle et son filet en défense. C'est ce
 * qui remplit le devant du filet quand on attaque ET qui laisse deux
 * défenseurs à la maison quand on perd la rondelle — donc un revirement
 * n'est plus un but.
 *
 * Ce qu'on gagne à son poste se lit dans la même balance : être ouvert (la
 * passe te trouve), être à portée de tir, et la passe que le porteur
 * pourrait te faire tout de suite. Sans les postes (`POSTES=0`, la mesure),
 * on retombe sur l'ancienne règle : avancer vers le filet adverse.
 */
function optionPlacement(m, piece, eq) {
  const p = porteur(m);
  const notre = !!p && p.eq === piece.eq;
  const poste = POSTES ? posteDe(m, piece) : null;
  if (!POSTES && !notre) return [];
  const d0 = poste ? dist(piece, poste) : 0;
  let mieux = null;
  for (const v of sesCases(m, piece)) {
    let base;
    if (poste) {
      const rapproche = d0 - dist(v, poste);
      if (rapproche <= 0) continue;
      base = 1.0 + rapproche * 0.8;
    } else {
      const gain = valeurCase(v.r, v.c, eq.but) - valeurCase(piece.r, piece.c, eq.but);
      if (gain <= 0) continue;
      base = 1.2 + gain * 0.7;
    }
    const ouvert = pression(m, piece.eq, v.r, v.c).n === 0 ? 0.9 : 0;
    const tir = (poste ? notre : true) && peutTirerDe(v.r, v.c, eq.but, filetVide(m, piece)) ? 1.4 : 0;
    const passe = (poste ? notre : true) && !m.main.agi && peutAgir(m, p) ? chancesDe(modPasse(m, p, v)) * 1.2 : 0;
    const val = base + ouvert + tir + passe;
    if (!mieux || val > mieux.val) mieux = { type: 'deplacer', vers: v, val };
  }
  return mieux ? [mieux] : [];
}

/*
 * FERMER : vers le porteur adverse ou la rondelle libre — chaque case de
 * moins entre lui et toi, c'est de la pression de plus. DEUX pièces y vont,
 * les autres tiennent leur poste (S42) : sans ça les cinq convergeaient et
 * l'équipe n'avait plus de forme.
 *
 * COURIR APRÈS UNE RONDELLE LIBRE VAUT PLUS QUE TENIR SON POSTE. S'en
 * approcher ne valait que `3 − distance × 0,6` : à trois cases, 1,2 — moins
 * que rejoindre son poste. Les pièces tenaient donc leur forme pendant que
 * la rondelle traînait, et elle restait libre jusqu'à vingt-cinq mains. La
 * course vaut `CHASSE_VAL` de plus tant qu'elle n'est à personne : une
 * rondelle libre est le seul objet du jeu.
 */
function optionChasse(m, piece) {
  const rondelleLibre = libre(m);
  const p = porteur(m);
  const vise = rondelleLibre || (p && p.eq !== piece.eq ? p : null);
  if (!vise || (POSTES && !vaALaRondelle(m, piece, vise))) return [];
  let mieux = null;
  const d0 = dist(piece, vise);
  for (const v of sesCases(m, piece)) {
    const d = dist(v, vise);
    if (d >= d0 && !(rondelleLibre && d === 0)) continue;
    const prise = rondelleLibre && d === 0 ? (bataillePossible(m, piece, v) ? 4 * chancesDe(modBataille(m, piece, v)) : 4) : 0;
    // Se coller au porteur vaut le contact qu'on pourra lui donner ensuite.
    const contact = !rondelleLibre && d === 1 && !m.main.agi && peutAgir(m, piece) ? 1.5 : 0;
    const val = 3 - d * 0.6 + prise + contact + (rondelleLibre ? CHASSE_VAL : 0);
    if (!mieux || val > mieux.val) mieux = { type: 'deplacer', vers: v, val };
  }
  return mieux ? [mieux] : [];
}

/**
 * LE MEILLEUR GESTE : chaque famille propose, la plus grosse valeur gagne.
 * L'ordre des appels départage les égalités (`sort` est stable) — il fait
 * donc partie de la règle, et l'empreinte du moteur le vérifie.
 */
function meilleurGeste(m, piece) {
  const eq = eqDe(m, piece.eq);
  const options = [];
  const pousser = liste => { for (const o of liste) options.push(o); };

  if (porteur(m) === piece) {
    if (peutAgir(m, piece)) {
      pousser(optionTir(m, piece, eq));
      pousser(optionsPasse(m, piece, eq));
      // Le dégagement et la feinte ne se pèsent que SOUS PRESSION : sans
      // bâton sur soi, se débarrasser de la rondelle ou tenter un contre un
      // n'a aucune raison d'être.
      if (pressionDe(m, piece).n > 0) {
        pousser(optionFond(m, piece, eq));
        pousser(optionsFeinte(m, piece, eq));
      }
    }
    if (peutBouger(m, piece)) pousser(optionMontee(m, piece, eq));
  } else {
    if (peutAgir(m, piece)) pousser(optionsContact(m, piece));
    if (peutBouger(m, piece)) {
      pousser(optionPlacement(m, piece, eq));
      pousser(optionChasse(m, piece));
    }
  }
  if (!options.length) return null;
  return options.sort((a, b) => b.val - a.val)[0];
}

/*
 * L'IA RETIRE SON GARDIEN quand la règle le permet — menée d'un ou deux
 * buts, dans la dernière poignée de possessions de la troisième. Il n'y a
 * rien à peser : à ce moment-là, un patineur de plus vaut toujours mieux
 * que le but qu'on va encaisser de toute façon en perdant. C'est aussi ce
 * qui rend la règle MESURABLE — une règle que seul un humain peut jouer
 * est une règle qu'aucun script n'exerce.
 */
function iaDesert(m) {
  if (!peutRetirerGardien(m, m.tour)) return false;
  return retirerGardien(m, m.tour);
}

/**
 * LE PROCHAIN GESTE DE L'IA, sans le jouer : la décision séparée de
 * l'exécution, pour que l'écran joue la main adverse un geste à la fois.
 */
function iaProchainGeste(m, cote) {
  let joue = null, sur = null;
  const p = porteur(m);
  for (const piece of actives(m)) {
    const g = meilleurGeste(m, piece);
    if (!g) continue;
    if (!joue || g.val > joue.val) joue = { piece, ...g };
    if (piece !== p && (!sur || g.val > sur.val)) sur = { piece, ...g };
  }
  // Le déplacement d'un coéquipier d'abord, quand la main a encore ses deux
  // gestes et que le porteur ne tient pas une montée qui vaut mieux.
  if (!m.main.bouge && !m.main.agi && sur && sur.type === 'deplacer' && sur.val > 2.5 && joue && joue.piece === p && joue.val < 4) return sur;
  if (joue && joue.val > 0) return joue;
  // Quand il ne reste rien de mieux, le porteur lance, s'il est à portée.
  if (p && p.eq === cote && peutAgir(m, p) && peutTirer(m, p)) return { piece: p, type: 'tir' };
  return null;
}

/**
 * L'IA joue UN SEUL geste. Rend `{ piece, type }`, ou null quand il ne lui
 * reste rien — auquel cas elle a terminé sa présence. C'est ce que l'écran
 * appelle sur une minuterie pour que le plateau et le fil avancent ensemble.
 */
export const GESTES_MAX = POOL ? 8 : 4;   // le garde-fou d'une main : une action, les patins du budget partagé, et ce qui les suit (réception)

/**
 * L'IA joue UN geste de sa main courante. Quand le budget est vide — ou que
 * plus rien de bon ne reste — la main passe (rend null).
 */
export function iaGeste(m) {
  if (m.fini) return null;
  const cote = m.tour;
  const eq = eqDe(m, cote);
  // Le filet désert se décide AVANT de jouer : c'est un changement, pas un geste.
  iaDesert(m);
  // LE UNE-DEUX : une passe vient de réussir, le receveur peut tirer tout de
  // suite. L'IA le prend dès que ses chances valent le tir qu'elle aurait
  // pris elle-même de là.
  {
    const x = receptionPossible(m);
    if (x && chancesDe(modTir(m, x)) >= 0.25) {
      const joue = { piece: x, type: 'reception' };
      const jet = jouerGeste(m, x, joue, x.eq, true);
      if (!m.fini && m.tour === cote && mainEpuisee(m)) finirMain(m);
      return { ...joue, jet };
    }
  }
  const fraiche = !m.main.bouge && !m.main.agi;
  // Le changement de ligne est instantané (S38) : au début de chaque main.
  if (fraiche && !m.main.change) iaChanger(m, cote);
  const joue = iaProchainGeste(m, cote);
  if (!joue) {
    // RIEN DE BON À JOUER. Une main entamée passe simplement (ses pièces
    // gardent ce qu'il leur reste pour les mains suivantes) ; une main
    // FRAÎCHE sans rien à jouer renonce à la présence — sans ça, deux
    // équipes qui ont encore des pièces mais plus rien à en faire se
    // renvoyaient la main pour toujours (sept matchs sur 120 ne finissaient
    // pas, mesuré en S32).
    if (fraiche) dire(m, `${eq.nom} n'a rien à jouer.`, 'fin-presence');
    finirMain(m);
    return null;
  }
  activer(m, joue.piece);
  const jet = jouerGeste(m, joue.piece, joue, cote, true);
  // Le budget vide, la main passe — sauf si une passe vient d'ouvrir le
  // une-deux : le receveur décide au prochain appel.
  if (!m.fini && m.tour === cote && mainEpuisee(m) && !receptionPossible(m)) finirMain(m);
  return { ...joue, jet };
}

/**
 * L'IA joue UNE présence complète, d'un coup. C'est ce que les matchs du
 * tournoi joués à vide utilisent, et ce que `check_table.mjs` et
 * `check_regles.mjs` mesurent ; l'écran, lui, passe par `iaGeste`.
 *
 * `surGeste` est appelé après CHAQUE geste : c'est la couture qui permet à
 * `check_regles.mjs` de vérifier l'état du plateau entre deux gestes et pas
 * seulement entre deux présences — un chevauchement ou une rondelle perdue
 * peut naître et disparaître à l'intérieur d'une même présence.
 */
/**
 * L'IA joue UNE MAIN complète (un déplacement et une action, jusqu'à
 * GESTES_MAX gestes), puis rend la main. C'est ce que les matchs joués à vide
 * et les scripts appellent en boucle ; l'écran, lui, passe par `iaGeste`.
 */
export function iaPresence(m, surGeste = null) {
  const cote = m.tour;
  const gestes = [];
  let garde = 0;
  while (m.tour === cote && !m.fini && garde++ < GESTES_MAX) {
    const joue = iaGeste(m);
    if (!joue) break;
    gestes.push({ piece: joue.piece, type: joue.type, cible: joue.cible, jet: joue.jet });
    if (surGeste) surGeste(joue.type, joue.piece);
  }
  // LE GARDE-FOU DOIT QUAND MÊME RENDRE LA MAIN : une main qui atteint la
  // limite finit, sinon la boucle appelante ne s'arrête jamais.
  if (!m.fini && m.tour === cote) finirMain(m);
  return gestes;
}

/**
 * Joue un geste de bout en bout : le jet, la relance si l'IA en veut une, et
 * l'application. L'écran humain, lui, appelle les deux moitiés séparément
 * pour offrir la relance entre les deux. Rend le JET quand il y en a eu un,
 * pour que l'écran puisse le montrer aussi quand c'est l'adversaire qui joue.
 */
export function jouerGeste(m, piece, action, cote, ia = false) {
  if (action.type === 'deplacer') {
    const d = deplacer(m, piece, action.vers);
    if (!d.jet) return null;
    let jet = d.jet;
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    if (d.bataille) appliquerBataille(m, piece, action.vers, jet);
    else appliquerEsquive(m, piece, action.vers, jet);
    return jet;
  }
  if (action.type === 'passe') {
    let jet = passer(m, piece, action.cible);
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    appliquerPasse(m, piece, action.cible, jet);
    return jet;
  }
  if (action.type === 'tir') {
    let jet = tirer(m, piece);
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    appliquerTir(m, piece, jet);
    return jet;
  }
  if (action.type === 'echec') {
    let jet = mettreEnEchec(m, piece, action.cible);
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    appliquerEchec(m, piece, action.cible, jet);
    return jet;
  }
  if (action.type === 'vol') {
    let jet = voler(m, piece, action.cible);
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    appliquerVol(m, piece, action.cible, jet);
    return jet;
  }
  if (action.type === 'dejouer') {
    let jet = dejouer(m, piece, action.cible);
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    appliquerDejouer(m, piece, action.cible, jet);
    return jet;
  }
  if (action.type === 'reception') {
    let jet = tirerSurReception(m);
    if (!jet) return null;
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    appliquerTir(m, piece, jet);
    return jet;
  }
  return null;
}

/**
 * L'IA CHANGE SES TRIOS. Sans ça, elle finirait le match avec son premier
 * trio à zéro de souffle pendant que le joueur, lui, roule ses quatre unités
 * — et la fatigue deviendrait un impôt que seul l'humain paie. Elle change
 * dès que la moyenne de souffle de l'unité tombe à un, et elle prend l'unité
 * la plus reposée. Le coût est le même pour elle : ses pièces rentrent de
 * son bout de glace et elle perd sa position.
 */
function iaChanger(m, cote) {
  const eq = eqDe(m, cote);
  // Le souffle se lit en PART du maximum : un trio à moins du tiers change.
  const part = (joueurs) => {
    const vals = joueurs.filter(Boolean).map(p => (eq.souffle.get(p) ?? souffleMax(statsDeTable(p))) / souffleMax(statsDeTable(p)));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
  };
  const trios = [0, 1, 2, 3].map(u => uniteDe(eq.roster, u, 0).slice(0, 3).map(x => x.p));
  const paires = [0, 1, 2].map(u => uniteDe(eq.roster, 0, u).slice(3).map(x => x.p));
  const p = porteur(m);
  const porteRole = p && p.eq === cote ? p.role : null;
  let tri = eq.tri, pai = eq.pai;
  if (part(trios[eq.tri]) <= 0.34 && !CASES_F.includes(porteRole)) tri = trios.map((t, i) => [part(t), i]).sort((a, b) => b[0] - a[0])[0][1];
  if (part(paires[eq.pai]) <= 0.34 && !CASES_D.includes(porteRole)) pai = paires.map((t, i) => [part(t), i]).sort((a, b) => b[0] - a[0])[0][1];
  if ((tri !== eq.tri || pai !== eq.pai) && changerUnite(m, cote, tri, pai)) dire(m, `${eq.nom} change ses lignes.`, 'changement');
}

/**
 * Quand l'IA dépense sa relance : seulement si le dé relancé a de vraies
 * chances (le modificateur n'est pas désespéré) et si le geste comptait —
 * un tir, une passe, une mise en échec. Elle la garde pour le moment où ça
 * change le match, comme un joueur le ferait.
 */
function relanceIA(m, cote, jet) {
  const eq = eqDe(m, cote);
  if (!eq.relance) return jet;
  if (chances(jet.mod, jet.mod2, jet.opp, jet.rondelle) < 0.3) return jet;
  if (jet.quoi === 'esquive' && m.periode <= 2) return jet;
  if (jet.quoi === 'fond') return jet;   // la rondelle est libre de toute façon
  return relancer(m, jet, cote);
}

/**
 * Un match joué à vide, des deux bords : c'est comme ça que se jouent les
 * matchs du tournoi auxquels tu n'assistes pas. Même moteur, même graine,
 * mêmes règles — juste personne pour regarder.
 */
export function jouerMatchAuto(A, B, graine) {
  const m = nouveauMatch(A, B, graine);
  let garde = 0;
  // Dix activations par tour, trente-six tours et la prolongation : 4000 est large.
  while (!m.fini && garde++ < 4000) iaPresence(m);
  return resultatDe(m);
}

/**
 * QUI A GAGNÉ, sans jamais rendre « personne ». Le pointage d'abord ; si
 * douze prolongations n'ont pas départagé les deux clubs, les lancers, puis
 * les mises en échec, puis l'équipe qui recevait. Rend 'A' ou 'B'.
 */
/*
 * LES TIRS DE BARRAGE (S46). Le match nul se réglait par un bris d'égalité
 * ÉCRIT — les lancers, puis les mises en échec, puis l'équipe locale : un
 * pense-bête, pas du hockey. La fusillade est le SEUL endroit du plateau où
 * un joueur affronte le gardien seul, et le moteur savait déjà le jouer :
 * c'est le duel du tir, sans place ni bâtons, TI contre AR.
 *
 * Trois tireurs chacun, puis mort subite — les vraies règles. Les tireurs
 * sont les meilleurs TI de l'alignement, dans l'ordre, parce que c'est ce
 * qu'un entraîneur envoie ; le gardien est celui qui a joué le match.
 */
const TIREURS_FUSILLADE = 3;
function fusillade(m) {
  m.fusillade = { A: 0, B: 0, tours: [] };
  const tireursDe = eq => [...new Set(uniteDe(eq.roster, 0, 0).concat(uniteDe(eq.roster, 1, 1), uniteDe(eq.roster, 2, 2))
    .map(x => x.p).filter(Boolean))]
    .map(p => ({ p, st: statsDeTable(p) }))
    .sort((a, b) => b.st.TI - a.st.TI);
  const tir = (tireur, gardien) => {
    // Sans place ni bâtons : le tireur, le gardien, et un dé chacun.
    const d = duel(tireur.st.TI, gardien.st.AR, true, ['TI', 'AR'], false, [tireur.st.TI, gardien.st.AR]);
    return jeter(m, 'barrage', d).reussi;
  };
  const tA = tireursDe(m.A), tB = tireursDe(m.B);
  dire(m, 'Tirs de barrage.', 'periode');
  let i = 0;
  // Trois chacun, puis un pour un jusqu'à ce que l'un manque et l'autre non.
  while (true) {
    const a = tireurs(tA, i), b = tireurs(tB, i);
    const rA = tir(a, m.B.piece_g), rB = tir(b, m.A.piece_g);
    if (rA) m.fusillade.A++;
    if (rB) m.fusillade.B++;
    m.fusillade.tours.push({ a: a.p, ra: rA, b: b.p, rb: rB });
    dire(m, `Barrage ${i + 1} — ${nomJoueur(a.p)} ${rA ? 'marque' : 'est arrêté'}, ${nomJoueur(b.p)} ${rB ? 'marque' : 'est arrêté'}.`, rA || rB ? 'but' : 'arret');
    i++;
    if (i >= TIREURS_FUSILLADE && m.fusillade.A !== m.fusillade.B) break;
    if (i >= 40) break;   // garde-fou : deux alignements parfaitement égaux
  }
  /*
   * LE BUT DE LA FUSILLADE N'EST LE BUT DE PERSONNE. Premier jet :
   * `eqDe(m, gagne).buts++` — et l'égalité de la feuille cassait aussitôt
   * (22 fois sur 240 matchs), parce que « les buts d'une équipe = la somme
   * des buts de ses joueurs » est un INVARIANT de ce dépôt, pas un détail.
   * Une fusillade ne se marque pas au pointage des joueurs : elle désigne
   * un vainqueur, et c'est `m.vainqueur` que `gagnantDuMatch` lit en
   * premier. Le tableau reste à égalité, comme une vraie feuille de match.
   */
  const gagne = m.fusillade.A > m.fusillade.B ? 'A' : m.fusillade.B > m.fusillade.A ? 'B' : null;
  m.vainqueur = gagne || 'A';   // 'A' : jamais vu, deux alignements identiques sur 40 tours
  m.fini = true;
  dire(m, `Fin du match après les tirs de barrage. ${m.A.buts} – ${m.B.buts}`, 'fin');
}
/** Le i-ième tireur, en tournant si la liste est plus courte que la fusillade. */
const tireurs = (liste, i) => liste[i % liste.length];
const nomJoueur = p => (p && p.n) || 'Rappel';

export function gagnantDuMatch(r) {
  // LE VAINQUEUR DE LA FUSILLADE tranche avant tout le reste (S46).
  if (r.vainqueur) return r.vainqueur;
  if (r.gfA !== r.gfB) return r.gfA > r.gfB ? 'A' : 'B';
  if (r.A.tirs !== r.B.tirs) return r.A.tirs > r.B.tirs ? 'A' : 'B';
  if (r.A.echecs !== r.B.echecs) return r.A.echecs > r.B.echecs ? 'A' : 'B';
  return 'A';
}

/** Le résultat d'un match : ce que le tournoi retient. */
export function resultatDe(m) {
  const fiche = eq => ({
    nom: eq.nom, tag: eq.tag, buts: eq.buts, tirs: eq.tirs,
    revirements: eq.revirements, echecs: eq.echecs, punitions: eq.punitions, modsTir: eq.modsTir,
    marqueurs: [...eq.fiches.values()].filter(f => f.buts || f.passes)
      .map(f => ({ p: f.p, buts: f.buts, passes: f.passes })),
    physique: [...eq.fiches.values()].filter(f => f.echecs || f.vols || f.punitions)
      .map(f => ({ p: f.p, echecs: f.echecs, vols: f.vols, punitions: f.punitions })),
    gardien: { p: eq.gardien, arrets: eq.arrets, alloues: eq.alloues },
  });
  return {
    A: fiche(m.A), B: fiche(m.B),
    gfA: m.A.buts, gfB: m.B.buts,
    prolongation: !!m.prolongation,
    nul: !!m.nul,
    vainqueur: m.vainqueur || null,
    fusillade: m.fusillade || null,
    fil: m.fil,
    graine: m.graine,
  };
}

/**
 * LE CHANGEMENT DE TRIO, juste après une mise au jeu. C'est le seul moment où
 * les cinq pièces sont à leur place de départ, donc le seul moment où on peut
 * en changer sans tordre le plateau — et c'est exactement le moment du vrai
 * hockey. C'est ici que le repêchage compte : quatre trios, trois paires, et
 * c'est toi qui décides qui saute contre qui.
 */
/*
 * LE CHANGEMENT EST INSTANTANÉ, SUR LE PLATEAU (S38). JP : *changement
 * instantané de ligne sur le board*. Il se faisait au banc, avant le premier
 * geste, et les cinq rentraient de leur bout de glace : on payait sa
 * position pour des jambes fraîches. Maintenant on change À N'IMPORTE QUEL
 * MOMENT de sa main, sans dépenser ni le déplacement ni l'action, une fois
 * par main, et chaque pièce qui entre prend la CASE de celle qui sort — le
 * changement à la volée. Une seule limite, et c'est celle du hockey : on ne
 * change pas l'unité qui porte la rondelle. Le prix, c'est que les entrants
 * ont le souffle du banc et rien d'autre : la vedette qui sort, elle, ne
 * revient qu'une fois reposée. Rend faux quand le changement est refusé.
 */
export function changerUnite(m, cote, tri, pai) {
  const eq = eqDe(m, cote);
  const roles = [...(tri !== eq.tri ? CASES_F : []), ...(pai !== eq.pai ? CASES_D : [])];
  if (!roles.length) return false;
  const p = porteur(m);
  if (p && p.eq === cote && roles.includes(p.role)) return false;
  if (m.main.change && m.tour === cote) return false;
  eq.tri = tri; eq.pai = pai;
  const unite = uniteDe(eq.roster, tri, pai);
  const prises = new Set(surLaGlace(m).map(x => `${x.r},${x.c}`));
  const neuves = [];
  const permis = rolesEnJeu(m);
  for (const { role, p: joueur } of unite) {
    if (eq.penalites.some(x => x.role === role)) continue;
    if (permis && !permis.includes(role)) continue;   // trois contre trois (S46)
    const ancien = eq.pieces.find(x => x.role === role);
    if (!roles.includes(role) && ancien) { neuves.push(ancien); continue; }
    if (ancien) prises.delete(`${ancien.r},${ancien.c}`);
    // Un rôle qui n'était pas sur la glace entre par sa place de la dernière
    // mise au jeu — il n'a pas de case d'où partir.
    const pt = m.pointMJ || MJ_CENTRE;
    const [dr, dc] = ECARTS[cote][role];
    const [r0, c0] = ancien ? [ancien.r, ancien.c]
      : [borne(pt.r + dr, RANG_MIN, RANG_MAX), borne(pt.c + dc, 0, COLS - 1)];
    const { r, c } = caseProche(prises, r0, c0);
    prises.add(`${r},${c}`);
    neuves.push(pieceNeuve(eq, role, joueur, r, c));
  }
  /*
   * L'ATTAQUANT SUPPLÉMENTAIRE SURVIT AU CHANGEMENT (S46). `changerUnite`
   * reconstruit les pièces depuis l'unité, et `X` n'est dans aucune unité :
   * changer de trio le filet désert l'EFFAÇAIT — l'équipe repassait à cinq
   * avec un but ouvert, et s'il portait la rondelle, elle disparaissait avec
   * lui. `check_regles` a dit les deux en vingt matchs.
   */
  const extra = eq.pieces.find(x => x.role === 'X');
  if (extra && eq.desert) neuves.push(extra);
  eq.pieces = neuves;
  // Le trio qui rentre peut contenir l'homme qui jouait le sixième : c'est
  // `normaliserEffectif` qui tranche, et lui seul — il garde le rôle, jette
  // le sixième, et en renvoie un autre.
  normaliserEffectif(m, eq);
  if (m.tour === cote) m.main.change = true;
  // Un des entrants peut se poser sur la rondelle libre : la même règle vaut
  // pour lui que pour celui qui patine dessus.
  for (const x of eq.pieces) if (deposer(m, x, x.r, x.c)) break;
  return true;
}

/* ======================================================================
   LES RÈGLES, ÉCRITES UNE SEULE FOIS
   ======================================================================
   JP : *faire que tout le déroulement du match arcade marche, genre, que
   tout soit logique, avec règles claires, complètes*.

   Un jeu de table dont on ne peut pas lire les règles pendant qu'on y joue
   n'est pas jouable. Elles vivent donc ICI, avec les constantes lues en
   direct — l'écran du plateau (`js/plateau.js`) et la page des règles du jeu
   (`js/game.js`) affichent toutes deux ce tableau-ci, et personne ne les
   recopie.

   C'est la leçon de la dérive : `CLAUDE.md` a longtemps annoncé « cinq
   présences par période » et « le patin vaut trois pas » alors que le code
   disait six et quatre, et deux paragraphes du même fichier portaient des
   mesures contradictoires. Une règle recopiée est une règle qui ment tôt ou
   tard. Celles-ci ne peuvent pas mentir : elles SONT le code.
   ====================================================================== */

export function reglesDuPlateau() {
  return [
    {
      titre: 'Le match',
      points: [
        `Trois périodes, et une période, c'est ${POSSESSIONS_PAR_PERIODE} possessions : elle finit au premier arrêt de jeu après que la rondelle a changé de camp ${POSSESSIONS_PAR_PERIODE} fois. Il n'y a pas d'horloge : le rythme, c'est le nombre de fois qu'on se l'enlève.`,
        `Une possession qui n'en finit pas ne bloque rien : après ${PRESENCES_PAR_PERIODE} tours, la période finit quoi qu'il arrive.`,
        `Égalité après trois périodes : prolongation de ${POSSESSIONS_PROLONGATION} possessions, mort subite — le premier but finit tout, et on recommence tant que personne ne marque.`,
        'Tu attaques toujours vers le haut, à toutes les périodes. Le plateau ne se retourne jamais.',
      ],
    },
    {
      titre: 'Un tour : ta main, la sienne',
      points: [
        POOL
          ? `À ta main, tu as UNE action et ${POOL} PAS à répartir sur qui tu veux — l'ailier fait trois pas vers le filet, le défenseur deux vers le porteur adverse, et le porteur passe. Chaque pièce patine au plus une fois par main, jamais plus loin que son propre PA. Dans l'ordre que tu veux. Puis la main passe à l'adversaire ; quand il a joué la sienne, le tour est fini et tout le monde souffle.`
          : 'À ta main, UNE pièce PATINE (aussi loin que son PA le permet, jamais plus), UNE pièce AGIT — pas forcément la même — et une pièce qui n\'a PAS la rondelle peut se PLACER : c\'est un deuxième déplacement, et le seul geste de la main qui ne peut pas toucher la rondelle. Dans l\'ordre que tu veux. Puis la main passe à l\'adversaire ; quand il a joué la sienne, le tour est fini et tout le monde souffle.',
        'TA MAIN FINIT DE TROIS FAÇONS : tu la passes (« Passer la main »), il ne te reste plus rien à dépenser, ou un jet raté avec la rondelle te la coûte — c\'est le revirement. Puis c\'est la sienne, avec le même budget, et tu la regardes geste par geste ; la barre du bas dit pourquoi ta main a fini.',
        'LE PLACEMENT ne fait pas avancer la rondelle — c\'est le seul geste de la main qui ne peut pas la toucher — il te laisse DÉPLOYER ton équipe : aller au filet, ouvrir une ligne de passe, rentrer couvrir. Sans lui, le patin et l\'action partaient tous les deux sur le porteur, qui montait seul pendant que ses quatre coéquipiers regardaient depuis la case où la mise au jeu les avait posés.',
        'CE QUI BORNE UNE PIÈCE, C\'EST ELLE : sa VITESSE dit jusqu\'où elle patine (son PA en pas, écrit sur le bouton), son SOUFFLE dit combien de gestes elle a encore. Deux quantités qui lui appartiennent — il n\'y a pas de troisième budget par-dessus.',
        'La même pièce peut jouer à CHAQUE tour. Ce qui la freine, c\'est son souffle : chaque geste lui en coûte un point, et à mesure qu\'il baisse elle patine moins loin, puis moins bien (voir plus bas).',
        'LE REVIREMENT : un jet raté qui te coûte la rondelle rend la main sur-le-champ. Mais la rondelle ne CHANGE PAS de camp pour autant : une esquive ratée, une feinte lue, elle tombe LIBRE là où tu l\'as échappée, et c\'est celui qui a des corps autour qui la ramasse.',
        'QUI PREND LA RONDELLE REPART AVEC, toujours — qu\'il l\'ait volée, arrachée par une mise en échec, ou simplement ramassée par terre. Son déplacement lui est rendu. Un changement de possession DÉPLACE la rondelle, il ne la fige pas là où elle vient de changer de mains.',
        'Les mains alternent strictement : le camp qui vient de jouer ne rejoue jamais tout de suite. « Passer la main » rend la main sans dépenser ce qui reste.',
      ],
    },
    {
      titre: 'La pression',
      points: [
        'Chaque patineur debout COUVRE les cases à une de lui — à DEUX quand sa défense vaut 5 ou plus. C\'est son rayon, et c\'est sa posture : il n\'a rien à déclarer, il est là.',
        'LA PRESSION sur une case, c\'est le nombre de rayons adverses qui la couvrent, et le meilleur DE d\'entre eux. Elle est écrite sur la carte du porteur, toujours.',
        'Elle entre dans les duels du porteur, des deux bords : quand il passe ou feinte, c\'est ce DE-là qu\'il affronte, et chaque bâton de plus lui retire un (deux au plus) ; quand on le frappe ou le harponne, le même malus joue contre lui. Un bâton, une chance ; deux bâtons, une chance de moins.',
        'Avec la rondelle, entrer dans une case couverte coûte deux pas au lieu d\'un : on contourne un vrai défenseur, on ne le traverse pas.',
        'MAIS UN RAYON NE PREND PAS LA RONDELLE À DISTANCE. Patiner ne demande d\'ESQUIVER que si un adversaire est COLLÉ à toi — à une case — au départ ou à l\'arrivée. Un défenseur à deux cases te coûte des pas, jamais la rondelle : le rayon coûte du temps, le bâton collé coûte la rondelle. Une case verte sans cote en bas à droite est une case où rien ne peut mal tourner.',
        `UNE DIAGONALE COÛTE ${COUT_DIAG === 3 && DEMI === 2 ? 'UN PAS ET DEMI' : `${COUT_DIAG / DEMI} PAS`}, un pas droit en coûte un. On file donc plus loin tout droit qu'en biais, et l\'éventail des cases où l\'on peut aller est un losange, pas un carré : on ne traverse plus la glace de travers pour le prix d'une ligne droite.`,
        'Devant le filet, seul compte ce qui est ENTRE le tireur et le but : un adversaire collé du côté du filet gêne le tir (−1, −2 pour un vrai bloqueur) ; celui qui est dans son dos ne bloque rien.',
      ],
    },
    {
      titre: 'Le positionnement',
      points: [
        'Chaque joueur a un POSTE, et il se déduit de deux choses : son rôle et où est la rondelle. En attaque, les avants passent DEVANT elle et les défenseurs tiennent la pointe DERRIÈRE ; en défense, les défenseurs se placent ENTRE elle et leur filet, et les avants couvrent au-dessus. Un AG et un DG tiennent la gauche, un AD et un DD la droite, le centre le milieu.',
        'DANS SA ZONE, c\'est le REPLI : les deux défenseurs collapsent devant leur filet, côte à côte, et les avants couvrent la pointe. C\'est pour ça qu\'une rondelle volée ne devient pas un but — il y a du monde à la maison.',
        'DEUX joueurs vont à la rondelle, pas cinq. Les trois autres tiennent leur poste : une équipe qui converge sur la rondelle n\'a plus de forme, et la glace derrière elle est vide.',
        'C\'EST DE LÀ QUE VIENT LE RISQUE. Les deux défenseurs rentrés, une attaque est un trois contre deux plus le gardien : pour te créer mieux, il faut MONTER un défenseur — et la pointe qu\'il laisse est exactement le contre que l\'autre attend. Le jeu ne te l\'interdit pas, il te le fait payer.',
      ],
    },
    {
      titre: 'Le dé',
      points: [
        'UN DÉ CHACUN, PLUS SA STAT. Celui qui agit lance un d6 et ajoute sa stat ; celui qui subit lance le sien et ajoute la sienne. Le plus haut l\'emporte, l\'égalité va à celui qui A LA RONDELLE — sauf au tir, où elle revient au gardien : c\'est le seul duel où le défenseur est un spécialiste. Quand personne ne s\'oppose (une passe que rien ne couvre, une rondelle au fond), on bat une difficulté fixe. Entre deux joueurs égaux, 42 % ; +1 de stat, 58 % ; +2, 67 % ; −1, 33 %.',
        'Un 6 naturel gagne toujours, un 1 naturel perd toujours — pour les deux dés. Deux 6 (ou deux 1) se départagent au total. Rien n\'est jamais sûr ni jamais perdu : tout reste entre 25 et 75 %, quel que soit l\'écart de talent.',
        'Chaque option affiche ses chances AVANT que tu t\'engages, et le duel qui les fait (« TI 4 contre AR 5 ») : la case où patiner, le coéquipier visé, l\'adversaire à frapper, le bouton de tir.',
        'LA RELANCE D\'ÉQUIPE : une par période, dépensée après avoir vu les dés — on relance le SIEN, celui de l\'adversaire reste sur la table.',
      ],
    },
    {
      titre: 'Les six gestes',
      colonnes: ['geste', 'duel', 'ce que ça fait', 'un échec coûte'],
      rangees: [
        ['Patiner', 'MA c. DE', `autant de cases que son PA (trois au moins, ${PAS_MAX} au plus), en contournant les pièces ; ${POOL ? `ça se prend dans les ${POOL} pas de la main` : 'c\'est LE patin de la main'}, et le prix de chaque case est écrit dessus — la LIGNE montre par où elle passera. Sans la rondelle, c'est libre. Avec, quitter ou rejoindre une case où un adversaire est COLLÉ demande d'ESQUIVER : ton maniement, +1 d'élan, +1 au petit gabarit, moins les bâtons de trop, contre le meilleur de ceux qui te touchent`, 'revirement : tu échappes la rondelle, elle est libre sur place'],
        ['Passer', 'MA c. DE', 'à un coéquipier : +1 à trois cases, −1 à sept, −2 à dix, +1 au gabarit moyen, +1 de derrière le filet vers l\'enclave, −1 vers un receveur maladroit (MA 1-2), moins la pression sur toi — contre le meilleur bâton qui couvre la ligne ou le receveur (−1, un bâton sur une ligne n\'est pas sur la rondelle), +1 par bâton de plus ; rien sur la ligne, difficulté 3. Après une passe RÉUSSIE, le receveur peut TIRER SUR RÉCEPTION dans la même main. AU FOND, de la zone neutre : dans un coin ou derrière le filet, la rondelle y est LIBRE — c\'est le dump-and-chase, et ça ouvre la zone', 'revirement : le bâton sur la ligne l\'intercepte (au fond : elle rebondit, libre)'],
        ['Tirer', 'TI c. AR', `de la zone offensive seulement, à ${PORTEE_TIR} cases du filet ou moins : ton TI, ta signature, moins les bâtons devant toi, contre son AR plus la PLACE — rien collé au filet, +${PLACE_GARDIEN.rangee2} à la deuxième rangée de l'enclave, +${PLACE_GARDIEN.pointe} de la pointe et des coins, +${PLACE_GARDIEN.tour} sur un tour du filet`, 'le gardien la GÈLE : sifflet et mise au jeu en fond de zone — sauf de l\'enclave, ou raté d\'un rien, ou mal contrôlé (son AR contre 5+) : la rondelle rebondit SUR LUI et reste libre devant son filet, et le jeu continue'],
        ['Feinter', 'MA c. DE', 'le porteur prend UN défenseur collé en un contre un : son maniement (+1 au petit gabarit), moins la pression, contre la défense de l\'autre. Battu, le défenseur est hors position jusqu\'à la fin du tour et le porteur repart sans esquive', 'revirement : il lit la feinte, la rondelle est libre sur place'],
        ['Frapper', 'FO c. FO', 'force contre force sur n\'importe quel adversaire collé : il tombe et recule d\'une case. Sur le porteur, la pression joue contre lui, et sur la bande il perd un de plus — c\'est là qu\'on le coince ; tu repars avec la rondelle. Pas avec la rondelle, pas vidé. Un frappeur reconnu a +1', 'hors position jusqu\'à la fin du tour (le matador reste debout) ; sur un 1, l\'arbitre regarde'],
        ['Harponner', 'DE c. MA', 'sur le porteur collé à toi : ta défense contre son maniement, la pression contre lui, et tu prends la rondelle sans le toucher. Un voleur reconnu a +1', 'hors position jusqu\'à la fin du tour ; sur un 1, l\'arbitre regarde'],
        ['Bataille', 'FO c. FO', 'patiner sur une rondelle libre qu\'un adversaire debout touche : force contre le plus fort d\'eux. Gagnée, elle est à toi', 'elle ricoche à côté, libre encore'],
      ],
    },
    {
      titre: 'La rondelle et le hors-jeu',
      points: [
        'Qui met le pied sur une rondelle libre la prend : sans dé, sans dépenser son geste. Une pièce au sol, elle, ne ramasse rien. Une rondelle libre n\'est à personne : la possession ne change que quand l\'autre équipe la ramasse.',
        `LE HORS-JEU SE SIFFLE. Tu PEUX devancer la rondelle : une pièce qui est en zone offensive (à ${PORTEE_TIR} cases du filet ou moins) pendant que la rondelle est dehors porte un fanion ⚑. Mais si la rondelle entre alors qu'elle y est encore — portée, passée ou envoyée au fond — c'est HORS-JEU : sifflet, et mise au jeu au point neutre de ce bord. Le porteur, lui, n'est jamais hors-jeu : il apporte la rondelle. Recevoir une passe en étant déjà dans la zone, si.`,
        'Derrière le filet on ne tire pas, on passe ; des deux cases collées au filet sur la ligne des buts, on tente le tour du filet.',
        'Quand le gardien a la rondelle EN JEU, il la relance à sa pièce la PLUS AVANCÉE au début de la main : c\'est la sortie de zone.',
      ],
    },
    {
      titre: 'Une pièce',
      points: [
        'PA patin, MA maniement, TI tir, FO force, DE défense, SO souffle — de 1 à 6, tirés de ce que le joueur a vraiment fait dans sa saison. Chacun sert des deux bords : le patin fait le pas, le maniement passe, esquive et feinte, la force frappe et tient, la défense couvre et harponne, le souffle dit combien de gestes il tient.',
        `Le GABARIT : ${GABARITS[GABARIT_PETIT].icon} petit et rapide (+1 patin, +1 esquive et feinte, −1 force, −1 souffle, et il reste au sol un tour de plus), ${GABARITS[GABARIT_MOYEN].icon} moyen (+1 souffle, +1 passe, aucune faiblesse), ${GABARITS[GABARIT_MATADOR].icon} matador (+1 force, un contact raté ne le met pas hors position, −1 patin).`,
        `Le TIR SIGNATURE, et chacun a son contexte : ${Object.values(TIRS).map(t => `${t.icon} ${t.nom.toLowerCase()} (${t.desc.replace(/\.$/, '')})`).join(' · ')}.`,
        'L\'HABILETÉ, tirée de son archétype : +2 sur un type de geste, une fois par période.',
        'LES TRAITS du repêchage valent +1 sur un nombre, jamais plus d\'un par nombre : ⚡ Vitesse au patin, 💣 Lancer au tir, 🪄 Créateur au maniement, 🛡️ Selke, 🧱 Norris et 🔁 Bidirectionnel à la défense, 🥊 Colosse à la force, 🥅 Vezina et 🧤 Voleur au gardien. 🧭 Meneur et 🏆 Conn Smythe ne rendent qu\'en prolongation et en séries : le plateau n\'a pas ces canaux-là.',
      ],
    },
    {
      titre: 'Le souffle et le changement',
      points: [
        'Le réservoir d\'une pièce vaut deux fois son SO. Chaque geste — patiner ou agir — en coûte un point ; au banc, on en reprend un par tour.',
        'Sous la moitié, la pièce est FATIGUÉE : une case de patin en moins. À zéro, elle est VIDÉE : deux cases en moins, un de moins à tous ses jets, et plus de mise en échec — il lui reste le bâton.',
        'LE CHANGEMENT EST INSTANTANÉ : à n\'importe quel moment de ta main, une fois par main, sans dépenser ni le déplacement ni l\'action. Chaque pièce qui entre prend la case de celle qui sort. Une seule limite : on ne change pas l\'unité qui porte la rondelle. C\'est pour ça que tu as quatre trios et trois paires.',
      ],
    },
    {
      titre: 'Les arrêts de jeu',
      points: [
        `LE PLATEAU A NEUF POINTS DE MISE AU JEU, et chaque sifflet a le sien : le centre, quatre en fond de zone, quatre au neutre. Les cinq pièces de chaque camp se reposent AUTOUR du point — le centre au point, les ailiers sur ses flancs, les défenseurs derrière — donc une mise au jeu en fond de zone se joue dans cette zone-là, pas au centre.`,
        'LA MISE AU JEU se gagne des mains et du corps : le maniement et la force des deux centres, plus un dé chacun. Un bon centre ravoir la rondelle dans sa propre zone, c\'est ce qui sauve un désavantage numérique.',
        'CINQ CHOSES ARRÊTENT LE JEU. Un BUT : mise au jeu au centre. La FIN DE PÉRIODE : au centre. Le GARDIEN QUI GÈLE la rondelle : en fond de la zone où c\'est arrivé. Une PUNITION : en fond de la zone de l\'équipe punie — l\'avantage numérique commence donc là où il vaut quelque chose. Un HORS-JEU : au point neutre de ce bord.',
        'Tout le reste continue : une rondelle libre n\'arrête rien, un revirement n\'arrête rien, un retour de tir n\'arrête rien. On ne siffle que ce qu\'un arbitre sifflerait.',
      ],
    },
    {
      titre: 'La fin du match',
      points: [
        `À ÉGALITÉ, UNE PROLONGATION À TROIS CONTRE TROIS : un centre, un ailier, un défenseur de chaque côté, ${POSSESSIONS_PROLONGATION} possessions, mort subite. La glace se vide, et c'est ce qui la rend différente du reste du match plutôt qu'un rallongement.`,
        'TOUJOURS À ÉGALITÉ, LES TIRS DE BARRAGE : trois tireurs chacun, puis un pour un jusqu\'à ce que l\'un marque et l\'autre non. Seul endroit du jeu où un joueur affronte le gardien sans personne autour — son TI contre l\'AR, un dé chacun, ni place ni bâtons. Les tireurs sont les meilleurs TI de l\'alignement, dans l\'ordre.',
        `LE FILET DÉSERT : mené d'un ou deux buts dans les ${DESERT_POSSESSIONS} dernières possessions de la troisième, on peut retirer son gardien pour un SIXIÈME patineur, pris dans un autre trio. Un tir dans un but vide n'affronte plus personne — il n'y a plus de dé en face, juste la distance.`,
        `ET DANS UN BUT VIDE, ON TIRE DE PARTOUT : la portée de ${PORTEE_TIR} cases ne s'applique plus, un dégagement du fond de sa propre zone peut trouver le filet. Plus c'est loin, plus c'est dur — mais c'est possible, et c'est exactement ce que risque l'équipe qui a retiré son gardien.`,
        'Le gardien revient à la mise au jeu suivante : on ne rejoue pas à six après un but ni après un sifflet, on redécide.',
      ],
    },
    {
      titre: 'Les punitions',
      points: [
        `Un contact qui sort sur un 1 passe devant l'arbitre : deux fois sur trois, c'est une mineure. Le coupable va au cachot pour ${PUNITION_TOURS} tours et son équipe joue à QUATRE patineurs — un rayon de moins à traverser.`,
        `DEUX PUNITIONS À LA FOIS, PAS PLUS : c'est le CINQ CONTRE TROIS, et une équipe ne descend jamais sous trois patineurs. Marquer contre une équipe à deux punis n'en libère qu'UN — on revient à cinq contre quatre, pas à égalité.`,
        'Le rôle reste vide même si on change de trio : c\'est l\'équipe qui est punie. Un but marqué en avantage numérique libère le puni ; sinon, il revient à sa place de départ quand ses tours sont faits. Une seule punition à la fois par équipe.',
      ],
    },
    {
      titre: 'Le tournoi',
      points: [
        'Six clubs, cinq matchs, tout le monde une fois. Les quatre premiers passent en séries : demi-finale et finale, à match unique.',
        'Les matchs que tu ne joues pas se règlent avec exactement les mêmes règles — le classement veut donc dire quelque chose.',
        'Les matchs de séries n\'entrent pas au classement de la saison. Fermer un match ou le tournoi, c\'est laisser jouer le reste : on ne se sauve pas d\'une défaite.',
      ],
    },
  ];
}
