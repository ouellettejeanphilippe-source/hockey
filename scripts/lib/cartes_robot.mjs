/*
 * CE QUE LES ROBOTS FONT DU COACH-PERSONNAGE (V21, docs/refonte-v21.md ; V22, js/adjoints.js). Le coach d'une run a ses
 * pouvoirs et sa main d'adjoints ; le robot, comme le gérant, choisit ses talents, ses adjoints, les poste et répond aux
 * histoires. Selon la politique (scripts/lib/rogue_sim.mjs) :
 *   - l'attentif lit : le talent va au pouvoir qui a le plus joué ; l'adjoint offert, celui dont le style rend le plus
 *     à SON effectif, lu au moteur (`fit`, scripts/lib/rogue_sim.mjs `fitDAdjoint` ; 31 oct. 2026), sinon celui de la
 *     voie de son coach ; dès qu'une case est libre, il poste la carte prête qui rend le plus ; à une histoire, la
 *     réponse qui rend le plus, en conséquences concrètes (l'expérience, un adjoint, des jetons, des jambes) ;
 *   - le distrait clique au hasard, sur son propre générateur ;
 *   - le robot d'avant ('defaut') prend la première option de chaque écran : un gérant grossier, qui garde un coach.
 * Le robot ne voit que ce que l'écran montre : les feuilles jouées, la cédule de la semaine, ses jambes, sa caisse.
 */
import { getPlayerKey } from '../../js/sim.js';
import { faitsDe } from '../../js/faits.js';
import { HISTOIRES, tirer } from '../../js/histoires.js';
import { PALIERS_PACK, SEMAINE } from '../../js/inventaire.js';
import { COACHS } from '../../js/coachs.js';
import { POUVOIRS, niveauDuPerso, talentsDus, pouvoirsOuverts, TALENT_CASE, SEUILS_NIVEAU } from '../../js/pouvoirs.js';
import { ADJOINTS, adjointsOfferts, pretesDe, casesLibres, niveauOffert, momentFort } from '../../js/adjoints.js';

/* MESURE seulement (jamais lu par le jeu) : ROBOT_TALENT=case ou pouvoir force le premier talent de l'attentif (scripts/mesure_main.mjs). */
const TALENT_FORCE = process.env.ROBOT_TALENT || null;

const JETON = 0.01;   // une victoire vaut une centaine de jetons, à la louche (le barème : 5 par victoire, les packs à 12 et plus)
/* Ce que vaut une conséquence, grossièrement, en victoires : un adjoint, un point d'expérience, des jambes, un match d'infirmerie. */
const VAUT = { adjoint: 0.5, xp: 0.05, jambes: 0.02, absent: 0.15, soin: 0.1 };

/* L'attentif préfère l'adjoint de la voie de son coach (la synergie : un séjour plus long), sinon le premier offert. */
const rangDe = (k, coach = null) => (coach && ADJOINTS[k] && ADJOINTS[k].voie === coach ? -1 : Object.keys(ADJOINTS).indexOf(k));
const feuillesDe = (L, you) => L.calendrier.slice(0, L.jour).flatMap((jour, j) => jour.filter(m => (m.A === you || m.B === you) && m.feuille).map(m => ({ j, m, f: m.feuille, cote: m.A === you ? 'A' : 'B' })));
/* Combien de périodes chaque pouvoir a joué cette saison, lu dans les feuilles (`feuille.pouvoirs`). */
function foisDesPouvoirs(L, you) {
  const n = [0, 0, 0];
  for (const { f, cote } of feuillesDe(L, you)) for (const x of f.pouvoirs || []) if (x.cote === cote && !x.contagion) n[x.p]++;
  return n;
}
const persoDe = you => (you.perso ? { ...you.perso, xpSaison: you.xpSaison || 0 } : null);

/* Les faits du matin, comme l'écran les lit (js/faits.js `faitsDe`), sur ce que la ligue a joué ; la run : la caisse, le coach, les histoires sorties. */
function faitsDuRobot(L, you, jetons, sorties = [], series = null) {
  const perso = persoDe(you), C = perso && COACHS[perso.cle];
  return faitsDe({ ligue: L, you, jour: series ? L.calendrier.length : L.jour, run: { jetons, sorties, places: 16, club: t => t.name || t.tag,
    coach: C ? { cle: perso.cle, nom: C.nom, ico: C.ico, niveau: niveauDuPerso(perso) } : null }, series });
}

