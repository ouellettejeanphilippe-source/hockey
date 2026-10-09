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
 *   4. « Le lustre » pose la carte suivante, et ses badges montent avec elle ;
 *   4b. MONTER UN PALIER (V2.4) : l'été de travail monte le premier badge
 *      (au-delà de Platine, le second) ; la variante monte le sien —
 *      parallèle le second, holo le premier, or les deux, un gardien de un à
 *      trois ; ce que le moteur joue (`maitrise`) suit le badge montré ; le
 *      mentor monte ses compagnons de ligne, et eux seulement ;
 *   5. le coach des gardiens accorde moins de buts ;
 *   6. une variante tire toujours la même carte ;
 *   7. une saison avec une édition se rejoue au but près, et la remise à
 *      zéro efface les éditions d'une saison à l'autre.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, getPlayerKey, getPositionPenalty,
  appliquerMutation, unitesIdeales, getHiddenRatings, facteurGardienDe, MUTATIONS, mutationNuit, editionsDuJour, mainDuDeck,
  malusZoneUnite, getUnitSynergy, badgesDe, maitrise, profilMatch, activeLineup, joueursDeLigne,
} from '../js/sim.js';
import { carteDe, varianteTiree, COTES_VARIANTES, traitsDeCarte, VARIANTE_PALIERS } from '../js/rarete.js';
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

// 2b. Joue en bas : le 4e trio seulement.
const star = avants.map(x => x.p).find(p => Math.max(...unitesIdeales(p, getHiddenRatings(p).v)) <= 1);
if (star) {
  const v = getHiddenRatings(star).v, ideal = unitesIdeales(star, v);
  const sans4 = malusZoneUnite('F', 3, [{ v, ideal }]).pen;
  const avec4 = malusZoneUnite('F', 3, [{ v, ideal, enBas: true }]).pen;
  const avec3 = malusZoneUnite('F', 2, [{ v, ideal, enBas: true }]).pen;
  exiger('« Joue en bas » efface le 4e trio et pas le 3e', sans4 > 0 && avec4 === 0 && avec3 > 0,
    `${star.n} : 4e ${sans4.toFixed(1)} → ${avec4.toFixed(1)}, 3e ${avec3.toFixed(1)}`);
  appliquerMutation(toi, star, 'enBas', 11, 'choix');
  const iStar = SLOTS.find(s => toi.roster[s.i] === star).i;
  const iBas = SLOTS.find(s => s.group === 'F' && s.unit === 3 && !s.scratch).i;
  const garde = toi.roster[iBas];
  toi.roster[iBas] = star; toi.roster[iStar] = garde;
  const haut = getUnitSynergy(toi.roster, 'F', 3).bonusOff;
  star._enBas = false;
  const basOff = getUnitSynergy(toi.roster, 'F', 3).bonusOff;
  star._enBas = true;
  exiger('« Joue en bas » relève le 4e trio où il est assis', haut > basOff + 5, `${basOff.toFixed(1)} → ${haut.toFixed(1)}`);
  toi.roster[iStar] = star; toi.roster[iBas] = garde;
}
exiger('« La chasse » pose son ombre, « le fantôme » son abri', (() => {
  const p = avants[0].p;
  appliquerMutation(toi, p, 'chasse', 12, 'choix');
  appliquerMutation(toi, p, 'style_fantome', 12, 'choix');
  return p._ombre === MUTATIONS.chasse.ombre && p._abri === MUTATIONS.style_fantome.abri;
})(), '');

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

// 4. Le lustre : la carte suivante, et ses badges montent avec elle.
const lustre = avants[0].p;
lustre._carte = carteDe('commune');
const avantLustre = badgesDe(lustre).map(b => b.palier);
appliquerMutation(toi, lustre, 'lustre', 9, 'choix', { carte: carteDe('peu') });
const apresLustre = badgesDe(lustre).map(b => b.palier);
exiger('« Le lustre » pose la carte suivante, et ses badges montent avec elle', lustre._carte.rar === 'peu'
  && apresLustre.reduce((a, x) => a + x, 0) === Math.min(4 * apresLustre.length, avantLustre.reduce((a, x) => a + x, 0) + 1),
  `${lustre.n} : base → parallèle, ${avantLustre.join('/')} → ${apresLustre.join('/')} · « ${traitsDeCarte(lustre._carte).map(b => b.mot).join(' ')} »`);
delete lustre._carte;

