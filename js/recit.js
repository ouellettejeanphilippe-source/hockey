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
import { pct3 } from './util.js';

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

/*
 * CE QUI A DÉCIDÉ (1.0, oct.). JP : *résumé textuel post match … qui décrit ce qui est arrivé dans le
 * match, les stats ou lancers de dés qui font la différence*. Toujours lu sur la feuille, jamais une
 * cote : chaque lancer y porte sa chance d'entrer (`p`), donc leur somme est le nombre de buts ATTENDUS
 * — l'écart avec les vrais buts, c'est le dé du soir. Puis les tirs, l'avantage numérique, le gardien,
 * les actions spéciales des systèmes. Les trois faits les plus lourds, puis le but gagnant.
 */
export function ceQuiADecide(f, nomA, nomB) {
  const nom = c => (c === 'A' ? nomA : nomB), autre = c => (c === 'A' ? 'B' : 'A');
  const v = (x, d = 1) => x.toFixed(d).replace('.', ',');
  const plur = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const buts = c => f.buts.filter(b => b.cote === c).length;
  const tirs = c => (f.tirs[c] || []).reduce((a, b) => a + b, 0);
  const lancers = f.lancers || [];
  const faits = [];
  // Le dé : les buts marqués contre les buts attendus (une feuille sans chances n'en dit rien).
  if (lancers.length && lancers.filter(l => l.p != null).length >= 0.8 * lancers.length) {
    for (const c of ['A', 'B']) {
      const attendu = lancers.filter(l => l.cote === c && l.p != null).reduce((a, l) => a + l.p, 0), g = buts(c), d = g - attendu;
      if (Math.abs(d) >= 1) faits.push({ poids: Math.abs(d), txt: `${nom(c)} : ${plur(g, 'but')} sur ${v(attendu)} attendus — ${d > 0 ? 'ses tirs sont entrés' : 'le gardien d\'en face a fermé la porte'}.` });
    }
  }
  const dt = tirs('A') - tirs('B');
  if (Math.abs(dt) >= 8) {
    const c = dt > 0 ? 'A' : 'B';
    faits.push({ poids: Math.abs(dt) / 8, txt: `${nom(c)} a dominé aux tirs, ${tirs(c)}–${tirs(autre(c))}${buts(c) < buts(autre(c)) ? ', sans en profiter' : ''}.` });
  }
  const an = c => f.buts.filter(b => b.cote === c && b.an).length, occ = c => (f.punitions || []).filter(x => x.cote === autre(c)).length;
  if (an('A') !== an('B')) {
    const c = an('A') > an('B') ? 'A' : 'B';
    faits.push({ poids: 1.2 * Math.abs(an('A') - an('B')), txt: `L'avantage numérique : ${nom(c)} ${an(c)} en ${occ(c)}, ${nom(autre(c))} ${an(autre(c))} en ${occ(autre(c))}.` });
  }
  for (const c of ['A', 'B']) {
    const g = f[c === 'A' ? 'gardienA' : 'gardienB'], recus = tirs(autre(c)), arrets = recus - buts(autre(c));
    if (g && recus >= 25 && arrets / recus >= 0.94) faits.push({ poids: (arrets / recus - 0.9) * 25, txt: `${g.n} a arrêté ${arrets} des ${recus} tirs (${pct3(arrets / recus)}).` });
  }
  for (const c of ['A', 'B']) {
    const n = lancers.filter(l => l.cote === c && l.special === 'reussie').length;
    if (n >= 2) faits.push({ poids: 0.5 * n, txt: `${nom(c)} a réussi ${n} actions spéciales de ses systèmes.` });
  }
  const lignes = faits.sort((x, y) => y.poids - x.poids).slice(0, 3).map(x => x.txt);
  // Le but gagnant : celui qui a mis le vainqueur devant pour de bon.
  const vainqueur = buts('A') > buts('B') ? 'A' : 'B';
  const gagnant = f.buts.slice().sort((x, y) => x.instant - y.instant).filter(b => b.cote === vainqueur)[buts(autre(vainqueur))];
  if (gagnant && gagnant.marqueur) lignes.push(`Le but gagnant : ${gagnant.marqueur.n}, ${gagnant.instant >= 60 ? 'en prolongation' : `en ${NOM_PERIODE[Math.floor(gagnant.instant / 20) + 1]}`}.`);
  return lignes;
}

