/**
 * LES ÉQUIPES — les 44 franchises, leurs alignements, leurs vraies statistiques.
 *
 * JP : *faciliter de voir les équipes, leurs rosters, stats réelles, etc.
 * Aussi, jamais longue pages, fait onglets si nécessaire* ; puis *vraiment
 * assurer interface clean, facile à naviguer, peu importe petit écran ou
 * 4k pc*.
 *
 * Le jeu portait déjà tout ça et ne le montrait nulle part : les shards ont
 * les vraies colonnes de 55 saisons, et on ne pouvait les lire qu'en faisant
 * tourner la roulette jusqu'à tomber sur le bon club, ou en ouvrant une page
 * d'équipe APRÈS une simulation — où les chiffres sont ceux du moteur, pas
 * ceux de l'histoire.
 *
 * DEUX NIVEAUX, JAMAIS UNE LONGUE PAGE. La ligue d'une saison (ses clubs en
 * cartes), puis un club (ses patineurs et ses gardiens, en onglets). L'écran
 * vit dans la coquille `.modal-sheet`, qui est une boîte de hauteur bornée
 * dont le corps défile : la mesure dit 1 écran partout, au téléphone comme au
 * 4K, là où le bilan en fait quatre à cinq.
 *
 * L'INTERFACE EST ANCRÉE. JP : *ça me dérange pas si ya l'option de swipe sur
 * mobile pour voir d'autres colonnes, je veux juste que yait un ui « ancré »
 * avec onglets*. Rien de ce qui sert à NAVIGUER ne défile : l'en-tête, la
 * saison, la recherche, le bandeau du club et ses trois onglets sont hors du
 * conteneur qui défile — c'est `.eq-scroll` qui bouge, et lui seul. Le
 * tableau se balaie en largeur pour les colonnes de plus, ce qui est le seul
 * endroit où on balaie : on ne perd jamais de vue où on est.
 *
 * CE QUI EST RECONSTITUÉ EST DIT COMME TEL. Un shard porte des joueurs, pas
 * un classement : la fiche V-D d'un club se recompose des fiches de ses
 * GARDIENS et ses buts pour de ceux de ses patineurs — la méthode que
 * `check_ratings.mjs` utilise déjà pour corréler force et classement. On
 * l'écrit sur l'écran plutôt que de laisser croire à une colonne officielle.
 *
 * ET UN JOUEUR ÉCHANGÉ PORTE SA SAISON ENTIÈRE. Le shard répète sa ligne sous
 * chacun de ses clubs, avec ses totaux COMPLETS (Juolevi 2021-22 : 18 matchs
 * sous Floride, 18 sous Détroit, ce sont les mêmes 18). C'est pour ça que les
 * buts d'équipe sautent les `x`, et c'est pour ça que sa rangée porte ⇄ :
 * un chiffre qui veut dire autre chose que ce que la colonne annonce doit le
 * dire, sinon il ment.
 */

/* Les colonnes, et leur ordre : le même vocabulaire que partout ailleurs
   (AG, C, AD, DG, DD, G ; PJ, B, A, PTS, PUN, V, D, BL, MBA). */
const COL_PAT = [
  { cle: 'gp', t: 'PJ', titre: 'Matchs joués', v: p => p.gp || 0 },
  { cle: 'g', t: 'B', titre: 'Buts', v: p => p.g || 0 },
  { cle: 'a', t: 'A', titre: 'Passes', v: p => p.a || 0 },
  { cle: 'pt', t: 'PTS', titre: 'Points', v: p => p.pt || 0, heros: true },
  { cle: 'pm', t: '+/-', titre: 'Différentiel', v: p => p.pm || 0, fmt: x => (x > 0 ? `+${x}` : `${x}`) },
  { cle: 'sh', t: 'T', titre: 'Lancers', v: p => p.sh || 0 },
  { cle: 'pct', t: '%T', titre: 'Pourcentage de tir', v: p => (p.sh ? 100 * (p.g || 0) / p.sh : 0), fmt: x => (x ? x.toFixed(1) : '—') },
  { cle: 'pim', t: 'PUN', titre: 'Minutes de punition', v: p => p.pim || 0 },
  { cle: 'toi', t: 'TG', titre: 'Temps de glace par match', v: p => p.toi || 0, fmt: x => (x ? x.toFixed(1) : '—') },
];
const COL_GAR = [
  { cle: 'gp', t: 'PJ', titre: 'Matchs joués', v: p => p.gp || 0 },
  { cle: 'w', t: 'V', titre: 'Victoires', v: p => p.w || 0, heros: true },
  { cle: 'l', t: 'D', titre: 'Défaites', v: p => p.l || 0 },
  { cle: 'sv', t: '%ARR', titre: "Pourcentage d'arrêts", v: p => p.sv || 0, fmt: x => (x ? x.toFixed(3).replace(/^0/, '') : '—') },
  { cle: 'ga', t: 'MBA', titre: 'Moyenne de buts alloués', v: p => p.ga || 0, fmt: x => (x ? x.toFixed(2) : '—'), petit: true },
  { cle: 'sa', t: 'LC', titre: 'Lancers contre', v: p => p.sa || 0 },
  { cle: 'so', t: 'BL', titre: 'Blanchissages', v: p => p.so || 0 },
];

