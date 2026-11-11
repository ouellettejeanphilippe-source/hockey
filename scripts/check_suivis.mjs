/*
 * CE QUI COURT SE SUIT (oct. 2026 ; V25 C1 : la promesse d'une histoire). JP : *j'ai pogné un « si x joueur fait x points
 * en x matchs », ça le confirme bon, mais aucun suivi de ça*. Une réponse d'histoire qui promet pour plus tard a un verdict à
 * sa fin, dont les chiffres se recomptent dans les feuilles. De vraies ligues de 32 vestiaires, ton club en Rogue :
 *   1. la promesse d'une histoire (js/greffes.js `promettre` : chaque option qui touche un joueur, `lui` ou `pari`) : elle
 *      s'engage pour sa durée (`team.suivis`) ; le lundi d'après son dernier match, son verdict arrive (`team.retours`), de
 *      la même voix, aux chiffres de ses feuilles (ses buts et ses tirs, ses passes, ses buts accordés) ;
 *   2. la promesse dont le joueur part (échangé, relâché) : le lendemain, elle tombe et ça se dit.
 * L'état d'une promesse relu chaque matin à sa maison (`suivisEnCours`) et l'objectif du proprio (`etatObjectif`) sont partis
 * avec le Bureau de l'ancien Rogue (V28, tranche 4), leurs trois vérifications aussi.
 * `GRAINES` : les ligues (83,85 par défaut).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, getPlayerKey, SLOTS
} from '../js/sim.js';
import '../js/greffes.js';   // V25 : les greffes du Rogue se branchent sur le moteur
import { HISTOIRES } from '../js/histoires.js';
import { SEMAINE } from '../js/util.js';
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
// Trois promesses : la disette (« Le reposer deux matchs », ses tirs et ses buts), l'agent (ses tirs et ses passes), le gardien battu (l'auxiliaire, ses arrêts).
const PROMESSES = [['leMuet', 'repos', 'F'], ['lAgent', 'donner', 'F'], ['leGardienBattu', 'auxiliaire', 'G']];
const premier = (you, g) => SLOTS.filter(sl => !sl.scratch && sl.group === g).map(sl => you.roster[sl.i]).find(Boolean);

console.log('\n  CE QUI COURT SE SUIT (oct. 2026)\n');
const t0 = Date.now();
let suivis = 0, engagees = 0, finis = 0, finisOk = 0, partis = 0, partisOk = 0;
const fautes = [], exemples = [];
const faute = t => { if (fautes.length < 10) fautes.push(t); };

for (const seed of GRAINES) {
  const base = saison(seed);
  jouerJusqua(base.L, Infinity);
  for (const [cle, choix, groupe] of PROMESSES) {
    const H = HISTOIRES[cle], o = H.options.find(x => x.cle === choix), p0 = premier(base.you, groupe);
    const J = 2 * SEMAINE, k = getPlayerKey(p0);
    const d = { jour: J, palier: `h:lundi:${J}`, sel: `suivi-${cle}`, moment: { famille: 'histoire', cle, choix, joueur: k, joueurs: [k] } };
    // 1. La promesse s'engage pour sa durée ; le verdict arrive un lundi, après le dernier match.
    suivis++;
    const r = saison(seed, [d]);
    const p = Object.values(r.you.roster).find(x => x && getPlayerKey(x) === k);
    let vu = false, fini = false, matchs0 = null;
    for (let j = J + 1; j <= r.L.calendrier.length && !fini; j++) {
      jouerJusqua(r.L, j);
      const x = (r.you.suivis || []).find(z => z.cle === cle);
      const R = (r.you.retours || []).find(z => z.cle === cle);
      if (x && !R) {
        if (!vu) { vu = true; matchs0 = x.matchs0; if (x.duree === o.duree && getPlayerKey(x.joueur) === k) engagees++; else faute(`${cle} : engagée pour ${x.duree} matchs sur ${x.joueur && x.joueur.n}, ${o.duree} dits`); }
      } else if (R) {
        fini = true; finis++;
        const f = r.you.journal.slice(matchs0, matchs0 + o.duree), n = recompte(p, f);
        const chiffres = x => (x.departs ? [x.accordes, x.departs] : o.lui.creation && !o.lui.lancers ? [x.passes, x.m] : [x.buts, x.tirs, x.m]);
        const apresDernier = r.you.journal[matchs0 + o.duree - 1];
        if (vu && f.length === o.duree && R.jour % SEMAINE === 0 && R.jour > apresDernier.jour && R.de === H.de && chiffres(n).every(c => R.texte.includes(String(c)))) finisOk++;
        else faute(`${cle} : le verdict (J${R.jour}, ${R.de}) dit « ${R.texte} », les feuilles ${JSON.stringify(n)} en ${f.length}`);
        if (exemples.length < 6) exemples.push(R.texte);
      } else if (vu) { faute(`${cle} J${j} : ni promesse ni verdict`); break; }
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
    if (Rp && Rp.parti && /n'est plus dans ton effectif/.test(Rp.texte) && !(q.you.suivis || []).some(s => s.cle === cle && !s.fait)) partisOk++;
    else faute(`${cle} : parti, la promesse ne tombe pas (${Rp ? Rp.texte : 'aucun verdict'})`);
  }
}

informer('exemples de verdicts', exemples.join(' · ') || 'aucun');
exiger('chaque promesse s\'engage pour sa durée, sur son joueur', suivis > 0 && engagees === suivis, `${engagees}/${suivis} promesses`);
exiger('chaque promesse finit par un verdict de sa voix, un lundi, aux chiffres des feuilles', finis === suivis && finisOk === finis, `${finisOk}/${suivis}`);
exiger('une promesse dont le joueur part tombe le lendemain, et ça se dit', partisOk === partis, `${partisOk}/${partis}`);
for (const f of fautes) informer('faute', f);
informer('durée', `${((Date.now() - t0) / 1000).toFixed(0)} s`);
verdict('Ce qui court se suit');
