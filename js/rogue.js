/**
 * LE MODE ROGUE (S77).
 *
 * JP : *mode rogue like, que tu pars avec des joueurs de marde et gagne des
 * cartes/unlock avec packs, monnaie, etc?* ; puis, au choix proposé : *c'est
 * toujours une saison, mais tu gardes des trucs de saison en saison genre*,
 * et « collection + déblocages ».
 *
 * UNE RUN, C'EST UNE SAISON. On part avec vingt-trois PLOMBIERS — de vrais
 * joueurs, les moins productifs de leurs saisons — et on bâtit en jouant :
 * chaque résultat rapporte des JETONS 🪙, et la BOUTIQUE du hub vend des
 * packs (trois vrais joueurs, tu en signes un ; trois cartes de match, tu en
 * gardes une). S79 : la MASSE SALARIALE reste (JP : *garder aspect masse
 * salariale même en roguelike, mais avec cartes qui peuvent le manipuler*) —
 * un plafond de 82 M$, et des cartes pour le tordre (js/banque.js `CONTRATS`).
 *
 * CE QUI RESTE D'UNE RUN À L'AUTRE (le « méta », `cap82_rogue`) :
 *   - les ÉCUSSONS 🏅 gagnés à la fin de chaque run (les points de la saison,
 *     les rondes des séries, la Coupe) ;
 *   - les DÉBLOCAGES qu'ils achètent au vestiaire : garder des joueurs de ta
 *     dernière équipe (« tu gardes des trucs de saison en saison »), des
 *     jetons de départ, des packs neufs, un deck aiguisé, de meilleurs
 *     plombiers ;
 *   - la COLLECTION : chaque joueur tiré d'un pack entre dans ton cartable,
 *     qu'on l'ait signé ou non — c'est ça, une carte qu'on a tirée.
 *
 * TOUT CE QUI SE REJOUE EST PUR : les jetons se DÉDUISENT des résultats et
 * des achats (jamais stockés), et le contenu d'un pack se tire de la graine
 * de la ligue et du numéro de l'achat. Une run reprise retrouve les mêmes
 * packs. Seul le méta est un état, et il ne touche pas au moteur.
 */
import { hache } from './util.js';
import { VOIES } from './coachs.js';
import { filsDeSaison } from './recit.js';

const CLE_META = 'cap82_rogue';

/* ---------- les jetons ---------- */
/*
 * CALIBRÉ (scripts/mesure_rogue.mjs) : des plombiers font 12 à 33 points ; seize joueurs de
 * pack dès le premier jour, 74 à 90 — la bulle des séries. Une run doit donc en signer une
 * vingtaine en cours de saison : environ 25 packs sur 82 matchs, cinq dans les vingt premiers.
 */
/*
 * LA PRIME D'UN FIL (V3.6, JP : *si des trucs arrivent random, genre justement Cheechoo, c'est là que ça
 * pourrait proc un bonus*). En Rogue, le soir où un fil NAÎT et fait la une (`filsDeSaison`, js/recit.js),
 * sa voix paie : les partisans s'arrachent le chandail du Cheechoo, le proprio verse une prime au jalon.
 * Rien de neuf dans le moteur : ce sont des jetons, déduits des feuilles jouées comme les victoires. Le
 * Cheechoo paie le plus parce qu'il est le plus rare ; seul ce qui sort de l'ordinaire paie (pas le duo, pas un
 * jalon de 30 buts) ; la saison plafonne (`PRIME_FILS_MAX`) pour que le
 * hasard pimente la run sans la rendre facile (check_rogue).
 */
export const PRIMES_DES_FILS = {
  feu: { jetons: 10, mot: 'Les partisans s\'arrachent son chandail' },
  recrue: { jetons: 5, mot: 'Le chandail de la recrue se vend' },
  jalon: { jetons: 5, mot: 'Le proprio verse une prime', seuil: 40 },
  course: { jetons: 5, mot: 'Les cotes d\'écoute montent', rythme: 50 },
};
export const PRIME_FILS_MAX = 30;
/** Les primes des fils jusqu'à la journée `j` (non comprise) : { total, parJour: Map(journée → { jetons, mot }) }. */
export function primesDesFils(calendrier, you, j = Infinity) {
  const parJour = new Map();
  let total = 0;
  for (const e of filsDeSaison(calendrier, you, j).journal) {
    const a = e.fils[0], P = a.neuf && PRIMES_DES_FILS[a.sorte];
    // Seulement ce qui sort de l'ordinaire : un jalon de 40 buts et plus, un rythme de 50 buts.
    if (!P || total >= PRIME_FILS_MAX || (P.seuil && !(a.unite === 'buts' && a.seuil >= P.seuil)) || (P.rythme && !(a.g != null && a.rythme >= P.rythme))) continue;
    const n = Math.min(P.jetons, PRIME_FILS_MAX - total);
    total += n;
    parJour.set(e.j, { jetons: n, mot: P.mot });
  }
  return { total, parJour };
}
export const JETONS = { depart: 40, victoire: 8, prolongation: 4, defaite: 2, grosMatch: 20, objectif: 20, serie: 40 };
/*
 * Les jetons à un moment de la saison : ce que les résultats ont rapporté,
 * moins ce que la boutique a coûté. `res` : W, L, OTL (matchs révélés), les
 * gros matchs gagnés, les objectifs réussis, les séries gagnées.
 */
