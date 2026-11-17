/*
 * LA SAISON DU ROGUE TIENT SES RÈGLES (V30, docs/refonte-v30-2.md § 3, § 9). Le robot bâtisseur (scripts/lib/run_robot.mjs)
 * joue une run entière par les fonctions du jeu (js/run.js), deux fois la même graine — la seconde gardée puis relue de sa
 * sauvegarde en pleine saison — et on lit ses runs contre les invariants :
 *
 *   LE REPÊCHAGE   trois pièces sur le banc avant le premier tour ; vingt-trois joueurs, personne deux fois, les cases du jeu
 *                  tenues (13 ou 14 avants, 7 ou 8 défenseurs, 2 ou 3 gardiens), la masse sous le plafond moins l'espace gardé ;
 *   LA LIGUE       trente et un clubs, un par franchise ; rien n'est joué d'avance (avant ton match, aucun jour à venir n'est
 *                  joué) ; à la fin, 82 matchs par club, autant de victoires que de défaites, autant de buts pour que contre ;
 *                  ta fiche se recompte de tes matchs, tes buts de ceux de tes joueurs ;
 *   LE QUART       quatre quarts de 21, 20, 21 et 20 matchs ; trois objectifs, recomptés des matchs joués ; deux manqués coûtent
 *                  un cœur, sauf au dernier quart pour un club des seize ; jamais sous zéro cœur ;
 *   LES GROS       au plus trois affiches posées par quart ; un gros match gagné ouvre trois portes dont le club battu ;
 *                  la caisse jamais sous zéro, le plafond jamais dépassé, une pochette de chaque sorte au plus par quart ;
 *   LE GARDIEN     après chaque match, le filet revient au partant (le jeu ne choisit pas à ta place, il n'oublie pas non plus) ;
 *   LES SÉRIES     les seize premiers, huit séries puis quatre, deux, une ; quatre victoires pour passer ; une série perdue finit
 *                  la run ; hors des seize, pas de séries ;
 *   LA FIN         les médailles recomptées (les quarts, les rondes, la caisse à dix jetons pour une) ;
 *   LA GRAINE      la même graine rejoue la même run, gardée et relue ou non, quelle que soit celle jouée avant elle.
 *
 *   node scripts/check_run.mjs            (une vingtaine de secondes, dans `tout.mjs` ; `GRAINE`, 7 ; `ROBOT`, malin)
 */
import { getPersonKey } from '../js/sim.js';
import { groupeDuJoueur as groupeDe } from '../js/niveaux.js';
import { RUN, GALONS, effectifDe, masseDe, medaillesDe, classement } from '../js/run.js';
import { CAP } from '../js/sim.js';
import { jouerLaRun } from './lib/run_robot.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const GRAINE = Number(process.env.GRAINE ?? 7), ROBOT = process.env.ROBOT || 'malin';
const fautes = {};
const faute = (k, mot) => { (fautes[k] = fautes[k] || []).push(mot); };
const ok = k => !(fautes[k] || []).length;
const dit = k => (fautes[k] || []).slice(0, 3).join(' · ');

