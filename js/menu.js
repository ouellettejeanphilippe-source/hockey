/**
 * LE MENU (S77). JP : *chaque mode de jeu a ses saves et possibilité de
 * sauvegarder les saves et les reprendre, un menu au départ pour choisir*.
 *
 * Au lancement de l'appli, et par le bouton « Menu » de la barre du haut :
 *   - CONTINUER la dernière partie jouée ;
 *   - un carton par MODE (la saison, sur table, le mode Rogue) : reprendre
 *     la dernière partie de ce mode, ou en commencer une ;
 *   - MES PARTIES : toutes, rangées par mode — reprendre, sauvegarder une
 *     copie (un instantané qu'on peut rouvrir plus tard), supprimer.
 *
 * Le menu ne sait rien du jeu : il lit l'index (js/sauvegardes.js) et rend
 * la main au contrôleur par ses rappels (`continuer`, `reprendre`,
 * `nouvelle`, `options`, et `rogue` quand le mode existe).
 *
 * L'EXHIBITION (S78, js/exhibition.js) a son carton sans être un genre de
 * sauvegarde : elle ne garde aucune partie, donc rien dans « Mes parties ».
 *
 * LE CHOIX DU MODE (S79, `ctx.choix`). JP : *« Nouvelle » devrait ramener
 * aux choix des modes*. Le bouton « Nouvelle » de la barre ouvre le même
 * menu, réduit aux cartons des modes, chacun avec « Commencer » : pas de
 * reprise, pas de « Mes parties » — c'est le rôle du bouton « Menu ».
 */
import { lireIndex, partieActive, partiesDuGenre, derniereDuGenre, GENRES, copier, supprimer } from './sauvegardes.js';
import { esc } from './util.js';