export function jetonsDe(res, depenses, depart = JETONS.depart, bareme = JETONS) {
  const r = res || {};
  const B = bareme || JETONS;
  return depart + (r.W || 0) * B.victoire + (r.OTL || 0) * B.prolongation + (r.L || 0) * B.defaite
    + (r.gros || 0) * B.grosMatch + (r.objectifs || 0) * B.objectif + (r.series || 0) * B.serie + (r.primes || 0) - (depenses || 0);
}
/*
 * LE BARÈME D'UNE RUN (S80). Une run dure maintenant plusieurs saisons : ce
 * qui la rend forte, c'est l'équipe qui CONTINUE, pas une première saison
 * qui achète vingt-cinq packs. Mesuré (scripts/check_rogue.mjs, un robot,
 * soixante runs sans aucun déblocage) : au barème de S79 (8 🪙 par
 * victoire), la run gagnait la Coupe une fois sur douze ; à 5 🪙, une fois
 * sur vingt ; à 4 🪙, une fois sur cinquante — presque jamais — et la
 * première saison fait les séries une fois sur douze. La défaite et la
 * prolongation paient comme avant (2 et 4 🪙) : une équipe faible perd
 * souvent, c'est son revenu, et le couper faisait des runs mortes d'avance.
 * Le COMMANDITAIRE, au vestiaire, rend ce qu'il faut : 8, puis 10 🪙 par
 * victoire.
 *
 * 5 🪙 DEPUIS LA FUSION DES PACKS PAR NIVEAU (S80) : un pack Bronze ou Argent
 * donne maintenant surtout des joueurs de soutien, et la même courbe, remesurée
 * à 4 🪙, repoussait la première Coupe d'une campagne à la septième run (une
 * campagne sur six n'y arrivait pas en quatorze). JP veut que la Coupe prenne
 * plusieurs saisons et des déblocages, pas qu'elle soit hors d'atteinte. Le barème est fixé au départ de chaque saison
 * (`G.rogue.bareme`) : un déblocage acheté en cours de route ne change pas
 * les jetons déjà gagnés.
 */
export const baremeRogue = m => ({ ...JETONS, victoire: 5 + (aDebloque(m, 'commanditaire1') ? 3 : 0) + (aDebloque(m, 'commanditaire2') ? 2 : 0) });

