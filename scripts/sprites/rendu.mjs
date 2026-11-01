/*
 * LE RENDU DES SPRITES DE SUR GLACE (1er nov. 2026 ; JP : *ya moyen d'avoir un vrai pixel art de qualité, pas cette
 * merde ?* ; *ça, c'est des sprites*, en montrant une planche des NHL classiques). Les planches dessinées lettre par
 * lettre donnaient des chibis en boîte. Ici, comme les sprites précalculés des années 90 : un joueur en volumes (un
 * squelette, des membres, un casque, un bâton), posé image par image, vu de trois quarts du dessus et rastérisé en
 * pixels, les mêmes proportions dans chaque direction et chaque pose. Rien n'est repris d'un jeu : le modèle, les
 * poses et la palette sont écrits ici.
 *
 *   node scripts/sprites/rendu.mjs                    réécrit js/sprites.js (une minute et demie)
 *   node scripts/sprites/rendu.mjs --apercu x.png      la planche en image, pour la regarder (DIRS=S,E POSES=repos,tir GARDIEN=1)
 *
 * La projection est celle de la glace du jeu : le sol vu de haut, à plat (un mètre = quatorze pixels, la lame du bâton
 * quatorze pixels devant les patins), la hauteur qui monte droit vers le haut de l'image, raccourcie de HAUTEUR_VUE.
 * Chaque pixel est échantillonné 4 × 4 fois : la matière la plus présente le prend (le bâton, mince, compte triple), et
 * sa lumière (une seule, d'en haut à gauche) choisit son ton parmi trois. Le contour sombre se pose au bord bas et
 * droit de la silhouette, l'ombre portée se trame sur la glace. Les lettres sont celles de l'atelier (apercu.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { LARGEUR, HAUTEUR, ANCRE, verifier, apercu } from './apercu.mjs';

const PX = 14;               // pixels par mètre (PIXEL de js/sur-glace.js)
const GROS = 1.3;            // le joueur grossi, comme dans les jeux de 16 bits (la glace reste à l'échelle) : la lame, à quatorze pixels, est à 14 / (PX · GROS) m du modèle
const EPAIS = 1.2;           // et trapu : les volumes épaissis
const HAUTEUR_VUE = 0.8;     // la hauteur, raccourcie par la vue de trois quarts
const PROFONDEUR = 0.72;     // et la profondeur du sol dans le sprite : sans elle, un joueur penché vers nous s'allonge comme un poteau
const SS = 4;                // échantillons par côté de pixel
const LUMIERE = norm([-0.7, -0.25, 0.65]);   // vers la lumière : en haut, à gauche, un peu vers nous
const SOLEIL = norm([-0.55, 0.45, 1]);        // l'ombre portée tombe vers la droite et vers le bas de l'écran

/* ---------- vecteurs ---------- */
function norm(v) { const n = Math.hypot(...v) || 1; return v.map(x => x / n); }
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/* Une rotation : trois axes (colonnes). */
const rotX = t => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];   // tangage : le haut penche vers l'avant (+y)
const rotZ = t => [[Math.cos(t), Math.sin(t), 0], [-Math.sin(t), Math.cos(t), 0], [0, 0, 1]];   // lacet : +x tourne vers +y
const rotY = t => [[Math.cos(t), 0, -Math.sin(t)], [0, 1, 0], [Math.sin(t), 0, Math.cos(t)]];   // roulis
const app = (R, v) => add(add(mul(R[0], v[0]), mul(R[1], v[1])), mul(R[2], v[2]));
const comp = (A, B) => B.map(c => app(A, c));   // A ∘ B
const ID = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/* Deux os (la cuisse et le tibia, le bras et l'avant-bras) : le joint du milieu, plié vers `pole`. */
function ik(a, t, l1, l2, pole) {
  let d = sub(t, a); let n = len(d);
  const u = mul(d, 1 / (n || 1));
  if (n >= (l1 + l2) * 0.995) return lerp(a, t, l1 / (l1 + l2));
  n = Math.max(n, Math.abs(l1 - l2) + 1e-3);
  const x = (l1 * l1 - l2 * l2 + n * n) / (2 * n), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const v = norm(sub(pole, mul(u, dot(pole, u))));
  return add(add(a, mul(u, x)), mul(v, h));
}

