/**
 * SUR GLACE — LA PHYSIQUE (31 oct. 2026). JP : *faire un jeu 2D avec une physique crédible, pas refaire un jeu de
 * 30 ans*. Le match vu de haut, joué à la manette, où la glace se SENT : la rondelle glisse et meurt, la bande
 * rend, le patineur a de l'inertie et un rayon de virage, une mise en échec est une collision avec des masses.
 *
 * Rien ici ne lit l'écran : des mètres, des secondes, des kilogrammes, un pas de temps fixe (`PAS`, 120 par
 * seconde) et un hasard semé (`de`, de la graine). Les mêmes entrées sur la même graine rejouent le même match,
 * en Node comme au navigateur — `check_physique` le prouve, et chaque chiffre d'en bas s'y mesure.
 *
 * CE QUE « CRÉDIBLE » VEUT DIRE, EN CHIFFRES (tous ici, et nulle part ailleurs ; `reglesDeLaGlace` les dit) :
 *   - la rondelle pèse 170 g, roule à un frottement de 0,10 sur la glace (≈ 1 m/s perdu par seconde) : un tir de
 *     100 km/h traverse la patinoire, une passe douce à 20 km/h meurt après une quinzaine de mètres ;
 *   - la bande rend 55 % de la vitesse normale, le coin est un arc de 28 pieds, le poteau rend 70 %, le filet
 *     arrête tout ;
 *   - le patineur pèse 85 kg, pousse à 7 m/s², file à 38 km/h au plus, freine à 12 m/s² ; ses lames mordent
 *     de côté (`grip`), mais pas au-delà de `adherence` m/s² : à pleine vitesse, le virage le plus serré fait
 *     six mètres de rayon, et il dérive un peu. ARCADE (JP, 31 oct. : *joueur trop lent ; penser à une physique
 *     arcade plus NHL 94*) : la physique reste la même, ses chiffres penchent vers la console — la pointe en
 *     deux secondes, le demi-tour sur un dix cents, le tir qui part vite et qui vise le filet (`assist`) ;
 *   - la mise en échec est une collision entre deux masses ; celui qui a le moins d'élan tombe si l'écart
 *     dépasse `CHUTE.seuil` kg·m/s ;
 *   - le gardien voit la rondelle avec 150 ms de retard, bouge à 5 m/s au plus, couvre 1,10 m de large ; un tir
 *     qui le trouve est un arrêt, un sur deux est gelé, l'autre rebondit.
 *
 * Le moteur de la saison (js/sim.js) reste le moteur des matchs du jeu : celui-ci joue UNE glace, à la main.
 */
import { LONGUEUR, LARGEUR } from './glace.js';
import { entierDeGraine } from './sim.js';

const PIED = 0.3048;
/* La patinoire, en mètres : 200 × 85 pieds, les coins arrondis à 28 pieds. */
export const L = LONGUEUR * PIED;            // 60,96
export const W = LARGEUR * PIED;             // 25,91
export const COIN = 28 * PIED;               // 8,53
export const LIGNE_BUT = L / 2 - 11 * PIED;  // 27,13 : la ligne de but, à 3,35 m de la bande
export const BLEUE = 25 * PIED;              // 7,62 : la ligne bleue, de part et d'autre du centre
/* Les points de mise en jeu de la zone, et le rayon des cercles. */
export const POINT = { x: L / 2 - 31 * PIED, y: 22 * PIED, r: 15 * PIED };
export const FILET = { large: 6 * PIED, profond: 44 / 12 * PIED, poteau: 0.03, enclave: 6 * PIED };

const PAS = 1 / 120;
const G = 9.81;

