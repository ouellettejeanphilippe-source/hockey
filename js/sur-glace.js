/**
 * SUR GLACE — L'ÉCRAN (31 oct. 2026). JP : *faire un jeu 2D avec une physique crédible, pas refaire un jeu de
 * 30 ans* ; *go*. Le terrain de jeu : la glace, la rondelle, les bandes, un filet et son gardien, un plot à
 * frapper, et un seul patineur que tu contrôles. Pas d'équipe, pas de match : si glisser, freiner, passer dans la
 * bande et décocher se sentent justes ici, le reste se bâtit dessus.
 *
 * Tout ce qui bouge vit dans js/physique.js (des mètres, des secondes, un pas fixe) ; ici, on lit la manette, le
 * clavier ou le doigt, on dessine au canevas et on fait sonner les événements. Vue de haut, la caméra suit la
 * rondelle ; debout, la patinoire se tient à la verticale et on attaque vers le haut.
 *
 *   le bâton gauche, les flèches ou WASD   patiner (le bâton à l'envers : freiner)
 *   A, Espace                              la passe
 *   X ou RT tenu, Maj tenue                charger le tir ; lâché, il part
 *   Start, Échap, ✕                        retour au menu
 */
import { nouvelleGlace, avancer, remise, reglesDeLaGlace, lame, L, W, COIN, LIGNE_BUT, BLEUE, POINT, FILET, GARDIEN, RONDELLE } from './physique.js';
import { nouvelleGraine } from './sim.js';
import { jouerSon } from './sons.js';
import { esc } from './util.js';

const VUE = 34;          // la caméra montre à peu près ça de glace dans le sens de la longueur, m
const SUIVI = 4;         // la vitesse à laquelle elle rattrape la rondelle, par seconde
const SONS = { tir: 'tir', passe: 'passe', but: 'but', arret: 'arret', poteau: 'retour', bande: 'tap', echec: 'echec', gel: 'sifflet', remise: 'mj' };
const COULEURS = { glace: '#e8eef3', ligne: '#c8102e', bleue: '#1d4fa3', bande: '#3a3f4a', toi: '#f47b20', plot: '#8d939f', gardien: '#f2f4f7', rondelle: '#111' };

let el = null, canvas = null, cx = null, etat = null, raf = null, dernier = 0, ctxJeu = null;
let cam = { x: 0, y: 0, k: 20 };
let touche = { haut: 0, bas: 0, gauche: 0, droite: 0, passe: false, tir: false };
let doigt = null;        // le bâton du doigt : { id, x0, y0, x, y }
let boutons = { passe: false, tir: false };
let flash = { mot: '', reste: 0 };
let trace = [];
let vueEntiere = false;
let taille = { w: 1, h: 1, dpr: 1, portrait: false };

