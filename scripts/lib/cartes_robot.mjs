/*
 * CE QUE LES ROBOTS FONT DU COACH ET DE SON BANC (V21, docs/refonte-v21.md ; V27, tranche 5, js/pieces.js). Le coach d'une
 * run a son banc de cinq pièces ; le robot, comme le gérant, prend une pièce parmi trois (un rival ou une élite battus, la
 * boutique, une fourche), dit qui sort quand le banc est plein, et répond aux histoires. Selon la politique
 * (scripts/lib/rogue_sim.mjs) :
 *   - l'attentif lit : la pièce offerte, celle qui rend le plus à SON effectif, lue au moteur (`fit`,
 *     scripts/lib/rogue_sim.mjs `fitDePiece`), sinon celle de la voie de son coach ; banc plein, elle remplace celle qui
 *     rend le moins, si elle rend plus ; à une histoire, la réponse qui rend le plus, en conséquences concrètes ;
 *   - le distrait clique au hasard, sur son propre générateur ;
 *   - le robot d'avant ('defaut') prend la première option de chaque écran : un gérant grossier, qui garde un coach ; banc
 *     plein, la neuve prend la dernière case.
 * Le robot ne voit que ce que l'écran montre : les feuilles jouées, la cédule de la semaine, ses jambes, sa caisse. Il pose,
 * prend et remplace ses pièces par les fonctions du jeu (`piecesOffertes`, `bancDe`, la décision `piece`).
 */
import { faitsDe } from '../../js/faits.js';
import { HISTOIRES, tirer } from '../../js/histoires.js';
import { SEMAINE } from '../../js/inventaire.js';
import { COACHS } from '../../js/coachs.js';
import { PIECES, CASES_DU_BANC, bancDe, piecesOffertes, poserLaPiece } from '../../js/pieces.js';
import { COEURS, CONTROLES, aLaTaille, etatDeLaRun, eliteDeLaSemaine, decisionDElite } from '../../js/actes.js';

const JETON = 0.01;   // une victoire vaut une centaine de jetons, à la louche (le barème : 5 par victoire, les packs à 12 et plus)
/* Ce que vaut une conséquence, grossièrement, en victoires : une pièce, des jambes, un match d'infirmerie. */
const VAUT = { piece: 0.5, jambes: 0.02, absent: 0.15, soin: 0.1 };

/* Sans lecture, la pièce de la voie de son coach d'abord, puis l'ordre de la famille. */
const rangDe = (k, coach = null) => (coach && PIECES[k] && PIECES[k].voie === coach ? -1 : Object.keys(PIECES).indexOf(k));

/* Les faits du matin, comme l'écran les lit (js/faits.js `faitsDe`), sur ce que la ligue a joué ; la run : la caisse, le coach, les histoires sorties, les fourches. */
function faitsDuRobot(L, you, jetons, sorties = [], series = null, fourches = 0) {
  const perso = you.perso, C = perso && COACHS[perso.cle];
  return faitsDe({ ligue: L, you, jour: series ? L.calendrier.length : L.jour, run: { jetons, sorties, fourches, places: 16, club: t => t.name || t.tag,
    coach: C ? { cle: perso.cle, nom: C.nom, ico: C.ico, banc: bancDe(perso).length } : null }, series });
}

/*
 * PRENDRE UNE PIÈCE (V27, tranche 5 ; l'écran de js/gerant.js `ouvrirPiece`) : une parmi `offre` (des clés), puis, banc
 * plein, celle qui sort. Rend { cle, sort? }, ou null (passer : l'attentif ne remplace pas une pièce qui rend plus).
 */
