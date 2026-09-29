/*
 * LE REPÊCHAGE (sorti de js/game.js en 1.0) : la roulette et ses relances,
 * le tirage vestiaire et le loto, la signature, la barre du plafond, le
 * tableau de bord et le bassin de cartes.
 */

import { loadSeason, state, prefetch } from './data.js';
import { estD as isD, esc, money, pct3 } from './util.js';
import { registerHiddenRatings, nouvelleGraine, getPlayerKey, MUTATIONS, motsDeMutation, mutationNuit, SLOTS, fits, penaliteAffichee, getPositionPenalty, CAP } from './sim.js';
import { mesuresDeSaison, SEASON_ERA_CAP, getEraSalary, ageAtSeason } from './ratings.js';
import { varianteTiree, COTES_VARIANTES, carteDe, traitsDeCarte, NOM_VARIANTE } from './rarete.js';
import { niveauDe, ETOILE, NIVEAUX, PHENOMENE } from './niveaux.js';
import { brancherPastilleNiveau, ouvrirChoix, ouvrirAlignement } from './gerant.js';
import { anneeDeCarte, brillante, gemmeJoueur, serieDe, cartonHtml, photoAction, numeroDeCarte, tirageLimite } from './cartes.js';
import { getTeamBand, fondEquipe, couleurVive, getTeamLogoHtml, teamSeasonUrl } from './logos.js';
import { poseesSur, sePose, casesDAmelioration, varianteApres, BANQUE, CATEGORIES, reglesDe, pourCeJoueur, casesLibres, CASES_DE_BASE } from './banque.js';
import { hubActif } from './coquille.js';
import { pocheDeLaPartie } from './inventaire.js';
import { ajouterAuCartable } from './cartable.js';
import { LOGOS_LOCAUX } from './logos_locaux.js';
import { scoreIdentite, IDENTITES } from './identites.js';
import { codeDeFranchise, saisonsDeFranchise, FRANCHISES } from './franchises.js';
import { $, DEFUNCT, G, MIN_SAL, MODE, SEUIL_IDENTITE, TEAMFULL, ZONE_DESSUS_TITLE, ZONE_SOUS_TITLE, agesAvailable, applyTeamColors, candidats, capHitDuJour, capLeft, capUsed, caseCourante, caseOuverte, closeModal, displayStats, enRepechage, epoqueDuTirage, formatName, franchiseDuTirage, headshotHtml, ico, identite, isPicked, majNavbar, maxForPick, montrerPage, nextNeed, openSlots, poserEchelle, positionClass, positionLabel, quiEst, render, rnd, roleTag, saisonDeFranchise, saveGame, saveOpts, scoreDeLaMain, scoreDuVestiaire, signes, slotsLeft, svCourt, toast, totalCases, vestiaire, zoneEcart, zoneTag } from './game.js';
import { ballottageVu, groupeDe } from './banc.js';
import { ouvrirFiche, porteeRevele, showPlayerModal } from './fiche.js';
import { decisionsDeLaPartie, renderJetons } from './rogue-jeu.js';
import { UNIT_NAMES_D, UNIT_NAMES_F, axesTableHtml, surTable, syncSortOptions, tableStats, tagsTableHtml } from './alignement.js';

/* =====================================================================
   Roulette
   ===================================================================== */

/*
 * LA VRAIE SAISON RECRUE (S79, data/recrues.json, écrit par scripts/recrues.mjs).
 * JP : *je vois Crosby recrue avec stats de sa deuxième saison ?*. Le ruban
 * « Recrue » suivait le contrat d'entrée, qui dure jusqu'à trois saisons ; il
 * suit maintenant la saison recrue, une par joueur (`p.rk`). Le contrat
 * d'entrée garde son effet de jeu (« Le jeune progresse ») : rien ne se rejoue
 * autrement.
 */
let RECRUES = null;
async function chargerRecrues() {
  if (RECRUES) return RECRUES;
  try { const r = await fetch('data/recrues.json'); RECRUES = r.ok ? await r.json() : {}; } catch { RECRUES = {}; }
  return RECRUES;
}
const estRecrue = p => !!(p && p.rk);
export async function getShard(label) {
  if (G.shards.has(label)) return G.shards.get(label);
  const shard = await loadSeason(label);
  const recrues = new Set((await chargerRecrues())[label] || []);
  const byTeam = {};
  for (const p of shard.players) {
    if (recrues.has(p.id)) p.rk = 1;
    if (isD(p) && (!p.np || p.np === 'D')) {
      p.np = (p.shootsCatches === 'R' || p.shoots === 'R') ? 'RD' : 'LD';
    }
    registerHiddenRatings(p);
    (byTeam[p.t] = byTeam[p.t] || []).push(p);
  }
  // Les deux mesures que la carte ne disait pas (défensive, robustesse),
  // rangées parmi les réguliers de la saison : voir `mesuresDeSaison`.
  const entry = { players: shard.players, byTeam, mesures: mesuresDeSaison(shard.players) };
  G.shards.set(label, entry);
  return entry;
}

/*
 * LA VARIANTE D'UNE CARTE DE JOUEUR (S78, js/rarete.js). JP : *pas par
 * joueur, mais par-dessus joueur, comme un shiny dans pokemon*. Elle ne lit ni
 * le salaire ni une cote : elle se tire de la graine de la partie et de la clé
 * du joueur — la même carte d'un rendu à l'autre et d'une reprise à l'autre —
 * sauf celle qu'un pack du mode Rogue a sortie (`G.variantes.cartes`).
 */
function graineVariantes() {
  if (!G.variantes.graine) G.variantes.graine = nouvelleGraine();
  return G.variantes.graine;
}
export function varianteJoueur(p) {
  if (!p) return 'commune';
  // La carte posée pour la saison dit la vérité, lustre compris (l'atelier).
  if (p._carte && p._carte.rar) return p._carte.rar;
  const cle = getPlayerKey(p);
  return G.variantes.cartes[cle] || varianteTiree(COTES_VARIANTES, graineVariantes(), cle);
}
export const rareteJoueur = varianteJoueur;
/*
 * La carte d'un joueur : sa variante, ses bonus, et la recrue qui progresse.
 * 1.0 (J1-G) : les bonus appartiennent à LA CARTE — la clé du joueur, sa
 * variante et son numéro — plus à la graine de la partie. Une holo de
 * Mogilny a les mêmes bonus dans toutes les runs ; deux ors numérotées
 * différentes ont des bonus différents. Le cartable n'a rien de plus à garder.
 */
function carteJoueur(p) {
  const cle = getPlayerKey(p);
  const c = carteDe(varianteJoueur(p), groupeDe(p) === 'G', cle, varianteJoueur(p), (G.variantes.numeros || {})[cle] || 0);
  if (p.elc) c.recrue = true;
  return c;
}
/* Ce que la carte d'un joueur fait sur la glace, en mots (`traitsDeCarte`) : pour l'écran. */
export const traitsJoueur = p => (p ? traitsDeCarte(p._carte || carteJoueur(p)) : []);
/* Le lustre de l'atelier (S78) : la variante que la carte prend (voir `etatPourPoser`). */
const VARIANTE_SUIVANTE = { commune: 'peu', peu: 'rare', rare: 'legendaire' };
/*
 * LES SOUS-SÉRIES (S78), comme dans une vraie collection : la RECRUE (son
 * contrat d'entrée) et l'ÉTOILE — les meilleurs de leur saison, lus dans
 * leurs VRAIES fiches, jamais dans une cote. Depuis S80, l'étoile EST un
 * niveau (js/niveaux.js) : le 4 % du haut des réguliers de sa saison, à son
 * poste — aux points par match, au % d'arrêts pour un gardien —, et le
 * PHÉNOMÈNE, le 1 % du haut, en est le sommet. Une seule définition pour le
 * ruban, le pack Étoiles et les taux des packs. Une saison en cours (moins de
 * matchs) abaisse le seuil de « régulier ».
 */
const niveauJoueur = p => { const e = p && p.s && G.shards.get(p.s); return e ? niveauDe(p, e.players) : -1; };
/*
 * LA PASTILLE DE NIVEAU (1.0, les lignes) : ce qui se lit à la place d'une cote
 * générale — son rang dans sa vraie saison, à son poste. Aucune cote n'entre
 * dans le DOM (`sansCote`) : le niveau est un rang, lu dans ses stats.
 */
export function pastilleNiveau(p) {
  const n = niveauJoueur(p);
  // Moins de matchs qu'un régulier (js/niveaux.js) : pas de rang, et la pastille le dit.
  if (n < 0) return p && p.s && G.shards.get(p.s) ? '<span class="niv niv-partiel" title="Trop peu de matchs dans sa saison pour un rang parmi les réguliers">Peu joué</span>' : '';
  const N = NIVEAUX[n];
  return `<span class="niv niv-${N.cle}" title="${esc(N.nom)} : ${esc(N.rang)} de sa saison, à son poste">${n >= ETOILE ? '★ ' : ''}${esc(N.nom)}</span>`;
}
brancherPastilleNiveau(pastilleNiveau);
/*
 * LE CARTON D'UN JOUEUR (1.0) : ce que le gabarit (`cartonHtml`, js/cartes.js)
 * pose dans le dessin de sa série — le même au vestiaire, dans la carte mini
 * et dans la fiche. o : { nomClasse, clubClasse, eclat }
 */
const sansTaille = html => html.replace(/ style="width:\d+px;height:\d+px;object-fit:contain"/, '');
export function cartonDe(p, o = {}) {
  const rarete = rareteJoueur(p);
  const cle = getPlayerKey(p);
  const mots = String(p.n || '').trim().split(' ');
  return cartonHtml({
    serie: serieDe(p.s), rarete, portraitHtml: headshotHtml(p), actionSrc: photoAction(p),
    pos: esc(positionLabel(p)), posClasse: positionClass(p),
    gemmeHtml: gemmeJoueur(rarete, traitsJoueur(p)), rubanHtml: rubanDe(p),
    nomHtml: formatName(p.n), nomLettres: mots[mots.length - 1].length, nomClasse: o.nomClasse,
    logoHtml: sansTaille(getTeamLogoHtml(p.t, 48)), club: esc(p.t), clubNom: esc(TEAMFULL[p.t] || p.t), clubClasse: o.clubClasse,
    numero: numeroDeCarte(cle), annee: esc(anneeDeCarte(p.s)),
    tirage: esc(tirageLimite(cle, (G.variantes.numeros || {})[cle] || '/99')), signature: esc(p.n), eclat: o.eclat,
  });
}
/* Les couleurs du club, posées sur la carte : le carton de chaque série les lit. */
export function varsEquipe(p) {
  const band = getTeamBand(p.t);
  return `--team-logo:${logoFiligrane(p.t)};--team-band:${band.bg};--team-ink:${band.ink};--team-stripe:${band.stripe};--team-fond:${fondEquipe(p.t) || band.bg};--team-line:${couleurVive(p.t)}`;
}
/*
 * LA CARTE MINI (S78). JP : *versions normales et version mini, pour genre
 * les picks*. Le même carton que la carte du vestiaire, en petit, et UNE
 * ligne dessous : le chiffre clé et le salaire. Elle sert aux choix d'un
 * joueur (pack, ballottage, recrue, garder, nouveau rôle), où trois cartes
 * se comparent côte à côte ; la fiche reste la version complète.
 */
