/*
 * LE LEXIQUE (refonte coachs-cartes-incidents, tranche 1 ; JP, 27 oct. 2026 :
 * *mots à plusieurs sens*). Un mot par idée, le même à l'écran, dans le code
 * neuf et dans les docs : js/lexique.js dit le sens de chaque mot réservé et
 * la tournure qui le réemploierait ; ce script lit chaque chaîne visible de
 * js/ (commentaires enlevés, scripts/lib/chaines.mjs) et d'index.html, et
 * refuse :
 *
 *   1. UN MOT HORS DE SON SENS : chaque motif `fautif` attrape son témoin
 *      `faux` et laisse passer son témoin `bon` (la contre-épreuve), et
 *      aucune chaîne de l'écran ne le déclenche.
 *   2. UNE ICÔNE À DEUX SENS dans les familles d'étiquettes qu'on voit en
 *      jouant (CLAUDE.md) : les rôles, les traits, les archétypes d'une fiche,
 *      les styles de gardien, la carrure, l'agressivité, les coachs, les
 *      mesures d'équipe du classement. « Two-way » en attaque et en défense,
 *      c'est le même sens ; 🎯 sniper et 🎯 précision, deux. Les icônes
 *      réservées (`ICONES`) ne portent que leur sens. Les postes du
 *      personnel, les voix et les maisons du Bureau se LISENT (leurs doublons
 *      attendent les tranches 3 et 4, qui les refont).
 *   3. LES CLÉS NE BOUGENT PAS : renommer l'affichage, jamais une clé de
 *      sauvegarde (`coach`, `patron`, `chef`, `ecussons`, `vestiaire`…).
 *
 *   node scripts/check_lexique.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, informer, verdict } from './verdict.mjs';
import { chainesDe } from './lib/chaines.mjs';
import { LEXIQUE, ICONES } from '../js/lexique.js';
import { PROFILS, AGRESSIVITES } from '../js/sim.js';
import { TRAITS } from '../js/traits.js';
import { ARCHETYPES } from '../js/ratings.js';
import { COACHS } from '../js/coachs.js';
import { POUVOIRS } from '../js/pouvoirs.js';
import { ADJOINTS } from '../js/adjoints.js';
import { EXPEDITEURS } from '../js/vie-gm.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- la prose de l'écran : les chaînes de js/, le texte d'index.html ---------- */
const prose = [];
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js') && f !== 'lexique.js')) {   // le lexique porte ses témoins fautifs
  for (const { s, ligne } of chainesDe(lire(`js/${f}`), { lignes: true })) prose.push({ ou: `js/${f}:${ligne}`, t: s.trim() });
}
{
  const html = lire('index.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  html.split('\n').forEach((l, k) => prose.push({ ou: `index.html:${k + 1}`, t: l.trim() }));
}
informer('prose lue', `${prose.length} chaînes et lignes`);

/* ---------- 1. un mot, un sens ---------- */
{
  const mots = Object.entries(LEXIQUE);
  const temoins = mots.filter(([, m]) => !m.fautif.test(m.faux) || m.fautif.test(m.bon)).map(([k]) => k);
  exiger('les motifs du lexique attrapent ce qu\'ils visent', temoins.length === 0, temoins.join(' · ') || `${mots.length} mots, chacun ses deux témoins`);
  exiger('chaque mot dit son sens en une ligne', mots.every(([, m]) => typeof m.sens === 'string' && m.sens.length > 10 && !/\n/.test(m.sens)));
  for (const [mot, m] of mots) {
    const accrocs = prose.filter(x => m.fautif.test(x.t)).map(x => `${x.ou} « ${x.t.slice(0, 60)} »`);
    exiger(`« ${mot} » : ${m.sens.split(' ;')[0]}`, accrocs.length === 0, accrocs.slice(0, 4).join(' · ') || 'rien d\'autre sous ce mot');
  }
}

/* ---------- 2. une icône = un sens ---------- */
{
  const sens = new Map();   // icône → Map(sens → famille)
  const noter = (ico, quoi, famille) => {
    if (!ico) return;
    const k = ico.replace(/️/g, '');
    if (!sens.has(k)) sens.set(k, new Map());
    sens.get(k).set(quoi.toLowerCase(), famille);
  };
  const familles = new Set();
  const famille = (nom, f) => { familles.add(nom); f(); };
  familles.add('rôle');
  for (const g of ['F', 'D']) for (const R of Object.values(PROFILS[g])) noter(R.ico, `rôle ${R.nom}`, 'rôle');
  famille('trait', () => { for (const T of Object.values(TRAITS)) noter(T.icon, `trait ${T.label}`, 'trait'); });
  // Les archétypes de js/ratings.js : l'étiquette de rôle d'une fiche (`roleTag`, js/game.js). Un archétype qui porte
  // le nom d'un rôle porte son icône, et c'est le même sens.
  famille('archétype', () => {
    // Un archétype qui est un rôle porte l'icône de ce rôle : le même sens, la même icône.
    const MEME_ROLE = { OFF_PLAYMAKER: ['F', 'passeur'], PLAYMAKER: ['F', 'passeur'], SNIPER: ['F', 'sniper'], POWER_FWD: ['F', 'power'], TWO_WAY_FWD: ['F', 'deuxsens'], ENERGY: ['F', 'energie'], CHECKER: ['F', 'checker'],
      OFF_D: ['D', 'offensif'], DEF_D: ['D', 'physique'], STAY_D: ['D', 'defensif'], TWO_WAY_D: ['D', 'deuxsens'], CHECKER_D: ['D', 'defensif'] };
    const mal = [];
    for (const [k, A] of Object.entries(ARCHETYPES)) {
      if (k === 'UNKNOWN' || ['WALL', 'ACROBAT', 'WORKHORSE', 'HYBRID_G'].includes(k)) continue;
      const r = MEME_ROLE[k] && PROFILS[MEME_ROLE[k][0]][MEME_ROLE[k][1]];
      if (r && r.ico !== A.icon) mal.push(`${k} ${A.icon} ≠ rôle ${r.nom} ${r.ico}`);
      noter(A.icon, r ? `rôle ${r.nom}` : `archétype ${A.label}`, 'archétype');
    }
    exiger('un archétype qui est un rôle porte l\'icône du rôle', mal.length === 0, mal.join(' · ') || `${Object.keys(MEME_ROLE).length} archétypes lus comme leur rôle`);
  });
  famille('style de gardien', () => { for (const k of ['WALL', 'ACROBAT', 'WORKHORSE', 'HYBRID_G']) noter(ARCHETYPES[k].icon, `gardien ${ARCHETYPES[k].label}`, 'style de gardien'); });
  famille('agressivité', () => { for (const A of AGRESSIVITES) noter(A.ico, `agressivité ${A.nom}`, 'agressivité'); });
  // La carrure vit dans js/gerant.js (`carrureDe`) : ses deux icônes, lues dans la source.
  famille('carrure', () => {
    const carrure = lire('js/gerant.js').match(/^(?:export )?const carrureDe = [^\n]+/m);
    exiger('la carrure a ses deux icônes, 🪨 costaud et 🪶 léger', !!carrure && /🪨', mot: 'Costaud'/.test(carrure[0]) && /🪶', mot: 'Léger'/.test(carrure[0]), carrure ? '' : 'carrureDe introuvable');
    noter('🪨', 'carrure costaud', 'carrure'); noter('🪶', 'carrure léger', 'carrure');
  });
  famille('coach', () => { for (const C of Object.values(COACHS)) noter(C.ico, `coach ${C.nom}`, 'coach'); });
  // Les maisons du Bureau (`MAISONS`) et les mesures d'équipe du classement (`MESURES`), locales à js/saison.js : lues dans la source.
  famille('mesure', () => {
    const src = lire('js/saison.js');
    const bloc = (nom) => (src.match(new RegExp(`const ${nom} = \\{([\\s\\S]*?)\\n  \\};`)) || [])[1] || '';
    const maisons = [...bloc('MAISONS').matchAll(/(\w+): \{ ico: '([^']+)', titre: '((?:[^'\\]|\\.)+)'/g)];
    const mesures = [...bloc('MESURES').matchAll(/(\w+): \{ ico: '([^']+)', nom: '((?:[^'\\]|\\.)+)'/g)];
    exiger('les maisons du Bureau et les mesures d\'équipe se lisent dans js/saison.js', maisons.length >= 5 && mesures.length >= 5, `${maisons.length} maisons, ${mesures.length} mesures`);
    for (const [, , ico, nom] of mesures) noter(ico, `mesure ${nom}`, 'mesure');
    // Les postes, les voix et les maisons, lus à part : leurs doublons se disent, ils ne jugent pas encore.
    const lus = new Map();
    const lireIco = (ico, quoi) => { const k = ico.replace(/️/g, ''); if (!lus.has(k)) lus.set(k, new Set()); lus.get(k).add(quoi); };
    // V21 : les pouvoirs du coach et ses adjoints, à la place des postes.
    for (const Ps of Object.values(POUVOIRS)) for (const P of Ps) lireIco(P.ico, `pouvoir ${P.nom}`);
    for (const A of Object.values(ADJOINTS)) lireIco(A.ico, `adjoint ${A.nom}`);
    for (const V of Object.values(EXPEDITEURS)) lireIco(V.ico, `voix ${V.nom}`);
    for (const [, , ico, titre] of maisons) lireIco(ico, `maison ${titre}`);
    for (const [ico, m] of sens) if (lus.has(ico)) for (const q of m.keys()) lus.get(ico).add(q);
    const partages = [...lus].filter(([, q]) => q.size > 1).map(([ico, q]) => `${ico} ${[...q].join(' / ')}`);
    informer('postes, voix et maisons qui partagent une icône (V21)', partages.length ? partages.join(' · ') : 'aucun');
  });
  const doublons = [...sens].filter(([, m]) => m.size > 1).map(([ico, m]) => `${ico} = ${[...m.keys()].join(' / ')}`);
  informer('icônes lues', `${sens.size} icônes dans ${familles.size} familles`);
  exiger('une icône = un sens', doublons.length === 0, doublons.join(' · ') || 'aucun doublon');
  // Les icônes réservées : une seule famille les porte, et c'est celle que le lexique nomme.
  const reservees = Object.entries(ICONES).map(([ico, quoi]) => { const m = sens.get(ico.replace(/️/g, '')); return [ico, quoi, m ? [...m.keys()] : []]; });
  const mal = reservees.filter(([, , q]) => q.length > 1).map(([ico, quoi, q]) => `${ico} (${quoi}) : ${q.join(' / ') || 'absente des familles'}`);
  exiger('chaque icône réservée ne porte que son sens', mal.length === 0, mal.join(' · ') || reservees.map(([ico, quoi, q]) => `${ico} ${q[0] || quoi}`).join(' · '));
  exiger('« Défensif » ne nomme qu\'un rôle', ARCHETYPES.WALL.label !== TRAITS.VEZINA.label,
    'le gardien-mur ne s\'appelle plus « Gardien d\'élite » (le trophée Vézina)');
  exiger('« Régulier » ne nomme qu\'un niveau', ARCHETYPES.HYBRID_G.label.indexOf('régulier') < 0 && ARCHETYPES.HYBRID_G.short !== 'Régulier', ARCHETYPES.HYBRID_G.label);
}

/* ---------- 3. les clés ne bougent pas ---------- */
{
  // Les clés que les sauvegardes et la méta portent ; l'affichage se renomme, elles non.
  const cles = [
    ['js/coachs.js', /\bessaim: \{/], ['js/pouvoirs.js', /\bperso\b/],
    ['js/rogue.js', /cle: 'vestiaire'/], ['js/rogue.js', /ecussons/], ['js/vie-gm.js', /\bad: \{ ico/], ['js/saison.js', /\bentraineur: \{ ico/],
    ['js/dossiers.js', /\blaTete: \{/],
  ];
  const manquent = cles.filter(([f, re]) => !re.test(lire(f))).map(([f, re]) => `${f} ${re}`);
  exiger('les clés de sauvegarde gardent leur nom', manquent.length === 0, manquent.join(' · ') || `${cles.length} clés en place`);
}

verdict('Le lexique');
