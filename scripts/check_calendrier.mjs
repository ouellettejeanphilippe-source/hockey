/*
 * LE VRAI CALENDRIER (1.0, oct.). JP : *espacer les matchs avec des jours
 * entre, vrai calendrier, ce qui te permettrait de slotter les événements
 * hors des jours de matchs*. Ce qu'on exige :
 *   1. la cédule : 82 matchs par club, jamais deux le même jour, environ
 *      186 jours, des écarts de 1 à 5 jours et des dos-à-dos comme la LNH ;
 *   2. une durée dite en matchs (« 6 matchs ») couvre exactement six matchs
 *      du club, congés ou pas ;
 *   3. un événement daté par un numéro de match tombe la veille de ce match
 *      quand c'est un congé, le jour même après un dos-à-dos ;
 *   4. le soir éreintant est un dos-à-dos, et rien d'autre.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, effetsEnCours, matchsEntre, jourEvenement,
  soirEreintant, dosADos, JOURS_SITUATIONS } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { crochetDesActes, joursDe, echangeables, echangerTesCases, brouillon, renfortsDe, ACTES, acteDe } from '../js/actes.js';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
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

console.log('\n  LE VRAI CALENDRIER\n');

// 1. La cédule.
const teams = ligue(31);
const L = creerLigue(teams, 82, { graine: 'calendrier', decisions: [
  // Un effet de quatre matchs posé au jour 0 chez le club 0, pour la durée (2).
  { jour: 0, equipe: 0, effet: { duree: 4, nom: 'Quatre matchs', finition: 1.04 } },
] });
const ecarts = {};
let doublons = 0, dosAdos = 0;
for (const t of teams) {
  if (new Set(t._jours).size !== t._jours.length) doublons++;
  for (let i = 1; i < t._jours.length; i++) {
    const g = t._jours[i] - t._jours[i - 1];
    ecarts[g] = (ecarts[g] || 0) + 1;
    if (g === 1) dosAdos++;
  }
}
informer('écarts entre deux matchs', Object.entries(ecarts).map(([g, n]) => `${g} j : ${n}`).join(' · '));
exiger('82 matchs pour chaque club', teams.every(t => t._jours.length === 82), teams.map(t => t._jours.length).filter(n => n !== 82).join(',') || '82');
exiger('jamais deux matchs le même jour', doublons === 0, `${doublons} club(s)`);
borne('jours de la saison', L.calendrier.length, 180, 192);
exiger('des écarts de 1 à 5 jours', Object.keys(ecarts).every(g => g >= 1 && g <= 5), Object.keys(ecarts).join(', '));
borne('dos-à-dos par club', dosAdos / teams.length, 10, 22);

// 2. Une durée en matchs : un effet de 4 matchs, posé au jour 0.
const t0 = teams[0];
jouerJusqua(L, 1);
const fx = effetsEnCours(t0, 0).effets.find(e => e.nom === 'Quatre matchs');
exiger('l\'effet se lit en matchs restants', fx && fx.reste === 4, fx ? `${fx.reste} match(s)` : 'absent');
exiger('ses quatre matchs sont les quatre premiers du club', fx && matchsEntre(t0, fx.debut, fx.fin) === 4 && fx.fin === t0._jours[3] + 1,
  fx ? `du jour ${fx.debut} au jour ${fx.fin} : ${matchsEntre(t0, fx.debut, fx.fin)} matchs` : '');

// 3. Les événements, datés en matchs, tombent un jour de congé quand il y en a un.
let conges = 0, possibles = 0, faux = 0;
for (const t of teams) for (const k of JOURS_SITUATIONS) {
  const j = jourEvenement(t, k), m = t._jours[k];
  const congeAvant = m > 0 && !t._jours.includes(m - 1);
  if (congeAvant) { possibles++; if (j === m - 1) conges++; else faux++; } else if (j !== m) faux++;
}
exiger('chaque événement tombe la veille de son match si c\'est un congé, sinon le jour même', faux === 0, `${conges} la veille sur ${possibles} possibles`);

// 4. Le soir éreintant est un dos-à-dos.
let ecartesSoir = 0, soirs = 0, total = 0;
for (let d = 0; d < L.calendrier.length; d++) for (const m of L.calendrier[d]) {
  total++;
  const e = soirEreintant(d, m.A, m.B);
  if (e) soirs++;
  if (e !== (dosADos(m.A, d) || dosADos(m.B, d))) ecartesSoir++;
}
exiger('le soir éreintant est un dos-à-dos d\'un des deux clubs', ecartesSoir === 0, `${soirs} soirs sur ${total} matchs (${Math.round(100 * soirs / total)} %)`);

/*
 * LE CALENDRIER NE PROMET QUE CE QUI EST SÛR (V2.2 ; V27, tranche 4, docs/refonte-v27-4.md). Le Calendrier est la saison en
 * cases, un acte à la fois (`saisonEnCases`, js/saison.js), faite de la case de match (`caseDeMatch`) : jouée, son score ; à
 * venir, seulement ce qui est écrit — le rival (posé à la création), le marché (ses nœuds fixes), le renfort (décidé). Aucun
 * événement ni situation à venir ; la route des trois billets et les semaines de sept journées sont parties. Les marques de
 * la grille d'avant reviennent (JP, 8 nov. 2026 ; `marquesDesCases`) : le proprio à ses dates fixes et son verdict, les
 * accidents seulement passés ; la carte à prendre n'a plus de source.
 */
{
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js', 'saison.js'), 'utf8').replace(/\r\n/g, '\n');
  const bloc = (src.match(/const caseDuMatch = [\s\S]*?\n  \};/) || [''])[0];
  exiger('le Calendrier est la saison en cases, faite de la case de match ; la route et les semaines sont parties', /const saisonEnCases = /.test(src) && /caseDeMatch\(/.test(bloc) && !/routeDeuxSemaines|calendrierFiche|marquesDeSaison/.test(src));
  exiger('une case ne dit que ce qui est sûr : le score joué, le rival, le marché, le renfort', /rivaux/.test(bloc) && /NOEUDS_BOUTIQUE/.test(bloc) && /renfortHtml/.test(bloc) && !/situations|JOURS_|PALIERS_/.test(bloc));
  const marques = (src.match(/const marquesDesCases = [\s\S]*?\n  \};/) || [''])[0];
  exiger('ses marques ne disent que ce qui est sûr : le proprio à ses dates fixes, l\'accident une fois passé, jamais une situation', /caseDuMatch\(k, js\[k\], [^)]*\bM\b/.test(src) && /marques: M\.get\(k \+ 1\)/.test(bloc)
    && /JOURS_OBJECTIFS/.test(marques) && /MATCHS_OBJECTIF/.test(marques) && /x\.jour <= jour && MUTATIONS\[x\.cle\]/.test(marques) && !/situations|PALIERS_|possible/.test(marques));
}

