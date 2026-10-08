/*
 * LES FILS DE LA SAISON (V3.2) — chaque fil cite des feuilles réelles ; aucun
 * fil inventé. Une ligue de 32 vrais vestiaires joue sa saison ; chaque club,
 * tour à tour, est « ton club ». Ce qu'on exige :
 *   1. le même calendrier redonne les mêmes fils, au caractère près ;
 *   2. aucun fil ne lit l'avenir : le journal arrêté à la journée d rend
 *      exactement le début du journal complet ;
 *   3. chaque preuve est un match de ton club où le joueur était habillé ;
 *   4. chaque chiffre dit se RECOMPTE à partir des seules preuves, et la
 *      phrase dit ce chiffre-là ;
 *   5. le jeu voit des histoires : au moins cinq sortes sur la ligue.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua } from '../js/sim.js';
import { filsDeSaison, FILS } from '../js/recit.js';
import { messageDuFil } from '../js/vie-gm.js';
import { primesDesFils, PRIMES_DES_FILS, PRIME_FILS_MAX, jetonsDe, JETONS } from '../js/rogue.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const RECRUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'recrues.json'), 'utf8'));
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => {
  const rk = new Set(RECRUES[s] || []);
  const p = un.flat().map(x => ({ ...x, ...(rk.has(x.id) ? { rk: 1 } : {}) }));
  p.forEach(registerHiddenRatings);
  return createTeam(nom, tag, autoRoster(p), { season: s });
};
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
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}

console.log('\n  LES FILS DE LA SAISON\n');

const teams = ligue(Number(process.env.GRAINE || 82));
const L = creerLigue(teams, 82, { graine: 'fils' });
jouerJusqua(L, Infinity);
const cal = L.calendrier;

const sortes = {};
let fautes = [], voixFausses = [], primesFausses = [], primes = [], voix = new Set(), arcs = 0, prefixe = 0, deterministe = 0, unes = 0, unesFausses = 0;
const exemples = new Map();
const faute = (a, quoi) => { if (fautes.length < 12) fautes.push(`${a.sorte} « ${a.texte} » : ${quoi}`); else fautes.push(''); };

for (const you of teams) {
  const tout = filsDeSaison(cal, you);
  const encore = filsDeSaison(cal, you);
  const lire = r => r.journal.map(e => `${e.j}:${e.fils.map(a => a.texte).join('|')}`).join('\n');
  if (lire(tout) === lire(encore)) deterministe++;
  // 2. L'avenir : à mi-saison, le journal est le début du journal complet.
  const mi = Math.floor(cal.length / 2);
  const moitie = filsDeSaison(cal, you, mi);
  if (lire(moitie) === lire({ journal: tout.journal.filter(e => e.j < mi) })) prefixe++;
  // La une d'un soir (le premier fil de ce soir-là, js/saison.js) est son plus lourd.
  for (const e of tout.journal) {
    unes++;
    if (e.fils.some(a => a.poids > e.fils[0].poids)) unesFausses++;
  }
  // LA PRIME D'UN FIL (V3.6, Rogue) : seulement le soir où un fil naît et fait la une, plafonnée par saison.
  const pr = primesDesFils(cal, you);
  primes.push(pr.total);
  for (const [j, x] of pr.parJour) {
    const e = tout.journal.find(y => y.j === j), a = e && e.fils[0];
    if (!a || !a.neuf || !PRIMES_DES_FILS[a.sorte] || x.jetons > PRIMES_DES_FILS[a.sorte].jetons) primesFausses.push(`J${j + 1} ${a ? a.sorte : '?'}`);
  }
  if (pr.total > PRIME_FILS_MAX || [...pr.parJour.values()].reduce((s, x) => s + x.jetons, 0) !== pr.total) primesFausses.push(`total ${pr.total}`);
  for (const e of tout.journal) for (const a of e.fils) {
    arcs++;
    sortes[a.sorte] = (sortes[a.sorte] || 0) + 1;
    if (!exemples.has(a.sorte)) exemples.set(a.sorte, a.texte);
    const p = a.joueur;
    // La voix du fil (js/vie-gm.js) : le fait au caractère près, une opinion sans chiffre.
    const msg = messageDuFil(a);
    voix.add(`${a.sorte}${a.fini ? ' (fin)' : ''} : ${msg.de && (msg.de.nom === p.n ? 'le joueur' : msg.de.nom)}`);
    if (!msg.de || !msg.de.nom || msg.sujet !== a.texte || /\d|\{/.test(msg.mot)) voixFausses.push(`${a.sorte} « ${msg.mot} »`);
    // 3. Chaque preuve : un match de ton club, d'avant ou de ce soir, le joueur habillé.
    const mats = a.preuves.map(({ j, k }) => cal[j] && cal[j][k]);
    if (mats.some(m => !m || !m.feuille || (m.A !== you && m.B !== you))) { faute(a, 'une preuve n\'est pas un match de ton club'); continue; }
    if (a.preuves.some(r => r.j > a.jour)) { faute(a, 'une preuve vient de l\'avenir'); continue; }
    const cote = m => (m.A === you ? 'A' : 'B');
    if (mats.some(m => !(m.feuille.alignes[cote(m)] || []).includes(p))) { faute(a, 'le joueur n\'était pas habillé'); continue; }
    const buts = m => m.feuille.buts.filter(b => b.cote === cote(m) && b.marqueur === p).length;
    const passes = m => m.feuille.buts.filter(b => b.cote === cote(m) && (b.passeurs || []).includes(p)).length;
    const pts = m => buts(m) + passes(m);
    const somme = f => mats.reduce((s, m) => s + f(m), 0);
    const dit = (...n) => n.every(x => new RegExp(`(^|\\D)${x}(\\D|$)`).test(a.texte));
    // Ses matchs habillés de ton club, dans l'ordre : pour les suites.
    const siens = [];
    for (let j = 0; j <= a.jour; j++) {
      const k = (cal[j] || []).findIndex(m => m.A === you || m.B === you);
      if (k >= 0 && (cal[j][k].feuille.alignes[cote(cal[j][k])] || []).includes(p)) siens.push(`${j}|${k}`);
    }
    const suite = () => {
      const cles = a.preuves.map(r => `${r.j}|${r.k}`);
      const i = siens.indexOf(cles[0]);
      return i >= 0 && cles.every((c, n) => siens[i + n] === c);
    };
    // 4. Recompter.
    if (a.sorte === 'course') {
      const v = a.g != null ? somme(buts) : somme(pts);
      const ok = mats.length === a.n && v === (a.g ?? a.pts) && a.rythme === Math.round(v / a.n * 82) && dit(v, a.n, a.rythme)
        && a.rythme >= (a.g != null ? FILS.course.buts : FILS.course.points) && a.n >= FILS.course.matchs && siens.length === a.n;
      if (!ok) faute(a, `recompté ${v} en ${mats.length}`);
    } else if (a.sorte === 'jalon') {
      const f = a.unite === 'buts' ? buts : pts, v = somme(f), avant = v - f(mats[mats.length - 1]);
      if (!(v >= a.seuil && avant < a.seuil && mats.length === a.n && siens.length === a.n && dit(a.seuil, a.n))) faute(a, `recompté ${avant} → ${v} en ${mats.length}`);
    } else if (a.sorte === 'sequence') {
      const serie = a.fini ? mats.slice(0, -1) : mats;
      const ok = serie.length === a.n && serie.every(m => pts(m) > 0) && (!a.fini || pts(mats[mats.length - 1]) === 0) && suite() && dit(a.n)
        && a.n >= (a.fini ? FILS.sequence.fin : FILS.sequence.min);
      if (!ok) faute(a, 'la séquence ne se recompte pas');
    } else if (a.sorte === 'disette') {
      const vide = a.fini ? mats.slice(0, -1) : mats;
      const ok = vide.length === a.n && vide.every(m => buts(m) === 0) && (!a.fini || buts(mats[mats.length - 1]) > 0) && suite() && dit(a.n)
        && a.n >= FILS.disette.min && (p.g || 0) / p.gp >= FILS.disette.vrai;
      if (!ok) faute(a, 'la disette ne se recompte pas');
    } else if (a.sorte === 'feu') {
      const v = somme(buts);
      const ok = v === a.g && mats.length === a.n && siens.length === a.n && v / a.n >= FILS.feu.facteur * Math.max((p.g || 0) / (p.gp || 1), FILS.feu.plancher)
        && dit(a.g, a.n, p.g || 0, p.gp || 0);
      if (!ok) faute(a, `recompté ${v} en ${mats.length}`);
    } else if (a.sorte === 'duo') {
      const avec = mats.reduce((s, m) => s + m.feuille.buts.filter(b => b.cote === cote(m) && b.marqueur === p && (b.passeurs || []).includes(a.passeur)).length, 0);
      const tous = siens.reduce((s, c) => { const [j, k] = c.split('|').map(Number); return s + buts(cal[j][k]); }, 0);
      if (!(avec === a.n && tous === a.g && dit(a.n, a.g) && a.n / a.g >= FILS.duo.part)) faute(a, `recompté ${avec} de ${tous}`);
    } else if (a.sorte === 'recrue') {
      const v = somme(pts);
      if (!(p.rk && v === a.pts && mats.length === a.n && siens.length === a.n && dit(a.pts, a.n))) faute(a, `recompté ${v} en ${mats.length}`);
    } else if (a.sorte === 'retour') {
      const { j: jr } = a.preuves[0];
      const avant = [];
      for (let j = 0; j < jr; j++) { const k = (cal[j] || []).findIndex(m => m.A === you || m.B === you); if (k >= 0) avant.push((cal[j][k].feuille.alignes[cote(cal[j][k])] || []).includes(p)); }
      const dernier = avant.lastIndexOf(true);
      const ok = dernier >= 0 && avant.length - 1 - dernier === a.n && a.n >= FILS.retour.absence && pts(mats[0]) > 0 && dit(a.n);
      if (!ok) faute(a, `absent ${avant.length - 1 - dernier} matchs`);
    } else faute(a, 'sorte inconnue');
  }
}

for (const [s, t] of exemples) informer(`exemple · ${s}`, t);
informer('fils qui bougent, par sorte (32 clubs, une saison)', Object.entries(sortes).map(([s, n]) => `${s} ${n}`).join(' · '));
informer('par club et par saison', `${(arcs / teams.length).toFixed(1)} fils qui bougent`);
exiger('le même calendrier redonne les mêmes fils', deterministe === teams.length, `${deterministe} / ${teams.length}`);
exiger('aucun fil ne lit l\'avenir (le journal à mi-saison est le début du journal complet)', prefixe === teams.length, `${prefixe} / ${teams.length}`);
exiger('la une d\'un soir est son fil le plus lourd', unesFausses === 0, `${unes - unesFausses} / ${unes}`);
exiger('chaque fil cite des feuilles réelles et se recompte sur elles', fautes.length === 0, fautes.length ? fautes.filter(Boolean).join(' ; ') : `${arcs} fils`);
informer('qui le dit', [...voix].sort().join(' · '));
exiger('chaque fil a sa voix, dit son fait au caractère près, et la voix ne dit aucun chiffre', voixFausses.length === 0, voixFausses.slice(0, 5).join(' ; ') || `${arcs} messages`);
informer('la prime des fils, par club et par saison (Rogue)', `${(primes.reduce((s, x) => s + x, 0) / primes.length).toFixed(1)} 🪙 en moyenne · ${primes.filter(x => x >= PRIME_FILS_MAX).length} club(s) au plafond de ${PRIME_FILS_MAX}`);
exiger('une prime ne se verse qu\'au soir où un fil naît et fait la une, sous le plafond de la saison', primesFausses.length === 0, primesFausses.slice(0, 5).join(' ; ') || `${primes.length} clubs`);
exiger('les jetons comptent la prime', jetonsDe({ primes: 15 }, 0, 40, JETONS) === 55, String(jetonsDe({ primes: 15 }, 0, 40, JETONS)));
exiger('le jeu voit des histoires : au moins cinq sortes sur la ligue', Object.keys(sortes).length >= 5, Object.keys(sortes).join(', '));
verdict();
