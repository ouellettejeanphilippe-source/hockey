/*
 * LA SAISON EN ACTES (V27, tranche 2 ; docs/refonte-v27.md § 4.1 à 4.3, docs/refonte-v27-2.md). JP, 7 nov. 2026 :
 * *première Cup à rendre pas mal plus tough* ; *il faut vraiment bloquer le snowball* ; *Passer à 2 ❤️*. Une run est
 * UNE saison de 82 matchs et ses séries, coupée en quatre actes : tes matchs 1 à 27, 28 à 54, 55 à 82, puis les séries.
 *   - LES RIVAUX : le dernier match de chaque acte, contre le 8e, le 4e puis le plus fort club en force (attaque +
 *     défense + gardien au premier soir), posé là à la création de la ligue par un échange de cédule qui garde à chaque
 *     club ses 82 matchs, un par jour (`poserLesRivaux`, le crochet `placer` de `creerLigue`). Le jeu et le robot de
 *     la profondeur (scripts/lib/rogue_actes.mjs) appellent la même fonction : ils jouent la même cédule.
 *   - LES CŒURS ET LES CONTRÔLES : 2 ❤️ ; à la fin des actes I et II, le rang du soir du rival (les bris d'égalité de
 *     l'écran Classement, `rangAuSoir`) doit tenir le 20e puis le 15e (R1, 8 nov. 2026 : au 12e, l'attentif mourait à l'acte II 13 fois sur 64), ramenés à la taille de la ligue, sinon −1 ❤️.
 *     L'acte III demande une place en séries. Tout se lit dans la cédule jouée (`etatDeLaRun`) : rien à sauvegarder,
 *     une reprise relit le même état.
 *   - LES ÉLITES (tranche 7, docs/refonte-v27-7.md) : aux actes II et III, une au plus par acte, le lundi (`eliteDeLaSemaine`).
 * Pur : la cédule, les clubs, la graine. Le moteur n'importe pas ce module (check_couches).
 */
import { teamStrength, getHiddenRatings, activeLineup } from './sim.js';
import { hache } from './util.js';
import { exigencesDe, habillerLaLigue } from './rogue.js';
import { hausseDesPacks } from './packs.js';
import { piecesOffertes } from './pieces.js';
import { pronostic } from './pronostic.js';
import { SEMAINE } from './inventaire.js';