/* ---------- les volumes ---------- */
// cône arrondi d'un segment (rayons r1 → r2) ; la matière peut dépendre de t (0 en a, 1 en b)
function cone(a, b, r1, r2, mat) {
  const ba = sub(b, a), bb = dot(ba, ba) || 1e-9;
  r1 *= EPAIS; r2 *= EPAIS;
  return { d(p) { const pa = sub(p, a); const h = clamp(dot(pa, ba) / bb, 0, 1); return [len(sub(pa, mul(ba, h))) - (r1 + (r2 - r1) * h), h]; }, mat };
}
// ellipsoïde de centre c, d'axes R (colonnes), de rayons r ; la matière lit le point local
function ellipsoide(c, R, r, mat) {
  r = r.map(x => x * EPAIS);
  const m = Math.min(...r);
  return { d(p) { const q = sub(p, c); const l = [dot(q, R[0]) / r[0], dot(q, R[1]) / r[1], dot(q, R[2]) / r[2]]; return [(Math.hypot(...l) - 1) * m, l]; }, mat };
}
/* Les matières : le ton clair, moyen, sombre (les lettres de l'atelier) et si elles sont minces (le bâton, la lame du patin). */
const MAT = {
  chandail: ['j', 'J', 'd'], bande: ['T', 'T', 'd'], casque: ['h', 'H', 'H'],
  peau: ['S', 'S', 's'], pantalon: ['p', 'P', 'P'], bas: ['j', 'J', 'd'], gant: ['p', 'G', 'G'], patin: ['K', 'K', 'K'],
  lame: ['L', 'L', 'L'], baton: ['B', 'B', 'B'], ruban: ['b', 'b', 'b'], jambiere: ['Q', 'Q', 'q'], masque: ['W', 'W', 'q'],
};
const MINCES = new Set(['baton', 'ruban', 'lame']);

