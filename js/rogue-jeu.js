/*
 * LE MODE ROGUE DANS LE JEU (sorti de js/game.js en 1.0) : les jetons, la
 * boutique et ses packs, l'inventaire et les cartes qu'on joue, le départ du
 * classeur, la run d'une saison à l'autre, le vestiaire des déblocages. La
 * règle et le méta vivent dans js/rogue.js ; ici, ce que l'écran en fait.
 */

import { lireMeta, bouchesTrousDuDepart, vedettesDeConcession, COMPOSITION_DEPART, SOUTIENS_DEPART, soutiensDuDepart, estSoutien, tirageDuDepart, PRIME_DECOUVERTE, JETONS, jetonsDe, aDebloque, DEBLOCAGES, ajouterCollection, recevoirPermanents, retirerDuMeta, gardesDeLaDerniere, departDuClasseur, lotosDeSaison, jetonsDeDepart, reservesDeLaRun, ecrireMeta, budgetDuClasseur, tirageDuClasseur, lotoDeCase, PLAFOND_PREMIERE, VRAIS_CONTRATS, alourdirLaPremiere, baremeRogue, mandatDe, PLAFOND_ROGUE, plafondDuVestiaire, ESPACE_DE_DEPART, payerEcussons, ecussonsDeLaSaison, payerJalons, ecussonsDesSeries, mandatRempli, JALONS, recompenseDe, peutAcheter, acheterDeblocage, PRESTIGES, rangDePrestige, ecussonsAVie, coachsOuverts, postesDePatron, primesDesFils, payerMissions, graverAuPantheon, RECORDS, EXIGENCES, ICO_EXIGENCE, PRIME_EXIGENCE, exigencesDe, exigencesOuvertes, plafondDeSaison, gardesDeLaRun, motDeLaLigue, niveauDeLigue, packsOuverts, monteeDesPacks, cranDeLaRecrue, copiesDe, COPIES_MAX } from './rogue.js';
import { money, esc, hache } from './util.js';
import { getPlayerKey, getPersonKey, SLOTS, MUTATIONS, assortiPour, joueurDeMutation, autoRoster, fits, getHiddenRatings, getPositionPenalty, nouvelleGraine, REROLLS, joueursDesCoachs, coachDuJoueur, JOURS_PAR_MATCH, matchsEntre, MOMENTS_SI } from './sim.js';
import { modificateurs, BANQUE, reglesDe, PATRONS, patronsActifs, patronsDeDepart, ROLES, payloadDe, CONSOMMABLES, etiquetteBanque, buildDe, coachsActifs, coachNeuf, reglesDePalier, idsDuCoach, motsDeLEcon } from './banque.js';
import { PROTEGES } from './personnel.js';
import { hubActif } from './coquille.js';
import { COACHS, VOIES, SEUILS, ROMAINS } from './coachs.js';
import { motsDeMutationEnChiffres, motsEnChiffres } from './impact.js';
import { etatDuPersonnel, matchsJoues, decisionDEchelon, decisionDeProlongation, patronALEchelon, aUnDefaut, ouvertsDe, reportDuPersonnel, protegeALEchelon, lignesDuFeu, ECHELON_MAX } from './echelons.js';
import { tenusDe } from './chiffre.js';
import { PACKS_TOUS, packsSansHolo, packDuJour, tirerJoueursDuPack, PITIE, tirerCartesDuPack, coachDuPack, DATE_LIMITE_MATCH, achatsDePacks, PACKS_DE_SERIE, DECENNIES, NOMS_SKILLS, BOUTIQUE } from './packs.js';
import { ouvrirMagasin } from './magasin.js';
import { FRANCHISES } from './franchises.js';
import { state } from './data.js';
import { VENTE, valeurDe, optionDeBanque, ouvrirInventaire, cartesDeLaPartie, masseSalarialeHtml, SEMAINE } from './inventaire.js';
import { ajouterAuCartable, donnerUnDoublon, lireCartable, meilleureVariante, motDeMontee, missionsDuCartable, decennieDe, decouvrir, cartesJouees, marquerJouees, poserSurLesCartes, modsDe, ajouterLegendesAuCartable, LEGENDES, graverLaSaison, galonsDe, histoireChezToi } from './cartable.js';
import { ouvrirChoix, motsSurLeJoueur, pucesEnBref, ouvrirAlignement, sceneHtml } from './gerant.js';
import { traitsDeCarte, carteDe, EDITIONS, NOM_VARIANTE } from './rarete.js';
import { ETOILE, PHENOMENE, niveauDe, NIVEAUX } from './niveaux.js';
import { artJoueur, photoAction, cadrePhoto, epoqueDe, serieDe, SERIES } from './cartes.js';
import { getTeamLogoHtml } from './logos.js';
import { ouvrirDepartClasseur } from './depart.js';
import { jouerSon } from './sons.js';
import { nombreEnSeries, leagueStats, gagnantsDesTrophees } from './bilan.js';
import { galonsDeLaSaison, grosGagnesDe, texteDuGalon, GALONS_MAX, ICO_GALON, GALONS } from './galons.js';
import { sceneDuMandat, sceneDesGalons } from './scenes.js';
import { $, G, applyTeamColors, candidats, capHit, capLeft, capUsed, clearSave, contexteDuMenu, enRepechage, headshotHtml, isPicked, majEntete, plafondEffectif, poserLeClub, quiEst, render, saveGame, setView, signes, toast, totalCases } from './game.js';
import { RAYONS_CLUB, choixDuClub, possede, porter, ecussonDe, nomDuClub, offresDuClub, prendre } from './club.js';
import { apercuJoueur, carteMiniHtml, etatPourPoser, getShard, ligneDe, ligneDuChoix, niveauHorsRuban, ouJoue, ouvrirListeJoueurs, ouvrirListeSignature, poserCartes, rangeesAlignement, rareteJoueur } from './repechage.js';
import { POSTE_GROUPE, ballottageVu, groupeDe, sousVoile } from './banc.js';
import { syncOptionsUI } from './partie.js';
import { afficherMenu } from './menu.js';

/* =====================================================================
   LE MODE ROGUE (S77) — voir js/rogue.js pour la règle et le méta.
   ===================================================================== */
/*
 * LA BARRE DU HAUT EN ROGUE (S79) : le plafond restant — le plafond EFFECTIF
 * de la run, et ce qui le tord (le titre les nomme) — et les jetons 🪙, la
 * monnaie de la boutique, à côté.
 */
export function renderJetons() {
  const g = $('capGauge');
  if (!g) return;
  const pl = plafondEffectif();
  const used = capUsed(G.ligue ? pl : null), rem = pl.cap - used;
  const lbl = g.querySelector('.capgauge-label');
  if (lbl) lbl.textContent = 'Plafond restant';
  const meta = lireMeta();
  const amt = $('capAmt');
  amt.textContent = pl.cap >= 1e11 ? '—' : money(rem);
  amt.classList.toggle('over', rem < 0);
  amt.classList.toggle('tight', rem >= 0 && rem < 3_000_000);
  const tordu = pl.lignes.length + pl.facteurs.size + pl.ltir.size;
  $('capMaxLbl').textContent = pl.cap >= 1e11 ? '' : `/ ${money(pl.cap)}${tordu ? ' ✦' : ''}`;
  const lignes = [...pl.lignes.map(l => `${l.nom} ${l.montant > 0 ? '+' : '−'}${money(Math.abs(l.montant))}`),
    ...[...pl.facteurs].map(([k, f]) => `${(signes().find(p => getPlayerKey(p) === k) || {}).n || 'Un ancien'} : ${Math.round(f * 100)} % de son salaire`),
    ...[...pl.ltir].map(k => `${(signes().find(p => getPlayerKey(p) === k) || {}).n || 'Un ancien'} : blessé à long terme${pl.blesses.has(k) ? ' (hors plafond)' : ''}`)];
  g.title = `Plafond de la run : ${money(pl.cap)}${lignes.length ? ` — ${lignes.join(' · ')}` : ''}. Masse : ${money(used)}. Jetons : ${jetonsRogue()} 🪙.`;
  $('capFill').style.width = Math.min(100, Math.max(0, (used / pl.cap) * 100)) + '%';
  $('capFill').classList.toggle('over', rem < 0);
  $('capFill').classList.toggle('tight', rem >= 0 && rem < 3_000_000);
  $('cnt').textContent = `${signes().length} / ${totalCases()}`;
  const perSlot = $('perSlotLbl');
  if (perSlot) { perSlot.textContent = `🪙 ${jetonsRogue()} · ${meta.ecussons || 0} 🏅`; perSlot.className = ''; }
}
/* Ce que la saison a rapporté jusqu'à la journée `j` (révélée), pour les jetons. */
function resultatsRogue(j) {
  const L = G.ligue;
  if (!L || !Array.isArray(L.calendrier)) return {};
  const toi = L.you;
  let W = 0, D = 0, P = 0;
  for (const jour of L.calendrier.slice(0, j)) for (const m of jour) {
    if (m.A !== toi && m.B !== toi) continue;
    const pour = m.A === toi ? m.gfA : m.gfB, contre = m.A === toi ? m.gfB : m.gfA;
    if (pour > contre) W++; else if (m.ot) P++; else D++;
  }
  // V8 : un rival choisi paie son butin (un multiple du gros match) ; les autres gros matchs, un.
  const gros = ((toi && toi.minisBoss) || []).filter(mb => mb.gagne && mb.jour < j).reduce((n, mb) => n + (mb.butin || 1) * (mb.mise || 1), 0);
  // Un objectif du proprio réussi, c'est une carte prise à son verdict (`v:`) : un adjoint depuis la V16 (`place`), une place à la V10, au deck avant.
  const objectifs = (L.decisions || []).filter(d => typeof d.palier === 'string' && d.palier.startsWith('v:') && (d.place || d.carte)).length;
  // 1.0 (J1-C) : les rondes de séries gagnées (`finDesSeriesRogue` les pose) — la prime `JETONS.serie` se verse enfin.
  const series = (G.rogue && G.rogue.series && G.rogue.series.rondes) || 0;
  // V3.6 : la prime des fils (le Cheechoo, le jalon…), en Rogue seulement.
  const primes = G.bonus === 'ROGUE' ? primesDesFils(L.calendrier, toi, j).total : 0;
  return { W, L: D, OTL: P, gros, objectifs, series, primes };
}
/*
 * LES JETONS DE LA PARTIE (S79), dans les DEUX modes : les résultats
 * (`JETONS`), plus les ventes (les doublons revendus à l'ouverture, les cartes
 * vendues de l'inventaire), les coffres et les billets gagnants, plus ce que
 * la direction verse par victoire (un patron), moins ce que la boutique a
 * coûté. Tout se DÉDUIT des décisions : rien n'est stocké. Le mode Rogue part
 * de sa caisse (`G.rogue.depart`) ; une saison part de zéro.
 */
export function decisionsDeLaPartie() {
  const L = G.ligue;
  return [...((L && L.decisions) || []), ...((L && L.decisionsSeries) || [])];
}
function victoiresEntre(de, a) {
  const L = G.ligue;
  if (!L || !Array.isArray(L.calendrier)) return 0;
  let n = 0;
  for (const jour of L.calendrier.slice(de, a)) for (const m of jour) {
    if (m.A !== L.you && m.B !== L.you) continue;
    if ((m.A === L.you ? m.gfA : m.gfB) > (m.A === L.you ? m.gfB : m.gfA)) n++;
  }
  return n;
}
/* Les soirs de lancée de ton club entre deux journées (V3.6, le vendeur de chandails) : un par joueur, chaque soir. */
function lanceesEntre(de, a) {
  const L = G.ligue;
  if (!L || !Array.isArray(L.calendrier)) return 0;
  let n = 0;
  for (const jour of L.calendrier.slice(de, a)) for (const m of jour) {
    const f = m.feuille;
    if (!f || !f.lancees || (m.A !== L.you && m.B !== L.you)) continue;
    n += (f.lancees[m.A === L.you ? 'A' : 'B'] || []).length;
  }
  return n;
}
export function jetonsRogue(j = G.journee || 0) {
  const L = G.ligue;
  const decs = decisionsDeLaPartie();
  // 1.0 (J1-D) : une réclamation au ballottage coûte des jetons en Rogue (`ballottage.cout`).
  const depenses = decs.reduce((a, d) => a + ((d.achat || d.rogue || {}).prix || 0) + ((d.plafond || {}).cout || 0) + ((d.ballottage || {}).cout || 0), 0);
  // Un doublon signé (1.0, oct.) n'est pas revendu : sa vente, comptée à l'ouverture, se retire (`annuleVente`).
  const ventes = decs.reduce((a, d) => a + ((d.achat || {}).vente || 0) + (d.gain || 0) + ((d.vend || {}).jetons || 0) - (d.annuleVente || 0), 0);
  const mods = modificateurs(decs);
  // Une période close (`jusqua` : l'adjoint remplacé, ou monté d'un échelon) rapporte jusqu'à son dernier jour (js/banque.js `revenusDuPersonnel`).
  const fin = x => Math.min(j, x.jusqua ?? Infinity);
  const direction = mods.jetonsVictoire.reduce((a, x) => a + x.n * victoiresEntre(x.depuis, fin(x)), 0)
    + mods.jetonsLancee.reduce((a, x) => a + x.n * lanceesEntre(x.depuis, fin(x)), 0);
  const depart = G.bonus === 'ROGUE' ? ((G.rogue && G.rogue.depart) || JETONS.depart) : 0;
  // S80 : le barème de la saison de la run (5 🪙 par victoire sans commanditaire) ; une vieille run garde celui de S79.
  const bareme = G.bonus === 'ROGUE' && G.rogue && G.rogue.bareme ? G.rogue.bareme : JETONS;
  return jetonsDe(L ? resultatsRogue(j) : {}, depenses, depart, bareme) + ventes + direction;
}

/*
 * LA BOUTIQUE (S79, js/magasin.js) : des rayons de packs à la HUT, dans les
 * deux modes. En Rogue, quelques packs se débloquent au vestiaire (le méta).
 */
/* L'espace sous le plafond, pour la boutique : ce qu'un pack de joueurs peut tirer. */
function plafondPourBoutique() {
  const pl = plafondEffectif();
  if (pl.cap >= 1e11) return null;
  const rem = capLeft();
  return { cap: pl.cap, espace: rem, salaireMax: salaireMaxDePack(), tordu: pl.lignes.length + pl.facteurs.size + pl.ltir.size };
}
/* Un joueur que même la plus grosse sortie ne ferait pas entrer (V9) : ce qu'il manque, à libérer d'abord (un réserviste ✕). */
const tropCher = p => { const m = (p.$ || 0) - salaireMaxDePack(); return m > 0 ? `Trop cher : il manque ${money(m)}, même en libérant ton plus gros contrat` : ''; };
/* Le plus gros salaire qu'une signature peut faire entrer : l'espace, plus le plus gros « cap hit » qu'une sortie libérerait. */
function salaireMaxDePack() {
  const pl = G.ligue ? plafondEffectif() : null;
  return capLeft() + Math.max(0, ...signes().map(q => (pl ? capHit(q, pl) : q.$ || 0)));
}
/* Jalon P2 : les déblocages de packs ouvrent un CHOIX dans les packs à thème (le rôle, la décennie). */
const VERROUS_CHOIX = { skill: { defensif: 'packDefenseurs', gardien: 'packGardiens' }, decennie: { 1980: 'packAnnees80' } };
/* Ce qu'un choix refuse encore (valeur → raison), et ce qu'il permet : le hasard ne tire que dans ce qui est ouvert. */
function verrousDesChoix() {
  if (G.bonus !== 'ROGUE') return {};
  const meta = lireMeta();
  return Object.fromEntries(Object.entries(VERROUS_CHOIX).map(([choix, v]) => [choix,
    Object.fromEntries(Object.entries(v).filter(([, d]) => !aDebloque(meta, d)).map(([val, d]) => [val, `Débloque « ${DEBLOCAGES[d].nom} » aux déblocages`]))]));
}
const permisDe = (choix, valeurs) => { const v = verrousDesChoix()[choix] || {}; return valeurs.filter(x => !v[x]); };
/*
 * ACHETER SANS OUVRIR (1.0, oct.). JP : *achat de pack sans ouvrir possible*.
 * Un pack scellé est un achat (`achat.scelle`) qui paie et ne tire rien ; son
 * ouverture est un achat à 0 🪙 qui le nomme (`achat.de`), et tout le reste
 * (les doublons, la garantie, l'inventaire, la signature) suit le chemin de
 * toujours. Un pack de joueurs scellé ne s'ouvre plus après la date limite :
 * il passe à la saison suivante de la run (`report`).
 */
function packsScelles(decs) {
  const ouverts = new Set(decs.filter(d => d && d.achat && d.achat.de).map(d => d.achat.de));
  return decs.filter(d => d && d.achat && d.achat.scelle && PACKS_TOUS[d.achat.pack] && !ouverts.has(d.palier));
}
/* Passé la date limite (ton DATE_LIMITE_MATCH-e match joué), les packs de joueurs se ferment. */
const apresDateLimite = j => !!(G.ligue && G.ligue.you && matchsEntre(G.ligue.you, 0, j) >= DATE_LIMITE_MATCH);
/*
 * LA BOUTIQUE RESTE OUVERTE (Jalon P2) : tous ses packs ont des joueurs ; passé la date limite, ils vont au cartable
 * sans se signer (`offrirPackJoueurs`), et les cartes servent encore. Seul un pack scellé attend la saison suivante.
 */
/* Ce que la boutique vend : en Rogue, ce que tes jalons ont ouvert (V10, js/rogue.js `packsOuverts`) ; hors du Rogue, tout. */
const packsOuvertsBoutique = () => (G.bonus === 'ROGUE' ? packsOuverts(lireMeta()) : Object.fromEntries(Object.keys(PACKS_TOUS).map(k => [k, true])));
/*
 * LE NUMÉRO D'UN ACHAT SE PREND AU CLIC (oct.). JP : *encore des doublons de packs achetés*. Il se prenait à
 * l'ouverture de la boutique ; or un pack de joueurs charge ses saisons AVANT d'écrire son achat, et la boutique
 * restait cliquable pendant ce temps : un second achat reprenait le même numéro — le même tirage, la même décision
 * `k:n`, qui remplaçait la première. Le numéro compte donc aussi les achats encore en vol, et un seul tirage se
 * fait à la fois.
 */
let dernierAchat = { graine: null, n: -1 };
function numeroDAchat() {
  const pris = decisionsDeLaPartie().filter(d => d.achat || d.rogue).length;
  const graine = G.ligue ? G.ligue.graine : null;
  const n = dernierAchat.graine === graine ? Math.max(pris, dernierAchat.n + 1) : pris;
  dernierAchat = { graine, n };
  return n;
}
let tirageEnCours = false;
function unTirageALaFois(f) {
  if (tirageEnCours) { toast('Un pack s\'ouvre déjà : un instant.'); return; }
  tirageEnCours = true;
  Promise.resolve().then(f)
    .catch(() => toast('Impossible d\'ouvrir ce pack : une saison n\'a pas pu se charger.', 'bad'))
    .finally(() => { tirageEnCours = false; });
}
/*
 * LA BOUTIQUE OUVERTE EN TOUT TEMPS (V5). JP : *accès au store en tout temps*. Elle avait fermé hors du lundi ;
 * le nœud de la semaine regroupe maintenant ce qui se décide, et la boutique reste ouverte à toute journée.
 */
