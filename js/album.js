/**
 * L'ALBUM (S74) — ce qu'on garde d'une partie à l'autre.
 *
 * JP : *pense vraiment à un kid qui joue avec ses cartes Upper Deck comme si
 * c'était Slay the Spire*. Un kid qui collectionne veut un CARTABLE : les
 * joueurs qui ont porté ses couleurs, et ceux qui ont gagné la Coupe avec lui,
 * en holographique. Les cartes de match sont parties avec la main du duel (V13-2).
 *
 * RIEN DE NEUF À SAUVEGARDER : l'album se DÉDUIT de l'historique des saisons
 * (js/game.js, `lireHistorique`). Chaque entrée porte son alignement (clé,
 * nom, club, position), son identité et le verdict de ses séries.
 */
import { IDENTITES } from './identites.js';
import { esc } from './util.js';

/* Ce que l'historique contient, compté. */
function lireAlbum(historique = []) {
  const joueurs = new Map(), identites = new Map();
  let coupes = 0;
  for (const e of historique) {
    const coupe = !!(e.series && e.series.coupe);
    if (coupe) coupes++;
    if (e.identite && IDENTITES[e.identite]) identites.set(e.identite, (identites.get(e.identite) || 0) + 1);
    for (const a of e.alignement || []) {
      if (!a || a.r || !a.k) continue;
      const j = joueurs.get(a.k) || { k: a.k, n: a.n || a.k, s: a.s, t: a.t || String(a.k).split('_')[1] || '', p: a.p || '', fois: 0, coupes: 0 };
      j.fois++;
      if (coupe) j.coupes++;
      joueurs.set(a.k, j);
    }
  }
  return { joueurs, identites, coupes, parties: historique.length };
}

/*
 * L'album en HTML. `ctx.logo(tag, taille)` pour les écussons. Deux sections :
 * les identités, et le cartable des joueurs — les champions d'abord, en holographique.
 */
export function albumHtml(historique, ctx) {
  const A = lireAlbum(historique);
  const ids = Object.entries(IDENTITES).map(([k, I]) => {
    const n = A.identites.get(k) || 0;
    return `<span class="album-id${n ? ' eue' : ''}" title="${esc(I.texte)}">${I.ico} ${esc(I.nom)}${n ? ` <b>×${n}</b>` : ''}</span>`;
  }).join('');
  const js = [...A.joueurs.values()].sort((a, b) => b.coupes - a.coupes || b.fois - a.fois || a.n.localeCompare(b.n, 'fr'));
  const champions = js.filter(j => j.coupes);
  const joueur = j => `<span class="album-joueur${j.coupes ? ' champion' : ''}" title="${esc(`${j.n} · ${j.s} · ${j.fois} partie${j.fois > 1 ? 's' : ''}${j.coupes ? ` · ${j.coupes} Coupe${j.coupes > 1 ? 's' : ''}` : ''}`)}">
    <span class="album-logo">${ctx.mug ? `<span class="album-visage">${ctx.mug({ id: Number(String(j.k).split('_').pop()) || null })}</span><span class="album-ecusson">${ctx.logo(j.t, 18)}</span>` : ctx.logo(j.t, 28)}</span>
    <span class="album-nom">${esc(j.n)}</span>
    <span class="album-saison">${esc(j.s)}${j.p ? ` · ${esc(j.p)}` : ''}</span>
    <span class="album-fois">${j.coupes ? `🏆${j.coupes > 1 ? `×${j.coupes}` : ''} ` : ''}${j.fois > 1 ? `×${j.fois}` : ''}</span>
  </span>`;
  return `<div class="album">
    <div class="album-tete">
      <span><b>${A.parties}</b> partie${A.parties > 1 ? 's' : ''}</span>
      <span><b>${A.coupes}</b> Coupe${A.coupes > 1 ? 's' : ''} 🏆</span>
      <span><b>${A.joueurs.size}</b> joueurs ont porté tes couleurs</span>
    </div>
    <h3>Tes identités</h3>
    <div class="album-ids">${ids}</div>
    <h3>Ceux qui ont porté tes couleurs</h3>
    ${champions.length ? `<p class="album-note">🏆 Ceux qui ont soulevé la Coupe avec toi.</p><div class="album-joueurs">${champions.map(joueur).join('')}</div>` : ''}
    ${js.length ? `<p class="album-note">${champions.length ? 'Et tous les autres' : 'Tous ceux qui ont porté tes couleurs'}, les plus fidèles d'abord.</p><div class="album-joueurs">${js.filter(j => !j.coupes).slice(0, 120).map(joueur).join('')}</div>` : '<div class="empty-msg">Joue une saison : tes 23 joueurs entreront au cartable.</div>'}
  </div>`;
}
