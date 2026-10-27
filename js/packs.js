/**
 * LES PACKS (S79) — à la HUT, à la FUT, à MLB The Show… et à la boîte de
 * cartes du dépanneur.
 *
 * JP : *une variété de packs de cartes randoms digne de HUT, FUT ou MLB the
 * show mobile* ; puis : *pack d'équipe, pack d'année, pack par skill, pack par
 * trio, pack all random, avec des vrais pull rates de cartes de hockey,
 * pokemon, etc, que c'est du gambling pour le mode roguelike*.
 *
 * LES VRAIS TAUX. Une boîte « hobby » d'Upper Deck donne une Young Guns
 * toutes les quatre pochettes, une parallèle numérotée /100 par boîte, un
 * « 1 de 1 » dans une caisse sur cent ; un booster Pokémon donne une holo
 * rare toutes les trois pochettes, une ultra rare toutes les sept, une rare
 * secrète toutes les soixante-dix. Nos variantes (js/rarete.js) sont posées
 * sur ces barèmes, par TIER de pack :
 *
 *   (le barème vit dans `TIERS`, plus bas : une table recopiée ici avait
 *   vieilli. Oct. 2026 : cinq éditions, Base, Cadre, Hors-cadre, Or, Holo.)
 *
 * Et la Holo est NUMÉROTÉE, comme les parallèles des séries de luxe : /99 (78 %),
 * /25 (16 %), /10 (5 %) — et le « 1 de 1 » (1 % des Holo). Le numéro est
 * COSMÉTIQUE : la Holo joue ce que la Holo joue (js/rarete.js), rien de plus —
 * la chasse ne casse pas le jeu.
 *
 * CHAQUE PACK AFFICHE SES CHANCES (\`chancesDe\`), en « 1 pack sur N » —
 * comme les packs de FUT depuis 2019. Et la GARANTIE (\`PITIE\`) : en mode
 * Rogue, `PITIE` packs de joueurs d'affilée sans Or ni Holo, et le suivant en
 * a une. Elle est dite dans la boutique.
 *
 * TOUT EST PUR : un pack se tire de la graine de la partie, de son genre et du
 * numéro de l'achat. Une partie reprise ouvre les mêmes packs.
 *
 * S80 — LE JOUEUR, PUIS SA FINITION. JP : *packs selon les niveaux de
 * joueurs, genre joueur moins bons plus fréquents, du moins, joueurs brisés
 * moins fréquents*. Une carte de pack se tire sur DEUX axes, comme dans une
 * vraie boîte : le JOUEUR (son niveau dans sa vraie saison, js/niveaux.js :
 * Soutien, Régulier, Pilier, Étoile, Phénomène) et la FINITION de sa carte
 * (la variante ci-dessus). Les deux sont indépendants : un Soutien peut
 * sortir en or, un Phénomène en base. Les taux du joueur, par carte (en %) :
 *
 *   tier      Soutien  Régulier  Pilier  Étoile  Phénomène   un Phénomène
 *   bronze       50       36       12      1,8      0,2       1 pack sur 167
 *   argent       36       38       21      4,4      0,6       1 pack sur 42
 *   or           24       38       30      7        1         1 pack sur 20
 *   premium      12       36       38     12        2         1 pack sur 9
 *
 * Avant (mesuré par scripts/check_packs.mjs), la moitié productive d'une
 * saison, à parts égales : un Phénomène sortait à 2,2 % par carte — d'un
 * pack Bronze sur 15, d'un Premium sur 8 — et un Soutien presque jamais
 * (6 %). Le Phénomène sort maintenant d'un Bronze sur 167, d'un Premium sur
 * 9 ; le Soutien fait la moitié d'un Bronze. Le tier compte enfin : le
 * meilleur joueur d'un pack est un Pilier ou mieux dans 37 % des Bronze
 * (73 % avant), 99 % des Premium (93 % avant). Les packs Étoiles et Légendes
 * restent des packs d'étoiles, avec leur part de Phénomènes à eux (8 et 10 %
 * par carte ; tirées à parts égales, une étoile sur cinq en était un, et
 * sept packs Étoiles sur dix en donnaient un) ; les packs par talent gardent
 * leur filtre et le Trio, sa vraie ligne : ni l'un ni l'autre ne tire de niveau.
 */
import { hache } from './util.js';
import { BANQUE, idsDe, idsDuCoach } from './banque.js';
import { COACHS, ORDRE_COACHS, VOIES } from './coachs.js';
import { getPlayerKey, getPersonKey, coachDuJoueur, badgesDe, famillesDe } from './sim.js';
import { FRANCHISES, codeDeFranchise, saisonsDeFranchise } from './franchises.js';
import { ageAtSeason } from './ratings.js';
import { NIVEAUX, groupeDuJoueur, niveauDe, joueursParNiveau, joueursHorsNiveau } from './niveaux.js';
import { IDENTITES } from './identites.js';
import { statureDe, EDITIONS } from './rarete.js';

/*
 * 1.0 — MOINS D'ÉTOILES (JP : *les packs sont trop généreux en joueurs étoiles*).
 * Au moins une étoile ou un phénomène par pack : Bronze 2,5 %, Argent 7 %, Or 16 %,
 * Premium 35 % (avant : 6, 18, 34, 60 %). La part retirée va aux réguliers et aux piliers.
 */
export const TIERS = {
  bronze: { nom: 'Bronze', n: 3, cotes: { commune: 84, peu: 11, hors: 3, rare: 1.8, legendaire: 0.2 }, niveaux: { soutien: 51, regulier: 37, pilier: 11.15, etoile: 0.8, phenomene: 0.05 } },
  argent: { nom: 'Argent', n: 4, cotes: { commune: 74, peu: 17, hors: 5, rare: 3.5, legendaire: 0.5 }, niveaux: { soutien: 38, regulier: 39, pilier: 21.25, etoile: 1.6, phenomene: 0.15 } },
  or: { nom: 'Or', n: 5, cotes: { commune: 62.5, peu: 23, hors: 7, rare: 6, legendaire: 1.5 }, niveaux: { soutien: 26, regulier: 40, pilier: 30.6, etoile: 3, phenomene: 0.4 } },
  premium: { nom: 'Premium', n: 6, cotes: { commune: 52, peu: 26, hors: 9, rare: 10, legendaire: 3 }, niveaux: { soutien: 14, regulier: 40, pilier: 39, etoile: 6, phenomene: 1 } },
};
/* La numérotation d'une Holo (en % des Holo). */
export const NUMEROS = [['/99', 78], ['/25', 16], ['/10', 5], ['1 de 1', 1]];
/* En mode Rogue : PITIE packs de joueurs sans Or ni Holo, et le suivant en a une. */
export const PITIE = 12;   // V5 : la holo est rare ; la garantie arrive plus tard aussi
/*
 * LA DATE LIMITE DES ÉCHANGES (1.0, oct.). JP : *rendre impossible de prendre
 * des packs de joueurs après la date limite des échanges*. Comme la vraie
 * ligue, fin février : après ton 62e match, plus aucun joueur n'entre par un
 * pack. Le rappel d'un blessé (le ballottage), lui, reste ouvert.
 */
