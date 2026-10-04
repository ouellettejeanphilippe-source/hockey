/*
 * L'IMPACT EN CHIFFRES DE MATCH — ce que l'écran annonce est ce que le moteur joue (js/impact.js).
 *
 * JP : *les pourcentages, ça me dit fuck all ce que ça impacte dans le match.* L'écran dit donc « ≈ +2,1 tirs
 * par match », « ≈ −0,2 but accordé par match ». Un chiffre qu'on affiche sans le prouver est un chiffre qu'on
 * invente : ce script le joue pour de vrai (`check_totaux.mjs` fait la même chose pour les anciens « % »).
 *
 *   1. LE NIVEAU DU SOIR. `chiffresDuSoir` égale la moyenne de milliers de vrais matchs joués par le moteur
 *      (`playGame`), pour six clubs dont trois portent des cartes : tirs pour et contre, buts, punitions, minutes
 *      à quatre contre cinq, mises en échec attendues.
 *   2. LA DIFFÉRENCE D'UN EFFET. `effetEnChiffres` égale l'écart mesuré EN PAIRES (le même club, les mêmes dés,
 *      avec l'effet et sans) pour une grille d'effets : un volume, une défensive, une finition, la discipline, la
 *      robustesse, des minutes de trio.
 *   3. LA FORME. Les mots disent des matchs, jamais un « % » ; l'unité « par match » y est ; un effet sans canal
 *      de match ne dit rien d'inventé.
 *   4. LIRE NE CHANGE RIEN. Lire les chiffres chaque matin ne change pas une seule journée, et la lecture rend
 *      l'équipe telle qu'elle l'a reçue.
 *
 * Lent (une minute et demie) : il se lance à la main, comme check_cartes.
 *
 *   node scripts/check_chiffres.mjs
 *   MATCHS=3000 node scripts/check_chiffres.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJournee, bilanLigue, playGame, feuilleVierge,
  grainerHasard, activeLineup, profilMatch, coupsAttendus, CARTES } from '../js/sim.js';
import { chiffresDuSoir, effetEnChiffres, motsDuSoir, systemeEnChiffres, agressiviteEnChiffres, motsEnChiffres, poserClubLu } from '../js/impact.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const MATCHS = Number(process.env.MATCHS ?? 1500);
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed, n) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const et = a => { const m = moy(a); return Math.sqrt(moy(a.map(x => (x - m) ** 2))); };
const f2 = x => (Math.round(x * 100) / 100).toString();

/* Un match joué pour de vrai, sans rien inscrire à la saison : ce que le moteur donne CE soir, avec sa feuille. */
function jouer(A, B, i, graine) {
  A.luck = 0; B.luck = 0;   // la « chance » d'une saison n'est pas dans les chiffres du soir
  // Les bagarres usent les jambes même sans le suivi : chaque soir est joué avec des jambes de 100, comme celui qu'on lit.
  for (const t of [A, B]) for (const sl of SLOTS) { const p = t.roster[sl.i]; if (p) { p.energie = 100; delete p._reserve; } }
  grainerHasard(`${graine}:${i}`);
  const J = feuilleVierge();
  const r = playGame(A, B, i, false, false, J);
  A.injured.clear(); B.injured.clear();   // le moteur blesse même sans le suivi : on garde le même alignement
  const mine = J.punitions.filter(x => x.cote === 'A');
  const leurs = J.punitions.filter(x => x.cote === 'B');
  // Le but de la prolongation n'est pas un but du temps réglementaire.
  const butA = r.ot && r.gfA > r.gfB ? r.gfA - 1 : r.gfA, butB = r.ot && r.gfB > r.gfA ? r.gfB - 1 : r.gfB;
  return {
    tirsPour: J.lancers.filter(l => l.cote === 'A').length, tirsContre: J.lancers.filter(l => l.cote === 'B').length,
    butsPour: butA, butsContre: butB,
    punitions: mine.length, minutesAvantage: leurs.reduce((a, x) => a + (x.fin - x.instant), 0), minutesDesavantage: mine.reduce((a, x) => a + (x.fin - x.instant), 0),
    coups: J.coups.A,
  };
}
const CLES = ['tirsPour', 'tirsContre', 'butsPour', 'butsContre', 'punitions', 'minutesAvantage', 'minutesDesavantage', 'coups'];
function joues(A, B, n, graine) {
  const lignes = Array.from({ length: n }, (_, i) => jouer(A, B, i, graine));
  return Object.fromEntries(CLES.map(k => [k, { m: moy(lignes.map(l => l[k])), se: et(lignes.map(l => l[k])) / Math.sqrt(n), v: lignes.map(l => l[k]) }]));
}

console.log('\n  L\'IMPACT EN CHIFFRES DE MATCH\n');

