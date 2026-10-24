/*
 * LES PHOTOS D'ACTION (1.0). JP : *pense à des cartes complexes, trouve des
 * images, pas juste des faces, si tu peux*.
 *
 * La LNH publie une photo de match pour la plupart des joueurs d'après 2005.
 * `data/actions.json` (scripts/actions.mjs) dit qui en a une : un joueur
 * absent n'est jamais demandé, et sa carte garde son portrait. Une carte
 * demande `actionSrc(id)` — une adresse d'image 5:7 (400 × 560), ou null.
 *
 * SUR LE WEB, les photos sont recadrées à la fabrication (img/actions/,
 * versionnées depuis oct. 2026 pour que GitHub Pages les serve ;
 * scripts/actions.mjs les refait). Au démarrage, on en demande UNE ; absente,
 * aucune carte n'en demande d'autre. Toute carte la montre dès qu'elle existe
 * (`photoAction`, js/cartes.js).
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
 *
 * LES PHOTOS LIBRES (oct. 2026, scripts/actions_commons.mjs). Pour un joueur que
 * la LNH ne montre pas, une photo de son époque sous licence libre : Wikimedia
 * Commons (`commons`) ou Openverse (`libres`). Le Web lit le même
 * img/actions/{id}.webp ; l'appareil télécharge `s`, leur vignette, en se
 * nommant (Wikimedia exige un User-Agent). `creditPhoto(id)` rend l'auteur, la
 * licence et la page de l'œuvre, pour le crédit que la licence demande.
 *
 * UNE PHOTO PAR SAISON (oct. 2026, scripts/actions_saisons.mjs). JP : *une photo par joueur par an pour pas
 * toujours utiliser celle de sa dernière saison, ça a l'air fou*. Quand Commons a une photo de match libre de
 * CETTE saison, la carte de cette saison la prend avant toute autre : `actionSrc(id, saison)`,
 * `cadreAction(id, saison)` et `creditPhoto(id, saison)` rendent la sienne, img/actions/{id}-{saison}.webp ;
 * une saison sans la sienne garde la photo générale. Sur l'appareil, elle se télécharge seulement quand une
 * carte la regarde, jamais dans la file de fond (une par joueur suffit à remplir le tiroir) ; même tiroir,
 * clé {id}-{saison}.
 */
import { recadrerAction } from './recadrage-action.js';
import { surAppareil } from './visages.js';

const SOURCE = id => `https://assets.nhle.com/mugs/actionshots/1296x729/${id}.jpg`;
const UA = 'Cap82-0/1.0 (https://github.com/ouellettejeanphilippe-source/hockey)';
// Le tiroir change de nom avec le cadrage (oct. 2026 : toute la hauteur, la face au centre) : l'ancien ne se relit pas.
const TIROIR = 'cap82img-actions-visage';
const cleDe = id => `https://cap82.appareil/actions/${id}.webp`;
const EN_MEME_TEMPS = 2;

let liste = null;            // les joueurs qui ont une photo (data/actions.json)
let visages = {};            // le centre de leur visage, pour le recadrage sur l'appareil (scripts/visages_actions.py)
let libres = {};             // id → la photo libre (Commons ou Openverse) : sa vignette, son auteur, sa licence
let cadres = {};             // id → le centre du visage dans la photo 5:7 [x, y], pour la fenêtre de chaque série
let saisons = {};            // id → { saison → [fichier, dossier, largeur de la vignette, auteur, licence, centre du visage, cadre, club ?] }
let auteurs = [], licences = [];   // les auteurs et les licences des photos de saison, par index
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
  const p = joueurs.filter(x => x && (liste.has(Number(x.id)) || deSaison(x.id, x.s, x.t))).sort((a, b) => pts(b) - pts(a))[0];
  return p ? actionSrc(p.id, p.s, p.t) : null;
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
      const lu = await r.json(), ids = lu.ids || [];
      liste = new Set(ids);
      visages = lu.visages || {};
      libres = { ...(lu.libres || {}), ...(lu.commons || {}) };
      cadres = lu.cadres || {};
      saisons = lu.saisons || {};
      auteurs = lu.auteurs || [];
      licences = lu.licences || [];
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

/*
 * La photo de CETTE saison du joueur (scripts/actions_saisons.mjs), ou null : il n'en a pas, on garde la générale.
 * Un joueur échangé a une carte par club dans la même saison : sa photo porte alors son club (le 8e champ), et
 * seule la carte de ce club la prend.
 */
