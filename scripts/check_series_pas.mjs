/*
 * LES SÉRIES AU MATCH LE MATCH (S79) — `creerSeries`, `jouerMatchSeries`.
 *
 *   node scripts/check_series_pas.mjs
 *
 * JP : *tu devrais jamais simuler d'avance*. Les séries ne jouent un match
 * qu'au moment de le montrer. Vérifie :
 *   1. elles vont au bout : un champion, chaque série à quatre victoires ;
 *   2. rien d'avance : après trois matchs, la ronde 2 n'existe pas encore ;
 *   3. ta série a son prochain plan posé d'avance, sans que le match soit joué ;
 *   4. les compteurs de SAISON ne bougent pas ; les séries s'inscrivent à part ;
 *   5. la même graine redonne les mêmes séries, et une reprise (`jouerSeriesVues`)
 *      retrouve exactement l'état vu ;
 *   6. une série est décidée à sa quatrième victoire, pas à la fin de sa ronde.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, bilanLigue,
  creerSeries, jouerMatchSeries, jouerSeriesVues, generateur } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const saisons = fs.readdirSync(DIR).filter(x => x.endsWith('.json')).sort();
const choix = generateur('check_series_pas');
const vestiaires = [], vus = new Set();
while (vestiaires.length < 32) {
  const f = saisons[Math.floor(choix() * saisons.length)];
  const shard = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const tags = [...new Set(shard.players.map(p => p.t))];
  const tag = tags[Math.floor(choix() * tags.length)];
  if (vus.has(`${shard.season}|${tag}`)) continue;
  let u; try { u = equipeReelle(shard.season, tag); } catch { continue; }
  if (u[0].length < 12 || u[1].length < 6 || !u[2].length) continue;
  vus.add(`${shard.season}|${tag}`);
  vestiaires.push({ tag, season: shard.season, pool: u.flat() });
}
let echecs = 0;
const dire = (ok, mot) => { console.log(`  ${ok ? 'ok ' : '✗  '} ${mot}`); if (!ok) echecs++; };

function saison() {
  const teams = vestiaires.map((v, i) => {
    const pool = v.pool.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    return createTeam(`${v.tag} ${v.season}`, v.tag, autoRoster(pool), { season: v.season, isPlayer: i === 0 });
  });
  const L = jouerJusqua(creerLigue(teams, 82, { graine: 'series-pas' }), Infinity);
  const b = bilanLigue(L);
  // Ta formation en séries à coup sûr : on la place au 8e rang des qualifiés.
  const toi = teams[0];
  const top = b.standings.filter(t => t !== toi).slice(0, 15);
  top.splice(7, 0, toi);
  return { L, teams: b.standings, top16: top, toi };
}
const texte = S => S.toutes.map(s => `${s.ronde}:${s.A.name}-${s.B.name} ${s.wA}-${s.wB} ${s.feuilles.map(f => f.buts.length).join(',')}`).join('\n');

console.log('\n  Les séries au match le match (S79)\n');
const a = saison();
const photoSaison = a.teams.map(t => `${t.name} ${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`).join('|');
const joueursSaison = a.teams.flatMap(t => SLOTS.map(s => t.roster[s.i]).filter(Boolean).map(p => `${p.n}:${p.simGP}:${p.simPTS}`)).join('|');
const S = creerSeries(a.top16, { ligue: a.L, graine: a.L.graine, equipes: a.teams });
const maSerie = S.courante.find(s => s.A === a.toi || s.B === a.toi);
dire(!!(maSerie && maSerie.plans[0] && maSerie.plans[0].aVenir && maSerie.plans[0].depistage && !maSerie.feuilles.length),
  'ta série a le plan de son premier match posé d\'avance, sans match joué');
for (let i = 0; i < 3; i++) jouerMatchSeries(S);
dire(S.ronde === 0 && S.toutes.length === 8 && S.toutes.every(s => s.feuilles.length === 3),
  `après trois matchs : la ronde 1 seulement, trois matchs par série (${S.toutes.length} séries)`);
// Une série est décidée à sa quatrième victoire, pas à la fin de la ronde : sinon
// l'écran offrait une main (sans dépistage) pour un match qui ne se jouerait pas.
let tot = 0, sansGagnant = 0;
while (!S.fini) {
  jouerMatchSeries(S);
  for (const s of S.courante) if (s.wA === 4 || s.wB === 4) { if (!s.winner) sansGagnant++; else if (S.courante.some(x => x.wA < 4 && x.wB < 4)) tot++; }
}
dire(!sansGagnant && tot > 0, `une série décidée a son gagnant tout de suite (${tot} fois pendant que sa ronde se jouait encore)`);
dire(!!S.champion && S.toutes.length === 15 && S.toutes.every(s => (s.wA === 4) !== (s.wB === 4) && s.winner),
  `un champion (${S.champion && S.champion.name}), quinze séries, chacune à quatre victoires`);
dire(a.teams.map(t => `${t.name} ${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`).join('|') === photoSaison
  && a.teams.flatMap(t => SLOTS.map(s => t.roster[s.i]).filter(Boolean).map(p => `${p.n}:${p.simGP}:${p.simPTS}`)).join('|') === joueursSaison,
  'les compteurs de saison ne bougent pas pendant les séries');
const matchsChamp = S.toutes.filter(s => s.A === S.champion || s.B === S.champion).reduce((n, s) => n + s.feuilles.length, 0);
dire(S.champion.po && S.champion.po.W === 16 && S.champion.po.W + S.champion.po.L + S.champion.po.OTL === matchsChamp,
  `les séries s'inscrivent à part : le champion ${S.champion.po && S.champion.po.W} victoires en ${matchsChamp} matchs`);
const buteurs = a.teams.flatMap(t => SLOTS.map(s => t.roster[s.i]).filter(Boolean)).filter(p => p.po && p.po.G > 0);
dire(buteurs.length > 20, `${buteurs.length} buteurs des séries ont leurs buts à part (p.po)`);
// La même graine : les mêmes séries ; la reprise retrouve l'état vu.
const b2 = saison();
const S2 = creerSeries(b2.top16, { ligue: b2.L, graine: b2.L.graine, equipes: b2.teams });
while (!S2.fini) jouerMatchSeries(S2);
dire(texte(S2) === texte(S), 'la même graine redonne les mêmes séries, au but près');
const b3 = saison();
const S3 = creerSeries(b3.top16, { ligue: b3.L, graine: b3.L.graine, equipes: b3.teams });
const revele = []; for (const s of S.toutes.filter(x => x.ronde <= 1)) revele[s.i] = s.ronde === 1 ? 2 : s.feuilles.length;
jouerSeriesVues(S3, revele);
dire(S3.toutes.filter(s => s.ronde <= 1).every(s => s.feuilles.length >= (revele[s.i] || 0)) && S3.ronde === 1 && !S3.toutes.some(s => s.ronde > 1),
  'une reprise rejoue jusqu\'où on avait vu (ronde 2, deux matchs), pas plus');
console.log(echecs ? `\n  ${echecs} échec(s)\n` : '\n  toutes vertes\n');
process.exit(echecs ? 1 : 0);
