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
  MUTATIONS, SLOTS, getPlayerKey, getHiddenRatings, getPositionPenalty, CARTES,
  PLANS_ADV, commentContrer, planEstContre, reglageDuPlan,
  physiqueDe, physiqueLigne, bilanAgressivite, flechesDe,
} from './sim.js';
import { POIDS_TRIO, getLineZone } from './ratings.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Les puces d'un effet : vert s'il aide, rouge s'il coûte, gris s'il ne fait que déplacer. */
export function puces(mots) {
  return (mots || []).map(m => `<span class="puce ${m.bon === true ? 'bon' : m.bon === false ? 'prix' : 'neutre'}${m.duree ? ' duree' : ''}">${esc(m.txt)}</span>`).join('');
}
/*
 * CE QU'UNE CARTE FAIT, EN PUCES (S72). JP : *varie les cartes* ; *faut le
 * faire pour vrai*. Un cadeau n'a que du vert, un moindre mal que du rouge ;
 * un pari dit sa chance et ses deux issues, un investissement ce qui vient
 * plus tard, un geste réel qui il touche et ce qui lui arrive.
 */
const plur = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
export function motsDAction(a, noms = '') {
  if (!a) return [];
  const qui = noms || 'le joueur visé';
  const out = [];
  if (a.absents) out.push({ txt: `👥 ${qui} au vestiaire ${plur(a.absents, 'match')} — un réserviste ou un rappelé joue`, bon: null });
  if (a.energie) out.push({ txt: `👥 ${qui} : énergie ${flechesDe(1 + a.energie / 100, [0.15, 0.3])}`, bon: a.energie > 0 });
  if (a.energieTous) out.push({ txt: `👥 Toute l'équipe : énergie ${flechesDe(1 + a.energieTous / 100, [0.1, 0.2])}`, bon: a.energieTous > 0 });
  if (a.gardienAux) out.push({ txt: `🧤 L'auxiliaire garde le filet ${plur(a.gardienAux, 'match')}`, bon: null });
  return out;
}
export function motsDeCarte(o, noms = '') {
  const out = [];
  if (o.action) out.push(...motsDAction(o.action, noms));
  if (o.changeGardien) out.push({ txt: '🧤 L\'auxiliaire prend le filet', bon: null });
  if (o.gardienAux === true) out.push({ txt: '🧤 L\'auxiliaire au filet ce match-là', bon: null });
  if (o.enjeu) out.push({ txt: '⚖️ Après le match, l\'élan ou le contrecoup dure deux fois plus', bon: null });
  if (o.pari) {
    const p = Math.round(o.pari.chance * 100);
    const issue = e => { const { duree, action, ...c } = e || {}; const m = [...motsDEffet(c, duree), ...motsDAction(action, noms)]; return m.length ? m.map(x => x.txt).join(', ') : 'rien'; };
    out.push({ txt: `🎲 ${p} % : ${issue(o.pari.gagne)}`, bon: true });
    out.push({ txt: `🎲 sinon : ${issue(o.pari.perd)}`, bon: false });
  }
  if (o.ensuite) {
    const { apres, duree, ...c } = o.ensuite;
    out.push({ txt: `⏳ Dans ${plur(apres || 0, 'match')} : ${motsDEffet(c, duree).map(x => x.txt).join(', ')}`, bon: true });
  }
  if (o.rien) out.push({ txt: 'Rien ne change', bon: null });
  return out;
}

/*
 * LE PLAN DE L'ADVERSAIRE (S70, S72), tel que le rapport d'éclaireur le lit :
 * ce qu'il règle sur ses lignes, ce que ce système fait, ce qui le contre, et
 * si tes lignes le contrent.
 */