export function ouvrirBoutique(j, decider, page) {
  const decs = decisionsDeLaPartie();
  const ouverts = packsOuvertsBoutique();
  ouvrirMagasin({
    ...(page || {}),
    jetons: jetonsRogue(j), mode: G.bonus === 'ROGUE' ? 'rogue' : 'saison', ouverts,
    // V8 : ce qui manque à ton équipe, en tête du Marché — là où l'on décide quoi acheter.
    besoins: G.bonus === 'ROGUE' ? blessesAuJour(j).map(b => `🩹 ${b.p.n} : absent ${b.reste} match${b.reste > 1 ? 's' : ''}`) : [],
    // V7 : le barème des jetons vit où ils se dépensent (il était au bureau).
    bareme: G.bonus === 'ROGUE' ? ((G.rogue && G.rogue.bareme) || JETONS) : null,
    mods: modsDesPacks(decs, j), achats: () => (G.bonus === 'ROGUE' ? achatsDePacks(decisionsDeLaPartie()) : 0), sansHolo: G.bonus === 'ROGUE' ? packsSansHolo(decs) : 0, plafond: plafondPourBoutique(),
    // V5 : en Rogue, le pack au rabais est celui de la semaine, tiré de la graine (plus de la date réelle).
    duJour: packDuJour(G.bonus === 'ROGUE' && G.ligue ? `${G.ligue.graine}:s${Math.floor(j / SEMAINE)}` : new Date(), packsOuvertsBoutique()),
    // 1.0 (R5) : à la première run, avant le 20e match, quatre packs ; « Voir les N packs » montre tout.
    // Le vrai calendrier (1.0, oct.) : le 20e match tombe vers le jour 45 (20 × 186 / 82).
    debutant: G.bonus === 'ROGUE' && ((G.rogue && G.rogue.numero) || 1) <= 1 && j < Math.round(20 * JOURS_PAR_MATCH),
    franchises: Object.entries(FRANCHISES).map(([cle, F]) => ({ cle, nom: F.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    // v2 : le pack du coach propose ton coach en premier.
    coachs: VOIES.map(k => ({ cle: k, nom: `${COACHS[k].ico} ${COACHS[k].nom}` })), coachRun: (G.rogue && G.rogue.coach) || null,
    // Jalon P2 : la décennie et le rôle des packs à thème, avec ce que les déblocages ouvrent encore.
    decennies: DECENNIES.filter(d => state.index.seasons.some(x => Number(String(x).slice(0, 4)) >= d && Number(String(x).slice(0, 4)) < d + 10)),
    roles: Object.entries(NOMS_SKILLS).map(([cle, nom]) => ({ cle, nom })), verrousChoix: verrousDesChoix(),
    acheter: (cle, { prix, params: choisis, scelle = false }) => {
      const P = PACKS_TOUS[cle];
      // Le hasard d'un pack à thème ne tire que dans ce que les déblocages ouvrent (`permis`).
      const params = P.choix === 'skill' ? { ...choisis, permis: permisDe('skill', Object.keys(NOMS_SKILLS)) }
        : P.choix === 'decennie' ? { ...choisis, permis: permisDe('decennie', DECENNIES) } : choisis;
      // Les jetons se recomptent au clic : une boutique restée ouverte montre ceux d'avant le dernier achat.
      if (prix > jetonsRogue(j)) { toast(`Il te manque ${prix - jetonsRogue(j)} 🪙.`, 'bad'); return; }
      if (scelle) {
        const n = numeroDAchat();
        decider({ jour: j, palier: `k:${n}`, achat: { pack: cle, n, prix, sorte: P.sorte, params, scelle: true } });
        toast(`${P.ico} ${P.nom} : scellé, à ouvrir quand tu veux.`);
        return;
      }
      unTirageALaFois(() => { const n = numeroDAchat(); return P.sorte === 'cartes' ? ouvrirPackCartes(cle, prix, j, n, decider, params) : ouvrirPackJoueurs(cle, prix, params, j, n, decider); });
    },
    // LES PACKS SCELLÉS : payés, à ouvrir quand on veut — le tirage se fait à l'ouverture, au numéro d'achat suivant.
    /* TON CLUB (1.0, oct.) : les noms, les couleurs et les écussons, payés en jetons comme un pack — par une
       décision d'achat (`sorte: 'club'`), que la partie rejoue et que `jetonsRogue` compte. Le méta le garde. */
    club: offresDuClub(),
    acheterClub: (cle, prix) => {
      if (prix > jetonsRogue(j)) { toast(`Il te manque ${prix - jetonsRogue(j)} 🪙.`, 'bad'); return; }
      const n = numeroDAchat();
      decider({ jour: j, palier: `k:${n}`, achat: { club: cle, n, prix, sorte: 'club' } });
      prendre(cle);
      clubChange();
      toast(`🪙 ${nomDuClub()} : à toi, et porté.`);
    },
    scelles: packsScelles(decs).map(d => ({ palier: d.palier, cle: d.achat.pack, verrou: PACKS_TOUS[d.achat.pack].sorte === 'joueurs' && apresDateLimite(j) ? `La date limite est passée : il s'ouvre la saison prochaine` : '' })),
    ouvrirScelle: palier => {
      const d = packsScelles(decs).find(x => x.palier === palier);
      if (!d || (PACKS_TOUS[d.achat.pack].sorte === 'joueurs' && apresDateLimite(j))) return;
      const { pack, params } = d.achat;
      unTirageALaFois(() => { const n = numeroDAchat(); return PACKS_TOUS[pack].sorte === 'cartes' ? ouvrirPackCartes(pack, 0, j, n, decider, params || {}, palier) : ouvrirPackJoueurs(pack, 0, params || {}, j, n, decider, palier); });
    },
  });
}

/*
 * LES JOUEURS D'UN PACK (S79) : purs, de la graine de la ligue, du pack et du
 * numéro de l'achat. Le tirage vit dans js/packs.js depuis S80
 * (`tirerJoueursDuPack` : le NIVEAU du joueur d'abord, puis sa saison, puis
 * sa variante), pour se mesurer en Node (scripts/check_packs.mjs). Ce qui
 * reste ici, c'est ce que la PARTIE permet : jamais un joueur qui joue déjà
 * dans la ligue ou qui est déjà signé, ni un salaire qu'aucune sortie ne
 * ferait entrer sous le plafond (effectif : les cartes 💵 comptent, les deux modes).
 */
async function tirerPackJoueurs(cle, n, params = {}, mods = {}, garantie = false) {
  const Lg = G.ligue;
  const dansLaLigue = new Set();
  for (const t of Lg.teams || []) for (const p of Object.values(t.roster || {})) if (p) dansLaLigue.add(getPersonKey(p));
  const salaireMax = salaireMaxDePack();
  return tirerJoueursDuPack(cle, {
    graine: Lg.graine, n, params, mods, garantie, saisons: state.index.seasons, shard: getShard,
    // V9 (tranche 4) : l'offre n'est plus filtrée sous le plafond ; un joueur trop cher se montre, grisé, avec ce qu'il manque.
    libre: p => p.$ > 0 && !dansLaLigue.has(getPersonKey(p)) && !isPicked(p),
  });
}
/*
 * CE QUI CHANGE UN PACK DE JOUEURS : les patrons (js/banque.js `modificateurs`)
 * et, en Rogue, la run (v2) — son PRESTIGE, fixé au départ (les Étoiles et les
 * Phénomènes qu'il ouvre), et son COACH (le style qu'il recrute). Une partie
 * d'avant la v2 n'a ni l'un ni l'autre : ses packs ne bougent pas.
 */
function modsDesPacks(decs, j) {
  const m = modificateurs(decs, j + 1);
  const r = G.bonus === 'ROGUE' && G.rogue ? G.rogue : null;
  if (r && PRESTIGES[r.prestige]) m.prestige = { ...PRESTIGES[r.prestige], rang: r.prestige };
  if (r && COACHS[r.coach]) m.coach = r.coach;
  // V10 : les crans de chaque pack, fixés au départ de la run comme le prestige.
  if (r && r.montee) m.montee = r.montee;
  // Les exigences (tranche 8) : « Les agents » montent le prix des packs.
  if (r && r.exigence) m.rabais *= exigencesDe(r.exigence).prixPacks;
  return m;
}
/* La valeur de vente d'un joueur doublon : sa variante, et son numéro s'il en a un. */
const NUM_VENTE = { '/99': 1, '/25': 2, '/10': 4, '1 de 1': 10 };
const venteJoueur = x => (VENTE[x.rar] || 2) * (NUM_VENTE[x.num] || 1);
/* La carte mini d'un joueur tiré, AVEC la variante du tirage (la carte ne lit que la sienne). */
export function miniAvecVariante(p, rar) {
  const k = getPlayerKey(p), avant = G.variantes.cartes[k];
  G.variantes.cartes[k] = rar;
  try { return carteMiniHtml(p); } finally { if (avant === undefined) delete G.variantes.cartes[k]; else G.variantes.cartes[k] = avant; }
}
/*
 * L'OUVERTURE D'UN PACK DE JOUEURS. Le paquet se déchire (js/gerant.js) ; on
 * en signe UN (« Signer », puis QUI SORT — `choisirQuiSort`), les autres vont
 * au cartable ; un joueur déjà au cartable est un doublon, revendu tout seul.
 * L'achat est une décision, qu'on signe ou non.
 */
async function ouvrirPackJoueurs(cle, prix, params, j, n, decider, de = null) {
  const decs = decisionsDeLaPartie();
  const mods = modsDesPacks(decs, j);
  const pitie = G.bonus === 'ROGUE' && packsSansHolo(decs) >= PITIE;
  const { cartes, reglage } = await tirerPackJoueurs(cle, n, params, mods, pitie);
  // UN DOUBLON, UNE DÉFINITION (V2.1) : un joueur déjà à ton cartable, comme le cartable le compte (repêché, aligné ou tiré).
  const avant = new Set([...(lireMeta().collection || []), ...Object.keys(lireCartable().joueurs)]);
  const vendus = [];
  let vente = 0;
  cartes.forEach((x, t) => { x.doublon = avant.has(getPlayerKey(x.p)); if (x.doublon) { vendus.push(t); vente += venteJoueur(x); } });
  const meilleure = [...EDITIONS].reverse().find(r => cartes.some(x => x.rar === r)) || 'commune';
  // UN PACK MIXTE (Jalon P2) : ses cartes de la banque se tirent avec les joueurs, au même thème (la couleur du coach).
  const tc = PACKS_TOUS[cle].cartes ? cartesTirees(cle, n, reglage) : null;
  // `auCartable` : acheté passé la date limite, rien ne se signe — la boîte ne le réclame pas (Jalon P2).
  const achat = { pack: cle, n, prix, sorte: 'joueurs', params: reglage, meilleure, vente: vente + (tc ? tc.vente : 0), ...(vendus.length ? { vendus } : {}), ...(pitie ? { pitie: true } : {}), ...(de ? { de } : {}), ...(apresDateLimite(j) ? { auCartable: true } : {}),
    ...(tc ? { cartes: tc.ids, ...(tc.vendus.length ? { cartesVendues: tc.vendus } : {}) } : {}) };
  /*
   * L'ACHAT D'ABORD (1.0, J1-B). Avant, le butin entrait au méta (collection,
   * cartable) AVANT que la décision n'enregistre l'achat : recharger la page
   * pendant l'ouverture gardait les cartes sans payer, et le même numéro
   * rejouait le même pack. Maintenant la décision `k:n` (l'achat, le prix)
   * est écrite tout de suite ; la signature est une SECONDE décision,
   * `k:n:signe` — et un achat sans signature rouvre le choix au hub
   * (`rouvrirPackJoueurs`, le même tirage), sans retirer ni repayer.
   */
  decider({ jour: j, palier: `k:${n}`, achat });
  if (tc) rangerCartes(tc, n);
  ajouterCollection({ joueurs: cartes.map(x => getPlayerKey(x.p)) });
  apresLeCartable(ajouterAuCartable(cartes.map(x => ({ cle: getPlayerKey(x.p), rar: x.rar, num: x.num || null }))), cartes);
  offrirPackJoueurs({ cle, cartes, reglage, pitie, vente: achat.vente, n, j, decider, tc, montrerCartes: true });
}
/*
 * LES OFFRES DU RAPPEL (Jalon P3) : les cartes de ton cartable dans l'ordre pur de `graine`, au plus du niveau de la
 * carte jouée, à un salaire qu'un pack offrirait, ni dans la ligue ni déjà chez toi ; leur meilleure variante.
 */
async function offresDuCartable(C, graine) {
  const c = lireCartable(), Lg = G.ligue;
  const dansLaLigue = new Set();
  for (const t of Lg.teams || []) for (const p of Object.values(t.roster || {})) if (p) dansLaLigue.add(getPersonKey(p));
  const max = salaireMaxDePack(), out = [];
  if (C.echange) return offresDEchange(C, graine, c, dansLaLigue, max);
  // `anciens` (P3) : une carte qui a joué une run d'avant celle-ci (`r`, `der` : js/cartable.js `marquerJouees`).
  const run = (G.rogue && G.rogue.numero) || 0;
  const cles = Object.keys(c.joueurs).filter(k => !C.anciens || ((c.joueurs[k].r || 0) > 0 && c.joueurs[k].der !== run));
  for (const cle of tirageDuClasseur(cles, graine)) {
    if (out.length >= C.offres) break;
    const p = await joueurDeCle(cle);
    if (!p || !(p.$ > 0) || p.$ > max || dansLaLigue.has(getPersonKey(p)) || dejaChezToi(p) || out.some(x => getPersonKey(x.p) === getPersonKey(p))) continue;
    const niveau = niveauDe(p, (await getShard(p.s)).players);
    if (niveau > C.niveauMax) continue;
    const x = c.joueurs[cle];
    out.push({ p, rar: meilleureVariante(x), niveau, num: (x.num || [])[0] || null });
  }
  return out;
}
/*
 * APRÈS UNE ENTRÉE AU CARTABLE : les cartes que leurs doublons ont montées (Jalon P3) et les missions de collection
 * accomplies, payées une fois en médailles (Jalon P4), dites d'un seul toast.
 */
function apresLeCartable(montees, cartes) {
  const nom = cle => (cartes.find(x => getPlayerKey(x.p || x) === cle) || { n: 'Ta carte' });
  const mots = montees.map(m => { const x = nom(m.cle); return motDeMontee(m, (x.p || x).n); });
  if (G.bonus === 'ROGUE') {
    const decennies = [...new Set(state.index.seasons.map(decennieDe))];
    for (const x of payerMissions(missionsDuCartable(lireCartable(), decennies))) mots.push(`🏅 Mission « ${x.nom} » : +${x.medailles} médailles`);
  }
  if (mots.length) toast(mots.join(' · '));
}
/* Un achat enregistré sans signature (la page rechargée en plein choix) : le même tirage, à choisir. */
export async function rouvrirPackJoueurs(achat, j, decider) {
  const decs = decisionsDeLaPartie();
  const mods = modsDesPacks(decs, j);
  const { cartes, reglage } = await tirerPackJoueurs(achat.pack, achat.n, achat.params || {}, mods, !!achat.pitie);
  cartes.forEach((x, t) => { x.doublon = (achat.vendus || []).includes(t); });
  const tc = Array.isArray(achat.cartes) ? { ids: achat.cartes, vendus: achat.cartesVendues || [] } : null;
  offrirPackJoueurs({ cle: achat.pack, cartes, reglage, pitie: !!achat.pitie, vente: achat.vente || 0, n: achat.n, j, decider, tc });
}
/* Un joueur tiré d'un pack, en option d'`ouvrirChoix` : sa carte à la variante du tirage, son niveau, sa couleur. */
function optionDeJoueurTire(x) {
  const g = groupeDe(x.p);
  const bonus = traitsDeCarte(carteDe(x.rar), g === 'G');
  return {
    // S80 : à finition égale, son niveau ordonne aussi le retournement (la finition d'abord : une holo Soutien sort après un Phénomène de base ; js/gerant.js).
    cle: getPlayerKey(x.p), rarete: x.rar, rang: x.niveau, eclat: x.niveau === PHENOMENE, nom: x.p.n, type: `${POSTE_GROUPE[g]} · ${x.p.t} ${x.p.s}`, coin: money(x.p.$),
    art: artJoueur({ portraitHtml: headshotHtml(x.p), logoHtml: getTeamLogoHtml(x.p.t, 24), pos: esc(POSTE_GROUPE[g]), saison: esc(x.p.s), club: esc(x.p.t), actionSrc: photoAction(x.p), cadre: cadrePhoto(x.p) }),
    joueurHtml: miniAvecVariante(x.p, x.rar),
    // LE WALKOUT (1.0, oct.) : si c'est la carte du pack, sa saison, son poste et son club s'annoncent avant elle (js/gerant.js).
    walkout: { saison: esc(x.p.s), pos: esc(POSTE_GROUPE[g]), logo: getTeamLogoHtml(x.p.t, 132) },
    // Son NIVEAU en un mot (S80), sauf quand le ruban de la carte le dit déjà.
    texte: [x.doublon ? `Doublon : revendu ${venteJoueur(x)} 🪙 si tu ne le signes pas` : '', niveauHorsRuban(x.p, x.niveau), ligneDuChoix(x.p), x.num ? `Holo numérotée ${x.num}` : '', ...bonus.map(b => `${b.ico} ${b.nom} — ${b.mot}`),
      // v2 : sa couleur — habillé, il porte la confiance de ce coach (`porteParSesJoueurs`).
      COACHS[coachDuJoueur(x.p)] ? `${COACHS[coachDuJoueur(x.p)].ico} Joueur ${COACHS[coachDuJoueur(x.p)].de}` : ''].filter(Boolean).join('\n'),
    // UN DOUBLON SE SIGNE PAREIL (1.0, oct.). JP : *si je pige un doublon, je devrais pouvoir le signer pareil*.
    // Pas signé, il est revendu comme avant ; signé, sa vente s'annule. Déjà dans ton équipe, non : un joueur, une case.
    desactive: dejaChezToi(x.p) ? dejaDansTonEquipe(x) : '',
    apercu: () => apercuJoueur(x.p, x),
  };
}
/* Le même homme est-il déjà dans ton équipe (n'importe quelle saison de lui) ? */
const dejaChezToi = p => Object.values(G.roster || {}).some(q => q && getPersonKey(q) === getPersonKey(p));
/*
 * LE DOUBLON PLUS FORT (oct. 2026). JP : *monter en pigeant un doublon plus fort*. La même carte, dans une édition
 * plus haute que celle qu'il porte : elle entre au cartable (comme toute carte du pack), et c'est elle qu'il portera
 * à la saison suivante de la run (`meilleureVariante`). Rien ne change en pleine saison : la ligue se joue au jour le jour.
 */
function dejaDansTonEquipe(x) {
  const q = Object.values(G.roster || {}).find(y => y && getPlayerKey(y) === getPlayerKey(x.p));
  const a = q ? rareteJoueur(q) : null;
  return a && EDITIONS.indexOf(x.rar) > EDITIONS.indexOf(a) ? `Sa carte monte au cartable : ${NOM_VARIANTE[a]} → ${NOM_VARIANTE[x.rar]}, dès la saison prochaine` : 'Déjà dans ton équipe';
}
/* Le paquet se déchire (js/gerant.js) ; on en signe UN (« Signer », puis QUI SORT — `choisirQuiSort`), ou personne. */
/*
 * EN DEUX TEMPS (Jalon Q). JP : *signer un, et autres cartes jouables quand on veut*. Un pack mixte montre d'abord
 * ses cartes de jeu, rangées (ton personnel, tes outils) ; puis ses joueurs, seuls, à signer. « Plus tard » : la boîte
 * rouvre l'offre sur place, sans les cartes déjà vues.
 */
function offrirPackJoueurs({ cle, cartes, reglage, pitie, vente, n, j, decider, tc = null, montrerCartes = false }) {
  const P = PACKS_TOUS[cle];
  const palier = `k:${n}:signe`;
  // Passé la date limite (Jalon P2), rien ne se signe : tout va au cartable.
  const limite = apresDateLimite(j);
  for (const x of cartes) ballottageVu.set(getPlayerKey(x.p), x.p);
  const titre = `${P.nom}${reglage.franchise ? ` · ${FRANCHISES[reglage.franchise].nom}` : reglage.saison ? ` · ${reglage.saison}` : reglage.club ? ` · ${reglage.club}` : ''}`;
  // LA LISTE DU 82-0 (Jalon R) : les joueurs du pack en rangées, chacun avec sa meilleure case ; « Signer » l'y pose.
  const offrir = () => ouvrirListeSignature({
    ico: P.ico, titre, motFermer: 'Plus tard',
    recit: `${cartes.length} vrais joueurs${pitie ? ' — la garantie a joué : une Or, au moins' : ''}${limite ? '. La date limite est passée : tous vont à ton cartable.' : '. Tu en signes un ; les autres vont à ton cartable.'}${vente ? ` Les doublons se revendent : +${vente} 🪙.` : ''}`,
    joueurs: cartes, roster: G.roster,
    bloque: bloqueParLePlafond,
    desactive: x => (limite ? 'Date limite passée : au cartable' : dejaChezToi(x.p) ? dejaDansTonEquipe(x) : tropCher(x.p)),
    onSigne: (x, sortie) => {
      const k = getPlayerKey(x.p);
      G.variantes.cartes[k] = x.rar;
      if (x.num) (G.variantes.numeros = G.variantes.numeros || {})[k] = x.num;
      decider({ jour: j, palier, ballottage: { i: sortie.i, entre: k, sort: sortie.sort, rar: x.rar, ...(x.num ? { num: x.num } : {}) }, ...(sortie.cases ? { cases: sortie.cases } : {}), ...(x.doublon ? { annuleVente: venteJoueur(x) } : {}) });
    },
    // « Plus tard » : rien ne s'écrit, l'offre attend dans la boîte (`packOuvert`, js/saison.js).
    onFerme: () => {},
  });
  const nc = tc ? tc.ids.length : 0;
  if (!montrerCartes) { offrir(); return; }
  // Le paquet se déchire une fois, sur tout ce qu'il contient ; la signature suit, joueurs seuls.
  ouvrirChoix({
    ico: P.ico, titre, cartes: true, genre: 'recompense', fermable: true, motFermer: limite ? 'Fermer' : 'Signer un joueur', suite: true,
    recit: `${cartes.length} joueurs${nc ? ` et ${nc} carte${nc > 1 ? 's' : ''} de jeu. Le personnel rejoint ta collection ; une carte rare se joue chez ce qu'elle monte` : ''}.${limite ? ' Les joueurs vont à ton cartable.' : ' Ensuite, tu signes un joueur.'}`,
    options: [...cartes.map(x => ({ ...optionDeJoueurTire(x), vue: true })), ...(tc ? optionsDeCartes(tc, 'c').map(o => ({ ...o, vue: true })) : [])],
    onChoix: () => {},
    onFerme: limite ? () => {} : offrir,
  });
}
/*
 * LE PACK D'UNE SÉRIE GAGNÉE (Jalon P1) : tiré de la graine et de la ronde (hors des numéros d'achat), ouvert tout
 * de suite, et TOUT va au cartable : rien ne se signe en pleines séries. Une fois, à la décision (`confirmerDecision`,
 * js/banc.js) ; la Coupe ouvre le sien à la fin des séries (`finDesSeriesRogue`).
 */
export async function ouvrirPackDeSerie(cle, ronde) {
  const P = PACKS_TOUS[cle];
  if (!P || !G.ligue) return;
  const { cartes } = await tirerJoueursDuPack(cle, {
    graine: G.ligue.graine, n: -100 - ronde, mods: modsDesPacks(decisionsDeLaPartie(), G.journee || 0), saisons: state.index.seasons, shard: getShard,
  });
  ajouterCollection({ joueurs: cartes.map(x => getPlayerKey(x.p)) });
  apresLeCartable(ajouterAuCartable(cartes.map(x => ({ cle: getPlayerKey(x.p), rar: x.rar, num: x.num || null }))), cartes);
  ouvrirChoix({
    ico: P.ico, titre: P.nom, cartes: true, genre: 'recompense', fermable: true, motFermer: 'Au cartable',
    recit: `${cartes.length} vrais joueurs, tous à ton cartable : pour la saison prochaine et les runs d'après.`,
    options: cartes.map(x => ({ ...optionDeJoueurTire(x), desactive: 'Au cartable' })),
    onChoix: () => {},
    onFerme: () => {},
  });
}
/*
 * UNE SORTIE QUE LE PLAFOND REFUSE : l'arrivée de `p` à la place de `q`
 * laisserait la masse au-dessus du plafond, et plus haut qu'avant. Rend la
 * raison, ou ''. Un échange qui fait baisser la masse passe toujours.
 */
export function bloqueParLePlafond(p, q) {
  const pl = G.ligue ? plafondEffectif() : null;
  // `q` absent : une case de réserve libre (S80) — personne ne sort, rien ne se libère.
  const libere = !q ? 0 : pl ? capHit(q, pl) : (q.$ || 0);
  if ((p.$ || 0) <= libere) return '';
  const reste = capLeft() + libere - (p.$ || 0);
  return reste < 0 ? `Plafond : il manque ${money(-reste)}` : '';
}
/* Une carte de la banque en option d'`ouvrirChoix` (l'ouverture d'un pack de cartes). */
/*
 * L'OUVERTURE D'UN PACK DE CARTES : tout va dans l'inventaire. En Rogue, le
 * personnel et les consommables permanents partent au MÉTA (gardés d'une run
 * à l'autre) — une fois, par achat (`recevoirPermanents`) ; un patron qu'on
 * possède déjà est un doublon, revendu. Une carte rare (V16, § 4d) se joue chez ce qu'elle monte.
 */
/* Les cartes tirées d'un pack (le Pack Personnel, ou un pack de joueurs) : les rangées, et les patrons doublons revendus. */
function cartesTirees(cle, n, params) {
  const ids = tirerCartesDuPack(cle, G.ligue.graine, n, params);
  const meta = lireMeta();
  const vendus = [], doublons = [];
  const copies = {};
  let vente = 0;
  ids.forEach((id, t) => {
    const c = BANQUE[id];
    if (c.cat !== 'patron' || G.bonus !== 'ROGUE') return;
    // V14 : une carte du personnel déjà à toi ouvre un échelon de plus (`COPIES_MAX` copies) ; au-delà, elle se revend.
    copies[c.cle] = (copies[c.cle] ?? copiesDe(meta, c.cle)) + 1;
    if (copies[c.cle] === 1) return;
    if (copies[c.cle] <= COPIES_MAX) doublons.push({ t, ouverts: ouvertsDe(copies[c.cle]) });
    else { vendus.push(t); vente += valeurDe(id); }
  });
  return { ids, vendus, vente, doublons };
}
/* Une fois l'achat écrit : le personnel au méta, les cartes à la collection. */
function rangerCartes({ ids, vendus }, n) {
  if (G.bonus === 'ROGUE') recevoirPermanents(ids.filter((id, t) => !vendus.includes(t) && BANQUE[id].vie === 'permanent'), `${G.ligue.graine}:k:${n}`);
  ajouterCollection({ cartes: ids });
}
/* Les cartes d'un pack en options d'`ouvrirChoix` : ce qui se revend. */
const optionsDeCartes = ({ ids, vendus, doublons = [] }, pre = '') => [
  ...ids.map((id, t) => { const d = doublons.find(x => x.t === t);
    return { ...optionDeBanque(id), cle: `${pre}${t}`, prix: vendus.includes(t) ? `Doublon : revendu ${valeurDe(id)} 🪙` : d ? `Doublon : il ouvre son échelon ${d.ouverts}` : '' }; })];
function ouvrirPackCartes(cle, prix, j, n, decider, params = {}, de = null) {
  const P = PACKS_TOUS[cle], Lg = G.ligue;
  const tc = cartesTirees(cle, n, params);
  const { ids, vendus, vente } = tc;
  const rogue = G.bonus === 'ROGUE';
  const achat = { pack: cle, n, prix, sorte: 'cartes', cartes: ids, ...(P.choix === 'coach' ? { params: { coach: coachDuPack(Lg.graine, n, params) } } : {}), ...(vendus.length ? { vendus, vente } : {}), ...(de ? { de } : {}) };
  // 1.0 (J1-B) : l'achat est une décision AVANT que le butin n'entre au méta — recharger la page ne donne plus les cartes gratis.
  decider({ jour: j, palier: `k:${n}`, achat });
  rangerCartes(tc, n);
  ouvrirChoix({
    ico: P.ico, titre: P.nom, cartes: true, genre: 'recompense', fermable: true, motFermer: 'Ranger',
    recit: (rogue
      ? `Le personnel reste d'une run à l'autre.${vente ? ` Doublons revendus : +${vente} 🪙.` : ''}`
      : 'Le personnel va à son poste.'),
    options: optionsDeCartes(tc),
    onChoix: () => {},
    onFerme: () => {},
  });
}

/*
 * QUI EST À L'INFIRMERIE À LA JOURNÉE `j` : lu dans le journal des blessures
 * (le match où il s'est blessé, combien il en rate) et le nombre de tes
 * matchs joués avant ce jour — jamais dans l'infirmerie de fin de saison.
 */
export function blessesAuJour(j) {
  const Lg = G.ligue, you = Lg && Lg.you;
  if (!you) return [];
  let joues = 0;
  for (const jour of (Lg.calendrier || []).slice(0, j)) for (const m of jour) if (m.A === you || m.B === you) joues++;
  return (you.injuriesLog || []).filter(b => b.at <= joues && joues < b.at - 1 + b.games)
    .map(b => ({ p: b.player, reste: b.at - 1 + b.games - joues }));
}

/*
 * L'INVENTAIRE (S79, js/inventaire.js), du hub ou du menu. `decider` absent
 * (le menu, hors saison) : on regarde, on ne joue pas.
 */
export function ouvrirInventaireJeu(j = null, decider = null, page = null) {
  const Lg = G.ligue, decs = decisionsDeLaPartie();
  const rogue = G.bonus === 'ROGUE';
  const meta = lireMeta();
  const enSaison = !!(Lg && decider && j !== null);
  const possedees = new Set((meta.cartes || []).filter(k => BANQUE[k]));
  ouvrirInventaire({
    ...(page || {}),
    titre: 'Tes cartes', mode: rogue ? 'rogue' : 'saison', enSaison, peutJouer: enSaison, jetons: enSaison ? jetonsRogue(j) : null,
    // V12-3 : une carte qui a sa maison (le coaching, la santé, le plafond) s'y joue (`cartesDeLaMaison`), plus ici.
    meta: rogue ? Object.entries(meta.inventaire || {}).map(([id, n]) => ({ id, n })).filter(x => BANQUE[x.id] && x.n > 0 && !maisonDeLaCarte(x.id)) : [],
    possedees, joueursCollection: Object.keys(lireCartable().joueurs).length,
    // En Rogue, la masse salariale est chez le proprio (V12-3), avec les cartes de contrat.
    plafond: rogue ? null : plafondPourInventaire(enSaison ? j : (G.journee || 0)),
    jouer: item => jouerCarte(item, j, decider, page),
  });
}
/* Le plafond, pour l'inventaire : la masse, le plafond effectif, et ce qui le tord (nommé). */
function plafondPourInventaire(j) {
  const pl = plafondEffectif(j);
  if (pl.cap >= 1e11 || !signes().length) return null;
  const nom = k => (signes().find(p => getPlayerKey(p) === k) || {}).n || 'Un ancien';
  return {
    cap: pl.cap, base: pl.base, masse: capUsed(G.ligue ? pl : null),
    lignes: [...pl.lignes.map(l => ({ nom: l.nom, montant: l.montant })),
      ...[...pl.facteurs].map(([k, f]) => ({ nom: `${nom(k)} : ${Math.round(f * 100)} % de son salaire`, joueur: true })),
      ...[...pl.ltir].map(k => ({ nom: `${nom(k)} : blessé à long terme${pl.blesses.has(k) ? ', hors du plafond' : ', revenu au jeu'}`, joueur: true }))],
  };
}
/*
 * CE QUE LE PROPRIO LIT LE LUNDI (V16, tranche 6 — js/dossiers.js `laMasse`, `laTete`). L'espace sous ton plafond et ton
 * contrat le plus lourd que rien ne retouche encore ; ton coach en poste et ceux que le prestige ouvre.
 */
export function masseDuLundi(j) {
  const pl = plafondEffectif(j);
  if (pl.cap >= 1e11 || !signes().length) return null;
  const lourd = signes().filter(p => !pl.facteurs.has(getPlayerKey(p))).sort((a, b) => capHit(b, pl) - capHit(a, pl))[0];
  const espace = pl.cap - capUsed(pl);
  return { espace, libre: money(Math.max(0, espace)), lourd: lourd ? { n: lourd.n, cle: getPlayerKey(lourd), sal: money(capHit(lourd, pl)), dollars: capHit(lourd, pl) } : null };
}
export function coachsDuLundi(j) {
  const [actif] = coachsActifs(decisionsDeLaPartie(), j + 1);
  const de = k => ({ cle: k, nom: COACHS[k].nom, ico: COACHS[k].ico });
  return { actuel: actif && COACHS[actif.cle] ? de(actif.cle) : null,
    autres: coachsOuverts((G.rogue && G.rogue.prestige) || 0).filter(k => COACHS[k] && (!actif || k !== actif.cle)).map(de) };
}
/*
 * JOUER UNE CARTE DE L'INVENTAIRE : sa cible (un joueur, un blessé, une
 * malédiction du deck, une carte à améliorer), puis UNE décision
 * datée d'aujourd'hui (`joue` dit d'où elle sort, pour la partie). Un
 * consommable permanent quitte le méta à ce moment-là.
 */
function jouerCarte(item, j, decider, page = null, auRetour = null) {
  const c = BANQUE[item.id];
  if (!c || !decider) return;
  const Lg = G.ligue, decs = decisionsDeLaPartie(), you = Lg.you;
  const joue = { src: item.src, id: item.id, ...(item.ref ? { ref: item.ref } : {}) };
  // v2 : une carte de coach grandit avec les cartes de son coach déjà jouées (js/banque.js `grandi`).
  const build = buildDe(decs, j + 1), joueurs = joueursDesCoachs(you);
  // « Retour » revient dans la page d'où l'on venait (« Tes cartes ») ; sans elle, l'inventaire flottait par-dessus le Marché.
  const retour = auRetour || (() => ouvrirInventaireJeu(j, decider, page && page.dans && page.dans.isConnected ? page : null));
  const ecrire = payload => {
    if (!payload) return;
    if (item.src === 'meta') retirerDuMeta(item.id);
    // V8 (la run du 14 oct. : *rien ne confirme qu'une carte a été jouée*) : on le dit.
    toast(`${c.ico} ${c.nom} : jouée.`);
    decider({ jour: j, joue, ...payload });
  };
  // Jalon U : les rangées du vestiaire, comme toute liste de joueurs (`ouvrirListeJoueurs`).
  // Rien à prendre (Jalon U) : la liste s'ouvre quand même et le dit (`vide`) ; les toasts restent aux confirmations.
  const listeJoueurs = (titre, recit, liste, choisir, mots = null, vide = '') => ouvrirListeJoueurs({
    ico: c.ico, titre, motFermer: 'Retour', recit, motBouton: 'Choisir', vide,
    contexte: mots ? `${etiquetteBanque(item.id) ? `<span class="choix-forme">${esc(etiquetteBanque(item.id))}</span>` : ''}<div class="choix-puces">${pucesEnBref(mots)}</div>` : '',
    joueurs: liste, onChoix: choisir, onFerme: retour,
  });
  if (c.cat === 'patron') {
    const actifs = patronsActifs(decs, j + 1), postes = postesDePatron((G.rogue && G.rogue.prestige) || 0);
    if (!actifs.some(x => x.role === c.role) && actifs.length >= postes) {
      ouvrirChoix({ ico: '👔', titre: `${c.nom} : qui part ?`, compact: true, fermable: true, motFermer: 'Retour',
        recit: `${postes} postes au plus (le prestige en ouvre d'autres). ${c.nom} prend la place de qui ?`,
        options: actifs.map(x => ({ cle: x.cle, ico: x.ico, nom: x.nom, sous: ROLES[x.role] ? ROLES[x.role].nom : '' })),
        onChoix: k => { const p = payloadDe(item.id, { patrons: actifs, build, joueurs }); p.patron.remplace = [...(p.patron.remplace || []), k]; ecrire(p); },
        onFerme: retour });
      return;
    }
    /*
     * SON POSTE EST PRIS (oct.) : l'engager renvoie celui qui l'occupe, et ses échelons avec lui — un toucher jetait un
     * échelon 4 et les jetons payés pour lui. On le demande, et on dit ce qui part.
     */
    const occupe = actifs.find(x => x.role === c.role && x.cle !== c.cle);
    if (occupe) {
      const ech = occupe.echelon || 1;
      ouvrirChoix({ ico: '👔', titre: `${c.nom} : à la place de ${occupe.nom} ?`, compact: true, fermable: true, motFermer: 'Retour',
        recit: `Un seul ${ROLES[c.role] ? ROLES[c.role].nom.toLowerCase() : 'adjoint'} à la fois. ${occupe.nom} part${ech > 1 ? `, et ses ${ech - 1} échelon${ech > 2 ? 's' : ''} pris avec lui` : ''}.`,
        options: [{ cle: 'oui', ico: c.ico, nom: `Engager ${c.nom}`, sous: `${occupe.nom} part` }],
        onChoix: () => ecrire(payloadDe(item.id, { patrons: actifs, build, joueurs })),
        onFerme: retour });
      return;
    }
    ecrire(payloadDe(item.id, { patrons: actifs, build, joueurs }));
    return;
  }
  // S80 : une modif de joueur se pose AU VERSO, choisie dans l'alignement.
  if (c.cat === 'joueur') { poserUneModif(item, j, payload => ecrire(payload), retour); return; }
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    if (C.cible === 'blesse') {
      const bl = blessesAuJour(j);
      // Ce que le soin lui fait, en premier : ses matchs d'infirmerie avant → après (oct. 2026, « si je boost, je le vois »).
      const soin = (C.gestes && C.gestes.soin) || 0;
      listeJoueurs(`${c.nom} : qui soigner ?`, c.texte, bl.map(x => ({ p: x.p, sous: [ouJoue(x.p), `${x.reste} match${x.reste > 1 ? 's' : ''} d'infirmerie`].filter(Boolean).join(' · '),
        ...(soin ? { sousHtml: `<span class="dest-jambes">Infirmerie <b>${x.reste}</b> → <b>${Math.max(0, x.reste - soin)}</b> match${Math.max(0, x.reste - soin) > 1 ? 's' : ''}</span>${ouJoue(x.p) ? ` · ${esc(ouJoue(x.p))}` : ''}` } : {}) })), k => ecrire(payloadDe(item.id, { joueur: k })), reglesDe(item.id),
        'Personne à l\'infirmerie : garde-la pour plus tard.');
      return;
    }
    if (C.cible === 'joueur') {
      // S80 : il se nomme par ce qu'il est, et on dit où il joue — pas « 1re paire · DG ».
      let liste = SLOTS.filter(sl => !sl.scratch && sl.group !== 'G').map(sl => ({ p: G.roster[sl.i], ligne: ligneDe(sl), sous: G.roster[sl.i] ? `${quiEst(G.roster[sl.i], { stats: false })} · ${ligneDe(sl)}` : '' })).filter(x => x.p);
      // JP (oct. 2026) : *si je boost ses jambes, je dois les voir*. Ses jambes ce matin et ce que la carte en fait,
      // en premier, les plus fatigués en haut ; son rôle est déjà dit sur la rangée, reste où il joue.
      const plus = C.gestes && C.gestes.energie;
      if (plus) {
        const matin = ((you.jourLignes || [])[j] || {}).energie || {};
        const jambes = p => Math.round(matin[getPlayerKey(p)] ?? 100);
        liste = liste.map(x => ({ ...x, sousHtml: `<span class="dest-jambes">Jambes <b>${jambes(x.p)}</b> → <b>${Math.min(100, jambes(x.p) + plus)}</b></span> · ${esc(x.ligne)}` }))
          .sort((a, b) => jambes(a.p) - jambes(b.p));
      }
      listeJoueurs(`${c.nom} : pour qui ?`, c.texte, liste, k => ecrire(payloadDe(item.id, { joueur: k })), reglesDe(item.id));
      return;
    }
    if (C.cible === 'cartable') {
      // LE RAPPEL DU CLUB-ÉCOLE (Jalon P3) : trois cartes de ton cartable, et on signe comme d'un pack.
      sousVoile('On appelle la ferme…', () => offresDuCartable(C, `${Lg.graine}:rappel:${item.ref || item.id}:${j}`)).then(offres => {
        // La liste du 82-0 (Jalon R) : chacun avec sa meilleure case ; « Signer » l'y pose.
        const don = offres[0] && offres[0].donne ? ` Il part : ${offres[0].donneNom}, série ${SERIES[serieDe(offres[0].saison)].nom} (${offres[0].saison}).` : '';
        ouvrirListeSignature({ ico: c.ico, titre: c.nom, motFermer: 'Retour', recit: `${c.texte}${don}`, joueurs: offres, roster: G.roster, bloque: bloqueParLePlafond,
          vide: C.echange ? 'Aucun doublon à échanger, ou personne de sa série sous le plafond.' : C.anciens ? `Aucun ancien de tes runs d'avant, ${NIVEAUX[C.niveauMax].nom} au plus, ne tient sous le plafond.` : `Aucune carte de ton cartable, ${NIVEAUX[C.niveauMax].nom} au plus, ne tient sous le plafond.`,
          desactive: x => (dejaChezToi(x.p) ? 'Déjà dans ton équipe' : ''),
          onSigne: (x, sortie) => { const k = getPlayerKey(x.p); G.variantes.cartes[k] = x.rar; if (x.donne) { donnerUnDoublon(x.donne); ajouterAuCartable([{ cle: k, rar: x.rar }]); } ecrire(payloadDe(item.id, { joueur: k, sortie, rar: x.rar })); },
          onFerme: retour });
      });
      return;
    }
    if (C.cible === 'coach') {
      // LE STAGE DU COACH (V16, tranche 6) : le coach en poste reçoit les points qui lui manquent pour son cran suivant.
      const [actif] = coachsActifs(decs, j + 1);
      const n = actif ? buildDe(decs, j + 1, { tenus: tenusDe(Lg.calendrier, Lg.you) })[actif.cle] : 0;
      const seuil = actif ? SEUILS.find(x => x > n) : null;
      if (!actif || seuil == null) { toast(actif ? 'Ton coach est déjà à sa confiance III.' : 'Aucun coach en poste.', 'bad'); retour(); return; }
      ecrire(payloadDe(item.id, { coach: actif.cle, points: seuil - n }));
      return;
    }
    if (C.cible === 'adjoint') {
      // LA FORMATION (V16, tranche 6) : un adjoint de ta collection, une copie de plus — un échelon de plus ouvert.
      const meta = lireMeta();
      const liste = (meta.personnel || []).filter(k => PATRONS[k] && copiesDe(meta, k) < COPIES_MAX);
      if (!liste.length) { toast('Tous tes adjoints ont leurs trois échelons ouverts.', 'bad'); retour(); return; }
      ouvrirChoix({ ico: c.ico, titre: `${c.nom} : pour qui ?`, compact: true, fermable: true, motFermer: 'Retour', recit: c.texte,
        options: liste.map(k => ({ cle: k, ico: PATRONS[k].ico, nom: PATRONS[k].nom, sous: `${ROLES[PATRONS[k].role].nom} · échelons ouverts ${ouvertsDe(copiesDe(meta, k))} → ${ouvertsDe(copiesDe(meta, k) + 1)}` })),
        onChoix: k => { recevoirPermanents([`patron:${k}`], `formation:${Lg.graine}:${j}:${item.ref || item.id}`); ecrire(payloadDe(item.id, { adjoint: k })); }, onFerme: retour });
      return;
    }
    ecrire(payloadDe(item.id, { alea: hache(Lg.graine, 'billet', item.ref || item.id, j), build, joueurs }));
    return;
  }
  ecrire(payloadDe(item.id, { build, joueurs }));
}
/*
 * JOUER UNE MODIF DE JOUEUR (S80 ; Jalon U). JP : *jouer les cartes du menu Cartes, trop d'étapes*. « Jouer » ouvre
 * l'alignement en rangées (`ouvrirAlignement`) : chaque joueur dit ce que la carte lui ferait, ou pourquoi elle ne
 * peut pas aller sur lui (un gardien, ses cases pleines, aucun malus à effacer…). « Poser » décide tout de suite —
 * la même décision `{ joue, mutation }` que le verso écrivait ; toucher la rangée ouvre sa fiche, pour lire.
 * Avant, « Jouer » → l'alignement → la fiche au verso → « Poser ici » : deux fenêtres de trop.
 */
function poserUneModif(item, j, decider, retour) {
  const c = BANQUE[item.id], M = MUTATIONS[c.cle];
  const you = G.ligue && G.ligue.you;
  const etats = new Map();
  const rangees = rangeesAlignement(G.roster, (sl, q) => { const e = etatPourPoser(c.cle, q, sl, { jour: j, you }); etats.set(String(sl.i), e); return { non: e.non || '', note: e.note || '' }; });
  /*
   * LA CIBLE SUGGÉRÉE EN TÊTE (V8, la run du 14 oct. : la carte disait « sur Clark Gillies » et la liste ouvrait sur
   * Gainey ; une rare a fini sur le mauvais joueur). Le joueur que les chiffres de la carte lisent passe en premier, cerclé.
   */
  const vise = you ? joueurDeMutation(you, null, c.cle) : null;
  const suggeree = vise && rangees.flatMap(r => r.cases).find(x => x.p && !x.non && getPlayerKey(x.p) === getPlayerKey(vise));
  if (suggeree) rangees.unshift({ titre: 'La cible suggérée', cases: [{ ...suggeree, meilleure: true }] });
  ouvrirAlignement({
    ico: M.ico, titre: `${M.nom} : sur qui ?`, motFermer: 'Retour', motConfirmer: 'Poser', fiche: apercuJoueur,
    contexte: `<div class="choix-puces">${pucesEnBref(motsDeMutationEnChiffres(c.cle))}</div>`,
    rangees,
    onChoix: k => {
      const q = G.roster[Number(k)], e = etats.get(k) || {};
      if (!q || e.non) return;
      toast(`${M.ico} ${M.nom} : posée sur ${q.n}.`);
      decider({ jour: j, joue: { src: item.src, id: item.id, ...(item.ref ? { ref: item.ref } : {}) }, mutation: { cle: c.cle, joueur: getPlayerKey(q), ...(e.extra || {}) } });
    },
    onFerme: retour,
  });
}
/*
 * TON PERSONNEL (V12-2, puis V14 — js/echelons.js). JP : *le personnel, des cartes qui gagnent des niveaux, avec leurs
 * forces et leurs faiblesses, un look de jeu de gestion* ; *ça peut être des cartes selon leur style*. Chaque poste : sa
 * carte (son style), son poste et son moment, sa force en vert et son défaut en rouge (en vraies stats, à son échelon),
 * ses échelons (les ouverts, les fermés) et son contrat. Une rangée s'ouvre en feuille : le détail, et le choix d'un
 * échelon atteint.
 */
const etatPersonnel = j => (G.ligue ? etatDuPersonnel(decisionsDeLaPartie(), j + 1, {
  joues: (de, a) => matchsJoues(G.ligue.calendrier, G.ligue.you, de, a), copies: k => copiesDe(lireMeta(), k) }) : []);
const CANAUX_PERSONNEL = ['finition', 'volume', 'lancers', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
/*
 * Sa force et son défaut en mots, à son échelon. UN ADJOINT À PROTÉGÉ (oct.) : ce qu'il donne à son joueur est sa force
 * (`protegeALEchelon`) ; sans elle, le monteur vidéo (la précision ×2 de ta meilleure gâchette) ne lisait que son défaut.
 * UNE SEULE LECTURE (oct., JP : *ça a aucun sens*) : la force et le défaut se lisaient chacun à part dans le moteur, et le
 * défaut (moins de tirs) rendait un « +0,2 pt de précision » vert sous sa ligne rouge, à côté du « +1,5 pt » de la force.
 * Le moteur joue les deux ensemble : une lecture, le vert d'un côté, le rouge de l'autre, le reste (la glace, les
 * punitions) à part. Ses chiffres se disent par soir quand il a un moment, jamais « par match ».
 */
function motsDeLaPersonne(p) {
  const canaux = Object.fromEntries(Object.entries(p).filter(([k]) => CANAUX_PERSONNEL.includes(k)));
  const lui = PROTEGES[p.cle] ? motsSurLeJoueur(protegeALEchelon(p.cle, p.choix || []), 'Son protégé') : [];
  const lus = Object.keys(canaux).length ? motsEnChiffres(canaux, null, p.si ? { par: 'par soir' } : null) : [];
  return { force: [...lui.filter(m => m.bon), ...lus.filter(m => m.bon === true), ...motsDeLEcon(p.econ)],
    faiblesse: [...lui.filter(m => !m.bon), ...lus.filter(m => m.bon === false)], autres: lus.filter(m => m.bon == null) };
}
/*
 * Les options d'un échelon atteint : pousser sa force, corriger son défaut (s'il en a un). V14b : chacune coûte le prix
 * de l'échelon (`PRIX_ECHELON`), et se grise sans les jetons en caisse.
 */
function optionsDEchelon(e, caisse, coach = null) {
  // Un adjoint d'une autre couleur que ton coach promet ce que le moteur jouera (`assortiPour`), pas ses chiffres pleins.
  const apres = c => motsDeLaPersonne(assortiPour(coach, patronALEchelon(e.cle, { choix: [...(e.patron.choix || []), c] })));
  const prix = e.prix ? [{ txt: `−${e.prix} 🪙`, bon: false }] : [];
  const non = e.prix > caisse ? 'Pas assez de jetons en caisse' : null;
  return [
    { cle: 'force', ico: '⬆', nom: 'Pousser sa force', sous: 'Ce qu\'il fait de mieux, en plus fort', mots: [...prix, ...apres('force').force], desactive: non },
    ...(aUnDefaut(e.cle) ? [{ cle: 'defaut', ico: '🩹', nom: 'Corriger son défaut', sous: 'Sa force reste ; son prix baisse', mots: [...prix, ...apres('defaut').faiblesse], desactive: non }] : []),
  ];
}
/* Ce qui attend un choix d'échelon, dans la fiche de sa carte : ses options, et la décision. */
const coachEnPoste = j => { const [c] = coachsActifs(decisionsDeLaPartie(), j + 1); return c ? c.cle : null; };
function echelonsAChoisir(j) {
  // La saison jouée ne prend plus de décision : l'échelon attend la saison suivante, où ses matchs à ton service le suivent.
  if (!G.ligue || G.ligue.fini) return [];
  return etatPersonnel(j).filter(e => e.aChoisir).map(e => ({ cle: e.cle, qui: e.qui, ico: e.patron.ico, style: e.patron.nom, echelon: e.echelon,
    service: e.service, prix: e.prix, defaut: aUnDefaut(e.cle), options: optionsDEchelon(e, jetonsRogue(j), coachEnPoste(j)),
    decision: c => ({ palier: `ech:${e.cle}:${e.echelon + 1}`, ...decisionDEchelon(e, c) }) }));
}
/* Les contrats qui finissent bientôt (V19) : ≤ 6 matchs à faire, et de quoi les prolonger ; la nouvelle d'Hier soir les dit une fois. */
export function contratsQuiFinissent(j) {
  return etatPersonnel(j).filter(e => e.prolongeable && matchsJoues(G.ligue.calendrier, G.ligue.you, j + 1, e.fin) <= 6)
    .map(e => ({ cle: e.cle, fin: e.fin, ico: e.patron.ico, nom: e.qui, restant: matchsJoues(G.ligue.calendrier, G.ligue.you, j + 1, e.fin), prix: e.prixProlongation }));
}
/* Ce que lisent la rangée d'un adjoint et sa feuille : le coach en poste, les adjoints, leur état à la journée `j`. */
function lectureDuPersonnel(j) {
  const decs = decisionsDeLaPartie();
  const [coach] = coachsActifs(decs, j + 1);
  return { coach, pa: patronsActifs(decs, j + 1), etats: new Map(etatPersonnel(j).map(e => [e.cle, e])), aChoisir: new Set(echelonsAChoisir(j).map(e => e.cle)) };
}
/* Son moment, et combien de soirs il revient (JP : *c'est useless, c'est juste contre rivaux* — qu'on le sache avant d'engager). */
const quandJoue = P => (P.si && MOMENTS_SI[P.si] ? `${MOMENTS_SI[P.si].mot} · ≈ ${MOMENTS_SI[P.si].parSaison} soirs par saison` : 'Toute la saison');
/* Le contrat (V19) : les matchs qu'il lui reste, et la prolongation qui l'étend (en jetons). */
const matchsDeContrat = (e, j) => matchsJoues(G.ligue.calendrier, G.ligue.you, j + 1, e.fin);
/*
 * LA FEUILLE D'UN ADJOINT (JP, 28 oct. : *j'hais les accordéons*) : toucher sa rangée l'ouvre, au lieu de la déplier sur
 * place. Le détail (son texte, sa force en vert et son défaut en rouge, son protégé, son contrat) et ses choix — un échelon
 * atteint, la prolongation — comme des options ; la décision passe par `jouerDeLaMaison`, le même chemin qu'avant.
 */
function ouvrirLAdjoint(cle) {
  const hub = hubActif();
  if (!hub || !hub.decider || !G.ligue) return;
  const j = hub.jour ? hub.jour() : (G.journee || 0);
  const { coach, pa, etats, aChoisir } = lectureDuPersonnel(j);
  const x = pa.find(q => q.cle === cle), e = etats.get(cle);
  if (!x || !e) return;
  const R = ROLES[x.role] || {}, P = PATRONS[cle] || {};
  const vu = assortiPour(coach && coach.cle, x), contre = vu !== x;
  const { force, faiblesse, autres } = motsDeLaPersonne(vu);
  const suite = aChoisir.has(cle) ? '' : e.prochain === null ? 'Au sommet de son métier.'
    : e.ferme ? `Prêt pour l'échelon ${e.echelon + 1} : un doublon tiré d'un pack l'ouvre.`
    : `${e.service} / ${e.prochain} matchs à ton service${e.double ? ' · de la couleur de ton coach : deux fois plus vite' : ''}.`;
  const restant = matchsDeContrat(e, j), peutPayer = jetonsRogue(j) >= e.prixProlongation;
  const contrat = e.prolongeable ? `Contrat : encore ≈ ${restant} match${restant > 1 ? 's' : ''}, puis il part.` : 'Contrat : jusqu\'à la fin de la saison.';
  const faits = (x.choix || []).map((c, i) => `Échelon ${i + 2} : ${c === 'force' ? 'sa force poussée' : 'son défaut corrigé'}`).join(' · ');
  // Son protégé, nommé : le joueur que ses chiffres visent (le feu vise des lignes, pas un joueur).
  const M = PROTEGES[cle];
  const lui = M && !M.portee ? joueurDeMutation(G.ligue.you, null, cle) : null;
  const lignes = M && M.portee ? lignesDuFeu(cle, x.choix || []) : 0;
  const protege = lui ? `Son protégé : ${lui.n}.` : lignes ? (lignes > 1 ? 'Il vise tes deux premières lignes.' : 'Il vise ta première ligne.') : '';
  const options = [
    ...(aChoisir.has(cle) ? optionsDEchelon(e, jetonsRogue(j), coach && coach.cle).map(o => ({ ...o, cle: `echelon:${o.cle}` })) : []),
    ...(e.prolongeable ? [{ cle: 'contrat', ico: '📝', nom: 'Prolonger', sous: contrat, mots: [{ txt: `−${e.prixProlongation} 🪙`, bon: false }], desactive: peutPayer ? null : 'Pas assez de jetons en caisse' }] : []),
  ];
  const decider = d => { const h = hubActif(); if (h && h.decider) h.decider(d); };
  ouvrirChoix({ ico: x.ico || P.ico || '👔', titre: e.qui, recit: `${R.nom || ''} · ${quandJoue(P)}`, compact: true, fermable: true, motFermer: 'Retour', vide: 'Rien à décider pour lui.',
    contexte: `<div class="gens-fiche">
      ${P.texte ? `<p class="perso-libre"><em>${esc(P.texte)}</em></p>` : ''}
      ${contre ? `<p class="perso-libre">Pas de la couleur de ${esc(COACHS[coach.cle].nom)} : il joue à contre-courant, ses chiffres le disent.</p>` : ''}
      ${force.length ? `<div class="choix-puces">${pucesEnBref(force)}</div>` : ''}
      ${faiblesse.length ? `<div class="choix-puces">${pucesEnBref(faiblesse)}</div>` : ''}
      ${autres.length ? `<div class="choix-puces">${pucesEnBref(autres)}</div>` : ''}
      ${protege ? `<p class="perso-libre">${esc(protege)}</p>` : ''}
      ${suite ? `<p class="perso-libre">${esc(suite)}</p>` : ''}${e.prolongeable ? '' : `<p class="perso-libre">${esc(contrat)}</p>`}${faits ? `<p class="perso-libre">${esc(faits)}</p>` : ''}
    </div>`,
    options,
    onChoix: k => {
      if (k === 'contrat') jouerDeLaMaison({ src: 'contrat', id: `contrat:${cle}` }, j, decider);
      else if (k.startsWith('echelon:')) jouerDeLaMaison({ src: 'echelon', id: `echelon:${cle}:${k.slice(8)}` }, j, decider);
    } });
}
// Une rangée du personnel se touche : sa feuille s'ouvre (le volet de l'entraîneur est réécrit à chaque décision, d'où l'écoute au document).
if (typeof document !== 'undefined') document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('.gens-l[data-gens]'); if (b) ouvrirLAdjoint(b.dataset.gens); });
export function personnelDuJour(j) {
  const max = postesDePatron((G.rogue && G.rogue.prestige) || 0);
  // V16 (tranche 5b) : un adjoint d'une autre couleur que ton coach se lit tel que le moteur le joue (`assortiPour`).
  const { coach, pa, etats, aChoisir } = lectureDuPersonnel(j);
  const libres = Math.max(0, max - pa.length);
  const echelons = e => `<span class="gens-ech" aria-label="Échelon ${e.echelon} sur ${ECHELON_MAX}, ${e.ouverts} ouverts">${Array.from({ length: ECHELON_MAX }, (_, i) => `<i class="${i < e.echelon ? 'on' : i < e.ouverts ? '' : 'ferme'}"></i>`).join('')}</span>`;
  // UNE RANGÉE PAR ADJOINT, toujours visible : son style, sa force et son défaut, son échelon et son contrat ; la toucher ouvre sa feuille.
  const ligne = x => {
    const R = ROLES[x.role] || {}, P = PATRONS[x.cle] || {}, e = etats.get(x.cle);
    if (!e) return `<div class="perso-l"><span class="perso-ico" aria-hidden="true">${x.ico || P.ico || ''}</span><span class="perso-txt"><small>${esc(R.nom || '')}</small><b>${esc(x.nom || P.nom || '')}</b></span></div>`;
    const { force, faiblesse, autres } = motsDeLaPersonne(assortiPour(coach && coach.cle, x));
    const restant = matchsDeContrat(e, j);
    return `<button type="button" class="gens gens-l${aChoisir.has(e.cle) ? ' monte' : ''}" data-gens="${esc(e.cle)}">
        <span class="gens-av" aria-hidden="true">${x.ico || P.ico || ''}<span>${R.ico || ''}</span></span>
        <span class="gens-txt"><b>${esc(e.qui)}</b><small>${esc(R.nom || '')} · ${esc(quandJoue(P))}</small>
          <span class="gens-ff">${force[0] ? `<span class="bon">${esc(force[0].txt)}</span>` : autres[0] ? `<span>${esc(autres[0].txt)}</span>` : ''}${faiblesse[0] ? `<span class="mal">${esc(faiblesse[0].txt)}</span>` : ''}</span></span>
        <span class="gens-niv">${aChoisir.has(e.cle) ? `<span class="gens-monte">Prêt · ${e.prix} 🪙</span>` : `<span>Éch. ${e.echelon}</span>`}${echelons(e)}<span class="gens-ct">${e.prolongeable ? `≈ ${restant} match${restant > 1 ? 's' : ''}` : 'Saison'}</span></span>
      </button>`;
  };
  return `<section class="perso" aria-label="Ton personnel"><h3 class="perso-t">👔 Ton personnel · ${pa.length}/${max} poste${max > 1 ? 's' : ''}</h3>
    ${pa.map(ligne).join('')}
    ${libres ? `<p class="perso-libre">${libres} poste${libres > 1 ? 's' : ''} libre${libres > 1 ? 's' : ''} : les packs Personnel en donnent, et ils s'engagent ici.</p>` : ''}
  </section>${cartesDeLaMaison('entraineur', j)}`;
}
/*
 * UNE MAISON PAR SUJET (V12-2, puis V12-3). JP : *everything coaching should be at same place, including cards for assistant
 * or firing a coach* ; puis *that philosophy should be for everything*. Une carte se joue dans le sous-onglet de ce qu'elle
 * touche : le personnel et le congédiement chez l'entraîneur, ce qui soigne un blessé ou refait des jambes à l'infirmerie,
 * le plafond et les contrats chez le proprio, les rappels (le club-école, un ancien, l'échange d'un doublon) dans l'effectif,
 * sous le tableau des joueurs. Une retouche se pose au verso de son joueur.
 */
const MAISONS_DES_CARTES = {
  entraineur: { titre: 'Tes cartes du personnel' },
  infirmerie: { titre: 'Tes cartes de soin' },
  joueurs: { titre: 'Tes cartes de joueur' },
};
function maisonDeLaCarte(id) {
  const c = BANQUE[id];
  if (!c) return null;
  // V16 (tranche 6) : chaque carte rare a sa maison — une retouche à l'effectif, le reste chez ce qu'il monte.
  if (c.cat === 'joueur') return 'joueurs';
  if (c.cat !== 'consommable') return null;
  const C = CONSOMMABLES[c.cle] || {};
  return C.cible === 'coach' || C.cible === 'adjoint' ? 'entraineur' : C.cible === 'blesse' || (C.gestes && C.gestes.energie) ? 'infirmerie' : C.cible === 'cartable' ? 'joueurs' : null;
}
export function cartesDeLaMaison(maison, j) {
  const meta = lireMeta();
  const engages = new Set(maison === 'entraineur' ? patronsActifs(decisionsDeLaPartie(), j + 1).map(x => x.cle) : []);
  const perso = maison === 'entraineur' ? (meta.personnel || []).filter(k => PATRONS[k] && !engages.has(k)) : [];
  const conso = Object.entries(meta.inventaire || {}).filter(([id, n]) => n > 0 && maisonDeLaCarte(id) === maison);
  const partie = G.ligue ? cartesDeLaPartie({ decisions: decisionsDeLaPartie(), rogue: true }).filter(x => maisonDeLaCarte(x.id) === maison) : [];
  const n = perso.length + conso.reduce((a, [, k]) => a + k, 0) + partie.length;
  const masse = maison === 'proprio' ? masseSalarialeHtml(plafondPourInventaire(j)) : '';
  if (!n) return masse;
  // Une rangée, une feuille (JP, 28 oct. : *j'hais les accordéons* ; chaque onglet tient en un écran) : les cartes s'ouvrent en feuille.
  const icones = [...partie.map(x => x.id), ...perso.map(k => `patron:${k}`), ...conso.map(([id]) => id)].map(id => (BANQUE[id] || {}).ico || '').join(' ');
  return `${masse}<button type="button" class="hub-rangee cartes-maison" data-cartes-maison="${esc(maison)}"><span>🃏 ${MAISONS_DES_CARTES[maison].titre} · ${n}</span><span class="pli-icones" aria-hidden="true">${icones}</span><span aria-hidden="true">›</span></button>`;
}
/* La feuille de tes cartes d'une maison : une option par carte, jouée ou vendue par la même porte que les autres (`jouerDeLaMaison`). */
function ouvrirLesCartes(maison) {
  const hub = hubActif();
  if (!hub || !hub.decider || !G.ligue) return;
  const j = hub.jour ? hub.jour() : (G.journee || 0);
  const meta = lireMeta();
  const engages = new Set(maison === 'entraineur' ? patronsActifs(decisionsDeLaPartie(), j + 1).map(x => x.cle) : []);
  const perso = maison === 'entraineur' ? (meta.personnel || []).filter(k => PATRONS[k] && !engages.has(k)) : [];
  const conso = Object.entries(meta.inventaire || {}).filter(([id, n]) => n > 0 && maisonDeLaCarte(id) === maison);
  const partie = cartesDeLaPartie({ decisions: decisionsDeLaPartie(), rogue: true }).filter(x => maisonDeLaCarte(x.id) === maison);
  const opt = (cle, id, mot, sous) => ({ cle, ico: (BANQUE[id] || {}).ico || '🃏', nom: `${mot} · ${(BANQUE[id] || {}).nom || id}`, sous, mots: reglesDe(id).slice(0, 3) });
  const options = [
    ...partie.flatMap(x => [opt(`partie|${x.id}|${x.ref}`, x.id, 'Jouer', ''), ...(valeurDe(x.id) ? [{ cle: `vendre|${x.id}|${x.ref}`, ico: '🪙', nom: `Vendre · ${(BANQUE[x.id] || {}).nom || x.id}`, sous: `${valeurDe(x.id)} 🪙`, mots: [] }] : [])]),
    ...perso.map(k => opt(`personnel|patron:${k}|`, `patron:${k}`, 'Engager', '')),
    ...conso.map(([id, k]) => opt(`meta|${id}|`, id, k > 1 ? `Jouer ×${k}` : 'Jouer', '')),
  ];
  const decider = d => { const h = hubActif(); if (h && h.decider) h.decider(d); };
  ouvrirChoix({ ico: '🃏', titre: MAISONS_DES_CARTES[maison].titre, compact: true, fermable: true, motFermer: 'Retour', vide: 'Aucune carte en main.', options,
    onChoix: k => { const [src, id, ref] = k.split('|'); jouerDeLaMaison(src === 'vendre' ? { vendre: true, id, ref } : { src, id, ...(ref ? { ref } : {}) }, j, decider); } });
}
if (typeof document !== 'undefined') document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('.cartes-maison[data-cartes-maison]'); if (b) ouvrirLesCartes(b.dataset.cartesMaison); });
/* Jouer une carte depuis sa maison : le même chemin que Tes cartes ; la vendre, la même décision. */
export function jouerDeLaMaison(item, j, decider) {
  if (item.vendre) { decider({ jour: j, vend: { refs: [item.ref], jetons: valeurDe(item.id) } }); return; }
  // V14 : le choix d'un échelon atteint, dans la fiche de la carte (« echelon:<clé>:force|defaut »).
  if (item.src === 'echelon') {
    const [, cle, c] = String(item.id).split(':');
    const e = echelonsAChoisir(j).find(x => x.cle === cle);
    if (!e || !e.options.some(o => o.cle === c && !o.desactive)) return;
    toast(`${e.ico} ${e.qui} : échelon ${e.echelon + 1}.`);
    decider({ jour: j, ...e.decision(c) });
    return;
  }
  // V19 : la prolongation d'un contrat (« contrat:<clé> »), payée en jetons.
  if (item.src === 'contrat') {
    const e = etatPersonnel(j).find(x => `contrat:${x.cle}` === item.id);
    if (!e || !e.prolongeable || jetonsRogue(j) < e.prixProlongation) return;
    toast(`${e.patron.ico} ${e.qui} : contrat prolongé.`);
    decider({ jour: j, palier: `ct:${e.cle}:${(e.patron.prolonge || 0) + 1}`, ...decisionDeProlongation(e) });
    return;
  }
  jouerCarte(item, j, decider, null, () => {});
}
/*
 * L'ÉCHANGE D'UN DOUBLON (Jalon P3) : ton doublon le plus fourni (à égalité, l'ordre pur de `graine`) donne trois
 * joueurs de la même époque de cartons (`epoqueDe`, js/cartes.js) — des saisons qu'elle couvre, pas encore à ton
 * cartable, au plus du niveau de la carte, sous le plafond d'un pack, ni dans la ligue ni chez toi. Chaque offre porte
 * le doublon qu'elle coûte (`donne`) ; la signature le retire (`donnerUnDoublon`).
 */
async function offresDEchange(C, graine, c, dansLaLigue, max) {
  const doublons = tirageDuClasseur(Object.keys(c.joueurs).filter(k => (c.joueurs[k].n || 0) >= 2), graine)
    .sort((a, b) => (c.joueurs[b].n || 0) - (c.joueurs[a].n || 0));
  for (const d of doublons) {
    const q = await joueurDeCle(d);
    if (!q) continue;
    const epoque = epoqueDe(q.s);
    const saisons = tirageDuClasseur(state.index.seasons.filter(s => epoqueDe(s) === epoque), `${graine}:saisons`);
    const out = [];
    for (const s of saisons) {
      if (out.length >= C.offres) break;
      const joueurs = (await getShard(s)).players;
      for (const k of tirageDuClasseur(joueurs.map(getPlayerKey), `${graine}:${s}`)) {
        const p = joueurs.find(x => getPlayerKey(x) === k);
        if (!p || c.joueurs[k] || !(p.$ > 0) || p.$ > max || dansLaLigue.has(getPersonKey(p)) || dejaChezToi(p) || out.some(x => getPersonKey(x.p) === getPersonKey(p))) continue;
        const niveau = niveauDe(p, joueurs);
        if (niveau > C.niveauMax) continue;
        // Un joueur par saison : l'échange montre la série, pas un seul vestiaire.
        out.push({ p, rar: 'commune', niveau, num: null, donne: d, donneNom: q.n, saison: q.s });
        break;
      }
    }
    if (out.length) return out;
  }
  return [];
}
/* Un joueur retrouvé par sa clé (« saison_club_id ») : ceux qu'on garde d'une run à l'autre. */
async function joueurDeCle(cle) {
  const [s] = String(cle).split('_');
  try { const e = await getShard(s); return e.players.find(p => getPlayerKey(p) === cle) || null; } catch { return null; }
}
/*
 * LES PLOMBIERS : vingt-trois vrais joueurs, les moins productifs de huit
 * saisons tirées au hasard — des réguliers, pas des rappelés d'un match (du
 * 10e au 30e centile de production). Le déblocage « Des plombiers moins pires »
 * les prend un cran plus haut (30e au 50e). `autoRoster` les range, et
 * les joueurs gardés de la dernière run passent devant (`placerDevant`).
 */
/*
 * TES PACKS DE DÉPART (oct.). JP : *première fois que le mode commence, ouvrir des packs qui forment l'équipe de
 * base*. Ton cartable vide, ta première run ne tire plus ses bouche-trous en silence : ils sortent de trois packs
 * que tu ouvres — les attaquants, les défenseurs, les gardiens —, et chaque carte va à ton effectif ET à ton
 * cartable (la run suivante tirera son classeur de là). Les mêmes joueurs qu'avant (`plombiersDeLaLigue`), tirés
 * de la graine du classeur : recharger la page devant les packs redonne les mêmes cartes.
 */
const PACKS_DE_DEPART = [{ g: 'F', nom: 'Les attaquants' }, { g: 'D', nom: 'Les défenseurs' }, { g: 'G', nom: 'Les gardiens' }];
async function ouvrirPacksDeDepart(roster, vedette = null) {
  const joueurs = Object.values(roster).filter(Boolean);
  ajouterCollection({ joueurs: joueurs.map(getPlayerKey) });
  apresLeCartable(ajouterAuCartable(joueurs.map(p => ({ cle: getPlayerKey(p), rar: 'commune' }))), joueurs);
  // Ton joueur de concession sort le premier, seul dans son pack ; les autres packs ne le redonnent pas.
  const sienne = vedette ? getPersonKey(vedette) : null;
  const packs = [...(vedette ? [{ g: 'V', nom: 'Ton joueur de concession', cartes: [vedette] }] : []),
    ...PACKS_DE_DEPART.map(P => ({ ...P, cartes: joueurs.filter(p => groupeDe(p) === P.g && getPersonKey(p) !== sienne) }))].filter(P => P.cartes.length);
  for (const [i, P] of packs.entries()) {
    const suite = i < packs.length - 1 ? 'Pack suivant' : 'À la run';
    await new Promise(resolve => ouvrirChoix({
      ico: P.g === 'V' ? '★' : '🥉', titre: `Pack de départ · ${P.nom}`, cartes: true, genre: 'recompense', fermable: true, motFermer: suite,
      recit: P.g === 'V' ? `${vedette.n}, ton joueur de concession : il revient au départ de chaque run.`
        : i === 0 ? `Ton équipe sort de ${packs.length} packs. Chaque carte va à ton effectif et à ton cartable.` : `${P.cartes.length} de plus.`,
      options: P.cartes.map(p => {
        const g = groupeDe(p);
        return { cle: getPlayerKey(p), rarete: 'commune', nom: p.n, type: `${POSTE_GROUPE[g]} · ${p.t} ${p.s}`, coin: money(p.$),
          art: artJoueur({ portraitHtml: headshotHtml(p), logoHtml: getTeamLogoHtml(p.t, 24), pos: esc(POSTE_GROUPE[g]), saison: esc(p.s), club: esc(p.t), actionSrc: photoAction(p), cadre: cadrePhoto(p) }),
          // Un pack de départ ne se choisit pas, il se montre : la carte se touche pour sa fiche, le bas mène au pack suivant.
          joueurHtml: carteMiniHtml(p), vue: true, apercu: () => apercuJoueur(p) };
      }),
      onFerme: () => resolve(),
    }));
  }
}
/* La première run (js/rogue.js `alourdirLaPremiere`) : de vrais contrats, trop payés pour leur valeur, jusqu'au vrai plafond. */
async function equipeDeLaPremiere(meta, fixes) {
  const reserve = [];
  const roster = placerDevant(autoRoster([...fixes, ...await plombiersDeLaLigue(meta, fixes, graineDuClasseur(), reserve)]), fixes);
  return alourdirLaPremiere(roster, reserve, { fixes, personne: getPersonKey });
}
async function plombiersDeLaLigue(meta, gardes = [], graine = graineDuClasseur(), reserve = null) {
  // Tirés de la graine de la run (oct.) : recharger la page devant les packs de départ redonne les mêmes joueurs.
  const ordre = (liste, ...k) => liste.slice().sort((a, b) => hache(graine, 'plombiers', ...k, String(a)) - hache(graine, 'plombiers', ...k, String(b)));
  // Une `reserve` à remplir, c'est la première run : de vrais contrats seulement.
  const vrais = !!reserve;
  const saisons = [];
  for (const s of ordre(state.index.seasons.filter(s => !vrais || s >= VRAIS_CONTRATS), 'saison').slice(0, 8)) saisons.push((await getShard(s)).players.filter(p => !vrais || p.isReal));
  // La composition du départ (js/rogue.js `bouchesTrousDuDepart`) : peu de bons, quelques entre-deux, beaucoup de faibles.
  return bouchesTrousDuDepart(saisons, { groupe: groupeDe, valeur: p => getHiddenRatings(p).v, personne: getPersonKey, exclus: new Set(gardes.map(getPersonKey)),
    plus: aDebloque(meta, 'plombiersPlus'), reserve, piger: (liste, k) => liste.find(p => getPlayerKey(p) === ordre(liste.map(getPlayerKey), k)[0]) });
}
/*
 * TON JOUEUR DE CONCESSION (js/rogue.js `vedettesDeConcession`) : à la première run, trois Étoiles des saisons de la
 * graine du classeur, et tu en choisis une ; sa clé reste au méta et il revient à chaque départ.
 */
async function vedetteDeLaRun(meta, graine = graineDuClasseur()) {
  if (meta.vedette) return joueurDeCle(meta.vedette);
  const ordre = (liste, ...k) => liste.slice().sort((a, b) => hache(graine, 'vedette', ...k, String(a)) - hache(graine, 'vedette', ...k, String(b)));
  const candidats = await sousVoile('On cherche tes joueurs de concession…', async () => {
    const l = [];
    for (const s of ordre(state.index.seasons, 'saison').slice(0, 8)) { const e = await getShard(s); for (const p of e.players) l.push({ p, niveau: niveauDe(p, e.players) }); }
    return l;
  });
  const offerts = vedettesDeConcession(candidats, { personne: getPersonKey, piger: (liste, k) => liste.find(p => getPlayerKey(p) === ordre(liste.map(getPlayerKey), k)[0]) });
  if (!offerts.length) return null;
  const cle = await new Promise(resolve => ouvrirListeJoueurs({
    ico: '★', titre: 'Ton joueur de concession', motBouton: 'Le choisir', motFermer: 'Le premier',
    recit: 'Il revient au départ de chaque run. Les autres étoiles, tu devras les gagner.',
    joueurs: offerts.map(p => ({ p, sous: quiEst(p) })),
    onChoix: k => resolve(k), onFerme: () => resolve(getPlayerKey(offerts[0])),
  }));
  const p = offerts.find(x => getPlayerKey(x) === cle) || offerts[0];
  const m = lireMeta(); m.vedette = getPlayerKey(p); ecrireMeta(m); meta.vedette = m.vedette;
  return p;
}
/*
 * LE VESTIAIRE TIRÉ DU CLASSEUR (1.0, js/rogue.js `tirageDuDepart`) : dès que
 * ton cartable a des cartes, tes plombiers sont tes cartes Soutien, et le
 * quota baisse avec le prestige et la saison. Les cartes se lisent dans
 * l'ordre du tirage (les moins jouées d'abord), et on s'arrête quand il y en a
 * assez de chaque sorte : pas besoin d'ouvrir cinquante saisons. Ce qui
 * manque vient des plombiers de la ligue. `exclus` : les cartes qui partent.
 */
async function vestiaireDeDepart(meta, fixes = [], { saison = 1, rang = rangDePrestige(meta), exclus = new Set(), graine = graineDuClasseur(), exigence = 0 } = {}) {
  const c = lireCartable();
  const cles = Object.keys(c.joueurs).filter(k => !exclus.has(k));
  if (!cles.length) return { roster: placerDevant(autoRoster([...fixes, ...await plombiersDeLaLigue(meta, fixes, graine)]), fixes), quota: null, tires: [] };
  const quota = soutiensDuDepart(rang, saison, exigence);
  const decrire = async p => ({ cle: getPlayerKey(p), p, groupe: groupeDe(p), niveau: niveauDe(p, (await getShard(p.s)).players), r: (c.joueurs[getPlayerKey(p)] || {}).r || 0 });
  const fixesDecrits = await Promise.all(fixes.map(decrire));
  const personnes = new Set(fixes.map(getPersonKey));
  const assez = { F: COMPOSITION_DEPART.F + 3, D: COMPOSITION_DEPART.D + 2, G: COMPOSITION_DEPART.G + 1 };
  const vus = { F: 0, D: 0, G: 0 };
  let reguliers = 0;
  const cartes = [];
  const ordre = cles.sort().sort((a, b) => ((c.joueurs[a].r || 0) - (c.joueurs[b].r || 0)) || hache(graine, 'depart', a) - hache(graine, 'depart', b));
  for (const cle of ordre) {
    if (Object.keys(assez).every(g => vus[g] >= assez[g]) && reguliers >= SOUTIENS_DEPART - quota + 2) break;
    const p = await joueurDeCle(cle);
    if (!p || !(p.$ > 0) || personnes.has(getPersonKey(p))) continue;
    const x = await decrire(p);
    if (x.niveau > 1) continue;
    personnes.add(getPersonKey(p));
    cartes.push(x);
    if (estSoutien(x.niveau)) vus[x.groupe]++; else reguliers++;
  }
  const masseFixes = fixes.reduce((a, p) => a + (p.$ || 0), 0);
  const budget = PLAFOND_ROGUE + plafondDuVestiaire(meta) - ESPACE_DE_DEPART;
  const { tires, manque } = tirageDuDepart({ fixes: fixesDecrits, cartes, quota, budget: Math.max(masseFixes, budget), graine, personne: x => getPersonKey(x.p) });
  const pris = [...fixes, ...tires.map(x => x.p)];
  // Les trous : des plombiers de la ligue, le nombre qu'il faut à chaque poste.
  if (Object.values(manque).some(n => n > 0)) {
    const ligue = await plombiersDeLaLigue(meta, pris, graine);
    for (const g of ['F', 'D', 'G']) pris.push(...ligue.filter(p => groupeDe(p) === g).slice(0, manque[g]));
  }
  const roster = placerDevant(autoRoster(pris), fixes);
  // Le départ d'une run (oct.) : tes cartes restent ; tes bouche-trous prennent de vrais contrats trop payés, jusqu'à l'espace
  // de départ. Entre deux saisons, l'équipe garde sa masse et l'espace du vrai plafond (JP : *du lousse, ça donne le jeu de construire*).
  if (saison > 1) return { roster, quota, tires, nFixes: fixes.length };
  const reserve = [];
  await plombiersDeLaLigue(meta, pris, graine, reserve);
  const cible = PLAFOND_PREMIERE + plafondDuVestiaire(meta) - Math.max(0, ESPACE_DE_DEPART + plafondDuVestiaire(meta) + exigencesDe(exigence).espace);
  return { roster: alourdirLaPremiere(roster, reserve, { fixes: [...fixes, ...tires.map(x => x.p)], personne: getPersonKey, cible }), quota, tires, nFixes: fixes.length };
}
/*
 * LES CARTES QU'ON A CHOISIES PASSENT DEVANT (S80) : un joueur gardé ou tiré
 * du classeur que l'alignement automatique laisserait de côté prend la case
 * du plombier le moins utile qu'il peut jouer. Il a été PRIS : il est de la
 * run, pas en option.
 */
function placerDevant(roster, prioritaires = []) {
  const miens = new Set(prioritaires.map(getPersonKey));
  const place = p => Object.values(roster).some(q => q && getPersonKey(q) === getPersonKey(p));
  for (const p of prioritaires) {
    if (place(p)) continue;
    const cases = SLOTS.filter(sl => !sl.extra && fits(p, sl) && roster[sl.i] && !miens.has(getPersonKey(roster[sl.i])))
      .map(sl => ({ sl, valeur: getHiddenRatings(roster[sl.i]).v - getPositionPenalty(roster[sl.i], sl) }))
      .sort((a, b) => a.valeur - b.valeur);
    if (cases[0]) roster[cases[0].sl.i] = p;
  }
  return roster;
}
/*
 * CEUX QUI TE SUIVENT DE TA DERNIÈRE RUN (JP, 24 oct. : *garder des joueurs de run en run devrait être fait dans une
 * loto*) : les cases de `gardesDeLaDerniere` (js/rogue.js), chacune un loto de ta dernière équipe, sous le budget du
 * classeur. Ton joueur de concession n'y est pas : il revient de toute façon.
 */
async function gardesDeLaRunDavant(meta) {
  const R = gardesDeLaDerniere(meta);
  const cles = (meta.derniereEquipe || []).filter(cle => cle !== meta.vedette);
  if (!R.cases.length || !cles.length) return [];
  const cartes = await sousVoile('On rappelle ta dernière équipe…', async () => (await Promise.all(cles.map(async cle => {
    const p = await joueurDeCle(cle);
    return p && { cle, p, niveau: niveauDe(p, (await getShard(p.s)).players) };
  }))).filter(Boolean));
  const run = (meta.runs || 0) + 1;
  const pris = await lotosParCase({
    cases: R.cases, vues: R.vues, cartes, graine: `${graineDuClasseur()}:d`, budget: budgetDuClasseur(meta), personnes: new Set(), qui: p => quiEst(p),
    textes: ({ i, n, k, niveau, vus, dernier }) => ({
      ico: '🤝', titre: `Ta dernière équipe · ${nomDeCase(k)}`, irl: `Run ${run}${n > 1 ? ` · case ${i + 1} de ${n}` : ''}`,
      recit: `${motDeLaDescente(k, niveau, 'joueur')}Le loto tire ${vus} joueur${vus > 1 ? 's' : ''} ${nomDeCase(niveau)} de ta dernière équipe : celui que tu gardes te suit dans cette run.`,
      budget: '🤝 Budget des gardés', plein: 'Tu gardes déjà ton joueur de ce loto',
      partir: prise => (prise ? (dernier ? 'Il me suit' : 'Loto suivant') : 'Personne de ce loto'),
    }),
  });
  return pris.map(x => x.p);
}
/*
 * UNE RUN QUI COMMENCE : l'écran de la run (ce qu'on a débloqué, ce que le
 * proprio demandera), les joueurs à garder s'il y en a, les cartes du
 * classeur (S80), puis les plombiers et l'alignement.
 */
export async function ouvrirRogue() {
  const meta = lireMeta();
  const R = gardesDeLaDerniere(meta);
  const D = departDuClasseur(meta);
  const nCartable = Object.keys(lireCartable().joueurs).length;
  // LES EXIGENCES (tranche 8) : après ta première Coupe, un cran de plus à chaque Coupe gagnée au plus haut.
  const ouvertes = exigencesOuvertes(meta);
  // La ligue qui monte (tranche 8) : ton prestige la règle, chaque cran la monte ; le départ la dit.
  const rangRun = rangDePrestige(meta);
  const crans = Array.from({ length: ouvertes }, (_, i) => i + 1).map(n => ({ cle: `e${n}`, ico: ICO_EXIGENCE, nom: `Exigence ${n} : ${EXIGENCES[n - 1].nom}`,
    sous: `Ta ligue : ${motDeLaLigue(niveauDeLigue(rangRun, n))}`,
    bon: `${Math.round(100 * PRIME_EXIGENCE * n)} % de médailles de plus`, prix: `${EXIGENCES[n - 1].texte}${n > 1 ? ', en plus des précédentes' : ''}` }));
  const go = await new Promise(resolve => ouvrirChoix({
    ico: '💀', titre: 'Le mode Rogue', fermable: true, motFermer: 'Pas maintenant', compact: crans.length > 2,
    // 1.0 (R5) : deux phrases ; le reste se lit dans « Règles », section « Le mode Rogue ».
    recit: `Des bouche-trous et 🪙 ${jetonsDeDepart(meta)} jetons. Chaque saison, le proprio en veut plus ; la Coupe finit la run.`,
    options: [{ cle: 'go', ico: '▶', nom: `Commencer la run ${(meta.runs || 0) + 1}`,
      bon: [nCartable ? '' : `🥉 ta première run : ton équipe sort de ${PACKS_DE_DEPART.length} packs de départ`, nCartable ? `ton effectif tiré de ton cartable : ${soutiensDuDepart(rangDePrestige(meta))} ${NIVEAUX[0].nom}, ${SOUTIENS_DEPART - soutiensDuDepart(rangDePrestige(meta))} ${NIVEAUX[1].nom}, les cartes les moins jouées d'abord` : '',
        meta.vedette ? '★ ton joueur de concession' : '', nCartable && D.n ? `📒 ton classeur : ${motDesCases(D.cases)}` : '',
        `🛒 ${BOUTIQUE.filter(k => packsOuverts(meta)[k] === true).length} packs ouverts à la boutique sur ${BOUTIQUE.length}`,
        R.cases.length && (meta.derniereEquipe || []).length ? `🤝 ta dernière équipe : ${motDesCases(R.cases)}` : '', reservesDeLaRun(meta) ? `🪑 ${3 + reservesDeLaRun(meta)} réservistes` : '',
        `📈 ${PRESTIGES[rangDePrestige(meta)].nom}`, `ta ligue : ${motDeLaLigue(niveauDeLigue(rangRun, 0))}`].filter(Boolean).join(' · '),
      sous: meta.runs ? `🏅 ${meta.ecussons || 0} médailles · ${meta.runs || 0} run${(meta.runs || 0) > 1 ? 's' : ''} · 🏆 ${meta.coupes || 0} · 📒 ${nCartable} carte${nCartable > 1 ? 's' : ''} au cartable` : '' }, ...crans],
    onChoix: cle => resolve(cle === 'go' ? 0 : Number(String(cle).slice(1))),
    onFerme: () => resolve(false),
  }));
  // « Pas maintenant » et « Retour » ramènent au menu, pas dans le vestiaire de repêchage qui attend dessous.
  const auMenu = () => afficherMenu(contexteDuMenu({ enJeu: false }));
  if (go === false) { auMenu(); return; }
  const exigence = go;
  const coach = await choisirCoach();
  if (!coach) { auMenu(); return; }
  const gardes = await gardesDeLaRunDavant(meta);
  // TON JOUEUR DE CONCESSION (js/rogue.js `vedettesDeConcession`) : choisi à la première run, il revient à chaque départ.
  const vedette = await vedetteDeLaRun(meta);
  const avecVedette = vedette && !gardes.some(p => getPersonKey(p) === getPersonKey(vedette)) ? [vedette, ...gardes] : gardes;
  const tires = await choisirDuClasseur(avecVedette, exigence);
  // Ton cartable est vide (ta première run) : ton équipe sort de tes packs de départ.
  const premiere = !nCartable && !gardes.length
    ? await sousVoile('On scelle tes packs de départ…', () => equipeDeLaPremiere(meta, avecVedette)) : null;
  if (premiere) await ouvrirPacksDeDepart(premiere, vedette);
  await sousVoile('On rassemble tes bouche-trous…', () => demarrerRogue(avecVedette, tires, coach, premiere, exigence));
}
/*
 * TON COACH (v2, js/coachs.js) — le personnage de Slay the Spire. Les coachs
 * que le prestige du club a ouverts (V2.3 : trois au Club de garage, les huit
 * à la Dynastie, js/rogue.js `coachsOuverts`), un à prendre : sa philosophie
 * part avec trois points au compteur, sa confiance I allumée dès le premier
 * soir. Les autres coachs restent à prendre en jouant. Et les deux patrons
 * imposés de la run, tirés de la même graine (`patronsDeLaRun`).
 */
