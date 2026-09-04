/*
 * Le plafond : une équipe assemblée peut-elle faire 82-0 trop facilement ?
 *
 * mock_prod_sim.mjs ne fait jouer que de VRAIES équipes, dont la meilleure
 * fiche historique est 72 victoires. Le jeu, lui, laisse bâtir un alignement
 * avec les meilleurs joueurs de 55 saisons sous le plafond salarial. Rien ne
 * garantit que le modèle par production tienne au-delà du réel.
 *
 * Ce script prend une équipe de 23 joueurs de qualité uniforme, la met dans
 * une vraie saison contre les vraies équipes de l'année, joue 82 rondes, et
 * compte la fiche moyenne ET la fréquence du 82-0.
 *
 * Cible de CLAUDE.md : une équipe parfaite perd environ un match en moyenne,
 * et le 82-0 reste rare.
 *
 *   node scripts/mock_plafond.mjs
 *   SAISON=1976-77 ESSAIS=40 node scripts/mock_plafond.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');

const POIDS_TRIO = [0.34, 0.28, 0.22, 0.16];
const POIDS_PAIRE = [0.40, 0.34, 0.26];
const ECHELLE = Number(process.env.ECHELLE ?? 22);   // etalement de la production sur l'echelle des cotes
const EXPOSANT = 1.55;
const BASE_XG = 3.05;
const PM_MALUS = 14, PM_BONUS = PM_MALUS / 6, PM_PLAFOND = 0.18, LISSAGE_PM = 0.5;

const ESSAIS = Number(process.env.ESSAIS ?? 25);
const SAISONS = (process.env.SAISON ?? '1976-77,1995-96,2015-16').split(',');

const poisson = (lam) => { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

function pondere(js, poids, taille, cle) {
  let s = 0;
  for (let u = 0; u < poids.length; u++) {
    const t = js.slice(u * taille, (u + 1) * taille);
    s += poids[u] * (t.length ? moy(t.map(cle)) : 40);
  }
  return s;
}

/** Les vraies équipes d'une saison, avec leurs deux indices. */
function equipesReelles(shard) {
  const parEq = {};
  for (const p of shard.players) (parEq[p.t] = parEq[p.t] || []).push(p);
  const vus = new Set();
  const uniq = shard.players.filter(p => (vus.has(p.id) ? false : (vus.add(p.id), true)));
  const refF = moy(uniq.filter(p => p.p === 'F' && p.gp >= 20).map(p => p.pt / p.gp)) || 0.5;
  const refD = moy(uniq.filter(p => p.p === 'D' && p.gp >= 20).map(p => p.pt / p.gp)) || 0.3;

  const out = [];
  for (const [t, tous] of Object.entries(parEq)) {
    const prod = p => (p.pt / Math.max(1, p.gp)) / (p.p === 'D' ? refD : refF);
    const F = tous.filter(p => p.p === 'F' && p.gp >= 10).sort((a, b) => prod(b) - prod(a)).slice(0, 12);
    const D = tous.filter(p => p.p === 'D' && p.gp >= 10).sort((a, b) => prod(b) - prod(a)).slice(0, 6);
    const G = tous.filter(p => p.p === 'G').sort((a, b) => b.gp - a.gp);
    if (F.length < 9 || D.length < 4 || !G.length) continue;

    const align = [...F, ...D];
    const pmMoy = moy(align.map(p => (p.pm || 0) / Math.max(1, p.gp)));
    const ajust = (p) => {
      const pm = (p.pm || 0) / Math.max(1, p.gp) - LISSAGE_PM * pmMoy;
      return pm < 0 ? PM_MALUS * pm : PM_BONUS * Math.min(pm, PM_PLAFOND);
    };
    const ech = p => 50 + ECHELLE * (prod(p) - 1);

    out.push({
      t,
      attA: 0.62 * pondere(F, POIDS_TRIO, 3, p => p.o) + 0.38 * pondere(D, POIDS_PAIRE, 2, p => p.o),
      attD: 0.62 * pondere(F, POIDS_TRIO, 3, ech) + 0.38 * pondere(D, POIDS_PAIRE, 2, ech),
      defA: 0.62 * pondere(F, POIDS_TRIO, 3, p => p.d) + 0.38 * pondere(D, POIDS_PAIRE, 2, p => p.d),
      defD: 0.62 * pondere(F, POIDS_TRIO, 3, p => p.d + ajust(p)) + 0.38 * pondere(D, POIDS_PAIRE, 2, p => p.d + ajust(p)),
      g: 0.6 * G[0].o + 0.4 * G[0].d,
    });
  }
  return out;
}