/* ---------- les déblocages (le vestiaire) ---------- */
export const DEBLOCAGES = {
  garder1: { ico: '🤝', nom: 'Garder un joueur', prix: 40, texte: 'Au début d\'une run, garde un joueur de ta dernière équipe.' },
  garder2: { ico: '🤝', nom: 'Garder deux joueurs', prix: 120, requis: 'garder1', texte: 'Deux joueurs de ta dernière équipe te suivent.' },
  garder3: { ico: '🤝', nom: 'Garder trois joueurs', prix: 240, requis: 'garder2', texte: 'Trois joueurs de ta dernière équipe te suivent.' },
  caisse1: { ico: '🪙', nom: 'Une caisse de départ', prix: 30, texte: '+20 jetons au début de chaque run.' },
  caisse2: { ico: '🪙', nom: 'Une grosse caisse', prix: 100, requis: 'caisse1', texte: '+20 jetons de plus au départ (+40 en tout).' },
  // S80 : le barème d'une run (`baremeRogue`) — 5 🪙 par victoire sans commanditaire.
  commanditaire1: { ico: '📺', nom: 'Un commanditaire', prix: 60, texte: '+3 🪙 par victoire : 8 au lieu de 5, à chaque saison de la run.' },
  commanditaire2: { ico: '📺', nom: 'Le commanditaire principal', prix: 150, requis: 'commanditaire1', texte: '+2 🪙 de plus par victoire : 10.' },
  packDefenseurs: { ico: '❄️', nom: 'Le pack Défensif', prix: 35, texte: 'La boutique vend le pack Défensif : quatre joueurs au meilleur différentiel de leur saison.' },
  packGardiens: { ico: '🥅', nom: 'Le pack Gardiens', prix: 50, texte: 'La boutique vend le pack Gardiens : quatre partants au meilleur pourcentage d\'arrêts.' },
  packAnnees80: { ico: '📼', nom: 'Le pack années 80', prix: 60, texte: 'La boutique vend le pack des années 80, l\'époque des 400 buts par saison.' },
  packVedettes: { ico: '🌟', nom: 'Les packs Étoiles et Légendes', prix: 150, texte: 'La boutique vend les packs Étoiles et Légendes : les meilleurs de leur saison.' },
  deckPlus: { ico: '🃏', nom: 'Un deck aiguisé', prix: 50, texte: 'Ton deck de départ commence avec « Lancer de la pointe+ » et « Bloquer des tirs+ ».' },
  plombiersPlus: { ico: '🛠️', nom: 'Des bouche-trous moins pires', prix: 80, texte: 'Tes bouche-trous de départ sortent du bas de la ligue, pas du fond du baril.' },
  // S79 : la masse salariale se débloque aussi.
  plafond1: { ico: '💵', nom: 'Une masse salariale indexée', prix: 45, texte: '+3\u00a0M$ de plafond au début de chaque run.' },
  plafond2: { ico: '💰', nom: 'Le proprio dépense', prix: 110, requis: 'plafond1', texte: '+4\u00a0M$ de plus au début de chaque run (+7\u00a0M$ en tout).' },
  dgFlexible: { ico: '🧮', nom: 'Le DG du plafond flexible', prix: 70, personnel: 'dir_flexible', texte: 'Il rejoint ton personnel pour de bon : engagé, il donne 5 % de plafond de plus.' },
  /*
   * S80 : LE DÉPART DU CLASSEUR. JP : *le classeur, on peut piger x cartes aux
   * départ, ou random, selon upgrades*. Sans rien, une carte de ton classeur
   * au hasard ; des pages de plus en donnent plus, le tri en montre deux fois
   * plus pour garder les meilleures, et le classeur ouvert te laisse choisir.
   */
  classeur1: { ico: '📒', nom: 'Une page de plus', prix: 50, texte: 'Au départ d\'une run, une carte de plus de ton classeur : deux en tout.' },
  classeur2: { ico: '📒', nom: 'Deux pages de plus', prix: 130, requis: 'classeur1', texte: 'Trois cartes de ton classeur au départ.' },
  classeur3: { ico: '📒', nom: 'Trois pages de plus', prix: 240, requis: 'classeur2', texte: 'Quatre cartes de ton classeur au départ.' },
  classeurTri: { ico: '🔍', nom: 'Le tri du classeur', prix: 90, texte: 'Au départ, tu vois deux fois plus de cartes de ton classeur, tirées au hasard, et tu gardes celles que tu veux.' },
  classeurChoix: { ico: '📖', nom: 'Le classeur ouvert', prix: 280, requis: 'classeurTri', texte: 'Au départ, tu choisis tes cartes dans tout ton classeur : plus de hasard.' },
  /*
   * S80 : LES CASES DE RÉSERVE DE PLUS. JP : *débloquer des slots de
   * remplacement*. Une case de réserviste qui prend n'importe qui : un joueur
   * signé y entre sans que personne sorte, et il monte quand un habillé se
   * blesse (js/sim.js `activeLineup`).
   */
  banc1: { ico: '🪑', nom: 'Une case de réserve de plus', prix: 60, texte: 'Quatre réservistes au lieu de trois : un joueur de plus sans que personne sorte.' },
  banc2: { ico: '🪑', nom: 'Deux cases de réserve de plus', prix: 150, requis: 'banc1', texte: 'Cinq réservistes.' },
};
/* Le plafond que le vestiaire ajoute au départ d'une run. */
export const plafondDuVestiaire = m => (aDebloque(m, 'plafond1') ? 3_000_000 : 0) + (aDebloque(m, 'plafond2') ? 4_000_000 : 0);
/*
 * LE PLAFOND D'UNE RUN (S79), et l'espace qu'elle garde au départ : 82 M$,
 * et au moins 12 M$ au-dessus de la masse de départ (trois vedettes gardées
 * de la dernière run ne doivent pas bloquer la saison).
 */
export const PLAFOND_ROGUE = 82_000_000;
export const ESPACE_DE_DEPART = 12_000_000;
/*
 * LE DÉPART DU CLASSEUR (S80) : combien de cartes, et comment elles se
 * prennent. `hasard` : elles sont tirées, on les voit, on les prend ;
 * `tri` : deux fois plus sont tirées, on garde celles qu'on veut ; `choix` :
 * tout le classeur, on choisit.
 */
export function departDuClasseur(m) {
  const n = 1 + ['classeur1', 'classeur2', 'classeur3'].filter(k => aDebloque(m, k)).length;
  const mode = aDebloque(m, 'classeurChoix') ? 'choix' : aDebloque(m, 'classeurTri') ? 'tri' : 'hasard';
  return { n, mode, vues: mode === 'tri' ? n * 2 : n };
}
/*
 * LE BUDGET DU CLASSEUR : ce que ses cartes peuvent coûter ensemble. Le
 * plafond de la run, moins l'espace qu'elle garde au départ, moins ce que
 * coûtent des plombiers (mesuré S79 : 29 à 51 M$, on en garde 45). Sans ça,
 * trois vedettes du classeur feraient monter le plafond (`ESPACE_DE_DEPART`)
 * et la masse salariale ne voudrait plus rien dire. 25 M$ sans déblocage :
 * deux vedettes, ou quatre bons joueurs.
 */