/* ---------- le patineur, posé ---------- */
const DEFAUT = {
  hanche: [0, 0, 0.8], tangage: 0.45, lacet: 0, roulis: 0, tete: 0,   // le bassin, l'inclinaison du torse, sa torsion
  pieds: [[-0.17, 0.02, 0.12, 0.25], [0.17, -0.02, 0.12, -0.25]],     // gauche, droit : x, y, z (la cheville), le lacet du pied
  pommeau: [-0.1, 0.32, 0.92], talon: [0.1, 0.92, 0.04], bout: [-0.08, 1.0, 0.04],   // le bâton : le pommeau, le talon de la lame, son bout
  basDeLaMain: 0.42,   // où la main du bas tient le manche, de 0 (pommeau) à 1 (talon)
  libre: null, libreD: null,   // une main qui lâche le bâton : où elle va
  gardien: false, poleGenou: null,   // le gardien : ses jambières, sa mitaine, son bloqueur, son masque ; où plient ses genoux (le papillon)
};
function modele(pose, face = 0) {
  const P = { ...DEFAUT, ...pose };
  // la lame posée sur la glace est écrite à un mètre devant : ramenée aux quatorze pixels du jeu
  if (!P.gardien && P.talon[2] < 0.1) { const k = 14 / (PX * GROS * Math.hypot(Math.cos(face), PROFONDEUR * Math.sin(face))); P.talon = [P.talon[0] * k, P.talon[1] * k, P.talon[2]]; P.bout = [P.bout[0] * k, P.bout[1] * k, P.bout[2]]; }
  const parts = [];
  let groupe = '';
  const pousser = parts.push.bind(parts);
  parts.push = p => pousser({ ...p, groupe });
  const hanche = P.hanche;
  const Rb = rotZ(P.lacet * 0.4);                      // le bassin suit un peu la torsion
  const Rt = comp(rotZ(P.lacet), comp(rotX(P.tangage), rotY(P.roulis)));
  const haut = v => add(hanche, app(Rt, v));
  // le bassin et le pantalon
  groupe = 'bassin';
  parts.push(ellipsoide(add(hanche, [0, 0, -0.03]), Rb, [0.23, 0.17, 0.18], () => 'pantalon'));
  groupe = 'torse';
  // le torse : le chandail, la bande des épaules, l'ourlet, le numéro au dos
  const centre = haut([0, 0, 0.28]);
  const plastron = P.gardien ? 1.15 : 1;
  parts.push(ellipsoide(centre, Rt, [0.22 * plastron, 0.15 * plastron, 0.27], l => {
    const z = l[2] * 0.27;
    if (z < -0.19 && z > -0.24) return 'bande';
    if (z > 0.17) return 'bande';   // l'empiècement des épaules
    return 'chandail';
  }));
  // les épaulettes
  const epG = haut([-0.2, 0, 0.47]), epD = haut([0.2, 0, 0.47]);
  for (const e of [epG, epD]) parts.push(ellipsoide(e, Rt, [0.1, 0.11, 0.09], l => (l[2] > -0.2 ? 'bande' : 'chandail')));
  groupe = 'tete';
  // la tête : le casque, la visière, le visage
  const cou = haut([0, 0.04, 0.58]);
  const Rh = comp(rotZ(P.lacet * 0.7 + P.tete), rotX(P.tangage * 0.25));
  const tete = add(cou, app(Rh, [0, 0.03, 0.11]));
  parts.push(ellipsoide(tete, Rh, [0.105, 0.12, 0.12], l => {
    if (l[1] > 0.35 && l[2] < 0.1) return P.gardien ? 'masque' : 'peau';
    return 'casque';
  }));
  // les jambes
  const pieds = P.pieds.map(([x, y, z, lacet], i) => {
    groupe = `jambe${i}`;
    const hip = add(hanche, app(Rb, [i ? 0.1 : -0.1, 0, -0.06]));
    const cheville = [x, y, z];
    const avant = [Math.sin(lacet) * (i ? -1 : 1), Math.cos(lacet), 0];
    const pole = P.poleGenou ? [P.poleGenou[0] * (i ? 1 : -1), P.poleGenou[1], P.poleGenou[2]] : add(mul(avant, 1), [i ? 0.25 : -0.25, 0, 0.2]);
    const genou = ik(hip, cheville, 0.43, 0.42, pole);
    parts.push(cone(hip, genou, 0.12, 0.085, (_, t) => (t < 0.68 ? 'pantalon' : 'bas')));
    if (P.gardien) {   // la jambière : du dessus du genou à la bottine, large et plate devant
      const haut = lerp(genou, hip, 0.3), bas = add(cheville, [0, 0, -0.04]);
      parts.push(cone(add(haut, mul(avant, 0.04)), add(bas, mul(avant, 0.06)), 0.13, 0.11, (_, t) => (t > 0.45 && t < 0.55 ? 'bande' : 'jambiere')));
    } else parts.push(cone(genou, cheville, 0.08, 0.06, (_, t) => (t > 0.25 && t < 0.4 ? 'bande' : 'bas')));
    // le patin : la bottine et sa lame
    const Rp = rotZ(-lacet * (i ? -1 : 1));
    const fx = app(Rp, [0, 1, 0]);
    parts.push(ellipsoide(add(cheville, add(mul(fx, 0.03), [0, 0, -0.05])), comp(Rp, ID), [0.055, 0.14, 0.07], () => 'patin'));
    parts.push(cone(add(cheville, add(mul(fx, -0.13), [0, 0, -0.11])), add(cheville, add(mul(fx, 0.15), [0, 0, -0.11])), 0.014, 0.014, () => 'lame'));
    return cheville;
  });
  // le bâton : le manche, la lame au ruban
  groupe = 'baton';
  const { pommeau, talon, bout } = P;
  if (P.gardien) {   // la palette large du bâton de gardien
    parts.push(cone(pommeau, talon, 0.024, 0.03, () => 'baton'));
    parts.push(cone(talon, bout, 0.032, 0.03, () => 'ruban'));
  } else {
    parts.push(cone(pommeau, talon, 0.024, 0.022, () => 'baton'));
    parts.push(cone(talon, bout, 0.03, 0.03, () => 'ruban'));
  }
  // les bras : la main du haut au pommeau, celle du bas plus bas sur le manche
  const mainG = P.libre || add(pommeau, mul(norm(sub(talon, pommeau)), 0.06));
  const mainD = P.libreD || lerp(pommeau, talon, P.basDeLaMain);
  for (const [ep, main, cote] of [[epG, mainG, -1], [epD, mainD, 1]]) {
    groupe = `bras${cote}`;
    const coude = ik(ep, main, 0.29, 0.27, add(app(Rt, [cote * 0.8, -0.3, -0.4]), [0, 0, -0.2]));
    parts.push(cone(ep, coude, 0.07, 0.062, () => 'chandail'));
    parts.push(cone(coude, main, 0.062, 0.055, () => 'chandail'));
    if (!P.gardien) parts.push(ellipsoide(main, Rt, [0.07, 0.07, 0.07], () => 'gant'));
    else if (cote < 0) parts.push(ellipsoide(main, Rt, [0.14, 0.08, 0.14], () => 'gant'));        // la mitaine
    else parts.push(ellipsoide(add(main, app(Rt, [0.05, 0, 0])), Rt, [0.06, 0.15, 0.17], () => 'jambiere'));   // le bloqueur
  }
  return { parts, pieds };
}

