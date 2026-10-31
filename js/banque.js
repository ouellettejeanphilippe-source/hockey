/**
 * LA BANQUE DE CARTES (S79 ; le jeu neuf de la V10, docs/refonte-v10.md).
 *
 * JP : *créer une vraie banque de cartes […] digne d'un vrai deck builder* ; puis (V10) *jeter toutes les cartes et
 * créer de zéro avec la nouvelle philosophie en tête*.
 *
 * UN SEUL REGISTRE pour tout ce qui se joue. Depuis la V21 (docs/refonte-v21.md), le personnel est parti : les
 * adjoints du staff sont partis (V22), jamais des cartes de la banque. Restent ici les
 * cartes rares (V16, tranche 6, § 4d) : les retouches d'édition de l'atelier, le stage du coach, trois soins et
 * l'échange d'un doublon.
 * La masse salariale et le congédiement sont des dossiers du proprio (js/dossiers.js). Les cartes de match sont parties avec la main du duel (V13-2,
 * docs/refonte-v13.md). Presque chaque carte attend son MOMENT (`si`, `MOMENTS_SI`, js/sim.js). Chaque carte a un identifiant
 * (\`cat:cle\`), une catégorie, une rareté, une durée de vie, et sa RÈGLE en chiffres de match (\`reglesDe\`) :
 * « ≈ +0,2 but marqué par match », « ≈ −2 blessures par saison », jamais un pourcentage, jamais « un peu ».
 *
 * RIEN DE NEUF DANS LE MOTEUR. Une carte jouée est une DÉCISION (\`payloadDe\`) faite des champs que
 * \`appliquerDecision\` connaît déjà : \`effet\` (des canaux d'équipe pour quelques matchs), \`mutation\` (un joueur),
 * \`gestes\` (un soin, de l'énergie) et \`xpCoach\` (de l'expérience au coach). La décision porte ses CHIFFRES : une partie reprise rejoue exactement
 * ce qui a été joué, même si la banque change entre-temps.
 *
 * LES POIDS (mesurés) : 1 % de précision ou de tirs ≈ 0,18 victoire sur une saison, 1 % de buts contre ≈ 0,24 à 0,32,
 * un point de robustesse ≈ 0,5. Chaque carte se mesure en paires, sur les soirs de son moment (`check_places`,
 * `check_cartes`).
 */
import { MUTATIONS, EDITIONS_REGLEMENT } from './sim.js';
import { motsEnChiffres, motsDeMutationEnChiffres } from './impact.js';
import { NIVEAUX } from './niveaux.js';

export const CATEGORIES = {
  joueur: { ico: '🧬', nom: 'Modifs de joueurs', un: 'Modif de joueur', mot: 'Un style, une clause, une amélioration ou une retouche de l\'atelier : elle se pose au verso d\'un joueur de ton choix, pour la saison.' },
  consommable: { ico: '🧴', nom: 'Consommables', un: 'Consommable', mot: 'Une utilisation : un soin, des jambes, le filet, les minutes, des jetons, ou un trou dans le règlement.' },
};
export const ORDRE_CATEGORIES = ['joueur', 'consommable'];

/*
 * LE PLAFOND EFFECTIF À UNE JOURNÉE, pur : la base, l'espace gagné, la taxe,
 * et le « cap hit » de chaque joueur (sa retenue, son
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
  // Le stage (V21) : de l'expérience au coach de la run (js/pouvoirs.js `XP`), tout de suite.
  stage: { nom: 'Le stage du coach', ico: '🎞', rarete: 'rare', vie: 'permanent', cible: 'coach', xp: 8, texte: 'Une semaine de vidéo chez les meilleurs. Il revient avec un cahier neuf.' },
};

/* ---------- LES MODIFS DE JOUEURS : des MUTATIONS au joueur de ton choix ---------- */
const SOURCES_MOD = ['atelier'];
/* V16 (docs/refonte-v16.md) : de l'atelier, seules les retouches d'édition restent des cartes ; l'équipement, les clauses,
 * le feu et les modifs d'un moment sont devenus des adjoints, partis à leur tour (V21, V22). */
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
function construire() {
  const B = {};
  const mettre = c => { B[c.id] = c; };
  for (const cle of MODS_JOUEUR) {
    const M = MUTATIONS[cle];
    mettre(fait('joueur', cle, { nom: M.nom, ico: M.ico, rarete: RARETE_MOD[cle] || M.rarete || 'peu', texte: M.quoi, vie: 'saison', gardien: !!M.gardien, source: M.source }));
  }
  for (const [cle, C] of Object.entries(CONSOMMABLES)) mettre(fait('consommable', cle, { nom: C.nom, ico: C.ico, rarete: C.rarete, texte: C.texte, vie: C.vie, cible: C.cible, ...(C.echange ? { echange: true } : {}) }));
  return B;
}
export const BANQUE = construire();
export const carteBanque = id => BANQUE[id] || null;
/* Un canal d'équipe, du bon côté : buts contre, punitions, blessures et usure descendent. */
const canalBon = (k, v) => (k === 'robustesse' ? v > 0 : (k === 'defense' || k === 'discipline' || k === 'blessure' || k === 'energie' ? v < 1 : v > 1));
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
  if (C.cible === 'coach') return 'Monte';
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
  if (c.cat === 'joueur') return motsDeMutationEnChiffres(c.cle, joueur);
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    const out = [...motsDesGestes(C.gestes || {})];
    if (C.effet) out.push(...motsEnChiffres(C.effet, C.duree));
    if (C.cible === 'coach') out.push({ txt: `Ton coach : +${C.xp} d'expérience`, bon: true });
    if (C.cible === 'cartable') out.push({ txt: `Ton doublon le plus fourni part : ${C.offres} joueurs de son époque, ${NIVEAUX[C.niveauMax].nom} au plus, un signé`, bon: true });
    return out;
  }
  return [];
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
 * LA DÉCISION D'UNE CARTE JOUÉE : les champs que le moteur connaît, et ses
 * chiffres. \`cible\` : { joueur }.
 */
export function payloadDe(id, { joueur = null, sortie = null, rar = null } = {}) {
  const c = carteBanque(id);
  if (!c) return null;
  if (c.cat === 'joueur') return joueur ? { mutation: { cle: c.cle, joueur } } : null;
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    const effet = C.effet ? { nom: C.nom, ico: C.ico, duree: C.duree, ...C.effet } : null;
    if (C.cible === 'blesse') return joueur ? { ...(C.gestes ? { gestes: { ...C.gestes, joueurs: [joueur] } } : {}), ...(effet ? { effet } : {}) } : null;
    // Le stage : de l'expérience au coach de la run.
    if (C.cible === 'coach') return { xpCoach: C.xp };
    // L'échange : le joueur du cartable entre à la case que `sortie` libère, comme au ballottage.
    return joueur ? { ballottage: { entre: joueur, i: sortie ? sortie.i : null, sort: sortie ? sortie.sort : null, ...(rar ? { rar } : {}) }, ...(sortie && sortie.cases ? { cases: sortie.cases } : {}) } : null;
  }
  return null;
}
