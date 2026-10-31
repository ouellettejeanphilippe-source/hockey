/**
 * SUR GLACE — L'ÉCRAN (31 oct. 2026). JP : *faire un jeu 2D avec une physique crédible, pas refaire un jeu de
 * 30 ans* ; *go* ; puis *avoir toutes les mécaniques de hockey*. Deux vrais clubs, n'importe quelle époque, un match
 * joué à la manette ; ou l'entraînement, le terrain de jeu d'un seul patineur. Tout ce qui bouge vit dans
 * js/physique.js (des mètres, des secondes, un pas fixe) et les neuf autres dans js/glace-ia.js ; ici, on lit la
 * manette, le clavier ou le doigt, on dessine au canevas, on fait sonner les événements et on tient le tableau.
 * Vue de haut, la caméra suit la rondelle ; debout, la patinoire se tient à la verticale.
 *
 *   le bâton gauche, les flèches ou WASD   patiner (le bâton à l'envers : freiner)
 *   A, Espace                              la passe ; sans la rondelle, changer de joueur ; à la mise en jeu, la chute
 *   X ou RT tenu, Maj tenue                charger le tir ; lâché, il part ; sans la rondelle, le harpon
 *   B ou RB, Ctrl                          l'élan d'une mise en échec
 *   Start, Échap, ✕                        retour au menu
 */
import { nouvelleGlace, nouveauMatch, avancer, remise, reglesDeLaGlace, lame, parametresDuPatineur, parametresDuGardien, surGlace, L, W, COIN, LIGNE_BUT, BLEUE, POINT, FILET, BATON, GARDIEN, RONDELLE } from './physique.js';
import { decisionIA } from './glace-ia.js';
import { nouvelleGraine, entierDeGraine, autoRoster, copieDeJoueur, SLOTS } from './sim.js';
import { axes20, cote20 } from './niveaux.js';
import { getTraits } from './traits.js';
import { nomCourt } from './recit.js';
import { jouerSon } from './sons.js';
import { esc, estD } from './util.js';

const VUE = 20;          // la caméra montre ça de glace EN TRAVERS, m (JP, 31 oct., sur une capture : *s't'un bon ratio ça* — vingt mètres de large, quatorze patineurs entre les bleues)
const SUIVI = 6;         // la vitesse à laquelle elle rattrape la rondelle, par seconde
const SONS = { tir: 'tir', passe: 'passe', but: 'but', arret: 'arret', poteau: 'retour', bande: 'tap', echec: 'echec', gel: 'sifflet', remise: 'mj', horsjeu: 'sifflet', degagement: 'sifflet', punition: 'sifflet', periode: 'periode', fin: 'fin', harpon: 'vol', mej: 'de' };
const COULEURS = { glace: '#e8eef3', ligne: '#c8102e', bleue: '#1d4fa3', bande: '#3a3f4a', toi: '#f47b20', plot: '#8d939f', gardien: '#f2f4f7', rondelle: '#111' };
const CLE = 'cap82_glace';
/*
 * LES VISAGES (JP : *c'est poche les formes, fait un sprite, ou rond avec face d'un joueur*). Un patineur est un
 * jeton rond aux couleurs de son chandail, la vraie face d'un joueur dedans — les visages recadrés d'img/mugs, les
 * mêmes que les cartes. À l'entraînement, une distribution de vedettes ; la graine de la glace choisit la tienne.
 */
const VEDETTES = [8478402, 8471675, 8447400, 8448782, 8471214, 8448624];   // McDavid, Crosby, Gretzky, Lemieux, Ovechkin, Lafleur
const PLOT = 8459455, GARDIEN_VISAGE = 8451033;                             // Pronger ; Roy
const images = new Map();
function visage(id) {
  if (!id) return null;
  let im = images.get(id);
  if (!im) {
    im = new Image();
    im.onerror = () => { if (!im.src.endsWith('silhouette.webp')) im.src = 'img/mugs/silhouette.webp'; };
    // L'adresse que le jeu donne à ce visage (locale, recadrée sur l'appareil, ou la silhouette) : jamais une requête pour rien.
    const html = ctxJeu && ctxJeu.mug ? ctxJeu.mug({ id }) : '';
    const m = html.match(/src="([^"]+)"/);
    im.src = m ? m[1] : `img/mugs/${id}.webp`;
    images.set(id, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}

let el = null, canvas = null, cx = null, etat = null, raf = null, dernier = 0, ctxJeu = null;
let cam = { x: 0, y: 0, k: 20 };
let touche = { haut: 0, bas: 0, gauche: 0, droite: 0, passe: false, tir: false, echec: false };
let doigt = null;        // le bâton du doigt : { id, x0, y0, x, y }
let boutons = { passe: false, tir: false, echec: false };
let flash = { mot: '', reste: 0 };
let trace = [];
let vueEntiere = false;
let taille = { w: 1, h: 1, dpr: 1, portrait: false };
let tonVisage = VEDETTES[0];
let choix = null;        // l'affiche : { A: { saison, club }, B: {…}, periode, horsjeu, degagement }
let couleurs = { A: { bg: COULEURS.toi, ink: '#fff' }, B: { bg: COULEURS.plot, ink: '#fff' } };
let noms = { A: 'Toi', B: 'Eux' };
let enfin = false;
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { return null; } };
const ecrire = v => { try { localStorage.setItem(CLE, JSON.stringify(v)); } catch { /* rien à retenir */ } };

