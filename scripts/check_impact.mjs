/*
 * L'IMPACT DES CHOIX SUR LE PROFIL DU MATCH — l'outil de calibration (docs/impact-des-choix.md, étape 0).
 *
 * JP : *plus fort, ça veut pas dire plus gagner ; ça doit être clair que le build a un impact pour vrai.* On ne
 * le sait qu'en lisant ce que chaque choix fait AU MATCH — des tirs, des buts, des punitions, des mises en échec —
 * et pas seulement aux victoires, où une carte honnête (un net borné par sa rareté, `check_cartes`) pouvait rester invisible. Ce
 * script lit le profil du match de la feuille (`t.journal[i].feuille`, déjà produite par le moteur) d'un club
 * traité, contre des adversaires NON traités, EN PAIRES : la même ligue de 32 vraies équipes jouée sous la même
 * graine sans rien, puis avec l'effet aux équipes de rang pair (puis impair). Chaque équipe se compare à elle-même.
 *
 * DEUX MODES.
 *   Par défaut (une douzaine de secondes), les INVARIANTS qui rendent la mesure digne de foi :
 *     1. la base de la ligue : ~28,4 tirs par club et par match, ~3,0 buts, ~3,8 punitions, ~22 mises en échec
 *        attendues (les repères de MOTEUR.md, la sortie du moteur d'aujourd'hui) ;
 *     2. le témoin : sans effet, les deux passages sont la même simulation — l'écart est EXACTEMENT zéro sur
 *        chaque colonne du profil (si ce n'est pas zéro, ce n'est pas l'effet qui est en cause, c'est la mesure) ;
 *     3. l'égalité des lancers : les tirs pour de la ligue sont les tirs contre de la ligue ;
 *     4. une lecture : l'effet d'une carte, lu par `effetEnChiffres` (js/impact.js), est ce que la mesure en paires
 *        trouve — une carte qui change le rythme, mesurée pour de vrai.
 *   `COMPLET=1` : le tableau de CHAQUE choix (la grille des canaux, les cartes de saison, les systèmes, les
 *     agressivités, des styles composés), en `informer` — c'est un tableau de calibration, pas un repère : un
 *     intervalle inventé crierait pour du bruit (verdict.mjs). Une carte rare ou légendaire doit se VOIR dans cette
 *     colonne (docs/impact-des-choix.md §7.5). Il est long (sept secondes par configuration et par graine : de
 *     cinq à quinze minutes) : à la main, comme check_cartes. `GROUPE=carte|canal|systeme|agressivite|style`
 *     n'en lit qu'un, `SEEDS=1000,1001,1002` règle les ligues, `PARITES=0,1` les deux passages (un seul par défaut).
 *
 *   node scripts/check_impact.mjs
 *   COMPLET=1 GROUPE=carte SEEDS=1000,1001,1002 PARITES=0,1 node scripts/check_impact.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, tirsTotal, CARTES, TACTIQUES, SYSTEMES_D, AGRESSIVITES } from '../js/sim.js';
import { effetEnChiffres } from '../js/impact.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const SEEDS = (process.env.SEEDS || '1000').split(',').map(Number);
const PARITES = (process.env.PARITES || '0').split(',').map(Number);
const COMPLET = !!process.env.COMPLET;
const GROUPE = process.env.GROUPE || null;
const NEQ = 32;

const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
/* Trente-deux vraies équipes tirées dans les 55 saisons, reproductibles. */
function ligue(seed, n = NEQ) {
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

/* Le profil de match de chaque équipe, lu des feuilles ; `filtre(i, adversaire)` garde les matchs contre des adversaires non traités. */
const COLONNES = ['tp', 'tc', 'bp', 'bc', 'pun', 'punC', 'minAN', 'minDN', 'hp', 'hc'];
function lire(teams, filtre) {
  const idx = new Map(teams.map((t, i) => [t, i]));
  return teams.map((t, i) => {
    const a = { n: 0, tp: 0, tc: 0, bp: 0, bc: 0, pun: 0, punC: 0, minAN: 0, minDN: 0, hp: 0, hc: 0, v: 0 };
    for (const j of t.journal) {
      const f = j.feuille;
      if (!f || !f.A) continue;
      if (filtre && !filtre(i, idx.get(j.adv))) continue;
      const c = f.A === t ? 'A' : 'B', o = c === 'A' ? 'B' : 'A';
      a.n++; a.tp += tirsTotal(f, c); a.tc += tirsTotal(f, o); a.bp += j.gf; a.bc += j.ga; a.v += j.win ? 1 : 0;
      for (const p of f.punitions) { if (p.cote === c) { a.pun++; a.minDN += p.fin - p.instant; } else { a.punC++; a.minAN += p.fin - p.instant; } }
      a.hp += f.coups[c]; a.hc += f.coups[o];
    }
    a.W = t.W;
    return a;
  });
}
const base = new Map();
function laBase(seed) {
  if (!base.has(seed)) {
    const teams = ligue(seed);
    simulateLeague(teams, 82, { graine: `L${seed}` });
    base.set(seed, { teams, profil: lire(teams, null) });
  }
  return base.get(seed);
}
/* Un effet en paires : l'écart moyen par match, traité moins base, sur les équipes traitées contre des adversaires non traités. */
function paires(payload, seeds = SEEDS) {
  const T = Object.fromEntries([...COLONNES, 'W'].map(k => [k, 0])), S = { ...T };
  let k = 0;
  for (const seed of seeds) {
    for (const par of PARITES) {
      // Le même filtre des deux côtés : le club traité ne se lit que contre des adversaires non traités, avec l'effet comme sans lui.
      const b = lire(laBase(seed).teams, (i, oi) => oi % 2 !== par);
      const teams = ligue(seed);
      const traites = teams.map((_, i) => i).filter(i => i % 2 === par);
      simulateLeague(teams, 82, { graine: `L${seed}`, decisions: traites.flatMap(equipe => (Array.isArray(payload) ? payload : [payload]).map(p => ({ jour: 0, equipe, ...p }))) });
      const r = lire(teams, (i, oi) => oi % 2 !== par);
      for (const i of traites) {
        const x = r[i], y = b[i];
        k++;
        for (const c of COLONNES) { T[c] += x[c] / x.n; S[c] += y[c] / y.n; }
        T.W += x.W; S.W += y.W;
      }
    }
  }
  const d = c => (T[c] - S[c]) / k;
  return { ...Object.fromEntries([...COLONNES, 'W'].map(c => [c, d(c)])), n: k };
}
const f1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
const f2 = x => (Math.round(x * 100) / 100).toString().replace('.', ',');
const sg = (x, d = 1) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d).replace('.', ',');
/* Une ligne du tableau : ce que le joueur lit dans la feuille, par match. */
const ligneDe = r => `tirs ${sg(r.tp)} / ${sg(r.tc)} · rythme ${sg(r.tp + r.tc)} · buts ${sg(r.bp, 2)} / ${sg(r.bc, 2)} · punitions ${sg(r.pun, 2)} · mises en échec ${sg(r.hp)} · V ${sg(r.W)}`;