export const RONDELLE = { masse: 0.17, rayon: 0.038, frottement: 0.10, bande: 0.55, poteau: 0.70, filet: 0.10 };
export const PATIN = {
  masse: 85, rayon: 0.55,   // un peu plus gros que nature (JP : *joueur plus gros un peu*) : il se voit, il se frappe
  vMax: 10.6,       // la vitesse de pointe, m/s (38 km/h)
  accel: 8,         // la poussée, m/s² : la pointe en deux secondes et demie, comme à la console
  frein: 9,         // l'arrêt, m/s² (avec la roue libre et l'air, un arrêt net en une demi-seconde)
  glisse: 4,        // la roue libre, m/s² : le bâton lâché, on s'arrête en moins de trois secondes (JP : *ça glisse trop*) ; en poussant, les lames ne perdent rien
  grip: 14,         // la morsure des lames de côté : la vitesse en travers s'éteint à ce taux, par seconde
  adherence: 18,    // l'accélération latérale que les lames tiennent, m/s² : le rayon de virage, c'est v² / adherence
  pivot: 9,         // le virage sur place, rad/s
  portee: 1.5,      // la rondelle plus loin que ça de la lame est perdue
  bande: 0.15,      // ce que le patineur rend sur la bande
  sol: 1.4,         // le temps au sol après une chute, s
};
export const BATON = {
  lame: [1.0, 0.3],          // où la lame tient la rondelle, devant et de côté, m
  ressort: 80, amorti: 18,   // la rondelle suit la lame comme un ressort amorti (critique)
  maniement: 45,             // l'accélération que la lame peut donner à la rondelle, m/s² : au-delà, elle traîne
  passe: 16,                 // la passe, m/s (58 km/h)
  tirMin: 24, tirMax: 42,    // le tir, du poignet au lancer frappé chargé, m/s (86 à 151 km/h)
  charge: 0.45,              // le temps de charge d'un lancer frappé, s
  ecart: 0.035,              // l'écart-type de la visée, rad, doublé à pleine charge
  visee: 0.6,                // le bâton vise jusqu'à ça de côté du cap, rad
  assist: 1.5,               // la visée assistée : le filet à moins de ça du cap (presque de côté), le tir part vers lui, rad (JP : *impossible de viser et patiner*)
  large: 0.4,                // le bâton à fond de côté vise ça au-delà du poteau : on peut rater le filet, comme dans FIFA, m
  reception: 16,             // une rondelle qui arrive plus vite que ça ne se prend pas : elle dévie
  lachee: 0.25,              // après un tir ou une passe, la lame la laisse filer ce temps-là
};
export const GARDIEN = {
  reaction: 0.15, vMax: 5, accel: 14, demi: 0.5, profondeur: 0.3,
  sortie: 1.1,       // à combien devant la ligne il défie, m
  couvre: 0.5,       // la part des arrêts gelés ; l'autre part rebondit
  rebond: 0.35,      // ce qu'un rebond garde de la vitesse
};
export const CHUTE = { seuil: 300 };   // l'écart d'élan, kg·m/s, au-delà duquel le moins lancé des deux tombe

