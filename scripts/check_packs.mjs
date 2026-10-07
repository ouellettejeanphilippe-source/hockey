/**
 * LES PACKS SELON LE NIVEAU DES JOUEURS (S80) — ce que la boutique affiche,
 * les packs le donnent.
 *
 * JP : *packs selon les niveaux de joueurs, genre joueur moins bons plus
 * fréquents, du moins, joueurs brisés moins fréquents*.
 *
 *   node scripts/check_packs.mjs              (PACKS=4000 par tier)
 *   PACKS=10000 node scripts/check_packs.mjs  (une lecture plus fine)
 *
 * Vérifie, sur les 55 vraies saisons, avec le tirage même du jeu
 * (`tirerJoueursDuPack`, js/packs.js — le contrôleur ne lui fournit que les
 * saisons, les shards et ce que la partie permet) :
 *   1. les NIVEAUX (js/niveaux.js) : des rangs, sans chevauchement, un
 *      Phénomène dans chaque groupe de chaque saison ; l'étoile d'avant et
 *      celle d'aujourd'hui ;
 *   2. les taux affichés : chaque tier fait 100 %, chaque pack par niveau
 *      affiche ses chances de joueur, les packs par talent et le trio non ;
 *   3. un pack est PUR : la même graine, le même pack, le même numéro d'achat
 *      rendent les mêmes cartes, même avec des shards rechargés ;
 *   4. les FRÉQUENCES observées par niveau collent aux taux affichés (par
 *      carte et par pack, à quatre écarts types), pour les quatre tiers, le
 *      garanti, les époques et l'année ; un pack Bronze donne un Phénomène
 *      moins d'une fois sur cent ;
 *   5. l'équipe (un club n'a pas toujours son Phénomène : le niveau d'en
 *      dessous), les étoiles et les légendes, les talents et le trio gardent
 *      leur règle ;
 *   6. le niveau et la variante sont deux axes : la finition d'un Soutien
 *      suit le même barème que celle d'une Étoile ;
 *   7. un plafond serré : jamais un salaire au-dessus, et le niveau descend ;
 *   8. avant et après : l'ancien tirage (la moitié productive, à parts
 *      égales) mesuré sur les mêmes niveaux.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS_TOUS, PACKS_CARTES, TIERS, SKILLS, chancesDe, cartesDuPack, niveauxDuPack, tirerJoueursDuPack, packDuJour, tirerCartesPack, sortDUnPack } from '../js/packs.js';
import { VENTE, valeurDe } from '../js/inventaire.js';
import { BANQUE, CONTRATS, idsDe } from '../js/banque.js';
import { NIVEAUX, ETOILE, PHENOMENE, niveauDe, joueursParNiveau, groupeDuJoueur, mesureDuNiveau } from '../js/niveaux.js';
import { getPlayerKey, getPersonKey } from '../js/sim.js';
import { ageAtSeason } from '../js/ratings.js';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const PACKS = Number(process.env.PACKS ?? 4000);

/* Les shards, comme `getShard` (js/game.js) les rend : { players, byTeam }. */
function chargeur() {
  const C = new Map();
  return async s => {
    if (!C.has(s)) {
      const sh = JSON.parse(fs.readFileSync(path.join(DIR, `${s}.json`), 'utf8'));
      const byTeam = {};
      for (const p of sh.players) (byTeam[p.t] = byTeam[p.t] || []).push(p);
      C.set(s, { players: sh.players, byTeam });
    }
    return C.get(s);
  };
}
const shard = chargeur();
const tirer = (cle, n, o = {}) => tirerJoueursDuPack(cle, { graine: o.graine || `packs-${n}`, n, params: o.params || {}, mods: o.mods || {}, saisons: SAISONS, shard: o.shard || shard, libre: o.libre || (() => true) });
const pc = x => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)} %`;
const unSur = p => (p > 0 ? `1 sur ${Math.round(1 / p)}` : 'jamais');
/* L'écart permis entre une fréquence observée et son taux : quatre écarts types, jamais moins d'un dixième de point. */
const tolere = (p, n) => Math.max(0.001, 4 * Math.sqrt(p * (1 - p) / n));
/* L'étoile d'AVANT S80 (js/game.js, S78-S79) : les points TOTAUX de tous les patineurs réguliers (4 %), le % d'arrêts des gardiens (8 %). */
function etoileAvant(P) {
  const gpMax = Math.max(1, ...P.map(x => x.gp || 0));
  const minP = Math.min(40, Math.floor(gpMax * 0.5)), minG = Math.min(30, Math.floor(gpMax * 0.35));
  const pts = x => x.pt ?? ((x.g || 0) + (x.a || 0));
  const pat = P.filter(x => x.p !== 'G' && (x.gp || 0) >= minP).map(pts).sort((a, b) => b - a);
  const gar = P.filter(x => x.p === 'G' && (x.gp || 0) >= minG).map(x => x.sv || 0).sort((a, b) => b - a);
  const sPts = pat[Math.max(0, Math.ceil(pat.length * 0.04) - 1)], sSv = gar[Math.max(0, Math.ceil(gar.length * 0.08) - 1)];
  return p => (p.p === 'G' ? (p.gp || 0) >= minG && (p.sv || 0) >= sSv : (p.gp || 0) >= minP && pts(p) >= sPts);
}

console.log(`\n  Les packs selon le niveau des joueurs (S80) — ${PACKS} packs par tier\n`);
const t0 = Date.now();

/* 1. Les niveaux. */
{
  let chevauche = 0, sansPhenomene = [], parNiveau = NIVEAUX.map(() => 0), regs = 0;
  let ancienne = 0, nouvelle = 0, communes = 0, dAvant = 0, dMaintenant = 0;
  for (const s of SAISONS) {
    const e = await shard(s);
    const par = joueursParNiveau(e.players);
    par.forEach((a, k) => { parNiveau[k] += a.length; regs += a.length; });
    for (const g of ['F', 'D', 'G']) {
      const m = par.map(a => a.filter(p => groupeDuJoueur(p) === g).map(p => mesureDuNiveau(p, e.players)));
      if (!m[PHENOMENE].length) sansPhenomene.push(`${s} ${g}`);
      for (let k = 1; k < m.length; k++) if (m[k].length && m[k - 1].length && Math.min(...m[k]) < Math.max(...m[k - 1])) chevauche++;
    }
    // L'étoile d'avant et celle d'aujourd'hui, une personne une fois.
    const P = e.players, avant = etoileAvant(P);
    const vus = new Set(), U = P.filter(p => !vus.has(getPersonKey(p)) && vus.add(getPersonKey(p)));
    for (const p of U) {
      const a = avant(p);
      const b = niveauDe(p, P) >= ETOILE;
      ancienne += a; nouvelle += b; communes += a && b;
      if (groupeDuJoueur(p) === 'D') { dAvant += a; dMaintenant += b; }
    }
  }
  exiger('les niveaux sont des rangs : aucun ne chevauche le suivant', !chevauche, `${SAISONS.length} saisons × 3 groupes, ${chevauche} chevauchement(s)`);
  exiger('chaque groupe de chaque saison a son Phénomène', !sansPhenomene.length, sansPhenomene.slice(0, 5).join(', ') || 'avants, défenseurs, gardiens');
  informer('les réguliers par niveau', NIVEAUX.map((N, k) => `${N.nom} ${parNiveau[k]} (${pc(parNiveau[k] / regs)})`).join(' · '));
  const phenomenes = async s => joueursParNiveau((await shard(s)).players)[PHENOMENE].map(p => p.n);
  const est = async (s, n) => (await phenomenes(s)).includes(n);
  exiger('Orr 1970-71, Gretzky 1981-82, Hasek 1997-98 sont des Phénomènes', await est('1970-71', 'Bobby Orr') && await est('1981-82', 'Wayne Gretzky') && await est('1997-98', 'Dominik Hasek'),
    `${(await phenomenes('1981-82')).join(', ')} (1981-82)`);
  informer('l\'étoile avant / après S80', `${ancienne} → ${nouvelle} étoiles en ${SAISONS.length} saisons, ${communes} en commun · défenseurs ${dAvant} → ${dMaintenant}`);
}

/* 2. Les taux affichés. */
const CLES_J = Object.keys(PACKS_TOUS).filter(k => PACKS_TOUS[k].sorte === 'joueurs');
exiger('les taux de joueur de chaque tier font 100 %', Object.values(TIERS).every(T => Math.abs(NIVEAUX.reduce((a, N) => a + (T.niveaux[N.cle] || 0), 0) - 100) < 1e-9),
  Object.entries(TIERS).map(([k, T]) => `${k} ${NIVEAUX.map(N => T.niveaux[N.cle]).join('/')}`).join(' · '));
const parNiveauAffiche = CLES_J.filter(k => niveauxDuPack(k));
const sansNiveau = CLES_J.filter(k => !niveauxDuPack(k));
exiger('chaque pack par niveau affiche ses chances de Phénomène, les talents et le trio non',
  parNiveauAffiche.every(k => chancesDe(k).some(x => x.niveau && /Phénomène/.test(x.nom))) && sansNiveau.every(k => !chancesDe(k).some(x => x.niveau))
  && sansNiveau.every(k => ['skill', 'trio'].includes(PACKS_TOUS[k].famille)),
  `${parNiveauAffiche.length} par niveau · ${sansNiveau.length} sans (${sansNiveau.map(k => k.slice(2)).join(', ')})`);

/* 3. Un pack est pur. */
{
  const frais = chargeur();
  let impurs = 0, total = 0;
  const empreinte = r => JSON.stringify([r.reglage, r.cartes.map(x => [getPlayerKey(x.p), x.niveau, x.rar, x.num])]);
  for (const cle of CLES_J) for (let n = 0; n < 12; n++) {
    const params = PACKS_TOUS[cle].choix === 'franchise' ? { franchise: n % 2 ? 'MTL' : null } : PACKS_TOUS[cle].choix === 'saison' ? { saison: n % 2 ? '1985-86' : null } : {};
    const a = empreinte(await tirer(cle, n, { graine: `pur-${n}`, params }));
    const b = empreinte(await tirer(cle, n, { graine: `pur-${n}`, params }));
    const c = empreinte(await tirer(cle, n, { graine: `pur-${n}`, params, shard: frais }));
    total++;
    if (a !== b || a !== c) impurs++;
  }
  exiger('un pack de joueurs est pur (graine, pack, numéro d\'achat)', !impurs, `${impurs} impur(s) sur ${total} packs, tirés trois fois (dont une avec les shards rechargés)`);
  const x = await tirer('j:hasard_argent', 3, { graine: 'autre' }), y = await tirer('j:hasard_argent', 4, { graine: 'autre' });
  exiger('un autre numéro d\'achat, un autre pack', empreinte(x) !== empreinte(y), 'j:hasard_argent n° 3 et n° 4');
}

/* 4. Les fréquences, contre les taux affichés. */
async function mesurer(cle, nPacks, o = {}) {
  const P = PACKS_TOUS[cle];
  const compte = NIVEAUX.map(() => 0), var_ = NIVEAUX.map(() => ({})), meilleur = NIVEAUX.map(() => 0);
  let cartes = 0, avecPhen = 0, avecEtoile = 0, faux = 0, horsSaisons = 0, trop = 0;
  for (let n = 0; n < nPacks; n++) {
    const params = o.params ? o.params(n) : {};
    const r = await tirer(cle, n, { graine: o.graine || `f-${cle}`, params, libre: o.libre });
    for (const x of r.cartes) {
      cartes++;
      compte[x.niveau]++;
      var_[x.niveau][x.rar] = (var_[x.niveau][x.rar] || 0) + 1;
      if (niveauDe(x.p, (await shard(x.p.s)).players) !== x.niveau) faux++;
      if (o.saisons && !o.saisons(x.p.s)) horsSaisons++;
      if (o.libre && !o.libre(x.p)) trop++;
    }
    if (r.cartes.some(x => x.niveau === PHENOMENE)) avecPhen++;
    if (r.cartes.some(x => x.niveau >= ETOILE)) avecEtoile++;
    if (r.cartes.length) meilleur[Math.max(...r.cartes.map(x => x.niveau))]++;
  }
  return { P, cle, nPacks, cartes, compte, var_, meilleur, avecPhen, avecEtoile, faux, horsSaisons, trop };
}
const lignesTaux = [];
function juger(m, { exact = true } = {}) {
  const nv = niveauxDuPack(m.cle);
  const ch = chancesDe(m.cle);
  const obs = NIVEAUX.map((N, k) => m.compte[k] / m.cartes);
  const ecarts = NIVEAUX.map((N, k) => ({ N, k, att: nv[N.cle] / 100, obs: obs[k] })).filter(x => x.att > 0 || x.obs > 0);
  const hors = ecarts.filter(x => Math.abs(x.obs - x.att) > tolere(x.att || 0.001, m.cartes));
  const pPhen = ch.find(x => /Phénomène/.test(x.nom)).p, oPhen = m.avecPhen / m.nPacks;
  const cEt = ch.find(x => /Étoile ou mieux/.test(x.nom));
  const nom = m.P.nom;
  lignesTaux.push(`${nom.padEnd(20)} ${ecarts.map(x => `${x.N.nom} ${pc(x.obs)} (${pc(x.att)})`).join(' · ')} · Phénomène ${unSur(oPhen)} des packs (affiché ${unSur(pPhen)})`);
  exiger(`${nom} : chaque carte a le niveau de sa vraie saison`, !m.faux, `${m.cartes} cartes`);
  if (!exact) return { oPhen, pPhen };
  exiger(`${nom} : les niveaux par carte collent aux taux affichés`, !hors.length,
    hors.length ? hors.map(x => `${x.N.nom} ${pc(x.obs)} au lieu de ${pc(x.att)}`).join(' · ') : `${m.cartes} cartes, ${ecarts.length} niveaux à 4 écarts types`);
  exiger(`${nom} : un Phénomène par pack, comme affiché`, Math.abs(oPhen - pPhen) <= tolere(pPhen, m.nPacks),
    `${pc(oPhen)} des packs (affiché ${pc(pPhen)}, « ${ch.find(x => /Phénomène/.test(x.nom)).txt} »)${cEt ? ` · Étoile ou mieux ${pc(m.avecEtoile / m.nPacks)} (affiché ${pc(cEt.p)})` : ''}`);
  return { oPhen, pPhen };
}
const mesures = {};
for (const t of ['bronze', 'argent', 'or', 'premium']) {
  const m = await mesurer(`j:hasard_${t}`, PACKS);
  mesures[t] = { ...juger(m), pilierPlus: (m.meilleur[2] + m.meilleur[3] + m.meilleur[4]) / m.nPacks };
}
borne('un pack Bronze donne un Phénomène très rarement (par pack)', mesures.bronze.oPhen, 0, 0.01);
juger(await mesurer('j:garanti', Math.round(PACKS / 2)));
for (const k of ['j:ere70', 'j:ere20']) {
  const d = PACKS_TOUS[k].decennie;
  const m = await mesurer(k, Math.round(PACKS / 2), { saisons: s => Number(s.slice(0, 4)) >= d && Number(s.slice(0, 4)) < d + 10 });
  exiger(`${PACKS_TOUS[k].nom} : toutes ses cartes sont de sa décennie`, !m.horsSaisons, `${m.cartes} cartes`);
  juger(m);
}
{
  const m = await mesurer('j:annee', Math.round(PACKS / 2), { params: n => ({ saison: n % 3 ? null : '1981-82' }) });
  juger(m);
}

/* 5. L'équipe, les étoiles, les légendes, les talents, le trio. */
{
  // Une franchise n'a pas un Phénomène chaque saison : le niveau d'en dessous, jamais un meilleur.
  const m = await mesurer('j:equipe', Math.round(PACKS / 2), { graine: 'equipe' });
  const nv = niveauxDuPack('j:equipe');
  const eq = juger(m, { exact: false });
  const oEt = (m.compte[ETOILE] + m.compte[PHENOMENE]) / m.cartes, aEt = (nv.etoile + nv.phenomene) / 100;
  exiger('Pack d\'équipe : jamais plus d\'étoiles qu\'affiché (le niveau descend, il ne monte pas)', oEt <= aEt + tolere(aEt, m.cartes) && eq.oPhen <= eq.pPhen + tolere(eq.pPhen, m.nPacks),
    `Étoile ou mieux ${pc(oEt)} des cartes (affiché ${pc(aEt)}) · Phénomène ${pc(eq.oPhen)} des packs (affiché ${pc(eq.pPhen)})`);
  const mtl = await mesurer('j:equipe', 400, { graine: 'mtl', params: () => ({ franchise: 'MTL' }) });
  exiger('Pack d\'équipe choisi : tous du club choisi', (await Promise.all([0, 1, 2].map(async n => (await tirer('j:equipe', n, { params: { franchise: 'MTL' } })).cartes))).flat().every(x => x.p.t === 'MTL'), 'Canadiens de Montréal');
  informer('Pack d\'équipe (Canadiens)', NIVEAUX.map((N, k) => `${N.nom} ${pc(mtl.compte[k] / mtl.cartes)}`).join(' · '));
}
for (const k of ['j:etoiles', 'j:legendes']) {
  const m = await mesurer(k, Math.round(PACKS / 2), { saisons: k === 'j:legendes' ? s => Number(s.slice(0, 4)) < 1995 : null });
  const P = PACKS_TOUS[k];
  exiger(`${P.nom} : que des étoiles${k === 'j:legendes' ? ', d\'avant 1995' : ''}`, m.compte.slice(0, ETOILE).every(c => !c) && !m.horsSaisons, `${m.cartes} cartes`);
  juger(m);
}
{
  // Les talents gardent leur filtre : le quart du haut de sa saison à son talent (ou son filtre : recrue, vétéran).
  let hors = 0, cartes = 0;
  for (const [sk, S] of Object.entries(SKILLS)) {
    for (let n = 0; n < 60; n++) {
      const r = await tirer(`j:${sk}`, n, { graine: `talent-${n}` });
      for (const x of r.cartes) {
        cartes++;
        const e = await shard(x.p.s);
        const c = e.players.filter(p => (p.gp || 0) >= S.min && (!S.groupe || groupeDuJoueur(p) === S.groupe) && (!S.skaters || p.p !== 'G')
          && (!S.filtre || S.filtre(p, ageAtSeason(p.bd, p.s)))).sort((a, b) => S.score(b) - S.score(a));
        const pool = S.filtre ? c : c.slice(0, Math.ceil(c.length / 4));
        if (!pool.some(p => getPlayerKey(p) === getPlayerKey(x.p))) hors++;
      }
    }
  }
  exiger('les packs par talent gardent leur filtre', !hors && cartes > 0, `${cartes} cartes, ${hors} hors filtre (${Object.keys(SKILLS).length} talents)`);
  let lignes = 0, bonnes = 0;
  for (let n = 0; n < 60; n++) {
    const r = await tirer('j:trio', n, { graine: `trio-${n}` });
    lignes++;
    if (r.cartes.length === 3 && new Set(r.cartes.map(x => `${x.p.t} ${x.p.s}`)).size === 1 && r.reglage.club) bonnes++;
  }
  exiger('le Pack Trio reste une vraie ligne d\'un même club-saison', bonnes === lignes, `${bonnes} / ${lignes}`);
}

/* 6. Deux axes : la finition ne dépend pas du niveau. */
{
  const m = await mesurer('j:hasard_premium', PACKS, { graine: 'axes' });
  const cotes = TIERS.premium.cotes;
  const groupes = [['Soutien et Régulier', [0, 1]], ['Pilier', [2]], ['Étoile et Phénomène', [3, 4]]];
  const lu = groupes.map(([nom, ks]) => {
    const v = {}; let t = 0;
    for (const k of ks) for (const [r, c] of Object.entries(m.var_[k])) { v[r] = (v[r] || 0) + c; t += c; }
    return { nom, t, v };
  });
  const hors = lu.flatMap(g => Object.entries(cotes).filter(([r, w]) => Math.abs((g.v[r] || 0) / g.t - w / 100) > tolere(w / 100, g.t)).map(([r]) => `${g.nom} ${r}`));
  exiger('le niveau et la finition sont deux axes (Premium : le barème par niveau)', !hors.length,
    lu.map(g => `${g.nom} : base ${pc((g.v.commune || 0) / g.t)}, holo+ ${pc(((g.v.rare || 0) + (g.v.legendaire || 0)) / g.t)} (${g.t} cartes)`).join(' · ') + (hors.length ? ` — hors : ${hors.join(', ')}` : ''));
}

/* 7. Un plafond serré : le niveau descend, le salaire jamais au-dessus. */
{
  const max = 1_500_000;
  const m = await mesurer('j:hasard_argent', Math.round(PACKS / 2), { graine: 'plafond', libre: p => p.$ > 0 && p.$ <= max });
  exiger('sous un plafond serré, aucun salaire au-dessus', !m.trop && m.cartes === Math.round(PACKS / 2) * cartesDuPack('j:hasard_argent'), `${m.cartes} cartes à 1,5 M$ et moins`);
  informer('Pack Argent sous 1,5 M$', NIVEAUX.map((N, k) => `${N.nom} ${pc(m.compte[k] / m.cartes)}`).join(' · ') + ' (le niveau d\'en dessous quand aucun joueur de ce niveau ne rentre)');
}

/*
 * 8. Avant et après : l'ancien tirage (S79) — une saison au hasard par carte,
 * puis un joueur à parts égales dans sa moitié productive. Chaque carte tire
 * sa saison, donc les cartes sont indépendantes : la part de chaque niveau est
 * la MOYENNE, sur les saisons, de sa part dans la moitié productive. Calculée
 * exactement, pas échantillonnée.
 */
{
  const prod = p => (p.p === 'G' ? (p.sv || 0) : ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1));
  const parts = NIVEAUX.map(() => 0);
  let horsReguliers = 0, phenEtoiles = 0;
  for (const s of SAISONS) {
    const P = (await shard(s)).players;
    const pool = ['F', 'D', 'G'].flatMap(g => {
      const r = P.filter(p => groupeDuJoueur(p) === g && (p.gp || 0) >= (g === 'G' ? 15 : 30)).sort((a, b) => prod(b) - prod(a));
      return r.slice(0, Math.ceil(r.length / 2));
    });
    for (const p of pool) { const k = niveauDe(p, P); if (k < 0) horsReguliers += 1 / pool.length / SAISONS.length; else parts[k] += 1 / pool.length / SAISONS.length; }
    // L'ancien Pack Étoiles : l'étoile d'avant, à parts égales.
    const etoiles = P.filter(etoileAvant(P));
    phenEtoiles += etoiles.filter(p => niveauDe(p, P) === PHENOMENE).length / etoiles.length / SAISONS.length;
  }
  const auMoins = (q, n) => 1 - (1 - q) ** n;
  const TOUS = ['bronze', 'argent', 'or', 'premium'];
  informer('avant S80 (la moitié productive), par carte', `${NIVEAUX.map((Nv, k) => `${Nv.nom} ${pc(parts[k])}`).join(' · ')} · hors réguliers ${pc(horsReguliers)}`);
  informer('un Phénomène par pack, avant → maintenant', TOUS.map(t => `${TIERS[t].nom} ${unSur(auMoins(parts[PHENOMENE], TIERS[t].n))} → ${unSur(mesures[t].oPhen)}`).join(' · '));
  // Ce qu'on signe : le meilleur joueur du pack.
  const pilier = parts[2] + parts[3] + parts[4];
  informer('le meilleur joueur est Pilier ou mieux, avant → maintenant', TOUS.map(t => `${TIERS[t].nom} ${pc(auMoins(pilier, TIERS[t].n))} → ${pc(mesures[t].pilierPlus)}`).join(' · '));
  const nvE = niveauxDuPack('j:etoiles').phenomene / 100;
  informer('le Pack Étoiles, avant → maintenant', `un Phénomène par carte ${pc(phenEtoiles)} → ${pc(nvE)} · par pack ${pc(auMoins(phenEtoiles, 5))} → ${pc(auMoins(nvE, 5))}`);
  exiger('un Phénomène sort moins souvent qu\'avant, dans chaque tier', TOUS.every(t => mesures[t].oPhen < auMoins(parts[PHENOMENE], TIERS[t].n)) && nvE < phenEtoiles,
    `par carte, avant : ${pc(parts[PHENOMENE])}`);
}

/*
 * L'ÉCONOMIE NE FUIT PAS (1.0, J1-A). Acheter un pack de cartes pour tout
 * revendre ne doit jamais rapporter : l'espérance de revente d'un pack vaut
 * au plus 40 % de son prix. Un consommable ne se revend pas (`valeurDe` = 0) ;
 * une malédiction non plus.
 */
{
  const lignes = [];
  let fuit = 0;
  for (const [k, P] of Object.entries(PACKS_CARTES)) {
    // Par carte : la rareté tirée (ses cotes), puis la valeur de la carte selon sa famille — la famille la plus chère du pack, pour majorer.
    const parRarete = r => Math.max(0, ...P.cats.flatMap(idsDe).filter(id => BANQUE[id].rarete === r).map(valeurDe));
    const esperance = P.n * Object.entries(P.cotes).reduce((a, [r, c]) => a + (c / 100) * parRarete(r), 0);
    lignes.push(`${P.nom} ${esperance.toFixed(1)}/${P.prix} 🪙 (${Math.round(100 * esperance / P.prix)} %)`);
    if (esperance > 0.4 * P.prix) fuit++;
    void k;
  }
  informer('revente attendue d\'un pack de cartes (sur son prix)', lignes.join(' · '));
  exiger('aucun pack de cartes ne se revend plus de 40 % de son prix', fuit === 0, `${fuit} pack(s) qui rapportent · VENTE ${Object.entries(VENTE).map(([r, v]) => `${r} ${v}`).join(', ')}`);
}
/* LE PACK DU JOUR N'EST JAMAIS VERROUILLÉ (1.0, J1-H) : soixante dates, des verrous, jamais un cadenas en vitrine. */
{
  const verrous = { 'j:ere80': 'verrou', 'j:etoiles': 'verrou', 'j:gardien': 'verrou', 'j:defensif': 'verrou', 'j:legendes': 'verrou' };
  const ouverts = Object.fromEntries(Object.keys(PACKS_TOUS).map(k => [k, verrous[k] || true]));
  const dates = Array.from({ length: 60 }, (_, i) => `2026-${1 + (i % 12)}-${1 + Math.floor(i / 2)}`);
  const tires = dates.map(d => packDuJour(d, ouverts).pack);
  const cadenas = tires.filter(k => ouverts[k] !== true);
  exiger('le pack du jour n\'est jamais un pack verrouillé, et il est pur (même date, même pack)', cadenas.length === 0 && tires.every((k, i) => packDuJour(dates[i], ouverts).pack === k) && new Set(tires).size > 5,
    `${new Set(tires).size} packs différents sur 60 dates · ${cadenas.length} cadenas`);
}
/* LES MALÉDICTIONS DU LOT ONT UN CONSOMMATEUR (1.0, J1-E) : la seule qui frappe à l'ouverture est un contrat (`plafondDe` la lit). */
{
  let vues = 0, mortes = 0;
  for (let n = 0; n < 500; n++) for (const cle of ['lot', 'contrats']) {
    for (const id of tirerCartesPack(cle, `lot-${n}`, n).filter(x => BANQUE[x].rarete === 'maudite')) {
      vues++;
      if (!CONTRATS[String(id).split(':')[1]]) mortes++;
    }
  }
  exiger('chaque malédiction tirée d\'un pack est un contrat, que le plafond applique', vues > 20 && mortes === 0, `${vues} malédictions sur 1 000 packs, ${mortes} sans consommateur`);
}

for (const l of lignesTaux) informer('mesuré (affiché)', l);
informer('durée', `${((Date.now() - t0) / 1000).toFixed(1)} s`);
/*
 * LA BANQUE SE COMPLÈTE (V2.2). Son dénominateur ne compte que ce qu'un pack peut donner (`sortDUnPack`) : chaque
 * carte tirée d'un pack en est, et aucune carte « hors pack » (les cartes de saison, les malédictions qui ne sont
 * pas la taxe du Pack Contrats) n'en sort jamais, sur des milliers d'ouvertures.
 */
{
  const tirees = new Set();
  for (const cle of Object.keys(PACKS_CARTES)) for (let n = 0; n < 400; n++) for (const id of tirerCartesPack(cle, `banque-${cle}`, n)) tirees.add(id);
  const horsPackTirees = [...tirees].filter(id => !sortDUnPack(id));
  exiger('aucune carte « hors pack » ne sort d\'un pack', horsPackTirees.length === 0, horsPackTirees.slice(0, 5).join(', ') || `${tirees.size} cartes différentes tirées`);
  const horsPack = Object.keys(BANQUE).filter(id => !sortDUnPack(id));
  exiger('les cartes de saison ne comptent pas au dénominateur', horsPack.some(id => BANQUE[id].cat === 'saison') && Object.keys(BANQUE).filter(id => BANQUE[id].cat === 'saison').every(id => !sortDUnPack(id)), `${horsPack.length} cartes se gagnent en jouant`);
  const jamais = Object.keys(BANQUE).filter(id => sortDUnPack(id) && !tirees.has(id));
  informer('cartes comptées qu\'on n\'a pas encore vu sortir', `${jamais.length} sur ${Object.keys(BANQUE).filter(sortDUnPack).length} (400 ouvertures par pack)`);
}

verdict('Les packs selon le niveau des joueurs');