console.log('\n  L\'IMPACT DES CHOIX SUR LE PROFIL DU MATCH\n');

/* 1. La base de la ligue. */
{
  const { profil } = laBase(SEEDS[0]);
  const m = c => profil.reduce((s, a) => s + a[c] / a.n, 0) / profil.length;
  borne('la base : tirs par club et par match', m('tp'), 27.5, 29.5, ' tirs');
  borne('la base : buts par club et par match', m('bp'), 2.85, 3.3, ' buts');
  borne('la base : punitions par club et par match', m('pun'), 3.3, 4.4, ' punitions');
  borne('la base : mises en échec attendues par club et par match', m('hp'), 19, 25, ' mises en échec');
  exiger('la ligue est fermée : les tirs pour sont les tirs contre', Math.abs(m('tp') - m('tc')) < 1e-9, `${f2(m('tp'))} = ${f2(m('tc'))}`);
  informer('le profil de la ligue de base, tel qu\'un joueur le lit', `${f1(m('tp'))} tirs, ${f2(m('bp'))} buts, ${f1(m('pun'))} punitions, ${f1(m('minAN'))} min en avantage, ${f1(m('hp'))} mises en échec, ${f1(m('tp') + m('tc'))} tirs en tout`);
}

/* 2. Le témoin : sans effet, deux passages identiques, exactement. */
{
  const r = paires([]);
  const pire = Math.max(...[...COLONNES, 'W'].map(c => Math.abs(r[c])));
  exiger('le témoin : sans effet, l\'écart du profil est exactement zéro (tirs, buts, punitions, mises en échec, victoires)', pire === 0, `${r.n} équipes · plus grand écart ${pire}`);
}

