/*
 * LES PHOTOS D'ACTION (1.0). JP : *pense à des cartes complexes, trouve des
 * images, pas juste des faces, si tu peux*.
 *
 * La LNH publie une photo de match pour la plupart des joueurs d'après 2005.
 * `data/actions.json` (scripts/actions.mjs) dit qui en a une : un joueur
 * absent n'est jamais demandé, et sa carte garde son portrait. Une carte
 * demande `actionSrc(id)` — une adresse d'image 5:7 (400 × 560), ou null.
 *
 * SUR LE WEB, les photos sont recadrées à la fabrication (img/actions/, hors
 * du dépôt : scripts/actions.mjs les refait). La liste est versionnée mais les
 * images peuvent manquer (une copie fraîche du dépôt) : au démarrage, on en
 * demande UNE ; absente, aucune carte n'en demande d'autre.
 *
 * DANS L'APPLICATION ANDROID, l'APK n'emporte aucune photo (comme les visages,
 * js/visages.js) : l'appareil les télécharge à la LNH par le HTTP natif (le
 * site ne répond pas avec `access-control-allow-origin`), les recadre LUI-MÊME
 * avec le code de la fabrication (js/recadrage-action.js) et les garde dans
 * un tiroir du cache. Le lot est lourd à télécharger (1 691 photos brutes,
 * ≈ 550 Mo, un tiers de Mo chacune) et léger à garder (≈ 50 Mo) : la file
 * part APRÈS celle des visages, en Wi-Fi seulement, jamais si l'appareil
 * demande d'économiser les données ; une carte qu'on regarde passe en tête de
 * file. Une photo gardée devient une adresse blob: ; l'événement
 * `cap82:action` ({ id, src }) le dit à qui veut redessiner.
 */
import { recadrerAction } from './recadrage-action.js';
import { surAppareil } from './visages.js';

const SOURCE = id => `https://assets.nhle.com/mugs/actionshots/1296x729/${id}.jpg`;
const TIROIR = 'cap82img-actions-400';
const cleDe = id => `https://cap82.appareil/actions/${id}.webp`;
const EN_MEME_TEMPS = 2;

let liste = null;            // les joueurs qui ont une photo (data/actions.json)
let chargement = null;       // la promesse de actionsDisponibles()
let surLeWeb = false;        // les fichiers img/actions/ répondent

/*
 * LA PHOTO DE FOND (1.0, oct.). JP : *mettre des images en action dans le background avec un noir
 * opacité .7 pour s'assurer que ça reste lisible*. La photo du meilleur pointeur d'un groupe qui en a
 * une, par `actionSrc` — la même que sur sa carte : img/actions sur le Web, le tiroir sur l'appareil.
 * Jamais la LNH depuis le Web (le smoke le refuse). Rend son adresse, ou null.
 */
export function photoDeFond(joueurs) {
  if (!liste) return null;
  const pts = p => (p.pt ?? ((p.g || 0) + (p.a || 0))) || 0;
  const p = joueurs.filter(x => x && liste.has(Number(x.id))).sort((a, b) => pts(b) - pts(a))[0];
  return p ? actionSrc(p.id) : null;
}

/*
 * Au démarrage : la liste, et si les photos se montrent. Rend les joueurs
 * dont une carte peut montrer la photo (sur l'appareil : ceux à télécharger).
 */
export function actionsDisponibles() {
  if (!chargement) chargement = (async () => {
    try {
      const r = await fetch('data/actions.json');
      if (!r.ok) return [];
      const ids = (await r.json()).ids || [];
      liste = new Set(ids);
      if (!ids.length || surAppareil()) return ids;
      // Une vraie lecture (pas un HEAD : hors ligne, seul un GET passe par le tiroir du travailleur de service),
      // et le corps lu jusqu'au bout — une réponse laissée ouverte garde la page « occupée » pour toujours.
      const v = await fetch(`img/actions/${ids[0]}.webp`);
      await v.blob();
      surLeWeb = v.ok;
      return surLeWeb ? ids : [];
    } catch { return []; }
  })();
  return chargement;
}

/* L'image d'action d'un joueur, 5:7, ou null (la carte garde son portrait). */
export function actionSrc(id) {
  id = Number(id);
  if (!liste || !liste.has(id)) return null;
  if (!surAppareil()) return surLeWeb ? `img/actions/${id}.webp` : null;
  const src = prets.get(id);
  if (src) return src;
  demander(id);
  return null;
}

/* ---------- l'appareil Android ---------- */

