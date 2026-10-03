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
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, effetsDesCartes, originesDe, PLANS_ADV, simulerGrosMatch, playRonde, appliquerDecisionSerie, depistageDe, planDuDepistage } from '../js/sim.js';
import { CARTES_MATCH, DECK_DEPART, deckDe, mainDuMatch, recompensesOffertes, energieDepensee, ENERGIE_MAIN, mainAdverse, OPTIONS_COMBAT, energieAdverse, MATCH_ADVERSE_FORT, coutDe, mainDeLAdjoint } from '../js/combat.js';
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
    // Le bonus d'une carte de joueur appartient à la carte (sa clé, sa variante, son numéro), pas à la graine de la partie.
    const a = carteDe('rare', false, '1991_BUF_8448208', 'rare', 0), b = carteDe('rare', false, '1991_BUF_8448208', 'rare', 0);
    const n1 = carteDe('legendaire', false, '1991_BUF_8448208', 'legendaire', 1), n2 = carteDe('legendaire', false, '1991_BUF_8448208', 'legendaire', 2);
    exiger('la même carte a le même dos d\'une run à l\'autre ; deux ors numérotées différentes ont des bonus différents',
      JSON.stringify(a) === JSON.stringify(b) && a.bonus.length === 1 && JSON.stringify(n1) !== JSON.stringify(n2) && n1.bonus.length === 2,
      `${a.bonus.map(x => x.cle).join('+')} · nº1 ${n1.bonus.map(x => x.cle).join('+')} · nº2 ${n2.bonus.map(x => x.cle).join('+')}`);
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
  const doute = effetsDesCartes(t, { jouees: [], enMain: ['doute'] }, 'x');
  exiger('une malédiction restée dans la main coûte', doute.effets.length === 1 && doute.effets[0].finition < 1, JSON.stringify(doute.effets[0] || {}));
}

