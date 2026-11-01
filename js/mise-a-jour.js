/**
 * LA MISE À JOUR, À MÊME LE MENU (1er nov. 2026 ; JP : *ajouter un bouton pour updater le jeu à même le menu principal
 * lorsque pas à jour*).
 *
 * La version du jeu, c'est celle de sw.js (`VERSION = 'cap82-3.2.0'`), la seule à monter à chaque changement ; l'APK
 * (mobile/android/app/build.gradle) et l'exe la lisent au même endroit. Chaque version poussée sur main devient une
 * release GitHub (.github/workflows/publier.yml) avec l'APK et l'installateur Windows. Le dépôt est public : le menu
 * demande la dernière release à GitHub, sans jeton, une fois l'heure au plus, et si elle est plus récente que la
 * version installée, un bouton télécharge le bon fichier — l'APK sur le téléphone (Android l'installe par-dessus,
 * la même signature, les parties gardées), l'installateur sur le PC. Dans un navigateur, rien : le jeu y est servi
 * depuis le dossier, il est déjà à la version du dossier.
 */
import { surAppareil } from './visages.js';

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

/* Ce qu'on offre au menu, ou null : à jour, hors ligne, dans un navigateur, ou GitHub qui ne répond pas. */
export async function miseAJour() {
  const ou = plateforme();
  if (!ou) return null;
  try {
    const installee = versionDe(await (await fetch('sw.js', { cache: 'no-store' })).text());
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

/* Télécharger : sur Android, la navigation hors de l'application ouvre le navigateur de l'appareil, qui reçoit l'APK ;
   sous Windows, la fenêtre neuve part au navigateur (`setWindowOpenHandler`, desktop/main.js). */
export function telecharger(url) {
  if (plateforme() === 'apk') location.href = url;
  else window.open(url, '_blank');
}
