/*
 * DERRIÈRE LE BANC (sorti de js/game.js en 1.0) : les décisions en saison —
 * permuter, monter un réserviste, le trio de fermeture, poser une
 * amélioration — et l'écran de saison qui les reçoit.
 */

import { compterFeuilles, planDe, roulementDe, lignesDe, trioDeFermetureAuto, getPlayerKey, photoAlignement, nouvelleGraine, CARTES, connaitre, poserAlignementDuJour, activeLineup, profilPrincipal, MUTATIONS, systemeDe, SLOTS, getPersonKey, effetsEnCours, soirEreintant, createTeam, creerLigue, jouerJusqua, simulate, bilanLigue } from './sim.js';
import { ajouterAuCartable } from './cartable.js';
import { nomDuClub } from './club.js';
import { chargerTable } from './charge-table.js';
import { CARTES_MATCH } from './combat.js';
import { BANQUE, palierAllume, coachsActifs } from './banque.js';
import { COACHS, SEUILS, ROMAINS, effetDePalier } from './coachs.js';
import { groupeDe as groupeDuBallottage, candidatsBallottage as candidatsPurs } from './ballottage.js';
import { money, esc, pct3 } from './util.js';
import { ouvrirEcranSeries, teamLabel, runPlayoffs, nombreEnSeries, renderResult, teamShort, tagCourt } from './bilan.js';
import { effetsHtml } from './gerant.js';
import { getTeamLogoHtml, getTeamBand } from './logos.js';
import { ouvrirSaison } from './saison.js';
import { mandatDe, MANDATS, JETONS } from './rogue.js';
import { $, G, MODE, positionLabel, alignementAuCartable, applyTeamColors, buildOpponents, capHitDuJour, capLeft, estRenfort, headshotHtml, isPicked, majEntete, quiEst, render, saveGame, setOption, setView, slotsLeft, toast } from './game.js';
import { apercuJoueur, carteAuCartable, carteMiniHtml, getShard, ligneDuChoix, ouJoue, pastilleNiveau, poserCartes, quiSortOuCaseLibre, rareteJoueur, renderCap, slotShort } from './repechage.js';
import { renderMain } from './alignement.js';
import { bloqueParLePlafond, cartesAJouer, finDeSaisonRogue, jetonsRogue, majRunRogue, numeroDeSaison, ouvrirBoutique, ouvrirInventaireJeu, rouvrirPackJoueurs } from './rogue-jeu.js';
import { syncOptionsUI } from './partie.js';
import { lienJoueur, porteeRevele } from './fiche.js';

/* ======================================================================
   DERRIÈRE LE BANC — les choix en saison
   ======================================================================
   JP : *faire que ya plus de choix à faire pendant la saison* ; *ça peut être
   nice de pouvoir faire des lockdown lines qui bloquent mieux les
   adversaires*. La saison se jouait d'un coup et l'écran révélait ; ce qu'on
   avait signé au repêchage était l'alignement des 82 matchs, blessures
   comprises. Le moteur étant déterministe, une décision au jour k rejoue les
   k premières journées à l'identique et diverge ensuite (`simulateLeague`,
   `decisions`) — c'est ce qui permet de fermer l'écran de saison, de
   toucher à ses trios, et de reprendre exactement là.

   Ce qu'on voit derrière le banc est CE QUI EST ARRIVÉ, jamais ce qui va
   arriver : les fiches se cumulent des feuilles des journées révélées
   (`compterFeuilles`), les blessés sont ceux du jour avec les matchs qu'il
   leur reste. Les compteurs `sim*` des joueurs, eux, portent la fin de la
   saison — on ne les lit pas ici.
   ====================================================================== */

