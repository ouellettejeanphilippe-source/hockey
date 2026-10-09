/*
 * L'ÉCRAN « NOUVELLE PARTIE » (sorti de js/game.js en 1.0) : on compose un
 * brouillon (format, tirage, ligue, repêchage), puis le pied lance la partie.
 */

import { state } from './data.js';
import { FRANCHISES, saisonsDeFranchise } from './franchises.js';
import { MODES, modeDe, casesDuMode, REROLLS } from './sim.js';
import { ouvrirChoix } from './gerant.js';
import { identitesOffertes, IDENTITES } from './identites.js';
import { esc } from './util.js';
import { $, G, normRepechage, openModal, rnd, signes } from './game.js';

/* =====================================================================
   L'ÉCRAN « NOUVELLE PARTIE » : on compose, puis on lance
   =====================================================================
   JP : *faire bouton new game aussi, qui permet de choisir les options du jeu
   au lieu d'un menu option, pour faire plus « jeu »*.

   DEUX INVARIANTS. (1) Un réglage de PARTIE ne touche jamais `G` avant le
   bouton du pied, et UN SEUL `demarrerPartie()` part par clic — `setOption`
   lançait un `newGame()` non attendu dans quatre branches, donc changer le
   format puis le tirage mettait deux `chargerRenfort()` et deux `nextSpin()`
   en vol, et le plus lent écrivait `G.tirage`. (2) Un réglage qui, changé,
   oblige à jeter l'alignement est un réglage de PARTIE ; les quatre qui
   restent dans les options peuvent changer au milieu d'un tour sans rien
   perdre.
   ===================================================================== */

/*
 * « AU HASARD » (S78). JP : *ajouter random au mode saison années ou au mode
 * piger dans une équipe seulement*. La saison de la ligue et la franchise du
 * repêchage peuvent se laisser au dé : le tirage se fait AU DÉPART, une fois,
 * et le toast le dit. La partie porte ensuite la vraie saison, la vraie
 * franchise — la sauvegarde ne connaît jamais « au hasard ».
 */
const HASARD = 'HASARD';
export function resoudreHasard(b) {
  const mots = [];
  if (b.epoqueChoisie === HASARD || b.epoque === HASARD) {
    const x = rnd(state.index.seasons);
    if (b.epoque === HASARD) { b.epoque = x; mots.push(`la saison ${x}`); }
    b.epoqueChoisie = x;
  }
  if (b.repechage === 'FRANCHISE' && b.franchise === HASARD) {
    b.franchise = rnd(Object.keys(FRANCHISES).filter(k => saisonsDeFranchise(k, state.index.seasons).length));
    mots.push(FRANCHISES[b.franchise].nom);
  }
  return mots;
}

/** Les valeurs de départ viennent de l'état VIVANT, jamais des préférences. */
export function semerBrouillon() {
  const dernier = state.index.seasons[state.index.seasons.length - 1];
  G.brouillon = {
    mode: G.mode, epoque: G.epoque, repechage: G.repechage, franchise: G.franchise, bonus: G.bonus,
    // La saison RETENUE, même quand la ligue est « toutes les époques » : un
    // aller-retour ne doit pas ramener la dernière saison de la liste.
    epoqueChoisie: G.epoque || dernier,
  };
  syncOptionsUI();
  majPiedPartie();
}

export function oublierBrouillon() { G.brouillon = null; syncOptionsUI(); }

export function poserBrouillon(key, val) {
  const b = G.brouillon;
  if (!b) return;
  if (key === 'format' || key === 'tirage') {
    // Le mode est le PRODUIT des deux : la clé se compose une seule fois, ici.
    const M = MODES[b.mode] || MODES.CLASSIQUE;
    b.mode = modeDe(key === 'format' ? val : M.format, key === 'tirage' ? val : M.tirage);
  } else if (key === 'ligue') b.epoque = val === 'UNE' ? b.epoqueChoisie : null;
  else if (key === 'repechage') {
    b.repechage = normRepechage(val);
    if (b.repechage === 'FRANCHISE' && !FRANCHISES[b.franchise]) b.franchise = ($('franchiseSelect') && $('franchiseSelect').value) || 'MTL';
  }
  else if (key === 'bonus') b.bonus = val === 'TABLE' ? 'TABLE' : 'SAISON';
  syncOptionsUI();
  majPiedPartie();
}

/**
 * Ce que le bouton du pied va faire : RIEN (rien n'est signé et rien n'a
 * changé — on referme), BONUS (le seul réglage qui ne touche pas au
 * repêchage : on garde l'alignement) ou DEMARRER.
 */
