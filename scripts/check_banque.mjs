/**
 * LA BANQUE DE CARTES ET LES PACKS (S79) — ce que chaque carte promet, le
 * moteur le joue ; la saison se rejoue avec elles ; rien ne casse le jeu.
 *
 *   node scripts/check_banque.mjs            (LIGUES=4 par défaut)
 *   LIGUES=8 node scripts/check_banque.mjs   (une lecture plus fine)
 *
 * Vérifie :
 *   1. le registre : plus de 150 cartes, sept familles, une règle chiffrée
 *      pour chacune, une décision que le moteur (ou le plafond) lit ;
 *   2. les packs : des chances affichées pour chaque pack, des barèmes qui
 *      font 100 %, des tirages purs ; une malédiction ne sort que des packs
 *      qui l'affichent, à la cote affichée ;
 *   2b. LA MASSE SALARIALE (`plafondDe`) : l'espace, la taxe, le DG du
 *      plafond flexible, la retenue, le rachat, le LTIR — chacun au dollar ;
 *   3. le moteur : un patron entre dans \`team.patrons\` (saison ET séries,
 *      \`effetsDeSaison\`), un événement dans \`team.effets\`, un style sur la
 *      carte du joueur, une carte de match au deck, et un SOIN raccourcit
 *      vraiment une blessure ;
 *   4. la saison se rejoue au but près avec des cartes de toutes les familles ;
 *   5. l'équilibre, mesuré EN PAIRES (la même ligue deux fois sous la même
 *      graine, la carte aux équipes paires puis aux impaires — voir
 *      check_cartes.mjs). Une carte seule, à quatre ligues, se lit à ±0,5
 *      victoire près (plus pour un événement, qui rebrasse les dés) : sa borne
 *      attrape un cadeau ou un piège, pas du bruit. La MOYENNE d'une famille,
 *      elle, se lit serrée : les patrons valent de 0 à +1,5 victoire en
 *      moyenne (des reliques), les événements ±0,6 (des échanges).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, getPlayerKey, effetsDeSaison } from '../js/sim.js';
import { deckDe } from '../js/combat.js';
import { BANQUE, ORDRE_CATEGORIES, PATRONS, EVENEMENTS, CONTRATS, compteParCategorie, reglesDe, payloadDe, plafondDe } from '../js/banque.js';
import { PACKS_TOUS, TIERS, chancesDe, tirerCartesPack } from '../js/packs.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const LIGUES = Number(process.env.LIGUES ?? 4);
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || !un[2].length) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const signe = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const fiche = t => `${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`;

console.log('\n  La banque de cartes et les packs (S79)\n');

/* 1. Le registre. */
const compte = compteParCategorie();
const total = Object.keys(BANQUE).length;
informer('les cartes', `${total} en tout · ${ORDRE_CATEGORIES.map(c => `${c} ${compte[c]}`).join(' · ')}`);
exiger('plus de 150 cartes, dans sept familles', total >= 150 && ORDRE_CATEGORIES.length === 7 && ORDRE_CATEGORIES.every(c => compte[c] > 0), `${total}`);
const sansRegle = Object.keys(BANQUE).filter(id => BANQUE[id].cat !== 'match' && !reglesDe(id).length);
exiger('chaque carte dit sa règle', !sansRegle.length, sansRegle.slice(0, 5).join(', ') || 'toutes');
const chiffres = Object.keys(BANQUE).filter(id => ['patron', 'evenement', 'consommable', 'plafond'].includes(BANQUE[id].cat)).filter(id => !reglesDe(id).some(m => /\d/.test(m.txt)));
exiger('les patrons, événements, consommables et contrats se lisent en chiffres', !chiffres.length, chiffres.slice(0, 5).join(', ') || 'tous');
const CHAMPS = ['patron', 'effet', 'gestes', 'mutation', 'recompense', 'carte', 'retrait', 'aiguise', 'maitrise', 'gain', 'deck', 'plafond'];
const sansDecision = Object.keys(BANQUE).filter(id => {
  const p = payloadDe(id, { joueur: 'x', tactique: 'trappe', carte: 'lancer', patrons: [], alea: 0.2 });
  return !p || !Object.keys(p).some(k => CHAMPS.includes(k));
});
exiger('chaque carte devient une décision que le moteur (ou le plafond) lit', !sansDecision.length, sansDecision.slice(0, 5).join(', ') || 'toutes');