export function pieceDuRobot({ you, offre, politique, clic, fit }) {
  const perso = you.perso;
  if (!perso || !offre.length) return null;
  const banc = bancDe(perso), plein = banc.length >= CASES_DU_BANC;
  const lu = fit && !clic && politique !== 'defaut' ? new Map([...offre, ...banc].map(k => [k, fit(k)])) : null;
  const cle = clic ? offre[Math.floor(clic() * offre.length)] : politique === 'defaut' ? offre[0]
    : lu ? offre.reduce((a, b) => (lu.get(b) > lu.get(a) ? b : a)) : offre.reduce((a, b) => (rangDe(b, perso.cle) < rangDe(a, perso.cle) ? b : a));
  if (!plein) return { cle };
  const sort = clic ? banc[Math.floor(clic() * banc.length)] : politique === 'defaut' || !lu ? banc[banc.length - 1] : banc.reduce((a, b) => (lu.get(b) < lu.get(a) ? b : a));
  return lu && lu.get(sort) >= lu.get(cle) ? null : { cle, sort };
}
/*
 * LA PIÈCE PRISE, POSÉE TOUT DE SUITE sur le banc du robot : deux pièces du même jour (un rival battu, puis la boutique) ne
 * visent pas la même case. Le moteur la rejoue pareil à son jour (`poserLaPiece` ne pose pas deux fois). Rend la pièce.
 */
export function poserDuRobot(you, piece) {
  if (piece && you.perso) you.perso = { ...you.perso, banc: poserLaPiece(you.perso.banc, piece.cle, piece.sort || null) };
  return piece;
}
/*
 * La valeur d'une réponse d'histoire, en conséquences concrètes, pour l'attentif. `lu` (nov. 2026, scripts/lib/rogue_sim.mjs
 * `lireLeJoueur`) : le joueur nommé lu sur son club — ce qui va à lui, un dé à la moyenne de ses deux issues, ses matchs
 * d'absence, les soirs de l'auxiliaire. Sans lecture (`ROBOT_SAUF=histoires`), la valeur d'avant : un dé ne valait rien.
 * V25 C2 : les canaux du club d'un gros match ou d'une ronde (`canaux`, `lireCanaux`), lus sur son club le temps de leur durée.
 */