/* ---------- les outils ---------- */
const hyp = Math.hypot;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const plier = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
/* Un générateur semé (mulberry32) : la graine du match, hachée comme partout ailleurs. */
function generateur(graine) {
  let a = entierDeGraine(graine) || 1;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const gauss = de => Math.sqrt(-2 * Math.log(1 - de())) * Math.cos(2 * Math.PI * de());

/* La lame d'un patineur : devant lui, un peu de côté. */
export function lame(s) {
  const c = Math.cos(s.cap), n = Math.sin(s.cap);
  return { x: s.x + c * BATON.lame[0] - n * BATON.lame[1], y: s.y + n * BATON.lame[0] + c * BATON.lame[1] };
}

/* ---------- l'état ---------- */
function patineur(id, equipe, x, y, cap, poste = null) {
  return { id, equipe, x, y, vx: 0, vy: 0, cap, masse: PATIN.masse, rayon: PATIN.rayon, auSol: 0, charge: 0, lachee: 0, tenaitTir: false, tenaitPasse: false, poste };
}

/**
 * Une glace neuve : toi à gauche du centre, la rondelle au centre, un plot (un adversaire qui ne fait que se tenir
 * debout, pour sentir la mise en échec) dans la zone, et le gardien dans son filet, à droite.
 */
export function nouvelleGlace(graine = 'glace') {
  const etat = {
    graine, de: generateur(graine), t: 0, reste: 0,
    rondelle: { x: 0, y: 0, vx: 0, vy: 0, porteur: null },
    patineurs: [
      patineur('toi', 'toi', -6, 0, 0),
      patineur('plot', 'eux', LIGNE_BUT - 12, -4.5, Math.PI, { x: LIGNE_BUT - 12, y: -4.5 }),
    ],
    gardien: { x: LIGNE_BUT - GARDIEN.sortie, y: 0, vx: 0, vy: 0, memoire: [] },
    compte: { tirs: 0, buts: 0, arrets: 0, poteaux: 0, echecs: 0 },
    arret: null,          // { genre: 'but' | 'gel', reste }
    dernierTir: 0,        // la vitesse du dernier tir, m/s
  };
  return etat;
}

/* ---------- la patinoire : la bande, les coins, le filet ---------- */
/*
 * UN CERCLE CONTRE LA BANDE. Le rectangle aux coins arrondis : un mur droit, ou l'arc du coin. Rend la vitesse
 * normale perdue (0 si rien n'a touché), pour que l'écran entende le choc.
 */
export function bander(o, r, rest) {
  const X = L / 2, Y = W / 2;
  let choc = 0;
  if (Math.abs(o.x) > X - COIN && Math.abs(o.y) > Y - COIN) {
    const cx = Math.sign(o.x) * (X - COIN), cy = Math.sign(o.y) * (Y - COIN);
    const dx = o.x - cx, dy = o.y - cy, d = hyp(dx, dy) || 1e-9;
    if (d > COIN - r) {
      const nx = dx / d, ny = dy / d;
      o.x = cx + nx * (COIN - r); o.y = cy + ny * (COIN - r);
      const vn = o.vx * nx + o.vy * ny;
      if (vn > 0) { o.vx -= (1 + rest) * vn * nx; o.vy -= (1 + rest) * vn * ny; choc = vn; }
    }
    return choc;
  }
  if (o.x > X - r) { o.x = X - r; if (o.vx > 0) { choc = o.vx; o.vx = -o.vx * rest; } }
  else if (o.x < -X + r) { o.x = -X + r; if (o.vx < 0) { choc = -o.vx; o.vx = -o.vx * rest; } }
  if (o.y > Y - r) { o.y = Y - r; if (o.vy > 0) { choc = Math.max(choc, o.vy); o.vy = -o.vy * rest; } }
  else if (o.y < -Y + r) { o.y = -Y + r; if (o.vy < 0) { choc = Math.max(choc, -o.vy); o.vy = -o.vy * rest; } }
  return choc;
}

/* Un cercle contre un cercle fixe (un poteau, le gardien). Rend la vitesse d'approche perdue (0 si rien n'a touché). */
function contreCercle(o, r, cx, cy, cr, rest) {
  const dx = o.x - cx, dy = o.y - cy, d = hyp(dx, dy) || 1e-9;
  if (d >= cr + r) return 0;
  const nx = dx / d, ny = dy / d;
  o.x = cx + nx * (cr + r); o.y = cy + ny * (cr + r);
  const vn = o.vx * nx + o.vy * ny;
  if (vn < 0) { o.vx -= (1 + rest) * vn * nx; o.vy -= (1 + rest) * vn * ny; return -vn; }
  return 0;
}

/*
 * LE FILET, vu par la rondelle : deux poteaux ronds sur la ligne de but, deux côtés et un fond qui ne rendent
 * presque rien (la maille). Ouvert devant. Les deux filets sont là, celui de gauche en miroir.
 */
function contreFilet(o, r, etat, ev) {
  for (const s of [1, -1]) {
    const xb = s * LIGNE_BUT;                       // la ligne de but
    const xf = s * (LIGNE_BUT + FILET.profond);     // le fond
    const demi = FILET.large / 2;
    for (const yp of [-demi, demi]) {
      if (contreCercle(o, r, xb, yp, FILET.poteau, RONDELLE.poteau) > 3) { etat.compte.poteaux++; ev.push({ type: 'poteau' }); }
    }
    const dedansX = s > 0 ? (o.x > xb && o.x < xf) : (o.x < xb && o.x > xf);
    const devantFond = s > 0 ? o.x < xf : o.x > xf;
    // Les côtés : la rondelle de l'extérieur, qui rentre dans la maille.
    if (dedansX && Math.abs(o.y) > demi && Math.abs(o.y) - r < demi) {
      o.y = Math.sign(o.y) * (demi + r);
      if (Math.sign(o.vy) !== Math.sign(o.y)) o.vy = -o.vy * RONDELLE.filet;
    }
    // Le fond : par-derrière.
    if (!devantFond && Math.abs(o.y) < demi + r && Math.abs(o.x - xf) < r) {
      o.x = xf + s * r;
      if (s > 0 ? o.vx < 0 : o.vx > 0) o.vx = -o.vx * RONDELLE.filet;
    }
  }
}

/* Le filet, vu par un patineur : une boîte pleine, on la contourne. */
function patineurContreFilet(s) {
  for (const sg of [1, -1]) {
    const x0 = Math.min(sg * LIGNE_BUT, sg * (LIGNE_BUT + FILET.profond)), x1 = Math.max(sg * LIGNE_BUT, sg * (LIGNE_BUT + FILET.profond));
    const demi = FILET.large / 2;
    const px = clamp(s.x, x0, x1), py = clamp(s.y, -demi, demi);
    const dx = s.x - px, dy = s.y - py, d = hyp(dx, dy);
    if (d >= s.rayon || d === 0) continue;
    const nx = dx / d, ny = dy / d;
    s.x = px + nx * s.rayon; s.y = py + ny * s.rayon;
    const vn = s.vx * nx + s.vy * ny;
    if (vn < 0) { s.vx -= vn * nx; s.vy -= vn * ny; }
  }
}

/* ---------- le patineur ---------- */
/*
 * PATINER. Le bâton (le stick de la manette) dit où on VEUT aller ; le corps suit avec son inertie :
 *   - le cap tourne vers le bâton, au plus `pivot` rad/s à l'arrêt, et de moins en moins vite à mesure que la
 *     vitesse monte (les lames ne tiennent que `adherence` m/s² de côté) ;
 *   - on pousse dans le sens du cap, d'autant moins que le bâton en est loin ; charger un tir coûte la moitié ;
 *   - le bâton à l'envers, lancé, c'est le frein ;
 *   - la vitesse en travers du cap s'éteint (`grip`), mais pas d'un coup : au virage serré, ça dérive.
 */
function patiner(s, e) {
  if (s.auSol > 0) {
    s.auSol -= PAS;
    const v = hyp(s.vx, s.vy);
    if (v > 0) { const f = Math.max(0, v - 4 * PAS) / v; s.vx *= f; s.vy *= f; }
    s.charge = 0;
    s.x += s.vx * PAS; s.y += s.vy * PAS;
    return;
  }
  const v = hyp(s.vx, s.vy);
  const m = e ? Math.min(1, hyp(e.x, e.y)) : 0;
  let pousse = 0;
  if (m > 0.1) {
    const phi = Math.atan2(e.y, e.x);
    const d = plier(phi - s.cap);
    if (Math.abs(d) > 2.1 && v > 1.2) {
      // Le frein : les lames en travers.
      const f = Math.max(0, v - PATIN.frein * m * PAS) / v;
      s.vx *= f; s.vy *= f;
      s.cap += clamp(d, -1, 1) * PAS;
    } else {
      const omegaMax = Math.min(PATIN.pivot, PATIN.adherence / Math.max(v, 0.5));
      s.cap += clamp(d * 6, -omegaMax, omegaMax) * PAS;
      pousse = PATIN.accel * m * Math.max(0, Math.cos(d)) * (s.charge > 0 ? 0.5 : 1);
      s.vx += Math.cos(s.cap) * pousse * PAS; s.vy += Math.sin(s.cap) * pousse * PAS;
    }
  }
  // La roue libre (quand on ne pousse pas), et l'air qui plafonne la vitesse.
  const v2 = hyp(s.vx, s.vy);
  if (v2 > 0) {
    const dec = (pousse > 0 ? 0 : PATIN.glisse) + PATIN.accel * (v2 / PATIN.vMax) ** 2;
    const f = Math.max(0, v2 - dec * PAS) / v2;
    s.vx *= f; s.vy *= f;
  }
  // Les lames mordent de côté.
  const c = Math.cos(s.cap), n = Math.sin(s.cap);
  const avant = s.vx * c + s.vy * n;
  const travers = (-s.vx * n + s.vy * c) * Math.exp(-PATIN.grip * PAS);
  s.vx = avant * c - travers * n; s.vy = avant * n + travers * c;
  s.cap = plier(s.cap);
  s.x += s.vx * PAS; s.y += s.vy * PAS;
}

/* Le plot : il retourne à son poste, à petite vitesse, et fait face au centre. */
function entreeDuPlot(s) {
  if (!s.poste) return null;
  const dx = s.poste.x - s.x, dy = s.poste.y - s.y, d = hyp(dx, dy);
  if (d < 0.3) return { x: 0, y: 0 };
  return { x: dx / d * 0.35, y: dy / d * 0.35 };
}

/*
 * LA MISE EN ÉCHEC : deux cercles qui se chevauchent se repoussent, l'élan s'échange (restitution 0,2), et le
 * moins lancé des deux tombe si l'écart d'élan dépasse le seuil. Celui qui tombe lâche la rondelle.
 */
function collisions(etat, ev) {
  const P = etat.patineurs;
  for (const s of P) contreCercle(s, s.rayon, etat.gardien.x, etat.gardien.y, 0.45, 0.1);
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy) || 1e-9;
    const min = a.rayon + b.rayon;
    if (d >= min) continue;
    const nx = dx / d, ny = dy / d;
    const tot = a.masse + b.masse;
    a.x -= nx * (min - d) * b.masse / tot; a.y -= ny * (min - d) * b.masse / tot;
    b.x += nx * (min - d) * a.masse / tot; b.y += ny * (min - d) * a.masse / tot;
    const qa = a.masse * Math.max(0, a.vx * nx + a.vy * ny);     // l'élan de a vers b
    const qb = b.masse * Math.max(0, -(b.vx * nx + b.vy * ny));  // l'élan de b vers a
    const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vrel < 0) {
      const jn = -(1 + 0.2) * vrel / (1 / a.masse + 1 / b.masse);
      a.vx -= jn * nx / a.masse; a.vy -= jn * ny / a.masse;
      b.vx += jn * nx / b.masse; b.vy += jn * ny / b.masse;
    }
    const ecart = qa - qb;
    if (Math.abs(ecart) > CHUTE.seuil / 2) { ev.push({ type: 'echec', fort: Math.abs(ecart) > CHUTE.seuil }); etat.compte.echecs++; }
    if (Math.abs(ecart) > CHUTE.seuil) {
      const tombe = ecart > 0 ? b : a;
      if (tombe.auSol <= 0) tombe.auSol = PATIN.sol;
      if (etat.rondelle.porteur === tombe.id) { etat.rondelle.porteur = null; tombe.lachee = BATON.lachee; }
    }
  }
}

