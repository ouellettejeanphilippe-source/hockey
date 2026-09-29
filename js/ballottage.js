/*
 * LE BALLOTTAGE, en fonction PURE (1.0, J1-D). Quand un joueur se blesse
 * pour de bon, trois vrais joueurs pas chers sont au ballottage : de la même
 * position, des MÊMES saisons que la ligue, mais de clubs qui n'y sont pas,
 * et personne qui y joue déjà. Le tirage se fait de la graine et du match :
 * la même blessure offre les mêmes trois noms à la reprise.
 *
 * UN DÉPANNEUR, PAS UNE VEDETTE. Avant 1.0, on offrait les quinze meilleurs
 * producteurs sous 3 % du plafond — par construction les saisons de contrat
 * d'entrée des vedettes (Mogilny 84 points à 1,13 M$, pour une blessure de
 * sept matchs). Un réclamé est maintenant au plus « Régulier » (`niveauMax`,
 * js/niveaux.js) : on offre les meilleurs réguliers, pas des figurants.
 *
 * Le contrôleur (js/game.js) ne fournit que ce que la partie permet — la
 * ligue, les shards chargés, le budget — et scripts/check_ballottage.mjs
 * mesure la même fonction en Node.
 */
import { getPlayerKey, getPersonKey } from './sim.js';
import { niveauDe, joueursParNiveau, groupeDuJoueur, mesureDuNiveau } from './niveaux.js';
import { estD as isD } from './util.js';

export const groupeDe = p => (p.p === 'G' ? 'G' : isD(p) ? 'D' : 'F');
/* La production d'un joueur dans sa saison : points par match, ou % d'arrêts. */
export const productionDe = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));

export const MEILLEURS_BALLOTTAGE = 15;
export const NIVEAU_MAX_BALLOTTAGE = 1;   // Régulier (js/niveaux.js) : jamais un Pilier, une Étoile ou un Phénomène

/*
 * Le seuil du niveau au-dessus de `niveauMax`, par groupe, dans une saison :
 * la mesure du plus faible joueur de ce niveau. Un joueur trop court pour
 * être rangé (moins de 40 matchs, niveau −1 — la recrue de 32 matchs à un
 * point par match) se juge sur cette même barre.
 */
const SEUILS = new WeakMap();
function seuilDe(players, niveauMax) {
  let s = SEUILS.get(players);
  if (!s) {
    s = {};
    const au = joueursParNiveau(players)[niveauMax + 1] || [];
    for (const g of ['F', 'D', 'G']) { const m = au.filter(x => groupeDuJoueur(x) === g).map(mesureDuNiveau); s[g] = m.length ? Math.min(...m) : Infinity; }
    SEUILS.set(players, s);
  }
  return s;
}
const tropFort = (p, players, niveauMax) => {
  const k = niveauDe(p, players);
  if (k > niveauMax) return true;
  return k < 0 && mesureDuNiveau(p) >= seuilDe(players, niveauMax)[groupeDuJoueur(p)];
};

/*
 * Les candidats au ballottage pour `blesse`, au match `at`.
 *   shards   Map saison → { players, byTeam } (les saisons de la ligue chargées)
 *   ligue    { cles: ['saison|TAG', …], teams: [{ roster }], graine }
 *   budget   le salaire maximal (l'espace sous le plafond, borné à 3 % du plafond par le contrôleur)
 *   niveauMax  le niveau le plus haut qu'un réclamé peut avoir (1 = Régulier)
 * Rend jusqu'à trois joueurs (des personnes différentes), les mêmes à chaque appel.
 */
export function candidatsBallottage({ shards, ligue, blesse, budget, at, graine = ligue && ligue.graine, niveauMax = NIVEAU_MAX_BALLOTTAGE, meilleurs = MEILLEURS_BALLOTTAGE }) {
  if (!ligue || !blesse || !Array.isArray(ligue.cles) || !shards) return [];
  const g = groupeDe(blesse);
  const dansLaLigue = new Set();
  for (const t of ligue.teams || []) for (const p of Object.values(t.roster || {})) if (p) dansLaLigue.add(getPersonKey(p));
  const clubs = new Set(ligue.cles);
  const pool = [];
  for (const s of new Set(ligue.cles.map(c => String(c).split('|')[0]))) {
    const e = shards.get(s);
    if (!e) continue;
    for (const [tag, joueurs] of Object.entries(e.byTeam || {})) {
      if (clubs.has(`${s}|${tag}`)) continue;
      for (const p of joueurs) {
        if ((p.gp || 0) < 20 || !(p.$ > 0) || p.$ > budget || groupeDe(p) !== g || dansLaLigue.has(getPersonKey(p))) continue;
        if (niveauMax != null && niveauMax < 4 && tropFort(p, e.players, niveauMax)) continue;
        pool.push(p);
      }
    }
  }
  const h = str => { let x = ((Number(graine) >>> 0) ^ Math.imul(at + 1, 2654435761)) >>> 0; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
  // Des offres qui valent la peine : les meilleurs producteurs qui passent le
  // filtre, puis trois d'entre eux tirés de la graine. Un tirage parmi TOUS
  // les pas chers offrait des joueurs à deux points en trente-sept matchs.
  pool.sort((a, b) => productionDe(b) - productionDe(a));
  pool.length = Math.min(pool.length, meilleurs);
  pool.sort((a, b) => h(getPlayerKey(a)) - h(getPlayerKey(b)));
  const out = [], vus = new Set();
  for (const p of pool) {
    if (vus.has(getPersonKey(p))) continue;
    vus.add(getPersonKey(p)); out.push(p);
    if (out.length === 3) break;
  }
  return out;
}
