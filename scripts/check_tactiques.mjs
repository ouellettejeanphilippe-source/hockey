/*
 * LES LIGNES À LA HOCKEYARENA (S68) — chaque réglage doit PAYER ou COÛTER,
 * sans décider la saison. Mesuré EN PAIRES (voir check_cartes.mjs), contre
 * les réglages par défaut d'un club de l'IA (chaque ligne dans la tactique
 * où elle a le meilleur fit, 60 secondes ; V7 : l'agressivité est celle de la
 * carrure de ses joueurs, elle ne se règle plus).
 *
 *   mal assorti      chaque ligne dans la tactique où elle a le PIRE fit
 *   hourra partout   aucun système : ni chimie, ni action spéciale
 *   80 s au 1er trio la première ligne surutilisée : sa fatigue
 *
 * Le contrat : mal assortir COÛTE (au moins une victoire), aucun réglage ne
 * vaut plus de quatre victoires dans un sens ou dans l'autre, et le système
 * se VOIT — la part des buts sur action spéciale, des actions étouffées et
 * l'énergie de fin de saison sont imprimées.
 *
 *   node scripts/check_tactiques.mjs
 *   LIGUES=8 node scripts/check_tactiques.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, activeLineup, fitUnite, TACTIQUES, SYSTEMES_D, SLOTS, physiqueLigne, badgesDe, fitDeCase, FIT_BASE, FIT_PAR_PALIER, rangSystemes,
  meilleureTactique, meilleurSystemeD, identiteUnite, fitDeLigne, chimieLigne, agressiviteDeLigne } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { estD } from '../js/util.js';
import { borne, exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 6);
const juger = LIGUES >= 6;
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
/*
 * LE CYCLE EST FERMÉ (V2.2). La règle dit que chaque système en étouffe un autre : chaque système de trio
 * étouffe exactement un trio et l'est par exactement un (un cycle qui passe par les sept), et chaque système
 * de paire étouffe un système de trio. Avant, l'enclave, les plombiers et le jeu à deux sens n'étouffaient
 * rien, et le Trio de plombiers ne pouvait jamais être étouffé.
 */
{
  const trios = Object.keys(TACTIQUES).filter(k => k !== 'hourra'), paires = Object.keys(SYSTEMES_D).filter(k => k !== 'hourra');
  const etouffe = Object.fromEntries(trios.map(k => [k, TACTIQUES[k].bat]));
  const parCombien = Object.fromEntries(trios.map(k => [k, trios.filter(x => etouffe[x] === k).length]));
  let k = trios[0], vus = new Set();
  while (k && !vus.has(k)) { vus.add(k); k = etouffe[k]; }
  exiger('chaque système de trio en étouffe un, et un seul l\'étouffe', trios.every(t => trios.includes(etouffe[t]) && parCombien[t] === 1),
    trios.filter(t => !trios.includes(etouffe[t]) || parCombien[t] !== 1).map(t => `${TACTIQUES[t].nom} : étouffe ${etouffe[t] || 'rien'}, étouffé ${parCombien[t]} fois`).join(' · ') || 'un pour un');
  exiger('le cycle des trios passe par les sept', vus.size === trios.length && k === trios[0], [...vus].map(t => TACTIQUES[t].ico).join(' → '));
  exiger('chaque système de paire étouffe un système de trio', paires.every(d => trios.includes(SYSTEMES_D[d].bat)), paires.map(d => `${SYSTEMES_D[d].ico} → ${TACTIQUES[SYSTEMES_D[d].bat] ? TACTIQUES[SYSTEMES_D[d].bat].ico : '∅'}`).join(' · '));
}
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
const CLES = Object.keys(TACTIQUES).filter(k => k !== 'hourra');
// Le rang de l'IA (V2.3) : le fit, puis l'affinité qui départage les unités sans le badge d'aucun système.
const rangDe = (team, g, u) => rangSystemes(activeLineup(team), g, u);
const pire = (team, u) => { const r = rangDe(team, 'F', u); return r ? r[r.length - 1] : undefined; };

/*
 * `temoin` (S72) : ce que jouent les équipes SANS la décision. Par défaut,
 * les réglages de la ligue — qui choisissent eux-mêmes la tactique payante.
 * Pour éprouver un principe, on peut comparer à un témoin fixe.
 */
