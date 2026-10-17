/*
 * GRAVER (V9, tranche 7 — docs/refonte-v9.md § 6.8). Ce qu'un joueur fait chez toi lui reste. De vraies ligues de
 * 32 vestiaires, ton club en Rogue. Ce qu'on exige :
 *   1. chaque galon se RECOMPTE dans le journal de ton club : au match qu'il nomme, son compte passe le seuil, contre
 *      l'adversaire qu'il nomme ; il ne va qu'à tes joueurs ; le même journal rend les mêmes galons ;
 *   2. le galon passe par un canal qui existe : la décision de report `galons` monte son badge d'un palier par galon,
 *      jamais au-delà de Platine ; une ligue sans la décision n'en garde rien ;
 *   3. son histoire chez toi (js/cartable.js) : une ligne par saison de run, réécrite si la saison se rejoue, sans
 *      doubler ses galons ni ses copies ; les galons d'une run ne comptent pas dans la suivante ;
 *   4. la carte monte par ses exploits : trois galons sur une carte seule la montent d'une édition ;
 *   5. le panthéon : un record ne change que s'il est battu ; un trophée, un chandail ne s'inscrivent qu'une fois ;
 *   6. le vétéran mentor d'un fil (`saison`) monte le badge de la recrue sur sa ligne, et ne prend aucune case de son verso.
 * `GRAINES` : les ligues (83,85 par défaut).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Le cartable et le méta vivent dans localStorage : une mémoire de Node le remplace.
const memoire = new Map();
globalThis.localStorage = { getItem: k => (memoire.has(k) ? memoire.get(k) : null), setItem: (k, v) => memoire.set(k, String(v)), removeItem: k => memoire.delete(k) };

const { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, getPlayerKey, badgesDe, badgeGardien, SLOTS } = await import('../js/sim.js');
const { galonsDeLaSaison, texteDuGalon, GALONS, GALONS_MAX } = await import('../js/galons.js');
const { ajouterAuCartable, graverLaSaison, galonsDe, histoireChezToi, lireCartable } = await import('../js/cartable.js');
const { graverAuPantheon, lireMeta } = await import('../js/rogue.js');
const { poseesSur } = await import('../js/banque.js');
const { equipeReelle } = await import('./lib/vestiaires.mjs');
const { exiger, informer, verdict } = await import('./verdict.mjs');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const RECRUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'recrues.json'), 'utf8'));
const GRAINES = String(process.env.GRAINES || '83,85').split(',').map(Number);
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
function saison(seed, decisions = [], jusqua = Infinity) {
  const teams = ligue(seed);
  teams[0].isPlayer = true;
  const L = creerLigue(teams, 82, { graine: `galons-${seed}`, decisions, courbe: true });
  jouerJusqua(L, jusqua);
  return { L, you: teams[0] };
}
const joueursDe = t => Object.values(t.roster || {}).filter(Boolean);

console.log('\n  GRAVER : L\'HISTOIRE CHEZ TOI, LES GALONS, LE PANTHÉON (V9, tranche 7)\n');
const t0 = Date.now();
const fautes = [], exemples = [], sortes = {};
const faute = t => { if (fautes.length < 10) fautes.push(t); };
let galons = 0, recomptes = 0, deterministes = 0, aMoi = 0;

/* ---------- 1. les galons d'une saison, recomptés ---------- */
const bases = GRAINES.map(seed => ({ seed, ...saison(seed) }));
for (const { you } of bases) {
  const js = joueursDe(you), miens = new Set(js);
  const G = galonsDeLaSaison(you, js, getPlayerKey);
  if (JSON.stringify(G) === JSON.stringify(galonsDeLaSaison(you, js, getPlayerKey))) deterministes++;
  const parCle = new Map(js.map(p => [getPlayerKey(p), p]));
  for (const g of G) {
    galons++; sortes[g.cle] = (sortes[g.cle] || 0) + 1;
    if (exemples.length < 4) exemples.push(`${g.nom} : ${texteDuGalon(g)}`);
    const p = parCle.get(g.joueur);
    if (p && miens.has(p)) aMoi++;
    // Le compte de ce galon, match par match, dans le journal : il passe le seuil au match nommé, contre l'adversaire nommé.
    const gros = new Set((you.minisBoss || []).filter(mb => mb.gagne).map(mb => `${mb.jour}|${mb.adv.name}`));
    let n = 0, passe = null;
    for (const e of you.journal) {
      const f = e.feuille, cote = (f.alignes.A || []).some(q => miens.has(q)) ? 'A' : 'B';
      const avant = n;
      for (const b of f.buts.filter(x => x.cote === cote)) {
        if (g.cle === 'buts' && b.marqueur === p) n++;
        if (g.cle === 'passes') n += (b.passeurs || []).filter(q => q === p).length;
        if (g.cle === 'recrue') n += (b.marqueur === p ? 1 : 0) + (b.passeurs || []).filter(q => q === p).length;
      }
      if (g.cle === 'victoires' && e.win && e.gardien === p) n++;
      if (g.cle === 'grandsSoirs' && gros.has(`${e.jour}|${e.adv.name}`) && (f.alignes[cote] || []).includes(p)) n++;
      if (avant < GALONS[g.cle].seuil && n >= GALONS[g.cle].seuil && !passe) passe = e;
    }
    if (passe && passe.n === g.match && passe.adv.name === g.adv && g.n === GALONS[g.cle].seuil) recomptes++;
    else faute(`${g.nom} « ${texteDuGalon(g)} » : recompté au match ${passe ? passe.n : '?'}`);
  }
}
exiger('chaque galon se recompte dans le journal : son match, son adversaire, son seuil', galons > 0 && recomptes === galons, `${recomptes} sur ${galons}`);
exiger('un galon ne va qu\'à tes joueurs', aMoi === galons, `${aMoi} sur ${galons}`);
exiger('le même journal rend les mêmes galons', deterministes === bases.length, `${deterministes} sur ${bases.length}`);