/* ---------- ouvrir, fermer ---------- */
export function ouvrirSurGlace(ctx) {
  ctxJeu = ctx;
  el = document.createElement('div');
  el.id = 'glaceModal';
  el.className = 'sg';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Sur glace');
  document.body.appendChild(el);
  document.body.classList.add('sur-glace');
  const memo = lire();
  const valide = x => x && ctx.saisons.includes(x.saison) && typeof x.club === 'string';
  choix = { A: valide(memo && memo.A) ? memo.A : null, B: valide(memo && memo.B) ? memo.B : null, periode: (memo && memo.periode) || 180, horsjeu: !(memo && memo.horsjeu === false), degagement: !(memo && memo.degagement === false) };
  accueil();
}

function fermerSurGlace() {
  if (!el) return;
  arreterLaBoucle();
  el.remove(); el = null;
  document.body.classList.remove('sur-glace');
  if (ctxJeu && ctxJeu.onFerme) ctxJeu.onFerme();
}
function arreterLaBoucle() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  window.removeEventListener('keydown', surTouche, true);
  window.removeEventListener('keyup', surTouche, true);
  window.removeEventListener('resize', mesurer);
  canvas = null; cx = null; etat = null;
  touche = { haut: 0, bas: 0, gauche: 0, droite: 0, passe: false, tir: false, echec: false };
  doigt = null; boutons = { passe: false, tir: false, echec: false };
}

/* ---------- l'accueil : l'affiche ---------- */
const CLUBS = new Map();
async function clubsDe(saison) {
  if (CLUBS.has(saison)) return CLUBS.get(saison);
  const e = await ctxJeu.shard(saison);
  const codes = Object.entries(e.byTeam)
    .filter(([, pool]) => pool.filter(p => p.p === 'F').length >= 9 && pool.filter(estD).length >= 4 && pool.filter(p => p.p === 'G').length >= 1)
    .map(([t]) => t).sort((a, b) => ctxJeu.nom(a).localeCompare(ctxJeu.nom(b), 'fr'));
  CLUBS.set(saison, codes);
  return codes;
}
async function tirer(cote) {
  const autreC = choix[cote === 'A' ? 'B' : 'A'];
  for (let k = 0; k < 8; k++) {
    const saison = ctxJeu.saisons[Math.floor(Math.random() * ctxJeu.saisons.length)];
    const codes = await clubsDe(saison);
    const club = codes[Math.floor(Math.random() * codes.length)];
    if (club && !(autreC && autreC.saison === saison && autreC.club === club)) { choix[cote] = { saison, club }; return; }
  }
}
async function accueil() {
  if (!el) return;
  if (!choix.A) await tirer('A');
  if (!choix.B) await tirer('B');
  if (!el) return;
  const cote = async k => {
    const c = choix[k];
    const codes = await clubsDe(c.saison);
    const b = ctxJeu.band(c.club);
    return `<section class="sg-cote" data-cote="${k}">
      <div class="sg-cote-t">${k === 'A' ? 'Toi' : 'Eux'}</div>
      <div class="sg-bandeau" style="--eq-bg:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">${ctxJeu.logo(c.club, 40)}<b>${esc(ctxJeu.nom(c.club))}</b><small>${esc(c.saison)}</small></div>
      <div class="sg-choix">
        <select class="opt-select" data-saison="${k}" aria-label="La saison">${ctxJeu.saisons.slice().reverse().map(x => `<option value="${x}"${x === c.saison ? ' selected' : ''}>${x}</option>`).join('')}</select>
        <select class="opt-select" data-club="${k}" aria-label="Le club">${codes.map(t => `<option value="${t}"${t === c.club ? ' selected' : ''}>${esc(ctxJeu.nom(t))}</option>`).join('')}</select>
        <button type="button" class="btn small" data-sg="hasard" data-cote="${k}">🎲</button>
      </div>
    </section>`;
  };
  el.innerHTML = `<div class="sg-accueil">
    <header class="sg-tete">
      <div><h2 class="sg-titre">Sur glace</h2><p class="sg-sous">Deux vrais clubs, un match à la manette : la physique, les règles, tout. Rien ne compte pour ta partie.</p></div>
      <button type="button" class="close-btn sg-fermer" data-sg="fermer" aria-label="Retour au menu">✕</button>
    </header>
    <div class="sg-affiche">${await cote('A')}<div class="sg-vs" aria-hidden="true">vs</div>${await cote('B')}</div>
    <div class="sg-options">
      <label>Périodes <select class="opt-select" data-periode>${[60, 120, 180, 300].map(s => `<option value="${s}"${s === choix.periode ? ' selected' : ''}>${s / 60} min</option>`).join('')}</select></label>
      <label><input type="checkbox" data-regle="horsjeu"${choix.horsjeu ? ' checked' : ''}> Hors-jeu</label>
      <label><input type="checkbox" data-regle="degagement"${choix.degagement ? ' checked' : ''}> Dégagement refusé</label>
    </div>
    <div class="sg-actions">
      <button type="button" class="btn go" data-sg="match">▶ Jouer le match</button>
      <button type="button" class="btn" data-sg="entrainement">Entraînement <small>un patineur, une rondelle, un filet</small></button>
      <button type="button" class="btn" data-sg="regles-accueil">Ce que la glace fait</button>
    </div>
    <aside class="sg-regles sg-regles-accueil" hidden><ul>${reglesDeLaGlace().map(r => `<li>${esc(r)}</li>`).join('')}</ul></aside>
  </div>`;
  el.querySelectorAll('[data-sg]').forEach(b => {
    b.onclick = async () => {
      const q = b.dataset.sg;
      if (q === 'fermer') fermerSurGlace();
      else if (q === 'hasard') { await tirer(b.dataset.cote); ecrire(choix); accueil(); }
      else if (q === 'match') { ecrire(choix); await commencerLeMatch(); }
      else if (q === 'entrainement') commencerLEntrainement();
      else if (q === 'regles-accueil') { const a = el.querySelector('.sg-regles-accueil'); a.hidden = !a.hidden; }
    };
  });
  el.querySelectorAll('[data-saison]').forEach(s => { s.onchange = async () => { const k = s.dataset.saison; const codes = await clubsDe(s.value); choix[k] = { saison: s.value, club: codes.includes(choix[k].club) ? choix[k].club : codes[0] }; ecrire(choix); accueil(); }; });
  el.querySelectorAll('[data-club]').forEach(s => { s.onchange = () => { choix[s.dataset.club].club = s.value; ecrire(choix); accueil(); }; });
  const per = el.querySelector('[data-periode]');
  if (per) per.onchange = () => { choix.periode = Number(per.value); ecrire(choix); };
  el.querySelectorAll('[data-regle]').forEach(c => { c.onchange = () => { choix[c.dataset.regle] = c.checked; ecrire(choix); }; });
}