/* 2. Les packs. */
const sansChances = Object.keys(PACKS_TOUS).filter(k => !chancesDe(k).length);
exiger('chaque pack affiche ses chances', !sansChances.length, `${Object.keys(PACKS_TOUS).length} packs`);
exiger('les barèmes des tiers font 100 %', Object.values(TIERS).every(T => Math.abs(Object.values(T.cotes).reduce((a, b) => a + b, 0) - 100) < 1e-9), Object.keys(TIERS).join(' · '));
let impurs = 0, horsPlace = 0;
const maud = {};
const CLES_CARTES = Object.values(PACKS_TOUS).filter(P => P.sorte === 'cartes').map(P => P.cle);
const TIRS = 1500;
for (let n = 0; n < TIRS; n++) for (const k of CLES_CARTES) {
  const a = tirerCartesPack(k, `g${n}`, n);
  const m = a.map((id, i) => (BANQUE[id].rarete === 'maudite' ? i : -1)).filter(i => i >= 0);
  if (m.length) maud[k] = (maud[k] || 0) + 1;
  if (m.some(i => i !== a.length - 1)) horsPlace++;
  if (JSON.stringify(a) !== JSON.stringify(tirerCartesPack(k, `g${n}`, n))) impurs++;
}
exiger('un pack de cartes est pur', !impurs, `${impurs} impur(s) sur ${TIRS * CLES_CARTES.length} packs`);
const malAffiche = CLES_CARTES.filter(k => {
  const P = PACKS_TOUS[`c:${k}`], obs = (maud[k] || 0) / TIRS;
  return P.maudite ? Math.abs(obs - P.maudite) > 0.025 || !chancesDe(`c:${k}`).some(x => x.maudite) : obs > 0;
});
exiger('une malédiction ne sort que des packs qui l\'affichent, à leur cote, en dernière carte', !malAffiche.length && !horsPlace,
  CLES_CARTES.filter(k => PACKS_TOUS[`c:${k}`].maudite).map(k => `${k} ${(((maud[k] || 0) / TIRS) * 100).toFixed(1)} % (affiché ${PACKS_TOUS[`c:${k}`].maudite * 100} %)`).join(' · ') + (malAffiche.length ? ` — hors cote : ${malAffiche.join(', ')}` : ''));
informer('Pack Argent', chancesDe('j:hasard_argent').map(x => `${x.nom} ${x.txt}`).join(' · '));