function paires(fabrique, temoin = null, nLigues = LIGUES) {
  const dv = [], dbp = [], dbc = [], en = [];
  let spec = 0, etouf = 0, buts = 0;
  for (let L = 0; L < nLigues; L++) {
    const bras = [];
    for (const parite of [0, 1]) {
      const teams = ligue(4000 + L);
      const decisions = teams.map((t, i) => [t, i])
        .filter(([, i]) => i % 2 === parite || temoin)
        .map(([t, i]) => ({ jour: 0, equipe: i, lignes: i % 2 === parite ? fabrique(t) : temoin(t) }));
      const { calendrier } = simulateLeague(teams, 82, { graine: `tac-${L}`, decisions });
      bras.push(teams.map(t => ({ W: t.W, GF: t.GF, GA: t.GA,
        e: moy(SLOTS.filter(s => !s.scratch && t.roster[s.i] && t.roster[s.i].p !== 'G').map(s => t.roster[s.i].energie ?? 100)) })));
      if (parite === 0) for (const j of calendrier) for (const m of j) {
        for (const b of m.feuille.buts) { buts++; if (b.special === 'reussie') spec++; }
        for (const l of m.feuille.lancers) if (l.special === 'etouffee') etouf++;
      }
    }
    for (let i = 0; i < 32; i++) {
      const avec = bras[i % 2 === 0 ? 0 : 1][i], sans = bras[i % 2 === 0 ? 1 : 0][i];
      dv.push(avec.W - sans.W); dbp.push(avec.GF - sans.GF); dbc.push(avec.GA - sans.GA); en.push(avec.e);
    }
  }
  return { v: moy(dv), bp: moy(dbp), bc: moy(dbc), e: moy(en), spec: buts ? spec / buts : 0, etouf: etouf / nLigues };
}
const dire = (t, r) => console.log(`  ${t.padEnd(26)} ${signe(r.v).padStart(5)} V  ${signe(r.bp, 0).padStart(4)} BP  ${signe(r.bc, 0).padStart(4)} BC   énergie finale ${r.e.toFixed(0)}`);
const tous = (tac, sec = 60) => [0, 1, 2, 3].map(() => ({ tac, sec }));

console.log(`\n  ${LIGUES} ligues × 32 équipes, contre les réglages par défaut\n`);
const mal = paires(t => [0, 1, 2, 3].map(u => ({ tac: pire(t, u), sec: 60 }))); dire('mal assorti', mal);
const hourra = paires(() => tous('hourra')); dire('hourra partout', hourra);
const use = paires(t => [80, 60, 55, 45].map(sec => ({ tac: undefined, sec }))); dire('80 s au 1er trio', use);
/*
 * LE PHYSIQUE DÉCIDE (S71, V7). JP : *les joueurs vont être robustes selon
 * leur tendance, pas le niveau choisi*. L'agressivité d'une ligne est celle
 * de sa carrure (`agressiviteDeLigne`) : dans chaque club, ses deux lignes
 * les plus costaudes jouent au moins aussi physique que ses deux plus légères.
 */
const parPhysique = t => { const L = activeLineup(t); return [0, 1, 2, 3].sort((a, b) => physiqueLigne(L, b) - physiqueLigne(L, a)); };
{
  const clubs = ligue(4000);
  const agrDe = (t, us) => us.reduce((a, u) => a + agressiviteDeLigne(activeLineup(t), u), 0) / us.length;
  const contre = clubs.filter(t => agrDe(t, parPhysique(t).slice(0, 2)) < agrDe(t, parPhysique(t).slice(2))).length;
  const vues = new Set(clubs.flatMap(t => [0, 1, 2, 3].map(u => agressiviteDeLigne(activeLineup(t), u))));
  exiger('la carrure fait l\'agressivité : les lignes costaudes jouent au moins aussi physique que les légères', contre === 0, `${contre} club(s) sur ${clubs.length} à l'envers · ${vues.size} agressivités jouées dans la ligue`);
}
/*
 * UN SYSTÈME POUR LE TRIO, UN AUTRE POUR LA PAIRE (S79). Trois contrats de
 * plus : une PAIRE mal assortie coûte aussi ; aucun système n'est bon
 * partout — forcer TOUS les trios (ou toutes les paires) dans le même ne
 * rapporte pas, puisque le défaut prend déjà le meilleur fit de chacun ; et
 * le FIT compte — un système joué par les bons joueurs vaut plus que le
 * même joué par les mauvais.
 */
