/*
 * LE DECK (S73) — ce qui doit tenir.
 *
 *   node scripts/check_deck.mjs
 *
 * JP : *comme un deck de deckbuilder, considérant que c'est des cartes de
 * joueurs et d'effets* ; *possible d'avoir des cartes style événement qui
 * permettent d'aller chercher un joueur au choix loto, ou changer le profil
 * d'un joueur, améliorer ses stats, etc.* ; *faut le faire pour vrai*. On exige :
 *   1. une main de palier a trois cartes de sortes différentes, dont un effet,
 *      et elle est PURE (même graine, même palier, même main) ;
 *   2. sur beaucoup de parties, chaque sorte sort, aucune n'écrase les autres ;
 *   3. (V7 : le stage de système est retiré, la chimie ne s'apprend plus) ;
 *   4. une amélioration change VRAIMENT la carte du joueur choisi (facteurs et
 *      profils), et seulement la sienne ;
 *   5. les nouveaux rôles offerts visent trois joueurs différents de
 *      l'alignement, chacun avec un changement de carte réel ;
 *   6. la saison se rejoue à l'identique avec ces décisions ;
 *   7. (S80) une amélioration prise au palier se GARDE : elle va à une place,
 *      la garder ne change rien au moteur, et posée au verso elle prend une
 *      case (deux, trois pour une Or ou une Holo) ;
 *   8. (V9, tranche 5b) tes places : une carte se joue quand on veut, sans limite
 *      par semaine ; le palier de la saison en offre une parmi trois ; le cahier
 *      (le deck) tient en CAHIER_MAX cartes, et le départ cède sa place d'abord.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS,
  mainDuDeck, SORTES_DECK, rolesOfferts, MUTATIONS, PALIERS_CARTES,
  getPlayerKey, profilsDe,
} from '../js/sim.js';
import { CASES_DE_BASE, casesDAmelioration, casesLibres, poseesSur, sePose, idsDe, buildDe, coachDeCarte, payloadDe } from '../js/banque.js';
import { monterLesDoublons, missionsDuCartable, decennieDe } from '../js/cartable.js';
import { deckDe, DECK_DEPART, CICATRICES_MAX, CAHIER_MAX, CARTES_MATCH, signaturesDe } from '../js/combat.js';
import { placesDeLaPartie, cartesDuPalier, PALIERS_PACK, PLACES } from '../js/inventaire.js';
import { BANQUE } from '../js/banque.js';
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

console.log('\n  Le deck (S73)\n');

/* ---------- 1 et 2. la main ---------- */
{
  const compte = Object.fromEntries(Object.keys(SORTES_DECK).map(k => [k, 0]));
  // V10 (tranche 6) : ni carte de saison ni amélioration d'avant ; trois des cinq sortes qui restent.
  let mauvaises = 0, impures = 0;
  for (let g = 0; g < 400; g++) for (const j of PALIERS_CARTES) {
    const main = mainDuDeck(`deck${g}`, j);
    const sortes = main.map(c => c.sorte);
    if (main.length !== 3 || new Set(sortes).size !== 3 || sortes.some(s => !SORTES_DECK[s])) mauvaises++;
    if (JSON.stringify(mainDuDeck(`deck${g}`, j)) !== JSON.stringify(main)) impures++;
    for (const s of sortes) compte[s]++;
  }
  exiger('une main : trois sortes différentes', mauvaises === 0, `${mauvaises} mains fautives sur 1 200`);
  exiger('la main est pure (même graine, même palier, même main)', impures === 0, `${impures} impures`);
  const parts = Object.values(compte).map(n => n / 1200);
  informer('fréquence des sortes', Object.entries(compte).map(([k, n]) => `${SORTES_DECK[k].ico} ${k} ${(n / 12).toFixed(0)} %`).join(' · '));
  exiger('chaque sorte sort, aucune n\'écrase les autres', Math.min(...parts) > 0.45 && Math.max(...parts) < 0.75,
    parts.map(x => `${(x * 100).toFixed(0)} %`).join(' / '));
}

