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
 * LE MÊME ÉCRAN, ENTRE DEUX SAISONS DE LA RUN (1.0) : ceux de ton équipe
 * qui restent, au choix (js/rogue-jeu.js `continuerRun`). `textes` remplace
 * les mots du classeur.
 *
 * ctx : { mode ('hasard' | 'tri' | 'choix'), n, budget, run (son numéro),
 *         candidats [{ cle, p, rar, num }], esc, qui(p), money(x),
 *         groupe(p) ('F' | 'D' | 'G'), apercu(p), onFini(cles),
 *         textes? { ico, titre, irl, recit, budget, plein, partir(n) } }
 */
import { rangeeHtml, varsEquipe } from './repechage.js';
import { jaugePlafond } from './util.js';

const $ = id => document.getElementById(id);
const PAGE = 24;
const MOTS = {
  hasard: n => `Ton classeur te donne ${n === 1 ? 'une carte, tirée' : `${n} cartes, tirées`} au hasard. Touche une carte pour sa fiche ; « Prendre » l'amène dans ta run.`,
  tri: n => `Le tri : ton classeur te montre ${2 * n} cartes, tirées au hasard, et tu en gardes ${n === 1 ? 'une' : n}.`,
  choix: n => `Le classeur ouvert : tout ton cartable est là. Choisis ${n === 1 ? 'une carte' : `tes ${n} cartes`}.`,
};
const NOM_MODE = { hasard: 'au hasard', tri: 'le tri', choix: 'le classeur ouvert' };
const GROUPES = [['tout', 'Toutes'], ['F', 'Avants'], ['D', 'Défenseurs'], ['G', 'Gardiens']];
const TEXTES_CLASSEUR = ctx => ({
  ico: '📒', titre: 'Le départ du classeur',
  irl: `Run ${ctx.run} · ${ctx.n} carte${ctx.n > 1 ? 's' : ''} · ${NOM_MODE[ctx.mode]}`,
  recit: `${MOTS[ctx.mode](ctx.n)} ${ctx.n === 1 && ctx.mode === 'hasard' ? 'Prise, elle rejoint tes bouche-trous ; laissée, elle reste au cartable.' : 'Celles que tu prends rejoignent tes bouche-trous ; les autres restent au cartable.'}`,
  budget: '📒 Budget du classeur',
  plein: `Tu as déjà ${ctx.n === 1 ? 'ta carte' : `tes ${ctx.n} cartes`}`,
  partir: n => (n ? `Commencer la run · ${n} carte${n > 1 ? 's' : ''} du classeur` : 'Commencer la run sans carte du classeur'),
});

