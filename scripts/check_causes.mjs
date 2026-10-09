/*
 * CE QUI A FAIT LE MATCH (oct., js/causes.js) — chaque cause dite a vraiment décidé de son lancer.
 *
 * JP : *tout ce qui a influencé le jeu. Le joueur doit comprendre ce qui se passe et avoir un impact.* Le moteur
 * nomme, pour les matchs de ton club, les causes qui ont décidé du dé de chaque lancer (`causesDuLancer`, js/sim.js).
 * Une ligue de vrais vestiaires joue sa saison, deux fois. Ce qu'on exige :
 *   1. les dés ne bougent pas : la même graine, avec ou sans la lecture des causes (la molette CAUSES=0, dans un
 *      fils), rend les mêmes pointages ;
 *   2. seuls les matchs de ton club portent leurs causes (la ligue ne paie rien) ;
 *   3. chaque cause dite a DÉCIDÉ : retirée seule, la chance de son lancer passait de l'autre côté du dé
 *      (la molette CAUSES_PREUVE garde la chance et le dé) ; et le but du lancer est bien `dé < chance` ;
 *   4. « sans tes cartes » se recompte : le pointage sans un groupe est le vrai, moins ses lancers renversés ;
 *   5. un badge monté (une carte Or sur le meilleur marqueur) se voit : il fait entrer des buts, à lui.
 *
 *   node scripts/check_causes.mjs
 */
process.env.CAUSES_PREUVE = '1';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJournee, badgesDe, CARTES } = await import('../js/sim.js');
const { causesDuMatch, causesDeSaison } = await import('../js/causes.js');
const { equipeReelle } = await import('./lib/vestiaires.mjs');
const { exiger, informer, verdict } = await import('./verdict.mjs');

const CLUBS = [['2006-07', 'ANA'], ['2006-07', 'DET'], ['1995-96', 'COL'], ['1985-86', 'EDM'], ['2013-14', 'LAK'], ['2018-19', 'TBL'], ['1979-80', 'MTL'], ['2001-02', 'DET']];
const MATCHS = 40;
function saison(joueur, carte = false, carteClub = null) {
  const teams = CLUBS.map(([s, t]) => { const p = equipeReelle(s, t).flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(`${t} ${s}`, t, autoRoster(p), { season: s }); });
  if (joueur) teams[0].isPlayer = true;
  let vedette = null;
  if (carte) {
    // Le meilleur marqueur dont le badge de finition peut monter de deux crans (un Platine n'a plus rien à gagner).
    vedette = Object.values(teams[0].roster).filter(p => p && p.p !== 'G' && (b => b && ['sniper', 'power'].includes(b.cle) && b.palier <= 2)(badgesDe(p)[0])).sort((a, b) => (b.g || 0) - (a.g || 0))[0];
    vedette._carte = { rar: 'legendaire' };
  }
  const L = creerLigue(teams, MATCHS, { graine: 'causes', decisions: carteClub ? [{ jour: 0, carte: carteClub }] : [] });
  while (!L.fini) jouerJournee(L);
  for (const m of L.calendrier.flat()) if (m.feuille) m.joue = true;
  return { L, toi: teams[0], vedette };
}

const pointages = S => S.L.calendrier.flat().filter(m => m.feuille).map(m => `${m.feuille.gfA}-${m.feuille.gfB}`).join(' ');
if (process.env.CAUSES_FILS === '1') { process.stdout.write(pointages(saison(true))); process.exit(0); }
console.log('\n  CE QUI A FAIT LE MATCH\n');
const avec = saison(true);
const sansLire = String(execFileSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, CAUSES_FILS: '1', CAUSES: '0' }, maxBuffer: 1 << 24 }));
exiger('1. les dés ne bougent pas : la même graine, avec ou sans la lecture des causes, rend les mêmes pointages', pointages(avec) === sansLire, `${pointages(avec).split(' ').length} matchs`);

const matchs = avec.L.calendrier.flat().filter(m => m.feuille);
const miens = matchs.filter(m => m.A === avec.toi || m.B === avec.toi);
const autres = matchs.filter(m => m.A !== avec.toi && m.B !== avec.toi);
// La prolongation se joue au premier but, par sa propre formule (`butProlongation`) : ses lancers n'ont pas de causes.
exiger('2. les matchs de ton club portent leurs causes (le temps réglementaire)', miens.every(m => m.feuille.lancers.every(l => l.causes || l.instant >= 60)), `${miens.length} matchs`);
exiger('2. les autres matchs n\'en portent aucune', autres.every(m => m.feuille.lancers.every(l => !l.causes)), `${autres.length} matchs`);