/** L'écran de saison se retire ; l'alignement s'ouvre avec les fiches à ce jour. */
function ouvrirBanc(jour) {
  const L = G.ligue;
  if (!L || !L.calendrier) return;
  const vus = L.calendrier.slice(0, jour);
  const compte = compterFeuilles(vus.flat().map(m => m.feuille));
  const miens = vus.map(j => j.find(m => m.A === L.you || m.B === L.you)).filter(Boolean);
  const fiche = { W: 0, L: 0, OTL: 0 };
  for (const m of miens) {
    const gagne = (m.A === L.you) === (m.gfA > m.gfB);
    if (gagne) fiche.W++; else if (m.ot) fiche.OTL++; else fiche.L++;
  }
  // Les blessés à ce jour, comme l'écran de saison les compte (`at` est le
  // numéro du match de l'équipe, pas de la journée).
  const joues = miens.length;
  const blesses = new Map();
  for (const b of (L.you.injuriesLog || [])) {
    const reste = b.at + b.games - (joues + 1);
    if (b.at <= joues + 1 && reste > 0) blesses.set(b.player, reste);
  }
  /*
   * QUI JOUE À LA PLACE D'UN BLESSÉ, dit dans l'alignement même. JP : *quand
   * un joueur est descendu ou remonté, genre blessure, le faire dans la page
   * alignement*. `activeLineup` sur tes cases d'aujourd'hui : le blessé garde
   * la sienne (il y revient), et sa case nomme celui qui la joue ce soir.
   */
  const remplace = new Map(), monte = new Map();
  const ce_soir = activeLineup({ ...L.you, injured: blesses, jourCourant: jour });
  for (const s of SLOTS) {
    const p = G.roster[s.i], q = ce_soir[s.i];
    if (s.scratch || !p || !blesses.has(p) || q === p) continue;
    remplace.set(p, q || null);
    if (q) monte.set(q, p);
  }
  let prochain = null;
  for (let j = jour; j < L.calendrier.length && !prochain; j++) {
    const m = L.calendrier[j].find(x => x.A === L.you || x.B === L.you);
    if (m) prochain = { j, adv: m.A === L.you ? m.B : m.A };
  }
  const derniere = (L.decisions || [])[L.decisions.length - 1] || {};
  /*
   * LES RÉGLAGES EN VIGUEUR SE LISENT SUR L'ÉQUIPE, jamais sur la dernière
   * décision : celle-ci peut être une CARTE, qui ne porte ni fermeture, ni
   * plan, ni roulement — et le banc remettrait alors tout à « auto » en
   * écrivant sa décision, donc effacerait un choix en silence.
   */
  G.banc = {
    jour, compte, blesses, remplace, monte, prochain, fiche, N: L.calendrier.length,
    fermeture: L.you.fermeture ?? derniere.fermeture ?? 'auto',
    plan: planDe(L.you), roulement: roulementDe(L.you),
    // Les lignes EN VIGUEUR et leur état au jour du banc (S68).
    lignes: lignesDe(L.you, G.roster),
    chimie: ((L.you.jourLignes || [])[jour] || {}).chimie || [0, 0, 0, 0],
    energie: ((L.you.jourLignes || [])[jour] || {}).energie || {},
    apprentissage: ((L.you.jourLignes || [])[jour] || {}).apprentissage || null,
  };
  $('game').classList.add('banc');
  G.selectedSlot = null; G.target = null;
  setView('roster');
  render();
  // Le panneau du banc est la première chose à voir : on remonte après le
  // rendu, pas avant (l'écran de saison vient de rendre le défilement au corps).
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

/** Le trio de fermeture tel que le banc le montre : le désigné, ou celui que 'auto' prendrait. */
export function fermetureCourante() {
  if (!G.banc) return null;
  return G.banc.fermeture === 'auto' ? trioDeFermetureAuto() : G.banc.fermeture;
}

/** Retour au match : la décision entre dans la liste, la saison se rejoue de la graine et reprend là. */
export async function reprendreSaison() {
  const b = G.banc;
  if (!b || !G.ligue) return;
  // LES RÉSERVISTES RELÂCHÉS (S80) : leur carte va au cartable, et la décision les nomme (la reprise les exclut des adversaires rebâtis).
  const relaches = (b.relaches || []).filter(x => !Object.values(G.roster).some(p => p && getPlayerKey(p) === x.sort));
  for (const x of relaches) carteAuCartable(x.sort);
  if (relaches.length) toast(`${relaches.length > 1 ? `${relaches.length} réservistes relâchés` : 'Un réserviste relâché'} : ${relaches.length > 1 ? 'leurs cartes sont' : 'sa carte est'} dans ton cartable.`);
  // EN SÉRIES (S69), le banc renvoie aux séries : c'est une décision de série.
  if (b.serie) {
    G.banc = null;
    $('game').classList.remove('banc');
    await deciderSerie({ ronde: b.serie.ronde, match_no: b.serie.k, cases: photoAlignement(G.roster), fermeture: b.fermeture, lignes: b.lignes, ...(relaches.length ? { relache: relaches } : {}) });
    return;
  }
  // Le SEL (S68) : des dés neufs pour la suite, voir `simulateLeague`.
  const d = { jour: b.jour, cases: photoAlignement(G.roster), fermeture: b.fermeture, lignes: b.lignes, sel: nouvelleGraine() };
  // Une décision de banc du même jour remplacée garde ses relâchés : ils sont partis pour de bon.
  const avant = (G.ligue.decisions || []).filter(x => x.jour === b.jour && x.jour !== 0 && x.cases && Array.isArray(x.relache)).flatMap(x => x.relache);
  if (avant.length || relaches.length) d.relache = [...avant, ...relaches];
  // On ne remplace que la décision de BANC du même jour : une carte, un plan
  // du soir ou un dilemme pris ce jour-là restent.
  const decisions = (G.ligue.decisions || []).filter(x => x.jour !== b.jour || x.jour === 0 || !x.cases);
  decisions.push(d);
  G.banc = null;
  $('game').classList.remove('banc');
  renderMain();
  // La MÊME saison, avec une décision de plus : elle garde son entrée d'historique.
  await continuerSaison(decisions, b.jour, 'La saison reprend avec ton alignement…');
}

/*
 * PRENDRE UNE CARTE DE SAISON. C'est une DÉCISION comme le banc : elle entre
 * dans `G.ligue.decisions`, donc dans la sauvegarde, et la saison se rejoue
 * de la graine avec elle. Un palier ne se prend qu'une fois — le filtre
 * enlève une carte déjà prise au même PALIER, pour qu'un rechargement ou un
 * double clic n'en empile pas deux.
 *
 * `palier` et `jour` sont deux choses : le palier est l'offre, le jour est
 * l'instant où elle entre en vigueur. Rejouer depuis le PALIER rembobinerait
 * la saison pour qui a laissé passer l'offre et l'a prise vingt journées
 * plus tard ; on rejoue donc depuis le jour courant.
 */
/*
 * LA CARTE QU'ON N'A PAS CHOISIE. JP : *pour les blessures, faire que si pas
 * de joueur à la position, carte random pigée*. Quand un match se joue avec
 * une case que personne ne peut remplir, le vestiaire s'ajuste — et la carte
 * est TIRÉE, pas offerte. Elle passe par exactement la même machinerie qu'un
 * palier (une décision `{ jour, carte, palier }`, donc rejouée de la graine),
 * avec un palier nommé `trou:<match>` pour qu'elle n'entre jamais en
 * collision avec les paliers 20 / 40 / 60 et qu'un même épisode ne puisse
 * pas en donner deux.
 *
 * Ce n'est PAS une compensation : toutes les cartes portent un bonus ET un
 * malus, donc celle-ci peut très bien ne pas t'arranger. C'est ce qu'est une
 * crise d'effectif — un ajustement qu'on subit. Mesuré : 1,02 épisode par
 * équipe par saison, donc le budget passe de trois cartes à quatre dans les
 * mauvaises années, jamais plus de huit au pire cas observé.
 */
async function subirCarte(at, jour, cle) {
  if (!G.ligue || !CARTES[cle]) return;
  const palier = `trou:${at}`;
  const decisions = (G.ligue.decisions || []).filter(x => !(x.carte && x.palier === palier));
  decisions.push({ jour, carte: cle, palier, sel: nouvelleGraine() });
  await continuerSaison(decisions, jour, 'La saison reprend…');
}

/*
 * UN MOMENT (S66) : plan du soir, dilemme, séquence, objectif, verdict du
 * proprio. Une seule porte d'entrée : la décision entre dans la liste (en
 * remplaçant celle du même palier, ou le plan du même soir), et la saison se
 * rejoue de la graine depuis la journée où on est.
 */
async function deciderSaison(d, depuis) {
  if (!G.ligue) return;
  // Le joueur réclamé doit être connu du moteur AVANT la saison rejouée.
  if (d.ballottage) connaitre(ballottageVu.get(d.ballottage.entre));
  if (d.ballottage && d.ballottage.entre) ajouterAuCartable([{ cle: d.ballottage.entre, rar: d.ballottage.rar || 'commune', num: d.ballottage.num || null }], { doublons: false });
  // S80 : celui qui laisse sa place n'est pas perdu — sa carte va au cartable (JP : *envoyer cartes au cartable quand discard*).
  if (d.ballottage && d.ballottage.sort) carteAuCartable(d.ballottage.sort);
  const decisions = (G.ligue.decisions || []).filter(x =>
    !(d.palier !== undefined && x.palier === d.palier) && !(d.soir && x.soir && x.jour === d.jour)
    && !(d.lignes && x.lignes && !x.cases && x.jour === d.jour) && !(d.match && x.match && x.jour === d.jour)
    // LES GROS MATCHS (S70) : un avant-match et un entracte par soir. Toute
    // autre décision rejoue le match depuis le début : l'entracte déjà choisi
    // ne vaut plus, il sera redemandé sur le nouveau pointage.
    && !(d.avant && x.avant && x.jour === d.jour) && !(x.entracte && (d.entracte ? x.jour === d.jour : x.jour >= d.jour)));
  // UNE DÉCISION QUI NE TOUCHE QUE LE DECK DE MATCH (une récompense, un
  // ménage) ne tire pas de dés neufs : le moteur ne la lit pas, les matchs ne
  // doivent pas bouger (S74).
  // S79 : ni une carte de masse salariale, ni une vente, ni un pack ouvert sans signature — le moteur ne les lit pas.
  // S80 : ni une modif gardée au palier (`garde`) : elle attend dans l'inventaire, le moteur ne la lit qu'une fois posée.
  // LA CONFIANCE D'UN COACH (v2) : une carte jouée qui fait franchir un seuil à son coach porte la confiance atteinte.
  const allume = (d.joue || d.recompense !== undefined) && !d.coach ? palierAllume(G.ligue.decisions || [], d) : null;
  if (allume) d = { ...d, ...allume };
  const deckSeul = !d.coach && (d.recompense !== undefined || d.deck === 'menage' || d.deck === 'camp' || !!d.plafond || !!d.vend || (!!d.achat && !d.ballottage) || d.signe === false || (!!d.garde && !d.mutation));
  decisions.push(deckSeul ? { ...d } : { ...d, sel: nouvelleGraine() });
  await continuerSaison(decisions, depuis, 'La saison reprend avec ton choix…');
  // Le plafond de la barre du haut suit une recrue ou un joueur réclamé.
  if (d.ballottage || d.plafond || d.patron || d.achat) renderCap();
  confirmerDecision(d);
}

/*
 * UNE DÉCISION S'APPLIQUE À PARTIR D'AUJOURD'HUI (S79). La ligue ne joue que
 * ce qui est révélé : une décision datée d'aujourd'hui ou plus tard entre dans
 * la liste de la ligue EN MÉMOIRE, et l'écran se rouvre sur la même journée —
 * rien n'est rejoué, pas de voile. Seule une décision datée d'une journée
 * DÉJÀ jouée (l'entracte d'un gros match qu'on regarde en direct : le soir
 * est joué pour être montré) reconstruit la ligue, et seulement jusqu'à
 * aujourd'hui : le passé se rejoue à l'identique de la graine, rien d'avance.
 */
async function continuerSaison(decisions, depuis, mot) {
  const L = G.ligue, M = L && L.moteur;
  const avant = new Set(L.decisions || []), apres = new Set(decisions);
  const touchees = [...decisions.filter(d => !avant.has(d)), ...(L.decisions || []).filter(d => !apres.has(d))];
  const jourMin = touchees.length ? Math.min(...touchees.map(d => d.jour)) : Infinity;
  if (M && jourMin >= M.jour) {
    L.decisions = M.decisions = decisions;
    // Le joueur signé (un pack, le ballottage) entre dans l'alignement tout de suite (S79).
    poserAlignementDuJour(M);
    G.done = true;
    ouvrirEcranSaison(depuis);
    saveGame();
    return;
  }
  G.done = false;
  renderMain();
  await sousVoile(mot, () => runSeason({ adversaires: L.adversaires, graine: L.graine, depuis, decisions, reprise: true }));
}

/*
 * LE VOILE DE L'ATTENTE (S74b). Une décision rejoue la saison — deux à quatre
 * secondes de calcul sur un téléphone — et l'écran disparaissait sans un mot
 * entre le choix et la saison rouverte. Un voile le dit, peint AVANT le calcul
 * (deux images d'animation : le calcul bloque le fil, et un voile posé juste
 * avant ne serait jamais dessiné).
 */
function voile(on, mot = 'On rejoue la saison avec ton choix…') {
  let v = $('voile');
  if (!v) {
    v = document.createElement('div');
    v.id = 'voile'; v.className = 'voile'; v.hidden = true;
    v.setAttribute('role', 'status');
    v.innerHTML = '<div class="voile-boite"><span class="voile-glace"><i class="voile-rondelle"></i></span><span class="voile-mot"></span></div>';
    document.body.appendChild(v);
  }
  v.querySelector('.voile-mot').textContent = mot;
  v.hidden = !on;
}
const peindre = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
export async function sousVoile(mot, f) {
  voile(true, mot);
  await peindre();
  try { return await f(); } finally { voile(false); }
}

/*
 * CE QUE TU VIENS DE FAIRE, DIT (S74). L'agent de test : « rien ne confirme
 * qu'on a pris une récompense, fait le ménage ou amélioré un joueur », et une
 * recrue restait en réserve sans qu'on sache qu'il fallait la monter.
 */
function confirmerDecision(d) {
  const M = d.mutation && MUTATIONS[d.mutation.cle];
  const qui = cle => { const p = Object.values(G.roster).find(x => x && getPlayerKey(x) === cle) || ballottageVu.get(cle); return p ? p.n : 'ton joueur'; };
  const C = k => CARTES_MATCH[k];
  let mot = null;
  if (d.recompense && C(d.recompense)) mot = `🎁 ${C(d.recompense).nom} rejoint ton deck.`;
  else if (d.deck === 'menage' && C(d.retrait)) mot = `🗑️ ${C(d.retrait).nom} quitte ton deck.`;
  else if (d.deck === 'camp' && C(`${d.aiguise}+`)) mot = `🏋️ ${C(`${d.aiguise}+`).nom} : ta carte est améliorée.`;
  else if (d.deck === 'recrue' && d.ballottage) mot = `🎟️ ${qui(d.ballottage.entre)} arrive en réserve. Monte-le dans un trio : derrière le banc.${d.ballottage.sort ? ` La carte de ${qui(d.ballottage.sort)} va à ton cartable.` : ''}`;
  // S80 : l'amélioration et l'édition du palier vont dans l'inventaire ; une modif posée se pose AU VERSO.
  else if (d.garde && BANQUE[d.garde]) mot = `🎒 ${BANQUE[d.garde].ico} ${BANQUE[d.garde].nom} va dans ton inventaire : pose-la au verso d'un joueur, quand tu veux.`;
  else if (d.joue && M) mot = `${M.ico} ${M.nom} : posée au verso de ${qui(d.mutation.joueur)}.`;
  // S80 : une signature dit où va celui qui sort — ou qu'il n'y en a pas.
  else if (d.ballottage && d.ballottage.entre) mot = d.ballottage.sort ? `📒 ${qui(d.ballottage.entre)} prend la place de ${qui(d.ballottage.sort)} : la carte de ${qui(d.ballottage.sort)} va à ton cartable.` : `🪑 ${qui(d.ballottage.entre)} entre dans une case de réserve libre : personne ne sort.`;
  else if ((d.deck === 'amelioration' || d.deck === 'profil' || d.deck === 'atelier') && M) mot = `${M.ico} ${qui(d.mutation.joueur)} : ${M.nom.toLowerCase()}.`;
  else if (d.deck === 'strategie' && d.maitrise && systemeDe(d.maitrise.tac)) mot = `📘 ${systemeDe(d.maitrise.tac).groupe === 'D' ? 'Tes défenseurs apprennent' : 'Tes avants apprennent'} : ${systemeDe(d.maitrise.tac).nom.toLowerCase()}.`;
  // La carte du proprio (objectif atteint) : la seule carte prise sans un mot (QA S74b).
  else if (d.carte && CARTES[d.carte]) mot = `${CARTES[d.carte].ico} ${CARTES[d.carte].nom} : pour le reste de la saison.`;
  // v2 : la carte qui fait croire le vestiaire à un coach le dit, avec ce que sa confiance joue.
  if (d.coach && COACHS[d.coach.cle]) {
    const C = COACHS[d.coach.cle];
    const sys = d.maitrise && systemeDe(d.maitrise.tac);
    mot = `${mot ? `${mot} ` : ''}${C.ico} Le vestiaire croit ${C.de.replace(/^du /, 'au ').replace(/^de l'/, 'à l\'').replace(/^de la /, 'à la ')} : confiance ${ROMAINS[d.coach.palier]}, pour le reste de la saison.${sys ? ` Tes avants apprennent ${sys.nom.toLowerCase()}.` : ''}`;
  }
  if (mot) toast(mot);
}

/*
 * LE BALLOTTAGE (S66). JP : *ballottage sur blessure*. Quand un joueur se
 * blesse pour de bon, trois vrais joueurs pas chers sont au ballottage : de la
 * même position, des MÊMES saisons que la ligue, mais de clubs qui n'y sont
 * pas, et personne qui y joue déjà. En réclamer un le met dans la case de
 * réserve de sa position ; celui qui l'occupait est libéré, et le plafond
 * compte toujours. Le tirage est PUR (la graine et le match), donc la même
 * blessure offre les mêmes trois noms à la reprise.
 */
const RESERVE_DE = { F: 'Réserve F', D: 'Réserve D', G: 'Réserve' };
export const POSTE_GROUPE = { F: 'Avant', D: 'Défenseur', G: 'Gardien' };
const PLAFOND_BALLOTTAGE = 0.03;          // la part du plafond qu'un joueur réclamé peut coûter
export const groupeDe = groupeDuBallottage;
export const ballottageVu = new Map();
/* En Rogue, une réclamation coûte des jetons (1.0) : un dépanneur, pas un cadeau. En saison, rien. */
const COUT_BALLOTTAGE_ROGUE = 10;
const coutBallottage = () => (G.bonus === 'ROGUE' ? COUT_BALLOTTAGE_ROGUE : 0);
function candidatsBallottage(blesse, at) {
  const L = G.ligue;
  if (!L || !blesse || !L.cles) return null;
  const g = groupeDe(blesse);
  const slot = SLOTS.find(s => s.scratch && s.role === RESERVE_DE[g]);
  if (!slot) return null;
  const sort = G.roster[slot.i] || null;
  const budget = Math.min(capLeft() + (sort ? sort.$ : 0), MODE().cap * PLAFOND_BALLOTTAGE);
  // 1.0 (J1-D) : la fonction pure (js/ballottage.js), qui n'offre que des réguliers — jamais une vedette à son contrat d'entrée.
  const out = candidatsPurs({ shards: G.shards, ligue: L, blesse, budget, at });
  for (const p of out) ballottageVu.set(getPlayerKey(p), p);
  const ligne = ligneDuChoix;
  // Le joueur et sa rareté voyagent avec l'offre (S76) : le ballottage se
  // présente en CARTES de joueur, portrait et métal compris, comme la recrue.
  return {
    i: slot.i, sort: sort ? getPlayerKey(sort) : null, sortNom: sort ? sort.n : null, cout: coutBallottage(),
    candidats: out.map(p => ({ cle: getPlayerKey(p), p, nom: p.n, club: `${p.t} ${p.s}`, pos: p.p, poste: POSTE_GROUPE[g], salaire: money(p.$), ligne: ligne(p), rarete: rareteJoueur(p) })),
  };
}
/*
 * LA RECRUE DU DECK (S73). JP : *des cartes style événement qui permettent
 * d'aller chercher un joueur au choix, loto*. La carte « Joueur au choix »
 * d'une main de palier offre trois vrais joueurs — UN PAR POSITION (avant,
 * défenseur, gardien), parce que le choix intéressant est « où est-ce que je
 * renforce », pas « lequel des trois centres ». Mieux que le ballottage, qui
 * bouche un trou : le budget est TOUT l'espace sous le plafond plus le salaire
 * du réserviste libéré (pas 3 % du plafond), et on tire parmi les huit
 * meilleurs producteurs qui y rentrent, pas les quinze. Mêmes règles pour le
 * reste : des saisons de la ligue, des clubs qui n'y sont pas, personne qui y
 * joue déjà. La recrue prend la case de réserve de sa position ; c'est une
 * décision de ballottage, donc la reprise la retrouve comme les autres.
 */
const RECRUE_MEILLEURS = 8;
function candidatsRecrue(palier) {
  const L = G.ligue;
  if (!L || !L.cles) return [];
  const dansLaLigue = new Set();
  for (const t of L.teams || []) for (const p of Object.values(t.roster || {})) if (p) dansLaLigue.add(getPersonKey(p));
  const clubs = new Set(L.cles);
  const saisons = [...new Set(L.cles.map(c => String(c).split('|')[0]))];
  const h = str => { let x = ((Number(L.graine) >>> 0) ^ Math.imul(palier + 7919, 2654435761)) >>> 0; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
  const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? (p.g + p.a)) || 0) / Math.max(1, p.gp));
  const ligne = ligneDuChoix;
  const out = [];
  for (const g of ['F', 'D', 'G']) {
    const slot = SLOTS.find(sl => sl.scratch && sl.role === RESERVE_DE[g]);
    if (!slot) continue;
    const sort = G.roster[slot.i] || null;
    const budget = capLeft() + (sort && !estRenfort(sort) ? sort.$ : 0);
    const pool = [];
    for (const sa of saisons) {
      const e = G.shards.get(sa);
      if (!e) continue;
      for (const [tag, joueurs] of Object.entries(e.byTeam)) {
        if (clubs.has(`${sa}|${tag}`)) continue;
        for (const p of joueurs) {
          if ((p.gp || 0) < (g === 'G' ? 20 : 40) || !(p.$ > 0) || p.$ > budget || groupeDe(p) !== g || dansLaLigue.has(getPersonKey(p)) || isPicked(p)) continue;
          pool.push(p);
        }
      }
    }
    if (!pool.length) continue;
    pool.sort((a, b) => prod(b) - prod(a));
    pool.length = Math.min(pool.length, RECRUE_MEILLEURS);
    pool.sort((a, b) => h(getPlayerKey(a)) - h(getPlayerKey(b)));
    const p = pool[0];
    ballottageVu.set(getPlayerKey(p), p);
    out.push({
      cle: getPlayerKey(p), p, nom: p.n, poste: POSTE_GROUPE[g], club: `${p.t} ${p.s}`, salaire: money(p.$), ligne: ligne(p),
      i: slot.i, sort: sort ? getPlayerKey(sort) : null, sortNom: sort ? sort.n : null,
      // Sa carte a la rareté de son salaire, comme partout (S76) — plus une
      // légendaire d'office parce que la carte du deck qui l'offre l'est.
      rarete: rareteJoueur(p),
    });
  }
  return out;
}

