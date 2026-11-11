/**
 * CE QUE LE MOTEUR JOUE D'UNE DÉCISION DE CARTE (S79 ; V21 ; V28, tranche 4) — la saison se rejoue avec elles.
 *
 *   node scripts/check_banque.mjs
 *
 * Le registre de la banque (ses deux familles, la règle de chaque carte, la décision qu'elle devenait) et la carte rare
 * d'un pack sont partis avec « Tes cartes » de l'ancien Rogue. Restent les canaux que le moteur joue toujours, pour la run
 * en carte comme pour une vieille partie :
 *   1. les barèmes des métaux des pochettes font 100 % ;
 *   2. LA MASSE SALARIALE (`plafondDe`) : l'espace gagné et le rachat d'une vieille décision `plafond`, au dollar ;
 *   3. le moteur : une pièce entre sur le banc du coach, un SOIN (le geste d'une histoire) raccourcit vraiment une
 *      blessure ; une histoire sur un joueur tient sur lui ;
 *   4. la saison se rejoue au but près avec ces décisions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, getPlayerKey } from '../js/sim.js';
import { plafondDe } from '../js/banque.js';
import { HISTOIRES } from '../js/histoires.js';
import { METAL } from '../js/packs.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, verdict } from './verdict.mjs';

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
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
const fiche = t => `${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`;

console.log('\n  Les décisions de carte que le moteur joue\n');

/* 1. Les pochettes. */
exiger('le barème du métal des pochettes fait 100 %', Math.abs(Object.values(METAL.cotes).reduce((a, b) => a + b, 0) - 100) < 1e-9, Object.values(METAL.cotes).join(' · '));

/* 2. La masse salariale (V16, tranche 6) : une vieille décision `plafond` (le dossier du proprio d'avant), au dollar. */
{
  const base = 82_000_000;
  // Les réponses d'un dossier de masse salariale, en valeurs d'essai (le contrat de télé, le rachat d'une part).
  const O = { tele: { plafond: { espace: 2_500_000 } }, rachat: { plafond: { facteur: 0.833 } } };
  const pl = plafondDe([
    { jour: 3, plafond: { nom: 'tele', ...O.tele.plafond } }, { jour: 4, plafond: { nom: 'rachat', ...O.rachat.plafond, joueur: 'B' } },
    { jour: 50, plafond: { nom: 'tard', espace: 5_000_000 } },
  ], 20, { base });
  const attendu = base + O.tele.plafond.espace;
  exiger('le contrat de télé fait le plafond au dollar', pl.cap === attendu,
    `${(pl.cap / 1e6).toFixed(2)} M$ (attendu ${(attendu / 1e6).toFixed(2)}) · ${pl.lignes.map(l => `${l.nom} ${l.montant > 0 ? '+' : ''}${(l.montant / 1e6).toFixed(1)}`).join(' · ')}`);
  exiger(`le rachat : ${Math.round(O.rachat.plafond.facteur * 100)} % sur son joueur`, pl.facteurs.get('B') === O.rachat.plafond.facteur,
    [...pl.facteurs].map(([k, v]) => `${k} ${Math.round(v * 100)} %`).join(' · '));
  exiger('une décision prise plus tard ne compte pas encore', plafondDe([{ jour: 50, plafond: { espace: 5_000_000 } }], 20, { base }).cap === base);
}

/* 3. Le moteur. */
const t0 = ligue(79, 16), moi = t0[0];
const avant = SLOTS.filter(s => !s.scratch && s.group === 'F').map(s => moi.roster[s.i]).find(Boolean);
// Une histoire sur un joueur (V25 C1 : l'agent appelle, « Lui donner ce qu'il demande » : −20 🪙, ses tirs et ses passes sur 12 matchs) : sa réponse se pose sur lui, pas sur l'équipe.
const AGENT = HISTOIRES.lAgent.options.find(o => o.cle === 'donner');
const decs = [
  { jour: 0, equipe: 0, coach: { cle: 'tortue' } },
  { jour: 10, equipe: 0, piece: { cle: 'mur' } },
  { jour: 20, equipe: 0, palier: 'h:lundi:20', moment: { famille: 'histoire', cle: 'lAgent', choix: 'donner', joueur: getPlayerKey(avant), joueurs: [getPlayerKey(avant)] }, gain: AGENT.jetons },
];
simulateLeague(t0, 82, { graine: 'banque', decisions: decs });
exiger('le coach pose sa pièce de départ, et une pièce entre sur son banc', moi.perso && moi.perso.banc.join() === 'verrou,mur', moi.perso ? moi.perso.banc.join(', ') : 'pas de coach');
exiger('une histoire du lundi ne pose aucun effet sur l\'équipe', !(moi.effets || []).some(e => e.source === 'histoire'), `${(moi.effets || []).length} effet(s)`);
// V11 (tranche 4) : un dossier qui nomme un joueur pose sa réponse sur lui.
const boude = (moi.effetsCibles || []).find(e => e.nom === HISTOIRES.lAgent.titre);
exiger('une histoire sur un joueur tient sur le joueur nommé, et engage sa promesse', !!boude && getPlayerKey(boude.joueur) === getPlayerKey(avant) && boude.lancers === AGENT.lui.lancers && (moi.suivis || []).some(s => s.cle === 'lAgent' && s.joueur === avant),
  boude ? `${boude.joueur.n} : tirs ×${boude.lancers}, ${boude.fin - boude.debut} jours` : 'absent');

// UN SOIN RACCOURCIT UNE BLESSURE : une première saison dit qui se blesse et quand ; la même, avec un soin le lendemain, doit le rendre plus tôt.
let soinOk = null;
for (let s = 0; s < 6 && soinOk === null; s++) {
  const a = ligue(500 + s, 16), toi = a[0];
  simulateLeague(a, 82, { graine: `soin-${s}` });
  const b = (toi.injuriesLog || []).find(x => x.games >= 8 && x.jour != null && x.jour < 60);
  if (!b) continue;
  const cle = getPlayerKey(b.player), gp1 = b.player.simGP;
  const c = ligue(500 + s, 16);
  // Le geste d'une histoire (`gestes.soin`, js/greffes.js) : cinq matchs de moins à l'infirmerie.
  simulateLeague(c, 82, { graine: `soin-${s}`, decisions: [{ jour: b.jour + 1, equipe: 0, gestes: { soin: 5, joueurs: [cle] } }] });
  const p2 = Object.values(c[0].roster).find(x => x && getPlayerKey(x) === cle);
  soinOk = { nom: b.player.n, games: b.games, gp1, gp2: p2 ? p2.simGP : 0 };
}
exiger('un soin rend un blessé plus tôt', soinOk && soinOk.gp2 > soinOk.gp1, soinOk ? `${soinOk.nom} (${soinOk.games} matchs) : ${soinOk.gp1} PJ puis ${soinOk.gp2} PJ avec un soin de cinq matchs` : 'aucune longue blessure trouvée');

/* 4. La saison se rejoue. */
const r1 = ligue(79, 16), r2 = ligue(79, 16);
simulateLeague(r1, 82, { graine: 'banque', decisions: decs });
simulateLeague(r2, 82, { graine: 'banque', decisions: decs });
exiger('la saison se rejoue au but près avec ces décisions', fiche(r1[0]) === fiche(r2[0]) && r1.every((t, i) => fiche(t) === fiche(r2[i])), `${fiche(r1[0])} puis ${fiche(r2[0])}`);

verdict();
