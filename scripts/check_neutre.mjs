/*
 * L'adversaire moyen de la saison solo : de quoi est-il fait ?
 *
 * `simulate` fait jouer 82 matchs contre `PROFIL_NEUTRE`. Pour que la saison
 * solo veuille dire quelque chose, ce profil doit être ce qu'une VRAIE équipe
 * moyenne produit une fois alignée — pas ce que produit le joueur moyen de la
 * ligue. La différence n'est pas cosmétique : un alignement retient les 18
 * meilleurs patineurs d'un club et son gardien numéro un, qui tirent plus,
 * finissent mieux et arrêtent mieux que la moyenne de leur ligue. Régler le
 * profil neutre sur le joueur moyen donne donc une équipe médiane à 60
 * victoires.
 *
 * Ce script aligne les 1395 équipes-saisons avec `autoRoster`, mesure leur
 * profil réel, et sort les quatre nombres à mettre dans `PROFIL_NEUTRE`.
 *
 *   node scripts/check_neutre.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, profilMatch, createTeam, activeLineup, SLOTS, facteurGardienDe, pctTirRelDe, REF } from '../js/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');

const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

const pressions = [], zDefs = [], fgs = [], pcts = [], creas = [];
for (const f of fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const parEquipe = {};
  for (const p of shard.players) (parEquipe[p.t] = parEquipe[p.t] || []).push(p);

  for (const [t, ps] of Object.entries(parEquipe)) {
    if (ps.length < 20) continue;
    const pool = ps.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    const roster = autoRoster(pool);
    if (Object.keys(roster).length < 20) continue;

    const team = createTeam(t, t, roster);
    const lineup = activeLineup(team);
    const prof = profilMatch(team, lineup);
    pressions.push(prof.pression);
    zDefs.push(prof.zDef);
    // rapportée à REF.crea en vigueur : la valeur brute est creaEquipe × REF.crea
    creas.push(prof.creaEquipe);

    const gardien = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => lineup[s.i]).find(Boolean);
    if (gardien) fgs.push(facteurGardienDe(gardien));

    const patineurs = SLOTS.filter(s => s.group !== 'G' && !s.scratch).map(s => lineup[s.i]).filter(Boolean);
    // pondéré par le volume de tirs : ce sont les gros tireurs qui portent le % d'équipe
    const w = patineurs.map(p => (p.sh || 0) / Math.max(1, p.gp || 1));
    const tot = w.reduce((s, x) => s + x, 0);
    if (tot > 0) pcts.push(patineurs.reduce((s, p, i) => s + w[i] * pctTirRelDe(p), 0) / tot);
  }
}

console.log(`\n${pressions.length} équipes-saisons alignées par autoRoster\n`);
const ligne = (nom, a) => console.log(
  `    ${nom.padEnd(22)} moyenne ${moy(a).toFixed(3)}   médiane ${median(a).toFixed(3)}`
  + `   min ${Math.min(...a).toFixed(3)}   max ${Math.max(...a).toFixed(3)}`);
ligne('pression', pressions);
ligne('zDef', zDefs);
ligne('facteur gardien', fgs);
ligne('% de tir relatif', pcts);
ligne('création (passes rel.)', creas);

console.log(`
  À METTRE DANS PROFIL_NEUTRE

    pression      ${moy(pressions).toFixed(3)}
    zDef          ${moy(zDefs).toFixed(3)}
    fgDefaut      ${moy(fgs).toFixed(3)}
    pctTirDefaut  ${moy(pcts).toFixed(3)}
    crea          ${moy(creas).toFixed(3)}   (REF.crea en vigueur : ${REF.crea})
`);
