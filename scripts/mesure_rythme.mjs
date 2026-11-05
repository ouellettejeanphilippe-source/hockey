/*
 * MESURE — LE RYTHME D'UNE SAISON (nov. 2026 ; docs/revue-rogue-2026-11.md § 2.1). Passé le 26e match, il ne se passait
 * presque plus rien : les paliers d'adjoints tombaient aux 9e, 18e et 26e matchs (`PALIERS_PACK`, js/inventaire.js) et
 * les histoires ne s'ouvraient qu'une fois par saison (js/dossiers.js). On le mesure sur l'attentif
 * (scripts/lib/rogue_sim.mjs) : les clubs de check_profondeur (le meilleur et celui du milieu de quatre saisons),
 * `SAISONS` saisons de suite chacun, comme scripts/mesure_main.mjs.
 *
 * UN MOMENT, c'est un match avant lequel la saison te demande quelque chose :
 *   - ce que le robot joue : un palier (un adjoint parmi trois), une histoire, le butin d'un gros match gagné, un talent
 *     du coach, le gros match lui-même (un duel, un plan par période) ;
 *   - ce que la cédule fixe, que le robot ne joue pas : la main du deck (`PALIERS_CARTES`, js/sim.js) et l'objectif du
 *     proprio (`JOURS_OBJECTIFS`). Le verdict du proprio n'est un choix que réussi (un adjoint parmi trois) : il ne
 *     compte pas.
 * Les signatures (un pack acheté, un joueur signé) se comptent à part : la boutique est ouverte tous les jours, c'est le
 * joueur qui y va, pas la saison qui le lui demande.
 *
 *   - le TROU : le plus long passage, en matchs, entre deux moments (du premier match au 82e) ; cible : 10 au plus ;
 *   - les QUARTS : les moments de chaque quart de saison (les matchs 1-20, 21-41, 42-61, 62-82) ; cible : un au moins
 *     dans chaque quart de chaque saison.
 *
 *   node scripts/mesure_rythme.mjs                    (une minute et demie sur huit fils)
 *   GRAINES=2 SAISONS=3 FILS=6 node scripts/mesure_rythme.mjs
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import { autoRoster, PALIERS_CARTES, JOURS_OBJECTIFS } from '../js/sim.js';
import { PALIERS_PACK } from '../js/inventaire.js';
import { NIVEAUX_PLEINS } from '../js/rogue.js';
import { jouerSaison, metaAuNiveau, shard, groupe } from './lib/rogue_sim.mjs';
import { borne, exiger, informer, verdict } from './verdict.mjs';
import '../js/greffes.js';   // V25 : les greffes du Rogue se branchent sur le moteur

const GRAINES = Number(process.env.GRAINES ?? 1);
const SAISONS = Number(process.env.SAISONS ?? 3);
const SAISONS_CLUBS = ['1985-86', '1995-96', '2005-06', '2015-16'];
const MATCHS = 82;
const TROU_MAX = 10;
const QUARTS = [20, 41, 61, MATCHS];
const quartDe = m => QUARTS.findIndex(q => m <= q);
const SORTES = { palier: '🎁 palier', histoire: '📰 histoire', butin: '🏆 butin', talent: '⭐ talent', gros: '⚔ gros match', main: '🃏 main du deck', objectif: '🏢 objectif', signature: '✍ signature' };

/* Le meilleur club et celui du milieu d'une saison, au vrai pourcentage de victoires de ses gardiens (check_profondeur). */
function clubsDeLaSaison(s) {
  const e = shard(s), out = [];
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

/* Une saison relue : chaque moment, à son match (les matchs du club déjà joués ce jour-là). */
function relire(r) {
  const { L, you, decisions } = r;
  const joue = L.calendrier.map(jour => jour.some(x => (x.A === you || x.B === you) && x.feuille));
  const avant = j => joue.slice(0, j).filter(Boolean).length;
  const out = [];
  for (const d of decisions) {
    const p = String(d.palier || '');
    const sorte = p.startsWith('pp:') ? 'palier' : p.startsWith('do:') ? 'histoire' : p.startsWith('r:') ? 'butin' : p.startsWith('ta:') ? 'talent' : d.ballottage ? 'signature' : null;
    if (sorte) out.push({ sorte, m: avant(d.jour), ...(sorte === 'histoire' ? { cle: d.moment.cle, xp: Number(d.xpCoach) || 0, gain: Number(d.gain) || 0, adjoint: !!d.embauche } : {}) });
  }
  for (const mb of you.minisBoss || []) out.push({ sorte: 'gros', m: avant(mb.jour) });
  const n = joue.filter(Boolean).length;
  for (const k of PALIERS_CARTES) if (k < n) out.push({ sorte: 'main', m: k });
  for (const k of JOURS_OBJECTIFS) if (k < n) out.push({ sorte: 'objectif', m: k });
  return { moments: out, matchs: n };
}

if (!isMainThread) {
  const t = workerData;
  const joueurs = shard(t.saison).byTeam[t.club].filter(p => (p.gp || 0) >= 10).map(p => ({ ...p }));
  const meta = metaAuNiveau(0);
  const etat = { roster: autoRoster(joueurs), variantes: new Map(), jetons: 0 };
  const saisons = [];
  for (let n = 1; n <= SAISONS; n++) {
    const r = jouerSaison(meta, etat, { graine: t.graine, saison: n, politique: 'attentif', ligue: NIVEAUX_PLEINS });
    saisons.push(relire(r));
    etat.roster = r.roster; etat.jetons = r.reste; etat.perso = r.perso;
  }
  parentPort.postMessage({ cle: t.cle, saisons });
} else {
  const t0 = Date.now();
  console.log(`\n  Le rythme d'une saison : paliers aux ${PALIERS_PACK.join(', ')}e matchs · l'attentif, ${SAISONS} saisons de suite par club\n`);
  const taches = SAISONS_CLUBS.flatMap(clubsDeLaSaison).flatMap(k => Array.from({ length: GRAINES }, (_, g) =>
    ({ cle: `${k.club} ${k.saison} (${k.genre})`, saison: k.saison, club: k.club, graine: `rythme-${k.club}-${k.saison}-${g}` })));
  const lancer = data => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: data });
    w.once('message', resolve); w.once('error', reject);
  });
  const FILS = Math.max(1, Number(process.env.FILS) || Math.min(8, availableParallelism() - 1));
  const resultats = [];
  let suivante = 0;
  await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, async () => {
    while (suivante < taches.length) { const k = suivante++; resultats[k] = await lancer(taches[k]); }
  }));

  const trous = [], parQuart = [0, 0, 0, 0], parSorte = {}, histoires = new Map(), rapporte = { xp: 0, gain: 0, adjoint: 0 };
  let quartsVides = 0, nSaisons = 0, signatures = 0;
  for (const { cle, saisons } of resultats) {
    const lignes = saisons.map(({ moments, matchs }) => {
      nSaisons++;
      const vrais = moments.filter(x => x.sorte !== 'signature');
      signatures += moments.length - vrais.length;
      for (const x of moments) parSorte[x.sorte] = (parSorte[x.sorte] || 0) + 1;
      for (const x of vrais.filter(y => y.sorte === 'histoire')) { histoires.set(x.cle, (histoires.get(x.cle) || 0) + 1); rapporte.xp += x.xp; rapporte.gain += x.gain; rapporte.adjoint += x.adjoint ? 1 : 0; }
      // Les matchs où un moment tombe, du début (le match 0) à la fin de la saison.
      const ms = [...new Set([0, ...vrais.map(x => x.m), matchs])].sort((a, b) => a - b);
      let trou = 0, ou = '';
      for (let i = 1; i < ms.length; i++) if (ms[i] - ms[i - 1] > trou) { trou = ms[i] - ms[i - 1]; ou = `${ms[i - 1]}→${ms[i]}`; }
      trous.push(trou);
      const q = [0, 0, 0, 0];
      for (const x of vrais) q[quartDe(x.m)]++;
      q.forEach((v, i) => { parQuart[i] += v; if (!v) quartsVides++; });
      return `trou ${trou} (${ou}) · quarts ${q.join('/')}`;
    });
    informer(cle, lignes.join(' ; '));
  }
  const tries = [...trous].sort((a, b) => a - b);
  informer('les moments, par sorte (par saison)', Object.entries(SORTES).map(([k, nom]) => `${nom} ${((parSorte[k] || 0) / nSaisons).toFixed(1)}`).join(' · '));
  // L'ÉCONOMIE : ce que les réponses de l'attentif aux histoires rapportent (une histoire qui revient ne doit pas l'emballer).
  informer('ce que les histoires rapportent à l\'attentif (par saison)', `${(rapporte.xp / nSaisons).toFixed(1)} d'expérience au coach · ${(rapporte.gain / nSaisons).toFixed(1)} 🪙 · ${(rapporte.adjoint / nSaisons).toFixed(1)} carte d'adjoint`);
  informer('les histoires sorties (sur toutes les saisons)', [...histoires.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ') || '—');
  informer('les moments par quart de saison (moyenne par saison)', parQuart.map((v, i) => `${['1-20', '21-41', '42-61', '62-82'][i]} : ${(v / nSaisons).toFixed(1)}`).join(' · ') + ` · signatures à part : ${(signatures / nSaisons).toFixed(1)} par saison`);
  informer('le plus long trou de chaque saison', `médiane ${tries[Math.floor(tries.length / 2)]}, pire ${tries.at(-1)} · ${trous.filter(x => x > TROU_MAX).length} saisons sur ${nSaisons} au-dessus de ${TROU_MAX}`);
  borne('le plus long trou sans moment, en médiane des saisons', tries[Math.floor(tries.length / 2)], 0, TROU_MAX, ' matchs');
  borne('les saisons qui ont un trou de plus de 10 matchs', 100 * trous.filter(x => x > TROU_MAX).length / nSaisons, 0, 25, ' %');
  exiger('un moment au moins dans chaque quart de chaque saison', quartsVides === 0, `${quartsVides} quarts vides sur ${4 * nSaisons}`);
  informer('le temps', `${((Date.now() - t0) / 1000).toFixed(0)} s (${taches.length} clubs × ${SAISONS} saisons, ${FILS} fils)`);
  verdict('Le rythme d\'une saison');
}
