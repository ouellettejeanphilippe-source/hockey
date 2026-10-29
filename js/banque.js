/**
 * LA BANQUE DE CARTES (S79 ; le jeu neuf de la V10, docs/refonte-v10.md).
 *
 * JP : *créer une vraie banque de cartes […] digne d'un vrai deck builder* ; puis (V10) *jeter toutes les cartes et
 * créer de zéro avec la nouvelle philosophie en tête*.
 *
 * UN SEUL REGISTRE pour tout ce qui se joue. Depuis la V16 (docs/refonte-v16.md), le PERSONNEL (les patrons,
 * js/personnel.js) est la seule carte bonus ; restent à côté dix cartes rares qui montent (tranche 6, § 4d) : les
 * retouches d'édition de l'atelier, le stage du coach, la formation d'un adjoint, trois soins et l'échange d'un doublon.
 * La masse salariale et le congédiement sont des dossiers du proprio (js/dossiers.js). Les cartes de match sont parties avec la main du duel (V13-2,
 * docs/refonte-v13.md). Presque chaque carte attend son MOMENT (`si`, `MOMENTS_SI`, js/sim.js). Chaque carte a un identifiant
 * (\`cat:cle\`), une catégorie, une rareté, une durée de vie, et sa RÈGLE en chiffres de match (\`reglesDe\`) :
 * « ≈ +0,2 but marqué par match », « ≈ −2 blessures par saison », jamais un pourcentage, jamais « un peu ».
 *
 * RIEN DE NEUF DANS LE MOTEUR. Une carte jouée est une DÉCISION (\`payloadDe\`) faite des champs que
 * \`appliquerDecision\` connaît déjà : \`effet\` (des canaux d'équipe pour quelques matchs), \`mutation\` (un joueur),
 * \`patron\` (le personnel, séries
 * comprises) et \`gestes\` (un soin, de l'énergie). La décision porte ses CHIFFRES : une partie reprise rejoue exactement
 * ce qui a été joué, même si la banque change entre-temps.
 *
 * LES POIDS (mesurés) : 1 % de précision ou de tirs ≈ 0,18 victoire sur une saison, 1 % de buts contre ≈ 0,24 à 0,32,
 * un point de robustesse ≈ 0,5. Chaque carte se mesure en paires, sur les soirs de son moment (`check_places`,
 * `check_cartes`).
 */
import { MUTATIONS, EDITIONS_REGLEMENT, MOMENTS_SI, LANCEE } from './sim.js';
import { PERSONNEL, PROTEGES, LIGNES_DU_FEU } from './personnel.js';
import { motsEnChiffres, motsDeMutationEnChiffres } from './impact.js';
import { formeDe, motsSurLeJoueur } from './gerant.js';
import { hache } from './util.js';
import { NIVEAUX } from './niveaux.js';
import { COACHS, ORDRE_COACHS, coachDesCanaux, palierDe, effetDePalier, SEUILS } from './coachs.js';

export const CATEGORIES = {
  patron: { ico: '👔', nom: 'Personnel', un: 'Adjoint', mot: 'Le personnel : un effet pour toute la saison, séries comprises. Un poste par rôle ; deux postes au départ, le prestige en ouvre d\'autres.' },
  joueur: { ico: '🧬', nom: 'Modifs de joueurs', un: 'Modif de joueur', mot: 'Un style, une clause, une amélioration ou une retouche de l\'atelier : elle se pose au verso d\'un joueur de ton choix, pour la saison.' },
  consommable: { ico: '🧴', nom: 'Consommables', un: 'Consommable', mot: 'Une utilisation : un soin, des jambes, le filet, les minutes, des jetons, ou un trou dans le règlement.' },
};
export const ORDRE_CATEGORIES = ['patron', 'joueur', 'consommable'];

/* ---------- LES PATRONS : le personnel, des reliques ---------- */

/* V19 : cinq postes, pas huit. Un adjoint d'avant garde le poste de son nom d'alors (`gardiens`, `soins`) ; on le lit au poste d'aujourd'hui. */
const POSTE_D_AVANT = { gardiens: 'defense', soins: 'physique' };
const posteDe = role => POSTE_D_AVANT[role] || role;
export const ROLES = {
  chef: { nom: 'Adjoint en chef', ico: '🧑‍💼' },
  attaque: { nom: 'Adjoint à l\'attaque', ico: '🎯' },
  defense: { nom: 'Adjoint à la défensive et aux gardiens', ico: '❄' },
  physique: { nom: 'Préparateur physique et soins', ico: '🏋' },
  depistage: { nom: 'Dépistage', ico: '🔭' },
  // V20 : l'argent quitte le banc. Une entente du proprio ne prend pas de chaise ; une à la fois, rangée chez lui.
  entente: { nom: 'Entente du proprio', ico: '🤝' },
};
/*
 * \`effet\` : les canaux de l'équipe, pour la saison. \`econ\` : ce que le
 * patron change à la boutique et aux jetons (\`rabais\` sur le prix des packs,
 * \`jetonsVictoire\` de plus par victoire, \`holo\` multiplie la chance d'une
 * holo ou mieux dans un pack de joueurs, \`carteExtra\`, \`sansBase\`).
 * \`synergie\` : si un patron du rôle \`avec\` est déjà engagé, l'effet de plus.
 */
