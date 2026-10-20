/*
 * LE TABLEAU DE L'ENTRACTE (V13-1, docs/refonte-v13.md). JP : *le choix de contre, c'est un bouton que tu pèses, c'est
 * pas un vrai jeu* ; *plus à la EHM*. Au duel, ta réponse est ton tableau de la période : le système de chaque unité, la
 * consigne, le geste qui déplace un joueur. Chaque réglage qui mord sur leur intention est une porte, pleine ou à
 * moitié (`lireLeTableau`, js/sim.js). Ce juge :
 *   1. pour chaque intention, un tableau neutre la laisse frapper ; une demi-porte la contre à moitié ; deux, en plein ;
 *      une porte pleine (celles d'avant : la paire à la maison, le Cycle d'un premier trio, la consigne Basse…) aussi ;
 *   2. le moteur joue le tableau qu'on lui donne : la période le garde, et son niveau est celui que l'écran lit ;
 *   3. AUCUNE COUVERTURE : un tableau qui ferme tout d'avance (trois trios en trappe, la consigne Basse — il contre
 *      l'assaut, les punitions, à moitié la chasse) ne vaut pas le duel bien joué (l'attentif lit chaque intention) :
 *      son prix (des trios qui tirent moins, la finition de la Basse, le plan qui ne paie plus) mange ce qu'il contre.
 *      Mesuré au départ (20 oct.) : 39,8 % contre 50,3 %, et 40,2 % sans rien faire. Une couverture qui vaudrait le
 *      bien joué rendrait la réponse évidente, et le duel se jouerait tout seul ;
 *   4. la même graine rejoue le même duel, tableau compris.
 *   node scripts/check_tableau.mjs      (N : matchs par club et par bras du point 3, 150 ; trois clubs témoins)
 */
import { autoRoster, registerHiddenRatings, createTeam, simulerGrosMatch, activeLineup, lignesDe, lireLeTableau, SLOTS } from '../js/sim.js';
import { DECK_DEPART } from '../js/combat.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { robotDuel } from './lib/duel.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 150);
const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
const [, s, t] = TEMOINS[0];
const un = equipeReelle(s, t);
const toi = equipe('Toi', t, un, s), adv = equipe('Eux', t, un, s);
toi.isPlayer = true; toi.courbe = true; adv.courbe = true;

// 1. LES PORTES, sur un tableau neutre : aucun système ne mord (Hourra partout), la consigne Normale.
const L = activeLineup(toi);
const neutres = () => lignesDe(toi, L, { duSoir: false }).map(l => ({ ...l, tac: 'hourra', tacD: 'hourra' }));
const caseDe = p => SLOTS.find(sl => !sl.scratch && L[sl.i] === p);
const avants = SLOTS.filter(sl => !sl.scratch && sl.group === 'F' && L[sl.i]).map(sl => L[sl.i]);
const vedette = avants[0], c0 = caseDe(vedette);
const consigne = cle => [{ source: 'reponse', cle }];
const lire = (cle, { lignes = neutres(), base = [], Lk = L, domicile = true, cible = vedette } = {}) => lireLeTableau({ cle, cible }, { toi, L: Lk, lignes, depart: neutres(), base, c0: caseDe(cible), domicile }).niveau;
const avec = (modif) => { const l = neutres(); modif(l); return l; };
// L'ombre : déplacer la vedette (plein chez toi, à moitié au loin) ; son nouveau trio en contre-attaque, l'autre moitié.
const vers = c0.unit === 0 ? 1 : 0, s2 = SLOTS.find(sl => !sl.scratch && sl.group === 'F' && sl.unit === vers && sl.role === c0.role);
const Lbouge = { ...L }; [Lbouge[c0.i], Lbouge[s2.i]] = [Lbouge[s2.i], Lbouge[c0.i]];
// La chasse sur un avant dont l'unité n'a personne de robuste (sinon la glace la contre déjà).
const chasse = avants.find(p => lire('chasse', { cible: p }) === null) || null;
const cas = [
  ['ombre · rien', lire('ombre'), null],
  ['ombre · son trio en contre-attaque', lire('ombre', { lignes: avec(l => { l[c0.unit].tac = 'contre'; }) }), 'demi'],
  ['ombre · déplacée, chez toi', lireLeTableau({ cle: 'ombre', cible: vedette }, { toi, L: Lbouge, lignes: neutres(), depart: neutres(), c0, domicile: true }).niveau, 'pleine'],
  ['ombre · déplacée au loin', lireLeTableau({ cle: 'ombre', cible: vedette }, { toi, L: Lbouge, lignes: neutres(), depart: neutres(), c0, domicile: false }).niveau, 'demi'],
  ['ombre · déplacée au loin, son trio en contre-attaque', lireLeTableau({ cle: 'ombre', cible: vedette }, { toi, L: Lbouge, lignes: avec(l => { l[vers].tac = 'contre'; }), depart: neutres(), c0, domicile: false }).niveau, 'pleine'],
  ...(chasse ? [
    ['chasse · rien', lire('chasse', { cible: chasse }), null],
    ['chasse · la consigne Basse', lire('chasse', { cible: chasse, base: consigne('basse') }), 'demi'],
    ['chasse · Basse et des plombiers autour de lui', lire('chasse', { cible: chasse, base: consigne('basse'), lignes: avec(l => { l[caseDe(chasse).unit].tac = 'energie'; }) }), 'pleine'],
  ] : []),
  ['centre · rien', lire('centre'), null],
  ['centre · le 3e trio en Cycle', lire('centre', { lignes: avec(l => { l[2].tac = 'courtes'; }) }), 'demi'],
  ['centre · le 3e trio en Cycle et la consigne Haute', lire('centre', { lignes: avec(l => { l[2].tac = 'courtes'; }), base: consigne('haute') }), 'pleine'],
  ['centre · le 1er trio en Cycle', lire('centre', { lignes: avec(l => { l[0].tac = 'courtes'; }) }), 'pleine'],
  ['assaut · rien', lire('assaut'), null],
  ['assaut · un trio en trappe', lire('assaut', { lignes: avec(l => { l[2].tac = 'defensive'; }) }), 'demi'],
  ['assaut · un trio en trappe et la consigne Basse', lire('assaut', { lignes: avec(l => { l[2].tac = 'defensive'; }), base: consigne('basse') }), 'pleine'],
  ['assaut · une paire à la maison', lire('assaut', { lignes: avec(l => { l[1].tacD = 'maison'; }) }), 'pleine'],
  ['cachot · rien', lire('cachot'), null],
  ['cachot · un trio en trappe', lire('cachot', { lignes: avec(l => { l[3].tac = 'defensive'; }) }), 'demi'],
  ['cachot · deux trios en trappe', lire('cachot', { lignes: avec(l => { l[2].tac = 'defensive'; l[3].tac = 'defensive'; }) }), 'pleine'],
  ['cachot · la consigne Basse', lire('cachot', { base: consigne('basse') }), 'pleine'],
];
const faux = cas.filter(([, lu, attendu]) => lu !== attendu);
exiger('chaque porte contre comme elle le dit : rien → elle frappe, ½ → à moitié, ½ + ½ ou 1 → en plein', !faux.length,
  faux.length ? faux.map(([n, lu, a]) => `${n} : ${lu} au lieu de ${a}`).join(' · ') : `${cas.length} tableaux${chasse ? '' : ' (la chasse : aucun avant sans dur à côté, non mesurée)'}`);