/* 2b. La masse salariale : chaque carte de contrat, au dollar. */
{
  const base = 82_000_000;
  const d = (jour, id, o = {}) => ({ jour, ...payloadDe(id, o) });
  const pl = plafondDe([
    d(3, 'plafond:espace'), d(4, 'plafond:retenue', { joueur: 'A' }), d(5, 'plafond:rachat', { joueur: 'B' }),
    d(6, 'plafond:ltir', { joueur: 'C' }), d(7, 'plafond:entree', { joueur: 'D' }), d(8, 'plafond:bonis', { joueur: 'E' }),
    { jour: 9, achat: { sorte: 'cartes', maudites: ['plafond:taxe'] } },
    d(10, 'patron:dir_flexible', { patrons: [] }),
    d(50, 'plafond:grosEspace'),
  ], 20, { base });
  const attendu = base + 2e6 - 3e6 + Math.round(base * 0.05);
  exiger('l\'espace, la taxe de luxe et le DG du plafond flexible font le plafond au dollar', pl.cap === attendu,
    `${(pl.cap / 1e6).toFixed(2)} M$ (attendu ${(attendu / 1e6).toFixed(2)}) · ${pl.lignes.map(l => `${l.nom} ${l.montant > 0 ? '+' : ''}${(l.montant / 1e6).toFixed(1)}`).join(' · ')}`);
  const f = k => pl.facteurs.get(k);
  exiger('retenue ½, rachat ⅔, contrat d\'entrée 60 %, bonis 85 %, LTIR : chacun sur son joueur', f('A') === 0.5 && Math.abs(f('B') - 2 / 3) < 1e-9 && f('D') === 0.6 && f('E') === 0.85 && pl.ltir.has('C') && !pl.facteurs.has('C'),
    [...pl.facteurs].map(([k, v]) => `${k} ${Math.round(v * 100)} %`).join(' · ') + ` · LTIR ${[...pl.ltir].join(',')}`);
  exiger('une carte jouée plus tard ne compte pas encore', plafondDe([d(50, 'plafond:grosEspace')], 20, { base }).cap === base, 'La marge de manœuvre, jour 50, lue au jour 20');
  exiger('le rachat coûte ses jetons, dans la décision', (payloadDe('plafond:rachat', { joueur: 'B' }).plafond.cout || 0) === CONTRATS.rachat.cout, `${CONTRATS.rachat.cout} 🪙`);
  exiger('un contrat qui vise un joueur n\'existe pas sans lui', payloadDe('plafond:retenue') === null, 'retenue sans joueur : null');
}

/* 3. Le moteur. */
const t0 = ligue(79, 16), moi = t0[0];
const avant = SLOTS.filter(s => !s.scratch && s.group === 'F').map(s => moi.roster[s.i]).find(Boolean);
const decs = [
  { jour: 5, equipe: 0, ...payloadDe('patron:def_systeme', { patrons: [] }) },
  { jour: 10, equipe: 0, ...payloadDe('evenement:souper') },
  { jour: 12, equipe: 0, ...payloadDe('joueur:style_sniper', { joueur: getPlayerKey(avant) }) },
  { jour: 14, equipe: 0, ...payloadDe('match:feuSacre') },
  { jour: 16, equipe: 0, ...payloadDe('consommable:conge') },
];
simulateLeague(t0, 82, { graine: 'banque', decisions: decs });
const pat = (moi.patrons || []).find(x => x.cle === 'def_systeme');
exiger('un patron engagé joue pour la saison', !!pat && effetsDeSaison(moi).defense < 1, pat ? `buts contre ×${effetsDeSaison(moi).defense.toFixed(3)}` : 'absent');
exiger('un événement entre dans les effets de l\'équipe', (moi.effets || []).some(e => e.nom === EVENEMENTS.souper.nom), `${(moi.effets || []).length} effet(s)`);
exiger('un style change la carte du joueur', (avant._mutCles || []).includes('style_sniper'), avant.n);
exiger('une carte de match entre au deck', deckDe(decs).includes('feuSacre'), `${deckDe(decs).length} cartes`);

// UN SOIN RACCOURCIT UNE BLESSURE : une première saison dit qui se blesse et quand ; la même, avec un soin le lendemain, doit le rendre plus tôt.
let soinOk = null;
for (let s = 0; s < 6 && soinOk === null; s++) {
  const a = ligue(500 + s, 16), toi = a[0];
  simulateLeague(a, 82, { graine: `soin-${s}` });
  const b = (toi.injuriesLog || []).find(x => x.games >= 8 && x.jour != null && x.jour < 60);
  if (!b) continue;
  const cle = getPlayerKey(b.player), gp1 = b.player.simGP;
  const c = ligue(500 + s, 16);
  simulateLeague(c, 82, { graine: `soin-${s}`, decisions: [{ jour: b.jour + 1, equipe: 0, ...payloadDe('consommable:physio', { joueur: cle }) }] });
  const p2 = Object.values(c[0].roster).find(x => x && getPlayerKey(x) === cle);
  soinOk = { nom: b.player.n, games: b.games, gp1, gp2: p2 ? p2.simGP : 0 };
}
exiger('un soin rend un blessé plus tôt', soinOk && soinOk.gp2 > soinOk.gp1, soinOk ? `${soinOk.nom} (${soinOk.games} matchs) : ${soinOk.gp1} PJ puis ${soinOk.gp2} PJ avec la séance de physio` : 'aucune longue blessure trouvée');

