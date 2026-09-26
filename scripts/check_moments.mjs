/*
 * CE QUE VALENT LES MOMENTS (S66) — mesuré EN PAIRES, comme les cartes.
 *
 * Les dilemmes, les séquences, le plan du soir et les jauges sont des
 * DÉCISIONS : on peut donc jouer la même ligue deux fois sous la même graine,
 * le choix aux équipes de rang pair puis aux impaires, et comparer chaque
 * équipe à elle-même contre le même champ (voir check_cartes.mjs pour le
 * pourquoi). Le contrat :
 *
 *   un dilemme ou une séquence    dix matchs au plus : moins d'une victoire
 *   une jauge à l'extrême         TOUTE la saison : moins de deux victoires et
 *                                 demie — c'est le pire cas, une faction qu'on
 *                                 aurait poussée au bout dès le premier soir
 *   la consigne du match       tous les soirs : moins de trois victoires
 *   un changement de carte     un joueur, le reste de la saison : moins
 *                              d'une victoire et demie
 *                                 (sinon lire l'adversaire ne sert à rien)
 *   un objectif                   ni gratuit ni impossible : réussi entre 15 %
 *                                 et 75 % des fois par une vraie équipe
 *
 *   node scripts/check_moments.mjs
 *   LIGUES=12 node scripts/check_moments.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague,
  MOMENTS, SEQUENCES, JAUGES, STYLES, OBJECTIFS, JOURS_OBJECTIFS, MATCHS_OBJECTIF,
  objectifsOfferts, etatObjectif, momentDuJour, JOURS_MOMENTS, jaugesApres,
  MUTATIONS, cibleMutation, getPlayerKey,
} from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 8);
const PLANCHER = 8;
const juger = LIGUES >= PLANCHER;

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

/* La même ligue deux fois : la décision `fabrique(equipe)` aux pairs, puis aux impairs. */
function paires(fabrique, etiquette) {
  const dv = [], dbp = [], dbc = [];
  for (let L = 0; L < LIGUES; L++) {
    const bras = [];
    for (const parite of [0, 1]) {
      const teams = ligue(2000 + L);
      const decisions = fabrique === null ? []
        : teams.map((_, i) => i).filter(i => i % 2 === parite).flatMap(equipe => fabrique(equipe, teams));
      simulateLeague(teams, 82, { graine: `moment-${L}`, decisions });
      bras.push(teams.map(t => ({ W: t.W, GF: t.GF, GA: t.GA })));
    }
    for (let i = 0; i < 32; i++) {
      const avec = bras[i % 2 === 0 ? 0 : 1][i], sans = bras[i % 2 === 0 ? 1 : 0][i];
      dv.push(avec.W - sans.W); dbp.push(avec.GF - sans.GF); dbc.push(avec.GA - sans.GA);
    }
  }
  void etiquette;
  return { v: moy(dv), bp: moy(dbp), bc: moy(dbc), n: dv.length };
}

const lire = (titre, r, bas, haut) => {
  console.log(`  ${titre.padEnd(46)} ${signe(r.v).padStart(5)} V  ${signe(r.bp, 0).padStart(4)} BP  ${signe(r.bc, 0).padStart(4)} BC`);
  if (juger) borne(`${titre} · écart net`, r.v, bas, haut, 'victoire');
  else informer(`${titre} · écart net`, `${signe(r.v)} V — non jugé, ${LIGUES} ligues sous le plancher de ${PLANCHER}`);
};

console.log(`\n  ${LIGUES} ligues × 32 équipes\n`);

const temoin = paires(null);
exiger('sans décision, les deux passages sont identiques', temoin.v === 0 && temoin.bp === 0, `${temoin.n} paires`);

/* ---------- les tirages : purs, et jamais deux fois le même dilemme ---------- */
{
  let doublon = null;
  for (let g = 1; g <= 60 && !doublon; g++) {
    const vus = [];
    for (const j of JOURS_MOMENTS) {
      const m = momentDuJour(g, j, vus);
      if (vus.includes(m)) doublon = `graine ${g} : ${m} deux fois`;
      vus.push(m);
    }
  }
  exiger('un dilemme ne revient pas dans la même partie', !doublon, doublon || '60 parties');
  exiger('la même graine tire le même dilemme', momentDuJour(9, 33, []) === momentDuJour(9, 33, []), momentDuJour(9, 33, []));
  exiger('la même graine offre les mêmes objectifs', objectifsOfferts(9, 41).join() === objectifsOfferts(9, 41).join(), objectifsOfferts(9, 41).join(' · '));
}

/*
 * UN SEUL CHOIX NE POUSSE JAMAIS UNE FACTION AU BOUT. Elle part de 5 et
 * pèse à 8 ou à 2 : un delta de 3 d'un coup y arrivait, et l'effet d'une
 * faction dure TOUTE la saison — le conducteur de surfaceuse valait +1,4
 * victoire pour cette seule raison. Il faut deux choix cohérents.
 */
{
  const trop = [];
  for (const fam of [MOMENTS, SEQUENCES]) for (const [cle, m] of Object.entries(fam)) for (const o of m.options)
    for (const [k, v] of Object.entries(o.jauges || {})) if (Math.abs(v) > 2) trop.push(`${cle}.${o.cle} ${k} ${v}`);
  exiger('aucune option ne bouge une faction de plus de 2', !trop.length, trop.join(' · ') || 'toutes à ±2 au plus');
}