/* ---------- les poses ---------- */
const miroirPose = p => {   // la même pose de l'autre pied
  const q = { ...p };
  if (p.pieds) q.pieds = [p.pieds[1], p.pieds[0]].map(([x, y, z, l]) => [-x, y, z, l]);
  if (p.hanche) q.hanche = [-p.hanche[0], p.hanche[1], p.hanche[2]];
  if (p.roulis) q.roulis = -p.roulis;
  return q;
};
const patin1 = { hanche: [-0.06, 0.04, 0.72], tangage: 0.62, lacet: 0.12, roulis: -0.08, pieds: [[-0.08, 0.12, 0.12, 0.15], [0.46, -0.34, 0.14, -0.75]], pommeau: [-0.12, 0.42, 0.86], talon: [0.06, 0.95, 0.04], bout: [-0.12, 1.0, 0.04] };
const patin2 = { hanche: [-0.03, 0.04, 0.8], tangage: 0.55, lacet: 0.04, pieds: [[-0.12, 0.06, 0.12, 0.1], [0.12, -0.12, 0.26, -0.2]], pommeau: [-0.1, 0.4, 0.9], talon: [0.1, 0.94, 0.04], bout: [-0.08, 1.0, 0.04] };
// couché à plat : les bras ouverts, les jambes écartées ; le bâton lâché sur la glace à côté (ses points sont déjà ceux de la glace)
const CHUTE = { hanche: [0, 0, 0.82], tangage: 0.05, pieds: [[-0.3, 0.05, 0.12, 0.3], [0.25, 0.1, 0.16, -0.3]], libre: [-0.5, 0.2, 1.3], libreD: [0.5, 0.2, 1.3], pommeau: [0.42, -0.35, 0.03], talon: [0.62, 0.62, 0.03], bout: [0.5, 0.72, 0.03] };
const POSES = {
  repos: {},
  patin1, patin2, patin3: miroirPose(patin1), patin4: miroirPose(patin2),
  // le lancer frappé qui se charge : le bâton haut derrière l'épaule droite, les genoux pliés, le regard devant
  charge: { hanche: [0, -0.02, 0.72], tangage: 0.35, lacet: -0.55, tete: 0.5, pieds: [[-0.3, 0.12, 0.12, 0.5], [0.3, -0.1, 0.12, -0.3]], pommeau: [0.0, 0.25, 0.98], talon: [0.5, -0.35, 1.55], bout: [0.62, -0.28, 1.66], basDeLaMain: 0.3 },
  // le fouetté : le bâton loin devant, en l'air, la jambe droite tendue derrière
  tir: { hanche: [-0.05, 0.08, 0.72], tangage: 0.65, lacet: 0.45, tete: -0.3, pieds: [[-0.15, 0.25, 0.12, 0.2], [0.32, -0.42, 0.18, -0.6]], pommeau: [-0.32, 0.28, 0.95], talon: [-0.02, 1.12, 0.55], bout: [-0.16, 1.2, 0.6], basDeLaMain: 0.38 },
  // la passe : le balayage court, le bâton sur la glace devant, les bras tendus
  passe: { hanche: [0, 0.03, 0.76], tangage: 0.55, lacet: 0.3, tete: -0.2, pieds: [[-0.22, 0.08, 0.12, 0.3], [0.22, -0.06, 0.12, -0.3]], pommeau: [-0.2, 0.42, 0.82], talon: [-0.12, 1.02, 0.04], bout: [-0.3, 0.98, 0.04], basDeLaMain: 0.45 },
  // la mise en échec : l'épaule gauche devant, le tronc couché, les bras repliés, le bâton bas
  echec: { hanche: [0, 0.05, 0.7], tangage: 0.95, lacet: 0.6, roulis: 0.1, tete: -0.5, pieds: [[-0.2, 0.25, 0.12, 0.4], [0.32, -0.35, 0.12, -0.5]], pommeau: [0.12, 0.45, 0.62], talon: [0.32, 0.95, 0.04], bout: [0.18, 1.02, 0.04], basDeLaMain: 0.3 },
};