const patronsDeLaRun = meta => patronsDeDepart(graineDuClasseur(), PRESTIGES[rangDePrestige(meta)].raretes);
function choisirCoach() {
  const meta = lireMeta(), rang = rangDePrestige(meta), ouverts = coachsOuverts(rang);
  const pats = patronsDeLaRun(meta).map(id => BANQUE[id]);
  const plus = ouverts.length < VOIES.length ? ` ${ouverts.length} coachs sur ${VOIES.length} : le prestige ouvre les autres.` : '';
  return new Promise(resolve => ouvrirChoix({
    ico: '📋', titre: 'Ton coach', fermable: true, motFermer: 'Retour',
    recit: meta.runs ? `Confiance I au départ, II à ${SEUILS[1]} points, III à ${SEUILS[2]} : ses adjoints en poste, leurs échelons, leurs matchs à ton service.${plus} Ton personnel : ${pats.map(c => `${c.ico} ${c.nom}`).join(' et ')}.`
      : `Sa philosophie joue dès le premier soir ; plus ses adjoints travaillent chez toi, plus l'équipe y croit.${plus} Ton personnel : ${pats.map(c => `${c.ico} ${c.nom}`).join(' et ')}.`,
    options: optionsDeCoach(ouverts, { cartes: !!meta.runs }),
    onChoix: k => resolve(k),
    onFerme: () => resolve(null),
  }));
}
/* Les coachs offerts, en options d'`ouvrirChoix` : sa philosophie, sa confiance I. `garde` : le coach en poste, gardé tel quel. */
function optionsDeCoach(cles, { cartes = true, garde = null } = {}) {
  return cles.map(k => {
    const C = COACHS[k], g = garde && garde.cle === k;
    return { cle: k, ico: C.ico, nom: C.nom, sous: `${C.mot} Son dépisteur recrute ${C.recrute}.`,
      mots: [{ txt: g ? `On le garde · confiance ${ROMAINS[garde.palier]}` : 'Confiance I', bon: g ? true : null, duree: true },
        ...reglesDePalier(k, g ? garde.palier : 1)],
      quand: cartes ? `${idsDuCoach(k).filter(id => id.startsWith('patron:')).length} adjoints de sa couleur` : '' };
  });
}
/*
 * LE COACH D'UNE SAISON NEUVE (V5, JP : *le coach, choisi au début de la saison*) : on garde celui en poste, avec
 * sa confiance, ou on en prend un autre, qui repart à la confiance I. Rend la clé du coach choisi.
 */
