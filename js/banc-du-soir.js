/*
 * TON BANC CE SOIR (V23, docs/refonte-v23.md § A ; JP, 2 nov. : *une vraie expérience digne d'un roguelike ou card
 * game*). Tes pouvoirs ouverts, tes adjoints en poste et la règle de ton coach en petites cartes : ce qui a joué
 * s'allume, l'un après l'autre, avec ses périodes ; ce qui n'a pas joué reste au banc, éteint, sa condition à
 * l'infobulle. La feuille fait foi (`banc`, js/profil-style.js) — `check_banc`. Le sommaire du soir (js/bilan.js) et
 * Hier soir au Bureau (js/saison.js) le montrent pareil.
 */
import { banc } from './profil-style.js';

const PERIODE_COURTE = ['1re', '2e', '3e'];
/**
 * Le banc d'un soir : `f`, sa feuille ; `A`, `B`, ses deux clubs (le tien porte `isPlayer` ou un personnage) ; `esc`,
 * l'échappement. `joues` (V23, le Bureau) : seulement ce qui a joué — rien n'a joué, pas de banc ; le sommaire montre tout.
 * `jusqua` (V23 A2, l'entracte du duel) : les périodes déjà jouées seulement ; ce qui n'a pas encore joué dit « pas encore ».
 */
export function bancDuSoirHtml(f, A, B, esc, { joues = false, jusqua = null } = {}) {
  const toi = A.isPlayer ? A : B.isPlayer ? B : A.perso ? A : B.perso ? B : null;
  const cartes = banc(toi, f, { jusqua }).filter(c => !joues || c.joue);
  if (!cartes.length) return '';
  let i = 0;
  const carte = c => {
    const pied = c.genre === 'regle' ? (c.joue ? `+${c.jetons} 🪙` : 'pas ce soir')
      : c.genre === 'adjoint' ? `${c.reste > 1 ? `encore ${c.reste - 1}` : 'dernier match'}${c.salaire ? ` · −${c.salaire} 🪙` : ''}`
      : c.joue ? c.periodes.map(k => PERIODE_COURTE[k] || `${k + 1}e`).join(' · ') : jusqua ? 'pas encore' : 'au banc';
    return `<div class="banc-carte banc-${c.genre}${c.joue ? ' joue' : ''}"${c.joue ? ` style="--i:${i++}"` : ''} title="${esc(`${c.nom} — ${c.dit}`)}">
      <span class="banc-ico" aria-hidden="true">${c.ico}</span><b>${esc(c.nom)}</b><small>${esc(pied)}</small></div>`;
  };
  const allumes = cartes.filter(c => c.joue).length;
  const titre = jusqua ? `Ton banc, après ${jusqua === 1 ? 'une période' : 'deux périodes'}` : 'Ton banc ce soir';
  return `<div class="banc" role="group" aria-label="${titre} : ${allumes} sur ${cartes.length} ont joué">
    <div class="banc-tete"><span>${titre}</span><span>${allumes} sur ${cartes.length}</span></div>
    <div class="banc-rang">${cartes.map(carte).join('')}</div>
  </div>`;
}
