/*
 * LE FEU QUI S'ENTRETIENT — le premier combo du Rogue (V3.6). JP : *équilibré
 * ne veut pas dire impossible d'avoir des combinaisons mortelles ; je veux
 * juste éviter que ce soit facile*. Quatre pièces autour de la lancée
 * (`LANCEE`, js/sim.js) : ☄️ l'étincelle l'allume, 🪔 la braise la garde,
 * 💫 la traînée de poudre la propage dans la ligne, 🛍️ le vendeur de
 * chandails la paie. Ce qu'on exige, en paires (la même ligue Rogue sous la
 * même graine, la moitié des clubs traités, chacun lu contre le témoin) :
 *   1. chaque pièce SEULE reste sous la borne d'une rare (2,5 V) ;
 *   2. le combo vaut plus que la somme de ses pièces (il s'emboîte) ;
 *   3. le build complet (le feu sur les deux premières lignes) casse le jeu :
 *      des soirs de lancée par dizaines, des jetons par dizaines, des victoires
 *      que les pièces seules ne donnent pas — c'est la récompense du Rogue ;
 *   4. dans le 82-0, rien : sans la courbe du Rogue, pas un but ne bouge.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, joueursDeLigne, activeLineup, getPlayerKey } from '../js/sim.js';
import { BANQUE, PATRONS } from '../js/banque.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
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
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}

/*
 * LES BUILDS : sur la ligne u, le meilleur marqueur (au vrai rythme) porte ses cartes `tete`, ses compagnons
 * patineurs les cartes `autres`. `lignes` : combien de lignes, à partir du haut.
 */
const BUILDS = {
  etincelle: { lignes: 1, tete: ['etincelle'], autres: [] },
  braise: { lignes: 1, tete: ['braise'], autres: [] },
  poudre: { lignes: 1, tete: [], autres: ['poudre'], seul: true },
  combo: { lignes: 1, tete: ['etincelle', 'braise'], autres: ['poudre'], seul: true },
  complet: { lignes: 2, tete: ['etincelle', 'braise'], autres: ['poudre'] },
};
const rythme = p => ((p.gp || 0) > 0 ? (p.g || 0) / p.gp : 0);
function decisionsDu(team, e, build) {
  const B = BUILDS[build], lu = activeLineup(team), out = [];
  for (let u = 0; u < B.lignes; u++) {
    const js = Object.values(joueursDeLigne(lu, u)).filter(p => p && p.p !== 'G');
    const avants = js.filter(p => p.p !== 'D').sort((a, b) => rythme(b) - rythme(a));
    const tete = avants[0];
    if (!tete) continue;
    const mut = (p, cle) => out.push({ jour: 0, equipe: e, deck: 'atelier', mutation: { cle, joueur: getPlayerKey(p) } });
    for (const cle of B.tete) mut(tete, cle);
    // La traînée de poudre seule : sur le seul compagnon d'avant le plus près de la tête, comme une carte qu'on pose.
    const autres = js.filter(p => p !== tete);
    for (const p of B.seul ? autres.filter(p => p.p !== 'D').slice(0, 1) : autres) for (const cle of B.autres) mut(p, cle);
  }
  return out;
}
function saison(seed, par, build, courbe = true) {
  const teams = ligue(seed);
  const traites = build ? teams.map((_, i) => i).filter(i => i % 2 === par) : [];
  const decisions = traites.flatMap(e => decisionsDu(teams[e], e, build));
  const L = creerLigue(teams, 82, { graine: `combo:${seed}`, decisions, courbe });
  jouerJusqua(L, Infinity);
  const lu = teams.map(() => ({ v: 0, gf: 0, ga: 0, n: 0, lancees: 0 }));
  for (const jour of L.calendrier) for (const m of jour) {
    for (const [cote, T, O] of [['A', m.A, m.B], ['B', m.B, m.A]]) {
      const i = teams.indexOf(T);
      if (i % 2 !== par || teams.indexOf(O) % 2 === par) continue;
      const f = m.feuille, mien = cote === 'A' ? f.gfA : f.gfB, leur = cote === 'A' ? f.gfB : f.gfA;
      const o = lu[i];
      o.v += mien > leur ? 1 : 0; o.gf += mien; o.ga += leur; o.n++;
    }
    // Les soirs de lancée, sur TOUS les matchs du club : ce que le vendeur de chandails paierait.
    for (const [cote, T] of [['A', m.A], ['B', m.B]]) {
      const i = teams.indexOf(T);
      if (i % 2 === par && m.feuille.lancees) lu[i].lancees += m.feuille.lancees[cote].length;
    }
  }
  return { lu: lu.filter((_, i) => i % 2 === par), fiche: teams.map(t => `${t.W}-${t.L}-${t.OTL}-${t.GF}`).join(' ') };
}