export const PATRONS = {
  // V10 (tranche 6) : le personnel d'avant est parti. Restent le DG du plafond flexible (un déblocage le donne) et le
  // vendeur de chandails (une pièce du premier combo, la lancée : `check_combo`).
  dir_chandails: { role: 'entente', nom: 'Le vendeur de chandails', ico: '🛍', rarete: 'rare', texte: 'Un joueur en feu, et les chandails partent par boîtes.',
    econ: { jetonsLancee: 1 } },
  dir_flexible: { role: 'entente', nom: 'Le DG du plafond flexible', ico: '🧮', rarete: 'rare', texte: 'Il connaît chaque clause de la convention collective.',
    econ: { plafond: 0.05 } },
  /*
   * v2 — LES ADJOINTS DES COACHS (js/coachs.js). Un patron par coach qui
   * GRANDIT avec lui : `echelle.par` s'ajoute à son effet pour chaque carte de
   * son coach déjà jouée cette saison (au plus `max`), lu au moment de
   * l'engager — la décision porte le chiffre. Engagé tôt, il vaut peu ; engagé
   * quand huit cartes du coach sont jouées, il vaut un légendaire. C'est le « scaling » d'un
   * vrai roguelike, sur les canaux qui existent.
   */
  ...PERSONNEL,
};

/*
 * LE PLAFOND EFFECTIF À UNE JOURNÉE, pur : la base, l'espace gagné, la taxe,
 * le pourcentage du DG, et le « cap hit » de chaque joueur (sa retenue, son
 * rachat, son contrat d'entrée, ses bonis ; zéro s'il est au LTIR et blessé
 * ce jour-là). `blesses` : l'ensemble des clés à l'infirmerie à cette journée.
 * Rend { cap, lignes [{ nom, montant }], facteurs Map(clé → facteur), ltir Set }.
 */
export function plafondDe(decisions = [], jusqua = Infinity, { base = 0 } = {}) {
  const lignes = [];
  let cap = base;
  const facteurs = new Map(), ltir = new Set(), ecole = new Set();
  for (const d of [...decisions].filter(Boolean).sort((a, b) => (a.jour || 0) - (b.jour || 0))) {
    if ((d.jour || 0) >= jusqua) continue;
    // Le rappel du club-école (js/ballottage.js, `rappelDuClubEcole`) ne compte pas au plafond.
    if (d.ballottage && d.ballottage.ecole && d.ballottage.entre) ecole.add(d.ballottage.entre);
    const p = d.plafond;
    if (p) {
      if (p.espace) { cap += p.espace; lignes.push({ nom: p.nom || 'Espace', montant: p.espace }); }
      if (p.joueur && p.facteur) facteurs.set(p.joueur, (facteurs.get(p.joueur) || 1) * p.facteur);
      if (p.joueur && p.ltir) ltir.add(p.joueur);
    }
  }
  // Le pourcentage d'une entente du proprio (le fiscaliste, le DG du plafond flexible) : sa ligne, nommée.
  for (const x of patronsActifs(decisions, jusqua)) {
    const pct = (x.econ && x.econ.plafond) || 0;
    if (pct) { const m = Math.round(base * pct); cap += m; lignes.push({ nom: x.nom, montant: m }); }
  }
  return { cap, lignes, facteurs, ltir, ecole };
}

/* V10 (tranche 6) : les événements ont quitté la banque ; ce qui arrive au club est un dossier d'À faire (js/dossiers.js). */

/* ---------- LES CONSOMMABLES : une utilisation ---------- */
/*
 * \`vie\` : « usage » s'use cette saison (une utilisation) ; « permanent »
 * reste dans l'inventaire tant qu'on ne s'en sert pas, d'une run à l'autre
 * (mode Rogue). \`cible\` : ce qu'on vise en la jouant — un blessé, un joueur
 * ou rien.
 */
export const CONSOMMABLES = {
  glace: { nom: 'Glace et compression', ico: '🧊', rarete: 'commune', vie: 'usage', cible: 'blesse', gestes: { soin: 2 }, texte: 'Vingt minutes, trois fois par jour.' },
  physio: { nom: 'La séance de physio', ico: '💆', rarete: 'peu', vie: 'usage', cible: 'blesse', gestes: { soin: 5 }, texte: 'Des ultrasons et de la patience.' },
  chirurgie: { nom: 'La chirurgie éclair', ico: '🏥', rarete: 'rare', vie: 'permanent', cible: 'blesse', gestes: { soin: 12 }, effet: { blessure: 1.56 }, duree: 5, texte: 'Le meilleur chirurgien a une plage libre. Le retour presse, et les corps le paient.' },
  // L'échange d'un doublon (P3) : ton doublon le plus fourni part ; trois joueurs de son époque, hors de ton cartable (`echange`).
  echangeDoublon: { nom: 'L\'échange d\'un doublon', ico: '📟', rarete: 'peu', vie: 'usage', cible: 'cartable', offres: 3, niveauMax: 2, echange: true, texte: 'Un doublon de trop, contre un joueur de son époque.' },
  /*
   * V16 (tranche 6, docs/refonte-v16.md § 4d) : les cartes qui montent, rares. Le stage monte la confiance du coach en
   * poste d'un cran (les points qui lui manquent, sa base : `coachsDeBase`) ; la formation ouvre un échelon de plus à un
   * adjoint de ta collection (une copie, comme un doublon : `recevoirPermanents`, js/rogue.js).
   */
  stage: { nom: 'Le stage du coach', ico: '🎞', rarete: 'rare', vie: 'permanent', cible: 'coach', texte: 'Une semaine de vidéo chez les meilleurs. Il revient avec un cahier neuf.' },
  formation: { nom: 'La formation', ico: '🖊', rarete: 'peu', vie: 'permanent', cible: 'adjoint', texte: 'Un cours du soir, et ton adjoint en sait un peu plus.' },
};