/* ---------- 4, 5, 6. les cartes jouées pour vrai ---------- */
{
  const J0 = 20;
  const base = ligue(7300);
  simulateLeague(base, 82, { graine: 'deck', decisions: [] });
  const t = ligue(7300);
  const toi = t[0];
  // V10 (tranche 6) : l'amélioration d'avant est partie ; le nouveau rôle du palier change la carte d'un joueur.
  const roles = rolesOfferts(toi, 'deck', J0);
  const [r0] = roles;
  const cleCible = getPlayerKey(r0.p);
  const profilsAvant = JSON.stringify(profilsDe(r0.p));
  const decisions = [
    { jour: J0 + 1, equipe: 0, palier: 40, deck: 'profil', mutation: { cle: r0.cle, joueur: cleCible } },
  ];
  simulateLeague(t, 82, { graine: 'deck', decisions });
  // 4. le nouveau rôle.
  const p = Object.values(toi.roster).find(x => x && getPlayerKey(x) === cleCible);
  const autres = Object.values(toi.roster).filter(x => x && x !== p && (x._mutCles || []).includes(r0.cle));
  exiger('un nouveau rôle change la carte du joueur choisi', p && (p._mutCles || []).includes(r0.cle) && JSON.stringify(profilsDe(p)) !== profilsAvant,
    `${p.n} : ${MUTATIONS[r0.cle].nom}`);
  exiger('et seulement la sienne', !autres.length, `${autres.length} autre(s) touché(s)`);
  // 5. les rôles.
  const cles = new Set(roles.map(r => getPlayerKey(r.p)));
  exiger('trois nouveaux rôles, trois joueurs différents de l\'alignement, trois vrais changements', roles.length === 3 && cles.size === 3
    && roles.every(r => MUTATIONS[r.cle] && MUTATIONS[r.cle].source === 'choix' && Object.values(toi.roster).includes(r.p)),
    roles.map(r => `${r.p.n} → ${MUTATIONS[r.cle].nom}`).join(' · '));
  // 6. le rejeu.
  const t2 = ligue(7300);
  simulateLeague(t2, 82, { graine: 'deck', decisions: decisions.map(d => ({ ...d })) });
  const fiche = x => `${x[0].W}-${x[0].L}-${x[0].OTL} ${x[0].GF}-${x[0].GA}`;
  exiger('la saison se rejoue à l\'identique avec ces cartes', fiche(t) === fiche(t2), `${fiche(t)} puis ${fiche(t2)}`);
  borne('écart de victoires que le nouveau rôle a fait', t[0].W - base[0].W, -12, 12, '');

  /*
   * 7. UNE CARTE DE JOUEUR SE GARDE, ET SE POSE AU VERSO (S80 ; V10 : un équipement). JP : *je veux que
   * les upgrades de joueurs se fassent au verso de la carte, pas
   * nécessairement quand on la pige*. Prise au palier, elle va à une place
   * (`garde`) ; posée, elle en sort et prend une case. La garder ne touche
   * pas le moteur : la saison est celle d'avant, au but près.
   */
  const garde = { jour: J0, equipe: 0, palier: J0, deck: 'atelier', garde: 'joueur:rubanBlanc' };
  const pose = { jour: J0 + 5, equipe: 0, joue: { src: 'partie', ref: `deck:${J0}`, id: 'joueur:rubanBlanc' }, mutation: { cle: 'rubanBlanc', joueur: cleCible } };
  const poche1 = placesDeLaPartie({ decisions: [garde] });
  const poche2 = placesDeLaPartie({ decisions: [garde, pose] });
  exiger('une carte prise au palier va à une place, et en sort une fois posée', poche1.some(x => x.ref === `deck:${J0}` && x.id === 'joueur:rubanBlanc') && !poche2.some(x => x.ref === `deck:${J0}`),
    `${poche1.filter(x => x.ref.startsWith('deck:')).map(x => x.id).join(', ')} puis ${poche2.filter(x => x.ref.startsWith('deck:')).length} carte(s) du palier`);
  const t3 = ligue(7300);
  simulateLeague(t3, 82, { graine: 'deck', decisions: [{ ...garde }] });
  exiger('la garder ne change rien à la saison (le moteur ne la lit qu\'une fois posée)', fiche(t3) === fiche(base), `${fiche(base)} sans, ${fiche(t3)} avec`);
  const posees = poseesSur([garde, pose], cleCible);
  exiger('posée, elle prend une case de son verso', posees.length === 1 && posees[0].cle === 'rubanBlanc' && casesLibres('commune', posees) === CASES_DE_BASE - 1, `${posees.length} posée, ${casesLibres('commune', posees)} libre`);
  const lustre = [{ jour: 30, mutation: { cle: 'lustre', joueur: 'k', carte: { rar: 'rare', bonus: [] } } }];
  exiger('deux cases, trois pour une Or ou une Holo ; le lustre qui fait une Or rend sa case',
    casesDAmelioration('commune') === 2 && casesDAmelioration('peu') === 2 && casesDAmelioration('hors') === 2 && casesDAmelioration('rare') === 3 && casesDAmelioration('legendaire') === 3
    && casesLibres('peu', poseesSur(lustre, 'k')) === 2 && !sePose('genou') && !sePose('tir_gun') && sePose('pinceau') && sePose('rubanBlanc'),
    `Base ${casesDAmelioration('commune')} · Or ${casesDAmelioration('rare')} · Cadre lustré en Or : ${casesLibres('peu', poseesSur(lustre, 'k'))} libres`);
}