/* ---------- 2. le canal : un palier de badge par galon, borné ---------- */
{
  const { seed, you } = bases[0];
  const js = joueursDe(you).filter(p => p.p !== 'G');
  // Un patineur dont le premier badge peut monter de deux paliers, et un gardien.
  const lu = p => { const b = badgesDe(p); return b && b[0] ? b[0].palier : 0; };
  const P = js.find(p => lu(p) > 0 && lu(p) <= 2) || js[0], G0 = joueursDe(you).find(p => p.p === 'G' && badgeGardien(p));
  const avec = (cles, n) => {
    const r = saison(seed, [{ jour: 0, galons: Object.fromEntries(cles.map(k => [k, n])), report: true }], 1);
    return r.you;
  };
  const sans = saison(seed, [], 1).you;
  const kP = getPlayerKey(P), trouve = (t, k) => joueursDe(t).find(p => getPlayerKey(p) === k);
  const p0 = lu(trouve(sans, kP)), p1 = lu(trouve(avec([kP], 1), kP)), p2 = lu(trouve(avec([kP], GALONS_MAX), kP));
  exiger('un galon monte son badge d\'un palier, deux galons de deux, jamais au-delà de Platine', p1 === Math.min(4, p0 + 1) && p2 === Math.min(4, p0 + GALONS_MAX), `${p0} → ${p1} → ${p2}`);
  if (G0) {
    const kG = getPlayerKey(G0);
    const g0 = badgeGardien(trouve(sans, kG)).palier, g1 = badgeGardien(trouve(avec([kG], 1), kG)).palier;
    exiger('le badge d\'un gardien monte aussi', g1 === Math.min(4, g0 + 1), `${g0} → ${g1}`);
  }
  const apres = saison(seed, [], 1).you;
  exiger('une ligue sans la décision n\'en garde rien', !joueursDe(apres).some(p => p._galon), `${joueursDe(apres).filter(p => p._galon).length} joueur(s) gardent un galon`);
}