/* ---------- LES MODIFS DE JOUEURS : des MUTATIONS au joueur de ton choix ---------- */
const SOURCES_MOD = ['atelier'];
/* V16 (docs/refonte-v16.md) : de l'atelier, seules les retouches d'édition restent des cartes ; l'équipement, les clauses,
 * le feu et les modifs d'un moment sont devenus des adjoints (js/personnel.js). */
const RARETE_MOD = { pinceau: 'commune', fenetre: 'peu', dorure: 'rare', lustre: 'legendaire', mentorTrio: 'rare' };
// Le mentor (`mentorTrio`) n'est pas une carte : il vient du choix d'un fil (js/vie-gm.js `CHOIX_DES_FILS`).
const MODS_JOUEUR = Object.keys(MUTATIONS).filter(k => SOURCES_MOD.includes(MUTATIONS[k].source) && !MUTATIONS[k].mentor);

/*
 * LES CASES D'AMÉLIORATION, AU VERSO (S80). JP : *je veux que les upgrades de
 * joueurs se fassent au verso de la carte, pas nécessairement quand on la
 * pige* ; *je clique sur le joueur, pis je dois aller au verso pour l'ajouter
 * dans une des slots joueurs?*. Une modif de joueur (une amélioration, une
 * édition de l'atelier, un style, un contrat) se GARDE dans l'inventaire, et
 * se POSE sur une case du verso d'un joueur de ton alignement. La carte a DEUX
 * cases ; une holo ou une or en a une de plus — la finition est la rareté de
 * la carte, et une carte rare en porte plus. Chaque carte posée prend une case
 * pour le reste de la saison, le lustre compris : monter une parallèle en holo
 * rend la case qu'il a prise.
 *
 * Ce qui est posé se lit dans les DÉCISIONS, pas dans le moteur : une carte
 * posée aujourd'hui ne s'applique qu'au matin de sa journée (rien ne se joue
 * d'avance), mais sa case est prise tout de suite. Les changements de carte
 * qui ne sont pas des modifs (un dilemme, un nouveau rôle, un accident) ne
 * prennent pas de case : ils sont ce qui lui est ARRIVÉ.
 */
export const CASES_DE_BASE = 2;
export const casesDAmelioration = variante => CASES_DE_BASE + (variante === 'rare' || variante === 'legendaire' ? 1 : 0);
/* Une modif qui se pose (et prend une case). */
export const sePose = cle => !!MUTATIONS[cle] && SOURCES_MOD.includes(MUTATIONS[cle].source);
/* Pour qui : une carte de gardien aux gardiens, les autres aux patineurs (avants et défenseurs). */
export const pourCeJoueur = (cle, estGardien) => !!MUTATIONS[cle] && !!MUTATIONS[cle].gardien === !!estGardien;
/* Les modifs posées sur un joueur, dans l'ordre : `{ cle, jour, carte }` (la variante d'un lustre). */
export function poseesSur(decisions = [], joueur) {
  // V9 (tranche 7) : une modif offerte pour la saison seulement (`saison`, le vétéran mentor d'un fil) ne prend pas de case.
  return decisions.filter(d => d && d.mutation && d.mutation.joueur === joueur && sePose(d.mutation.cle) && !d.mutation.saison)
    .sort((a, b) => (a.jour || 0) - (b.jour || 0))
    .map(d => ({ cle: d.mutation.cle, jour: d.jour || 0, carte: d.mutation.carte || null, joue: d.joue || null, deck: d.deck || null }));
}
/* La variante qu'a sa carte une fois ses lustres posés (chaque décision de lustre porte la suivante). */
export function varianteApres(variante, posees = []) {
  const l = posees.filter(x => x.carte && x.carte.rar).pop();
  return l ? l.carte.rar : variante;
}
/* Combien de cases il lui reste : celles de sa carte (lustres compris), moins les posées. */
export function casesLibres(variante, posees = []) {
  return Math.max(0, casesDAmelioration(varianteApres(variante, posees)) - posees.length);
}

/* ---------- LE REGISTRE ---------- */
const fait = (cat, cle, def) => ({ id: `${cat}:${cle}`, cat, cle, ...def });
/*
 * CE QU'UNE CARTE FAIT, pour lire son COACH (v2, js/coachs.js) : les champs
 * de sa famille ramenés à la même forme.
 */
