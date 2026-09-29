/**
 * LE DÉPART DU CLASSEUR (S80) — les cartes de ton cartable qui commencent
 * une run Rogue avec toi.
 *
 * JP : *le classeur, on peut piger x cartes aux départ, ou random, selon
 * upgrades dans le mode rogue like*.
 *
 * TROIS FAÇONS, selon le vestiaire des déblocages (js/rogue.js
 * `departDuClasseur`) :
 *   AU HASARD  (sans déblocage) le classeur tire tes cartes ; tu les vois, tu
 *              les prends — ou pas ;
 *   LE TRI     il en tire deux fois plus, et tu gardes celles que tu veux ;
 *   OUVERT     tout le classeur est à toi : tu choisis.
 * Le nombre de cartes vient des pages débloquées (une, puis deux, trois,
 * quatre), et leur salaire ensemble tient dans le BUDGET DU CLASSEUR (le
 * plafond de la run, moins l'espace qu'elle garde, moins des plombiers) : une
 * carte qui ne rentre plus reste visible, avec ce qui manque.
 *
 * RIEN SANS UN GESTE : toucher une carte ouvre sa fiche ; « Prendre » la met
 * dans ta run ; « Commencer la run » part avec ce qui est pris. Le tirage est
 * PUR (le contrôleur le sème du méta, js/rogue.js `tirageDuClasseur`) : un
 * rechargement redonne les mêmes cartes, il ne retire pas.
 *
 * ctx : { mode ('hasard' | 'tri' | 'choix'), n, budget, run (son numéro),
 *         candidats [{ cle, p, rar }], esc, mini(p, rar), qui(p), money(x),
 *         groupe(p) ('F' | 'D' | 'G'), apercu(p), onFini(cles) }
 */
const $ = id => document.getElementById(id);
const PAGE = 24;
const MOTS = {
  hasard: n => `Ton classeur te donne ${n === 1 ? 'une carte, tirée' : `${n} cartes, tirées`} au hasard. Touche une carte pour sa fiche ; « Prendre » l'amène dans ta run.`,
  tri: n => `Le tri : ton classeur te montre ${2 * n} cartes, tirées au hasard, et tu en gardes ${n === 1 ? 'une' : n}.`,
  choix: n => `Le classeur ouvert : tout ton cartable est là. Choisis ${n === 1 ? 'une carte' : `tes ${n} cartes`}.`,
};
const NOM_MODE = { hasard: 'au hasard', tri: 'le tri', choix: 'le classeur ouvert' };
const GROUPES = [['tout', 'Toutes'], ['F', 'Avants'], ['D', 'Défenseurs'], ['G', 'Gardiens']];