export const DATE_LIMITE_MATCH = 62;

/*
 * LES PACKS DE JOUEURS. \`famille\` dit où l'on pige ; \`choix\` : le pack se
 * règle à l'achat (une franchise, une saison) ou au hasard. Les familles
 * hasard, équipe, année et ère tirent le NIVEAU aux taux de leur tier ;
 * \`niveaux\` les remplace pour les packs d'étoiles.
 */
export const PACKS_JOUEURS = {
  hasard_bronze: { famille: 'hasard', nom: 'Pack Bronze', ico: '🥉', tier: 'bronze', prix: 12, texte: 'Trois vrais joueurs de toutes les époques.' },
  hasard_argent: { famille: 'hasard', nom: 'Pack Argent', ico: '🥈', tier: 'argent', prix: 20, texte: 'Quatre vrais joueurs de toutes les époques.' },
  hasard_or: { famille: 'hasard', nom: 'Pack Or', ico: '🥇', tier: 'or', prix: 35, texte: 'Cinq vrais joueurs, de meilleures chances.' },
  hasard_premium: { famille: 'hasard', nom: 'Pack Premium', ico: '💎', tier: 'premium', prix: 60, texte: 'Six vrais joueurs, les meilleures chances de la boutique.' },
  equipe: { famille: 'equipe', nom: 'Pack d\'équipe', ico: '🏟', tier: 'argent', prix: 25, choix: 'franchise', texte: 'Quatre joueurs d\'une même franchise, toutes époques confondues.' },
  annee: { famille: 'annee', nom: 'Pack d\'année', ico: '📅', tier: 'argent', prix: 25, choix: 'saison', texte: 'Quatre joueurs d\'une même saison.' },
  ere70: { famille: 'ere', nom: 'Pack années 70', ico: '📻', tier: 'argent', prix: 22, decennie: 1970, texte: 'Quatre joueurs des années 70.' },
  ere80: { famille: 'ere', nom: 'Pack années 80', ico: '📼', tier: 'argent', prix: 22, decennie: 1980, texte: 'Quatre joueurs des années 80.' },
  ere90: { famille: 'ere', nom: 'Pack années 90', ico: '💾', tier: 'argent', prix: 22, decennie: 1990, texte: 'Quatre joueurs des années 90.' },
  ere00: { famille: 'ere', nom: 'Pack années 2000', ico: '📀', tier: 'argent', prix: 22, decennie: 2000, texte: 'Quatre joueurs des années 2000.' },
  ere10: { famille: 'ere', nom: 'Pack années 2010', ico: '📱', tier: 'argent', prix: 22, decennie: 2010, texte: 'Quatre joueurs des années 2010.' },
  ere20: { famille: 'ere', nom: 'Pack années 2020', ico: '🛰', tier: 'argent', prix: 22, decennie: 2020, texte: 'Quatre joueurs des années 2020.' },
  sniper: { famille: 'skill', nom: 'Pack Francs-tireurs', ico: '🎯', tier: 'argent', prix: 28, skill: 'sniper', texte: 'Quatre joueurs du Tir : le quart du haut à leurs points égaux.' },
  passeur: { famille: 'skill', nom: 'Pack Passeurs', ico: '🪄', tier: 'argent', prix: 28, skill: 'passeur', texte: 'Quatre joueurs du Jeu : le quart du haut à leurs points égaux.' },
  defensif: { famille: 'skill', nom: 'Pack Défensif', ico: '❄', tier: 'argent', prix: 25, skill: 'defensif', texte: 'Quatre joueurs de la Défense : le quart du haut à leurs points égaux.' },
  dur: { famille: 'skill', nom: 'Pack Durs à cuire', ico: '🥊', tier: 'argent', prix: 22, skill: 'dur', texte: 'Quatre joueurs de la Robustesse : le quart du haut à leurs points égaux.' },
  gardien: { famille: 'skill', nom: 'Pack Gardiens', ico: '🥅', tier: 'argent', prix: 30, skill: 'gardien', texte: 'Quatre gardiens partants au meilleur pourcentage d\'arrêts de leur saison.' },
  recrue: { famille: 'skill', nom: 'Pack Recrues', ico: '🐣', tier: 'argent', prix: 22, skill: 'recrue', texte: 'Quatre joueurs à leur contrat d\'entrée.' },
  veteran: { famille: 'skill', nom: 'Pack Vétérans', ico: '🧓', tier: 'argent', prix: 22, skill: 'veteran', texte: 'Quatre joueurs de 33 ans et plus.' },
  trio: { famille: 'trio', nom: 'Pack Trio', ico: '🔗', tier: 'or', prix: 40, texte: 'Une vraie ligne d\'un même club-saison : son centre et ses deux ailiers — ou sa paire et son gardien.' },
  etoiles: { famille: 'etoiles', nom: 'Pack Étoiles', ico: '⭐', tier: 'or', prix: 55, niveaux: { etoile: 92, phenomene: 8 }, texte: 'Cinq étoiles de leur saison : le 4 % du haut à leur poste.' },
  legendes: { famille: 'legendes', nom: 'Pack Légendes', ico: '👑', tier: 'premium', prix: 75, niveaux: { etoile: 90, phenomene: 10 }, texte: 'Six étoiles d\'avant 1995.' },
  garanti: { famille: 'hasard', nom: 'Pack garanti', ico: '🔒', tier: 'or', prix: 45, garanti: true, texte: 'Cinq joueurs, dont une Or ou mieux, garantie.' },
  /*
   * LA BOUTIQUE DU JALON P (P2). JP : *on limite les packs, tout en gardant des thématiques* ; *je veux que les cartes
   * de match, événements, etc. soient avec les cartes de joueurs*. Sept packs (\`BOUTIQUE\`), tous MIXTES : des
   * joueurs (\`joueurs\`) et des cartes de la banque (\`cartes\`), le thème choisi à l'achat (\`choix\`). Les packs
   * d'avant restent définis : une vieille partie les ouvre encore ; ils ne se vendent plus.
   */
  bronze: { famille: 'hasard', nom: 'Pack Bronze', ico: '🥉', tier: 'bronze', joueurs: 3, cartes: 1, prix: 14, texte: 'Trois vrais joueurs de toutes les époques, et un adjoint.' },
  argent: { famille: 'hasard', nom: 'Pack Argent', ico: '🥈', tier: 'argent', joueurs: 3, cartes: 2, prix: 22, texte: 'Trois vrais joueurs, un adjoint, et parfois une carte rare, de meilleures chances.' },
  or: { famille: 'hasard', nom: 'Pack Or', ico: '🥇', tier: 'or', joueurs: 4, cartes: 2, prix: 38, texte: 'Quatre vrais joueurs, un adjoint, et parfois une carte rare, les meilleures chances de la boutique.' },
  // V10 : le pack à thème de la première run, au métal du Bronze ; ses crans le montent (js/rogue.js `CRANS_DE_PACK`).
  epoque: { famille: 'ere', nom: 'Pack Époque', ico: '📼', tier: 'bronze', choix: 'decennie', joueurs: 3, cartes: 2, prix: 20, texte: 'Trois joueurs de la décennie de ton choix, un adjoint, et parfois une carte rare.' },
  specialistes: { famille: 'skill', nom: 'Pack Spécialistes', ico: '🎯', tier: 'argent', choix: 'skill', joueurs: 3, cartes: 2, prix: 28, texte: 'Trois spécialistes de la famille de ton choix, le quart du haut à leurs points égaux, un adjoint, et parfois une carte rare.' },
  club: { famille: 'equipe', nom: 'Pack Club', ico: '🏟', tier: 'argent', choix: 'franchise', joueurs: 3, cartes: 2, prix: 28, texte: 'Trois joueurs de la franchise de ton choix, toutes époques confondues, un adjoint, et parfois une carte rare.' },
  // V10 : le pack d'étoiles de la boutique, mixte comme les autres, que la Coupe ouvre (js/rogue.js `packsOuverts`).
  vedettes: { famille: 'etoiles', nom: 'Pack Vedettes', ico: '🌟', tier: 'or', niveaux: { etoile: 92, phenomene: 8 }, joueurs: 3, cartes: 2, prix: 70, texte: 'Trois étoiles de leur saison, le 4 % du haut à leur poste, un adjoint, et parfois une carte rare.' },
  coach: { famille: 'coach', nom: 'Pack du coach', ico: '📋', tier: 'argent', choix: 'coach', joueurs: 3, cartes: 2, prix: 30, texte: 'Trois joueurs de la couleur d\'un coach, et deux adjoints de sa couleur : de quoi bâtir sa confiance.' },
};
/* Les packs que la boutique vend (Jalon P2 ; V10 : les Vedettes, que la Coupe ouvre), dans son ordre. */
export const BOUTIQUE = ['j:bronze', 'j:argent', 'j:or', 'j:epoque', 'j:specialistes', 'j:club', 'j:coach', 'j:vedettes'];
/* Les décennies du Pack Époque, et les rôles du Pack Spécialistes, avec leur nom. */
export const DECENNIES = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
export const NOMS_SKILLS = { sniper: '🎯 Tir', passeur: '🪄 Jeu', defensif: '❄ Défense', dur: '🥊 Robustesse', gardien: '🥅 Gardiens', recrue: '🐣 Recrues', veteran: '🧓 Vétérans' };

