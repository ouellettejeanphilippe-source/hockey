/*
 * Les deux constantes d'époque du moteur par événements.
 *
 * MOTEUR.md pose que si l'événement de base est le LANCER plutôt que le but,
 * la normalisation par époque se réduit à deux nombres par saison :
 *
 *   - le rythme     : lancers par équipe par match     (devrait être ~stable)
 *   - la finition   : pourcentage de tir de la ligue   (devrait tout expliquer)
 *
 * Ce script les mesure sur les shards, vérifie que la prémisse tient, et sort
 * la table que le moteur consommera. Il vérifie aussi que `sh` et `sa` sont
 * bien arrivés dans les 55 shards.
 *
 *   node scripts/check_lancers.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEASON_GOAL_AVG } from '../js/ratings.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');

const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

const lignes = [];
const manquants = [];

for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));

  // Joueurs uniques : un echange (x:1) duplique les totaux dans chaque equipe
  const vus = new Set();
  const uniques = shard.players.filter(p => (vus.has(p.id) ? false : (vus.add(p.id), true)));
  const patineurs = uniques.filter(p => p.p !== 'G');
  const gardiens = uniques.filter(p => p.p === 'G');

  if (!patineurs.some(p => p.sh > 0) || !gardiens.some(g => g.sa > 0)) {
    manquants.push(shard.season);
    continue;
  }

  const buts = patineurs.reduce((s, p) => s + (p.g || 0), 0);
  const lancers = patineurs.reduce((s, p) => s + (p.sh || 0), 0);

  // Matchs d'equipe : chaque match compte pour deux equipes, donc les parties
  // jouees par les gardiens divisees par deux approchent mal ; on prend plutot
  // le maximum de parties jouees par equipe, somme sur les equipes.
  const maxParEquipe = {};
  for (const p of shard.players) maxParEquipe[p.t] = Math.max(maxParEquipe[p.t] || 0, p.gp || 0);
  const matchsEquipe = Object.values(maxParEquipe).reduce((s, x) => s + x, 0);

  const lancersContre = gardiens.reduce((s, g) => s + (g.sa || 0), 0);

  lignes.push({
    saison: shard.season,
    equipes: Object.keys(maxParEquipe).length,
    lancersPour: lancers / matchsEquipe,
    lancersContre: lancersContre / matchsEquipe,
    butsParMatch: buts / matchsEquipe,
    pctTir: 100 * buts / Math.max(1, lancers),
    reel: SEASON_GOAL_AVG[shard.season] ?? null,
  });
}

if (manquants.length) {
  console.log(`\n⚠  ${manquants.length} shard(s) sans lancers — un build complet est requis :`);
  console.log('   ' + manquants.join(', ') + '\n');
  if (manquants.length === lignes.length + manquants.length) process.exit(1);
}

console.log(`\n${lignes.length} saisons\n`);
console.log('  saison    lancers/match   % de tir   buts/match   buts réels');
for (const l of lignes) {
  const ecart = l.reel != null ? Math.abs(l.butsParMatch - l.reel) : null;
  const drapeau = ecart != null && ecart > 0.25 ? '  ⚠' : '';
  console.log(
    `  ${l.saison}   ${l.lancersPour.toFixed(1).padStart(8)}   ${l.pctTir.toFixed(2).padStart(7)} %`
    + `   ${l.butsParMatch.toFixed(2).padStart(8)}   ${(l.reel != null ? l.reel.toFixed(2) : '—').padStart(9)}${drapeau}`);
}

const lp = lignes.map(l => l.lancersPour);
const pt = lignes.map(l => l.pctTir);
const bm = lignes.map(l => l.butsParMatch);
const amplitude = (a) => 100 * (Math.max(...a) / Math.min(...a) - 1);

console.log(`
  LA PRÉMISSE DE MOTEUR.md

    lancers par match   ${Math.min(...lp).toFixed(1)} à ${Math.max(...lp).toFixed(1)}   amplitude ${amplitude(lp).toFixed(0)} %
    % de tir            ${Math.min(...pt).toFixed(2)} à ${Math.max(...pt).toFixed(2)}   amplitude ${amplitude(pt).toFixed(0)} %
    buts par match      ${Math.min(...bm).toFixed(2)} à ${Math.max(...bm).toFixed(2)}   amplitude ${amplitude(bm).toFixed(0)} %

  Le rythme doit être NETTEMENT plus stable que les buts, et le % de tir doit
  porter l'essentiel de l'écart. Si ce n'est pas le cas, la prémisse du moteur
  par lancers ne tient pas et il faut relire MOTEUR.md section 1.
`);