/* L'ADJOINT D'UN MOMENT FORT (js/saison.js `adjointsDuMoment`) : un parmi trois, tirés de la graine. Rend la décision. */
function adjointDuRobot({ you, graine, cle, politique, clic, fit }) {
  const perso = persoDe(you);
  const offre = perso ? adjointsOfferts(perso, graine, cle, 3) : [];
  if (!offre.length) return null;
  // V23 : chaque carte a son niveau, tiré comme à l'écran (`niveauOffert`).
  const niv = k => niveauOffert(graine, cle, k, momentFort(cle));
  // L'attentif lit le style sur SON effectif, à son niveau (`fit`, scripts/lib/rogue_sim.mjs) ; sans lecture, la voie de son coach d'abord.
  const k = clic ? offre[Math.floor(clic() * offre.length)] : politique === 'defaut' ? offre[0]
    : fit ? offre.reduce((a, b) => (fit(b, niv(b)) > fit(a, niv(a)) ? b : a)) : offre.reduce((a, b) => (rangDe(b, perso.cle) < rangDe(a, perso.cle) ? b : a));
  return { embauche: { cle: k, niv: niv(k) } };
}
/*
 * La valeur d'une réponse d'histoire, en conséquences concrètes, pour l'attentif. `lu` (nov. 2026, scripts/lib/rogue_sim.mjs
 * `lireLeJoueur`) : le joueur nommé lu sur son club — ce qui va à lui, un dé à la moyenne de ses deux issues, ses matchs
 * d'absence, les soirs de l'auxiliaire. Sans lecture (`ROBOT_SAUF=histoires`), la valeur d'avant : un dé ne valait rien.
 * V25 C2 : les canaux du club d'un gros match ou d'une ronde (`canaux`, `lireCanaux`), lus sur son club le temps de leur durée.
 */
function valeurDeReponse(o, lu = null, lireCanaux = null) {
  const g = o.gestes || {};
  let v = (o.jetons || 0) * JETON + (o.xp || 0) * VAUT.xp + (g.adjoint ? VAUT.adjoint : 0) + (g.soin || 0) * VAUT.soin;
  if (o.gestes) v += (g.energieTous || 0) * VAUT.jambes + (g.energie || 0) * VAUT.jambes / 4
    + (lu ? lu.absent(g.absents || 0) + lu.auxiliaire(g.gardienAux || 0) : -(g.absents || 0) * VAUT.absent);
  if (lu && o.lui) v += lu.surLui(o.lui, o.duree);
  if (lu && o.pari) v += o.pari.chance * lu.surLui(o.pari.gagne.lui, o.pari.gagne.duree) + (1 - o.pari.chance) * lu.surLui(o.pari.perd.lui, o.pari.perd.duree);
  if (lireCanaux && o.canaux) v += lireCanaux(o.canaux, o.duree || 1);
  return v;
}
/*
 * UNE HISTOIRE, LUE ET RÉPONDUE (V25 C2) : le même tirage que l'écran (`tirer`, sur les sorties de la saison et la mémoire de
 * la run), une réponse — le distrait au hasard, le robot d'avant la première, l'attentif celle qui rend le plus — et la
 * décision que la porte joue (js/greffes.js `appliquerChoix`), comme l'écran l'écrit (js/saison.js `decisionDHistoire`).
 * L'échange d'un joueur nommé reste au gérant : le robot ne signe personne. Rend la décision, ou null.
 */
function histoireDuRobot({ moment, id, f, j = f.jour, graine, politique, clic, etat, you, lire }) {
  const cle = tirer(graine, moment, f, [...(etat.avant || []), ...etat.histoires]);
  if (!cle) return null;
  const H = HISTOIRES[cle], lui = H.joueur(f), joueurs = H.joueurs ? H.joueurs(f) : lui ? [lui] : [];
  const possibles = H.options.filter(o => !(o.jetons < 0 && f.caisse != null && f.caisse < -o.jetons) && !(o.gestes && o.gestes.echange));
  if (!possibles.length) return null;
  const entree = { cle, choix: null, joueur: lui ? lui.cle : null, joueurs: joueurs.map(x => x.cle), j };
  etat.histoires.push(entree);
  // L'attentif lit le joueur nommé sur son club (`lire.joueur`), une fois pour toutes les réponses, et les canaux du club.
  const lit = !clic && politique !== 'defaut' && lire;
  const lu = lit && lui && lire.joueur ? lire.joueur(lui.cle) : null;
  const canaux = lit && lire.canaux ? lire.canaux : null;
  const o = clic ? possibles[Math.floor(clic() * possibles.length)] : politique === 'defaut' ? possibles[0]
    : possibles.reduce((b, x) => (valeurDeReponse(x, lu, canaux) > valeurDeReponse(b, lu, canaux) ? x : b));
  entree.choix = o.cle;
  const perso = persoDe(you);
  const offert = o.gestes && o.gestes.adjoint && perso ? adjointsOfferts(perso, graine, id, 1)[0] || null : null;
  return { palier: id, moment: { famille: 'histoire', cle, choix: o.cle, ...(lui ? { joueur: lui.cle, joueurs: joueurs.map(x => x.cle) } : {}) },
    ...(o.jetons ? { gain: o.jetons } : {}), ...(o.xp ? { xpCoach: o.xp } : {}),
    ...(offert ? { embauche: { cle: offert, niv: niveauOffert(graine, id, offert) } } : {}) };
}

