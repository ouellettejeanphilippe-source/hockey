/**
 * L'ÉCRAN TITRE et la PAUSE.
 *
 * Au boot : Continuer (s'il y a une partie), une carte par mode
 * (une action primaire), Exhibition, Parties, Options, Règles.
 *
 * En partie : ce n'est plus le lanceur. Retour à la partie, Options,
 * Règles, Parties, puis « Quitter vers le titre ». Les modes ne
 * s'empilent plus par-dessus le match.
 * En run Rogue seulement : Inventaire et Vestiaire, deux liens.
 *
 * Parties : chaque partie s'exporte en fichier (à transférer sur un autre
 * appareil) et un tel fichier s'importe sous la liste.
 */
import { lireIndex, partieActive, partiesDuGenre, derniereDuGenre, GENRES, copier, supprimer, exporter, importer } from './sauvegardes.js';
import { esc } from './util.js';
import { surAppareil } from './visages.js';
import { MOMENTS, JOURS_MOMENTS } from './sim.js';
import { brancherMoments } from './situations.js';

brancherMoments(MOMENTS, JOURS_MOMENTS);

/*
 * LE FICHIER SORT (1.0). Sur le web, un lien `download` suffit. Dans
 * l'application Android, la WebView n'enregistre pas un tel lien : on passe
 * par la feuille de partage de l'appareil quand elle prend un fichier, sinon
 * le texte va dans le presse-papiers, à coller dans une note ou un message.
 * Rend le mot à afficher.
 */
