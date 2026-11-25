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
 *   LES STATS      ce que chacun a fait chez toi (ses matchs, ses points, son +/−, ses minutes, ses mises en échec…) se
 *                  recompte des feuilles par le compte du moteur ; chaque but hors de l'avantage dit qui était sur la glace ;
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
import { getPersonKey, getPlayerKey, compterFeuilles } from '../js/sim.js';
import { groupeDuJoueur as groupeDe } from '../js/niveaux.js';
import { RUN, GALONS, STATS, STATS_G, CLUB, LIGUEUR, effectifDe, masseDe, medaillesDe, classement, matchPasse, dernierMatch } from '../js/run.js';
import { CAP } from '../js/sim.js';
import { jouerLaRun } from './lib/run_robot.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const GRAINE = Number(process.env.GRAINE ?? 7), ROBOT = process.env.ROBOT || 'malin';
const fautes = {};
const faute = (k, mot) => { (fautes[k] = fautes[k] || []).push(mot); };
const ok = k => !(fautes[k] || []).length;
const dit = k => (fautes[k] || []).slice(0, 3).join(' · ');

function jouer(relireA) {
  const vu = { repeches: 0, bancAuPremierTour: null, portes: 0, grosGagnes: 0, pochettes: {}, feuilles: 0, coeurs: RUN.COEURS, galons: 0, stats: {}, glace: [0, 0] };
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
      // Les stats de chacun, recomptées à côté : le compte du moteur sur chaque feuille, pour tes habillés et ton gardien.
      {
        const f = x.feuille, C = compterFeuilles([f]), plus = (p, v) => { const k = getPlayerKey(p), l = vu.stats[k] = vu.stats[k] || v.map(() => 0); v.forEach((n, i) => { l[i] += n; }); };
        for (const p of f.alignes[x.cote]) { const c = C.get(p); plus(p, [c.gp, c.g, c.a, c.sh, c.pm, c.pim, c.coups, c.blocs, c.toi, c.ppp, c.shp, c.gwg]); }
        const g = x.cote === 'A' ? f.gardienA : f.gardienB, cg = g && C.get(g);
        if (g) plus(g, [1, 0, 0, 0, 0, 0, cg.bl, cg.dq]);
        // Chaque but hors de l'avantage numérique dit qui était sur la glace : le +/− de la feuille.
        for (const b of f.buts) if (!b.an && !b.fusillade) { vu.glace[1]++; if ((b.pour || []).length) vu.glace[0]++; }
      }
      // La feuille de match gardée (JP, 25 nov. 2026 : *la feuille de match, partout*) : relue des archives, elle compte
      // de chacun ce que la feuille complète comptait, et dit les mêmes buts, les mêmes tirs, les mêmes arrêts.
      {
        const f = x.feuille, k = R.matchs.length - 1, M = matchPasse(S, k), dit = `match ${k + 1}`;
        if (!M) faute('archives', `${dit} : rien aux archives`);
        else {
          // Côté par côté : un joueur signé depuis chez le club affronté porte la même clé des deux bords.
          const C = compterFeuilles([f]), D = compterFeuilles([M.f]);
          for (const cote of ['A', 'B']) {
            const relus = new Map([...M.f.alignes[cote], cote === 'A' ? M.f.gardienA : M.f.gardienB].filter(Boolean).map(p => [getPlayerKey(p), p]));
            for (const p of [...f.alignes[cote], cote === 'A' ? f.gardienA : f.gardienB].filter(Boolean)) {
              const c = C.get(p), q = relus.get(getPlayerKey(p)), d = q && D.get(q);
              if (!d) { faute('archives', `${dit} : ${p.n} absent`); continue; }
              const autres = ['gp', 'g', 'a', 'pts', 'sh', 'pm', 'pim', 'coups', 'blocs', 'ppp', 'shp', 'gwg', 'w', 'l', 'sa', 'sv', 'ga', 'bl', 'dq'].filter(k2 => c[k2] !== d[k2]);
              if (autres.length || Math.abs(c.toi - d.toi) > 0.051) faute('archives', `${dit} : ${p.n} ${autres.join(',') || 'toi'}`);
            }
          }
          const buts = F => F.buts.map(b => [b.cote, b.instant, b.marqueur && getPlayerKey(b.marqueur), (b.passeurs || []).map(getPlayerKey), !!b.an, !!b.dn, !!b.fusillade]);
          if (JSON.stringify(buts(f)) !== JSON.stringify(buts(M.f))) faute('archives', `${dit} : les buts`);
          if (JSON.stringify([f.tirs, f.arrets.A, f.arrets.B, f.vainqueur, !!f.ot, f.gfA, f.gfB]) !== JSON.stringify([M.f.tirs, M.f.arrets.A, M.f.arrets.B, M.f.vainqueur, M.f.ot, M.f.gfA, M.f.gfB])) faute('archives', `${dit} : les tirs, les arrêts ou le pointage`);
          // « (12e) » : avant ce match, chaque pointeur du soir avait ce que le dernier match dit de lui.
          const avant = dernierMatch(S).avant, pointeurs = new Set(f.buts.flatMap(b => [b.marqueur, ...(b.passeurs || [])]).filter(Boolean));
          for (const p of pointeurs) { const a = avant.get(p), b = [...M.avant].find(([q]) => getPlayerKey(q) === getPlayerKey(p)); if (a && (!b || b[1].g !== a.g || b[1].a !== a.a)) faute('archives', `${dit} : avant, ${p.n}`); }
          if ((M.e.cote === 'A' ? M.A : M.B) !== S.toi || M.e.gf !== x.gf || M.e.ga !== x.ga) faute('archives', `${dit} : sa tête`);
          vu.archives = (vu.archives || 0) + 1;
        }
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
        const buts = Object.values(R.stats).filter(s => s.length === 12).reduce((a, s) => a + s[STATS.B], 0);
        if (buts !== F[0][3]) faute('fiche', `${buts} buts chez tes joueurs, ${F[0][3]} au classement`);
        // Ce que la ligue garde de chacun s'équilibre : un tir pour est un tir contre, un but en avantage est un but accordé en
        // désavantage, une occasion de l'un est celle de l'autre.
        const tot = k => F.reduce((a, f) => a + (f[k] || 0), 0), G = Object.values(R.ligue.gardiens || {}), totG = k => G.reduce((a, g) => a + g[k], 0);
        if (tot(CLUB.TP) !== tot(CLUB.TC) || tot(CLUB.BAN) !== tot(CLUB.BDN) || tot(CLUB.OAN) !== tot(CLUB.ODN) || !(tot(CLUB.TP) > 0 && tot(CLUB.OAN) > 0 && tot(CLUB.PUN) > 0)) faute('ligue', `les stats des clubs : ${tot(CLUB.TP)} tirs pour, ${tot(CLUB.TC)} contre ; ${tot(CLUB.BAN)} buts en avantage, ${tot(CLUB.BDN)} accordés`);
        // Chaque match a son gardien gagnant : ceux des autres clubs à la ligue, les tiens dans tes stats (une seule maison chacun).
        const miensG = effectifDe(S).filter(q => q.p === 'G').map(q => R.stats[getPlayerKey(q)] || []), totM = k => miensG.reduce((a, g) => a + (g[k] || 0), 0);
        if (totG(STATS_G.V) + totM(STATS_G.V) !== tot(CLUB.V) || totG(STATS_G.D) + totM(STATS_G.D) !== tot(CLUB.V) + tot(CLUB.P) + tot(CLUB.DP) || totG(STATS_G.BC) + totM(STATS_G.BC) !== tot(CLUB.BC)) faute('ligue', `les gardiens : ${totG(STATS_G.V) + totM(STATS_G.V)} victoires pour ${tot(CLUB.V)}, ${totG(STATS_G.D) + totM(STATS_G.D)} départs`);
        // Tes joueurs ne sont pas comptés une deuxième fois à la ligue : personne de ton effectif n'y a plus de matchs que son club n'en a joué.
        for (const [k, l] of Object.entries(R.ligue.pts)) if ((l[LIGUEUR.PJ] || 0) > RUN.LIGUE.MATCHS) faute('ligue', `${k} : ${l[LIGUEUR.PJ]} matchs à la ligue`);
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
      // Les stats de chacun se recomptent des feuilles : un patineur, ses douze chiffres ; un gardien, ses départs, ses blanchissages, ses départs de qualité.
      for (const [k, l] of Object.entries(vu.stats)) {
        const s = R.stats[k] || [];
        const ecart = l.length === 12 ? l.findIndex((n, i) => Math.abs(n - (s[i] || 0)) > (i === STATS.TG ? 0.6 : 0)) : [[0, STATS_G.D], [6, STATS_G.BL], [7, STATS_G.DQ]].findIndex(([i, j]) => l[i] !== (s[j] || 0));
        if (ecart >= 0) faute('stats', `${k} : ${JSON.stringify(l)} recompté, ${JSON.stringify(s)} gardé`);
      }
      if (vu.glace[0] !== vu.glace[1]) faute('stats', `${vu.glace[0]} buts sur ${vu.glace[1]} disent qui était sur la glace`);
      vu.fin = true;
    }
  } }).then(r => ({ r, vu }));
}
const t0 = Date.now();
const A = await jouer(null), B = await jouer(30);
const empreinte = ({ r }) => JSON.stringify([r.pts, r.rang, r.coeurs, r.fin, r.R.matchs, r.R.ligue && r.R.ligue.fiches, r.R.jetons, r.R.banc, r.R.joueurs.map(j => j.k), r.R.histoires]);

