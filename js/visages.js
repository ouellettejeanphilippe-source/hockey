/*
 * LES VISAGES SUR L'APPAREIL ANDROID (1.0). JP : *pour mobile, pour limiter
 * taille, télécharger image en background au lieu d'intégrer* ; puis *c'est
 * plus dans GitHub, juste local* — aucun site ne sert nos visages recadrés.
 *
 * L'APK n'emporte donc que la silhouette et les écussons. Au premier
 * lancement, en arrière-plan, l'appareil télécharge chaque portrait à la
 * source, le site de la LNH (la même adresse que scripts/portraits.mjs), le
 * recadre LUI-MÊME avec le même code (js/recadrage.js) et le garde dans un
 * tiroir du cache. Coupé en route, le lancement suivant reprend là où on
 * était ; hors ligne, un visage pas encore gardé montre la silhouette.
 *
 * POURQUOI LE HTTP NATIF. Le site de la LNH ne répond pas avec
 * `access-control-allow-origin` : une page peut AFFICHER ses images, pas les
 * LIRE pour les recadrer. Le module CapacitorHttp passe par Android, hors des
 * règles du navigateur. Sans lui (une version Web), rien de tout ça ne tourne :
 * la version Web a ses visages recadrés dans img/mugs.
 *
 * En attendant qu'un visage soit gardé, l'image brute de la LNH s'affiche
 * (une balise image n'a pas besoin de CORS), cadrée par la classe `brut`.
 */
import { recadrer } from './recadrage.js';

const SOURCE = id => `https://assets.nhle.com/mugs/nhl/latest/${id}.png`;
const TIROIR = 'cap82img-appareil-320';
const cleDe = id => `https://cap82.appareil/mugs/${id}.webp`;
const MARQUEUR = 'cap82_visages_appareil';
const EN_MEME_TEMPS = 4;

const prets = new Map();      // id → adresse blob: d'un visage gardé
const enCours = new Map();    // id → promesse de recadrage
let tiroir = null;

export const surAppareil = () => typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const ouvrirTiroir = () => (tiroir = tiroir || caches.open(TIROIR));

/* L'image d'un visage : gardé (blob:), sinon la silhouette — `hydrater` la remplace dès qu'on sait mieux. */
export function imgVisage(id) {
  const src = prets.get(id);
  return src
    ? `<img class="visage" src="${src}" alt="" loading="lazy" onerror="this.remove()">`
    : `<img class="visage silhouette" data-mug="${id}" src="img/mugs/silhouette.webp" alt="" loading="lazy">`;
}

/* Les octets d'un portrait de la LNH, par le HTTP natif (hors des règles CORS). */
async function telecharger(id) {
  const http = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
  if (!http) throw new Error('CapacitorHttp absent');
  const r = await http.request({ url: SOURCE(id), method: 'GET', responseType: 'blob' });
  if (r.status !== 200 || !r.data) return null;
  // `data` arrive en base64 pour une réponse binaire.
  const bin = atob(String(r.data).replace(/^data:[^,]*,/, ''));
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  return new Blob([octets], { type: 'image/png' });
}

/* Télécharge, recadre et garde UN visage ; rend son adresse blob:, ou null. */
function garder(id) {
  if (prets.has(id)) return Promise.resolve(prets.get(id));
  if (enCours.has(id)) return enCours.get(id);
  const p = (async () => {
    const t = await ouvrirTiroir();
    const deja = await t.match(cleDe(id));
    let webp = deja ? await deja.blob() : null;
    if (!webp) {
      const brut = await telecharger(id);
      if (!brut) return null;
      webp = (await recadrer(brut)).webp;
      await t.put(cleDe(id), new Response(webp, { headers: { 'content-type': 'image/webp' } }));
    }
    const src = URL.createObjectURL(webp);
    prets.set(id, src);
    return src;
  })().catch(() => null).finally(() => enCours.delete(id));
  enCours.set(id, p);
  return p;
}

/* Les images à la silhouette qui attendent leur visage : gardé → posé ; sinon, la photo brute pendant qu'on le recadre. */
function hydrater(racine) {
  const imgs = racine.matches && racine.matches('img[data-mug]') ? [racine] : racine.querySelectorAll ? [...racine.querySelectorAll('img[data-mug]')] : [];
  for (const img of imgs) {
    const id = Number(img.dataset.mug);
    if (img.dataset.brut !== '1' && navigator.onLine !== false) {
      img.dataset.brut = '1';
      img.onerror = () => { img.src = 'img/mugs/silhouette.webp'; img.onerror = null; };
      img.src = SOURCE(id);
      img.classList.replace('silhouette', 'brut');
    }
    garder(id).then(src => {
      if (!src) return;
      for (const x of document.querySelectorAll(`img[data-mug="${id}"]`)) { x.src = src; x.classList.remove('brut', 'silhouette'); x.removeAttribute('data-mug'); x.onerror = null; }
    });
  }
}

/*
 * Au démarrage : relire le tiroir (les visages déjà gardés s'affichent tout
 * de suite), guetter les images qui arrivent, puis compléter le lot en
 * arrière-plan — sauf si l'appareil demande d'économiser les données.
 */
export async function demarrerVisages(ids, { toast } = {}) {
  if (!surAppareil() || !ids || !ids.length || typeof caches === 'undefined') return;
  const t = await ouvrirTiroir();
  const gardes = new Set((await t.keys()).map(r => Number((r.url.match(/(\d+)\.webp$/) || [])[1])));
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) hydrater(n); })
    .observe(document.body, { childList: true, subtree: true });
  hydrater(document);
  const reste = ids.filter(id => !gardes.has(id));
  if (!reste.length || (navigator.connection && navigator.connection.saveData)) return;
  const cle = `${ids.length}@320`;
  let faits = 0;
  const file = reste.slice();
  const ouvrier = async () => {
    while (file.length && navigator.onLine !== false) {
      const src = await garder(file.shift());
      if (src) faits++;
      await new Promise(r => setTimeout(r, 40));   // laisse respirer l'interface
    }
  };
  await Promise.all(Array.from({ length: EN_MEME_TEMPS }, ouvrier));
  if (!file.length && faits && toast) {
    try { if (localStorage.getItem(MARQUEUR) !== cle) { localStorage.setItem(MARQUEUR, cle); toast(`📥 Les ${ids.length.toLocaleString('fr-CA')} visages sont sur ton appareil : le jeu marche hors ligne.`); } } catch { /* stockage plein */ }
  }
}
