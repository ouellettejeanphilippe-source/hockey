/*
 * LE ROGUE NEUF, À L'ÉCRAN (V28, docs/refonte-v28.md § 4.1 ; JP, 9 nov. 2026 : la boucle, oui ; C partout). La coquille de la
 * run : une scène plein écran (`#runModal`), un plan fixe de 390 × 844 mis à l'échelle de l'écran, aucune page qui défile,
 * ni en-tête de site, ni onglets. Ce module charge la décennie, ouvre ou reprend la séance (js/run.js), garde la run à
 * chaque geste (`cap82_run`), et joue les gestes des scènes (js/run-scenes.js : chaque bouton porte `data-a`).
 *
 * Quitter en plein match reprend à la feuille du soir : rien n'est compté avant « Continuer » (`conclure`), et la graine
 * rejoue le même match.
 */
import { state } from './data.js';
import { getShard } from './repechage.js';
import { actionsDisponibles } from './actions.js';
import { avecHasardIsole, getPersonKey, getPlayerKey, nouvelleGraine, periodeDe } from './sim.js';
import { plansDuDuel, poserClubLu } from './impact.js';
import { chargerCoachs, lotoDesCoachs } from './coachs-reels.js';
import { ecrireMeta, lireMeta, payerEcussons, rangDePrestige, voiesOuvertes, cranOuvert, ouvrirUneVoie, solderLesDeblocages } from './rogue.js';
import { VOIES } from './coachs.js';
import { rayonsDuClub, prendreAuClub, nomDuClub } from './club.js';
import { ajouterAuCartable, coachAuCartable, coachsDuCartable } from './cartable.js';
import { tirerJoueursDuPack } from './packs.js';
import { sceneDe, nomDOption } from './histoires.js';
import { motsDe } from './effets.js';
import { carteHtml } from './cartes.js';
import { nomCourt } from './recit.js';
import { jouerSon } from './sons.js';
import { notable, pic } from './mouvement.js';
import { esc, hache } from './util.js';
import { VERSION } from './version.js';
import { RATINGS_VERSION } from './ratings.js';
import {
  RUN, VERSION_DE_LA_RUN, creerLaRun, ouvrirSeance, figer, forcesDuMonde, allerA, chanceCeSoir, intentionCeSoir, jeuDe, jouerLeMatch, conclure, signer, passerLesPortes,
  relancerLesPortes, apresLesPortes, apresLaFinDActe, pieceReglee, prendreLaPiece, acheterLaPiece, acheterLaPochette, avancer, reposer, monterUneCarte, echangerDeuxCases,
  choisirLeFilet, fixerLElite, allerAuMatchDeSerie, histoireDeLaCase, repondre, finir, reglesDe,
} from './run.js';
import {
  sceneAttente, sceneDepart, sceneCarte, sceneAnnonce, sceneFeuille, sceneMatch, scenePortes, scenePorte, sceneEchange, sceneLignes, sceneBanc, sceneMarche,
  sceneVestiaire, sceneHistoire, sceneFinDActe, scenePieceGagnee, sceneSeries, sceneFin, scenePause, jaugeDeCeSoir, sceneClub, sceneSolde,
} from './run-scenes.js';

const CLE = 'cap82_run';
const LARGEUR = 390, HAUTEUR = 844, ECHELLE_MAX = 1.25;
/* Le rythme des temps forts : un toutes les `PAS` ms à la vitesse ×1 ; la chance de la feuille du soir, en tranches de `TRANCHE` matchs. */
const PAS = 2200, VITESSES = [1, 2, 4], TRANCHES = 4, TRANCHE = 30;

