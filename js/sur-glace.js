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
const VUE_LONG = 24;     // sur un écran large, debout quand même (JP : *jeu vertical*) : ça de glace dans la hauteur, m
const RETRO = 0.5;       // le rendu en gros pixels (JP : *feel plus old school*) : une image sur deux, agrandie sans lissage
const SUIVI = 6;         // la vitesse à laquelle elle rattrape la rondelle, par seconde
const SONS = { tir: 'tir', passe: 'passe', but: 'but', arret: 'arret', poteau: 'retour', bande: 'tap', echec: 'echec', gel: 'sifflet', remise: 'mj', horsjeu: 'sifflet', degagement: 'sifflet', punition: 'sifflet', periode: 'periode', fin: 'fin', harpon: 'vol', mej: 'de' };
const COULEURS = {
  glace: '#dfe9f1', ligne: '#d0021b', bleue: '#1546b0', bande: '#2b2f3a', enclave: '#9fc3e6', maille: '#f7f7f7', noir: '#0a0b0e',
  toi: '#f47b20', plot: '#8d939f', blanc: '#f4f4f4', encreBlanc: '#111', contour: '#2a2d35', ombre: 'rgba(0,0,0,0.25)', peau: '#d8c3a5',
  baton: '#4a2f14', lame: '#3a3f4a', jambiere: '#f2f4f7', rondelle: '#111', trace: 'rgba(20,20,20,0.35)',
  lumiere: '#ff2a2a', lampe: '#5a1414', banc: 'rgba(255,255,255,0.05)',
  radarFond: 'rgba(10,11,14,0.75)', radarGlace: 'rgba(232,238,243,0.9)', doigt: 'rgba(255,255,255,0.08)', doigtTrait: 'rgba(255,255,255,0.35)', doigtPlein: 'rgba(255,255,255,0.6)',
};
/* Les chandails : les locaux (B, « eux ») en blanc aux épaules du club, les visiteurs (A, toi) en couleur. */
const chandails = (bandA, bandB) => ({
  A: { bg: bandA.bg, ink: bandA.ink, epaule: bandA.stripe || bandA.ink },
  B: { bg: COULEURS.blanc, ink: COULEURS.encreBlanc, epaule: bandB.bg, club: bandB.bg },
});
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
let taille = { w: 1, h: 1, dpr: 1, large: false };
let tonVisage = VEDETTES[0];
let choix = null;        // l'affiche : { A: { saison, club }, B: {…}, periode, horsjeu, degagement }
let couleurs = chandails({ bg: COULEURS.toi, ink: COULEURS.blanc, stripe: COULEURS.encreBlanc }, { bg: COULEURS.plot, ink: COULEURS.blanc });
let anims = [];          // les animations en cours : { type, t0, dur, … }
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
  couleurs = chandails(ctxJeu.band(choix.A.club), ctxJeu.band(choix.B.club));
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
  couleurs = chandails({ bg: COULEURS.toi, ink: COULEURS.blanc, stripe: COULEURS.encreBlanc }, { bg: COULEURS.plot, ink: COULEURS.blanc });
  noms = { A: 'Toi', B: 'Le plot' };
  for (const id of [tonVisage, PLOT, GARDIEN_VISAGE]) visage(id);
  lancer(e);
}