/** 82 rondes : l'équipe du joueur (indice 0) contre les vraies de la saison. */
function saison(nous, adversaires) {
  const tous = [nous, ...adversaires];
  let V = 0, D = 0;
  for (let r = 0; r < 82; r++) {
    const ordre = [...tous.keys()];
    for (let i = ordre.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ordre[i], ordre[j]] = [ordre[j], ordre[i]]; }
    for (let i = 0; i + 1 < ordre.length; i += 2) {
      const a = ordre[i], b = ordre[i + 1];
      if (a !== 0 && b !== 0) continue;                  // seuls nos matchs comptent
      const A = tous[a], B = tous[b];
      const xA = Math.max(1.1, Math.min(7.5, BASE_XG * Math.pow(A.att / Math.max(20, 0.62 * B.def + 0.38 * B.g), EXPOSANT)));
      const xB = Math.max(1.1, Math.min(7.5, BASE_XG * Math.pow(B.att / Math.max(20, 0.62 * A.def + 0.38 * A.g), EXPOSANT)));
      let ga = poisson(xA), gb = poisson(xB);
      while (ga === gb) { if (Math.random() < 0.5) ga++; else gb++; }
      const nousGagnons = (a === 0) ? ga > gb : gb > ga;
      if (nousGagnons) V++; else D++;
    }
  }
  // le calendrier aléatoire ne donne pas exactement 82 matchs : on rapporte au prorata
  return { V, D, n: V + D };
}

/** Un match entre deux indices. Renvoie true si A gagne. */
function match(A, B) {
  const xA = Math.max(1.1, Math.min(7.5, BASE_XG * Math.pow(A.att / Math.max(20, 0.62 * B.def + 0.38 * B.g), EXPOSANT)));
  const xB = Math.max(1.1, Math.min(7.5, BASE_XG * Math.pow(B.att / Math.max(20, 0.62 * A.def + 0.38 * A.g), EXPOSANT)));
  let ga = poisson(xA), gb = poisson(xB);
  while (ga === gb) { if (Math.random() < 0.5) ga++; else gb++; }
  return ga > gb;
}

/** 4 de 7, comme playSeries. */
function serie(A, B) {
  let a = 0, b = 0;
  while (a < 4 && b < 4) { if (match(A, B)) a++; else b++; }
  return a === 4;
}

/** Saison complète de la ligue, puis séries à 16 équipes. */
function saisonEtSeries(nous, adversaires) {
  const tous = [nous, ...adversaires];
  const V = new Array(tous.length).fill(0);
  for (let r = 0; r < 82; r++) {
    const ordre = [...tous.keys()];
    for (let i = ordre.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ordre[i], ordre[j]] = [ordre[j], ordre[i]]; }
    for (let i = 0; i + 1 < ordre.length; i += 2) {
      const a = ordre[i], b = ordre[i + 1];
      if (match(tous[a], tous[b])) V[a]++; else V[b]++;
    }
  }
  const rang = [...tous.keys()].sort((x, y) => V[y] - V[x]);
  const nSeries = Math.min(16, tous.length - (tous.length % 2));
  const qualifies = rang.slice(0, nSeries);
  const notreRang = rang.indexOf(0);
  if (notreRang >= nSeries) return { qualifie: false, coupe: false, victoires: V[0] };
  let carre = qualifies.slice();
  while (carre.length > 1) {
    const suivant = [];
    for (let i = 0; i < carre.length / 2; i++) {
      const A = carre[i], B = carre[carre.length - 1 - i];
      suivant.push(serie(tous[A], tous[B]) ? A : B);
    }
    carre = suivant;
  }
  return { qualifie: true, coupe: carre[0] === 0, victoires: V[0] };
}

