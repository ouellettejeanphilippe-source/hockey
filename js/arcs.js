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
 * ET IL JOUE DANS LE MOTEUR. Chaque épisode pose un effet de quelques matchs sur les canaux qui existent
 * (`team.effets`, lus par `effetsDeSaison` et les jambes) : aucune mécanique neuve. Les deux épisodes d'un arc se
 * répondent (un bonus, puis son prix, ou l'inverse) : la somme est neutre sur une saison, comme les situations —
 * `check_arcs` le mesure en paires, la même ligue avec et sans arcs.
 *
 * TROIS OU QUATRE PAR SAISON, À TON CLUB, EN ROGUE (`ARCS_PAR_SAISON`, `ESPACE_ARCS`) ; chacun une fois. Le texte dit
 * le fait avec ses vrais chiffres, lus dans les mêmes feuilles (`check_arcs`) ; la une du bureau le montre.
 */

export const ARCS_PAR_SAISON = 4;
/* Des journées entre deux débuts d'arc : un arc a le temps de vivre avant le suivant. */
const ESPACE_ARCS = 12;
/* Les journées qu'un arc attend sa suite ; après, il se termine sans elle (le blessé de toute la saison). */
const ATTENTE_SUITE = 45;

const pl = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/*
 * Les arcs, dans l'ordre où ils se lisent un même matin (le premier dont le fait arrive commence). `debut(f)` rend
 * le fait (ses chiffres) ou null ; `suite(f, a)` dit si le second épisode arrive ce matin. `de` : la voix
 * (EXPEDITEURS, js/vie-gm.js). `matchs` : la durée de l'effet, en matchs du club.
 */
export const ARCS = {
  emballe: {
    titre: 'La ville s\'emballe',
    debut: f => (f.victoires === 5 ? { n: 5 } : null),
    episodes: [
      { de: 'pt', texte: x => `${x.n} victoires de suite : la ville s'emballe, et le vestiaire avec.`, effet: { finition: 1.02, discipline: 1.12 }, matchs: 5 },
      { de: 'en', texte: () => 'La séquence s\'arrête. L\'entraîneur ramène tout le monde sur terre : on défend d\'abord, on tire moins.', effet: { defense: 0.97, volume: 0.95 }, matchs: 4 },
    ],
    suite: f => f.dernier && !f.dernier.win,
  },
  huisClos: {
    titre: 'La réunion à huis clos',
    debut: f => (f.defaites === 4 ? { n: 4 } : null),
    episodes: [
      { de: 'ca', texte: x => `${x.n} défaites de suite. Les joueurs se parlent, portes fermées : plus une punition bête.`, effet: { discipline: 0.88, finition: 0.95 }, matchs: 4 },
      { de: 'en', texte: () => 'Enfin une victoire. Le vestiaire respire, et ça se voit devant le filet.', effet: { finition: 1.015 }, matchs: 3 },
    ],
    suite: f => f.dernier && f.dernier.win,
  },
  meneur: {
    titre: 'Sans son meneur',
    debut: f => (f.meneurBlesse ? { p: f.meneurBlesse.p, matchs: f.meneurBlesse.matchs } : null),
    episodes: [
      { de: 'ph', texte: x => `${x.p.n}, ton meilleur pointeur, rate ${pl(x.matchs, 'match')}. Le vestiaire serre les rangs.`, effet: { defense: 0.97, finition: 0.95 }, matchs: 6 },
      { de: 'ca', texte: x => `${x.p.n} est de retour. Le banc se lève quand il saute sur la glace.`, effet: { finition: 1.03 }, matchs: 3 },
    ],
    suite: (f, a) => f.enSante(a.x.p),
  },
  raclee: {
    titre: 'La raclée',
    debut: f => (f.dernier && !f.dernier.win && f.dernier.ga - f.dernier.gf >= 5 ? { gf: f.dernier.gf, ga: f.dernier.ga } : null),
    episodes: [
      { de: 'an', texte: x => `Une raclée, ${x.ga}-${x.gf}. Le vestiaire a quelque chose à prouver, et il le prouve un peu trop.`, effet: { volume: 1.03, discipline: 1.15 }, matchs: 3 },
      { de: 'pt', texte: () => 'La revanche est servie. On souffle, et la vigilance retombe un peu derrière.', effet: { defense: 1.04 }, matchs: 3 },
    ],
    suite: f => f.dernier && f.dernier.win,
  },
  recrue: {
    titre: 'La recrue fait jaser',
    debut: f => (f.recrue ? { p: f.recrue.p, buts: f.recrue.buts } : null),
    episodes: [
      { de: 'an', texte: x => `${x.p.n}, à son contrat d'entrée : ${pl(x.buts, 'but')} en cinq matchs. Toute la ligue en parle.`, effet: { finition: 1.015 }, matchs: 4 },
      { de: 'ph', texte: x => `Le mur des recrues : ${x.p.n} et les jeunes ont les jambes lourdes.`, effet: { energie: 1.2 }, matchs: 6 },
    ],
    suite: (f, a) => f.matchs - a.matchs >= 12,
  },
  calendrier: {
    titre: 'Le calendrier de fou',
    debut: f => (f.dosADos >= 3 ? { n: f.dosADos } : null),
    episodes: [
      { de: 'ph', texte: x => `${x.n} dos-à-dos en deux semaines : les jambes brûlent.`, effet: { energie: 1.15 }, matchs: 3 },
      { de: 'en', texte: x => `Enfin ${pl(x.repos, 'journée')} sans match : les jambes reviennent, la touche un peu moins.`, effet: { energie: 0.85, finition: 0.98 }, matchs: 3 },
    ],
    suite: f => f.repos >= 3,
  },
};

/*
 * LES FAITS DU MATIN, lus dans le journal du club (ses matchs joués), son infirmerie et son calendrier. `jour` :
 * la journée qui commence ; rien d'autre n'est lu.
 */
function faitsDuMatin(t, jour) {
  const j = t.journal || [];
  const deSuite = ok => { let n = 0; for (let i = j.length - 1; i >= 0 && ok(j[i]); i--) n++; return n; };
  const joues = (t._jours || []).filter(x => x < jour);
  const dernierJour = joues.length ? joues[joues.length - 1] : null;
  // Ton meilleur pointeur à ce jour, blessé pour au moins dix matchs (la blessure d'hier soir).
  const habilles = Object.values(t.roster || {}).filter(p => p && p.p !== 'G');
  const meneur = habilles.slice().sort((a, b) => (b.simPTS || 0) - (a.simPTS || 0))[0];
  const blessure = meneur && (t.injuriesLog || []).find(b => b.player === meneur && b.at === t.games && b.games >= 10);
  // Une recrue (contrat d'entrée) qui a marqué trois buts ou plus dans les cinq derniers matchs.
  const cinq = j.slice(-5);
  const butsDe = p => cinq.reduce((a, e) => {
    const f = e.feuille;
    if (!f || !f.alignes) return a;
    const cote = (f.alignes.A || []).includes(p) ? 'A' : (f.alignes.B || []).includes(p) ? 'B' : null;
    return a + (cote ? f.buts.filter(b => b.cote === cote && b.marqueur === p).length : 0);
  }, 0);
  const recrues = habilles.filter(p => p.elc).map(p => ({ p, buts: butsDe(p) })).filter(x => x.buts >= 3).sort((a, b) => b.buts - a.buts);
  // Les dos-à-dos des quatorze dernières journées, et les journées sans match depuis le dernier.
  const recents = joues.filter(x => x >= jour - 14);
  return {
    matchs: j.length, dernier: j.length ? j[j.length - 1] : null, dernierJour,
    victoires: deSuite(e => e.win), defaites: deSuite(e => !e.win),
    meneurBlesse: blessure ? { p: meneur, matchs: blessure.games } : null,
    recrue: recrues[0] || null,
    dosADos: recents.filter(x => recents.includes(x - 1)).length,
    repos: dernierJour == null ? 0 : jour - 1 - dernierJour,
    enSante: p => !(t.injured && t.injured.has(p)),
  };
}

/*
 * LES ÉPISODES DE CE MATIN, purs : de l'état du club, sans hasard. `t.arcs` garde l'histoire (le journal que l'écran
 * lit) ; un arc en cours attend sa suite, un nouveau attend que l'espace soit passé et qu'il en reste à vivre.
 * Rend [{ cle, ep, titre, de, texte, effet, matchs }].
 */
export function episodesDuMatin(t, jour) {
  t.arcs = t.arcs || [];
  // Une fois par match joué : un matin sans match d'hier ne change aucun fait.
  if (t._arcsVus === t.games) return [];
  t._arcsVus = t.games;
  const f = faitsDuMatin(t, jour);
  const out = [];
  const ecrire = (cle, ep, x) => {
    const A = ARCS[cle], E = A.episodes[ep];
    const e = { cle, ep, jour, titre: A.titre, de: E.de, texte: E.texte(x), effet: E.effet, matchs: E.matchs, x, matchsAuDebut: f.matchs };
    t.arcs.push(e);
    out.push(e);
  };
  // La suite d'un arc en cours (commencé, sans second épisode) ; passé ATTENTE_SUITE journées, il se termine sans elle.
  const enCours = t.arcs.filter(a => a.ep === 0 && !t.arcs.some(b => b.cle === a.cle && b.ep === 1) && jour - a.jour <= ATTENTE_SUITE);
  for (const a of enCours) {
    const A = ARCS[a.cle];
    if (jour > a.jour && A.suite(f, { x: a.x, matchs: a.matchsAuDebut })) ecrire(a.cle, 1, { ...a.x, repos: f.repos });
  }
  // Un arc neuf : au plus ARCS_PAR_SAISON, espacés d'ESPACE_ARCS journées, chacun une fois, aucun pendant un autre.
  const debuts = t.arcs.filter(a => a.ep === 0);
  const libre = debuts.length < ARCS_PAR_SAISON && !enCours.length && (!debuts.length || jour - debuts[debuts.length - 1].jour >= ESPACE_ARCS);
  if (libre && !out.length) {
    for (const [cle, A] of Object.entries(ARCS)) {
      if (debuts.some(a => a.cle === cle)) continue;
      const x = A.debut(f);
      if (x) { ecrire(cle, 0, x); break; }
    }
  }
  return out;
}