export const ACTES = [27, 54, 82];
export const RANGS_DES_RIVAUX = [7, 3, 0];
export const CONTROLES = [20, 15];
export const COEURS = 2;
/* R1 (8 nov. 2026) : à 3, la bande du départ remontée laissait « premier » et le naïf gagner 3 Coupes sur 64. */
export const ETAPE_SERIES = 4;
/* Les médailles d'un acte (devis § 4.8) : l'acte passé, le rival battu. */
export const MEDAILLES_ACTE = { passe: 10, rival: 15 };
/* Pourquoi un soir est un duel (V27) : le rival de l'acte, ou l'élite que tu as prise (tranche 7). */
export const RAISONS_DU_DUEL = {
  rival: { ico: '⚔', nom: 'Le rival' },
  elite: { ico: '◆', nom: 'L\'élite' },
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
const rangsDesRivaux = (exigence = 0) => (exigencesDe(exigence).rivaux ? [5, 1, 0] : RANGS_DES_RIVAUX);
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
  // LE JEU DE CHAQUE CLUB, lu au premier soir dans ses vraies stats (tranches 6 et 7) : le rival le montre dès son annonce, avec
  // l'intention qu'il annoncera le plus ; une pièce « pour le battre » lit les lignes où l'adversaire du soir est fort (`sonJeu`).
  L.jeux = jeuxDeLaLigue(L.teams, you);
  L.parForce = parForce;
  for (const [T, J] of L.jeux) T.sonJeu = lignesFortes(J, n);
  for (const R of L.rivaux) { R.jeu = L.jeux.get(R.adv); R.dominante = dominanteDe(R.jeu, L.graine, R.acte, R.adv); }
  for (const R of L.rivaux) L.grosAnnonces[R.jour] = { jour: R.jour, adv: R.adv, raison: 'rival', acte: R.acte, dominante: R.dominante };
  // Le moment « Contre un rival » (js/sim.js `MOMENTS_SI`) lit tes rivaux sur ton club.
  you.rivaux = L.rivaux.map(R => R.adv);
  // La cédule d'origine, d'où le renfort se compte (tranche 4) : ton adversaire, match par match.
  L.origine = advsDe(L, you);
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
 * L'ÉTAT DE LA RUN au soir où `jour` journées sont jouées, dans l'ordre du calendrier : les actes finis (le rival, battu ou
 * non ; le rang, la cible, le contrôle tenu) et les élites jouées (gagnées, ou un cœur de moins), les cœurs qui restent, la
 * run morte (0 ❤️) et ce qui l'a tuée (`fin`), l'acte en cours et son rival. `rivaux` : `L.rivaux` ; `annonces` : `L.grosAnnonces`.
 */
export function etatDeLaRun({ calendrier, teams, you, rivaux = [], annonces = {}, jour, exigence = 0 }) {
  const n = teams.length, joues = joursDe(calendrier, you).filter(j => j < jour).length;
  const gagneLe = j => { const m = calendrier[j].find(x => x.A === you || x.B === you); return !!m && (m.A === you) === (m.gfA > m.gfB); };
  const coups = [...rivaux, ...elitesDe(annonces)].filter(x => x.jour < jour).sort((a, b) => a.jour - b.jour);
  const actes = [], elites = [];
  let coeurs = COEURS, fin = null;
  for (const x of coups) {
    const gagne = gagneLe(x.jour), elite = x.raison === 'elite';
    const rang = elite ? null : rangAuSoir(calendrier, teams, you, x.jour);
    const cible = !elite && x.acte < 2 ? controleDeLActe(x.acte, n, exigence) : null;
    const tenu = elite ? null : cible == null ? null : rang <= cible;
    const coup = { acte: x.acte, jour: x.jour, adv: x.adv, gagne, ...(elite ? { elite, J: x.J } : { rang, cible, tenu }) };
    if ((elite ? !gagne : tenu === false) && !fin && --coeurs <= 0) fin = coup;
    (elite ? elites : actes).push(Object.assign(coup, { coeurs: Math.max(0, coeurs), mort: !!fin }));
  }
  const acte = Math.min(acteDe(joues), 2);
  return { actes, elites, coeurs: Math.max(0, coeurs), mort: !!fin, fin, acte, joues, rival: rivaux.find(R => R.acte === acte) || null,
    cible: acte < 2 ? controleDeLActe(acte, n, exigence) : null, rang: joues ? rangAuSoir(calendrier, teams, you, jour - 1) : null };
}

/*
 * LES ÉLITES (V27, tranche 7 ; devis § 4.5, docs/refonte-v27-7.md ; JP, 8 nov. 2026 : « Élite = risque plus clair »). Au
 * plus une par acte, aux actes II et III : le lundi, si ta semaine a un match contre un club du top 8 en force (au premier
 * soir, `L.parForce`), une ligne de la boîte propose d'en faire une élite — jamais la semaine du rival, jamais en séries ;
 * sans réponse, c'est un soir ordinaire. L'écran montre ta vraie chance, le pronostic du jour (`pronostic`), qui fixe sa
 * récompense : `J = arrondi(V_COEUR × (1 − p) / p) − PRIX_PIECE`, borné à [10, 90], `p` borné à [0,25, 0,55]. Prise (une
 * décision `elite`, jouée par le crochet du Rogue), elle est un duel ; gagnée, une pièce parmi trois et `J` 🪙 ; perdue,
 * −1 ❤️ et les sonnés. Le jeu et les robots lisent ces mêmes fonctions.
 */
export const TOP_DES_ELITES = 8, ELITES_PAR_ACTE = 1, V_COEUR = 60;
export const recompenseDeLElite = chance => { const p = Math.min(0.55, Math.max(0.25, chance)); return Math.min(90, Math.max(10, Math.round((V_COEUR * (1 - p)) / p) - PRIX_PIECE)); };
/* Les élites prises (leurs annonces de duel). */
export const elitesDe = annonces => Object.values(annonces || {}).filter(g => g.raison === 'elite');
/* L'élite que le lundi `jour` propose : { jour, k, acte, adv, rang, chance, J }, ou null. */
export function eliteDeLaSemaine(L, jour = L.jour) {
  const you = toiDe(L);
  if (!you || !L.parForce || jour % SEMAINE || (L.rivaux || []).some(R => Math.floor(R.jour / SEMAINE) === jour / SEMAINE)) return null;
  const jours = joursDe(L.calendrier, you), top = L.parForce.slice(0, parmiLesAdversaires(TOP_DES_ELITES, L.teams.length));
  const advAu = j => advDe(L.calendrier[j].find(m => m.A === you || m.B === you), you);
  const k = jours.findIndex(j => j > jour && j < jour + SEMAINE && top.includes(advAu(j)));
  const acte = k < 0 ? 0 : acteDe(k);
  if (acte < 1 || acte > 2 || elitesDe(L.grosAnnonces).filter(e => e.acte === acte).length >= ELITES_PAR_ACTE) return null;
  const j = jours[k], m = L.calendrier[j].find(x => x.A === you || x.B === you), adv = advDe(m, you);
  // Le pronostic (300 matchs du moteur) ne se calcule qu'une fois lu : l'écran le montre, le robot attentif le lit en dernier.
  let chance = null;
  const lire = () => { if (chance == null) { const pr = pronostic({ A: m.A, B: m.B, calendrier: L.calendrier, jourMatch: j, jourRevele: jour, graine: `${L.graine}:elite` }); chance = (m.A === you ? pr.vA : pr.vB) / pr.n; } return chance; };
  return { jour: j, k, acte, adv, rang: L.parForce.indexOf(adv), get chance() { return lire(); }, get J() { return recompenseDeLElite(lire()); } };
}
/* La prendre : la décision du lundi ; la refuser porte le même palier, sans `elite`. */
export const decisionDElite = e => ({ palier: `el:${e.jour}`, elite: { jour: e.jour, J: e.J } });
/* L'annonce de son duel, posée par le crochet du Rogue (`crochetDesActes`) : son jeu et son intention dominante, comme un rival. */
function poserLElite(L, { jour, J }) {
  const you = toiDe(L), m = L.calendrier[jour].find(x => x.A === you || x.B === you);
  if (!m) return;
  const adv = advDe(m, you), acte = acteDe(joursDe(L.calendrier, you).indexOf(jour)), jeu = L.jeux && L.jeux.get(adv);
  L.grosAnnonces[jour] = { jour, adv, raison: 'elite', acte, J, ...(jeu ? { dominante: dominanteDe(jeu, L.graine, acte, adv) } : {}) };
}
/* Les jetons des élites gagnées avant la journée `j` (la caisse du jeu et celle des robots). */
export const jetonsDesElites = (calendrier, you, annonces, j) => elitesDe(annonces).filter(e => e.jour < j)
  .reduce((a, e) => { const m = calendrier[e.jour].find(x => x.A === you || x.B === you); return a + (m && (m.A === you) === (m.gfA > m.gfB) ? e.J || 0 : 0); }, 0);
/*
 * LE JEU DU RIVAL (devis § 4.3 ; V27, tranche 6 : lu dans ses vraies stats, plus dans sa force). Trois lignes, chacune le
 * rang du club dans la ligue (de 1) et le tien à côté, sur les joueurs qu'il habille ce soir-là, dans leur vraie saison :
 *   TIRS     ses tirs par match (la somme des tirs par match de ses patineurs) ;
 *   DURS     ses mises en échec et ses punitions par match (les mises en échec ne se comptent que depuis 2005-06 : une ligue
 *            sans elles se lit sur les punitions seules) ;
 *   GARDIEN  le % d'arrêts de son gardien partant.
 * Son style, en un mot, est sa ligne au meilleur rang : des tireurs, des durs, un gros gardien. `lui`, `toi` : la part de la
 * barre (0,05 à 1, du dernier club au premier).
 */
const parMatch = (p, v) => (p && p.gp ? (v || 0) / p.gp : 0);
const patineurs = t => Object.values(activeLineup(t)).filter(p => p && p.p !== 'G');
const LIGNES_DU_JEU = [
  { k: 'tirs', mot: 'des tireurs', nom: 'Tirs', lire: t => patineurs(t).reduce((a, p) => a + parMatch(p, p.sh), 0) },
  { k: 'durs', mot: 'des durs', nom: 'Durs', lire: (t, coups) => patineurs(t).reduce((a, p) => a + (coups ? p.ht || 0 : 0) + parMatch(p, p.pim) / (coups ? 2 : 1), 0) },
  { k: 'gardien', mot: 'un gros gardien', nom: 'Gardien', lire: t => { const g = Object.values(activeLineup(t)).filter(p => p && p.p === 'G').sort((a, b) => (b.gp || 0) - (a.gp || 0))[0]; return g ? g.sv || 0 : 0; } },
];
/* Le jeu de chaque club de la ligue, lu une fois (club → jeu) ; `jeuDuRival`, celui d'un seul, ce soir-là. */
function jeuxDeLaLigue(teams, you) {
  const coups = teams.every(t => patineurs(t).some(p => p.ht != null));
  const lues = LIGNES_DU_JEU.map(({ k, mot, nom, lire }) => {
    const v = new Map(teams.map(t => [t, lire(t, coups)]));
    const tri = teams.slice().sort((a, b) => v.get(b) - v.get(a));
    const max = v.get(tri[0]), min = v.get(tri[tri.length - 1]), part = t => Math.max(0.05, Math.min(1, (v.get(t) - min) / ((max - min) || 1)));
    return { k, mot, nom, tri, part };
  });
  return new Map(teams.map(adv => {
    const lignes = lues.map(({ k, mot, nom, tri, part }) => ({ k, mot, nom, rang: tri.indexOf(adv) + 1, rangToi: tri.indexOf(you) + 1, lui: part(adv), toi: part(you) }));
    const fort = lignes.slice().sort((a, b) => a.rang - b.rang)[0];
    return [adv, { cle: fort.k, mot: fort.mot, lignes }];
  }));
}
export const jeuDuRival = (teams, you, adv) => jeuxDeLaLigue(teams, you).get(adv);
/* LES LIGNES OÙ UN CLUB EST FORT (tranche 7) : au 12e rang de la ligue ou mieux (ramené à sa taille) ; ce que lit une pièce « pour le battre ». */
const TOP_DU_JEU = 12;
export const lignesFortes = (jeu, n) => jeu.lignes.filter(l => l.rang <= aLaTaille(TOP_DU_JEU, n)).map(l => l.k);
/*
 * SON INTENTION DOMINANTE (devis § 4.3) : celle des cinq qu'il annoncera le plus souvent (`POIDS_DOMINANTE`, js/greffes.js),
 * fixée à l'annonce de son style et de la graine — des tireurs foncent (l'assaut) ou collent ta vedette pour la contrer
 * (l'ombre) ; des durs chassent ou te poussent au cachot ; un gros gardien ferme le centre ou colle ta vedette.
 */
const DOMINANTES = { tirs: ['assaut', 'ombre'], durs: ['chasse', 'cachot'], gardien: ['centre', 'ombre'] };
const dominanteDe = (jeu, graine, acte, adv) => DOMINANTES[jeu.cle][hache(graine, 'dominante', acte, adv.tag) < 0.5 ? 0 : 1];

/*
 * LA BOUTIQUE À SES NŒUDS (V27, tranche 3 ; docs/refonte-v27.md § 4.8, docs/refonte-v27-3.md). Elle n'ouvre qu'à sept
 * moments de la saison : avant ton 1er match, puis après tes 14e, 27e, 41e, 54e, 68e et 82e matchs, et elle reste
 * ouverte jusqu'à ton match suivant (après le 82e, jusqu'aux séries, où elle est fermée). À chaque ouverture, le prix
 * des packs repart de zéro (`hausseDesPacks` compté sur les achats DE CE NŒUD), au plus `ACHATS_PAR_NOEUD` achats,
 * packs et pièce confondus ; la pièce de banc, une parmi trois, coûte `arrondi(PRIX_PIECE × hausseDesPacks(n))`. Les
 * jetons qui restent après le dernier nœud sont perdus. Le jeu (js/rogue-jeu.js) et le robot de la profondeur
 * (scripts/lib/rogue_actes.mjs) lisent ces mêmes fonctions : ils achètent aux mêmes nœuds, aux mêmes prix.
 */
export const NOEUDS_BOUTIQUE = [0, 14, 27, 41, 54, 68, 82];
export const ACHATS_PAR_NOEUD = 4;
export const PRIX_PIECE = 32;
/* Le nœud ouvert quand `joues` de tes matchs sont joués (ou null : la boutique est fermée). */
export const noeudOuvert = joues => (NOEUDS_BOUTIQUE.includes(joues) ? joues : null);
/* Le prochain nœud après `joues` matchs (ou null : la dernière boutique est passée). */
export const prochainNoeud = joues => NOEUDS_BOUTIQUE.find(k => k > joues) ?? null;
/* Un achat qui compte au nœud : un pack payé, ou la pièce. Ton club (un nom, des couleurs) et l'ouverture d'un pack scellé, non. */
export const estUnAchat = d => !!(d && d.achat && d.achat.prix > 0 && ['joueurs', 'cartes', 'piece'].includes(d.achat.sorte));
/* La pièce au `n`-ième achat du nœud (de 0) : 32 🪙 en premier, 45 après un pack. */
export const prixDeLaPiece = n => Math.round(PRIX_PIECE * hausseDesPacks(n));
/* LES TROIS PIÈCES D'UN NŒUD, tirées de la graine parmi celles qui ne sont pas sur ton banc (js/pieces.js `piecesOffertes`) : leurs clés. */
export const piecesDuNoeud = (perso, graine, k) => (perso ? piecesOffertes(perso, graine, `bq${k}`) : []);

/*
 * LE CALENDRIER PLACÉ ET LE RENFORT (V27, tranche 4 ; devis § 4.4, docs/refonte-v27-4.md). Au premier soir d'un acte, tu
 * échanges deux adversaires entre deux de tes cases à venir, dans l'acte ou vers un acte plus loin (`echangeables`) : le
 * match du rival ne bouge pas, chaque club garde 82 matchs, un par jour. Un club reculé porte son renfort (`renfortDe`),
 * compté depuis la cédule d'origine (`L.origine`). Le placement est une décision (`cedule`, les paires de cases) que le
 * moteur joue à son jour par le crochet `placer` (`crochetDesActes`) : une reprise replace et rhabille pareil.
 */
const MILIEUX = [NOEUDS_BOUTIQUE[1], NOEUDS_BOUTIQUE[3], NOEUDS_BOUTIQUE[5]];
/*
 * `avant`, `apres` : les rangs (de 0) de tes matchs contre un club. Un match reculé vaut une étape par acte de recul ; dans
 * son acte, une s'il passe le nœud du milieu ; avancé, rien. Le compte est le plus petit sur les façons d'apparier les deux
 * listes (un club te joue deux à quatre fois) : un match reculé de deux actes vaut 2, même s'il décale les autres.
 */
const recul = (k, q) => (q <= k ? 0 : acteDe(q) > acteDe(k) ? acteDe(q) - acteDe(k) : k < MILIEUX[acteDe(k)] && q >= MILIEUX[acteDe(k)] ? 1 : 0);
export function renfortDe(avant, apres) {
  const meilleur = (i, reste) => (i === avant.length ? 0 : Math.min(...reste.map((q, j) => recul(avant[i], q) + meilleur(i + 1, reste.filter((_, x) => x !== j)))));
  return meilleur(0, apres);
}
const toiDe = L => L.teams.find(t => t.isPlayer);
const advsDe = (L, you) => joursDe(L.calendrier, you).map(j => advDe(L.calendrier[j].find(m => m.A === you || m.B === you), you));
/* Les étapes de chaque club reculé (club → étapes), depuis la cédule d'origine. */
export function renfortsDe(L) {
  const you = L && toiDe(L), out = new Map();
  if (!you || !L.origine) return out;
  const rangs = advs => advs.reduce((M, T, k) => M.set(T, [...(M.get(T) || []), k]), new Map());
  const apres = rangs(advsDe(L, you));
  for (const [T, ks] of rangs(L.origine)) { const n = renfortDe(ks, apres.get(T) || []); if (n) out.set(T, n); }
  return out;
}
/* Les cases qui s'échangent avec ta case `k` (de 0), `joues` matchs joués : à venir, l'une des deux dans l'acte, jamais un rival. */
export function echangeables(L, k, joues) {
  const you = toiDe(L), jours = joursDe(L.calendrier, you), advs = advsDe(L, you), acte = acteDe(joues);
  const rivaux = new Set((L.rivaux || []).map(R => R.jour));
  const libre = q => q >= joues && q < jours.length && acteDe(q) >= acte && !rivaux.has(jours[q]);
  if (!libre(k)) return [];
  return jours.map((_, q) => q).filter(q => q !== k && libre(q) && (acteDe(k) === acte || acteDe(q) === acte) && advs[q] !== advs[k] && peut(L, jours[k], jours[q], advs[k], advs[q]));
}
/* Échanger tes cases `k` et `q`, si elles s'échangent ; faux sinon. */
export function echangerTesCases(L, k, q, joues) {
  if (!echangeables(L, k, joues).includes(q)) return false;
  const you = toiDe(L), jours = joursDe(L.calendrier, you), advs = advsDe(L, you);
  echanger(L, jours[k], jours[q], advs[k], advs[q]);
  return true;
}
/* Le brouillon d'un placement (l'écran, le robot) : la même ligue, sa cédule copiée. */
export const brouillon = L => ({ ...L, calendrier: L.calendrier.map(jr => jr.map(m => ({ A: m.A, B: m.B }))) });
/*
 * LE CROCHET DU ROGUE (`placer` de `creerLigue`) : à la création, les rivaux ; à une décision `elite`, l'annonce de son duel ;
 * à une décision `cedule`, ses échanges, puis chaque adversaire habillé à `etape` plus son renfort (`habillerLaLigue`), pour
 * la saison qui reste, contre toi et les autres.
 */
export const crochetDesActes = ({ exigence = 0, niveau = 0, etape = 0 } = {}) => (L, d) => {
  if (!d) { poserLesRivaux(L, { exigence }); return; }
  if (d.elite) { poserLElite(L, d.elite); return; }
  const joues = joursDe(L.calendrier, toiDe(L)).filter(j => j < L.jour).length;
  for (const [k, q] of d.cedule) echangerTesCases(L, k, q, joues);
  const R = renfortsDe(L);
  for (const T of L.teams) if (!T.isPlayer) habillerLaLigue([T], niveau, p => getHiddenRatings(p).v, etape + (R.get(T) || 0));
};
