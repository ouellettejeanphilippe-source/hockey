/*
 * LES ARCS (Jalon P, E, js/arcs.js). JP : *chaque événement doit être tie up au moteur : chaque chose que tu dis hors
 * moteur doit se voir dans le vrai jeu ; si blessure, séquence, etc., ça doit causer ou être causé par le moteur*.
 *
 *   1. UN ARC NAÎT D'UN FAIT : chaque début se relit dans le journal du club au matin où il commence (cinq
 *      victoires de suite, quatre défaites, la raclée et son pointage, la recrue et ses buts, le meneur blessé) ;
 *   2. IL JOUE DANS LE MOTEUR : chaque épisode pose son effet dans `team.effets`, sur ses matchs ;
 *   3. IL EST PUR : la même ligue rejoue les mêmes arcs, aux mêmes jours ;
 *   4. IL COMPTE, SANS DÉCIDER UNE SAISON (JP, 13 oct. : *ils peuvent nuire ou aider*) : chaque arc, ses deux
 *      épisodes joués comme des blocs de leurs matchs, AVEC et SANS leur effet, sur les mêmes dés (comme
 *      check_cartes mesure une carte), reste sous la borne d'une carte peu commune (±1,5 V). Sa cible : l'équipe,
 *      un joueur (le meilleur pointeur du club mesuré, son gardien pour les arrêts) ou l'adversaire du bloc.
 *      La même ligue jouée avec et sans arcs se dit aussi, sans se juger : une saison appariée diverge au
 *      moindre écart, le bloc apparié, non. Et le 82-0 n'en a pas.
 *   5. IL EST VARIÉ : d'une graine à l'autre, la même équipe ne vit pas les mêmes arcs ; les trois familles
 *      (équipe, joueur, adversaire) se voient.
 *
 *   node scripts/check_arcs.mjs            (LIGUES=4 ligues pour les faits ; REPRISES=200 blocs par épisode)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, grainerHasard, playGame, recupererEnergie, effetsDesJoueurs } from '../js/sim.js';
import { ARCS, ARCS_PAR_SAISON, DEFIS, avanceDuDefi } from '../js/arcs.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LIGUES = Number(process.env.LIGUES ?? 4);
const SAISONS = ['1985-86', '1995-96', '2005-06', '2010-11', '2015-16', '2021-22'];
const t0 = Date.now();

function ligue(saison, toiIdx, opts) {
  const sh = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', `${saison}.json`), 'utf8'));
  const tags = [...new Set(sh.players.map(p => p.t))];
  const teams = tags.map((t, i) => { const j = equipeReelle(sh.season, t).flat().map(x => ({ ...x })); j.forEach(registerHiddenRatings); return createTeam(t, t, autoRoster(j), { season: sh.season, isPlayer: i === toiIdx }); });
  const toi = teams.splice(toiIdx % teams.length, 1)[0];
  teams.unshift(toi);
  return { L: jouerJusqua(creerLigue(teams, 82, opts), Infinity), toi };
}

const butsDe = (e, p) => (e && e.feuille ? e.feuille.buts.filter(b => b.marqueur === p).length : 0);
const rangees = [], suites = new Set(), familles = new Set();
let faux = 0, total = 0, sansEffet = 0, trop = 0, defis = 0, defisFaux = 0, releves = 0;
const diffs = [];
for (let k = 0; k < LIGUES; k++) {
  const saison = SAISONS[k % SAISONS.length], graine = `arcs-${k}`;
  const avec = ligue(saison, 3 + k, { graine, courbe: true });
  const sans = ligue(saison, 3 + k, { graine, courbe: true, arcs: false });
  const { toi } = avec;
  const arcs = toi.arcs || [];
  if (arcs.filter(a => a.ep === 0).length > ARCS_PAR_SAISON) trop++;
  // 1. Le fait du début, relu dans le journal : les matchs joués avant ce matin-là.
  for (const a of arcs.filter(x => x.ep === 0)) {
    total++;
    const j = toi.journal.slice(0, a.matchsAuDebut);
    const fin = j.slice(-5);
    const ok = a.cle === 'emballe' ? j.slice(-5).every(e => e.win) && !(j.length > 5 && j[j.length - 6].win)
      : a.cle === 'huisClos' ? j.slice(-4).every(e => !e.win) && !(j.length > 4 && !j[j.length - 5].win)
        : a.cle === 'raclee' ? j.at(-1) && j.at(-1).ga === a.x.ga && j.at(-1).gf === a.x.gf && a.x.ga - a.x.gf >= 5
          : a.cle === 'recrue' ? a.x.p.elc && fin.reduce((s, e) => s + (e.feuille ? e.feuille.buts.filter(b => b.marqueur === a.x.p).length : 0), 0) === a.x.buts
            : a.cle === 'releve' ? toi.injuriesLog.some(b => b.player === a.x.meneur && b.games === a.x.matchs && b.at === a.matchsAuDebut)
              : a.cle === 'chapeau' ? butsDe(j.at(-1), a.x.p) === a.x.buts && a.x.buts >= 3
                : a.cle === 'vieuxLion' ? butsDe(j.at(-1), a.x.p) === a.x.buts && a.x.buts >= 2 && a.x.age >= 35
                  : a.cle === 'gardienEbranle' ? j.at(-1).gardien === a.x.p && j.at(-1).ga === a.x.ga && a.x.ga >= 6
                    : a.cle === 'gardienFeu' ? j.slice(-3).every(e => e.gardien === a.x.p && e.win && e.ga <= 1)
                      : a.cle === 'heros' ? j.at(-1).win && j.at(-1).ot && butsDe(j.at(-1), a.x.p) >= 1
                        : a.cle === 'beteNoire' ? j.at(-1).adv === a.x.adv && !j.at(-1).win && j.filter(e => e.adv === a.x.adv && !e.win).length === a.x.n
                          : a.cle === 'rancune' ? j.at(-1).adv === a.x.adv && toi.injuriesLog.some(b => b.player === a.x.p && b.games === a.x.matchs && b.at === a.matchsAuDebut)
                          : a.cle === 'ancienClub' ? j.at(-1).adv === a.x.adv && butsDe(j.at(-1), a.x.p) >= 1
                            : a.cle === 'remontee' ? j.at(-1).win
                              : a.cle === 'mitraille' ? j.at(-1).feuille.lancers.filter(l => l.tireur === a.x.p).length === a.x.n && a.x.n >= 6 && !butsDe(j.at(-1), a.x.p)
                                : a.cle === 'frappeur' ? j.at(-1).feuille.physique.filter(x => x.type === 'coup' && x.joueur === a.x.p).length === a.x.n && a.x.n >= 3
                                  : a.cle === 'bagarreur' ? j.at(-1).feuille.physique.some(x => x.type === 'bagarre' && (x.gagnant === 'A' ? x.joueur : x.gagnant === 'B' ? x.cible : null) === a.x.p)
                                    : a.cle === 'verrou' ? j.at(-1).win && j.at(-1).ga === a.x.ga && a.x.ga <= 1
                                      : a.cle === 'calendrier';
    if (!ok) faux++;
  }
  // LES DÉFIS (oct.) : le verdict se recompte dans les feuilles, et la retouche tombe si, et seulement si, il est relevé.
  for (const a of arcs.filter(x => x.ep === 1 && x.x && x.x.defi)) {
    defis++;
    // Relu au jour du verdict (le journal jusqu'à ce matin-là) ; le différentiel, compté en cours de saison, se relit au verdict.
    const v = a.x.defi.stat === 'pm' ? a.x.avance : avanceDuDefi(toi, a.x, a.matchsAuDebut);
    if (v && a.x.avance && (v.fait !== a.x.avance.fait || v.reussi !== a.x.avance.reussi)) defisFaux++;
    const pose = (toi.mutations || []).some(m => m.cle === DEFIS[a.x.defi.stat].recompense && m.p === a.joueur && m.jour === a.jour);
    if (!v || !v.fini || v.reussi !== !!a.recompense || pose !== !!a.recompense) defisFaux++;
    if (a.recompense) releves++;
  }
  // 2. Chaque épisode a posé son effet, au jour dit.
  for (const a of arcs) if (![...toi.effets, ...(toi.effetsCibles || [])].some(e => e.source === 'arc' && e.debut === a.jour && e.nom === a.titre)) sansEffet++;
  for (const a of arcs) familles.add(ARCS[a.cle].famille);
  suites.add(arcs.filter(a => a.ep === 0).map(a => a.cle).join(','));
  diffs.push(avec.toi.PTS - sans.toi.PTS);
  rangees.push(`${saison} ${toi.name} : ${arcs.map(a => `${a.cle}${a.ep ? '+' : ''}`).join(' ') || 'aucun'} · ${avec.toi.PTS} pts avec, ${sans.toi.PTS} sans`);
  if (k === 0) {
    // 3. Pur : la même ligue, rejouée, vit les mêmes arcs.
    const re = ligue(saison, 3 + k, { graine, courbe: true });
    exiger('la même ligue rejoue les mêmes arcs, aux mêmes jours', JSON.stringify(re.toi.arcs.map(a => [a.cle, a.ep, a.jour, a.texte])) === JSON.stringify(arcs.map(a => [a.cle, a.ep, a.jour, a.texte])), `${arcs.length} épisodes`);
    // Le 82-0 (une ligue sans la courbe du Rogue) n'en a pas.
    const base = ligue(saison, 3 + k, { graine });
    exiger('le 82-0 n\'a pas d\'arcs', !(base.toi.arcs || []).length, 'une ligue sans `courbe`');
  }
}
for (const r of rangees) informer('une ligue', r);
exiger('chaque arc naît d\'un fait relu dans le journal du club, avec ses vrais chiffres', total > 0 && !faux, `${total} débuts d'arc, ${faux} sans leur fait`);
exiger('chaque épisode pose son effet dans le moteur, au jour dit', !sansEffet, `${sansEffet} épisode(s) sans effet`);
exiger('un défi se recompte dans les feuilles, et sa retouche tombe si, et seulement si, il est relevé', !defisFaux, `${defis} verdicts, ${releves} relevés, ${defisFaux} faux`);
exiger(`au plus ${ARCS_PAR_SAISON} arcs par saison`, !trop, `${trop} saison(s) de trop`);
exiger(`${Object.keys(ARCS).length} arcs, deux épisodes chacun, de trois familles`, Object.values(ARCS).every(A => A.episodes.length === 2) && new Set(Object.values(ARCS).map(A => A.famille)).size === 3, Object.keys(ARCS).join(', '));
exiger('varié : chaque saison vit sa propre suite d\'arcs, et plus d\'une famille se voit', suites.size === LIGUES && familles.size >= 2, `${suites.size} suites sur ${LIGUES} · familles ${[...familles].join(', ')}`);
const moy = diffs.reduce((a, x) => a + x, 0) / diffs.length;
informer('la même ligue avec et sans arcs (bruit de saison, non jugé)', `${moy >= 0 ? '+' : ''}${moy.toFixed(1)} point en moyenne sur ${diffs.length} paires`);

/* 4. LA VALEUR D'UN ARC : ses deux épisodes, chacun un bloc de ses matchs, avec et sans son effet, sur les mêmes dés. */
{
  const sh = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', '2005-06.json'), 'utf8'));
  const club = tag => { const j = equipeReelle(sh.season, tag).flat().map(x => ({ ...x })); j.forEach(registerHiddenRatings); return createTeam(tag, tag, autoRoster(j), { season: sh.season }); };
  const X = club('CAR'), Y = club('BUF');
  const REPRISES = Number(process.env.REPRISES ?? 200);
  // La cible d'un épisode dans le bloc : le meilleur pointeur du club (son gardien partant pour les arrêts), ou l'adversaire.
  const vedette = Object.values(X.roster).filter(p => p && p.p !== 'G').sort((a, b) => (b.pt || 0) - (a.pt || 0))[0];
  const gardien = Object.values(X.roster).filter(p => p && p.p === 'G').sort((a, b) => (b.gp || 0) - (a.gp || 0))[0];
  const bloc = (E, matchs, k, avec) => {
    for (const t of [X, Y]) { t.injured.clear(); t.effets = []; t.effetsCibles = []; t.jourCourant = 0; for (const p of Object.values(t.roster)) if (p) p.energie = 100; }
    const x = { debut: 0, fin: Infinity, source: 'arc', nom: 'mesure', ...E.effet };
    if (avec && E.cible === 'equipe') X.effets = [x];
    if (avec && E.cible === 'joueur') X.effetsCibles = [{ ...x, joueur: E.effet.arrets ? gardien : vedette }];
    if (avec && E.cible === 'contre') X.effetsCibles = [{ ...x, contre: Y }];
    effetsDesJoueurs(X, 0);
    let v = 0;
    for (let g = 0; g < matchs; g++) {
      grainerHasard(`arc:${k}:${g}`);
      if (playGame(X, Y, g, false).winner === X) v++;
      recupererEnergie(X); recupererEnergie(Y);
    }
    return v;
  };
  const lignes = [];
  let pire = 0;
  for (const [cle, A] of Object.entries(ARCS)) {
    let net = 0;
    // Un arc contre un adversaire joue toute la saison, mais seulement contre lui : on le mesure sur quatre matchs contre lui.
    for (const E of A.episodes) { const m = E.cible === 'contre' ? 4 : E.matchs; for (let k = 0; k < REPRISES; k++) net += (bloc(E, m, `${cle}:${k}`, true) - bloc(E, m, `${cle}:${k}`, false)) / REPRISES; }
    lignes.push(`${cle} ${net >= 0 ? '+' : ''}${net.toFixed(2)} V`);
    pire = Math.max(pire, Math.abs(net));
  }
  informer('la valeur de chaque arc, ses deux épisodes en paires', lignes.join(' · '));
  // Pas neutre (JP) : un arc aide ou nuit, sous la borne d'une carte peu commune.
  borne('un arc compte sans décider une saison : sous la borne d\'une peu commune (le plus grand écart, en victoires)', pire, 0, 1.5);
  effetsDesJoueurs(X, 0);
}
informer('le temps', `${((Date.now() - t0) / 1000).toFixed(0)} s, ${LIGUES} ligues en paires`);
verdict('Les arcs');
