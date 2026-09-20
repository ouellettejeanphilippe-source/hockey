/*
 * CE QU'UNE CARTE DE SAISON VAUT — et pourquoi ça se mesure EN PAIRES.
 *
 * À trois paliers de la saison, on prend une carte parmi trois : un bonus
 * payé par un malus (`CARTES`, js/sim.js). Le contrat de conception tient en
 * une phrase — une carte change la FORME de ta saison, pas sa force — et il
 * se vérifie ici : chacune doit valoir moins d'UNE victoire d'écart net,
 * pendant que les buts marqués, les buts alloués et l'infirmerie, eux,
 * bougent pour de bon.
 *
 * POURQUOI DES PAIRES. Une saison à 82 matchs a un écart type de 4,5
 * victoires autour de son espérance, et une équipe tirée au hasard dans 55
 * saisons en a bien plus : comparer deux ligues indépendantes demanderait des
 * centaines d'essais pour lire UNE victoire. On joue donc la même ligue deux
 * fois sous la MÊME graine — la carte aux équipes de rang pair au premier
 * passage, aux impaires au second. Chaque équipe est mesurée avec la carte et
 * sans, contre le même champ, et la force de l'équipe (la plus grosse source
 * de variance) s'annule. Douze ligues font 384 paires, soit ±0,3 victoire.
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
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague, CARTES, PALIERS_CARTES, mainDeCartes } from '../js/sim.js';
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
 * sang-froid » (S60) est la première qui joue sur l'ARBITRE plutôt que sur le
 * tir, et sans cette colonne rien ne dirait qu'elle fait ce qu'elle promet —
 * son écart de victoires, lui, est nul par construction.
 */
const punitions = t => SLOTS.reduce((a, s) => a + ((t.roster[s.i] && t.roster[s.i].simPIM) || 0), 0);

function paires(cle) {
  const dv = [], dbp = [], dbc = [], dbl = [], dpun = [];
  for (let L = 0; L < LIGUES; L++) {
    const bras = [];
    for (const parite of [0, 1]) {
      const teams = ligue(1000 + L);
      const decisions = cle === null ? []
        : teams.map((_, i) => i).filter(i => i % 2 === parite).map(equipe => ({ jour: JOUR, equipe, carte: cle }));
      simulateLeague(teams, 82, { graine: `carte-${L}`, decisions });
      bras.push(teams.map(t => ({ W: t.W, GF: t.GF, GA: t.GA, bl: (t.injuriesLog || []).length, pun: punitions(t) })));
    }
    for (let i = 0; i < 32; i++) {
      const avec = bras[i % 2 === 0 ? 0 : 1][i], sans = bras[i % 2 === 0 ? 1 : 0][i];
      dv.push(avec.W - sans.W); dbp.push(avec.GF - sans.GF); dbc.push(avec.GA - sans.GA);
      dbl.push(avec.bl - sans.bl); dpun.push(avec.pun - sans.pun);
    }
  }
  return { v: moy(dv), bp: moy(dbp), bc: moy(dbc), bl: moy(dbl), pun: moy(dpun), err: err(dv), n: dv.length };
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
