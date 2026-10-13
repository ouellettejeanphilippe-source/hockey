/**
 * TON CLUB — son nom et son écusson (ensemble), ses couleurs, qui se débloquent run après run.
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
 * LES CLUBS : UN NOM ET SON ÉCUSSON, ENSEMBLE (JP, 13 oct. : *nom et logo devraient être ensemble, et logos moins
 * ressemblants*). Avant, huit noms et trente écussons à part, tous bâtis sur le même gabarit (un cadre, un motif,
 * la plaque du code) : ils se ressemblaient tous, et rien ne liait « Harfangs » à son harfang. Chaque club a
 * maintenant SON écusson, dessiné ici pour lui (jamais emprunté), et chacun sa composition : une tête de mascotte
 * sans cadre, un lettrage, un monogramme, un fanion, un rondin, un phare… `a` l'aplat, `b` la seconde, `mot` le
 * code. Le nom est PLURIEL (« Les Harfangs soulèvent la Coupe ») ; son code tient en trois lettres.
 */
const BLANC = '#ffffff';
const TXT = (y, taille, fill, mot, large = 62, x = 50) => `<text x="${x}" y="${y}" font-family="Arial Narrow, Arial, sans-serif" font-weight="900" font-size="${taille}" letter-spacing="1.5" fill="${fill}" text-anchor="middle" textLength="${large}" lengthAdjust="spacingAndGlyphs">${esc(mot)}</text>`;
const SVG = corps => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${corps}</svg>`;
/* Une étoile à cinq branches, centrée en (x, y), de rayon r. */
const etoile5 = (x, y, r, fill) => `<polygon points="${Array.from({ length: 10 }, (_, k) => { const t = -Math.PI / 2 + (k * Math.PI) / 5, q = k % 2 ? r * 0.42 : r; return `${(x + q * Math.cos(t)).toFixed(1)},${(y + q * Math.sin(t)).toFixed(1)}`; }).join(' ')}" fill="${fill}"/>`;
const CLUB = (nom, court, prix, svg, rang) => ({ nom, court, prix, svg, ...(rang ? { rang } : {}) });
const CLUBS = {
  // Le club de départ : le rond, l'étoile, la plaque.
  stars: CLUB('NHL Stars', 'NHL', 0, (a, b, mot) => SVG(`<circle cx="50" cy="50" r="47" fill="${a}" stroke="${b}" stroke-width="5"/>
    <circle cx="50" cy="50" r="38" fill="none" stroke="${BLANC}" stroke-width="2"/>
    <polygon points="50,14 58.5,36 82,36 63,50 70,73 50,59 30,73 37,50 18,36 41.5,36" fill="${BLANC}"/>
    <polygon points="50,24 55,37 69,37 58,45.5 62.5,59 50,50.5 37.5,59 42,45.5 31,37 45,37" fill="${b}"/>
    <rect x="14" y="70" width="72" height="16" rx="3" fill="${b}"/>${TXT(82.5, 13.5, a, mot)}`)),
  // La tête du harfang, sans cadre : ses aigrettes en sont les coins.
  harfangs: CLUB('Harfangs', 'HAR', 20, (a, b, mot) => SVG(`<path d="M50 8 C68 8 82 16 88 28 L95 12 L94 44 C96 72 76 94 50 94 C24 94 4 72 6 44 L5 12 L12 28 C18 16 32 8 50 8 Z" fill="${a}" stroke="${b}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="34" cy="46" r="16" fill="${BLANC}"/><circle cx="66" cy="46" r="16" fill="${BLANC}"/>
    <circle cx="34" cy="46" r="9" fill="${b}"/><circle cx="66" cy="46" r="9" fill="${b}"/><circle cx="34" cy="46" r="4" fill="${a}"/><circle cx="66" cy="46" r="4" fill="${a}"/>
    <path d="M16 28 L46 38 M84 28 L54 38" stroke="${b}" stroke-width="5" stroke-linecap="round"/>
    <polygon points="44,58 56,58 50,72" fill="${b}"/>${TXT(88, 10, BLANC, mot, 26)}`)),
  // Le panache qui déborde de l'écu.
  orignaux: CLUB('Orignaux', 'ORI', 20, (a, b) => SVG(`<path d="M22 36 H78 V62 Q78 84 50 96 Q22 84 22 62 Z" fill="${a}" stroke="${b}" stroke-width="4" stroke-linejoin="round"/>
    <g fill="${b}"><path d="M44 40 C30 40 16 32 8 14 L16 20 L16 6 L24 18 L28 4 L33 18 L40 8 L40 26 C42 32 45 34 48 36 Z"/><path d="M44 40 C30 40 16 32 8 14 L16 20 L16 6 L24 18 L28 4 L33 18 L40 8 L40 26 C42 32 45 34 48 36 Z" transform="translate(100 0) scale(-1 1)"/></g>
    <path d="M38 38 Q50 32 62 38 L59 66 Q57 82 50 84 Q43 82 41 66 Z" fill="${BLANC}"/>
    <circle cx="44" cy="50" r="2.6" fill="${a}"/><circle cx="56" cy="50" r="2.6" fill="${a}"/><circle cx="46" cy="76" r="2" fill="${a}"/><circle cx="54" cy="76" r="2" fill="${a}"/>`)),
  // Le huard sur l'eau, dans un ovale couché.
  huards: CLUB('Huards', 'HUA', 20, (a, b, mot) => SVG(`<ellipse cx="50" cy="50" rx="47" ry="38" fill="${a}" stroke="${b}" stroke-width="4"/>
    <path d="M18 54 Q28 40 50 44 Q58 32 70 32 Q78 32 84 40 L74 42 Q72 54 58 58 Q38 62 18 54 Z" fill="${BLANC}"/>
    <path d="M58 40 Q64 35 72 36" stroke="${b}" stroke-width="3" fill="none"/><circle cx="74" cy="37" r="1.8" fill="${a}"/>
    <g fill="${a}"><rect x="34" y="48" width="4" height="4"/><rect x="42" y="48" width="4" height="4"/><rect x="50" y="49" width="4" height="4"/><rect x="38" y="53" width="4" height="3"/><rect x="46" y="54" width="4" height="3"/></g>
    <path d="M12 66 Q30 60 50 66 T88 66" stroke="${b}" stroke-width="4" fill="none" stroke-linecap="round"/>${TXT(82, 10, BLANC, mot, 28)}`)),
  // Le bout d'un rondin, ses cernes, les deux haches plantées.
  bucherons: CLUB('Bûcherons', 'BUC', 25, (a, b) => SVG(`<path d="M50 4 C70 3 92 18 96 40 C99 62 86 92 54 96 C26 99 6 82 4 54 C2 28 26 5 50 4 Z" fill="${b}"/>
    <circle cx="50" cy="50" r="38" fill="${a}"/><g fill="none" stroke="${b}" stroke-width="3"><circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="21"/><circle cx="50" cy="50" r="12"/></g><circle cx="50" cy="50" r="4" fill="${b}"/>
    <path d="M50 50 L70 22" stroke="${a}" stroke-width="3"/>
    <g stroke="${BLANC}" stroke-width="6" stroke-linecap="round"><path d="M22 84 L66 22"/><path d="M78 84 L34 22"/></g>
    <path d="M58 16 Q78 14 84 34 Q70 38 62 30 Z" fill="${BLANC}" stroke="${a}" stroke-width="2"/><path d="M42 16 Q22 14 16 34 Q30 38 38 30 Z" fill="${BLANC}" stroke="${a}" stroke-width="2"/>`)),
  // Trois griffes qui déchirent l'hexagone.
  carcajous: CLUB('Carcajous', 'CRC', 25, (a, b) => SVG(`<polygon points="50,3 91,26 91,74 50,97 9,74 9,26" fill="${a}" stroke="${b}" stroke-width="5" stroke-linejoin="round"/>
    <g fill="${BLANC}"><path d="M30 14 Q40 50 26 88 L34 86 Q48 50 38 14 Z"/><path d="M48 10 Q58 50 44 92 L52 90 Q66 50 56 10 Z"/><path d="M66 14 Q76 50 62 86 L70 84 Q84 50 74 14 Z"/></g>
    <g fill="${b}"><path d="M33 22 Q40 50 30 80 L32 79 Q44 50 36 22 Z"/><path d="M51 18 Q58 50 48 84 L50 83 Q62 50 54 18 Z"/><path d="M69 22 Q76 50 66 78 L68 77 Q80 50 72 22 Z"/></g>`)),
  // Un lettrage en pastille, la traînée et l'étoile.
  cometes: CLUB('Comètes', 'COM', 30, (a, b) => SVG(`<rect x="2" y="30" width="96" height="44" rx="22" fill="${a}" stroke="${b}" stroke-width="3"/>
    <path d="M10 64 Q48 42 80 28" stroke="${b}" stroke-width="8" stroke-linecap="round" opacity="0.6" fill="none"/>
    ${etoile5(82, 26, 15, BLANC)}${etoile5(82, 26, 7, b)}
    <text x="48" y="62" font-family="Arial Narrow, Arial, sans-serif" font-style="italic" font-weight="900" font-size="22" fill="${BLANC}" text-anchor="middle" textLength="74" lengthAdjust="spacingAndGlyphs">COMÈTES</text>
    <path d="M14 68 Q48 74 86 64" stroke="${BLANC}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`), 1),
  // Le loup qui hurle devant la pleine lune.
  loupsgarous: CLUB('Loups-garous', 'LGR', 40, (a, b) => SVG(`<circle cx="50" cy="50" r="47" fill="${a}" stroke="${b}" stroke-width="5"/>
    <circle cx="60" cy="38" r="24" fill="${b}"/>
    <path d="M18 92 C20 78 24 68 30 60 C28 54 29 48 32 44 L30 28 L39 37 L43 24 L48 36 C53 33 58 27 63 20 L71 11 L68 24 L62 31 L76 22 L67 37 C62 45 58 51 58 59 C62 67 64 79 62 92 Z" fill="${BLANC}"/>
    <polygon points="44,42 50,40 47,46" fill="${a}"/>
    <path d="M10 82 Q50 74 90 82" stroke="${b}" stroke-width="4" fill="none"/>`), 2),
  // Le losange de glace et son flocon.
  blizzard: CLUB('Blizzard', 'BLZ', 25, (a, b) => SVG(`<rect x="17" y="17" width="66" height="66" rx="6" transform="rotate(45 50 50)" fill="${a}" stroke="${b}" stroke-width="5"/>
    <g stroke="${BLANC}" stroke-width="5" stroke-linecap="round"><path d="M50 18 L50 82"/><path d="M22 34 L78 66"/><path d="M78 34 L22 66"/></g>
    <g stroke="${b}" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M42 22 L50 30 L58 22"/><path d="M42 78 L50 70 L58 78"/><path d="M24 44 L32 40 L28 30"/><path d="M76 56 L68 60 L72 70"/><path d="M76 44 L68 40 L72 30"/><path d="M24 56 L32 60 L28 70"/></g>
    <circle cx="50" cy="50" r="6" fill="${b}"/>`)),
  // Le T du Tonnerre, l'éclair qui le traverse.
  tonnerre: CLUB('Tonnerre', 'TON', 25, (a, b) => SVG(`<path d="M8 6 H92 V60 L50 96 L8 60 Z" fill="${a}" stroke="${b}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="18" y="16" width="64" height="15" fill="${BLANC}"/><rect x="42" y="16" width="16" height="58" fill="${BLANC}"/>
    <polygon points="64,22 34,58 50,58 38,90 74,46 58,46 70,22" fill="${b}" stroke="${a}" stroke-width="2.5" stroke-linejoin="round"/>`)),
  // Un fanion couché sur sa hampe, la rivière dessous.
  draveurs: CLUB('Draveurs', 'DRA', 25, (a, b, mot) => SVG(`<rect x="8" y="4" width="6" height="92" rx="3" fill="${BLANC}"/><circle cx="11" cy="5" r="5" fill="${b}"/>
    <path d="M14 12 L96 38 L14 64 Z" fill="${a}" stroke="${b}" stroke-width="4" stroke-linejoin="round"/>
    ${TXT(43, 15, BLANC, mot, 36, 40)}
    <path d="M22 52 Q32 46 42 52 T62 52" stroke="${b}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M16 82 Q34 74 52 82 T88 82" stroke="${b}" stroke-width="5" fill="none" stroke-linecap="round"/>`)),
  // La rose des vents, le canot en travers.
  voyageurs: CLUB('Voyageurs', 'VOY', 30, (a, b) => SVG(`<circle cx="50" cy="50" r="46" fill="${a}" stroke="${b}" stroke-width="4"/>
    <polygon points="50,6 56,44 50,50 44,44" fill="${b}"/><polygon points="50,94 56,56 50,50 44,56" fill="${BLANC}"/><polygon points="6,50 44,44 50,50 44,56" fill="${BLANC}"/><polygon points="94,50 56,44 50,50 56,56" fill="${BLANC}"/>
    <path d="M14 62 Q50 80 86 62 Q80 74 50 76 Q20 74 14 62 Z" fill="${b}" stroke="${a}" stroke-width="2"/>
    <path d="M34 50 L42 80 M64 48 L58 80" stroke="${BLANC}" stroke-width="3" stroke-linecap="round"/>`)),
  // La tête de l'ours noir, de face.
  ours: CLUB('Ours noirs', 'ONR', 30, (a, b) => SVG(`<circle cx="24" cy="22" r="13" fill="${a}" stroke="${b}" stroke-width="4"/><circle cx="76" cy="22" r="13" fill="${a}" stroke="${b}" stroke-width="4"/>
    <circle cx="24" cy="22" r="5" fill="${b}"/><circle cx="76" cy="22" r="5" fill="${b}"/>
    <path d="M12 48 C12 22 88 22 88 48 C88 76 72 94 50 94 C28 94 12 76 12 48 Z" fill="${a}" stroke="${b}" stroke-width="4"/>
    <path d="M28 40 L42 46 M72 40 L58 46" stroke="${b}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="37" cy="52" r="4" fill="${BLANC}"/><circle cx="63" cy="52" r="4" fill="${BLANC}"/>
    <ellipse cx="50" cy="70" rx="19" ry="15" fill="${BLANC}"/><path d="M42 62 H58 L50 72 Z" fill="${a}"/><path d="M50 72 L50 78 M44 80 Q50 84 56 80" stroke="${a}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`)),
  // Le phare, ses deux faisceaux, la mer.
  phares: CLUB('Phares', 'PHA', 30, (a, b) => SVG(`<rect x="5" y="5" width="90" height="90" rx="22" fill="${a}" stroke="${b}" stroke-width="5"/>
    <polygon points="50,30 8,14 8,42" fill="${b}" opacity="0.55"/><polygon points="50,30 92,14 92,42" fill="${b}" opacity="0.55"/>
    <polygon points="42,34 58,34 62,82 38,82" fill="${BLANC}"/><rect x="40.5" y="46" width="19" height="7" fill="${b}"/><rect x="39" y="62" width="22" height="7" fill="${b}"/>
    <rect x="43" y="23" width="14" height="11" fill="${b}"/><polygon points="41,23 59,23 50,14" fill="${BLANC}"/>
    <path d="M8 84 Q28 78 50 84 T92 84" stroke="${BLANC}" stroke-width="4" fill="none" stroke-linecap="round"/>`)),
  // Le faucon : les ailes débordent du rond.
  faucons: CLUB('Faucons', 'FAU', 30, (a, b) => SVG(`<path d="M50 48 C36 32 18 26 2 30 C14 36 22 42 26 48 C18 48 10 52 4 58 C20 54 34 56 50 62 Z" fill="${b}"/>
    <path d="M50 48 C36 32 18 26 2 30 C14 36 22 42 26 48 C18 48 10 52 4 58 C20 54 34 56 50 62 Z" fill="${b}" transform="translate(100 0) scale(-1 1)"/>
    <circle cx="50" cy="52" r="26" fill="${a}" stroke="${b}" stroke-width="4"/>
    <path d="M38 40 Q50 24 62 40 Q64 56 56 70 L50 80 L44 70 Q36 56 38 40 Z" fill="${BLANC}"/>
    <path d="M42 42 L50 46 L58 42" stroke="${a}" stroke-width="3" fill="none"/><circle cx="44" cy="40" r="2.4" fill="${a}"/><circle cx="56" cy="40" r="2.4" fill="${a}"/>
    <polygon points="47,48 53,48 50,56" fill="${b}"/>`)),
  // Le béluga qui saute, dans un anneau plein.
  belugas: CLUB('Bélugas', 'BEL', 30, (a, b) => SVG(`<circle cx="50" cy="50" r="47" fill="${b}"/><circle cx="50" cy="50" r="38" fill="${a}"/>
    <path d="M20 66 C24 40 46 26 66 30 C78 32 84 40 82 48 C80 52 74 52 70 50 C62 46 50 48 42 58 C36 66 30 70 20 66 Z" fill="${BLANC}"/>
    <path d="M20 66 L10 58 L14 70 L8 78 Z" fill="${BLANC}"/><circle cx="72" cy="40" r="2.4" fill="${a}"/>
    <path d="M18 80 Q34 74 50 80 T82 80" stroke="${BLANC}" stroke-width="3" fill="none" stroke-linecap="round"/>`)),
  // Le C du Caribou, coiffé de ses bois, dans un carré franc.
  caribous: CLUB('Caribous', 'CAR', 35, (a, b) => SVG(`<rect x="6" y="6" width="88" height="88" fill="${a}" stroke="${b}" stroke-width="5"/>
    <path d="M72 42 A24 24 0 1 0 72 74" stroke="${BLANC}" stroke-width="13" fill="none"/>
    <g stroke="${b}" stroke-width="3.5" fill="none" stroke-linecap="round"><path d="M40 34 L30 12 M33 20 L22 18 M30 12 L34 4"/><path d="M58 34 L68 12 M65 20 L76 18 M68 12 L64 4"/></g>`), 1),
  // Trois feux follets dans une capsule.
  feuxfollets: CLUB('Feux follets', 'FFO', 40, (a, b) => SVG(`<rect x="18" y="4" width="64" height="92" rx="32" fill="${a}" stroke="${b}" stroke-width="5"/>
    <path d="M50 12 C58 26 64 30 60 42 C58 50 42 50 40 42 C36 32 44 28 46 20 C48 24 50 22 50 12 Z" fill="${b}"/>
    <path d="M36 46 C42 56 46 60 43 68 C41 74 31 74 29 68 C27 60 33 58 34 52 C36 54 37 52 36 46 Z" fill="${BLANC}"/>
    <path d="M64 50 C70 60 74 64 71 72 C69 78 59 78 57 72 C55 64 61 62 62 56 C64 58 65 56 64 50 Z" fill="${BLANC}"/>
    <path d="M44 82 C48 88 50 90 49 94" stroke="${b}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`), 2),
  // La chasse-galerie : le canot volant devant le croissant, sur sa bannière.
  chassegalerie: CLUB('Chasse-galerie', 'CHG', 45, (a, b, mot) => SVG(`<circle cx="50" cy="40" r="37" fill="${a}" stroke="${b}" stroke-width="4"/>
    <circle cx="64" cy="26" r="12" fill="${BLANC}"/><circle cx="70" cy="23" r="10" fill="${a}"/>
    ${etoile5(28, 22, 4, BLANC)}${etoile5(40, 14, 3, BLANC)}
    <path d="M14 48 Q50 64 86 42 Q80 56 50 60 Q24 60 14 48 Z" fill="${b}"/>
    <g fill="${BLANC}"><circle cx="32" cy="48" r="3.2"/><circle cx="44" cy="51" r="3.2"/><circle cx="56" cy="50" r="3.2"/><circle cx="68" cy="47" r="3.2"/></g>
    <path d="M6 70 L94 70 L88 81 L94 92 L6 92 L12 81 Z" fill="${b}"/>${TXT(87, 13, a, mot, 44)}`), 3),
  // Le R royal, sa couronne au-dessus de l'écu.
  royaux: CLUB('Royaux', 'ROY', 55, (a, b) => SVG(`<path d="M16 32 H84 V58 Q84 84 50 96 Q16 84 16 58 Z" fill="${a}" stroke="${b}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M18 30 L22 6 L36 18 L50 2 L64 18 L78 6 L82 30 Z" fill="${b}" stroke="${BLANC}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="22" cy="6" r="3.5" fill="${BLANC}"/><circle cx="50" cy="3" r="3.5" fill="${BLANC}"/><circle cx="78" cy="6" r="3.5" fill="${BLANC}"/>
    <text x="50" y="80" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="46" fill="${BLANC}" text-anchor="middle">R</text>`), 4),
};
/* Les deux rayons de l'écran « Ton club », dans l'ordre où on les lit : le club (son nom et son écusson), ses couleurs. */
export const RAYONS_CLUB = [
  { cle: 'club', titre: 'Le club', liste: CLUBS },
  { cle: 'palette', titre: 'Les couleurs', liste: PALETTES },
];
const DEPART = { club: 'stars', palette: 'etoiles' };
/*
 * LES ACHATS D'AVANT (un nom et un écusson vendus à part) : un nom acheté donne son club ; un écusson acheté donne
 * le club dont il était le motif. Le reste des vieux écussons n'a plus de club.
 */
