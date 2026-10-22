/*
 * LES STYLES S'OUVRENT PAR LES BADGES (V15, js/sim.js `styleOuvert` — docs/refonte-v15.md). JP : *les badges des
 * joueurs influencent certains styles de trio possibles* ; *plus de badges par joueur, plus de possibilités* ; *ça force
 * à bâtir les stratégies à partir des cartes* ; *plus clean et simple*.
 *   1. chaque système veut des badges que ses cases demandent (`veut` ⊂ `slots`), et le cycle des contres tient ;
 *   2. sur de vrais clubs (les meilleurs trios et paires de quarante saisons), un trio n'ouvre ni tout ni rien, et
 *      plus ses joueurs portent de badges différents, plus il en ouvre ;
 *   3. le moteur : en Rogue (`courbe`), un style fermé gardé dans les lignes joue le meilleur style ouvert ; ailleurs
 *      (le 82-0), rien ne change.
 * Une demi-minute.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHiddenRatings, autoRoster, createTeam, lignesDe, activeLineup, TACTIQUES, SYSTEMES_D, PROFILS, SLOTS, badgesDe,
  styleOuvert, meilleurStyle } from '../js/sim.js';
import { exiger, informer, verdict } from './verdict.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SAISONS = path.join(ICI, '..', 'data', 'seasons');

/* ---------- 1 : les systèmes ---------- */
for (const [g, T] of [['F', TACTIQUES], ['D', SYSTEMES_D]]) {
  const mal = Object.entries(T).filter(([k, S]) => k !== 'hourra' && (!S.veut || !S.veut.length
    || !S.veut.every(gr => gr.length && gr.every(r => PROFILS[g][r] && Object.values(S.slots).includes(r)))));
  exiger(`${g === 'F' ? 'trios' : 'paires'} : chaque système veut des badges que ses cases demandent`, !mal.length,
    mal.map(([k]) => k).join(', ') || Object.entries(T).filter(([k]) => k !== 'hourra').map(([, S]) => `${S.ico} ${S.veut.map(gr => gr.map(r => PROFILS[g][r].ico).join('/')).join('+')}`).join(' · '));
  exiger(`${g === 'F' ? 'trios' : 'paires'} : le Hourra reste toujours ouvert`, styleOuvert({}, g, 0, 'hourra'));
}
{
  const cles = Object.keys(TACTIQUES).filter(k => k !== 'hourra');
  const cibles = cles.map(k => TACTIQUES[k].bat);
  exiger('chaque style de trio en contre un autre, et chacun est contré', cibles.every(c => cles.includes(c)) && new Set(cibles).size === cles.length);
}

/* ---------- 2 : de vrais clubs ---------- */
const fichiers = fs.readdirSync(SAISONS).filter(f => /^\d{4}-\d{2}\.json$/.test(f)).sort();
const pris = fichiers.filter((_, i) => i % Math.max(1, Math.floor(fichiers.length / 40)) === 0).slice(0, 40);
const parRoles = new Map(), ouvertsF = [], ouvertsD = [];
let n = 0;
for (const f of pris) {
  const { players } = JSON.parse(fs.readFileSync(path.join(SAISONS, f), 'utf8'));
  const tags = [...new Set(players.map(p => p.t))].slice(0, 4);
  for (const t of tags) {
    const ps = players.filter(p => p.t === t && p.gp >= 20).map(p => ({ ...p }));
    if (ps.filter(p => p.p === 'F').length < 12 || ps.filter(p => p.p === 'D').length < 6 || !ps.some(p => p.p === 'G')) continue;
    ps.forEach(registerHiddenRatings);
    const L = autoRoster(ps);
    for (const u of [0, 1, 2, 3]) {
      const js = SLOTS.filter(s => s.group === 'F' && s.unit === u && !s.scratch).map(s => L[s.i]).filter(Boolean);
      if (js.length < 3) continue;
      const roles = new Set(js.flatMap(p => badgesDe(p).map(b => b.cle))).size;
      const k = Object.keys(TACTIQUES).filter(c => c !== 'hourra' && styleOuvert(L, 'F', u, c)).length;
      ouvertsF.push(k);
      const l = parRoles.get(roles) || []; l.push(k); parRoles.set(roles, l);
    }
    for (const u of [0, 1, 2]) ouvertsD.push(Object.keys(SYSTEMES_D).filter(c => c !== 'hourra' && styleOuvert(L, 'D', u, c)).length);
    n++;
  }
}
const moy = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const nF = Object.keys(TACTIQUES).length - 1, nD = Object.keys(SYSTEMES_D).length - 1;
const part = (a, v) => a.filter(x => x === v).length / Math.max(1, a.length);
informer('les clubs lus', `${n} vrais clubs de ${pris.length} saisons · ${ouvertsF.length} trios, ${ouvertsD.length} paires`);
exiger('un trio n\'ouvre ni tout ni rien : 2 à 5 styles en moyenne, et presque jamais les sept',
  moy(ouvertsF) >= 2 && moy(ouvertsF) <= 5 && part(ouvertsF, nF) < 0.1,
  `${moy(ouvertsF).toFixed(1).replace('.', ',')} styles sur ${nF} · aucun : ${Math.round(100 * part(ouvertsF, 0))} % · tous : ${Math.round(100 * part(ouvertsF, nF))} %`);
