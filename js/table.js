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
import { archetypeKey, ARCHETYPES } from './ratings.js';
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

/** Le filet qu'une équipe attaque : 'A' monte, 'B' descend. */
export const filetDe = cote => (cote === 'A' ? FILET_HAUT : FILET_BAS);

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
  if (!p) return { PA: 3, MA: 3, TI: 3, FO: 3, AR: 3 };
  if (p.p === 'G') {
    // facteurGardienDe : combien il laisse passer. Plus c'est bas, meilleur.
    return { PA: 2, MA: 3, TI: 1, FO: 3, AR: surSix(8 - 4.2 * facteurGardienDe(p)) };
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
  let PA = 3;
  if (traits.has('VITESSE')) PA++;
  if (vol >= 1.35) PA++;
  if (estD && robu(p) >= 0.85) PA--;
  if (estD) PA--;

  return {
    PA: borne(PA, 2, 5),
    MA: surSix(1.4 + 2.2 * pas),
    TI: surSix(0.9 + 2.6 * vol * fin),
    FO: surSix(1.5 + 4.0 * robu(p)),
    AR: 3,
  };
}

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
export const SEUIL_TIR = 5;      // un but, ça se mérite
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
export const PRESENCES_PAR_PERIODE = 5;
export const PRESENCES_PROLONGATION = 2;   // la mort subite est courte, sinon on n'en sort plus

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
    fiches: new Map(),           // joueur -> { p, buts, passes, tirs }
    arrets: 0, alloues: 0,       // ceux du gardien, pour la même raison
    pieces: [],
    but: filetDe(cote),
  };
}

/** La ligne de fiche d'un joueur dans son équipe, créée au besoin. */
function fiche(eq, joueur) {
  let f = eq.fiches.get(joueur);
  if (!f) { f = { p: joueur, buts: 0, passes: 0, tirs: 0 }; eq.fiches.set(joueur, f); }
  return f;
}

