/*
 * LES GREFFES DU ROGUE (V25, docs/refonte-v25.md § A). Ce que le Rogue pose sur un match, un soir, un matin ou une
 * décision : le coach-personnage et ses pouvoirs (V21), les adjoints en poste et leurs relais (V22, V23 D), leur coach
 * en séries (V23 F), le duel en trois périodes (V9, V17), les histoires appliquées et les suivis des fils (V9, V22),
 * l'expérience et les séjours. Le moteur (js/sim.js) n'importe rien de tout ça : ce module se branche sur lui au
 * chargement (`brancherGreffes`) par un contrat de huit fonctions, et le 82-0 n'y pose rien.
 *
 * Le contrat (lu par le moteur, et lui seul) :
 *   avantMatch(A, B, LA, LB, journal, { series, gros })   ce qui se pose avant le match ; rend la fonction qui le retire
 *   match(A, B, LA, LB, { gros, journal, series })          la soirée : `periode(k, etat)` rend les effets des deux clubs,
 *                                                            `apres(k, h, cumul)` note ce qui a joué, `fin()` écrit le duel
 *   apresMatch(A, B)                                         après le match (les séjours finis)
 *   xp(T, quoi)                                              l'expérience du coach : 'victoire', 'gros', 'serie'
 *   matin(L, toi, jour)                                      le matin de ton club : les arcs, les retours des fils
 *   decision(team, d, graine)                                une décision prise à l'écran ; rend la mutation qu'elle porte
 *   coachDeSeries(S, t)                                      leur coach-personnage pour les séries, ou null
 *   lecture(team, adv, lu, { plan, intention, duel })        un plan et une intention posés le temps d'une lecture
 *   aVenir(team, d, { serie })                               ce qu'une décision à venir a de pur, posé le temps d'une lecture
 */
import { POUVOIRS, pouvoirsDeLaPeriode, XP, niveauDuPerso, TALENT_CASE, persoAdverse } from './pouvoirs.js';
import { ADJOINTS, mainDe, postesDe, embaucher, poster, finirLesSejours, resteDe, styleAuNiveau, nivDe, salaireDe, relaisDeLaPeriode } from './adjoints.js';
import { COACHS, coachDesRoles } from './coachs.js';
import { DOSSIERS } from './dossiers.js';
import { CHOIX_DES_FILS, texteDuRetour, voixDuFil } from './vie-gm.js';
import { episodesDuMatin } from './arcs.js';
import { nomCourt } from './recit.js';
import { estD, hache } from './util.js';
import {
  brancherGreffes, SLOTS, getPlayerKey, famillesDe, profilsDe, badgeGardien, apresMatchs, CONNUS, DUREE_MOMENT,
  rendreJambes, grainerHasard, MOMENTS_SI, AVANT_GROS, deDuPari, cleDuPari, appliquerGestes, poserSurJoueur, effetsDesJoueurs,
  appliquerMutation, MUTATIONS, activeLineup, ENV_MESURE,
} from './sim.js';

/* LA COULEUR D'UN JOUEUR (v2, js/coachs.js) : le coach de son meilleur rôle maîtrisé ; elle oriente les packs du coach. */
export const coachDuJoueur = p => (!p ? null : p.p === 'G' ? ((badgeGardien(p) || {}).coach || null) : coachDesRoles(profilsDe(p), estD(p) ? 'D' : 'F'));

/*
 * LA FAMILLE D'UNE DÉCISION DE MOMENT (V22) : le choix d'un fil (`fil`, js/vie-gm.js) ou un dossier de la semaine
 * (`dossier`, js/dossiers.js). Les dilemmes, les séquences et les réponses de courriel sont partis avec leur banque ; une
 * vieille décision de ces familles ne trouve plus rien et ne joue rien. Même forme { ico, titre, options } pour toutes :
 * `effetDeMoment`, `appliquerGestes`, `pariDeDecision`.
 */
export const familleDeMoment = m => (m.famille === 'fil' ? CHOIX_DES_FILS[m.cle] : m.famille === 'dossier' ? DOSSIERS[m.cle] : undefined);

/*
 * LA DÉCISION D'UN MOMENT → l'effet posé sur l'équipe. Un seul endroit
 * traduit, pour que le moteur, l'écran et la mesure lisent la même chose.
 */
export function effetDeMoment(d, team = null) {
  // V18 : la consigne du match (`d.match`) est partie ; une vieille décision qui la porte ne joue plus rien.
  const m = d.moment;
  if (!m) return null;
  const fam = familleDeMoment(m);
  const o = fam && fam.options.find(x => x.cle === m.choix);
  if (!o) return null;
  const duree = o.duree || DUREE_MOMENT;
  // Les jetons, l'expérience et le plafond d'une réponse, la caisse les lit sur la décision, pas l'effet ; ce qui va au
  // joueur nommé (`lui`), `appliquerDecision` le pose sur lui. Ici, ses canaux d'équipe (js/effets.js).
  const canaux = o.canaux;
  if (!canaux || !Object.keys(canaux).length) return null;
  // UNE DURÉE SE DIT EN MATCHS (1.0, oct.) : avec le vrai calendrier, elle finit le lendemain du N-e match du club.
  // Le nom de l'option nomme son joueur (« … pour {nom} »), comme à l'écran du choix : « Ce qui court » le relit tel quel.
  const choix = String(o.nom || '').replace(/\{nom\}/g, (CONNUS.get(m.joueur) || {}).n || 'lui').replace(/\{aux\}/g, 'l\'auxiliaire');
  return { debut: d.jour, fin: apresMatchs(team, d.jour, duree), source: m.famille || 'moment', nom: fam.titre, ico: fam.ico, choix, ...canaux, ...(o.trou ? { regle: true } : {}) };
}