/* Le poste affiché : le même sigle que partout ailleurs dans le jeu. */
const POSTE = p => (p.p === 'G' ? 'G' : p.np === 'L' ? 'AG' : p.np === 'C' ? 'C' : p.np === 'R' ? 'AD'
  : p.p === 'D' ? (p.np === 'RD' ? 'DD' : 'DG') : p.p);

/*
 * LA FICHE RECONSTITUÉE D'UN CLUB. Victoires et défaites viennent de ses
 * gardiens, les buts pour de ses patineurs (les échangés sautés, sinon on
 * compte deux fois), les buts contre de la moyenne de ses gardiens pondérée
 * par leurs matchs. C'est la méthode de `check_ratings.mjs`, et elle n'est
 * pas une colonne officielle : l'écran le dit.
 */
export function ficheDeClub(pool) {
  const G = pool.filter(p => p.p === 'G');
  const pat = pool.filter(p => p.p !== 'G');
  const V = G.reduce((s, g) => s + (g.w || 0), 0);
  const D = G.reduce((s, g) => s + (g.l || 0), 0);
  const mj = G.reduce((s, g) => s + (g.gp || 0), 0);
  // LES NULS EXISTENT, et le shard ne les porte pas : un gardien a `w` et
  // `l`, rien d'autre. Avant 2005-06 une saison en compte, donc V + D est
  // plus petit que le nombre de matchs — écrire « 50-22 » pour un club qui a
  // fait 50-22-8 serait faux. Ce qui reste porte donc son propre nombre.
  const N = Math.max(0, mj - V - D);
  const BP = pat.filter(p => !p.x).reduce((s, p) => s + (p.g || 0), 0);
  const BC = mj ? Math.round(G.reduce((s, g) => s + (g.ga || 0) * (g.gp || 0), 0)) : 0;
  return { V, D, N, BP, BC, mj, joueurs: pool.length };
}

/**
 * Ouvre l'écran des équipes.
 *
 *   ctx      { esc, ico, logo, band, vive, teamFull, teamSeasonUrl, fiche }
 *   saisons  la liste des saisons disponibles, la plus récente en tête
 *   saison   celle qu'on ouvre
 *   charger  (saison) -> { byTeam }, le shard
 */

/*
 * L'ÉTAT VIT AU MODULE, ET LES ÉCOUTEURS SE BRANCHENT UNE FOIS. Le premier
 * jet branchait ses écouteurs à chaque ouverture et les débranchait dans son
 * propre `fermer()` — sauf qu'Échap est déjà géré GLOBALEMENT dans
 * `js/game.js` (`.modal-backdrop:not(.live)`), qui cache la modale sans
 * passer par ce `fermer()` : les écouteurs restaient, et la deuxième
 * ouverture les doublait. Pire, ce même Échap fermait l'écran des équipes
 * SOUS la fiche d'un joueur — ouvrir une fiche puis la refermer sortait de
 * l'écran, et la sonde a lu « boîte 0 px » là où elle attendait un tableau.
 *
 * Tout l'état et tout le dessin vivent donc au MODULE, et les gestionnaires
 * sont branchés une seule fois (`dataset.pret`, la marque du dépôt pour ça).
 * Des fonctions refermées sur le premier appel auraient gardé le `ctx` du
 * premier appel pour toujours : c'est le genre de chose qui ne casse qu'au
 * quatrième chantier.
 */
let modal = null, barre = null, corps = null;
let C = null, chargerShard = null, SAISONS = [];
let annee = null;
let club = null;            // le code du club ouvert, ou null pour la ligue
let onglet = 'F';           // dans un club : F, D ou G
let tri = { cle: 'pt', sens: -1 };
let filtre = '';
let pool = null;            // le shard de l'année, par équipe

const clubs = () => Object.keys(pool || {}).filter(t => (pool[t] || []).length >= 8);
const cols = () => (onglet === 'G' ? COL_GAR : COL_PAT);
const dePoste = (t, c) => t.filter(p => (c === 'G' ? p.p === 'G' : c === 'D' ? p.p === 'D' : p.p === 'F'));

