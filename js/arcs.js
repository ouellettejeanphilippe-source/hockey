/*
 * LES ARCS (Jalon P, E). JP, 12 oct. : *changer les événements pour avoir des événements sans choix, qui font
 * storyline* ; *arcs arrivent seules* ; puis *chaque événement doit être tie up au moteur : chaque chose que tu dis
 * hors moteur doit se voir dans le vrai jeu ; si blessure, séquence, etc., ça doit causer ou être causé par le moteur*.
 *
 * UN ARC NAÎT D'UN FAIT DU MOTEUR, JAMAIS D'UN DÉ. Chaque matin, le moteur (`preludeDuJour`, js/sim.js) lit le
 * journal de ton club — ses matchs joués, ses blessés, son calendrier — et un arc commence quand son fait arrive :
 * cinq victoires de suite, quatre défaites de suite, ton meilleur pointeur blessé pour longtemps, une raclée, une
 * recrue qui marque, trois dos-à-dos en deux semaines. Son second épisode attend lui aussi un fait : la séquence
 * qui casse, la victoire qui délivre, le retour du blessé.
 *
 * ET IL JOUE DANS LE MOTEUR. Chaque épisode pose un effet de quelques matchs sur les canaux qui existent :
 * aucune mécanique neuve. Sa CIBLE (JP, 13 oct. : *arcs de joueurs, d'équipe et d'adversaire*) : l'équipe
 * (`team.effets`), un joueur nommé (ses canaux à lui, `mutDe`) ou un adversaire (seulement les soirs contre lui,
 * `effetsDeSaison`) — `effetsCibles`, js/sim.js.
 *
 * PAS NEUTRES, MÉMORABLES (JP : *ils peuvent nuire ou aider ; je veux des émotions envers les joueurs et l'équipe* ;
 * *varié, complet, différent de saison en saison, adapté aux joueurs de l'équipe*). Un arc aide ou nuit pour de vrai,
 * sous la borne d'une carte peu commune (`check_arcs`) ; il naît de ton effectif (ta recrue, ton vétéran, ton gardien,
 * ta vedette, tes rivaux) ; l'ordre où les arcs se lisent est tiré de la graine de la saison (`ordreDesArcs`) : une
 * saison n'a pas les mêmes arcs que la précédente.
 *
 * CINQ AU PLUS PAR SAISON, À TON CLUB, EN ROGUE (`ARCS_PAR_SAISON`, `ESPACE_ARCS`) ; chacun une fois. Le texte dit
 * le fait avec ses vrais chiffres, lus dans les mêmes feuilles (`check_arcs`) ; la une du bureau le montre.
 */
import { ageAtSeason } from './ratings.js';
import { franchiseDuCode } from './franchises.js';


export const ARCS_PAR_SAISON = 5;
/*
 * LES DÉFIS (oct., JP : *ça doit vraiment impacter un joueur, pis j'aime le principe de s'il réussit un objectif, il a un
 * upgrade permanent genre ceux à mettre derrière la carte* ; *pour mises en échec, bagarres, tirs, précision, défensive,
 * arrêts*). Un arc de joueur lui fixe un défi chiffré, dans SA stat, sur ses prochains matchs : la cible part de son
 * rythme (sa vraie saison, ou ce qu'il fait chez toi pour le physique), une fois et demie, jamais moins que `min`.
 * Relevé, la retouche de son défi se grave au verso de sa carte (`recompense`, MUTATIONS de `source: 'defi'`, js/sim.js) et
 * le suit d'une run à l'autre ; raté, rien de permanent. Tout se recompte dans les feuilles jouées (`avanceDuDefi`).
 */
