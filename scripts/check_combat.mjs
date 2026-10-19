/*
 * LE DECK DE MATCH (S74) — ce qui doit tenir.
 *
 *   node scripts/check_combat.mjs
 *
 * JP : *prends vraiment inspiration d'un jeu de deckbuilder* ; *faut le faire
 * pour vrai*. On exige :
 *   1. le deck se déduit des décisions : départ, récompenses, retraits,
 *      malédiction d'un objectif raté ; la main est pure ;
 *   2. les récompenses : trois cartes différentes, jamais une malédiction ni
 *      une carte du départ, plus rares après une série ;
 *   3. chaque carte jouable fait QUELQUE CHOSE que le moteur lit (un canal,
 *      l'adversaire, son plan, tes lignes, l'énergie, un pari, une synergie)
 *      — une carte muette est une carte menteuse ;
 *   4. jouer une main dans un gros match change la feuille de CE match, et le
 *      rejeu la redonne à l'identique ;
 *   5. « La vidéo » fait VRAIMENT tomber leur plan : leurs deux premières
 *      lignes ne jouent plus la tactique du plan ;
 *   6. l'adversaire joue aussi sa main (connue d'avance) et « Leur cahier
 *      de jeux » l'annule ;
 *   7. le calibrage : sa main coûte des victoires, une main de départ bien
 *      jouée les rend — la difficulté des gros matchs ne bouge pas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, effetsDesCartes, PLANS_ADV, simulerGrosMatch, playRonde, appliquerDecisionSerie, depistageDe, planDuDepistage } from '../js/sim.js';
import { CARTES_MATCH, DECK_DEPART, deckDe, mainDuMatch, recompensesOffertes, energieDepensee, ENERGIE_MAIN, mainAdverse, OPTIONS_COMBAT, energieAdverse, MATCH_ADVERSE_FORT, mainDeLAdjoint } from '../js/combat.js';
import { carteDe } from '../js/rarete.js';
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

console.log('\n  Le deck de match (S74)\n');

/* ---------- 1 et 2. le deck, la main, les récompenses ---------- */
{
  const d = deckDe([
    { jour: 5, recompense: 'miracle' }, { jour: 9, retrait: 'lancerAuFilet' }, { jour: 12, palier: 'v:0', effet: { energie: 1.12 } },
    { jour: 50, recompense: 'legende' },
  ], { avant: 40 });
  exiger('le deck suit les décisions (récompense, retrait, malédiction, et rien après le jour demandé)',
    d.length === DECK_DEPART.length + 1 && d.includes('miracle') && !d.includes('lancerAuFilet') && d.includes('distraction') && !d.includes('legende'),
    d.join(' · '));
  const m1 = mainDuMatch('g', 'j30', DECK_DEPART), m2 = mainDuMatch('g', 'j30', DECK_DEPART), m3 = mainDuMatch('g', 'j31', DECK_DEPART);
  exiger('la main est pure : cinq cartes, le reste en pioche, dans le même ordre', JSON.stringify(m1) === JSON.stringify(m2) && m1.main.length === 5 && m1.pioche.length === 5, m1.main.join(' · '));
  exiger('et elle change d\'un match à l\'autre', JSON.stringify(m1) !== JSON.stringify(m3), m3.main.join(' · '));
  let fautes = 0; const rares = { saison: 0, serie: 0 };
  for (let g = 0; g < 300; g++) for (const serie of [false, true]) {
    const r = recompensesOffertes(`g${g}`, 'x', { serie });
    if (r.length !== 3 || new Set(r).size !== 3 || r.some(k => CARTES_MATCH[k].maudite || DECK_DEPART.includes(k))) fautes++;
    rares[serie ? 'serie' : 'saison'] += r.filter(k => CARTES_MATCH[k].rarete === 'rare').length;
  }
  exiger('une récompense : trois cartes différentes, jamais maudite ni du départ', fautes === 0, `${fautes} fautives sur 600`);
  exiger('plus rares après une série', rares.serie > 3 * rares.saison, `rares : ${rares.saison} en saison, ${rares.serie} en séries (sur 900 cartes chacun)`);
  // LES CARTES « + » (S74) : moitié plus fortes, ou une énergie de moins, et le camp les pose dans le deck.
  {
    const L = CARTES_MATCH.lancerAuFilet, P = CARTES_MATCH['lancerAuFilet+'], M = CARTES_MATCH['miracle+'];
    const plus = deckDe([{ jour: 1, aiguise: 'lancerAuFilet' }]);
    const toutes = Object.keys(CARTES_MATCH).filter(k => !CARTES_MATCH[k].maudite && !k.endsWith('+'));
    exiger('chaque carte a sa version « + », plus forte ou moins chère', toutes.every(k => CARTES_MATCH[`${k}+`])
      && P.effet.volume > L.effet.volume && M.cout < CARTES_MATCH.miracle.cout
      && plus.includes('lancerAuFilet+') && !plus.includes('lancerAuFilet'),
      `${toutes.length} versions · lancers ${L.effet.volume} → ${P.effet.volume.toFixed(2)} · miracle ${CARTES_MATCH.miracle.cout} → ${M.cout} énergie`);
  }
  exiger('l\'énergie se compte : trois, moins les coûts', energieDepensee(['miracle']) === 0 && energieDepensee(['lancer']) === 2 && ENERGIE_MAIN === 3, '');
  /*
   * LA CARTE DIT CE QUE LE MOTEUR JOUE (1.0, J1-G). Une carte « + » n'aggrave
   * jamais son inconvénient : sur chaque canal, la version + est à 1, ou plus
   * loin de 1 dans le bon sens seulement (l'inverse sur l'adversaire).
   */
  {
    const SENS = { finition: 1, volume: 1, robustesse: 1, defense: -1, energie: -1, discipline: -1, blessure: -1 };
    const pires = [];
    for (const [k, Cb] of Object.entries(CARTES_MATCH)) {
      if (Cb.maudite || k.endsWith('+')) continue;
      const P = CARTES_MATCH[`${k}+`];
      for (const [champ, cote] of [['effet', 1], ['adv', -1]]) {
        for (const [canal, v] of Object.entries(Cb[champ] || {})) {
          if (typeof v !== 'number' || !SENS[canal]) continue;
          const w = P[champ][canal];
          const bon = Math.sign(v - 1) === SENS[canal] * cote;
          if (bon ? Math.abs(w - 1) < Math.abs(v - 1) - 1e-9 : Math.abs(w - 1) > Math.abs(v - 1) + 1e-9) pires.push(`${k}+ ${champ}.${canal} ${v} → ${w}`);
        }
      }
    }
    exiger('une carte « + » n\'amplifie jamais son inconvénient', pires.length === 0, pires.join(' · ') || `${Object.keys(CARTES_MATCH).length / 2} cartes`);
    const T = CARTES_MATCH.tueur;
    exiger('« L\'instinct du tueur » ne joue que si on mène après deux périodes, et n\'a plus de malus caché',
      T.apres40 && T.apres40.siMene.finition > 1 && !Object.keys(T.apres40.sinon).length && !T.effet, JSON.stringify(T.apres40));
    // V2.4 : la carte d'un joueur n'est que sa variante — elle monte ses badges (js/sim.js `badgesDe`), aucun bonus tiré au hasard.
    exiger('la carte d\'un joueur n\'est que sa variante, sans bonus tiré au hasard', JSON.stringify(carteDe('rare')) === JSON.stringify({ rar: 'rare' })
      && !('bonus' in carteDe('legendaire')) && carteDe('nimporte').rar === 'commune', JSON.stringify(carteDe('legendaire')));
  }
}

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
      || fx.revele || fx.ecarte || fx.planB || fx.improvise || fx.piege || Cm.rabais || Cm.apres40
      // V11 : une carte sur un joueur (`joueur`) joue au duel, sur lui (js/sim.js `jouerDuel`).
      || Cm.joueur;
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
  const doute = effetsDesCartes(t, { jouees: [], enMain: ['doute'] }, 'x');
  exiger('une malédiction restée dans la main coûte', doute.effets.length === 1 && doute.effets[0].finition < 1, JSON.stringify(doute.effets[0] || {}));
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