let racine = null, plan = null, S = null, V = {}, ctx = null, minuterie = null;
/* Le monde d'une run : toutes les saisons (JP : *toutes les années ensemble*). La même fonction `shard` d'une run à l'autre : js/run.js ne classe les clubs qu'une fois par visite. */
const SHARDS = new Map(), LOT = 6;
const shardCharge = s => SHARDS.get(s) || null;
const donnees = () => ({ saisons: state.index.seasons, shard: shardCharge, forces: forcesGardees() });
/*
 * LES FORCES DU MONDE, gardées d'une visite à l'autre (`cap82_run_monde`, un cache, pas une sauvegarde) : classer 1 400 clubs
 * coûte cinq secondes à un téléphone. Elles valent pour une version du jeu, des cotes et un nombre de saisons ; sinon, on reclasse.
 */
const CLE_MONDE = 'cap82_run_monde';
const signature = () => `${VERSION}:${RATINGS_VERSION}:${state.index.seasons.length}`;
let forces = undefined;
function forcesGardees() {
  if (forces === undefined) { try { const m = JSON.parse(localStorage.getItem(CLE_MONDE) || 'null'); forces = m && m.v === signature() ? m.forces : null; } catch { forces = null; } }
  return forces;
}
function garderLesForces() {
  if (forces || !S) return;
  forces = forcesDuMonde(S);
  try { localStorage.setItem(CLE_MONDE, JSON.stringify({ v: signature(), forces })); } catch { /* le stockage plein : on reclassera */ }
}
const pause = ms => new Promise(ok => setTimeout(ok, ms));

/* ---------- la sauvegarde ---------- */
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { return null; } };
function garder() { if (S) { figer(S); try { localStorage.setItem(CLE, JSON.stringify(S.R)); } catch { /* le stockage plein : la run continue en mémoire */ } } }
const oublier = () => { try { localStorage.removeItem(CLE); } catch { /* rien à oublier */ } };

/* ---------- la coquille ---------- */
function echelle() { if (plan) plan.style.setProperty('--rn-k', String(Math.min(ECHELLE_MAX, window.innerWidth / LARGEUR, window.innerHeight / HAUTEUR))); }
function montrer(html, { rouge = false } = {}) {
  plan.className = `rn-plan${rouge ? ' rn-rouge' : ''}`;
  plan.innerHTML = html;
}
/* Charger chaque saison, `LOT` à la fois (IndexedDB les garde après la première visite) ; l'attente dit où on en est. */
async function charger(mot) {
  const saisons = state.index.seasons.filter(s => !SHARDS.has(s));
  // Les photos d'action des cartes (js/actions.js) : sans leur liste, chaque carton sort sans photo.
  await Promise.resolve(actionsDisponibles()).catch(() => null);
  for (let k = 0; k < saisons.length; k += LOT) {
    montrer(sceneAttente(`${mot} ${Math.min(saisons.length, k + LOT)} saisons sur ${saisons.length}…`));
    await Promise.all(saisons.slice(k, k + LOT).map(async s => { SHARDS.set(s, await getShard(s)); }));
  }
  if (saisons.length) { montrer(sceneAttente('On classe les clubs de toutes les époques…')); await pause(30); }
}
function fermer() {
  clearTimeout(minuterie);
  window.removeEventListener('resize', echelle);
  if (racine) racine.remove();
  document.body.classList.remove('run-ouverte');
  racine = plan = S = null; V = {};
  if (ctx && ctx.onFerme) ctx.onFerme();
}
/* Ouvrir le Rogue neuf : la run gardée reprend où elle en était ; sinon, le départ. */
export async function ouvrirRun(c = {}) {
  ctx = c; V = {};
  racine = document.createElement('div');
  racine.id = 'runModal'; racine.className = 'rn-racine';
  racine.setAttribute('role', 'dialog'); racine.setAttribute('aria-modal', 'true'); racine.setAttribute('aria-label', 'Le Rogue');
  racine.innerHTML = '<div class="rn-plan"></div>';
  plan = racine.firstElementChild;
  document.body.append(racine);
  document.body.classList.add('run-ouverte');
  echelle();
  window.addEventListener('resize', echelle);
  racine.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled && racine.contains(b)) geste(b.dataset.a, b.dataset.v); });
  const R = lire();
  // Une run gardée d'une autre version (une seule décennie) ne se relit pas : la run neuve la remplace.
  if (R && R.v === VERSION_DE_LA_RUN) {
    montrer(sceneAttente('On rouvre les vestiaires…'));
    await charger('On rouvre les vestiaires :');
    S = ouvrirSeance(donnees(), R);
    garderLesForces();
    poserClubLu(() => ({ team: S.toi }));
    return entrer();
  }
  return versLeDepart();
}
async function versLeDepart() {
  S = null; V = {};
  montrer(sceneAttente('On sort les dossiers des coachs…'));
  const solde = soldeAMontrer(), meta = lireMeta(), coachs = await chargerCoachs().catch(() => null), graine = nouvelleGraine(), cranMax = cranOuvert(meta);
  V = { ecran: solde ? 'solde' : 'depart', solde, graine, coach: 0, numero: (meta.runs || 0) + 1, medailles: meta.ecussons || 0, cranMax, cran: Math.min(meta.cran || 0, cranMax),
    loto: lotoDesCoachs(coachs, voiesOuvertes(meta), `${graine}:chef`, 3, coachsDuCartable(), meta.nouvelle || null) };
  rendre();
}
/*
 * LE SOLDE DE L'ANCIEN ROGUE (js/rogue.js `solderLesDeblocages`), une fois : fait au premier départ ou à la première visite
 * du Club ; son écran seulement s'il a quelque chose à dire (un remboursement, des philosophies gardées, une run arrêtée).
 */