/* La personne d'une clé de joueur-saison (« saison_club_id » → « saison_id ») : `getPersonKey` sans l'objet. */
export function personneDeCle(cle) {
  const parts = String(cle).split('_');
  return parts.length === 3 ? `${parts[0]}_${parts[2]}` : `${parts[0]}_${parts.slice(2).join('_')}`;
}
/*
 * À la reprise : les joueurs d'un ballottage (réclamés et libérés), les réservistes relâchés (S80)
 * et — 1.0, oct. — tout joueur qu'un alignement daté nomme sans qu'il soit encore au vestiaire
 * se retrouvent dans leurs shards. Sans eux, la case du jour 0 restait vide à la reprise et le
 * premier soir se jouait autrement (JP : *faut vraiment que le passé soit gelé*).
 */
export async function connaitreBallottages(decisions) {
  const auVestiaire = new Set(Object.values(G.roster || {}).filter(Boolean).map(getPlayerKey));
  for (const d of decisions || []) {
    if (!d.ballottage && !d.relache && !d.cases) continue;
    const nommes = d.cases ? Object.values(d.cases).filter(cle => !auVestiaire.has(cle)) : [];
    for (const cle of [...(d.ballottage ? [d.ballottage.entre, d.ballottage.sort] : []), ...(d.relache || []).map(x => x && x.sort), ...nommes]) {
      if (!cle) continue;
      const [s, t] = String(cle).split('_');
      let e = G.shards.get(s);
      if (!e) { try { e = await getShard(s); } catch { continue; } }
      const p = (e.byTeam[t] || []).find(x => getPlayerKey(x) === cle);
      if (p) { connaitre(p); ballottageVu.set(cle, p); }
    }
  }
}

