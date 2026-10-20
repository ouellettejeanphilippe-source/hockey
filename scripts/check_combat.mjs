/*
 * LA MAIN DE L'ADVERSAIRE (S74 ; V13-2) — ce qui doit tenir.
 *
 *   node scripts/check_combat.mjs
 *
 * Ta main de match est partie avec la main du duel (V13-2, docs/refonte-v13.md) ; l'adversaire d'un gros match qui
 * n'est pas un duel (le 82-0) joue encore la sienne, et son plan se dépiste. On exige :
 *   3. chaque carte qu'il peut jouer fait QUELQUE CHOSE que le moteur lit (un canal, toi, ses lignes, l'énergie, une
 *      synergie) — une carte muette est une carte menteuse ;
 *   6. sa main est connue d'avance, et c'est celle qu'il joue ;
 *   7. le calibrage : sa main coûte des victoires, et elle monte en fin de course ;
 *   8. le dépistage : trois pistes, la préparation juste, fausse ou rien.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, effetsDesCartes, PLANS_ADV, simulerGrosMatch, depistageDe, planDuDepistage } from '../js/sim.js';
import { CARTES_MATCH, mainAdverse, OPTIONS_COMBAT, energieAdverse, MATCH_ADVERSE_FORT } from '../js/combat.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, borne, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function ligue(seed) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < 32) {
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
  out[0].isPlayer = true;
  return out;
}

console.log('\n  La main de l\'adversaire (S74)\n');

/* ---------- 3. chaque carte fait quelque chose ---------- */
{
  const t = ligue(7400)[0];
  const muettes = [];
  for (const [k, Cm] of Object.entries(CARTES_MATCH)) {
    if (Cm.maudite) continue;
    // S76 : « Tout ou rien » se joue avec toute l'énergie dépensée, « La riposte » contre une main qui a de quoi.
    const jouees = Cm.siVide ? [k, 'miracle'] : [k];
    const fx = effetsDesCartes(t, { jouees }, 'x', { mainAdv: Cm.selonLeurMain ? ['lancer', 'bloquer', 'trappe', 'echecAvant'] : [] });
    const siens = fx.effets.filter(e => e.nom === Cm.nom).length;
    // 1.0 : `apres40` se pose à la troisième période (js/sim.js), pas à l'avant-match — la carte n'est pas muette pour autant.
    const fait = siens || fx.adv.length || fx.lire || fx.contre || fx.annule || fx.energieTous || Cm.pioche || Cm.energiePlus
      || fx.revele || fx.ecarte || fx.planB || fx.improvise || fx.piege || Cm.rabais || Cm.apres40;
    if (!fait) muettes.push(k);
  }
  const synergies = Object.keys(CARTES_MATCH).filter(k => CARTES_MATCH[k].synergie);
  informer('les synergies de cette formation', synergies.map(k => `${CARTES_MATCH[k].ico} ${k} ${effetsDesCartes(t, { jouees: [k] }, 'x').effets.length ? 'active' : 'rien ici'}`).join(' · '));
  // Une synergie peut ne rien donner à une formation qui n'a pas le profil : c'est le jeu, pas une carte muette.
  // Mais sur toute une ligue, chacune doit trouver son club (refonte 1 : « Le mur bleu » et « Les jambes » lisaient
  // des rôles disparus en S79 et ne se déclenchaient jamais).
  const clubs = ligue(7400);
  const jamais = synergies.filter(k => !clubs.some(c => effetsDesCartes(c, { jouees: [k] }, 'x').effets.length));
  exiger('chaque synergie se déclenche pour au moins un club de la ligue', jamais.length === 0, jamais.join(' · ') || `${synergies.length} synergies, ${clubs.length} clubs`);
  const vraiesMuettes = muettes.filter(k => !CARTES_MATCH[k].synergie);
  exiger('chaque carte jouable fait quelque chose que le moteur lit', vraiesMuettes.length === 0, vraiesMuettes.join(' · ') || `${Object.keys(CARTES_MATCH).length} cartes`);
}

/* ---------- 3b. les cartes d'origine (1.0) : parties avec l'ancien deck (V10, tranche 6). ---------- */

