/*
 * LES ÉLITES (V27, tranche 7 ; docs/refonte-v27.md § 4.5, § 10 ; docs/refonte-v27-7.md — js/actes.js). JP, 8 nov. 2026 :
 * « Élite = risque plus clair » : aucune élite à l'acte I, et l'écran montre ta vraie chance, celle qui fixe la récompense.
 * Ce juge en prouve deux choses :
 *
 *   1. LES RÈGLES, sur une vraie ligue en actes, sans jouer un match (quelques secondes, dans tout.mjs) :
 *      a. la récompense : `J = arrondi(VALEUR_DU_RISQUE × (1 − p) / p) − PRIX_PIECE`, bornée à [10, 90], `p` borné à [0,25, 0,55]
 *         (les exemples du § 4.5 : 38 % → 90 🪙, le plafond ; 52 % → 51 🪙) ; tant qu'elle n'est pas au plafond, `p × (J + PRIX_PIECE)`
 *         vaut `(1 − p) × VALEUR_DU_RISQUE` à l'arrondi près : le risque est payé ;
 *      b. la proposition (`eliteDeLaSemaine`) : seulement un lundi, pour un match de cette semaine-là après le lundi,
 *         contre un club du top 8 en force au premier soir ; jamais à l'acte I, jamais la semaine d'un rival, jamais en
 *         séries ; prise (la décision `elite`, jouée par le crochet du Rogue), l'acte n'en propose plus, l'acte suivant oui ;
 *         son annonce porte la raison du duel, l'acte, `J` et une intention dominante, comme un rival ;
 *      c. le compte : une élite perdue ne coûte aucun cœur (JP, 9 nov. 2026 : *Sonnés + jetons, pas de cœur*), mais la moitié de
 *         sa récompense en jetons (`perteDeLElite`) et des sonnés plus longs (`SONNES_ELITE`) ; gagnée, elle paie ses `J` jetons
 *         (`jetonsDesElites`) ; deux élites perdues ne tuent pas la run ;
 *      d. les pièces « pour le battre » : une par ligne du jeu (tirs, durs, gardien), chacune son moment (`MOMENTS_SI`) ;
 *         chaque club porte les lignes où il est au 12e rang ou mieux (`sonJeu`), douze clubs par ligne dans une ligue de 32.
 *   2. LES ÉLITES EN PAIRES (§ 10), sur les runs de la profondeur (`LIRE=dossier`, les artefacts de profondeur.yml) : le
 *      robot qui les prend (l'attentif, qui lit le pronostic, le réglage R1) contre celui qui les refuse (le prudent), les
 *      mêmes dés : il gagne au moins autant de Coupes sur 64 et ne meurt pas plus d'une fois sur huit de plus. Le glouton
 *      (chaque élite, même au dernier cœur) se lit à côté. Sur moins de 64 graines, les bornes s'impriment sans se juger.
 *
 *   node scripts/check_elites.mjs              les règles (tout.mjs)
 *   LIRE=runs node scripts/check_elites.mjs    plus les paires, sur les runs gardées (la CI, le travail « juger »)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, MOMENTS_SI, SONNE, SONNES_ELITE } from '../js/sim.js';
import { crochetDesActes, joursDe, acteDe, eliteDeLaSemaine, decisionDElite, recompenseDeLElite, elitesDe, etatDeLaRun, jetonsDesElites,
  lignesFortes, parmiLesAdversaires, TOP_DES_ELITES, ELITES_PAR_ACTE, VALEUR_DU_RISQUE, PART_PERDUE, perteDeLElite, PRIX_PIECE, COEURS } from '../js/actes.js';
import { PIECES, piecesContre } from '../js/pieces.js';
import { INTENTIONS } from '../js/greffes.js';
import { SEMAINE } from '../js/inventaire.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

console.log('\n  Les élites (V27, tranche 7)\n');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const v1 = x => x.toFixed(1).replace('.', ',');

/* ---------- 1a. la récompense ---------- */
{
  const ps = Array.from({ length: 91 }, (_, i) => 0.05 + i / 100);
  const J = ps.map(recompenseDeLElite);
  const paye = ps.filter(p => p >= 0.25 && p <= 0.55).every(p => { const j = recompenseDeLElite(p); return j >= 90 || Math.abs(p * (j + PRIX_PIECE) - (1 - p) * VALEUR_DU_RISQUE) <= p; });
  exiger(`la récompense : ${VALEUR_DU_RISQUE} × (1 − p) / p − ${PRIX_PIECE}, bornée à [10, 90], p borné à [0,25, 0,55] (38 % → 90 🪙, le plafond ; 52 % → 51 🪙)`,
    recompenseDeLElite(0.38) === 90 && recompenseDeLElite(0.52) === 51 && J.every(j => j >= 10 && j <= 90) && recompenseDeLElite(0.1) === recompenseDeLElite(0.25) && recompenseDeLElite(0.9) === recompenseDeLElite(0.55) && paye,
    `25 % → ${recompenseDeLElite(0.25)} · 38 % → ${recompenseDeLElite(0.38)} · 45 % → ${recompenseDeLElite(0.45)} · 52 % → ${recompenseDeLElite(0.52)} · 55 % → ${recompenseDeLElite(0.55)}`);
}

