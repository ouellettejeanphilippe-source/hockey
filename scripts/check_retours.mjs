/*
 * LES FILS QUI REVIENNENT ET LES BLESSÉS QUI JOUENT (V9, tranche 6 — docs/refonte-v9.md § 6.6 et § 6.7). En Rogue, un
 * fil fort ouvre un choix (js/vie-gm.js `CHOIX_DES_FILS`) dont le retour se relit dans les feuilles ; un blessé peut
 * jouer diminué ; une commotion se garde. De vraies ligues de 32 vestiaires, ton club en Rogue. Ce qu'on exige :
 *   1. le choix d'un fil ne touche pas aux journées d'avant, et la saison se rejoue pareil ;
 *   2. son retour arrive le matin qui suit le `apres`-ième match de ton club depuis le choix, jamais avant ;
 *   3. son chiffre se RECOMPTE dans ces feuilles-là (ses buts, ses points, les buts du duo), le texte le dit, et le
 *      seuil décide de la branche ;
 *   4. l'effet de la branche est posé sur le bon joueur, le temps de ses matchs ;
 *   5. le Cheechoo monte au 1er trio (sa case), celui qu'il déloge prend la sienne ;
 *   6. « Le jouer blessé » : il sort de l'infirmerie le jour même, joue le soir suivant, diminué (« Il joue amoché »)
 *      le temps qu'il lui restait ; s'il se blesse encore, l'absence s'allonge de ce temps-là ;
 *   7. une commotion se garde : la suivante d'un même joueur porte sa mémoire, en Rogue seulement ; le report d'une
 *      saison à l'autre (`commotions`) compte aussi ;
 *   8. le jeu voit des retours : au moins trois sortes de fils, sur quelques ligues.
 * La banque des choix de fil est vide (V22, phase 4) : 1 à 5 et 8 s'informent « banque vide » tant qu'aucun fil n'ouvre de
 * choix ; 6 et 7 (le blessé, la commotion) se jugent toujours.
 * `GRAINES` : les ligues (83,85,86 par défaut).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, getPlayerKey, SLOTS, SITUATIONS, JOUER_BLESSE_MAX, JAMAIS_BLESSE } from '../js/sim.js';
import { filsDeSaison } from '../js/recit.js';
import { CHOIX_DES_FILS } from '../js/vie-gm.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const RECRUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'recrues.json'), 'utf8'));
const GRAINES = String(process.env.GRAINES || '83,85,86').split(',').map(Number);
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => {
  const rk = new Set(RECRUES[s] || []);
  const p = un.flat().map(x => ({ ...x, ...(rk.has(x.id) ? { rk: 1 } : {}) }));
  p.forEach(registerHiddenRatings);
  return createTeam(nom, tag, autoRoster(p), { season: s });
};
function ligue(seed, n = 32) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const f = SAISONS[Math.floor(rnd() * SAISONS.length)];
    const sh = shard(f);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
/* Une saison de Rogue, ton club en tête, avec ces décisions, jouée jusqu'à la journée `jusqua`. */
function saison(seed, decisions = [], { jusqua = Infinity, courbe = true } = {}) {
  const teams = ligue(seed);
  teams[0].isPlayer = true;
  const L = creerLigue(teams, 82, { graine: `retours-${seed}`, decisions, courbe });
  jouerJusqua(L, jusqua);
  return { L, you: teams[0] };
}
const tes = (L, you) => L.calendrier.flatMap((jour, j) => jour.filter(m => m.joue && (m.A === you || m.B === you)).map(m => ({ j, m })));
const empreinte = (L, avant) => L.calendrier.slice(0, avant).map(jour => jour.map(m => `${m.gfA}-${m.gfB}`).join(',')).join('|');
const parCle = (you, k) => Object.values(you.roster).find(p => p && getPlayerKey(p) === k);

