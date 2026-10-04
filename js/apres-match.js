/**
 * LE RÉCIT D'APRÈS-MATCH.
 *
 * Un résumé de match comme à la télé : sobre, précis, détaillé. Le fil du match
 * période par période, les gardiens, les unités spéciales, la discipline, les
 * incidents, les étoiles. Le ton du commentateur est plat ; ce qui peut être
 * drôle, ce sont les incidents eux-mêmes (une rondelle reçue là où ça fait
 * mal), jamais la façon de les dire.
 *
 * LA RÈGLE DE CE FICHIER (la même que js/recit.js) : il ne décide de RIEN. Le
 * moteur a joué le match ; ici on lit la feuille et on met des mots dessus.
 * Chaque nombre, chaque nom et chaque instant vient de la feuille, jamais d'un
 * texte écrit à la main. Un incident ne s'attache qu'à un événement réel de la
 * feuille (blessure, punition, coup, bagarre, mêlée), au joueur de cet
 * événement : il n'invente ni but, ni punition, ni blessure. Que l'incident
 * soit raconté ou non, c'est le hasard déterministe : la même feuille, le même
 * contexte et la même graine redonnent exactement le même texte.
 * Les infractions des punitions, que la feuille ne détaille pas, se tirent
 * d'une banque d'infractions mineures de deux minutes.
 *
 * Le retour : { titre, resume[], lignes[], sections[{ titre, lignes[] }] }.
 * `resume` (5 à 8 lignes, comme un segment de télé sportive : manchette, tournant,
 * étoiles, à noter, contexte) est ce que l'écran montre ; `sections` est le fil
 * complet, pour un tiroir. `lignes` est `sections` à plat. Au plus 25 lignes ; quand il y en a
 * trop, les détails les moins utiles tombent d'abord (coups, mêlées, incidents).
 *
 * `ctx` (tout est facultatif) : { eq, autre, cote ('A' par défaut : le côté de
 * `eq`), fiche: { v, d, pr } la fiche de `eq` après ce match }. La série se
 * lit sur la feuille (`serie`, de la forme « 3-1 » du point de vue de A).
 */

import { nomCourt, tempsRestant, NOM_PERIODE } from './recit.js';
import { cap, pct3 } from './util.js';

