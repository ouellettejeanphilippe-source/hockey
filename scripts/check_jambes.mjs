/*
 * LES JAMBES (1.0, C3) — la profondeur contre les vedettes.
 *
 * JP : *je veux variété de build, pas trop simple, complexe mais clair*. Les
 * jambes (sur 100) sont le prix de pousser son premier trio : plus de glace,
 * une agressivité haute, un système qui use, et le trio s'use plus vite qu'il
 * ne récupère. Ce script mesure trois choses, EN PAIRES (la même ligue deux
 * fois sous la même graine, le réglage aux rangs pairs puis aux impairs —
 * la méthode de check_cartes.mjs) :
 *
 *   1. les jambes du matin du 1er trio : réglé par défaut (60 s, l'agressivité
 *      que l'IA choisit), et poussé (80 s, rentre-dedans, un soir important
 *      sur deux) — la cible est 90-95 et 75-85 ;
 *   2. un jour de congé rend des jambes (une ligue impaire en a) ;
 *   3. ce que valent, à talent égal, le 1er trio poussé et les quatre trios
 *      roulés (le banc profond, 60 s partout) : quelque chose, pas la saison.
 *
 * Et la même mesure avec les jambes SANS effet (ENERGIE_EFFET=0 dans un fils)
 * pour montrer que ce sont bien les jambes qui font payer le trio poussé.
 *
 *   node scripts/check_jambes.mjs
 *   LIGUES=8 node scripts/check_jambes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJournee, bilanLigue, joueursDeLigne, activeLineup,
  energieDe, facteurEnergie, jambesEquilibre, usuresDe, recupererEnergie, rendreJambes, depenserEnergie, ENERGIE_SEUIL, ENERGIE_C } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { borne, exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 4);
const FILS = process.env.JAMBES_FILS === '1';
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const signe = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);

/* Les réglages mesurés. `null` : ce que l'IA joue d'elle-même. */
const REGLAGES = {
  // Le 1er trio poussé : 80 s (le max est 90), rentre-dedans, et un soir important sur deux.
  pousse: { lignes: t => [80, 58, 50, 42].map((sec, u) => ({ tac: undefined, agr: u === 0 ? 3 : undefined, sec })), importance: true },
  // Les quatre trios roulés : le banc profond, 60 s partout, agressivité moyenne.
  roule: { lignes: t => [60, 60, 60, 60].map(sec => ({ tac: undefined, agr: 1, sec })), roulement: 'profond' },
};

/* Une saison jouée au jour le jour : les jambes du matin du 1er trio, et du 4e. */
function saison(teams, graine, decisions, suivis) {
  const L = creerLigue(teams, 82, { graine, decisions });
  const matins = new Map(suivis.map(i => [i, { l1: [], l4: [], f1: [] }]));
  while (!L.fini) {
    for (const i of suivis) {
      const t = teams[i], lu = activeLineup(t), m = matins.get(i);
      const trio = u => Object.entries(joueursDeLigne(lu, u)).filter(([r, p]) => p && r !== 'DG' && r !== 'DD').map(([, p]) => p);
      m.l1.push(moy(trio(0).map(energieDe))); m.l4.push(moy(trio(3).map(energieDe))); m.f1.push(moy(trio(0).map(facteurEnergie)));
    }
    jouerJournee(L);
  }
  bilanLigue(L);
  return matins;
}

function paires(cle) {
  const R = REGLAGES[cle];
  const dv = [], dbp = [], dbc = [], l1 = [], l1t = [], l4 = [], f1 = [];
  for (let n = 0; n < LIGUES; n++) {
    const bras = [];
    for (const parite of [0, 1]) {
      const teams = ligue(7000 + n);
      const traites = teams.map((t, i) => i).filter(i => i % 2 === parite);
      const decisions = [];
      for (const i of traites) {
        decisions.push({ jour: 0, equipe: i, lignes: R.lignes(teams[i]), ...(R.roulement ? { roulement: R.roulement } : {}) });
        if (R.importance) for (let j = 1; j < 90; j += 2) decisions.push({ jour: j, equipe: i, match: { importance: 'haute', ad: 0 } });
      }
      const suivis = teams.map((t, i) => i);
      const m = saison(teams, `jambes-${n}`, decisions, suivis);
      bras.push(teams.map((t, i) => ({ W: t.W, GF: t.GF, GA: t.GA, traite: i % 2 === parite, m: m.get(i) })));
    }
    for (let i = 0; i < bras[0].length; i++) {
      const [a, b] = bras[0][i].traite ? [bras[0][i], bras[1][i]] : [bras[1][i], bras[0][i]];
      dv.push(a.W - b.W); dbp.push(a.GF - b.GF); dbc.push(a.GA - b.GA);
      // Les matins après la première semaine (l'équilibre est atteint en cinq jours).
      l1.push(moy(a.m.l1.slice(7))); l1t.push(moy(b.m.l1.slice(7))); l4.push(moy(a.m.l4.slice(7))); f1.push(moy(a.m.f1.slice(7)));
    }
  }
  return { v: moy(dv), bp: moy(dbp), bc: moy(dbc), l1: moy(l1), l1t: moy(l1t), l4: moy(l4), f1: moy(f1), n: dv.length };
}

