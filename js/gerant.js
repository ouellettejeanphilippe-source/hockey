/**
 * LE POSTE DE GÉRANT (S68) : deux écrans plein écran.
 *
 * JP : *c'est pas clair l'impact des trucs, aussi décisions dans modals plein
 * écran, tout devrait être clair* ; *chaque ligne peut avoir stratégie
 * différente, qui doit fitter avec profils, style hockeyarena.net* ;
 * *pouvoir en tout temps changer les trios et cie et ça a un impact*.
 *
 *   ouvrirChoix   UNE décision : une histoire, le joueur visé s'il y en a un,
 *                 et des options qui disent chacune en CHIFFRES ce qu'elles
 *                 achètent, ce qu'elles coûtent, combien de matchs, et
 *                 quelles factions elles bougent
 *   ouvrirLignes  les quatre lignes : les joueurs avec leur profil et leur
 *                 énergie, les sept tactiques avec le fit de CETTE ligne, la
 *                 chimie, l'agressivité, les secondes de présence ; la
 *                 tactique d'en face et celle qui la contre ; la consigne du
 *                 match. Rien ne s'applique avant « Appliquer ».
 *
 * Le module est aveugle au jeu : `ctx` porte l'échappement et les écussons,
 * les données arrivent en arguments, et les décisions repartent par rappel.
 */

import {
  PROFILS, TACTIQUES, AGRESSIVITES, IMPORTANCES, SEC_MIN, SEC_MAX, SEC_DEFAUT,
  profilsDe, profilPrincipal, fitLigne, joueursDeLigne, contreDe, motsDEffet, motsDeMutation, chimieMax,
  MUTATIONS, JAUGES, SLOTS, getPlayerKey,
} from './sim.js';
import { POIDS_TRIO } from './ratings.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Les puces d'un effet : vert s'il aide, rouge s'il coûte, gris s'il ne fait que déplacer. */
export function puces(mots) {
  return (mots || []).map(m => `<span class="puce ${m.bon === true ? 'bon' : m.bon === false ? 'prix' : 'neutre'}${m.duree ? ' duree' : ''}">${esc(m.txt)}</span>`).join('');
}
export function pucesJauges(j) {
  return Object.entries(j || {}).filter(([, v]) => v)
    .map(([k, v]) => `<span class="puce ${v > 0 ? 'bon' : 'prix'}">${JAUGES[k].ico} ${esc(JAUGES[k].nom)} ${v > 0 ? '+' : '−'}${Math.abs(v)}</span>`).join('');
}

/* Le petit portrait d'un joueur visé : son profil principal et ses marques de carte. */
/* Les profils d'un joueur en barres : la fiche et le joueur visé d'un choix. */
export function barresProfils(p) {
  const pp = profilPrincipal(p);
  const pr = profilsDe(p) || {};
  const g = p.p === 'D' || p.p === 'LD' || p.p === 'RD' ? 'D' : 'F';
  return `<div class="gj-profs">${Object.entries(PROFILS[g]).map(([k, P]) => `<div class="gj-prof${pp && pp.cle === k ? ' top' : ''}" title="${esc(P.mot)}">
    <span>${P.ico} ${esc(P.nom)}</span><span class="gj-barre"><span style="width:${pr[k] || 0}%"></span></span><b>${pr[k] ?? '—'}</b></div>`).join('')}</div>`;
}
export function carteJoueur(p) {
  if (!p) return '';
  const barres = barresProfils(p);
  const marques = (p._mutCles || []).map(k => MUTATIONS[k] ? `<span class="puce neutre">${MUTATIONS[k].ico} ${esc(MUTATIONS[k].nom)}</span>` : '').join('');
  return `<div class="gj-joueur"><div class="gj-joueur-nom">${esc(p.n)} <span>${esc(p.p)} · ${esc(p.t)} ${esc(p.s)}</span></div>${marques ? `<div class="gj-marques">${marques}</div>` : ''}${barres}</div>`;
}

