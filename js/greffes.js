/*
 * LES GREFFES DU ROGUE (V25, docs/refonte-v25.md § A). Ce que le Rogue pose sur un match, un soir, un matin ou une
 * décision : le coach et son banc de cinq pièces et leurs relais (V27, tranche 5, js/pieces.js), leur coach en séries
 * (V23 F), le duel en trois périodes (V9, V17), les histoires par leur porte et leurs promesses (V25 C1). Le moteur
 * (js/sim.js) n'importe rien de tout ça : ce module se branche sur lui au chargement (`brancherGreffes`) par un contrat
 * de huit fonctions, et le 82-0 n'y pose rien.
 *
 * Le contrat (lu par le moteur, et lui seul) :
 *   avantMatch(A, B, LA, LB, journal, { series, gros })   ce qui se pose avant le match ; rend la fonction qui le retire
 *   match(A, B, LA, LB, { gros, journal, series })          la soirée : `periode(k, etat)` rend les effets des deux clubs,
 *                                                            `apres(k, h, cumul)` note ce qui a joué, `fin()` écrit le duel
 *   apresMatch(A, B)                                         après le match (en séries, les verdicts)
 *   matin(L, toi, jour)                                      le matin de ton club : les verdicts des promesses, les effets de tes joueurs
 *   decision(team, d, graine)                                une décision prise à l'écran : l'histoire par sa porte, le banc
 *   coachDeSeries(S, t)                                      leur coach-personnage pour les séries, ou null
 *   lecture(team, adv, lu, { plan, intention, duel })        un plan et une intention posés le temps d'une lecture
 *   aVenir(team, d)                                          ce qu'une décision à venir a de pur, posé le temps d'une lecture
 */
import { PIECES, PIECE_DU_COACH, bancDe, poserLaPiece, bancDuSoir, bancDeLaPeriode, persoAdverse } from './pieces.js';
import { COACHS, coachDesRoles } from './coachs.js';
import { HISTOIRES, nomDOption } from './histoires.js';
import { FENETRE_JOUEUR } from './faits.js';
import { nomCourt } from './recit.js';
import { estD, hache, pct3, SEMAINE } from './util.js';
import {
  brancherGreffes, SLOTS, getPlayerKey, famillesDe, profilsDe, badgeGardien, apresMatchs, JOUR_SERIES, jourDeSerie,
  rendreJambes, MOMENTS_SI, deDuPari, cleDuPari, effetsDesJoueurs, activeLineup, ENV_MESURE,
} from './sim.js';

/* LA COULEUR D'UN JOUEUR (v2, js/coachs.js) : le coach de son meilleur rôle maîtrisé ; elle oriente les packs du coach. */
export const coachDuJoueur = p => (!p ? null : p.p === 'G' ? ((badgeGardien(p) || {}).coach || null) : coachDesRoles(profilsDe(p), estD(p) ? 'D' : 'F'));

/*
 * LA PORTE (V25 C1, docs/refonte-v25.md § 4 C ; docs/refonte-v25-c1.md § 3). Une histoire répondue est une décision
 * `{ moment: { famille: 'histoire', cle, choix, joueur, joueurs } }` ; `appliquerChoix` pose, dans cet ordre, ce que sa
 * carte dit : les gestes d'aujourd'hui (le soin, les absents, les jambes, l'auxiliaire ; la pièce de banc et l'échange
 * du joueur nommé passent par la décision, `piece` et l'alignement), ce qui va au joueur nommé (`lui`), le dé (`pari`,
 * tiré de la graine, du jour et du sel : l'écran l'a montré, le moteur le rejoue pareil), les canaux du club (permis aux
 * moments `gros` et `ronde` seulement, JP, C0 q. 4 ; `duree` 1 ou 7), et la promesse (`promettre`). Les jetons
 * restent à la décision (`gain`) : la caisse les lit. Une vieille décision `dossier`, `fil`,
 * `avant` ou `ajustement` (d'avant la C1) ne trouve plus rien et ne joue rien. En séries, le club est au jour `Infinity` :
 * ce qui dure se date en matchs de séries (`jourDeSerie`, js/sim.js).
 */
const optionDe = m => { const H = m && m.famille === 'histoire' && HISTOIRES[m.cle]; const o = H && H.options.find(x => x.cle === m.choix); return o ? { H, o } : null; };
const auClub = (team, k) => (k ? Object.values(team.roster || {}).find(x => x && getPlayerKey(x) === k) || null : null);
const enSeries = team => team.jourCourant === Infinity;
/* Le jour où une décision joue : le sien en saison, le match qui vient en séries. */
const jourDe = (team, d) => (Number.isFinite(d.jour) ? d.jour : jourDeSerie(team));
const finDe = (team, j0, duree) => (j0 >= JOUR_SERIES ? j0 + (duree || 1) : apresMatchs(team, j0, duree || 1));
export function appliquerChoix(team, d, graine) {
  const x = optionDe(d.moment);
  if (!x) return;
  const { H, o } = x, j0 = jourDe(team, d);
  const cles = d.moment.joueurs || (d.moment.joueur ? [d.moment.joueur] : []);
  const joueurs = cles.map(k => auClub(team, k)).filter(Boolean), lui = joueurs[0] || null;
  const titre = H.titre, ico = H.ico, choix = nomDOption(o, lui);
  // 1. LES GESTES D'AUJOURD'HUI (js/effets.js `GESTES`).
  const g = o.gestes || {};
  if (g.soin && lui && team.injured && team.injured.get(lui)) { const n = team.injured.get(lui); if (n <= g.soin) team.injured.delete(lui); else team.injured.set(lui, n - g.soin); }
  if (g.absents && lui) team.absents.set(lui, Math.max(team.absents.get(lui) || 0, finDe(team, j0, g.absents)));
  if (g.energie && lui) rendreJambes(lui, g.energie);
  if (g.energieTous) for (const sl of SLOTS) { const p = team.roster[sl.i]; if (p && p.p !== 'G') rendreJambes(p, g.energieTous); }
  if (g.gardienAux) { if (enSeries(team)) team._gardienAuxMatch = true; else team.gardienAux = Math.max(team.gardienAux || 0, finDe(team, j0, g.gardienAux)); }
  // 2. CE QUI VA AU JOUEUR NOMMÉ, le temps de ses matchs (`effetsCibles`, lu par `effetsDesJoueurs`).
  const surLui = (e, duree) => { if (e && lui) (team.effetsCibles = team.effetsCibles || []).push({ debut: j0, fin: finDe(team, j0, duree), source: 'decision', nom: titre, ico, joueur: lui, ...(o.quand ? { si: o.quand } : {}), ...e }); };
  surLui(o.lui, o.duree);
  // 3. LE DÉ : chaque issue est un effet de la même grammaire, sur le joueur nommé ; le club garde comment il a tourné.
  if (o.pari) {
    const { gagne, face } = deDuPari(graine, Number.isFinite(d.jour) ? d.jour : `po${d.ronde}`, cleDuPari(d), o.pari.chance);
    (team.paris = team.paris || []).push({ jour: j0, titre, choix, gagne, face });
    const e = gagne ? o.pari.gagne : o.pari.perd;
    surLui(e.lui, e.duree);
  }
  // 4. LES CANAUX DU CLUB, au gros match et à la ronde seulement, pour le soir ou la série.
  if (o.canaux && H.moment !== 'lundi') (team.effets = team.effets || []).push({ debut: j0, fin: finDe(team, j0, o.duree), source: 'histoire', nom: titre, ico, choix, ...o.canaux });
  // 5. LA PROMESSE.
  promettre(team, d, H, o, lui, j0);
  effetsDesJoueurs(team, j0);
}
/* L'effet de club d'une histoire à venir, le temps d'une lecture (`aVenir`) : ses canaux, datés comme la porte les date. */
function effetDuChoix(team, d) {
  const x = optionDe(d.moment);
  if (!x || !x.o.canaux || x.H.moment === 'lundi') return null;
  const j0 = jourDe(team, d);
  return { debut: j0, fin: finDe(team, j0, x.o.duree), source: 'histoire', nom: x.H.titre, ico: x.H.ico, ...x.o.canaux };
}
/*
 * LE DÉ D'UN CHOIX, TRANCHÉ D'AVANCE : l'écran le montre au lancer (js/gerant.js `sceneDuDe`), et c'est exactement ce que
 * la porte rejouera — le tirage ne dépend que de la graine, du jour, du choix et du sel tiré à la décision.
 */