/*
 * UNE DÉCISION DE SÉRIES (S69) : trios, lignes, consigne, ajustement entre
 * deux rounds. Elle remplace celle du même genre au même match, porte son
 * sel, et les séries se rejouent — la saison d'abord, qui pose le
 * générateur, puis les rondes jusqu'où on les avait regardées.
 */
export async function deciderSerie(d) {
  if (!G.ligue) return;
  const meme = x => x.ronde === d.ronde && x.match_no === d.match_no && (
    (d.cases && x.cases) || (d.lignes && !d.cases && x.lignes && !x.cases) || (d.match && x.match) || (d.ajustement && x.ajustement)
    // S74 : une main par match, une récompense par série.
    || (d.main && x.main) || (d.recompense !== undefined && x.recompense !== undefined)
    // S70 : un entracte par match, et toute autre décision pour ce match l'annule.
    || !!x.entracte);
  // Une récompense de série ne touche que le deck : pas de dés neufs (S74).
  const avant = G.ligue.decisionsSeries || [];
  G.ligue.decisionsSeries = [...avant.filter(x => !meme(x)), d.recompense !== undefined ? { ...d } : { ...d, sel: nouvelleGraine() }];
  const vues = G.seriesVues;
  saveGame();
  /*
   * EN AVANT (S79) : une décision pour un match PAS ENCORE JOUÉ (ou une
   * récompense, que le moteur ne lit pas) entre dans le moteur des séries en
   * mémoire, et l'écran se rouvre — rien n'est rejoué. Seul l'entracte d'un
   * match qu'on regarde (joué pour être montré) reconstruit, jusque-là.
   */
  const S = G.seriesMoteur;
  const pasJoue = S && (d.match_no < 0 || d.ronde > S.ronde || (d.ronde === S.ronde && d.match_no >= S.k));
  const retire = avant.filter(meme);
  const retireJoue = S && retire.some(x => x.match_no >= 0 && (x.ronde < S.ronde || (x.ronde === S.ronde && x.match_no < S.k)));
  if (pasJoue && !retireJoue) {
    S.decisions = G.ligue.decisionsSeries;
    ouvrirEcranSeries(vues);
    if (d.recompense) confirmerDecision(d);
    return;
  }
  G.done = false;
  renderMain();
  await sousVoile('On rejoue les séries avec ton choix…', async () => {
    await runSeason({ adversaires: G.ligue.adversaires, graine: G.ligue.graine, depuis: Infinity, decisions: G.ligue.decisions, reprise: true });
    reprendreSeries(vues);
  });
  if (d.recompense) confirmerDecision(d);
}
/* Le banc pendant les séries : l'alignement de fin de saison, et le retour renvoie aux séries. */
export function bancSerie(ronde, k) {
  if (!G.ligue || !G.ligue.calendrier) return;
  ouvrirBanc(G.ligue.calendrier.length);
  if (G.banc) { G.banc.serie = { ronde, k }; renderBanc(); }
}

