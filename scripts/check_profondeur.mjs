/**
 * LA PROFONDEUR DU ROGUE : MENER, ÇA COMPTE-T-IL ? (V9, tranche 2 ; docs/refonte-v9.md, § 10)
 *
 * JP, 16 oct. : *ça ne devrait pas être facile, mais possible, de rouler sur la ligue avec les bons joueurs, stratégies et
 * cie, ou se planter royalement avec un bon roster, comme la vraie vie*. Trois robots jouent les mêmes dés
 * (scripts/lib/rogue_sim.mjs, `POLITIQUES`) : le robot d'avant ('defaut'), l'attentif, qui aligne au mieux et joue chaque
 * gros match, et le distrait, qui clique au hasard. L'écart entre l'attentif et le distrait, c'est la profondeur du jeu.
 *
 * Deux parties :
 *   1. MENER UNE VRAIE ÉQUIPE : dans quatre saisons, le meilleur club (au vrai pourcentage de victoires de ses gardiens)
 *      et le club du milieu, chacun lancé dans une saison du Rogue (31 vrais clubs, les packs, le plafond), GRAINES fois
 *      par politique, sur les mêmes graines. Les deux bouts : le club moyen bien mené finit-il parfois premier ? le bon
 *      club mal mené rate-t-il parfois les séries ?
 *   2. LES CAMPAGNES : de zéro, douze runs par politique, les médailles achètent les déblocages (comme `check_rogue`).
 *      L'attentif gagne sa première Coupe entre la run 3 et la run 8 ; le distrait ne la gagne jamais.
 *
 * LES CIBLES DE LA V9 (§ 10). Mesuré le 16 oct., avant la tranche 3 : voir docs/refonte-v9.md, § 14. Le script est le
 * juge des tranches 3 à 8, pas une vérification de la CI : il est rouge tant que mener ne compte pas assez.
 *
 *   node scripts/check_profondeur.mjs                        (une vingtaine de minutes à trois fils)
 *   GRAINES=2 CAMPAGNES=1 node scripts/check_profondeur.mjs  (l'essai rapide)
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import { getPlayerKey, autoRoster } from '../js/sim.js';
import { jouerSaison, jouerRun, acheterDans, metaAuNiveau, shard, groupe, POLITIQUES } from './lib/rogue_sim.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const GRAINES = Number(process.env.GRAINES ?? 4);
const CAMPAGNES = Number(process.env.CAMPAGNES ?? 2);
const RUNS_CAMPAGNE = Number(process.env.RUNS_CAMPAGNE ?? 12);
const SAISONS_CLUBS = ['1985-86', '1995-96', '2005-06', '2015-16'];
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/* Le vrai bilan d'un club : les victoires et les défaites de ses gardiens. */
function clubsDeLaSaison(s) {
  const e = shard(s);
  const out = [];
  for (const [club, ps] of Object.entries(e.byTeam)) {
    const n = g => ps.filter(p => groupe(p) === g && (p.gp || 0) >= 10).length;
    if (n('F') < 12 || n('D') < 6 || n('G') < 2) continue;
    const G = ps.filter(p => p.p === 'G');
    const w = G.reduce((a, g) => a + (g.w || 0), 0), l = G.reduce((a, g) => a + (g.l || 0), 0);
    if (w + l >= 40) out.push({ saison: s, club, pv: w / (w + l) });
  }
  out.sort((a, b) => b.pv - a.pv);
  return [{ ...out[0], genre: 'bon' }, { ...out[Math.floor(out.length / 2)], genre: 'moyen' }];
}

