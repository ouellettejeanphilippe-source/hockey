/*
 * LE DÉCOR CALME, LES CARTES BELLES (refonte coachs-cartes-incidents, oct. 2026 ; JP : *les cartes elles-mêmes, c'est
 * nice, c'est le reste de l'interface qui doit être drabe, à côté des cartes qui ne le sont pas* ; *penser comme
 * GM Connected*). Lu dans style.css, sans navigateur :
 *
 *   1. AUCUNE BOUCLE DANS LE DÉCOR. Une animation `infinite` n'est permise que pour ce qui charge (`spin`,
 *      `voile-glisse`), pour les cartes (leurs finitions), et pour Sur table. Une boucle
 *      neuve est un décor qui crie : elle entre dans la liste blanche, ou elle part.
 *   2. UNE SEULE ENTRÉE POUR LE DÉCOR : un fondu. Les keyframes d'entrée d'un écran, d'une feuille, d'une rangée ou
 *      d'un panneau ne bougent pas (ni `transform`, ni `letter-spacing`).
 *   3. LES CARTES GARDENT LEURS FINITIONS : le scintillement, le prisme, le reflet et leur entrée (`carte-entre`)
 *      existent et servent. Les nettoyer par erreur est le seul échec qu'on ne veut pas. (Le paquet de récompense qui
 *      flottait, luisait et se déchirait, son walkout et l'entrée d'« Hier soir » sont partis avec l'ancien Rogue, V28,
 *      tranche 4 : la run en carte vend des pochettes scellées, sans animation.)
 *   4. LE MOUVEMENT S'ÉTEINT POUR QUI LE DEMANDE (`prefers-reduced-motion`).
 *   5. DES SURFACES PLATES (JP : *penser comme GM Connected*) : la surface de base (`--panneau`, `--relief`) est un aplat sans
 *      ombre, et ni les onglets, ni la barre, ni les boutons, ni les choix ne portent de dégradé ; l'onglet ouvert est un bloc
 *      plein et clair, texte noir, le même partout.
 *   6. LES CARTES DE CHOIX SONT SOBRES (tranche 6 ; V25 B2 : une option est une carte de jeu, `carteHtml`). Lu sur le code et
 *      les données, sur de vrais clubs : aucune fenêtre de choix n'offre plus de trois options, le verso d'aucune option
 *      (avant-match, dossier, fil) ne montre plus de `FACE_MAX` lignes de mots vertes ou rouges — ses stats en barres, le
 *      reste plié sous « Les chiffres », sans rien perdre —, et la carte de choix est un carton de la glace (`.cs-jeu`) : sans
 *      dégradé sur sa racine, qui se soulève sous le doigt et s'envole jouée.
 *      La recommandée n'a pas de macaron : elle est la PREMIÈRE de la liste (le rang dit la recommandation).
 *   7. AUCUN ACCORDÉON (JP, 28 oct. : *j'hais les accordéons*). Aucun `<details>` ni `<summary>` dans AUCUN fichier de js/
 *      (`SANS_PLI` les lit tous, y compris ceux qu'on écrira) ni dans index.html. Une info courte est un bloc toujours visible ;
 *      une longue liste défile dans sa feuille, se charge à l'approche, ou s'ouvre en page ou en feuille.
 *
 *   node scripts/check_lisibilite.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam } from '../js/sim.js';
import { poserClubLu } from '../js/impact.js';
import { pucesDeFace, FACE_MAX } from '../js/gerant.js';
import { motsDe } from '../js/effets.js';
import { HISTOIRES } from '../js/histoires.js';
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
    'les cartes': ['ed-scintille', 'ed-prisme', 'ed-balaie'],
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
  const ENTREES = ['ecran-entre', 'panneau-monte', 'feuille-entre', 'rangee-entre', 'ligneIn', 'logo-entre'];
  const manquent = ENTREES.filter(n => !keyframes.has(n));
  const bougent = ENTREES.filter(n => keyframes.has(n) && /transform|letter-spacing|scale|translate/.test(keyframes.get(n)));
  exiger('les six entrées du décor existent', manquent.length === 0, manquent.join(' · ') || ENTREES.join(' · '));
  exiger('une entrée du décor est un fondu : ni déplacement, ni zoom', bougent.length === 0, bougent.join(' · ') || 'opacité seulement');
  const longues = [];
  for (const r of regles) for (const m of r.corps.matchAll(/animation:\s*(ecran-entre|panneau-monte|feuille-entre|rangee-entre|logo-entre)\s+(\d+)ms/g)) if (Number(m[2]) > 300 && !/\.menu-logo/.test(r.sel)) longues.push(`${m[1]} ${m[2]} ms sur ${r.sel.split('\n').pop().slice(0, 40)}`);
  exiger('une entrée du décor dure 300 ms au plus (le logo de l\'écran titre, une seule fois, fait exception)', longues.length === 0, longues.join(' · ') || 'toutes courtes');
}

/* 3. Les cartes gardent leurs finitions. */
{
  const FINITIONS = ['ed-scintille', 'ed-prisme', 'ed-balaie', 'carte-entre'];
  const perdues = FINITIONS.filter(n => !keyframes.has(n) || !regles.some(r => new RegExp(`animation:[^;]*\\b${n}\\b`).test(r.corps)));
  exiger('les cartes gardent leurs finitions (scintillement, prisme, reflet, entrée)', perdues.length === 0, perdues.join(' · ') || `${FINITIONS.length} animations de cartes en place`);
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
  const DECOR = [/^\.navtab/, /^\.navbar/, /^\.btn\.(go|gold)\b/, /^\.choix-option\.tc$/, /^\.hub-hier/, /^:is\(\.soustab/];
  const fautes = regles.filter(r => DECOR.some(d => d.test(r.sel)) && /gradient\(/.test(r.corps)).map(r => r.sel);
  exiger('ni les onglets, ni la barre, ni les boutons, ni les choix ne portent de dégradé', !fautes.length, fautes.join(' · ') || 'aucun');
  const actif = regles.find(r => /^:is\(\.soustab[^)]*\)\.on$/.test(r.sel));
  const barre = regles.find(r => r.sel === '.navtab.on');
  // V25 D1 (docs/refonte-v25-d1.md) : la porte ouverte de la barre est sombre, celle du plateau (interface.md : « la porte
  // ouverte sombre »), pour tous les modes — la surcharge `body.mode-rogue .navtab.on` est fondue dans la règle de base.
  exiger('l\'onglet ouvert est un bloc plein : clair, texte noir, en haut ; sombre, texte blanc, dans la barre des portes', !!actif && !!barre && /background:\s*var\(--encre\)/.test(actif.corps) && /color:\s*var\(--noir\)/.test(actif.corps) && /background:\s*var\(--fond-2\)/.test(barre.corps) && /color:\s*var\(--blanc\)/.test(barre.corps));
}

/* 6. Les tuiles de choix, sobres. */
{
  const OPTIONS_MAX = 3;
  const FAMILLES = [['histoire', HISTOIRES]];
  // Le nombre d'options : les fenêtres de ces familles.
  const trop = [];
  let nFenetres = 0;
  for (const [cat, liste] of FAMILLES) for (const [cle, ev] of Object.entries(liste)) { nFenetres++; if ((ev.options || []).length > OPTIONS_MAX) trop.push(`${cat} ${cle} : ${ev.options.length}`); }
  exiger(`une fenêtre de choix offre trois options au plus (${nFenetres} fenêtres)`, !trop.length, trop.join(' · ') || `au plus ${Math.max(...FAMILLES.flatMap(([, l]) => Object.values(l).map(e => (e.options || []).length)))}`);

  // Les lignes d'une carte : son verso tel que l'écran le dessine (`pucesDeFace`, les lignes dérivées de la grammaire et, jusqu'à la
  // tranche C, le bon et le prix écrits), sur des clubs de plusieurs époques.
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
  // Ce qui se voit : les barres (une par stat) et les puces vertes ou rouges hors `.detail` ; tout : avec les pliées.
  const lignes = html => {
    const puces = [...html.matchAll(/<span class="puce ([^"]*)"/g)].map(m => m[1]).filter(c => /\b(bon|prix)\b/.test(c));
    const barres = (html.match(/class="impact-l (bon|prix)"/g) || []).length;
    const dansLesBarres = [...html.matchAll(/class="impact-v puce detail">([^<]*)</g)].reduce((n, m) => n + m[1].split(', ').length, 0);
    return { mots: puces.filter(c => !/\bdetail\b/.test(c)).length, barres, toutes: puces.length + dansLesBarres };
  };
  const cartes = [];
  for (const [cat, liste] of FAMILLES) for (const [cle, ev] of Object.entries(liste)) for (const o of ev.options || []) cartes.push({ id: `${cat} ${cle}.${o.cle}`, o });
  const debordent = [], perdent = [];
  let maxVues = 0;
  for (const club of clubs) {
    poserClubLu(() => ({ team: club }));
    for (const { id, o } of cartes) {
      const mots = [...motsDe(o, { qui: 'Lui' }), ...(o.bon && !o.rien ? [{ txt: o.bon, bon: true }] : []), ...(o.prix ? [{ txt: o.prix, bon: false }] : [])];
      const lu = lignes(pucesDeFace(mots));
      maxVues = Math.max(maxVues, lu.mots);
      if (lu.mots > FACE_MAX) debordent.push(`${id} (${club.name}) : ${lu.mots}`);
      if (lu.toutes < mots.filter(m => m.bon === true || m.bon === false).length) perdent.push(`${id} (${club.name})`);
    }
  }
  poserClubLu(null);
  informer('les clubs lus', clubs.map(c => c.name).join(' · '));
  exiger(`une carte montre ${FACE_MAX} lignes de mots vertes ou rouges au plus, ses stats en barres (${cartes.length} options, sur ${clubs.length} clubs)`, !debordent.length, debordent.slice(0, 6).join(' · ') || `au plus ${maxVues}`);
  exiger('plier une ligne de trop ne la perd pas : elle reste sous « Les chiffres »', !perdent.length, perdent.slice(0, 6).join(' · ') || 'rien ne disparaît');

  // LA CARTE DE CHOIX (V25 B2 ; V23 : JP, oui à défaire la tuile sobre de la V19) : une carte de jeu, le carton de la glace
  // (`.cs-jeu`), une seule règle de base `.choix-option.tc` sans dégradé ; elle se soulève sous le doigt et s'envole jouée
  // (`choix-jouee`), et le mouvement s'éteint pour qui le demande (le geste part tout de suite : `prefers-reduced-motion`, js/gerant.js).
  // La règle de base (celle de prefers-reduced-motion, qui ne fait qu'éteindre la transition, ne compte pas).
  const base = regles.filter(r => r.sel === '.choix-option.tc' && !/^\s*transition: none;?\s*$/.test(r.corps));
  const survol = regles.filter(r => /^\.choix-option\.tc:hover/.test(r.sel.split(',')[0].trim()));
  const jouee = regles.filter(r => r.sel === '.choix-option.jouee');
  const fautes = [
    ...(base.length !== 1 ? [`${base.length} règles de base`] : []),
    ...base.filter(r => /gradient/.test(r.corps)).map(() => 'la carte de base a un dégradé'),
    ...(regles.some(r => r.sel === '.cs-jeu') ? [] : ['le carton de la glace (.cs-jeu) manque']),
    ...(survol.some(r => /translateY\(-/.test(r.corps)) ? [] : ['elle ne se soulève pas sous le doigt']),
    ...(jouee.some(r => /choix-jouee/.test(r.corps)) && /@keyframes choix-jouee/.test(css) ? [] : ['elle ne s\'envole pas jouée']),
    ...(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(fs.readFileSync(path.join(ROOT, 'js', 'gerant.js'), 'utf8')) ? [] : ['le geste attend même sous prefers-reduced-motion']),
  ];
  exiger('la carte de choix est un carton de la glace : sans dégradé, elle se soulève et s\'envole jouée', !fautes.length, fautes.join(' · ') || `${survol.length} état soulevé`);
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