export function carteMiniHtml(p) {
  const st = displayStats(p);
  const cle = p.p === 'G' ? `${svCourt(p)}<small>%ARR</small>` : `${st.pt}<small>PTS</small>`;
  return `<span class="cj-mini-carte" style="${varsEquipe(p)}">${cartonDe(p)}<span class="cjm-ligne"><b>${cle}</b><span>${st.salaryMain}</span></span></span>`;
}
/*
 * SES CARTES (S78). JP : *pour les cartes, ajouter section au verso ou
 * ajouter les cartes de modifs de joueurs*. Ce qu'on a joué SUR lui cette
 * saison — l'atelier, une amélioration, un nouveau rôle — et ce que le hasard
 * lui a fait (un accident de carte), dans l'ordre, chacune avec son effet en
 * chiffres. Seulement ce qui est DÉJÀ arrivé : le moteur joue la saison
 * d'avance (`p._mutCles` porte la fin de l'année), et un accident de la
 * journée 55 ne se lit pas à la journée 20. Sans saison (le repêchage), rien :
 * un joueur n'a pas encore de carte jouée sur lui.
 */
const SOURCE_MOD = { atelier: 'L\'atelier', amelioration: 'Amélioration', style: 'Style', contrat: 'Contrat', choix: 'Nouveau rôle', accident: 'Le hasard' };
function modsDuJoueur(p) {
  const t = G.ligue && G.ligue.you;
  if (!p || !t || !Array.isArray(t.mutations)) return null;
  const cle = getPlayerKey(p);
  const jusqua = porteeRevele('saison') === 'jour' ? (G.journee || 0) : Infinity;
  return t.mutations.filter(m => m.joueur === cle && m.jour < jusqua && MUTATIONS[m.cle]);
}
export const clesDesMods = p => (modsDuJoueur(p) || []).map(m => m.cle);
const estDansMonAlignement = p => !!p && Object.values(G.roster || {}).some(x => x && getPlayerKey(x) === getPlayerKey(p));
/* Une modif, en petite carte couchée : son icône, son nom, d'où elle vient et quand, son effet en chiffres. */
function modHtml(cle, jour, { efface = false, classe = '' } = {}) {
  const M = MUTATIONS[cle];
  const effets = motsDeMutation(cle).map(x => `<span class="${x.bon ? 'bon' : 'prix'}">${esc(x.txt)}</span>`).join('');
  return `<div class="fc-mod src-${M.source}${efface ? ' efface' : ''}${classe ? ` ${classe}` : ''}" title="${esc(M.quoi)}">
      <span class="fc-mod-ico" aria-hidden="true">${M.ico}</span>
      <span class="fc-mod-txt"><span class="fc-mod-tete"><b>${esc(M.nom)}</b><small>${esc(SOURCE_MOD[M.source] || 'Carte')} · J${jour + 1}${efface ? ' · effacé par le physio' : ''}</small></span>
      ${effets ? `<span class="fc-mod-effets">${effets}</span>` : ''}</span>
    </div>`;
}
/*
 * LES CASES D'AMÉLIORATION, AU VERSO (S80, js/banque.js `casesDAmelioration`).
 * JP : *je veux que les upgrades de joueurs se fassent au verso de la carte,
 * pas nécessairement quand on la pige*. « Ses cartes » (S78) devient des
 * CASES : deux, trois pour une holo ou une or. Une case pleine montre la
 * carte posée (lue dans les DÉCISIONS : posée aujourd'hui, elle prend sa case
 * tout de suite, même si le moteur ne la jouera qu'au matin de sa journée).
 * La première case vide montre, selon le moment :
 *   « Poser ici » quand une carte ATTEND (on vient de la choisir, `attente`) ;
 *   « + Poser une amélioration » en saison, pour ton alignement, quand tu as
 *     des cartes qui lui vont (`cartesAPoserSur`) ;
 *   « Case libre » sinon.
 * Dessous, ce qui lui est ARRIVÉ sans prendre de case (un dilemme, un nouveau
 * rôle, un accident), comme avant : seulement ce qui est déjà arrivé.
 */
export function sectionMods(p, attente = null) {
  const mods = modsDuJoueur(p);
  // Seulement un joueur de TON équipe (un adversaire n'a pas de cartes jouées par toi).
  if (!mods || !estDansMonAlignement(p)) return '';
  const k = getPlayerKey(p);
  const posees = poseesSur(decisionsDeLaPartie(), k);
  const arrives = mods.filter(m => !sePose(m.cle));
  // Un malus que le physio a effacé depuis se lit barré.
  const physio = Math.max(-1, ...posees.filter(x => x.cle === 'physio').map(x => x.jour), ...mods.filter(m => m.cle === 'physio').map(m => m.jour));
  const efface = (cle, jour) => jour < physio && mutationNuit(cle);
  const n = Math.max(casesDAmelioration(varianteApres(varianteJoueur(p), posees)), posees.length);
  const cases = posees.map(x => modHtml(x.cle, x.jour, { efface: efface(x.cle, x.jour), classe: 'fc-case pleine' }));
  const plus = !attente && peutPoserEnSaison() && cartesAPoserSur(p).length > 0;
  for (let i = posees.length; i < n; i++) {
    const premiere = i === posees.length;
    if (premiere && attente) {
      const M = MUTATIONS[attente.cle];
      const effets = motsDeMutation(attente.cle).map(x => `<span class="${x.bon ? 'bon' : 'prix'}">${esc(x.txt)}</span>`).join('');
      cases.push(`<button type="button" class="fc-case fc-poser src-${M.source}" data-poser>
        <span class="fc-mod-ico" aria-hidden="true">${M.ico}</span>
        <span class="fc-mod-txt"><span class="fc-mod-tete"><b>${esc(M.nom)}</b><small>${esc(attente.mot || 'En main')}</small></span>
        ${effets ? `<span class="fc-mod-effets">${effets}</span>` : ''}</span>
        <span class="fc-poser-mot">Poser ici</span>
      </button>`);
    } else if (premiere && plus) cases.push('<button type="button" class="fc-case fc-plus" data-plus>+ Poser une amélioration</button>');
    else cases.push('<div class="fc-case fc-libre">Case libre</div>');
  }
  const plein = attente && posees.length >= n ? '<p class="fc-mods-vide">Ses cases sont pleines : cette carte ne peut pas aller sur lui.</p>' : '';
  return `<div class="fc-sec" title="Deux cases d'amélioration ; une de plus pour une carte holo ou or. Chaque carte posée prend une case pour la saison.">Ses améliorations · ${posees.length}/${n}</div>
    <div class="fc-mods fc-cases">${cases.join('')}</div>${plein}
    ${arrives.length ? `<div class="fc-sec">Ce qui lui est arrivé</div>
    <div class="fc-mods">${arrives.map(m => modHtml(m.cle, m.jour, { efface: efface(m.cle, m.jour) })).join('')}</div>` : ''}`;
}
/*
 * POSER EN SAISON (S80) : depuis l'écran de saison, qui prête sa décision du
 * jour (`hub.decider`, js/saison.js) — l'inventaire, le cartable, une fiche
 * ouverte d'un nom. Derrière le banc ou aux séries, non : la carte attend.
 */
const peutPoserEnSaison = () => { const hub = hubActif(); return !!(hub && hub.decider && G.ligue && G.ligue.you && !G.banc); };
const jourDuHub = () => { const hub = hubActif(); return hub && hub.jour ? hub.jour() : (G.journee || 0); };
/* Les modifs de ta poche qui vont à ce joueur (son groupe, une case libre, une édition qui lui fait quelque chose), empilées. */
function cartesAPoserSur(p) {
  const L = G.ligue;
  if (!L || !p) return [];
  const j = jourDuHub();
  const sl = SLOTS.find(s => G.roster[s.i] && getPlayerKey(G.roster[s.i]) === getPlayerKey(p));
  const piles = new Map();
  for (const x of pocheDeLaPartie({ decisions: decisionsDeLaPartie(), graine: L.graine, jour: j, rogue: G.bonus === 'ROGUE' })) {
    const c = BANQUE[x.id];
    if (!c || c.cat !== 'joueur' || etatPourPoser(c.cle, p, sl, { jour: j }).non) continue;
    if (!piles.has(x.id)) piles.set(x.id, []);
    piles.get(x.id).push(x);
  }
  return [...piles.entries()].map(([id, pile]) => ({ id, pile }));
}
/*
 * « + POSER UNE AMÉLIORATION » (S80) : tes cartes qui vont à ce joueur, en
 * cartes ; celle qu'on touche retourne au verso, EN ATTENTE sur la case libre,
 * et c'est « Poser ici » qui la pose. « Retour » rend le verso tel quel.
 */
export function choisirCarteAPoser(p, rouvrir) {
  const offre = cartesAPoserSur(p);
  const groupe = p.p === 'G' ? 'un gardien' : isD(p) ? 'un défenseur' : 'un avant';
  ouvrirChoix({
    ico: '🧬', titre: `Au verso de ${p.n}`, cartes: true, genre: 'poser', fermable: true, motFermer: 'Retour',
    recit: `${p.n}${ouJoue(p) ? ` (${ouJoue(p)})` : ''} : tes cartes qui vont à ${groupe}. Touche celle que tu poses ; elle prendra une case de son verso pour le reste de la saison.`,
    options: offre.map(({ id, pile }) => {
      const c = BANQUE[id];
      return { cle: pile[0].ref, rarete: c.rarete === 'maudite' ? 'commune' : c.rarete, ico: c.ico, nom: c.nom,
        type: `${CATEGORIES[c.cat].un}${pile.length > 1 ? ` · ×${pile.length}` : ''}`, texte: c.texte, mots: reglesDe(id), motChoix: 'Choisir' };
    }),
    onChoix: ref => { const x = offre.find(o => o.pile[0].ref === ref); if (x) rouvrir({ src: 'partie', ref, id: x.id }); },
    onFerme: () => rouvrir(null),
  });
}
/*
 * LA FICHE D'UN JOUEUR À TOI, EN SAISON, RETOURNÉE AU VERSO (S80), avec une
 * carte en attente (`item` : `{ src, ref, id }` de l'inventaire) : « Poser
 * ici » écrit la décision — `{ joue, mutation }`, la même qu'une carte jouée
 * de l'inventaire, rejouée comme toute décision. `decider` : celui de
 * l'inventaire ; sinon celui de l'écran de saison.
 */