/* 4. La saison se rejoue. */
const r1 = ligue(79, 16), r2 = ligue(79, 16);
simulateLeague(r1, 82, { graine: 'banque', decisions: decs });
simulateLeague(r2, 82, { graine: 'banque', decisions: decs });
exiger('la saison se rejoue au but près avec les cartes', fiche(r1[0]) === fiche(r2[0]) && r1.every((t, i) => fiche(t) === fiche(r2[i])), `${fiche(r1[0])} puis ${fiche(r2[0])}`);

/* 5. L'équilibre, en paires. */
function paires(fabrique) {
  const dv = [];
  for (let Lg = 0; Lg < LIGUES; Lg++) {
    const bras = [];
    for (const parite of [0, 1]) {
      const teams = ligue(2000 + Lg);
      const decisions = teams.map((_, i) => i).filter(i => i % 2 === parite).flatMap(equipe => fabrique(equipe));
      simulateLeague(teams, 82, { graine: `banque-${Lg}`, decisions });
      bras.push(teams.map(t => t.W));
    }
    for (let i = 0; i < 32; i++) dv.push(bras[i % 2 === 0 ? 0 : 1][i] - bras[i % 2 === 0 ? 1 : 0][i]);
  }
  return moy(dv);
}
console.log(`\n  ${LIGUES} ligues × 32 équipes, en paires\n`);
const hors = [];
const lignes = [];
const vp = [];
for (const cle of Object.keys(PATRONS)) {
  if (!PATRONS[cle].effet) continue;   // les patrons de la boutique (dépistage, direction) ne jouent pas sur la glace
  const v = paires(equipe => [{ jour: 0, equipe, ...payloadDe(`patron:${cle}`, { patrons: [] }) }]);
  lignes.push(`patron ${PATRONS[cle].nom} ${signe(v)} V`);
  vp.push(v);
  if (v < -1.5 || v > 3) hors.push(`${PATRONS[cle].nom} ${signe(v)}`);
}
const moyP = moy(vp);
for (const l of lignes) console.log(`  ${l}`);
exiger('aucun patron n\'est un cadeau ni un piège (−1,5 à +3 victoires)', !hors.length, hors.join(' · ') || `${lignes.length} patrons`);
exiger('en moyenne, un patron vaut de 0 à +1,5 victoire', moyP >= 0 && moyP <= 1.5, `${signe(moyP)} V`);
const horsE = [];
const lignesE = [];
const ve = [];
for (const cle of Object.keys(EVENEMENTS)) {
  const v = paires(equipe => [{ jour: 20, equipe, ...payloadDe(`evenement:${cle}`) }]);
  lignesE.push(`événement ${EVENEMENTS[cle].nom} ${signe(v)} V`);
  ve.push(v);
  if (v < -2.5 || v > 2.5) horsE.push(`${EVENEMENTS[cle].nom} ${signe(v)}`);
}
const moyE = moy(ve);
for (const l of lignesE) console.log(`  ${l}`);
exiger('aucun événement n\'est un cadeau ni un piège (±2,5 victoires)', !horsE.length, horsE.join(' · ') || `${lignesE.length} événements`);
exiger('en moyenne, un événement est un échange (±0,6 victoire)', Math.abs(moyE) <= 0.6, `${signe(moyE)} V`);

verdict();
