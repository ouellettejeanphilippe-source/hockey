/*
 * LA SAISON EN ACTES (V27, tranche 2 ; docs/refonte-v27.md § 4.1 à 4.3, docs/refonte-v27-2.md). JP, 7 nov. 2026 :
 * *première Cup à rendre pas mal plus tough* ; *il faut vraiment bloquer le snowball* ; *Passer à 2 ❤️*. Une run est
 * UNE saison de 82 matchs et ses séries, coupée en quatre actes : tes matchs 1 à 27, 28 à 54, 55 à 82, puis les séries.
 *   - LES RIVAUX : le dernier match de chaque acte, contre le 8e, le 4e puis le plus fort club en force (attaque +
 *     défense + gardien au premier soir), posé là à la création de la ligue par un échange de cédule qui garde à chaque
 *     club ses 82 matchs, un par jour (`poserLesRivaux`, le crochet `placer` de `creerLigue`). Le jeu et le robot de
 *     la profondeur (scripts/lib/rogue_actes.mjs) appellent la même fonction : ils jouent la même cédule.
 *   - LES CŒURS ET LES CONTRÔLES : 2 ❤️ ; à la fin des actes I et II, le rang du soir du rival (les bris d'égalité de
 *     l'écran Classement, `rangAuSoir`) doit tenir le 20e puis le 12e, ramenés à la taille de la ligue, sinon −1 ❤️.
 *     L'acte III demande une place en séries. Tout se lit dans la cédule jouée (`etatDeLaRun`) : rien à sauvegarder,
 *     une reprise relit le même état.
 * Pur : la cédule, les clubs, la graine. Le moteur n'importe pas ce module (check_couches).
 */
import { teamStrength } from './sim.js';
import { exigencesDe } from './rogue.js';

export const ACTES = [27, 54, 82];
export const RANGS_DES_RIVAUX = [7, 3, 0];
export const CONTROLES = [20, 12];
export const COEURS = 2;
export const ETAPE_SERIES = 3;
/* Les médailles d'un acte (devis § 4.8) : l'acte passé, le rival battu. */
export const MEDAILLES_ACTE = { passe: 10, rival: 15 };
/* Pourquoi un soir est un duel (V27 ; « rival » remplace les rivaux du proprio, l'élite vient à la tranche 7). */
export const RAISONS_DU_DUEL = {
  rival: { ico: '⚔', nom: 'Le rival', mot: 'le rival de l\'acte' },
  elite: { ico: '◆', nom: 'L\'élite', mot: 'un gros club, un cœur en jeu' },
};
export const NOMS_DES_ACTES = ['Acte I', 'Acte II', 'Acte III', 'Les séries'];

/* La taille de la ligue : un rang de 32 clubs ramené à `n` ; un rang de force parmi 31 adversaires, à `n − 1`. */
export const aLaTaille = (C, n) => Math.round((C * n) / 32);
export const parmiLesAdversaires = (r, n) => Math.round((r * (n - 1)) / 31);
/* L'acte de ton `k`-ième match (de 0) ; 3 passé le 82e. */
export const acteDe = k => { const a = ACTES.findIndex(n => k < n); return a < 0 ? 3 : a; };
/* Le rang à tenir à la fin de l'acte `a` (0 ou 1), exigences comprises (« Le proprio impatient » le serre). */
export const controleDeLActe = (a, n = 32, exigence = 0) => aLaTaille(CONTROLES[a] + exigencesDe(exigence).controles, n);
/* Les rangs de force des rivaux (« Ceux qui partent » les monte) ; les étapes des séries (« La ceinture serrée »). */
export const rangsDesRivaux = (exigence = 0) => (exigencesDe(exigence).rivaux ? [5, 1, 0] : RANGS_DES_RIVAUX);
export const etapeDesSeries = (exigence = 0) => ETAPE_SERIES + exigencesDe(exigence).series;

