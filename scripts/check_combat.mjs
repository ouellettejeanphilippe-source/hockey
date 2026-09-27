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
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, effetsDesCartes, PLANS_ADV, simulerGrosMatch } from '../js/sim.js';
import { CARTES_MATCH, DECK_DEPART, deckDe, mainDuMatch, recompensesOffertes, energieDepensee, ENERGIE_MAIN, mainAdverse, OPTIONS_COMBAT } from '../js/combat.js';
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
    { jour: 5, recompense: 'miracle' }, { jour: 9, retrait: 'lancer' }, { jour: 12, palier: 'v:0', effet: { energie: 1.12 } },
    { jour: 50, recompense: 'legende' },
  ], { avant: 40 });
  exiger('le deck suit les décisions (récompense, retrait, malédiction, et rien après le jour demandé)',
    d.length === DECK_DEPART.length + 1 && d.includes('miracle') && d.filter(c => c === 'lancer').length === 2 && d.includes('distraction') && !d.includes('legende'),
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
    const P = CARTES_MATCH['lancer+'], M = CARTES_MATCH['miracle+'];
    const plus = deckDe([{ jour: 1, aiguise: 'lancer' }]);
    const toutes = Object.keys(CARTES_MATCH).filter(k => !CARTES_MATCH[k].maudite && !k.endsWith('+'));
    exiger('chaque carte a sa version « + », plus forte ou moins chère', toutes.every(k => CARTES_MATCH[`${k}+`])
      && P.effet.volume > CARTES_MATCH.lancer.effet.volume && M.cout < CARTES_MATCH.miracle.cout
      && plus.includes('lancer+') && plus.filter(c => c === 'lancer').length === 2,
      `${toutes.length} versions · lancers ${CARTES_MATCH.lancer.effet.volume} → ${P.effet.volume.toFixed(2)} · miracle ${CARTES_MATCH.miracle.cout} → ${M.cout} énergie`);
  }
  exiger('l\'énergie se compte : trois, moins les coûts, plus l\'adrénaline', energieDepensee(['miracle']) === 0 && energieDepensee(['adrenaline', 'miracle', 'discours']) === 0 && ENERGIE_MAIN === 3, '');
}

