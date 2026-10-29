/**
 * LES VRAIS COACHS, SAISON PAR SAISON (V21 ; JP : *les coachs et assistants comme l'alignement, avec des coachs ; je
 * serais même ouvert à des cartes de vrais coachs par saison*) → data/coachs.json
 *
 * Qui dirigeait chaque club, chaque saison : l'API publique des records de la LNH (`coach-franchise-season-records`,
 * une ligne par coach, par club, par saison, saison régulière). Un club qui a changé de coach en cours de saison garde
 * celui qui a dirigé le plus de matchs.
 *
 * SA PHILOSOPHIE se lit dans les vraies stats de son club cette saison-là, prises des shards (les mêmes que les cartes de
 * joueurs), en rythme par match de joueur pour qu'un joueur échangé (sa saison entière sous chacun de ses clubs) ne
 * fausse rien — on l'écarte. Huit lectures, une par coach de js/coachs.js, chacune comparée aux autres clubs de la
 * saison (un écart réduit) ; la plus marquée décide :
 *   🐝 le Frelon      les tirs pour            🐢 la Tortue       les tirs contre (le moins)
 *   🦅 l'Aigle        le % de tir              🦏 le Rhino        les minutes de pénalité
 *   😇 l'Abbé         la discipline (le moins)  🫁 le Doc          la santé (les matchs joués du top 18)
 *   🪜 le Contremaître la profondeur (les points hors du top 6)   🌠 le Showman le poids des deux vedettes
 * SON RANG dans cette lecture (1 = le plus marqué de la ligue) fait sa maîtrise (js/coachs-reels.js).
 *
 * Sortie : { "1976-77": { "MTL": ["Scotty Bowman", "tortue", 1, 80, 60, 8, 12, 1, 1], … }, … } —
 * nom, philosophie, rang, matchs, victoires, défaites, nulles et défaites en prolongation, Coupe, Jack Adams.
 *
 *   node scripts/coachs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8')).seasons;
const URL = 'https://records.nhl.com/site/api/coach-franchise-season-records?limit=-1';

const r = await fetch(URL);
if (!r.ok) throw new Error(`L'API des records répond ${r.status}`);
const lignes = (await r.json()).data.filter(x => x.gameTypeId === 2);
const etiquette = id => { const s = String(id); return `${s.slice(0, 4)}-${s.slice(6)}`; };

/* Le coach de chaque club-saison : celui qui a dirigé le plus de matchs. */
const chefs = new Map();
for (const x of lignes) {
  const k = `${etiquette(x.season)}|${x.teamAbbrev}`;
  if (!chefs.has(k) || x.games > chefs.get(k).games) chefs.set(k, x);
}

const LECTURES = [
  ['essaim', 'sf', 1], ['tortue', 'sa', -1], ['rapaces', 'pct', 1], ['rhinos', 'pim', 1],
  ['choeur', 'pim', -1], ['souffle', 'sante', 1], ['profondeur', 'prof', 1], ['etoiles', 'vedettes', 1],
];
const pts = p => p.pt ?? ((p.g || 0) + (p.a || 0));
const out = {};
let manquants = 0, n = 0;
for (const saison of SAISONS) {
  const f = path.join(DIR, `${saison}.json`);
  if (!fs.existsSync(f)) continue;
  const joueurs = JSON.parse(fs.readFileSync(f, 'utf8')).players;
  const compte = new Map();
  for (const p of joueurs) compte.set(p.id, (compte.get(p.id) || 0) + 1);
  const parClub = new Map();
  for (const p of joueurs) if (compte.get(p.id) === 1) (parClub.get(p.t) || parClub.set(p.t, []).get(p.t)).push(p);
  const clubs = [];
  for (const [tag, ps] of parClub) {
    const pat = ps.filter(p => p.p !== 'G' && p.gp > 0), gar = ps.filter(p => p.p === 'G' && p.gp > 0);
    const gpPat = pat.reduce((a, p) => a + p.gp, 0), gpGar = gar.reduce((a, p) => a + p.gp, 0);
    if (!gpPat || !gpGar) continue;
    const tirs = pat.reduce((a, p) => a + (p.sh || 0), 0);
    const att = pat.filter(p => p.p !== 'D' && p.p !== 'LD' && p.p !== 'RD').sort((a, b) => pts(b) - pts(a));
    const totAtt = att.reduce((a, p) => a + pts(p), 0) || 1, totPat = pat.reduce((a, p) => a + pts(p), 0) || 1;
    const top = [...pat].sort((a, b) => pts(b) - pts(a));
    const maxGp = Math.max(...pat.map(p => p.gp));
    clubs.push({ tag, sf: tirs / gpPat, sa: gar.reduce((a, p) => a + (p.sa || 0), 0) / gpGar, pct: tirs ? pat.reduce((a, p) => a + (p.g || 0), 0) / tirs : 0,
      pim: pat.reduce((a, p) => a + (p.pim || 0), 0) / gpPat,
      sante: top.slice(0, 18).reduce((a, p) => a + p.gp, 0) / (18 * maxGp),
      prof: att.slice(6).reduce((a, p) => a + pts(p), 0) / totAtt,
      vedettes: top.slice(0, 2).reduce((a, p) => a + pts(p), 0) / totPat });
  }
  if (clubs.length < 4) continue;
  const z = {};
  for (const [, champ] of LECTURES) {
    if (z[champ]) continue;
    const v = clubs.map(c => c[champ]), m = v.reduce((a, b) => a + b, 0) / v.length;
    const e = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
    z[champ] = new Map(clubs.map(c => [c.tag, (c[champ] - m) / e]));
  }
  for (const c of clubs) {
    const x = chefs.get(`${saison}|${c.tag}`);
    if (!x) { manquants++; continue; }
    const [cle, champ, sens] = LECTURES.reduce((b, l) => (z[l[1]].get(c.tag) * l[2] > z[b[1]].get(c.tag) * b[2] ? l : b));
    const rang = 1 + clubs.filter(o => o[champ] * sens > c[champ] * sens).length;
    (out[saison] = out[saison] || {})[c.tag] = [x.coachName, cle, rang, x.games, x.wins, x.losses, (x.ties || 0) + (x.otLosses || 0), x.wonStanleyCup ? 1 : 0, x.wonJackAdams ? 1 : 0];
    n++;
  }
}
fs.writeFileSync(path.join(ROOT, 'data', 'coachs.json'), JSON.stringify(out));
const parCoach = {};
for (const s of Object.values(out)) for (const v of Object.values(s)) parCoach[v[1]] = (parCoach[v[1]] || 0) + 1;
console.log(`${n} coachs-saisons sur ${Object.keys(out).length} saisons ; ${manquants} clubs sans coach trouvé · ${Object.entries(parCoach).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
