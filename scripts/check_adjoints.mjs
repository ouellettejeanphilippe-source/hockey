/*
 * LES ADJOINTS DU COACH (V13-3, js/adjoints.js — docs/refonte-v13.md). JP, 20 oct. : *chaque coach devrait avoir des
 * assistants coachs activables, avec effet et upgrades possibles*.
 *   1. le banc : deux adjoints par coach, ceux du personnel de sa couleur ; aucun ne sort d'un pack ;
 *   2. les chaises : une à la confiance I, deux à II et à III ; une chaise prise ferme l'activation ; monter coûte son
 *      prix en jetons (un gain négatif), jusqu'au dernier échelon ; sans jetons, rien ;
 *   3. le moteur, EN PAIRES (CLAUDE.md) : le même match sur les mêmes dés, sans l'adjoint, avec lui à l'échelon 1, avec
 *      lui à l'échelon 3. Son coach parti, la feuille est identique ; son coach en poste, l'écart sur son canal monte
 *      avec l'échelon, et l'échelon 1 reste sous la borne de sa rareté.
 * `N` : matchs par club et par adjoint (300).
 */
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, SLOTS } from '../js/sim.js';
import { PERSONNEL } from '../js/personnel.js';
import { BANQUE, patronsDeDepart } from '../js/banque.js';
import { PRESTIGES } from '../js/rogue.js';
import { COACHS, effetDePalier } from '../js/coachs.js';
import { PACKS_CARTES, tirerCartesDuPack } from '../js/packs.js';
import { ECHELONS, etatDuBanc, decisionDAdjoint, effetDeLAdjoint } from '../js/adjoints.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 300);
const BORNE_V = { commune: 1, peu: 1.5, rare: 2.5, legendaire: 4 };

/* ---------- 1 : le banc ---------- */
const bancs = {};
for (const c of Object.values(BANQUE)) if (c.adjoint) (bancs[c.adjoint] ||= []).push(c.cle);
exiger('deux adjoints par coach, du personnel de sa couleur', Object.keys(COACHS).every(k => (bancs[k] || []).length === 2 && bancs[k].every(c => PERSONNEL[c] && BANQUE[`patron:${c}`].coach === k)),
  Object.entries(bancs).map(([k, l]) => `${COACHS[k].ico} ${l.length}`).join(' · '));
{
  const sortis = new Set();
  for (const cle of Object.keys(PACKS_CARTES)) for (const coach of [null, ...Object.keys(COACHS)]) for (let g = 0; g < 12; g++)
    for (const id of tirerCartesDuPack(cle, `adj:${cle}:${coach}:${g}`, 5, coach ? { coach } : {})) if (BANQUE[id] && BANQUE[id].adjoint) sortis.add(id);
  exiger('aucun adjoint ne sort d\'un pack', !sortis.size, [...sortis].slice(0, 4).join(', ') || `${Object.keys(PACKS_CARTES).length} packs × ${Object.keys(COACHS).length + 1} coachs`);
}

{
  const imposes = PRESTIGES.flatMap((P, r) => Array.from({ length: 40 }, (_, k) => patronsDeDepart(`adj:${r}:${k}`, P.raretes))).flat();
  const adj = imposes.filter(id => BANQUE[id].adjoint);
  exiger('aucun adjoint n\'est imposé au départ d\'une run', !adj.length, adj.slice(0, 3).join(', ') || `${imposes.length} patrons imposés`);
}
/* ---------- 2 : les chaises et les échelons ---------- */
{
  const coach = 'essaim', [a, b] = bancs[coach];
  const au = palier => [{ jour: 0, coach: effetDePalier(coach, palier) }];
  const banc = (decs, caisse = Infinity) => etatDuBanc(decs, Infinity, caisse);
  exiger('sans coach en poste, pas de banc', banc([]) === null);
  exiger('les chaises : une à I, deux à II et à III', [1, 2, 3].map(p => banc(au(p)).chaises).join() === '1,2,2', [1, 2, 3].map(p => banc(au(p)).chaises).join(' · '));
  const un = [...au(1), { jour: 1, ...decisionDAdjoint(a, coach, 1) }];
  const B1 = banc(un, 0);
  exiger('à la confiance I, un adjoint assis ferme la chaise de l\'autre', B1.actifs === 1 && B1.adjoints.find(x => x.cle === b).non === 'Chaises prises', B1.adjoints.map(x => `${x.cle} ${x.non || 'libre'}`).join(' · '));
  exiger('activer est gratuit ; monter coûte son prix, en jetons', decisionDAdjoint(a, coach, 1).gain === undefined && decisionDAdjoint(a, coach, 2).gain === -ECHELONS[2].prix && decisionDAdjoint(a, coach, 3).gain === -ECHELONS[3].prix,
    ECHELONS.slice(1).map(e => `${e.prix} 🪙`).join(' · '));
  exiger('sans jetons, l\'adjoint ne monte pas', B1.adjoints.find(x => x.cle === a).non === 'Pas assez de jetons en caisse');
  const trois = [...un, { jour: 2, ...decisionDAdjoint(a, coach, 2) }, { jour: 3, ...decisionDAdjoint(a, coach, 3) }];
  const B3 = banc(trois);
  exiger('monter remplace l\'adjoint : une chaise, son dernier échelon', B3.actifs === 1 && B3.adjoints.find(x => x.cle === a).echelon === 3 && B3.adjoints.find(x => x.cle === a).non === 'Au dernier échelon');
  const B2 = banc([...au(2).map(d => ({ ...d, jour: 4 })), ...trois]);
  exiger('à la confiance II, la deuxième chaise s\'ouvre', B2.chaises === 2 && !B2.adjoints.find(x => x.cle === b).non);
  const autre = banc([...trois, { jour: 5, coach: effetDePalier('tortue', 1) }]);
  exiger('un autre coach en poste : son banc à lui, vide', autre.coach === 'tortue' && autre.actifs === 0);
}

