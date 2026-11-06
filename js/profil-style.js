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
import { POUVOIRS, NIVEAU_DES_POUVOIRS, niveauDuPerso } from './pouvoirs.js';
import { ADJOINTS, nivDe } from './adjoints.js';
import { nomDuNiveau } from './niveaux.js';
import { COACHS, REGLES_DU_COACH } from './coachs.js';
import { chiffresDuSoirDe } from './rogue.js';

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
 * CE QUI JOUAIT TA FORMATION CE SOIR-LÀ, en noms : les pouvoirs du coach qui ont joué (V21, la feuille les garde) et les
 * effets en cours (les histoires, les paris). Tout se relit de la feuille et des effets datés de l'équipe : rien n'est
 * stocké, rien n'est deviné.
 */
export function buildDuSoir(team, jour, feuille = null) {
  const nomIco = x => `${x.ico ? `${x.ico} ` : ''}${x.nom}`;
  const cote = feuille && feuille.B === team ? 'B' : 'A';
  const pouvoirs = ((feuille && feuille.pouvoirs) || []).filter(x => x.cote === cote).map(x => `${nomIco(x)} (${x.k + 1}${x.k ? 'e' : 're'})`);
  const effets = ((team && team.effets) || []).filter(e => e.nom && e.source !== 'match' && jour >= e.debut && jour < e.fin).map(nomIco);
  const unique = xs => [...new Set(xs)];
  return { pouvoirs, effets: unique(effets) };
}

/**
 * TON BANC CE SOIR (V23, docs/refonte-v23.md § A) : tes pouvoirs ouverts et tes adjoints en poste, chacun avec ce qu'il
 * a fait ce soir-là. Un pouvoir « joue » s'il est à la feuille (`feuille.pouvoirs`), avec ses périodes ; un adjoint en
 * poste joue son style chaque soir (`feuille.adjoints`), avec ce qui lui reste. Les pouvoirs ouverts qui n'ont pas joué
 * restent au banc, éteints, leur condition à lire. Rien n'est deviné : la feuille fait foi, le niveau du coach ne sert
 * qu'à nommer les pouvoirs éteints.
 * La règle du coach vient d'abord (V23), allumée le soir où elle paie.
 * `jusqua` (V23 A2, l'entracte du duel) : seulement les périodes déjà jouées (1 après la première, 2 après la deuxième) ;
 * un pouvoir ne s'allume que pour elles, et la règle du coach, lue sur le match entier, attend la fin.
 * Rend [{ genre: 'regle'|'pouvoir'|'adjoint', ico, nom, dit, joue, periodes: [k…], reste, salaire, jetons }].
 */
export function banc(team, feuille, { jusqua = null } = {}) {
  if (!team || !feuille) return [];
  const cote = feuille.B === team ? 'B' : 'A';
  const perso = team.perso;
  const notes = (feuille.pouvoirs || []).filter(x => x.cote === cote && (jusqua == null || x.k < jusqua));
  const arbre = (perso && POUVOIRS[perso.cle]) || [];
  const niveau = perso ? niveauDuPerso({ ...perso, xpSaison: team.xpSaison || 0 }) : 0;
  const ouverts = new Set(notes.map(x => x.p));
  arbre.forEach((_, p) => { if (niveau >= NIVEAU_DES_POUVOIRS[p]) ouverts.add(p); });
  const pouvoirs = [...ouverts].sort((a, b) => a - b).map(p => {
    const P = arbre[p], miennes = notes.filter(x => x.p === p);
    const n0 = miennes[0];
    return {
      genre: 'pouvoir', ico: (P && P.ico) || (n0 && n0.ico) || '', nom: (P && P.nom) || (n0 && n0.nom) || '',
      dit: (P && P.dit) || '', joue: miennes.length > 0, periodes: [...new Set(miennes.map(x => x.k))].sort((a, b) => a - b),
    };
  });
  const adjoints = (feuille.adjoints || []).filter(x => x.cote === cote).map(x => ({
    genre: 'adjoint', ico: x.ico, nom: x.nom, dit: `${nomDuNiveau(nivDe(x) - 1)} · ${(ADJOINTS[x.cle] && ADJOINTS[x.cle].style) || ''}`, joue: true, periodes: [], reste: x.reste, salaire: x.salaire || 0,
  }));
  // V23 D : les relais (`feuille.relais`), une carte par adjoint qui a relayé, avec ses périodes et ce qui l'a allumé.
  const relais = (feuille.relais || []).filter(x => x.cote === cote && (jusqua == null || x.k < jusqua));
  const relayeurs = [...new Set(relais.map(x => x.cle))].map(cle => {
    const xs = relais.filter(x => x.cle === cle), sur = xs[0].sur || {};
    const quoi = sur.genre === 'moment' ? sur.nom.toLowerCase() : `${sur.ico ? `${sur.ico} ` : ''}${(sur.nom || '').replace(/^(Le|La|L')\s?/, m => m.toLowerCase())}`;
    return { genre: 'relais', ico: xs[0].ico, nom: `${xs[0].nom} relaie ${quoi}`, dit: `Relais · ${(ADJOINTS[cle] && ADJOINTS[cle].signal && ADJOINTS[cle].signal.dit) || ''}`, joue: true, periodes: [...new Set(xs.map(x => x.k))].sort((a, b) => a - b) };
  });
  // V23 : la règle du coach (js/coachs.js `REGLES_DU_COACH`), allumée le soir où elle paie.
  const R = jusqua == null && perso && REGLES_DU_COACH[perso.cle];
  const regle = R ? [{ genre: 'regle', ico: COACHS[perso.cle].ico, nom: R.dit, dit: `La règle ${COACHS[perso.cle].de} : +${R.jetons} 🪙 le soir où ton club la tient`, joue: R.lit(chiffresDuSoirDe(feuille, cote)), periodes: [], jetons: R.jetons }] : [];
  return [...regle, ...pouvoirs, ...adjoints, ...relayeurs];
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
