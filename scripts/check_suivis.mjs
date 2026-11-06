/*
 * CE QUI COURT SE SUIT (oct. 2026 ; V25 C1 : la promesse d'une histoire). JP : *j'ai pogné un « si x joueur fait x points
 * en x matchs », ça le confirme bon, mais aucun suivi de ça*. Un choix du Rogue qui promet pour plus tard a un état lisible
 * chaque matin de sa durée et un verdict à sa fin, dont les chiffres se recomptent dans les feuilles. De vraies ligues de
 * 32 vestiaires, ton club en Rogue :
 *   1. la promesse d'une histoire (js/greffes.js `promettre` : chaque option qui touche un joueur, `lui` ou `pari`) : chaque
 *      matin de sa durée, `suivisEnCours` la montre, avec ses matchs joués et sa mesure (ses buts et ses tirs, ses passes,
 *      ses buts accordés et son efficacité) recomptés dans les feuilles ; le lundi d'après son dernier match, elle n'y est
 *      plus et son verdict arrive, de la même voix, aux mêmes chiffres, contre ses dix matchs d'avant ;
 *   2. la promesse dont le joueur part (échangé, relâché) : le lendemain, elle tombe et ça se dit ;
 *   3. l'objectif du proprio (`etatObjectif`) : son chiffre et son meneur se recomptent à chaque match, il finit au
 *      20e match (ou dès qu'il est acquis) ; celui qui nomme un joueur parti se lève, ni réussi ni raté.
 * `GRAINES` : les ligues (83,85 par défaut).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, getPlayerKey, SLOTS, OBJECTIFS, etatObjectif, joueurDeLObjectif, MATCHS_OBJECTIF
} from '../js/sim.js';
import { suivisEnCours, lignePromesse } from '../js/greffes.js';
import { HISTOIRES } from '../js/histoires.js';
import { SEMAINE } from '../js/inventaire.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const RECRUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'recrues.json'), 'utf8'));
const GRAINES = String(process.env.GRAINES || '83,85').split(',').map(Number);
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
function ligue(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const sh = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    const rk = new Set(RECRUES[sh.season] || []);
    const p = un.flat().map(q => ({ ...q, ...(rk.has(q.id) ? { rk: 1 } : {}) }));
    p.forEach(registerHiddenRatings);
    out.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(p), { season: sh.season }));
  }
  return out;
}
const saison = (seed, decisions = []) => {
  const teams = ligue(seed);
  teams[0].isPlayer = true;
  return { L: creerLigue(teams, 82, { graine: `suivis-${seed}`, decisions, courbe: true }), you: teams[0] };
};
const tes = (L, you) => L.calendrier.flatMap((jour, j) => jour.filter(m => m.joue && (m.A === you || m.B === you)).map(m => ({ j, m })));
/* La mesure d'une promesse, recomptée à la main dans les entrées du journal du club : ses buts et ses tirs (habillé), ses passes, ses buts accordés et ses tirs reçus (gardien). */
function recompte(p, entrees) {
  const out = { m: 0, buts: 0, tirs: 0, passes: 0, departs: 0, accordes: 0, lancers: 0 };
  for (const e of entrees) {
    const f = e.feuille, cote = (f.alignes.A || []).includes(p) ? 'A' : (f.alignes.B || []).includes(p) ? 'B' : null;
    if (cote) { out.m++; for (const b of f.buts) if (b.cote === cote && !b.fusillade) { if (b.marqueur === p) out.buts++; else if ((b.passeurs || []).includes(p)) out.passes++; } out.tirs += (f.lancers || []).filter(l => l.tireur === p).length; }
    if (e.gardien === p) { out.departs++; out.accordes += e.ga || 0; out.lancers += (f.lancers || []).filter(l => l.gardien === p).length; }
  }
  return out;
}
const meme = (a, b) => ['m', 'buts', 'tirs', 'passes', 'departs', 'accordes', 'lancers'].every(k => a[k] === b[k]);
// Trois promesses : la disette (« Le reposer deux matchs », ses tirs et ses buts), l'agent (ses tirs et ses passes), le gardien battu (l'auxiliaire, ses arrêts).
const PROMESSES = [['leMuet', 'repos', 'F'], ['lAgent', 'donner', 'F'], ['leGardienBattu', 'auxiliaire', 'G']];
const premier = (you, g) => SLOTS.filter(sl => !sl.scratch && sl.group === g).map(sl => you.roster[sl.i]).find(Boolean);