/*
 * 8. LES CICATRICES ONT UN PLAFOND (1.0, J1-F). Quatre pertes contre la
 * némésis ne font que deux « doute » ; une série gagnée en efface une ; la
 * saison suivante d'une run repart sans (le report est filtré dans game.js,
 * ici on vérifie que deckDe respecte un `deckDeBase` sans malédiction).
 */
{
  const d4 = deckDe([], { pertes: [3, 9, 20, 31] });
  exiger('quatre gros matchs perdus contre la némésis ne laissent que deux doutes (les plus récents)', d4.filter(c => c === 'doute').length === CICATRICES_MAX && d4.length === DECK_DEPART.length + CICATRICES_MAX && CICATRICES_MAX === 2,
    `${d4.filter(c => c === 'doute').length} doute(s), ${d4.length} cartes`);
  const mixte = deckDe([], { pertes: [3, 40], blessures: [20], avant: 30 });
  exiger('les cicatrices d\'avant le jour demandé seulement, doutes et blessures confondus', mixte.filter(c => CARTES_MATCH[c].maudite).join() === 'doute,trainee', mixte.filter(c => CARTES_MATCH[c].maudite).join(' · '));
  const dSerie = deckDe([], { pertes: [3, 9], serie: [{ ronde: 0, match_no: -1, recompense: null }], ronde: 1 });
  const dSerieAvant = deckDe([], { pertes: [3, 9], serie: [{ ronde: 0, match_no: -1, recompense: null }], ronde: 0 });
  exiger('une série gagnée efface une cicatrice, et seulement à partir de la ronde suivante', dSerie.filter(c => c === 'doute').length === 1 && dSerieAvant.filter(c => c === 'doute').length === 2,
    `ronde 1 : ${dSerie.filter(c => c === 'doute').length} doute · ronde 0 : ${dSerieAvant.filter(c => c === 'doute').length}`);
  // LE BUTIN À TROIS CHOIX (V5) : un gros match ou une série gagnée retire ou améliore une carte au lieu d'en ajouter une.
  const k0 = DECK_DEPART.find(k => k !== DECK_DEPART[0] && CARTES_MATCH[`${k}+`]);
  const parGros = deckDe([{ jour: 10, palier: 'r:8', recompense: null, deck: 'menage', retrait: DECK_DEPART[0] }, { jour: 20, palier: 'r:18', recompense: null, deck: 'camp', aiguise: k0 }]);
  exiger('le butin d\'un gros match retire ou améliore une carte du deck', parGros.length === DECK_DEPART.length - 1 && parGros.includes(`${k0}+`), parGros.join(' · '));
  const parSerie = r => deckDe([], { serie: [{ ronde: 0, match_no: -1, recompense: null, deck: 'menage', retrait: DECK_DEPART[0] }, { ronde: 1, match_no: -1, recompense: null, deck: 'camp', aiguise: k0 }], ronde: r });
  exiger('le butin d\'une série vaut à partir de la ronde suivante', parSerie(1).length === DECK_DEPART.length - 1 && !parSerie(1).includes(`${k0}+`) && parSerie(2).includes(`${k0}+`) && parSerie(0).length === DECK_DEPART.length,
    `ronde 0 : ${parSerie(0).length} · 1 : ${parSerie(1).length} · 2 : ${parSerie(2).includes(`${k0}+`) ? '+' : 'sans +'}`);
  const base = deckDe([], { pertes: [3, 9] }).filter(c => !CARTES_MATCH[c].maudite);
  const suivante = deckDe([{ jour: 0, deck: 'report', deckDeBase: base }]);
  exiger('la saison suivante d\'une run repart d\'un deck sans cicatrice', !suivante.some(c => CARTES_MATCH[c].maudite) && suivante.length === DECK_DEPART.length, `${suivante.length} cartes, ${suivante.filter(c => CARTES_MATCH[c].maudite).length} maudite(s)`);
}

