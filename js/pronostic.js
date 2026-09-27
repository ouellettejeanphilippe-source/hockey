/**
 * LE PRONOSTIC (S78) : ce que le MOTEUR pense d'un match avant qu'on le
 * regarde. JP : *avant match, mettre forces comparatives … avec chances de
 * victoire et conditions de victoire et de défaite pour chaque équipe, basé
 * dans les vraies probabilités et équipes, pas inventés*.
 *
 * RIEN N'EST INVENTÉ ICI : on rejoue le match des centaines de fois avec le
 * vrai moteur (`playGame`), sur les deux vrais clubs, tels qu'ils sont au
 * matin de la journée — les blessés du jour, l'énergie et la chimie de
 * l'instantané que le moteur a pris ce matin-là (`jourLignes`) — et on
 * compte. Les chances de victoire, les buts attendus et les « conditions »
 * (« quand tu marques trois buts, tu gagnes 72 % de ces matchs ») sont des
 * fréquences de ces matchs-là, rien d'autre.
 *
 * CE QUI N'Y ENTRE PAS, exprès : la chance de saison de chaque club
 * (`luck`, un dé caché que le moteur tire en début de saison — la montrer
 * dirait le dé), et la mise en scène d'un gros match (le plan adverse, ta
 * main de cartes) : le pronostic est celui du match nu, à forces égales.
 *
 * RIEN NE BOUGE : le hasard est isolé (`avecHasardIsole` : la saison et les
 * séries, qui continuent sa suite, retrouvent le générateur exactement où
 * il était), les clubs sont des copies, et chaque joueur touché retrouve
 * à la fin ses champs d'avant (`photographier`/`rendre`). `check_graine`,
 * `check_feuilles`, `check_ballottage` le prouvent en restant identiques.
 *
 * Le module est pur et sans DOM : js/saison.js l'affiche.
 */

import { playGame, avecHasardIsole, SLOTS, getPlayerKey, feuilleVierge, OBJECTIFS, MATCHS_OBJECTIF } from './sim.js';

/* Les joueurs qu'un match peut toucher : les deux alignements, et le gardien de rappel. */
const joueursDe = t => [...SLOTS.map(s => t.roster[s.i]).filter(Boolean), ...(t.rappelG ? [t.rappelG] : [])];

/* Une photo des champs de chaque joueur, pour les lui rendre tels quels après. */
function photographier(joueurs) {
  const vus = new Set();
  const out = [];
  for (const p of joueurs) if (p && !vus.has(p)) { vus.add(p); out.push([p, { ...p }]); }
  return out;
}
function rendre(photos) {
  for (const [p, ph] of photos) {
    for (const k of Object.keys(p)) if (!(k in ph)) delete p[k];
    Object.assign(p, ph);
  }
}

/*
 * LES MATCHS JOUÉS PAR UN CLUB avant une journée, lus au calendrier : c'est
 * ce qui règle la rotation des gardiens (`pickGoalie` lit `games`) et ce qui
 * dit quels blessés sont encore à l'infirmerie.
 */
export function matchsAvant(calendrier, t, jour) {
  let n = 0;
  for (let j = 0; j < Math.min(jour, calendrier.length); j++) for (const m of calendrier[j]) if (m.A === t || m.B === t) n++;
  return n;
}

/*
 * UN CLUB AU MATIN D'UNE JOURNÉE, en copie. `joues` : ses matchs avant ce
 * soir ; `connus` : ceux dont on a vu le résultat (on ne sort de
 * l'infirmerie que les blessures déjà arrivées). L'énergie, la chimie et
 * l'apprentissage viennent de l'instantané du moteur (`jourLignes`).
 */
