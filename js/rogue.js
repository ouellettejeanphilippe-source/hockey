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

const CLE_META = 'cap82_rogue';

/* ---------- les jetons ---------- */
/*
 * CALIBRÉ (scripts/mesure_rogue.mjs) : des plombiers font 12 à 33 points ; seize joueurs de
 * pack dès le premier jour, 74 à 90 — la bulle des séries. Une run doit donc en signer une
 * vingtaine en cours de saison : environ 25 packs sur 82 matchs, cinq dans les vingt premiers.
 */
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
    + (r.gros || 0) * B.grosMatch + (r.objectifs || 0) * B.objectif + (r.series || 0) * B.serie - (depenses || 0);
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
  packDefenseurs: { ico: '🛡️', nom: 'Le pack Défensif', prix: 35, texte: 'La boutique vend le pack Défensif : quatre joueurs au meilleur différentiel de leur saison.' },
  packGardiens: { ico: '🥅', nom: 'Le pack Gardiens', prix: 50, texte: 'La boutique vend le pack Gardiens : quatre partants au meilleur pourcentage d\'arrêts.' },
  packAnnees80: { ico: '📼', nom: 'Le pack années 80', prix: 60, texte: 'La boutique vend le pack des années 80, l\'époque des 400 buts par saison.' },
  packVedettes: { ico: '🌟', nom: 'Les packs Étoiles et Légendes', prix: 150, texte: 'La boutique vend les packs Étoiles et Légendes : les meilleurs de leur saison.' },
  deckPlus: { ico: '🃏', nom: 'Un deck aiguisé', prix: 50, texte: 'Ton deck de départ commence avec « Lancer de la pointe+ » et « Bloquer des tirs+ ».' },
  plombiersPlus: { ico: '🛠️', nom: 'Des plombiers moins pires', prix: 80, texte: 'Tes plombiers de départ sortent du bas de la ligue, pas du fond du baril.' },
  // S79 : la masse salariale se débloque aussi.
  plafond1: { ico: '💵', nom: 'Une masse salariale indexée', prix: 45, texte: '+3 M$ de plafond au début de chaque run.' },
  plafond2: { ico: '💰', nom: 'Le proprio dépense', prix: 110, requis: 'plafond1', texte: '+4 M$ de plus au début de chaque run (+7 M$ en tout).' },
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
export const RESERVE_PLOMBIERS = 45_000_000;
export const budgetDuClasseur = m => PLAFOND_ROGUE + plafondDuVestiaire(m) - ESPACE_DE_DEPART - RESERVE_PLOMBIERS;
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
export const ecussonsDesSeries = (rondes, coupe) => (rondes || 0) * 10 + (coupe ? 20 : 0);

/* ---------- la run sur plusieurs saisons (S80) ---------- */
/*
 * UNE RUN DURE PLUSIEURS SAISONS. JP : *en roguelike, nouvelle saison veut
 * dire continuer avec base des cartes ramassé qui sont pas des consommables,
 * débloquées, etc*. La saison suivante repart de ton équipe, de ton deck, de
 * tes modifs jouées et de tes jetons ; les cartes « cette saison » et les
 * consommables expirent.
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
 */
export const MANDATS = [
  { rondes: 0, mot: 'faire les séries' },
  { rondes: 1, mot: 'gagner une ronde des séries' },
  { rondes: 2, mot: 'atteindre les demi-finales' },
  { rondes: 3, mot: 'atteindre la finale' },
];
/* Le mandat de la saison `n` (1 = la première de la run). */
export const mandatDe = n => MANDATS[Math.max(0, Math.min(MANDATS.length, n || 1) - 1)];
/* La saison a-t-elle rempli son mandat ? `series` : qualifiée ; `rondes` : séries gagnées. */
export const mandatRempli = (n, { series = false, rondes = 0 } = {}) => !!series && rondes >= mandatDe(n).rondes;

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
    } else m.ecussons = (m.ecussons || 0) + r.ecussons;
    payes.push({ ...J, mot: r.mot });
  }
  if (payes.length) ecrireMeta(m);
  return payes;
}

/* ---------- le hasard pur ---------- */
export function hache(...parts) {
  let h = 2166136261 >>> 0;
  for (const c of parts.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/* Une rareté tirée selon des cotes (en %), de la graine et de mots. */
export function rareteTiree(cotes, ...parts) {
  let r = hache(...parts) * 100;
  for (const k of ['commune', 'peu', 'rare', 'legendaire']) { r -= cotes[k] || 0; if (r < 0) return k; }
  return 'commune';
}
