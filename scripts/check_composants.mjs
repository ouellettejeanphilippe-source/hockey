/*
 * LES COMPOSANTS, ET AUCUNE SURCHARGE DE MODE (V25 D1, docs/refonte-v25-d1.md). Vingt refontes du Rogue sont retombées sur
 * le même look parce que chacune repeignait les composants du 82-0 « en Rogue » : 112 règles `body.mode-rogue` posées
 * par-dessus, une classe `.en-cartes` sur l'alignement, des onglets et des filtres réécrits à la main page par page. Ce script
 * refuse, sans navigateur (une seconde) :
 *
 *   1. UN MODE DANS LA FEUILLE : un sélecteur `mode-rogue` (ou `.mode-*` sur body) dans style.css, ou une classe de mode
 *      posée sur la page par le jeu (`classList.toggle('mode-…')`), ou `en-cartes` ;
 *   2. UN MODULE DE COMPOSANTS QUI MANQUE : js/composants.js exporte la grammaire (le bandeau, les jetons, la carte et sa
 *      ligne, le coin, la case vide, la grille, les cellules, la jauge, le visage, la rangée, la case de match, la marche, le
 *      podium), js/plateau-rogue.js est parti et rien ne l'importe ;
 *   3. UNE PAGE DU ROGUE QUI REDESSINE : les pages de D1a (Joueurs, l'Album, tes cartes, les Lignes, le Palmarès, Ce soir)
 *      importent leurs composants de js/composants.js, et aucune n'écrit à la main une rangée d'onglets ou de filtres
 *      (`role="tablist"` ou `role="tab"` dans un gabarit) ni une jauge (`class="…-jauge"` avec une largeur en ligne) ;
 *   4. LA CASE EN CARTE NOMMÉE : js/alignement.js a ses deux cases, `caseEnCarte` et `caseEnRangee`, la première porte
 *      `case-carte` et la feuille la lit par cette classe ; aucun `enCarte ?` dans le gabarit d'une case ;
 *   5. sw.js liste js/composants.js et oublie js/plateau-rogue.js.
 *
 *   node scripts/check_composants.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, informer, verdict } from './verdict.mjs';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Les fins de ligne de Windows (CRLF, git en autocrlf) ramenées à LF : les gabarits se découpent sur une accolade seule en début de ligne.
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\r\n/g, '\n');
const sansCommentaires = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
const css = sansCommentaires(lire('style.css'));
const jeu = fs.readdirSync(path.join(RACINE, 'js')).filter(f => f.endsWith('.js')).map(f => ({ f: `js/${f}`, t: sansCommentaires(lire(`js/${f}`)) }));

// 1. Aucun mode dans la feuille, aucune classe de mode posée par le jeu.
const modesCss = (css.match(/body\.mode-[\w-]+|\.mode-rogue\b|\ben-cartes\b/g) || []);
exiger('aucun sélecteur de mode ni `en-cartes` dans style.css', !modesCss.length, modesCss.length ? `${modesCss.length} : ${[...new Set(modesCss)].join(', ')}` : '0');
const poses = jeu.filter(({ t }) => /classList\.(?:toggle|add)\(\s*['"`]mode-rogue|['"`]en-cartes['"`]/.test(t)).map(x => x.f);
exiger('le jeu ne pose ni `mode-rogue` ni `en-cartes`', !poses.length, poses.join(', ') || 'aucun');
informer('style.css', `${lire('style.css').split('\n').length} lignes (la cible de D1 : sous 6 000, à la réécriture par sections)`);

// 2. Le module de composants.
const GRAMMAIRE = ['bandeau', 'jetons', 'carteLigne', 'coin', 'caseVide', 'grille', 'cellules', 'jauge', 'visage', 'rangeeVisage', 'caseDeMatch', 'marche', 'podium'];
const comp = jeu.find(x => x.f === 'js/composants.js');
exiger('js/composants.js existe', !!comp);
const exportes = comp ? [...comp.t.matchAll(/^export const (\w+)/gm)].map(m => m[1]) : [];
const manquent = GRAMMAIRE.filter(n => !exportes.includes(n));
exiger('il exporte la grammaire entière', !manquent.length, manquent.length ? `manquent : ${manquent.join(', ')}` : `${exportes.length} composants`);
exiger('js/plateau-rogue.js est parti', !fs.existsSync(path.join(RACINE, 'js', 'plateau-rogue.js')));
const importeurs = jeu.filter(({ t }) => /from '\.\/plateau-rogue\.js'/.test(t)).map(x => x.f);
exiger('rien n\'importe js/plateau-rogue.js', !importeurs.length, importeurs.join(', ') || 'aucun');
// Chaque composant sert (sinon check_mort le dirait aussi) : il est importé quelque part.
const sertA = n => jeu.some(({ f, t }) => f !== 'js/composants.js' && new RegExp(`import \\{[^}]*\\b${n}\\b[^}]*\\} from '\\./composants\\.js'`).test(t));
const inutiles = exportes.filter(n => !sertA(n));
exiger('chaque composant est importé par une page', !inutiles.length, inutiles.join(', ') || 'tous');

// 3. Les pages de D1a sont faites des composants et n'en redessinent aucun.
const PAGES = { 'js/joueurs.js': ['jetons', 'carteLigne', 'grille', 'coin'], 'js/cartable.js': ['jetons', 'coin'], 'js/inventaire.js': ['jetons'], 'js/alignement.js': ['carteLigne', 'grille', 'coin', 'jauge'], 'js/rogue-jeu.js': ['marche'], 'js/saison.js': ['bandeau', 'carteLigne', 'grille', 'cellules', 'visage', 'caseDeMatch', 'coin'] };
for (const [f, noms] of Object.entries(PAGES)) {
  const t = jeu.find(x => x.f === f).t;
  const imp = (t.match(/import \{([^}]*)\} from '\.\/composants\.js'/) || [, ''])[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
  const absents = noms.filter(n => !imp.includes(n));
  exiger(`${f} importe ses composants`, !absents.length, absents.length ? `manquent : ${absents.join(', ')}` : noms.join(', '));
}
for (const f of ['js/joueurs.js', 'js/cartable.js', 'js/inventaire.js']) {
  const t = jeu.find(x => x.f === f).t;
  const onglets = (t.match(/role="tab(?:list)?"/g) || []).length;
  exiger(`${f} n'écrit aucune rangée d'onglets à la main`, !onglets, `${onglets} role="tab" dans ses gabarits`);
}
const jaugesMain = jeu.filter(({ f }) => ['js/alignement.js', 'js/joueurs.js', 'js/cartable.js', 'js/inventaire.js'].includes(f))
  .flatMap(({ f, t }) => (t.match(/class="[\w-]*-jauge"[^>]*>\s*<i style="width/g) || []).map(() => f));
exiger('aucune jauge écrite à la main dans ces pages', !jaugesMain.length, jaugesMain.join(', ') || 'aucune');

// 4. La case en carte, un composant nommé.
const al = jeu.find(x => x.f === 'js/alignement.js').t;
const corps = nom => { const i = al.indexOf(`function ${nom}(`); if (i < 0) return ''; const j = al.indexOf('\n}\n', i); return al.slice(i, j); };
exiger('js/alignement.js a ses deux cases', !!corps('caseEnCarte') && !!corps('caseEnRangee'), ['caseEnCarte', 'caseEnRangee'].filter(n => corps(n)).join(', '));
exiger('la case en carte porte `case-carte`', /socleDeCase\([^)]*'case-carte'\)/.test(corps('caseEnCarte')));
exiger('la feuille lit la case par sa classe', /\.case-carte\b/.test(css));
const embranche = ['caseEnCarte', 'caseEnRangee'].filter(n => /\benCarte\s*\?/.test(corps(n)));
exiger('aucun `enCarte ?` dans le gabarit d\'une case', !embranche.length, embranche.join(', ') || 'aucun');

// 5. La coquille hors ligne.
const sw = lire('sw.js');
exiger('sw.js liste js/composants.js et oublie js/plateau-rogue.js', sw.includes("'js/composants.js'") && !sw.includes("'js/plateau-rogue.js'"));

verdict('Les composants');