export function planAdverseHtml(cle, contre, { nomAdv = 'Ils', suite = '' } = {}) {
  const P = PLANS_ADV[cle];
  if (!P) return '';
  // Le plan est un réglage de lignes (S72) : ce qu'il règle, et ce que ce système fait.
  const T = P.tac ? TACTIQUES[P.tac] : null;
  const mots = T ? motsDEffet(T).map(m => ({ txt: `${nomAdv} : ${m.txt}`, bon: !m.bon })) : [];
  return `<div class="plan-adv${contre ? ' contre' : ''}">
    <div class="plan-adv-t">${P.ico} Leur plan : <b>${esc(P.nom)}</b>${suite ? ` <small>${esc(suite)}</small>` : ''}</div>
    <div class="plan-adv-mot">${esc(P.mot)} <b>${esc(reglageDuPlan(cle))}</b>.</div>
    ${mots.length ? `<div class="choix-puces">${puces(mots)}</div>` : ''}
    <div class="plan-adv-contre"><b>${contre ? '✓ Tu le contres' : '✗ Pas contré'}</b> · pour le contrer : ${esc(commentContrer(cle))}.</div>
  </div>`;
}

/*
 * CE QU'UN JOUEUR SAIT FAIRE, EN MOTS (S71). JP : *la carte des joueurs est
 * rendue trop complexe à lire* ; *pas besoin de stats chiffrées aussi
 * complexes*. Six barres chiffrées disaient tout et ne disaient rien : on
 * garde ses deux ou trois vrais rôles, avec un mot pour le niveau, et sa
 * carrure quand elle compte (le jeu physique en dépend).
 */