/* LES PACKS DE CARTES : la banque (js/banque.js). Toutes gardées dans ton inventaire. V9 (JP, 17 oct. : *retire*) : ni
   Pack Événements, ni événement dans un pack — les gestes du DG sont les routes de la semaine (js/noeuds.js). */
const COTES_CARTES = { commune: 55, peu: 30, rare: 12, legendaire: 3 };
export const PACKS_CARTES = {
  patrons: { nom: 'Pack Personnel', ico: '👔', n: 3, prix: 30, cats: ['patron'], cotes: { commune: 45, peu: 35, rare: 16, legendaire: 4 }, texte: 'Trois patrons : le personnel qu\'on engage pour toute la saison.' },
};

/* Tous les packs, par clé : \`j:\` les joueurs, \`c:\` les cartes. */
export const PACKS_TOUS = {
  ...Object.fromEntries(Object.entries(PACKS_JOUEURS).map(([k, P]) => [`j:${k}`, { ...P, sorte: 'joueurs', cle: k, n: P.joueurs || P.n || TIERS[P.tier].n + (P.famille === 'trio' ? -2 : 0) }])),
  ...Object.fromEntries(Object.entries(PACKS_CARTES).map(([k, P]) => [`c:${k}`, { ...P, sorte: 'cartes', cle: k }])),
};
/*
 * LE PACK D'UNE SÉRIE GAGNÉE (Jalon P1). JP : *les récompenses devraient être des packs de joueurs*. Une série
 * gagnée donnait une carte rare jouable tout de suite : la main grossissait de ronde en ronde et emballait la run.
 * Elle donne maintenant un pack dont les joueurs vont au cartable — pour la saison suivante et les runs d'après,
 * jamais dans l'alignement des séries en cours. Par ronde gagnée (0, 1, 2), puis la Coupe.
 */
export const PACKS_DE_SERIE = ['j:hasard_argent', 'j:hasard_or', 'j:etoiles', 'j:legendes'];
/* Le pack de la ronde `r` gagnée : « Les vedettes » (le déblocage) le montent d'un cran ; la Coupe, des Légendes. */
export const packDeSerie = (r, vedettes = false) => PACKS_DE_SERIE[Math.min(PACKS_DE_SERIE.length - 1, r + (vedettes ? 1 : 0))];
export const RAYONS = [
  { cle: 'jour', nom: 'Le pack du jour', ico: '📆' },
  { cle: 'hasard', nom: 'Au hasard', ico: '🎲', packs: ['j:bronze', 'j:argent', 'j:or', 'j:vedettes'] },
  { cle: 'themes', nom: 'À ton choix', ico: '🎯', packs: ['j:epoque', 'j:specialistes', 'j:club', 'j:coach'] },
];