/* ---------- 3c. l'écran dit les synergies en chiffres de match (`quand`, `plein`) : `plein` est le maximum de leur règle écrite ---------- */
{
  const CANAL = { 'précision': 'finition', 'tirs': 'volume', 'buts contre': 'defense' };
  const synergies = Object.entries(CARTES_MATCH).filter(([k, C]) => C.synergie && !k.endsWith('+'));
  const fautes = [];
  for (const [k, C] of synergies) {
    const jusqua = C.regle.match(/jusqu'à ([+−])(\d+) %/), jetons = [...C.regle.matchAll(/(précision|tirs|buts contre) ([+−])(\d+) %/gi)];
    const valeur = (signe, n) => 1 + (signe === '+' ? 1 : -1) * Number(n) / 100;
    const attendu = jusqua ? { [CANAL[jetons[0][1].toLowerCase()]]: valeur(jusqua[1], jusqua[2]) }
      : Object.fromEntries(jetons.map(m => [CANAL[m[1].toLowerCase()], 1 + (valeur(m[2], m[3]) - 1) * (/par ligne d'origine/.test(C.regle) ? 2 : 1)]));
    const dit = C.plein || {};
    if (!C.quand) fautes.push(`${k} : pas de condition (quand)`);
    if (JSON.stringify(Object.keys(attendu).sort()) !== JSON.stringify(Object.keys(dit).sort()) || Object.keys(attendu).some(c => Math.abs(attendu[c] - dit[c]) > 1e-9)) fautes.push(`${k} : plein ${JSON.stringify(dit)} au lieu de ${JSON.stringify(attendu)} (règle « ${C.regle} »)`);
    if (!C.regle.includes('jusqu\'à') && !C.seuil && !/par ligne d'origine/.test(C.regle)) fautes.push(`${k} : une règle sans « jusqu'à » est tout ou rien (seuil)`);
  }
  exiger('chaque synergie se dit en chiffres de match : son maximum (`plein`) est celui de sa règle écrite', fautes.length === 0, fautes.join(' · ') || `${synergies.length} cartes`);
}

/* ---------- 6 et 7. dans les feuilles ---------- */
{
  const graine = 'combat';
  // 6. Leur main : connue d'avance, jouée, et annulée par « Leur cahier de jeux ».
  {
    const b0 = ligue(7400);
    simulateLeague(b0, 82, { graine, decisions: [] });
    const m0 = (b0[0].minisBoss || [])[0];
    const prevue = m0 ? mainAdverse(graine, `j${m0.jour}`) : [];
    exiger('l\'adversaire joue la main que l\'écran annonce', !!(m0 && m0.cartes && JSON.stringify(m0.cartes.adverses) === JSON.stringify(prevue) && prevue.length),
      m0 && m0.cartes ? `annoncée ${prevue.join(' · ')}, jouée ${(m0.cartes.adverses || []).join(' · ')}` : 'rien');
    // V10 (tranche 6) : « Leur cahier de jeux » est parti avec l'ancien deck ; leur main se contre au duel (check_duel).
  }
  // L'ÉNERGIE ADVERSE MONTE AVEC LA COURSE (S74b) : quatre en fin de saison et en fin de séries.
  {
    const cout = m => m.reduce((a, c) => a + CARTES_MATCH[c].cout, 0);
    let c3 = 0, c4 = 0;
    for (let g = 0; g < 200; g++) { c3 += cout(mainAdverse(`e${g}`, 'j1', 3)); c4 += cout(mainAdverse(`e${g}`, 'j1', 4)); }
    exiger('l\'adversaire joue plus fort en fin de course', energieAdverse({ nMatch: 10 }) === 3 && energieAdverse({ nMatch: MATCH_ADVERSE_FORT }) === 4
      && energieAdverse({ serie: true, ronde: 0 }) === 3 && energieAdverse({ serie: true, ronde: 2 }) === 4 && c4 > c3 * 1.25,
      `énergie dépensée : ${(c3 / 200).toFixed(2)} à trois, ${(c4 / 200).toFixed(2)} à quatre`);
  }
  /*
   * 7. LE CALIBRAGE, SUR DES GROS MATCHS ISOLÉS (simulerGrosMatch). Sur des
   * saisons entières il ne restait qu'une vingtaine de gros matchs appariés
   * — un gros match dépend du classement de la veille, et chaque décision
   * déplace les suivants — et l'écart sautait de 9 points d'une exécution à
   * l'autre. Ici : le même match, sur les mêmes dés, sans leur main, puis avec.
   */
  {
    const L = ligue(9100), plans = Object.keys(PLANS_ADV), N = 3000;
    let sans = 0, eux = 0;
    for (let k = 0; k < N; k++) {
      const toi = L[k % 32], adv = L[(k * 7 + 3) % 32];
      const o = { plan: plans[k % plans.length], graine: 'calibrage', cle: `j${k}` };
      OPTIONS_COMBAT.adverses = false;
      sans += simulerGrosMatch(toi, adv, { ...o, cartes: { jouees: [] } }).gagne;
      OPTIONS_COMBAT.adverses = true;
      eux += simulerGrosMatch(toi, adv, { ...o, cartes: { jouees: [] } }).gagne;
    }
    const pct = x => `${(x / N * 100).toFixed(1)} %`;
    informer('gros matchs isolés (victoires)', `${N} matchs : ${pct(sans)} sans leur main · ${pct(eux)} quand ils la jouent`);
    exiger('leur main coûte des victoires', eux < sans, `${pct(sans)} → ${pct(eux)}`);
  }
}

/*
 * 8. LE DÉPISTAGE ET LES NOUVELLES MÉCANIQUES (S76). JP : *contrer, ça
 * devrait être un scouting de leur stratégie potentielles avec taux de
 * succès, qui fait que parfois, t'as chié ta préparation* ; *des maths plus
 * claires sur les effets* ; *les cartes manquent de variété*.
 */
{
  const L = ligue(9200);
  // Le rapport : trois pistes, 100 %, et leur plan en sort toujours — pur.
  let ok = true, favori = 0;
  const N = 400;
  for (let k = 0; k < N; k++) {
    const adv = L[(k * 5 + 1) % 32];
    const d = depistageDe('dep', `j${k}`, adv), d2 = depistageDe('dep', `j${k}`, adv);
    const plan = planDuDepistage('dep', `j${k}`, d);
    if (d.length !== 3 || d.reduce((a, x) => a + x.p, 0) !== 100 || JSON.stringify(d) !== JSON.stringify(d2) || !d.some(x => x.plan === plan) || d.some(x => x.p > 90)) ok = false;
    if (plan === d[0].plan) favori++;
  }
  exiger('le rapport de dépistage : trois pistes, 100 %, leur plan en sort, rien au-dessus de 90 %', ok, `${N} rapports`);
  borne('le favori du rapport est leur plan', favori / N * 100, 45, 75, ' %');

  // La préparation, sur le MÊME match : juste, fausse, rien — et ce que la feuille en garde.
  const toi = L[0], adv = L[9];
  const dep = depistageDe('prep', 'j1', adv), plan = planDuDepistage('prep', 'j1', dep);
  const faux = dep.find(x => x.plan !== plan).plan;
  const g = o => simulerGrosMatch(toi, adv, { plan, graine: 'prep', cle: 'j1', cartes: { jouees: [] }, ...o }).gros;
  const juste = g({ prep: plan }), rate = g({ prep: faux }), rien = g({});
  exiger('préparation juste : leur plan tombe ; fausse : il reste, et ça coûte ; rien : rien', juste.prepJuste === true && juste.contre && rate.prepJuste === false && rien.prepJuste === null
    && juste.cartesJouees && juste.cartesJouees.prepJuste === true && juste.cartesJouees.plan === plan,
    `juste ${juste.prepJuste} · fausse ${rate.prepJuste} · rien ${rien.prepJuste}`);

  // Les combos de leur main (l'élan, la riposte) : l'adversaire les joue encore (js/combat.js `adverse`).
  const t = L[0];
  const elan = effetsDesCartes(t, { jouees: ['elan', 'lancer', 'partout'] }, 'x').effets.find(e => e.nom === CARTES_MATCH.elan.nom);
  const riposte = effetsDesCartes(t, { jouees: ['riposte'] }, 'x', { mainAdv: ['lancer', 'partout', 'bloquer'] }).effets.find(e => e.nom === CARTES_MATCH.riposte.nom);
  exiger('les combos se comptent : l\'élan par carte d\'attaque, la riposte par carte d\'attaque de leur main',
    // Trois cartes d'attaque pour l'élan (lui, « Lancer », « Tirer de partout ») ; deux dans leur main pour la riposte.
    !!elan && Math.abs(elan.volume - (1 + 3 * (CARTES_MATCH.elan.parGenre.effet.volume - 1))) < 1e-9
      && !!riposte && Math.abs(riposte.defense - (1 + 2 * (CARTES_MATCH.riposte.selonLeurMain.effet.defense - 1))) < 1e-9,
    `élan ${elan && elan.volume.toFixed(2)} · riposte ${riposte && riposte.defense.toFixed(2)}`);

  // Ce que la préparation vaut, sur des gros matchs isolés : juste > rien > fausse.
  const NN = 900;
  let vJ = 0, vR = 0, vF = 0;
  for (let k = 0; k < NN; k++) {
    const a = L[k % 32], b = L[(k * 7 + 3) % 32];
    const d = depistageDe('cal', `j${k}`, b), p = planDuDepistage('cal', `j${k}`, d);
    const o = { plan: p, graine: 'cal', cle: `j${k}`, cartes: { jouees: [] } };
    vR += simulerGrosMatch(a, b, o).gagne;
    vJ += simulerGrosMatch(a, b, { ...o, prep: p }).gagne;
    vF += simulerGrosMatch(a, b, { ...o, prep: d.find(x => x.plan !== p).plan }).gagne;
  }
  const pc = x => `${(x / NN * 100).toFixed(1)} %`;
  informer('la préparation (victoires)', `${NN} matchs : juste ${pc(vJ)} · rien ${pc(vR)} · fausse ${pc(vF)}`);
  exiger('viser juste vaut plus que ne rien préparer, qui vaut plus que se tromper', vJ > vR && vR > vF, `${pc(vJ)} > ${pc(vR)} > ${pc(vF)}`);
}

verdict('La main de l\'adversaire');
