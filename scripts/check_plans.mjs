/*
 * CE QU'UN PLAN DE MATCH ET UN ROULEMENT VALENT — mesuré EN PAIRES.
 *
 * JP : *plus d'opportunités pour jouer avec les lignes, joueurs, stratégie*.
 * Le plan de match (`PLANS`) et le roulement (`ROULEMENTS`) sont les deux
 * décisions qu'on porte toute la saison et qu'on change quand on veut derrière
 * le banc. Le contrat de conception est celui des cartes : ça change la FORME
 * de ta saison, pas sa force — sinon il n'y a plus de choix, il y a une bonne
 * réponse.
 *
 * LA MÉTHODE EST CELLE DE `check_cartes.mjs`, et pour la même raison : une
 * saison de 82 matchs a un écart type de 4,5 victoires, donc comparer deux
 * ligues indépendantes demanderait des centaines d'essais pour lire UNE
 * victoire. On joue la même ligue deux fois sous la même graine, le réglage
 * aux équipes de rang pair au premier passage et aux impaires au second :
 * chaque équipe est mesurée avec et sans, contre le même champ.
 *
 * CE QUI SE JUGE, ET CE QUI S'INFORME. L'écart de VICTOIRES se juge (moins
 * d'une victoine et demie). Ce que le réglage DÉPLACE s'informe, parce que
 * c'est là qu'on voit s'il fait ce qu'il annonce : l'échec avant doit prendre
 * des punitions, la trappe doit allouer moins de buts, et « Trois trios » doit
 * déplacer la production vers le premier trio — c'est sa raison d'être, et
 * c'est le seul chiffre qui dit si le roulement sert à quelque chose.
 *
 * DEUX CHOSES QUE CE SCRIPT NE MESURE PAS, et c'est écrit ici pour qu'on ne
 * les croie pas mesurées. (1) La ROBUSTESSE ne paie qu'aux soirs éreintants
 * (un match sur quatre) et en SÉRIES, où l'usure s'accumule de ronde en ronde
 * (`K_ROB`, `ROB_SERIES`) : « Jouer le corps » et « Banc profond » sont donc
 * réglés un cheveu sous zéro en saison, et avril est le reste. C'est le même
 * déséquilibre assumé que la carte « Les vétérans ». (2) Les Coupes
 * demanderaient quarante ligues pour valoir ±8 points (voir CLAUDE.md).
 *
 * Trop long pour l'Action : il se lance à la main, comme check_cartes.
 *
 *   node scripts/check_plans.mjs
 *   LIGUES=18 node scripts/check_plans.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague,
  PLANS, ROULEMENTS, PART_UNITE, partsDuRoulement,
} from '../js/sim.js';
import { POIDS_TRIO } from '../js/ratings.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 12);
const JOUR = 0;   // le plan vaut toute la saison : c'est là qu'on le pose
/* Même plancher que check_cartes, et pour la même raison. */
const PLANCHER = 12;
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

/** La fiche d'une équipe, plus ce que le premier trio a produit. */
function fiche(t) {
  let pts = 0, ptsF1 = 0, tirs = 0, pun = 0;
  for (const s of SLOTS) {
    if (s.scratch || s.group === 'G') continue;
    const p = t.roster[s.i];
    if (!p) continue;
    pts += p.simPTS || 0; tirs += p.simSH || 0; pun += p.simPIM || 0;
    if (s.group === 'F' && s.unit === 0) ptsF1 += p.simPTS || 0;
  }
  return { W: t.W, GF: t.GF, GA: t.GA, bl: (t.injuriesLog || []).length, tirs, pun, partF1: pts ? ptsF1 / pts : 0 };
}

/* La même ligue deux fois : le réglage aux pairs, puis aux impairs. */
function paires(champ, cle) {
  const d = { v: [], bp: [], bc: [], bl: [], tirs: [], pun: [], partF1: [] };
  for (let L = 0; L < LIGUES; L++) {
    const bras = [];
    for (const parite of [0, 1]) {
      const teams = ligue(2000 + L);
      const decisions = cle === null ? []
        : teams.map((_, i) => i).filter(i => i % 2 === parite).map(equipe => ({ jour: JOUR, equipe, [champ]: cle }));
      simulateLeague(teams, 82, { graine: `plan-${L}`, decisions });
      bras.push(teams.map(fiche));
    }
    for (let i = 0; i < 32; i++) {
      const avec = bras[i % 2 === 0 ? 0 : 1][i], sans = bras[i % 2 === 0 ? 1 : 0][i];
      d.v.push(avec.W - sans.W); d.bp.push(avec.GF - sans.GF); d.bc.push(avec.GA - sans.GA);
      d.bl.push(avec.bl - sans.bl); d.tirs.push(avec.tirs - sans.tirs);
      d.pun.push(avec.pun - sans.pun); d.partF1.push(100 * (avec.partF1 - sans.partF1));
    }
  }
  const r = {}; for (const k of Object.keys(d)) r[k] = moy(d[k]);
  r.n = d.v.length;
  return r;
}

