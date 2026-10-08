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
         creerLigue, jouerJournee, jouerJusqua, bilanLigue, avecHasardIsole, playGame, feuilleVierge,
         generateur, photoAlignement, CARTES, SITUATIONS, JOURS_SITUATIONS, ROULEMENTS, TACTIQUES, AGRESSIVITES, connaitre, getPlayerKey, poserAlignementDuJour } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { prevision } from '../js/pronostic.js';

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
  // La première équipe est la tienne : c'est elle que les décisions alignent, et un club de l'IA se réaligne seul (`creerLigue`).
  equipes[0].isPlayer = true;
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
 * DEUX DÉCISIONS QUI VALENT TOUTE LA SAISON (S62), donc deux décisions qui
 * doivent se comporter comme les autres : l'avant intact, la suite changée,
 * la reprise identique. Et chacune doit VRAIMENT déplacer la saison — un plan
 * décoratif est pire qu'un plan déséquilibré, puisque le joueur le choisit et
 * ne voit jamais la différence.
 */
const JOUR_PLAN = 20;
const reglage = (champ, cle) => () => [{ jour: JOUR_PLAN, [champ]: cle }];
/*
 * LE PLAN SE JOUE LIGNE PAR LIGNE depuis S68 : une décision porte les quatre
 * lignes (tactique, agressivité, secondes de présence). Chaque tactique, chaque
 * agressivité et la glace doivent déplacer la saison — rien n'est décoratif.
 */
const lignes = (tac, agr = 1, sec = 60) => [0, 1, 2, 3].map(() => ({ tac, agr, sec }));
const p1 = jouer('la-meme-graine', reglage('lignes', lignes('echec', 2)));
const p2 = jouer('la-meme-graine', reglage('lignes', lignes('echec', 2)));
dire(a.jours.slice(0, JOUR_PLAN).join('\n') === p1.jours.slice(0, JOUR_PLAN).join('\n'),
  `des lignes au jour ${JOUR_PLAN} laissent les ${JOUR_PLAN} journées d'avant identiques`);
dire(a.jours.slice(JOUR_PLAN).join('\n') !== p1.jours.slice(JOUR_PLAN).join('\n'), 'et changent ce qui suit');
dire(p1.feuilles === p2.feuilles && p1.joueurs === p2.joueurs, 'les mêmes lignes se rejouent à l\'identique');
const tacMortes = Object.keys(TACTIQUES)
  .filter(cle => jouer('la-meme-graine', reglage('lignes', lignes(cle))).feuilles === a.feuilles);
dire(!tacMortes.length, tacMortes.length ? `tactiques sans effet : ${tacMortes.join(', ')}`
  : `les ${Object.keys(TACTIQUES).length} tactiques déplacent la saison`);
const hourraMoyen = jouer('la-meme-graine', reglage('lignes', lignes('hourra', 1))).feuilles;
const agrMortes = [0, 2, 3].filter(i => jouer('la-meme-graine', reglage('lignes', lignes('hourra', i))).feuilles === hourraMoyen);
dire(!agrMortes.length, agrMortes.length ? `agressivités sans effet : ${agrMortes.map(i => AGRESSIVITES[i].nom).join(', ')}` : 'les agressivités déplacent la saison');
const secMorte = jouer('la-meme-graine', reglage('lignes', [70, 60, 50, 40].map(sec => ({ tac: 'hourra', agr: 1, sec })))).feuilles === hourraMoyen;
dire(!secMorte, secMorte ? 'les secondes de présence sont sans effet' : 'les secondes de présence déplacent la saison');
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

/*
 * LA LIGUE AU JOUR LE JOUR (S79). JP : *tu devrais jamais simuler d'avance*.
 * Le moteur ne joue plus que ce qui est arrivé (`creerLigue`, `jouerJournee`) ;
 * `simulateLeague` n'est plus qu'un raccourci. Trois choses s'exigent :
 *   (1) jouées une à une, les journées donnent EXACTEMENT la saison d'un bloc ;
 *   (2) le hasard de la ligue est à elle : tirer ailleurs entre deux journées
 *       (un pronostic, un match d'exhibition) ne décale pas un seul dé ;
 *   (3) une décision prise EN COURS de route — ajoutée à la liste au jour J,
 *       sans rejouer l'avant — donne la même saison que la même décision
 *       connue dès le départ.
 */
