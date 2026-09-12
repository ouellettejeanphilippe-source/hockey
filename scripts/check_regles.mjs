/*
 * LES RÈGLES DU PLATEAU TIENNENT-ELLES ?
 *
 * JP : *faire que tout le déroulement du match arcade marche, genre, que tout
 * soit logique, avec règles claires, complètes*.
 *
 * `check_table.mjs` mesure si le jeu est BON (les buts, le rythme, la
 * parité). Celui-ci vérifie s'il est COHÉRENT : à chaque présence de chaque
 * match, l'état du plateau doit respecter des règles qu'on peut écrire en
 * une ligne chacune. Une seule violation et le joueur voit quelque chose
 * d'impossible — deux pièces dans la même case, une rondelle que personne ne
 * peut aller chercher, un match nul dans un tournoi à élimination.
 *
 * C'est l'équivalent, pour le plateau, des égalités de la feuille de match
 * du moteur par événements : par construction, jamais par un rattrapage.
 *
 *   node scripts/check_regles.mjs
 *   MATCHS=500 node scripts/check_regles.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings } from '../js/sim.js';
import {
  COLS, RANGS, RANG_MIN, RANG_MAX, BUT_COL, PERIODES, PRESENCES_PAR_PERIODE, PRESENCES_PROLONGATION,
  equipeDeTable, nouveauMatch, iaPresence, resultatDe, surLaGlace, porteur, libre, eqDe,
  statsDeTable, uniteDe, changerUnite, souffleDe, peutJouer, deplacementsDe, ciblesEchecDe,
  reglesDuPlateau,
} from '../js/table.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MATCHS = Number(process.env.MATCHS ?? 250);

/* ---------- de vraies équipes ---------- */
const clubs = [];
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(x => x.endsWith('.json')).sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8'));
  const parEquipe = {};
  for (const p of shard.players) (parEquipe[p.t] = parEquipe[p.t] || []).push(p);
  for (const [t, ps] of Object.entries(parEquipe)) {
    if (ps.length < 20) continue;
    const pool = ps.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    const roster = autoRoster(pool);
    if (Object.keys(roster).length < 20) continue;
    clubs.push({ nom: `${t} ${shard.season}`, tag: t, roster });
  }
}

/* ======================================================================
   LES RÈGLES, une par fonction, chacune énonçable en une phrase.
   ====================================================================== */
