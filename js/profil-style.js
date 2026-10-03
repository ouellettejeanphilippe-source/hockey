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

import { tirsTotal, CARTES, TACTIQUES, SYSTEMES_D, AGRESSIVITES, IMPORTANCES } from './sim.js';
import { PATRONS } from './banque.js';
import { CARTES_MATCH } from './combat.js';
import { virgule } from './util.js';

/** Combien de derniers matchs le profil lit. */
export const N_PROFIL = 10;
/** Sous ce nombre de matchs de toi, ou de côtés de la ligue, aucun profil : un chiffre trop mince n'est pas un style. */
export const MIN_MATCHS = 5;
export const MIN_LIGUE = 30;

/*
 * LES SEUILS DU MOT. Chacun est un peu plus que deux fois l'erreur d'une
 * moyenne de dix matchs (rythme : écart type d'un match ≈ 7 tirs, soit ≈ 2,2 sur
 * dix ; punitions ≈ 1,9, soit ≈ 0,6) : en dessous, c'est du hasard et on ne le
 * baptise pas.
 */
export const SEUILS = { rythme: 4, coups: 4, punitions: 1, tirs: 2 };

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
    butsPour: cote === 'A' ? f.gfA : f.gfB,
    butsContre: cote === 'A' ? f.gfB : f.gfA,
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

/**
 * Le mot de style, lu sur les écarts à la ligue : `{ mots, note }` ou null sans
 * profil. `mots` peut être vide (« dans la moyenne ») ; `note` dit, quand les
 * chiffres le montrent, que tu tires moins sans que les autres tirent moins —
 * le cas où un choix défensif ne donne pas un match fermé.
 */
export function motDeStyle(p, l) {
  if (!p || !l) return null;
  const mots = [];
  const dr = p.rythme - l.rythme;
  if (dr <= -SEUILS.rythme) mots.push('jeu fermé');
  else if (dr >= SEUILS.rythme) mots.push('jeu ouvert');
  if (p.coups != null && l.coups != null && p.coups - l.coups >= SEUILS.coups) mots.push('jeu de contact');
  const dp = p.punitions - l.punitions;
  if (dp >= SEUILS.punitions) mots.push('indiscipliné');
  else if (dp <= -SEUILS.punitions) mots.push('discipliné');
  let note = null;
  if (p.tirsPour - l.tirsPour <= -SEUILS.tirs && p.tirsContre - l.tirsContre >= -SEUILS.tirs / 2) note = 'Tu tires moins, mais les autres ne tirent pas moins : un jeu plus pauvre, pas plus fermé.';
  else if (p.tirsContre - l.tirsContre <= -SEUILS.tirs && p.tirsPour - l.tirsPour >= SEUILS.tirs / 2) note = 'Tu tires plus et ils tirent moins : tu as la rondelle.';
  return { mots, note };
}

/** Un nombre de match, à la québécoise : « 27,4 ». */
export const dire = (x, d = 1) => (x == null ? '—' : virgule(x.toFixed(d)));

/**
 * CE QUI JOUAIT TA FORMATION CE SOIR-LÀ, en noms : les cartes de saison, les
 * patrons, les effets en cours (événements, dilemmes, séquences, paris), les
 * systèmes et l'agressivité réglés, la consigne du soir, les cartes de match
 * jouées. Tout se relit des décisions et des effets datés de l'équipe : rien
 * n'est stocké, rien n'est deviné. `decisions` : celles de ta formation.
 */
export function buildDuSoir(team, decisions, jour, feuille = null) {
  const ds = (decisions || []).filter(d => d && (d.equipe || 0) === 0 && Number.isFinite(d.jour) && d.jour <= jour).sort((a, b) => a.jour - b.jour);
  const nomIco = x => `${x.ico ? `${x.ico} ` : ''}${x.nom}`;
  const cartes = ds.filter(d => d.carte && CARTES[d.carte]).map(d => nomIco(CARTES[d.carte]));
  let patrons = [];
  for (const d of ds) {
    if (!d.patron || !d.patron.cle) continue;
    const rempl = new Set([d.patron.cle, ...(d.patron.remplace || [])]);
    patrons = [...patrons.filter(c => !rempl.has(c) && !(d.patron.role && PATRONS[c] && PATRONS[c].role === d.patron.role)), d.patron.cle];
  }
  const effets = ((team && team.effets) || []).filter(e => e.nom && e.source !== 'match' && jour >= e.debut && jour < e.fin).map(nomIco);
  const lignes = ds.filter(d => Array.isArray(d.lignes)).pop();
  const systemes = [], agressivites = [];
  for (const l of (lignes ? lignes.lignes : [])) {
    if (l.tac && TACTIQUES[l.tac] && l.tac !== 'hourra') systemes.push(nomIco(TACTIQUES[l.tac]));
    if (l.tacD && SYSTEMES_D[l.tacD] && l.tacD !== 'hourra') systemes.push(nomIco(SYSTEMES_D[l.tacD]));
    if (Number.isInteger(l.agr) && AGRESSIVITES[l.agr] && l.agr !== 1) agressivites.push(nomIco(AGRESSIVITES[l.agr]));
  }
  const unique = xs => [...new Set(xs)];
  const soir = ds.filter(d => d.jour === jour && d.match).pop();
  const I = soir && IMPORTANCES[soir.match.importance];
  const ad = soir ? Number(soir.match.ad) || 0 : 0;
  const consigne = I && (soir.match.importance !== 'normale' || ad) ? `${I.ico} Consigne ${I.nom}${ad > 0 ? ' · attaque' : ad < 0 ? ' · défense' : ''}` : null;
  const jouees = ((feuille && feuille.cartes && feuille.cartes.jouees) || []).filter(c => CARTES_MATCH[c]).map(c => nomIco(CARTES_MATCH[c]));
  return {
    cartes, patrons: patrons.filter(c => PATRONS[c]).map(c => nomIco(PATRONS[c])), effets: unique(effets),
    systemes: unique(systemes), agressivites: unique(agressivites), consigne, jouees,
  };
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
