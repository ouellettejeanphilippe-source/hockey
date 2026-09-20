/*
 * La même graine rejoue-t-elle la même saison ?
 *
 * Tout le hasard du moteur passe par `hasard()` (js/sim.js), et
 * `simulateLeague` tire ou reçoit une graine. Ce script bâtit une ligue de
 * 32 vraies équipes, la joue deux fois sur la même graine et exige des
 * classements, des fiches et des feuilles IDENTIQUES ; puis une troisième
 * fois sur une autre graine et exige qu'elle diffère. C'est le test qui
 * protège « Rejouer la saison », le défi du jour et tout test reproductible :
 * un `Math.random` glissé dans le moteur le fait échouer.
 *
 *   node scripts/check_graine.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, simulateLeague, playSeries,
         generateur, photoAlignement, CARTES, SITUATIONS, JOURS_SITUATIONS, PLANS, ROULEMENTS } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const saisons = fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort();

// Le choix des équipes est lui-même graine, pour que le script soit stable.
const choix = generateur('check_graine');
const vestiaires = [];
const vus = new Set();
while (vestiaires.length < 32) {
  const f = saisons[Math.floor(choix() * saisons.length)];
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const tags = [...new Set(shard.players.map(p => p.t))];
  const tag = tags[Math.floor(choix() * tags.length)];
  const cle = `${shard.season}|${tag}`;
  if (vus.has(cle)) continue;
  let unites;
  try { unites = equipeReelle(shard.season, tag); } catch { continue; }
  if (unites[0].length < 12 || unites[1].length < 6 || !unites[2].length) continue;
  vus.add(cle);
  vestiaires.push({ tag, season: shard.season, pool: unites.flat() });
}

/*
 * `decider(equipes)` rend la liste des décisions en saison (voir
 * `simulateLeague`) : l'alignement de la première équipe change au jour dit.
 * Sans décision, la saison est celle du repêchage, comme avant.
 */
function jouer(graine, decider = null, opts = {}) {
  const equipes = vestiaires.map(v => {
    const pool = v.pool.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    return createTeam(`${v.tag} ${v.season}`, v.tag, autoRoster(pool), { season: v.season });
  });
  const decisions = decider ? decider(equipes) : [];
  const ligue = simulateLeague(equipes, 82, { graine, decisions, ...opts });
  // Les séries continuent la même suite : elles doivent se rejouer aussi.
  const [A, B] = ligue.standings;
  const serie = playSeries(A, B, true);
  const feuilles = ligue.calendrier.flat().map(m => `${m.A.name}|${m.B.name}|${m.gfA}-${m.gfB}${m.ot ? 'p' : ''}`).join('\n');
  const fiches = ligue.standings.map(t => `${t.name} ${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`).join('\n');
  const joueurs = ligue.standings.flatMap(t => SLOTS.map(s => t.roster[s.i]).filter(Boolean)
    .map(p => `${p.n} ${p.simGP} ${p.simG} ${p.simA} ${p.simPM} ${p.simSV || 0}`)).join('\n');
  const serieTexte = `${serie.wA}-${serie.wB} ` + serie.feuilles.map(f => `${f.buts.filter(b => b.cote === 'A').length}-${f.buts.filter(b => b.cote === 'B').length}`).join(' ');
  const jours = ligue.calendrier.map(j => j.map(m => `${m.A.name}|${m.B.name}|${m.gfA}-${m.gfB}${m.ot ? 'p' : ''}`).join(';'));
  // Les paires vécues, pour vérifier qu'elles se tirent à l'identique.
  const situations = ligue.standings.flatMap(t => (t.situations || [])
    .map(f => `${t.name}@${f.jour}:${f.porte.cle}/${f.porte.p.n}+${f.pese.cle}/${f.pese.p.n}`)).sort().join('|');
  return { graine: ligue.graine, feuilles, fiches, joueurs, serie: serieTexte, jours, equipes, situations };
}

/* Une décision au jour J : les deux ailiers gauches du 1er et du 4e trio de la
   première équipe échangent leur case. Le talent change de trio, rien d'autre. */
const JOUR_DECISION = 40;
const permuter = equipes => {
  const t = equipes[0];
  const ag = i => SLOTS.find(s => s.group === 'F' && s.unit === i && s.role === 'AG' && !s.scratch).i;
  const cases = photoAlignement(t.roster);
  [cases[ag(0)], cases[ag(3)]] = [cases[ag(3)], cases[ag(0)]];
  return [{ jour: 0, cases: photoAlignement(t.roster) }, { jour: JOUR_DECISION, cases }];
};
/* La décision vide : l'alignement de départ, réappliqué au jour 0. */
const rien = equipes => [{ jour: 0, cases: photoAlignement(equipes[0].roster) }];

let echecs = 0;
const dire = (ok, quoi) => { console.log(`${ok ? '  ok ' : 'ÉCHEC'} ${quoi}`); if (!ok) echecs++; };