/* ---------- la glace ---------- */
function lancer(e) {
  etat = e;
  trace = []; flash = { mot: '', reste: 0 }; vueEntiere = false; enfin = false; anims = [];
  el.innerHTML = `
    <canvas class="sg-canvas" aria-label="La patinoire"></canvas>
    <div class="sg-crt" aria-hidden="true"></div>
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

/* Un vecteur de l'écran vers la glace : la glace est debout, on attaque vers le haut en première période. */
const versGlace = (sx, sy) => ({ x: -sy, y: sx });

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
    animer(v, now);
    if (v.type === 'but') flash = { mot: etat.match ? `BUT ! ${noms[v.equipe]}` : 'BUT !', reste: 2 };
    else if (v.type === 'arret' && v.gele) flash = { mot: 'Gelée.', reste: 1.2 };
    else if (v.type === 'arret') flash = { mot: 'Arrêt !', reste: 0.8 };
    else if (v.type === 'poteau') flash = { mot: 'Poteau !', reste: 0.8 };
    else if (v.type === 'horsjeu') flash = { mot: 'Hors-jeu', reste: 1.2 };
    else if (v.type === 'degagement') flash = { mot: 'Dégagement refusé', reste: 1.2 };
    else if (v.type === 'punition') flash = { mot: `${nomDe(v.qui)} · 2 min${v.attente ? ' à retardement' : ''}`, reste: 2.2 };
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
  for (const s of etat.patineurs) { if (!s.anim) s.anim = { dist: 0 }; s.anim.dist += Math.hypot(s.vx, s.vy) * dt; }
  camera(dt);
  dessiner(now);
  hud();
  raf = requestAnimationFrame(boucle);
}
const nomDe = id => { const s = etat.patineurs.find(p => p.id === id); return s ? s.nom : ''; };
/* Un événement du moteur devient une animation : le fouetté du tir, la poussée de la passe, l'impact, le papillon, la lumière. */
function animer(v, now) {
  const s = v.qui ? etat.patineurs.find(p => p.id === v.qui) : null;
  if (v.type === 'tir' && s) (s.anim || (s.anim = { dist: 0 })).tir = now;
  else if (v.type === 'passe' && s) (s.anim || (s.anim = { dist: 0 })).passe = now;
  else if (v.type === 'echec' && v.fort && s) {
    const o = etat.patineurs.find(p => p.id === v.sur);
    anims.push({ type: 'impact', x: o ? (s.x + o.x) / 2 : s.x, y: o ? (s.y + o.y) / 2 : s.y, t0: now, dur: 260 });
  } else if (v.type === 'arret' || v.type === 'gel') {
    const Gd = etat.gardiens.find(g => g.equipe === v.equipe) || etat.gardiens[0];
    if (Gd) Gd.anim = now;
  } else if (v.type === 'but') {
    const cote = v.cote || (etat.match ? etat.equipes[v.equipe].attaque : 1);
    anims.push({ type: 'lumiere', cote, t0: now, dur: 2500 });
    anims.push({ type: 'flash', t0: now, dur: 350 });
  }
}

function mesurer() {
  if (!canvas) return;
  const r = el.getBoundingClientRect();
  // OLD SCHOOL (JP : *feel plus old school*) : on dessine en gros pixels — une image sur deux, agrandie sans lissage —
  // sous des lignes de balayage (CSS .sg-crt). Le canevas est toujours DEBOUT (JP : *jeu vertical*), comme à la console.
  const dpr = RETRO;
  taille = { w: r.width, h: r.height, dpr, large: r.width > r.height };
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}

/* La caméra suit la rondelle, et ne montre jamais au-delà de la bande, plus une marge. La glace est debout : le long, c'est la hauteur. */
function camera(dt) {
  const long = taille.h, court = taille.w;
  const marge = 2;
  const kEntier = Math.min(long / (L + 2 * marge), court / (W + 2 * marge));
  // Debout sur un téléphone, vingt mètres en travers ; sur un écran large, vingt-quatre mètres de long.
  const k = vueEntiere ? kEntier : Math.max(kEntier, taille.large ? long / VUE_LONG : court / VUE);
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
  cx.fillStyle = COULEURS.ligne; cx.fillRect(LIGNE_BUT - 0.03, -Y, 0.06, W); cx.fillRect(-LIGNE_BUT - 0.03, -Y, 0.06, W);
  cercle(0, 0, POINT.r, null, COULEURS.bleue, 0.06); cercle(0, 0, 0.15, COULEURS.bleue);
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      cercle(sx * POINT.x, sy * POINT.y, POINT.r, null, COULEURS.ligne, 0.06);
      cercle(sx * POINT.x, sy * POINT.y, 0.3, COULEURS.ligne);
      cercle(sx * POINT.neutre, sy * POINT.y, 0.3, COULEURS.ligne);
    }
    cx.beginPath();
    cx.arc(sx * LIGNE_BUT, 0, FILET.enclave, sx > 0 ? Math.PI / 2 : -Math.PI / 2, sx > 0 ? Math.PI * 1.5 : Math.PI / 2);
    cx.fillStyle = COULEURS.enclave; cx.fill();
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.06; cx.stroke();
  }
  cx.restore();
  cheminGlace(); cx.strokeStyle = COULEURS.bande; cx.lineWidth = 0.4; cx.stroke();
  for (const s of [1, -1]) {
    const x0 = s * LIGNE_BUT, x1 = s * (LIGNE_BUT + FILET.profond), d = FILET.large / 2;
    cx.fillStyle = COULEURS.maille;
    cx.fillRect(Math.min(x0, x1), -d, FILET.profond, FILET.large);
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.1;
    cx.beginPath(); cx.moveTo(x0, -d); cx.lineTo(x1, -d); cx.lineTo(x1, d); cx.lineTo(x0, d); cx.stroke();
    cercle(x0, -d, FILET.poteau + 0.03, COULEURS.ligne); cercle(x0, d, FILET.poteau + 0.03, COULEURS.ligne);
    // La lumière du but, derrière le filet : rouge et qui clignote après un but.
    const lum = anims.find(a => a.type === 'lumiere' && a.cote === s);
    const allumee = lum && Math.sin((performance.now() - lum.t0) / 90) > 0;
    cercle(s * (LIGNE_BUT + FILET.profond + 0.9), 0, 0.35, allumee ? COULEURS.lumiere : COULEURS.lampe, COULEURS.bande, 0.06);
  }
  cx.fillStyle = COULEURS.banc;
  cx.fillRect(-14, Y + 0.4, 12, 1.6); cx.fillRect(2, Y + 0.4, 12, 1.6);
  cx.fillRect(-5, -Y - 2, 4, 1.6); cx.fillRect(1, -Y - 2, 4, 1.6);
}

/*
 * UN JETON, LE CHANDAIL (JP : *une équipe blanche*) : l'anneau porte la couleur du chandail et les épaules la
 * couleur du club — les locaux en blanc, comme avant 2003, les visiteurs en couleur. La face dedans.
 */
function jeton(x, y, r, c, id, cap, fort) {
  cx.fillStyle = COULEURS.ombre;
  cx.beginPath(); cx.ellipse(x + 0.08, y + 0.12, r * 1.02, r * 0.9, 0, 0, Math.PI * 2); cx.fill();
  cercle(x, y, r, c.bg, fort ? COULEURS.blanc : COULEURS.contour, fort ? 0.07 : 0.04);
  cx.strokeStyle = c.epaule; cx.lineWidth = r * 0.34;
  cx.beginPath(); cx.arc(x, y, r * 0.82, cap + Math.PI * 0.55, cap + Math.PI * 1.45); cx.stroke();
  const im = visage(id), rf = r * 0.66;
  cx.save();
  cx.beginPath(); cx.arc(x, y, rf, 0, Math.PI * 2); cx.clip();
  if (im) cx.drawImage(im, x - rf, y - rf, rf * 2, rf * 2);
  else { cx.fillStyle = COULEURS.peau; cx.fillRect(x - rf, y - rf, rf * 2, rf * 2); }
  cx.restore();
  cx.strokeStyle = COULEURS.blanc; cx.lineWidth = 0.04;
  cx.beginPath(); cx.arc(x, y, rf, 0, Math.PI * 2); cx.stroke();
}

/*
 * LES ANIMATIONS (JP : *animations, etc.*), toutes procédurales, aucune image : la foulée des patins quand on avance,
 * le bâton qui se charge en arrière et fouette en avant au tir, la poussée de la passe, l'allongé du harpon, la
 * chute (le jeton couché, le bâton par terre), l'étoile d'un impact, le papillon du gardien, la lumière du but et le
 * flash, la rondelle qui tombe à la mise en jeu.
 */
function patineur(s, now) {
  const c = couleurs[s.equipe];
  const toi = s.id === etat.controle;
  const v = Math.hypot(s.vx, s.vy);
  // LA CHUTE : couché dans le sens de la glissade, le bâton par terre.
  if (s.auSol > 0) {
    const ang = v > 0.3 ? Math.atan2(s.vy, s.vx) : s.cap;
    cx.save();
    cx.globalAlpha = 0.85;
    cx.strokeStyle = COULEURS.baton; cx.lineWidth = 0.07; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(s.x + Math.cos(ang + 1.3) * 0.5, s.y + Math.sin(ang + 1.3) * 0.5); cx.lineTo(s.x + Math.cos(ang + 1.3) * 0.5 + Math.cos(ang + 0.3) * 1.3, s.y + Math.sin(ang + 1.3) * 0.5 + Math.sin(ang + 0.3) * 1.3); cx.stroke();
    cx.translate(s.x, s.y); cx.rotate(ang); cx.scale(1.35, 0.7); cx.translate(-s.x, -s.y);
    jeton(s.x, s.y, s.rayon, c, s.visage, 0, toi);
    cx.restore();
    return;
  }
  // LA FOULÉE : deux lames derrière le corps, en alternance, au rythme de la distance parcourue.
  const anim = s.anim || (s.anim = { dist: 0 });
  if (v > 0.6) {
    const ph = anim.dist * 3.2;
    const cx0 = Math.cos(s.cap), sy0 = Math.sin(s.cap);
    cx.strokeStyle = COULEURS.lame; cx.lineWidth = 0.09; cx.lineCap = 'round';
    for (const cote of [-1, 1]) {
      const av = Math.sin(ph + (cote > 0 ? 0 : Math.PI)) * 0.28;
      const px = s.x - cx0 * 0.15 + cx0 * av - sy0 * cote * 0.3, py = s.y - sy0 * 0.15 + sy0 * av + cx0 * cote * 0.3;
      cx.beginPath(); cx.moveTo(px - cx0 * 0.18, py - sy0 * 0.18); cx.lineTo(px + cx0 * 0.18, py + sy0 * 0.18); cx.stroke();
    }
  }
  // LE BÂTON : chargé en arrière, fouetté en avant au tir, poussé à la passe, allongé au harpon.
  let tournure = 0, portee = 1;
  if (s.charge > 0 && etat.rondelle.porteur === s.id) tournure = -0.9 * Math.min(1, s.charge / BATON.charge);
  if (anim.tir && now - anim.tir < 160) tournure = 0.7 * (1 - (now - anim.tir) / 160);
  if (anim.passe && now - anim.passe < 110) { portee = 1.25; tournure = 0.25; }
  if (s.harpon > 0) portee = 1.8;
  const lm = lame({ x: s.x, y: s.y, cap: s.cap + tournure });
  const bx = s.x + (lm.x - s.x) * portee, by = s.y + (lm.y - s.y) * portee;
  cx.strokeStyle = COULEURS.baton; cx.lineWidth = 0.08; cx.lineCap = 'round';
  cx.beginPath(); cx.moveTo(s.x + Math.cos(s.cap + 0.6) * s.rayon * 0.7, s.y + Math.sin(s.cap + 0.6) * s.rayon * 0.7); cx.lineTo(bx, by); cx.stroke();
  cx.lineWidth = 0.13;
  const ca = Math.cos(s.cap + tournure), sa = Math.sin(s.cap + tournure);
  cx.beginPath(); cx.moveTo(bx - ca * 0.15, by - sa * 0.15); cx.lineTo(bx + ca * 0.24, by + sa * 0.24); cx.stroke();
  jeton(s.x, s.y, s.rayon, c, s.visage, s.cap, toi);
  if (toi) { cx.strokeStyle = COULEURS.blanc; cx.lineWidth = 0.08; cx.setLineDash([0.25, 0.18]); cx.beginPath(); cx.arc(s.x, s.y, s.rayon + 0.3, 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]); }
  if (s.charge > 0 && etat.rondelle.porteur === s.id) {
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.09;
    cx.beginPath(); cx.arc(s.x, s.y, s.rayon + 0.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.charge / BATON.charge)); cx.stroke();
  }
}

function gardien(Gd, now) {
  const R = etat.rondelle, c = couleurs[Gd.equipe];
  // LE PAPILLON : les jambières s'ouvrent sur un arrêt, un demi-seconde.
  const papillon = Gd.anim && now - Gd.anim < 450 ? 1 - (now - Gd.anim) / 450 : 0;
  const demi = Gd.p.demi * (1 + 0.5 * papillon), prof = GARDIEN.profondeur * (1 - 0.3 * papillon);
  cx.fillStyle = COULEURS.jambiere;
  cx.fillRect(Gd.x - prof, Gd.y - demi, prof * 2, demi * 2);
  cx.strokeStyle = c.epaule; cx.lineWidth = 0.1; cx.strokeRect(Gd.x - prof, Gd.y - demi, prof * 2, demi * 2);
  jeton(Gd.x, Gd.y, 0.42, c, Gd.visage, Math.atan2(R.y - Gd.y, R.x - Gd.x), false);
}

function dessiner(now) {
  const { w, h, dpr } = taille;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = COULEURS.noir; cx.fillRect(0, 0, w, h);
  cx.translate(w / 2, h / 2);
  cx.rotate(-Math.PI / 2);
  cx.scale(cam.k, cam.k);
  cx.translate(-cam.x, -cam.y);
  patinoire();
  const R = etat.rondelle;
  if (trace.length > 1) {
    cx.strokeStyle = COULEURS.trace; cx.lineWidth = 0.08; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(trace[0].x, trace[0].y); for (const p of trace) cx.lineTo(p.x, p.y); cx.stroke();
  }
  for (const Gd of etat.gardiens) gardien(Gd, now);
  for (const s of etat.patineurs) if (s.surGlace || s.boxe) patineur(s, now);
  // LA RONDELLE : à la mise en jeu, elle tombe (grosse et son ombre, puis au sol).
  const chute = etat.mej ? Math.max(0, etat.mej.reste / 0.9) : 0;
  const rr = Math.max(RONDELLE.rayon, 3 / cam.k);
  if (chute > 0) { cx.fillStyle = COULEURS.ombre; cx.beginPath(); cx.arc(R.x, R.y, rr * (1 + chute), 0, Math.PI * 2); cx.fill(); }
  cercle(R.x - chute * 0.6, R.y, rr * (1 + chute * 1.6), COULEURS.rondelle);
  // LES ÉTOILES D'IMPACT.
  for (const a of anims) {
    if (a.type !== 'impact') continue;
    const f = 1 - (now - a.t0) / a.dur;
    cx.strokeStyle = COULEURS.blanc; cx.lineWidth = 0.08; cx.globalAlpha = f;
    for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4; cx.beginPath(); cx.moveTo(a.x + Math.cos(ang) * 0.3, a.y + Math.sin(ang) * 0.3); cx.lineTo(a.x + Math.cos(ang) * (0.5 + (1 - f) * 1.2), a.y + Math.sin(ang) * (0.5 + (1 - f) * 1.2)); cx.stroke(); }
    cx.globalAlpha = 1;
  }
  // LE FLASH DU BUT, sur tout l'écran.
  const flashBut = anims.find(a => a.type === 'flash');
  if (flashBut) {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.globalAlpha = 0.5 * (1 - (now - flashBut.t0) / flashBut.dur);
    cx.fillStyle = COULEURS.blanc; cx.fillRect(0, 0, w, h);
    cx.globalAlpha = 1;
  }
  if (!vueEntiere) radar();
  if (doigt) {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = el.getBoundingClientRect();
    cercle(doigt.x0 - r.left, doigt.y0 - r.top, 48, COULEURS.doigt, COULEURS.doigtTrait, 2);
    const dx = doigt.x - doigt.x0, dy = doigt.y - doigt.y0, m = Math.hypot(dx, dy), cc = Math.min(48, m) / (m || 1);
    cercle(doigt.x0 - r.left + dx * cc, doigt.y0 - r.top + dy * cc, 18, COULEURS.doigtPlein);
  }
  anims = anims.filter(a => now - a.t0 < a.dur);
}
/* Le radar : toute la glace, en petit, debout, dans le coin du bas à droite. */
function radar() {
  const { w, h, dpr } = taille;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const larg = 56, haut = 132;
  const x0 = w - larg - 10, y0 = h - haut - (taille.large ? 60 : 96);
  cx.fillStyle = COULEURS.radarFond; cx.fillRect(x0 - 3, y0 - 3, larg + 6, haut + 6);
  cx.fillStyle = COULEURS.radarGlace; cx.fillRect(x0, y0, larg, haut);
  const k = haut / L;
  const pt = (x, y) => [x0 + larg / 2 + y * k, y0 + haut / 2 - x * k];
  cx.fillStyle = COULEURS.ligne;
  const [cx1, cy1] = pt(0, -W / 2), [cx2, cy2] = pt(0, W / 2);
  cx.fillRect(Math.min(cx1, cx2) - 0.5, Math.min(cy1, cy2), Math.abs(cx2 - cx1) + 1, 1);
  for (const s of etat.patineurs) {
    if (!s.surGlace) continue;
    const [px, py] = pt(s.x, s.y);
    cx.fillStyle = couleurs[s.equipe].bg; cx.beginPath(); cx.arc(px, py, s.id === etat.controle ? 3.2 : 2.2, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = s.id === etat.controle ? COULEURS.blanc : couleurs[s.equipe].epaule; cx.lineWidth = 1; cx.stroke();
  }
  const [rx, ry] = pt(etat.rondelle.x, etat.rondelle.y);
  cx.fillStyle = COULEURS.rondelle; cx.beginPath(); cx.arc(rx, ry, 1.8, 0, Math.PI * 2); cx.fill();
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
