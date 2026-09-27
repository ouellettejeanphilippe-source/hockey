/*
 * LES LIGNES À LA HOCKEYARENA (S68) — chaque réglage doit PAYER ou COÛTER,
 * sans décider la saison. Mesuré EN PAIRES (voir check_cartes.mjs), contre
 * les réglages par défaut d'un club de l'IA (chaque ligne dans la tactique
 * où elle a le meilleur fit, agressivité moyenne, 60 secondes).
 *
 *   mal assorti      chaque ligne dans la tactique où elle a le PIRE fit
 *   hourra partout   aucun système : ni chimie, ni action spéciale
 *   rentre-dedans    agressivité maximale partout
 *   basse            agressivité minimale partout
 *   80 s au 1er trio la première ligne surutilisée : sa fatigue
 *
 * Le contrat : mal assortir COÛTE (au moins une victoire), aucun réglage ne
 * vaut plus de quatre victoires dans un sens ou dans l'autre, et le système
 * se VOIT — la part des buts sur action spéciale, des actions étouffées et
 * l'énergie de fin de saison sont imprimées.
 *
 *   node scripts/check_tactiques.mjs
 *   LIGUES=8 node scripts/check_tactiques.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, activeLineup, fitLigne, TACTIQUES, SLOTS, physiqueLigne } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { borne, exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 6);
const juger = LIGUES >= 6;
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
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
const signe = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const CLES = Object.keys(TACTIQUES).filter(k => k !== 'hourra');
const pire = (team, u) => { const L = activeLineup(team); return CLES.slice().sort((a, b) => fitLigne(L, u, a) - fitLigne(L, u, b))[0]; };

/*
 * `temoin` (S72) : ce que jouent les équipes SANS la décision. Par défaut,
 * les réglages de la ligue — qui choisissent maintenant eux-mêmes la
 * tactique et l'agressivité payantes. Pour éprouver un principe (le physique
 * décide de l'agressivité), on compare à un témoin fixe : « moyenne partout ».
 */
function paires(fabrique, temoin = null) {
  const dv = [], dbp = [], dbc = [], en = [];
  let spec = 0, etouf = 0, buts = 0;
  for (let L = 0; L < LIGUES; L++) {
    const bras = [];
    for (const parite of [0, 1]) {
      const teams = ligue(4000 + L);
      const decisions = teams.map((t, i) => [t, i])
        .filter(([, i]) => i % 2 === parite || temoin)
        .map(([t, i]) => ({ jour: 0, equipe: i, lignes: i % 2 === parite ? fabrique(t) : temoin(t) }));
      const { calendrier } = simulateLeague(teams, 82, { graine: `tac-${L}`, decisions });
      bras.push(teams.map(t => ({ W: t.W, GF: t.GF, GA: t.GA,
        e: moy(SLOTS.filter(s => !s.scratch && t.roster[s.i] && t.roster[s.i].p !== 'G').map(s => t.roster[s.i].energie ?? 100)) })));
      if (parite === 0) for (const j of calendrier) for (const m of j) {
        for (const b of m.feuille.buts) { buts++; if (b.special === 'reussie') spec++; }
        for (const l of m.feuille.lancers) if (l.special === 'etouffee') etouf++;
      }
    }
    for (let i = 0; i < 32; i++) {
      const avec = bras[i % 2 === 0 ? 0 : 1][i], sans = bras[i % 2 === 0 ? 1 : 0][i];
      dv.push(avec.W - sans.W); dbp.push(avec.GF - sans.GF); dbc.push(avec.GA - sans.GA); en.push(avec.e);
    }
  }
  return { v: moy(dv), bp: moy(dbp), bc: moy(dbc), e: moy(en), spec: buts ? spec / buts : 0, etouf: etouf / LIGUES };
}
const dire = (t, r) => console.log(`  ${t.padEnd(26)} ${signe(r.v).padStart(5)} V  ${signe(r.bp, 0).padStart(4)} BP  ${signe(r.bc, 0).padStart(4)} BC   énergie finale ${r.e.toFixed(0)}`);
const tous = (tac, agr = 1, sec = 60) => [0, 1, 2, 3].map(() => ({ tac, agr, sec }));