/* ---------- 3b. les cartes d'origine (1.0) : même club, même franchise, même décennie, même âge ---------- */
{
  // Une vraie équipe est tout entière d'un club et d'une saison : elle déclenche chaque carte d'origine au maximum.
  const vraie = eq('DET 2001-02', 'DET', equipeReelle('2001-02', 'DET'), '2001-02');
  // La même, mélangée : un club par joueur, trois décennies par trio, aucun âge connu.
  const melange = eq('MIX', 'MIX', equipeReelle('2001-02', 'DET'), '2001-02');
  Object.values(melange.roster).forEach((p, i) => { if (p) { p.t = `Z${i}`; p.s = `${1970 + (i % 3) * 10}-${String(71 + (i % 3) * 10).slice(-2)}`; p.bd = null; } });
  const O = originesDe(vraie);
  // Le canal, le compteur et le seuil de chaque carte ; les CHIFFRES viennent de sa règle écrite, jamais d'ici.
  const REGLES = {
    coequipiers: { canaux: ['finition'], n: O.coequipiers },
    famille: { canaux: ['defense'], n: Math.max(0, O.franchise - 2) },
    decennie: { canaux: ['volume'], n: O.triosDecennie },
    vieilleGarde: { canaux: ['defense'], n: O.veterans },
    releve: { canaux: ['volume'], n: O.jeunes },
    ligneOrigine: { canaux: ['volume', 'finition'], n: Math.min(2, O.lignesOrigine), parLigne: true },
    dynastieClub: { canaux: ['finition', 'defense'], n: O.franchise >= 5 ? 1 : 0, seuil: true },
  };
  const origines = Object.keys(CARTES_MATCH).filter(k => CARTES_MATCH[k].origine && !k.endsWith('+'));
  exiger('les sept cartes d\'origine sont au deck, chacune avec sa version « + »', origines.length === 7 && origines.every(k => CARTES_MATCH[`${k}+`]), origines.join(' · '));
  const nombres = r => [...r.matchAll(/([+−-])(\d+(?:,\d+)?) %/g)].map(m => (m[1] === '+' ? 1 : -1) * Number(m[2].replace(',', '.')) / 100);
  const fautes = [];
  for (const k of origines) {
    const R = REGLES[k], C = CARTES_MATCH[k], nb = nombres(C.regle);
    const fx = effetsDesCartes(vraie, { jouees: [k] }, 'x').effets.filter(e => e.nom === C.nom);
    const vide = effetsDesCartes(melange, { jouees: [k] }, 'x').effets.filter(e => e.nom === C.nom);
    if (!fx.length) { fautes.push(`${k} : muette sur une vraie équipe`); continue; }
    if (vide.length) fautes.push(`${k} : active sans sa condition`);
    // Attendu : par unité × compteur, sous le plafond « jusqu'à » (règle simple) ; un bonus par canal (règle à deux canaux).
    const attendu = R.canaux.length === 1
      ? { [R.canaux[0]]: 1 + Math.sign(nb[0]) * Math.min(Math.abs(nb[1]), Math.abs(nb[0]) * R.n) }
      : Object.fromEntries(R.canaux.map((c, j) => [c, 1 + nb[j] * (R.seuil ? 1 : R.n)]));
    for (const [c, v] of Object.entries(attendu)) if (Math.abs((fx[0][c] ?? 1) - v) > 1e-9) fautes.push(`${k} : ${c} ${fx[0][c]} au lieu de ${v} (règle « ${C.regle} »)`);
  }
  exiger('chaque carte d\'origine joue exactement les chiffres de sa règle, sous son plafond, et rien sans sa condition', fautes.length === 0,
    fautes.join(' · ') || `${origines.length} cartes · ${JSON.stringify(O)}`);
  // L'adversaire ne les joue pas : une vraie équipe les aurait toutes au maximum, tous les soirs.
  let vues = 0;
  for (let i = 0; i < 400; i++) vues += mainAdverse('adv', `j${i}`).filter(c => CARTES_MATCH[c] && CARTES_MATCH[c].origine).length;
  exiger('la main adverse ne pige jamais une carte d\'origine', vues === 0, `${vues} sur 400 mains`);
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
    const decs = [{ jour: J, equipe: 0, main: { jouees: ['coach', 'bloquer', 'changements'] }, sel: 'm1' }];
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
    // 5. Le coach dans leur tête (la vidéo n'abat plus leur plan depuis S76) : le MÊME match, avec et sans lui. Sans son plan, l'adversaire
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
    if (!tacPlan) informer('le coach dans leur tête', `plan ${m.plan} sans tactique de ligne à faire tomber`);
    else {
      const a = compte(sans), b = compte(avec);
      exiger('« Le coach dans leur tête » fait tomber leur plan : moins de leurs lancers portent sa tactique', m.cartes.lu && b.plan / Math.max(1, b.n) <= a.plan / Math.max(1, a.n),
        `en ${tacPlan} : ${a.plan} sur ${a.n} sans le coach, ${b.plan} sur ${b.n} avec`);
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
  const juste = g({ prep: plan }), rate = g({ prep: faux }), rien = g({}), revele = g({ prep: faux, cartes: { jouees: ['filature'] } }), deux = g({ prep: [faux, plan], cartes: { jouees: ['contrePlan'] } }), un = g({ prep: [faux, plan] });
  exiger('préparation juste : leur plan tombe ; fausse : il reste, et ça coûte ; rien : rien', juste.prepJuste === true && juste.contre && rate.prepJuste === false && rien.prepJuste === null
    && juste.cartesJouees && juste.cartesJouees.prepJuste === true && juste.cartesJouees.plan === plan,
    `juste ${juste.prepJuste} · fausse ${rate.prepJuste} · rien ${rien.prepJuste}`);
  exiger('« La filature » vise juste à coup sûr ; « Le plan B » couvre deux pistes, sans lui une seule', revele.prepJuste === true && deux.prepJuste === true && un.preparation.length === 1,
    `filature ${revele.prepJuste} · plan B ${deux.preparation.join('+')} ${deux.prepJuste} · sans plan B ${un.preparation.join('+')}`);

  // Le coût au rabais, les combos, leur main, le réservoir vide.
  const t = L[0];
  const elan = effetsDesCartes(t, { jouees: ['elan', 'lancer', 'partout'] }, 'x').effets.find(e => e.nom === CARTES_MATCH.elan.nom);
  const riposte = effetsDesCartes(t, { jouees: ['riposte'] }, 'x', { mainAdv: ['lancer', 'partout', 'bloquer'] }).effets.find(e => e.nom === CARTES_MATCH.riposte.nom);
  const vide = effetsDesCartes(t, { jouees: ['toutOuRien', 'miracle'] }, 'x').effets.some(e => e.nom === CARTES_MATCH.toutOuRien.nom);
  const pasVide = effetsDesCartes(t, { jouees: ['toutOuRien', 'lancer'] }, 'x').effets.some(e => e.nom === CARTES_MATCH.toutOuRien.nom);
  exiger('les combos se comptent : l\'élan par carte d\'attaque, la riposte par carte d\'attaque de leur main, tout ou rien sur un réservoir vide',
    !!elan && Math.abs(elan.volume - 1.09) < 1e-9 && !!riposte && Math.abs(riposte.defense - 0.92) < 1e-9 && vide && !pasVide,
    `élan ${elan && elan.volume.toFixed(2)} · riposte ${riposte && riposte.defense.toFixed(2)} · vide ${vide} · pas vide ${pasVide}`);
  exiger('le rabais : les cartes de défense coûtent 1 de moins avec « Le système défensif »', coutDe('bloquer', ['systemeDef']) === 0 && coutDe('bloquer', []) === 1
    && energieDepensee(['systemeDef', 'bloquer', 'gardienFeu']) === 3 - 1 - 0 - 1, `${energieDepensee(['systemeDef', 'bloquer', 'gardienFeu'])} d'énergie restante`);

  // Épuisée : jouée à un gros match, elle quitte le deck pour la suite — en séries, pour le match d'après.
  const avant = deckDe([{ jour: 3, recompense: 'grandSoir' }], { avant: 10 });
  const apres = deckDe([{ jour: 3, recompense: 'grandSoir' }, { jour: 6, main: { jouees: ['grandSoir'] } }], { avant: 10 });
  const serie = [{ ronde: 0, match_no: 1, main: { jouees: ['grandSoir'] } }];
  const s1 = deckDe([{ jour: 3, recompense: 'grandSoir' }], { serie, ronde: 0, k: 1 }), s2 = deckDe([{ jour: 3, recompense: 'grandSoir' }], { serie, ronde: 0, k: 2 });
  exiger('une carte épuisée quitte le deck après le match où on la joue', avant.includes('grandSoir') && !apres.includes('grandSoir') && s1.includes('grandSoir') && !s2.includes('grandSoir'),
    `avant ${avant.includes('grandSoir')} · après ${apres.includes('grandSoir')} · séries match 2 ${s1.includes('grandSoir')} · match 3 ${s2.includes('grandSoir')}`);

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
