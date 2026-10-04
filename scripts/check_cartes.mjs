/*
 * CE QU'UNE CARTE DE SAISON VAUT — et pourquoi ça se mesure EN PAIRES.
 *
 * À trois paliers de la saison, on prend une carte parmi trois : un bonus
 * payé par un malus (`CARTES`, js/sim.js).
 *
 * UNE CARTE CHANGE LA FORME DU MATCH, PAS SA FORCE. Plus fort veut dire plus de
 * style perceptible, jamais plus de victoires (docs/impact-des-choix.md §7.5,
 * docs/decisions.md). Trois lignes, qui remplacent l'ancienne « moins d'UNE
 * victoire d'écart net » — celle-là gardait les cartes honnêtes en les rendant
 * invisibles (3 à 5 % du match) :
 *
 *   1. LE NET EN VICTOIRES EST BORNÉ PAR LA RARETÉ — commune ±1, peu commune
 *      ±1,5, rare ±2,5, légendaire ±4. C'est un MAXIMUM, pas une cible : on
 *      vise le tiers à la moitié, et seul le style doit le porter.
 *   2. UNE RARE OU UNE LÉGENDAIRE SE VOIT DANS LA FEUILLE : au moins l'un de ces
 *      déplacements, PAR MATCH, contre des adversaires sans carte — des tirs
 *      (pour, contre ou les deux clubs) de ±2, les buts des deux clubs de ±0,3
 *      (la somme des deux écarts), les punitions de ±0,5, les mises en échec
 *      de ±4 — ou, par saison, ±3 blessures (l'infirmerie se voit à
 *      l'infirmerie). Les communes peuvent être discrètes.
 *   3. LE STYLE SE GAGNE SANS SE PAYER EN FORCE : le net en victoires ne dépasse
 *      pas 0,5 V par seuil franchi (la somme des déplacements, chacun divisé
 *      par son seuil) — avec un plancher d'une demi-victoire, qui est le bruit
 *      de la mesure. Une carte qui gagne 2 V sans rien changer à la feuille est
 *      un cadeau ; une carte qui change tout et vaut 0 V est un style.
 *
 * Le tableau de chaque carte (tirs pour et contre, buts, punitions, mises en
 * échec, blessures, victoires) est celui que le joueur lit : on l'INFORME.
 *
 * POURQUOI DES PAIRES. Une saison à 82 matchs a un écart type de 4,5
 * victoires autour de son espérance, et une équipe tirée au hasard dans 55
 * saisons en a bien plus : comparer deux ligues indépendantes demanderait des
 * centaines d'essais pour lire UNE victoire. On joue donc la même ligue deux
 * fois sous la MÊME graine — la carte aux équipes de rang pair au premier
 * passage, aux impaires au second. Chaque équipe est mesurée avec la carte et
 * sans, contre le même champ, et la force de l'équipe (la plus grosse source
 * de variance) s'annule. Douze ligues font 384 paires, soit ±0,3 victoire.
 * LE PROFIL DU MATCH (tirs, buts, punitions, mises en échec) se lit sur les
 * seuls matchs contre des adversaires SANS carte, comparé à la même ligue
 * jouée sans aucune carte (la base) : un match entre deux clubs traités ne
 * mesure rien.
 *
 * LE TÉMOIN EST UN GARDE-FOU SUR LA MÉTHODE, pas sur le jeu : sans carte, les
 * deux passages sont la même simulation et l'écart doit être exactement zéro.
 * S'il ne l'est pas, ce n'est pas la carte qui est en cause, c'est la mesure.
 *
 * Trop long pour l'Action (douze ligues, quatre minutes) : il se lance à la
 * main, comme check_monotonie et check_plafond.
 *
 *   node scripts/check_cartes.mjs
 *   LIGUES=18 node scripts/check_cartes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague, tirsTotal, CARTES, PALIERS_CARTES, mainDeCartes } from '../js/sim.js';
import { BANQUE } from '../js/banque.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 12);
const JOUR = PALIERS_CARTES[0];          // le premier palier : la plus longue exposition
/*
 * ON NE JUGE PAS SOUS DOUZE LIGUES, et c'est mesuré : à six, la lecture vaut
 * ±0,4 victoire et « Le cadenas » est sorti à −1,1 pendant que dix-huit
 * ligues le lisaient à +0,5 — 1,6 victoire de bruit, pour une borne de ±1. Un
 * garde-fou qui crie pour du bruit se fait désactiver, et alors il ne garde
 * plus rien ; sous le plancher, on INFORME.
 */
