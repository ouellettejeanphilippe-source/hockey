// Cap 82-0 en application de bureau.
//
// Le jeu est un site statique à modules ES qui lit ses shards par `fetch` et
// garde la partie dans IndexedDB. Rien de tout ça ne marche sous `file://` :
// un module chargé depuis une origine opaque ne peut pas `fetch` son voisin,
// et le service worker exige http(s). L'application sert donc le dossier du
// jeu sur 127.0.0.1 et l'ouvre — exactement l'environnement pour lequel il a
// été écrit.
//
// Le port est FIXE, et c'est le point important : l'origine
// (http://127.0.0.1:47820) est la clé sous laquelle le navigateur range
// IndexedDB et localStorage. Un port tiré au hasard à chaque lancement
// donnerait une origine neuve à chaque fois, donc une partie sauvegardée
// perdue à chaque fois.

const { app, BrowserWindow, Menu, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PORT = 47820;
const HOST = '127.0.0.1';

// En développement le dossier du jeu est le parent de `desktop/` ; empaqueté,
// il est copié dans `resources/site` (voir extraResources dans package.json).
const RACINE = app.isPackaged
  ? path.join(process.resourcesPath, 'site')
  : path.join(__dirname, '..');

const TYPES = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
}));

function servir() {
  return new Promise((resolve, reject) => {
    const serveur = http.createServer(async (req, res) => {
      let chemin;
      try {
        chemin = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
      } catch {
        res.writeHead(400).end('Requête illisible');
        return;
      }
      if (chemin.endsWith('/')) chemin += 'index.html';

      // Un `..` dans l'URL ne doit pas sortir du dossier du jeu.
      const cible = path.join(RACINE, path.normalize(chemin));
      if (cible !== RACINE && !cible.startsWith(RACINE + path.sep)) {
        res.writeHead(403).end('Hors du dossier');
        return;
      }

      try {
        const info = await fsp.stat(cible);
        if (info.isDirectory()) {
          res.writeHead(302, { Location: chemin.replace(/\/?$/, '/') }).end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': TYPES.get(path.extname(cible).toLowerCase()) || 'application/octet-stream',
          'Content-Length': info.size,
          // Le service worker gère déjà le hors-ligne ; un cache HTTP par
          // dessus ferait servir une version périmée après une mise à jour.
          'Cache-Control': 'no-cache',
        });
        fs.createReadStream(cible).pipe(res);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable : ' + chemin);
      }
    });

    serveur.once('error', reject);
    serveur.listen(PORT, HOST, () => resolve(serveur));
  });
}

let fenetre = null;

function ouvrir() {
  fenetre = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 380,          // le jeu est testé à 390 px : la fenêtre peut aller aussi bas
    backgroundColor: '#070e17',   // la couleur de thème de index.html, pour éviter le flash blanc
    title: 'Cap 82-0',
    autoHideMenuBar: true,
    webPreferences: {
      // Le jeu n'a aucun besoin de Node : on ne lui en donne pas.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  fenetre.loadURL(`http://${HOST}:${PORT}/`);

  // Un lien externe s'ouvre dans le vrai navigateur, pas dans une fenêtre du jeu.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://' + HOST)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  fenetre.on('closed', () => { fenetre = null; });
}

function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Cap 82-0',
      submenu: [
        { label: 'Recharger', accelerator: 'CmdOrCtrl+R', click: () => fenetre?.webContents.reload() },
        {
          label: 'Vider le cache hors ligne et recharger',
          click: async () => {
            // Le service worker peut retenir une ancienne coquille ; ceci la
            // jette SANS toucher à IndexedDB, donc sans perdre les parties.
            await fenetre?.webContents.session.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });
            fenetre?.webContents.reload();
          },
        },
        { type: 'separator' },
        { label: 'Plein écran', accelerator: 'F11', click: () => fenetre?.setFullScreen(!fenetre.isFullScreen()) },
        { label: 'Outils de développement', accelerator: 'F12', click: () => fenetre?.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Quitter', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    { label: 'Édition', role: 'editMenu' },
  ]));
}

// Deux instances se disputeraient le port 47820. La seconde réveille la première.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (fenetre) { if (fenetre.isMinimized()) fenetre.restore(); fenetre.focus(); }
  });

  app.whenReady().then(async () => {
    try {
      await servir();
    } catch (err) {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Cap 82-0 ne peut pas démarrer',
        `Le port ${PORT} est déjà pris (${err.code}).\n\n` +
        `Ce port est fixe parce qu'il porte l'origine sous laquelle les parties ` +
        `sauvegardées sont rangées. Fermez le programme qui l'occupe, puis relancez.`
      );
      app.quit();
      return;
    }
    menu();
    ouvrir();
  });

  app.on('window-all-closed', () => app.quit());
}