const REGLES = [
  ['cinq patineurs et un gardien par équipe', m => {
    for (const cote of ['A', 'B']) {
      const eq = eqDe(m, cote);
      if (eq.pieces.length !== 5) return `${cote} a ${eq.pieces.length} patineurs`;
      if (!eq.piece_g) return `${cote} n'a pas de gardien`;
    }
    return null;
  }],

  ['une pièce par case : personne ne se superpose', m => {
    const vues = new Map();
    for (const x of surLaGlace(m)) {
      const cle = `${x.r},${x.c}`;
      if (vues.has(cle)) return `${nom(x)} et ${nom(vues.get(cle))} occupent tous deux ${cle}`;
      vues.set(cle, x);
    }
    return null;
  }],

  ['tout le monde est sur la glace, jamais dans les filets', m => {
    for (const x of surLaGlace(m)) {
      if (x.r < RANG_MIN || x.r > RANG_MAX) return `${nom(x)} est en ${x.r},${x.c} (hors des rangées ${RANG_MIN}-${RANG_MAX})`;
      if (x.c < 0 || x.c >= COLS) return `${nom(x)} est en dehors de la glace (colonne ${x.c})`;
    }
    return null;
  }],

  ['un joueur ne joue pas deux fois dans le même match', m => {
    const vus = new Set();
    for (const x of [...surLaGlace(m), m.A.piece_g, m.B.piece_g]) {
      if (!x.p) continue;
      const cle = `${x.eq}|${x.p.id}|${x.p.s}`;
      if (vus.has(cle)) return `${nom(x)} est sur la glace deux fois`;
      vus.add(cle);
    }
    return null;
  }],

  ['une rondelle libre n\'est jamais sous les pieds de quelqu\'un', m => {
    const l = libre(m);
    if (!l) return null;
    const dessus = surLaGlace(m).find(x => x.r === l.r && x.c === l.c);
    return dessus ? `${nom(dessus)} est debout sur la rondelle libre` : null;
  }],

  ['la rondelle est toujours quelque part, et jouable', m => {
    const p = porteur(m), l = libre(m);
    if (!p && !l) return 'la rondelle n\'est nulle part';
    if (p && l) return 'la rondelle est à deux endroits';
    if (l) {
      if (l.r < RANG_MIN || l.r > RANG_MAX || l.c < 0 || l.c >= COLS) return `rondelle libre hors de la glace (${l.r},${l.c})`;
    }
    if (p && !p.gardien && !surLaGlace(m).includes(p)) return `${nom(p)} porte la rondelle mais n'est pas sur la glace`;
    return null;
  }],

  ['le porteur n\'est jamais au sol : le jeu ne peut pas se bloquer', m => {
    const p = porteur(m);
    if (p && !p.gardien && p.etourdi) return `${nom(p)} porte la rondelle et est étourdi`;
    return null;
  }],

  ['l\'équipe a toujours un geste possible en DÉBUT de présence', m => {
    if (m.fini) return null;
    // En cours de présence, ne plus rien avoir à faire est normal : c'est
    // ainsi qu'une présence se termine. La règle ne vaut qu'au départ, quand
    // les cinq pièces sont fraîches.
    const eq0 = eqDe(m, m.tour);
    if (eq0.pieces.some(x => x.agi || x.deplace)) return null;
    const eq = eqDe(m, m.tour);
    const options = eq.pieces.some(x => peutJouer(x)
      && (deplacementsDe(m, x).length || ciblesEchecDe(m, x).length || porteur(m) === x
        || (libre(m) && libre(m).r === x.r && libre(m).c === x.c)));
    return options ? null : `${eq.nom} n'a aucun geste possible`;
  }],

  ['le souffle reste entre zéro et le maximum du joueur', m => {
    for (const cote of ['A', 'B']) {
      const eq = eqDe(m, cote);
      for (const [joueur, v] of eq.souffle) {
        const max = statsDeTable(joueur).SO;
        if (v < 0) return `${joueur.n} a un souffle négatif (${v})`;
        if (v > max) return `${joueur.n} a ${v} de souffle pour un maximum de ${max}`;
      }
    }
    return null;
  }],

  ['la période et la présence restent dans leurs bornes', m => {
    if (m.periode < 1) return `période ${m.periode}`;
    if (!m.prolongation && m.periode > PERIODES) return `période ${m.periode} sans prolongation`;
    if (m.prolongation && m.periode !== PERIODES + m.prolongation) return `prolongation ${m.prolongation} en période ${m.periode}`;
    const max = (m.prolongation ? PRESENCES_PROLONGATION : PRESENCES_PAR_PERIODE) * 2;
    if (m.presence < 1 || m.presence > max) return `présence ${m.presence} sur ${max}`;
    return null;
  }],

  ['une pièce au sol ou en écran ne le reste pas indéfiniment', m => {
    for (const x of surLaGlace(m)) {
      if (x.etourdi > 3) return `${nom(x)} est au sol pour ${x.etourdi} présences`;
      if (x.ecran > 2) return `${nom(x)} est en écran pour ${x.ecran} présences`;
    }
    return null;
  }],
];

const nom = x => `${(x.p && x.p.n) || 'Rappel'} (${x.eq}${x.role})`;

/* ======================================================================
   LE DÉROULEMENT : un match doit toujours finir, et finir sur un gagnant.
   ====================================================================== */
let casses = new Map();
let nuls = 0, jamaisFinis = 0, presencesTotal = 0, matchsAvecOT = 0, gestesTotal = 0;
const parType = {};
const ajouter = (regle, quoi) => {
  const l = casses.get(regle) || [];
  if (l.length < 3) l.push(quoi);
  casses.set(regle, l);
};

for (let i = 0; i < MATCHS; i++) {
  const a = clubs[(i * 37) % clubs.length];
  const b = clubs[(i * 91 + 13) % clubs.length];
  const m = nouveauMatch(
    equipeDeTable(a.nom, a.tag, a.roster, 'A'),
    equipeDeTable(b.nom, b.tag, b.roster, 'B'), `r${i}`);

  let garde = 0;
  const verifier = () => {
    for (const [nomRegle, f] of REGLES) {
      let quoi = null;
      try { quoi = f(m); } catch (e) { quoi = `exception : ${e.message}`; }
      if (quoi) ajouter(nomRegle, `match ${i}, période ${m.periode}, présence ${m.presence} : ${quoi}`);
    }
  };
  verifier();
  while (!m.fini && garde++ < 400) {
    // Un joueur change ses trios : c'est le geste le plus susceptible de
    // casser le plateau, puisqu'il repose cinq pièces d'un coup.
    if (garde % 5 === 0) {
      const eq = eqDe(m, m.tour);
      changerUnite(m, m.tour, (eq.tri + 1) % 4, (eq.pai + 1) % 3);
      verifier();
    }
    // On vérifie entre CHAQUE geste, pas seulement entre deux présences :
    // un chevauchement ou une rondelle perdue peut naître et disparaître à
    // l'intérieur d'une même présence sans qu'on le voie jamais.
    iaPresence(m, (type) => { gestesTotal++; parType[type] = (parType[type] || 0) + 1; verifier(); });
    presencesTotal++;
    verifier();
  }
  if (!m.fini) { jamaisFinis++; continue; }
  if (m.prolongation) matchsAvecOT++;
  const r = resultatDe(m);
  if (r.gfA === r.gfB) { nuls++; ajouter('un match finit toujours sur un gagnant', `match ${i} : ${r.gfA}-${r.gfB}`); }
}

