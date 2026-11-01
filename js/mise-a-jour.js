/**
 * LA MISE À JOUR, À MÊME LE MENU (1er nov. 2026 ; JP : *ajouter un bouton pour updater le jeu à même le menu principal
 * lorsque pas à jour*).
 *
 * La version du jeu, c'est celle de sw.js (`VERSION = 'cap82-3.2.0'`), la seule à monter à chaque changement ; l'APK
 * (mobile/android/app/build.gradle) et l'exe la lisent au même endroit. Chaque version poussée sur main devient une
 * release GitHub (.github/workflows/publier.yml) avec l'APK et l'installateur Windows. Le dépôt est public : le menu
 * demande la dernière release à GitHub, sans jeton, une fois l'heure au plus, et si elle est plus récente que la
 * version installée, un bouton télécharge le bon fichier — l'APK sur le téléphone (Android l'installe par-dessus,
 * la même signature, les parties gardées), l'installateur sur le PC.
 *
 * LA VERSION WEB (JP : *je parlais de mettre à jour la version Web sans perdre les saves*). Le site (GitHub Pages)
 * suit main tout seul ; c'est le téléphone qui garde l'ancienne : le travailleur de service ne prend la neuve qu'au
 * rechargement d'après, et une application qu'on ne ferme jamais ne recharge pas — le réflexe de vider les données
 * du site effaçait alors les parties, qui vivent dans le stockage de la même adresse. Le menu compare la version du
 * code qui tourne (`VERSION`, js/version.js) à celle du sw.js que le serveur sert, sans cache ; plus récente, le
 * bouton fait prendre au travailleur de service la version neuve (il recharge chaque fichier de la coquille en
 * passant le cache) puis recharge la page. Rien n'efface le stockage : les parties restent.
 */
import { surAppareil } from './visages.js';
import { VERSION } from './version.js';

const DEPOT = 'ouellettejeanphilippe-source/hockey';
const CLE = 'cap82_maj';
const DELAI = 3600e3;   // on ne redemande pas à GitHub plus d'une fois l'heure (60 demandes à l'heure, sans jeton)

/* Où le jeu tourne : l'application Android, l'application Windows, ou un navigateur (null). */
const plateforme = () => (surAppareil() ? 'apk' : typeof navigator !== 'undefined' && /Electron\//.test(navigator.userAgent) ? 'exe' : null);

/* La version écrite dans le texte de sw.js, ou dans une étiquette de release (« v3.2.0 ») ; null sinon. */
export function versionDe(texte) {
  const m = /VERSION\s*=\s*'cap82-(\d+(?:\.\d+)*)'/.exec(texte) || /^v?(\d+(?:\.\d+)*)$/.exec(String(texte).trim());
  return m ? m[1] : null;
}
/* `a` est-elle plus récente que `b` ? Chiffre par chiffre (3.10.0 passe 3.9.4). */
export function plusRecente(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
/* Le fichier d'une release qui met à jour cette plateforme : l'APK, ou l'installateur Windows. */
export function fichierPour(release, ou) {
  const assets = (release && release.assets) || [];
  const a = ou === 'apk' ? assets.find(x => /\.apk$/i.test(x.name)) : ou === 'exe' ? assets.find(x => /installateur.*\.exe$/i.test(x.name)) : null;
  return a ? a.browser_download_url : null;
}
/* La mise à jour offerte, d'une release et de la version installée : { version, url }, ou null si on est à jour. */
export function offre(release, installee, ou) {
  const version = release && versionDe(release.tag_name || '');
  const url = fichierPour(release, ou);
  return version && url && installee && plusRecente(version, installee) ? { version, url } : null;
}

/* La version Web offerte : celle que le serveur sert, si elle passe celle qui tourne ; { version, web: true } ou null. */
export function offreWeb(texteDuServeur, installee) {
  const version = versionDe(texteDuServeur || '');
  return version && installee && plusRecente(version, installee) ? { version, web: true } : null;
}

/* Ce qu'on offre au menu, ou null : à jour, hors ligne, ou le serveur (GitHub) qui ne répond pas. */
export async function miseAJour() {
  const ou = plateforme();
  try {
    if (!ou) {
      if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return null;
      return offreWeb(await (await fetch('sw.js', { cache: 'no-store' })).text(), VERSION);
    }
    const installee = VERSION;
    let memo = null;
    try { memo = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { /* rien */ }
    let release = memo && Date.now() - memo.t < DELAI ? memo.release : null;
    if (!release) {
      const rep = await fetch(`https://api.github.com/repos/${DEPOT}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!rep.ok) return null;
      const r = await rep.json();
      release = { tag_name: r.tag_name, assets: (r.assets || []).map(a => ({ name: a.name, browser_download_url: a.browser_download_url })) };
      try { localStorage.setItem(CLE, JSON.stringify({ t: Date.now(), release })); } catch { /* stockage plein */ }
    }
    return offre(release, installee, ou);
  } catch { return null; }
}

/* Mettre à jour. La version Web : le travailleur de service neuf s'installe (il recharge chaque fichier de la
   coquille sans passer par le cache, sw.js), prend la main (`skipWaiting`, `clients.claim`), et la page recharge ;
   le stockage n'est jamais touché. L'APK et l'exe : sur Android, la navigation hors de l'application ouvre le
   navigateur de l'appareil, qui reçoit l'APK ; sous Windows, la fenêtre neuve part au navigateur. */
export async function mettreAJour(o) {
  if (!o.web) {
    if (plateforme() === 'apk') location.href = o.url;
    else window.open(o.url, '_blank');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const prise = new Promise(r => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, PATIENCE); });
      await reg.update();
      if (reg.installing || reg.waiting) await prise;
    }
  } catch { /* le rechargement reprend quand même la page du serveur */ }
  location.reload();
}
const PATIENCE = 30e3;   // au plus ça d'attente que la coquille neuve soit téléchargée, ms ; au-delà, on recharge quand même
