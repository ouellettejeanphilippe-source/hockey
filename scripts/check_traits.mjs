/*
 * Les traits sont-ils rares, couvrent-ils les époques, et se voient-ils ?
 *
 * Trois questions, dans cet ordre, parce que rater la première rend les deux
 * autres sans objet : un trait courant n'est plus un trait, c'est une cote.
 *
 *   1. RARETÉ    quelle part des joueurs-saisons en porte un
 *   2. ÉPOQUES   y a-t-il des saisons sans aucun trait, et lesquelles
 *   3. EFFET     un lauréat change-t-il quelque chose de mesurable
 *
 * La troisième se mesure en dupliquant une vraie équipe et en retirant les
 * traits à la copie : même vestiaire, même moteur, un seul écart.
 *
 *   node scripts/check_traits.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTraits, TRAITS, VEZINA_VOTE_DEPUIS } from '../js/traits.js';
import { REPUTATIONS } from '../data/reputations.js';
import { exiger, borne, informer, verdict } from './verdict.mjs';
import { autoRoster, registerHiddenRatings, simulate, createTeam, activeLineup, profilMatch } from '../js/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEASONS_DIR = path.join(ROOT, 'data', 'seasons');
const ESSAIS = Number(process.env.ESSAIS ?? 10);

const moy = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/* ---------- 1 et 2 : rareté et couverture ---------- */
let joueursSaisons = 0;
const compte = {}, parSaison = {}, porteurs = [];
for (const k of Object.keys(TRAITS)) compte[k] = [0, 0];

const fichiers = fs.readdirSync(SEASONS_DIR).filter(x => x.endsWith('.json')).sort();
for (const f of fichiers) {
  const shard = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
  const vus = new Set();
  parSaison[shard.season] = 0;
  for (const p of shard.players) {
    if (vus.has(p.id)) continue;
    vus.add(p.id);
    joueursSaisons++;
    const ts = getTraits(p);
    for (const t of ts) { compte[t.cle][t.niveau]++; parSaison[shard.season]++; }
    if (ts.length) porteurs.push({ p, ts });
  }
}

console.log(`\n${joueursSaisons} joueurs-saisons, ${fichiers.length} saisons\n`);
console.log('  trait          porteurs  finalistes   part');
let total = 0, totalVote = 0, totalReput = 0;
for (const [k, meta] of Object.entries(TRAITS)) {
  const [g, fi] = compte[k];
  total += g + fi;
  if (meta.reputation) totalReput += g + fi; else totalVote += g + fi;
  console.log(`  ${meta.icon} ${meta.short.padEnd(12)} ${String(g).padStart(6)}  ${String(fi).padStart(10)}`
    + `   ${(100 * (g + fi) / joueursSaisons).toFixed(2)} %`
    + `   ${meta.reputation ? 'réputation' : 'vote'}`);
}
console.log(`\n  votés ${(100 * totalVote / joueursSaisons).toFixed(2)} %`
  + `   réputations ${(100 * totalReput / joueursSaisons).toFixed(2)} %`);

/* Un nom mal orthographié serait un trait mort dont personne ne saurait rien :
 * il n'apparaîtrait ni dans le jeu ni dans les comptes ci-dessus. */
