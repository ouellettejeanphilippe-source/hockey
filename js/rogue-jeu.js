/*
 * LE MODE ROGUE DANS LE JEU (sorti de js/game.js en 1.0) : les jetons, la
 * boutique et ses packs, l'inventaire et les cartes qu'on joue, le départ du
 * classeur, la run d'une saison à l'autre, le vestiaire des déblocages. La
 * règle et le méta vivent dans js/rogue.js ; ici, ce que l'écran en fait.
 */

import { lireMeta, GARDES_DE_SAISON, COMPOSITION_DEPART, SOUTIENS_DEPART, soutiensDuDepart, estSoutien, tirageDuDepart, PRIME_DECOUVERTE, JETONS, jetonsDe, aDebloque, DEBLOCAGES, ajouterCollection, recevoirPermanents, retirerDuMeta, nombreGardes, departDuClasseur, jetonsDeDepart, reservesDeLaRun, ecrireMeta, budgetDuClasseur, tirageDuClasseur, baremeRogue, mandatDe, PLAFOND_ROGUE, plafondDuVestiaire, ESPACE_DE_DEPART, payerEcussons, ecussonsDeLaSaison, payerJalons, ecussonsDesSeries, mandatRempli, JALONS, recompenseDe, peutAcheter, acheterDeblocage, PRESTIGES, rangDePrestige, ecussonsAVie, coachsOuverts, postesDePatron } from './rogue.js';
import { money, esc, hache } from './util.js';
import { getPlayerKey, getPersonKey, SLOTS, MUTATIONS, autoRoster, fits, getHiddenRatings, getPositionPenalty, nouvelleGraine, REROLLS, TACTIQUES, joueursDesCoachs, coachDuJoueur, JOURS_PAR_MATCH, matchsEntre } from './sim.js';
import { modificateurs, BANQUE, CATEGORIES, VIES, reglesDe, PATRONS, patronsActifs, patronsDeDepart, ROLES, payloadDe, CONSOMMABLES, CONTRATS, etiquetteBanque, buildDe, coachsActifs, reglesDePalier, idsDuCoach } from './banque.js';
import { COACHS, ORDRE_COACHS, VOIES, SEUILS } from './coachs.js';
import { motsDeMutationEnChiffres } from './impact.js';
import { PACKS_TOUS, packsSansHolo, packDuJour, tirerJoueursDuPack, PITIE, tirerCartesPack, coachDuPack, DATE_LIMITE_MATCH } from './packs.js';
import { ouvrirMagasin } from './magasin.js';
import { FRANCHISES } from './franchises.js';
import { state } from './data.js';
import { VENTE, valeurDe, ouvrirInventaire, pocheDeLaPartie } from './inventaire.js';
import { ajouterAuCartable, lireCartable, meilleureVariante, decouvrir, cartesJouees, marquerJouees, poserSurLesCartes, modsDe, ajouterLegendesAuCartable, LEGENDES } from './cartable.js';
import { ouvrirChoix, optionDeCarteMatch, puces, ouvrirAlignement } from './gerant.js';
import { traitsDeCarte, carteDe } from './rarete.js';
import { PHENOMENE, niveauDe, NIVEAUX } from './niveaux.js';
import { artJoueur, photoAction } from './cartes.js';
import { getTeamLogoHtml } from './logos.js';
import { deckDe, CARTES_MATCH } from './combat.js';
import { ageAtSeason } from './ratings.js';
import { ouvrirDepartClasseur } from './depart.js';
import { jouerSon } from './sons.js';
import { nombreEnSeries } from './bilan.js';
import { $, G, applyTeamColors, candidats, capHit, capLeft, capUsed, clearSave, contexteDuMenu, enRepechage, headshotHtml, isPicked, majEntete, plafondEffectif, poserLeClub, quiEst, render, saveGame, setView, signes, toast, totalCases } from './game.js';
import { RAYONS_CLUB, choixDuClub, possede, porter, ecussonDe, nomDuClub, offresDuClub, prendre } from './club.js';
import { apercuJoueur, carteMiniHtml, etatPourPoser, getShard, ligneDe, ligneDuChoix, niveauHorsRuban, ouJoue, ouvrirVersoPourPoser, poserCartes, quiSortOuCaseLibre, rangeesAlignement, rareteJoueur } from './repechage.js';
import { POSTE_GROUPE, ballottageVu, groupeDe, sousVoile } from './banc.js';
import { syncOptionsUI } from './partie.js';

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
  const gros = ((toi && toi.minisBoss) || []).filter(mb => mb.gagne && mb.jour < j).length;
  // Un objectif du proprio réussi, c'est une carte prise à son verdict (`v:`).
  const objectifs = (L.decisions || []).filter(d => typeof d.palier === 'string' && d.palier.startsWith('v:') && d.carte).length;
  // 1.0 (J1-C) : les rondes de séries gagnées (`finDesSeriesRogue` les pose) — la prime `JETONS.serie` se verse enfin.
  const series = (G.rogue && G.rogue.series && G.rogue.series.rondes) || 0;
  return { W, L: D, OTL: P, gros, objectifs, series };
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
export function jetonsRogue(j = G.journee || 0) {
  const L = G.ligue;
  const decs = decisionsDeLaPartie();
  // 1.0 (J1-D) : une réclamation au ballottage coûte des jetons en Rogue (`ballottage.cout`).
  const depenses = decs.reduce((a, d) => a + ((d.achat || d.rogue || {}).prix || 0) + ((d.plafond || {}).cout || 0) + ((d.ballottage || {}).cout || 0), 0);
  // Un doublon signé (1.0, oct.) n'est pas revendu : sa vente, comptée à l'ouverture, se retire (`annuleVente`).
  const ventes = decs.reduce((a, d) => a + ((d.achat || {}).vente || 0) + (d.gain || 0) + ((d.vend || {}).jetons || 0) - (d.annuleVente || 0), 0);
  const direction = modificateurs(decs).jetonsVictoire.reduce((a, x) => a + x.n * victoiresEntre(x.depuis, j), 0);
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
/* Le plus gros salaire qu'un pack peut tirer : l'espace, plus le plus gros « cap hit » qu'une sortie libérerait. */
function salaireMaxDePack() {
  const pl = G.ligue ? plafondEffectif() : null;
  return capLeft() + Math.max(0, ...signes().map(q => (pl ? capHit(q, pl) : q.$ || 0)));
}
const VERROUS_ROGUE = { 'j:defensif': 'packDefenseurs', 'j:gardien': 'packGardiens', 'j:ere80': 'packAnnees80', 'j:etoiles': 'packVedettes', 'j:legendes': 'packVedettes' };
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
function packsOuvertsBoutique(j = 0) {
  const meta = G.bonus === 'ROGUE' ? lireMeta() : null;
  const limite = apresDateLimite(j);
  return Object.fromEntries(Object.keys(PACKS_TOUS).map(k => {
    if (limite && PACKS_TOUS[k].sorte === 'joueurs') return [k, `La date limite des échanges est passée (${DATE_LIMITE_MATCH}e match)`];
    const d = meta && VERROUS_ROGUE[k];
    return [k, !d || aDebloque(meta, d) ? true : `Débloque « ${DEBLOCAGES[d].nom} » aux déblocages`];
  }));
}
export function ouvrirBoutique(j, decider, page) {
  const decs = decisionsDeLaPartie();
  const n = decs.filter(d => d.achat || d.rogue).length;
  ouvrirMagasin({
    ...(page || {}),
    jetons: jetonsRogue(j), mode: G.bonus === 'ROGUE' ? 'rogue' : 'saison', ouverts: packsOuvertsBoutique(j),
    mods: modsDesPacks(decs, j), sansHolo: G.bonus === 'ROGUE' ? packsSansHolo(decs) : 0, plafond: plafondPourBoutique(),
    duJour: packDuJour(new Date(), packsOuvertsBoutique(j)),
    // 1.0 (R5) : à la première run, avant le 20e match, quatre packs ; « Voir les N packs » montre tout.
    // Le vrai calendrier (1.0, oct.) : le 20e match tombe vers le jour 45 (20 × 186 / 82).
    debutant: G.bonus === 'ROGUE' && ((G.rogue && G.rogue.numero) || 1) <= 1 && j < Math.round(20 * JOURS_PAR_MATCH),
    franchises: Object.entries(FRANCHISES).map(([cle, F]) => ({ cle, nom: F.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    saisons: state.index.seasons.slice().reverse(),
    // v2 : le pack du coach propose ton coach en premier.
    coachs: ORDRE_COACHS.map(k => ({ cle: k, nom: `${COACHS[k].ico} ${COACHS[k].nom}` })), coachRun: (G.rogue && G.rogue.coach) || null,
    acheter: (cle, { prix, params, scelle = false }) => {
      const P = PACKS_TOUS[cle];
      if (scelle) {
        decider({ jour: j, palier: `k:${n}`, achat: { pack: cle, n, prix, sorte: P.sorte, params, scelle: true } });
        toast(`${P.ico} ${P.nom} : scellé, à ouvrir quand tu veux.`);
        return;
      }
      const suite = P.sorte === 'cartes' ? ouvrirPackCartes(cle, prix, j, n, decider, params) : ouvrirPackJoueurs(cle, prix, params, j, n, decider);
      Promise.resolve(suite).catch(() => toast('Impossible d\'ouvrir ce pack : une saison n\'a pas pu se charger.', 'bad'));
    },
    // LES PACKS SCELLÉS : payés, à ouvrir quand on veut — le tirage se fait à l'ouverture, au numéro d'achat suivant.
    /* TON CLUB (1.0, oct.) : les noms, les couleurs et les écussons, payés en jetons comme un pack — par une
       décision d'achat (`sorte: 'club'`), que la partie rejoue et que `jetonsRogue` compte. Le méta le garde. */
    club: offresDuClub(),
    acheterClub: (cle, prix) => {
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
      const suite = PACKS_TOUS[pack].sorte === 'cartes' ? ouvrirPackCartes(pack, 0, j, n, decider, params || {}, palier) : ouvrirPackJoueurs(pack, 0, params || {}, j, n, decider, palier);
      Promise.resolve(suite).catch(() => toast('Impossible d\'ouvrir ce pack : une saison n\'a pas pu se charger.', 'bad'));
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
    libre: p => p.$ > 0 && p.$ <= salaireMax && !dansLaLigue.has(getPersonKey(p)) && !isPicked(p),
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
  const meilleure = ['legendaire', 'rare', 'peu', 'commune'].find(r => cartes.some(x => x.rar === r)) || 'commune';
  const achat = { pack: cle, n, prix, sorte: 'joueurs', params: reglage, meilleure, vente, ...(vendus.length ? { vendus } : {}), ...(pitie ? { pitie: true } : {}), ...(de ? { de } : {}) };
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
  ajouterCollection({ joueurs: cartes.map(x => getPlayerKey(x.p)) });
  ajouterAuCartable(cartes.map(x => ({ cle: getPlayerKey(x.p), rar: x.rar, num: x.num || null })));
  offrirPackJoueurs({ cle, cartes, reglage, pitie, vente, n, j, decider });
}
/* Un achat enregistré sans signature (la page rechargée en plein choix) : le même tirage, à choisir. */
export async function rouvrirPackJoueurs(achat, j, decider) {
  const decs = decisionsDeLaPartie();
  const mods = modsDesPacks(decs, j);
  const { cartes, reglage } = await tirerPackJoueurs(achat.pack, achat.n, achat.params || {}, mods, !!achat.pitie);
  cartes.forEach((x, t) => { x.doublon = (achat.vendus || []).includes(t); });
  offrirPackJoueurs({ cle: achat.pack, cartes, reglage, pitie: !!achat.pitie, vente: achat.vente || 0, n: achat.n, j, decider });
}
/* Le même homme est-il déjà dans ton équipe (n'importe quelle saison de lui) ? */
const dejaChezToi = p => Object.values(G.roster || {}).some(q => q && getPersonKey(q) === getPersonKey(p));
/* Le paquet se déchire (js/gerant.js) ; on en signe UN (« Signer », puis QUI SORT — `choisirQuiSort`), ou personne. */
function offrirPackJoueurs({ cle, cartes, reglage, pitie, vente, n, j, decider }) {
  const P = PACKS_TOUS[cle];
  const palier = `k:${n}:signe`;
  for (const x of cartes) ballottageVu.set(getPlayerKey(x.p), x.p);
  const titre = `${P.nom}${reglage.franchise ? ` · ${FRANCHISES[reglage.franchise].nom}` : reglage.saison ? ` · ${reglage.saison}` : reglage.club ? ` · ${reglage.club}` : ''}`;
  const offrir = () => ouvrirChoix({
    ico: P.ico, titre, cartes: true, genre: 'recompense', fermable: true, motFermer: 'Plus tard',
    recit: `${cartes.length} vrais joueurs${pitie ? ' — la garantie a joué : une holo, au moins' : ''}. Tu en signes un, et tu choisis qui lui laisse sa place ; les autres vont à ton cartable. Plus tard : l'offre attend dans ta boîte jusqu'à la fin de la journée.${vente ? ` Les doublons se revendent : +${vente} 🪙.` : ''}`,
    options: cartes.map(x => {
      const g = groupeDe(x.p);
      const bonus = traitsDeCarte(carteDe(x.rar, g === 'G', getPlayerKey(x.p), x.rar, x.num || 0));
      return {
        // S80 : à finition égale, son niveau ordonne aussi le retournement (la finition d'abord : une holo Soutien sort après un Phénomène de base ; js/gerant.js).
        cle: getPlayerKey(x.p), rarete: x.rar, rang: x.niveau, eclat: x.niveau === PHENOMENE, nom: x.p.n, type: `${POSTE_GROUPE[g]} · ${x.p.t} ${x.p.s}`, coin: money(x.p.$),
        art: artJoueur({ portraitHtml: headshotHtml(x.p), logoHtml: getTeamLogoHtml(x.p.t, 24), pos: esc(POSTE_GROUPE[g]), saison: esc(x.p.s), club: esc(x.p.t), actionSrc: photoAction(x.p) }),
        carteJoueur: miniAvecVariante(x.p, x.rar),
        // LE WALKOUT (1.0, oct.) : si c'est la carte du pack, sa saison, son poste et son club s'annoncent avant elle (js/gerant.js).
        walkout: { saison: esc(x.p.s), pos: esc(POSTE_GROUPE[g]), logo: getTeamLogoHtml(x.p.t, 132) },
        // Son NIVEAU en un mot (S80), sauf quand le ruban de la carte le dit déjà.
        texte: [x.doublon ? `Doublon : revendu ${venteJoueur(x)} 🪙 si tu ne le signes pas` : '', niveauHorsRuban(x.p, x.niveau), ligneDuChoix(x.p), x.num ? `✦ Or numérotée ${x.num}` : '', ...bonus.map(b => `${b.ico} ${b.nom} — ${b.mot}`),
          // v2 : sa couleur — il porte la confiance de ce coach et fait grandir les cartes de sa couleur.
          COACHS[coachDuJoueur(x.p)] ? `${COACHS[coachDuJoueur(x.p)].ico} Joueur ${COACHS[coachDuJoueur(x.p)].de}` : ''].filter(Boolean).join('\n'),
        // UN DOUBLON SE SIGNE PAREIL (1.0, oct.). JP : *si je pige un doublon, je devrais pouvoir le signer pareil*.
        // Pas signé, il est revendu comme avant ; signé, sa vente s'annule. Déjà dans ton équipe, non : un joueur, une case.
        desactive: dejaChezToi(x.p) ? 'Déjà dans ton équipe' : '',
        apercu: () => apercuJoueur(x.p),
      };
    }),
    onChoix: k => {
      const x = cartes.find(y => getPlayerKey(y.p) === k);
      if (!x || dejaChezToi(x.p)) return;
      const signer = sortie => {
        if (!sortie) return;
        G.variantes.cartes[k] = x.rar;
        if (x.num) (G.variantes.numeros = G.variantes.numeros || {})[k] = x.num;
        decider({ jour: j, palier, ballottage: { i: sortie.i, entre: k, sort: sortie.sort, rar: x.rar, ...(x.num ? { num: x.num } : {}) }, ...(sortie.cases ? { cases: sortie.cases } : {}), ...(x.doublon ? { annuleVente: venteJoueur(x) } : {}) });
      };
      // QUI SORT : la sortie doit faire entrer son salaire sous le plafond (effectif), ou au moins ne pas l'empirer.
      quiSortOuCaseLibre(x.p, { roster: G.roster, genre: 'recompense', bloque: q => bloqueParLePlafond(x.p, q), onChoix: signer, onFerme: offrir });
    },
    // « Plus tard » : rien ne s'écrit, l'offre attend au Marché et dans la boîte (`packOuvert`, js/saison.js).
    onFerme: () => {},
  });
  offrir();
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
function optionDeBanque(id) {
  const c = BANQUE[id];
  if (c.cat === 'match') return optionDeCarteMatch(c.cle);
  const etiquette = etiquetteBanque(id);
  return { cle: id, rarete: c.rarete === 'maudite' ? 'commune' : c.rarete, ico: c.ico, nom: c.nom,
    type: c.rarete === 'maudite' ? `Malédiction · ${CATEGORIES[c.cat].un}` : `${CATEGORIES[c.cat].un} · ${(VIES[c.vie] || VIES.saison).nom}${COACHS[c.coach] ? ` · ${COACHS[c.coach].ico} ${COACHS[c.coach].nom}` : ' · Neutre'}`, texte: c.texte, mots: reglesDe(id), ...(etiquette ? { etiquette } : {}) };
}
/*
 * L'OUVERTURE D'UN PACK DE CARTES : tout va dans l'inventaire. En Rogue, le
 * personnel et les consommables permanents partent au MÉTA (gardés d'une run
 * à l'autre) — une fois, par achat (`recevoirPermanents`) ; un patron qu'on
 * possède déjà est un doublon, revendu. Le reste va dans la poche de la saison.
 * UNE MALÉDICTION (la taxe de luxe, que certains packs cachent) ne se range
 * pas : elle frappe à l'ouverture (`achat.maudites`, lu par `plafondDe`).
 */
function ouvrirPackCartes(cle, prix, j, n, decider, params = {}, de = null) {
  const P = PACKS_TOUS[cle], Lg = G.ligue;
  const tirees = tirerCartesPack(P.cle, Lg.graine, n, params);
  const ids = tirees.filter(id => BANQUE[id].rarete !== 'maudite');
  const maudites = tirees.filter(id => BANQUE[id].rarete === 'maudite');
  const rogue = G.bonus === 'ROGUE';
  const meta = lireMeta();
  const perso = new Set(meta.personnel || []);
  const vendus = [];
  let vente = 0;
  ids.forEach((id, t) => {
    const c = BANQUE[id];
    const dejaVu = c.cat === 'patron' && (perso.has(c.cle) || ids.slice(0, t).includes(id));
    if (rogue && dejaVu) { vendus.push(t); vente += valeurDe(id); }
  });
  const achat = { pack: cle, n, prix, sorte: 'cartes', cartes: ids, ...(P.choix === 'coach' ? { params: { coach: coachDuPack(Lg.graine, n, params) } } : {}), ...(vendus.length ? { vendus, vente } : {}), ...(maudites.length ? { maudites } : {}), ...(de ? { de } : {}) };
  // 1.0 (J1-B) : l'achat est une décision AVANT que le butin n'entre au méta — recharger la page ne donne plus les cartes gratis.
  decider({ jour: j, palier: `k:${n}`, achat });
  if (rogue) recevoirPermanents(ids.filter((id, t) => !vendus.includes(t) && BANQUE[id].vie === 'permanent'), `${Lg.graine}:k:${n}`);
  ajouterCollection({ cartes: ids });
  ouvrirChoix({
    ico: P.ico, titre: P.nom, cartes: true, genre: 'recompense', fermable: true, motFermer: 'Tout ranger',
    recit: (rogue
      ? `Tout va dans ton inventaire : le personnel et les consommables permanents y restent d'une run à l'autre, le reste vaut pour cette saison.${vente ? ` Doublons revendus : +${vente} 🪙.` : ''}`
      : 'Tout va dans ton inventaire : joue chaque carte quand tu veux, du bureau (🎒).')
      + (maudites.length ? ` Pas de chance : ${maudites.map(id => `« ${BANQUE[id].nom} »`).join(', ')} frappe tout de suite.` : ''),
    options: [...ids.map((id, t) => ({ ...optionDeBanque(id), cle: String(t), prix: vendus.includes(t) ? `Doublon : revendu ${valeurDe(id)} 🪙` : '' })),
      ...maudites.map((id, t) => ({ ...optionDeBanque(id), cle: `m${t}`, prix: 'Malédiction : elle frappe tout de suite' }))],
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
  const possedees = new Set((meta.cartes || []).map(k => (BANQUE[k] ? k : BANQUE[`match:${k}`] ? `match:${k}` : null)).filter(Boolean));
  ouvrirInventaire({
    ...(page || {}),
    titre: 'Ton inventaire', mode: rogue ? 'rogue' : 'saison', enSaison, peutJouer: enSaison, jetons: enSaison ? jetonsRogue(j) : null,
    partie: enSaison ? pocheDeLaPartie({ decisions: decs, graine: Lg.graine, nMatch: matchsEntre(Lg.you, 0, j), rogue }) : [],
    meta: rogue ? Object.entries(meta.inventaire || {}).map(([id, n]) => ({ id, n })).filter(x => BANQUE[x.id] && x.n > 0) : [],
    personnel: rogue ? (meta.personnel || []).filter(k => PATRONS[k]) : [],
    patronsActifs: enSaison ? patronsActifs(decs, j + 1) : [], maxPatrons: postesDePatron((G.rogue && G.rogue.prestige) || 0),
    deck: enSaison ? deckDe(Lg.decisions || []) : [],
    ...(enSaison ? { build: buildDe(decs, j + 1), coachsActifs: coachsActifs(decs, j + 1), coachRun: (rogue && G.rogue && G.rogue.coach) || null, joueurs: joueursDesCoachs(Lg.you) } : {}),
    possedees, joueursCollection: Object.keys(lireCartable().joueurs).length,
    plafond: plafondPourInventaire(enSaison ? j : (G.journee || 0)),
    jouer: item => jouerCarte(item, j, decider, page),
    vendre: item => decider({ jour: j, vend: { refs: [item.ref], jetons: valeurDe(item.id) } }),
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
/* Le nombre de cartes à jouer, pour le bouton du hub. */
export function cartesAJouer(j) {
  const Lg = G.ligue;
  if (!Lg) return 0;
  const rogue = G.bonus === 'ROGUE';
  const meta = rogue ? lireMeta() : null;
  return pocheDeLaPartie({ decisions: decisionsDeLaPartie(), graine: Lg.graine, nMatch: matchsEntre(Lg.you, 0, j), rogue }).length
    + (meta ? Object.values(meta.inventaire || {}).reduce((a, n) => a + n, 0) : 0);
}
/*
 * JOUER UNE CARTE DE L'INVENTAIRE : sa cible (un joueur, un blessé, une
 * malédiction du deck, une carte à améliorer, un système), puis UNE décision
 * datée d'aujourd'hui (`joue` dit d'où elle sort, pour la poche). Un
 * consommable permanent quitte le méta à ce moment-là.
 */
function jouerCarte(item, j, decider, page = null) {
  const c = BANQUE[item.id];
  if (!c || !decider) return;
  const Lg = G.ligue, decs = decisionsDeLaPartie(), you = Lg.you;
  const joue = { src: item.src, id: item.id, ...(item.ref ? { ref: item.ref } : {}) };
  // v2 : une carte de coach grandit avec les cartes de son coach déjà jouées (js/banque.js `grandi`).
  const build = buildDe(decs, j + 1), joueurs = joueursDesCoachs(you);
  // « Retour » revient dans la page d'où l'on venait (« Tes cartes ») ; sans elle, l'inventaire flottait par-dessus le Marché.
  const retour = () => ouvrirInventaireJeu(j, decider, page && page.dans && page.dans.isConnected ? page : null);
  const ecrire = payload => {
    if (!payload) return;
    if (item.src === 'meta') retirerDuMeta(item.id);
    decider({ jour: j, joue, ...payload });
  };
  const listeJoueurs = (titre, recit, liste, choisir, mots = null) => ouvrirChoix({
    ico: c.ico, titre, compact: true, fermable: true, motFermer: 'Retour', recit,
    contexte: mots ? `${etiquetteBanque(item.id) ? `<span class="choix-forme">${esc(etiquetteBanque(item.id))}</span>` : ''}<div class="choix-puces">${puces(mots)}</div>` : '',
    options: liste.map(({ p, sous }) => ({ cle: getPlayerKey(p), visage: headshotHtml(p), nom: p.n, sous })),
    onChoix: choisir, onFerme: retour,
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
    ecrire(payloadDe(item.id, { patrons: actifs, build, joueurs }));
    return;
  }
  // S80 : une modif de joueur se pose AU VERSO, choisie dans l'alignement.
  if (c.cat === 'joueur') { poserUneModif(item, j, payload => ecrire(payload), retour); return; }
  if (c.cat === 'consommable') {
    const C = CONSOMMABLES[c.cle];
    if (C.cible === 'blesse') {
      const bl = blessesAuJour(j);
      if (!bl.length) { toast('Personne à l\'infirmerie : garde-la pour plus tard.'); retour(); return; }
      listeJoueurs(`${c.nom} : qui soigner ?`, c.texte, bl.map(x => ({ p: x.p, sous: [ouJoue(x.p), `${x.reste} match${x.reste > 1 ? 's' : ''} d'infirmerie`].filter(Boolean).join(' · ') })), k => ecrire(payloadDe(item.id, { joueur: k })), reglesDe(item.id));
      return;
    }
    if (C.cible === 'joueur') {
      // S80 : il se nomme par ce qu'il est, et on dit où il joue — pas « 1re paire · DG ».
      const liste = SLOTS.filter(sl => !sl.scratch && sl.group !== 'G').map(sl => ({ p: G.roster[sl.i], sous: G.roster[sl.i] ? `${quiEst(G.roster[sl.i], { stats: false })} · ${ligneDe(sl)}` : '' })).filter(x => x.p);
      listeJoueurs(`${c.nom} : pour qui ?`, c.texte, liste, k => ecrire(payloadDe(item.id, { joueur: k })), reglesDe(item.id));
      return;
    }
    if (C.cible === 'malediction' || C.cible === 'carteMatch') {
      const deck = deckDe(Lg.decisions || []);
      const uniques = [...new Set(deck)].filter(k => (C.cible === 'malediction' ? CARTES_MATCH[k] && CARTES_MATCH[k].maudite : CARTES_MATCH[`${k}+`]));
      if (!uniques.length) { toast(C.cible === 'malediction' ? 'Aucune malédiction dans ton deck.' : 'Tout ton deck est déjà amélioré.'); retour(); return; }
      ouvrirChoix({ ico: c.ico, titre: c.nom, cartes: true, genre: 'palier', fermable: true, motFermer: 'Retour', recit: c.texte,
        contexte: `${etiquetteBanque(item.id) ? `<span class="choix-forme">${esc(etiquetteBanque(item.id))}</span>` : ''}<div class="choix-puces">${puces(reglesDe(item.id))}</div>`,
        options: uniques.map(k => ({ ...optionDeCarteMatch(C.cible === 'carteMatch' ? `${k}+` : k), cle: k })),
        onChoix: k => ecrire(payloadDe(item.id, { carte: k })), onFerme: retour });
      return;
    }
    if (C.cible === 'tactique') {
      ouvrirChoix({ ico: c.ico, titre: c.nom, compact: true, fermable: true, motFermer: 'Retour', recit: c.texte,
        contexte: `${etiquetteBanque(item.id) ? `<span class="choix-forme">${esc(etiquetteBanque(item.id))}</span>` : ''}<div class="choix-puces">${puces(reglesDe(item.id))}</div>`,
        options: Object.entries(TACTIQUES).filter(([k]) => k !== 'hourra').map(([k, T]) => ({ cle: k, ico: T.ico, nom: T.nom, sous: T.mot })),
        onChoix: k => ecrire(payloadDe(item.id, { tactique: k })), onFerme: retour });
      return;
    }
    ecrire(payloadDe(item.id, { alea: hache(Lg.graine, 'billet', item.ref || item.id, j), build, joueurs }));
    return;
  }
  if (c.cat === 'plafond') {
    // LA MASSE SALARIALE : un joueur (sa retenue, son rachat, ses bonis), une recrue (son contrat d'entrée), un blessé (le LTIR).
    const C = CONTRATS[c.cle];
    if (C.cout && jetonsRogue(j) < C.cout) { toast(`Il faut ${C.cout} 🪙 pour ce rachat.`, 'bad'); retour(); return; }
    if (C.cible === 'aucune') { ecrire(payloadDe(item.id)); return; }
    const pl = plafondEffectif(j);
    const deja = k => pl.facteurs.has(k) || pl.ltir.has(k);
    const apres = p => `${money(capHit(p, pl))} → ${money(Math.round(capHit(p, pl) * (C.facteur || 0)))}`;
    let liste;
    if (C.cible === 'blesse') {
      liste = blessesAuJour(j).filter(x => signes().some(q => getPlayerKey(q) === getPlayerKey(x.p)) && !deja(getPlayerKey(x.p)))
        .map(x => ({ p: x.p, sous: [ouJoue(x.p), `${x.reste} match${x.reste > 1 ? 's' : ''} d'infirmerie · ${money(x.p.$)} hors du plafond`].filter(Boolean).join(' · ') }));
      if (!liste.length) { toast('Personne à l\'infirmerie sous contrat : garde-la pour plus tard.'); retour(); return; }
    } else {
      liste = signes().filter(p => !deja(getPlayerKey(p)) && (C.cible !== 'recrue' || ageAtSeason(p.bd, p.s) <= 23))
        .sort((a, b) => (b.$ || 0) - (a.$ || 0)).map(p => ({ p, sous: `${ouJoue(p) ? `${ouJoue(p)} · ` : ''}${apres(p)}${C.cible === 'recrue' ? ` · ${ageAtSeason(p.bd, p.s)} ans` : ''}` }));
      if (!liste.length) { toast(C.cible === 'recrue' ? 'Aucune recrue de 23 ans ou moins dans ton alignement.' : 'Tous tes contrats sont déjà retouchés.'); retour(); return; }
    }
    listeJoueurs(`${c.nom} : pour qui ?`, c.texte, liste, k => ecrire(payloadDe(item.id, { joueur: k })), reglesDe(item.id));
    return;
  }
  ecrire(payloadDe(item.id, { build, joueurs }));
}
/*
 * JOUER UNE MODIF DE JOUEUR (S80). JP : *donne l'alignement, je clique sur le
 * joueur, pis je dois aller au verso pour l'ajouter dans une des slots
 * joueurs?* — oui. « Jouer » ouvre l'ALIGNEMENT (`ouvrirAlignement`, en
 * aperçu) : chaque case dit ce que la carte lui ferait, ou pourquoi elle ne
 * peut pas aller sur lui (un gardien, ses cases pleines, aucun malus à
 * effacer…). Toucher un joueur ouvre sa fiche retournée au VERSO, la carte en
 * attente sur sa case libre ; « Poser ici » décide. Fermer la fiche ramène à
 * l'alignement, « Retour » à l'inventaire.
 */
function poserUneModif(item, j, decider, retour) {
  const c = BANQUE[item.id], M = MUTATIONS[c.cle];
  const you = G.ligue && G.ligue.you;
  const rangees = rangeesAlignement(G.roster, (sl, q) => { const e = etatPourPoser(c.cle, q, sl, { jour: j, you }); return { non: e.non || '', note: e.note || '' }; });
  // Poser ferme l'alignement en silence (`fermer`) : la décision part, et l'inventaire ne se rouvre pas.
  const fermer = ouvrirAlignement({
    ico: M.ico, titre: `${M.nom} : sur qui ?`, motFermer: 'Retour',
    contexte: `<div class="choix-puces">${puces(motsDeMutationEnChiffres(c.cle))}</div>`,
    aide: 'Touche un joueur pour voir son verso.',
    rangees,
    onApercu: k => {
      const q = G.roster[Number(k)];
      if (q) ouvrirVersoPourPoser(q, item, { decider, jour: j, auDessus: true, avant: () => fermer() });
    },
    onFerme: retour,
  });
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
 * les joueurs gardés de la dernière run passent devant.
 */
async function plombiers(meta, gardes = []) {
  return placerDevant(autoRoster([...gardes, ...await plombiersDeLaLigue(meta, gardes)]), gardes);
}
async function plombiersDeLaLigue(meta, gardes = []) {
  const saisons = state.index.seasons.slice(), choisies = [];
  while (choisies.length < 8 && saisons.length) choisies.push(saisons.splice(Math.floor(Math.random() * saisons.length), 1)[0]);
  const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));
  // Mesuré : le fond absolu (0-20 %) faisait 6 à 12 points, une run perdue d'avance ; 10-30 % en fait 12 à 33.
  const [bas, haut] = aDebloque(meta, 'plombiersPlus') ? [0.3, 0.5] : [0.1, 0.3];
  const gardesPersonnes = new Set(gardes.map(getPersonKey));
  const pool = [];
  for (const s of choisies) {
    const e = await getShard(s);
    for (const g of ['F', 'D', 'G']) {
      const reg = e.players.filter(p => groupeDe(p) === g && (p.gp || 0) >= (g === 'G' ? 10 : 30) && !gardesPersonnes.has(getPersonKey(p)))
        .sort((a, b) => prod(a) - prod(b));
      const tranche = reg.slice(Math.floor(reg.length * bas), Math.max(1, Math.floor(reg.length * haut)));
      const n = g === 'F' ? 3 : g === 'D' ? 2 : 1;
      for (let i = 0; i < n && tranche.length; i++) pool.push(tranche.splice(Math.floor(Math.random() * tranche.length), 1)[0]);
    }
  }
  return pool;
}
/*
 * LE VESTIAIRE TIRÉ DU CLASSEUR (1.0, js/rogue.js `tirageDuDepart`) : dès que
 * ton cartable a des cartes, tes plombiers sont tes cartes Soutien, et le
 * quota baisse avec le prestige et la saison. Les cartes se lisent dans
 * l'ordre du tirage (les moins jouées d'abord), et on s'arrête quand il y en a
 * assez de chaque sorte : pas besoin d'ouvrir cinquante saisons. Ce qui
 * manque vient des plombiers de la ligue. `exclus` : les cartes qui partent.
 */
async function vestiaireDeDepart(meta, fixes = [], { saison = 1, rang = rangDePrestige(meta), exclus = new Set(), graine = graineDuClasseur() } = {}) {
  const c = lireCartable();
  const cles = Object.keys(c.joueurs).filter(k => !exclus.has(k));
  if (!cles.length) return { roster: await plombiers(meta, fixes), quota: null, tires: [] };
  const quota = soutiensDuDepart(rang, saison);
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
    const ligue = await plombiersDeLaLigue(meta, pris);
    for (const g of ['F', 'D', 'G']) pris.push(...ligue.filter(p => groupeDe(p) === g).slice(0, manque[g]));
  }
  return { roster: placerDevant(autoRoster(pris), fixes), quota, tires, nFixes: fixes.length };
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
/* Le choix d'un joueur à garder de la dernière run, en cartes. */
function choisirGarde(joueurs, i, total) {
  return new Promise(resolve => {
    ouvrirChoix({
      ico: '🤝', titre: `Garder un joueur · ${i + 1} sur ${total}`, cartes: true, genre: 'recompense', fermable: true, motFermer: 'Personne',
      recit: 'Ta dernière équipe : celui que tu touches te suit dans cette run, avec ta nouvelle bande de bouche-trous.',
      options: joueurs.map(p => ({ cle: getPlayerKey(p), rarete: rareteJoueur(p), nom: p.n, type: `${POSTE_GROUPE[groupeDe(p)]} · ${p.t} ${p.s}`, coin: money(p.$),
        art: artJoueur({ portraitHtml: headshotHtml(p), logoHtml: getTeamLogoHtml(p.t, 24), pos: esc(POSTE_GROUPE[groupeDe(p)]), saison: esc(p.s), club: esc(p.t), actionSrc: photoAction(p) }),
        carteJoueur: carteMiniHtml(p), motChoix: 'Garder', apercu: () => apercuJoueur(p) })),
      onChoix: k => resolve(joueurs.find(p => getPlayerKey(p) === k) || null),
      onFerme: () => resolve(null),
    });
  });
}
/*
 * UNE RUN QUI COMMENCE : l'écran de la run (ce qu'on a débloqué, ce que le
 * proprio demandera), les joueurs à garder s'il y en a, les cartes du
 * classeur (S80), puis les plombiers et l'alignement.
 */
const MODE_CLASSEUR = { hasard: 'au hasard', tri: 'le tri', choix: 'au choix' };
export async function ouvrirRogue() {
  const meta = lireMeta();
  const k = nombreGardes(meta);
  const D = departDuClasseur(meta);
  const nCartable = Object.keys(lireCartable().joueurs).length;
  const go = await new Promise(resolve => ouvrirChoix({
    ico: '💀', titre: 'Le mode Rogue', fermable: true, motFermer: 'Pas maintenant',
    // 1.0 (R5) : deux phrases ; le reste se lit dans « Règles », section « Le mode Rogue ».
    recit: `Une équipe de bouche-trous, 🪙 ${jetonsDeDepart(meta)} jetons, plusieurs saisons. Chaque saison, le proprio en veut plus. Le but : la Coupe Stanley, la victoire de la run.`,
    options: [{ cle: 'go', ico: '▶', nom: `Commencer la run ${(meta.runs || 0) + 1}`,
      bon: [nCartable ? `ton effectif tiré de ton cartable : ${soutiensDuDepart(rangDePrestige(meta))} ${NIVEAUX[0].nom}, ${SOUTIENS_DEPART - soutiensDuDepart(rangDePrestige(meta))} ${NIVEAUX[1].nom}, les cartes les moins jouées d'abord` : '',
        nCartable ? `📒 ${D.n} carte${D.n > 1 ? 's' : ''} de ton classeur, ${MODE_CLASSEUR[D.mode]}` : '',
        `${Object.keys(PACKS_TOUS).filter(k => !VERROUS_ROGUE[k] || aDebloque(meta, VERROUS_ROGUE[k])).length} packs à la boutique`,
        k ? `tu gardes ${k} joueur${k > 1 ? 's' : ''} de ta dernière équipe` : '', reservesDeLaRun(meta) ? `🪑 ${3 + reservesDeLaRun(meta)} réservistes` : '',
        aDebloque(meta, 'deckPlus') ? 'un deck aiguisé' : '', `📈 ${PRESTIGES[rangDePrestige(meta)].nom}`].filter(Boolean).join(' · '),
      prix: `🏅 ${meta.ecussons || 0} médailles · ${meta.runs || 0} run${(meta.runs || 0) > 1 ? 's' : ''} · 🏆 ${meta.coupes || 0} · 📒 ${nCartable} carte${nCartable > 1 ? 's' : ''} au cartable` }],
    onChoix: () => resolve(true),
    onFerme: () => resolve(false),
  }));
  if (!go) return;
  const coach = await choisirCoach();
  if (!coach) return;
  const gardes = [];
  if (k && (meta.derniereEquipe || []).length) {
    const joueurs = (await Promise.all(meta.derniereEquipe.map(joueurDeCle))).filter(Boolean);
    for (let i = 0; i < k; i++) {
      const p = await choisirGarde(joueurs.filter(x => !gardes.includes(x)), i, k);
      if (!p) break;
      gardes.push(p);
    }
  }
  const tires = await choisirDuClasseur(gardes);
  await sousVoile('On rassemble tes bouche-trous…', () => demarrerRogue(gardes, tires, coach));
}
/*
 * TON COACH (v2, js/coachs.js) — le personnage de Slay the Spire. Les coachs
 * que le prestige du club a ouverts (V2.3 : trois au Club de garage, les huit
 * à la Dynastie, js/rogue.js `coachsOuverts`), un à prendre : sa philosophie
 * part avec trois cartes au compteur, sa confiance I allumée dès le premier
 * soir. Les autres coachs restent à prendre en jouant. Et les deux patrons
 * imposés de la run, tirés de la même graine (`patronsDeLaRun`).
 */
const patronsDeLaRun = meta => patronsDeDepart(graineDuClasseur(), PRESTIGES[rangDePrestige(meta)].raretes);
function choisirCoach() {
  const meta = lireMeta(), rang = rangDePrestige(meta), ouverts = coachsOuverts(rang);
  const pats = patronsDeLaRun(meta).map(id => BANQUE[id]);
  const plus = ouverts.length < VOIES.length ? ` ${PRESTIGES[rang].nom} : ${ouverts.length} coachs sur ${VOIES.length} ; le prestige ouvre les autres.` : '';
  return new Promise(resolve => ouvrirChoix({
    ico: '📋', titre: 'Ton coach', fermable: true, motFermer: 'Retour',
    recit: `Il part avec sa confiance I. Chaque carte de sa couleur la fait monter : II à ${SEUILS[1]} cartes, III à ${SEUILS[2]}. Les autres coachs aussi, si tu joues leurs cartes.${plus} Tes patrons de départ : ${pats.map(c => `${c.ico} ${c.nom}`).join(' et ')}.`,
    options: ouverts.map(k => {
      const C = COACHS[k];
      return { cle: k, ico: C.ico, nom: C.nom, sous: `${C.mot} Son dépisteur recrute ${C.recrute}.`,
        mots: [{ txt: 'Confiance I', bon: null, duree: true }, ...reglesDePalier(k, 1)], quand: `${idsDuCoach(k).length} cartes de sa couleur` };
    }),
    onChoix: k => resolve(k),
    onFerme: () => resolve(null),
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
/*
 * LE DÉPART DU CLASSEUR (S80, js/depart.js). JP : *le classeur, on peut
 * piger x cartes aux départ, ou random, selon upgrades*. Les cartes du
 * cartable, dans l'ordre du tirage ; au hasard et au tri, les premières qui
 * tiennent dans le budget ; ouvert, toutes. Une même personne ne revient pas
 * deux fois (un joueur échangé a une carte par club), ni un joueur gardé.
 */
async function choisirDuClasseur(gardes = []) {
  const meta = lireMeta();
  const D = departDuClasseur(meta);
  const c = lireCartable();
  const cles = Object.keys(c.joueurs);
  if (!D.n || !cles.length) return [];
  const budget = budgetDuClasseur(meta);
  const exclus = new Set(gardes.map(getPersonKey));
  const candidats = await sousVoile('On ouvre ton classeur…', async () => {
    const out = [], personnes = new Set(exclus);
    for (const cle of tirageDuClasseur(cles, graineDuClasseur())) {
      if (D.mode !== 'choix' && out.length >= D.vues) break;
      const p = await joueurDeCle(cle);
      if (!p || !(p.$ > 0) || p.$ > budget || personnes.has(getPersonKey(p))) continue;
      personnes.add(getPersonKey(p));
      const x = c.joueurs[cle];
      out.push({ cle, p, rar: meilleureVariante(x), num: (x.num || [])[0] || null });
    }
    return out;
  });
  if (!candidats.length) return [];
  return new Promise(resolve => ouvrirDepartClasseur({
    mode: D.mode, n: D.n, budget, run: (meta.runs || 0) + 1, candidats,
    esc, money, groupe: groupeDe, qui: p => quiEst(p), apercu: p => apercuJoueur(p),
    mini: (p, rar) => miniAvecVariante(p, rar),
    onFini: pris => resolve(candidats.filter(x => pris.includes(x.cle))),
  }));
}
/* Ce que le départ a donné, en une ligne : « Ton effectif : 20 Soutien et 3 Réguliers de ton cartable ». */
function motDuVestiaire(V) {
  if (V.quota == null) return 'Tes bouche-trous sont là';
  const s = V.tires.filter(x => estSoutien(x.niveau)).length, r = V.tires.length - s;
  const ligue = Object.values(V.roster).filter(Boolean).length - V.tires.length - V.nFixes;
  return `Ton effectif : ${s} ${NIVEAUX[0].nom}${r ? ` et ${r} ${NIVEAUX[1].nom}${r > 1 ? 's' : ''}` : ''} de ton cartable${ligue > 0 ? `, ${ligue} bouche-trou${ligue > 1 ? 's' : ''} de la ligue` : ''}`;
}
async function demarrerRogue(gardes = [], tires = [], coach = null) {
  const meta = lireMeta();
  const D = departDuClasseur(meta);
  G.bonus = 'ROGUE';
  G.mode = 'CLASSIQUE'; G.epoque = null; G.repechage = 'TOUTES'; G.identite = null;
  clearSave();
  G.variantes = { graine: nouvelleGraine(), cartes: {}, numeros: {} };
  // Les cartes du classeur gardent leur variante : c'est TA carte, pas une neuve.
  for (const x of tires) { G.variantes.cartes[x.cle] = x.rar; if (x.num) G.variantes.numeros[x.cle] = x.num; }
  G.roster = {}; poserCartes(); G.tirage = []; G.echelle = {}; G.dette = 0; G.renfort = null;
  G.ligue = null; G.tournoi = null; G.relances = 0; G.left = { ...REROLLS };
  G.target = null; G.mainCase = null; G.mainRang = null; G.selectedSlot = null; G.done = false; G.lignes = null;
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  $('game').classList.remove('bilan');
  // V2.3 : les deux patrons imposés, tirés avant que la run prenne son numéro (la graine du choix du coach).
  const patrons = patronsDeLaRun(meta);
  const V = await vestiaireDeDepart(meta, [...gardes, ...tires.map(x => x.p)]);
  G.roster = V.roster;
  // Tes cartes gardent leur variante : c'est TA carte, pas une neuve.
  for (const x of V.tires) G.variantes.cartes[x.cle] = meilleureVariante(lireCartable().joueurs[x.cle]);
  poserCartes();
  // La run commence : elle prend son numéro (le tirage du classeur suivant change).
  const m = lireMeta();
  m.runs = (m.runs || 0) + 1;
  ecrireMeta(m);
  G.rogue = {
    depart: jetonsDeDepart(meta), deckPlus: aDebloque(meta, 'deckPlus'), gardes: gardes.map(getPlayerKey), plafond: plafondDeDepart(meta),
    // S80 : la run sur plusieurs saisons, ses cases de réserve, et ce que le classeur a donné.
    numero: m.runs, saison: 1, reserves: reservesDeLaRun(meta), bareme: baremeRogue(meta),
    // v2 : le coach choisi au départ (js/coachs.js) — sa confiance I est une décision du jour 0 (js/banc.js) —
    // et le prestige du club, FIXÉ pour la run (js/rogue.js `PRESTIGES`) : un rang gagné en route sert la suivante.
    ...(COACHS[coach] ? { coach } : {}), prestige: rangDePrestige(meta), patrons,
    classeur: { mode: D.mode, n: D.n, pris: tires.map(x => x.cle) },
    // 1.0 (R7) : ce que l'écran « Ta run » comparera à la fin — le cartable au départ, les écussons et les jalons de la run.
    cartableDepart: Object.keys(lireCartable().joueurs).length, ecussonsRun: 0, jalonsRun: [],
    // 1.0 : tes cartes arrivent avec ce qu'elles portent (js/cartable.js `mods`).
    report: reportDesCartes(G.roster),
  };
  saveGame(); syncOptionsUI(); render();
  setView('roster');
  const noms = [...gardes.map(p => p.n), ...tires.map(x => x.p.n)];
  toast(`${motDuVestiaire(V)}${noms.length ? `, avec ${noms.join(', ')}` : ''}. Le proprio veut : ${mandatDe(1).mot}. Lance la saison quand tu veux.`);
}
/*
 * LE PLAFOND D'UNE SAISON DE LA RUN : 82 M$, plus ce que le vestiaire a
 * débloqué. Chaque saison garde au moins 12 M$ d'espace au-dessus de la
 * masse de départ (trois vedettes gardées de la dernière run ne doivent pas
 * bloquer la saison). Depuis que l'équipe se défait entre deux saisons (1.0),
 * la saison suivante repart comme la première : ses gardés tiennent dans le
 * budget du classeur, le plafond ne grimpe donc pas de saison en saison.
 */
function plafondDeDepart(meta) {
  const lignes = [];
  let cap = PLAFOND_ROGUE;
  const v = plafondDuVestiaire(meta);
  if (v) { cap += v; lignes.push({ nom: 'Les déblocages', montant: v }); }
  const masse = signes().reduce((a, p) => a + (p.$ || 0), 0);
  const min = Math.ceil((masse + ESPACE_DE_DEPART) / 100_000) * 100_000;
  if (cap < min) { lignes.push({ nom: 'Ta masse de départ', montant: min - cap }); cap = min; }
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
    saisonDeLaRun: numeroDeSaison(), cartes: Object.keys(lireCartable().joueurs).length, joues: cartesJouees(), niveaux: niveauxDeLEquipe() };
}
function direJalons(payes) {
  payes.forEach((J, i) => setTimeout(() => toast(`🏁 Jalon : ${J.nom} — ${J.mot}.`), 1800 + i * 1400));
  // 1.0 (R7) : la run se souvient de ses jalons, pour l'écran « Ta run ».
  if (payes.length && G.rogue) G.rogue.jalonsRun = [...(G.rogue.jalonsRun || []), ...payes.map(J => J.nom)];
}
/* 1.0 (R7) : les écussons gagnés par CETTE run, cumulés au moment où ils se paient (exacts, jamais recalculés). */
function compterEcussonsRun(n) { if (n && G.rogue) G.rogue.ecussonsRun = (G.rogue.ecussonsRun || 0) + n; }
export function finDeSaisonRogue() {
  if (G.bonus !== 'ROGUE' || !G.ligue || !G.ligue.you) return;
  const t = G.ligue.you;
  const f = faitsDeLaSaison();
  const n = payerEcussons(G.ligue.graine, 'saison', ecussonsDeLaSaison(f.pts), {
    equipe: Object.values(G.roster || {}).filter(Boolean).map(getPlayerKey),
    bilan: { pts: f.pts, W: t.W, L: t.L, OTL: t.OTL },
  });
  if (n) setTimeout(() => toast(`🏅 +${n} médailles pour ta saison (${f.pts} points) — dépense-les aux déblocages.`), 900);
  compterEcussonsRun(n);
  modsAuCartable();
  // 1.0 : LA PRIME DE DÉCOUVERTE — chaque carte qui finit sa première saison avec toi (une fois pour toujours).
  const equipe = signes().filter(Boolean).map(getPlayerKey);
  marquerJouees(equipe, (G.rogue && G.rogue.numero) || 0);
  const neuves = decouvrir(equipe);
  const d = neuves.length ? payerEcussons(G.ligue.graine, 'decouverte', neuves.length * PRIME_DECOUVERTE) : 0;
  if (d) setTimeout(() => toast(`🧪 +${d} médailles de découverte : ${neuves.length} carte${neuves.length > 1 ? 's' : ''} jouée${neuves.length > 1 ? 's' : ''} pour la première fois.`), 2400);
  compterEcussonsRun(d);
  const moments = detecterLegendaires();
  if (moments.length) { ajouterLegendesAuCartable(moments, (G.rogue && G.rogue.saison) || 1); afficherLegendaires(moments); }
  direJalons(payerJalons({ ...f, joues: cartesJouees() }));
  majRunRogue();
}
/* Et ceux des séries : dix par ronde gagnée, vingt de plus pour la Coupe ; les jalons des séries ; le sort de la run. */
export function finDesSeriesRogue(rondes, coupe, { payer = true } = {}) {
  if (G.bonus !== 'ROGUE' || !G.ligue) return;
  G.rogue = G.rogue || {};
  G.rogue.series = { rondes, coupe: !!coupe };
  if (payer) {
    const n = payerEcussons(G.ligue.graine, 'series', ecussonsDesSeries(rondes, coupe), { bilan: { ronde: rondes, coupe: !!coupe } });
    if (n) setTimeout(() => toast(`🏅 +${n} médailles pour tes séries${coupe ? ' — et la Coupe !' : ''}`), 900);
    compterEcussonsRun(n);
    const S = G.seriesMoteur;
    const finale = !!(S && S.toutes.some(s => s.ronde === S.nRondes - 1 && (s.A.isPlayer || s.B.isPlayer)));
    direJalons(payerJalons({ ...faitsDeLaSaison(), rondes, coupe: !!coupe, finale }));
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
  return mandatRempli(numeroDeSaison(), { series: true, rondes: s.rondes }) ? 'continue' : 'finie';
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
  const n = numeroDeSaison(), M = mandatDe(n), suivant = mandatDe(n + 1);
  const s = (G.rogue && G.rogue.series) || null;
  const mots = {
    attente: `Le proprio veut : ${M.mot}. ${faitsDeLaSaison().series ? 'Tes séries le diront.' : ''} Le but de la run : la Coupe.`,
    continue: `Mandat rempli : ${M.mot}. La run continue ; la saison ${n + 1}, le proprio voudra : ${suivant.mot}.`,
    finie: `Mandat manqué — il fallait ${M.mot}. La run est finie après ${n} saison${n > 1 ? 's' : ''}. Tes médailles, tes jalons et ton cartable restent.`,
    gagnee: `La Coupe Stanley, à la saison ${n} de la run : la run est gagnée ! Tes médailles, tes jalons et ton cartable restent.`,
  };
  bloc.className = `rg-run ${sort}`;
  bloc.innerHTML = `<div class="rg-run-tete"><span>${sort === 'gagnee' ? '🏆' : sort === 'finie' ? '🚪' : '💀'} Run ${(G.rogue && G.rogue.numero) || ''} · saison ${n}</span>
      <small>${s ? `${s.rondes} ronde${s.rondes > 1 ? 's' : ''} gagnée${s.rondes > 1 ? 's' : ''}` : ''}</small></div>
    <p class="rg-run-mot">${esc(mots[sort])}</p>
    ${sort === 'continue' ? `<p class="rg-run-suite">Ton équipe se défait : tu gardes jusqu'à ${GARDES_DE_SAISON} joueurs, et le reste vient de ton classeur, avec moins de ${NIVEAUX[0].nom} qu'à la saison d'avant. Chaque carte garde ses modifs. Ce qui te suit aussi : ton deck de match, tes patrons engagés, tes jetons qui restent (plus ta caisse) et tes cartes permanentes. Ce qui expire : les cartes « cette saison » et les consommables de ta poche.</p>` : ''}
    <div class="rg-run-boutons">
      ${sort === 'continue' ? `<button type="button" class="btn gold rg-suivante">▶ Saison ${n + 1} de la run</button>` : ''}
      ${sort === 'finie' || sort === 'gagnee' ? '<button type="button" class="btn gold rg-nouvelle">▶ Nouvelle run</button>' : ''}
      <button type="button" class="btn rg-vestiaire">🏅 Les déblocages · ${lireMeta().ecussons || 0}</button>
    </div>`;
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
  const M = mandatDe(n);
  const d = { numero: G.rogue.numero || meta.runs || 1, saisons: n, sort, series: !!f.series, rondes: (s && s.rondes) || 0, coupe: !!(s && s.coupe),
    ecussons: G.rogue.ecussonsRun || 0, jalons: G.rogue.jalonsRun || [] };
  const nCartable = Object.keys(lireCartable().joueurs).length;
  const entrees = G.rogue.cartableDepart != null ? Math.max(0, nCartable - G.rogue.cartableDepart) : null;
  G.rogue.taRunVue = true;
  meta.derniereRun = d;
  // LA VITRINE (1.0) : chaque Coupe y entre, avec ses vedettes — les meilleurs pointeurs de leur vraie saison.
  const pts = p => (p.p === 'G' ? (p.w || 0) : (p.pt ?? ((p.g || 0) + (p.a || 0))) || 0);
  const vedettes = sort === 'gagnee' ? signes().filter(Boolean).sort((a, b) => pts(b) - pts(a)).slice(0, 3) : [];
  if (sort === 'gagnee') meta.vitrine = [...(meta.vitrine || []), { run: d.numero, saison: n, coach: G.rogue.coach || null, vedettes: vedettes.map(p => p.n) }];
  ecrireMeta(meta);
  saveGame();
  const ligne = (k, v) => `<div class="run-l"><span class="run-k">${esc(k)}</span><b class="run-v">${v}</b></div>`;
  if (sort === 'gagnee') { montrerLaCoupe(d, n, meta, vedettes, ligne, entrees, nCartable); return; }
  ouvrirChoix({
    ico: sort === 'gagnee' ? '🏆' : '🚪', titre: 'Ta run', genre: 'run', fermable: true, motFermer: 'Compris',
    irl: `Run ${d.numero} · ${n} saison${n > 1 ? 's' : ''}`,
    recit: sort === 'gagnee' ? `La Coupe Stanley, à la saison ${n} de la run.` : `Mandat manqué : il fallait ${esc(M.mot)}.`,
    contexte: `<div class="run-bilan">
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
 *   - le DECK de match : la saison neuve part du deck de la fin (`deckDeBase`) ;
 *   - les JETONS qui restent, plus la caisse du vestiaire ;
 *   - le PLAFOND est celui d'un départ de run (`plafondDeDepart`).
 * Le personnel et les cartes permanentes vivent déjà dans le méta. Les
 * cartes « cette saison » et les consommables de la poche expirent : la poche
 * se déduit des décisions de la saison, et la saison neuve n'en a pas.
 */
/*
 * LES MODIFS QUI VIVENT SUR LA CARTE (1.0, js/cartable.js `poserSurLesCartes`) :
 * améliorations, styles, contrats et éditions de l'atelier. Le physio soigne
 * une fois ; le lustre passe par la variante de la carte.
 */
const SOURCES_DURABLES = new Set(['amelioration', 'style', 'atelier', 'contrat']);
function modsAuCartable() {
  const you = G.ligue && G.ligue.you;
  if (G.bonus !== 'ROGUE' || !you) return;
  const par = {};
  for (const m of you.mutations || []) {
    const M = MUTATIONS[m.cle];
    if (!M || !SOURCES_DURABLES.has(M.source) || m.cle === 'physio' || m.cle === 'lustre' || !m.joueur) continue;
    (par[m.joueur] = par[m.joueur] || []).push(m.cle);
  }
  poserSurLesCartes(par);
  // Le lustre : la variante que la carte a prise devient la sienne, au cartable.
  const lustres = decisionsDeLaPartie().filter(d => d.mutation && d.mutation.cle === 'lustre' && d.mutation.carte).map(d => ({ cle: d.mutation.joueur, rar: d.mutation.carte.rar }));
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
 * CEUX QUI RESTENT : l'écran du départ du classeur (js/depart.js), ouvert sur
 * ton équipe de la saison finie — jusqu'à GARDES_DE_SAISON joueurs, leurs
 * salaires ensemble dans le budget du classeur.
 */
function choisirGardesDeSaison(saison) {
  const meta = lireMeta();
  const candidats = signes().filter(Boolean).map(p => ({ cle: getPlayerKey(p), p }));
  const n = GARDES_DE_SAISON;
  return new Promise(resolve => ouvrirDepartClasseur({
    mode: 'choix', n, budget: budgetDuClasseur(meta), run: (G.rogue && G.rogue.numero) || meta.runs || 1, candidats,
    esc, money, groupe: groupeDe, qui: p => quiEst(p), apercu: p => apercuJoueur(p), mini: p => carteMiniHtml(p),
    textes: {
      ico: '🤝', titre: 'Ceux qui restent', irl: `Saison ${saison} de la run · jusqu'à ${n} joueurs`,
      recit: `Ton équipe se défait. Garde jusqu'à ${n} joueurs ; les autres partent, et ton classeur comble les trous.`,
      budget: '🤝 Budget des gardés', plein: `Tu gardes déjà ${n} joueurs`,
      partir: k => (k ? `Saison ${saison} · ${k} joueur${k > 1 ? 's' : ''} gardé${k > 1 ? 's' : ''}` : `Saison ${saison} sans personne`),
    },
    onFini: pris => resolve(candidats.filter(x => pris.includes(x.cle)).map(x => x.p)),
  }));
}
/*
 * LE CLASSEUR EN SAISON SUIVANTE (v2) : même principe que `choisirDuClasseur`
 * au départ d'une run, mais les gardes sont déjà comptés et leur masse réduit
 * le budget disponible. La graine porte le numéro de saison pour ne pas
 * présenter les mêmes cartes que la run précédente.
 */
async function choisirDuClasseurSaison(gardes = [], saison = 2) {
  const meta = lireMeta();
  const D = departDuClasseur(meta);
  const c = lireCartable();
  const masseFixes = gardes.reduce((a, p) => a + (p.$ || 0), 0);
  const budget = budgetDuClasseur(meta) - masseFixes;
  const exclus = new Set(gardes.map(getPersonKey));
  const cles = Object.keys(c.joueurs);
  if (!D.n || !cles.length || budget <= 0) return [];
  const graine = `${graineDuClasseur()}:s${saison}`;
  const cands = await sousVoile('On ouvre ton classeur…', async () => {
    const out = [], personnes = new Set(exclus);
    for (const cle of tirageDuClasseur(cles, graine)) {
      if (D.mode !== 'choix' && out.length >= D.vues) break;
      const p = await joueurDeCle(cle);
      if (!p || !(p.$ > 0) || p.$ > budget || personnes.has(getPersonKey(p))) continue;
      personnes.add(getPersonKey(p));
      const x = c.joueurs[cle];
      out.push({ cle, p, rar: meilleureVariante(x), num: (x.num || [])[0] || null });
    }
    return out;
  });
  if (!cands.length) return [];
  return new Promise(resolve => ouvrirDepartClasseur({
    mode: D.mode, n: D.n, budget, run: (G.rogue && G.rogue.numero) || meta.runs || 1, candidats: cands,
    esc, money, groupe: groupeDe, qui: p => quiEst(p), apercu: p => apercuJoueur(p),
    mini: (p, rar) => miniAvecVariante(p, rar),
    textes: {
      ico: '📖', titre: 'Ton classeur', irl: `Saison ${saison} de la run · jusqu'à ${D.n} carte${D.n > 1 ? 's' : ''}`,
      recit: `Tes cartes d'une run à l'autre. Choisis jusqu'à ${D.n}.`,
      budget: '📖 Budget du classeur', plein: `Tu as pris tes ${D.n} cartes`,
      partir: k => (k ? `${k} carte${k > 1 ? 's' : ''} du classeur` : 'Sans le classeur'),
    },
    onFini: pris => resolve(cands.filter(x => pris.includes(x.cle)).map(x => x.p)),
  }));
}
/*
 * CANDIDATS POUR LE REPÊCHAGE (v2) : des vrais joueurs tirés de saisons
 * aléatoires, dans la tranche 35-70 % de production — des Réguliers, pas des
 * plombiers, pas des vedettes. Filtre les doublons de personnes et le budget.
 */
async function candidatsDraftSaison(besoins, exclusPersonnes, budgetRestant) {
  const saisons = state.index.seasons.slice(), choisies = [];
  while (choisies.length < 8 && saisons.length) choisies.push(saisons.splice(Math.floor(Math.random() * saisons.length), 1)[0]);
  const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));
  const cands = { F: [], D: [], G: [] };
  for (const s of choisies) {
    const e = await getShard(s);
    for (const g of ['F', 'D', 'G']) {
      if (!besoins[g]) continue;
      const reg = e.players.filter(p => groupeDe(p) === g && (p.gp || 0) >= (g === 'G' ? 10 : 25) && !exclusPersonnes.has(getPersonKey(p)) && (p.$ || 0) > 0 && (p.$ || 0) <= budgetRestant).sort((a, b) => prod(a) - prod(b));
      const tranche = reg.slice(Math.floor(reg.length * 0.35), Math.max(1, Math.floor(reg.length * 0.70)));
      const cible = besoins[g] * 3;
      while (cands[g].length < cible && tranche.length) {
        const idx = Math.floor(Math.random() * tranche.length);
        const p = tranche.splice(idx, 1)[0];
        if (!exclusPersonnes.has(getPersonKey(p))) { exclusPersonnes.add(getPersonKey(p)); cands[g].push({ cle: getPlayerKey(p), p }); }
      }
    }
  }
  return [...cands.F, ...cands.D, ...cands.G];
}
/*
 * LE REPÊCHAGE INTERACTIF (v2) : présente des candidats des saisons aléatoires
 * pour remplir les trous que gardes + classeur laissent. Le joueur choisit ;
 * les places non comblées reçoivent des plombiers comme avant.
 */
async function drafterJoueurs(meta, dejaSigmes, saison) {
  const personnes = new Set(dejaSigmes.map(getPersonKey));
  const besoins = { F: COMPOSITION_DEPART.F, D: COMPOSITION_DEPART.D, G: COMPOSITION_DEPART.G };
  for (const p of dejaSigmes) { const g = groupeDe(p); if (g in besoins) besoins[g] = Math.max(0, besoins[g] - 1); }
  const nTotal = Object.values(besoins).reduce((a, n) => a + n, 0);
  if (!nTotal) return [];
  const masseFixe = dejaSigmes.reduce((a, p) => a + (p.$ || 0), 0);
  const budgetRestant = PLAFOND_ROGUE + plafondDuVestiaire(meta) - ESPACE_DE_DEPART - masseFixe;
  if (budgetRestant <= 0) return [];
  const cands = await sousVoile('On prépare le repêchage…', () => candidatsDraftSaison(besoins, personnes, budgetRestant));
  if (!cands.length) return [];
  return new Promise(resolve => ouvrirDepartClasseur({
    mode: 'choix', n: nTotal, budget: budgetRestant, run: (G.rogue && G.rogue.numero) || meta.runs || 1, candidats: cands,
    esc, money, groupe: groupeDe, qui: p => quiEst(p), apercu: p => apercuJoueur(p),
    mini: (p, rar) => miniAvecVariante(p, rar || 'commune'),
    textes: {
      ico: '🏒', titre: 'Le repêchage', irl: `Saison ${saison} de la run · ${nTotal} poste${nTotal > 1 ? 's' : ''} à combler`,
      recit: `Choisis tes nouvelles recrues. Les cases vides recevront des bouche-trous de la ligue.`,
      budget: '💰 Budget restant', plein: `L'alignement est complet`,
      partir: k => (k ? `${k} recrue${k > 1 ? 's' : ''} choisie${k > 1 ? 's' : ''}` : 'Passer le repêchage'),
    },
    onFini: pris => resolve(cands.filter(x => pris.includes(x.cle)).map(x => x.p)),
  }));
}
/*
 * LE NOUVEAU DÉPART D'UNE SAISON (v2) : trois phases — garder des joueurs,
 * piger dans son classeur, puis repêcher les recrues manquantes.
 */
async function choisirNouvelleEquipe(saison) {
  const gardes = await choisirGardesDeSaison(saison);
  const classeurtires = await choisirDuClasseurSaison(gardes, saison);
  const meta = lireMeta();
  const dejaLa = [...gardes, ...classeurtires];
  const draftes = await drafterJoueurs(meta, dejaLa, saison);
  // V2 · Item 2 : la recrue repêchée garde la variante montrée à l'écran (carte de base).
  for (const p of draftes) G.variantes.cartes[getPlayerKey(p)] = 'commune';
  const pris = [...dejaLa, ...draftes];
  // V2 · Item 1 : combler les cases vides avec des plombiers si le draft a été passé.
  const manque = { F: COMPOSITION_DEPART.F, D: COMPOSITION_DEPART.D, G: COMPOSITION_DEPART.G };
  for (const p of pris) { const g = groupeDe(p); if (g in manque) manque[g] = Math.max(0, manque[g] - 1); }
  if (Object.values(manque).some(n => n > 0)) {
    const ligue = await plombiersDeLaLigue(meta, pris);
    for (const g of ['F', 'D', 'G']) pris.push(...ligue.filter(p => groupeDe(p) === g).slice(0, manque[g]));
  }
  const roster = placerDevant(autoRoster(pris), gardes);
  await sousVoile('La saison suivante se prépare…', () => continuerRun(gardes, classeurtires, draftes, roster));
}
async function continuerRun(gardes = [], classeurtires = [], draftes = [], rosterExterne = null) {
  if (G.bonus !== 'ROGUE' || !G.ligue || sortDeLaRun() !== 'continue') return;
  const L = G.ligue, meta = lireMeta();
  const saison = numeroDeSaison() + 1;
  const partants = new Set(signes().filter(Boolean).map(getPlayerKey).filter(k => !gardes.some(p => getPlayerKey(p) === k)));
  let V;
  if (rosterExterne) {
    // Flux v2 : roster déjà bâti par gardes + classeur + repêchage.
    const c = lireCartable();
    const tiresDesc = classeurtires.map(p => ({ cle: getPlayerKey(p), p, niveau: niveauDe(p, []) }));
    V = { roster: rosterExterne, quota: null, tires: tiresDesc, nFixes: gardes.length };
    for (const p of classeurtires) { const k = getPlayerKey(p); G.variantes.cartes[k] = meilleureVariante(c.joueurs[k]); }
  } else {
    V = await vestiaireDeDepart(meta, gardes, { saison, rang: G.rogue.prestige || 0, exclus: partants, graine: `${graineDuClasseur()}:s${saison}` });
    for (const x of V.tires) G.variantes.cartes[x.cle] = meilleureVariante(lireCartable().joueurs[x.cle]);
  }
  const roster = V.roster;
  // Les modifs de la saison sont déjà sur leurs cartes (`modsAuCartable`, à la fin de la saison) : chaque carte de l'équipe neuve rejoue les siennes.
  modsAuCartable();
  const report = reportDesCartes(roster);
  for (const p of gardes) G.variantes.cartes[getPlayerKey(p)] = meilleureVariante(lireCartable().joueurs[getPlayerKey(p)]) || G.variantes.cartes[getPlayerKey(p)];
  // 1.0 (J1-F) : la saison neuve repart sans les cicatrices de la précédente — elles sont ce que LA saison laisse.
  const deck = deckDe(L.decisions || [], { serie: L.decisionsSeries || [] }).filter(c => !(CARTES_MATCH[c] && CARTES_MATCH[c].maudite));
  report.push({ jour: 0, deck: 'report', deckDeBase: deck, report: true });
  // v2 : les COACHS continuent — le compte de la fin de saison, et la confiance qu'il avait allumée.
  const decsSaison = decisionsDeLaPartie();
  const compte = buildDe(decsSaison);
  report.push({ jour: 0, coachsDeBase: Object.fromEntries(Object.entries(compte).filter(([, n]) => n > 0)), report: true });
  for (const c of coachsActifs(decsSaison)) { const { jour: _j, ...coach } = c; void _j; report.push({ jour: 0, coach, report: true }); }
  // 1.0 : un patron engagé l'est pour la RUN — il reste en poste à la saison suivante, avec ses chiffres.
  for (const pa of patronsActifs(decsSaison)) { const { jour: _j, remplace: _r, ...patron } = pa; void _j; void _r; report.push({ jour: 0, patron, report: true }); }
  // Les packs scellés pas ouverts passent à la saison suivante, déjà payés.
  packsScelles(decsSaison).forEach((d, i) => report.push({ jour: 0, palier: `k:r${i}`, achat: { pack: d.achat.pack, n: -1 - i, prix: 0, sorte: d.achat.sorte, params: d.achat.params, scelle: true }, report: true }));
  const reste = Math.max(0, jetonsRogue(L.calendrier.length));
  G.lignes = null; G.renfort = null; G.selectedSlot = null;
  G.roster = roster; poserCartes();
  G.rogue = {
    ...G.rogue, saison, series: null, report,
    depart: jetonsDeDepart(meta) + reste, reserves: reservesDeLaRun(meta), bareme: baremeRogue(meta), plafond: null,
  };
  // La saison neuve : ni ligue, ni séries, ni entrée d'historique — `runSeason` les refera.
  G.ligue = null; G.done = false; G.journee = 0; G.seriesVues = null; G.lbId = null; G.series = null; G.seriesMoteur = null; G.banc = null;
  G.rogue.plafond = plafondDeDepart(meta);
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  $('game').classList.remove('bilan');
  saveGame(); render();
  setView('roster');
  const motEquipe = rosterExterne
    ? `${gardes.length ? `${gardes.map(p => p.n).join(', ')} gardés` : 'Nouvelle équipe'}${classeurtires.length ? `, ${classeurtires.length} carte${classeurtires.length > 1 ? 's' : ''} du classeur` : ''}${draftes.length ? `, ${draftes.length} recrue${draftes.length > 1 ? 's' : ''} repêchées` : ''}`
    : `${motDuVestiaire(V).toLowerCase()}${gardes.length ? `, avec ${gardes.map(p => p.n).join(', ')}` : ''}`;
  toast(`Saison ${G.rogue.saison} de la run : ${motEquipe}, et 🪙 ${G.rogue.depart} jetons. Le proprio veut : ${mandatDe(G.rogue.saison).mot}.`);
}
/*
 * LE VESTIAIRE DES DÉBLOCAGES : ce que les écussons achètent, d'une run à
 * l'autre — et les JALONS (S80), l'autre façon de débloquer : chacun paie une
 * fois, un déblocage offert ou des écussons.
 */
/*
 * TON CLUB (1.0, oct.). JP : *que les couleurs, le nom de notre équipe puis des logos, ce soient des
 * choses qu'on débloque au fur et à mesure*. L'écusson porté en grand, puis chaque nom, chaque couleur
 * et chaque écusson, montré SUR ton écusson : ce que tu as se porte d'un toucher ; le reste s'achète en
 * jetons 🪙 à la boutique, comme un pack (JP : *même monnaie que les autres packs*), et les plus beaux
 * attendent un rang de prestige (js/club.js). Rien n'y change le jeu.
 */
/* Le club a changé : son nom, l'en-tête, et les couleurs de l'interface si c'est ton équipe qu'on regarde. */
function clubChange() {
  poserLeClub();
  if (!enRepechage()) applyTeamColors('YOU');
  majEntete();
}
function ouvrirClub(apres = null, onglet = 'nom') {
  const meta = lireMeta(), c = choixDuClub(meta);
  // Trois onglets (huit noms, cinquante couleurs, trente écussons) : ce qui est à toi d'abord.
  const R = RAYONS_CLUB.find(x => x.cle === onglet) || RAYONS_CLUB[0];
  const onglets = `<div class="stat-tabs" role="tablist">${RAYONS_CLUB.map(x => {
    const a = Object.keys(x.liste).filter(k => possede(meta, x.cle, k)).length;
    return `<button type="button" role="tab" class="stat-tab${x === R ? ' on' : ''}" aria-selected="${x === R}" data-onglet="${x.cle}">${esc(x.titre)} · ${a}/${Object.keys(x.liste).length}</button>`;
  }).join('')}</div>`;
  const options = Object.entries(R.liste).map(([k, o]) => {
    const porte = c[R.cle] === k, a = possede(meta, R.cle, k);
    const garde = o.rang && rangDePrestige(meta) < o.rang ? `Prestige : ${PRESTIGES[o.rang].nom}` : '';
    return { cle: `${R.cle}:${k}`, visage: ecussonDe({ ...c, [R.cle]: k }), sous: R.titre, a,
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

export function ouvrirVestiaire(apres = null) {
  const meta = lireMeta();
  // v2 : LE PRESTIGE DU CLUB (js/rogue.js) — l'échelle entière, ce qui est atteint et ce qu'il faut pour la suite.
  const rang = rangDePrestige(meta), vie = ecussonsAVie(meta);
  const jalonDe = k => (JALONS.find(J => J.cle === k) || {}).nom || k;
  const prestige = `<p class="vs-sec">📈 Le prestige du club · ${esc(PRESTIGES[rang].nom)} · 🏅 ${vie} gagnés à vie</p>
    <div class="vs-jalons">${PRESTIGES.map((P, k) => {
      const fait = k <= rang;
      const quoi = `Étoiles ×${String(P.etoile).replace('.', ',')} · Phénomènes ×${String(P.phenomene).replace('.', ',')}${P.classeur ? ` · classeur +${money(P.classeur)}` : ''}`;
      return `<div class="vs-jalon${fait ? ' fait' : ''}"><span class="vs-ico" aria-hidden="true">${fait ? '✓' : k}</span><b>${esc(P.nom)}</b><span>${fait ? esc(quoi) : `${P.min} 🏅 à vie${P.jalon ? ` et « ${esc(jalonDe(P.jalon))} »` : ''} → ${esc(quoi)}`}</span></div>`;
    }).join('')}</div>`;
  // 1.0 : LA VITRINE — tes Coupes, la run, la saison, le coach et les vedettes.
  const vitrine = (meta.vitrine || []).length ? `<p class="vs-sec">🏆 Ta vitrine · ${meta.vitrine.length} Coupe${meta.vitrine.length > 1 ? 's' : ''}</p>
    <div class="vs-jalons">${meta.vitrine.slice().reverse().map(V => `<div class="vs-jalon fait"><span class="vs-ico" aria-hidden="true">🏆</span><b>Run ${V.run} · saison ${V.saison}${COACHS[V.coach] ? ` · ${COACHS[V.coach].ico} ${esc(COACHS[V.coach].nom)}` : ''}</b><span>${esc((V.vedettes || []).join(' · '))}</span></div>`).join('')}</div>` : '';
  const jalons = `${vitrine}${prestige}<p class="vs-sec">🏁 Les jalons · ${JALONS.filter(J => (meta.jalons || {})[J.cle]).length} / ${JALONS.length}</p>
    <div class="vs-jalons">${JALONS.map(J => {
      const fait = !!(meta.jalons || {})[J.cle];
      return `<div class="vs-jalon${fait ? ' fait' : ''}"><span class="vs-ico" aria-hidden="true">${J.ico}</span><b>${esc(J.nom)}</b><span>${fait ? '✓ Atteint' : `${esc(J.texte)} → ${esc(recompenseDe(meta, J).mot)}`}</span></div>`;
    }).join('')}</div>
    <p class="vs-sec">🏅 Les déblocages</p>`;
  ouvrirChoix({
    ico: '🏅', titre: `Les déblocages · ${meta.ecussons || 0} médailles`, fermable: true, motFermer: 'Fermer',
    recit: `Tes médailles se gagnent à chaque saison : un par tranche de deux points, dix par ronde de séries gagnée, vingt de plus pour la Coupe. Les jalons se gagnent en jouant. Ce que tu débloques reste pour toutes les runs. Les cartes de trio (systèmes, styles, atelier, synergies) aident tout de suite, puis plafonnent ; les améliorations d'un joueur et les cartes qui visent l'adversaire grandissent avec la saison, jusqu'en finale.`,
    contexte: jalons,
    options: [{ cle: 'club', visage: ecussonDe(choixDuClub(meta)), nom: `Ton club : ${nomDuClub()}`, bon: 'Le nom, les couleurs et l\'écusson : ceux que tu portes, et ceux qui se débloquent.' },
      ...Object.entries(DEBLOCAGES).map(([k, D]) => {
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

