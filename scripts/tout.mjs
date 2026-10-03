/*
 * LES VÉRIFICATIONS RAPIDES, D'UN COUP (1.0, jalon 3). Vingt-sept `check_*`
 * étaient écrits et ne tournaient nulle part : une couverture qui ne tourne
 * pas ne couvre rien. Celui-ci lance ceux qui prennent moins de quinze
 * secondes, l'un après l'autre, et sort en échec si un seul échoue. La CI
 * (`verifier.yml`) l'appelle ; en local :
 *
 *   node scripts/tout.mjs                    # la liste rapide
 *   node scripts/tout.mjs check_deck check_packs   # seulement ceux-là
 *
 * Aucun `npm test`, aucune dépendance : le jeu n'en a pas (règle ferme).
 * Les lents (feuilles, gros matchs, robot, Rogue, calibration) gardent leur
 * étape à eux dans la CI, ou se lancent à la main — voir CLAUDE.md.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
// Mesurés sous quinze secondes chacun (1.0, 29 septembre 2026) : deck 8 s, identité 2 s, atelier 4 s,
// dépistage 11 s, totaux 5 s, blessures 11 s. check_coquille, check_clarte et check_mort ont leur propre étape dans la CI.
// Trop lents pour cette liste, et lancés à part : check_packs 18 s, check_gardiens 23 s, check_combat 29 s,
// check_jambes 65 s, check_graine 116 s (sa propre étape), check_banque 12 minutes.
const RAPIDES = ['check_deck', 'check_identite', 'check_atelier', 'check_pronostic', 'check_totaux', 'check_sauvegardes', 'check_choix', 'check_calendrier', 'check_blessures'];
const liste = process.argv.slice(2).length ? process.argv.slice(2) : RAPIDES;
let echecs = 0;
for (const nom of liste) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(ICI, `${nom.replace(/\.mjs$/, '')}.mjs`)], { encoding: 'utf8', env: process.env });
  const sortie = `${r.stdout || ''}${r.stderr || ''}`;
  const dernier = sortie.split('\n').map(l => l.trim()).filter(Boolean).filter(l => /vérification|rejoue|✗|Error/.test(l)).pop() || '';
  const ok = r.status === 0;
  if (!ok) echecs++;
  console.log(`${ok ? '✓' : '✗'} ${nom.padEnd(18)} ${String(((Date.now() - t0) / 1000).toFixed(1)).padStart(5)} s  ${dernier}`);
  if (!ok) console.log(sortie.split('\n').filter(l => /✗|Error|at /.test(l)).slice(0, 8).map(l => `    ${l}`).join('\n'));
}
console.log(echecs ? `\n${echecs} script(s) en échec.` : `\n${liste.length} scripts, tous verts.`);
process.exitCode = echecs ? 1 : 0;