export function ouvrirVersoPourPoser(p, item, { decider = null, jour = null, auDessus = false, avant = null } = {}) {
  const c = item && BANQUE[item.id];
  const j = jour ?? jourDuHub();
  const sl = SLOTS.find(s => G.roster[s.i] && getPlayerKey(G.roster[s.i]) === getPlayerKey(p));
  const etat = c ? etatPourPoser(c.cle, p, sl, { jour: j }) : null;
  const attente = c && !etat.non ? { cle: c.cle, mot: etat.mot || 'En main : pose-la sur sa case libre',
    poser: () => {
      closeModal('hockeyCardModal');
      if (avant) avant();
      const d = { joue: { src: item.src, id: item.id, ...(item.ref ? { ref: item.ref } : {}) }, mutation: { cle: c.cle, joueur: getPlayerKey(p), ...(etat.extra || {}) } };
      if (decider) decider({ jour: j, ...d });
      else { const hub = hubActif(); if (hub && hub.decider) { montrerPage('match'); hub.decider(d); } }
    } } : null;
  const L = G.ligue;
  const mode = porteeRevele('saison') === 'jour' ? 'jour' : 'saison';
  ouvrirFiche(p, L ? L.you : null, mode, { verso: true, attente, auDessus,
    // « + Poser une amélioration » rouvre ce même verso, la carte choisie en attente.
    rouvrir: x => ouvrirVersoPourPoser(p, x, { decider, jour, auDessus, avant }) });
}
/*
 * L'ALIGNEMENT EN RANGÉES, POUR UN CHOIX (S80, `ouvrirAlignement` dans
 * js/gerant.js) : les quatre trios, les trois paires, les gardiens et la
 * réserve, dans l'ordre de l'alignement ; chaque case avec son visage, son nom
 * et ses positions. `etat(sl, q)` dit ce que la case vaut pour CE choix :
 * `{ non }` (grisée, et pourquoi), `{ marque, marqueMot }` (le « −N »),
 * `{ note }` (ce qu'elle libère, ce que la carte lui ferait).
 */
export function rangeesAlignement(roster, etat) {
  const rangee = (titre, slots) => ({ titre, cases: slots.map(sl => {
    const q = roster && roster[sl.i];
    if (!q) return { cle: String(sl.i), vide: true, pos: sl.scratch ? '' : sl.role };
    return { cle: String(sl.i), visage: headshotHtml(q), nom: nomCourt(q.n), nomLong: q.n, pos: positionLabel(q), ...(etat(sl, q) || {}) };
  }) });
  return [
    ...UNIT_NAMES_F.map((t, u) => rangee(t, SLOTS.filter(s => s.group === 'F' && s.unit === u && !s.scratch))),
    ...UNIT_NAMES_D.map((t, u) => rangee(t, SLOTS.filter(s => s.group === 'D' && s.unit === u && !s.scratch))),
    rangee('Gardiens', SLOTS.filter(s => s.group === 'G' && !s.scratch)),
    rangee('Réserve', SLOTS.filter(s => s.scratch)),
  ];
}
/*
 * QUI SORT ? (S78, S80). JP : *choisir qui swap si nouveau joueur, pas swap
 * automatique* ; puis *le screen de choix pour les upgrades et les
 * remplacements sont à chier*. Un joueur qui arrive (pack, ballottage,
 * recrue) prend la case de celui qu'on choisit, et on le choisit DANS
 * L'ALIGNEMENT : on voit où joue chacun. Une case qu'il ne peut pas jouer, ou
 * que le plafond refuse (`bloque`, S79), reste là, grisée, avec sa raison ; le
 * « −N » dit qu'il y jouerait hors position ; la note (`note`) dit ce que la
 * sortie libère. Toucher surligne ; « Confirmer » décide. Rend `{ i, sort }`
 * pour la décision de ballottage.
 */
function choisirQuiSort(p, { roster, onChoix, onFerme, genre = '', bloque = null, note = null }) {
  void genre;   // la feuille de l'alignement a son propre genre (`alignement`) ; le paramètre reste pour les appels
  const nomDe = n => String(n).split(' ').slice(-1)[0];
  let marques = false;
  const rangees = rangeesAlignement(roster, (sl, q) => {
    if (!fits(p, sl)) return { non: 'pas sa position' };
    // S79 : la sortie que le plafond refuse reste visible, avec sa raison.
    const b = bloque ? bloque(q) : '';
    if (b) return { non: b };
    const pen = penaliteAffichee(p, sl).pen;
    if (pen) marques = true;
    return { marque: pen ? `−${pen}` : '', marqueMot: pen ? `${nomDe(p.n)} y jouerait hors position (−${pen})` : '', note: note ? note(q) : '' };
  });
  ouvrirAlignement({
    ico: '🔁', titre: `${p.n} arrive : qui sort ?`, motFermer: 'Retour', motConfirmer: 'Confirmer',
    recit: `${p.n} (${quiEst(p)}) prend la case de celui qui sort ; celui-là quitte l'équipe.${marques ? ` « −N » : ${nomDe(p.n)} y jouerait hors position.` : ''}`,
    aide: 'Touche celui qui lui laisse sa place.',
    rangees,
    barre: k => {
      const sl = SLOTS[Number(k)], q = sl && roster[sl.i];
      return q ? `<b>${esc(q.n)}</b> (${esc(ligneDe(sl))}) sort, <b>${esc(p.n)}</b> prend sa place.` : '';
    },
    onChoix: k => { const sl = SLOTS[Number(k)]; if (sl && roster[sl.i] && fits(p, sl) && !(bloque && bloque(roster[sl.i]))) onChoix({ i: sl.i, sort: getPlayerKey(roster[sl.i]) }); },
    onFerme,
  });
}
/*
 * UNE CASE DE RÉSERVE LIBRE (S80, le Rogue). JP : *possible de discard les
 * cartes de remplaçants ou débloquer des slots de remplacement*. Quand un
 * réserviste a été relâché, ou qu'une case de plus est débloquée, le joueur
 * qui arrive peut y entrer sans que personne sorte — c'est une action à
 * part, AVANT « qui sort ? » (`choisirQuiSort` reste tel quel) : on choisit
 * la case libre, ou on choisit qui sort. Sans case libre, rien ne change.
 */
export function quiSortOuCaseLibre(p, o) {
  const libre = G.bonus === 'ROGUE' ? SLOTS.find(sl => sl.scratch && caseOuverte(sl) && !(o.roster || {})[sl.i] && fits(p, sl)) : null;
  if (!libre) { choisirQuiSort(p, o); return; }
  const bloque = o.bloque ? o.bloque(null) : '';
  ouvrirChoix({
    ico: '🪑', titre: `${p.n} arrive : où ?`, compact: true, fermable: true, motFermer: 'Retour', genre: o.genre || '',
    recit: `Une case de réserve est libre : ${p.n} peut y entrer sans que personne sorte. Ou tu choisis qui lui laisse sa place — sa carte ira à ton cartable.`,
    options: [
      { cle: 'libre', ico: '🪑', nom: 'Dans la case de réserve libre', sous: `Personne ne sort · ${money(p.$ || 0)} de plus sur la masse`, desactive: bloque },
      { cle: 'sort', ico: '🔁', nom: 'Choisir qui sort', sous: 'Il prend la place d\'un joueur de ton alignement' },
    ],
    onChoix: k => {
      if (k === 'libre') { if (!bloque) o.onChoix({ i: libre.i, sort: null }); return; }
      choisirQuiSort(p, { ...o, onFerme: () => quiSortOuCaseLibre(p, o) });
    },
    onFerme: o.onFerme,
  });
}
/*
 * LA CARTE QUI SORT VA AU CARTABLE (S80). JP : *envoyer cartes au cartable
 * quand discard*. Un joueur qui laisse sa place (une signature, un
 * ballottage, une recrue) ou qu'on relâche n'est pas perdu : sa carte —
 * avec sa variante — est dans ton cartable, et le classeur peut la tirer au
 * départ d'une autre run. Elle y est souvent déjà (l'alignement y entre au
 * début de la saison) : alors rien ne double, la carte y reste.
 */
export function carteAuCartable(cle) {
  if (!cle) return null;
  const p = Object.values(G.roster || {}).find(x => x && getPlayerKey(x) === cle) || ballottageVu.get(cle) || null;
  if (p) ballottageVu.set(cle, p);
  ajouterAuCartable([{ cle, rar: p ? varianteJoueur(p) : ((G.variantes && G.variantes.cartes[cle]) || 'commune'), num: (G.variantes.numeros || {})[cle] || null }], { doublons: false });
  return p;
}
/*
 * RELÂCHER UN RÉSERVISTE (S80, le Rogue). Une action à part, sur la case du
 * réserviste : on confirme, sa carte va au cartable, sa case se libère (et
 * son salaire sort de la masse). Avant la saison, c'est fait tout de suite ;
 * derrière le banc, ça part avec la décision du « Retour au match »
 * (`G.banc.relaches`), comme le reste de l'alignement.
 */
export function relacherReserviste(s) {
  const p = G.roster[s.i];
  if (!p || !s.scratch || G.bonus !== 'ROGUE') return;
  ouvrirChoix({
    ico: '✋', titre: `Relâcher ${p.n} ?`, compact: true, fermable: true, motFermer: 'Le garder', genre: 'relache',
    recit: `${p.n} quitte ton équipe. Sa carte va à ton cartable : tu la gardes, et le classeur pourra la tirer au départ d'une autre run. Sa case de réserve se libère — un joueur signé pourra y entrer sans que personne sorte.`,
    options: [{ cle: 'oui', ico: '✋', nom: `Relâcher ${p.n}`, sous: [quiEst(p), `libère ${money(capHitDuJour(p))} sous le plafond`].join(' · ') }],
    onChoix: () => {
      const cle = getPlayerKey(p);
      // Connu par sa clé avant de quitter l'alignement : sa carte garde sa variante, son nom reste lisible.
      ballottageVu.set(cle, p);
      delete G.roster[s.i];
      G.selectedSlot = null;
      if (G.banc) {
        (G.banc.relaches = G.banc.relaches || []).push({ i: s.i, sort: cle });
        toast(`${p.n} est relâché. Sa carte ira à ton cartable au retour au match.`, 'warn');
      } else {
        carteAuCartable(cle);
        saveGame();
        toast(`${p.n} est relâché : sa carte est dans ton cartable. ${money(capLeft())} de disponible.`, 'warn');
      }
      render();
    },
  });
}
/* La fiche d'un joueur offert, en aperçu. */
export const apercuJoueur = p => showPlayerModal(p, { apercu: true });
/* La ligne d'un joueur offert : ce que la carte mini ne dit pas (elle dit déjà les points, ou les victoires). */
export const ligneDuChoix = p => (p.p === 'G'
  ? `${p.gp} PJ · ${p.l ?? 0} D · ${pct3(p.sv || 0)}`
  : `${p.gp} PJ · ${p.g} B · ${p.a} A`);
/*
 * L'écusson du club en filigrane derrière un portrait détouré (img/logos, S78).
 * Des guillemets SIMPLES (S79) : la valeur entre aussi dans un attribut
 * `style="…"` (la mini, la fiche), où un guillemet double fermait l'attribut —
 * toutes les couleurs du club qui suivaient tombaient, et la carte sortait grise.
 */
const logoFiligrane = t => (LOGOS_LOCAUX.has(t) ? `url('img/logos/${t}.svg')` : 'none');
/*
 * LE RUBAN DE LA SOUS-SÉRIE, au bas de la photo : « ★ Étoile », « Recrue »,
 * ou les deux. Il remplace le tampon « Recrue » d'avant — et garde son
 * infobulle (ce que la recrue gagne en faisant ses classes). S80 : le
 * sommet de l'étoile, le PHÉNOMÈNE, se dit « ★ Phénomène » (le 1 % du haut
 * de sa saison) ; une recrue étoile garde « ★ Recrue ★ ».
 */
