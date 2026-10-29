/*
 * TA SEMAINE : LE VERDICT D'UN CHOIX (V19, tranche 6, la décision unifiée ; JP : *une seule lecture des choix*). Chaque choix
 * à effet daté que tu as fait (un dilemme, une séquence, la réponse d'un courriel ou d'un point de presse, un dossier, un fil
 * suivi, une route de la semaine) dit son verdict le lundi d'après, en une ligne : ce que ton club a fait depuis, en vraies
 * stats de match — les tirs, la précision, les tirs contre, le % d'arrêts (`statsDe`, `motsDeStats`, js/impact.js) —, contre
 * ses dix matchs d'avant le choix.
 *
 * RIEN N'EST INVENTÉ : chaque chiffre est recompté dans les feuilles déjà jouées (`chiffresDuMatch`), jamais lu d'avance ni
 * tiré d'un effet attendu. Ce que la ligne dit est ce que ton club a fait, pas ce que le choix a causé : sur quelques matchs
 * le bruit est grand, alors un écart sous le plancher (`PLANCHER`) ne se dit pas, et la ligne avoue « rien de net ». Un choix
 * qui ne touche pas le match (« Rien ne change », un gain de jetons) ne dit rien. Un verdict sort UNE fois : le premier lundi
 * où le choix compte assez de matchs derrière lui (`MATCHS_MIN`).
 *
 * Pur : aucun DOM, aucun `hasard()` ; partagé navigateur + Node (`scripts/check_verdicts.mjs`).
 */
import { familleDeMoment, effetDeMoment, pariDeDecision, getPlayerKey } from './sim.js';
import { statsEntre, motsDeStats } from './impact.js';
import { chiffresDuMatch } from './profil-style.js';
import { ROUTES, CARTES_DE_ROUTE } from './noeuds.js';

/** Les matchs qu'un choix doit compter derrière lui pour dire son verdict ; les matchs d'avant qu'il lui faut, et au plus. */
export const MATCHS_MIN = 3, AVANT_MIN = 5;
const AVANT_MAX = 10;
/** La durée d'un effet sans durée écrite, et le plus de matchs qu'un verdict lit. */
const DUREE_PAR_DEFAUT = 8;
/** Un écart sous ce plancher est du bruit de quelques matchs : on ne le baptise pas (tirs, précision, tirs contre, arrêts). */
export const PLANCHER = { tirs: 1, pctTir: 0.01, contre: 1, pctArr: 0.01 };
const FAMILLES = ['moment', 'sequence', 'dossier', 'vie', 'fil'];

/* Un choix qui ne bouge rien au match (rien à faire, des jetons seuls) n'a pas de verdict de match. */
const bougeLeMatch = (d, o, team) => !o.rien && !!(effetDeMoment(d, team) || o.lui || o.mutation || o.action || o.pari || o.ensuite || o.monte || o.mentor || o.suivi);
/* « … pour {nom} » : le joueur nommé par la décision, tel que ton club le porte, ou « lui » s'il est parti. */
function sansAccolades(txt, d, you) {
  const m = d.moment || {};
  const par = cle => Object.values(you.roster || {}).find(p => p && getPlayerKey(p) === cle);
  const un = par(m.joueur);
  return String(txt || '').replace(/\{nom\}/g, un ? un.n : 'lui').replace(/\{noms\}/g, 'ses joueurs').replace(/\{aux\}/g, 'l\'auxiliaire');
}
/* La moyenne par match d'une suite de matchs, dans la forme de `statsDe`. */
function moyenne(matchs, you) {
  const L = matchs.map(x => chiffresDuMatch(x.m.feuille, x.m.A === you ? 'A' : 'B'));
  const m = k => L.reduce((a, l) => a + l[k], 0) / L.length;
  return { tirsPour: m('tirsPour'), butsPour: m('butsPour'), tirsContre: m('tirsContre'), butsContre: m('butsContre') };
}
/**
 * Le verdict de chaque choix de la semaine passée. `decisions` : les décisions de la partie ; `matchs` : tes matchs joués,
 * `{ j, m }` dans l'ordre (`m.feuille`) ; `jour` : le lundi qui parle ; `depuisJ` : le lundi d'avant ; `you` : ton club ;
 * `graine` : celle de la partie (le dé d'un pari). Rend `[{ palier, titre, nom, n, nAvant, de, mots }]` — `mots` : les puces
 * `{ cle, txt, bon }` (vide : rien de net) ; `de` : le dé d'un pari, « gagné » ou « perdu ».
 */
export function verdictsDeLaSemaine({ decisions, matchs, jour, depuisJ, you, graine }) {
  const out = [];
  const joues = matchs.filter(x => x.m && x.m.feuille);
  for (const d of decisions || []) {
    if (!Number.isFinite(d.jour) || d.jour >= jour) continue;
    let titre, nom, duree, aUnEffet;
    if (d.moment && FAMILLES.includes(d.moment.famille)) {
      const F = familleDeMoment(d.moment);
      const o = F && (F.options || []).find(x => x.cle === d.moment.choix);
      if (!o) continue;
      aUnEffet = bougeLeMatch(d, o, you);
      titre = F.titre || ''; nom = sansAccolades(o.nom, d, you); duree = o.duree || DUREE_PAR_DEFAUT;
    } else if (d.noeud && CARTES_DE_ROUTE[d.noeud.route] && CARTES_DE_ROUTE[d.noeud.route][d.noeud.id]) {
      const C = CARTES_DE_ROUTE[d.noeud.route][d.noeud.id];
      aUnEffet = !!C.effet; titre = ROUTES[d.noeud.route].nom; nom = C.nom; duree = C.duree || DUREE_PAR_DEFAUT;
    } else continue;
    if (!aUnEffet) continue;
    // Le premier lundi où il compte assez de matchs derrière lui — pas avant, et une seule fois.
    const depuisIci = joues.filter(x => x.j >= d.jour && x.j < jour), depuisAvant = joues.filter(x => x.j >= d.jour && x.j < depuisJ);
    if (depuisIci.length < Math.min(MATCHS_MIN, duree) || depuisAvant.length >= Math.min(MATCHS_MIN, duree)) continue;
    const apres = depuisIci.slice(0, duree), avant = joues.filter(x => x.j < d.jour).slice(-AVANT_MAX);
    if (avant.length < AVANT_MIN) continue;
    const ecart = statsEntre(moyenne(apres, you), moyenne(avant, you));
    const mots = motsDeStats(ecart, 3).filter(m => Math.abs(ecart[m.cle]) >= PLANCHER[m.cle]);
    const pari = d.moment ? pariDeDecision(d, graine, you) : null;
    out.push({ palier: d.palier, titre, nom, n: apres.length, nAvant: avant.length, de: pari ? (pari.gagne ? 'gagné' : 'perdu') : '', mots });
  }
  return out;
}
