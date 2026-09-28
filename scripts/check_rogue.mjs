/**
 * LE ROGUE (S80) — le départ du classeur, la courbe, le cartable.
 *
 * JP : *le classeur, on peut piger x cartes aux départ, ou random, selon
 * upgrades* ; *je veux que ça prenne plusieurs saisons et upgrades gagner la
 * coupe, pis les upgrade de trio aident au début, mais les downgrade upgrade
 * sont plus forts late game* ; *envoyer cartes au cartable quand discard et
 * possible de discard les cartes de remplaçants ou débloquer des slots de
 * remplacement* ; puis *en roguelike, nouvelle saison veut dire continuer
 * avec base des cartes ramassé qui sont pas des consommables*.
 *
 *   node scripts/check_rogue.mjs                       (rapide : 10 runs par niveau, 2 campagnes)
 *   RUNS=40 CAMPAGNES=6 node scripts/check_rogue.mjs   (la mesure du rapport, une dizaine de minutes)
 *
 * Quatre parties :
 *   1. LES INVARIANTS : les cases de réserve de plus (aucun mode ne les
 *      remplit, un réserviste qui y est monte quand un habillé se blesse),
 *      l'échelle de la fin de partie, l'amélioration qui grandit et le style
 *      qui ne grandit pas, le deck qui continue, le départ du classeur (pur,
 *      un nombre et un mode par niveau), le mandat du proprio, les jalons ;
 *   2. LA COURBE : des runs jouées par un robot (scripts/lib/rogue_sim.mjs),
 *      à cinq niveaux de déblocages — la Coupe par run, la Coupe à la
 *      première saison, les saisons par run, la première saison ;
 *   3. LES CAMPAGNES : de zéro, run après run, les écussons et les jalons
 *      achètent les déblocages — combien de runs avant la première Coupe ;
 *   4. LA FORCE DES CARTES SELON LE MOMENT : le même match, sur les mêmes
 *      dés, au jour 3, au jour 75 et en finale — des cartes de trio (le
 *      stage), des améliorations, des cartes qui visent l'adversaire.
 *
 * Les runs, les campagnes et les moments se jouent en parallèle (un
 * travailleur chacun) : le moteur a son état par module, donc par fil.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, CASES_DE_BASE, RESERVES_EN_PLUS, casesDuMode, autoRoster, activeLineup, createTeam, getPlayerKey, getPersonKey,
  echelleTardive, grandirEffet, effetsDesCartes, appliquerMutation, simulerGrosMatch, MUTATIONS, MAITRISE_PAS, ENTENTE_STAGE,
  lignesDe, chimieLigne, apprentissageDe, joueursDeLigne,
} from '../js/sim.js';
import { deckDe, DECK_DEPART } from '../js/combat.js';
import {
  DEBLOCAGES, departDuClasseur, budgetDuClasseur, reservesDeLaRun, tirageDuClasseur, MANDATS, mandatDe, mandatRempli,
  JALONS, jalonsAtteints, recompenseDe, baremeRogue,
} from '../js/rogue.js';
import { jouerRun, acheterDans, metaAuNiveau, coutDuNiveau, classeurSynthetique, ORDRE_DEBLOCAGES, shard, groupe } from './lib/rogue_sim.mjs';
import { exiger, borne, monte, informer, verdict } from './verdict.mjs';

const RUNS = Number(process.env.RUNS ?? 10);
const CAMPAGNES = Number(process.env.CAMPAGNES ?? 2);
const RUNS_CAMPAGNE = Number(process.env.RUNS_CAMPAGNE ?? 14);
const MATCHS = Number(process.env.MATCHS ?? 1500);
/* Les niveaux : 0, puis les N premiers déblocages de l'ordre du robot ; le classeur de M runs jouées. */
const NIVEAUX = [[0, 0], [6, 4], [11, 9], [16, 16], [ORDRE_DEBLOCAGES.length, 28]];
const MOMENTS = [['jour 3', { jour: 2 }], ['jour 75', { jour: 74 }], ['finale', { serie: true, ronde: 3 }]];
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/*
 * LA FORCE DES CARTES À UN MOMENT : le même match sur les mêmes dés
 * (`simulerGrosMatch`, avec son moment), une vraie équipe contre une autre,
 * MATCHS fois par bras. L'état de la formation suit le moment : au jour N,
 * chaque ligne a joué N matchs de son système (`MAITRISE_PAS`) et ses paires
 * N matchs ensemble ; en finale, une saison entière. Trois bras, contre le
 * même match sans carte :
 *   - TRIO DE SAISON : « Le stage express » sur chaque système de la
 *     formation (une carte par système : maîtrise +25 %, et ENTENTE_STAGE
 *     matchs d'entente aux lignes qui le jouent), joué juste avant ;
 *   - TRIO DE MATCH : les synergies du deck qui lisent tes lignes, « Les
 *     gâchettes », « Les jambes » et « Le mur bleu » (trois cartes) ;
 *   - AMÉLIORATION : « Le tir affûté » sur les six avants du top 6 et « Le
 *     mur » sur les quatre défenseurs du top 4 (dix cartes) ;
 *   - ADVERSAIRE : « Les provoquer », « Une ombre sur leur vedette » et
 *     « Les user » (trois cartes).
 * L'effet se lit en BUTS PAR MATCH (l'écart pour moins l'écart contre),
 * par carte, et en points de victoire pour le bras entier.
 */