console.log(`${clubs.length} vraies équipes · ${MATCHS} matchs · ${presencesTotal} présences et ${gestesTotal} gestes vérifiés\n`);
console.log('LES RÈGLES DU PLATEAU');
let echecs = 0;
for (const [nomRegle] of REGLES.concat([['un match finit toujours sur un gagnant']])) {
  const l = casses.get(nomRegle);
  if (l) { echecs++; console.log(`  ✗ ${nomRegle}\n      ${l.join('\n      ')}`); }
  else console.log(`  ✓ ${nomRegle}`);
}
console.log(`\nDÉROULEMENT`);
console.log(`  matchs jamais terminés      ${jamaisFinis}`);
console.log(`  matchs allés en prolongation ${matchsAvecOT} (${(100 * matchsAvecOT / MATCHS).toFixed(0)} %)`);
console.log(`  présences par match          ${(presencesTotal / MATCHS).toFixed(1)} (${PERIODES} × ${PRESENCES_PAR_PERIODE} × 2 = ${PERIODES * PRESENCES_PAR_PERIODE * 2} sans prolongation)`);
console.log(`  gestes joués                 ${Object.entries(parType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / gestesTotal).toFixed(0)} %`).join(' · ')}`);
/* CHAQUE GESTE DOIT ÊTRE JOUÉ AU MOINS UNE FOIS : un geste que personne
   n'utilise jamais est une règle morte, et une règle morte est un mensonge
   dans la page des règles. */
for (const g of ['deplacer', 'passe', 'tir', 'echec', 'vol', 'ecran', 'foncer']) {
  if (!parType[g]) { console.log(`  ✗ le geste « ${g} » n'a jamais été joué en ${MATCHS} matchs`); echecs++; }
}

/* ======================================================================
   LES RÈGLES ÉCRITES DISENT-ELLES CE QUE LE MOTEUR FAIT ?
   ======================================================================
   `reglesDuPlateau()` est ce que le joueur lit, sur le plateau et dans la
   page des règles. Un geste que le moteur joue et que les règles taisent est
   un piège ; une règle écrite pour un geste que le moteur ne joue jamais est
   un mensonge. Les deux listes doivent coïncider — c'est exactement l'erreur
   qui avait laissé « ramasser » dans le jeu à 0 % des gestes joués. */
{
  const sections = reglesDuPlateau();
  const tableau = sections.find(x => x.rangees);
  const ecrits = new Set(tableau.rangees.map(r => r[0].toLowerCase()));
  const MOTS = { deplacer: 'patiner', esquive: 'esquiver', passe: 'passer', tir: 'tirer', echec: 'épaule', vol: 'bâton', ecran: 'se placer devant', foncer: 'foncer' };
  console.log('\nLES RÈGLES ÉCRITES');
  console.log(`  ${sections.length} sections, ${tableau.rangees.length} gestes décrits`);
  let manque = 0;
  for (const [cle, mot] of Object.entries(MOTS)) {
    if (!ecrits.has(mot)) { console.log(`  ✗ le geste « ${cle} » est joué par le moteur mais absent des règles`); manque++; }
  }
  // L'esquive n'a pas de type de geste à elle : elle arrive pendant un
  // déplacement. Les sept autres doivent avoir été joués au moins une fois.
  for (const mot of ecrits) {
    const cle = Object.keys(MOTS).find(k => MOTS[k] === mot);
    if (!cle) { console.log(`  ✗ les règles décrivent « ${mot} », que le moteur ne connaît pas`); manque++; }
    else if (cle !== 'esquive' && !parType[cle]) { console.log(`  ✗ les règles décrivent « ${mot} », jamais joué en ${MATCHS} matchs`); manque++; }
  }
  if (!manque) console.log('  ✓ chaque geste joué est écrit, chaque règle écrite est jouée');
  echecs += manque;
}
if (jamaisFinis) echecs++;

process.exitCode = echecs ? 1 : 0;
