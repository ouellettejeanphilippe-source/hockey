/**
 * LES SONS DE SUR GLACE (1er nov. 2026). JP : *bruits de foule, plus de sons, meilleurs sons ; il y a sûrement du
 * monde qui font des sons avec rien*. Tout est synthétisé avec l'API Web Audio, à partir des briques de js/sons.js
 * (le souffle, les filtres, l'enveloppe), avec ce que la recherche a rapporté (docs/decisions.md) : les recettes de
 * ZzFX et de sfxr (un clic plus un corps, un peu de hasard sur chaque coup), les mesures de vrais arénas (le poteau à
 * 3 000 Hz, la sirène Kahlenberg à 254 et 322 Hz, le sifflet qui bat), le bruit rose et brun de Kellet pour la foule.
 *
 *   la foule      un graphe vivant tout le match : le grave (brun), la rumeur (rose en passe-bande), les voix (trois
 *                 formants), l'éclat (le rose aigu quand ça crie) et les claques, le tout piloté par UNE intensité
 *                 de 0 à 1 que le match pose (la base de la soirée, la zone offensive, un tir, un but) ; des vagues
 *                 tirées au hasard, jamais un LFO ; trois boucles de longueurs qui ne se divisent pas (5,3, 7,1 et
 *                 11,3 s) pour qu'aucun motif ne revienne
 *   les voix      le « ohhh » d'un tir dangereux ou d'un poteau, les huées d'une punition : des dents de scie
 *                 graves avec un vibrato (sans lui, ça sonne machine), dans les formants d'une voyelle
 *   les coups     le tir (le frottement, le clic, le corps), la passe, la rondelle contre la bande (trois modes
 *                 inharmoniques, le bois), le poteau (la cloche), la mise en échec, la mise en jeu, le harpon
 *   l'arbitre     le sifflet (deux sinus qui battent, du souffle, du plastique), la sirène de but (deux cornes)
 *   les patins    aucun son (JP, 1er nov. : *pas le bruit de patinage*) : le crissement, le coup de patin et le frein sont partis
 *
 * Tout passe par un compresseur de sortie : la foule et un coup de bande ne saturent jamais. Le hasard d'ici ne
 * touche pas au moteur : il ne fait que varier la hauteur et le gain d'un coup à l'autre.
 */
import { contexte, souffle, filtre, enveloppe, bruit, note, sonsActifs } from './sons.js';

const al = (p = 0.08) => 1 + (Math.random() * 2 - 1) * p;   // ±p autour de 1 : chaque coup un peu différent
let maitre = null;        // { comp, gain, c }
let foule = null;         // le graphe de la foule
let voixEnCours = null;   // le « ohhh » ou les huées du moment
let tamponRose = null, tamponBrun = null, tamponClaques = null;

/* ---------- les briques de plus ---------- */
function sortie(c) {
  if (maitre && maitre.c === c) return maitre.gain;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.15;
  const gain = c.createGain(); gain.gain.value = 0.9;
  gain.connect(comp); comp.connect(c.destination);
  maitre = { comp, gain, c };
  return gain;
}
/* Le bruit rose de Kellet et le brun, des tampons de longueurs qui ne se divisent pas. */
function rose(c, secondes) {
  const n = Math.floor(c.sampleRate * secondes), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return b;
}
function brun(c, secondes) {
  const n = Math.floor(c.sampleRate * secondes), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  let o = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; o = (o + 0.02 * w) / 1.02; d[i] = o * 3.5; }
  return b;
}
/* Les claques : des claquements au hasard dans un résonateur, vingt par seconde, dix secondes. */
function claques(c) {
  const n = Math.floor(c.sampleRate * 10), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  const nb = 200;
  for (let k = 0; k < nb; k++) {
    const t0 = Math.floor(Math.random() * (n - 2000));
    const f = 775 + Math.random() * 785, bw = 140 + Math.random() * 235, g = 0.4 + Math.random() * 0.6;
    const w = 2 * Math.PI * f / c.sampleRate, r = Math.exp(-Math.PI * bw / c.sampleRate);
    let y1 = 0, y2 = 0;
    for (let i = 0; i < 1800; i++) {
      const x = i < 90 ? (Math.random() * 2 - 1) * (1 - i / 90) : 0;
      const y = x + 2 * r * Math.cos(w) * y1 - r * r * y2;
      y2 = y1; y1 = y;
      d[t0 + i] += y * g * 0.08;
    }
  }
  return b;
}
function boucle(c, tampon, decalage = Math.random()) {
  const s = c.createBufferSource();
  s.buffer = tampon; s.loop = true;
  s.start(c.currentTime, decalage * tampon.duration);
  return s;
}
function doux(c, k) {
  const ws = c.createWaveShaper(), n = 1024, courbe = new Float32Array(n), tk = Math.tanh(k);
  for (let i = 0; i < n; i++) courbe[i] = Math.tanh(k * (i / (n - 1) * 2 - 1)) / tk;
  ws.curve = courbe; ws.oversample = '2x';
  return ws;
}
/* Un sinus qui s'éteint : un mode de cloche ou de bois. */
function mode(c, t, freq, gain, dec) {
  const o = c.createOscillator(), g = enveloppe(c, t, gain, 0.001, dec);
  o.frequency.setValueAtTime(freq, t);
  o.connect(g); g.connect(sortie(c));
  o.start(t); o.stop(t + dec + 0.05);
}