export function actionDuBouton(b) {
  const enPartie = !G.done && G.tirage.length > 0;
  const memeRepechage = b.mode === G.mode && b.epoque === G.epoque && b.repechage === G.repechage
    && (b.repechage !== 'FRANCHISE' || b.franchise === G.franchise);
  if (!enPartie || !memeRepechage) return 'DEMARRER';
  // Une partie encore vide qui n'a pas choisi son identité (S73) repart avec le
  // choix — même quand on ne bascule que le mode bonus : rien n'est perdu.
  if (!signes().length && G.identite === undefined) return 'DEMARRER';
  if (b.bonus !== G.bonus) return 'BONUS';
  return signes().length ? 'DEMARRER' : 'RIEN';
}

export function majPiedPartie() {
  const b = G.brouillon;
  if (!b) return;
  const M = MODES[b.mode] || MODES.CLASSIQUE;
  // Aucun chiffre recopié à la main : tout vient de MODES, casesDuMode et
  // REROLLS. Une constante recopiée est une constante qui ment tôt ou tard —
  // le dépôt en porte déjà la preuve dans deux `desc` de MODES.
  $('npResume').textContent = [
    `${casesDuMode(b.mode).length} cases`,
    M.loto ? `3 clubs par case · ${M.relances} relances`
      : `vestiaire complet · relances ${REROLLS.season}/${REROLLS.team}/${REROLLS.pass}`,
    b.epoque === HASARD ? 'ligue 🎲 au hasard' : b.epoque ? `ligue ${b.epoque}` : 'toutes les époques',
    b.repechage === 'FRANCHISE' && b.franchise === HASARD ? '🎲 une franchise au hasard'
      : b.repechage === 'FRANCHISE' && FRANCHISES[b.franchise] ? FRANCHISES[b.franchise].nom
      : b.epoque && b.repechage === 'TOUTES' ? 'repêchage toutes époques' : null,
    b.bonus === 'TABLE' ? 'sur table' : null,
  ].filter(Boolean).join(' · ');

  const n = signes().length;
  const enPartie = !G.done && G.tirage.length > 0;
  const rep = $('npReprise');
  rep.hidden = !(enPartie && n > 0);
  if (!rep.hidden) rep.textContent = `Une partie est en cours : ${n} joueur${n > 1 ? 's' : ''} signé${n > 1 ? 's' : ''}. Ferme cet écran (✕) pour y revenir.`;

  const act = actionDuBouton(b);
  const efface = act === 'DEMARRER' && enPartie && n > 0;
  $('npGoVerbe').textContent = efface ? 'Recommencer' : act === 'BONUS' ? 'Appliquer' : 'Commencer';
  // La note n'est JAMAIS vide : le bouton ne change pas de hauteur.
  $('npGoNote').textContent = efface ? `efface ${n} joueur${n > 1 ? 's' : ''}`
    : act === 'DEMARRER' ? (n === 0 && !G.done ? 'première roulette' : 'la roulette repart') : "rien n'est effacé";
  $('npGo').classList.toggle('efface', efface);
}

export function ouvrirNouvellePartie(bonus = null) {
  semerBrouillon();
  // Du menu (S77) : la carte « Sur table » ouvre l'écran déjà réglé sur table.
  if (bonus && G.brouillon) { G.brouillon.bonus = bonus; syncOptionsUI(); majPiedPartie(); }
  // Le titre dit le mode qu'on prépare.
  const t = $('npTitre');
  if (t && t.lastChild) t.lastChild.textContent = G.brouillon && G.brouillon.bonus === 'TABLE' ? 'Sur table' : 'Le 82-0';
  openModal('partieModal');
}

/*
 * LE CHOIX DE L'IDENTITÉ (S73), en plein écran et en cartes : trois
 * identités tirées au hasard, ou « Pas de préférence ». Il se prend AVANT la
 * première roulette, pour que le tout premier tour la porte déjà.
 */
export function choisirIdentite() {
  return new Promise(resolve => {
    ouvrirChoix({
      ico: '🧬', titre: 'Ton identité', cartes: true, genre: 'identite', fermable: true, motFermer: 'Pas de préférence',
      recit: 'Avant le premier tour, une carte qui colore tout ton repêchage : la roulette sortira plus souvent ce genre de joueurs — plus souvent, pas toujours. Touche celle que tu veux.',
      options: identitesOffertes().map(k => ({ cle: k, rarete: IDENTITES[k].rarete, ico: IDENTITES[k].ico, nom: IDENTITES[k].nom,
        type: 'Identité · tout le repêchage', texte: IDENTITES[k].texte })),
      onChoix: k => resolve(k),
      onFerme: () => resolve(null),
    });
  });
}

