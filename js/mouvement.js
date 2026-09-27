/**
 * LE MOUVEMENT DE L'INTERFACE (S77) — les chiffres qui se comptent.
 *
 * JP : *Interface plus premium, cherche sur le Web pour images
 * d'inspiration*. Ce qui sépare un tableur d'un jeu de gestion à la Football
 * Manager, ce n'est pas qu'un chiffre soit juste : c'est qu'on le VOIE
 * changer. Le plafond qui descend à la signature, les points et le rang
 * d'une journée à l'autre, la fiche du bilan qui se compte. Balatro le fait
 * avec un ressort — la courbe dépasse un peu sa cible et revient — et c'est
 * ce qui donne du poids à un nombre : cubic-bezier(0.34, 1.56, 0.64, 1),
 * 400 ms, rien du tout sous `prefers-reduced-motion`.
 *
 * LE TEXTE DU DOM EST TOUJOURS LE VRAI CHIFFRE. L'animation ne touche jamais
 * `textContent` : elle écrit la valeur de passage dans `data-compte-vu`, que
 * la feuille de style peint PAR-DESSUS (::after) pendant que le vrai texte
 * est rendu transparent (`-webkit-text-fill-color`, qui ne bouge pas la
 * boîte). La raison est mesurable : le test de fumée lit le plafond entre
 * deux signatures pour décider la suivante, et un lecteur d'écran lit ce qui
 * est écrit — un chiffre à mi-course leur mentirait à tous les deux.
 *
 * Deux façons de brancher un chiffre, et aucune ne demande au contrôleur de
 * savoir qu'une animation existe :
 *   - `data-compte-suivi` dans la coquille (index.html) : le texte est
 *     surveillé, chaque changement se compte depuis la valeur d'avant
 *     (le plafond restant de la barre du haut) ;
 *   - `data-compte="clé"` dans un gabarit refait à chaque rendu (une tuile de
 *     l'écran de saison, la fiche du bilan) : `animerComptes(racine)` compte
 *     depuis la dernière valeur vue sous la même clé, ou depuis
 *     `data-compte-depart` la première fois.
 */

const DUREE = 400;

/* Le mouvement réduit coupe tout : le chiffre final s'affiche tout de suite. */
const reduit = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/*
 * LA COURBE DU RESSORT, la même que `--e-ressort` dans style.css : une
 * cubique de Bézier (0, 0) (0,34, 1,56) (0,64, 1) (1, 1). On cherche le `t`
 * dont l'abscisse vaut la fraction de temps écoulée (Newton, quatre pas
 * suffisent à cette précision), et on rend son ordonnée — qui dépasse 1 un
 * moment, c'est le rebond.
 */
const X1 = 0.34, Y1 = 1.56, X2 = 0.64, Y2 = 1;
const bez = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
const dBez = (t, a, b) => 3 * (1 - t) * (1 - t) * a + 6 * (1 - t) * t * (b - a) + 3 * t * t * (1 - b);
export function ressort(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 4; i++) {
    const d = dBez(t, X1, X2);
    if (Math.abs(d) < 1e-6) break;
    t -= (bez(t, X1, X2) - x) / d;
  }
  return bez(Math.min(1, Math.max(0, t)), Y1, Y2);
}

/*
 * LIRE UN CHIFFRE DANS SON TEXTE : « $73.9M », « 32e », « 18 », « −4 ».
 * On garde ce qui l'entoure et son nombre de décimales, pour réécrire la
 * valeur de passage dans le même costume. Un texte sans chiffre rend null :
 * il ne se compte pas.
 */
function lire(texte) {
  const m = /^(.*?)(-?\d+(?:[.,]\d+)?)(.*)$/s.exec(String(texte || '').trim());
  if (!m) return null;
  const brut = m[2];
  const sep = brut.includes(',') ? ',' : '.';
  const dec = (brut.split(/[.,]/)[1] || '').length;
  return { avant: m[1], n: Number(brut.replace(',', '.')), dec, sep, apres: m[3] };
}
const ecrire = (l, v) => `${l.avant}${v.toFixed(l.dec).replace('.', l.sep)}${l.apres}`;

/* Les animations en cours, par élément : une nouvelle valeur remplace l'ancienne course. */
const courses = new WeakMap();

function compter(el, de, l) {
  const a = l.n;
  const prec = courses.get(el);
  if (prec) cancelAnimationFrame(prec);
  if (reduit() || de === a || !Number.isFinite(de)) { finir(el); return; }
  const t0 = performance.now();
  const pas = maintenant => {
    const x = Math.min(1, (maintenant - t0) / DUREE);
    if (x >= 1 || !el.isConnected) { finir(el); return; }
    el.dataset.compteVu = ecrire(l, de + (a - de) * ressort(x));
    courses.set(el, requestAnimationFrame(pas));
  };
  el.dataset.compteVu = ecrire(l, de);
  courses.set(el, requestAnimationFrame(pas));
}
function finir(el) {
  courses.delete(el);
  delete el.dataset.compteVu;
}

/* La dernière valeur vue sous chaque clé : un gabarit refait chaque jour
   compte depuis hier, pas depuis zéro. */
const memoire = new Map();

/**
 * Compte chaque `[data-compte]` de `racine` depuis sa dernière valeur vue.
 * À appeler après un `innerHTML`. Sans valeur connue, `data-compte-depart`
 * dit d'où partir (0 pour une fiche qui se révèle) ; sans lui, rien ne bouge.
 */
export function animerComptes(racine) {
  if (!racine || typeof racine.querySelectorAll !== 'function') return;
  for (const el of racine.querySelectorAll('[data-compte]')) {
    const l = lire(el.textContent);
    if (!l) continue;
    const cle = el.dataset.compte;
    const depart = el.dataset.compteDepart;
    const de = memoire.has(cle) ? memoire.get(cle) : (depart != null ? Number(depart) : l.n);
    memoire.set(cle, l.n);
    compter(el, de, l);
  }
}

/**
 * Surveille le texte d'un élément de la coquille et compte chaque changement.
 * Le contrôleur continue d'écrire `textContent` comme avant ; c'est le
 * changement lui-même qui se voit.
 */
export function suivreChiffre(el) {
  if (!el || el._compteSuivi || typeof MutationObserver !== 'function') return;
  el._compteSuivi = true;
  let dernier = lire(el.textContent);
  new MutationObserver(() => {
    const l = lire(el.textContent);
    // Le contrôleur réécrit le plafond à CHAQUE rendu, même inchangé : un
    // texte identique ne doit pas couper le compte en cours.
    if (l && dernier && l.n === dernier.n && l.avant === dernier.avant && l.apres === dernier.apres) return;
    // Un costume qui change (le signe, l'unité) ne se compte pas : il se lit.
    const meme = l && dernier && l.avant === dernier.avant && l.apres === dernier.apres;
    if (meme) compter(el, dernier.n, l);
    else finir(el);
    dernier = l;
  }).observe(el, { childList: true, characterData: true, subtree: true });
}

// LA COQUILLE DÉCLARE SES CHIFFRES : ce qui porte `data-compte-suivi` dans
// index.html est branché dès le chargement du module. Garde pour Node : les
// scripts de mesure importent js/saison.js, qui importe ce module.
if (typeof document !== 'undefined') {
  for (const el of document.querySelectorAll('[data-compte-suivi]')) suivreChiffre(el);
}