/* ---------- la rondelle ---------- */
function rondelle(etat, entrees, ev) {
  const R = etat.rondelle;
  const porteur = R.porteur ? etat.patineurs.find(p => p.id === R.porteur) : null;
  const avantX = R.x;
  if (porteur) {
    const lm = lame(porteur);
    const dx = lm.x - R.x, dy = lm.y - R.y;
    let ax = BATON.ressort * dx - BATON.amorti * (R.vx - porteur.vx);
    let ay = BATON.ressort * dy - BATON.amorti * (R.vy - porteur.vy);
    const a = hyp(ax, ay);
    if (a > BATON.maniement) { ax *= BATON.maniement / a; ay *= BATON.maniement / a; }
    R.vx += ax * PAS; R.vy += ay * PAS;
    R.x += R.vx * PAS; R.y += R.vy * PAS;
    if (hyp(lm.x - R.x, lm.y - R.y) > PATIN.portee) { R.porteur = null; porteur.lachee = BATON.lachee; ev.push({ type: 'perdue' }); }
    if (but(etat, avantX, ev)) return;
    // Le tir et la passe se décident ici, la rondelle à la lame.
    const e = entrees[porteur.id];
    if (e) {
      const m = hyp(e.x || 0, e.y || 0);
      const vise = m > 0.1 ? porteur.cap + clamp(plier(Math.atan2(e.y, e.x) - porteur.cap), -BATON.visee, BATON.visee) : porteur.cap;
      if (e.passe && !porteur.tenaitPasse) {
        lancer(etat, porteur, vise, BATON.passe, BATON.ecart * 0.6, 1);
        ev.push({ type: 'passe' });
      } else if (porteur.tenaitTir && !e.tir) {
        const part = Math.min(1, porteur.charge / BATON.charge);
        const v = BATON.tirMin + (BATON.tirMax - BATON.tirMin) * part;
        lancer(etat, porteur, viseeAssistee(porteur, vise, m > 0.1 ? e : null), v, BATON.ecart * (1 + 1.5 * part), 0.5);
        etat.compte.tirs++;
        etat.dernierTir = hyp(R.vx, R.vy);
        ev.push({ type: 'tir', v: etat.dernierTir, charge: part });
      }
    }
    return;
  }
  // Libre : le frottement, la bande, le filet.
  const v = hyp(R.vx, R.vy);
  if (v > 0) { const f = Math.max(0, v - RONDELLE.frottement * G * PAS) / v; R.vx *= f; R.vy *= f; }
  R.x += R.vx * PAS; R.y += R.vy * PAS;
  const choc = bander(R, RONDELLE.rayon, RONDELLE.bande);
  if (choc > 3) ev.push({ type: 'bande', v: choc });
  contreFilet(R, RONDELLE.rayon, etat, ev);
  if (but(etat, avantX, ev)) return;
  // Quelqu'un la prend ? À la lame, devant, si elle n'arrive pas trop vite ; sinon, le corps la dévie.
  for (const s of etat.patineurs) {
    if (s.lachee > 0) { s.lachee -= PAS; continue; }
    if (s.auSol > 0) continue;
    const lm = lame(s);
    const dl = hyp(R.x - lm.x, R.y - lm.y);
    const devant = (R.x - s.x) * Math.cos(s.cap) + (R.y - s.y) * Math.sin(s.cap) > 0;
    const vrel = hyp(R.vx - s.vx, R.vy - s.vy);
    if (dl < 0.7 || (dl < PATIN.portee - 0.3 && devant && vrel < 4)) {
      if (vrel <= BATON.reception) { R.porteur = s.id; ev.push({ type: 'prise', qui: s.id }); return; }
      // Trop vite pour la lame : elle dévie.
      const nx = (R.x - lm.x) / (dl || 1e-9), ny = (R.y - lm.y) / (dl || 1e-9);
      const vn = R.vx * nx + R.vy * ny;
      if (vn < 0) { R.vx -= 1.4 * vn * nx; R.vy -= 1.4 * vn * ny; R.vx *= 0.4; R.vy *= 0.4; }
      continue;
    }
    contreCercle(R, RONDELLE.rayon, s.x, s.y, s.rayon, 0.3);
  }
}

