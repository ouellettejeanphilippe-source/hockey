/*
 * À NIVEAU ÉGAL, LE MEILLEUR CHANGE-T-IL SELON LE PLAN ? (V9, tranche 2 ; docs/refonte-v9.md, § 2 et § 10)
 *
 * JP, 16 oct. : *une base de données qui fait que tous les joueurs d'un même trio ne se valent pas, afin de permettre
 * des substitutions, mais jamais dans un sens absolu que x carte est mieux : x carte fitte mieux dans le but du DG et du
 * coach*. Ce script le juge. Une vraie équipe, une case (le 2e trio, le 4e, une paire) ; des candidats du même côté et du
 * même niveau (`niveauDe`), pris dans onze saisons de 1970 à 2025 ; chacun posé dans la case, son unité jouée dans chaque
 * système (`TACTIQUES`, `SYSTEMES_D`), les autres lignes à `lignesAuMieux` ; la lecture du moteur (`chiffresDuSoir` : buts
 * pour moins buts contre par match, contre un club moyen), en victoires sur 82 matchs à six buts la victoire.
 *
 * Trois questions, par case, puis en moyenne :
 *   1. l'ordre des candidats change-t-il d'un système à l'autre ? (Spearman moyen entre deux systèmes)
 *   2. combien de systèmes ont un meilleur différent ?
 *   3. que rapporte de signer le meilleur POUR le système, plutôt que le meilleur en général ?
 *
 * LES CIBLES DE LA V9 (§ 10) : Spearman ≤ 0,6 ; au moins trois systèmes avec un meilleur différent ; signer pour son plan
 * rapporte au moins +0,4 V par case. Mesuré le 16 oct., avant la tranche 3 : Spearman 0,97 à 0,99, le même meilleur dans
 * les sept systèmes, 0,0 à 0,1 V — le script est ROUGE tant que le plan ne décide pas quelles stats comptent. C'est le
 * juge de la tranche 3, pas une vérification de la CI.
 *
 *   node scripts/check_fit.mjs            (une demi-minute)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHiddenRatings, autoRoster, createTeam, lignesAuMieux, activeLineup, TACTIQUES, SYSTEMES_D, SLOTS } from '../js/sim.js';
import { chiffresDuSoir } from '../js/impact.js';
import { niveauDe } from '../js/niveaux.js';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const CACHE = new Map();
const shard = s => {
  if (!CACHE.has(s)) { const e = JSON.parse(fs.readFileSync(path.join(DIR, `${s}.json`), 'utf8')); e.players.forEach(registerHiddenRatings); CACHE.set(s, e); }
  return CACHE.get(s);
};
// Une victoire vaut six buts de différentiel sur 82 matchs (la conversion des mesures de la V9).
const V = x => (x * 82) / 6;

/*
 * LES CASES ÉPROUVÉES : le haut et le bas de l'alignement, les avants et les défenseurs, trois époques. `niveau` : 2
 * Pilier, 1 Régulier (`js/niveaux.js`) ; `np` : le côté du candidat (celui de la case, pour qu'aucun ne paie de
 * pénalité de position). La case se lit dans `SLOTS` : son groupe et son unité donnent le système qu'on fait varier.
 */
const CASES = [
  { saison: '1995-96', club: 'BOS', i: 3, np: 'L', niveau: 2 },    // 2e trio, ailier gauche
  { saison: '1985-86', club: 'MTL', i: 3, np: 'L', niveau: 2 },
  { saison: '2015-16', club: 'CHI', i: 3, np: 'L', niveau: 2 },
  { saison: '1995-96', club: 'BOS', i: 9, np: 'L', niveau: 1 },    // 4e trio, ailier gauche
  { saison: '1995-96', club: 'BOS', i: 7, np: 'C', niveau: 1 },    // 3e trio, centre
  { saison: '1995-96', club: 'BOS', i: 14, np: 'LD', niveau: 2 },  // 2e paire, défenseur gauche
  { saison: '2005-06', club: 'CAR', i: 16, np: 'LD', niveau: 1 },  // 3e paire, défenseur gauche
];
// Les candidats : quatre par saison, répartis dans sa liste, dans une saison sur cinq.
const SAISONS_CANDIDATS = SAISONS.filter((_, k) => k % 5 === 0);

