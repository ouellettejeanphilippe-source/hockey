/*
 * CHAQUE EFFET SE VOIT (25 oct. 2026 ; JP : *0,4 pt, ça va fuck all faire* ; *recheck tous les effets*). Tout ce qui
 * touche ton club en Rogue — les réponses des dossiers (ce qui va au joueur nommé, leurs paris),
 * l'avant-match, les arcs, les retours des fils (la banque d'événements est vide, V22, phase 4 : seuls l'avant-match
 * se mesure aujourd'hui, le reste dès que la banque neuve y entre) — se mesure EN
 * PAIRES (CLAUDE.md), match par match, comme check_places : deux copies d'un même vrai club, les mêmes dés, une fois
 * sans l'effet, une fois avec, son moment posé. Un effet partagé (un paquet de réponses) se mesure une fois.
 *   1. il se voit dans la feuille d'un soir où il joue : ±2 tirs (un bord ou le rythme), ±0,3 but des deux clubs,
 *      ±0,5 punition, ±4 mises en échec, ±3 blessures par saison, ±3 de jambes ; sur un joueur nommé, à sa ligne :
 *      ±0,3 point, ±0,15 but ou ±1 tir (une récompense de toute la saison : quatre points sur sa durée). Les minutes (`F`, `D`) se recomptent ailleurs (check_dilemmes), l'argent aussi ;
 *   2. sa force reste sous la borne de sa rareté sur ses soirs (une commune ±1).
 * V21 : les pouvoirs du coach, le temps d'une période, se mesurent dans check_pouvoirs ; le personnel est parti.
 * `N` : matchs par club et par effet (200). `FILS` : processus (4). `IDS=d:,a:` quelques familles. Une vingtaine de
 * minutes : à la main.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, SLOTS, MOMENTS_SI, activeLineup, effetsDesJoueurs, getPlayerKey, depenserEnergie, AVANT_GROS } from '../js/sim.js';
import { DOSSIERS } from '../js/dossiers.js';
import { CHOIX_DES_FILS } from '../js/vie-gm.js';
import { ARCS } from '../js/arcs.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 200), FILS = Number(process.env.FILS ?? 4), ICI = fileURLToPath(import.meta.url);
const CANAUX = ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
const CJ = ['finition', 'lancers', 'creation', 'defense', 'blessure', 'arrets'];
const prend = (o, ks) => Object.fromEntries(ks.filter(k => o && k in o && typeof o[k] !== 'object' || (o && (k === 'F' || k === 'D') && Array.isArray(o[k]))).map(k => [k, o[k]]));
function items() {
  const out = [];
  for (const [d, D] of Object.entries(DOSSIERS)) for (const O of D.options) for (const [suf, x] of [['', O], ...(O.pari ? [['+', O.pari.gagne], ['-', O.pari.perd]] : [])]) {
    const e = prend(x, CANAUX); if (Object.keys(e).length || x.lui) out.push({ id: `d:${d}.${O.cle}${suf}`, nom: `${D.titre} : ${O.nom}`, rarete: 'commune', si: O.si || null, duree: x.duree, effet: e, joueur: x.lui || null });
  }
  const fam = (pre, src) => { for (const [k, M] of Object.entries(src)) for (const O of M.options || []) {
    const add = (suf, x, dur) => { const e = prend(x, CANAUX); if (Object.keys(e).length || x.lui) out.push({ id: `${pre}:${k}.${O.cle}${suf}`, nom: `${M.titre || k} : ${O.nom}`, rarete: 'commune', si: null, duree: dur ?? x.duree, effet: e, joueur: x.lui || null }); };
    add('', O); if (O.pari) { add('+', O.pari.gagne); add('-', O.pari.perd); } if (O.ensuite) add('>', O.ensuite);
  } };
  fam('g', AVANT_GROS);
  for (const [k, A] of Object.entries(ARCS)) (A.episodes || []).forEach((E, i) => { if (E.effet && Object.keys(E.effet).length && E.cible !== 'joueur') out.push({ id: `a:${k}.${i}`, nom: `${A.titre} (${i + 1})`, rarete: 'commune', si: null, duree: E.matchs, effet: prend(E.effet, CANAUX), contre: E.cible === 'contre' });
    else if (E.effet && Object.keys(E.effet).length) out.push({ id: `a:${k}.${i}`, nom: `${A.titre} (${i + 1})`, rarete: 'commune', si: null, duree: E.matchs, effet: {}, joueur: prend(E.effet, CJ) }); });
  for (const [k, F] of Object.entries(CHOIX_DES_FILS)) for (const O of F.options) if (O.suivi) for (const b of ['gagne', 'perd']) { const B = O.suivi[b]; if (B) out.push({ id: `f:${k}.${O.cle}.${b}`, nom: `${F.titre} : ${O.nom} (${b})`, rarete: 'commune', si: null, duree: B.duree, effet: {}, joueur: prend(B.effets[0], CJ) }); }
  return out;
}
const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function match(toi, adv, graine, visiteur) {
  for (const t of [toi, adv]) { for (const sl of SLOTS) { const p = t.roster[sl.i]; if (p) p.energie = 100; } if (t.injured) t.injured.clear(); t.jourCourant = 0; }
  grainerHasard(graine);
  const f = feuilleVierge();
  const r = visiteur ? playGame(adv, toi, 1, false, false, f) : playGame(toi, adv, 1, false, false, f);
  depenserEnergie(toi, activeLineup(toi));
  const moi = visiteur ? 'B' : 'A', eux = visiteur ? 'A' : 'B';
  const somme = a => (a || []).reduce((x, y) => x + y, 0);
  const pats = Object.values(toi.roster).filter(p => p && p.p !== 'G');
  const lui = q => q && getPlayerKey(q) === toi._nomme;
  return { v: r.winner === toi ? 1 : 0, gf: visiteur ? r.gfB : r.gfA, ga: visiteur ? r.gfA : r.gfB,
    tp: somme(f.tirs && f.tirs[moi]), tc: somme(f.tirs && f.tirs[eux]), pun: (f.punitions || []).filter(p => p.cote === moi).length,
    coups: (f.coups || {})[moi] || 0, bl: (f.blessures || []).filter(b => b.cote === moi).length,
    pj: toi._nomme ? (f.buts || []).filter(b => b.cote === moi && [b.marqueur, ...(b.passeurs || [])].some(lui)).length : 0,
    bj: toi._nomme ? (f.buts || []).filter(b => b.cote === moi && lui(b.marqueur)).length : 0,
    tj: toi._nomme ? (f.lancers || []).filter(l => lui(l.tireur)).length : 0,
    jambes: pats.reduce((a, p) => a + (p.energie ?? 100), 0) / (pats.length || 1) };
}
function mesurer(ids, n) {
  const tous = new Map(items().map(x => [x.id, x])), out = {};
  for (const id of ids) {
    const C = tous.get(id); const m = out[id] = {};
    for (const [lab, s, t] of TEMOINS) {
      const un = equipeReelle(s, t);
      const moment = C.si && C.si !== 'domicile' && C.si !== 'visiteur' ? C.si : null;
      const trois = lire => {
        const club = (nom, role) => { grainerHasard(`eff:${lab}:${role}`); return equipe(nom, t, un, s); };
        const sans = club('Sans', 'toi'), avec = club('Avec', 'toi'), adv = club('Eux', 'eux');
        avec.effets = Object.keys(C.effet).length ? [{ debut: 0, fin: 1e9, source: 'decision', nom: C.nom, si: C.si, ...C.effet }] : [];
        if (C.joueur && Object.keys(C.joueur).length) {
          const ferme = (C.joueur.defense ?? 1) < 1 || 'arrets' in C.joueur, lu = activeLineup(avec);
          const sl = 'arrets' in C.joueur ? SLOTS.find(x => x.group === 'G') : SLOTS.find(x => !x.scratch && x.unit === 0 && (ferme ? x.group === 'D' : x.group === 'F' && x.role === 'C'));
          const p = lu[sl.i];
          avec.effetsCibles = [{ debut: 0, fin: 1e9, source: 'decision', nom: C.nom, joueur: p, ...C.joueur }];
          effetsDesJoueurs(avec, 0);
          sans._nomme = avec._nomme = getPlayerKey(p);
        }
        for (const T of [sans, avec]) T._lireMoment = lire;
        return { sans, avec, adv };
      };
      for (let i = 0; i < n; i++) {
        const vis = C.si === 'visiteur' ? true : C.si === 'domicile' ? false : i % 2 === 1;
        const g = `eff:${lab}:${id}:${i}`;
        const P = trois(moment), a = match(P.sans, P.adv, g, vis);
        const P2 = trois(moment), b = match(P2.avec, P2.adv, g, vis);
        for (const k of Object.keys(a)) m[k] = (m[k] || 0) + (b[k] - a[k]);
        m.n = (m.n || 0) + 1;
      }
    }
  }
  return out;
}
if (process.env.PART) { process.stdout.write(JSON.stringify(mesurer(process.env.PART.split(','), Number(process.env.NPART)))); process.exit(0); }
const sig = x => JSON.stringify([x.effet, x.joueur || null, x.si]);
const vusSig = new Map();
for (const x of items()) if (!vusSig.has(sig(x))) vusSig.set(sig(x), x.id);
let toutes = [...vusSig.values()];
if (process.env.IDS) toutes = toutes.filter(id => process.env.IDS.split(',').some(c => id.startsWith(c)));
const lancer = l => new Promise((ok, ko) => { const p = spawn(process.execPath, [ICI], { env: { ...process.env, PART: l.join(','), NPART: String(N) } }); let t = ''; p.stdout.on('data', x => { t += x; }); p.stderr.on('data', x => process.stderr.write(x)); p.on('close', c => (c === 0 ? ok(JSON.parse(t)) : ko(new Error('fils')))); });
const lots = Array.from({ length: FILS }, (_, i) => toutes.filter((_, j) => j % FILS === i)).filter(l => l.length);
const res = Object.assign({}, ...(await Promise.all(lots.map(lancer))));
const meta = Object.fromEntries(items().map(x => [x.id, x]));
const BORNE_V = { commune: 1, peu: 1.5, rare: 2.5, legendaire: 4 };
const f1 = x => (x >= 0 ? '+' : '') + x.toFixed(1).replace('.', ',');
const f2 = x => (x >= 0 ? '+' : '') + x.toFixed(2).replace('.', ',');
const invisibles = [], tropForts = [];
let mesures = 0;
for (const id of toutes) {
  const C = meta[id], m = res[id], x = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v / m.n]));
  // Les minutes seules, ou rien que le moteur lise ce soir (l'argent) : elles se prouvent ailleurs.
  const canaux = Object.keys(C.effet || {}).filter(k => k !== 'F' && k !== 'D');
  if (!canaux.length && !(C.joueur && Object.keys(C.joueur).length)) continue;
  mesures++;
  // Un arc contre un club ne joue que ses matchs contre lui : trois d'une saison, à peu près.
  const soirs = C.contre ? 3 : (C.duree || 5) * (C.si ? MOMENTS_SI[C.si].parSaison / 82 : 1);
  const R = Math.max(Math.abs(x.tp) / 2, Math.abs(x.tc) / 2, Math.abs(x.tp + x.tc) / 2, (Math.abs(x.gf) + Math.abs(x.ga)) / 0.3, Math.abs(x.pun) / 0.5,
    Math.abs(x.coups) / 4, Math.abs(x.bl * 82) / 3, Math.abs(x.jambes) / 3, Math.abs(x.pj) / 0.3, Math.abs(x.bj) / 0.15, Math.abs(x.tj) / 1,
    // Une récompense de toute une saison (un pari gagné, un fil relevé) se voit sur sa durée : quatre points de plus à sa ligne.
    soirs >= 40 ? (Math.abs(x.pj) * soirs) / 4 : 0);
  const ligne = `${C.nom} : ${soirs.toFixed(1).replace('.', ',')} soirs · par soir : tirs ${f1(x.tp)} / ${f1(x.tc)} · buts ${f2(x.gf)} / ${f2(x.ga)} · punitions ${f2(x.pun)} · mises en échec ${f1(x.coups)} · jambes ${f1(x.jambes)}${x.pj || x.tj ? ` · le joueur ${f2(x.pj)} pt, ${f1(x.tj)} tir` : ''}`;
  if (R < 1) { invisibles.push(C.nom); informer(`✗ ${id}`, ligne); }
  const v = x.v * soirs, lim = BORNE_V[C.rarete || 'commune'];
  // Une récompense de fil (un défi relevé, un pari gagné) dure la saison : c'est la récompense (CLAUDE.md, la run qui casse le jeu).
  if (Math.abs(v) > lim && !id.startsWith('f:')) tropForts.push(`${C.nom} ${f1(v)} V (borne ${String(lim).replace('.', ',')})`);
}
exiger('chaque effet se voit dans la feuille d\'un soir où il joue', !invisibles.length, invisibles.length ? `${invisibles.length} sur ${mesures} : ${invisibles.slice(0, 12).join(' · ')}` : `${mesures} effets`);
exiger('chaque effet reste sous la borne de sa rareté', !tropForts.length, tropForts.join(' · ') || 'tous');
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ res, meta }));
verdict('Chaque effet se voit');
