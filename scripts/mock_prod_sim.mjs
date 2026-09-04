/*
 * Maquette hors ligne : la simulation par PRODUCTION RÉELLE vaut-elle mieux
 * que la simulation par sous-cotes ?
 *
 * Ne touche à rien. Lit les shards, reconstruit les 1396 équipes-saisons,
 * joue un VRAI CALENDRIER dans chaque saison — 82 rondes, les équipes de
 * l'année appariées au hasard, chaque match opposant deux vraies équipes,
 * comme simulateLeague — et compare la fiche simulée à la VRAIE fiche
 * (reconstituée des fiches de gardiens, comme check_ratings.mjs).
 *
 * CALENDRIER=0 revient au raccourci « contre un adversaire moyen ». Il est
 * plus rapide mais il COMPRIME les fiches : personne n'affronte de vraies
 * mauvaises équipes, donc les grandes équipes ne peuvent pas se détacher.
 * C'est un artefact de banc d'essai, pas un défaut de modèle — ne pas
 * conclure sur l'étalement à partir de ce mode.
 *
 * Quatre modèles comparés :
 *   A  attaque = sous-cote o          (ce que fait sim.js aujourd'hui)
 *   B  attaque = production calibrée sur la moyenne de sa saison
 *   C  B + ajustement +/- asymétrique (malus plein, bonus au sixième, borné)
 *   D  comme C, mais le +/- est lissé contre la moyenne du vestiaire
 *
 * La défensive reste sur la sous-cote d dans les quatre cas : aucune
 * statistique de l'époque ne la remplace.
 *
 * MISE EN GARDE — deux biais connus de ce banc d'essai :
 *
 * 1. La sous-cote d est DÉJÀ bâtie sur le +/-, déjà lissée à LISSAGE_EQUIPE
 *    contre le vestiaire (js/ratings.js, ligne ~558). Les modèles C et D
 *    comptent donc le +/- deux fois. Une partie du gain de C sur A n'est pas
 *    une découverte sur la défensive : c'est une fuite d'identité d'équipe
 *    réinjectée dans une mesure qui sert ensuite à prédire cette équipe.
 *
 * 2. Le banc prédit la fiche d'une ÉQUIPE, avec chaque joueur parmi ses vrais
 *    coéquipiers. Il ne peut donc pas voir le biais qui compte pour le jeu :
 *    un alignement bâti de joueurs de 1977, 1994 et 2019 importerait, avec un
 *    +/- brut, la qualité de vestiaires qui n'existent plus. C'est pour ça
 *    que LISSAGE_PM = 0,5 est recommandé malgré un rho marginalement moins
 *    bon que le +/- brut — l'écart est de l'ordre du bruit de Poisson.
 *
 *   node scripts/mock_prod_sim.mjs
 *   node scripts/mock_prod_sim.mjs 1976-77 1983-84   # + détail de ces saisons
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const detail = new Set(process.argv.slice(2));

/* ---------- constantes reprises de js/sim.js ---------- */
const POIDS_TRIO = [0.34, 0.28, 0.22, 0.16];
const POIDS_PAIRE = [0.40, 0.34, 0.26];
const EXPOSANT = 1.55;
const BASE_XG = 3.05;

/* Ajustement +/- : le malus vaut six fois le bonus, et le bonus sature.
 * Mesuré sur 1848 joueurs-saisons modernes (buts alloués/60 à forces égales) :
 *   +/- -20 et moins 3,55   |   0 à +10 : 2,37   |   +30 et plus : 2,23
 * Soit 0,88 but de -20 à 0, mais seulement 0,14 de 0 à +30. */
const PM_MALUS = Number(process.env.PM_MALUS ?? 14);          // points de défensive par (+/- par match) négatif
const PM_BONUS = PM_MALUS / 6;
const PM_PLAFOND = Number(process.env.PM_PLAFOND ?? 0.18);

/* Part de la moyenne du vestiaire retranchée du +/- avant l'ajustement.
 * 0 = +/- brut (le joueur porte la qualité de son club)
 * 1 = entièrement relatif à ses coéquipiers
 * Même curseur que LISSAGE_EQUIPE dans js/ratings.js, qui vaut 0,5. */