/*
 * LA CÉDULE PLACÉE (V27, tranche 4) : sur une vraie ligue en actes, quarante échanges de suite, chacun pris parmi ceux que
 * l'écran propose (`echangeables`) : chaque club garde 82 matchs, jamais deux le même jour ; le match d'un rival ne bouge
 * jamais ; aucun échange ne touche un match joué ni ne sort de l'acte et des suivants ; un club ramené à sa case d'origine
 * n'a plus de renfort.
 */
{
  const ts = ligue(57); ts[0].isPlayer = true;
  const P = creerLigue(ts, 82, { graine: 'placee', placer: crochetDesActes() });
  const toi = ts[0], B = brouillon(P), jours = joursDe(B.calendrier, toi), rivaux = P.rivaux.map(R => `${R.jour}:${R.adv.name}`).join();
  const advAu = j => { const m = B.calendrier[j].find(x => x.A === toi || x.B === toi); return m.A === toi ? m.B : m.A; };
  let faits = 0, horsActe = 0;
  for (let i = 0; i < 40; i++) {
    const k = (i * 7) % ACTES[0], q = echangeables(B, k, 0)[(i * 3) % Math.max(1, echangeables(B, k, 0).length)];
    if (q == null) continue;
    if (acteDe(k) !== 0 && acteDe(q) !== 0) horsActe++;
    if (echangerTesCases(B, k, q, 0)) faits++;
  }
  const nb = new Map(); let doubles = 0;
  for (const jr of B.calendrier) { const vus = new Set(); for (const m of jr) for (const t of [m.A, m.B]) { if (vus.has(t)) doubles++; vus.add(t); nb.set(t, (nb.get(t) || 0) + 1); } }
  exiger('quarante échanges de l\'écran : 82 matchs à chaque club, jamais deux le même jour', faits >= 20 && !doubles && [...nb.values()].every(n => n === 82) && nb.size === ts.length, `${faits} échanges faits, ${doubles} doublé`);
  exiger('le match d\'un rival ne bouge jamais, et l\'une des deux cases est dans l\'acte', P.rivaux.map(R => `${R.jour}:${advAu(R.jour).name}`).join() === rivaux && !horsActe && !echangeables(B, ACTES[0] - 1, 0).length);
  exiger('un match joué ne se place plus', !echangeables(B, 3, 5).length && echangeables(B, 5, 5).every(q => q >= 5));
  const C = brouillon(P), k0 = jours.findIndex((j, k) => k < ACTES[0] && echangeables(C, k, 0).some(q => acteDe(q) === 2)), q0 = echangeables(C, k0, 0).find(q => acteDe(q) === 2);
  echangerTesCases(C, k0, q0, 0);
  const n1 = [...renfortsDe(C).values()].reduce((s, n) => s + n, 0);
  echangerTesCases(C, k0, q0, 0);
  exiger('reculé de l\'acte I à l\'acte III, un club porte deux étapes au moins (une de plus s\'il passe aussi un nœud du milieu) ; ramené, plus rien', n1 >= 2 && renfortsDe(C).size === 0, `+${n1} puis ${renfortsDe(C).size} club renforcé`);
}

verdict();