const ANCIENS = { 'ecusson:harfang': 'harfangs', 'ecusson:huard': 'huards', 'ecusson:loup': 'loupsgarous', 'ecusson:comete': 'cometes', 'ecusson:hache': 'bucherons', 'ecusson:flocon': 'blizzard', 'ecusson:eclair': 'tonnerre', 'ecusson:patte': 'ours', 'ecusson:couronne': 'royaux' };
const clubDAvant = cle => (cle.startsWith('nom:') ? cle.slice(4) : ANCIENS[cle]);
const rayon = cle => RAYONS_CLUB.find(R => R.cle === cle);

/* Le choix du club dans le méta, complété : ce qui n'existe plus retombe sur le départ. */
export function choixDuClub(m = lireMeta()) {
  const vieux = (m && m.club) || {};
  const c = { ...DEPART, ...vieux, club: vieux.club || vieux.nom || DEPART.club };
  for (const R of RAYONS_CLUB) if (!R.liste[c[R.cle]]) c[R.cle] = DEPART[R.cle];
  return c;
}
/* Un objet est à toi s'il est gratuit ou acheté (`m.club.pris`, « nom:harfangs »). */
export const possede = (m, rayonCle, cle) => {
  const pris = (m.club && m.club.pris) || [];
  return !rayon(rayonCle).liste[cle].prix || pris.includes(`${rayonCle}:${cle}`) || (rayonCle === 'club' && pris.some(k => clubDAvant(k) === cle));
};
/* Ce que la boutique offre au rayon « Ton club » : tout ce qui n'est pas encore à toi. */
export function offresDuClub(m = lireMeta()) {
  const c = choixDuClub(m);
  return RAYONS_CLUB.flatMap(R => Object.entries(R.liste).filter(([k]) => !possede(m, R.cle, k)).map(([k, o]) => ({
    cle: `${R.cle}:${k}`, sorte: R.cle, nom: o.nom, prix: o.prix,
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
export const nomDuClub = () => CLUBS[actuel.club].nom;
export const courtDuClub = () => CLUBS[actuel.club].court;
/* L'écusson d'un choix, pour un aperçu (l'écran « Ton club ») sans le porter. */
export function ecussonDe(c) {
  const P = PALETTES[c.palette], C = CLUBS[c.club];
  return C.svg(P.primary, P.secondary, c.club === 'stars' ? 'NHL STARS' : C.court);
}
/* Pose le club choisi là où l'interface lit ton équipe. Rend le choix. */
export function appliquerClub(m = lireMeta()) {
  actuel = choixDuClub(m);
  const P = PALETTES[actuel.palette];
  TEAM_COLORS.YOU = { primary: P.primary, secondary: P.secondary, text: P.text, accent: P.secondary };
  poserEcussonDuClub(ecussonDe(actuel));
  return actuel;
}