function choisirCoachDeSaison(saison) {
  const actif = coachsActifs(decisionsDeLaPartie())[0] || null;
  const ouverts = coachsOuverts((G.rogue && G.rogue.prestige) || 0);
  const cles = actif ? [actif.cle, ...ouverts.filter(k => k !== actif.cle)] : ouverts;
  return new Promise(resolve => ouvrirChoix({
    ico: '📋', titre: `Ton coach · saison ${saison}`,
    recit: actif ? `Garde ${COACHS[actif.cle].nom}, avec sa confiance ${ROMAINS[actif.palier]}, ou prends-en un autre : il repart à la confiance I.` : 'Sa philosophie joue dès le premier soir.',
    options: optionsDeCoach(cles, { garde: actif }),
    onChoix: k => resolve(k),
  }));
}
/*
 * LE TIRAGE DU CLASSEUR (S80), semé par le méta : `sel` (tiré une fois, pour
 * toujours) et le numéro de la run. Recharger la page devant le tirage
 * redonne les mêmes cartes — le tirage ne se relance pas.
 */
function graineDuClasseur() {
  const m = lireMeta();
  if (!m.sel) { m.sel = String(nouvelleGraine()); ecrireMeta(m); }
  return `${m.sel}:${m.runs || 0}`;
}
/* Le nom d'une case : « Pilier », « ★ Étoile » ; les cases en mots : « une case Pilier, une case Régulier ». */
const nomDeCase = k => `${k >= ETOILE ? '★ ' : ''}${NIVEAUX[k].nom}`;
const motDesCases = cases => cases.map(k => `une case ${nomDeCase(k)}`).join(', ');
/* Les cartes de ton cartable, avec leur niveau dans leur saison et leur meilleure variante. */
async function cartesDuCartable() {
  const c = lireCartable(), out = [];
  for (const cle of Object.keys(c.joueurs)) {
    const p = await joueurDeCle(cle);
    if (!p || !(p.$ > 0)) continue;
    const x = c.joueurs[cle];
    out.push({ cle, p, niveau: niveauDe(p, (await getShard(p.s)).players), rar: meilleureVariante(x), num: (x.num || [])[0] || null });
  }
  return out;
}
/*
 * LES LOTOS PAR CASE (JP, 24 oct. : *garder des joueurs de run en run devrait être fait dans une loto, pas genre tu
 * peux prendre qui tu veux*). Une case, un loto (js/depart.js) : dans l'ordre de son tirage (pur : la graine et le
 * rang de la case), les cartes de son niveau qui tiennent dans ce qui reste du budget, une par personne — aucune,
 * celles du niveau d'en dessous (js/rogue.js `lotoDeCase`). Tu en prends une ou tu passes, et la case suivante
 * s'ouvre. `cartes` : [{ cle, p, niveau, rar, num }] ; `textes(case)` : les mots de son écran. Rend celles prises.
 */