/* ---------- un club de vrais joueurs ---------- */
/*
 * L'alignement comme la ligue bâtit ses adversaires (`autoRoster`, sur des copies) : trois trios, deux paires, le
 * partant. Les cotes sur 20 de chacun (js/niveaux.js) deviennent ses paramètres physiques (js/physique.js).
 */
async function club(cote) {
  const { saison, club: code } = choix[cote];
  const e = await ctxJeu.shard(saison);
  const pool = (e.byTeam[code] || []).map(copieDeJoueur);
  const tous = e.players || Object.values(e.byTeam).flat();
  const roster = autoRoster(pool);
  const patineurs = [];
  for (const s of SLOTS) {
    const p = roster[s.i];
    if (!p || s.scratch || s.group === 'G') continue;
    if ((s.group === 'F' && s.unit > 2) || (s.group === 'D' && s.unit > 1)) continue;
    const ax = axes20(p, tous) || {};
    const traits = getTraits(p) || [];
    patineurs.push({
      id: p.id, nom: nomCourt(p.n), visage: p.id, poste: s.group === 'D' ? 'D' : s.role, ligne: s.unit,
      p: parametresDuPatineur({ cote: cote20(p, tous) || 8, tir: ax.tir || 10, jeu: ax.jeu || 10, defense: ax.defense || 10, robustesse: ax.robustesse || 10, poidsLb: p.wgt || null, vitesse: traits.some(t => t === 'VITESSE' || (t && t.key === 'VITESSE')) }),
    });
  }
  const g = roster[SLOTS.find(s => s.group === 'G' && s.unit === 0).i] || pool.find(p => p.p === 'G');
  const axg = g ? (axes20(g, tous) || {}) : {};
  return { nom: ctxJeu.nom(code), tag: code, patineurs, gardien: g ? { nom: nomCourt(g.n), visage: g.id, p: parametresDuGardien({ arrets: axg.arrets || 10 }) } : { nom: 'le gardien', p: parametresDuGardien() } };
}

