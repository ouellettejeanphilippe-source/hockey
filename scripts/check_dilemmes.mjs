/*
 * LES DILEMMES SONT VRAIS (oct. 2026). JP, sur « Les adieux au casier » : *seulement si un joueur x est voté out de
 * l'équipe. Toutes ces choses doivent être vraies, donc si choix que quatrième trio joue plus, il joue plus pour
 * vrai. Toujours nommer les joueurs impliqués.* Ce qu'on exige :
 *   1. chaque dilemme a son fait (`FAITS`, js/sim.js), une voix d'EXPEDITEURS et une scène ; son calendrier
 *      (`quand`) s'ajoute au fait, jamais seul ;
 *   2. ses textes nomment ses joueurs : {nom} quand le fait nomme un joueur, {noms} quand il en nomme plusieurs,
 *      chaque {…} se remplit, et jamais « un joueur », « la recrue », « le doyen »… sans son nom ;
 *   3. le lexique des options, dans les deux sens : chaque mot de stat dit un canal que l'effet bouge, dans le sens
 *      dit (« plus de tirs », « ton quatrième trio joue plus »), et chaque canal bougé est dit (LEXIQUE, plus bas) ;
 *   4. sur de vraies ligues jouées au jour le jour : un dilemme ne se tire jamais sans son fait, et chaque fait se
 *      recompte dans les feuilles d'avant sa journée ; un joueur parti nomme le vrai parti, et sans départ,
 *      « Le départ » (ex-« Les adieux au casier ») ne sort jamais ;
 *   5. les chiffres de l'écran sont ceux que le moteur joue : l'effet posé porte les canaux de l'option, il dure
 *      les matchs que l'écran annonce, et ce qui vise le joueur nommé est posé sur lui.
 *   node scripts/check_dilemmes.mjs            GRAINES=11,12,13 (les ligues ; les impaires voient un départ)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, getPlayerKey, SLOTS, MOMENTS, FAITS, JOURS_MOMENTS,
  faitsDuClub, texteDuFait, momentDuJour, jourEvenement, connaitre, MUTATIONS, cibleMutation, dureeOption, energieDe,
} from '../js/sim.js';
import { EXPEDITEURS, PUNITIONS_SERMON } from '../js/vie-gm.js';
import { sceneDuDilemme, MOTS_DES_SCENES } from '../js/scenes.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const RECRUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'recrues.json'), 'utf8'));
const GRAINES = String(process.env.GRAINES || '11,12,13').split(',').map(Number);
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => {
  const rk = new Set(RECRUES[s] || []);
  const p = un.flat().map(x => ({ ...x, ...(rk.has(x.id) ? { rk: 1 } : {}) }));
  p.forEach(registerHiddenRatings);
  return createTeam(nom, tag, autoRoster(p), { season: s });
};
function ligue(seed, n = 12) {
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
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
const tes = (L, you) => L.calendrier.flatMap((jour, j) => jour.filter(m => m.joue && (m.A === you || m.B === you)).map(m => ({ j, m })));

console.log('\n  LES DILEMMES SONT VRAIS\n');
const t0 = Date.now();
const DILEMMES = Object.entries(MOMENTS);
const fautes = { cat: [], noms: [], lex: [], faits: [], parti: [], ecran: [], promesse: [] };
let promesses = 0;
const faute = (k, t) => { if (fautes[k].length < 8) fautes[k].push(t); };
const textes = M => [M.titre, ...M.options.flatMap(o => [o.nom, o.bon, o.prix])].filter(Boolean);

/* ---------- 1. le catalogue : un fait, une voix, une scène, un calendrier qui n'est jamais seul ---------- */
const QUAND = new Set(['octobre', 'decembre', 'echeance', 'mars']);
for (const [k, M] of DILEMMES) {
  if (!FAITS[M.fait]) faute('cat', `${k} : aucun fait (« ${M.fait} »)`);
  if (!EXPEDITEURS[M.de]) faute('cat', `${k} : la voix « ${M.de} » n'est pas d'EXPEDITEURS`);
  if (!(MOTS_DES_SCENES.dilemme[M.fait] || []).length) faute('cat', `${k} : aucune réplique pour son fait`);
  if (typeof M.faits !== 'function') faute('cat', `${k} : pas de lecture des faits`);
  if (M.quand && !M.quand.every(q => QUAND.has(q))) faute('cat', `${k} : un moment inconnu (${M.quand})`);
  // Aucun récit : ce qu'un dilemme affirme est son fait (la scène) ou ce que ses options font au moteur, rien d'autre.
  if (M.recit) faute('cat', `${k} : un récit (« ${M.recit.slice(0, 40)}… ») affirme ce que ni le fait ni l'effet ne disent`);
}
const titres = DILEMMES.map(([, M]) => M.titre);
exiger('chaque dilemme a son fait, sa voix et ses répliques, et aucun récit ; un calendrier ne vient qu\'en plus', !fautes.cat.length && new Set(titres).size === titres.length,
  fautes.cat.join(' · ') || `${DILEMMES.length} dilemmes, ${new Set(DILEMMES.map(([, M]) => M.fait)).size} sortes de faits`);

