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
 *   Ici c'est quatre présences par équipe par période, douze par match, et le
 *   match finit quand les tours sont épuisés. C'est ce qui garantit qu'un
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

/* ======================================================================
   LE PLATEAU
   ======================================================================
   Sept colonnes, onze rangées. Les rangées 0 et 10 sont les filets : seuls
   les gardiens y vont. Les patineurs vivent sur les neuf rangées du milieu,
   soit 63 cases — assez pour que la position compte, assez peu pour que tout
   se voie d'un coup sur un téléphone de 390 px.

     r0    filet adverse           (gardien adverse)
     r1-2  l'enclave adverse       +2 au tir
     r3    la ligne bleue adverse  la pointe
     r4    la ligne rouge          le cercle de mise au jeu
     r5    ta ligne bleue
     r6-7  ton territoire
     r8    ton filet               (ton gardien)

   Neuf rangées et non onze : à trois pas de patin sur une glace de onze,
   une équipe passait son match à traverser la zone neutre, et le score
   tombait sous deux buts (`check_table.mjs`). Sept rangées de patineurs,
   c'est une rondelle qui circule.

   Tu attaques TOUJOURS vers le haut. Le plateau ne se retourne jamais : à
   la troisième période on ne veut pas se demander de quel bord on joue.
   ====================================================================== */

export const COLS = 7;
export const RANGS = 9;
export const FILET_HAUT = 0;
export const FILET_BAS = RANGS - 1;
export const BUT_COL = 3;                     // le centre du filet
export const RANG_MIN = 1, RANG_MAX = RANGS - 2;   // là où les patineurs vont

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
 */
export const PORTEE_TIR = 3;

/** Le filet qu'une équipe attaque : 'A' monte, 'B' descend. */
export const filetDe = cote => (cote === 'A' ? FILET_HAUT : FILET_BAS);

/** « 1re », « 2e » : l'ordinal féminin d'une période. */
export const ordP = n => (n === 1 ? '1re' : `${n}e`);

/** La distance d'une pièce au filet qu'elle attaque. */
export const distanceAuFilet = (m, piece) => Math.abs(piece.r - eqDe(m, piece.eq).but);

/** Peut-elle tirer d'où elle est ? Seulement depuis la zone offensive. */
export const peutTirer = (m, piece) => !piece.gardien && distanceAuFilet(m, piece) <= PORTEE_TIR;

/** La nature d'une case, du point de vue de l'équipe qui attaque vers `but`. */
export function natureCase(r, c, but) {
  const d = Math.abs(r - but);
  if (d === 0) return 'filet';
  if (d <= 2) return c >= 1 && c <= 5 ? 'enclave' : 'coin';
  if (d === 3) return 'pointe';
  if (d <= 5) return 'neutre';
  return 'repli';
}

const dansLaGlace = (r, c) => r >= RANG_MIN && r <= RANG_MAX && c >= 0 && c < COLS;
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
    return { PA: 2, MA: 3, TI: 1, FO: 3, SO: 9, AR: surSix(8 - 4.2 * facteurGardienDe(p)), gb: gabaritDe(p), ts: 'P' };
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
  let PA = 4;
  if (traits.has('VITESSE')) PA++;
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
    MA: surSix(1.4 + 2.2 * pas),
    TI: surSix(0.9 + 2.6 * vol * fin),
    FO: surSix(1.5 + 4.0 * robu(p)) + (g === GABARIT_MATADOR ? 1 : g === GABARIT_PETIT ? -1 : 0),
    SO: borne(Math.round(1.4 + 3.1 * (usure - 30) / 45) + (g === GABARIT_MOYEN ? 1 : g === GABARIT_PETIT ? -1 : 0), 2, 6),
    AR: 3,
    gb: g,
    ts: TIRS[p.ts] ? p.ts : tirParDefaut(p),
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