function jouer(relireA) {
  const vu = { repeches: 0, bancAuPremierTour: null, portes: 0, grosGagnes: 0, pochettes: {}, feuilles: 0, coeurs: RUN.COEURS, galons: 0 };
  return jouerLaRun(ROBOT, GRAINE, { relireA, espion: (m, S, x) => {
    const R = S.R;
    if (m === 'repeche') {
      if (vu.repeches === 0) vu.bancAuPremierTour = R.banc.length;
      vu.repeches++;
      if (masseDe(S) > CAP - RUN.ESPACE) faute('repechage', `masse ${masseDe(S)} au tour ${vu.repeches}`);
    } else if (m === 'quart' && R.quart.n === 0) {
      const js = effectifDe(S), n = { F: 0, D: 0, G: 0 };
      for (const p of js) n[groupeDe(p)]++;
      if (js.length !== 23 || new Set(js.map(getPersonKey)).size !== 23) faute('repechage', `${js.length} joueurs`);
      if (n.F < 13 || n.F > 14 || n.D < 7 || n.D > 8 || n.G < 2 || n.G > 3) faute('repechage', `composition ${n.F}-${n.D}-${n.G}`);
      if (R.ligue.clubs.length !== RUN.LIGUE.CLUBS || new Set(R.ligue.clubs.map(c => c.t)).size !== RUN.LIGUE.CLUBS) faute('ligue', 'les clubs de la ligue');
    } else if (m === 'feuille') {
      vu.feuilles++;
      // Rien n'est joué d'avance : la ligue en est au plus au jour de ton match.
      if (!R.series && R.ligue.jour > R.soir.jour) faute('avance', `la ligue au jour ${R.ligue.jour} avant ton match du jour ${R.soir.jour}`);
    } else if (m === 'match') {
      // Les galons du soir : ceux d'un match, dans un gros match seulement, chacun à son seuil ; ceux de la saison, à leur seuil.
      for (const g of R.apres.galons || []) {
        const SEUIL = { chapeau: GALONS.CHAPEAU, grandMatch: GALONS.GRAND_SOIR, mur: GALONS.MUR, cinquanteButs: GALONS.BUTS, centPoints: GALONS.POINTS }[g.type];
        if (['chapeau', 'grandMatch', 'jeuBlanc', 'mur'].includes(g.type) && !x.duel) faute('galons', `${g.type} gravé un soir ordinaire (match ${R.matchs.length})`);
        if (SEUIL != null && !(g.extra >= SEUIL)) faute('galons', `${g.type} sous son seuil (${g.extra})`);
        vu.galons++;
      }
      if (S.toi._filetMatch !== 'partant') faute('filet', `match ${R.matchs.length}`);
      if (R.jetons < 0) faute('caisse', `${R.jetons} jetons au match ${R.matchs.length}`);
      if (masseDe(S) > R.plafond) faute('plafond', `match ${R.matchs.length}`);
      if (x.duel && x.gagne && !R.series) { vu.grosGagnes++; if (!R.suite.includes('portes')) faute('portes', `gros match gagné sans portes (match ${R.matchs.length})`); }
      if (!R.series && R.suite.includes('portes') && R.portes.affronte !== `${R.apres.s}:${R.apres.t}`) faute('portes', 'le club battu n\'est pas une des portes');
    } else if (m === 'portes') {
      if (!R.portes.pochette) { vu.portes++; if (R.portes.clubs.length !== RUN.PORTES) faute('portes', `${R.portes.clubs.length} portes`); }
      if (masseDe(S) > R.plafond) faute('plafond', 'aux portes');
    } else if (m === 'pochette') {
      const k = `${R.quart.n}:${x}`;
      vu.pochettes[k] = (vu.pochettes[k] || 0) + 1;
      if (vu.pochettes[k] > 1) faute('pochettes', k);
    } else if (m === 'bilan') {
      const Q = R.quart, ms = R.matchs.slice(Q.debut, Q.fin), pts = ms.reduce((a, y) => a + (y.gagne ? 2 : y.ot ? 1 : 0), 0);
      const rival = ms.find(y => y.sorte === 'rival'), affiches = ms.filter(y => y.sorte === 'affiche');
      if (ms.length !== RUN.QUARTS[Q.n] || R.matchs.length !== Q.fin) faute('quart', `quart ${Q.n + 1} : ${ms.length} matchs`);
      if (affiches.length > RUN.AFFICHES) faute('affiches', `${affiches.length} au quart ${Q.n + 1}`);
      if (!rival || ms.filter(y => y.sorte === 'rival').length !== 1) faute('quart', `quart ${Q.n + 1} : le rival`);
      const valeurs = { points: pts, rival: rival && rival.gagne ? 1 : 0, place: x.rang, gros: ms.filter(y => (y.sorte === 'affiche' || y.enjeu) && y.gagne).length };
      for (const o of x.objectifs) {
        if (o.sorte in valeurs && o.valeur !== valeurs[o.sorte]) faute('objectifs', `quart ${Q.n + 1}, ${o.sorte} : ${o.valeur} au bilan, ${valeurs[o.sorte]} recompté`);
        if (o.tenu !== (o.sorte === 'place' ? o.valeur <= o.cible : o.valeur >= o.cible)) faute('objectifs', `quart ${Q.n + 1}, ${o.sorte} : tenu mal jugé`);
      }
      const tenus = x.objectifs.filter(o => o.tenu).length, qualifie = Q.n === 3 && x.rang <= RUN.LIGUE.PLACES;
      if (x.objectifs.length !== 3 || x.tenus !== tenus || x.tenu !== (tenus >= 2 || qualifie)) faute('objectifs', `quart ${Q.n + 1} : le bilan`);
      if (vu.coeurs - R.coeurs !== (x.tenu ? 0 : 1) || R.coeurs < 0) faute('coeurs', `quart ${Q.n + 1} : ${vu.coeurs} → ${R.coeurs}`);
      vu.coeurs = R.coeurs;
      if (Q.n === 3) {
        // La saison finie : 82 matchs par club, la ligue en équilibre, ta fiche et tes buts recomptés.
        const F = R.ligue.fiches, saison = R.matchs.slice(0, RUN.LIGUE.MATCHS);
        if (F.some(f => f[0] + f[1] + f[2] !== RUN.LIGUE.MATCHS)) faute('ligue', 'un club n\'a pas joué 82 matchs');
        if (F.reduce((a, f) => a + f[0], 0) !== F.reduce((a, f) => a + f[1] + f[2], 0)) faute('ligue', 'les victoires et les défaites');
        if (F.reduce((a, f) => a + f[3], 0) !== F.reduce((a, f) => a + f[4], 0)) faute('ligue', 'les buts pour et contre');
        const v = saison.filter(y => y.gagne).length, dp = saison.filter(y => !y.gagne && y.ot).length;
        if (F[0][0] !== v || F[0][2] !== dp || F[0][1] !== RUN.LIGUE.MATCHS - v - dp) faute('fiche', `${F[0].slice(0, 3).join('-')} au classement, ${v}-${RUN.LIGUE.MATCHS - v - dp}-${dp} recompté`);
        const buts = Object.values(R.stats).filter(s => s.length === 4).reduce((a, s) => a + s[1], 0);
        if (buts !== F[0][3]) faute('fiche', `${buts} buts chez tes joueurs, ${F[0][3]} au classement`);
        vu.rangFinal = classement(S).indexOf(0) + 1;
      }
    } else if (m === 'fin') {
      const X = R.series, F = R.fin;
      if (X) {
        if (X.tetes.length !== 16 || !X.tetes.includes(0)) faute('series', 'les seize');
        X.rondes.forEach((r, k) => { if (r.length !== 8 >> k) faute('series', `ronde ${k + 1} : ${r.length} séries`); });
        if (X.faites.some(f => f.w !== RUN.SERIE) || F.rondes !== X.faites.length || F.coupe !== (X.faites.length === 4)) faute('series', 'les rondes gagnées');
        if (!F.coupe && F.cause !== 'serie') faute('series', `fin ${F.cause} en séries`);
        if (vu.rangFinal > RUN.LIGUE.PLACES) faute('series', `${vu.rangFinal}e en séries`);
      } else if (F.cause === 'saison' && vu.rangFinal <= RUN.LIGUE.PLACES) faute('series', 'un club des seize sans séries');
      if (F.cause === 'congedie' && R.coeurs !== 0) faute('coeurs', 'congédié avec un cœur');
      if (F.medailles !== medaillesDe(R, F.rondes, F.coupe) || F.caisse !== Math.floor(Math.max(0, R.jetons) / RUN.JETONS_PAR_MEDAILLE)) faute('medailles', `${F.medailles}`);
      if (new Set(R.vus).size !== R.vus.length) faute('vus', 'une personne deux fois dans la run');
      if ((R.galons || []).filter(g => g.type !== 'coupe').length !== vu.galons) faute('galons', `${(R.galons || []).length} galons gardés pour ${vu.galons} vus aux matchs`);
      vu.fin = true;
    }
  } }).then(r => ({ r, vu }));
}
const t0 = Date.now();
const A = await jouer(null), B = await jouer(30);
const empreinte = ({ r }) => JSON.stringify([r.pts, r.rang, r.coeurs, r.fin, r.R.matchs, r.R.ligue && r.R.ligue.fiches, r.R.jetons, r.R.banc, r.R.joueurs.map(j => j.k), r.R.histoires]);