const SEEDS = (process.env.SEEDS || '2000,2001,2002,2003,2004').split(',').map(Number);
const BORNE_RARE = 2.5;
const temoins = new Map();
const temoin = (seed, par) => { const k = `${seed}|${par}`; if (!temoins.has(k)) temoins.set(k, saison(seed, par, null)); return temoins.get(k); };
function mesurer(build) {
  const d = { v: 0, gf: 0, ga: 0, lancees: 0, lanceesTemoin: 0 };
  let k = 0;
  for (const seed of SEEDS) for (const par of [0, 1]) {
    const a = saison(seed, par, build), s = temoin(seed, par);
    a.lu.forEach((x, i) => {
      const y = s.lu[i];
      // Ramené à une saison de 82 matchs contre la ligue.
      d.v += (x.v / x.n - y.v / y.n) * 82; d.gf += (x.gf / x.n - y.gf / y.n) * 82; d.ga += (x.ga / x.n - y.ga / y.n) * 82;
      d.lancees += x.lancees; d.lanceesTemoin += y.lancees;
      k++;
    });
  }
  for (const c of Object.keys(d)) d[c] /= k;
  return d;
}
const f = x => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1).replace('.', ',')}`;
const lire = d => `${f(d.v)} V · buts ${f(d.gf)} / ${f(d.ga)} · soirs de lancée ${d.lancees.toFixed(0)} (témoin ${d.lanceesTemoin.toFixed(0)})`;

console.log('\n  LE FEU QUI S\'ENTRETIENT\n');

const M = {};
for (const b of Object.keys(BUILDS)) { M[b] = mesurer(b); informer(b, lire(M[b])); }

// 1. Chaque pièce seule : sous la borne d'une rare, et chacune fait ce qu'elle dit.
for (const cle of ['etincelle', 'braise', 'poudre']) {
  exiger(`${BANQUE[`joueur:${cle}`].ico} ${BANQUE[`joueur:${cle}`].nom} est une rare`, BANQUE[`joueur:${cle}`].rarete === 'rare', BANQUE[`joueur:${cle}`].rarete);
  borne(`${BANQUE[`joueur:${cle}`].nom} seule : le net en victoires reste sous la borne d'une rare`, Math.abs(M[cle].v), 0, BORNE_RARE);
  borne(`${BANQUE[`joueur:${cle}`].nom} seule : plus de soirs de lancée que le témoin`, M[cle].lancees - M[cle].lanceesTemoin, 0.5, 40);
}
exiger('🛍️ Le vendeur de chandails est une rare de la direction', PATRONS.dir_chandails.rarete === 'rare' && PATRONS.dir_chandails.role === 'direction', `${PATRONS.dir_chandails.rarete} · ${PATRONS.dir_chandails.role}`);
// Le vendeur seul paie les lancées du témoin : pas plus que l'autre rare de la direction, le proprio généreux (+2 🪙 par victoire, ≈ 80 🪙).
borne('🛍️ seul, sans autre pièce : 🪙 par saison (les lancées d\'un club ordinaire)', M.combo.lanceesTemoin * PATRONS.dir_chandails.econ.jetonsLancee, 2, 80);

// 2. Le combo s'emboîte : plus de soirs de lancée que les trois pièces seules additionnées.
const sommeSoirs = ['etincelle', 'braise', 'poudre'].reduce((a, c) => a + M[c].lancees - M[c].lanceesTemoin, 0);
borne('le combo d\'une ligne : ses soirs de lancée de plus, rapportés à la somme des pièces seules', (M.combo.lancees - M.combo.lanceesTemoin) / Math.max(1, sommeSoirs), 1.1, 20);

// 3. Le build complet casse le jeu : des soirs de lancée, des jetons, des victoires.
borne('le build complet : soirs de lancée par saison, rapportés au témoin', M.complet.lancees / Math.max(1, M.complet.lanceesTemoin), 3, 100);
informer('le build complet, avec le vendeur de chandails', `≈ ${Math.round(M.complet.lancees * PATRONS.dir_chandails.econ.jetonsLancee)} 🪙 par saison (témoin ${Math.round(M.complet.lanceesTemoin)})`);
borne('le build complet vaut plus en victoires que la meilleure pièce seule', M.complet.v - Math.max(M.etincelle.v, M.braise.v, M.poudre.v), 0.5, 30);

// 4. Le 82-0 n'a pas de lancée : le build complet n'y change pas un but.
{
  const a = saison(SEEDS[0], 0, 'complet', false), s = saison(SEEDS[0], 0, null, false);
  exiger('dans le 82-0, le build complet ne change pas un seul but', a.fiche === s.fiche, a.fiche === s.fiche ? 'les 32 fiches identiques' : 'une fiche a bougé');
}
verdict();
