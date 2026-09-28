/*
 * LE SITE PUBLIÉ, VU DE L'APPAREIL (1.0). JP : *pour mobile, pour limiter
 * taille, télécharger image en background au lieu d'intégrer*.
 *
 * L'APK n'emporte plus les 3 900 visages recadrés (57 Mo) : il les demande au
 * site publié, en arrière-plan, et le travailleur de service les garde
 * (sw.js, tiroir VISAGES). Sur le Web, rien ne change : les visages restent
 * relatifs à la page. L'adresse est celle de GitHub Pages du dépôt
 * (Settings → Pages) ; GitHub Pages répond avec `access-control-allow-origin: *`,
 * donc la WebView de Capacitor (https://localhost) peut les mettre en cache.
 */

export const DISTANT = 'https://ouellettejeanphilippe-source.github.io/hockey/';

/* Le préfixe des visages : le site publié dans l'application, rien sur le Web. */
export function baseVisages() {
  return (typeof window !== 'undefined' && window.Capacitor) ? DISTANT : '';
}