/*
 * LES FILS DE LA SAISON (V3.2). JP : *il ne raconte pas vraiment d'histoire*,
 * *une saison bizarre où un joueur de troisième trio est en feu, comme les 56
 * buts de Cheechoo*. Le moteur fait déjà naître ces saisons-là (la chance au
 * tir, le passeur qui fait mieux finir son trio) ; personne ne les disait.
 * Ici, on les repère, match après match, dans les feuilles DÉJÀ JOUÉES de ton
 * club, et rien d'autre : un fil cite les feuilles qui le prouvent (`preuves`,
 * des `{ j, k }` du calendrier), ne regarde jamais une journée à venir, et ne
 * lit aucune cote — que des buts, des passes, des matchs habillés, et la
 * vraie saison du joueur (`p.g`, `p.gp`), qui est une vraie statistique.
 * `check_fils` recompte chaque chiffre dit à partir de ses seules preuves.
 *
 * Les sortes, et le seuil qui les fait naître (`FILS`) :
 *   course    un rythme de 40 buts ou de 100 points, après 20 matchs
 *   jalon     30, 40, 50, 60 buts ; 60, 80, 100 points
 *   sequence  un point dans six matchs de suite, ou plus ; sa fin, à huit
 *   disette   un marqueur (0,3 but par match dans sa vraie saison)
 *             sans but depuis douze matchs ; la fin de la disette
 *   feu       le Cheechoo : 8 buts et plus, à 1,6 fois son vrai rythme
 *   duo       60 % de ses buts (au moins 7 sur 10) sur la passe du même joueur
 *   recrue    une vraie recrue (`p.rk`) à 0,6 point par match, après 10 matchs
 *   retour    un point dès son retour, après 5 matchs ou plus d'absence
 *
 * Le rendu : `journal`, journée par journée, les fils qui ont BOUGÉ ce
 * soir-là (le plus lourd d'abord : la une) ; `fils`, l'état final de chaque
 * fil, pour le bilan.
 */
export const FILS = {
  course: { buts: 40, points: 100, matchs: 20 },
  jalon: { buts: [30, 40, 50, 60], points: [60, 80, 100] },
  sequence: { min: 6, fin: 8 },
  disette: { min: 12, vrai: 0.3 },
  feu: { buts: 8, matchs: 15, facteur: 1.6, plancher: 0.12 },
  duo: { buts: 10, passes: 7, part: 0.6 },
  recrue: { matchs: 10, rythme: 0.6 },
  retour: { absence: 5 },
};

/** Le poids d'un fil qui entre dans ton histoire et au bilan : la course, le Cheechoo, le jalon, le duo, une longue séquence. */
export const FIL_MARQUANT = 5;

