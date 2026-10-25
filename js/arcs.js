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
 * UN JOUEUR EN FEU, POUR VRAI (oct., JP : *0,4 pt, ça va fuck all faire* ; *si un joueur qui score pas est en feu, ça veut
 * souvent dire genre 3-4 buts en 6-10 matchs*). Les arcs d'un joueur jouaient ×1,06 sur quatre matchs : un dixième de but.
 * En feu, il double à peu près son rythme de buts (sa précision et ses tirs) pendant huit matchs — un joueur de profondeur
 * à 0,15 but par match en met deux ou trois au lieu d'un ; en panne, il en perd le quart pendant cinq. Un gardien chaud
 * accorde 18 % de buts de moins, ébranlé 18 % de plus. Toujours sous la borne d'une peu commune (`check_arcs`).
 */
const EN_FEU = { finition: 1.45, lancers: 1.35 };
const EN_PANNE = { finition: 0.75 };
const FEU = 8, PANNE = 5;

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
  if (stat === 'bagarres') return (f.physique || []).filter(x => x.type === 'bagarre' && (x.gagnant === 'A' ? x.joueur : x.gagnant === 'B' ? x.cible : null) === p).length;
  return 0;
}
/* Le défi d'un joueur, posé ce matin : sa stat, sa cible, ses matchs. `j` : le journal du club jusqu'ici. */
function poserDefi(stat, p, j, matchs) {
  const D = DEFIS[stat];
  if (D.gardien) return { stat, departs: D.departs, cible: Math.max(0.915, Math.round(((p.sv || 0.9) + 0.008) * 1000) / 1000), depuis: j.length };
  // Le physique se lit chez toi (le moteur compte ses mises en échec et ses bagarres), le reste dans sa vraie saison.
  const habille = j.filter(e => e.feuille && Object.values(e.feuille.alignes || {}).some(l => (l || []).includes(p)));
  const chezToi = habille.length ? habille.reduce((a, e) => a + dansLaFeuille(e, p, stat), 0) / habille.length : 0;
  const rythme = D.reel ? D.reel(p) : chezToi;
  return { stat, matchs, cible: stat === 'pm' ? D.min : Math.max(D.min, Math.ceil(rythme * matchs * 1.5)), depuis: j.length, ...(stat === 'pm' ? { pm0: p.simPM || 0 } : {}) };
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
const motFait = (d, a) => (DEFIS[d.stat].gardien ? String(a.fait.toFixed(3)).replace(/^0/, '') : d.stat === 'pm' ? `${a.fait >= 0 ? '+' : ''}${a.fait}` : `${a.fait} ${a.fait > 1 ? DEFIS[d.stat].des : DEFIS[d.stat].un}`);
/* Le second épisode d'un arc à défi : le verdict, dit avec ses vrais chiffres ; raté, `panne` le temps de quelques matchs. */
const verdict = (de, panne = {}) => ({ de, cible: 'joueur', qui: x => x.p, verdict: true, matchs: PANNE, effet: panne,
  texte: x => (x.avance.reussi
    ? `${x.p.n} a relevé son défi : ${motFait(x.defi, x.avance)} en ${x.avance.joues} ${DEFIS[x.defi.stat].gardien ? 'départs' : 'matchs'}. C'est gravé au verso de sa carte.`
    : `${x.p.n} : ${motFait(x.defi, x.avance)}, pour ${motDuDefi(x.defi).split(' d\'ici')[0].split(' ou mieux')[0]}. Le défi lui a échappé.`) });
const finDuDefi = (f, a) => { const v = avanceDuDefi(f.club, a.x); return !!(v && v.fini); };
/* Des journées entre deux débuts d'arc : un arc a le temps de vivre avant le suivant. */
const ESPACE_ARCS = 10;
/* Les journées qu'un arc attend sa suite ; après, il se termine sans elle (le blessé de toute la saison). */
const ATTENTE_SUITE = 45;
/* Un arc contre un adversaire vaut pour le reste de la saison, mais seulement les soirs contre lui. */
const SAISON = 82;

const pl = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const nom = p => String(p.n).split(' ').slice(-1)[0];

/*
 * Les arcs. `debut(f)` rend le fait (ses chiffres) ou null ; `suite(f, a)` dit si le second épisode arrive ce matin.
 * Chaque épisode : `de` la voix (EXPEDITEURS, js/vie-gm.js), `cible` ('equipe', 'joueur' et `qui(x)`, ou 'contre' et
 * l'adversaire `x.adv`), `effet` sur les canaux existants, `matchs` sa durée en matchs du club.
 */
export const ARCS = {
  /* ---------- l'équipe ---------- */
  emballe: {
    titre: 'La ville s\'emballe', famille: 'equipe',
    debut: f => (f.victoires === 5 ? { n: 5 } : null),
    episodes: [
      { de: 'pt', cible: 'equipe', texte: x => `${x.n} victoires de suite. Au restaurant du coin, on ne parle que de ça, et le vestiaire commence à y croire.`, effet: { finition: 1.03, discipline: 1.12 }, matchs: 5 },
      { de: 'en', cible: 'equipe', texte: () => 'La séquence prend fin. Dès la pratique du lendemain, l\'entraîneur ramène tout le monde sur terre : on défend d\'abord.', effet: { defense: 0.97, volume: 0.95 }, matchs: 4 },
    ],
    suite: f => f.dernier && !f.dernier.win,
  },
  huisClos: {
    titre: 'La réunion à huis clos', famille: 'equipe',
    debut: f => (f.defaites === 4 ? { n: 4 } : null),
    episodes: [
      { de: 'ca', cible: 'equipe', texte: x => `${x.n} défaites de suite. Les joueurs s'enferment au vestiaire, sans les entraîneurs : plus une punition bête.`, effet: { discipline: 0.88, finition: 0.95 }, matchs: 4 },
      { de: 'en', cible: 'equipe', texte: () => 'Enfin une victoire. Le vestiaire respire, et les avants retrouvent le chemin du filet.', effet: { finition: 1.03 }, matchs: 4 },
    ],
    suite: f => f.dernier && f.dernier.win,
  },
  raclee: {
    titre: 'La raclée', famille: 'equipe',
    debut: f => (f.dernier && !f.dernier.win && f.dernier.ga - f.dernier.gf >= 5 ? { gf: f.dernier.gf, ga: f.dernier.ga } : null),
    episodes: [
      { de: 'an', cible: 'equipe', texte: x => `Une raclée, ${x.ga}-${x.gf}. Le vestiaire veut se racheter, quitte à jouer des coudes.`, effet: { volume: 1.03, discipline: 1.15 }, matchs: 3 },
      { de: 'pt', cible: 'equipe', texte: () => 'La revanche est servie. On souffle un peu, et la garde baisse derrière.', effet: { defense: 1.04 }, matchs: 3 },
    ],
    suite: f => f.dernier && f.dernier.win,
  },
  remontee: {
    titre: 'La remontée', famille: 'equipe',
    debut: f => (f.remontee ? { retard: f.remontee.retard, gf: f.dernier.gf, ga: f.dernier.ga } : null),
    episodes: [
      { de: 'pt', cible: 'equipe', texte: x => `Menés par ${x.retard}, gagnants ${x.gf}-${x.ga}. Plus personne ne quitte l'aréna avant la sirène.`, effet: { finition: 1.04, volume: 1.03 }, matchs: 4 },
      { de: 'en', cible: 'equipe', texte: () => 'Une défaite, et l\'entraîneur en profite : fini de courir après le pointage, on resserre derrière.', effet: { defense: 1.03 }, matchs: 3 },
    ],
    suite: f => f.dernier && !f.dernier.win,
  },
  calendrier: {
    titre: 'Le calendrier de fou', famille: 'equipe',
    debut: f => (f.dosADos >= 3 ? { n: f.dosADos } : null),
    episodes: [
      { de: 'ph', cible: 'equipe', texte: x => `${x.n} dos-à-dos en deux semaines. Au vestiaire, les sacs de glace font le tour des cuisses.`, effet: { energie: 1.15 }, matchs: 3 },
      { de: 'en', cible: 'equipe', texte: x => `Enfin ${pl(x.repos, 'journée')} sans match. Les jambes reviennent ; la touche, un peu moins.`, effet: { energie: 0.85, finition: 0.98 }, matchs: 3 },
    ],
    suite: f => f.repos >= 3,
  },

  /* ---------- un joueur : chacun pose un défi (`defi`), et son second épisode en dit le verdict ---------- */
  recrue: {
    titre: 'La recrue fait jaser', famille: 'joueur',
    debut: f => (f.recrue ? { p: f.recrue.p, buts: f.recrue.buts } : null),
    defi: (x, f) => poserDefi('points', x.p, f.journal, FEU),
    episodes: [
      { de: 'an', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n}, encore à son contrat d'entrée, compte ${pl(x.buts, 'but')} en cinq matchs. Toute la ligue a son nom à la bouche.`, effet: EN_FEU, matchs: FEU },
      verdict('ph', EN_PANNE),
    ],
    suite: finDuDefi,
  },
  releve: {
    titre: 'La relève', famille: 'joueur',
    debut: f => (f.meneurBlesse && f.second ? { p: f.second, meneur: f.meneurBlesse.p, matchs: f.meneurBlesse.matchs } : null),
    defi: (x, f) => poserDefi('points', x.p, f.journal, FEU),
    episodes: [
      { de: 'ca', cible: 'joueur', qui: x => x.p, texte: x => `${x.meneur.n}, ton meilleur pointeur, rate ${pl(x.matchs, 'match')}. ${x.p.n} hérite de son trio, et de ses responsabilités.`, effet: { ...EN_FEU, creation: 1.2 }, matchs: FEU },
      verdict('pt', EN_PANNE),
    ],
    suite: finDuDefi,
  },
  vieuxLion: {
    titre: 'Le vieux lion', famille: 'joueur',
    debut: f => (f.vieux ? { p: f.vieux.p, age: f.vieux.age, buts: f.vieux.buts } : null),
    defi: (x, f) => poserDefi('buts', x.p, f.journal, FEU),
    episodes: [
      { de: 'pa', cible: 'joueur', qui: x => x.p, texte: x => `À ${x.age} ans, ${x.p.n} en a mis ${x.buts} hier soir. Au vestiaire, les jeunes se taisent quand il parle.`, effet: EN_FEU, matchs: FEU },
      verdict('ph', { blessure: 1.5, lancers: 0.8 }),
    ],
    suite: finDuDefi,
  },
  chapeau: {
    titre: 'Le tour du chapeau', famille: 'joueur',
    debut: f => (f.chapeau ? { p: f.chapeau.p, buts: f.chapeau.buts } : null),
    defi: (x, f) => poserDefi('buts', x.p, f.journal, FEU),
    episodes: [
      { de: 'pt', cible: 'joueur', qui: x => x.p, texte: x => `${pl(x.buts, 'but')} pour ${x.p.n} hier soir. Au vestiaire, on lui a gardé la rondelle du tour du chapeau.`, effet: EN_FEU, matchs: FEU },
      verdict('an', EN_PANNE),
    ],
    suite: finDuDefi,
  },
  heros: {
    titre: 'Le héros du soir', famille: 'joueur',
    debut: f => (f.heros ? { p: f.heros } : null),
    defi: (x, f) => poserDefi('buts', x.p, f.journal, FEU),
    episodes: [
      { de: 'co', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n} met fin au match en prolongation. Ce matin, c'est son nom qu'on entend à la radio.`, effet: EN_FEU, matchs: FEU },
      verdict('ag', { ...EN_PANNE, defense: 1.04 }),
    ],
    suite: finDuDefi,
  },
  ancienClub: {
    titre: 'Contre son ancien club', famille: 'joueur',
    debut: f => (f.ancien ? { p: f.ancien.p, adv: f.ancien.adv } : null),
    defi: (x, f) => poserDefi('buts', x.p, f.journal, FEU),
    episodes: [
      { de: 'an', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n} a trouvé le fond du filet contre ${x.adv.name}, son ancien club. Celui-là, il l'attendait.`, effet: EN_FEU, matchs: FEU },
      verdict('en', EN_PANNE),
    ],
    suite: finDuDefi,
  },
  mitraille: {
    titre: 'La mitraille', famille: 'joueur',
    debut: f => (f.mitraille ? { p: f.mitraille.p, n: f.mitraille.n } : null),
    defi: (x, f) => poserDefi('tirs', x.p, f.journal, FEU),
    episodes: [
      { de: 'an', cible: 'joueur', qui: x => x.p, texte: x => `${x.n} tirs pour ${x.p.n} hier soir, et pas un dans le filet. Il ne lâchera pas le gardien.`, effet: { lancers: 1.35 }, matchs: FEU },
      verdict('en', EN_PANNE),
    ],
    suite: finDuDefi,
  },
  frappeur: {
    titre: 'Le frappeur', famille: 'joueur',
    debut: f => (f.frappeur ? { p: f.frappeur.p, n: f.frappeur.n } : null),
    defi: (x, f) => poserDefi('coups', x.p, f.journal, FEU),
    episodes: [
      { de: 'ca', cible: 'joueur', qui: x => x.p, texte: x => `${pl(x.n, 'mise en échec')} de ${x.p.n} hier soir. Leurs défenseurs regardaient par-dessus leur épaule.`, effet: { blessure: 0.85 }, matchs: FEU },
      verdict('ph', { blessure: 1.2 }),
    ],
    suite: finDuDefi,
  },
  bagarreur: {
    titre: 'Les poings', famille: 'joueur',
    debut: f => (f.bagarreur ? { p: f.bagarreur.p, adv: f.bagarreur.adv } : null),
    defi: (x, f) => poserDefi('bagarres', x.p, f.journal, 10),
    episodes: [
      { de: 'pt', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n} a gagné sa bagarre contre ${x.adv.n}. Les partisans ont scandé son nom jusqu'à la sirène.`, effet: { blessure: 0.85 }, matchs: 10 },
      verdict('ph', { blessure: 1.2 }),
    ],
    suite: finDuDefi,
  },
  verrou: {
    titre: 'Le verrou', famille: 'joueur',
    debut: f => (f.verrou ? { p: f.verrou.p, ga: f.verrou.ga } : null),
    defi: (x, f) => poserDefi('pm', x.p, f.journal, FEU),
    episodes: [
      { de: 'en', cible: 'joueur', qui: x => x.p, texte: x => `${pl(x.ga, 'but')} accordé${x.ga > 1 ? 's' : ''} hier soir, et ${x.p.n} sur la glace pour les grosses présences. L'entraîneur le veut contre leur premier trio.`, effet: { defense: 0.9 }, matchs: FEU },
      verdict('en', { defense: 1.06 }),
    ],
    suite: finDuDefi,
  },
  gardienFeu: {
    titre: 'Le gardien en feu', famille: 'joueur',
    debut: f => (f.gardienFeu ? { p: f.gardienFeu.p, n: f.gardienFeu.n, buts: f.gardienFeu.buts } : null),
    defi: (x, f) => poserDefi('arrets', x.p, f.journal),
    episodes: [
      { de: 'pt', cible: 'joueur', qui: x => x.p, texte: x => `${x.n} victoires de suite pour ${x.p.n}, ${pl(x.buts, 'but')} accordé${x.buts > 1 ? 's' : ''} en tout. Devant lui, les défenseurs osent monter.`, effet: { arrets: 0.82 }, matchs: 6 },
      verdict('an', { arrets: 1.12 }),
    ],
    suite: finDuDefi,
  },
  gardienEbranle: {
    titre: 'Le gardien ébranlé', famille: 'joueur',
    debut: f => (f.gardienEbranle ? { p: f.gardienEbranle.p, ga: f.gardienEbranle.ga } : null),
    defi: (x, f) => poserDefi('arrets', x.p, f.journal),
    episodes: [
      { de: 'an', cible: 'joueur', qui: x => x.p, texte: x => `${x.ga} buts dans le filet de ${x.p.n} hier soir. À chacun, on a vu ses épaules tomber un peu plus. L'entraîneur lui redonne le filet quand même.`, effet: { arrets: 1.1 }, matchs: 3 },
      verdict('ca', { arrets: 1.1 }),
    ],
    suite: finDuDefi,
  },

  /* ---------- un adversaire ---------- */
  beteNoire: {
    titre: 'La bête noire', famille: 'contre',
    debut: f => (f.beteNoire ? { adv: f.beteNoire.adv, n: f.beteNoire.n } : null),
    episodes: [
      { de: 'pt', cible: 'contre', texte: x => `${pl(x.n, 'défaite')} contre ${x.adv.name} cette saison. Au vestiaire, le prochain duel est encerclé au calendrier.`, effet: { finition: 1.05, discipline: 1.12 }, matchs: SAISON },
      { de: 'ca', cible: 'contre', texte: x => `Enfin une victoire contre ${x.adv.name}. Le vestiaire n'a plus peur de ce chandail-là.`, effet: { volume: 1.04 }, matchs: SAISON },
    ],
    suite: (f, a) => f.dernier && f.dernier.win && f.dernier.adv === a.x.adv,
  },
  rancune: {
    titre: 'La rancune', famille: 'contre',
    debut: f => (f.rancune ? { adv: f.rancune.adv, p: f.rancune.p, matchs: f.rancune.matchs } : null),
    episodes: [
      { de: 'ca', cible: 'contre', texte: x => `${x.p.n} se blesse sur un coup contre ${x.adv.name} : ${pl(x.matchs, 'match')} à l'écart. Le vestiaire n'oubliera pas.`, effet: { robustesse: 1.5, discipline: 1.2 }, matchs: SAISON },
      { de: 'pt', cible: 'contre', texte: x => `Battus, ${x.adv.name}. Celle-là, c'était pour ${nom(x.p)}.`, effet: { finition: 1.03 }, matchs: SAISON },
    ],
    suite: (f, a) => f.dernier && f.dernier.win && f.dernier.adv === a.x.adv,
  },
};

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
  const tirsHier = fd ? parJoueur((fd.lancers || []).filter(l => !fd.buts.some(b => b.marqueur === l.tireur)), l => l.tireur) : null;
  const defenseurs = habilles.filter(p => p.p === 'D' || p.p === 'LD' || p.p === 'RD').sort((a, b) => (b.simPM || 0) - (a.simPM || 0));
  return {
    club: t, journal: j,
    bagarreur: bag ? { p: gagnantDe(bag), adv: gagnantDe(bag) === bag.joueur ? bag.cible : bag.joueur } : null,
    frappeur: fr && fr[1] >= 3 ? { p: fr[0], n: fr[1] } : null,
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
