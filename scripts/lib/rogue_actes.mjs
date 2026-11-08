/*
 * LA RUN EN ACTES, JOUÉE PAR UN ROBOT (V27, tranche 1 ; docs/refonte-v27.md § 4, § 5, § 9, § 10) — le juge neuf.
 *
 * JP, 7 nov. 2026 : *première Cup à rendre pas mal plus tough* ; *il faut vraiment bloquer le snowball*. La V27 fait
 * d'une run UNE saison de 82 matchs et ses séries, coupée en quatre actes : l'acte I (tes matchs 1 à 27), le II (28 à
 * 54), le III (55 à 82), les séries. Le prototype du 7 nov. (scratchpad `proto-actes`) devient ici le robot du dépôt :
 *   - LES RIVAUX (§ 4.3) : le dernier match de chaque acte, contre le 8e, le 4e puis le plus fort club en force
 *     (attaque + défense + gardien au premier soir, `RANGS_DES_RIVAUX`), posé là par un échange de cédule qui garde 82
 *     matchs à chacun et un match par jour (js/actes.js `poserLesRivaux`, sinon en amenant le club au jour du rival) ; en dernier recours, un club d'un rang voisin. Un duel ; gagné, une
 *     pièce ; perdu, les sonnés, aucun cœur, et jamais de jetons.
 *   - LES CŒURS ET LES CONTRÔLES (§ 4.2) : `COEURS` 2 ; à la fin des actes I et II, le classement du soir (celui de
 *     l'écran, `rangAuSoir`) doit tenir le 20e puis le 12e rang (proportionnels à la taille de la ligue), sinon −1 ❤️ ;
 *     l'acte III demande une place en séries, sinon la run finit. À 0 ❤️, la run est morte.
 *   - LES ÉLITES (§ 4.5) : au plus une par acte, le lundi, contre un club du top 8 en force de la semaine, jamais la
 *     semaine d'un rival ; un duel ; gagnée, une pièce et `J` jetons (le pronostic du jour, `pronostic`) ; perdue, −1 ❤️.
 *   - LE CALENDRIER PLACÉ (§ 4.4) : le robot « placé » met les plus faibles d'abord ; chaque match reculé renforce son
 *     club d'une étape d'édition par acte de recul, comptée depuis la cédule d'origine, plus une au-delà du nœud du milieu
 *     de son acte (`renfortDe`) ; le renfort reste en séries, qui ajoutent `ETAPE_SERIES` à chaque club.
 *   - LA BOUTIQUE (§ 4.8) : sept nœuds (`NOEUDS_BOUTIQUE`), le prix remis à zéro à chaque ouverture, `ACHATS_PAR_NOEUD`.
 *   - LE DÉPART (§ 4.9) : les bouche-trous tirés de `BANDE_DEPART` de leur saison (il était du 5e au 25e centile).
 *
 * LES ROBOTS (§ 10, `ROBOTS`), sur les mêmes dés : l'attentif (il lit le moteur, comme scripts/lib/rogue_sim.mjs ; une
 * élite quand ses deux cœurs sont là et qu'il tient le contrôle de l'acte) ; « premier » (il signe la première carte qui
 * entre) ; le naïf (le robot d'avant, `defaut`) ; LE GLOUTON (neuf : il court après chaque pièce — toutes les élites
 * offertes, même au dernier cœur) ; et les variantes de mesure : « placé » (le calendrier placé), « courbe » (la ligue
 * qui monte d'une étape par acte, `ETAPES_DES_ACTES` [0, 1, 2] essayé), « prudent » (l'attentif qui refuse les élites).
 *
 * CE QUE LE JEU N'A PAS ENCORE, ET CE QUE LE ROBOT JOUE À LA PLACE. Le banc de cinq pièces (tranche 5), le duel à un
 * seul choix (tranche 6) et la boutique à pièces (tranche 3) n'existent pas : le robot joue avec ce qui existe
 * aujourd'hui — le plan du soir, les adjoints à séjours et à salaire, la main du deck, le coach à l'expérience, les
 * plans par période au duel, les histoires telles quelles. « Une pièce » (un rival ou une élite battus) y est
 * approchée par le niveau suivant du coach (`SEUILS_NIVEAU`), comme au prototype. La cible de la tranche 1 se lit donc
 * sur l'ancien banc ; elle se remesure sur le vrai banc à la tranche 5, avant que les tranches 2 à 6 sortent (le
 * risque R1, § 5). Depuis la tranche 2 (docs/refonte-v27-2.md), le robot joue les règles du jeu au lieu de les copier :
 * les rivaux posés dans la cédule, les contrôles et les cœurs viennent de js/actes.js (`poserLesRivaux`, par le crochet
 * `placer` de `lancerLaLigue` ; `rangAuSoir`), la bande du départ de js/rogue.js (`bouchesTrousDuDepart`, `BANDE_DEPART`).
 * LE RÉGLAGE DE JP APRÈS LA PREMIÈRE MESURE (8 nov. 2026, « Élite = risque plus clair ») : aucune élite à l'acte I, et
 * l'élite se décide sur le pronostic du jour (`pronostic`), ta vraie chance de gagner, que son écran montrera (tranche 7).
 *
 * Tout est pur : la graine de la run, et le moteur sous sa graine. MESURE seulement, jamais lu par le jeu.
 */
