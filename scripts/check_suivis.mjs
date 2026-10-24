/*
 * CE QUI COURT SE SUIT (oct. 2026). JP : *j'ai pogné un « si x joueur fait x points en x matchs », ça le confirme bon,
 * mais aucun suivi de ça*. Un choix du Rogue qui promet pour plus tard a un état lisible chaque matin de sa durée et un
 * verdict à sa fin, dont les chiffres se recomptent dans les feuilles. De vraies ligues de 32 vestiaires, ton club en Rogue :
 *   1. le fil suivi (js/vie-gm.js `CHOIX_DES_FILS`) : chaque matin de sa durée, `suivisEnCours` le montre, avec ses
 *      matchs joués et son chiffre recomptés dans les feuilles ; le matin qui suit son dernier match, il n'y est plus et
 *      son retour arrive, au même chiffre ;
 *   2. le fil dont le joueur part (échangé, relâché) : le lendemain, la promesse tombe et ça se dit, sans effet ;
 *   3. l'objectif du proprio (`etatObjectif`) : son chiffre et son meneur se recomptent à chaque match, il finit au
 *      20e match (ou dès qu'il est acquis) ; celui qui nomme un joueur parti se lève, ni réussi ni raté.
 * `GRAINES` : les ligues (83,85 par défaut).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, getPlayerKey, suivisEnCours,
  OBJECTIFS, etatObjectif, joueurDeLObjectif, MATCHS_OBJECTIF } from '../js/sim.js';
import { filsDeSaison } from '../js/recit.js';
import { CHOIX_DES_FILS, motDuSuiviEnCours } from '../js/vie-gm.js';
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
/* Le chiffre d'un suivi, recompté à la main dans ses feuilles. */
function recompte(mesure, p, passeur, feuilles) {
  let n = 0;
  for (const f of feuilles) for (const b of f.buts || []) {
    const passe = (b.passeurs || []).includes(p);
    if (mesure === 'buts' ? b.marqueur === p : mesure === 'points' ? b.marqueur === p || passe : b.marqueur === p && passeur && (b.passeurs || []).includes(passeur)) n++;
  }
  return n;
}

console.log('\n  CE QUI COURT SE SUIT (oct. 2026)\n');
const t0 = Date.now();
let suivis = 0, matins = 0, matinsOk = 0, finis = 0, finisOk = 0, partis = 0, partisOk = 0, objectifs = 0, objOk = 0, leves = 0, levesOk = 0;
const fautes = [], exemples = [];
const faute = t => { if (fautes.length < 10) fautes.push(t); };

for (const seed of GRAINES) {
  const base = saison(seed);
  jouerJusqua(base.L, Infinity);
  const fils = filsDeSaison(base.L.calendrier, base.you);
  for (const sorte of Object.keys(CHOIX_DES_FILS)) {
    const e = fils.journal.find(x => x.fils.some(a => a.sorte === sorte && !a.fini));
    const o = CHOIX_DES_FILS[sorte].options.find(x => x.suivi && !x.monte);
    if (!e || !o) continue;
    const a = e.fils.find(x => x.sorte === sorte && !x.fini);
    const J = e.j + 1, cle = getPlayerKey(a.joueur);
    const d = { jour: J, palier: `fil:${sorte}`, sel: `suivi-${sorte}`, moment: { famille: 'fil', cle: sorte, choix: o.cle, joueur: cle, joueurs: [cle], ...(a.passeur ? { passeur: getPlayerKey(a.passeur) } : {}) } };
    // 1. Matin par matin : l'état se lit, et se recompte.
    suivis++;
    const r = saison(seed, [d]);
    let vu = false, fini = false;
    for (let j = J + 1; j <= r.L.calendrier.length && !fini; j++) {
      jouerJusqua(r.L, j);
      const x = suivisEnCours(r.you).find(s => s.cle === sorte);
      const miens = tes(r.L, r.you).filter(m => m.j >= J);
      const R = (r.you.retours || []).find(z => z.cle === sorte);
      if (x) {
        vu = true; matins++;
        const f = miens.slice(0, o.suivi.apres).map(m => m.m.feuille);
        const n = recompte(o.suivi.mesure, x.joueur, x.passeur, f);
        if (x.joues === f.length && x.n === n && !R) matinsOk++; else faute(`${sorte} J${j} : l'état dit ${x.n} en ${x.joues}, les feuilles ${n} en ${f.length}`);
        if (exemples.length < 3 && x.joues === 3 && !exemples.includes(motDuSuiviEnCours(x))) exemples.push(motDuSuiviEnCours(x));
      } else if (R) {
        fini = true; finis++;
        const f = miens.slice(0, o.suivi.apres).map(m => m.m.feuille);
        const n = recompte(o.suivi.mesure, R.joueur, a.passeur ? Object.values(r.you.roster).find(p => p && getPlayerKey(p) === getPlayerKey(a.passeur)) : null, f);
        if (vu && f.length === o.suivi.apres && R.n === n && R.texte.includes(String(n))) finisOk++; else faute(`${sorte} : le retour dit ${R.n} (« ${R.texte} »), les feuilles ${n} en ${f.length}`);
      } else if (vu) { faute(`${sorte} J${j} : ni état ni retour`); break; }
    }
    if (!fini) faute(`${sorte} : aucun retour à la fin`);
    // 2. Le joueur part au 3e match du suivi : la promesse tombe le lendemain.
    partis++;
    const q = saison(seed, [d]);
    let m3 = null;
    for (let j = J + 1; j <= q.L.calendrier.length; j++) { jouerJusqua(q.L, j); if (tes(q.L, q.you).filter(m => m.j >= J).length >= 3) { m3 = j; break; } }
    const slot = Object.entries(q.you.roster).find(([, p]) => p && getPlayerKey(p) === cle);
    if (!m3 || !slot) { faute(`${sorte} : impossible de le faire partir`); continue; }
    delete q.you.roster[slot[0]];
    jouerJusqua(q.L, m3 + 1);
    const Rp = (q.you.retours || []).find(z => z.cle === sorte);
    if (Rp && Rp.parti && !Object.keys(Rp.effet).length && /n'est plus dans ton effectif/.test(Rp.texte) && !suivisEnCours(q.you).some(s => s.cle === sorte)) partisOk++;
    else faute(`${sorte} : parti, la promesse ne tombe pas (${Rp ? Rp.texte : 'aucun retour'})`);
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

informer('exemples d\'états', exemples.join(' · ') || 'aucun');
exiger('chaque fil suivi a un état chaque matin, recompté dans les feuilles', matins > 0 && matinsOk === matins, `${matinsOk}/${matins} matins, ${suivis} fils`);
exiger('chaque fil suivi finit par un retour au chiffre des feuilles', finis === suivis && finisOk === finis, `${finisOk}/${suivis}`);
exiger('un fil dont le joueur part : la promesse tombe le lendemain, sans effet', partisOk === partis, `${partisOk}/${partis}`);
exiger('l\'objectif du proprio se recompte à chaque match et finit', objectifs > 0 && objOk === objectifs, `${objOk}/${objectifs}`);
exiger('l\'objectif d\'un joueur parti se lève', leves > 0 && levesOk === leves, `${levesOk}/${leves}`);
for (const f of fautes) informer('faute', f);
informer('durée', `${((Date.now() - t0) / 1000).toFixed(0)} s`);
verdict('Ce qui court se suit');