function copieDuJour(t, { jourMatch, jourRevele, joues, connus }) {
  const snap = (t.jourLignes || [])[Math.max(0, Math.min(jourRevele, (t.jourLignes || []).length - 1))] || null;
  const injured = new Map();
  for (const b of t.injuriesLog || []) {
    if (b.at > connus) continue;
    const reste = b.at + b.games - joues;
    if (reste > 0) injured.set(b.player, reste);
  }
  const app = snap && snap.apprentissage;
  const tardives = new Set((t.mutations || []).filter(m => m.jour >= jourRevele && m.p).map(m => m.p));
  const avant = { injured };
  // Ce que chaque joueur est ce matin-là : l'énergie de l'instantané, sa
  // maîtrise des systèmes (ta formation), sans la situation d'un soir, sans
  // un changement de carte qui n'est pas encore arrivé.
  const poser = p => {
    const cle = getPlayerKey(p);
    p.energie = snap && snap.energie && Number.isFinite(snap.energie[cle]) ? snap.energie[cle] : 100;
    if (app && app.maitrise) p._maitrise = { ...(app.maitrise[cle] || {}) };
    else if (p._maitrise) p._maitrise = { ...p._maitrise };
    if (p._adapt) p._adapt = { ...p._adapt };
    delete p._situ;
    if (tardives.has(p)) { delete p._mut; delete p._mutProfils; delete p._mutCles; }
  };
  const copie = {
    ...t,
    injured, injuriesLog: [], trous: [], trouEnCours: false, journal: null,
    luck: 0, _gros: null, _effetMatch: null, _entracte: null, _advGros: null, _dernierGros: null,
    games: joues, jourCourant: jourMatch,
    chimie: snap && snap.chimie ? snap.chimie.slice() : (t.chimie || [0, 0, 0, 0]).slice(),
    entente: app && app.entente ? new Map(Object.entries(app.entente)) : new Map(t.entente || []),
    W: 0, L: 0, OTL: 0, GF: 0, GA: 0, PTS: 0,
  };
  return { copie, poser, avant };
}

/* Remet une copie au matin avant chaque simulation : les blessures d'un essai ne passent pas au suivant. */
function remettre(c) {
  c.copie.injured = new Map(c.avant.injured);
  c.copie.injuriesLog = []; c.copie.trous = []; c.copie.trouEnCours = false;
}

/*
 * LE PRONOSTIC D'UN MATCH : `n` matchs rejoués par le moteur, A à domicile
 * (comme au calendrier). Rend les fréquences brutes ; l'écran en tire les
 * mots. `n` = 300 donne ±3 points sur les chances de victoire.
 */
export function pronostic({ A, B, calendrier, jourMatch, jourRevele, n = 300, graine = 'pronostic' }) {
  const ctx = t => ({ jourMatch, jourRevele, joues: matchsAvant(calendrier, t, jourMatch), connus: matchsAvant(calendrier, t, jourRevele) });
  const cA = copieDuJour(A, ctx(A)), cB = copieDuJour(B, ctx(B));
  const photos = photographier([...joueursDe(A), ...joueursDe(B)]);
  const scores = new Map();   // « gfA-gfB-p » -> fois
  let vA = 0, prol = 0, butsA = 0, butsB = 0;
  // Les gardiens de ce soir : la rotation du moteur est sans hasard (`pickGoalie`), la première feuille les dit.
  let gardiens = { A: null, B: null };
  try {
    for (const p of joueursDe(A)) cA.poser(p);
    for (const p of joueursDe(B)) cB.poser(p);
    avecHasardIsole(`${graine}|${A.tag}|${B.tag}|${jourMatch}`, () => {
      for (let i = 0; i < n; i++) {
        remettre(cA); remettre(cB);
        const f = i === 0 ? feuilleVierge() : null;
        const r = playGame(cA.copie, cB.copie, jourMatch, false, false, f);
        if (f) gardiens = { A: f.gardienA || null, B: f.gardienB || null };
        if (r.gfA > r.gfB) vA++;
        if (r.ot) prol++;
        butsA += r.gfA; butsB += r.gfB;
        const k = `${r.gfA}-${r.gfB}-${r.ot ? 1 : 0}`;
        scores.set(k, (scores.get(k) || 0) + 1);
      }
    });
  } finally { rendre(photos); }
  const liste = [...scores].map(([k, fois]) => { const [a, b, o] = k.split('-').map(Number); return { a, b, ot: !!o, fois }; });
  return { n, vA, vB: n - vA, prol, butsA: butsA / n, butsB: butsB / n, scores: liste, gardiens };
}

/*
 * LES CONDITIONS, lues dans les mêmes matchs. Pour un côté (`'A'` ou `'B'`) :
 * le seuil de buts qui fait gagner (le plus petit « k buts ou plus » après
 * lequel ce côté gagne au moins les deux tiers du temps), et celui qui fait
 * perdre (le plus petit nombre de buts ENCAISSÉS à partir duquel il perd au
 * moins les deux tiers du temps). Chacun avec sa fréquence : combien de fois
 * ça arrive, et ce que ça donne quand ça arrive.
 */