export const DEFIS = {
  buts: { un: 'but', des: 'buts', min: 3, reel: p => (p.g || 0) / Math.max(1, p.gp || 0), recompense: 'defi_buts' },
  points: { un: 'point', des: 'points', min: 5, reel: p => ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 0), recompense: 'defi_points' },
  tirs: { un: 'tir', des: 'tirs', min: 18, reel: p => (p.sh || 0) / Math.max(1, p.gp || 0), recompense: 'defi_tirs' },
  coups: { un: 'mise en échec', des: 'mises en échec', min: 4, recompense: 'defi_coups' },
  blocs: { un: 'tir bloqué', des: 'tirs bloqués', min: 6, recompense: 'defi_blocs' },
  bagarres: { un: 'bagarre gagnée', des: 'bagarres gagnées', min: 2, recompense: 'defi_bagarres' },
  pm: { un: 'au différentiel', des: 'au différentiel', min: 4, recompense: 'defi_pm' },
  arrets: { gardien: true, departs: 5, recompense: 'defi_arrets' },
};
/* Ce qu'un joueur fait dans une feuille, pour un défi : ses buts, ses points, ses tirs, ses mises en échec, ses bagarres gagnées. */
function dansLaFeuille(e, p, stat) {
  const f = e && e.feuille;
  if (!f) return 0;
  if (stat === 'buts') return f.buts.filter(b => b.marqueur === p).length;
  if (stat === 'points') return f.buts.filter(b => b.marqueur === p || (b.passeurs || []).includes(p)).length;
  if (stat === 'tirs') return (f.lancers || []).filter(l => l.tireur === p).length;
  if (stat === 'coups') return (f.physique || []).filter(x => x.type === 'coup' && x.joueur === p).length;
  if (stat === 'blocs') return (f.physique || []).filter(x => x.type === 'bloc' && x.joueur === p).length;
  if (stat === 'bagarres') return (f.physique || []).filter(x => x.type === 'bagarre' && (x.gagnant === 'A' ? x.joueur : x.gagnant === 'B' ? x.cible : null) === p).length;
  return 0;
}
/* Où en est un défi : ce qu'il a fait (`fait`), sur combien de matchs (`joues`), s'il est fini et relevé. `jusqua` : le journal
   lu jusqu'à ce match (exclu), pour relire un verdict au jour où il a été rendu. */
export function avanceDuDefi(t, x, jusqua = Infinity) {
  const d = x && x.defi, p = x && x.p;
  if (!d || !p) return null;
  const j = (t.journal || []).slice(d.depuis, jusqua);
  if (DEFIS[d.stat].gardien) {
    const siens = j.filter(e => e.gardien === p);
    const sa = siens.reduce((a, e) => a + ((e.feuille && e.feuille.lancers) || []).filter(l => l.gardien === p).length, 0);
    const ga = siens.reduce((a, e) => a + (e.ga || 0), 0);
    const sv = sa ? 1 - ga / sa : 0;
    const fini = siens.length >= d.departs;
    return { fait: sv, joues: siens.length, fini, reussi: fini && sv >= d.cible };
  }
  const fait = d.stat === 'pm' ? (p.simPM || 0) - (d.pm0 || 0) : j.reduce((a, e) => a + dansLaFeuille(e, p, d.stat), 0);
  const reussi = fait >= d.cible;
  return { fait, joues: j.length, fini: reussi || j.length >= d.matchs, reussi };
}
/* Le défi en mots : « 3 buts d'ici 8 matchs », « ,923 sur ses 5 prochains départs ». */
export const motDuDefi = d => {
  const D = DEFIS[d.stat];
  if (D.gardien) return `${String(d.cible.toFixed(3)).replace(/^0/, '')} ou mieux sur ses ${d.departs} prochains départs`;
  return d.stat === 'pm' ? `+${d.cible} au différentiel d'ici ${d.matchs} matchs` : `${d.cible} ${d.cible > 1 ? D.des : D.un} d'ici ${d.matchs} matchs`;
};
/* Des journées entre deux débuts d'arc : un arc a le temps de vivre avant le suivant. */
const ESPACE_ARCS = 10;
/* Les journées qu'un arc attend sa suite ; après, il se termine sans elle (le blessé de toute la saison). */
const ATTENTE_SUITE = 45;

