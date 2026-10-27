/*
 * LE DÉCOR CALME, LES CARTES BELLES (refonte coachs-cartes-incidents, oct. 2026 ; JP : *les cartes elles-mêmes, c'est
 * nice, c'est le reste de l'interface qui doit être drabe, à côté des cartes qui ne le sont pas* ; *penser comme
 * GM Connected*). Lu dans style.css, sans navigateur :
 *
 *   1. AUCUNE BOUCLE DANS LE DÉCOR. Une animation `infinite` n'est permise que pour ce qui charge (`spin`,
 *      `voile-glisse`), pour les cartes, les paquets et le walkout (leurs finitions), et pour Sur table. Une boucle
 *      neuve est un décor qui crie : elle entre dans la liste blanche, ou elle part.
 *   2. UNE SEULE ENTRÉE POUR LE DÉCOR : un fondu. Les keyframes d'entrée d'un écran, d'une feuille, d'une rangée ou
 *      d'un panneau ne bougent pas (ni `transform`, ni `letter-spacing`).
 *   3. LES CARTES GARDENT LEURS FINITIONS : le scintillement, le prisme, le reflet, le paquet et leur entrée
 *      (`carte-entre`) existent et servent. Les nettoyer par erreur est le seul échec qu'on ne veut pas.
 *   4. LE MOUVEMENT S'ÉTEINT POUR QUI LE DEMANDE (`prefers-reduced-motion`).
 *
 *   node scripts/check_lisibilite.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/* Les @keyframes : leur nom et leur corps, accolades appariées. */
const keyframes = new Map();
for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
  let i = m.index + m[0].length, prof = 1;
  while (i < css.length && prof) { if (css[i] === '{') prof++; else if (css[i] === '}') prof--; i++; }
  keyframes.set(m[1], css.slice(m.index + m[0].length, i - 1));
}
/* Les règles à déclarations : le sélecteur et le corps (une règle sans accolade dedans, dans ou hors d'un @media). */
const regles = [...css.matchAll(/([^{}@][^{}]*)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), corps: m[2] }));
informer('feuille lue', `${keyframes.size} @keyframes, ${regles.length} règles`);

/* 1. Les boucles. */
{
  const LISTE_BLANCHE = {
    'le chargement': ['spin', 'voile-glisse'],
    'les cartes, les paquets, le walkout': ['ed-scintille', 'ed-prisme', 'ed-balaie', 'paquet-flotte', 'paquet-pouls', 'paquet-reflet', 'wo-rayons', 'fc-attend'],
    'Sur table': ['t-vise', 't-sifflet-point'],
  };
  const permises = new Set(Object.values(LISTE_BLANCHE).flat());
  const boucles = [];
  for (const r of regles) for (const m of r.corps.matchAll(/animation:\s*([^;]*)/g)) {
    if (!/\binfinite\b/.test(m[1])) continue;
    const nom = (m[1].match(/(?:^|\s)([a-zA-Z][\w-]*)(?=\s|$)/g) || []).map(x => x.trim()).find(x => keyframes.has(x));
    boucles.push({ nom: nom || '?', sel: r.sel.split('\n').pop().slice(0, 60) });
  }
  const hors = boucles.filter(b => !permises.has(b.nom));
  exiger('aucune boucle dans le décor (hors le chargement, les cartes, Sur table)', hors.length === 0, hors.map(b => `${b.nom} sur ${b.sel}`).join(' · ') || `${boucles.length} boucles, toutes de la liste blanche`);
  const inutiles = [...permises].filter(n => !boucles.some(b => b.nom === n));
  exiger('la liste blanche ne garde pas de boucle morte', inutiles.length === 0, inutiles.join(' · ') || 'chacune joue encore');
}

/* 2. L'entrée du décor : un fondu. */
{
  const ENTREES = ['ecran-entre', 'panneau-monte', 'feuille-entre', 'rangee-entre', 'ligneIn', 'hier-neuf', 'logo-entre'];
  const manquent = ENTREES.filter(n => !keyframes.has(n));
  const bougent = ENTREES.filter(n => keyframes.has(n) && /transform|letter-spacing|scale|translate/.test(keyframes.get(n)));
  exiger('les sept entrées du décor existent', manquent.length === 0, manquent.join(' · ') || ENTREES.join(' · '));
  exiger('une entrée du décor est un fondu : ni déplacement, ni zoom', bougent.length === 0, bougent.join(' · ') || 'opacité seulement');
  const longues = [];
  for (const r of regles) for (const m of r.corps.matchAll(/animation:\s*(ecran-entre|panneau-monte|feuille-entre|rangee-entre|hier-neuf|logo-entre)\s+(\d+)ms/g)) if (Number(m[2]) > 300 && !/\.menu-logo/.test(r.sel)) longues.push(`${m[1]} ${m[2]} ms sur ${r.sel.split('\n').pop().slice(0, 40)}`);
  exiger('une entrée du décor dure 300 ms au plus (le logo de l\'écran titre, une seule fois, fait exception)', longues.length === 0, longues.join(' · ') || 'toutes courtes');
}

/* 3. Les cartes gardent leurs finitions. */
{
  const FINITIONS = ['ed-scintille', 'ed-prisme', 'ed-balaie', 'paquet-flotte', 'paquet-pouls', 'paquet-reflet', 'wo-rayons', 'carte-entre'];
  const perdues = FINITIONS.filter(n => !keyframes.has(n) || !regles.some(r => new RegExp(`animation:[^;]*\\b${n}\\b`).test(r.corps)));
  exiger('les cartes gardent leurs finitions (scintillement, prisme, reflet, paquet, entrée)', perdues.length === 0, perdues.join(' · ') || `${FINITIONS.length} animations de cartes en place`);
  const carte = /\.spin-card[^{}]*\{[^{}]*animation:\s*carte-entre/.test(css) && /\.pcard\.cj-apparait[^{}]*\{[^{}]*animation:\s*carte-entre/.test(css);
  exiger('une carte entre en montant, pas en fondu', carte && /transform/.test(keyframes.get('carte-entre') || ''), 'la roulette et la carte tirée');
}

/* 4. Le mouvement s'éteint. */
exiger('prefers-reduced-motion coupe le mouvement', /@media \(prefers-reduced-motion: reduce\)\s*\{[^{}]*\*[^{}]*\{[^{}]*animation-duration/.test(css), 'une règle générale');

verdict('Le décor calme, les cartes belles');
