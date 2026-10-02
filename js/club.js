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
/* Les couleurs : l'aplat (primary), la seconde (le liseré, la plaque), l'encre sur l'aplat. */
const PALETTES = {
  etoiles: { nom: 'Noir et orange', primary: '#0b0b0b', secondary: '#f47a20', text: '#ffffff', prix: 0 },
  glacier: { nom: 'Marine et glace', primary: '#0b2545', secondary: '#8ecae6', text: '#ffffff', prix: 20 },
  brasier: { nom: 'Rouge et or', primary: '#8d0b1b', secondary: '#ffb703', text: '#ffffff', prix: 20 },
  foret: { nom: 'Forêt et crème', primary: '#1b4332', secondary: '#e9d8a6', text: '#ffffff', prix: 25 },
  acier: { nom: 'Acier et argent', primary: '#22262e', secondary: '#c0c6cf', text: '#ffffff', prix: 25, rang: 1 },
  aurore: { nom: 'Aurore boréale', primary: '#3c096c', secondary: '#2ec4b6', text: '#ffffff', prix: 40, rang: 2 },
  dynastie: { nom: 'Noir et or', primary: '#111111', secondary: '#d4af37', text: '#ffffff', prix: 60, rang: 4 },
};
/*
 * Les écussons : chacun DESSINÉ ici (jamais emprunté, comme ceux des disparues),
 * aux couleurs choisies et au code du club. `a` l'aplat, `b` la seconde.
 */
const TXT = (y, taille, fill, mot, large = 62) => `<text x="50" y="${y}" font-family="Arial Narrow, Arial, sans-serif" font-weight="900" font-size="${taille}" letter-spacing="1.5" fill="${fill}" text-anchor="middle" textLength="${large}" lengthAdjust="spacingAndGlyphs">${esc(mot)}</text>`;
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
    cle: `${R.cle}:${k}`, rayon: R.titre, nom: o.nom, prix: o.prix,
    verrou: o.rang && rangDePrestige(m) < o.rang ? `Prestige : ${PRESTIGES[o.rang].nom}` : '',
    apercu: ecussonDe({ ...c, [R.cle]: k }) })));
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
