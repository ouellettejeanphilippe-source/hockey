/*
 * LES JOUEURS (V7, docs/refonte-v7.md). JP : *même EHM, qui a cent fois plus d'infos, est plus clair*. Une question :
 * qui j'ai, et dans quel état ? L'effectif en un tableau, à la EHM : où il joue, ses jambes, ce qu'il a fait (ta saison
 * à ce jour, ou sa vraie saison), son salaire. Les avants, les défenseurs, les gardiens. Un en-tête trie ; un nom
 * ouvre la fiche. Rien d'autre : les lignes se règlent dans l'onglet Lignes.
 *
 * Des vraies stats seulement (PJ, B, A, PTS, +/−, tirs, % au tir ; V, D, % d'arrêts, moyenne), jamais une cote.
 */
import { SLOTS, badgesDe, PALIERS, getPlayerKey } from './sim.js';
import { esc, money, pct3, virgule } from './util.js';
import { $, G, capHitDuJour, displayStats } from './game.js';
import { compteRevele, ouvrirFiche, porteeRevele, showPlayerModal } from './fiche.js';
import { blessesAuJour } from './rogue-jeu.js';
import { slotShort } from './repechage.js';

const GROUPES = [['F', 'Avants'], ['D', 'Défenseurs'], ['G', 'Gardiens']];
const etat = { groupe: 'F', source: 'saison', tri: { F: ['pts', false], D: ['pts', false], G: ['pctArr', false] } };

const pct1 = x => `${virgule((x * 100).toFixed(1))}`;
/* Ce qu'il a fait : ta saison à ce jour (les feuilles révélées), sinon sa vraie saison. */
function statsDe(p, compte) {
  const c = compte && compte.get(p);
  if (c) {
    return p.p === 'G'
      ? { pj: c.gp, v: c.w, d: c.l, pctArr: c.sa ? c.sv / c.sa : null, moy: c.gp ? c.ga / c.gp : null }
      : { pj: c.gp, b: c.g, a: c.a, pts: c.pts, pm: c.pm, tirs: c.sh, pctTir: c.sh ? c.g / c.sh : null };
  }
  if (compte) return p.p === 'G' ? { pj: 0, v: 0, d: 0, pctArr: null, moy: null } : { pj: 0, b: 0, a: 0, pts: 0, pm: 0, tirs: 0, pctTir: null };
  const st = displayStats(p);
  return p.p === 'G'
    ? { pj: st.gp, v: st.w, d: st.l, pctArr: p.sv ?? null, moy: p.ga ?? null }
    : { pj: st.gp, b: st.g, a: st.a, pts: st.pt, pm: st.pm, tirs: p.sh ?? 0, pctTir: p.sh ? (p.g || 0) / p.sh : null };
}

const COLONNES = {
  F: [['jambes', 'Jambes'], ['pj', 'PJ'], ['b', 'B'], ['a', 'A'], ['pts', 'PTS'], ['pm', '+/−'], ['tirs', 'Tirs'], ['pctTir', '% tir'], ['sal', '$']],
  G: [['jambes', 'Jambes'], ['pj', 'PJ'], ['v', 'V'], ['d', 'D'], ['pctArr', '% arr.'], ['moy', 'Moy.'], ['sal', '$']],
};
const FORMAT = {
  pm: x => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : '0'),
  pctTir: x => (x == null ? '—' : pct1(x)),
  pctArr: x => (x == null ? '—' : pct3(x)),
  moy: x => (x == null ? '—' : virgule(x.toFixed(2))),
  sal: x => money(x),
  jambes: x => (x == null ? '—' : `<span class="jr-jambes ${x >= 80 ? 'frais' : x < 60 ? 'use' : ''}">${Math.round(x)}</span>`),
};

