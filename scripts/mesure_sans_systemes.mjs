/**
 * SANS LES SYSTÈMES — ce que chaque coach perd quand les stratégies de lignes partent (docs/sans-systemes.md).
 *
 *   node scripts/mesure_sans_systemes.mjs    (LIGUES=6, PARALLELE=4 ; VOIES=tortue,essaim pour quelques-unes)
 *
 * JP, 24 oct. 2026 : *même les stratégies de lignes, c'est à jeter*. Avant de les jeter : ce que chaque coach y perd.
 * Deux mondes, la même ligue Rogue (`courbe`), les mêmes clubs, les mêmes graines :
 *   AVEC  le jeu d'aujourd'hui : chaque unité joue le style que ses badges ouvrent (V15) ;
 *   SANS  chaque ligne de chaque club au Hourra — ni gain ni prix, ni chimie, donc ni action spéciale, ni étouffé,
 *         ni le plan d'appariement qui lit les contres. La ligue y est recalée comme on la recalerait en jetant les
 *         systèmes : `SPEC_NORME` à 1 (plus d'actions spéciales à compenser) et `REF_STYLE_VOL` à 1 (le style de
 *         référence que les systèmes donnaient à tous) ; ses buts restent à quelques % de ceux d'aujourd'hui.
 * Pour chaque coach, EN PAIRES (la moitié de la ligue traitée, puis l'inverse, comme check_voies) :
 *   - SES JOUEURS : le club rebâti à sa couleur (scripts/lib/voies.mjs), sans coach, contre le club tel quel ;
 *   - SA CONFIANCE III : sur ce club rebâti, contre le même sans lui ;
 *   - la voie entière (les deux), en victoires et en vraies stats par match : tirs, % au tir, tirs contre, % d'arrêts.
 * Chaque (monde, coach) est un processus à part : les deux mondes n'ont pas les mêmes constantes du moteur.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { simulateLeague } from '../js/sim.js';
import { COACHS, VOIES, effetDePalier } from '../js/coachs.js';
import { vestiaires, club, rosterDe, bassinsDesCouleurs, batir, moy, signe } from './lib/voies.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const LIGUES = Number(process.env.LIGUES ?? 6);
const MESUREES = process.env.VOIES ? process.env.VOIES.split(',') : VOIES;
const PARALLELE = Number(process.env.PARALLELE ?? 4);
const MONDES = { avec: {}, sans: { SPEC_NORME: '1', REF_STYLE_VOL: '1' } };
const HOURRA = () => [0, 1, 2, 3].map(() => ({ tac: 'hourra', tacD: 'hourra' }));
const PAR = p => p.$ || 0;   // comme check_voies : chaque case s'apparie sur le salaire

/* La feuille d'un club, par match : ses buts, ses tirs, ceux qu'il accorde. */
function feuille(t) {
  const js = Object.values(t.roster).filter(Boolean);
  return { W: t.W, GF: t.GF, GA: t.GA, SF: js.filter(p => p.p !== 'G').reduce((a, p) => a + (p.simSH || 0), 0),
    SA: js.filter(p => p.p === 'G').reduce((a, p) => a + (p.simSA || 0), 0), n: t.games };
}

/* UN PROCESSUS : un monde, un coach (ou `ligue` : les vrais clubs seuls). Il rend ses paires en JSON sur la dernière ligne. */
function travail(monde, k) {
  const lu = { joueurs: [], coach: [], ligue: [], chimie: 0 };
  if (k === 'ligue') {
    for (let Lg = 0; Lg < LIGUES; Lg++) {
      const teams = vestiaires(5000 + Lg).map(v => club(v, rosterDe(v)));
      if (monde === 'sans') for (const t of teams) t.lignes = HOURRA();
      simulateLeague(teams, 82, { graine: `sans-systemes-${Lg}`, courbe: true });
      lu.ligue.push(...teams.map(feuille));
    }
    return lu;
  }
  const BASSIN = bassinsDesCouleurs(PAR);
  /* `traite(v, r)` : le club traité ; `temoin(v, r)` : son témoin ; `coach` : le traité porte la III. */
  const paires = (quoi, traite, temoin, coach) => {
    for (let Lg = 0; Lg < LIGUES; Lg++) {
      const V = vestiaires(5000 + Lg), bras = [];
      for (const parite of [0, 1]) {
        const teams = V.map((v, i) => { const r = rosterDe(v); return club(v, i % 2 === parite ? traite(r) : temoin(r)); });
        if (monde === 'sans') for (const t of teams) t.lignes = HOURRA();
        const decisions = coach ? teams.map((_, i) => i).filter(i => i % 2 === parite).map(equipe => ({ jour: 0, equipe, coach: effetDePalier(k, 3) })) : [];
        simulateLeague(teams, 82, { graine: `sans-systemes-${Lg}`, decisions, courbe: true });
        if (monde === 'sans') lu.chimie += teams.reduce((a, t) => a + t.chimie.reduce((x, c) => x + c, 0), 0);
        bras.push(teams.map(feuille));
      }
      for (let i = 0; i < V.length; i++) lu[quoi].push({ t: bras[i % 2][i], c: bras[1 - (i % 2)][i] });
    }
  };
  const bati = r => batir(r, k, BASSIN, PAR);
  paires('joueurs', bati, r => r, false);
  paires('coach', bati, bati, true);
  return lu;
}