function valeurDeReponse(o, lu = null, lireCanaux = null) {
  const g = o.gestes || {};
  let v = (o.jetons || 0) * JETON + (g.piece ? VAUT.piece : 0) + (g.soin || 0) * VAUT.soin;
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
function histoireDuRobot({ moment, id, f, j = f.jour, graine, politique, clic, etat, you, lire, fit = null }) {
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
  // LA PIÈCE D'UNE FOURCHE (V27, tranche 5) : la première tirée pour cette histoire, comme l'écran ; banc plein, qui sort.
  const offert = o.gestes && o.gestes.piece && you.perso ? piecesOffertes(you.perso, graine, id, 1)[0] || null : null;
  const piece = offert ? poserDuRobot(you, pieceDuRobot({ you, offre: [offert], politique, clic, fit })) : null;
  if (piece) etat.fourches = (etat.fourches || 0) + 1;
  return { palier: id, moment: { famille: 'histoire', cle, choix: o.cle, ...(lui ? { joueur: lui.cle, joueurs: joueurs.map(x => x.cle) } : {}) },
    ...(o.jetons ? { gain: o.jetons } : {}), ...(piece ? { piece } : {}) };
}

/*
 * LE LUNDI DU ROBOT : l'histoire du lundi (un lundi tiré de la graine, V20 ; V25 C1 : js/histoires.js) et celle du matin d'un
 * gros match (V25 C2 : le jour même, jamais la veille, comme l'écran), puis la pièce d'un rival ou d'une élite battus (V27,
 * tranche 5 ; js/saison.js, l'étape « Prendre une pièce » : une parmi trois, de sa philosophie et des voisines). Rend les
 * décisions à pousser au jour de la ligue. `etat` : ce que la saison retient (les histoires sorties, la mémoire de la run,
 * les butins pris, les fourches).
 */
export function lundiDuRobot({ L, you, graine, politique, clic, jetons, etat, fit = null, lire = null }) {
  const out = [];
  const j = L.jour;
  const lundi = j % SEMAINE === 0 && j < L.calendrier.length;
  const faits = () => faitsDuRobot(L, you, jetons, etat.histoires, null, etat.fourches || 0);
  const f = faits();
  // L'HISTOIRE DU LUNDI, puis celle du matin d'un gros match (annoncé la veille, `grosAnnonces` ; js/saison.js `histoireOuverte`).
  const joueCeSoir = (L.calendrier[j] || []).some(m => m.A === you || m.B === you);
  const moments = [...(lundi ? ['lundi'] : []), ...(joueCeSoir && L.grosAnnonces && L.grosAnnonces[j] ? ['gros'] : [])];
  for (const moment of moments) {
    const d = histoireDuRobot({ moment, id: `h:${moment}:${j}`, f: moment === 'lundi' ? f : faits(), graine, politique, clic, etat, you, lire, fit });
    if (d) out.push({ jour: j, ...d });
  }
  // LA PIÈCE D'UN DUEL GAGNÉ (V27, tranche 5) : une parmi trois, ou passer ; chaque robot la prend comme le joueur.
  for (const mb of (you.minisBoss || []).filter(x => x.gagne && !etat.butins.has(x.jour))) {
    etat.butins.add(mb.jour);
    const piece = you.perso ? poserDuRobot(you, pieceDuRobot({ you, offre: piecesOffertes(you.perso, graine, `r:${mb.jour}`, undefined, { voisines: true }), politique, clic, fit })) : null;
    out.push({ jour: j, palier: `r:${mb.jour}`, ...(piece ? { piece } : {}) });
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
  const f = faitsDuRobot(L, you, jetons, etat.histoires, { k: r + 1, s, precedente }, etat.fourches || 0);
  const d = histoireDuRobot({ moment: 'ronde', id: `h:po${r}`, f, j: L.calendrier.length + r, graine, politique, clic, etat, you, lire });
  return d ? { ronde: r, match_no: 0, ...d } : null;
}

/*
 * L'ENTRAÎNEUR DU DÉPART D'UNE RUN : le même loto de trois vraies cartes que le jeu (js/coachs-reels.js) ; l'attentif
 * prend celle dont la pièce de départ rend le plus à son effectif (`fit`, scripts/lib/rogue_sim.mjs `fitDeCoach` ; la
 * couleur de l'effectif, essayée, lui coûtait 1,6 V par saison) ; le distrait n'importe laquelle ; le robot d'avant la
 * première. Rend la carte.
 */
export function coachDuRobot(loto, { politique, clic, fit }) {
  if (clic) return loto[Math.floor(clic() * loto.length)];
  if (politique === 'attentif' && fit) { const f = loto.map(fit); return loto[f.indexOf(Math.max(...f))]; }
  return loto[0];
}

/*
 * L'ÉLITE DU ROBOT (V27, tranche 7 ; js/actes.js `eliteDeLaSemaine`) : le lundi, l'élite que l'écran propose, prise comme le
 * joueur la prend (la décision `elite`, `decisionDElite`). `elites` : 'toutes' (le glouton, même au dernier cœur), 'jamais'
 * (« premier », le naïf, le prudent), ou 'prudent' (l'attentif : ses deux cœurs, le contrôle de l'acte tenu au classement de
 * l'écran, `etatDeLaRun`, et la chance que l'écran montre à `CHANCE_ELITE` ou plus — le réglage R1, 8 nov. 2026 ; ce n'est
 * pas une règle du jeu, l'élite reste proposée à toute chance). Rend { e, d } (l'élite et sa décision), ou null.
 */
export const CHANCE_ELITE = 0.40;
export function eliteDuRobot(L, elites) {
  if (elites === 'jamais' || L.jour % SEMAINE) return null;
  const you = L.teams.find(t => t.isPlayer), n = L.teams.length;
  const E = etatDeLaRun({ calendrier: L.calendrier, teams: L.teams, you, rivaux: L.rivaux || [], annonces: L.grosAnnonces, jour: L.jour });
  const e = E.mort ? null : eliteDeLaSemaine(L);
  if (!e || (elites === 'prudent' && (E.coeurs < COEURS || E.rang > aLaTaille(e.acte < 2 ? CONTROLES[e.acte] : 16, n) || e.chance < CHANCE_ELITE))) return null;
  return { e, d: { jour: L.jour, ...decisionDElite(e) } };
}
