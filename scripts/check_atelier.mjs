/**
 * L'ATELIER ET LES VARIANTES (S78) — chaque édition fait ce qu'elle dit, et
 * seulement à son joueur ; la saison se rejoue à l'identique avec elles.
 *
 *   node scripts/check_atelier.mjs
 *
 * JP : *ajouter cartes pour éditer joueur, genre ajouter position, changer
 * trios possibles, stats, enlever malus, ajouter bonus* ; et *rareté = bonus
 * random*. Vérifie :
 *   1. « Joue partout » efface la pénalité hors position de son groupe ;
 *   2. « Monte d'un cran » ajoute l'unité au-dessus de sa zone ;
 *   3. « Le physio » efface les malus (un accident disparaît de la carte,
 *      un changement mêlé garde son bonus) ;
 *   4. « Le lustre » pose la carte suivante, et son bonus joue ;
 *   5. le coach des gardiens accorde moins de buts ;
 *   6. une variante tire toujours la même carte, et une or porte deux
 *      bonus différents ;
 *   7. une saison avec une édition se rejoue au but près, et la remise à
 *      zéro efface les éditions d'une saison à l'autre.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, getPlayerKey, getPositionPenalty,
  appliquerMutation, unitesIdeales, getHiddenRatings, facteurGardienDe, MUTATIONS, mutationNuit, editionsDuJour, mainDuDeck,
} from '../js/sim.js';
import { carteDe, varianteTiree, COTES_VARIANTES, effetCarte, traitsDeCarte } from '../js/rarete.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < 16) {
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
  out[0].isPlayer = true;
  return out;
}

console.log('\n  L\'atelier et les variantes (S78)\n');
const t = ligue(78);
const toi = t[0];
const avants = SLOTS.filter(s => !s.scratch && s.group === 'F').map(s => ({ s, p: toi.roster[s.i] })).filter(x => x.p);

// 1. Joue partout.
const slotC = SLOTS.find(s => s.group === 'F' && s.role === 'C' && !s.scratch);
const ailier = avants.map(x => x.p).find(p => getPositionPenalty(p, slotC) > 0);
const avantP = ailier ? getPositionPenalty(ailier, slotC) : 0;
if (ailier) appliquerMutation(toi, ailier, 'partout', 5, 'choix');
exiger('« Joue partout » efface la pénalité hors position', ailier && avantP > 0 && getPositionPenalty(ailier, slotC) === 0,
  ailier ? `${ailier.n} au centre : −${avantP} → −${getPositionPenalty(ailier, slotC)}` : 'aucun ailier trouvé');

// 2. Monte d'un cran.
const bas = avants.map(x => x.p).find(p => Math.min(...unitesIdeales(p, getHiddenRatings(p).v)) > 0);
const zAvant = bas ? unitesIdeales(bas, getHiddenRatings(bas).v) : [];
if (bas) appliquerMutation(toi, bas, 'cran', 5, 'choix');
const zApres = bas ? unitesIdeales(bas, getHiddenRatings(bas).v) : [];
exiger('« Monte d\'un cran » ajoute l\'unité au-dessus de sa zone', bas && zApres.length === zAvant.length + 1 && zApres.includes(Math.min(...zAvant) - 1),
  bas ? `${bas.n} : trios ${zAvant.map(u => u + 1).join(',')} → ${zApres.map(u => u + 1).sort().join(',')}` : 'aucun joueur sous le 1er trio');

// 3. Le physio.
const blesse = avants[avants.length - 1].p;
appliquerMutation(toi, blesse, 'genou', 6, 'accident');
appliquerMutation(toi, blesse, 'lame', 7, 'choix');
const avantPhysio = { ...blesse._mut };
appliquerMutation(toi, blesse, 'physio', 8, 'choix');
exiger('« Le physio » efface les malus et garde les bonus', blesse._mut.lancers === 1 && blesse._mut.blessure === 1 && blesse._mut.finition === 1
  && Math.abs(blesse._mut.defense - MUTATIONS.lame.defense) < 1e-9 && !blesse._mutCles.includes('genou') && blesse._mutCles.includes('lame')
  && Object.values(blesse._mutProfils).every(d => d >= 0),
  `lancers ${avantPhysio.lancers.toFixed(2)}→${blesse._mut.lancers}, finition ${avantPhysio.finition.toFixed(2)}→${blesse._mut.finition}, défense ${blesse._mut.defense} gardée`);
exiger('un accident nuit, une amélioration non', mutationNuit('genou') && mutationNuit('lame') && !mutationNuit('affute') && !mutationNuit('coach'), '');

// 4. Le lustre.
const lustre = avants[0].p;
lustre._carte = carteDe('commune', false, 'g', getPlayerKey(lustre));
const suivante = carteDe('peu', false, 'g', getPlayerKey(lustre));
appliquerMutation(toi, lustre, 'lustre', 9, 'choix', { carte: suivante });
const canal = { finition: 'finition', lancers: 'lancers', creation: 'creation', defense: 'defense', solide: 'blessure', clutch: 'clutch', polyvalent: 'horsPosition' }[suivante.bonus[0].cle];
const eff = canal === 'clutch' ? 1.06 : effetCarte(lustre, canal);
exiger('« Le lustre » pose la carte suivante, et son bonus joue', lustre._carte.rar === 'peu' && eff !== 1,
  `${lustre.n} : base → parallèle, ${traitsDeCarte(lustre._carte).map(b => `${b.ico} ${b.nom}`).join(' ')} (×${eff.toFixed(3)})`);
delete lustre._carte;

// 5. Le coach des gardiens.
const g = toi.roster[SLOTS.find(s => s.group === 'G').i];
const fg0 = facteurGardienDe(g);
appliquerMutation(toi, g, 'coach', 10, 'choix');
exiger('le coach des gardiens accorde moins de buts', Math.abs(facteurGardienDe(g) / fg0 - MUTATIONS.coach.arrets) < 1e-9,
  `${g.n} : ×${(facteurGardienDe(g) / fg0).toFixed(3)}`);

// 6. Les variantes.
const cles = SAISONS.slice(0, 40).flatMap(f => shard(f).players.slice(0, 50).map(p => `${f}|${p.id}`));
const tirees = cles.map(k => varianteTiree(COTES_VARIANTES, 'graine', k));
const part = r => tirees.filter(x => x === r).length / tirees.length;
informer('variantes tirées', `base ${(part('commune') * 100).toFixed(0)} % · parallèle ${(part('peu') * 100).toFixed(0)} % · holo ${(part('rare') * 100).toFixed(1)} % · or ${(part('legendaire') * 100).toFixed(1)} %`);
exiger('les variantes suivent leurs cotes (75 / 17 / 6 / 2)', Math.abs(part('commune') - 0.75) < 0.03 && Math.abs(part('peu') - 0.17) < 0.03 && Math.abs(part('rare') - 0.06) < 0.02, '');
const ors = cles.slice(0, 300).map(k => carteDe('legendaire', false, 'graine', k));
exiger('une or porte deux bonus différents, et la même carte d\'un tirage à l\'autre', ors.every(c => c.bonus.length === 2 && c.bonus[0].cle !== c.bonus[1].cle)
  && JSON.stringify(carteDe('rare', true, 'x', 'k')) === JSON.stringify(carteDe('rare', true, 'x', 'k')), '');
exiger('l\'atelier offre trois éditions différentes, pures', new Set(editionsDuJour('g', 20)).size === 3 && JSON.stringify(editionsDuJour('g', 20)) === JSON.stringify(editionsDuJour('g', 20)), editionsDuJour('g', 20).join(' · '));
let vus = 0;
for (let k = 0; k < 400; k++) if (mainDuDeck(`atelier${k}`, 20, []).some(c => c.sorte === 'atelier')) vus++;
exiger('l\'atelier sort au palier', vus > 60, `${vus} mains sur 400`);

// 7. La saison se rejoue ; la remise à zéro efface.
const saison = decisions => {
  const tt = ligue(78), moi = tt[0];
  simulateLeague(tt, 82, { graine: 'atelier', decisions });
  return { moi, fiche: `${moi.W}-${moi.L}-${moi.OTL} ${moi.GF}-${moi.GA}` };
};
const cibleCle = getPlayerKey(SLOTS.filter(s => !s.scratch && s.group === 'F').map(s => ligue(78)[0].roster[s.i]).find(Boolean));
const decisions = [{ jour: 20, equipe: 0, deck: 'atelier', mutation: { cle: 'partout', joueur: cibleCle } },
  { jour: 30, equipe: 0, deck: 'atelier', mutation: { cle: 'cran', joueur: cibleCle } }];
const A = saison(decisions), B = saison(decisions);
const cible = Object.values(A.moi.roster).find(p => p && getPlayerKey(p) === cibleCle);
exiger('la saison avec l\'atelier se rejoue au but près', A.fiche === B.fiche && !!cible._partout && cible._cran === 1, `${A.fiche} puis ${B.fiche}`);
// Les mêmes objets rejoués sans décision : les éditions de la saison d'avant disparaissent.
simulateLeague([A.moi, ...ligue(78).slice(1)], 82, { graine: 'atelier', decisions: [] });
exiger('et la remise à zéro efface les éditions', !cible._partout && !cible._cran, `${cible.n} : partout ${!!cible._partout}, cran ${cible._cran || 0}`);

verdict();
