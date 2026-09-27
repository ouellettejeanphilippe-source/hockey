/**
 * LE CARTABLE (S79) — la collection de cartes de joueurs, d'une partie à
 * l'autre, dans les deux modes.
 *
 * JP : *page vestiaire devrait contenir toutes les cartes, comme un cartable
 * de carte, clickables, etc, avec stats de la saison en cours et saisons
 * réelles comme vraie carte. Je veux collectionner.*
 *
 * L'onglet Vestiaire devient le cartable dès que la saison commence (le
 * repêchage garde son bassin tant qu'on bâtit ; le Rogue ne repêche jamais) :
 *   - TON ÉQUIPE : les cartes de ton alignement, avec leur saison en cours (les
 *     journées RÉVÉLÉES, jamais la fin de l'année) et leur vraie saison ;
 *   - LA COLLECTION : chaque carte tirée, signée ou alignée, par saison et par
 *     club, avec la complétion (« 1985-86 · EDM 12 / 27 »), les variantes
 *     obtenues (base, parallèle, holo, or) et les doublons.
 * Une carte s'ouvre sur sa fiche.
 *
 * LE STOCKAGE (`cap82_cartable`) : clé du joueur-saison-club → les variantes
 * obtenues (compte par variante), les numéros d'une or, le nombre de copies.
 * Hors du moteur : rien ici ne touche une saison. La collection du Rogue
 * (`cap82_rogue.collection`, S77) y entre une fois, en cartes de base.
 */
const CLE_CARTABLE = 'cap82_cartable';
const VIDE = () => ({ v: 1, joueurs: {}, migre: false });
export const VARIANTES = [
  ['commune', 'Base', '◆'], ['peu', 'Parallèle', '◆◆'], ['rare', 'Holo', '✦'], ['legendaire', 'Or', '★'],
];
const RANG = { commune: 0, peu: 1, rare: 2, legendaire: 3 };

function ecrire(c) { try { localStorage.setItem(CLE_CARTABLE, JSON.stringify(c)); } catch { /* ignore */ } }
export function lireCartable() {
  let c = null;
  try { c = JSON.parse(localStorage.getItem(CLE_CARTABLE) || 'null'); } catch { c = null; }
  if (!c || typeof c.joueurs !== 'object') c = VIDE();
  if (!c.migre) {
    try {
      const m = JSON.parse(localStorage.getItem('cap82_rogue') || 'null');
      for (const k of (m && m.collection) || []) if (!c.joueurs[k]) c.joueurs[k] = { v: { commune: 1 }, n: 1 };
    } catch { /* ignore */ }
    c.migre = true;
    ecrire(c);
  }
  return c;
}
/*
 * DES CARTES ENTRENT AU CARTABLE. `doublons` : une copie de plus compte (un
 * pack) ; sinon (l'alignement au départ d'une saison, une signature déjà
 * tirée) seule une variante NEUVE s'ajoute. Rend le nombre de joueurs neufs.
 */
export function ajouterAuCartable(entrees = [], { doublons = true } = {}) {
  const c = lireCartable();
  let neufs = 0;
  for (const e of entrees) {
    if (!e || !e.cle) continue;
    const rar = RANG[e.rar] !== undefined ? e.rar : 'commune';
    const x = c.joueurs[e.cle];
    if (!x) { c.joueurs[e.cle] = { v: { [rar]: 1 }, n: 1, ...(e.num ? { num: [e.num] } : {}) }; neufs++; continue; }
    if (!doublons && x.v[rar]) continue;
    x.v[rar] = (x.v[rar] || 0) + 1;
    x.n = (x.n || 0) + 1;
    if (e.num) x.num = [...new Set([...(x.num || []), e.num])];
  }
  ecrire(c);
  return neufs;
}
/*
 * LES ANCIENNES PARTIES (une fois) : les joueurs qui ont porté tes couleurs
 * (l'historique, que l'album de S74 lit aussi) entrent au cartable en cartes
 * de base — un cartable qui commence vide après cent saisons mentirait.
 */
export function migrerHistorique(cles = []) {
  const c = lireCartable();
  if (c.hist) return 0;
  c.hist = true;
  ecrire(c);
  return ajouterAuCartable(cles.map(cle => ({ cle })), { doublons: false });
}
/* La meilleure variante obtenue d'une carte. */
export const meilleureVariante = x => ['legendaire', 'rare', 'peu', 'commune'].find(r => x && x.v && x.v[r]) || 'commune';
/* Les comptes du cartable : joueurs, copies, doublons, par variante, numérotées. */
export function comptesDuCartable(c = lireCartable()) {
  const xs = Object.values(c.joueurs);
  const parVariante = Object.fromEntries(VARIANTES.map(([r]) => [r, xs.filter(x => x.v && x.v[r]).length]));
  const copies = xs.reduce((a, x) => a + (x.n || 1), 0);
  return { joueurs: xs.length, copies, doublons: copies - xs.length, parVariante, numerotees: xs.filter(x => (x.num || []).length).length };
}
/* La clé d'un joueur-saison-club : « saison_club_id ». */
export const partsDe = cle => { const [s, t] = String(cle).split('_'); return { s, t }; };
/* Les ensembles : saison → club → clés ; club → saison → clés. */
export function ensembles(c = lireCartable()) {
  const parSaison = new Map(), parClub = new Map();
  for (const cle of Object.keys(c.joueurs)) {
    const { s, t } = partsDe(cle);
    if (!s || !t) continue;
    if (!parSaison.has(s)) parSaison.set(s, new Map());
    const ms = parSaison.get(s); if (!ms.has(t)) ms.set(t, []); ms.get(t).push(cle);
    if (!parClub.has(t)) parClub.set(t, new Map());
    const mc = parClub.get(t); if (!mc.has(s)) mc.set(s, []); mc.get(s).push(cle);
  }
  return { parSaison, parClub };
}

