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
 *   3. le stage de système apprend VRAIMENT la tactique à toute la formation,
 *      et la chimie de la ligne qui la joue monte ce soir-là ;
 *   4. une amélioration change VRAIMENT la carte du joueur choisi (facteurs et
 *      profils), et seulement la sienne ;
 *   5. les nouveaux rôles offerts visent trois joueurs différents de
 *      l'alignement, chacun avec un changement de carte réel ;
 *   6. la saison se rejoue à l'identique avec ces décisions ;
 *   7. (S80) une amélioration prise au palier se GARDE : elle va dans la poche,
 *      la garder ne change rien au moteur, et posée au verso elle prend une
 *      case (deux, trois pour une holo ou une or).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, activeLineup, lignesDe,
  mainDuDeck, SORTES_DECK, GAIN_STAGE, rolesOfferts, tactiquesDuStage, MUTATIONS, CARTES, PALIERS_CARTES,
  chimieLigne, apprentissagePhoto, getPlayerKey, profilsDe,
} from '../js/sim.js';
import { CASES_DE_BASE, casesDAmelioration, casesLibres, poseesSur, sePose, idsDe, buildDe, coachDeCarte } from '../js/banque.js';
import { deckDe, DECK_DEPART, CICATRICES_MAX, CARTES_MATCH } from '../js/combat.js';
import { pocheDeLaPartie, mainDeLaSemaine, PALIERS_PACK } from '../js/inventaire.js';
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
const moy = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

console.log('\n  Le deck (S73)\n');

/* ---------- 1 et 2. la main ---------- */
{
  const compte = Object.fromEntries(Object.keys(SORTES_DECK).map(k => [k, 0]));
  let mauvaises = 0, impures = 0, effetsPris = 0;
  for (let g = 0; g < 400; g++) for (const j of PALIERS_CARTES) {
    const main = mainDuDeck(`deck${g}`, j, []);
    const sortes = main.map(c => c.sorte);
    if (main.length !== 3 || new Set(sortes).size !== 3 || sortes[0] !== 'effet' || !CARTES[main[0].cle]) mauvaises++;
    if (main.some(c => c.sorte === 'amelioration' && !(MUTATIONS[c.cle] && MUTATIONS[c.cle].source === 'amelioration'))) mauvaises++;
    if (JSON.stringify(mainDuDeck(`deck${g}`, j, [])) !== JSON.stringify(main)) impures++;
    const prise = main[0].cle;
    if (mainDuDeck(`deck${g}`, j, [prise])[0].cle === prise) effetsPris++;
    for (const s of sortes) compte[s]++;
  }
  exiger('une main : trois sortes différentes, dont un effet', mauvaises === 0, `${mauvaises} mains fautives sur 1 200`);
  exiger('la main est pure (même graine, même palier, même main)', impures === 0, `${impures} impures`);
  exiger('un effet déjà pris ne revient pas', effetsPris === 0, `${effetsPris} fois`);
  const autres = ['recrue', 'amelioration', 'profil', 'strategie', 'menage', 'camp', 'atelier'].map(k => compte[k] / 1200);
  informer('fréquence des sortes', Object.entries(compte).map(([k, n]) => `${SORTES_DECK[k].ico} ${k} ${(n / 12).toFixed(0)} %`).join(' · '));
  exiger('chaque sorte sort, aucune n\'écrase les autres', Math.min(...autres) > 0.22 && Math.max(...autres) < 0.45,
    autres.map(x => `${(x * 100).toFixed(0)} %`).join(' / '));
  const stages = new Set();
  for (let g = 0; g < 60; g++) for (const t of tactiquesDuStage(`deck${g}`, 20)) stages.add(t);
  exiger('le stage offre trois systèmes, et tous finissent par sortir', tactiquesDuStage('x', 20).length === 3 && !stages.has('hourra') && stages.size >= 6, `${stages.size} systèmes vus`);
}