import { teamStrength, photoAlignement, getHiddenRatings, jouerJournee, bilanLigue, creerSeries, jouerMatchSeries } from '../../js/sim.js';
import { ACTES, COEURS, CONTROLES, ETAPE_SERIES, aLaTaille, parmiLesAdversaires, acteDe, joursDe, rangAuSoir } from '../../js/actes.js';
import { jetonsDeDepart, habillerLaLigue, niveauDeLigue, rangDePrestige } from '../../js/rogue.js';
import { pronostic } from '../../js/pronostic.js';
import { SEMAINE } from '../../js/inventaire.js';
import { SEUILS_NIVEAU } from '../../js/pouvoirs.js';
import { lundiDuRobot, rondeDuRobot } from './cartes_robot.mjs';
import {
  generateur, metaAuNiveau, vedetteDuRobot, vestiaire, ouvrirLaSaison, lancerLaLigue, jetonsDuRobot, packDuRobot, prixAuAchat, signerDuPack, lectureDuRobot, planDuRobot,
} from './rogue_sim.mjs';

/* Les chiffres du § 5 et du § 9 que le jeu n'a pas encore (les actes, les rivaux, les contrôles et les cœurs : js/actes.js). */
export { ACTES, COEURS };
const TOP_DES_ELITES = 8, ELITES_PAR_ACTE = 1;
const ETAPES_DES_ACTES = [0, 0, 0];
const NOEUDS_BOUTIQUE = [0, 14, 27, 41, 54, 68, 82];
const ACHATS_PAR_NOEUD = 4;
const V_COEUR = 60, PRIX_PIECE = 32;
/* Les nœuds du milieu de chaque acte (le 14e, le 41e, le 68e) : un match reculé au-delà, dans son acte, renforce aussi. */
const MILIEUX = [NOEUDS_BOUTIQUE[1], NOEUDS_BOUTIQUE[3], NOEUDS_BOUTIQUE[5]];

/* Les robots de check_profondeur (§ 10). `elites` : 'prudent' (deux cœurs et le contrôle tenu), 'toutes', 'jamais'. */
export const ROBOTS = {
  attentif: { politique: 'attentif', elites: 'prudent' },
  premier: { politique: 'premier', elites: 'jamais' },
  naif: { politique: 'defaut', elites: 'jamais' },
  glouton: { politique: 'attentif', elites: 'toutes' },
  place: { politique: 'attentif', elites: 'prudent', placer: true },
  courbe: { politique: 'attentif', elites: 'prudent', etapes: [0, 1, 2] },
  prudent: { politique: 'attentif', elites: 'jamais' },
};


/*
 * LE RENFORT D'UN CLUB (§ 4.4) : `avant`, les rangs (de 0) de tes matchs contre lui dans la cédule d'origine ; `apres`,
 * dans la cédule placée. Chaque match reculé vaut une étape par acte de recul, sans arrondi ; dans un même acte, une
 * étape s'il passe le nœud du milieu. Toujours compté depuis l'origine : reculer puis ramener ne coûte rien.
 */
export function renfortDe(avant, apres) {
  const a = avant.slice().sort((x, y) => x - y), b = apres.slice().sort((x, y) => x - y);
  return a.reduce((s, k, i) => {
    const q = b[i], de = acteDe(k), vers = acteDe(q);
    if (q <= k) return s;
    return s + (vers > de ? vers - de : k < MILIEUX[de] && q >= MILIEUX[de] ? 1 : 0);
  }, 0);
}

