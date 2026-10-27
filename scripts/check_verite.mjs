/*
 * LA VÉRITÉ DES CHIFFRES (refonte coachs-cartes-incidents, tranche 2 ; JP,
 * 27 oct. 2026 : *l'écran et le moteur disent des chiffres différents*).
 * Chaque affichage lit la valeur du moteur ; un test par accroc :
 *
 *   1. LA GRAINE COMPTE pour les tirages purs (dilemmes, situations,
 *      objectifs, ajustements) : une graine en base 36 valait 0 par
 *      `Number(graine)`, et toutes les runs tiraient pareil.
 *   2. LE COACH : le choix d'un coach compte ses ADJOINTS (plus « N cartes
 *      de sa couleur ») ; l'infobulle d'un joueur de couleur dit le vrai
 *      multiplicateur (`JOUEUR_COACH`, `PALIERS_COACH_MAX`) ; « Tes cartes
 *      jouées » ne se promet plus ; `COACHS[].recrute` nomme les rôles que
 *      `COACH_DU_ROLE` lui donne vraiment.
 *   3. LA PITIÉ : « au plus tard au N+1e pack » et le moteur garantit le
 *      N+1e, pas le Ne.
 *   4. LES MATCHS, PAS LES JOURNÉES : les paliers du personnel et la main du
 *      deck se comptent en matchs du club, et l'écran le dit.
 *   5. LE PLAFOND EFFECTIF : la jauge, la phrase du budget et le bilan lisent
 *      `plafondDeJauge`, jamais `MODE().cap` seul (le Rogue tord le plafond).
 *
 *   node scripts/check_verite.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, informer, verdict } from './verdict.mjs';
import { chainesDe } from './lib/chaines.mjs';
import { entierDeGraine, momentDuJour, objectifsOfferts, ajustementsOfferts, situationsDuJour, JOURS_MOMENTS, JOURS_SITUATIONS, PALIERS_CARTES, PROFILS,
  autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, faitsDuClub, jourEvenement } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { COACHS, COACH_DU_ROLE, JOUEUR_COACH, PALIERS_COACH_MAX } from '../js/coachs.js';
import { PITIE, packsSansHolo } from '../js/packs.js';
import { PALIERS_PACK } from '../js/inventaire.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const prose = f => chainesDe(lire(`js/${f}`));

/* Une ligue de vrais clubs, comme check_dilemmes la bâtit. */
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
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

/* ---------- 1. la graine compte ---------- */
{
  const a = 'k7q2z9', b = 'm3x8p1';   // deux graines comme `nouvelleGraine` les fait (base 36) : Number() en faisait 0
  exiger('une graine en base 36 n\'est pas 0', entierDeGraine(a) !== 0 && entierDeGraine(b) !== 0 && entierDeGraine(a) !== entierDeGraine(b), `${entierDeGraine(a)} · ${entierDeGraine(b)} (Number : ${Number(a) >>> 0})`);
  exiger('la même graine donne le même entier, en chaîne ou en nombre', entierDeGraine(12345) === entierDeGraine('12345') && entierDeGraine(`${a}:q`) !== entierDeGraine(a));
  // Une vraie ligue, ses faits à chaque journée de dilemme : les deux graines tirent parmi les mêmes dilemmes vrais.
  const teams = ligue(7), you = teams[0];
  you.isPlayer = true;
  const L = creerLigue(teams, 82, { graine: 'verite-7', courbe: true });
  const N = L.calendrier.length, tirages = { [a]: [], [b]: [], [`${a}`]: [] }, encore = [];
  for (const J of JOURS_MOMENTS) {
    const jEv = jourEvenement(you, J);
    jouerJusqua(L, jEv);
    const c = faitsDuClub(you, tes(L, you), jEv, N);
    for (const g of [a, b]) tirages[g].push(momentDuJour(g, J, [], c) || '');
    encore.push(momentDuJour(a, J, [], c) || '');
  }
  exiger('deux graines, deux calendriers de dilemmes', tirages[a].some((k, i) => k !== tirages[b][i]) && tirages[a].filter(Boolean).length >= 3, `${tirages[a].join(' ')} / ${tirages[b].join(' ')}`);
  exiger('la même graine rejoue les mêmes dilemmes', tirages[a].join() === encore.join());
  const oa = objectifsOfferts(a, 0).join(), ob = objectifsOfferts(b, 0).join();
  exiger('deux graines, deux offres du proprio', oa !== ob, `${oa} / ${ob}`);
  const sa = situationsDuJour(you, a, JOURS_SITUATIONS[0], 0), sb = situationsDuJour(you, b, JOURS_SITUATIONS[0], 0);
  const cle = x => (x ? `${x.porte && x.porte.p ? x.porte.p.n : ''}|${x.pese && x.pese.p ? x.pese.p.n : ''}|${x.nom || x.cle || ''}` : '');
  exiger('deux graines, deux situations du vestiaire', !!sa && !!sb && JSON.stringify(sa) !== JSON.stringify(sb), `${cle(sa)} / ${cle(sb)}`);
  exiger('deux graines, deux ajustements offerts', ajustementsOfferts(a, 0, 0, 'egal').join() !== ajustementsOfferts(b, 0, 0, 'egal').join());
}