/* ---------- 3 : le moteur, en paires ---------- */
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
/*
 * Les adjoints d'un lieu (à domicile, au loin) : leur moment se lit sans rien poser ; un par canal qu'un soir montre —
 * les tirs, le % au tir (le maître des tirs de route en échange : moins de tirs, mieux visés), les buts contre.
 */
const LIRE = { tirs: S => S.tp / S.n, pct: S => (100 * S.gf) / S.tp, contre: S => S.ga / S.n };
const UNITE = { tirs: 'tir par soir', pct: 'point de % au tir', contre: 'but contre par soir' };
const MESURES = [['per_crieurDuBanc', 'tirs', 1], ['per_tirsDeRoute', 'pct', 1], ['per_gardiensDeRoute', 'contre', -1]].filter(([c]) => PERSONNEL[c]);
const f2 = x => (x >= 0 ? '+' : '') + x.toFixed(2).replace('.', ',');
for (const [cle, canal, sens] of MESURES) {
  const P = PERSONNEL[cle], coach = BANQUE[`patron:${cle}`].coach, rarete = BANQUE[`patron:${cle}`].rarete;
  const vide = () => ({ n: 0, v: 0, gf: 0, ga: 0, tp: 0 });
  const S = { a: vide(), b1: vide(), b3: vide() };
  let part = 0, pareil = 0;
  for (const [lab, s, t] of TEMOINS) {
    const un = equipeReelle(s, t);
    for (let i = 0; i < N; i++) {
      const visiteur = P.si === 'visiteur';
      const g = `adjoints:${lab}:${cle}:${i}`;
      const bras = (echelon, enPoste) => {
        grainerHasard(`adjoints:${lab}:toi`); const toi = equipe('Toi', t, un, s);
        grainerHasard(`adjoints:${lab}:eux`); const adv = equipe('Eux', t, un, s);
        toi.coachs = [enPoste ? effetDePalier(coach, 1) : effetDePalier(coach === 'tortue' ? 'essaim' : 'tortue', 1)];
        if (echelon) toi.patrons = [decisionDAdjoint(cle, coach, echelon).patron];
        return match(toi, adv, g, visiteur);
      };
      for (const [k, ech] of [['a', 0], ['b1', 1], ['b3', 3]]) { const r = bras(ech, true); S[k].n++; for (const x of ['v', 'gf', 'ga', 'tp']) S[k][x] += r[x]; }
      // Son coach parti, l'adjoint ne joue pas : la même feuille.
      if (i % 10 === 0) { part++; if (JSON.stringify(bras(0, false)) === JSON.stringify(bras(3, false))) pareil++; }
    }
  }
  const e1 = LIRE[canal](S.b1) - LIRE[canal](S.a), e3 = LIRE[canal](S.b3) - LIRE[canal](S.a);
  const v82 = ((S.b1.v - S.a.v) / S.a.n) * 82 * 0.5;   // ses soirs : la moitié de la saison
  exiger(`${P.ico} ${P.nom} : son coach parti, la feuille ne bouge pas`, pareil === part, `${pareil}/${part}`);
  exiger(`${P.ico} ${P.nom} : l'échelon 3 rend plus que l'échelon 1 (${canal})`, sens * e3 > sens * e1 && sens * e1 > 0, `${f2(e1)} → ${f2(e3)} ${UNITE[canal]}`);
  exiger(`${P.ico} ${P.nom} : à l'échelon 1, sous la borne de sa rareté`, Math.abs(v82) <= BORNE_V[rarete], `${f2(v82)} V sur ses soirs d'une saison (borne ${BORNE_V[rarete]})`);
}
informer('l\'échelon 3, en chiffres', MESURES.map(([c]) => `${PERSONNEL[c].ico} ${JSON.stringify(effetDeLAdjoint(c, 3))}`).join(' · '));

verdict('les adjoints du coach');