/* « il y a 5 min », « hier », sinon la date : une partie se reconnaît à quand on l'a jouée. */
function quand(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'à l\'instant';
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`;
  if (d < 172800) return 'hier';
  return new Date(t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' });
}
const ligneResume = p => [p.resume && p.resume.etape, p.resume && p.resume.qui].filter(Boolean).join(' · ');

let ctxCourant = null;
let clavier = null;

export function fermerMenu() {
  const m = document.getElementById('menuDepart');
  if (m) m.remove();
  document.body.classList.remove('menu-ouvert');
  if (clavier) { window.removeEventListener('keydown', clavier); clavier = null; }
}

export function afficherMenu(ctx) {
  ctxCourant = ctx;
  let m = document.getElementById('menuDepart');
  if (!m) {
    m = document.createElement('div');
    m.id = 'menuDepart';
    m.className = 'menu-depart';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', 'Le menu de Cap 82-0');
    document.body.appendChild(m);
  }
  document.body.classList.add('menu-ouvert');
  dessiner(m);
  if (!clavier) {
    clavier = ev => { if (ev.key === 'Escape' && ctxCourant && ctxCourant.enJeu) fermerMenu(); };
    window.addEventListener('keydown', clavier);
  }
}

function dessiner(m) {
  const ctx = ctxCourant;
  const ix = lireIndex();
  const active = partieActive();
  const peutContinuer = active && !(active.resume && active.resume.vierge);
  const carte = g => {
    const G = GENRES[g];
    const d = derniereDuGenre(g);
    const reprise = d && !(d.resume && d.resume.vierge) ? d : null;
    const extra = g === 'rogue' && ctx.rogue ? ctx.rogue.resume() : '';
    return `<article class="menu-mode" data-genre="${g}">
      <div class="menu-mode-ico" aria-hidden="true">${G.ico}</div>
      <div class="menu-mode-corps">
        <h3 class="menu-mode-nom">${esc(G.nom)}</h3>
        <p class="menu-mode-mot">${esc(G.mot)}</p>
        ${extra ? `<p class="menu-mode-extra">${extra}</p>` : ''}
      </div>
      <div class="menu-mode-actions">
        ${ctx.choix ? `<button type="button" class="btn go" data-menu="nouvelle" data-genre="${g}">Commencer</button>` : `
        ${reprise ? `<button type="button" class="btn go" data-menu="reprendre" data-id="${reprise.id}">Reprendre<small>${esc(ligneResume(reprise) || quand(reprise.maj))}</small></button>` : ''}
        <button type="button" class="btn${reprise ? '' : ' go'}" data-menu="nouvelle" data-genre="${g}">Nouvelle partie</button>
        ${g === 'rogue' && ctx.rogue ? '<button type="button" class="btn" data-menu="vestiaire">🏅 Le vestiaire des déblocages</button>' : ''}
        ${g === 'rogue' && ctx.rogue && ctx.rogue.inventaire ? '<button type="button" class="btn" data-menu="inventaire">🎒 L\'inventaire et le classeur</button>' : ''}`}
      </div>
    </article>`;
  };
  const ligne = p => {
    const G = GENRES[p.genre] || GENRES.saison;
    const estActive = p.id === ix.actif;
    return `<div class="menu-partie${estActive ? ' active' : ''}">
      <div class="mp-tete"><span class="mp-ico">${G.ico}</span><b class="mp-titre">${esc(p.titre)}</b>${estActive ? '<span class="mp-badge">En cours</span>' : ''}${p.copie ? '<span class="mp-badge copie">Copie</span>' : ''}</div>
      <div class="mp-etape">${esc(ligneResume(p) || 'Partie neuve')} · ${esc(quand(p.maj))}</div>
      <div class="mp-actions">
        <button type="button" class="btn small go" data-menu="reprendre" data-id="${p.id}">${estActive && ctx.enJeu ? 'Y retourner' : 'Reprendre'}</button>
        <button type="button" class="btn small" data-menu="copier" data-id="${p.id}" title="Un instantané de cette partie, à reprendre plus tard">💾 Sauvegarder une copie</button>
        <button type="button" class="btn small danger" data-menu="supprimer" data-id="${p.id}"${estActive && ctx.enJeu ? ' disabled title="C\'est la partie en cours"' : ''}>🗑️</button>
      </div>
    </div>`;
  };
  // L'exhibition : deux clubs de n'importe quelle époque, pour le fun (S78).
  // 1.0 (R8) : un lien sous la grille, pas un quatrième carton.
  const exhibition = ctx.exhibition ? `<button type="button" class="menu-lien" data-menu="exhibition">🏟️ Exhibition <small>n'importe quels clubs, toutes les époques, un match ou une série</small> ›</button>` : '';
  // 1.0 (R8) : le Rogue est le héros du menu — premier dans le DOM, pleine largeur sur grand écran.
  const ordreModes = ['rogue', ...Object.keys(GENRES).filter(g => g !== 'rogue')].filter(g => GENRES[g]);
  const groupes = Object.keys(GENRES).map(g => {
    const ps = partiesDuGenre(g);
    return ps.length ? `<div class="menu-groupe"><div class="menu-groupe-t">${GENRES[g].ico} ${esc(GENRES[g].nom)} · ${ps.length}</div>${ps.map(ligne).join('')}</div>` : '';
  }).join('');
  m.innerHTML = `<div class="menu-fond" aria-hidden="true"></div>
    <div class="menu-feuille">
      <header class="menu-tete">
        <div class="menu-logo">CAP <b>82-0</b></div>
        <div class="menu-sous">${ctx.choix ? 'Nouvelle partie : choisis ton mode. Ta partie en cours reste dans « Mes parties ».' : ctx.vierge ? 'Bienvenue. Bâtis une équipe de vrais joueurs de 55 saisons, et va chercher la Coupe.' : 'Bâtis une équipe de vrais joueurs. Va chercher la Coupe.'}</div>
        ${ctx.enJeu ? '<button type="button" class="menu-fermer" data-menu="continuer" aria-label="Retour à la partie">✕</button>' : ''}
      </header>
      ${peutContinuer && !ctx.choix ? `<button type="button" class="menu-continuer" data-menu="continuer">
        <span class="mc-mot">${ctx.enJeu ? 'Retour à la partie' : 'Continuer'}</span>
        <span class="mc-quoi">${GENRES[active.genre] ? GENRES[active.genre].ico : ''} ${esc(active.titre)} · ${esc(ligneResume(active) || quand(active.maj))}</span>
      </button>` : ''}
      <section class="menu-modes" aria-label="Les modes de jeu">${ordreModes.map(carte).join('')}</section>
      ${exhibition}
      ${ix.parties.length && !ctx.choix ? `<details class="menu-parties"${ix.parties.length <= 3 ? ' open' : ''}><summary>📂 Mes parties · ${ix.parties.length}</summary>${groupes}</details>` : ''}
      ${ctx.choix ? '' : '<footer class="menu-pied"><button type="button" class="btn small" data-menu="options">⚙ Options</button></footer>'}
    </div>`;
  m.querySelectorAll('[data-menu]').forEach(b => {
    b.onclick = () => {
      const quoi = b.dataset.menu, id = b.dataset.id;
      if (quoi === 'continuer') ctx.continuer();
      else if (quoi === 'reprendre') { if (ctx.enJeu && id === lireIndex().actif) ctx.continuer(); else ctx.reprendre(id); }
      else if (quoi === 'nouvelle') {
        if (b.dataset.genre === 'rogue' && ctx.rogue) ctx.rogue.nouvelle();
        else ctx.nouvelle(b.dataset.genre);
      }
      else if (quoi === 'vestiaire' && ctx.rogue) ctx.rogue.vestiaire();
      else if (quoi === 'inventaire' && ctx.rogue && ctx.rogue.inventaire) ctx.rogue.inventaire();
      else if (quoi === 'exhibition' && ctx.exhibition) ctx.exhibition();
      else if (quoi === 'options') ctx.options();
      else if (quoi === 'copier') { copier(id); dessiner(m); ouvrirParties(m); }
      else if (quoi === 'supprimer') {
        // Deux touches, jamais une : une partie supprimée ne revient pas.
        if (b.dataset.confirme !== '1') { b.dataset.confirme = '1'; b.textContent = 'Supprimer ?'; setTimeout(() => { if (b.isConnected) { b.dataset.confirme = ''; b.textContent = '🗑️'; } }, 2500); return; }
        supprimer(id); dessiner(m); ouvrirParties(m);
      }
    };
  });
}
const ouvrirParties = m => { const d = m.querySelector('.menu-parties'); if (d) d.open = true; };