/* ---------- le tirage déterministe (la même mécanique que js/recit.js) ---------- */
function graine(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

const MAX_LIGNES = 25;
const MAX_BUTS_UN_PAR_UN = 7;
const MAX_INCIDENTS = 5;
const CHANCE = { blessure: 0.8, punition: 0.14, coup: 0.12, bagarre: 0.45, melee: 0.3 };

/* ---------- les banques de phrases du récit (assemblées, jamais des chiffres écrits) ---------- */

const ENTREE_NORMALE = ['{W} bat {L} {s}.', "{W} l'emporte {s} contre {L}.", "{L} s'incline {s} devant {W}.", '{W} signe une victoire de {s} aux dépens de {L}.'];
const ENTREE_NETTE = ["{W} l'emporte nettement, {s}, contre {L}.", '{W} bat {L} {s} dans un match à sens unique.', "{L} s'incline lourdement, {s}, devant {W}."];
const ENTREE_BLANCHI = ['{W} blanchit {L} {s}.', "{W} l'emporte {s} et ne laisse aucun but à {L}.", 'Blanchissage : {W} gagne {s} contre {L}.'];
const ENTREE_PROLONGATION = ['{W} bat {L} {s} en prolongation.', "{W} l'emporte {s} en prolongation contre {L}.", 'Il a fallu la prolongation : {W} gagne {s} contre {L}.'];

const TIRS_DOMINE = ['{X} a dominé aux tirs, {a}-{b}.', "{X} a tiré {a} fois contre {b} pour l'autre club.", 'Aux tirs, {X} a eu le dessus, {a}-{b}.'];
const TIRS_DOMINE_PERDU = ['{X} a pourtant dominé aux tirs, {a}-{b}.', "{X} a lancé davantage, {a}-{b}, sans que cela se traduise au pointage.", 'Aux tirs, {X} menait {a}-{b}, et ce n\'est pas ce qui a décidé.'];
const TIRS_EGAUX = ['Les deux clubs ont tiré {a} fois chacun.', 'Autant de tirs de chaque côté : {a}.'];

const REMONTEE = ["{W} a comblé un retard de {n} buts pour l'emporter.", "{W} tirait de l'arrière de {n} buts avant de renverser la situation.", "{L} avait pourtant mené de {n} buts."];

const VERBES_OUVRE = ['ouvre la marque pour {T}', 'inscrit le premier but du match, pour {T}', 'donne les devants à {T}'];
const VERBES_AVANCE = ["donne l'avance à {T}, {s}", 'met {T} en avant, {s}', 'place {T} en tête, {s}'];
const VERBES_EGALISE = ['égalise pour {T}, {s}', 'ramène les deux clubs à égalité, {s}', "redonne l'égalité à {T}, {s}"];
const VERBES_REDUIT = ["réduit l'écart à {s}", 'marque pour {T} et réduit l\'écart à {s}', 'ramène {T} dans le match, {s}'];
const VERBES_ALLONGE = ["porte l'avance de {T} à {s}", "creuse l'écart pour {T}, {s}", 'ajoute un but pour {T}, {s}'];
const VERBES_PROLONGATION = ['inscrit le but gagnant en prolongation et donne la victoire à {T}', 'met fin au match en prolongation, le but gagnant pour {T}', 'règle le sort du match en prolongation, un but gagnant pour {T}'];
const DOUBLE = ['Son deuxième but du match.', 'Il en est à deux buts dans ce match.', "C'est son deuxième de la soirée."];
const CHAPEAU = ['Il complète un tour du chapeau.', 'Troisième but du match pour lui : le tour du chapeau.'];
const MARQUE_GAGNANT = ["C'est le but gagnant.", 'Ce but est le gagnant.', 'Il s\'agit du but gagnant.'];
const MARQUE_ASSURANCE = ["Un but d'assurance.", "Ce but d'assurance ferme la porte."];
const GARDIEN_BATTU = ['aux dépens de {G}', 'battant {G}', 'devant {G}'];
const PASSE_UNE = ['sur une passe de {a}', 'avec l\'aide de {a}'];
const PASSE_DEUX = ['sur des passes de {a} et {b}', 'aidé de {a} et {b}', 'avec {a} et {b} aux passes'];
const SANS_AIDE = ['sans aide', 'en solo'];

const GARDIEN_BLANCHI = ["{G} ({T}) a blanchi l'adversaire : {n} arrêts.", '{G} ({T}) signe un blanchissage avec {n} arrêts.', 'Blanchissage pour {G} ({T}), qui a repoussé les {n} tirs.'];
const GARDIEN_NORMAL = ['{G} ({T}) a repoussé {n} des {t} tirs ({pct}).', '{G} ({T}) : {n} arrêts sur {t} tirs, pour {pct}.', '{G} ({T}) a fait {n} arrêts sur {t} tirs ({pct}).'];
const GARDIEN_SOLIDE = ['Il a gardé son équipe dans le match.', 'Sa solidité a gardé {T} dans le match.'];
const GARDIEN_DUR = ['Une soirée difficile devant le filet.', 'Il n\'a pas trouvé son rythme ce soir.'];

const INFRACTIONS = ['accrochage', 'obstruction', 'bâton élevé', 'rudesse', 'croc-en-jambe', 'retenue', 'double échec', 'conduite antisportive', 'retard de jeu', 'mise en échec avec le coude'];

const ETOILES_ENTREE = ['Les trois étoiles du match', 'Les étoiles de la soirée', 'Trois étoiles'];

/* ---------- les incidents : une phrase de reportage par événement réel de la feuille ---------- */
// {j} le joueur de l'événement ; {c} sa cible (un coup) ; {w} le gagnant et {l} le perdant d'une bagarre ; {a} et {b} les deux joueurs.

const INC_BLESSURE = [
  "{j} se prend une rondelle en plein dans les bijoux de famille et plie en deux sur la glace",
  "{j} bloque un tir avec les gosses, une décision qu'il regrette sur-le-champ",
  "{j} reçoit un lancer frappé là où le protecteur ne protège pas assez",
  "{j} met son patin dans la mauvaise direction et le genou suit un peu plus loin que prévu",
  "{j} est fauché par son propre coéquipier, qui visait pourtant un joueur adverse",
  "{j} percute son propre gardien devant le filet et ressort de la collision en moins bon état que lui",
  "{j} casse son bâton au pire moment, tombe de tout son long et atterrit sur le poignet",
  "{j} perd un lacet en pleine accélération et termine sa course dans la bande",
  "{j} reçoit un bout de bâton en plein visage quand un adversaire casse le sien",
  "{j} glisse en sautant par-dessus la bande et atterrit sur le dos, devant son propre banc",
  "{j} se coince la main dans la porte du banc, un détail que les statistiques ne retiendront pas",
  "{j} reçoit une rondelle sur le pied, au seul endroit que le patin ne couvre pas",
  "{j} s'enfarge dans son propre bâton et file tête première vers la bande",
  "{j} reçoit un tir de la pointe directement sur l'orteil",
  "{j} se fait écraser la jambe entre la bande et un joueur de deux cent vingt livres",
  "{j} retombe sur l'épaule après avoir sauté pour éviter un tir, un saut qui n'était pas nécessaire",
  "{j} s'étire pour attraper une rondelle en l'air, la rate et rattrape la glace avec le menton",
  "{j} entre dans le poteau à pleine vitesse, et le poteau n'a pas bougé",
  "{j} prend le patin d'un adversaire dans le mollet dans un amas de joueurs devant le filet",
  "{j} reçoit le bâton d'un coéquipier en pleine bouche pendant un échange devant le banc",
  "{j} se coince un doigt dans le gant d'un adversaire et ne le récupère pas intact",
  "{j} se fait frapper par un tir de son propre défenseur, à moins de trois mètres",
  "{j} reçoit une rondelle dans la gorge et quitte la glace en toussant",
  "{j} saute sur la glace sans attacher sa jugulaire, et la rondelle trouve la mâchoire",
  "{j} se fait tirer le chandail par un adversaire, tourne sur lui-même et retombe sur le genou",
  "{j} prend le bout d'un patin dans la cheville lors d'un jeu à la bande",
  "{j} recule sans regarder et rentre dans l'arbitre, qui s'en sort mieux que lui",
  "{j} fonce dans la bande à pleine vitesse après avoir raté sa mise en échec",
  "{j} ressent un claquement derrière la cuisse en démarrant et termine son virage au ralenti",
  "{j} reçoit un tir en plein sur la main, celle qui tenait le bâton",
  "{j} se fait casser le nez par un dégagement raté de son propre club",
];

const INC_PUNITION = [
  "{j} accroche un adversaire qui n'allait nulle part, et l'arbitre le remarque avant tout le monde",
  "{j} fait trébucher un joueur adverse qui patinait seul, sous les yeux des deux arbitres",
  "{j} jette son bâton en direction de la rondelle, qui était trop loin pour qu'il l'atteigne",
  "{j} dégage la rondelle par-dessus la baie vitrée, sans que personne l'ait demandé",
  "{j} retient le chandail d'un adversaire à deux mains, en le regardant dans les yeux",
  "{j} s'écroule au moindre contact, et l'arbitre siffle la simulation",
  "{j} lève son bâton trop haut en voulant s'étirer et accroche le casque de l'adversaire",
  "{j} donne un coup de bâton sur les jambes d'un adversaire, en se croyant à l'abri des regards",
  "{j} frappe un joueur par derrière près de la bande, à dix pieds de l'arbitre",
  "{j} s'attaque à un adversaire après le sifflet, ce qui n'était plus nécessaire",
  "{j} entre dans le gardien adverse comme s'il ne l'avait pas vu, et l'arbitre refuse d'y croire",
  "{j} conteste un appel de l'arbitre en gesticulant, ce qui lui vaut une punition de conduite antisportive",
  "{j} met la main sur la rondelle dans le cercle, un geste qui n'était prévu dans aucun système",
  "{j} agrippe le bâton d'un adversaire et ne le lâche pas, même quand l'arbitre le lui demande",
  "{j} fait un croc-en-jambe à un adversaire qui lui tournait le dos",
  "{j} donne un coup de coude à la tête d'un adversaire, sans le faire exprès, selon ses dires",
  "{j} obstrue un adversaire qui n'avait pas la rondelle, et ça se voyait depuis les gradins",
  "{j} fait voler son bâton jusqu'au banc adverse après un jeu qui ne lui plaisait pas",
  "{j} ne comprend pas ce qui lui vaut deux minutes, et l'arbitre le lui explique avec les doigts",
  "{j} termine son geste dans les jambes d'un adversaire en voulant s'étirer à la bande",
  "{j} projette un défenseur dans la bande avec un peu trop de conviction",
  "{j} remet le casque d'un adversaire en place, un peu trop fermement",
  "{j} s'acharne sur un adversaire déjà couché sur la glace, sous le regard de l'arbitre",
  "{j} bloque la route d'un adversaire en patinant dans la mauvaise direction, volontairement selon l'arbitre",
];

const INC_COUP = [
  "{j} écrase {c} contre la bande, et le bruit se rend jusqu'au banc adverse",
  "{c} cherche encore la rondelle après la mise en échec de {j}, qui est pourtant déjà à l'autre bout de la patinoire",
  "{c} fait connaissance avec la baie vitrée, présenté par {j}",
  "{j} projette {c} dans la bande avec une telle force que les gradins s'en ressentent",
  "{c} revient au banc en marchant de côté après le contact avec {j}",
  "{j} frappe {c} à pleine vitesse, et {c} regarde ce côté de la patinoire avec méfiance",
  "{c} vole sur trois mètres avant d'atterrir, après un contact avec {j}",
  "{j} passe son épaule dans {c}, et le casque de {c} termine sa course à la ligne bleue",
  "{c} voit des étoiles pendant quelques secondes après la mise en échec de {j}",
  "{j} ramasse {c} à la ligne rouge, et la rondelle est la dernière chose à laquelle {c} pense",
  "{c} perd son bâton, son équilibre et une partie de sa dignité sur la mise en échec de {j}",
  "{c} se retrouve assis sur la glace, face à la bande, après avoir croisé {j}",
  "{j} plaque {c} si fort sur la bande que le chandail y laisse une marque",
  "{c} ramasse son casque, ses gants et ses idées après le passage de {j}",
];

const INC_BAGARRE = [
  "{w} et {l} laissent tomber les gants ; {w} en sort avec le dernier mot et {l} avec un œil à surveiller",
  "{w} décoche trois coups avant que {l} ait fini d'enlever son gant",
  "{l} perd son casque, son bâton et la bagarre, dans cet ordre, contre {w}",
  "{w} tient {l} par le chandail et le laisse retomber sur la glace, au grand plaisir de son banc",
  "{l} termine à genoux sur la glace après un solide crochet de {w}",
  "{w} sort de la bagarre avec les jointures écorchées, {l} avec le chandail déchiré",
  "{w} retourne le chandail de {l} par-dessus sa tête, et {l} ne voit plus rien du reste",
  "{w} gagne par décision des deux juges, qui avaient une bonne vue de {l} par terre",
  "{w} aide {l} à se relever, non par bonté, mais pour lui montrer le chemin du banc",
  "{w} enchaîne un crochet et un uppercut, et {l} enchaîne un retour au banc",
  "{l} perd l'équilibre en lançant un coup dans le vide, et {w} n'a plus qu'à finir le travail",
  "{w} gagne le combat, et {l} gagne le droit de se faire raconter la suite par ses coéquipiers",
];

const INC_BAGARRE_NUL = [
  "{a} et {b} s'agrippent par le chandail pendant une minute complète, sans qu'un seul coup parte vraiment",
  "{a} et {b} laissent tomber les gants, se regardent, et restent debout jusqu'à l'arrivée des juges",
  "{a} et {b} tournent en rond au centre de la glace, sans rien de plus à déclarer",
  "{a} et {b} perdent leur casque en même temps, ce qui n'a rien réglé",
  "{a} et {b} s'échangent quelques coups de moulinet qui ne touchent que l'air",
  "{a} et {b} tombent ensemble sur la glace, et les juges concluent à l'absence de gagnant",
  "{a} et {b} se lancent des coups dans les épaules, les gants et le vide, et personne n'en sort gagnant",
  "{a} et {b} se font séparer avant d'avoir décidé qui avait raison",
];

const INC_MELEE = [
  "{a} et {b} se retrouvent au fond d'une pile de joueurs, et personne ne sait trop comment",
  "{a} et {b} se poussent devant le filet pendant que quatre autres joueurs tentent de comprendre pourquoi",
  "{a} et {b} échangent des politesses à la ligne bleue, les mains plus occupées que les mots",
  "{a} et {b} sont les derniers à comprendre que le jeu est arrêté",
  "{a} et {b} se poussent à la hauteur du banc, et le banc se lève par solidarité",
  "{a} et {b} s'accrochent au sifflet et ne se lâchent plus avant l'arrivée des juges",
];

const ABSENCE = ['Il manquera {n} {matchs}.', 'Absence prévue : {n} {matchs}.', 'Il sera absent {n} {matchs}.'];
const BLESSE_SANS_CAUSE = ['{j} ({T}) a quitté le match, {quand}. Il manquera {n} {matchs}.', 'Blessure à {j} ({T}), {quand} : absence prévue de {n} {matchs}.'];

/* ---------- les petits outils ---------- */
const pl = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const periodeDe = instant => (instant >= 60 ? 4 : Math.min(3, Math.floor(instant / 20) + 1));
const nomDe = p => (p && p.n ? nomCourt(p.n) : 'un joueur');
const ordinal = n => ['', 'premier', 'deuxième', 'troisième', 'quatrième', 'cinquième'][n] || `${n}e`;
const rempl = (texte, vals) => texte.replace(/\{(\w+)\}/g, (_, k) => (vals[k] == null ? `{${k}}` : String(vals[k])));
const somme = t => (t || []).reduce((x, y) => x + y, 0);
const tirsPeriode = (f, c, per) => (f.tirs && f.tirs[c] ? f.tirs[c][per] || 0 : 0);

/**
 * Le récit d'après-match : { titre, lignes[], sections[] }. Pure : même feuille,
 * même contexte, même graine = même texte. `ctx` : voir le haut du fichier.
 */
export function apresMatch(f, ctx = {}, graineDuMatch = '') {
  const nous = ctx.cote === 'B' ? 'B' : 'A';
  const eux = nous === 'A' ? 'B' : 'A';
  const nm = { [nous]: ctx.eq || 'le club', [eux]: ctx.autre || "l'adversaire" };
  const buts = (f.buts || []).slice().sort((x, y) => x.instant - y.instant);
  const gf = { A: f.gfA ?? buts.filter(b => b.cote === 'A').length, B: f.gfB ?? buts.filter(b => b.cote === 'B').length };
  const ot = f.ot === true || f.prolongation === true || buts.some(b => b.instant >= 60);
  const titre = `${nm[nous]} ${gf[nous]}, ${nm[eux]} ${gf[eux]}${ot ? ' (prolongation)' : ''}`;
  const vide = { titre, resume: [], lignes: [], sections: [] };
  if (gf.A === gf.B) return vide;

  const W = gf.A > gf.B ? 'A' : 'B';
  const L = W === 'A' ? 'B' : 'A';
  const seed = `${graineDuMatch}|${nous}|${nm.A}|${nm.B}|${gf.A}-${gf.B}|${buts.length}`;
  const alea = cle => graine(`${seed}|${cle}`);
  const pige = (liste, cle) => liste[Math.floor(alea(cle) * liste.length) % liste.length];
  const piger = (liste, cle, vals) => rempl(pige(liste, cle), vals);
  const penalites = f.punitions || [];
  const physique = f.physique || [];

  // Le fil du pointage, but par but.
  const compteMarqueur = new Map();
  const nGagnant = gf[L] + 1;
  let vusW = 0, a = 0, b = 0, creux = 0;
  const fil = buts.map((but, i) => {
    const T = but.cote, O = T === 'A' ? 'B' : 'A';
    const avant = { A: a, B: b };
    if (T === 'A') a++; else b++;
    const apres = { A: a, B: b };
    creux = Math.max(creux, apres[L] - apres[W]);
    if (T === W) vusW++;
    const n = (compteMarqueur.get(but.marqueur) || 0) + 1;
    compteMarqueur.set(but.marqueur, n);
    return { but, i, T, O, avant, apres, nth: n, gagnant: T === W && vusW === nGagnant };
  });
  const dernier = fil[fil.length - 1];
  const gagnantFil = fil.find(x => x.gagnant) || null;
  const assurance = dernier && dernier !== gagnantFil && dernier.T === W && dernier.but.instant >= 50 && dernier.but.instant < 60 && gf[W] - gf[L] >= 2 ? dernier : null;

  /* ----- les phrases de temps ----- */
  const quandCourt = (instant, cle) => (alea(cle) < 0.5 ? `avec ${tempsRestant(instant)} à jouer` : `à ${tempsRestant(instant)} de la fin`);
  const quandLong = (instant, cle) => {
    const per = periodeDe(instant), t = tempsRestant(instant), g = alea(cle) < 0.5;
    if (per === 4) return g ? `en prolongation, avec ${t} à jouer` : `en prolongation, à ${t} de la fin`;
    return g ? `avec ${t} à jouer en ${NOM_PERIODE[per]}` : `à ${t} de la fin de la ${NOM_PERIODE[per]}`;
  };

  // Une pièce qui ne se dit qu'une fois dans le texte : le même qualificatif ne revient pas sur deux lignes.
  const qDits = new Set();
  const unique = (banque, cle, vals) => {
    const i = Math.floor(alea(cle) * banque.length);
    for (let k = 0; k < banque.length; k++) {
      const t = rempl(banque[(i + k) % banque.length], vals);
      if (!qDits.has(t)) { qDits.add(t); return ` ${t}`; }
    }
    return '';
  };
  /* ----- les lignes, par section, avec leur priorité de retrait (haut = tombe d'abord) ----- */
  const lignes = [];
  const dit = new Set();
  // L'élision d'un nom propre (« de Angotti » → « d'Angotti ») et le point d'un « Jr. » en fin de phrase.
  const liss = t => t.replace(/\.\.(?!\.)/g, '.').replace(/\bde (?=[AEIOUYÉÈ])/g, "d'");
  const ajouter = (section, brut, p = 0) => {
    const texte = brut && liss(brut);
    if (!texte || dit.has(texte)) return;
    dit.add(texte);
    lignes.push({ section, texte, p, n: lignes.length });
    return texte;
  };
  // Ce que le résumé court reprend du détail, au fil de sa construction.
  const R = { tirs: null, contexte: null, gardiens: [], an: null, anPoids: 0, blessures: [], bagarre: null, punition: null, coup: null, melee: null, etoiles: null, butLigne: null };

  /* ===== LE MATCH ===== */
  {
    const s = `${gf[W]}-${gf[L]}`;
    const ecart = gf[W] - gf[L];
    const banque = ot ? ENTREE_PROLONGATION : gf[L] === 0 ? ENTREE_BLANCHI : ecart >= 4 ? ENTREE_NETTE : ENTREE_NORMALE;
    ajouter('Le match', piger(banque, 'entree', { W: nm[W], L: nm[L], s }), 0);

    const tA = somme(f.tirs && f.tirs.A), tB = somme(f.tirs && f.tirs.B);
    if (tA || tB) {
      if (tA === tB) R.tirs = ajouter('Le match', piger(TIRS_EGAUX, 'tirs', { a: tA }), 3);
      else {
        const X = tA > tB ? 'A' : 'B';
        const banqueTirs = X === W ? TIRS_DOMINE : TIRS_DOMINE_PERDU;
        R.tirs = ajouter('Le match', piger(banqueTirs, 'tirs', { X: nm[X], a: Math.max(tA, tB), b: Math.min(tA, tB) }), 3);
      }
    }
    if (creux >= 2) ajouter('Le match', piger(REMONTEE, 'remontee', { W: nm[W], L: nm[L], n: creux }), 4);

    const ser = /^(\d+)-(\d+)$/.exec(f.serie || '');
    if (ser) {
      const w = { A: Number(ser[1]), B: Number(ser[2]) };
      const n = w.A + w.B, wW = w[W], wL = w[L];
      let phrase;
      if (wW === 4) {
        phrase = wL === 0 ? pige([`${nm[W]} balaie ${nm[L]} 4-0 et remporte la série.`, `Balayage : ${nm[W]} gagne la série 4-0 contre ${nm[L]}.`], 'serie')
          : pige([`${nm[W]} remporte la série ${wW}-${wL} contre ${nm[L]}.`, `${nm[W]} élimine ${nm[L]}, ${wW}-${wL} dans la série.`], 'serie');
      } else if (wW === wL) {
        phrase = wW === 3 ? `La série est égale ${wW}-${wL} : un septième match décidera de tout.` : `La série est égale ${wW}-${wL}.`;
      } else if (wW > wL) {
        phrase = wW === 3 ? `${nm[W]} mène la série ${wW}-${wL} et n'est plus qu'à une victoire de l'emporter.` : `${nm[W]} mène la série ${wW}-${wL}.`;
      } else {
        phrase = wL === 3 ? `${nm[W]} évite l'élimination : ${nm[L]} mène la série ${wL}-${wW}.` : `${nm[W]} réduit l'écart : ${nm[L]} mène la série ${wL}-${wW}.`;
      }
      R.contexte = ajouter('Le match', `Match ${n} de la série. ${phrase}`, 1);
    }
    if (ctx.fiche && Number.isFinite(ctx.fiche.v) && Number.isFinite(ctx.fiche.d) && Number.isFinite(ctx.fiche.pr)) {
      const fiche = ajouter('Le match', `Après ce match, ${nm[nous]} affiche une fiche de ${ctx.fiche.v}-${ctx.fiche.d}-${ctx.fiche.pr}.`, 2);
      if (!R.contexte) R.contexte = fiche;
    }
  }

  /* ===== LE FIL PÉRIODE PAR PÉRIODE ===== */
  {
    const compact = buts.length > MAX_BUTS_UN_PAR_UN;
    const sitDe = x => (x.but.an ? ', en avantage numérique,' : x.but.dn ? ', en infériorité numérique,' : '');
    const passesDe = but => {
      const ps = (but.passeurs || []).map(nomDe);
      if (ps.length >= 2) return rempl(pige(PASSE_DEUX, `passes|${but.instant}`), { a: ps[0], b: ps[1] });
      if (ps.length === 1) return rempl(pige(PASSE_UNE, `passes|${but.instant}`), { a: ps[0] });
      return pige(SANS_AIDE, `passes|${but.instant}`);
    };
    const scoreDe = x => {
      const t = x.apres[x.T], o = x.apres[x.O];
      return t >= o ? `${t}-${o}` : `${o}-${t}`;
    };
    const butLigne = R.butLigne = x => {
      const but = x.but, cle = `but|${but.instant}|${x.i}`;
      const vals = { T: nm[x.T], s: scoreDe(x) };
      const dT = x.avant[x.T] - x.avant[x.O];
      const total = x.avant.A + x.avant.B;
      const prol = but.instant >= 60;
      const banque = prol ? VERBES_PROLONGATION : total === 0 ? VERBES_OUVRE : dT === 0 ? VERBES_AVANCE : dT === -1 ? VERBES_EGALISE : dT < -1 ? VERBES_REDUIT : VERBES_ALLONGE;
      const verbe = rempl(pige(banque, `${cle}|v`), vals);
      let texte = `${nomDe(but.marqueur)}${sitDe(x)} ${verbe}, ${passesDe(but)}`;
      if (but.gardien && but.gardien.n && alea(`${cle}|g`) < 0.45) texte += `, ${rempl(pige(GARDIEN_BATTU, `${cle}|gb`), { G: nomDe(but.gardien) })}`;
      texte = `${cap(quandCourt(but.instant, `${cle}|q`))}, ${texte}.`;
      if (x.nth === 2) texte += unique(DOUBLE, `${cle}|n`, {});
      else if (x.nth === 3) texte += unique(CHAPEAU, `${cle}|n`, {});
      else if (x.nth > 3) texte += ` Son ${ordinal(x.nth)} but du match.`;
      if (x.gagnant && !prol) texte += ` ${pige(MARQUE_GAGNANT, `${cle}|w`)}`;
      if (x === assurance) texte += ` ${pige(MARQUE_ASSURANCE, `${cle}|a`)}`;
      return texte;
    };
    const butCompact = x => {
      const but = x.but;
      const ps = (but.passeurs || []).map(nomDe);
      const aide = ps.length ? `passes de ${ps.join(' et ')}` : 'sans aide';
      const sit = but.an ? ', avantage numérique' : but.dn ? ', infériorité numérique' : '';
      const rang = x.nth > 1 ? `, ${x.nth}e but du match` : '';
      return `${tempsRestant(but.instant)} ${nomDe(but.marqueur)} (${nm[x.T]}${sit}, ${aide}), score ${scoreDe(x)}${rang}${x.gagnant ? `, but gagnant${but.instant >= 60 ? ' en prolongation' : ''}` : ''}`;
    };
    const etat = (A, B) => (A === B ? `Égalité ${A}-${B}` : `${nm[A > B ? 'A' : 'B']} mène ${Math.max(A, B)}-${Math.min(A, B)}`);

    for (const per of [1, 2, 3, 4]) {
      const section = NOM_PERIODE[per];
      const duPeriode = fil.filter(x => periodeDe(x.but.instant) === per);
      if (per === 4 && !duPeriode.length) continue;
      if (compact && duPeriode.length) {
        for (let k = 0; k < duPeriode.length; k += 2) {
          const lot = duPeriode.slice(k, k + 2);
          ajouter(section, `${lot.length > 1 ? 'Buts' : 'But'} : ${lot.map(butCompact).join(' ; ')}.`, 0);
        }
      } else {
        for (const x of duPeriode) ajouter(section, butLigne(x), 0);
      }
      if (per === 4) continue;
      const tA = tirsPeriode(f, 'A', per), tB = tirsPeriode(f, 'B', per);
      const fin = duPeriode.length ? duPeriode[duPeriode.length - 1].apres : (() => {
        const avant = fil.filter(x => periodeDe(x.but.instant) < per);
        return avant.length ? avant[avant.length - 1].apres : { A: 0, B: 0 };
      })();
      const tirs = duPeriode.length ? `Tirs de la ${NOM_PERIODE[per]} : ${nm.A} ${tA}, ${nm.B} ${tB}.`
        : `Aucun but en ${NOM_PERIODE[per]} : ${nm.A} ${pl(tA, 'tir')}, ${nm.B} ${pl(tB, 'tir')}.`;
      let pointage = '';
      if (per < 3) pointage = ` ${etat(fin.A, fin.B)} après la ${NOM_PERIODE[per]}.`;
      else if (ot) pointage = ` Égalité ${fin.A}-${fin.B} : le match se rend en prolongation.`;
      ajouter(section, `${tirs}${pointage}`, 1);
    }
  }

  /* ===== LES GARDIENS ===== */
  for (const c of ['A', 'B']) {
    const g = c === 'A' ? f.gardienA : f.gardienB;
    if (!g || !g.n || !f.arrets) continue;
    const arrets = f.arrets[c] || 0;
    const alloues = buts.filter(x => x.cote !== c).length;
    const recus = arrets + alloues;
    const vals = { G: nomDe(g), T: nm[c], n: arrets, t: recus, pct: recus ? pct3(arrets / recus) : '' };
    if (!recus) { ajouter('Les gardiens', `${vals.G} (${vals.T}) n'a affronté aucun tir.`, 3); continue; }
    let texte = piger(alloues === 0 ? GARDIEN_BLANCHI : GARDIEN_NORMAL, `gardien|${c}`, vals);
    const part = arrets / recus;
    const perdu3 = c === W ? false : gf[W] - gf[L] >= 3;
    if (alloues > 0 && part >= 0.93 && recus >= 25 && !perdu3) texte += unique(GARDIEN_SOLIDE, `gardienq|${c}`, vals);
    else if (alloues >= 4 && part < 0.88) texte += unique(GARDIEN_DUR, `gardienq|${c}`, vals);
    const poids = alloues === 0 ? 8 : part >= 0.93 && recus >= 25 ? 7 : alloues >= 4 && part < 0.88 ? 5 : 2;
    R.gardiens.push({ texte: ajouter('Les gardiens', texte, 3), poids });
  }

  /* ===== LES UNITÉS SPÉCIALES ===== */
  {
    const occ = c => penalites.filter(p => p.cote !== c).length;
    const buteAN = c => buts.filter(x => x.cote === c && x.an).length;
    const dn = c => buts.filter(x => x.cote === c && x.dn).length;
    const equipes = ['A', 'B'].filter(c => occ(c) > 0);
    const phrases = [];
    if (equipes.length) {
      const [p, q] = equipes;
      const lie = pige([0, 1], 'an|forme');
      if (lie === 0) phrases.push(`${pige(['Avantage numérique', 'Jeu de puissance'], 'an')} : ${equipes.map(c => `${nm[c]} ${buteAN(c)} en ${occ(c)}`).join(', ')}.`);
      else phrases.push(`${nm[p]} a converti ${buteAN(p)} de ses ${occ(p)} avantage${occ(p) > 1 ? 's' : ''} numérique${occ(p) > 1 ? 's' : ''}${q ? `, ${nm[q]} ${buteAN(q)} de ses ${occ(q)}` : ''}.`);
    }
    const inf = ['A', 'B'].filter(c => dn(c) > 0).map(c => `${nm[c]} ${dn(c)}`);
    if (inf.length) phrases.push(`Buts en infériorité numérique : ${inf.join(', ')}.`);
    if (phrases.length) {
      R.an = ajouter('Unités spéciales', phrases.join(' '), 4);
      // Le jeu de puissance a fait la différence : un club a marqué à cinq contre quatre et pas l'autre, dans un match serré.
      R.anPoids = buteAN('A') !== buteAN('B') && gf[W] - gf[L] <= 2 ? 6 : 2;
    }
  }

  /* ===== LES INCIDENTS : choisis d'abord, racontés là où ils remplacent la ligne plate ===== */
  const utilises = new Set();
  const choisir = (banque, cle) => {
    const i = Math.floor(alea(cle) * banque.length);
    for (let k = 0; k < banque.length; k++) {
      const t = banque[(i + k) % banque.length];
      if (!utilises.has(t)) { utilises.add(t); return t; }
    }
    return banque[i];
  };
  const incident = { punition: null, coup: null, bagarre: null, melee: null };
  // Un tirage par genre et par match, puis un événement parmi ceux du genre : les incidents ne viennent pas à tous les matchs.
  const premier = (liste, type) => (liste.length && alea(`inc|${type}`) < CHANCE[type] ? Math.floor(alea(`inc|${type}|i`) * liste.length) : -1);
  const iP = premier(penalites, 'punition');
  if (iP >= 0) incident.punition = penalites[iP];
  const coups = physique.filter(e => e.type === 'coup');
  const iC = premier(coups, 'coup');
  if (iC >= 0) incident.coup = coups[iC];
  const bagarres = physique.filter(e => e.type === 'bagarre');
  const iB = premier(bagarres, 'bagarre');
  if (iB >= 0) incident.bagarre = bagarres[iB];
  const melees = physique.filter(e => e.type === 'melee');
  const iM = premier(melees, 'melee');
  if (iM >= 0) incident.melee = melees[iM];
  // Plafond : les blessures d'abord (elles sont toujours écrites), puis les autres selon l'ordre du jeu.
  const blessures = (f.blessures || []).filter(x => x.joueur);
  let place = Math.max(0, MAX_INCIDENTS - blessures.length);
  for (const k of ['bagarre', 'punition', 'melee', 'coup']) {
    if (!incident[k]) continue;
    if (place > 0) place--; else incident[k] = null;
  }

  /* ===== LA DISCIPLINE : les faits, et seulement ce que la feuille dit ===== */
  {
    if (!penalites.length) ajouter('Discipline', pige(["Aucune punition n'a été décernée.", 'Match sans punition.'], 'sanspun'), 3);
    for (const c of ['A', 'B']) {
      const siennes = penalites.filter(p => p.cote === c).sort((x, y) => x.instant - y.instant);
      if (!siennes.length) continue;
      const details = siennes.filter(p => p !== incident.punition).slice(0, 3).map((p, i) => {
        const infra = pige(INFRACTIONS, `infra|${c}|${p.instant}|${i}`);
        return `${nomDe(p.joueur)} (${infra}, ${quandLong(p.instant, `pq|${c}|${p.instant}`)})`;
      });
      const reste = siennes.filter(p => p !== incident.punition).length - details.length;
      const minutes = new Set(siennes.map(p => p.minutes || 2));
      const genre = minutes.size === 1 ? ` de ${[...minutes][0]} minutes` : '';
      const entete = `${nm[c]} a écopé de ${pl(siennes.length, 'punition')}${genre}`;
      ajouter('Discipline', details.length ? `${entete} : ${details.join(' ; ')}${reste > 0 ? ` et ${pl(reste, 'autre')}` : ''}.` : `${entete}.`, 5);
    }
    for (const e of bagarres) {
      if (e === incident.bagarre) continue;
      const quand = quandLong(e.instant, `bq|${e.instant}`);
      const duo = `${nomDe(e.joueur)} (${nm.A}) et ${nomDe(e.cible)} (${nm.B})`;
      const issue = e.gagnant ? `${nm[e.gagnant]} l'emporte` : "aucun gagnant n'est désigné";
      const plate = ajouter('Discipline', `${cap(quand)}, bagarre entre ${duo} : ${issue}, ${e.minutes} minutes chacun.`, 5);
      if (!R.bagarre) R.bagarre = plate;
    }
    for (const e of melees) {
      if (e === incident.melee) continue;
      ajouter('Discipline', `${cap(quandLong(e.instant, `mq|${e.instant}`))}, mêlée entre ${nomDe(e.joueur)} (${nm.A}) et ${nomDe(e.cible)} (${nm.B}) : ${e.minutes} minutes chacun.`, 8);
    }
    const coupsPlats = coups.filter(e => e !== incident.coup).sort((x, y) => x.instant - y.instant).slice(0, 3);
    if (coupsPlats.length) {
      const liste = coupsPlats.map(e => `${nomDe(e.joueur)} sur ${nomDe(e.cible)} (${quandLong(e.instant, `cq|${e.instant}`)})`).join(' ; ');
      ajouter('Discipline', `Mises en échec marquantes : ${liste}.`, 9);
    }
  }

  /* ===== LES INCIDENTS RACONTÉS ===== */
  {
    // Chaque blessure de la feuille a sa ligne ; la cause, elle, se raconte ou non.
    blessures.forEach((x, i) => {
      const quand = quandLong(x.instant, `bless|${i}|q`);
      const matchs = Number.isFinite(x.matchs) && x.matchs > 0 ? x.matchs : 0;
      const vals = { j: nomDe(x.joueur), T: nm[x.cote], n: matchs, matchs: matchs > 1 ? 'matchs' : 'match', quand };
      if (alea(`bless|${i}|chance`) < CHANCE.blessure) {
        const cause = rempl(choisir(INC_BLESSURE, `bless|${i}|inc`), vals);
        const fin = matchs ? ` ${rempl(pige(ABSENCE, `bless|${i}|abs`), vals)}` : '';
        R.blessures.push({ matchs, texte: ajouter('Incidents', `${cap(quand)}, ${cause}.${fin}`, 2) });
      } else if (matchs) {
        R.blessures.push({ matchs, texte: ajouter('Incidents', cap(rempl(pige(BLESSE_SANS_CAUSE, `bless|${i}|s`), vals)), 2) });
      } else {
        R.blessures.push({ matchs, texte: ajouter('Incidents', `${vals.j} (${vals.T}) a quitté le match sur une blessure, ${quand}.`, 2) });
      }
    });
    if (incident.punition) {
      const p = incident.punition;
      const cause = rempl(choisir(INC_PUNITION, 'inc|punition'), { j: nomDe(p.joueur) });
      R.punition = ajouter('Incidents', `${cap(quandLong(p.instant, 'inc|punition|q'))}, ${cause}. ${p.minutes || 2} minutes de punition pour ${nm[p.cote]}.`, 7);
    }
    if (incident.bagarre) {
      const e = incident.bagarre;
      const gagnant = e.gagnant ? (e.gagnant === 'A' ? e.joueur : e.cible) : null;
      const perdant = e.gagnant ? (e.gagnant === 'A' ? e.cible : e.joueur) : null;
      const cause = gagnant ? rempl(choisir(INC_BAGARRE, 'inc|bagarre'), { w: nomDe(gagnant), l: nomDe(perdant) })
        : rempl(choisir(INC_BAGARRE_NUL, 'inc|bagarre'), { a: nomDe(e.joueur), b: nomDe(e.cible) });
      R.bagarre = ajouter('Incidents', `${cap(quandLong(e.instant, 'inc|bagarre|q'))}, bagarre : ${cause}. ${e.minutes} minutes chacun.`, 6);
    }
    if (incident.melee) {
      const e = incident.melee;
      R.melee = ajouter('Incidents', `${cap(quandLong(e.instant, 'inc|melee|q'))}, mêlée : ${rempl(choisir(INC_MELEE, 'inc|melee'), { a: nomDe(e.joueur), b: nomDe(e.cible) })}. ${e.minutes} minutes chacun.`, 8);
    }
    if (incident.coup) {
      const e = incident.coup;
      R.coup = ajouter('Incidents', `${cap(quandLong(e.instant, 'inc|coup|q'))}, ${rempl(choisir(INC_COUP, 'inc|coup'), { j: nomDe(e.joueur), c: nomDe(e.cible) })}.`, 9);
    }
  }

  /* ===== LES ÉTOILES ===== */
  {
    const prod = new Map();
    const de = (p, c) => { if (!prod.has(p)) prod.set(p, { p, c, g: 0, a: 0 }); return prod.get(p); };
    for (const but of buts) {
      if (but.marqueur) de(but.marqueur, but.cote).g++;
      for (const p of but.passeurs || []) de(p, but.cote).a++;
    }
    const candidats = [...prod.values()].map(x => ({
      c: x.c, nom: nomDe(x.p), score: 3 * x.g + 1.5 * x.a,
      court: [x.g ? `${x.g}B` : '', x.a ? `${x.a}A` : ''].filter(Boolean).join(' '),
      desc: [x.g ? pl(x.g, 'but') : '', x.a ? pl(x.a, 'passe') : ''].filter(Boolean).join(', '),
    }));
    for (const c of ['A', 'B']) {
      const g = c === 'A' ? f.gardienA : f.gardienB;
      if (!g || !g.n || !f.arrets) continue;
      const arrets = f.arrets[c] || 0, alloues = buts.filter(x => x.cote !== c).length, recus = arrets + alloues;
      if (!recus) continue;
      const part = arrets / recus;
      const score = alloues === 0 ? 4 : part >= 0.92 && recus >= 20 ? (part - 0.9) * 50 : 0;
      if (score > 0) candidats.push({ c, nom: nomDe(g), score, court: alloues === 0 ? `${pl(arrets, 'arrêt')}, blanchissage` : pl(arrets, 'arrêt'), desc: alloues === 0 ? `blanchissage, ${pl(arrets, 'arrêt')}` : `${pl(arrets, 'arrêt')} sur ${pl(recus, 'tir')}` });
    }
    const etoiles = candidats.filter(x => x.score >= 1)
      .sort((x, y) => y.score - x.score || (y.c === W) - (x.c === W) || x.nom.localeCompare(y.nom, 'fr')).slice(0, 3);
    if (etoiles.length) {
      const liste = etoiles.map((x, i) => `${i + 1}. ${x.nom} (${nm[x.c]}) : ${x.desc}`).join(' ; ');
      const entree = etoiles.length === 3 ? pige(ETOILES_ENTREE, 'etoiles') : etoiles.length === 2 ? 'Les deux étoiles' : 'La première étoile';
      ajouter('Les étoiles', `${entree} : ${liste}.`, 0);
      R.etoiles = `Étoiles : ${etoiles.map((x, i) => `${i + 1}. ${x.nom} ${x.court}`).join(' · ')}`;
    }
  }

  /* ===== LE RÉSUMÉ COURT, comme un segment de télé sportive : manchette, tournant, étoiles, à noter, contexte ===== */
  function resumeCourt() {
    const sortie = [];
    const dire = t => { const l = t && liss(t); if (l && !sortie.includes(l)) sortie.push(l); };
    const s = `${gf[W]}-${gf[L]}`;
    const gagnantBut = gagnantFil ? gagnantFil.but : null;
    const m = gagnantBut ? nomDe(gagnantBut.marqueur) : '';
    // La manchette : le résultat et l'histoire du match.
    const parMarqueur = new Map();
    for (const x of fil) if (x.T === W) parMarqueur.set(x.but.marqueur, (parMarqueur.get(x.but.marqueur) || 0) + 1);
    const [vedette, nVedette] = [...parMarqueur.entries()].sort((x, y) => y[1] - x[1])[0] || [null, 0];
    const parPer = [1, 2, 3].map(per => ({ per, n: fil.filter(x => x.T === W && periodeDe(x.but.instant) === per).length })).sort((x, y) => y.n - x.n)[0];
    const gW = W === 'A' ? f.gardienA : f.gardienB;
    const vals = { W: nm[W], L: nm[L], s, m, n: creux };
    let manchette;
    if (ot && m) manchette = piger(["{W} l'emporte {s} en prolongation grâce à {m}", '{m} donne la victoire à {W}, {s} en prolongation contre {L}'], 'm|ot', vals);
    else if (creux >= 2) manchette = piger(['{W} renverse la vapeur et bat {L} {s}', "{W} comble un retard de {n} buts et l'emporte {s}"], 'm|creux', vals);
    else if (parPer && parPer.n >= 3) manchette = `${parPer.n} buts en ${NOM_PERIODE[parPer.per]} : ${nm[W]} l'emporte ${s} contre ${nm[L]}`;
    else if (gf[L] === 0 && gW && gW.n) manchette = piger(['{G} ferme la porte : {W} blanchit {L} {s}', '{W} blanchit {L} {s}, {G} repousse tous les tirs'], 'm|bl', { ...vals, G: nomDe(gW) });
    else if (nVedette >= 2) manchette = `${nm[W]} bat ${nm[L]} ${s} grâce au ${nVedette === 2 ? 'doublé' : 'tour du chapeau'} de ${nomDe(vedette)}`;
    else manchette = piger(['{W} bat {L} {s} grâce à {m}', "{W} s'impose {s} face à {L} avec un but décisif de {m}"], 'm|n', vals);
    dire(`${manchette}.`);
    // Le tournant : ce qui a décidé le match, par importance.
    const tournant = [];
    if (gagnantFil && R.butLigne) tournant.push({ poids: 10, texte: R.butLigne(gagnantFil) });
    const bascule = fil.filter(x => x !== gagnantFil && x.T === W && x.avant[W] <= x.avant[L] && x.avant.A + x.avant.B > 0).pop();
    if (bascule && R.butLigne) tournant.push({ poids: 6, texte: R.butLigne(bascule) });
    for (const g of R.gardiens) tournant.push({ poids: g.poids, texte: g.texte });
    if (R.an) tournant.push({ poids: R.anPoids, texte: R.an });
    if (R.tirs) tournant.push({ poids: 1, texte: R.tirs });
    tournant.sort((x, y) => y.poids - x.poids);
    for (const t of tournant.slice(0, 3)) dire(t.texte);
    dire(R.etoiles);
    // À noter : un seul fait, le plus marquant, et seulement s'il a eu lieu.
    const blesse = R.blessures.slice().sort((x, y) => y.matchs - x.matchs)[0];
    const plusPunis = ['A', 'B'].map(c => ({ c, n: penalites.filter(p => p.cote === c).length })).sort((x, y) => y.n - x.n)[0];
    if (blesse) dire(blesse.texte);
    else if (R.bagarre) dire(R.bagarre);
    else if (plusPunis && plusPunis.n >= 5) dire(`${nm[plusPunis.c]} a écopé de ${plusPunis.n} punitions, contre ${penalites.length - plusPunis.n} pour ${nm[plusPunis.c === 'A' ? 'B' : 'A']}.`);
    else dire(R.punition || R.melee || R.coup);
    dire(R.contexte);
    return sortie;
  }

  /* ----- le plafond : les détails les moins utiles tombent d'abord ----- */
  let gardees = lignes.slice();
  while (gardees.length > MAX_LIGNES) {
    const pire = gardees.reduce((m, x) => (x.p > m.p || (x.p === m.p && x.n > m.n) ? x : m), gardees[0]);
    if (pire.p === 0) break;
    gardees = gardees.filter(x => x !== pire);
  }
  const sections = [];
  for (const x of gardees) {
    let s = sections.find(y => y.titre === x.section);
    if (!s) { s = { titre: x.section, lignes: [] }; sections.push(s); }
    s.lignes.push(x.texte);
  }
  return { titre, resume: resumeCourt(), lignes: sections.flatMap(s => s.lignes), sections };
}