function forceAuMoment(i, matchs) {
  const [nom, moment] = MOMENTS[i];
  const jours = moment.serie ? 82 : moment.jour;
  const equipe = (s, tag) => createTeam(tag, tag, autoRoster(shard(s).byTeam[tag].filter(p => (p.gp || 0) >= 10).map(p => ({ ...p }))));
  const toi = equipe('2005-06', 'CAR'), adv = equipe('2005-06', 'BUF');
  // Une ligue Rogue : la courbe de la fin de partie joue (`courbe`).
  toi.courbe = adv.courbe = true;
  const systemes = new Set();
  const poserEtat = (t, stage) => {
    const lignes = lignesDe(t, t.roster, { duSoir: false });
    t.entente = new Map();
    for (let u = 0; u < 4; u++) {
      // Au jour N, chaque paire de la ligne a N matchs ensemble ; le stage (le moteur, `stageDEntente`) en ajoute ENTENTE_STAGE aux paires du trio et de la paire.
      const js = Object.entries(joueursDeLigne(t.roster, u)).filter(([, p]) => p).map(([role, p]) => ({ p, d: role === 'DG' || role === 'DD' }));
      for (let a = 0; a < js.length; a++) for (let b = a + 1; b < js.length; b++) {
        const x = getPlayerKey(js[a].p), y = getPlayerKey(js[b].p);
        t.entente.set(x < y ? `${x}|${y}` : `${y}|${x}`, jours + (stage && js[a].d === js[b].d ? ENTENTE_STAGE : 0));
      }
      for (const [role, p] of Object.entries(joueursDeLigne(t.roster, u))) {
        if (!p) continue;
        const k = role === 'DG' || role === 'DD' ? lignes[u].tacD : lignes[u].tac;
        p._maitrise = {};
        if (!k || k === 'hourra') continue;
        if (t === toi) systemes.add(k);
        const m = 1 - (1 - MAITRISE_PAS) ** jours;
        p._maitrise[k] = stage ? m + (1 - m) * 0.25 : m;
      }
    }
    return [0, 1, 2, 3].map(u => chimieLigne(apprentissageDe(t), t.roster, u, lignes[u]));
  };
  const nettoyer = t => { for (const p of Object.values(t.roster)) if (p) { delete p._amel; delete p._mut; delete p._maitrise; } };
  const jouer = (bras, cartes = []) => {
    let v = 0, ecart = 0;
    for (let k = 0; k < matchs; k++) {
      nettoyer(toi); nettoyer(adv);
      poserEtat(adv, false);
      poserEtat(toi, bras === 'trio');
      if (bras === 'amelioration') for (const s of SLOTS.filter(x => !x.scratch && x.unit <= 1 && (x.group === 'F' || x.group === 'D'))) {
        const p = toi.roster[s.i];
        if (p) appliquerMutation(toi, p, s.group === 'F' ? 'affute' : 'mur', 0, 'choix');
      }
      const r = simulerGrosMatch(toi, adv, { cartes: { jouees: cartes }, graine: 'force', cle: `m${k}`, moment });
      v += r.gagne ? 1 : 0; ecart += r.gf - r.ga;
    }
    return { v: v / matchs, ecart: ecart / matchs };
  };
  const avant = poserEtat(toi, false), apres = poserEtat(toi, true);
  const rien = jouer('rien'), trio = jouer('trio'), amel = jouer('amelioration'), advs = jouer('rien', ['provoquer', 'ombre', 'user']), syn = jouer('rien', ['gachettes', 'jambes', 'murBleu']);
  nettoyer(toi); nettoyer(adv);
  const nTrio = Math.max(1, systemes.size);
  return {
    nom, echelle: echelleTardive(moment), rien: rien.v, chimie: moy(apres) - moy(avant), nTrio,
    trio: { v: trio.v - rien.v, parCarte: (trio.ecart - rien.ecart) / nTrio },
    synergie: { v: syn.v - rien.v, parCarte: (syn.ecart - rien.ecart) / 3 },
    amelioration: { v: amel.v - rien.v, parCarte: (amel.ecart - rien.ecart) / 10 },
    adversaire: { v: advs.v - rien.v, parCarte: (advs.ecart - rien.ecart) / 3 },
  };
}