function coachDeLaFamille(cat, cle) {
  const lu = o => coachDesCanaux(o);
  if (cat === 'patron') { const P = PATRONS[cle]; return P.coach || lu({ effet: P.effet, econ: P.econ, mutation: PROTEGES[cle] }); }
  if (cat === 'joueur') return lu({ mutation: MUTATIONS[cle] });
  if (cat === 'consommable') { const C = CONSOMMABLES[cle]; return C.coach || lu({ effet: C.effet, gestes: C.gestes }); }
  return null;
}
function construire() {
  const B = {};
  const mettre = c => { B[c.id] = { ...c, coach: coachDeLaFamille(c.cat, c.cle) }; };
  for (const [cle, P] of Object.entries(PATRONS)) mettre(fait('patron', cle, { nom: P.nom, ico: P.ico, rarete: P.rarete, texte: P.texte, vie: 'permanent', role: P.role }));
  for (const cle of MODS_JOUEUR) {
    const M = MUTATIONS[cle];
    mettre(fait('joueur', cle, { nom: M.nom, ico: M.ico, rarete: RARETE_MOD[cle] || M.rarete || 'peu', texte: M.quoi, vie: 'saison', gardien: !!M.gardien, source: M.source }));
  }
  for (const [cle, C] of Object.entries(CONSOMMABLES)) mettre(fait('consommable', cle, { nom: C.nom, ico: C.ico, rarete: C.rarete, texte: C.texte, vie: C.vie, cible: C.cible, ...(C.echange ? { echange: true } : {}) }));
  return B;
}
export const BANQUE = construire();
export const carteBanque = id => BANQUE[id] || null;
/*
 * LES DEUX PATRONS IMPOSÉS AU DÉPART D'UNE RUN (V2.3) : des passifs neutres, utiles à tous — un adjoint sans couleur
 * de coach, ou une entente du proprio (l'argent, V20) —, tirés de la graine de la run parmi les raretés que le prestige
 * ouvre (js/rogue.js `PRESTIGES`), deux rôles différents. Rend leurs id de banque.
 */
export const PATRONS_IMPOSES = 2;
export function patronsDeDepart(graine, raretes) {
  const out = [];
  const pool = Object.values(BANQUE).filter(c => c.cat === 'patron' && !c.coach && raretes.includes(c.rarete))
    .sort((a, b) => hache(graine, 'patron', a.id) - hache(graine, 'patron', b.id));
  for (const c of pool) if (out.length < PATRONS_IMPOSES && !out.some(x => BANQUE[x].role === c.role)) out.push(c.id);
  return out;
}
/* Ce qu'un patron change à la boutique et aux jetons, en mots (sa carte, et sa fiche à son échelon : js/echelons.js). */
export function motsDeLEcon(e = {}) {
  const out = [];
  if (!e) return out;
  if (e.rabais) out.push({ txt: `Packs ${Math.round((e.rabais - 1) * 100)} %`, bon: true });
  if (e.jetonsVictoire) out.push({ txt: `+${e.jetonsVictoire} 🪙 par victoire`, bon: true });
  if (e.jetonsLancee) out.push({ txt: `+${e.jetonsLancee} 🪙 par joueur sur sa lancée, chaque soir`, bon: true });
  if (e.holo) out.push({ txt: `Packs de joueurs : Or ou mieux +${Math.round((e.holo - 1) * 100)} %`, bon: true });
  if (e.carteExtra) out.push({ txt: `Packs de joueurs : +${e.carteExtra} carte`, bon: true });
  if (e.sansBase) out.push({ txt: 'Packs de joueurs : jamais une carte de base', bon: true });
  if (e.plafond) out.push({ txt: `Plafond salarial +${Math.round(e.plafond * 100)} %`, bon: true });
  return out;
}
/* Un canal d'équipe, du bon côté : buts contre, punitions, blessures et usure descendent. */
export const canalBon = (k, v) => (k === 'robustesse' ? v > 0 : (k === 'defense' || k === 'discipline' || k === 'blessure' || k === 'energie' ? v < 1 : v > 1));
const bitsDEffet = e => {
  const out = [];
  if (!e) return out;
  for (const k of ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse']) {
    const v = e[k];
    if (v == null || (k === 'robustesse' ? v === 0 : v === 1)) continue;
    out.push(canalBon(k, v));
  }
  return out;
};
/* La forme d'un consommable, lue sur toute la carte. Le mot dit le verbe, pas « un peu ». */
function formeDeConsommable(C) {
  if (!C) return '';
  const soin = !!(C.gestes && C.gestes.soin), bits = [...bitsDEffet(C.effet), ...(soin ? [true] : [])];
  if (bits.some(Boolean) && bits.some(b => !b)) return 'Échange';
  if (C.cible === 'coach' || C.cible === 'adjoint') return 'Monte';
  if (C.cible === 'cartable') return 'Échange';
  if (soin) return 'Soin';
  if (!bits.length) return '';
  return bits.every(Boolean) ? 'Cadeau' : 'Moindre mal';
}
/* La forme d'une carte de la banque, le mot qu'on lit avant les chiffres. Pas les cartes de joueur : elles disent leur édition. */
export function etiquetteBanque(id) {
  const c = carteBanque(id);
  if (!c) return '';
  if (c.cat === 'joueur') return (c.regle || EDITIONS_REGLEMENT.includes(c.cle)) ? 'Règlement' : '';
  if (c.cat === 'patron') {
    const P = PATRONS[c.cle] || {};
    return formeDe({ effet: P.effet || {} }) || (P.econ ? 'Boutique' : '');
  }
  if (c.cat === 'consommable') return formeDeConsommable(CONSOMMABLES[c.cle]);
  return '';
}
/* Les cartes d'une famille. V10 (tranche 6) : l'ancien jeu est parti, chaque carte de la banque se tire. */
export const idsDe = cat => Object.values(BANQUE).filter(c => c.cat === cat).map(c => c.id);
export const compteParCategorie = () => Object.fromEntries(ORDRE_CATEGORIES.map(c => [c, idsDe(c).length]));