function equipesNeuves() {
  return vestiaires.map(v => {
    const pool = v.pool.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    return createTeam(`${v.tag} ${v.season}`, v.tag, autoRoster(pool), { season: v.season });
  });
}
const texteDe = cal => cal.flat().map(m => `${m.A.name}|${m.B.name}|${m.gfA}-${m.gfB}${m.ot ? 'p' : ''}|${(m.feuille && m.feuille.buts.length) || 0}`).join('\n');
const joueursDe = teams => teams.flatMap(t => SLOTS.map(s => t.roster[s.i]).filter(Boolean)
  .map(p => `${p.n} ${p.simGP} ${p.simG} ${p.simA} ${p.simPM} ${p.simSV || 0}`)).join('\n');
{
  const bloc = simulateLeague(equipesNeuves(), 82, { graine: 'jour-le-jour' });
  const texteBloc = texteDe(bloc.calendrier), joueursBloc = joueursDe(bloc.standings);
  // (1) et (2) : une journée à la fois, et du hasard tiré AILLEURS entre chacune.
  const L = creerLigue(equipesNeuves(), 82, { graine: 'jour-le-jour' });
  const [x, y] = equipesNeuves();
  let n = 0;
  while (!L.fini) {
    jouerJournee(L);
    // Le pronostic, l'exhibition : du hasard pris hors de la ligue, entre deux journées.
    if (n % 7 === 0) { avecHasardIsole(`ailleurs-${n}`, () => playGame(x, y, n, false, false, feuilleVierge())); Math.random(); }
    // LA PRÉVISION (1.0, oct.) : les matchs restants rejoués sur les VRAIS clubs de la ligue, au matin — rien ne doit bouger.
    if (n === 30) prevision({ toi: L.teams[0], calendrier: L.calendrier, jourRevele: L.jour, n: 2 });
    n++;
  }
  const pas = bilanLigue(L);
  dire(texteDe(pas.calendrier) === texteBloc && joueursDe(pas.standings) === joueursBloc,
    `jouées une à une (${n} journées), avec une prévision au jour 30, les journées donnent la saison d'un bloc, au but près`);
  // Avant d'être jouée, une journée n'a ni pointage ni feuille : rien n'existe d'avance.
  const L2 = creerLigue(equipesNeuves(), 82, { graine: 'jour-le-jour' });
  jouerJusqua(L2, 20);
  const futurs = L2.calendrier.slice(20).flat();
  dire(L2.jour === 20 && futurs.length > 0 && futurs.every(m => !m.joue && m.gfA === undefined && !m.feuille)
    && L2.calendrier.slice(0, 20).flat().every(m => m.joue),
    `après 20 journées, les ${futurs.length} matchs à venir n'ont ni pointage ni feuille`);
  dire(L2.teams.every(t => t.W + t.L + t.OTL <= 20) && L2.teams.some(t => t.W + t.L + t.OTL > 0),
    'les fiches ne comptent que les matchs joués');
  // Le tiroir des trios lit `p._mutCles` : il ne porte plus la fin de l'année, seulement ce qui est arrivé.
  const cles = L2.teams.reduce((k, t) => k + SLOTS.reduce((m, s) => m + ((t.roster[s.i] && t.roster[s.i]._mutCles) || []).length, 0), 0);
  const posees = L2.teams.flatMap(t => t.mutations || []);
  dire(posees.every(m => m.jour <= L2.jour) && cles === posees.length,
    `après 20 journées, les marques des joueurs (${cles}) ne sont que les mutations déjà posées (aucune après le jour 20)`);
  // (3) la décision prise en route.
  const decider = equipes => {
    const t = equipes[0];
    const ag = i => SLOTS.find(sl => sl.group === 'F' && sl.unit === i && sl.role === 'AG' && !sl.scratch).i;
    const cases = photoAlignement(t.roster);
    [cases[ag(0)], cases[ag(3)]] = [cases[ag(3)], cases[ag(0)]];
    return { jour: 40, cases, sel: 'en-route' };
  };
  const eqConnue = equipesNeuves();
  const connue = simulateLeague(eqConnue, 82, { graine: 'jour-le-jour', decisions: [{ jour: 0, cases: photoAlignement(eqConnue[0].roster) }, decider(eqConnue)] });
  const eqRoute = equipesNeuves();
  const decs = [{ jour: 0, cases: photoAlignement(eqRoute[0].roster) }];
  const L3 = creerLigue(eqRoute, 82, { graine: 'jour-le-jour', decisions: decs });
  jouerJusqua(L3, 40);
  const avant40 = texteDe(L3.calendrier.slice(0, 40));
  decs.push(decider(eqRoute));
  jouerJusqua(L3, Infinity);
  dire(texteDe(L3.calendrier) === texteDe(connue.calendrier) && avant40 === texteDe(L3.calendrier.slice(0, 40)),
    'une décision prise en route (au jour 40, sans rejouer l\'avant) donne la même saison que connue d\'avance');
  dire(texteDe(L3.calendrier) !== texteBloc, 'et elle change bien ce qui suit');
}