async function lotosParCase({ cases, vues, cartes, graine, budget, personnes, qui, textes }) {
  const pris = [];
  for (let i = 0; i < cases.length && budget > 0; i++) {
    const rang = new Map(tirageDuClasseur(cartes.map(x => x.cle), `${graine}:c${i}`).map((k, j) => [k, j]));
    const vus = new Set(personnes);
    const dispo = cartes.slice().sort((a, b) => rang.get(a.cle) - rang.get(b.cle)).filter(x => {
      const k = getPersonKey(x.p);
      if (!(x.p.$ > 0) || x.p.$ > budget || vus.has(k)) return false;
      vus.add(k);
      return true;
    });
    const L = lotoDeCase(dispo, cases[i], vues);
    if (!L.cartes.length) continue;
    const x = await new Promise(resolve => ouvrirDepartClasseur({
      budget, candidats: L.cartes, esc, money, qui, apercu: p => apercuJoueur(p),
      textes: textes({ i, n: cases.length, k: cases[i], niveau: L.niveau, vus: L.cartes.length, dernier: i + 1 >= cases.length }),
      onFini: cles => resolve(L.cartes.find(y => cles.includes(y.cle)) || null),
    }));
    if (!x) continue;
    pris.push(x); personnes.add(getPersonKey(x.p)); budget -= x.p.$ || 0;
  }
  return pris;
}
/* « Pas de carte Pilier qui tienne : la case prend tes cartes Régulier. » — quand une case descend d'un niveau. */
const motDeLaDescente = (k, niveau, sorte) => (niveau < k ? `Pas de ${sorte} ${nomDeCase(k)} qui tienne : la case prend tes ${sorte}s ${nomDeCase(niveau)}. ` : '');
/*
 * LE DÉPART DU CLASSEUR (S80, js/depart.js) : ses cases (js/rogue.js `departDuClasseur`), du plus haut niveau au plus
 * bas, chacune un loto de ton cartable. Une même personne ne revient pas deux fois (un joueur échangé a une carte
 * par club), ni un joueur gardé.
 */