function soldeAMontrer() {
  solderLesDeblocages();
  const m = lireMeta(), s = m.solde;
  if (!s || s.vu) return null;
  if (!s.rendu && !s.voies.length && !m.arret) { ecrireMeta({ ...m, solde: { ...s, vu: true } }); return null; }
  return { ...s, arret: m.arret || null, apres: m.ecussons || 0 };
}
const soldeVu = () => { const m = lireMeta(); if (m.solde) ecrireMeta({ ...m, solde: { ...m.solde, vu: true } }); V.solde = null; };
/*
 * LE CLUB, entre deux runs (docs/refonte-v28-5.md § 3.1) : ce que ses scènes lisent (`V.club`), relu du méta après chaque
 * achat. `retour` : d'où on vient (le départ, ou l'écran de fin).
 */
function versLeClub(retour) {
  const solde = soldeAMontrer(), meta = lireMeta();
  if (solde) { V.solde = solde; V.apresLeSolde = retour; V.ecran = 'solde'; return; }
  V.ecran = 'club';
  V.club = { retour, page: 'variete', voie: VOIES.find(v => !voiesOuvertes(meta).includes(v)) || VOIES[0], rayon: 'club', objet: null, coachs: null };
  relireLeClub();
  // Les entraîneurs de chaque philosophie : combien au loto, et le mieux classé (son nom, sa saison).
  chargerCoachs().then(d => {
    if (!V.club) return;
    const par = {};
    for (const [saison, clubs] of Object.entries(d || {})) for (const [n, cle, rang] of Object.values(clubs)) {
      const x = par[cle] = par[cle] || { n: 0, rang: Infinity, exemple: '' };
      x.n++;
      if (rang < x.rang) { x.rang = rang; x.exemple = `${n} ${saison}`; }
    }
    V.club.coachs = par;
    if (V.ecran === 'club') rendre();
  }).catch(() => {});
}
function relireLeClub() { const meta = lireMeta(); Object.assign(V.club, { meta, rang: rangDePrestige(meta), nom: nomDuClub(), rayons: rayonsDuClub(meta) }); }
function fermerLeClub() {
  const retour = V.club ? V.club.retour : V.apresLeSolde;
  V.club = null;
  V.medailles = lireMeta().ecussons || 0;
  V.ecran = retour === 'depart' ? 'depart' : null;
}
async function commencer() {
  const c = V.loto[V.coach], { graine, numero, cran } = V;
  montrer(sceneAttente('On ouvre les vestiaires…'));
  await charger('On ouvre les vestiaires :');
  S = creerLaRun(donnees(), { graine, numero, exigence: V.cran || 0, coach: { id: c.id, n: c.n, saison: c.saison, tag: c.tag, cle: c.cle, rang: c.rang, maitrise: c.maitrise } });
  garderLesForces();
  poserClubLu(() => ({ team: S.toi }));
  coachAuCartable(c, numero);
  // La run compte ; son cran est celui qu'on proposera la prochaine fois ; la philosophie neuve a eu sa case au loto.
  ecrireMeta({ ...lireMeta(), runs: numero, cran: cran || 0, nouvelle: null });
  V = {};
  garder();
  rendre();
}

