/*
 * LE PERSONNEL QUI MONTE (V14, js/echelons.js — docs/refonte-v14.md). JP : *le personnel, des cartes qui gagnent des
 * niveaux, avec leurs forces et leurs faiblesses, un look de jeu de gestion* ; *adapter à nos besoins de gestion et de gacha*.
 *   2. les chiffres d'un échelon : la carte telle quelle au premier ; pousser sa force grandit ses bons canaux de
 *      `POUSSEE`, corriger son défaut ramène ses mauvais de `CORRECTION` ; l'argent grandit comme une force ;
 *   3. les échelons : les matchs à ton service (`MATCHS_ECHELON`), doublés à la couleur du coach, bornés par les échelons
 *      ouverts (les doublons d'un pack, `ouvertsDe`), qui se gardent au méta ; un choix remplace la personne à son
 *      poste, garde d'où se comptent ses matchs, et la fin de saison les reporte ;
 *   4. le moteur, EN PAIRES (CLAUDE.md) : le même match sur les mêmes dés, sans la personne, à son premier échelon, à son
 *      cinquième (quatre poussées), et son défaut corrigé quatre fois ; l'écart sur sa force monte, celui sur son défaut
 *      fond.
 * `N` : matchs par club (300).
 */
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, SLOTS } from '../js/sim.js';
import { PATRONS, BANQUE } from '../js/banque.js';
import { effetDePalier } from '../js/coachs.js';
import { effetALEchelon, patronALEchelon, etatDuPersonnel, decisionDEchelon, reportDuPersonnel, ouvertsDe, matchsJoues,
  MATCHS_ECHELON, POUSSEE, CORRECTION, ECHELON_MAX } from '../js/echelons.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 300);
const presque = (a, b) => Math.abs(a - b) < 1e-6;

/* ---------- 2 : les chiffres d'un échelon ---------- */
{
  const k = 'per_gardienDuFort', P = PATRONS[k];   // defense 0,9 (sa force), volume 0,93 (son défaut)
  const base = effetALEchelon(k, []), f2 = effetALEchelon(k, ['force', 'force']), d1 = effetALEchelon(k, ['defaut']);
  exiger('au premier échelon, la carte telle quelle', presque(base.defense, P.effet.defense) && presque(base.volume, P.effet.volume));
  exiger('deux poussées : sa force grandit, son défaut ne bouge pas', presque(f2.defense, 1 + (P.effet.defense - 1) * (1 + 2 * POUSSEE)) && presque(f2.volume, P.effet.volume),
    `${P.effet.defense} → ${f2.defense}`);
  exiger('une correction : son défaut fond, sa force ne bouge pas', presque(d1.volume, 1 + (P.effet.volume - 1) * CORRECTION) && presque(d1.defense, P.effet.defense),
    `${P.effet.volume} → ${d1.volume}`);
  const caisse = effetALEchelon('per_caissier', ['force', 'force']), neg = effetALEchelon('per_negociateur', ['force']);
  exiger('l\'argent grandit comme une force', caisse.econ.jetonsVictoire === Math.round(PATRONS.per_caissier.econ.jetonsVictoire * (1 + 2 * POUSSEE))
    && presque(neg.econ.rabais, Math.round((1 - (1 - PATRONS.per_negociateur.econ.rabais) * (1 + POUSSEE)) * 1000) / 1000),
    `+${caisse.econ.jetonsVictoire} 🪙 par victoire · packs ×${neg.econ.rabais}`);
  const p = patronALEchelon(k, { choix: ['force', 'defaut'] });
  exiger('la décision porte son échelon, ses choix, son moment', p.echelon === 3 && p.choix.join() === 'force,defaut' && p.si === P.si && p.role === P.role);
}

/* ---------- 3 : les échelons ---------- */
{
  exiger('les doublons ouvrent les échelons : deux, puis un par copie, cinq au plus', [1, 2, 3, 4, 9].map(ouvertsDe).join() === '2,3,4,5,5');
  const k = 'per_gardienDuFort', couleur = BANQUE[`patron:${k}`].coach;   // la Tortue
  const engage = [{ jour: 0, coach: effetDePalier('essaim', 1) }, { jour: 3, patron: patronALEchelon(k, {}) }];
  const etat = (decs, n, copies = 4) => etatDuPersonnel(decs, 200, { joues: () => n, copies: () => copies })[0];
  const e9 = etat(engage, 9), e10 = etat(engage, 10);
  exiger(`le 2e échelon à ${MATCHS_ECHELON[2]} matchs à ton service`, !e9.aChoisir && e10.aChoisir && e10.qui === PATRONS[k].nom, `${e9.service} → ${e10.service}`);
  const ferme = etat(engage, 30, 1);
  exiger('un échelon fermé attend son doublon', ferme.aChoisir && ferme.echelon === 1 && etat([...engage, { jour: 50, ...decisionDEchelon(ferme, 'force') }], 30, 1).ferme);
  const tortue = [{ jour: 0, coach: effetDePalier(couleur, 1) }, engage[1]];
  exiger('à la couleur du coach, deux fois plus vite', etat(tortue, 5).service === 10 && etat(tortue, 5).double && !etat(engage, 5).double);
  const monte = [...engage, { jour: 40, ...decisionDEchelon(e10, 'force') }];
  const apres = etat(monte, 10);
  exiger('un choix remplace la personne à son poste, et garde d\'où se comptent ses matchs', apres.echelon === 2 && !apres.aChoisir && apres.depuis === 3
    && etatDuPersonnel(monte, 200, { joues: () => 0 }).length === 1);
  const rep = reportDuPersonnel(etat(monte, 30));
  exiger('la fin de saison reporte ses matchs à ton service', rep.avant === 30 && rep.depuis === 0 && rep.echelon === 2);
  const toutEnHaut = MATCHS_ECHELON[ECHELON_MAX];
  exiger(`le 5e échelon à ${toutEnHaut} matchs`, etat([{ jour: 0, patron: patronALEchelon(k, { choix: ['force', 'force', 'force'] }) }], toutEnHaut).aChoisir);
  // Le calendrier : seuls tes matchs joués comptent.
  const A = {}, B = {}, cal = [[{ A, B, gfA: 2, gfB: 1 }], [{ A: B, B: {}, gfA: 1, gfB: 0 }], [{ A: B, B: A }]];
  exiger('ses matchs à ton service : les tiens, joués', matchsJoues(cal, A, 0, 3) === 1 && matchsJoues(cal, B, 0, 3) === 2 && matchsJoues(cal, B, 1, 2) === 1);
}

