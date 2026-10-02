/**
 * TON CLUB — son nom, ses couleurs, son écusson, qui se débloquent run après run.
 *
 * JP : *pour l'aspect roguelike, que les couleurs de notre équipe, le nom de
 * notre équipe puis des logos, ce soient des choses qu'on débloque au fur et à
 * mesure ; on ne serait pas imposé d'avoir le nom NHL Stars, le noir puis
 * l'orange*. Les NHL Stars restent le club de départ (noir, blanc, orange,
 * l'étoile) ; le reste s'achète en jetons 🪙 à la boutique, au rayon « Ton
 * club », comme les packs (JP : *même monnaie que les autres packs*), et se
 * porte au vestiaire. Les plus beaux demandent un rang de prestige — comme les dos de cartes de Balatro ou les
 * tenues de Hades : ça ne change rien au jeu, ça dit le chemin parcouru.
 *
 * Tout est COSMÉTIQUE : aucune cote, aucun effet. Le choix vit dans le méta
 * (`m.club`) et vaut dans tous les modes. `appliquerClub` le pose là où
 * l'interface lit ton équipe : `TEAM_COLORS.YOU`, l'écusson `YOU`
 * (js/logos.js), et le nom que rendent `nomDuClub` et `courtDuClub`.
 * Un nom est PLURIEL (« Les Harfangs soulèvent la Coupe ») ; son code tient
 * en trois lettres, comme celui d'un club de la ligue au tableau indicateur.
 */
import { TEAM_COLORS, poserEcussonDuClub } from './logos.js';
import { lireMeta, ecrireMeta, rangDePrestige, PRESTIGES } from './rogue.js';
import { esc } from './util.js';

const NOMS = {
  stars: { nom: 'NHL Stars', court: 'NHL', prix: 0 },
  harfangs: { nom: 'Harfangs', court: 'HAR', prix: 15 },
  orignaux: { nom: 'Orignaux', court: 'ORI', prix: 15 },
  huards: { nom: 'Huards', court: 'HUA', prix: 15 },
  bucherons: { nom: 'Bûcherons', court: 'BUC', prix: 20 },
  carcajous: { nom: 'Carcajous', court: 'CRC', prix: 20 },
  cometes: { nom: 'Comètes', court: 'COM', prix: 25, rang: 1 },
  loupsgarous: { nom: 'Loups-garous', court: 'LGR', prix: 35, rang: 2 },
};
/*
 * Les couleurs : l'aplat (primary), la seconde (le liseré, la plaque), l'encre sur l'aplat. Cinquante
 * nuanciers DESSINÉS ici (JP : *créer de toutes pièces 50 swatches*) : l'aplat toujours sombre, pour que
 * l'encre blanche se lise, la seconde vive. Aucun n'est la paire d'un vrai club.
 */