async function choisirDuClasseur(gardes = [], exigence = 0) {
  const meta = lireMeta();
  const D = departDuClasseur(meta, exigence);
  if (!D.n || !Object.keys(lireCartable().joueurs).length) return [];
  const cartes = await sousVoile('On ouvre ton classeur…', cartesDuCartable);
  const run = (meta.runs || 0) + 1;
  return lotosParCase({
    cases: D.cases, vues: D.vues, cartes, graine: graineDuClasseur(), budget: budgetDuClasseur(meta), personnes: new Set(gardes.map(getPersonKey)), qui: p => quiEst(p),
    textes: ({ i, n, k, niveau, vus, dernier }) => ({
      ico: '📒', titre: `Le classeur · case ${nomDeCase(k)}`, irl: `Run ${run}${n > 1 ? ` · case ${i + 1} de ${n}` : ''}`,
      recit: `${motDeLaDescente(k, niveau, 'carte')}Le loto tire ${vus} carte${vus > 1 ? 's' : ''} ${nomDeCase(niveau)} de ton cartable : prends-en une, ou passe. Prise, elle rejoint tes bouche-trous.`,
      budget: '📒 Budget du classeur', plein: 'Tu as ta carte de cette case',
      partir: pris => (dernier ? (pris ? 'Commencer la run' : 'Commencer la run sans elle') : (pris ? 'Case suivante' : 'Passer cette case')),
    }),
  });
}
/* Ce que le départ a donné, en une ligne : « Ton effectif : 20 Soutien et 3 Réguliers de ton cartable ». */
function motDuVestiaire(V) {
  if (V.quota == null) return 'Tes bouche-trous sont là';
  const s = V.tires.filter(x => estSoutien(x.niveau)).length, r = V.tires.length - s;
  const ligue = Object.values(V.roster).filter(Boolean).length - V.tires.length - V.nFixes;
  return `Ton effectif : ${s} ${NIVEAUX[0].nom}${r ? ` et ${r} ${NIVEAUX[1].nom}${r > 1 ? 's' : ''}` : ''} de ton cartable${ligue > 0 ? `, ${ligue} bouche-trou${ligue > 1 ? 's' : ''} de la ligue` : ''}`;
}
async function demarrerRogue(gardes = [], tires = [], coach = null, premiere = null, exigence = 0) {
  const meta = lireMeta();
  const D = departDuClasseur(meta, exigence);
  G.bonus = 'ROGUE';
  G.mode = 'CLASSIQUE'; G.epoque = null; G.repechage = 'TOUTES'; G.identite = null;
  clearSave();
  G.variantes = { graine: nouvelleGraine(), cartes: {}, numeros: {} };
  // Les cartes du classeur gardent leur variante : c'est TA carte, pas une neuve.
  for (const x of tires) { G.variantes.cartes[x.cle] = x.rar; if (x.num) G.variantes.numeros[x.cle] = x.num; }
  G.roster = {}; poserCartes(); G.tirage = []; G.echelle = {}; G.dette = 0; G.renfort = null;
  G.ligue = null; G.tournoi = null; G.relances = 0; G.left = { ...REROLLS };
  G.target = null; G.mainCase = null; G.mainRang = null; G.selectedSlot = null; G.done = false;
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  $('game').classList.remove('bilan');
  // V2.3 : les deux patrons imposés, tirés avant que la run prenne son numéro (la graine du choix du coach).
  const patrons = patronsDeLaRun(meta);
  // Ta première run : l'équipe de tes packs de départ, telle quelle.
  const V = premiere ? { roster: premiere, quota: null, tires: [] } : await vestiaireDeDepart(meta, [...gardes, ...tires.map(x => x.p)], { exigence });
  G.roster = V.roster;
  // Tes cartes gardent leur variante : c'est TA carte, pas une neuve.
  for (const x of V.tires) G.variantes.cartes[x.cle] = meilleureVariante(lireCartable().joueurs[x.cle]);
  poserCartes();
  // La run commence : elle prend son numéro (le tirage du classeur suivant change).
  const m = lireMeta();
  m.runs = (m.runs || 0) + 1;
  ecrireMeta(m);
  G.rogue = {
    depart: jetonsDeDepart(meta), gardes: gardes.map(getPlayerKey), plafond: plafondDeDepart(meta, exigence, { reel: true }),
    // S80 : la run sur plusieurs saisons, ses cases de réserve, et ce que le classeur a donné ; V9 (tranche 8) : son cran d'exigence, fixé.
    numero: m.runs, saison: 1, reserves: reservesDeLaRun(meta), bareme: baremeRogue(meta, exigence), exigence,
    // v2 : le coach choisi au départ (js/coachs.js) — sa confiance I est une décision du jour 0 (js/banc.js) —
    // et le prestige du club, FIXÉ pour la run (js/rogue.js `PRESTIGES`) : un rang gagné en route sert la suivante.
    ...(COACHS[coach] ? { coach } : {}), prestige: rangDePrestige(meta), montee: monteeDesPacks(meta), recrue: cranDeLaRecrue(meta), patrons,
    classeur: { cases: D.cases, pris: tires.map(x => x.cle) },
    // 1.0 (R7) : ce que l'écran « Ta run » comparera à la fin — le cartable au départ, les écussons et les jalons de la run.
    cartableDepart: Object.keys(lireCartable().joueurs).length, ecussonsRun: 0, jalonsRun: [],
    // 1.0 : tes cartes arrivent avec ce qu'elles portent (js/cartable.js `mods`).
    report: reportDesCartes(G.roster),
  };
  saveGame(); syncOptionsUI(); render();
  setView('roster');
  const noms = [...gardes.map(p => p.n), ...tires.map(x => x.p.n)];
  toast(`${motDuVestiaire(V)}${noms.length ? `, avec ${noms.join(', ')}` : ''}. Le proprio veut : ${mandatDe(1, exigence).mot}. Lance la saison quand tu veux.`);
}
/*
 * LE PLAFOND D'UNE SAISON DE LA RUN : 82 M$, plus ce que le vestiaire a
 * débloqué. Chaque saison garde au moins 12 M$ d'espace au-dessus de la
 * masse de départ (trois vedettes gardées de la dernière run ne doivent pas
 * bloquer la saison). Depuis que l'équipe se défait entre deux saisons (1.0),
 * la saison suivante repart comme la première : ses gardés tiennent dans le
 * budget du classeur, le plafond ne grimpe donc pas de saison en saison.
 */
function plafondDeDepart(meta, exigence = 0, { reel = false } = {}) {
  // V9 (tranche 4) : le plafond qui mord — ta masse de départ, plus l'espace de départ et les déblocages ; tranche 8 : moins les exigences.
  const masse = signes().reduce((a, p) => a + (p.$ || 0), 0);
  /*
   * LE VRAI PLAFOND À CHAQUE RUN (oct., JP : *on avait décidé que c'était vraie masse et mauvais contrats*). Le départ
   * d'une run, la première comme les autres, se joue sous le vrai plafond de la LNH, tes bouche-trous alourdis de vrais
   * contrats trop payés (`alourdirLaPremiere`). Une masse déjà plus lourde garde son espace, comme avant.
   */
  if (reel) {
    const v = plafondDuVestiaire(meta), cap = Math.max(PLAFOND_PREMIERE + v, plafondDeSaison(masse, meta, exigence));
    return { cap, lignes: [{ nom: 'Le vrai plafond de la LNH', montant: PLAFOND_PREMIERE }, ...(v ? [{ nom: 'Les déblocages', montant: v }] : []), ...(cap > PLAFOND_PREMIERE + v ? [{ nom: 'Ta masse le dépasse', montant: cap - PLAFOND_PREMIERE - v }] : [])] };
  }
  const base = Math.ceil((masse + ESPACE_DE_DEPART) / 100_000) * 100_000;
  const lignes = [{ nom: `Ta masse (${money(masse)}), plus ${money(base - masse)} d'espace`, montant: base }];
  const v = plafondDuVestiaire(meta);
  if (v) lignes.push({ nom: 'Les déblocages', montant: v });
  const cap = plafondDeSaison(masse, meta, exigence);
  if (cap !== base + v) lignes.push({ nom: 'Les exigences', montant: cap - base - v });
  return { cap, lignes };
}
/*
 * LA FIN D'UNE SAISON ROGUE : les écussons (payés une fois, `payerEcussons`
 * s'en souvient), les jalons de la saison, et le sort de la run — le mandat
 * de la première saison se lit ici (les séries), les autres aux séries.
 */
export const numeroDeSaison = () => (G.rogue && G.rogue.saison) || 1;
/*
 * MOMENTS LÉGENDAIRES (v2) : quatre exploits qui se gravent sur la carte d'un
 * joueur à la fin de la saison. Ils lisent les feuilles du calendrier régulier
 * et ne dépendent que de ce que le moteur a déjà calculé.
 *   mur        — gardien arrête 42+ tirs et gagne
 *   jeuBlanc   — gardien donne zéro but et gagne
 *   chapeau    — avant marque 3+ buts dans un match
 *   grandMatch — joueur cumule 4+ points (buts + passes) dans une victoire
 */
function detecterLegendaires() {
  const L = G.ligue;
  if (!L || !L.you || !L.calendrier) return [];
  const you = L.you;
  const maPlayers = new Set(Object.values(you.roster).filter(Boolean).map(getPlayerKey));
  const moments = [];
  const aDeja = (type, cle) => moments.some(x => x.type === type && x.cle === cle);
  for (const jour of L.calendrier) {
    for (const m of jour) {
      const cote = m.A === you ? 'A' : m.B === you ? 'B' : null;
      if (!cote) continue;
      const f = m.feuille;
      if (!f || !f.buts) continue;
      const advCote = cote === 'A' ? 'B' : 'A';
      const gagne = f.vainqueur === cote;
      const g = cote === 'A' ? f.gardienA : f.gardienB;
      if (g && gagne && maPlayers.has(getPlayerKey(g))) {
        const tirsContre = (f.tirs[advCote] || []).reduce((a, b) => a + b, 0);
        const butsContre = f.buts.filter(b => b.cote === advCote).length;
        const cle = getPlayerKey(g);
        if (tirsContre >= 42 && !aDeja('mur', cle)) moments.push({ type: 'mur', cle, extra: tirsContre, nom: g.n });
        if (butsContre === 0 && !aDeja('jeuBlanc', cle)) moments.push({ type: 'jeuBlanc', cle, nom: g.n });
      }
      const butsParJ = new Map();
      const ptsParJ = new Map();
      for (const b of f.buts) {
        if (b.cote !== cote) continue;
        if (b.marqueur && maPlayers.has(getPlayerKey(b.marqueur))) {
          const k = getPlayerKey(b.marqueur), rec = butsParJ.get(k) || { n: 0, nom: b.marqueur.n };
          rec.n++; butsParJ.set(k, rec);
          const pt = ptsParJ.get(k) || { n: 0, nom: b.marqueur.n };
          pt.n++; ptsParJ.set(k, pt);
        }
        for (const pass of (b.passeurs || [])) {
          if (!pass || !maPlayers.has(getPlayerKey(pass))) continue;
          const k = getPlayerKey(pass), pt = ptsParJ.get(k) || { n: 0, nom: pass.n };
          pt.n++; ptsParJ.set(k, pt);
        }
      }
      for (const [cle, { n, nom }] of butsParJ) if (n >= 3 && !aDeja('chapeau', cle)) moments.push({ type: 'chapeau', cle, extra: n, nom });
      if (gagne) for (const [cle, { n, nom }] of ptsParJ) if (n >= 4 && !aDeja('grandMatch', cle)) moments.push({ type: 'grandMatch', cle, extra: n, nom });
    }
  }
  return moments;
}
function afficherLegendaires(moments) {
  // Les mêmes mots que la fiche relit (`LEGENDES`, js/cartable.js) : gravé ce soir, relu demain.
  moments.forEach((m, i) => { const L = LEGENDES[m.type]; if (L) setTimeout(() => toast(`${L.ico} ${m.nom} — ${L.recit(m)}. ${L.nom}, gravé sur sa carte.`), 4200 + i * 1500); });
}
/* Les niveaux différents de ton équipe (Soutien à Phénomène), lus dans les saisons déjà chargées. */
function niveauxDeLEquipe() {
  const vus = new Set();
  for (const p of signes().filter(Boolean)) { const e = G.shards.get(p.s); const k = e ? niveauDe(p, e.players) : -1; if (k >= 0) vus.add(k); }
  return vus.size;
}
function faitsDeLaSaison() {
  const L = G.ligue, t = L.you;
  const rang = (L.teams || []).indexOf(t) + 1;
  // La plus longue séquence de victoires, lue dans le calendrier joué.
  let serie = 0, serieMax = 0;
  for (const jour of L.calendrier || []) for (const m of jour) {
    if ((m.A !== t && m.B !== t) || !m.joue) continue;
    serie = (m.A === t) === (m.gfA > m.gfB) ? serie + 1 : 0;
    serieMax = Math.max(serieMax, serie);
  }
  return { pts: t.PTS || 0, rang, premier: rang === 1, series: rang > 0 && rang <= nombreEnSeries((L.teams || []).length), serieMax,
    saisonDeLaRun: numeroDeSaison(), cartes: Object.keys(lireCartable().joueurs).length, joues: cartesJouees(), niveaux: niveauxDeLEquipe(),
    coachIII: coachsActifs(decisionsDeLaPartie()).some(c => c.palier >= 3) };
}
function direJalons(payes) {
  payes.forEach((J, i) => setTimeout(() => toast(`🏁 Jalon : ${J.nom} — ${J.mot}.`, '', { attendre: true }), 1800 + i * 1400));
  // 1.0 (R7) : la run se souvient de ses jalons, pour l'écran « Ta run ».
  if (payes.length && G.rogue) G.rogue.jalonsRun = [...(G.rogue.jalonsRun || []), ...payes.map(J => J.nom)];
}
/* Le cran d'exigence de la run en cours (tranche 8) ; une run d'avant n'en a pas. */
const exigenceDeLaRun = () => (G.bonus === 'ROGUE' && G.rogue && G.rogue.exigence) || 0;
/* 1.0 (R7) : les écussons gagnés par CETTE run, cumulés au moment où ils se paient (exacts, jamais recalculés). */
function compterEcussonsRun(n) { if (n && G.rogue) G.rogue.ecussonsRun = (G.rogue.ecussonsRun || 0) + n; }
export function finDeSaisonRogue() {
  if (G.bonus !== 'ROGUE' || !G.ligue || !G.ligue.you) return;
  const t = G.ligue.you;
  const f = faitsDeLaSaison();
  const n = payerEcussons(G.ligue.graine, 'saison', ecussonsDeLaSaison(f.pts) * exigencesDe(exigenceDeLaRun()).medailles, {
    equipe: Object.values(G.roster || {}).filter(Boolean).map(getPlayerKey),
    bilan: { pts: f.pts, W: t.W, L: t.L, OTL: t.OTL },
  });
  if (n) setTimeout(() => toast(`🏅 +${n} médailles pour ta saison (${f.pts} points) — dépense-les aux déblocages.`, '', { attendre: true }), 900);
  compterEcussonsRun(n);
  modsAuCartable();
  // 1.0 : LA PRIME DE DÉCOUVERTE — chaque carte qui finit sa première saison avec toi (une fois pour toujours).
  const equipe = signes().filter(Boolean).map(getPlayerKey);
  marquerJouees(equipe, (G.rogue && G.rogue.numero) || 0);
  const neuves = decouvrir(equipe);
  const d = neuves.length ? payerEcussons(G.ligue.graine, 'decouverte', neuves.length * PRIME_DECOUVERTE) : 0;
  if (d) setTimeout(() => toast(`🧪 +${d} médailles de découverte : ${neuves.length} carte${neuves.length > 1 ? 's' : ''} jouée${neuves.length > 1 ? 's' : ''} pour la première fois.`, '', { attendre: true }), 2400);
  compterEcussonsRun(d);
  const moments = detecterLegendaires();
  if (moments.length) { ajouterLegendesAuCartable(moments, (G.rogue && G.rogue.saison) || 1); afficherLegendaires(moments); }
  graverLaSaisonRogue(t);
  direJalons(payerJalons({ ...f, joues: cartesJouees() }));
  majRunRogue();
}
/*
 * GRAVER LA SAISON (V9, tranche 7 — js/galons.js, js/cartable.js `graverLaSaison`, js/rogue.js `graverAuPantheon`) :
 * l'histoire de chacun chez toi, ses galons (un palier de badge pour le reste de la run, une copie de plus de sa
 * carte), et le panthéon du club. Une saison rechargée réécrit les mêmes lignes : rien ne compte deux fois.
 */
