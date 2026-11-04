/**
 * LA MISE À JOUR DE LA VERSION WEB (1er nov. 2026 ; web seulement depuis le 4 nov. 2026, JP : *oublie APK et exe,
 * on développe maintenant web only*).
 *
 * La version du jeu, c'est celle de sw.js (`VERSION = 'cap82-3.2.0'`), la seule à monter à chaque changement ;
 * js/version.js la répète pour le code qui tourne (`check_maj` : les deux montent ensemble).
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
import { VERSION } from './version.js';

/* La version écrite dans le texte de sw.js ; null sinon. */
export function versionDe(texte) {
  const m = /VERSION\s*=\s*'cap82-(\d+(?:\.\d+)*)'/.exec(texte);
  return m ? m[1] : null;
}
/* `a` est-elle plus récente que `b` ? Chiffre par chiffre (3.10.0 passe 3.9.4). */
export function plusRecente(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
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
/* Relire la version du serveur (le paramètre passe le cache du CDN) ; neuve, la coquille neuve se prend. */
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
/* Au démarrage (js/game.js) : la surveillance, au retour dans l'application et toutes les VERIF. */
export function surveillerLaVersion() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
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
