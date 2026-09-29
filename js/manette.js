/**
 * LA MANETTE ET LE CLAVIER (1.0, R1 · La coquille). JP : *que ça ait pas l'air
 * d'un jeu web, mais d'un jeu console, PC ou mobile*. Un jeu de console se
 * joue sans souris :
 *
 *   les flèches, la croix ou le bâton gauche   le focus va au voisin le plus
 *                                              proche dans cette direction
 *   Entrée, A                                  confirme (le bouton sous le focus)
 *   Échap, B                                   remonte d'un niveau (js/pile.js)
 *   Start                                      le Menu
 *
 * Le focus ne parcourt que la COUCHE DU DESSUS : un plein écran ouvert, une
 * fiche, le Menu — sinon la page. Son anneau lumineux (l'accent du club) ne
 * se montre qu'en mode clavier ou manette (`body.nav-clavier`) : un doigt ou
 * une souris le retire. La manette n'est lue, à chaque image, que tant
 * qu'elle est branchée ; les invites du bas du rail disent ses boutons
 * (`body.manette`) ou les touches du clavier.
 */
import { retour } from './pile.js';
import { jouerSon } from './sons.js';

const FOCALISABLE = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const DIRECTIONS = { ArrowUp: 'haut', ArrowDown: 'bas', ArrowLeft: 'gauche', ArrowRight: 'droite' };

const visible = el => (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : el.getClientRects().length > 0);

/* La couche du dessus : la plus haute des couches ouvertes, sinon la page. */
function coucheDuDessus() {
  const z = el => Number(getComputedStyle(el).zIndex) || 0;
  const ancre = document.body.classList.contains('hub-docke');
  const couches = [...document.querySelectorAll('#menuDepart, #exhibitionModal, #pageRegles, .choix-modal, .modal-backdrop')]
    .filter(el => el.firstElementChild && !(ancre && el.id === 'hubModal') && visible(el));
  if (!couches.length) return document.body;
  return couches.sort((a, b) => z(b) - z(a) || Number(b.dataset.rang || 0) - Number(a.dataset.rang || 0))[0];
}

/* L'écart entre deux intervalles, zéro s'ils se chevauchent. */
const ecart = (a0, a1, b0, b1) => Math.max(0, Math.max(a0, b0) - Math.min(a1, b1));

/*
 * LE VOISIN : parmi ce qui est plus loin dans la direction, le plus proche —
 * la distance dans l'axe, plus trois fois l'écart dans l'autre axe (on
 * préfère rester dans la même rangée ou la même colonne).
 */
function score(r, s, dir) {
  const H = dir === 'gauche' || dir === 'droite';
  const signe = dir === 'droite' || dir === 'bas' ? 1 : -1;
  const progres = (H ? s.left + s.right - r.left - r.right : s.top + s.bottom - r.top - r.bottom) / 2 * signe;
  if (progres <= 1) return Infinity;
  const avant = { droite: s.left - r.right, gauche: r.left - s.right, bas: s.top - r.bottom, haut: r.top - s.bottom }[dir];
  const de = H ? ecart(r.top, r.bottom, s.top, s.bottom) : ecart(r.left, r.right, s.left, s.right);
  const centre = H ? Math.abs(s.top + s.bottom - r.top - r.bottom) / 2 : Math.abs(s.left + s.right - r.left - r.right) / 2;
  return Math.max(0, avant) + de * 3 + centre * 0.15 + (avant < -2 ? 60 : 0);
}

function deplacer(dir) {
  const couche = coucheDuDessus();
  const items = [...couche.querySelectorAll(FOCALISABLE)].filter(visible);
  if (!items.length) return false;
  const ici = document.activeElement;
  let cible = null;
  if (!ici || ici === document.body || !couche.contains(ici) || !visible(ici)) {
    cible = couche.querySelector('.menu-continuer, .navtab.on') || items[0];
    if (!visible(cible)) cible = items[0];
  } else {
    const r = ici.getBoundingClientRect();
    let meilleur = Infinity;
    for (const el of items) {
      if (el === ici || el.contains(ici) || ici.contains(el)) continue;
      const s = score(r, el.getBoundingClientRect(), dir);
      if (s < meilleur) { meilleur = s; cible = el; }
    }
  }
  if (!cible) return false;
  cible.focus({ preventScroll: true });
  cible.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  jouerSon('curseur');
  return true;
}

function modeClavier() { document.body.classList.add('nav-clavier'); }

/* Les invites du bas du rail : les boutons de la manette, ou les touches du clavier. */
function majInvites() {
  const el = document.getElementById('invites');
  if (!el) return;
  el.innerHTML = document.body.classList.contains('manette')
    ? '<span><kbd>Ⓐ</kbd> Confirmer</span><span><kbd>Ⓑ</kbd> Retour</span>'
    : '<span><kbd>Entrée</kbd> Confirmer</span><span><kbd>Échap</kbd> Retour</span>';
}

/* ---------- la manette : l'API Gamepad, lue à chaque image tant qu'elle est branchée ---------- */
const etat = {};
let boucle = null;
function confirmer() {
  const el = document.activeElement;
  if (el && el !== document.body && coucheDuDessus().contains(el)) { jouerSon('valide'); el.click(); }
  else deplacer('bas');
}
function lireManette() {
  boucle = null;
  const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
  if (!pads.length) return;
  const p = pads[0];
  const appui = i => !!(p.buttons[i] && p.buttons[i].pressed);
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  const maintenant = performance.now();
  const dirs = { haut: appui(12) || ay < -0.6, bas: appui(13) || ay > 0.6, gauche: appui(14) || ax < -0.6, droite: appui(15) || ax > 0.6 };
  for (const [d, on] of Object.entries(dirs)) {
    const k = `d:${d}`;
    // Une direction tenue se répète : une première fois après 380 ms, puis toutes les 110 ms.
    if (!on) etat[k] = 0;
    else if (!etat[k] || maintenant >= etat[k]) { modeClavier(); deplacer(d); etat[k] = maintenant + (etat[k] ? 110 : 380); }
  }
  for (const [i, action] of [[0, confirmer], [1, retour], [9, () => document.getElementById('menuBtn')?.click()]]) {
    const k = `b:${i}`, on = appui(i);
    if (on && !etat[k]) { modeClavier(); action(); }
    etat[k] = on;
  }
  boucle = requestAnimationFrame(lireManette);
}

export function brancherManette() {
  window.addEventListener('keydown', ev => {
    const dir = DIRECTIONS[ev.key];
    if (dir || ev.key === 'Tab' || ev.key === 'Enter') modeClavier();
    if (!dir || ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    // Une zone de texte, une liste ou un curseur gardent leurs flèches.
    if (ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (deplacer(dir)) ev.preventDefault();
  });
  // Un doigt ou une souris : l'anneau du focus s'éteint.
  document.addEventListener('pointerdown', () => document.body.classList.remove('nav-clavier'), true);
  window.addEventListener('gamepadconnected', () => {
    document.body.classList.add('manette');
    majInvites();
    if (!boucle) boucle = requestAnimationFrame(lireManette);
  });
  window.addEventListener('gamepaddisconnected', () => {
    if ([...(navigator.getGamepads ? navigator.getGamepads() : [])].some(Boolean)) return;
    document.body.classList.remove('manette');
    majInvites();
    if (boucle) { cancelAnimationFrame(boucle); boucle = null; }
  });
  majInvites();
}