function graverLaSaisonRogue(t) {
  const run = (G.rogue && G.rogue.numero) || 0, saison = numeroDeSaison();
  const joueurs = Object.values(t.roster || {}).filter(Boolean);
  const galons = galonsDeLaSaison(t, joueurs, getPlayerKey);
  const gros = grosGagnesDe(t, joueurs, getPlayerKey);
  const lignes = joueurs.map(p => {
    const k = getPlayerKey(p);
    const stats = p.p === 'G' ? { gp: p.simGP || 0, w: p.simW || 0, so: p.simSO || 0 } : { gp: p.simGP || 0, g: p.simG || 0, a: p.simA || 0, pts: p.simPTS || 0 };
    return { cle: k, stats: { ...stats, ...(gros.get(k) ? { gros: gros.get(k) } : {}) }, galons: galons.filter(g => g.joueur === k).map(({ cle, n, match, adv }) => ({ cle, n, match, adv })) };
  });
  // Les galons se lisent au bilan, dans la run (`galonsHtml`) : en toasts, ils s'écrasaient l'un l'autre (B8).
  const { montees } = graverLaSaison(lignes, run, saison);
  for (const m of montees) setTimeout(() => toast(`✨ ${motDeMontee(m, nomDe(m.cle))}`, '', { attendre: true }), 3200);
  const L = G.ligue, stats = leagueStats(L.teams || [t]);
  const trophees = gagnantsDesTrophees(stats).filter(o => o.x.t === t).map(o => ({ nom: o.d.nom, joueur: o.x.p.n, val: o.d.val(o.x) }));
  const neuf = graverAuPantheon({ run, saison, pts: t.PTS || 0, trophees,
    joueurs: lignes.map(l => ({ cle: l.cle, nom: nomDe(l.cle), gardien: !!joueurs.find(p => getPlayerKey(p) === l.cle && p.p === 'G'), ...l.stats, galonsCarriere: galonsDe(l.cle).length })) });
  const mots = [...neuf.records.map(k => (k === 'club' ? 'un record de points du club' : `le record : ${RECORDS[k].nom.toLowerCase()}`)), ...neuf.trophees.map(x => `${x.nom} (${x.joueur})`), ...neuf.chandails.map(x => `le chandail de ${x.nom} est retiré`)];
  if (mots.length) setTimeout(() => toast(`Au panthéon : ${mots.join(' · ')}.`, '', { attendre: true }), 3600);
}
/*
 * LES GALONS DE LA SAISON, AU BILAN (Jalon M, A8 et B8) : relus dans l'histoire de chacun chez toi (le cartable), dans
 * l'ordre où ils sont tombés, sous le mot du capitaine. Une saison rechargée relit les mêmes : rien à retenir de plus.
 */
function galonsDeCetteSaison() {
  const run = (G.rogue && G.rogue.numero) || 0, saison = numeroDeSaison();
  return Object.values((G.ligue && G.ligue.you && G.ligue.you.roster) || {}).filter(Boolean)
    .flatMap(p => histoireChezToi(getPlayerKey(p)).filter(e => e.run === run && e.s === saison).flatMap(e => e.galons || []).map(g => ({ nom: p.n, g })))
    .sort((a, b) => a.g.match - b.g.match);
}
function galonsHtml() {
  const gs = galonsDeCetteSaison();
  if (!gs.length) return '';
  const sc = sceneDesGalons({ noms: gs.map(x => x.nom), graine: `${(G.ligue && G.ligue.graine) || ''}|${numeroDeSaison()}` });
  return `<div class="run-galons"><div class="section-label">${ICO_GALON} Les galons de la saison</div>${sceneHtml(sc, { voix: true })}
    <ul class="run-galons-l">${gs.map(({ nom, g }) => `<li><b>${esc(nom)}</b> · ${esc(GALONS[g.cle].nom)} <small>${esc(texteDuGalon(g))}</small></li>`).join('')}</ul></div>`;
}
const nomDe = cle => ((Object.values((G.ligue && G.ligue.you && G.ligue.you.roster) || {}).find(p => p && getPlayerKey(p) === cle)) || {}).n || cle;
/* Son histoire chez toi, en une ligne, avant de trancher qui reste (V9, tranche 7) : ses saisons, ses chiffres, ses galons. */
const histoireCourte = p => {
  const h = histoireChezToi(getPlayerKey(p));
  if (!h.length) return '';
  const t = h.reduce((a, e) => ({ g: a.g + (e.g || 0), pts: a.pts + (e.pts || 0), w: a.w + (e.w || 0), galons: a.galons + (e.galons || []).length }), { g: 0, pts: 0, w: 0, galons: 0 });
  return `Chez toi : ${h.length} saison${h.length > 1 ? 's' : ''}, ${p.p === 'G' ? `${t.w} victoires` : `${t.g} buts, ${t.pts} points`}${t.galons ? ` · ${ICO_GALON} ${t.galons}` : ''}`;
};
/* Et ceux des séries : dix par ronde gagnée, vingt de plus pour la Coupe ; les jalons des séries ; le sort de la run. */
export function finDesSeriesRogue(rondes, coupe, { payer = true } = {}) {
  if (G.bonus !== 'ROGUE' || !G.ligue) return;
  G.rogue = G.rogue || {};
  G.rogue.series = { rondes, coupe: !!coupe };
  if (payer) {
    const n = payerEcussons(G.ligue.graine, 'series', ecussonsDesSeries(rondes, coupe) * exigencesDe(exigenceDeLaRun()).medailles, { bilan: { ronde: rondes, coupe: !!coupe, exigence: exigenceDeLaRun() } });
    if (n) setTimeout(() => toast(`🏅 +${n} médailles pour tes séries${coupe ? ' — et la Coupe !' : ''}`, '', { attendre: true }), 900);
    compterEcussonsRun(n);
    const S = G.seriesMoteur;
    const finale = !!(S && S.toutes.some(s => s.ronde === S.nRondes - 1 && (s.A.isPlayer || s.B.isPlayer)));
    direJalons(payerJalons({ ...faitsDeLaSaison(), rondes, coupe: !!coupe, finale }));
    // LA COUPE (Jalon P1) : son pack, des Légendes, au cartable.
    if (coupe) setTimeout(() => ouvrirPackDeSerie(PACKS_DE_SERIE[3], 3), 2400);
    modsAuCartable();
    // V2 · Item 4 : à la fin d'une run (gagnée ou perdue), rembourser les packs scellés non ouverts.
    const sortRun = sortDeLaRun();
    if (sortRun === 'gagnee' || sortRun === 'finie') {
      const scelles = packsScelles(decisionsDeLaPartie());
      const aRembourser = scelles.filter(d => d.achat.prix > 0);
      if (aRembourser.length) {
        const decsSeries = G.ligue.decisionsSeries || (G.ligue.decisionsSeries = []);
        for (const d of aRembourser) decsSeries.push({ jour: 0, gain: d.achat.prix, rembourse: d.palier });
        const nb = aRembourser.length;
        setTimeout(() => toast(`Pack${nb > 1 ? 's' : ''} scellé${nb > 1 ? 's' : ''} non ouvert${nb > 1 ? 's' : ''} : ${nb} remboursé${nb > 1 ? 's' : ''}.`), 1800);
      }
    }
  }
  saveGame();
  majRunRogue();
}
/*
 * LE SORT DE LA RUN (S80), lu dans les résultats : 'attente' (la saison ou
 * les séries se jouent encore), 'continue' (mandat rempli), 'finie' (mandat
 * manqué), 'gagnee' (la Coupe).
 */
function sortDeLaRun() {
  const L = G.ligue;
  if (!L || !L.you || !L.calendrier || (G.journee || 0) < L.calendrier.length) return 'attente';
  const f = faitsDeLaSaison();
  if (!f.series) return 'finie';
  const s = G.rogue && G.rogue.series;
  if (!s) return 'attente';
  if (s.coupe) return 'gagnee';
  // V5 : le mandat se lit au classement de la saison régulière ; les séries ne le défont pas.
  return mandatRempli(numeroDeSaison(), { series: true, rang: f.rang, nEquipes: (L.teams || []).length, exigence: exigenceDeLaRun() }) ? 'continue' : 'finie';
}
/*
 * LA RUN AU BILAN : quelle saison, ce que le proprio voulait, et ce qui
 * vient — la saison suivante, ou une autre run. « Rejouer la saison » n'a
 * pas de sens dans une run (ce serait relancer les dés d'une saison ratée) :
 * il disparaît, et « Nouvelle partie » devient « Nouvelle run ».
 */
export function majRunRogue() {
  if (G.bonus !== 'ROGUE') return;
  const res = document.querySelector('#resultHost .result');
  if (!res) return;
  for (const id of ['replayBtn', 'againBtn']) { const b = $(id); if (b) b.hidden = true; }
  let bloc = res.querySelector('.rg-run');
  if (!bloc) { bloc = document.createElement('div'); bloc.className = 'rg-run'; res.querySelector('.result-actions')?.after(bloc); }
  const sort = sortDeLaRun();
  const n = numeroDeSaison(), M = mandatDe(n, exigenceDeLaRun()), suivant = mandatDe(n + 1, exigenceDeLaRun());
  const s = (G.rogue && G.rogue.series) || null;
  const mots = {
    attente: (() => {
      const f = faitsDeLaSaison();
      if (!f.series) return `Le proprio veut : ${M.mot}. Le but de la run : la Coupe.`;
      const ok = mandatRempli(n, { series: true, rang: f.rang, nEquipes: (G.ligue.teams || []).length, exigence: exigenceDeLaRun() });
      return `Le proprio voulait : ${M.mot} — ${ok ? 'c\'est fait, la run continuera' : `raté (${f.rang}e)`}. Les séries peuvent encore te donner la Coupe.`;
    })(),
    continue: `Mandat rempli : ${M.mot}. La run continue ; la saison ${n + 1}, le proprio voudra : ${suivant.mot}.`,
    finie: `Mandat manqué — il fallait ${M.mot}. La run est finie après ${n} saison${n > 1 ? 's' : ''}. Tes médailles, tes jalons et ton cartable restent.`,
    gagnee: `La Coupe Stanley, à la saison ${n} de la run : la run est gagnée ! Tes médailles, tes jalons et ton cartable restent.`,
  };
  bloc.className = `rg-run ${sort}`;
  bloc.innerHTML = `<div class="rg-run-tete"><span>${sort === 'gagnee' ? '🏆' : sort === 'finie' ? '🚪' : '💀'} Run ${(G.rogue && G.rogue.numero) || ''} · saison ${n}</span>
      <small>${s ? `${s.rondes} ronde${s.rondes > 1 ? 's' : ''} gagnée${s.rondes > 1 ? 's' : ''}` : ''}</small></div>
    <p class="rg-run-mot">${esc(mots[sort])}</p>
    ${sort === 'continue' ? sceneHtml(sceneDuMandat({ sort: 'rempli', fiche: { V: G.ligue.you.W || 0, D: G.ligue.you.L || 0, DP: G.ligue.you.OTL || 0 }, rang: faitsDeLaSaison().rang, equipes: (G.ligue.teams || []).length, mandat: M.mot, graine: `${G.ligue.graine}|${n}` }), { voix: true }) : ''}
    ${sort === 'continue' ? `<p class="rg-run-suite">Ton équipe se défait : un loto de tes joueurs par case (${motDesCases(gardesDeLaRun(lireMeta(), exigenceDeLaRun()).cases)}), un loto de ton cartable par case (${motDesCases(lotosDeSaison(lireMeta(), exigenceDeLaRun()).cases)}), et le reste vient de ton cartable, avec moins de ${NIVEAUX[0].nom} qu'à la saison d'avant. Chaque carte garde ses modifs. Ce qui te suit aussi : ton coach et ton personnel, tes jetons qui restent (plus ta caisse) et tes cartes rares.</p>` : ''}
    <div class="rg-run-boutons">
      ${sort === 'continue' ? `<button type="button" class="btn gold rg-suivante">▶ Saison ${n + 1} de la run</button>` : ''}
      ${sort === 'finie' || sort === 'gagnee' ? '<button type="button" class="btn gold rg-nouvelle">▶ Nouvelle run</button>' : ''}
      <button type="button" class="btn rg-vestiaire">🏅 Les déblocages · ${lireMeta().ecussons || 0}</button>
    </div>${galonsHtml()}`;
  // 1.0 (R7) : la run finie ou gagnée s'ouvre UNE fois en plein écran, avant qu'on reparte.
  if ((sort === 'finie' || sort === 'gagnee') && G.rogue && !G.rogue.taRunVue) montrerTaRun(sort, n, s);
  const b1 = bloc.querySelector('.rg-suivante');
  if (b1) b1.onclick = async () => {
    if (sortDeLaRun() !== 'continue') return;
    await choisirNouvelleEquipe(n + 1);
  };
  const b2 = bloc.querySelector('.rg-nouvelle');
  if (b2) b2.onclick = () => contexteDuMenu().rogue.nouvelle();
  bloc.querySelector('.rg-vestiaire').onclick = () => ouvrirVestiaire(() => majRunRogue());
}
/*
 * « TA RUN » (1.0, R7) : un seul écran quand la run finit — les saisons jouées,
 * la Coupe ou le mandat manqué, les écussons gagnés par la run, les jalons
 * débloqués, les cartes entrées au cartable. Tout se lit dans le méta et dans
 * `G.rogue` (comptés au moment où ils se paient), rien n'est recalculé. Le
 * méta garde le résumé (`derniereRun`) pour le carton du menu.
 */
const MOT_RONDES = ['éliminé au premier tour', 'éliminé au deuxième tour', 'éliminé en demi-finale', 'perdu en finale'];
export function motDeRun(d) {
  if (d.coupe) return 'la Coupe 🏆';
  if (!d.series) return 'sans séries';
  return MOT_RONDES[Math.min(3, d.rondes || 0)];
}
function montrerTaRun(sort, n, s) {
  const meta = lireMeta();
  const f = faitsDeLaSaison();
  const M = mandatDe(n, exigenceDeLaRun());
  const d = { numero: G.rogue.numero || meta.runs || 1, saisons: n, sort, series: !!f.series, rondes: (s && s.rondes) || 0, coupe: !!(s && s.coupe),
    ecussons: G.rogue.ecussonsRun || 0, jalons: G.rogue.jalonsRun || [], coach: G.rogue.coach || null };
  const nCartable = Object.keys(lireCartable().joueurs).length;
  const entrees = G.rogue.cartableDepart != null ? Math.max(0, nCartable - G.rogue.cartableDepart) : null;
  G.rogue.taRunVue = true;
  meta.derniereRun = d;
  // Tes runs, au Palmarès (V18-5) : une par numéro, qu'une saison rechargée ne compte pas deux fois.
  meta.lesRuns = { ...(meta.lesRuns || {}), [d.numero]: d };
  // LA VITRINE (1.0) : chaque Coupe y entre, avec ses vedettes — V9 (tranche 7) : ce qu'ils ont fait CHEZ TOI, leurs points (un gardien, ses victoires).
  const pts = p => (p.p === 'G' ? p.simW || 0 : p.simPTS || 0);
  const vedettes = sort === 'gagnee' ? Object.values((G.ligue && G.ligue.you && G.ligue.you.roster) || {}).filter(Boolean).sort((a, b) => pts(b) - pts(a)).slice(0, 3) : [];
  if (sort === 'gagnee') meta.vitrine = [...(meta.vitrine || []), { run: d.numero, saison: n, coach: G.rogue.coach || null, vedettes: vedettes.map(p => p.n) }];
  ecrireMeta(meta);
  saveGame();
  const ligne = (k, v) => `<div class="run-l"><span class="run-k">${esc(k)}</span><b class="run-v">${v}</b></div>`;
  if (sort === 'gagnee') { montrerLaCoupe(d, n, meta, vedettes, ligne, entrees, nCartable); return; }
  ouvrirChoix({
    ico: sort === 'gagnee' ? '🏆' : '🚪', titre: 'Ta run', genre: 'run', fermable: true, motFermer: 'Compris',
    irl: `Run ${d.numero} · ${n} saison${n > 1 ? 's' : ''}`,
    recit: `Mandat manqué : il fallait ${esc(M.mot)}.`,
    contexte: `${sceneHtml(sceneDuMandat({ sort: 'rate', fiche: { V: G.ligue.you.W || 0, D: G.ligue.you.L || 0, DP: G.ligue.you.OTL || 0 }, rang: f.rang, equipes: (G.ligue.teams || []).length, mandat: M.mot, graine: `${G.ligue.graine}|${n}` }), { voix: true })}
      ${galonsHtml()}
      <div class="run-bilan">
      ${ligne('Saisons jouées', n)}
      ${ligne('Le sort', esc(motDeRun(d)))}
      ${ligne('Médailles gagnées par la run', `🏅 +${d.ecussons}`)}
      ${ligne('Jalons débloqués', d.jalons.length ? esc(d.jalons.join(' · ')) : 'aucun')}
      ${entrees != null ? ligne('Cartes entrées au cartable', `📒 +${entrees}`) : ''}
      ${ligne('Ton club', `🏅 ${meta.ecussons || 0} médailles · 📒 ${nCartable} carte${nCartable > 1 ? 's' : ''}`)}
    </div>`,
    options: [], onChoix: () => {},
  });
}
/*
 * LA COUPE (1.0). JP : *gagner la coupe devrait être genre la victoire finale
 * d'une run* — elle l'était dans les règles, pas à l'écran. Un écran à elle :
 * le trophée, la run gagnée, tes trois vedettes en cartes, la place de cette
 * Coupe dans ta vitrine, la sirène et la fanfare.
 */
function montrerLaCoupe(d, n, meta, vedettes, ligne, entrees, nCartable) {
  const rang = (meta.vitrine || []).length;
  const C = COACHS[G.rogue.coach];
  jouerSon('coupe');
  ouvrirChoix({
    ico: '🏆', titre: 'La Coupe Stanley', genre: 'coupe', fermable: true, motFermer: 'Soulever la Coupe',
    irl: `Run ${d.numero} gagnée · saison ${n}`,
    recit: `Ta run est gagnée. ${rang === 1 ? 'Ta première Coupe entre dans ta vitrine.' : `Ta ${rang}e Coupe entre dans ta vitrine.`}`,
    contexte: `<div class="coupe-scene" aria-hidden="true"><span class="coupe-trophee">🏆</span></div>
      ${galonsHtml()}
      ${vedettes.length ? `<div class="dp-grille coupe-vedettes">${vedettes.map(p => `<div class="dp-carte">${carteMiniHtml(p)}<span class="dp-qui">${esc(quiEst(p))}</span></div>`).join('')}</div>` : ''}
      <div class="run-bilan">
      ${ligne('Saisons jouées', n)}
      ${C ? ligne('Ton coach', `${C.ico} ${esc(C.nom)}`) : ''}
      ${ligne('Médailles gagnées par la run', `🏅 +${d.ecussons}`)}
      ${ligne('Jalons débloqués', d.jalons.length ? esc(d.jalons.join(' · ')) : 'aucun')}
      ${entrees != null ? ligne('Cartes entrées au cartable', `📒 +${entrees}`) : ''}
      ${ligne('Ta vitrine', `🏆 ${rang} Coupe${rang > 1 ? 's' : ''}`)}
      ${ligne('Ton club', `🏅 ${meta.ecussons || 0} médailles · 📒 ${nCartable} carte${nCartable > 1 ? 's' : ''}`)}
    </div>`,
    options: [], onChoix: () => {},
  });
}
/*
 * LA SAISON SUIVANTE DE LA RUN (S80). JP : *nouvelle saison veut dire
 * continuer avec base des cartes ramassé qui sont pas des consommables*.
 * Ce qui continue, et comment :
 *   - l'ÉQUIPE SE DÉFAIT (1.0) : JP, *pas repartir avec la même équipe, mais
 *     pouvoir garder un ou des joueurs de l'ancienne équipe*. Les GARDÉS
 *     (`choisirGardesDeSaison`) passent devant ; le reste se tire du classeur
 *     (`vestiaireDeDepart`), avec moins de Soutien qu'à la saison d'avant ;
 *   - les MODIFS posées vivent sur leur carte (`modsAuCartable`) : chaque carte
 *     de l'équipe neuve rejoue les siennes au jour 0 (`reportDesCartes`) ;
 *   - les JETONS qui restent, plus la caisse du vestiaire ;
 *   - le PLAFOND est celui d'un départ de run (`plafondDeDepart`).
 * Le personnel et les cartes permanentes vivent déjà dans le méta. La POCHE
 * (Jalon Q) suit aussi : ses cartes pas jouées entrent au jour 0 de la saison
 * neuve (`poche`, une décision de report, js/inventaire.js `cartesDeLaPartie`).
 */
/*
 * LES MODIFS QUI VIVENT SUR LA CARTE (1.0, js/cartable.js `poserSurLesCartes`) :
 * améliorations, styles, contrats et éditions de l'atelier. Le physio soigne
 * une fois ; le lustre passe par la variante de la carte.
 */
// Oct. : la retouche d'un défi relevé (js/arcs.js `DEFIS`) reste sur sa carte, comme une amélioration.
const SOURCES_DURABLES = new Set(['amelioration', 'style', 'atelier', 'contrat', 'defi']);
function modsAuCartable() {
  const you = G.ligue && G.ligue.you;
  if (G.bonus !== 'ROGUE' || !you) return;
  const par = {};
  for (const m of you.mutations || []) {
    const M = MUTATIONS[m.cle];
    if (!M || !SOURCES_DURABLES.has(M.source) || m.cle === 'physio' || M.lustre || !m.joueur || m.saison) continue;
    (par[m.joueur] = par[m.joueur] || []).push(m.cle);
  }
  poserSurLesCartes(par);
  // Une édition montée (le pinceau, la fenêtre, la dorure, le lustre) devient la sienne, au cartable.
  const lustres = decisionsDeLaPartie().filter(d => d.mutation && MUTATIONS[d.mutation.cle] && MUTATIONS[d.mutation.cle].lustre && d.mutation.carte).map(d => ({ cle: d.mutation.joueur, rar: d.mutation.carte.rar }));
  if (lustres.length) ajouterAuCartable(lustres, { doublons: false });
}
/* Ce que les cartes de l'équipe portent, rejoué au jour 0 de la saison (des décisions `report`, comme le deck). */
function reportDesCartes(roster) {
  const c = lireCartable();
  const out = [];
  for (const p of Object.values(roster).filter(Boolean)) {
    const k = getPlayerKey(p);
    for (const cle of modsDe(k, c)) if (MUTATIONS[cle]) out.push({ jour: 0, mutation: { cle, joueur: k }, report: true });
  }
  return out;
}
/*
 * CEUX QUI RESTENT (JP, 24 oct. : *la saison suivante me permettait de prendre cinq joueurs, c'est brisé*) : les
 * cases de `gardesDeLaRun` (js/rogue.js), chacune un loto de trois joueurs de ton équipe de la saison finie, d'un
 * niveau ; leurs salaires ensemble dans le budget du classeur. Ton joueur de concession reste à part, sans loto :
 * il ouvre la liste rendue.
 */