/* ---------- 4 : le moteur, en paires ---------- */
const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
function match(toi, adv, graine, visiteur) {
  for (const t of [toi, adv]) { for (const sl of SLOTS) { const p = t.roster[sl.i]; if (p) p.energie = 100; } if (t.injured) t.injured.clear(); t.jourCourant = 0; }
  grainerHasard(graine);
  const f = feuilleVierge();
  const r = visiteur ? playGame(adv, toi, 1, false, false, f) : playGame(toi, adv, 1, false, false, f);
  const moi = visiteur ? 'B' : 'A';
  const somme = a => (a || []).reduce((x, y) => x + y, 0);
  return { v: r.winner === toi ? 1 : 0, gf: visiteur ? r.gfB : r.gfA, ga: visiteur ? r.gfA : r.gfB, tp: somme(f.tirs && f.tirs[moi]) };
}
/* Une personne d'un lieu : sa force et son défaut, lus sur ce qu'un soir montre. */
const LIRE = { tirs: S => S.tp / S.n, pct: S => (100 * S.gf) / S.tp, contre: S => S.ga / S.n };
const MOT = { tirs: 'tir par soir', pct: 'point de % au tir', contre: 'but contre par soir' };
const MESURES = [
  { cle: 'per_crieurDuBanc', force: ['tirs', 1], defaut: ['pct', 1] },        // volume 1,08 · finition 0,97
  { cle: 'per_gardiensDeRoute', force: ['contre', -1], defaut: ['tirs', 1] }, // defense 0,96 · volume 0,97
];
const f2 = x => (x >= 0 ? '+' : '') + x.toFixed(2).replace('.', ',');
for (const M of MESURES) {
  const P = PATRONS[M.cle], visiteur = P.si === 'visiteur';
  const vide = () => ({ n: 0, v: 0, gf: 0, ga: 0, tp: 0 });
  const bras = { sans: [], un: [], force: ['force', 'force', 'force', 'force'], defaut: ['defaut', 'defaut', 'defaut', 'defaut'] };
  const S = Object.fromEntries(Object.keys(bras).map(k => [k, vide()]));
  for (const [lab, s, t] of TEMOINS) {
    const un = equipeReelle(s, t);
    for (let i = 0; i < N; i++) {
      for (const [k, choix] of Object.entries(bras)) {
        grainerHasard(`personnel:${lab}:toi`); const toi = equipe('Toi', t, un, s);
        grainerHasard(`personnel:${lab}:eux`); const adv = equipe('Eux', t, un, s);
        if (k !== 'sans') toi.patrons = [patronALEchelon(M.cle, { choix })];
        const r = match(toi, adv, `personnel:${lab}:${M.cle}:${i}`, visiteur);
        S[k].n++; for (const x of ['v', 'gf', 'ga', 'tp']) S[k][x] += r[x];
      }
    }
  }
  const ecart = (k, canal) => LIRE[canal](S[k]) - LIRE[canal](S.sans);
  const [cf, sf] = M.force, [cd, sd] = M.defaut;
  exiger(`${P.ico} ${P.nom} : ses quatre poussées grandissent sa force (${cf})`, sf * ecart('force', cf) > sf * ecart('un', cf) && sf * ecart('un', cf) > 0,
    `${f2(ecart('un', cf))} → ${f2(ecart('force', cf))} ${MOT[cf]}`);
  exiger(`${P.ico} ${P.nom} : ses quatre corrections font fondre son défaut (${cd})`, Math.abs(ecart('defaut', cd)) < Math.abs(ecart('un', cd)),
    `${f2(ecart('un', cd))} → ${f2(ecart('defaut', cd))} ${MOT[cd]}`);
  informer(`${P.ico} ${P.nom} : en victoires, sur ses soirs d'une saison`, `échelon 1 ${f2(((S.un.v - S.sans.v) / S.sans.n) * 41)} V · quatre poussées ${f2(((S.force.v - S.sans.v) / S.sans.n) * 41)} V`);
}

verdict('le personnel qui monte');