/*
 * (4) LE RAPPEL D'UN BLESSÉ, PRIS EN ROUTE (1.0, oct.). Le rappelé entre en
 * réserve (ballottage) et, dans la MÊME décision, échange sa case avec un
 * habillé (`cases`). L'écran la pose tout de suite (`poserAlignementDuJour`),
 * puis le matin la refait (`appliquerDecision`) : les deux passes doivent
 * donner la saison qu'on aurait jouée en la connaissant d'avance.
 */
{
  const rappele = eqs => {
    const src = SLOTS.map(s => eqs[1].roster[s.i]).find(p => p && p.p !== 'G' && p.p !== 'D');
    const p = { ...src, id: 990001, n: 'Rappel Essai' }; delete p._rk;
    registerHiddenRatings(p); connaitre(p);
    return p;
  };
  const decider = (equipes, p) => {
    const t = equipes[0];
    const res = SLOTS.find(sl => sl.scratch && sl.group !== 'D' && !(t.roster[sl.i] && t.roster[sl.i].p === 'G'));
    const hab = SLOTS.find(sl => !sl.scratch && sl.group === 'F' && sl.unit === 0);
    const cases = photoAlignement(t.roster);
    cases[res.i] = getPlayerKey(t.roster[hab.i]); cases[hab.i] = getPlayerKey(p);
    return { jour: 30, ballottage: { i: res.i, entre: getPlayerKey(p), sort: t.roster[res.i] ? getPlayerKey(t.roster[res.i]) : null }, cases, sel: 'rappel' };
  };
  const eqC = equipesNeuves(), pC = rappele(eqC);
  const connue = simulateLeague(eqC, 82, { graine: 'rappel', decisions: [{ jour: 0, cases: photoAlignement(eqC[0].roster) }, decider(eqC, pC)] });
  const eqR = equipesNeuves(), pR = rappele(eqR);
  const decs = [{ jour: 0, cases: photoAlignement(eqR[0].roster) }];
  const L4 = creerLigue(eqR, 82, { graine: 'rappel', decisions: decs });
  jouerJusqua(L4, 30);
  decs.push(decider(eqR, pR));
  poserAlignementDuJour(L4);
  jouerJusqua(L4, Infinity);
  dire(texteDe(L4.calendrier) === texteDe(connue.calendrier), 'un rappel qui prend la case d\'un habillé, pris en route et posé tout de suite, donne la même saison que connue d\'avance');
  dire(pR.simGP > 0 && Object.values(eqR[0].roster).includes(pR), `le rappelé joue (${pR.simGP} matchs)`);
}