const prets = new Map();     // id → adresse blob: d'une photo gardée
const enCours = new Map();   // id → promesse
const gardes = new Set();    // les photos déjà dans le tiroir
const demandes = [];         // les cartes regardées : en tête de file
let file = null;             // le reste, dans l'ordre (les plus récents d'abord)
let ouvriers = 0;
let tiroir = null;
const ouvrirTiroir = () => (tiroir = tiroir || caches.open(TIROIR));

/* Le Wi-Fi, ou à défaut une connexion rapide dont on ne sait rien ; jamais en économie de données. */
function connexionLarge() {
  if (navigator.onLine === false) return false;
  const c = navigator.connection;
  if (!c) return true;
  if (c.saveData) return false;
  if (c.type && c.type !== 'unknown') return ['wifi', 'ethernet', 'wimax'].includes(c.type);
  return !c.effectiveType || c.effectiveType === '4g';
}

/* Les octets d'une photo de la LNH, par le HTTP natif (hors des règles CORS). */
async function telecharger(id) {
  const http = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
  if (!http) throw new Error('CapacitorHttp absent');
  const r = await http.request({ url: SOURCE(id), method: 'GET', responseType: 'blob' });
  // Sans photo, la LNH redirige vers une image générique : ce n'est pas LUI.
  if (r.status !== 200 || !r.data || /default\.jpg/.test(r.url || '')) return null;
  const bin = atob(String(r.data).replace(/^data:[^,]*,/, ''));
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  return new Blob([octets], { type: 'image/jpeg' });
}

/* Lit (ou télécharge, recadre et garde) UNE photo ; rend son adresse blob:, ou null. */
function garder(id, { reseau = true } = {}) {
  if (prets.has(id)) return Promise.resolve(prets.get(id));
  if (enCours.has(id)) return enCours.get(id);
  const p = (async () => {
    const t = await ouvrirTiroir();
    const deja = await t.match(cleDe(id));
    let webp = deja ? await deja.blob() : null;
    if (!webp) {
      if (!reseau || !connexionLarge()) return null;
      const brut = await telecharger(id);
      if (!brut) return null;
      webp = (await recadrerAction(brut)).webp;
      await t.put(cleDe(id), new Response(webp, { headers: { 'content-type': 'image/webp' } }));
      gardes.add(id);
    }
    const src = URL.createObjectURL(webp);
    prets.set(id, src);
    window.dispatchEvent(new CustomEvent('cap82:action', { detail: { id, src } }));
    return src;
  })().catch(() => null).finally(() => enCours.delete(id));
  enCours.set(id, p);
  return p;
}

/* Une carte regarde un joueur : gardée, on la lit tout de suite ; sinon, en tête de file. */
function demander(id) {
  if (gardes.has(id)) { garder(id, { reseau: false }); return; }
  if (demandes.includes(id)) return;
  demandes.unshift(id);
  if (demandes.length > 48) demandes.length = 48;
  lancer();
}

/* Les ouvriers : les demandes d'abord, puis la file ; ils s'arrêtent hors Wi-Fi et repartent au retour. */
function lancer() {
  if (!file) return;   // la file part après les visages (demarrerActions)
  while (ouvriers < EN_MEME_TEMPS && connexionLarge() && (demandes.length || file.length)) {
    ouvriers++;
    (async () => {
      while (connexionLarge()) {
        const id = demandes.length ? demandes.shift() : file.shift();
        if (id === undefined) break;
        if (prets.has(id)) continue;
        await garder(id);
        await new Promise(r => setTimeout(r, 60));   // laisse respirer l'interface
      }
    })().finally(() => { ouvriers--; });
  }
}

/*
 * Sur l'appareil, après la passe des visages : relire le tiroir (les photos
 * gardées se montrent), puis compléter le lot en arrière-plan, en Wi-Fi.
 */
export async function demarrerActions() {
  if (!surAppareil() || typeof caches === 'undefined' || file) return;
  try {
    const ids = await actionsDisponibles();
    if (!ids.length) return;
    const t = await ouvrirTiroir();
    for (const r of await t.keys()) { const m = r.url.match(/(\d+)\.webp$/); if (m) gardes.add(Number(m[1])); }
    // Le reste, des joueurs les plus récents aux plus anciens (toujours le même ordre).
    file = ids.filter(id => !gardes.has(id)).sort((a, b) => b - a);
    if (navigator.connection && navigator.connection.addEventListener) navigator.connection.addEventListener('change', lancer);
    window.addEventListener('online', lancer);
    lancer();
    // Pendant ce temps, les photos déjà gardées se lisent (sans réseau) : une carte les montre dès son prochain dessin.
    for (const id of [...gardes].sort((a, b) => b - a)) await garder(id, { reseau: false });
  } catch { /* pas de tiroir : les cartes gardent leur portrait */ }
}
