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
 *   6. la saison se rejoue à l'identique avec ces décisions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, simulateLeague, SLOTS, activeLineup, lignesDe,
  mainDuDeck, SORTES_DECK, GAIN_STAGE, rolesOfferts, tactiquesDuStage, MUTATIONS, CARTES, PALIERS_CARTES,
  chimieLigne, apprentissagePhoto, getPlayerKey, profilsDe,
} from '../js/sim.js';
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
  const dresses = SLOTS.filter(s => !s.scratch && s.group !== 'G').map(s => toi.roster[s.i]).filter(p => p && p.p !== 'G');
  const m = moy(dresses.map(p => (photo.maitrise(p)[tac] || 0)));
  const mBase = moy(dresses.map(p => (photoBase.maitrise(p)[tac] || 0)));
  exiger('le stage apprend la tactique à toute la formation', m >= GAIN_STAGE * 0.95 && m > mBase + 0.3, `maîtrise de ${tac} ${(mBase * 100).toFixed(0)} % sans le stage, ${(m * 100).toFixed(0)} % avec`);
  const ch = chimieLigne(photo, L, 3, tac), chBase = chimieLigne(photoBase, L, 3, tac);
  exiger('et la ligne qui la joue a plus de chimie ce soir-là', ch > chBase + 5, `4e ligne en ${tac} : ${chBase.toFixed(0)} % sans le stage, ${ch.toFixed(0)} % avec`);
  // 4. l'amélioration.
  const p = Object.values(toi.roster).find(x => x && getPlayerKey(x) === cleCible);
  const autres = Object.values(toi.roster).filter(x => x && x !== p && x._mut && x._mut.finition);
  const apres = profilsDe(p);
  exiger('une amélioration change la carte du joueur choisi', p && p._mut && Math.abs(p._mut.finition - MUTATIONS.affute.finition) < 1e-9 && apres.franc > profilsAvant.franc,
    `${p.n} : finition ×${p._mut && p._mut.finition}, franc-tireur ${profilsAvant.franc} → ${apres.franc}`);
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
}

verdict('Le deck');
