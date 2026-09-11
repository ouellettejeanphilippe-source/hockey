/**
 * Données de logos et couleurs des équipes (actuelles et disparues).
 */

// Logos SVG inline intégrés pour les franchises disparues / historiques sans URL officielle active
const INLINE_LOGOS = {
  /*
   * NORDIQUES DE QUÉBEC. JP : *les Nordiques ont pas le bon logo*. C'était un
   * « N » rouge avec une fleur de lys collée à côté, ce qui n'a jamais été
   * l'écusson du club. Le vrai est un IGLOU bleu — un dôme, son tunnel
   * d'entrée à gauche, et le creux au milieu qui dessine un N — traversé
   * d'un bâton de hockey rouge, et semé des fleurs de lys du chandail.
   * Dessiné ici, pas emprunté.
   */
  QUE: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g fill="#00529b">
      <path d="M16 78 V56 A34 34 0 0 1 84 56 V78 H64 V56 A14 14 0 0 0 36 56 V78 Z"/>
      <path d="M4 78 V68 A13 13 0 0 1 30 68 V78 Z"/>
    </g>
    <g fill="#e31837">
      <path d="M30 34 L82 16 L84.5 23 L36 39.5 Z"/>
      <path d="M22 33 C26 31 31 31 34 33 L36.5 39.5 C32 42 26 42 22 39.5 Z"/>
    </g>
    <g fill="#ffffff">
      <path d="M50 60 C48.6 63 46.8 65 44 66.6 C47.6 67.8 50 70.6 50 74 C50 70.6 52.4 67.8 56 66.6 C53.2 65 51.4 63 50 60 Z"/>
      <path d="M24 60 C22.9 62.3 21.5 63.8 19.4 65 C22.1 65.9 24 68 24 70.6 C24 68 25.9 65.9 28.6 65 C26.5 63.8 25.1 62.3 24 60 Z"/>
      <path d="M76 60 C74.9 62.3 73.5 63.8 71.4 65 C74.1 65.9 76 68 76 70.6 C76 68 77.9 65.9 80.6 65 C78.5 63.8 77.1 62.3 76 60 Z"/>
    </g>
  </svg>`,

  // Whalers de Hartford (Baleine W/H verte et bleue)
  HFD: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 30 L32 75 L50 45 L68 75 L90 30 H72 L50 62 L28 30 Z" fill="#00205b"/>
    <path d="M22 25 C35 5 65 5 78 25 C62 20 50 32 50 38 C50 32 38 20 22 25 Z" fill="#00843d"/>
  </svg>`,

  // North Stars du Minnesota (Étoile N verte et jaune)
  MNS: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 78 V22 H38 L62 60 V22 H78 V78 H60 L36 40 V78 Z" fill="#00843d"/>
    <polygon points="50,8 55,22 70,22 58,30 62,44 50,35 38,44 42,30 30,22 45,22" fill="#ffc72c"/>
  </svg>`,

  // Jets de Winnipeg (1979-96)
  WIN: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="46" fill="#00205b" stroke="#c8102e" stroke-width="4"/>
    <text x="50" y="48" font-family="sans-serif" font-weight="900" font-size="22" fill="#ffffff" text-anchor="middle">JETS</text>
    <path d="M25 62 L75 62 L65 72 L35 72 Z" fill="#c8102e"/>
  </svg>`,

  // Coyotes de Phoenix (1996-2014) / ARI
  PHX: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,10 85,85 50,70 15,85" fill="#8c2633"/>
    <polygon points="50,10 50,70 85,85" fill="#e2d6b5"/>
  </svg>`,

  // Thrashers d'Atlanta (1999-2011)
  ATL: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 20 C50 10 80 30 80 60 C80 85 50 85 20 70 C40 65 60 55 50 35 Z" fill="#002d62"/>
    <path d="M30 30 C55 25 70 40 65 65 C50 55 40 45 30 30 Z" fill="#5c768d"/>
    <circle cx="65" cy="35" r="4" fill="#fdb827"/>
  </svg>`,

  // Flames d'Atlanta (1972-1980)
  AFM: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 85 L50 15 L70 85 L54 85 L50 65 L46 85 Z" fill="#d21034"/>
    <polygon points="40,50 60,50 50,25" fill="#ffc72c"/>
  </svg>`,

  // Scouts de Kansas City / Rockies du Colorado / Barons de Cleveland / Seals
  KCS: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#c8102e"/><text x="50" y="58" font-size="28" font-weight="900" fill="#ffc72c" text-anchor="middle">KC</text></svg>`,
  CLR: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,10 90,85 10,85" fill="#00205b"/><polygon points="50,30 75,75 25,75" fill="#c8102e"/><circle cx="50" cy="58" r="8" fill="#ffc72c"/></svg>`,
  CLE: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="80" height="60" rx="10" fill="#c8102e"/><text x="50" y="60" font-size="32" font-weight="900" fill="#ffffff" text-anchor="middle">B</text></svg>`,
  CGS: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#00843d"/><text x="50" y="58" font-size="24" font-weight="900" fill="#ffc72c" text-anchor="middle">SEALS</text></svg>`,
  OAK: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#00843d"/><text x="50" y="58" font-size="24" font-weight="900" fill="#ffffff" text-anchor="middle">OAK</text></svg>`,
  MDA: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M20 20 L80 80 M80 20 L20 80" stroke="#00685e" stroke-width="12"/><ellipse cx="50" cy="50" rx="30" ry="22" fill="#00685e"/><polygon points="35,45 65,45 50,65" fill="#f0592b"/></svg>`,

  // TON équipe : les NHL Stars. Un écusson d'étoiles à l'ancienne, noir,
  // blanc et orange — dessiné ici, pas emprunté : une rondelle noire, l'étoile
  // blanche, le liseré orange et le mot STARS sur la bande.
  YOU: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="47" fill="#0b0b0b" stroke="#f47a20" stroke-width="5"/>
    <circle cx="50" cy="50" r="38" fill="none" stroke="#ffffff" stroke-width="2"/>
    <polygon points="50,14 58.5,36 82,36 63,50 70,73 50,59 30,73 37,50 18,36 41.5,36" fill="#ffffff"/>
    <polygon points="50,24 55,37 69,37 58,45.5 62.5,59 50,50.5 37.5,59 42,45.5 31,37 45,37" fill="#f47a20"/>
    <rect x="14" y="70" width="72" height="16" rx="3" fill="#f47a20"/>
    <text x="50" y="82.5" font-family="Arial Narrow, Arial, sans-serif" font-weight="900" font-size="13.5" letter-spacing="1.5" fill="#0b0b0b" text-anchor="middle">NHL STARS</text>
  </svg>`,
};

export const TEAM_COLORS = {
  // Les NHL Stars, ton équipe : noir, blanc, orange, comme les vieux chandails du match des étoiles.
  YOU: { primary: '#0b0b0b', secondary: '#f47a20', text: '#ffffff', accent: '#f47a20' },
  MTL: { primary: '#af1e2d', secondary: '#192168', text: '#ffffff', accent: '#af1e2d' },
  TOR: { primary: '#00205b', secondary: '#001030', text: '#ffffff', accent: '#003399' },
  BOS: { primary: '#ffb81c', secondary: '#111111', text: '#111111', accent: '#ffb81c' },
  NYR: { primary: '#0038a8', secondary: '#ce1126', text: '#ffffff', accent: '#0038a8' },
  DET: { primary: '#ce1126', secondary: '#800a18', text: '#ffffff', accent: '#ce1126' },
  CHI: { primary: '#cf0a2c', secondary: '#000000', text: '#ffffff', accent: '#cf0a2c' },
  EDM: { primary: '#041e42', secondary: '#ff4c00', text: '#ffffff', accent: '#ff4c00' },
  CGY: { primary: '#c8102e', secondary: '#f1be48', text: '#ffffff', accent: '#c8102e' },
  VAN: { primary: '#00205b', secondary: '#00843d', text: '#ffffff', accent: '#00843d' },
  QUE: { primary: '#00529b', secondary: '#e31837', text: '#ffffff', accent: '#00529b' },
  HFD: { primary: '#00843d', secondary: '#00205b', text: '#ffffff', accent: '#00843d' },
  MNS: { primary: '#00843d', secondary: '#ffc72c', text: '#ffffff', accent: '#00843d' },
  WIN: { primary: '#00205b', secondary: '#c8102e', text: '#ffffff', accent: '#c8102e' },
  WPG: { primary: '#041e42', secondary: '#004c97', text: '#ffffff', accent: '#004c97' },
  PIT: { primary: '#fcb514', secondary: '#000000', text: '#000000', accent: '#fcb514' },
  PHI: { primary: '#f74902', secondary: '#000000', text: '#ffffff', accent: '#f74902' },
  STL: { primary: '#002f87', secondary: '#fcb514', text: '#ffffff', accent: '#002f87' },
  LAK: { primary: '#111111', secondary: '#a2aaad', text: '#ffffff', accent: '#a2aaad' },
  BUF: { primary: '#002654', secondary: '#fcb514', text: '#ffffff', accent: '#fcb514' },
  NYI: { primary: '#00539b', secondary: '#f47d30', text: '#ffffff', accent: '#f47d30' },
  WSH: { primary: '#041e42', secondary: '#c8102e', text: '#ffffff', accent: '#c8102e' },
  NJD: { primary: '#ce1126', secondary: '#000000', text: '#ffffff', accent: '#ce1126' },
  COL: { primary: '#6f263d', secondary: '#236192', text: '#ffffff', accent: '#236192' },
  DAL: { primary: '#006847', secondary: '#8f8f8f', text: '#ffffff', accent: '#006847' },
  SJS: { primary: '#006d75', secondary: '#ea6d10', text: '#ffffff', accent: '#006d75' },
  TBL: { primary: '#002868', secondary: '#001438', text: '#ffffff', accent: '#002868' },
  FLA: { primary: '#041e42', secondary: '#c8102e', text: '#ffffff', accent: '#c8102e' },
  ANA: { primary: '#f47a38', secondary: '#b3995d', text: '#ffffff', accent: '#f47a38' },
  MDA: { primary: '#00685e', secondary: '#f0592b', text: '#ffffff', accent: '#00685e' },
  NSH: { primary: '#ffb81c', secondary: '#041e42', text: '#000000', accent: '#ffb81c' },
  CBJ: { primary: '#041e42', secondary: '#c8102e', text: '#ffffff', accent: '#c8102e' },
  MIN: { primary: '#154734', secondary: '#a6192e', text: '#ffffff', accent: '#154734' },
  CAR: { primary: '#cc0000', secondary: '#000000', text: '#ffffff', accent: '#cc0000' },
  VGK: { primary: '#b4975a', secondary: '#333f48', text: '#ffffff', accent: '#b4975a' },
  SEA: { primary: '#001628', secondary: '#99d9d9', text: '#ffffff', accent: '#68a2b9' },
  ARI: { primary: '#8c2633', secondary: '#e2d6b5', text: '#ffffff', accent: '#8c2633' },
  PHX: { primary: '#8c2633', secondary: '#e2d6b5', text: '#ffffff', accent: '#8c2633' },
  UTA: { primary: '#000000', secondary: '#69b3e7', text: '#ffffff', accent: '#69b3e7' },
  ATL: { primary: '#002d62', secondary: '#5c768d', text: '#ffffff', accent: '#5c768d' },
  CLR: { primary: '#00205b', secondary: '#c8102e', text: '#ffffff', accent: '#c8102e' },
  // Les cinq franchises des années 1970 qui n'avaient pas de couleur : elles
  // tombaient sur le bleu par défaut, et Atlanta ressemblait à Kansas City.
  AFM: { primary: '#c8102e', secondary: '#ffc72c', text: '#ffffff', accent: '#c8102e' },
  CLE: { primary: '#c8102e', secondary: '#000000', text: '#ffffff', accent: '#c8102e' },
  KCS: { primary: '#0038a8', secondary: '#c8102e', text: '#ffffff', accent: '#ffc72c' },
  CGS: { primary: '#00843d', secondary: '#ffc72c', text: '#ffffff', accent: '#00843d' },
  OAK: { primary: '#00843d', secondary: '#ffc72c', text: '#ffffff', accent: '#00843d' },
};

/* ---------- teinte lisible ---------- */

const hexToRgb = hex => {
  const h = String(hex || '').replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(v, 16);
  return Number.isNaN(n) ? [56, 189, 248] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');

/** Luminance relative (WCAG), 0 = noir, 1 = blanc. */
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Couleur d'équipe éclaircie jusqu'à rester visible sur le fond sombre du
 * jeu. Sans ça, le bleu marine de St. Louis ou le noir des Kings donnent une
 * bordure invisible et une étiquette illisible.
 */
export function readableAccent(hex, target = 0.30) {
  let rgb = hexToRgb(hex);
  let lum = luminance(rgbToHex(rgb));
  let guard = 0;
  while (lum < target && guard++ < 24) {
    rgb = rgb.map(v => v + (255 - v) * 0.12);
    lum = luminance(rgbToHex(rgb));
  }
  return rgbToHex(rgb);
}

/**
 * LE FOND D'UNE CARTE AUX COULEURS DU CLUB.
 *
 * JP : *utilise vraiment les palettes colorées des équipes, le noir, c'est le
 * background dude*. Une carte teintée à 13 % sur du noir, ce n'est pas la
 * couleur d'un club, c'est un soupçon. On prend donc sa VRAIE couleur et on
 * l'assombrit jusqu'à une luminance de travail — le marine de Toronto reste
 * marine, le rouge de Montréal reste rouge, l'or de Boston devient un ambre
 * profond — assez sombre pour qu'un nom blanc se lise par-dessus, assez
 * coloré pour qu'on reconnaisse le vestiaire sans lire le bandeau.
 *
 * Un club dont la couleur principale est déjà plus noire que la cible (les
 * Kings, les Bruins) prend sa deuxième couleur : le noir, lui, est déjà le
 * fond de la page.
 */
export function fondEquipe(teamCode, cible = 0.045) {
  const c = TEAM_COLORS[teamCode];
  if (!c) return null;
  let base = c.primary;
  if (luminance(base) < cible) base = c.secondary || c.accent || base;
  if (luminance(base) < cible) base = c.accent || base;
  if (luminance(base) < cible) return null;   // tout le club est noir : le fond de la palette suffit
  // Assombrir vers le noir jusqu'à la cible, par dichotomie sur le mélange.
  const rgb = saturer(hexToRgb(base), CHROMA_FOND);
  let lo = 0, hi = 1, k = 1;
  for (let i = 0; i < 20; i++) {
    k = (lo + hi) / 2;
    if (luminance(rgbToHex(rgb.map(v => v * k))) > cible) hi = k; else lo = k;
  }
  return rgbToHex(rgb.map(v => v * k));
}

/*
 * ASSOMBRIR SANS DÉLAVER. Multiplier les trois canaux par un même facteur
 * garde la teinte mais rapproche les canaux les uns des autres en valeur
 * absolue : l'or des Bruins arrivait en bas de l'échelle sous la forme d'un
 * brun de terre, et JP a dit le mot — *c'est drabe un peu*. On écarte donc
 * chaque canal de sa moyenne d'un facteur constant après l'assombrissement.
 * La luminance ne bouge presque pas (la moyenne est conservée), la teinte
 * non plus, mais le brun redevient un ambre : c'est la couleur du club qu'on
 * doit reconnaître sur un écran de téléphone, pas une ombre.
 */
const CHROMA_FOND = 1.45;

function saturer(rgb, f) {
  const moy = (rgb[0] + rgb[1] + rgb[2]) / 3;
  return rgb.map(v => Math.max(0, Math.min(255, moy + (v - moy) * f)));
}

/** Accent lisible d'une équipe, prêt à poser dans une variable CSS. */
/**
 * L'encre à poser SUR un aplat de la couleur d'équipe — le seul endroit du
 * jeu où du texte repose sur cette couleur, et donc le seul où il faut la
 * mesurer plutôt que la deviner.
 *
 * On calcule les deux rapports de contraste (WCAG) et on garde le meilleur.
 * Mesuré sur les 32 équipes : parce que `getTeamAccent` éclaircit tout
 * jusqu'à une luminance de 0,30, le blanc ne dépasse jamais **2,8:1** —
 * sous le seuil lisible de 4,5:1 — pendant que le bleu nuit donne 7,5:1
 * (Vancouver, Philadelphie) à 12,1:1 (Boston, Nashville). L'encre foncée
 * gagne donc partout aujourd'hui ; le calcul reste pour que ça tienne si
 * l'éclaircissement change.
 */
export function getTeamInk(teamCode) {
  const L = luminance(getTeamAccent(teamCode));
  const surBlanc = 1.05 / (L + 0.05);
  const surFonce = (L + 0.05) / 0.05;
  return surFonce >= surBlanc ? '#08131f' : '#ffffff';
}

/*
 * LE BANDEAU PORTE LA COULEUR BRUTE DE L'ÉQUIPE, PAS SA VERSION ÉCLAIRCIE.
 * `getTeamAccent` éclaircit jusqu'à une luminance de 0,30 pour qu'une bordure
 * reste visible sur le fond sombre — mais posé en aplat plein, ce rouge de
 * Chicago devenait rose saumon et le marine de Toronto un bleu poudre : des
 * couleurs de maillot délavées, et c'est ce qui faisait « cheap ». Un aplat
 * n'a pas besoin d'être clair pour se voir : il a besoin d'une encre qui
 * contraste. On garde donc le rouge, le marine, le noir des Kings, et on
 * mesure l'encre dessus (blanc ou bleu nuit, le meilleur rapport WCAG). Si
 * aucune des deux n'atteint 4,5:1 — un ton moyen, comme le vert des North
 * Stars — on éclaircit juste assez pour que l'encre foncée y arrive.
 *
 * `stripe` est la couleur secondaire, le liseré du maillot : il souligne le
 * bandeau et c'est lui qui distingue Edmonton (marine, liseré orange) de
 * Toronto (marine, liseré marine).
 */
const FOND_PAGE = '#0a0b0e';
const VISIBLE = 2.4;   // contraste minimal contre le fond pour qu'un trait existe

export function getTeamBand(teamCode) {
  const c = TEAM_COLORS[teamCode];
  if (!c) return { bg: '#1b1f26', ink: '#ffffff', stripe: '#8ab4f0', stripeInk: '#0a0b0e', bouton: '#8ab4f0', boutonInk: '#0a0b0e' };
  let bg = c.primary;
  let ink = inkFor(bg);
  if (contrast(bg, ink) < 4.5) {
    bg = readableAccent(bg, 0.36);
    ink = inkFor(bg);
  }
  let stripe = c.secondary && c.secondary.toLowerCase() !== bg.toLowerCase() ? c.secondary : (c.accent || '#ffffff');
  // LE BOUTON SIGNER PORTE LA COULEUR SECONDAIRE DU CLUB. JP : *bouton signer
  // de la couleur secondaire de l'équipe*. Un liseré d'un pixel peut être
  // sombre ; un bouton plein doit porter du texte, donc on l'éclaircit juste
  // assez pour qu'une encre passe le 4,5:1 — la même mesure que le bandeau.
  if (contrast(stripe, inkFor(stripe)) < 4.5) stripe = readableAccent(stripe, 0.30);
  /*
   * LE BOUTON doit aussi se voir SUR LA CARTE, et pas seulement porter du
   * texte : la secondaire de la Caroline est le noir, et un bouton noir sur
   * une carte presque noire disparaissait. Quand la secondaire se confond
   * avec le fond, c'est la couleur vive du club qui prend le bouton.
   */
  const bouton = contrast(stripe, FOND_PAGE) >= VISIBLE ? stripe : couleurVive(teamCode);
  /*
   * LA PLAQUE : LA SECONDE COULEUR DU CLUB, EN APLAT.
   *
   * JP : *utilise pas juste couleur primaire, mais secondaire aussi, pour
   * contraste et vibe équipe*. Un bandeau de diffusion est BICOLORE — un
   * bloc de la couleur de fond, un bloc de la couleur qui tranche — et c'est
   * ce deuxième bloc qui fait qu'on reconnaît un club d'un coup d'oeil : le
   * noir sur l'or des Bruins, le blanc sur le marine de Toronto, le rouge sur
   * le bleu des Nordiques. La secondaire n'est donc plus seulement un liseré
   * d'un pixel : elle porte l'écusson.
   *
   * Deux mesures, dans cet ordre. Il faut d'abord que la plaque SE DÉTACHE de
   * l'aplat (`separe`) — deux bleus marine côte à côte ne font pas deux
   * blocs, ils font une tache. Sinon c'est l'encre du bandeau (blanc ou bleu
   * nuit) qui prend la plaque, comme une plaque de chandail blanc. Ensuite,
   * ce qui s'écrit dessus se mesure sur elle (`plaqueInk`).
   */
  const seconde = c.secondary && c.secondary.toLowerCase() !== bg.toLowerCase()
    ? c.secondary : (c.accent || ink);
  const plaque = separe(seconde, bg) ? seconde : ink;
  return {
    bg, ink, stripe, stripeInk: inkFor(stripe), bouton, boutonInk: inkFor(bouton),
    plaque, plaqueInk: inkFor(plaque),
  };
}

/*
 * DEUX APLATS VOISINS SE LISENT-ILS COMME DEUX BLOCS ?
 *
 * Le rapport WCAG ne regarde que la luminance, et il dit non au rouge des
 * Rangers sur leur bleu (1,75) — alors que c'est précisément le bandeau des
 * Rangers. Il dit non aussi au rouge des Nordiques sur leur bleu (1,66) et au
 * rouge du Wild sur son vert forêt (1,41). Un écart de TEINTE sépare tout
 * aussi bien qu'un écart de clarté : on accepte donc la plaque si l'un des
 * deux est franc — le contraste de luminance, ou la distance entre les deux
 * couleurs. Ce qui reste refusé est exactement ce qu'on voulait refuser : le
 * marine de Toronto sur son marine plus sombre (1,22 et 46), le tan d'Anaheim
 * sur son orange (1,01 et 81).
 */
const SEPARE_LUM = 1.8;
const SEPARE_DIST = 90;

function separe(a, b) {
  if (contrast(a, b) >= SEPARE_LUM) return true;
  const [ra, ga, ba] = hexToRgb(a), [rb, gb, bb] = hexToRgb(b);
  return Math.hypot(ra - rb, ga - gb, ba - bb) >= SEPARE_DIST;
}

function contrast(bg, ink) {
  const a = luminance(bg), b = luminance(ink);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/**
 * L'ENCRE QUI VA SUR UNE COULEUR. Exportée parce que l'interface prend
 * maintenant la couleur de l'équipe courante (`applyTeamColors`) : ce qui
 * était écrit en laiton passe à l'orange des NHL Stars pendant la saison, au
 * rouge du club sorti pendant le repêchage, et il faut une encre lisible
 * dessus à chaque fois. Même mesure que le bandeau : les deux rapports de
 * contraste WCAG, on garde la meilleure.
 */
export const encreSur = couleur => inkFor(couleur);

function inkFor(bg) {
  return contrast(bg, '#ffffff') >= contrast(bg, '#0a0b0e') ? '#ffffff' : '#0a0b0e';
}

/*
 * LA SAISON D'UNE ÉQUIPE SUR HOCKEY-REFERENCE. Une adresse par équipe et par
 * saison, stable, vérifiée pour chacun des 44 codes du dépôt (une requête par
 * code, le 8 septembre 2026 : toutes répondent 200 avec le bon titre). Ce
 * n'est pas du scraping — on n'en lit rien, on y envoie. Les codes diffèrent
 * des nôtres pour six franchises, et trois changent avec l'époque : les
 * Black Hawks s'écrivent CBH jusqu'en 1985-86, les Mighty Ducks MDA jusqu'en
 * 2005-06, et Vegas est VEG. L'année de l'adresse est celle de la FIN de la
 * saison : 1976-77 → 1977.
 */
const HR_CODES = { AFM: 'ATF', HFD: 'HAR', VGK: 'VEG' };
export function teamSeasonUrl(teamCode, season) {
  if (!teamCode || !season) return null;
  const debut = parseInt(String(season).slice(0, 4), 10);
  if (!debut) return null;
  let code = HR_CODES[teamCode] || teamCode;
  if (teamCode === 'CHI' && debut <= 1985) code = 'CBH';
  if (teamCode === 'ANA' && debut <= 2005) code = 'MDA';
  return `https://www.hockey-reference.com/teams/${code}/${debut + 1}.html`;
}