async function choisirCarte(palier, jour, cle, depuis = jour) {
  if (!G.ligue || !CARTES[cle]) return;
  const decisions = (G.ligue.decisions || []).filter(x => !(x.carte && x.palier === palier));
  decisions.push({ jour, carte: cle, palier, sel: nouvelleGraine() });
  await continuerSaison(decisions, Math.min(depuis, jour), 'La saison reprend avec ta carte…');
  toast(`${CARTES[cle].ico} ${CARTES[cle].nom} : pour le reste de la saison.`);
}

/*
 * L'EFFECTIF À CE JOUR (1.0, oct.). JP : *plus d'information dans page
 * lineup* — les stats de la saison à ce jour, le salaire et le niveau, le
 * rôle et la position. Les cases restent lisibles d'un coup d'oeil ; le
 * détail se déplie ici, une rangée par joueur, dans l'ordre de l'alignement.
 * Rien que des vraies stats (les feuilles RÉVÉLÉES, `G.banc.compte`) et des
 * rangs : jamais une cote.
 */
function effectifHtml(b) {
  const pct = (a, n) => (n ? pct3(a / n) : '—');
  const rangee = (s, p) => {
    const c = b.compte.get(p) || {};
    const pp = p.p === 'G' ? null : profilPrincipal(p);
    const bl = b.blesses.has(p) ? ` <span class="banc-reste">🩹 ${b.blesses.get(p)}</span>` : '';
    const tete = `<td class="ef-case">${esc(slotShort(s))}</td><td class="ef-nom"><b>${esc(p.n)}</b>${bl}<span>${esc(positionLabel(p))} · ${pp ? `${pp.ico} ${esc(pp.court || pp.nom)}` : esc(p.t)}</span></td><td>${pastilleNiveau(p)}</td><td class="ef-n">${money(capHitDuJour(p))}</td>`;
    if (p.p === 'G') return `<tr>${tete}<td class="ef-n">${c.gp || 0}</td><td class="ef-n" colspan="2">${c.w || 0}-${c.l || 0}</td><td class="ef-n" colspan="2">${pct(c.sv || 0, c.sa || 0)}</td><td class="ef-n" colspan="2">${c.gp ? ((c.ga || 0) / c.gp).toFixed(2).replace('.', ',') : '—'}</td></tr>`;
    return `<tr>${tete}<td class="ef-n">${c.gp || 0}</td><td class="ef-n">${c.g || 0}</td><td class="ef-n">${c.a || 0}</td><td class="ef-n">${c.pts || 0}</td><td class="ef-n">${(c.pm || 0) > 0 ? '+' : ''}${c.pm || 0}</td><td class="ef-n">${c.sh || 0}</td><td class="ef-n">${c.pim || 0}</td></tr>`;
  };
  const rangees = SLOTS.filter(s => G.roster[s.i]).map(s => rangee(s, G.roster[s.i])).join('');
  return `<details class="banc-plus banc-effectif"><summary>L'effectif à ce jour</summary>
    <div class="ef-boite"><table class="ef-table">
      <thead><tr><th>Case</th><th>Joueur</th><th>Niveau</th><th>Salaire</th><th title="Matchs joués">PJ</th><th>B</th><th>A</th><th>PTS</th><th>+/-</th><th title="Lancers">L</th><th title="Minutes de punition">PUN</th></tr></thead>
      <tbody>${rangees}</tbody>
    </table></div>
    <div class="banc-ligne banc-aide">Un gardien : PJ, V-D, % d'arrêts et moyenne.</div>
  </details>`;
}