console.log('\n  CE QUI COURT SE SUIT (oct. 2026)\n');
const t0 = Date.now();
let suivis = 0, matins = 0, matinsOk = 0, finis = 0, finisOk = 0, partis = 0, partisOk = 0, objectifs = 0, objOk = 0, leves = 0, levesOk = 0;
const fautes = [], exemples = [];
const faute = t => { if (fautes.length < 10) fautes.push(t); };

for (const seed of GRAINES) {
  const base = saison(seed);
  jouerJusqua(base.L, Infinity);
  for (const [cle, choix, groupe] of PROMESSES) {
    const H = HISTOIRES[cle], o = H.options.find(x => x.cle === choix), p0 = premier(base.you, groupe);
    const J = 2 * SEMAINE, k = getPlayerKey(p0);
    const d = { jour: J, palier: `h:lundi:${J}`, sel: `suivi-${cle}`, moment: { famille: 'histoire', cle, choix, joueur: k, joueurs: [k] } };
    // 1. Matin par matin : l'état se lit, et se recompte ; le verdict arrive un lundi, après le dernier match.
    suivis++;
    const r = saison(seed, [d]);
    const p = Object.values(r.you.roster).find(x => x && getPlayerKey(x) === k);
    let vu = false, fini = false, matchs0 = null;
    for (let j = J + 1; j <= r.L.calendrier.length && !fini; j++) {
      jouerJusqua(r.L, j);
      const x = suivisEnCours(r.you).find(s => s.cle === cle);
      const R = (r.you.retours || []).find(z => z.cle === cle);
      if (x) {
        vu = true; matins++; matchs0 = x.matchs0;
        const f = r.you.journal.slice(x.matchs0, x.matchs0 + o.duree), n = recompte(p, f);
        if (x.joues === f.length && meme(x.n, n) && !R && x.duree === o.duree) matinsOk++; else faute(`${cle} J${j} : l'état dit ${JSON.stringify(x.n)} en ${x.joues}, les feuilles ${JSON.stringify(n)} en ${f.length}`);
        if (exemples.length < 3 && x.joues === 3) exemples.push(lignePromesse(x));
      } else if (R) {
        fini = true; finis++;
        const f = r.you.journal.slice(matchs0, matchs0 + o.duree), n = recompte(p, f);
        const chiffres = x => (x.departs ? [x.accordes, x.departs] : o.lui.creation && !o.lui.lancers ? [x.passes, x.m] : [x.buts, x.tirs, x.m]);
        const apresDernier = r.you.journal[matchs0 + o.duree - 1];
        if (vu && f.length === o.duree && R.jour % SEMAINE === 0 && R.jour > apresDernier.jour && R.de === H.de && chiffres(n).every(c => R.texte.includes(String(c)))) finisOk++;
        else faute(`${cle} : le verdict (J${R.jour}, ${R.de}) dit « ${R.texte} », les feuilles ${JSON.stringify(n)} en ${f.length}`);
        if (exemples.length < 6) exemples.push(R.texte);
      } else if (vu) { faute(`${cle} J${j} : ni état ni verdict`); break; }
    }
    if (!fini) faute(`${cle} : aucun verdict à la fin`);
    // 2. Le joueur part au 3e match de la promesse : elle tombe le lendemain.
    partis++;
    const q = saison(seed, [d]);
    let m3 = null;
    for (let j = J + 1; j <= q.L.calendrier.length; j++) { jouerJusqua(q.L, j); if (tes(q.L, q.you).filter(m => m.j >= J).length >= 3) { m3 = j; break; } }
    const slot = Object.entries(q.you.roster).find(([, x]) => x && getPlayerKey(x) === k);
    if (!m3 || !slot) { faute(`${cle} : impossible de le faire partir`); continue; }
    delete q.you.roster[slot[0]];
    jouerJusqua(q.L, m3 + 1);
    const Rp = (q.you.retours || []).find(z => z.cle === cle);
    if (Rp && Rp.parti && /n'est plus dans ton effectif/.test(Rp.texte) && !suivisEnCours(q.you).some(s => s.cle === cle)) partisOk++;
    else faute(`${cle} : parti, la promesse ne tombe pas (${Rp ? Rp.texte : 'aucun verdict'})`);
  }
  // 3. L'objectif du proprio, au jour 0, sur tes 20 premiers matchs.
  const miens = tes(base.L, base.you);
  for (const k of Object.keys(OBJECTIFS)) {
    const quoi = joueurDeLObjectif(k, base.you);
    if (OBJECTIFS[k].joueur && !quoi) continue;
    objectifs++;
    let ok = true, fin = null;
    for (let i = 1; i <= MATCHS_OBJECTIF; i++) {
      const ms = miens.slice(0, i).map(({ m }) => { const c = m.A === base.you ? 'A' : 'B', pour = c === 'A' ? m.gfA : m.gfB, contre = c === 'A' ? m.gfB : m.gfA; return { v: pour > contre, pour, contre, buts: m.feuille.buts.filter(b => b.cote === c) }; });
      const e = etatObjectif(k, ms, quoi, base.you);
      const pts = new Map();
      for (const x of ms) for (const b of x.buts) for (const p of [b.marqueur, ...(b.passeurs || [])]) if (p) pts.set(p, (pts.get(p) || 0) + 1);
      if (e.joues !== i) ok = false;
      if (k === 'vedette' && (e.val !== Math.max(0, ...pts.values()) || (e.meneur && pts.get(e.meneur) !== e.val))) ok = false;
      if (k === 'contrat' && e.val !== [...pts].filter(([p]) => getPlayerKey(p) === quoi.joueur).reduce((s, [, v]) => s + v, 0)) ok = false;
      if (e.fini && fin === null) fin = i;
    }
    if (ok && fin !== null && fin <= MATCHS_OBJECTIF) objOk++; else faute(`objectif ${k} : chiffre ou fin faux (fin au match ${fin})`);
    // Le gros contrat parti : l'objectif se lève.
    if (OBJECTIFS[k].joueur) {
      leves++;
      const sans = { roster: Object.fromEntries(Object.entries(base.you.roster).filter(([, p]) => !p || getPlayerKey(p) !== quoi.joueur)) };
      const e = etatObjectif(k, [], quoi, sans);
      if (e && e.parti && e.fini && !e.reussi && !e.rate) levesOk++; else faute(`objectif ${k} : son joueur parti, il ne se lève pas`);
    }
  }
}

informer('exemples d\'états et de verdicts', exemples.join(' · ') || 'aucun');
exiger('chaque promesse a un état chaque matin, recompté dans les feuilles', matins > 0 && matinsOk === matins, `${matinsOk}/${matins} matins, ${suivis} promesses`);
exiger('chaque promesse finit par un verdict de sa voix, un lundi, aux chiffres des feuilles', finis === suivis && finisOk === finis, `${finisOk}/${suivis}`);
exiger('une promesse dont le joueur part tombe le lendemain, et ça se dit', partisOk === partis, `${partisOk}/${partis}`);
exiger('l\'objectif du proprio se recompte à chaque match et finit', objectifs > 0 && objOk === objectifs, `${objOk}/${objectifs}`);
exiger('l\'objectif d\'un joueur parti se lève', leves > 0 && levesOk === leves, `${levesOk}/${leves}`);
for (const f of fautes) informer('faute', f);
informer('durée', `${((Date.now() - t0) / 1000).toFixed(0)} s`);
verdict('Ce qui court se suit');