/* 3. Une lecture : « La chasse » (tirs de plus), lue et mesurée. */
{
  const chasse = CARTES.chasse;
  const r = paires({ carte: 'chasse' });
  // La même carte, lue par l'écran : la moyenne sur les équipes traitées (les vraies équipes de la ligue de base).
  const { teams } = laBase(SEEDS[0]);
  const traites = teams.filter((_, i) => PARITES.includes(i % 2));
  const lu = { tir: 0, tirContre: 0 };
  for (const t of traites) {
    t.jourCourant = 40;
    const m = effetEnChiffres(chasse, t);
    for (const x of m) {
      const n = Number(x.txt.match(/[+−]([\d,]+)/)?.[1].replace(',', '.')) * (x.txt.includes('−') ? -1 : 1);
      if (x.cle === 'tir') lu.tir += n / traites.length;
      if (x.cle === 'tir accordé') lu.tirContre += n / traites.length;
    }
    delete t.jourCourant;
  }
  informer('« La chasse », mesurée en paires', ligneDe(r));
  informer('« La chasse », lue par l\'écran (moyenne des équipes traitées)', `tirs ${sg(lu.tir)} / ${sg(lu.tirContre)}`);
  borne('« La chasse » change le rythme : des tirs de plus, mesurés', r.tp, 1.4, 3.4, ' tirs');
  // La lecture tient ce que la mesure trouve, à son bruit près (la lecture arrondit au dixième de tir).
  exiger('la lecture de l\'écran suit la mesure en paires', Math.abs(lu.tir - r.tp) <= 0.6, `${sg(lu.tir)} annoncés, ${sg(r.tp)} mesurés`);
}

/* 4. Le tableau de chaque choix. */
if (COMPLET) {
  const E = c => ({ effet: { duree: 100, nom: 'mesure', ...c } });
  const L = (tac, tacD, agr = 1) => ({ lignes: [0, 1, 2, 3].map(() => ({ tac, tacD, agr, sec: 60 })) });
  const K = ks => ks.map(carte => ({ carte }));
  const G = { canal: [], carte: [], systeme: [], agressivite: [], style: [] };
  for (const v of [0.9, 1.1]) G.canal.push([`volume ×${v}`, E({ volume: v })]);
  for (const v of [0.9, 1.1]) G.canal.push([`finition ×${v}`, E({ finition: v })]);
  for (const v of [0.9, 1.1]) G.canal.push([`défense ×${v}`, E({ defense: v })]);
  for (const v of [0.7, 1.3]) G.canal.push([`discipline ×${v}`, E({ discipline: v })]);
  G.canal.push(['robustesse +1', E({ robustesse: 1 })], ['blessure ×2', E({ blessure: 2 })], ['jambes ×1,15', E({ energie: 1.15 })]);
  for (const k of Object.keys(CARTES)) G.carte.push([`carte ${k}`, { carte: k }]);
  for (const k of Object.keys(TACTIQUES)) G.systeme.push([`système (trios) ${k}`, L(k, 'equilibre')]);
  for (const k of Object.keys(SYSTEMES_D)) G.systeme.push([`système (paires) ${k}`, L('hourra', k)]);
  AGRESSIVITES.forEach((a, i) => G.agressivite.push([`agressivité ${a.nom}`, L('hourra', 'hourra', i)]));
  G.style.push(['défensif : cartes', K(['cadenas', 'newjersey', 'gardiens'])], ['offensif : cartes', K(['grandjeu', 'ouvert', 'chasse'])],
    ['défensif : systèmes', L('defensive', 'maison', 0)], ['offensif : systèmes', L('bleue', 'activer', 2)]);
  for (const [groupe, liste] of Object.entries(G)) {
    if (GROUPE && GROUPE !== groupe) continue;
    for (const [nom, payload] of liste) informer(nom, ligneDe(paires(payload)));
  }
}

verdict();
