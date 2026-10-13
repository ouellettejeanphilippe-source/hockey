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
      { de: 'pt', cible: 'equipe', texte: x => `${x.n} victoires de suite : la ville s'emballe, et le vestiaire avec.`, effet: { finition: 1.03, discipline: 1.12 }, matchs: 5 },
      { de: 'en', cible: 'equipe', texte: () => 'La séquence s\'arrête. L\'entraîneur ramène tout le monde sur terre : on défend d\'abord, on tire moins.', effet: { defense: 0.97, volume: 0.95 }, matchs: 4 },
    ],
    suite: f => f.dernier && !f.dernier.win,
  },
  huisClos: {
    titre: 'La réunion à huis clos', famille: 'equipe',
    debut: f => (f.defaites === 4 ? { n: 4 } : null),
    episodes: [
      { de: 'ca', cible: 'equipe', texte: x => `${x.n} défaites de suite. Les joueurs se parlent, portes fermées : plus une punition bête.`, effet: { discipline: 0.88, finition: 0.95 }, matchs: 4 },
      { de: 'en', cible: 'equipe', texte: () => 'Enfin une victoire. Le vestiaire respire, et ça se voit devant le filet.', effet: { finition: 1.03 }, matchs: 4 },
    ],
    suite: f => f.dernier && f.dernier.win,
  },
  raclee: {
    titre: 'La raclée', famille: 'equipe',
    debut: f => (f.dernier && !f.dernier.win && f.dernier.ga - f.dernier.gf >= 5 ? { gf: f.dernier.gf, ga: f.dernier.ga } : null),
    episodes: [
      { de: 'an', cible: 'equipe', texte: x => `Une raclée, ${x.ga}-${x.gf}. Le vestiaire a quelque chose à prouver, et il le prouve un peu trop.`, effet: { volume: 1.03, discipline: 1.15 }, matchs: 3 },
      { de: 'pt', cible: 'equipe', texte: () => 'La revanche est servie. On souffle, et la vigilance retombe un peu derrière.', effet: { defense: 1.04 }, matchs: 3 },
    ],
    suite: f => f.dernier && f.dernier.win,
  },
  remontee: {
    titre: 'La remontée', famille: 'equipe',
    debut: f => (f.remontee ? { retard: f.remontee.retard, gf: f.dernier.gf, ga: f.dernier.ga } : null),
    episodes: [
      { de: 'pt', cible: 'equipe', texte: x => `Menés par ${x.retard}, gagnants ${x.gf}-${x.ga}. Plus personne ne quitte l'aréna avant la fin.`, effet: { finition: 1.04, volume: 1.03 }, matchs: 4 },
      { de: 'en', cible: 'equipe', texte: () => 'On a pris l\'habitude de courir après le pointage. L\'entraîneur, lui, n\'aime pas ça.', effet: { defense: 1.03 }, matchs: 3 },
    ],
    suite: f => f.dernier && !f.dernier.win,
  },
  calendrier: {
    titre: 'Le calendrier de fou', famille: 'equipe',
    debut: f => (f.dosADos >= 3 ? { n: f.dosADos } : null),
    episodes: [
      { de: 'ph', cible: 'equipe', texte: x => `${x.n} dos-à-dos en deux semaines : les jambes brûlent.`, effet: { energie: 1.15 }, matchs: 3 },
      { de: 'en', cible: 'equipe', texte: x => `Enfin ${pl(x.repos, 'journée')} sans match : les jambes reviennent, la touche un peu moins.`, effet: { energie: 0.85, finition: 0.98 }, matchs: 3 },
    ],
    suite: f => f.repos >= 3,
  },

  /* ---------- un joueur ---------- */
  recrue: {
    titre: 'La recrue fait jaser', famille: 'joueur',
    debut: f => (f.recrue ? { p: f.recrue.p, buts: f.recrue.buts } : null),
    episodes: [
      { de: 'an', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n}, à son contrat d'entrée : ${pl(x.buts, 'but')} en cinq matchs. Toute la ligue en parle.`, effet: { finition: 1.1, lancers: 1.05 }, matchs: 5 },
      { de: 'ph', cible: 'joueur', qui: x => x.p, texte: x => `Le mur des recrues : ${x.p.n} a les jambes lourdes, et la rondelle ne rentre plus.`, effet: { finition: 0.92 }, matchs: 6 },
    ],
    suite: (f, a) => f.matchs - a.matchs >= 12,
  },
  releve: {
    titre: 'La relève', famille: 'joueur',
    debut: f => (f.meneurBlesse && f.second ? { p: f.second, meneur: f.meneurBlesse.p, matchs: f.meneurBlesse.matchs } : null),
    episodes: [
      { de: 'ca', cible: 'joueur', qui: x => x.p, texte: x => `${x.meneur.n}, ton meilleur pointeur, rate ${pl(x.matchs, 'match')}. ${x.p.n} prend son trio, et ses responsabilités.`, effet: { finition: 1.08, creation: 1.06 }, matchs: 6 },
      { de: 'pt', cible: 'joueur', qui: x => x.meneur, texte: x => `${x.meneur.n} est de retour. Le banc se lève quand il saute sur la glace.`, effet: { finition: 1.06, lancers: 1.05 }, matchs: 4 },
    ],
    suite: (f, a) => f.enSante(a.x.meneur),
  },
  vieuxLion: {
    titre: 'Le vieux lion', famille: 'joueur',
    debut: f => (f.vieux ? { p: f.vieux.p, age: f.vieux.age, buts: f.vieux.buts } : null),
    episodes: [
      { de: 'pa', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n}, ${x.age} ans, ${pl(x.buts, 'but')} hier soir. Les jeunes l'écoutent quand il parle.`, effet: { finition: 1.08 }, matchs: 5 },
      { de: 'ph', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n} se lève plus lentement le matin. À ${x.age} ans, le corps rappelle son âge.`, effet: { blessure: 1.5, lancers: 0.95 }, matchs: 6 },
    ],
    suite: (f, a) => f.matchs - a.matchs >= 8,
  },
  chapeau: {
    titre: 'Le tour du chapeau', famille: 'joueur',
    debut: f => (f.chapeau ? { p: f.chapeau.p, buts: f.chapeau.buts } : null),
    episodes: [
      { de: 'pt', cible: 'joueur', qui: x => x.p, texte: x => `${pl(x.buts, 'but')} pour ${x.p.n} : les casquettes pleuvent sur la glace.`, effet: { finition: 1.06, lancers: 1.05 }, matchs: 4 },
      { de: 'an', cible: 'joueur', qui: x => x.p, texte: x => `Trois matchs sans but pour ${x.p.n}. Tout le monde l'attend, et ça pèse.`, effet: { finition: 0.95 }, matchs: 3 },
    ],
    suite: (f, a) => f.sansBut(a.x.p) >= 3,
  },
  heros: {
    titre: 'Le héros du soir', famille: 'joueur',
    debut: f => (f.heros ? { p: f.heros } : null),
    episodes: [
      { de: 'co', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n} marque en prolongation. Son chandail se vend plus que les autres ce matin.`, effet: { finition: 1.06 }, matchs: 4 },
      { de: 'ag', cible: 'joueur', qui: x => x.p, texte: x => `L'agent de ${x.p.n} parle déjà de contrat. Lui pense à autre chose qu'au hockey.`, effet: { finition: 0.96, defense: 1.04 }, matchs: 3 },
    ],
    suite: (f, a) => f.sansBut(a.x.p) >= 5,
  },
  ancienClub: {
    titre: 'Contre son ancien club', famille: 'joueur',
    debut: f => (f.ancien ? { p: f.ancien.p, adv: f.ancien.adv } : null),
    episodes: [
      { de: 'an', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n} a marqué contre ${x.adv.name}, son ancien club. Il ne l'a pas célébré en silence.`, effet: { finition: 1.06, lancers: 1.04 }, matchs: 5 },
      { de: 'en', cible: 'joueur', qui: x => x.p, texte: x => `${nom(x.p)} retombe sur terre : la rancune, ça ne marque pas tous les soirs.`, effet: { finition: 0.97 }, matchs: 3 },
    ],
    suite: (f, a) => f.sansBut(a.x.p) >= 4,
  },
  gardienFeu: {
    titre: 'Le gardien en feu', famille: 'joueur',
    debut: f => (f.gardienFeu ? { p: f.gardienFeu.p, n: f.gardienFeu.n, buts: f.gardienFeu.buts } : null),
    episodes: [
      { de: 'pt', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n} : ${x.n} victoires de suite, ${pl(x.buts, 'but')} accordé${x.buts > 1 ? 's' : ''}. On scande son nom.`, effet: { arrets: 0.92 }, matchs: 4 },
      { de: 'an', cible: 'joueur', qui: x => x.p, texte: x => `La séquence de ${x.p.n} s'arrête. Il cherche ses repères.`, effet: { arrets: 1.05 }, matchs: 3 },
    ],
    suite: f => f.dernier && !f.dernier.win,
  },
  gardienEbranle: {
    titre: 'Le gardien ébranlé', famille: 'joueur',
    debut: f => (f.gardienEbranle ? { p: f.gardienEbranle.p, ga: f.gardienEbranle.ga } : null),
    episodes: [
      { de: 'an', cible: 'joueur', qui: x => x.p, texte: x => `${x.ga} buts accordés par ${x.p.n}. On a vu ses épaules tomber.`, effet: { arrets: 1.07 }, matchs: 3 },
      { de: 'ca', cible: 'joueur', qui: x => x.p, texte: x => `${x.p.n} se relève, et le vestiaire avec lui.`, effet: { arrets: 0.95 }, matchs: 4 },
    ],
    suite: (f, a) => f.dernier && f.dernier.win && f.dernier.gardien === a.x.p,
  },

  /* ---------- un adversaire ---------- */
  beteNoire: {
    titre: 'La bête noire', famille: 'contre',
    debut: f => (f.beteNoire ? { adv: f.beteNoire.adv, n: f.beteNoire.n } : null),
    episodes: [
      { de: 'pt', cible: 'contre', texte: x => `${pl(x.n, 'défaite')} contre ${x.adv.name} cette saison. Au prochain, on leur en doit une.`, effet: { finition: 1.05, discipline: 1.12 }, matchs: SAISON },
      { de: 'ca', cible: 'contre', texte: x => `${x.adv.name} est enfin tombé. Ils ne nous font plus peur.`, effet: { volume: 1.04 }, matchs: SAISON },
    ],
    suite: (f, a) => f.dernier && f.dernier.win && f.dernier.adv === a.x.adv,
  },
  rancune: {
    titre: 'La rancune', famille: 'contre',
    debut: f => (f.rancune ? { adv: f.rancune.adv, p: f.rancune.p, matchs: f.rancune.matchs } : null),
    episodes: [
      { de: 'ca', cible: 'contre', texte: x => `${x.p.n} sort sur une civière contre ${x.adv.name} : ${pl(x.matchs, 'match')} à l'écart. Le vestiaire n'oubliera pas.`, effet: { robustesse: 1.5, discipline: 1.2 }, matchs: SAISON },
      { de: 'pt', cible: 'contre', texte: x => `Battus, ${x.adv.name}. Pour ${nom(x.p)}.`, effet: { finition: 1.03 }, matchs: SAISON },
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
  return {
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
    const joueur = E.cible === 'joueur' ? E.qui(x) : null, contre = E.cible === 'contre' ? x.adv : null;
    const e = { cle, ep, jour, titre: A.titre, de: E.de, texte: E.texte(x), effet: E.effet, matchs: E.matchs, cible: E.cible, joueur, contre,
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