/** Le panneau du banc : la journée, la fiche, le prochain match, les blessés, la consigne. */
export function renderBanc() {
  const host = $('bancPanel');
  if (!host) return;
  const b = G.banc;
  host.hidden = !b;
  if (!b) return;
  const L = G.ligue;
  const adv = b.prochain ? L.teams.find(t => t === b.prochain.adv) || b.prochain.adv : null;
  const blesses = [...b.blesses].map(([p, reste]) => `${esc(p.n)} <span class="banc-reste">${reste} match${reste > 1 ? 's' : ''}</span>`);
  /*
   * UN ÉCRAN, PAS DEUX (S78). « Tes lignes » et son bouton « Mes lignes »
   * répétaient en icônes ce que chaque trio dit maintenant sous ses cases, et
   * « pour l'instant, le 3e trio » répétait le 🔒 Fermeture du trio. Ce qui
   * reste ici est ce que l'alignement ne dit pas : la journée, la fiche, le
   * prochain match, l'infirmerie — et ce qui joue sur ta formation, replié,
   * qui vivait dans la modale « Mes lignes » (JP, S72 : *les bonus et malus
   * devraient être avec les stratégies*).
   */
  const toi = L && (L.teams || []).find(t => t.isPlayer);
  const fx = toi ? { ...effetsEnCours(toi, b.jour), cartes: (L.decisions || []).filter(d => d.carte && d.jour <= b.jour).map(d => d.carte) } : null;
  const nbFx = fx ? (fx.effets || []).length + (fx.trous || []).length + fx.cartes.length + (fx.absents || []).length + (fx.gardienAux ? 1 : 0) : 0;
  const effets = nbFx ? `<details class="banc-plus banc-effets"><summary>Ce qui joue sur ta formation · ${nbFx}</summary>${effetsHtml(fx)}</details>` : '';
  host.innerHTML = `
    <div class="banc-tete">
      <div class="banc-titre">Derrière le banc <span class="banc-jour">journée ${b.jour} sur ${b.N}</span></div>
      <div class="banc-fiche" title="Ta fiche à ce jour : victoires, défaites, défaites en prolongation">${b.fiche.W}-${b.fiche.L}-${b.fiche.OTL}</div>
    </div>
    ${adv ? `<div class="banc-ligne">Prochain match · ${b.prochain.j === b.jour ? 'ce soir' : b.prochain.j === b.jour + 1 ? 'demain' : `dans ${b.prochain.j - b.jour} jours`} · ${getTeamLogoHtml(adv.tag, 16)} ${esc(teamLabel(adv))}${soirEreintant(b.prochain.j, L.you, adv) ? ' <span class="banc-ereintant" title="Un dos-à-dos est éreintant : la finition suit l\'écart de robustesse entre les deux clubs. Habille tes joueurs les plus robustes.">🥵 dos-à-dos</span>' : ''}</div>` : ''}
    <div class="banc-ligne">${blesses.length ? `🩹 ${blesses.join(' · ')}` : 'Personne à l\'infirmerie.'}</div>
    <div class="banc-ligne banc-aide">Déplace ou permute : le fit suit les joueurs. 🔒 : ton <b>trio de fermeture</b>.</div>
    ${effets}
    ${effectifHtml(b)}
    <details class="banc-plus"><summary>Les lignes et le trio de fermeture</summary>
      <div class="banc-ligne"><b>Chaque ligne joue un système</b> : il demande un rôle par case, et le fit plafonne la chimie. La chimie monte en jouant ensemble et ne se perd pas ; un nouveau venu bâtit son entente avec ses coéquipiers. Une ligne soudée joue son système plus souvent.</div>
      <div class="banc-ligne"><b>Le trio de fermeture</b> prendra le premier trio adverse, surtout à domicile, où le dernier changement est à toi. Son blocage est celui de ses trois joueurs : désigner un trio ordinaire, c'est l'envoyer se faire marquer dessus.${b.fermeture === 'auto' ? ' Par défaut c\'est le 3e trio, comme chaque club de la ligue.' : ''}</div>
    </details>
    <button class="btn go banc-retour" id="bancRetour" title="La saison reprend à cette journée, avec ces trios, ce plan et cette glace. Ce qui est joué reste joué.">Retour au match</button>`;
  $('bancRetour').onclick = reprendreSaison;
  // MES LIGNES, derrière le banc (S68) : elles se règlent sous chaque trio
  // depuis S78 (`rangeeStrategie`, en fenêtre depuis 1.0), et partent avec la décision du banc au
  // « Retour au match ».
  /*
   * UN SEUL ÉCOUTEUR, DÉLÉGUÉ, et il est reposé à chaque rendu parce que
   * `innerHTML` vient de jeter les anciens boutons : brancher chaque bouton
   * un par un en laisserait un derrière au premier réglage qu'on ajoute.
   */
  host.querySelectorAll('.banc-seg-btn').forEach(btn => {
    btn.onclick = () => {
      const champ = btn.dataset.champ;
      if (!G.banc || G.banc[champ] === btn.dataset.cle) return;
      G.banc[champ] = btn.dataset.cle;
      renderBanc();
    };
  });
}

/*
 * REPRENDRE LES SÉRIES APRÈS UN RAFRAÎCHISSEMENT. La saison vient d'être
 * rejouée en entier : le classement est donc le même, les appariements sont
 * les mêmes, et surtout le générateur est à l'endroit exact où `playSeries`
 * l'avait pris la première fois — `grainerHasard` n'est appelé que par
 * `simulateLeague`, et il reste en place ensuite (js/sim.js). Rejouer les
 * séries redonne donc les mêmes feuilles, au but près. Il ne reste qu'à dire
 * à l'écran jusqu'où le joueur les avait regardées.
 */
export function reprendreSeries(vues) {
  const teams = G.ligue && G.ligue.teams;
  if (!teams || teams.length < 2) return;
  runPlayoffs(teams.slice(0, nombreEnSeries(teams.length)), { depuis: vues });
}

