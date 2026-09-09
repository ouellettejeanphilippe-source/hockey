/*
 * Le jeu entier hors ligne, après une première visite.
 *
 * IndexedDB gardait déjà les shards (js/data.js) et la police vit dans le
 * dépôt, mais sans travailleur de service un rechargement sans réseau ne
 * chargeait même pas la page. Celui-ci garde la COQUILLE — la page, les
 * styles, les modules, la police, les icônes, la liste des saisons — et
 * sert chaque requête selon ce qu'elle est :
 *
 *   coquille (même origine)   réseau d'abord, cache en secours : en ligne on
 *                             a toujours la dernière version, hors ligne on
 *                             a la dernière vue
 *   portraits (assets.nhle.com) cache d'abord : un visage ne change pas, et
 *                             c'est ce qui coûte le plus en données mobiles
 *   shards (data/seasons)     réseau seulement : IndexedDB s'en occupe déjà,
 *                             avec la version des cotes dans sa clé
 *
 * Changer VERSION jette l'ancien cache à l'activation. Les chemins sont
 * relatifs à la portée du travailleur, donc le jeu fonctionne autant à la
 * racine d'un domaine que dans le sous-dossier de GitHub Pages.
 */

const VERSION = 'cap82-v1';
const COQUILLE = `${VERSION}-coquille`;
const PORTRAITS = `${VERSION}-portraits`;
const PORTRAITS_MAX = 600;   // à peu près deux ligues de visages

const FICHIERS = [
  './', 'index.html', 'style.css', 'site.webmanifest', 'favicon.svg',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
  'js/game.js', 'js/sim.js', 'js/ratings.js', 'js/data.js', 'js/logos.js',
  'js/traits.js', 'js/recit.js', 'js/direct.js', 'js/bilan.js',
  'data/trophees.js', 'data/reputations.js', 'data/index.json',
  'fonts/BarlowCondensed-600-latin.woff2', 'fonts/BarlowCondensed-600-latin-ext.woff2',
  'fonts/BarlowCondensed-700-latin.woff2', 'fonts/BarlowCondensed-700-latin-ext.woff2',
  'fonts/BarlowCondensed-800-latin.woff2', 'fonts/BarlowCondensed-800-latin-ext.woff2',
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(COQUILLE)
      // Un fichier qui manque ne doit pas empêcher les autres d'entrer.
      .then(c => Promise.allSettled(FICHIERS.map(f => c.add(new Request(f, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('cap82-') && !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const estPortrait = url => url.hostname === 'assets.nhle.com';
const estShard = url => url.pathname.includes('/data/seasons/') || url.pathname.endsWith('/data/seed.json');

async function reseauDabord(req) {
  const cache = await caches.open(COQUILLE);
  try {
    const rep = await fetch(req);
    if (rep && rep.ok) cache.put(req, rep.clone());
    return rep;
  } catch {
    const enCache = await cache.match(req, { ignoreSearch: true });
    if (enCache) return enCache;
    // Une navigation vers n'importe quelle adresse de la portée retombe sur la page.
    if (req.mode === 'navigate') {
      const page = await cache.match('index.html') || await cache.match('./');
      if (page) return page;
    }
    throw new Error('hors ligne');
  }
}

async function cacheDabord(req) {
  const cache = await caches.open(PORTRAITS);
  const enCache = await cache.match(req);
  if (enCache) return enCache;
  const rep = await fetch(req);
  // Les portraits arrivent opaques (pas de CORS) : on ne peut pas lire leur
  // statut, on garde ce qui arrive et on borne le tiroir.
  if (rep && (rep.ok || rep.type === 'opaque')) {
    cache.put(req, rep.clone());
    const cles = await cache.keys();
    if (cles.length > PORTRAITS_MAX) await Promise.all(cles.slice(0, cles.length - PORTRAITS_MAX).map(k => cache.delete(k)));
  }
  return rep;
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (estPortrait(url)) { ev.respondWith(cacheDabord(req)); return; }
  if (url.origin !== self.location.origin) return;
  if (estShard(url)) return;
  ev.respondWith(reseauDabord(req));
});