/* 1. Le niveau du soir contre des milliers de vrais matchs. */
{
  const clubs = ligue(31337, 12);
  const avecCartes = [['bloc', 'fougue'], ['chasse', 'cadenas'], ['newjersey', 'vagues']];
  clubs.forEach((t, i) => { if (i >= 3 && i < 6) t.cartes = avecCartes[i - 3].filter(c => CARTES[c]); });
  const ecarts = [];
  for (let i = 0; i < 6; i++) {
    const A = clubs[i], B = clubs[i + 6];
    const ch = chiffresDuSoir(A, null, B);
    const J = joues(A, B, MATCHS, `niveau${i}`);
    for (const k of CLES) {
      const tol = 3.5 * J[k].se + (k.startsWith('buts') ? 0.02 : 0.01) * Math.abs(J[k].m) + (k === 'coups' ? 0.6 : 0);
      const ok = Math.abs(ch[k] - J[k].m) <= tol;
      ecarts.push(ok);
      if (!ok || k === 'tirsPour' || k === 'butsPour') informer(`club ${i + 1} · ${k}`, `${f2(ch[k])} annoncés, ${f2(J[k].m)} joués (± ${f2(J[k].se)})`);
      exiger(`club ${i + 1} · ${k} : annoncé = joué`, ok, `${f2(ch[k])} contre ${f2(J[k].m)} sur ${MATCHS} matchs (tolérance ${f2(tol)})`);
    }
  }
  exiger('les 48 niveaux du soir tiennent', ecarts.every(Boolean), `${ecarts.filter(Boolean).length} sur ${ecarts.length}`);
}

/* 2. La différence d'un effet : la même équipe, les mêmes dés, avec et sans. */
{
  const [A, B] = ligue(4242, 2);
  const EFFETS = [
    ['Tirs +10 %', { volume: 1.10 }], ['Tirs −10 %', { volume: 0.90 }], ['Défense −10 %', { defense: 0.90 }], ['Défense +10 %', { defense: 1.10 }],
    ['Précision +10 %', { finition: 1.10 }], ['Punitions +30 %', { discipline: 1.30 }], ['Punitions −30 %', { discipline: 0.70 }],
    ['Robustesse +1', { robustesse: 1 }], ['4e trio +30 %', { F: [1, 1, 1, 1.3] }],
  ];
  const sans = joues(A, B, MATCHS, 'paires'), zs = [];
  for (const [nom, e] of EFFETS) {
    A._effetMatch = [e];
    const avec = joues(A, B, MATCHS, 'paires');
    delete A._effetMatch;
    const lu = (() => {
      const base = chiffresDuSoir(A, null, B);
      A._effetMatch = [e];
      const av = chiffresDuSoir(A, null, B);
      delete A._effetMatch;
      return Object.fromEntries(CLES.map(k => [k, av[k] - base[k]]));
    })();
    // Deux échantillons indépendants (les dés se désynchronisent dès que `p` change) : l'écart se juge à son bruit.
    for (const [k, plancher] of [['tirsPour', 0.05], ['tirsContre', 0.05], ['butsPour', 0.02], ['butsContre', 0.02], ['punitions', 0.05]]) {
      const se = Math.hypot(avec[k].se, sans[k].se), ecart = avec[k].m - sans[k].m, tol = 3.5 * se + plancher;
      zs.push((lu[k] - ecart) / se);
      exiger(`${nom} · ${k}`, Math.abs(lu[k] - ecart) <= tol, `annoncé ${f2(lu[k])}, mesuré en paires ${f2(ecart)} (± ${f2(se)} de bruit)`);
    }
    // Ce que l'écran dit, mot pour mot.
    const mots = effetEnChiffres(e, A, null, B).map(m => m.txt);
    informer(`${nom}, à l'écran`, mots.join(' · ') || '—');
  }
  // Pris ensemble, les écarts sont du bruit : centrés sur zéro, d'un écart type d'environ un.
  const m = moy(zs), rms = Math.sqrt(moy(zs.map(z => z * z)));
  borne('les écarts annoncé − mesuré sont centrés (moyenne en écarts types)', m, -0.6, 0.6);
  borne('… et ne sont que du bruit (écart type des écarts)', rms, 0, 1.5);
}