function gagnerXp(T, bonus = 0) {
  if (T && T.perso) T.xpSaison = (T.xpSaison || 0) + XP.victoire + bonus;
}
/*
 * LE COACH, UN PERSONNAGE (V21, js/pouvoirs.js). La décision `coach` (le jour 0 de chaque saison) porte son expérience
 * d'avant et ses talents ; `talent` et `xpCoach` s'y ajoutent au jour dit. L'expérience de la saison, le moteur la
 * compte (`xpSaison`, `gagnerXp`). V22 (js/adjoints.js) : sa main d'adjoints (`main`) suit la run ; `embauche` ({ cle })
 * y met une carte, `poste` ({ cle }) en pose une sur une case, le jour dit, pour son séjour ; le moteur finit les séjours
 * (`finirLesSejours`). Une vieille décision `adjoint`, `staff` ou `perdAdjoint` (V21) n'est plus lue.
 */
function appliquerPerso(team, d) {
  if (d.coach && d.coach.cle && POUVOIRS[d.coach.cle]) {
    // L'entraîneur (une vraie carte de coach, js/coachs-reels.js) : son nom, sa saison, sa maîtrise (de 1 à 1,2).
    const P = { cle: d.coach.cle, xp: Number(d.coach.xp) || 0, talents: [...(d.coach.talents || [])],
      // Sa main suit la run ; chaque saison repart sans séjour en cours, les cartes gardent leurs fiches.
      main: (d.coach.main || []).filter(c => c && ADJOINTS[c.cle]).map(c => ({ cle: c.cle, depuis: null, fin: null, sejours: [...(c.sejours || [])] })),
      ...(d.coach.chef ? { chef: { ...d.coach.chef } } : {}), maitrise: Math.min(1.3, Math.max(0.9, Number(d.coach.maitrise) || 1)) };
    team.perso = P;
  }
  if (!team.perso) return;
  // Un talent : l'index du pouvoir qui grandit ; au premier, la case d'adjoint de plus (`TALENT_CASE`, nov. 2026), une fois.
  if (d.talent && (Number.isInteger(d.talent.p) || (d.talent.p === TALENT_CASE && !team.perso.talents.includes(TALENT_CASE)))) team.perso = { ...team.perso, talents: [...team.perso.talents, d.talent.p] };
  if (Number(d.xpCoach)) team.perso = { ...team.perso, xp: Math.max(0, team.perso.xp + Number(d.xpCoach)) };
  if (d.embauche && ADJOINTS[d.embauche.cle]) team.perso = { ...team.perso, main: embaucher(team.perso, d.embauche.cle, team.games || 0, d.embauche.niv || null) };
  if (d.poste && ADJOINTS[d.poste.cle]) {
    const niveau = niveauDuPerso({ ...team.perso, xpSaison: team.xpSaison || 0 });
    team.perso = { ...team.perso, main: poster(team.perso, d.poste.cle, team.games || 0, niveau, team) };
  }
}
/*
 * LA FIN D'UN SÉJOUR (V22) : après le match, une carte dont le séjour est fait revient dans la main avec sa fiche, et le
 * club le note pour Hier soir (`sejoursFinis`, lu par js/saison.js).
 */
function finirSejours(T) {
  if (!T.perso || !mainDe(T.perso).length) return;
  const { main, finis } = finirLesSejours(T.perso, T.games || 0, T);
  if (!finis.length) return;
  T.perso = { ...T.perso, main };
  for (const f of finis) (T.sejoursFinis = T.sejoursFinis || []).push({ jour: Number.isFinite(T.jourCourant) ? T.jourCourant : null, ...f });
}

/*
 * LES FILS QUI REVIENNENT (V9, tranche 6 — docs/refonte-v9.md § 6.7, js/vie-gm.js `CHOIX_DES_FILS`). Le choix d'un fil
 * engage un SUIVI, à partir du nombre de matchs déjà au journal du club ; `apres` matchs plus tard, `retoursDuMatin`
 * relit ces feuilles-là, et seulement elles : les buts du joueur nommé, ses points, ou les buts du duo. Le seuil
 * décide de ce qui arrive (`gagne`, `perd`), posé sur les joueurs nommés, le temps de ses matchs. Aucun dé : la
 * saison rejouée relit les mêmes feuilles. `t.retours` garde ce qui est arrivé, pour la une.
 */