async function commencerLeMatch() {
  const A = await club('A'), B = await club('B');
  if (!el) return;
  couleurs = { A: ctxJeu.band(choix.A.club), B: ctxJeu.band(choix.B.club) };
  noms = { A: A.nom, B: B.nom };
  const e = nouveauMatch({ graine: nouvelleGraine(), A, B, periode: choix.periode, humain: 'A', ia: decisionIA, regles: { horsjeu: choix.horsjeu, degagement: choix.degagement } });
  for (const s of e.patineurs) visage(s.visage);
  for (const g of e.gardiens) visage(g.visage);
  lancer(e);
}
function commencerLEntrainement() {
  const e = nouvelleGlace(nouvelleGraine());
  tonVisage = VEDETTES[entierDeGraine(e.graine) % VEDETTES.length];
  e.patineurs[0].visage = tonVisage; e.patineurs[1].visage = PLOT; e.gardiens[0].visage = GARDIEN_VISAGE;
  couleurs = { A: { bg: COULEURS.toi, ink: '#fff' }, B: { bg: COULEURS.plot, ink: '#fff' } };
  noms = { A: 'Toi', B: 'Le plot' };
  for (const id of [tonVisage, PLOT, GARDIEN_VISAGE]) visage(id);
  lancer(e);
}

