/*
 * GLISSER D'UN ONGLET À L'AUTRE (V6). JP : *dans effectif, mettre onglet équipe, onglet attaque, def, gardiens, etc ?
 * swipable ? D'ailleurs lorsqu'onglet, toujours swipable, peu importe niveau un ou deux*.
 *
 * Un geste horizontal franc (au moins SEUIL pixels, deux fois plus large que haut) passe à l'onglet voisin de la
 * barre la plus proche du doigt : celle de la fenêtre où l'on glisse, sinon la plus basse de la page (le niveau deux),
 * sinon les sections (le niveau un). Au bout d'une barre de la page, on passe à la section voisine. Le geste TOUCHE
 * l'onglet comme un doigt l'aurait fait : chaque écran garde sa logique. Ce qui se balaie déjà en largeur (un
 * tableau, une pile de cartes, le plateau, un curseur, une barre d'onglets qui défile) garde son geste.
 *
 * LE GESTE SE VOIT (oct., JP : *navigation plus fluide sur mobile avec swipe*). Dès que le doigt part en largeur, le nom
 * de l'onglet où il mène sort du bord sous lui (`.glisse-indice`) et se remplit au seuil : on sait où l'on va avant de
 * lâcher. Un coup vif compte même court (`VIF`). Une carte soulevée (js/deposer.js, `carte-soulevee`) n'est pas un
 * balayage.
 *
 * TIRER UNE FENÊTRE VERS LE BAS LA FERME, comme un téléphone ferme une feuille : depuis le haut de son contenu, la
 * feuille suit le doigt ; lâchée assez bas (ou d'un coup vif), elle fait le même retour d'un niveau que ✕, Échap et le
 * bouton d'Android (`retour`, js/pile.js) — un choix qui doit se régler reste, et remonte.
 */
import { retour } from './pile.js';

const SEUIL = 60;
const VIF = { px: 28, ms: 250 };     // un coup vif : au moins 28 px en moins de 250 ms
const TIRE = { px: 110, ms: 260 };   // la feuille se ferme tirée de 110 px, ou d'un coup vif
const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const ongletsDe = barre => [...barre.querySelectorAll('button')].filter(b => b.closest('[role="tablist"]') === barre && visible(b) && !b.disabled);
const actif = liste => liste.findIndex(b => b.getAttribute('aria-selected') === 'true' || b.classList.contains('on'));
/* Le doigt part de quelque chose qui a son propre geste en largeur. */
function aSonGeste(el) {
  for (let x = el; x && x !== document.body; x = x.parentElement) {
    if (x.matches('input, textarea, select, canvas, #tableModal, .paquet-scene, .choix-main, [role="tablist"]')) return true;
    if (x.scrollWidth > x.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(x).overflowX)) return true;
  }
  return false;
}
/* Une fenêtre posée par-dessus la page : on n'y glisse que ses propres onglets. */
const FENETRE = '.choix-modal, [role="dialog"], #liveModal, #gameModal';
/* Les feuilles qu'on tire pour fermer : jamais le plein écran du direct, du bureau ni du plateau. */
const FEUILLE = '.modal-backdrop:not(.live) > .modal-sheet, .choix-modal > .choix-sheet';
/* Les barres d'onglets à portée : celles du plus proche parent du doigt qui en porte, sections exclues, sans sortir de sa fenêtre. */
function barresPres(el) {
  const fen = el && el.closest ? el.closest(FENETRE) : null;
  for (let x = el; x; x = x.parentElement) {
    const barres = [...x.querySelectorAll('[role="tablist"]')].filter(b => b.id !== 'navbar' && visible(b) && ongletsDe(b).length > 1 && actif(ongletsDe(b)) >= 0);
    if (barres.length) return { barres, fenetre: !!fen };
    if (x === fen || x === document.body) break;
  }
  return { barres: [], fenetre: !!fen };
}
const voisin = (barre, sens) => {
  const liste = ongletsDe(barre), i = actif(liste);
  return i < 0 ? null : liste[i + sens] || null;
};
/* L'onglet où mène un balayage : dans la barre la plus basse (le niveau le plus fin), sinon la section voisine — jamais
   depuis une fenêtre posée par-dessus. */
function destination(cible, sens) {
  const { barres, fenetre } = barresPres(cible);
  const ici = barres.length ? voisin(barres[barres.length - 1], sens) : null;
  if (ici) return ici;
  const nav = document.getElementById('navbar');
  return !fenetre && nav && visible(nav) ? voisin(nav, sens) : null;
}
const nomDe = b => ((b.querySelector('.navtab-lbl') || b).textContent || '').trim();