export function deDuChoix(d, graine) {
  const x = d && optionDe(d.moment);
  if (!x || !x.o.pari) return null;
  const { face, faces, gagne } = deDuPari(graine, Number.isFinite(d.jour) ? d.jour : `po${d.ronde}`, cleDuPari(d), x.o.pari.chance);
  return { gagne, face, faces, effet: gagne ? x.o.pari.gagne : x.o.pari.perd };
}

/*
 * LE COACH ET SON BANC (V27, tranche 5, js/pieces.js). La décision `coach` (le jour 0) porte l'entraîneur (sa philosophie,
 * sa vraie carte, sa maîtrise) et son banc — sans banc écrit, sa pièce de départ seule (`PIECE_DU_COACH`) ; une décision
 * `piece` ({ cle, sort }) en pose une, le jour dit, et le banc plein laisse partir `sort`. Une vieille décision `talent`,
 * `xpCoach`, `embauche` ou `poste` (les niveaux, l'expérience et la main d'adjoints d'avant la V27) ne joue plus rien.
 */
function appliquerPerso(team, d) {
  if (d.coach && d.coach.cle && PIECE_DU_COACH[d.coach.cle]) {
    // L'entraîneur (une vraie carte de coach, js/coachs-reels.js) : son nom, sa saison, sa maîtrise (de 0,9 à 1,3).
    const banc = (d.coach.banc || []).filter(k => PIECES[k]);
    team.perso = { cle: d.coach.cle, banc: banc.length ? bancDe({ banc }) : [PIECE_DU_COACH[d.coach.cle]],
      ...(d.coach.chef ? { chef: { ...d.coach.chef } } : {}), maitrise: Math.min(1.3, Math.max(0.9, Number(d.coach.maitrise) || 1)) };
  }
  if (team.perso && d.piece && PIECES[d.piece.cle]) team.perso = { ...team.perso, banc: poserLaPiece(team.perso.banc, d.piece.cle, d.piece.sort || null) };
}

/*
 * LA PROMESSE (V25 C1 ; oct. 2026, JP : *ça le confirme bon, mais aucun suivi de ça*). Chaque option qui touche un joueur
 * (`lui` ou `pari`) engage un SUIVI (`team.suivis`, généralisé de celui des fils de la V9) : sa MESURE se lit de l'effet —
 * ses tirs et ses buts quand l'effet est sur ses tirs ou sa précision, ses passes quand il est sur ses passes, ses buts
 * accordés et son % d'arrêts pour un gardien, ses matchs joués sans rechute pour une blessure —, sur la DURÉE de l'effet
 * (celle de l'issue la plus longue d'un dé). Le lundi d'après sa fin (en séries, le lendemain), le VERDICT arrive comme un
 * message de la même voix, en vrais chiffres recomptés dans ses feuilles, contre ses dix matchs d'avant (`team.retours`,
 * la une) ; « Ce qui court » le montre chaque matin (`suivisEnCours`). Un joueur parti fait tomber la promesse, et ça se
 * dit. Aucun dé, aucun seuil : la saison rejouée relit les mêmes feuilles.
 */