/* ---------- la foule ---------- */
function demarrerFoule(c) {
  if (foule && foule.c === c) return foule;
  tamponRose = tamponRose || rose(c, 7.1); tamponBrun = tamponBrun || brun(c, 5.3); tamponClaques = tamponClaques || claques(c);
  const rose2 = rose(c, 11.3);
  const g = c.createGain(); g.gain.value = 0.05; g.connect(sortie(c));
  const couche = (src, f, gain) => { const gg = c.createGain(); gg.gain.value = gain; src.connect(f); f.connect(gg); gg.connect(g); return gg; };
  const grave = couche(boucle(c, tamponBrun), filtre(c, 'lowpass', 220), 0.12);
  const fRumeur = filtre(c, 'bandpass', 700, 0.6);
  const rumeur = couche(boucle(c, tamponRose), fRumeur, 0.2);
  const voix = [500, 1000, 1500].map((f, i) => ({ f: filtre(c, 'bandpass', f, 7), g: couche(boucle(c, tamponRose, 0.3 + i * 0.2), filtre(c, 'bandpass', f, 7), 0.15) }));
  const eclat = couche(boucle(c, rose2), filtre(c, 'highpass', 2500, 0.7), 0);
  const fClaques = filtre(c, 'bandpass', 1200, 0.8);
  const clq = couche(boucle(c, tamponClaques), fClaques, 0);
  foule = { c, g, grave, fRumeur, rumeur, voix, eclat, clq, fClaques, intensite: 0.2, cible: 0.2, bosse: 0, bosseJusqua: 0, minuterie: null };
  // LES VAGUES : pas de LFO ; toutes les 300 à 900 ms, une cible au hasard par couche, suivie en douceur.
  const vague = () => {
    if (!foule) return;
    const t = c.currentTime, i = foule.intensite;
    grave.gain.setTargetAtTime((0.05 + 0.15 * i) * al(0.25), t, 1.2);
    rumeur.gain.setTargetAtTime((0.1 + 0.35 * i) * al(0.25), t, 0.9);
    fRumeur.frequency.setTargetAtTime((500 + 900 * i) * al(0.1), t, 1.5);
    for (const v of voix) { v.g.gain.setTargetAtTime((0.08 + 0.4 * i) * al(0.3), t, 0.7); }
    eclat.gain.setTargetAtTime(Math.max(0, i - 0.5) * 0.5 * al(0.2), t, 0.6);
    clq.gain.setTargetAtTime(i > 0.55 ? (i - 0.55) * 0.9 : 0, t, 0.8);
    foule.minuterie = setTimeout(vague, 300 + Math.random() * 600);
  };
  vague();
  return foule;
}
/* L'intensité de la foule, 0 à 1 : la cible que le match pose, suivie vite en montée, lentement en descente ; une bosse passagère par-dessus. */
export function ambianceFoule(base, dt) {
  if (!sonsActifs()) return;
  const c = contexte();
  if (!c || c.state !== 'running') return;
  const F = demarrerFoule(c);
  const t = c.currentTime;
  if (t > F.bosseJusqua) F.bosse = Math.max(0, F.bosse - dt * 0.4);
  const cible = Math.min(1, base + F.bosse);
  F.intensite += (cible - F.intensite) * (1 - Math.exp(-dt / (cible > F.intensite ? 0.6 : 3.5)));
  F.g.gain.setTargetAtTime(0.05 + 0.45 * F.intensite * F.intensite, t, 0.3);
}
function bosse(quantite, secondes) {
  const c = contexte();
  if (!c) return;
  const F = demarrerFoule(c);
  F.bosse = Math.max(F.bosse, quantite); F.bosseJusqua = c.currentTime + secondes;
}
/* Les voix : des dents de scie graves qui vibrent, dans les formants d'une voyelle ; le « ohhh » et les huées. */
function voix(c, t, { n = 6, grave = 150, aigu = 250, formants = [[500, 6], [900, 5]], att = 0.25, tenue = 0.15, rel = 0.7, gain = 0.35, montee = null, etale = 0.12 }) {
  if (voixEnCours && voixEnCours.c === c) { voixEnCours.g.gain.cancelScheduledValues(t); voixEnCours.g.gain.setTargetAtTime(0.0001, t, 0.08); }
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + att); g.gain.setValueAtTime(gain, t + att + tenue); g.gain.exponentialRampToValueAtTime(0.0001, t + att + tenue + rel);
  const fs = formants.map(([f, q]) => filtre(c, 'bandpass', f, q));
  if (montee) { fs[0].frequency.setValueAtTime(montee[0], t); fs[0].frequency.linearRampToValueAtTime(montee[1], t + att); fs[0].frequency.linearRampToValueAtTime(montee[2], t + att + tenue + rel); }
  const entree = c.createGain(); entree.gain.value = 1 / Math.sqrt(n);
  for (const f of fs) { entree.connect(f); f.connect(g); }
  g.connect(sortie(c));
  const fin = t + att + tenue + rel + 0.1;
  for (let i = 0; i < n; i++) {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = grave + Math.random() * (aigu - grave);
    const lfo = c.createOscillator(); lfo.frequency.value = 4 + Math.random() * 3; const prof = c.createGain(); prof.gain.value = o.frequency.value * 0.02;
    lfo.connect(prof); prof.connect(o.frequency);
    o.connect(entree);
    const t0 = t + Math.random() * etale;
    o.start(t0); lfo.start(t0); o.stop(fin); lfo.stop(fin);
  }
  const r = souffle(c), fr = filtre(c, 'bandpass', formants[0][0], 3), gr = c.createGain(); gr.gain.value = 0.25;
  r.connect(fr); fr.connect(gr); gr.connect(g); r.start(t); r.stop(fin);
  voixEnCours = { c, g };
}