let dites = 0, fausses = 0, mauvaisBut = 0;
// La borne du moteur (`borne(pBrut, 0.005, PCT_TIR_MAX)`, js/sim.js) : 0,35 au plus. Les shards de la V5 (les positions
// multiples) sortent des lancers au-dessus : la preuve la lit comme le moteur, sans la supposer jamais atteinte.
const PCT_TIR_MAX = 0.35;
const borne = p => Math.max(0.005, Math.min(p, PCT_TIR_MAX));
for (const m of miens) for (const l of m.feuille.lancers) {
  if (!l.causes) continue;
  const { pBrut, de } = l.causes;
  if (pBrut == null) continue;
  const p = borne(pBrut);
  // Le but du lancer est le dé contre sa chance bornée, comme au moteur.
  if ((de < p) !== l.but) mauvaisBut++;
  for (const c of l.causes.liste) {
    dites++;
    const pSans = borne(pBrut / c.f);
    const ok = c.d === 'but' ? l.but && de >= pSans : !l.but && de < pSans;
    if (!ok) fausses++;
  }
}
exiger('3. le but d\'un lancer est son dé sous sa chance', mauvaisBut === 0, `${mauvaisBut} lancer(s) qui ne collent pas`);
exiger('3. chaque cause dite a décidé : retirée seule, le lancer changeait de côté', dites > 0 && fausses === 0, `${dites} causes dites, ${fausses} fausse(s)`);

let groupesVus = 0, recomptes = 0;
for (const m of miens) {
  const moi = m.A === avec.toi ? 'A' : 'B', eux = moi === 'A' ? 'B' : 'A';
  const r = causesDuMatch(m.feuille, moi);
  for (const x of r.sans) {
    groupesVus++;
    const renverses = m.feuille.lancers.filter(l => l.causes && l.causes.groupes.some(g => g.c === moi && g.g === x.groupe));
    const d = { A: 0, B: 0 };
    for (const l of renverses) d[l.cote] += l.but ? -1 : 1;
    if (x.moi === m.feuille[`gf${moi}`] + d[moi] && x.eux === m.feuille[`gf${eux}`] + d[eux] && x.n === renverses.length) recomptes++;
  }
}
exiger('4. le pointage sans un groupe se recompte dans la feuille', groupesVus > 0 && recomptes === groupesVus, `${recomptes} sur ${groupesVus}`);

const or = saison(true, true);
const lui = or.vedette;
let butsMonte = 0;
for (const m of or.L.calendrier.flat()) if (m.feuille && (m.A === or.toi || m.B === or.toi)) for (const b of m.feuille.buts) if (b.causes && b.causes.liste.some(c => c.k === 'monte' && c.qui === lui && c.d === 'but')) butsMonte++;
const S = causesDeSaison(or.L.calendrier, or.toi);
informer('5. la saison de ton club', `${S.n} matchs · ${S.groupes.map(g => `${g.mot} ${g.ecart > 0 ? '+' : ''}${g.ecart}`).join(' · ')}`);
exiger(`5. le badge monté de ${lui.n} (carte Or) fait entrer des buts, à lui`, butsMonte >= 1, `${butsMonte} but(s) en ${MATCHS} matchs`);
exiger('5. le bilan de saison le dit', S.pour.some(x => /badge monté/.test(x.texte)), S.pour.slice(0, 3).map(x => x.texte).join(' | '));

/* 6. V5 : UNE CARTE DU CLUB SE NOMME. « L'école de tir a fait entrer 2 buts », pas « les cartes et les décisions du club ». */
const ecole = saison(true, false, 'ecole');
const nommes = ecole.L.calendrier.flat().filter(m => m.feuille && (m.A === ecole.toi || m.B === ecole.toi))
  .reduce((a, m) => a + m.feuille.lancers.filter(l => l.causes && l.causes.liste.some(c => c.k === 'carteClub' && c.qui && c.qui.nom === CARTES.ecole.nom)).length, 0);
const SE = causesDeSaison(ecole.L.calendrier, ecole.toi);
exiger('6. une carte du club se nomme dans les lancers qu\'elle décide', nommes >= 1, `${nommes} lancer(s) décidé(s) par « ${CARTES.ecole.nom} »`);
exiger('6. le bilan de saison la dit par son nom', SE.pour.concat(SE.contre || []).some(x => x.texte.includes(CARTES.ecole.nom)), SE.pour.slice(0, 4).map(x => x.texte).join(' | '));
verdict();