const oublier = (e, sorte) => { for (const c of [...e.crans]) if (c.startsWith(`${sorte}:`)) e.crans.delete(c); };
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function filsDeSaison(calendrier, you, jusqua = Infinity) {
  const etat = new Map();
  const de = p => {
    let e = etat.get(p);
    if (!e) {
      e = { p, gp: 0, g: 0, a: 0, pts: 0, joues: [], serie: [], sansBut: [], absent: 0, passes: new Map(), jalons: new Set(), crans: new Set() };
      etat.set(p, e);
    }
    return e;
  };
  const journal = [], fils = new Map();
  const fin = Math.min(jusqua, (calendrier || []).length);
  for (let j = 0; j < fin; j++) {
    const k = (calendrier[j] || []).findIndex(m => m && (m.A === you || m.B === you));
    if (k < 0) continue;
    const m = calendrier[j][k], f = m.feuille;
    if (!f || !f.alignes) continue;
    const cote = m.A === you ? 'A' : 'B', ref = { j, k };
    const habilles = f.alignes[cote] || [];
    const bougent = [];
    // Un fil qui dure ne refait la une qu'à un nouveau cran (`cran`) : le cinquième but d'une course, pas chacun.
    const pose = (arc, persiste = true, cran = null) => {
      const e = etat.get(arc.joueur);
      if (cran == null || !e.crans.has(`${arc.sorte}:${cran}`)) bougent.push(arc);
      if (cran != null) e.crans.add(`${arc.sorte}:${cran}`);
      if (persiste) {
        const cle = `${arc.sorte}|${arc.joueur.n}`;
        const avant = fils.get(cle);
        if (!avant || arc.sorte !== 'sequence' || arc.n >= avant.n) fils.set(cle, arc);
      }
    };
    // Les absents de ce soir : ceux qu'on a déjà vus, et qui ne sont pas habillés.
    const ce = new Set(habilles);
    for (const e of etat.values()) if (!ce.has(e.p)) e.absent++;
    for (const p of habilles) {
      const e = de(p);
      const sesButs = f.buts.filter(b => b.cote === cote && b.marqueur === p);
      const sesPasses = f.buts.filter(b => b.cote === cote && (b.passeurs || []).includes(p));
      const avantG = e.g, avantPts = e.pts, revient = e.gp > 0 && e.absent >= FILS.retour.absence ? e.absent : 0;
      e.gp++; e.g += sesButs.length; e.a += sesPasses.length; e.pts += sesButs.length + sesPasses.length; e.absent = 0;
      e.joues.push(ref);
      const nc = nomCourt(p.n), but = sesButs[sesButs.length - 1] || null, point = sesButs.length + sesPasses.length > 0;
      const arc = (sorte, texte, poids, preuves, extra = {}) => ({ sorte, joueur: p, texte, poids, jour: j, preuves, but, ...extra });
      for (const b of sesButs) for (const a of b.passeurs || []) e.passes.set(a, (e.passes.get(a) || []).concat([ref]));
      // LE JALON
      for (const s of FILS.jalon.buts) if (avantG < s && e.g >= s && !e.jalons.has(`g${s}`)) {
        e.jalons.add(`g${s}`);
        pose(arc('jalon', `${nc} atteint les ${s} buts, en ${e.gp} matchs.`, 4 + s / 10, e.joues.slice(), { seuil: s, unite: 'buts', n: e.gp }));
      }
      for (const s of FILS.jalon.points) if (avantPts < s && e.pts >= s && !e.jalons.has(`p${s}`)) {
        e.jalons.add(`p${s}`);
        pose(arc('jalon', `${nc} atteint les ${s} points, en ${e.gp} matchs.`, 3 + s / 25, e.joues.slice(), { seuil: s, unite: 'points', n: e.gp }));
      }
      // LA SÉQUENCE, et sa fin
      if (point) {
        e.serie.push(ref);
        if (e.serie.length >= FILS.sequence.min) pose(arc('sequence', `${nc} : un point dans ${e.serie.length} matchs de suite.`, 2 + e.serie.length / 3, e.serie.slice(), { n: e.serie.length }), true, Math.floor(e.serie.length / 2));
      } else {
        if (e.serie.length >= FILS.sequence.fin) pose(arc('sequence', `La séquence de ${nc} s'arrête à ${e.serie.length} matchs.`, 1.5, e.serie.concat([ref]), { n: e.serie.length, fini: true }), false);
        e.serie = [];
        oublier(e, 'sequence');
      }
      // LA DISETTE d'un vrai marqueur, et sa fin
      const marqueur = (p.gp || 0) >= 20 && (p.g || 0) / p.gp >= FILS.disette.vrai;
      if (sesButs.length) {
        if (marqueur && e.sansBut.length >= FILS.disette.min) fils.delete(`disette|${p.n}`);
        if (marqueur && e.sansBut.length >= FILS.disette.min) pose(arc('disette', `${nc} brise une disette de ${e.sansBut.length} matchs.`, 3 + e.sansBut.length / 6, e.sansBut.concat([ref]), { n: e.sansBut.length, fini: true }), false);
        e.sansBut = [];
        oublier(e, 'disette');
      } else {
        e.sansBut.push(ref);
        if (marqueur && e.sansBut.length >= FILS.disette.min) pose(arc('disette', `${nc} n'a pas marqué depuis ${e.sansBut.length} matchs.`, 1 + e.sansBut.length / 8, e.sansBut.slice(), { n: e.sansBut.length }), true, Math.floor(e.sansBut.length / 4));
      }
      if (sesButs.length) {
        // LE FEU : le Cheechoo, plus loin que sa vraie saison
        const vrai = (p.gp || 0) > 0 ? (p.g || 0) / p.gp : 0;
        if (e.gp >= FILS.feu.matchs && e.g >= FILS.feu.buts && e.g / e.gp >= FILS.feu.facteur * Math.max(vrai, FILS.feu.plancher)) {
          pose(arc('feu', `${nc} : ${pluriel(e.g, 'but')} en ${e.gp} matchs ; sa vraie saison, ${pluriel(p.g || 0, 'but')} en ${p.gp || 0}.`, 5 + e.g / 5, e.joues.slice(), { g: e.g, n: e.gp }), true, Math.floor(e.g / 4));
        }
        // LA COURSE aux buts
        if (e.gp >= FILS.course.matchs) {
          const r = Math.round(e.g / e.gp * 82);
          if (r >= FILS.course.buts) pose(arc('course', `${nc} : ${pluriel(e.g, 'but')} en ${e.gp} matchs, sur un rythme de ${r}.`, 3 + r / 10, e.joues.slice(), { g: e.g, n: e.gp, rythme: r }), true, Math.floor(e.g / 5));
        }
        // LE DUO : le passeur qui fait la saison du marqueur
        let meilleur = null;
        for (const [a, refs] of e.passes) if (!meilleur || refs.length > meilleur[1].length) meilleur = [a, refs];
        if (meilleur && e.g >= FILS.duo.buts && meilleur[1].length >= FILS.duo.passes && meilleur[1].length / e.g >= FILS.duo.part
          && sesButs.some(b => (b.passeurs || []).includes(meilleur[0]))) {
          const k2 = meilleur[1].length;
          pose(arc('duo', `${nc} : ${k2} de ses ${e.g} buts sur une passe de ${nomCourt(meilleur[0].n)}.`, 3 + k2 / 3, [...new Set(meilleur[1])], { passeur: meilleur[0], n: k2, g: e.g }), true, Math.floor(k2 / 4));
        }
      }
      if (point && !(e.gp >= FILS.course.matchs && Math.round(e.g / e.gp * 82) >= FILS.course.buts)) {
        // La course aux points, quand celle des buts ne la dit pas déjà
        if (e.gp >= FILS.course.matchs) {
          const r = Math.round(e.pts / e.gp * 82);
          if (r >= FILS.course.points) pose(arc('course', `${nc} : ${pluriel(e.pts, 'point')} en ${e.gp} matchs, sur un rythme de ${r}.`, 3 + r / 25, e.joues.slice(), { pts: e.pts, n: e.gp, rythme: r }), true, `p${Math.floor(e.pts / 10)}`);
        }
      }
      // LA RECRUE
      if (point && p.rk && e.gp >= FILS.recrue.matchs && e.pts / e.gp >= FILS.recrue.rythme) {
        pose(arc('recrue', `La recrue ${nc} : ${pluriel(e.pts, 'point')} en ${e.gp} matchs.`, 2.5 + e.pts / 10, e.joues.slice(), { pts: e.pts, n: e.gp }), true, Math.floor(e.pts / 10));
      }
      // LE RETOUR
      if (revient && point) {
        pose(arc('retour', `De retour après ${revient} matchs, ${nc} ${sesButs.length ? 'marque' : 'obtient un point'} dès son premier soir.`, 2.5, [ref], { n: revient }), false);
      }
    }
    if (bougent.length) journal.push({ j, k, fils: bougent.sort((x, y) => y.poids - x.poids) });
  }
  return { journal, fils: [...fils.values()].sort((x, y) => y.poids - x.poids) };
}

