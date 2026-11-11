/**
 * LES POCHETTES (S79 ; taillées à la V28, tranche 5b, docs/refonte-v28-5.md § 3.8) — les deux packs de joueurs que le
 * marché d'une run en carte vend (js/run.js `POCHETTES`, `acheterLaPochette`) : le Bronze, trois vrais joueurs de toutes
 * les époques ; l'Époque, un seul joueur d'une décennie, Pilier ou mieux.
 *
 * JP : *une variété de packs de cartes randoms digne de HUT, FUT ou MLB the show mobile […] avec des vrais pull rates de
 * cartes de hockey, pokemon, etc* ; puis : *on limite les packs, tout en gardant des thématiques*. La boutique de l'ancien
 * Rogue en vendait dix-huit (d'équipe, d'année, de décennie, par talent, le trio, les étoiles, les légendes, le garanti,
 * le club, le coach, les métaux qui montaient) : partis avec elle. Une sorte de pochette neuve se mesurera d'abord dans
 * la run, que les robots n'achètent pas encore.
 *
 * LE JOUEUR, PUIS SA FINITION (S80 ; JP : *packs selon les niveaux de joueurs, genre joueur moins bons plus fréquents*).
 * Une carte se tire sur deux axes indépendants, comme dans une vraie boîte : le JOUEUR, par son niveau dans sa vraie
 * saison (js/niveaux.js : Soutien, Régulier, Pilier, Étoile, Phénomène), puis l'ÉDITION de sa carte (js/rarete.js : Base,
 * Cadre, Hors-cadre, Or, Holo), au barème du métal. La Holo est numérotée, comme les parallèles des séries de luxe ; le
 * numéro est cosmétique. 1.0 — moins d'étoiles (JP : *les packs sont trop généreux en joueurs étoiles*) : une étoile ou
 * mieux dans un pack Bronze sur quarante.
 *
 * TOUT EST PUR : une pochette se tire de la graine de la run, de sa clé et du numéro de l'achat. Une run reprise garde
 * les joueurs de sa pochette ouverte (leurs clés, `R.portes.joueurs`).
 */
import { hache } from './util.js';
import { getPersonKey } from './sim.js';
import { NIVEAUX, groupeDuJoueur, joueursParNiveau, joueursHorsNiveau } from './niveaux.js';
import { statureDe, EDITIONS } from './rarete.js';

/* LE MÉTAL des deux pochettes, le Bronze : ce qu'une carte tire d'édition (`cotes`) et de niveau (`niveaux`), en %. */
export const METAL = {
  cotes: { commune: 84, peu: 11, hors: 3, rare: 1.8, legendaire: 0.2 },
  niveaux: { soutien: 51, regulier: 37, pilier: 11.15, etoile: 0.8, phenomene: 0.05 },
};
/* La numérotation d'une Holo (en % des Holo). */
const NUMEROS = [['/99', 78], ['/25', 16], ['/10', 5], ['1 de 1', 1]];
/*
 * LES DEUX POCHETTES, par leur clé de sauvegarde (`j:` : des joueurs). `n` : ses cartes ; `niveaux` : ses taux à elle, à
 * la place de ceux du métal ; `epoque` : elle pige dans une décennie ; `poste` : elle vise un groupe (`params.poste`).
 * Lot 5 (nov. 2026) : l'Époque, UN joueur, Pilier ou mieux, contre les trois au hasard du Bronze — le large contre le
 * fort ; à trois joueurs au même métal, les deux se valaient. Leurs prix vivent dans la run (js/run.js `RUN.POCHETTES`).
 */
export const PACKS_TOUS = {
  'j:bronze': { nom: 'Pack Bronze', ico: '🥉', n: 3 },
  'j:epoque': { nom: 'Pack Époque', ico: '📼', n: 1, niveaux: { pilier: 85, etoile: 13, phenomene: 2 }, epoque: true, poste: true },
};
const DECENNIES = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const POSTES = ['F', 'D', 'G'];

/* Les taux du joueur d'une pochette, par niveau, en % d'une carte ; un niveau absent vaut 0. */
export function niveauxDuPack(cle) {
  const P = PACKS_TOUS[cle];
  if (!P) return null;
  const t = P.niveaux || METAL.niveaux, tot = NIVEAUX.reduce((a, N) => a + (t[N.cle] || 0), 0) || 1;
  return Object.fromEntries(NIVEAUX.map(N => [N.cle, ((t[N.cle] || 0) / tot) * 100]));
}