/*
 * Les arcs. `debut(f)` rend le fait (ses chiffres) ou null ; `suite(f, a)` dit si le second épisode arrive ce matin.
 * Chaque épisode : `de` la voix (EXPEDITEURS, js/vie-gm.js), `cible` ('equipe', 'joueur' et `qui(x)`, ou 'contre' et
 * l'adversaire `x.adv`), `effet` sur les canaux existants, `matchs` sa durée en matchs du club.
 */
export const ARCS = {};

/* L'ordre où les arcs se lisent, propre à la saison (sa graine) : d'une saison à l'autre, ce ne sont pas les mêmes. */
function ordreDesArcs(graine) {
  const h = s => { let x = 2166136261; for (const c of `${graine}:${s}`) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
  return Object.keys(ARCS).sort((a, b) => h(a) - h(b));
}

/*
 * LES FAITS DU MATIN, lus dans le journal du club (ses matchs joués), son infirmerie et son calendrier. `jour` :
 * la journée qui commence ; rien d'autre n'est lu.
 */
function faitsDuMatin(t, jour) {
  const j = t.journal || [];
  const deSuite = ok => { let n = 0; for (let i = j.length - 1; i >= 0 && ok(j[i]); i--) n++; return n; };
  const joues = (t._jours || []).filter(x => x < jour);
  const dernierJour = joues.length ? joues[joues.length - 1] : null;
  const dernier = j.length ? j[j.length - 1] : null;
  const habilles = Object.values(t.roster || {}).filter(p => p && p.p !== 'G');
  const sains = habilles.filter(p => !(t.injured && t.injured.has(p)));
  // Le côté de ton club sur une feuille (A ou B), et les buts d'un joueur dans un match.
  const coteDe = e => { const al = e && e.feuille && e.feuille.alignes; if (!al) return null; const a = new Set(al.A || []); return habilles.some(p => a.has(p)) ? 'A' : 'B'; };
  const butsDans = (e, p) => (e && e.feuille ? e.feuille.buts.filter(b => b.marqueur === p).length : 0);
  // Ton meilleur pointeur à ce jour, blessé pour au moins dix matchs (la blessure d'hier soir), et celui qui le suit.
  const parPoints = habilles.slice().sort((a, b) => (b.simPTS || 0) - (a.simPTS || 0));
  const meneur = parPoints[0];
  const blessure = meneur && (t.injuriesLog || []).find(b => b.player === meneur && b.at === t.games && b.games >= 10);
  const second = parPoints.slice(1).find(p => sains.includes(p)) || null;
  // Une recrue (contrat d'entrée) qui a marqué trois buts ou plus dans les cinq derniers matchs.
  const cinq = j.slice(-5);
  const recrues = habilles.filter(p => p.elc).map(p => ({ p, buts: cinq.reduce((a, e) => a + butsDans(e, p), 0) })).filter(x => x.buts >= 3).sort((a, b) => b.buts - a.buts);
  // Hier soir : un tour du chapeau, un vétéran de 35 ans et plus qui marque deux fois, le but en prolongation, l'ancien club.
  const auMatch = dernier ? habilles.map(p => ({ p, buts: butsDans(dernier, p) })).filter(x => x.buts > 0).sort((a, b) => b.buts - a.buts) : [];
  const chapeau = auMatch.find(x => x.buts >= 3) || null;
  const vieux = auMatch.map(x => ({ ...x, age: ageAtSeason(x.p.bd, x.p.s) })).find(x => x.buts >= 2 && x.age >= 35) || null;
  const cote = coteDe(dernier);
  const dernierBut = dernier && dernier.feuille && dernier.feuille.buts.length ? dernier.feuille.buts.slice().sort((a, b) => a.instant - b.instant).at(-1) : null;
  const heros = dernier && dernier.win && dernier.ot && dernierBut && dernierBut.cote === cote && dernierBut.marqueur && habilles.includes(dernierBut.marqueur) ? dernierBut.marqueur : null;
  const franchiseAdv = dernier && dernier.adv ? franchiseDuCode(dernier.adv.tag) : null;
  const ancien = franchiseAdv ? auMatch.find(x => franchiseDuCode(x.p.t) === franchiseAdv) : null;
  // La remontée : gagné après avoir tiré de l'arrière par deux buts ou plus.
  let remontee = null;
  if (dernier && dernier.win && dernier.feuille && cote) {
    let pour = 0, contre = 0, pire = 0;
    for (const b of dernier.feuille.buts.slice().sort((a, c) => a.instant - c.instant)) { if (b.cote === cote) pour++; else contre++; pire = Math.max(pire, contre - pour); }
    if (pire >= 2) remontee = { retard: pire };
  }
  // Ton gardien : trois victoires de suite, un but ou moins chaque soir ; ou six buts et plus accordés hier.
  const g = dernier && dernier.gardien;
  const feu = g ? deSuite(e => e.gardien === g && e.win && e.ga <= 1) : 0;
  const gardienFeu = g && feu === 3 ? { p: g, n: 3, buts: j.slice(-3).reduce((a, e) => a + e.ga, 0) } : null;
  const gardienEbranle = g && dernier.ga >= 6 ? { p: g, ga: dernier.ga } : null;
  // Un adversaire qui t'a battu deux fois cette saison, hier encore ; un des tiens blessé par un coup ou une bagarre hier.
  const defaitesContre = dernier && dernier.adv && !dernier.win ? j.filter(e => e.adv === dernier.adv && !e.win).length : 0;
  const coup = dernier && (t.injuriesLog || []).find(b => b.at === t.games && b.games >= 3 && ['commotion', 'epaule', 'main'].includes(b.genre));
  const recents = joues.filter(x => x >= jour - 14);
  // LES DÉFIS PHYSIQUES ET DU TIR (oct.) : hier soir, une bagarre gagnée, une soirée à frapper, une mitraille sans but ;
  // une victoire à un but ou moins, et le défenseur au meilleur différentiel.
  const fd = dernier && dernier.feuille, phys = (fd && fd.physique) || [];
  const gagnantDe = x => (x.gagnant === 'A' ? x.joueur : x.gagnant === 'B' ? x.cible : null);
  const bag = phys.find(x => x.type === 'bagarre' && habilles.includes(gagnantDe(x)));
  const parJoueur = (liste, cle) => { const m = new Map(); for (const x of liste) { const q = cle(x); if (habilles.includes(q)) m.set(q, (m.get(q) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1])[0] || null; };
  const fr = parJoueur(phys.filter(x => x.type === 'coup'), x => x.joueur);
  // Le bouclier (oct. 2026) : le patineur qui a bloqué le plus de lancers hier soir, cinq au moins.
  const bq = parJoueur(phys.filter(x => x.type === 'bloc'), x => x.joueur);
  const tirsHier = fd ? parJoueur((fd.lancers || []).filter(l => !fd.buts.some(b => b.marqueur === l.tireur)), l => l.tireur) : null;
  const defenseurs = habilles.filter(p => p.p === 'D' || p.p === 'LD' || p.p === 'RD').sort((a, b) => (b.simPM || 0) - (a.simPM || 0));
  return {
    club: t, journal: j,
    bagarreur: bag ? { p: gagnantDe(bag), adv: gagnantDe(bag) === bag.joueur ? bag.cible : bag.joueur } : null,
    frappeur: fr && fr[1] >= 3 ? { p: fr[0], n: fr[1] } : null,
    bouclier: bq && bq[1] >= 5 ? { p: bq[0], n: bq[1] } : null,
    mitraille: tirsHier && tirsHier[1] >= 6 ? { p: tirsHier[0], n: tirsHier[1] } : null,
    verrou: dernier && dernier.win && dernier.ga <= 1 && defenseurs[0] && (defenseurs[0].simPM || 0) > 0 ? { p: defenseurs[0], ga: dernier.ga } : null,
    matchs: j.length, dernier, dernierJour,
    victoires: deSuite(e => e.win), defaites: deSuite(e => !e.win),
    meneurBlesse: blessure ? { p: meneur, matchs: blessure.games } : null, second,
    recrue: recrues[0] || null, chapeau, vieux, heros, ancien: ancien ? { p: ancien.p, adv: dernier.adv } : null, remontee,
    gardienFeu, gardienEbranle,
    beteNoire: defaitesContre >= 2 ? { adv: dernier.adv, n: defaitesContre } : null,
    rancune: coup ? { adv: dernier.adv, p: coup.player, matchs: coup.games } : null,
    dosADos: recents.filter(x => recents.includes(x - 1)).length,
    repos: dernierJour == null ? 0 : jour - 1 - dernierJour,
    enSante: p => !(t.injured && t.injured.has(p)),
    // Les matchs de suite sans but d'un joueur, du plus récent en arrière (ceux qu'il a manqués comptent).
    sansBut: p => deSuite(e => butsDans(e, p) === 0),
  };
}

/*
 * LES ÉPISODES DE CE MATIN, purs : de l'état du club et de la graine de la saison, sans hasard. `t.arcs` garde
 * l'histoire (le journal que l'écran lit) ; un arc en cours attend sa suite, un nouveau attend que l'espace soit
 * passé et qu'il en reste à vivre. Rend [{ cle, ep, titre, de, texte, effet, matchs, cible, joueur, contre }].
 */
export function episodesDuMatin(t, jour, graine = '') {
  t.arcs = t.arcs || [];
  // Une fois par match joué : un matin sans match d'hier ne change aucun fait.
  if (t._arcsVus === t.games) return [];
  t._arcsVus = t.games;
  const f = faitsDuMatin(t, jour);
  const out = [];
  const ecrire = (cle, ep, x) => {
    const A = ARCS[cle], E = A.episodes[ep];
    // Le défi se pose au premier épisode ; au second, son verdict : relevé, la retouche au verso (`recompense`), sans panne.
    if (ep === 0 && A.defi) x = { ...x, defi: A.defi(x, f) };
    if (E.verdict) x = { ...x, avance: avanceDuDefi(t, x) };
    const reussi = !!(E.verdict && x.avance && x.avance.reussi);
    const joueur = E.cible === 'joueur' ? E.qui(x) : null, contre = E.cible === 'contre' ? x.adv : null;
    const e = { cle, ep, jour, titre: A.titre, de: E.de, texte: E.texte(x), effet: reussi ? {} : E.effet, matchs: E.matchs, cible: E.cible, joueur, contre,
      ...(reussi ? { recompense: DEFIS[x.defi.stat].recompense } : {}),
      pour: joueur ? joueur.n : contre ? `contre ${contre.name}` : null, x, matchsAuDebut: f.matchs };
    t.arcs.push(e);
    out.push(e);
  };
  // La suite d'un arc en cours (commencé, sans second épisode) ; passé ATTENTE_SUITE journées, il se termine sans elle.
  const enCours = t.arcs.filter(a => a.ep === 0 && !t.arcs.some(b => b.cle === a.cle && b.ep === 1) && jour - a.jour <= ATTENTE_SUITE);
  for (const a of enCours) {
    const A = ARCS[a.cle];
    if (jour > a.jour && A.suite(f, { x: a.x, matchs: a.matchsAuDebut })) ecrire(a.cle, 1, { ...a.x, repos: f.repos });
  }
  // Un arc neuf : au plus ARCS_PAR_SAISON, espacés d'ESPACE_ARCS journées, chacun une fois ; dans l'ordre de la saison.
  const debuts = t.arcs.filter(a => a.ep === 0);
  const libre = debuts.length < ARCS_PAR_SAISON && (!debuts.length || jour - debuts[debuts.length - 1].jour >= ESPACE_ARCS);
  if (libre && !out.length) {
    for (const cle of ordreDesArcs(graine)) {
      if (debuts.some(a => a.cle === cle) || enCours.some(a => ARCS[a.cle].famille === ARCS[cle].famille)) continue;
      const x = ARCS[cle].debut(f);
      if (x) { ecrire(cle, 0, x); break; }
    }
  }
  return out;
}
