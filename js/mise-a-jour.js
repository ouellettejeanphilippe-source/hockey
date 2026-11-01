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
 * LA VERSION WEB SE MET À JOUR TOUTE SEULE (JP : *quand on republie, le browser utilise souvent l'ancienne version un
 * temps crisse*). Le site (GitHub Pages) suit main ; deux choses gardaient l'ancienne version au téléphone : le cache
 * HTTP du navigateur (`max-age=600`, que le travailleur de service ne contourne plus : sw.js, `no-cache`), et
 * l'application qu'on ne ferme jamais, qui ne recharge jamais. `surveillerLaVersion` compare la version du code qui
 * tourne (`VERSION`, js/version.js) au sw.js du serveur — au démarrage, au retour dans l'application, toutes les
 * `VERIF` — et, plus récente, fait prendre la coquille neuve au travailleur de service, puis recharge quand c'est sans
 * dommage : au menu titre, ou au retour après une absence d'au moins `ABSENCE`. Jamais au milieu d'un geste ; rien
 * n'efface le stockage : les parties restent.
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

/* La version neuve que le serveur sert, si elle passe celle qui tourne ; null sinon. */
export function versionNeuve(texteDuServeur, installee) {
  const version = versionDe(texteDuServeur || '');
  return version && installee && plusRecente(version, installee) ? version : null;
}

const VERIF = 10 * 60e3;   // la version du serveur se relit au plus tard ça après la dernière fois, ms
const ABSENCE = 60e3;      // revenir dans l'application après ça d'absence, ms : recharger ne coupe rien
const PATIENCE = 30e3;     // au plus ça d'attente que la coquille neuve soit téléchargée, ms
let prete = null, cacheDepuis = 0, enCours = null;
/* Recharger pour une version, une seule fois par session : si le CDN sert encore un vieux fichier quelques minutes,
   la page ne recharge pas en boucle — elle réessaiera à la session suivante. */
const TENTEE = 'cap82_maj_tentee';
const dejaTentee = v => { try { return sessionStorage.getItem(TENTEE) === v; } catch { return false; } };
function recharger() {
  if (!prete || dejaTentee(prete)) return;
  try { sessionStorage.setItem(TENTEE, prete); } catch { /* rien */ }
  location.reload();
}
const auTitre = () => { const m = document.getElementById('menuDepart'); return !!m && !m.classList.contains('en-jeu'); };
/* La version Web : relire celle du serveur (le paramètre passe le cache du CDN) ; neuve, la coquille neuve se prend. */
function verifier() {
  if (enCours) return enCours;
  enCours = (async () => {
    try {
      if (!prete) {
        const neuve = versionNeuve(await (await fetch(`sw.js?v=${Date.now()}`, { cache: 'no-store' })).text(), VERSION);
        if (!neuve || dejaTentee(neuve)) return;
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const prise = new Promise(r => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, PATIENCE); });
          await reg.update();
          if (reg.installing || reg.waiting) await prise;
        }
        prete = neuve;
      }
      if (auTitre()) recharger();
    } catch { /* hors ligne : on relira plus tard */ } finally { enCours = null; }
  })();
  return enCours;
}
/* Au démarrage de la version Web (js/game.js) : la surveillance, au retour dans l'application et toutes les VERIF. */
export function surveillerLaVersion() {
  if (plateforme() || !('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cacheDepuis = Date.now(); return; }
    if (prete && cacheDepuis && Date.now() - cacheDepuis >= ABSENCE) { recharger(); return; }
    verifier();
  });
  setInterval(verifier, VERIF);
  verifier();
}
/* Le menu titre s'ouvre : une version neuve déjà prise s'applique tout de suite. */
export function appliquerAuTitre() { recharger(); }

/* Ce qu'on offre au menu de l'APK et de l'exe, ou null : à jour, hors ligne, ou GitHub qui ne répond pas. */
export async function miseAJour() {
  const ou = plateforme();
  if (!ou) return null;
  try {
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

/* Télécharger : sur Android, la navigation hors de l'application ouvre le navigateur de l'appareil, qui reçoit l'APK ;
   sous Windows, la fenêtre neuve part au navigateur (`setWindowOpenHandler`, desktop/main.js). */
export function telecharger(url) {
  if (plateforme() === 'apk') location.href = url;
  else window.open(url, '_blank');
}