/* Les étiquettes de durée de vie, telles que l'inventaire les affiche. */
export const VIES = {
  permanent: { nom: 'Permanente', mot: 'Reste dans ton inventaire tant que tu ne t\'en sers pas, d\'une run à l\'autre.' },
  // S80 : une run dure plusieurs saisons — une carte « cette saison » expire à la fin de SA saison, pas de la run.
  saison: { nom: 'Cette saison', mot: 'Vaut pour la saison en cours ; elle expire à la fin de la saison.' },
  usage: { nom: '1 utilisation', mot: 'S\'use en la jouant, cette saison.' },
};

/*
 * LA RÈGLE EN CHIFFRES d'une carte : des mots \`{ txt, bon }\`, les mêmes que
 * partout (\`motsEnChiffres\`, \`motsDeMutationEnChiffres\`). Les cartes de match ont la leur
 * (\`optionDeCarteMatch\`, js/gerant.js) : l'écran la lit là.
 */
/* `joueur` : le joueur qui la recevra (le verso d'une carte) — une modif se lit alors sur lui, pas sur sa cible par défaut. */
export function reglesDe(id, { joueur = null } = {}) {
  const c = carteBanque(id);
  if (!c) return [];
  if (c.cat === 'patron') {
    const P = PATRONS[c.cle];
    // V10 : son moment d'abord. Oct. (JP : *c'est useless, c'est juste contre rivaux*) : combien de soirs il revient par
    // saison (`parSaison`), et ses chiffres par soir, pas « par match » ; un protégé (JP : *le superstitieux est nuisible*)
    // dit ce qu'il donne à son joueur, sans quoi la face ne montrait que le défaut d'équipe.
    const M = P.si && MOMENTS_SI[P.si];
    const out = [...(M ? [{ txt: `${M.mot} : ses soirs seulement, ≈ ${M.parSaison} par saison`, bon: null, duree: true }] : []),
      ...(PROTEGES[c.cle] && !PROTEGES[c.cle].feu ? motsSurLeJoueur(PROTEGES[c.cle], 'Son protégé').map(m => ({ ...m, txt: m.mot })) : []),
      ...motsEnChiffres(P.effet || {}, null, M ? { par: 'par soir' } : null)];
    out.push(...motsDeLEcon(P.econ));
    if (P.synergie) out.push({ txt: `Avec ${ROLES[P.synergie.avec].nom.toLowerCase()} : ${motsEnChiffres(P.synergie.effet).map(x => x.txt).join(', ')}`, bon: true });
    if (P.echelle) out.push(motDEchelle(P.echelle, c.coach));
    if (PROTEGES[c.cle] && PROTEGES[c.cle].feu) out.push(...motsDuFeu(PROTEGES[c.cle]));
    if (!P.si) out.push({ txt: 'Toute la saison, séries comprises', bon: null, duree: true });
    return out;
  }
  if (c.cat === 'joueur') return motsDeMutationEnChiffres(c.cle, joueur);
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    const out = [...motsDesGestes(C.gestes || {})];
    if (C.effet) out.push(...motsEnChiffres(C.effet, C.duree));
    if (C.cible === 'coach') out.push({ txt: 'Ton coach en poste : un cran de confiance de plus', bon: true });
    if (C.cible === 'adjoint') out.push({ txt: 'Un adjoint de ta collection : un échelon de plus ouvert', bon: true });
    if (C.cible === 'cartable') out.push({ txt: `Ton doublon le plus fourni part : ${C.offres} joueurs de son époque, ${NIVEAUX[C.niveauMax].nom} au plus, un signé`, bon: true });
    return out;
  }
  return [];
}
/* LE FEU D'UN ADJOINT (V16, `LANCEE`, js/sim.js) : ce qu'il fait à la lancée de sa 1re ligne, et la 2e ligne qu'il gagne. */
function motsDuFeu(F) {
  const qui = F.portee === 'tete' ? 'Le meilleur marqueur de ta 1re ligne' : 'Un compagnon de ton meilleur marqueur, en 1re ligne';
  const fait = { etincelle: `sur sa lancée dès ${LANCEE.etincelle.buts} buts en ${LANCEE.matchs} matchs, et plus vive`,
    braise: `sa lancée tient ${LANCEE.braise.fenetre} matchs de plus, s'il marque une fois en ${LANCEE.braise.sans}`,
    poudre: 'il prend la lancée de celui qui l\'a' }[F.feu];
  const deux = F.portee === 'tete' ? 'la 2e ligne aussi' : 'tous les patineurs des 2 premières lignes';
  return [{ txt: `${qui} : ${fait}`, bon: true }, { txt: `Sa force poussée ${LIGNES_DU_FEU.poussees} fois aux échelons : ${deux}`, bon: true }];
}
/*
 * UN PAS, EN MOTS. Un pas s'AJOUTE à l'effet (js/banque.js `grandi`) : ce qu'une carte de coach gagne avec chaque
 * carte jouée, ou chaque joueur habillé, est trop petit pour se lire seul. On dit donc où elle arrive à son
 * plafond, en chiffres de match : « jusqu'à ≈ +0,6 tir par match avec 10 cartes du Frelon jouées ».
 */
