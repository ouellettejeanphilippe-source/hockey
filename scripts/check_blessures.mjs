/*
 * LES BLESSURES DU MOTEUR (1.0, oct. ; V28, tranche 4 : ce qui reste du juge de l'écran des blessures).
 * JP : *un "fake" bad player temporary called-up* ; *robustesse cause blessures, pas douze blessés en même temps, mais
 * nombre normal versus la vraie vie*.
 *
 * Ce script joue la vraie ligue (le vrai moteur, jour par jour, les décisions rejouées) et vérifie :
 *   — LE REMPLAÇANT DE LA LIGUE (la décision `remplacant`) : la case d'un blessé confiée au remplaçant tient dans une
 *     ligue reconstruite depuis les décisions (un rechargement), aucun réserviste ne monte, l'alignement ne bouge pas,
 *     et le blessé rejoue sa case à son retour ;
 *   — LE NOMBRE DE LA VRAIE LNH : les blessés à la fois, jamais une infirmerie pleine ;
 *   — LA ROBUSTESSE QUI BLESSE : le même club se blesse plus contre l'adversaire le plus dur.
 *
 * L'écran des blessures du jour à jour (la blessure qui bloque « Jour suivant », ses quatre chemins de correction, le
 * rappel du club-école, le retour proposé) est parti avec l'ancien Rogue : ses vérifications aussi.
 *
 *   node scripts/check_blessures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS, autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, jouerJournee, poserAlignementDuJour, getPlayerKey, photoAlignement, fits, activeLineup, teamStrength, grainerHasard, playGame, INFIRMERIE_PLEINE, ecoleDe } from '../js/sim.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const shard = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

// Les équipes, lues une fois ; chaque `ligue()` en refait des joueurs neufs (un rechargement).
const BRUT = [];
for (const f of SAISONS.slice(10, 40)) {
  const sh = shard(f);
  for (const tag of [...new Set(sh.players.map(p => p.t))].slice(0, 2)) {
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    BRUT.push({ tag, season: sh.season, joueurs: un.flat() });
    if (BRUT.length === 8) break;
  }
  if (BRUT.length === 8) break;
}
// Des réservistes : `autoRoster` n'en remplit pas, un vrai club en a (la pige les donne).
const EST_D = x => /D$/.test(x.p), EST_F = x => x.p !== 'G' && !EST_D(x);
const POOL = shard(SAISONS[3]).players.filter(x => x.gp > 40);
function ligue() {
  return BRUT.map((b, n) => {
    const p = b.joueurs.map(x => ({ ...x })); p.forEach(registerHiddenRatings);
    // La première est la tienne : les décisions l'alignent, un club de l'IA se réaligne seul (`creerLigue`).
    const t = createTeam(`${b.tag} ${b.season}`, b.tag, autoRoster(p), { season: b.season, isPlayer: n === 0 });
    for (const [role, est] of [['Réserve F', EST_F], ['Réserve D', EST_D]]) {
      const sl = SLOTS.find(x => x.role === role);
      const c = { ...POOL.filter(est)[n] };
      registerHiddenRatings(c);
      if (!t.roster[sl.i]) t.roster[sl.i] = c;
    }
    return t;
  });
}
const cle = getPlayerKey;

/* Une ligue reconstruite depuis la graine et les décisions, au jour `n` : un rechargement de la page. */
function etatAuJour(graine, decisions, n) {
  const L = creerLigue(ligue(), 82, { graine, decisions: decisions.map(d => ({ ...d })) });
  jouerJusqua(L, n);
  // L'écran pose tout de suite la part « alignement » des décisions du jour (S79).
  poserAlignementDuJour(L);
  return { L, toi: L.teams[0] };
}
const dE = toi => ({ jour: 0, equipe: 0, cases: photoAlignement(toi.roster) });
// La même blessure, retrouvée dans une ligue reconstruite (les objets changent, la clé et le match non).
const memeBlessure = (toi, b) => toi.injuriesLog.find(x => x.at === b.at && cle(x.player) === cle(b.player));