/* Une vraie ligue de 32 clubs, tirés des saisons du dépôt ; la première est la tienne. */
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
function ligue(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const sh = JSON.parse(fs.readFileSync(path.join(DIR, SAISONS[Math.floor(rnd() * SAISONS.length)]), 'utf8'));
    const tags = [...new Set(sh.players.map(p => p.t))], tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    const ps = un.flat().map(p => ({ ...p }));
    ps.forEach(registerHiddenRatings);
    out.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(ps), { season: sh.season, isPlayer: !out.length }));
  }
  return out;
}

/* ---------- 1b. la proposition ---------- */
const teams = ligue(71), toi = teams[0];
const L = creerLigue(teams, 82, { graine: 'elites', courbe: true, placer: crochetDesActes() });
const n = L.teams.length, jours = joursDe(L.calendrier, toi), top = new Set(L.parForce.slice(0, parmiLesAdversaires(TOP_DES_ELITES, n)));
const semainesRivaux = new Set(L.rivaux.map(R => Math.floor(R.jour / SEMAINE)));
const advAu = j => { const m = L.calendrier[j].find(x => x.A === toi || x.B === toi); return m.A === toi ? m.B : m.A; };
const lundis = Array.from({ length: Math.ceil(L.calendrier.length / SEMAINE) + 4 }, (_, w) => w * SEMAINE);
const propositions = lundis.map(j => ({ j, e: eliteDeLaSemaine(L, j) })).filter(x => x.e);
{
  const fautes = propositions.filter(({ j, e }) => !(e.jour > j && e.jour < j + SEMAINE) || !top.has(e.adv) || advAu(e.jour) !== e.adv || e.acte < 1 || e.acte > 2 || jours[e.k] !== e.jour
    || acteDe(e.k) !== e.acte || semainesRivaux.has(j / SEMAINE) || e.k >= 82 || e.rang !== L.parForce.indexOf(e.adv));
  const horsLundi = [1, 2, 3, 4, 5, 6].map(d => SEMAINE * 6 + d).filter(j => eliteDeLaSemaine(L, j)).length;
  exiger('une élite se propose le lundi, pour un match de la semaine contre un club du top 8 en force, aux actes II et III seulement, jamais la semaine d\'un rival ni en séries',
    propositions.length > 0 && !fautes.length && !horsLundi && [1, 2].every(a => propositions.some(x => x.e.acte === a)),
    `${propositions.length} lundis sur ${lundis.length} · acte II : ${propositions.filter(x => x.e.acte === 1).length}, acte III : ${propositions.filter(x => x.e.acte === 2).length}${fautes.length ? ` · fautes : ${fautes.map(x => x.j).join(', ')}` : ''}`);
  const prise = propositions.find(x => x.e.acte === 1);
  const d = { jour: prise.j, ...decisionDElite({ jour: prise.e.jour, J: 42 }) };
  L.placer(L, d);
  const A = L.grosAnnonces[prise.e.jour];
  exiger('prise, l\'élite est annoncée comme un duel : sa raison, son acte, ses jetons, une intention dominante', A && A.raison === 'elite' && A.acte === 1 && A.J === 42 && A.adv === prise.e.adv && !!INTENTIONS[A.dominante] && d.palier === `el:${prise.e.jour}`,
    A ? `${A.adv.tag}, ${A.raison}, acte ${A.acte + 1}, ${A.J} 🪙, ${A.dominante}` : 'aucune annonce');
  const apres = lundis.map(j => eliteDeLaSemaine(L, j)).filter(Boolean);
  exiger(`au plus ${ELITES_PAR_ACTE} élite par acte : prise à l'acte II, il n'en propose plus ; l'acte III, oui`, !apres.some(e => e.acte === 1) && apres.some(e => e.acte === 2) && elitesDe(L.grosAnnonces).length === 1,
    `après : ${apres.length} lundis (acte III)`);

  /* ---------- 1c. le compte ---------- */
  const m = L.calendrier[A.jour].find(x => x.A === toi || x.B === toi), chez = m.A === toi;
  const jouer = gagne => { Object.assign(m, chez === gagne ? { gfA: 4, gfB: 1 } : { gfA: 1, gfB: 4 }, { joue: true }); };
  const etat = jour => etatDeLaRun({ calendrier: L.calendrier, teams: L.teams, you: toi, annonces: L.grosAnnonces, jour });
  jouer(false);
  jouer(false);
  const perdue = etat(A.jour + 1), avant = etat(A.jour), coutePerdue = jetonsDesElites(L.calendrier, toi, L.grosAnnonces, A.jour + 1);
  jouer(true);
  const gagnee = etat(A.jour + 1);
  // JP, 9 nov. 2026 : *Sonnés + jetons, pas de cœur*.
  exiger(`une élite perdue ne coûte aucun cœur, mais la moitié de sa récompense (${PART_PERDUE}) ; gagnée, elle paie ses jetons`, avant.coeurs === COEURS && perdue.coeurs === COEURS && perdue.elites[0].gagne === false && gagnee.coeurs === COEURS && gagnee.elites[0].gagne
    && coutePerdue === -perteDeLElite(42) && perteDeLElite(42) === 21 && jetonsDesElites(L.calendrier, toi, L.grosAnnonces, A.jour + 1) === 42 && jetonsDesElites(L.calendrier, toi, L.grosAnnonces, A.jour) === 0 && SONNES_ELITE > SONNE.duree,
    `perdue : ${perdue.coeurs} ❤️, ${coutePerdue} 🪙, sonnés ${SONNES_ELITE} matchs · gagnée : ${gagnee.coeurs} ❤️, +${jetonsDesElites(L.calendrier, toi, L.grosAnnonces, A.jour + 1)} 🪙`);
  const deux = apres.find(e => e.acte === 2);
  L.placer(L, { jour: deux.jour, ...decisionDElite({ jour: deux.jour, J: 17 }) });
  const m2 = L.calendrier[deux.jour].find(x => x.A === toi || x.B === toi);
  jouer(false); Object.assign(m2, m2.A === toi ? { gfA: 0, gfB: 2 } : { gfA: 2, gfB: 0 }, { joue: true });
  const vivante = etat(deux.jour + 1);
  exiger('deux élites perdues ne tuent pas la run : les cœurs restent aux contrôles des actes', !vivante.mort && vivante.coeurs === COEURS && vivante.elites.filter(e => !e.gagne).length === 2,
    `${vivante.coeurs} ❤️ après deux élites perdues, ${jetonsDesElites(L.calendrier, toi, L.grosAnnonces, deux.jour + 1)} 🪙`);
}