/*
 * LES CARTES DE MATCH NE SONT PAS À TES PLACES (oct. ; V9). JP : *les poches de cartes, faut pas que les cartes de match
 * soient là, ça n'a pas de sens*. Elles se jouent au deck, aux gros matchs : un pack les y met à l'ouverture, elles ne
 * prennent jamais une place. Une partie d'avant (la carte envoyée « Au deck » depuis la poche) ne la compte pas deux
 * fois, ni au deck ni pour son coach.
 */
{
  // V10 (tranche 5) : les événements ne se tirent plus ; l'autre carte du pack est une place.
  const m = idsDe('match').find(id => coachDeCarte(id) && !DECK_DEPART.includes(id.slice(6))), autre = idsDe('consommable')[0], cle = m.slice(6);
  const achat = { jour: 3, palier: 'k:1', achat: { pack: 'mixte', n: 1, prix: 25, sorte: 'cartes', cartes: [m, autre] } };
  const poche = placesDeLaPartie({ decisions: [achat], rogue: true });
  exiger('tes places n\'ont aucune carte de match', poche.every(x => !x.id.startsWith('match:')) && poche.some(x => x.id === autre), `${poche.length} cartes`);
  const avant = deckDe([]).filter(k => k === cle).length;
  exiger('la carte de match du pack est au deck dès l\'ouverture', deckDe([achat]).filter(k => k === cle).length === avant + 1);
  const vieux = [achat, { jour: 4, joue: { src: 'partie', ref: '1:0', id: m }, recompense: cle }];
  exiger('une partie d\'avant (« Au deck » depuis la poche) ne la compte pas deux fois', deckDe(vieux).filter(k => k === cle).length === avant + 1);
  const e = coachDeCarte(m);
  // V5 : une carte de match achetée ne compte pour son coach qu'une fois jouée.
  const jouee = { jour: 9, main: { jouees: [cle], enMain: [] } };
  exiger('achetée, elle ne compte pas pour son coach ; jouée, elle compte une fois', buildDe([achat])[e] === 0 && buildDe(vieux)[e] === 0 && buildDe([achat, jouee])[e] === 1, `${buildDe([achat])[e]} · ${buildDe(vieux)[e]} · ${buildDe([achat, jouee])[e]}`);
}