/*
 * LA BLESSURE D'ESSAI : un patineur habillé de TON club, blessé ce soir pour huit matchs ou plus, qu'un réserviste en
 * santé pourrait remplacer — lue dans le journal du moteur (`injuriesLog`). Les graines se parcourent dans l'ordre : la
 * même à chaque exécution.
 */
function trouver(groupe) {
  for (let g = 0; g < 80; g++) {
    const graine = `blessures-${g}`;
    const teams = ligue();
    const L = creerLigue(teams, 82, { graine, decisions: [dE(teams[0])] });
    poserAlignementDuJour(L);
    const toi = L.teams[0];
    for (let j = 0; j < 60 && !L.fini; j++) {
      jouerJournee(L);
      for (const b of toi.injuriesLog) {
        if (b.at !== toi.games || b.games < 8 || !toi.injured.has(b.player)) continue;
        if (groupe === 'D' ? !/D$/.test(b.player.p) : (b.player.p === 'G' || /D$/.test(b.player.p))) continue;
        const sl = SLOTS.find(s => !s.scratch && toi.roster[s.i] === b.player);
        const reserves = sl ? SLOTS.filter(s => s.scratch && toi.roster[s.i] && !toi.injured.has(toi.roster[s.i]) && fits(toi.roster[s.i], sl)) : [];
        if (sl && reserves.length) return { graine, jour: L.jour, b, depart: dE(toi), nom: b.player.n, at: b.at, cle: cle(b.player), sl, reserves: reserves.map(r => cle(toi.roster[r.i])) };
      }
    }
  }
  return null;
}

/*
 * LE REMPLAÇANT DE LA LIGUE (nov. 2026 ; JP : *un "fake" bad player temporary called-up*). La décision `remplacant`
 * confie la case du blessé au remplaçant (la cote de rappel) : elle tient après un rechargement ; aucun réserviste ne
 * monte ; l'alignement ne bouge pas ; il revient, il rejoue sa case.
 */
function remplacant(groupe, S) {
  const T = `${groupe} · remplaçant de la ligue`;
  const decisions = [S.depart, { jour: S.jour, equipe: 0, sel: 's-remplacant', palier: `b:${S.at}:${S.cle}`, remplacant: { case: S.sl.i, joueur: S.cle } }];
  const apres = etatAuJour(S.graine, decisions, S.jour);
  const b = memeBlessure(apres.toi, S.b);
  exiger(`${T} : la blessure se retrouve dans la ligue refaite depuis les décisions`, !!b && apres.toi.injured.has(b.player), b ? `${b.player.n}, ${b.games} matchs` : 'introuvable');
  if (!b) return;
  exiger(`${T} : sa case est confiée au remplaçant`, !!apres.toi.remplacants && apres.toi.remplacants.get(S.sl.i) === S.cle, S.sl.role);
  const l0 = activeLineup(apres.toi);
  // Personne de l'effectif ne joue la case : ni le blessé, ni un réserviste (il peut monter pour un AUTRE blessé, pas pour celui-ci).
  exiger(`${T} : le remplaçant tient la case, aucun réserviste n'y monte`, l0[S.sl.i] === null, l0[S.sl.i] ? l0[S.sl.i].n : `le remplaçant · ${S.reserves.length} réserviste(s) en santé pouvaient la jouer`);
  exiger(`${T} : l'alignement ne bouge pas`, apres.toi.roster[S.sl.i] === b.player && JSON.stringify(photoAlignement(apres.toi.roster)) === JSON.stringify(S.depart.cases), '');
  const L = apres.L, toi = apres.toi, fin = S.b.at + S.b.games;
  let retour = null;
  while (!L.fini && toi.games < fin + 2) { jouerJournee(L); if (!toi.injured.has(b.player) && retour === null) retour = activeLineup(toi)[S.sl.i]; }
  exiger(`${T} : il revient, il rejoue sa case`, retour === b.player, retour ? retour.n : 'personne');
}