const rang = a => { const o = a.map((x, k) => [x, k]).sort((p, q) => q[0] - p[0]), r = []; o.forEach(([, k], j) => { r[k] = j; }); return r; };
const spearman = (a, b) => { const ra = rang(a), rb = rang(b), n = a.length; let d = 0; for (let k = 0; k < n; k++) d += (ra[k] - rb[k]) ** 2; return 1 - (6 * d) / (n * (n * n - 1)); };
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
// « 2e trio · AG », « 3e paire · DG » : la case comme l'écran la nomme.
const nomDeCase = sl => `${sl.unit + 1}${sl.unit ? 'e' : sl.group === 'D' ? 're' : 'er'} ${sl.group === 'D' ? 'paire' : 'trio'} · ${sl.role}`;

function mesurer(c) {
  const sl = SLOTS[c.i];
  const D = sl.group === 'D';
  const T = D ? SYSTEMES_D : TACTIQUES;
  const systemes = Object.keys(T).filter(k => k !== 'hourra');
  const roster0 = autoRoster(shard(c.saison).players.filter(p => p.t === c.club && p.gp >= 10));
  const groupe = D ? 'D' : 'F';
  const candidats = [];
  for (const s of SAISONS_CANDIDATS) {
    const joueurs = shard(s).players;
    const l = joueurs.filter(p => p.p === groupe && p.np === c.np && p.gp >= 40 && niveauDe(p, joueurs) === c.niveau);
    for (let k = 0; k < l.length && k < 4; k++) candidats.push(l[Math.floor((k * l.length) / 4)]);
  }
  const lu = (R, cle) => {
    const t = createTeam('Essai', 'ESS', R, { season: c.saison });
    const L = lignesAuMieux(R);
    L[sl.unit] = D ? { ...L[sl.unit], tacD: cle } : { ...L[sl.unit], tac: cle };
    t.lignes = L;
    const m = chiffresDuSoir(t, activeLineup(t));
    return V(m.butsPour - m.butsContre);
  };
  const val = candidats.map(p => { const R = { ...roster0, [c.i]: { ...p } }; return systemes.map(k => lu(R, k)); });
  const parSysteme = systemes.map((_, s) => val.map(v => v[s]));
  const rh = [];
  for (let a = 0; a < systemes.length; a++) for (let b = a + 1; b < systemes.length; b++) rh.push(spearman(parSysteme[a], parSysteme[b]));
  const meilleurs = new Set(parSysteme.map(v => v.indexOf(Math.max(...v))));
  const general = val.map(moy), iG = general.indexOf(Math.max(...general));
  const gain = moy(parSysteme.map(v => Math.max(...v) - v[iG]));
  const ecart = Math.sqrt(moy(general.map(x => (x - moy(general)) ** 2)));
  return { c, n: candidats.length, systemes: systemes.length, rho: moy(rh), meilleurs: meilleurs.size, gain, ecart, meilleur: candidats[iG] };
}

const t0 = Date.now();
const lus = CASES.map(mesurer);
for (const r of lus) {
  informer(`${r.c.club} ${r.c.saison} · ${nomDeCase(SLOTS[r.c.i])} · ${['', 'Régulier', 'Pilier'][r.c.niveau]}`,
    `${r.n} candidats · Spearman ${r.rho.toFixed(2)} · ${r.meilleurs} meilleur(s) sur ${r.systemes} systèmes · signer pour le système +${r.gain.toFixed(2)} V · écart entre candidats ${r.ecart.toFixed(2)} V · le meilleur partout : ${r.meilleur.n} ${r.meilleur.s}`);
}
const rho = moy(lus.map(r => r.rho)), nb = moy(lus.map(r => r.meilleurs)), gain = moy(lus.map(r => r.gain));
exiger('l\'ordre des candidats change avec le système', rho <= 0.6, `Spearman moyen ${rho.toFixed(3)} (attendu 0,6 ou moins)`);
exiger('plusieurs systèmes ont un meilleur différent', nb >= 3, `${nb.toFixed(1)} en moyenne par case (attendu 3 ou plus)`);
exiger('signer pour son système rapporte', gain >= 0.4, `+${gain.toFixed(2)} V par case en moyenne (attendu +0,4 V ou plus)`);
verdict(`Le fit, à niveau égal · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
