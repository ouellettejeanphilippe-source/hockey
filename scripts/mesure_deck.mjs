/*
 * LA MAIN DU DECK, PESÉE (6 nov. 2026 ; JP : *revoir les cartes des matchs vingt et cie, ils sont pas balancés*).
 * Aux 20e, 40e et 60e matchs, trois cartes de trois sortes : un joueur au choix (`recrue`, un vrai Régulier ou Pilier
 * tiré au loto), un nouveau rôle (`profil`, une mutation sur un de tes joueurs, pour de bon), l'atelier (`atelier`, une
 * retouche d'édition : la carte monte d'une édition, son second badge avec). Chacune se pèse comme une carte
 * (check_effets) : en paires, les mêmes dés avec et sans, N matchs par club contre une copie du même club, et le net en
 * victoires ramené aux soirs qui restent (62 depuis le 20e match). La borne : celle du niveau que la carte affiche
 * (js/saison.js `NIVEAU_SORTE` : la recrue en ★ Phénomène, 4 V ; le rôle en Pilier, 1,5 V ; l'atelier en ★ Étoile, 2,5 V).
 *
 *   node scripts/mesure_deck.mjs            (N=120 matchs par club et par carte, quatre clubs : quatre minutes)
 *   N=3000 CLUB=0 … CLUB=3                  (un club par processus : σ ≈ 0,8 V ; à N=120 le bruit fait ±3 V)
 *   PLEIN=1                                 (aussi : la retouche en Hors-cadre et en Or, la recrue à la place du 9e avant)
 *   ROLE_X=2 ROLE_HAUT=1                    (les écarts des rôles doublés ; le rôle posé sur ta vedette plutôt que sur la cible du jeu)
 *   GRAINE=b                                (d'autres dés)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, SLOTS, activeLineup, depenserEnergie,
  getPlayerKey, rolesOfferts, appliquerMutation, MUTATIONS } from '../js/sim.js';
import { NIVEAUX, REGULIER, PILIER, niveauDe, cote20 } from '../js/niveaux.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const N = Number(process.env.N || 120), N_CLUBS = Number(process.env.CLUBS || 4), J0 = Number(process.env.JOUR || 20), SOIRS = 82 - J0;
const NIVEAU_SORTE = { recrue: 4, profil: 2, atelier: 3 };

/* Des clubs de plusieurs époques, avec leur shard (le loto de la recrue y pige). */
function clubs(n) {
  const out = [];
  for (let i = 0; i < SAISONS.length && out.length < n; i += Math.max(1, Math.floor(SAISONS.length / n))) {
    const sh = JSON.parse(fs.readFileSync(path.join(DIR, SAISONS[i]), 'utf8'));
    for (const tag of [...new Set(sh.players.map(p => p.t))]) {
      let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
      if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
      out.push({ sh, tag, un });
      break;
    }
  }
  return out;
}
/* Le même club à chaque copie : l'alignement automatique tire dans le hasard global, on le sème avant de bâtir (comme check_effets). */
const equipe = ({ sh, tag, un }, role = 'toi') => { grainerHasard(`deck:${tag}:${role}`); const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(`${tag} ${sh.season}`, tag, autoRoster(p), { season: sh.season }); };
function match(toi, adv, graine, visiteur) {
  for (const t of [toi, adv]) { for (const sl of SLOTS) { const p = t.roster[sl.i]; if (p) p.energie = 100; } if (t.injured) t.injured.clear(); t.jourCourant = 0; }
  grainerHasard(graine);
  const f = feuilleVierge();
  const r = visiteur ? playGame(adv, toi, 1, false, false, f) : playGame(toi, adv, 1, false, false, f);
  depenserEnergie(toi, activeLineup(toi));
  return { v: r.winner === toi ? 1 : 0, net: (visiteur ? r.gfB - r.gfA : r.gfA - r.gfB) };
}
/* Les avants alignés (les quatre trios), du plus fort au plus faible à sa cote sur 20. */
const avantsAlignes = (t, joueurs) => SLOTS.filter(sl => !sl.scratch && sl.group === 'F').map(sl => t.roster[sl.i]).filter(Boolean)
  .map(p => ({ p, sl: SLOTS.find(sl => t.roster[sl.i] === p), cote: cote20(p, joueurs) || 0 })).sort((a, b) => b.cote - a.cote);