const nomsVus = new Set();
for (const f of fichiers) {
  for (const p of JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8')).players) nomsVus.add(p.n);
}
const morts = Object.entries(REPUTATIONS)
  .flatMap(([k, l]) => l.filter(n => !nomsVus.has(n)).map(n => `${k} ${n}`));
console.log(morts.length
  ? `\n  ✗ ${morts.length} réputation(s) sur un nom introuvable : ${morts.join(', ')}`
  : `\n  ✓ les ${Object.values(REPUTATIONS).flat().length} noms de réputation existent tous dans les shards`);
// Un nom mal orthographié est un trait MORT dont personne ne saurait rien :
// c'est la seule contrepartie du seul fichier du dépôt qui repose sur du
// jugement plutôt que sur une mesure. Il doit donc faire échouer, pas
// seulement imprimer une croix.
exiger('chaque nom de réputation existe dans les shards', !morts.length,
  morts.length ? morts.slice(0, 5).join(', ') : `${Object.values(REPUTATIONS).flat().length} noms`);
console.log(`\n  au total ${total} traits sur ${joueursSaisons} joueurs-saisons — `
  + `${(100 * total / joueursSaisons).toFixed(2)} %`);
// La rareté est le contrepoids de l'effet : « ne pas en avoir veut dire rien
// de particulier, ce qui est vrai ». Allonger `data/reputations.js` sans
// remesurer gonfle les grandes équipes EN SILENCE — c'est écrit dans
// CLAUDE.md comme le piège de ce fichier-là, et voici le garde-fou.
borne('part des joueurs-saisons qui portent un trait', 100 * total / joueursSaisons, 6, 14, ' %');

const vides = Object.entries(parSaison).filter(([, n]) => n === 0).map(([s]) => s);
console.log(`\n  saisons sans aucun trait : ${vides.length ? vides.join(', ') : 'aucune'}`);
const avantSelke = fichiers.map(f => f.replace('.json', '')).filter(s => s < '1977-78');
console.log(`  saisons sans Selke possible (créé en 1977-78) : ${avantSelke.length}`);
console.log(`  saisons sans Vezina possible (vote depuis ${VEZINA_VOTE_DEPUIS}) : `
  + `${fichiers.map(f => f.replace('.json', '')).filter(s => s < VEZINA_VOTE_DEPUIS).length}`);

/* ---------- 3 : l'effet se voit-il ? ---------- */
/* On prend les vraies équipes qui portent le plus de traits, et on les fait
 * jouer deux fois : avec, puis sans. Retirer un trait se fait en effaçant le
 * nom, seule clé de `getTraits` — le joueur reste identique par ailleurs. */
const parEquipe = new Map();
for (const { p, ts } of porteurs) {
  const cle = `${p.s}|${p.t}`;
  parEquipe.set(cle, (parEquipe.get(cle) || 0) + ts.length);
}
const cibles = [...parEquipe.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

console.log(`\n  CE QUE VALENT LES TRAITS — ${ESSAIS} saisons par équipe, avec puis sans\n`);
console.log('  équipe            traits    V avec   V sans   écart   BP avec  BP sans   BC avec  BC sans');
const ecarts = [], ecartsBC = [], ecartsBP = [];
for (const [cle, n] of cibles) {
  const [saison, tag] = cle.split('|');
  const ps = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, `${saison}.json`), 'utf8'))
    .players.filter(p => p.t === tag && p.gp >= 10);
  if (ps.length < 20) continue;

  const jouer = (sansTraits) => {
    const pool = ps.map(p => ({ ...p, ...(sansTraits ? { n: `∅ ${p.n}` } : {}) }));
    pool.forEach(registerHiddenRatings);
    const roster = autoRoster(pool);
    const rs = [];
    for (let i = 0; i < ESSAIS; i++) rs.push(simulate(roster));
    return { W: moy(rs.map(r => r.W)), GF: moy(rs.map(r => r.GF)), GA: moy(rs.map(r => r.GA)) };
  };
  const avec = jouer(false), sans = jouer(true);
  ecarts.push(avec.W - sans.W);
  ecartsBC.push(avec.GA - sans.GA);
  ecartsBP.push(avec.GF - sans.GF);
  console.log(`  ${(tag + ' ' + saison).padEnd(16)} ${String(n).padStart(6)}`
    + `   ${avec.W.toFixed(1).padStart(6)}   ${sans.W.toFixed(1).padStart(6)}`
    + `   ${(avec.W - sans.W >= 0 ? '+' : '')}${(avec.W - sans.W).toFixed(1).padStart(5)}`
    + `   ${avec.GF.toFixed(0).padStart(7)}  ${sans.GF.toFixed(0).padStart(7)}`
    + `   ${avec.GA.toFixed(0).padStart(7)}  ${sans.GA.toFixed(0).padStart(7)}`);
}
/* ---------- 4 : le trait suit-il le joueur, où qu'il soit ? ---------- */
/*
 * C'est la règle : un trait appartient au JOUEUR, pas à sa case. Un lauréat du
 * Selke doit défendre aussi bien au quatrième trio qu'au premier — c'est le
 * malus de zone qui punit de mal le placer, et il le fait déjà.
 *
 * On le vérifie sans simuler : le facteur défensif d'équipe se lit dans le
 * profil de match, et il doit être le MÊME quel que soit l'ordre des joueurs
 * dans l'alignement. Un seul écart voudrait dire que le trait est reparti se
 * cacher dans une unité.
 *
 * Les réputations de VITESSE et de LANCER n'ont pas besoin de ce contrôle :
 * elles multiplient le volume de tirs et la finition DU JOUEUR, donc elles le
 * suivent par construction. C'est le canal d'équipe qui pouvait déraper.
 */
{
  const [saison, tag] = cibles[0][0].split('|');
  const ps = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, `${saison}.json`), 'utf8'))
    .players.filter(p => p.t === tag && p.gp >= 10);
  const profilDe = (ordre) => {
    const pool = ordre.map(p => ({ ...p }));
    pool.forEach(registerHiddenRatings);
    const team = createTeam(tag, tag, autoRoster(pool));
    return profilMatch(team, activeLineup(team)).traitDef;
  };
  const normal = profilDe(ps);
  const inverse = profilDe(ps.slice().reverse());
  const ok = Math.abs(normal - inverse) < 1e-9;
  console.log(`\n  LE TRAIT SUIT-IL LE JOUEUR ? (${tag} ${saison})\n`);
  console.log(`    facteur défensif, ordre normal   ${normal.toFixed(4)}`);
  console.log(`    facteur défensif, ordre inversé  ${inverse.toFixed(4)}`);
  console.log(`    ${ok ? '✓ identique — le trait ne dépend pas de la case'
    : '✗ DIFFÉRENT — le trait dépend de la place dans l\'alignement'}`);
  // « Un trait appartient au joueur, pas à sa case » : un lauréat du Selke au
  // quatrième trio défend aussi bien qu'au premier. Au dix-millième près.
  exiger('le trait suit le joueur, pas la case', ok, `${normal.toFixed(4)} contre ${inverse.toFixed(4)}`);
}