export function syncOptionsUI() {
  // Le BROUILLON gagne tant qu'il existe : l'écran montre ce qu'on est en
  // train de composer, pas la partie en cours. `G` porte les mêmes noms de
  // champs, donc une seule ligne suffit.
  const src = G.brouillon || G;
  const M = MODES[src.mode] || MODES.CLASSIQUE;
  const cur = {
    stats: G.statsProrata ? 'prorata' : 'real',
    salary: G.salaryMode,
    onlyFit: G.onlyFit ? 'on' : 'off',
    poolView: G.poolView,
    palette: G.palette,
    sons: G.sons ? 'on' : 'off',
    niveauTable: G.niveauTable,
    format: M.format,
    tirage: M.tirage,
    ligue: src.epoque ? 'UNE' : 'TOUTES',
    // Sans ligue fixée, « dans la saison » ne veut rien dire : le bouton allumé est « toutes les époques ».
    repechage: src.repechage === 'FRANCHISE' ? 'FRANCHISE' : src.epoque ? src.repechage : 'TOUTES',
    bonus: src.bonus,
  };
  // L'essai sur table ouvre le plateau : il n'a de sens que dans Sur table (le menu a sa propre exhibition, au vrai moteur).
  const ex = $('npExhibition');
  if (ex) ex.closest('.opt-row').hidden = src.bonus !== 'TABLE';
  const sel = $('epoqueSelect');
  if (sel) {
    if (!sel.options.length) {
      sel.innerHTML = `<option value="${HASARD}">🎲 Au hasard</option>` + state.index.seasons.slice().reverse().map(x => `<option value="${x}">${x}</option>`).join('');
      // Choisir dans la liste ne relance plus rien : ça garnit le brouillon.
      sel.onchange = () => {
        if (!G.brouillon) return;
        G.brouillon.epoqueChoisie = sel.value;
        G.brouillon.epoque = sel.value;
        majPiedPartie();
      };
    }
    sel.value = (G.brouillon ? G.brouillon.epoqueChoisie : G.epoque) || state.index.seasons[state.index.seasons.length - 1];
    // LA LISTE N'EXISTE QUE QUAND ELLE SERT (1.0, J2-2). Grisée, elle se
    // lisait comme un réglage de plus à comprendre ; cachée, elle sort aussi
    // de l'ordre de tabulation (`piegerFocus` filtre sur `offsetParent`), et
    // c'est voulu : on ne tabule pas vers un réglage qui ne vaut rien.
    sel.hidden = !src.epoque;
    sel.disabled = false;
  }
  const rep = $('repechageRow');
  if (rep) {
    rep.hidden = false;
    // « Dans la saison » demande une ligue fixée ; les deux autres valent toujours.
    rep.querySelectorAll('.seg button').forEach(x => { x.disabled = x.dataset.val === 'SAISON' && !src.epoque; });
  }
  const fsel = $('franchiseSelect');
  if (fsel) {
    if (!fsel.options.length) {
      fsel.innerHTML = `<option value="${HASARD}">🎲 Au hasard</option>` + Object.entries(FRANCHISES).sort((a, b) => a[1].nom.localeCompare(b[1].nom, 'fr'))
        .map(([k, F]) => `<option value="${k}">${esc(F.nom)}</option>`).join('');
      // Choisir une franchise, c'est choisir ce repêchage-là.
      fsel.onchange = () => {
        if (!G.brouillon) return;
        G.brouillon.franchise = fsel.value;
        G.brouillon.repechage = 'FRANCHISE';
        syncOptionsUI();
        majPiedPartie();
      };
    }
    fsel.value = (G.brouillon ? G.brouillon.franchise : G.franchise) || 'MTL';
    fsel.hidden = src.repechage !== 'FRANCHISE';
    fsel.disabled = false;
    const F = FRANCHISES[fsel.value];
    const lig = $('franchiseLignee');
    if (lig) lig.textContent = src.repechage !== 'FRANCHISE' ? '' : fsel.value === HASARD ? 'Le dé choisit la franchise au départ.' : F && F.lignee ? F.lignee : '';
  }
  document.querySelectorAll('.seg').forEach(seg => {
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.val === cur[seg.dataset.opt]);
    });
  });
}