/*
 * (5) LA REPRISE RECRÉE TON CLUB AVEC L'ALIGNEMENT D'AUJOURD'HUI (1.0, oct.).
 * JP : *faut vraiment que le passé soit gelé*. Après une décision au jour 10
 * (le 1er trio descend au 4e, la 1re paire à la 3e), la sauvegarde rouvre la saison
 * sur l'alignement du jour 15 ; la force des clubs et leur style se
 * mesuraient sur lui, et un club voisin changeait de style : le passé se
 * rejouait autrement. Les joueurs portaient aussi les jambes d'un aperçu du
 * repêchage à la première création, pas à la reprise.
 */
{
  const echangeAG = t => {
    const cases = photoAlignement(t.roster);
    for (const [g, a, b] of [['F', 0, 3], ['D', 0, 2]]) {
      const u = n => SLOTS.filter(sl => sl.group === g && sl.unit === n && !sl.scratch).map(sl => sl.i);
      u(a).forEach((i, k) => { const j = u(b)[k]; [cases[i], cases[j]] = [cases[j], cases[i]]; });
    }
    return { jour: 10, cases, sel: 'reprise' };
  };
  const eqA = equipesNeuves();
  // Un aperçu du repêchage a fatigué et « appris » le vestiaire avant la saison.
  for (const sl of SLOTS) { const p = eqA[0].roster[sl.i]; if (p) { p.energie = 40; p._maitrise = { [sl.i]: 3 }; } }
  const decs = [{ jour: 0, cases: photoAlignement(eqA[0].roster) }];
  const LA = creerLigue(eqA, 82, { graine: 'reprise', decisions: decs });
  const forceA = JSON.stringify(LA.teams.map(t => [t.strength, t.style]));
  jouerJusqua(LA, 10);
  decs.push(echangeAG(eqA[0]));
  poserAlignementDuJour(LA);
  jouerJusqua(LA, 15);
  // La reprise : des objets neufs, ton club recréé sur l'alignement d'aujourd'hui, les mêmes décisions.
  const eqB = equipesNeuves();
  const parCle = new Map(SLOTS.map(sl => eqB[0].roster[sl.i]).filter(Boolean).map(p => [getPlayerKey(p), p]));
  for (const k of Object.keys(eqB[0].roster)) delete eqB[0].roster[k];
  for (const [i, k] of Object.entries(decs[1].cases)) eqB[0].roster[i] = parCle.get(k);
  const LB = creerLigue(eqB, 82, { graine: 'reprise', decisions: decs.map(d => ({ ...d })) });
  dire(JSON.stringify(LB.teams.map(t => [t.strength, t.style])) === forceA,
    'à la reprise, la force et le style des clubs se mesurent sur l\'alignement du jour 0, comme à la création');
  jouerJusqua(LB, 15);
  dire(texteDe(LB.calendrier.slice(0, 15)) === texteDe(LA.calendrier.slice(0, 15)),
    'une reprise qui recrée ton club sur l\'alignement d\'aujourd\'hui rejoue le même passé, au but près (jambes d\'aperçu comprises)');
}

/*
 * (6) LES DÉS DU JOUR (1.0, oct.). JP : *le principe de seed, ça suce*. La
 * graine n'écrit plus l'avenir : chaque journée tire ses dés à son matin
 * (`deDuJour`), et la sauvegarde les garde. Avec les dés gardés, le passé se
 * rejoue au but près ; au-delà, deux reprises de la même graine divergent.
 */
{
  const LA = creerLigue(equipesNeuves(), 82, { graine: 'des', des: { matins: [], soirs: [] } });
  jouerJusqua(LA, 20);
  dire(LA.des.matins.length === 21 && LA.des.soirs.length === 20 && [...LA.des.matins, ...LA.des.soirs].every(Boolean),
    `après 20 journées, 21 dés du matin (le jour 20 est arrivé) et 20 du soir (il n'est pas joué) — ${LA.des.matins.length} et ${LA.des.soirs.length}`);
  const gardes = { matins: LA.des.matins.slice(), soirs: LA.des.soirs.slice() };
  const LB = creerLigue(equipesNeuves(), 82, { graine: 'des', des: gardes });
  jouerJusqua(LB, 20);
  dire(texteDe(LB.calendrier.slice(0, 20)) === texteDe(LA.calendrier.slice(0, 20)),
    'avec les dés gardés, une reprise rejoue les 20 journées, au but près');
  jouerJusqua(LA, 40); jouerJusqua(LB, 40);
  dire(texteDe(LB.calendrier.slice(21, 40)) !== texteDe(LA.calendrier.slice(21, 40)),
    'au-delà, la même graine ne redonne pas le même avenir : chaque reprise tire ses propres dés');
  const LC = creerLigue(equipesNeuves(), 82, { graine: 'des', des: { matins: [], soirs: [] } });
  jouerJusqua(LC, 5);
  dire(texteDe(LC.calendrier.slice(0, 5)) !== texteDe(LA.calendrier.slice(0, 5)),
    'deux saisons neuves de la même graine ne jouent pas les mêmes matchs');
}

