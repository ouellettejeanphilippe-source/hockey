/**
 * Données de logos et couleurs des équipes (actuelles et disparues).
 */

// Logos SVG inline intégrés pour les franchises disparues / historiques sans URL officielle active
const INLINE_LOGOS = {
  // Nordiques de Québec (Fleur de lys / N rouge avec bâton)
  QUE: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#00529b" stroke="#ffffff" stroke-width="3"/>
    <path d="M22 75 V28 L50 62 V28 H62 V75 L34 41 V75 Z" fill="#e31837"/>
    <circle cx="73" cy="33" r="6" fill="#e31837"/>
    <path d="M73 48 C70 54 66 58 60 62 C68 64 73 70 73 78 C73 70 78 64 86 62 C80 58 76 54 73 48 Z" fill="#ffffff"/>
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
};

export const TEAM_COLORS = {
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
};

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