/* ---------- la scène du moment ---------- */
const piece = () => S.R.apres && (S.R.apres.offertes || []).length > 0;
function rendre() {
  if (V.ecran === 'solde' && V.solde) return montrer(sceneSolde(V.solde));
  if (V.ecran === 'club' && V.club) return montrer(sceneClub(V.club));
  if (!S) return montrer(V.ecran === 'depart' ? sceneDepart(V) : sceneAttente('Un instant…'));
  const R = S.R;
  const dessous = () => {
    if (V.ecran === 'match') return [sceneMatch(S, V)];
    if (V.ecran === 'lignes') return [sceneLignes(S, V)];
    if (V.ecran === 'banc') return [sceneBanc(S)];
    if (V.ecran === 'echange') return [sceneEchange(S, V)];
    if (V.ecran === 'porte') return [scenePorte(S, V)];
    if (V.ecran === 'de') return [sceneHistoire(S, V)];
    switch (R.phase) {
      case 'camp': case 'portes': return [piece() ? scenePieceGagnee(S, V) : R.portes.pochette ? scenePorte(S, V) : scenePortes(S)];
      case 'annonce': return [sceneAnnonce(S), true];
      case 'carte': return [sceneCarte(S, V)];
      case 'feuille': return [sceneFeuille(S, V), R.case.sorte !== 'match'];
      case 'finacte': return [sceneFinDActe(S, V)];
      case 'marche': return [sceneMarche(S, V)];
      case 'vestiaire': return [sceneVestiaire(S, V)];
      case 'histoire': return [sceneHistoire(S, V)];
      case 'series': return [sceneSeries(S)];
      default: return [sceneFin(S, V)];
    }
  };
  const [html, rouge] = dessous();
  montrer(V.pause ? html + scenePause(S, V) : html, { rouge });
}
/* Entrer dans la phase où la run en est : ce que sa scène demande (ta chance, leur intention, l'histoire, la fin). */
function entrer() {
  const R = S.R;
  clearTimeout(minuterie);
  V = { vitesse: V.vitesse || 1 };
  if (R.phase === 'feuille') preparerLaFeuille();
  if (R.phase === 'histoire') V.histoire = histoireVue(histoireDeLaCase(S));
  if (R.phase === 'fin') finDeLaRun();
  rendre();
}
function preparerLaFeuille() {
  const R = S.R, c = R.case;
  if (c.sorte !== 'match') {
    const adv = S.clubs.find(x => x.s === c.s && x.t === c.t).team, jeu = jeuDe(S, c);
    V.dominante = c.sorte === 'serie' ? null : jeu.dominante;
    V.intention = intentionCeSoir(S, V.dominante);
    V.plans = avecHasardIsole('run-plans', () => plansDuDuel(S.toi, adv, { intention: V.intention }));
    V.plan = null;
  }
  calculerLaChance();
}
/* Ta chance ce soir, par tranches : la jauge se remplit sans figer l'écran, et se refait quand tes lignes ou ton gardien bougent. */
async function calculerLaChance() {
  const jeton = V.jetonChance = (V.jetonChance || 0) + 1, seance = S;
  V.chance = null;
  let v = 0, n = 0;
  for (let k = 0; k < TRANCHES; k++) {
    await pause(20);
    if (S !== seance || !S || S.R.phase !== 'feuille' || V.jetonChance !== jeton || V.ecran === 'match') return;
    const r = chanceCeSoir(S, { n: TRANCHE, tranche: k });
    v += r.v; n += r.n;
    V.chance = { v, n };
    majDeLaJauge();
  }
  // L'élite : sa récompense suit ta chance, la feuille la redit une fois le calcul fini.
  const elite = S.R.case.sorte === 'elite' && S.R.case.J == null;
  fixerLElite(S, v / n);
  garder();
  if (elite && !V.ecran && !V.pause) rendre();
}
/* La jauge se remplit SUR PLACE : refaire la scène à chaque tranche remplaçait le bouton sous le doigt (un toucher perdu). */
function majDeLaJauge() {
  if (V.ecran || V.pause) return;
  const el = plan.querySelector('.rn-jauge');
  if (el) el.outerHTML = jaugeDeCeSoir(S, V); else rendre();
}

