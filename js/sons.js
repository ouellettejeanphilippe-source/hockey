/**
 * LES SONS DU PLATEAU — synthétisés, jamais téléchargés.
 *
 * JP : *je veux que la glace ressemble à une vraie glace de hockey, avec
 * effets sonores*. Le dépôt ne fait aucune requête tierce et le jeu doit
 * rester entier hors ligne : un fichier audio serait une chose de plus à
 * mettre dans la coquille de sw.js, et un fichier libre de droits de la
 * bonne longueur n'existe pas pour « une mise en échec dans la bande ».
 * Tout est donc fabriqué ici avec l'API Web Audio — un oscillateur, un
 * souffle blanc filtré, une enveloppe — en quelques lignes par son. Ça pèse
 * zéro octet de plus dans la coquille, ça ne demande aucune licence, et ça
 * sonne comme un jeu de table électronique, ce qui est exactement ce que le
 * mode bonus est.
 *
 * TROIS RÈGLES.
 *   1. Un son ne DÉCIDE rien. Il suit le verdict du moteur (le genre écrit au
 *      fil), il ne le devine pas : `js/plateau.js` lit le fil et appelle
 *      `jouerSon` avec un nom de cette liste. Un genre sans son est silencieux.
 *   2. Le navigateur refuse le son avant un geste de l'utilisateur ; le
 *      contexte se crée donc au PREMIER TOUCHER (`debloquer`), jamais au
 *      chargement — sinon la console se remplit d'avertissements, et le test
 *      de fumée exige zéro erreur.
 *   3. Tout est dans un try : un navigateur sans Web Audio (ou un Chromium
 *      sans carte de son, comme dans l'Action) joue en silence, jamais en
 *      erreur.
 *
 * `activerSons(false)` coupe tout : c'est l'option « Sons » et le bouton du
 * plateau, tous deux branchés ici par js/game.js.
 */

let ctx = null;
let actif = true;
let bruitBlanc = null;   // un tampon d'une seconde de souffle, fabriqué une fois

export const sonsActifs = () => actif;
export function activerSons(on) { actif = !!on; }

function contexte() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

/* Le premier toucher débloque le son : la règle des navigateurs. */
export function debloquer() { if (actif) contexte(); }
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', debloquer, { passive: true });
  document.addEventListener('keydown', debloquer, { passive: true });
}

/* ---------- les briques ---------- */

function souffle(c) {
  if (!bruitBlanc) {
    bruitBlanc = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = bruitBlanc.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = bruitBlanc;
  return s;
}

/* Une enveloppe : monte en `att`, descend en `dec`, sur un gain donné. */
function enveloppe(c, t, gain, att, dec) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  return g;
}

function filtre(c, type, freq, q = 1) {
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  return f;
}

/* Un souffle filtré : la brique de tout ce qui frotte, frappe ou glisse. */
function bruit(c, t, { gain = 0.3, att = 0.005, dec = 0.15, type = 'bandpass', freq = 1000, q = 1, vers = null, duree = null }) {
  const s = souffle(c), f = filtre(c, type, freq, q), g = enveloppe(c, t, gain, att, dec);
  if (vers !== null) f.frequency.exponentialRampToValueAtTime(vers, t + att + dec);
  s.connect(f); f.connect(g); g.connect(c.destination);
  s.start(t); s.stop(t + (duree ?? att + dec) + 0.05);
}

/* Une note : `forme` et fréquence, avec une glissade facultative. */
function note(c, t, { forme = 'sine', freq = 440, vers = null, gain = 0.2, att = 0.005, dec = 0.2, passeBas = null }) {
  const o = c.createOscillator(), g = enveloppe(c, t, gain, att, dec);
  o.type = forme; o.frequency.setValueAtTime(freq, t);
  if (vers !== null) o.frequency.exponentialRampToValueAtTime(vers, t + att + dec);
  if (passeBas) { const f = filtre(c, 'lowpass', passeBas); o.connect(f); f.connect(g); } else o.connect(g);
  g.connect(c.destination);
  o.start(t); o.stop(t + att + dec + 0.05);
}

/* ---------- les sons, un par événement du plateau ---------- */

