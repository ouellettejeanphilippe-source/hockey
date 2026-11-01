/*
 * ASSEMBLER js/sprites.js à partir des planches de l'atelier : node scripts/sprites/assembler.mjs [js/sprites.js]
 * Lit planches/s.mjs, se.mjs, e.mjs, ne.mjs, n.mjs et gardien.mjs ; vérifie
 * chaque image (32 × 48, lettres connues), retire l'ombre `o` (le jeu la pose), et écrit le module du jeu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { verifier, LARGEUR, HAUTEUR, ANCRE } from './apercu.mjs';
const ici = path.dirname(new URL(import.meta.url).pathname);
const POSES = ['repos', 'patin1', 'patin2', 'patin3', 'patin4', 'charge', 'tir', 'passe', 'echec', 'chute'];
const POSES_G = ['garde', 'papillon', 'mitaine', 'bloqueur'];
async function planche(fichier) { const m = await import(path.join(ici, 'planches', fichier)); const e = verifier(m.PLANCHE); if (e.length) throw new Error(`${fichier} : ${e.join(' ; ')}`); return m.PLANCHE; }
const patineurs = {};
for (const [fichier, dir] of [['s.mjs', 'S'], ['se.mjs', 'SE'], ['e.mjs', 'E'], ['ne.mjs', 'NE'], ['n.mjs', 'N']]) {
  const P = await planche(fichier);
  const d = P[dir];
  if (!d) throw new Error(`${fichier} : pas de direction ${dir}`);
  for (const pose of POSES) if (!d[pose]) console.warn(`${fichier} : pose ${pose} manquante (le repos servira)`);
  patineurs[dir] = Object.fromEntries(POSES.filter(p => d[p]).map(p => [p, d[p].map(l => l.replace(/o/g, '.'))]));
}
const G = await planche('gardien.mjs');
const gardiens = {};
for (const dir of ['S', 'E', 'N']) {
  if (!G[dir]) throw new Error(`gardien.mjs : pas de direction ${dir}`);
  for (const pose of POSES_G) if (!G[dir][pose]) console.warn(`gardien ${dir} : pose ${pose} manquante`);
  gardiens[dir] = Object.fromEntries(POSES_G.filter(p => G[dir][p]).map(p => [p, G[dir][p].map(l => l.replace(/o/g, '.'))]));
}
const bloc = obj => JSON.stringify(obj, null, 0).replace(/\],"/g, '],\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, '\n}');
const sortie = `/**
 * LES SPRITES DE SUR GLACE, dessinés à la main pixel par pixel par l'atelier de graphistes (1er nov. 2026 ; JP : *look
 * snes*, *deviens graphiste de 16-bit*, *copie pas les sprites que je t'ai donnés, mais va dans leur style pour vrai*).
 * Écrit par scripts/sprites/assembler.mjs à partir des planches en lettres : ne pas éditer à la main. Chaque image fait
 * ${LARGEUR} colonnes sur ${HAUTEUR} lignes, les patins à l'ancre (${ANCRE[0]}, ${ANCRE[1]}), la lame du bâton quatorze pixels devant ; une
 * lettre par matière, teinte aux couleurs du club par js/sur-glace.js : k contour · J j d chandail · T bande · W numéro
 * · S s peau · H h casque · P p pantalon · G gants · K patin · L lame · B manche · b ruban · Q q jambières ; « . » vide.
 * Cinq directions dessinées (S, SE, E, NE, N), les trois autres en miroir.
 */
export const LARGEUR = ${LARGEUR}, HAUTEUR = ${HAUTEUR}, ANCRE = [${ANCRE[0]}, ${ANCRE[1]}];
export const PATINEURS = ${bloc(patineurs)};
export const GARDIENS = ${bloc(gardiens)};
`;
const cible = process.argv[2] || path.join(ici, '..', '..', 'js', 'sprites.js');
fs.writeFileSync(cible, sortie);
console.log(`${cible} : ${Object.keys(patineurs).map(d => `${d} ${Object.keys(patineurs[d]).length}`).join(', ')} ; gardien ${Object.keys(gardiens).map(d => `${d} ${Object.keys(gardiens[d]).length}`).join(', ')}`);