/* ======================================================================
   UNE DÉCISION, EN PLEIN ÉCRAN
   ====================================================================== */
let fermerChoixCourant = null;
/**
 * spec : { ico, titre, irl, recit, joueur, options: [{ cle, nom, bon, prix, effet, duree, jauges,
 *          mutation, desactive }], fermable, motFermer, onChoix(cle), onFerme() }
 */
export function ouvrirChoix(spec) {
  const m = $('choixModal');
  if (!m) return () => {};
  if (fermerChoixCourant) fermerChoixCourant(true);
  const nom = spec.joueur ? spec.joueur.n : '';
  const sub = s => esc(String(s || '').replace(/\{nom\}/g, nom || 'ton joueur'));
  m.innerHTML = `<div class="choix-sheet" role="dialog" aria-modal="true" aria-label="${esc(spec.titre)}">
    <div class="choix-tete">
      <span class="choix-ico">${spec.ico || '❓'}</span>
      <div class="choix-titres"><div class="choix-titre">${sub(spec.titre)}</div>${spec.irl ? `<div class="choix-irl">${esc(spec.irl)}</div>` : ''}</div>
      ${spec.fermable ? `<button type="button" class="close-btn choix-fermer" aria-label="${esc(spec.motFermer || 'Plus tard')}" title="${esc(spec.motFermer || 'Plus tard')}">✕</button>` : ''}
    </div>
    <div class="choix-corps">
      ${spec.recit ? `<p class="choix-recit">${sub(spec.recit)}</p>` : ''}
      ${spec.joueur ? carteJoueur(spec.joueur) : ''}
      ${spec.contexte || ''}
      <div class="choix-options">${spec.options.map(o => {
        const mots = [...motsDEffet(o.effet || o, o.duree), ...(o.mutation ? motsDeMutation(o.mutation) : [])];
        return `<button type="button" class="choix-option" data-choix="${esc(o.cle)}"${o.desactive ? ' disabled' : ''}>
          <span class="choix-option-nom">${o.ico ? `${o.ico} ` : ''}${sub(o.nom)}</span>
          ${o.bon ? `<span class="choix-option-bon">+ ${sub(o.bon)}</span>` : ''}
          ${o.prix ? `<span class="choix-option-prix">− ${sub(o.prix)}</span>` : ''}
          ${o.mutation ? `<span class="choix-option-mut">${MUTATIONS[o.mutation].ico} ${esc(MUTATIONS[o.mutation].quoi)}</span>` : ''}
          <span class="choix-puces">${puces(mots)}${pucesJauges(o.jauges)}</span>
          ${o.desactive ? `<span class="choix-option-non">${esc(o.desactive)}</span>` : ''}
        </button>`;
      }).join('')}</div>
    </div>
  </div>`;
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  const fermer = (silencieux = false) => {
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('choix-ouvert');
    fermerChoixCourant = null;
    if (!silencieux && spec.onFerme) spec.onFerme();
  };
  fermerChoixCourant = fermer;
  m.querySelectorAll('[data-choix]').forEach(b => { b.onclick = () => { fermer(true); spec.onChoix(b.dataset.choix); }; });
  const x = m.querySelector('.choix-fermer');
  if (x) x.onclick = () => fermer();
  const premier = m.querySelector('.choix-option:not([disabled])');
  if (premier) premier.focus({ preventScroll: true });
  return () => fermer(true);
}
export const choixOuvert = () => !!fermerChoixCourant;

/* ======================================================================
   MES LIGNES, EN PLEIN ÉCRAN
   ====================================================================== */
