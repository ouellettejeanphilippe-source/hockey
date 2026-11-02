/**
 * SUR GLACE — L'ÉCRAN (31 oct. 2026). JP : *faire un jeu 2D avec une physique crédible, pas refaire un jeu de
 * 30 ans* ; *go* ; puis *avoir toutes les mécaniques de hockey*. Deux vrais clubs, n'importe quelle époque, un match
 * joué à la manette, seul ou à deux ; ou l'entraînement, le terrain de jeu d'un seul patineur. Tout ce qui bouge vit
 * dans js/physique.js (des mètres, des secondes, un pas fixe) et les neuf autres dans js/glace-ia.js ; ici, on lit
 * la manette, le clavier ou le doigt, on dessine au canevas, on fait sonner et vibrer les événements et on tient
 * le tableau. Vue de haut, la caméra suit la rondelle ; debout au téléphone, couchée en mode large, comme la
 * caméra des NHL modernes à la télé.
 *
 * LES MÊMES PITONS QUE LES NHL CLASSIQUES (JP, 1er nov. 2026) :
 *   le bâton gauche, les flèches ou WASD   patiner (le bâton à l'envers : freiner)
 *   A, Espace                              la passe ; sans la rondelle, changer de joueur ; à la mise en jeu, la chute
 *   X ou RT tenu, Maj tenue                charger le tir ; lâché, il part ; sans la rondelle, le harpon
 *   B ou RB, Ctrl                          avec la rondelle, le turbo ; sans elle, l'élan d'une mise en échec
 *   Y, E                                   changer de joueur
 *   LB ou LT, Q                            patiner à reculons (le cap tenu vers le jeu)
 *   Start, Échap, ✕                        la pause : reprendre, retirer le gardien, les règles, quitter
 */
import { nouvelleGlace, nouveauMatch, avancer, remise, reglesDeLaGlace, lame, parametresDuPatineur, parametresDuGardien, receveurDePasse, retirerGardien, DIFFICULTES, L, W, COIN, LIGNE_BUT, BLEUE, POINT, FILET, BATON } from './physique.js';
import { decisionIA } from './glace-ia.js';
import { PATINEURS, GARDIENS, LARGEUR, HAUTEUR, ANCRE } from './sprites.js';
import { nouvelleGraine, entierDeGraine, autoRoster, copieDeJoueur, SLOTS } from './sim.js';
import { axes20, cote20 } from './niveaux.js';
import { getTraits } from './traits.js';
import { nomCourt } from './recit.js';
import { coupDeGlace, fouleReagit, ambianceFoule, couperLaGlace } from './sons-glace.js';
import { esc, estD } from './util.js';

const GRADINS = 3.2;     // les gradins autour de la glace, m : la caméra ne montre jamais au-delà
const SUIVI = 6;         // la vitesse à laquelle elle rattrape la rondelle, par seconde
const PIXEL = 1 / 14;    // un pixel de sprite, en mètres : quatorze par mètre (la lame à quatorze pixels devant les patins) ; à l'écran, un pixel de sprite fait un nombre ENTIER de pixels (jamais de flou) : un au téléphone (la zone entière dans la largeur), deux ou trois sur un grand écran
const FOULEES = 8;       // les images d'un tour de foulée (rendues de la même courbe que la poussée du moteur, `s.foulee`)
const VIRAGE_PENCHE = 1.3;   // à partir de ce virage (rad/s), à vitesse, le patineur se couche dans la courbe
const VIRAGE_VITESSE = 4.5;  // … et à partir de cette vitesse, m/s
const DIRECTIONS = 8;    // les sprites du patineur existent en huit directions, toutes rendues (le bâton reste dans la même main)
const GEL = 0.06;        // l'arrêt sur image d'une mise en échec qui renverse, s (le hit stop)
const NOM = 1200;        // le nom du porteur se montre ça de temps à la prise, ms (JP : *nom apparaît une seconde à la possession*)
const COULEURS = {
  ligne: '#d0021b', bande: '#2b2f3a', noir: '#0a0b0e', reflet: '#5d6270',
  toi: '#f47b20', plot: '#8d939f', blanc: '#f4f4f4', encreBlanc: '#111', contour: '#1b1d24', ombre: 'rgba(0,0,0,0.25)',
  baton: '#9a6a34', lame: '#1c1c22', jambiere: '#f2f4f7', pantalon: '#1f2230', rondelle: '#111', trace: 'rgba(20,20,20,0.35)',
  lumiere: '#ff2a2a', lampe: '#5a1414', passe: '#ffe14d',
  trait: '#101014', peau: '#e8c39e', peauOmbre: '#c49672', jambiereOmbre: '#c4c9d2', patin: '#15161c', lameSprite: '#d7dde6', ombreSprite: 'rgba(0,0,0,0.3)',
  radarFond: 'rgba(10,11,14,0.75)', radarGlace: 'rgba(232,238,243,0.9)', doigt: 'rgba(255,255,255,0.08)', doigtTrait: 'rgba(255,255,255,0.35)', doigtPlein: 'rgba(255,255,255,0.6)',
};
/* Les chandails : les locaux (B, « eux ») en blanc aux épaules du club, les visiteurs (A, toi) en couleur. */
const chandails = (bandA, bandB) => ({
  A: { bg: bandA.bg, ink: bandA.ink, epaule: bandA.stripe || bandA.ink, casque: teinter(bandA.bg, -0.45), pantalon: teinter(bandA.bg, -0.5) },
  B: { bg: COULEURS.blanc, ink: COULEURS.encreBlanc, epaule: bandB.bg, club: bandB.bg, casque: bandB.bg, pantalon: teinter(bandB.bg, -0.35) },
});
const CLE = 'cap82_glace';
/*
 * LES SPRITES 16 BITS (JP, 1er nov. : *look snes* ; *ya moyen d'avoir un vrai pixel art de qualité ?* ; *ça, c'est
 * des sprites*). Rendus par scripts/sprites/rendu.mjs à la manière des sprites précalculés des années 90 : un joueur
 * en volumes (un squelette, ses membres, son casque, son bâton), posé image par image, vu de trois quarts du dessus,
 * rastérisé en pixels, ses tons choisis par une seule lumière, son contour et son ombre portée tramée sur la glace.
 * js/sprites.js tient les images en lettres, une lettre par matière (le chandail en trois tons, la bande du club, le
 * casque, la peau, le pantalon, les gants, les patins, le bâton, les jambières, l'ombre) ; teintes aux couleurs du club
 * une fois, gardées. Le patineur en huit directions et dix poses (le repos, la foulée en quatre images, la charge, le
 * fouetté, la passe, l'épaule, la chute), le gardien en quatre directions (la garde, le papillon, la mitaine, le
 * bloqueur). Les visages (img/mugs) restent à la barre du nom.
 */