/* Le but : la rondelle entière passe la ligne, entre les poteaux, par devant — portée ou lancée. */
function but(etat, avantX, ev) {
  const R = etat.rondelle;
  for (const s of [1, -1]) {
    const xb = s * LIGNE_BUT;
    const entre = Math.abs(R.y) < FILET.large / 2 - RONDELLE.rayon;
    const passee = s > 0 ? (R.x - RONDELLE.rayon > xb && avantX - RONDELLE.rayon <= xb) : (R.x + RONDELLE.rayon < xb && avantX + RONDELLE.rayon >= xb);
    if (!(entre && passee)) continue;
    etat.compte.buts++;
    etat.arret = { genre: 'but', reste: 2 };
    R.vx = 0; R.vy = 0; R.porteur = null;
    ev.push({ type: 'but', cote: s });
    return true;
  }
  return false;
}

/*
 * LE TIR, COMME DANS LES JEUX DE HOCKEY ET DE SOCCER (JP : *impossible de viser et patiner* ; *je veux tir comme les
 * jeux de hockey et soccer standards*). Le bâton patine ; au moment de lâcher le tir, il dit OÙ dans le filet, par
 * rapport à la ligne rondelle-filet : droit vers le but, le centre ; penché, vers ce coin ; à fond de côté, `large`
 * au-delà du poteau — on peut rater, comme dans FIFA. Il faut que le filet soit devant (à moins de `assist` du cap) ;
 * le dos au filet, le tir part dans le cap. La charge fait la vitesse, et écarte la visée.
 */