// 4b. Monter un palier (V2.4).
{
  const somme = p => badgesDe(p).reduce((a, b) => a + b.palier, 0);
  const deux = avants.map(x => x.p).find(p => badgesDe(p).length === 2 && badgesDe(p).every(b => b.palier <= 2));
  if (deux) {
    const [p1, p2] = badgesDe(deux).map(b => b.palier), role = badgesDe(deux)[0].cle, m0 = maitrise(deux, role);
    appliquerMutation(toi, deux, 'entrainement', 12, 'choix');
    const [q1, q2] = badgesDe(deux).map(b => b.palier);
    exiger('l\'été de travail monte son premier badge, et le moteur le joue', q1 === p1 + 1 && q2 === p2 && maitrise(deux, role) > m0,
      `${deux.n} : ${p1}/${p2} → ${q1}/${q2}, maîtrise ${m0.toFixed(3)} → ${maitrise(deux, role).toFixed(3)}`);
    deux._palier = 3 + (4 - p1);   // assez pour passer Platine : le reste monte le second
    const [r1, r2] = badgesDe(deux).map(b => b.palier);
    exiger('au-delà de Platine, le palier de trop monte le second badge', r1 === 4 && r2 > p2, `${r1}/${r2}`);
    delete deux._palier;
    const lu = {};
    for (const r of ['peu', 'rare', 'legendaire']) { deux._carte = carteDe(r); lu[r] = badgesDe(deux).map(b => b.palier); }
    delete deux._carte;
    exiger('la variante sert le joueur : parallèle le second badge, holo le premier, or les deux',
      ['peu', 'rare', 'legendaire'].every(r => lu[r][0] === p1 + VARIANTE_PALIERS[r][0] && lu[r][1] === p2 + VARIANTE_PALIERS[r][1]),
      Object.entries(lu).map(([r, x]) => `${r} ${x.join('/')}`).join(' · '));
  }
  const gard = toi.roster[SLOTS.find(s => s.group === 'G').i], g0 = badgesDe(gard)[0];
  if (g0 && g0.palier === 1) {
    gard._carte = carteDe('legendaire');
    exiger('un gardien en or monte son badge de trois', badgesDe(gard)[0].palier === 4, `${g0.nom} ${g0.palier} → ${badgesDe(gard)[0].palier}`);
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
// Les cotes se LISENT dans js/rarete.js (docs/organisation-equilibrage.md, action 3) : elles ne se recopient plus ici.
const CV = COTES_VARIANTES;
exiger(`les variantes suivent leurs cotes (${CV.commune} / ${CV.peu} / ${CV.rare} / ${CV.legendaire})`, Math.abs(part("commune") - CV.commune / 100) < 0.03 && Math.abs(part("peu") - CV.peu / 100) < 0.03 && Math.abs(part("rare") - CV.rare / 100) < 0.01, '');
exiger('une variante est la même carte d\'un tirage à l\'autre', varianteTiree(COTES_VARIANTES, 'graine', cles[7]) === varianteTiree(COTES_VARIANTES, 'graine', cles[7])
  && JSON.stringify(carteDe('rare')) === JSON.stringify(carteDe('rare')), '');
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
  { jour: 30, equipe: 0, deck: 'atelier', mutation: { cle: 'cran', joueur: cibleCle } },
  { jour: 40, equipe: 0, deck: 'atelier', mutation: { cle: 'enBas', joueur: cibleCle } },
  { jour: 50, equipe: 0, deck: 'atelier', mutation: { cle: 'chasse', joueur: cibleCle } }];
const A = saison(decisions), B = saison(decisions);
const cible = Object.values(A.moi.roster).find(p => p && getPlayerKey(p) === cibleCle);
exiger('la saison avec l\'atelier se rejoue au but près', A.fiche === B.fiche && !!cible._partout && cible._cran === 1 && !!cible._enBas && cible._ombre === MUTATIONS.chasse.ombre, `${A.fiche} puis ${B.fiche}`);
// Les mêmes objets rejoués sans décision : les éditions de la saison d'avant disparaissent.
simulateLeague([A.moi, ...ligue(78).slice(1)], 82, { graine: 'atelier', decisions: [] });
exiger('et la remise à zéro efface les éditions', !cible._partout && !cible._cran && !cible._enBas && !cible._ombre, `${cible.n} : partout ${!!cible._partout}, cran ${cible._cran || 0}, en bas ${!!cible._enBas}, ombre ${cible._ombre || 0}`);

verdict();