const CLES_D = Object.keys(SYSTEMES_D).filter(k => k !== 'hourra');
const pireD = (team, u) => { const r = rangDe(team, 'D', u); return r ? r[r.length - 1] : undefined; };
const malD = paires(t => [0, 1, 2, 3].map(u => ({ tac: undefined, tacD: u < 3 ? pireD(t, u) : undefined, sec: 60 }))); dire('paires mal assorties', malD);
const LIG_DOM = Math.max(2, Math.round(LIGUES / 2));
const forces = [];
for (const k of CLES) { const r = paires(() => [0, 1, 2, 3].map(() => ({ tac: k, sec: 60 })), null, LIG_DOM); forces.push([TACTIQUES[k].nom, r]); dire(`tous les trios · ${k}`, r); }
for (const k of CLES_D) { const r = paires(() => [0, 1, 2, 3].map(() => ({ tac: undefined, tacD: k, sec: 60 })), null, LIG_DOM); forces.push([SYSTEMES_D[k].nom, r]); dire(`toutes les paires · ${k}`, r); }
/*
 * Le fit compte PAR DEGRÉS : chaque trio dans son DEUXIÈME système (un peu
 * moins bien assorti) coûte, mais nettement moins que dans son pire. Le gain
 * d'un système suit le fit (`echelleFit`) et la chimie aussi (`chimieMax`).
 */
const rangF = (team, u, i) => { const r = rangDe(team, 'F', u); return r ? r[i] : undefined; };
const second = paires(t => [0, 1, 2, 3].map(u => ({ tac: rangF(t, u, 1), sec: 60 }))); dire('chaque trio dans son 2e système', second);
informer('buts sur action spéciale', `${(100 * mal.spec).toFixed(1)} % des buts de la ligue`);
informer('actions étouffées par un contre', `${mal.etouf.toFixed(0)} par ligue`);

if (juger) {
  borne('mal assortir coûte', -mal.v, 1, 6, 'victoire');
  // 7 et non 6 (1.0, J1-M, mesuré 6,21) : la chimie compte plus, donc un système aussi ; c'est l'effet voulu.
  borne('jouer sans système coûte', -hourra.v, 0.5, 7, 'victoire');
  borne('80 s au 1er trio · écart net', use.v, -4, 4, 'victoire');
  borne('mal assortir les paires coûte', -malD.v, 0.2, 5, 'victoire');
  const dominant = forces.filter(([, r]) => r.v > 1.0);
  exiger('aucun système n\'est bon partout (forcé partout : +1 V au plus)', !dominant.length, dominant.length ? dominant.map(([n, r]) => `${n} ${signe(r.v)} V`).join(' · ') : `le meilleur : ${forces.slice().sort((a, b) => b[1].v - a[1].v)[0].map((x, i) => (i ? signe(x.v) + ' V' : x)).join(' ')}`);
  exiger('le fit compte par degrés : le 2e système coûte moins que le pire', second.v > mal.v + 0.8 && second.v < 0.3, `2e : ${signe(second.v)} V · pire : ${signe(mal.v)} V`);
} else informer('non jugé', `${LIGUES} ligues sous le plancher de 6`);
/*
 * UNE UNITÉ INCOMPLÈTE NE SE JUGE PAS (1.0, J1-I). Un trio vide lisait
 * « Échec avant 2-1-2 · Mauvais fit » : le fit comptait chaque case vide
 * pour 0 et le choix de système prenait la première clé à égalité. Le fit
 * d'une unité incomplète est null, aucun système ne se choisit, et l'unité
 * n'a pas de nom avant d'être entière.
 */
{
  const vide = {};
  const t = ligue(9500)[0];
  const L = activeLineup(t);
  const deuxSurTrois = { ...L };
  const casesTrio1 = SLOTS.filter(s => s.group === 'F' && s.unit === 1 && !s.scratch);
  delete deuxSurTrois[casesTrio1[0].i];
  exiger('le fit d\'un trio vide est null', fitUnite(vide, 'F', 0, 'echec') === null, `${fitUnite(vide, 'F', 0, 'echec')}`);
  exiger('aucun système ne se choisit pour un trio vide', meilleureTactique(vide, 0) === 'hourra' && meilleurSystemeD(vide, 0) === 'hourra');
  exiger('un trio à deux sur trois n\'a ni fit ni nom', fitUnite(deuxSurTrois, 'F', 1, 'echec') === null && identiteUnite(deuxSurTrois, 'F', 1) === null);
  exiger('une ligne incomplète n\'a pas de chimie', fitDeLigne(deuxSurTrois, 1, { tac: 'echec', tacD: 'maison', sec: 60 }) === null
    && chimieLigne(deuxSurTrois, 1, { tac: 'echec', tacD: 'maison', sec: 60 }) === 0);
  exiger('un alignement complet garde son fit et son nom', Number.isFinite(fitUnite(L, 'F', 0, 'echec')) && !!identiteUnite(L, 'F', 0));
}