function viseeAssistee(s, vise, baton) {
  const lm = lame(s);
  for (const sg of [1, -1]) {
    const xb = sg * LIGNE_BUT;
    if ((xb - lm.x) * sg <= 0.5) continue;   // on l'a déjà dépassé
    const dx = xb - lm.x, dy = 0 - lm.y, d = hyp(dx, dy) || 1e-9;
    const centre = Math.atan2(dy, dx);
    if (Math.abs(plier(centre - s.cap)) > BATON.assist) continue;
    // La composante du bâton en travers de la ligne du filet, de -1 à 1, choisit le point visé sur la ligne de but.
    const travers = baton ? clamp((-baton.x * dy + baton.y * dx) / d, -1, 1) : 0;
    const y = travers * (FILET.large / 2 + BATON.large);
    return Math.atan2(y - lm.y, xb - lm.x);
  }
  return vise;
}

/* Un lancer : la rondelle part de la lame, dans la visée, à la vitesse dite plus une part de l'élan du corps. */
function lancer(etat, s, vise, v, ecart, elan) {
  const R = etat.rondelle;
  const ang = vise + gauss(etat.de) * ecart;
  const lm = lame(s);
  R.x = lm.x; R.y = lm.y;
  const long = s.vx * Math.cos(ang) + s.vy * Math.sin(ang);
  const vt = v + Math.max(0, long) * elan;
  R.vx = Math.cos(ang) * vt; R.vy = Math.sin(ang) * vt;
  R.porteur = null;
  s.lachee = BATON.lachee;
  s.charge = 0;
}

/* ---------- le gardien ---------- */
/*
 * LE GARDIEN se place sur la ligne rondelle-filet, sort d'autant plus qu'elle est loin, colle au poteau quand elle
 * est derrière lui. Il la voit avec `reaction` de retard : un tir rapide de près le bat parce qu'il réagit tard,
 * un tir de la bleue lui laisse le temps de se mettre devant. Devant un tir, il va là où elle croisera sa ligne.
 */