console.log('\n  LES FILS QUI REVIENNENT, LES BLESSÉS QUI JOUENT (V9, tranche 6)\n');
const t0 = Date.now();
const fautes = [], vus = {}, exemples = [];
let choix = 0, avantPareil = 0, rejouePareil = 0, aLHeure = 0, recompte = 0, branche = 0, effetPose = 0, montes = 0, montesOk = 0;
let blesses = 0, sortis = 0, joue = 0, amoche = 0, aggravees = 0, aggraveesOk = 0, memoires = 0, memoiresOk = 0, memoiresHors = 0, reports = 0, reportsOk = 0;
const faute = t => { if (fautes.length < 10) fautes.push(t); };

for (const seed of GRAINES) {
  const base = saison(seed);
  const cal = base.L.calendrier;
  const fils = filsDeSaison(cal, base.you);
  // 1 à 5. Le premier fil de chaque sorte qui ouvre un choix ; la première option qui engage un suivi.
  for (const sorte of Object.keys(CHOIX_DES_FILS)) {
    const e = fils.journal.find(x => x.fils.some(a => a.sorte === sorte && !a.fini));
    if (!e) continue;
    const a = e.fils.find(x => x.sorte === sorte && !x.fini);
    const o = CHOIX_DES_FILS[sorte].options.find(x => x.suivi);
    const J = e.j + 1, cle = getPlayerKey(a.joueur);
    const d = { jour: J, palier: `fil:${sorte}`, sel: `t6-${sorte}`, moment: { famille: 'fil', cle: sorte, choix: o.cle, joueur: cle, joueurs: [cle], ...(a.passeur ? { passeur: getPlayerKey(a.passeur) } : {}) } };
    // Le Cheechoo monte au 1er trio, à la case de même rôle, comme l'écran la calcule.
    let haut = null;
    if (o.monte) {
      const sP = SLOTS.find(s => base.you.roster[s.i] === a.joueur);
      const t = sP && !sP.scratch && sP.group === 'F' && sP.unit > 0 ? SLOTS.find(s => s.group === 'F' && !s.scratch && s.unit === 0 && s.role === sP.role) : null;
      if (!t) continue;
      const cases = {};
      for (const [i, p] of Object.entries(base.you.roster)) if (p) cases[i] = getPlayerKey(p);
      cases[t.i] = cle; cases[sP.i] = getPlayerKey(base.you.roster[t.i]);
      d.cases = cases; d.moment.deplace = getPlayerKey(base.you.roster[t.i]);
      haut = { t, sP, deplace: d.moment.deplace };
    }
    choix++;
    const r = saison(seed, [d]);
    const r2 = saison(seed, [{ ...d }]);
    if (empreinte(r.L, J) === empreinte(base.L, J)) avantPareil++; else faute(`${sorte} : les journées d'avant le choix ont bougé`);
    if (empreinte(r.L, Infinity) === empreinte(r2.L, Infinity) && JSON.stringify((r.you.retours || []).map(x => x.texte)) === JSON.stringify((r2.you.retours || []).map(x => x.texte))) rejouePareil++;
    else faute(`${sorte} : la saison ne se rejoue pas pareil`);
    if (haut) {
      montes++;
      const p = parCle(r.you, cle), X = parCle(r.you, haut.deplace);
      if (r.you.roster[haut.t.i] === p && r.you.roster[haut.sP.i] === X) montesOk++; else faute(`${sorte} : il n'est pas monté au 1er trio`);
    }
    const R = (r.you.retours || []).find(x => x.cle === sorte);
    if (!R) { faute(`${sorte} : aucun retour (choix au jour ${J})`); continue; }
    vus[sorte] = (vus[sorte] || 0) + 1;
    if (exemples.length < 4) exemples.push(R.texte);
    // 2. Le matin qui suit le `apres`-ième match depuis le choix.
    const miens = tes(r.L, r.you).filter(x => x.j >= J);
    const n = o.suivi.apres;
    if (miens.length >= n && R.jour === miens[n - 1].j + 1) aLHeure++; else faute(`${sorte} : retour au jour ${R.jour}, attendu ${miens[n - 1] ? miens[n - 1].j + 1 : '?'}`);
    // 3. Le chiffre, recompté dans ces feuilles-là.
    const J0 = parCle(r.you, cle), P = a.passeur ? parCle(r.you, getPlayerKey(a.passeur)) : null;
    let k = 0;
    for (const { m } of miens.slice(0, n)) for (const b of m.feuille.buts) {
      const passe = (b.passeurs || []).includes(J0);
      if (o.suivi.mesure === 'buts' ? b.marqueur === J0 : o.suivi.mesure === 'points' ? b.marqueur === J0 || passe : b.marqueur === J0 && P && (b.passeurs || []).includes(P)) k++;
    }
    if (k === R.n && R.texte.includes(` ${k} `)) recompte++; else faute(`${sorte} : « ${R.texte} » ; recompté ${k}`);
    if (R.gagne === (k >= o.suivi.seuil)) branche++; else faute(`${sorte} : la branche ne suit pas le seuil`);
    // 4. L'effet de la branche, sur le bon joueur, de son matin à sa fin.
    const B = R.gagne ? o.suivi.gagne : o.suivi.perd;
    if (!B) effetPose++;
    else {
      const poses = (r.you.effetsCibles || []).filter(x => x.source === 'fil' && x.debut === R.jour);
      const qui = { joueur: J0, passeur: P, deplace: haut ? parCle(r.you, haut.deplace) : null };
      const ok = B.effets.every(e => poses.some(x => x.joueur === qui[e.sur] && Object.keys(e).filter(c => c !== 'sur').every(c => x[c] === e[c])));
      if (ok) effetPose++; else faute(`${sorte} : l'effet du retour n'est pas posé sur le bon joueur`);
    }
  }
  // 6. Le jouer blessé : la première blessure qui s'y prête, décidée le matin d'après.
  const b0 = base.you.injuriesLog.find(b => b.player.p !== 'G' && !JAMAIS_BLESSE.includes(b.genre) && b.games >= 2 && b.games <= JOUER_BLESSE_MAX && Number.isFinite(b.jour));
  if (b0) {
    blesses++;
    const J = b0.jour + 1, cle = getPlayerKey(b0.player);
    const r = saison(seed, [{ jour: J, palier: `b:${b0.at}:${cle}`, blesse: { joueur: cle }, sel: 't6-blesse' }]);
    const p = parCle(r.you, cle);
    const log = r.you.injuriesLog.find(x => x.player === p && x.at === b0.at);
    if (empreinte(r.L, J) === empreinte(base.L, J) && log && log.joueBlesse && log.at + log.games <= tes(r.L, r.you).filter(x => x.j < J).length) sortis++;
    else faute(`jouer blessé : il ne sort pas de l'infirmerie (${JSON.stringify(log && { at: log.at, games: log.games, jb: log.joueBlesse })})`);
    const suivant = tes(r.L, r.you).find(x => x.j >= J);
    const cote = suivant && (suivant.m.A === r.you ? 'A' : 'B');
    if (suivant && (suivant.m.feuille.alignes[cote] || []).includes(p)) joue++; else faute('jouer blessé : il ne joue pas le soir suivant');
    const A = SITUATIONS.amoche;
    const e = (r.you.effetsCibles || []).find(x => x.source === 'blesse' && x.joueur === p);
    if (e && e.debut === J && e.finition === A.finition && e.lancers === A.lancers && e.blessure === A.blessure) amoche++; else faute('jouer blessé : le profil « Il joue amoché » manque');
    // L'aggravation : une nouvelle blessure pendant qu'il jouait blessé porte sa dette.
    const ag = r.you.injuriesLog.filter(x => x.player === p && x.aggrave);
    for (const x of ag) { aggravees++; if (x.aggrave === log.joueBlesse && x.games > x.aggrave) aggraveesOk++; }
  }
  // 7. La mémoire des commotions, en Rogue ; jamais hors du Rogue.
  for (const x of base.you.injuriesLog.filter(y => y.genre === 'commotion')) {
    const avant = base.you.injuriesLog.filter(y => y.player === x.player && y.genre === 'commotion' && y.at < x.at).length;
    if (avant) { memoires++; if (x.memoire === avant) memoiresOk++; } else if (x.memoire) faute('une première commotion porte une mémoire');
  }
  const hors = saison(seed, [], { courbe: false });
  memoiresHors += hors.you.injuriesLog.filter(y => y.memoire).length;
  // Le report d'une saison à l'autre : chacun de tes patineurs a déjà eu une commotion.
  const commotions = Object.fromEntries(Object.values(base.you.roster).filter(p => p && p.p !== 'G').map(p => [getPlayerKey(p), 1]));
  const rep = saison(seed, [{ jour: 0, commotions, report: true }]);
  for (const x of rep.you.injuriesLog.filter(y => y.genre === 'commotion')) {
    reports++;
    const avant = rep.you.injuriesLog.filter(y => y.player === x.player && y.genre === 'commotion' && y.at < x.at).length;
    if (x.memoire === avant + 1) reportsOk++;
  }
}

