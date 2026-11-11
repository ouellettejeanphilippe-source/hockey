/*
 * LES INVARIANTS DE LA RUN EN CARTE (V28, docs/refonte-v28.md § 10 « La run »). Des robots (scripts/lib/run_robot.mjs) jouent
 * des runs entières par les fonctions du jeu (js/run.js), et chaque moment se lit contre les règles :
 *
 *   trois actes de cinq matchs et un rival, deux arrêts par acte ; la cible et les cœurs recomptés ; un rival par acte, au
 *   sommet ; trois portes après chaque match, l'une le club affronté, jamais deux fois la même ; aucun joueur deux fois ; le
 *   plafond jamais dépassé ; la même graine rejoue la même run ; une run gardée puis relue finit pareil, et lit la même
 *   histoire à sa case (les blessures datées en matchs de la run, chaque joueur relu de son côté de la feuille).
 *
 *   node scripts/check_run.mjs            `GRAINES` graines (3), les trois robots : une dizaine de secondes
 */
import { getPersonKey } from '../js/sim.js';
import { RUN, masseDe, RANG_DU_RIVAL, figer, ouvrirSeance, histoireDeLaCase, reglesDe } from '../js/run.js';
import { jouerLaRun, DONNEES } from './lib/run_robot.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const GRAINES = Number(process.env.GRAINES ?? 3);
const fautes = [];
const faute = (ok, mot) => { if (!ok && fautes.length < 12) fautes.push(mot); };
const runs = [];
const histoires = { lues: 0, vraies: 0, autres: [] };
const dite = h => (h ? `${h.cle} · ${h.joueur.n}` : 'aucune');
for (const robot of ['premier', 'chiffre', 'malin']) {
  for (let g = 0; g < GRAINES; g++) {
    const ici = `${robot} ${g}`;
    const espion = (m, S) => {
      const R = S.R;
      if (m === 'portes') {
        const cles = R.portes.clubs.map(c => `${c.s}:${c.t}`);
        if (!R.portes.pochette) faute(cles.length === RUN.PORTES && new Set(cles).size === RUN.PORTES, `${ici} : ${cles.length} portes, ${new Set(cles).size} différentes`);
        if (R.apres && R.portes.tour === 0 && !R.portes.pochette) faute(cles[0] === `${R.apres.s}:${R.apres.t}`, `${ici} : la première porte n'est pas le club affronté`);
      }
      // Une case d'histoire : la séance gardée puis relue lit la même histoire, sur le même joueur.
      if (m === 'case' && R.phase === 'histoire') {
        const vive = dite(histoireDeLaCase(S)), relue = dite(histoireDeLaCase(ouvrirSeance(DONNEES, JSON.parse(JSON.stringify(figer(S))))));
        histoires.lues++;
        if (vive !== 'aucune') histoires.vraies++;
        if (vive !== relue && histoires.autres.length < 4) histoires.autres.push(`${ici} : ${vive}, relue ${relue}`);
      }
      if (m === 'signe' || m === 'fin') {
        faute(masseDe(S) <= R.plafond, `${ici} : la masse passe le plafond (${Math.round(masseDe(S) / 1e5) / 10} sur ${R.plafond / 1e6})`);
        faute(new Set(R.vus).size === R.vus.length, `${ici} : un joueur est passé deux fois`);
        const personnes = Object.values(S.roster).filter(Boolean).map(getPersonKey);
        faute(personnes.length === 23 && new Set(personnes).size === 23, `${ici} : ${personnes.length} joueurs, ${new Set(personnes).size} personnes`);
      }
    };
    const r = jouerLaRun(robot, g, { espion });
    runs.push(r);
    const R = r.R;
    // Les actes : cinq matchs (ou élites) et un rival chacun, la cible recomptée, deux arrêts sur le chemin.
    R.actes.forEach((x, a) => {
      const ms = R.matchs.filter(m => m.acte === a && m.sorte !== 'serie'), rival = ms.filter(m => m.sorte === 'rival');
      faute(ms.length === RUN.MATCHS + 1 && rival.length === 1 && ms.at(-1).sorte === 'rival', `${ici}, acte ${a + 1} : ${ms.length} matchs, ${rival.length} rival`);
      const pts = ms.reduce((t, m) => t + (m.gagne ? 2 : m.ot ? 1 : 0) * (m.sorte === 'rival' ? 2 : 1), 0);
      faute(pts === x.pts && x.tenu === (pts >= reglesDe(R).cibles[a]), `${ici}, acte ${a + 1} : ${x.pts} points notés, ${pts} recomptés`);
      faute(ms.filter(m => m.sorte === 'elite').length <= 1 && (a > 0 || !ms.some(m => m.sorte === 'elite')), `${ici}, acte ${a + 1} : trop d'élites`);
    });
    // Les cœurs, recomptés des matchs seuls : une cible manquée aux actes I et II, et chaque série perdue puis rejouée (une
    // série perdue se rachète une fois par cœur ; la dernière perdue, si la run finit là, n'en coûte pas).
    faute(new Set(R.actes.map(x => `${x.s}:${x.t}`)).size === R.actes.length, `${ici} : le même rival à deux actes`);
    const rates = R.actes.filter((x, a) => !x.tenu && a < 2).length;
    let perdues = 0, w = 0, l = 0;
    for (const m of R.matchs.filter(m => m.sorte === 'serie')) { if (m.gagne) w++; else l++; if (w === 3 || l === 3) { if (l === 3) perdues++; w = 0; l = 0; } }
    const rejouees = perdues - (R.fin && R.fin.cause === 'serie' ? 1 : 0);
    faute(R.coeurs === RUN.COEURS - rates - rejouees, `${ici} : ${R.coeurs} cœurs, ${RUN.COEURS - rates - rejouees} recomptés`);
    faute(['coeurs', 'cible', 'serie', 'coupe'].includes(R.fin && R.fin.cause), `${ici} : une fin sans cause`);
    faute(R.fin.cause !== 'coupe' || (R.series && R.series.faites.length === 3), `${ici} : une Coupe sans trois rondes`);
    faute(R.fin.cause !== 'coeurs' || R.coeurs === 0, `${ici} : finie sans cœur, avec ${R.coeurs}`);
    faute(R.banc.length <= 5 && new Set(R.banc).size === R.banc.length, `${ici} : un banc de ${R.banc.length}`);
    faute(R.jetons >= 0, `${ici} : ${R.jetons} jetons`);
  }
}
exiger('chaque run tient ses règles : les actes, la cible, les cœurs, les portes, le plafond, personne deux fois', !fautes.length, fautes.join(' · ') || `${runs.length} runs lues`);
exiger('le sommet de la carte est le rival', RANG_DU_RIVAL === 7);
exiger('une histoire relue d\'une run gardée est la même', histoires.lues > 0 && !histoires.autres.length, histoires.autres.join(' · ') || `${histoires.lues} cases d'histoire, ${histoires.vraies} avec un fait vrai`);
exiger('les cases d\'histoire ont une histoire à dire', histoires.vraies >= histoires.lues / 2, `${histoires.vraies} sur ${histoires.lues}`);

// La même graine rejoue la même run ; gardée puis relue en chemin, elle finit pareil.
const sans = r => JSON.stringify({ ...r.R, filet: undefined });
const a = jouerLaRun('malin', 1), b = jouerLaRun('malin', 1), c = jouerLaRun('malin', 1, { relireA: 7 });
exiger('la même graine rejoue la même run', sans(a) === sans(b));
exiger('une run gardée puis relue finit pareil', sans(a) === sans(c), `${a.R.matchs.length} matchs contre ${c.R.matchs.length}, ${a.R.fin.cause} contre ${c.R.fin.cause}`);
informer('les runs', runs.map(r => `${r.robot} ${r.graine} : ${r.fin.cause}, ${r.R.matchs.length} matchs`).join(' · '));
verdict('La run en carte');
