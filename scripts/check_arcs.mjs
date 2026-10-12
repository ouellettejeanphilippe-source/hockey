/*
 * LES ARCS (Jalon P, E, js/arcs.js). JP : *chaque événement doit être tie up au moteur : chaque chose que tu dis hors
 * moteur doit se voir dans le vrai jeu ; si blessure, séquence, etc., ça doit causer ou être causé par le moteur*.
 *
 *   1. UN ARC NAÎT D'UN FAIT : chaque début se relit dans le journal du club au matin où il commence (cinq
 *      victoires de suite, quatre défaites, la raclée et son pointage, la recrue et ses buts, le meneur blessé) ;
 *   2. IL JOUE DANS LE MOTEUR : chaque épisode pose son effet dans `team.effets`, sur ses matchs ;
 *   3. IL EST PUR : la même ligue rejoue les mêmes arcs, aux mêmes jours ;
 *   4. IL EST NEUTRE : chaque arc, ses deux épisodes joués comme des blocs de leurs matchs, AVEC et SANS leur
 *      effet, sur les mêmes dés (comme check_cartes mesure une carte) — un arc ne vaut ni ne coûte une victoire.
 *      La même ligue jouée avec et sans arcs se dit aussi, sans se juger : une saison appariée diverge au
 *      moindre écart (mesuré : des effets nettement négatifs y lisaient −1,5 point, des effets à peine
 *      positifs +5), le bloc apparié, non. Et le 82-0 n'en a pas.
 *
 *   node scripts/check_arcs.mjs            (LIGUES=4 ligues pour les faits ; REPRISES=200 blocs par épisode)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, grainerHasard, playGame, recupererEnergie } from '../js/sim.js';
import { ARCS, ARCS_PAR_SAISON } from '../js/arcs.js';
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

const rangees = [];
let faux = 0, total = 0, sansEffet = 0, trop = 0;
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
            : a.cle === 'meneur' ? toi.injuriesLog.some(b => b.player === a.x.p && b.games === a.x.matchs && b.at === a.matchsAuDebut)
              : true;
    if (!ok) faux++;
  }
  // 2. Chaque épisode a posé son effet, au jour dit.
  for (const a of arcs) if (!toi.effets.some(e => e.source === 'arc' && e.debut === a.jour && e.nom === a.titre)) sansEffet++;
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
exiger(`au plus ${ARCS_PAR_SAISON} arcs par saison`, !trop, `${trop} saison(s) de trop`);
exiger(`six arcs, deux épisodes chacun`, Object.values(ARCS).every(A => A.episodes.length === 2), Object.keys(ARCS).join(', '));
const moy = diffs.reduce((a, x) => a + x, 0) / diffs.length;
informer('la même ligue avec et sans arcs (bruit de saison, non jugé)', `${moy >= 0 ? '+' : ''}${moy.toFixed(1)} point en moyenne sur ${diffs.length} paires`);

/* 4. LA VALEUR D'UN ARC : ses deux épisodes, chacun un bloc de ses matchs, avec et sans son effet, sur les mêmes dés. */
{
  const sh = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', '2005-06.json'), 'utf8'));
  const club = tag => { const j = equipeReelle(sh.season, tag).flat().map(x => ({ ...x })); j.forEach(registerHiddenRatings); return createTeam(tag, tag, autoRoster(j), { season: sh.season }); };
  const X = club('CAR'), Y = club('BUF');
  const REPRISES = Number(process.env.REPRISES ?? 200);
  const bloc = (effet, matchs, k, avec) => {
    for (const t of [X, Y]) { t.injured.clear(); t.effets = []; t.jourCourant = 0; for (const p of Object.values(t.roster)) if (p) p.energie = 100; }
    if (avec) X.effets = [{ debut: 0, fin: Infinity, source: 'arc', nom: 'mesure', ...effet }];
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
    for (const E of A.episodes) for (let k = 0; k < REPRISES; k++) net += (bloc(E.effet, E.matchs, `${cle}:${k}`, true) - bloc(E.effet, E.matchs, `${cle}:${k}`, false)) / REPRISES;
    lignes.push(`${cle} ${net >= 0 ? '+' : ''}${net.toFixed(2)} V`);
    pire = Math.max(pire, Math.abs(net));
  }
  informer('la valeur de chaque arc, ses deux épisodes en paires', lignes.join(' · '));
  borne('un arc ne vaut ni ne coûte une victoire (le plus grand écart, en victoires)', pire, 0, 0.35);
}
informer('le temps', `${((Date.now() - t0) / 1000).toFixed(0)} s, ${LIGUES} ligues en paires`);
verdict('Les arcs');