function rubanDe(p) {
  // Le NIVEAU (S80, js/niveaux.js) et la VRAIE saison recrue (S79, `estRecrue`) : le ruban dit l'un ou l'autre, ou les deux.
  const niveau = niveauJoueur(p), etoile = niveau >= ETOILE;
  const rk = estRecrue(p);
  if (!rk && !etoile) return '';
  const recrue = rk && p.elc ? traitsJoueur(p).find(t => t.nom === 'Le jeune progresse') : null;
  const N = etoile ? NIVEAUX[niveau] : null;
  const titre = [rk ? 'Recrue : sa première saison dans la LNH' : '', N ? `${N.nom} : ${N.rang} de sa vraie saison, à son poste` : '', recrue ? `${recrue.ico} ${recrue.nom} — ${recrue.mot}` : ''].filter(Boolean).join(' · ');
  return `<span class="cj-ruban${etoile ? ' etoile' : ''}${niveau === PHENOMENE ? ' phenomene' : ''}${rk ? ' recrue' : ''}" title="${esc(titre)}">${etoile ? '★ ' : ''}${rk ? 'Recrue' : N.nom}${etoile && rk ? ' ★' : ''}</span>`;
}
/* Le niveau que la carte ne dit pas déjà : le ruban nomme l'Étoile et le Phénomène (S80, jamais deux fois la même chose). */
export const niveauHorsRuban = (p, niveau = niveauJoueur(p)) => (niveau < 0 || (niveau >= ETOILE && !estRecrue(p)) ? '' : NIVEAUX[niveau].nom);
/*
 * CE QU'UNE MODIF FERAIT À CE JOUEUR, À CE JOUR (S78, S80). L'atelier disait
 * déjà, joueur par joueur, ce que son édition ferait — il joue hors position,
 * il est au-dessus de sa zone, il traîne un malus, sa carte passe de holo à
 * or — et grisait l'inutile. C'est maintenant l'état d'une CASE de
 * l'alignement quand on pose une modif (`poserUneModif`), et de son verso
 * (`sectionMods`). Rend `{ non }` (il ne peut pas la recevoir, et pourquoi)
 * ou `{ note, extra }` : ce qu'elle lui ferait, et ce que la décision porte en
 * plus (la variante suivante d'un lustre, calculée ici, js/rarete.js). Les
 * malus sont ceux DÉJÀ arrivés : la ligue se joue au jour le jour.
 */
export function etatPourPoser(cle, q, sl, { jour = G.journee || 0, you = G.ligue && G.ligue.you, decisions = decisionsDeLaPartie() } = {}) {
  const M = MUTATIONS[cle];
  if (!M || !q) return { non: 'rien à poser' };
  const g = q.p === 'G';
  if (!pourCeJoueur(cle, g)) return { non: g ? 'pas pour un gardien' : 'une carte de gardien' };
  const k = getPlayerKey(q);
  const posees = poseesSur(decisions, k);
  const libres = casesLibres(varianteJoueur(q), posees);
  if (!libres) return { non: 'ses cases sont pleines' };
  // Ses cases libres ne se disent que quand elles sortent de l'ordinaire (une seule, ou trois pour une holo) : pas vingt fois « 2 cases libres ».
  const place = libres === CASES_DE_BASE ? '' : `${libres} case${libres > 1 ? 's' : ''} libre${libres > 1 ? 's' : ''}`;
  if (cle === 'partout') {
    if (q._partout || posees.some(x => x.cle === 'partout')) return { non: 'il joue déjà partout' };
    return { note: sl && getPositionPenalty(q, sl) > 0 ? 'hors position ici' : place };
  }
  if (cle === 'cran') return { note: sl && zoneEcart(q, sl) === 'dessus' ? 'au-dessus de sa zone' : place };
  if (cle === 'physio') {
    // Les malus depuis le dernier passage du physio (arrivé, ou déjà posé).
    const siens = ((you && you.mutations) || []).filter(m => m.joueur === k && m.jour < jour);
    const dernier = Math.max(-1, ...siens.filter(m => m.cle === 'physio').map(m => m.jour), ...posees.filter(x => x.cle === 'physio').map(x => x.jour));
    const malus = siens.filter(m => m.jour >= dernier && m.cle !== 'physio' && mutationNuit(m.cle)).map(m => MUTATIONS[m.cle]);
    return malus.length ? { note: `efface ${malus.map(x => x.ico).join(' ')}` } : { non: 'aucun malus' };
  }
  if (cle === 'lustre') {
    const r = varianteApres(varianteJoueur(q), posees), n = VARIANTE_SUIVANTE[r];
    if (!n) return { non: 'sa carte est déjà en or' };
    const carte = carteDe(n, g, k, n, (G.variantes.numeros || {})[k] || 0);
    return { note: `${NOM_VARIANTE[r]} → ${NOM_VARIANTE[n]}`, extra: { carte: { rar: carte.rar, bonus: carte.bonus } },
      mot: `${NOM_VARIANTE[r]} → ${NOM_VARIANTE[n]} : ${traitsDeCarte(carte).map(b => `${b.ico} ${b.nom}`).join(' + ')}` };
  }
  return { note: place };
}
/*
 * LES CARTES QUI JOUENT (S78) : celles de TON alignement, et de ceux qui y
 * entreront en cours de saison (ballottage, recrue, pack). Les clubs
 * adverses jouent leurs joueurs, pas des cartes : on retire celles d'avant.
 */
const CARTES_POSEES = new Set();
export function poserCartes(decisions = []) {
  for (const p of CARTES_POSEES) delete p._carte;
  CARTES_POSEES.clear();
  const miens = Object.values(G.roster || {}).filter(Boolean);
  for (const d of decisions) {
    const b = d && d.ballottage;
    if (!b || !b.entre) continue;
    if (b.rar) G.variantes.cartes[b.entre] = b.rar;
    const p = ballottageVu.get(b.entre);
    if (p) miens.push(p);
  }
  for (const p of miens) { p._carte = carteJoueur(p); CARTES_POSEES.add(p); }
}
/*
 * LES BRILLANTES DÉJÀ VUES (S78) : l'éclat d'une variante brillante (« ✦ »)
 * ne part qu'à sa PREMIÈRE apparition au vestiaire — le bassin se redessine à
 * chaque geste, et un éclat qui repart à chaque toucher n'est plus un
 * événement. Rien à sauvegarder : au pire, un rechargement le rejoue une fois.
 */
const VARIANTES_VUES = new Set();

/** La défensive et la robustesse mesurées d'un joueur, ou null (gardien, moins de 20 matchs). */
export function mesure(p) {
  const entry = p && G.shards.get(p.s);
  return (entry && entry.mesures && entry.mesures.get(p)) || null;
}

/* L'IDENTITÉ DE DÉPART (S73) : pendant le repêchage, un joueur qui y colle porte son icône. */
export function identiteTag(p, full = false) {
  const I = identite() && enRepechage() && scoreIdentite(identite(), p) >= SEUIL_IDENTITE ? IDENTITES[identite()] : null;
  return I ? `<span class="tag tag-identite" title="Colle à ton identité : ${esc(I.nom)}">${I.ico}${full ? ` ${esc(I.nom)}` : ''}</span>` : '';
}

/* L'identité choisie, en une puce dans la roulette : ce qu'elle oriente se lit au survol. */
const identitePuce = () => (identite() ? `<span class="spin-identite" title="${esc(IDENTITES[identite()].texte)}">${IDENTITES[identite()].ico} ${esc(IDENTITES[identite()].nom)}</span>` : '');

/**
 * Un vestiaire au hasard : une saison, une équipe qui a de quoi s'aligner,
 * jamais un club déjà dans `deja` (le tirage précédent, ou les deux autres
 * clubs du même loto).
 */
async function vestiaireAuHasard(deja) {
  const seasons = state.index.seasons;
  const fr = franchiseDuTirage();
  for (let essai = 0; essai < 12; essai++) {
    const season = fr ? saisonDeFranchise(fr) : (epoqueDuTirage() || rnd(seasons));
    let shard;
    try { shard = await getShard(season); } catch { continue; }
    const teams = Object.keys(shard.byTeam)
      .filter(t => shard.byTeam[t].length >= 8 && !deja.has(`${season}_${t}`) && (!fr || t === codeDeFranchise(fr, season)));
    if (!teams.length) continue;
    const team = rnd(teams);
    return { season, team, pool: shard.byTeam[team] };
  }
  return null;
}

/**
 * LA ROULETTE TOURNE.
 *
 * En VESTIAIRE (le jeu d'origine) : une saison et une équipe au hasard ;
 * `newSeason` et `newTeam` disent ce qu'une relance garde — « autre année »
 * change la saison et l'équipe, « autre équipe » garde la saison. Le club
 * doit avoir au moins un joueur plaçable ; le budget, c'est aux relances et
 * à la bande de secours de s'en occuper, comme avant.
 *
 * En LOTO : trois clubs, et la main doit contenir au moins un joueur qui a
 * une case et qui tient dans le budget du choix — vingt essais sur ce
 * critère, puis sous le plafond restant, puis plaçable.
 */
export async function nextSpin(newSeason = true, newTeam = true) {
  G.loading = true;
  G.selectedSlot = null;
  renderSpin();

  const besoin = nextNeed();
  const seasons = state.index.seasons;

  if (!MODE().loto) {
    const cur = vestiaire();
    const fr = franchiseDuTirage();
    for (let attempt = 0; attempt < 25 && besoin; attempt++) {
      // UNE FRANCHISE : chaque tour sort une AUTRE saison de son histoire.
      const season = fr ? saisonDeFranchise(fr, cur && cur.season) : (epoqueDuTirage() || ((!newSeason && cur) ? cur.season : rnd(seasons)));
      let shard;
      try { shard = await getShard(season); } catch { continue; }

      let teams = Object.keys(shard.byTeam).filter(t => shard.byTeam[t].length >= 8);
      if (fr) {
        teams = teams.filter(t => t === codeDeFranchise(fr, season));
      } else if (!newTeam && cur && shard.byTeam[cur.team]?.length >= 8) {
        teams = [cur.team];
      } else if (cur) {
        teams = teams.filter(t => !(season === cur.season && t === cur.team));
      }
      if (!teams.length) continue;

      let team = rnd(teams);
      // L'IDENTITÉ : un deuxième club de la même saison, et on garde celui qui colle le mieux.
      if (identite() && teams.length > 1) {
        const autre = rnd(teams.filter(t => t !== team));
        if (scoreDuVestiaire(shard.byTeam[autre]) > scoreDuVestiaire(shard.byTeam[team])) team = autre;
      }
      const pool = shard.byTeam[team];
      if (!pool.some(p => !isPicked(p) && openSlots(p).length)) continue;

      G.tirage = [{ season, team, pool }];
      break;
    }
    G.loading = false;
    applyTeamColors(vestiaire()?.team);
    saveGame();
    if (!epoqueDuTirage()) prefetch([rnd(seasons), rnd(seasons)]);
    return;
  }

  const n = 3;
  const avant = new Set(G.tirage.map(v => `${v.season}_${v.team}`));
  let dernier = null;

  // Une petite franchise (le Kraken, cinq saisons) ne peut pas toujours
  // sortir trois clubs neufs : elle peut reprendre ceux du tour d'avant.
  const petite = franchiseDuTirage() && saisonsDeFranchise(franchiseDuTirage(), state.index.seasons).length < 8;
  for (let attempt = 0; attempt < 30 && besoin; attempt++) {
    const deja = new Set(petite ? [] : avant);
    const tirage = [];
    for (let k = 0; k < n; k++) {
      let v = await vestiaireAuHasard(deja);
      if (!v) break;
      // L'IDENTITÉ : un deuxième club, et on garde celui dont le joueur offert colle le mieux.
      if (identite()) {
        const autre = await vestiaireAuHasard(new Set([...deja, `${v.season}_${v.team}`]));
        if (autre && scoreDeLaMain(autre) > scoreDeLaMain(v)) v = autre;
      }
      deja.add(`${v.season}_${v.team}`);
      tirage.push(v);
    }
    if (tirage.length < n) continue;

    G.tirage = tirage;
    const main = candidats().filter(p => !isPicked(p) && openSlots(p).length);
    if (!main.length) continue;
    dernier = tirage;
    const plafond = attempt < 20 ? maxForPick() : attempt < 26 ? capLeft() : Infinity;
    if (!main.some(p => p.$ <= plafond)) continue;
    break;
  }

  if (dernier) G.tirage = dernier;
  G.loading = false;
  applyTeamColors(null);
  saveGame();
  if (!epoqueDuTirage()) prefetch([rnd(seasons), rnd(seasons)]);
}