const forceDe = t => { const f = teamStrength(t); return f.att + f.def + f.g; };
const advDe = (m, you) => (m.A === you ? m.B : m.A);
const joueLe = (L, T, j) => L.calendrier[j].some(m => m.A === T || m.B === T);
/* Les journées où tu joues, dans l'ordre : ton `k`-ième match est `jours[k]`. */
export const joursDe = (calendrier, you) => calendrier.reduce((a, jr, j) => (jr.some(m => m.A === you || m.B === you) ? [...a, j] : a), []);
/* X et Y échangent leur place dans les matchs du jour d seulement. */
function echangerLeJour(L, d, X, Y) {
  for (const m of L.calendrier[d]) {
    if (m.A === X) m.A = Y; else if (m.A === Y) m.A = X;
    if (m.B === X) m.B = Y; else if (m.B === Y) m.B = X;
  }
}
/* Échanger ton adversaire de deux journées, X (jour d) contre Y (jour e), dans TOUS leurs matchs de ces deux jours. */
const echanger = (L, d, e, X, Y) => { echangerLeJour(L, d, X, Y); echangerLeJour(L, e, X, Y); };
/* L'échange garde 82 matchs à chacun et un match par jour seulement si Y joue le jour d autant que X joue le jour e. */
const peut = (L, d, e, X, Y) => joueLe(L, Y, d) === joueLe(L, X, e);
/*
 * AMENER B dans ton match du jour d, à la place de X, quand aucun échange de deux journées ne le peut (B ne te joue
 * jamais un jour qui le permette). B joue ce jour-là : X prend son match. B ne joue pas : X perd un match et B en gagne
 * un, rendu par un autre jour où B joue un tiers et X rien. Ton calendrier ne change qu'au jour d ; faux si impossible.
 */
function amener(L, d, X, B, you) {
  if (joueLe(L, B, d)) { echangerLeJour(L, d, X, B); return true; }
  for (let f = 0; f < L.calendrier.length; f++) {
    if (f === d || joueLe(L, X, f)) continue;
    const m = L.calendrier[f].find(x => (x.A === B || x.B === B) && x.A !== you && x.B !== you);
    if (!m) continue;
    echangerLeJour(L, d, X, B);
    if (m.A === B) m.A = X; else m.B = X;
    return true;
  }
  return false;
}
/*
 * LES RIVAUX DES ACTES, posés dans la cédule (le crochet `placer` de `creerLigue`, avant le premier soir). Pour chaque
 * acte, le club au rang de force voulu (sinon un voisin d'un rang) vient au dernier match de l'acte : l'échange le plus
 * proche qui garde 82 matchs à chacun, sinon `amener`. Écrit `L.rivaux` ({ acte, jour, adv, voulu, rang }) et l'annonce
 * du duel au jour de chacun (`L.grosAnnonces`). Rend `L.rivaux`.
 */
export function poserLesRivaux(L, { exigence = 0 } = {}) {
  const you = L.teams.find(t => t.isPlayer);
  if (!you) return [];
  const n = L.teams.length, jours = joursDe(L.calendrier, you);
  const advAu = j => advDe(L.calendrier[j].find(m => m.A === you || m.B === you), you);
  const opps = L.teams.filter(t => t !== you);
  const force = new Map(opps.map(t => [t, forceDe(t)]));
  const parForce = opps.slice().sort((a, b) => force.get(b) - force.get(a));
  const rangs = rangsDesRivaux(exigence), fixe = new Set();
  L.rivaux = [];
  ACTES.forEach((k, a) => {
    const i = k - 1;
    if (jours[i] == null) return;
    const voulu = parmiLesAdversaires(rangs[a], n);
    for (const r of [voulu, voulu - 1, voulu + 1].filter(x => x >= 0 && x < parForce.length)) {
      const B = parForce[r], X = advAu(jours[i]);
      if (X === B) break;
      let best = -1;
      jours.forEach((j, q) => { if (!fixe.has(q) && q !== i && advAu(j) === B && peut(L, jours[i], j, X, B) && (best < 0 || Math.abs(q - i) < Math.abs(best - i))) best = q; });
      if (best >= 0) { echanger(L, jours[i], jours[best], X, B); break; }
      if (amener(L, jours[i], X, B, you)) break;
    }
    fixe.add(i);
    const adv = advAu(jours[i]);
    L.rivaux.push({ acte: a, jour: jours[i], adv, voulu, rang: parForce.indexOf(adv) });
  });
  for (const R of L.rivaux) L.grosAnnonces[R.jour] = { jour: R.jour, adv: R.adv, raison: 'rival', acte: R.acte };
  // Le moment « Contre un rival » (js/sim.js `MOMENTS_SI`) lit tes rivaux sur ton club.
  you.rivaux = L.rivaux.map(R => R.adv);
  return L.rivaux;
}
/*
 * LE RANG AU SOIR DU JOUR `d` (ce jour compris), tel que l'écran Classement le montre : les points, les victoires, le
 * différentiel, les buts pour, puis le club. Recompté de la cédule jouée : un contrôle relu après coup dit le même rang.
 */