/*
 * LE LUNDI DU ROBOT : l'histoire du lundi (un lundi tiré de la graine, V20 ; V25 C1 : js/histoires.js) et celle du matin d'un
 * gros match (V25 C2 : le jour même, jamais la veille, comme l'écran), l'adjoint d'un palier (quand le compte de matchs le
 * franchit), le butin d'un gros match gagné, le talent quand le niveau le donne, et les cartes qu'il poste. Rend les
 * décisions à pousser au jour de la ligue. `etat` : ce que la saison retient (les histoires sorties, la mémoire de la run,
 * les paliers et les butins pris).
 */
export function lundiDuRobot({ L, you, graine, politique, clic, jetons, etat, fit = null, lire = null }) {
  const out = [];
  const auHasard = l => l[Math.floor(clic() * l.length)];
  const j = L.jour;
  const lundi = j % SEMAINE === 0 && j < L.calendrier.length;
  const f = faitsDuRobot(L, you, jetons, etat.histoires);
  // L'HISTOIRE DU LUNDI, puis celle du matin d'un gros match (annoncé la veille, `grosAnnonces` ; js/saison.js `histoireOuverte`).
  const joueCeSoir = (L.calendrier[j] || []).some(m => m.A === you || m.B === you);
  const moments = [...(lundi ? ['lundi'] : []), ...(joueCeSoir && L.grosAnnonces && L.grosAnnonces[j] ? ['gros'] : [])];
  for (const moment of moments) {
    const d = histoireDuRobot({ moment, id: `h:${moment}:${j}`, f: moment === 'lundi' ? f : faitsDuRobot(L, you, jetons, etat.histoires), graine, politique, clic, etat, you, lire });
    if (d) out.push({ jour: j, ...d });
  }
  // LE PALIER (`PALIERS_PACK`, js/inventaire.js) : un adjoint parmi trois.
  const pp = PALIERS_PACK.find(x => f.n >= x && !etat.paliers.has(x));
  if (pp !== undefined) {
    etat.paliers.add(pp);
    const d = adjointDuRobot({ you, graine, cle: `pp${pp}`, politique, clic, fit });
    if (d) out.push({ jour: j, palier: `pp:${pp}`, ...d });
  }
  // LA PIÈCE D'UN RIVAL BATTU (V27, tranche 2 ; js/saison.js, l'étape « Prendre une pièce ») : tant que le banc de cinq
  // n'existe pas, le niveau suivant du coach — chaque robot la prend, comme on prend une carte offerte.
  for (const mb of (you.minisBoss || []).filter(x => x.gagne && !etat.butins.has(x.jour))) {
    etat.butins.add(mb.jour);
    const tot = ((you.perso && you.perso.xp) || 0) + (you.xpSaison || 0), suivant = SEUILS_NIVEAU.find(s => s > tot);
    out.push({ jour: j, palier: `r:${mb.jour}`, ...(suivant ? { xpCoach: suivant - tot } : {}) });
  }
  // POSTER (V22) : une case libre et une carte prête, l'attentif la poste (celle de sa voie d'abord), le distrait une au hasard ;
  // le robot d'avant ne poste rien. Une décision `poste` par case libre, le jour même ; une carte qui entre aujourd'hui attend lundi.
  const P0 = persoDe(you);
  if (P0 && politique !== 'defaut') {
    const games = you.games || 0;
    let libres = casesLibres(P0, games, niveauDuPerso(P0));
    // Celle qui rend le plus à son effectif d'abord (`fit`) ; sans lecture, la voie de son coach.
    const nivs = new Map(pretesDe(P0, games).map(c => [c.cle, c.niv]));
    const pretes = pretesDe(P0, games).map(c => c.cle).sort((a, b) => (fit ? fit(b, nivs.get(b)) - fit(a, nivs.get(a)) : rangDe(a, P0.cle) - rangDe(b, P0.cle)));
    while (libres > 0 && pretes.length) { const k = clic ? pretes.splice(Math.floor(clic() * pretes.length), 1)[0] : pretes.shift(); out.push({ jour: j, poste: { cle: k } }); libres--; }
  }
  // LE TALENT (niveaux 2 et 4) : le pouvoir qui a le plus joué grandit ; le distrait, au hasard ; le robot d'avant, le premier.
  // Au premier (nov. 2026), la case d'adjoint de plus et sa carte sont l'autre réponse (`TALENT_CASE`, la carte tirée comme à
  // l'écran) : l'attentif la prend quand son pouvoir I a joué moins d'un match sur deux (grandi, il rendrait peu), le distrait
  // au hasard, le robot d'avant jamais (le pouvoir est la première réponse).
  // Nov. 2026 (`lire.talent`, scripts/lib/rogue_sim.mjs `valeurDuTalent`) : l'attentif lit ce que chaque pouvoir grandi
  // rend à son club, en victoires par saison, contre la case (`lire.case`) ; sans lecture (`ROBOT_SAUF=talent`), la règle d'avant.
  const perso = persoDe(you);
  if (perso && talentsDus(niveauDuPerso(perso), perso.talents) > 0) {
    const ouverts = pouvoirsOuverts(niveauDuPerso(perso)), fois = foisDesPouvoirs(L, you), premier = !perso.talents.length;
    const soirs = new Set(feuillesDe(L, you).filter(({ f, cote }) => (f.pouvoirs || []).some(x => x.cote === cote && x.p === 0 && !x.contagion)).map(x => x.m)).size;
    const reponses = premier ? [...ouverts, TALENT_CASE] : ouverts;
    const forcee = premier && TALENT_FORCE && politique === 'attentif' ? (TALENT_FORCE === 'case' ? TALENT_CASE : 0) : null;
    const lus = !clic && politique !== 'defaut' && lire && lire.talent ? new Map(ouverts.map(q => [q, lire.talent(perso, q)])) : null;
    const meilleur = lus ? ouverts.reduce((a, b) => (lus.get(b) > lus.get(a) ? b : a)) : null;
    const p = forcee !== null ? forcee : clic ? auHasard(reponses) : politique === 'defaut' ? ouverts[0]
      : lus ? (premier && lire.case > lus.get(meilleur) ? TALENT_CASE : meilleur)
      : premier && soirs * 2 < Math.max(1, you.games || 0) ? TALENT_CASE : ouverts.reduce((a, b) => (fois[b] >= fois[a] ? b : a));
    const offert = p === TALENT_CASE ? adjointsOfferts(perso, graine, 'ta0', 1)[0] || null : null;
    out.push({ jour: j, palier: `ta:${perso.talents.length}`, talent: { p }, ...(offert ? { embauche: { cle: offert, niv: niveauOffert(graine, 'ta0', offert) } } : {}) });
  }
  return out;
}

