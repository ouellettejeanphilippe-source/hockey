/**
 * LE PROFIL DE STYLE — la preuve que ton build joue (docs/impact-des-choix.md, §6).
 *
 * JP : *ça doit être clair que le build que je fais a un impact pour vrai ; si
 * je fais juste des choix défensifs, ça devrait être un match défensif.* Ce
 * module ne change RIEN au moteur : il lit les feuilles de match déjà gardées
 * et dit, en chiffres de match, comment ton club joue contre les autres.
 *
 * Module PUR (aucun DOM, aucun `hasard()`), partagé par le navigateur et par
 * `scripts/check_profil.mjs`. Ce que la feuille dit, et ce qu'elle ne dit pas :
 *   - tirs au filet (arrêts + buts) : comptés, par période ;
 *   - buts, punitions (de chaque club) : comptés ;
 *   - mises en échec : `feuille.coups`, des coups ATTENDUS (la même formule que
 *     le moteur, arrondie) et non comptés un à un — l'écran le dit ;
 *   - tirs bloqués, tentatives ratées : la feuille ne les connaît pas, rien
 *     n'est inventé.
 * Le mot de style est une lecture des écarts à la ligue, jamais une cote ni un
 * vote : sans assez de matchs, il n'y a pas de mot.
 */

import { tirsTotal } from './sim.js';
import { virgule } from './util.js';

/** Combien de derniers matchs le profil lit. */
export const N_PROFIL = 10;
/** Sous ce nombre de matchs de toi, ou de côtés de la ligue, aucun profil : un chiffre trop mince n'est pas un style. */
export const MIN_MATCHS = 5;
export const MIN_LIGUE = 30;

/* Les matchs joués d'un calendrier, à plat, avec leur journée. */
export function matchsJoues(calendrier) {
  const out = [];
  (calendrier || []).forEach((jour, j) => {
    for (const m of jour || []) if (m && m.feuille && m.feuille.tirs) out.push({ jour: j, A: m.A, B: m.B, f: m.feuille });
  });
  return out;
}

/** Ce qu'une feuille dit d'un côté (`cote` : 'A' ou 'B'). Les mises en échec sont `null` si la feuille ne les porte pas. */
export function chiffresDuMatch(f, cote) {
  const autre = cote === 'A' ? 'B' : 'A';
  const coups = f.coups && Number.isFinite(f.coups[cote]) ? f.coups[cote] : null;
  const tirsPour = tirsTotal(f, cote), tirsContre = tirsTotal(f, autre);
  return {
    tirsPour, tirsContre,
    // Le but des tirs de barrage (V19) fait gagner le match sans être marqué par personne : il n'est ni pour ni contre.
    butsPour: (cote === 'A' ? f.gfA : f.gfB) - (f.fusillade && f.fusillade.gagnant === cote ? 1 : 0),
    butsContre: (cote === 'A' ? f.gfB : f.gfA) - (f.fusillade && f.fusillade.gagnant === autre ? 1 : 0),
    punitions: (f.punitions || []).filter(p => p.cote === cote).length,
    coups,
    rythme: tirsPour + tirsContre,
  };
}

const CLES = ['tirsPour', 'tirsContre', 'butsPour', 'butsContre', 'punitions', 'coups', 'rythme'];

/* La moyenne de chaque colonne ; `coups` se moyenne sur les feuilles qui le portent. */
function moyenne(lignes) {
  if (!lignes.length) return null;
  const out = { n: lignes.length };
  for (const k of CLES) {
    const v = lignes.map(l => l[k]).filter(x => x != null);
    out[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  return out;
}

/** Ton profil : la moyenne de tes `n` derniers matchs d'avant la journée `avant` (exclue), ou null s'il y en a trop peu. */
export function profilDuClub(matchs, club, { n = N_PROFIL, avant = Infinity } = {}) {
  const miens = matchs.filter(m => m.jour < avant && (m.A === club || m.B === club)).slice(-n);
  if (miens.length < MIN_MATCHS) return null;
  return moyenne(miens.map(m => chiffresDuMatch(m.f, m.A === club ? 'A' : 'B')));
}

/** Les autres clubs : la moyenne de tous les côtés de feuille qui ne sont pas le tien, avant la journée `avant` (exclue). */
export function profilDeLigue(matchs, club, { avant = Infinity } = {}) {
  const lignes = [];
  for (const m of matchs) {
    if (m.jour >= avant) continue;
    if (m.A !== club) lignes.push(chiffresDuMatch(m.f, 'A'));
    if (m.B !== club) lignes.push(chiffresDuMatch(m.f, 'B'));
  }
  return lignes.length < MIN_LIGUE ? null : moyenne(lignes);
}

/** Un nombre de match, à la québécoise : « 27,4 ». */
export const dire = (x, d = 1) => (x == null ? '—' : virgule(x.toFixed(d)));

/**
 * CE QUI JOUAIT TA FORMATION CE SOIR-LÀ, en noms : les effets en cours qu'une vieille partie porte. Tout se relit des
 * effets datés de l'équipe : rien n'est stocké, rien n'est deviné. (Les pièces du banc d'un coach-personnage sont
 * parties d'ici avec l'ancien Rogue : la run en carte montre son banc elle-même.)
 */
export function buildDuSoir(team, jour) {
  const nomIco = x => `${x.ico ? `${x.ico} ` : ''}${x.nom}`;
  const effets = ((team && team.effets) || []).filter(e => e.nom && e.source !== 'match' && jour >= e.debut && jour < e.fin).map(nomIco);
  return { effets: [...new Set(effets)] };
}

/** Le build du soir est-il vide ? */
export const buildVide = b => !b || !Object.values(b).some(v => (Array.isArray(v) ? v.length : v));

/**
 * L'ÉCART DU SOIR : ce que le match a donné, ta moyenne d'avant et la ligue, côte à côte.
 * `moi` et `lig` peuvent être null (pas assez de matchs d'avant) : la colonne manque, rien n'est inventé.
 */
export function ecartsDuSoir(f, cote, moi, lig) {
  const s = chiffresDuMatch(f, cote);
  const lignes = [
    ['Tirs pour', 'tirsPour'], ['Tirs contre', 'tirsContre'], ['Buts pour', 'butsPour'], ['Buts contre', 'butsContre'],
    ['Mises en échec', 'coups'], ['Punitions', 'punitions'], ['Tirs en tout', 'rythme'],
  ];
  return lignes.filter(([, k]) => s[k] != null).map(([nom, k]) => ({
    nom, cle: k, soir: s[k], moyenne: moi && moi[k] != null ? moi[k] : null, ligue: lig && lig[k] != null ? lig[k] : null,
  }));
}
