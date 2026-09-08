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

const pluriel = (n, un, des) => `${n} ${n > 1 ? des : un}`;

/**
 * La saison racontée, en quelques paragraphes : la fiche et le rang, l'arc
 * (le départ, la meilleure et la pire séquence, la fin), les vedettes de
 * l'attaque, le gardien, l'infirmerie. Tout vient du journal et des fiches
 * simulées ; rien n'est inventé, seulement la tournure, tirée sur une graine
 * de la saison pour que le texte tienne quand on le relit.
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

  /* 1. La fiche et le rang. */
  const fiche = `${equipe.W}-${equipe.L}-${equipe.OTL}`;
  const enSeries = rang <= 16;
  let ouverture;
  if (rang === 1) ouverture = pige([
    `Première de la ligue. Ta formation termine à ${fiche}, ${equipe.PTS} points, et personne n'a suivi.`,
    `${fiche}, ${equipe.PTS} points, le premier rang : la saison régulière n'a pas eu d'autre patron.`,
    `Le premier rang, avec ${equipe.PTS} points et une fiche de ${fiche}. Le trophée du Président, si on le remettait ici.`], g);
  else if (rang <= 4) ouverture = pige([
    `${rang}e de ${n}, ${fiche}, ${equipe.PTS} points : une saison de tête, et l'avantage de la glace pour commencer.`,
    `Ta formation finit ${rang}e avec ${equipe.PTS} points (${fiche}). Une des quatre grosses équipes de l'année.`,
    `${equipe.PTS} points et le ${rang}e rang : un club qu'on voyait venir dès l'automne.`], g);
  else if (enSeries) ouverture = pige([
    `${rang}e de ${n} avec ${equipe.PTS} points (${fiche}) : les séries, sans le luxe.`,
    `Ta formation termine ${rang}e, ${fiche}, ${equipe.PTS} points. Qualifiée, mais rien n'a été donné.`,
    `${fiche} pour ${equipe.PTS} points, ${rang}e rang : la place en séries s'est prise, pas reçue.`], g);
  else if (rang <= 20) ouverture = pige([
    `${rang}e de ${n}, ${fiche}, ${equipe.PTS} points : la ligne des séries est passée à quelques points.`,
    `Ta formation finit ${rang}e avec ${equipe.PTS} points. Éliminée, de peu.`,
    `${fiche}, ${equipe.PTS} points, ${rang}e rang. Le printemps se regarde à la télé, mais pas de loin.`], g);
  else ouverture = pige([
    `${rang}e de ${n}, ${fiche}, ${equipe.PTS} points : une saison à oublier, ou à disséquer.`,
    `Ta formation termine ${rang}e avec ${equipe.PTS} points. La feuille de match ci-dessous dit où ça a cassé.`,
    `${fiche}. ${equipe.PTS} points. Le ${rang}e rang sur ${n} : il y a eu plus de soirs de défaite que de victoire.`], g);
  const diff = equipe.GF - equipe.GA;
  const bilanButs = diff >= 40 ? pige([`Différentiel de +${diff} : on a gagné en marquant.`, `+${diff} au différentiel, ${equipe.GF} buts marqués : l'attaque a porté le club.`], g2)
    : diff >= 12 ? pige([`Un différentiel de +${diff}, solide sans être écrasant.`, `${equipe.GF} buts pour, ${equipe.GA} contre : le compte est bon.`], g2)
    : diff >= -12 ? pige([`Différentiel de ${diff > 0 ? '+' : ''}${diff} : une équipe qui a joué des matchs serrés toute l'année.`, `${equipe.GF} buts pour, ${equipe.GA} contre. Chaque soir s'est joué à un but.`], g2)
    : pige([`Différentiel de ${diff} : on a trop concédé pour ce qu'on marquait.`, `${equipe.GA} buts alloués contre ${equipe.GF} marqués. Le problème est écrit là.`], g2);
  paras.push(`${ouverture} ${bilanButs}`);

  /* 2. L'arc : le départ, les séquences, la fin. */
  const dix = J.slice(0, 10);
  const vDix = dix.filter(m => m.win).length;
  let sequences = [];
  let cur = 0, best = { n: 0, fin: 0 }, curP = 0, pire = { n: 0, fin: 0 };
  J.forEach((m, i) => {
    if (m.win) { cur++; curP = 0; if (cur > best.n) best = { n: cur, fin: i }; }
    else { curP++; cur = 0; if (curP > pire.n) pire = { n: curP, fin: i }; }
  });
  const depart = vDix >= 8 ? pige([`Le départ a été canon : ${vDix} victoires en dix matchs.`, `${vDix} des dix premiers matchs gagnés : le ton était donné en octobre.`], g3)
    : vDix >= 6 ? pige([`Bon départ, ${vDix} victoires dans les dix premiers.`, `Une entrée de saison propre : ${vDix}-${10 - vDix} après dix matchs.`], g3)
    : vDix >= 4 ? pige([`Le départ a été moyen : ${vDix} victoires en dix matchs, le temps de trouver ses trios.`, `${vDix}-${10 - vDix} après dix matchs, sans plus.`], g3)
    : pige([`Le départ a été pénible : ${vDix} victoire${vDix > 1 ? 's' : ''} seulement dans les dix premiers.`, `${vDix}-${10 - vDix} après dix matchs. Le vestiaire a dû se parler.`], g3);
  sequences.push(depart);
  if (best.n >= 6) sequences.push(pige([`La meilleure séquence : ${best.n} victoires de suite, bouclée au match ${best.fin + 1}.`,
    `Entre les matchs ${best.fin + 2 - best.n} et ${best.fin + 1}, ${best.n} victoires d'affilée — la ligue a compris.`,
    `${best.n} gains consécutifs jusqu'au match ${best.fin + 1} : la séquence de l'année.`], g));
  else if (best.n >= 4) sequences.push(pige([`Une séquence de ${best.n} victoires, autour du match ${best.fin + 1}.`, `Au mieux, ${best.n} victoires de suite.`], g));
  if (pire.n >= 6) sequences.push(pige([`Il y a eu du plus dur : ${pire.n} défaites de suite jusqu'au match ${pire.fin + 1}.`,
    `${pire.n} défaites d'affilée, fin au match ${pire.fin + 1}. Un creux qui a coûté le classement.`], g2));
  else if (pire.n >= 4) sequences.push(pige([`Une traversée du désert de ${pire.n} défaites, autour du match ${pire.fin + 1}.`, `${pire.n} revers de suite au pire moment.`], g2));
  const fin10 = J.slice(-10);
  const vFin = fin10.filter(m => m.win).length;
  if (vFin >= 7) sequences.push(pige([`Et la fin de saison a été forte : ${vFin} victoires dans les dix derniers.`, `Le club arrive au printemps lancé, ${vFin}-${10 - vFin} sur les dix derniers matchs.`], g3));
  else if (vFin <= 3) sequences.push(pige([`La fin a été laborieuse : ${vFin} victoire${vFin > 1 ? 's' : ''} dans les dix derniers.`, `${vFin}-${10 - vFin} sur les dix derniers matchs : on arrive en avril à bout de souffle.`], g3));
  const ot = J.filter(m => m.ot).length, otW = J.filter(m => m.ot && m.win).length;
  if (ot >= 12) sequences.push(pige([`${ot} matchs sont allés en prolongation, ${otW} gagnés.`, `Une saison de prolongations : ${ot}, dont ${otW} victoires.`], g));
  paras.push(sequences.join(' '));

  /* 3. Les soirs qu'on retient. */
  const soirs = [];
  const raclee = J.reduce((a, m) => (m.gf - m.ga > (a ? a.gf - a.ga : 0) ? m : a), null);
  const gifle = J.reduce((a, m) => (m.ga - m.gf > (a ? a.ga - a.gf : 0) ? m : a), null);
  if (raclee && raclee.gf - raclee.ga >= 5) soirs.push(pige([`La plus grosse soirée : ${raclee.gf}-${raclee.ga} contre ${ctx.nomEquipe(raclee.adv)} au match ${raclee.n}.`,
    `Au match ${raclee.n}, ${ctx.nomEquipe(raclee.adv)} a mangé un ${raclee.gf}-${raclee.ga}.`], g2));
  if (gifle && gifle.ga - gifle.gf >= 5) soirs.push(pige([`La pire : un ${gifle.ga}-${gifle.gf} encaissé devant ${ctx.nomEquipe(gifle.adv)} au match ${gifle.n}.`,
    `Le soir à oublier : ${gifle.ga}-${gifle.gf} contre ${ctx.nomEquipe(gifle.adv)}, match ${gifle.n}.`], g3));
  const blanchissages = J.filter(m => m.ga === 0).length;
  if (blanchissages >= 6) soirs.push(pige([`${pluriel(blanchissages, 'jeu blanc', 'jeux blancs')} dans l'année.`, `Les gardiens ont signé ${blanchissages} jeux blancs.`], g));
  if (soirs.length) paras.push(soirs.join(' '));

  /* 4. Les vedettes : les trois meilleurs pointeurs, le gardien. */
  const joueurs = Object.values(equipe.roster || {}).filter(Boolean);
  const pat = joueurs.filter(p => p.p !== 'G' && p.simGP).sort((a, b) => b.simPTS - a.simPTS || b.simG - a.simG);
  const gards = joueurs.filter(p => p.p === 'G' && p.simGP).sort((a, b) => b.simGP - a.simGP);
  if (pat.length) {
    const p1 = pat[0];
    const buteur = pat.slice().sort((a, b) => b.simG - a.simG)[0];
    const v = [];
    v.push(pige([`${nomCourt(p1.n)} a mené l'attaque avec ${p1.simPTS} points (${p1.simG} buts, ${p1.simA} passes) en ${p1.simGP} matchs.`,
      `Le premier violon : ${nomCourt(p1.n)}, ${p1.simG} buts et ${p1.simA} passes pour ${p1.simPTS} points.`,
      `${p1.simPTS} points pour ${nomCourt(p1.n)}, le meilleur pointeur du club, ${p1.simG} buts et ${p1.simA} passes.`], g));
    if (buteur !== p1 && buteur.simG >= 25) v.push(pige([`${nomCourt(buteur.n)} a été le buteur : ${buteur.simG} buts.`,
      `Pour les buts, c'est ${nomCourt(buteur.n)} qu'on regardait : ${buteur.simG}.`], g2));
    if (pat[1] && pat[2]) v.push(pige([`Derrière, ${nomCourt(pat[1].n)} (${pat[1].simPTS}) et ${nomCourt(pat[2].n)} (${pat[2].simPTS}).`,
      `${nomCourt(pat[1].n)} et ${nomCourt(pat[2].n)} suivent, ${pat[1].simPTS} et ${pat[2].simPTS} points.`], g3));
    const pmBest = pat.slice().sort((a, b) => b.simPM - a.simPM)[0];
    if (pmBest && pmBest.simPM >= 25) v.push(pige([`${nomCourt(pmBest.n)} termine à +${pmBest.simPM}, le meilleur différentiel de l'équipe.`,
      `Le +${pmBest.simPM} de ${nomCourt(pmBest.n)} dit tout de ses présences.`], g));
    paras.push(v.join(' '));
  }
  if (gards.length) {
    const g1 = gards[0];
    const pct = g1.simSA ? g1.simSV / g1.simSA : 0;
    const mba = g1.simGA / Math.max(1, g1.simGP);
    const pctStr = pct.toFixed(3).slice(1);
    const phraseG = pct >= 0.920 ? pige([`Devant le filet, ${nomCourt(g1.n)} a été une muraille : ${pctStr} d'efficacité, ${mba.toFixed(2)} de moyenne en ${g1.simGP} départs.`,
      `${nomCourt(g1.n)} a volé des matchs toute l'année : ${pctStr}, ${mba.toFixed(2)}, ${g1.simW} victoires.`], g2)
      : pct >= 0.905 ? pige([`${nomCourt(g1.n)} a tenu le filet honnêtement : ${pctStr}, ${mba.toFixed(2)} de moyenne, ${g1.simW} victoires en ${g1.simGP} départs.`,
        `Le gardien numéro un, ${nomCourt(g1.n)} : ${g1.simGP} départs, ${pctStr} d'efficacité, ${g1.simW} victoires.`], g2)
      : pige([`Devant le filet, ça a été plus difficile : ${nomCourt(g1.n)} termine à ${pctStr} et ${mba.toFixed(2)} de moyenne.`,
        `${nomCourt(g1.n)} a eu une saison ordinaire : ${pctStr}, ${mba.toFixed(2)} de moyenne en ${g1.simGP} départs.`], g2);
    const g2n = gards[1];
    const aux = g2n && g2n.simGP >= 10 ? ` ${nomCourt(g2n.n)} a pris ${g2n.simGP} départs en relève${g2n.simSO ? `, dont ${pluriel(g2n.simSO, 'jeu blanc', 'jeux blancs')}` : ''}.` : '';
    paras.push(phraseG + aux);
  }

  /* 5. L'infirmerie. */
  const bless = equipe.injuriesLog || [];
  if (bless.length) {
    const longue = bless.slice().sort((a, b) => b.games - a.games)[0];
    const total = bless.reduce((a, b) => a + b.games, 0);
    paras.push(bless.length >= 6
      ? pige([`L'infirmerie a été pleine : ${bless.length} blessures, ${total} matchs ratés au total, ${nomCourt(longue.player.n)} absent ${longue.games} matchs.`,
        `${bless.length} blessures dans l'année, ${total} matchs perdus. La plus longue : ${nomCourt(longue.player.n)}, ${longue.games} matchs.`], g3)
      : pige([`${pluriel(bless.length, 'blessure', 'blessures')} cette saison, la plus longue à ${nomCourt(longue.player.n)} (${longue.games} matchs).`,
        `Côté santé, ${pluriel(bless.length, 'blessure', 'blessures')} seulement ; ${nomCourt(longue.player.n)} a raté ${longue.games} matchs.`], g3));
  } else paras.push(pige(['Aucune blessure de toute la saison. Ça n\'arrive jamais.', 'Le médecin de l\'équipe a eu une année tranquille : aucune blessure.'], g));

  return paras;
}
