/*
 * UN ÉVÉNEMENT SE SENT, DES DEUX CÔTÉS (V3.4). JP : *tu scores plus, mais
 * l'adversaire aussi ; ton gardien arrête plus, mais plus de rebonds* ; *dans
 * ce sens-là*. Chaque événement de la banque est lu pour un club contre un
 * adversaire, le soir où il joue (`chiffresDuSoir`, la même lecture que les
 * chiffres à l'écran, que check_chiffres garantit égale au moteur) :
 *   1. il change la feuille : au moins un dixième de but par match, d'un côté
 *      ou de l'autre, pour presque tous ceux qui touchent aux buts ;
 *   2. la médiane se sent : un tiers de but marqué par match, au moins ;
 *   3. ça reste un échange : le net sur toute sa durée, en médiane, sous deux
 *      buts (la mesure en victoires, en paires, est check_banque).
 * Avant l'ampleur (`AMPLEUR_EVENEMENT`, js/banque.js) : 0,18 but marqué et
 * 0,08 accordé par match en médiane, 31 événements sous le dixième.
 *
 * UNE QUARANTAINE QUI SE TIRENT (V6, phase 4). JP : *les cartes sont trop
 * complexes, autant événements que le reste*. 160 événements valaient 0,03 V
 * en médiane, et 124 avaient la même forme (un bonus, un prix, deux canaux) :
 * douze fois « plus de finition, plus de punitions ». On n'en tire plus
 * qu'une quarantaine ; les autres portent `retire` (js/banque.js) et ne sortent
 * plus d'aucun tirage, mais une vieille partie les charge et les rejoue.
 * Les bornes 1 à 3 jugent donc les événements QUI SE TIRENT : ce sont eux que
 * le joueur rencontre ; un retiré n'arrive plus dans une partie neuve, et le
 * compter dans la médiane jugerait une banque que personne ne pige. S'y
 * ajoutent les règles du choix (docs/decisions.md, « Les événements passent
 * de 160 à une quarantaine ») :
 *   4. une quarantaine se tirent (30 à 50) ;
 *   5. aucun doublon : deux événements tirables n'ont jamais les mêmes canaux
 *      au même signe (les gestes et les jetons comptent pour un canal) ;
 *   6. chaque coach garde des événements de sa couleur ;
 *   7. une rare se voit dans la feuille (les seuils de check_cartes : ±2 tirs,
 *      ±0,3 but des deux clubs, ±0,5 punition, ±3 blessures par saison) ;
 *   8. un retiré ne sort d'aucun tirage (packs, packs des paliers, nœuds de la
 *      semaine), et sa définition rend encore sa décision.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam } from '../js/sim.js';
import { chiffresDuSoir } from '../js/impact.js';
import { BANQUE, EVENEMENTS, payloadDe, AMPLEUR_EVENEMENT } from '../js/banque.js';
import { COACHS, ORDRE_COACHS } from '../js/coachs.js';
import { PACKS_CARTES, tirerCartesPack } from '../js/packs.js';
import { noeudsDeLaSemaine } from '../js/noeuds.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed, n) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}

console.log('\n  UN ÉVÉNEMENT SE SENT, DES DEUX CÔTÉS\n');
/*
 * QUATRE PAIRES DE CLUBS, PAS UNE (V5). Une seule paire tirée faisait de la médiane une loterie : un club déjà au
 * plafond de précision écrase l'effet de toutes les cartes de finition (les shards de la V5 en ont tiré un). La
 * moyenne de quatre paires lit l'événement, pas le club.
 */