/* ---------- 3, 4, 5, 6. les cartes jouées pour vrai ---------- */
{
  const J0 = 20;
  const base = ligue(7300);
  simulateLeague(base, 82, { graine: 'deck', decisions: [] });
  const t = ligue(7300);
  const toi = t[0];
  const L = activeLineup(toi);
  const lignes = lignesDe(toi, L);
  // Le stage sur une tactique que la 4e ligne ne joue pas encore, et la 4e ligne passe à elle.
  const tac = ['defensive', 'contre', 'courtes', 'echec', 'bleue'].find(k => lignes.every(l => l.tac !== k)) || 'defensive';
  const soir = lignes.map((l, u) => (u === 3 ? { ...l, tac } : { ...l }));
  const cible = SLOTS.filter(s => !s.scratch && s.group === 'F').map(s => toi.roster[s.i]).find(Boolean);
  const cleCible = getPlayerKey(cible);
  const profilsAvant = { ...profilsDe(cible) };
  const roles = rolesOfferts(toi, 'deck', J0);
  const decisions = [
    { jour: J0, equipe: 0, palier: J0, deck: 'strategie', maitrise: { tac, gain: GAIN_STAGE } },
    { jour: J0, equipe: 0, lignes: soir },
    { jour: J0 + 1, equipe: 0, palier: 40, deck: 'amelioration', mutation: { cle: 'affute', joueur: cleCible } },
  ];
  simulateLeague(t, 82, { graine: 'deck', decisions });
  // 3. la maîtrise et la chimie.
  const photo = apprentissagePhoto(toi.jourLignes[J0 + 1].apprentissage);
  const photoBase = apprentissagePhoto(base[0].jourLignes[J0 + 1].apprentissage);
  // Un système de trio s'apprend par les avants (S79) : la paire a le sien.
  const dresses = SLOTS.filter(s => !s.scratch && s.group === 'F').map(s => toi.roster[s.i]).filter(Boolean);
  const m = moy(dresses.map(p => (photo.maitrise(p)[tac] || 0)));
  const mBase = moy(dresses.map(p => (photoBase.maitrise(p)[tac] || 0)));
  exiger('le stage apprend le système à tous tes avants', m >= GAIN_STAGE * 0.95 && m > mBase + 0.3, `maîtrise de ${tac} ${(mBase * 100).toFixed(0)} % sans le stage, ${(m * 100).toFixed(0)} % avec`);
  const ch = chimieLigne(photo, L, 3, tac), chBase = chimieLigne(photoBase, L, 3, tac);
  exiger('et la ligne qui la joue a plus de chimie ce soir-là', ch > chBase + 5, `4e ligne en ${tac} : ${chBase.toFixed(0)} % sans le stage, ${ch.toFixed(0)} % avec`);
  // 4. l'amélioration.
  const p = Object.values(toi.roster).find(x => x && getPlayerKey(x) === cleCible);
  // S80 : une amélioration vit à part (`_amel`, elle grandit avec la saison dans une ligue Rogue) ; hors du Rogue elle vaut ce qu'elle dit.
  const finitionDe = x => ((x && x._mut && x._mut.finition) || 1) * ((x && x._amel && x._amel.finition) || 1);
  const autres = Object.values(toi.roster).filter(x => x && x !== p && finitionDe(x) !== 1);
  const apres = profilsDe(p);
  exiger('une amélioration change la carte du joueur choisi', p && Math.abs(finitionDe(p) - MUTATIONS.affute.finition) < 1e-9 && apres.sniper > profilsAvant.sniper,
    `${p.n} : finition ×${finitionDe(p)}, sniper ${profilsAvant.sniper} → ${apres.sniper}`);
  exiger('et seulement la sienne', !autres.some(x => (x._mutCles || []).includes('affute')), `${autres.length} autre(s) touché(s)`);
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
  borne('écart de victoires que le stage et l\'amélioration ont fait', t[0].W - base[0].W, -12, 12, '');

  /*
   * 7. L'AMÉLIORATION SE GARDE, ET SE POSE AU VERSO (S80). JP : *je veux que
   * les upgrades de joueurs se fassent au verso de la carte, pas
   * nécessairement quand on la pige*. Prise au palier, elle va dans la poche
   * (`garde`) ; posée, elle en sort et prend une case. La garder ne touche
   * pas le moteur : la saison est celle d'avant, au but près.
   */
  const garde = { jour: J0, equipe: 0, palier: J0, deck: 'amelioration', garde: 'joueur:affute' };
  const pose = { jour: J0 + 5, equipe: 0, joue: { src: 'partie', ref: `deck:${J0}`, id: 'joueur:affute' }, mutation: { cle: 'affute', joueur: cleCible } };
  const poche1 = pocheDeLaPartie({ decisions: [garde], graine: 'deck', jour: J0 + 1 });
  const poche2 = pocheDeLaPartie({ decisions: [garde, pose], graine: 'deck', jour: J0 + 6 });
  exiger('une amélioration prise au palier va dans la poche, et en sort une fois posée', poche1.some(x => x.ref === `deck:${J0}` && x.id === 'joueur:affute') && !poche2.some(x => x.ref === `deck:${J0}`),
    `${poche1.filter(x => x.ref.startsWith('deck:')).map(x => x.id).join(', ')} puis ${poche2.filter(x => x.ref.startsWith('deck:')).length} carte(s) du palier`);
  const t3 = ligue(7300);
  simulateLeague(t3, 82, { graine: 'deck', decisions: [{ ...garde }] });
  exiger('la garder ne change rien à la saison (le moteur ne la lit qu\'une fois posée)', fiche(t3) === fiche(base), `${fiche(base)} sans, ${fiche(t3)} avec`);
  const posees = poseesSur([garde, pose], cleCible);
  exiger('posée, elle prend une case de son verso', posees.length === 1 && posees[0].cle === 'affute' && casesLibres('commune', posees) === CASES_DE_BASE - 1, `${posees.length} posée, ${casesLibres('commune', posees)} libre`);
  const lustre = [{ jour: 30, mutation: { cle: 'lustre', joueur: 'k', carte: { rar: 'rare', bonus: [] } } }];
  exiger('deux cases, trois pour une holo ou une or ; le lustre qui fait une holo rend sa case',
    casesDAmelioration('commune') === 2 && casesDAmelioration('peu') === 2 && casesDAmelioration('rare') === 3 && casesDAmelioration('legendaire') === 3
    && casesLibres('peu', poseesSur(lustre, 'k')) === 2 && !sePose('genou') && !sePose('tir_gun') && sePose('partout') && sePose('baton_neuf'),
    `base ${casesDAmelioration('commune')} · holo ${casesDAmelioration('rare')} · parallèle lustrée en holo : ${casesLibres('peu', poseesSur(lustre, 'k'))} libres`);
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
  const k0 = DECK_DEPART.find(k => CARTES_MATCH[`${k}+`]);
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
 * LES CARTES DE MATCH NE SONT PAS DANS LA POCHE (oct.). JP : *les poches de cartes, faut pas que les cartes de match
 * soient là, ça n'a pas de sens*. Elles se jouent au deck, aux gros matchs : un pack les y met à l'ouverture, elles ne
 * prennent jamais une place de la main de la semaine. Une partie d'avant (la carte envoyée « Au deck » depuis la poche)
 * ne la compte pas deux fois, ni au deck ni pour son coach.
 */
{
  const m = idsDe('match').find(id => coachDeCarte(id) && !DECK_DEPART.includes(id.slice(6))), autre = idsDe('evenement')[0], cle = m.slice(6);
  const achat = { jour: 3, palier: 'k:1', achat: { pack: 'mixte', n: 1, prix: 25, sorte: 'cartes', cartes: [m, autre] } };
  const poche = pocheDeLaPartie({ decisions: [achat], graine: 7, nMatch: PALIERS_PACK.at(-1) + 1, rogue: true });
  exiger('la poche n\'a aucune carte de match (packs achetés et packs gratuits des paliers)', poche.every(x => !x.id.startsWith('match:')) && poche.some(x => x.id === autre), `${poche.length} cartes`);
  const main = mainDeLaSemaine({ decisions: [achat], graine: 7, jour: 7, nMatchDebut: 5, nMatch: 6, rogue: true });
  exiger('la main de la semaine n\'en pige aucune', main.main.every(x => !x.id.startsWith('match:')));
  const avant = deckDe([]).filter(k => k === cle).length;
  exiger('la carte de match du pack est au deck dès l\'ouverture', deckDe([achat]).filter(k => k === cle).length === avant + 1);
  const vieux = [achat, { jour: 4, joue: { src: 'partie', ref: '1:0', id: m }, recompense: cle }];
  exiger('une partie d\'avant (« Au deck » depuis la poche) ne la compte pas deux fois', deckDe(vieux).filter(k => k === cle).length === avant + 1);
  const e = coachDeCarte(m);
  // V5 : une carte de match achetée ne compte pour son coach qu'une fois jouée.
  const jouee = { jour: 9, main: { jouees: [cle], enMain: [] } };
  exiger('achetée, elle ne compte pas pour son coach ; jouée, elle compte une fois', buildDe([achat])[e] === 0 && buildDe(vieux)[e] === 0 && buildDe([achat, jouee])[e] === 1, `${buildDe([achat])[e]} · ${buildDe(vieux)[e]} · ${buildDe([achat, jouee])[e]}`);
}

verdict('Le deck');