exiger('le choix d\'un fil ne touche pas aux journées d\'avant', avantPareil === choix, `${avantPareil} sur ${choix}`);
if (!Object.keys(CHOIX_DES_FILS).length) informer('choix de fil : banque vide (V22, phase 4)', 'rien à relire, les contrôles de 1 à 5 sont vides');
exiger('la saison se rejoue pareil, retours compris', rejouePareil === choix, `${rejouePareil} sur ${choix}`);
exiger('le retour arrive le matin qui suit son dernier match, jamais avant', aLHeure === choix, `${aLHeure} sur ${choix}`);
exiger('son chiffre se recompte dans ces feuilles-là, et le texte le dit', recompte === choix, `${recompte} sur ${choix}`);
exiger('le seuil décide de la branche', branche === choix, `${branche} sur ${choix}`);
exiger('l\'effet du retour est posé sur le bon joueur, de son matin', effetPose === choix, `${effetPose} sur ${choix}`);
exiger('le Cheechoo monte au 1er trio, celui qu\'il déloge prend sa case', montesOk === montes, `${montesOk} sur ${montes}`);
if (Object.keys(CHOIX_DES_FILS).length) exiger('le jeu voit des retours : trois sortes de fils au moins', Object.keys(vus).length >= Math.min(3, Object.keys(CHOIX_DES_FILS).length), Object.entries(vus).map(([k, n]) => `${CHOIX_DES_FILS[k].ico} ${k} ${n}`).join(' · '));
exiger('jouer blessé : il sort de l\'infirmerie le jour même, rien d\'avant ne bouge', blesses > 0 && sortis === blesses, `${sortis} sur ${blesses}`);
exiger('jouer blessé : il joue le soir suivant', joue === blesses, `${joue} sur ${blesses}`);
exiger('jouer blessé : diminué, « Il joue amoché », le temps qu\'il lui restait', amoche === blesses, `${amoche} sur ${blesses}`);
exiger('l\'aggravation porte ce qu\'il avait emprunté', aggraveesOk === aggravees, `${aggraveesOk} sur ${aggravees} aggravation(s)`);
exiger('une commotion se garde : la suivante d\'un joueur en porte la mémoire', memoiresOk === memoires, `${memoiresOk} sur ${memoires}`);
exiger('hors du Rogue, aucune mémoire', memoiresHors === 0, `${memoiresHors}`);
exiger('le report d\'une saison à l\'autre compte', reportsOk === reports && reports > 0, `${reportsOk} sur ${reports} commotion(s)`);
if (fautes.length) informer('les fautes', fautes.join(' · '));
for (const x of exemples) informer('un retour', x);
informer('le temps', `${Math.round((Date.now() - t0) / 1000)} s (${GRAINES.length} ligues)`);
verdict();