/* ---------- 3. chaque carte fait quelque chose ---------- */
{
  const t = ligue(7400)[0];
  const muettes = [];
  for (const [k, Cm] of Object.entries(CARTES_MATCH)) {
    if (Cm.maudite) continue;
    const fx = effetsDesCartes(t, { jouees: [k] }, 'x');
    const fait = fx.effets.length || fx.adv.length || fx.lire || fx.contre || fx.annule || fx.energieTous || Cm.pioche || Cm.energiePlus;
    if (!fait) muettes.push(k);
  }
  const synergies = Object.keys(CARTES_MATCH).filter(k => CARTES_MATCH[k].synergie);
  informer('les synergies de cette formation', synergies.map(k => `${CARTES_MATCH[k].ico} ${k} ${effetsDesCartes(t, { jouees: [k] }, 'x').effets.length ? 'active' : 'rien ici'}`).join(' · '));
  // Une synergie peut ne rien donner à une formation qui n'a pas le profil : c'est le jeu, pas une carte muette.
  const vraiesMuettes = muettes.filter(k => !CARTES_MATCH[k].synergie);
  exiger('chaque carte jouable fait quelque chose que le moteur lit', vraiesMuettes.length === 0, vraiesMuettes.join(' · ') || `${Object.keys(CARTES_MATCH).length} cartes`);
  const doute = effetsDesCartes(t, { jouees: [], enMain: ['doute'] }, 'x');
  exiger('une malédiction restée dans la main coûte', doute.effets.length === 1 && doute.effets[0].finition < 1, JSON.stringify(doute.effets[0] || {}));
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
    const decs = [{ jour: J, equipe: 0, main: { jouees: ['video', 'bloquer', 'lancer'] }, sel: 'm1' }];
    simulateLeague(avec, 82, { graine, decisions: decs });
    const m = avec[0].minisBoss.find(x => x.jour === J);
    const feuille = avec[0].journal.find(x => x.n === J + 1 || (x.feuille && x.feuille.cartes)) || null;
    exiger('la main jouée entre dans la feuille et dans ton histoire', !!(m && m.cartes && m.cartes.jouees.length === 3 && m.cartes.lu),
      m && m.cartes ? `${m.cartes.jouees.join(' · ')}, plan ${m.plan} ${m.cartes.lu ? 'tombé' : 'debout'}` : 'rien');
    const rejeu = ligue(7400);
    simulateLeague(rejeu, 82, { graine, decisions: decs.map(d => ({ ...d })) });
    const f = x => `${x[0].W}-${x[0].L}-${x[0].OTL} ${x[0].GF}-${x[0].GA}`;
    exiger('le rejeu avec la même main redonne la même saison', f(avec) === f(rejeu), `${f(avec)} puis ${f(rejeu)}`);
    void feuille;
    // 5. La vidéo : le MÊME match, avec et sans elle. Sans son plan, l'adversaire
    // reprend ses lignes de la saison — qui peuvent jouer la même tactique que
    // le plan : on compte donc l'écart, pas un seuil.
    const P = PLANS_ADV[m.plan];
    const tacPlan = P && P.lignes && P.lignes[0] && P.lignes[0].tac;
    const sans = ligue(7400);
    simulateLeague(sans, 82, { graine, decisions: [{ jour: J, equipe: 0, main: { jouees: ['bloquer', 'lancer'] }, sel: 'm1' }] });
    const compte = x => {
      const fe = (x[0].journal.find(y => y.feuille && y.feuille.cartes) || {}).feuille;
      const adv = x.find(t => t.name === m.adv.name) || m.adv;
      const deLui = fe ? fe.lancers.filter(l => l.tireur && Object.values(adv.roster).includes(l.tireur) && l.tac) : [];
      return { n: deLui.length, plan: deLui.filter(l => l.tac === tacPlan).length };
    };
    if (!tacPlan) informer('la vidéo', `plan ${m.plan} sans tactique de ligne à faire tomber`);
    else {
      const a = compte(sans), b = compte(avec);
      exiger('« La vidéo » fait tomber leur plan : moins de leurs lancers portent sa tactique', m.cartes.lu && b.plan / Math.max(1, b.n) <= a.plan / Math.max(1, a.n),
        `en ${tacPlan} : ${a.plan} sur ${a.n} sans la vidéo, ${b.plan} sur ${b.n} avec`);
    }
  }
  // 6. Leur main : connue d'avance, jouée, et annulée par « Leur cahier de jeux ».
  {
    const b0 = ligue(7400);
    simulateLeague(b0, 82, { graine, decisions: [] });
    const m0 = (b0[0].minisBoss || [])[0];
    const prevue = m0 ? mainAdverse(graine, `j${m0.jour}`) : [];
    exiger('l\'adversaire joue la main que l\'écran annonce', !!(m0 && m0.cartes && JSON.stringify(m0.cartes.adverses) === JSON.stringify(prevue) && prevue.length),
      m0 && m0.cartes ? `annoncée ${prevue.join(' · ')}, jouée ${(m0.cartes.adverses || []).join(' · ')}` : 'rien');
    if (m0) {
      const b1 = ligue(7400);
      simulateLeague(b1, 82, { graine, decisions: [{ jour: m0.jour, equipe: 0, main: { jouees: ['espion'] }, sel: 'e1' }] });
      const m1 = b1[0].minisBoss.find(x => x.jour === m0.jour);
      exiger('« Leur cahier de jeux » annule leur main', !!(m1 && m1.cartes && m1.cartes.annulee), m1 && m1.cartes ? `annulée : ${m1.cartes.annulee}` : 'rien');
    }
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

verdict('Le deck de match');