/* ---------- la page ---------- */
const etat = { vue: 'equipe', ouverts: new Set() };
/*
 * LE CARTABLE, dans `host`. ctx :
 *   esc, equipe [{ p, cle, mini, saison, vraie }], titreSaison ('À la journée 20'…),
 *   nCartes (cartes de jeu à jouer), ouvrirCartes(), fiche(cle, p), ficheEquipe(p),
 *   charger(saison) → Promise(entrée de shard : { players, byTeam }),
 *   mini(p, rar), cleDe(p), club(tag) → nom, vraie(p) → ligne de sa vraie saison.
 */
export function rendreCartable(host, ctx) {
  if (!host) return;
  const esc = ctx.esc;
  const c = lireCartable();
  const k = comptesDuCartable(c);
  const { parSaison, parClub } = ensembles(c);
  const gemmes = x => VARIANTES.filter(([r]) => x && x.v && x.v[r]).map(([r, nom, g]) => `<span class="ct-gemme v-${r}" title="${esc(nom)}${x.v[r] > 1 ? ` ×${x.v[r]}` : ''}">${g}</span>`).join('');
  const tete = `<div class="ct-tete">
      <div class="ct-comptes">
        <span class="ct-total"><b>${k.joueurs}</b> carte${k.joueurs > 1 ? 's' : ''} de joueur${k.doublons ? ` · <b>${k.doublons}</b> doublon${k.doublons > 1 ? 's' : ''}` : ''}</span>
        <span class="ct-vars">${VARIANTES.map(([r, nom, g]) => `<span class="ct-var v-${r}" title="${esc(nom)}">${g} ${esc(nom)} <b>${k.parVariante[r]}</b></span>`).join('')}${k.numerotees ? `<span class="ct-var v-num">№ Numérotées <b>${k.numerotees}</b></span>` : ''}</span>
      </div>
      <button type="button" class="btn gold ct-mes-cartes" title="Tes cartes de jeu : celles qui se gardent jusqu'au moment voulu, le personnel, le deck">🎒 Mes cartes${ctx.nCartes ? ` <span class="ct-n">${ctx.nCartes}</span>` : ''}</button>
    </div>
    <div class="ct-vues" role="tablist">
      ${[['equipe', `Ton équipe · ${ctx.equipe.length}`], ['saisons', `Par saison · ${parSaison.size}`], ['clubs', `Par club · ${parClub.size}`]]
        .map(([v, nom]) => `<button type="button" role="tab" class="ct-vue${etat.vue === v ? ' on' : ''}" data-vue="${v}" aria-selected="${etat.vue === v}">${esc(nom)}</button>`).join('')}
    </div>`;
  let corps = '';
  if (etat.vue === 'equipe') {
    corps = ctx.equipe.length
      ? `<p class="ct-mot">Les cartes de ton alignement. ${esc(ctx.titreSaison || '')} Touche une carte pour sa fiche.</p>
        <div class="ct-grille">${ctx.equipe.map(x => `<button type="button" class="ct-carte" data-equipe="${esc(x.cle)}">
          ${x.mini}
          <span class="ct-stats"><span class="ct-ligne ct-sim"><i>Cette saison</i>${esc(x.saison)}</span><span class="ct-ligne ct-vraie"><i>Vraie saison</i>${esc(x.vraie)}</span></span>
        </button>`).join('')}</div>`
      : '<p class="ct-vide">Pas encore d\'alignement.</p>';
  } else {
    const groupes = etat.vue === 'saisons'
      ? [...parSaison.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([s, m]) => ({ id: `s:${s}`, titre: s, n: [...m.values()].reduce((a, l) => a + l.length, 0), sous: `${m.size} club${m.size > 1 ? 's' : ''}` }))
      : [...parClub.entries()].sort((a, b) => (ctx.club(a[0]) || a[0]).localeCompare(ctx.club(b[0]) || b[0], 'fr')).map(([t, m]) => ({ id: `c:${t}`, titre: ctx.club(t) || t, n: [...m.values()].reduce((a, l) => a + l.length, 0), sous: `${m.size} saison${m.size > 1 ? 's' : ''}` }));
    corps = groupes.length
      ? `<p class="ct-mot">${etat.vue === 'saisons' ? 'Chaque saison est un ensemble ; chaque club, une page.' : 'Chaque club, toutes ses saisons.'} Ouvre un ensemble pour ses cartes et sa complétion.</p>
        ${groupes.map(g => `<details class="ct-set" data-set="${esc(g.id)}"${etat.ouverts.has(g.id) ? ' open' : ''}>
          <summary><span class="ct-set-nom">${esc(g.titre)}</span><span class="ct-set-sous">${esc(g.sous)}</span><b class="ct-set-n">${g.n}</b></summary>
          <div class="ct-set-corps"><p class="ct-charge">On ouvre le cartable…</p></div>
        </details>`).join('')}`
      : '<p class="ct-vide">Ta collection est vide : ouvre des packs à la boutique, ou joue une saison — ton alignement y entre.</p>';
  }
  host.innerHTML = `<div class="ct">${tete}<div class="ct-corps">${corps}</div></div>`;
  host.querySelectorAll('[data-vue]').forEach(b => { b.onclick = () => { etat.vue = b.dataset.vue; rendreCartable(host, ctx); }; });
  const mes = host.querySelector('.ct-mes-cartes');
  if (mes) mes.onclick = () => ctx.ouvrirCartes();
  host.querySelectorAll('[data-equipe]').forEach(b => {
    b.onclick = () => { const x = ctx.equipe.find(y => y.cle === b.dataset.equipe); if (x) ctx.ficheEquipe(x.p); };
  });
  // UN ENSEMBLE S'OUVRE : ses saisons se chargent, ses cartes se posent, sa complétion se compte.
  const remplir = async det => {
    const id = det.dataset.set, corpsSet = det.querySelector('.ct-set-corps');
    const [genre, val] = [id.slice(0, 1), id.slice(2)];
    const paires = genre === 's' ? [...(parSaison.get(val) || new Map()).entries()].map(([t, cles]) => ({ s: val, t, cles }))
      : [...(parClub.get(val) || new Map()).entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([s, cles]) => ({ s, t: val, cles }));
    const entrees = new Map();
    for (const s of new Set(paires.map(x => x.s))) { try { entrees.set(s, await ctx.charger(s)); } catch { /* saison indisponible */ } }
    const blocs = paires.sort((a, b) => (genre === 's' ? (ctx.club(a.t) || a.t).localeCompare(ctx.club(b.t) || b.t, 'fr') : b.s.localeCompare(a.s))).map(({ s, t, cles }) => {
      const e = entrees.get(s);
      const club = (e && e.byTeam && e.byTeam[t]) || [];
      const parCle = new Map(club.map(p => [ctx.cleDe(p), p]));
      const cartes = cles.map(cle => ({ cle, p: parCle.get(cle), x: c.joueurs[cle] })).filter(y => y.p).sort((a, b) => a.p.n.localeCompare(b.p.n, 'fr'));
      const total = club.length;
      return `<div class="ct-page">
        <div class="ct-page-tete"><b>${esc(genre === 's' ? (ctx.club(t) || t) : s)}</b><span class="ct-completion${total && cles.length >= total ? ' complet' : ''}">${cles.length}${total ? ` / ${total}` : ''}</span>
          ${total ? `<span class="ct-barre" aria-hidden="true"><i style="width:${Math.min(100, Math.round((cles.length / total) * 100))}%"></i></span>` : ''}</div>
        <div class="ct-grille">${cartes.map(y => `<button type="button" class="ct-carte" data-cle="${esc(y.cle)}">
          ${ctx.mini(y.p, meilleureVariante(y.x))}
          <span class="ct-badges">${gemmes(y.x)}${(y.x.n || 1) > 1 ? `<span class="ct-double">×${y.x.n}</span>` : ''}${(y.x.num || []).map(n => `<span class="ct-num">${esc(n)}</span>`).join('')}</span>
          <span class="ct-stats"><span class="ct-ligne ct-vraie"><i>Vraie saison</i>${esc(ctx.vraie(y.p))}</span></span>
        </button>`).join('')}</div>
      </div>`;
    });
    corpsSet.innerHTML = blocs.join('') || '<p class="ct-vide">Cette saison n\'a pas pu se charger.</p>';
    if (genre === 's') {
      const e = entrees.get(val);
      const n = paires.reduce((a, x) => a + x.cles.length, 0);
      const sous = det.querySelector('.ct-set-n');
      if (e && e.players && sous) sous.textContent = `${n} / ${e.players.length}`;
    }
    corpsSet.querySelectorAll('[data-cle]').forEach(b => {
      b.onclick = () => {
        const { s, t } = partsDe(b.dataset.cle);
        const e = entrees.get(s);
        const p = e && (e.byTeam[t] || []).find(q => ctx.cleDe(q) === b.dataset.cle);
        if (p) ctx.fiche(b.dataset.cle, p);
      };
    });
  };
  host.querySelectorAll('details.ct-set').forEach(det => {
    if (det.open) remplir(det);
    det.addEventListener('toggle', () => {
      if (det.open) { etat.ouverts.add(det.dataset.set); remplir(det); } else etat.ouverts.delete(det.dataset.set);
    });
  });
}