const NOMS_LIGNE = ['1re ligne', '2e ligne', '3e ligne', '4e ligne'];
const ROLES = ['AG', 'C', 'AD', 'DG', 'DD'];
/* Les minutes à forces égales qu'une ligne jouera, ses secondes appliquées. */
function minutes(lignes) {
  const w = POIDS_TRIO.map((x, u) => x * lignes[u].sec / SEC_DEFAUT);
  const s = w.reduce((a, b) => a + b, 0) || 1;
  return w.map(x => x / s * 60);
}
const mmss = m => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`;

/**
 * spec : {
 *   titre, lineup (case → joueur), lignes [{ tac, agr, sec }] × 4, chimie [4], energie { clé: 0-100 },
 *   adv: { nom, lignes [{ tac }] } | null, match: { importance, ad } | null,
 *   onAppliquer(lignes, match), onBanc() | null, sousTitre
 * }
 */
export function ouvrirLignes(spec) {
  const m = $('lignesModal');
  if (!m) return;
  const brouillon = spec.lignes.map(l => ({ ...l }));
  const match = spec.match ? { importance: spec.match.importance || 'normale', ad: spec.match.ad || 0 } : null;
  let ouverte = 0;

  const joueurLigne = (u, role) => {
    const js = joueursDeLigne(spec.lineup, u);
    if (!(role in js)) return '';
    const p = js[role];
    const T = TACTIQUES[brouillon[u].tac];
    const voulu = T && T.slots ? T.slots[role] : null;
    const pr = p && profilsDe(p);
    const pp = p && profilPrincipal(p);
    const g = role === 'DG' || role === 'DD' ? 'D' : 'F';
    const e = p ? (spec.energie[getPlayerKey(p)] ?? 100) : 0;
    const fitRole = voulu && pr ? pr[voulu] : null;
    return `<div class="gl-j${fitRole != null ? (fitRole >= 60 ? ' fit-bon' : fitRole < 40 ? ' fit-mauvais' : '') : ''}">
      <span class="gl-j-role">${role}</span>
      <span class="gl-j-nom">${p ? esc(p.n) : '<i>vide</i>'}</span>
      <span class="gl-j-prof" title="${pp ? `Son meilleur profil : ${esc(pp.nom)} ${pp.fit} %` : ''}">${pp ? `${pp.ico} ${pp.fit}` : ''}</span>
      ${voulu ? `<span class="gl-j-voulu" title="Ce que ${esc(T.nom)} demande à ce poste : ${esc(PROFILS[g][voulu].nom)}">${PROFILS[g][voulu].ico} ${fitRole ?? '—'} %</span>` : '<span class="gl-j-voulu"></span>'}
      <span class="gl-j-energie" title="Énergie ${e} %"><span style="width:${e}%" class="${e < 60 ? 'bas' : e < 85 ? 'moyen' : ''}"></span></span>
      ${(p && p._mutCles || []).map(k => MUTATIONS[k] ? `<span class="gl-j-mut" title="${esc(MUTATIONS[k].nom)}">${MUTATIONS[k].ico}</span>` : '').join('')}
    </div>`;
  };

  function dessiner() {
    const mins = minutes(brouillon);
    const tete = `<div class="choix-tete">
      <span class="choix-ico">🏒</span>
      <div class="choix-titres"><div class="choix-titre">${esc(spec.titre || 'Mes lignes')}</div>${spec.sousTitre ? `<div class="choix-irl">${esc(spec.sousTitre)}</div>` : ''}</div>
      <button type="button" class="close-btn gl-annuler" aria-label="Fermer sans rien changer" title="Fermer sans rien changer">✕</button>
    </div>`;
    const consigne = match ? `<section class="gl-consigne">
      <div class="gl-sec-titre">Consigne du match</div>
      <div class="gl-seg">${Object.entries(IMPORTANCES).map(([k, I]) => `<button type="button" class="gl-seg-btn${match.importance === k ? ' on' : ''}" data-importance="${k}">
        <b>${I.ico} ${esc(I.nom)}</b><small>${esc(I.mot)}</small><span class="choix-puces">${puces(motsDEffet(I))}${pucesJauges(I.jauges)}</span></button>`).join('')}</div>
      <div class="gl-ad"><span>🛡️ Défense</span><input type="range" min="-2" max="2" step="1" value="${match.ad}" class="gl-ad-range" aria-label="Attaque ou défense"><span>Attaque 🎯</span></div>
      <div class="choix-puces gl-ad-puces">${puces(motsDEffet({ finition: 1 + 0.025 * match.ad, defense: 1 + 0.02 * match.ad }))}${match.ad ? '' : '<span class="puce neutre">Équilibré</span>'}</div>
    </section>` : '';
    const onglets = `<div class="gl-onglets" role="tablist">${NOMS_LIGNE.map((n, u) => {
      const T = TACTIQUES[brouillon[u].tac];
      return `<button type="button" role="tab" class="gl-onglet${u === ouverte ? ' on' : ''}" data-ligne="${u}" aria-selected="${u === ouverte}">
        <b>${n}</b><span>${T.ico} ${esc(T.nom)}</span><small>chimie ${Math.round(spec.chimie[u] || 0)} % · ${mmss(mins[u])}</small></button>`;
    }).join('')}</div>`;
    const u = ouverte, l = brouillon[u], T = TACTIQUES[l.tac];
    const adv = spec.adv && spec.adv.lignes && spec.adv.lignes[u];
    const Tadv = adv && TACTIQUES[adv.tac];
    const leContre = Tadv ? contreDe(adv.tac) : null;
    const quiMeContre = contreDe(l.tac);
    const fitCourant = l.tac === 'hourra' ? 0 : fitLigne(spec.lineup, u, l.tac);
    const detail = `<section class="gl-ligne">
      <div class="gl-joueurs">${ROLES.map(r => joueurLigne(u, r)).join('')}</div>
      <div class="gl-etat">
        <div><span class="gl-k">Fit</span> <b>${l.tac === 'hourra' ? '—' : `${fitCourant} %`}</b> <small>${l.tac === 'hourra' ? 'aucune chimie' : `la chimie peut monter jusqu'à ${Math.round(chimieMax(fitCourant))} %`}</small></div>
        <div><span class="gl-k">Chimie</span> <span class="gj-barre gl-chimie"><span style="width:${Math.round(spec.chimie[u] || 0)}%"></span></span> <b>${Math.round(spec.chimie[u] || 0)} %</b> <small>elle monte en jouant ensemble, elle baisse à chaque joueur changé</small></div>
        ${Tadv ? `<div class="gl-adv">En face, ${esc(spec.adv.nom)} : <b>${Tadv.ico} ${esc(Tadv.nom)}</b>${leContre ? ` · pour étouffer ses actions spéciales : <b>${TACTIQUES[leContre].ico} ${esc(TACTIQUES[leContre].nom)}</b>` : ''}${quiMeContre && adv.tac === quiMeContre ? ` · <span class="prix">⚠️ sa tactique étouffe la tienne</span>` : ''}</div>` : ''}
      </div>
      <div class="gl-sec-titre">Tactique</div>
      <div class="gl-tacs">${Object.entries(TACTIQUES).map(([k, X]) => {
        const f = k === 'hourra' ? null : fitLigne(spec.lineup, u, k);
        const ct = contreDe(k);
        return `<button type="button" class="gl-tac${l.tac === k ? ' on' : ''}${Tadv && X.bat === adv.tac ? ' contre' : ''}" data-tac="${k}" title="${esc(X.mot)}">
          <b>${X.ico} ${esc(X.nom)}</b>
          <span class="gl-tac-fit${f == null ? '' : f >= 60 ? ' bon' : f < 40 ? ' prix' : ''}">${f == null ? 'aucun fit à chercher' : `fit ${f} %`}</span>
          ${X.bat ? `<small>étouffe ${TACTIQUES[X.bat].ico} · étouffée par ${ct ? TACTIQUES[ct].ico : '—'}</small>` : '<small>ni chimie ni action spéciale</small>'}
          <span class="choix-puces">${puces(motsDEffet(X))}</span>
        </button>`;
      }).join('')}</div>
      <div class="gl-mot">${esc(T.mot)}${T.slots ? ` Elle demande : ${Object.entries(T.slots).filter(([r]) => r in joueursDeLigne(spec.lineup, u)).map(([r, pr]) => `${r} ${(PROFILS.F[pr] || PROFILS.D[pr]).ico} ${esc((PROFILS.F[pr] || PROFILS.D[pr]).nom)}`).join(' · ')}.` : ''}</div>
      <div class="gl-sec-titre">Agressivité</div>
      <div class="gl-seg">${AGRESSIVITES.map((A, i) => `<button type="button" class="gl-seg-btn${l.agr === i ? ' on' : ''}" data-agr="${i}">
        <b>${A.ico} ${esc(A.nom)}</b><span class="choix-puces">${puces([
          { txt: `Physique ${A.physique >= 0.4 ? '+' : '−'}${Math.round(Math.abs(A.physique - 0.4) * 10)}`, bon: A.physique > 0.4 ? true : A.physique < 0.4 ? false : null },
          ...motsDEffet({ discipline: A.punitions, energie: A.energie })])}</span></button>`).join('')}</div>
      <div class="gl-sec-titre">Glace : ${l.sec} s par présence · ≈ ${mmss(mins[u])} à forces égales</div>
      <input type="range" class="gl-sec" min="${SEC_MIN}" max="${SEC_MAX}" step="5" value="${l.sec}" aria-label="Secondes de présence de la ${NOMS_LIGNE[u]}">
      <div class="gl-mot">Plus de glace, plus de lancers pour cette ligne — et plus de fatigue : un joueur usé rend moins et, sous 60 % d'énergie, se blesse plus.</div>
    </section>`;
    m.innerHTML = `<div class="choix-sheet gl-sheet" role="dialog" aria-modal="true" aria-label="Mes lignes">
      ${tete}
      <div class="choix-corps">${consigne}${onglets}${detail}</div>
      <div class="gl-pied">
        ${spec.onBanc ? '<button type="button" class="btn gl-banc">Changer les trios</button>' : ''}
        <button type="button" class="btn go gl-appliquer">${esc(spec.motAppliquer || 'Appliquer')}</button>
      </div>
    </div>`;
    brancher();
  }
  function brancher() {
    m.querySelectorAll('[data-ligne]').forEach(b => { b.onclick = () => { ouverte = Number(b.dataset.ligne); dessiner(); }; });
    m.querySelectorAll('[data-tac]').forEach(b => { b.onclick = () => { brouillon[ouverte].tac = b.dataset.tac; dessiner(); }; });
    m.querySelectorAll('[data-agr]').forEach(b => { b.onclick = () => { brouillon[ouverte].agr = Number(b.dataset.agr); dessiner(); }; });
    const s = m.querySelector('.gl-sec');
    if (s) s.onchange = () => { brouillon[ouverte].sec = Number(s.value); dessiner(); };
    m.querySelectorAll('[data-importance]').forEach(b => { b.onclick = () => { match.importance = b.dataset.importance; dessiner(); }; });
    const ad = m.querySelector('.gl-ad-range');
    if (ad) ad.onchange = () => { match.ad = Number(ad.value); dessiner(); };
    m.querySelector('.gl-annuler').onclick = fermer;
    m.querySelector('.gl-appliquer').onclick = () => { fermer(); spec.onAppliquer(brouillon, match); };
    const bb = m.querySelector('.gl-banc');
    if (bb) bb.onclick = () => { fermer(); spec.onBanc(); };
  }
  const fermer = () => { m.hidden = true; m.innerHTML = ''; document.body.classList.remove('choix-ouvert'); };
  m.hidden = false;
  document.body.classList.add('choix-ouvert');
  dessiner();
}

/* Le résumé d'une ligne pour l'affiche du match : sa tactique et sa chimie. */
export function resumeLignes(lignes, chimie) {
  return lignes.map((l, u) => {
    const T = TACTIQUES[l.tac];
    return `<span class="gl-resume" title="${esc(NOMS_LIGNE[u])} : ${esc(T.nom)}, chimie ${Math.round(chimie[u] || 0)} %">${T.ico}<small>${Math.round(chimie[u] || 0)}</small></span>`;
  }).join('');
}
void SLOTS;
