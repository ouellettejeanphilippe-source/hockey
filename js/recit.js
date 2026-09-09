/**
 * Le récit d'un match : ce que la feuille de pointage ne raconte pas.
 *
 * LA RÈGLE DE CE FICHIER : il ne décide de RIEN. Le moteur a déjà joué le
 * match, lancer par lancer ; ici on met des mots sur ce qui est arrivé, sans
 * jamais changer un but, un tir ou un arrêt. Si une phrase et la feuille de
 * match se contredisent, c'est la feuille qui a raison et la phrase qui est
 * à corriger.
 *
 * Ce qui décide de la tournure, dans l'ordre :
 *
 *   LE MARQUEUR    un défenseur marque de la ligne bleue, un franc-tireur
 *                  d'un lancer, un fabricant en se présentant devant le filet
 *   SES TRAITS     💣 Lancer et ⚡ Vitesse sont exactement ce que le sommaire
 *                  ne dit pas, donc ils méritent leur phrase
 *   LES PASSES     deux passes = une séquence, aucune = un jeu individuel
 *   LE MOMENT      un but en prolongation ne se raconte pas comme un but en
 *                  début de première
 *
 * Le tirage est DÉTERMINISTE, sur le nom du marqueur et l'instant du but :
 * rouvrir un sommaire redonne exactement le même récit. Un texte qui change
 * quand on le relit fait douter du reste.
 */

import { getTraits } from './traits.js';
import { seasonLancers } from './ratings.js';