if (FILS) {
  // Le fils : les deux réglages, jambes sans effet, en JSON sur la sortie.
  process.stdout.write(JSON.stringify({ pousse: paires('pousse'), roule: paires('roule') }));
  process.exit(0);
}

console.log(`\n  LES JAMBES — ${LIGUES} ligue(s) de 32, EN PAIRES\n`);

// 1. L'équilibre calculé : ce que la formule promet, ligne par ligne, avant de jouer.
{
  const t = ligue(99)[0], lu = activeLineup(t);
  t.lignes = [60, 60, 60, 60].map(() => ({ tac: undefined, agr: 1, sec: 60 }));
  const us = usuresDe(t, lu);
  const ms = us.F.map(jambesEquilibre);
  console.log(`  à l'équilibre, défaut (60 s, moyenne) : trios ${ms.map(x => x.toFixed(0)).join(' · ')} · paires ${us.D.map(jambesEquilibre).map(x => x.toFixed(0)).join(' · ')}`);
  t.lignes = [80, 58, 50, 42].map((sec, u) => ({ tac: undefined, agr: u === 0 ? 3 : 1, sec }));
  const up = usuresDe(t, lu);
  console.log(`  à l'équilibre, 1er trio à 80 s rentre-dedans : ${jambesEquilibre(up.F[0]).toFixed(0)} (un soir important : ${jambesEquilibre(up.F[0] * 1.12).toFixed(0)})`);
  exiger('à 60 s, un 1er trio dort au-dessus de 90', ms[0] > ENERGIE_SEUIL, ms[0].toFixed(1));
  // 2. Le repos : un jour de congé rend la moitié du manque ; un geste de repos garde son surplus.
  const p = Object.values(joueursDeLigne(lu, 0)).find(Boolean);
  p.energie = 80; recupererEnergie(t);
  exiger('un jour de congé rend la moitié du manque (80 → 90)', Math.abs(energieDe(p) - 90) < 1e-9, energieDe(p).toFixed(1));
  p.energie = 95; rendreJambes(p, 15);
  exiger('« jambes +15 » à 95 : 100, et 10 en réserve', energieDe(p) === 100 && p._reserve === 10, `${energieDe(p)} · réserve ${p._reserve}`);
  const avant = energieDe(p); depenserEnergie(t, lu);
  exiger('le prochain match brûle la réserve d\'abord', energieDe(p) > avant - ENERGIE_C * us.F[0] ** 2, `${energieDe(p).toFixed(1)} (sans réserve : ${(avant - ENERGIE_C * us.F[0] ** 2).toFixed(1)})`);
  delete p._reserve; p.energie = 100;
}

const P = paires('pousse'), Rr = paires('roule');
const ligne = (n, r) => console.log(`  ${n.padEnd(26)} ${signe(r.v).padStart(5)} V  ${signe(r.bp, 0).padStart(4)} BP  ${signe(r.bc, 0).padStart(4)} BC   jambes du 1er trio ${r.l1.toFixed(1)} (témoin ${r.l1t.toFixed(1)}) · 4e ${r.l4.toFixed(1)} · rendement ${(r.f1 * 100).toFixed(1)} %`);
ligne('1er trio poussé', P);
ligne('quatre trios roulés', Rr);

// 3. Sans effet des jambes : les mêmes paires, rejouées dans un fils (la constante se lit à l'import).
let sans = null;
try {
  const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, JAMBES_FILS: '1', ENERGIE_EFFET: '0' }, maxBuffer: 1 << 24 });
  sans = JSON.parse(String(out));
  ligne('poussé, jambes sans effet', sans.pousse);
} catch (e) { console.log('  (le fils sans jambes n\'a pas tourné : ' + e.message.split('\n')[0] + ')'); }

console.log('');
borne('jambes du matin, 1er trio par défaut', P.l1t, 90, 96);
borne('jambes du matin, 1er trio poussé', P.l1, 75, 86);
borne('jambes du matin, 4e trio (poussé ou pas, il dort)', P.l4, 94, 100.01);
exiger('pousser coûte des jambes au 1er trio', P.l1 < P.l1t - 5, `${P.l1.toFixed(1)} contre ${P.l1t.toFixed(1)}`);
borne('1er trio poussé · écart net', P.v, -3, 3, 'victoire');
borne('quatre trios roulés · écart net', Rr.v, -3, 3, 'victoire');
if (sans) {
  const cout = sans.pousse.v - P.v;
  informer('ce que les jambes coûtent au trio poussé', `${signe(cout)} V (${signe(sans.pousse.bp - P.bp, 0)} BP)`);
  if (LIGUES >= 4) exiger('les jambes font payer le trio poussé (sans elles, il vaut plus)', sans.pousse.bp > P.bp, `${sans.pousse.bp.toFixed(0)} BP contre ${P.bp.toFixed(0)}`);
}
verdict();