console.log(`\n  ${LIGUES} ligues × 32 équipes, contre les réglages par défaut\n`);
const mal = paires(t => [0, 1, 2, 3].map(u => ({ tac: pire(t, u), agr: 1, sec: 60 }))); dire('mal assorti', mal);
const hourra = paires(() => tous('hourra')); dire('hourra partout', hourra);
const brute = paires(t => [0, 1, 2, 3].map(u => ({ tac: undefined, agr: 3, sec: 60 }))); dire('rentre-dedans partout', brute);
const doux = paires(t => [0, 1, 2, 3].map(u => ({ tac: undefined, agr: 0, sec: 60 }))); dire('agressivité basse partout', doux);
const use = paires(t => [80, 60, 55, 45].map(sec => ({ tac: undefined, agr: 1, sec }))); dire('80 s au 1er trio', use);
/*
 * LE PHYSIQUE DÉCIDE (S71). JP : *s'assurer que c'est plus clair quels
 * joueurs sont avantagés* — l'agressivité doit profiter aux lignes
 * costaudes et coûter aux légères. On la pose sur les DEUX lignes les plus
 * costaudes de chaque club, puis sur les deux plus légères.
 */
const parPhysique = t => { const L = activeLineup(t); return [0, 1, 2, 3].sort((a, b) => physiqueLigne(L, b) - physiqueLigne(L, a)); };
const sur = (lignesVisees, agr) => [0, 1, 2, 3].map(u => ({ tac: undefined, agr: lignesVisees.includes(u) ? agr : 1, sec: 60 }));
const moyenne = () => [0, 1, 2, 3].map(() => ({ tac: undefined, agr: 1, sec: 60 }));
const dur = paires(t => sur(parPhysique(t).slice(0, 2), 3), moyenne); dire('rentre-dedans · costaudes', dur);
const leger = paires(t => sur(parPhysique(t).slice(2), 3), moyenne); dire('rentre-dedans · légères', leger);
const calmeDur = paires(t => sur(parPhysique(t).slice(0, 2), 0), moyenne); dire('basse · costaudes', calmeDur);
const calmeLeger = paires(t => sur(parPhysique(t).slice(2), 0), moyenne); dire('basse · légères', calmeLeger);
/*
 * LA PARITÉ (S72). JP : *faire que toutes les équipes ont les mêmes
 * stratégies*. Les réglages par défaut — ceux de chaque club de l'IA —
 * choisissent l'agressivité payante de chaque ligne : ils doivent faire au
 * moins aussi bien que « moyenne partout ».
 */
const parite = paires(moyenne); dire('moyenne partout (vs défaut)', parite);
informer('buts sur action spéciale', `${(100 * mal.spec).toFixed(1)} % des buts de la ligue`);
informer('actions étouffées par un contre', `${mal.etouf.toFixed(0)} par ligue`);

if (juger) {
  borne('mal assortir coûte', -mal.v, 1, 6, 'victoire');
  borne('jouer sans système coûte', -hourra.v, 0.5, 6, 'victoire');
  for (const [n, r] of [['rentre-dedans', brute], ['basse', doux], ['80 s au 1er trio', use]]) borne(`${n} · écart net`, r.v, -4, 4, 'victoire');
  exiger('rentre-dedans rapporte plus aux lignes costaudes qu\'aux légères', dur.v > leger.v + 0.3, `${signe(dur.v)} V contre ${signe(leger.v)} V`);
  exiger('les réglages de l\'IA font au moins aussi bien que « moyenne partout »', parite.v <= 0.3, `moyenne partout : ${signe(parite.v)} V`);
  exiger('l\'agressivité basse rapporte plus aux lignes légères qu\'aux costaudes', calmeLeger.v > calmeDur.v, `${signe(calmeLeger.v)} V contre ${signe(calmeDur.v)} V`);
} else informer('non jugé', `${LIGUES} ligues sous le plancher de 6`);
verdict('Les lignes à la HockeyArena');