const LISSAGE_PM = Number(process.env.LISSAGE_PM ?? 0.5);
const ESSAIS_N = Number(process.env.ESSAIS ?? 5);      // ≈ +15 sur 82 matchs

const poisson = (lam) => {
  const L = Math.exp(-lam);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
};

const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

function spearman(x, y) {
  const rk = (a) => {
    const idx = [...a.keys()].sort((i, j) => a[i] - a[j]);
    const r = []; idx.forEach((v, i) => { r[v] = i; });
    return r;
  };
  const rx = rk(x), ry = rk(y), n = x.length;
  const mx = moy(rx), my = moy(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

/** Moyenne pondérée par unité : les 12 premiers attaquants, 6 premiers défenseurs. */
function pondere(joueurs, poids, taille, cle) {
  const parUnite = [];
  for (let u = 0; u < poids.length; u++) {
    const tranche = joueurs.slice(u * taille, (u + 1) * taille);
    parUnite.push(tranche.length ? moy(tranche.map(cle)) : 40);
  }
  return parUnite.reduce((s, v, i) => s + v * poids[i], 0);
}

/* ---------- construction des équipes ---------- */
function equipesDe(shard) {
  const parEquipe = {};
  for (const p of shard.players) (parEquipe[p.t] = parEquipe[p.t] || []).push(p);

  // Repères de la saison, sur joueurs uniques (les échangés x:1 portent leurs
  // totaux dans chaque équipe : on ne les compte qu'une fois pour la moyenne).
  const vus = new Set();
  const uniques = shard.players.filter(p => {
    if (vus.has(p.id)) return false;
    vus.add(p.id); return true;
  });
  const refF = moy(uniques.filter(p => p.p === 'F' && p.gp >= 20).map(p => p.pt / p.gp)) || 0.5;
  const refD = moy(uniques.filter(p => p.p === 'D' && p.gp >= 20).map(p => p.pt / p.gp)) || 0.3;

  const out = [];
  for (const [t, tous] of Object.entries(parEquipe)) {
    const prod = p => (p.pt / Math.max(1, p.gp)) / (p.p === 'D' ? refD : refF);
    const F = tous.filter(p => p.p === 'F' && p.gp >= 10).sort((a, b) => prod(b) - prod(a)).slice(0, 12);
    const D = tous.filter(p => p.p === 'D' && p.gp >= 10).sort((a, b) => prod(b) - prod(a)).slice(0, 6);
    const G = tous.filter(p => p.p === 'G').sort((a, b) => b.gp - a.gp);
    if (F.length < 9 || D.length < 4 || !G.length) continue;

    const v = G.reduce((s, g) => s + (g.w || 0), 0);
    const d = G.reduce((s, g) => s + (g.l || 0), 0);
    if (v + d < 20) continue;

    out.push({ t, saison: shard.season, F, D, G, prod, vraiPct: v / (v + d), vraiV: v, vraiD: d });
  }
  return out;
}

/* ---------- les trois indices d'attaque ---------- */
function indices(eq) {
  const { F, D, G, prod } = eq;

  // A — sous-cotes, comme aujourd'hui
  const attA = 0.62 * pondere(F, POIDS_TRIO, 3, p => p.o) + 0.38 * pondere(D, POIDS_PAIRE, 2, p => p.o);

  // B — production calibrée. Le ratio (1 = joueur moyen de sa saison) est
  // ramené sur la même échelle que les sous-cotes pour que la formule xG
  // reste comparable entre les modèles.
  const ech = p => 50 + 22 * (prod(p) - 1);
  const attB = 0.62 * pondere(F, POIDS_TRIO, 3, ech) + 0.38 * pondere(D, POIDS_PAIRE, 2, ech);

  // défensive commune aux trois
  const defBase = 0.62 * pondere(F, POIDS_TRIO, 3, p => p.d)
                + 0.38 * pondere(D, POIDS_PAIRE, 2, p => p.d);
  const gard = 0.6 * G[0].o + 0.4 * G[0].d;

  // C — ajustement +/- asymétrique
  const ajust = (p) => {
    const pm = (p.pm || 0) / Math.max(1, p.gp);
    return pm < 0 ? PM_MALUS * pm : PM_BONUS * Math.min(pm, PM_PLAFOND);
  };
  const dPM = 0.62 * pondere(F, POIDS_TRIO, 3, p => p.d + ajust(p))
            + 0.38 * pondere(D, POIDS_PAIRE, 2, p => p.d + ajust(p));

  // D — comme C, mais le +/- est mesuré contre la moyenne du vestiaire :
  // un joueur ne doit pas être crédité de la qualité de son club.
  const alignement = [...F, ...D];
  const pmMoyEq = moy(alignement.map(p => (p.pm || 0) / Math.max(1, p.gp)));
  const ajustEq = (p) => {
    const pm = (p.pm || 0) / Math.max(1, p.gp) - LISSAGE_PM * pmMoyEq;
    return pm < 0 ? PM_MALUS * pm : PM_BONUS * Math.min(pm, PM_PLAFOND);
  };
  const dPMeq = 0.62 * pondere(F, POIDS_TRIO, 3, p => p.d + ajustEq(p))
              + 0.38 * pondere(D, POIDS_PAIRE, 2, p => p.d + ajustEq(p));

  return {
    A: { att: attA, def: defBase, g: gard },
    B: { att: attB, def: defBase, g: gard },
    C: { att: attB, def: dPM, g: gard },
    D: { att: attB, def: dPMeq, g: gard },
  };
}

/** Vrai calendrier : 82 rondes, les équipes de la saison appariées au hasard,
 * chaque match opposant deux vraies équipes — comme simulateLeague. Une équipe
 * chôme par ronde quand le compte est impair. */
function joueSaison(indices, essais) {
  const n = indices.length;
  const V = new Array(n).fill(0), D = new Array(n).fill(0);
  for (let e = 0; e < essais; e++) {
    for (let r = 0; r < 82; r++) {
      const ordre = [...indices.keys()];
      for (let i = ordre.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
      }
      for (let i = 0; i + 1 < ordre.length; i += 2) {
        const a = ordre[i], b = ordre[i + 1];
        const A = indices[a], B = indices[b];
        const defA = 0.62 * A.def + 0.38 * A.g;
        const defB = 0.62 * B.def + 0.38 * B.g;
        const xA = Math.max(1.1, Math.min(7.5, BASE_XG * Math.pow(A.att / Math.max(20, defB), EXPOSANT)));
        const xB = Math.max(1.1, Math.min(7.5, BASE_XG * Math.pow(B.att / Math.max(20, defA), EXPOSANT)));
        let ga = poisson(xA), gb = poisson(xB);
        while (ga === gb) { if (Math.random() < 0.5) ga++; else gb++; }
        if (ga > gb) { V[a]++; D[b]++; } else { V[b]++; D[a]++; }
      }
    }
  }
  return indices.map((_, i) => V[i] / Math.max(1, V[i] + D[i]));
}

/** 82 matchs contre une équipe moyenne de sa saison. Poisson, comme sim.js. */
function joue82(att, def, gard, attMoy, defMoy, gMoy, essais = Number(process.env.ESSAIS ?? 5)) {
  let v = 0, d = 0;
  for (let e = 0; e < essais; e++) {
    for (let m = 0; m < 82; m++) {
      const dAdv = 0.62 * defMoy + 0.38 * (0.6 * gMoy + 0.4 * gMoy);
      const dNous = 0.62 * def + 0.38 * (0.6 * gard + 0.4 * gard);
      const xGF = Math.max(1.1, Math.min(7.5, BASE_XG * Math.pow(att / Math.max(20, dAdv), EXPOSANT)));
      const xGA = Math.max(1.1, Math.min(7.5, BASE_XG * Math.pow(attMoy / Math.max(20, dNous), EXPOSANT)));
      let gf = poisson(xGF), ga = poisson(xGA);
      while (gf === ga) { if (Math.random() < 0.5) gf++; else ga++; }
      if (gf > ga) v++; else d++;
    }
  }
  return v / (v + d);
}

/* ---------- passe principale ---------- */
const fichiers = fs.readdirSync(SEASONS_DIR).filter(f => f.endsWith('.json')).sort();
const lignes = [];

for (const f of fichiers) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const eqs = equipesDe(shard);
  if (eqs.length < 6) continue;

  const idx = eqs.map(indices);
  const CALENDRIER = process.env.CALENDRIER !== '0';
  for (const m of ['A', 'B', 'C', 'D']) {
    if (CALENDRIER) {
      const pcts = joueSaison(idx.map(i => i[m]), ESSAIS_N);
      eqs.forEach((eq, k) => { eq[`sim${m}`] = pcts[k]; });
    } else {
      const attMoy = moy(idx.map(i => i[m].att));
      const defMoy = moy(idx.map(i => i[m].def));
      const gMoy = moy(idx.map(i => i[m].g));
      eqs.forEach((eq, k) => {
        const i = idx[k][m];
        eq[`sim${m}`] = joue82(i.att, i.def, i.g, attMoy, defMoy, gMoy);
      });
    }
  }
  lignes.push(...eqs);
}

/* ---------- résultats ---------- */
const vrai = lignes.map(l => l.vraiPct);
console.log(`\n${lignes.length} équipes-saisons, ${fichiers.length} saisons\n`);
console.log('Corrélation de Spearman entre le % de victoires SIMULÉ et le VRAI :\n');
const noms = {
  A: 'A  sous-cotes o/d (sim.js actuel)',
  B: 'B  production calibrée + d',
  C: 'C  production + d + ajustement +/- brut',
  D: `D  comme C, +/- relatif au vestiaire (${LISSAGE_PM})`,
};
for (const m of ['A', 'B', 'C', 'D']) {
  const s = lignes.map(l => l[`sim${m}`]);
  const err = moy(lignes.map(l => Math.abs(l[`sim${m}`] - l.vraiPct) * 82));
  console.log(`  ${noms[m].padEnd(38)}  rho = ${spearman(s, vrai).toFixed(3)}   erreur moyenne ${err.toFixed(1)} victoires sur 82`);
}

console.log('\nÉtalement des fiches simulées (victoires sur 82) :');
for (const m of ['A', 'B', 'C', 'D']) {
  const w = lignes.map(l => l[`sim${m}`] * 82);
  console.log(`  ${m}  min ${Math.min(...w).toFixed(0)}  médiane ${w.sort((a, b) => a - b)[Math.floor(w.length / 2)].toFixed(0)}  max ${Math.max(...w).toFixed(0)}`);
}
const wv = lignes.map(l => l.vraiPct * 82).sort((a, b) => a - b);
console.log(`  vrai  min ${wv[0].toFixed(0)}  médiane ${wv[Math.floor(wv.length / 2)].toFixed(0)}  max ${wv[wv.length - 1].toFixed(0)}`);

/* témoins */
const TEMOINS = [
  ['1976-77', 'MTL'], ['1970-71', 'BOS'], ['1983-84', 'EDM'], ['1995-96', 'DET'],
  ['1976-77', 'DET'], ['1974-75', 'WSH'], ['1992-93', 'OTT'], ['2018-19', 'TBL'],
  ['2016-17', 'COL'], ['2021-22', 'FLA'],
];
console.log('\nÉquipes témoins — victoires sur 82 (le vrai est ramené au prorata) :\n');
console.log('  saison    éq    vrai     A     B     C     D');
for (const [s, t] of TEMOINS) {
  const l = lignes.find(x => x.saison === s && x.t === t);
  if (!l) { console.log(`  ${s}  ${t}   (absente)`); continue; }
  const f = (x) => (x * 82).toFixed(0).padStart(5);
  console.log(`  ${s}  ${t.padEnd(4)} ${f(l.vraiPct)} ${f(l.simA)} ${f(l.simB)} ${f(l.simC)} ${f(l.simD)}`);
}

for (const s of detail) {
  const eqs = lignes.filter(l => l.saison === s).sort((a, b) => b.vraiPct - a.vraiPct);
  if (!eqs.length) continue;
  console.log(`\n--- ${s} ---\n  éq    vrai     A     B     C     D`);
  for (const l of eqs) {
    const f = (x) => (x * 82).toFixed(0).padStart(5);
    console.log(`  ${l.t.padEnd(4)} ${f(l.vraiPct)} ${f(l.simA)} ${f(l.simB)} ${f(l.simC)} ${f(l.simD)}`);
  }
}
console.log();
