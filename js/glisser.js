/*
 * GLISSER D'UN ONGLET À L'AUTRE (V6). JP : *dans effectif, mettre onglet équipe, onglet attaque, def, gardiens, etc ?
 * swipable ? D'ailleurs lorsqu'onglet, toujours swipable, peu importe niveau un ou deux*.
 *
 * Un geste horizontal franc (au moins SEUIL pixels, deux fois plus large que haut) passe à l'onglet voisin de la
 * barre la plus proche du doigt : celle de la fenêtre où l'on glisse, sinon la plus basse de la page (le niveau deux),
 * sinon les sections (le niveau un). Au bout d'une barre de la page, on passe à la section voisine. Le geste TOUCHE
 * l'onglet comme un doigt l'aurait fait : chaque écran garde sa logique. Ce qui se balaie déjà en largeur (un
 * tableau, une pile de cartes, le plateau, un curseur, une barre d'onglets qui défile) garde son geste.
 */
const SEUIL = 60;
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
function passer(barre, sens) {
  const liste = ongletsDe(barre), i = actif(liste);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= liste.length) return false;
  liste[j].click();
  liste[j].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
}
export function brancherGlisser() {
  let depart = null;
  document.addEventListener('touchstart', ev => {
    const t = ev.touches[0];
    depart = ev.touches.length === 1 && !aSonGeste(ev.target) ? { x: t.clientX, y: t.clientY, cible: ev.target } : null;
  }, { passive: true });
  document.addEventListener('touchend', ev => {
    if (!depart) return;
    const t = ev.changedTouches[0], dx = t.clientX - depart.x, dy = t.clientY - depart.y;
    const cible = depart.cible;
    depart = null;
    if (Math.abs(dx) < SEUIL || Math.abs(dx) < 2 * Math.abs(dy)) return;
    const sens = dx < 0 ? 1 : -1;
    const { barres, fenetre } = barresPres(cible);
    // La plus basse dans la page : le niveau le plus fin.
    if (barres.length && passer(barres[barres.length - 1], sens)) return;
    // Au bout (ou sans onglets), les sections — jamais depuis une fenêtre posée par-dessus.
    const nav = document.getElementById('navbar');
    if (!fenetre && nav && visible(nav)) passer(nav, sens);
  }, { passive: true });
}