if (!isMainThread) {
  const t = workerData;
  if (t.genre === 'club') {
    const out = [];
    for (const graine of t.graines) {
      const joueurs = shard(t.saison).byTeam[t.club].filter(p => (p.gp || 0) >= 10).map(p => ({ ...p }));
      const meta = metaAuNiveau(0);
      const etat = { roster: autoRoster(joueurs), variantes: new Map(), jetons: 0 };
      const r = jouerSaison(meta, etat, { graine, saison: 1, politique: t.politique });
      out.push({ graine, W: r.W, pts: r.pts, rang: r.rang, rondes: r.rondes, coupe: r.coupe, signes: r.signes });
    }
    parentPort.postMessage({ cle: t.cle, politique: t.politique, out });
  } else {
    // UNE CAMPAGNE : de zéro, les médailles et les jalons achètent les déblocages, run après run (comme `check_rogue`).
    const meta = { ecussons: 0, deblocages: [], jalons: {} };
    const classeur = new Map(), joues = new Map();
    let derniere = [], premiere = null;
    const runs = [];
    for (let r = 0; r < t.runs; r++) {
      const res = jouerRun(meta, { classeur: [...classeur.values()], derniere, graine: `profondeur${t.c}-run${r}`, jalons: true, joues, politique: t.politique });
      for (const x of res.entrees) if (!classeur.has(getPlayerKey(x.p))) classeur.set(getPlayerKey(x.p), x);
      derniere = res.equipe;
      meta.ecussons += res.ecussons;
      acheterDans(meta);
      runs.push({ nSaisons: res.nSaisons, coupe: res.coupe });
      if (res.coupe && premiere === null) premiere = r + 1;
    }
    parentPort.postMessage({ c: t.c, politique: t.politique, runs, premiere, deblocages: meta.deblocages.length });
  }
} else {
  const lancer = data => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: data });
    w.once('message', resolve); w.once('error', reject);
  });
  const t0 = Date.now();
  const v1 = x => x.toFixed(1).replace('.', ',');
  const signe = x => `${x >= 0 ? '+' : '−'}${v1(Math.abs(x))}`;
  console.log('\n  La profondeur du Rogue : l\'attentif, le distrait et le robot d\'avant, sur les mêmes dés\n');

  const clubs = SAISONS_CLUBS.flatMap(clubsDeLaSaison);
  const taches = [];
  for (const politique of POLITIQUES) for (let c = 0; c < CAMPAGNES; c++) taches.push({ genre: 'campagne', politique, c, runs: RUNS_CAMPAGNE });
  for (const k of clubs) for (const politique of POLITIQUES) {
    taches.push({ genre: 'club', cle: `${k.club} ${k.saison}`, saison: k.saison, club: k.club, politique, graines: Array.from({ length: GRAINES }, (_, g) => `profondeur-${k.club}-${k.saison}-${g}`) });
  }
  // Les campagnes de l'attentif d'abord (les plus longues), puis les autres ; chaque résultat garde sa place.
  const poids = t => (t.genre === 'campagne' ? 2 : 0) + (t.politique === 'attentif' ? 1 : 0);
  const ordre = taches.map((t, k) => k).sort((a, b) => poids(taches[b]) - poids(taches[a]));
  const FILS = Math.max(1, Number(process.env.FILS) || Math.min(6, availableParallelism() - 1));
  const resultats = new Array(taches.length);
  let suivante = 0;
  await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, async () => {
    while (suivante < ordre.length) { const k = ordre[suivante++]; resultats[k] = await lancer(taches[k]); }
  }));

  /* 1. mener une vraie équipe */
  const de = (cle, politique) => resultats.find(r => r.cle === cle && r.politique === politique).out;
  const ecarts = { 'attentif − distrait': [], 'attentif − défaut': [], 'défaut − distrait': [] };
  let premiers = 0, rates = 0;
  for (const k of clubs) {
    const cle = `${k.club} ${k.saison}`;
    const [d, a, z] = POLITIQUES.map(p => de(cle, p));
    const resume = o => `${v1(moy(o.map(x => x.W)))} V, ${v1(moy(o.map(x => x.rang)))}e en moyenne, 1er ${o.filter(x => x.rang === 1).length}/${o.length}, séries ${o.filter(x => x.rang <= 16).length}/${o.length}, ${v1(moy(o.map(x => x.signes)))} signés`;
    informer(`${cle} (${k.genre}, ${Math.round(1000 * k.pv)} en vrai)`, `attentif ${resume(a)} · défaut ${resume(d)} · distrait ${resume(z)}`);
    a.forEach((x, g) => { ecarts['attentif − distrait'].push(x.W - z[g].W); ecarts['attentif − défaut'].push(x.W - d[g].W); ecarts['défaut − distrait'].push(d[g].W - z[g].W); });
    if (k.genre === 'moyen') premiers += a.filter(x => x.rang === 1).length;
    if (k.genre === 'bon') rates += z.filter(x => x.rang > 16).length;
  }
  for (const [nom, l] of Object.entries(ecarts)) {
    const m = moy(l), se = Math.sqrt(moy(l.map(x => (x - m) ** 2)) / Math.max(1, l.length - 1));
    informer(`l'écart ${nom}`, `${signe(m)} V par saison (± ${v1(se)}, ${l.length} saisons appariées)`);
  }
  const nMoyen = clubs.filter(k => k.genre === 'moyen').length * GRAINES, nBon = clubs.filter(k => k.genre === 'bon').length * GRAINES;
  exiger('un alignement moyen bien mené peut finir premier de la ligue', premiers > 0, `${premiers} fois sur ${nMoyen} (l'attentif, les clubs du milieu)`);
  exiger('un bon alignement mal mené peut rater les séries', rates > 0, `${rates} fois sur ${nBon} (le distrait, les meilleurs clubs)`);

  /* 2. les campagnes */
  const camp = POLITIQUES.map(politique => resultats.filter(r => r.c !== undefined && r.politique === politique).sort((x, y) => x.c - y.c));
  POLITIQUES.forEach((politique, i) => {
    for (const r of camp[i]) {
      informer(`campagne ${r.c + 1}, ${politique}`, `${r.premiere ? `1re Coupe à la run ${r.premiere}` : `pas de Coupe en ${RUNS_CAMPAGNE} runs`} · ${r.runs.filter(x => x.coupe).length} Coupe(s) · ${r.deblocages} déblocages au bout · saisons par run : ${r.runs.map(x => `${x.nSaisons}${x.coupe ? '🏆' : ''}`).join(' ')}`);
    }
  });
  const attentif = camp[POLITIQUES.indexOf('attentif')], distrait = camp[POLITIQUES.indexOf('distrait')];
  const premieres = attentif.map(r => r.premiere ?? RUNS_CAMPAGNE + 1).sort((a, b) => a - b);
  const mediane = premieres.length % 2 ? premieres[(premieres.length - 1) / 2] : (premieres[premieres.length / 2 - 1] + premieres[premieres.length / 2]) / 2;
  exiger('l\'attentif gagne sa première Coupe entre la run 3 et la run 8 (la médiane des campagnes)', mediane >= 3 && mediane <= 8,
    `médiane ${mediane} · ${attentif.map(r => (r.premiere ? `run ${r.premiere}` : `> ${RUNS_CAMPAGNE}`)).join(' · ')}`);
  const coupesDistrait = distrait.reduce((a, r) => a + r.runs.filter(x => x.coupe).length, 0);
  exiger(`le distrait ne gagne jamais la Coupe en ${RUNS_CAMPAGNE} runs`, coupesDistrait === 0, `${coupesDistrait} Coupe(s) en ${distrait.length * RUNS_CAMPAGNE} runs`);
  informer('le temps', `${((Date.now() - t0) / 1000).toFixed(0)} s (${GRAINES} graines par club et par politique, ${CAMPAGNES} campagne(s) de ${RUNS_CAMPAGNE} runs par politique, ${FILS} fils)`);
  verdict('La profondeur du Rogue');
}
