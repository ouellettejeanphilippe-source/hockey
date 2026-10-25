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

import { playGame, avecHasardIsole, SLOTS, getPlayerKey, feuilleVierge, OBJECTIFS, MATCHS_OBJECTIF,
  poserAVenir, recupererEnergie, energieDe, ENERGIE_RECUP_JOUR } from './sim.js';

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
function matchsAvant(calendrier, t, jour) {
  let n = 0;
  for (let j = 0; j < Math.min(jour, calendrier.length); j++) for (const m of calendrier[j]) if (m.A === t || m.B === t) n++;
  return n;
}

/*
 * UN CLUB AU MATIN D'UNE JOURNÉE, en copie. `joues` : ses matchs avant ce
 * soir ; `connus` : ceux dont on a vu le résultat (on ne sort de
 * l'infirmerie que les blessures déjà arrivées). L'énergie et la chimie
 * viennent de l'instantané du moteur (`jourLignes`).
 */
function copieDuJour(t, { jourMatch, jourRevele, joues, connus }) {
  const snap = (t.jourLignes || [])[Math.max(0, Math.min(jourRevele, (t.jourLignes || []).length - 1))] || null;
  const injured = new Map();
  for (const b of t.injuriesLog || []) {
    if (b.at > connus) continue;
    const reste = b.at + b.games - joues;
    if (reste > 0) injured.set(b.player, reste);
  }
  const tardives = new Set((t.mutations || []).filter(m => m.jour >= jourRevele && m.p).map(m => m.p));
  const avant = { injured };
  // Ce que chaque joueur est ce matin-là : l'énergie de l'instantané, sans
  // la situation d'un soir, sans un changement de carte qui n'est pas encore arrivé.
  const poser = p => {
    const cle = getPlayerKey(p);
    p.energie = snap && snap.energie && Number.isFinite(snap.energie[cle]) ? snap.energie[cle] : 100;
    if (p._adapt) p._adapt = { ...p._adapt };
    delete p._situ;
    if (tardives.has(p)) { delete p._mut; delete p._amel; delete p._mutProfils; delete p._mutCles; }
  };
  const copie = {
    ...t,
    injured, injuriesLog: [], trous: [], trouEnCours: false, journal: null,
    luck: 0, _gros: null, _effetMatch: null, _entracte: null, _advGros: null, _dernierGros: null,
    games: joues, jourCourant: jourMatch,
    chimie: snap && snap.chimie ? snap.chimie.slice() : (t.chimie || [0, 0, 0, 0]).slice(),
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
        const r = playGame(cA.copie, cB.copie, jourMatch, false, false, f, 0, true);
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
 * LA PRÉVISION DU MOTEUR (1.0, oct.). JP : *je veux pas un ov qui décide
 * tout, mais un genre de prévision de ce que l'équipe doit faire donner, ou
 * un joueur, en fonction des positions et cie*. Pas une cote : tes matchs
 * RESTANTS rejoués `n` fois par le vrai moteur, ta formation telle qu'elle
 * est ce matin (tes cases, tes lignes, leurs jambes — remises au matin avant
 * chaque match, sans quoi soixante matchs d'affilée les videraient), contre
 * les vrais clubs de ton calendrier. On compte : tes points, tes buts pour et
 * contre, et les buts et passes de chacun de tes joueurs. Le hasard est
 * isolé et chaque joueur retrouve ses champs : rien de la saison ne bouge.
 */
export function prevision({ toi, calendrier, jourRevele, n = 8, graine = 'prevision' }) {
  const restants = [];
  for (let j = jourRevele; j < calendrier.length; j++) for (const m of calendrier[j]) if (m.A === toi || m.B === toi) restants.push({ j, m });
  if (!restants.length) return null;
  const tous = [toi, ...new Set(restants.map(r => (r.m.A === toi ? r.m.B : r.m.A)))];
  const photos = photographier(tous.flatMap(joueursDe));
  const copies = new Map();
  const pts = [], gf = [], ga = [];
  const parJoueur = new Map();   // joueur -> { b, a } sur les n saisons
  try {
    for (const t of tous) {
      const joues = matchsAvant(calendrier, t, jourRevele);
      copies.set(t, { ...copieDuJour(t, { jourMatch: jourRevele, jourRevele, joues, connus: joues }), joues, membres: joueursDe(t) });
    }
    avecHasardIsole(`${graine}|${toi.tag}|${jourRevele}`, () => {
      for (let i = 0; i < n; i++) {
        for (const c of copies.values()) c.copie.games = c.joues;
        let P = 0, F = 0, C = 0;
        for (const { j, m } of restants) {
          const cA = copies.get(m.A), cB = copies.get(m.B), moiA = m.A === toi;
          for (const c of [cA, cB]) { remettre(c); c.copie.jourCourant = j; for (const p of c.membres) c.poser(p); }
          const f = feuilleVierge();
          const r = playGame(cA.copie, cB.copie, j, false, false, f, 0, true);
          cA.copie.games++; cB.copie.games++;
          const pour = moiA ? r.gfA : r.gfB, contre = moiA ? r.gfB : r.gfA;
          F += pour; C += contre; P += pour > contre ? 2 : r.ot ? 1 : 0;
          const cote = moiA ? 'A' : 'B';
          for (const b of f.buts) {
            if (b.cote !== cote) continue;
            if (b.marqueur) { const e = parJoueur.get(b.marqueur) || { b: 0, a: 0 }; e.b++; parJoueur.set(b.marqueur, e); }
            for (const q of b.passeurs || []) { if (!q) continue; const e = parJoueur.get(q) || { b: 0, a: 0 }; e.a++; parJoueur.set(q, e); }
          }
        }
        pts.push(P); gf.push(F); ga.push(C);
      }
    });
  } finally { rendre(photos); }
  pts.sort((x, y) => x - y);
  const moy = a => a.reduce((x, y) => x + y, 0) / a.length;
  const joueurs = new Map([...parJoueur].map(([p, e]) => [p, { b: e.b / n, a: e.a / n }]));
  return { n, matchs: restants.length, pts: moy(pts), bas: pts[Math.floor(n * 0.1)], haut: pts[Math.ceil(n * 0.9) - 1], gfm: moy(gf) / restants.length, gam: moy(ga) / restants.length, joueurs };
}

/*
 * CE QUE REND UN MÉNAGEMENT (1.0, le suivi des jambes). JP : *tracking de l'énergie et optimisation de
 * l'énergie*. Comme la prévision : le vrai moteur rejoue tes matchs d'ici au prochain d'après (`horizon`,
 * son matin), ta formation au matin d'aujourd'hui, `n` fois — une fois telle quelle, puis une fois par
 * proposition. Une proposition est une DÉCISION EXISTANTE (un joueur en réserve par les cases, un plan de
 * match), posée au jour dit comme le moteur la posera ; les décisions déjà
 * prises pour ces journées (`aVenir`) le sont aussi. Chaque journée rend sa part du manque
 * (`recupererEnergie`, comme `preludeDuJour`), chaque soir use (`playGame`, coups compris). Le même
 * essai rejoue les mêmes dés avec ou sans la proposition : l'écart est la proposition, pas le hasard.
 * Rend, par essai, les jambes moyennes de chaque patineur au matin de `horizon` (clé → 0-100).
 */
export function jambesAVenir({ toi, calendrier, jourRevele, aVenir = [], propositions = [], n = 6, graine = 'jambes' }) {
  const mesJours = [];
  for (let j = jourRevele; j < calendrier.length && mesJours.length < 2; j++) if (calendrier[j].some(m => m.A === toi || m.B === toi)) mesJours.push(j);
  if (!mesJours.length) return null;
  const horizon = mesJours[1] ?? mesJours[0] + 1;
  const matchs = [];
  for (let j = jourRevele; j < horizon; j++) for (const m of calendrier[j] || []) if (m.A === toi || m.B === toi) matchs.push({ j, m });
  const tous = [toi, ...new Set(matchs.map(({ m }) => (m.A === toi ? m.B : m.A)))];
  const membres = new Map(tous.map(t => [t, joueursDe(t)]));
  const patineurs = membres.get(toi).filter(p => p.p !== 'G');
  const photos = photographier([...membres.values()].flat());
  const essai = (decs, i) => {
    rendre(photos);
    const copies = new Map(tous.map(t => {
      const joues = matchsAvant(calendrier, t, jourRevele);
      const c = copieDuJour(t, { jourMatch: jourRevele, jourRevele, joues, connus: joues });
      for (const p of membres.get(t)) c.poser(p);
      // Le match se joue avec ses comptes (`track`) : c'est là que les présences usent. Ce qu'il en écrit
      // au club se fait sur la copie ; ce qu'il écrit aux joueurs, `rendre` le reprend.
      c.copie.together = new Map(t.together || []); c.copie.togetherSig = new Map(t.togetherSig || []);
      return [t, c.copie];
    }));
    const moi = copies.get(toi);
    avecHasardIsole(`${graine}|${toi.tag}|${jourRevele}|${i}`, () => {
      for (let j = jourRevele; j <= horizon; j++) {
        for (const c of copies.values()) { c.jourCourant = j; if (j > jourRevele) recupererEnergie(c, ENERGIE_RECUP_JOUR); }
        if (j === horizon) break;
        poserAVenir(moi, decs.filter(d => d.jour === j), { cases: true });
        for (const { m } of matchs.filter(x => x.j === j)) {
          playGame(copies.get(m.A), copies.get(m.B), j, true, false, null, 0, true);
        }
      }
    });
    return new Map(patineurs.map(p => [getPlayerKey(p), energieDe(p)]));
  };
  const mesurer = decs => {
    const somme = new Map();
    for (let i = 0; i < n; i++) for (const [k, e] of essai(decs, i)) somme.set(k, (somme.get(k) || 0) + e / n);
    return somme;
  };
  try {
    const base = mesurer(aVenir);
    // Une proposition remplace la décision du même genre déjà prise ce jour-là (comme `deciderSaison`).
    const avec = d => [...aVenir.filter(x => !(x.jour === d.jour && d.cases && x.cases)), d];
    return { horizon, prochain: mesJours[0], base, propositions: propositions.map(d => mesurer(avec(d))) };
  } finally { rendre(photos); }
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
      // Une condition qui arrive presque toujours ne dit rien (un match à sens unique) : on cherche plus loin.
      if (fois > pr.n * 0.85) continue;
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
export function chancesDesObjectifs({ you, calendrier, jourRevele, cles, quoi = {}, chemins = 40, graine = 'objectifs' }) {
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
          const r = playGame(A, B, s.j, false, false, f, 0, true);
          const pour = moiA ? r.gfA : r.gfB, contre = moiA ? r.gfB : r.gfA;
          matchs.push({ v: pour > contre, pour, contre, buts: f.buts.filter(b => b.cote === (moiA ? 'A' : 'B')) });
          copieToi.copie.games++;
        }
        for (const k of cles) {
          const O = OBJECTIFS[k];
          if (!O || (O.joueur && !quoi[k])) continue;
          // Un objectif qui nomme un joueur (V11) : son joueur et sa cible, ceux de l'offre.
          const val = O.mesure(matchs, quoi[k]), cible = O.joueur ? quoi[k].cible : O.cible;
          if (O.sens > 0 ? val >= cible : val <= cible) tient[k]++;
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