const a = jouer('la-meme-graine');
const b = jouer('la-meme-graine');
const c = jouer('une-autre-graine');
const d = jouer();   // sans graine : le moteur en tire une et la rend

dire(a.graine === 'la-meme-graine', `la saison porte sa graine (${a.graine})`);
dire(a.fiches === b.fiches, 'même graine, mêmes fiches de 32 équipes');
dire(a.feuilles === b.feuilles, 'même graine, mêmes 1312 pointages');
dire(a.joueurs === b.joueurs, 'même graine, mêmes fiches de joueurs');
dire(a.serie === b.serie, `même graine, même série (${a.serie})`);
dire(a.feuilles !== c.feuilles, 'autre graine, autre saison');
dire(typeof d.graine === 'string' && d.graine.length > 0, `sans graine, le moteur en rend une (${d.graine})`);
const e = jouer(d.graine);
dire(e.fiches === d.fiches, 'la graine rendue rejoue la saison tirée sans graine');

/* ---------- les décisions en saison ---------- */
const f0 = jouer('la-meme-graine', rien);
dire(f0.feuilles === a.feuilles && f0.joueurs === a.joueurs, 'réappliquer l\'alignement de départ ne change rien');
const f1 = jouer('la-meme-graine', permuter);
const f2 = jouer('la-meme-graine', permuter);
const avant = a.jours.slice(0, JOUR_DECISION).join('\n') === f1.jours.slice(0, JOUR_DECISION).join('\n');
const apres = a.jours.slice(JOUR_DECISION).join('\n') !== f1.jours.slice(JOUR_DECISION).join('\n');
dire(avant, `une décision au jour ${JOUR_DECISION} laisse les ${JOUR_DECISION} journées d'avant identiques`);
dire(apres, `et change ce qui suit (${f1.equipes[0].name} : ${a.fiches.split('\n').find(x => x.startsWith(f1.equipes[0].name))} → ${f1.fiches.split('\n').find(x => x.startsWith(f1.equipes[0].name))})`);
dire(f1.feuilles === f2.feuilles && f1.joueurs === f2.joueurs, 'les mêmes décisions se rejouent à l\'identique');
const ag0 = SLOTS.find(s => s.group === 'F' && s.unit === 0 && s.role === 'AG' && !s.scratch).i;
dire(f1.equipes[0].roster[ag0] !== a.equipes[0].roster[ag0] || f1.equipes[0].roster[ag0].n !== a.equipes[0].roster[ag0].n,
  `l'alignement final porte la décision (${f1.equipes[0].roster[ag0].n} au 1er trio)`);

/* ---------- les cartes de saison ---------- */
/*
 * UNE CARTE EST UNE DÉCISION, donc elle doit se comporter comme telle : les
 * journées d'avant identiques, la suite changée, et la même carte rejouée à
 * l'identique. Et elle doit VRAIMENT faire quelque chose — une carte qui ne
 * déplace pas une feuille est une carte morte, et c'est exactement le genre
 * de chose qu'on ne voit pas à l'oeil.
 */
const JOUR_CARTE = 20;
const carte = cle => () => [{ jour: JOUR_CARTE, carte: cle }];
const g1 = jouer('la-meme-graine', carte('bloc'));
const g2 = jouer('la-meme-graine', carte('bloc'));
dire(a.jours.slice(0, JOUR_CARTE).join('\n') === g1.jours.slice(0, JOUR_CARTE).join('\n'),
  `une carte au jour ${JOUR_CARTE} laisse les ${JOUR_CARTE} journées d'avant identiques`);
dire(a.jours.slice(JOUR_CARTE).join('\n') !== g1.jours.slice(JOUR_CARTE).join('\n'), 'et change ce qui suit');
dire(g1.feuilles === g2.feuilles && g1.joueurs === g2.joueurs, 'la même carte se rejoue à l\'identique');
// Chaque carte du jeu doit déplacer la saison : aucune n'est décorative.
const mortes = Object.keys(CARTES).filter(cle => jouer('la-meme-graine', carte(cle)).feuilles === a.feuilles);
dire(!mortes.length, mortes.length ? `cartes sans effet : ${mortes.join(', ')}` : `les ${Object.keys(CARTES).length} cartes déplacent la saison`);

/* ---------- le plan de match et le roulement ---------- */
/*
 * DEUX DÉCISIONS QUI VALENT TOUTE LA SAISON (S60), donc deux décisions qui
 * doivent se comporter comme les autres : l'avant intact, la suite changée,
 * la reprise identique. Et chacune doit VRAIMENT déplacer la saison — un plan
 * décoratif est pire qu'un plan déséquilibré, puisque le joueur le choisit et
 * ne voit jamais la différence.
 */
