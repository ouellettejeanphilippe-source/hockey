/**
 * LES ÉCUSSONS, CHEZ NOUS (S78).
 *
 *   node scripts/logos.mjs
 *
 * JP : *premier opening du jeu, télécharger toutes les faces et logos sur le
 * device*. Chaque club de toutes les saisons (plus les disparus) : son
 * écusson officiel de la LNH — celui de son ère pour les clubs disparus
 * (`LOGOS_OFFICIELS`, js/logos.js : les Nordiques avec le N) — copié dans
 * img/logos/{CODE}.svg. La liste de ceux qu'on a s'écrit dans
 * js/logos_locaux.js : `getTeamLogoHtml` sert le fichier local, et le réseau
 * ne sert plus qu'au club qu'on n'aurait pas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGOS_OFFICIELS } from '../js/logos.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SORTIE = path.join(ROOT, 'img', 'logos');
fs.mkdirSync(SORTIE, { recursive: true });

const codes = new Set(['OAK', 'MDA']);
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json'))) {
  for (const p of JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8')).players) if (p.t) codes.add(p.t);
}
const locaux = [], manques = [];
let octets = 0;
for (const code of [...codes].sort()) {
  const nom = LOGOS_OFFICIELS[code] ? `${code}_${LOGOS_OFFICIELS[code]}_light.svg` : `${code}_light.svg`;
  try {
    const r = await fetch(`https://assets.nhle.com/logos/nhl/svg/${nom}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const svg = await r.text();
    if (!svg.includes('<svg')) throw new Error('pas un SVG');
    fs.writeFileSync(path.join(SORTIE, `${code}.svg`), svg);
    locaux.push(code); octets += svg.length;
  } catch (e) { manques.push(`${code} (${e.message})`); }
}
fs.writeFileSync(path.join(ROOT, 'js', 'logos_locaux.js'), `/* Écrit par scripts/logos.mjs : les écussons copiés dans img/logos/ (S78). Ne pas éditer à la main. */
export const LOGOS_LOCAUX = new Set(${JSON.stringify(locaux)});
`);
console.log(`\n  ${locaux.length} écussons copiés (${(octets / 1024).toFixed(0)} Ko)${manques.length ? ` · manquants : ${manques.join(', ')}` : ''}\n`);
