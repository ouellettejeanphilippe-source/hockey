/*
 * LA SAISON DU 82-0 (sorti de js/game.js en 1.0) : la ligue se crée, joue ses 82 matchs d'un coup, et le bilan se compose ;
 * les séries se regardent ensuite match par match (js/bilan.js, js/saison.js). Une partie reprise se REJOUE de sa graine.
 *
 * Le jour à jour — derrière le banc, les décisions en saison, le ballottage sur blessure, l'écran de saison — était au
 * Rogue d'avant : il est parti avec lui (V28, tranche 4). Le moteur joue toujours les décisions qu'une vieille partie du 82-0
 * porte (js/sim.js) : rien ne s'y ajoute plus.
 */

import { getHiddenRatings, getPlayerKey, photoAlignement, connaitre, poserAlignementDuJour, createTeam, creerLigue, jouerJusqua, simulate, bilanLigue } from './sim.js';
import { nomDuClub } from './club.js';
import { chargerTable } from './charge-table.js';
import { runPlayoffs, nombreEnSeries, renderResult } from './bilan.js';
import { habillerLaLigue } from './rogue.js';
import { $, G, alignementAuCartable, applyTeamColors, buildOpponents, capLeft, saveGame, slotsLeft } from './game.js';
import { getShard, poserCartes } from './repechage.js';

/*
 * LE VOILE DE L'ATTENTE (S74b). Une partie reprise rejoue sa saison — deux à quatre secondes de calcul sur un téléphone.
 * Un voile le dit, peint AVANT le calcul (deux images d'animation : le calcul bloque le fil, et un voile posé juste avant
 * ne serait jamais dessiné).
 */
function voile(on, mot) {
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

/* Les joueurs qu'une vieille partie nomme hors du vestiaire (un réclamé, un relâché), retrouvés dans leurs shards : clé → joueur. */
export const ballottageVu = new Map();

/* La personne d'une clé de joueur-saison (« saison_club_id » → « saison_id ») : `getPersonKey` sans l'objet. */
export function personneDeCle(cle) {
  const parts = String(cle).split('_');
  return parts.length === 3 ? `${parts[0]}_${parts[2]}` : `${parts[0]}_${parts.slice(2).join('_')}`;
}
/*
 * À la reprise d'une vieille partie : les joueurs d'un ballottage (réclamés et libérés), les réservistes relâchés (S80)
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
  // UNE REPRISE N'EST JAMAIS REFUSÉE (oct.) : la saison en cours se rejoue avec l'alignement qu'elle a, case vide
  // comprise (un blessé, un relâché) — le refus laissait l'écran fermé pour de bon, sur une page vide.
  if (!opts.reprise && (slotsLeft() > 0 || G.done || (capLeft() < 0 && !opts.adversaires))) return;
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
    opponents = opts.adversaires.map(a => createTeam(a.name, a.tag, a.roster, { season: a.season, ecole: a.ecole || [] }));
  } else {
    try { opponents = await buildOpponents(31); } catch { opponents = []; }
  }
  // Aucune carte chez les adversaires du 82-0 : une ligue d'avant, ou la run en carte, n'en laisse pas sur leurs joueurs.
  habillerLaLigue(opponents, 0, p => getHiddenRatings(p).v);
  // TU ES LA 33e ÉQUIPE. Une saison fixée met dans la ligue TOUS ses vrais
  // clubs, et la tienne par-dessus : trente-trois en 2024-25, vingt-deux en
  // 1985-86. C'était le club le plus faible qui cédait sa place pour garder
  // l'effectif pair ; la cédule sait maintenant faire jouer un nombre impair
  // d'équipes (une en congé chaque journée, 82 matchs pour tout le monde —
  // voir `simulateLeague`), donc plus personne n'est retranché.

  const you = createTeam(nomDuClub(), 'YOU', G.roster, { isPlayer: true });
  // LES DÉCISIONS (voir `simulateLeague`) : la décision 0 est l'alignement du repêchage. Une reprise rejoue exactement
  // celles que la partie porte.
  const decisions = opts.decisions && opts.decisions.length ? opts.decisions : [{ jour: 0, cases: photoAlignement(G.roster), fermeture: 'auto' }];
  poserCartes(decisions);
  let r = null, teams, leaders = [], calendrier = [], graine = null, moteur = null;
  if (opponents.length) {
    moteur = creerLigue([you, ...opponents], 82, { graine: opts.graine || null, decisions, des: desPrec });
    jouerJusqua(moteur, opts.depuis || 0);
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
    adversaires: opponents.map(t => ({ name: t.name, tag: t.tag, roster: t.roster, season: t.season, ecole: t.ecole || [] })),
  };

  if (!moteur) {
    // La saison solo (aucun adversaire) : `simulate` a tout joué, il n'y a rien à révéler.
    G.journee = calendrier.length; saveGame();
    renderResult(r, you, teams, leaders, calendrier);
    return;
  }
  // LA SAISON SE JOUE D'UN COUP (oct.). JP : *le mode saison, c'est le mode 82-0 comme les sites du genre* : les 82 matchs
  // filent au bilan, puis les séries match par match.
  terminerSaison();
  saveGame();
}

/*
 * LA FIN DE LA SAISON : le classement, les meneurs et la fiche, composés à la
 * dernière journée — jamais avant, puisque rien n'était joué d'avance.
 */
function terminerSaison() {
  const L = G.ligue, M = L.moteur;
  jouerJusqua(M, Infinity);
  const b = bilanLigue(M);
  const you = L.you;
  L.teams = b.standings;
  G.journee = M.calendrier.length;
  renderResult({ W: you.W, L: you.L, OTL: you.OTL, GF: you.GF, GA: you.GA, points: you.PTS }, you, b.standings, b.leaders, M.calendrier);
}