const JOUR_PLAN = 20;
const reglage = (champ, cle) => () => [{ jour: JOUR_PLAN, [champ]: cle }];
const p1 = jouer('la-meme-graine', reglage('plan', 'echec'));
const p2 = jouer('la-meme-graine', reglage('plan', 'echec'));
dire(a.jours.slice(0, JOUR_PLAN).join('\n') === p1.jours.slice(0, JOUR_PLAN).join('\n'),
  `un plan au jour ${JOUR_PLAN} laisse les ${JOUR_PLAN} journées d'avant identiques`);
dire(a.jours.slice(JOUR_PLAN).join('\n') !== p1.jours.slice(JOUR_PLAN).join('\n'), 'et change ce qui suit');
dire(p1.feuilles === p2.feuilles && p1.joueurs === p2.joueurs, 'le même plan se rejoue à l\'identique');
const plansMorts = Object.keys(PLANS).filter(cle => cle !== 'equilibre'
  && jouer('la-meme-graine', reglage('plan', cle)).feuilles === a.feuilles);
dire(!plansMorts.length, plansMorts.length ? `plans sans effet : ${plansMorts.join(', ')}`
  : `les ${Object.keys(PLANS).length - 1} plans déplacent la saison`);
const roulMorts = Object.keys(ROULEMENTS).filter(cle => cle !== 'quatre'
  && jouer('la-meme-graine', reglage('roulement', cle)).feuilles === a.feuilles);
dire(!roulMorts.length, roulMorts.length ? `roulements sans effet : ${roulMorts.join(', ')}`
  : `les ${Object.keys(ROULEMENTS).length - 1} roulements déplacent la saison`);

/*
 * LES SITUATIONS SE REJOUENT, ET ELLES NE CONSOMMENT AUCUN HASARD.
 *
 * Ce sont les deux moitiés du contrat, et la seconde est la plus fragile :
 * une situation se tire de la graine et de la journée (`mainDeCartes` fait
 * pareil pour les cartes), donc elle NE DOIT PAS appeler `hasard()`. Si elle
 * le faisait, poser une paire au jour 10 décalerait toute la suite du
 * générateur et une décision prise au jour 40 ne laisserait plus les 40
 * journées d'avant intactes — le rail de « Derrière le banc » tomberait avec.
 *
 * On le vérifie par le bout qui ne ment pas : la MÊME saison jouée avec et
 * sans situations doit différer (elles agissent), mais une saison jouée avec
 * situations doit être rejouable à l'identique, et les paires elles-mêmes
 * doivent être les mêmes des deux côtés.
 */
const sansSitu = jouer('la-meme-graine', null, { situations: false });
dire(sansSitu.feuilles !== a.feuilles, 'les situations déplacent la saison');
const s1 = jouer('les-situations');
const s2 = jouer('les-situations');
dire(s1.feuilles === s2.feuilles && s1.joueurs === s2.joueurs, 'une saison avec situations se rejoue à l\'identique');
dire(s1.situations === s2.situations && !!s1.situations,
  `les mêmes paires se tirent : ${(s1.situations || '').split('|')[0] || '—'}`);
/*
 * ET LA DÉCISION AU JOUR K LAISSE L'AVANT INTACT, situations comprises. C'est
 * l'assertion qui attraperait un `hasard()` glissé dans le tirage d'une paire.
 */
const apresCarte = jouer('la-meme-graine', carte('bloc'));
dire(apresCarte.jours.slice(0, JOUR_CARTE).join('\n') === a.jours.slice(0, JOUR_CARTE).join('\n'),
  `avec les situations, une décision au jour ${JOUR_CARTE} laisse l'avant byte-identique`);
dire(JOURS_SITUATIONS.some(j => j < JOUR_CARTE),
  `au moins une fenêtre (${JOURS_SITUATIONS.join(', ')}) tombe avant le jour ${JOUR_CARTE} : l'assertion ci-dessus mord`);
// Chaque situation doit déplacer la saison : aucune n'est décorative.
const situMortes = Object.keys(SITUATIONS).filter(cle => {
  const garde = { ...SITUATIONS };
  for (const k of Object.keys(SITUATIONS)) delete SITUATIONS[k];
  SITUATIONS[cle] = garde[cle];
  SITUATIONS[garde[cle].sens > 0 ? '_p' : '_g'] = { nom: '—', ico: '·', sens: -garde[cle].sens };
  const r = jouer('la-meme-graine').feuilles;
  for (const k of Object.keys(SITUATIONS)) delete SITUATIONS[k];
  Object.assign(SITUATIONS, garde);
  return r === sansSitu.feuilles;
});
dire(!situMortes.length, situMortes.length ? `situations sans effet : ${situMortes.join(', ')}`
  : `les ${Object.keys(SITUATIONS).length} situations déplacent la saison`);

console.log(echecs ? `\n${echecs} échec(s)` : '\ntout se rejoue');
process.exit(echecs ? 1 : 0);