const clubs = ligue(4242, 8);
const PAIRES = [0, 2, 4, 6].map(i => [clubs[i], clubs[i + 1]]);
const bases = PAIRES.map(([A, B]) => chiffresDuSoir(A, null, B));
const BUTS = ['volume', 'finition', 'defense', 'discipline'];
const LUS = ['tirsPour', 'tirsContre', 'butsPour', 'butsContre', 'punitions', 'blessures'];
const tirables = Object.values(BANQUE).filter(c => c.cat === 'evenement' && !c.retire);
const retires = Object.values(BANQUE).filter(c => c.cat === 'evenement' && c.retire);
const lignes = [];
for (const c of tirables) {
  const p = payloadDe(c.id);
  if (!p || !p.effet) continue;
  const { nom, ico: _i, duree, regle: _r, ...e } = p.effet;
  const d = Object.fromEntries(LUS.map(k => [k, 0]));
  PAIRES.forEach(([A, B], k) => {
    A._effetMatch = [e];
    const av = chiffresDuSoir(A, null, B);
    delete A._effetMatch;
    for (const x of LUS) d[x] += (av[x] - bases[k][x]) / PAIRES.length;
  });
  lignes.push({ c, nom, duree: duree || 0, d, bp: d.butsPour, bc: d.butsContre, total: (d.butsPour - d.butsContre) * (duree || 0), buts: BUTS.some(k => k in e) });
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const f2 = x => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2).replace('.', ',')}`;
const f1 = x => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1).replace('.', ',')}`;
const touchent = lignes.filter(l => l.buts);
const muets = touchent.filter(l => Math.max(Math.abs(l.bp), Math.abs(l.bc)) < 0.1);
informer('l\'ampleur', `×${AMPLEUR_EVENEMENT} sur l'écart de chaque canal, le gain et son prix`);
informer('médianes par match, des tirables', `${f2(med(lignes.map(l => Math.abs(l.bp))))} but marqué · ${f2(med(lignes.map(l => Math.abs(l.bc))))} accordé · sur ${med(lignes.map(l => l.duree))} matchs`);
const ouverts = lignes.filter(l => l.bp >= 0.25 && l.bc >= 0.25).sort((a, b) => b.bp + b.bc - a.bp - a.bc).slice(0, 3);
if (ouverts.length) informer('les matchs qui s\'ouvrent', ouverts.map(l => `${l.nom} ${f2(l.bp)} / ${f2(l.bc)}`).join(' · '));
borne('presque tous ceux qui touchent aux buts changent la feuille (part sous un dixième de but)', muets.length / touchent.length, 0, 0.1);
borne('la médiane se sent : buts marqués par match', med(lignes.map(l => Math.abs(l.bp))), 0.3, 1);
borne('ça reste un échange : le net sur toute la durée, en médiane (buts)', med(lignes.map(l => Math.abs(l.total))), 0, 2);
exiger('aucun événement ne dépasse deux buts par match d\'un côté', lignes.every(l => Math.abs(l.bp) <= 2 && Math.abs(l.bc) <= 2), lignes.filter(l => Math.abs(l.bp) > 2 || Math.abs(l.bc) > 2).map(l => l.nom).join(', ') || `${lignes.length} événements`);

/* 4. Une quarantaine. */
borne('une quarantaine d\'événements se tirent', tirables.length, 30, 50, ` sur ${tirables.length + retires.length}`);

/* 5. Aucun doublon : la forme d'un événement, ses canaux au signe près (le bas ou le haut de l'alignement pour la glace). */
const forme = cle => {
  const E = EVENEMENTS[cle], out = [];
  for (const [k, v] of Object.entries(E.effet || {})) {
    if (Array.isArray(v)) out.push(`${k}${v[v.length - 1] > v[0] ? '↓' : '↑'}`);
    else out.push(`${k}${v > (k === 'robustesse' ? 0 : 1) ? '+' : '−'}`);
  }
  for (const k of Object.keys(E.gestes || {})) if (k !== 'tousLesBlesses') out.push(`geste:${k}`);
  if (E.gain) out.push('jetons');
  return out.sort().join(' ');
};
const parForme = new Map();
for (const c of tirables) parForme.set(forme(c.cle), [...(parForme.get(forme(c.cle)) || []), c.cle]);
const doublons = [...parForme.values()].filter(l => l.length > 1);
exiger('deux événements tirables ne font jamais la même chose (mêmes canaux, même signe)', !doublons.length, doublons.map(l => l.join(' = ')).join(' · ') || `${parForme.size} formes`);