const valeur = p => getHiddenRatings(p).v;
const forceDe = t => { const f = teamStrength(t); return f.att + f.def + f.g; };
const advDe = (m, you) => (m.A === you ? m.B : m.A);
const joueLe = (L, T, j) => L.calendrier[j].some(m => m.A === T || m.B === T);
/* LE CALENDRIER PLACÉ du robot « placé » (tranche 4) : échanger ton adversaire de deux journées, X (jour d) contre Y (jour e). */
function echanger(L, d, e, X, Y) {
  for (const j of [d, e]) for (const m of L.calendrier[j]) {
    if (m.A === X) m.A = Y; else if (m.A === Y) m.A = X;
    if (m.B === X) m.B = Y; else if (m.B === Y) m.B = X;
  }
}
/* L'échange garde 82 matchs à chacun et un match par jour seulement si Y joue le jour d autant que X joue le jour e. */
const peut = (L, d, e, X, Y) => joueLe(L, Y, d) === joueLe(L, X, e);

/*
 * UNE RUN : une saison en actes, de la première run (aucun déblocage, `metaAuNiveau(0)`), pour le robot `nom` sous la
 * graine `graine`. La saison se joue jusqu'au bout même quand la run meurt (les victoires se comparent en paires sur 82
 * matchs) ; une run morte, ou qui rate l'acte III, n'a ni séries ni Coupe.
 */