/* 3. La forme des mots. */
{
  const [A] = ligue(9, 1);
  const tous = [
    { volume: 1.07 }, { finition: 0.95, defense: 0.94 }, { discipline: 1.25 }, { blessure: 0.65 }, { energie: 1.15 }, { robustesse: -0.5 },
    { F: [1.1, 1, 1, 0.8] }, { D: [1.08, 1, 0.9] }, { volume: 1.0005 }, { volume: 1.07, finition: 1.05, defense: 0.95, discipline: 0.9, blessure: 0.8, energie: 0.95, robustesse: 0.5 },
  ];
  const mots = tous.flatMap(e => effetEnChiffres(e, A));
  exiger('aucun mot d\'effet ne contient « % »', mots.every(m => !m.txt.includes('%')), `${mots.length} mots`);
  exiger('chaque mot dit un chiffre de match, ou « à peine perceptible »', mots.every(m => /^≈ [+−]\d|à peine perceptible|≈ 1 but|glace presque inchangée|min de glace/.test(m.txt)), mots.slice(0, 3).map(m => m.txt).join(' | '));
  exiger('l\'unité de match est toujours dite', mots.filter(m => /^≈ [+−]\d/.test(m.txt)).every(m => /par match|par saison|sur \d+ match/.test(m.txt)), '');
  exiger('un effet sans canal ne dit rien', effetEnChiffres({ mutation: 'x' }, A).length === 0 && effetEnChiffres({}, A).length === 0 && effetEnChiffres(null, A).length === 0);
  const un = effetEnChiffres({ volume: 1.07 }, A, null, null, { part: 1 / 3, par: 'en 3e' });
  exiger('une 3e période se dit « en 3e », au tiers', un.length > 0 && un.every(m => m.txt.includes('en 3e')), un.map(m => m.txt).join(' | '));
  const dur = effetEnChiffres({ blessure: 0.5 }, A, null, null, { duree: 6 });
  exiger('une blessure se dit sur la durée du choix', dur.some(m => /sur 6 matchs/.test(m.txt)), dur.map(m => m.txt).join(' | '));
  // Sans club lu, `motsEnChiffres` garde les mots d'avant ; avec lui, il dit des matchs.
  poserClubLu(null);
  const avant = motsEnChiffres({ volume: 1.07 });
  poserClubLu(() => ({ team: A }));
  const apres = motsEnChiffres({ volume: 1.07 }, 4);
  poserClubLu(null);
  exiger('sans club, les mots d\'avant ; avec lui, des matchs et la durée', avant.some(m => m.txt.includes('%')) && apres.some(m => m.txt.includes('par match')) && apres.some(m => m.duree), `${avant[0].txt} → ${apres.map(m => m.txt).join(' | ')}`);
  // Systèmes et agressivité : en mises en échec, en punitions, en tirs.
  const L = [0, 1, 2, 3].map(() => ({ tac: 'hourra', tacD: 'hourra', agr: 1, sec: 60 }));
  const agr = agressiviteEnChiffres(A, null, null, L, 0, 3);
  exiger('rentre-dedans : des mises en échec de plus, dites en matchs', agr.some(m => m.cle === 'coup' && /\+/.test(m.txt)) && agr.every(m => !m.txt.includes('%')), agr.map(m => m.txt).join(' | '));
  const sys = systemeEnChiffres(A, null, null, L, 0, 'F', 'echec');
  informer('un système de trio, à l\'écran', sys.map(m => m.txt).join(' · ') || '—');
  exiger('un système se dit en matchs', sys.every(m => !m.txt.includes('%')), sys.map(m => m.txt).join(' | '));
}

/* 4. Lire ne change rien. */
{
  const decisions = [{ jour: 0, equipe: 0, carte: 'bloc' }, { jour: 0, equipe: 0, carte: 'fougue' }];
  let rendue = true;
  const joue = lire => {
    const teams = ligue(7800, 32);
    const L = creerLigue(teams, 82, { graine: 'chiffres-rejeu', decisions });
    while (!L.fini) {
      if (lire && L.jour % 4 === 0) {
        const t = teams[0], avant = [t.cartes, t.patrons, t.effets, t.lignes, t._effetMatch, t._lignesMatch, t.roulement, t.coachs];
        chiffresDuSoir(t); motsDuSoir(t, null, null, []); effetEnChiffres({ volume: 1.1, defense: 0.9 }, t);
        systemeEnChiffres(t, null, null, [0, 1, 2, 3].map(() => ({ tac: 'hourra', tacD: 'hourra', agr: 1, sec: 60 })), 1, 'F', 'echec');
        rendue = rendue && [t.cartes, t.patrons, t.effets, t.lignes, t._effetMatch, t._lignesMatch, t.roulement, t.coachs].every((x, i) => x === avant[i]);
      }
      jouerJournee(L);
    }
    bilanLigue(L);
    return teams.map(x => `${x.W}-${x.L}-${x.OTL}-${x.GF}-${x.GA}`).join('|');
  };
  exiger('lire les chiffres chaque quatrième matin ne change pas une seule journée', joue(true) === joue(false));
  exiger('la lecture rend l\'équipe telle qu\'elle l\'a reçue', rendue);
  const t = ligue(5, 1)[0];
  const P = profilMatch(t, activeLineup(t));
  exiger('la lecture d\'un soir ne touche pas au profil du moteur', coupsAttendus(P) === chiffresDuSoir(t).coups, f2(coupsAttendus(P)));
  borne('un club ordinaire : des tirs de ligue', chiffresDuSoir(t).tirsPour, 20, 38);
}

verdict();
