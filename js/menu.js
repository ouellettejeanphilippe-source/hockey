/**
 * L'ÉCRAN TITRE (S77 ; 1.0, R1). JP : *chaque mode de jeu a ses saves et
 * possibilité de sauvegarder les saves et les reprendre, un menu au départ
 * pour choisir* ; *que si je le montre à quelqu'un, ça ait pas l'air d'un jeu
 * web*.
 *
 * Au lancement de l'appli, plein écran, sur une glace d'aréna dessinée en
 * CSS : le logo, puis
 *   - CONTINUER la dernière partie jouée (le héros, avec son résumé) ;
 *   - un carton par MODE, le Rogue en tête : reprendre la dernière partie de
 *     ce mode, ou en commencer une ;
 *   - l'exhibition, un lien sous les cartons ;
 *   - MES PARTIES : toutes, rangées par mode — reprendre, sauvegarder une
 *     copie (un instantané qu'on peut rouvrir plus tard), supprimer ;
 *   - les OPTIONS et les RÈGLES.
 *
 * En pleine partie, le bouton « Menu » de l'en-tête ouvre LE MÊME ÉCRAN par
 * dessus le jeu, comme le menu pause d'une console : son héros devient
 * « Retour à la partie », et le Retour (Échap, B, le bouton d'Android) y
 * ramène aussi (js/pile.js).
 *
 * Le menu ne sait rien du jeu : il lit l'index (js/sauvegardes.js) et rend
 * la main au contrôleur par ses rappels (`continuer`, `reprendre`,
 * `nouvelle`, `options`, `regles`, `exhibition`, et `rogue`).
 *
 * L'EXHIBITION (S78, js/exhibition.js) n'est pas un genre de sauvegarde :
 * elle ne garde aucune partie, donc rien dans « Mes parties ».
 */
import { lireIndex, partieActive, partiesDuGenre, derniereDuGenre, GENRES, copier, supprimer } from './sauvegardes.js';
import { esc } from './util.js';
import { surAppareil } from './visages.js';

/*
 * L'APPLICATION ANDROID, OFFERTE PAR LA VERSION WEB (1.0). JP : *possible sur la version web, de pouvoir
 * télécharger apk?* L'APK vit dans les versions publiées du dépôt GitHub, jamais dans le dépôt : l'adresse
 * « latest » suit toujours la dernière (scripts/publier-apk.mjs la publie). Ni l'APK ni l'exe de bureau
 * ne l'offrent : on y est déjà. Sur un téléphone Android, l'entrée passe en tête du pied.
 */
const ADRESSE_APK = 'https://github.com/ouellettejeanphilippe-source/hockey/releases/latest/download/Cap-82-0.apk';
const offrirApk = () => !surAppareil() && !(navigator.userAgent || '').includes('Electron/');
const surAndroid = () => /Android/i.test(navigator.userAgent || '');

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

export function fermerMenu() {
  const m = document.getElementById('menuDepart');
  if (m) m.remove();
  document.body.classList.remove('menu-ouvert');
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
  m.classList.toggle('en-jeu', !!ctx.enJeu);
  document.body.classList.add('menu-ouvert');
  dessiner(m);
  // Le focus sur le héros : la manette et le clavier partent de là.
  const h = m.querySelector('.menu-continuer') || m.querySelector('.menu-mode [data-menu]');
  if (h) h.focus({ preventScroll: true });
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
        ${reprise ? `<button type="button" class="btn go" data-menu="reprendre" data-id="${reprise.id}">Reprendre<small>${esc(ligneResume(reprise) || quand(reprise.maj))}</small></button>` : ''}
        <button type="button" class="btn${reprise ? '' : ' go'}" data-menu="nouvelle" data-genre="${g}">Nouvelle partie</button>
        ${g === 'rogue' && ctx.rogue ? '<button type="button" class="btn" data-menu="vestiaire">🏅 Le vestiaire des déblocages</button>' : ''}
        ${g === 'rogue' && ctx.rogue && ctx.rogue.inventaire ? '<button type="button" class="btn" data-menu="inventaire">🎒 L\'inventaire et le classeur</button>' : ''}
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
  const heros = ctx.enJeu || peutContinuer;
  m.innerHTML = `<div class="menu-fond" aria-hidden="true"><div class="menu-glace"></div></div>
    <div class="menu-feuille">
      <header class="menu-tete">
        <div class="menu-logo">CAP <b>82-0</b></div>
        <div class="menu-sous">${ctx.vierge ? 'Bienvenue. Bâtis une équipe de vrais joueurs de 55 saisons, et va chercher la Coupe.' : 'Bâtis une équipe de vrais joueurs. Va chercher la Coupe.'}</div>
      </header>
      ${heros ? `<button type="button" class="menu-continuer" data-menu="continuer">
        <span class="mc-mot">${ctx.enJeu ? 'Retour à la partie' : 'Continuer'}</span>
        ${active ? `<span class="mc-quoi">${GENRES[active.genre] ? GENRES[active.genre].ico : ''} ${esc(active.titre)} · ${esc(ligneResume(active) || quand(active.maj))}</span>` : ''}
      </button>` : ''}
      <section class="menu-modes" aria-label="Les modes de jeu">${ordreModes.map(carte).join('')}</section>
      ${exhibition}
      ${ix.parties.length ? `<details class="menu-parties"${ix.parties.length <= 3 ? ' open' : ''}><summary>📂 Mes parties · ${ix.parties.length}</summary>${groupes}</details>` : ''}
      <nav class="menu-pied" aria-label="Réglages et règles">
        ${offrirApk() ? `<a class="menu-entree menu-apk${surAndroid() ? ' en-tete' : ''}" href="${ADRESSE_APK}" download rel="noopener" title="L'application Android : le jeu hors ligne, en plein écran (environ 7 Mo)"><svg class="ico" aria-hidden="true"><use href="#i-telecharger"/></svg>Application Android</a>` : ''}
        <button type="button" class="menu-entree" data-menu="options"><svg class="ico" aria-hidden="true"><use href="#i-gear"/></svg>Options</button>
        <button type="button" class="menu-entree" data-menu="regles"><svg class="ico" aria-hidden="true"><use href="#i-book"/></svg>Règles</button>
      </nav>
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
      else if (quoi === 'regles') ctx.regles();
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