function deSaison(id, saison, club) {
  const e = saison && saisons[Number(id)] && saisons[Number(id)][saison];
  return e && (!e[7] || !club || e[7] === club) ? e : null;
}
const nomCommons = f => encodeURIComponent(f.replace(/ /g, '_'));
const pageCommons = f => `https://commons.wikimedia.org/wiki/File:${nomCommons(f)}`;
/* La vignette de Commons d'une photo de saison : la même adresse pour la fabrication et pour l'appareil. */
export const vignetteCommons = ([f, dossier, largeur]) =>
  `https://upload.wikimedia.org/wikipedia/commons/${largeur ? 'thumb/' : ''}${dossier[0]}/${dossier}/${nomCommons(f)}${largeur ? `/${largeur}px-${nomCommons(f)}` : ''}`;

/*
 * Le crédit d'une photo libre : { auteur, licence, url } (la page de l'œuvre), ou null pour une photo de la
 * LNH ou un joueur sans photo. Avec la saison, celui de sa photo de saison s'il y en a une.
 */
export function creditPhoto(id, saison, club) {
  const ps = deSaison(id, saison, club);
  if (ps) return { auteur: auteurs[ps[3]], licence: licences[ps[4]], url: pageCommons(ps[0]) };
  const c = libres[Number(id)];
  if (!c) return null;
  return { auteur: c.a, licence: c.l, url: c.f ? pageCommons(c.f) : c.p };
}

/* Le centre du visage dans sa photo d'action, [x, y] en fractions, ou null (aucun visage sûr : la série cadre seule). */
export function cadreAction(id, saison, club) {
  const ps = deSaison(id, saison, club);
  return (ps ? ps[6] : cadres[Number(id)]) || null;
}

/* L'image d'action d'un joueur, 5:7, ou null (la carte garde son portrait) ; avec sa saison (et son club), celle de cette saison d'abord. */
export function actionSrc(id, saison, club) {
  id = Number(id);
  const ps = deSaison(id, saison, club);
  if (!ps && (!liste || !liste.has(id))) return null;
  const cle = ps ? `${id}-${saison}` : id;
  if (!surAppareil()) return surLeWeb ? `img/actions/${cle}.webp` : null;
  const src = prets.get(cle);
  if (src) return src;
  demander(cle);
  // En attendant celle de la saison, la générale si elle est déjà gardée (sans la demander).
  return ps ? prets.get(id) || null : null;
}

/* ---------- l'appareil Android ---------- */

// Une clé : l'id (la photo générale) ou « id-saison » (une photo de saison, à la demande seulement).
const prets = new Map();     // clé → adresse blob: d'une photo gardée
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

/* La photo de saison d'une clé « id-saison », ou null. */
const saisonDeCle = cle => (typeof cle === 'string' ? deSaison(...cle.split(/-(.+)/)) : null);

/* Les octets d'une photo (la LNH, ou sa photo libre), par le HTTP natif (hors des règles CORS). */
async function telecharger(id) {
  const http = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
  if (!http) throw new Error('CapacitorHttp absent');
  const ps = saisonDeCle(id), libre = ps ? { s: vignetteCommons(ps) } : libres[id];
  const r = await http.request(libre ? { url: libre.s, method: 'GET', responseType: 'blob', headers: { 'User-Agent': UA, 'Api-User-Agent': UA } } : { url: SOURCE(id), method: 'GET', responseType: 'blob' });
  // Sans photo, la LNH redirige vers une image générique : ce n'est pas LUI.
  if (r.status !== 200 || !r.data || (!libre && /default\.jpg/.test(r.url || ''))) return null;
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
      const ps = saisonDeCle(id);
      webp = (await recadrerAction(brut, { centre: (ps ? ps[5] : visages[id]) ?? null })).webp;
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
        // Laisse respirer l'interface ; Wikimedia et Openverse limitent les requêtes : on y va plus doucement.
        await new Promise(r => setTimeout(r, libres[id] || saisonDeCle(id) ? 600 : 60));
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
    for (const r of await t.keys()) { const m = r.url.match(/\/(\d+)(-\d{4}-\d\d)?\.webp$/); if (m) gardes.add(m[2] ? m[1] + m[2] : Number(m[1])); }
    // Le reste, des joueurs les plus récents aux plus anciens (toujours le même ordre).
    // Les photos de saison n'y entrent jamais : elles se téléchargent quand une carte les regarde.
    file = ids.filter(id => !gardes.has(id)).sort((a, b) => b - a);
    if (navigator.connection && navigator.connection.addEventListener) navigator.connection.addEventListener('change', lancer);
    window.addEventListener('online', lancer);
    lancer();
    // Pendant ce temps, les photos déjà gardées se lisent (sans réseau) : une carte les montre dès son prochain dessin.
    for (const id of [...gardes].filter(k => typeof k === 'number').sort((a, b) => b - a)) await garder(id, { reseau: false });
  } catch { /* pas de tiroir : les cartes gardent leur portrait */ }
}
