/*
 * LA PRODUCTION SE RÉPARTIT-ELLE COMME DANS LA VRAIE VIE ?
 *
 * Le moteur reproduit bien le TOTAL d'une équipe — `check_feuilles.mjs` tient
 * les 28,5 lancers et les 3,1 buts par match. Ce script pose l'autre moitié
 * de la question : ce total, est-il réparti entre les joueurs comme la vraie
 * saison l'a réparti ?
 *
 * JP, deux fois. Devant la fiche d'Alexander Semin 2009-10 (84 points réels,
 * 156 simulés) : *grosse déviation versus stats originales, ça devrait pas
 * s'éloigner autant*. Puis, S62, devant Blake Wheeler et Elias Lindholm :
 * *assurer que les joueurs soient pas trop au dessus de la mêlée, yé pas rare
 * actuellement qu'un joueur de 83 points en fasse genre 140, c'est trop*.
 *
 * LA PREMIÈRE VERSION DE CE SCRIPT MESURAIT LA MAUVAISE CHOSE, et c'est la
 * leçon du chantier. Elle comparait le POIDS OFFENSIF que `profilMatch` donne
 * à chaque unité (un nombre de forces égales) à la part des lancers RÉELS des
 * mêmes joueurs (un nombre toutes situations). Elle lisait donc vert — 0,99 à
 * 1,27 fois le réel — pendant que le moteur simulé donnait 37,9 % de ses
 * lancers au premier trio contre 33,7 % réels et 13,4 % au quatrième contre
 * 17,5 %. Le coupable était L'AVANTAGE NUMÉRIQUE, qui s'ajoute PAR-DESSUS les
 * trios (six lancers par match, 56 % au premier trio) et qu'aucune mesure ne
 * regardait. Ce qui se juge ici est donc le LANCER SIMULÉ, compté sur les
 * feuilles de match, toutes situations, par rang d'unité.
 *
 * Trois familles de repères :
 *
 *   1. LA PART PAR RANG D'UNITÉ — les lancers simulés d'un trio, contre les
 *      lancers réels des mêmes joueurs. Un rapport, donc affranchi de
 *      l'époque : une ligue à 4 buts par match et une à 3,1 le donnent pareil.
 *   2. LES PASSES — la part qui va aux défenseurs (29,7 % sur 55 saisons) et
 *      la corrélation entre le taux de passes réel d'un joueur et le simulé.
 *   3. LA QUEUE — combien de patineurs font une fois et demie leurs points
 *      attendus. C'est le chiffre de la plainte de JP, et c'est celui qui doit
 *      rester petit.
 *
 * LE TIRAGE EST SEMÉ. Les 32 équipes d'une ligue se tirent dans 55 saisons :
 * au hasard, les repères bougeraient de ±3 points d'une exécution à l'autre et
 * ce garde-fou crierait pour du bruit. `GRAINE=...` rejoue exactement la même
 * mesure ; `LIGUES=n` en moyenne plusieurs.
 *
 *   node scripts/check_parts.mjs
 *   LIGUES=3 GRAINE=42 node scripts/check_parts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague, generateur,
  PART_UNITE, VOLUME_EXPOSANT, PASSE_D,
} from '../js/sim.js';
import { SEASON_LANCERS } from '../js/ratings.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const saisons = fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 4);
const GRAINE = process.env.GRAINE ?? 'parts';

const tirage = generateur(GRAINE);
const butsEpoque = s => { const t = SEASON_LANCERS[s] || [29, 10.5]; return t[0] * t[1] / 100; };
const lancersEpoque = s => (SEASON_LANCERS[s] || [29])[0];

/** Une ligue de 32 vraies équipes, tirées sous la graine. */
function batirLigue() {
  const equipes = [];
  const vus = new Set();
  let garde = 0;
  while (equipes.length < 32 && garde++ < 5000) {
    const shard = JSON.parse(fs.readFileSync(
      path.join(SEASONS_DIR, saisons[Math.floor(tirage() * saisons.length)]), 'utf8'));
    const tags = [...new Set(shard.players.map(p => p.t))];
    const tag = tags[Math.floor(tirage() * tags.length)];
    const cle = `${shard.season}|${tag}`;
    if (vus.has(cle)) continue;
    let unites;
    try { unites = equipeReelle(shard.season, tag); } catch { continue; }
    if (unites[0].length < 12 || unites[1].length < 6 || !unites[2].length) continue;
    vus.add(cle);
    const pool = unites.flat().map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    equipes.push(createTeam(`${tag} ${shard.season}`, tag, autoRoster(pool), { season: shard.season }));
  }
  // La graine du moteur est celle du tirage : la ligue entière se rejoue.
  const ligue = simulateLeague(equipes, 82, { graine: `${GRAINE}-${equipes.length}-${vus.size}` });
  equipes.feuilles = ligue.calendrier.flat().map(m => m.feuille);
  return equipes;
}