export function conditions(pr, cote) {
  const pour = s => (cote === 'A' ? s.a : s.b), contre = s => (cote === 'A' ? s.b : s.a);
  const gagne = s => pour(s) > contre(s);
  const seuil = (garde, bon) => {
    for (let k = 1; k <= 8; k++) {
      const ici = pr.scores.filter(s => garde(s, k));
      const fois = ici.reduce((a, s) => a + s.fois, 0);
      if (fois < pr.n * 0.08) break;
      const reussis = ici.filter(bon).reduce((a, s) => a + s.fois, 0);
      if (reussis / fois >= 2 / 3) return { k, arrive: fois / pr.n, alors: reussis / fois };
    }
    return null;
  };
  return {
    gagne: seuil((s, k) => pour(s) >= k, gagne),
    perd: seuil((s, k) => contre(s) >= k, s => !gagne(s)),
  };
}

/*
 * LES OBJECTIFS DU PROPRIO, à l'épreuve du moteur (S78). JP : *donner vague
 * idée de si c'est possible, genre si goaler à chier, blanchissage tough*.
 * On joue `chemins` fois tes vingt prochains matchs — les vrais adversaires
 * du calendrier, dans l'ordre, tes blessés s'accumulant d'un match à l'autre
 * comme dans une vraie séquence — et on compte combien de fois chaque
 * objectif tient. C'est la chance que le moteur lui donne, sans rien savoir
 * de la saison déjà jouée : ce sont d'autres dés, isolés.
 */
export function chancesDesObjectifs({ you, calendrier, jourRevele, cles, chemins = 40, graine = 'objectifs' }) {
  const suite = [];
  for (let j = jourRevele; j < calendrier.length && suite.length < MATCHS_OBJECTIF; j++) {
    const m = calendrier[j].find(x => x.A === you || x.B === you);
    if (m) suite.push({ j, A: m.A, B: m.B, adv: m.A === you ? m.B : m.A });
  }
  if (!suite.length) return {};
  for (const s of suite) s.jouesAdv = matchsAvant(calendrier, s.adv, s.j);
  const advs = [...new Set(suite.map(s => s.adv))];
  const joues0 = matchsAvant(calendrier, you, suite[0].j);
  const copieToi = copieDuJour(you, { jourMatch: suite[0].j, jourRevele, joues: joues0, connus: matchsAvant(calendrier, you, jourRevele) });
  const copiesAdv = new Map(advs.map(t => [t, copieDuJour(t, { jourMatch: suite[0].j, jourRevele, joues: matchsAvant(calendrier, t, jourRevele), connus: matchsAvant(calendrier, t, jourRevele) })]));
  const photos = photographier([...joueursDe(you), ...advs.flatMap(joueursDe)]);
  const tient = Object.fromEntries(cles.map(k => [k, 0]));
  try {
    for (const p of joueursDe(you)) copieToi.poser(p);
    for (const t of advs) for (const p of joueursDe(t)) copiesAdv.get(t).poser(p);
    avecHasardIsole(`${graine}|${you.tag}|${jourRevele}`, () => {
      for (let c = 0; c < chemins; c++) {
        // Tes blessés s'accumulent le long d'un chemin, comme dans une vraie séquence ; chaque chemin repart du matin.
        remettre(copieToi);
        copieToi.copie.games = joues0;
        const matchs = [];
        for (const s of suite) {
          const adv = copiesAdv.get(s.adv);
          remettre(adv);
          adv.copie.games = s.jouesAdv;
          const moiA = s.A === you;
          const f = feuilleVierge();
          const A = moiA ? copieToi.copie : adv.copie, B = moiA ? adv.copie : copieToi.copie;
          A.jourCourant = s.j; B.jourCourant = s.j;
          const r = playGame(A, B, s.j, false, false, f);
          const pour = moiA ? r.gfA : r.gfB, contre = moiA ? r.gfB : r.gfA;
          matchs.push({ v: pour > contre, pour, contre, buts: f.buts.filter(b => b.cote === (moiA ? 'A' : 'B')) });
          copieToi.copie.games++;
        }
        for (const k of cles) {
          const O = OBJECTIFS[k];
          if (!O) continue;
          const val = O.mesure(matchs);
          if (O.sens > 0 ? val >= O.cible : val <= O.cible) tient[k]++;
        }
      }
    });
  } finally { rendre(photos); }
  return Object.fromEntries(cles.map(k => [k, tient[k] / chemins]));
}

/* Une chance en mots : ce que le proprio entendrait de son adjoint. */
export function motDeChance(x) {
  if (x >= 0.7) return { cle: 'probable', mot: 'Probable' };
  if (x >= 0.45) return { cle: 'jouable', mot: 'Jouable' };
  if (x >= 0.2) return { cle: 'coriace', mot: 'Coriace' };
  return { cle: 'long', mot: 'Très dur' };
}