/**
 * LA COULEUR VIVE D'UNE ÉQUIPE : SA VRAIE COULEUR, JAMAIS DÉLAVÉE.
 *
 * JP : *les vraies couleurs des équipes, pas délavées*. `getTeamAccent`
 * ÉCLAIRCISSAIT la couleur jusqu'à ce qu'elle se voie sur le fond sombre :
 * le rouge de Chicago virait rose, le marine de Toronto bleu poudre. On ne
 * délave plus rien — on CHOISIT : parmi les couleurs brutes du club
 * (primaire, secondaire, accent), la première qui se détache vraiment du
 * fond de page. Le rouge de Chicago passe (3,5:1), le marine de Toronto non,
 * et c'est alors son blanc qui prend le relais — le blanc de son chandail,
 * pas un bleu délavé. Aucune n'atteint le seuil (un club tout en noir) : le
 * blanc, comme sur la glace.
 *
 * Sert au contour d'une carte, à la bordure d'une case, et à l'accent de
 * toute l'interface quand elle prend les couleurs d'une équipe.
 */
export function couleurVive(teamCode) {
  const c = TEAM_COLORS[teamCode];
  if (!c) return '#8ab4f0';
  for (const x of [c.accent, c.primary, c.secondary]) {
    if (x && contrast(x, FOND_PAGE) >= VISIBLE) return x;
  }
  return '#ffffff';
}