/* ---------- les tirages ---------- */
/* Une édition tirée au barème du métal, et son numéro si c'est une Holo. */
function tirerVariante(...parts) {
  let r = hache('pack-var', ...parts) * 100, rar = EDITIONS[0], num = null;
  for (const k of EDITIONS) { r -= METAL.cotes[k] || 0; if (r < 0) { rar = k; break; } }
  if (rar === 'legendaire') {
    let x = hache('pack-num', ...parts) * 100;
    for (const [n, w] of NUMEROS) { x -= w; if (x < 0) { num = n; break; } }
    num = num || '/99';
  }
  return { rar, num };
}
/* La part des cartes Soutien qui viennent des joueurs sans niveau (Jalon P2b) : la chance d'un régulier bouge à peine. */
const PART_HORS_NIVEAU = 0.1;
/* Un niveau tiré aux taux de la pochette (son rang dans NIVEAUX), de la graine et de mots. */
function tirerNiveau(taux, ...parts) {
  let r = hache('pack-niveau', ...parts) * 100, dernier = 0;
  for (let k = 0; k < NIVEAUX.length; k++) {
    const w = taux[NIVEAUX[k].cle] || 0;
    if (w <= 0) continue;
    dernier = k;
    r -= w;
    if (r < 0) return k;
  }
  return dernier;
}
/*
 * LES JOUEURS D'UNE POCHETTE. PURS : de la graine, de la pochette et du numéro de l'achat ; le reste, le contrôleur le
 * fournit — `saisons` (les étiquettes « 1981-82 »), `shard(s)` (la saison chargée : { players }, au besoin async),
 * `libre(p)` (ce que la run permet : personne qu'elle a déjà vu), `params` ({ decennie, poste } : choisis, sinon tirés).
 * Chaque carte tire d'abord son NIVEAU, puis une saison, puis un joueur de ce niveau. Une saison sans joueur libre de ce
 * niveau en laisse essayer une autre ; après `ESSAIS_NIVEAU`, le niveau d'en dessous — jamais un meilleur tant qu'un moins
 * bon existe. Puis l'ÉDITION, par-dessus : la plus brillante va au joueur de plus grande stature (V5, js/rarete.js
 * `statureDe` : un holo dans un pack de Crosby et de deux Soutien, c'est le Crosby holo). Rend { cartes: [{ p, niveau,
 * rar, num }], reglage }.
 */
const ESSAIS_NIVEAU = 8;
export async function tirerJoueursDuPack(cle, { graine, n, params = {}, saisons: toutes, shard, libre = () => true }) {
  const P = PACKS_TOUS[cle], an = s => Number(String(s).slice(0, 4)), reglage = { ...params };
  let saisons = toutes.slice();
  // L'ÉPOQUE : la décennie choisie, ou une tirée parmi celles des données.
  if (P.epoque) {
    const decs = DECENNIES.filter(d => saisons.some(s => an(s) >= d && an(s) < d + 10));
    const dec = decs.includes(Number(reglage.decennie)) ? Number(reglage.decennie) : decs[Math.floor(hache(graine, 'pack-decennie', n) * decs.length)];
    reglage.decennie = dec;
    saisons = saisons.filter(s => an(s) >= dec && an(s) < dec + 10);
  }
  // LE POSTE : seulement des joueurs de ce groupe ; sans lui, tous.
  const poste = P.poste && POSTES.includes(reglage.poste) ? reglage.poste : null;
  if (P.poste) reglage.poste = poste;
  const taux = niveauxDuPack(cle), permis = NIVEAUX.map((N, k) => k).filter(k => taux[NIVEAUX[k].cle] > 0), essais = Math.min(ESSAIS_NIVEAU, saisons.length);
  const out = [], dispo = p => p && libre(p) && !out.some(x => getPersonKey(x.p) === getPersonKey(p));
  for (let c = 0; c < P.n && saisons.length; c++) {
    const voulu = tirerNiveau(taux, graine, cle, n, c);
    // Le niveau voulu, puis ceux d'en dessous, puis — en dernier recours — ceux d'au-dessus.
    const ordre = [...permis.filter(k => k <= voulu).reverse(), ...permis.filter(k => k > voulu)];
    let carte = null;
    for (const k of ordre) {
      for (let e = 0; e < essais && !carte; e++) {
        const sh = await shard(saisons[Math.floor(hache(graine, 'pack-saison', cle, n, c, k, e) * saisons.length)]);
        // TOUT SE PIGE : une carte Soutien sur `PART_HORS_NIVEAU` vient de ceux qui n'ont pas de niveau.
        const hors = k === 0 && hache(graine, 'pack-hors', cle, n, c, e) < PART_HORS_NIVEAU;
        const pool = (hors ? joueursHorsNiveau(sh.players) : joueursParNiveau(sh.players)[k]).filter(p => dispo(p) && (!poste || groupeDuJoueur(p) === poste));
        if (pool.length) carte = { p: pool[Math.floor(hache(graine, 'pack-joueur', cle, n, c, k, e) * pool.length)], niveau: k };
      }
      if (carte) break;
    }
    if (carte) out.push({ ...carte, ...tirerVariante(graine, cle, n, c) });
  }
  const ordre = out.map((x, i) => ({ i, s: statureDe(x.p, x.niveau) })).sort((a, b) => b.s - a.s || a.i - b.i).map(o => o.i);
  const vars = out.map(x => ({ rar: x.rar, num: x.num })).sort((a, b) => EDITIONS.indexOf(b.rar) - EDITIONS.indexOf(a.rar));
  ordre.forEach((i, k) => { out[i].rar = vars[k].rar; out[i].num = vars[k].num; });
  return { cartes: out, reglage };
}
