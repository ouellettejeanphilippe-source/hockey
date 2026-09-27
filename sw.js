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
 *   visages et écussons (img/) cache d'abord, dans un tiroir qui survit aux
 *                             versions (S78) : la page le remplit une fois,
 *                             en arrière-plan (message `precharger`)
 *   shards (data/seasons)     réseau seulement : IndexedDB s'en occupe déjà,
 *                             avec la version des cotes dans sa clé ;
 *                             data/seed.json, lui, est de la coquille
 *
 * Changer VERSION jette l'ancien cache à l'activation. Les chemins sont
 * relatifs à la portée du travailleur, donc le jeu fonctionne autant à la
 * racine d'un domaine que dans le sous-dossier de GitHub Pages.
 */

const VERSION = 'cap82-v19';  // v19 : les variantes de cartes, l'atelier, les visages et écussons sur l'appareil (S78)
const COQUILLE = `${VERSION}-coquille`;
const PORTRAITS = `${VERSION}-portraits`;
const PORTRAITS_MAX = 600;   // à peu près deux ligues de visages
// Les visages recadrés et les écussons (img/, S78) : hors du préfixe « cap82- », donc gardés d'une version à l'autre.
const VISAGES = 'cap82img-visages';

const FICHIERS = [
  './', 'index.html', 'style.css', 'site.webmanifest', 'favicon.svg',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
  // Le graphe de modules AU COMPLET : ils sont importés statiquement, donc un
  // seul qui manque casse le premier `import` et la page ne démarre pas.
  // `scripts/check_coquille.mjs` le vérifie, il ne se relit pas.
  'js/game.js', 'js/sim.js', 'js/ratings.js', 'js/data.js', 'js/logos.js',
  'js/traits.js', 'js/recit.js', 'js/direct.js', 'js/bilan.js',
  'js/entracte.js',
  'js/equipes.js', 'js/saison.js', 'js/pronostic.js', 'js/coquille.js', 'js/gerant.js', 'js/commentaire.js',
  'js/cartes.js', 'js/franchises.js', 'js/identites.js', 'js/combat.js', 'js/album.js', 'js/table.js', 'js/plateau.js', 'js/tournoi.js', 'js/sons.js',
  'js/sauvegardes.js', 'js/menu.js', 'js/rogue.js', 'js/mouvement.js', 'js/rarete.js', 'js/banque.js', 'js/packs.js', 'js/inventaire.js', 'js/magasin.js',
  'js/cartable.js', 'js/logos_locaux.js', 'js/exhibition.js',
  'data/trophees.js', 'data/reputations.js', 'data/index.json', 'data/seed.json', 'data/portraits.json',
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
const estVisage = url => url.origin === self.location.origin && url.pathname.includes('/img/');
// Les shards d'une saison, eux seuls : IndexedDB les garde déjà avec la
// version des cotes dans sa clé, et en préécrire 55 coûterait des mégaoctets
// à la première visite. `data/seed.json` n'en est PAS un — c'est le filet
// hors ligne de js/data.js, donc il passe par la coquille.
const estShard = url => url.pathname.includes('/data/seasons/');

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

/* Un visage ou un écusson du jeu : le tiroir d'abord, puis le réseau (et on le garde). */
async function visage(req) {
  const cache = await caches.open(VISAGES);
  const enCache = await cache.match(req, { ignoreSearch: true });
  if (enCache) return enCache;
  const rep = await fetch(req);
  if (rep && rep.ok) cache.put(req, rep.clone());
  return rep;
}

/*
 * TOUS LES VISAGES ET LES ÉCUSSONS, UNE FOIS (S78). JP : *premier opening du
 * jeu, télécharger toutes les faces et logos sur le device*. La page envoie la
 * liste ; on ne demande que ce qui manque, par paquets, et on répond quand
 * c'est fait. Coupé en route (onglet fermé), le prochain lancement reprend
 * là où on était.
 */
async function precharger(urls, cle, client) {
  const cache = await caches.open(VISAGES);
  const deja = new Set((await cache.keys()).map(r => new URL(r.url).pathname));
  const reste = urls.filter(u => !deja.has(new URL(u, self.registration.scope).pathname));
  for (let i = 0; i < reste.length; i += 24) await Promise.allSettled(reste.slice(i, i + 24).map(u => cache.add(u)));
  if (client) client.postMessage({ visagesPrets: cle, nouveaux: reste.length });
}
self.addEventListener('message', ev => {
  const d = ev.data;
  if (d && Array.isArray(d.precharger)) ev.waitUntil(precharger(d.precharger, d.cle, ev.source));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (estPortrait(url)) { ev.respondWith(cacheDabord(req)); return; }
  if (estVisage(url)) { ev.respondWith(visage(req)); return; }
  if (url.origin !== self.location.origin) return;
  if (estShard(url)) return;
  ev.respondWith(reseauDabord(req));
});