/* 6. Chaque coach. */
const parCoach = ORDRE_COACHS.map(k => [k, tirables.filter(c => c.coach === k).length]);
exiger('chaque coach garde des événements de sa couleur', parCoach.every(([, n]) => n > 0),
  `${parCoach.map(([k, n]) => `${COACHS[k].ico} ${n}`).join(' · ')} · neutres ${tirables.filter(c => !c.coach).length}`);

/* 7. Une rare se voit. */
const SEUIL = { tirs: 2, buts: 0.3, punitions: 0.5, blessures: 3 };
const abs = Math.abs;
const visible = ({ d }) => abs(d.tirsPour) >= SEUIL.tirs || abs(d.tirsContre) >= SEUIL.tirs || abs(d.tirsPour + d.tirsContre) >= SEUIL.tirs
  || abs(d.butsPour) + abs(d.butsContre) >= SEUIL.buts || abs(d.punitions) >= SEUIL.punitions || abs(d.blessures * 82) >= SEUIL.blessures;
const rares = lignes.filter(l => l.c.rarete === 'rare' || l.c.rarete === 'legendaire');
exiger('une rare se voit dans la feuille', rares.every(visible), rares.filter(l => !visible(l)).map(l => l.nom).join(', ') || `${rares.length} rares`);

/* 8. Un retiré ne se tire plus, et se rejoue. */
const tires = new Set();
for (let n = 0; n < 300; n++) {
  for (const k of Object.keys(PACKS_CARTES)) tirerCartesPack(k, `ev${n}`, n).forEach(id => tires.add(id));
  for (const p of [9, 18, 26]) tirerCartesPack('mixte', `ev${n}`, `palier${p}`, { sans: ['match'] }).forEach(id => tires.add(id));
}
for (let g = 0; g < 40; g++) for (let w = 1; w <= 26; w += 2) noeudsDeLaSemaine(`ev${g}`, w).forEach(x => tires.add(x.id));
const sortis = [...tires].filter(id => BANQUE[id] && BANQUE[id].retire);
exiger('un événement retiré ne sort d\'aucun tirage (packs, paliers, nœuds)', !sortis.length, sortis.slice(0, 5).join(', ') || `${tires.size} cartes tirées, ${tirables.filter(c => tires.has(c.id)).length} des ${tirables.length} événements`);
const muetsRetires = retires.filter(c => { const p = payloadDe(c.id); return !p || !p.effet; });
exiger('un événement retiré rend encore sa décision (une vieille partie le rejoue)', !muetsRetires.length, muetsRetires.map(c => c.cle).join(', ') || `${retires.length} retirés`);

/* Le tableau des tirables : ce que chacun change par match, contre l'adversaire. */
console.log('\n  événement                         rareté   coach        tirs pour/contre   buts pour/contre   punitions  blessures/saison');
for (const l of lignes.slice().sort((a, b) => (a.c.coach || 'zz').localeCompare(b.c.coach || 'zz') || a.nom.localeCompare(b.nom))) {
  const { d } = l, co = COACHS[l.c.coach];
  console.log(`  ${l.nom.slice(0, 32).padEnd(33)} ${l.c.rarete.padEnd(8)} ${(co ? `${co.ico} ${co.nom}` : 'neutre').slice(0, 12).padEnd(12)} ${f1(d.tirsPour).padStart(6)} /${f1(d.tirsContre).padStart(6)}    ${f2(d.butsPour).padStart(6)} /${f2(d.butsContre).padStart(6)}    ${f2(d.punitions).padStart(6)}    ${f1(d.blessures * 82).padStart(6)}`);
}
console.log('');
verdict();