/* ---------- la barre : la saison et la recherche, ANCRÉES ---------- */
function dessinerBarre() {
  const { esc, ico } = C;
  barre.innerHTML = `
    ${club ? `<button type="button" class="eq-retour" title="Revenir à la ligue">${ico('i-swap')}<span>La ligue</span></button>` : ''}
    <label class="eq-annee"><span class="eq-lbl">Saison</span>
      <select class="select eq-select" aria-label="La saison à consulter">
        ${SAISONS.map(s => `<option value="${esc(s)}"${s === annee ? ' selected' : ''}>${esc(s)}</option>`).join('')}
      </select></label>
    <label class="eq-cherche">${ico('i-search')}
      <input type="search" class="eq-input" placeholder="${club ? 'Un joueur…' : 'Un club…'}" value="${esc(filtre)}" aria-label="Filtrer">
    </label>`;
}

/* ---------- la ligue : un club par carte ---------- */
function voletLigue() {
  const { esc, logo, band, teamFull, teamSeasonUrl } = C;
  const q = filtre.trim().toLowerCase();
  const liste = clubs()
    .map(t => ({ t, f: ficheDeClub(pool[t]) }))
    .filter(x => !q || x.t.toLowerCase().includes(q) || (teamFull(x.t) || '').toLowerCase().includes(q))
    .sort((a, b) => (b.f.V - b.f.D) - (a.f.V - a.f.D) || b.f.BP - a.f.BP);
  if (!liste.length) return `<div class="eq-vide">Aucun club ne répond à « ${esc(filtre)} ».</div>`;
  return `<div class="eq-scroll"><div class="eq-grille">${liste.map(({ t, f }) => {
    const b = band(t);
    return `<button type="button" class="eq-carte" data-club="${esc(t)}" style="--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
      <span class="eq-carte-band">${logo(t, 26)}<span class="eq-carte-tag">${esc(t)}</span></span>
      <span class="eq-carte-nom">${esc(teamFull(t) || t)}</span>
      <span class="eq-carte-fiche"><b>${f.V}-${f.D}${f.N ? `-${f.N}` : ''}</b><span>${f.BP} BP · ${f.BC} BC</span></span>
      <span class="eq-carte-pied">${f.joueurs} joueurs${teamSeasonUrl(t, annee) ? ' · fiche officielle ↗' : ''}</span>
    </button>`;
  }).join('')}</div>
  <p class="eq-note">Fiches <strong>reconstituées</strong> des colonnes de la saison : les victoires et les défaites viennent des gardiens (le troisième nombre est ce qui reste : les nuls, que le shard ne porte pas), les buts pour des patineurs. Un shard porte des joueurs, pas un classement.</p></div>`;
}

/* ---------- un club : le bandeau et les onglets ANCRÉS, la table défile ---------- */
function voletClub() {
  const { esc, ico, logo, band, teamFull, teamSeasonUrl } = C;
  const tout = pool[club] || [];
  const q = filtre.trim().toLowerCase();
  const CO = cols();
  const dedans = dePoste(tout, onglet).filter(p => !q || p.n.toLowerCase().includes(q));
  const col = CO.find(c => c.cle === tri.cle) || CO[0];
  const rangs = dedans.slice().sort((a, b) => (col.v(a) - col.v(b)) * tri.sens || (b.gp || 0) - (a.gp || 0));
  const f = ficheDeClub(tout);
  const url = teamSeasonUrl(club, annee);
  const b = band(club);
  const echange = rangs.some(p => p.x);
  return `
    <div class="eq-tete" style="--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
      <span class="eq-tete-band">${logo(club, 30)}<span>${esc(club)}</span></span>
      <span class="eq-tete-nom">${esc(teamFull(club) || club)} <em>${esc(annee)}</em></span>
      <span class="eq-tete-fiche">${f.V}-${f.D}${f.N ? `-${f.N}` : ''} · ${f.BP} BP · ${f.BC} BC</span>
      ${url ? `<a class="eq-tete-ext" href="${url}" target="_blank" rel="noopener" title="La saison ${esc(annee)} de ce club sur Hockey-Reference">${ico('i-ext')}</a>` : ''}
    </div>
    <div class="eq-onglets" role="tablist">
      ${[['F', 'Attaquants'], ['D', 'Défenseurs'], ['G', 'Gardiens']].map(([c, nom]) =>
        `<button type="button" role="tab" data-poste="${c}" class="${c === onglet ? 'on' : ''}" aria-selected="${c === onglet}">${nom} <span>${dePoste(tout, c).length}</span></button>`).join('')}
    </div>
    <div class="eq-scroll"><table class="eq-table">
      <thead><tr><th class="left">Joueur</th><th>Pos</th>
        ${CO.map(c => `<th class="eq-th${c.heros ? ' heros' : ''}${c.cle === tri.cle ? ' trie' : ''}" data-tri="${esc(c.cle)}" title="${esc(c.titre)}">${c.t}${c.cle === tri.cle ? (tri.sens < 0 ? ' ▾' : ' ▴') : ''}</th>`).join('')}
      </tr></thead>
      <tbody>${rangs.map(p => `<tr>
        <td class="left"><button type="button" class="eq-joueur" data-joueur="${esc(String(p.id))}">${esc(p.n)}${p.x ? '<i class="eq-echange" title="Échangé en cours de saison : ces totaux sont ceux de sa SAISON ENTIÈRE, pas de son passage ici">⇄</i>' : ''}</button></td>
        <td class="sub-cell">${esc(POSTE(p))}</td>
        ${CO.map(c => `<td class="stat${c.heros ? ' heros' : ''}">${esc(String(c.fmt ? c.fmt(c.v(p)) : c.v(p)))}</td>`).join('')}
      </tr>`).join('') || `<tr><td colspan="${CO.length + 2}" class="eq-vide">Personne.</td></tr>`}</tbody>
    </table>
    ${echange ? '<p class="eq-note">⇄ Échangé en cours de saison : le shard répète sa ligne sous chacun de ses clubs, avec ses totaux de la saison ENTIÈRE.</p>' : ''}
    </div>`;
}