exiger('le repêchage : trois pièces avant le premier tour, vingt-trois tours', A.vu.bancAuPremierTour === 3 && A.vu.repeches === 23, `${A.vu.bancAuPremierTour} pièces, ${A.vu.repeches} tours`);
exiger('le repêchage tient ses cases et son plafond', ok('repechage'), dit('repechage') || 'vingt-trois joueurs, personne deux fois');
exiger('la ligue : trente et un clubs, 82 matchs chacun, en équilibre', ok('ligue'), dit('ligue'));
exiger('rien n\'est joué d\'avance', ok('avance'), dit('avance') || `${A.vu.feuilles} feuilles lues`);
exiger('ta fiche et tes buts se recomptent de tes matchs et de tes joueurs', ok('fiche'), dit('fiche'));
exiger('quatre quarts, un rival chacun', ok('quart'), dit('quart'));
exiger('les trois objectifs se recomptent des matchs joués', ok('objectifs'), dit('objectifs') || `${A.r.quarts.length} bilans`);
exiger('deux objectifs manqués coûtent un cœur, jamais sous zéro', ok('coeurs'), dit('coeurs'));
exiger('au plus trois affiches posées par quart', ok('affiches'), dit('affiches'));
exiger('un gros match gagné ouvre trois portes, dont le club battu', ok('portes') && A.vu.portes === A.vu.grosGagnes, dit('portes') || `${A.vu.grosGagnes} gros matchs gagnés, ${A.vu.portes} fois trois portes`);
exiger('la caisse jamais sous zéro, le plafond jamais dépassé', ok('caisse') && ok('plafond'), dit('caisse') || dit('plafond'));
exiger('une pochette de chaque sorte au plus par quart', ok('pochettes'), dit('pochettes') || `${A.r.pochettes} pochettes`);
exiger('après chaque match, le filet revient au partant', ok('filet'), dit('filet'));
exiger('les séries sont les vraies : seize clubs, quatre victoires, une série perdue finit la run', ok('series'), dit('series') || (A.r.R.series ? `${A.r.rondes} ronde(s) gagnée(s)` : `pas de séries (${A.r.fin.cause})`));
exiger('les médailles et les galons se recomptent ; personne deux fois dans la run', ok('medailles') && ok('galons') && ok('vus') && A.vu.fin, dit('medailles') || dit('galons') || dit('vus') || `${A.r.fin.medailles} médailles`);
exiger('la même graine rejoue la même run, gardée et relue au trentième match ou non', empreinte(A) === empreinte(B), empreinte(A) === empreinte(B) ? `${A.r.pts} points, ${A.r.fin.cause}` : `${A.r.pts} points puis ${B.r.pts}`);
informer('la run', `${ROBOT}, graine ${GRAINE} : ${A.r.pts} points, ${A.r.rang}e, ${A.r.fin.cause}, ${A.r.fin.matchs} matchs, ${A.r.signatures} signatures ; ${Math.round((Date.now() - t0) / 1000)} s`);
verdict('La saison du Rogue tient ses règles');