/* ---------- ouvrir, fermer ---------- */
export function ouvrirSurGlace(ctx) {
  ctxJeu = ctx;
  etat = nouvelleGlace(nouvelleGraine());
  trace = []; flash = { mot: '', reste: 0 }; vueEntiere = false;
  el = document.createElement('div');
  el.id = 'glaceModal';
  el.className = 'sg';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Sur glace');
  el.innerHTML = `
    <canvas class="sg-canvas" aria-label="La patinoire"></canvas>
    <div class="sg-haut">
      <button type="button" class="sg-btn sg-fermer" data-sg="fermer" aria-label="Retour au menu">✕</button>
      <div class="sg-compte" role="status"></div>
      <button type="button" class="sg-btn" data-sg="vue" aria-pressed="false" title="Toute la glace">⤢</button>
      <button type="button" class="sg-btn" data-sg="centre" title="La rondelle au centre">↺</button>
      <button type="button" class="sg-btn" data-sg="regles" aria-expanded="false" title="Ce que la glace fait">?</button>
    </div>
    <div class="sg-flash" aria-live="polite"></div>
    <div class="sg-bas">
      <div class="sg-vitesse"></div>
      <div class="sg-invites">${invites()}</div>
    </div>
    <div class="sg-doigt" aria-hidden="true">
      <button type="button" class="sg-rond" data-doigt="passe">Passe</button>
      <button type="button" class="sg-rond sg-rond-tir" data-doigt="tir">Tir</button>
    </div>
    <aside class="sg-regles" hidden>
      <h3>Ce que la glace fait</h3>
      <ul>${reglesDeLaGlace().map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="sg-regles-mot">Le bâton gauche, les flèches ou WASD patinent ; à l'envers, c'est le frein. A ou Espace passe. X, RT ou Maj tenue charge le tir ; lâché, il part.</p>
    </aside>`;
  document.body.appendChild(el);
  document.body.classList.add('sur-glace');
  canvas = el.querySelector('.sg-canvas');
  cx = canvas.getContext('2d');
  el.addEventListener('click', ev => {
    const b = ev.target.closest('[data-sg]');
    if (!b) return;
    const quoi = b.dataset.sg;
    if (quoi === 'fermer') fermerSurGlace();
    else if (quoi === 'centre') { remise(etat, 'but'); trace = []; jouerSon('mj'); }
    else if (quoi === 'vue') { vueEntiere = !vueEntiere; b.setAttribute('aria-pressed', String(vueEntiere)); }
    else if (quoi === 'regles') { const a = el.querySelector('.sg-regles'); a.hidden = !a.hidden; b.setAttribute('aria-expanded', String(!a.hidden)); }
  });
  brancherDoigt();
  window.addEventListener('keydown', surTouche, true);
  window.addEventListener('keyup', surTouche, true);
  window.addEventListener('resize', mesurer);
  mesurer();
  cam = { x: etat.rondelle.x, y: etat.rondelle.y, k: cam.k };
  dernier = performance.now();
  raf = requestAnimationFrame(boucle);
}

function fermerSurGlace() {
  if (!el) return;
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  window.removeEventListener('keydown', surTouche, true);
  window.removeEventListener('keyup', surTouche, true);
  window.removeEventListener('resize', mesurer);
  el.remove(); el = null; canvas = null; cx = null; etat = null;
  document.body.classList.remove('sur-glace');
  touche = { haut: 0, bas: 0, gauche: 0, droite: 0, passe: false, tir: false };
  doigt = null; boutons = { passe: false, tir: false };
  if (ctxJeu && ctxJeu.onFerme) ctxJeu.onFerme();
}

function invites() {
  return document.body.classList.contains('manette')
    ? '<span><kbd>⬤</kbd> Patiner</span><span><kbd>Ⓐ</kbd> Passe</span><span><kbd>Ⓧ</kbd> Tir (tenir)</span><span><kbd>Start</kbd> Menu</span>'
    : '<span><kbd>Flèches</kbd> Patiner</span><span><kbd>Espace</kbd> Passe</span><span><kbd>Maj</kbd> Tir (tenir)</span><span><kbd>Échap</kbd> Menu</span>';
}

/* ---------- les entrées ---------- */
const CLAVIER = { ArrowUp: 'haut', ArrowDown: 'bas', ArrowLeft: 'gauche', ArrowRight: 'droite', w: 'haut', s: 'bas', a: 'gauche', d: 'droite', ' ': 'passe', j: 'passe', Shift: 'tir', k: 'tir' };
function surTouche(ev) {
  if (ev.key === 'Escape') return;
  const k = CLAVIER[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key];
  if (!k) return;
  touche[k] = ev.type === 'keydown';
  ev.preventDefault();
}

/* Le bâton du doigt : la moitié gauche de l'écran ; là où le doigt se pose, c'est le centre. */
function brancherDoigt() {
  canvas.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse') return;
    if (doigt) return;
    doigt = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', ev => { if (doigt && ev.pointerId === doigt.id) { doigt.x = ev.clientX; doigt.y = ev.clientY; } });
  const lacher = ev => { if (doigt && ev.pointerId === doigt.id) doigt = null; };
  canvas.addEventListener('pointerup', lacher);
  canvas.addEventListener('pointercancel', lacher);
  for (const b of el.querySelectorAll('[data-doigt]')) {
    const quoi = b.dataset.doigt;
    b.addEventListener('pointerdown', ev => { boutons[quoi] = true; ev.preventDefault(); });
    const fin = () => { boutons[quoi] = false; };
    b.addEventListener('pointerup', fin);
    b.addEventListener('pointercancel', fin);
    b.addEventListener('pointerleave', fin);
  }
}