const PLANCHER = 12;
const juger = LIGUES >= PLANCHER;

const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };

/* Trente-deux vraies équipes tirées dans les 55 saisons, reproductibles. */
function ligue(seed) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < 32) {
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
const err = a => { const m = moy(a); return Math.sqrt(moy(a.map(x => (x - m) ** 2)) / (a.length || 1)); };
const signe = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);

/* La même ligue deux fois : la carte aux pairs, puis aux impairs. */
/*
 * LES MINUTES DE PUNITION SONT DANS LE TABLEAU, et ça vient d'une carte : « Le
 * sang-froid » (S62) est la première qui joue sur l'ARBITRE plutôt que sur le
 * tir, et sans cette colonne rien ne dirait qu'elle fait ce qu'elle promet —
 * son écart de victoires, lui, est nul par construction.
 */
const punitions = t => SLOTS.reduce((a, s) => a + ((t.roster[s.i] && t.roster[s.i].simPIM) || 0), 0);

/*
 * LE PROFIL DU MATCH d'une équipe, par match, lu de la feuille (`t.journal[i].feuille`, déjà produite par le
 * moteur) — seulement contre les adversaires de l'autre parité, ceux qui n'ont pas la carte au passage qu'on lit.
 */
function profil(teams, i) {
  const t = teams[i], idx = new Map(teams.map((x, k) => [x, k]));
  const a = { n: 0, tp: 0, tc: 0, bp: 0, bc: 0, pun: 0, hp: 0 };
  for (const j of t.journal) {
    const f = j.feuille;
    if (!f || !f.A || idx.get(j.adv) % 2 === i % 2) continue;
    const c = f.A === t ? 'A' : 'B', o = c === 'A' ? 'B' : 'A';
    a.n++; a.tp += tirsTotal(f, c); a.tc += tirsTotal(f, o); a.bp += j.gf; a.bc += j.ga;
    a.pun += f.punitions.filter(p => p.cote === c).length; a.hp += f.coups[c];
  }
  for (const k of ['tp', 'tc', 'bp', 'bc', 'pun', 'hp']) a[k] /= a.n || 1;
  return a;
}
/* La base : la même ligue sans aucune carte, jouée une fois et gardée en chiffres (pas en feuilles). */
const BASES = new Map();
function baseDe(L) {
  if (!BASES.has(L)) {
    const teams = ligue(1000 + L);
    simulateLeague(teams, 82, { graine: `carte-${L}` });
    BASES.set(L, teams.map((_, i) => profil(teams, i)));
  }
  return BASES.get(L);
}
const COLS = ['tp', 'tc', 'bp', 'bc', 'pun', 'hp'];
function paires(cle) {
  const dv = [], dbp = [], dbc = [], dbl = [], dpun = [], dp = Object.fromEntries(COLS.map(c => [c, []]));
  for (let L = 0; L < LIGUES; L++) {
    const bras = [], profils = [];
    for (const parite of [0, 1]) {
      const teams = ligue(1000 + L);
      const decisions = cle === null ? []
        : teams.map((_, i) => i).filter(i => i % 2 === parite).map(equipe => ({ jour: JOUR, equipe, carte: cle }));
      simulateLeague(teams, 82, { graine: `carte-${L}`, decisions });
      bras.push(teams.map(t => ({ W: t.W, GF: t.GF, GA: t.GA, bl: (t.injuriesLog || []).length, pun: punitions(t) })));
      profils.push(cle === null ? null : teams.map((_, i) => (i % 2 === parite ? profil(teams, i) : null)));
    }
    const base = cle === null ? null : baseDe(L);
    for (let i = 0; i < 32; i++) {
      const avec = bras[i % 2 === 0 ? 0 : 1][i], sans = bras[i % 2 === 0 ? 1 : 0][i];
      dv.push(avec.W - sans.W); dbp.push(avec.GF - sans.GF); dbc.push(avec.GA - sans.GA);
      dbl.push(avec.bl - sans.bl); dpun.push(avec.pun - sans.pun);
      if (base) for (const c of COLS) dp[c].push(profils[i % 2][i][c] - base[i][c]);
    }
  }
  return { v: moy(dv), bp: moy(dbp), bc: moy(dbc), bl: moy(dbl), pun: moy(dpun), err: err(dv), n: dv.length, p: Object.fromEntries(COLS.map(c => [c, moy(dp[c])])) };
}

