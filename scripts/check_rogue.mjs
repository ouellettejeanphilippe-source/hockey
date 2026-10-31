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
 *   RUNS=40 CAMPAGNES=6 node scripts/check_rogue.mjs   (la mesure du rapport, cinq ou six minutes)
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
 *   2b. LE DUEL JOUÉ : la même première saison, sur les mêmes dés, le
 *      robot attentif qui répond aux intentions ou qui les laisse là
 *      (SAISONS_MAIN) ;
 *   (4. LA FORCE DES CARTES SELON LE MOMENT est partie avec la V13-2 : voir
 *      la note au bas du fichier.)
 *
 * Les runs et les campagnes se jouent en parallèle (un
 * travailleur chacun, FILS à la fois — 6 par défaut) : le moteur a son état
 * par module, donc par fil.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import {
  SLOTS, CASES_DE_BASE, RESERVES_EN_PLUS, casesDuMode, autoRoster, activeLineup, createTeam, getPlayerKey, getPersonKey,
  echelleTardive, grandirEffet, effetsDesCartes, JOURS_PAR_MATCH,
} from '../js/sim.js';
import { CARTES_MATCH } from '../js/combat.js';
import {
  DEBLOCAGES, departDuClasseur, lotosDeSaison, gardesDeLaDerniere, lotoDeCase, lireMeta, budgetDuClasseur, reservesDeLaRun, tirageDuClasseur, MANDATS, mandatDe, mandatRempli, rangDuMandat,
  JALONS, jalonsAtteints, recompenseDe, baremeRogue, JETONS, jetonsDe, PRESTIGES, coachsOuverts, exigencesOuvertes,
  EXIGENCES, PRIME_EXIGENCE, exigencesDe, plafondDeSaison, gardesDeLaRun, GARDES_DE_SAISON, ESPACE_DE_DEPART, soutiensDuDepart,
  ligueDe, niveauDeLigue, editionDansLaLigue, habillerLaLigue, ETAPES_PAR_CRAN, etapeDeLaRun, ETAPE_APRES_LA_PREMIERE,
} from '../js/rogue.js';
import { EDITIONS } from '../js/rarete.js';
import { NIVEAUX as NOMS_DE_NIVEAU } from '../js/niveaux.js';
import { POUVOIRS } from '../js/pouvoirs.js';
import { VOIES } from '../js/coachs.js';
import { PACKS_TOUS, PACKS_DE_SERIE } from '../js/packs.js';
import { jouerRun, acheterDans, metaAuNiveau, coutDuNiveau, classeurSynthetique, ORDRE_DEBLOCAGES, shard, groupe } from './lib/rogue_sim.mjs';
import { exiger, borne, monte, informer, verdict } from './verdict.mjs';