/*
 * TES PLACES (V9, tranche 5b — docs/refonte-v9.md § 6.4). La poche, la main de la semaine et ses deux cartes par
 * semaine sont parties : une carte se joue quand on veut, autant qu'on veut. Plus de cartes que de places se voit
 * (À faire demande laquelle vendre) ; les places reportées au jour 0 d'une saison neuve (`poche`) y entrent. Le palier
 * de la saison (`pp:<match>`) offre une carte parmi trois, pure, sans carte de match, ni événement, ni personnel, ni
 * permanent ; la prise va à une place.
 */
{
  const ev = idsDe('consommable').filter(id => BANQUE[id].vie !== 'permanent').slice(0, 5);
  const achat = { jour: 0, palier: 'k:1', achat: { pack: 'mixte', n: 1, prix: 25, sorte: 'cartes', cartes: ev } };
  const p0 = placesDeLaPartie({ decisions: [achat], rogue: true });
  const joue = (ref, jour) => ({ jour, joue: { src: 'partie', ref, id: p0.find(x => x.ref === ref).id } });
  const p1 = placesDeLaPartie({ decisions: [achat, joue(p0[0].ref, 8), joue(p0[1].ref, 8), joue(p0[2].ref, 8)], rogue: true });
  exiger('trois cartes se jouent le même jour : aucune limite par semaine', p0.length === ev.length && p1.length === ev.length - 3, `${p0.length} → ${p1.length}`);
  exiger('plus de cartes que de places se compte', p0.length - PLACES === ev.length - PLACES && PLACES === 3, `${p0.length} cartes, ${PLACES} places`);
  const report = { jour: 0, poche: ev.slice(0, 2), report: true };
  const poche = placesDeLaPartie({ decisions: [report], rogue: true });
  const apres = placesDeLaPartie({ decisions: [report, { jour: 2, joue: { src: 'partie', ref: 'r0', id: ev[0] } }], rogue: true });
  exiger('les places de la saison d\'avant entrent au jour 0, et une carte jouée de là en sort', poche.length === 2 && apres.length === 1 && apres[0].id === ev[1], `${poche.length} · ${apres.length}`);
  const offres = PALIERS_PACK.map(p => cartesDuPalier('deck', p));
  const propres = offres.flat().every(id => BANQUE[id] && !['match', 'evenement', 'patron'].includes(BANQUE[id].cat) && BANQUE[id].vie !== 'permanent');
  exiger('chaque palier offre trois cartes distinctes, pures, qui se jouent d\'une place', offres.every(o => o.length === 3 && new Set(o).size === 3) && propres
    && PALIERS_PACK.every(p => cartesDuPalier('deck', p).join() === cartesDuPalier('deck', p).join()), offres.map((o, i) => `${PALIERS_PACK[i]} : ${o.join(', ')}`).join(' · '));
  const prise = { jour: 21, palier: `pp:${PALIERS_PACK[0]}`, place: offres[0][1] };
  const avec = placesDeLaPartie({ decisions: [prise], rogue: true });
  exiger('la carte prise au palier va à une place', avec.length === 1 && avec[0].id === offres[0][1] && avec[0].ref === prise.palier, avec.map(x => `${x.ref} ${x.id}`).join(' · '));
}

/*
 * LE CAHIER BORNÉ (V9, tranche 5b). Le deck tient en CAHIER_MAX cartes : au-delà, une carte du départ cède sa place
 * (la plus répétée), puis la plus ancienne gagnée ; une malédiction ne cède jamais.
 */
{
  const gagnees = idsDe('match').map(id => id.slice(6)).filter(k => !DECK_DEPART.includes(k) && !CARTES_MATCH[k].maudite && !k.endsWith('+')).slice(0, CAHIER_MAX);
  const gains = gagnees.map((k, i) => ({ jour: i + 1, palier: `r:${i}`, recompense: k }));
  const d = deckDe(gains, { pertes: [3, 9] });
  exiger(`le cahier tient en ${CAHIER_MAX} cartes`, d.length === CAHIER_MAX, `${d.length} cartes`);
  exiger('le départ cède sa place avant ce qui a été gagné, et les malédictions restent', d.filter(c => c === 'doute').length === 2 && !d.some(c => DECK_DEPART.includes(c)) && gagnees.slice(-(CAHIER_MAX - 2)).every(k => d.includes(k)),
    `${d.filter(c => DECK_DEPART.includes(c)).length} carte(s) du départ, ${d.filter(c => c === 'doute').length} doute(s)`);
  const peu = deckDe(gains.slice(0, CAHIER_MAX - DECK_DEPART.length + 2));
  const restent = DECK_DEPART.filter((c, i) => DECK_DEPART.indexOf(c) === i).map(c => `${c} ${peu.filter(x => x === c).length}`);
  exiger('les dernières cartes du départ (celles de tous les soirs) cèdent les premières', peu.length === CAHIER_MAX && !peu.includes(DECK_DEPART.at(-1)) && !peu.includes(DECK_DEPART.at(-2)) && DECK_DEPART.slice(0, -2).every(c => peu.includes(c)), restent.join(' · '));
}