const PAL = (nom, primary, secondary, prix, rang) => ({ nom, primary, secondary, text: '#ffffff', prix, ...(rang ? { rang } : {}) });
const PALETTES = {
  etoiles: PAL('Noir et orange', '#0b0b0b', '#f47a20', 0),
  glacier: PAL('Marine et glace', '#0b2545', '#8ecae6', 20),
  brasier: PAL('Rouge et or', '#8d0b1b', '#ffb703', 20),
  foret: PAL('Forêt et crème', '#1b4332', '#e9d8a6', 25),
  minuit: PAL('Minuit et argent', '#0d1b2a', '#c9d6df', 15),
  erable: PAL("Sirop d'érable", '#3b1f0e', '#e09f3e', 15),
  bleuet: PAL('Bleuet', '#1d2b64', '#7b9bff', 15),
  framboise: PAL('Framboise', '#5c0a2e', '#ff5d8f', 15),
  citron: PAL('Ardoise et citron', '#2b2d31', '#e9f542', 15),
  lagune: PAL('Lagune', '#023e48', '#48e5c2', 15),
  corail: PAL('Marine et corail', '#14213d', '#ff7f50', 20),
  lavande: PAL('Lavande', '#2e1f47', '#b8a1ff', 20),
  menthe: PAL('Charbon et menthe', '#1c1c1c', '#7cf0b4', 20),
  sanguine: PAL('Sanguine', '#4a0d0d', '#ff8a5b', 20),
  tempete: PAL('Tempête', '#1f2933', '#ffd23f', 20),
  toundra: PAL('Toundra', '#2f3e46', '#cad2c5', 20),
  saphir: PAL('Saphir et cristal', '#0a1f5c', '#9ad1ff', 20),
  emeraude: PAL('Émeraude', '#04382b', '#50fa7b', 20),
  rubis: PAL('Rubis et rose', '#5a0016', '#ffc4d1', 20),
  cuivre: PAL('Cuivre', '#2a1a12', '#d9822b', 20),
  sable: PAL('Sable', '#3d2b1f', '#f2d6a2', 20),
  prune: PAL('Prune et abricot', '#3a0f3a', '#f4a259', 25),
  olive: PAL('Olive et caramel', '#283618', '#dda15e', 25),
  bourgogne: PAL('Bourgogne et laiton', '#4c0b1e', '#c9a227', 25),
  noirglace: PAL('Noir glacé', '#050505', '#a5f3fc', 25),
  camouflage: PAL('Camouflage', '#3a4a2a', '#c2b280', 25),
  cobalt: PAL('Cobalt et saumon', '#002a6e', '#ff6b6b', 25),
  pin: PAL('Pin et ivoire', '#1e3a2f', '#f4e9cd', 25),
  crepuscule: PAL('Crépuscule', '#2d1e5f', '#ff9e64', 25),
  aube: PAL('Aube', '#3b1c32', '#ffd6a5', 25),
  mousse: PAL('Mousse', '#23361f', '#a7c957', 25),
  graphite: PAL('Graphite et rouge', '#232323', '#ff3b3b', 25),
  rouille: PAL('Rouille', '#3b1f1a', '#e76f51', 25),
  jade: PAL('Jade et paille', '#0f3d3e', '#e0c879', 30),
  indigo: PAL('Indigo et ambre', '#1b1464', '#fbb13c', 30),
  cerise: PAL('Cerise et lait', '#6a040f', '#fdf0d5', 30),
  orage: PAL("Ciel d'orage", '#33415c', '#e2e8f0', 30),
  tournesol: PAL('Tournesol', '#2b2118', '#ffc300', 30),
  lichen: PAL('Lichen', '#354f52', '#d8f3dc', 30),
  acier: PAL('Acier et argent', '#22262e', '#c0c6cf', 25, 1),
  polaire: PAL('Nuit polaire', '#071330', '#c0fdff', 30, 1),
  bonbon: PAL('Bonbon', '#4b1d52', '#7ee8fa', 30, 1),
  pivoine: PAL('Nuit et pivoine', '#1f1d36', '#ff9cee', 30, 1),
  volcan: PAL('Volcan', '#1a0a00', '#ff4500', 35, 1),
  magma: PAL('Magma', '#250902', '#f48c06', 35, 1),
  aurore: PAL('Aurore boréale', '#3c096c', '#2ec4b6', 40, 2),
  neon: PAL('Néon', '#0b0b1a', '#ff2bd6', 40, 2),
  cyber: PAL('Cybernétique', '#0a0f1e', '#00f0ff', 40, 2),
  ocean: PAL('Océan et soleil', '#003049', '#fcbf49', 40, 2),
  platine: PAL('Platine', '#16181d', '#e5e4e2', 50, 3),
  dynastie: PAL('Noir et or', '#111111', '#d4af37', 60, 4),
};
/*
 * Les écussons : chacun DESSINÉ ici (jamais emprunté, comme ceux des disparues), aux couleurs choisies
 * et au code du club. `a` l'aplat, `b` la seconde. Trente à débloquer (JP : *créer de toutes pièces
 * trente logos*) : un CADRE (sa forme, et la plaque où s'écrit le code) et un MOTIF au centre.
 */
