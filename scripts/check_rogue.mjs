/**
 * LE ROGUE (S80 ; réécrit à la V27, tranche 2) — le départ du classeur, les exigences, la ligue, et la run en actes.
 *
 * JP : *le classeur, on peut piger x cartes aux départ, ou random, selon upgrades* ; puis, le 7 nov. 2026 : *première
 * Cup à rendre pas mal plus tough* ; *il faut vraiment bloquer le snowball* ; *Passer à 2 ❤️*. La run est maintenant
 * UNE saison en quatre actes (docs/refonte-v27.md § 4.1 à 4.3, docs/refonte-v27-2.md) : ses blocs « deuxième saison »,
 * « mandat » et « gardés » sont partis avec la deuxième saison.
 *
 *   node scripts/check_rogue.mjs            (rapide : 2 runs de l'attentif, une minute)
 *   RUNS=8 node scripts/check_rogue.mjs     (plus de graines ; la profondeur, elle, est check_profondeur en CI)
 *
 * Deux parties :
 *   1. LES INVARIANTS, sans moteur : les cases de réserve de plus, l'échelle de la fin de partie, le départ du classeur
 *      (pur, un nombre par niveau), la bande du départ, les jalons, les exigences et leurs leviers neufs (les contrôles,
 *      les rivaux, les séries), la ligue qui monte ; les règles des actes (js/actes.js) : les contrôles proportionnels à
 *      la ligue, le rang du soir aux bris d'égalité de l'écran, un cœur par contrôle raté, la run morte à 0 ❤️ ;
 *   2. LA RUN EN ACTES, jouée par le robot de la profondeur (scripts/lib/rogue_actes.mjs) sur RUNS graines, un fil
 *      chacune : un rival par acte au bon rang de force, jamais manquant, posé au dernier match de l'acte ; 82 matchs
 *      à chaque club et un par jour après les échanges ; les cœurs recomptés.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import {
  SLOTS, CASES_DE_BASE, RESERVES_EN_PLUS, casesDuMode, autoRoster, activeLineup, createTeam, getPersonKey,
  echelleTardive, grandirEffet, JOURS_PAR_MATCH,
} from '../js/sim.js';
import {
  DEBLOCAGES, departDuClasseur, gardesDeLaDerniere, lotoDeCase, lireMeta, budgetDuClasseur, reservesDeLaRun, tirageDuClasseur,
  JALONS, jalonsAtteints, recompenseDe, baremeRogue, JETONS, jetonsDe, PRESTIGES, coachsOuverts, exigencesOuvertes,
  EXIGENCES, PRIME_EXIGENCE, exigencesDe, plafondDeSaison, ESPACE_DE_DEPART, soutiensDuDepart, bouchesTrousDuDepart, BANDE_DEPART,
  ligueDe, niveauDeLigue, editionDansLaLigue, habillerLaLigue, ETAPES_PAR_CRAN, ecussonsDesSeries,
} from '../js/rogue.js';
import { ACTES, COEURS, CONTROLES, RANGS_DES_RIVAUX, ETAPE_SERIES, controleDeLActe, etapeDesSeries, rangAuSoir, etatDeLaRun, parmiLesAdversaires,
  NOEUDS_BOUTIQUE, ACHATS_PAR_NOEUD, PRIX_PIECE, noeudOuvert, prochainNoeud, prixDeLaPiece, estUnAchat, piecesDuNoeud, renfortDe } from '../js/actes.js';
import { EDITIONS } from '../js/rarete.js';
import { NIVEAUX as NOMS_DE_NIVEAU } from '../js/niveaux.js';
import { PIECES, PIECE_DU_COACH } from '../js/pieces.js';
import { VOIES } from '../js/coachs.js';
import { PACKS_TOUS, PACKS_DE_SERIE } from '../js/packs.js';
import { shard, groupe } from './lib/rogue_sim.mjs';
import { exiger, monte, informer, verdict } from './verdict.mjs';
import '../js/greffes.js';   // V25 : les greffes du Rogue se branchent sur le moteur

const RUNS = Number(process.env.RUNS ?? 2);

/* ---------- le travailleur : une run en actes de l'attentif ---------- */
if (!isMainThread) {
  const { jouerLaRun } = await import('./lib/rogue_actes.mjs');
  parentPort.postMessage(jouerLaRun('attentif', `rogue-${workerData.i}`));
} else {
  const lancer = data => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: data, resourceLimits: { maxOldGenerationSizeMb: 2048 } });
    w.once('message', resolve); w.once('error', reject);
  });
  const t0 = Date.now();
  console.log('\n  Le Rogue (V27) : le départ, les exigences, la ligue, la run en actes\n');

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
  // V10 (tranche 6) : les améliorations qui grandissaient avec la saison sont parties avec l'ancien jeu ; V25 : les cartes de match aussi.
  {
    const r = grandirEffet({ robustesse: 1.4, finition: 1.04, F: [1.3, 1, 0.9, 0.8] }, 2);
    exiger('un effet qui vise l\'adversaire grandit ; la robustesse (une somme) et les minutes suivent',
      Math.abs(r.robustesse - 2.8) < 1e-9 && Math.abs(r.finition - 1.08) < 1e-9 && Math.abs(r.F[0] - 1.6) < 1e-9, `×2 : robustesse ${r.robustesse}, finition ${r.finition}, F ${r.F.join('/')}`);
  }
  // JALON P1 : une série gagnée donne un pack de joueurs, pas une carte.
  exiger('une série gagnée donne un pack de joueurs (Argent, Or, Étoiles, puis Légendes avec la Coupe)',
    PACKS_DE_SERIE.every(k => PACKS_TOUS[k] && PACKS_TOUS[k].sorte === 'joueurs'), PACKS_DE_SERIE.map(k => PACKS_TOUS[k].nom).join(' · '));
  {
    // 24 oct. (JP : *garder des joueurs de run en run devrait être fait dans une loto*) : des cases d'un niveau, plus de choix.
    const niveaux = [[], ['classeur1'], ['classeur1', 'classeur2', 'classeurTri'], ['classeur1', 'classeur2', 'classeur3', 'classeur4', 'classeurTri']];
    const D = niveaux.map(d => departDuClasseur({ deblocages: d }));
    const nom = cases => cases.map(k => NOMS_DE_NIVEAU[k].nom).join('+');
    exiger('le départ du classeur : une case Régulier sans rien, une case par page (Pilier, Étoile), cinq cartes par loto au tri',
      nom(D[0].cases) === 'Régulier' && D[0].vues === 3 && nom(D[1].cases) === 'Pilier+Régulier' && nom(D[2].cases) === 'Étoile+Pilier+Régulier' && D[2].vues === 5
      && nom(D[3].cases) === 'Étoile+Étoile+Pilier+Pilier+Régulier' && !('mode' in D[3]) && !DEBLOCAGES.classeurChoix,
      D.map(x => `${nom(x.cases)} (${x.vues})`).join(' · '));
    exiger('le joueur de concession et les exigences retirent des cases, par le haut', nom(departDuClasseur({ deblocages: niveaux[2], vedette: 'x' }).cases) === 'Pilier+Régulier'
      && nom(departDuClasseur({ deblocages: niveaux[2] }, 3).cases) === 'Pilier+Régulier',
      nom(departDuClasseur({ deblocages: niveaux[2], vedette: 'x' }).cases));
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
    // V25 B1 : les remboursements des déblocages partis (`PARTIS`) ont fait leur temps ; un déblocage inconnu s'efface, sans rien rendre.
    exiger('un méta qui avait un déblocage parti le perd, sans rien reprendre', vieux.ecussons === 10 && vieux.deblocages.join() === 'classeurTri'
      && JALONS.find(J => J.cle === 'coupe').recompense.deblocage === 'classeur4', `${vieux.ecussons} 🏅 · ${vieux.deblocages.join()}`);
    const cles = ['1985-86_EDM_1', '2001-02_DET_2', '1970-71_BOS_3', '2019-20_TBL_4'];
    const a = tirageDuClasseur(cles, 'g:3'), b = tirageDuClasseur(cles.slice().reverse(), 'g:3'), c = tirageDuClasseur(cles, 'g:4');
    exiger('le tirage du classeur est pur : la même graine donne le même ordre, quel que soit l\'ordre du cartable', a.join() === b.join() && a.length === 4, `${a.join(' ')} · une autre run : ${c.join(' ')}`);
    exiger('le budget du classeur : 25 M$ sans déblocage, le plafond débloqué le monte', budgetDuClasseur({ deblocages: [] }) === 25_000_000 && budgetDuClasseur({ deblocages: ['plafond1', 'plafond2'], ecussonsAVie: 0 }) === 32_000_000, '25 M$ · 32 M$');
    exiger('les cases de réserve de plus se débloquent une à une', reservesDeLaRun({ deblocages: [] }) === 0 && reservesDeLaRun({ deblocages: ['banc1'] }) === 1 && reservesDeLaRun({ deblocages: ['banc1', 'banc2'] }) === 2 && DEBLOCAGES.banc2.requis === 'banc1', '0 · 1 · 2');
    exiger('le barème d\'une run : 5 🪙 par victoire, 8 et 10 avec les commanditaires', baremeRogue({ deblocages: [] }).victoire === 5 && baremeRogue({ deblocages: ['commanditaire1'] }).victoire === 8 && baremeRogue({ deblocages: ['commanditaire1', 'commanditaire2'] }).victoire === 10, '5 · 8 · 10');
    // V27, tranche 3 : la prime de série est en médailles (20 🏅 la ronde, `ecussonsDesSeries`) ; en séries, la boutique est fermée.
    exiger('la prime de série : en médailles (20 🏅 la ronde, 40 de plus pour la Coupe), plus en jetons', jetonsDe({ series: 3 }, 0, 40, JETONS) === 40 && !('serie' in JETONS) && ecussonsDesSeries(3, false) === 60 && ecussonsDesSeries(4, true) === 120,
      `${jetonsDe({ series: 3 }, 0, 40, JETONS)} 🪙 avec trois rondes · ${ecussonsDesSeries(3, false)} 🏅`);
    /*
     * LA BOUTIQUE À SES NŒUDS (V27, tranche 3 ; docs/refonte-v27-3.md) : sept nœuds, ouverts jusqu'à ton match suivant ; le prix
     * remis à zéro à chaque nœud ; quatre achats au plus, la pièce comprise ; la pièce à 32 🪙, puis à la hausse des packs ; trois
     * pièces tirées de la graine, les mêmes pour la même graine ; ton club et l'ouverture d'un pack scellé ne comptent pas.
     */
    exiger('la boutique n\'ouvre qu\'à ses sept nœuds', NOEUDS_BOUTIQUE.join() === '0,14,27,41,54,68,82' && [0, 14, 27, 41, 54, 68, 82].every(k => noeudOuvert(k) === k) && [1, 13, 15, 40, 81, 83].every(k => noeudOuvert(k) === null)
      && prochainNoeud(33) === 41 && prochainNoeud(0) === 14 && prochainNoeud(82) === null, `ouverte à ${NOEUDS_BOUTIQUE.join(' · ')} ; après le 33e, la prochaine au ${prochainNoeud(33)}e`);
    exiger('le prix repart de zéro au nœud : la pièce 32 🪙 en premier, 45 après un pack', PRIX_PIECE === 32 && prixDeLaPiece(0) === 32 && prixDeLaPiece(1) === 45 && ACHATS_PAR_NOEUD === 4,
      `${prixDeLaPiece(0)} · ${prixDeLaPiece(1)} · ${prixDeLaPiece(2)} · ${prixDeLaPiece(3)} 🪙 · ${ACHATS_PAR_NOEUD} achats au plus`);
    exiger('un achat de nœud : un pack payé ou la pièce ; ton club et l\'ouverture d\'un scellé, non', estUnAchat({ achat: { sorte: 'joueurs', prix: 14 } }) && estUnAchat({ achat: { sorte: 'piece', prix: 32 } })
      && !estUnAchat({ achat: { sorte: 'club', prix: 15 } }) && !estUnAchat({ achat: { sorte: 'joueurs', prix: 0, de: 'k:0' } }), 'pack · pièce · ni club ni scellé');
    // V27, tranche 5 : trois pièces de banc (js/pieces.js), jamais une déjà sur ton banc.
    const P0 = { cle: 'tortue', banc: ['verrou'] }, o1 = piecesDuNoeud(P0, 'g', 41), o2 = piecesDuNoeud(P0, 'g', 41), o3 = piecesDuNoeud(P0, 'g', 54);
    exiger('trois pièces par nœud, pures, jamais une déjà sur ton banc, une autre offre au nœud suivant', o1.length === 3 && JSON.stringify(o1) === JSON.stringify(o2) && JSON.stringify(o1) !== JSON.stringify(o3) && o1.every(k => PIECES[k] && k !== 'verrou'),
      o1.join(' · '));
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
    exiger('les coachs ouverts : trois au départ, un de plus par rang, les huit voies à la Dynastie', n[0] === 3 && n.every((x, i) => i === 0 || x > n[i - 1]) && n[n.length - 1] === VOIES.length && VOIES.every(k => PIECE_DU_COACH[k]), n.join(' · '));
  }
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
      && soutiensDuDepart(0, 1, 0) === soutiensDuDepart(0, 1) && departDuClasseur(m0, 0).n === departDuClasseur(m0).n && z.controles === 0 && z.rivaux === 0 && z.series === 0;
    exiger('au cran 0, les exigences ne changent rien', neutre);
    const canaux = ['espace', 'prixPacks', 'classeur', 'soutiens', 'victoire', 'controles', 'rivaux', 'series'];
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
    const tout = plafondDeSaison(60e6, m0, n) === Math.max(60e6, 60e6 + ESPACE_DE_DEPART + X.espace) && plafondDeSaison(60e6, { deblocages: ['plafond1', 'plafond2'] }, n) === 60e6 + ESPACE_DE_DEPART + 7e6 + X.espace
      && plafondDeSaison(60e6, m0, 1) === 60e6 + ESPACE_DE_DEPART + EXIGENCES[0].espace && soutiensDuDepart(4, 1, n) === soutiensDuDepart(4, 1) + 3 && departDuClasseur(m0, n).n === 0
      && baremeRogue(m0, n).victoire === baremeRogue(m0).victoire - 2 && X.controles === -2 && X.rivaux === 1 && X.series === 1;
    exiger('au plus haut cran, chaque canal mord (et le plafond jamais sous la masse)', tout,
      `plafond ${plafondDeSaison(60e6, m0, n) / 1e6} M$ pour 60 M$ · ${baremeRogue(m0, n).victoire} 🪙 par victoire · contrôles ${X.controles} · rivaux +${X.rivaux} · séries +${X.series} · médailles ×${String(X.medailles).replace('.', ',')}`);
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
    const club = { roster: Object.fromEntries(Array.from({ length: n }, (_, i) => [i, { n: `j${i}`, v: n - i, _carte: { rar: 'rare' } }])) };
    habillerLaLigue([club], 0, p => p.v);
    const nu = Object.values(club.roster).every(p => !p._carte);
    habillerLaLigue([club], 6, p => p.v);
    const habille = Object.values(club.roster).filter(p => p._carte).length;
    exiger('une ligue de niveau 0 n\'a aucune carte ; plus haut, ses clubs en portent', nu && habille === n, `${habille} cartes sur ${n} au niveau 6`);
  }

  /*
   * LES RÈGLES DES ACTES (V27, js/actes.js), sans moteur : les contrôles et les rivaux suivent la taille de la ligue ; le
   * rang du soir est celui de l'écran Classement (les points, les victoires, le différentiel, les buts, puis le club) ;
   * un cœur part par contrôle raté, la run meurt à 0 ❤️, et l'acte III n'en coûte aucun.
   */
  {
    exiger('les actes, les cœurs et les contrôles du devis', ACTES.join() === '27,54,82' && COEURS === 2 && CONTROLES.join() === '20,15' && RANGS_DES_RIVAUX.join() === '7,3,0' && ETAPE_SERIES === 4,
      `actes ${ACTES.join(' · ')} · ${COEURS} ❤️ · contrôles ${CONTROLES.join(' · ')} · rivaux ${RANGS_DES_RIVAUX.map(r => r + 1).join(' · ')} · séries +${ETAPE_SERIES}`);
    exiger('les contrôles et les rivaux suivent la taille de la ligue', controleDeLActe(0, 32) === 20 && controleDeLActe(1, 32) === 15 && controleDeLActe(0, 24) === 15 && controleDeLActe(1, 24) === 11
      && parmiLesAdversaires(7, 32) === 7 && parmiLesAdversaires(7, 24) === 5, `ligue de 24 : ${controleDeLActe(0, 24)} · ${controleDeLActe(1, 24)}`);
    const n = EXIGENCES.length;
    exiger('les exigences serrent les contrôles, montent les rivaux et durcissent les séries', controleDeLActe(0, 32, n) === 18 && controleDeLActe(1, 32, n) === 13 && etapeDesSeries(n) === ETAPE_SERIES + 1 && etapeDesSeries(0) === ETAPE_SERIES,
      `au cran ${n} : ${controleDeLActe(0, 32, n)} · ${controleDeLActe(1, 32, n)} · séries +${etapeDesSeries(n)}`);
    // Une ligue de quatre clubs sur une cédule écrite à la main : le rang du soir, ses bris d'égalité.
    const T = ['A', 'B', 'C', 'D'].map(tag => ({ tag, season: '2000-01' })), [a, b, c, d] = T;
    const m = (A, B, gfA, gfB, ot = false) => ({ A, B, gfA, gfB, ot, joue: true });
    const cal = [[m(a, b, 3, 1), m(c, d, 2, 1, true)], [m(a, c, 1, 2), m(b, d, 4, 0)], [m(a, d, 0, 0), m(b, c, 0, 0)]];
    cal[2] = [{ A: a, B: d }, { A: b, B: c }];
    const rangs = T.map(t => rangAuSoir(cal, T, t, 1));
    // Après deux soirs : A 2 pts (1 V, +1), B 2 pts (1 V, +2), C 4 pts, D 1 pt (DP) → C, B, A, D.
    exiger('le rang du soir est celui de l\'écran : les points, les victoires, le différentiel', rangs.join() === '3,2,1,4', `A ${rangs[0]}e · B ${rangs[1]}e · C ${rangs[2]}e · D ${rangs[3]}e`);
    // Les cœurs : un rival par soir ; à 4 clubs, les contrôles valent 3 et 2 (arrondi(20 × 4 / 32), arrondi(15 × 4 / 32)).
    const rivaux = [{ acte: 0, jour: 0, adv: b }, { acte: 1, jour: 1, adv: c }];
    const E = etatDeLaRun({ calendrier: cal, teams: T, you: a, rivaux, jour: 2 });
    exiger('un contrôle raté coûte un cœur ; deux, la run', E.actes.length === 2 && E.actes[0].tenu === true && E.actes[1].tenu === false && E.coeurs === 1 && !E.mort
      && etatDeLaRun({ calendrier: cal, teams: T, you: d, rivaux, jour: 2, exigence: EXIGENCES.length }).mort,
      `A : ${E.actes.map(x => `${x.rang}e / ${x.cible} ${x.tenu ? '✓' : '✗'}`).join(' · ')} · ${E.coeurs} ❤️`);
    // LE RENFORT (tranche 4, devis § 4.4), l'exemple fait à la main : Boston contre toi aux matchs 5, 33 et 70 (de 0 : 4, 32, 69).
    const R1 = renfortDe([4, 32, 69], [39, 59, 69]), R2 = renfortDe([4, 32, 69], [19, 39, 69]);
    exiger('le renfort : +1 par acte de recul, +1 au-delà du nœud du milieu, compté depuis la cédule d\'origine', R1 === 2 && R2 === 1 && renfortDe([4], [4]) === 0 && renfortDe([20], [10]) === 0 && renfortDe([60], [70]) === 1 && renfortDe([60], [66]) === 0,
      `le 5 au 60 et le 33 au 40 : +${R1} ; puis le 60 ramené au 20 : +${R2}`);
    exiger('un rival perdu ne coûte aucun cœur', E.actes[1].gagne === false && E.actes[0].gagne === true && E.coeurs === COEURS - 1, `rival I ${E.actes[0].gagne ? 'battu' : 'perdu'} · rival II ${E.actes[1].gagne ? 'battu' : 'perdu'}`);
    // La bande du départ (devis § 4.9) : les bouche-trous tirés de `BANDE_DEPART` (du 40e au 60e centile) de leur saison.
    const s = shard('1985-86').players.filter(p => groupe(p) === 'F' && (p.gp || 0) >= 30);
    const ppm = p => ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1);
    const tri = s.slice().sort((x, y) => ppm(x) - ppm(y)), bande = new Set(tri.slice(Math.floor(tri.length * BANDE_DEPART[0]), Math.floor(tri.length * BANDE_DEPART[1])));
    const pris = bouchesTrousDuDepart([s], { groupe, valeur: () => 0, personne: getPersonKey, piger: l => l[0] }).filter(p => groupe(p) === 'F');
    exiger('les bouche-trous du départ sont pigés de la bande du départ de leur saison (BANDE_DEPART)', pris.length === 3 && pris.every(p => bande.has(p)), `${pris.length} attaquants, ${pris.filter(p => bande.has(p)).length} dans la bande`);
  }

  /* ---------- 2. la run en actes, jouée par l'attentif (un fil par graine, deux à la fois) ---------- */
  const FILS = Math.max(1, Math.min(2, Number(process.env.FILS) || availableParallelism() - 1));
  const runs = new Array(RUNS);
  let suivante = 0;
  await Promise.all(Array.from({ length: Math.min(FILS, RUNS) }, async () => {
    while (suivante < RUNS) { const i = suivante++; runs[i] = await lancer({ i }); }
  }));
  for (const r of runs) {
    informer(`run ${r.graine}`, `${r.actes.map((x, a) => `acte ${a + 1} : ${x.rang}e${x.tenu == null ? '' : x.tenu ? ' ✓' : ' ✗'}, rival ${x.rival ? 'battu' : 'perdu'}`).join(' · ')} · ${r.coeurs} ❤️${r.mort ? ` · morte à l'acte ${r.mort}` : r.rate ? ' · sans séries' : ` · ${r.rondes} ronde(s)${r.coupe ? ' 🏆' : ''}`} · ${r.s} s`);
  }
  const n = 32;
  exiger('un rival par acte, jamais manquant, au rang de force voulu (un voisin au plus)', runs.every(r => r.rivaux.length === 3 && r.rivaux.every((x, a) => x.voulu === parmiLesAdversaires(RANGS_DES_RIVAUX[a], n) && Math.abs(x.rang - x.voulu) <= 1)),
    runs.map(r => r.rivaux.map(x => `${x.rang + 1}e`).join('/')).join(' · '));
  exiger('après les échanges, chaque club joue 82 matchs, jamais deux le même jour', runs.every(r => r.verif.doubles === 0 && r.verif.min === 82 && r.verif.max === 82 && r.verif.joursToi === 82),
    runs.map(r => `${r.verif.min}–${r.verif.max}, ${r.verif.doubles} doublé`).join(' · '));
  // Les cœurs recomptés : un par contrôle raté des actes I et II (et par élite perdue), jamais par un rival perdu.
  const recompte = r => COEURS - r.actes.slice(0, 2).filter(x => x.tenu === false).length - r.elites.filter(e => e.gagnee === false).length;
  exiger('les cœurs : un de moins par contrôle raté ou élite perdue, aucun pour un rival perdu ; à zéro, la run est morte', runs.every(r => Math.max(0, recompte(r)) === r.coeurs && (!!r.mort === (recompte(r) <= 0))),
    runs.map(r => `${r.coeurs} ❤️ (${recompte(r)})`).join(' · '));
  exiger('aucune élite à l\'acte I (JP, 8 nov. 2026), au plus une par acte', runs.every(r => r.elites.every(e => e.acte >= 2) && [2, 3].every(a => r.elites.filter(e => e.acte === a).length <= 1)),
    runs.map(r => r.elites.map(e => `acte ${e.acte} (${Math.round(e.p * 100)} %)`).join(', ') || 'aucune').join(' · '));
  monte('les actes se jouent dans l\'ordre (matchs cumulés)', runs[0].actes.map((x, a) => ACTES[a]));
  informer('le temps', `${((Date.now() - t0) / 1000).toFixed(0)} s (${RUNS} run(s) en actes)`);
  verdict();
}
