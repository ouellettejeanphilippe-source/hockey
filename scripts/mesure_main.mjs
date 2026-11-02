/*
 * MESURE — LA MAIN D'ADJOINTS SERT-ELLE ? (nov. 2026 ; docs/revue-rogue-2026-11.md § 2.3). Une carte d'adjoint joue
 * `SEJOUR` matchs puis se repose `REPOS` matchs (js/adjoints.js). Si deux cartes en alternance couvrent une case toute la
 * saison, poser tout de suite domine et les offres suivantes ne servent à rien : elles entrent dans la main et n'y jouent
 * jamais. On le mesure sur l'attentif (scripts/lib/rogue_sim.mjs), qui poste dès qu'une case est libre la carte prête
 * qui rend le plus à son effectif : les clubs de check_profondeur (le meilleur et celui du milieu de quatre saisons),
 * `SAISONS` saisons de suite chacun — l'effectif, les jetons et le personnage du coach (sa main comprise) continuent
 * d'une saison à l'autre, comme dans une run.
 *
 *   - une carte MORTE : une carte d'adjoint entrée dans la main (un palier, un butin, une histoire) qui n'y joue aucun
 *     séjour avant d'en partir (une main pleine la laisse partir) ou avant la fin de la mesure. Cible : moins de 25 % ;
 *   - l'OCCUPATION des cases : les matchs-cases où un adjoint est en poste (la feuille le nomme), sur les matchs-cases
 *     ouverts au niveau du coach ce soir-là (`casesDuNiveau`), en saison.
 *
 *   node scripts/mesure_main.mjs                      (quelques minutes sur six fils)
 *   GRAINES=1 SAISONS=3 FILS=6 node scripts/mesure_main.mjs
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import { autoRoster } from '../js/sim.js';
import { SEJOUR, REPOS, casesDuNiveau } from '../js/adjoints.js';
import { niveauDe } from '../js/pouvoirs.js';
import { NIVEAUX_PLEINS } from '../js/rogue.js';
import { jouerSaison, metaAuNiveau, shard, groupe } from './lib/rogue_sim.mjs';
import { borne, informer, verdict } from './verdict.mjs';

const GRAINES = Number(process.env.GRAINES ?? 1);
const SAISONS = Number(process.env.SAISONS ?? 3);
const SAISONS_CLUBS = ['1985-86', '1995-96', '2005-06', '2015-16'];
const MORTES_MAX = 0.25;

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

/*
 * Une saison relue : les cartes entrées (`embauche`) et posées (`poste`), dans l'ordre des décisions ; les matchs-cases
 * ouverts et occupés. Le niveau du coach ce soir-là se recompte : son expérience d'avant, une victoire, un gros match
 * gagné, l'expérience d'une histoire (`xpCoach`) au jour dit (js/sim.js `gagnerXp`, `appliquerPerso`).
 */
function relire(r, xp0) {
  const { L, you, decisions } = r;
  // Le match du club où chaque geste tombe : ses matchs joués avant ce jour-là.
  const avant = j => L.calendrier.slice(0, j).filter(jour => jour.some(x => (x.A === you || x.B === you) && x.feuille)).length;
  const gestes = decisions.filter(d => d.embauche || d.poste).map(d => ({ quoi: d.embauche ? 'embauche' : 'poste', cle: (d.embauche || d.poste).cle, match: avant(d.jour) }));
  const grosGagnes = new Set((you.minisBoss || []).filter(mb => mb.gagne).map(mb => mb.jour));
  const xpDuJour = new Map();
  for (const d of decisions) if (Number(d.xpCoach)) xpDuJour.set(d.jour, (xpDuJour.get(d.jour) || 0) + Number(d.xpCoach));
  let xp = xp0, ouverts = 0, occupes = 0, matchs = 0;
  L.calendrier.forEach((jour, j) => {
    xp += xpDuJour.get(j) || 0;
    const m = jour.find(x => x.A === you || x.B === you);
    if (!m || !m.feuille) return;
    const cote = m.A === you ? 'A' : 'B';
    matchs++;
    ouverts += casesDuNiveau(niveauDe(xp));
    occupes += (m.feuille.adjoints || []).filter(a => a.cote === cote).length;
    const gagne = cote === 'A' ? m.gfA > m.gfB : m.gfB > m.gfA;
    if (gagne) xp += 1 + (grosGagnes.has(j) ? 2 : 0);
  });
  return { gestes, ouverts, occupes, matchs };
}