function dessiner() {
  dessinerBarre();
  corps.innerHTML = club ? voletClub() : voletLigue();
  const sc = corps.querySelector('.eq-scroll');
  if (sc) sc.scrollTop = 0;
}

/* Seul le corps se redessine quand on tape : redessiner la barre reprendrait
   le focus au champ, et on ne pourrait pas taper deux lettres de suite. */
function redessinerCorps() {
  corps.innerHTML = club ? voletClub() : voletLigue();
}

async function charge() {
  corps.innerHTML = '<div class="eq-vide">On ouvre le vestiaire…</div>';
  try { pool = (await chargerShard(annee)).byTeam; }
  catch { pool = null; }
  if (!pool) { corps.innerHTML = `<div class="eq-vide">La saison ${C.esc(annee)} n'est pas disponible hors ligne.</div>`; return; }
  dessiner();
}

/* ---------- les gestionnaires, branchés une seule fois ---------- */
function clic(ev) {
  const t = ev.target;
  if (t === modal || t.closest('.eq-close')) { fermer(); return; }
  if (t.closest('.eq-retour')) { club = null; filtre = ''; dessiner(); return; }
  const carte = t.closest('[data-club]');
  if (carte) { club = carte.dataset.club; onglet = 'F'; tri = { cle: 'pt', sens: -1 }; filtre = ''; dessiner(); return; }
  const pos = t.closest('[data-poste]');
  if (pos) {
    onglet = pos.dataset.poste;
    // Le tri par défaut suit la colonne vedette du poste : les points pour un
    // patineur, les victoires pour un gardien.
    tri = { cle: onglet === 'G' ? 'w' : 'pt', sens: -1 };
    dessiner(); return;
  }
  const th = t.closest('[data-tri]');
  if (th) {
    const cle = th.dataset.tri;
    // La même colonne inverse le sens ; la MBA part du plus petit, comme au
    // menu de la saison.
    const petit = cols().find(c => c.cle === cle)?.petit;
    tri = tri.cle === cle ? { cle, sens: -tri.sens } : { cle, sens: petit ? 1 : -1 };
    dessiner(); return;
  }
  const bj = t.closest('[data-joueur]');
  if (bj && pool && club) {
    const p = (pool[club] || []).find(x => String(x.id) === bj.dataset.joueur);
    if (p) C.fiche(p);
  }
}
function change(ev) {
  if (!ev.target.closest('.eq-select')) return;
  annee = ev.target.value; club = null; filtre = '';
  charge();
}
function saisie(ev) {
  if (!ev.target.closest('.eq-input')) return;
  filtre = ev.target.value;
  redessinerCorps();
}
function fermer() { if (C && C.fermerModale) C.fermerModale(modal); else modal.style.display = 'none'; }

export function ouvrirEquipes({ ctx, saisons, saison, charger }) {
  modal = document.getElementById('equipesModal');
  if (!modal) return;
  barre = modal.querySelector('.eq-barre');
  corps = modal.querySelector('.eq-corps');
  C = ctx; chargerShard = charger; SAISONS = saisons;
  annee = saisons.includes(saison) ? saison : saisons[0];
  club = null; onglet = 'F'; tri = { cle: 'pt', sens: -1 }; filtre = '';
  if (!modal.dataset.pret) {
    modal.dataset.pret = '1';
    modal.addEventListener('click', clic);
    modal.addEventListener('change', change);
    modal.addEventListener('input', saisie);
  }
  if (ctx.ouvrirModale) ctx.ouvrirModale(modal); else modal.style.display = 'flex';
  charge();
}