/* L'indice sous le doigt : le nom de l'onglet où l'on va, qui sort du bord avec le geste et se remplit au seuil. */
function montrerIndice(geste, dx) {
  const sens = dx < 0 ? 1 : -1;
  if (geste.sens !== sens) {
    geste.sens = sens;
    geste.vers = destination(geste.cible, sens);
    if (geste.indice) { geste.indice.remove(); geste.indice = null; }
    if (geste.vers) {
      const el = document.createElement('div');
      el.className = 'glisse-indice';
      el.setAttribute('aria-hidden', 'true');
      el.dataset.cote = sens > 0 ? 'd' : 'g';
      el.textContent = sens > 0 ? `${nomDe(geste.vers)} ›` : `‹ ${nomDe(geste.vers)}`;
      document.body.appendChild(el);
      geste.indice = el;
    }
  }
  if (!geste.indice) return;
  const p = Math.min(1, Math.abs(dx) / SEUIL);
  geste.indice.style.transform = `translate(${(sens > 0 ? 1 : -1) * (1 - p) * 100}%, -50%)`;
  if ((p >= 1) !== geste.indice.classList.contains('pret')) {
    geste.indice.classList.toggle('pret', p >= 1);
    if (p >= 1 && navigator.vibrate) navigator.vibrate(6);
  }
}
/* Le haut du contenu sous le doigt : rien entre lui et la feuille n'est défilé. */
function auHaut(el, feuille) {
  for (let x = el; x; x = x.parentElement) {
    if (x.scrollTop > 0) return false;
    if (x === feuille) return true;
  }
  return true;
}
function relacherFeuille(f, fermer) {
  f.style.transition = 'transform 200ms ease-out';
  f.style.transform = '';
  setTimeout(() => { f.style.transition = ''; }, 220);
  if (fermer) retour();
}

export function brancherGlisser() {
  let geste = null;
  const finir = () => {
    if (geste && geste.indice) geste.indice.remove();
    if (geste && geste.feuille && geste.mode === 'tire') relacherFeuille(geste.feuille, false);
    geste = null;
  };
  document.addEventListener('carte-soulevee', finir);
  document.addEventListener('touchstart', ev => {
    finir();
    if (ev.touches.length !== 1) return;
    const t = ev.touches[0], cible = ev.target;
    const feuille = cible.closest && cible.closest(FEUILLE);
    const tirable = !!feuille && !cible.closest('input, textarea, select, canvas, .paquet-scene') && auHaut(cible, feuille);
    const balayable = !aSonGeste(cible);
    if (!tirable && !balayable) return;
    geste = { x: t.clientX, y: t.clientY, t0: ev.timeStamp, cible, feuille: tirable ? feuille : null, balayable, mode: null, sens: 0, vers: null, indice: null };
  }, { passive: true });
  document.addEventListener('touchmove', ev => {
    if (!geste || geste.mode === 'defile') return;
    const t = ev.touches[0], dx = t.clientX - geste.x, dy = t.clientY - geste.y;
    if (!geste.mode) {
      // Vers le bas depuis le haut d'une feuille : on la tire (la page ne rebondit pas pendant qu'on décide).
      if (geste.feuille && dy > 0 && dy >= 1.2 * Math.abs(dx)) {
        if (ev.cancelable) ev.preventDefault();
        if (dy > 8) geste.mode = 'tire';
        else return;
      } else if (geste.balayable && Math.abs(dx) > 12 && Math.abs(dx) > 1.5 * Math.abs(dy)) geste.mode = 'balaie';
      else if (Math.abs(dy) > 12 || Math.abs(dx) > 12) { geste.mode = 'defile'; return; }
      else return;
    }
    if (geste.mode === 'tire') {
      if (ev.cancelable) ev.preventDefault();
      // La feuille suit le doigt vers le bas ; vers le haut, elle résiste.
      geste.feuille.style.transition = 'none';
      geste.feuille.style.transform = `translateY(${dy > 0 ? dy : dy / 4}px)`;
    } else montrerIndice(geste, dx);
  }, { passive: false });
  document.addEventListener('touchend', ev => {
    if (!geste) return;
    const g = geste;
    geste = null;
    if (g.indice) g.indice.remove();
    const t = ev.changedTouches[0], dx = t.clientX - g.x, dy = t.clientY - g.y, ms = ev.timeStamp - g.t0;
    if (g.mode === 'tire') { relacherFeuille(g.feuille, dy >= TIRE.px || (dy >= VIF.px && ms <= TIRE.ms)); return; }
    if (g.mode !== 'balaie' || Math.abs(dx) < 2 * Math.abs(dy)) return;
    if (Math.abs(dx) < SEUIL && !(Math.abs(dx) >= VIF.px && ms <= VIF.ms)) return;
    const vers = g.vers && g.sens === (dx < 0 ? 1 : -1) ? g.vers : destination(g.cible, dx < 0 ? 1 : -1);
    if (!vers) return;
    vers.click();
    vers.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, { passive: true });
  document.addEventListener('touchcancel', finir, { passive: true });
}
