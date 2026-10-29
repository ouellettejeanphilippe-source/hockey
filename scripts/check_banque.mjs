/**
 * LA BANQUE DE CARTES ET LES PACKS (S79 ; V21) — ce que chaque carte promet, le moteur le joue ; la saison se rejoue
 * avec elles.
 *
 *   node scripts/check_banque.mjs
 *
 * V21 (docs/refonte-v21.md) : le personnel est parti ; la banque garde les cartes rares qui montent (les retouches, le
 * stage du coach, les soins, l'échange d'un doublon), une fois sur quatre dans un pack de joueurs. Les pouvoirs du
 * coach se mesurent dans check_pouvoirs. Vérifie :
 *   1. le registre : les deux familles qui restent, une règle pour chaque carte, une décision que le moteur lit ;
 *   2. les packs : des chances affichées pour chaque pack, des barèmes qui font 100 %, une carte rare pure ;
 *   2b. LA MASSE SALARIALE (`plafondDe`) : le contrat de télé et le rachat du dossier du proprio, au dollar ;
 *   3. le moteur : le stage monte l'expérience du coach, une histoire aussi, et un SOIN raccourcit vraiment une
 *      blessure ; une histoire sur un joueur tient sur lui ;
 *   4. la saison se rejoue au but près avec ces décisions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, getPlayerKey } from '../js/sim.js';
import { BANQUE, ORDRE_CATEGORIES, compteParCategorie, reglesDe, payloadDe, plafondDe } from '../js/banque.js';
import { DOSSIERS } from '../js/dossiers.js';
import { PACKS_TOUS, TIERS, chancesDe, tirerCartesDuPack, BOUTIQUE } from '../js/packs.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
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
const fiche = t => `${t.W}-${t.L}-${t.OTL} ${t.GF}-${t.GA}`;

console.log('\n  La banque de cartes et les packs (S79)\n');

/* 1. Le registre. */
const compte = compteParCategorie();
const total = Object.keys(BANQUE).length;
informer('les cartes', `${total} en tout · ${ORDRE_CATEGORIES.map(c => `${c} ${compte[c]}`).join(' · ')}`);
// V21 : le personnel est parti ; restent les retouches d'un joueur et les cartes rares qui montent ou soignent.
const tirables = ORDRE_CATEGORIES.reduce((a, c) => a + compte[c], 0);
exiger('deux familles, les retouches et les cartes rares, chacune garnie', ORDRE_CATEGORIES.join() === 'joueur,consommable' && ORDRE_CATEGORIES.every(c => compte[c] > 0) && tirables === total,
  `${tirables} cartes`);
const sansRegle = Object.keys(BANQUE).filter(id => !reglesDe(id).length);
exiger('chaque carte dit sa règle', !sansRegle.length, sansRegle.slice(0, 5).join(', ') || 'toutes');
const chiffres = Object.keys(BANQUE).filter(id => BANQUE[id].cat === 'consommable').filter(id => !reglesDe(id).some(m => /\d/.test(m.txt)));
exiger('les cartes rares se lisent en chiffres', !chiffres.length, chiffres.slice(0, 5).join(', ') || 'toutes');
const CHAMPS = ['effet', 'gestes', 'surJoueur', 'mutation', 'gain', 'xpCoach', 'ballottage'];
const sansDecision = Object.keys(BANQUE).filter(id => {
  const p = payloadDe(id, { joueur: 'x' });
  return !p || !Object.keys(p).some(k => CHAMPS.includes(k));
});
exiger('chaque carte devient une décision que le moteur (ou le méta) lit', !sansDecision.length, sansDecision.slice(0, 5).join(', ') || 'toutes');