/* Un vecteur de l'écran vers la glace : debout, on attaque vers le haut. */
const versGlace = (sx, sy) => (taille.portrait ? { x: -sy, y: sx } : { x: sx, y: sy });

/* Les entrées de ton patineur, toutes sources confondues : la manette d'abord si elle pousse, sinon le doigt, sinon le clavier. */
function entrees() {
  let sx = 0, sy = 0, passe = false, tir = false;
  const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
  if (pads.length) {
    const p = pads[0];
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (Math.hypot(ax, ay) > 0.15) { sx = ax; sy = ay; }
    const on = i => !!(p.buttons[i] && p.buttons[i].pressed);
    if (on(12)) sy = -1; if (on(13)) sy = 1; if (on(14)) sx = -1; if (on(15)) sx = 1;
    passe = on(0);
    tir = on(2) || on(5) || on(7);
    if (on(9)) { fermerSurGlace(); return null; }
  }
  if (!sx && !sy && doigt) {
    const dx = (doigt.x - doigt.x0) / 48, dy = (doigt.y - doigt.y0) / 48;
    const m = Math.hypot(dx, dy);
    if (m > 0.1) { sx = dx / Math.max(1, m); sy = dy / Math.max(1, m); }
  }
  if (!sx && !sy) { sx = (touche.droite ? 1 : 0) - (touche.gauche ? 1 : 0); sy = (touche.bas ? 1 : 0) - (touche.haut ? 1 : 0); }
  const m = Math.hypot(sx, sy);
  if (m > 1) { sx /= m; sy /= m; }
  const g = versGlace(sx, sy);
  return { toi: { x: g.x, y: g.y, passe: passe || touche.passe || boutons.passe, tir: tir || touche.tir || boutons.tir } };
}

/* ---------- la boucle ---------- */
function boucle(now) {
  if (!el) return;
  const dt = Math.min(0.1, (now - dernier) / 1000);
  dernier = now;
  const e = entrees();
  if (!el) return;
  const ev = avancer(etat, e, dt);
  for (const v of ev) {
    if (SONS[v.type] && !(v.type === 'echec' && !v.fort)) jouerSon(SONS[v.type]);
    if (v.type === 'but') flash = { mot: 'BUT !', reste: 1.8 };
    else if (v.type === 'arret' && v.gele) flash = { mot: 'Gelée.', reste: 1.2 };
    else if (v.type === 'arret') flash = { mot: 'Arrêt !', reste: 0.8 };
    else if (v.type === 'poteau') flash = { mot: 'Poteau !', reste: 0.8 };
    else if (v.type === 'tir') flash = { mot: `${Math.round(v.v * 3.6)} km/h`, reste: 1 };
    else if (v.type === 'remise') trace = [];
  }
  if (flash.reste > 0) flash.reste -= dt;
  trace.push({ x: etat.rondelle.x, y: etat.rondelle.y });
  if (trace.length > 14) trace.shift();
  camera(dt);
  dessiner();
  hud();
  raf = requestAnimationFrame(boucle);
}

function mesurer() {
  if (!canvas) return;
  const r = el.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  taille = { w: r.width, h: r.height, dpr, portrait: r.height > r.width };
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}

/* La caméra suit la rondelle (ou son porteur), et ne montre jamais au-delà de la bande, plus une marge. */
function camera(dt) {
  const long = taille.portrait ? taille.h : taille.w, court = taille.portrait ? taille.w : taille.h;
  const marge = 2;
  const kEntier = Math.min(long / (L + 2 * marge), court / (W + 2 * marge));
  const k = vueEntiere ? kEntier : Math.max(kEntier, long / VUE);
  cam.k = k;
  const R = etat.rondelle;
  const f = 1 - Math.exp(-SUIVI * dt);
  cam.x += (R.x - cam.x) * f; cam.y += (R.y - cam.y) * f;
  const hx = long / (2 * k), hy = court / (2 * k);
  cam.x = hx >= L / 2 + marge ? 0 : Math.max(-L / 2 - marge + hx, Math.min(L / 2 + marge - hx, cam.x));
  cam.y = hy >= W / 2 + marge ? 0 : Math.max(-W / 2 - marge + hy, Math.min(W / 2 + marge - hy, cam.y));
}

