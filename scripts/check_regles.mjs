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
  COLS, RANGS, RANG_MIN, RANG_MAX, BUT_COL, PERIODES, PRESENCES_PAR_PERIODE, PRESENCES_PROLONGATION, POSSESSIONS_PAR_PERIODE, POSSESSIONS_PROLONGATION,
  equipeDeTable, nouveauMatch, iaPresence, resultatDe, surLaGlace, porteur, libre, eqDe,
  statsDeTable, uniteDe, changerUnite, souffleDe, souffleMax, PUNITION_TOURS, peutJouer, deplacementsDe, ciblesEchecDe,
  reglesDuPlateau, peutTirerDe, distanceAuFilet, PORTEE_TIR, caseJouable, estFilet, ROLES_PROLONGATION,
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
      // Au cachot (S38), l'équipe joue à quatre — et jamais à moins.
      /*
       * CINQ, QUATRE, TROIS — ou TROIS en prolongation (S46). L'effectif se
       * déduit de deux règles qui se composent : le trois contre trois de la
       * prolongation, et le cachot qui peut tenir DEUX punis (le cinq contre
       * trois). Une équipe ne descend jamais sous trois patineurs.
       */
      const base = (m.prolongation ? ROLES_PROLONGATION.length : 5) + (eq.desert ? 1 : 0);
      const attendu = Math.max(base - eq.penalites.length, base === 3 ? 2 : 3);
      if (eq.pieces.length !== attendu) return `${cote} a ${eq.pieces.length} patineurs (attendu ${attendu}${eq.penalites.length ? `, ${eq.penalites.length} puni(s)` : ''}${m.prolongation ? ', prolongation' : ''})`;
      if (eq.penalites.length > 2) return `${cote} a ${eq.penalites.length} punis à la fois`;
      for (const pen of eq.penalites) if (pen.tours < 0 || pen.tours > PUNITION_TOURS) return `${cote} : punition de ${pen.tours} tours`;
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

  ['le gardien est dans son filet, sauf s\'il est SORTI', m => {
    for (const cote of ['A', 'B']) {
      const eq = eqDe(m, cote);
      if (!!eq.desert !== !!eq.piece_g.sorti) return `${cote} : desert=${!!eq.desert} mais sorti=${!!eq.piece_g.sorti}`;
      // Pas d'exigence sur l'attaquant supplémentaire : il peut être au
      // cachot ou rentré avec son trio. C'est le COMPTE de patineurs qui
      // juge, et il est vérifié par la règle d'à côté.
      if (eq.pieces.filter(x => x.role === 'X').length > 1) return `${cote} a ${eq.pieces.filter(x => x.role === 'X').length} attaquants supplémentaires`;
    }
    return null;
  }],

  ['tout le monde est sur la glace, jamais dans les filets', m => {
    for (const x of surLaGlace(m)) {
      if (estFilet(x.r, x.c)) return `${nom(x)} est dans le filet (${x.r},${x.c})`;
      if (!caseJouable(x.r, x.c)) return `${nom(x)} est en dehors de la glace (${x.r},${x.c}, rangées ${RANG_MIN}-${RANG_MAX})`;
    }
    for (const g of [m.A.piece_g, m.B.piece_g]) {
      if (!estFilet(g.r, g.c)) return `le gardien ${nom(g)} n'est pas dans son filet (${g.r},${g.c})`;
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
      if (!caseJouable(l.r, l.c)) return `rondelle libre hors de la glace ou dans un filet (${l.r},${l.c})`;
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
        const max = souffleMax(statsDeTable(joueur));
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

  ['une pièce au sol ne le reste pas indéfiniment', m => {
    for (const x of surLaGlace(m)) {
      if (x.etourdi > 3) return `${nom(x)} est au sol pour ${x.etourdi} présences`;
    }
    return null;
  }],

  ['la possession se compte, et la période ne la dépasse pas', m => {
    if (m.possessions < 0) return `possessions ${m.possessions}`;
    const max = m.prolongation ? POSSESSIONS_PROLONGATION : POSSESSIONS_PAR_PERIODE;
    // Elle finit au premier arrêt de jeu APRÈS la dernière : un tour de plus au plus, jamais deux.
    if (m.possessions > max + 2) return `${m.possessions} possessions pour un maximum de ${max}`;
    return null;
  }],
];

const nom = x => `${(x.p && x.p.n) || 'Rappel'} (${x.eq}${x.role})`;

/* ======================================================================
   LE DÉROULEMENT : un match doit toujours finir, et finir sur un gagnant.
   ====================================================================== */
let casses = new Map();
let nuls = 0, jamaisFinis = 0, presencesTotal = 0, matchsAvecOT = 0, gestesTotal = 0, tirsHorsPortee = 0;
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
  while (!m.fini && garde++ < 4000) {
    // Un joueur change ses trios : c'est le geste le plus susceptible de
    // casser le plateau, puisqu'il repose cinq pièces d'un coup.
    if (garde % 50 === 0) {
      const eq = eqDe(m, m.tour);
      changerUnite(m, m.tour, (eq.tri + 1) % 4, (eq.pai + 1) % 3);
      verifier();
    }
    // On vérifie entre CHAQUE geste, pas seulement entre deux présences :
    // un chevauchement ou une rondelle perdue peut naître et disparaître à
    // l'intérieur d'une même présence sans qu'on le voie jamais.
    iaPresence(m, (type, piece) => {
      gestesTotal++; parType[type] = (parType[type] || 0) + 1;
      // ON NE TIRE QUE DE LA ZONE OFFENSIVE. C'est ce qui a fait disparaître
      // les « buts randoms du milieu » : 28 % des buts venaient de la zone
      // neutre ou de plus loin, et un tir du fond de son propre territoire
      // avait un meilleur modificateur qu'un tir de l'enclave.
      // ...SAUF DANS UN BUT VIDE (S46), où l'on tire de partout : c'est le
      // prix du filet désert, et `peutTirer` le sait déjà. Le nom de la
      // règle le dit, sinon il mentirait à la première lecture.
      /*
       * LA LÉGALITÉ SE LIT AU MOMENT DU TIR. `peutTirer` interroge l'état
       * COURANT, et un but dans le filet désert fait rentrer le gardien
       * aussitôt : le tir de la zone neutre, permis quand il est parti,
       * devenait illégal le temps qu'on le vérifie. Le moteur note donc
       * `vide` sur le tir lui-même (`modsTir`), et c'est ce que la règle lit.
       */
      if (type === 'tir') {
        const mods = eqDe(m, piece.eq).modsTir;
        const vide = !!(mods.length && mods[mods.length - 1].vide);
        if (!peutTirerDe(piece.r, piece.c, eqDe(m, piece.eq).but, vide)) {
          tirsHorsPortee++;
          ajouter('on ne tire que de la zone offensive (ou dans un but vide)', `match ${i} : tir à ${distanceAuFilet(m, piece)} cases du filet (portée ${PORTEE_TIR})`);
        }
      }
      verifier();
    });
    presencesTotal++;
    verifier();
  }
  if (!m.fini) { jamaisFinis++; continue; }
  if (m.prolongation) matchsAvecOT++;
  const r = resultatDe(m);
  /*
   * LA FUSILLADE NE TOUCHE PAS AU POINTAGE (S46) : elle ne fait que désigner
   * `vainqueur`, sinon les égalités de la feuille cassent — un but de
   * fusillade n'a ni tireur sur la glace ni gardien battu. Un 2-2 avec un
   * vainqueur est donc un match RÉGLÉ, pas un match nul.
   */
  if (r.gfA === r.gfB && !r.vainqueur) { nuls++; ajouter('un match finit toujours sur un gagnant', `match ${i} : ${r.gfA}-${r.gfB}`); }
}

console.log(`${clubs.length} vraies équipes · ${MATCHS} matchs · ${presencesTotal} activations et ${gestesTotal} gestes vérifiés\n`);
console.log('LES RÈGLES DU PLATEAU');
let echecs = 0;
for (const [nomRegle] of REGLES.concat([['on ne tire que de la zone offensive (ou dans un but vide)'], ['un match finit toujours sur un gagnant']])) {
  const l = casses.get(nomRegle);
  if (l) { echecs++; console.log(`  ✗ ${nomRegle}\n      ${l.join('\n      ')}`); }
  else console.log(`  ✓ ${nomRegle}`);
}
console.log(`\nDÉROULEMENT`);
console.log(`  matchs jamais terminés      ${jamaisFinis}`);
console.log(`  matchs allés en prolongation ${matchsAvecOT} (${(100 * matchsAvecOT / MATCHS).toFixed(0)} %)`);
console.log(`  activations par match        ${(presencesTotal / MATCHS).toFixed(1)} (une main à la fois, en alternance ; ${PERIODES} × ${POSSESSIONS_PAR_PERIODE} possessions, ${PRESENCES_PAR_PERIODE} tours au plus par période)`);
console.log(`  gestes joués                 ${Object.entries(parType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / gestesTotal).toFixed(0)} %`).join(' · ')}`);
/* CHAQUE GESTE DOIT ÊTRE JOUÉ AU MOINS UNE FOIS : un geste que personne
   n'utilise jamais est une règle morte, et une règle morte est un mensonge
   dans la page des règles. */
for (const g of ['deplacer', 'passe', 'tir', 'echec', 'vol', 'dejouer', 'reception']) {
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
  // SIX GESTES (S41), et la bataille, qui n'a pas de type à elle : elle arrive pendant un patin, comme l'esquive.
  const MOTS = { deplacer: 'patiner', passe: 'passer', tir: 'tirer', dejouer: 'feinter', echec: 'frapper', vol: 'harponner', bataille: 'bataille' };
  console.log('\nLES RÈGLES ÉCRITES');
  console.log(`  ${sections.length} sections, ${tableau.rangees.length} gestes décrits`);
  let manque = 0;
  for (const [cle, mot] of Object.entries(MOTS)) {
    if (!ecrits.has(mot)) { console.log(`  ✗ le geste « ${cle} » est joué par le moteur mais absent des règles`); manque++; }
  }
  // L'esquive, la bataille et le poke n'ont pas de type de geste à elles : elles
  // arrivent pendant un déplacement. Les sept autres doivent avoir été joués au moins une fois.
  for (const mot of ecrits) {
    const cle = Object.keys(MOTS).find(k => MOTS[k] === mot);
    if (!cle) { console.log(`  ✗ les règles décrivent « ${mot} », que le moteur ne connaît pas`); manque++; }
    else if (cle !== 'bataille' && !parType[cle]) { console.log(`  ✗ les règles décrivent « ${mot} », jamais joué en ${MATCHS} matchs`); manque++; }
  }
  if (!manque) console.log('  ✓ chaque geste joué est écrit, chaque règle écrite est jouée');
  echecs += manque;
}
if (jamaisFinis) echecs++;

process.exitCode = echecs ? 1 : 0;