const mesureDeLEffet = e => (!e ? null : e.lancers || e.finition ? 'tirs' : e.creation ? 'passes' : e.arrets ? 'arrets' : e.blessure ? 'sante' : null);
function promettre(team, d, H, o, lui, j0) {
  if (!lui) return;
  const effets = [o.lui, ...(o.pari ? [o.pari.gagne.lui, o.pari.perd.lui] : [])].filter(Boolean);
  const mesure = effets.map(mesureDeLEffet).find(Boolean);
  if (!mesure) return;
  const duree = Math.max(o.duree || 0, ...(o.pari ? [o.pari.gagne.duree || 0, o.pari.perd.duree || 0] : []));
  (team.suivis = team.suivis || []).push({ cle: d.moment.cle, choix: o.cle, titre: H.titre, ico: H.ico, de: H.de, jour: j0, matchs0: feuillesDuClub(team).length,
    joueur: lui, mesure, duree, fait: false });
}
/* Les feuilles du club dans l'ordre : la saison, puis les séries (le moteur les range à part, `poJournal`). */
const feuillesDuClub = t => [...(t.journal || []), ...(t.poJournal || [])];
/* Ce que les feuilles d'un suivi disent de son joueur : ses matchs habillé, puis sa mesure. */
function mesureDuSuivi(s, entrees) {
  const p = s.joueur, out = { m: 0, buts: 0, tirs: 0, passes: 0, departs: 0, accordes: 0, lancers: 0 };
  for (const e of entrees) {
    const f = e && e.feuille;
    if (!f) continue;
    const cote = (f.alignes && (f.alignes.A || []).includes(p)) ? 'A' : (f.alignes && (f.alignes.B || []).includes(p)) ? 'B' : null;
    if (cote) {
      out.m++;
      for (const b of f.buts || []) { if (b.cote === cote && !b.fusillade) { if (b.marqueur === p) out.buts++; else if ((b.passeurs || []).includes(p)) out.passes++; } }
      out.tirs += (f.lancers || []).filter(l => l.tireur === p).length;
    }
    if (e.gardien === p) { out.departs++; out.accordes += e.ga || 0; out.lancers += (f.lancers || []).filter(l => l.gardien === p).length; }
  }
  return out;
}
/* La mesure en mots, selon ce que la promesse suit : « 4 buts, 31 tirs en 8 matchs », « ,921 sur 6 départs », « 8 matchs sans rechute ». */
function motDeMesure(s, x, reblesse = false) {
  const m = `${x.m} match${x.m > 1 ? 's' : ''}`;
  if (s.mesure === 'tirs') return `${x.buts} but${x.buts > 1 ? 's' : ''}, ${x.tirs} tir${x.tirs > 1 ? 's' : ''} en ${m}`;
  if (s.mesure === 'passes') return `${x.passes} passe${x.passes > 1 ? 's' : ''} en ${m}`;
  if (s.mesure === 'arrets') return x.lancers ? `${pct3(1 - x.accordes / x.lancers)}, ${x.accordes} but${x.accordes > 1 ? 's' : ''} accordé${x.accordes > 1 ? 's' : ''} sur ${x.departs} départ${x.departs > 1 ? 's' : ''}` : 'aucun départ';
  return reblesse ? `reblessé après ${m}` : `${m} sans rechute`;
}
const reblesseDepuis = (t, s, jusqua) => (t.injuriesLog || []).some(b => b.player === s.joueur && b.at > s.matchs0 && b.at <= jusqua);
/* Le texte du verdict : le nom, la mesure depuis le choix, celle d'avant — les vrais chiffres, rien d'autre. */
function texteDuVerdict(t, s, depuis, avant) {
  const x = mesureDuSuivi(s, depuis), y = mesureDuSuivi(s, avant);
  const apres = motDeMesure(s, x, reblesseDepuis(t, s, s.matchs0 + depuis.length));
  const unite = s.mesure === 'arrets' ? 'départ' : 'match';
  return `${nomCourt(s.joueur.n)} : ${apres} depuis « ${nomDOption(HISTOIRES[s.cle].options.find(o => o.cle === s.choix) || { nom: s.choix }, s.joueur)} » ; ${s.mesure === 'sante' ? `${y.m} ${unite}${y.m > 1 ? 's' : ''} joués avant` : `${motDeMesure(s, y)} avant`}.`;
}
/* Le joueur d'une promesse est-il encore à toi ? Échangé, relâché, réclamé : la promesse ne peut plus se tenir. */
const encoreChezToi = (t, p) => Object.values(t.roster || {}).some(x => x && getPlayerKey(x) === getPlayerKey(p));
/* Le verdict de chaque promesse finie, le lundi (en séries, le lendemain) : un message de la même voix, dans `t.retours`. */
function verdictsDuMatin(t, jour) {
  const j = feuillesDuClub(t), lundi = jour >= JOUR_SERIES || jour % SEMAINE === 0;
  for (const s of t.suivis || []) {
    if (s.fait) continue;
    const base = { cle: s.cle, choix: s.choix, jour, titre: `${s.ico} ${s.titre} : le verdict`, de: s.de, joueur: s.joueur, debut: s.jour, matchs0: s.matchs0 };
    // Parti avant la fin : la promesse tombe, sans gain ni prix, et ça se dit.
    if (!encoreChezToi(t, s.joueur)) { s.fait = true; (t.retours = t.retours || []).push({ ...base, texte: `${nomCourt(s.joueur.n)} n'est plus dans ton effectif : la promesse tombe.`, parti: true }); continue; }
    if (j.length - s.matchs0 < s.duree || !lundi) continue;
    s.fait = true;
    (t.retours = t.retours || []).push({ ...base, texte: texteDuVerdict(t, s, j.slice(s.matchs0, s.matchs0 + s.duree), j.slice(Math.max(0, s.matchs0 - FENETRE_JOUEUR), s.matchs0)) });
  }
}

/* =====================================================================
   LE DUEL EN TROIS PÉRIODES (V9, tranche 5 — docs/refonte-v9.md § 6.3)

   JP : *contrer les cartes du joueur pendant les matchs (quitte à revoir les gros matchs)*. En Rogue, le gros
   match n'est plus deviner leur plan, jouer une main, puis choisir à l'entracte : c'est l'élite de Slay the Spire.
   Avant chaque période, l'adversaire ANNONCE son intention, et elle vise tes joueurs par leur nom (`INTENTIONS`).
   Elle se lit sur ton alignement avant le match, puis sur ce qui s'est passé : ton 2e trio a marqué deux fois,
   l'ombre passe sur lui ; tu mènes, ils jouent l'assaut ; une intention qui leur a coûté la période ne revient pas
   tout de suite. Rien n'est tiré au dé : la graine ne départage que deux intentions aussi tentantes (`intentionDuDuel`).

   TA RÉPONSE, UN SEUL CHOIX AVANT LE MATCH (V27, tranche 6 ; docs/refonte-v27.md § 4.7, docs/refonte-v27-6a.md). JP :
   *le duel : un seul choix lourd ; les micro-plans de période partent* ; *aucune décision d'entracte*. Ton plan fort
   (`PLANS`), un parmi deux ou trois que ton banc propose (`plansDuDuel`, js/impact.js), ou Ton match : il joue les
   trois périodes. Le rival a montré son jeu à son annonce : son intention dominante (`dominante`, js/actes.js), qu'il
   annonce plus souvent que les autres (`POIDS_DOMINANTE`). Leur intention est leur plan : elle frappe sa période, avec
   son prix, et ne se « contre » plus.

   Le moteur joue les trois périodes d'un trait : une vieille décision d'entracte (`duel.p` 1 ou 2, d'avant la V27) ne
   joue rien et ne relance aucun dé. L'adversaire ne pige aucune carte (`horsAdverse`) : ses intentions sont sa main.
   ===================================================================== */
export const PERIODES_DU_DUEL = [[0, 20], [20, 40], [40, 60]];
/*
 * LA FORCE DU DUEL (V17, scripts/check_duel.mjs) : au gros match, leur intention et ton plan jouent plus fort qu'un
 * soir ordinaire — chacun de leurs canaux élevé à cette puissance, le gain comme le prix. JP : *qqchose qui change
 * vraiment le match, mais sans briser les équipes*.
 */
const FORCE_DUEL = Number(ENV_MESURE.FORCE_DUEL ?? 2);
/* Un joueur fort en Robustesse (`famillesDe`, en écarts types à points égaux) : celui qui dissuade la chasse. */
const ROBUSTE_DISSUADE = 1;
/* L'attrait de plus de leur intention dominante, à chaque période (check_duel : elle sort plus souvent que chacune des autres). */
const POIDS_DOMINANTE = Number(ENV_MESURE.POIDS_DOMINANTE ?? 1.5);
/*
 * LES INTENTIONS (V17, docs/refonte-v17.md § 3). Ce qu'ils annoncent avant une période, c'est LEUR PLAN : les mêmes
 * leviers que les tiens (`PLANS`), posés par eux, chacun avec son prix, le temps de sa période. `toi` : sur ton club ;
 * `adv` : sur le leur ; `joueur` : sur ton joueur visé (`vise` : son poste) ; `par` : sur leur joueur qui le vise ;
 * `jambes` : ce que la chasse coûte aux jambes du visé. Elle change la FORME de la période, pas sa force : plus de
 * contre ni de porte (le tableau de la V13 est parti) ; ton banc propose ton plan d'avant-match pour y répondre
 * (`plansDuDuel`, js/impact.js).
 */