/* ---------- le dessin ---------- */
function cheminGlace() {
  const X = L / 2, Y = W / 2;
  cx.beginPath();
  cx.moveTo(-X + COIN, -Y);
  cx.lineTo(X - COIN, -Y); cx.arcTo(X, -Y, X, -Y + COIN, COIN);
  cx.lineTo(X, Y - COIN); cx.arcTo(X, Y, X - COIN, Y, COIN);
  cx.lineTo(-X + COIN, Y); cx.arcTo(-X, Y, -X, Y - COIN, COIN);
  cx.lineTo(-X, -Y + COIN); cx.arcTo(-X, -Y, -X + COIN, -Y, COIN);
  cx.closePath();
}

function cercle(x, y, r, remplir, trait, large) {
  cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2);
  if (remplir) { cx.fillStyle = remplir; cx.fill(); }
  if (trait) { cx.strokeStyle = trait; cx.lineWidth = large || 0.05; cx.stroke(); }
}

function patinoire() {
  const X = L / 2, Y = W / 2;
  cheminGlace(); cx.fillStyle = COULEURS.glace; cx.fill();
  cx.save(); cheminGlace(); cx.clip();
  // Les lignes : la rouge au centre, les bleues, les lignes de but.
  cx.fillStyle = COULEURS.ligne; cx.fillRect(-0.15, -Y, 0.3, W);
  cx.fillStyle = COULEURS.bleue; cx.fillRect(BLEUE - 0.15, -Y, 0.3, W); cx.fillRect(-BLEUE - 0.15, -Y, 0.3, W);
  cx.fillStyle = COULEURS.ligne; cx.fillRect(LIGNE_BUT - 0.025, -Y, 0.05, W); cx.fillRect(-LIGNE_BUT - 0.025, -Y, 0.05, W);
  // Les cercles de mise en jeu et leurs points, l'enclave des gardiens.
  cercle(0, 0, POINT.r, null, COULEURS.bleue, 0.05); cercle(0, 0, 0.15, COULEURS.bleue);
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      cercle(sx * POINT.x, sy * POINT.y, POINT.r, null, COULEURS.ligne, 0.05);
      cercle(sx * POINT.x, sy * POINT.y, 0.3, COULEURS.ligne);
      cercle(sx * (BLEUE - 1.52), sy * POINT.y, 0.3, COULEURS.ligne);
    }
    cx.beginPath();
    cx.arc(sx * LIGNE_BUT, 0, FILET.enclave, sx > 0 ? Math.PI / 2 : -Math.PI / 2, sx > 0 ? Math.PI * 1.5 : Math.PI / 2);
    cx.fillStyle = 'rgba(120, 170, 220, 0.45)'; cx.fill();
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.05; cx.stroke();
  }
  cx.restore();
  // La bande.
  cheminGlace(); cx.strokeStyle = COULEURS.bande; cx.lineWidth = 0.35; cx.stroke();
  // Les filets.
  for (const s of [1, -1]) {
    const x0 = s * LIGNE_BUT, x1 = s * (LIGNE_BUT + FILET.profond), d = FILET.large / 2;
    cx.fillStyle = 'rgba(255,255,255,0.7)';
    cx.fillRect(Math.min(x0, x1), -d, FILET.profond, FILET.large);
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.08;
    cx.beginPath(); cx.moveTo(x0, -d); cx.lineTo(x1, -d); cx.lineTo(x1, d); cx.lineTo(x0, d); cx.stroke();
    cercle(x0, -d, FILET.poteau + 0.02, COULEURS.ligne); cercle(x0, d, FILET.poteau + 0.02, COULEURS.ligne);
  }
}