const BLANC = '#ffffff';
const TXT = (y, taille, fill, mot, large = 62) => `<text x="50" y="${y}" font-family="Arial Narrow, Arial, sans-serif" font-weight="900" font-size="${taille}" letter-spacing="1.5" fill="${fill}" text-anchor="middle" textLength="${large}" lengthAdjust="spacingAndGlyphs">${esc(mot)}</text>`;
/* Un cadre : son fond, et la plaque [x, y, largeur, hauteur]. */
const CADRES = {
  rond: { fond: (a, b) => `<circle cx="50" cy="50" r="47" fill="${a}" stroke="${b}" stroke-width="5"/>`, plaque: [18, 70, 64, 14] },
  anneau: { fond: (a, b) => `<circle cx="50" cy="50" r="47" fill="${a}" stroke="${b}" stroke-width="5"/><circle cx="50" cy="50" r="39" fill="none" stroke="${BLANC}" stroke-width="1.5"/>`, plaque: [20, 70, 60, 13] },
  ecu: { fond: (a, b) => `<path d="M50 4 L90 16 L86 58 Q80 84 50 96 Q20 84 14 58 L10 16 Z" fill="${a}" stroke="${b}" stroke-width="5" stroke-linejoin="round"/>`, plaque: [20, 68, 60, 13] },
  blason: { fond: (a, b) => `<path d="M10 7 H90 V50 Q90 80 50 96 Q10 80 10 50 Z" fill="${a}" stroke="${b}" stroke-width="5" stroke-linejoin="round"/>`, plaque: [18, 68, 64, 13] },
  carre: { fond: (a, b) => `<rect x="5" y="5" width="90" height="90" rx="16" fill="${a}" stroke="${b}" stroke-width="5"/>`, plaque: [14, 72, 72, 15] },
  hexagone: { fond: (a, b) => `<polygon points="50,3 91,26 91,74 50,97 9,74 9,26" fill="${a}" stroke="${b}" stroke-width="5" stroke-linejoin="round"/>`, plaque: [24, 68, 52, 13] },
  octogone: { fond: (a, b) => `<polygon points="31,4 69,4 96,31 96,69 69,96 31,96 4,69 4,31" fill="${a}" stroke="${b}" stroke-width="5" stroke-linejoin="round"/>`, plaque: [16, 70, 68, 14] },
  fanion: { fond: (a, b) => `<path d="M14 4 H86 V78 L50 96 L14 78 Z" fill="${a}" stroke="${b}" stroke-width="5" stroke-linejoin="round"/>`, plaque: [20, 64, 60, 13] },
};
/* Les motifs, dans le haut de l'écusson (x 20 à 80, y 12 à 64). */
const MOTIFS = {
  montagne: (a, b) => `<path d="M18 64 L38 32 L47 44 L60 20 L82 64 Z" fill="${b}"/><path d="M60 20 L67 33 L62 31 L58 36 L55 30 Z" fill="${BLANC}"/><path d="M38 32 L42 39 L38 38 L35 40 Z" fill="${BLANC}"/>`,
  vague: (a, b) => `<g fill="none" stroke-width="5" stroke-linecap="round"><path d="M20 30 Q30 20 40 30 T60 30 T80 30" stroke="${BLANC}"/><path d="M20 44 Q30 34 40 44 T60 44 T80 44" stroke="${b}"/><path d="M20 58 Q30 48 40 58 T60 58 T80 58" stroke="${BLANC}"/></g>`,
  eclair: (a, b) => `<polygon points="56,12 30,44 46,44 38,66 72,32 54,32 64,12" fill="${b}" stroke="${BLANC}" stroke-width="2.5" stroke-linejoin="round"/>`,
  flamme: (a, b) => `<path d="M50 12 C60 28 74 34 68 52 C64 64 36 64 32 52 C28 40 40 36 42 24 C46 32 50 32 50 12 Z" fill="${b}"/><path d="M50 34 C56 42 60 46 57 54 C55 60 45 60 43 54 C41 48 47 44 50 34 Z" fill="${BLANC}"/>`,
  sapin: (a, b) => `<polygon points="50,10 64,30 57,30 70,46 60,46 74,62 26,62 40,46 30,46 43,30 36,30" fill="${b}"/><rect x="46" y="62" width="8" height="5" fill="${BLANC}"/>`,
  harfang: (a, b) => `<path d="M30 26 L36 14 L42 24 Q50 20 58 24 L64 14 L70 26 Q76 44 66 60 Q50 70 34 60 Q24 44 30 26 Z" fill="${BLANC}"/><circle cx="41" cy="36" r="7" fill="${b}"/><circle cx="59" cy="36" r="7" fill="${b}"/><circle cx="41" cy="36" r="3" fill="${a}"/><circle cx="59" cy="36" r="3" fill="${a}"/><polygon points="46,44 54,44 50,52" fill="${a}"/>`,
  lune: (a, b) => `<circle cx="48" cy="38" r="22" fill="${b}"/><circle cx="58" cy="32" r="18" fill="${a}"/><circle cx="68" cy="52" r="2.5" fill="${BLANC}"/><circle cx="74" cy="22" r="2" fill="${BLANC}"/><circle cx="62" cy="60" r="1.6" fill="${BLANC}"/>`,
  comete: (a, b) => `<polygon points="54,16 74,36 20,64" fill="${b}"/><polygon points="58,22 68,32 30,58" fill="${BLANC}" opacity="0.7"/><circle cx="64" cy="26" r="12" fill="${BLANC}" stroke="${b}" stroke-width="3"/>`,
  soleil: (a, b) => `<g stroke="${b}" stroke-width="4" stroke-linecap="round">${Array.from({ length: 12 }, (_, k) => { const t = (k * Math.PI) / 6, c = Math.cos(t), s = Math.sin(t); return `<path d="M${(50 + 19 * c).toFixed(1)} ${(38 + 19 * s).toFixed(1)} L${(50 + 27 * c).toFixed(1)} ${(38 + 27 * s).toFixed(1)}"/>`; }).join('')}</g><circle cx="50" cy="38" r="14" fill="${BLANC}"/>`,
  fleche: (a, b) => `<polygon points="50,10 70,34 58,34 58,64 42,64 42,34 30,34" fill="${b}" stroke="${BLANC}" stroke-width="2.5" stroke-linejoin="round"/>`,
  ancre: (a, b) => `<g fill="none" stroke="${b}" stroke-width="5" stroke-linecap="round"><circle cx="50" cy="18" r="5"/><path d="M50 23 L50 62"/><path d="M38 32 L62 32"/><path d="M26 46 Q30 62 50 62 Q70 62 74 46"/></g><polygon points="22,48 30,44 28,52" fill="${BLANC}"/><polygon points="78,48 70,44 72,52" fill="${BLANC}"/>`,
  hache: (a, b) => `<path d="M30 64 L62 18" stroke="${BLANC}" stroke-width="6" stroke-linecap="round"/><path d="M54 14 Q74 14 80 32 Q66 36 58 30 Z" fill="${b}"/><path d="M70 64 L38 18" stroke="${BLANC}" stroke-width="6" stroke-linecap="round"/><path d="M46 14 Q26 14 20 32 Q34 36 42 30 Z" fill="${b}"/>`,
  pagaies: (a, b) => `<g stroke="${BLANC}" stroke-width="4" stroke-linecap="round"><path d="M28 62 L68 20"/><path d="M72 62 L32 20"/></g><ellipse cx="72" cy="16" rx="6" ry="10" transform="rotate(43 72 16)" fill="${b}"/><ellipse cx="28" cy="16" rx="6" ry="10" transform="rotate(-43 28 16)" fill="${b}"/><path d="M20 58 Q50 70 80 58" fill="none" stroke="${b}" stroke-width="4" stroke-linecap="round"/>`,
  aurore: (a, b) => `<g fill="none" stroke-linecap="round"><path d="M18 50 C30 20 44 44 54 22 S74 30 82 14" stroke="${b}" stroke-width="7"/><path d="M18 60 C30 34 44 56 54 36 S74 42 82 28" stroke="${BLANC}" stroke-width="3"/></g><path d="M18 64 L34 54 L44 60 L58 50 L82 64 Z" fill="${BLANC}"/>`,
  masque: (a, b) => `<path d="M32 18 Q50 6 68 18 Q72 40 64 58 Q50 68 36 58 Q28 40 32 18 Z" fill="${BLANC}"/><g stroke="${a}" stroke-width="2.5"><path d="M38 34 L62 34"/><path d="M38 42 L62 42"/><path d="M40 50 L60 50"/><path d="M45 30 L45 56"/><path d="M55 30 L55 56"/></g><path d="M50 10 L50 24" stroke="${b}" stroke-width="4"/>`,
  patin: (a, b) => `<path d="M30 16 L46 16 L48 38 Q66 40 72 48 L72 54 L28 54 Z" fill="${BLANC}"/><path d="M34 22 L44 22 M34 28 L44 28 M34 34 L46 34" stroke="${a}" stroke-width="2"/><path d="M22 62 L78 62 Q82 62 80 58" fill="none" stroke="${b}" stroke-width="4" stroke-linecap="round"/><path d="M34 54 L34 62 M66 54 L66 62" stroke="${b}" stroke-width="3"/>`,
  chevrons: (a, b) => `<g fill="none" stroke-width="6" stroke-linejoin="round"><path d="M22 34 L50 16 L78 34" stroke="${b}"/><path d="M22 48 L50 30 L78 48" stroke="${BLANC}"/><path d="M22 62 L50 44 L78 62" stroke="${b}"/></g>`,
  damier: (a, b) => `<g>${[0, 1, 2, 3].flatMap(i => [0, 1, 2].map(j => `<rect x="${26 + i * 12}" y="${22 + j * 13}" width="12" height="13" fill="${(i + j) % 2 ? b : BLANC}"/>`)).join('')}</g><rect x="26" y="22" width="48" height="39" fill="none" stroke="${b}" stroke-width="2"/>`,
  patte: (a, b) => `<path d="M50 36 Q66 36 66 52 Q66 62 50 60 Q34 62 34 52 Q34 36 50 36 Z" fill="${b}"/><ellipse cx="32" cy="32" rx="6" ry="8" fill="${BLANC}"/><ellipse cx="44" cy="22" rx="6" ry="8" fill="${BLANC}"/><ellipse cx="56" cy="22" rx="6" ry="8" fill="${BLANC}"/><ellipse cx="68" cy="32" rx="6" ry="8" fill="${BLANC}"/>`,
  loup: (a, b) => `<polygon points="28,12 40,28 60,28 72,12 74,40 62,62 50,66 38,62 26,40" fill="${b}"/><polygon points="40,28 60,28 50,46" fill="${BLANC}"/><polygon points="34,38 44,40 40,44" fill="${a}"/><polygon points="66,38 56,40 60,44" fill="${a}"/><polygon points="46,56 54,56 50,62" fill="${a}"/>`,
  huard: (a, b) => `<path d="M24 46 Q34 34 52 40 Q60 30 70 32 Q76 34 80 38 L70 40 Q66 50 54 52 Q36 56 24 46 Z" fill="${BLANC}"/><circle cx="70" cy="35" r="1.8" fill="${a}"/><path d="M36 44 L52 44" stroke="${b}" stroke-width="2"/><path d="M18 60 Q30 54 42 60 T66 60 T84 60" fill="none" stroke="${b}" stroke-width="4" stroke-linecap="round"/>`,
  feu: (a, b) => `<g stroke="${b}" stroke-width="4" stroke-linecap="round"><path d="M18 30 L38 30"/><path d="M14 40 L34 40"/><path d="M18 50 L38 50"/></g><ellipse cx="58" cy="44" rx="20" ry="9" fill="${BLANC}"/><rect x="38" y="34" width="40" height="10" fill="${BLANC}"/><ellipse cx="58" cy="34" rx="20" ry="9" fill="${b}"/>`,
  but: (a, b) => `<path d="M24 62 L24 24 Q24 18 30 18 L70 18 Q76 18 76 24 L76 62" fill="none" stroke="${b}" stroke-width="5" stroke-linecap="round"/><g stroke="${BLANC}" stroke-width="1.5" opacity="0.85">${[32, 40, 48, 56, 64].map(x => `<path d="M${x} 22 L${x} 60"/>`).join('')}${[28, 36, 44, 52].map(y => `<path d="M28 ${y} L72 ${y}"/>`).join('')}</g><ellipse cx="50" cy="62" rx="7" ry="3" fill="${BLANC}"/>`,
  trois: (a, b) => {
    const e = (x, y, r, f) => `<polygon points="${Array.from({ length: 10 }, (_, k) => { const t = -Math.PI / 2 + (k * Math.PI) / 5, q = k % 2 ? r * 0.42 : r; return `${(x + q * Math.cos(t)).toFixed(1)},${(y + q * Math.sin(t)).toFixed(1)}`; }).join(' ')}" fill="${f}"/>`;
    return `${e(30, 44, 11, BLANC)}${e(50, 32, 15, b)}${e(70, 44, 11, BLANC)}`;
  },
  diamant: (a, b) => `<polygon points="32,24 68,24 80,36 50,66 20,36" fill="${b}"/><g fill="none" stroke="${BLANC}" stroke-width="2" stroke-linejoin="round"><path d="M20 36 L80 36"/><path d="M40 24 L34 36 L50 66 L66 36 L60 24"/><path d="M34 36 L50 24 L66 36"/></g>`,
  rose: (a, b) => `<polygon points="50,10 56,32 78,38 56,44 50,66 44,44 22,38 44,32" fill="${BLANC}"/><polygon points="50,10 56,32 50,38" fill="${b}"/><polygon points="78,38 56,44 50,38" fill="${b}"/><polygon points="50,66 44,44 50,38" fill="${b}"/><polygon points="22,38 44,32 50,38" fill="${b}"/><circle cx="50" cy="38" r="3" fill="${a}"/>`,
};
/* Un écusson du catalogue : son cadre, son motif, la plaque aux couleurs du club. */
const ECU = (nom, cadre, motif, prix, rang) => ({ nom, prix, ...(rang ? { rang } : {}), svg: (a, b, mot) => {
  const C = CADRES[cadre], [x, y, w, h] = C.plaque;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${C.fond(a, b)}${MOTIFS[motif](a, b)}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${b}"/>${TXT(y + h - 3.2, h - 2, a, mot, Math.min(w - 10, 8 + 10 * mot.length))}</svg>`;
} });
const ECUSSONS = {
  etoile: { nom: "L'étoile", prix: 0, svg: (a, b, mot) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="47" fill="${a}" stroke="${b}" stroke-width="5"/>
    <circle cx="50" cy="50" r="38" fill="none" stroke="#ffffff" stroke-width="2"/>
    <polygon points="50,14 58.5,36 82,36 63,50 70,73 50,59 30,73 37,50 18,36 41.5,36" fill="#ffffff"/>
    <polygon points="50,24 55,37 69,37 58,45.5 62.5,59 50,50.5 37.5,59 42,45.5 31,37 45,37" fill="${b}"/>
    <rect x="14" y="70" width="72" height="16" rx="3" fill="${b}"/>${TXT(82.5, 13.5, a, mot)}</svg>` },
  bouclier: { nom: 'Le bouclier', prix: 25, svg: (a, b, mot) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 4 L90 16 L86 58 Q80 84 50 96 Q20 84 14 58 L10 16 Z" fill="${a}" stroke="${b}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M22 40 L50 26 L78 40 L78 50 L50 36 L22 50 Z" fill="${b}"/>
    <path d="M22 56 L50 42 L78 56 L78 64 L50 50 L22 64 Z" fill="#ffffff"/>${TXT(84, 15, b, mot, 40)}</svg>` },
  rondelle: { nom: 'Les bâtons croisés', prix: 25, svg: (a, b, mot) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="47" fill="${a}" stroke="${b}" stroke-width="5"/>
    <path d="M24 20 L62 70 L74 70" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M76 20 L38 70 L26 70" stroke="${b}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="50" cy="32" rx="13" ry="6" fill="#ffffff"/>${TXT(86, 14, '#ffffff', mot, 38)}</svg>` },
  flocon: { nom: 'Le flocon', prix: 35, rang: 1, svg: (a, b, mot) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,3 91,26 91,74 50,97 9,74 9,26" fill="${a}" stroke="${b}" stroke-width="5" stroke-linejoin="round"/>
    <g stroke="#ffffff" stroke-width="5" stroke-linecap="round"><path d="M50 18 L50 62"/><path d="M31 29 L69 51"/><path d="M69 29 L31 51"/></g>
    <g stroke="${b}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M43 22 L50 28 L57 22"/><path d="M43 58 L50 52 L57 58"/></g>${TXT(83, 14, '#ffffff', mot, 38)}</svg>` },
  couronne: { nom: 'La couronne', prix: 50, rang: 3, svg: (a, b, mot) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="47" fill="${a}" stroke="${b}" stroke-width="5"/>
    <path d="M22 62 L18 28 L36 44 L50 20 L64 44 L82 28 L78 62 Z" fill="${b}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="20" r="5" fill="#ffffff"/><circle cx="18" cy="28" r="4" fill="#ffffff"/><circle cx="82" cy="28" r="4" fill="#ffffff"/>${TXT(83, 14, '#ffffff', mot, 38)}</svg>` },
  montagne: ECU('La montagne', 'blason', 'montagne', 15),
  vague: ECU('La vague', 'rond', 'vague', 15),
  eclair: ECU("L'éclair", 'ecu', 'eclair', 15),
  flamme: ECU('La flamme', 'fanion', 'flamme', 15),
  sapin: ECU('Le sapin', 'hexagone', 'sapin', 15),
  fleche: ECU('La flèche', 'fanion', 'fleche', 15),
  chevrons: ECU('Les chevrons', 'blason', 'chevrons', 15),
  damier: ECU('Le damier', 'carre', 'damier', 20),
  harfang: ECU('Le harfang', 'anneau', 'harfang', 20),
  lune: ECU('La pleine lune', 'rond', 'lune', 20),
  ancre: ECU("L'ancre", 'octogone', 'ancre', 20),
  hache: ECU('Les haches', 'ecu', 'hache', 20),
  pagaies: ECU('Les pagaies', 'anneau', 'pagaies', 20),
  patin: ECU('Le patin', 'carre', 'patin', 20),
  masque: ECU('Le masque', 'octogone', 'masque', 25),
  feu: ECU('La rondelle en feu', 'rond', 'feu', 25),
  but: ECU('Le filet', 'carre', 'but', 25),
  patte: ECU("La patte d'ours", 'blason', 'patte', 25),
  huard: ECU('Le huard', 'anneau', 'huard', 25),
  soleil: ECU('Le soleil', 'octogone', 'soleil', 30, 1),
  comete: ECU('La comète', 'hexagone', 'comete', 30, 1),
  loup: ECU('Le loup', 'ecu', 'loup', 35, 1),
  aurore: ECU("L'aurore", 'fanion', 'aurore', 35, 2),
  rose: ECU('La rose des vents', 'anneau', 'rose', 40, 2),
  trois: ECU('Les trois étoiles', 'blason', 'trois', 45, 3),
  diamant: ECU('Le diamant', 'hexagone', 'diamant', 50, 4),
};
/* Les trois rayons de l'écran « Ton club », dans l'ordre où on les lit. */
export const RAYONS_CLUB = [
  { cle: 'nom', titre: 'Le nom', liste: NOMS },
  { cle: 'palette', titre: 'Les couleurs', liste: PALETTES },
  { cle: 'ecusson', titre: "L'écusson", liste: ECUSSONS },
];
const DEPART = { nom: 'stars', palette: 'etoiles', ecusson: 'etoile' };
const rayon = cle => RAYONS_CLUB.find(R => R.cle === cle);

/* Le choix du club dans le méta, complété : ce qui n'existe plus retombe sur le départ. */
export function choixDuClub(m = lireMeta()) {
  const c = { ...DEPART, ...((m && m.club) || {}) };
  for (const R of RAYONS_CLUB) if (!R.liste[c[R.cle]]) c[R.cle] = DEPART[R.cle];
  return c;
}
/* Un objet est à toi s'il est gratuit ou acheté (`m.club.pris`, « nom:harfangs »). */
export const possede = (m, rayonCle, cle) => !rayon(rayonCle).liste[cle].prix || ((m.club && m.club.pris) || []).includes(`${rayonCle}:${cle}`);
/* Ce que la boutique offre au rayon « Ton club » : tout ce qui n'est pas encore à toi. */
export function offresDuClub(m = lireMeta()) {
  const c = choixDuClub(m);
  return RAYONS_CLUB.flatMap(R => Object.entries(R.liste).filter(([k]) => !possede(m, R.cle, k)).map(([k, o]) => ({
    cle: `${R.cle}:${k}`, sorte: R.cle, rayon: R.titre, nom: o.nom, prix: o.prix,
    verrou: o.rang && rangDePrestige(m) < o.rang ? `Prestige : ${PRESTIGES[o.rang].nom}` : '',
    apercu: ecussonDe({ ...c, [R.cle]: k }), ...(o.primary ? { nuance: [o.primary, o.secondary] } : {}) })));
}
/*
 * Le prendre au méta, une fois payé : les jetons, eux, se paient par la décision d'achat de la
 * boutique (js/rogue-jeu.js), comme un pack — c'est elle que la partie rejoue. Il est aussitôt porté.
 */
export function prendre(cleOffre) {
  const [r, k] = cleOffre.split(':');
  const m = lireMeta();
  if (!rayon(r) || !rayon(r).liste[k]) return;
  if (!possede(m, r, k)) m.club = { ...(m.club || {}), pris: [...((m.club && m.club.pris) || []), cleOffre] };
  m.club = { ...(m.club || {}), [r]: k };
  ecrireMeta(m);
  appliquerClub(m);
}
/* Porter ce qui est à toi (le vestiaire). Rend vrai si le club a changé. */
export function porter(rayonCle, cle) {
  const m = lireMeta();
  if (!rayon(rayonCle) || !rayon(rayonCle).liste[cle] || !possede(m, rayonCle, cle)) return false;
  m.club = { ...(m.club || {}), [rayonCle]: cle };
  ecrireMeta(m);
  appliquerClub(m);
  return true;
}

let actuel = DEPART;
export const nomDuClub = () => NOMS[actuel.nom].nom;
export const courtDuClub = () => NOMS[actuel.nom].court;
/* L'écusson d'un choix, pour un aperçu (l'écran « Ton club ») sans le porter. */
export function ecussonDe(c) {
  const P = PALETTES[c.palette], N = NOMS[c.nom];
  return ECUSSONS[c.ecusson].svg(P.primary, P.secondary, c.ecusson === 'etoile' && c.nom === 'stars' ? 'NHL STARS' : N.court);
}
/* Pose le club choisi là où l'interface lit ton équipe. Rend le choix. */
export function appliquerClub(m = lireMeta()) {
  actuel = choixDuClub(m);
  const P = PALETTES[actuel.palette];
  TEAM_COLORS.YOU = { primary: P.primary, secondary: P.secondary, text: P.text, accent: P.secondary };
  poserEcussonDuClub(ecussonDe(actuel));
  return actuel;
}