export function rangAuSoir(calendrier, teams, you, d) {
  const f = new Map(teams.map(t => [t, { PTS: 0, W: 0, GF: 0, GA: 0 }]));
  for (let j = 0; j <= d && j < calendrier.length; j++) for (const m of calendrier[j]) {
    if (!m.joue && m.gfA == null) continue;
    const a = f.get(m.A), b = f.get(m.B);
    if (!a || !b) continue;
    const gA = m.gfA > m.gfB;
    a.GF += m.gfA; a.GA += m.gfB; b.GF += m.gfB; b.GA += m.gfA;
    const w = gA ? a : b, l = gA ? b : a;
    w.W++; w.PTS += 2; if (m.ot) l.PTS += 1;
  }
  const ordre = teams.slice().sort((x, y) => {
    const a = f.get(x), b = f.get(y);
    return b.PTS - a.PTS || b.W - a.W || (b.GF - b.GA) - (a.GF - a.GA) || b.GF - a.GF
      || String(`${x.tag}${x.season || ''}`).localeCompare(String(`${y.tag}${y.season || ''}`));
  });
  return ordre.indexOf(you) + 1;
}
/*
 * L'ÉTAT DE LA RUN au soir où `jour` journées sont jouées : les actes finis (le rival, battu ou non ; le rang, la cible,
 * le contrôle tenu), les cœurs qui restent, la run morte (0 ❤️), l'acte en cours et son rival. `rivaux` : `L.rivaux`.
 */
export function etatDeLaRun({ calendrier, teams, you, rivaux = [], jour, exigence = 0 }) {
  const n = teams.length, jours = joursDe(calendrier, you);
  const joues = jours.filter(j => j < jour).length;
  const actes = [];
  let coeurs = COEURS, mort = false;
  for (const R of rivaux) {
    if (R.jour >= jour) break;
    const m = calendrier[R.jour].find(x => x.A === you || x.B === you);
    const gagne = !!m && (m.A === you) === (m.gfA > m.gfB);
    const rang = rangAuSoir(calendrier, teams, you, R.jour);
    const cible = R.acte < 2 ? controleDeLActe(R.acte, n, exigence) : null;
    const tenu = cible == null ? null : rang <= cible;
    if (tenu === false && !mort && --coeurs <= 0) mort = true;
    actes.push({ acte: R.acte, jour: R.jour, adv: R.adv, gagne, rang, cible, tenu, coeurs, mort });
  }
  const acte = Math.min(acteDe(joues), 2);
  return { actes, coeurs: Math.max(0, coeurs), mort, acte, joues, rival: rivaux.find(R => R.acte === acte) || null,
    cible: acte < 2 ? controleDeLActe(acte, n, exigence) : null, rang: joues ? rangAuSoir(calendrier, teams, you, jour - 1) : null };
}
/*
 * LE JEU DU RIVAL, en un mot (devis § 4.3) : son meilleur côté parmi les adversaires — l'attaque fait des tireurs, la
 * défense des durs, le filet un gros gardien. `rangs` : son rang (de 1) sur chacun, et ta force à côté (`toi`).
 */
const STYLES_DU_RIVAL = [['att', 'des tireurs', 'Tirs'], ['def', 'des durs', 'Durs'], ['g', 'un gros gardien', 'Gardien']];
export function jeuDuRival(teams, you, adv) {
  const opps = teams.filter(t => t !== you), F = new Map(teams.map(t => [t, teamStrength(t)]));
  const lignes = STYLES_DU_RIVAL.map(([k, mot, nom]) => {
    const tri = opps.slice().sort((a, b) => F.get(b)[k] - F.get(a)[k]);
    const max = F.get(tri[0])[k], min = F.get(tri[tri.length - 1])[k], part = v => Math.max(0.05, Math.min(1, (v - min) / ((max - min) || 1)));
    return { k, mot, nom, rang: tri.indexOf(adv) + 1, lui: part(F.get(adv)[k]), toi: part(F.get(you)[k]) };
  });
  const fort = lignes.slice().sort((a, b) => a.rang - b.rang)[0];
  return { mot: fort.mot, lignes };
}