function engagerSuivi(team, d, o, fam) {
  const qui = k => (k ? Object.values(team.roster || {}).find(x => x && getPlayerKey(x) === k) || CONNUS.get(k) || null : null);
  const joueur = qui(d.moment.joueur);
  if (!joueur) return;
  (team.suivis = team.suivis || []).push({ cle: d.moment.cle, choix: o.cle, titre: fam.titre, ico: fam.ico, jour: d.jour, matchs0: (team.journal || []).length,
    joueur, deplace: qui(d.moment.deplace), passeur: qui(d.moment.passeur), suivi: o.suivi, fait: false });
}
/* Ce que les feuilles d'un suivi disent : ses buts, ses points, ou les buts du duo. */
function mesureDuSuivi(s, feuilles) {
  let n = 0;
  for (const f of feuilles) for (const b of (f && f.buts) || []) {
    const passe = (b.passeurs || []).includes(s.joueur);
    if (s.suivi.mesure === 'buts' && b.marqueur === s.joueur) n++;
    else if (s.suivi.mesure === 'points' && (b.marqueur === s.joueur || passe)) n++;
    else if (s.suivi.mesure === 'duo' && b.marqueur === s.joueur && s.passeur && (b.passeurs || []).includes(s.passeur)) n++;
  }
  return n;
}
/*
 * OÙ EN EST UN SUIVI (oct. 2026, JP : *ça le confirme bon, mais aucun suivi de ça*). Ses matchs joués depuis le choix,
 * et ce que leurs feuilles disent déjà (`n`), avec ce qu'elles disaient avant le dernier (`avant`) : l'écran le dit
 * chaque matin, à sa maison, et Hier soir quand il bouge. Pur : rien n'est tiré.
 */
