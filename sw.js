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
 *   visages, écussons et      cache d'abord, dans un tiroir qui survit aux
 *   photos d'action (img/)    versions (S78) : la page le remplit une fois,
 *                             en arrière-plan (message `precharger`)
 *   shards (data/seasons)     réseau seulement : IndexedDB s'en occupe déjà,
 *                             avec la version des cotes dans sa clé ;
 *                             data/seed.json, lui, est de la coquille
 *
 * Changer VERSION jette l'ancien cache à l'activation. Les chemins sont
 * relatifs à la portée du travailleur, donc le jeu fonctionne autant à la
 * racine d'un domaine que dans le sous-dossier de GitHub Pages.
 */

const VERSION = 'cap82-3.6.0';  // 3.6.0 : la V28, tranche 5a — la méta réécrite : le Club entre deux runs (les philosophies, ton club, le palmarès), trois crans d'exigence, le solde des déblocages d'avant ; « Une run neuve » ne plante plus après une run finie
const COQUILLE = `${VERSION}-coquille`;
const PORTRAITS = `${VERSION}-portraits`;
const PORTRAITS_MAX = 600;   // à peu près deux ligues de visages
// Les visages recadrés, les écussons et les photos d'action (img/, S78) : hors du préfixe « cap82- », donc gardés
// d'une version à l'autre. Son NOM change quand les images changent (S80 : les portraits passent de 192 à 320 px,
// JP : *les photos des joueurs sont floues*) — sinon l'ancien tiroir servirait les vieilles images pour toujours.
// L'activation jette tout autre tiroir « cap82img- » : ceux de l'application Android (web seulement depuis le
// 4 nov. 2026) partent ainsi d'eux-mêmes.
const VISAGES = 'cap82img-visages-320';

