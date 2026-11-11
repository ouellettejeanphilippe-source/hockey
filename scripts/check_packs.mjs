/**
 * LES POCHETTES SELON LE NIVEAU DES JOUEURS (S80 ; réécrit à la V28, tranche 5b) — ce que ses taux promettent, une pochette
 * le donne. La boutique de l'ancien Rogue et ses dix-huit packs sont partis : la run en carte ouvre deux pochettes à son
 * marché (le Bronze, l'Époque), par le tirage que ce juge éprouve.
 *
 * JP : *packs selon les niveaux de joueurs, genre joueur moins bons plus fréquents, du moins, joueurs brisés moins fréquents*.
 *
 *   node scripts/check_packs.mjs              (PACKS=4000 pochettes de chaque sorte ; une vingtaine de secondes)
 *
 * Vérifie, sur les 55 vraies saisons, avec le tirage même du jeu (`tirerJoueursDuPack`, js/packs.js — le contrôleur ne lui
 * fournit que les saisons, les shards et ce que la run permet) :
 *   1. les NIVEAUX (js/niveaux.js) : des rangs, sans chevauchement, un Phénomène dans chaque groupe de chaque saison ;
 *   2. les taux et le barème du métal font 100 % ;
 *   3. une pochette est PURE : la même graine, la même pochette, le même numéro d'achat rendent les mêmes cartes ;
 *   4. le Bronze : trois joueurs, chacun au niveau de sa vraie saison, aux fréquences de ses taux (à quatre écarts types),
 *      une étoile ou mieux moins d'une pochette sur vingt ;
 *   5. l'Époque : un seul joueur, Pilier ou mieux, de la décennie choisie (ou d'une décennie tirée), du poste choisi ;
 *   6. le niveau et l'édition sont deux axes : le barème des éditions tient, toutes cartes ensemble, chaque édition sort, et
 *      la plus brillante d'une pochette va à son joueur de plus grande stature ;
 *   7. ce que la run ne permet pas ne sort pas (`libre`), et personne ne sort deux fois d'une même pochette.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS_TOUS, METAL, niveauxDuPack, tirerJoueursDuPack } from '../js/packs.js';
import { NIVEAUX, ETOILE, PHENOMENE, niveauDe, niveauParDefense, joueursParNiveau, joueursHorsNiveau, groupeDuJoueur, mesureDuNiveau } from '../js/niveaux.js';
import { getPlayerKey, getPersonKey } from '../js/sim.js';
import { EDITIONS, statureDe } from '../js/rarete.js';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const PACKS = Number(process.env.PACKS ?? 4000);

/* Les shards, comme la run les rend : { players }. */
const C = new Map();
const shard = s => { if (!C.has(s)) C.set(s, { players: JSON.parse(fs.readFileSync(path.join(DIR, `${s}.json`), 'utf8')).players }); return C.get(s); };
const tirer = (cle, n, o = {}) => tirerJoueursDuPack(cle, { graine: o.graine || `packs-${n}`, n, params: o.params || {}, saisons: SAISONS, shard, libre: o.libre || (() => true) });
const pc = x => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)} %`;
const an = x => Number(String(x.p.s).slice(0, 4));
/* L'écart permis entre une fréquence observée et son taux : quatre écarts types, jamais moins d'un dixième de point. */
const tolere = (p, n) => Math.max(0.001, 4 * Math.sqrt(p * (1 - p) / n));

console.log(`\n  Les pochettes selon le niveau des joueurs — ${PACKS} pochettes de chaque sorte\n`);

/* 1. Les niveaux. */
{
  let chevauche = 0, sansPhenomene = [], parNiveau = NIVEAUX.map(() => 0), regs = 0;
  let parDefense = 0;
  for (const s of SAISONS) {
    const e = await shard(s);
    const par = joueursParNiveau(e.players);
    par.forEach((a, k) => { parNiveau[k] += a.length; regs += a.length; });
    for (const g of ['F', 'D', 'G']) {
      // Aux points : un niveau gagné à la défense (oct. 2026) a le droit d'avoir moins de points que le niveau d'en dessous.
      const m = par.map(a => a.filter(p => groupeDuJoueur(p) === g && !niveauParDefense(p, e.players)).map(p => mesureDuNiveau(p, e.players)));
      parDefense += par.flat().filter(p => groupeDuJoueur(p) === g && niveauParDefense(p, e.players)).length;
      if (!m[PHENOMENE].length) sansPhenomene.push(`${s} ${g}`);
      for (let k = 1; k < m.length; k++) if (m[k].length && m[k - 1].length && Math.min(...m[k]) < Math.max(...m[k - 1])) chevauche++;
    }
  }
  exiger('les niveaux sont des rangs : aucun ne chevauche le suivant, aux points', !chevauche, `${SAISONS.length} saisons × 3 groupes, ${chevauche} chevauchement(s) ; ${parDefense} niveaux gagnés à la défense sur ${regs} réguliers`);
  exiger('chaque groupe de chaque saison a son Phénomène', !sansPhenomene.length, sansPhenomene.slice(0, 5).join(', ') || 'avants, défenseurs, gardiens');
  informer('les réguliers par niveau', NIVEAUX.map((N, k) => `${N.nom} ${parNiveau[k]} (${pc(parNiveau[k] / regs)})`).join(' · '));
  const phenomenes = async s => joueursParNiveau((await shard(s)).players)[PHENOMENE].map(p => p.n);
  const est = async (s, n) => (await phenomenes(s)).includes(n);
  exiger('Orr 1970-71, Gretzky 1981-82, Hasek 1997-98 sont des Phénomènes', await est('1970-71', 'Bobby Orr') && await est('1981-82', 'Wayne Gretzky') && await est('1997-98', 'Dominik Hasek'),
    `${(await phenomenes('1981-82')).join(', ')} (1981-82)`);
}

/* 2. Les taux et le barème font 100 %. */
exiger('les taux de joueur du métal et le barème de ses éditions font 100 %', Math.abs(NIVEAUX.reduce((a, N) => a + (METAL.niveaux[N.cle] || 0), 0) - 100) < 1e-9 && Math.abs(EDITIONS.reduce((a, e) => a + (METAL.cotes[e] || 0), 0) - 100) < 1e-9,
  `${NIVEAUX.map(N => METAL.niveaux[N.cle]).join(' / ')} · ${EDITIONS.map(e => METAL.cotes[e]).join(' / ')}`);
exiger('deux pochettes, celles que le marché vend : le Bronze à trois joueurs, l\'Époque à un seul', Object.keys(PACKS_TOUS).join() === 'j:bronze,j:epoque' && PACKS_TOUS['j:bronze'].n === 3 && PACKS_TOUS['j:epoque'].n === 1);

/* 3. Une pochette est pure. */
{
  const empreinte = r => r.cartes.map(x => `${getPlayerKey(x.p)}:${x.niveau}:${x.rar}:${x.num || ''}`).join('|');
  let impurs = 0;
  for (const cle of Object.keys(PACKS_TOUS)) for (let n = 0; n < 40; n++) if (empreinte(await tirer(cle, n)) !== empreinte(await tirer(cle, n))) impurs++;
  exiger('une pochette est pure (la graine, la pochette, le numéro de l\'achat)', !impurs, `${impurs} impure(s) sur 80, tirées deux fois`);
  exiger('un autre numéro d\'achat, une autre pochette', empreinte(await tirer('j:bronze', 3, { graine: 'g' })) !== empreinte(await tirer('j:bronze', 4, { graine: 'g' })));
}

/* 4 et 6. Le Bronze : ses niveaux, ses éditions, la brillante à la vedette. */
const toutes = [];
{
  const taux = niveauxDuPack('j:bronze'), compte = NIVEAUX.map(() => 0), eds = Object.fromEntries(EDITIONS.map(e => [e, 0]));
  let cartes = 0, faux = 0, doubles = 0, etoilees = 0, malRangees = 0, courtes = 0;
  for (let n = 0; n < PACKS; n++) {
    const r = await tirer('j:bronze', n);
    if (r.cartes.length !== 3) courtes++;
    if (new Set(r.cartes.map(x => getPersonKey(x.p))).size !== r.cartes.length) doubles++;
    if (r.cartes.some(x => x.niveau >= ETOILE)) etoilees++;
    // La plus brillante au joueur de plus grande stature : à édition plus haute, jamais une stature plus basse.
    for (const a of r.cartes) for (const b of r.cartes) if (EDITIONS.indexOf(a.rar) > EDITIONS.indexOf(b.rar) && statureDe(a.p, a.niveau) < statureDe(b.p, b.niveau)) malRangees++;
    for (const x of r.cartes) {
      cartes++; compte[x.niveau]++; eds[x.rar]++; toutes.push(x);
      // Une carte Soutien sur dix vient de ceux qui n'ont pas de niveau dans leur saison (trop peu de matchs, ou la ligne d'un
      // deuxième club la même année) : `joueursHorsNiveau`.
      const P = shard(x.p.s).players;
      if (niveauDe(x.p, P) !== x.niveau && !(x.niveau === 0 && joueursHorsNiveau(P).includes(x.p))) faux++;
    }
  }
  exiger('Bronze : trois joueurs, personne deux fois', !courtes && !doubles, `${PACKS} pochettes, ${courtes} courte(s), ${doubles} doublon(s)`);
  exiger('Bronze : chaque carte a le niveau de sa vraie saison', !faux, `${cartes} cartes, ${faux} fausse(s)`);
  const hors = NIVEAUX.map((N, k) => [N.nom, compte[k] / cartes, taux[N.cle] / 100]).filter(([, o, p]) => Math.abs(o - p) > tolere(p, cartes));
  exiger('Bronze : les niveaux par carte collent à ses taux', !hors.length, NIVEAUX.map((N, k) => `${N.nom} ${pc(compte[k] / cartes)} (${taux[N.cle]} %)`).join(' · '));
  exiger('Bronze : une étoile ou mieux dans moins d\'une pochette sur vingt', etoilees / PACKS < 0.05 && etoilees > 0, `${etoilees} pochettes sur ${PACKS} (${pc(etoilees / PACKS)})`);
  const horsEd = EDITIONS.filter(e => Math.abs(eds[e] / cartes - METAL.cotes[e] / 100) > tolere(METAL.cotes[e] / 100, cartes));
  exiger('le barème des éditions tient, toutes cartes ensemble, et chaque édition sort', !horsEd.length && EDITIONS.every(e => eds[e] > 0), EDITIONS.map(e => `${e} ${pc(eds[e] / cartes)} (${METAL.cotes[e]} %)`).join(' · '));
  exiger('la plus brillante d\'une pochette va à son joueur de plus grande stature', !malRangees, `${malRangees} carte(s) mal rangée(s)`);
  exiger('une Holo porte son numéro, les autres aucun', toutes.every(x => (x.rar === 'legendaire') === !!x.num), `${toutes.filter(x => x.num).length} Holo numérotées`);
}

/* 5. L'Époque : un joueur, Pilier ou mieux, de sa décennie et de son poste. */
{
  const PILIER = NIVEAUX.findIndex(N => N.cle === 'pilier'), N = Math.round(PACKS / 4);
  let faibles = 0, plusieurs = 0, horsDec = 0, vides = 0;
  const decs = new Set();
  for (let n = 0; n < N; n++) {
    const r = await tirer('j:epoque', n);
    if (r.cartes.length !== 1) { plusieurs += r.cartes.length > 1 ? 1 : 0; vides += r.cartes.length ? 0 : 1; continue; }
    const x = r.cartes[0];
    if (x.niveau < PILIER) faibles++;
    if (an(x) < r.reglage.decennie || an(x) >= r.reglage.decennie + 10) horsDec++;
    decs.add(r.reglage.decennie);
  }
  exiger('Époque : un seul joueur, Pilier ou mieux, de la décennie tirée', !faibles && !plusieurs && !horsDec && !vides, `${N} pochettes · ${faibles} sous le Pilier · ${horsDec} hors de sa décennie · ${vides} vide(s)`);
  exiger('Époque : sans choix, chaque décennie des données sort', decs.size >= 6, [...decs].sort().join(' · '));
  const choisie = (await Promise.all(Array.from({ length: 60 }, (_, n) => tirer('j:epoque', n, { params: { decennie: 1980 } })))).flatMap(r => r.cartes);
  exiger('Époque : la décennie choisie', choisie.length === 60 && choisie.every(x => an(x) >= 1980 && an(x) < 1990), `${choisie.length} joueurs des années 80`);
  for (const g of ['F', 'D', 'G']) {
    const po = (await Promise.all(Array.from({ length: 60 }, (_, n) => tirer('j:epoque', n, { params: { poste: g } })))).flatMap(r => r.cartes);
    exiger(`Époque : le poste choisi (${g})`, po.length === 60 && po.every(x => groupeDuJoueur(x.p) === g), `${po.length} joueurs`);
  }
}

/* 7. Ce que la run ne permet pas ne sort pas. */
{
  const vus = new Set(toutes.slice(0, 3000).map(x => getPersonKey(x.p)));
  let interdits = 0, cartes = 0;
  for (let n = 0; n < 400; n++) for (const x of (await tirer('j:bronze', n, { libre: p => !vus.has(getPersonKey(p)) })).cartes) { cartes++; if (vus.has(getPersonKey(x.p))) interdits++; }
  exiger('ce que la run ne permet pas ne sort pas : personne qu\'elle a déjà vu', !interdits && cartes === 1200, `${cartes} cartes, ${interdits} interdite(s), ${vus.size} personnes écartées`);
}

verdict('Les pochettes');