exiger('une paire n\'ouvre ni tout ni rien : 1 à 4 styles en moyenne', moy(ouvertsD) >= 1 && moy(ouvertsD) <= 4,
  `${moy(ouvertsD).toFixed(1).replace('.', ',')} styles sur ${nD}`);
{
  const lignes = [...parRoles.entries()].sort((a, b) => a[0] - b[0]).filter(([, l]) => l.length >= 20);
  const montent = lignes.every(([, l], i) => !i || moy(l) >= moy(lignes[i - 1][1]));
  exiger('plus de badges différents dans un trio, plus de styles ouverts', lignes.length >= 3 && montent,
    lignes.map(([r, l]) => `${r} badges : ${moy(l).toFixed(1).replace('.', ',')}`).join(' · '));
}

/* ---------- 3 : le moteur ---------- */
{
  const { players } = JSON.parse(fs.readFileSync(path.join(SAISONS, pris[0]), 'utf8'));
  const t = players.find(p => p.gp >= 20).t;
  const ps = players.filter(p => p.t === t && p.gp >= 20).map(p => ({ ...p }));
  ps.forEach(registerHiddenRatings);
  const R = autoRoster(ps);
  const L = activeLineup(createTeam('Lu', 'LU', R));
  // Un trio et un style qu'il n'ouvre pas.
  let u = -1, ferme = null;
  for (const x of [0, 1, 2, 3]) { const k = Object.keys(TACTIQUES).find(c => c !== 'hourra' && !styleOuvert(L, 'F', x, c)); if (k) { u = x; ferme = k; break; } }
  if (ferme) {
    const lignes = [0, 1, 2, 3].map(x => ({ tac: x === u ? ferme : 'hourra', tacD: 'hourra' }));
    const rogue = createTeam('Rogue', 'RG', R); rogue.courbe = true; rogue.lignes = lignes;
    const ancien = createTeam('82-0', 'OO', R); ancien.lignes = lignes;
    const lr = lignesDe(rogue, activeLineup(rogue), { duSoir: false })[u].tac, la = lignesDe(ancien, activeLineup(ancien), { duSoir: false })[u].tac;
    exiger('en Rogue, un style fermé joue le meilleur style que ses badges ouvrent', lr !== ferme && styleOuvert(activeLineup(rogue), 'F', u, lr) && lr === meilleurStyle(activeLineup(rogue), 'F', u),
      `${TACTIQUES[ferme].ico} gardé → ${TACTIQUES[lr].ico} joué`);
    exiger('au 82-0, rien ne change : le style gardé se joue', la === ferme);
  } else informer('le moteur', 'aucun trio fermé à un style dans ce club : rien à éprouver');
}

verdict('les styles de trio');
