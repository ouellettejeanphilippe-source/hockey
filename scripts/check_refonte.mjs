/*
 * UN GROS CHANGEMENT SE MESURE À CE QUI PART (4 nov. 2026). JP : *ça fait une
 * bonne vingtaine de fois qu'on retravaille le UI et retourne le même* ;
 * *faut arrêter de juste changer la peinture* ; *don't just change the skin*.
 * Mesuré sur les PR de la semaine : la livraison de « refais tous les écrans,
 * de zéro » (#350) ajoutait 247 lignes de CSS et retirait 54 lignes de jeu ;
 * celle qui a vraiment changé le jeu (#352) en retirait 643 pour 493 ajoutées.
 * Une refonte ENLÈVE ; une couche de peinture ajoute du CSS sur ce qui reste.
 *
 * Ce script lit le diff de la branche contre `BASE` (origin/main) et le devis
 * du changement (docs/gabarits/devis.md), et refuse :
 *
 *   1. LA PEINTURE : style.css fait plus de la moitié des lignes changées
 *      (`PEINTURE_MAX`), ou le jeu (js/, index.html, sw.js) retire moins
 *      d'une ligne pour deux qu'il ajoute (`RETRAIT_MIN`).
 *   2. CE QUI PART ENCORE LÀ : chaque nom en `code` de la partie « Ce qui
 *      part » du devis (une fonction, une classe CSS, un fichier, une clé)
 *      n'apparaît plus dans le jeu. Une partie vide, c'est une retouche, pas
 *      une refonte : le devis le dit, ou JP tranche.
 *   3. UN DEVIS QUI MENT : chaque fichier nommé à « Ce qu'il touche » est
 *      dans le diff.
 *
 *   node scripts/check_refonte.mjs docs/refonte-v24.md
 *   BASE=origin/main TETE= (l'arbre de travail) ; TETE=<commit> pour juger
 *   une PR passée : BASE=e2037e7^1 TETE=e2037e7 node scripts/check_refonte.mjs <devis>
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { exiger, informer, verdict } from './verdict.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PEINTURE_MAX = 0.5;
const RETRAIT_MIN = 0.5;
const BASE = process.env.BASE || 'origin/main';
const TETE = process.env.TETE || '';
const devisChemin = process.argv[2];

const git = (...args) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8' });

/** Le diff en chiffres : { fichier: { plus, moins } }. */
function diff() {
  const args = ['diff', '--numstat', BASE];
  if (TETE) args.push(TETE);
  const par = {};
  for (const ligne of git(...args).split('\n')) {
    const [plus, moins, fichier] = ligne.split('\t');
    if (!fichier || plus === '-') continue;
    par[fichier] = { plus: +plus, moins: +moins };
  }
  return par;
}

const estJeu = f => /^js\/.*\.js$/.test(f) || f === 'index.html' || f === 'sw.js';
const estStyle = f => f === 'style.css';

/** Le code sans ses commentaires : un nom qui ne survit que dans le journal des versions de sw.js est parti. */
const sansCommentaires = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

/** Les sources du jeu, où ce qui part ne doit plus être. */
function sourcesDuJeu() {
  const fichiers = ['index.html', 'style.css', 'sw.js'];
  for (const f of fs.readdirSync(path.join(RACINE, 'js'))) if (f.endsWith('.js')) fichiers.push(`js/${f}`);
  return fichiers.map(f => ({ f, texte: sansCommentaires(fs.readFileSync(path.join(RACINE, f), 'utf8')) }));
}

