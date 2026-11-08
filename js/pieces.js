/*
 * LE BANC DE CINQ (V27, tranche 5 ; docs/refonte-v27.md § 4.6, docs/refonte-v27-5a.md). JP, 7 nov. 2026 : les pouvoirs du
 * coach, les adjoints et la main du deck fondus en cinq cases permanentes pour la run, sans séjour, repos ni salaire ; le
 * relais est le moteur des combos.
 *
 *   LA PIÈCE    une carte de jeu de la grammaire d'effet (js/effets.js) : sa condition (`quand`, lue période par
 *               période sur ce qui est déjà joué), ses canaux (`canaux` sur ton club, `adv` sur l'adversaire), sa
 *               réplique (`dit`, sans chiffre), son relais (`relais`). Aucun niveau : son `cadre` est celui du carton,
 *               pas une force. Elle joue chaque soir où sa condition se lit, jusqu'à ce que tu la remplaces.
 *   LE BANC     `CASES_DU_BANC` cases, pour toute la run : `perso.banc`, les clés dans l'ordre des cases.
 *   LE COACH    sa philosophie (`cle`), son vrai entraîneur (`chef`) et sa maîtrise (×0,9 à ×1,3, js/niveaux.js), qui
 *               règle sa seule pièce de départ (`PIECE_DU_COACH`), posée dans la première case. Plus d'expérience.
 *   LE RELAIS   une pièce qui se lit relaie le canal d'une autre : son signal (`relais.quand`) lit les pièces qui jouent
 *               la période (`e.pieces`), ou un relais allumé (`chaine`, le second maillon, jamais un troisième) ; son
 *               canal rejoue alors `RELAIS_NIV` fois son écart, la période même.
 *
 * LA PRÉSENCE (devis § 4.6) : un adjoint d'avant jouait 12 soirs sur 32 ; posée pour la run au même écart, une pièce aurait
 * valu 2,7 fois plus. Chaque pièce garde donc l'écart d'un soir (pour qu'elle se voie) et sa condition est réglée pour
 * jouer 30 à 50 % des soirs (`check_pouvoirs`) ; une pièce d'un moment rare (`rare`, les séries, le gros match) en est
 * exemptée, et `check_moments_si` la fait revenir.
 *
 * Pur : le moteur (par js/greffes.js), l'écran et les robots lisent la même table et les mêmes fonctions.
 */
import { hache } from './util.js';
import { VOIES } from './coachs.js';

export const CASES_DU_BANC = 5;
export const PIECES_OFFERTES = 3;
/* Une fourche d'histoire donne une pièce au plus, et deux au plus dans la saison (devis § 4.6). */
export const PIECES_PAR_SAISON_DES_FOURCHES = 2;
/* Le relais rejoue l'écart de son canal à cette force (celle du Pilier d'avant : une pièce n'a pas de niveau). */
export const RELAIS_NIV = 0.75;

/* `quand(e)` : se lit-elle avant la période `e.k` ? `e` : { k, moi, lui, tirsMoi, tirsLui, der, series, gros, soir, pieces, relais }. */
const k3 = e => e.k === 2;
const mene = e => e.moi > e.lui;
const derriere = e => e.moi < e.lui;
const serre = e => Math.abs(e.moi - e.lui) <= 1;
const perduAuxTirs = e => !!e.der && e.der.tirsMoi < e.der.tirsLui;
const soirDe = (e, ...ms) => !!e.soir && ms.some(m => e.soir[m]);
/* À domicile, ou à l'étranger, un soir sans dos-à-dos (41 soirs sur 82 en tout : la présence se règle sous la moitié). */
const chez = e => soirDe(e, 'domicile') && !soirDe(e, 'dosADos');
const ailleurs = e => soirDe(e, 'visiteur') && !soirDe(e, 'dosADos');
/* Le signal d'un relais : une autre pièce joue la période, ou une autre relaie (le second maillon). */
const uneAutre = cle => e => (e.pieces || []).some(x => x !== cle);
const unRelais = cle => e => (e.relais || []).some(x => x !== cle);