/* ---------- sur une vraie blessure d'avant ---------- */
const trouves = {};
for (const groupe of ['F', 'D']) {
  trouves[groupe] = trouver(groupe);
  exiger(`une blessure longue d'un ${groupe === 'D' ? 'défenseur' : 'attaquant'} habillé de ton club existe`, !!trouves[groupe], trouves[groupe] ? `${trouves[groupe].nom}, ${trouves[groupe].b.games} matchs, graine ${trouves[groupe].graine}` : 'aucune sur 80 graines');
}
for (const groupe of ['F', 'D']) {
  const S = trouves[groupe];
  if (!S) continue;
  remplacant(groupe, S);
}

/*
 * LE NOMBRE DE LA VRAIE LNH, ET LA ROBUSTESSE QUI BLESSE (Jalon P, B). JP : *robustesse cause blessures, pas douze
 * blessés en même temps, mais nombre normal versus la vraie vie*. Une ligue de vrais clubs (2018-19) : la LNH perd
 * de 180 à 220 matchs-hommes par club-saison, deux à deux et demi blessés à la fois. Puis, en PAIRES (les mêmes dés),
 * le même club contre l'adversaire le plus dur et le plus léger de sa saison : le dur blesse plus.
 */
{
  const sh = shard('2018-19.json');
  const tags = [...new Set(sh.players.map(p => p.t))];
  // Avec leur club-école (les autres joueurs du club-saison) : au-delà des réservistes, un vrai rappelé monte.
  const clubs = () => tags.map(tag => {
    const j = equipeReelle(sh.season, tag).flat().map(x => ({ ...x })), autres = sh.players.filter(p => p.t === tag).map(x => ({ ...x }));
    [...j, ...autres].forEach(registerHiddenRatings);
    const roster = autoRoster(j);
    return createTeam(tag, tag, roster, { season: sh.season, ecole: ecoleDe(autres, roster) });
  });
  const L = jouerJusqua(creerLigue(clubs(), 82, { graine: 'infirmerie' }), Infinity);
  let mgl = 0, pic = 0;
  for (const t of L.teams) {
    const parMatch = new Array(83).fill(0);
    for (const i of t.injuriesLog) for (let g = i.at; g < Math.min(83, i.at + i.games); g++) parMatch[g]++;
    mgl += parMatch.reduce((a, x) => a + x, 0); pic = Math.max(pic, ...parMatch);
  }
  const aLaFois = mgl / L.teams.length / 82;
  borne('une ligue de vrais clubs : les blessés à la fois, au nombre de la vraie LNH', aLaFois, 1.9, 2.8);
  borne('jamais une infirmerie pleine : le plus de blessés en même temps chez un club', pic, 0, INFIRMERIE_PLEINE + 5);
  const [X, ...autres] = clubs();
  const rob = t => teamStrength(t).rob;
  const tri = autres.sort((a, b) => rob(a) - rob(b)), leger = tri[0], dur = tri[tri.length - 1];
  const contre = adv => {
    let n = 0;
    for (let k = 0; k < 1500; k++) {
      X.injured.clear(); adv.injured.clear();
      for (const sl of SLOTS) for (const t of [X, adv]) { const p = t.roster[sl.i]; if (p) p.energie = 100; }
      const avant = X.injuriesLog.length;
      grainerHasard(`frappe:${k}`);
      playGame(X, adv, 1, false);
      n += X.injuriesLog.length - avant;
    }
    return n;
  };
  const nDur = contre(dur), nLeger = contre(leger);
  exiger('la robustesse blesse : le même club se blesse plus contre l\'adversaire le plus dur que contre le plus léger', nDur > nLeger,
    `${X.name} : ${nDur} blessures contre ${dur.name} (dur), ${nLeger} contre ${leger.name} (léger), 1 500 matchs chacun`);
}

verdict('Les blessures du moteur');