const sprites = new Map();
/* Mélanger une couleur hexadécimale vers le blanc (k > 0) ou le noir (k < 0). */
function teinter(hex, k) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const canal = v => { const x = k > 0 ? v + (255 - v) * k : v * (1 + k); return Math.max(0, Math.min(255, Math.round(x))); };
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => canal(v).toString(16).padStart(2, '0')).join('')}`;
}
function teintesDe(eq) {
  const c = couleurs[eq];
  return {
    k: COULEURS.trait, J: c.bg, j: teinter(c.bg, 0.3), d: teinter(c.bg, -0.3), T: c.epaule, S: COULEURS.peau, s: COULEURS.peauOmbre,
    H: c.casque, h: teinter(c.casque, 0.35), P: c.pantalon, p: teinter(c.pantalon, 0.25), G: teinter(c.pantalon, -0.1), K: COULEURS.patin, L: COULEURS.lameSprite,
    B: COULEURS.baton, b: COULEURS.lame, Q: COULEURS.jambiere, q: COULEURS.jambiereOmbre, W: COULEURS.jambiere, o: COULEURS.ombreSprite,
  };
}
/* Les directions de l'écran (0 = vers la droite, puis dans le sens des aiguilles) : huit pour le patineur, quatre pour le gardien. */
const HUIT = ['E', 'SE', 'S', 'SO', 'O', 'NO', 'N', 'NE'];
const QUATRE = ['E', 'S', 'O', 'N'];
/* Le sprite d'un club dans une pose et une direction, teint une fois et gardé. */
function spriteDe(eq, genre, pose, dir) {
  const cle = `${eq}:${genre}:${pose}:${dir}`;
  let im = sprites.get(cle);
  if (im) return im;
  const nom = (genre === 'G' ? QUATRE : HUIT)[dir];
  const planche = (genre === 'G' ? GARDIENS : PATINEURS)[nom];
  const lignes = planche[pose] || planche.repos || planche.garde;
  const teintes = teintesDe(eq);
  im = document.createElement('canvas');
  im.width = LARGEUR; im.height = HAUTEUR;
  const g = im.getContext('2d');
  lignes.forEach((ligne, y) => [...ligne].forEach((ch, x) => { const t = teintes[ch]; if (t) { g.fillStyle = t; g.fillRect(x, y, 1, 1); } }));
  sprites.set(cle, im);
  return im;
}
/* Les visages : la vraie face d'un joueur à la barre du nom, aux étoiles, aux buts (JP : *rond avec face d'un joueur*). */
const VEDETTES = [8478402, 8471675, 8447400, 8448782, 8471214, 8448624];   // McDavid, Crosby, Gretzky, Lemieux, Ovechkin, Lafleur
const PLOT = 8459455, GARDIEN_VISAGE = 8451033;                             // Pronger ; Roy
const mug = id => (id && ctxJeu && ctxJeu.mug ? `<span class="sg-mug">${ctxJeu.mug({ id })}</span>` : '');

let el = null, canvas = null, cx = null, etat = null, raf = null, dernier = 0, ctxJeu = null;
let cam = { x: 0, y: 0, k: 20 };
let touche = { haut: 0, bas: 0, gauche: 0, droite: 0, passe: false, tir: false, echec: false, changer: false, recul: false };
let doigt = null;        // le bâton du doigt : { id, x0, y0, x, y }
let boutons = { passe: false, tir: false, echec: false, changer: false };
let flash = { mot: '', reste: 0 };
let trace = [];
let vueEntiere = false;
let taille = { w: 1, h: 1, dpr: 1, large: false };
let tonVisage = VEDETTES[0];
let choix = null;        // l'affiche : { A: { saison, club }, B: {…}, periode, horsjeu, degagement, series, deux, difficulte, vibration }
let couleurs = chandails({ bg: COULEURS.toi, ink: COULEURS.blanc, stripe: COULEURS.encreBlanc }, { bg: COULEURS.plot, ink: COULEURS.blanc });
let anims = [];          // les animations en cours : { type, t0, dur, … }
let noms = { A: 'Toi', B: 'Eux' };
let enfin = false;
let pause = false, gel = 0, secousse = null, tremble = { x: 0, y: 0 };
let manettes = {};       // la manette de chaque humain, ce tour-ci : { A: Gamepad, B: Gamepad }
let tenu = { start: false, haut: false, bas: false, a: false, b: false };   // les fronts de la manette au menu de pause
let batons = { A: { x: 0, y: 0 }, B: { x: 0, y: 0 } };   // la dernière poussée de chaque humain (le receveur de la passe se lit dessus)
let relachement = null;  // le tir ou la passe au relâchement du joystick : { tir, passe, reste, dx, dy }
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
  const memo = lire() || {};
  const valide = x => x && ctx.saisons.includes(x.saison) && typeof x.club === 'string';
  choix = {
    A: valide(memo.A) ? memo.A : null, B: valide(memo.B) ? memo.B : null, periode: memo.periode || 180,
    horsjeu: memo.horsjeu !== false, degagement: memo.degagement !== false, series: !!memo.series, deux: !!memo.deux,
    difficulte: DIFFICULTES[memo.difficulte] ? memo.difficulte : 'normal', vibration: memo.vibration !== false,
  };
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
  canvas = null; cx = null; etat = null; pause = false; gel = 0; secousse = null;
  couperLaGlace();
  touche = { haut: 0, bas: 0, gauche: 0, droite: 0, passe: false, tir: false, echec: false, changer: false, recul: false };
  doigt = null; boutons = { passe: false, tir: false, echec: false, changer: false };
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
const DIFFICULTE_MOTS = { facile: 'Facile', normal: 'Normale', difficile: 'Difficile' };
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
      <div class="sg-cote-t">${k === 'A' ? 'Toi' : choix.deux ? 'Joueur 2' : 'Eux'}</div>
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
      <label>Difficulté <select class="opt-select" data-difficulte>${Object.keys(DIFFICULTES).map(d => `<option value="${d}"${d === choix.difficulte ? ' selected' : ''}>${DIFFICULTE_MOTS[d]}</option>`).join('')}</select></label>
      <label><input type="checkbox" data-regle="horsjeu"${choix.horsjeu ? ' checked' : ''}> Hors-jeu</label>
      <label><input type="checkbox" data-regle="degagement"${choix.degagement ? ' checked' : ''}> Dégagement refusé</label>
      <label><input type="checkbox" data-regle="series"${choix.series ? ' checked' : ''}> Séries <small>la prolongation à cinq, autant qu'il en faut</small></label>
      <label><input type="checkbox" data-regle="deux"${choix.deux ? ' checked' : ''}> Deux joueurs <small>la deuxième manette ; seule, elle joue Eux</small></label>
      <label><input type="checkbox" data-regle="vibration"${choix.vibration ? ' checked' : ''}> Vibration <small>la manette ou le téléphone</small></label>
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
  const dif = el.querySelector('[data-difficulte]');
  if (dif) dif.onchange = () => { choix.difficulte = dif.value; ecrire(choix); };
  el.querySelectorAll('[data-regle]').forEach(c => { c.onchange = () => { choix[c.dataset.regle] = c.checked; ecrire(choix); if (c.dataset.regle === 'deux') accueil(); }; });
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
  const e = nouveauMatch({
    graine: nouvelleGraine(), A, B, periode: choix.periode, humains: choix.deux ? ['A', 'B'] : ['A'], ia: decisionIA,
    regles: { horsjeu: choix.horsjeu, degagement: choix.degagement }, series: choix.series, difficulte: choix.difficulte,
  });
  lancer(e);
}
function commencerLEntrainement() {
  const e = nouvelleGlace(nouvelleGraine());
  tonVisage = VEDETTES[entierDeGraine(e.graine) % VEDETTES.length];
  e.patineurs[0].visage = tonVisage; e.patineurs[1].visage = PLOT; e.gardiens[0].visage = GARDIEN_VISAGE;
  couleurs = chandails({ bg: COULEURS.toi, ink: COULEURS.blanc, stripe: COULEURS.encreBlanc }, { bg: COULEURS.plot, ink: COULEURS.blanc });
  noms = { A: 'Toi', B: 'Le plot' };
  lancer(e);
}

/* ---------- la glace ---------- */
function lancer(e) {
  etat = e;
  trace = []; flash = { mot: '', reste: 0 }; vueEntiere = false; enfin = false; anims = []; pause = false; gel = 0; secousse = null; relachement = null;
  sprites.clear();
  el.innerHTML = `
    <canvas class="sg-canvas" aria-label="La patinoire"></canvas>
    <div class="sg-crt" aria-hidden="true"></div>
    <div class="sg-haut">
      <button type="button" class="sg-btn sg-fermer" data-sg="pause" aria-label="Pause">॥</button>
      <div class="sg-tableau" role="status"></div>
      <button type="button" class="sg-btn" data-sg="vue" aria-pressed="false" title="Toute la glace">⤢</button>
      ${etat.match ? '' : '<button type="button" class="sg-btn" data-sg="centre" title="La rondelle au centre">↺</button>'}
    </div>
    <div class="sg-flash" aria-live="polite"></div>
    <div class="sg-puissance" hidden><div class="sg-puissance-plein"></div></div>
    <div class="sg-bas">
      <div class="sg-vitesse"></div>
      <div class="sg-invites"></div>
    </div>
    <div class="sg-doigt" aria-hidden="true">
      <button type="button" class="sg-rond sg-rond-changer" data-doigt="changer">Changer</button>
      <button type="button" class="sg-rond sg-rond-echec" data-doigt="echec">Échec</button>
      <button type="button" class="sg-rond" data-doigt="passe">Passe</button>
      <button type="button" class="sg-rond sg-rond-tir" data-doigt="tir">Tir</button>
    </div>
    <div class="sg-pause" hidden>
      <div class="sg-pause-carte">
        <h2>Pause</h2>
        <button type="button" class="btn go" data-pause="reprendre">Reprendre</button>
        ${etat.match ? etat.humains.map(eq => `<button type="button" class="btn" data-pause="gardien" data-eq="${eq}">Retirer le gardien${etat.humains.length > 1 ? ` · ${esc(etat.equipes[eq].tag)}` : ''}</button>`).join('') : ''}
        <button type="button" class="btn" data-pause="regles" aria-expanded="false">Ce que la glace fait</button>
        <button type="button" class="btn" data-pause="quitter">Quitter</button>
        <aside class="sg-regles" hidden>
          <h3>Ce que la glace fait</h3>
          <ul>${reglesDeLaGlace().map(r => `<li>${esc(r)}</li>`).join('')}</ul>
          <p class="sg-regles-mot">Le bâton gauche, les flèches ou WASD patinent ; à l'envers, c'est le frein. A ou Espace passe, change de joueur sans la rondelle, et prend la mise en jeu à la chute. X, RT ou Maj tenue charge le tir (le bâton choisit le coin) ; sans la rondelle, c'est le harpon. B, RB ou Ctrl : le turbo avec la rondelle, la mise en échec sans elle. Y ou E change de joueur ; LB, LT ou Q patine à reculons. Start, Échap ou ॥ : la pause.</p>
        </aside>
      </div>
    </div>
    <div class="sg-fin" hidden></div>`;
  canvas = el.querySelector('.sg-canvas');
  cx = canvas.getContext('2d');
  el.querySelector('.sg-haut').addEventListener('click', ev => {
    const b = ev.target.closest('[data-sg]');
    if (!b) return;
    const quoi = b.dataset.sg;
    if (quoi === 'pause') basculerPause();
    else if (quoi === 'centre') { remise(etat, 'but'); trace = []; coupDeGlace('miseEnJeu'); }
    else if (quoi === 'vue') { vueEntiere = !vueEntiere; b.setAttribute('aria-pressed', String(vueEntiere)); }
  });
  el.querySelector('.sg-pause').addEventListener('click', ev => {
    const b = ev.target.closest('[data-pause]');
    if (!b) return;
    const quoi = b.dataset.pause;
    if (quoi === 'reprendre') basculerPause();
    else if (quoi === 'quitter') fermerSurGlace();
    else if (quoi === 'regles') { const a = el.querySelector('.sg-pause .sg-regles'); a.hidden = !a.hidden; b.setAttribute('aria-expanded', String(!a.hidden)); }
    else if (quoi === 'gardien') {
      const Gd = etat.gardiens.find(g => g.equipe === b.dataset.eq);
      retirerGardien(etat, b.dataset.eq, !Gd.retire);
      b.textContent = `${Gd.retire ? 'Remettre' : 'Retirer'} le gardien${etat.humains.length > 1 ? ` · ${etat.equipes[b.dataset.eq].tag}` : ''}`;
      flash = { mot: Gd.retire ? `Filet désert, ${noms[b.dataset.eq]}` : `${nomDe(`G:${b.dataset.eq}`) || 'Le gardien'} revient au filet`, reste: 1.6 };
    }
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
/* LA PAUSE (Start, Échap, ॥ ; le retour de js/pile.js clique ॥) : le jeu s'arrête, le menu s'ouvre ; encore, il reprend. */
function basculerPause() {
  if (!el || !etat || enfin) return;
  pause = !pause;
  const P = el.querySelector('.sg-pause');
  P.hidden = !pause;
  if (pause) { const b = P.querySelector('[data-pause]'); if (b) b.focus({ preventScroll: true }); }
  else { const a = P.querySelector('.sg-regles'); if (a) a.hidden = true; dernier = performance.now(); }
}

function invites() {
  const ctl = etat && etat.controles[etat.humains[0]];
  const porte = etat && etat.rondelle.porteur && etat.rondelle.porteur === ctl;
  const m = document.body.classList.contains('manette');
  const k = (pad, clav) => `<kbd>${m ? pad : clav}</kbd>`;
  return `<span>${k('⬤', 'Flèches')} Patiner</span><span>${k('Ⓐ', 'Espace')} ${porte ? 'Passe' : etat && etat.mej ? 'Mise en jeu' : 'Changer'}</span><span>${k('Ⓧ', 'Maj')} ${porte ? 'Tir (tenir)' : 'Harpon'}</span><span>${k('Ⓑ', 'Ctrl')} ${porte ? 'Turbo' : 'Échec'}</span><span>${k('LB', 'Q')} Reculer</span><span>${k('Start', 'Échap')} Pause</span>`;
}

/* ---------- les entrées ---------- */
const CLAVIER = { ArrowUp: 'haut', ArrowDown: 'bas', ArrowLeft: 'gauche', ArrowRight: 'droite', w: 'haut', s: 'bas', a: 'gauche', d: 'droite', ' ': 'passe', j: 'passe', Shift: 'tir', k: 'tir', Control: 'echec', l: 'echec', e: 'changer', i: 'changer', q: 'recul', u: 'recul' };
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
    auDoigt = true;
    if (doigt) return;
    doigt = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', ev => { if (doigt && ev.pointerId === doigt.id) { doigt.x = ev.clientX; doigt.y = ev.clientY; } });
  const lacher = ev => {
    if (!doigt || ev.pointerId !== doigt.id) return;
    if (etat) {
      const dx = (doigt.x - doigt.x0) / 48, dy = (doigt.y - doigt.y0) / 48;
      const m = Math.hypot(dx, dy);
      if (m > 0.3) {
        const nx = dx / m, ny = dy / m;
        const eq = etat.humains[0], ctl = etat.controles[eq];
        const porte = ctl && etat.rondelle.porteur === ctl;
        if (porte) {
          const a = etat.equipes[eq].attaque;
          const g = versGlace(nx, ny);
          const versFilet = g.x * a;
          if (versFilet > 0.3) relachement = { tir: true, passe: false, reste: 0.08 + m * 0.12, sx: nx, sy: ny };
          else relachement = { tir: false, passe: true, reste: 0.06, sx: nx, sy: ny };
        }
      }
    }
    doigt = null;
  };
  canvas.addEventListener('pointerup', lacher);
  canvas.addEventListener('pointercancel', lacher);
  for (const b of el.querySelectorAll('[data-doigt]')) {
    const quoi = b.dataset.doigt;
    b.addEventListener('pointerdown', ev => { boutons[quoi] = true; ev.preventDefault(); if (ev.pointerType !== 'mouse' && etat) { auDoigt = true; vibrer(etat.humains[0], 'bouton'); } });
    const fin = () => { boutons[quoi] = false; };
    b.addEventListener('pointerup', fin);
    b.addEventListener('pointercancel', fin);
    b.addEventListener('pointerleave', fin);
  }
}

/* La glace est DEBOUT, partout (on attaque vers le haut en première). Un vecteur de l'écran vers la glace. */
const versGlace = (sx, sy) => ({ x: -sy, y: sx });
const on = (p, i) => !!(p && p.buttons[i] && p.buttons[i].pressed);

/*
 * Les entrées de chaque humain, toutes sources confondues : sa manette d'abord si elle pousse, sinon le doigt,
 * sinon le clavier (le doigt et le clavier jouent toujours le premier). À deux joueurs avec une seule manette,
 * elle va au second. Start ouvre la pause ; en pause, la croix et A font le menu.
 */
function entrees() {
  const liste = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
  manettes = {};
  if (etat.humains.length === 2 && liste.length === 1) manettes.B = liste[0];
  else etat.humains.forEach((eq, i) => { if (liste[i]) manettes[eq] = liste[i]; });
  const start = liste.some(p => on(p, 9));
  if (start && !tenu.start) basculerPause();
  tenu.start = start;
  if (pause) { menuPause(liste[0]); return {}; }
  const out = {};
  for (const eq of etat.humains) {
    const p = manettes[eq];
    let sx = 0, sy = 0, passe = false, tir = false, echec = false, changer = false, recul = false;
    if (p) {
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.15) { sx = ax; sy = ay; }
      if (on(p, 12)) sy = -1; if (on(p, 13)) sy = 1; if (on(p, 14)) sx = -1; if (on(p, 15)) sx = 1;
      passe = on(p, 0); tir = on(p, 2) || on(p, 7); echec = on(p, 1) || on(p, 5); changer = on(p, 3); recul = on(p, 4) || on(p, 6);
    }
    if (eq === etat.humains[0]) {
      if (!sx && !sy && doigt) {
        const dx = (doigt.x - doigt.x0) / 48, dy = (doigt.y - doigt.y0) / 48;
        const m = Math.hypot(dx, dy);
        if (m > 0.1) { sx = dx / Math.max(1, m); sy = dy / Math.max(1, m); }
      }
      if (!sx && !sy) { sx = (touche.droite ? 1 : 0) - (touche.gauche ? 1 : 0); sy = (touche.bas ? 1 : 0) - (touche.haut ? 1 : 0); }
      passe = passe || touche.passe || boutons.passe; tir = tir || touche.tir || boutons.tir; echec = echec || touche.echec || boutons.echec;
      changer = changer || touche.changer || boutons.changer; recul = recul || touche.recul;
      if (relachement && relachement.reste > 0) {
        if (relachement.tir) tir = true;
        if (relachement.passe) passe = true;
        if (!sx && !sy) { sx = relachement.sx; sy = relachement.sy; }
        relachement.reste -= 4 / 120;
        if (relachement.reste <= 0) relachement = null;
      }
    }
    const m = Math.hypot(sx, sy);
    if (m > 1) { sx /= m; sy /= m; }
    const g = versGlace(sx, sy);
    if (m > 0.1) batons[eq] = g;
    const ctl = etat.controles[eq];
    if (!ctl) continue;
    const porte = etat.rondelle.porteur === ctl;
    // B : le turbo avec la rondelle, la mise en échec sans elle (les NHL classiques).
    out[ctl] = { x: g.x, y: g.y, passe, tir, echec: echec && !porte, sprint: echec && porte, changer, recul };
  }
  return out;
}
/* Le menu de pause à la manette : la croix (ou le bâton) va d'un bouton à l'autre, A choisit, B reprend. */
function menuPause(p) {
  const boutonsP = [...el.querySelectorAll('.sg-pause [data-pause]')];
  const haut = on(p, 12) || (p && (p.axes[1] || 0) < -0.5), bas = on(p, 13) || (p && (p.axes[1] || 0) > 0.5), a = on(p, 0), b = on(p, 1);
  const i = boutonsP.indexOf(document.activeElement);
  if (haut && !tenu.haut) boutonsP[(i <= 0 ? boutonsP.length : i) - 1].focus({ preventScroll: true });
  if (bas && !tenu.bas) boutonsP[(i + 1) % boutonsP.length].focus({ preventScroll: true });
  if (a && !tenu.a && i >= 0) boutonsP[i].click();
  if (b && !tenu.b) basculerPause();
  tenu.haut = haut; tenu.bas = bas; tenu.a = a; tenu.b = b;
}
/*
 * L'HAPTIQUE (JP, 1er nov. : *ajouter haptics*) : ce que tes mains sentent du match. À la manette, le dual-rumble du
 * Gamepad API (le moteur fort pour les coups, le faible pour la rondelle) ; au doigt, le vibreur du téléphone
 * (`navigator.vibrate`, la permission VIBRATE de l'APK), des impulsions courtes, plus brèves qu'à la manette — un
 * téléphone vibre fort. Chaque sensation : [fort, faible, durée à la manette (ms), motif au téléphone (ms)].
 */
const HAPTIQUE = {
  prise: [0, 0.25, 35, 8],                  // la rondelle arrive sur ta lame
  passe: [0, 0.3, 40, 10],
  tir: [0.15, 0.6, 70, 18],
  poteau: [0.3, 0.6, 110, [14, 40, 14]],
  harpon: [0.2, 0.5, 60, 14],               // ton harpon qui sort la rondelle
  echecDonne: [0.45, 0.7, 110, 25],
  echecRecu: [0.9, 0.5, 170, [45, 30, 20]],
  butPour: [1, 0.8, 420, [60, 50, 60, 50, 140]],
  butContre: [0.4, 0.8, 300, 50],
  bouton: [0, 0, 0, 6],                     // un piton du doigt sous ton pouce
};
let auDoigt = false;      // le téléphone vibre seulement quand on joue au doigt
function vibrer(eq, quoi) {
  if (!choix || !choix.vibration || !eq || !HAPTIQUE[quoi]) return;
  const [fort, faible, duree, motif] = HAPTIQUE[quoi];
  const p = manettes[eq];
  const v = p && p.vibrationActuator;
  if (v && typeof v.playEffect === 'function' && duree) {
    try { v.playEffect('dual-rumble', { startDelay: 0, duration: duree, strongMagnitude: fort, weakMagnitude: faible }).catch(() => {}); } catch { /* une manette sans moteur */ }
    return;
  }
  // Au doigt, c'est le premier humain qui tient le téléphone.
  if (!p && auDoigt && etat && eq === etat.humains[0] && navigator.vibrate) { try { navigator.vibrate(motif); } catch { /* un appareil sans vibreur */ } }
}
const tonJoueur = id => !!etat && Object.values(etat.controles).includes(id);
const equipeDe = id => { const s = etat.patineurs.find(p => p.id === id); return s ? s.equipe : null; };

/* ---------- la boucle ---------- */
function boucle(now) {
  if (!el || !etat) return;
  const dt = Math.min(0.1, (now - dernier) / 1000);
  dernier = now;
  const e = entrees();
  if (!el || !etat) return;
  // L'ARRÊT SUR IMAGE d'une mise en échec qui renverse (le hit stop) : quelques images où rien ne bouge.
  if (gel > 0) gel -= dt;
  const ev = pause || gel > 0 ? [] : avancer(etat, e, dt);
  for (const v of ev) {
    sonner(v);
    animer(v, now);
    if (v.type === 'but') { flash = { mot: etat.match ? `BUT ! ${noms[v.equipe]}` : 'BUT !', reste: 2 }; secousse = { t0: now, dur: 450, amp: 4 }; for (const eq of etat.humains) vibrer(eq, eq === v.equipe ? 'butPour' : 'butContre'); }
    else if (v.type === 'arret' && v.gele) flash = { mot: 'Gelée.', reste: 1.2 };
    else if (v.type === 'arret') flash = { mot: 'Arrêt !', reste: 0.8 };
    else if (v.type === 'poteau') { flash = { mot: v.barre ? 'La barre !' : 'Poteau !', reste: 0.8 }; secousse = { t0: now, dur: 160, amp: 2 }; const d = etat.rondelle.dernier; if (d && tonJoueur(d.id)) vibrer(d.equipe, 'poteau'); }
    else if (v.type === 'horsjeu') flash = { mot: 'Hors-jeu', reste: 1.2 };
    else if (v.type === 'degagement') flash = { mot: 'Dégagement refusé', reste: 1.2 };
    else if (v.type === 'vitre') flash = { mot: 'Par-dessus la vitre', reste: 1.2 };
    else if (v.type === 'punition') flash = { mot: `${nomDe(v.qui)} · ${v.genre} · 2 min${v.attente ? ' à retardement' : ''}`, reste: 2.2 };
    else if (v.type === 'tirpunition') flash = { mot: `Tir de punition, ${nomDe(v.qui)}`, reste: 2.2 };
    else if (v.type === 'liberation') flash = { mot: `${nomDe(v.qui)} revient`, reste: 1.2 };
    else if (v.type === 'deviation') flash = { mot: `Déviée, ${nomDe(v.qui)}`, reste: 0.9 };
    else if (v.type === 'periode') flash = { mot: etat.match.prolongation ? (etat.match.series ? 'Prolongation' : 'Prolongation, 3 contre 3') : `Fin de la ${v.periode}${v.periode === 1 ? 're' : 'e'} période`, reste: 2.5 };
    else if (v.type === 'fusillade') flash = { mot: 'Tirs de barrage', reste: 2 };
    else if (v.type === 'ronde') flash = { mot: v.but ? `Compté, ${noms[v.equipe]}` : `Raté, ${noms[v.equipe]}`, reste: 1.5 };
    else if (v.type === 'mej') flash = { mot: `Mise en jeu gagnée, ${noms[v.equipe]}`, reste: 0.9 };
    else if (v.type === 'tir') { if (Object.values(etat.controles).includes(v.qui)) flash = { mot: `${Math.round(v.v * 3.6)} km/h${v.uneTemps ? ' · sur réception' : ''}`, reste: 1 }; if (tonJoueur(v.qui)) vibrer(equipeDe(v.qui), 'tir'); }
    else if (v.type === 'echec' && v.fort) { gel = GEL; secousse = { t0: now, dur: 200, amp: 3 }; if (tonJoueur(v.sur)) vibrer(equipeDe(v.sur), 'echecRecu'); if (tonJoueur(v.qui)) vibrer(equipeDe(v.qui), 'echecDonne'); }
    else if (v.type === 'prise' && tonJoueur(v.qui)) vibrer(equipeDe(v.qui), 'prise');
    else if (v.type === 'passe' && tonJoueur(v.qui)) vibrer(equipeDe(v.qui), 'passe');
    else if (v.type === 'harpon' && v.gardien) flash = { mot: `Le harpon de ${nomDe(v.qui)}`, reste: 0.9 };
    else if (v.type === 'harpon' && tonJoueur(v.qui)) vibrer(equipeDe(v.qui), 'harpon');
    else if (v.type === 'remise') trace = [];
    else if (v.type === 'fin') finDuMatch();
  }
  if (flash.reste > 0 && !pause) flash.reste -= dt;
  if (!pause) {
    ambiance(dt);
    for (const s of etat.patineurs) neige(s, now);
  }
  // L'INTERPOLATION : le moteur avance en pas fixes (1/120 s) mais l'écran dessine à la cadence du moniteur ;
  // sans lissage, les sprites sautent d'un pas à l'autre et le patinage paraît haché. On extrapole chaque
  // position du reste de l'accumulateur (au plus 8 ms) pour que le mouvement soit continu entre les pas.
  const r = !pause && etat.reste > 0 ? etat.reste : 0;
  if (r > 0) {
    for (const s of etat.patineurs) { s._ox = s.x; s._oy = s.y; s.x += s.vx * r; s.y += s.vy * r; }
    for (const g of etat.gardiens) { g._ox = g.x; g._oy = g.y; g.x += g.vx * r; g.y += g.vy * r; }
    etat.rondelle._ox = etat.rondelle.x; etat.rondelle._oy = etat.rondelle.y;
    etat.rondelle.x += etat.rondelle.vx * r; etat.rondelle.y += etat.rondelle.vy * r;
  }
  if (!pause) {
    trace.push({ x: etat.rondelle.x, y: etat.rondelle.y });
    if (trace.length > 14) trace.shift();
    camera(dt);
  }
  dessiner(now);
  hud();
  if (r > 0) {
    for (const s of etat.patineurs) { s.x = s._ox; s.y = s._oy; }
    for (const g of etat.gardiens) { g.x = g._ox; g.y = g._oy; }
    etat.rondelle.x = etat.rondelle._ox; etat.rondelle.y = etat.rondelle._oy;
  }
  raf = requestAnimationFrame(boucle);
}
/*
 * LES SONS DU MATCH (js/sons-glace.js) : chaque événement du moteur a son coup, la foule réagit, l'arbitre siffle.
 */
function sonner(v) {
  const M = etat.match;
  if (v.type === 'tir') { coupDeGlace('tir', 0, { v: v.v }); fouleReagit('tir'); }
  else if (v.type === 'passe') coupDeGlace('passe');
  else if (v.type === 'prise' && v.passe) coupDeGlace('reception');
  else if (v.type === 'bande') coupDeGlace('bande', 0, { v: v.v });
  else if (v.type === 'vitre') { coupDeGlace('vitre'); coupDeGlace('sifflet', 0.4); }
  else if (v.type === 'poteau') { coupDeGlace('poteau'); coupDeGlace('ohhh', 0, { double: true }); }
  else if (v.type === 'arret') { if (!v.gele) coupDeGlace('reception'); else coupDeGlace('sifflet', 0.3); coupDeGlace('ohhh', 0, {}); }
  else if (v.type === 'echec' && v.fort) {
    const s = etat.patineurs.find(p => p.id === v.sur);
    const bande = s && (Math.abs(s.x) > L / 2 - 1.6 || Math.abs(s.y) > W / 2 - 1.6);
    coupDeGlace('echec', 0, { fort: true, bande }); fouleReagit('echec');
  }
  else if (v.type === 'gel' || v.type === 'degagement') coupDeGlace('sifflet');
  else if (v.type === 'horsjeu') coupDeGlace('sifflet', 0, { coups: 2 });
  else if (v.type === 'punition' && !v.attente) { coupDeGlace('sifflet', 0, { duree: 0.9 }); coupDeGlace('huees', 0.6); fouleReagit('punition'); }
  else if (v.type === 'tirpunition' || v.type === 'fusillade') coupDeGlace('sifflet', 0, { duree: 0.9 });
  else if (v.type === 'but') {
    const locaux = M && v.equipe === 'B';
    coupDeGlace('sirene', 0.4);
    if (locaux || !M) { coupDeGlace('clameur', 0.2); fouleReagit('butLocaux'); } else { coupDeGlace('ohhh', 0, { grave: true }); fouleReagit('butVisiteurs'); }
  }
  else if (v.type === 'periode') coupDeGlace('sifflet', 0, { duree: 1.2 });
  else if (v.type === 'fin') coupDeGlace('sifflet', 0, { duree: 0.5, coups: 3 });
  else if (v.type === 'mej') coupDeGlace('miseEnJeu');
  else if (v.type === 'harpon') coupDeGlace('harpon');
  else if (v.type === 'deviation') coupDeGlace('passe');
  else if (v.type === 'bloc') coupDeGlace('reception');
}
/* La foule de la soirée : sa base monte avec le moment (la 3e, la prolongation, un pointage serré, les locaux en zone offensive). Les patins ne font aucun son (JP : *pas le bruit de patinage*). */
function ambiance(dt) {
  const M = etat.match;
  let base = 0.18;
  if (M) {
    if (M.periode >= 3 || M.prolongation) base += 0.08;
    if (Math.abs(M.pointage.A - M.pointage.B) <= 1) base += 0.05;
    if (etat.rondelle.x * etat.equipes.B.attaque > BLEUE) base += 0.15;
  }
  ambianceFoule(base, dt);
}
const nomDe = id => { const s = etat.patineurs.find(p => p.id === id); if (s) return s.nom; const g = etat.gardiens.find(x => `G:${x.equipe}` === id); return g ? g.nom : ''; };
/* Un événement du moteur devient une animation : le fouetté du tir, la poussée de la passe, l'impact, le papillon, la lumière, le nom du porteur. */
function animer(v, now) {
  const s = v.qui ? etat.patineurs.find(p => p.id === v.qui) : null;
  if (v.type === 'tir' && s) (s.anim || (s.anim = {})).tir = now;
  else if (v.type === 'passe' && s) (s.anim || (s.anim = {})).passe = now;
  else if (v.type === 'prise' && s && etat.match) {
    const deja = anims.find(a => a.type === 'nom' && a.id === s.id);
    if (deja) deja.t0 = now; else anims.push({ type: 'nom', id: s.id, t0: now, dur: NOM });
  } else if (v.type === 'echec' && v.fort && s) {
    const o = etat.patineurs.find(p => p.id === v.sur);
    anims.push({ type: 'impact', x: o ? (s.x + o.x) / 2 : s.x, y: o ? (s.y + o.y) / 2 : s.y, t0: now, dur: 260 });
  } else if (v.type === 'arret' || v.type === 'gel') {
    const Gd = etat.gardiens.find(g => g.equipe === v.equipe) || etat.gardiens[0];
    // L'ARRÊT se voit (JP : *gardiens qui bougent et font des saves*) : la mitaine ou le bloqueur en haut, le papillon en bas.
    if (Gd) { Gd.anim = now; Gd.animPose = v.haut ? (v.cote > 0 ? 'mitaine' : 'bloqueur') : 'papillon'; }
  } else if (v.type === 'but') {
    const cote = v.cote || (etat.match ? etat.equipes[v.equipe].attaque : 1);
    anims.push({ type: 'lumiere', cote, t0: now, dur: 2500 });
    anims.push({ type: 'flash', t0: now, dur: 350 });
  }
}

function mesurer() {
  if (!canvas) return;
  const r = el.getBoundingClientRect();
  // OLD SCHOOL (JP : *feel plus old school*) : des sprites en pixels entiers sous des lignes de balayage (CSS .sg-crt).
  // La glace est DEBOUT partout (JP : *jeu vertical*), comme à la console.
  const dpr = Math.min(2, window.devicePixelRatio || 1);   // en pixels de l'appareil (deux au plus : la vitesse) : l'échelle de la glace peut être exacte, les sprites restent nets
  taille = { w: r.width, h: r.height, dpr, large: r.width > r.height };
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}

/*
 * La caméra de NHL 94 : la glace debout, TOUTE sa largeur et ses gradins dans la largeur de l'écran, et elle suit la
 * rondelle le long de la patinoire, sans jamais montrer au-delà du bout des gradins. Elle DEVANCE le jeu : un décalage
 * dans la direction de la rondelle, pour que tu voies où tu vas, pas d'où tu viens.
 */
const DEVANCE = 5;      // le décalage maximal vers la direction du jeu, m
const DEVANCE_V = 0.45; // le décalage par m/s de vitesse de la rondelle
/* LA ZONE QUI REMPLIT L'ÉCRAN (JP, 1er et 2 nov. : *la zone offensive doit rentrer dans un écran 16:9 au complet,
   presque pleine largeur* ; *qu'en 16:9, la zone offensive ou défensive remplisse, et adapte la zone neutre aussi*) :
   la glace est taillée pour (js/physique.js) — sa largeur, plus `MARGE_VUE` de bande, en travers d'un écran 16:9, montre
   en long une zone entière ou toute la zone neutre. La caméra prend l'échelle exacte qui le fait, en pixels de
   l'appareil (un pixel de sprite y fait deux pixels ou plus, la glace reste nette) ; sous 2,5, un nombre entier. Elle
   cadre la zone où est la rondelle — la sienne, la neutre ou l'autre —, la bleue et la bande du fond dans l'écran, et
   change de cadre une fois la bleue franchie d'un demi-mètre (sans va-et-vient sur la ligne). Un écran plus long que
   ça (un téléphone debout) en montre plus, et suit la rondelle. */
const MARGE_VUE = 1.4;               // m de plus que la largeur de la glace : la bande, la vitre, un rang de foule
const MARGE_FOND = 0.6;              // m de plus que la zone, en long : la bande du fond
const ZONE = L / 2 - BLEUE;          // la profondeur d'une zone, de la bleue à la bande du fond
function camera(dt) {
  const long = taille.h, court = taille.w, dpr = taille.dpr;
  const kEntier = Math.min(long / (L + 2 * GRADINS), court / (W + 2 * GRADINS));
  const kZone = Math.min(court / (W + MARGE_VUE), long / (ZONE + MARGE_FOND));
  const sd = kZone * dpr * PIXEL;   // les pixels de l'appareil par pixel de sprite
  const k = vueEntiere ? kEntier : sd >= 2.5 ? kZone : Math.max(1, Math.floor(sd)) / (PIXEL * dpr);
  cam.k = k;
  const R = etat.rondelle;
  const f = 1 - Math.exp(-SUIVI * dt);
  const borne = (c, demi, bout) => (demi >= bout ? 0 : Math.max(-bout + demi, Math.min(bout - demi, c)));
  const voit = long / k;
  // garder le segment [a, b] de la glace dans l'écran : le centre entre b − voit/2 et a + voit/2, sinon le milieu
  const garder = (a, b, c) => { const bas = b - voit / 2, haut = a + voit / 2; return bas <= haut ? Math.max(bas, Math.min(haut, c)) : (a + b) / 2; };
  if (R.x > BLEUE + 0.5) cam.zone = 1; else if (R.x < -BLEUE - 0.5) cam.zone = -1; else if (Math.abs(R.x) < BLEUE - 0.5 || cam.zone == null) cam.zone = 0;
  const tx0 = R.x + Math.max(-DEVANCE, Math.min(DEVANCE, R.vx * DEVANCE_V));
  const tx = cam.zone ? cam.zone * garder(BLEUE - 0.4, L / 2 + MARGE_FOND, tx0 * cam.zone) : garder(-(BLEUE + 0.4), BLEUE + 0.4, tx0);
  cam.x += (tx - cam.x) * f;
  // toute la largeur tient dans l'écran : la glace reste centrée, elle ne glisse plus de côté
  const ty = court / k >= W + 0.6 ? 0 : R.y + Math.max(-DEVANCE, Math.min(DEVANCE, R.vy * DEVANCE_V));
  cam.y += (ty - cam.y) * f;
  cam.x = borne(cam.x, long / (2 * k), L / 2 + GRADINS);
  cam.y = borne(cam.y, court / (2 * k), W / 2 + GRADINS);
}
/* L'origine de la glace à l'écran, arrondie au pixel : la glace et les sprites tombent sur la même grille, sans scintiller. */
const origine = () => ({ e: Math.round(taille.w / 2 - cam.y * cam.k + tremble.x), f: Math.round(taille.h / 2 + cam.x * cam.k + tremble.y) });
const ecran = (x, y) => { const o = origine(); return { x: o.e + y * cam.k, y: o.f - x * cam.k }; };
/* Le repère de la glace sur le canevas : le centre de l'écran (et la secousse), le quart de tour, l'échelle, la caméra. */
function repereGlace() {
  const o = origine(), k = cam.k * taille.dpr;
  cx.setTransform(0, -k, k, 0, o.e * taille.dpr, o.f * taille.dpr);
}

/* ---------- le dessin ---------- */
function cercle(x, y, r, remplir, trait, large) {
  cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2);
  if (remplir) { cx.fillStyle = remplir; cx.fill(); }
  if (trait) { cx.strokeStyle = trait; cx.lineWidth = large || 0.05; cx.stroke(); }
}
/*
 * LA GLACE EN 16 BITS (JP, 1er nov. : *glace et cie plus 16-bit*). La patinoire, la bande, la baie vitrée, les gradins,
 * la foule, les filets et l'écusson du centre sont rendus UNE fois, pixel par pixel, à la résolution des sprites
 * (`PIXEL` : quatorze pixels par mètre), dans une palette courte et tramée (la matrice de Bayer, comme les dégradés de
 * la Super Nintendo) ; le canevas les agrandit d'un nombre entier de pixels, sans lissage, sur la même grille que les
 * joueurs. Deux images : la foule assise, la foule debout (elle saute sur un but).
 */
const PAL = {
  glace: ['#eef4f9', '#e2ebf3', '#d3e0ec', '#c3d3e3'],   // du plus clair au plus sombre : la glace, l'ombre de la bande
  rouge: '#c8102e', rougeSombre: '#8e0b21', bleu: '#1c4db5', bleuSombre: '#123479',
  enclave: '#8fc1ec', enclaveClair: '#a9d0f1',
  plinthe: '#e9bb1c', plintheSombre: '#a9850f', bande: '#f3f2ec', bandeOmbre: '#d7d6cf', lisse: '#24272f',
  vitre: '#a7c2d3', vitreSombre: '#86a3b6', gradin: '#191b22', gradinRang: '#23262f', banc: '#26304a', bancBois: '#5b3d22',
  maille: '#f5f6f8', mailleSombre: '#c4cad3',
  peau: ['#f0c8a0', '#c99268', '#8d5a3c'], fouleNeutre: ['#2c3140', '#4a4f5c', '#7a7466', '#b9b2a4', '#ddd6c8'],
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const VITRE = { plinthe: 0.14, bande: 0.43, lisse: 0.57, vitre: 0.85 };   // de la glace vers les gradins, m
const PUB = 4.5;   // la longueur d'un panneau sur la bande, m
let fond = null;   // { cle, images: [assise, debout], nx, ny }
const hex = c => { const v = parseInt(c.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
/* La distance signée au bord de la glace (le rectangle aux coins arrondis) : négative dedans. */
function horsGlace(x, y) {
  const qx = Math.abs(x) - (L / 2 - COIN), qy = Math.abs(y) - (W / 2 - COIN);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - COIN;
}
/* Un bruit doux semé (des valeurs sur une grille d'un mètre, interpolées) : la glace n'est jamais d'un seul ton. */
const hache = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function bruitDoux(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const l = (a, b, t) => a + (b - a) * t * t * (3 - 2 * t);
  return l(l(hache(i, j), hache(i + 1, j), fx), l(hache(i, j + 1), hache(i + 1, j + 1), fx), fy);
}
function fondDeGlace() {
  const logo = ecusson && ecusson.im.complete && ecusson.im.naturalWidth ? ecusson.code : '';
  const cle = `${couleurs.A.bg}|${couleurs.B.club || couleurs.B.bg}|${logo}`;
  if (fond && fond.cle === cle) return fond;
  const n = Math.round(1 / PIXEL);
  const nx = 2 * Math.ceil((L / 2 + GRADINS) * n), ny = 2 * Math.ceil((W / 2 + GRADINS) * n);
  const c0 = document.createElement('canvas'); c0.width = nx; c0.height = ny;
  const g = c0.getContext('2d');
  const img = g.createImageData(nx, ny), d = img.data;
  const C = {};
  for (const [k, v] of Object.entries(PAL)) C[k] = Array.isArray(v) ? v.map(hex) : hex(v);
  const pubs = [hex(couleurs.A.bg), hex(couleurs.B.club || couleurs.B.bg), hex('#1d2230'), hex('#f0c419')];
  const X = L / 2, Y = W / 2, demi = FILET.large / 2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (i + 0.5 - nx / 2) / n, y = (j + 0.5 - ny / 2) / n, bayer = BAYER[(j & 3) * 4 + (i & 3)];
    const h = horsGlace(x, y);
    let col;
    if (h < 0) {
      // LA GLACE : quatre tons tramés, un bruit doux, l'ombre de la bande sur le premier mètre.
      const ombre = Math.max(0, 1 + h / 0.9);
      const t = clampN(0.35 + (bruitDoux(x / 3, y / 3) - 0.5) * 0.9 + ombre * 1.6, 0, 2.99);
      col = C.glace[Math.floor(t) + (t % 1 > bayer ? 1 : 0)] || C.glace[3];
      const ax = Math.abs(x), ay = Math.abs(y), px = 1 / n;
      const anneau = (cx0, cy0, r, ep) => Math.abs(Math.hypot(x - cx0, y - cy0) - r) < ep;
      const dansEnclave = ax < LIGNE_BUT && ax > LIGNE_BUT - FILET.enclave && Math.hypot(ax - LIGNE_BUT, y) < FILET.enclave;
      if (dansEnclave) col = Math.hypot(ax - LIGNE_BUT, y) > FILET.enclave - 2 * px ? C.rouge : bayer < 0.3 ? C.enclaveClair : C.enclave;
      // Les lignes : la rouge du centre et les bleues (quatre pixels, bordées d'un pixel sombre), les lignes des buts.
      if (ax < 0.15) col = ax > 0.15 - px ? C.rougeSombre : C.rouge;
      if (Math.abs(ax - BLEUE) < 0.15) col = Math.abs(ax - BLEUE) > 0.15 - px ? C.bleuSombre : C.bleu;
      if (Math.abs(ax - LIGNE_BUT) < px && ay < Y - 0.4) col = C.rouge;
      // Les cercles et les points.
      if (anneau(0, 0, POINT.r, px)) col = C.bleu;
      if (Math.hypot(x, y) < 0.16) col = C.bleu;
      for (const sx of [1, -1]) for (const sy of [1, -1]) {
        if (anneau(sx * POINT.x, sy * POINT.y, POINT.r, px)) col = C.rouge;
        // les traits de mise en jeu, de chaque côté du cercle
        const dx = Math.abs(x - sx * POINT.x), dy = Math.abs(y - sy * POINT.y);
        if (dx > 0.3 && dx < 0.3 + 2 * px && dy > POINT.r - 0.05 && dy < POINT.r + 0.6) col = C.rouge;
        if (Math.hypot(x - sx * POINT.x, y - sy * POINT.y) < 0.3) col = C.rouge;
        if (Math.hypot(x - sx * POINT.neutre, y - sy * POINT.y) < 0.3) col = C.rouge;
      }
    } else if (h < VITRE.plinthe) col = h < 1.5 / n ? C.plintheSombre : C.plinthe;
    else if (h < VITRE.bande) {
      // LA BANDE et ses panneaux, aux couleurs des deux clubs.
      const long = Math.abs(y) > Y - COIN / 2 && Math.abs(x) < X - COIN ? x : Math.abs(x) > X - COIN / 2 && Math.abs(y) < Y - COIN ? y : null;
      const k = long == null ? -1 : Math.floor((long + 100) / PUB);
      const dansPanneau = long != null && ((long + 100) % PUB) > 0.5 && ((long + 100) % PUB) < PUB - 0.5 && h > VITRE.plinthe + 1.5 / n && h < VITRE.bande - 1.5 / n;
      col = dansPanneau && k % 2 === 0 ? pubs[(k >> 1) % pubs.length] : h > VITRE.bande - 1.5 / n ? C.bandeOmbre : C.bande;
    } else if (h < VITRE.lisse) col = C.lisse;
    else if (h < VITRE.vitre) col = bayer < 0.5 ? C.vitre : C.vitreSombre;
    else {
      // LES GRADINS : des rangées de marches ; les bancs et les cachots le long d'un côté.
      const rang = Math.floor((h - VITRE.vitre) / 0.62);
      col = (h - VITRE.vitre) % 0.62 < 1.5 / n ? C.gradinRang : C.gradin;
      const banc = y > Y && h < VITRE.vitre + 1.6 && ((x > -14 && x < -2) || (x > 2 && x < 14));
      const cachot = y < -Y && h < VITRE.vitre + 1.6 && ((x > -5 && x < -1) || (x > 1 && x < 5));
      if (banc || cachot) col = h < VITRE.vitre + 0.5 ? C.bancBois : C.banc;
      if (rang > 6) col = C.gradin;
    }
    // LES FILETS : la maille en damier, le cadre rouge, posés sur la ligne des buts.
    const fx = Math.abs(x) - LIGNE_BUT;
    if (fx > 0 && fx < FILET.profond && Math.abs(y) < demi) {
      const bord = fx > FILET.profond - 2 / n || Math.abs(y) > demi - 2 / n;
      col = bord ? C.rouge : ((i + j) & 1 ? C.maille : C.mailleSombre);
    }
    const o = (j * nx + i) * 4;
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // L'ÉCUSSON DES LOCAUX au centre (JP : *logo de l'équipe à domicile dans le centre de la glace*), à la résolution des
  // sprites, droit pour qui regarde l'écran (la glace est tournée d'un quart de tour).
  if (logo) {
    const t = Math.round(6.4 * n);
    const pt = document.createElement('canvas'); pt.width = t; pt.height = t;
    const pg = pt.getContext('2d'); pg.imageSmoothingEnabled = true; pg.drawImage(ecusson.im, 0, 0, t, t);
    g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = 0.5;
    g.translate(nx / 2, ny / 2); g.rotate(Math.PI / 2); g.drawImage(pt, -t / 2, -t / 2);
    g.restore();
  }
  // LA FOULE, en têtes de quatre pixels : une image assise, une debout (les partisans du but se lèvent).
  const images = [c0, document.createElement('canvas')];
  images[1].width = nx; images[1].height = ny;
  images[1].getContext('2d').drawImage(c0, 0, 0);
  const pas = 7;   // une place tous les demi-mètres
  for (let j = 0; j < ny; j += pas) for (let i = 0; i < nx; i += pas) {
    const x = (i + 3.5 - nx / 2) / n, y = (j + 3.5 - ny / 2) / n, h = horsGlace(x, y);
    if (h < VITRE.vitre + 0.3 || h > VITRE.vitre + 0.62 * 6.6) continue;
    if (y > W / 2 && h < VITRE.vitre + 1.6 && Math.abs(x) < 14) continue;   // les bancs
    if (y < -W / 2 && h < VITRE.vitre + 1.6 && Math.abs(x) < 5) continue;   // les cachots
    const r = hache(i, j);
    if (r < 0.12) continue;   // un siège vide
    const chandail = r < 0.32 ? couleurs.A.bg : r < 0.55 ? (couleurs.B.club || couleurs.B.bg) : PAL.fouleNeutre[Math.floor(hache(j, i) * PAL.fouleNeutre.length)];
    const peau = PAL.peau[Math.floor(hache(i + 7, j) * PAL.peau.length)];
    // vers la glace : l'axe le plus court jusqu'à elle
    const versX = Math.abs(x) - (L / 2 - COIN) > Math.abs(y) - (W / 2 - COIN) ? -Math.sign(x) : 0, versY = versX ? 0 : -Math.sign(y);
    for (let v = 0; v < 2; v++) {
      const gg = images[v].getContext('2d');
      const leve = v === 1 && r > 0.32 ? 2 : 0;   // debout : les partisans des locaux (et les neutres) se lèvent
      const ox = i + 1 + versX * leve, oy = j + 1 + versY * leve;
      gg.fillStyle = chandail; gg.fillRect(ox - versX * 2, oy - versY * 2, 4, 4);
      gg.fillStyle = peau; gg.fillRect(ox + 1, oy, 2, 4); gg.fillRect(ox, oy + 1, 4, 2);
      gg.fillStyle = 'rgba(255,255,255,0.35)'; gg.fillRect(ox + 1, oy + 1, 1, 1);
      if (v === 1 && leve && r > 0.8) { gg.fillStyle = peau; gg.fillRect(ox + versX * 3 + 1, oy + versY * 3 + 1, 1, 1); }   // un bras en l'air
    }
  }
  fond = { cle, images, nx, ny };
  return fond;
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
/* La glace À L'ÉCHELLE DE L'ÉCRAN : agrandie et tournée une fois (à chaque changement d'échelle), pour qu'une image ne
   fasse qu'une copie un pour un, en pixels de l'appareil — rien à agrandir soixante fois par seconde. */
let fondEcran = null;   // { cle, images: [assise, debout], w, h }
function glaceALEchelle() {
  const f = fondDeGlace(), n = Math.round(1 / PIXEL), kd = cam.k * taille.dpr;
  const cle = `${f.cle}|${kd}`;
  if (fondEcran && fondEcran.cle === cle && fondEcran.source === f) return fondEcran;
  const w = Math.round(f.ny / n * kd), h = Math.round(f.nx / n * kd);
  const images = f.images.map(im => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.setTransform(0, -kd, kd, 0, w / 2, h / 2);
    g.drawImage(im, -f.nx / (2 * n), -f.ny / (2 * n), f.nx / n, f.ny / n);
    return c;
  });
  fondEcran = { cle, source: f, images, w, h };
  return fondEcran;
}
function patinoire() {
  const f = glaceALEchelle(), o = origine(), dpr = taille.dpr;
  const but = anims.find(a => a.type === 'lumiere');
  const debout = but && Math.sin((performance.now() - but.t0) / 110) > 0;
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.drawImage(f.images[debout ? 1 : 0], Math.round(o.e * dpr - f.w / 2), Math.round(o.f * dpr - f.h / 2));
  repereGlace();
  // La lumière du but, derrière chaque filet : rouge et qui clignote après un but.
  for (const s of [1, -1]) {
    const lum = anims.find(a => a.type === 'lumiere' && a.cote === s);
    const allumee = lum && Math.sin((performance.now() - lum.t0) / 90) > 0;
    const x0 = s * (LIGNE_BUT + FILET.profond + 0.9);
    cx.fillStyle = COULEURS.bande; cx.fillRect(x0 - 0.36, -0.36, 0.72, 0.72);
    cx.fillStyle = allumee ? COULEURS.lumiere : COULEURS.lampe; cx.fillRect(x0 - 0.22, -0.22, 0.44, 0.44);
  }
  ecussonDuCentre();
}
/* L'écusson des locaux se charge une fois ; la glace se refait quand il arrive. */
let ecusson = null;   // { code, im }
function ecussonDuCentre() {
  const code = etat.match && etat.equipes.B.tag;
  if (!code || !ctxJeu.logoLocal(code)) return;
  if (!ecusson || ecusson.code !== code) { const im = new Image(); im.src = `img/logos/${code}.svg`; ecusson = { code, im }; }
}

/*
 * LES JOUEURS PLUS GROS QUE NATURE (JP, 2 nov. : *tu peux aussi juste grossir les joueurs*) : la zone remplit l'écran,
 * et les joueurs sont dessinés `GROS` fois leur taille, comme dans les jeux 16 bits. Rien que de l'image : le moteur
 * garde ses corps ; la rondelle portée se dessine à la lame du sprite (`rondelleVue`), le reste à sa place.
 */
const GROS = 1.5;
/* L'échelle d'un sprite à l'écran : un nombre entier de pixels de l'appareil par pixel de sprite ; `gros` faux, celle de la glace (la rondelle). */
const echelle = (gros = true) => Math.max(1, Math.round(cam.k * PIXEL * (gros ? GROS : 1) * taille.dpr)) / taille.dpr;
/* La rondelle portée, vue à la lame du sprite grossi : un décalage qui la suit en douceur, et revient à zéro quand elle part. */
let rondelleVue = { x: 0, y: 0, t: 0 };
function decalageRondelle(now) {
  const R = etat.rondelle, p = R.porteur && etat.patineurs.find(q => q.id === R.porteur);
  const lm = p && lame(p);
  const cible = lm ? { x: (lm.x - p.x) * (GROS - 1), y: (lm.y - p.y) * (GROS - 1) } : { x: 0, y: 0 };
  const f = 1 - Math.exp(-Math.min(0.1, (now - (rondelleVue.t || now)) / 1000) / 0.05);
  rondelleVue = { x: rondelleVue.x + (cible.x - rondelleVue.x) * f, y: rondelleVue.y + (cible.y - rondelleVue.y) * f, t: now };
  return rondelleVue;
}
/* L'angle d'un cap sur l'écran (y vers le bas) : debout, la glace est tournée d'un quart de tour. */
const angleEcran = cap => cap - Math.PI / 2;
/* La direction d'un cap, en huitièmes de tour de l'écran (0 = vers la droite), ou en quarts pour le gardien. */
const directionDe = (cap, n = DIRECTIONS) => ((Math.round(angleEcran(cap) / (2 * Math.PI) * n) % n) + n) % n;
/* Le corps, en pixels d'écran : son sprite dans sa pose et sa direction, les patins au point du patineur, aligné sur la grille, sans lissage. */
function corps(x, y, eq, genre, pose, dir) {
  const im = spriteDe(eq, genre, pose, dir);
  const S = echelle(), p = ecran(x, y);
  cx.imageSmoothingEnabled = false;
  cx.drawImage(im, Math.round(p.x) - ANCRE[0] * S, Math.round(p.y) - ANCRE[1] * S, LARGEUR * S, HAUTEUR * S);
}

/*
 * LES ANIMATIONS (JP : *animations, etc.*) : la foulée du sprite, le bâton qui se charge en arrière et fouette en
 * avant au tir, la poussée de la passe, l'allongé du harpon, la chute (le sprite couché, le bâton par terre),
 * l'étoile d'un impact et l'arrêt sur image, la secousse de l'écran, le papillon du gardien, la lumière du but et
 * le flash, la rondelle qui tombe à la mise en jeu, le nom du porteur à la prise.
 */
/* Sous les patineurs, sur la glace (en mètres) : l'anneau de celui que tu contrôles, l'arc de la charge. */
const MARQUE = { rayon: 0.62, sol: 0.72 };   // l'ellipse de ton joueur, m ; raccourcie en travers de l'écran comme la profondeur du sol des sprites (PROFONDEUR de scripts/sprites/rendu.mjs)
function marques(s) {
  const toi = Object.values(etat.controles).includes(s.id);
  // TON JOUEUR : une ellipse au sol, aux couleurs de son club, sous ses patins (JP : *gros rond ombre en dessous, couleur de
  // l'équipe*) ; à plat comme le sol des sprites (`MARQUE`), et à moitié transparente : le joueur, lui, reste devant.
  if (toi) {
    const c = couleurs[s.equipe];
    cx.beginPath(); cx.ellipse(s.x, s.y, MARQUE.rayon * MARQUE.sol * GROS, MARQUE.rayon * GROS, 0, 0, Math.PI * 2);
    cx.globalAlpha = 0.6; cx.fillStyle = c.club || c.bg; cx.fill();
    cx.globalAlpha = 1; cx.strokeStyle = COULEURS.contour; cx.lineWidth = 0.08; cx.stroke();
  }
  if (s.charge > 0 && etat.rondelle.porteur === s.id) {
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.09;
    cx.beginPath(); cx.arc(s.x, s.y, s.rayon * GROS + 0.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.charge / BATON.charge)); cx.stroke();
  }
}
/* Un patineur, en pixels d'écran : sa pose du moment (la chute, le lancer, la passe, l'épaule, la foulée, le repos). */
function patineur(s, now) {
  const v = Math.hypot(s.vx, s.vy);
  const anim = s.anim || (s.anim = {});
  const dir = directionDe(s.auSol > 0 && v > 0.3 ? Math.atan2(s.vy, s.vx) : s.cap);
  let pose = 'repos';
  if (s.auSol > 0) pose = 'chute';
  else if (anim.tir && now - anim.tir < 320) pose = 'tir';
  else if (s.charge > 0 && etat.rondelle.porteur === s.id) pose = 'charge';
  else if (anim.passe && now - anim.passe < 240) pose = 'passe';
  else if (s.elan > 0) pose = 'echec';
  else if (s.freine && v > 1.5) pose = 'freinage';   // L'ARRÊT HOCKEY : les lames en travers
  else if (Math.abs(s.virage) > VIRAGE_PENCHE && v > VIRAGE_VITESSE) pose = s.virage > 0 ? 'virageD' : 'virageG';   // couché dans la courbe
  else if (s.pousse > 0.1 && v > 0.3) pose = `patin${1 + Math.floor(s.foulee * FOULEES) % FOULEES}`;   // LA FOULÉE : la phase du moteur, la jambe tendue au coup de patin
  else if (v > 1.2) pose = 'glisse';   // il ne pousse plus : les deux lames sur la glace
  corps(s.x, s.y, s.equipe, 'P', pose, dir);
}
/* LA NEIGE (JP : *ça feel zéro comme patiner*) : un arrêt hockey, ou un virage sec à vitesse, fait gicler la glace
   des lames devant le patineur, en grains blancs qui s'éteignent. Rien que de l'image : le moteur n'en sait rien. */
const NEIGE = { duree: 0.35, grain: 0.11, vitesse: 4.5 };
function neige(s, now) {
  const v = Math.hypot(s.vx, s.vy);
  const fort = s.surGlace && !s.auSol && (s.freine && v > 3 ? 1 : Math.abs(s.virage) > 2.2 && v > 6 ? 0.5 : 0);
  if (!fort) return;
  const a0 = Math.atan2(s.vy, s.vx);
  for (let k = 0; k < 3; k++) {
    const a = a0 + (Math.random() - 0.5) * 1.6, w = NEIGE.vitesse * fort * (0.5 + Math.random());
    anims.push({ type: 'neige', t0: now, dur: NEIGE.duree * 1000 * (0.6 + 0.6 * Math.random()), x: s.x + Math.cos(a0) * 0.3, y: s.y + Math.sin(a0) * 0.3, vx: Math.cos(a) * w + s.vx * 0.3, vy: Math.sin(a) * w + s.vy * 0.3 });
  }
}
/* LE RECEVEUR : quand tu portes la rondelle, l'anneau jaune dit à qui la passe irait ; pointillé, la ligne est barrée (elle sera soulevée). */
function receveur() {
  for (const eq of etat.humains) {
    const ctl = etat.controles[eq];
    if (!ctl || etat.rondelle.porteur !== ctl) continue;
    const toi = etat.patineurs.find(p => p.id === ctl);
    const r = toi && receveurDePasse(etat, toi, batons[eq]);
    if (!r || !r.vers) continue;
    cx.strokeStyle = COULEURS.passe; cx.lineWidth = 0.1;
    if (r.barree) cx.setLineDash([0.2, 0.2]);
    cx.beginPath(); cx.arc(r.vers.x, r.vers.y, r.vers.rayon * GROS + 0.22, 0, Math.PI * 2); cx.stroke();
    cx.setLineDash([]);
  }
}

function gardien(Gd, now) {
  if (Gd.retire) return;
  const R = etat.rondelle;
  // LE PAPILLON : les jambières à plat sur un arrêt, un demi-seconde ; sinon la garde, tourné vers la rondelle.
  const arret = Gd.anim && now - Gd.anim < 450;
  corps(Gd.x, Gd.y, Gd.equipe, 'G', arret ? Gd.animPose || 'papillon' : 'garde', directionDe(Math.atan2(R.y - Gd.y, R.x - Gd.x), 4));
}

function dessiner(now) {
  const { w, h, dpr } = taille;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = COULEURS.noir; cx.fillRect(0, 0, w, h);
  // LA SECOUSSE : l'écran tremble sur un but, une barre, une mise en échec qui renverse.
  tremble = { x: 0, y: 0 };
  if (secousse && now - secousse.t0 < secousse.dur) {
    const f = 1 - (now - secousse.t0) / secousse.dur;
    tremble = { x: Math.round(Math.sin(now / 7) * secousse.amp * f), y: Math.round(Math.cos(now / 9) * secousse.amp * f) };
  }
  repereGlace();
  patinoire();
  const R = etat.rondelle;
  if (trace.length > 1) {
    cx.strokeStyle = COULEURS.trace; cx.lineWidth = 0.08; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(trace[0].x, trace[0].y); for (const p of trace) cx.lineTo(p.x, p.y); cx.stroke();
  }
  receveur();
  cx.fillStyle = COULEURS.blanc;
  for (const a of anims) {
    if (a.type !== 'neige') continue;
    const t = (now - a.t0) / 1000, f = 1 - (now - a.t0) / a.dur;
    if (f <= 0) continue;
    cx.globalAlpha = 0.9 * f;
    cx.fillRect(a.x + a.vx * t - NEIGE.grain / 2, a.y + a.vy * t - NEIGE.grain / 2, NEIGE.grain, NEIGE.grain);
  }
  cx.globalAlpha = 1;
  for (const s of etat.patineurs) if (s.surGlace || s.boxe) marques(s);
  // LA RONDELLE : à la mise en jeu, elle tombe ; en l'air, elle grossit et laisse son ombre au sol.
  const chute = etat.mej ? Math.max(0, etat.mej.reste / 0.9) : 0;
  const z = Math.max(chute * 0.6, Math.min(1.5, R.z || 0));
  // En pixels de sprite, sur la grille : quatre de large, trois de haut, un reflet ; en l'air, elle grossit et son ombre reste au sol.
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const dv = decalageRondelle(now), S = echelle(false), sol = ecran(R.x + dv.x, R.y + dv.y), haut = ecran(R.x + dv.x + z * 0.5, R.y + dv.y);
  const lw = S * (4 + Math.round(z * 2)), lh = S * (3 + Math.round(z * 2));
  if (z > 0) { cx.fillStyle = COULEURS.ombre; cx.fillRect(Math.round(sol.x - lw / 2), Math.round(sol.y - lh / 2), lw, lh); }
  cx.fillStyle = COULEURS.rondelle; cx.fillRect(Math.round(haut.x - lw / 2), Math.round(haut.y - lh / 2), lw, lh);
  cx.fillStyle = COULEURS.reflet; cx.fillRect(Math.round(haut.x - lw / 2) + S, Math.round(haut.y - lh / 2), S, S);
  // LES CORPS, en pixels d'écran, du fond de l'écran vers l'avant (le plus bas à l'écran par-dessus).
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const corpsAVoir = [...etat.gardiens.filter(g => !g.retire).map(g => ({ y: ecran(g.x, g.y).y, g })), ...etat.patineurs.filter(s => s.surGlace || s.boxe).map(s => ({ y: ecran(s.x, s.y).y, s }))].sort((a, b) => a.y - b.y);
  for (const c of corpsAVoir) { if (c.g) gardien(c.g, now); else patineur(c.s, now); }
  repereGlace();
  // LES ÉTOILES D'IMPACT.
  for (const a of anims) {
    if (a.type !== 'impact') continue;
    const f = 1 - (now - a.t0) / a.dur;
    cx.strokeStyle = COULEURS.blanc; cx.lineWidth = 0.08; cx.globalAlpha = f;
    for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4; cx.beginPath(); cx.moveTo(a.x + Math.cos(ang) * 0.3, a.y + Math.sin(ang) * 0.3); cx.lineTo(a.x + Math.cos(ang) * (0.5 + (1 - f) * 1.2), a.y + Math.sin(ang) * (0.5 + (1 - f) * 1.2)); cx.stroke(); }
    cx.globalAlpha = 1;
  }
  // LE NOM DU PORTEUR, une seconde à la prise, en pixels, au-dessus de lui.
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const a of anims) {
    if (a.type !== 'nom') continue;
    const s = etat.patineurs.find(p => p.id === a.id);
    if (!s || !s.surGlace) continue;
    const f = Math.min(1, (a.dur - (now - a.t0)) / 250);
    const p = ecran(s.x, s.y);
    cx.font = `400 11px "Bungee", monospace`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    const mot = s.nom.toUpperCase(), lw = cx.measureText(mot).width + 10;
    const nx = Math.max(lw / 2 + 8, Math.min(w - lw / 2 - 8, p.x));   // l'étiquette reste dans l'écran, à 8 px des bords
    cx.globalAlpha = f;
    cx.fillStyle = couleurs[s.equipe].bg; cx.fillRect(Math.round(nx - lw / 2), Math.round(p.y - s.rayon * GROS * cam.k - 24), Math.round(lw), 16);
    cx.fillStyle = couleurs[s.equipe].ink; cx.fillText(mot, Math.round(nx), Math.round(p.y - s.rayon * GROS * cam.k - 16));
    cx.globalAlpha = 1;
  }
  // LE FLASH DU BUT, sur tout l'écran.
  const flashBut = anims.find(a => a.type === 'flash');
  if (flashBut) {
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
  if (!pause) anims = anims.filter(a => now - a.t0 < a.dur);
}
/* Le radar : toute la glace, en petit, dans le coin du bas à droite ; debout ou couchée, comme l'écran. */
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
  cx.fillRect(Math.min(cx1, cx2) - 0.5, Math.min(cy1, cy2) - 0.5, Math.abs(cx2 - cx1) + 1, Math.abs(cy2 - cy1) + 1);
  const controles = Object.values(etat.controles);
  for (const s of etat.patineurs) {
    if (!s.surGlace) continue;
    const [px, py] = pt(s.x, s.y);
    const toi = controles.includes(s.id);
    cx.fillStyle = couleurs[s.equipe].bg; cx.beginPath(); cx.arc(px, py, toi ? 3.2 : 2.2, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = toi ? COULEURS.blanc : couleurs[s.equipe].epaule; cx.lineWidth = 1; cx.stroke();
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
    const per = M.ronde && M.ronde.genre === 'punition' ? 'TP' : M.fusillade ? 'TB' : M.prolongation ? 'Prol.' : `P${M.periode}`;
    const punis = M.penalites.map(p => `<span class="sg-puni" style="--eq:${couleurs[p.equipe].bg}">${esc(nomDe(p.id))} ${horloge(p.reste)}</span>`).join('')
      + etat.gardiens.filter(g => g.retire).map(g => `<span class="sg-puni" style="--eq:${couleurs[g.equipe].bg}">Filet désert</span>`).join('');
    const html = `<span class="sg-club" style="--eq:${couleurs.A.bg};--eq-ink:${couleurs.A.ink}">${esc(etat.equipes.A.tag)}</span><b>${M.pointage.A}</b>
      <span class="sg-temps">${M.fusillade && !M.tirDePunition ? `Ronde ${M.fusillade.ronde}` : horloge(M.reste)}<small>${per} · tirs ${M.tirs.A}–${M.tirs.B}</small></span>
      <b>${M.pointage.B}</b><span class="sg-club" style="--eq:${couleurs.B.bg};--eq-ink:${couleurs.B.ink}">${esc(etat.equipes.B.tag)}</span>${punis}`;
    if (T.dataset.html !== html) { T.innerHTML = html; T.dataset.html = html; }
  } else {
    const c = etat.compte;
    T.textContent = `Tirs ${c.tirs} · Buts ${c.buts} · Arrêts ${c.arrets}${c.poteaux ? ` · Poteaux ${c.poteaux}` : ''}`;
  }
  // LA BARRE DU NOM : la face et le nom de ton patineur (ceux des deux, à deux), sa vitesse, ses jambes quand elles baissent.
  const V = el.querySelector('.sg-vitesse');
  const barres = etat.humains.map(eq => {
    const toi = etat.patineurs.find(p => p.id === etat.controles[eq]);
    if (!toi) return '';
    return `<span class="sg-nom" style="--eq:${couleurs[eq].bg}">${mug(toi.visage)}<span>${esc(toi.nom)} · ${Math.round(Math.hypot(toi.vx, toi.vy) * 3.6)} km/h${!M && etat.dernierTir ? ` · dernier tir ${Math.round(etat.dernierTir * 3.6)} km/h` : ''}${M && toi.jambes < 60 ? ` · jambes ${Math.round(toi.jambes)}` : ''}</span></span>`;
  }).join('');
  if (V.dataset.html !== barres) { V.innerHTML = barres; V.dataset.html = barres; }
  const toi = etat.patineurs.find(p => p.id === etat.controles[etat.humains[0]]);
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
  const porte = toi && etat.rondelle.porteur === toi.id;
  dg.querySelector('[data-doigt="passe"]').textContent = porte ? 'Passe' : etat.mej ? 'Mise' : 'Passe';
  dg.querySelector('[data-doigt="tir"]').textContent = porte ? 'Tir' : 'Harpon';
  dg.querySelector('[data-doigt="echec"]').textContent = porte ? 'Turbo' : 'Échec';
}
function finDuMatch() {
  if (enfin || !etat.match) return;
  enfin = true;
  const M = etat.match;
  const F = el.querySelector('.sg-fin');
  const ligne = (mot, a, b) => `<tr><td>${a}</td><th>${mot}</th><td>${b}</td></tr>`;
  const quand = j => j.fusillade ? 'tirs de barrage' : `${j.punition ? 'tir de punition · ' : ''}${j.periode > 3 ? 'prol.' : `P${j.periode}`} ${horloge(j.reste)}`;
  const buts = M.journal.map(j => `<li><span style="--eq:${couleurs[j.equipe].bg}">${esc(etat.equipes[j.equipe].tag)}</span> ${esc(j.qui ? nomDe(j.qui) : 'but')}${j.aides && j.aides.length ? ` <small>(${esc(j.aides.map(nomDe).join(', '))})</small>` : ''} · ${quand(j)}</li>`).join('');
  const statsDe = e => e.gardien ? `${e.stats.arrets} arrêts` : [e.stats.buts ? `${e.stats.buts} B` : '', e.stats.aides ? `${e.stats.aides} A` : '', `${e.stats.tirs} tirs`, e.stats.echecs ? `${e.stats.echecs} MÉ` : ''].filter(Boolean).join(' · ');
  const etoiles = M.etoiles.map((e, i) => `<li><b>${'★'.repeat(i + 1)}</b>${mug(e.visage)}<span style="--eq:${couleurs[e.equipe].bg}">${esc(etat.equipes[e.equipe].tag)}</span> ${esc(e.nom)} <small>${esc(statsDe(e))}</small></li>`).join('');
  F.innerHTML = `<div class="sg-fin-carte">
    <h2>${esc(noms[M.vainqueur])} l'emporte</h2>
    <div class="sg-fin-score"><span style="--eq:${couleurs.A.bg};--eq-ink:${couleurs.A.ink}">${esc(etat.equipes.A.tag)}</span><b>${M.pointage.A} – ${M.pointage.B}</b><span style="--eq:${couleurs.B.bg};--eq-ink:${couleurs.B.ink}">${esc(etat.equipes.B.tag)}</span></div>
    <table class="sg-fin-stats"><tbody>${ligne('Tirs', M.tirs.A, M.tirs.B)}${ligne('Tirs bloqués', M.blocs.A, M.blocs.B)}${ligne('Mises en échec', M.echecs.A, M.echecs.B)}${ligne('Mises en jeu', M.mej.A, M.mej.B)}${ligne('Minutes de punition', M.pim.A, M.pim.B)}</tbody></table>
    ${etoiles ? `<h3 class="sg-fin-t">Les trois étoiles</h3><ol class="sg-fin-etoiles">${etoiles}</ol>` : ''}
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