export const INTENTIONS = {
  ombre: { ico: '🥷', nom: 'L\'ombre', vise: 'F',
    joueur: { lancers: 0.5, finition: 0.75, creation: 0.75 }, par: { lancers: 0.65, creation: 0.6 }, adv: { volume: 0.93 } },
  chasse: { ico: '🦈', nom: 'La chasse', vise: 'D',
    joueur: { lancers: 0.7, defense: 1.3, blessure: 3 }, jambes: 20, adv: { discipline: 1.3, energie: 1.1 } },
  centre: { ico: '⛔', nom: 'Fermer le centre',
    toi: { volume: 0.92, finition: 0.98 }, adv: { volume: 0.88 } },
  assaut: { ico: '🐗', nom: 'L\'assaut',
    adv: { volume: 1.12, finition: 1.02, discipline: 1.25, energie: 1.12 } },
  cachot: { ico: '🦂', nom: 'Les punitions',
    toi: { discipline: 1.35 }, adv: { volume: 0.95, discipline: 1.1 } },
};
/*
 * LE PLAN DE MATCH (V17, docs/refonte-v17.md). JP : *des choix avant le match et pendant, plus stratégiques, genre
 * tirer plus, suivre un joueur de près, qqchose qui change vraiment le match, mais sans briser les équipes*. Les
 * mêmes leviers que les intentions, posés par TON club, sur ses canaux qui existent : `toi` sur ton club, `adv` sur
 * le leur, `vedette` sur leur meilleur marqueur (`ptsDe`) et `colle` sur ton attaquant qui le suit (le plus fort en
 * Défense, `famillesDe`). Un plan change la FORME du match, pas sa force : chacun paie ce qu'il donne (`check_duel`).
 * V27, tranche 6 : un plan ne se pose plus qu'au duel, pris avant le match (`plansDuDuel`, js/impact.js), pour les trois
 * périodes ; le plan du soir des matchs ordinaires est parti (6b : ses idées sont des pièces de banc, js/pieces.js).
 */
export const PLANS = {
  match: { ico: '🏒', nom: 'Ton match', mot: 'Ton match', bon: 'Ton alignement tel quel', prix: '' },
  tirer: { repond: ['ombre'], ico: '🌧', nom: 'Tirer de partout', mot: 'Tirer', bon: 'Plus de tirs', prix: 'Moins de précision, des jambes qui s\'usent',
    toi: { volume: 1.11, finition: 0.965, energie: 1.1 } },
  ombre: { repond: ['assaut'], ico: '🥷', nom: 'Coller leur vedette', mot: 'Coller', bon: 'Leur meilleur marqueur tire moins et rate plus', prix: 'Ton attaquant qui le suit crée moins',
    vedette: { lancers: 0.5, finition: 0.75, creation: 0.75 }, colle: { lancers: 0.65, creation: 0.6 }, toi: { volume: 0.93 } },
  centre: { repond: ['assaut', 'chasse'], ico: '⛔', nom: 'Fermer le centre', mot: 'Fermer', bon: 'Moins de tirs contre, et de moins bonne qualité', prix: 'Moins de tirs pour toi',
    toi: { volume: 0.88 }, adv: { volume: 0.92, finition: 0.98 } },
  assaut: { repond: ['centre'], ico: '🐗', nom: 'Forechecker fort', mot: 'Forechecker', bon: 'Plus de tirs, de la pression', prix: 'Plus de punitions et d\'usure',
    toi: { volume: 1.12, finition: 1.02, discipline: 1.25, energie: 1.12 } },
  discipline: { repond: ['cachot', 'chasse'], ico: '🧘', nom: 'Rester discipliné', mot: 'Discipline', bon: 'Moins de punitions', prix: 'Moins de mises en échec, un peu moins de tirs',
    toi: { discipline: 0.7, robustesse: -0.4, volume: 0.97 } },
};
/*
 * CE QUE TON PLAN RÉPOND À LEUR JEU (V27, tranche 6 ; devis § 4.3 : *le rival montre son jeu dès son annonce, et des pièces
 * y répondent*). Un plan qui répond à leur intention (`repond`) ramène ce qu'elle te fait à la force d'un soir ordinaire,
 * la période où elle joue (1 au lieu de `FORCE_DUEL`) ; ce qu'elle leur coûte ne bouge pas. C'est ce qui fait du plan un
 * vrai choix contre le jeu qu'ils ont montré (check_duel : aucun plan ne domine les deux autres sur les cinq intentions).
 */
const forceContre = (plan, I) => (plan && I && PLANS[plan.cle] && (PLANS[plan.cle].repond || []).includes(I.cle) ? 1 : FORCE_DUEL);
/* Une décision `plan` telle que l'équipe la garde : Ton match (ou un plan inconnu) la retire. */
/*
 * `force` (nov. 2026 ; JP : *the duel with the assistants and coach, not random choices*) : au duel, un plan joue à la force
 * de celui qui le propose — une pièce de ton banc à 1, le coach à sa maîtrise ; bornée là.
 */
const planLu = x => (x && PLANS[x.cle] && x.cle !== 'match' ? { cle: x.cle, vise: x.vise || null, ...(Number(x.force) > 0 ? { force: Math.min(1.3, Math.max(0.7, Number(x.force))) } : {}) } : null);
/* Leur vedette (leur meilleur marqueur habillé, ou celui que tu nommes) et ton attaquant qui la colle. */
export function cibleDuPlan(Ltoi, Ladv, vise = null) {
  const leurs = habillesDuGroupe(Ladv || {}, 'F').map(x => x.p);
  const vedette = (vise && leurs.find(p => getPlayerKey(p) === vise)) || leurs.sort((a, b) => ptsDe(b) - ptsDe(a))[0] || null;
  const colle = habillesDuGroupe(Ltoi || {}, 'F').map(x => x.p).sort((a, b) => ((famillesDe(b) || {}).defense || 0) - ((famillesDe(a) || {}).defense || 0))[0] || null;
  return { vedette, colle };
}
/*
 * CE QU'UN PLAN POSE sur un match ou une période : les effets des deux clubs et les canaux des deux joueurs, dans les
 * formes que le moteur lit déjà (`_effetMatch`, `_duelFx`). Rien si le plan est Ton match.
 */