export function remplirJoueurs() {
  const host = $('pageJoueursCorps');
  if (!host) return;
  const L = G.ligue, jour = Math.min(G.journee || 0, L && L.calendrier ? L.calendrier.length : 0);
  const enSaison = !!(L && L.you && jour > 0);
  const compte = enSaison && etat.source === 'saison' ? compteRevele('jour') : null;
  const energie = (G.banc && G.banc.energie) || (L && L.you && ((L.you.jourLignes || [])[jour] || {}).energie) || null;
  const blesses = new Map(enSaison ? blessesAuJour(jour).map(b => [b.p, b.reste]) : []);
  const rangees = SLOTS.filter(s => G.roster[s.i]).map(s => {
    const p = G.roster[s.i];
    return { p, s, st: { ...statsDe(p, compte), jambes: energie ? (energie[getPlayerKey(p)] ?? 100) : null, sal: capHitDuJour(p) } };
  });
  const groupeDe = r => (r.p.p === 'G' ? 'G' : r.p.p === 'D' ? 'D' : 'F');
  const g = etat.groupe;
  const cols = COLONNES[g === 'G' ? 'G' : 'F'].filter(([k]) => k !== 'jambes' || energie);
  const [cle, asc] = etat.tri[g];
  const val = r => { const v = r.st[cle]; return v == null ? -Infinity : v; };
  const vues = rangees.filter(r => groupeDe(r) === g).sort((x, y) => (asc ? val(x) - val(y) : val(y) - val(x)) || x.s.i - y.s.i);
  const nom = r => {
    const b = badgesDe(r.p)[0], bl = blesses.get(r.p);
    return `<button type="button" class="jr-nom" data-i="${r.s.i}"><b>${esc(r.p.n)}</b>${bl ? ` <span class="jr-bl" title="Blessé">🩹 ${bl} m.</span>` : ''}</button>
      <small class="jr-sous">${esc(slotShort(r.s))}${b ? ` · <i class="badge pal-${b.palier}">${b.ico}</i> ${esc(PALIERS[b.palier].nom)}` : ''}</small>`;
  };
  host.innerHTML = `<div class="jr-barre">
      <div class="inv-filtres" role="tablist">${GROUPES.map(([k, t]) => `<button type="button" role="tab" data-groupe="${k}" class="inv-filtre${k === g ? ' on' : ''}" aria-selected="${k === g}">${t} <span>${rangees.filter(r => groupeDe(r) === k).length}</span></button>`).join('')}</div>
      ${enSaison ? `<div class="seg jr-source">${[['saison', 'Cette saison'], ['vraie', 'Vraie saison']].map(([k, t]) => `<button type="button" data-source="${k}" class="${etat.source === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}
    </div>
    <div class="jr-scroll"><table class="jr-table">
      <thead><tr><th class="jr-col-nom">Joueur</th>${cols.map(([k, t]) => `<th data-tri="${k}" class="${k === cle ? 'on' : ''}" role="button" tabindex="0">${t}${k === cle ? (asc ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${vues.map(r => `<tr class="${r.s.scratch ? 'reserve' : ''}${blesses.has(r.p) ? ' blesse' : ''}"><td class="jr-col-nom">${nom(r)}</td>${cols.map(([k]) => `<td>${FORMAT[k] ? FORMAT[k](r.st[k]) : r.st[k] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="jr-pied">${compte ? `Ta saison à ce jour, journée ${jour}.` : 'Sa vraie saison.'}${rangees.some(r => r.s.scratch) ? ' En gris : la réserve.' : ''}</p>`;
  host.querySelectorAll('[data-groupe]').forEach(b => { b.onclick = () => { etat.groupe = b.dataset.groupe; remplirJoueurs(); }; });
  host.querySelectorAll('[data-source]').forEach(b => { b.onclick = () => { etat.source = b.dataset.source; remplirJoueurs(); }; });
  host.querySelectorAll('[data-tri]').forEach(th => {
    const trier = () => { const k = th.dataset.tri, [c0, a0] = etat.tri[g]; etat.tri[g] = [k, c0 === k ? !a0 : k === 'moy']; remplirJoueurs(); };
    th.onclick = trier;
    th.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trier(); } };
  });
  host.querySelectorAll('.jr-nom').forEach(b => {
    b.onclick = () => {
      const p = G.roster[Number(b.dataset.i)];
      if (!p) return;
      if (L) ouvrirFiche(p, L.you, porteeRevele('saison') === 'jour' ? 'jour' : 'saison');
      else showPlayerModal(p, {});
    };
  });
}