/* ---------- le match, en temps forts ---------- */
/*
 * LES TEMPS FORTS d'une feuille jouée : chaque but (son marqueur, ses passeurs, sa minute, au caractère près), les trois plus
 * gros arrêts (les lancers qui avaient le plus de chances d'entrer), deux punitions, les tirs de barrage. `moi` : l'action
 * est celle de ton club ; `bon` : elle est bonne pour toi ; `tirs` : les tirs des deux clubs à cet instant.
 */
function tempsForts(res) {
  const f = res.feuille, c = res.cote, g = S.R.graine, evts = [];
  for (const b of f.buts || []) if (!b.fusillade) evts.push({ type: 'but', t: b.instant, moi: b.cote === c, bon: b.cote === c, qui: b.marqueur, passeurs: (b.passeurs || []).filter(Boolean), gardien: b.gardien, an: !!b.an });
  for (const l of (f.lancers || []).filter(x => !x.but && x.tireur && x.gardien).sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, 3)) evts.push({ type: 'arret', t: l.instant, moi: l.cote === c, bon: l.cote !== c, qui: l.tireur, gardien: l.gardien, passeurs: [] });
  for (const p of (f.punitions || []).filter(x => x.joueur).slice(0, 2)) evts.push({ type: 'punition', t: p.instant, moi: p.cote === c, bon: p.cote !== c, qui: p.joueur, passeurs: [] });
  if (f.fusillade) evts.push({ type: 'barrage', t: 65, moi: res.gagne, bon: res.gagne, qui: null, passeurs: [] });
  evts.sort((a, b) => a.t - b.t);
  const tirsA = t => (f.lancers || []).filter(x => x.instant <= t);
  for (const e of evts) { const l = tirsA(e.t); e.tirs = [l.filter(x => x.cote === c).length, l.filter(x => x.cote !== c).length]; e.h = hache(g, 'glace', e.t); e.h2 = hache(g, 'glace2', e.t); e.per = periodeDe(e.t); }
  return evts;
}
function lancerLeMatch() {
  const R = S.R, c = R.case, duel = c.sorte !== 'match';
  if (c.sorte === 'elite' && c.J == null) { const r = chanceCeSoir(S, { n: 60, tranche: 9 }); fixerLElite(S, r.v / r.n); }
  garder();
  const res = jouerLeMatch(S, duel ? { plan: V.plan != null && V.plans[V.plan] ? V.plans[V.plan].plan : null, dominante: V.dominante } : {});
  const pieces = [...new Set([...(res.feuille.pieces || []), ...(res.feuille.relais || [])].filter(x => x.cote === res.cote).map(x => x.cle))].filter(k => R.banc.includes(k));
  V = { ecran: 'match', vitesse: V.vitesse || 1, match: { res, evts: tempsForts(res), i: -1, pieces } };
  rendre();
  suite();
}
function suite() {
  clearTimeout(minuterie);
  const M = V.match;
  if (!M || V.ecran !== 'match' || M.i >= M.evts.length - 1) return;
  const calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  minuterie = setTimeout(() => {
    if (!V.match || V.ecran !== 'match' || V.pause) return;
    M.i = calme ? M.evts.length - 1 : M.i + 1;
    const e = M.evts[M.i];
    if (e && e.type === 'but') { jouerSon(e.bon ? 'klaxon' : 'baton'); if (e.bon) notable(); }
    rendre();
    suite();
  }, M.i < 0 ? 600 : PAS / V.vitesse);
}
function apresLeMatch() {
  const res = V.match.res;
  clearTimeout(minuterie);
  conclure(S, res);
  if (res.gagne && S.R.apres && S.R.apres.sorte !== 'match') pic(plan);
  jouerSon(res.gagne ? 'recompense' : 'arriere');
  garder();
  entrer();
}