/*
 * LA FAMILLE (trente-trois pièces). Les vingt-quatre pouvoirs des huit coachs (I, II, l'ultime : leurs canaux et leur
 * condition, réglée à la présence) et les neuf adjoints (leur style d'un soir, leur relais) ; les idées du plan du soir
 * (tirer, fermer, coller, forechecker, rester discipliné) y sont déjà : le canonnier, le mur, le cogneur, le moine. Le
 * plan du soir lui-même est parti à la tranche 6b. `voie` : la philosophie qui l'offre d'abord (null : personne) ; `soir` : sa
 * condition est celle de la soirée entière (elle se lit par match) ; `genre` : la couleur de sa carte.
 */
export const PIECES = {
  /* ---------- le Frelon ---------- */
  ruee: { voie: 'essaim', cadre: 2, genre: 'attaque', ico: '🐝', nom: 'La ruée', quandMot: 'En 3e, à égalité ou derrière d\'un but',
    dit: 'Tout le monde au filet. On ne rentre pas au vestiaire avec des rondelles dans les poches.',
    quand: e => k3(e) && e.moi <= e.lui && e.lui - e.moi <= 1, canaux: { volume: 1.4 } },
  bourdon: { voie: 'essaim', cadre: 3, genre: 'attaque', ico: '🔊', nom: 'Le bourdonnement', quandMot: 'En 3e, quand tu mènes',
    dit: 'On mène ? Tant mieux. On continue de tirer, qu\'ils passent la période dans leur zone.',
    quand: e => k3(e) && mene(e), canaux: { volume: 1.3 } },
  essaim: { voie: 'essaim', cadre: 4, genre: 'attaque', ico: '🌪', nom: 'L\'essaim', quandMot: 'En 3e, derrière',
    dit: 'Cinq gars au filet, des rebonds partout. Leur gardien va voir des abeilles.',
    quand: e => k3(e) && derriere(e), canaux: { volume: 1.35, finition: 1.05 } },
  /* ---------- l'Aigle ---------- */
  riposte: { voie: 'rapaces', cadre: 2, genre: 'attaque', ico: '🦅', nom: 'La riposte', quandMot: 'Après une période perdue aux tirs, à deux buts près',
    dit: 'Ils ont eu la rondelle ? Correct. La prochaine qu\'on touche, elle rentre.',
    quand: e => perduAuxTirs(e) && Math.abs(e.moi - e.lui) <= 2, canaux: { finition: 1.28 } },
  tueur: { voie: 'rapaces', cadre: 3, genre: 'attaque', ico: '🗡', nom: 'Le tueur', quandMot: 'En 2e ou en 3e, en avance d\'un seul but',
    dit: 'Un but d\'avance, c\'est rien. Deux, c\'est un match. Va chercher le deuxième.',
    quand: e => e.k > 0 && e.moi - e.lui === 1, canaux: { finition: 1.3 } },
  parfait: { voie: 'rapaces', cadre: 4, genre: 'attaque', ico: '🎯', nom: 'Le tir parfait', quandMot: 'En 3e, à égalité ou derrière d\'un but',
    dit: 'Un tir. Le bon. Dans le haut du filet, côté bouclier.',
    quand: e => k3(e) && e.moi <= e.lui && e.lui - e.moi <= 1, canaux: { finition: 1.45 } },
  /* ---------- la Tortue ---------- */
  verrou: { voie: 'tortue', cadre: 2, genre: 'defense', ico: '🐢', nom: 'Le verrou', quandMot: 'En 2e ou en 3e, en avance d\'un ou deux buts',
    dit: 'On a le but. Maintenant, on ferme la porte et on jette la clé.',
    quand: e => e.k > 0 && e.moi > e.lui && e.moi - e.lui <= 2, canaux: { defense: 0.85 } },
  tranchee: { voie: 'tortue', cadre: 3, genre: 'defense', ico: '⛏', nom: 'La tranchée', quandMot: 'En 1re, à l\'étranger, sans dos-à-dos',
    dit: 'Leur foule veut un but en partant. On va leur faire attendre longtemps.',
    quand: e => e.k === 0 && ailleurs(e), adv: { volume: 0.75 } },
  forteresse: { voie: 'tortue', cadre: 4, genre: 'defense', ico: '🏰', nom: 'La forteresse', quandMot: 'En 3e, quand tu mènes',
    dit: 'Vingt minutes. Personne dans l\'enclave, personne derrière nous.',
    quand: e => k3(e) && mene(e), canaux: { defense: 0.7 }, adv: { volume: 0.8 } },
  /* ---------- le Rhino ---------- */
  usure: { voie: 'rhinos', cadre: 2, genre: 'tactique', ico: '🦏', nom: 'L\'usure', quandMot: 'En 3e, à égalité ou derrière d\'un but',
    dit: 'On les a frappés deux périodes. Regarde leurs jambes : c\'est maintenant que ça paie.',
    quand: e => k3(e) && e.moi <= e.lui && e.lui - e.moi <= 1, canaux: { robustesse: 3.1 }, adv: { finition: 0.9 } },
  choc: { voie: 'rhinos', cadre: 3, genre: 'tactique', ico: '💥', nom: 'Le choc', quandMot: 'En 1re, à domicile, sans dos-à-dos',
    dit: 'La première présence, tu finis ta mise en échec. La foule va s\'occuper du reste.',
    quand: e => e.k === 0 && chez(e), canaux: { robustesse: 2.8 }, adv: { finition: 0.94 } },
  charge: { voie: 'rhinos', cadre: 4, genre: 'attaque', ico: '🐂', nom: 'La charge', quandMot: 'En 3e, derrière',
    dit: 'On défonce la porte. Au filet, et fort.',
    quand: e => k3(e) && derriere(e), canaux: { volume: 1.25, robustesse: 1 }, adv: { finition: 0.88 } },
  /* ---------- le Doc ---------- */
  souffle: { voie: 'souffle', cadre: 2, genre: 'defense', ico: '🫁', nom: 'Le second souffle', quandMot: 'En 3e, un soir de dos-à-dos ou de jambes lourdes',
    dit: 'Ils sont aussi brûlés que nous. La différence, c\'est qu\'on s\'est préparés pour ça.',
    quand: e => k3(e) && soirDe(e, 'dosADos', 'jambesLourdes'), canaux: { volume: 1.2, defense: 0.78 } },
  rotation: { voie: 'souffle', cadre: 3, genre: 'defense', ico: '🩺', nom: 'La rotation', quandMot: 'À l\'étranger, sans dos-à-dos', soir: true,
    dit: 'Des présences courtes, on ne force personne. Personne ne revient de voyage sur une civière.',
    quand: ailleurs, canaux: { blessure: 0.6 } },
  resurrection: { voie: 'souffle', cadre: 4, genre: 'attaque', ico: '⚡', nom: 'La résurrection', quandMot: 'En 3e, derrière',
    dit: 'Le match n\'est pas fini tant que la sirène n\'a pas sonné. Debout.',
    quand: e => k3(e) && derriere(e), canaux: { volume: 1.4, finition: 1.25 } },
  /* ---------- l'Abbé ---------- */
  sangfroid: { voie: 'choeur', cadre: 2, genre: 'tactique', ico: '😇', nom: 'Le sang-froid', quandMot: 'En 2e ou en 3e, à égalité',
    dit: 'Le match se joue maintenant. Les bâtons en bas, les mains propres.',
    quand: e => e.k > 0 && e.moi === e.lui, canaux: { discipline: 0.55 } },
  provocation: { voie: 'choeur', cadre: 3, genre: 'tactique', ico: '📢', nom: 'La provocation', quandMot: 'En 3e, quand tu mènes',
    dit: 'Un sourire, un petit mot. Ils vont s\'énerver, et c\'est nous qui allons jouer en avantage.',
    quand: e => k3(e) && mene(e), adv: { discipline: 1.45 } },
  miracle: { voie: 'choeur', cadre: 4, genre: 'synergie', ico: '✨', nom: 'Le miracle', quandMot: 'En 3e, à égalité ou en avance d\'un but',
    dit: 'Calmes. Personne au banc des punitions. Le but va venir.',
    quand: e => k3(e) && e.moi >= e.lui && e.moi - e.lui <= 1, canaux: { finition: 1.3, discipline: 0.5 } },
  /* ---------- le Contremaître ---------- */
  quatre: { voie: 'profondeur', cadre: 2, genre: 'defense', ico: '🪜', nom: 'Les quatre trios', quandMot: 'En 2e ou en 3e, à égalité',
    dit: 'Le quatrième trio saute sur la glace comme le premier. C\'est comme ça qu\'on gagne en troisième.',
    quand: e => e.k > 0 && e.moi === e.lui, canaux: { F: [0.8, 0.95, 1.2, 1.45], defense: 0.82 } },
  atelier: { voie: 'profondeur', cadre: 3, genre: 'defense', ico: '🛠', nom: 'L\'atelier', quandMot: 'Un soir de dos-à-dos ou de jambes lourdes', soir: true,
    dit: 'On a regardé la vidéo dans l\'autobus. Chacun sait où aller.',
    quand: e => soirDe(e, 'dosADos', 'jambesLourdes'), canaux: { volume: 1.12, defense: 0.93 } },
  releve: { voie: 'profondeur', cadre: 4, genre: 'attaque', ico: '🔄', nom: 'La relève', quandMot: 'En 3e, derrière',
    dit: 'Tout le monde joue, tout le monde pousse. On roule les quatre trios jusqu\'au bout.',
    quand: e => k3(e) && derriere(e), canaux: { F: [0.8, 0.95, 1.2, 1.45], volume: 1.35, finition: 1.1 } },
  /* ---------- le Showman ---------- */
  spectacle: { voie: 'etoiles', cadre: 2, genre: 'attaque', ico: '🌠', nom: 'Le spectacle', quandMot: 'En 3e, à un but près, sans dos-à-dos',
    dit: 'Les vedettes sur la glace. C\'est pour ça que les gens ont payé leur billet.',
    quand: e => k3(e) && serre(e) && !soirDe(e, 'dosADos'), canaux: { F: [1.4, 1, 0.85, 0.75], finition: 1.32 } },
  duo: { voie: 'etoiles', cadre: 3, genre: 'attaque', ico: '🎭', nom: 'Le duo vedette', quandMot: 'En 1re, à domicile, sans dos-à-dos',
    dit: 'Devant notre monde, le premier trio ouvre le bal.',
    quand: e => e.k === 0 && chez(e), canaux: { F: [1.15, 1, 0.92, 0.88], finition: 1.35 } },
  grandsoir: { voie: 'etoiles', cadre: 4, genre: 'attaque', ico: '🎬', nom: 'Le grand soir', quandMot: 'En séries ou en gros match', rare: true,
    dit: 'Les grands joueurs sortent les grands soirs. Ce soir, c\'est un grand soir.',
    quand: e => e.series || e.gros, canaux: { finition: 1.25 } },
  /* ---------- les adjoints d'avant : un style d'un soir, et son relais ---------- */
  canonnier: { voie: 'essaim', cadre: 1, genre: 'attaque', ico: '🏹', nom: 'Le canonnier', quandMot: 'À domicile, sans dos-à-dos', soir: true,
    dit: 'Une rondelle sur la palette, c\'est une rondelle au filet. On comptera après.',
    quand: chez, canaux: { volume: 1.18, finition: 0.95 }, adv: { volume: 1.03 },
    relais: { mot: 'Quand une autre pièce joue', quand: uneAutre('canonnier'), sur: 'piece', cote: 'canaux', canal: 'volume' } },
  lunette: { voie: 'rapaces', cadre: 1, genre: 'attaque', ico: '🔭', nom: 'Le tireur d\'élite', quandMot: 'À l\'étranger, sans dos-à-dos', soir: true,
    dit: 'Un bon tir vaut trois mauvais. On attend l\'ouverture, et on la prend.',
    quand: ailleurs, canaux: { finition: 1.15, volume: 0.88 },
    relais: { mot: 'Quand une autre pièce joue', quand: uneAutre('lunette'), sur: 'piece', cote: 'canaux', canal: 'finition' } },
  mur: { voie: 'tortue', cadre: 1, genre: 'defense', ico: '🧱', nom: 'Le mur', quandMot: 'Après une défaite', soir: true,
    dit: 'Personne ne traverse la ligne bleue debout. Le reste, c\'est du détail.',
    quand: e => soirDe(e, 'apresDefaite'), canaux: { volume: 0.9 }, adv: { volume: 0.86 },
    relais: { mot: 'Derrière au pointage', quand: derriere, cote: 'adv', canal: 'volume' } },
  cogneur: { voie: 'rhinos', cadre: 1, genre: 'tactique', ico: '🏋', nom: 'Le cogneur', quandMot: 'À l\'étranger, sans dos-à-dos', soir: true,
    dit: 'Finis tes mises en échec. Ils vont lever la tête, et c\'est là qu\'ils vont rater.',
    quand: ailleurs, canaux: { robustesse: 1.6, discipline: 1.4 }, adv: { finition: 0.98 },
    relais: { mot: 'Après une période perdue aux tirs', quand: perduAuxTirs, cote: 'canaux', canal: 'robustesse' } },
  preparateur: { voie: 'souffle', cadre: 1, genre: 'defense', ico: '🏃', nom: 'Le préparateur', quandMot: 'Un soir de dos-à-dos ou de jambes lourdes', soir: true,
    dit: 'Des présences courtes, du repos, de l\'eau. On ne gagne rien à l\'infirmerie.',
    quand: e => soirDe(e, 'dosADos', 'jambesLourdes'), canaux: { blessure: 0.6, energie: 0.85, volume: 0.95 },
    relais: { mot: 'Un soir de dos-à-dos, de jambes lourdes ou d\'infirmerie pleine', quand: e => soirDe(e, 'dosADos', 'jambesLourdes', 'infirmerie'), cote: 'canaux', canal: 'blessure' } },
  moine: { voie: 'choeur', cadre: 1, genre: 'tactique', ico: '🧘', nom: 'Le moine', quandMot: 'Après trois victoires ou un soir de dos-à-dos', soir: true,
    dit: 'Les bâtons sur la glace, la bouche fermée. L\'arbitre ne nous verra pas de la soirée.',
    quand: e => soirDe(e, 'enFeu', 'dosADos'), canaux: { discipline: 0.7, robustesse: -1, volume: 0.97 },
    relais: { mot: 'Derrière au pointage', quand: derriere, cote: 'canaux', canal: 'discipline' } },
  rouleur: { voie: 'profondeur', cadre: 1, genre: 'tactique', ico: '🔁', nom: 'Le rouleur', quandMot: 'Après une défaite', soir: true,
    dit: 'Tout le monde joue, tout le monde est frais en troisième. C\'est là que ça se gagne.',
    quand: e => soirDe(e, 'apresDefaite'), canaux: { F: [0.82, 1, 1.1, 1.2], blessure: 0.7 }, adv: { volume: 0.92 },
    relais: { mot: 'Un soir de dos-à-dos, chaque période', quand: e => soirDe(e, 'dosADos'), cote: 'adv', canal: 'volume' } },
  vedettiste: { voie: 'etoiles', cadre: 1, genre: 'attaque', ico: '🎤', nom: 'Le vedettiste', quandMot: 'À domicile, sans dos-à-dos', soir: true,
    dit: 'On paie des vedettes pour qu\'elles jouent. Mets-les sur la glace et laisse-les faire.',
    quand: chez, canaux: { F: [1.15, 1, 0.94, 0.88], finition: 1.06, blessure: 1.3 }, adv: { volume: 1.08 },
    relais: { mot: 'À domicile, chaque période', quand: e => soirDe(e, 'domicile'), cote: 'canaux', canal: 'finition' } },
  // L'ANCIEN ARBITRE (V23 ; JP : *a coach or assistant that was a ref*) : hors des huit voies, le second maillon de la chaîne.
  arbitre: { voie: null, cadre: 2, genre: 'synergie', ico: '🦓', nom: 'L\'ancien arbitre', quandMot: 'À l\'étranger, sans dos-à-dos', soir: true,
    dit: 'J\'ai sifflé vingt ans dans cette ligue. Je sais ce qu\'ils regardent, et ce qu\'ils ne regardent pas.',
    quand: ailleurs, canaux: { discipline: 0.8 }, adv: { discipline: 1.15 },
    relais: { mot: 'Quand une autre pièce relaie', quand: unRelais('arbitre'), chaine: true, cote: 'adv', canal: 'discipline' } },
};
/* La pièce de départ de chaque coach : le premier pouvoir de sa philosophie, à sa maîtrise ; leur coach en séries la joue aussi. */
export const PIECE_DU_COACH = { essaim: 'ruee', rapaces: 'riposte', tortue: 'verrou', rhinos: 'usure', souffle: 'souffle', choeur: 'sangfroid', profondeur: 'quatre', etoiles: 'spectacle' };

