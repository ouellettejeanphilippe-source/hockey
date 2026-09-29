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
  equipeDeTable, nouveauMatch, iaPresence, iaGeste, finirMain, resultatDe, surLaGlace, porteur, libre, eqDe,
  statsDeTable, uniteDe, changerUnite, souffleDe, souffleMax, PUNITION_TOURS, peutJouer, deplacementsDe, ciblesEchecDe,
  reglesDuPlateau, peutTirerDe, distanceAuFilet, PORTEE_TIR, caseJouable, estFilet, ROLES_PROLONGATION,
  TRAJETS, caseDeLaRondelle, PORTEE_RELANCE, FILET_HAUT, MJ_FOND, MJ_NEUTRE,
  deplacer, appliquerPasse, appliquerTir, appliquerEchec, ciblesFondDe,
  enJeu, passer, tirer, mettreEnEchec, voler,
  peutBouger, appliquerDejouer, peutRetirerGardien, retirerGardien, expliquerGeste, modEsquive, adverse,
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
const avantagesEnProlongation = new Set();   // les matchs où la prolongation a vu un avantage numérique (S75b)
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
      /*
       * EN PROLONGATION, LA RÈGLE DE LA VRAIE LIGUE (S75b) : la punie reste à
       * trois, l'autre ajoute un patineur par puni d'en face ; un puni qui
       * rentre fait du quatre contre quatre jusqu'au sifflet (`revenus`, remis
       * à zéro par la mise au jeu). Donc au moins trois, et au plus trois plus
       * les punis d'en face, plus les rentrés des deux côtés.
       *
       * UN MATCH FINI NE SE COMPTE PLUS (S75c). La punition siffle ; quand ce
       * sifflet est aussi celui de la dernière possession de la prolongation,
       * la fusillade suit et aucune mise au jeu ne replace personne : le puni
       * est au cachot, l'autre n'a pas encore son quatrième. Personne ne
       * jouera plus sur cette glace — mesuré au match 63 dès que la zone
       * neutre a grandi et que le déroulement a changé.
       */
      if (m.prolongation) {
        if (m.fini) continue;
        const adv = eqDe(m, cote === 'A' ? 'B' : 'A');
        const rentres = (adv.revenus || 0) + (eq.revenus || 0);
        if (!rentres) {
          // Personne n'est rentré depuis la mise au jeu : le compte est EXACT.
          const attendu = Math.min(ROLES_PROLONGATION.length + adv.penalites.length, 5) + (eq.desert ? 1 : 0);
          if (eq.pieces.length !== attendu) return `${cote} a ${eq.pieces.length} patineurs en prolongation (attendu ${attendu} : ${adv.penalites.length} puni(s) d'en face, ${eq.penalites.length} des siens)`;
          if (adv.penalites.length) avantagesEnProlongation.add(m);
        } else {
          const plancher = ROLES_PROLONGATION.length + (eq.desert ? 1 : 0);
          const plafond = Math.min(ROLES_PROLONGATION.length + adv.penalites.length + rentres, 5) + (eq.desert ? 1 : 0);
          if (eq.pieces.length < plancher || eq.pieces.length > plafond) return `${cote} a ${eq.pieces.length} patineurs en prolongation (attendu ${plancher} à ${plafond}, ${rentres} rentré(s) du cachot)`;
        }
      } else {
        const base = 5 + (eq.desert ? 1 : 0);
        const attendu = Math.max(base - eq.penalites.length, 3);
        if (eq.pieces.length !== attendu) return `${cote} a ${eq.pieces.length} patineurs (attendu ${attendu}${eq.penalites.length ? `, ${eq.penalites.length} puni(s)` : ''})`;
      }
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

  /*
   * LA RONDELLE NE SE TÉLÉPORTE PAS (S74). JP : *la puck se teleporte*. Le
   * moteur tient le trajet de la rondelle, étape par étape (`m.trajet`), et
   * l'écran le joue dans l'ordre. Deux règles, et elles se complètent :
   * celle-ci dit qu'AUCUNE case ne change sans étape — là où l'état du
   * moteur met la rondelle, son trajet doit l'avoir amenée ; la suivante
   * dit que chaque étape est permise. Un match fini est exempté : après le
   * but de la mort subite, la rondelle reste au fond du filet.
   */
  ['la rondelle ne change jamais de case sans une étape de son trajet', m => {
    const ici = caseDeLaRondelle(m);
    if (m.fini || !ici) return null;
    if (!m.ici || m.ici.r !== ici.r || m.ici.c !== ici.c) {
      return `la rondelle est en ${ici.r},${ici.c} mais son trajet la laisse en ${m.ici ? `${m.ici.r},${m.ici.c}` : 'nulle part'}`;
    }
    return null;
  }],

  /*
   * CHAQUE ÉTAPE EST UNE RÈGLE DU JEU, À SA DISTANCE (S74). La liste blanche
   * est `TRAJETS`, dans le moteur : un patin ne va pas plus loin que le
   * patin, un rebond reste à deux cases de ce qui l'a fait, la relance du
   * gardien ne passe pas sa ligne bleue, un tir finit dans un filet, et
   * une mise au jeu vient toujours d'un sifflet qui se dit. C'est cette
   * règle-ci qui a trouvé la relance à dix-neuf cases.
   */
  ['chaque étape du trajet est un geste permis, à sa distance', m => {
    const lu = trajetsLus.get(m) || 0;
    trajetsLus.set(m, m.trajet.length);
    for (const e of m.trajet.slice(lu)) {
      const regle = TRAJETS[e.genre];
      if (!regle) return `étape « ${e.genre} » inconnue`;
      const depuis = e.pivot || e.de;
      const n = Math.max(Math.abs(depuis.r - e.a.r), Math.abs(depuis.c - e.a.c));
      if (n > regle.max) return `${regle.mot} de ${n} cases (${e.de.r},${e.de.c} → ${e.a.r},${e.a.c}), permis ${regle.max}`;
      if (e.genre === 'tir' && !estFilet(e.a.r, e.a.c)) return `un tir qui finit en ${e.a.r},${e.a.c}, pas dans un filet`;
      if (e.genre === 'mj' && !e.mot) return 'une mise au jeu sans sifflet';
      if (e.chemin && e.chemin.some(x => estFilet(x.r, x.c))) return 'un patin qui passe à travers un filet';
      if (e.chemin) for (let k = 1; k < e.chemin.length; k++) {
        const a = e.chemin[k - 1], b = e.chemin[k];
        if (Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) !== 1) return `une route qui saute de ${a.r},${a.c} à ${b.r},${b.c}`;
      }
    }
    return null;
  }],
];
/* Où chaque match en est de la lecture de son trajet : la règle ne juge que les étapes neuves. */
const trajetsLus = new WeakMap();