/** Hachage stable d'une chaîne, pour tirer une tournure sans hasard vivant. */
function graine(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

const pige = (liste, g) => liste[Math.floor(g * liste.length) % liste.length];

const mmss = x => {
  const m = Math.floor(x);
  const s = Math.floor((x - m) * 60 + 1e-6);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** `12:34` — le temps écoulé dans la période, celui de la feuille officielle. */
export function tempsDeJeu(instant) {
  const dansPeriode = instant >= 60 ? instant - 60 : instant % 20;
  return mmss(dansPeriode);
}

/**
 * `07:26` — le temps qu'il RESTE à la période, celui du tableau indicateur.
 * C'est ce que le direct affiche : une horloge de hockey descend, et JP a
 * dit qu'une horloge qui monte ne ressemble pas à un match. La feuille
 * officielle, elle, garde le temps écoulé.
 */
export function tempsRestant(instant) {
  const enProlongation = instant >= 60;
  const dansPeriode = enProlongation ? instant - 60 : instant % 20;
  const duree = enProlongation ? 5 : 20;
  return mmss(Math.max(0, duree - dansPeriode));
}

export const NOM_PERIODE = { 1: '1re période', 2: '2e période', 3: '3e période', 4: 'Prolongation' };

const est_D = p => p && (p.p === 'D' || p.p === 'LD' || p.p === 'RD');

/** Le penchant du marqueur : finit-il, ou sert-il ? */
function profil(p) {
  if (!p) return 'neutre';
  if (est_D(p)) return 'defenseur';
  const cles = getTraits(p).map(t => t.cle);
  if (cles.includes('TIR')) return 'canonnier';
  if (cles.includes('VITESSE')) return 'rapide';
  if ((p.pt || 0) >= 15) {
    const part = (p.g || 0) / p.pt - (seasonLancers(p.s)[6] || 0.4);
    if (part >= 0.06) return 'tireur';
    if (part <= -0.08) return 'fabricant';
  }
  return 'neutre';
}

/*
 * Une phrase complète par manière de marquer, {G} étant le gardien battu.
 * Complètes plutôt qu'assemblées de morceaux : coller un geste et un verbe
 * donnait « file en échappée et ne rate pas et déjoue Dryden », qui n'est
 * pas du français.
 */
const GESTES = {
  defenseur: ['décoche de la ligne bleue et bat {G}', 'sert une bombe de la pointe que {G} ne voit jamais',
    'fait dévier un tir de la pointe derrière {G}', 'surgit en deuxième vague et surprend {G}',
    'se joint à l\'attaque et loge la rondelle derrière {G}', 'lance à travers un écran, et {G} ne voit rien',
    'pince le long de la bande et trompe {G} du poignet', 'tire de la pointe, la rondelle dévie et {G} est battu',
    'descend en vitesse et surprend {G} d\'un tir bas', 'fait la montée lui-même et déjoue {G}'],
  canonnier: ['dégaine son fameux lancer frappé devant {G}', 'loge son tir dans la lucarne, au-dessus de {G}',
    'décoche sans ralentir et bat {G}', 'trouve le petit côté sur {G}',
    'arme son lancer du haut de l\'enclave, {G} n\'a pas le temps de réagir', 'lance une frappe sur réception que {G} ne voit jamais',
    'décoche un boulet qui passe sous le bras de {G}', 'fait vibrer la barre et la rondelle rentre derrière {G}',
    'prend son temps et loge un tir précis derrière {G}', 'canonne de l\'entrée de zone et {G} est pris à froid'],
  rapide: ['prend la défensive de vitesse et déjoue {G}', 'file en échappée et ne rate pas {G}',
    'déborde son couvreur et glisse la rondelle sous {G}', 'gagne la course à la rondelle et trompe {G}',
    'explose en zone neutre et déjoue {G} d\'une feinte', 'coupe au filet en vitesse et pousse la rondelle derrière {G}',
    'contourne le filet à toute allure et surprend {G}', 'récupère une rondelle libre en vitesse et bat {G} du revers',
    'file entre les deux défenseurs et déjoue {G}', 'accélère sur l\'aile et trouve le petit côté de {G}'],
  tireur: ['décoche du cercle et bat {G}', 'fait mouche du poignet devant {G}',
    'trouve une ouverture et déjoue {G}', 'se démarque et ne laisse aucune chance à {G}',
    'lance à bout portant et bat {G}', 'saisit la rondelle dans l\'enclave et trompe {G}',
    'tire du cercle gauche, précis, et {G} n\'y peut rien', 'se libère devant le filet et loge la rondelle derrière {G}',
    'lance en pivotant et surprend {G}', 'fait mouche du revers sur {G}'],
  fabricant: ['se présente seul devant et déjoue {G}', 'attire {G} et le glisse du revers',
    'termine lui-même le jeu qu\'il a lancé, aux dépens de {G}', 'patiente et loge la rondelle derrière {G}',
    'feinte la passe et surprend {G} d\'un tir', 'garde la rondelle, attend, et bat {G} du poignet',
    'orchestre le jeu et le conclut lui-même devant {G}', 'contourne le filet et glisse la rondelle sous {G}',
    'fait la passe à lui-même sur la bande et déjoue {G}', 'remonte la rondelle et trompe {G} d\'une feinte'],
  neutre: ['pousse la rondelle derrière {G}', 'marque dans la mêlée devant {G}',
    'saisit le retour que {G} a laissé', 'fait dévier la rondelle et trompe {G}',
    'bat {G} d\'un tir bas dans l\'enclave', 'lance à travers la circulation et surprend {G}',
    'profite d\'un revirement et déjoue {G}', 'poursuit son effort au filet et pousse la rondelle sous {G}',
    'tire de l\'angle et la rondelle rentre derrière {G}', 'récupère un retour et trompe {G} du revers'],
};

const SOLO = ['en solo', 'sans aide', 'sur un jeu individuel', 'à la suite d\'un revirement',
  'après avoir volé la rondelle', 'sans que personne le touche'];
const SEQUENCE = ['au bout d\'une belle séquence', 'sur un jeu de passes bien mené',
  'après une montée à trois', 'sur une attaque massue', 'au terme d\'un jeu de passes rapide',
  'sur une passe transversale parfaite', 'après un long cycle en zone offensive'];

/* La prolongation a ses propres mots : c'est le but qui met fin au match. */
const FIN = ['met fin au débat', 'donne la victoire aux siens', 'tranche en prolongation',
  'règle la question', 'libère les siens', 'envoie tout le monde aux douches', 'termine le match d\'un coup'];

/**
 * Une phrase pour un but. `but` vient du journal du moteur
 * (`feuilleVierge` dans js/sim.js) ; rien ici ne le modifie.
 */
export function recitDeBut(but) {
  const m = but.marqueur;
  const g = graine(`${m?.n || '?'}|${but.instant.toFixed(3)}`);
  const nomG = but.gardien ? nomCourt(but.gardien.n) : 'le gardien';

  if (but.gagnant || but.instant >= 60) {
    return `${nomCourt(m.n)} ${pige(FIN, g)} face à ${nomG}.`;
  }
  const geste = pige(GESTES[profil(m)], g).replace('{G}', nomG);
  const appui = but.passeurs.length >= 2 ? `, ${pige(SEQUENCE, graine(`s${m?.n}${but.instant}`))}`
    : but.passeurs.length === 0 ? `, ${pige(SOLO, graine(`o${m?.n}${but.instant}`))}`
    : '';
  return `${nomCourt(m.n)} ${geste}${appui}.`;
}

/** « Wayne Gretzky » -> « Gretzky », mais « Guy » reste « Guy ». */
export function nomCourt(nom) {
  if (!nom) return '';
  const bouts = String(nom).trim().split(/\s+/);
  return bouts.length > 1 ? bouts.slice(1).join(' ') : bouts[0];
}

/**
 * Les trois lignes qui résument un match avant même de lire le sommaire :
 * qui a gagné, comment, et ce qui a fait la différence.
 */
export function recitDeMatch(feuille, nomA, nomB, tirsA, tirsB) {
  const gagne = feuille.vainqueur === 'A';
  const nomV = gagne ? nomA : nomB, nomP = gagne ? nomB : nomA;
  const butsV = gagne ? feuille.gfA : feuille.gfB;
  const butsP = gagne ? feuille.gfB : feuille.gfA;
  const tirsV = gagne ? tirsA : tirsB, tirsP = gagne ? tirsB : tirsA;
  const ecart = butsV - butsP;

  const g = graine(`m${feuille.gfA}${feuille.gfB}${feuille.buts.length}${feuille.buts[0]?.instant ?? 0}`);
  const bits = [];
  if (feuille.ot) bits.push(pige([`${nomV} l'emporte en prolongation`, `${nomV} arrache la victoire en prolongation`,
    `${nomV} finit par avoir raison de ${nomP} en prolongation`, `${nomV} gagne en prolongation contre ${nomP}`], g));
  else if (butsP === 0) bits.push(pige([`${nomV} blanchit ${nomP}`, `${nomV} ferme la porte à ${nomP}`,
    `${nomV} ne laisse rien passer contre ${nomP}`, `${nomV} signe le jeu blanc contre ${nomP}`], g));
  else if (ecart >= 4) bits.push(pige([`${nomV} écrase ${nomP}`, `${nomV} passe le rouleau sur ${nomP}`,
    `${nomV} humilie ${nomP}`, `${nomV} règle ${nomP} sans discussion`], g));
  else if (ecart === 1) bits.push(pige([`${nomV} s'en tire de justesse contre ${nomP}`, `${nomV} tient bon jusqu'au bout contre ${nomP}`,
    `${nomV} arrache un but d'écart à ${nomP}`, `${nomV} résiste à ${nomP} par un seul but`], g));
  else bits.push(pige([`${nomV} bat ${nomP}`, `${nomV} dispose de ${nomP}`, `${nomV} a le dessus sur ${nomP}`,
    `${nomV} prend la mesure de ${nomP}`], g));

  if (tirsV < tirsP - 6) bits.push(pige([`en étant dominé ${tirsP}-${tirsV} au chapitre des tirs`,
    `malgré ${tirsP} tirs contre ${tirsV}`, `contre le cours du jeu, ${tirsP}-${tirsV} aux tirs`], g));
  else if (tirsV > tirsP + 8) bits.push(pige([`en dictant le rythme ${tirsV}-${tirsP}`,
    `en bombardant ${tirsV} fois contre ${tirsP}`, `en menant ${tirsV}-${tirsP} aux tirs`], g));

  // Le joueur du match : le plus de points, les buts d'abord.
  const points = new Map();
  for (const b of feuille.buts) {
    const gagnantCote = b.cote === feuille.vainqueur;
    if (!gagnantCote) continue;
    const add = (p, g) => { const e = points.get(p) || { g: 0, a: 0 }; e[g]++; points.set(p, e); };
    add(b.marqueur, 'g');
    for (const a of b.passeurs) add(a, 'a');
  }
  let vedette = null, best = -1;
  for (const [p, e] of points) {
    const n = e.g * 2 + e.a;
    if (n > best) { best = n; vedette = { p, ...e }; }
  }
  let phrase = bits.join(' ') + '.';
  if (vedette && (vedette.g * 2 + vedette.a) >= 4) {
    const bouts = [];
    if (vedette.g) bouts.push(`${vedette.g} but${vedette.g > 1 ? 's' : ''}`);
    if (vedette.a) bouts.push(`${vedette.a} passe${vedette.a > 1 ? 's' : ''}`);
    phrase += ' ' + pige([`${nomCourt(vedette.p.n)} récolte ${bouts.join(' et ')}.`,
      `Soirée de ${bouts.join(' et ')} pour ${nomCourt(vedette.p.n)}.`,
      `${nomCourt(vedette.p.n)} termine avec ${bouts.join(' et ')}.`,
      `${nomCourt(vedette.p.n)} a fait la différence : ${bouts.join(' et ')}.`], graine(`v${vedette.p.n}${feuille.gfA}`));
  }
  // Le gardien qui a volé le match : trente-cinq arrêts et plus dans une
  // victoire d'un but, ou un jeu blanc.
  const gV = gagne ? feuille.gardienA : feuille.gardienB;
  const arretsV = gagne ? feuille.arrets.A : feuille.arrets.B;
  if (gV && ((butsP === 0 && arretsV >= 20) || (ecart <= 1 && arretsV >= 35))) {
    phrase += ' ' + pige([`${nomCourt(gV.n)} repousse ${arretsV} lancers.`, `${arretsV} arrêts pour ${nomCourt(gV.n)}, qui a tenu le fort.`,
      `${nomCourt(gV.n)} a été le meilleur joueur sur la glace : ${arretsV} arrêts.`], graine(`g${gV.n}${arretsV}`));
  }
  return phrase;
}

/** Le résumé d'une série une fois qu'elle est jouée. */
export function recitDeSerie(wV, wP, nomV, nomP, feuilles) {
  const prolongations = feuilles.filter(f => f.ot).length;
  const g = graine(`s${nomV}${nomP}${wV}${wP}${feuilles.length}`);
  let phrase;
  if (wP === 0) phrase = pige([`${nomV} balaie ${nomP} en quatre matchs.`, `${nomV} ne laisse pas un match à ${nomP} : quatre à zéro.`,
    `Le balayage : ${nomV} passe ${nomP} en quatre.`], g);
  else if (wV === 4 && wP === 3) phrase = pige([`${nomV} survit à un septième match contre ${nomP}.`,
    `Sept matchs, et c'est ${nomV} qui a le dernier mot contre ${nomP}.`, `${nomV} gagne le septième match et élimine ${nomP}.`], g);
  else phrase = pige([`${nomV} élimine ${nomP} en ${wV + wP} matchs.`, `${nomV} a besoin de ${wV + wP} matchs pour écarter ${nomP}.`,
    `${nomV} vient à bout de ${nomP} en ${wV + wP} matchs.`], g);
  if (prolongations >= 2) phrase += ` ${prolongations} matchs se sont réglés en prolongation.`;
  else if (prolongations === 1) phrase += ' Un match s\'est réglé en prolongation.';
  return phrase;
}

/* =====================================================================
   Le récit d'une saison
   ===================================================================== */

const virgule = x => String(x).replace('.', ',');
const rangMot = r => (r === 1 ? 'premier' : `${r}e`);
/* Les petits nombres s'écrivent en lettres dans une phrase : « six victoires de suite ». */
const LETTRES = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];
const enLettres = (n, masc = false) => (n === 1 && masc ? 'un' : LETTRES[n] ?? String(n));
/* « une seule blessure », « six victoires », « un jeu blanc » : le nombre en lettres quand il est petit. */
const pluriel = (n, un, des, masc = false) => `${enLettres(n, masc)} ${n > 1 ? des : un}`;

/**
 * La saison racontée, en quelques paragraphes qui se lisent comme un
 * article : la fiche et le rang, puis l'arc de la saison (le départ, la
 * meilleure et la pire séquence, la fin), les soirs qu'on retient, les
 * vedettes de l'attaque, le gardien, l'infirmerie. Tout vient du journal et
 * des fiches simulées ; rien n'est inventé, seulement la tournure, tirée sur
 * une graine de la saison pour que le texte tienne quand on le relit.
 *
 * JP : *plus fluide les résumés de saison, genre écris comme il faut*. Donc
 * des phrases complètes, liées entre elles, et pas une suite de chiffres
 * séparés par des points.
 *
 *   equipe    l'équipe du joueur, avec `journal`, `injuriesLog`, `roster`
 *   rang, n   son rang et le nombre d'équipes
 *   ctx       { nomEquipe(t) } — le nom court d'une équipe adverse
 */
export function recitDeSaison(equipe, rang, n, ctx) {
  const J = equipe.journal || [];
  if (!J.length) return [];
  const g = graine(`${equipe.W}-${equipe.L}-${equipe.OTL}-${equipe.GF}-${equipe.GA}-${rang}`);
  const g2 = graine(`b${equipe.GF}${equipe.GA}${rang}`);
  const g3 = graine(`c${equipe.W}${equipe.PTS}`);
  const paras = [];
  const club = 'Les NHL Stars';
  const fiche = `${equipe.W}-${equipe.L}-${equipe.OTL}`;
  const pts = equipe.PTS;
  const diff = equipe.GF - equipe.GA;
  const diffStr = `${diff > 0 ? '+' : ''}${diff}`;

  /* 1. La fiche, le rang et ce qu'ils veulent dire. */
  let ouverture;
  if (rang === 1) ouverture = pige([
    `${club} ont dominé la saison régulière du début à la fin et terminent au premier rang de la ligue, avec une fiche de ${fiche} et ${pts} points. Personne n'a réussi à suivre.`,
    `Avec ${pts} points et une fiche de ${fiche}, ${club.toLowerCase()} ont fini au sommet de la ligue. Si le trophée du Président se remettait ici, il serait dans leur vestiaire.`,
    `La saison régulière n'a pas eu d'autre patron : ${club.toLowerCase()} terminent premiers, forts d'une fiche de ${fiche} et de ${pts} points.`], g);
  else if (rang <= 4) ouverture = pige([
    `${club} ont connu une saison de tête et terminent au ${rangMot(rang)} rang de la ligue, avec une fiche de ${fiche} et ${pts} points, ce qui leur donne l'avantage de la glace pour amorcer les séries.`,
    `Avec ${pts} points et une fiche de ${fiche}, ${club.toLowerCase()} finissent ${rang}e sur ${n} : l'une des quatre grosses équipes de l'année, et un club qu'on voyait venir dès l'automne.`,
    `Le ${rangMot(rang)} rang, ${pts} points, une fiche de ${fiche} : ${club.toLowerCase()} ont fait partie du haut du classement toute l'année.`], g);
  else if (rang <= 16) ouverture = pige([
    `${club} ont décroché leur place en séries en terminant au ${rangMot(rang)} rang de la ligue, avec une fiche de ${fiche} et ${pts} points. Rien n'a été donné, mais l'essentiel est là.`,
    `Avec ${pts} points et une fiche de ${fiche}, ${club.toLowerCase()} finissent ${rang}e sur ${n} équipes, ce qui suffit pour les séries sans laisser beaucoup de marge.`,
    `${club} terminent la saison au ${rangMot(rang)} rang, ${fiche} pour ${pts} points : une qualification qui s'est prise sur la glace plutôt que reçue.`], g);
  else if (rang <= 20) ouverture = pige([
    `${club} ont raté les séries de peu : le ${rangMot(rang)} rang sur ${n}, avec une fiche de ${fiche} et ${pts} points, à quelques points seulement de la ligne.`,
    `Avec ${pts} points et une fiche de ${fiche}, ${club.toLowerCase()} terminent ${rang}e, juste sous la ligne des séries. Le printemps se regarde à la télé, mais de pas très loin.`,
    `La saison des NHL Stars s'arrête au ${rangMot(rang)} rang, ${fiche} pour ${pts} points, à une ou deux victoires d'une place en séries.`], g);
  else ouverture = pige([
    `${club} ont connu une saison difficile et terminent au ${rangMot(rang)} rang sur ${n}, avec une fiche de ${fiche} et seulement ${pts} points.`,
    `Avec ${pts} points et une fiche de ${fiche}, ${club.toLowerCase()} finissent ${rang}e sur ${n} équipes : une saison à oublier, ou à disséquer, selon l'humeur.`,
    `Il y a eu plus de soirs de défaite que de victoire chez les NHL Stars, qui terminent ${rang}e avec ${pts} points et une fiche de ${fiche}.`], g);
  const bilanButs = diff >= 40 ? pige([`Ils ont gagné en marquant : ${equipe.GF} buts pour, ${equipe.GA} contre, un différentiel de ${diffStr} qui dit bien que l'attaque a porté le club.`,
      `Le différentiel de ${diffStr} raconte le reste : avec ${equipe.GF} buts marqués contre ${equipe.GA} accordés, c'est l'attaque qui a fait la différence.`], g2)
    : diff >= 12 ? pige([`Ils ont marqué ${equipe.GF} buts et en ont accordé ${equipe.GA}, un différentiel de ${diffStr}, solide sans être écrasant.`,
      `Le compte est bon : ${equipe.GF} buts pour, ${equipe.GA} contre, et un différentiel de ${diffStr} qui reflète une équipe bien équilibrée.`], g2)
    : diff >= -12 ? pige([`Avec ${equipe.GF} buts marqués et ${equipe.GA} accordés, un différentiel de ${diffStr}, c'est une équipe qui a joué des matchs serrés toute l'année.`,
      `Le différentiel de ${diffStr} (${equipe.GF} buts pour, ${equipe.GA} contre) montre une saison où presque chaque soir s'est décidé par un but.`], g2)
    : pige([`Ils ont trop concédé pour ce qu'ils marquaient : ${equipe.GA} buts accordés contre ${equipe.GF} marqués, un différentiel de ${diffStr} où le problème est écrit en toutes lettres.`,
      `Le différentiel de ${diffStr} ne ment pas : avec ${equipe.GF} buts pour et ${equipe.GA} contre, la défensive a coûté cher.`], g2);
  paras.push(`${ouverture} ${bilanButs}`);

  /* 2. L'arc de la saison : le départ, les séquences, la fin, les prolongations. */
  const vDix = J.slice(0, 10).filter(m => m.win).length;
  let cur = 0, best = { n: 0, fin: 0 }, curP = 0, pire = { n: 0, fin: 0 };
  J.forEach((m, i) => {
    if (m.win) { cur++; curP = 0; if (cur > best.n) best = { n: cur, fin: i }; }
    else { curP++; cur = 0; if (curP > pire.n) pire = { n: curP, fin: i }; }
  });
  const arc = [];
  arc.push(vDix >= 8 ? pige([`La saison s'est ouverte en trombe, avec ${enLettres(vDix)} victoires dans les dix premiers matchs : le ton était donné dès octobre.`,
      `Le départ a été canon. Après dix matchs, la fiche montrait déjà ${vDix}-${10 - vDix}, et la ligue savait à quoi s'en tenir.`], g3)
    : vDix >= 6 ? pige([`Le club a pris un bon départ, avec ${enLettres(vDix)} victoires dans ses dix premiers matchs.`,
      `L'entrée en saison a été propre : une fiche de ${vDix}-${10 - vDix} après dix matchs, sans coup d'éclat mais sans faux pas.`], g3)
    : vDix >= 4 ? pige([`Le départ a été ordinaire, ${enLettres(vDix)} victoires en dix matchs, le temps de trouver ses trios et son rythme.`,
      `Après dix matchs, la fiche montrait ${vDix}-${10 - vDix}, ni plus ni moins, le temps que les unités se trouvent.`], g3)
    : pige([`Le début de saison a été pénible, avec ${pluriel(vDix, 'seule victoire', 'victoires seulement')} dans les dix premiers matchs, et le vestiaire a dû se parler assez tôt.`,
      `Rien n'a été facile au départ : ${vDix}-${10 - vDix} après dix matchs, et déjà du retard à rattraper au classement.`], g3));
  if (best.n >= 6) arc.push(pige([`C'est entre les matchs ${best.fin + 2 - best.n} et ${best.fin + 1} que l'équipe a trouvé sa vitesse de croisière, en alignant ${enLettres(best.n)} victoires d'affilée, la plus longue séquence de l'année.`,
      `Le meilleur moment de la saison est venu avec une séquence de ${enLettres(best.n)} victoires consécutives, bouclée au match ${best.fin + 1}, qui a remis le club à sa place au classement.`,
      `Puis il y a eu la séquence de l'année : ${enLettres(best.n)} gains de suite jusqu'au match ${best.fin + 1}, et la ligue a compris à qui elle avait affaire.`], g));
  else if (best.n >= 4) arc.push(pige([`Au mieux, l'équipe a enchaîné ${enLettres(best.n)} victoires de suite autour du match ${best.fin + 1}.`,
      `Sa plus longue séquence victorieuse, ${enLettres(best.n)} matchs, s'est terminée au match ${best.fin + 1}.`], g));
  if (pire.n >= 6) arc.push(pige([`Il y a eu du plus difficile aussi : ${enLettres(pire.n)} défaites de suite jusqu'au match ${pire.fin + 1}, un creux qui a pesé lourd au classement.`,
      `À l'inverse, la traversée du désert a duré ${enLettres(pire.n)} matchs, ${enLettres(pire.n)} revers d'affilée qui ont pris fin au match ${pire.fin + 1}.`], g2));
  else if (pire.n >= 4) arc.push(pige([`Le passage à vide le plus long a duré ${enLettres(pire.n)} défaites, autour du match ${pire.fin + 1}.`,
      `Il a fallu encaisser ${enLettres(pire.n)} revers consécutifs autour du match ${pire.fin + 1}, sans que le vestiaire ne se défasse.`], g2));
  const vFin = J.slice(-10).filter(m => m.win).length;
  if (vFin >= 7) arc.push(pige([`Surtout, la fin de saison a été forte : ${enLettres(vFin)} victoires dans les dix derniers matchs, et un club qui arrive au printemps lancé.`,
      `Le sprint final a été à la hauteur, avec une fiche de ${vFin}-${10 - vFin} sur les dix derniers matchs.`], g3));
  else if (vFin <= 3) arc.push(pige([`La fin de saison a été laborieuse, avec ${pluriel(vFin, 'seule victoire', 'victoires seulement')} dans les dix derniers matchs : on est arrivé en avril à bout de souffle.`,
      `Les dix derniers matchs, joués à ${vFin}-${10 - vFin}, ont montré une équipe fatiguée.`], g3));
  const ot = J.filter(m => m.ot).length, otW = J.filter(m => m.ot && m.win).length;
  if (ot >= 12) arc.push(pige([`Au total, ${ot} matchs sont allés en prolongation, et l'équipe en a gagné ${otW}.`,
      `Ce fut aussi une saison de prolongations : ${ot} matchs s'y sont rendus, dont ${otW} victoires.`], g));
  paras.push(arc.join(' '));

  /* 3. Les soirs qu'on retient. */
  const soirs = [];
  const raclee = J.reduce((a, m) => (m.gf - m.ga > (a ? a.gf - a.ga : 0) ? m : a), null);
  const gifle = J.reduce((a, m) => (m.ga - m.gf > (a ? a.ga - a.gf : 0) ? m : a), null);
  if (raclee && raclee.gf - raclee.ga >= 5) soirs.push(pige([`Parmi les soirs à retenir, le ${raclee.gf}-${raclee.ga} infligé aux ${ctx.nomEquipe(raclee.adv)} au match ${raclee.n} reste la plus grosse démonstration de l'année.`,
      `La soirée la plus complète est venue au match ${raclee.n}, quand les ${ctx.nomEquipe(raclee.adv)} ont encaissé un ${raclee.gf}-${raclee.ga} sans appel.`], g2));
  if (gifle && gifle.ga - gifle.gf >= 5) soirs.push(pige([`${soirs.length ? 'À l\'inverse, l' : 'L'}e ${gifle.ga}-${gifle.gf} encaissé devant les ${ctx.nomEquipe(gifle.adv)} au match ${gifle.n} est celui qu'on préférera oublier.`,
      `${soirs.length ? 'Le revers de la médaille est venu' : 'Le soir à oublier est venu'} au match ${gifle.n}, avec un ${gifle.ga}-${gifle.gf} contre les ${ctx.nomEquipe(gifle.adv)}.`], g3));
  const blanchissages = J.filter(m => m.ga === 0).length;
  if (blanchissages >= 6) soirs.push(pige([`Les gardiens ont aussi signé ${enLettres(blanchissages)} jeux blancs dans l'année.`,
      `Et ${enLettres(blanchissages)} fois dans la saison, l'adversaire est reparti sans avoir marqué.`], g));
  if (soirs.length) paras.push(soirs.join(' '));

  /* 4. Les vedettes de l'attaque, puis le gardien. */
  const joueurs = Object.values(equipe.roster || {}).filter(Boolean);
  const pat = joueurs.filter(p => p.p !== 'G' && p.simGP).sort((a, b) => b.simPTS - a.simPTS || b.simG - a.simG);
  const gards = joueurs.filter(p => p.p === 'G' && p.simGP).sort((a, b) => b.simGP - a.simGP);
  if (pat.length) {
    const p1 = pat[0];
    const buteur = pat.slice().sort((a, b) => b.simG - a.simG)[0];
    const v = [];
    v.push(pige([`À l'attaque, c'est ${nomCourt(p1.n)} qui a porté le club, avec ${p1.simG} buts et ${p1.simA} passes pour ${p1.simPTS} points en ${p1.simGP} matchs.`,
      `Le premier violon de l'attaque a été ${nomCourt(p1.n)}, meilleur pointeur de l'équipe avec ${p1.simPTS} points, dont ${p1.simG} buts, en ${p1.simGP} matchs.`,
      `Offensivement, tout est passé par ${nomCourt(p1.n)} : ${p1.simPTS} points, ${p1.simG} buts et ${p1.simA} passes en ${p1.simGP} matchs.`], g));
    if (buteur !== p1 && buteur.simG >= 25) v.push(pige([`Pour les buts, c'est plutôt ${nomCourt(buteur.n)} qu'on regardait, avec ${buteur.simG} filets.`,
      `${nomCourt(buteur.n)} a été le buteur du groupe, avec ${buteur.simG} buts.`], g2));
    if (pat[1] && pat[2]) v.push(pige([`${nomCourt(pat[1].n)} et ${nomCourt(pat[2].n)} ont suivi, avec ${pat[1].simPTS} et ${pat[2].simPTS} points.`,
      `Derrière lui, ${nomCourt(pat[1].n)} a récolté ${pat[1].simPTS} points et ${nomCourt(pat[2].n)} ${pat[2].simPTS}.`], g3));
    const pmBest = pat.slice().sort((a, b) => b.simPM - a.simPM)[0];
    if (pmBest && pmBest.simPM >= 25) v.push(pige([`Le meilleur différentiel de l'équipe appartient à ${nomCourt(pmBest.n)}, qui termine à +${pmBest.simPM}, ce qui en dit long sur ses présences.`,
      `Et le +${pmBest.simPM} de ${nomCourt(pmBest.n)}, le meilleur du club, résume bien ce qui se passait quand il était sur la glace.`], g));
    paras.push(v.join(' '));
  }
  if (gards.length) {
    const g1 = gards[0];
    const pct = g1.simSA ? g1.simSV / g1.simSA : 0;
    const mba = virgule((g1.simGA / Math.max(1, g1.simGP)).toFixed(2));
    const pctStr = virgule(pct.toFixed(3).slice(1));
    const phraseG = pct >= 0.920 ? pige([`Devant le filet, ${nomCourt(g1.n)} a été une muraille toute l'année : un taux d'efficacité de ${pctStr}, une moyenne de ${mba} et ${g1.simW} victoires en ${g1.simGP} départs.`,
        `${nomCourt(g1.n)} a volé des matchs du début à la fin. En ${g1.simGP} départs, il a maintenu un taux d'efficacité de ${pctStr} et une moyenne de ${mba}, pour ${g1.simW} victoires.`], g2)
      : pct >= 0.905 ? pige([`Devant le filet, ${nomCourt(g1.n)} a tenu son bout honnêtement, avec un taux d'efficacité de ${pctStr}, une moyenne de ${mba} et ${g1.simW} victoires en ${g1.simGP} départs.`,
        `Le gardien numéro un, ${nomCourt(g1.n)}, a pris ${g1.simGP} départs et en a gagné ${g1.simW}, avec un taux d'efficacité de ${pctStr} et une moyenne de ${mba}.`], g2)
      : pige([`Devant le filet, ça a été plus difficile : ${nomCourt(g1.n)} termine avec un taux d'efficacité de ${pctStr} et une moyenne de ${mba} en ${g1.simGP} départs.`,
        `${nomCourt(g1.n)} a connu une saison ordinaire devant le filet, ${pctStr} d'efficacité et ${mba} de moyenne en ${g1.simGP} départs, ce qui n'a pas aidé la cause.`], g2);
    const g2n = gards[1];
    const aux = g2n && g2n.simGP >= 10
      ? ` ${nomCourt(g2n.n)} l'a relevé ${g2n.simGP} fois${g2n.simSO ? `, signant au passage ${pluriel(g2n.simSO, 'jeu blanc', 'jeux blancs', true)}` : ''}.`
      : '';
    paras.push(phraseG + aux);
  }

  /* 5. L'infirmerie. */
  const bless = equipe.injuriesLog || [];
  if (bless.length) {
    const longue = bless.slice().sort((a, b) => b.games - a.games)[0];
    const total = bless.reduce((a, b) => a + b.games, 0);
    paras.push(bless.length >= 6
      ? pige([`L'infirmerie n'a pas désempli : ${bless.length} blessures et ${total} matchs ratés au total, la plus longue absence étant celle de ${nomCourt(longue.player.n)}, à l'écart pendant ${longue.games} matchs.`,
        `Côté santé, la saison a été dure, avec ${bless.length} blessures qui ont coûté ${total} matchs à l'équipe ; ${nomCourt(longue.player.n)} a été le plus touché, avec ${longue.games} matchs manqués.`], g3)
      : pige([`Côté santé, l'équipe s'en est bien tirée : ${pluriel(bless.length, 'seule blessure', 'blessures')}, la plus longue ayant tenu ${nomCourt(longue.player.n)} à l'écart pendant ${longue.games} matchs.`,
        `L'infirmerie est restée calme, avec ${pluriel(bless.length, 'blessure', 'blessures')} seulement ; ${nomCourt(longue.player.n)} a raté ${longue.games} matchs, et c'est la plus longue absence de l'année.`], g3));
  } else paras.push(pige(['Et pour une fois, l\'infirmerie est restée vide toute la saison : pas une seule blessure, ce qui n\'arrive à peu près jamais.',
    'Le médecin de l\'équipe a eu une année tranquille, sans une seule blessure à soigner de toute la saison.'], g));

  return paras;
}