const RESERVE_PLOMBIERS = 45_000_000;
export const budgetDuClasseur = m => PLAFOND_ROGUE + plafondDuVestiaire(m) - ESPACE_DE_DEPART - RESERVE_PLOMBIERS + PRESTIGES[rangDePrestige(m)].classeur;
/*
 * LE PRESTIGE DU CLUB (v2). JP : *favoriser que l'on peut avoir de plus en plus
 * de joueurs de qualité selon les runs, sans que ça soit gratuit en faisant une
 * saison, genre une progression logique*. Un club de garage n'attire pas les
 * vedettes : le prestige monte avec les écussons gagnés À VIE (jamais ceux
 * qu'on dépense) ET un exploit à chaque rang — faire les séries, gagner une
 * ronde, atteindre la finale (les jalons). Une bonne saison ne suffit pas :
 * il faut des runs, et il faut aller loin.
 *
 * Ce qu'il ouvre : les Étoiles et les Phénomènes des packs de joueurs
 * (`etoile`, `phenomene` multiplient leurs taux ; ce qu'on leur retire va aux
 * piliers, js/packs.js `niveauxDuPack`), et le budget du classeur
 * (`classeur`, en dollars de plus au départ d'une run). Le rang est FIXÉ au
 * départ de la run (`G.rogue.prestige`) : un rang gagné en cours de route
 * sert la run suivante, et une run reprise retrouve les mêmes packs.
 */
/*
 * V2.3 — LE COACH ET SES PATRONS, AU PRESTIGE. JP : *au début, t'as genre 3 coachs seulement, et 2 adjoints
 * possibles, pis ça augmente selon les runs*. Chaque rang ouvre `coachs` coachs au choix du départ (les huit
 * voies, dans l'ordre de `VOIES`), `postes` postes de patron, et les raretés (`raretes`) d'où se tirent les
 * deux patrons imposés au départ — des passifs neutres, utiles à tous (js/banque.js `patronsDeDepart`).
 */
export const PRESTIGES = [
  { nom: 'Club de garage', min: 0, etoile: 0.4, phenomene: 0, classeur: 0, coachs: 3, postes: 2, raretes: ['commune'], texte: 'Les vedettes ne décrochent pas le téléphone.' },
  { nom: 'Club de quartier', min: 120, etoile: 0.7, phenomene: 0.3, classeur: 3_000_000, coachs: 4, postes: 2, raretes: ['commune', 'peu'], texte: 'On commence à parler de toi au dépanneur.' },
  { nom: 'Club respecté', min: 350, jalon: 'series', etoile: 1, phenomene: 0.7, classeur: 6_000_000, coachs: 5, postes: 3, raretes: ['commune', 'peu'], texte: 'Les agents rappellent.' },
  { nom: 'Puissance de la ligue', min: 700, jalon: 'ronde', etoile: 1.15, phenomene: 1, classeur: 10_000_000, coachs: 6, postes: 3, raretes: ['commune', 'peu', 'rare'], texte: 'Les joueurs autonomes regardent ton club en premier.' },
  { nom: 'Dynastie', min: 1200, jalon: 'finale', etoile: 1.3, phenomene: 1.3, classeur: 15_000_000, coachs: 8, postes: 4, raretes: ['commune', 'peu', 'rare'], texte: 'Tout le monde veut jouer pour toi.' },
];
/* Les coachs qu'une run de ce rang peut choisir, et ses postes de patron. */
export const coachsOuverts = rang => VOIES.slice(0, (PRESTIGES[rang] || PRESTIGES[0]).coachs);
export const postesDePatron = rang => (PRESTIGES[rang] || PRESTIGES[0]).postes;
/* Les écussons gagnés à vie : le compte, ou — pour un méta d'avant la v2 — ce qu'on a, plus ce qu'on a dépensé au vestiaire. */
export const ecussonsAVie = m => (m.ecussonsAVie != null ? m.ecussonsAVie
  : (m.ecussons || 0) + (m.deblocages || []).reduce((a, k) => a + ((DEBLOCAGES[k] && DEBLOCAGES[k].prix) || 0), 0));
/* Le rang de prestige d'un méta : les rangs se gagnent dans l'ordre, chacun ses écussons à vie ET son jalon. */
export function rangDePrestige(m) {
  const e = ecussonsAVie(m);
  let r = 0;
  while (r + 1 < PRESTIGES.length && e >= PRESTIGES[r + 1].min && (!PRESTIGES[r + 1].jalon || (m.jalons || {})[PRESTIGES[r + 1].jalon])) r++;
  return r;
}
/* Les cases de réserve de plus d'une run (js/sim.js `RESERVES_EN_PLUS`). */
export const reservesDeLaRun = m => (aDebloque(m, 'banc2') ? 2 : aDebloque(m, 'banc1') ? 1 : 0);
/*
 * LE TIRAGE DU CLASSEUR, pur : les clés du classeur (celles qu'on peut
 * prendre), la graine de la run. Rend l'ordre dans lequel les cartes se
 * montrent — les `vues` premières sont celles du hasard et du tri.
 */