const nom = x => `${(x.p && x.p.n) || 'Rappel'} (${x.eq}${x.role})`;

/* ======================================================================
   LE DÉROULEMENT : un match doit toujours finir, et finir sur un gagnant.
   ====================================================================== */
let casses = new Map();
let nuls = 0, jamaisFinis = 0, presencesTotal = 0, matchsAvecOT = 0, gestesTotal = 0, tirsHorsPortee = 0, icingsTotal = 0;
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
  icingsTotal += m.icings || 0;
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
console.log(`  avantage en prolongation    ${avantagesEnProlongation.size} match(s) — la punie reste à trois, l'autre ajoute un patineur (la règle de la LNH)`);
// AUCUN DÉGAGEMENT REFUSÉ N'EST JAMAIS SIFFLÉ (1.0 · J4-P7) : le geste n'existe plus de sa propre zone, donc personne ne peut le commettre.
if (icingsTotal) { console.log(`  ✗ ${icingsTotal} dégagement(s) refusé(s) sifflé(s) : le geste ne devrait pas exister de sa propre zone`); echecs++; }
else console.log('  ✓ aucun dégagement refusé sifflé : le geste n\'existe pas de sa propre zone');
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

/* ======================================================================
   LES SIFFLETS, MIS EN SCÈNE (S74)
   ======================================================================
   L'IA ne se met plus hors-jeu et ne dégage jamais de sa zone : ce sont des
   fautes que seul le joueur commet. « Une règle qu'aucun script n'exerce est
   une règle qu'on casse sans le savoir » — et c'est exactement ce qui était
   arrivé au dégagement refusé, sifflé depuis S45 du MAUVAIS côté de la glace
   sans qu'aucune mesure ne le voie (zéro sur 200 matchs). On les joue donc
   à la main, sur une glace posée case par case : chaque scène dit ce qui
   doit arriver, et le trajet de la rondelle doit le montrer.
   ====================================================================== */
{
  const A0 = clubs[0], B0 = clubs[1];
  /*
   * Une glace mise en scène. `ou` place des pièces par clé « A-C », « B-DG »… ;
   * toutes les autres vont se garer loin du jeu, chacune dans son coin de
   * sa propre zone, et la rondelle va à `porteur`.
   */
  const scene = (ou, porte, tour = 'A') => {
    const m = nouveauMatch(equipeDeTable(A0.nom, A0.tag, A0.roster, 'A'), equipeDeTable(B0.nom, B0.tag, B0.roster, 'B'), 'scene');
    const garage = { A: [[20, 0], [20, 1], [20, 11], [20, 12], [19, 0]], B: [[2, 0], [2, 1], [2, 11], [2, 12], [3, 0]] };
    for (const cote of ['A', 'B']) {
      let g = 0;
      for (const x of eqDe(m, cote).pieces) {
        const cle = `${cote}-${x.role}`;
        [x.r, x.c] = ou[cle] || garage[cote][g++];
      }
    }
    const p = surLaGlace(m).find(x => `${x.eq}-${x.role}` === porte) || eqDe(m, porte[0]).piece_g;
    m.rondelle = { piece: p };
    m.ici = { r: p.r, c: p.c };
    m.possesseur = p.eq;
    m.tour = tour;
    m.dernier = null;
    return { m, p, piece: cle => surLaGlace(m).find(x => `${x.eq}-${x.role}` === cle) };
  };
  const dernieres = (m, n) => m.trajet.slice(-n).map(e => e.genre).join(' → ');
  const siffle = (m, mot) => { const e = m.trajet[m.trajet.length - 1]; return e.genre === 'mj' && e.mot === mot ? e : null; };
  const scenes = [];
  const juger = (nomScene, ok, detail) => { scenes.push([nomScene, ok, detail]); };

  /*
   * LES SCÈNES DE LIGNE BLEUE SE PLACENT PAR RAPPORT À ELLE (S75c). Elles
   * étaient écrites en rangées pour une zone de huit (porteur à 11, entrée à
   * 9) : quand la zone neutre a grandi, la ligne bleue a bougé et la scène
   * du hors-jeu patinait dans le neutre. `Z` est la première rangée de la
   * zone offensive de A (qui attaque vers le haut) ; le porteur part de deux
   * rangées dehors, dans le neutre.
   */
  const Z = FILET_HAUT + PORTEE_TIR;
  // 1. Le porteur entre en zone pendant qu'un coéquipier l'attend dedans : hors-jeu.
  {
    const { m, p } = scene({ 'A-C': [Z + 2, 6], 'A-AG': [Z - 1, 2] }, 'A-C');
    deplacer(m, p, { r: Z, c: 6 });
    const mj = siffle(m, 'Hors-jeu');
    juger('le porteur qui entre devant un coéquipier déjà dans la zone : HORS-JEU, mise au jeu au neutre',
      !!mj && MJ_NEUTRE.includes(mj.point.r), `${dernieres(m, 2)}${mj ? ` · point ${mj.point.r},${mj.point.c}` : ''}`);
  }
  // 2. Le même, le coéquipier ressorti : pas de sifflet.
  {
    const { m, p } = scene({ 'A-C': [Z + 2, 6], 'A-AG': [Z + 1, 2] }, 'A-C');
    deplacer(m, p, { r: Z, c: 6 });
    juger('le même, le coéquipier ressorti de la zone : le jeu continue', m.trajet[m.trajet.length - 1].genre === 'patin' && !m.fil.some(e => e.genre === 'horsjeu'), dernieres(m, 1));
  }
  // 3. Une passe à un coéquipier qui attend dans la zone : hors-jeu.
  {
    const { m, p, piece } = scene({ 'A-C': [Z + 2, 6], 'A-AD': [Z - 2, 9] }, 'A-C');
    appliquerPasse(m, p, piece('A-AD'), { reussi: true });
    juger('la passe à un coéquipier qui attendait dans la zone : HORS-JEU', !!siffle(m, 'Hors-jeu'), dernieres(m, 2));
  }
  // 4. Au fond, de la zone neutre : la rondelle est libre dans le coin, pas de sifflet.
  {
    const { m, p } = scene({ 'A-C': [Z + 2, 6] }, 'A-C');
    const cibles = ciblesFondDe(m, p);
    const coin = cibles.find(x => x.r === FILET_HAUT && x.c === 0) || cibles[0];
    appliquerPasse(m, p, coin, { reussi: true });
    juger('au fond, de la zone neutre : la rondelle est libre dans le coin', !!libre(m) && m.trajet[m.trajet.length - 1].genre === 'fond' && !m.fil.some(e => e.genre === 'icing'), dernieres(m, 1));
  }
  // 5. De la zone offensive, on n'envoie pas au fond : on y est déjà.
  {
    const { m, p } = scene({ 'A-C': [6, 6] }, 'A-C');
    juger('de la zone offensive, pas de passe au fond (on y est déjà)', ciblesFondDe(m, p).length === 0, `${ciblesFondDe(m, p).length} cases`);
  }
  // 6. De sa propre zone : le geste n'est plus OFFERT (1.0 · J4-P7) — une réussite qui est un sifflet contre soi
  //    n'est pas une option. Le moteur garde le sifflet pour une rondelle qui y arriverait autrement.
  {
    const { m, p } = scene({ 'A-C': [18, 6] }, 'A-C');
    const cibles = ciblesFondDe(m, p);
    juger('de sa propre zone : aucune passe au fond offerte', cibles.length === 0, `${cibles.length} case(s) offerte(s)`);
    appliquerPasse(m, p, { r: FILET_HAUT, c: 0 }, { reussi: true });
    const mj = siffle(m, 'Dégagement refusé');
    juger('forcée quand même : DÉGAGEMENT REFUSÉ, mise au jeu dans SA zone', !!mj && mj.point.r === MJ_FOND[1], `${dernieres(m, 2)}${mj ? ` · point ${mj.point.r},${mj.point.c}` : ''}`);
  }
  // 12. L'ordre patin / placement est libre (1.0 · J4-P4) : un ailier se place d'abord, le porteur garde son patin.
  {
    const { m, p, piece } = scene({ 'A-C': [Z + 2, 6], 'A-AG': [Z + 4, 2] }, 'A-C');
    const ailier = piece('A-AG');
    const d = deplacer(m, ailier, { r: Z + 3, c: 2 });
    juger('après le placement d\'un ailier, le porteur peut encore patiner',
      d.ok && m.main.place && !m.main.bouge && peutBouger(m, p), `place=${m.main.place} bouge=${m.main.bouge} porteur peut bouger=${peutBouger(m, p)}`);
  }
  // 13. La feinte rend l'élan (1.0 · J4-P6) : le patin de la main dépensé, une feinte réussie remet le porteur en route.
  {
    const { m, p, piece } = scene({ 'A-C': [Z + 2, 6], 'B-DG': [Z + 1, 6] }, 'A-C');
    m.main.bouge = true; p.deplace = true;
    appliquerDejouer(m, p, piece('B-DG'), { reussi: true });
    juger('après une feinte réussie, le porteur repart même si le patin de la main est dépensé', peutBouger(m, p), `echappee=${!!p.echappee} deplace=${!!p.deplace}`);
  }
  // 14. La cote affichée est la cote jouée (1.0 · J4-P5) : à un souffle, le dé roule avec ce que l'écran a dit.
  {
    let essais = 0, faux = 0;
    for (let k = 0; k < 500 && faux < 5; k++) {
      const c = 3 + (k % 7);
      const { m, p } = scene({ 'A-C': [Z + 2, c], 'B-DG': [Z + 1, c], 'B-DD': [Z + 1, c + 1] }, 'A-C');
      eqDe(m, 'A').souffle.set(p.p, 1 + (k % 3));   // à un souffle, le vidé arrive PENDANT le geste
      p.hab = 'AUCUNE';
      const vers = { r: Z + 1, c: c - 1 };
      const affiche = modEsquive(m, p, vers);
      const d = deplacer(m, p, vers);
      if (!d.jet) continue;
      essais++;
      if (d.jet.mod !== affiche.a || d.jet.mod2 !== affiche.b) faux++;
    }
    juger('la cote d\'esquive affichée est celle que le dé joue, souffle compris', essais > 100 && !faux, `${faux} écart(s) sur ${essais} esquives`);
  }
  // 15. Sortir son gardien (1.0 · J4-P2) : ce que l'IA faisait, le joueur le peut, aux mêmes conditions.
  {
    const { m } = scene({ 'A-C': [Z + 2, 6] }, 'A-C');
    m.periode = PERIODES; m.possessions = POSSESSIONS_PAR_PERIODE - 1; m.A.buts = 1; m.B.buts = 2;
    const avant = peutRetirerGardien(m, 'A');
    const ok = retirerGardien(m, 'A');
    juger('mené d\'un but à la dernière possession, le joueur sort son gardien : six patineurs, filet désert',
      avant && ok && m.A.desert && m.A.piece_g.sorti && m.A.pieces.length === 6 && m.fil[0].genre === 'desert', `permis=${avant} fait=${ok} pièces=${m.A.pieces.length}`);
  }
  // 16. Le « ? » d'un geste écrit sa règle dans le fil (1.0 · J4).
  {
    const { m } = scene({ 'A-C': [Z + 2, 6] }, 'A-C');
    const ok = expliquerGeste(m, 'tir');
    juger('le « ? » d\'un geste écrit sa règle dans le fil', ok && m.fil[0].genre === 'aide' && /Tirer/.test(m.fil[0].texte), m.fil[0].texte.slice(0, 60));
  }
  // 7. Un arrêt contrôlé, un défenseur libre à portée : la relance, à lui, jamais plus loin que la ligne bleue.
  {
    const { m, p, piece } = scene({ 'B-C': [15, 6], 'A-DG': [18, 4], 'A-DD': [17, 8] }, 'B-C', 'B');
    m.de = () => 0.99;   // le gardien contrôle l'arrêt
    appliquerTir(m, p, { reussi: false, total: 0, total2: 9 });
    const e = m.trajet[m.trajet.length - 1];
    juger('un arrêt, un coéquipier libre : la relance va à lui, à portée',
      e.genre === 'relance' && [piece('A-DG'), piece('A-DD')].includes(porteur(m)) && Math.max(Math.abs(e.de.r - e.a.r), Math.abs(e.de.c - e.a.c)) <= PORTEE_RELANCE,
      dernieres(m, 3));
  }
  // 8. Le même arrêt, personne de libre à portée : le gardien la gèle.
  {
    const { m, p } = scene({ 'B-C': [15, 6], 'A-DG': [9, 2], 'A-DD': [9, 10], 'A-C': [10, 6], 'A-AG': [10, 1], 'A-AD': [10, 11] }, 'B-C', 'B');
    m.de = () => 0.99;
    appliquerTir(m, p, { reussi: false, total: 0, total2: 9 });
    const mj = siffle(m, 'Gelée par le gardien');
    juger('le même arrêt, personne de libre à portée : le gardien la GÈLE', !!mj && mj.point.r === MJ_FOND[1], dernieres(m, 3));
  }
  // 10. Une mise en échec ratée sur un 1, et l'arbitre la voit : la punition se remet en jeu dans la zone du PUNI.
  {
    const { m, piece } = scene({ 'A-DG': [12, 5], 'B-C': [11, 5], 'B-AG': [11, 7] }, 'B-C', 'A');
    m.de = () => 0;   // l'arbitre regarde : deux fois sur trois, c'est une mineure
    appliquerEchec(m, piece('A-DG'), piece('B-AG'), { reussi: false, de: 1 });
    const mj = siffle(m, 'Punition');
    juger('une punition : la mise au jeu est dans la zone de l\'équipe PUNIE', !!mj && mj.point.r === MJ_FOND[1], `${dernieres(m, 1)}${mj ? ` · point ${mj.point.r},${mj.point.c}` : ''}`);
  }
  // 9. Un but : la rondelle va AU FILET, puis l'arbitre la pose au centre.
  {
    const { m, p } = scene({ 'A-C': [4, 6] }, 'A-C');
    appliquerTir(m, p, { reussi: true, total: 9, total2: 0 });
    const [t, mj] = m.trajet.slice(-2);
    juger('un but : la rondelle va au filet, PUIS au point du centre', t.genre === 'tir' && estFilet(t.a.r, t.a.c) && mj.genre === 'mj' && mj.mot === 'But', dernieres(m, 2));
  }
  /*
   * 11. LA PIÈCE D'AVANT LE SIFFLET NE JOUE PLUS (S75). `poser()` refait les
   * pièces à chaque mise au jeu ; l'écran gardait l'ancienne choisie quand la
   * main lui restait, et un toucher dépensait le patin de la main pendant que
   * rien ne bougeait. Le moteur refuse le geste d'une pièce qui n'est pas en
   * jeu, sans rien dépenser : ni la main, ni le trajet, ni le dé. Prouvé en
   * retirant la garde de `deplacer` : le patin passe, `bouge` devient vrai et
   * l'ailier fantôme change de case.
   */
  {
    const { m, p, piece } = scene({ 'A-C': [4, 6], 'A-AG': [6, 3] }, 'A-C');
    const ailier = piece('A-AG');
    appliquerTir(m, p, { reussi: true, total: 9, total2: 0 });   // le but : mise au jeu, pièces neuves
    m.tour = 'A';                                                  // la main reste à toi
    const avant = { bouge: m.main.bouge, agi: m.main.agi, mobiles: m.main.mobiles.length };
    const trajet = m.trajet.length, ou = [ailier.r, ailier.c];
    const vrai = m.de;
    let tirages = 0;
    m.de = () => { tirages++; return vrai(); };
    const rival = eqDe(m, 'B').pieces[0];
    const d = deplacer(m, ailier, { r: ailier.r - 1, c: ailier.c });
    const refus = [!d.ok && !d.jet, passer(m, p, ailier) === null, tirer(m, p) === null,
      mettreEnEchec(m, ailier, rival) === null, voler(m, ailier, rival) === null];
    const intact = m.main.bouge === avant.bouge && m.main.agi === avant.agi && m.main.mobiles.length === avant.mobiles
      && m.trajet.length === trajet && !tirages && ailier.r === ou[0] && ailier.c === ou[1];
    const neuf = eqDe(m, 'A').pieces.find(x => x.role === 'AG');
    juger('après un but, la pièce d\'avant le sifflet ne joue plus : le moteur refuse, rien n\'est dépensé',
      !enJeu(m, ailier) && !enJeu(m, p) && enJeu(m, neuf) && refus.every(Boolean) && intact && deplacementsDe(m, neuf).length > 0,
      `refus ${refus.map(Number).join('')} · main ${JSON.stringify(m.main.bouge)} · ${tirages} dé(s) · ailier en ${ailier.r},${ailier.c}`);
  }

  console.log('\nLES SIFFLETS, MIS EN SCÈNE');
  for (const [nomScene, ok, detail] of scenes) {
    console.log(`  ${ok ? '✓' : '✗'} ${nomScene}${ok ? '' : `\n      ${detail}`}`);
    if (!ok) echecs++;
  }
}

