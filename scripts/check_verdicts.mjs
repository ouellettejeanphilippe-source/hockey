/*
 * LE VERDICT DU LUNDI D'APRÈS (V19, tranche 6, la décision unifiée ; JP : *une seule lecture des choix*). Chaque choix à
 * effet daté que tu fais — un dossier, un fil — dit, le lundi d'après, ce que ton club
 * a fait depuis en vraies stats de match (js/verdicts.js : les tirs, la précision, les tirs contre, le % d'arrêts). Rien
 * d'inventé : sur une vraie ligue jouée, chaque verdict se recompte à la main dans les feuilles (les lancers de la feuille,
 * pas le même chemin que le code).
 *   1. un choix qui bouge le match dit son verdict UNE fois, le premier lundi où il compte assez de matchs derrière lui —
 *      jamais avant, jamais deux fois ;
 *   2. ses chiffres se recomptent : les matchs d'après (au plus sa durée) contre les dix d'avant, aucun match des deux côtés ;
 *   3. un choix qui ne bouge rien au match (« Rien ne change », des jetons, un plafond) ne dit rien ; une carte de commandite non plus ;
 *   4. la ligne ne dit que des stats de match, sous le plancher du bruit elle avoue « rien de net », jamais un mot de victoire ;
 *   5. il ne lit que le passé : les mêmes feuilles, plus celles qui suivent, rendent le même verdict ; un dé de pari se dit ;
 *   6. l'écran passe par là (js/saison.js) et la coquille hors ligne le liste.
 *
 * La banque d'événements est vide (V22, phase 4) : le système se teste sur une banque d'essai de deux entrées (un dossier,
 * un fil), posée ici dans les tables du jeu pour la durée du script, aux options qui couvrent chaque cas (un effet de match,
 * une action, un pari, un « rien », des jetons seuls).
 *
 *   node scripts/check_verdicts.mjs         (quelques secondes)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, pariDeDecision } from '../js/sim.js';
import { DOSSIERS } from '../js/dossiers.js';
import { CHOIX_DES_FILS } from '../js/vie-gm.js';
import { motsDeStats } from '../js/impact.js';
import { verdictsDeLaSemaine, MATCHS_MIN, AVANT_MIN, PLANCHER } from '../js/verdicts.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const GRAINE = 'verdicts-83';
const SEMAINE = 7;

/* Une petite ligue de huit vraies équipes de plusieurs époques, ton club en premier. */
const teams = [];
for (let i = 0; i < SAISONS.length && teams.length < 8; i += 6) {
  const sh = JSON.parse(fs.readFileSync(path.join(DIR, SAISONS[i]), 'utf8'));
  for (const tag of new Set(sh.players.map(p => p.t))) {
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    const ps = un.flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings);
    teams.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(ps), { season: sh.season }));
    break;
  }
}
const you = teams[0];
you.isPlayer = true;
const L = creerLigue(teams, 82, { graine: GRAINE, decisions: [], courbe: true });
jouerJusqua(L, Infinity);
const N = L.calendrier.length;
const miens = L.calendrier.flatMap((jour, j) => jour.filter(m => m.joue && (m.A === you || m.B === you)).map(m => ({ j, m })));
const lundis = Array.from({ length: Math.floor(N / SEMAINE) }, (_, w) => (w + 1) * SEMAINE).filter(j => j < N);
console.log('\n  LE VERDICT DU LUNDI D\'APRÈS (V19, tranche 6)\n');
informer('la ligue lue', `${teams.map(t => t.name).join(' · ')} — ${miens.length} matchs de ${you.name} sur ${N} jours`);