/** La partie d'un devis dont le titre `## ` commence par ce mot, ses lignes. */
function partie(devis, titre) {
  const lignes = devis.split('\n');
  const debut = lignes.findIndex(l => new RegExp(`^##\\s+(\\d+[a-z]?\\.\\s*)?${titre}`, 'i').test(l));
  if (debut < 0) return null;
  const corps = [];
  for (let i = debut + 1; i < lignes.length && !/^##\s/.test(lignes[i]); i++) corps.push(lignes[i]);
  return corps;
}

const codes = lignes => [...new Set((lignes || []).join('\n').match(/`[^`\n]+`/g) || [])].map(c => c.slice(1, -1).trim());

// 1. La peinture.
const par = diff();
let jeuPlus = 0, jeuMoins = 0, stylePlus = 0, styleMoins = 0;
for (const [f, n] of Object.entries(par)) {
  if (estJeu(f)) { jeuPlus += n.plus; jeuMoins += n.moins; }
  else if (estStyle(f)) { stylePlus += n.plus; styleMoins += n.moins; }
}
const gros = Object.entries(par).filter(([f]) => estJeu(f) || estStyle(f)).sort((a, b) => (b[1].plus + b[1].moins) - (a[1].plus + a[1].moins)).slice(0, 8);
informer('Le diff', `${BASE}${TETE ? `..${TETE}` : ' → l\'arbre de travail'} : ${Object.keys(par).length} fichiers`);
for (const [f, n] of gros) informer(`  ${f}`, `+${n.plus} −${n.moins}`);
const total = jeuPlus + jeuMoins + stylePlus + styleMoins;
exiger('Le jeu change', jeuPlus + jeuMoins > 0, `js/, index.html, sw.js : +${jeuPlus} −${jeuMoins}`);
const peinture = total ? (stylePlus + styleMoins) / total : 0;
exiger('Pas une couche de peinture', peinture <= PEINTURE_MAX, `style.css fait ${Math.round(peinture * 100)} % des lignes changées (au plus ${PEINTURE_MAX * 100} %)`);
const retrait = jeuPlus ? jeuMoins / jeuPlus : (jeuMoins ? Infinity : 0);
exiger('Une refonte enlève', retrait >= RETRAIT_MIN, `le jeu retire ${jeuMoins} lignes pour ${jeuPlus} ajoutées (${retrait === Infinity ? '∞' : retrait.toFixed(2)}, au moins ${RETRAIT_MIN})`);

// 2 et 3. Le devis.
if (!devisChemin || !fs.existsSync(path.resolve(RACINE, devisChemin))) {
  exiger('Un devis', false, devisChemin ? `${devisChemin} introuvable` : 'aucun devis nommé : node scripts/check_refonte.mjs <docs/….md> (le gabarit : docs/gabarits/devis.md)');
} else {
  const devis = fs.readFileSync(path.resolve(RACINE, devisChemin), 'utf8');
  const sources = sourcesDuJeu();
  const partants = codes(partie(devis, 'Ce qui part'));
  exiger('« Ce qui part » est rempli', partants.length > 0, partants.length ? `${partants.length} noms` : `aucun nom en \`code\` sous « Ce qui part » de ${devisChemin} : une retouche, pas une refonte`);
  for (const nom of partants) {
    const cle = nom.replace(/^\./, '').replace(/\(\)$/, '');
    const motif = new RegExp(`(?<![\\w$-])${cle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$-])`);
    const encore = sources.filter(s => s.f !== cle && motif.test(s.texte)).map(s => s.f);
    const fichierParti = /\.(js|css|html|json|mjs)$/.test(cle) ? !fs.existsSync(path.join(RACINE, cle)) : true;
    exiger(`Parti : ${nom}`, !encore.length && fichierParti, encore.length ? `encore dans ${encore.join(', ')}` : fichierParti ? '' : 'le fichier existe encore');
  }
  const touches = codes(partie(devis, "Ce qu'il touche")).filter(c => /^(js|scripts|data|docs|\.claude)\/[\w./*-]+\.\w+$|^(style\.css|index\.html|sw\.js|CLAUDE\.md|LIVRAISON\.md)$/.test(c));
  for (const f of touches) {
    const dansLeDiff = f.includes('*') ? Object.keys(par).some(p => new RegExp(`^${f.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`).test(p)) : f in par;
    const ok = dansLeDiff || partants.includes(f);
    exiger(`Touché : ${f}`, ok, ok ? '' : 'nommé au devis, absent du diff');
  }
}

verdict('Un gros changement');
