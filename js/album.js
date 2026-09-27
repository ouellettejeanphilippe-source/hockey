/**
 * L'ALBUM (S74) — ce qu'on garde d'une partie à l'autre.
 *
 * JP : *pense vraiment à un kid qui joue avec ses cartes Upper Deck comme si
 * c'était Slay the Spire*. Un kid qui collectionne veut un CARTABLE : les
 * cartes qu'il a eues, celles qui lui manquent (en silhouette, avec leur
 * rareté — on sait ce qu'on cherche), les joueurs qui ont porté ses couleurs,
 * et ceux qui ont gagné la Coupe avec lui, en holographique.
 *
 * RIEN DE NEUF À SAUVEGARDER : l'album se DÉDUIT de l'historique des saisons
 * (js/game.js, `lireHistorique`). Chaque entrée porte son alignement (clé,
 * nom, club, position), son deck de match final, son identité et le verdict
 * de ses séries. Une entrée d'avant S74 compte pour les joueurs ; elle n'a
 * simplement pas de deck.
 */
import { CARTES_MATCH } from './combat.js';
import { IDENTITES } from './identites.js';
import { carteHtml, RARETES } from './cartes.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Ce que l'historique contient, compté. */
export function lireAlbum(historique = []) {
  const cartes = new Map(), joueurs = new Map(), identites = new Map();
  let coupes = 0;
  for (const e of historique) {
    const coupe = !!(e.series && e.series.coupe);
    if (coupe) coupes++;
    for (const c of new Set(e.deck || [])) if (CARTES_MATCH[c]) cartes.set(c, (cartes.get(c) || 0) + 1);
    if (e.identite && IDENTITES[e.identite]) identites.set(e.identite, (identites.get(e.identite) || 0) + 1);
    for (const a of e.alignement || []) {
      if (!a || a.r || !a.k) continue;
      const j = joueurs.get(a.k) || { k: a.k, n: a.n || a.k, s: a.s, t: a.t || String(a.k).split('_')[1] || '', p: a.p || '', fois: 0, coupes: 0 };
      j.fois++;
      if (coupe) j.coupes++;
      joueurs.set(a.k, j);
    }
  }
  return { cartes, joueurs, identites, coupes, parties: historique.length };
}

/*
 * L'album en HTML. `ctx.logo(tag, taille)` pour les écussons. Trois sections :
 * les cartes de match (toutes, les manquantes en silhouette), les identités,
 * et le cartable des joueurs — les champions d'abord, en holographique.
 */
export function albumHtml(historique, ctx) {
  const A = lireAlbum(historique);
  const toutes = Object.keys(CARTES_MATCH).filter(k => !CARTES_MATCH[k].maudite);
  const eues = toutes.filter(k => A.cartes.has(k)).length;
  const ordre = { commune: 0, peu: 1, rare: 2, legendaire: 3 };
  const tri = toutes.slice().sort((a, b) => ordre[CARTES_MATCH[a].rarete] - ordre[CARTES_MATCH[b].rarete] || CARTES_MATCH[a].nom.localeCompare(CARTES_MATCH[b].nom, 'fr'));
  const cartes = tri.map((k, i) => {
    const C = CARTES_MATCH[k], n = A.cartes.get(k) || 0;
    if (!n) return `<span class="album-trou tc-${C.rarete}" title="Pas encore eue — ${esc(RARETES[C.rarete].nom.toLowerCase())}"><b>?</b><small>${esc(RARETES[C.rarete].nom)}</small></span>`;
    return carteHtml({ cle: `album:${k}`, rarete: C.rarete, i, ico: C.ico, nomHtml: esc(C.nom), typeHtml: esc(`${C.cout} énergie`),
      texteHtml: esc(C.texte), coinHtml: esc(`×${n}`) }).replace('class="choix-option tc', 'class="choix-option tc lecture album-carte');
  }).join('');
  const ids = Object.entries(IDENTITES).map(([k, I]) => {
    const n = A.identites.get(k) || 0;
    return `<span class="album-id${n ? ' eue' : ''}" title="${esc(I.texte)}">${I.ico} ${esc(I.nom)}${n ? ` <b>×${n}</b>` : ''}</span>`;
  }).join('');
  const js = [...A.joueurs.values()].sort((a, b) => b.coupes - a.coupes || b.fois - a.fois || a.n.localeCompare(b.n, 'fr'));
  const champions = js.filter(j => j.coupes);
  const joueur = j => `<span class="album-joueur${j.coupes ? ' champion' : ''}" title="${esc(`${j.n} · ${j.s} · ${j.fois} partie${j.fois > 1 ? 's' : ''}${j.coupes ? ` · ${j.coupes} Coupe${j.coupes > 1 ? 's' : ''}` : ''}`)}">
    <span class="album-logo">${ctx.logo(j.t, 28)}</span>
    <span class="album-nom">${esc(j.n)}</span>
    <span class="album-saison">${esc(j.s)}${j.p ? ` · ${esc(j.p)}` : ''}</span>
    <span class="album-fois">${j.coupes ? `🏆${j.coupes > 1 ? `×${j.coupes}` : ''} ` : ''}${j.fois > 1 ? `×${j.fois}` : ''}</span>
  </span>`;
  return `<div class="album">
    <div class="album-tete">
      <span><b>${A.parties}</b> partie${A.parties > 1 ? 's' : ''}</span>
      <span><b>${A.coupes}</b> Coupe${A.coupes > 1 ? 's' : ''} 🏆</span>
      <span><b>${eues}</b> / ${toutes.length} cartes de match</span>
      <span><b>${A.joueurs.size}</b> joueurs au cartable</span>
    </div>
    <div class="album-barre" aria-hidden="true"><i style="width:${Math.round(eues / toutes.length * 100)}%"></i></div>
    <h3>Tes cartes de match</h3>
    <p class="album-note">Une carte compte quand elle finit une saison dans ton deck. Celles qui manquent se gagnent dans les gros matchs et les séries.</p>
    <div class="album-cartes">${cartes}</div>
    <h3>Tes identités</h3>
    <div class="album-ids">${ids}</div>
    <h3>Ton cartable</h3>
    ${champions.length ? `<p class="album-note">🏆 Ceux qui ont soulevé la Coupe avec toi.</p><div class="album-joueurs">${champions.map(joueur).join('')}</div>` : ''}
    ${js.length ? `<p class="album-note">${champions.length ? 'Et tous les autres' : 'Tous ceux qui ont porté tes couleurs'}, les plus fidèles d'abord.</p><div class="album-joueurs">${js.filter(j => !j.coupes).slice(0, 120).map(joueur).join('')}</div>` : '<div class="empty-msg">Joue une saison : tes 23 joueurs entreront au cartable.</div>'}
  </div>`;
}