console.log(`\n  écart moyen : ${(moy(ecarts) >= 0 ? '+' : '')}${moy(ecarts).toFixed(1)} victoires`
  + `, ${(moy(ecartsBP) >= 0 ? '+' : '')}${moy(ecartsBP).toFixed(1)} buts marqués`
  + `, ${(moy(ecartsBC) >= 0 ? '+' : '')}${moy(ecartsBC).toFixed(1)} buts alloués`);
console.log('  Les victoires sont bruitées ; les BUTS des deux colonnes sont le signal');
console.log('  propre — les votés pèsent sur les buts alloués, les réputations de');
console.log('  vitesse et de lancer sur les buts marqués.');
console.log('  Un trait doit se voir sans décider la saison à lui seul.\n');

/*
 * L'ÉCART EST BRUITÉ, ET C'EST POUR ÇA QU'IL EST BORNÉ LARGE. Dix saisons
 * rejouées avec puis sans, sous des graines tirées : le script n'est pas
 * déterministe, contrairement à `check_table`. Les bornes disent seulement
 * « un trait doit se VOIR sans décider la saison à lui seul » — le premier
 * réglage du bidirectionnel donnait +12 victoires aux Red Wings de 2001-02,
 * et rien n'avait rougi.
 */
borne('écart en victoires', moy(ecarts), 1, 9, ' V');
borne('écart en buts marqués', moy(ecartsBP), 5, 32, ' BP');
borne('écart en buts alloués', moy(ecartsBC), -32, -3, ' BC');
verdict('Les traits restent-ils rares, et se voient-ils ?');
