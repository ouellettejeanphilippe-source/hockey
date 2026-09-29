/*
 * LE MODE ROGUE DANS LE JEU (sorti de js/game.js en 1.0) : les jetons, la
 * boutique et ses packs, l'inventaire et les cartes qu'on joue, le départ du
 * classeur, la run d'une saison à l'autre, le vestiaire des déblocages. La
 * règle et le méta vivent dans js/rogue.js ; ici, ce que l'écran en fait.
 */

import { lireMeta, JETONS, jetonsDe, aDebloque, DEBLOCAGES, ajouterCollection, recevoirPermanents, retirerDuMeta, nombreGardes, departDuClasseur, jetonsDeDepart, reservesDeLaRun, ecrireMeta, budgetDuClasseur, tirageDuClasseur, baremeRogue, mandatDe, PLAFOND_ROGUE, plafondDuVestiaire, ESPACE_DE_DEPART, payerEcussons, ecussonsDeLaSaison, payerJalons, ecussonsDesSeries, mandatRempli, JALONS, recompenseDe, peutAcheter, acheterDeblocage } from './rogue.js';
import { money, esc, hache } from './util.js';
import { getPlayerKey, getPersonKey, SLOTS, MUTATIONS, motsDeMutation, autoRoster, fits, getHiddenRatings, getPositionPenalty, nouvelleGraine, REROLLS } from './sim.js';
import { modificateurs, BANQUE, CATEGORIES, VIES, reglesDe, PATRONS, patronsActifs, MAX_PATRONS, ROLES, payloadDe, CONSOMMABLES, CONTRATS, CASES_DE_BASE } from './banque.js';
import { PACKS_TOUS, packsSansHolo, packDuJour, tirerJoueursDuPack, PITIE, tirerCartesPack } from './packs.js';
import { ouvrirMagasin } from './magasin.js';
import { FRANCHISES } from './franchises.js';
import { state } from './data.js';
import { VENTE, valeurDe, ouvrirInventaire, pocheDeLaPartie } from './inventaire.js';
import { ajouterAuCartable, lireCartable, meilleureVariante } from './cartable.js';
import { ouvrirChoix, optionDeCarteMatch, puces, ouvrirAlignement } from './gerant.js';
import { traitsDeCarte, carteDe } from './rarete.js';
import { PHENOMENE } from './niveaux.js';
import { artJoueur } from './cartes.js';
import { getTeamLogoHtml } from './logos.js';
import { deckDe, CARTES_MATCH } from './combat.js';
import { ageAtSeason } from './ratings.js';
import { ouvrirDepartClasseur } from './depart.js';
import { nombreEnSeries } from './bilan.js';
import { $, G, candidats, capHit, capHitDuJour, capLeft, capUsed, clearSave, contexteDuMenu, headshotHtml, isPicked, plafondEffectif, quiEst, render, saveGame, setView, signes, toast, totalCases } from './game.js';
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
  g.title = `Plafond de la run : ${money(pl.cap)}${lignes.length ? ` — ${lignes.join(' · ')}` : ''}. Masse : ${money(used)}. Jetons : ${jetonsRogue()} 🪙 (la boutique du bureau vend des packs).`;
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
  const ventes = decs.reduce((a, d) => a + ((d.achat || {}).vente || 0) + (d.gain || 0) + ((d.vend || {}).jetons || 0), 0);
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
function packsOuvertsBoutique() {
  const meta = G.bonus === 'ROGUE' ? lireMeta() : null;
  return Object.fromEntries(Object.keys(PACKS_TOUS).map(k => {
    const d = meta && VERROUS_ROGUE[k];
    return [k, !d || aDebloque(meta, d) ? true : `Débloque « ${DEBLOCAGES[d].nom} » au vestiaire des déblocages`];
  }));
}
export function ouvrirBoutique(j, decider) {
  const decs = decisionsDeLaPartie();
  const n = decs.filter(d => d.achat || d.rogue).length;
  ouvrirMagasin({
    jetons: jetonsRogue(j), mode: G.bonus === 'ROGUE' ? 'rogue' : 'saison', ouverts: packsOuvertsBoutique(),
    mods: modificateurs(decs, j + 1), sansHolo: G.bonus === 'ROGUE' ? packsSansHolo(decs) : 0, plafond: plafondPourBoutique(),
    duJour: packDuJour(new Date(), packsOuvertsBoutique()),
    // 1.0 (R5) : à la première run, avant la journée 20, quatre packs ; « Voir les N packs » montre tout.
    debutant: G.bonus === 'ROGUE' && ((G.rogue && G.rogue.numero) || 1) <= 1 && j < 20,
    franchises: Object.entries(FRANCHISES).map(([cle, F]) => ({ cle, nom: F.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    saisons: state.index.seasons.slice().reverse(),
    acheter: (cle, { prix, params }) => {
      const P = PACKS_TOUS[cle];
      const suite = P.sorte === 'cartes' ? ouvrirPackCartes(cle, prix, j, n, decider) : ouvrirPackJoueurs(cle, prix, params, j, n, decider);
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
 * au classeur ; un joueur déjà au classeur est un doublon, revendu tout seul.
 * L'achat est une décision, qu'on signe ou non.
 */
async function ouvrirPackJoueurs(cle, prix, params, j, n, decider) {
  const decs = decisionsDeLaPartie();
  const mods = modificateurs(decs, j + 1);
  const pitie = G.bonus === 'ROGUE' && packsSansHolo(decs) >= PITIE - 1;
  const { cartes, reglage } = await tirerPackJoueurs(cle, n, params, mods, pitie);
  const avant = new Set(lireMeta().collection || []);
  const vendus = [];
  let vente = 0;
  cartes.forEach((x, t) => { x.doublon = avant.has(getPlayerKey(x.p)); if (x.doublon) { vendus.push(t); vente += venteJoueur(x); } });
  const meilleure = ['legendaire', 'rare', 'peu', 'commune'].find(r => cartes.some(x => x.rar === r)) || 'commune';
  const achat = { pack: cle, n, prix, sorte: 'joueurs', params: reglage, meilleure, vente, ...(vendus.length ? { vendus } : {}), ...(pitie ? { pitie: true } : {}) };
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
  const mods = modificateurs(decs, j + 1);
  const { cartes, reglage } = await tirerPackJoueurs(achat.pack, achat.n, achat.params || {}, mods, !!achat.pitie);
  cartes.forEach((x, t) => { x.doublon = (achat.vendus || []).includes(t); });
  offrirPackJoueurs({ cle: achat.pack, cartes, reglage, pitie: !!achat.pitie, vente: achat.vente || 0, n: achat.n, j, decider });
}
/* Le paquet se déchire (js/gerant.js) ; on en signe UN (« Signer », puis QUI SORT — `choisirQuiSort`), ou personne. */
function offrirPackJoueurs({ cle, cartes, reglage, pitie, vente, n, j, decider }) {
  const P = PACKS_TOUS[cle];
  const palier = `k:${n}:signe`;
  for (const x of cartes) ballottageVu.set(getPlayerKey(x.p), x.p);
  const titre = `${P.nom}${reglage.franchise ? ` · ${FRANCHISES[reglage.franchise].nom}` : reglage.saison ? ` · ${reglage.saison}` : reglage.club ? ` · ${reglage.club}` : ''}`;
  const offrir = () => ouvrirChoix({
    ico: P.ico, titre, cartes: true, genre: 'recompense', fermable: true, motFermer: 'Ne signer personne',
    recit: `${cartes.length} vrais joueurs${pitie ? ' — la garantie a joué : une holo, au moins' : ''}. Tu en signes un, et tu choisis qui lui laisse sa place ; les autres vont à ton classeur.${vente ? ` Les doublons se revendent : +${vente} 🪙.` : ''}`,
    options: cartes.map(x => {
      const g = groupeDe(x.p);
      const bonus = traitsDeCarte(carteDe(x.rar, g === 'G', getPlayerKey(x.p), x.rar, x.num || 0));
      return {
        // S80 : son niveau ordonne aussi le retournement (le Phénomène en dernier, avec l'éclat d'une holo).
        cle: getPlayerKey(x.p), rarete: x.rar, rang: x.niveau, eclat: x.niveau === PHENOMENE, nom: x.p.n, type: `${POSTE_GROUPE[g]} · ${x.p.t} ${x.p.s}`, coin: money(x.p.$),
        art: artJoueur({ portraitHtml: headshotHtml(x.p), logoHtml: getTeamLogoHtml(x.p.t, 24), pos: esc(POSTE_GROUPE[g]), saison: esc(x.p.s), club: esc(x.p.t) }),
        carteJoueur: miniAvecVariante(x.p, x.rar),
        // Son NIVEAU en un mot (S80), sauf quand le ruban de la carte le dit déjà.
        texte: [niveauHorsRuban(x.p, x.niveau), ligneDuChoix(x.p), x.num ? `✦ Or numérotée ${x.num}` : '', ...bonus.map(b => `${b.ico} ${b.nom} — ${b.mot}`)].filter(Boolean).join('\n'),
        desactive: x.doublon ? `Doublon : revendu ${venteJoueur(x)} 🪙` : '',
        apercu: () => apercuJoueur(x.p),
      };
    }),
    onChoix: k => {
      const x = cartes.find(y => getPlayerKey(y.p) === k);
      if (!x || x.doublon) return;
      const signer = sortie => {
        if (!sortie) return;
        G.variantes.cartes[k] = x.rar;
        if (x.num) (G.variantes.numeros = G.variantes.numeros || {})[k] = x.num;
        decider({ jour: j, palier, ballottage: { i: sortie.i, entre: k, sort: sortie.sort, rar: x.rar, ...(x.num ? { num: x.num } : {}) } });
      };
      // QUI SORT : la sortie doit faire entrer son salaire sous le plafond (effectif), ou au moins ne pas l'empirer.
      quiSortOuCaseLibre(x.p, { roster: G.roster, genre: 'recompense', bloque: q => bloqueParLePlafond(x.p, q), note: q => `libère ${money(capHitDuJour(q))}`, onChoix: signer, onFerme: offrir });
    },
    onFerme: () => decider({ jour: j, palier, signe: false }),
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
  return { cle: id, rarete: c.rarete === 'maudite' ? 'commune' : c.rarete, ico: c.ico, nom: c.nom,
    type: c.rarete === 'maudite' ? `Malédiction · ${CATEGORIES[c.cat].un}` : `${CATEGORIES[c.cat].un} · ${(VIES[c.vie] || VIES.saison).nom}`, texte: c.texte, mots: reglesDe(id) };
}
/*
 * L'OUVERTURE D'UN PACK DE CARTES : tout va dans l'inventaire. En Rogue, le
 * personnel et les consommables permanents partent au MÉTA (gardés d'une run
 * à l'autre) — une fois, par achat (`recevoirPermanents`) ; un patron qu'on
 * possède déjà est un doublon, revendu. Le reste va dans la poche de la saison.
 * UNE MALÉDICTION (la taxe de luxe, que certains packs cachent) ne se range
 * pas : elle frappe à l'ouverture (`achat.maudites`, lu par `plafondDe`).
 */
function ouvrirPackCartes(cle, prix, j, n, decider) {
  const P = PACKS_TOUS[cle], Lg = G.ligue;
  const tirees = tirerCartesPack(P.cle, Lg.graine, n);
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
  const achat = { pack: cle, n, prix, sorte: 'cartes', cartes: ids, ...(vendus.length ? { vendus, vente } : {}), ...(maudites.length ? { maudites } : {}) };
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
export function ouvrirInventaireJeu(j = null, decider = null) {
  const Lg = G.ligue, decs = decisionsDeLaPartie();
  const rogue = G.bonus === 'ROGUE';
  const meta = lireMeta();
  const enSaison = !!(Lg && decider && j !== null);
  const possedees = new Set((meta.cartes || []).map(k => (BANQUE[k] ? k : BANQUE[`match:${k}`] ? `match:${k}` : null)).filter(Boolean));
  ouvrirInventaire({
    titre: 'Ton inventaire', mode: rogue ? 'rogue' : 'saison', enSaison, peutJouer: enSaison, jetons: enSaison ? jetonsRogue(j) : null,
    partie: enSaison ? pocheDeLaPartie({ decisions: decs, graine: Lg.graine, jour: j, rogue }) : [],
    meta: rogue ? Object.entries(meta.inventaire || {}).map(([id, n]) => ({ id, n })).filter(x => BANQUE[x.id] && x.n > 0) : [],
    personnel: rogue ? (meta.personnel || []).filter(k => PATRONS[k]) : [],
    patronsActifs: enSaison ? patronsActifs(decs, j + 1) : [], maxPatrons: MAX_PATRONS,
    deck: enSaison ? deckDe(Lg.decisions || []) : [],
    possedees, joueursCollection: Object.keys(lireCartable().joueurs).length,
    plafond: plafondPourInventaire(enSaison ? j : (G.journee || 0)),
    jouer: item => jouerCarte(item, j, decider),
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
  return pocheDeLaPartie({ decisions: decisionsDeLaPartie(), graine: Lg.graine, jour: j, rogue }).length
    + (meta ? Object.values(meta.inventaire || {}).reduce((a, n) => a + n, 0) : 0);
}
/*
 * JOUER UNE CARTE DE L'INVENTAIRE : sa cible (un joueur, un blessé, une
 * malédiction du deck, une carte à améliorer, un système), puis UNE décision
 * datée d'aujourd'hui (`joue` dit d'où elle sort, pour la poche). Un
 * consommable permanent quitte le méta à ce moment-là.
 */
function jouerCarte(item, j, decider) {
  const c = BANQUE[item.id];
  if (!c || !decider) return;
  const Lg = G.ligue, decs = decisionsDeLaPartie(), you = Lg.you;
  const joue = { src: item.src, id: item.id, ...(item.ref ? { ref: item.ref } : {}) };
  const retour = () => ouvrirInventaireJeu(j, decider);
  const ecrire = payload => {
    if (!payload) return;
    if (item.src === 'meta') retirerDuMeta(item.id);
    decider({ jour: j, joue, ...payload });
  };
  const listeJoueurs = (titre, recit, liste, choisir, mots = null) => ouvrirChoix({
    ico: c.ico, titre, compact: true, fermable: true, motFermer: 'Retour', recit,
    contexte: mots ? `<div class="choix-puces">${puces(mots)}</div>` : '',
    options: liste.map(({ p, sous }) => ({ cle: getPlayerKey(p), visage: headshotHtml(p), nom: p.n, sous })),
    onChoix: choisir, onFerme: retour,
  });
  if (c.cat === 'patron') {
    const actifs = patronsActifs(decs, j + 1);
    if (!actifs.some(x => x.role === c.role) && actifs.length >= MAX_PATRONS) {
      ouvrirChoix({ ico: '👔', titre: `${c.nom} : qui part ?`, compact: true, fermable: true, motFermer: 'Retour',
        recit: `${MAX_PATRONS} postes au plus. ${c.nom} prend la place de qui ?`,
        options: actifs.map(x => ({ cle: x.cle, ico: x.ico, nom: x.nom, sous: ROLES[x.role] ? ROLES[x.role].nom : '' })),
        onChoix: k => { const p = payloadDe(item.id, { patrons: actifs }); p.patron.remplace = [...(p.patron.remplace || []), k]; ecrire(p); },
        onFerme: retour });
      return;
    }
    ecrire(payloadDe(item.id, { patrons: actifs }));
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
        options: uniques.map(k => ({ ...optionDeCarteMatch(C.cible === 'carteMatch' ? `${k}+` : k), cle: k })),
        onChoix: k => ecrire(payloadDe(item.id, { carte: k })), onFerme: retour });
      return;
    }
    if (C.cible === 'tactique') {
      ouvrirChoix({ ico: c.ico, titre: c.nom, compact: true, fermable: true, motFermer: 'Retour', recit: c.texte,
        options: Object.entries(TACTIQUES).filter(([k]) => k !== 'hourra').map(([k, T]) => ({ cle: k, ico: T.ico, nom: T.nom, sous: T.mot })),
        onChoix: k => ecrire(payloadDe(item.id, { tactique: k })), onFerme: retour });
      return;
    }
    ecrire(payloadDe(item.id, { alea: hache(Lg.graine, 'billet', item.ref || item.id, j) }));
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
  ecrire(payloadDe(item.id));
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
    recit: `${M.quoi} Touche un joueur : sa carte se retourne, et tu la poses sur une case libre de son verso (${CASES_DE_BASE} par carte, une de plus pour une holo ou une or). Elle y reste pour la saison.`,
    contexte: `<div class="choix-puces">${puces(motsDeMutation(c.cle))}</div>`,
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
  return placerDevant(autoRoster([...gardes, ...pool]), gardes);
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
      recit: 'Ta dernière équipe : celui que tu touches te suit dans cette run, avec ta nouvelle bande de plombiers.',
      options: joueurs.map(p => ({ cle: getPlayerKey(p), rarete: rareteJoueur(p), nom: p.n, type: `${POSTE_GROUPE[groupeDe(p)]} · ${p.t} ${p.s}`, coin: money(p.$),
        art: artJoueur({ portraitHtml: headshotHtml(p), logoHtml: getTeamLogoHtml(p.t, 24), pos: esc(POSTE_GROUPE[groupeDe(p)]), saison: esc(p.s), club: esc(p.t) }),
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
    recit: `Une équipe de plombiers, 🪙 ${jetonsDeDepart(meta)} jetons, plusieurs saisons. Chaque saison, le proprio en veut plus ; la Coupe finit la run.`,
    options: [{ cle: 'go', ico: '▶', nom: `Commencer la run ${(meta.runs || 0) + 1}`,
      bon: [nCartable ? `📒 ${D.n} carte${D.n > 1 ? 's' : ''} de ton classeur, ${MODE_CLASSEUR[D.mode]}` : '',
        `${Object.keys(PACKS_TOUS).filter(k => !VERROUS_ROGUE[k] || aDebloque(meta, VERROUS_ROGUE[k])).length} packs à la boutique`,
        k ? `tu gardes ${k} joueur${k > 1 ? 's' : ''} de ta dernière équipe` : '', reservesDeLaRun(meta) ? `🪑 ${3 + reservesDeLaRun(meta)} réservistes` : '',
        aDebloque(meta, 'deckPlus') ? 'un deck aiguisé' : ''].filter(Boolean).join(' · '),
      prix: `🏅 ${meta.ecussons || 0} écussons · ${meta.runs || 0} run${(meta.runs || 0) > 1 ? 's' : ''} · 🏆 ${meta.coupes || 0} · 📒 ${nCartable} carte${nCartable > 1 ? 's' : ''} au cartable` }],
    onChoix: () => resolve(true),
    onFerme: () => resolve(false),
  }));
  if (!go) return;
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
  await sousVoile('On rassemble tes plombiers…', () => demarrerRogue(gardes, tires));
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
async function demarrerRogue(gardes = [], tires = []) {
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
  G.roster = await plombiers(meta, [...gardes, ...tires.map(x => x.p)]);
  // La run commence : elle prend son numéro (le tirage du classeur suivant change).
  const m = lireMeta();
  m.runs = (m.runs || 0) + 1;
  ecrireMeta(m);
  G.rogue = {
    depart: jetonsDeDepart(meta), deckPlus: aDebloque(meta, 'deckPlus'), gardes: gardes.map(getPlayerKey), plafond: plafondDeDepart(meta),
    // S80 : la run sur plusieurs saisons, ses cases de réserve, et ce que le classeur a donné.
    numero: m.runs, saison: 1, reserves: reservesDeLaRun(meta), bareme: baremeRogue(meta),
    classeur: { mode: D.mode, n: D.n, pris: tires.map(x => x.cle) },
    // 1.0 (R7) : ce que l'écran « Ta run » comparera à la fin — le cartable au départ, les écussons et les jalons de la run.
    cartableDepart: Object.keys(lireCartable().joueurs).length, ecussonsRun: 0, jalonsRun: [],
  };
  saveGame(); syncOptionsUI(); render();
  setView('roster');
  const noms = [...gardes.map(p => p.n), ...tires.map(x => x.p.n)];
  toast(`Tes plombiers sont là${noms.length ? `, avec ${noms.join(', ')}` : ''}. Le proprio veut : ${mandatDe(1).mot}. Lance la saison quand tu veux : la boutique t'attend au bureau.`);
}
/*
 * LE PLAFOND D'UNE SAISON DE LA RUN : 82 M$, plus ce que le vestiaire a
 * débloqué. La première saison garde au moins 12 M$ d'espace au-dessus de la
 * masse de départ (trois vedettes gardées de la dernière run ne doivent pas
 * bloquer la saison). Les saisons SUIVANTES (S80) repartent de leur masse,
 * jamais plus haut : sinon chaque saison gagnerait 12 M$ d'espace et le
 * plafond ne voudrait plus rien dire au bout de trois saisons.
 */
function plafondDeDepart(meta, { suite = false } = {}) {
  const lignes = [];
  let cap = PLAFOND_ROGUE;
  const v = plafondDuVestiaire(meta);
  if (v) { cap += v; lignes.push({ nom: 'Le vestiaire', montant: v }); }
  const masse = signes().reduce((a, p) => a + (p.$ || 0), 0);
  const min = suite ? masse : Math.ceil((masse + ESPACE_DE_DEPART) / 100_000) * 100_000;
  if (cap < min) { lignes.push({ nom: 'Ta masse de départ', montant: min - cap }); cap = min; }
  return { cap, lignes };
}
/*
 * LA FIN D'UNE SAISON ROGUE : les écussons (payés une fois, `payerEcussons`
 * s'en souvient), les jalons de la saison, et le sort de la run — le mandat
 * de la première saison se lit ici (les séries), les autres aux séries.
 */
export const numeroDeSaison = () => (G.rogue && G.rogue.saison) || 1;
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
    saisonDeLaRun: numeroDeSaison(), cartes: Object.keys(lireCartable().joueurs).length };
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
  if (n) setTimeout(() => toast(`🏅 +${n} écussons pour ta saison (${f.pts} points) — dépense-les au vestiaire.`), 900);
  compterEcussonsRun(n);
  direJalons(payerJalons(f));
  majRunRogue();
}
/* Et ceux des séries : dix par ronde gagnée, vingt de plus pour la Coupe ; les jalons des séries ; le sort de la run. */
export function finDesSeriesRogue(rondes, coupe, { payer = true } = {}) {
  if (G.bonus !== 'ROGUE' || !G.ligue) return;
  G.rogue = G.rogue || {};
  G.rogue.series = { rondes, coupe: !!coupe };
  if (payer) {
    const n = payerEcussons(G.ligue.graine, 'series', ecussonsDesSeries(rondes, coupe), { bilan: { ronde: rondes, coupe: !!coupe } });
    if (n) setTimeout(() => toast(`🏅 +${n} écussons pour tes séries${coupe ? ' — et la Coupe !' : ''}`), 900);
    compterEcussonsRun(n);
    const S = G.seriesMoteur;
    const finale = !!(S && S.toutes.some(s => s.ronde === S.nRondes - 1 && (s.A.isPlayer || s.B.isPlayer)));
    direJalons(payerJalons({ ...faitsDeLaSaison(), rondes, coupe: !!coupe, finale }));
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
    attente: `Le proprio veut : ${M.mot}. ${faitsDeLaSaison().series ? 'Tes séries le diront.' : ''}`,
    continue: `Mandat rempli : ${M.mot}. La run continue avec ton équipe, ton deck et tes modifs jouées. La saison ${n + 1}, le proprio voudra : ${suivant.mot}.`,
    finie: `Mandat manqué — il fallait ${M.mot}. La run est finie après ${n} saison${n > 1 ? 's' : ''}. Tes écussons, tes jalons et ton cartable restent.`,
    gagnee: `La Coupe Stanley, à la saison ${n} de la run : la run est gagnée ! Tes écussons, tes jalons et ton cartable restent.`,
  };
  bloc.className = `rg-run ${sort}`;
  bloc.innerHTML = `<div class="rg-run-tete"><span>${sort === 'gagnee' ? '🏆' : sort === 'finie' ? '🚪' : '💀'} Run ${(G.rogue && G.rogue.numero) || ''} · saison ${n}</span>
      <small>${s ? `${s.rondes} ronde${s.rondes > 1 ? 's' : ''} gagnée${s.rondes > 1 ? 's' : ''}` : ''}</small></div>
    <p class="rg-run-mot">${esc(mots[sort])}</p>
    ${sort === 'continue' ? '<p class="rg-run-suite">Ce qui te suit : ton alignement et tes réservistes, ton deck de match, les améliorations, styles et éditions joués sur tes joueurs, tes jetons qui restent (plus ta caisse), ton personnel et tes cartes permanentes. Ce qui expire : les cartes « cette saison » et les consommables de ta poche.</p>' : ''}
    <div class="rg-run-boutons">
      ${sort === 'continue' ? `<button type="button" class="btn gold rg-suivante">▶ Saison ${n + 1} de la run</button>` : ''}
      ${sort === 'finie' || sort === 'gagnee' ? '<button type="button" class="btn gold rg-nouvelle">▶ Nouvelle run</button>' : ''}
      <button type="button" class="btn rg-vestiaire">🏅 Le vestiaire · ${lireMeta().ecussons || 0}</button>
    </div>`;
  // 1.0 (R7) : la run finie ou gagnée s'ouvre UNE fois en plein écran, avant qu'on reparte.
  if ((sort === 'finie' || sort === 'gagnee') && G.rogue && !G.rogue.taRunVue) montrerTaRun(sort, n, s);
  const b1 = bloc.querySelector('.rg-suivante');
  if (b1) b1.onclick = () => sousVoile('La saison suivante se prépare…', continuerRun);
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
  ecrireMeta(meta);
  saveGame();
  const ligne = (k, v) => `<div class="run-l"><span class="run-k">${esc(k)}</span><b class="run-v">${v}</b></div>`;
  ouvrirChoix({
    ico: sort === 'gagnee' ? '🏆' : '🚪', titre: 'Ta run', genre: 'run', fermable: true, motFermer: 'Compris',
    irl: `Run ${d.numero} · ${n} saison${n > 1 ? 's' : ''}`,
    recit: sort === 'gagnee' ? `La Coupe Stanley, à la saison ${n} de la run.` : `Mandat manqué : il fallait ${esc(M.mot)}.`,
    contexte: `<div class="run-bilan">
      ${ligne('Saisons jouées', n)}
      ${ligne('Le sort', esc(motDeRun(d)))}
      ${ligne('Écussons gagnés par la run', `🏅 +${d.ecussons}`)}
      ${ligne('Jalons débloqués', d.jalons.length ? esc(d.jalons.join(' · ')) : 'aucun')}
      ${entrees != null ? ligne('Cartes entrées au cartable', `📒 +${entrees}`) : ''}
      ${ligne('Ton vestiaire', `🏅 ${meta.ecussons || 0} écussons · 📒 ${nCartable} carte${nCartable > 1 ? 's' : ''}`)}
    </div>`,
    options: [], onChoix: () => {},
  });
}
/*
 * LA SAISON SUIVANTE DE LA RUN (S80). JP : *nouvelle saison veut dire
 * continuer avec base des cartes ramassé qui sont pas des consommables*.
 * Ce qui continue, et comment :
 *   - l'ALIGNEMENT : `G.roster` est celui du moteur, signatures comprises ;
 *   - les MODIFS JOUÉES qui durent (améliorations, styles, l'atelier) : des
 *     décisions du jour 0 de la saison neuve (`report`), rejouées comme les
 *     autres ; le lustre passe par la variante de la carte ;
 *   - le DECK de match : la saison neuve part du deck de la fin (`deckDeBase`) ;
 *   - les JETONS qui restent, plus la caisse du vestiaire ;
 *   - le PLAFOND repart de la masse, jamais plus haut (`plafondDeDepart`).
 * Le personnel et les cartes permanentes vivent déjà dans le méta. Les
 * cartes « cette saison » et les consommables de la poche expirent : la poche
 * se déduit des décisions de la saison, et la saison neuve n'en a pas.
 */
const SOURCES_DE_RUN = new Set(['amelioration', 'style', 'atelier']);
async function continuerRun() {
  if (G.bonus !== 'ROGUE' || !G.ligue || sortDeLaRun() !== 'continue') return;
  const L = G.ligue, you = L.you, meta = lireMeta();
  const garder = new Set(Object.values(G.roster).filter(Boolean).map(getPlayerKey));
  const report = [];
  for (const m of you.mutations || []) {
    const M = MUTATIONS[m.cle];
    if (!M || !SOURCES_DE_RUN.has(M.source) || !garder.has(m.joueur) || m.cle === 'physio') continue;
    if (m.cle === 'lustre') continue;
    report.push({ jour: 0, mutation: { cle: m.cle, joueur: m.joueur }, report: true });
  }
  // Le lustre : la variante que la carte a prise reste la sienne.
  for (const d of decisionsDeLaPartie()) if (d.mutation && d.mutation.cle === 'lustre' && d.mutation.carte && garder.has(d.mutation.joueur)) G.variantes.cartes[d.mutation.joueur] = d.mutation.carte.rar;
  // 1.0 (J1-F) : la saison neuve repart sans les cicatrices de la précédente — elles sont ce que LA saison laisse.
  const deck = deckDe(L.decisions || [], { serie: L.decisionsSeries || [] }).filter(c => !(CARTES_MATCH[c] && CARTES_MATCH[c].maudite));
  report.push({ jour: 0, deck: 'report', deckDeBase: deck, report: true });
  const reste = Math.max(0, jetonsRogue(L.calendrier.length));
  G.lignes = Array.isArray(you.lignes) ? you.lignes.map(l => ({ ...l })) : G.lignes;
  G.rogue = {
    ...G.rogue, saison: numeroDeSaison() + 1, series: null, report,
    depart: jetonsDeDepart(meta) + reste, reserves: reservesDeLaRun(meta), bareme: baremeRogue(meta), plafond: null,
  };
  // La saison neuve : ni ligue, ni séries, ni entrée d'historique — `runSeason` les refera.
  G.ligue = null; G.done = false; G.journee = 0; G.seriesVues = null; G.lbId = null; G.series = null; G.seriesMoteur = null; G.banc = null;
  G.rogue.plafond = plafondDeDepart(meta, { suite: true });
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  $('game').classList.remove('bilan');
  saveGame(); render();
  setView('roster');
  toast(`Saison ${G.rogue.saison} de la run : ton équipe continue, avec 🪙 ${G.rogue.depart} jetons. Le proprio veut : ${mandatDe(G.rogue.saison).mot}.`);
}
/*
 * LE VESTIAIRE DES DÉBLOCAGES : ce que les écussons achètent, d'une run à
 * l'autre — et les JALONS (S80), l'autre façon de débloquer : chacun paie une
 * fois, un déblocage offert ou des écussons.
 */
export function ouvrirVestiaire(apres = null) {
  const meta = lireMeta();
  const jalons = `<p class="vs-sec">🏁 Les jalons · ${JALONS.filter(J => (meta.jalons || {})[J.cle]).length} / ${JALONS.length}</p>
    <div class="vs-jalons">${JALONS.map(J => {
      const fait = !!(meta.jalons || {})[J.cle];
      return `<div class="vs-jalon${fait ? ' fait' : ''}"><span class="vs-ico" aria-hidden="true">${J.ico}</span><b>${esc(J.nom)}</b><span>${fait ? '✓ Atteint' : `${esc(J.texte)} → ${esc(recompenseDe(meta, J).mot)}`}</span></div>`;
    }).join('')}</div>
    <p class="vs-sec">🏅 Les déblocages</p>`;
  ouvrirChoix({
    ico: '🏅', titre: `Le vestiaire · ${meta.ecussons || 0} écussons`, fermable: true, motFermer: 'Fermer',
    recit: `Tes écussons se gagnent à chaque saison : un par tranche de deux points, dix par ronde de séries gagnée, vingt de plus pour la Coupe. Les jalons se gagnent en jouant. Ce que tu débloques reste pour toutes les runs. Les cartes de trio (systèmes, styles, atelier, synergies) aident tout de suite, puis plafonnent ; les améliorations d'un joueur et les cartes qui visent l'adversaire grandissent avec la saison, jusqu'en finale.`,
    contexte: jalons,
    options: Object.entries(DEBLOCAGES).map(([k, D]) => {
      const pris = aDebloque(meta, k);
      const manque = D.requis && !aDebloque(meta, D.requis) ? `Demande d'abord : ${DEBLOCAGES[D.requis].nom}` : null;
      return { cle: k, ico: D.ico, nom: `${D.nom}${pris ? ' ✓' : ` · ${D.prix} 🏅`}`, bon: D.texte,
        desactive: pris ? 'Débloqué' : manque || ((meta.ecussons || 0) < D.prix ? `Il te manque ${D.prix - (meta.ecussons || 0)} 🏅` : null) };
    }),
    onChoix: k => {
      if (peutAcheter(lireMeta(), k) && acheterDeblocage(k)) toast(`${DEBLOCAGES[k].ico} ${DEBLOCAGES[k].nom} : débloqué.`);
      ouvrirVestiaire(apres);
      if (apres) apres();
    },
  });
}