/* ---------- le banc ---------- */
/* Le banc d'un personnage, propre : ses pièces connues, dans l'ordre des cases. */
export const bancDe = perso => ((perso && perso.banc) || []).filter(k => PIECES[k]).slice(0, CASES_DU_BANC);
/* La force d'une pièce sur ce banc : la maîtrise de l'entraîneur pour sa pièce de départ, 1 pour les autres. */
export const forceDeLaPiece = (perso, cle) => (perso && cle === PIECE_DU_COACH[perso.cle] ? Math.min(1.3, Math.max(0.9, Number(perso.maitrise) || 1)) : 1);
/*
 * POSER UNE PIÈCE : elle entre dans la première case libre ; le banc plein, elle prend la case de `sort` (qui part) ;
 * déjà là, ou plein sans `sort` sur le banc, rien ne bouge. Rend le banc.
 */
export function poserLaPiece(banc, cle, sort = null) {
  const b = (banc || []).filter(k => PIECES[k]).slice(0, CASES_DU_BANC);
  if (!PIECES[cle] || b.includes(cle)) return b;
  if (b.length < CASES_DU_BANC) return [...b, cle];
  const i = b.indexOf(sort);
  return i < 0 ? b : b.map((k, j) => (j === i ? cle : k));
}
/* Le banc est-il plein ? Alors une pièce neuve demande celle qui sort. */
export const bancPlein = perso => bancDe(perso).length >= CASES_DU_BANC;
/*
 * LES PIÈCES OFFERTES (une parmi trois), tirées de la graine parmi celles qui ne sont pas déjà sur le banc. `cle` : le
 * moment (le rival battu, le nœud de la boutique, la fourche) ; deux moments n'offrent pas les mêmes. `voisines` (le rival
 * battu) : les pièces de la philosophie du coach et de ses deux voisines dans `VOIES`, plus celles hors des voies.
 */
