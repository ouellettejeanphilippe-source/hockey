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
import { nouvelleGlace, nouveauMatch, avancer, remise, reglesDeLaGlace, lame, parametresDuPatineur, parametresDuGardien, receveurDePasse, retirerGardien, DIFFICULTES, L, W, COIN, LIGNE_BUT, BLEUE, POINT, FILET, BATON, RONDELLE } from './physique.js';
import { decisionIA } from './glace-ia.js';
import { PATINEURS, GARDIENS, LARGEUR, HAUTEUR, ANCRE } from './sprites.js';
import { nouvelleGraine, entierDeGraine, autoRoster, copieDeJoueur, SLOTS } from './sim.js';
import { axes20, cote20 } from './niveaux.js';
import { getTraits } from './traits.js';
import { nomCourt } from './recit.js';
import { coupDeGlace, fouleReagit, ambianceFoule, crissement, couperLaGlace } from './sons-glace.js';
import { esc, estD } from './util.js';

const GRADINS = 3.2;     // la caméra montre TOUTE LA LARGEUR de la glace et ses gradins, debout, sur tous les écrans (JP, 1er nov. : *vue verticale, caméra largeur complète style NHL 26* — la caméra de NHL 94) : ça de gradins de chaque côté, m
const SUIVI = 6;         // la vitesse à laquelle elle rattrape la rondelle, par seconde
const PIXEL = 1 / 14;    // un pixel de sprite, en mètres : quatorze par mètre (la lame à quatorze pixels devant les patins) ; à l'écran, un pixel de sprite fait un nombre ENTIER de pixels (jamais de flou) : deux au téléphone, trois en mode large
const FOULEES = 4;       // les images d'un cycle de patinage
const DIRECTIONS = 8;    // les sprites existent en huit directions : cinq dessinées, trois en miroir
const GEL = 0.06;        // l'arrêt sur image d'une mise en échec qui renverse, s (le hit stop)
const NOM = 1200;        // le nom du porteur se montre ça de temps à la prise, ms (JP : *nom apparaît une seconde à la possession*)
const COULEURS = {
  glace: '#dfe9f1', ligne: '#d0021b', bleue: '#1546b0', bande: '#2b2f3a', enclave: '#9fc3e6', maille: '#f7f7f7', noir: '#0a0b0e',
  toi: '#f47b20', plot: '#8d939f', blanc: '#f4f4f4', encreBlanc: '#111', contour: '#1b1d24', ombre: 'rgba(0,0,0,0.25)',
  baton: '#9a6a34', lame: '#1c1c22', jambiere: '#f2f4f7', pantalon: '#1f2230', rondelle: '#111', trace: 'rgba(20,20,20,0.35)',
  lumiere: '#ff2a2a', lampe: '#5a1414', banc: 'rgba(255,255,255,0.05)', passe: '#ffe14d',
  trait: '#101014', peau: '#e8c39e', peauOmbre: '#c49672', jambiereOmbre: '#c4c9d2', patin: '#15161c', lameSprite: '#d7dde6', ombreSprite: 'rgba(0,0,0,0.3)',
  gradin: '#16181f', fouleSombre: '#3a3d47', fouleClaire: '#b9b2a4',
  radarFond: 'rgba(10,11,14,0.75)', radarGlace: 'rgba(232,238,243,0.9)', doigt: 'rgba(255,255,255,0.08)', doigtTrait: 'rgba(255,255,255,0.35)', doigtPlein: 'rgba(255,255,255,0.6)',
};
/* Les chandails : les locaux (B, « eux ») en blanc aux épaules du club, les visiteurs (A, toi) en couleur. */
const chandails = (bandA, bandB) => ({
  A: { bg: bandA.bg, ink: bandA.ink, epaule: bandA.stripe || bandA.ink, casque: teinter(bandA.bg, -0.12), pantalon: teinter(bandA.bg, -0.5), numero: bandA.ink },
  B: { bg: COULEURS.blanc, ink: COULEURS.encreBlanc, epaule: bandB.bg, club: bandB.bg, casque: bandB.bg, pantalon: teinter(bandB.bg, -0.35), numero: bandB.bg },
});
const CLE = 'cap82_glace';
/*
 * LES SPRITES 16 BITS (JP, 1er nov. : *look snes* ; *deviens graphiste de 16-bit* ; *animations et sprites à
 * chier* ; *fais-toi plusieurs sous-agents graphistes*). Dessinés à la main, pixel par pixel, par un atelier de
 * graphistes (docs/decisions.md) : js/sprites.js tient les planches en lettres, une lettre par matière — le
 * contour, le chandail en trois tons, la bande du club, le numéro, la peau, le casque, le pantalon, les gants, les
 * patins, le bâton et son ruban, les jambières, l'ombre tramée. Cinq directions dessinées (S, SE, E, NE, N), trois en
 * miroir ; dix poses du patineur (le repos, le cycle de patinage en quatre images, la charge, le fouetté, la passe,
 * l'épaule, la chute), le gardien en garde et en papillon. Teints aux couleurs du club une fois, gardés. Les visages
 * (img/mugs) restent à la barre du nom.
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
    k: COULEURS.trait, J: c.bg, j: teinter(c.bg, 0.3), d: teinter(c.bg, -0.25), T: c.epaule, W: c.numero, S: COULEURS.peau, s: COULEURS.peauOmbre,
    H: c.casque, h: teinter(c.casque, 0.35), P: c.pantalon, p: teinter(c.pantalon, 0.25), G: teinter(c.pantalon, -0.1), K: COULEURS.patin, L: COULEURS.lameSprite,
    B: COULEURS.baton, b: COULEURS.lame, Q: COULEURS.jambiere, q: COULEURS.jambiereOmbre, o: COULEURS.ombreSprite,
  };
}
/* Les huit directions de l'écran (0 = vers la droite, puis dans le sens des aiguilles) : la planche dessinée, et si elle se lit en miroir. */
const HUIT = [['E', false], ['SE', false], ['S', false], ['SE', true], ['E', true], ['NE', true], ['N', false], ['NE', false]];
const QUATRE = [['E', false], ['S', false], ['E', true], ['N', false]];
/* Le sprite d'un club dans une pose et une direction, teint une fois et gardé. */
function spriteDe(eq, genre, pose, dir) {
  const cle = `${eq}:${genre}:${pose}:${dir}`;
  let im = sprites.get(cle);
  if (im) return im;
  const [nom, miroir] = (genre === 'G' ? QUATRE : HUIT)[dir];
  const planche = (genre === 'G' ? GARDIENS : PATINEURS)[nom];
  const lignes = planche[pose] || planche.repos || planche.garde;
  const teintes = teintesDe(eq);
  im = document.createElement('canvas');
  im.width = LARGEUR; im.height = HAUTEUR;
  const g = im.getContext('2d');
  lignes.forEach((ligne, y) => [...ligne].forEach((ch, x) => { const t = teintes[ch]; if (t) { g.fillStyle = t; g.fillRect(miroir ? LARGEUR - 1 - x : x, y, 1, 1); } }));
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
let choix = null;        // l'affiche : { A: { saison, club }, B: {…}, periode, horsjeu, degagement, series, deux, difficulte }
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
    difficulte: DIFFICULTES[memo.difficulte] ? memo.difficulte : 'normal', baton: !!memo.baton,
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
      <label><input type="checkbox" data-regle="baton"${choix.baton ? ' checked' : ''}> Bâton au relâchement <small>le joystick tire ou passe quand tu le lâches</small></label>
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
    if (doigt) return;
    doigt = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', ev => { if (doigt && ev.pointerId === doigt.id) { doigt.x = ev.clientX; doigt.y = ev.clientY; } });
  const lacher = ev => {
    if (!doigt || ev.pointerId !== doigt.id) return;
    if (choix && choix.baton && etat) {
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
    b.addEventListener('pointerdown', ev => { boutons[quoi] = true; ev.preventDefault(); });
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
/* La manette qui vibre (le dual-rumble du Gamepad API) : le tir, le coup reçu, le but. Sans manette, rien. */
function vibrer(eq, fort, faible, duree) {
  const p = manettes[eq];
  const v = p && p.vibrationActuator;
  if (!v || typeof v.playEffect !== 'function') return;
  try { v.playEffect('dual-rumble', { startDelay: 0, duration: duree, strongMagnitude: fort, weakMagnitude: faible }).catch(() => {}); } catch { /* une manette sans moteur */ }
}
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
    if (v.type === 'but') { flash = { mot: etat.match ? `BUT ! ${noms[v.equipe]}` : 'BUT !', reste: 2 }; secousse = { t0: now, dur: 450, amp: 4 }; for (const eq of etat.humains) vibrer(eq, eq === v.equipe ? 1 : 0.4, 0.8, 400); }
    else if (v.type === 'arret' && v.gele) flash = { mot: 'Gelée.', reste: 1.2 };
    else if (v.type === 'arret') flash = { mot: 'Arrêt !', reste: 0.8 };
    else if (v.type === 'poteau') { flash = { mot: v.barre ? 'La barre !' : 'Poteau !', reste: 0.8 }; secousse = { t0: now, dur: 160, amp: 2 }; }
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
    else if (v.type === 'tir') { if (Object.values(etat.controles).includes(v.qui)) flash = { mot: `${Math.round(v.v * 3.6)} km/h${v.uneTemps ? ' · sur réception' : ''}`, reste: 1 }; vibrer(equipeDe(v.qui), 0, 0.6, 70); }
    else if (v.type === 'echec' && v.fort) { gel = GEL; secousse = { t0: now, dur: 200, amp: 3 }; vibrer(equipeDe(v.sur), 0.9, 0.5, 160); vibrer(equipeDe(v.qui), 0.4, 0.7, 100); }
    else if (v.type === 'remise') trace = [];
    else if (v.type === 'fin') finDuMatch();
  }
  if (flash.reste > 0 && !pause) flash.reste -= dt;
  if (!pause) {
    ambiance(dt);
    for (const s of etat.patineurs) { if (!s.anim) s.anim = { dist: 0 }; s.anim.dist += Math.hypot(s.vx, s.vy) * dt; }
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
/* La foule de la soirée : sa base monte avec le moment (la 3e, la prolongation, un pointage serré, les locaux en zone offensive) ; le crissement de ton patineur. */
function ambiance(dt) {
  const M = etat.match;
  let base = 0.18;
  if (M) {
    if (M.periode >= 3 || M.prolongation) base += 0.08;
    if (Math.abs(M.pointage.A - M.pointage.B) <= 1) base += 0.05;
    if (etat.rondelle.x * etat.equipes.B.attaque > BLEUE) base += 0.15;
  }
  ambianceFoule(base, dt);
  const toi = etat.patineurs.find(p => p.id === etat.controles[etat.humains[0]]);
  if (!toi) { crissement(0, 0); return; }
  const anim = toi.anim || (toi.anim = { dist: 0 });
  const dcap = anim.capPrec == null ? 0 : Math.atan2(Math.sin(toi.cap - anim.capPrec), Math.cos(toi.cap - anim.capPrec));
  anim.capPrec = toi.cap;
  crissement(Math.hypot(toi.vx, toi.vy), dt > 0 ? dcap / dt : 0);
}
const nomDe = id => { const s = etat.patineurs.find(p => p.id === id); if (s) return s.nom; const g = etat.gardiens.find(x => `G:${x.equipe}` === id); return g ? g.nom : ''; };
/* Un événement du moteur devient une animation : le fouetté du tir, la poussée de la passe, l'impact, le papillon, la lumière, le nom du porteur. */
function animer(v, now) {
  const s = v.qui ? etat.patineurs.find(p => p.id === v.qui) : null;
  if (v.type === 'tir' && s) (s.anim || (s.anim = { dist: 0 })).tir = now;
  else if (v.type === 'passe' && s) (s.anim || (s.anim = { dist: 0 })).passe = now;
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
  // Le canevas est DEBOUT au téléphone (JP : *jeu vertical*), comme à la console, et COUCHÉ en mode large.
  // En pixels CSS, un pour un : sur un téléphone, le navigateur agrandit sans lissage (.sg-canvas), et les sprites y font des pixels entiers.
  const dpr = 1;
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
const ZOOM = 1.2;       // la caméra rapprochée : on voit la zone, pas tout le long
function camera(dt) {
  const long = taille.h, court = taille.w;
  const kEntier = Math.min(long / (L + 2 * GRADINS), court / (W + 2 * GRADINS));
  const k = vueEntiere ? kEntier : court / (W + 2 * GRADINS) * ZOOM;
  cam.k = k;
  const R = etat.rondelle;
  const avance = Math.max(-DEVANCE, Math.min(DEVANCE, R.vx * DEVANCE_V));
  const cible = R.x + avance;
  const f = 1 - Math.exp(-SUIVI * dt);
  cam.x += (cible - cam.x) * f;
  cam.y = 0;
  const hx = long / (2 * k);
  cam.x = hx >= L / 2 + GRADINS ? 0 : Math.max(-L / 2 - GRADINS + hx, Math.min(L / 2 + GRADINS - hx, cam.x));
}
/* Un point de la glace à l'écran (en pixels CSS) : la glace est tournée d'un quart de tour, l'axe long vers le haut. */
const ecran = (x, y) => ({ x: taille.w / 2 + (y - cam.y) * cam.k + tremble.x, y: taille.h / 2 - (x - cam.x) * cam.k + tremble.y });
/* Le repère de la glace sur le canevas : le centre de l'écran (et la secousse), le quart de tour, l'échelle, la caméra. */
function repereGlace() {
  cx.setTransform(taille.dpr, 0, 0, taille.dpr, 0, 0);
  cx.translate(taille.w / 2 + tremble.x, taille.h / 2 + tremble.y);
  cx.rotate(-Math.PI / 2);
  cx.scale(cam.k, cam.k);
  cx.translate(-cam.x, -cam.y);
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
  foule();
  ecussonAuCentre();
}
/*
 * LA FOULE (JP : *foule*) : les gradins tout autour de la bande, des rangées de têtes aux couleurs des deux clubs et
 * du monde ordinaire, tirées d'un hachage fixe (la même foule tout le match) ; elle se lève sur un but des locaux.
 */
function foule() {
  const X = L / 2, Y = W / 2;
  cx.fillStyle = COULEURS.gradin;
  cx.fillRect(-X - GRADINS, -Y - GRADINS, L + 2 * GRADINS, GRADINS - 0.3); cx.fillRect(-X - GRADINS, Y + 0.3, L + 2 * GRADINS, GRADINS - 0.3);
  cx.fillRect(-X - GRADINS, -Y, GRADINS - 0.3, W); cx.fillRect(X + 0.3, -Y, GRADINS - 0.3, W);
  const but = anims.find(a => a.type === 'lumiere');
  const saut = but ? Math.abs(Math.sin((performance.now() - but.t0) / 110)) * 0.25 : 0;
  const pas = 0.55;
  const tete = (x, y, i, j) => {
    const h = (i * 73856093 ^ j * 19349663) >>> 0;
    const r = (h % 97) / 97;
    cx.fillStyle = r < 0.22 ? couleurs.A.bg : r < 0.5 ? (couleurs.B.club || couleurs.B.bg) : r < 0.7 ? COULEURS.fouleSombre : COULEURS.fouleClaire;
    cx.fillRect(x, y - (r > 0.5 ? saut : 0), pas * 0.6, pas * 0.6);
  };
  // Les deux longs côtés, puis les deux bouts, en rangées qui reculent.
  for (let i = 0; i < Math.floor((L + 2 * GRADINS) / pas); i++) for (let j = 0; j < 4; j++) {
    const x = -X - GRADINS + 0.2 + i * pas, d = 0.5 + j * 0.65;
    if (Math.abs(x) < X + 0.3 || j > 0) { tete(x, -Y - d - 0.3, i, j); tete(x, Y + d, i, j + 10); }
  }
  for (let i = 0; i < Math.floor(W / pas); i++) for (let j = 0; j < 4; j++) {
    const y = -Y + 0.2 + i * pas, d = 0.5 + j * 0.65;
    tete(-X - d - 0.3, y, i + 300, j); tete(X + d, y, i + 300, j + 10);
  }
}
/* L'ÉCUSSON DES LOCAUX au centre de la glace (JP : *logo de l'équipe à domicile dans le centre de la glace*), droit pour qui regarde l'écran. */
let ecusson = null;   // { code, im }
function ecussonAuCentre() {
  const code = etat.match && etat.equipes.B.tag;
  if (!code || !ctxJeu.logoLocal(code)) return;
  if (!ecusson || ecusson.code !== code) { const im = new Image(); im.src = `img/logos/${code}.svg`; ecusson = { code, im }; }
  const im = ecusson.im;
  if (!im.complete || !im.naturalWidth) return;
  cx.save();
  cx.globalAlpha = 0.45;
  cx.rotate(Math.PI / 2);   // la glace est tournée d'un quart de tour : l'écusson se remet droit
  cx.drawImage(im, -3.2, -3.2, 6.4, 6.4);
  cx.restore();
}

/* L'échelle d'un sprite à l'écran : un nombre entier de pixels par pixel de sprite. */
const echelle = () => Math.max(1, Math.round(cam.k * PIXEL));
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
function marques(s) {
  const toi = Object.values(etat.controles).includes(s.id);
  // TON JOUEUR : un gros disque plein aux couleurs de son club sous ses patins (JP : *gros rond ombre en dessous, couleur de l'équipe ; le symbole blanc est pas viable*).
  if (toi) {
    const c = couleurs[s.equipe];
    cx.globalAlpha = 0.85;
    cercle(s.x, s.y, s.rayon + 0.45, c.club || c.bg, COULEURS.contour, 0.1);
    cx.globalAlpha = 1;
  }
  if (s.charge > 0 && etat.rondelle.porteur === s.id) {
    cx.strokeStyle = COULEURS.ligne; cx.lineWidth = 0.09;
    cx.beginPath(); cx.arc(s.x, s.y, s.rayon + 0.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.charge / BATON.charge)); cx.stroke();
  }
}
/* Un patineur, en pixels d'écran : sa pose du moment (la chute, le lancer, la passe, l'épaule, la foulée, le repos). */
function patineur(s, now) {
  const v = Math.hypot(s.vx, s.vy);
  const anim = s.anim || (s.anim = { dist: 0 });
  const dir = directionDe(s.auSol > 0 && v > 0.3 ? Math.atan2(s.vy, s.vx) : s.cap);
  let pose = 'repos';
  if (s.auSol > 0) pose = 'chute';
  else if (anim.tir && now - anim.tir < 320) pose = 'tir';
  else if (s.charge > 0 && etat.rondelle.porteur === s.id) pose = 'charge';
  else if (anim.passe && now - anim.passe < 240) pose = 'passe';
  else if (s.elan > 0) pose = 'echec';
  else if (v > 0.6) { const rythme = Math.min(3.5, Math.max(1.2, v * 0.3)); pose = `patin${1 + Math.floor(anim.dist * rythme) % FOULEES}`; }   // LA FOULÉE : quatre images, au rythme de la vitesse (lent à basse vitesse, rapide à pleine)
  corps(s.x, s.y, s.equipe, 'P', pose, dir);
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
    cx.beginPath(); cx.arc(r.vers.x, r.vers.y, r.vers.rayon + 0.22, 0, Math.PI * 2); cx.stroke();
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
  for (const s of etat.patineurs) if (s.surGlace || s.boxe) marques(s);
  // LA RONDELLE : à la mise en jeu, elle tombe ; en l'air, elle grossit et laisse son ombre au sol.
  const chute = etat.mej ? Math.max(0, etat.mej.reste / 0.9) : 0;
  const z = Math.max(chute * 0.6, Math.min(1.5, R.z || 0));
  const rr = Math.max(RONDELLE.rayon, 3 / cam.k);
  if (z > 0) { cx.fillStyle = COULEURS.ombre; cx.beginPath(); cx.arc(R.x, R.y, rr * (1 + z), 0, Math.PI * 2); cx.fill(); }
  cercle(R.x + z * 0.5, R.y, rr * (1 + z * 1.2), COULEURS.rondelle);
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
    cx.globalAlpha = f;
    cx.fillStyle = couleurs[s.equipe].bg; cx.fillRect(Math.round(p.x - lw / 2), Math.round(p.y - s.rayon * cam.k - 24), Math.round(lw), 16);
    cx.fillStyle = couleurs[s.equipe].ink; cx.fillText(mot, Math.round(p.x), Math.round(p.y - s.rayon * cam.k - 16));
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