/* ---------- les coups ---------- */
const COUPS = {
  tir(c, t, { v = 25 } = {}) {
    const frappe = v > 22, k = Math.min(1.3, 0.5 + v / 40);
    if (frappe) bruit(c, t - 0.04, { gain: 0.2 * k, att: 0.005, dec: 0.04, freq: 3000, q: 2 });
    bruit(c, t, { gain: (frappe ? 0.5 : 0.3) * k * al(0.15), att: 0.001, dec: 0.025, type: 'highpass', freq: 1500 });
    note(c, t, { freq: 120 * al(), vers: 45, gain: (frappe ? 0.5 : 0.25) * k, att: 0.002, dec: 0.12 });
    bruit(c, t, { gain: 0.3 * k, att: 0.002, dec: 0.08, type: 'lowpass', freq: 300 });
  },
  passe(c, t) {
    bruit(c, t, { gain: 0.25 * al(0.15), att: 0.001, dec: 0.015, type: 'highpass', freq: 2000 });
    note(c, t, { forme: 'triangle', freq: 1800 * al(), vers: 900, gain: 0.08, att: 0.001, dec: 0.04 });
  },
  reception(c, t) { bruit(c, t, { gain: 0.15 * al(0.15), att: 0.001, dec: 0.02, type: 'lowpass', freq: 800 }); },
  bande(c, t, { v = 8 } = {}) {
    const k = Math.min(1, 0.3 + v / 20);
    const ws = doux(c, 3); ws.connect(sortie(c));
    for (const [f, dec, g] of [[180, 0.18, 0.3], [310, 0.12, 0.2], [790, 0.07, 0.1]]) {
      const o = c.createOscillator(), e = enveloppe(c, t, g * k * 0.6 * al(0.15), 0.001, dec); o.frequency.value = f * al();
      o.connect(e); e.connect(ws); o.start(t); o.stop(t + dec + 0.05);
    }
    bruit(c, t, { gain: 0.3 * k, att: 0.001, dec: 0.06, freq: 600, q: 1 });
  },
  vitre(c, t) {
    for (const [f, dec, g] of [[1200, 0.3, 0.2], [2600, 0.2, 0.12], [4100, 0.12, 0.08]]) mode(c, t, f * al(), g, dec);
    bruit(c, t, { gain: 0.3, att: 0.001, dec: 0.01, type: 'highpass', freq: 3000 });
  },
  poteau(c, t) {
    mode(c, t, 3000, 0.3, 0.5); mode(c, t, 3012, 0.3, 0.5); mode(c, t, 1000, 0.12, 0.3); mode(c, t, 1420, 0.08, 0.2);
    bruit(c, t, { gain: 0.3, att: 0.001, dec: 0.01, type: 'highpass', freq: 3000 });
  },
  echec(c, t, { fort = true, bande = false } = {}) {
    const k = fort ? 1 : 0.5;
    note(c, t, { freq: 80 * al(), vers: 30, gain: 0.6 * k, att: 0.002, dec: 0.25 });
    bruit(c, t, { gain: 0.5 * k, att: 0.002, dec: 0.2, type: 'lowpass', freq: 250 });
    if (bande) { COUPS.bande(c, t + 0.02, { v: 12 }); bruit(c, t + 0.02, { gain: 0.15, att: 0.005, dec: 0.15, freq: 2500, q: 4 }); }
  },
  sifflet(c, t, { duree = 0.35, coups = 1 } = {}) {
    for (let k = 0; k < coups; k++) {
      const t0 = t + k * (duree + 0.12);
      const ws = doux(c, 4), ph = filtre(c, 'highpass', 1200), g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.015); g.gain.setValueAtTime(0.18, t0 + duree); g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree + 0.06);
      ws.connect(ph); ph.connect(g); g.connect(sortie(c));
      for (const [f, a] of [[2080, 1], [2165, 1], [2550, 0.6]]) {
        const o = c.createOscillator(), ga = c.createGain(); ga.gain.value = a * 0.35; o.frequency.value = f;
        const lfo = c.createOscillator(); lfo.frequency.value = 6; const prof = c.createGain(); prof.gain.value = f * 0.005; lfo.connect(prof); prof.connect(o.frequency);
        o.connect(ga); ga.connect(ws); o.start(t0); lfo.start(t0); o.stop(t0 + duree + 0.1); lfo.stop(t0 + duree + 0.1);
      }
      const r = souffle(c), fr = filtre(c, 'bandpass', 2300, 6), gr = enveloppe(c, t0, 0.1, 0.015, duree + 0.05); r.connect(fr); fr.connect(gr); gr.connect(ws); r.start(t0); r.stop(t0 + duree + 0.15);
    }
  },
  sirene(c, t) {
    const lp = filtre(c, 'lowpass', 1500, 2), ws = doux(c, 3), g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.08); g.gain.setValueAtTime(0.22, t + 2.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    ws.connect(lp); lp.connect(g); g.connect(sortie(c));
    const echo = c.createDelay(0.5); echo.delayTime.value = 0.12; const retour = c.createGain(); retour.gain.value = 0.25;
    g.connect(echo); echo.connect(retour); retour.connect(echo); retour.connect(sortie(c));
    for (const f of [254, 257, 322, 319]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.85, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
      const ga = c.createGain(); ga.gain.value = 0.25; o.connect(ga); ga.connect(ws); o.start(t); o.stop(t + 2.6);
    }
  },
  miseEnJeu(c, t) {
    bruit(c, t, { gain: 0.16, att: 0.002, dec: 0.025, type: 'lowpass', freq: 600 });
    note(c, t, { freq: 200, vers: 110, gain: 0.12, att: 0.002, dec: 0.05 });
    bruit(c, t + 0.05, { gain: 0.2, att: 0.001, dec: 0.02, type: 'highpass', freq: 2200 });
    bruit(c, t + 0.11, { gain: 0.18, att: 0.001, dec: 0.02, type: 'highpass', freq: 2600 });
  },
  harpon(c, t) {
    bruit(c, t, { gain: 0.25 * al(0.15), att: 0.001, dec: 0.018, type: 'highpass', freq: 2400 });
    note(c, t, { forme: 'triangle', freq: 1500 * al(), vers: 700, gain: 0.06, att: 0.001, dec: 0.03 });
  },
  ohhh(c, t, { double = false, grave = false } = {}) {
    voix(c, t + 0.15, grave ? { grave: 120, aigu: 180, formants: [[350, 6], [700, 5]], att: 0.3, tenue: 0.2, rel: 1.2, gain: 0.3 } : { montee: [400, 600, 350] });
    if (double) voix(c, t + 0.55, { montee: [450, 650, 350], gain: 0.45, att: 0.18, rel: 0.9 });
  },
  huees(c, t) {
    voix(c, t, { n: 10, grave: 170, aigu: 260, formants: [[300, 6], [700, 5]], att: 0.4, tenue: 2.5, rel: 1.2, gain: 0.25, etale: 0.6 });
    const b = boucle(c, tamponBrun || (tamponBrun = brun(c, 5.3))), f = filtre(c, 'lowpass', 300), g = enveloppe(c, t, 0.15, 0.4, 3.5); b.connect(f); f.connect(g); g.connect(sortie(c)); b.stop(t + 4.2);
  },
  clameur(c, t) {
    const r = boucle(c, tamponRose || (tamponRose = rose(c, 7.1))), f = filtre(c, 'highpass', 2500, 0.7), g = enveloppe(c, t, 0.25, 0.3, 5); r.connect(f); f.connect(g); g.connect(sortie(c)); r.stop(t + 5.5);
    for (let k = 0; k < 4; k++) { const t0 = t + 0.2 + Math.random() * 2.5, f0 = 2000 + Math.random() * 1200; note(c, t0, { freq: f0, vers: f0 + (Math.random() - 0.5) * 600, gain: 0.05, att: 0.02, dec: 0.15 }); }
  },
};
/** Un coup : `nom` de COUPS, `delai` secondes plus tard, avec ses options. Silence si coupé. */
export function coupDeGlace(nom, delai = 0, opts = {}) {
  if (!sonsActifs() || !COUPS[nom]) return;
  try {
    const c = contexte();
    if (!c || c.state !== 'running') return;
    COUPS[nom](c, c.currentTime + Math.max(0, delai), opts);
  } catch { /* un son qui casse ne casse pas le match */ }
}
/* Ce que le match fait à la foule : une bosse d'intensité qui retombe. */
export function fouleReagit(quoi) {
  if (!sonsActifs()) return;
  try {
    if (quoi === 'tir') bosse(0.3, 2);
    else if (quoi === 'butLocaux') bosse(0.8, 7);
    else if (quoi === 'butVisiteurs') bosse(-0.1, 4);
    else if (quoi === 'echec') bosse(0.3, 2);
    else if (quoi === 'punition') bosse(0.15, 3);
  } catch { /* rien */ }
}
/** Au départ de l'écran : la foule se tait. */
export function couperLaGlace() {
  try {
    if (foule) { clearTimeout(foule.minuterie); foule.g.gain.setTargetAtTime(0.0001, foule.c.currentTime, 0.3); setTimeout(() => { try { foule.g.disconnect(); } catch { /* déjà */ } }, 1500); foule = null; }
  } catch { /* rien */ }
}