exiger('le repêchage : trois pièces avant le premier tour, vingt-trois tours', A.vu.bancAuPremierTour === 3 && A.vu.repeches === 23, `${A.vu.bancAuPremierTour} pièces, ${A.vu.repeches} tours`);
exiger('le repêchage tient ses cases et son plafond', ok('repechage'), dit('repechage') || 'vingt-trois joueurs, personne deux fois');
exiger('la ligue : trente et un clubs, 82 matchs chacun, en équilibre, ses stats aussi (les tirs, les unités spéciales, les gardiens, tes joueurs)', ok('ligue'), dit('ligue'));
exiger('rien n\'est joué d\'avance', ok('avance'), dit('avance') || `${A.vu.feuilles} feuilles lues`);
exiger('ta fiche et tes buts se recomptent de tes matchs et de tes joueurs', ok('fiche'), dit('fiche'));
exiger('les stats de chacun se recomptent des feuilles, et chaque but hors de l\'avantage dit qui était sur la glace', ok('stats'), dit('stats') || `${Object.keys(A.vu.stats).length} joueurs, ${A.vu.glace[1]} buts`);
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
{
  const R = A.r.R, n = R.matchs.length, poids = JSON.stringify(R.archives).length, tout = JSON.stringify(R).length;
  exiger('chaque match joué garde sa feuille de match, qui compte de chacun ce que la feuille complète comptait', ok('archives') && A.vu.archives === n && R.archives.length === n && R.archives.every(Boolean), dit('archives') || `${A.vu.archives} matchs relus des archives`);
  exiger('… en moins de 2,5 Ko par match, et du journal la sauvegarde ne garde que la feuille complète du dernier', poids / n < 2500 && R.journal.length === 1 && !!R.journal[0].F, `${Math.round(poids / n)} octets par match, ${Math.round(poids / 1024)} Ko pour ${n} matchs ; la sauvegarde entière : ${Math.round(tout / 1024)} Ko (${R.cles.length} joueurs dans la table)`);
  // Sauf la durée d'une blessure chez l'adversaire : le moteur la tire de ce qu'il se rappelle de ce joueur dans la séance (ses
  // commotions d'avant), que la sauvegarde ne garde pas pour les autres clubs ; elle ne change ni un match ni un classement.
  const sansDuree = r => JSON.stringify(r.R.archives.map(a => ({ ...a, b: { ...a.b, i: a.b.i.map(x => x.slice(0, 3)) } })));
  exiger('… et gardée puis relue au trentième match, la run a les mêmes archives', sansDuree(A.r) === sansDuree(B.r) && JSON.stringify(A.r.R.cles) === JSON.stringify(B.r.R.cles));
}
exiger('la même graine rejoue la même run, gardée et relue au trentième match ou non', empreinte(A) === empreinte(B), empreinte(A) === empreinte(B) ? `${A.r.pts} points, ${A.r.fin.cause}` : `${A.r.pts} points puis ${B.r.pts}`);
informer('la run', `${ROBOT}, graine ${GRAINE} : ${A.r.pts} points, ${A.r.rang}e, ${A.r.fin.cause}, ${A.r.fin.matchs} matchs, ${A.r.signatures} signatures ; ${Math.round((Date.now() - t0) / 1000)} s`);
verdict('La saison du Rogue tient ses règles');