/* =====================================================================
   Rendu — plafond, roulette, tableau de bord
   ===================================================================== */

export function renderCap() {
  if (G.bonus === 'ROGUE') { renderJetons(); return; }
  const lbl = $('capGauge') && $('capGauge').querySelector('.capgauge-label');
  if (lbl) lbl.textContent = 'Plafond restant';
  const used = capUsed(), rem = capLeft(), left = slotsLeft();
  const isEra = G.salaryMode === 'ERA';
  const season = vestiaire()?.season || '2025-26';
  const eraCap = SEASON_ERA_CAP[season] || CAP;

  const amt = $('capAmt');
  amt.textContent = isEra ? money(getEraSalary(rem, season)) : money(rem);

  // Serré quand il reste moins de 1,5 M$ par case à combler
  const tight = left > 0 && rem < left * 1_500_000;
  amt.classList.toggle('over', rem < 0);
  amt.classList.toggle('tight', rem >= 0 && tight);

  $('capMaxLbl').textContent = isEra ? `/ ${money(eraCap)} (${season})` : `/ ${money(MODE().cap)}`;
  // Le `title` était écrit en dur à 95,5 M$ dans le HTML : il mentait en Express.
  $('capGauge').title = `Plafond salarial de ${money(MODE().cap)} (valeur 2026)`;

  const fill = $('capFill');
  fill.style.width = Math.min(100, Math.max(0, (used / MODE().cap) * 100)) + '%';
  fill.classList.toggle('over', rem < 0);
  fill.classList.toggle('tight', rem >= 0 && tight);

  // Repère : masse salariale « au rythme » pour 23 joueurs
  const marker = $('capMarker');
  if (marker) marker.style.left = Math.min(100, (signes().length / totalCases()) * 100) + '%';

  $('cnt').textContent = `${signes().length} / ${totalCases()}`;

  const perSlot = $('perSlotLbl');
  if (perSlot) {
    perSlot.textContent = left > 0
      ? `${money(rem / left)} / case`
      : (rem >= 0 ? 'Sous le plafond ✓' : 'Plafond dépassé');
    perSlot.className = left === 0 && rem < 0 ? 'dash-bad' : '';
  }
}

export function renderSpin() {
  const host = $('spin');
  if (!host) return;

  // 1.0 (R5) : un alignement déjà complet sans roulette (les plombiers du Rogue) ne « tourne » pas.
  if (!G.loading && !G.tirage.length && slotsLeft() === 0) {
    host.innerHTML = `<div class="spin-card spin-complet"><div class="spin-top">
      <div class="spin-logo">${ico('i-list')}</div>
      <div class="spin-id"><div class="spin-name">Alignement complet</div>
      <div class="spin-full">Permute tes joueurs, ou lance la saison</div></div></div></div>`;
    return;
  }
  if (G.loading || !G.tirage.length) {
    host.innerHTML = `<div class="spin-card"><div class="spin-top">
      <div class="spin-logo">${ico('i-dice')}</div>
      <div class="spin-id"><div class="spin-name">La roulette tourne…</div>
      <div class="spin-full">Chargement du vestiaire</div></div></div></div>`;
    return;
  }

  const need = nextNeed();
  const c = caseCourante();
  const targetSlot = G.target !== null ? SLOTS[G.target] : null;
  const instruction = targetSlot
    ? `${ico('i-target')} Case ciblée : <span class="target-on">${esc(slotShort(targetSlot))}</span> — touche-la à nouveau pour annuler.`
    : need ? ''
      : `Alignement complet : permute tes joueurs ou simule.`;

  if (MODE().loto) {
    // TROIS CLUBS, UN CHOIX. La carte porte la case qu'on comble en gros —
    // c'est elle qu'on décide — et les trois clubs en pastilles, chacune
    // vers sa vraie saison sur Hockey-Reference. Les cartes de la main
    // portent déjà chacune la couleur de leur vestiaire.
    const clubs = G.tirage.map(v => {
      const url = teamSeasonUrl(v.team, v.season);
      const dead = DEFUNCT.has(v.team) ? ' spin-club-dead' : '';
      const inner = `${getTeamLogoHtml(v.team, 18)}<span class="spin-club-code">${esc(v.team)}</span><span class="spin-club-season">${esc(v.season)}</span>`;
      return url
        ? `<a class="spin-club${dead}" href="${url}" target="_blank" rel="noopener" title="${esc(TEAMFULL[v.team] || v.team)} ${esc(v.season)} sur Hockey-Reference">${inner}</a>`
        : `<span class="spin-club${dead}">${inner}</span>`;
    }).join('');
    host.innerHTML = `
      <div class="spin-card spin-loto">
        <div class="spin-top">
          <div class="spin-logo">${ico('i-dice')}</div>
          <div class="spin-id">
            <div class="spin-kicker"><span class="spin-code">Loto</span><span class="spin-season">${G.tirage.length} clubs</span>${identitePuce()}</div>
            <div class="spin-name">${c ? esc(slotShort(c)) : 'Alignement complet'}</div>
          </div>
        </div>
        <div class="spin-clubs">${clubs}</div>
        ${instruction ? `<div class="spin-instruction">${instruction}</div>` : ''}
        <div class="rerolls">
          <button id="rrL" class="reroll" ${G.relances > 0 && need ? '' : 'disabled'} title="Relancer les trois clubs d'un coup">
            <span class="rr-lbl">${ico('i-dice')}Relancer les trois</span><span class="rr-count">${G.relances}</span></button>
        </div>
      </div>`;
    ajusterCartes(host);
    $('rrL').onclick = async () => {
      if (G.relances <= 0 || !need) return;
      G.relances--;
      await nextSpin();
      render();
    };
    return;
  }

  // UN CLUB, TOUT SON VESTIAIRE — le jeu d'origine. La carte se lit comme
  // une carte de pointage : le code et l'année en surtitre, le NOM de
  // l'équipe en gros, l'écusson en filigrane, et les trois relances en pied.
  // Le lien mène à la vraie saison de ce club sur Hockey-Reference.
  const v = vestiaire();
  const full = TEAMFULL[v.team] || v.team;
  const dead = DEFUNCT.has(v.team) ? ` <span class="spin-dead">· disparue</span>` : '';
  const url = teamSeasonUrl(v.team, v.season);
  host.innerHTML = `
    <div class="spin-card">
      <div class="spin-top">
        <!-- L'écusson fantôme vit DANS le bandeau, pas derrière tout le bloc :
             c'est le grand logo en filigrane d'un bandeau de diffusion. -->
        <div class="spin-watermark" aria-hidden="true">${getTeamLogoHtml(v.team, 150)}</div>
        <div class="spin-logo">${getTeamLogoHtml(v.team, 40)}</div>
        <div class="spin-id">
          <div class="spin-kicker"><span class="spin-code">${esc(v.team)}</span><span class="spin-season">${esc(v.season)}</span>${dead}${identitePuce()}</div>
          <div class="spin-name">${esc(full)}</div>
        </div>
        ${url ? `<a class="spin-ext" href="${url}" target="_blank" rel="noopener" title="La saison ${esc(v.season)} de cette équipe sur Hockey-Reference">${ico('i-ext')}</a>` : ''}
      </div>
      ${instruction ? `<div class="spin-instruction">${instruction}</div>` : ''}
      <div class="rerolls">
        <button id="rrS" class="reroll" ${G.left.season && need && !epoqueDuTirage() ? '' : 'disabled'} title="${epoqueDuTirage() ? `Le repêchage est fixé à ${esc(G.epoque)} : pas d'autre année` : 'Retirer une autre saison au hasard'}">
          <span class="rr-lbl">${ico('i-dice')}Autre année</span><span class="rr-count">${G.left.season}</span></button>
        <button id="rrT" class="reroll" ${G.left.team && need && !franchiseDuTirage() ? '' : 'disabled'} title="${franchiseDuTirage() ? `Le repêchage est fixé à la franchise : ${esc(FRANCHISES[G.franchise].nom)}` : 'Garder la saison, changer d\'équipe'}">
          <span class="rr-lbl">${ico('i-swap')}Autre équipe</span><span class="rr-count">${G.left.team}</span></button>
        <button id="rrP" class="reroll" ${G.left.pass && need ? '' : 'disabled'} title="Passer ce vestiaire au complet">
          <span class="rr-lbl">${ico('i-skip')}Passer</span><span class="rr-count">${G.left.pass}</span></button>
      </div>
    </div>`;

  const reroll = async (kind, ns, nt) => {
    if (!G.left[kind] || !need) return;
    G.left[kind]--;
    await nextSpin(ns, nt);
    render();
  };
  ajusterCartes(host);
  $('rrS').onclick = () => reroll('season', true, false);
  $('rrT').onclick = () => reroll('team', false, true);
  $('rrP').onclick = () => reroll('pass', true, true);
}

/*
 * UNE CASE SE NOMME PAR SON RANG, PAS PAR SA ZONE. « Top 6 · C » désignait
 * aussi bien le premier trio que le deuxième — Lemieux allait « au Top 6 »
 * et on ne savait pas lequel. « 2e trio · C » le dit. La zone reste sur la
 * pastille du joueur, là où elle sert à décider.
 */
const uniteNom = s => !s ? '' : s.scratch ? 'Réserve' : s.group === 'G' ? 'Gardiens'
  : s.group === 'D' ? UNIT_NAMES_D[s.unit] : UNIT_NAMES_F[s.unit];
export const slotShort = s => s ? `${uniteNom(s)} · ${s.role}` : '—';
/*
 * OÙ IL JOUE (S80). JP : *dire que x est sur la xième ligne*. Un joueur se
 * NOMME par ce qu'il est (`quiEst`), jamais par sa case ; mais on DIT où il
 * joue, en contexte : « Hal Gill (3e paire) sort ». La rangée seulement — le
 * trio, la paire, partant ou auxiliaire, la réserve —, pas le poste de la
 * case : ses positions à lui sont déjà dans `quiEst`.
 */
export const ligneDe = s => !s ? '' : s.scratch ? 'réserve' : s.group === 'G' ? (s.unit ? 'auxiliaire' : 'partant')
  : s.group === 'D' ? UNIT_NAMES_D[s.unit] : UNIT_NAMES_F[s.unit];
export function ouJoue(p, roster = G.roster) {
  if (!p || !roster) return '';
  const k = getPlayerKey(p);
  const sl = SLOTS.find(s => roster[s.i] && getPlayerKey(roster[s.i]) === k);
  return sl ? ligneDe(sl) : '';
}
/* « H. Gill » : le nom qui tient dans une case de l'alignement (le nom entier est dans l'infobulle). */
const nomCourt = n => { const m = String(n || '').trim().split(' '); const nom = m.pop(); return m.length ? `${m[0][0]}. ${nom}` : nom; };

/*
 * UN SEUL COMPTE (1.0, J2-6b) : les joueurs qu'on peut signer à ce choix-ci —
 * une case libre leur va et leur salaire tient dans le budget du choix. Le
 * titre du vestiaire, le tableau de bord et le badge de l'onglet disent ce
 * même nombre ; avant, ils en disaient trois (le club entier, les signables,
 * le filtre courant).
 */
export function compteSignables(pool = candidats(), maxPick = maxForPick()) {
  return pool.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= maxPick).length;
}

export function renderDash() {
  const host = $('dash');
  if (!host) return;

  const left = slotsLeft(), rem = capLeft();
  const maxPick = maxForPick();
  const need = caseCourante();
  const pool = candidats();
  const affordable = pool.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= rem).length;
  const safe = compteSignables(pool, maxPick);

  const budgetCls = left === 0 ? (rem >= 0 ? 'dash-good' : 'dash-bad')
    : maxPick < MIN_SAL ? 'dash-bad'
    : maxPick < 2_000_000 ? 'dash-warn' : '';
  const poolCls = affordable === 0 && left > 0 ? 'dash-bad' : safe === 0 ? 'dash-warn' : '';

  // Les explications vivent dans l'infobulle et dans les règles : le tableau
  // de bord ne montre que le chiffre qui sert à trancher.
  const needTitle = need
    ? (MODE().loto
      ? `Case qu'on comble : ${slotShort(need)}. Le loto, c'est le joueur que trois clubs mettent à cette case exacte. Touche une autre case vide dans l'alignement pour la viser à la place : les mêmes clubs te tendent leur joueur de cette case.`
      : `Prochaine case libre de l'alignement : ${slotShort(need)}. Touche une autre case dans l'alignement pour la viser à la place.`)
    : `Les ${totalCases()} cases sont comblées.`;
  const budgetTitle = left === 0
    ? (rem >= 0 ? `Masse salariale : ${money(capUsed())}, sous le plafond de ${money(MODE().cap)}.` : `Tu dépasses le plafond de ${money(-rem)} : retire un joueur.`)
    : `Le maximum que tu peux mettre sur ce joueur-ci en gardant de quoi combler les ${left - 1} case${left - 1 > 1 ? 's' : ''} suivantes au salaire plancher de ${money(MIN_SAL)}. Il te reste ${money(rem)} pour ${left} cases.`;
  const poolTitle = `${safe} joueur${safe > 1 ? 's' : ''} de ${MODE().loto ? 'cette main' : 'ce vestiaire'} tiennent dans le budget du prochain choix, ${affordable} sous le plafond restant, ${pool.length} au total.`
    + (MODE().loto ? ` Relances : ${G.relances}.` : ` Relances : ${G.left.season} année${G.left.season > 1 ? 's' : ''}, ${G.left.team} équipe${G.left.team > 1 ? 's' : ''}, ${G.left.pass} passe${G.left.pass > 1 ? 's' : ''}.`);

  host.innerHTML = `
    <div class="dash-card" title="${esc(needTitle)}">
      <h3>À combler</h3>
      <div class="dash-big sm">${need ? esc(slotShort(need)) : 'Complet'}</div>
    </div>
    <div class="dash-card" title="${esc(budgetTitle)}">
      <h3>Budget <span class="h3-long">du choix</span></h3>
      <div class="dash-big ${budgetCls}">${left ? money(Math.max(0, maxPick)) : money(rem)}</div>
    </div>
    <div class="dash-card" title="${esc(poolTitle)}">
      <h3>${MODE().loto ? '<span class="h3-long">Cette </span>main' : '<span class="h3-long">Ce </span>vestiaire'}</h3>
      <div class="dash-big ${poolCls}">${safe}<span class="dash-unit">signables</span></div>
    </div>
    ${G.renfort ? `<div class="dash-card" title="Les dix-sept autres cases sont comblées par cette vraie équipe. Elles ne coûtent rien au plafond et ne se modifient pas.">
      <h3>Renfort</h3>
      <div class="dash-big sm">${getTeamLogoHtml(G.renfort.team, 15)} ${esc(G.renfort.team)} <span class="dash-unit">${esc(G.renfort.season)}</span></div>
    </div>` : ''}`;
}