/* 2. Les packs. */
const sansChances = Object.keys(PACKS_TOUS).filter(k => !chancesDe(k).length);
exiger('chaque pack affiche ses chances', !sansChances.length, `${Object.keys(PACKS_TOUS).length} packs`);
exiger('les barèmes des tiers font 100 %', Object.values(TIERS).every(T => Math.abs(Object.values(T.cotes).reduce((a, b) => a + b, 0) - 100) < 1e-9), Object.keys(TIERS).join(' · '));
let impurs = 0;
const TIRS = 1500;
for (let n = 0; n < TIRS; n++) for (const k of BOUTIQUE) {
  const a = tirerCartesDuPack(k, `g${n}`, n);
  if (JSON.stringify(a) !== JSON.stringify(tirerCartesDuPack(k, `g${n}`, n))) impurs++;
}
exiger('la carte rare d\'un pack est pure', !impurs, `${impurs} impur(s) sur ${TIRS * BOUTIQUE.length} packs`);
const sansMaudite = !Object.values(BANQUE).some(c => c.rarete === 'maudite');
exiger('aucune malédiction dans la banque (V16, tranche 6 : la taxe de luxe est partie avec la masse salariale)', sansMaudite);
informer('Pack Argent', chancesDe('j:hasard_argent').map(x => `${x.nom} ${x.txt}`).join(' · '));

/* 2b. La masse salariale (V16, tranche 6) : les réponses du dossier du proprio, au dollar, par la décision `plafond`. */
{
  const base = 82_000_000;
  const O = Object.fromEntries(DOSSIERS.laMasse.options.map(o => [o.cle, o]));
  const pl = plafondDe([
    { jour: 3, plafond: { nom: 'tele', ...O.tele.plafond } }, { jour: 4, plafond: { nom: 'rachat', ...O.rachat.plafond, joueur: 'B' } },
    { jour: 50, plafond: { nom: 'tard', espace: 5_000_000 } },
  ], 20, { base });
  const attendu = base + O.tele.plafond.espace;
  exiger('le contrat de télé fait le plafond au dollar', pl.cap === attendu,
    `${(pl.cap / 1e6).toFixed(2)} M$ (attendu ${(attendu / 1e6).toFixed(2)}) · ${pl.lignes.map(l => `${l.nom} ${l.montant > 0 ? '+' : ''}${(l.montant / 1e6).toFixed(1)}`).join(' · ')}`);
  exiger(`le rachat : ${Math.round(O.rachat.plafond.facteur * 100)} % sur son joueur, payé en jetons`, pl.facteurs.get('B') === O.rachat.plafond.facteur && O.rachat.gain < 0,
    [...pl.facteurs].map(([k, v]) => `${k} ${Math.round(v * 100)} %`).join(' · '));
  exiger('une décision prise plus tard ne compte pas encore', plafondDe([{ jour: 50, plafond: { espace: 5_000_000 } }], 20, { base }).cap === base);
}

/* 3. Le moteur. */
const t0 = ligue(79, 16), moi = t0[0];
const avant = SLOTS.filter(s => !s.scratch && s.group === 'F').map(s => moi.roster[s.i]).find(Boolean);
const decs = [
  { jour: 0, equipe: 0, coach: { cle: 'tortue', xp: 0, talents: [], adjoints: [] } },
  { jour: 5, equipe: 0, ...payloadDe('consommable:stage', {}) },
  { jour: 10, equipe: 0, moment: { famille: 'dossier', cle: 'laPratique', choix: 'systeme' }, xpCoach: 2 },
  { jour: 20, equipe: 0, moment: { famille: 'dossier', cle: 'ilBoude', choix: 'parler', joueur: getPlayerKey(avant), joueurs: [getPlayerKey(avant)] }, gain: -6 },
];
simulateLeague(t0, 82, { graine: 'banque', decisions: decs });
exiger('le stage et une histoire montent l\'expérience du coach', moi.perso && moi.perso.xp === payloadDe('consommable:stage', {}).xpCoach + 2, moi.perso ? `${moi.perso.xp} points d'avant, ${moi.xpSaison} de la saison` : 'pas de coach');
exiger('une histoire ne pose plus d\'effet sur l\'équipe', !(moi.effets || []).some(e => e.source === 'dossier'), `${(moi.effets || []).length} effet(s)`);
// V11 (tranche 4) : un dossier qui nomme un joueur pose sa réponse sur lui.
const boude = (moi.effetsCibles || []).find(e => e.nom === 'Il boude');
exiger('une histoire sur un joueur tient sur le joueur nommé', !!boude && getPlayerKey(boude.joueur) === getPlayerKey(avant) && boude.lancers > 1,
  boude ? `${boude.joueur.n} : tirs ×${boude.lancers}, ${boude.fin - boude.debut} jours` : 'absent');

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

verdict();