/*
 * LES DOUBLONS ET LE RAPPEL (Jalon P3). Trois doublons d'une édition la montent d'un cran, jusqu'à l'Or (l'édition 4) ;
 * la Holo ne sort pas des doublons (oct. 2026 : l'Or et la Holo ont échangé leur place, la force de chacune est restée). « Le rappel du club-école » signe un joueur de ton cartable par la décision qui existe (`ballottage`).
 */
{
  // Treize Base : quatre montent (douze doublons), et ces quatre Cadres en font un Hors-cadre.
  const x = { v: { commune: 13 } };
  const m = monterLesDoublons(x);
  exiger('trois doublons montent la carte : Base → Cadre → Hors-cadre', m.length === 5 && x.v.commune === 1 && x.v.peu === 1 && x.v.hors === 1 && !x.v.rare && !x.v.legendaire,
    `${JSON.stringify(m.map(y => `${y.de}→${y.a}`))} · reste ${JSON.stringify(x.v)}`);
  const y = { v: { hors: 4 } };
  monterLesDoublons(y);
  exiger('un Hors-cadre et trois doublons font une Or', y.v.hors === 1 && y.v.rare === 1, JSON.stringify(y.v));
  const z = { v: { rare: 7 } };
  monterLesDoublons(z);
  exiger('la Holo ne sort pas des doublons', z.v.rare === 7 && !z.v.legendaire, JSON.stringify(z.v));
  const p = payloadDe('consommable:rappel', { joueur: 'k', sortie: { i: 21, sort: 's' }, rar: 'peu' });
  exiger('le rappel du club-école est une signature au ballottage', p && p.ballottage && p.ballottage.entre === 'k' && p.ballottage.i === 21 && p.ballottage.sort === 's', JSON.stringify(p));
  exiger('sans joueur choisi, le rappel ne décide rien', payloadDe('consommable:rappel', {}) === null);
}

/*
 * LES MISSIONS DE COLLECTION (Jalon P4) se lisent sur le cartable : neuf cartes d'un club-saison font une feuille,
 * cinq Holo d'une décennie une extension, une carte par décennie du jeu les extensions toutes.
 */
{
  const joueurs = {};
  for (let i = 0; i < 9; i++) joueurs[`1985-86_EDM_${i}`] = { v: { rare: 1 }, n: 1 };
  joueurs['2005-06_CAR_1'] = { v: { commune: 1 }, n: 1 };
  const ms = Object.fromEntries(missionsDuCartable({ joueurs }, [1980, 2000]).map(m => [m.cle, m]));
  exiger('neuf cartes d\'un club-saison font une feuille ; cinq Holo d\'une décennie, une extension', ms.feuille.fait && ms.cinqHolo.fait && ms.holo.fait && !ms.or.fait && !ms.cent.fait, Object.values(ms).map(m => `${m.cle} ${m.n}/${m.but}`).join(' · '));
  exiger('une carte de chaque décennie du jeu : toutes les extensions', ms.epoques.fait && !missionsDuCartable({ joueurs }, [1980, 1990, 2000]).find(m => m.cle === 'epoques').fait && decennieDe('1999-00') === 1990);
}

/*
 * LA CARTE SIGNATURE (Jalon P5) : un Holo ou un Or habillé apporte la carte de son premier rôle, une carte qui
 * existe déjà ; une Base ou une Parallèle, rien.
 */
{
  const joueur = (rar, cle) => ({ _carte: { rar }, cle });
  const s = signaturesDe([joueur('rare', 'sniper'), joueur('legendaire', 'mur'), joueur('peu', 'sniper'), joueur('commune', 'passeur'), { cle: 'checker' }], p => [{ cle: p.cle }]);
  exiger('un Holo et un Or apportent la carte de leur rôle, les autres rien', JSON.stringify(s) === JSON.stringify(['lucarne', 'serrerLesRangs']), JSON.stringify(s));
  exiger('chaque carte signature est une carte du cahier neuf', s.every(k => CARTES_MATCH[k] && !CARTES_MATCH[k].maudite && !CARTES_MATCH[k].retire));
}

verdict('Le deck');