/* =====================================================================
   Rendu — bassin
   ===================================================================== */

/* Besoins par position (réservistes exclus) */
const POS_NEED = [
  { key: 'AG', label: 'AG', role: 'AG', req: 4 },
  { key: 'C', label: 'C', role: 'C', req: 4 },
  { key: 'AD', label: 'AD', role: 'AD', req: 4 },
  { key: 'LD', label: 'DG', role: 'DG', req: 3 },
  { key: 'RD', label: 'DD', role: 'DD', req: 3 },
  { key: 'G', label: 'G', group: 'G', req: 2 },
];

function signedCount(def) {
  return SLOTS.filter(s => !s.scratch && G.roster[s.i] &&
    (def.group ? s.group === def.group : s.role === def.role)).length;
}

/** Valeur de tri « points par million », utile pour repérer les aubaines. */
const valuePerM = p => ((p.p === 'G' ? (p.w ?? 0) * 2.4 : (p.pt || 0)) / Math.max(0.775, p.$ / 1e6));

export function renderFilters() {
  const host = $('filters');
  if (!host) return;
  /*
   * TOUJOURS AG, C, AD, DG, DD, G — le même ordre et les mêmes sigles que les
   * colonnes du bassin, les rangées du tableau de profondeur et les bandeaux
   * de carte. Les pastilles disaient « Centres » avant « Ailiers G. », donc
   * dans un ordre qui n'était celui de rien d'autre dans le jeu, et les
   * libellés longs débordaient la rangée à 390 px : on ne voyait plus les
   * gardiens. Le mot complet reste dans l'infobulle.
   */
  const defs = [
    ['ALL', 'Tout', 'Tout le vestiaire', null],
    ['AG', 'AG', 'Ailiers gauches', POS_NEED[0]],
    ['C', 'C', 'Centres', POS_NEED[1]],
    ['AD', 'AD', 'Ailiers droits', POS_NEED[2]],
    ['LD', 'DG', 'Défenseurs gauches', POS_NEED[3]],
    ['RD', 'DD', 'Défenseurs droits', POS_NEED[4]],
    ['G', 'G', 'Gardiens', POS_NEED[5]],
  ];
  host.innerHTML = defs.map(([key, label, titre, def]) => {
    let badge = '';
    if (key === 'ALL') {
      badge = `<span class="chip-need${slotsLeft() === 0 ? ' full' : ''}">${signes().length}/${totalCases()}</span>`;
    } else if (def) {
      const n = signedCount(def);
      badge = `<span class="chip-need${n >= def.req ? ' full' : ''}">${n}/${def.req}</span>`;
    }
    return `<button class="chip${G.filter === key ? ' on' : ''}" data-f="${key}" role="tab"`
      + ` title="${esc(titre)}" aria-label="${esc(titre)}" aria-selected="${G.filter === key}">${esc(label)}${badge}</button>`;
  }).join('');

  host.querySelectorAll('.chip').forEach(b => {
    b.onclick = () => { G.filter = b.dataset.f; renderFilters(); renderPool(); renderPoolMeta(); };
  });
}

/*
 * En VESTIAIRE, le club entier passe par le filtre de position, la recherche,
 * l'option « signables seulement » et le tri. En LOTO, la main se lit telle
 * quelle, dans l'ordre des trois clubs : trois cartes n'ont besoin de rien.
 */
function poolFiltered() {
  if (MODE().loto) return candidats();
  let list = candidats().slice();

  const f = G.filter;
  if (f === 'C') list = list.filter(p => !isD(p) && p.p !== 'G' && p.np === 'C');
  else if (f === 'AG') list = list.filter(p => !isD(p) && p.p !== 'G' && (p.np === 'L' || p.np === 'AG'));
  else if (f === 'AD') list = list.filter(p => !isD(p) && p.p !== 'G' && (p.np === 'R' || p.np === 'AD'));
  else if (f === 'LD') list = list.filter(p => isD(p) && (p.np === 'LD' || p.np === 'DG' || p.np === 'L'));
  else if (f === 'RD') list = list.filter(p => isD(p) && (p.np === 'RD' || p.np === 'DD' || p.np === 'R'));
  else if (f === 'G') list = list.filter(p => p.p === 'G');

  if (G.search) {
    const q = G.search.toLowerCase();
    list = list.filter(p => p.n.toLowerCase().includes(q));
  }

  if (G.onlyFit) {
    const rem = capLeft();
    list = list.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= rem);
  }

  const key = p => (surTable() ? p.$ : p.p === 'G' ? (p.sv ?? 0) : (p.pt ?? 0));
  // Sur table, un axe du plateau ; le gardien se range sur son AR quel que
  // soit l'axe demandé, puisqu'il n'en a qu'un.
  const axe = k => p => tableStats(p)[p.p === 'G' ? 'AR' : k];
  const parAxe = k => (a, b) => axe(k)(b) - axe(k)(a) || key(b) - key(a);
  const cmp = {
    TI: parAxe('TI'), MA: parAxe('MA'), FO: parAxe('FO'), DE: parAxe('DE'), PA: parAxe('PA'), SO: parAxe('SO'),
    PTS: (a, b) => key(b) - key(a) || b.$ - a.$,
    PPG: (a, b) => (displayStats(b).ppg ?? -1) - (displayStats(a).ppg ?? -1) || key(b) - key(a),
    SAL: (a, b) => b.$ - a.$ || key(b) - key(a),
    VAL: (a, b) => valuePerM(b) - valuePerM(a),
    PM: (a, b) => (b.pm ?? 0) - (a.pm ?? 0) || key(b) - key(a),
    DEF: (a, b) => ((mesure(b) || {}).def ?? -1) - ((mesure(a) || {}).def ?? -1) || key(b) - key(a),
    ROB: (a, b) => ((mesure(b) || {}).rob ?? -1) - ((mesure(a) || {}).rob ?? -1) || key(b) - key(a),
    AGE: (a, b) => (ageAtSeason(a.bd, a.s) ?? 99) - (ageAtSeason(b.bd, b.s) ?? 99) || key(b) - key(a),
    NAME: (a, b) => a.n.localeCompare(b.n, 'fr'),
  }[G.sortBy] || ((a, b) => key(b) - key(a));

  return list.sort(cmp);
}

/** Masque le tri par âge quand aucune date de naissance n'est disponible. */
export function syncAgeControls() {
  syncSortOptions();
  const sort = $('sortSelect');
  if (!sort) return;
  const opt = sort.querySelector('option[value="AGE"]');
  if (!opt) return;
  const ok = agesAvailable();
  opt.hidden = !ok;
  opt.disabled = !ok;
  if (!ok && G.sortBy === 'AGE') { G.sortBy = 'PTS'; saveOpts(); }
  sort.value = G.sortBy;
}

