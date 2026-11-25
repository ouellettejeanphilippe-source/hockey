/**
 * L'ÉCRAN TITRE et la PAUSE.
 *
 * Au boot : Continuer (s'il y a une partie), une carte par mode
 * (une action primaire), Exhibition, Parties, Options, Règles. Le Rogue
 * n'a pas de partie dans l'index : sa carte ouvre sa saison
 * (js/run-jeu.js), « Continuer » quand une run est gardée.
 *
 * En partie : ce n'est plus le lanceur. Retour à la partie, Options,
 * Règles, Parties, puis « Quitter vers le titre ». Les modes ne
 * s'empilent plus par-dessus le match.
 *
 * Parties : chaque partie s'exporte en fichier (à transférer sur un autre
 * appareil, un téléphone ou un ordinateur) et un tel fichier s'importe sous
 * la liste. Dessous, « D'un appareil à l'autre » : la sauvegarde qui suit
 * toute seule, par GitHub (js/synchro.js).
 */
import { lireIndex, partieActive, partiesDuGenre, derniereDuGenre, GENRES, copier, supprimer, exporter, importer } from './sauvegardes.js';
import { esc } from './util.js';
import { appliquerAuTitre } from './mise-a-jour.js';
import { VERSION } from './version.js';
import { etatDeLaSynchro, synchroniser, brancher, debrancher } from './synchro.js';
/*
 * LE FICHIER SORT (1.0) : un lien `download` ; le navigateur l'enregistre.
 * Rend le mot à afficher.
 */