function effetsDuPlan(plan, { Ltoi, Ladv }, f0 = 1) {
  const P = plan && PLANS[plan.cle];
  if (!P || plan.cle === 'match') return null;
  const f = f0 * (plan.force || 1);
  const F = e => (f === 1 ? e : forcer(e, f));
  const eff = (e, ou) => (e ? [{ source: 'plan', cle: plan.cle, nom: P.nom, ico: P.ico, ...F(e), ...(ou ? { ou } : {}) }] : []);
  const { vedette, colle } = P.vedette || P.colle ? cibleDuPlan(Ltoi, Ladv, plan.vise) : {};
  return { toi: eff(P.toi), adv: eff(P.adv), joueurs: [[vedette, P.vedette], [colle, P.colle]].filter(([p, e]) => p && e).map(([p, e]) => [p, F(e)]), vedette: vedette || null };
}
/* Poser des canaux de joueur le temps d'un match ou d'une période ; rend la fonction qui les retire. */
function poserFxDeJoueurs(joueurs) {
  const poses = [];
  for (const [p, e] of joueurs || []) {
    const avant = p._duelFx;
    const fx = { ...(avant || {}) };
    for (const [c, v] of Object.entries(e)) if (typeof v === 'number') fx[c] = (fx[c] ?? 1) * v;
    p._duelFx = fx;
    poses.push([p, avant]);
  }
  return () => { for (const [p, avant] of poses.reverse()) { if (avant) p._duelFx = avant; else delete p._duelFx; } };
}
/* Une intention à sa force : chaque canal élevé à la puissance (la blessure aussi), la robustesse, une somme, multipliée. */
const forcer = (e, f) => (e ? Object.fromEntries(Object.entries(e).map(([k, v]) => [k, typeof v !== 'number' ? v : k === 'robustesse' ? v * f : v ** f])) : e);
/* Les points par match d'un joueur, dans sa vraie saison : la vedette d'un club, c'est celle-là. */
const ptsDe = p => (p && p.gp ? (p.pt || 0) / p.gp : 0);
const habillesDuGroupe = (L, g) => SLOTS.filter(s => !s.scratch && s.group === g).map(s => ({ s, p: L[s.i] })).filter(x => x.p && x.p.p !== 'G');
const caseDe = (L, p) => SLOTS.find(s => !s.scratch && L[s.i] === p) || null;
/* Le coach en poste paie-t-il cette famille (js/coachs.js `familles`) ? Ce que l'adversaire lit pour choisir son intention. */
const coachPaie = (team, famille) => !!(team && team.perso && COACHS[team.perso.cle] && COACHS[team.perso.cle].familles.paie.includes(famille));
const robusteDe = p => (famillesDe(p) || {}).robustesse || 0;
/* Le joueur de leur club le plus fort d'une famille : leur ombre (la Défense), leur dur (la Robustesse). */
function leurMeilleur(Ladv, famille) {
  const pats = Object.values(Ladv || {}).filter(p => p && p.p !== 'G');
  return pats.sort((a, b) => ((famillesDe(b) || {})[famille] || 0) - ((famillesDe(a) || {})[famille] || 0))[0] || null;
}
/*
 * L'INTENTION DE LA PÉRIODE k, pure. Avant le match (k = 0), elle se lit sur ton alignement et ton plan : une
 * vedette loin devant les autres appelle l'ombre ; un club sans dur, la chasse ; un plan qui paie le Tir, la
 * fermeture du centre ; un plan qui paie la Défense, l'assaut ; un club qui écope, les punitions. Ensuite, sur ce
 * qui s'est passé (`hist`) : un trio qui a marqué deux fois, un joueur qui en a marqué deux, le pointage, tes
 * punitions. Une intention qui leur a coûté la période perd de son attrait, une qui a marché revient. Leur intention
 * dominante (V27, tranche 6 : le jeu que le rival a montré à son annonce) a `POIDS_DOMINANTE` d'attrait de plus à chaque
 * période ; `seule` la choisit d'office (leur jeu, tel que l'écran du choix le lit, `leurJeuDuDuel`).
 * Rend { cle, cible, par, pourquoi }.
 */
