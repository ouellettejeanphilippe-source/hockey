/**
 * LE LOTO DU CLASSEUR (S80, puis le 24 oct.) — l'écran d'une case : les
 * cartes qu'un loto a tirées, dont tu gardes une, ou aucune.
 *
 * JP : *le classeur, on peut piger x cartes aux départ, ou random, selon
 * upgrades dans le mode rogue like* ; puis *garder des joueurs de run en run
 * devrait être fait dans une loto, pas genre tu peux prendre qui tu veux*.
 *
 * UNE CASE, UN LOTO, partout où des joueurs te suivent (js/rogue-jeu.js
 * `lotosParCase`) : le départ d'une run (les cases du classeur), ceux qui
 * restent d'une saison à l'autre (tes joueurs de la saison finie) et les
 * lotos du cartable entre deux saisons. Le contrôleur tire les cartes, d'un
 * niveau (js/rogue.js `lotoDeCase`), sous le BUDGET DU CLASSEUR ; une carte
 * qui ne rentre plus reste visible, avec ce qui manque.
 *
 * RIEN SANS UN GESTE : toucher une carte ouvre sa fiche ; « Prendre » la
 * garde ; le bouton du pied passe à la case suivante avec elle, ou sans rien.
 * Le tirage est PUR : un rechargement redonne les mêmes cartes.
 *
 * ctx : { budget, candidats [{ cle, p, rar, num }], esc, qui(p), money(x),
 *         apercu(p), onFini(cles), textes { ico, titre, irl, recit, budget, plein, partir(n) } }
 */
import { rangeeHtml, varsEquipe } from './repechage.js';
import { jaugePlafond } from './util.js';

const $ = id => document.getElementById(id);

export function ouvrirDepartClasseur(ctx) {
  const m = $('departModal');
  if (!m) { ctx.onFini([]); return; }
  const esc = ctx.esc;
  const T = ctx.textes;
  const pris = new Set();
  const cout = () => ctx.candidats.filter(x => pris.has(x.cle)).reduce((a, x) => a + (x.p.$ || 0), 0);
  const pourquoiPas = x => {
    if (pris.has(x.cle)) return '';
    if (pris.size) return T.plein;
    const manque = cout() + (x.p.$ || 0) - ctx.budget;
    return manque > 0 ? `Budget : il manque ${ctx.money(manque)}` : '';
  };
  const dessiner = () => {
    // Jalon R : les rangées du vestiaire du 82-0 (`rangeeHtml`), une par carte ; toucher la rangée ouvre sa fiche.
    const cartes = ctx.candidats.map(x => {
      const non = pourquoiPas(x);
      const a = pris.has(x.cle);
      return `<div class="pcard tc-${esc(x.rar || 'commune')}${a ? ' signed' : non ? ' locked' : ''}" data-voir="${esc(x.cle)}" style="${varsEquipe(x.p)}">${rangeeHtml(x.p, { rar: x.rar, num: x.num,
        dest: `<div class="pcard-dest">${a ? '<span class="dest-ok">✓ pris</span>' : non ? `<span class="dest-bad">${esc(non)}</span>` : esc(ctx.qui(x.p))}</div>`,
        bouton: a ? `<button type="button" class="btn-sign is-signed" data-remettre="${esc(x.cle)}">Remettre</button>`
          : `<button type="button" class="btn-sign" data-prendre="${esc(x.cle)}"${non ? ' disabled' : ''}>Prendre</button>` })}</div>`;
    }).join('');
    m.innerHTML = `<div class="choix-sheet dp-sheet" role="dialog" aria-modal="true" aria-label="${esc(T.titre)}">
      <div class="choix-tete">
        <span class="choix-ico">${T.ico}</span>
        <div class="choix-titres"><div class="choix-titre">${esc(T.titre)}</div>
          <div class="choix-irl">${esc(T.irl)}</div></div>
      </div>
      <div class="choix-corps dp-corps">
        <p class="choix-recit">${esc(T.recit)}</p>
        ${jaugePlafond({ titre: T.budget, masse: cout(), cap: ctx.budget, mot: '<span class="inv-pl-rien">Ensemble, leurs salaires tiennent sous le plafond de la run, avec la place pour tes bouche-trous.</span>' })}
        <div class="sig-liste">${cartes}</div>
      </div>
      <div class="choix-pied">
        <button type="button" class="btn go dp-commencer">${esc(T.partir(pris.size))}</button>
      </div>
    </div>`;
    m.querySelectorAll('[data-voir]').forEach(b => { b.onclick = ev => { if (ev.target.closest('button')) return; const x = ctx.candidats.find(y => y.cle === b.dataset.voir); if (x) ctx.apercu(x.p); }; });
    m.querySelectorAll('[data-prendre]').forEach(b => {
      b.onclick = () => { const x = ctx.candidats.find(y => y.cle === b.dataset.prendre); if (x && !pourquoiPas(x)) { pris.add(x.cle); dessiner(); } };
    });
    m.querySelectorAll('[data-remettre]').forEach(b => { b.onclick = () => { pris.delete(b.dataset.remettre); dessiner(); }; });
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