export const niveauDe = x => (x >= 85 ? 'élite' : x >= 70 ? 'très bon' : x >= 55 ? 'bon' : x >= 40 ? 'correct' : 'faible');
export const carrureDe = p => { const ph = physiqueDe(p); return ph >= 0.62 ? { ico: '🪨', mot: 'Costaud' } : ph <= 0.38 ? { ico: '🪶', mot: 'Léger' } : null; };
export function rolesDe(p) {
  const pr = profilsDe(p);
  if (!pr) return '';
  const g = p.p === 'D' || p.p === 'LD' || p.p === 'RD' ? 'D' : 'F';
  const tri = Object.entries(pr).sort((a, b) => b[1] - a[1]);
  const forts = tri.filter(([, v]) => v >= 55).slice(0, 3);
  const liste = forts.length ? forts : tri.slice(0, 1);
  const c = carrureDe(p);
  return `<div class="gj-roles">${liste.map(([k, v]) => `<span class="puce ${v >= 70 ? 'bon' : 'neutre'}" title="${esc(PROFILS[g][k].mot)}">${PROFILS[g][k].ico} ${esc(PROFILS[g][k].nom)} · ${niveauDe(v)}</span>`).join('')}${c ? `<span class="puce neutre" title="Son physique : le jeu robuste lui ${c.ico === '🪨' ? 'réussit' : 'coûte des punitions'}">${c.ico} ${c.mot}</span>` : ''}</div>`;
}
/* L'ancien nom : la fiche l'appelle encore. */
export const barresProfils = rolesDe;
/* « Brodeur, Stevens et Niedermayer » : une liste de noms, en français. */
export const listeNoms = ns => (ns.length <= 1 ? ns[0] || '' : `${ns.slice(0, -1).join(', ')} et ${ns[ns.length - 1]}`);
/* Les canaux d'effet d'un objet : ce que motsDEffet sait dire. */
const CANAUX = ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
const canauxDe = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => CANAUX.includes(k)));

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
  const nom = spec.joueur ? spec.joueur.n : (spec.joueurs && spec.joueurs[0] ? spec.joueurs[0].n : '');
  // {noms} : les joueurs visés par un geste réel, nommés (S72).
  const noms = spec.joueurs && spec.joueurs.length ? listeNoms(spec.joueurs.map(p => p.n)) : '';
  const sub = s => esc(String(s || '').replace(/\{nom\}/g, nom || 'ton joueur').replace(/\{noms\}/g, noms || 'tes joueurs'));
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
        const { duree: _d, ...canaux } = o.effet || o;
        const mots = [...(o.rien ? [] : motsDEffet(canaux, Object.keys(canauxDe(canaux)).length ? o.duree : null)), ...(o.mutation ? motsDeMutation(o.mutation) : []), ...motsDeCarte(o, noms)];
        return `<button type="button" class="choix-option" data-choix="${esc(o.cle)}"${o.desactive ? ' disabled' : ''}>
          <span class="choix-option-nom">${o.ico ? `${o.ico} ` : ''}${sub(o.nom)}</span>
          ${o.bon ? `<span class="choix-option-bon">+ ${sub(o.bon)}</span>` : ''}
          ${o.prix ? `<span class="choix-option-prix">− ${sub(o.prix)}</span>` : ''}
          ${o.mutation ? `<span class="choix-option-mut">${MUTATIONS[o.mutation].ico} ${esc(MUTATIONS[o.mutation].quoi)}</span>` : ''}
          <span class="choix-puces">${puces(mots.map(x => ({ ...x, txt: String(x.txt).replace(/\{nom\}/g, nom).replace(/\{noms\}/g, noms) })))}${o.quand ? `<span class="puce neutre duree">${esc(o.quand)}</span>` : ''}</span>
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
/* Le fit d'une ligne à une tactique, et sa chimie, en mots (S71). */
export const motFit = f => (f >= 70 ? 'Taillée pour elle' : f >= 55 ? 'Bon fit' : f >= 40 ? 'Fit moyen' : 'Mauvais fit');
const motChimie = c => (c >= 70 ? 'excellente' : c >= 45 ? 'bonne' : c >= 20 ? 'correcte' : 'naissante');
const plafondChimie = c => (c >= 70 ? 'haut' : c >= 45 ? 'bon' : c >= 20 ? 'bas' : 'très bas');

/**
 * spec : {
 *   titre, lineup (case → joueur), lignes [{ tac, agr, sec }] × 4, chimie [4], energie { clé: 0-100 },
 *   adv: { nom, lignes [{ tac }] } | null, match: { importance, ad } | null,
 *   onAppliquer(lignes, match), onBanc() | null, sousTitre
 * }
 */
/*
 * LE PLACEMENT D'UN JOUEUR DANS SA LIGNE (S72) : ▼ trop bas (son talent est
 * gaspillé, l'unité porte un malus), ▲ trop haut (un cran, léger), ↔ hors de
 * sa position naturelle. Rien s'il est à sa place.
 */
function placementDe(p, role, u) {
  const g = role === 'DG' || role === 'DD' ? 'D' : 'F';
  const unite = g === 'D' ? u : u;
  const slot = SLOTS.find(s => !s.scratch && s.role === role && s.unit === unite && s.group === g);
  const bits = [];
  const z = getLineZone(p, getHiddenRatings(p).v);
  const ideal = (z && z.idealUnits) || [];
  if (ideal.length && unite > Math.max(...ideal)) bits.push(['▼', 'Trop bas : son talent est gaspillé ici, l\'unité porte un malus']);
  else if (ideal.length && unite < Math.min(...ideal)) bits.push(['▲', 'Un cran trop haut : léger malus']);
  const pen = slot ? getPositionPenalty(p, slot) : 0;
  if (pen > 0) bits.push(['↔', 'Hors de sa position naturelle']);
  return bits.length ? { html: bits.map(([m, t]) => ` <span class="gl-j-place" title="${esc(t)}">${m}</span>`).join(''), bits } : null;
}
/*
 * CE QUI JOUE SUR TA FORMATION (S72). JP : *les bonus et malus devraient être
 * avec les stratégies, tout devrait être ensemble*. Les effets en cours —
 * dilemmes, séquences, élan, paris, investissements, cartes — et les absents
 * se lisent ici, à côté des lignes, avec le nombre de matchs qui restent.
 */
export function effetsHtml(e) {
  if (!e) return '';
  const lignes = [];
  for (const x of e.effets || []) {
    const mots = motsDEffet(canauxDe(x));
    if (!mots.length) continue;
    lignes.push(`<div class="gl-effet"><span class="gl-effet-nom">${x.ico ? `${x.ico} ` : ''}${esc(x.nom || 'Effet')}${x.choix ? ` <small>· ${esc(x.choix)}</small>` : ''}</span><span class="choix-puces">${puces(mots)}<span class="puce neutre duree">${plur(x.reste, 'match')}</span></span></div>`);
  }
  for (const c of e.cartes || []) if (CARTES[c]) lignes.push(`<div class="gl-effet"><span class="gl-effet-nom">${CARTES[c].ico} ${esc(CARTES[c].nom)} <small>· carte</small></span><span class="choix-puces">${puces(motsDEffet(canauxDe(CARTES[c])))}<span class="puce neutre duree">la saison</span></span></div>`);
  for (const a of e.absents || []) lignes.push(`<div class="gl-effet"><span class="gl-effet-nom">👥 ${esc(a.p.n)} <small>· au vestiaire</small></span><span class="choix-puces"><span class="puce neutre duree">${plur(a.reste, 'match')}</span></span></div>`);
  if (e.gardienAux) lignes.push(`<div class="gl-effet"><span class="gl-effet-nom">🧤 L'auxiliaire au filet</span><span class="choix-puces"><span class="puce neutre duree">${plur(e.gardienAux, 'match')}</span></span></div>`);
  return `<section class="gl-effets"><div class="gl-sec-titre">Ce qui joue sur ta formation</div>${lignes.length ? lignes.join('') : '<div class="gl-mot">Rien pour l\'instant : tes lignes jouent sur leur propre valeur.</div>'}</section>`;
}
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
    const c = p ? carrureDe(p) : null;
    const marque = fitRole == null ? '' : fitRole >= 60 ? '✓' : fitRole < 40 ? '✗' : '≈';
    // TOUT CE QUI JOUE SUR LE TRIO, ICI (S72) : sa zone (le rang de ligne où
    // il rend) et sa position (mauvaise aile, centre à l'aile).
    const place = p ? placementDe(p, role, u) : null;
    return `<div class="gl-j${fitRole != null ? (fitRole >= 60 ? ' fit-bon' : fitRole < 40 ? ' fit-mauvais' : '') : ''}">
      <span class="gl-j-role">${role}</span>
      <span class="gl-j-nom">${p ? esc(p.n) : '<i>vide</i>'}${place ? place.html : ''}</span>
      <span class="gl-j-prof" title="${pp ? `Son meilleur rôle : ${esc(pp.nom)} (${niveauDe(pp.fit)})${c ? ` · ${c.mot}` : ''}` : ''}">${c ? c.ico : ''}</span>
      ${voulu ? `<span class="gl-j-voulu" title="Ce que ${esc(T.nom)} demande à ce poste : ${esc(PROFILS[g][voulu].nom)} — il y est ${niveauDe(fitRole ?? 0)}">${PROFILS[g][voulu].ico} <b class="gl-j-marque">${marque}</b></span>` : '<span class="gl-j-voulu"></span>'}
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
    /*
     * LA CONSIGNE TIENT EN UNE RANGÉE (S71). JP : *avoir les bonnes infos au
     * bon endroit, lisible*. Trois grandes cases poussaient les lignes — ce
     * qu'on vient régler — sous le premier écran du téléphone. Trois boutons
     * courts, et l'effet du choix courant en une ligne dessous.
     */
    const Icour = match ? IMPORTANCES[match.importance] || IMPORTANCES.normale : null;
    const consigne = match ? `<section class="gl-consigne">
      <div class="gl-sec-titre">Consigne du match</div>
      <div class="gl-seg gl-seg-court">${Object.entries(IMPORTANCES).map(([k, I]) => `<button type="button" class="gl-seg-btn${match.importance === k ? ' on' : ''}" data-importance="${k}">
        <b>${I.ico} ${esc(I.nom)}</b><span class="choix-puces">${puces(motsDEffet(I))}</span></button>`).join('')}</div>
      <div class="gl-consigne-effet"><small>${esc(Icour.mot)}</small> <span class="choix-puces">${puces(motsDEffet(Icour))}</span></div>
      <div class="gl-ad"><span>🛡️ Défense</span><input type="range" min="-2" max="2" step="1" value="${match.ad}" class="gl-ad-range" aria-label="Attaque ou défense"><span>Attaque 🎯</span></div>
      <div class="choix-puces gl-ad-puces">${puces(motsDEffet({ finition: 1 + 0.025 * match.ad, defense: 1 + 0.02 * match.ad }))}${match.ad ? '' : '<span class="puce neutre">Équilibré</span>'}</div>
    </section>` : '';
    const onglets = `<div class="gl-onglets" role="tablist">${NOMS_LIGNE.map((n, u) => {
      const T = TACTIQUES[brouillon[u].tac];
      return `<button type="button" role="tab" class="gl-onglet${u === ouverte ? ' on' : ''}" data-ligne="${u}" aria-selected="${u === ouverte}">
        <b>${n}</b><span>${T.ico} ${esc(T.nom)}</span><small>chimie ${motChimie(spec.chimie[u] || 0)} · ${mmss(mins[u])}</small></button>`;
    }).join('')}</div>`;
    const u = ouverte, l = brouillon[u], T = TACTIQUES[l.tac];
    const adv = spec.adv && spec.adv.lignes && spec.adv.lignes[u];
    const Tadv = adv && TACTIQUES[adv.tac];
    const leContre = Tadv ? contreDe(adv.tac) : null;
    const quiMeContre = contreDe(l.tac);
    const fitCourant = l.tac === 'hourra' ? 0 : fitLigne(spec.lineup, u, l.tac);
    // LA CARRURE DE LA LIGNE (S71) : c'est elle qui dit si le jeu physique paie.
    const ph = physiqueLigne(spec.lineup, u);
    const carrureLigne = ph >= 0.56 ? '🪨 ligne costaude' : ph <= 0.44 ? '🪶 ligne légère' : '⚖️ ligne moyenne';
    const detail = `<section class="gl-ligne">
      <div class="gl-joueurs">${ROLES.map(r => joueurLigne(u, r)).join('')}</div>
      <div class="gl-etat">
        <div><span class="gl-k">Fit</span> <b>${l.tac === 'hourra' ? '—' : motFit(fitCourant)}</b> <small>${l.tac === 'hourra' ? 'aucune chimie' : `plafond de chimie : ${plafondChimie(chimieMax(fitCourant))}`}</small></div>
        <div><span class="gl-k">Chimie</span> <span class="gj-barre gl-chimie"><span style="width:${Math.round(spec.chimie[u] || 0)}%"></span></span> <b>${motChimie(spec.chimie[u] || 0)}</b> <small>elle monte en jouant ensemble, elle baisse à chaque joueur changé</small></div>
        ${Tadv ? `<div class="gl-adv">En face, ${esc(spec.adv.nom)} : <b>${Tadv.ico} ${esc(Tadv.nom)}</b>${leContre ? ` · pour étouffer ses actions spéciales : <b>${TACTIQUES[leContre].ico} ${esc(TACTIQUES[leContre].nom)}</b>` : ''}${quiMeContre && adv.tac === quiMeContre ? ` · <span class="prix">⚠️ sa tactique étouffe la tienne</span>` : ''}</div>` : ''}
      </div>
      <div class="gl-sec-titre">Tactique</div>
      <div class="gl-tacs">${Object.entries(TACTIQUES).map(([k, X]) => {
        const f = k === 'hourra' ? null : fitLigne(spec.lineup, u, k);
        const ct = contreDe(k);
        return `<button type="button" class="gl-tac${l.tac === k ? ' on' : ''}${Tadv && X.bat === adv.tac ? ' contre' : ''}" data-tac="${k}" title="${esc(X.mot)}">
          <b>${X.ico} ${esc(X.nom)}</b>
          <span class="gl-tac-fit${f == null ? '' : f >= 55 ? ' bon' : f < 40 ? ' prix' : ''}">${f == null ? 'aucun fit à chercher' : motFit(f)}</span>
          ${X.bat ? `<small>étouffe ${TACTIQUES[X.bat].ico} · étouffée par ${ct ? TACTIQUES[ct].ico : '—'}</small>` : '<small>ni chimie ni action spéciale</small>'}
          <span class="choix-puces">${puces(motsDEffet(X))}</span>
        </button>`;
      }).join('')}</div>
      <div class="gl-mot">${esc(T.mot)}${T.slots ? ` Elle demande : ${Object.entries(T.slots).filter(([r]) => r in joueursDeLigne(spec.lineup, u)).map(([r, pr]) => `${r} ${(PROFILS.F[pr] || PROFILS.D[pr]).ico} ${esc((PROFILS.F[pr] || PROFILS.D[pr]).nom)}`).join(' · ')}.` : ''}</div>
      <div class="gl-sec-titre">Agressivité · ${carrureLigne}</div>
      <div class="gl-mot">Le jeu physique rapporte aux lignes costaudes 🪨. Une ligne légère 🪶 accroche au lieu de frapper : elle prend des punitions.</div>
      <div class="gl-seg">${AGRESSIVITES.map((A, i) => {
        const b = bilanAgressivite(i, ph);
        const verdict = i === 1 ? { txt: 'Par défaut', bon: null } : b.net > 0.006 ? { txt: '✓ Payant pour cette ligne', bon: true } : b.net < -0.006 ? { txt: '✗ Coûteux pour cette ligne', bon: false } : { txt: '≈ Neutre pour cette ligne', bon: null };
        const effets = i === 1 ? [] : [
          { txt: `Défense ${flechesDe(1 + b.defense)}`, bon: b.defense > 0 },
          { txt: `Punitions ${flechesDe(1 + b.punitions, [0.1, 0.3])}`, bon: b.punitions < 0 },
          ...motsDEffet({ energie: A.energie })];
        return `<button type="button" class="gl-seg-btn${l.agr === i ? ' on' : ''}" data-agr="${i}">
        <b>${A.ico} ${esc(A.nom)}</b><span class="choix-puces">${puces([verdict, ...effets])}</span></button>`;
      }).join('')}</div>
      <div class="gl-sec-titre">Glace : ${l.sec} s par présence · ≈ ${mmss(mins[u])} à forces égales</div>
      <input type="range" class="gl-sec" min="${SEC_MIN}" max="${SEC_MAX}" step="5" value="${l.sec}" aria-label="Secondes de présence de la ${NOMS_LIGNE[u]}">
      <div class="gl-mot">Plus de glace, plus de lancers pour cette ligne — et plus de fatigue : un joueur usé rend moins et, sous 60 % d'énergie, se blesse plus.</div>
    </section>`;
    m.innerHTML = `<div class="choix-sheet gl-sheet" role="dialog" aria-modal="true" aria-label="Mes lignes">
      ${tete}
      <div class="choix-corps">${effetsHtml(spec.effets)}${spec.plan ? planAdverseHtml(spec.plan, planEstContre(spec.plan, brouillon, match ? match.ad : 0), { nomAdv: spec.adv ? spec.adv.nom : 'Eux', suite: spec.planSuite || '' }) : ''}${consigne}${onglets}${detail}</div>
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
    const c = chimie[u] || 0;
    return `<span class="gl-resume" title="${esc(NOMS_LIGNE[u])} : ${esc(T.nom)}, chimie ${motChimie(c)}">${T.ico}<small>${'•'.repeat(c >= 70 ? 3 : c >= 35 ? 2 : 1)}</small></span>`;
  }).join('');
}
void SLOTS;