/**
 * LA COULEUR DU CLUB, MESURÉE SUR SON PROPRE FOND DE CARTE.
 *
 * Depuis que la carte porte la vraie couleur du club, saturée, l'accent de
 * l'interface — le salaire, le chiffre clé — se retrouvait écrit en rouge sur
 * un fond rouge : le rouge de Washington est à 1,89:1 sur son propre fond, et
 * 33 des 44 clubs passent sous 4,5:1. Même règle que le bandeau : on MESURE.
 * Si la couleur du club se lit sur sa carte, elle reste ; sinon c'est l'encre
 * du fond qui prend le relais (blanc, ou bleu nuit sur un fond clair). On ne
 * délave jamais la couleur pour la sauver : ou elle se lit, ou elle cède.
 */
export function viveSurFond(teamCode, fond) {
  const base = couleurVive(teamCode);
  if (!fond) return base;
  return contrast(base, fond) >= 4.5 ? base : inkFor(fond);
}

/** L'ancienne couleur éclaircie. Gardée pour les fonds et les lueurs, jamais pour un trait. */
export function getTeamAccent(teamCode) {
  const c = TEAM_COLORS[teamCode];
  if (!c) return '#8ab4f0';
  return readableAccent(c.accent || c.primary);
}

/**
 * Retourne le HTML d'un logo pour le code d'équipe fourni.
 */
export function getTeamLogoHtml(teamCode, size = 32) {
  if (!teamCode) return '';
  if (INLINE_LOGOS[teamCode]) {
    return `<div class="team-logo-inline" style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-center">${INLINE_LOGOS[teamCode]}</div>`;
  }
  const url = `https://assets.nhle.com/logos/nhl/svg/${teamCode}_light.svg`;
  return `<img src="${url}" class="team-logo-img" style="width:${size}px;height:${size}px;object-fit:contain" alt="${teamCode}" onerror="this.style.display='none'">`;
}