/* ---------- 2. les noms (le catalogue ; les faits vrais suivent en 4) ---------- */
// Un joueur au singulier, sans son nom : « un vétéran », « la recrue », « ton auxiliaire »… (une apposition « {nom}, recrue » est un nom).
const SANS_NOM = /\b(un|une|le|la|ton|ta|ce|cet|son|sa|leur|du|au) (joueur|vétéran|jeune|recrue|doyen|réserviste|auxiliaire|vedette|capitaine|nouveau venu)\b/gi;
for (const [k, M] of DILEMMES) for (const t of textes(M).slice(1)) {
  for (const x of t.matchAll(SANS_NOM)) if (!t.slice(0, x.index).endsWith('}, ')) faute('noms', `${k} : « ${x[0]} » sans nom`);
}

/* ---------- 3. le lexique, dans les deux sens ---------- */
/*
 * Un mot de stat, et les canaux qu'il dit. Une phrase qui commence par « {nom} » (ou « {nom} : ») parle du joueur
 * nommé : ses canaux à lui (`lui`), sa carte (`mutation`), ses gestes (`action`). Les autres parlent du club.
 */
const LEXIQUE = [
  { mot: /\btirs\b(?! contre)|\blancers?\b/, club: ['volume'], lui: ['lui.lancers', 'mut.lancers'] },
  { mot: /\bprécision\b/, club: ['finition'], lui: ['lui.finition', 'mut.finition'] },
  { mot: /\bpasses\b/, club: [], lui: ['lui.creation', 'mut.creation'] },
  { mot: /\bjambes\b/, club: ['energie', 'action.energieTous'], lui: ['action.energie'] },
  { mot: /\bpunitions?\b/, club: ['discipline'], lui: [] },
  { mot: /\bbuts contre\b|\bdéfense\b/, club: ['defense'], lui: ['lui.defense', 'mut.defense'] },
  { mot: /\bbuts accordés\b/, club: [], lui: ['lui.arrets'] },
  { mot: /\bblessures?\b/, club: ['blessure'], lui: ['lui.blessure'] },
  { mot: /\btrios?\b/, club: ['F'], lui: [] },
  { mot: /\bpaires?\b/, club: ['D'], lui: [] },
  { mot: /\bprend le filet\b/, club: ['action.gardienAux'], lui: [] },
  { mot: /\bmanque\b/, club: [], lui: ['action.absents'] },
  { mot: /\bmises en échec\b/, club: ['robustesse'], lui: [] },
];
const CANAUX = ['volume', 'finition', 'defense', 'discipline', 'blessure', 'energie', 'robustesse'];
const bouge = v => (Array.isArray(v) ? v.some(x => x !== 1) : typeof v === 'number' && v !== 1 && v !== 0);
/* Les canaux qu'une option bouge, et leurs valeurs (le gain d'un pari, sa perte, sa suite). */
function canauxDe(o) {
  const out = new Map(), ajoute = (k, v) => { if (!out.has(k)) out.set(k, []); out.get(k).push(v); };
  for (const e of [o, o.pari && o.pari.gagne, o.pari && o.pari.perd, o.ensuite].filter(Boolean)) {
    for (const k of [...CANAUX, 'F', 'D']) if (bouge(e[k])) ajoute(k, e[k]);
    for (const [k, v] of Object.entries(e.action || {})) if (v) ajoute(`action.${k}`, v);
  }
  for (const [k, v] of Object.entries(o.lui || {})) if (bouge(v)) ajoute(`lui.${k}`, v);
  const M = o.mutation && MUTATIONS[o.mutation];
  if (M) for (const k of ['lancers', 'finition', 'creation', 'defense', 'blessure', 'arrets']) if (bouge(M[k])) ajoute(`mut.${k}`, M[k]);
  return out;
}
const RANGS = { premier: 0, première: 0, deuxième: 1, troisième: 2, quatrième: 3 };
function lexique(k, o) {
  const bouges = canauxDe(o), dits = new Set();
  const phrases = [o.nom, o.bon, o.prix].filter(Boolean).flatMap(t => t.split(/\s;\s/));
  for (const ph of phrases) {
    const lui = /^\{noms?\}|\{nom\}\s*:/.test(ph);
    for (const L of LEXIQUE) {
      const x = ph.match(L.mot);
      if (!x) continue;
      const vises = (lui ? L.lui : L.club).filter(c => bouges.has(c));
      if (!vises.length) { faute('lex', `${k}.${o.cle} : « ${x[0]} » (${lui ? 'le joueur' : 'le club'}) ne bouge pas dans l'effet`); continue; }
      vises.forEach(c => dits.add(c));
      // Le sens : « plus de X » monte, « moins de X » descend ; « ton premier trio joue plus » monte sa glace.
      const sens = ph.match(new RegExp(`\\b(plus|moins) d(?:e |')(?:l'usure des |)${x[0]}`, 'i'));
      if (sens && !/défense/.test(x[0])) {
        const haut = sens[1].toLowerCase() === 'plus';
        if (!vises.some(c => bouges.get(c).some(v => (haut ? v > 1 : v < 1)))) faute('lex', `${k}.${o.cle} : « ${sens[0]} » va dans l'autre sens`);
      }
      if (/trios?|paires?/.test(x[0])) {
        const g = /trio/.test(x[0]) ? 'F' : 'D', joue = ph.match(/jouen?t? (plus|moins)/);
        const rangs = [...ph.matchAll(/\b(premier|première|deuxième|troisième|quatrième)\b/g)].map(r => RANGS[r[1]]);
        if (!joue || !rangs.length) { faute('lex', `${k}.${o.cle} : « ${ph} » ne dit pas quel ${g === 'F' ? 'trio' : 'paire'} joue plus ou moins`); continue; }
        const v = bouges.get(g).find(Array.isArray);
        for (const r of rangs) if (!(joue[1] === 'plus' ? v[r] > 1 : v[r] < 1)) faute('lex', `${k}.${o.cle} : « ${ph} », mais ${g}[${r}] vaut ${v[r]}`);
      }
    }
  }
  for (const c of bouges.keys()) if (!dits.has(c)) faute('lex', `${k}.${o.cle} : ${c} bouge sans qu'un mot le dise`);
}
let nOptions = 0;
for (const [k, M] of DILEMMES) for (const o of M.options) { nOptions++; if (!o.rien) lexique(k, o); else if (!/Rien ne change/.test(o.bon || '')) faute('lex', `${k}.${o.cle} : un refus dit « Rien ne change »`); }
informer('le lexique', LEXIQUE.map(L => `${String(L.mot).replace(/\\b|\//g, '').split('|')[0]} → ${[...L.club, ...L.lui].join(', ')}`).join(' · '));
exiger('chaque mot de stat d\'une option dit un canal que l\'effet bouge, dans son sens, et chaque canal bougé est dit', !fautes.lex.length, fautes.lex.join(' · ') || `${nOptions} options`);