// 2 et 4. LE MOTEUR JOUE LE TABLEAU, et la même graine le rejoue.
const TABLEAU = { F: [null, 'defensive', 'defensive', 'defensive'], consigne: 'basse' };
const duel = (avecTableau, graine, cle) => {
  toi.robotDuel = () => (avecTableau ? { tactiques: TABLEAU } : {});
  return simulerGrosMatch(toi, adv, { graine, cle });
};
const r1 = duel(true, 'tableau', 'm0'), r2 = duel(true, 'tableau', 'm0');
const p0 = r1.gros.duelJoue.periodes;
const garde = p0.every(h => h.tactiques === TABLEAU || JSON.stringify(h.tactiques) === JSON.stringify(TABLEAU));
const niveaux = p0.map(h => `${h.intention.cle} ${h.contree || 'frappe'} (${(h.portes || []).map(x => `${x.cle} ${x.poids}`).join(' + ') || 'aucune porte'})`);
exiger('le moteur garde le tableau de chaque période, et le lit en portes', garde && p0.every(h => Array.isArray(h.portes)), niveaux.join(' · '));
exiger('la même graine rejoue le même duel, tableau compris', r1.gf === r2.gf && r1.ga === r2.ga && JSON.stringify(r1.feuille.tirs) === JSON.stringify(r2.feuille.tirs), `${r1.gf}-${r1.ga} et ${r2.gf}-${r2.ga}`);

// 3. AUCUNE COUVERTURE : le tableau qui ferme tout, contre le duel bien joué, sur les mêmes dés (chez toi et au loin).
const bras = { attentif: () => robotDuel('attentif'), couverture: () => () => ({ tactiques: TABLEAU }) };
const gagnes = { attentif: 0, couverture: 0 };
for (const [lab, s0, t0] of TEMOINS.slice(0, 3)) {
  const un0 = equipeReelle(s0, t0);
  for (const [k, f] of Object.entries(bras)) {
    const a = equipe('Toi', t0, un0, s0), b = equipe('Eux', t0, un0, s0);
    a.isPlayer = true; a.courbe = true; b.courbe = true; a.robotDuel = f(); a.deckDuel = DECK_DEPART;
    for (let i = 0; i < N; i++) if (simulerGrosMatch(a, b, { graine: `couverture-${lab}`, cle: `m${i}`, visiteur: i % 2 === 1 }).gagne) gagnes[k]++;
  }
}
const pct = k => (100 * gagnes[k]) / (3 * N);
exiger('aucune couverture : le tableau qui ferme tout d\'avance gagne 5 points de moins, au moins, que le duel bien joué',
  pct('couverture') <= pct('attentif') - 5, `${pct('couverture').toFixed(1).replace('.', ',')} % contre ${pct('attentif').toFixed(1).replace('.', ',')} %, ${3 * N} duels par bras`);
informer('les intentions du duel au tableau défensif', niveaux.join(' · '));
verdict('Le tableau de l\'entracte');