/* ---------- 2. le coach ---------- */
{
  const rj = prose('rogue-jeu.js'), g = prose('game.js'), sa = prose('saison.js');
  exiger('le choix d\'un coach compte ses adjoints', rj.some(s => /adjoints de sa couleur/.test(s)) && !rj.some(s => /cartes de sa couleur/.test(s)));
  const bulle = lire('js/game.js').split('\n').find(l => /porte la confiance de ce coach/.test(l)) || '';
  exiger('l\'infobulle du joueur de couleur dit le multiplicateur du moteur', /par métal de son badge/.test(bulle) && /\$\{PALIERS_COACH_MAX\}/.test(bulle) && /\$\{Math.round\(JOUEUR_COACH \* 100\)\}/.test(bulle) && !/fait grandir/.test(bulle),
    `JOUEUR_COACH ${JOUEUR_COACH}, jusqu'à ${PALIERS_COACH_MAX} paliers`);
  exiger('« tes cartes jouées » ne se promet plus', !sa.some(s => /cartes jouées viennent ici/.test(s)) && !g.some(s => /cartes de sa couleur/.test(s)));
  // `recrute` : ce que le dépisteur recrute vraiment, c'est la couleur du coach (`recrue`, js/packs.js), lue sur
  // COACH_DU_ROLE. Le texte nomme chacun de ces rôles.
  const MOT = { sniper: 'sniper', passeur: 'passeur', deuxsens: 'two-way', power: 'power forward', checker: 'checker', energie: 'plombier', bagarreur: 'bagarreur',
    defensif: 'défenseurs défensifs', offensif: 'défenseurs offensifs', manieur: 'manieur', physique: 'défenseurs physiques' };
  const mal = [];
  for (const [g2, roles] of Object.entries(COACH_DU_ROLE)) for (const [role, coach] of Object.entries(roles)) {
    if (!(COACHS[coach].recrute || '').toLowerCase().includes(MOT[role])) mal.push(`${coach} ne dit pas « ${MOT[role]} » (${g2} ${role}) : « ${COACHS[coach].recrute} »`);
  }
  exiger('« Son dépisteur recrute… » nomme les rôles de sa couleur', mal.length === 0, mal.join(' · ') || `${Object.values(COACH_DU_ROLE).reduce((n, r) => n + Object.keys(r).length, 0)} rôles nommés`);
  exiger('les rôles de COACH_DU_ROLE existent', Object.entries(COACH_DU_ROLE).every(([g2, roles]) => Object.keys(roles).every(r => PROFILS[g2][r])));
}

/* ---------- 3. la pitié ---------- */
{
  const achats = n => Array.from({ length: n }, (_, i) => ({ achat: { sorte: 'joueurs', n: i + 1, meilleure: 'commune' } }));
  exiger('PITIE packs sans Or ni Holo se comptent PITIE', packsSansHolo(achats(PITIE)) === PITIE && packsSansHolo([...achats(3), { achat: { sorte: 'joueurs', n: 4, meilleure: 'rare' } }]) === 0);
  const m = prose('magasin.js').find(s => /au plus tard au/.test(s)) || '';
  exiger('la boutique promet le PITIE + 1e pack', /PITIE \+ 1/.test(lire('js/magasin.js').split('au plus tard au')[1].slice(0, 20)), m.slice(0, 60));
  exiger('le moteur garantit au PITIE + 1e (packsSansHolo >= PITIE)', /packsSansHolo\(decs\) >= PITIE\b/.test(lire('js/rogue-jeu.js')));
}

/* ---------- 4. les matchs, pas les journées ---------- */
{
  const sa = lire('js/saison.js');
  exiger('les paliers de la saison se comptent en matchs du club (jEv)', /PALIERS_CARTES\.find\(j => jour >= jEv\(j\)/.test(sa), `main aux ${PALIERS_CARTES.join(', ')}e matchs, adjoints aux ${PALIERS_PACK.join(', ')}e`);
  const inv = prose('inventaire.js');
  exiger('la main du deck se dit « du Ne match », pas « de la journée »', inv.some(s => /^Main du $/.test(s)) && !inv.some(s => /Main de la journée/.test(s)));
  const html = lire('index.html').replace(/<!--[\s\S]*?-->/g, '');
  exiger('les règles disent les paliers en matchs', new RegExp(`${PALIERS_CARTES[0]}e, ${PALIERS_CARTES[1]}e et ${PALIERS_CARTES[2]}e matchs`).test(html) && new RegExp(`${PALIERS_PACK[0]}e, ${PALIERS_PACK[1]}e et ${PALIERS_PACK[2]}e matchs`).test(html));
}

/* ---------- 5. le plafond effectif ---------- */
{
  const rep = lire('js/repechage.js'), g = lire('js/game.js');
  const fautes = [];
  for (const [f, src] of [['repechage.js', rep], ['game.js', g]]) {
    src.split('\n').forEach((l, k) => { if (/money\(MODE\(\)\.cap\)/.test(l) && !/de base, tordu/.test(l)) fautes.push(`${f}:${k + 1}`); });
  }
  exiger('la jauge, le budget et le bilan lisent plafondDeJauge, pas MODE().cap', fautes.length === 0 && /capMax: \(\) => plafondDeJauge\(\)/.test(g), fautes.join(' · ') || 'plafondDeJauge partout');
}

verdict('La vérité des chiffres');