/* Le gardien : accroupi en garde, la mitaine ouverte à gauche, le bâton à plat devant les jambières, tenu au bloqueur. */
const GARDE = { gardien: true, hanche: [0, 0, 0.62], tangage: 0.3, pieds: [[-0.34, 0.02, 0.12, 0.35], [0.34, 0.02, 0.12, -0.35]], poleGenou: [-0.5, 1, 0], libre: [-0.42, 0.42, 0.78], pommeau: [0.3, 0.32, 0.6], talon: [0.08, 0.62, 0.03], bout: [-0.18, 0.64, 0.03], basDeLaMain: 0.05 };
const POSES_GARDIEN = {
  garde: GARDE,
  // le papillon : les genoux sur la glace, les jambières à plat de chaque côté
  papillon: { ...GARDE, hanche: [0, 0.05, 0.42], tangage: 0.15, pieds: [[-0.62, -0.18, 0.09, 1.2], [0.62, -0.18, 0.09, -1.2]], poleGenou: [-0.2, 1, -0.8], libre: [-0.5, 0.35, 0.72], pommeau: [0.32, 0.36, 0.5], talon: [0.1, 0.62, 0.03], bout: [-0.18, 0.64, 0.03] },
  // la mitaine levée, haute à gauche
  mitaine: { ...GARDE, roulis: -0.15, libre: [-0.55, 0.3, 1.35] },
  // le bloqueur sorti à droite, le bâton qui suit
  bloqueur: { ...GARDE, roulis: 0.15, pommeau: [0.62, 0.25, 0.85], talon: [0.48, 0.62, 0.03], bout: [0.22, 0.66, 0.03] },
};

