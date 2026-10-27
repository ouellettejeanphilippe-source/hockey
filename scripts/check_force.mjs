/*
 * LA FICHE SUIT LA FORCE (27 oct. 2026). JP, devant sa run 1 (un effectif 31e de 32 à la force du moteur, 12e au
 * classement) : *si mon effectif est 31e, je devrais pas être ben plus que 20e dans le meilleur cas*. Sur de vraies
 * équipes, la force prédit la fiche (check_ratings, 0,8) ; ce script pose la question sur des clubs BÂTIS EXPRÈS,
 * comme une run peut les bâtir : sans attaque et bonne défense (des avants du quart du bas à l'offensive, des
 * défenseurs du dixième du haut à la défensive), l'inverse, et le milieu — posés dans des ligues de vrais clubs.
 * Chacun doit finir à ÉCART_MAX rangs au plus de son rang de force (la valeur moyenne de ses 23, `v` : la mesure de
 * check_ratings, des salaires et des bouche-trous).
 *
 *   node scripts/check_force.mjs            (LIGUES=4)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, bilanLigue, generateur, getHiddenRatings } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const LIGUES = Number(process.env.LIGUES ?? 4);
export const ECART_MAX = 10;
const saisons = fs.readdirSync(DIR).filter(x => /^\d{4}.*\.json$/.test(x)).sort();
const choix = generateur('check_force');
const tire = n => Math.floor(choix() * n);

// Tous les joueurs-saisons réguliers (60 matchs, 40 pour un gardien), d'où se bâtissent les clubs exprès.
const tous = [];
for (const f of saisons) for (const p of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).players) {
  if ((p.gp || 0) >= (p.p === 'G' ? 40 : 60)) tous.push(p);
}
const groupe = p => (p.p === 'G' ? 'G' : ['D', 'LD', 'RD'].includes(p.p) ? 'D' : 'F');
const bande = (g, cle, bas, haut) => { const l = tous.filter(p => groupe(p) === g).sort((a, b) => cle(a) - cle(b)); return l.slice(Math.floor(l.length * bas), Math.ceil(l.length * haut)); };
/* `n` joueurs tirés d'une bande, une personne une fois. */
function piger(liste, n, pris) {
  const out = [];
  let garde = 0;
  while (out.length < n && garde++ < 5000) { const p = liste[tire(liste.length)]; const k = `${p.s}_${p.id}`; if (pris.has(k)) continue; pris.add(k); out.push({ ...p }); }
  return out;
}
const EXPRES = {
  ferme: { nom: 'sans attaque, bonne défense', F: ['o', 0, 0.25], D: ['d', 0.9, 1], G: ['v', 0.4, 0.6] },
  ouvert: { nom: 'bonne attaque, sans défense', F: ['o', 0.9, 1], D: ['d', 0, 0.25], G: ['v', 0.4, 0.6] },
  milieu: { nom: 'le milieu partout', F: ['v', 0.4, 0.6], D: ['v', 0.4, 0.6], G: ['v', 0.4, 0.6] },
};
function clubExpres(cle) {
  const E = EXPRES[cle], pris = new Set();
  const pool = [];
  for (const [g, n] of [['F', 13], ['D', 7], ['G', 2]]) { const [c, bas, haut] = E[g]; pool.push(...piger(bande(g, p => p[c], bas, haut), n, pris)); }
  pool.forEach(registerHiddenRatings);
  return createTeam(`${E.nom}`, cle.toUpperCase(), autoRoster(pool));
}
function clubsReels(n) {
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = saisons[tire(saisons.length)];
    const shard = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const tags = [...new Set(shard.players.map(p => p.t))];
    const tag = tags[tire(tags.length)];
    if (vus.has(`${shard.season}|${tag}`)) continue;
    let u;
    try { u = equipeReelle(shard.season, tag); } catch { continue; }
    if (u[0].length < 12 || u[1].length < 6 || !u[2].length) continue;
    vus.add(`${shard.season}|${tag}`);
    const pool = u.flat().map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    out.push(createTeam(`${tag} ${shard.season}`, tag, autoRoster(pool), { season: shard.season }));
  }
  return out;
}
/* La force d'un club : la valeur moyenne de ses 23 (`v`, la mesure de check_ratings, des salaires et des bouche-trous). */
const force = t => { const js = SLOTS.map(sl => t.roster[sl.i]).filter(Boolean); return js.reduce((a, p) => a + getHiddenRatings(p).v, 0) / js.length; };
const corr = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };

const ecarts = Object.fromEntries(Object.keys(EXPRES).map(k => [k, []]));
const lignes = Object.fromEntries(Object.keys(EXPRES).map(k => [k, []]));
const corrs = [];
for (let i = 0; i < LIGUES; i++) {
  const expres = Object.keys(EXPRES).map(clubExpres);
  const teams = [...clubsReels(32 - expres.length), ...expres];
  const L = creerLigue(teams, 82, { graine: `force:${i}` });
  jouerJusqua(L, Infinity);
  const parForce = L.teams.slice().sort((a, b) => force(b) - force(a));
  const standings = bilanLigue(L).standings;
  corrs.push(corr(L.teams.map(force), L.teams.map(t => t.PTS)));
  for (const t of expres) {
    const rf = parForce.indexOf(t) + 1, rc = standings.indexOf(t) + 1;
    const k = t.tag.toLowerCase();
    ecarts[k].push(rf - rc);
    lignes[k].push(`force ${rf}e (v ${force(t).toFixed(0)}) → ${rc}e (${t.W}-${t.L}-${t.OTL}, ${t.GF} BP, ${t.GA} BC)`);
  }
}
const mediane = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
exiger(`la force prédit la fiche des 32 clubs (corrélation ${(corrs.reduce((a, b) => a + b) / corrs.length).toFixed(2)} sur ${LIGUES} ligues)`, corrs.every(c => c >= 0.7));
for (const [k, E] of Object.entries(EXPRES)) {
  const pire = Math.max(...ecarts[k].map(Math.abs));
  exiger(`un club ${E.nom} finit à ${ECART_MAX} rangs au plus de son rang de force (médiane ${mediane(ecarts[k])}, pire ${pire} ; + = mieux que sa force)`, pire <= ECART_MAX, lignes[k].join(' · '));
}
verdict('La fiche suit la force');