/** Pose les cinq patineurs d'une équipe à leurs places de mise au jeu. */
function poser(eq) {
  const unite = uniteDe(eq.roster, eq.tri, eq.pai);
  eq.pieces = unite.map(({ role, p }) => {
    const [r, c] = DEPART[eq.cote][role];
    const st = statsDeTable(p);
    return {
      role, p, eq: eq.cote, r, c, st,
      hab: habileteDe(p),
      habDispo: true,      // une fois par période
      etourdi: 0,          // présences où la pièce ne peut pas agir
      agi: false,          // a déjà fait son geste cette présence-ci
      deplace: false,      // a déjà patiné cette présence-ci
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

/** Les bâtons adverses qui contrôlent cette case : le « tackle zone ». */
export function batons(m, cote, r, c) {
  return surLaGlace(m).filter(x => x.eq !== cote && !x.etourdi && dist(x, { r, c }) === 1).length;
}

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
  const tenue = batons(m, piece.eq, piece.r, piece.c);
  return md(piece.st.MA) - Math.max(0, tenue - 1) - (batons(m, piece.eq, vers.r, vers.c) > 0 ? 1 : 0);
}

/** Le modificateur d'une passe : la distance, et les bâtons autour du receveur. */
export function modPasse(m, piece, cible) {
  const d = dist(piece, cible);
  const loin = d <= 2 ? 0 : d <= 4 ? -1 : d <= 6 ? -2 : -3;
  return md(piece.st.MA) + loin - batons(m, piece.eq, cible.r, cible.c);
}

/** Le modificateur d'un tir : la finition contre le gardien, la distance, l'enclave, la couverture. */
export function modTir(m, piece) {
  const eq = eqDe(m, piece.eq);
  const g = eqDe(m, adverse(piece.eq)).piece_g;
  const d = Math.abs(piece.r - eq.but);
  const loin = d <= 2 ? 0 : d <= 4 ? -1 : d <= 6 ? -2 : -3;
  const nature = natureCase(piece.r, piece.c, eq.but);
  const place = nature === 'enclave' ? 2 : nature === 'coin' ? -1 : 0;
  // L'angle : tirer d'une bande, c'est tirer dans le côté court.
  const angle = Math.abs(piece.c - BUT_COL) >= 3 ? -1 : 0;
  return md(piece.st.TI) - md(g.st.AR) + loin + place + angle - batons(m, piece.eq, piece.r, piece.c);
}

/** Le modificateur d'une mise en échec : la force contre la force. */
export function modEchec(m, piece, cible) {
  return md(piece.st.FO) - md(cible.st.FO);
}

/** Le modificateur pour ramasser une rondelle libre. */
export function modRamasser(m, piece, ou) {
  return md(piece.st.MA) - batons(m, piece.eq, ou.r, ou.c);
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

/** La rondelle rebondit sur une case libre adjacente. */
function rebondir(m, r, c) {
  const cases = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const nr = r + dr, nc = c + dc;
    if (dansLaGlace(nr, nc) && !occupee(m, nr, nc)) cases.push({ r: nr, c: nc });
  }
  const ou = cases.length ? cases[Math.floor(m.de() * cases.length)] : { r: borne(r, RANG_MIN, RANG_MAX), c };
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
    if (cur.n >= piece.st.PA) continue;
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

/** Les porteurs adverses adjacents : les cibles d'une mise en échec. */
export const ciblesEchecDe = (m, piece) =>
  eqDe(m, adverse(piece.eq)).pieces.filter(x => !x.etourdi && dist(x, piece) === 1);

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
    piece.r = vers.r; piece.c = vers.c;
    return { ok: true, jet: null };
  }
  const mod = modEsquive(m, piece, vers) + (piece.hab === 'PATIN' && piece.habDispo ? 2 : 0);
  return { ok: true, jet: jeter(m, mod, 'esquive'), vers, piece };
}

export function appliquerEsquive(m, piece, vers, jet) {
  if (piece.hab === 'PATIN' && piece.habDispo) piece.habDispo = false;
  if (jet.reussi) {
    piece.r = vers.r; piece.c = vers.c;
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
  const epaule = piece.hab === 'EPAULE' && piece.habDispo;
  if ((piece.hab === 'ACTIF' || piece.hab === 'EPAULE') && piece.habDispo) piece.habDispo = false;
  piece.agi = true;
  eqDe(m, piece.eq).echecs++;
  if (jet.reussi) {
    cible.etourdi = 2;           // il reste au sol pour cette présence et la suivante
    if (porteur(m) === cible) { m.rondelle = { piece }; piece.derniere = null; }
    dire(m, `${nomDe(piece)} met ${nomDe(cible)} en échec et récupère.`, 'echec');
    return true;
  }
  if (epaule) {
    dire(m, `${nomDe(piece)} manque sa mise en échec, mais reste debout.`, 'rate');
    return false;
  }
  revirement(m, `${nomDe(piece)} manque sa mise en échec et se fait déjouer.`);
  return false;
}

export function ramasser(m, piece) {
  return jeter(m, modRamasser(m, piece, piece), 'ramasser');
}

export function appliquerRamasser(m, piece, jet) {
  piece.agi = true;
  if (jet.reussi) {
    m.rondelle = { piece };
    piece.derniere = null;
    dire(m, `${nomDe(piece)} prend possession de la rondelle.`, 'ok');
    return true;
  }
  rebondir(m, piece.r, piece.c);
  revirement(m, `${nomDe(piece)} échappe la rondelle.`);
  return false;
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
  for (const x of eq.pieces) { x.agi = false; x.deplace = false; }
  for (const x of surLaGlace(m)) if (x.etourdi) x.etourdi--;

  // MORT SUBITE : en prolongation, le premier but finit tout.
  if (m.prolongation && butMarque) { m.fini = true; dire(m, `Fin du match. ${m.A.buts} \u2013 ${m.B.buts}`, 'fin'); return; }

  m.presence++;
  // Une prolongation est courte : deux présences chacune, puis on recommence.
  const parPeriode = (m.prolongation ? PRESENCES_PROLONGATION : PRESENCES_PAR_PERIODE) * 2;
  if (m.presence > parPeriode) {
    if (m.prolongation) { finirMatch(m); return; }
    dire(m, `Fin de la ${m.periode}${m.periode === 1 ? 're' : 'e'} période. ${m.A.buts} – ${m.B.buts}`, 'periode');
    m.periode++;
    m.presence = 1;
    m.A.relance = true; m.B.relance = true;
    for (const x of surLaGlace(m)) { x.etourdi = 0; x.habDispo = true; }
    if (m.periode > PERIODES) { finirMatch(m); return; }
    m.tour = m.periode % 2 === 1 ? 'A' : 'B';   // on change de bord de mise au jeu
    miseAuJeu(m, `${m.periode}${m.periode === 1 ? 're' : 'e'} période`);
    return;
  }
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
    if (m.prolongation > 6) { m.fini = true; m.nul = true; return; }
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
      options.push({ type: 'tir', val: chances(modTir(m, piece) + bonus('DECOCHE'), SEUIL_TIR) * 11 - 1.5 });
      for (const cible of receveursDe(m, piece)) {
        const gain = valeurCase(cible.r, cible.c, eq.but) - valeurCase(piece.r, piece.c, eq.but);
        const tir = chances(modTir(m, cible), SEUIL_TIR) - chances(modTir(m, piece), SEUIL_TIR);
        if (gain <= 0 && tir <= 0.02) continue;
        options.push({ type: 'passe', cible, val: chances(modPasse(m, piece, cible) + bonus('VOILEE')) * (2.5 + gain * 0.5 + tir * 9) });
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
  } else if (rondelleLibre && !piece.agi && dist(piece, rondelleLibre) === 0) {
    options.push({ type: 'ramasser', val: chances(modRamasser(m, piece, piece)) * 9 });
  } else {
    // Sans la rondelle : l'échec avant. Mettre en échec le porteur adverse,
    // ou converger vers lui (ou vers la rondelle libre).
    if (!piece.agi) for (const cible of ciblesEchecDe(m, piece)) {
      if (porteur(m) !== cible) continue;
      const sansRisque = piece.hab === 'EPAULE' && piece.habDispo;
      const c = chances(modEchec(m, piece, cible) + bonus('ACTIF') + bonus('EPAULE'));
      options.push({ type: 'echec', cible, val: c * 9 - (sansRisque ? 0 : 3.2) });
    }
    const vise = rondelleLibre || porteur(m);
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
 * L'IA joue UNE présence complète. Rend la liste des gestes joués, pour que
 * l'écran puisse les rejouer un à un plutôt que de sauter d'un coup.
 */
export function iaPresence(m) {
  const cote = m.tour;
  const gestes = [];
  let garde = 0;
  while (m.tour === cote && !m.fini && garde++ < 12) {
    let joue = null;
    for (const piece of actives(m)) {
      const g = meilleurGeste(m, piece);
      if (!g) continue;
      if (!joue || g.val > joue.val) joue = { piece, ...g };
    }
    if (!joue || joue.val <= 0) break;
    gestes.push({ piece: joue.piece, type: joue.type });
    jouerGeste(m, joue.piece, joue, cote, true);
  }
  if (m.tour === cote && !m.fini) { dire(m, `${eqDe(m, cote).nom} a fini sa présence.`, 'fin-presence'); finirPresence(m); }
  return gestes;
}

/**
 * Joue un geste de bout en bout : le jet, la relance si l'IA en veut une, et
 * l'application. L'écran humain, lui, appelle les deux moitiés séparément
 * pour offrir la relance entre les deux.
 */
export function jouerGeste(m, piece, action, cote, ia = false) {
  if (action.type === 'deplacer') {
    const d = deplacer(m, piece, action.vers);
    if (!d.jet) return true;
    let jet = d.jet;
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    return appliquerEsquive(m, piece, action.vers, jet);
  }
  if (action.type === 'passe') {
    let jet = passer(m, piece, action.cible);
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    return appliquerPasse(m, piece, action.cible, jet);
  }
  if (action.type === 'tir') {
    let jet = tirer(m, piece);
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    return appliquerTir(m, piece, jet);
  }
  if (action.type === 'echec') {
    let jet = mettreEnEchec(m, piece, action.cible);
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    return appliquerEchec(m, piece, action.cible, jet);
  }
  if (action.type === 'ramasser') {
    let jet = ramasser(m, piece);
    if (ia && !jet.reussi) jet = relanceIA(m, cote, jet);
    return appliquerRamasser(m, piece, jet);
  }
  return false;
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

/** Le résultat d'un match : ce que le tournoi retient. */
export function resultatDe(m) {
  const fiche = eq => ({
    nom: eq.nom, tag: eq.tag, buts: eq.buts, tirs: eq.tirs,
    revirements: eq.revirements, echecs: eq.echecs,
    marqueurs: [...eq.fiches.values()].filter(f => f.buts || f.passes)
      .map(f => ({ p: f.p, buts: f.buts, passes: f.passes })),
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
  poser(eq);
  if (roleAvait) m.rondelle = { piece: eq.pieces.find(x => x.role === roleAvait) };
}

/** Vient-on de faire une mise au jeu ? (les cinq pièces sont à leur place de départ) */
export const auCentre = (m, cote) =>
  eqDe(m, cote).pieces.every(x => {
    const [r, c] = DEPART[cote][x.role];
    return x.r === r && x.c === c;
  });