export async function runSeason(opts = {}) {
  if (G.banc && !opts.adversaires) { await reprendreSaison(); return; }
  if (slotsLeft() > 0 || G.done || (capLeft() < 0 && !opts.adversaires)) return;
  if (!opts.reprise) alignementAuCartable();
  // SUR TABLE : le même alignement, un autre jeu. On n'entre jamais dans
  // simulateLeague ici — le tournoi a son propre moteur, celui du plateau.
  if (G.bonus === 'TABLE' && !opts.adversaires) { await (await chargerTable()).lancerTournoi(); return; }
  /*
   * UNE SAISON QUI COMMENCE N'A NI SÉRIES NI ENTRÉE D'HISTORIQUE ; une
   * REPRISE garde les deux, puisque c'est la même saison qu'on rouvre. Un
   * seul endroit décide, sinon « Rejouer la saison » réécrirait l'entrée de
   * la saison d'avant et hériterait de ses séries.
   */
  if (!opts.reprise) { G.seriesVues = null; G.lbId = null; }
  // Les décisions de SÉRIES suivent une reprise (S69), jamais une saison neuve.
  const dsPrec = opts.reprise ? ((G.ligue && G.ligue.decisionsSeries) || G.dsReprise || []) : [];
  G.dsReprise = null;
  // LES DÉS DÉJÀ TIRÉS (1.0, oct., `deDuJour` dans js/sim.js) : une reprise les garde, une saison neuve en tire.
  const desPrec = opts.reprise ? ((G.ligue && G.ligue.des) || G.desReprise || { matins: [], soirs: [], series: {} }) : { matins: [], soirs: [], series: {} };
  G.desReprise = null;
  G.done = true;
  // LA SAISON SE JOUE DANS TES COULEURS : noir, blanc, orange. Le repêchage
  // portait celles du vestiaire sorti ; à partir d'ici, c'est ton club.
  applyTeamColors('YOU');
  const mb = $('mainBtn');
  mb.disabled = true;
  mb.textContent = 'La ligue joue ses 82 matchs…';
  await new Promise(r => setTimeout(r, 20));

  let opponents = [];
  if (opts.adversaires) {
    opponents = opts.adversaires.map(a => createTeam(a.name, a.tag, a.roster, { season: a.season }));
  } else {
    try { opponents = await buildOpponents(31); } catch { opponents = []; }
  }
  // TU ES LA 33e ÉQUIPE. Une saison fixée met dans la ligue TOUS ses vrais
  // clubs, et la tienne par-dessus : trente-trois en 2024-25, vingt-deux en
  // 1985-86. C'était le club le plus faible qui cédait sa place pour garder
  // l'effectif pair ; la cédule sait maintenant faire jouer un nombre impair
  // d'équipes (une en congé chaque journée, 82 matchs pour tout le monde —
  // voir `simulateLeague`), donc plus personne n'est retranché.

  const you = createTeam(nomDuClub(), 'YOU', G.roster, { isPlayer: true });
  // LES DÉCISIONS EN SAISON (voir `simulateLeague`) : la décision 0 est
  // l'alignement du repêchage, les suivantes viennent du banc. Une reprise
  // rejoue exactement les mêmes.
  const decisions = opts.decisions && opts.decisions.length
    ? opts.decisions
    : [{ jour: 0, cases: photoAlignement(G.roster), fermeture: 'auto', lignes: G.lignes || undefined },
      // UN DECK AIGUISÉ (Rogue, S77) : deux cartes de départ commencent en « + » — à la première saison d'une run.
      ...(G.bonus === 'ROGUE' && G.rogue && G.rogue.deckPlus && !(G.rogue.saison > 1) ? [{ jour: 0, deck: 'camp', aiguise: 'lancer', rogue: { depart: true } }, { jour: 0, deck: 'camp', aiguise: 'bloquer', rogue: { depart: true } }] : []),
      // LA SAISON SUIVANTE D'UNE RUN (S80) : les modifs jouées et le deck continuent, en décisions du jour 0.
      ...(G.bonus === 'ROGUE' && G.rogue && Array.isArray(G.rogue.report) ? G.rogue.report.map(d => ({ ...d })) : []),
      // LE COACH CHOISI AU DÉPART (v2, js/coachs.js) : trois cartes au compteur, sa confiance I allumée — à la première saison d'une run.
      ...(G.bonus === 'ROGUE' && G.rogue && COACHS[G.rogue.coach] && !(G.rogue.saison > 1)
        ? [{ jour: 0, coachsDeBase: { [G.rogue.coach]: SEUILS[0] }, coach: effetDePalier(G.rogue.coach, 1), rogue: { depart: true } }] : [])];
  // Tes cartes brillantes jouent (S78) ; personne d'autre n'en porte.
  poserCartes(decisions);
  /*
   * LA LIGUE NE SE JOUE PAS D'AVANCE (S79). JP : *tu devrais jamais simuler
   * d'avance*. Elle se CRÉE ici — les équipes, la cédule, le hasard — et ne
   * joue que les journées déjà révélées (une reprise : la sauvegarde, ou une
   * décision prise après un match déjà joué pour le direct). L'écran de saison
   * joue chaque journée suivante au moment de la révéler (`ouvrirSaison`,
   * `ligue`), et le bilan se compose à la dernière (`terminerSaison`).
   */
  let r = null, teams, leaders = [], calendrier = [], graine = null, moteur = null;
  if (opponents.length) {
    // S80 : une ligue Rogue porte la courbe de la fin de partie (js/sim.js `echelleTardive`).
    moteur = creerLigue([you, ...opponents], 82, { graine: opts.graine || null, decisions, courbe: G.bonus === 'ROGUE', des: desPrec });
    jouerJusqua(moteur, opts.depuis || 0);
    // Un joueur signé aujourd'hui est dans l'alignement dès maintenant, pas au matin (S79).
    poserAlignementDuJour(moteur);
    teams = moteur.teams;
    calendrier = moteur.calendrier;
    graine = moteur.graine;
  } else {
    r = simulate(G.roster, { graine: opts.graine || null });
    graine = r.graine;
    Object.assign(you, { W: r.W, L: r.L, OTL: r.OTL, GF: r.GF, GA: r.GA, PTS: r.points });
    teams = [you];
  }
  G.journee = 0;
  G.ligue = {
    you, teams, calendrier, graine, epoque: G.epoque, moteur,
    // Les clés des adversaires, dans l'ordre du tirage : c'est tout ce que la
    // sauvegarde emporte, et `rebatirAdversaires` les redéploie à l'identique.
    cles: opponents.map(t => `${t.season}|${t.tag}`),
    decisions,
    decisionsSeries: dsPrec,
    des: desPrec,
    // Les trois réglages sont FIGÉS ici, avec la graine : l'écran « Nouvelle
    // partie » peut muter G pendant qu'un bilan est encore à l'écran, et
    // l'historique doit enregistrer la partie qui a été jouée, pas celle
    // qu'on est en train de composer.
    mode: G.mode, repechage: G.repechage, franchise: G.franchise, bonus: G.bonus,
    // De quoi rejouer : les mêmes 31 clubs, à partir des mêmes alignements.
    adversaires: opponents.map(t => ({ name: t.name, tag: t.tag, roster: t.roster, season: t.season })),
  };

  if (!moteur) {
    // La saison solo (aucun adversaire) : `simulate` a tout joué, il n'y a rien à révéler.
    G.journee = calendrier.length; saveGame(); finDeSaisonRogue();
    renderResult(r, you, teams, leaders, calendrier);
    return;
  }
  ouvrirEcranSaison(opts.depuis || 0);
}

/*
 * LA FIN DE LA SAISON : le classement, les meneurs et la fiche, composés à la
 * dernière journée — jamais avant, puisque rien n'était joué d'avance.
 */