/* ---------- les histoires, la fin ---------- */
/* Ce que la scène d'une histoire montre : sa voix, sa réplique qui nomme, le fait sous elle, ses deux réponses en cartes de jeu. */
function histoireVue(h) {
  if (!h) return null;
  const sc = sceneDe(h.cle, h.f), qui = nomCourt(h.joueur.n);
  const lignes = o => motsDe(o, { qui }).slice(0, 3).map(m => `<span class="${m.bon ? 'rn-vert' : m.bon === false ? 'rn-rg' : 'rn-gris'}">${esc(m.txt)}</span>`).join('<br>') || '<span class="rn-gris">Rien ne change</span>';
  return { h, voix: sc.de.nom, dit: `« ${esc(sc.mot)} »`, joueur: h.joueur, fait: esc(sc.fait),
    options: h.H.options.map(o => ({ cle: o.cle, lignes: lignes(o),
      carte: carteHtml({ cle: o.cle, niveau: o.niveau || 0, genreCarte: o.pari ? 'synergie' : 'defense', ico: o.pari ? '🎲' : h.H.ico, nomHtml: esc(nomDOption(o, h.joueur)), typeHtml: o.pari ? 'Pari' : 'Réponse', lecture: true, statique: true }) })) };
}
/* La run finie : ses médailles versées une fois (js/rogue.js `payerEcussons`), son joueur de la run, ses cartes au cartable. */
function finDeLaRun() {
  const R = S.R, F = R.fin;
  payerEcussons(R.graine, 'run', F.medailles, { bilan: { ronde: F.rondes, coupe: F.coupe, series: !!R.series, exigence: reglesDe(R).exigence, pts: R.actes.reduce((a, x) => a + x.pts, 0) } });
  V.medailles = lireMeta().ecussons || 0;
  const buts = new Map();
  for (const e of S.journal) for (const b of e.feuille.buts || []) if (b.marqueur && !b.fusillade && Object.values(S.roster).includes(b.marqueur)) buts.set(b.marqueur, (buts.get(b.marqueur) || 0) + 1);
  const [p, n] = [...buts].sort((a, b) => b[1] - a[1])[0] || [];
  V.etoile = p ? { p, mot: `${n} but${n > 1 ? 's' : ''} en ${F.matchs} matchs` } : null;
  ajouterAuCartable(Object.values(S.roster).filter(Boolean).map(x => ({ cle: getPlayerKey(x), rar: 'commune' })), { doublons: false });
  garder();
}