const FICHIERS = [
  './', 'index.html', 'style.css', 'site.webmanifest', 'favicon.svg',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
  // Le graphe de modules AU COMPLET : ils sont importés statiquement, donc un
  // seul qui manque casse le premier `import` et la page ne démarre pas.
  // `scripts/check_coquille.mjs` le vérifie, il ne se relit pas.
  'js/game.js', 'js/sim.js', 'js/ratings.js', 'js/data.js', 'js/logos.js',
  'js/traits.js', 'js/recit.js', 'js/causes.js', 'js/direct.js', 'js/glace.js', 'js/bilan.js', 'js/actes.js',
  'js/entracte.js',
  'js/profil-style.js', 'js/impact.js',
  'js/equipes.js', 'js/saison.js', 'js/faits.js', 'js/histoires.js', 'js/pronostic.js', 'js/coquille.js', 'js/gerant.js', 'js/commentaire.js',
  'js/cartes.js', 'js/franchises.js', 'js/identites.js', 'js/greffes.js', 'js/table.js', 'js/plateau.js', 'js/tournoi.js', 'js/sons.js', 'js/sons-glace.js', 'js/sprites.js', 'js/mise-a-jour.js', 'js/version.js',
  'js/sauvegardes.js', 'js/menu.js', 'js/pile.js', 'js/glisser.js', 'js/manette.js', 'js/rogue.js', 'js/mouvement.js', 'js/rarete.js', 'js/banque.js', 'js/pieces.js', 'js/coachs-reels.js', 'js/apres-match.js', 'js/panel-tv.js', 'js/vie-gm.js', 'js/coachs.js', 'js/club.js', 'js/packs.js',
  'js/cartable.js', 'js/logos_locaux.js', 'js/exhibition.js', 'js/roles_ref.js', 'js/niveaux.js', 'js/effets.js', 'js/util.js',
  'js/actions.js',
  // 1.0 (J3-6) : js/game.js découpé ; ces modules sont importés par lui (ou chargés à la demande).
  'js/run.js', 'js/run-jeu.js', 'js/run-scenes.js', 'js/partie.js', 'js/repechage.js', 'js/alignement.js', 'js/deposer.js', 'js/joueurs.js', 'js/fiche.js', 'js/banc.js', 'js/modes-table.js', 'js/charge-table.js',
  'js/physique.js', 'js/sur-glace.js', 'js/glace-ia.js',
  'data/trophees.js', 'data/reputations.js', 'data/index.json', 'data/seed.json', 'data/portraits.json', 'data/actions.json', 'data/recrues.json', 'data/coachs.json',
  'fonts/BarlowCondensed-600-latin.woff2', 'fonts/BarlowCondensed-600-latin-ext.woff2',
  'fonts/BarlowCondensed-700-latin.woff2', 'fonts/BarlowCondensed-700-latin-ext.woff2',
  'fonts/BarlowCondensed-800-latin.woff2', 'fonts/BarlowCondensed-800-latin-ext.woff2',
  'fonts/Manrope-latin.woff2', 'fonts/Manrope-latin-ext.woff2',
  // Les polices des séries de cartes (style.css, une voix par année).
  'fonts/AbrilFatface-400-latin.woff2', 'fonts/AlfaSlabOne-400-latin.woff2', 'fonts/Anton-400-latin.woff2', 'fonts/ArchivoBlack-400-latin.woff2', 'fonts/BebasNeue-400-latin.woff2', 'fonts/BigShouldersDisplay-700-latin.woff2', 'fonts/Bungee-400-latin.woff2', 'fonts/Exo2-800i-latin.woff2', 'fonts/Graduate-400-latin.woff2', 'fonts/Kanit-900i-latin.woff2', 'fonts/Michroma-400-latin.woff2', 'fonts/Monoton-400-latin.woff2', 'fonts/Orbitron-700-latin.woff2', 'fonts/Oswald-500-latin.woff2', 'fonts/PlayfairDisplay-700-latin.woff2', 'fonts/PlayfairDisplay-700i-latin.woff2', 'fonts/Rajdhani-700-latin.woff2', 'fonts/Righteous-400-latin.woff2', 'fonts/RussoOne-400-latin.woff2', 'fonts/Teko-500-latin.woff2', 'fonts/Ultra-400-latin.woff2',
  'fonts/NotoEmoji-1.woff2', 'fonts/NotoEmoji-2.woff2', 'fonts/NotoEmoji-3.woff2', 'fonts/NotoEmoji-4.woff2',
  'fonts/NotoEmoji-5.woff2', 'fonts/NotoEmoji-6.woff2', 'fonts/NotoEmoji-7.woff2', 'fonts/NotoEmoji-8.woff2',
  'fonts/NotoEmoji-9.woff2',
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
      .then(keys => Promise.all(keys.filter(k => (k.startsWith('cap82-') && !k.startsWith(VERSION)) || (k.startsWith('cap82img-') && k !== VISAGES)).map(k => caches.delete(k))))
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

/*
 * LE RÉSEAU D'ABORD, ET JAMAIS LE CACHE HTTP (1er nov. 2026 ; JP : *quand on republie, le browser utilise souvent
 * l'ancienne version un temps crisse*). GitHub Pages sert chaque fichier avec `max-age=600` : un `fetch` ordinaire le
 * reprenait du cache du navigateur sans demander au serveur, et la page mélangeait l'ancienne version et la neuve.
 * `no-cache` revalide chaque fichier (un 304 quand il n'a pas bougé) : la page charge toujours ce que le serveur sert.
 * Une navigation ne prend pas d'options : on la refait à son adresse.
 */
async function reseauDabord(req) {
  const cache = await caches.open(COQUILLE);
  try {
    const rep = await fetch(req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' }));
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
  try {
    const rep = await fetch(req);
    if (rep && rep.ok) cache.put(req, rep.clone());
    return rep;
  } catch {
    // Hors ligne et pas encore gardé : l'image se retire d'elle-même (`onerror`).
    return Response.error();
  }
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
  if (url.pathname.endsWith('/sw.js')) return;   // la version que le menu relit (js/mise-a-jour.js) : le réseau seul, rien au cache
  ev.respondWith(reseauDabord(req));
});