/*
 * LE PACK DU JOUR : un pack de la boutique, à 25 % de rabais, qui change
 * chaque jour (la date). `ouverts` (1.0) : ce que la boutique permet, clé →
 * true ou la raison du verrou — un pack verrouillé n'est jamais en vitrine.
 */
export function packDuJour(date = new Date(), ouverts = null) {
  const cle = typeof date === 'string' ? date : `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const tous = BOUTIQUE.filter(k => !ouverts || ouverts[k] === true);
  return { pack: tous[Math.floor(hache('pack-du-jour', cle) * tous.length)], rabais: 0.75, date: cle };
}
export const prixDe = (cle, rabais = 1) => Math.max(1, Math.round((PACKS_TOUS[cle] || {}).prix * rabais));
/*
 * LES PRIX MONTENT (JP : *trop de cartes, trop de cash, ça vire rapidement à être trop et j'ai rien à faire*). En
 * Rogue, chaque pack acheté dans la saison fait monter les suivants de `HAUSSE_PACK` de leur prix, comme la
 * relance de Balatro : le premier garde son prix, le cinquième de la saison coûte le double, et la saison suivante
 * repart au prix de base. L'argent garde un usage ; il cesse de tout acheter (docs/refonte-v5.md, phase 4 : les packs
 * ramenés à ~8 par saison). V9, tranche 8 : à 10 %, le gérant attentif en ouvrait encore 20 à 24 par saison, et sa
 * première Coupe tombait à la run 2 ; à 25 %, une dizaine. Le 27 oct. (JP, sa run 1 : onze packs Bronze dans la
 * saison 1, deux Piliers signés, 12e de 32 ; *on a été vraiment plus fort qu'on aurait dû*) : à 25 %, la première
 * Coupe de l'attentif retombait aux runs 1 et 4 ; à 40 %, aux runs 6 et 3, et il la regagne 27 % des runs (35 % :
 * 13 %, trop dur ; 50 % : runs 2 et 3, le bruit) — `check_profondeur`, 2 campagnes de 12 runs. Un achat de ton club
 * (un nom, un écusson) ne compte pas.
 */
const HAUSSE_PACK = 0.40;
export const achatsDePacks = (decisions = []) => decisions.filter(d => d && d.achat && d.achat.prix > 0 && (d.achat.sorte === 'joueurs' || d.achat.sorte === 'cartes')).length;
export const hausseDesPacks = n => 1 + HAUSSE_PACK * (n || 0);

/* ---------- les chances affichées ---------- */
const unSur = p => (p <= 0 ? null : p >= 0.999 ? 1 : Math.max(2, Math.round(1 / p)));
/*
 * « Or ou mieux : 1 pack sur 4 », « Holo : 1 pack sur 25 », « 1 de 1 : 1 pack
 * sur 2 500 » — la chance d'en trouver AU MOINS une dans le pack, pour son
 * nombre de cartes. \`mods\` : ce que les patrons changent (\`holo\`,
 * \`carteExtra\`, \`sansBase\`).
 */
export function chancesDe(cle, mods = {}) {
  const P = PACKS_TOUS[cle];
  if (!P) return [];
  if (P.sorte === 'cartes') {
    const c = P.cotes;
    const tot = c.commune + c.peu + c.rare + c.legendaire;
    const r = (c.rare + c.legendaire) / tot, l = c.legendaire / tot;
    const n = P.n;
    return [
      { nom: 'Rare ou mieux', txt: formatUnSur(1 - (1 - r) ** n), p: 1 - (1 - r) ** n },
      { nom: 'Légendaire', txt: formatUnSur(1 - (1 - l) ** n), p: 1 - (1 - l) ** n },
    ];
  }
  const c = cotesDuPack(cle, mods);
  const n = cartesDuPack(cle, mods);
  const r = (c.rare + c.legendaire) / 100, l = c.legendaire / 100, un = l * NUMEROS[3][1] / 100;
  const pr = P.garanti ? 1 : 1 - (1 - r) ** n;
  // S80 : le JOUEUR d'abord (son niveau), puis la FINITION de sa carte. Un pack d'étoiles ne dit pas « Étoile ou mieux » : c'est chaque carte.
  const nv = niveauxDuPack(cle, mods);
  const joueur = nv ? [
    ...(nv.soutien || nv.regulier || nv.pilier ? [{ nom: '★ Étoile ou mieux', p: 1 - (1 - (nv.etoile + nv.phenomene) / 100) ** n }] : []),
    { nom: '★ Phénomène', p: 1 - (1 - nv.phenomene / 100) ** n },
  ].map(x => ({ ...x, txt: formatUnSur(x.p), niveau: true })) : [];
  return [
    ...joueur,
    { nom: 'Cadre ou mieux', txt: formatUnSur(1 - (1 - (100 - c.commune) / 100) ** n), p: 1 - (1 - (100 - c.commune) / 100) ** n },
    { nom: 'Or ou mieux', txt: P.garanti ? 'garantie' : formatUnSur(pr), p: pr },
    { nom: 'Holo numérotée', txt: formatUnSur(1 - (1 - l) ** n), p: 1 - (1 - l) ** n },
    { nom: '1 de 1', txt: formatUnSur(1 - (1 - un) ** n), p: 1 - (1 - un) ** n },
  ];
}
function formatUnSur(p) {
  const n = unSur(p);
  if (n === null) return 'jamais';
  if (n === 1) return 'dans chaque pack';
  // Au-dessus d'une chance sur deux, « 1 pack sur 2 » mentirait : on dit le pourcentage.
  if (p >= 0.5) return p >= 0.995 ? 'dans presque chaque pack' : `${Math.round(p * 100)} % des packs`;
  return `1 pack sur ${n.toLocaleString('fr-CA')}`;
}
/*
 * LE MÉTAL D'UN PACK (V10, les packs qui montent) : le sien, ou celui du dessus quand son second cran est pris
 * (`mods.montee`, js/rogue.js `monteeDesPacks`) — le Bronze tire alors aux taux de l'Argent, au même prix.
 */
const METAUX = ['bronze', 'argent', 'or', 'premium'];
export function tierDuPack(cle, mods = {}) {
  const P = PACKS_TOUS[cle], t = (P && P.tier) || 'argent';
  return ((mods.montee || {})[cle] || 0) >= 2 ? METAUX[Math.min(METAUX.length - 1, METAUX.indexOf(t) + 1)] : t;
}
/* Le barème d'une carte de ce pack, en %, avec ce que les patrons y changent. */
export function cotesDuPack(cle, mods = {}) {
  const c = { ...TIERS[tierDuPack(cle, mods)].cotes };
  if (mods.holo && mods.holo !== 1) {
    const gain = (c.rare + c.legendaire) * (mods.holo - 1);
    c.rare *= mods.holo; c.legendaire *= mods.holo; c.commune = Math.max(0, c.commune - gain);
  }
  if (mods.sansBase) { c.peu += c.commune; c.commune = 0; }
  return c;
}
/*
 * Le nombre de cartes d'un pack, avec la carte de plus d'un patron et celle de son premier cran (V10) — jamais pour
 * un trio : une ligne a trois joueurs.
 */
export function cartesDuPack(cle, mods = {}) {
  const P = PACKS_TOUS[cle];
  if (!P) return 0;
  return P.n + (P.sorte === 'joueurs' && P.famille !== 'trio' ? (mods.carteExtra || 0) + (((mods.montee || {})[cle] || 0) >= 1 ? 1 : 0) : 0);
}
/*
 * LES TAUX DU JOUEUR d'un pack (S80), par niveau, en % d'une carte — ou null
 * pour un pack qui ne tire pas de niveau (un talent, un trio). Un niveau
 * absent vaut 0.
 */
export function niveauxDuPack(cle, mods = {}) {
  const P = PACKS_TOUS[cle];
  if (!P || P.sorte !== 'joueurs' || P.famille === 'skill' || P.famille === 'trio') return null;
  const t = { ...(P.niveaux || TIERS[tierDuPack(cle, mods)].niveaux) };
  /*
   * LE PRESTIGE DU CLUB (v2, js/rogue.js `PRESTIGES`) : il multiplie les taux
   * des Étoiles et des Phénomènes — V10 : jamais sous 1, aucun rang ne ferme le
   * hasard. Ce qu'on leur ajoute vient des piliers ; un pack d'étoiles, qui n'a pas de piliers, ne touche qu'à ses
   * Phénomènes, et la différence va à ses Étoiles.
   */
  const pr = mods.prestige;
  if (pr) {
    const avecPiliers = (t.pilier || 0) > 0;
    for (const k of avecPiliers ? ['etoile', 'phenomene'] : ['phenomene']) {
      const avant = t[k] || 0, apres = avant * (pr[k] ?? 1);
      const vers = avecPiliers ? 'pilier' : 'etoile';
      const delta = Math.min(apres - avant, t[vers] || 0);
      t[k] = avant + delta; t[vers] = (t[vers] || 0) - delta;
    }
  }
  const tot = NIVEAUX.reduce((a, N) => a + (t[N.cle] || 0), 0) || 1;
  return Object.fromEntries(NIVEAUX.map(N => [N.cle, ((t[N.cle] || 0) / tot) * 100]));
}

/* ---------- les tirages ---------- */
/* Les raretés d'une carte de jeu ; une carte de joueur a ses cinq éditions (`EDITIONS`, js/rarete.js). */
const ORDRE_VAR = ['commune', 'peu', 'rare', 'legendaire'];
/* Une édition tirée aux cotes du pack, et son numéro si c'est une Holo. */
function tirerVariante(cotes, ...parts) {
  let r = hache('pack-var', ...parts) * 100;
  let rar = 'commune';
  for (const k of EDITIONS) { r -= cotes[k] || 0; if (r < 0) { rar = k; break; } }
  let num = null;
  if (rar === 'legendaire') {
    let x = hache('pack-num', ...parts) * 100;
    for (const [n, w] of NUMEROS) { x -= w; if (x < 0) { num = n; break; } }
    num = num || '/99';
  }
  return { rar, num };
}
/* La part des cartes Soutien qui viennent des joueurs sans niveau (Jalon P2b) : la chance d'un régulier bouge à peine. */
const PART_HORS_NIVEAU = 0.1;
/* Un niveau tiré aux taux du pack (son rang dans NIVEAUX), de la graine et de mots. */
function tirerNiveau(taux, ...parts) {
  let r = hache('pack-niveau', ...parts) * 100;
  let dernier = 0;
  for (let k = 0; k < NIVEAUX.length; k++) {
    const w = taux[NIVEAUX[k].cle] || 0;
    if (w <= 0) continue;
    dernier = k;
    r -= w;
    if (r < 0) return k;
  }
  return dernier;
}

/*
 * LES JOUEURS D'UN PACK (S79, sortis de js/game.js en S80 pour se mesurer en
 * Node : scripts/check_packs.mjs). PURS : de la graine de la partie, du pack
 * et du numéro de l'achat — le reste est ce que le contrôleur fournit :
 *   saisons   les saisons des données (les étiquettes « 1981-82 ») ;
 *   shard(s)  la saison chargée : { players, byTeam } (async) ;
 *   libre(p)  ce que la partie permet : un salaire qu'une sortie ferait
 *             entrer, un joueur qui n'est ni dans la ligue ni déjà signé.
 * La FAMILLE du pack dit où l'on pige :
 *   hasard     n'importe quelle saison ;
 *   equipe     une franchise, toutes époques (choisie à l'achat, ou au hasard) ;
 *   annee      une saison (choisie, ou au hasard) ; ere : une décennie ;
 *   etoiles    les étoiles de leur saison ; legendes : d'avant 1995 ;
 *   skill      un talent lu dans les VRAIES fiches (\`SKILLS\`) ;
 *   trio       une vraie ligne d'un même club-saison.
 * Hors talent et trio, chaque carte tire d'abord son NIVEAU aux taux du pack
 * (\`niveauxDuPack\`), puis une saison, puis un joueur de ce niveau. Une saison
 * (ou un club-saison) sans joueur libre de ce niveau en laisse essayer une
 * autre ; après huit, le niveau d'en dessous — un club sans Phénomène, ou un
 * plafond qui ne laisse entrer aucune vedette, donne le niveau le plus proche,
 * jamais un meilleur tant qu'un moins bon existe. Puis, par-dessus chaque
 * joueur, sa VARIANTE au barème du tier (et le numéro d'une or) : les deux
 * axes ne se touchent pas. Chaque carte rend { p, niveau, rar, num }.
 */
const ESSAIS_NIVEAU = 8;
/*
 * LE DÉPISTEUR DU COACH (v2). Le coach de la run oriente le recrutement : à
 * niveau égal, un pack de joueurs tire DEUX candidats et garde celui qui
 * colle le mieux à sa philosophie, lu dans les vraies stats, jamais dans une
 * cote. V2.3 : ce qui colle, c'est SA COULEUR (`coachDuJoueur`) — l'Aigle
 * recrute des snipers, la Tortue des two-way et des défensifs —, au plus haut
 * palier d'abord ; le Comptable, qui n'a pas de joueurs, des aubaines.
 * Le niveau ne change pas : c'est le style qui penche, pas la qualité.
 */
const scoreDeCouleur = coach => p => (coachDuJoueur(p) === coach ? 1 + ((badgesDe(p)[0] || {}).palier || 0) : 0);
const recrueDuCoach = coach => (coach === 'banque' ? IDENTITES.aubaines.score : COACHS[coach] ? scoreDeCouleur(coach) : null);
function recrue(pool, coach, graine, ...parts) {
  const a = pool[Math.floor(hache(graine, 'pack-joueur', ...parts) * pool.length)];
  const score = recrueDuCoach(coach);
  if (!score || pool.length < 2) return a;
  const b = pool[Math.floor(hache(graine, 'pack-joueur-coach', ...parts) * pool.length)];
  return score(b) > score(a) ? b : a;
}
export async function tirerJoueursDuPack(cle, { graine, n, params = {}, mods = {}, garantie = false, saisons: toutes, shard, libre = () => true }) {
  const P = PACKS_TOUS[cle];
  const an = s => Number(String(s).slice(0, 4));
  let saisons = toutes.slice();
  const reglage = { ...params };
  // L'ÉPOQUE : la décennie du pack, ou celle choisie à l'achat (Jalon P2), ou une tirée parmi celles des données.
  if (P.famille === 'ere') {
    const decs = DECENNIES.filter(d => saisons.some(s => an(s) >= d && an(s) < d + 10));
    // `permis` : ce que les déblocages ouvrent (le hasard ne tombe jamais sur une décennie verrouillée).
    const ouvertes = decs.filter(d => !reglage.permis || reglage.permis.includes(d));
    const dec = P.decennie || (ouvertes.includes(Number(reglage.decennie)) ? Number(reglage.decennie) : ouvertes[Math.floor(hache(graine, 'pack-decennie', n) * ouvertes.length)]);
    reglage.decennie = dec;
    saisons = saisons.filter(s => an(s) >= dec && an(s) < dec + 10);
  }
  if (P.famille === 'legendes') saisons = saisons.filter(s => an(s) < 1995);
  if (P.famille === 'annee') {
    if (!reglage.saison || !saisons.includes(reglage.saison)) reglage.saison = saisons[Math.floor(hache(graine, 'pack-annee', n) * saisons.length)];
    saisons = [reglage.saison];
  }
  if (P.famille === 'equipe') {
    if (!reglage.franchise || !FRANCHISES[reglage.franchise]) { const fs = Object.keys(FRANCHISES); reglage.franchise = fs[Math.floor(hache(graine, 'pack-equipe', n) * fs.length)]; }
    // Les ÉTIQUETTES des saisons de la franchise (\`saisonsDeFranchise\` rend des paires [saison, code]).
    saisons = saisonsDeFranchise(reglage.franchise, saisons).map(([s]) => s);
  }
  const cotes = cotesDuPack(cle, mods);
  const nb = cartesDuPack(cle, mods);
  const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));
  const out = [];
  const pris = p => out.some(x => getPersonKey(x.p) === getPersonKey(p));
  const dispo = p => p && libre(p) && !pris(p);
  if (P.famille === 'trio') {
    // UNE VRAIE LIGNE : un club-saison tiré ; son meilleur centre et ses meilleurs ailiers — ou, une fois sur trois, sa première paire et son gardien.
    for (let t = 0; t < 12 && !out.length; t++) {
      const sa = saisons[Math.floor(hache(graine, 'pack-trio-saison', n, t) * saisons.length)];
      const e = await shard(sa);
      const clubs = Object.keys(e.byTeam);
      const tag = clubs[Math.floor(hache(graine, 'pack-trio-club', n, t) * clubs.length)];
      const eff = (e.byTeam[tag] || []).filter(p => (p.gp || 0) >= 30 && dispo(p)).sort((a, b) => prod(b) - prod(a));
      const paire = hache(graine, 'pack-trio-genre', n, t) < 1 / 3;
      const estD = p => groupeDuJoueur(p) === 'D';
      const aile = c => eff.find(p => !estD(p) && p.p !== 'G' && (p.np === c || (p.p === c)));
      const ligne = paire
        ? [eff.filter(estD)[0], eff.filter(estD)[1], (e.byTeam[tag] || []).filter(p => p.p === 'G' && (p.gp || 0) >= 20 && dispo(p)).sort((a, b) => (b.gp || 0) - (a.gp || 0))[0]]
        : [eff.find(p => !estD(p) && p.p !== 'G' && (p.np === 'C' || p.p === 'C')), aile('L') || aile('LW'), aile('R') || aile('RW')];
      if (!ligne.every(Boolean) || new Set(ligne.map(getPersonKey)).size !== 3) continue;
      ligne.forEach((p, i) => out.push({ p, niveau: niveauDe(p, e.players), ...tirerVariante(cotes, graine, cle, n, i) }));
      reglage.club = `${tag} ${sa}`;
    }
  } else if (P.famille === 'skill') {
    // UN TALENT : le quart du haut de sa saison à ce talent (ou tous ceux qui passent son filtre) — pas de niveau tiré.
    // LE RÔLE : celui du pack, ou celui choisi à l'achat (Jalon P2), ou un tiré.
    const roles = Object.keys(SKILLS).filter(k => !reglage.permis || reglage.permis.includes(k));
    const skill = P.skill || (roles.includes(reglage.skill) ? reglage.skill : roles[Math.floor(hache(graine, 'pack-skill', n) * roles.length)]);
    reglage.skill = skill;
    const S = SKILLS[skill];
    for (let t = 0; out.length < nb && t < nb * 5; t++) {
      const sa = saisons[Math.floor(hache(graine, 'pack-saison', cle, n, t) * saisons.length)];
      if (!sa) break;
      const e = await shard(sa);
      const c = e.players.filter(p => (p.gp || 0) >= S.min && (!S.groupe || groupeDuJoueur(p) === S.groupe) && (!S.skaters || p.p !== 'G')
        && (!S.filtre || S.filtre(p, ageAtSeason(p.bd, p.s)))).sort((a, b) => S.score(b) - S.score(a));
      let pool = (S.filtre ? c : c.slice(0, Math.ceil(c.length / 4))).filter(dispo);
      if (!pool.length) continue;
      pool.sort((a, b) => hache(graine, 'pack-joueur', cle, n, t, getPlayerKey(a)) - hache(graine, 'pack-joueur', cle, n, t, getPlayerKey(b)));
      out.push({ p: pool[0], niveau: niveauDe(pool[0], e.players), ...tirerVariante(cotes, graine, cle, n, t) });
    }
  } else {
    // LE NIVEAU D'ABORD : tiré aux taux du pack, puis une saison et un joueur de ce niveau.
    // LE PACK DU COACH (Jalon P2) : seulement des joueurs de sa couleur (`coachDuJoueur`, leur meilleur rôle maîtrisé).
    // Les huit coachs qui ont des joueurs (`VOIES`) : le Comptable est un patron, personne n'est de sa couleur.
    const couleur = P.famille === 'coach' ? (VOIES.includes(reglage.coach) ? reglage.coach : VOIES[Math.floor(hache(graine, 'pack-coach', n) * VOIES.length)]) : null;
    if (couleur) reglage.coach = couleur;
    const taux = niveauxDuPack(cle, mods);
    const permis = NIVEAUX.map((N, k) => k).filter(k => taux[NIVEAUX[k].cle] > 0);
    const essais = Math.min(ESSAIS_NIVEAU, saisons.length);
    for (let c = 0; c < nb && saisons.length; c++) {
      const voulu = tirerNiveau(taux, graine, cle, n, c);
      // Le niveau voulu, puis ceux d'en dessous, puis — en dernier recours — ceux d'au-dessus.
      const ordre = [...permis.filter(k => k <= voulu).reverse(), ...permis.filter(k => k > voulu)];
      let carte = null;
      for (const k of ordre) {
        for (let e = 0; e < essais && !carte; e++) {
          const sa = saisons[Math.floor(hache(graine, 'pack-saison', cle, n, c, k, e) * saisons.length)];
          const sh = await shard(sa);
          // TOUT SE PIGE (Jalon P2b) : une carte Soutien sur PART_HORS_NIVEAU vient de ceux qui n'ont pas de niveau.
          const hors = k === 0 && hache(graine, 'pack-hors', cle, n, c, e) < PART_HORS_NIVEAU;
          const pool = (P.famille === 'equipe'
            ? (sh.byTeam[codeDeFranchise(reglage.franchise, sa)] || []).filter(p => (hors ? joueursHorsNiveau(sh.players).includes(p) : niveauDe(p, sh.players) === k))
            : hors ? joueursHorsNiveau(sh.players) : joueursParNiveau(sh.players)[k]).filter(p => dispo(p) && (!couleur || coachDuJoueur(p) === couleur));
          if (pool.length) carte = { p: recrue(pool, mods.coach, graine, cle, n, c, k, e), niveau: k };
        }
        if (carte) break;
      }
      if (carte) out.push({ ...carte, ...tirerVariante(cotes, graine, cle, n, c) });
    }
  }
  // LA GARANTIE : le pack garanti, ou la pitié de la run (\`PITIE\`) — la dernière carte monte à l'Or.
  if ((P.garanti || garantie) && out.length && !out.some(x => x.rar === 'rare' || x.rar === 'legendaire')) out[out.length - 1].rar = 'rare';
  /*
   * V5 — LA BRILLANTE VA À LA VEDETTE DU PACK (js/rarete.js, \`statureDe\`). Les variantes tirées restent celles du pack
   * (ses chances affichées ne bougent pas) ; elles se distribuent seulement par stature : la plus brillante au joueur
   * de plus grande stature. Un holo dans un pack de Crosby et de trois Soutien, c'est le Crosby holo.
   */
  const ordre = out.map((x, i) => ({ i, s: statureDe(x.p, x.niveau) })).sort((a, b) => b.s - a.s || a.i - b.i).map(o => o.i);
  const vars = out.map(x => ({ rar: x.rar, num: x.num })).sort((a, b) => EDITIONS.indexOf(b.rar) - EDITIONS.indexOf(a.rar));
  ordre.forEach((i, k) => { out[i].rar = vars[k].rar; out[i].num = vars[k].num; });
  return { cartes: out, reglage };
}

/*
 * LES CARTES D'UN PACK DE CARTES : pures (graine, pack, numéro d'achat). Pour
 * chaque carte : sa FAMILLE d'abord (une des familles du pack, à parts égales —
 * sinon la famille la plus nombreuse noierait les autres), puis sa rareté aux
 * cotes du pack, puis une carte de cette famille et de cette rareté ; sans
 * carte à cette rareté, on descend d'un cran. Les malédictions ne sortent
 * jamais d'un pack.
 */
export function tirerCartesPack(cleCourte, graine, n, params = {}) {
  return PACKS_CARTES[cleCourte] ? tirerCartes(PACKS_CARTES[cleCourte], cleCourte, graine, n, params) : [];
}
/*
 * LES CARTES D'UN PACK, quel qu'il soit (Jalon P2) : le Pack Personnel, ou les \`cartes\` d'un pack de joueurs.
 * V16 (docs/refonte-v16.md § 3 et § 4d) : la première carte d'un pack de joueurs est un adjoint ; la deuxième, s'il en a
 * deux, une carte rare qui monte (une retouche, le stage, la formation, un soin, l'échange d'un doublon), une fois sur
 * `1 / RARE_DU_PACK` — jamais le gros du pack. Le Pack du coach, lui, ne donne que des adjoints de sa couleur : c'est sa
 * raison d'être, bâtir sa confiance.
 */
const CATS_MIXTES = ['patron', 'joueur', 'consommable'];
const CATS_RARES = ['joueur', 'consommable'];
export const RARE_DU_PACK = 0.25;
export function tirerCartesDuPack(cle, graine, n, params = {}) {
  const P = PACKS_TOUS[cle];
  if (!P) return [];
  if (P.sorte === 'cartes') return tirerCartesPack(P.cle, graine, n, params);
  if (!P.cartes) return [];
  const choix = P.choix === 'coach' ? 'coach' : null;
  const adjoint = tirerCartes({ n: choix ? P.cartes : 1, cats: ['patron'], cotes: COTES_CARTES, choix }, cle, graine, n, params);
  const rare = P.cartes > 1 && !choix && hache(graine, 'pack-rare', cle, n) < RARE_DU_PACK
    ? tirerCartes({ n: 1, cats: CATS_RARES, cotes: COTES_CARTES }, `${cle}:outils`, graine, n, params) : [];
  return [...adjoint, ...rare];
}
/*
 * DES ADJOINTS À LA COULEUR DU COACH (refonte coachs-cartes-incidents, tranche 3 ; JP : *je veux que le club se
 * construise autour du coach*) : `nb` adjoints de sa couleur, tirés comme au Pack Personnel (mêmes cotes, mêmes
 * raretés). Pur : la graine, la clé du tirage et le coach. Sans coach connu, rien.
 */
export function adjointsDeCouleur(graine, cle, coach, nb) {
  if (!COACHS[coach]) return [];
  // Deux tirages peuvent tomber sur la même carte (un coach n'en a que cinq) : on tire large, on garde les distinctes, et
  // on complète par les cartes de sa couleur dans un ordre fixé par la graine.
  const out = [...new Set(tirerCartes({ ...PACKS_CARTES.patrons, n: nb * 4, choix: 'coach' }, `couleur:${cle}`, graine, 0, { coach }))].slice(0, nb);
  const reste = idsDuCoach(coach).filter(id => BANQUE[id].cat === 'patron' && !out.includes(id)).sort((x, y) => hache(graine, 'couleur-reste', cle, x) - hache(graine, 'couleur-reste', cle, y));
  while (out.length < nb && reste.length) out.push(reste.shift());
  return out;
}
function tirerCartes(P, cleCourte, graine, n, params) {
  const out = [];
  // v2 : le pack d'un coach ne tire que sa couleur (le coach choisi, ou tiré de la graine), dans les familles qui en ont.
  const coach = P.choix === 'coach' ? coachDuPack(graine, n, params) : null;
  // `params.sans` : des familles que ce tirage ne donne pas. V16 : un coach sans carte dans ces familles (les outils de
  // gérant n'ont presque pas de couleur) laisse tirer sans couleur.
  const libres = P.cats.filter(c => !(params.sans || []).includes(c) && idsDe(c).length);
  const siens = coach ? libres.filter(c => idsDuCoach(coach).some(id => BANQUE[id].cat === c)) : [];
  const teint = coach && siens.length > 0;
  const cats = teint ? siens : libres;
  for (let t = 0; t < P.n; t++) {
    const cat = cats[Math.floor(hache(graine, 'pack-famille', cleCourte, n, t) * cats.length)];
    const pool = idsDe(cat).filter(id => !teint || BANQUE[id].coach === coach);
    let r = hache(graine, 'pack-cartes', cleCourte, n, t) * 100;
    let rar = 'commune';
    for (const k of ORDRE_VAR) { r -= P.cotes[k] || 0; if (r < 0) { rar = k; break; } }
    for (let i = ORDRE_VAR.indexOf(rar); i >= 0; i--) {
      const c = pool.filter(id => BANQUE[id].rarete === ORDRE_VAR[i]);
      if (!c.length) continue;
      out.push(c[Math.floor(hache(graine, 'pack-carte', cleCourte, n, t, ORDRE_VAR[i]) * c.length)]);
      break;
    }
  }
  return out;
}
/* LA BANQUE QU'ON PEUT COMPLÉTER (V2.2, la collection se complète) : une carte compte si un pack peut la donner (`CATS_MIXTES`). */
export function sortDUnPack(id) {
  const c = BANQUE[id];
  return !!c && CATS_MIXTES.includes(c.cat);
}
/* Le coach d'un pack du coach : celui choisi à l'achat, sinon un tiré de la graine et du numéro d'achat. */
export const coachDuPack = (graine, n, params = {}) => (COACHS[params.coach] ? params.coach : ORDRE_COACHS[Math.floor(hache(graine, 'pack-coach', n) * ORDRE_COACHS.length)]);
/*
 * LA GARANTIE (Rogue) : combien de packs de joueurs d'affilée sans holo ni or
 * — lu dans les décisions d'achat (\`achat.meilleure\`). Au bout de PITIE packs
 * sans, le prochain (le PITIE + 1e) en garantit une — \`check_verite\`.
 */
export function packsSansHolo(decisions = []) {
  let n = 0;
  for (const d of [...decisions].filter(x => x && (x.achat || x.rogue) && (x.achat || x.rogue).sorte === 'joueurs' && !(x.achat && x.achat.scelle)).sort((a, b) => (a.achat || a.rogue).n - (b.achat || b.rogue).n)) {
    const m = (d.achat || d.rogue).meilleure;
    n = m === 'rare' || m === 'legendaire' ? 0 : n + 1;
  }
  return n;
}

/*
 * LES TALENTS : lus dans les VRAIES fiches de la saison du joueur, jamais
 * dans une cote. \`score\` : plus c'est haut, mieux il correspond ; on pige
 * dans le quart du haut de sa saison (les réguliers seulement).
 * LES QUATRE FAMILLES (V9, tranche 4) : le Tir, le Jeu, la Défense et la
 * Robustesse se lisent à points égaux (\`famillesDe\`) — le quart du haut n'est
 * pas le talent brut, c'est le joueur que sa famille distingue à son niveau.
 * À tous les niveaux, donc à tous les salaires : les aubaines d'un plan. Les
 * clés d'avant restent, pour les vieilles parties.
 */
export const SKILLS = {
  sniper: { groupe: null, min: 30, skaters: true, score: p => famillesDe(p).tir },
  passeur: { groupe: null, min: 30, skaters: true, score: p => famillesDe(p).jeu },
  defensif: { groupe: null, min: 30, skaters: true, score: p => famillesDe(p).defense },
  dur: { groupe: null, min: 30, skaters: true, score: p => famillesDe(p).robustesse },
  gardien: { groupe: 'G', min: 20, score: p => p.sv || 0 },
  recrue: { groupe: null, min: 20, filtre: p => !!p.elc, score: p => ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1) },
  veteran: { groupe: null, min: 30, filtre: (p, age) => age >= 33, score: p => ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1) },
};