function auPlafond(par = {}, max) {
  const e = Object.fromEntries(Object.entries(par).map(([k, v]) => [k, k === 'robustesse' ? v * max : 1 + v * max]));
  // Les deux chiffres qui comptent : on laisse de côté les tirs accordés, simple conséquence d'un volume.
  return motsEnChiffres(e).filter(m => m.cle !== 'rien' && m.cle !== 'tir accordé').slice(0, 2).map(m => m.txt);
}
/* « jusqu'à ≈ +0,6 tir par match avec 10 cartes 🐝 du Frelon jouées » : ce qu'une carte de coach gagne en grandissant. */
function motDEchelle(E, coach) {
  const Ec = COACHS[coach] || { ico: '', nom: '' };
  const pas = [...auPlafond(E.par, E.max), ...(E.gain ? [`+${E.gain} 🪙 par carte`] : [])].join(', ');
  return { txt: pas ? `Jusqu'à ${pas} avec ${E.max} cartes ${Ec.ico} ${Ec.de} jouées` : `Grandit avec chaque carte ${Ec.ico} ${Ec.de} jouée (au plus ${E.max})`, bon: true };
}
function motsDesGestes(g) {
  const out = [];
  if (g.soin) out.push({ txt: `${g.tousLesBlesses ? 'Tous tes blessés' : 'Un blessé'} : −${g.soin} match${g.soin > 1 ? 's' : ''} d'infirmerie`, bon: true });
  if (g.energie) out.push({ txt: `Un joueur : jambes ${g.energie > 0 ? '+' : '−'}${Math.abs(g.energie)}`, bon: g.energie > 0 });
  if (g.energieTous) out.push({ txt: `Tes patineurs : jambes ${g.energieTous > 0 ? '+' : '−'}${Math.abs(g.energieTous)}`, bon: g.energieTous > 0 });
  if (g.gardienAux) out.push({ txt: `L'auxiliaire garde le filet ${g.gardienAux} match${g.gardienAux > 1 ? 's' : ''}`, bon: null });
  return out;
}

/*
 * LES PATRONS ENGAGÉS à une journée : ce que les décisions ont posé, un par
 * rôle (le dernier engagé remplace l'autre). \`jusqua\` : journée exclue.
 */
export function patronsActifs(decisions = [], jusqua = Infinity) {
  const par = new Map();
  for (const d of [...decisions].filter(x => x && x.patron && x.patron.cle).sort((a, b) => (a.jour || 0) - (b.jour || 0))) {
    if ((d.jour || 0) >= jusqua) continue;
    const role = posteDe(d.patron.role || (PATRONS[d.patron.cle] || {}).role);
    for (const r of d.patron.remplace || []) for (const [k, v] of par) if (v.cle === r) par.delete(k);
    par.set(role, { ...d.patron, role, jour: d.jour });
  }
  // V20 : plus de contrat — un adjoint reste en poste tant qu'on ne le remplace pas.
  return [...par.values()];
}
/* Ce que les patrons engagés changent à la boutique (la décision d'engagement porte \`econ\`). */
export function modificateurs(decisions = [], jusqua = Infinity) {
  const m = { rabais: 1, holo: 1, carteExtra: 0, sansBase: false, jetonsVictoire: [], jetonsLancee: [] };
  // V20 : le Comptable est parti ; seules les ententes du proprio (et le vendeur de chandails) touchent la boutique.
  for (const p of patronsActifs(decisions, jusqua)) {
    const e = p.econ || {};
    if (e.rabais) m.rabais *= e.rabais;
    if (e.holo) m.holo *= e.holo;
    if (e.carteExtra) m.carteExtra += e.carteExtra;
    if (e.sansBase) m.sansBase = true;
  }
  for (const x of revenusDuPersonnel(decisions, jusqua)) m[x.sorte].push(x);
  return m;
}
/*
 * CE QUE LE PERSONNEL A RAPPORTÉ, POSTE PAR POSTE (oct.). Un adjoint qui paie (le caissier, le vendeur de chandails)
 * rapporte de son engagement au jour où il est remplacé, ou à un nouvel échelon, qui ouvre une période à son nouveau
 * chiffre. Avant, le revenu se comptait du dernier engagement des adjoints EN POSTE : acheter un échelon le jour 50
 * effaçait les 50 premiers jours de victoires payées, et remplacer le caissier effaçait tout ce qu'il avait rapporté —
 * la caisse pouvait tomber sous zéro, l'argent déjà dépensé. `jusqua` : la fin d'une période, exclue.
 */
function revenusDuPersonnel(decisions = [], jusqua = Infinity) {
  const out = [], ouverts = new Map();
  const fermer = (role, jour) => { const o = ouverts.get(role); if (!o) return; ouverts.delete(role); for (const x of o.periodes) out.push({ ...x, jusqua: jour }); };
  for (const d of [...decisions].filter(x => x && x.patron && x.patron.cle).sort((a, b) => (a.jour || 0) - (b.jour || 0))) {
    const jour = d.jour || 0;
    if (jour >= jusqua) continue;
    const role = posteDe(d.patron.role || (PATRONS[d.patron.cle] || {}).role);
    for (const r of d.patron.remplace || []) for (const [k, o] of [...ouverts]) if (o.cle === r) fermer(k, jour);
    fermer(role, jour);
    const e = d.patron.econ || {};
    ouverts.set(role, { cle: d.patron.cle, periodes: ['jetonsVictoire', 'jetonsLancee'].filter(k => e[k]).map(sorte => ({ sorte, depuis: jour, n: e[sorte], cle: d.patron.cle })) });
  }
  for (const o of ouverts.values()) out.push(...o.periodes);
  return out;
}