/* ---------- la glace ---------- */
function lancer(e) {
  etat = e;
  trace = []; flash = { mot: '', reste: 0 }; vueEntiere = false; enfin = false;
  el.innerHTML = `
    <canvas class="sg-canvas" aria-label="La patinoire"></canvas>
    <div class="sg-haut">
      <button type="button" class="sg-btn sg-fermer" data-sg="fermer" aria-label="Retour au menu">✕</button>
      <div class="sg-tableau" role="status"></div>
      <button type="button" class="sg-btn" data-sg="vue" aria-pressed="false" title="Toute la glace">⤢</button>
      ${etat.match ? '' : '<button type="button" class="sg-btn" data-sg="centre" title="La rondelle au centre">↺</button>'}
      <button type="button" class="sg-btn" data-sg="regles" aria-expanded="false" title="Ce que la glace fait">?</button>
    </div>
    <div class="sg-flash" aria-live="polite"></div>
    <div class="sg-puissance" hidden><div class="sg-puissance-plein"></div></div>
    <div class="sg-bas">
      <div class="sg-vitesse"></div>
      <div class="sg-invites"></div>
    </div>
    <div class="sg-doigt" aria-hidden="true">
      <button type="button" class="sg-rond sg-rond-echec" data-doigt="echec">Échec</button>
      <button type="button" class="sg-rond" data-doigt="passe">Passe</button>
      <button type="button" class="sg-rond sg-rond-tir" data-doigt="tir">Tir</button>
    </div>
    <aside class="sg-regles" hidden>
      <h3>Ce que la glace fait</h3>
      <ul>${reglesDeLaGlace().map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="sg-regles-mot">Le bâton gauche, les flèches ou WASD patinent ; à l'envers, c'est le frein. A ou Espace passe, change de joueur sans la rondelle, et prend la mise en jeu à la chute. X, RT ou Maj tenue charge le tir (le bâton choisit le coin) ; sans la rondelle, c'est le harpon. B, RB ou Ctrl lance une mise en échec.</p>
    </aside>
    <div class="sg-fin" hidden></div>`;
  canvas = el.querySelector('.sg-canvas');
  cx = canvas.getContext('2d');
  el.querySelector('.sg-haut').addEventListener('click', ev => {
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

function invites() {
  const porte = etat && etat.rondelle.porteur && etat.rondelle.porteur === etat.controle;
  const m = document.body.classList.contains('manette');
  const k = (pad, clav) => `<kbd>${m ? pad : clav}</kbd>`;
  return `<span>${k('⬤', 'Flèches')} Patiner</span><span>${k('Ⓐ', 'Espace')} ${porte ? 'Passe' : etat && etat.mej ? 'Mise en jeu' : 'Changer'}</span><span>${k('Ⓧ', 'Maj')} ${porte ? 'Tir (tenir)' : 'Harpon'}</span><span>${k('Ⓑ', 'Ctrl')} Échec</span><span>${k('Start', 'Échap')} Menu</span>`;
}

/* ---------- les entrées ---------- */
const CLAVIER = { ArrowUp: 'haut', ArrowDown: 'bas', ArrowLeft: 'gauche', ArrowRight: 'droite', w: 'haut', s: 'bas', a: 'gauche', d: 'droite', ' ': 'passe', j: 'passe', Shift: 'tir', k: 'tir', Control: 'echec', l: 'echec' };
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

/* Un vecteur de l'écran vers la glace : debout, on attaque vers le haut en première période. */
const versGlace = (sx, sy) => (taille.portrait ? { x: -sy, y: sx } : { x: sx, y: sy });

/* Les entrées de ton patineur, toutes sources confondues : la manette d'abord si elle pousse, sinon le doigt, sinon le clavier. */
function entrees() {
  let sx = 0, sy = 0, passe = false, tir = false, echec = false;
  const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
  if (pads.length) {
    const p = pads[0];
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (Math.hypot(ax, ay) > 0.15) { sx = ax; sy = ay; }
    const on = i => !!(p.buttons[i] && p.buttons[i].pressed);
    if (on(12)) sy = -1; if (on(13)) sy = 1; if (on(14)) sx = -1; if (on(15)) sx = 1;
    passe = on(0);
    tir = on(2) || on(7);
    echec = on(1) || on(5);
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
  const e = { x: g.x, y: g.y, passe: passe || touche.passe || boutons.passe, tir: tir || touche.tir || boutons.tir, echec: echec || touche.echec || boutons.echec };
  if (!etat.controle) return {};
  return { [etat.controle]: e };
}

/* ---------- la boucle ---------- */
function boucle(now) {
  if (!el || !etat) return;
  const dt = Math.min(0.1, (now - dernier) / 1000);
  dernier = now;
  const e = entrees();
  if (!el || !etat) return;
  const ev = avancer(etat, e, dt);
  for (const v of ev) {
    if (SONS[v.type] && !(v.type === 'echec' && !v.fort)) jouerSon(SONS[v.type]);
    if (v.type === 'but') flash = { mot: etat.match ? `BUT ! ${noms[v.equipe]}` : 'BUT !', reste: 2 };
    else if (v.type === 'arret' && v.gele) flash = { mot: 'Gelée.', reste: 1.2 };
    else if (v.type === 'arret') flash = { mot: 'Arrêt !', reste: 0.8 };
    else if (v.type === 'poteau') flash = { mot: 'Poteau !', reste: 0.8 };
    else if (v.type === 'horsjeu') flash = { mot: 'Hors-jeu', reste: 1.2 };
    else if (v.type === 'degagement') flash = { mot: 'Dégagement refusé', reste: 1.2 };
    else if (v.type === 'punition') flash = { mot: `${nomDe(v.qui)} · ${v.genre}, 2 min${v.attente ? ' (à retardement)' : ''}`, reste: 2.2 };
    else if (v.type === 'liberation') flash = { mot: `${nomDe(v.qui)} revient`, reste: 1.2 };
    else if (v.type === 'periode') flash = { mot: etat.match.prolongation ? 'Prolongation, 3 contre 3' : `Fin de la ${v.periode}${v.periode === 1 ? 're' : 'e'} période`, reste: 2.5 };
    else if (v.type === 'fusillade') flash = { mot: 'Tirs de barrage', reste: 2 };
    else if (v.type === 'ronde') flash = { mot: v.but ? `Compté, ${noms[v.equipe]}` : `Raté, ${noms[v.equipe]}`, reste: 1.5 };
    else if (v.type === 'mej') flash = { mot: `Mise en jeu gagnée, ${noms[v.equipe]}`, reste: 0.9 };
    else if (v.type === 'tir' && v.qui === etat.controle) flash = { mot: `${Math.round(v.v * 3.6)} km/h${v.uneTemps ? ' · sur réception' : ''}`, reste: 1 };
    else if (v.type === 'remise') trace = [];
    else if (v.type === 'fin') finDuMatch();
  }
  if (flash.reste > 0) flash.reste -= dt;
  trace.push({ x: etat.rondelle.x, y: etat.rondelle.y });
  if (trace.length > 14) trace.shift();
  camera(dt);
  dessiner();
  hud();
  raf = requestAnimationFrame(boucle);
}
const nomDe = id => { const s = etat.patineurs.find(p => p.id === id); return s ? s.nom : ''; };

function mesurer() {
  if (!canvas) return;
  const r = el.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  taille = { w: r.width, h: r.height, dpr, portrait: r.height > r.width };
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}

/* La caméra suit la rondelle, et ne montre jamais au-delà de la bande, plus une marge. */
function camera(dt) {
  const long = taille.portrait ? taille.h : taille.w, court = taille.portrait ? taille.w : taille.h;
  const marge = 2;
  const kEntier = Math.min(long / (L + 2 * marge), court / (W + 2 * marge));
  const k = vueEntiere ? kEntier : Math.max(kEntier, court / VUE);
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
  const Y = W / 2;
  cheminGlace(); cx.fillStyle = COULEURS.glace; cx.fill();
  cx.save(); cheminGlace(); cx.clip();
  cx.fillStyle = COULEURS.ligne; cx.fillRect(-0.15, -Y, 0.3, W);
  cx.fillStyle = COULEURS.bleue; cx.fillRect(BLEUE - 0.15, -Y, 0.3, W); cx.fillRect(-BLEUE - 0.15, -Y, 0.3, W);
  cx.fillStyle = COULEURS.ligne; cx.fillRect(LIGNE_BUT - 0.025, -Y, 0.05, W); cx.fillRect(-LIGNE_BUT - 0.025, -Y, 0.05, W);
  cercle(0, 0, POINT.r, null, COULEURS.bleue, 0.05); cercle(0, 0, 0.15, COULEURS.bleue);
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      cercle(sx * POINT.x, sy * POINT.y, POINT.r, null, COULEURS.ligne, 0.05);
      cercle(sx * POINT.x, sy * POINT.y, 0.3, COULEURS.ligne);
      cercle(sx * POINT.neutre, sy * POINT.y, 0.3, COULEURS.ligne);
    }
    cx.beginPath();
    cx.arc(sx * LIGNE_BUT, 0, FILET.enclave, sx > 0 ? Math.PI / 2 : -Math.PI / 2, sx > 0 ? Math.PI * 1.5 : Math.PI / 2);
    cx.fillStyle = 'rgba(120, 170, 220, 0.45)'; cx.fill();
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.05; cx.stroke();
  }
  cx.restore();
  cheminGlace(); cx.strokeStyle = COULEURS.bande; cx.lineWidth = 0.35; cx.stroke();
  for (const s of [1, -1]) {
    const x0 = s * LIGNE_BUT, x1 = s * (LIGNE_BUT + FILET.profond), d = FILET.large / 2;
    cx.fillStyle = 'rgba(255,255,255,0.7)';
    cx.fillRect(Math.min(x0, x1), -d, FILET.profond, FILET.large);
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.08;
    cx.beginPath(); cx.moveTo(x0, -d); cx.lineTo(x1, -d); cx.lineTo(x1, d); cx.lineTo(x0, d); cx.stroke();
    cercle(x0, -d, FILET.poteau + 0.02, COULEURS.ligne); cercle(x0, d, FILET.poteau + 0.02, COULEURS.ligne);
  }
  // Les bancs et les cachots, hors de la bande.
  cx.fillStyle = 'rgba(255,255,255,0.08)';
  cx.fillRect(-14, Y + 0.4, 12, 1.6); cx.fillRect(2, Y + 0.4, 12, 1.6);
  cx.fillRect(-5, -Y - 2, 4, 1.6); cx.fillRect(1, -Y - 2, 4, 1.6);
}

/* Un jeton : l'ombre, l'anneau du chandail, la face dedans, et l'épaule qui dit le cap. */
function jeton(x, y, r, couleur, id, cap, fort) {
  cx.fillStyle = 'rgba(0,0,0,0.22)';
  cx.beginPath(); cx.ellipse(x + 0.08, y + 0.12, r * 1.02, r * 0.9, 0, 0, Math.PI * 2); cx.fill();
  cercle(x, y, r, couleur, fort ? '#fff' : 'rgba(0,0,0,0.4)', fort ? 0.07 : 0.04);
  cx.strokeStyle = 'rgba(0,0,0,0.3)'; cx.lineWidth = r * 0.3;
  cx.beginPath(); cx.arc(x, y, r * 0.84, cap + Math.PI * 0.6, cap + Math.PI * 1.4); cx.stroke();
  const im = visage(id), rf = r * 0.72;
  cx.save();
  cx.beginPath(); cx.arc(x, y, rf, 0, Math.PI * 2); cx.clip();
  if (im) cx.drawImage(im, x - rf, y - rf, rf * 2, rf * 2);
  else { cx.fillStyle = '#d8c3a5'; cx.fillRect(x - rf, y - rf, rf * 2, rf * 2); }
  cx.restore();
  cx.strokeStyle = 'rgba(255,255,255,0.85)'; cx.lineWidth = 0.04;
  cx.beginPath(); cx.arc(x, y, rf, 0, Math.PI * 2); cx.stroke();
}

function patineur(s) {
  const lm = lame(s);
  const toi = s.id === etat.controle;
  cx.save();
  if (s.auSol > 0) cx.globalAlpha = 0.6;
  // Le bâton, de l'épaule à la lame ; allongé pendant le harpon.
  const portee = s.harpon > 0 ? 1.8 : 1;
  cx.strokeStyle = '#4a2f14'; cx.lineWidth = 0.07; cx.lineCap = 'round';
  cx.beginPath(); cx.moveTo(s.x + Math.cos(s.cap + 0.6) * s.rayon * 0.7, s.y + Math.sin(s.cap + 0.6) * s.rayon * 0.7);
  cx.lineTo(s.x + (lm.x - s.x) * portee, s.y + (lm.y - s.y) * portee); cx.stroke();
  cx.lineWidth = 0.12;
  const bx = s.x + (lm.x - s.x) * portee, by = s.y + (lm.y - s.y) * portee;
  cx.beginPath(); cx.moveTo(bx - Math.cos(s.cap) * 0.15, by - Math.sin(s.cap) * 0.15); cx.lineTo(bx + Math.cos(s.cap) * 0.22, by + Math.sin(s.cap) * 0.22); cx.stroke();
  jeton(s.x, s.y, s.rayon, couleurs[s.equipe].bg, s.visage, s.cap, toi);
  if (toi) { cx.strokeStyle = '#fff'; cx.lineWidth = 0.08; cx.setLineDash([0.25, 0.18]); cx.beginPath(); cx.arc(s.x, s.y, s.rayon + 0.3, 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]); }
  if (s.charge > 0) {
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.08;
    cx.beginPath(); cx.arc(s.x, s.y, s.rayon + 0.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.charge / BATON.charge)); cx.stroke();
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
  const R = etat.rondelle;
  if (trace.length > 1) {
    cx.strokeStyle = 'rgba(20,20,20,0.35)'; cx.lineWidth = 0.08; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(trace[0].x, trace[0].y); for (const p of trace) cx.lineTo(p.x, p.y); cx.stroke();
  }
  // Les gardiens : un bloc large aux couleurs du club, et leur face tournée vers la rondelle.
  for (const Gd of etat.gardiens) {
    cx.fillStyle = COULEURS.gardien;
    cx.fillRect(Gd.x - GARDIEN.profondeur, Gd.y - Gd.p.demi, GARDIEN.profondeur * 2, Gd.p.demi * 2);
    cx.strokeStyle = couleurs[Gd.equipe].bg; cx.lineWidth = 0.08; cx.strokeRect(Gd.x - GARDIEN.profondeur, Gd.y - Gd.p.demi, GARDIEN.profondeur * 2, Gd.p.demi * 2);
    jeton(Gd.x, Gd.y, 0.42, couleurs[Gd.equipe].bg, Gd.visage, Math.atan2(R.y - Gd.y, R.x - Gd.x), false);
  }
  for (const s of etat.patineurs) if (s.surGlace || s.boxe) patineur(s);
  cercle(R.x, R.y, Math.max(RONDELLE.rayon, 3 / cam.k), COULEURS.rondelle);
  // Le radar : toute la glace, en petit, dans un coin.
  if (!vueEntiere) radar();
  if (doigt) {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = el.getBoundingClientRect();
    cercle(doigt.x0 - r.left, doigt.y0 - r.top, 48, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.35)', 2);
    const dx = doigt.x - doigt.x0, dy = doigt.y - doigt.y0, m = Math.hypot(dx, dy), c = Math.min(48, m) / (m || 1);
    cercle(doigt.x0 - r.left + dx * c, doigt.y0 - r.top + dy * c, 18, 'rgba(255,255,255,0.6)');
  }
}
function radar() {
  const { w, h, dpr, portrait } = taille;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const larg = portrait ? 56 : 120, haut = portrait ? 132 : 51;
  const x0 = w - larg - 10, y0 = h - haut - (portrait ? 96 : 60);
  cx.fillStyle = 'rgba(10,11,14,0.75)'; cx.fillRect(x0 - 3, y0 - 3, larg + 6, haut + 6);
  cx.fillStyle = 'rgba(232,238,243,0.9)'; cx.fillRect(x0, y0, larg, haut);
  const k = (portrait ? haut : larg) / L;
  const pt = (x, y) => (portrait ? [x0 + larg / 2 + y * k, y0 + haut / 2 - x * k] : [x0 + larg / 2 + x * k, y0 + haut / 2 + y * k]);
  cx.fillStyle = COULEURS.ligne;
  const [cx1, cy1] = pt(0, -W / 2), [cx2, cy2] = pt(0, W / 2);
  cx.fillRect(Math.min(cx1, cx2) - 0.5, Math.min(cy1, cy2), Math.abs(cx2 - cx1) + 1, Math.abs(cy2 - cy1) + 1);
  for (const s of etat.patineurs) {
    if (!s.surGlace) continue;
    const [px, py] = pt(s.x, s.y);
    cx.fillStyle = couleurs[s.equipe].bg; cx.beginPath(); cx.arc(px, py, s.id === etat.controle ? 3.2 : 2.2, 0, Math.PI * 2); cx.fill();
    if (s.id === etat.controle) { cx.strokeStyle = '#fff'; cx.lineWidth = 1; cx.stroke(); }
  }
  const [rx, ry] = pt(etat.rondelle.x, etat.rondelle.y);
  cx.fillStyle = '#000'; cx.beginPath(); cx.arc(rx, ry, 1.8, 0, Math.PI * 2); cx.fill();
}

/* ---------- le tableau, la fin ---------- */
const horloge = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.ceil(Math.max(0, s) % 60)).padStart(2, '0')}`;
function hud() {
  const M = etat.match;
  const T = el.querySelector('.sg-tableau');
  if (M) {
    const per = M.fusillade ? 'TB' : M.prolongation ? 'Prol.' : `P${M.periode}`;
    const punis = M.penalites.map(p => `<span class="sg-puni" style="--eq:${couleurs[p.equipe].bg}">${esc(nomDe(p.id))} ${horloge(p.reste)}</span>`).join('');
    const html = `<span class="sg-club" style="--eq:${couleurs.A.bg};--eq-ink:${couleurs.A.ink}">${esc(etat.equipes.A.tag)}</span><b>${M.pointage.A}</b>
      <span class="sg-temps">${M.fusillade ? `Ronde ${M.fusillade.ronde}` : horloge(M.reste)}<small>${per} · tirs ${M.tirs.A}–${M.tirs.B}</small></span>
      <b>${M.pointage.B}</b><span class="sg-club" style="--eq:${couleurs.B.bg};--eq-ink:${couleurs.B.ink}">${esc(etat.equipes.B.tag)}</span>${punis}`;
    if (T.dataset.html !== html) { T.innerHTML = html; T.dataset.html = html; }
  } else {
    const c = etat.compte;
    T.textContent = `Tirs ${c.tirs} · Buts ${c.buts} · Arrêts ${c.arrets}${c.poteaux ? ` · Poteaux ${c.poteaux}` : ''}`;
  }
  const toi = etat.patineurs.find(p => p.id === etat.controle);
  const V = el.querySelector('.sg-vitesse');
  V.textContent = toi ? `${esc(toi.nom)} · ${Math.round(Math.hypot(toi.vx, toi.vy) * 3.6)} km/h${etat.dernierTir ? ` · dernier tir ${Math.round(etat.dernierTir * 3.6)} km/h` : ''}${M && toi.jambes < 60 ? ` · jambes ${Math.round(toi.jambes)}` : ''}` : '';
  const barre = el.querySelector('.sg-puissance');
  const charge = toi ? Math.min(1, toi.charge / BATON.charge) : 0;
  barre.hidden = !(toi && toi.charge > 0 && etat.rondelle.porteur === toi.id);
  barre.firstElementChild.style.width = `${Math.round(charge * 100)}%`;
  const f = el.querySelector('.sg-flash');
  const mot = flash.reste > 0 ? flash.mot : '';
  if (f.textContent !== mot) f.textContent = mot;
  const inv = el.querySelector('.sg-invites');
  const html = invites();
  if (inv.dataset.html !== html) { inv.innerHTML = html; inv.dataset.html = html; }
  const dg = el.querySelector('.sg-doigt');
  const porte = etat.rondelle.porteur && etat.rondelle.porteur === etat.controle;
  dg.querySelector('[data-doigt="passe"]').textContent = porte ? 'Passe' : etat.mej ? 'Mise' : 'Changer';
  dg.querySelector('[data-doigt="tir"]').textContent = porte ? 'Tir' : 'Harpon';
}
function finDuMatch() {
  if (enfin || !etat.match) return;
  enfin = true;
  const M = etat.match;
  const F = el.querySelector('.sg-fin');
  const ligne = (mot, a, b) => `<tr><td>${a}</td><th>${mot}</th><td>${b}</td></tr>`;
  const buts = M.journal.map(j => `<li><span style="--eq:${couleurs[j.equipe].bg}">${esc(etat.equipes[j.equipe].tag)}</span> ${esc(j.qui ? nomDe(j.qui) : 'but')} · ${j.fusillade ? 'tirs de barrage' : `${j.periode > 3 ? 'prol.' : `P${j.periode}`} ${horloge(j.reste)}`}</li>`).join('');
  F.innerHTML = `<div class="sg-fin-carte">
    <h2>${esc(noms[M.vainqueur])} l'emporte</h2>
    <div class="sg-fin-score"><span style="--eq:${couleurs.A.bg};--eq-ink:${couleurs.A.ink}">${esc(etat.equipes.A.tag)}</span><b>${M.pointage.A} – ${M.pointage.B}</b><span style="--eq:${couleurs.B.bg};--eq-ink:${couleurs.B.ink}">${esc(etat.equipes.B.tag)}</span></div>
    <table class="sg-fin-stats"><tbody>${ligne('Tirs', M.tirs.A, M.tirs.B)}${ligne('Mises en échec', M.echecs.A, M.echecs.B)}${ligne('Mises en jeu', M.mej.A, M.mej.B)}${ligne('Minutes de punition', M.pim.A, M.pim.B)}</tbody></table>
    ${buts ? `<ul class="sg-fin-buts">${buts}</ul>` : ''}
    <div class="sg-fin-actions"><button type="button" class="btn go" data-fin="rejouer">Rejouer</button><button type="button" class="btn" data-fin="accueil">Deux autres clubs</button><button type="button" class="btn" data-fin="menu">Menu</button></div>
  </div>`;
  F.hidden = false;
  F.querySelectorAll('[data-fin]').forEach(b => {
    b.onclick = async () => {
      const q = b.dataset.fin;
      if (q === 'menu') { fermerSurGlace(); return; }
      arreterLaBoucle();
      if (q === 'rejouer') await commencerLeMatch(); else accueil();
    };
  });
}