export function ouvrirDepartClasseur(ctx) {
  const m = $('departModal');
  if (!m) { ctx.onFini([]); return; }
  const esc = ctx.esc;
  const T = { ...TEXTES_CLASSEUR(ctx), ...(ctx.textes || {}) };
  const pris = new Set();
  const etat = { groupe: 'tout', cherche: '', montres: PAGE };
  const cout = () => ctx.candidats.filter(x => pris.has(x.cle)).reduce((a, x) => a + (x.p.$ || 0), 0);
  // Le classeur ouvert se range par salaire (la valeur de la carte dans l'économie du jeu) ; le hasard garde son ordre.
  const liste = ctx.mode === 'choix' ? ctx.candidats.slice().sort((a, b) => (b.p.$ || 0) - (a.p.$ || 0) || a.p.n.localeCompare(b.p.n, 'fr')) : ctx.candidats;
  const pourquoiPas = x => {
    if (pris.has(x.cle)) return '';
    if (pris.size >= ctx.n) return T.plein;
    const manque = cout() + (x.p.$ || 0) - ctx.budget;
    return manque > 0 ? `Budget : il manque ${ctx.money(manque)}` : '';
  };
  const dessiner = () => {
    const filtres = liste.filter(x => (etat.groupe === 'tout' || ctx.groupe(x.p) === etat.groupe)
      && (!etat.cherche || x.p.n.toLowerCase().includes(etat.cherche.toLowerCase())));
    const visibles = ctx.mode === 'choix' ? filtres.slice(0, etat.montres) : filtres;
    const depense = cout();
    // Jalon R : les rangées du vestiaire du 82-0 (`rangeeHtml`), une par carte ; toucher la rangée ouvre sa fiche.
    const cartes = visibles.map(x => {
      const non = pourquoiPas(x);
      const a = pris.has(x.cle);
      return `<div class="pcard tc-${esc(x.rar || 'commune')}${a ? ' signed' : non ? ' locked' : ''}" data-voir="${esc(x.cle)}" style="${varsEquipe(x.p)}">${rangeeHtml(x.p, { rar: x.rar, num: x.num,
        dest: `<div class="pcard-dest">${a ? '<span class="dest-ok">✓ pris</span>' : non ? `<span class="dest-bad">${esc(non)}</span>` : esc(ctx.qui(x.p))}</div>`,
        bouton: a ? `<button type="button" class="btn-sign is-signed" data-remettre="${esc(x.cle)}">Remettre</button>`
          : `<button type="button" class="btn-sign" data-prendre="${esc(x.cle)}"${non ? ' disabled' : ''}>Prendre</button>` })}</div>`;
    }).join('');
    // Prendre une carte au bas du classeur ne ramène pas en haut : le défilement se garde d'un rendu à l'autre.
    const defile = m.querySelector('.dp-corps');
    const y = defile ? defile.scrollTop : 0;
    m.innerHTML = `<div class="choix-sheet dp-sheet" role="dialog" aria-modal="true" aria-label="${esc(T.titre)}">
      <div class="choix-tete">
        <span class="choix-ico">${T.ico}</span>
        <div class="choix-titres"><div class="choix-titre">${esc(T.titre)}</div>
          <div class="choix-irl">${esc(T.irl)}</div></div>
      </div>
      <div class="choix-corps dp-corps">
        <p class="choix-recit">${esc(T.recit)}</p>
        ${jaugePlafond({ titre: T.budget, masse: depense, cap: ctx.budget, mot: '<span class="inv-pl-rien">Ensemble, leurs salaires tiennent sous le plafond de la run, avec la place pour tes bouche-trous.</span>' })}
        ${ctx.mode === 'choix' ? `<div class="inv-filtres" role="group" aria-label="Position">${GROUPES.map(([g, nom]) => `<button type="button" class="inv-filtre${etat.groupe === g ? ' on' : ''}" data-groupe="${g}">${esc(nom)} <span>${g === 'tout' ? liste.length : liste.filter(x => ctx.groupe(x.p) === g).length}</span></button>`).join('')}</div>
          <label class="search"><svg class="ico" aria-hidden="true"><use href="#i-search"/></svg><input type="search" class="dp-cherche" placeholder="Chercher un joueur…" value="${esc(etat.cherche)}" aria-label="Chercher un joueur" autocomplete="off"></label>` : ''}
        ${cartes ? `<div class="sig-liste">${cartes}</div>` : '<p class="inv-vide">Aucune carte ici.</p>'}
        ${ctx.mode === 'choix' && filtres.length > visibles.length ? `<button type="button" class="btn dp-plus">Voir ${Math.min(PAGE, filtres.length - visibles.length)} cartes de plus · ${filtres.length - visibles.length} en tout</button>` : ''}
      </div>
      <div class="choix-pied">
        <button type="button" class="btn go dp-commencer">${esc(T.partir(pris.size))}</button>
      </div>
    </div>`;
    const corps = m.querySelector('.dp-corps');
    if (corps && y) corps.scrollTop = y;
    m.querySelectorAll('[data-voir]').forEach(b => { b.onclick = ev => { if (ev.target.closest('button')) return; const x = liste.find(y => y.cle === b.dataset.voir); if (x) ctx.apercu(x.p); }; });
    m.querySelectorAll('[data-prendre]').forEach(b => {
      b.onclick = () => { const x = liste.find(y => y.cle === b.dataset.prendre); if (x && !pourquoiPas(x)) { pris.add(x.cle); dessiner(); } };
    });
    m.querySelectorAll('[data-remettre]').forEach(b => { b.onclick = () => { pris.delete(b.dataset.remettre); dessiner(); }; });
    m.querySelectorAll('[data-groupe]').forEach(b => { b.onclick = () => { etat.groupe = b.dataset.groupe; etat.montres = PAGE; dessiner(); }; });
    const cherche = m.querySelector('.dp-cherche');
    // Comme le vestiaire (Jalon U) : la liste se filtre à chaque lettre, le curseur reste dans la recherche.
    if (cherche) cherche.oninput = () => {
      etat.cherche = cherche.value.trim(); etat.montres = PAGE; dessiner();
      const c = m.querySelector('.dp-cherche'); if (c) { c.focus(); c.setSelectionRange(c.value.length, c.value.length); }
    };
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
