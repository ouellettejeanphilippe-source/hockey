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
 *   2. (V13-2 : le ménage et le camp sont partis avec le deck de match ; les trois sortes qui restent sortent toutes) ;
 *   3. (V7 : le stage de système est retiré, la chimie ne s'apprend plus) ;
 *   4. une amélioration change VRAIMENT la carte du joueur choisi (facteurs et
 *      profils), et seulement la sienne ;
 *   5. les nouveaux rôles offerts visent trois joueurs différents de
 *      l'alignement, chacun avec un changement de carte réel ;
 *   6. la saison se rejoue à l'identique avec ces décisions ;
 *   7. (S80) une retouche prise au palier se GARDE : elle attend dans tes cartes,
 *      la garder ne change rien au moteur, et posée au verso elle prend une
 *      case (deux, trois pour une Or ou une Holo) ;
 *   8. (V9, tranche 5b ; V16) tes cartes : une carte se joue quand on veut, sans limite
 *      par semaine ; le palier de la saison offre un adjoint parmi trois, le butin
 *      d'un gros match gagné aussi (V13-2), et l'adjoint pris rejoint ton personnel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS,
  mainDuDeck, SORTES_DECK, rolesOfferts, MUTATIONS, PALIERS_CARTES,
  getPlayerKey, profilsDe,
} from '../js/sim.js';
import { CASES_DE_BASE, casesDAmelioration, casesLibres, poseesSur, sePose, idsDe, payloadDe } from '../js/banque.js';
import { monterLesDoublons, missionsDuCartable, decennieDe } from '../js/cartable.js';
import { cartesDeLaPartie, cartesDuPalier, PALIERS_PACK } from '../js/inventaire.js';
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
  // V13-2 : trois sortes, toutes trois à chaque main.
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
  exiger('les trois sortes sortent à chaque main', parts.length === 3 && parts.every(x => x === 1),
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
   * 7. UNE CARTE DE JOUEUR SE GARDE, ET SE POSE AU VERSO (S80 ; V16 : une retouche de l'atelier). JP : *je veux que
   * les upgrades de joueurs se fassent au verso de la carte, pas
   * nécessairement quand on la pige*. Prise au palier, elle attend dans tes cartes
   * (`garde`) ; posée, elle en sort et prend une case. La garder ne touche
   * pas le moteur : la saison est celle d'avant, au but près.
   */
  const garde = { jour: J0, equipe: 0, palier: J0, deck: 'atelier', garde: 'joueur:pinceau' };
  const pose = { jour: J0 + 5, equipe: 0, joue: { src: 'partie', ref: `deck:${J0}`, id: 'joueur:pinceau' }, mutation: { cle: 'pinceau', joueur: cleCible } };
  const poche1 = cartesDeLaPartie({ decisions: [garde] });
  const poche2 = cartesDeLaPartie({ decisions: [garde, pose] });
  exiger('une carte prise au palier attend dans tes cartes, et en sort une fois posée', poche1.some(x => x.ref === `deck:${J0}` && x.id === 'joueur:pinceau') && !poche2.some(x => x.ref === `deck:${J0}`),
    `${poche1.filter(x => x.ref.startsWith('deck:')).map(x => x.id).join(', ')} puis ${poche2.filter(x => x.ref.startsWith('deck:')).length} carte(s) du palier`);
  const t3 = ligue(7300);
  simulateLeague(t3, 82, { graine: 'deck', decisions: [{ ...garde }] });
  exiger('la garder ne change rien à la saison (le moteur ne la lit qu\'une fois posée)', fiche(t3) === fiche(base), `${fiche(base)} sans, ${fiche(t3)} avec`);
  const posees = poseesSur([garde, pose], cleCible);
  exiger('posée, elle prend une case de son verso', posees.length === 1 && posees[0].cle === 'pinceau' && casesLibres('commune', posees) === CASES_DE_BASE - 1, `${posees.length} posée, ${casesLibres('commune', posees)} libre`);
  const lustre = [{ jour: 30, mutation: { cle: 'lustre', joueur: 'k', carte: { rar: 'rare', bonus: [] } } }];
  exiger('deux cases, trois pour une Or ou une Holo ; le lustre qui fait une Or rend sa case',
    casesDAmelioration('commune') === 2 && casesDAmelioration('peu') === 2 && casesDAmelioration('hors') === 2 && casesDAmelioration('rare') === 3 && casesDAmelioration('legendaire') === 3
    && casesLibres('peu', poseesSur(lustre, 'k')) === 2 && !sePose('genou') && !sePose('tir_gun') && sePose('pinceau') && sePose('lustre'),
    `Base ${casesDAmelioration('commune')} · Or ${casesDAmelioration('rare')} · Cadre lustré en Or : ${casesLibres('peu', poseesSur(lustre, 'k'))} libres`);
}

/*
 * TES CARTES (V9, tranche 5b — docs/refonte-v9.md § 6.4 ; V16). La poche, la main de la semaine et ses deux cartes par
 * semaine sont parties : une carte se joue quand on veut, autant qu'on veut ; les places et la carte de trop aussi
 * (V16). Les cartes reportées au jour 0 d'une saison neuve (`poche`) y entrent. Le palier de la saison (`pp:<match>`)
 * offre un adjoint parmi trois ; pris, il rejoint ton personnel (js/banc.js). Le butin d'un gros match gagné
 * (`r:<jour>`, V13-2) aussi.
 */
{
  const ev = idsDe('consommable').filter(id => BANQUE[id].vie !== 'permanent').slice(0, 5);
  const achat = { jour: 0, palier: 'k:1', achat: { pack: 'mixte', n: 1, prix: 25, sorte: 'cartes', cartes: ev } };
  const p0 = cartesDeLaPartie({ decisions: [achat], rogue: true });
  const joue = (ref, jour) => ({ jour, joue: { src: 'partie', ref, id: p0.find(x => x.ref === ref).id } });
  const p1 = cartesDeLaPartie({ decisions: [achat, joue(p0[0].ref, 8), joue(p0[1].ref, 8), joue(p0[2].ref, 8)], rogue: true });
  exiger('trois cartes se jouent le même jour : aucune limite par semaine', p0.length === ev.length && p1.length === ev.length - 3, `${p0.length} → ${p1.length}`);
  const report = { jour: 0, poche: ev.slice(0, 2), report: true };
  const poche = cartesDeLaPartie({ decisions: [report], rogue: true });
  const apres = cartesDeLaPartie({ decisions: [report, { jour: 2, joue: { src: 'partie', ref: 'r0', id: ev[0] } }], rogue: true });
  exiger('les cartes de la saison d\'avant entrent au jour 0, et une carte jouée de là en sort', poche.length === 2 && apres.length === 1 && apres[0].id === ev[1], `${poche.length} · ${apres.length}`);
  const offres = PALIERS_PACK.map(p => cartesDuPalier('deck', p));
  const adjoints = offres.flat().every(id => BANQUE[id] && BANQUE[id].cat === 'patron');
  exiger('chaque palier offre trois adjoints distincts, purs', offres.every(o => o.length === 3 && new Set(o).size === 3) && adjoints
    && PALIERS_PACK.every(p => cartesDuPalier('deck', p).join() === cartesDuPalier('deck', p).join()), offres.map((o, i) => `${PALIERS_PACK[i]} : ${o.join(', ')}`).join(' · '));
  const prise = { jour: 21, palier: `pp:${PALIERS_PACK[0]}`, place: offres[0][1] };
  const avec = cartesDeLaPartie({ decisions: [prise], rogue: true });
  exiger('l\'adjoint pris au palier rejoint ton personnel, pas tes cartes', avec.length === 0, avec.map(x => `${x.ref} ${x.id}`).join(' · ') || 'aucune carte');
  const butin = { jour: 31, palier: 'r:30', place: offres[1][0] };
  const apresButin = cartesDeLaPartie({ decisions: [butin], rogue: true });
  exiger('l\'adjoint du butin d\'un gros match gagné rejoint ton personnel, pas tes cartes', apresButin.length === 0, apresButin.map(x => `${x.ref} ${x.source}`).join(' · ') || 'aucune carte');
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

verdict('Le deck');