/* ---------- 3 et 4. l'histoire chez toi, la carte qui monte ---------- */
{
  memoire.clear();
  const k = 'test_galons_1';
  ajouterAuCartable([{ cle: k, rar: 'commune' }]);
  const trois = ['buts', 'passes', 'grandsSoirs'].map((cle, i) => ({ cle, n: GALONS[cle].seuil, match: 40 + i, adv: 'Boston' }));
  const ligne = { cle: k, stats: { gp: 82, g: 41, a: 52, pts: 93, gros: 6 }, galons: trois };
  const r1 = graverLaSaison([ligne], 1, 1);
  const x1 = JSON.stringify(lireCartable().joueurs[k]);
  const r2 = graverLaSaison([ligne], 1, 1);
  const x2 = JSON.stringify(lireCartable().joueurs[k]);
  exiger('la même saison gravée deux fois réécrit sa ligne, sans doubler galons ni copies', r1.neufs.length === 3 && r2.neufs.length === 0 && x1 === x2 && histoireChezToi(k).length === 1, `${r1.neufs.length} puis ${r2.neufs.length} galon(s) neuf(s)`);
  exiger('trois galons sur une carte seule la montent d\'une édition', r1.montees.length === 1 && r1.montees[0].de === 'commune' && r1.montees[0].a === 'peu', JSON.stringify(r1.montees));
  graverLaSaison([{ cle: k, stats: { gp: 80, g: 30, a: 20, pts: 50 }, galons: [] }], 1, 2);
  graverLaSaison([{ cle: k, stats: { gp: 82, g: 44, a: 10, pts: 54 }, galons: [{ cle: 'buts', n: 40, match: 70, adv: 'Detroit' }] }], 2, 1);
  exiger('son histoire garde chaque saison, d\'une run à l\'autre ; les galons d\'une run ne comptent pas dans l\'autre',
    histoireChezToi(k).length === 3 && galonsDe(k, 1).length === 3 && galonsDe(k, 2).length === 1 && galonsDe(k).length === 4,
    `${histoireChezToi(k).length} saisons · run 1 : ${galonsDe(k, 1).length} · run 2 : ${galonsDe(k, 2).length} · carrière ${galonsDe(k).length}`);
}

/* ---------- 5. le panthéon ---------- */
{
  memoire.clear();
  const j = (nom, g, galonsCarriere = 0) => ({ cle: nom, nom, g, a: 10, pts: g + 10, galonsCarriere });
  const a = graverAuPantheon({ run: 1, saison: 1, pts: 90, joueurs: [j('Bossy', 45, 1)], trophees: [{ nom: 'Trophée Maurice-Richard', joueur: 'Bossy', val: '45 buts' }] });
  const b = graverAuPantheon({ run: 1, saison: 1, pts: 90, joueurs: [j('Bossy', 45, 1)], trophees: [{ nom: 'Trophée Maurice-Richard', joueur: 'Bossy', val: '45 buts' }] });
  const c = graverAuPantheon({ run: 2, saison: 1, pts: 80, joueurs: [j('Kurri', 40, 3)], trophees: [] });
  const P = lireMeta().pantheon;
  exiger('le panthéon : un record ne change que s\'il est battu ; un trophée, un chandail, une fois',
    a.records.includes('buts') && !b.records.length && !b.trophees.length && P.records.buts.nom === 'Bossy' && P.records.club.n === 90
      && P.trophees.length === 1 && c.chandails.length === 1 && P.chandails[0].nom === 'Kurri',
    `records ${Object.keys(P.records).join(', ')} · ${P.trophees.length} trophée · ${P.chandails.length} chandail`);
}

/* ---------- 6. le vétéran mentor ---------- */
{
  const { seed, you } = bases[0];
  const F = SLOTS.filter(s => s.group === 'F' && !s.scratch && s.unit === 2);
  const [v, r] = [you.roster[F[0].i], you.roster[F[1].i]];
  const d = { jour: 3, mutation: { cle: 'mentorTrio', joueur: getPlayerKey(v), saison: true }, sel: 'mentor' };
  const m = saison(seed, [d], 10).you;
  const mu = (m.mutations || []).find(x => x.cle === 'mentorTrio');
  const rookie = joueursDe(m).find(p => getPlayerKey(p) === getPlayerKey(r));
  exiger('le mentor d\'un fil monte le badge de sa ligne, pour la saison, sans prendre de case', !!mu && mu.saison === true && rookie && rookie._palierTrio === 1 && poseesSur([d], getPlayerKey(v)).length === 0,
    `${mu ? 'mentor posé' : 'aucun mentor'} · palier de trio ${rookie ? rookie._palierTrio || 0 : '?'} · cases prises ${poseesSur([d], getPlayerKey(v)).length}`);
}

if (fautes.length) informer('les fautes', fautes.join(' · '));
informer('les galons vus', Object.entries(sortes).map(([k, n]) => `${GALONS[k].nom} ${n}`).join(' · ') || 'aucun');
for (const x of exemples) informer('un galon', x);
informer('le temps', `${Math.round((Date.now() - t0) / 1000)} s (${GRAINES.length} ligues)`);
verdict();