/*
 * LA RONDE DU ROBOT (V25 C2) : le matin du premier match d'une ronde de séries (`S.k` à 0, sa série en cours), l'histoire de
 * la ronde comme l'écran la tire (js/saison.js `histoireDeRonde` : les faits au jour des séries, la ronde, sa série et celle
 * d'avant). Rend la décision de la ronde (`h:po{r}`, `match_no` 0), ou null ; une seule par ronde.
 */
export function rondeDuRobot({ S, L, you, graine, politique, clic, jetons, etat, lire = null }) {
  const r = S.ronde, s = S.k === 0 ? S.courante.find(x => (x.A === you || x.B === you) && x.wA < 4 && x.wB < 4) : null;
  if (!s || etat.rondes.has(r)) return null;
  etat.rondes.add(r);
  const precedente = r > 0 ? S.toutes.find(x => x.ronde === r - 1 && (x.A === you || x.B === you)) || null : null;
  const f = faitsDuRobot(L, you, jetons, etat.histoires, { k: r + 1, s, precedente });
  const d = histoireDuRobot({ moment: 'ronde', id: `h:po${r}`, f, j: L.calendrier.length + r, graine, politique, clic, etat, you, lire });
  return d ? { ronde: r, match_no: 0, ...d } : null;
}

/*
 * L'ENTRAÎNEUR DU DÉPART D'UNE RUN : le même loto de trois vraies cartes que le jeu (js/coachs-reels.js) ; l'attentif
 * prend celle que ses pouvoirs rendent le plus à son effectif (`fit`, scripts/lib/rogue_sim.mjs `fitDeCoach` ; la
 * couleur de l'effectif, essayée, lui coûtait 1,6 V par saison) ; le distrait n'importe laquelle ; le robot d'avant la
 * première. Rend la carte.
 */
export function coachDuRobot(loto, { politique, clic, fit }) {
  if (clic) return loto[Math.floor(clic() * loto.length)];
  if (politique === 'attentif' && fit) { const f = loto.map(fit); return loto[f.indexOf(Math.max(...f))]; }
  return loto[0];
}