async function livrer(nom, texte) {
  const fichier = new File([texte], nom, { type: 'application/json' });
  if (surAppareil()) {
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      try { await navigator.share({ files: [fichier], title: nom }); return `${nom} partagé.`; } catch (e) { if (e && e.name === 'AbortError') return ''; }
    }
    try { await navigator.clipboard.writeText(texte); return 'Partie copiée : colle-la dans une note ou un message.'; } catch { return 'Impossible d\'exporter sur cet appareil.'; }
  }
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url; a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return `${nom} téléchargé.`;
}
/* Un fichier ou le presse-papiers entre : une partie de plus au menu, ou le mot qui dit pourquoi non. */
function recevoir(texte) {
  const id = importer(texte);
  return id ? 'Partie importée.' : 'Ce fichier n\'est pas une partie de Cap 82-0.';
}

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
    m.setAttribute('aria-label', ctx.enJeu ? 'Pause' : 'Cap 82-0');
    document.body.appendChild(m);
  }
  m.classList.toggle('en-jeu', !!ctx.enJeu);
  document.body.classList.add('menu-ouvert');
  dessiner(m);
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
    const primaire = reprise
      ? `<button type="button" class="btn go" data-menu="reprendre" data-id="${reprise.id}">Continuer<small>${esc(ligneResume(reprise) || quand(reprise.maj))}</small></button>`
      : `<button type="button" class="btn go" data-menu="nouvelle" data-genre="${g}">Commencer</button>`;
    const secondaire = reprise
      ? `<button type="button" class="btn" data-menu="nouvelle" data-genre="${g}">Nouvelle</button>`
      : '';
    return `<article class="menu-mode" data-genre="${g}">
      <div class="menu-mode-ico" aria-hidden="true">${G.ico}</div>
      <div class="menu-mode-corps">
        <h3 class="menu-mode-nom">${esc(G.nom)}</h3>
        <p class="menu-mode-mot">${esc(G.mot)}</p>
        ${extra ? `<p class="menu-mode-extra">${extra}</p>` : ''}
      </div>
      <div class="menu-mode-actions">${primaire}${secondaire}</div>
    </article>`;
  };

  const ligne = p => {
    const G = GENRES[p.genre] || GENRES.saison;
    const estActive = p.id === ix.actif;
    return `<div class="menu-partie${estActive ? ' active' : ''}">
      <div class="mp-tete"><span class="mp-ico">${G.ico}</span><b class="mp-titre">${esc(p.titre)}</b>${estActive ? '<span class="mp-badge">En cours</span>' : ''}${p.importee ? '<span class="mp-badge copie">Importée</span>' : p.copie ? '<span class="mp-badge copie">Copie</span>' : ''}</div>
      <div class="mp-etape">${esc(ligneResume(p) || 'Pas commencée')} · ${esc(quand(p.maj))}</div>
      <div class="mp-actions">
        <button type="button" class="btn small go" data-menu="reprendre" data-id="${p.id}">${estActive && ctx.enJeu ? 'Y retourner' : 'Continuer'}</button>
        <button type="button" class="btn small" data-menu="copier" data-id="${p.id}">Dupliquer</button>
        <button type="button" class="btn small" data-menu="exporter" data-id="${p.id}" title="Un fichier à transférer sur un autre appareil">📤 Exporter</button>
        <button type="button" class="btn small danger" data-menu="supprimer" data-id="${p.id}"${estActive && ctx.enJeu ? ' disabled title="Partie en cours"' : ''}>✕</button>
      </div>
    </div>`;
  };

  const groupes = Object.keys(GENRES).map(g => {
    const ps = partiesDuGenre(g);
    return ps.length ? `<div class="menu-groupe"><div class="menu-groupe-t">${GENRES[g].ico} ${esc(GENRES[g].nom)} · ${ps.length}</div>${ps.map(ligne).join('')}</div>` : '';
  }).join('');

  const transfert = `<div class="menu-transfert">
      <button type="button" class="btn small" data-menu="importer" title="Une partie exportée d'un autre appareil">📁 Importer une partie</button>
      ${surAppareil() ? '<button type="button" class="btn small" data-menu="coller" title="Une partie copiée dans le presse-papiers">📋 Coller une partie</button>' : ''}
      <input type="file" class="menu-fichier" accept=".json,application/json" hidden>
      <span class="menu-transfert-mot" role="status"></span>
    </div>`;
  const partiesBloc = (ix.parties.length
    ? `<details class="menu-parties"${ix.parties.length <= 3 && !ctx.enJeu ? ' open' : ''}><summary>Parties · ${ix.parties.length}</summary>${groupes}</details>`
    : '') + transfert;

  const pied = `<nav class="menu-pied" aria-label="Réglages">
      <button type="button" class="menu-entree" data-menu="options"><svg class="ico" aria-hidden="true"><use href="#i-gear"/></svg>Options</button>
      <button type="button" class="menu-entree" data-menu="regles"><svg class="ico" aria-hidden="true"><use href="#i-book"/></svg>Règles</button>
    </nav>`;

  const liensRogue = ctx.enJeu && active && active.genre === 'rogue' && ctx.rogue
    ? [ctx.rogue.inventaire ? '<button type="button" class="menu-lien" data-menu="inventaire">🎒 Mes cartes</button>' : '',
      ctx.rogue.vestiaire ? '<button type="button" class="menu-lien" data-menu="vestiaire">Déblocages</button>' : ''].join('')
    : '';

  if (ctx.enJeu) {
    m.innerHTML = `<div class="menu-fond" aria-hidden="true"><div class="menu-glace"></div></div>
      <div class="menu-feuille">
        <header class="menu-tete">
          <div class="menu-logo">CAP <b>82-0</b></div>
          <div class="menu-sous">Pause.</div>
        </header>
        <button type="button" class="menu-continuer" data-menu="continuer">
          <span class="mc-mot">Retour à la partie</span>
          ${active ? `<span class="mc-quoi">${GENRES[active.genre] ? GENRES[active.genre].ico : ''} ${esc(active.titre)}${ligneResume(active) ? ' · ' + esc(ligneResume(active)) : ''}</span>` : ''}
        </button>
        ${pied}
        ${liensRogue}
        ${partiesBloc}
        <button type="button" class="menu-lien" data-menu="titre">Quitter vers le titre</button>
      </div>`;
  } else {
    const ordreModes = ['rogue', ...Object.keys(GENRES).filter(g => g !== 'rogue')].filter(g => GENRES[g]);
    const exhibition = ctx.exhibition
      ? `<button type="button" class="menu-lien" data-menu="exhibition">Exhibition <small>deux clubs, un match ou une série</small> ›</button>`
      : '';
    const heros = peutContinuer;
    m.innerHTML = `<div class="menu-fond" aria-hidden="true"><div class="menu-glace"></div></div>
      <div class="menu-feuille">
        <header class="menu-tete">
          <div class="menu-logo">CAP <b>82-0</b></div>
          <div class="menu-sous">23 joueurs. Un plafond. La Coupe.</div>
        </header>
        ${heros ? `<button type="button" class="menu-continuer" data-menu="continuer">
          <span class="mc-mot">Continuer</span>
          ${active ? `<span class="mc-quoi">${GENRES[active.genre] ? GENRES[active.genre].ico : ''} ${esc(active.titre)} · ${esc(ligneResume(active) || quand(active.maj))}</span>` : ''}
        </button>` : ''}
        <section class="menu-modes" aria-label="Modes">${ordreModes.map(carte).join('')}</section>
        ${exhibition}
        ${partiesBloc}
        ${pied}
      </div>`;
  }

  m.querySelectorAll('[data-menu]').forEach(b => {
    b.onclick = () => {
      const quoi = b.dataset.menu, id = b.dataset.id;
      if (quoi === 'continuer') ctx.continuer();
      else if (quoi === 'titre') { fermerMenu(); if (ctx.titre) ctx.titre(); else afficherMenu({ ...ctx, enJeu: false }); }
      else if (quoi === 'reprendre') { if (ctx.enJeu && id === lireIndex().actif) ctx.continuer(); else ctx.reprendre(id); }
      else if (quoi === 'nouvelle') {
        if (b.dataset.genre === 'rogue' && ctx.rogue) ctx.rogue.nouvelle();
        else ctx.nouvelle(b.dataset.genre);
      }
      else if (quoi === 'exhibition' && ctx.exhibition) ctx.exhibition();
      else if (quoi === 'vestiaire' && ctx.rogue) ctx.rogue.vestiaire();
      else if (quoi === 'inventaire' && ctx.rogue && ctx.rogue.inventaire) ctx.rogue.inventaire();
      else if (quoi === 'options') ctx.options();
      else if (quoi === 'regles') ctx.regles();
      else if (quoi === 'copier') { copier(id); dessiner(m); ouvrirParties(m); }
      else if (quoi === 'exporter') { const f = exporter(id); if (f) livrer(f.nom, f.texte).then(mot => dire(m, mot)); }
      else if (quoi === 'importer') { const inp = m.querySelector('.menu-fichier'); if (inp) inp.click(); }
      else if (quoi === 'coller') {
        navigator.clipboard.readText().then(t => { const mot = recevoir(t); dessiner(m); ouvrirParties(m); dire(m, mot); })
          .catch(() => dire(m, 'Le presse-papiers n\'est pas lisible.'));
      }
      else if (quoi === 'supprimer') {
        if (b.dataset.confirme !== '1') { b.dataset.confirme = '1'; b.textContent = 'Supprimer ?'; setTimeout(() => { if (b.isConnected) { b.dataset.confirme = ''; b.textContent = '✕'; } }, 2500); return; }
        supprimer(id); dessiner(m); ouvrirParties(m);
      }
    };
  });
  const fichier = m.querySelector('.menu-fichier');
  if (fichier) {
    fichier.onchange = () => {
      const f = fichier.files && fichier.files[0];
      if (!f) return;
      f.text().then(t => { const mot = recevoir(t); dessiner(m); ouvrirParties(m); dire(m, mot); })
        .catch(() => dire(m, 'Ce fichier ne se lit pas.'));
    };
  }
}
/* Le mot du transfert, sous les boutons ; vide, rien ne se voit. */
const dire = (m, mot) => { const s = m.querySelector('.menu-transfert-mot'); if (s) s.textContent = mot || ''; };
const ouvrirParties = m => { const d = m.querySelector('.menu-parties'); if (d) d.open = true; };