function intentionDuDuel({ toi, L, Ladv = null, k = 0, hist = [], graine = 0, cle = '', dominante = null, seule = false }) {
  const F = habillesDuGroupe(L, 'F').sort((a, b) => ptsDe(b.p) - ptsDe(a.p));
  const D = habillesDuGroupe(L, 'D').sort((a, b) => ptsDe(b.p) - ptsDe(a.p));
  const vedette = F[0] ? F[0].p : null, brigadier = D[0] ? D[0].p : null;
  const score = {}, pourquoi = {}, cible = { ombre: vedette, chasse: brigadier };
  const ajouter = (c, v, why = null, extra = {}) => {
    score[c] = (score[c] || 0) + v;
    if (why && v > 0 && (!pourquoi[c] || v > pourquoi[c].v)) pourquoi[c] = { cle: why, v, ...extra };
  };
  for (const c of Object.keys(INTENTIONS)) ajouter(c, 1 + 0.9 * hache(graine, 'intention', cle, k, c));
  if (k === 0) {
    const p1 = ptsDe(vedette), p2 = F[1] ? ptsDe(F[1].p) : 0;
    ajouter('ombre', 1.5 * Math.min(1, Math.max(0, (p1 - p2) / Math.max(p2, 0.1))) + 0.3, 'vedette');
    const sansDur = !SLOTS.some(s => !s.scratch && L[s.i] && L[s.i].p !== 'G' && robusteDe(L[s.i]) >= ROBUSTE_DISSUADE);
    ajouter('chasse', sansDur ? 1.2 : 0.3, sansDur ? 'sansDur' : 'brigadier');
    if (coachPaie(toi, 'tir')) ajouter('centre', 1.2, 'planTir');
    if (coachPaie(toi, 'defense')) ajouter('assaut', 1.2, 'planDefense');
    // Un club qui écope plus que le leur : ils iront le chercher.
    const pim = L0 => Object.values(L0 || {}).filter(p => p && p.p !== 'G').reduce((a, p) => a + (p.pim || 0) / Math.max(1, p.gp || 1), 0);
    if (Ladv && pim(L) > 1.15 * pim(Ladv)) ajouter('cachot', 1.2, 'indiscipline');
  } else {
    const avant = hist[k - 1];
    if (avant.pointage.moi > avant.pointage.lui) ajouter(avant.intention.cle, -1.5);
    else ajouter(avant.intention.cle, 0.8, 'garde');
    const fin = hist[hist.length - 1].fin;
    if (fin.moi > fin.lui) ajouter('assaut', 2, 'mene');
    if (fin.moi < fin.lui) ajouter('centre', 1.5, 'traine');
    const punis = hist.reduce((a, h) => a + h.punitions, 0);
    if (punis >= 2) ajouter('cachot', 2, 'punitions', { n: punis });
    // Les buts de ce match, par trio et par marqueur.
    const buts = hist.flatMap(h => h.buts);
    const parUnite = [0, 1, 2, 3].map(u => buts.filter(b => b.unite === u));
    const u2 = parUnite.findIndex(b => b.length >= 2);
    if (u2 >= 0) {
      const tops = habillesDuGroupe(L, 'F').filter(x => x.s.unit === u2).sort((a, b) => ptsDe(b.p) - ptsDe(a.p));
      if (tops[0]) { cible.ombre = tops[0].p; ajouter('ombre', 2.5, 'trio', { u: u2, n: parUnite[u2].length }); }
    }
    const marqueurs = new Map();
    for (const b of buts) if (b.marqueur) marqueurs.set(b.marqueur, (marqueurs.get(b.marqueur) || 0) + 1);
    // UN MARQUEUR CHAUD APPELLE LA CHASSE (oct. 2026, S125) : ses deux buts sont aussi ceux de son trio, et l'ombre du trio
    // (+2,5) passait toujours devant la chasse (+1,8) ; la chasse ne sortait qu'à un défenseur qui marque deux fois, jamais
    // dans huit saisons de run (`check_moments_si`). Un joueur qui a marqué deux fois, on le chasse ; un trio dont les buts se
    // partagent, on l'ombre.
    const chaud = [...marqueurs.entries()].filter(([p, n]) => n >= 2 && caseDe(L, p)).sort((a, b) => b[1] - a[1])[0];
    if (chaud) { cible.chasse = chaud[0]; ajouter('chasse', 2.8, 'marqueur', { n: chaud[1] }); }
  }
  if (dominante && INTENTIONS[dominante]) ajouter(dominante, POIDS_DOMINANTE, 'dominante');
  const choix = seule && INTENTIONS[dominante] && (!INTENTIONS[dominante].vise || cible[dominante]) ? dominante
    : Object.keys(INTENTIONS).filter(c => !INTENTIONS[c].vise || cible[c]).sort((a, b) => score[b] - score[a] || (a < b ? -1 : 1))[0];
  const I = INTENTIONS[choix];
  const qui = I.vise ? cible[choix] : null;
  const par = choix === 'ombre' ? leurMeilleur(Ladv, 'defense') : choix === 'chasse' ? leurMeilleur(Ladv, 'robustesse') : null;
  return { cle: choix, cible: qui, par, pourquoi: pourquoi[choix] || { cle: 'lu' } };
}
/*
 * CE QUE LEUR INTENTION POSE sur une période, dans les formes que le moteur lit déjà (`_effetMatch`, `_duelFx`) : les
 * effets des deux clubs, les canaux des deux joueurs nommés (ton visé, leur joueur qui le vise), la blessure et les
 * jambes du visé. `f` : la force de ce qui te frappe et de ce qu'elle leur donne (`FORCE_DUEL`, ou 1 quand ton plan y
 * répond, `forceContre`) ; ce qu'elle leur coûte reste à `FORCE_DUEL`. La même lecture pour le moteur et pour les plans du duel (js/impact.js).
 */
function effetsDeLIntention(I, f = FORCE_DUEL) {
  const J = I && INTENTIONS[I.cle];
  if (!J) return null;
  const eff = e => (e ? [{ source: 'intention', cle: I.cle, nom: J.nom, ico: J.ico, ...e }] : []);
  const { blessure, ...canaux } = J.joueur ? forcer(J.joueur, f) : {};
  // Ce qu'elle leur donne (plus de tirs, plus de finition) est à `f` ; ce qu'elle leur coûte, à `FORCE_DUEL`.
  const leur = J.adv ? Object.fromEntries(Object.entries(J.adv).map(([k, v]) => [k, v ** ((k === 'volume' || k === 'finition') && v > 1 ? f : FORCE_DUEL)])) : null;
  return {
    toi: eff(J.toi && forcer(J.toi, f)), adv: eff(leur),
    joueurs: [[I.cible, J.joueur ? canaux : null], [I.par, J.par ? forcer(J.par, FORCE_DUEL) : null]].filter(([q, e]) => q && e),
    blessure: I.cible && blessure ? blessure : null, jambes: I.cible && J.jambes ? Math.round(J.jambes * f) : 0,
  };
}
/*
 * CE QU'UNE PIÈCE LIT AVANT LA PÉRIODE `k` (js/pieces.js) : le pointage et les tirs déjà joués, la période d'avant, le
 * soir. Les tirs viennent de la feuille (`journal.tirs`, index 1 à 3) ; sans feuille, ils ne se lisent pas.
 */
function etatDuBanc(T, k, cote, moi, lui, journal, series, gros, avant) {
  const autre = cote === 'A' ? 'B' : 'A';
  const t = (c, i) => (journal ? journal.tirs[c][i] : 0);
  let tirsMoi = 0, tirsLui = 0;
  for (let i = 1; i <= k; i++) { tirsMoi += t(cote, i); tirsLui += t(autre, i); }
  const der = k > 0 && journal ? { tirsMoi: t(cote, k), tirsLui: t(autre, k), moi: avant ? avant.moi : 0, lui: avant ? avant.lui : 0 } : null;
  return { k, moi, lui, tirsMoi, tirsLui, der, series, gros, soir: T._soir || {} };
}
/*
 * LES PIÈCES DE LA SOIRÉE (js/pieces.js `bancDuSoir`) : celles dont la condition est la soirée entière jouent le match comme
 * un style, sur ton club (`effet`) et sur l'adversaire (`adv`), leurs minutes et leurs jambes comprises ; le club les garde
 * le temps du match (`_bancSoir`) pour la feuille et les relais. Rend la fonction qui les retire.
 */
function poserLeBancDuSoir(A, B, { series = false, gros = null } = {}) {
  const retraits = [];
  const poser = (X, e) => {
    const avait = '_effetMatch' in X, avant = X._effetMatch;
    X._effetMatch = [...(avant || []), e];
    retraits.push(() => { if (avait) X._effetMatch = avant; else delete X._effetMatch; });
  };
  for (const [T, O] of [[A, B], [B, A]]) {
    const e0 = { k: 0, moi: 0, lui: 0, tirsMoi: 0, tirsLui: 0, der: null, series, gros: !!(gros && gros.duel), soir: T._soir || {} };
    T._bancSoir = bancDuSoir(T.perso, e0);
    for (const x of T._bancSoir) {
      if (x.canaux) poser(T, { source: 'banc', nom: x.P.nom, ico: x.P.ico, ...x.canaux });
      if (x.adv) poser(O, { source: 'banc', nom: x.P.nom, ico: x.P.ico, ...x.adv });
    }
  }
  return () => { for (const r of retraits.reverse()) r(); for (const T of [A, B]) delete T._bancSoir; };
}
/*
 * LE BANC D'UNE PÉRIODE pour le club `T` (js/pieces.js `bancDeLaPeriode`) : les pièces dont la condition se lit, puis
 * leurs relais, posés en effets de la période sur lui (`toi`) et sur l'adversaire (`adv`), et notés à la feuille
 * (`journal.pieces`, `journal.relais`) ; les pièces de la soirée y sont notées à chaque période, sans effet de plus (le
 * match les porte déjà). Rend { toi, adv, notes }.
 */