/*
 * CE QU'UNE CARTE DE COACH VAUT AUJOURD'HUI (v2) : son effet, plus `echelle.par`
 * pour chaque carte de son coach déjà jouée (`build`, au plus `max`) — et ses
 * jetons (`gain`, plus `echelle.gain` par carte). Une carte sans échelle rend
 * son effet tel quel. Les chiffres entrent dans la décision.
 */
function grandi(X, coach, build = {}) {
  const effet = { ...(X.effet || {}) };
  let gain = X.gain || 0;
  const ajouter = (par, n) => { for (const [k, v] of Object.entries(par || {})) effet[k] = Math.round(((effet[k] ?? (k === 'robustesse' ? 0 : 1)) + v * n) * 10000) / 10000; };
  const E = X.echelle;
  const n = E ? Math.min(E.max || Infinity, (build && build[X.coach || coach]) || 0) : 0;
  if (n) { ajouter(E.par, n); gain += (E.gain || 0) * n; }
  return { effet, gain, n };
}
/*
 * LA DÉCISION D'UNE CARTE JOUÉE : les champs que le moteur connaît, et ses
 * chiffres. \`cible\` : { joueur }. \`patrons\` : ceux déjà
 * engagés (pour le remplacement et la synergie). \`sel\` : de quoi tirer un
 * pari (le billet de loterie), pur.
 */
export function payloadDe(id, { joueur = null, coach = null, points = 0, adjoint = null, patrons = [], build = {}, sortie = null, rar = null } = {}) {
  const c = carteBanque(id);
  if (!c) return null;
  if (c.cat === 'patron') {
    const P = PATRONS[c.cle];
    const effet = grandi(P, c.coach, build).effet;
    let synergie = false;
    if (P.synergie && patrons.some(x => x.role === P.synergie.avec)) {
      synergie = true;
      for (const [k, v] of Object.entries(P.synergie.effet)) effet[k] = k === 'robustesse' ? (effet[k] || 0) + v : (effet[k] ?? 1) * v;
    }
    const remplace = patrons.filter(x => x.role === P.role && x.cle !== c.cle).map(x => x.cle);
    // V16 : un adjoint à protégé pose aussi sa mutation, pour la saison, sur le joueur nommé ou celui que le moteur désigne.
    return { patron: { cle: c.cle, role: P.role, nom: P.nom, ico: P.ico, ...effet, ...(P.si ? { si: P.si } : {}), ...(P.econ ? { econ: { ...P.econ } } : {}), ...(synergie ? { synergie: true } : {}), ...(remplace.length ? { remplace } : {}) },
      ...(PROTEGES[c.cle] ? { mutation: { cle: c.cle, ...(joueur ? { joueur } : {}), saison: true } } : {}) };
  }
  if (c.cat === 'joueur') return joueur ? { mutation: { cle: c.cle, joueur } } : null;
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    const effet = C.effet ? { nom: C.nom, ico: C.ico, duree: C.duree, ...grandi(C, c.coach, build).effet } : null;
    if (C.cible === 'blesse') return joueur ? { ...(C.gestes ? { gestes: { ...C.gestes, joueurs: [joueur] } } : {}), ...(effet ? { effet } : {}) } : null;
    // Le stage : les points qui manquent au coach en poste pour son cran suivant (`points`, lu par qui le joue).
    if (C.cible === 'coach') return coach && COACHS[coach] && points > 0 ? { coachsDeBase: { [coach]: points } } : null;
    // La formation : une copie de plus d'un adjoint de ta collection ; la décision la dit, le méta la garde.
    if (C.cible === 'adjoint') return adjoint && PATRONS[adjoint] ? { formation: { cle: adjoint } } : null;
    // L'échange : le joueur du cartable entre à la case que `sortie` libère, comme au ballottage.
    return joueur ? { ballottage: { entre: joueur, i: sortie ? sortie.i : null, sort: sortie ? sortie.sort : null, ...(rar ? { rar } : {}) }, ...(sortie && sortie.cases ? { cases: sortie.cases } : {}) } : null;
  }
  return null;
}

/* =====================================================================
   LE BUILD (v2) — les coachs que tes cartes jouées font croire au vestiaire
   ===================================================================== */
/* Le coach d'une carte de la banque (une carte « + » du deck lit sa carte de base), ou null (neutre). */
export const coachDeCarte = id => { const c = BANQUE[id] || BANQUE[String(id).replace(/\+$/, '')]; return c ? c.coach : null; };
export const idsDuCoach = coach => Object.values(BANQUE).filter(c => c.coach === coach).map(c => c.id);
/*
 * LA CONFIANCE PAR UN SEUL CHEMIN (V20, docs/refonte-v20.md ; JP : *oui à tout*). Les points d'un coach : sa BASE (le
 * coach choisi au départ, le report d'une saison, un coach neuf, le stage du coach : `coachsDeBase`, `coachNeuf`), puis
 * les blocs de dix matchs où son chiffre est tenu (js/chiffre.js `POINTS_PAR_BLOC`). Les adjoints en poste, leurs
 * échelons et leurs matchs à ton service ne comptent plus : ils poussent sa stat, et c'est sa stat qui compte.
 */
