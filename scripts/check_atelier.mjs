/**
 * L'ATELIER ET LES VARIANTES (S78 ; V10, tranche 6) — chaque retouche fait ce qu'elle dit, et seulement à son
 * joueur ; la saison se rejoue à l'identique avec elles.
 *
 *   node scripts/check_atelier.mjs
 *
 * JP : *ajouter cartes pour éditer joueur* ; et *rareté = bonus random*. V10 : les éditions d'avant (joue partout,
 * monte d'un cran, joue en bas, la chasse, le physio, l'été de travail, le coach des gardiens) sont parties avec
 * l'ancien jeu ; l'atelier garde ses retouches de carte. Vérifie :
 *   1. un accident nuit, une retouche non (V21 : les protégés sont partis avec le personnel) ;
 *   2. « Le lustre » pose la carte suivante, et ses badges montent avec elle ;
 *   3. MONTER UN PALIER (V2.4) : au-delà de Platine, le palier de trop monte le second badge ; l'édition monte les
 *      siens — Cadre le second, Hors-cadre et Or les deux, Holo les deux de deux, un gardien de un à trois ; le
 *      mentor (le choix d'un fil) monte ses compagnons de ligne, et eux seulement ;
 *   4. une variante tire toujours la même carte, aux cotes de js/rarete.js ;
 *   5. l'atelier offre trois retouches différentes, pures, et sort au palier ;
 *   6. une saison avec le mentor se rejoue au but près, et la remise à zéro les efface d'une saison
 *      à l'autre.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, getPlayerKey,
  appliquerMutation, mutationNuit, editionsDuJour, mainDuDeck, badgesDe, profilMatch, activeLineup, joueursDeLigne,
} from '../js/sim.js';
import { carteDe, varianteTiree, COTES_VARIANTES, COTES_PAR_STATURE, statureDe, traitsDeCarte, VARIANTE_PALIERS, EDITIONS, NOM_VARIANTE } from '../js/rarete.js';
import { niveauDe } from '../js/niveaux.js';
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

// 1. Un accident nuit, une retouche non.
exiger('un accident nuit, une retouche non', mutationNuit('genou') && mutationNuit('lame') && !mutationNuit('pinceau'), '');

// 2. Le lustre : la carte suivante, et ses badges montent avec elle.
const lustre = avants[0].p;
lustre._carte = carteDe('commune');
const avantLustre = badgesDe(lustre).map(b => b.palier);
appliquerMutation(toi, lustre, 'lustre', 9, 'choix', { carte: carteDe('peu') });
const apresLustre = badgesDe(lustre).map(b => b.palier);
exiger('« Le lustre » pose la carte suivante, et ses badges montent avec elle', lustre._carte.rar === 'peu'
  && apresLustre.reduce((a, x) => a + x, 0) === Math.min(4 * apresLustre.length, avantLustre.reduce((a, x) => a + x, 0) + 1),
  `${lustre.n} : base → parallèle, ${avantLustre.join('/')} → ${apresLustre.join('/')} · « ${traitsDeCarte(lustre._carte).map(b => b.mot).join(' ')} »`);
delete lustre._carte;

// 3. Monter un palier (V2.4).
{
  const somme = p => badgesDe(p).reduce((a, b) => a + b.palier, 0);
  const deux = avants.map(x => x.p).find(p => badgesDe(p).length === 2 && badgesDe(p).every(b => b.palier <= 2));
  if (deux) {
    const [p1, p2] = badgesDe(deux).map(b => b.palier);
    deux._palier = 3 + (4 - p1);   // assez pour passer Platine : le reste monte le second
    const [r1, r2] = badgesDe(deux).map(b => b.palier);
    exiger('au-delà de Platine, le palier de trop monte le second badge', r1 === 4 && r2 > p2, `${r1}/${r2}`);
    delete deux._palier;
    const lu = {};
    for (const r of ['peu', 'hors', 'rare', 'legendaire']) { deux._carte = carteDe(r); lu[r] = badgesDe(deux).map(b => b.palier); }
    delete deux._carte;
    exiger('l\'édition sert le joueur : le Cadre monte le second badge, le Hors-cadre et l\'Or les deux, la Holo les deux de deux',
      ['peu', 'hors', 'rare', 'legendaire'].every(r => lu[r][0] === p1 + VARIANTE_PALIERS[r][0] && lu[r][1] === p2 + VARIANTE_PALIERS[r][1]),
      Object.entries(lu).map(([r, x]) => `${r} ${x.join('/')}`).join(' · '));
  }
  const gard = toi.roster[SLOTS.find(s => s.group === 'G').i], g0 = badgesDe(gard)[0];
  if (g0 && g0.palier === 1) {
    gard._carte = carteDe('legendaire');
    exiger('un gardien en Holo monte son badge de trois', badgesDe(gard)[0].palier === 4, `${g0.nom} ${g0.palier} → ${badgesDe(gard)[0].palier}`);
    delete gard._carte;
  }
  // Le mentor : sa ligne monte, les autres non.
  const lu = activeLineup(toi), [l0, l1] = [0, 1].map(u => Object.values(joueursDeLigne(lu, u)).filter(Boolean));
  const avantL = [l0, l1].map(js => js.map(somme));
  appliquerMutation(toi, l0[0], 'mentorTrio', 13, 'choix');
  profilMatch(toi, lu);
  const apresL = [l0, l1].map(js => js.map(somme));
  exiger('le mentor monte ses compagnons de ligne, et eux seulement', l0.slice(1).every((p, i) => apresL[0][i + 1] > avantL[0][i + 1] || badgesDe(p).every(b => b.palier >= 4))
    && apresL[1].every((x, i) => x === avantL[1][i]) && apresL[0][0] === avantL[0][0],
    `ligne 1 ${avantL[0].join(',')} → ${apresL[0].join(',')} · ligne 2 inchangée`);
}

// 4. Les variantes.
const cles = SAISONS.slice(0, 40).flatMap(f => shard(f).players.slice(0, 50).map(p => `${f}|${p.id}`));
const tirees = cles.map(k => varianteTiree(COTES_VARIANTES, 'graine', k));
const part = r => tirees.filter(x => x === r).length / tirees.length;
informer('éditions tirées', EDITIONS.map(r => `${NOM_VARIANTE[r]} ${(part(r) * 100).toFixed(1)} %`).join(' · '));
// Les cotes se LISENT dans js/rarete.js (docs/organisation-equilibrage.md, action 3) : elles ne se recopient plus ici.
const CV = COTES_VARIANTES;
exiger(`les éditions suivent leurs cotes (${EDITIONS.map(r => CV[r]).join(' / ')})`, Math.abs(part("commune") - CV.commune / 100) < 0.03 && Math.abs(part("peu") - CV.peu / 100) < 0.03 && Math.abs(part("hors") - CV.hors / 100) < 0.015 && Math.abs(part("rare") - CV.rare / 100) < 0.01, '');
// Les cotes par stature restent, en moyenne sur la ligue, près des cotes d'une carte ordinaire (js/rarete.js le promet).
{
  const parStature = cles.map(k => { const [f, id] = k.split('|'); const js = shard(f).players, p = js.find(q => String(q.id) === id); return varianteTiree(COTES_PAR_STATURE[statureDe(p, niveauDe(p, js))], 'graine', k); });
  const pS = r => parStature.filter(x => x === r).length / parStature.length;
  informer('éditions par stature', EDITIONS.map(r => `${NOM_VARIANTE[r]} ${(pS(r) * 100).toFixed(1)} %`).join(' · '));
  exiger('la Holo est la plus rare des éditions, par stature aussi', pS('legendaire') < pS('rare') && pS('rare') < pS('peu'), `Holo ${(pS('legendaire') * 100).toFixed(2)} % · Or ${(pS('rare') * 100).toFixed(2)} %`);
}
exiger('une variante est la même carte d\'un tirage à l\'autre', varianteTiree(COTES_VARIANTES, 'graine', cles[7]) === varianteTiree(COTES_VARIANTES, 'graine', cles[7])
  && JSON.stringify(carteDe('rare')) === JSON.stringify(carteDe('rare')), '');
exiger('l\'atelier offre trois retouches différentes, pures', new Set(editionsDuJour('g', 20)).size === 3 && JSON.stringify(editionsDuJour('g', 20)) === JSON.stringify(editionsDuJour('g', 20)), editionsDuJour('g', 20).join(' · '));
let vus = 0;
for (let k = 0; k < 400; k++) if (mainDuDeck(`atelier${k}`, 20).some(c => c.sorte === 'atelier')) vus++;
exiger('l\'atelier sort au palier', vus > 120, `${vus} mains sur 400`);

// 6. La saison se rejoue ; la remise à zéro efface.
const saison = decisions => {
  const tt = ligue(78), moi = tt[0];
  simulateLeague(tt, 82, { graine: 'atelier', decisions });
  return { moi, fiche: `${moi.W}-${moi.L}-${moi.OTL} ${moi.GF}-${moi.GA}` };
};
const cibleCle = getPlayerKey(SLOTS.filter(s => !s.scratch && s.group === 'F').map(s => ligue(78)[0].roster[s.i]).find(Boolean));
const decisions = [{ jour: 30, equipe: 0, mutation: { cle: 'mentorTrio', joueur: cibleCle } }];
const A = saison(decisions), B = saison(decisions);
const cible = Object.values(A.moi.roster).find(p => p && getPlayerKey(p) === cibleCle);
const poses = p => ['mentorTrio'].filter(k => (p._mutCles || []).includes(k));
exiger('la saison avec le mentor se rejoue au but près', A.fiche === B.fiche && poses(cible).length === 1, `${A.fiche} puis ${B.fiche} · ${poses(cible).join(', ')}`);
// Les mêmes objets rejoués sans décision : les éditions de la saison d'avant disparaissent.
simulateLeague([A.moi, ...ligue(78).slice(1)], 82, { graine: 'atelier', decisions: [] });
exiger('et la remise à zéro les efface', !poses(cible).length, `${cible.n} : ${poses(cible).join(', ') || 'rien'}`);

verdict();