/* ---------- 1d. pour le battre ---------- */
{
  const lignes = ['tirs', 'durs', 'gardien'], moments = { tirs: 'tireurs', durs: 'durs', gardien: 'grosGardien' };
  const parLigne = lignes.map(k => piecesContre([k]));
  const forts = lignes.map(k => L.teams.filter(T => (T.sonJeu || []).includes(k)).length);
  const lus = L.teams.every(T => JSON.stringify(T.sonJeu) === JSON.stringify(lignesFortes(L.jeux.get(T), n)));
  exiger('une pièce « pour le battre » par ligne du jeu, chacune son moment ; chaque club porte les lignes où il est au 12e rang ou mieux',
    parLigne.every(l => l.length === 1) && lignes.every((k, i) => PIECES[parLigne[i][0]].soir && MOMENTS_SI[moments[k]] && PIECES[parLigne[i][0]].quand({ soir: { [moments[k]]: true } }) && !PIECES[parLigne[i][0]].quand({ soir: {} }))
    && forts.every(x => x === 12) && lus,
    lignes.map((k, i) => `${k} : ${PIECES[parLigne[i][0]].ico} ${PIECES[parLigne[i][0]].nom}, ${forts[i]} clubs`).join(' · '));
}

/* ---------- 2. les élites en paires ---------- */
if (process.env.LIRE) {
  const dir = process.env.LIRE, vus = new Map();
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) vus.set(`${r.robot}|${r.graine}`, r);
  const runs = [...vus.values()];
  const de = robot => new Map(runs.filter(r => r.robot === robot).map(r => [r.graine, r]));
  const paires = (a, b) => { const B = de(b); return [...de(a).values()].filter(r => B.has(r.graine)).map(r => [r, B.get(r.graine)]); };
  const toutes = runs.flatMap(r => r.elites.map(e => ({ r, e })));
  exiger('dans chaque run, aucune élite à l\'acte I, une au plus par acte, sa récompense à la formule', toutes.every(({ e }) => e.acte >= 2 && Math.abs(e.J - recompenseDeLElite(e.p)) <= 1)
    && runs.every(r => [2, 3].every(a => r.elites.filter(e => e.acte === a).length <= ELITES_PAR_ACTE)), `${toutes.length} élites dans ${runs.length} runs`);
  const lire = (prend, refuse, juge) => {
    const p = paires(prend, refuse);
    if (!p.length) return;
    const N = p.length, cA = p.filter(([a]) => a.coupe).length, cB = p.filter(([, b]) => b.coupe).length, mA = p.filter(([a]) => a.mort).length, mB = p.filter(([, b]) => b.mort).length;
    const prises = p.flatMap(([a]) => a.elites), gagnees = prises.filter(e => e.gagnee).length;
    const detail = `${N} paires · Coupes ${cA} contre ${cB} · morts ${mA} contre ${mB} · ${prises.length} élites prises, ${gagnees} gagnées (${Math.round((100 * gagnees) / Math.max(1, prises.length))} %), ${v1(prises.reduce((s, e) => s + (e.gagnee ? e.J : -perteDeLElite(e.J)), 0) / N)} 🪙 nets par run`;
    const ok = cA >= cB && mA - mB <= N / 8;
    if (juge && N >= 64) exiger(`${prend} (prend) contre ${refuse} (refuse) : au moins autant de Coupes, au plus une mort de plus sur huit`, ok, detail);
    else informer(`${prend} contre ${refuse}${juge ? ` — ${N} paires, non jugé (64 il faut)` : ''}`, detail);
  };
  lire('attentif', 'prudent', true);
  lire('glouton', 'prudent', false);
} else informer('les élites en paires', 'sur les runs de la profondeur, en CI : LIRE=runs node scripts/check_elites.mjs (.github/workflows/profondeur.yml)');

verdict('Les élites');