export const TIRS = {
  P: { nom: 'Tir du poignet', icon: '🎯', desc: 'Bon partout, mauvais nulle part.', mod: () => 0 },
  F: { nom: 'Tir frappé', icon: '💣', desc: '+1 de loin (la pointe), −1 collé au filet.',
       mod: c => (c.loin >= 3 ? 1 : c.loin <= 1 ? -1 : 0) },
  E: { nom: 'Tir sur réception', icon: '⚡', desc: '+2 s\'il vient de recevoir la passe : le une-deux.',
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

export const SEUIL = 4;          // un geste ordinaire : une fois sur deux
/*
 * LE SEUIL DU TIR, ET C'EST UN CHOIX DE GENRE, PAS DE SIMULATION.
 *
 * JP : *faut pas faire comme la vraie NHL, c'est un mode arcade, oui avec
 * stratégie et deepness, mais pas genre vraie hockey*.
 *
 * À 5+, un but se méritait et le plateau rendait 2 buts par équipe par
 * match : du hockey crédible, et un jeu de table plate. Le moteur par
 * événements (js/sim.js) est là pour la crédibilité — il tient les 55
 * saisons, les égalités de la feuille et la monotonie sur dix déciles. Le
 * plateau, lui, est un jeu d'arcade : on veut des pointages de borne, des
 * remontées, et qu'une présence finisse sur une rondelle au fond du filet
 * plutôt que sur un dégagement. Le tir se joue donc au même seuil que tout
 * le reste, et c'est la POSITION qui décide — l'enclave, l'angle, les
 * bâtons, le tir signature.
 */
export const SEUIL_TIR = 4;
export const MOD_MAX = 2, MOD_MIN = -2;   // un geste n'est jamais sûr ni jamais perdu

/*
 * DE LA COTE AU MODIFICATEUR : deux crans, pas cinq.
 *
 * Un nombre de 1 à 6 valait `nombre − 3` au jet, donc l'écart du pire au
 * meilleur faisait cinq points sur un d6 — et mesuré (`check_table.mjs`), le
 * premier décile battait le dixième CENT fois sur cent, à +3,7 buts par
 * match. Ce n'est pas du hockey : dans la vraie ligue la pire équipe bat la
 * meilleure une fois sur trois. Chaque nombre ne vaut donc plus que
 * −2 à +2, et il faut deux crans de talent pour gagner un point de dé. Le
 * talent se voit encore — il ne décide simplement plus tout seul.
 */
export const md = stat => Math.round((stat - 3.5) / 1.8);

/*
 * LE 6 RÉUSSIT TOUJOURS, LE 1 ÉCHOUE TOUJOURS. C'est la règle de Blood Bowl,
 * et elle n'est pas cosmétique : sans elle, un tireur ordinaire devant un bon
 * gardien avait un modificateur de −2 contre un seuil de 5, donc il lui
 * fallait un 7 sur un d6 — impossible. Mesuré (`check_table.mjs`), le dixième
 * décile marquait 0,04 but par match contre le premier, et perdait 99 fois
 * sur 100. Avec le 6 qui passe et le 1 qui casse, rien n'est jamais sûr ni
 * jamais perdu : c'est ce qui fait qu'on regarde le dé rouler.
 */
export const chances = (mod, seuil = SEUIL) => {
  const mo = borne(mod, MOD_MIN, MOD_MAX);
  let n = 1;                                          // le 6
  for (let de = 2; de <= 5; de++) if (de + mo >= seuil) n++;
  return n / 6;                                       // le 1 ne compte jamais
};

/** Le dé tranche : 6 passe, 1 casse, le reste se compare au seuil. */
const passe = (de, mod, seuil) => de === 6 || (de !== 1 && de + mod >= seuil);

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
export const PRESENCES_PAR_PERIODE = 6;
export const PRESENCES_PROLONGATION = 2;   // la mort subite est courte, sinon on n'en sort plus
export const PROLONGATIONS_MAX = 12;       // au-delà, le bris d'égalité écrit (gagnantDuMatch)

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

/* Les places de départ d'une mise au jeu au centre. Symétriques, jamais en
 * conflit, et chaque pièce dans son couloir : l'ailier gauche à gauche. */
const DEPART = {
  A: { AG: [5, 1], C: [5, 3], AD: [5, 5], DG: [7, 2], DD: [7, 4] },
  B: { AG: [3, 5], C: [3, 3], AD: [3, 1], DG: [1, 4], DD: [1, 2] },
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
    // Le modificateur BRUT de chaque tir tenté, avant que la borne l'écrase :
    // c'est la seule façon de voir si le plateau offre des occasions ou si
    // tout le monde tire du fond de la patinoire (`check_table.mjs`).
    modsTir: [],
    pieces: [],
    but: filetDe(cote),
  };
}

/** La ligne de fiche d'un joueur dans son équipe, créée au besoin. */
function fiche(eq, joueur) {
  let f = eq.fiches.get(joueur);
  if (!f) { f = { p: joueur, buts: 0, passes: 0, tirs: 0, echecs: 0, vols: 0 }; eq.fiches.set(joueur, f); }
  return f;
}

/**
 * La case libre la plus proche d'une case voulue, en spirale. Sert au
 * changement de trio : les cinq entrent par TON bout de glace, mais
 * l'adversaire est peut-être déjà campé là.
 */
function caseProche(prises, r0, c0) {
  for (let rayon = 0; rayon <= 8; rayon++) {
    for (let dr = -rayon; dr <= rayon; dr++) for (let dc = -rayon; dc <= rayon; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== rayon) continue;
      const r = r0 + dr, c = c0 + dc;
      if (r < RANG_MIN || r > RANG_MAX || c < 0 || c >= COLS) continue;
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
function poser(eq, m = null) {
  const unite = uniteDe(eq.roster, eq.tri, eq.pai);
  const prises = new Set();
  if (m) {
    const autre = eq.cote === 'A' ? m.B : m.A;
    for (const x of autre.pieces || []) prises.add(`${x.r},${x.c}`);
  }
  eq.pieces = unite.map(({ role, p }) => {
    const [r0, c0] = DEPART[eq.cote][role];
    const { r, c } = caseProche(prises, r0, c0);
    prises.add(`${r},${c}`);
    const st = statsDeTable(p);
    if (p && !eq.souffle.has(p)) eq.souffle.set(p, st.SO);
    return {
      role, p, eq: eq.cote, r, c, st,
      hab: habileteDe(p),
      habDispo: true,      // une fois par période
      etourdi: 0,          // présences où la pièce ne peut pas agir
      agi: false,          // a déjà fait son geste cette présence-ci
      deplace: false,      // a déjà patiné cette présence-ci
      ecran: 0,            // présences où il se place devant les tirs
      buts: 0, passes: 0, tirs: 0,
    };
  });
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
    presence: 1,           // 1 à PRESENCES_PAR_PERIODE × 2, alternées
    tour: 'A',
    rondelle: null,        // { piece } ou { libre: {r, c} }
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

/** Le souffle restant d'une pièce. */
export const souffleDe = (m, piece) => {
  if (!piece || !piece.p) return piece?.st?.SO ?? 3;
  const eq = eqDe(m, piece.eq);
  const v = eq.souffle.get(piece.p);
  return v === undefined ? piece.st.SO : v;
};

/** Essoufflée : plus de souffle du tout. Un de moins à tous ses jets. */
export const essouffle = (m, piece) => souffleDe(m, piece) <= 0;
const malusSouffle = (m, piece) => (essouffle(m, piece) ? -1 : 0);

/** Les pas de patin d'une pièce, essoufflement compris. */
export const pasDe = (m, piece) => Math.max(1, piece.st.PA - (essouffle(m, piece) ? 1 : 0));

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
  const glace = new Set(eq.pieces.map(x => x.p).filter(Boolean));
  for (const x of eq.pieces) {
    if (!x.p) continue;
    eq.souffle.set(x.p, Math.max(0, (eq.souffle.get(x.p) ?? x.st.SO) - 1));
  }
  for (const p of tousLesPatineurs(eq.roster)) {
    if (glace.has(p)) continue;
    const max = statsDeTable(p).SO;
    eq.souffle.set(p, Math.min(max, (eq.souffle.get(p) ?? max) + 1));
  }
}

/** Les bâtons adverses qui contrôlent cette case : le « tackle zone ». */
export function batons(m, cote, r, c) {
  return surLaGlace(m).filter(x => x.eq !== cote && !x.etourdi && dist(x, { r, c }) === 1).length;
}

/**
 * Les bâtons qui gênent un TIR depuis cette case. Une pièce qui s'est placée
 * devant (l'écran) compte double, ou triple quand elle bloque vraiment des
 * tirs dans la vraie vie — `bl`, les tirs bloqués par match, que
 * `skater/realtime` donne depuis 2005-06. Avant, c'est la mesure défensive
 * `md` qui répond : l'action existe pour les 55 saisons, c'est l'aptitude
 * qui vient de la colonne quand la colonne existe.
 */
export function ecranVaut(p) {
  if (!p) return 2;
  if (typeof p.bl === 'number') return p.bl >= 1.4 ? 3 : 2;
  return (p.md ?? 0) >= 0.80 ? 3 : 2;
}

/*
 * UN BÂTON NE GÊNE UN TIR QUE S'IL EST ENTRE LE TIREUR ET LE FILET.
 *
 * N'importe quel adversaire collé au tireur gênait son tir, y compris celui
 * qui était DERRIÈRE lui — un défenseur dans son dos bloquait la rondelle,
 * ce qui n'a aucun sens. Et ça faisait de l'enclave le pire endroit d'où
 * tirer : devant le filet on est entouré (2,3 bâtons en moyenne mesurés),
 * donc le tir de l'enclave partait à −2,3 pendant qu'un tir du centre de la
 * glace, où il n'y a personne, partait à zéro. Compter seulement ce qui est
 * du côté du filet rend au net-front ce qu'il doit être : l'endroit où on
 * marque, pas l'endroit où on se fait étouffer.
 */
export function batonsTir(m, cote, r, c) {
  const but = eqDe(m, cote).but;
  const moi = Math.abs(r - but);
  let n = 0;
  for (const x of surLaGlace(m)) {
    if (x.eq === cote || x.etourdi || dist(x, { r, c }) !== 1) continue;
    if (Math.abs(x.r - but) > moi) continue;      // il est derrière le tireur
    n += x.ecran ? ecranVaut(x.p) : 1;
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

/* ---------- la mise au jeu ---------- */

function miseAuJeu(m, mot) {
  poser(m.A); poser(m.B);
  const cA = m.A.pieces.find(x => x.role === 'C');
  const cB = m.B.pieces.find(x => x.role === 'C');
  const jA = Math.floor(m.de() * 6) + 1 + md(cA.st.MA);
  const jB = Math.floor(m.de() * 6) + 1 + md(cB.st.MA);
  const gagnant = jA === jB ? (m.tour === 'A' ? cA : cB) : (jA > jB ? cA : cB);
  m.rondelle = { piece: gagnant };
  dire(m, `${mot} — ${nomDe(gagnant)} gagne la mise au jeu.`, 'mj');
}

export const nomDe = piece => (piece && piece.p && piece.p.n) || 'Rappel';

/* ======================================================================
   LES GESTES
   ======================================================================
   Cinq, pas un de plus. Chacun est un jet de d6 contre SEUIL avec un
   modificateur lisible, et chacun dit ce qu'un échec coûte. Un geste raté
   qui cause un revirement termine la présence : c'est tout le jeu.
   ====================================================================== */

/** Le modificateur d'une esquive : quitter une case tenue par des bâtons adverses. */
export function modEsquive(m, piece, vers) {
  // Le matador protège la rondelle : un bâton adverse de moins sur lui.
  const tenue = Math.max(0, batons(m, piece.eq, piece.r, piece.c) - (piece.st.gb === GABARIT_MATADOR ? 1 : 0));
  const petit = piece.st.gb === GABARIT_PETIT ? 1 : 0;
  return md(piece.st.MA) + petit + malusSouffle(m, piece)
    - Math.max(0, tenue - 1) - (batons(m, piece.eq, vers.r, vers.c) > 0 ? 1 : 0);
}

/** Le modificateur d'une passe : la distance, et les bâtons autour du receveur. */
export function modPasse(m, piece, cible) {
  const d = dist(piece, cible);
  // ARCADE : la passe est le geste qui fait le jeu, elle doit rester vivante.
  const loin = d <= 4 ? 0 : d <= 6 ? -1 : -2;
  const moyen = piece.st.gb === GABARIT_MOYEN ? 1 : 0;
  return md(piece.st.MA) + loin + moyen + malusSouffle(m, piece) - batons(m, piece.eq, cible.r, cible.c);
}

/** Le modificateur d'un tir : la finition contre le gardien, la distance, l'enclave, la couverture. */
export function modTir(m, piece) {
  const eq = eqDe(m, piece.eq);
  const g = eqDe(m, adverse(piece.eq)).piece_g;
  const d = Math.abs(piece.r - eq.but);
  // ARCADE : la distance pèse, mais elle ne ferme jamais le jeu. À −3 du fond
  // de la patinoire, personne ne tentait rien d'autre que d'avancer.
  const loin = d <= 2 ? 0 : d <= 4 ? -1 : -2;
  const nature = natureCase(piece.r, piece.c, eq.but);
  const place = nature === 'enclave' ? 2 : nature === 'coin' ? -1 : 0;
  // L'angle : tirer d'une bande, c'est tirer dans le côté court.
  const angle = Math.abs(piece.c - BUT_COL) >= 3 ? -1 : 0;
  const gene = batonsTir(m, piece.eq, piece.r, piece.c);
  // LE TIR SIGNATURE : chacun a un contexte où il vaut mieux que les autres.
  // `recu` dit qu'il vient de recevoir la passe — c'est le une-deux.
  const tir = TIRS[piece.st.ts] || TIRS.P;
  const signature = tir.mod({ loin: d, enclave: nature === 'enclave', batons: gene, recu: !!piece.derniere });
  return md(piece.st.TI) - md(g.st.AR) + loin + place + angle + signature + malusSouffle(m, piece) - gene;
}

/** Le modificateur d'une mise en échec : la force contre la force. */
/*
 * LA PROTECTION DU PORTEUR. Celui qui a la rondelle la protège : un de plus
 * à qui doit la lui enlever, par l'épaule comme par le bâton.
 *
 * Sans elle, cinq défenseurs pouvaient chacun tenter une mise en échec OU un
 * vol contre le même porteur, chacun à la moitié — la rondelle changeait de
 * camp presque à toutes les présences. Mesuré : six revirements par équipe
 * par match, deux virgule six tirs seulement, et les buts tombés de 2,7 à
 * 1,6 alors que la QUALITÉ des tirs tentés était bonne (+0,78 de
 * modificateur moyen). Ce n'était pas les tirs qui étaient mauvais, c'est
 * qu'on n'en arrivait plus là.
 */
export const PROTECTION_PORTEUR = 1;

export function modEchec(m, piece, cible) {
  const porte = porteur(m) === cible ? PROTECTION_PORTEUR : 0;
  return md(piece.st.FO) - md(cible.st.FO) - porte + (bonFrappeur(piece.p) ? 1 : 0) + malusSouffle(m, piece);
}

/**
 * LE VOL DE RONDELLE : la route du bâton, à côté de celle de l'épaule.
 * Maniement contre maniement — un joueur habile enlève la rondelle à un
 * costaud sans le toucher. Pas de mise au sol, pas de poussée : juste la
 * rondelle. C'est le geste du Selke, et c'est ce qui donne un deuxième
 * chemin défensif à qui ne frappe pas.
 */
export function modVol(m, piece, cible) {
  return md(piece.st.MA) - md(cible.st.MA) - PROTECTION_PORTEUR
    + (bonVoleur(piece.p) ? 1 : 0) + malusSouffle(m, piece);
}

/* ---------- le jet, la relance, le revirement ---------- */

/**
 * Un jet. Rend `{ de, mod, total, reussi }` et pose l'événement dans le fil.
 * La relance d'équipe se demande APRÈS avoir vu le dé — c'est tout l'intérêt
 * du team re-roll de Blood Bowl : on le dépense en connaissance de cause.
 */
export function jeter(m, mod, quoi) {
  const seuil = quoi === 'tir' ? SEUIL_TIR : SEUIL;
  const mo = borne(mod, MOD_MIN, MOD_MAX);
  const de = Math.floor(m.de() * 6) + 1;
  return { de, mod: mo, seuil, total: de + mo, reussi: passe(de, mo, seuil), quoi };
}

export function relancer(m, jet, cote) {
  const eq = eqDe(m, cote);
  if (!eq.relance) return jet;
  eq.relance = false;
  const de = Math.floor(m.de() * 6) + 1;
  return { ...jet, de, total: de + jet.mod, reussi: passe(de, jet.mod, jet.seuil), relance: true };
}

/**
 * La rondelle rebondit sur une case LIBRE, la plus proche possible.
 *
 * Elle ne cherchait que les huit cases voisines, et quand les huit étaient
 * prises elle retombait sur la case de la pièce elle-même : la rondelle
 * finissait sous les patins de quelqu'un, invisible et injouable — personne
 * ne pouvait patiner dessus puisque la case était occupée. Le rayon s'élargit
 * donc jusqu'à trouver, et une glace de 63 cases avec dix pièces en trouve
 * toujours une.
 */
function rebondir(m, r, c) {
  for (let rayon = 1; rayon <= 8; rayon++) {
    const cases = [];
    for (let dr = -rayon; dr <= rayon; dr++) for (let dc = -rayon; dc <= rayon; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== rayon) continue;
      const nr = r + dr, nc = c + dc;
      if (dansLaGlace(nr, nc) && !occupee(m, nr, nc)) cases.push({ r: nr, c: nc });
    }
    if (cases.length) {
      const ou = cases[Math.floor(m.de() * cases.length)];
      m.rondelle = { libre: ou };
      return ou;
    }
  }
  const ou = { r: borne(r, RANG_MIN, RANG_MAX), c: borne(c, 0, COLS - 1) };
  m.rondelle = { libre: ou };
  return ou;
}

/** Le revirement : la présence finit ici, quoi qu'il reste à faire. */
function revirement(m, texte) {
  eqDe(m, m.tour).revirements++;
  dire(m, `${texte} Revirement — la présence est finie.`, 'revirement');
  finirPresence(m);
}

/* ======================================================================
   EXÉCUTER UN GESTE
   ======================================================================
   `executer` prend une action déjà validée et l'applique. Il ne décide rien :
   c'est l'écran (ou l'IA) qui choisit, lui il joue. Rend `{ jet }` quand un
   dé a été lancé, pour que l'écran puisse offrir la relance avant d'appliquer
   la suite — `appliquer` est donc séparé de `jeter`.
   ====================================================================== */

/** Les cases où cette pièce peut aller : `PA` pas, en contournant les pièces. */
export function deplacementsDe(m, piece) {
  const vus = new Map([[`${piece.r},${piece.c}`, 0]]);
  const file = [{ r: piece.r, c: piece.c, n: 0 }];
  const out = [];
  while (file.length) {
    const cur = file.shift();
    if (cur.n >= pasDe(m, piece)) continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = cur.r + dr, c = cur.c + dc, cle = `${r},${c}`;
      if (!dansLaGlace(r, c) || vus.has(cle) || occupee(m, r, c)) continue;
      vus.set(cle, cur.n + 1);
      file.push({ r, c, n: cur.n + 1 });
      out.push({ r, c, pas: cur.n + 1 });
    }
  }
  return out;
}

/** Les coéquipiers à qui cette pièce peut passer. */
export const receveursDe = (m, piece) =>
  eqDe(m, piece.eq).pieces.filter(x => x !== piece && !x.etourdi);

/*
 * LES CIBLES D'UNE MISE EN ÉCHEC : N'IMPORTE QUEL ADVERSAIRE ADJACENT.
 *
 * JP : *ajouter contacts physique* ; *mises en échec [...] plus élevées, faire
 * variété d'actions*. On ne pouvait frapper que le PORTEUR, donc le contact
 * n'existait qu'une fois par présence au mieux. Au hockey on frappe pour
 * ouvrir une voie autant que pour reprendre la rondelle — mettre l'ailier
 * adverse au sol devant son filet vaut le geste même s'il n'a rien dans les
 * mains. Le risque suit la cible : rater le PORTEUR, c'est se faire déjouer,
 * donc un revirement et la présence finie ; rater un joueur SANS la rondelle,
 * c'est se retrouver hors position, donc sa propre pièce au sol une présence.
 * On ne peut pas perdre une rondelle qu'on n'a pas.
 */
export const ciblesEchecDe = (m, piece) =>
  // ON NE FRAPPE PAS AVEC LA RONDELLE DANS LES MAINS. Le porteur pouvait
  // tenter une mise en échec, la manquer, et se retrouver au sol EN PORTANT
  // la rondelle : plus personne ne pouvait la jouer. C'est aussi ce que le
  // hockey dit — on lâche la rondelle avant de donner de l'épaule.
  (porteur(m) === piece ? [] : eqDe(m, adverse(piece.eq)).pieces.filter(x => !x.etourdi && dist(x, piece) === 1));

/** Les cibles d'un vol : le porteur adverse, et lui seul. */
export const ciblesVolDe = (m, piece) => {
  const p = porteur(m);
  return p && p.eq !== piece.eq && !p.gardien && !p.etourdi && dist(p, piece) === 1 ? [p] : [];
};

/**
 * Le déplacement. Sans la rondelle, patiner est libre : on ne fait pas rouler
 * un dé pour un joueur qui se replace, ça ralentirait le jeu pour rien. Avec
 * la rondelle, quitter une case tenue par un bâton adverse demande une
 * esquive, et c'est là que le plateau prend vie.
 */
export function deplacer(m, piece, vers) {
  const avecRondelle = porteur(m) === piece;
  const tenue = batons(m, piece.eq, piece.r, piece.c);
  piece.deplace = true;
  if (!avecRondelle || tenue === 0) {
    deposer(m, piece, vers.r, vers.c);
    return { ok: true, jet: null };
  }
  const mod = modEsquive(m, piece, vers) + (piece.hab === 'PATIN' && piece.habDispo ? 2 : 0);
  return { ok: true, jet: jeter(m, mod, 'esquive'), vers, piece };
}

/**
 * LA RONDELLE LIBRE APPARTIENT À QUI MET LE PIED DESSUS. Une seule règle, et
 * elle vaut dans TOUS les cas : on patine dessus, on se fait pousser dessus,
 * on y rentre en changeant de trio — on la prend, sans dé et sans dépenser
 * son geste.
 *
 * Il y en avait deux avant, et elles se contredisaient : patiner sur la
 * rondelle la prenait gratuitement, mais être DÉJÀ debout dessus coûtait un
 * geste ET un jet de dé (l'ancien `ramasser`). C'était à l'envers — le geste
 * difficile était gratuit et le geste facile était payant — et `ramasser` ne
 * représentait que 0 % des gestes joués sur 120 matchs (`check_regles.mjs`) :
 * une règle morte, donc un mensonge de plus dans la page des règles.
 *
 * `deposer` est le seul endroit du moteur qui pose une pièce sur une case ;
 * tout passe par lui, donc la règle ne peut pas être oubliée quelque part.
 */
function deposer(m, piece, r, c) {
  piece.r = r; piece.c = c;
  const l = libre(m);
  if (!l || l.r !== r || l.c !== c) return false;
  // UNE PIÈCE AU SOL NE RAMASSE RIEN. Une mise en échec pousse le frappé
  // d'une case, et il pouvait atterrir sur la rondelle libre — il la portait
  // donc en étant étourdi, personne ne pouvait la lui prendre ni la jouer, et
  // le match se figeait là (`check_regles.mjs` : « porte la rondelle et est
  // étourdi »). Elle lui reste sous les patins jusqu'à ce qu'il se relève.
  if (piece.etourdi) return false;
  m.rondelle = { piece };
  piece.derniere = null;
  dire(m, `${nomDe(piece)} met le pied sur la rondelle libre et la récupère.`, 'ok');
  return true;
}

export function appliquerEsquive(m, piece, vers, jet) {
  if (piece.hab === 'PATIN' && piece.habDispo) piece.habDispo = false;
  if (jet.reussi) {
    deposer(m, piece, vers.r, vers.c);
    dire(m, `${nomDe(piece)} se défait de la couverture.`, 'ok');
    return true;
  }
  rebondir(m, piece.r, piece.c);
  revirement(m, `${nomDe(piece)} perd la rondelle en voulant s'échapper.`);
  return false;
}

export function passer(m, piece, cible) {
  const mod = modPasse(m, piece, cible) + (piece.hab === 'VOILEE' && piece.habDispo ? 2 : 0);
  return jeter(m, mod, 'passe');
}

export function appliquerPasse(m, piece, cible, jet) {
  if (piece.hab === 'VOILEE' && piece.habDispo) piece.habDispo = false;
  piece.agi = true;
  if (jet.reussi) {
    m.rondelle = { piece: cible };
    cible.derniere = piece;      // qui a donné la rondelle : le passeur du but
    dire(m, `${nomDe(piece)} rejoint ${nomDe(cible)}.`, 'ok');
    return true;
  }
  rebondir(m, cible.r, cible.c);
  revirement(m, `La passe de ${nomDe(piece)} est interceptée.`);
  return false;
}

export function tirer(m, piece) {
  const mod = modTir(m, piece) + (piece.hab === 'DECOCHE' && piece.habDispo ? 2 : 0);
  eqDe(m, piece.eq).modsTir.push({ mod, d: Math.abs(piece.r - eqDe(m, piece.eq).but) });
  return jeter(m, mod, 'tir');
}

export function appliquerTir(m, piece, jet) {
  if (piece.hab === 'DECOCHE' && piece.habDispo) piece.habDispo = false;
  const eq = eqDe(m, piece.eq);
  const advG = eqDe(m, adverse(piece.eq)).piece_g;
  eq.tirs++; piece.tirs++; piece.agi = true;
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
  advG.arrets++; eqDe(m, adverse(piece.eq)).arrets++;
  /*
   * LE RETOUR, et c'est le geste qui fait le mode.
   *
   * Un arrêt donnait TOUJOURS la rondelle au gardien, donc tout tir raté
   * finissait la présence. Mesuré : la moitié des présences mouraient sans
   * tir et l'autre moitié sur un revirement, et le plateau plafonnait à trois
   * buts par équipe par match quelle que soit la façon dont on tirait dessus.
   *
   * Maintenant, un tir pris DE L'ENCLAVE — ou raté de justesse — laisse un
   * retour libre devant le filet, et la présence continue : n'importe qui
   * peut sauter dessus. C'est la mêlée devant le but des jeux de borne, et
   * c'est aussi la profondeur qu'on cherche — aller au filet ne donne plus
   * seulement +2 au tir, ça donne une DEUXIÈME chance. Un tir de la pointe,
   * lui, finit dans la mitaine : tirer de loin reste un choix, pas un
   * réflexe.
   */
  const eqAdv = eqDe(m, adverse(piece.eq));
  const enclave = natureCase(piece.r, piece.c, eq.but) === 'enclave';
  const deJustesse = jet.de === jet.seuil - 1;
  if (enclave || deJustesse) {
    rebondir(m, piece.r, piece.c);
    dire(m, `${nomDe(advG)} repousse le tir de ${nomDe(piece)} — retour devant le filet.`, 'retour');
    return false;
  }
  dire(m, `${nomDe(advG)} bloque le tir de ${nomDe(piece)}.`, 'arret');
  m.rondelle = { piece: advG };
  revirement(m, `Le gardien garde la rondelle.`);
  return false;
}

export function mettreEnEchec(m, piece, cible) {
  const mod = modEchec(m, piece, cible) + ((piece.hab === 'ACTIF' || piece.hab === 'EPAULE') && piece.habDispo ? 2 : 0);
  return jeter(m, mod, 'echec');
}

export function appliquerEchec(m, piece, cible, jet) {
  // Le matador finit sa mise en échec : un échec manqué ne lui coûte pas la
  // présence, exactement comme l'habileté Coup d'épaule.
  const solide = (piece.hab === 'EPAULE' && piece.habDispo) || piece.st.gb === GABARIT_MATADOR;
  if ((piece.hab === 'ACTIF' || piece.hab === 'EPAULE') && piece.habDispo) piece.habDispo = false;
  const eq = eqDe(m, piece.eq);
  const avaitLaRondelle = porteur(m) === cible;
  piece.agi = true;
  eq.echecs++;
  if (jet.reussi) {
    fiche(eq, piece.p).echecs++;
    /*
     * COMBIEN DE TEMPS ON RESTE AU SOL, et c'est le réglage qui a failli tuer
     * le jeu. Mesuré : vingt-deux mises en échec par équipe par match — le
     * vrai chiffre de la LNH — mais chacune sortait l'adversaire pour sa
     * présence SUIVANTE au complet. Une équipe jouait donc sans un ou deux
     * patineurs en permanence, et les buts sont tombés de 2,7 à 1,8.
     *
     * Au hockey, un joueur plaqué se relève. Frapper quelqu'un qui n'a pas la
     * rondelle ouvre une voie MAINTENANT (il sort de la couverture pour le
     * reste de ta présence) et c'est tout ; seul un coup sur le PORTEUR, qui
     * te coûte la présence si tu le manques, le garde au sol jusqu'à sa
     * prochaine présence. Le risque paie le résultat.
     */
    cible.etourdi = avaitLaRondelle ? (cible.st.gb === GABARIT_PETIT ? 3 : 2) : 1;
    pousser(m, piece, cible);
    // LE CONTRE-ATTAQUE. Enlever la rondelle et rester planté là ne menait
    // nulle part : la présence finissait sur place. Qui la gagne REPART avec
    // — son déplacement se rouvre, et c'est ça, une échappée.
    if (avaitLaRondelle) { m.rondelle = { piece }; piece.derniere = null; piece.deplace = false; }
    dire(m, `${nomDe(piece)} met ${nomDe(cible)} en échec${avaitLaRondelle ? ' et récupère' : ''}.`, 'echec');
    return true;
  }
  if (!avaitLaRondelle) {
    // Rien à perdre, mais on est allé se promener : la pièce est hors position.
    if (!solide) piece.etourdi = 1;
    dire(m, `${nomDe(piece)} manque ${nomDe(cible)}${solide ? ', mais reste debout' : ' et se retrouve hors position'}.`, 'rate');
    return false;
  }
  if (solide) {
    dire(m, `${nomDe(piece)} manque sa mise en échec, mais reste debout.`, 'rate');
    return false;
  }
  revirement(m, `${nomDe(piece)} manque sa mise en échec et se fait déjouer.`);
  return false;
}

/**
 * La poussée : le frappé recule d'une case, s'il y a de la place.
 *
 * ON NE POUSSE JAMAIS QUELQU'UN SUR LA RONDELLE. Il est au sol, donc il ne
 * la ramasse pas — et comme sa case est occupée, personne d'autre ne peut
 * patiner dessus non plus : la rondelle devenait injouable jusqu'à ce qu'il
 * se relève et s'en aille. La case de la rondelle libre est donc traitée
 * comme une case pleine ; s'il n'y a pas d'autre place, il reste debout où
 * il est, simplement étourdi.
 */
function pousser(m, piece, cible) {
  const dr = Math.sign(cible.r - piece.r), dc = Math.sign(cible.c - piece.c);
  const r = cible.r + dr, c = cible.c + dc;
  const l = libre(m);
  if (l && l.r === r && l.c === c) return;
  if (dansLaGlace(r, c) && !occupee(m, r, c)) deposer(m, cible, r, c);
}

/* ---------- le vol de rondelle ---------- */

export function voler(m, piece, cible) {
  return jeter(m, modVol(m, piece, cible) + (piece.hab === 'ACTIF' && piece.habDispo ? 2 : 0), 'vol');
}

export function appliquerVol(m, piece, cible, jet) {
  if (piece.hab === 'ACTIF' && piece.habDispo) piece.habDispo = false;
  const eq = eqDe(m, piece.eq);
  piece.agi = true;
  if (jet.reussi) {
    fiche(eq, piece.p).vols++;
    m.rondelle = { piece };
    piece.derniere = null;
    piece.deplace = false;      // il repart avec : voir la contre-attaque
    dire(m, `${nomDe(piece)} soutire la rondelle à ${nomDe(cible)}.`, 'vol');
    return true;
  }
  revirement(m, `${nomDe(piece)} tend le bâton et ${nomDe(cible)} le contourne.`);
  return false;
}

/* ---------- se placer devant : l'écran ---------- */

/**
 * LE BLOCAGE DE TIR, sans réaction. Blood Bowl n'a pas de gestes hors tour, et
 * on n'en veut pas non plus : ça doublerait la durée d'un match. Se placer
 * devant est donc une POSTURE — la pièce dépense son geste, et jusqu'à ta
 * prochaine présence elle compte double (ou triple pour qui bloque vraiment)
 * dans les bâtons qui gênent un tir. C'est le seul geste purement défensif du
 * plateau, et le seul qui n'a pas de dé : se coucher devant une rondelle, ça
 * ne rate pas, ça fait juste mal.
 */
export function seMettreDevant(m, piece) {
  piece.agi = true;
  piece.ecran = 2;
  dire(m, `${nomDe(piece)} se place devant le tir.`, 'ecran');
  return true;
}

/* ---------- foncer : le deuxième élan ---------- */

/**
 * FONCER. JP : *vitesse plus élevées*. Monter le patin de tout le monde
 * allumait quarante cases d'un coup et rendait le plateau illisible ; un
 * DEUXIÈME élan, lui, est une décision de plus, pas trente options de plus.
 * La pièce dépense son geste pour repatiner — elle ne tirera donc pas ce
 * tour-ci. C'est la montée du défenseur, et c'est le petit gabarit qui en
 * profite le plus, avec ses cinq ou six pas.
 */
export function foncer(m, piece) {
  piece.agi = true;
  piece.deplace = false;
  dire(m, `${nomDe(piece)} pousse la rondelle et accélère.`, 'fonce');
  return true;
}

/* ======================================================================
   LE TOUR
   ====================================================================== */

/*
 * UNE PIÈCE BOUGE UNE FOIS ET AGIT UNE FOIS PAR PRÉSENCE, comme un joueur de
 * Blood Bowl. Sans cette borne, l'IA repatinait la même pièce jusqu'à ce que
 * le garde-fou la coupe : seize gestes par présence (`check_table.mjs`), donc
 * un match qui n'en finissait plus. C'est la borne qui fait la vitesse.
 */
export const peutJouer = x => !x.etourdi && (!x.deplace || !x.agi);
export const actives = m => eqDe(m, m.tour).pieces.filter(peutJouer);

export function finirPresence(m, butMarque = false) {
  const eq = eqDe(m, m.tour);
  respirer(eq);
  for (const x of eq.pieces) { x.agi = false; x.deplace = false; }
  for (const x of surLaGlace(m)) { if (x.etourdi) x.etourdi--; if (x.ecran) x.ecran--; }

  // MORT SUBITE : en prolongation, le premier but finit tout.
  if (m.prolongation && butMarque) { m.fini = true; dire(m, `Fin du match. ${m.A.buts} \u2013 ${m.B.buts}`, 'fin'); return; }

  /*
   * LE COMPTEUR NE DÉPASSE JAMAIS LA DERNIÈRE PRÉSENCE. Il montait AVANT de
   * vérifier la fin de période, donc un match fini restait à « présence 13
   * sur 12 » et le tableau indicateur calculait un nombre de présences
   * restantes négatif. On vérifie d'abord, on avance ensuite.
   */
  // Une prolongation est courte : deux présences chacune, puis on recommence.
  const parPeriode = (m.prolongation ? PRESENCES_PROLONGATION : PRESENCES_PAR_PERIODE) * 2;
  if (m.presence >= parPeriode) {
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
    m.A.relance = true; m.B.relance = true;
    for (const x of surLaGlace(m)) { x.etourdi = 0; x.habDispo = true; }
    m.tour = m.periode % 2 === 1 ? 'A' : 'B';   // on change de bord de mise au jeu
    miseAuJeu(m, `${ordP(m.periode)} période`);
    return;
  }
  m.presence++;
  m.tour = adverse(m.tour);
  if (butMarque) miseAuJeu(m, 'Mise au jeu au centre');
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
  const relais = eq.pieces.filter(x => !x.etourdi)
    .sort((a, b) => dist(a, p) - dist(b, p) || (a.role.startsWith('D') ? -1 : 1))[0];
  if (!relais) return;
  m.rondelle = { piece: relais };
  relais.derniere = null;
  dire(m, `${nomDe(p)} relance la rondelle à ${nomDe(relais)}.`, 'ok');
}

function finirMatch(m) {
  m.fini = true;
  if (m.A.buts === m.B.buts) {
    // LA PROLONGATION : une présence chacune, mort subite, et on recommence
    // tant que personne n'a marqué. Blood Bowl finit sur une nulle ; le
    // hockey, non, et un tournoi a besoin d'un gagnant.
    m.fini = false;
    m.prolongation = (m.prolongation || 0) + 1;
    /*
     * UN MATCH FINIT TOUJOURS SUR UN GAGNANT. Le tournoi est à élimination :
     * une nulle n'y veut rien dire, et `gagnantDe` aurait donné la victoire à
     * l'équipe B par accident (`gfA > gfB` étant faux). Douze prolongations
     * de deux présences chacune ne sont jamais arrivées en 200 matchs
     * mesurés — mais « jamais arrivé » n'est pas une règle. Au-delà, le bris
     * d'égalité est écrit : les lancers, puis les mises en échec, puis
     * l'équipe locale. Voir `gagnantDuMatch`.
     */
    if (m.prolongation > PROLONGATIONS_MAX) { m.fini = true; m.nul = true; return; }
    m.periode = PERIODES + m.prolongation;
    m.presence = 1;
    m.A.relance = true; m.B.relance = true;
    for (const x of surLaGlace(m)) { x.etourdi = 0; x.habDispo = true; }
    m.tour = m.prolongation % 2 === 1 ? 'A' : 'B';
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

/* Ce que vaut une case pour qui attaque `but` : proche du filet et au centre. */
function valeurCase(r, c, but) {
  const d = Math.abs(r - but);
  return (10 - d) * 1.0 + (3 - Math.abs(c - BUT_COL)) * 0.6;
}

/** Le meilleur geste d'une pièce, et ce qu'il vaut. */
function meilleurGeste(m, piece) {
  const eq = eqDe(m, piece.eq);
  const options = [];
  const aLaRondelle = porteur(m) === piece;
  const rondelleLibre = libre(m);
  const bonus = (h) => (piece.hab === h && piece.habDispo ? 2 : 0);

  if (aLaRondelle) {
    if (!piece.agi) {
      // Tirer : ce que ça rapporte, c'est un but. Un tir raté rend la
      // rondelle au gardien, donc ça se pèse.
      if (peutTirer(m, piece)) options.push({ type: 'tir', val: chances(modTir(m, piece) + bonus('DECOCHE'), SEUIL_TIR) * 11 - 1.5 });
      for (const cible of receveursDe(m, piece)) {
        const gain = valeurCase(cible.r, cible.c, eq.but) - valeurCase(piece.r, piece.c, eq.but);
        // Ce que la passe ouvre : la chance de tir du receveur, zéro s'il est
        // hors de portée. Sans ça le glouton passait à quelqu'un de mieux
        // « placé » qui ne pouvait pas tirer non plus.
        const tirIci = peutTirer(m, piece) ? chances(modTir(m, piece), SEUIL_TIR) : 0;
        const tir = (peutTirer(m, cible) ? chances(modTir(m, cible), SEUIL_TIR) : 0) - tirIci;
        if (gain <= 0 && tir <= 0.02) continue;
        options.push({ type: 'passe', cible, val: chances(modPasse(m, piece, cible) + bonus('VOILEE')) * (2.5 + gain * 0.5 + tir * 9) });
      }
      // FONCER : dépenser son geste pour un deuxième élan. Ça ne vaut que
      // quand on est encore loin et qu'on a du patin à dépenser.
      if (piece.deplace && Math.abs(piece.r - eq.but) >= 4) {
        options.push({ type: 'foncer', val: 1.6 + pasDe(m, piece) * 0.25 });
      }
    }
    if (!piece.deplace) {
      let mieux = null;
      for (const v of deplacementsDe(m, piece)) {
        const gain = valeurCase(v.r, v.c, eq.but) - valeurCase(piece.r, piece.c, eq.but);
        if (gain <= 0) continue;
        const risque = batons(m, piece.eq, piece.r, piece.c) ? chances(modEsquive(m, piece, v) + bonus('PATIN')) : 1;
        const val = risque * (2 + gain * 0.9);
        if (!mieux || val > mieux.val) mieux = { type: 'deplacer', vers: v, val };
      }
      if (mieux) options.push(mieux);
    }
  } else {
    const p = porteur(m);
    if (!piece.agi) {
      // LES DEUX ROUTES DÉFENSIVES. L'épaule met au sol et pousse ; le bâton
      // prend la rondelle sans toucher. Un costaud choisit la première, un
      // habile la seconde, et le glouton les compare honnêtement.
      for (const cible of ciblesEchecDe(m, piece)) {
        const porte = p === cible;
        const solide = (piece.hab === 'EPAULE' && piece.habDispo) || piece.st.gb === GABARIT_MATADOR;
        const c = chances(modEchec(m, piece, cible) + bonus('ACTIF') + bonus('EPAULE'));
        // Frapper un joueur SANS la rondelle ouvre une voie : ça vaut moins,
        // mais ça ne risque que la position de sa propre pièce.
        const gain = porte ? 9 : 2.0;
        const risque = porte ? (solide ? 0 : 3.2) : (solide ? 0.4 : 1.6);
        options.push({ type: 'echec', cible, val: c * gain - risque });
      }
      for (const cible of ciblesVolDe(m, piece)) {
        options.push({ type: 'vol', cible, val: chances(modVol(m, piece, cible) + bonus('ACTIF')) * 9 - 3.2 });
      }
      // SE PLACER DEVANT : quand l'adversaire porte la rondelle près de notre
      // filet et qu'on ne peut pas la lui prendre, on bouche la voie.
      if (p && p.eq !== piece.eq && !piece.ecran) {
        const menace = Math.abs(p.r - eqDe(m, p.eq).but) <= 3 && dist(piece, p) === 1;
        if (menace) options.push({ type: 'ecran', val: 3.4 });
      }
    }
    const vise = rondelleLibre || p;
    if (vise && !piece.deplace) {
      let mieux = null;
      const d0 = dist(piece, vise);
      for (const v of deplacementsDe(m, piece)) {
        const d = dist(v, vise);
        if (d >= d0 && !(rondelleLibre && d === 0)) continue;
        const val = 3 - d * 0.6 + (rondelleLibre && d === 0 ? 4 : 0);
        if (!mieux || val > mieux.val) mieux = { type: 'deplacer', vers: v, val };
      }
      if (mieux) options.push(mieux);
    }
  }
  if (!options.length) return null;
  return options.sort((a, b) => b.val - a.val)[0];
}

/**
 * LE PROCHAIN GESTE DE L'IA, sans le jouer. Sépare la DÉCISION de
 * l'EXÉCUTION, ce qui permet à l'écran de jouer la présence adverse un geste
 * à la fois — jusqu'ici il la jouait d'un coup et racontait le fil ensuite,
 * donc le plateau montrait déjà l'état FINAL pendant qu'on lisait le premier
 * geste. On voyait la fin avant l'histoire.
 */
function iaProchainGeste(m, cote) {
  let joue = null;
  for (const piece of actives(m)) {
    const g = meilleurGeste(m, piece);
    if (!g) continue;
    if (!joue || g.val > joue.val) joue = { piece, ...g };
  }
  if (joue && joue.val > 0) return joue;
  /*
   * ON LANCE AU FILET. Mesuré : la moitié des présences finissaient
   * « plus rien d'utile à faire » — la pièce qui portait la rondelle
   * gardait son geste et la présence expirait avec la rondelle dans le
   * coin. C'est du hockey défensif, et ce n'est pas ce mode-ci : quand
   * il ne reste rien de mieux, le porteur lance, s'il est à portée.
   */
  const p = porteur(m);
  if (p && p.eq === cote && !p.agi && peutTirer(m, p)) return { piece: p, type: 'tir' };
  return null;
}

/**
 * L'IA joue UN SEUL geste. Rend `{ piece, type }`, ou null quand il ne lui
 * reste rien — auquel cas elle a terminé sa présence. C'est ce que l'écran
 * appelle sur une minuterie pour que le plateau et le fil avancent ensemble.
 */
export const GESTES_MAX = 12;   // le garde-fou d'une présence

export function iaGeste(m) {
  if (m.fini) return null;
  const cote = m.tour;
  const eq = eqDe(m, cote);
  // Le changement de trio se décide au banc, avant le premier geste.
  if (eq.pieces.every(x => !x.agi && !x.deplace)) iaChanger(m, cote);
  const joue = iaProchainGeste(m, cote);
  if (!joue) {
    dire(m, `${eq.nom} a fini sa présence.`, 'fin-presence');
    finirPresence(m);
    return null;
  }
  const jet = jouerGeste(m, joue.piece, joue, cote, true);
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
export function iaPresence(m, surGeste = null) {
  const cote = m.tour;
  const gestes = [];
  let garde = 0;
  while (m.tour === cote && !m.fini && garde++ < GESTES_MAX) {
    const joue = iaGeste(m);
    if (!joue) break;
    gestes.push({ piece: joue.piece, type: joue.type });
    if (surGeste) surGeste(joue.type, joue.piece);
  }
  // LE GARDE-FOU DOIT QUAND MÊME FINIR LA PRÉSENCE. Sans ça, une présence
  // qui atteint la limite laisse le tour à la même équipe pour toujours et
  // la boucle appelante ne s'arrête jamais.
  if (m.tour === cote && !m.fini) finirPresence(m);
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
    appliquerEsquive(m, piece, action.vers, jet);
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
  // Les deux gestes sans dé : se placer devant, et foncer.
  if (action.type === 'ecran') { seMettreDevant(m, piece); return null; }
  if (action.type === 'foncer') { foncer(m, piece); return null; }
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
  if (porteur(m) && porteur(m).eq === cote && !auCentre(m, cote)) return;   // pas pendant sa montée
  const moyenne = (joueurs) => {
    const vals = joueurs.filter(Boolean).map(p => eq.souffle.get(p) ?? statsDeTable(p).SO);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 9;
  };
  const trios = [0, 1, 2, 3].map(u => uniteDe(eq.roster, u, 0).slice(0, 3).map(x => x.p));
  const paires = [0, 1, 2].map(u => uniteDe(eq.roster, 0, u).slice(3).map(x => x.p));
  let tri = eq.tri, pai = eq.pai;
  if (moyenne(trios[eq.tri]) <= 1) tri = trios.map((t, i) => [moyenne(t), i]).sort((a, b) => b[0] - a[0])[0][1];
  if (moyenne(paires[eq.pai]) <= 1) pai = paires.map((t, i) => [moyenne(t), i]).sort((a, b) => b[0] - a[0])[0][1];
  if (tri !== eq.tri || pai !== eq.pai) {
    changerUnite(m, cote, tri, pai);
    dire(m, `${eq.nom} change ses lignes.`, 'changement');
  }
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
  if (chances(jet.mod) < 0.45) return jet;
  if (jet.quoi === 'esquive' && m.periode <= 2) return jet;
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
  while (!m.fini && garde++ < 400) iaPresence(m);
  return resultatDe(m);
}

/**
 * QUI A GAGNÉ, sans jamais rendre « personne ». Le pointage d'abord ; si
 * douze prolongations n'ont pas départagé les deux clubs, les lancers, puis
 * les mises en échec, puis l'équipe qui recevait. Rend 'A' ou 'B'.
 */
export function gagnantDuMatch(r) {
  if (r.gfA !== r.gfB) return r.gfA > r.gfB ? 'A' : 'B';
  if (r.A.tirs !== r.B.tirs) return r.A.tirs > r.B.tirs ? 'A' : 'B';
  if (r.A.echecs !== r.B.echecs) return r.A.echecs > r.B.echecs ? 'A' : 'B';
  return 'A';
}

/** Le résultat d'un match : ce que le tournoi retient. */
export function resultatDe(m) {
  const fiche = eq => ({
    nom: eq.nom, tag: eq.tag, buts: eq.buts, tirs: eq.tirs,
    revirements: eq.revirements, echecs: eq.echecs, modsTir: eq.modsTir,
    marqueurs: [...eq.fiches.values()].filter(f => f.buts || f.passes)
      .map(f => ({ p: f.p, buts: f.buts, passes: f.passes })),
    physique: [...eq.fiches.values()].filter(f => f.echecs || f.vols)
      .map(f => ({ p: f.p, echecs: f.echecs, vols: f.vols })),
    gardien: { p: eq.gardien, arrets: eq.arrets, alloues: eq.alloues },
  });
  return {
    A: fiche(m.A), B: fiche(m.B),
    gfA: m.A.buts, gfB: m.B.buts,
    prolongation: !!m.prolongation,
    nul: !!m.nul,
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
export function changerUnite(m, cote, tri, pai) {
  const eq = eqDe(m, cote);
  const p = porteur(m);
  const roleAvait = p && p.eq === cote ? p.role : null;
  eq.tri = tri; eq.pai = pai;
  poser(eq, m);
  if (roleAvait) m.rondelle = { piece: eq.pieces.find(x => x.role === roleAvait) };
  // Un des cinq qui rentrent peut se poser sur la rondelle libre : la même
  // règle vaut pour lui que pour celui qui patine dessus.
  for (const x of eq.pieces) if (deposer(m, x, x.r, x.c)) break;
}

/** Vient-on de faire une mise au jeu ? (les cinq pièces sont à leur place de départ) */
export const auCentre = (m, cote) =>
  eqDe(m, cote).pieces.every(x => {
    const [r, c] = DEPART[cote][x.role];
    return x.r === r && x.c === c;
  });

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
  const parMatch = PRESENCES_PAR_PERIODE * PERIODES;
  return [
    {
      titre: 'Le match',
      points: [
        `Trois périodes. Chaque équipe joue ${PRESENCES_PAR_PERIODE} présences par période, en alternance stricte — toi, l'adversaire, toi — soit ${parMatch} présences chacune dans un match.`,
        'Il n\'y a pas d\'horloge : le match finit quand les présences sont épuisées. Le plus de buts l\'emporte.',
        `Égalité après trois périodes : prolongation de ${PRESENCES_PROLONGATION} présences chacune, mort subite — le premier but finit tout, et on recommence tant que personne ne marque.`,
        'Tu attaques toujours vers le haut, à toutes les périodes. Le plateau ne se retourne jamais.',
      ],
    },
    {
      titre: 'La glace',
      points: [
        `${COLS} colonnes, ${RANGS} rangées. Les deux rangées du bout sont les filets : seuls les gardiens y sont.`,
        `ON NE TIRE QUE DE LA ZONE OFFENSIVE : à ${PORTEE_TIR} cases du filet ou moins. Au-delà de la ligne bleue ce n'est pas un tir, c'est un dégagement, et le geste n'est pas offert. Il faut entrer.`,
        'L\'enclave — les deux rangées devant un filet, sauf les coins — vaut +2 au tir, et un tir raté pris de là laisse un retour.',
        'Un coin vaut −1 au tir, une bande −1 de plus : c\'est le côté court.',
        'La ligne bleue, c\'est la pointe : c\'est de là que le tir frappé vaut son bonus.',
        'Un adversaire collé au tireur ne gêne son tir que s\'il est ENTRE lui et le filet. Celui qui est dans son dos ne bloque rien.',
      ],
    },
    {
      titre: 'Une présence',
      points: [
        'Chacune de tes cinq pièces peut patiner une fois ET faire un geste une fois, dans l\'ordre que tu veux.',
        'Ta présence finit quand plus aucune pièce n\'a de geste, quand tu touches « Finir ma présence » — ou sur un revirement.',
        'LE REVIREMENT : un jet raté qui te coûte la rondelle termine ta présence sur-le-champ, même si tes autres pièces n\'ont rien fait. C\'est le coeur du jeu.',
      ],
    },
    {
      titre: 'Le dé',
      points: [
        `Un d6 par geste risqué. Il faut ${SEUIL} ou plus, modificateurs compris.`,
        'Un 6 réussit toujours. Un 1 échoue toujours. Rien n\'est jamais sûr ni jamais perdu.',
        `Les modificateurs sont bornés à ${MOD_MAX} de chaque bord, et il faut deux crans de talent pour en valoir un.`,
        'Chaque option affiche son seuil et ses chances AVANT que tu t\'engages : la case où patiner, le coéquipier visé, l\'adversaire à frapper, le bouton de tir.',
        'LA RELANCE D\'ÉQUIPE : une par période, dépensée après avoir vu le dé.',
      ],
    },
    {
      titre: 'Les huit gestes',
      colonnes: ['geste', 'dé', 'ce que ça fait', 'un échec coûte'],
      rangees: [
        ['Patiner', 'non', `jusqu'à PA cases, en contournant les pièces`, '—'],
        ['Esquiver', 'oui', 'quitter avec la rondelle une case tenue par un bâton adverse', 'revirement'],
        ['Passer', 'oui', 'donner la rondelle à un coéquipier', 'revirement'],
        ['Tirer', 'oui', `un but — de la zone offensive seulement, à ${PORTEE_TIR} cases ou moins`, 'le gardien la garde — sauf de l\'enclave, ou raté d\'un seul point : retour'],
        ['Épaule', 'oui', 'n\'importe quel adversaire adjacent : il tombe et recule d\'une case', 'sur le porteur, revirement ; sur un autre, ta pièce est hors position'],
        ['Bâton', 'oui', 'sur le porteur seulement : tu prends la rondelle sans le toucher', 'revirement'],
        ['Se placer devant', 'non', 'jusqu\'à ta prochaine présence, tu gênes double les tirs pris à côté de toi — si tu es du côté du filet', '—'],
        ['Foncer', 'non', 'tu dépenses ton geste pour patiner une seconde fois', '—'],
      ],
    },
    {
      titre: 'La rondelle',
      points: [
        'Qui met le pied sur une rondelle libre la prend : sans dé, sans dépenser son geste. Une pièce au sol, elle, ne ramasse rien.',
        'Quand le gardien a la rondelle, il la relance à son défenseur le plus proche au début de la présence.',
        'Après un but : mise au jeu au centre, les deux équipes rentrent à leur place, et le centre le plus habile gagne la rondelle.',
        'On ne frappe pas avec la rondelle dans les mains, et on ne pousse jamais personne sur la rondelle.',
      ],
    },
    {
      titre: 'Une pièce',
      points: [
        'PA patin, MA maniement, TI tir, FO force, SO souffle — de 1 à 6, tirés de ce que le joueur a vraiment fait dans sa saison.',
        `Le GABARIT : ${GABARITS[GABARIT_PETIT].icon} petit et rapide (+1 patin, +1 esquive, −1 force, −1 souffle, et il reste au sol une présence de plus), ${GABARITS[GABARIT_MOYEN].icon} moyen (+1 souffle, +1 passe, aucune faiblesse), ${GABARITS[GABARIT_MATADOR].icon} matador (+1 force, une mise en échec ratée ne lui coûte pas la présence, il protège la rondelle, −1 patin).`,
        `Le TIR SIGNATURE, et chacun a son contexte : ${Object.values(TIRS).map(t => `${t.icon} ${t.nom.toLowerCase()} (${t.desc.replace(/\.$/, '')})`).join(' · ')}.`,
        'L\'HABILETÉ, tirée de son archétype : +2 sur un type de geste, une fois par période.',
      ],
    },
    {
      titre: 'Le souffle et le changement',
      points: [
        'Chaque présence passée sur la glace coûte un point de souffle ; au banc, on en reprend un par présence.',
        'À zéro, la pièce est essoufflée : un de moins à tous ses jets, et un pas de patin en moins.',
        'LE CHANGEMENT se fait au banc, avant qu\'aucune de tes pièces n\'ait bougé. Tes cinq entrent par TON bout de glace : tu donnes ta position pour des jambes fraîches. C\'est pour ça que tu as quatre trios et trois paires.',
      ],
    },
    {
      titre: 'Le tournoi',
      points: [
        'Six clubs, cinq matchs, tout le monde une fois. Les quatre premiers passent en séries : demi-finale et finale, à match unique.',
        'Les matchs que tu ne joues pas se règlent avec exactement les mêmes règles — le classement veut donc dire quelque chose.',
        'Les matchs de séries n\'entrent pas au classement de la saison.',
        'Fermer un match ou le tournoi, c\'est laisser jouer le reste : on ne se sauve pas d\'une défaite.',
      ],
    },
  ];
}