/* ---------- le rendu ---------- */
const SEUILS = [0.84, 0.5];   // la lumière qui fait le ton clair, et sous laquelle on passe au sombre
const transposee = M => [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
function scene(pose, face, couche) {
  const { parts } = modele(pose, face);
  // le corps vers le monde : `face` est l'angle à l'écran (0 = droite, sens horaire), le monde a y vers le HAUT de l'écran
  const f = [Math.cos(face), -Math.sin(face), 0], r = [f[1], -f[0], 0];
  const versCorps = transposee([r, f, [0, 0, 1]]);
  // couché : le corps basculé vers l'avant, à plat, reculé pour que l'ancre tombe au milieu ; le bâton, lui, est déjà posé sur la glace
  const bascule = transposee(rotX(Math.PI / 2 - 0.1)), recul = [0, -0.72, 0.15];
  return parts.map(p => ({
    ...p,
    d(q) {
      let loc = app(versCorps, q);
      if (couche && p.groupe !== 'baton') loc = app(bascule, sub(loc, recul));
      return p.d(loc);
    },
  }));
}
function sdf(parts, q) {
  let best = 1e9, bp = null, info = null;
  for (const p of parts) { const [d, i] = p.d(q); if (d < best) { best = d; bp = p; info = i; } }
  return [best, bp, info];
}
function normale(parts, q) {
  const e = 0.004;
  const f = v => sdf(parts, v)[0];
  return norm([f(add(q, [e, 0, 0])) - f(sub(q, [e, 0, 0])), f(add(q, [0, e, 0])) - f(sub(q, [0, e, 0])), f(add(q, [0, 0, e])) - f(sub(q, [0, 0, e]))]);
}
const RAYON = norm([0, HAUTEUR_VUE, -PROFONDEUR]);
function lancer(parts, o, dir, maxT) {
  let t = 0;
  for (let i = 0; i < 120 && t < maxT; i++) {
    const q = add(o, mul(dir, t));
    const [d, p, info] = sdf(parts, q);
    if (d < 0.002) return { q, p, info, t };
    t += Math.max(d * 0.8, 0.003);
  }
  return null;
}
function image(pose, face, couche = false) {
  const parts = scene(pose, face, couche);
  const cases = [];
  for (let py = 0; py < HAUTEUR; py++) for (let px = 0; px < LARGEUR; px++) {
    const echant = [];
    let ombre = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const X = (px + (sx + 0.5) / SS - (ANCRE[0] + 0.5)) / (PX * GROS);
      const Q = ((ANCRE[1] + 0.5) - (py + (sy + 0.5) / SS)) / (PX * GROS);   // PROFONDEUR · y + HAUTEUR_VUE · z
      const z0 = 2.3;
      const o = [X, (Q - HAUTEUR_VUE * z0) / PROFONDEUR, z0];
      const tGlace = z0 / -RAYON[2];
      const h = lancer(parts, o, RAYON, tGlace);
      if (h) {
        const mat = h.p.mat(h.info, h.info);
        const n = normale(parts, h.q);
        const lum = 0.2 + 0.8 * Math.max(0, dot(n, LUMIERE));
        echant.push({ mat, lum, t: h.t, groupe: h.p.groupe });
      } else {
        // la glace : à l'ombre du joueur ?
        const g = [X, Q / PROFONDEUR, 0];
        if (lancer(parts, add(g, mul(SOLEIL, 0.01)), SOLEIL, 2.5)) ombre++;
      }
    }
    cases.push({ echant, ombre });
  }
  // la matière de chaque pixel
  const lettres = [], prof = [];
  for (let i = 0; i < cases.length; i++) {
    const { echant, ombre } = cases[i];
    const compte = {};
    for (const e of echant) compte[e.mat] = (compte[e.mat] || 0) + (MINCES.has(e.mat) ? 3 : 1);
    let mat = null, max = 0;
    for (const [m, c] of Object.entries(compte)) if (c > max) { max = c; mat = m; }
    const plein = echant.length >= SS * SS * 0.45 || (mat && MINCES.has(mat) && echant.filter(e => e.mat === mat).length >= 3);
    if (plein) {
      const es = echant.filter(e => e.mat === mat);
      const lum = es.reduce((s, e) => s + e.lum, 0) / es.length;
      const ton = lum > SEUILS[0] ? 0 : lum > SEUILS[1] ? 1 : 2;
      const gc = {}; for (const e of es) gc[e.groupe] = (gc[e.groupe] || 0) + 1;
      lettres.push({ mat, ton, l: MAT[mat][ton], groupe: Object.entries(gc).sort((a, b) => b[1] - a[1])[0][0] });
      prof.push(es.reduce((s, e) => s + e.t, 0) / es.length);
    } else {
      const x = i % LARGEUR, y = Math.floor(i / LARGEUR);
      lettres.push(ombre >= SS * SS * 0.5 && (x + y) % 2 === 0 ? { l: 'o' } : null);
      prof.push(Infinity);
    }
  }
  // le contour : au bord bas et droit de la silhouette, et entre deux plans éloignés ; jamais sur le bâton
  const corps = i => lettres[i] && lettres[i].mat && !MINCES.has(lettres[i].mat);
  const vide = i => !lettres[i] || !lettres[i].mat;
  const sortie = lettres.map(c => (c ? c.l : '.'));
  for (let y = 0; y < HAUTEUR; y++) for (let x = 0; x < LARGEUR; x++) {
    const i = y * LARGEUR + x;
    if (!corps(i)) continue;
    const v = (dx, dy) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= LARGEUR || yy >= HAUTEUR ? true : vide(yy * LARGEUR + xx); };
    // un voisin d'une autre partie du corps, plus près de nous : ce pixel, derrière, se fonce (le trait qui sépare la tête du torse, le bras du chandail)
    const loin = (dx, dy) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= LARGEUR || yy >= HAUTEUR) return false; const j = yy * LARGEUR + xx; return corps(j) && lettres[j].groupe !== lettres[i].groupe && prof[j] < prof[i] - 0.04; };
    if (v(1, 0) || v(0, 1) || v(-1, 0) || v(0, -1)) sortie[i] = 'k';
    else if (loin(0, -1) || loin(-1, 0) || loin(1, 0) || loin(0, 1)) sortie[i] = lettres[i].groupe === 'tete' || [0, -1, 1].some(d => { const j = (y - 1) * LARGEUR + x + d; return y > 0 && lettres[j] && lettres[j].groupe === 'tete'; }) ? 'k' : MAT[lettres[i].mat][2];
  }
  const lignes = [];
  for (let y = 0; y < HAUTEUR; y++) lignes.push(sortie.slice(y * LARGEUR, (y + 1) * LARGEUR).join(''));
  return lignes;
}