/*
 * UN JOUEUR CONNU REPART À ZÉRO MATCH (1.0, oct.). Un joueur sorti de l'alignement revient par une
 * décision datée d'avant : le moteur le retrouve parmi les connus. Il gardait les `sim*` de la saison
 * jouée avant la reprise, et `effetCarte` lit `simGP` (la recrue qui progresse après 41 matchs) : deux
 * reprises de la même partie ne rejouaient pas le même passé (le smoke, graine 7, un match vu en
 * direct qui changeait au bilan). Le même joueur, une fois avec 60 matchs au compteur, une fois avec
 * aucun : la saison doit se jouer pareil.
 */
{
  const avec = () => equipesNeuves();
  // Un avant d'un vrai vestiaire qui n'est pas de la ligue.
  let x = null;
  const autre = generateur('check_graine:connu');
  for (let k = 0; k < 200 && !x; k++) {
    const f = saisons[Math.floor(autre() * saisons.length)];
    const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
    const tags = [...new Set(shard.players.map(p => p.t))];
    const tag = tags[Math.floor(autre() * tags.length)];
    if (vus.has(`${shard.season}|${tag}`)) continue;
    let unites; try { unites = equipeReelle(shard.season, tag); } catch { continue; }
    const q = unites.flat().find(p => p.p !== 'G' && !['D', 'LD', 'RD'].includes(p.p));
    if (q) x = { ...q };
  }
  if (!x) dire(false, 'un joueur hors des alignements, pour la reprise');
  else {
    registerHiddenRatings(x);
    x._carte = { bonus: [], recrue: true };
    connaitre(x);
    let auDepart = null;
    const jouer = simGP => {
      const teams = avec(); teams[0].isPlayer = true;
      const d0 = { jour: 0, cases: photoAlignement(teams[0].roster) };
      const cases = { ...d0.cases, [SLOTS.find(s => s.group === 'F' && !s.scratch).i]: getPlayerKey(x) };
      x.simGP = simGP; x.simG = 9;
      const L = creerLigue(teams, 82, { graine: 'connus', decisions: [d0, { jour: 3, cases }] });
      auDepart = [x.simGP, x.simG];
      jouerJusqua(L, 30);
      return texteDe(L.calendrier.slice(0, 30));
    };
    const a = jouer(60), depuis60 = auDepart, b = jouer(0);
    dire(depuis60[0] === 0 && depuis60[1] === 0, `un joueur connu repart à zéro match à la création de la ligue (${depuis60.join(' matchs, ')} buts)`);
    dire(a === b, 'un joueur connu qui revient par une décision : la saison se rejoue pareil');
    // Un joueur connu APRÈS la création de la ligue (un pack signé en saison) entre à zéro match, et les compte.
    const teams = avec(); teams[0].isPlayer = true;
    const d0 = { jour: 0, cases: photoAlignement(teams[0].roster) };
    const L = creerLigue(teams, 82, { graine: 'connu-tard', decisions: [d0] });
    jouerJusqua(L, 5);
    const y = { ...x }; delete y.simGP; delete y.simG; y.n = `${x.n} (signé)`;
    connaitre(y);
    L.decisions.push({ jour: 5, cases: { ...d0.cases, [SLOTS.find(s => s.group === 'F' && !s.scratch).i]: getPlayerKey(y) } });
    jouerJusqua(L, 25);
    dire(Number.isFinite(y.simGP) && y.simGP > 0, `un joueur signé en saison compte ses matchs (${y.simGP})`);
  }
}

console.log(echecs ? `\n${echecs} échec(s)` : '\ntout se rejoue');
process.exit(echecs ? 1 : 0);