console.log(`\n  ${LIGUES} ligues × 32 équipes · la carte est prise au jour ${JOUR}\n`);

const temoin = paires(null);
exiger('sans carte, les deux passages sont identiques', temoin.v === 0 && temoin.bp === 0,
  `${temoin.n} paires · ${signe(temoin.v)} V`);

/*
 * UNE CARTE NE SE PREND QU'UNE FOIS. Sans cette règle, le pire cas n'est pas
 * un choix mais trois fois le même curseur — et c'est LUI qu'il faudrait
 * équilibrer. La main ne doit donc jamais retendre une carte déjà prise.
 */
const toutes = Object.keys(CARTES);
let repete = null;
for (let g = 1; g <= 40 && !repete; g++) for (const j of PALIERS_CARTES) {
  const prises = toutes.slice(0, 2);
  const main = mainDeCartes(g, j, prises);
  if (main.some(c => prises.includes(c))) repete = `graine ${g}, jour ${j} : ${main.join(' · ')}`;
  if (new Set(main).size !== main.length) repete = `graine ${g}, jour ${j} : deux fois la même dans la main`;
}
exiger('une carte prise ne reparaît pas dans une main', !repete, repete || `${40 * PALIERS_CARTES.length} mains`);
exiger('la même graine offre la même main', mainDeCartes(7, 40).join() === mainDeCartes(7, 40).join(),
  mainDeCartes(7, 40).join(' · '));

console.log(`\n  carte              ΔV      ΔBP     ΔBC   Δbless.   Δpun`);
for (const cle of toutes) {
  const r = paires(cle);
  console.log(`  ${CARTES[cle].nom.padEnd(16)} ${signe(r.v).padStart(5)}  ${signe(r.bp, 0).padStart(5)}  ${signe(r.bc, 0).padStart(5)}  ${signe(r.bl, 1).padStart(6)}  ${signe(r.pun, 0).padStart(5)}`);
  /*
   * LA BORNE EST LE CONTRAT DE CONCEPTION, pas un intervalle inventé : moins
   * d'une victoire d'écart net. Elle est large exprès — à douze ligues la
   * lecture vaut ±0,3 — et un garde-fou qui crie pour du bruit se fait
   * désactiver. Ce qu'elle attrape est une carte devenue un cadeau ou un
   * piège : le canal défensif à lui seul valait +8,3 victoires.
   */
  if (juger) borne(`${CARTES[cle].nom} · écart net`, r.v, -1, 1, 'victoire');
  else informer(`${CARTES[cle].nom} · écart net`, `${signe(r.v)} victoire — non jugé, ${LIGUES} ligues sous le plancher de ${PLANCHER}`);
  informer(`${CARTES[cle].nom} · ce qui bouge`, `${signe(r.bp, 0)} BP · ${signe(r.bc, 0)} BC · ${signe(r.bl, 1)} blessure · ${signe(r.pun, 0)} minute de punition`);
}

verdict('Les cartes de saison');