/*
 * LES AILES S'ASSORTISSENT (1.0, oct.). JP : *les stratégies donnent pas la
 * chance de swap AD et AG côté rôles*. Échanger l'ailier gauche et l'ailier
 * droit ne change pas le fit d'un système : ses rôles d'aile se jouent dans
 * le meilleur sens (`rolesDuSysteme`).
 */
{
  const t = ligue(9500)[0];
  const L = activeLineup(t);
  const asym = Object.keys(TACTIQUES).filter(k => TACTIQUES[k].slots && TACTIQUES[k].slots.AG !== TACTIQUES[k].slots.AD);
  const faux = [];
  for (let u = 0; u < 4; u++) {
    const ag = SLOTS.find(s => s.group === 'F' && s.unit === u && s.role === 'AG' && !s.scratch).i;
    const ad = SLOTS.find(s => s.group === 'F' && s.unit === u && s.role === 'AD' && !s.scratch).i;
    const M = { ...L, [ag]: L[ad], [ad]: L[ag] };
    for (const k of asym) if (fitUnite(L, 'F', u, k) !== fitUnite(M, 'F', u, k)) faux.push(`trio ${u + 1} en ${k} : ${fitUnite(L, 'F', u, k)} puis ${fitUnite(M, 'F', u, k)}`);
  }
  exiger(`échanger les ailiers ne change pas le fit (${asym.length} systèmes aux ailes différentes, 4 trios)`, !faux.length, faux.slice(0, 3).join(' · '));
}

/*
 * LES SYSTÈMES LISENT LES BADGES (V2.3). Une case demande un badge : le bon rend son palier, le second la moitié,
 * le mauvais rien (FIT_BASE). Un trio de trois Platine du bon badge joue son système à 100.
 */
{
  let platine = null, sansBadge = null, second = null;
  for (const f of SAISONS.slice(20, 50)) for (const p of shard(f).players) {
    if (p.p === 'G' || estD(p)) continue;
    registerHiddenRatings(p);
    const [b1, b2] = badgesDe(p);
    if (!platine && b1 && b1.palier === 4) platine = { p, role: b1.cle };
    if (!second && b2) second = { p, role: b2.cle, palier: b2.palier };
    if (!sansBadge && b1 && b1.cle !== 'sniper' && !(b2 && b2.cle === 'sniper')) sansBadge = p;
  }
  exiger('un Platine du bon badge rend 100 à sa case', fitDeCase(platine.p, platine.role) === 100, `${platine.p.n} (${platine.role})`);
  exiger('le second badge rend la moitié de son palier', fitDeCase(second.p, second.role) === FIT_BASE + FIT_PAR_PALIER * second.palier / 2, `${second.p.n} : ${fitDeCase(second.p, second.role)}`);
  exiger('le mauvais badge ne rend rien de plus que la base', fitDeCase(sansBadge, 'sniper') === FIT_BASE, `${sansBadge.n} au poste de sniper : ${FIT_BASE}`);
}

verdict('Les lignes à la HockeyArena');