export function piecesOffertes(perso, graine, cle, n = PIECES_OFFERTES, { voisines = false } = {}) {
  const pris = new Set(bancDe(perso)), i = perso ? VOIES.indexOf(perso.cle) : -1;
  const proches = i < 0 ? null : new Set([VOIES[i], VOIES[(i + 1) % VOIES.length], VOIES[(i + VOIES.length - 1) % VOIES.length]]);
  return Object.keys(PIECES).filter(k => !pris.has(k) && (!voisines || !proches || !PIECES[k].voie || proches.has(PIECES[k].voie)))
    .sort((a, b) => hache(String(graine), 'piece', cle, a) - hache(String(graine), 'piece', cle, b)).slice(0, n);
}

/* ---------- le jeu d'une période ---------- */
/* Un effet grandi : chaque canal s'écarte de 1 (ou de 0, la robustesse) `f` fois plus. */
export function grandir(effet, f) {
  if (!effet) return null;
  const out = {};
  for (const [k, v] of Object.entries(effet)) {
    if (Array.isArray(v)) out[k] = v.map(x => 1 + (x - 1) * f);
    else if (k === 'robustesse') out[k] = v * f;
    else out[k] = Math.max(0.05, 1 + (v - 1) * f);
  }
  return out;
}
/* Ce que le relais d'une pièce ajoute : { cote, canal, valeur } (son canal à `RELAIS_NIV` fois son écart), ou null. */
export function effetDuRelais(cle) {
  const P = PIECES[cle];
  if (!P || !P.relais) return null;
  const { cote, canal } = P.relais, v = P[cote] ? P[cote][canal] : null;
  if (v == null) return null;
  return { cote, canal, valeur: Array.isArray(v) ? v.map(x => 1 + (x - 1) * RELAIS_NIV) : canal === 'robustesse' ? v * RELAIS_NIV : 1 + (v - 1) * RELAIS_NIV };
}
/*
 * LES PIÈCES DE LA SOIRÉE, pur : celles dont la condition est la soirée entière (`soir` : à domicile, après une défaite…),
 * lues avant le match sur ses moments (`e`, la période 0). Elles jouent le match entier comme un style d'un soir (le temps
 * du match : leurs minutes et leurs jambes comprises), à leur force. Rend [{ cle, P, canaux, adv }].
 */
