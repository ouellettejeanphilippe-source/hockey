/*
 * LES ÉLITES (V27, tranche 7 ; docs/refonte-v27.md § 4.5 ; docs/refonte-v27-7.md — js/actes.js). JP, 8 nov. 2026 :
 * « Élite = risque plus clair » : l'écran montre ta vraie chance, celle qui fixe la récompense. Ce juge prouve LES RÈGLES
 * que la run en carte lit (js/run.js), sans jouer un match (une seconde, dans tout.mjs) :
 *
 *   a. la récompense : `J = arrondi(VALEUR_DU_RISQUE × (1 − p) / p) − PRIX_PIECE`, bornée à [10, 90], `p` borné à [0,25, 0,55]
 *      (les exemples du § 4.5 : 38 % → 90 🪙, le plafond ; 52 % → 51 🪙) ; tant qu'elle n'est pas au plafond, `p × (J + PRIX_PIECE)`
 *      vaut `(1 − p) × VALEUR_DU_RISQUE` à l'arrondi près : le risque est payé ;
 *   b. ce qu'elle coûte perdue (JP, 9 nov. 2026 : *Sonnés + jetons, pas de cœur*) : la moitié de sa récompense en jetons
 *      (`perteDeLElite`) et des sonnés plus longs (`SONNES_ELITE`) ;
 *   c. les pièces « pour le battre » : une par ligne du jeu (tirs, durs, gardien), chacune son moment (`MOMENTS_SI`) ;
 *      chaque club a un style, un seul (sa ligne au meilleur rang, `jeuDuRival`), et les trois styles existent dans une
 *      ligue : c'est ce style que la run pose le soir du match (js/run.js `poserLeSoir`), le mot de sa case.
 *
 * La proposition du lundi sur la cédule (`eliteDeLaSemaine`), l'élite annoncée par le crochet des actes, l'état de la run
 * en actes et les paires de la profondeur sont partis avec l'ancien Rogue (V28, tranche 4) ; l'élite de la carte (une au
 * plus par acte, sa case, sa récompense) se juge dans `check_run`.
 *
 *   node scripts/check_elites.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, MOMENTS_SI, SONNE, SONNES_ELITE } from '../js/sim.js';
import { recompenseDeLElite, jeuDuRival, VALEUR_DU_RISQUE, PART_PERDUE, perteDeLElite, PRIX_PIECE } from '../js/actes.js';
import { PIECES, piecesContre } from '../js/pieces.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, verdict } from './verdict.mjs';

console.log('\n  Les élites (V27, tranche 7)\n');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* ---------- a. la récompense ---------- */
{
  const ps = Array.from({ length: 91 }, (_, i) => 0.05 + i / 100);
  const J = ps.map(recompenseDeLElite);
  const paye = ps.filter(p => p >= 0.25 && p <= 0.55).every(p => { const j = recompenseDeLElite(p); return j >= 90 || Math.abs(p * (j + PRIX_PIECE) - (1 - p) * VALEUR_DU_RISQUE) <= p; });
  exiger(`la récompense : ${VALEUR_DU_RISQUE} × (1 − p) / p − ${PRIX_PIECE}, bornée à [10, 90], p borné à [0,25, 0,55] (38 % → 90 🪙, le plafond ; 52 % → 51 🪙)`,
    recompenseDeLElite(0.38) === 90 && recompenseDeLElite(0.52) === 51 && J.every(j => j >= 10 && j <= 90) && recompenseDeLElite(0.1) === recompenseDeLElite(0.25) && recompenseDeLElite(0.9) === recompenseDeLElite(0.55) && paye,
    `25 % → ${recompenseDeLElite(0.25)} · 38 % → ${recompenseDeLElite(0.38)} · 45 % → ${recompenseDeLElite(0.45)} · 52 % → ${recompenseDeLElite(0.52)} · 55 % → ${recompenseDeLElite(0.55)}`);
}

/* Une vraie ligue de 32 clubs, tirés des saisons du dépôt ; la première est la tienne. */
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
function ligue(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const sh = JSON.parse(fs.readFileSync(path.join(DIR, SAISONS[Math.floor(rnd() * SAISONS.length)]), 'utf8'));
    const tags = [...new Set(sh.players.map(p => p.t))], tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    const ps = un.flat().map(p => ({ ...p }));
    ps.forEach(registerHiddenRatings);
    out.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(ps), { season: sh.season, isPlayer: !out.length }));
  }
  return out;
}

/* ---------- b. perdue ---------- */
exiger(`une élite perdue coûte la moitié de sa récompense (${PART_PERDUE}), arrondie, et des sonnés plus longs`,
  perteDeLElite(42) === 21 && perteDeLElite(58) === Math.round(58 * PART_PERDUE) && perteDeLElite(0) === 0 && SONNES_ELITE > SONNE.duree,
  `42 🪙 → −${perteDeLElite(42)} 🪙 · sonnés ${SONNES_ELITE} matchs (un soir ordinaire : ${SONNE.duree})`);

/* ---------- c. pour le battre ---------- */
{
  const teams = ligue(71), toi = teams[0], n = teams.length;
  const lignes = ['tirs', 'durs', 'gardien'], moments = { tirs: 'tireurs', durs: 'durs', gardien: 'grosGardien' };
  const parLigne = lignes.map(k => piecesContre([k]));
  const styles = teams.map(T => jeuDuRival(teams, toi, T).cle);
  const forts = lignes.map(k => styles.filter(x => x === k).length);
  exiger('une pièce « pour le battre » par ligne du jeu, chacune son moment ; chaque club a un style, et les trois styles existent',
    parLigne.every(l => l.length === 1) && lignes.every((k, i) => PIECES[parLigne[i][0]].soir && MOMENTS_SI[moments[k]] && PIECES[parLigne[i][0]].quand({ soir: { [moments[k]]: true } }) && !PIECES[parLigne[i][0]].quand({ soir: {} }))
    && styles.every(x => lignes.includes(x)) && forts.every(x => x >= n / 8) && forts.reduce((a, x) => a + x, 0) === n,
    lignes.map((k, i) => `${k} : ${PIECES[parLigne[i][0]].ico} ${PIECES[parLigne[i][0]].nom}, ${forts[i]} clubs`).join(' · '));
}

verdict('Les élites');