const toutes = [];
const feuilles = [];
for (let i = 0; i < LIGUES; i++) { const l = batirLigue(); toutes.push(...l); feuilles.push(...l.feuilles); }

/*
 * LES LANCERS SE COMPTENT SUR LES FEUILLES, par situation. C'est le seul
 * endroit qui dit dans quelle situation un lancer a été pris (`mode`), donc le
 * seul qui peut montrer que l'avantage numérique s'empile sur le premier trio.
 */
const parMode = new Map();
for (const f of feuilles) for (const l of f.lancers) {
  if (!l.tireur) continue;
  const m = parMode.get(l.tireur) || { FE: 0, AN: 0, DN: 0 };
  m[l.mode] = (m[l.mode] || 0) + 1;
  parMode.set(l.tireur, m);
}

/* Les totaux de la ligue simulée, calculés d'abord : la fiche de chaque
 * joueur se corrige de l'époque avec eux. */
let matchsTot = 0, butsTot = 0, lancersTot = 0;
for (const t of toutes) {
  matchsTot += t.games; butsTot += t.GF;
  for (const s of SLOTS) { const p = t.roster[s.i]; if (p && p.p !== 'G') lancersTot += p.simSH || 0; }
}
const butsSim = butsTot / Math.max(1, matchsTot);
const lancersSim = lancersTot / Math.max(1, matchsTot);

const zero = n => Array.from({ length: n }, () => 0);
const sim = { F: zero(4), D: zero(3) }, reel = { F: zero(4), D: zero(3) }, an = { F: zero(4), D: zero(3) };
let passesD = 0, passesT = 0, passesDreel = 0, passesTreel = 0;
const cas = [];

for (const t of toutes) {
  for (const s of SLOTS) {
    if (s.scratch || s.group === 'G') continue;
    const p = t.roster[s.i];
    if (!p) continue;
    const m = parMode.get(p) || { FE: 0, AN: 0, DN: 0 };
    const gp = Math.max(1, p.simGP || 1);
    sim[s.group][s.unit] += (m.FE + m.AN + m.DN) / gp;
    an[s.group][s.unit] += m.AN / gp;
    reel[s.group][s.unit] += (p.sh || 0) / Math.max(1, p.gp || 1);
    if (p.simA) { passesT += p.simA; if (p.p === 'D') passesD += p.simA; }
    if (p.a) { passesTreel += p.a; if (p.p === 'D') passesDreel += p.a; }
    // La fiche d'un joueur, à l'échelle d'une saison de 82 matchs, corrigée
    // de l'époque par les buts par match de la ligue simulée.
    if ((p.simGP || 0) >= 40 && (p.gp || 0) >= 40) {
      const facB = butsSim / butsEpoque(p.s), facL = lancersSim / lancersEpoque(p.s);
      cas.push({
        p,
        attPts: (p.pt || 0) / p.gp * 82 * facB, simPts: (p.simPTS || 0) / p.simGP * 82,
        attA: (p.a || 0) / p.gp * 82 * facB, simA: (p.simA || 0) / p.simGP * 82,
        attL: (p.sh || 0) / p.gp * 82 * facL, simL: (p.simSH || 0) / p.simGP * 82,
      });
    }
  }
}

const part = a => { const s = a.reduce((x, y) => x + y, 0); return a.map(x => 100 * x / s); };
const dit = a => a.map(x => x.toFixed(1)).join(' · ');

console.log(`\n  ${toutes.length} vraies équipes rejouées · graine « ${GRAINE} »`);
console.log(`  PART_UNITE F ${PART_UNITE.F.join(' · ')} · D ${PART_UNITE.D.join(' · ')} · VOLUME_EXPOSANT ${VOLUME_EXPOSANT}`);
console.log(`  ${butsSim.toFixed(2)} buts et ${lancersSim.toFixed(1)} lancers par équipe par match\n`);

for (const g of ['F', 'D']) {
  const s = part(sim[g]), r = part(reel[g]), a = part(an[g]);
  informer(`${g} · part des lancers simulés`, dit(s));
  informer(`${g} · part des lancers réels`, dit(r));
  informer(`${g} · dont l'avantage numérique`, dit(a));
  for (let u = 0; u < s.length; u++) {
    /*
     * L'INTERVALLE SUIT LA MESURE. À quatre ligues, chaque rang lit entre 0,97
     * et 1,03 fois le réel ; une ligue seule bouge de ±0,03. La borne 0,90 à
     * 1,12 attrape ce que le chantier a corrigé — 1,12 au premier trio et 0,77
     * au quatrième — sans crier pour du bruit.
     */
    borne(`${g}${u + 1} · lancers, part du réel`, s[u] / r[u], 0.90, 1.12, ' fois');
  }
}