export function suivisEnCours(team) {
  const j = team.journal || [];
  return (team.suivis || []).filter(s => !s.fait).map(s => {
    const f = j.slice(s.matchs0, s.matchs0 + s.suivi.apres).map(e => e.feuille);
    return { ...s, n: mesureDuSuivi(s, f), avant: mesureDuSuivi(s, f.slice(0, -1)), joues: f.length };
  });
}
/* Le joueur d'un suivi est-il encore à toi ? Échangé, relâché, réclamé : la promesse ne peut plus se tenir. */
const encoreChezToi = (t, p) => Object.values(t.roster || {}).some(x => x && getPlayerKey(x) === getPlayerKey(p));
function retoursDuMatin(t, jour) {
  const j = t.journal || [];
  for (const s of t.suivis || []) {
    if (s.fait) continue;
    // Parti avant la fin : la promesse tombe, sans gain ni prix, et ça se dit.
    if (!encoreChezToi(t, s.joueur)) {
      s.fait = true;
      (t.retours = t.retours || []).push({ cle: s.cle, choix: s.choix, jour, titre: `${s.ico} ${s.titre} : le retour`, de: voixDuFil(s.cle),
        texte: `${nomCourt(s.joueur.n)} n'est plus dans ton effectif : la promesse tombe.`, effet: {}, matchs: 0, cible: 'equipe', pour: null,
        joueur: s.joueur, n: mesureDuSuivi(s, j.slice(s.matchs0).map(e => e.feuille)), gagne: null, parti: true, debut: s.jour, matchs0: s.matchs0 });
      continue;
    }
    if (j.length - s.matchs0 < s.suivi.apres) continue;
    s.fait = true;
    const n = mesureDuSuivi(s, j.slice(s.matchs0, s.matchs0 + s.suivi.apres).map(e => e.feuille));
    const gagne = n >= s.suivi.seuil, B = gagne ? s.suivi.gagne : s.suivi.perd;
    const noms = { nom: nomCourt(s.joueur.n), deplace: s.deplace ? nomCourt(s.deplace.n) : '', passeur: s.passeur ? nomCourt(s.passeur.n) : '' };
    const effet = {};
    if (B) for (const e of B.effets || []) {
      const { sur, ...canaux } = e, cible = s[sur];
      if (!cible) continue;
      (t.effetsCibles = t.effetsCibles || []).push({ debut: jour, fin: apresMatchs(t, jour, B.duree), source: 'fil', nom: s.titre, joueur: cible, ...canaux });
      Object.assign(effet, canaux);
    }
    (t.retours = t.retours || []).push({ cle: s.cle, choix: s.choix, jour, titre: `${s.ico} ${s.titre} : le retour`, de: voixDuFil(s.cle), texte: texteDuRetour(s.suivi, gagne, n, noms),
      effet, matchs: B ? B.duree : 0, cible: B ? 'joueur' : 'equipe', pour: B ? noms.nom : null, joueur: s.joueur, n, gagne, debut: s.jour, matchs0: s.matchs0 });
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

   Ta réponse, période par période (V17, docs/refonte-v17.md) : ton plan (`PLANS`). À chaque entracte, ton adjoint
   lit la période qui vient et en propose deux ou trois (`propositionsDuDuel`, js/impact.js) ; tu en prends un, ou tu
   gardes le tien. Leur intention est leur plan : elle frappe sa période, avec son prix, et ne se « contre » plus (le
   tableau et ses portes de la V13 sont partis).

   Le moteur coupe le match à 20:00 et à 40:00, avec ou sans décision, et ne relance les dés qu'à ces instants :
   les périodes vues ne bougent pas. Sans décision, la période se joue sans réponse. L'adversaire ne pige aucune
   carte (`horsAdverse`) : ses intentions sont sa main, et il n'a plus de plan à dépister.
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
/*
 * LES INTENTIONS (V17, docs/refonte-v17.md § 3). Ce qu'ils annoncent avant une période, c'est LEUR PLAN : les mêmes
 * leviers que les tiens (`PLANS`), posés par eux, chacun avec son prix, le temps de sa période. `toi` : sur ton club ;
 * `adv` : sur le leur ; `joueur` : sur ton joueur visé (`vise` : son poste) ; `par` : sur leur joueur qui le vise ;
 * `jambes` : ce que la chasse coûte aux jambes du visé. Elle change la FORME de la période, pas sa force : plus de
 * contre ni de porte (le tableau de la V13 est parti) ; ton adjoint propose un plan pour y répondre
 * (`propositionsDuDuel`, js/impact.js).
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
 * Défense, `famillesDe`). Un plan change la FORME du match, pas sa force : chacun paie ce qu'il donne (`check_plan_de_match`).
 * `mot` : le plan en un mot, sur la ligne du match au Bureau (js/saison.js).
 * La décision `plan` dure jusqu'à la suivante ; au duel, une période peut le changer pour elle (`jouerEnPeriodes`).
 */
export const PLANS = {
  match: { ico: '🏒', nom: 'Ton match', mot: 'Ton match', bon: 'Ton alignement tel quel', prix: '' },
  tirer: { ico: '🌧', nom: 'Tirer de partout', mot: 'Tirer', bon: 'Plus de tirs', prix: 'Moins de précision, des jambes qui s\'usent',
    toi: { volume: 1.15, finition: 0.965, energie: 1.1 } },
  ombre: { ico: '🥷', nom: 'Coller leur vedette', mot: 'Coller', bon: 'Leur meilleur marqueur tire moins et rate plus', prix: 'Ton attaquant qui le suit crée moins',
    vedette: { lancers: 0.5, finition: 0.75, creation: 0.75 }, colle: { lancers: 0.65, creation: 0.6 }, toi: { volume: 0.93 } },
  centre: { ico: '⛔', nom: 'Fermer le centre', mot: 'Fermer', bon: 'Moins de tirs contre, et de moins bonne qualité', prix: 'Moins de tirs pour toi',
    toi: { volume: 0.88 }, adv: { volume: 0.92, finition: 0.98 } },
  assaut: { ico: '🐗', nom: 'Forechecker fort', mot: 'Forechecker', bon: 'Plus de tirs, de la pression', prix: 'Plus de punitions et d\'usure',
    toi: { volume: 1.12, finition: 1.02, discipline: 1.25, energie: 1.12 } },
  discipline: { ico: '🧘', nom: 'Rester discipliné', mot: 'Discipline', bon: 'Moins de punitions', prix: 'Moins de mises en échec, un peu moins de tirs',
    toi: { discipline: 0.7, robustesse: -0.4, volume: 0.97 } },
};
/* Une décision `plan` telle que l'équipe la garde : Ton match (ou un plan inconnu) la retire. */
/*
 * `force` (nov. 2026 ; JP : *the duel with the assistants and coach, not random choices*) : au duel, un plan joue à la force
 * de celui qui le propose — un adjoint à son niveau (`FORCE_NIV`, ×0,7 à ×1,3), le coach à sa maîtrise ; bornée là.
 */
const planLu = x => (x && PLANS[x.cle] && x.cle !== 'match' ? { cle: x.cle, vise: x.vise || null, ...(Number(x.force) > 0 ? { force: Math.min(1.3, Math.max(0.7, Number(x.force))) } : {}) } : null);
/* Le plan d'un club ce soir : la décision posée (`team.plan`), sinon Ton match. */
const planDe = team => { const x = team && (team._planMatch || team.plan); return x && PLANS[x.cle] ? x : null; };
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
/*
 * LES PLANS D'UN MATCH ORDINAIRE (`playGame`) : chaque club qui en a un pose ses effets et ses canaux de joueur pour
 * le match, jusqu'aux blessures et à l'usure d'après ; rend la fonction qui remet tout comme avant.
 */
function poserLesPlans(A, B, LA, LB) {
  const retraits = [];
  for (const [T, O, LT, LO] of [[A, B, LA, LB], [B, A, LB, LA]]) {
    const fx = effetsDuPlan(planDe(T), { Ltoi: LT, Ladv: LO });
    if (!fx) continue;
    for (const [X, e] of [[T, fx.toi], [O, fx.adv]]) {
      if (!e.length) continue;
      const avait = '_effetMatch' in X, avant = X._effetMatch;
      X._effetMatch = [...(avant || []), ...e];
      retraits.push(() => { if (avait) X._effetMatch = avant; else delete X._effetMatch; });
    }
    retraits.push(poserFxDeJoueurs(fx.joueurs));
  }
  return () => { for (const r of retraits.reverse()) r(); };
}
/*
 * LES ADJOINTS EN POSTE (V22, js/adjoints.js) : chaque carte posée joue son style le temps du match — sur ton club (`effet`),
 * sur l'adversaire (`adv`) —, et la feuille la nomme avec ce qui lui reste. Rend la fonction qui les retire.
 */
function poserLesAdjoints(A, B, journal) {
  const retraits = [];
  const poser = (X, e) => {
    const avait = '_effetMatch' in X, avant = X._effetMatch;
    X._effetMatch = [...(avant || []), e];
    retraits.push(() => { if (avait) X._effetMatch = avant; else delete X._effetMatch; });
  };
  for (const [T, O, cote] of [[A, B, 'A'], [B, A, 'B']]) {
    if (!T.perso) continue;
    for (const c of postesDe(T.perso, T.games || 0)) {
      // V23 : à son niveau (`styleAuNiveau`, js/adjoints.js ; le Pilier sans niveau, la table telle quelle).
      const J = ADJOINTS[c.cle], S = styleAuNiveau(c.cle, nivDe(c));
      if (S.canaux) poser(T, { source: 'adjoint', nom: J.nom, ico: J.ico, ...S.canaux });
      if (S.adv) poser(O, { source: 'adjoint', nom: J.nom, ico: J.ico, ...S.adv });
      if (journal) (journal.adjoints = journal.adjoints || []).push({ cote, cle: c.cle, nom: J.nom, ico: J.ico, niv: nivDe(c), salaire: salaireDe(c), reste: resteDe(c, T.games || 0, T.perso.cle) });
    }
  }
  return () => { for (const r of retraits.reverse()) r(); };
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
 * punitions. Une intention qui leur a coûté la période perd de son attrait, une qui a marché revient.
 * Rend { cle, cible, par, pourquoi }.
 */
function intentionDuDuel({ toi, L, Ladv = null, k = 0, hist = [], graine = 0, cle = '' }) {
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
  const choix = Object.keys(INTENTIONS).filter(c => !INTENTIONS[c].vise || cible[c])
    .sort((a, b) => score[b] - score[a] || (a < b ? -1 : 1))[0];
  const I = INTENTIONS[choix];
  const qui = I.vise ? cible[choix] : null;
  const par = choix === 'ombre' ? leurMeilleur(Ladv, 'defense') : choix === 'chasse' ? leurMeilleur(Ladv, 'robustesse') : null;
  return { cle: choix, cible: qui, par, pourquoi: pourquoi[choix] || { cle: 'lu' } };
}
/*
 * CE QUE LEUR INTENTION POSE sur une période, dans les formes que le moteur lit déjà (`_effetMatch`, `_duelFx`) : les
 * effets des deux clubs, les canaux des deux joueurs nommés (ton visé, leur joueur qui le vise), la blessure et les
 * jambes du visé. `f` : la force (`FORCE_DUEL`). La même lecture pour le moteur et pour l'adjoint (js/impact.js).
 */
function effetsDeLIntention(I, f = FORCE_DUEL) {
  const J = I && INTENTIONS[I.cle];
  if (!J) return null;
  const eff = e => (e ? [{ source: 'intention', cle: I.cle, nom: J.nom, ico: J.ico, ...forcer(e, f) }] : []);
  const { blessure, ...canaux } = J.joueur ? forcer(J.joueur, f) : {};
  return {
    toi: eff(J.toi), adv: eff(J.adv),
    joueurs: [[I.cible, J.joueur ? canaux : null], [I.par, J.par ? forcer(J.par, f) : null]].filter(([q, e]) => q && e),
    blessure: I.cible && blessure ? blessure : null, jambes: I.cible && J.jambes ? Math.round(J.jambes * f) : 0,
  };
}
/*
 * CE QU'UN POUVOIR LIT AVANT LA PÉRIODE `k` (V21, js/pouvoirs.js) : le pointage et les tirs déjà joués, la période
 * d'avant, le soir. Les tirs viennent de la feuille (`journal.tirs`, index 1 à 3) ; sans feuille, ils ne se lisent pas.
 */
function etatDuPouvoir(T, k, cote, moi, lui, journal, series, gros, avant) {
  const autre = cote === 'A' ? 'B' : 'A';
  const t = (c, i) => (journal ? journal.tirs[c][i] : 0);
  let tirsMoi = 0, tirsLui = 0;
  for (let i = 1; i <= k; i++) { tirsMoi += t(cote, i); tirsLui += t(autre, i); }
  const der = k > 0 && journal ? { tirsMoi: t(cote, k), tirsLui: t(autre, k), moi: avant ? avant.moi : 0, lui: avant ? avant.lui : 0 } : null;
  return { k, moi, lui, tirsMoi, tirsLui, der, series, gros, soir: T._soir || {} };
}
/*
 * LES POUVOIRS D'UNE PÉRIODE pour le club `T` (V21) : ceux qui se déclenchent, posés en effets du soir sur lui (`effet`)
 * et sur l'adversaire (`adv`), et notés à la feuille. Rend { toi, adv, notes }.
 */
function pouvoirsPoses(T, e, cote, journal) {
  const out = { toi: [], adv: [], notes: [] };
  if (!T.perso) return out;
  const perso = { ...T.perso, xpSaison: T.xpSaison || 0 };
  for (const x of pouvoirsDeLaPeriode(perso, e)) {
    if (x.canaux) out.toi.push({ source: 'pouvoir', nom: x.P.nom, ico: x.P.ico, ...x.canaux });
    if (x.adv) out.adv.push({ source: 'pouvoir', nom: x.P.nom, ico: x.P.ico, ...x.adv });
    const note = { cote, k: e.k, p: x.p, cle: x.P.cle, nom: x.P.nom, ico: x.P.ico, buts: 0, contre: 0, ...(x.ombre ? { ombre: true } : {}) };
    out.notes.push(note);
    if (journal) journal.pouvoirs.push(note);
  }
  return out;
}
/*
 * LES RELAIS D'UNE PÉRIODE pour le club `T` (V23 D, js/adjoints.js `relaisDeLaPeriode`) : les adjoints en poste dont le
 * signal se lit — sur ce qu'un pouvoir lit, plus les pouvoirs de ton coach qui jouent la période (`pouvoirs`, leurs
 * notes) —, posés en effets de la période sur le club (`toi`) ou sur l'adversaire (`adv`), et notés à la feuille
 * (`journal.relais`). Rend { toi, adv, notes }.
 */
function relaisPoses(T, e, pouvoirs, cote, journal) {
  const out = { toi: [], adv: [], notes: [] };
  if (!T.perso) return out;
  for (const x of relaisDeLaPeriode(T.perso, T.games || 0, { ...e, pouvoirs: pouvoirs.filter(n => !n.ombre) })) {
    (x.cote === 'adv' ? out.adv : out.toi).push({ source: 'relais', nom: x.nom, ico: x.ico, [x.canal]: x.valeur });
    const note = { cote, k: e.k, cle: x.cle, nom: x.nom, ico: x.ico, niv: x.niv, sur: x.sur, maillon: x.maillon };
    out.notes.push(note);
    if (journal) (journal.relais = journal.relais || []).push(note);
  }
  return out;
}

/* L'intention de la 1re période, AVANT le match (l'écran) : lue comme le moteur la lira. */
export function apercuDuDuel(toi, adv, { graine = 0, cle = '' } = {}) {
  const L = activeLineup(toi), Ladv = adv ? activeLineup(adv) : null;
  return { intention: intentionDuDuel({ toi, L, Ladv, k: 0, hist: [], graine, cle }) };
}

export function pariDeDecision(d, graine, team = null) {
  if (!d || !Number.isFinite(d.jour)) return null;
  const fam = d.moment ? familleDeMoment(d.moment) : d.avant ? AVANT_GROS[d.avant.cle] : null;
  const o = fam && fam.options.find(x => x.cle === (d.moment ? d.moment.choix : d.avant.choix));
  if (!o || !o.pari) return null;
  const { face, faces, gagne } = deDuPari(graine, d.jour, cleDuPari(d), o.pari.chance);
  const effet = gagne ? o.pari.gagne : o.pari.perd;
  return { jour: d.jour, titre: fam.titre, choix: o.nom, gagne, face, faces, effet, fin: apresMatchs(team, d.jour, effet.duree || DUREE_MOMENT) };
}

/* =====================================================================
   LE CONTRAT (V25) : ce que le moteur appelle, et rien d'autre.
   ===================================================================== */

/* AVANT LE MATCH : leur coach en séries, ton plan de match, tes adjoints en poste. Rend ce qui les retire. */
function avantMatch(A, B, LA, LB, journal, { series = false, gros = null } = {}) {
  // LEUR COACH EN SÉRIES (V23 F, js/pouvoirs.js `persoAdverse`) : un club sans personnage qui en porte un pour les
  // séries (`persoSeries`, posé par `creerSeries`) le joue le temps du match, et le dépose après.
  const pretes = [A, B].filter(T => series && !T.perso && T.persoSeries);
  for (const T of pretes) T.perso = T.persoSeries;
  // LE PLAN DE MATCH (V17) : posé avant le profil du match, retiré après ; au duel, chaque période pose le sien.
  const retirerPlans = gros && gros.duel ? () => {} : poserLesPlans(A, B, LA, LB);
  // LES ADJOINTS EN POSTE (V22) : leur style, le temps du match, le duel compris ; la feuille les nomme.
  const retirerAdjoints = poserLesAdjoints(A, B, journal);
  return () => { retirerPlans(); retirerAdjoints(); for (const T of pretes) T.perso = null; };
}
/* APRÈS LE MATCH : les séjours finis reviennent dans la main. */
function apresMatch(A, B) { finirSejours(A); finirSejours(B); }
/*
 * LA SOIRÉE, PÉRIODE PAR PÉRIODE. Au duel (`gros.duel`) : la décision de la période (ses dés neufs), leur intention
 * (`intentionDuDuel`), tes moments (`MOMENTS_SI`), ton plan (`effetsDuPlan`) ; pour tous : les pouvoirs du coach et les
 * relais des adjoints des deux clubs, lus sur ce qui est déjà joué ; leur coach en séries passe par là aussi. Sans
 * décision (« L'adjoint joue cette série », une période qui n'attend personne), `toi.robotDuel` décide, s'il y en a un
 * (la mesure). `fin()` écrit le duel dans `gros.duelJoue` et la feuille (`duel`).
 */
function match(A, B, LA, LB, { gros = null, journal = null, series = false, baseA = null, baseB = null } = {}) {
  const duel = gros && gros.duel ? gros : null;
  const toiA = !!A._gros, toi = toiA ? A : B, adv = toiA ? B : A, cote = toiA ? 'A' : 'B';
  const Ltoi = toiA ? LA : LB, Ladv = toiA ? LB : LA;
  const robot = duel && typeof toi.robotDuel === 'function' ? toi.robotDuel : null;
  const hist = [];
  if (duel) duel._duelTouches = [];
  // Le plan en force au duel : `undefined`, celui du club ; null, Ton match ; sinon le dernier pris.
  let plan;
  let enCours = null;
  return {
    periode(k, { gfA, gfB, der }) {
      const effA = [], effB = [], vises = [];
      let I = null, d = {};
      if (duel) {
        const dec = (duel.periodes || [])[k] || null;
        if (k > 0 && dec && dec.graine) grainerHasard(dec.graine);
        I = intentionDuDuel({ toi, L: Ltoi, Ladv, k, hist, graine: duel.graineMain, cle: duel.cleMain });
        // LES MOMENTS DU DUEL (V10, `MOMENTS_SI`) : l'intention annoncée, le temps de sa période ; à la 3e, le pointage après deux.
        if (toi._soir) {
          for (const [k2, M] of Object.entries(MOMENTS_SI)) if (M.duel) delete toi._soir[k2];
          toi._soir[I.cle] = true;
          if (k === 2) { const moi = toiA ? gfA : gfB, lui = toiA ? gfB : gfA; toi._soir[moi > lui ? 'mene' : moi === lui ? 'egal' : 'derriere'] = true; }
        }
        d = dec;
        if (!d && robot) {
          toi._effetMatch = [...((toiA ? baseA : baseB) || [])]; adv._effetMatch = [...((toiA ? baseB : baseA) || [])];
          d = robot({ k, intention: I, pointage: toiA ? { moi: gfA, lui: gfB } : { moi: gfB, lui: gfA }, domicile: toiA, serie: !!duel.serie, toi, adv, plan: plan === undefined ? planDe(toi) : plan }) || null;
        }
        d = d || {};
        if (d.plan) plan = planLu(d.plan);
        const effToi = toiA ? effA : effB, effAdv = toiA ? effB : effA;
        const viser = (q, e) => {
          if (!q || !e) return;
          const fx = q._duelFx || {};
          for (const [c, v] of Object.entries(e)) if (typeof v === 'number') fx[c] = (fx[c] ?? 1) * v;
          q._duelFx = fx;
          if (!vises.includes(q)) vises.push(q);
        };
        // LEUR INTENTION, le temps de sa période : sur les deux clubs, sur ton joueur visé et le leur qui le vise.
        const fxI = effetsDeLIntention(I);
        effToi.push(...fxI.toi); effAdv.push(...fxI.adv);
        for (const [q, e] of fxI.joueurs) viser(q, e);
        if (fxI.blessure) { I.cible._duelBlessure = Math.max(I.cible._duelBlessure || 1, fxI.blessure); duel._duelTouches.push(I.cible); }
        if (fxI.jambes) rendreJambes(I.cible, -fxI.jambes);
        // TON PLAN DE LA PÉRIODE (V17) : celui que la période choisit, sinon celui d'avant.
        const fxPlan = effetsDuPlan(plan === undefined ? planDe(toi) : plan, { Ltoi, Ladv }, FORCE_DUEL);
        if (fxPlan) { effToi.push(...fxPlan.toi); effAdv.push(...fxPlan.adv); for (const [q, e] of fxPlan.joueurs) viser(q, e); }
      }
      // LES POUVOIRS DU COACH (V21) et LES RELAIS DES ADJOINTS (V23 D) des deux clubs ; en séries, leur coach (V23 F).
      const eA = etatDuPouvoir(A, k, 'A', gfA, gfB, journal, series, !!duel, der && der.A), eB = etatDuPouvoir(B, k, 'B', gfB, gfA, journal, series, !!duel, der && der.B);
      const xA = pouvoirsPoses(A, eA, 'A', journal), xB = pouvoirsPoses(B, eB, 'B', journal);
      const rA = relaisPoses(A, eA, xA.notes, 'A', journal), rB = relaisPoses(B, eB, xB.notes, 'B', journal);
      effA.push(...xA.toi, ...xB.adv, ...rA.toi, ...rB.adv); effB.push(...xB.toi, ...xA.adv, ...rB.toi, ...rA.adv);
      enCours = { vises, xA, xB, I, d, nButs: journal ? journal.buts.length : 0, nPun: journal ? journal.punitions.length : 0 };
      return { effA, effB };
    },
    apres(k, h, cumul) {
      const { vises, xA, xB, I, d, nButs, nPun } = enCours;
      for (const q of vises) delete q._duelFx;
      for (const n of xA.notes) { n.buts = h.gfA; n.contre = h.gfB; }
      for (const n of xB.notes) { n.buts = h.gfB; n.contre = h.gfA; }
      if (!duel) return;
      const butsP = journal ? journal.buts.slice(nButs).filter(x => x.cote === cote).map(x => { const c = caseDe(Ltoi, x.marqueur); return { marqueur: x.marqueur, unite: c && c.group === 'F' ? c.unit : null }; }) : [];
      const punis = journal ? journal.punitions.slice(nPun).filter(e => e.cote === cote).length : 0;
      const pe = plan === undefined ? planDe(toi) : plan;
      hist.push({
        intention: I, plan: pe ? pe.cle : 'match', snap: k === 2 && !!d.snap && !duel.serie,
        pointage: toiA ? { moi: h.gfA, lui: h.gfB } : { moi: h.gfB, lui: h.gfA },
        fin: toiA ? { moi: cumul.gfA, lui: cumul.gfB } : { moi: cumul.gfB, lui: cumul.gfA }, buts: butsP, punitions: punis,
      });
    },
    fin() {
      if (!duel) return;
      const snap = hist.some(x => x.snap);
      duel.snap = snap;
      duel.duelJoue = { periodes: hist.map(({ buts, ...x }) => { void buts; return x; }), snap, toi: cote };
      if (journal) journal.duel = duel.duelJoue;
    },
  };
}
/* L'EXPÉRIENCE DU COACH : une victoire, un gros match gagné (`XP.gros` en plus), une série gagnée (`XP.serie`). */
function xp(T, quoi) {
  if (quoi === 'serie') gagnerXp(T, XP.serie - XP.victoire);
  else gagnerXp(T, quoi === 'gros' ? XP.gros : 0);
}
/*
 * LE MATIN DE TON CLUB. LES ARCS (Jalon P, E, js/arcs.js) : nés des faits de TON club (ses matchs joués, ses blessés, son
 * calendrier), sans hasard ; chaque épisode pose son effet de quelques matchs, comme un moment. Sa cible : l'équipe
 * (`effets`), un joueur ou un adversaire (`effetsCibles`, lus par `mutDe` et `effetsDeSaison`). Puis les retours des fils.
 */
function matin(L, toi, r) {
  if (!L.arcs) return;
  for (const e of episodesDuMatin(toi, r, L.graine)) {
    const x = { debut: r, fin: apresMatchs(toi, r, e.matchs), source: 'arc', nom: e.titre, ...e.effet };
    if (e.cible === 'equipe') toi.effets.push(x);
    else (toi.effetsCibles = toi.effetsCibles || []).push({ ...x, joueur: e.joueur, contre: e.contre });
    // UN DÉFI RELEVÉ (oct., js/arcs.js `DEFIS`) : sa retouche, au verso de sa carte, pour de bon.
    if (e.recompense && e.joueur && MUTATIONS[e.recompense]) appliquerMutation(toi, e.joueur, e.recompense, r, 'defi');
  }
  retoursDuMatin(toi, r);
  effetsDesJoueurs(toi, r);
}
/*
 * UNE DÉCISION DU ROGUE : le plan de match (V17 : il dure jusqu'au suivant, Ton match le retire), l'effet d'une histoire
 * sur l'équipe (`effetDeMoment`), ses gestes réels sur les joueurs nommés, son pari, le suivi d'un fil, ce qui va au
 * joueur nommé (`lui`), et le coach : son expérience, ses talents, ses adjoints. Rend la mutation que l'option porte.
 */
function decision(team, d, graine) {
  if ('plan' in d) team.plan = planLu(d.plan);
  let mutation = null;
  if (d.moment) {
    const fam = familleDeMoment(d.moment);
    const o = fam && fam.options.find(x => x.cle === d.moment.choix);
    if (o && o.mutation && d.moment.joueur) mutation = { cle: o.mutation, joueur: d.moment.joueur };
    const eff = effetDeMoment(d, team);
    if (eff) (team.effets = team.effets || []).push(eff);
    if (o) appliquerGestes(team, o, d.jour, d.moment.joueurs, graine, cleDuPari(d), fam.titre);
    if (o && o.suivi && d.moment.famille === 'fil') engagerSuivi(team, d, o, fam);
    // V11 (tranche 4) : un dossier qui nomme un joueur pose le gros de sa réponse sur lui.
    if (o && o.lui && d.moment.joueurs && d.moment.joueurs[0]) poserSurJoueur(team, d.jour, { joueur: d.moment.joueurs[0], nom: fam.titre, ico: fam.ico, duree: o.duree, ...(o.quand ? { si: o.quand } : {}), ...o.lui });
  }
  appliquerPerso(team, d);
  return { mutation };
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
  const fxI = intention ? effetsDeLIntention(intention) : null;
  if (fxI) { out.toi.push(...fxI.toi); out.adv.push(...fxI.adv); retraits.push(poserFxDeJoueurs(fxI.joueurs)); }
  out.retirer = () => { for (const r of retraits.reverse()) r(); };
  return out;
}

/*
 * UNE DÉCISION À VENIR, LE TEMPS D'UNE LECTURE (`poserAVenir`, js/sim.js) : son plan, l'effet d'une histoire (rendu, le
 * moteur l'ajoute aux effets datés ; en séries, aucun), le coach et ses adjoints.
 */
function aVenir(team, d, { serie = false } = {}) {
  if ('plan' in d) team.plan = planLu(d.plan);
  const effet = serie ? null : effetDeMoment(d, team);
  appliquerPerso(team, d);
  return { effet };
}

brancherGreffes({ avantMatch, apresMatch, match, xp, matin, decision, coachDeSeries, lecture, aVenir });