/* Une colonne par position, comme au tableau d'un vrai vestiaire. */
const POOL_COLS = [
  { key: 'AG', title: 'AG · ailier g.', need: POS_NEED[0], test: p => p.p === 'F' && (p.np === 'L' || p.np === 'AG') },
  { key: 'C',  title: 'C · centre',         need: POS_NEED[1], test: p => p.p === 'F' && p.np !== 'L' && p.np !== 'AG' && p.np !== 'R' && p.np !== 'AD' },
  { key: 'AD', title: 'AD · ailier d.',  need: POS_NEED[2], test: p => p.p === 'F' && (p.np === 'R' || p.np === 'AD') },
  { key: 'DG', title: 'DG · déf. gauche', need: POS_NEED[3], test: p => isD(p) && p.np !== 'RD' && p.np !== 'DD' && p.np !== 'R' },
  { key: 'DD', title: 'DD · déf. droit',  need: POS_NEED[4], test: p => isD(p) && (p.np === 'RD' || p.np === 'DD' || p.np === 'R') },
  { key: 'G',  title: 'G · gardien',        need: POS_NEED[5], test: p => p.p === 'G' },
];

export function renderPoolMeta() {
  syncSortOptions();
  const loto = MODE().loto;
  // Le volet change de nom avec le tirage : « Vestiaire » (tout le club) ou
  // « La main » (trois cartes) — et cache ses outils en loto.
  $('panePool')?.classList.toggle('loto', loto);
  const titre = $('poolTitle');
  if (titre) titre.textContent = loto ? 'Le loto' : 'Vestiaire';
  /*
   * LA BARRE SE MET À JOUR ICI, et elle se rebâtit toute seule si ses entrées
   * ont changé — le nom du premier onglet suit le tirage (« Vestiaire » ou
   * « La main »), et la phase décide de la liste entière.
   */
  majNavbar(G.page);
  const meta = $('poolCount');
  if (meta) {
    const c = caseCourante();
    // Le même nombre que le tableau de bord et le badge de l'onglet (1.0, J2-6b).
    const n = compteSignables();
    const mot = `${n} signable${n > 1 ? 's' : ''}`;
    meta.textContent = loto ? (c ? `${mot} · ${slotShort(c)}` : 'Complet') : mot;
  }
  const rMeta = $('rosterMeta');
  if (rMeta) rMeta.textContent = `${signes().length} / ${totalCases()} · ${money(capUsed())}`;
}

/** Case où irait ce joueur : la cible si compatible, sinon la moins pénalisée. */
export function destinationFor(p) {
  const vise = G.target !== null ? SLOTS[G.target] : null;
  const viseOK = vise && !G.roster[G.target] && fits(p, vise) && (!MODE().loto || vise === caseCourante());
  if (viseOK) return vise;
  return openSlots(p)[0] || null;
}

export function playerCardEl(p) {
  const already = isPicked(p);
  const slot = destinationFor(p);
  const rem = capLeft();
  const over = p.$ > rem;
  const risky = !over && p.$ > maxForPick();
  const pen = slot ? penaliteAffichee(p, slot).pen : 0;
  const st = displayStats(p);
  const isTargeted = G.target !== null && slot === SLOTS[G.target];

  // UNE CARTE DE HOCKEY (S76), DANS LE DESSIN DE SA SÉRIE (1.0) : le carton
  // (`cartonDe`) est celui de sa saison, aux couleurs de son club, et sa
  // variante (`tc-<variante>`) n'en est que la parallèle.
  const rarete = rareteJoueur(p);
  const el = document.createElement('div');
  // ✦ Une brillante qui sort pour la première fois éclate une fois (`VARIANTES_VUES`).
  const cleVue = `${getPlayerKey(p)}|${rarete}`;
  const neuve = brillante(rarete) && !VARIANTES_VUES.has(cleVue);
  if (neuve) VARIANTES_VUES.add(cleVue);
  el.className = `pcard tc-${rarete}${neuve ? ' cj-apparait' : ''}`
    + (already ? ' signed' : '')
    + ((already || !slot || over) ? ' locked' : '');
  el.title = 'Toucher la carte pour la fiche complète';
  el.setAttribute('style', varsEquipe(p));

  // La carte ne porte que l'essentiel : qui, combien, ce qu'il vaut et où il
  // va. Le détail des statistiques est dans la fiche, à un clic.
  // 1.0 (C2) : un gardien se juge à son % d'arrêts — le seul chiffre de sa fiche que le moteur lit.
  const bigVal = p.p === 'G' ? svCourt(p) : st.pt;
  const bigUnit = p.p === 'G' ? '%ARR' : 'PTS';

  // Sur table, la carte porte les nombres du plateau à la place du chiffre
  // clé, et le gabarit, le tir et l'habileté à la place de l'archétype, des
  // mesures et de la zone — ce que le plateau lit, rien de ce qu'il ignore.
  const cle = surTable() ? `<span class="pcard-axes">${axesTableHtml(p)}</span>` : `<span class="pcard-big"><b>${bigVal}</b><span>${bigUnit}</span></span>`;
  const mid = `<div class="tags">${surTable() ? tagsTableHtml(p) : [identiteTag(p), roleTag(p), zoneTag(p)].filter(Boolean).join('')}</div>`;

  let dest;
  if (already) {
    const cur = SLOTS.find(s => G.roster[s.i] === p);
    dest = `<span class="dest-ok">✓ signé</span>${cur ? ` · ${esc(slotShort(cur))}` : ''}`;
  } else if (!slot) {
    dest = `<span class="dest-bad">aucune case libre</span>`;
  } else if (over) {
    dest = `<span class="dest-bad">hors budget</span>`;
  } else {
    // La destination n'est dite que quand elle mérite un avertissement : la
    // case visée, une pénalité de position, ou une case hors de sa zone. Le
    // « sous sa zone » est celui qui coûte cher, il se dit en rouge AVANT la
    // signature plutôt qu'après dans le volet de l'alignement.
    const ecart = zoneEcart(p, slot);
    const bits = [];
    if (isTargeted) bits.push(`<span class="dest-target">${ico('i-target')} ${esc(slotShort(slot))}</span>`);
    if (risky) bits.push(`<span class="dest-bad" title="Ce salaire laisse moins que le plancher pour les cases restantes : tu ne pourrais plus compléter les ${totalCases()}.">⚠ bloque la fin</span>`);
    // Le plateau ne lit ni la pénalité de position ni la zone : on ne
    // menace pas d'un malus que le mode bonus ne jouera pas.
    if (!surTable()) {
      if (pen > 0) bits.push(`<span class="dest-bad">−${pen} hors position</span>`);
      if (ecart === 'sous') bits.push(`<span class="dest-bad" title="${esc(ZONE_SOUS_TITLE)}">▼ sous sa zone${isTargeted ? '' : ` : ${esc(slotShort(slot))}`}</span>`);
      else if (ecart === 'dessus') bits.push(`<span class="dest-warn" title="${esc(ZONE_DESSUS_TITLE)}">▲ au-dessus de sa zone</span>`);
    }
    dest = bits.join(' · ');
  }

  // LE BOUTON DIT QUAND IL TE BLOQUE (1.0, J1-Q) : au-delà du budget du choix, il change de mot et de couleur, et demande une confirmation.
  const label = already ? '✓ Signé' : !slot ? 'Position pleine' : over ? 'Hors budget' : risky ? 'Signer · bloque la fin' : 'Signer';

  // LE CARTON, PUIS LA BANDE (1.0) : au-dessus, la carte telle qu'on la
  // collectionne ; dessous, ce qui se COMPARE d'une carte à l'autre — le
  // salaire, le chiffre clé, le rôle et la zone, où il ira, le bouton — à la
  // même place dans les dix séries. Le tirage d'une or est sur la carte
  // (« 07/25 »), sur un tampon qui ne se lit pas comme une note.
  el.innerHTML = `${cartonDe(p, { nomClasse: 'pcard-name', clubClasse: 'pb-team', eclat: neuve })}
    <div class="pcard-fiche">
      <div class="pcard-ligne"><span class="pcard-price">${st.salaryMain}</span>${cle}</div>
      <div class="pcard-mid">${mid}</div>
      <div class="pcard-dest">${dest}</div>
      <button class="btn-sign${already ? ' is-signed' : ''}${risky ? ' risque' : ''}" ${already || !slot || over ? 'disabled' : ''}>${label}</button>
    </div>`;

  el.onclick = ev => {
    if (ev.target.closest('.btn-sign')) return;
    showPlayerModal(p);
  };
  const btn = el.querySelector('.btn-sign');
  btn.onclick = ev => {
    ev.stopPropagation();
    // Deux touchers pour une signature qui bloque la fin : le premier dit ce qu'il restera, le second signe.
    if (btn.classList.contains('risque') && btn.dataset.confirme !== '1') {
      btn.dataset.confirme = '1';
      btn.textContent = `Confirmer ? ${money(capLeft() - p.$)} pour ${slotsLeft() - 1} case${slotsLeft() - 1 > 1 ? 's' : ''}`;
      return;
    }
    signPlayer(p, el);
  };
  return el;
}

/*
 * LA CARTE VA AU CARTABLE (S77). Signer faisait disparaître la carte — la
 * roulette tourne, un autre vestiaire la remplace — sans qu'on la voie partir.
 * Une vignette de la carte (son visage, le métal de sa rareté) saute de la
 * photo et file vers l'onglet de l'alignement, où sa case luit à l'arrivée
 * (`cj-arrive`). Une vignette et non un clone de la carte : un clone est un
 * `.pcard` de plus dans le DOM, avec un bouton « Signer » qui ne fait rien.
 * Transformation et opacité seulement ; rien sous `prefers-reduced-motion`.
 */
function voleAuCartable(el, rarete) {
  if (!el || !el.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const src = el.querySelector('.carton-photo');
  const r = (src && src.offsetParent ? src : el).getBoundingClientRect();
  if (!r.width) return;
  const cible = [...document.querySelectorAll('.navtab[data-page="alignement"]')].find(b => b.offsetParent) || $('cnt');
  const rc = cible ? cible.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight - 40, width: 0, height: 0 };
  const img = src && src.querySelector('img.visage, img.carton-action');
  const v = document.createElement('div');
  v.className = `cj-vole tc-${rarete}`;
  v.setAttribute('aria-hidden', 'true');
  v.innerHTML = img ? `<img src="${img.src}" alt="">` : '<span class="headshot-fallback">👤</span>';
  const w = 46, h = 62;
  v.style.left = `${r.left + r.width / 2 - w / 2}px`;
  v.style.top = `${r.top + r.height / 2 - h / 2}px`;
  v.style.setProperty('--vx', `${Math.round(rc.left + rc.width / 2 - (r.left + r.width / 2))}px`);
  v.style.setProperty('--vy', `${Math.round(rc.top + rc.height / 2 - (r.top + r.height / 2))}px`);
  document.body.appendChild(v);
  const ote = () => v.remove();
  v.addEventListener('animationend', ote);
  setTimeout(ote, 1400);
}