/* Les choix à lire : une banque d'essai, à des jours de la saison. */
DOSSIERS.essai = { titre: 'Un dossier d\'essai', options: [
  { cle: 'effet', nom: 'Plus de tirs', bon: 'Plus de tirs', prix: 'Plus de punitions', volume: 1.095, discipline: 1.213, duree: 10 },
  { cle: 'action', nom: 'Le vol nolisé', action: { energieTous: 10 }, gain: -15 },
  { cle: 'pari', nom: 'Le pari', pari: { chance: 3 / 6, gagne: { duree: 8, lui: { lancers: 1.45, finition: 1.3 } }, perd: { duree: 8, lui: { lancers: 0.6, finition: 0.75 } } } },
  { cle: 'rien', nom: 'Rien ne change', rien: true },
  { cle: 'jetons', nom: 'Des jetons seuls', gain: 10 },
] };
CHOIX_DES_FILS.essai = { titre: 'Un fil d\'essai', options: [{ cle: 'geste', nom: 'Un geste', action: { energieTous: 6 } }] };
const mom = (famille, cle, choix) => ({ famille, cle, choix });
const choix = [
  { id: 'dossier (un effet de match)', J: 28, moment: mom('dossier', 'essai', 'effet'), duree: 10, doit: true },
  { id: 'dossier (une action)', J: 47, moment: mom('dossier', 'essai', 'action'), duree: 8, doit: true },
  { id: 'fil (un geste)', J: 61, moment: mom('fil', 'essai', 'geste'), duree: 8, doit: true },
  { id: 'pari', J: 75, moment: mom('dossier', 'essai', 'pari'), duree: 8, doit: true },
  { id: 'rien ne change', J: 33, moment: mom('dossier', 'essai', 'rien'), duree: 8, doit: false },
  { id: 'des jetons seuls', J: 68, moment: mom('dossier', 'essai', 'jetons'), duree: 8, doit: false },
  { id: 'trop tard', J: N - 8, moment: mom('dossier', 'essai', 'effet'), duree: 8, doit: false },
].map((c, i) => ({ ...c, d: { jour: c.J, palier: `v:${i}`, sel: `verdict-${i}`, moment: { ...c.moment, joueur: null, joueurs: [] } } }));

/* Ce que dit le code, lundi après lundi, avec les seuls matchs déjà joués. */
const lire = (jour, tous = false) => verdictsDeLaSemaine({ decisions: choix.map(c => c.d), matchs: tous ? miens : miens.filter(x => x.j < jour), jour, depuisJ: jour - SEMAINE, you, graine: GRAINE });
const parLundi = new Map(lundis.map(M => [M, lire(M)]));
const dits = c => [...parLundi].flatMap(([M, vs]) => vs.filter(v => v.palier === c.d.palier).map(v => ({ M, v })));

/* 1. Une fois, le premier lundi où il compte assez de matchs. */
{
  const fautes = [], notes = [];
  for (const c of choix) {
    const vus = dits(c);
    const besoin = Math.min(MATCHS_MIN, c.duree);
    const premier = lundis.find(M => M > c.J && miens.filter(x => x.j >= c.J && x.j < M).length >= besoin);
    const attendu = c.doit && premier != null && miens.filter(x => x.j < c.J).length >= AVANT_MIN ? premier : null;
    if (attendu == null) { if (vus.length) fautes.push(`${c.id} : dit ${vus.length} fois, attendu aucune`); continue; }
    if (vus.length !== 1) fautes.push(`${c.id} : ${vus.length} verdicts (attendu 1, au lundi ${attendu})`);
    else if (vus[0].M !== attendu) fautes.push(`${c.id} : au lundi ${vus[0].M}, attendu ${attendu}`);
    else notes.push(`${c.id} (J${c.J}) → lundi ${attendu}`);
  }
  exiger('un choix qui bouge le match dit son verdict une fois, le premier lundi où il a assez de matchs derrière lui', !fautes.length && notes.length >= 4, fautes.join(' · ') || notes.join(' · '));
}