function terminerSaison() {
  const L = G.ligue, M = L && L.moteur;
  if (!M) return;
  jouerJusqua(M, Infinity);
  const b = bilanLigue(M);
  const you = L.you;
  L.teams = b.standings;
  const r = {
    W: you.W, L: you.L, OTL: you.OTL, GF: you.GF, GA: you.GA, points: you.PTS,
  };
  G.journee = M.calendrier.length;
  finDeSaisonRogue();
  renderResult(r, you, b.standings, b.leaders, M.calendrier);
  // LA RUN AU BILAN (S80) : la saison de la run, le mandat du proprio, la suite.
  majRunRogue();
}

/*
 * L'ÉCRAN DE SAISON, sur la ligue EN MÉMOIRE : ouvrir, rouvrir après une
 * décision, reprendre une partie — sans jamais rejouer ce qui est joué.
 */
function ouvrirEcranSaison(depuis = 0) {
  const L = G.ligue, M = L.moteur;
  const { you, teams, calendrier, graine } = L;
  const decisions = L.decisions;
  // Une saison reprise APRÈS sa dernière journée va droit au bilan : rouvrir
  // l'écran sur « journée 82 sur 82 » ferait relire un écran déjà fini.
  if (calendrier.length && depuis < calendrier.length) {
    ouvrirSaison({
      calendrier, teams, you, enSeries: nombreEnSeries(teams.length), epoque: G.epoque,
      // LA LIGUE EN MÉMOIRE (S79) : l'écran joue chaque journée au moment de la révéler.
      ligue: M,
      ctx: {
        esc, teamLabel, teamShort, tagCourt, logo: getTeamLogoHtml, band: getTeamBand, mug: headshotHtml, rarete: rareteJoueur,
        // Le bouton du son du plateau bascule la même préférence que les options.
        basculerSons: () => { setOption('sons', G.sons ? 'off' : 'on'); syncOptionsUI(); },
        /*
         * UN NOM SE CLIQUE PENDANT LA SAISON, SANS DÉVOILER LA FIN. Le mode
         * 'jour' fait lire les feuilles RÉVÉLÉES au moment du clic — les
         * compteurs `sim*`, eux, portent les 82 matchs dès que le moteur a
         * joué. Les meneurs, la feuille d'une équipe et le fil du match en
         * direct passent tous par là (ils partagent ce `ctx`).
         */
        fiche: (p, t, html) => lienJoueur(p, t, porteeRevele('saison'), html),
        // UNE CASE SE NOMME PAR SON RANG, et `slotShort` en est le seul
        // propriétaire : l'alerte de blessure le lit plutôt que d'écrire sa
        // propre version (« 2e trio · AD », jamais « Top 6 »).
        slotShort,
        // UN JOUEUR SE NOMME PAR CE QU'IL EST (S79) : ses positions, son rôle, sa saison.
        quiEst,
        // LE BALLOTTAGE (S66) : trois joueurs offerts sur une vraie blessure.
        ballottage: candidatsBallottage,
        // LA RECRUE DU DECK (S73) : trois vrais joueurs, un par position.
        recrues: candidatsRecrue,
        // OÙ IL JOUE (S80) : « 3e paire », dit à côté d'un nom (les dilemmes, le ballottage, un nouveau rôle).
        ouJoue: p => ouJoue(p),
        // LA CARTE MINI (S78) : un joueur offert se voit en carte de joueur.
        carteMini: carteMiniHtml,
        // Sa fiche en aperçu, et « qui sort ? » quand il arrive (S78).
        apercu: apercuJoueur,
        // S79 : toute signature de la saison (ballottage, recrue) respecte le plafond effectif, et dit ce que libère chaque sortie.
        // S80 : une case de réserve libre (Rogue) s'offre d'abord — personne ne sort.
        quiSort: (p, o) => quiSortOuCaseLibre(p, { bloque: q => bloqueParLePlafond(p, q), ...o }),
        // LE MODE ROGUE (S77) : les jetons à ce jour, et la boutique.
        rogue: G.bonus === 'ROGUE' ? { jetons: j => jetonsRogue(j), boutique: (j, decider) => ouvrirBoutique(j, decider),
          // S80 : la saison de la run et le mandat du proprio. 1.0 (R4) : le barème de la run, tel que
          // `jetonsRogue` le compte (`G.rogue.bareme`, fixé au départ de la saison), et le mandat d'après.
          mandat: () => ({ saison: numeroDeSaison(), mot: mandatDe(numeroDeSaison()).mot,
            suivant: numeroDeSaison() < MANDATS.length ? mandatDe(numeroDeSaison() + 1).mot : null,
            bareme: (G.rogue && G.rogue.bareme) || JETONS }) } : null,
        // LA BOUTIQUE ET L'INVENTAIRE (S79), dans les deux modes.
        // Chacune s'ouvre dans une page du Club (1.0, R3) : `page` = { dans, fermer }.
        boutique: { jetons: j => jetonsRogue(j), ouvrir: (j, decider, page) => ouvrirBoutique(j, decider, page), rouvrir: (achat, j, decider) => rouvrirPackJoueurs(achat, j, decider) },
        inventaire: { compte: j => cartesAJouer(j), ouvrir: (j, decider, page) => ouvrirInventaireJeu(j, decider, page) },
        // v2 : les coachs auxquels le vestiaire croit à la journée `j` (js/coachs.js), et celui de la run.
        coachs: j => ({ actifs: coachsActifs(G.ligue ? G.ligue.decisions || [] : [], j + 1), tien: (G.bonus === 'ROGUE' && G.rogue && G.rogue.coach) || null }),
      },
      onTermine: () => terminerSaison(),
      depuis,
      // À chaque journée révélée, la sauvegarde suit. C'est le seul état que
      // la reprise a besoin de connaître.
      onJour: j => { G.journee = j; saveGame(); if (G.bonus === 'ROGUE') renderCap(); majEntete(); },
      // LES CARTES DE SAISON : la graine décide de la main offerte à chaque
      // palier (sans toucher au hasard du moteur), et les paliers déjà pris
      // se lisent dans les décisions — il n'y a pas d'autre état.
      graine,
      // Une main de palier se ferme par n'importe laquelle de ses cartes (S73) :
      // un effet (`carte`), ou une recrue, une amélioration, un rôle, un stage (`deck`).
      cartesPrises: (decisions || []).filter(d => d.carte || (d.deck && typeof d.palier === 'number'))
        .map(d => ({ palier: d.palier ?? d.jour, carte: d.carte || null })),
      onCarte: choisirCarte,
      onTrou: subirCarte,
      // Les épisodes de case vide déjà encaissés, pour qu'un trou ne retende
      // pas sa carte à chaque reprise (voir `trousFaits`, js/saison.js).
      trousPris: (decisions || []).filter(d => typeof d.palier === 'string' && d.palier.startsWith('trou:'))
        .map(d => Number(d.palier.slice(5))),
      // DERRIÈRE LE BANC : l'écran se retire, l'alignement s'ouvre avec les
      // fiches à ce jour, et « Retour au match » rejoue la saison depuis la
      // graine avec la décision (voir `ouvrirBanc`).
      onBanc: j => ouvrirBanc(j),
      decisions,
      onDecision: deciderSaison,
    });
  } else { terminerSaison(); saveGame(); }
}