/* ---------- les gestes ---------- */
const joueurDe = cle => Object.values(S.roster).find(p => p && getPlayerKey(p) === cle) || null;
const GESTES = {
  // le départ
  coach: v => { V.coach = Number(v); },
  'prendre-coach': () => { commencer(); return false; },
  quitter: () => { fermer(); return false; },
  cran: v => { V.cran = Math.min(Number(v) || 0, V.cranMax || 0); },
  // le Club, entre deux runs
  club: () => { versLeClub(S ? 'fin' : 'depart'); },
  'fermer-club': () => { fermerLeClub(); },
  page: v => { V.club.page = v; },
  'voir-voie': v => { V.club.voie = v; },
  'ouvrir-voie': v => { if (ouvrirUneVoie(v).ok) { jouerSon('valide'); notable(); relireLeClub(); } else jouerSon('refus'); },
  rayon: v => { V.club.rayon = v; V.club.objet = null; },
  'voir-objet': v => { V.club.objet = v; },
  'prendre-objet': v => { if (prendreAuClub(V.club.rayon, v).ok) { jouerSon('valide'); notable(); relireLeClub(); } else jouerSon('refus'); },
  'solde-depart': () => { const retour = V.apresLeSolde; soldeVu(); V.ecran = retour === 'fin' ? null : 'depart'; },
  'solde-club': () => { const retour = V.apresLeSolde || 'depart'; soldeVu(); versLeClub(retour); },
  'run-neuve': () => { oublier(); versLeDepart(); return false; },
  // la pause
  pause: () => { V.pause = true; },
  reprendre: () => { V.pause = false; if (V.ecran === 'match') suite(); },
  menu: () => { garder(); fermer(); return false; },
  abandonner: () => { if (!V.sur) { V.sur = true; return; } clearTimeout(minuterie); finir(S, 'quitte'); garder(); entrer(); return false; },
  // la carte
  'vers-carte': () => { S.R.phase = 'carte'; garder(); },
  'voir-case': v => { V.caseVue = Number(v); },
  aller: v => { if (allerA(S, Number(v))) { garder(); entrer(); return false; } },
  lignes: () => { V.retour = V.ecran || null; V.ecran = 'lignes'; V.pause = false; V.seg = 'F'; V.tenu = null; },
  seg: v => { V.seg = v; V.tenu = null; },
  case: v => {
    const i = Number(v);
    if (V.tenu == null) V.tenu = i; else if (V.tenu === i) V.tenu = null; else { if (echangerDeuxCases(S, V.tenu, i)) { jouerSon('valide'); garder(); } else jouerSon('refus'); V.tenu = null; }
  },
  'fermer-lignes': () => { V.ecran = V.retour || null; V.tenu = null; if (S.R.phase === 'feuille' && !V.ecran) calculerLaChance(); },
  banc: () => { V.retour = V.ecran || null; V.ecran = 'banc'; V.pause = false; },
  'fermer-banc': () => { V.ecran = V.retour || null; },
  // la feuille du soir, le match
  filet: v => { choisirLeFilet(S, v); garder(); calculerLaChance(); },
  plan: v => { V.plan = Number(v) < 0 ? null : Number(v); },
  jouer: () => { lancerLeMatch(); return false; },
  vitesse: () => { V.vitesse = VITESSES[(VITESSES.indexOf(V.vitesse) + 1) % VITESSES.length]; suite(); },
  'fin-du-match': () => { clearTimeout(minuterie); V.match.i = V.match.evts.length - 1; },
  'apres-match': () => { apresLeMatch(); return false; },
  'match-de-serie': () => { allerAuMatchDeSerie(S); garder(); entrer(); return false; },
  // les portes, l'échange
  'ouvrir-porte': v => { Object.assign(V, { ecran: 'porte', porte: Number(v), page: 0, joueur: null }); },
  'voir-joueur': v => { V.joueur = v; },
  'page-porte': () => { V.page = (V.page || 0) + 1; V.joueur = null; },
  'fermer-porte': () => { if (S.R.portes.pochette) { apresLesPortes(S); garder(); entrer(); return false; } V.ecran = null; },
  'vers-echange': v => {
    const x = [...(S.R.portes.pochette ? [null] : S.R.portes.clubs)].flatMap(c => (c ? S.clubs.find(k => k.s === c.s && k.t === c.t).pool : S.pochette || [])).find(p => getPlayerKey(p) === v);
    if (x) Object.assign(V, { ecran: 'echange', arrivant: x, sortant: null });
  },
  sortant: v => { V.sortant = v; },
  'fermer-echange': () => { V.ecran = S.R.portes.pochette ? null : 'porte'; },
  signer: v => {
    const sortant = joueurDe(v);
    if (!sortant || !signer(S, V.arrivant, sortant)) { jouerSon('refus'); return; }
    jouerSon('valide'); notable();
    ajouterAuCartable([V.arrivant, sortant].map(p => ({ cle: getPlayerKey(p), rar: 'commune' })), { doublons: false });
    apresLesPortes(S); garder(); entrer();
    return false;
  },
  passer: () => { passerLesPortes(S); apresLesPortes(S); garder(); entrer(); return false; },
  relancer: () => { if (relancerLesPortes(S)) { jouerSon('donne'); garder(); } },
  // une pièce offerte, la fin d'acte
  'voir-piece': v => { V.piece = v; },
  'piece-sort': v => { V.sort = V.sort === v ? null : v; },
  'prendre-piece': () => {
    const R = S.R, o = R.apres.offertes, cle = o.includes(V.piece) ? V.piece : o[0];
    if (!prendreLaPiece(S, cle, V.sort || null)) { jouerSon('refus'); return; }
    jouerSon('recompense');
    return GESTES[R.phase === 'finacte' ? 'apres-acte' : 'piece-passee']();
  },
  'piece-passee': () => { pieceReglee(S); garder(); entrer(); return false; },
  'apres-acte': () => { pieceReglee(S); apresLaFinDActe(S); garder(); entrer(); return false; },
  // le marché, le vestiaire, l'histoire
  'acheter-piece': v => { if (acheterLaPiece(S, v, V.sort || null)) { jouerSon('recompense'); V.piece = null; garder(); } else jouerSon('refus'); },
  pochette: v => { ouvrirLaPochette(v); return false; },
  'quitter-marche': () => { avancer(S); garder(); entrer(); return false; },
  'choix-vestiaire': v => { V.choix = v; },
  'autre-carte': () => {
    const js = Object.values(S.roster).filter(Boolean), i = js.findIndex(p => getPlayerKey(p) === V.joueur);
    V.joueur = getPlayerKey(js[(i + 1) % js.length]); V.choix = 'monter';
  },
  reposer: () => { reposer(S); jouerSon('valide'); garder(); entrer(); return false; },
  monter: v => { const p = joueurDe(v); if (p && monterUneCarte(S, p)) { jouerSon('recompense'); garder(); entrer(); return false; } jouerSon('refus'); },
  reponse: v => {
    const h = V.histoire.h, o = h.H.options[Number(v)], de = repondre(S, h, o.cle);
    garder();
    if (!de) { entrer(); return false; }
    // Le dé se montre avant de revenir à la carte.
    V = { ecran: 'de', histoire: { ...V.histoire, dit: `Le dé : ${de.face}. ${de.gagne ? 'Ça tourne pour lui.' : 'Ça ne tourne pas.'}`, options: [] }, de };
    jouerSon(de.gagne ? 'recompense' : 'arriere');
    minuterie = setTimeout(() => entrer(), 1800);
  },
  'histoire-calme': () => { S.R.jetons += RUN.PASSER; avancer(S); garder(); entrer(); return false; },
};
async function ouvrirLaPochette(cle) {
  const R = S.R, vus = new Set(R.vus);
  montrer(sceneAttente('On ouvre la pochette…'));
  const r = await tirerJoueursDuPack(cle, { graine: `${R.graine}:pochette`, n: R.achats, params: { poste: 'F' }, saisons: [...SHARDS.keys()], shard: shardCharge, libre: p => !vus.has(getPersonKey(p)) }).catch(() => null);
  R.achats++;
  if (!r || !r.cartes.length || !acheterLaPochette(S, cle, r.cartes.map(x => x.p))) { jouerSon('refus'); return entrer(); }
  jouerSon('donne');
  garder();
  entrer();
}
/* Les gestes qui se jouent sans run : le départ, le Club, le solde. */
const SANS_RUN = new Set(['coach', 'prendre-coach', 'quitter', 'cran', 'club', 'fermer-club', 'page', 'voir-voie', 'ouvrir-voie', 'rayon', 'voir-objet', 'prendre-objet', 'solde-depart', 'solde-club', 'run-neuve']);
function geste(a, v) {
  if (!GESTES[a] || (!S && !SANS_RUN.has(a))) return;
  jouerSon('tap');
  if (a !== 'abandonner') V.sur = false;
  if (GESTES[a](v) !== false) rendre();
}