console.log(`\n  ${LIGUES} ligues × 32 équipes · le réglage est posé au jour ${JOUR}\n`);

const temoin = paires('plan', null);
exiger('sans réglage, les deux passages sont identiques', temoin.v === 0 && temoin.bp === 0,
  `${temoin.n} paires · ${signe(temoin.v)} V`);

/*
 * LE ROULEMENT RENORMALISE, sinon raccourcir le banc ferait tirer l'équipe
 * davantage au lieu de déplacer QUI tire — et ce serait un cadeau, pas un
 * choix. C'est un invariant, pas un repère : la somme des parts ne bouge pas.
 */
for (const cle of Object.keys(ROULEMENTS)) {
  const t = { roulement: cle };
  const sF = partsDuRoulement(PART_UNITE.F, 'F', t).reduce((a, b) => a + b, 0);
  const sP = partsDuRoulement(POIDS_TRIO, 'F', t).reduce((a, b) => a + b, 0);
  const ref = PART_UNITE.F.reduce((a, b) => a + b, 0), refP = POIDS_TRIO.reduce((a, b) => a + b, 0);
  exiger(`${ROULEMENTS[cle].nom} · la somme des parts ne bouge pas`,
    Math.abs(sF - ref) < 1e-9 && Math.abs(sP - refP) < 1e-9,
    `${sF.toFixed(6)} et ${sP.toFixed(6)}`);
}

console.log(`\n  réglage             ΔV      ΔBP     ΔBC   Δbless.  Δtirs   Δpun   Δpart F1`);
const ligneMesure = (nom, r) => {
  console.log(`  ${nom.padEnd(18)} ${signe(r.v).padStart(5)}  ${signe(r.bp, 0).padStart(5)}  ${signe(r.bc, 0).padStart(5)}`
    + `  ${signe(r.bl, 1).padStart(6)}  ${signe(r.tirs, 0).padStart(5)}  ${signe(r.pun, 0).padStart(5)}  ${signe(r.partF1, 1).padStart(6)} %`);
  /*
   * LA BORNE EST LE CONTRAT : moins d'une victoire et demie d'écart net. Elle
   * est plus large que celle des cartes (±1) parce qu'un plan vaut TOUTE la
   * saison là où une carte n'en couvre que les deux tiers, et parce que le
   * roulement paie une partie de son prix en avril, que ce script ne voit pas.
   */
  if (juger) borne(`${nom} · écart net`, r.v, -1.5, 1.5, 'victoire');
  else informer(`${nom} · écart net`, `${signe(r.v)} victoire — non jugé, ${LIGUES} ligues sous le plancher de ${PLANCHER}`);
  informer(`${nom} · ce qui bouge`, `${signe(r.bp, 0)} BP · ${signe(r.bc, 0)} BC · ${signe(r.bl, 1)} blessure · `
    + `${signe(r.tirs, 0)} tir · ${signe(r.pun, 0)} minute de punition · ${signe(r.partF1, 1)} % au 1er trio`);
};

const mesures = {};
for (const cle of Object.keys(PLANS)) {
  if (cle === 'equilibre') continue;   // c'est le témoin : il ne fait rien
  mesures[cle] = paires('plan', cle);
  ligneMesure(PLANS[cle].nom, mesures[cle]);
}
for (const cle of Object.keys(ROULEMENTS)) {
  if (cle === 'quatre') continue;
  mesures[cle] = paires('roulement', cle);
  ligneMesure(ROULEMENTS[cle].nom, mesures[cle]);
}

/*
 * CHAQUE RÉGLAGE DOIT FAIRE CE QU'IL ANNONCE. Un plan qui ne déplace rien est
 * un plan décoratif, et c'est pire qu'un plan déséquilibré : le joueur le
 * choisit et ne voit jamais la différence. Ces quatre-là sont les promesses
 * écrites sur les boutons, donc des invariants de SIGNE, pas des repères.
 */
if (juger) {
  exiger("l'échec avant prend des punitions", mesures.echec.pun > 10, `${signe(mesures.echec.pun, 0)} minute`);
  exiger('la trappe alloue moins de buts', mesures.trappe.bc < -3, `${signe(mesures.trappe.bc, 0)} BC`);
  exiger('tout en attaque marque plus', mesures.surnombre.bp > 3, `${signe(mesures.surnombre.bp, 0)} BP`);
  exiger('trois trios donnent la rondelle au premier trio',
    mesures.trois.partF1 > 1.0, `${signe(mesures.trois.partF1, 1)} % de la production`);
  exiger('un banc profond la répartit', mesures.profond.partF1 < -0.5, `${signe(mesures.profond.partF1, 1)} %`);
  exiger('trois trios usent, un banc profond ménage',
    mesures.trois.bl > mesures.profond.bl, `${signe(mesures.trois.bl, 1)} contre ${signe(mesures.profond.bl, 1)} blessure`);
}

verdict('Le plan de match et le roulement');