/* ---------- 4. sur de vraies ligues : jamais sans son fait ---------- */
const coteDe = (m, you) => (m.A === you ? 'A' : 'B');
const fe = m => m.feuille || { buts: [], lancers: [], punitions: [], blessures: [], alignes: {} };
const age = p => (p.bd && p.s ? parseInt(p.s, 10) - parseInt(p.bd, 10) : 0);
/* Les recomptes, faits à part de `faitsDuClub` : chaque fait se relit dans les feuilles d'avant sa journée. */
function recompte(fait, r, V) {
  const { av, you, dans, cases } = V;
  const cote = m => coteDe(m, you), gagne = m => (m.A === you) === (m.gfA > m.gfB);
  const pour = m => (m.A === you ? m.gfA : m.gfB), contre = m => (m.A === you ? m.gfB : m.gfA);
  const der = av[av.length - 1] && av[av.length - 1].m;
  const sur = (k, f) => av.slice(-k).reduce((a, { m }) => a + f(m), 0);
  const buts = (m, p) => fe(m).buts.filter(b => b.cote === cote(m) && b.marqueur === p).length;
  const points = (m, p) => fe(m).buts.filter(b => b.cote === cote(m) && (b.marqueur === p || (b.passeurs || []).includes(p))).length;
  const recus = (m, g) => (fe(m).lancers || []).filter(l => l.cote !== cote(m) && l.gardien === g).length;
  const gardienDe = m => { const n = new Map(); for (const l of fe(m).lancers || []) if (l.cote !== cote(m) && l.gardien) n.set(l.gardien, (n.get(l.gardien) || 0) + 1); return [...n].sort((a, b) => b[1] - a[1])[0]?.[0]; };
  const suite = (k, f) => av.length >= k && av.slice(-k).every(({ m }) => f(m)) && (av.length === k || !f(av[av.length - k - 1].m));
  const habille = p => cases.F.concat(cases.D).includes(p);
  const aux = g => cases.G.some(x => x !== g && x.n === r.aux);
  switch (fait) {
    case 'gardienBattu': return der && contre(der) === r.n && r.n >= 6 && gardienDe(der) === r.joueur && aux(r.joueur);
    case 'punitionTard': return der && fe(der).punitions.some(x => x.cote === cote(der) && x.joueur === r.joueur && x.instant >= 55 && x.instant < 60);
    case 'gardienCharge': return r.n >= 4 && av.slice(-r.n).every(({ m }) => gardienDe(m) === r.joueur) && aux(r.joueur);
    case 'panneGardien': return suite(r.n, m => !gagne(m)) && sur(r.n, m => fe(m).buts.filter(b => b.cote !== cote(m) && b.gardien === r.joueur).length) === r.m && aux(r.joueur);
    case 'punitions': {
      const siens = av.filter(({ m }) => (fe(m).alignes[cote(m)] || []).includes(r.joueur)).slice(-r.m);
      return r.n >= PUNITIONS_SERMON && siens.length === r.m && siens.reduce((a, { m }) => a + fe(m).punitions.filter(x => x.cote === cote(m) && x.joueur === r.joueur).length, 0) === r.n;
    }
    case 'blesses': return r.n >= 2 && r.joueurs.length === r.n && r.joueurs.every(p => (you.injured.get(p) || 0) > 0 && dans.has(getPlayerKey(p)));
    case 'route': return suite(r.n, m => m.B === you) && r.n >= 3;
    case 'jambes': return cases.F12.includes(r.joueur) && V.jambes(r.joueur) === r.n && r.n < 82;
    case 'jambesEquipe': { const t = cases.F.concat(cases.D); return Math.round(t.reduce((a, p) => a + V.jambes(p), 0) / t.length) === r.n && r.n < 90; }
    case 'chaud': return r.m === 5 && sur(5, m => points(m, r.joueur)) === r.n && r.n >= 7;
    case 'disetteMarqueur': { const k = sur(12, m => buts(m, r.joueur)); return (r.joueur.g || 0) >= 25 && k <= 2 && r.n === (k === 0 ? 'aucun but' : k === 1 ? 'un seul but' : `${k} buts`); }
    case 'recrue': { const siens = av.filter(({ m }) => (fe(m).alignes[cote(m)] || []).includes(r.joueur)); return !!r.joueur.rk && habille(r.joueur) && !cases.F1.includes(r.joueur) && siens.length === r.n && siens.reduce((a, { m }) => a + points(m, r.joueur), 0) === r.m; }
    case 'parti': return !dans.has(getPlayerKey(r.joueur)) && !r.joueur._rappel && !(you.ecole || []).includes(r.joueur) && r.n >= 1 && av.slice(-10).filter(({ m }) => (fe(m).alignes[cote(m)] || []).includes(r.joueur) || gardienDe(m) === r.joueur).length === r.n;
    case 'quatrieme': return r.m === 10 && r.joueurs.every(p => cases.F4.includes(p)) && r.joueurs.reduce((a, p) => a + sur(10, m => points(m, p)), 0) === r.n && r.n <= 2;
    case 'passoire': return r.m === 5 && sur(5, contre) === r.n && r.n >= 17;
    case 'passoirePaire': return r.m === 5 && sur(5, contre) === r.n && r.n >= 17 && r.joueurs.length === 2 && r.joueurs.every(p => cases.D1.includes(p));
    case 'disette': return r.m === 5 && sur(5, pour) === r.n && r.n <= 8;
    case 'tirsContre': return r.m === 3 && sur(3, m => fe(m).lancers.filter(l => l.cote !== cote(m)).length) === r.n && r.n >= 105 && cases.G.every(g => sur(3, m => recus(m, g)) <= sur(3, m => recus(m, r.joueur)));
    case 'avantagesRares': return r.m === 4 && sur(4, m => fe(m).punitions.filter(x => x.cote !== cote(m)).length) === r.n && r.n <= 10;
    case 'defaiteParUn': return der && contre(der) === pour(der) + 1 && r.m === contre(der) && r.n === pour(der);
    case 'plombier': return cases.F4.includes(r.joueur) && sur(10, m => buts(m, r.joueur)) === r.n && r.n <= 1;
    case 'veteranD': return cases.D.some(p => p.n === r.vieux && age(p) === r.n) && r.n >= 33 && cases.D.every(p => age(p) <= r.n) && r.joueur === cibleMutation(you, 'dur') && r.joueur.n !== r.vieux;
    case 'tirsD': { const t = p => sur(10, m => fe(m).lancers.filter(l => l.cote === cote(m) && l.tireur === p).length); return cases.D.includes(r.joueur) && t(r.joueur) === r.n && r.n >= 15 && cases.D.every(p => t(p) <= r.n); }
    default: return false;
  }
}
const sorties = {}, vus = new Set(), vusTires = new Set();
let lectures = 0, tires = 0, partisAttendus = 0, partisVus = 0;
for (const seed of GRAINES) {
  const teams = ligue(seed), you = teams[0];
  you.isPlayer = true;
  // Une ligue sur deux, ton club réclame un joueur au ballottage après son 29e match : celui de sa case au quatrième trio est libéré.
  const depart = seed % 2 === 1;
  const L = creerLigue(teams, 82, { graine: `dilemmes-${seed}`, courbe: true });
  const jourDepart = jourEvenement(you, 29);
  const libere = depart ? you.roster[9] : null;
  if (depart) {
    const [F] = equipeReelle('1985-86', 'HFD'), entre = { ...F[11] };
    registerHiddenRatings(entre);
    connaitre(entre);
    L.decisions.push({ jour: jourDepart, equipe: 0, ballottage: { entre: getPlayerKey(entre), i: 9 } });
  }
  const N = L.calendrier.length;
  for (const J of JOURS_MOMENTS) {
    const jEv = jourEvenement(you, J);
    jouerJusqua(L, jEv);
    const miens = tes(L, you);
    const c = faitsDuClub(you, miens, jEv, N);
    const av = miens.filter(x => x.j < jEv);
    const ici = g => SLOTS.filter(s => !s.scratch && s.group === g).map(s => you.roster[s.i]).filter(Boolean);
    const unite = (g, u) => SLOTS.filter(s => !s.scratch && s.group === g && s.unit === u).map(s => you.roster[s.i]).filter(Boolean);
    const matin = ((you.jourLignes || [])[jEv] || {}).energie || {};
    const V = { av, you, dans: new Set(Object.values(you.roster).filter(Boolean).map(getPlayerKey)),
      cases: { F: ici('F'), D: ici('D'), G: ici('G'), F1: unite('F', 0), F12: [...unite('F', 0), ...unite('F', 1)], F4: unite('F', 3), D1: unite('D', 0) },
      jambes: p => Math.round(matin[getPlayerKey(p)] ?? energieDe(p)) };
    for (const [k, M] of DILEMMES) {
      const r = M.faits(c);
      lectures++;
      if (!r) continue;
      sorties[M.fait] = (sorties[M.fait] || 0) + 1;
      vus.add(k);
      if (!recompte(M.fait, r, V)) faute('faits', `${k} (${M.fait}), ligue ${seed}, journée ${jEv} : ${JSON.stringify({ ...r, joueur: r.joueur && r.joueur.n, joueurs: r.joueurs && r.joueurs.map(p => p.n) })}`);
      // Les noms : le fait nomme qui le texte nomme, et chaque {…} se remplit.
      const mut = M.options.find(o => o.mutation);
      const cible = r.joueur;
      if (mut && !r.joueur) faute('noms', `${k} : la carte change un joueur que le fait ne nomme pas`);
      for (const t of textes(M)) {
        const rempli = texteDuFait(t, r);
        if (/\{nom\}/.test(rempli) && !cible) faute('noms', `${k} : {nom} sans joueur`);
        if (/\{noms\}/.test(rempli) && !(r.joueurs && r.joueurs.length)) faute('noms', `${k} : {noms} sans joueurs`);
        const reste = rempli.replace(/\{noms?\}/g, '');
        if (/[{}]/.test(reste)) faute('noms', `${k} : « ${reste} » ne se remplit pas`);
      }
      // Chaque joueur que le fait nomme est dit dans le fait de la scène ; un joueur nommé ailleurs vient du fait ({nom}, {noms}, {aux}, {vieux}).
      const dit = FAITS[M.fait].dire(r);
      for (const nm of [r.joueur && r.joueur.n, ...(r.joueurs || []).map(p => p.n), r.vieux].filter(Boolean)) if (!dit.includes(nm)) faute('noms', `${k} : le fait nomme ${nm}, la scène non`);
      // La scène : sa voix, sa réplique sans chiffre, son fait qui porte ses nombres.
      const sc = sceneDuDilemme(k, r, `${seed}|${J}`);
      if (!Object.values(EXPEDITEURS).includes(sc.de) || !sc.mot || /\d|\{/.test(sc.mot)) faute('noms', `${k} : la scène « ${sc.mot} »`);
      for (const x of ['n', 'm'].map(z => r[z]).filter(v => typeof v === 'number')) if (!sc.fait.includes(String(x))) faute('noms', `${k} : le fait « ${sc.fait} » ne dit pas ${x}`);
      // « Les adieux au casier » : seulement s'il y a eu un départ, et c'est lui.
      if (M.fait === 'parti') {
        if (!depart || jEv <= jourDepart) faute('parti', `${k} sort sans départ (ligue ${seed}, journée ${jEv}) : ${r.joueur.n}`);
        else if (r.joueur !== libere) faute('parti', `${k} nomme ${r.joueur.n}, pas ${libere.n}`);
      }
    }
    if (depart && jEv > jourDepart && av.filter(x => x.j >= jourDepart).length <= 8) { partisAttendus++; if (FAITS.parti.lire(c)) partisVus++; }
    // Le tirage : seulement des dilemmes dont le fait est vrai ce jour-là.
    for (let g = 1; g <= 12; g++) { const cle = momentDuJour(g, J, [], c); if (cle) { tires++; vusTires.add(cle); if (!MOMENTS[cle].faits(c)) faute('faits', `${cle} tiré sans son fait`); } }
  }
}
informer('les faits vrais', Object.entries(sorties).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(' · '));
informer('jamais vrais sur ces ligues', Object.keys(FAITS).filter(f => !sorties[f]).join(', ') || 'aucun');
exiger('un dilemme ne sort jamais sans son fait, recompté dans les feuilles d\'avant sa journée', !fautes.faits.length && tires > 0,
  fautes.faits.join(' · ') || `${lectures} lectures, ${tires} tirages, ${vus.size} dilemmes vrais au moins une fois sur ${GRAINES.length} ligues`);
exiger('ses textes nomment les joueurs du fait, et chaque {…} se remplit ; jamais un joueur sans son nom', !fautes.noms.length, fautes.noms.join(' · ') || 'nommés');
exiger('« Le départ » ne sort que si un joueur a vraiment quitté ton effectif, et c\'est lui qu\'il nomme', !fautes.parti.length && partisAttendus > 0 && partisVus === partisAttendus,
  fautes.parti.join(' · ') || `${partisVus} sur ${partisAttendus} journées après un départ`);
exiger('la moitié des dilemmes au moins se rencontre sur ces ligues', vus.size >= DILEMMES.length / 2, `${vus.size} sur ${DILEMMES.length}`);

/* ---------- 5. l'écran dit ce que le moteur joue ---------- */
{
  const J0 = 10, meme = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const rang of [0, 1]) {
    const teams = ligue(GRAINES[0]), you = teams[0];
    const gardien = SLOTS.filter(s => s.group === 'G').map(s => you.roster[s.i])[0];
    const avant = SLOTS.filter(s => !s.scratch && s.group === 'F').map(s => you.roster[s.i])[0];
    const choix = DILEMMES.map(([k, M]) => [k, M, M.options[Math.min(rang, M.options.length - 1)]]).filter(([, , o]) => !o.mutation);
    const decisions = choix.map(([k, M, o]) => {
      const p = /gardien|Gardien|tirsContre/.test(M.fait) ? gardien : avant;
      return { jour: J0, equipe: 0, moment: { famille: 'moment', cle: k, choix: o.cle, joueur: null, joueurs: [getPlayerKey(p)] } };
    });
    const L = creerLigue(teams, 82, { graine: `ecran-${rang}`, decisions });
    jouerJusqua(L, J0 + 12);
    // Tes matchs à partir du jour de la décision : ce qu'une option promet sur un joueur s'y recompte.
    const apres = tes(L, you).filter(x => x.j >= J0).map(x => x.m);
    const habille = (m, p) => (fe(m).alignes[coteDe(m, you)] || []).includes(p);
    const recoit = (m, g) => (fe(m).lancers || []).some(l => l.cote !== coteDe(m, you) && l.gardien === g);
    const matchsEntre = (a, b) => L.calendrier.slice(a, b).filter(jour => jour.some(m => m.A === you || m.B === you)).length;
    for (const [k, M, o] of choix) {
      const nom = M.titre;
      const poses = (you.effets || []).filter(e => e.nom === nom && e.debut === J0);
      const base = poses.find(e => e.source === 'moment');
      const canaux = [...CANAUX, 'F', 'D'].filter(c => bouge(o[c]));
      if (canaux.length) {
        if (!base) { faute('ecran', `${k}.${o.cle} : aucun effet posé`); continue; }
        for (const c of canaux) if (!meme(base[c], o[c])) faute('ecran', `${k}.${o.cle} : ${c} ${JSON.stringify(base[c])} au moteur, ${JSON.stringify(o[c])} à l'écran`);
        if (matchsEntre(base.debut, base.fin) !== dureeOption(o, 'moment')) faute('ecran', `${k}.${o.cle} : ${matchsEntre(base.debut, base.fin)} matchs au moteur, ${dureeOption(o, 'moment')} à l'écran`);
      }
      if (o.pari) {
        const pari = (you.paris || []).find(x => x.titre === nom), e = poses.find(x => x.source === 'pari');
        const attendu = pari && (pari.gagne ? o.pari.gagne : o.pari.perd);
        const { duree: _d, action: _a, ...ch } = attendu || {};
        if (!pari || (Object.keys(ch).length && (!e || Object.entries(ch).some(([c, v]) => !meme(e[c], v))))) faute('ecran', `${k}.${o.cle} : le pari ne pose pas ce que l'écran dit`);
      }
      // « {nom} manque un match » : il n'est pas habillé ces soirs-là ; « {aux} prend le filet » : le partant ne reçoit pas un tir.
      const a = o.action || {};
      if (a.absents && apres.slice(0, a.absents).some(m => habille(m, avant))) faute('promesse', `${k}.${o.cle} : ${avant.n} devait manquer ${a.absents} match(s), il a joué`);
      if (a.gardienAux && apres.slice(0, a.gardienAux).some(m => recoit(m, gardien))) faute('promesse', `${k}.${o.cle} : ${gardien.n} devait céder le filet ${a.gardienAux} match(s), il l'a gardé`);
      if (a.absents) promesses++;
      if (a.gardienAux) promesses++;
      if (o.lui) {
        const e = (you.effetsCibles || []).find(x => x.nom === nom && x.debut === J0);
        if (!e || getPlayerKey(e.joueur) !== decisions.find(d => d.moment.cle === k).moment.joueurs[0] || Object.entries(o.lui).some(([c, v]) => e[c] !== v)) faute('ecran', `${k}.${o.cle} : ce qui va à {nom} n'est pas posé sur lui`);
      }
    }
  }
  exiger('l\'effet posé porte les canaux et la durée que l\'écran annonce ; ce qui vise le joueur nommé est posé sur lui', !fautes.ecran.length, fautes.ecran.join(' · ') || 'les deux options de chaque dilemme');
}