async function choisirGardesDeSaison(saison) {
  const meta = lireMeta();
  const vedette = meta.vedette ? signes().find(p => p && getPlayerKey(p) === meta.vedette) : null;
  const equipe = signes().filter(p => p && p !== vedette);
  const cartes = await Promise.all(equipe.map(async p => ({ cle: getPlayerKey(p), p, niveau: niveauDe(p, (await getShard(p.s)).players) })));
  const R = gardesDeLaRun(meta, exigenceDeLaRun());
  const gardes = await lotosParCase({
    cases: R.cases, vues: R.vues, cartes, graine: `${graineDuClasseur()}:g${saison}`, budget: budgetDuClasseur(meta),
    personnes: new Set(vedette ? [getPersonKey(vedette)] : []), qui: p => [quiEst(p), histoireCourte(p)].filter(Boolean).join(' · '),
    textes: ({ i, n, k, niveau, vus, dernier }) => ({
      ico: '🤝', titre: `Ceux qui restent · ${nomDeCase(k)}`, irl: `Saison ${saison} de la run${n > 1 ? ` · case ${i + 1} de ${n}` : ''}`,
      recit: `${motDeLaDescente(k, niveau, 'joueur')}Ton équipe se défait. Le loto tire ${vus} de tes joueurs ${nomDeCase(niveau)} : garde-en un, ou laisse-les partir.`,
      budget: '🤝 Budget des gardés', plein: 'Tu gardes déjà ton joueur de ce loto',
      partir: pris => (pris ? (dernier ? `Saison ${saison}` : 'Loto suivant') : 'Les laisser partir'),
    }),
  });
  return [...(vedette ? [vedette] : []), ...gardes.map(x => x.p)];
}
/*
 * LE LOTO DU CARTABLE (Jalon Q). JP : *présentement, la grosse liste, ça suce, faque je dirais x loto à même mes
 * joueurs*. Entre deux saisons, plus de repêchage de cinquante cartes : les cases de `lotosDeSaison` (js/rogue.js),
 * chacune un loto de TON cartable, sous le budget du classeur moins tes gardés, dont tu signes une carte, ou
 * aucune. Le reste de l'équipe se tire du cartable comme au départ d'une run (`vestiaireDeDepart`), comme le robot
 * le joue (scripts/lib/rogue_sim.mjs). Le tirage est pur (la graine du classeur, la saison, la case).
 */
async function lotoDuCartable(gardes = [], saison = 2) {
  const meta = lireMeta();
  const L = lotosDeSaison(meta, exigenceDeLaRun());
  const budget = budgetDuClasseur(meta) - gardes.reduce((a, p) => a + (p.$ || 0), 0);
  if (!L.n || budget <= 0 || !Object.keys(lireCartable().joueurs).length) return [];
  const cartes = await sousVoile('On brasse le loto…', cartesDuCartable);
  const pris = await lotosParCase({
    cases: L.cases, vues: L.vues, cartes, graine: `${graineDuClasseur()}:s${saison}`, budget, personnes: new Set(gardes.map(getPersonKey)), qui: p => quiEst(p),
    textes: ({ i, n, k, niveau, vus, dernier }) => ({
      ico: '🎰', titre: `Le loto du cartable · ${nomDeCase(k)}`, irl: `Saison ${saison} de la run · ${i + 1} de ${n}`,
      recit: `${motDeLaDescente(k, niveau, 'carte')}Le loto tire ${vus} carte${vus > 1 ? 's' : ''} ${nomDeCase(niveau)} de ton cartable : signes-en une, ou passe. Ton cartable comble le reste.`,
      budget: '🎰 Budget des lotos', plein: 'Tu as ta carte de ce loto',
      partir: k2 => (k2 ? (dernier ? 'À la saison' : 'Loto suivant') : 'Passer ce loto'),
    }),
  });
  return pris.map(x => x.p);
}
/* LA SAISON SUIVANTE : ceux qui restent, les lotos du cartable, puis le vestiaire tiré du cartable et le coach. */
async function choisirNouvelleEquipe(saison) {
  const gardes = await choisirGardesDeSaison(saison);
  const lotos = await lotoDuCartable(gardes, saison);
  const coach = await choisirCoachDeSaison(saison);
  await sousVoile('La saison suivante se prépare…', () => continuerRun(gardes, lotos, coach));
}
async function continuerRun(gardes = [], lotos = [], coachSaison = null) {
  if (G.bonus !== 'ROGUE' || !G.ligue || sortDeLaRun() !== 'continue') return;
  const L = G.ligue, meta = lireMeta();
  const saison = numeroDeSaison() + 1;
  // Ton joueur de concession reste d'une saison à l'autre, sans prendre la place d'un gardé.
  const vedette = meta.vedette ? signes().find(p => p && getPlayerKey(p) === meta.vedette) : null;
  if (vedette && !gardes.includes(vedette)) gardes = [vedette, ...gardes];
  const partants = new Set(signes().filter(Boolean).map(getPlayerKey).filter(k => !gardes.some(p => getPlayerKey(p) === k)));
  // Les gardés et les cartes des lotos passent devant ; le reste se tire du cartable (`vestiaireDeDepart`).
  const fixes = [...gardes, ...lotos];
  const V = await vestiaireDeDepart(meta, fixes, { saison, rang: G.rogue.prestige || 0, exclus: partants, graine: `${graineDuClasseur()}:s${saison}`, exigence: exigenceDeLaRun() });
  for (const x of [...V.tires, ...lotos.map(p => ({ cle: getPlayerKey(p) }))]) G.variantes.cartes[x.cle] = meilleureVariante(lireCartable().joueurs[x.cle]);
  const roster = V.roster;
  // Les modifs de la saison sont déjà sur leurs cartes (`modsAuCartable`, à la fin de la saison) : chaque carte de l'équipe neuve rejoue les siennes.
  modsAuCartable();
  const report = reportDesCartes(roster);
  for (const p of gardes) G.variantes.cartes[getPlayerKey(p)] = meilleureVariante(lireCartable().joueurs[getPlayerKey(p)]) || G.variantes.cartes[getPlayerKey(p)];
  // v2 : les COACHS continuent — le compte de la fin de saison (V20 : ses blocs tenus compris), et la confiance qu'il avait allumée.
  const decsSaison = decisionsDeLaPartie();
  const compte = buildDe(decsSaison, Infinity, { tenus: tenusDe(L.calendrier, L.you) });
  report.push({ jour: 0, coachsDeBase: Object.fromEntries(Object.entries(compte).filter(([, n]) => n > 0)), report: true });
  const [enPoste] = coachsActifs(decsSaison);
  if (enPoste && (!coachSaison || coachSaison === enPoste.cle)) { const { jour: _j, ...coach } = enPoste; void _j; report.push({ jour: 0, coach, report: true }); }
  // Un autre coach choisi pour la saison neuve (V5) : il repart à la confiance I.
  else if (coachSaison && COACHS[coachSaison]) { report.push({ jour: 0, ...coachNeuf(coachSaison), report: true }); G.rogue.coach = coachSaison; }
  // 1.0 : un patron engagé l'est pour la RUN — il reste en poste à la saison suivante, avec ses chiffres.
  // V14 : avec son échelon, ses choix et ses matchs à ton service, qui repartent de là (js/echelons.js `reportDuPersonnel`).
  const gens = new Map(etatPersonnel(Infinity).map(e => [e.cle, e]));
  // V16 : un adjoint à protégé le garde (le même joueur s'il est encore là, à l'échelon de l'adjoint), sinon le moteur en désigne un.
  const protegeDe = (cle, choix = []) => {
    const d = [...decsSaison].reverse().find(x => x && x.mutation && x.mutation.cle === cle), k = d && d.mutation.joueur;
    return { cle, ...(k && Object.values(roster).some(p => p && getPlayerKey(p) === k) ? { joueur: k } : {}), saison: true, ...(choix.length ? { canaux: protegeALEchelon(cle, choix) } : {}), ...(lignesDuFeu(cle, choix) ? { lignes: lignesDuFeu(cle, choix) } : {}) };
  };
  for (const pa of patronsActifs(decsSaison)) {
    const { jour: _j, remplace: _r, ...patron } = gens.has(pa.cle) ? reportDuPersonnel(gens.get(pa.cle)) : pa; void _j; void _r;
    report.push({ jour: 0, patron, ...(PROTEGES[pa.cle] ? { mutation: protegeDe(pa.cle, patron.choix || []) } : {}), report: true });
  }
  // Jalon Q : les cartes de la partie te suivent — celles pas jouées passent à la saison suivante (la clé `poche` reste, pour les sauvegardes).
  const poche = cartesDeLaPartie({ decisions: decsSaison, rogue: true }).map(x => x.id);
  if (poche.length) report.push({ jour: 0, poche, report: true });
  // V9 (tranche 6) : une commotion se garde — d'une saison à l'autre de la run, la suivante s'allonge (`COMMOTION_MEMOIRE`, js/sim.js).
  const commotions = { ...((decsSaison.find(d => d && d.commotions) || {}).commotions || {}) };
  for (const b of (L.you && L.you.injuriesLog) || []) if (b.genre === 'commotion') commotions[getPlayerKey(b.player)] = (commotions[getPlayerKey(b.player)] || 0) + 1;
  if (Object.keys(commotions).length) report.push({ jour: 0, commotions, report: true });
  // V9 (tranche 7) : les galons de la run — un palier de badge chacun, `GALONS_MAX` au plus (js/galons.js).
  const run = G.rogue.numero || 0;
  const galons = Object.fromEntries(Object.values(roster).filter(Boolean).map(p => [getPlayerKey(p), Math.min(GALONS_MAX, galonsDe(getPlayerKey(p), run).length)]).filter(([, n]) => n > 0));
  if (Object.keys(galons).length) report.push({ jour: 0, galons, report: true });
  // Les packs scellés pas ouverts passent à la saison suivante, déjà payés.
  packsScelles(decsSaison).forEach((d, i) => report.push({ jour: 0, palier: `k:r${i}`, achat: { pack: d.achat.pack, n: -1 - i, prix: 0, sorte: d.achat.sorte, params: d.achat.params, scelle: true }, report: true }));
  const reste = Math.max(0, jetonsRogue(L.calendrier.length));
  G.renfort = null; G.selectedSlot = null;
  G.roster = roster; poserCartes();
  G.rogue = {
    ...G.rogue, saison, series: null, report,
    depart: jetonsDeDepart(meta) + reste, reserves: reservesDeLaRun(meta), bareme: baremeRogue(meta, exigenceDeLaRun()), plafond: null,
  };
  // La saison neuve : ni ligue, ni séries, ni entrée d'historique — `runSeason` les refera.
  G.ligue = null; G.done = false; G.journee = 0; G.seriesVues = null; G.lbId = null; G.series = null; G.seriesMoteur = null; G.banc = null;
  // Le vrai plafond à chaque saison (oct., JP : *je m'en crisse si j'ai du lousse à mes runs suivantes*).
  G.rogue.plafond = plafondDeDepart(meta, exigenceDeLaRun(), { reel: true });
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  $('game').classList.remove('bilan');
  saveGame(); render();
  setView('roster');
  const motEquipe = `${motDuVestiaire(V).toLowerCase()}${gardes.length ? `, avec ${gardes.map(p => p.n).join(', ')}` : ''}${lotos.length ? `, ${lotos.length} carte${lotos.length > 1 ? 's' : ''} du loto` : ''}`;
  toast(`Saison ${G.rogue.saison} de la run : ${motEquipe}, et 🪙 ${G.rogue.depart} jetons. Le proprio veut : ${mandatDe(G.rogue.saison, exigenceDeLaRun()).mot}.`);
}
/*
 * LE VESTIAIRE DES DÉBLOCAGES : ce que les écussons achètent, d'une run à
 * l'autre — et les JALONS (S80), l'autre façon de débloquer : chacun paie une
 * fois, un déblocage offert ou des écussons.
 */
/*
 * TON CLUB (1.0, oct.). JP : *que les couleurs, le nom de notre équipe puis des logos, ce soient des
 * choses qu'on débloque au fur et à mesure*. L'écusson porté en grand, puis chaque club (son nom et son
 * écusson, ensemble : Jalon U) et chaque couleur, montrés aux couleurs portées : ce que tu as se porte d'un toucher ; le reste s'achète en
 * jetons 🪙 à la boutique, comme un pack (JP : *même monnaie que les autres packs*), et les plus beaux
 * attendent un rang de prestige (js/club.js). Rien n'y change le jeu.
 */
/* Le club a changé : son nom, l'en-tête, et les couleurs de l'interface si c'est ton équipe qu'on regarde. */
function clubChange() {
  poserLeClub();
  if (!enRepechage()) applyTeamColors('YOU');
  majEntete();
}
function ouvrirClub(apres = null, onglet = 'club') {
  const meta = lireMeta(), c = choixDuClub(meta);
  // Deux onglets (les clubs, chacun son nom et son écusson ; cinquante couleurs) : ce qui est à toi d'abord.
  const R = RAYONS_CLUB.find(x => x.cle === onglet) || RAYONS_CLUB[0];
  const onglets = `<div class="stat-tabs" role="tablist">${RAYONS_CLUB.map(x => {
    const a = Object.keys(x.liste).filter(k => possede(meta, x.cle, k)).length;
    return `<button type="button" role="tab" class="stat-tab${x === R ? ' on' : ''}" aria-selected="${x === R}" data-onglet="${x.cle}">${esc(x.titre)} · ${a}/${Object.keys(x.liste).length}</button>`;
  }).join('')}</div>`;
  const options = Object.entries(R.liste).map(([k, o]) => {
    const porte = c[R.cle] === k, a = possede(meta, R.cle, k);
    const garde = o.rang && rangDePrestige(meta) < o.rang ? `Prestige : ${PRESTIGES[o.rang].nom}` : '';
    return { cle: `${R.cle}:${k}`, visage: ecussonDe({ ...c, [R.cle]: k }), a,
      nom: `${o.nom}${porte ? ' ✓' : a ? '' : ` · ${o.prix} 🪙`}`,
      desactive: porte ? 'Porté' : a ? null : garde || 'À la boutique, rayon « Ton club »' };
  }).sort((x, y) => y.a - x.a);
  ouvrirChoix({
    ico: '🏅', titre: 'Ton club', fermable: true, motFermer: 'Retour aux déblocages',
    contexte: `<div class="club-porte"><span class="club-ecu" aria-hidden="true">${ecussonDe(c)}</span><b>${esc(nomDuClub())}</b></div>${onglets}`,
    compact: true,
    options: options.map(({ a: _a, ...o }) => o),
    onChoix: cle => {
      const [r, k] = cle.split(':');
      if (porter(r, k)) clubChange();
      ouvrirClub(apres, r);
    },
    onFerme: () => ouvrirVestiaire(apres),
  });
  document.querySelectorAll('#choixModal [data-onglet]').forEach(b => { b.onclick = () => ouvrirClub(apres, b.dataset.onglet); });
}

/*
 * LE PALMARÈS DU CLUB (V18-5, docs/ecrans-rogue.md ; EHM : l'histoire du club) : Ligue › Palmarès, en Rogue. Ta vitrine
 * (tes Coupes), le panthéon (les records, les chandails retirés, les trophées) et tes runs. Ils vivaient aux déblocages ;
 * le Palmarès du Rogue montrait l'historique du 82-0.
 */
export function palmaresDuClubHtml() {
  const meta = lireMeta();
  // 1.0 : LA VITRINE — tes Coupes, la run, la saison, le coach et les vedettes.
  const vitrine = (meta.vitrine || []).length ? `<p class="vs-sec">🏆 Ta vitrine · ${meta.vitrine.length} Coupe${meta.vitrine.length > 1 ? 's' : ''}</p>
    <div class="vs-jalons">${meta.vitrine.slice().reverse().map(V => `<div class="vs-jalon fait"><span class="vs-ico" aria-hidden="true">🏆</span><b>Run ${V.run} · saison ${V.saison}${COACHS[V.coach] ? ` · ${COACHS[V.coach].ico} ${esc(COACHS[V.coach].nom)}` : ''}</b><span>${esc((V.vedettes || []).join(' · '))}</span></div>`).join('')}</div>` : '';
  /*
   * LE PANTHÉON (V9, tranche 7 — js/rogue.js `graverAuPantheon`) : les records d'une saison chez toi, les trophées de
   * tes joueurs, les chandails retirés. Les mêmes rangées que la vitrine.
   */
  const P = meta.pantheon || { records: {}, trophees: [], chandails: [] };
  const quand = x => `run ${x.run}, saison ${x.saison}`;
  const recs = [...Object.entries(RECORDS).filter(([k]) => P.records[k]).map(([k, R]) => ({ nom: R.nom, x: P.records[k], qui: P.records[k].nom })),
    ...(P.records.club ? [{ nom: 'Points du club en une saison', x: P.records.club, qui: '' }] : [])];
  const rangee = (ico, titre, texte) => `<div class="vs-jalon fait"><span class="vs-ico" aria-hidden="true">${ico}</span><b>${esc(titre)}</b><span>${esc(texte)}</span></div>`;
  const pantheon = recs.length || P.trophees.length || P.chandails.length ? `<p class="vs-sec">Le panthéon</p>
    <div class="vs-jalons">${recs.map(r => rangee('📈', `${r.nom} : ${r.x.n}`, [r.qui, quand(r.x)].filter(Boolean).join(' · '))).join('')}
      ${P.chandails.map(c => rangee('👕', `Chandail retiré : ${c.nom}`, `${c.galons} galons · ${quand(c)}`)).join('')}
      ${P.trophees.slice().reverse().slice(0, 12).map(t => rangee('🏆', t.nom, `${t.joueur} · ${t.val} · ${quand(t)}`)).join('')}</div>` : '';
  const runs = Object.values(meta.lesRuns || (meta.derniereRun ? { 1: meta.derniereRun } : {})).sort((a, b) => b.numero - a.numero);
  const enCours = G.rogue && G.rogue.numero && !G.rogue.taRunVue ? rangee('▶', `Run ${G.rogue.numero} · saison ${G.rogue.saison || 1}`, 'En cours') : '';
  const lesRuns = enCours || runs.length ? `<p class="vs-sec">🗂 Tes runs · 🏆 ${meta.coupes || 0}</p>
    <div class="vs-jalons">${enCours}${runs.map(d => rangee(d.coupe ? '🏆' : '🏁', `Run ${d.numero} · ${d.saisons} saison${d.saisons > 1 ? 's' : ''}${COACHS[d.coach] ? ` · ${COACHS[d.coach].ico} ${COACHS[d.coach].nom}` : ''}`,
      `${motDeRun(d)} · 🏅 +${d.ecussons || 0}`)).join('')}</div>` : '';
  return `${vitrine}${pantheon}${lesRuns}` || '<div class="empty-msg">Rien de gravé encore : tes Coupes, tes records et tes runs viendront ici.</div>';
}

export function ouvrirVestiaire(apres = null) {
  const meta = lireMeta();
  // v2 : LE PRESTIGE DU CLUB (js/rogue.js) — l'échelle entière, ce qui est atteint et ce qu'il faut pour la suite.
  const rang = rangDePrestige(meta), vie = ecussonsAVie(meta);
  const jalonDe = k => (JALONS.find(J => J.cle === k) || {}).nom || k;
  // Les exigences (tranche 8) : le plus haut cran ouvert, une fois la première Coupe gagnée.
  const ouvertes = exigencesOuvertes(meta);
  const prestige = `<p class="vs-sec">📈 Le prestige du club · ${esc(PRESTIGES[rang].nom)} · 🏅 ${vie} gagnés à vie${ouvertes ? ` · ${ICO_EXIGENCE} exigences ouvertes jusqu'au cran ${ouvertes}` : ''}</p>
    <div class="vs-jalons">${PRESTIGES.map((P, k) => {
      const fait = k <= rang;
      const quoi = `Étoiles ×${String(P.etoile).replace('.', ',')} · Phénomènes ×${String(P.phenomene).replace('.', ',')}${P.classeur ? ` · classeur +${money(P.classeur)}` : ''}`;
      return `<div class="vs-jalon${fait ? ' fait' : ''}"><span class="vs-ico" aria-hidden="true">${fait ? '✓' : k}</span><b>${esc(P.nom)}</b><span>${fait ? esc(quoi) : `${P.min} 🏅 à vie${P.jalon ? ` et « ${esc(jalonDe(P.jalon))} »` : ''} → ${esc(quoi)}`}</span></div>`;
    }).join('')}</div>`;
  const jalons = `${prestige}<p class="vs-sec">🏁 Les jalons · ${JALONS.filter(J => (meta.jalons || {})[J.cle]).length} / ${JALONS.length}</p>
    <div class="vs-jalons">${JALONS.map(J => {
      const fait = !!(meta.jalons || {})[J.cle];
      return `<div class="vs-jalon${fait ? ' fait' : ''}"><span class="vs-ico" aria-hidden="true">${J.ico}</span><b>${esc(J.nom)}</b><span>${fait ? '✓ Atteint' : `${esc(J.texte)} → ${esc(recompenseDe(meta, J).mot)}`}</span></div>`;
    }).join('')}</div>
    <p class="vs-sec">🏅 Les déblocages</p>`;
  ouvrirChoix({
    ico: '🏅', titre: `Les déblocages · ${meta.ecussons || 0} médailles`, fermable: true, motFermer: 'Fermer',
    recit: `Tes médailles se gagnent à chaque saison : une par tranche de deux points, dix par ronde de séries gagnée, vingt de plus pour la Coupe. Les jalons se gagnent en jouant. Ce que tu débloques reste pour toutes les runs.`,
    contexte: jalons,
    options: [{ cle: 'club', visage: ecussonDe(choixDuClub(meta)), nom: `Ton club : ${nomDuClub()}`, bon: 'Le club (son nom et son écusson) et ses couleurs : ceux que tu portes, et ceux qui se débloquent.' },
      // V10 : le cran d'un pack se montre quand le pack est ouvert, et le second après le premier.
      ...Object.entries(DEBLOCAGES).filter(([, D]) => !D.pack || (packsOuverts(meta)[D.pack] === true && (!D.requis || aDebloque(meta, D.requis)))).map(([k, D]) => {
      const pris = aDebloque(meta, k);
      const manque = D.requis && !aDebloque(meta, D.requis) ? `Demande d'abord : ${DEBLOCAGES[D.requis].nom}` : null;
      return { cle: k, ico: D.ico, nom: `${D.nom}${pris ? ' ✓' : ` · ${D.prix} 🏅`}`, bon: D.texte,
        desactive: pris ? 'Débloqué' : manque || ((meta.ecussons || 0) < D.prix ? `Il te manque ${D.prix - (meta.ecussons || 0)} 🏅` : null) };
    })],
    onChoix: k => {
      if (k === 'club') { ouvrirClub(apres); return; }
      if (peutAcheter(lireMeta(), k) && acheterDeblocage(k)) toast(`${DEBLOCAGES[k].ico} ${DEBLOCAGES[k].nom} : débloqué.`);
      ouvrirVestiaire(apres);
      if (apres) apres();
    },
  });
}