function livrer(nom, texte) {
  const fichier = new File([texte], nom, { type: 'application/json' });
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url; a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return `${nom} téléchargé.`;
}
/* Un fichier entre : une partie de plus au menu, ou le mot qui dit pourquoi non. Une run de l'ancien Rogue se solde aussitôt. */
function recevoir(texte) {
  if (!importer(texte)) return 'Ce fichier n\'est pas une partie de Cap 82-0.';
  return (ctxCourant.rogue && ctxCourant.rogue.solder()) || 'Partie importée.';
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

/*
 * D'UN APPAREIL À L'AUTRE (js/synchro.js ; JP, 25 nov. 2026 : *Github sync*, *toute seule*). Une section du menu, qui dit
 * où en est la sauvegarde en ligne et ne porte que le geste du moment : brancher GitHub ; choisir entre deux sauvegardes qui
 * ont avancé chacune de leur côté ; changer un jeton refusé. Sinon rien à faire : elle suit seule.
 */
let synchroOccupee = false;
function synchroHtml() {
  const s = etatDeLaSynchro();
  const bouton = (quoi, mot, cls = '') => `<button type="button" class="btn small${cls}" data-synchro="${quoi}">${mot}</button>`;
  if (!s.branchee) return `<p class="ms-mot">Ta run, tes médailles, ton cartable et tes parties te suivent du téléphone à l'ordinateur, par ton compte GitHub.</p>
    <div class="ms-actions">${bouton('ouvrir', 'Brancher GitHub')}</div>`;
  if (synchroOccupee) return '<p class="ms-mot" role="status">Synchronisation…</p>';
  if (s.conflit) return `<p class="ms-mot" role="status">Deux appareils ont avancé chacun de leur côté. Laquelle garder ? L'autre s'efface des deux ; GitHub en garde une copie.</p>
    <div class="ms-choix">
      <button type="button" class="btn" data-synchro="ici"><b>Celle d'ici</b><small>${esc(s.conflit.ici.resume)}</small></button>
      <button type="button" class="btn" data-synchro="la"><b>Celle d'${esc(s.conflit.la.appareil)}</b><small>${esc(s.conflit.la.resume)} · ${esc(quand(s.conflit.la.quand))}</small></button>
    </div>
    <div class="ms-actions">${bouton('debrancher', 'Débrancher')}</div>`;
  // 401, 403, 404 : GitHub dit non à ce jeton (faux, expiré, sans le droit « gist ») ; tout autre accroc se réessaie.
  const geste = [401, 403, 404].includes(s.refus) ? bouton('ouvrir', 'Changer le jeton', ' go') : bouton('synchroniser', 'Synchroniser');
  return `<p class="ms-mot" role="status">${esc(s.mot || (s.sale ? 'Des changements à envoyer.' : `À jour${s.source ? `, reçue d'${s.source}` : ''} · ${quand(s.quand)}`))}</p>
    <div class="ms-actions">${geste}${bouton('debrancher', 'Débrancher')}</div>`;
}
/* La section se redessine seule (le menu autour ne bouge pas) ; le focus qu'elle portait revient à son premier bouton. */
export function dessinerLaSynchro() {
  const c = document.querySelector('#menuDepart .menu-synchro-corps');
  if (!c) return;
  const avaitLeFocus = c.contains(document.activeElement);
  c.innerHTML = synchroHtml();
  const b = c.querySelector('button');
  if (avaitLeFocus && b) b.focus({ preventScroll: true });
}
async function gesteDeSynchro(b) {
  const quoi = b.dataset.synchro;
  if (quoi === 'ouvrir') { preparerLeJeton(); ctxCourant.jeton.ouvrir(); return; }
  if (quoi === 'debrancher') {
    if (b.dataset.confirme !== '1') { b.dataset.confirme = '1'; b.textContent = 'Débrancher ?'; setTimeout(() => { if (b.isConnected) { b.dataset.confirme = ''; b.textContent = 'Débrancher'; } }, 2500); return; }
    debrancher(); dessinerLaSynchro(); return;
  }
  synchroOccupee = true; dessinerLaSynchro();
  const r = await synchroniser(quoi === 'ici' || quoi === 'la' ? { garder: quoi } : {});
  synchroOccupee = false;
  // La sauvegarde reçue est au stockage ; le jeu en mémoire est celui d'avant : on recharge.
  if (r.etat === 'recue') location.reload(); else dessinerLaSynchro();
}
/* LE JETON se colle dans sa fenêtre (index.html, #synchroModal) ; il s'essaie avant de se garder, et un refus se dit sous le champ. */
function preparerLeJeton() {
  const f = document.getElementById('synchroForm');
  if (!f || f.onsubmit) return;
  f.onsubmit = async ev => {
    ev.preventDefault();
    const champ = f.elements.jeton, mot = f.querySelector('.synchro-mot'), b = f.querySelector('[type="submit"]');
    b.disabled = true; mot.textContent = 'On essaie le jeton…';
    const r = await brancher(champ.value);
    b.disabled = false; mot.textContent = '';
    if (!etatDeLaSynchro().branchee) { mot.textContent = r.mot; champ.focus(); champ.select(); return; }
    champ.value = '';
    ctxCourant.jeton.fermer();
    if (r.etat === 'recue') location.reload(); else dessinerLaSynchro();
  };
}

export function fermerMenu() {
  const m = document.getElementById('menuDepart');
  if (m) m.remove();
  document.body.classList.remove('menu-ouvert');
}

export function afficherMenu(ctx) {
  ctxCourant = ctx;
  // Au titre seulement (JP : *toujours revenir au menu initial*, hors partie) : un rechargement y revient. Le menu PAUSE,
  // ouvert en pleine partie, garde la session — recharger retombe dans la partie (les séries rouvrent, smoke).
  if (!ctx.enJeu) try { sessionStorage.removeItem('cap82_session'); } catch { /* ignore */ }
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
    const extra = g === 'rogue' ? ctx.rogue.resume() : '';
    // Le Rogue (V28) : sa run vit hors de l'index ; une seule action, qui la reprend ou ouvre son départ.
    const primaire = g === 'rogue' ? `<button type="button" class="btn go" data-menu="rogue">${ctx.rogue.enCours ? 'Continuer' : 'Commencer'}</button>`
      : reprise
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
      <input type="file" class="menu-fichier" accept=".json,application/json" hidden>
      <span class="menu-transfert-mot" role="status"></span>
    </div>
    <section class="menu-synchro" aria-labelledby="menuSynchroT">
      <h2 class="menu-parties-t" id="menuSynchroT">D'un appareil à l'autre</h2>
      <div class="menu-synchro-corps">${synchroHtml()}</div>
    </section>`;
  const partiesBloc = (ix.parties.length
    ? `<section class="menu-parties"><h2 class="menu-parties-t">Parties · ${ix.parties.length}</h2>${groupes}</section>`
    : '') + transfert;

  const pied = `<nav class="menu-pied" aria-label="Réglages">
      <button type="button" class="menu-entree" data-menu="options"><svg class="ico" aria-hidden="true"><use href="#i-gear"/></svg>Options</button>
      <button type="button" class="menu-entree" data-menu="regles"><svg class="ico" aria-hidden="true"><use href="#i-book"/></svg>Règles</button>
      <span class="menu-version">Version ${esc(VERSION)}</span>
    </nav>`;

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
        ${partiesBloc}
        <button type="button" class="menu-lien" data-menu="titre">Quitter vers le titre</button>
      </div>`;
  } else {
    const ordreModes = ['rogue', ...Object.keys(GENRES).filter(g => g !== 'rogue')].filter(g => GENRES[g]);
    const exhibition = ctx.exhibition
      ? `<button type="button" class="menu-lien" data-menu="exhibition">Exhibition <small>deux clubs, un match ou une série</small> ›</button>`
      : '';
    // SUR GLACE (31 oct. 2026, js/sur-glace.js) : le terrain de jeu de la physique, un lien comme l'exhibition.
    const glace = ctx.glace
      ? `<button type="button" class="menu-lien" data-menu="glace">Sur glace <small>un patineur, une rondelle, un filet : la physique, à la manette</small> ›</button>`
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
        ${glace}
        ${partiesBloc}
        ${pied}
      </div>`;
  }

  // LA MISE À JOUR (js/mise-a-jour.js) : une version neuve déjà prise s'applique dès le titre.
  if (!ctx.enJeu) appliquerAuTitre();
  m.querySelectorAll('[data-menu]').forEach(b => {
    b.onclick = () => {
      const quoi = b.dataset.menu, id = b.dataset.id;
      if (quoi === 'continuer') ctx.continuer();
      else if (quoi === 'titre') { fermerMenu(); if (ctx.titre) ctx.titre(); else afficherMenu({ ...ctx, enJeu: false }); }
      else if (quoi === 'reprendre') { if (ctx.enJeu && id === lireIndex().actif) ctx.continuer(); else ctx.reprendre(id); }
      else if (quoi === 'nouvelle') ctx.nouvelle(b.dataset.genre);
      else if (quoi === 'rogue') ctx.rogue.ouvrir();
      else if (quoi === 'exhibition' && ctx.exhibition) ctx.exhibition();
      else if (quoi === 'glace' && ctx.glace) ctx.glace();
      else if (quoi === 'options') ctx.options();
      else if (quoi === 'regles') ctx.regles();
      else if (quoi === 'copier') { copier(id); dessiner(m); }
      else if (quoi === 'exporter') { const f = exporter(id); if (f) dire(m, livrer(f.nom, f.texte)); }
      else if (quoi === 'importer') { const inp = m.querySelector('.menu-fichier'); if (inp) inp.click(); }
      else if (quoi === 'supprimer') {
        if (b.dataset.confirme !== '1') { b.dataset.confirme = '1'; b.textContent = 'Supprimer ?'; setTimeout(() => { if (b.isConnected) { b.dataset.confirme = ''; b.textContent = '✕'; } }, 2500); return; }
        supprimer(id); dessiner(m);
      }
    };
  });
  const synchro = m.querySelector('.menu-synchro-corps');
  if (synchro) synchro.onclick = ev => { const b = ev.target.closest('[data-synchro]'); if (b) gesteDeSynchro(b); };
  const fichier = m.querySelector('.menu-fichier');
  if (fichier) {
    fichier.onchange = () => {
      const f = fichier.files && fichier.files[0];
      if (!f) return;
      f.text().then(t => { const mot = recevoir(t); dessiner(m); dire(m, mot); })
        .catch(() => dire(m, 'Ce fichier ne se lit pas.'));
    };
  }
}
/* Le mot du transfert, sous les boutons ; vide, rien ne se voit. */
const dire = (m, mot) => { const s = m.querySelector('.menu-transfert-mot'); if (s) s.textContent = mot || ''; };