/* ======================================================================
   L'ALTERNANCE ET LE BANC (1.0 · J4-P1, J4-P3)
   ======================================================================
   JP : *je vois encore le cpu jouer plusieurs joueurs à la suite*. Un
   sifflet ou un but finissaient la présence sans passer par `finirMain`,
   et le tour suivant s'ouvrait par le camp interrompu. On rejoue des matchs
   un geste à la fois : chaque fois qu'une présence finit (le compteur de
   tours monte) sans changer de période, le camp qui vient de jouer ne
   rejoue pas. Et le banc : pendant la main d'un camp, l'autre ne change
   jamais ses lignes, et un camp ne les change qu'une fois par main.
   ====================================================================== */
{
  const N = Math.min(40, MATCHS);
  let presencesFinies = 0, rejoue = 0, bancAdverse = 0, deuxiemeChangement = 0, changements = 0, essaisAdverse = 0;
  for (let i = 0; i < N; i++) {
    const a = clubs[(i * 23 + 5) % clubs.length], b = clubs[(i * 41 + 11) % clubs.length];
    const m = nouveauMatch(equipeDeTable(a.nom, a.tag, a.roster, 'A'), equipeDeTable(b.nom, b.tag, b.roster, 'B'), `alt-${i}`);
    const mainsChangees = new Set();
    let garde = 0;
    while (!m.fini && garde++ < 20000) {
      const main = m.main, camp = m.tour, tours0 = m.tours || 0, periode0 = m.periode;
      // Le banc d'en face est fermé : l'essai doit être refusé, et ne rien bouger.
      if (garde % 7 === 0) {
        const autre = adverse(camp), eqA = eqDe(m, autre), tri0 = eqA.tri, pai0 = eqA.pai;
        essaisAdverse++;
        if (changerUnite(m, autre, (tri0 + 1) % 4, pai0) || eqA.tri !== tri0) bancAdverse++;
      }
      // Un changement par main : le deuxième, dans la même main, est refusé.
      if (garde % 11 === 0 && !mainsChangees.has(main)) {
        const eq = eqDe(m, camp);
        if (changerUnite(m, camp, (eq.tri + 1) % 4, eq.pai)) {
          changements++;
          mainsChangees.add(main);
          if (m.main === main && changerUnite(m, camp, (eq.tri + 1) % 4, eq.pai)) deuxiemeChangement++;
        }
      }
      const g = iaGeste(m);
      if (m.tour === camp && m.main === main && !g && !m.fini) finirMain(m);
      if ((m.tours || 0) > tours0 && !m.fini && m.periode === periode0) {
        presencesFinies++;
        if (m.tour === camp) rejoue++;
      }
    }
  }
  const regles = [
    ['après un sifflet, un but ou un tour plein, l\'autre camp ouvre', !rejoue, `${rejoue} fois sur ${presencesFinies} le camp qui venait de jouer a rejoué`],
    ['le banc d\'en face est fermé pendant ta main', !bancAdverse, `${bancAdverse} changement(s) adverse(s) passé(s) sur ${essaisAdverse} essais`],
    ['un seul changement de lignes par main', !deuxiemeChangement && changements > 0, `${deuxiemeChangement} deuxième(s) changement(s) sur ${changements}`],
  ];
  console.log(`\nL'ALTERNANCE ET LE BANC (${N} matchs, ${presencesFinies} présences finies, ${changements} changements de lignes)`);
  for (const [nomRegle, ok, detail] of regles) {
    console.log(`  ${ok ? '✓' : '✗'} ${nomRegle}${ok ? '' : `\n      ${detail}`}`);
    if (!ok) echecs++;
  }
}