function bancPose(T, e, cote, journal) {
  const out = { toi: [], adv: [], notes: [] };
  if (!T.perso) return out;
  const soir = T._bancSoir || [];
  const { pieces, relais } = bancDeLaPeriode(T.perso, e, soir);
  for (const x of soir) {
    const note = { cote, k: e.k, cle: x.cle, nom: x.P.nom, ico: x.P.ico, buts: 0, contre: 0, soir: true };
    out.notes.push(note);
    if (journal) journal.pieces.push(note);
  }
  for (const x of pieces) {
    if (x.canaux) out.toi.push({ source: 'piece', nom: x.P.nom, ico: x.P.ico, ...x.canaux });
    if (x.adv) out.adv.push({ source: 'piece', nom: x.P.nom, ico: x.P.ico, ...x.adv });
    const note = { cote, k: e.k, cle: x.cle, nom: x.P.nom, ico: x.P.ico, buts: 0, contre: 0, ...(x.ombre ? { ombre: true } : {}) };
    out.notes.push(note);
    if (journal) journal.pieces.push(note);
  }
  for (const x of relais) {
    (x.cote === 'adv' ? out.adv : out.toi).push({ source: 'relais', nom: x.P.nom, ico: x.P.ico, [x.canal]: x.valeur });
    if (journal) journal.relais.push({ cote, k: e.k, cle: x.cle, nom: x.P.nom, ico: x.P.ico, sur: x.sur, maillon: x.maillon });
  }
  return out;
}

/*
 * LEUR JEU, AVANT LE MATCH (V27, tranche 6) : l'intention contre laquelle ton banc chiffre ses plans, la même pour l'écran
 * du choix et pour les robots. Le rival a montré la sienne à son annonce (`dominante`) : elle, visant qui elle viserait
 * en 1re ; sans dominante (un match de séries), leur intention de la 1re, lue comme le moteur la lira.
 */
export function leurJeuDuDuel(toi, adv, { graine = 0, cle = '', dominante = null } = {}) {
  const L = activeLineup(toi), Ladv = adv ? activeLineup(adv) : null;
  return intentionDuDuel({ toi, L, Ladv, k: 0, hist: [], graine, cle, dominante, seule: !!dominante });
}

/* =====================================================================
   LE CONTRAT (V25) : ce que le moteur appelle, et rien d'autre.
   ===================================================================== */

/* AVANT LE MATCH : leur coach en séries, les pièces de la soirée. Rend ce qui les retire. */
function avantMatch(A, B, LA, LB, journal, { series = false, gros = null } = {}) {
  // LEUR COACH EN SÉRIES (V23 F, js/pieces.js `persoAdverse`) : un club sans personnage qui en porte un pour les
  // séries (`persoSeries`, posé par `creerSeries`) le joue le temps du match, et le dépose après.
  const pretes = [A, B].filter(T => series && !T.perso && T.persoSeries);
  for (const T of pretes) T.perso = T.persoSeries;
  // LE BANC DE CE SOIR (V27) : la feuille garde les cinq cases de chaque club, ce que le banc d'Hier soir relit ; les
  // pièces de la soirée jouent le match entier, posées comme un style.
  if (journal) journal.banc = { A: bancDe(A.perso), B: bancDe(B.perso) };
  const retirerSoir = poserLeBancDuSoir(A, B, { series, gros });
  // EN SÉRIES (V25 C1) : ce qu'une histoire de ronde a posé sur tes joueurs se lit au jour des séries (le match qui vient).
  if (series) for (const T of [A, B]) if (T.isPlayer) effetsDesJoueurs(T, jourDeSerie(T));
  return () => { retirerSoir(); for (const T of pretes) T.perso = null; };
}
/* APRÈS LE MATCH : en séries, les verdicts des promesses (aucun lundi n'y passe). */
function apresMatch(A, B) { for (const T of [A, B]) if (T.isPlayer && T.jourCourant === Infinity) verdictsDuMatin(T, jourDeSerie(T)); }
/*
 * LA SOIRÉE, PÉRIODE PAR PÉRIODE. Au duel (`gros.duel`) : ton plan, pris avant le match (`gros.choix`, V27 tranche 6),
 * pour les trois périodes ; à chacune, leur intention (`intentionDuDuel`, leur dominante comprise), tes moments
 * (`MOMENTS_SI`), ton plan (`effetsDuPlan`) ; pour tous : le banc des deux clubs (ses pièces et leurs relais), lu sur ce
 * qui est déjà joué ; leur coach en séries passe par là aussi. Sans choix (« Ton match, toute la série »), `toi.robotDuel`
 * choisit avant la 1re, s'il y en a un (les robots : le même choix que l'écran, `plansDuDuel`). `fin()` écrit le duel dans
 * `gros.duelJoue` et la feuille (`duel`).
 */