const RUNS = Number(process.env.RUNS ?? 10);
const CAMPAGNES = Number(process.env.CAMPAGNES ?? 2);
const RUNS_CAMPAGNE = Number(process.env.RUNS_CAMPAGNE ?? 14);
/* Les premières saisons jouées deux fois, le duel joué puis laissé (Jalon P0, puis V13-2). */
const SAISONS_MAIN = Number(process.env.SAISONS_MAIN ?? 12);
/* Les niveaux : 0, puis les N premiers déblocages de l'ordre du robot ; le classeur de M runs jouées. */
const NIVEAUX = [[0, 0], [6, 4], [11, 9], [16, 16], [ORDRE_DEBLOCAGES.length, 28]];
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/* ---------- les travailleurs : un niveau, une campagne, le duel joué ---------- */
if (!isMainThread) {
  const t = workerData;
  if (t.genre === 'niveau') {
    const meta = metaAuNiveau(t.niveau);
    const classeur = classeurSynthetique(meta, t.runsAvant, `classeur-${t.niveau}`);
    const out = [];
    for (let i = t.de; i < t.a; i++) {
      const r = jouerRun({ ...meta, deblocages: meta.deblocages.slice(), jalons: {} }, { classeur, graine: `niveau${t.niveau}-${i}` });
      out.push({ coupe: r.coupe, nSaisons: r.nSaisons, pts1: r.pts1, series1: r.series1, coupe1: !!r.saisons[0].coupe, depart: r.depart, valeurDepart: r.valeurDepart, s2: r.saisons[1] ? { valeur: r.saisons[1].valeur, mandat: r.saisons[1].mandat } : null });
    }
    parentPort.postMessage({ niveau: t.niveau, classeur: classeur.length, out });
  } else if (t.genre === 'main') {
    // LE DUEL JOUÉ (Jalon P0, puis V13-2) : la même première saison, sur les mêmes dés, le robot attentif qui répond aux
    // intentions (le geste, le tableau) puis qui les laisse là (`mains: false`). Avant la V13-2, c'était la main de
    // l'adjoint en séries, jouée ou non, sous le robot d'avant ; elle est partie, et le robot d'avant ne répond plus à rien.
    const out = [];
    for (let i = t.de; i < t.a; i++) {
      const jouer = mains => jouerRun(metaAuNiveau(0), { graine: `main-${i}`, maxSaisons: 1, mains, politique: 'attentif' }).saisons[0];
      const avec = jouer(true), sans = jouer(false);
      if (avec.rang <= 16) out.push({ rang: avec.rang, avec: avec.rondes, sans: sans.rondes });
    }
    parentPort.postMessage({ main: out });
  } else {
    // UNE CAMPAGNE : de zéro, les écussons et les jalons achètent les déblocages, run après run.
    const meta = { ecussons: 0, deblocages: [], jalons: {} };
    const classeur = new Map();
    let derniere = [], saisons = 0, premiere = null;
    const joues = new Map();
    const runs = [];
    for (let r = 0; r < t.runs; r++) {
      const niv = meta.deblocages.length;
      // Les exigences (tranche 8) : le robot monte au plus haut cran que ses Coupes ont ouvert.
      const res = jouerRun(meta, { classeur: [...classeur.values()], derniere, graine: `campagne${t.c}-run${r}`, jalons: true, joues, exigence: exigencesOuvertes(meta) });
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
  // Le calendrier se compte en JOURNÉES (JOURS_PAR_MATCH par match) : la mi-saison et le dernier soir aussi.
  const DERNIER = Math.round(82 * JOURS_PAR_MATCH) - 1;
  const e0 = echelleTardive({ jour: 0 }), e40 = echelleTardive({ jour: DERNIER / 2 }), e81 = echelleTardive({ jour: DERNIER });
  const eS = [0, 1, 2, 3].map(r => echelleTardive({ serie: true, ronde: r }));
  exiger('l\'échelle de la fin de partie : ×0,5 au premier soir, ×1 à la mi-saison, ×1,5 au dernier, ×2 en finale', e0 === 0.5 && Math.abs(e81 - 1.5) < 1e-9 && eS[3] === 2 && Math.abs(e40 - 1) < 0.01,
    `jour 1 ×${e0.toFixed(2)} · jour 41 ×${e40.toFixed(2)} · jour 82 ×${e81.toFixed(2)} · séries ${eS.map(x => `×${x.toFixed(2)}`).join(' ')}`);
  monte('elle ne redescend jamais, de la saison aux séries', [e0, e40, e81, ...eS]);
  // V10 (tranche 6) : les améliorations qui grandissaient avec la saison sont parties avec l'ancien jeu.
  {
    const fx1 = effetsDesCartes(null, { jouees: ['provoquer'] }, 'x');
    const fx2 = effetsDesCartes(null, { jouees: ['provoquer'] }, 'x', { echelle: 2 });
    const r = grandirEffet({ robustesse: 1.4, finition: 1.04, F: [1.3, 1, 0.9, 0.8] }, 2);
    // Sa valeur se lit sur la carte (U17 : les cartes de match sont plus franches, `FRANCHISE_MATCH`) : à ×2, son écart à 1 double.
    const d = CARTES_MATCH.provoquer.adv.discipline;
    exiger('une carte qui vise l\'adversaire grandit ; la robustesse (une somme) et les minutes suivent', fx1.adv[0].discipline === d && Math.abs(fx2.adv[0].discipline - (1 + 2 * (d - 1))) < 1e-9
      && Math.abs(r.robustesse - 2.8) < 1e-9 && Math.abs(r.finition - 1.08) < 1e-9 && Math.abs(r.F[0] - 1.6) < 1e-9, `« Les provoquer » : punitions +${Math.round((d - 1) * 100)} % → +${Math.round((fx2.adv[0].discipline - 1) * 100)} % en finale`);
  }
  {
    // Une carte de trio ne grandit pas, par construction : la même main à ×0,5 et à ×2 fait les mêmes effets pour toi.
    const a = effetsDesCartes(null, { jouees: ['gachettes', 'doublePresence', 'quatrieme'] }, 'x', { echelle: 0.5 }), b = effetsDesCartes(null, { jouees: ['gachettes', 'doublePresence', 'quatrieme'] }, 'x', { echelle: 2 });
    exiger('une carte de trio du deck ne grandit pas : ses effets sont les mêmes à ×0,5 et à ×2', JSON.stringify(a.effets) === JSON.stringify(b.effets), `${a.effets.length} effet(s)`);
  }
  // JALON P1 : une série gagnée donne un pack de joueurs, pas une carte.
  exiger('une série gagnée donne un pack de joueurs (Argent, Or, Étoiles, puis Légendes avec la Coupe)',
    PACKS_DE_SERIE.every(k => PACKS_TOUS[k] && PACKS_TOUS[k].sorte === 'joueurs'), PACKS_DE_SERIE.map(k => PACKS_TOUS[k].nom).join(' · '));
  {
    // 24 oct. (JP : *garder des joueurs de run en run devrait être fait dans une loto*) : des cases d'un niveau, plus de choix.
    const niveaux = [[], ['classeur1'], ['classeur1', 'classeur2', 'classeurTri'], ['classeur1', 'classeur2', 'classeur3', 'classeur4', 'classeurTri']];
    const D = niveaux.map(d => departDuClasseur({ deblocages: d }));
    const L = niveaux.map(d => lotosDeSaison({ deblocages: d })), R = niveaux.map(d => gardesDeLaRun({ deblocages: d }));
    const nom = cases => cases.map(k => NOMS_DE_NIVEAU[k].nom).join('+');
    exiger('le départ du classeur : une case Régulier sans rien, une case par page (Pilier, Étoile), cinq cartes par loto au tri',
      nom(D[0].cases) === 'Régulier' && D[0].vues === 3 && nom(D[1].cases) === 'Pilier+Régulier' && nom(D[2].cases) === 'Étoile+Pilier+Régulier' && D[2].vues === 5
      && nom(D[3].cases) === 'Étoile+Étoile+Pilier+Pilier+Régulier' && !('mode' in D[3]) && !DEBLOCAGES.classeurChoix,
      D.map(x => `${nom(x.cases)} (${x.vues})`).join(' · '));
    exiger('le joueur de concession et les exigences retirent des cases, par le haut', nom(departDuClasseur({ deblocages: niveaux[2], vedette: 'x' }).cases) === 'Pilier+Régulier'
      && nom(departDuClasseur({ deblocages: niveaux[2] }, 3).cases) === 'Pilier+Régulier' && nom(lotosDeSaison({ deblocages: niveaux[1] }, 3).cases) === 'Régulier+Régulier+Régulier',
      nom(departDuClasseur({ deblocages: niveaux[2], vedette: 'x' }).cases));
    exiger('entre deux saisons, trois lotos Régulier et un par page ; ceux qui restent : un Pilier et un Régulier, cinq au tri',
      nom(L[0].cases) === 'Régulier+Régulier+Régulier' && nom(L[2].cases) === 'Étoile+Pilier+Régulier+Régulier+Régulier' && nom(R[0].cases) === 'Pilier+Régulier' && nom(R[3].cases) === 'Pilier+Régulier' && R[0].vues === 3 && R[2].vues === 5,
      `${nom(L[2].cases)} · ${nom(R[2].cases)}`);
    const Gd = [[], ['garder1'], ['garder1', 'garder2'], ['garder1', 'garder2', 'garder3', 'classeurTri']].map(d => gardesDeLaDerniere({ deblocages: d }));
    exiger('de ta dernière équipe, un loto par case : Pilier, un deuxième Pilier, puis Étoile ; rien sans déblocage',
      nom(Gd[0].cases) === '' && nom(Gd[1].cases) === 'Pilier' && nom(Gd[2].cases) === 'Pilier+Pilier' && nom(Gd[3].cases) === 'Étoile+Pilier+Pilier' && Gd[3].vues === 5,
      Gd.map(x => nom(x.cases) || '—').join(' · '));
    const cartes = [{ niveau: 4, c: 'a' }, { niveau: 1, c: 'b' }, { niveau: 2, c: 'c' }, { niveau: 1, c: 'd' }, { niveau: -1, c: 'e' }, { niveau: 1, c: 'f' }, { niveau: 1, c: 'g' }];
    const l = k => lotoDeCase(cartes, k, 3);
    exiger('le loto d\'une case : son niveau dans l\'ordre du tirage, trois au plus ; la case Étoile prend les Phénomènes ; un niveau absent descend',
      l(1).cartes.map(x => x.c).join('') === 'bdf' && l(3).cartes.map(x => x.c).join('') === 'a' && l(2).cartes.map(x => x.c).join('') === 'c' && l(0).cartes.map(x => x.c).join('') === 'e'
      && lotoDeCase(cartes.filter(x => x.niveau < 3), 3, 3).niveau === 2 && !lotoDeCase([], 2, 3).cartes.length);
    const stockage = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => JSON.stringify({ deblocages: ['classeurTri', 'classeurChoix'], ecussons: 10, jalons: { coupe: true } }), setItem() {} };
    const vieux = lireMeta();
    globalThis.localStorage = stockage;
    exiger('un méta qui avait « Le classeur ouvert » le perd et reprend ses 280 médailles', vieux.ecussons === 290 && vieux.deblocages.join() === 'classeurTri'
      && JALONS.find(J => J.cle === 'coupe').recompense.deblocage === 'classeur4', `${vieux.ecussons} 🏅 · ${vieux.deblocages.join()}`);
    const cles = ['1985-86_EDM_1', '2001-02_DET_2', '1970-71_BOS_3', '2019-20_TBL_4'];
    const a = tirageDuClasseur(cles, 'g:3'), b = tirageDuClasseur(cles.slice().reverse(), 'g:3'), c = tirageDuClasseur(cles, 'g:4');
    exiger('le tirage du classeur est pur : la même graine donne le même ordre, quel que soit l\'ordre du cartable', a.join() === b.join() && a.length === 4, `${a.join(' ')} · une autre run : ${c.join(' ')}`);
    exiger('le budget du classeur : 25 M$ sans déblocage, le plafond débloqué le monte', budgetDuClasseur({ deblocages: [] }) === 25_000_000 && budgetDuClasseur({ deblocages: ['plafond1', 'plafond2'], ecussonsAVie: 0 }) === 32_000_000, '25 M$ · 32 M$');
    exiger('les cases de réserve de plus se débloquent une à une', reservesDeLaRun({ deblocages: [] }) === 0 && reservesDeLaRun({ deblocages: ['banc1'] }) === 1 && reservesDeLaRun({ deblocages: ['banc1', 'banc2'] }) === 2 && DEBLOCAGES.banc2.requis === 'banc1', '0 · 1 · 2');
    exiger('le barème d\'une run : 5 🪙 par victoire, 8 et 10 avec les commanditaires', baremeRogue({ deblocages: [] }).victoire === 5 && baremeRogue({ deblocages: ['commanditaire1'] }).victoire === 8 && baremeRogue({ deblocages: ['commanditaire1', 'commanditaire2'] }).victoire === 10, '5 · 8 · 10');
    // 1.0 (J1-C) : la prime de série se verse — `resultatsRogue` (js/game.js) renvoie enfin `series`, que `jetonsDe` lit.
    exiger('la prime de série : trois rondes gagnées valent 3 × 40 🪙, et rien sans ronde', jetonsDe({ series: 3 }, 0, 40, JETONS) === 40 + 3 * JETONS.serie && jetonsDe({}, 0, 40, JETONS) === 40 && JETONS.serie === 40,
      `${jetonsDe({ series: 3 }, 0, 40, JETONS)} 🪙 avec trois rondes, ${jetonsDe({}, 0, 40, JETONS)} sans`);
    // 1.0 (J1-B) : un achat s'enregistre AVANT le butin — un ballottage de pack porte le palier `k:n:signe`, jamais l'achat lui-même,
    // donc le numéro d'achat suivant ne bouge pas et la dépense est comptée même sans signature.
    const achats = [{ jour: 3, palier: 'k:0', achat: { pack: 'j:hasard_bronze', n: 0, prix: 12, sorte: 'joueurs' } }, { jour: 3, palier: 'k:0:signe', ballottage: { i: 20, entre: 'x', sort: null } }];
    exiger('un pack acheté puis signé fait UNE dépense et UN numéro d\'achat', achats.filter(d => d.achat).length === 1 && jetonsDe({}, achats.reduce((a, d) => a + ((d.achat || {}).prix || 0), 0), 40, JETONS) === 28, '40 − 12 = 28 🪙');
  }
  /*
   * V2.3 — LES COACHS, AU PRESTIGE : trois coachs au Club de garage, un de plus par rang, les huit à la Dynastie. V21 : le
   * coach est le personnage de la run ; le personnel imposé au départ est parti avec le personnel.
   */
  {
    const n = PRESTIGES.map((_, r) => coachsOuverts(r).length);
    exiger('les coachs ouverts : trois au départ, un de plus par rang, les huit voies à la Dynastie', n[0] === 3 && n.every((x, i) => i === 0 || x > n[i - 1]) && n[n.length - 1] === VOIES.length && VOIES.every(k => POUVOIRS[k]), n.join(' · '));
  }
  // V5 : le mandat se lit au classement (un rang qui monte), plus une série gagnée.
  const seuils = MANDATS.map(m => rangDuMandat(m, 32));
  exiger('le mandat du proprio monte de saison en saison', seuils[0] == null && seuils.slice(1).every((s, i) => i === 0 || s < seuils[i]) && mandatDe(9) === MANDATS[MANDATS.length - 1]
    && mandatRempli(1, { series: true, rang: 16 }) && !mandatRempli(2, { series: true, rang: 11 }) && mandatRempli(2, { series: true, rang: 10 }) && !mandatRempli(1, { series: false }) && mandatRempli(4, { series: true, rang: 3 }) && !mandatRempli(9, { series: true, rang: 4 }),
    MANDATS.map((m, i) => `saison ${i + 1}${i === MANDATS.length - 1 ? '+' : ''} : ${m.mot}`).join(' · '));
  {
    const m = { deblocages: [], jalons: {} };
    const a = jalonsAtteints(m, { series: true, rondes: 1, pts: 101, saisonDeLaRun: 1 }).map(J => J.cle);
    const offert = recompenseDe(m, JALONS.find(J => J.cle === 'series'));
    const deja = recompenseDe({ deblocages: ['classeur1'] }, JALONS.find(J => J.cle === 'series'));
    exiger('les jalons se lisent dans les résultats, et offrent un déblocage ou des écussons', a.join() === 'series,ronde,cent' && offert.deblocage === 'classeur1' && deja.ecussons === 30
      && JALONS.every(J => !J.recompense.deblocage || DEBLOCAGES[J.recompense.deblocage]), `${JALONS.length} jalons · ${a.join(', ')}`);
  }

  /*
   * LES EXIGENCES (V9, tranche 8) : neutres au cran 0 ; chaque cran ajoute la sienne, par son canal, à celles d'avant,
   * et paie PRIME_EXIGENCE de médailles de plus ; aucune avant la première Coupe, puis un cran de plus que le plus haut
   * gagné ; le plafond n'en descend jamais sous la masse ; le texte d'un cran dit ses vrais chiffres.
   */
  {
    const m0 = { deblocages: [] }, z = exigencesDe(0);
    const neutre = z.espace === 0 && z.prixPacks === 1 && z.medailles === 1 && plafondDeSaison(60e6, m0, 0) === 64e6 && baremeRogue(m0, 0).victoire === baremeRogue(m0).victoire
      && mandatDe(1, 0) === MANDATS[0] && soutiensDuDepart(0, 1, 0) === soutiensDuDepart(0, 1) && departDuClasseur(m0, 0).n === departDuClasseur(m0).n && gardesDeLaRun(m0, 0).cases.length === GARDES_DE_SAISON.length;
    exiger('au cran 0, les exigences ne changent rien', neutre);
    const canaux = ['espace', 'prixPacks', 'classeur', 'soutiens', 'victoire', 'mandat', 'gardes'];
    const fautes = [];
    EXIGENCES.forEach((E, i) => {
      const avant = exigencesDe(i), apres = exigencesDe(i + 1);
      const changes = canaux.filter(c => apres[c] !== avant[c]);
      if (changes.length !== 1 || (E[changes[0]] || 0) === 0) fautes.push(`${E.nom} : ${changes.join(', ') || 'rien'}`);
      if (Math.abs(apres.medailles - (1 + PRIME_EXIGENCE * (i + 1))) > 1e-9) fautes.push(`${E.nom} : médailles`);
      const chiffre = E.espace ? Math.abs(E.espace) / 1e6 : E.prixPacks ? Math.round(E.prixPacks * 100) : Math.abs(E.soutiens || E.victoire || 0);
      if (chiffre && !new RegExp(`\\b${chiffre}\\b`).test(E.texte)) fautes.push(`${E.nom} : le texte ne dit pas ${chiffre}`);
    });
    exiger('chaque cran d\'exigence change un seul canal, s\'ajoute aux précédents et paie plus de médailles', !fautes.length, fautes.join(' · ') || EXIGENCES.map(E => E.nom).join(' · '));
    const n = EXIGENCES.length, X = exigencesDe(n);
    const tout = plafondDeSaison(60e6, m0, n) === 60e6 && plafondDeSaison(60e6, { deblocages: ['plafond1', 'plafond2'] }, n) === 60e6 + ESPACE_DE_DEPART + 7e6 + X.espace
      && plafondDeSaison(60e6, m0, 1) === 60e6 + ESPACE_DE_DEPART + EXIGENCES[0].espace && mandatDe(1, n) === MANDATS[1] && soutiensDuDepart(4, 1, n) === soutiensDuDepart(4, 1) + 3 && departDuClasseur(m0, n).n === 0
      && baremeRogue(m0, n).victoire === baremeRogue(m0).victoire - 2 && gardesDeLaRun(m0, n).cases.length === GARDES_DE_SAISON.length - 1;
    exiger('au plus haut cran, chaque canal mord (et le plafond jamais sous la masse)', tout,
      `plafond ${plafondDeSaison(60e6, m0, n) / 1e6} M$ pour 60 M$ · mandat de la 1re saison : ${mandatDe(1, n).mot} · ${baremeRogue(m0, n).victoire} 🪙 par victoire · ${gardesDeLaRun(m0, n).cases.length} case(s) de gardés · médailles ×${String(X.medailles).replace('.', ',')}`);
    const o = [exigencesOuvertes({}), exigencesOuvertes({ coupes: 1 }), exigencesOuvertes({ coupes: 4, exigence: 2 }), exigencesOuvertes({ coupes: 40, exigence: 99 })];
    exiger('les exigences s\'ouvrent à la première Coupe, puis un cran par Coupe gagnée au plus haut', o.join() === `0,1,3,${n}`, o.join(' · '));
  }

  /*
   * LA LIGUE QUI MONTE (V9, tranche 8 ; JP : *les clubs des premières runs sont globalement plus faibles et montent*) :
   * les premiers niveaux prennent les plus faibles d'un tirage plus large ; ensuite, chaque niveau monte d'une édition
   * un tiers de plus de chaque club, ses meilleurs d'abord, jusqu'à la Holo ; un cran d'exigence vaut ETAPES_PAR_CRAN
   * niveaux ; une ligue de niveau 0 n'a aucune carte.
   */
  {
    const n = 23, ordre = EDITIONS;
    const rangs = etape => Array.from({ length: n }, (_, r) => ordre.indexOf(editionDansLaLigue(etape, r, n)));
    const somme = etape => rangs(etape).reduce((a, x) => a + x, 0);
    const fautes = [];
    for (let e = 0; e < 13; e++) {
      const r = rangs(e);
      if (r.some((x, i) => i > 0 && x > r[i - 1])) fautes.push(`étape ${e} : un moins bon joueur a une meilleure carte`);
      if (e > 0 && somme(e) <= somme(e - 1) && somme(e - 1) < (ordre.length - 1) * n) fautes.push(`étape ${e} : rien ne monte`);
    }
    const etapes = [0, 1, 2, 3].map(L => ligueDe(L).etape);
    exiger('la ligue : toute l\'histoire sans édition aux premiers niveaux, puis chaque niveau monte d\'une édition un tiers de chaque club',
      !fautes.length && etapes[0] === 0 && etapes[1] === 0 && etapes[2] === 0 && etapes[3] === 1
      && somme(0) === 0 && rangs(30).every(x => x === ordre.length - 1) && Math.abs(somme(3) - n) <= 1,
      fautes.join(' · ') || `étapes ${etapes.join(' · ')} · éditions à l'étape 3 : ${somme(3)} crans pour ${n} joueurs`);
    exiger('un cran d\'exigence monte la ligue de ETAPES_PAR_CRAN niveaux, le prestige d\'un', niveauDeLigue(2, 0) === 2 && niveauDeLigue(4, 3) === 4 + 3 * ETAPES_PAR_CRAN && niveauDeLigue(0, 0) === 0,
      `Dynastie, cran 3 : niveau ${niveauDeLigue(4, 3)}`);
    // La deuxième run est plus dure (31 oct.) : une étape de plus dès la deuxième, la même à la dixième — une marche, pas une pente.
    exiger('la première run joue sa ligue nue ; dès la deuxième, une étape d\'édition de plus, la même à toutes les suivantes',
      etapeDeLaRun(1) === 0 && etapeDeLaRun(2) === ETAPE_APRES_LA_PREMIERE && etapeDeLaRun(10) === ETAPE_APRES_LA_PREMIERE && ligueDe(0, etapeDeLaRun(2)).etape === ETAPE_APRES_LA_PREMIERE && ligueDe(3, etapeDeLaRun(2)).etape === 1 + ETAPE_APRES_LA_PREMIERE,
      `run 2 au niveau 0 : étape ${ligueDe(0, etapeDeLaRun(2)).etape}`);
    const club = { roster: Object.fromEntries(Array.from({ length: n }, (_, i) => [i, { n: `j${i}`, v: n - i, _carte: { rar: 'rare' } }])) };
    habillerLaLigue([club], 0, p => p.v);
    const nu = Object.values(club.roster).every(p => !p._carte);
    habillerLaLigue([club], 6, p => p.v);
    const habille = Object.values(club.roster).filter(p => p._carte).length;
    exiger('une ligue de niveau 0 n\'a aucune carte ; plus haut, ses clubs en portent', nu && habille === n, `${habille} cartes sur ${n} au niveau 6`);
  }

  /* ---------- 2, 2b, 3 : les runs, le duel joué et les campagnes, en parallèle ---------- */
  const taches = [];
  for (const [niveau, runsAvant] of NIVEAUX) for (let de = 0; de < RUNS; de += Math.ceil(RUNS / 2)) taches.push({ genre: 'niveau', niveau, runsAvant, de, a: Math.min(RUNS, de + Math.ceil(RUNS / 2)) });
  for (let c = 0; c < CAMPAGNES; c++) taches.push({ genre: 'campagne', c, runs: RUNS_CAMPAGNE });
  for (let de = 0; de < SAISONS_MAIN; de += Math.ceil(SAISONS_MAIN / 2)) taches.push({ genre: 'main', de, a: Math.min(SAISONS_MAIN, de + Math.ceil(SAISONS_MAIN / 2)) });
  /*
   * Au plus FILS travailleurs à la fois (6 par défaut) : à RUNS=40 CAMPAGNES=6,
   * les dix-neuf d'un coup tenaient 8,6 Go et la machine a manqué de mémoire.
   * Les campagnes, les plus longues, partent d'abord ; chaque résultat garde
   * sa place, donc le rapport ne change pas.
   */
  const FILS = Math.max(1, Number(process.env.FILS) || Math.min(6, availableParallelism() - 1));
  const resultats = new Array(taches.length);
  const ordre = taches.map((t, k) => k).sort((a, b) => (taches[b].genre === 'campagne') - (taches[a].genre === 'campagne'));
  let suivante = 0;
  await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, async () => {
    while (suivante < ordre.length) { const k = ordre[suivante++]; resultats[k] = await lancer(taches[k]); }
  }));

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
      pts1: moy(out.map(o => o.pts1)), series1: moy(out.map(o => o.series1)), depart: moy(out.map(o => o.depart)), valeurDepart: moy(out.map(o => o.valeurDepart)), s2: out.filter(o => o.s2).map(o => o.s2), n: out.length };
    lignes.push(L);
    informer(`${niveau} déblocages · ${L.cout} 🏅`, `Coupe par run ${pct(L.coupe)} · dès la 1re saison ${pct(L.coupe1)} · ${L.saisons.toFixed(2).replace('.', ',')} saisons par run · 1re saison ${L.pts1.toFixed(0)} pts, séries ${pct(L.series1)} · ${L.depart.toFixed(1).replace('.', ',')} carte(s) du classeur au départ, valeur ${L.valeurDepart.toFixed(1).replace('.', ',')} (${L.classeur} au classeur) · saison 2 : ${L.s2.length} runs, l'équipe vaut ${moy(L.s2.map(x => x.valeur)).toFixed(2).replace('.', ',')} en moyenne, mandat tenu ${pct(moy(L.s2.map(x => x.mandat)))} · ${L.n} runs`);
  }
  monte('la première saison monte avec les déblocages (points, à 4 près)', lignes.map(l => l.pts1), 4);
  // Mesuré à soixante runs : 2 % par run, 0 % dès la première saison. Les bornes laissent une Coupe sur dix runs (le mode rapide).
  borne('sans aucun déblocage, la Coupe par run est rare', lignes[0].coupe, 0, 0.1);
  borne('sans aucun déblocage, la Coupe dès la première saison : presque jamais', lignes[0].coupe1, 0, 0.1);
  exiger('tout débloqué, la Coupe se gagne bien plus souvent qu\'au départ', lignes[lignes.length - 1].coupe >= lignes[0].coupe + 0.1, `${pct(lignes[0].coupe)} → ${pct(lignes[lignes.length - 1].coupe)}`);

  /*
   * 2b. LE DUEL JOUÉ (Jalon P0, puis V13-2). Mesuré le 12 oct., la main de l'adjoint en séries : 1,00 ronde sans,
   * 1,24 avec, à 270 premières saisons. Sans main (V13-2), ce qui se lit ici, c'est ce que vaut le duel bien joué
   * (l'attentif) contre le duel laissé là, sur la même première saison. Les rangs diffèrent d'un bras à l'autre (les
   * duels de saison comptent aussi) : on garde les saisons où le duel joué se qualifie.
   */
  {
    const q = resultats.filter(x => x.main).flatMap(x => x.main);
    const finale = k => pct(moy(q.map(o => (o[k] >= 3 ? 1 : 0))));
    informer('le duel joué, la même première saison sur les mêmes dés', q.length
      ? `${q.length} saisons qualifiées sur ${SAISONS_MAIN} · rondes gagnées ${moy(q.map(o => o.sans)).toFixed(2).replace('.', ',')} le duel laissé, ${moy(q.map(o => o.avec)).toFixed(2).replace('.', ',')} joué · finale ${finale('sans')} laissé, ${finale('avec')} joué`
      : `aucune saison qualifiée sur ${SAISONS_MAIN}`);
  }

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

  /*
   * 4. LA FORCE DES CARTES SELON LE MOMENT (S80) n'est plus mesurée. Elle jouait le même gros match au jour 3, au jour
   * 75 et en finale avec trois bras : des améliorations (« Le tir affûté », « Le mur »), des cartes de trio du deck
   * (« Les gâchettes »…) et des cartes sur l'adversaire (« Les provoquer »…), et jugeait JP (*les upgrade de trio
   * aident au début, mais les downgrade upgrade sont plus forts late game*) : une carte sur l'adversaire vaut deux fois
   * plus en finale qu'au jour 3, et y bat une carte de trio. Les améliorations qui grandissent sont parties à la V10
   * (`MUTATIONS` n'en a plus aucune de `source: 'amelioration'` : le bras appliquait une modif qui n'existe plus) ; les
   * deux autres bras se jouaient de la MAIN du duel, partie à la V13-2 (`simulerGrosMatch` d'une équipe `courbe` ne lit
   * plus ses `cartes`). Les trois rendaient zéro à chaque moment : rien, dans le duel du Rogue, ne grandit plus avec le
   * soir. L'échelle elle-même reste jugée plus haut (1.), sur `echelleTardive`, `grandirEffet` et `effetsDesCartes`.
   */
  informer('le temps', `${((Date.now() - t0) / 1000).toFixed(0)} s (${RUNS} runs par niveau, ${CAMPAGNES} campagne(s) de ${RUNS_CAMPAGNE} runs, ${SAISONS_MAIN} saisons pour le duel joué)`);
  verdict();
}
