/**
 * LA BANQUE DE CARTES (S79 ; le jeu neuf de la V10, docs/refonte-v10.md).
 *
 * JP : *créer une vraie banque de cartes […] digne d'un vrai deck builder* ; puis (V10) *jeter toutes les cartes et
 * créer de zéro avec la nouvelle philosophie en tête*.
 *
 * UN SEUL REGISTRE pour tout ce qui se joue. Depuis la V21 (docs/refonte-v21.md), le personnel est parti : les
 * adjoints du staff sont partis (V22), jamais des cartes de la banque. Restent ici les
 * cartes rares (V16, tranche 6, § 4d) : les retouches d'édition de l'atelier, trois soins et l'échange d'un doublon (le
 * stage du coach est parti avec son expérience, V27, tranche 5).
 * La masse salariale d'une vieille décision se lit toujours ici (`plafondDe`). Les cartes de match sont parties avec la main du duel (V13-2,
 * docs/refonte-v13.md). Presque chaque carte attend son MOMENT (`si`, `MOMENTS_SI`, js/sim.js). Chaque carte a un identifiant
 * (\`cat:cle\`), une catégorie, une rareté, une durée de vie, et sa RÈGLE en chiffres de match (\`reglesDe\`) :
 * « ≈ +0,2 but marqué par match », « ≈ −2 blessures par saison », jamais un pourcentage, jamais « un peu ».
 *
 * RIEN DE NEUF DANS LE MOTEUR. Une carte jouée est une DÉCISION (\`payloadDe\`) faite des champs que
 * \`appliquerDecision\` connaît déjà : \`effet\` (des canaux d'équipe pour quelques matchs), \`mutation\` (un joueur),
 * \`gestes\` (un soin, de l'énergie). La décision porte ses CHIFFRES : une partie reprise rejoue exactement
 * ce qui a été joué, même si la banque change entre-temps.
 *
 * LES POIDS (mesurés) : 1 % de précision ou de tirs ≈ 0,18 victoire sur une saison, 1 % de buts contre ≈ 0,24 à 0,32,
 * un point de robustesse ≈ 0,5. Chaque carte se mesure en paires, sur les soirs de son moment (`check_places`,
 * `check_cartes`).
 */
import { MUTATIONS } from './sim.js';

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
    // Le rappel du club-école (une vieille décision `ballottage.ecole`) ne compte pas au plafond.
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

/* V10 (tranche 6) : les événements ont quitté la banque ; depuis la V25, ce qui arrive au club est une histoire (js/histoires.js). */

/* ---------- LES CONSOMMABLES : une utilisation ---------- */
/*
 * \`vie\` : « usage » s'use cette saison (une utilisation) ; « permanent »
 * reste dans l'inventaire tant qu'on ne s'en sert pas, d'une run à l'autre
 * (mode Rogue). \`cible\` : ce qu'on vise en la jouant — un blessé, un joueur
 * ou rien.
 */
const CONSOMMABLES = {
  glace: { nom: 'Glace et compression', ico: '🧊', niveau: 1, vie: 'usage', cible: 'blesse', gestes: { soin: 2 }, texte: 'Vingt minutes, trois fois par jour.' },
  physio: { nom: 'La séance de physio', ico: '💆', niveau: 2, vie: 'usage', cible: 'blesse', gestes: { soin: 5 }, texte: 'Des ultrasons et de la patience.' },
  chirurgie: { nom: 'La chirurgie éclair', ico: '🏥', niveau: 3, vie: 'permanent', cible: 'blesse', gestes: { soin: 12 }, canaux: { blessure: 1.56 }, duree: 5, texte: 'Le meilleur chirurgien a une plage libre. Le retour presse, et les corps le paient.' },
  // L'échange d'un doublon (P3) : ton doublon le plus fourni part ; trois joueurs de son époque, hors de ton cartable (`echange`).
  echangeDoublon: { nom: 'L\'échange d\'un doublon', ico: '📟', niveau: 2, vie: 'usage', cible: 'cartable', gestes: { echange: true, offres: 3 }, niveauMax: 2, texte: 'Un doublon de trop, contre un joueur de son époque.' },
};

/* ---------- LES MODIFS DE JOUEURS : des MUTATIONS au joueur de ton choix ---------- */
const SOURCES_MOD = ['atelier'];
/* V16 (docs/refonte-v16.md) : de l'atelier, seules les retouches d'édition restent des cartes ; l'équipement, les clauses,
 * le feu et les modifs d'un moment sont devenus des adjoints, partis à leur tour (V21, V22). */
/* Le niveau de chaque retouche (V25 B1 : l'échelle des joueurs ; c'était une rareté). */
const NIVEAU_MOD = { pinceau: 1, fenetre: 2, dorure: 3, lustre: 4, mentorTrio: 3 };
// Le mentor (`mentorTrio`) n'est pas une carte : il venait du choix d'un fil (V9, parti en V25 C1) ; une vieille partie le relit.
const MODS_JOUEUR = Object.keys(MUTATIONS).filter(k => SOURCES_MOD.includes(MUTATIONS[k].source) && !MUTATIONS[k].mentor);

/* ---------- LE REGISTRE ---------- */
const fait = (cat, cle, def) => ({ id: `${cat}:${cle}`, cat, cle, ...def });
function construire() {
  const B = {};
  const mettre = c => { B[c.id] = c; };
  for (const cle of MODS_JOUEUR) {
    const M = MUTATIONS[cle];
    mettre(fait('joueur', cle, { nom: M.nom, ico: M.ico, niveau: NIVEAU_MOD[cle] ?? 2, texte: M.quoi, vie: 'saison', gardien: !!M.gardien, source: M.source }));
  }
  for (const [cle, C] of Object.entries(CONSOMMABLES)) mettre(fait('consommable', cle, { nom: C.nom, ico: C.ico, niveau: C.niveau, texte: C.texte, vie: C.vie, cible: C.cible, ...(C.gestes && C.gestes.echange ? { echange: true } : {}) }));
  return B;
}
export const BANQUE = construire();