function match(A, B, LA, LB, { gros = null, journal = null, series = false, baseA = null, baseB = null } = {}) {
  const duel = gros && gros.duel ? gros : null;
  const toiA = !!A._gros, toi = toiA ? A : B, adv = toiA ? B : A, cote = toiA ? 'A' : 'B';
  const Ltoi = toiA ? LA : LB, Ladv = toiA ? LB : LA;
  const hist = [];
  if (duel) duel._duelTouches = [];
  let plan = null, enCours = null;
  if (duel) {
    let choix = duel.choix || null;
    if (!choix && typeof toi.robotDuel === 'function') {
      toi._effetMatch = [...((toiA ? baseA : baseB) || [])]; adv._effetMatch = [...((toiA ? baseB : baseA) || [])];
      const intention = intentionDuDuel({ toi, L: Ltoi, Ladv, graine: duel.graineMain, cle: duel.cleMain, dominante: duel.dominante, seule: !!duel.dominante });
      choix = toi.robotDuel({ toi, adv, intention, domicile: toiA, serie: !!duel.serie }) || null;
    }
    plan = choix && choix.plan ? planLu(choix.plan) : null;
  }
  return {
    periode(k, { gfA, gfB, der }) {
      const effA = [], effB = [], vises = [];
      let I = null;
      if (duel) {
        I = intentionDuDuel({ toi, L: Ltoi, Ladv, k, hist, graine: duel.graineMain, cle: duel.cleMain, dominante: duel.dominante });
        // LES MOMENTS DU DUEL (V10, `MOMENTS_SI`) : l'intention annoncée, le temps de sa période ; à la 3e, le pointage après deux.
        if (toi._soir) {
          for (const [k2, M] of Object.entries(MOMENTS_SI)) if (M.duel) delete toi._soir[k2];
          toi._soir[I.cle] = true;
          if (k === 2) { const moi = toiA ? gfA : gfB, lui = toiA ? gfB : gfA; toi._soir[moi > lui ? 'mene' : moi === lui ? 'egal' : 'derriere'] = true; }
        }
        const effToi = toiA ? effA : effB, effAdv = toiA ? effB : effA;
        const viser = (q, e) => {
          if (!q || !e) return;
          const fx = q._duelFx || {};
          for (const [c, v] of Object.entries(e)) if (typeof v === 'number') fx[c] = (fx[c] ?? 1) * v;
          q._duelFx = fx;
          if (!vises.includes(q)) vises.push(q);
        };
        // LEUR INTENTION, le temps de sa période : sur les deux clubs, sur ton joueur visé et le leur qui le vise.
        const fxI = effetsDeLIntention(I, forceContre(plan, I));
        effToi.push(...fxI.toi); effAdv.push(...fxI.adv);
        for (const [q, e] of fxI.joueurs) viser(q, e);
        if (fxI.blessure) { I.cible._duelBlessure = Math.max(I.cible._duelBlessure || 1, fxI.blessure); duel._duelTouches.push(I.cible); }
        if (fxI.jambes) rendreJambes(I.cible, -fxI.jambes);
        // TON PLAN (V27, tranche 6) : celui d'avant le match, les trois périodes.
        const fxPlan = effetsDuPlan(plan, { Ltoi, Ladv }, FORCE_DUEL);
        if (fxPlan) { effToi.push(...fxPlan.toi); effAdv.push(...fxPlan.adv); for (const [q, e] of fxPlan.joueurs) viser(q, e); }
      }
      // LE BANC DES DEUX CLUBS (V27, tranche 5 : ses pièces et leurs relais) ; en séries, leur coach (V23 F).
      const eA = etatDuBanc(A, k, 'A', gfA, gfB, journal, series, !!duel, der && der.A), eB = etatDuBanc(B, k, 'B', gfB, gfA, journal, series, !!duel, der && der.B);
      const xA = bancPose(A, eA, 'A', journal), xB = bancPose(B, eB, 'B', journal);
      effA.push(...xA.toi, ...xB.adv); effB.push(...xB.toi, ...xA.adv);
      enCours = { vises, xA, xB, I, nButs: journal ? journal.buts.length : 0, nPun: journal ? journal.punitions.length : 0 };
      return { effA, effB };
    },
    apres(k, h, cumul) {
      const { vises, xA, xB, I, nButs, nPun } = enCours;
      for (const q of vises) delete q._duelFx;
      for (const n of xA.notes) { n.buts = h.gfA; n.contre = h.gfB; }
      for (const n of xB.notes) { n.buts = h.gfB; n.contre = h.gfA; }
      if (!duel) return;
      const butsP = journal ? journal.buts.slice(nButs).filter(x => x.cote === cote).map(x => { const c = caseDe(Ltoi, x.marqueur); return { marqueur: x.marqueur, unite: c && c.group === 'F' ? c.unit : null }; }) : [];
      const punis = journal ? journal.punitions.slice(nPun).filter(e => e.cote === cote).length : 0;
      hist.push({
        intention: I, plan: plan ? plan.cle : 'match',
        pointage: toiA ? { moi: h.gfA, lui: h.gfB } : { moi: h.gfB, lui: h.gfA },
        fin: toiA ? { moi: cumul.gfA, lui: cumul.gfB } : { moi: cumul.gfB, lui: cumul.gfA }, buts: butsP, punitions: punis,
      });
    },
    fin() {
      if (!duel) return;
      duel.duelJoue = { periodes: hist.map(({ buts, ...x }) => { void buts; return x; }), toi: cote, ...(duel.dominante ? { dominante: duel.dominante } : {}) };
      if (journal) journal.duel = duel.duelJoue;
    },
  };
}
/* LE MATIN DE TON CLUB : les verdicts des promesses finies (le lundi), puis ce qui est posé sur tes joueurs ce jour-là. */
function matin(L, toi, r) {
  verdictsDuMatin(toi, r);
  effetsDesJoueurs(toi, r);
}
/*
 * UNE DÉCISION DU ROGUE : une histoire par sa porte (`appliquerChoix`), et le coach : son entraîneur, son banc. Une vieille
 * décision `plan` (le plan du soir, parti à la V27, tranche 6b) ne joue rien.
 */
function decision(team, d, graine) {
  if (d.moment) appliquerChoix(team, d, graine);
  appliquerPerso(team, d);
}
/* LEUR COACH EN SÉRIES (V23 F) : en Rogue, chaque adversaire des séries porte un coach-personnage pur. */
function coachDeSeries(S, t) {
  return S.toi && S.toi.courbe && t !== S.toi && !t.perso ? persoAdverse(t) : null;
}
/*
 * UNE LECTURE (js/impact.js, `lectureDuMatch`) : un plan de match et leur intention d'une période, posés le temps de la
 * lecture comme le match les pose (sans la blessure ni les jambes, qui arrivent après) ; `duel`, à la force du duel.
 */
function lecture(team, adv, lu, { plan = null, intention = null, duel = false } = {}) {
  const out = { toi: [], adv: [], retirer: () => {} };
  const retraits = [];
  const fxPlan = plan ? effetsDuPlan(planLu(typeof plan === 'string' ? { cle: plan } : plan), { Ltoi: lu, Ladv: adv ? activeLineup(adv) : null }, duel ? FORCE_DUEL : 1) : null;
  if (fxPlan) { out.toi.push(...fxPlan.toi); out.adv.push(...fxPlan.adv); retraits.push(poserFxDeJoueurs(fxPlan.joueurs)); }
  const fxI = intention ? effetsDeLIntention(intention, forceContre(planLu(typeof plan === 'string' ? { cle: plan } : plan), intention)) : null;
  if (fxI) { out.toi.push(...fxI.toi); out.adv.push(...fxI.adv); retraits.push(poserFxDeJoueurs(fxI.joueurs)); }
  out.retirer = () => { for (const r of retraits.reverse()) r(); };
  return out;
}

/*
 * UNE DÉCISION À VENIR, LE TEMPS D'UNE LECTURE (`poserAVenir`, js/sim.js) : l'effet de club d'une histoire (rendu,
 * le moteur l'ajoute aux effets du jour ou du match de séries qui vient), le coach et son banc.
 */
function aVenir(team, d) {
  const effet = d.moment ? effetDuChoix(team, d) : null;
  appliquerPerso(team, d);
  return { effet };
}

brancherGreffes({ avantMatch, apresMatch, match, matin, decision, coachDeSeries, lecture, aVenir });
