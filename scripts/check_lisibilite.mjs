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
 *   5. DES SURFACES PLATES (JP : *penser comme GM Connected*) : la surface de base (`--panneau`, `--relief`) est un aplat sans
 *      ombre, et ni les onglets, ni la barre, ni les boutons, ni les choix ne portent de dégradé ; l'onglet ouvert est un bloc
 *      plein et clair, texte noir, le même partout.
 *   6. LES TUILES DE CHOIX SONT SOBRES (tranche 6, la décision unifiée ; JP : *un verbe, au plus deux lignes de stats,
 *      trois options au plus, la recommandée marquée par sa place*). Lu sur le code et les données, sur de vrais clubs :
 *      aucune fenêtre de choix n'offre plus de trois options, aucune option (dilemme, séquence, avant-match, réponse,
 *      dossier, fil) ne montre plus de deux lignes de stats vertes ou rouges (`LIGNES_MAX`) — les autres
 *      se plient sous « Les chiffres », sans rien perdre —, et la tuile est un aplat : ni dégradé, ni ombre, ni saut.
 *      La recommandée n'a pas de macaron : elle est la PREMIÈRE de la liste (le rang dit la recommandation).
 *   7. AUCUN ACCORDÉON (JP, 28 oct. : *j'hais les accordéons*). Aucun `<details>` ni `<summary>` dans AUCUN fichier de js/
 *      (`SANS_PLI` les lit tous, y compris ceux qu'on écrira) ni dans index.html. Une info courte est un bloc toujours visible ;
 *      une longue liste défile dans sa feuille, se charge à l'approche, ou s'ouvre en page ou en feuille par une rangée
 *      (`rangeeHtml`, js/saison.js ; `ouvrirChoix`).
 *
 *   node scripts/check_lisibilite.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, MOMENTS, SEQUENCES, optionsDeSequence, AVANT_GROS } from '../js/sim.js';
import { poserClubLu } from '../js/impact.js';
import { optionHtml, LIGNES_MAX } from '../js/gerant.js';
import { DOSSIERS } from '../js/dossiers.js';
import { REPONSES_VIE, CHOIX_DES_FILS } from '../js/vie-gm.js';
import { equipeReelle } from './lib/vestiaires.mjs';
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

/* 5. Des surfaces plates. */
{
  const racine = css.match(/:root\s*\{[^}]*\}/g).join(' ');
  const decl = nom => (racine.match(new RegExp(`${nom}:\\s*([^;]+);`)) || [])[1] || '';
  exiger('la surface de base est un aplat : --panneau sans dégradé', !/gradient\(/.test(decl('--panneau')) && decl('--panneau') !== '', decl('--panneau'));
  exiger('la surface de base est sans ombre : --relief ne porte ni flou ni décalage', /^0 0 0 0 /.test(decl('--relief').trim()), decl('--relief'));
  const DECOR = [/^\.navtab/, /^\.navbar/, /^\.btn\.(go|gold)\b/, /^\.choix-option(\.on)?$/, /^\.hub-hier/, /^:is\(\.soustab/];
  const fautes = regles.filter(r => DECOR.some(d => d.test(r.sel)) && /gradient\(/.test(r.corps)).map(r => r.sel);
  exiger('ni les onglets, ni la barre, ni les boutons, ni les choix ne portent de dégradé', !fautes.length, fautes.join(' · ') || 'aucun');
  const actif = regles.find(r => /^:is\(\.soustab[^)]*\)\.on$/.test(r.sel));
  const barre = regles.find(r => r.sel === '.navtab.on');
  exiger('l\'onglet ouvert est un bloc plein et clair, texte noir — en haut comme dans la barre', !!actif && !!barre && /background:\s*var\(--encre\)/.test(actif.corps) && /color:\s*var\(--noir\)/.test(actif.corps) && /background:\s*var\(--encre\)/.test(barre.corps) && /color:\s*var\(--noir\)/.test(barre.corps));
}

/* 6. Les tuiles de choix, sobres. */
{
  const OPTIONS_MAX = 3;
  const FAMILLES = [
    ['dilemme', MOMENTS], ['séquence', Object.fromEntries(Object.keys(SEQUENCES).map(k => [k, { options: optionsDeSequence(k) }]))],
    ['avant-match', AVANT_GROS], ['réponse', REPONSES_VIE], ['dossier', DOSSIERS], ['choix de fil', CHOIX_DES_FILS],
  ];
  // Le nombre d'options : les fenêtres de ces familles.
  const trop = [];
  let nFenetres = 0;
  for (const [cat, liste] of FAMILLES) for (const [cle, ev] of Object.entries(liste)) { nFenetres++; if ((ev.options || []).length > OPTIONS_MAX) trop.push(`${cat} ${cle} : ${ev.options.length}`); }
  exiger(`une fenêtre de choix offre trois options au plus (${nFenetres} fenêtres)`, !trop.length, trop.join(' · ') || `au plus ${Math.max(...FAMILLES.flatMap(([, l]) => Object.values(l).map(e => (e.options || []).length)))}`);

  // Les lignes de stats : la tuile telle que l'écran la dessine (`optionHtml`), sur des clubs de plusieurs époques.
  const DIR = path.join(ROOT, 'data', 'seasons');
  const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
  const clubs = [];
  for (let i = 0; i < SAISONS.length && clubs.length < 4; i += Math.max(1, Math.floor(SAISONS.length / 4))) {
    const sh = JSON.parse(fs.readFileSync(path.join(DIR, SAISONS[i]), 'utf8'));
    for (const tag of new Set(sh.players.map(p => p.t))) {
      let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
      if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
      const ps = un.flat().map(x => ({ ...x })); ps.forEach(registerHiddenRatings);
      clubs.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(ps), { season: sh.season }));
      break;
    }
  }
  const lignes = html => {
    const puces = [...html.matchAll(/<span class="puce ([^"]*)"/g)].map(m => m[1]);
    const colorees = puces.filter(c => /\b(bon|prix)\b/.test(c));
    return { vues: colorees.filter(c => !/\bdetail\b/.test(c)).length, toutes: colorees.length };
  };
  const tuiles = [];
  for (const [cat, liste] of FAMILLES) for (const [cle, ev] of Object.entries(liste)) for (const o of ev.options || []) tuiles.push({ id: `${cat} ${cle}.${o.cle}`, o });
  const debordent = [], perdent = [];
  let maxVues = 0;
  for (const club of clubs) {
    poserClubLu(() => ({ team: club }));
    const lire = (id, o, mots) => {
      const sobre = lignes(optionHtml(o, {}, mots ? { mots } : {})), plein = lignes(optionHtml(o, {}, { ...(mots ? { mots } : {}), plein: true }));
      maxVues = Math.max(maxVues, sobre.vues);
      if (sobre.vues > LIGNES_MAX) debordent.push(`${id} (${club.name}) : ${sobre.vues}`);
      if (sobre.toutes !== plein.toutes) perdent.push(`${id} (${club.name})`);
    };
    for (const { id, o } of tuiles) lire(id, o, null);
  }
  poserClubLu(null);
  informer('les clubs lus', clubs.map(c => c.name).join(' · '));
  exiger(`une option montre ${LIGNES_MAX} lignes de stats vertes ou rouges au plus (${tuiles.length} options, sur ${clubs.length} clubs)`, !debordent.length, debordent.slice(0, 6).join(' · ') || `au plus ${maxVues}`);
  exiger('plier une ligne de trop ne la perd pas : elle reste sous « Les chiffres »', !perdent.length, perdent.slice(0, 6).join(' · ') || 'rien ne disparaît');

  // L'aplat : la tuile de base n'a ni dégradé, ni ombre, ni relief ; son survol ne la déplace pas et ne la zoome pas.
  const base = regles.filter(r => r.sel === '.choix-option');
  const survol = regles.filter(r => /^\.choix-option(:hover|:focus-visible|:active|\.on)(?![\w.-])/.test(r.sel.split(',')[0].trim()) && !/\.tc\b/.test(r.sel));
  const decor = /gradient|shadow|--relief|--reflet|--panneau/;
  const fautes = [
    ...base.filter(r => decor.test(r.corps)).map(() => 'la tuile de base a un dégradé ou une ombre'),
    ...survol.filter(r => decor.test(r.corps) || /transform/.test(r.corps)).map(r => `${r.sel.split('\n').pop().slice(0, 50)} : ombre ou saut`),
  ];
  exiger('la tuile de choix est un aplat : ni dégradé, ni ombre, ni saut au toucher', base.length === 1 && !fautes.length, fautes.join(' · ') || `${base.length} règle de base, ${survol.length} états`);
}

/* 7. Aucun accordéon. */
const SANS_PLI = [...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort().map(f => `js/${f}`), 'index.html'];
{
  const restes = SANS_PLI.flatMap(f => {
    const n = (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/<\/?(details|summary)\b/g) || []).length;
    return n ? [`${f} (${n})`] : [];
  });
  exiger('aucun <details> ni <summary> nulle part dans js/ ni index.html (j\'hais les accordéons)', restes.length === 0, restes.join(' · ') || `${SANS_PLI.length} fichiers sans pli`);
}

verdict('Le décor calme, les cartes belles');