/* ======================================================================
   LE NIVEAU RECRUE (S75)
   ======================================================================
   La recrue ne change pas les règles, elle change la tête de l'IA d'en
   face : elle passe sa main après UN geste (sauf le tir sur réception
   qu'une passe vient d'ouvrir) et ne dépense jamais sa relance. Trois
   choses se vérifient, geste par geste : la main de la recrue ne compte
   jamais deux gestes, sa relance n'est jamais dépensée, et la même graine
   rejoue le même match — une recrue qui tirerait au hasard hors du
   générateur du match casserait la reprise du tournoi. Et un match Pro
   reste un match Pro : le camp d'en face, lui, joue ses mains entières.
   ====================================================================== */
{
  const N = Math.min(30, MATCHS);
  let mainsRecrue = 0, deuxGestes = 0, relancesDepensees = 0, gestesPro = 0, mainsPro = 0, differents = 0;
  const jouer = (i, compter) => {
    const a = clubs[(i * 11 + 3) % clubs.length], b = clubs[(i * 17 + 7) % clubs.length];
    const m = nouveauMatch(equipeDeTable(a.nom, a.tag, a.roster, 'A'), equipeDeTable(b.nom, b.tag, b.roster, 'B'), `recrue-${i}`, { recrue: 'B' });
    /*
     * UNE MAIN, C'EST UN OBJET `m.main` : `finirMain` et `finirPresence` en
     * posent un neuf. On compte donc par objet, pas par appel d'`iaPresence`
     * — sa boucle continue tant que la main est au même camp, et quand la
     * période finit sur le geste de la recrue, la période suivante s'ouvre
     * sur SA main : deux mains, pas une main de deux gestes.
     */
    const parMain = new Map();
    let garde = 0;
    while (!m.fini && garde++ < 20000) {
      const main = m.main, cote = m.tour;
      const g = iaGeste(m);
      if (m.tour === cote && m.main === main && !g && !m.fini) finirMain(m);   // comme `iaPresence` : la main rend toujours
      if (!compter || !g) continue;
      const x = parMain.get(main) || { cote, gestes: 0 };
      if (g.type !== 'reception') x.gestes++;
      if (cote === 'B' && g.jet && g.jet.relance) relancesDepensees++;
      parMain.set(main, x);
    }
    for (const x of parMain.values()) {
      if (x.cote === 'B') { mainsRecrue++; if (x.gestes > 1) deuxGestes++; }
      else { mainsPro++; gestesPro += x.gestes; }
    }
    return resultatDe(m);
  };
  for (let i = 0; i < N; i++) {
    const r1 = jouer(i, true), r2 = jouer(i, false);
    if (r1.gfA !== r2.gfA || r1.gfB !== r2.gfB || r1.fil.length !== r2.fil.length) differents++;
  }
  const regles = [
    ['la recrue joue un seul geste par main (le tir sur réception en plus)', !deuxGestes, `${deuxGestes} main(s) sur ${mainsRecrue} avec deux gestes`],
    ['la recrue ne dépense jamais sa relance d\'équipe', !relancesDepensees, `${relancesDepensees} relance(s)`],
    ['la même graine rejoue le même match Recrue', !differents, `${differents} match(s) sur ${N} différents`],
    ['le camp Pro joue encore des mains entières', mainsPro > 0 && gestesPro / mainsPro > 1.3, `${(gestesPro / Math.max(1, mainsPro)).toFixed(2)} geste(s) par main`],
  ];
  console.log(`\nLE NIVEAU RECRUE (${N} matchs, ${mainsRecrue} mains de la recrue, ${(gestesPro / Math.max(1, mainsPro)).toFixed(2)} gestes par main en face)`);
  for (const [nomRegle, ok, detail] of regles) {
    console.log(`  ${ok ? '✓' : '✗'} ${nomRegle}${ok ? '' : `\n      ${detail}`}`);
    if (!ok) echecs++;
  }
}
if (jamaisFinis) echecs++;

process.exitCode = echecs ? 1 : 0;
