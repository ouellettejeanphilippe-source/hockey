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

/** `12:34` — le temps écoulé dans la période. */
export function tempsDeJeu(instant) {
  const dansPeriode = instant >= 60 ? instant - 60 : instant % 20;
  const m = Math.floor(dansPeriode);
  const s = Math.floor((dansPeriode - m) * 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
    'fait dévier un tir de la pointe derrière {G}', 'surgit en deuxième vague et surprend {G}'],
  canonnier: ['dégaine son fameux lancer frappé devant {G}', 'loge son tir dans la lucarne, au-dessus de {G}',
    'décoche sans ralentir et bat {G}', 'trouve le petit côté sur {G}'],
  rapide: ['prend la défensive de vitesse et déjoue {G}', 'file en échappée et ne rate pas {G}',
    'déborde son couvreur et glisse la rondelle sous {G}', 'gagne la course à la rondelle et trompe {G}'],
  tireur: ['décoche du cercle et bat {G}', 'fait mouche du poignet devant {G}',
    'trouve une ouverture et déjoue {G}', 'se démarque et ne laisse aucune chance à {G}'],
  fabricant: ['se présente seul devant et déjoue {G}', 'attire {G} et le glisse du revers',
    'termine lui-même le jeu qu\'il a lancé, aux dépens de {G}', 'patiente et loge la rondelle derrière {G}'],
  neutre: ['pousse la rondelle derrière {G}', 'marque dans la mêlée devant {G}',
    'saisit le retour que {G} a laissé', 'fait dévier la rondelle et trompe {G}'],
};

const SOLO = ['en solo', 'sans aide', 'sur un jeu individuel', 'à la suite d\'un revirement'];
const SEQUENCE = ['au bout d\'une belle séquence', 'sur un jeu de passes bien mené',
  'après une montée à trois', 'sur une attaque massue'];

/* La prolongation a ses propres mots : c'est le but qui met fin au match. */
const FIN = ['met fin au débat', 'donne la victoire aux siens', 'tranche en prolongation',
  'règle la question'];

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

  const bits = [];
  if (feuille.ot) bits.push(`${nomV} l'emporte en prolongation`);
  else if (butsP === 0) bits.push(`${nomV} blanchit ${nomP}`);
  else if (ecart >= 4) bits.push(`${nomV} écrase ${nomP}`);
  else if (ecart === 1) bits.push(`${nomV} s'en tire de justesse contre ${nomP}`);
  else bits.push(`${nomV} bat ${nomP}`);

  if (tirsV < tirsP - 6) bits.push(`en étant dominé ${tirsP}-${tirsV} au chapitre des tirs`);
  else if (tirsV > tirsP + 8) bits.push(`en dictant le rythme ${tirsV}-${tirsP}`);

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
    phrase += ` ${nomCourt(vedette.p.n)} récolte ${bouts.join(' et ')}.`;
  }
  return phrase;
}

/** Le résumé d'une série une fois qu'elle est jouée. */
export function recitDeSerie(wV, wP, nomV, nomP, feuilles) {
  const prolongations = feuilles.filter(f => f.ot).length;
  let phrase;
  if (wP === 0) phrase = `${nomV} balaie ${nomP} en quatre matchs.`;
  else if (wV === 4 && wP === 3) phrase = `${nomV} survit à un septième match contre ${nomP}.`;
  else phrase = `${nomV} élimine ${nomP} en ${wV + wP} matchs.`;
  if (prolongations >= 2) phrase += ` ${prolongations} matchs se sont réglés en prolongation.`;
  else if (prolongations === 1) phrase += ' Un match s\'est réglé en prolongation.';
  return phrase;
}