/* La base de chaque coach à une journée (`jusqua` exclue) : ce que le report et le départ lui donnent. Rend { cle: n }. */
export function baseDesCoachs(decisions = [], jusqua = Infinity) {
  const n = Object.fromEntries(ORDRE_COACHS.map(k => [k, 0]));
  for (const d of decisions) {
    if (!d || (d.jour || 0) >= jusqua) continue;
    if (d.coachsDeBase) for (const [k, v] of Object.entries(d.coachsDeBase)) if (k in n) n[k] += v || 0;
    // UN COACH NEUF (« Le congédiement », ou un autre choisi au début d'une saison) repart à la confiance I.
    if (d.coachNeuf && d.coach && d.coach.cle in n) n[d.coach.cle] = SEUILS[0];
  }
  return n;
}
/*
 * LE COMPTE DE CHAQUE COACH à une journée, pur : sa base, plus, pour le coach en poste, les points de ses blocs tenus
 * depuis son entrée en poste (`tenus(cle, jusqua, depuis)`, js/chiffre.js `tenusDe`) ; sans `tenus`, la base seule.
 */
export function buildDe(decisions = [], jusqua = Infinity, { tenus = () => 0 } = {}) {
  const n = baseDesCoachs(decisions, jusqua);
  const [C] = coachsActifs(decisions, jusqua);
  if (C && C.cle in n) n[C.cle] += tenus(C.cle, jusqua, entreeEnPoste(decisions, C.cle, jusqua));
  return n;
}
/* Le jour où ce coach est entré en poste cette saison : son dernier `coachNeuf` avant `jusqua`, sinon le jour 0. */
export function entreeEnPoste(decisions, cle, jusqua) {
  let j = 0;
  for (const d of decisions) if (d && d.coachNeuf && d.coach && d.coach.cle === cle && (d.jour || 0) < jusqua) j = Math.max(j, d.jour || 0);
  return j;
}
/*
 * LE COACH EN POSTE (V5, JP : *juste un coach peut être actif à la fois* ; *le coach, choisi au début de la saison,
 * ou changé avec une carte qui enlève l'autre bonus*). Un seul : la dernière confiance posée. Rend [] ou [coach].
 */
export function coachsActifs(decisions = [], jusqua = Infinity) {
  let dernier = null;
  for (const d of decisions) {
    if (!d || !d.coach || !d.coach.cle || (d.jour || 0) >= jusqua) continue;
    // V20 : le Comptable (`banque`) est parti ; une vieille partie qui l'avait en poste n'a plus de coach.
    if (!COACHS[d.coach.cle]) continue;
    if (!dernier || (d.jour || 0) >= dernier.jour) dernier = { ...d.coach, jour: d.jour || 0 };
  }
  return dernier ? [dernier] : [];
}
/* La décision d'un coach neuf : sa confiance I, et son compte qui repart (`coachNeuf`). */
export const coachNeuf = cle => ({ coach: effetDePalier(cle, 1), coachNeuf: true });
/*
 * LA CONFIANCE QU'ALLUME UNE DÉCISION (le matin d'un bloc tenu, le stage du coach) : son coach franchit-il un seuil, avec
 * elle et les blocs tenus jusqu'ici ? Rend `{ coach }` à ajouter à la décision (les chiffres de la confiance atteinte),
 * ou null. Pur : les décisions d'avant, celle-ci, et les blocs tenus (`tenus`).
 */
export function palierAllume(decisions = [], d, { tenus = () => 0 } = {}) {
  const jusqua = Number.isFinite(d.jour) ? d.jour + 1 : Infinity;
  const avant = buildDe(decisions, jusqua, { tenus }), apres = buildDe([...decisions, d], jusqua, { tenus });
  // Seul le coach en poste monte (V5).
  const [actif] = coachsActifs(decisions);
  const e = actif ? (palierDe(apres[actif.cle]) > actif.palier ? actif.cle : null)
    : ORDRE_COACHS.find(k => palierDe(apres[k]) > palierDe(avant[k]));
  return e ? { coach: effetDePalier(e, palierDe(apres[e])) } : null;
}
/* Ce qu'une confiance fait, en mots — les canaux, les minutes, la boutique. */
export function reglesDePalier(cle, palier) {
  const P = effetDePalier(cle, palier);
  if (!P) return [];
  const { cle: _c, palier: _p, nom: _n, ico: _i, econ, plafonds, prix, ...canaux } = P;
  void _c; void _p; void _n; void _i;
  // V11 : le gain, puis le prix de son style (qui ne grandit pas avec ses joueurs).
  const out = [...motsEnChiffres(canaux), ...(prix ? motsEnChiffres(prix) : [])];
  // V2.3 : la III relève le plafond du canal que la voie vise (js/sim.js `plafondsDe`).
  const MOT_PLAFOND = { finition: 'Plafond de précision relevé', pression: 'Plafond des tirs relevé', robustesse: 'Plafond de robustesse relevé', discipline: 'Plancher des punitions abaissé' };
  for (const [k, v] of Object.entries(plafonds || {})) if (v) out.push({ txt: MOT_PLAFOND[k], bon: true });
  if (econ && econ.rabais) out.push({ txt: `Packs ${Math.round((econ.rabais - 1) * 100)} %`, bon: true });
  if (econ && econ.jetonsVictoire) out.push({ txt: `+${econ.jetonsVictoire} 🪙 par victoire`, bon: true });
  if (econ && econ.plafond) out.push({ txt: `Plafond salarial +${Math.round(econ.plafond * 100)} %`, bon: true });
  // « à peine perceptible » se dit UNE fois, et jamais à côté d'une vraie ligne (tranche 2, la vérité des chiffres).
  const vrais = out.filter(m => m.cle !== 'rien');
  return vrais.length ? vrais : out.slice(0, 1);
}