/* ---------- 6. ce qu'une option promet à des trios et des paires, recompté dans les feuilles d'après ---------- */
/*
 * « Ton quatrième trio joue plus », « ta première paire joue plus » : la même ligue jouée avec et sans l'option ; à
 * chacun de tes matchs qu'elle couvre, la part de glace de chaque trio (ou paire) qu'elle pousse monte dans la
 * feuille (`glace`), celle qu'elle retient descend, et rien ne bouge ailleurs. Les absences et le filet cédé se
 * recomptent en 5.
 */
{
  const J0 = 10;
  const jouer = (decisions, k = null) => {
    const teams = ligue(GRAINES[0]), you = teams[0];
    const L = creerLigue(teams, 82, { graine: `promesses-${k}`, decisions });
    jouerJusqua(L, J0 + 24);
    return tes(L, you).filter(x => x.j >= J0).map(({ m }) => fe(m).glace && fe(m).glace[coteDe(m, you)]);
  };
  for (const [k, M] of DILEMMES) for (const o of M.options) {
    if (!Array.isArray(o.F) && !Array.isArray(o.D)) continue;
    const n = dureeOption(o, 'moment');
    const sans = jouer([], k).slice(0, n), avec = jouer([{ jour: J0, equipe: 0, moment: { famille: 'moment', cle: k, choix: o.cle, joueur: null, joueurs: [] } }], k).slice(0, n);
    for (const g of ['F', 'D']) for (const [u, v] of (o[g] || []).entries()) {
      if (v === 1) continue;
      promesses++;
      const mal = avec.findIndex((x, i) => !x || !sans[i] || (v > 1 ? x[g][u] <= sans[i][g][u] : x[g][u] >= sans[i][g][u]));
      if (mal >= 0) faute('promesse', `${k}.${o.cle} : ${g === 'F' ? 'trio' : 'paire'} ${u + 1} à ×${v}, au match ${mal + 1} : ${avec[mal] && avec[mal][g][u]} de la glace contre ${sans[mal] && sans[mal][g][u]} sans l'option`);
    }
  }
  // « {nom} : plus de jambes » : le matin d'après, ses jambes sont plus hautes qu'elles ne l'auraient été sans l'option.
  for (const [k, M] of DILEMMES) for (const o of M.options) {
    if (!(o.action && o.action.energie)) continue;
    const jambes = avecOption => {
      const teams = ligue(GRAINES[0]), you = teams[0], p = SLOTS.filter(s => !s.scratch && s.group === 'F').map(s => you.roster[s.i])[0];
      const L = creerLigue(teams, 82, { graine: `jambes-${k}`, decisions: avecOption ? [{ jour: J0, equipe: 0, moment: { famille: 'moment', cle: k, choix: o.cle, joueur: null, joueurs: [getPlayerKey(p)] } }] : [] });
      jouerJusqua(L, J0 + 1);
      return energieDe(p);
    };
    const x = jambes(true), y = jambes(false);
    promesses++;
    if (o.action.energie > 0 ? x <= y : x >= y) faute('promesse', `${k}.${o.cle} : jambes ${Math.round(x)} avec l'option, ${Math.round(y)} sans`);
  }
  exiger('ce qu\'une option promet à des joueurs arrive dans les feuilles d\'après : ils manquent leurs matchs, cèdent le filet, leur trio joue plus ou moins, leurs jambes remontent', !fautes.promesse.length && promesses > 0,
    fautes.promesse.join(' · ') || `${promesses} promesses recomptées, match par match`);
}

console.log(`\n  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
verdict('Les dilemmes');