export function bancDuSoir(perso, e) {
  if (!perso || perso.adverse) return [];
  return bancDe(perso).filter(k => PIECES[k].soir && PIECES[k].quand(e)).map(k => {
    const P = PIECES[k], f = forceDeLaPiece(perso, k);
    return { cle: k, P, canaux: grandir(P.canaux, f), adv: grandir(P.adv, f) };
  });
}
/*
 * LE BANC D'UNE PÉRIODE, pur : les autres pièces, dont la condition se lit avant la période `e.k`, chacune à sa force, puis
 * les relais — d'abord les signaux qui lisent le match et les pièces qui jouent (celles de la soirée, `soir`, comprises),
 * puis ceux qui lisent un relais allumé (`chaine`) ; jamais un troisième. Leur coach en séries (`adverse`) : sa pièce, ou
 * son ombre (`OMBRE`) hors de sa condition. `perso.sansRelais` (la mesure seulement, jamais posé par le jeu) : aucun relais.
 * Rend { pieces: [{ cle, P, canaux, adv, ombre? }], relais: [{ cle, P, sur, maillon, cote, canal, valeur }] }.
 */
export function bancDeLaPeriode(perso, e, soir = []) {
  if (!perso) return { pieces: [], relais: [] };
  if (perso.adverse) {
    const cle = PIECE_DU_COACH[perso.cle], P = PIECES[cle];
    if (!P) return { pieces: [], relais: [] };
    const joue = P.quand(e), f = (joue ? 1 : -OMBRE) * (perso.maitrise || 1);
    return { pieces: [{ cle, P, ombre: !joue, canaux: grandir(P.canaux, f), adv: grandir(P.adv, f) }], relais: [] };
  }
  const banc = bancDe(perso);
  const pieces = banc.filter(k => !PIECES[k].soir && PIECES[k].quand(e)).map(k => {
    const P = PIECES[k], f = forceDeLaPiece(perso, k);
    return { cle: k, P, canaux: grandir(P.canaux, f), adv: grandir(P.adv, f) };
  });
  const relais = [];
  if (perso.sansRelais) return { pieces, relais };
  const jouent = [...soir.map(x => ({ cle: x.cle, P: PIECES[x.cle] })), ...pieces];
  const env = { ...e, pieces: jouent.map(x => x.cle), relais: [] };
  const lire = (k, env2) => {
    const P = PIECES[k], fx = P.relais && P.relais.quand(env2) ? effetDuRelais(k) : null;
    if (!fx) return;
    const premier = relais[0], par = jouent.find(x => x.cle !== k);
    const sur = P.relais.chaine && premier ? { genre: 'relais', cle: premier.cle, ico: premier.P.ico, nom: premier.P.nom }
      : P.relais.sur === 'piece' && par ? { genre: 'piece', cle: par.cle, ico: par.P.ico, nom: par.P.nom } : { genre: 'moment', nom: P.relais.mot };
    relais.push({ cle: k, P, sur, maillon: P.relais.chaine ? 2 : 1, ...fx });
  };
  for (const k of banc) if (PIECES[k].relais && !PIECES[k].relais.chaine) lire(k, env);
  const allumes = relais.map(x => x.cle);
  for (const k of banc) if (PIECES[k].relais && PIECES[k].relais.chaine) lire(k, { ...env, relais: allumes });
  return { pieces, relais };
}

/*
 * LEUR COACH EN SÉRIES (V23 F ; JP : *plus organique de pas choisir*). En séries, l'adversaire a un coach-personnage, sa
 * philosophie lue sur le style du club (`t.style`, js/sim.js `poserStyles`), ou tirée pure de son nom, et une seule pièce,
 * la première de sa philosophie (`PIECE_DU_COACH`) ; hors de sa condition, elle joue son OMBRE, l'écart inverse à
 * `OMBRE` fois : neutre en V sur une saison. Pur, jamais de banc à lui.
 */
export const COACH_DU_STYLE = { offensif: 'essaim', defensif: 'tortue', robuste: 'rhinos' };
const AUTRES_COACHS = ['rapaces', 'souffle', 'choeur', 'profondeur', 'etoiles'];
export const OMBRE = 0.5;
export function persoAdverse(team) {
  const cle = COACH_DU_STYLE[team.style] || AUTRES_COACHS[Math.floor(hache(String(team.tag || ''), String(team.season || ''), 'leur coach') * AUTRES_COACHS.length)];
  return { cle, banc: [], maitrise: 1, adverse: true };
}
