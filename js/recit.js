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

/**
 * `07:26` — le temps qu'il RESTE à la période, celui du tableau indicateur.
 * C'est ce que le direct affiche : une horloge de hockey descend, et JP a
 * dit qu'une horloge qui monte ne ressemble pas à un match. C'est la SEULE
 * horloge du jeu (S79) : le sommaire du match et l'entracte donnaient le temps
 * écoulé, et JP lisait deux heures différentes pour le même but.
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
export function profil(p) {
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
export const GESTES = {
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

export const SOLO = ['en solo', 'sans aide', 'sur un jeu individuel', 'à la suite d\'un revirement',
  'après avoir volé la rondelle', 'sans que personne le touche'];
export const SEQUENCE = ['au bout d\'une belle séquence', 'sur un jeu de passes bien mené',
  'après une montée à trois', 'sur une attaque massue', 'au terme d\'un jeu de passes rapide',
  'sur une passe transversale parfaite', 'après un long cycle en zone offensive'];

/* La prolongation a ses propres mots : c'est le but qui met fin au match. */
export const FIN = ['met fin au débat', 'donne la victoire aux siens', 'tranche en prolongation',
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

/*
 * LE CONSEIL DU BILAN (1.0, J2-18). « Regarde tes trois derniers trios » ne
 * disait rien que le joueur puisse vérifier. Le conseil nomme maintenant ce
 * qui a le plus coûté, avec ses chiffres — les mêmes que le rapport du
 * dépisteur au bureau : tes lignes à forces égales (buts et tirs), ou tes buts
 * pour et contre et leur rang dans la ligue. Pur : `calendrier` est celui du
 * moteur (une journée = une liste de matchs `{ A, B, feuille }`), `teams` le
 * classement final.
 */
function lignesAForcesEgales(calendrier, you) {
  const L = [0, 1, 2, 3].map(() => ({ t: 0, b: 0 }));
  for (const jour of calendrier || []) for (const m of jour || []) {
    if (!m || !m.feuille || (m.A !== you && m.B !== you)) continue;
    const cote = m.A === you ? 'A' : 'B';
    for (const l of m.feuille.lancers || []) {
      if (l.ligne == null || l.mode !== 'FE' || l.cote !== cote || !L[l.ligne]) continue;
      L[l.ligne].t++;
      if (l.but) L[l.ligne].b++;
    }
  }
  return L;
}
const rangDans = (teams, you, cle, bas) => teams.slice().sort((a, b) => (bas ? a[cle] - b[cle] : b[cle] - a[cle]))
  .findIndex(t => t === you || t.isPlayer) + 1;
export function conseilDuBilan(r, you, teams = [], calendrier = []) {
  if ((r.L + r.OTL) === 0) return '82-0-0. Saison parfaite. Les Bruins de 2022-23, meilleure saison de l\'histoire, ont fini 65-12-5.';
  if (r.W >= 65) return `${r.W} victoires : mieux que le record réel de la LNH (65, Bruins de 2022-23).`;
  const n = teams.length;
  const rGF = n > 1 ? rangDans(teams, you, 'GF', false) : 0;
  const rGA = n > 1 ? rangDans(teams, you, 'GA', true) : 0;
  // Le trio qui convertit le moins, parmi ceux qui ont assez tiré pour qu'on le juge.
  const NOMS = ['1er', '2e', '3e', '4e'];
  const pire = lignesAForcesEgales(calendrier, you).map((x, u) => ({ ...x, u, pct: x.t ? x.b / x.t : 0 }))
    .filter(x => x.t >= 30).sort((a, b) => a.pct - b.pct)[0];
  if (r.W >= 41 && pire) return `Ton ${NOMS[pire.u]} trio a marqué ${pire.b} but${pire.b > 1 ? 's' : ''} en ${pire.t} tirs à forces égales : c'est là que ça se joue.`;
  if (rGA && rGA >= rGF) return `Ta défense a accordé ${r.GA} buts, ${rGA}e de la ligue sur ${n} : c'est là que ça se joue.`;
  if (rGF) return `Ton attaque a marqué ${r.GF} buts, ${rGF}e de la ligue sur ${n} : c'est là que ça se joue.`;
  return r.W >= 41 ? 'Saison au-dessus de la moyenne.' : 'Une saison sous la moyenne.';
}