function gardien(etat, ev) {
  const Gd = etat.gardien, R = etat.rondelle;
  const n = Math.round(GARDIEN.reaction / PAS);
  const vueDuJour = { x: R.x, y: R.y, vx: R.vx, vy: R.vy, libre: !R.porteur };
  // Une mémoire vide (la remise) se remplit de l'instant : le retard existe dès le premier pas.
  while (Gd.memoire.length < n) Gd.memoire.push(vueDuJour);
  Gd.memoire.push(vueDuJour);
  Gd.memoire.shift();
  const vu = Gd.memoire[0];
  let cible;
  const xMin = LIGNE_BUT - 1.6, xMax = LIGNE_BUT - 0.15;
  if (vu.libre && vu.vx > 8 && vu.x < LIGNE_BUT) {
    const t = (Gd.x - vu.x) / vu.vx;
    cible = { x: Gd.x, y: clamp(vu.y + vu.vy * t, -1.1, 1.1) };
  } else if (vu.x > LIGNE_BUT) {
    cible = { x: xMax, y: Math.sign(vu.y || 1) * 0.75 };
  } else {
    const cx = LIGNE_BUT + 0.3, dx = vu.x - cx, dy = vu.y, d = hyp(dx, dy) || 1e-9;
    const sortie = 0.3 + GARDIEN.sortie * clamp(d / 12, 0.3, 1);
    cible = { x: clamp(cx + dx / d * sortie, xMin, xMax), y: clamp(dy / d * sortie, -1.4, 1.4) };
  }
  const k = 40, c = 2 * Math.sqrt(k);
  let ax = k * (cible.x - Gd.x) - c * Gd.vx, ay = k * (cible.y - Gd.y) - c * Gd.vy;
  const a = hyp(ax, ay);
  if (a > GARDIEN.accel) { ax *= GARDIEN.accel / a; ay *= GARDIEN.accel / a; }
  Gd.vx += ax * PAS; Gd.vy += ay * PAS;
  const v = hyp(Gd.vx, Gd.vy);
  if (v > GARDIEN.vMax) { Gd.vx *= GARDIEN.vMax / v; Gd.vy *= GARDIEN.vMax / v; }
  Gd.x += Gd.vx * PAS; Gd.y += Gd.vy * PAS;
  // L'arrêt : la rondelle libre, devant lui, dans sa largeur.
  if (R.porteur || etat.arret) return;
  const dansY = Math.abs(R.y - Gd.y) < GARDIEN.demi + RONDELLE.rayon;
  const dansX = Math.abs(R.x - Gd.x) < GARDIEN.profondeur + RONDELLE.rayon;
  if (!(dansY && dansX)) return;
  const vr = hyp(R.vx, R.vy);
  if (vr < 2) { etat.arret = { genre: 'gel', reste: 1.5 }; R.vx = 0; R.vy = 0; ev.push({ type: 'gel' }); return; }
  if (R.vx <= 0) return;   // elle s'en va déjà
  etat.compte.arrets++;
  R.x = Gd.x - GARDIEN.profondeur - RONDELLE.rayon - 0.02;
  if (etat.de() < GARDIEN.couvre) {
    etat.arret = { genre: 'gel', reste: 1.5 }; R.vx = 0; R.vy = 0;
    ev.push({ type: 'arret', gele: true });
  } else {
    const ang = Math.PI + (etat.de() - 0.5) * 1.4;
    const vt = vr * GARDIEN.rebond;
    R.vx = Math.cos(ang) * vt; R.vy = Math.sin(ang) * vt;
    ev.push({ type: 'arret', gele: false });
  }
}

/* ---------- la remise ---------- */
/* Après un but, tout au centre ; après un gel, une mise en jeu au point du côté de la rondelle. */
export function remise(etat, genre = 'but') {
  const R = etat.rondelle, toi = etat.patineurs[0];
  R.vx = 0; R.vy = 0; R.porteur = null;
  if (genre === 'but') { R.x = 0; R.y = 0; toi.x = -6; toi.y = 0; }
  else { R.x = POINT.x; R.y = Math.sign(R.y || -1) * POINT.y; toi.x = POINT.x - 2.5; toi.y = R.y; }
  toi.vx = 0; toi.vy = 0; toi.cap = 0; toi.auSol = 0; toi.charge = 0; toi.lachee = 0;
  for (const p of etat.patineurs) if (p.poste) { p.x = p.poste.x; p.y = p.poste.y; p.vx = 0; p.vy = 0; p.auSol = 0; }
  Object.assign(etat.gardien, { x: LIGNE_BUT - GARDIEN.sortie, y: 0, vx: 0, vy: 0, memoire: [] });
  etat.arret = null;
}

/* ---------- un pas ---------- */
function pas(etat, entrees, ev) {
  etat.t += PAS;
  if (etat.arret) {
    etat.arret.reste -= PAS;
    if (etat.arret.reste <= 0) { remise(etat, etat.arret.genre); ev.push({ type: 'remise' }); }
    return;
  }
  for (const s of etat.patineurs) {
    const e = entrees[s.id] || entreeDuPlot(s);
    if (e && e.tir && !s.auSol) s.charge = Math.min(BATON.charge, s.charge + PAS); else if (!(e && e.tir)) { if (!s.tenaitTir) s.charge = 0; }
    patiner(s, e);
  }
  collisions(etat, ev);
  for (const s of etat.patineurs) { bander(s, s.rayon, PATIN.bande); patineurContreFilet(s); }
  rondelle(etat, entrees, ev);
  gardien(etat, ev);
  for (const s of etat.patineurs) {
    const e = entrees[s.id];
    s.tenaitTir = !!(e && e.tir);
    s.tenaitPasse = !!(e && e.passe);
    if (!s.tenaitTir) s.charge = 0;
  }
}

/**
 * AVANCER le temps réel écoulé, en pas fixes. `entrees` : par id de patineur, { x, y, passe, tir } — le bâton en
 * coordonnées de glace (|·| ≤ 1), la passe (un appui), le tir (tenu : il charge ; lâché : il part). Rend les
 * événements du laps (le son, l'écran). Au plus un dixième de seconde d'un coup : un onglet revenu de l'arrière-plan
 * ne rattrape pas une minute de physique.
 */