/* ---------- les dilemmes, pris au premier jour de moment ---------- */
// SEULEMENT=zamboni,lemieux : ne remesurer que ces clés (dilemmes et séquences).
const SEULEMENT = process.env.SEULEMENT ? new Set(process.env.SEULEMENT.split(',')) : null;
const garder = cle => !SEULEMENT || SEULEMENT.has(cle);
console.log('\n  DILEMMES (dix journées)');
for (const [cle, m] of Object.entries(MOMENTS)) for (const o of m.options) {
  if (!garder(cle) || process.env.SANS_DILEMMES) continue;
  const r = paires(equipe => [{ jour: JOURS_MOMENTS[0], equipe, moment: { famille: 'moment', cle, choix: o.cle } }]);
  lire(`${m.ico} ${cle} · ${o.cle}`, r, -1, 1);
}

console.log('\n  SÉQUENCES (huit journées)');
for (const [cle, m] of Object.entries(SEQUENCES)) for (const o of m.options) {
  if (!garder(cle)) continue;
  const r = paires(equipe => [{ jour: 30, equipe, moment: { famille: 'sequence', cle, choix: o.cle } }]);
  lire(`${m.ico} ${cle} · ${o.cle}`, r, -1, 1);
}

/* ---------- les jauges au bout, TOUTE la saison : le pire cas ---------- */
console.log('\n  JAUGES À L\'EXTRÊME (toute la saison)');
for (const k of Object.keys(JAUGES)) for (const [sens, d] of [['haut', 5], ['bas', -5]]) {
  if (SEULEMENT) continue;
  const r = paires(equipe => [{ jour: 0, equipe, jauges: { [k]: d } }]);
  lire(`${JAUGES[k].ico} ${k} ${sens}`, r, -2.5, 2.5);
}
exiger('les jauges se rejouent d\'une liste de décisions',
  jaugesApres([{ jour: 0, jauges: { vestiaire: 9 } }]).vestiaire === 10, 'bornées à 10');

/* ---------- la consigne du match, tous les soirs (S68) ---------- */
/*
 * L'importance du match remplace le plan du soir : haute joue plus fort et
 * se paie à l'infirmerie et à la fatigue, basse repose. Tous les soirs, c'est
 * le pire cas — aucune ne doit décider la saison.
 */
console.log('\n  LA CONSIGNE DU MATCH (tous les soirs)');
for (const importance of ['haute', 'basse']) {
  const r = paires(equipe => Array.from({ length: 90 }, (_, j) => ({ jour: j, equipe, match: { importance, ad: 0 } })));
  lire(`importance ${importance} tous les soirs`, r, -3, 3);
}

/* ---------- les changements de carte par choix (S68) ---------- */
/*
 * Chaque mutation posée à la journée 25 sur le joueur qu'elle vise : elle
 * change UN joueur pour le reste de la saison, et ne doit pas valoir plus
 * d'une victoire et demie.
 */
console.log('\n  CHANGEMENTS DE CARTE (un joueur, le reste de la saison)');
for (const cle of Object.keys(MUTATIONS).filter(k => MUTATIONS[k].source === 'choix')) {
  if (SEULEMENT && !SEULEMENT.has(cle)) continue;
  const r = paires((equipe, teams) => {
    const p = cibleMutation(teams[equipe], cle);
    return p ? [{ jour: 25, equipe, mutation: { cle, joueur: getPlayerKey(p) } }] : [];
  });
  lire(`${MUTATIONS[cle].ico} ${cle}`, r, -1.5, 1.5);
}

/* ---------- les objectifs : ni gratuits ni impossibles ---------- */
console.log('\n  OBJECTIFS (vraies équipes, sans rien décider)');
{
  const tot = {};
  for (let L = 0; L < Math.max(4, LIGUES / 2); L++) {
    const teams = ligue(3000 + L);
    const { calendrier } = simulateLeague(teams, 82, { graine: `obj-${L}` });
    for (const t of teams) for (const j0 of JOURS_OBJECTIFS) {
      const matchs = [];
      for (let j = j0; j < calendrier.length && matchs.length < MATCHS_OBJECTIF; j++) {
        const m = calendrier[j].find(x => x.A === t || x.B === t);
        if (!m) continue;
        const pour = m.A === t ? m.gfA : m.gfB, contre = m.A === t ? m.gfB : m.gfA;
        const cote = m.A === t ? 'A' : 'B';
        matchs.push({ v: pour > contre, pour, contre, buts: (m.feuille?.buts || []).filter(b => b.cote === cote) });
      }
      for (const cle of Object.keys(OBJECTIFS)) {
        const e = etatObjectif(cle, matchs);
        tot[cle] = tot[cle] || { ok: 0, n: 0 };
        tot[cle].n++; if (e.reussi) tot[cle].ok++;
      }
    }
  }
  for (const [cle, x] of Object.entries(tot)) {
    const p = 100 * x.ok / x.n;
    console.log(`  ${OBJECTIFS[cle].ico} ${OBJECTIFS[cle].court.padEnd(28)} ${p.toFixed(0).padStart(3)} % réussis`);
    borne(`${OBJECTIFS[cle].court} · taux de réussite`, p, 15, 75, '%');
  }
}

verdict('Les moments');