if (!isMainThread) {
  const t = workerData;
  const joueurs = shard(t.saison).byTeam[t.club].filter(p => (p.gp || 0) >= 10).map(p => ({ ...p }));
  const meta = metaAuNiveau(0);
  const etat = { roster: autoRoster(joueurs), variantes: new Map(), jetons: 0 };
  const saisons = [];
  for (let n = 1; n <= SAISONS; n++) {
    const xp0 = etat.perso ? etat.perso.xp : 0;
    const r = jouerSaison(meta, etat, { graine: t.graine, saison: n, politique: 'attentif', ligue: NIVEAUX_PLEINS });
    const lu = relire(r, xp0);
    saisons.push(lu);
    etat.roster = r.roster; etat.jetons = r.reste; etat.perso = r.perso;
  }
  parentPort.postMessage({ cle: t.cle, saisons });
} else {
  const t0 = Date.now();
  console.log(`\n  La main d'adjoints : SEJOUR ${SEJOUR}, REPOS ${REPOS} · l'attentif, ${SAISONS} saisons de suite par club\n`);
  const taches = SAISONS_CLUBS.flatMap(clubsDeLaSaison).flatMap(k => Array.from({ length: GRAINES }, (_, g) =>
    ({ cle: `${k.club} ${k.saison} (${k.genre})`, saison: k.saison, club: k.club, graine: `main-${k.club}-${k.saison}-${g}` })));
  const lancer = data => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: data });
    w.once('message', resolve); w.once('error', reject);
  });
  const FILS = Math.max(1, Number(process.env.FILS) || Math.min(6, availableParallelism() - 1));
  const resultats = [];
  let suivante = 0;
  await Promise.all(Array.from({ length: Math.min(FILS, taches.length) }, async () => {
    while (suivante < taches.length) { const k = suivante++; resultats[k] = await lancer(taches[k]); }
  }));

  let offertes = 0, mortes = 0, tard = 0, ouverts = 0, occupes = 0;
  for (const { cle, saisons } of resultats) {
    // Une carte, de son entrée à la suivante du même adjoint (elle était partie) : a-t-elle été posée entre les deux ?
    const cartes = [];
    saisons.forEach((s, n) => {
      for (const g of s.gestes) {
        if (g.quoi === 'embauche') cartes.push({ cle: g.cle, saison: n, match: g.match, jouee: false, ouverte: true });
        else { const c = cartes.findLast(x => x.cle === g.cle && x.ouverte); if (c) c.jouee = true; }
        if (g.quoi === 'embauche') for (const c of cartes.slice(0, -1)) if (c.cle === g.cle) c.ouverte = false;
      }
      ouverts += s.ouverts; occupes += s.occupes;
    });
    const derniere = saisons.length - 1;
    const m = cartes.filter(c => !c.jouee);
    offertes += cartes.length; mortes += m.length;
    tard += m.filter(c => c.saison === derniere && saisons[derniere].matchs - c.match < SEJOUR).length;
    const occ = saisons.reduce((a, s) => a + s.occupes, 0) / Math.max(1, saisons.reduce((a, s) => a + s.ouverts, 0));
    informer(cle, `${cartes.length} cartes entrées, ${m.length} mortes (${m.map(c => c.cle).join(', ') || '—'}) · cases occupées ${Math.round(100 * occ)} %`);
  }
  const part = mortes / Math.max(1, offertes);
  informer('les cartes mortes arrivées à la toute fin', `${tard} sur ${mortes} entrées à moins de ${SEJOUR} matchs de la fin de la dernière saison : la mesure s'arrête là, une run continuerait`);
  informer('l\'occupation des cases', `${Math.round(100 * occupes / Math.max(1, ouverts))} % des matchs-cases ouverts au niveau du coach (${occupes} sur ${ouverts})`);
  borne('les cartes d\'adjoint qui ne jouent jamais un séjour', part * 100, 0, MORTES_MAX * 100, ' %');
  informer('le temps', `${((Date.now() - t0) / 1000).toFixed(0)} s (${taches.length} clubs × ${SAISONS} saisons, ${FILS} fils)`);
  verdict('La main d\'adjoints');
}