export function avancer(etat, entrees, dt) {
  const ev = [];
  etat.reste += Math.min(0.1, Math.max(0, dt));
  while (etat.reste >= PAS - 1e-9) { etat.reste -= PAS; pas(etat, entrees, ev); }
  return ev;
}

/** L'empreinte d'un état : les mêmes entrées sur la même graine la rendent pareille. */
export function empreinte(etat) {
  const r = x => Math.round(x * 1000);
  const R = etat.rondelle, Gd = etat.gardien;
  const mots = [r(etat.t), r(R.x), r(R.y), r(R.vx), r(R.vy), R.porteur || '-', r(Gd.x), r(Gd.y),
    ...etat.patineurs.flatMap(s => [r(s.x), r(s.y), r(s.vx), r(s.vy), r(s.cap), r(s.auSol)]),
    etat.compte.tirs, etat.compte.buts, etat.compte.arrets, etat.compte.poteaux];
  return entierDeGraine(mots.join(',')).toString(36);
}

/* ---------- les règles, écrites de là ---------- */
const kmh = v => Math.round(v * 3.6);
const dec = (v, n = 1) => v.toFixed(n).replace('.', ',');
/** Ce que la glace fait, en phrases, chaque chiffre lu des constantes : l'écran les affiche de là. */
export function reglesDeLaGlace() {
  const arretDe = v => v * v / (2 * RONDELLE.frottement * G);
  return [
    `La patinoire fait ${dec(L, 0)} m sur ${dec(W, 0)}, les coins sont des arcs de ${dec(COIN, 1)} m, la ligne de but est à ${dec(L / 2 - LIGNE_BUT, 2)} m de la bande.`,
    `La rondelle pèse ${Math.round(RONDELLE.masse * 1000)} g et perd ≈ ${dec(RONDELLE.frottement * G, 1)} m/s par seconde : une passe à ${kmh(BATON.passe)} km/h meurt après ${Math.round(arretDe(BATON.passe))} m, un tir à ${kmh(BATON.tirMax)} km/h traverserait ${Math.round(arretDe(BATON.tirMax))} m.`,
    `La bande rend ${Math.round(RONDELLE.bande * 100)} % de la vitesse qui la frappe, le poteau ${Math.round(RONDELLE.poteau * 100)} %, la maille du filet ${Math.round(RONDELLE.filet * 100)} %.`,
    `Le patineur pèse ${PATIN.masse} kg, pousse à ${dec(PATIN.accel)} m/s² jusqu'à ${kmh(PATIN.vMax)} km/h, freine à ${PATIN.frein} m/s² (le bâton à l'envers) et perd ${dec(PATIN.glisse)} m/s² en roue libre.`,
    `Ses lames tiennent ${PATIN.adherence} m/s² de côté : à pleine vitesse, le virage le plus serré fait ${dec(PATIN.vMax ** 2 / PATIN.adherence, 0)} m de rayon ; à l'arrêt, il pivote à ${PATIN.pivot} rad/s.`,
    `La lame tient la rondelle à ${dec(BATON.lame[0])} m devant ; plus loin que ${dec(PATIN.portee)} m, elle est perdue. Une rondelle qui arrive à plus de ${kmh(BATON.reception)} km/h ne se prend pas : elle dévie.`,
    `La passe part à ${kmh(BATON.passe)} km/h, le tir du poignet à ${kmh(BATON.tirMin)} km/h, le lancer frappé chargé ${dec(BATON.charge, 2)} s à ${kmh(BATON.tirMax)} km/h, plus une part de ton élan ; la visée s'écarte de ±${dec(BATON.ecart * 57.3)}° (le double à pleine charge), et un filet à moins de ${Math.round(BATON.assist * 57.3)}° de ton cap attire le tir : le bâton choisit où (droit, le centre ; penché, le coin ; à fond de côté, ${Math.round(BATON.large * 100)} cm à côté du poteau).`,
    `Une mise en échec échange l'élan des deux corps (masse × vitesse) ; le moins lancé tombe ${dec(PATIN.sol)} s si l'écart dépasse ${CHUTE.seuil} kg·m/s, et lâche la rondelle.`,
    `Le gardien voit la rondelle ${Math.round(GARDIEN.reaction * 1000)} ms en retard, bouge à ${kmh(GARDIEN.vMax)} km/h au plus, couvre ${dec(GARDIEN.demi * 2, 2)} m des ${dec(FILET.large, 2)} m du filet ; il gèle ${Math.round(GARDIEN.couvre * 100)} % de ses arrêts, les autres rebondissent à ${Math.round(GARDIEN.rebond * 100)} % de la vitesse.`,
  ];
}