if (process.env.SERIES === '1') {
  console.log('\nChances de COUPE d\'une équipe de qualité uniforme (séries à 16, 4 rondes de 4 de 7).\n');
  for (const lab of SAISONS) {
    const f = path.join(SEASONS_DIR, `${lab}.json`);
    if (!fs.existsSync(f)) continue;
    const adv = equipesReelles(JSON.parse(fs.readFileSync(f, 'utf8')));
    if (adv.length < 17) { console.log(`  ${lab} : moins de 17 vraies équipes, sauté`); continue; }
    console.log(`--- ${lab} (${adv.length} vraies équipes) ---`);
    console.log('  niveau   fiche      séries   COUPE');
    for (const niveau of [60, 70, 80, 90, 99]) {
      const nous = { att: niveau, def: niveau, g: niveau };
      const ennemis = adv.map(a => ({ att: a.attD, def: a.defD, g: a.g }));
      let q = 0, c = 0, v = 0;
      for (let e = 0; e < ESSAIS; e++) {
        const r = saisonEtSeries(nous, ennemis);
        if (r.qualifie) q++; if (r.coupe) c++; v += r.victoires;
      }
      const n = adv.length + 1;
      console.log(`  ${String(niveau).padEnd(6)}  ${(v / ESSAIS * 82 / Math.round(82 * (n - (n % 2)) / n)).toFixed(0).padStart(2)}-${(82 - v / ESSAIS * 82 / Math.round(82 * (n - (n % 2)) / n)).toFixed(0).padStart(2)}   ${(100 * q / ESSAIS).toFixed(0).padStart(4)}%   ${(100 * c / ESSAIS).toFixed(0).padStart(4)}%`);
    }
    console.log();
  }
  process.exit(0);
}

console.log('\nÉquipe de 23 joueurs de qualité uniforme, contre les vraies équipes de la saison.');
console.log(`${ESSAIS} essais par palier. Cible CLAUDE.md : une équipe parfaite perd ~1 match, le 82-0 reste rare.\n`);

for (const lab of SAISONS) {
  const f = path.join(SEASONS_DIR, `${lab}.json`);
  if (!fs.existsSync(f)) { console.log(`  ${lab} : shard absent`); continue; }
  const adv = equipesReelles(JSON.parse(fs.readFileSync(f, 'utf8')));
  if (adv.length < 6) continue;
  const gMoy = moy(adv.map(a => a.g));

  console.log(`--- ${lab} (${adv.length} vraies équipes) ---`);
  console.log('  niveau        A : sous-cotes         D : production');
  for (const niveau of [50, 60, 70, 80, 90, 99]) {
    const lignes = [];
    for (const m of ['A', 'D']) {
      const nous = { t: 'NOUS', att: niveau, def: niveau, g: niveau };
      const ennemis = adv.map(a => ({ att: m === 'A' ? a.attA : a.attD, def: m === 'A' ? a.defA : a.defD, g: a.g }));
      let V = 0, D = 0, parfaits = 0;
      for (let e = 0; e < ESSAIS; e++) {
        const r = saison(nous, ennemis);
        const v82 = Math.round(r.V / r.n * 82), d82 = 82 - v82;
        V += v82; D += d82;
        if (d82 === 0) parfaits++;
      }
      lignes.push(`${(V / ESSAIS).toFixed(0)}-${(D / ESSAIS).toFixed(0)}  ${parfaits ? `82-0 : ${(100 * parfaits / ESSAIS).toFixed(0)}%` : '82-0 : 0%'}`);
    }
    console.log(`  ${String(niveau).padEnd(6)}  ${lignes[0].padEnd(24)} ${lignes[1]}`);
  }
  console.log();
}