function patineur(s, couleur, toi) {
  const lm = lame(s);
  cx.save();
  if (s.auSol > 0) cx.globalAlpha = 0.6;
  // Le bâton, du corps à la lame.
  cx.strokeStyle = '#4a2f14'; cx.lineWidth = 0.06; cx.lineCap = 'round';
  cx.beginPath(); cx.moveTo(s.x, s.y); cx.lineTo(lm.x, lm.y); cx.stroke();
  cx.lineWidth = 0.1;
  cx.beginPath(); cx.moveTo(lm.x - Math.cos(s.cap) * 0.15, lm.y - Math.sin(s.cap) * 0.15); cx.lineTo(lm.x + Math.cos(s.cap) * 0.2, lm.y + Math.sin(s.cap) * 0.2); cx.stroke();
  // Le corps : un cercle aux couleurs du club, le casque qui dit le cap.
  cercle(s.x, s.y, s.rayon, couleur, toi ? '#fff' : 'rgba(0,0,0,0.35)', toi ? 0.08 : 0.04);
  cercle(s.x + Math.cos(s.cap) * 0.12, s.y + Math.sin(s.cap) * 0.12, 0.16, '#1a1a1a');
  if (s.charge > 0) {
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.08;
    cx.beginPath(); cx.arc(s.x, s.y, s.rayon + 0.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.charge / 0.7)); cx.stroke();
  }
  cx.restore();
}

function dessiner() {
  const { w, h, dpr, portrait } = taille;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = '#0a0b0e'; cx.fillRect(0, 0, w, h);
  cx.translate(w / 2, h / 2);
  if (portrait) cx.rotate(-Math.PI / 2);
  cx.scale(cam.k, cam.k);
  cx.translate(-cam.x, -cam.y);
  patinoire();
  // La trace de la rondelle.
  const R = etat.rondelle;
  if (trace.length > 1) {
    cx.strokeStyle = 'rgba(20,20,20,0.35)'; cx.lineWidth = 0.08; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(trace[0].x, trace[0].y); for (const p of trace) cx.lineTo(p.x, p.y); cx.stroke();
  }
  // Le gardien : un bloc large, et sa tête.
  const Gd = etat.gardien;
  cx.fillStyle = COULEURS.gardien;
  cx.fillRect(Gd.x - GARDIEN.profondeur, Gd.y - GARDIEN.demi, GARDIEN.profondeur * 2, GARDIEN.demi * 2);
  cx.strokeStyle = COULEURS.bleue; cx.lineWidth = 0.05; cx.strokeRect(Gd.x - GARDIEN.profondeur, Gd.y - GARDIEN.demi, GARDIEN.profondeur * 2, GARDIEN.demi * 2);
  cercle(Gd.x, Gd.y, 0.2, '#1a1a1a');
  for (const s of etat.patineurs) patineur(s, s.id === 'toi' ? COULEURS.toi : COULEURS.plot, s.id === 'toi');
  cercle(R.x, R.y, Math.max(RONDELLE.rayon, 3 / cam.k), COULEURS.rondelle);
  // Le bâton du doigt, en pixels d'écran.
  if (doigt) {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = el.getBoundingClientRect();
    cercle(doigt.x0 - r.left, doigt.y0 - r.top, 48, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.35)', 2);
    const dx = doigt.x - doigt.x0, dy = doigt.y - doigt.y0, m = Math.hypot(dx, dy), c = Math.min(48, m) / (m || 1);
    cercle(doigt.x0 - r.left + dx * c, doigt.y0 - r.top + dy * c, 18, 'rgba(255,255,255,0.6)');
  }
}

function hud() {
  const c = etat.compte;
  el.querySelector('.sg-compte').textContent = `Tirs ${c.tirs} · Buts ${c.buts} · Arrêts ${c.arrets}${c.poteaux ? ` · Poteaux ${c.poteaux}` : ''}`;
  const toi = etat.patineurs[0];
  el.querySelector('.sg-vitesse').textContent = `${Math.round(Math.hypot(toi.vx, toi.vy) * 3.6)} km/h${etat.dernierTir ? ` · dernier tir ${Math.round(etat.dernierTir * 3.6)} km/h` : ''}`;
  const f = el.querySelector('.sg-flash');
  const mot = flash.reste > 0 ? flash.mot : '';
  if (f.textContent !== mot) f.textContent = mot;
  const inv = el.querySelector('.sg-invites');
  const html = invites();
  if (inv.dataset.html !== html) { inv.innerHTML = html; inv.dataset.html = html; }
}