export function jouerLaRun(nom, graine) {
  const robot = ROBOTS[nom];
  const t0 = Date.now();
  const meta = metaAuNiveau(0);
  const rnd = generateur('rogue80', graine);
  const vedette = vedetteDuRobot(rnd, meta, null);
  const fixes = vedette ? [{ ...vedette }] : [];
  const etat = { roster: vestiaire(rnd, meta, fixes, [], { graine: `${graine}:depart`, premiere: true }).roster, variantes: new Map(), jetons: jetonsDeDepart(meta) };
  const etapes = robot.etapes || ETAPES_DES_ACTES;
  const ligue = niveauDeLigue(rangDePrestige(meta), 0);
  const c = ouvrirLaSaison(meta, etat, { graine, saison: 1, politique: robot.politique, exigence: 0, ligue, etapeDeRun: etapes[0], clic: null });
  const { you, opps, attentif } = c;
  const decisions = [{ jour: 0, cases: photoAlignement(c.roster), fermeture: 'auto' }, { jour: 0, coach: { ...etat.perso, talents: [...etat.perso.talents], main: [] } }];
  const L = lancerLaLigue(c, decisions);
  const n = L.teams.length;

  // LES RIVAUX DES ACTES : posés dans la cédule par le jeu (js/actes.js `poserLesRivaux`, à la création de la ligue).
  const jours = joursDe(L.calendrier, you);
  const advAu = j => advDe(L.calendrier[j].find(m => m.A === you || m.B === you), you);
  const force0 = new Map(opps.map(t => [t, forceDe(t)]));
  const parForce = opps.slice().sort((a, b) => force0.get(b) - force0.get(a));
  const finActe = L.rivaux.map(R => R.jour);
  const fixe = new Set(L.rivaux.map(R => jours.indexOf(R.jour)));
  const rivaux = L.rivaux.map(R => ({ voulu: R.voulu, rang: R.rang }));

  // LE CALENDRIER PLACÉ (le robot « placé ») : les plus faibles d'abord, le match du rival à sa place ; puis le renfort.
  const rangsContre = () => { const M = new Map(opps.map(T => [T, []])); jours.forEach((j, k) => M.get(advAu(j)).push(k)); return M; };
  const origine = rangsContre();
  if (robot.placer) {
    const libres = jours.map((j, k) => k).filter(k => !fixe.has(k));
    const pool = libres.map(k => advAu(jours[k])).sort((a, b) => force0.get(a) - force0.get(b));
    libres.forEach((k, q) => {
      const T = pool[q], X = advAu(jours[k]);
      if (X === T) return;
      const kk = libres.slice(q + 1).find(z => advAu(jours[z]) === T && peut(L, jours[k], jours[z], X, T));
      if (kk != null) echanger(L, jours[k], jours[kk], X, T);
    });
  }
  const placee = rangsContre();
  const renforts = new Map(opps.map(T => [T, renfortDe(origine.get(T), placee.get(T))]));
  const habiller = etape => { for (const T of opps) habillerLaLigue([T], ligue, valeur, etape + renforts.get(T)); };
  if ([...renforts.values()].some(Boolean)) habiller(etapes[0]);

  // Seuls les rivaux (posés par le jeu) et les élites prises sont des duels ; aucun ne paie de butin (`butins` : déjà réglés).
  const etatCartes = { histoires: [], avant: [], paliers: new Set(), butins: new Set(finActe), rondes: new Set() };
  const lecture = lectureDuRobot(c);
  let depense = 0, achats = 0, signes = 0, coeurs = COEURS, mort = 0, acte = 0;
  const jetons = () => jetonsDuRobot(c, etat.jetons, depense);
  const joues = () => jours.filter(j => j < L.jour).length;
  const enDuel = j => (you.minisBoss || []).some(mb => mb.jour === j);
  const gagneLe = j => { const m = L.calendrier[j].find(x => x.A === you || x.B === you); return (m.A === you) === (m.gfA > m.gfB); };
  const out = { robot: nom, graine, actes: [], elites: [], noeuds: [], jetonsMax: 0, rivaux, renfort: [...renforts.values()].reduce((a, x) => a + x, 0) };
  const tires = [];
  // UNE PIÈCE (un rival ou une élite battus) : approchée par le niveau suivant du coach, comme au prototype.
  const piece = () => {
    const tot = (you.perso.xp || 0) + (you.xpSaison || 0), suivant = SEUILS_NIVEAU.find(s => s > tot);
    if (suivant) decisions.push({ jour: L.jour, xpCoach: suivant - tot });
  };
  // LA BOUTIQUE À SES NŒUDS : le prix repart à zéro à chaque ouverture, au plus `ACHATS_PAR_NOEUD` achats.
  const visites = new Set();
  const boutique = () => {
    const dus = NOEUDS_BOUTIQUE.filter(k => k <= joues() && !visites.has(k));
    if (!dus.length) return;
    dus.forEach(k => visites.add(k));
    out.jetonsMax = Math.max(out.jetonsMax, jetons());
    let k = 0;
    for (; k < ACHATS_PAR_NOEUD; k++) {
      const voulu = packDuRobot(c, jetons(), k);
      if (!voulu) break;
      depense += prixAuAchat(voulu.cle, k); achats++;
      const { cartes, signe } = signerDuPack(c, voulu, `b${L.jour}:${achats}`);
      tires.push(...cartes);
      if (signe) signes++;
    }
    out.noeuds.push(k);
  };
  // L'ÉLITE DU LUNDI : le premier match de la semaine contre un club du top 8 en force, si l'acte n'en a pas eu.
  const top = new Set(parForce.slice(0, parmiLesAdversaires(TOP_DES_ELITES, n)));
  const semainesDesRivaux = new Set(finActe.map(j => Math.floor(j / SEMAINE)));
  const elite = () => {
    if (robot.elites === 'jamais' || mort || L.jour % SEMAINE || semainesDesRivaux.has(L.jour / SEMAINE)) return;
    const k = jours.findIndex(j => j >= L.jour && j < L.jour + SEMAINE && top.has(advAu(j)));
    if (k < 0 || finActe.includes(jours[k])) return;
    const a = acteDe(k);
    // JP, 8 nov. 2026 (« Élite = risque plus clair ») : aucune élite à l'acte I.
    if (a === 0) return;
    if (out.elites.filter(e => e.acte === a + 1).length >= ELITES_PAR_ACTE) return;
    if (robot.elites === 'prudent' && (coeurs < COEURS || rangAuSoir(L.calendrier, L.teams, you, L.jour - 1) > (a < 2 ? aLaTaille(CONTROLES[a], n) : aLaTaille(16, n)))) return;
    const j = jours[k], m = L.calendrier[j].find(x => x.A === you || x.B === you);
    const pr = pronostic({ A: m.A, B: m.B, calendrier: L.calendrier, jourMatch: j, jourRevele: L.jour, graine: `${graine}:elite` });
    const p = Math.min(0.55, Math.max(0.25, (m.A === you ? pr.vA : pr.vB) / pr.n));
    const J = Math.min(90, Math.max(10, Math.round((V_COEUR * (1 - p)) / p) - PRIX_PIECE));
    L.grosAnnonces[j] = { jour: j, adv: advAu(j), raison: 'elite' };
    etatCartes.butins.add(j);
    out.elites.push({ acte: a + 1, jour: j, p: +p.toFixed(3), J, rangForce: parForce.indexOf(advAu(j)) });
  };

  let pts0 = 0;
  const plans = new Map();
  let planPose = 'match';
  while (!L.fini) {
    elite();
    for (const d of lundiDuRobot({ L, you, graine: `rogue80:${graine}:1`, politique: lecture.politique, clic: null, jetons: jetons(), etat: etatCartes, fit: lecture.fit, lire: lecture.lire })) {
      decisions.push(d); depense -= d.gain || 0;
    }
    boutique();
    const plan = planDuRobot(L, you, plans, attentif, null);
    if (plan !== undefined && plan !== planPose) { decisions.push({ jour: L.jour, plan: { cle: plan } }); planPose = plan; }
    const jour = L.jour;
    jouerJournee(L);
    const e = out.elites.find(x => x.jour === jour);
    if (e) {
      e.gagnee = gagneLe(jour); e.duel = enDuel(jour);
      if (e.gagnee) { depense -= e.J; piece(); } else if (!mort && --coeurs <= 0) mort = e.acte;
    }
    if (acte < 3 && jour === finActe[acte]) {
      const gagne = gagneLe(jour);
      if (gagne) piece();
      // Le rang de l'écran Classement, ses bris d'égalité compris (js/actes.js `rangAuSoir`), comme le jeu.
      const rang = rangAuSoir(L.calendrier, L.teams, you, jour);
      // Les contrôles des actes I et II ; celui de l'acte III est la place en séries, lue au classement final.
      const tenu = acte < 2 ? rang <= aLaTaille(CONTROLES[acte], n) : null;
      if (tenu === false && !mort && --coeurs <= 0) mort = acte + 1;
      out.actes.push({ rang, pts: you.PTS - pts0, matchs: ACTES[acte] - (acte ? ACTES[acte - 1] : 0), W: you.W, rival: gagne, duel: enDuel(jour), tenu, coeurs });
      pts0 = you.PTS;
      acte++;
      if (acte < 3 && etapes[acte] !== etapes[acte - 1]) habiller(etapes[acte]);
    }
  }
  if (!mort) boutique();
  const b = bilanLigue(L);
  const rang = b.standings.indexOf(you) + 1, places = aLaTaille(16, n);
  Object.assign(out, { rang, W: you.W, pts: you.PTS, achats, signes, coeurs: Math.max(0, coeurs), mort, rate: !mort && rang > places, rondes: 0, coupe: false });
  out.actes[2].tenu = rang <= places;
  if (!mort && !out.rate) {
    habiller(etapes[2] + ETAPE_SERIES);
    const decsS = [];
    const S = creerSeries(b.standings.slice(0, places), { ligue: L, graine: L.graine, decisions: decsS, equipes: L.teams });
    for (let garde = 0; !S.fini && garde < 200; garde++) {
      const d = rondeDuRobot({ S, L, you, graine: `rogue80:${graine}:1`, politique: lecture.politique, clic: null, jetons: jetons(), etat: etatCartes, lire: lecture.lireRonde });
      if (d) { decsS.push(d); depense -= d.gain || 0; }
      jouerMatchSeries(S);
    }
    out.rondes = S.toutes.filter(s => s.winner === you).length;
    out.coupe = S.champion === you;
  }
  // La cédule après les échanges : 82 matchs à chaque club, jamais deux le même jour.
  const nb = new Map();
  let doubles = 0;
  for (const jj of L.calendrier) { const vus = new Set(); for (const m of jj) for (const t of [m.A, m.B]) { if (vus.has(t)) doubles++; vus.add(t); nb.set(t, (nb.get(t) || 0) + 1); } }
  out.verif = { doubles, min: Math.min(...nb.values()), max: Math.max(...nb.values()), joursToi: jours.length };
  // Le robot ne laisse pas de cartes posées sur des joueurs partagés : chaque run repart propre.
  for (const p of Object.values(you.roster)) if (p) delete p._carte;
  for (const x of tires) delete x.p._carte;
  out.s = Math.round((Date.now() - t0) / 1000);
  return out;
}