/* ---------- les travailleurs : un niveau, une campagne, un moment ---------- */
if (!isMainThread) {
  const t = workerData;
  if (t.genre === 'niveau') {
    const meta = metaAuNiveau(t.niveau);
    const classeur = classeurSynthetique(meta, t.runsAvant, `classeur-${t.niveau}`);
    const out = [];
    for (let i = t.de; i < t.a; i++) {
      const r = jouerRun({ ...meta, deblocages: meta.deblocages.slice(), jalons: {} }, { classeur, graine: `niveau${t.niveau}-${i}` });
      out.push({ coupe: r.coupe, nSaisons: r.nSaisons, pts1: r.pts1, series1: r.series1, coupe1: !!r.saisons[0].coupe, depart: r.depart });
    }
    parentPort.postMessage({ niveau: t.niveau, classeur: classeur.length, out });
  } else if (t.genre === 'force') {
    parentPort.postMessage({ force: forceAuMoment(t.i, t.matchs) });
  } else {
    // UNE CAMPAGNE : de zéro, les écussons et les jalons achètent les déblocages, run après run.
    const meta = { ecussons: 0, deblocages: [], jalons: {} };
    const classeur = new Map();
    let derniere = [], saisons = 0, premiere = null;
    const runs = [];
    for (let r = 0; r < t.runs; r++) {
      const niv = meta.deblocages.length;
      const res = jouerRun(meta, { classeur: [...classeur.values()], derniere, graine: `campagne${t.c}-run${r}`, jalons: true });
      for (const x of res.entrees) if (!classeur.has(getPlayerKey(x.p))) classeur.set(getPlayerKey(x.p), x);
      derniere = res.equipe;
      meta.ecussons += res.ecussons;
      acheterDans(meta);
      saisons += res.nSaisons;
      runs.push({ niv, nSaisons: res.nSaisons, coupe: res.coupe, ecussons: res.ecussons });
      if (res.coupe && premiere === null) premiere = { run: r + 1, saisons };
    }
    parentPort.postMessage({ c: t.c, runs, premiere, deblocages: meta.deblocages.length, jalons: Object.keys(meta.jalons || {}).length });
  }
} else {
  const lancer = data => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: data });
    w.once('message', resolve); w.once('error', reject);
  });
  const pct = x => `${Math.round(100 * x)} %`;
  const signe = (x, d = 1) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d).replace('.', ',')}`;
  const t0 = Date.now();
  console.log('\n  Le Rogue (S80) : le départ du classeur, la courbe, le cartable\n');

  /* ---------- 1. les invariants ---------- */
  exiger('23 cases de base, et les cases de réserve de plus après elles', CASES_DE_BASE.length === 23 && SLOTS.length === 23 + RESERVES_EN_PLUS
    && SLOTS.filter(s => s.extra).every(s => s.scratch && s.group === 'ANY' && s.i >= 23), `${SLOTS.length} cases, ${RESERVES_EN_PLUS} de plus`);
  exiger('aucun mode ne comble les cases de plus', ['CLASSIQUE', 'LOTO', 'EXPRESS', 'LOTO_EXPRESS'].every(m => casesDuMode(m).every(s => !s.extra)), 'casesDuMode');
  const e = shard('1985-86');
  const quarante = e.byTeam.EDM.concat(e.byTeam.MTL).slice(0, 40).map(p => ({ ...p }));
  const auto = autoRoster(quarante);
  exiger('l\'alignement automatique ne remplit jamais une case de plus', SLOTS.filter(s => s.extra).every(s => !auto[s.i]) && Object.keys(auto).length === 23, `${Object.keys(auto).length} cases prises sur 40 joueurs`);
  {
    // Un réserviste dans une case de plus MONTE quand un habillé se blesse.
    const roster = { ...auto };
    const dedans = new Set(Object.values(roster).map(getPersonKey));
    const extra = quarante.filter(p => !dedans.has(getPersonKey(p)) && groupe(p) === 'F')[0];
    const plus = SLOTS.find(s => s.extra === 1);
    for (const s of SLOTS.filter(x => x.scratch && !x.extra)) delete roster[s.i];
    roster[plus.i] = extra;
    const t = createTeam('Essai', 'ESS', roster);
    const blesse = roster[SLOTS.find(s => s.group === 'F' && s.unit === 0 && s.role === 'C').i];
    t.injured.set(blesse, 5);
    const L = activeLineup(t);
    exiger('un joueur dans une case de réserve de plus monte quand un habillé se blesse', Object.values(L).includes(extra) && !Object.values(L).includes(blesse), extra.n);
  }
  const e0 = echelleTardive({ jour: 0 }), e40 = echelleTardive({ jour: 40 }), e81 = echelleTardive({ jour: 81 });
  const eS = [0, 1, 2, 3].map(r => echelleTardive({ serie: true, ronde: r }));
  exiger('l\'échelle de la fin de partie : ×0,5 au premier soir, ×1 à la mi-saison, ×1,5 au dernier, ×2 en finale', e0 === 0.5 && Math.abs(e81 - 1.5) < 1e-9 && eS[3] === 2 && Math.abs(e40 - 1) < 0.01,
    `jour 1 ×${e0.toFixed(2)} · jour 41 ×${e40.toFixed(2)} · jour 82 ×${e81.toFixed(2)} · séries ${eS.map(x => `×${x.toFixed(2)}`).join(' ')}`);
  monte('elle ne redescend jamais, de la saison aux séries', [e0, e40, e81, ...eS]);
  {
    const p = { ...quarante[0] }, q = { ...quarante[1] };
    const t = createTeam('Essai', 'ESS', { 0: p, 1: q });
    appliquerMutation(t, p, 'affute', 0, 'choix');
    appliquerMutation(t, q, 'style_sniper', 0, 'choix');
    exiger('une amélioration grandit à part (`_amel`), un style ne grandit pas (`_mut`)', p._amel && p._amel.finition === MUTATIONS.affute.finition && !(p._mut && p._mut.finition)
      && q._mut && q._mut.finition === MUTATIONS.style_sniper.finition && !q._amel, `affûté ${p._amel && p._amel.finition} · franc-tireur ${q._mut && q._mut.finition}`);
  }
  {
    const fx1 = effetsDesCartes(null, { jouees: ['provoquer'] }, 'x');
    const fx2 = effetsDesCartes(null, { jouees: ['provoquer'] }, 'x', { echelle: 2 });
    const r = grandirEffet({ robustesse: 1.4, finition: 1.04, F: [1.3, 1, 0.9, 0.8] }, 2);
    exiger('une carte qui vise l\'adversaire grandit ; la robustesse (une somme) et les minutes suivent', fx1.adv[0].discipline === 1.25 && Math.abs(fx2.adv[0].discipline - 1.5) < 1e-9
      && Math.abs(r.robustesse - 2.8) < 1e-9 && Math.abs(r.finition - 1.08) < 1e-9 && Math.abs(r.F[0] - 1.6) < 1e-9, `« Les provoquer » : punitions +25 % → +${Math.round((fx2.adv[0].discipline - 1) * 100)} % en finale`);
  }
  {
    const base = ['lancer+', 'bloquer', 'gachettes', 'doute'];
    const d = deckDe([{ jour: 0, deck: 'report', deckDeBase: base }, { jour: 5, recompense: 'provoquer' }]);
    exiger('la saison suivante d\'une run repart du deck de la fin (`deckDeBase`)', d.join() === [...base, 'provoquer'].join() && deckDe([]).join() === DECK_DEPART.join(), d.join(' · '));
  }
  {
    const niveaux = [[], ['classeur1'], ['classeur1', 'classeur2', 'classeurTri'], ['classeur1', 'classeur2', 'classeur3', 'classeurTri', 'classeurChoix']];
    const D = niveaux.map(d => departDuClasseur({ deblocages: d }));
    exiger('le départ du classeur : une carte au hasard sans rien, puis plus de cartes, le tri, le choix', D[0].n === 1 && D[0].mode === 'hasard' && D[1].n === 2 && D[2].n === 3 && D[2].mode === 'tri' && D[2].vues === 6 && D[3].n === 4 && D[3].mode === 'choix',
      D.map(x => `${x.n} ${x.mode}`).join(' · '));
    const cles = ['1985-86_EDM_1', '2001-02_DET_2', '1970-71_BOS_3', '2019-20_TBL_4'];
    const a = tirageDuClasseur(cles, 'g:3'), b = tirageDuClasseur(cles.slice().reverse(), 'g:3'), c = tirageDuClasseur(cles, 'g:4');
    exiger('le tirage du classeur est pur : la même graine donne le même ordre, quel que soit l\'ordre du cartable', a.join() === b.join() && a.length === 4, `${a.join(' ')} · une autre run : ${c.join(' ')}`);
    exiger('le budget du classeur : 25 M$ sans déblocage, le plafond débloqué le monte', budgetDuClasseur({ deblocages: [] }) === 25_000_000 && budgetDuClasseur({ deblocages: ['plafond1', 'plafond2'] }) === 32_000_000, '25 M$ · 32 M$');
    exiger('les cases de réserve de plus se débloquent une à une', reservesDeLaRun({ deblocages: [] }) === 0 && reservesDeLaRun({ deblocages: ['banc1'] }) === 1 && reservesDeLaRun({ deblocages: ['banc1', 'banc2'] }) === 2 && DEBLOCAGES.banc2.requis === 'banc1', '0 · 1 · 2');
    exiger('le barème d\'une run : 4 🪙 par victoire, 7 et 9 avec les commanditaires', baremeRogue({ deblocages: [] }).victoire === 4 &&baremeRogue({ deblocages: ['commanditaire1'] }).victoire === 7 && baremeRogue({ deblocages: ['commanditaire1', 'commanditaire2'] }).victoire === 9, '4 · 7 · 9');
  }
  exiger('le mandat du proprio monte de saison en saison', MANDATS.every((m, i) => i === 0 || m.rondes > MANDATS[i - 1].rondes) && mandatDe(1).rondes === 0 && mandatDe(9).rondes === MANDATS[MANDATS.length - 1].rondes
    && mandatRempli(1, { series: true, rondes: 0 }) && !mandatRempli(2, { series: true, rondes: 0 }) && mandatRempli(2, { series: true, rondes: 1 }) && !mandatRempli(1, { series: false }),
    MANDATS.map((m, i) => `saison ${i + 1}${i === MANDATS.length - 1 ? '+' : ''} : ${m.mot}`).join(' · '));
  {
    const m = { deblocages: [], jalons: {} };
    const a = jalonsAtteints(m, { series: true, rondes: 1, pts: 101, saisonDeLaRun: 1 }).map(J => J.cle);
    const offert = recompenseDe(m, JALONS.find(J => J.cle === 'series'));
    const deja = recompenseDe({ deblocages: ['classeur1'] }, JALONS.find(J => J.cle === 'series'));
    exiger('les jalons se lisent dans les résultats, et offrent un déblocage ou des écussons', a.join() === 'series,ronde,cent' && offert.deblocage === 'classeur1' && deja.ecussons === 30
      && JALONS.every(J => !J.recompense.deblocage || DEBLOCAGES[J.recompense.deblocage]), `${JALONS.length} jalons · ${a.join(', ')}`);
  }

  /* ---------- 2, 3, 4 : les runs, les campagnes et les moments, en parallèle ---------- */
  const taches = [];
  for (const [niveau, runsAvant] of NIVEAUX) for (let de = 0; de < RUNS; de += Math.ceil(RUNS / 2)) taches.push({ genre: 'niveau', niveau, runsAvant, de, a: Math.min(RUNS, de + Math.ceil(RUNS / 2)) });
  for (let c = 0; c < CAMPAGNES; c++) taches.push({ genre: 'campagne', c, runs: RUNS_CAMPAGNE });
  for (let i = 0; i < MOMENTS.length; i++) taches.push({ genre: 'force', i, matchs: MATCHS });
  const resultats = await Promise.all(taches.map(lancer));

  /* 2. la courbe */
  const parNiveau = new Map();
  for (const r of resultats.filter(x => x.niveau !== undefined)) {
    const x = parNiveau.get(r.niveau) || { classeur: r.classeur, out: [] };
    x.out.push(...r.out); parNiveau.set(r.niveau, x);
  }
  const lignes = [];
  for (const [niveau] of NIVEAUX) {
    const { out, classeur } = parNiveau.get(niveau);
    const L = { niveau, cout: coutDuNiveau(niveau), classeur, coupe: moy(out.map(o => o.coupe)), coupe1: moy(out.map(o => o.coupe1)), saisons: moy(out.map(o => o.nSaisons)),
      pts1: moy(out.map(o => o.pts1)), series1: moy(out.map(o => o.series1)), depart: moy(out.map(o => o.depart)), n: out.length };
    lignes.push(L);
    informer(`${niveau} déblocages · ${L.cout} 🏅`, `Coupe par run ${pct(L.coupe)} · dès la 1re saison ${pct(L.coupe1)} · ${L.saisons.toFixed(2).replace('.', ',')} saisons par run · 1re saison ${L.pts1.toFixed(0)} pts, séries ${pct(L.series1)} · ${L.depart.toFixed(1).replace('.', ',')} carte(s) du classeur au départ (${L.classeur} au classeur) · ${L.n} runs`);
  }
  monte('la première saison monte avec les déblocages (points, à 4 près)', lignes.map(l => l.pts1), 4);
  // Mesuré à soixante runs : 2 % par run, 0 % dès la première saison. Les bornes laissent une Coupe sur dix runs (le mode rapide).
  borne('sans aucun déblocage, la Coupe par run est rare', lignes[0].coupe, 0, 0.1);
  borne('sans aucun déblocage, la Coupe dès la première saison : presque jamais', lignes[0].coupe1, 0, 0.1);
  exiger('tout débloqué, la Coupe se gagne bien plus souvent qu\'au départ', lignes[lignes.length - 1].coupe >= lignes[0].coupe + 0.1, `${pct(lignes[0].coupe)} → ${pct(lignes[lignes.length - 1].coupe)}`);

  /* 3. les campagnes */
  const camp = resultats.filter(x => x.c !== undefined);
  for (const r of camp) {
    informer(`campagne ${r.c + 1}`, `${r.premiere ? `1re Coupe à la run ${r.premiere.run} (${r.premiere.saisons} saisons jouées)` : `pas de Coupe en ${RUNS_CAMPAGNE} runs`} · ${r.deblocages} déblocages et ${r.jalons} jalons au bout · saisons par run : ${r.runs.map(x => `${x.nSaisons}${x.coupe ? '🏆' : ''}`).join(' ')}`);
  }
  /*
   * UNE PREMIÈRE RUN GAGNE PARFOIS (mesuré : une sur vingt environ, jamais dès
   * sa première saison) : on juge la MÉDIANE des campagnes, pas chacune. Au
   * mode rapide (deux campagnes), la moyenne des deux.
   */
  const premieres = camp.map(r => (r.premiere ? r.premiere.run : RUNS_CAMPAGNE + 1)).sort((a, b) => a - b);
  const mediane = premieres.length % 2 ? premieres[(premieres.length - 1) / 2] : (premieres[premieres.length / 2 - 1] + premieres[premieres.length / 2]) / 2;
  exiger('la première Coupe d\'une campagne demande plusieurs runs (la médiane : trois runs ou plus)', mediane >= 3, `médiane ${mediane} · ${camp.map(r => (r.premiere ? `run ${r.premiere.run}` : `> ${RUNS_CAMPAGNE}`)).join(' · ')}`);

  /* 4. la force des cartes selon le moment */
  const force = resultats.filter(x => x.force).map(x => x.force).sort((a, b) => a.echelle - b.echelle);
  for (const f of force) {
    informer(`les cartes, ${f.nom} (×${f.echelle.toFixed(2).replace('.', ',')})`, `sans carte ${pct(f.rien)} de victoires · STAGE (${f.nTrio}), chimie ${signe(f.chimie)} par ligne : ${signe(f.trio.parCarte, 3)} but/match par carte, ${signe(100 * f.trio.v)} pts · SYNERGIES (3) : ${signe(f.synergie.parCarte, 3)} par carte, ${signe(100 * f.synergie.v)} pts · AMÉLIORATIONS (10) : ${signe(f.amelioration.parCarte, 3)} par carte, ${signe(100 * f.amelioration.v)} pts · ADVERSAIRE (3) : ${signe(f.adversaire.parCarte, 3)} par carte, ${signe(100 * f.adversaire.v)} pts`);
  }
  const [debut, fin, finale] = force;
  exiger('la carte de trio aide au début et plafonne : son gain de chimie fond avec la saison', debut.chimie > 1 && fin.chimie < debut.chimie / 5, `chimie ${signe(debut.chimie)} par ligne au jour 3, ${signe(fin.chimie)} au jour 75`);
  {
    // Une carte de trio ne grandit pas, par construction : la même main à ×0,5 et à ×2 fait les mêmes effets pour toi.
    const a = effetsDesCartes(null, { jouees: ['gachettes', 'doublePresence', 'quatrieme'] }, 'x', { echelle: 0.5 }), b = effetsDesCartes(null, { jouees: ['gachettes', 'doublePresence', 'quatrieme'] }, 'x', { echelle: 2 });
    exiger('une carte de trio du deck ne grandit pas : ses effets sont les mêmes à ×0,5 et à ×2', JSON.stringify(a.effets) === JSON.stringify(b.effets), `${a.effets.length} effet(s)`);
  }
  exiger('une amélioration et une carte sur l\'adversaire valent au moins deux fois plus en finale qu\'au jour 3', finale.amelioration.parCarte > 2 * debut.amelioration.parCarte && finale.adversaire.parCarte > 2 * debut.adversaire.parCarte,
    `amélioration ${signe(debut.amelioration.parCarte, 3)} → ${signe(finale.amelioration.parCarte, 3)} · adversaire ${signe(debut.adversaire.parCarte, 3)} → ${signe(finale.adversaire.parCarte, 3)} but/match par carte`);
  exiger('en finale, une amélioration bat le stage, et une carte sur l\'adversaire bat une carte de trio du deck', finale.amelioration.parCarte > finale.trio.parCarte && finale.adversaire.parCarte > finale.synergie.parCarte,
    `stage ${signe(finale.trio.parCarte, 3)} · synergie ${signe(finale.synergie.parCarte, 3)} · amélioration ${signe(finale.amelioration.parCarte, 3)} · adversaire ${signe(finale.adversaire.parCarte, 3)} but/match par carte`);
  // Ce qui se lit sans se juger : au troisième soir, une carte de trio du deck contre une amélioration — l'écart dépend de la formation.
  informer('au jour 3, une carte de trio du deck contre une amélioration', `synergie ${signe(debut.synergie.parCarte, 3)} · amélioration ${signe(debut.amelioration.parCarte, 3)} · adversaire ${signe(debut.adversaire.parCarte, 3)} but/match par carte`);
  informer('le temps', `${((Date.now() - t0) / 1000).toFixed(0)} s (${RUNS} runs par niveau, ${CAMPAGNES} campagne(s) de ${RUNS_CAMPAGNE} runs, ${MATCHS} matchs par bras et par moment)`);
  verdict();
}