export async function signPlayer(p, el = null) {
  if (isPicked(p)) { toast(`${p.n} est déjà dans ton alignement.`, 'warn'); return; }
  const slot = destinationFor(p);
  if (!slot) { toast('Aucune case libre pour ce joueur.', 'bad'); return; }
  if (p.$ > capLeft()) { toast('Hors budget : il te reste ' + money(capLeft()) + '.', 'bad'); return; }

  voleAuCartable(el, rareteJoueur(p));
  G.dernierSigne = { p, t: Date.now() };
  G.roster[slot.i] = p;
  G.target = null;
  G.selectedSlot = null;

  const pen = penaliteAffichee(p, slot).pen;
  const sous = zoneEcart(p, slot) === 'sous';
  toast(`${p.n} → ${slotShort(slot)}`
    + (pen > 0 ? ` (−${pen} hors position)` : '')
    + (sous ? ' · ▼ sous sa zone' : ''), pen > 0 || sous ? 'warn' : '');
  // Le toast à retardement « sous le plancher » est parti (J1-Q) : le bouton l'a dit AVANT, et a demandé confirmation.

  poserEchelle();
  // Une signature, un tour : la roulette tourne à chaque fois, dans les deux
  // tirages. Ton premier trio sort de trois clubs, pas d'un seul. SAUF si une
  // case a été vidée depuis : ce tour-là a déjà été joué, la signature le
  // repaie et la roulette reste où elle est.
  if (G.dette > 0) G.dette--;
  else await nextSpin();
  saveGame();
  render();
  document.getElementById('topbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Impasse : plus aucune signature possible dans ce vestiaire (tout est hors
 * budget ou sans case libre). C'est récupérable — il faut libérer de la masse
 * salariale — mais il faut le dire clairement plutôt que de laisser le joueur
 * devant une grille de cartes toutes grisées.
 */
function blockedState() {
  if (G.done || slotsLeft() === 0 || !G.tirage.length) return null;
  const rem = capLeft();
  const free = candidats().filter(p => !isPicked(p) && openSlots(p).length);
  if (free.some(p => p.$ <= rem)) return null;
  const cheapest = free.length ? free.reduce((a, b) => (b.$ < a.$ ? b : a)) : null;
  // Seuls tes propres contrats se libèrent : un renfort ne coûte rien.
  const priciest = signes().slice().sort((a, b) => b.$ - a.$)[0] || null;
  const rerolls = MODE().loto ? G.relances : G.left.season + G.left.team + G.left.pass;
  return { rem, cheapest, priciest, rerolls };
}

function blockedBannerEl(st) {
  const el = document.createElement('div');
  el.className = 'blocked';
  const slot = st.priciest ? SLOTS.find(s => G.roster[s.i] === st.priciest) : null;
  const vise = G.target !== null;
  const issue = st.rerolls
    ? `Tu peux relancer (${st.rerolls} relance${st.rerolls > 1 ? 's' : ''} restante${st.rerolls > 1 ? 's' : ''})${vise ? ', viser une autre case' : ''} ou libérer de la masse salariale.`
    : vise ? 'Vise une autre case, ou libère de la masse salariale.'
      : 'Tes relances sont épuisées : il faut libérer de la masse salariale.';
  const ici = MODE().loto ? 'cette main' : 'ce vestiaire';
  el.innerHTML = `
    <div class="blocked-title">⚠ Aucune signature possible ici</div>
    <p>Il te reste <strong>${money(st.rem)}</strong> pour <strong>${slotsLeft()} case${slotsLeft() > 1 ? 's' : ''}</strong>.
      ${st.cheapest ? `Le moins cher de ${ici} qui a une case libre coûte ${money(st.cheapest.$)}.` : `Aucun joueur de ${ici} ne convient à une case libre.`}
      ${issue}</p>
    ${st.priciest ? `<button class="btn danger" id="freeCapBtn">Retirer ${esc(st.priciest.n)} · ${money(st.priciest.$)}${slot ? ` (${esc(slot.role)})` : ''}</button>` : ''}`;
  const btn = el.querySelector('#freeCapBtn');
  if (btn && slot) {
    btn.onclick = () => {
      delete G.roster[slot.i];
      G.selectedSlot = null;
      G.dette++;   // une case vidée est une case vidée, même pour se sortir d'une impasse
      saveGame();
      render();
      toast(`${st.priciest.n} retiré. ${money(capLeft())} de disponible, `
        + `et la roulette ne tournera pas pour cette case.`, 'warn');
    };
  }
  return el;
}

export function renderPool() {
  const host = $('pool');
  if (!host) return;

  /*
   * L'avertissement d'impasse a son propre conteneur, au-dessus du bassin.
   * Dans le bassin il devenait une colonne de la bande qu'on balaie — donc
   * un panneau de plus à faire défiler, alors que c'est justement le moment
   * où le joueur est bloqué et doit le lire tout de suite.
   */
  const notice = $('poolNotice');
  if (notice) notice.innerHTML = '';

  if (G.loading) {
    host.className = 'pool';
    host.innerHTML = `<div class="empty-msg">Ouverture du vestiaire…</div>`;
    return;
  }

  const blocked = blockedState();
  if (blocked && notice) notice.appendChild(blockedBannerEl(blocked));

  const list = poolFiltered();
  if (!list.length) {
    host.className = 'pool';
    host.innerHTML = `<div class="empty-msg">${MODE().loto
      ? (slotsLeft() === 0 ? 'Alignement complet : permute tes joueurs ou simule.'
        : 'Ce tirage ne met personne à cette case.<br>Vise une autre case dans l\'alignement' + (G.relances ? ' ou relance.' : '.'))
      : `Aucun joueur ne correspond.<br>${G.search ? 'Efface la recherche' : G.onlyFit ? 'Désactive « signables seulement » dans les options' : 'Change de filtre'} ou utilise une relance.`}</div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  /*
   * En VESTIAIRE : six colonnes, une par poste — sauf si on a demandé la liste
   * complète, ou si un filtre de position ne laisse déjà qu'un seul poste :
   * ranger une colonne en six colonnes n'a pas de sens. La feuille de style
   * décide ensuite de leur forme : de vraies colonnes côte à côte sur grand
   * écran, une bande qu'on balaie du doigt sur téléphone. En LOTO : la main,
   * trois cartes dans l'ordre des clubs, rien d'autre à ranger.
   */
  const byPos = !MODE().loto && G.poolView === 'POS' && G.filter === 'ALL';
  host.className = 'pool' + (byPos ? ' by-pos' : '');

  if (byPos) {
    for (const col of POOL_COLS) {
      const players = list.filter(col.test);
      const n = signedCount(col.need);
      const el = document.createElement('div');
      el.className = 'pool-col';
      // Le liseré relie l'en-tête à la couleur des cartes de la colonne :
      // on retrouve son poste sans relire le titre.
      const ton = col.key === 'G' ? 'pos-g' : (col.key === 'DG' || col.key === 'DD') ? 'pos-d' : 'pos-f';
      el.innerHTML = `<div class="pool-col-head ${ton}">
        <span class="pool-col-title">${esc(col.title)}</span>
        <span class="pool-col-meta"><span>${players.length} dispo</span>
        <span class="chip-need${n >= col.need.req ? ' full' : ''}" title="Signés sur requis à cette position">${n}/${col.need.req}</span></span>
      </div>`;
      const cards = document.createElement('div');
      cards.className = 'pool-col-cards';
      if (!players.length) cards.innerHTML = `<div class="empty-msg small">Aucun</div>`;
      else for (const p of players) cards.appendChild(playerCardEl(p));
      el.appendChild(cards);
      frag.appendChild(el);
    }
  } else {
    for (const p of list) frag.appendChild(playerCardEl(p));
  }

  host.innerHTML = '';
  host.appendChild(frag);
  ajusterCartes(host);
}

/*
 * LE NOM DE FAMILLE, LES POINTS, LE SALAIRE ET LES ICÔNES SONT TOUJOURS
 * ENTIERS. C'est la règle de JP, et elle remplace les points de suspension
 * sur ces quatre-là : une carte qu'on signe sans avoir lu le nom ne sert à
 * rien. La boîte ne grandit toujours pas — les hauteurs restent fixes — mais
 * le contenu s'adapte : le nom rétrécit sa police jusqu'à tenir (plancher
 * 10 px), et la rangée d'étiquettes se réduit à l'échelle quand elle est
 * plus large que sa place (elle est alignée à droite, on la réduit vers la
 * droite). Les points et le salaire ne rétrécissent jamais : c'est le nom
 * qui cède la place, puisque c'est lui qui a le plus de marge.
 *
 * Lectures d'abord, écritures ensuite : mesurer puis écrire élément par
 * élément forcerait une remise en page par carte.
 */
export function ajusterCartes(root) {
  const noms = [...root.querySelectorAll('.pcard-name .lname, .slot-name, .spin-name')];
  // La rangée de la case d'alignement (1.0, .cell-l2) passe à la ligne : elle ne se réduit pas.
  const tags = [...root.querySelectorAll('.pcard-mid .tags, .slot-tags:not(.cell-l2)')];
  for (const el of noms) el.style.fontSize = '';
  for (const el of tags) { el.style.transform = ''; el.classList.remove('en-deux'); }
  const mesN = noms.map(el => [el, el.scrollWidth, el.clientWidth, parseFloat(getComputedStyle(el).fontSize)]);
  const mesT = tags.map(el => [el, el.scrollWidth, el.clientWidth]);
  for (const [el, sw, cw, fs] of mesN) {
    // Le nom du vestiaire a un plancher plus haut : c'est un titre, pas une étiquette.
    const plancher = el.classList.contains('spin-name') ? 17 : 10;
    if (sw > cw && cw > 0) el.style.fontSize = `${Math.max(plancher, Math.floor(fs * cw / sw * 10) / 10 - 0.2)}px`;
  }
  // Une rangée du vestiaire qu'il faudrait réduire sous 72 % passe plutôt sur deux lignes (1.0) : à 390 px,
  // l'âge, un long rôle (« Manieur de rondelle ») et la zone ne tenaient pas, même réduits à 60 %.
  const enDeux = [];
  for (const [el, sw, cw] of mesT) {
    if (!(sw > cw && cw > 0)) continue;
    if (cw / sw < 0.72 && el.closest('.pcard-mid')) { el.classList.add('en-deux'); enDeux.push(el); }
    else el.style.transform = `scale(${Math.max(0.6, cw / sw).toFixed(3)})`;
  }
  const mesD = enDeux.map(el => [el, el.scrollWidth, el.clientWidth]);
  for (const [el, sw, cw] of mesD) {
    if (sw > cw && cw > 0) el.style.transform = `scale(${Math.max(0.6, cw / sw).toFixed(3)})`;
  }
}
let ajusteTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(ajusteTimer);
  ajusteTimer = setTimeout(() => {
    ajusterCartes(document);
    // L'onglet ouvert reste en vue quand la barre change de forme (S67).
    if (G.page) majNavbar(G.page);
  }, 120);
});
// La police d'affichage arrive après le premier rendu : on remesure avec elle.
if (document.fonts?.ready) document.fonts.ready.then(() => ajusterCartes(document));

// LA HAUTEUR RÉELLE DE LA BARRE DU HAUT. Elle fait 84 px sur téléphone et
// 55 px à partir de 680 px, et deux choses se collent dessous — le volet de
// l'alignement en grand écran, la barre d'onglets du bilan. `--topbar-h`
// était une constante à 88 px, donc un jour de 33 px en grand écran ; on la
// mesure, et elle suit la police et le redimensionnement.
const topbar = document.querySelector('.topbar');
if (topbar && 'ResizeObserver' in window) {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--topbar-h', `${Math.round(topbar.offsetHeight)}px`);
  }).observe(topbar);
}