const SONS = {
  /* Le dé : quatre claquements de plus en plus serrés, puis il s'arrête. */
  de(c, t) {
    [0, 0.07, 0.13, 0.18, 0.22].forEach((d, i) => bruit(c, t + d, { gain: 0.16 - i * 0.02, dec: 0.03, type: 'highpass', freq: 2500 }));
    note(c, t + 0.24, { forme: 'triangle', freq: 660, gain: 0.05, dec: 0.08 });
  },
  /* Le patin : deux coups de lame qui raclent la glace. */
  patin(c, t) {
    bruit(c, t, { gain: 0.14, att: 0.02, dec: 0.16, freq: 1400, vers: 700, q: 0.8 });
    bruit(c, t + 0.17, { gain: 0.11, att: 0.02, dec: 0.16, freq: 1200, vers: 600, q: 0.8 });
  },
  /* La passe : le claquement sec de la rondelle sur la palette. */
  passe(c, t) {
    bruit(c, t, { gain: 0.2, dec: 0.03, type: 'highpass', freq: 1800 });
    note(c, t, { forme: 'triangle', freq: 1900, vers: 900, gain: 0.08, dec: 0.05 });
  },
  /* Le tir : la lame qui claque sur la glace, et le coup sourd. */
  tir(c, t) {
    bruit(c, t, { gain: 0.35, dec: 0.05, type: 'highpass', freq: 1200 });
    note(c, t, { forme: 'sine', freq: 140, vers: 50, gain: 0.35, dec: 0.16 });
  },
  /* L'arrêt : la rondelle dans la jambière, un coup mat. */
  arret(c, t) {
    bruit(c, t, { gain: 0.3, att: 0.004, dec: 0.12, type: 'lowpass', freq: 500 });
    note(c, t, { forme: 'sine', freq: 180, vers: 90, gain: 0.15, dec: 0.1 });
  },
  /* Le retour : la rondelle qui rebondit, deux petits coups. */
  retour(c, t) {
    bruit(c, t, { gain: 0.22, dec: 0.05, type: 'bandpass', freq: 900 });
    bruit(c, t + 0.11, { gain: 0.14, dec: 0.05, type: 'bandpass', freq: 1100 });
  },
  /* Le but : la sirène de l'aréna, et la foule qui monte. */
  but(c, t) {
    for (const f of [110, 220, 330]) {
      note(c, t, { forme: 'sawtooth', freq: f, gain: 0.09, att: 0.08, dec: 1.5, passeBas: 1200 });
    }
    bruit(c, t + 0.05, { gain: 0.16, att: 0.35, dec: 1.7, type: 'bandpass', freq: 700, q: 0.4 });
  },
  /* La mise en échec : le corps dans la bande, un boum. */
  echec(c, t) {
    note(c, t, { forme: 'sine', freq: 90, vers: 35, gain: 0.5, dec: 0.28 });
    bruit(c, t, { gain: 0.3, att: 0.004, dec: 0.2, type: 'lowpass', freq: 400 });
    bruit(c, t + 0.02, { gain: 0.1, dec: 0.25, type: 'bandpass', freq: 250, q: 3 });
  },
  /* Le vol : deux bâtons qui se croisent, clac-clac. */
  vol(c, t) {
    bruit(c, t, { gain: 0.24, dec: 0.025, type: 'highpass', freq: 2200 });
    bruit(c, t + 0.08, { gain: 0.2, dec: 0.025, type: 'highpass', freq: 2600 });
  },
  /* Le geste raté : un souffle qui descend, pas plus. */
  rate(c, t) {
    note(c, t, { forme: 'sine', freq: 420, vers: 160, gain: 0.1, att: 0.01, dec: 0.2 });
  },
  /* Le revirement : un grognement bref et grave. */
  revirement(c, t) {
    note(c, t, { forme: 'square', freq: 110, vers: 80, gain: 0.07, att: 0.01, dec: 0.22, passeBas: 500 });
  },
  /* Le dégagement : la rondelle qui file le long de la bande. */
  degage(c, t) {
    bruit(c, t, { gain: 0.18, att: 0.02, dec: 0.45, type: 'bandpass', freq: 1100, vers: 500, q: 1.5 });
    bruit(c, t + 0.42, { gain: 0.12, dec: 0.03, type: 'highpass', freq: 1500 });
  },
  /* La mise au jeu : la rondelle qui tombe sur la glace. */
  mj(c, t) {
    bruit(c, t, { gain: 0.16, dec: 0.03, type: 'lowpass', freq: 600 });
    note(c, t, { forme: 'sine', freq: 220, vers: 120, gain: 0.08, dec: 0.05 });
  },
  /* Un bâton qui se pose : se placer devant, tendre le bâton, changer. */
  tap(c, t) {
    bruit(c, t, { gain: 0.14, dec: 0.03, type: 'highpass', freq: 1600 });
  },
  /* Le sifflet : une note aiguë qui tremble. */
  sifflet(c, t, long = false) {
    const o = c.createOscillator(), lfo = c.createOscillator(), prof = c.createGain();
    const g = enveloppe(c, t, 0.12, 0.02, long ? 0.9 : 0.45);
    o.type = 'square'; o.frequency.value = 2650;
    lfo.type = 'sine'; lfo.frequency.value = 9; prof.gain.value = 60;
    lfo.connect(prof); prof.connect(o.frequency);
    const f = filtre(c, 'lowpass', 3200);
    o.connect(f); f.connect(g); g.connect(c.destination);
    o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2);
  },
  /* La fin du match : le sifflet, puis la sirène. */
  fin(c, t) { SONS.sifflet(c, t, true); SONS.but(c, t + 0.5); },
  /* La fin d'une période : un sifflet, court. */
  periode(c, t) { SONS.sifflet(c, t); },
};

export const NOMS_SONS = Object.keys(SONS);

/** Joue un son de la liste, `delai` secondes plus tard. Silence si coupé. */
export function jouerSon(nom, delai = 0) {
  if (!actif || !SONS[nom]) return;
  try {
    const c = contexte();
    if (!c || c.state !== 'running') return;
    SONS[nom](c, c.currentTime + Math.max(0, delai));
  } catch { /* un son qui casse ne casse pas le match */ }
}