/* Un avant d'un autre club du même shard, au niveau demandé, le premier dans l'ordre d'une hache ; `null` si aucun. */
function recrue(sh, tag, niveau, deja) {
  const pool = sh.players.filter(p => p.t !== tag && p.p !== 'G' && p.p !== 'D' && p.p !== 'LD' && p.p !== 'RD' && (p.gp || 0) >= 40 && p.$ > 0 && niveauDe(p, sh.players) === niveau && !deja.has(getPlayerKey(p)));
  pool.sort((a, b) => (getPlayerKey(a) < getPlayerKey(b) ? -1 : 1));
  return pool[Math.floor(pool.length / 2)] || null;
}
const f2 = x => (x >= 0 ? '+' : '') + x.toFixed(2).replace('.', ',');

const variantes = [];
// CLUB=i : un seul des clubs (le i-ème), pour paralléliser la mesure sur plusieurs processus.
const TEMOINS = process.env.CLUB != null ? [clubs(N_CLUBS)[Number(process.env.CLUB)]].filter(Boolean) : clubs(N_CLUBS);
console.log(`\n  La main du deck, pesée (N=${N} matchs par club et par carte, ${TEMOINS.length} clubs, depuis le ${J0}e match : ${SOIRS} soirs)\n`);
for (const T of TEMOINS) {
  // Un adversaire PAR variante : il joue exactement la même suite de matchs contre chacune (sinon sa rotation de gardiens
  // et ses compteurs décalent le match de base de ceux des variantes, et toutes les variantes d'un club penchent du même bord).
  const sans = equipe(T), adv = equipe(T, 'eux');
  const joueurs = T.sh.players;
  const cas = [];
  // Le témoin à zéro : la même équipe, sans rien ; ce qu'il mesure est le bruit du harnais (il doit tomber à 0 V).
  cas.push({ sorte: 'temoin', nom: 'témoin · rien', t: equipe(T) });
  // Le nouveau rôle : les trois offerts, chacun à part (le joueur en prend un). ROLE_X=2 double les écarts de ses canaux
  // (les profils restent) ; ROLE_HAUT=1 le pose sur ta vedette (ou ton meilleur défenseur) au lieu de la cible du jeu.
  const roles = rolesOfferts(equipe(T), 'mesure', J0);
  const X = Number(process.env.ROLE_X || 1), haut = process.env.ROLE_HAUT === '1';
  const CANAUX_ROLE = ['finition', 'lancers', 'creation', 'defense', 'blessure', 'arrets'];
  roles.forEach((r, k) => {
    const t = equipe(T), M = MUTATIONS[r.cle], sauve = Object.fromEntries(CANAUX_ROLE.filter(c => M[c]).map(c => [c, M[c]]));
    const al = avantsAlignes(t, joueurs), defs = SLOTS.filter(sl => !sl.scratch && sl.group === 'D').map(sl => t.roster[sl.i]).filter(Boolean)
      .map(p => ({ p, cote: cote20(p, joueurs) || 0 })).sort((a, b) => b.cote - a.cote);
    const p = haut ? (r.p.p === 'D' || r.p.p === 'LD' || r.p.p === 'RD' ? defs[0].p : al[0].p) : Object.values(t.roster).find(x => x && getPlayerKey(x) === getPlayerKey(r.p));
    for (const c of Object.keys(sauve)) M[c] = 1 + (sauve[c] - 1) * X;
    appliquerMutation(t, p, r.cle, J0, 'choix');
    Object.assign(M, sauve);
    cas.push({ sorte: 'profil', nom: `rôle ${k + 1} · ${M.nom} → ${p.n}${X !== 1 ? ` ×${X}` : ''}`, t });
  });
  // L'atelier : la retouche monte la carte d'UNE édition (Base → Cadre : le second badge monte d'un) ; sur ta vedette.
  for (const [rar, mot] of [['peu', 'Cadre'], ['hors', 'Hors-cadre'], ['rare', 'Or']]) {
    if (rar !== 'peu' && !process.env.PLEIN) continue;
    const t = equipe(T), [star] = avantsAlignes(t, joueurs);
    appliquerMutation(t, star.p, 'pinceau', J0, 'atelier', { carte: { rar } });
    cas.push({ sorte: 'atelier', nom: `retouche · ${mot} sur ${star.p.n} (${star.cote.toFixed(1)})`, t });
  }
  // La recrue : un vrai Régulier, puis un vrai Pilier, à la place de ton avant aligné le plus faible (le plafond ignoré : la borne haute).
  for (const [niv, mot, neuf] of [[REGULIER, 'Régulier', false], [PILIER, 'Pilier', false], [REGULIER, 'Régulier', true], [PILIER, 'Pilier', true]]) {
    if (neuf && !process.env.PLEIN) continue;
    const t = equipe(T), al = avantsAlignes(t, joueurs), faible = neuf ? al.slice(0, 9)[8] : al[al.length - 1];
    const q = recrue(T.sh, T.tag, niv, new Set(Object.values(t.roster).filter(Boolean).map(getPlayerKey)));
    if (!q) continue;
    const r = { ...q }; registerHiddenRatings(r);
    t.roster[faible.sl.i] = r;
    cas.push({ sorte: 'recrue', nom: `recrue · ${mot} ${r.n} (${(cote20(r, joueurs) || 0).toFixed(1)}) pour ${faible.p.n} (${faible.cote.toFixed(1)}${neuf ? ', 9e avant' : ''})`, t });
  }
  for (const c of cas) { c.dv = 0; c.dnet = 0; c.adv = equipe(T, 'eux'); }
  for (let i = 0; i < N; i++) {
    const g = `${process.env.GRAINE || 'deck'}:${T.tag}:${i}`, visiteur = i % 2 === 1;
    const base = match(sans, adv, g, visiteur);
    for (const c of cas) { const m = match(c.t, c.adv, g, visiteur); c.dv += m.v - base.v; c.dnet += m.net - base.net; }
  }
  for (const c of cas) {
    const V = (c.dv / N) * SOIRS, lim = c.sorte === 'temoin' ? 0.5 : NIVEAUX[NIVEAU_SORTE[c.sorte]].borneV;
    variantes.push({ ...c, V, lim, club: sans.name });
    informer(`${sans.name} · ${c.nom}`, `${f2(c.dnet / N)} but net par soir · ${f2(V)} V sur ${SOIRS} soirs (borne ${String(lim).replace('.', ',')} V)${Math.abs(V) > lim ? ' ▲' : ''}`);
  }
}
console.log('');
for (const sorte of Object.keys(NIVEAU_SORTE)) {
  const xs = variantes.filter(v => v.sorte === sorte).map(v => v.V).sort((a, b) => a - b);
  if (!xs.length) continue;
  const med = xs[Math.floor(xs.length / 2)], moy = xs.reduce((a, b) => a + b, 0) / xs.length;
  informer(`${sorte} (${NIVEAUX[NIVEAU_SORTE[sorte]].nom}, borne ${String(NIVEAUX[NIVEAU_SORTE[sorte]].borneV).replace('.', ',')} V)`, `${xs.length} cas · médiane ${f2(med)} V · moyenne ${f2(moy)} V · de ${f2(xs[0])} à ${f2(xs[xs.length - 1])}`);
}
verdict('La main du deck, pesée (une mesure : aucune borne exigée ici)');