/* ---------- les passes ---------- */
borne('passes aux défenseurs', 100 * passesD / passesT, 26, 32, ' %');
informer('passes aux défenseurs, réel', `${(100 * passesDreel / passesTreel).toFixed(1)} % (PASSE_D = ${PASSE_D})`);
const cor = (xs, ys) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sx += (xs[i] - mx) ** 2; sy += (ys[i] - my) ** 2; }
  return sxy / Math.sqrt(sx * sy);
};
/*
 * La propension à la passe était SANS ÉCHELLE — la part de passes dans les
 * points — donc un ailier de premier trio récoltait la même part des passes
 * de son trio quel que soit son propre taux : Lindholm 2021-22 sortait à 81
 * passes pour 42 réelles, à côté de Gaudreau. Elle est maintenant le TAUX de
 * passes du joueur (`passesRel`, le canal de la création), et la corrélation
 * le dit : 0,80 avant, 0,84 après.
 */
borne('corrélation taux de passes réel / simulé', cor(cas.map(c => c.attA), cas.map(c => c.simA)), 0.78, 0.95);
informer('corrélation des lancers', cor(cas.map(c => c.attL), cas.map(c => c.simL)).toFixed(3));

/* ---------- la queue : les joueurs trop au-dessus de la mêlée ---------- */
const gros = cas.filter(c => c.attPts >= 40);
const gonfles = gros.filter(c => c.simPts >= 1.5 * c.attPts);
/*
 * LE CHIFFRE DE LA PLAINTE, et il est BRUITÉ : un joueur de 40 points attendus
 * a 8 % d'écart-type sur ses points, donc la queue bouge avec le tirage. Mesuré
 * à quatre ligues sur cinq graines : 0,09 à 0,56 % après le chantier, 0,27 à
 * 1,37 % avant. La borne à 1 % est donc un FILET, pas le juge — le juge est la
 * part par rang d'unité ci-dessus, qui lit 0,76 fois le réel au quatrième trio
 * avant le chantier et 0,98 après, sur toutes les graines.
 */
borne('patineurs à 1,5 fois leurs points attendus', 100 * gonfles.length / Math.max(1, gros.length), 0, 1.0, ' %');
for (const e of gonfles.slice(0, 4)) {
  informer(`  ${e.p.n} ${e.p.s}`, `${e.simPts.toFixed(0)} points simulés contre ${e.attPts.toFixed(0)} attendus (réel ${e.p.pt} en ${e.p.gp})`);
}

/*
 * LA CONCENTRATION, en un nombre : ce que le dixième décile de production
 * garde de ses points attendus, divisé par ce que le cinquième en garde. À 1,
 * le moteur traite les vedettes et le milieu de la même façon. Avant le
 * chantier : 1,29 (les vedettes gardaient 96 % de leur production et le
 * milieu 70 %). Après : 1,05.
 */
const tri = cas.slice().sort((a, b) => a.attPts - b.attPts);
const rapport = (d) => {
  const lot = tri.slice(Math.floor(d * tri.length / 10), Math.floor((d + 1) * tri.length / 10));
  return lot.reduce((a, c) => a + c.simPts, 0) / Math.max(1, lot.reduce((a, c) => a + c.attPts, 0));
};
const deciles = Array.from({ length: 10 }, (_, d) => rapport(d));
informer('points gardés par décile', deciles.map(x => x.toFixed(2)).join(' · '));
/*
 * S'INFORME PLUTÔT QUE DE SE JUGER, et c'est un choix motivé : mesuré à quatre
 * ligues sur cinq graines, ce rapport lit 1,06 à 1,16 après le chantier et 1,08
 * à 1,15 avant — les deux intervalles se chevauchent, donc une borne ici
 * crierait pour du bruit sans rien attraper. Il se lit parce qu'il dit d'un
 * coup d'oeil ce que le chantier a corrigé (0,89 · 0,87 · 0,88 … 0,94 · 0,89
 * après, contre 0,84 · 0,80 · 0,82 … 1,01 · 0,94 avant, où le milieu était
 * écrasé et le haut intact).
 */
informer('concentration (10e décile / 5e)', `${(deciles[9] / deciles[4]).toFixed(3)} fois`);

verdict('La répartition de la production');