/* Les huit directions de l'écran, dans l'ordre de js/sur-glace.js (0 = vers la droite, puis dans le sens horaire). */
/* Les directions de l'écran, dans l'ordre de js/sur-glace.js (0 = vers la droite, puis dans le sens horaire) : huit pour
   le patineur, toutes rendues (le bâton reste dans la même main : pas de miroir), quatre pour le gardien. */
const HUIT = ['E', 'SE', 'S', 'SO', 'O', 'NO', 'N', 'NE'];
const QUATRE = ['E', 'S', 'O', 'N'];
const angleDe = dir => HUIT.indexOf(dir) * Math.PI / 4;
function planche({ directions = HUIT, poses = [...Object.keys(POSES), 'chute'] } = {}) {
  return Object.fromEntries(directions.map(dir => [dir, Object.fromEntries(poses.map(p => [p, p === 'chute' ? image(CHUTE, angleDe(dir), true) : image(POSES[p], angleDe(dir))]))]));
}
function plancheGardien({ directions = QUATRE, poses = Object.keys(POSES_GARDIEN) } = {}) {
  return Object.fromEntries(directions.map(dir => [dir, Object.fromEntries(poses.map(p => [p, image(POSES_GARDIEN[p], angleDe(dir))]))]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const ici = path.dirname(new URL(import.meta.url).pathname);
  const [, , mode, sortieApercu] = process.argv;
  const liste = v => (process.env[v] ? process.env[v].split(',') : undefined);
  if (mode === '--apercu') {   // node scripts/sprites/rendu.mjs --apercu <png> ; DIRS=S,E POSES=repos,tir GARDIEN=1 pour en voir moins
    const P = process.env.GARDIEN ? plancheGardien({ directions: liste('DIRS'), poses: liste('POSES') }) : planche({ directions: liste('DIRS'), poses: liste('POSES') });
    apercu(P, sortieApercu, Number(process.env.ECHELLE || 5));
    console.log(sortieApercu);
  } else {
    const patineurs = planche(), gardiens = plancheGardien();
    const erreurs = [...verifier(patineurs), ...verifier(gardiens)];
    if (erreurs.length) { console.error(erreurs.join('\n')); process.exit(1); }
    const bloc = obj => JSON.stringify(obj, null, 0).replace(/\],"/g, '],\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, '\n}');
    const cible = mode || path.join(ici, '..', '..', 'js', 'sprites.js');
    fs.writeFileSync(cible, `/**
 * LES SPRITES DE SUR GLACE (1er nov. 2026 ; JP : *ya moyen d'avoir un vrai pixel art de qualité ?* ; *ça, c'est des
 * sprites*). Écrit par scripts/sprites/rendu.mjs, qui rastérise un joueur en volumes posé image par image : ne pas
 * éditer à la main. Chaque image fait ${LARGEUR} colonnes sur ${HAUTEUR} lignes, les patins à l'ancre (${ANCRE[0]}, ${ANCRE[1]}), la lame du bâton
 * quatorze pixels devant ; une lettre par matière, teinte aux couleurs du club par js/sur-glace.js : k contour · J j d
 * chandail · T bande · W masque · S s peau · H h casque · P p pantalon · G gants · K patin · L lame · B manche · b ruban
 * · Q q jambières · o l'ombre portée, tramée ; « . » vide. Le patineur en huit directions (${HUIT.join(', ')}), le gardien en
 * quatre (${QUATRE.join(', ')}), toutes rendues.
 */
export const LARGEUR = ${LARGEUR}, HAUTEUR = ${HAUTEUR}, ANCRE = [${ANCRE[0]}, ${ANCRE[1]}];
export const PATINEURS = ${bloc(patineurs)};
export const GARDIENS = ${bloc(gardiens)};
`);
    console.log(`${cible} : patineur ${Object.keys(patineurs).length} × ${Object.keys(patineurs.E).length}, gardien ${Object.keys(gardiens).length} × ${Object.keys(gardiens.E).length}`);
  }
}