export function ouvrirDepartClasseur(ctx) {
  const m = $('departModal');
  if (!m) { ctx.onFini([]); return; }
  const esc = ctx.esc;
  const pris = new Set();
  const etat = { groupe: 'tout', cherche: '', montres: PAGE };
  const cout = () => ctx.candidats.filter(x => pris.has(x.cle)).reduce((a, x) => a + (x.p.$ || 0), 0);
  // Le classeur ouvert se range par salaire (la valeur de la carte dans l'économie du jeu) ; le hasard garde son ordre.
  const liste = ctx.mode === 'choix' ? ctx.candidats.slice().sort((a, b) => (b.p.$ || 0) - (a.p.$ || 0) || a.p.n.localeCompare(b.p.n, 'fr')) : ctx.candidats;
  const pourquoiPas = x => {
    if (pris.has(x.cle)) return '';
    if (pris.size >= ctx.n) return `Tu as déjà ${ctx.n === 1 ? 'ta carte' : `tes ${ctx.n} cartes`}`;
    const manque = cout() + (x.p.$ || 0) - ctx.budget;
    return manque > 0 ? `Budget : il manque ${ctx.money(manque)}` : '';
  };
  const dessiner = () => {
    const filtres = liste.filter(x => (etat.groupe === 'tout' || ctx.groupe(x.p) === etat.groupe)
      && (!etat.cherche || x.p.n.toLowerCase().includes(etat.cherche.toLowerCase())));
    const visibles = ctx.mode === 'choix' ? filtres.slice(0, etat.montres) : filtres;
    const depense = cout();
    const cartes = visibles.map(x => {
      const non = pourquoiPas(x);
      const a = pris.has(x.cle);
      return `<div class="dp-carte${a ? ' prise' : ''}" data-cle="${esc(x.cle)}">
        <button type="button" class="dp-voir" data-voir="${esc(x.cle)}" title="Voir sa fiche">${ctx.mini(x.p, x.rar)}</button>
        <span class="dp-qui">${esc(ctx.qui(x.p))}</span>
        ${a ? `<button type="button" class="btn dp-remettre" data-remettre="${esc(x.cle)}">✓ Prise · Remettre</button>`
          : `<button type="button" class="btn gold dp-prendre" data-prendre="${esc(x.cle)}"${non ? ' disabled' : ''}>Prendre</button>${non ? `<span class="dp-non">${esc(non)}</span>` : ''}`}
      </div>`;
    }).join('');
    // Prendre une carte au bas du classeur ne ramène pas en haut : le défilement se garde d'un rendu à l'autre.
    const defile = m.querySelector('.dp-corps');
    const y = defile ? defile.scrollTop : 0;
    m.innerHTML = `<div class="choix-sheet dp-sheet" role="dialog" aria-modal="true" aria-label="Le départ du classeur">
      <div class="choix-tete">
        <span class="choix-ico">📒</span>
        <div class="choix-titres"><div class="choix-titre">Le départ du classeur</div>
          <div class="choix-irl">Run ${ctx.run} · ${ctx.n} carte${ctx.n > 1 ? 's' : ''} · ${NOM_MODE[ctx.mode]}</div></div>
      </div>
      <div class="choix-corps dp-corps">
        <p class="choix-recit">${esc(MOTS[ctx.mode](ctx.n))} ${ctx.n === 1 && ctx.mode === 'hasard' ? 'Prise, elle rejoint tes plombiers ; laissée, elle reste au cartable.' : 'Celles que tu prends rejoignent tes plombiers ; les autres restent au cartable.'}</p>
        <div class="inv-plafond dp-budget${depense > ctx.budget ? ' over' : ''}">
          <div class="inv-pl-tete"><span>📒 Budget du classeur</span><b>${ctx.money(depense)} / ${ctx.money(ctx.budget)}</b></div>
          <div class="inv-pl-barre" aria-hidden="true"><i style="width:${Math.min(100, Math.round((depense / Math.max(1, ctx.budget)) * 100))}%"></i></div>
          <span class="inv-pl-rien">Ensemble, leurs salaires tiennent sous le plafond de la run, avec la place pour tes plombiers.</span>
        </div>
        ${ctx.mode === 'choix' ? `<div class="inv-filtres" role="group" aria-label="Position">${GROUPES.map(([g, nom]) => `<button type="button" class="inv-filtre${etat.groupe === g ? ' on' : ''}" data-groupe="${g}">${esc(nom)} <span>${g === 'tout' ? liste.length : liste.filter(x => ctx.groupe(x.p) === g).length}</span></button>`).join('')}</div>
          <input type="search" class="dp-cherche" placeholder="Chercher un nom" value="${esc(etat.cherche)}" aria-label="Chercher un joueur du classeur">` : ''}
        <div class="dp-grille">${cartes || '<p class="inv-vide">Aucune carte ici.</p>'}</div>
        ${ctx.mode === 'choix' && filtres.length > visibles.length ? `<button type="button" class="btn dp-plus">Voir ${Math.min(PAGE, filtres.length - visibles.length)} cartes de plus · ${filtres.length - visibles.length} en tout</button>` : ''}
      </div>
      <div class="dp-pied">
        <button type="button" class="btn go dp-commencer">${pris.size ? `Commencer la run · ${pris.size} carte${pris.size > 1 ? 's' : ''} du classeur` : 'Commencer la run sans carte du classeur'}</button>
      </div>
    </div>`;
    const corps = m.querySelector('.dp-corps');
    if (corps && y) corps.scrollTop = y;
    m.querySelectorAll('[data-voir]').forEach(b => { b.onclick = () => { const x = liste.find(y => y.cle === b.dataset.voir); if (x) ctx.apercu(x.p); }; });
    m.querySelectorAll('[data-prendre]').forEach(b => {
      b.onclick = () => { const x = liste.find(y => y.cle === b.dataset.prendre); if (x && !pourquoiPas(x)) { pris.add(x.cle); dessiner(); } };
    });
    m.querySelectorAll('[data-remettre]').forEach(b => { b.onclick = () => { pris.delete(b.dataset.remettre); dessiner(); }; });
    m.querySelectorAll('[data-groupe]').forEach(b => { b.onclick = () => { etat.groupe = b.dataset.groupe; etat.montres = PAGE; dessiner(); }; });
    const cherche = m.querySelector('.dp-cherche');
    if (cherche) cherche.onchange = () => { etat.cherche = cherche.value.trim(); etat.montres = PAGE; dessiner(); };
    const plus = m.querySelector('.dp-plus');
    if (plus) plus.onclick = () => { etat.montres += PAGE; dessiner(); };
    m.querySelector('.dp-commencer').onclick = () => {
      m.hidden = true; m.innerHTML = '';
      document.body.classList.remove('choix-ouvert');
      ctx.onFini([...pris]);
    };
  };
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  dessiner();
}