export function tirageDuClasseur(cles, graine) {
  return cles.slice().sort().map(k => [hache(graine, 'classeur', k), k]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
}

/*
 * LE VESTIAIRE TIRÉ DU CLASSEUR (1.0). JP : *le jeu doit me forcer à utiliser
 * un max de variété de cartes de joueurs, de tous les niveaux. Ils doivent
 * donc tous venir de mes cartes à partir de la deuxième run, tout en gardant
 * le concept que l'équipe doit commencer la saison faible […] je dois
 * commencer avec des joueurs de soutien et en progressant, en avoir moins.*
 *
 * Dès que ton cartable a des cartes, tes plombiers sont TES cartes Soutien
 * (niveau Soutien, ou sans niveau : moins d'une demi-saison). Le quota de
 * Soutien baisse avec le prestige du club (trois de moins par rang) et avec
 * la saison de la run (trois de moins par saison) ; les autres cases vont à
 * tes cartes Régulier. Les cartes choisies (gardés, classeur) comptent dans
 * le quota selon leur niveau. Ce que le classeur n'a pas, des plombiers de la
 * ligue le comblent.
 *
 * LE GOÛT D'ESSAYER : le tirage prend d'abord les cartes qui ont joué le
 * moins de runs (`r`, js/cartable.js), au hasard entre elles — une carte
 * neuve passe avant une habituée — et une carte qui finit sa première saison
 * avec toi paie sa PRIME DE DÉCOUVERTE.
 */
export const COMPOSITION_DEPART = { F: 14, D: 7, G: 2 };
export const SOUTIENS_DEPART = 23, SOUTIENS_MOINS_RANG = 3, SOUTIENS_MOINS_SAISON = 3, SOUTIENS_MIN = 5;
export const soutiensDuDepart = (rang, saison = 1) => Math.max(SOUTIENS_MIN, SOUTIENS_DEPART - SOUTIENS_MOINS_RANG * (rang || 0) - SOUTIENS_MOINS_SAISON * ((saison || 1) - 1));
/* Soutien : le niveau 0, ou pas de niveau (−1, un joueur de moins d'une demi-saison). */
export const estSoutien = niveau => niveau <= 0;
/*
 * LE TIRAGE (pur). `fixes` : les cartes déjà prises ({ p, niveau, groupe }) ;
 * `cartes` : les candidates ({ cle, p, niveau, groupe, r }) ; `quota` : les
 * Soutien voulus ; `budget` : la masse que l'équipe ne dépasse pas. Rend les
 * cartes tirées et ce qui manque par groupe (pour les plombiers de la ligue).
 */
export function tirageDuDepart({ fixes = [], cartes = [], quota, budget = Infinity, graine = '', personne = c => c.cle }) {
  const besoin = { ...COMPOSITION_DEPART };
  let soutiens = 0, autres = 0;
  const pris = new Set();
  for (const f of fixes) {
    besoin[f.groupe] = Math.max(0, (besoin[f.groupe] || 0) - 1);
    if (estSoutien(f.niveau)) soutiens++; else autres++;
    pris.add(personne(f));
  }
  const total = Object.values(COMPOSITION_DEPART).reduce((a, n) => a + n, 0);
  let auDessus = Math.max(0, total - Math.max(quota, soutiens) - autres);
  const ordre = cartes.slice().sort((a, b) => (a.r || 0) - (b.r || 0) || hache(graine, 'depart', a.cle) - hache(graine, 'depart', b.cle));
  const tires = [];
  const prendre = c => { tires.push(c); pris.add(personne(c)); besoin[c.groupe]--; };
  // Les cases au-dessus du quota : tes cartes Régulier, les moins jouées d'abord.
  for (const c of ordre) {
    if (auDessus <= 0) break;
    if (c.niveau !== 1 || !(besoin[c.groupe] > 0) || pris.has(personne(c))) continue;
    prendre(c); auDessus--;
  }
  // Le reste : tes cartes Soutien.
  for (const c of ordre) if (estSoutien(c.niveau) && besoin[c.groupe] > 0 && !pris.has(personne(c))) prendre(c);
  // Le plafond : la plus chère des Régulier tirées laisse sa place à une Soutien de son groupe (ou à un plombier).
  const masse = () => [...fixes, ...tires].reduce((a, c) => a + ((c.p && c.p.$) || 0), 0);
  for (let garde = 0; masse() > budget && garde < 30; garde++) {
    const cher = tires.filter(c => !estSoutien(c.niveau)).sort((a, b) => (b.p.$ || 0) - (a.p.$ || 0))[0];
    if (!cher) break;
    tires.splice(tires.indexOf(cher), 1); pris.delete(personne(cher)); besoin[cher.groupe]++;
    const rempl = ordre.find(c => estSoutien(c.niveau) && c.groupe === cher.groupe && !pris.has(personne(c)) && (c.p.$ || 0) < (cher.p.$ || 0));
    if (rempl) prendre(rempl);
  }
  return { tires, manque: Object.fromEntries(Object.entries(besoin).map(([g, n]) => [g, Math.max(0, n)])) };
}

/* ---------- le méta ---------- */
/*
 * S79 : l'INVENTAIRE PERMANENT — `personnel` (les patrons qu'on possède, qu'on
 * engage à chaque run), `inventaire` (id → nombre de consommables permanents),
 * et `recus` (les achats déjà versés au méta : une ouverture ne paie qu'une fois).
 */
/*
 * S80 : `runs` compte les runs COMMENCÉES (une run dure maintenant plusieurs
 * saisons), `saisons` les saisons jouées, `coupes` les Coupes ; `jalons` ceux
 * qui ont payé ; `sel`, tiré une fois, sème le tirage du classeur de chaque
 * run (le même tant que la run n'a pas commencé : recharger ne retire pas).
 */
const META_VIDE = () => ({ ecussons: 0, deblocages: [], collection: [], cartes: [], runs: 0, saisons: 0, coupes: 0, meilleur: null, derniereEquipe: [], recompenses: {}, personnel: [], inventaire: {}, recus: {}, jalons: {}, sel: null });
export function lireMeta() {
  try { return { ...META_VIDE(), ...(JSON.parse(localStorage.getItem(CLE_META) || 'null') || {}) }; } catch { return META_VIDE(); }
}
export function ecrireMeta(m) { try { localStorage.setItem(CLE_META, JSON.stringify(m)); } catch { /* ignore */ } }
export const aDebloque = (m, cle) => (m.deblocages || []).includes(cle);
/* Combien de joueurs on garde : zéro, un, deux, trois selon les déblocages. */
export const nombreGardes = m => (aDebloque(m, 'garder3') ? 3 : aDebloque(m, 'garder2') ? 2 : aDebloque(m, 'garder1') ? 1 : 0);
export const jetonsDeDepart = m => JETONS.depart + (aDebloque(m, 'caisse1') ? 20 : 0) + (aDebloque(m, 'caisse2') ? 20 : 0);
/* Un déblocage s'achète si on en a les moyens et si ce qu'il demande est déjà pris. */
export function peutAcheter(m, cle) {
  const D = DEBLOCAGES[cle];
  if (!D || aDebloque(m, cle)) return false;
  if (D.requis && !aDebloque(m, D.requis)) return false;
  return (m.ecussons || 0) >= D.prix;
}
export function acheterDeblocage(cle) {
  const m = lireMeta();
  if (!peutAcheter(m, cle)) return false;
  m.ecussons -= DEBLOCAGES[cle].prix;
  m.deblocages = [...(m.deblocages || []), cle];
  // Un déblocage de personnel : le patron rejoint le personnel permanent.
  if (DEBLOCAGES[cle].personnel) m.personnel = [...new Set([...(m.personnel || []), DEBLOCAGES[cle].personnel])];
  ecrireMeta(m);
  return true;
}
/*
 * LES PERMANENTS D'UN PACK (S79) : le personnel et les consommables permanents
 * vont au méta, UNE fois par achat (`recus[cle]`) — une ouverture ne paie pas
 * deux fois. Et un consommable permanent qu'on joue le quitte.
 */
export function recevoirPermanents(ids = [], cleRecu = '') {
  const m = lireMeta();
  m.recus = m.recus || {};
  if (cleRecu && m.recus[cleRecu]) return false;
  if (cleRecu) m.recus[cleRecu] = true;
  const perso = new Set(m.personnel || []);
  m.inventaire = m.inventaire || {};
  for (const id of ids) {
    const [cat, cle] = String(id).split(':');
    if (cat === 'patron') perso.add(cle);
    else m.inventaire[id] = (m.inventaire[id] || 0) + 1;
  }
  m.personnel = [...perso];
  const cles = Object.keys(m.recus);
  if (cles.length > 400) for (const x of cles.slice(0, cles.length - 400)) delete m.recus[x];
  ecrireMeta(m);
  return true;
}
export function retirerDuMeta(id) {
  const m = lireMeta();
  m.inventaire = m.inventaire || {};
  const n = m.inventaire[id] || 0;
  if (n <= 1) delete m.inventaire[id]; else m.inventaire[id] = n - 1;
  ecrireMeta(m);
}
/* La collection : les joueurs (clés) et les cartes tirés des packs. Un ensemble : pas de doublon. */
export function ajouterCollection({ joueurs = [], cartes = [] } = {}) {
  const m = lireMeta();
  const J = new Set(m.collection || []), C = new Set(m.cartes || []);
  for (const k of joueurs) J.add(k);
  for (const k of cartes) C.add(String(k).replace(/\+$/, ''));
  m.collection = [...J]; m.cartes = [...C];
  ecrireMeta(m);
}
/*
 * LES ÉCUSSONS D'UNE RUN : la saison (un par tranche de deux points), les
 * séries (dix par ronde gagnée, vingt de plus pour la Coupe). Payés UNE fois
 * par run et par étape (`recompenses[cle]`) : un rechargement du bilan ne
 * paie pas deux fois.
 */
export function payerEcussons(cleRun, etape, n, { equipe = null, bilan = null } = {}) {
  const m = lireMeta();
  const k = `${cleRun}:${etape}`;
  if (m.recompenses[k]) return 0;
  m.recompenses[k] = true;
  m.ecussonsAVie = ecussonsAVie(m) + Math.max(0, Math.round(n));
  m.ecussons = (m.ecussons || 0) + Math.max(0, Math.round(n));
  // S80 : une run dure plusieurs saisons — on compte les saisons ici, les runs à leur départ.
  if (etape === 'saison') m.saisons = (m.saisons || 0) + 1;
  if (etape === 'series' && bilan && bilan.coupe) m.coupes = (m.coupes || 0) + 1;
  if (equipe) m.derniereEquipe = equipe;
  if (bilan && (!m.meilleur || (bilan.pts || 0) > (m.meilleur.pts || 0) || (bilan.ronde || 0) > (m.meilleur.ronde || 0))) m.meilleur = { ...(m.meilleur || {}), ...bilan };
  // Les vieilles runs payées s'oublient : la liste ne doit pas grossir sans fin.
  const cles = Object.keys(m.recompenses);
  if (cles.length > 200) for (const x of cles.slice(0, cles.length - 200)) delete m.recompenses[x];
  ecrireMeta(m);
  return Math.round(n);
}
export const ecussonsDeLaSaison = pts => Math.floor((pts || 0) / 2);
/* La prime de découverte : un écusson par carte qui finit sa première saison avec toi (js/cartable.js `decouvrir`). */
export const PRIME_DECOUVERTE = 1;
export const ecussonsDesSeries = (rondes, coupe) => (rondes || 0) * 10 + (coupe ? 20 : 0);

/* ---------- la run sur plusieurs saisons (S80) ---------- */
/*
 * L'ÉQUIPE SE DÉFAIT ENTRE DEUX SAISONS (1.0). JP : *pour une saison 2 d'une
 * run, pas repartir avec la même équipe, mais pouvoir garder un ou des
 * joueurs de l'ancienne équipe*. Des plombiers neufs, et tu gardes jusqu'à
 * GARDES_DE_SAISON joueurs de la saison finie, avec les modifs jouées sur
 * eux ; leurs salaires ensemble tiennent dans le budget du classeur.
 */
export const GARDES_DE_SAISON = 5;
/*
 * UNE RUN DURE PLUSIEURS SAISONS. JP : *en roguelike, nouvelle saison veut
 * dire continuer avec base des cartes ramassé qui sont pas des consommables,
 * débloquées, etc*. La saison suivante repart de ton deck et de tes jetons ;
 * les cartes « cette saison » et les consommables expirent.
 *
 * LE MANDAT DU PROPRIO. Une run qui continue tant qu'on fait les séries ne
 * finit presque jamais : une équipe qui passe la première saison se bâtit
 * saison après saison et finit par gagner — mesuré (scripts/check_rogue.mjs),
 * une run sans aucun déblocage gagnait la Coupe une fois sur quatre à six. Le
 * proprio en demande donc PLUS à chaque saison : les séries la première, une
 * ronde gagnée la deuxième, les demi-finales la troisième, la finale
 * ensuite. Manque le mandat et la run est finie ; gagne la Coupe et la run
 * est gagnée. C'est ce qui fait de la Coupe l'affaire de plusieurs saisons ET
 * de plusieurs runs.
 *
 * V5 — LE PROPRIO JUGE LA SAISON, PAS UNE SÉRIE (docs/refonte-v5.md ; JP : *je suis ouvert à tous*). Une série au
 * meilleur de sept est à moitié un tirage : « gagner une ronde » tuait 46 à 67 % des runs en deuxième saison, avec
 * une bonne équipe (mesuré, eco.mjs). Le mandat se lit maintenant au classement de la saison régulière, ce que le
 * build contrôle : les séries d'abord, puis un rang qui monte (le premier tiers de la ligue, le premier quart, les
 * quatre premiers). Les séries paient toujours (40 🪙 la ronde) et donnent la Coupe, qui gagne la run.
 */
export const MANDATS = [
  { part: null, mot: 'faire les séries' },
  { part: 1 / 3, mot: 'finir dans le premier tiers de la ligue' },
  { part: 1 / 4, mot: 'finir dans le premier quart de la ligue' },
  { top: 4, mot: 'finir dans les quatre premiers' },
];
/* Le mandat de la saison `n` (1 = la première de la run). */
export const mandatDe = n => MANDATS[Math.max(0, Math.min(MANDATS.length, n || 1) - 1)];
/* Le rang à atteindre pour le mandat `M` dans une ligue de `nEquipes` clubs (null : faire les séries). */
export const rangDuMandat = (M, nEquipes = 32) => (M.top ? M.top : M.part ? Math.ceil(nEquipes * M.part) : null);
/* La saison a-t-elle rempli son mandat ? `series` : qualifiée ; `rang` : au classement ; `nEquipes` : la taille de la ligue. */
export const mandatRempli = (n, { series = false, rang = Infinity, nEquipes = 32 } = {}) => {
  const seuil = rangDuMandat(mandatDe(n), nEquipes);
  return !!series && (seuil == null || rang <= seuil);
};

/* ---------- les jalons (S80) ---------- */
/*
 * D'AUTRES FAÇONS DE DÉBLOQUER. JP : *ajouter des façons de débloquer etc*.
 * Les écussons s'achètent au vestiaire ; les JALONS, eux, se gagnent en
 * jouant — la première fois qu'on fait les séries, qu'on gagne une ronde,
 * qu'on tient trois saisons dans une run. Chacun paie UNE fois, pour
 * toujours (`m.jalons`) : un déblocage offert s'il n'est pas déjà pris (et
 * que ce qu'il demande l'est), sinon des écussons. Tout se lit dans les
 * résultats de la saison : rien n'est tiré, rien n'est simulé d'avance.
 * `faits` : { series, rondes, pts, premier, finale, coupe, saisonDeLaRun,
 * serieMax (la plus longue séquence de victoires), cartes (au cartable) }.
 */
export const JALONS = [
  { cle: 'series', ico: '🎟️', nom: 'Faire les séries', texte: 'Qualifie-toi pour les séries.', si: f => f.series, recompense: { deblocage: 'classeur1', ecussons: 30 } },
  { cle: 'ronde', ico: '🥊', nom: 'Gagner une ronde', texte: 'Gagne une série des séries.', si: f => (f.rondes || 0) >= 1, recompense: { deblocage: 'banc1', ecussons: 40 } },
  { cle: 'dixDeSuite', ico: '🔥', nom: 'Dix de suite', texte: 'Gagne dix matchs de suite en saison.', si: f => (f.serieMax || 0) >= 10, recompense: { ecussons: 35 } },
  { cle: 'cent', ico: '💯', nom: 'Cent points', texte: 'Fais 100 points en une saison.', si: f => (f.pts || 0) >= 100, recompense: { deblocage: 'classeurTri', ecussons: 50 } },
  { cle: 'deuxSaisons', ico: '📅', nom: 'La deuxième saison', texte: 'Joue la deuxième saison d\'une run.', si: f => (f.saisonDeLaRun || 1) >= 2, recompense: { ecussons: 30 } },
  { cle: 'troisSaisons', ico: '🗓️', nom: 'La troisième saison', texte: 'Joue la troisième saison d\'une run.', si: f => (f.saisonDeLaRun || 1) >= 3, recompense: { deblocage: 'garder1', ecussons: 45 } },
  { cle: 'premier', ico: '🥇', nom: 'Premier de la ligue', texte: 'Finis une saison au premier rang.', si: f => !!f.premier, recompense: { ecussons: 60 } },
  { cle: 'finale', ico: '🏟️', nom: 'La finale', texte: 'Atteins la finale de la Coupe.', si: f => !!f.finale, recompense: { deblocage: 'plafond1', ecussons: 60 } },
  { cle: 'coupe', ico: '🏆', nom: 'La Coupe', texte: 'Gagne la Coupe Stanley.', si: f => !!f.coupe, recompense: { deblocage: 'classeurChoix', ecussons: 120 } },
  { cle: 'cartable', ico: '📒', nom: 'Cent cartes', texte: 'Aie 100 cartes de joueur dans ton cartable.', si: f => (f.cartes || 0) >= 100, recompense: { ecussons: 20 } },
  // 1.0 : le goût d'essayer — des cartes différentes, et tous les niveaux dans la même équipe.
  { cle: 'essais', ico: '🧪', nom: 'Cinquante essais', texte: 'Fais jouer 50 cartes différentes en Rogue.', si: f => (f.joues || 0) >= 50, recompense: { ecussons: 40 } },
  { cle: 'tousNiveaux', ico: '🌈', nom: 'Tous les niveaux', texte: 'Finis une saison avec un joueur de chaque niveau, de Soutien à Phénomène.', si: f => (f.niveaux || 0) >= 5, recompense: { ecussons: 50 } },
];
/* Les jalons que ces faits atteignent et qui n'ont pas encore payé. */
export const jalonsAtteints = (m, faits) => JALONS.filter(J => !(m.jalons || {})[J.cle] && J.si(faits || {}));
/* Ce qu'un jalon donnera, en mots, selon ce que tu possèdes déjà. */
export function recompenseDe(m, J) {
  const d = J.recompense.deblocage && DEBLOCAGES[J.recompense.deblocage];
  const offert = d && !aDebloque(m, J.recompense.deblocage) && (!d.requis || aDebloque(m, d.requis));
  return offert ? { deblocage: J.recompense.deblocage, mot: `${d.ico} ${d.nom}, offert` } : { ecussons: J.recompense.ecussons || 0, mot: `+${J.recompense.ecussons || 0} 🏅` };
}
/*
 * PAYER LES JALONS atteints : une fois chacun (`m.jalons`). Rend ce qui a
 * été payé, pour le dire à l'écran.
 */
export function payerJalons(faits) {
  const m = lireMeta();
  m.jalons = m.jalons || {};
  const payes = [];
  for (const J of jalonsAtteints(m, faits)) {
    const r = recompenseDe(m, J);
    m.jalons[J.cle] = true;
    if (r.deblocage) {
      m.deblocages = [...(m.deblocages || []), r.deblocage];
      if (DEBLOCAGES[r.deblocage].personnel) m.personnel = [...new Set([...(m.personnel || []), DEBLOCAGES[r.deblocage].personnel])];
    } else { m.ecussonsAVie = ecussonsAVie(m) + r.ecussons; m.ecussons = (m.ecussons || 0) + r.ecussons; }
    payes.push({ ...J, mot: r.mot });
  }
  if (payes.length) ecrireMeta(m);
  return payes;
}