/* Ce qu'une liste de paires dit, par match : les victoires, et les quatre vraies stats du traité moins son témoin. */
function lire(ps) {
  const S = cote => ['W', 'GF', 'GA', 'SF', 'SA', 'n'].reduce((o, c) => ({ ...o, [c]: ps.reduce((a, x) => a + x[cote][c], 0) }), {});
  const T = S('t'), C = S('c');
  return {
    V: moy(ps.map(x => x.t.W - x.c.W)),
    tirs: T.SF / T.n - C.SF / C.n, pct: 100 * (T.GF / T.SF - C.GF / C.SF),
    contre: T.SA / T.n - C.SA / C.n, arrets: 100 * ((1 - T.GA / T.SA) - (1 - C.GA / C.SA)),
  };
}
const somme = (a, b) => Object.fromEntries(Object.keys(a).map(c => [c, a[c] + b[c]]));
const diff = (a, b) => Object.fromEntries(Object.keys(a).map(c => [c, a[c] - b[c]]));
const stats = x => `${signe(x.tirs)} tirs · ${signe(x.pct)} pt au tir · ${signe(x.contre)} tirs contre · ${signe(x.arrets)} pt d'arrêts`;

if (process.env.TRAVAIL) {
  console.log(JSON.stringify(travail(process.env.MONDE, process.env.VOIE)));
} else {
  const fichier = fileURLToPath(import.meta.url);
  const jobs = Object.keys(MONDES).flatMap(monde => ['ligue', ...MESUREES].map(k => ({ monde, k })));
  const lus = new Map();
  const lancer = ({ monde, k }) => new Promise((ok, non) => {
    const env = { ...process.env, ...MONDES[monde], TRAVAIL: '1', MONDE: monde, VOIE: k, LIGUES: String(LIGUES) };
    const p = spawn(process.execPath, [fichier], { env, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.on('close', code => {
      if (code) return non(new Error(`${monde} ${k} : sortie ${code}`));
      lus.set(`${monde}:${k}`, JSON.parse(out.trim().split('\n').pop()));
      process.stderr.write(`  ${(COACHS[k] || { ico: '🏒' }).ico} ${monde}\n`);
      ok();
    });
  });
  const file = jobs.slice();
  await Promise.all(Array.from({ length: PARALLELE }, async () => { while (file.length) await lancer(file.shift()); }));

  console.log(`\n  SANS LES SYSTÈMES · ${LIGUES} ligues Rogue × 32 clubs, en paires\n`);
  const ligue = m => { const t = lus.get(`${m}:ligue`).ligue, s = c => t.reduce((a, x) => a + x[c], 0); return { buts: s('GF') / s('n'), tirs: s('SF') / s('n') }; };
  const LA = ligue('avec'), LS = ligue('sans');
  informer('la ligue, avec les systèmes', `${LA.buts.toFixed(2)} buts · ${LA.tirs.toFixed(1)} tirs par club et par match`);
  informer('la ligue, sans (recalée)', `${LS.buts.toFixed(2)} buts · ${LS.tirs.toFixed(1)} tirs par club et par match`);
  // Les deux mondes se comparent en victoires si leurs buts restent proches : un but vaut plus de victoires dans une ligue qui en marque moins.
  borne('les buts de la ligue sans systèmes, contre avec (la comparaison tient)', LS.buts / LA.buts, 0.95, 1.05);
  exiger('sans systèmes, aucune ligne n\'a de chimie', MESUREES.every(k => lus.get(`sans:${k}`).chimie === 0));

  const rangs = [];
  for (const k of MESUREES) {
    const A = lus.get(`avec:${k}`), S = lus.get(`sans:${k}`);
    const ja = lire(A.joueurs), js = lire(S.joueurs), ca = lire(A.coach), cs = lire(S.coach);
    const va = somme(ja, ca), vs = somme(js, cs), perte = diff(va, vs);
    rangs.push({ k, va: va.V, vs: vs.V });
    const C = COACHS[k];
    console.log(`  ${C.ico} ${C.nom}`);
    console.log(`     la voie        ${signe(va.V)} V avec · ${signe(vs.V)} V sans · perd ${signe(perte.V)} V`);
    console.log(`     ses joueurs    ${signe(ja.V)} V avec · ${signe(js.V)} V sans`);
    console.log(`     sa III         ${signe(ca.V)} V avec · ${signe(cs.V)} V sans`);
    console.log(`     la voie avec   ${stats(va)}`);
    console.log(`     la voie sans   ${stats(vs)}\n`);
    informer(`${C.nom} : la voie avec, puis sans`, `${signe(va.V)} → ${signe(vs.V)} V (ses joueurs ${signe(ja.V)} → ${signe(js.V)}, sa III ${signe(ca.V)} → ${signe(cs.V)})`);
  }
  const ecart = l => (Math.max(...l) - Math.min(...l)) / 2;
  informer('l\'écart des voies entre elles (du plus fort au plus faible, sur deux)', `${ecart(rangs.map(x => x.va)).toFixed(1)} V avec · ${ecart(rangs.map(x => x.vs)).toFixed(1)} V sans`);
  verdict();
}