/* ---------- 4, 5, 6. dans les feuilles ---------- */
{
  const graine = 'combat';
  const base = ligue(7400);
  simulateLeague(base, 82, { graine, decisions: [] });
  const gros = base[0].minisBoss || [];
  informer('gros matchs de la saison témoin', `${gros.length} · ${gros.filter(m => m.gagne).length} gagnés`);
  const J = gros.length ? gros[0].jour : null;
  if (J == null) informer('feuilles', 'aucun gros match cette saison : épreuve sautée');
  else {
    const avec = ligue(7400);
    const decs = [{ jour: J, equipe: 0, main: { jouees: ['leMur', 'lancerAuFilet', 'motDuCapitaine'] }, sel: 'm1' }];
    simulateLeague(avec, 82, { graine, decisions: decs });
    const m = avec[0].minisBoss.find(x => x.jour === J);
    const feuille = avec[0].journal.find(x => x.n === J + 1 || (x.feuille && x.feuille.cartes)) || null;
    exiger('la main jouée entre dans la feuille et dans ton histoire', !!(m && m.cartes && m.cartes.jouees.length === 3),
      m && m.cartes ? m.cartes.jouees.join(' · ') : 'rien');
    const rejeu = ligue(7400);
    simulateLeague(rejeu, 82, { graine, decisions: decs.map(d => ({ ...d })) });
    const f = x => `${x[0].W}-${x[0].L}-${x[0].OTL} ${x[0].GF}-${x[0].GA}`;
    exiger('le rejeu avec la même main redonne la même saison', f(avec) === f(rejeu), `${f(avec)} puis ${f(rejeu)}`);
    void feuille;
    // 5. « Le coach dans leur tête » est parti avec l'ancien deck (V10, tranche 6) : le duel répond à leurs intentions (check_duel).
  }
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
  /*
   * UN SEUL PLEIN ÉCRAN PAR MATCH DE SÉRIES (S74b) : l'ajustement et la main
   * partent en UNE décision. Le moteur doit appliquer les deux (l'effet de
   * l'ajustement ET les cartes de la main au match), et la ronde se rejouer
   * à l'identique avec la même décision.
   */
  {
    const serie = decs => {
      const L = ligue(7450);
      simulateLeague(L, 82, { graine: 'serie', decisions: [] });
      const top = L.slice().sort((a, b) => b.PTS - a.PTS).slice(0, 16);
      if (!top.includes(L[0])) top[15] = L[0];
      const paires = [];
      for (let i = 0; i < 8; i++) paires.push([top[i], top[15 - i]]);
      const toi = L[0];
      const r = playRonde(paires, 0, k2 => { toi.effetsSerie = []; for (const d of decs) if (d.ronde === 0 && d.match_no === k2) appliquerDecisionSerie(toi, d, 'serie'); }, 'serie');
      return r.find(x => x.A === toi || x.B === toi);
    };
    const d = [{ ronde: 0, match_no: 1, ajustement: 'rythme', main: { jouees: ['bloquer', 'lancer'], enMain: [] }, sel: 'combo' }];
    const a = serie(d), b = serie(d.map(x => ({ ...x })));
    const p1 = a.plans[1];
    exiger('l\'ajustement et la main partent ensemble, et la ronde se rejoue', !!(p1 && p1.cartes && p1.cartes.jouees.join() === 'bloquer,lancer')
      && JSON.stringify(a.feuilles.map(f => f.buts.length)) === JSON.stringify(b.feuilles.map(f => f.buts.length)),
      p1 && p1.cartes ? `match 2 : ${p1.cartes.jouees.join(' · ')} joués, série ${a.wA}-${a.wB} deux fois` : 'rien');
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
   * l'autre. Ici : le même match, sur les mêmes dés, sans cartes de part et
   * d'autre, avec leur main seule, et avec la tienne (trois cartes de départ).
   */
  {
    const L = ligue(9100), plans = Object.keys(PLANS_ADV), N = 3000;
    let sans = 0, eux = 0, deux = 0;
    for (let k = 0; k < N; k++) {
      const toi = L[k % 32], adv = L[(k * 7 + 3) % 32];
      const o = { plan: plans[k % plans.length], graine: 'calibrage', cle: `j${k}` };
      OPTIONS_COMBAT.adverses = false;
      sans += simulerGrosMatch(toi, adv, { ...o, cartes: { jouees: [] } }).gagne;
      OPTIONS_COMBAT.adverses = true;
      eux += simulerGrosMatch(toi, adv, { ...o, cartes: { jouees: [] } }).gagne;
      deux += simulerGrosMatch(toi, adv, { ...o, cartes: { jouees: ['bloquer', 'lancer', 'bloquer'] } }).gagne;
    }
    const pct = x => `${(x / N * 100).toFixed(1)} %`;
    informer('gros matchs isolés (victoires)', `${N} matchs : ${pct(sans)} sans cartes · ${pct(eux)} quand eux seuls jouent · ${pct(deux)} quand tu réponds avec trois cartes de départ`);
    exiger('leur main coûte des victoires, la tienne les rend', eux < sans && deux > eux, `${pct(sans)} → ${pct(eux)} → ${pct(deux)}`);
    borne('écart à la difficulté d\'avant avec une main de départ', (deux - sans) / N, -0.06, 0.06, '');
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

  // L'ADJOINT JOUE LA MAIN (1.0, J2-13) : jamais plus que l'élan, jamais une injouable, un pari ou une carte qui s'épuise.
  const toutes = Object.keys(CARTES_MATCH);
  let mainsA = 0, fautes = [], cartesA = 0;
  for (let k = 0; k < 600; k++) {
    const main = mainDuMatch(`adj${k}`, `po0:${k % 7}`, [...DECK_DEPART, ...toutes.filter((_, i) => (i * 7 + k) % 5 === 0)]).main;
    const { jouees, enMain } = mainDeLAdjoint(main);
    mainsA++; cartesA += jouees.length;
    const reste = main.slice();
    for (const c of jouees) { const i = reste.indexOf(c); if (i < 0) fautes.push(`${c} hors de la main`); else reste.splice(i, 1); }
    if (energieDepensee(jouees) < 0) fautes.push(`élan ${energieDepensee(jouees)} : ${jouees.join(',')}`);
    for (const c of jouees) if (CARTES_MATCH[c].injouable || CARTES_MATCH[c].pari || CARTES_MATCH[c].epuise || CARTES_MATCH[c].pioche) fautes.push(`${c} jouée`);
    if (enMain.some(c => !CARTES_MATCH[c].enMain)) fautes.push('enMain sans malédiction');
  }
  exiger('l\'adjoint joue sa main dans l\'élan, sans pari, pioche, carte injouable ou qui s\'épuise', !fautes.length && cartesA > mainsA,
    fautes.length ? fautes.slice(0, 3).join(' · ') : `${mainsA} mains, ${(cartesA / mainsA).toFixed(1)} carte(s) jouée(s) par main`);
}

verdict('Le deck de match');