/* 2. Les chiffres se recomptent à la main, dans les lancers de chaque feuille. */
{
  const brut = x => {
    const cote = x.m.A === you ? 'A' : 'B', autre = cote === 'A' ? 'B' : 'A', f = x.m.feuille;
    const fus = f.fusillade ? f.fusillade.gagnant : null;
    return {
      tirsPour: f.lancers.filter(l => l.cote === cote).length, tirsContre: f.lancers.filter(l => l.cote === autre).length,
      butsPour: (cote === 'A' ? x.m.gfA : x.m.gfB) - (fus === cote ? 1 : 0), butsContre: (cote === 'A' ? x.m.gfB : x.m.gfA) - (fus === autre ? 1 : 0),
    };
  };
  const moy = xs => { const s = xs.map(brut); const m = k => s.reduce((a, y) => a + y[k], 0) / s.length; return { tirsPour: m('tirsPour'), tirsContre: m('tirsContre'), butsPour: m('butsPour'), butsContre: m('butsContre') }; };
  const fautes = [];
  let lus = 0, rien = 0, avecMots = 0;
  for (const c of choix) for (const { M, v } of dits(c)) {
    lus++;
    const apres = miens.filter(x => x.j >= c.J && x.j < M).slice(0, c.duree), avant = miens.filter(x => x.j < c.J).slice(-10);
    const a = moy(apres), b = moy(avant);
    const pa = a.butsPour / a.tirsPour, pb = b.butsPour / b.tirsPour, qa = 1 - a.butsContre / a.tirsContre, qb = 1 - b.butsContre / b.tirsContre;
    const d = { tirs: a.tirsPour - b.tirsPour, pctTir: pa - pb, contre: a.tirsContre - b.tirsContre, pctArr: qa - qb };
    const attendus = motsDeStats(d, 3).filter(m => Math.abs(d[m.cle]) >= PLANCHER[m.cle]);
    if (v.n !== apres.length || v.nAvant !== avant.length) fautes.push(`${c.id} : ${v.n} matchs d'après et ${v.nAvant} d'avant, recomptés ${apres.length} et ${avant.length}`);
    if (JSON.stringify(v.mots) !== JSON.stringify(attendus)) fautes.push(`${c.id} : « ${v.mots.map(m => m.txt).join(', ') || 'rien'} » contre les feuilles « ${attendus.map(m => m.txt).join(', ') || 'rien'} »`);
    if (!v.mots.length) rien++; else avecMots++;
    if (v.n < Math.min(MATCHS_MIN, c.duree) || v.nAvant < AVANT_MIN || v.nAvant > 10) fautes.push(`${c.id} : ${v.n} matchs d'après / ${v.nAvant} d'avant, hors de la règle`);
    informer(`${c.id}`, `lundi ${M} · ${v.n} matchs contre ${v.nAvant} : ${v.mots.map(m => m.txt).join(' · ') || 'rien de net'}`);
  }
  exiger(`chaque verdict se recompte dans les feuilles : les ${lus} lus (tirs, précision, tirs contre, % d'arrêts ; matchs d'après contre dix d'avant)`, !fautes.length && lus >= 4, fautes.join(' · ') || `${avecMots} disent des stats, ${rien} avouent « rien de net »`);
}

/* 3. Un choix sans effet de match ne dit rien (déjà jugé au point 1) ; ici les cas limites. */
{
  const rienVu = choix.filter(c => !c.doit).every(c => dits(c).length === 0);
  const sansMatch = lundis.filter(M => M > 80).length > 0;
  exiger('« Rien ne change », une option de jetons seuls et un choix de la fin de saison ne disent rien', rienVu && sansMatch, choix.filter(c => !c.doit).map(c => c.id).join(' · '));
}

/* 4. Que des stats de match. */
{
  const tous = [...parLundi.values()].flat();
  const mots = tous.flatMap(v => v.mots);
  const mauvais = mots.filter(m => !/(tir|précision|% d'arrêts)/.test(m.txt) || /victoire|défaite|note|but net|cote/i.test(m.txt));
  exiger('la ligne ne dit que des tirs, de la précision, des tirs contre, des arrêts : jamais une victoire ni une note', tous.length >= 4 && !mauvais.length && mots.every(m => typeof m.bon === 'boolean'), mauvais.map(m => m.txt).join(' · ') || `${tous.length} verdicts, ${mots.length} stats (ex. « ${(mots[0] || {}).txt} »)`);
}

/* 5. Il ne lit que le passé ; le dé d'un pari se dit. */
{
  const memes = lundis.every(M => JSON.stringify(lire(M)) === JSON.stringify(lire(M, true)) && JSON.stringify(lire(M)) === JSON.stringify(lire(M)));
  exiger('les mêmes feuilles, plus celles qui suivent, rendent le même verdict (il ne lit que le passé, et rien ne tire un dé)', memes, `${lundis.length} lundis`);
  const cp = choix.find(c => c.id === 'pari'), v = dits(cp)[0];
  const attendu = pariDeDecision(cp.d, GRAINE, you);
  exiger('le dé d\'un pari se dit, tel que le moteur l\'a tiré', !!v && !!attendu && v.v.de === (attendu.gagne ? 'gagné' : 'perdu') && choix.filter(c => c.id !== 'pari').every(c => dits(c).every(x => x.v.de === '')), v ? `« ${v.v.de} »` : 'aucun verdict');
}

/* 6. L'écran passe par là. */
{
  const saison = fs.readFileSync(path.join(ROOT, 'js', 'saison.js'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  exiger('l\'écran de la semaine lit js/verdicts.js, la coquille hors ligne le liste', /from '\.\/verdicts\.js'/.test(saison) && /verdictsDesChoix\(\{/.test(saison) && /js\/verdicts\.js/.test(sw), 'saison.js et sw.js');
}

verdict('Le verdict du lundi d\'après');
