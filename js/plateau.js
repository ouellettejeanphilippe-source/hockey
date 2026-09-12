/**
 * LE PLATEAU — l'écran d'un match sur table.
 *
 * `js/table.js` est le moteur : il connaît les règles, les dés et l'IA. Ce
 * module-ci ne connaît que l'écran. Il dessine la glace, laisse choisir un
 * geste, montre le dé rouler, offre la relance d'équipe quand un jet échoue,
 * puis laisse l'adversaire jouer sa présence geste par geste.
 *
 * COMMENT ON JOUE, EN TROIS PHRASES. Tu touches une de tes pièces : la glace
 * s'allume — les cases où elle peut patiner, les coéquipiers à qui elle peut
 * passer, le porteur adverse qu'elle peut mettre en échec. Tu touches une
 * case allumée, le geste se joue. Un jet raté termine ta présence sec, et
 * c'est à l'autre.
 *
 * LE DÉ EST VISIBLE, TOUJOURS. Chaque bouton porte son seuil (« Tirer 5+ »)
 * et chaque jet montre le dé, le modificateur et le total. C'est la moitié du
 * plaisir d'un jeu de table : on sait ce qu'on risque avant de le risquer, et
 * on voit pourquoi ça a passé ou non.
 *
 * Le module est aveugle aux données du jeu, comme `js/saison.js` : `ctx`
 * porte les fonctions d'affichage de js/game.js (échappement, écussons,
 * bandeaux, portraits).
 */

import {
  COLS, RANGS, RANG_MIN, RANG_MAX, BUT_COL, SEUIL, SEUIL_TIR, PERIODES, PRESENCES_PAR_PERIODE,
  HABILETES, GABARITS, TIRS, nouveauMatch, surLaGlace, eqDe, adverse, porteur, libre, actives, peutJouer,
  deplacementsDe, receveursDe, ciblesEchecDe, ciblesVolDe, natureCase, dist, batons, chances,
  modTir, modPasse, modEchec, modEsquive, modVol, peutTirer, distanceAuFilet, PORTEE_TIR,
  deplacer, appliquerEsquive, passer, appliquerPasse, tirer, appliquerTir,
  mettreEnEchec, appliquerEchec, voler, appliquerVol,
  seMettreDevant, foncer, souffleDe, essouffle, pasDe, uniteDe, statsDeTable,
  relancer, finirPresence, iaPresence, iaGeste, GESTES_MAX, resultatDe, changerUnite, nomDe, reglesDuPlateau,
} from './table.js';
import { archetypeKey, ARCHETYPES } from './ratings.js';

const ordP = n => (n === 1 ? '1re' : `${n}e`);
const nomCourt = p => {
  const n = (p && p.n) || 'Rappel';
  const bouts = n.split(' ');
  return bouts.length > 1 ? bouts[bouts.length - 1] : n;
};

/* La pastille d'un geste : « 4+ », « 5+ », et ce que ça donne en pourcentage. */
const cote = (mod, seuil) => `${Math.max(2, Math.min(6, seuil - Math.max(-2, Math.min(2, mod))))}+`;
const pourcent = (mod, seuil) => `${Math.round(chances(mod, seuil) * 100)} %`;

/**
 * Ouvre un match sur table. `A` est TON équipe (elle attaque toujours vers le
 * haut) et `B` l'adversaire ; `onTermine(resultat)` reçoit la feuille à la
 * fin. Le tournoi s'en sert pour chacun de tes matchs.
 */
export function ouvrirTable({ A, B, graine, titre = '', sousTitre = '', ctx, onTermine }) {
  const modal = document.getElementById('tableModal');
  if (!modal) { onTermine(null); return; }
  const $ = s => modal.querySelector(s);
  const { esc, band, logo, vive } = ctx;

  const m = nouveauMatch(A, B, graine);
  let regles = false;      // le volet des règles, par-dessus tout
  let sel = null;          // la pièce choisie
  let cible = null;        // l'adversaire visé, quand deux gestes sont possibles
  let attente = null;      // un jet en attente : { jet, appliquer }
  let iaEnCours = false;
  /*
   * CE QUE L'ADVERSAIRE EST EN TRAIN DE FAIRE. `dernier` est le geste qu'on
   * REGARDE — sa pièce se cercle, sa cible clignote — et `deIA` le dé de ce
   * geste-là, montré en lecture seule. Les deux valent null dès que la main
   * revient. Sans eux, le plateau montrait l'état FINAL de la présence
   * adverse pendant que le fil racontait encore le premier geste : on lisait
   * l'histoire après en avoir vu la fin.
   */
  let dernier = null;      // { piece, cible } — le geste qu'on regarde
  let deGlace = null;      // { jet, cote, r, c } — le dé, POSÉ SUR LA CASE du geste
  let flash = null;        // { r, c, texte, ton } — le verdict, là où il tombe
  let eclat = null;        // la bannière d'un but : { eq, texte }
  let minuteurFlash = 0;
  let noJet = 0;          // un dé neuf est un ÉLÉMENT neuf : sinon l'animation ne repart pas

  /*
   * LA COULEUR VIVE CERNE LA PIÈCE. Le bandeau d'un club dont la primaire est
   * le noir RESTE noir (le blanc s'y lit à 21:1, `getTeamBand` n'a rien à
   * corriger) — mais sur une glace au charbon, une pièce noire disparaît, et
   * les NHL Stars sont noir, blanc, orange. `couleurVive` donne la première
   * couleur brute du club qui se détache du fond : c'est déjà ce qui cerne
   * une carte du bassin et une case de l'alignement, et c'est ce qui cerne
   * une pièce ici. On ne délave jamais une couleur d'équipe : on la cerne.
   */
  const bA = band(A.tag), bB = band(B.tag);
  const vA = vive(A.tag), vB = vive(B.tag);
  modal.style.setProperty('--t-a', bA.bg);
  modal.style.setProperty('--t-a-ink', bA.ink);
  modal.style.setProperty('--t-b', bB.bg);
  modal.style.setProperty('--t-b-ink', bB.ink);

  /*
   * TANT QUE LA PRÉSENCE ADVERSE SE DÉROULE À L'ÉCRAN, LA MAIN N'EST PAS À
   * TOI. Le moteur a déjà tout joué quand l'animation commence — `m.tour`
   * dit donc « A » alors que le fil est encore en train de raconter ce que
   * l'autre vient de faire. Sans ce garde, on pouvait toucher une pièce au
   * milieu du récit et jouer par-dessus.
   */
  const aMoi = () => m.tour === 'A' && !m.fini && !iaEnCours;

  /* ---------- le tableau indicateur ---------- */
  function tete() {
    const restant = (PRESENCES_PAR_PERIODE * 2 - m.presence + 1);
    const periode = m.prolongation ? `Prolongation ${m.prolongation > 1 ? m.prolongation : ''}`.trim()
      : `${ordP(m.periode)} période`;
    return `
      <div class="tb-score">
        <div class="tb-eq tb-a"><span class="tb-logo">${logo(A.tag, 22)}</span><span class="tb-nom">${esc(A.nom)}</span><b>${A.buts}</b></div>
        <div class="tb-milieu">
          <span class="tb-periode">${esc(periode)}</span>
          <span class="tb-presence">${m.fini ? 'Terminé' : `${restant} présence${restant > 1 ? 's' : ''} à jouer`}</span>
        </div>
        <div class="tb-eq tb-b"><b>${B.buts}</b><span class="tb-nom">${esc(B.nom)}</span><span class="tb-logo">${logo(B.tag, 22)}</span></div>
      </div>
      <div class="tb-etat">
        <span class="tb-tour ${aMoi() ? 'mien' : ''}">${m.fini ? 'Match terminé' : aMoi() ? 'À toi de jouer' : `Présence de ${esc(B.nom)}`}</span>
        <span class="tb-relance ${A.relance ? 'on' : ''}" title="Une relance d'équipe par période : on la dépense après avoir vu le dé.">🎲 Relance ${A.relance ? 'disponible' : 'dépensée'}</span>
      </div>`;
  }

  /* ---------- la glace ---------- */

  /* Ce qu'une case propose à la pièce choisie : rien, patiner, passer, échec. */
  function offre(r, c) {
    if (!sel || !aMoi() || attente) return null;
    const piece = surLaGlace(m).find(x => x.r === r && x.c === c);
    if (piece) {
      if (piece.eq === 'A' && piece !== sel && !piece.etourdi && porteur(m) === sel && !sel.agi) {
        return { type: 'passe', cible: piece, mod: modPasse(m, sel, piece) + bonus('VOILEE'), seuil: SEUIL };
      }
      // LE CONTACT VISE N'IMPORTE QUEL ADVERSAIRE ADJACENT, pas seulement le
      // porteur : frapper l'ailier devant son filet ouvre une voie. Sur le
      // porteur, deux gestes sont possibles (l'épaule ou le bâton) et c'est
      // la carte qui fait choisir ; sur les autres, un seul, donc une touche.
      if (piece.eq === 'B' && !piece.gardien && !piece.etourdi && dist(sel, piece) === 1 && !sel.agi) {
        const porte = porteur(m) === piece;
        return porte
          ? { type: 'duel', cible: piece, mod: modEchec(m, sel, piece) + bonus('ACTIF') + bonus('EPAULE'), seuil: SEUIL }
          : { type: 'echec', cible: piece, mod: modEchec(m, sel, piece) + bonus('ACTIF') + bonus('EPAULE'), seuil: SEUIL };
      }
      return null;
    }
    if (sel.deplace) return null;
    const v = deplacementsDe(m, sel).find(x => x.r === r && x.c === c);
    if (!v) return null;
    const tenue = porteur(m) === sel && batons(m, 'A', sel.r, sel.c) > 0;
    return { type: 'deplacer', vers: v, mod: tenue ? modEsquive(m, sel, v) + bonus('PATIN') : null, seuil: SEUIL };
  }

  const bonus = h => (sel && sel.hab === h && sel.habDispo ? 2 : 0);

  /*
   * « JOUABLE » VEUT DIRE « A ENCORE QUELQUE CHOSE À FAIRE ».
   *
   * Le moteur dit qu'une pièce peut jouer tant qu'il lui reste un déplacement
   * OU un geste. L'écran, lui, doit dire autre chose : une pièce qui a patiné
   * et qui ne porte pas la rondelle n'a plus AUCUNE option, et elle restait
   * pourtant choisie, cerclée d'or, devant une glace éteinte. On ne savait
   * plus quoi toucher, et le match ne bougeait plus. Une pièce sans option
   * n'est donc plus jouable : elle se désélectionne, et son cerclage s'éteint.
   */
  function aDesOptions(piece) {
    if (!peutJouer(piece) || m.tour !== piece.eq) return false;
    const p = porteur(m), l = libre(m);
    if (!piece.agi) {
      if (p === piece) return true;                                     // tirer, passer
      if (ciblesEchecDe(m, piece).length) return true;                  // frapper, voler
      if (piece.deplace) return true;                                   // foncer
      if (!piece.ecran && p !== piece) return true;                     // se placer devant
    }
    if (!piece.deplace && deplacementsDe(m, piece).length) return true;
    return false;
  }

  /* ======================================================================
     LA GLACE : bâtie une fois, mise à jour ensuite
     ======================================================================
     JP : *meilleure animation et clarté de ce qui arrive, autant tour CPU
     que user*.

     Le plateau se réécrivait en entier (`innerHTML`) à chaque rendu, donc
     chaque pièce était un élément NEUF : impossible de l'animer, et tout se
     téléportait. La grille est maintenant construite une seule fois, et les
     pièces vivent dans une couche par-dessus, une par case du plateau,
     repérées par leur équipe et leur rôle. Bouger une pièce, c'est changer
     deux variables CSS — le navigateur fait glisser le reste.

     La clé est l'équipe et le RÔLE, pas l'objet : `changerUnite` remplace les
     cinq objets d'un coup, et on veut voir le nouvel ailier entrer en
     glissant depuis le banc, pas apparaître d'un claquement de doigts.
     ====================================================================== */

  let grilleFaite = false;

  function batirGlace() {
    let html = '<div class="t-glace" role="grid" aria-label="La patinoire">';
    for (let r = 0; r < RANGS; r++) {
      for (let c = 0; c < COLS; c++) {
        const nature = natureCase(r, c, 0);
        const filet = r === 0 || r === RANGS - 1;
        const cls = ['t-case', `t-${nature}`];
        if (filet) cls.push('t-but');
        if (r === 4) cls.push('t-centre');
        if (r === 3 || r === 5) cls.push('t-bleue');
        html += `<button type="button" class="${cls.join(' ')}" data-r="${r}" data-c="${c}"><span class="t-marque"></span></button>`;
      }
    }
    html += '<div class="t-pieces" aria-hidden="true"></div>';
    html += '<div class="t-rondelle-libre-jeton" hidden></div>';
    // Le dé et le verdict vivent SUR la glace, posés sur la case du geste.
    html += '<div class="t-de-glace" role="status" hidden></div>';
    html += '<div class="t-flash" role="status" aria-live="polite" hidden></div>';
    html += '</div>';
    $('.t-plateau').innerHTML = html;
    grilleFaite = true;
  }

  /* Toutes les pièces à dessiner, gardiens compris, avec leur clé stable. */
  const jetons = () => [
    ...surLaGlace(m).map(x => [`${x.eq}-${x.role}`, x]),
    ['A-G', A.piece_g], ['B-G', B.piece_g],
  ];

  function majGlace() {
    if (!grilleFaite) batirGlace();
    const l = libre(m), p = porteur(m);
    const grille = $('.t-glace');

    // 1. Les cases : ce qu'elles PROPOSENT à la pièce choisie.
    for (const cel of grille.querySelectorAll('.t-case')) {
      const r = +cel.dataset.r, c = +cel.dataset.c;
      const filet = r === 0 || r === RANGS - 1;
      const o = filet ? null : offre(r, c);
      const piece = surLaGlace(m).find(x => x.r === r && x.c === c);
      const jouable = piece && piece.eq === 'A' && aMoi() && !attente && aDesOptions(piece);
      cel.classList.toggle('t-offre', !!o);
      for (const t of ['deplacer', 'passe', 'echec']) {
        cel.classList.toggle(`t-offre-${t}`, !!o && (o.type === t || (t === 'echec' && o.type === 'duel')));
      }
      cel.classList.toggle('t-jouable', !!jouable);
      cel.classList.toggle('t-sel', !!piece && piece === sel);
      cel.tabIndex = (o || jouable) ? 0 : -1;
      // L'étiquette : la cote du geste que cette case propose.
      const marque = cel.querySelector('.t-marque');
      marque.textContent = !o ? ''
        : o.type === 'deplacer' ? (o.mod === null ? '' : cote(o.mod, SEUIL))
        : cote(o.mod, o.seuil);
      marque.className = `t-marque${o && o.type !== 'deplacer' ? ' t-cote' : o ? ' t-pas' : ''}`;
    }

    // 2. La rondelle libre, posée sur sa case.
    const jeton = grille.querySelector('.t-rondelle-libre-jeton');
    jeton.hidden = !l;
    if (l) { jeton.style.setProperty('--tr', l.r); jeton.style.setProperty('--tc', l.c); }

    // 3. Les pièces : on DÉPLACE les éléments, on ne les recrée pas.
    const couche = grille.querySelector('.t-pieces');
    const vues = new Set();
    for (const [cle, x] of jetons()) {
      vues.add(cle);
      let el = couche.querySelector(`[data-jeton="${cle}"]`);
      if (!el) {
        el = document.createElement('div');
        el.dataset.jeton = cle;
        el.className = 't-jeton';
        couche.appendChild(el);
      }
      const b = x.eq === 'A' ? bA : bB;
      el.style.setProperty('--tr', x.r);
      el.style.setProperty('--tc', x.c);
      el.style.setProperty('--pf', b.bg);
      el.style.setProperty('--pi', b.ink);
      el.style.setProperty('--pl', x.eq === 'A' ? vA : vB);
      const jouableIci = x.eq === 'A' && !x.gardien && aMoi() && !attente && aDesOptions(x);
      el.className = `t-jeton t-piece ${x.eq === 'A' ? 'mienne' : 'sienne'}`
        + (x.gardien ? ' gardien' : '') + (x.etourdi ? ' etourdi' : '')
        + (jouableIci ? ' jouable' : '')
        + (x === sel ? ' choisie' : '')
        + (dernier && dernier.piece === x ? ' agit' : '')
        + (dernier && dernier.cible === x ? ' visee' : '');
      const nom = esc(nomCourt(x.p));
      const role = x.gardien ? 'G' : esc(x.role);
      const rond = p === x ? '<span class="t-rondelle" aria-label="a la rondelle"></span>' : '';
      const air = !x.gardien && essouffle(m, x) ? '<span class="t-vide-air" title="Essoufflé">😮‍💨</span>' : '';
      const ecr = x.ecran ? '<span class="t-ecran" title="Il se place devant les tirs">🛡️</span>' : '';
      const dedans = `<span class="t-role">${role}</span><span class="t-nom">${nom}</span>${rond}${air}${ecr}`;
      if (el.dataset.contenu !== dedans) { el.innerHTML = dedans; el.dataset.contenu = dedans; }
    }
    for (const el of couche.querySelectorAll('[data-jeton]')) {
      if (!vues.has(el.dataset.jeton)) el.remove();
    }

    // 4. Le dé, posé sur la case du geste, et le verdict qui suit.
    poserSurGlace(grille.querySelector('.t-de-glace'), deGlace, deGlaceHtml);
    poserSurGlace(grille.querySelector('.t-flash'), flash, flashHtml);
  }

  /* ======================================================================
     LE DÉ SE JETTE SUR LA GLACE, LÀ OÙ LE GESTE SE JOUE.

     JP : *je veux voir les dés et résultats sur la glace genre, animation*.
     Le dé vivait sous le plateau, dans une boîte de texte : on tirait au
     filet et on baissait les yeux pour savoir si ça rentrait. Il est
     maintenant POSÉ SUR LA CASE de la pièce qui agit — il tombe, il roule
     (six faces qui défilent), il s'arrête sur son chiffre — et le verdict
     du moteur (BUT !, ARRÊT, REVIREMENT, VOLÉE !) éclate sur la case où la
     chose est arrivée : le filet pour un tir, la victime pour un contact.

     Trois précautions. Le dé se pose AU-DESSUS de sa case, sauf en haut de
     la glace où il se pose dessous (`dessous`) : sinon il sort du plateau.
     Il n'intercepte aucun clic (`pointer-events: none`) — la case dessous
     reste jouable. Et il porte une clé (`data-cle`) : sans elle, deux jets
     de suite réutilisaient le même élément et l'animation ne repartait pas,
     donc le deuxième dé apparaissait déjà arrêté.
     ====================================================================== */

  /* Poser une chose sur une case, ou la cacher. `html(x)` en fait le contenu. */
  function poserSurGlace(el, x, html) {
    if (!el) return;
    el.hidden = !x;
    if (!x) { el.dataset.cle = ''; el.innerHTML = ''; return; }
    el.style.setProperty('--tr', x.r);
    el.style.setProperty('--tc', x.c);
    /*
     * ON NE SORT JAMAIS DE LA GLACE. Une boîte centrée sur la case déborde du
     * plateau dès la première ou la dernière colonne, et la rangée du haut
     * n'a rien au-dessus d'elle : trois ancrages au lieu d'un, choisis par la
     * case. Mesuré avant : le dé partait à −14 px, donc coupé.
     */
    el.classList.toggle('dessous', x.r <= 1);
    el.classList.toggle('bord-g', x.c <= 1);
    el.classList.toggle('bord-d', x.c >= COLS - 2);
    const cle = html(x, true);
    if (el.dataset.cle !== cle) { el.dataset.cle = cle; el.innerHTML = html(x); }
  }

  const signe = n => (n >= 0 ? `+${n}` : `−${-n}`);

  /*
   * LES SIX FACES DÉFILENT, PUIS LE DÉ S'ARRÊTE. Le tambour est un ruban de
   * six chiffres qu'une animation CSS fait passer derrière une fenêtre de la
   * taille d'un chiffre ; il se fige sur la face tirée. Aucune minuterie en
   * JavaScript : l'animation part toute seule quand l'élément est écrit, et
   * `prefers-reduced-motion` la coupe sans rien casser — le bon chiffre est
   * déjà à la bonne place.
   */
  function deGlaceHtml(d, cleSeule) {
    const j = d.jet;
    if (cleSeule) return `${d.n}`;
    // Le tambour porte TROIS fois les six faces : l'animation le fait défiler
    // du premier bloc jusqu'à la bonne face du troisième, donc douze à
    // dix-sept chiffres passent avant qu'il s'arrête. Avec un seul bloc, il
    // n'y aurait rien à faire défiler.
    const faces = [0, 1, 2].map(() => [1, 2, 3, 4, 5, 6].map(n => `<b>${n}</b>`).join('')).join('');
    return `
      <span class="t-dg ${j.reussi ? 'ok' : 'rate'} ${d.cote === 'A' ? 'mien' : 'sien'}">
        <span class="t-dg-fenetre"><span class="t-dg-tambour" style="--face:${j.de - 1}">${faces}</span></span>
        <span class="t-dg-calcul">${signe(j.mod)} = <b>${j.total}</b><i>sur ${j.seuil}+</i></span>
        <span class="t-dg-mot">${esc(MOT_JET[j.quoi] || 'Jet')}${j.relance ? ' · relance' : ''}</span>
      </span>`;
  }

  const flashHtml = (f, cleSeule) =>
    (cleSeule ? `${f.n}` : `<span class="t-flash-mot t-flash-${f.ton}">${esc(f.texte)}</span>`);

  /*
   * LE VERDICT VIENT DU MOTEUR, JAMAIS D'UNE SUPPOSITION. Après un geste, on
   * relit ce que le moteur vient d'écrire au fil et on garde le premier genre
   * qui a un mot — du plus ancien au plus neuf, sinon un but suivi de sa mise
   * au jeu s'annoncerait « mise au jeu ». Si le moteur n'a rien dit de
   * notable, il n'y a pas de verdict : on n'invente pas d'événement.
   */
  const VERDICTS = {
    but:        ['BUT !', 'or', 'filet'],
    retour:     ['RETOUR !', 'chaud', 'filet'],
    arret:      ['ARRÊT', 'froid', 'filet'],
    vol:        ['VOLÉE !', 'chaud', 'cible'],
    echec:      ['ÉCHEC !', 'chaud', 'cible'],
    rate:       ['MANQUÉ', 'rouge', 'cible'],
    revirement: ['REVIREMENT', 'rouge', 'defaut'],
  };

  function verdict(avant, ou) {
    const neufs = m.fil.slice(0, Math.max(0, m.fil.length - avant)).reverse();
    flash = null;
    for (const e of neufs) {
      const v = VERDICTS[e.genre];
      if (!v) continue;
      const place = ou[v[2]] || ou.defaut;
      if (!place) break;
      flash = { r: place.r, c: place.c, texte: v[0], ton: v[1], n: ++noJet };
      break;
    }
    clearTimeout(minuteurFlash);
    if (flash) minuteurFlash = setTimeout(() => { flash = null; if (!regles) majGlace(); }, 1200);
  }

  /* Les trois endroits où un verdict peut tomber, pour un geste donné. */
  const placesDe = (piece, cible) => ({
    defaut: piece ? { r: piece.r, c: piece.c } : null,
    cible: cible ? { r: cible.r, c: cible.c } : (piece ? { r: piece.r, c: piece.c } : null),
    filet: piece ? { r: eqDe(m, piece.eq).but, c: BUT_COL } : null,
  });

  /*
   * LA CARTE DE LA PIÈCE CHOISIE. JP : *archétype clair dans la carte de
   * sélection*. Elle portait le poste, le nom, quatre nombres et l'habileté —
   * et l'habileté vient justement de l'archétype, qu'on ne voyait nulle part.
   * Quatre choses la nomment maintenant, chacune sur sa ligne, et chacune
   * change la façon de la jouer :
   *
   *   l'ARCHÉTYPE  ce qu'il a fait cette saison-là (ratings.js le mesure)
   *   le GABARIT   petit et rapide, moyen, ou matador — ses bonus
   *   le TIR       sa signature, et le contexte où elle vaut mieux
   *   le SOUFFLE   combien de présences il tient encore
   */
  function carte() {
    if (m.fini) return '';
    if (!aMoi()) return '<div class="t-carte t-attente">L\'adversaire joue sa présence…</div>';
    if (!sel) {
      const dispo = eqDe(m, 'A').pieces.filter(aDesOptions).length;
      return dispo
        ? `<div class="t-carte t-vide">Touche une de tes pièces. ${dispo} peu${dispo > 1 ? 'vent' : 't'} encore jouer.</div>`
        : '<div class="t-carte t-vide">Plus rien à jouer cette présence-ci.</div>';
    }
    const st = sel.st, h = sel.hab ? HABILETES[sel.hab] : null;
    const arc = ARCHETYPES[archetypeKey(sel.p)] || ARCHETYPES.UNKNOWN;
    const gab = GABARITS[st.gb], tir = TIRS[st.ts] || TIRS.P;
    const aLaRondelle = porteur(m) === sel;
    const so = souffleDe(m, sel), soMax = st.SO;
    const gestes = [];

    if (aLaRondelle && !sel.agi && peutTirer(m, sel)) {
      const mod = modTir(m, sel) + bonus('DECOCHE');
      gestes.push(bouton('tir', 'Tirer', mod, SEUIL_TIR, 't-tir'));
    }
    // FONCER : dépenser son geste pour un deuxième élan. Sans dé.
    if (sel.deplace && !sel.agi) {
      gestes.push(`<button type="button" class="t-geste" data-geste="foncer" title="Il repatine : jusqu'à ${pasDe(m, sel)} cases de plus, mais il ne fera rien d'autre.">⚡ Foncer <i>+${pasDe(m, sel)} cases</i></button>`);
    }
    // SE PLACER DEVANT : la posture défensive. Sans dé non plus.
    if (!sel.agi && !aLaRondelle && !sel.ecran) {
      gestes.push('<button type="button" class="t-geste" data-geste="ecran" title="Jusqu\'à ta prochaine présence, il gêne double les tirs pris à côté de lui.">🛡️ Se placer devant</button>');
    }
    // LE DUEL : sur le porteur adverse, l'épaule ou le bâton.
    if (cible && !sel.agi && dist(sel, cible) === 1) {
      gestes.push(bouton('echec', `Épaule sur ${nomCourt(cible.p)}`, modEchec(m, sel, cible) + bonus('ACTIF') + bonus('EPAULE'), SEUIL, 't-echec'));
      if (porteur(m) === cible) {
        gestes.push(bouton('vol', 'Bâton (voler)', modVol(m, sel, cible) + bonus('ACTIF'), SEUIL, 't-vol'));
      }
    }

    const horsPortee = aLaRondelle && !peutTirer(m, sel);
    const aide = cible ? `Choisis l'épaule ou le bâton sur ${esc(nomCourt(cible.p))}.`
      : horsPortee ? `Trop loin pour tirer : il faut entrer dans la zone offensive, à ${PORTEE_TIR} cases du filet ou moins. Il en est à ${distanceAuFilet(m, sel)}.`
      : aLaRondelle ? 'Touche une case allumée pour patiner, un coéquipier pour lui passer, un adversaire pour le frapper.'
      : 'Touche une case allumée pour patiner, un adversaire adjacent pour le frapper.';

    return `
      <div class="t-carte">
        <div class="t-fiche">
          <span class="t-fiche-role">${esc(sel.role)}</span>
          <span class="t-fiche-nom">${esc((sel.p && sel.p.n) || 'Rappel')}</span>
          <span class="t-axes">
            ${['PA', 'MA', 'TI', 'FO'].map(k => `<span class="t-axe" title="${esc(AXE_MOT[k])}"><i>${k}</i><b>${st[k]}</b></span>`).join('')}
            <span class="t-axe t-axe-so ${so <= 0 ? 'vide' : ''}" title="Souffle : ${so} présence${so > 1 ? 's' : ''} avant d'être vidé. À zéro, un de moins à tous ses jets et un pas de patin en moins — il faut changer de trio."><i>SO</i><b>${so}</b></span>
          </span>
        </div>
        <div class="t-tags">
          <span class="t-tag" title="${esc(arc.desc)} — ce qu'il a fait cette saison-là, mesuré dans ses colonnes.">${arc.icon} ${esc(arc.short)}</span>
          <span class="t-tag" title="${esc(gab.desc)}">${gab.icon} ${esc(gab.nom)}</span>
          <span class="t-tag" title="${esc(tir.desc)}">${tir.icon} ${esc(tir.nom)}</span>
          ${h ? `<span class="t-tag ${sel.habDispo ? 'on' : 'usee'}" title="${esc(h.desc)}">${h.icon} ${esc(h.nom)}${sel.habDispo ? ' +2' : ' · utilisée'}</span>` : ''}
          ${so <= 0 ? '<span class="t-tag alerte" title="Il n\'a plus de souffle : change de trio au début de ta prochaine présence.">😮‍💨 Essoufflé</span>' : ''}
        </div>
        <div class="t-gestes">${gestes.join('')}</div>
        <p class="t-aide">${esc(aide)}</p>
      </div>`;
  }

  /* Un bouton de geste : son nom, son seuil et ses chances, comme partout. */
  const bouton = (geste, nom, mod, seuil, cls = '') =>
    `<button type="button" class="t-geste ${cls}" data-geste="${geste}">${esc(nom)} <b>${cote(mod, seuil)}</b><i>${pourcent(mod, seuil)}</i></button>`;

  const AXE_MOT = {
    PA: 'Patin : de combien de cases il bouge',
    MA: 'Maniement : passer, esquiver, protéger la rondelle',
    TI: 'Tir : faire entrer la rondelle',
    FO: 'Force : enlever la rondelle, et la garder',
  };

  /* ---------- le dé ---------- */

  const MOT_JET = { tir: 'Tir', passe: 'Passe', echec: 'Mise en échec', esquive: 'Esquive', vol: 'Vol de rondelle' };

  /*
   * SOUS LE PLATEAU IL NE RESTE QUE LA DÉCISION. Les chiffres sont sur la
   * glace (voir `deGlaceHtml`) ; ici on ne garde que ce qui demande un clic —
   * dépenser la relance d'équipe, ou accepter. Les répéter aux deux endroits
   * ferait lire deux fois la même chose, et le regard resterait en bas.
   */
  function de() {
    if (!attente) return '';
    const j = attente.jet;
    const peutRelancer = !j.reussi && !j.relance && A.relance && attente.cote === 'A';
    return `
      <div class="t-de ${j.reussi ? 'ok' : 'rate'}">
        <span class="t-de-verdict">${esc(MOT_JET[j.quoi] || 'Jet')} · ${j.reussi ? 'réussi' : 'raté'}</span>
        <span class="t-de-boutons">
          ${peutRelancer ? '<button type="button" class="t-relancer">🎲 Relance d\'équipe</button>' : ''}
          <button type="button" class="t-suite t-evident">${peutRelancer ? 'Accepter' : 'Continuer'}</button>
        </span>
      </div>`;
  }

  /* ---------- le changement de trio ---------- */

  /*
   * LE CHANGEMENT DE TRIO SE FAIT AU BANC, avant que la présence commence.
   * C'était réservé aux mises au jeu — donc on ne changeait qu'après un but,
   * et le souffle devenait un impôt qu'on ne pouvait pas payer. Maintenant :
   * tant qu'aucune de tes pièces n'a bougé ce tour-ci, tu peux changer. Le
   * prix est le même que dans la vraie vie — tes cinq rentrent de TON bout de
   * glace, donc tu donnes ta position pour des jambes fraîches.
   */
  const peutChanger = () => aMoi() && !attente && eqDe(m, 'A').pieces.every(x => !x.agi && !x.deplace);

  function unites() {
    if (!peutChanger()) return '';
    const eq = eqDe(m, 'A');
    /*
     * CHAQUE UNITÉ MONTRE SON SOUFFLE, sinon le changement est un choix
     * aveugle : on ne saurait pas laquelle est reposée, et la fatigue ne
     * serait qu'une punition. Le nombre est la moyenne de l'unité.
     */
    const souffleUnite = joueurs => {
      const vals = joueurs.filter(Boolean).map(p => eq.souffle.get(p) ?? statsDeTable(p).SO);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 3;
    };
    const trio = i => uniteDe(eq.roster, i, 0).slice(0, 3).map(x => x.p);
    const paire = i => uniteDe(eq.roster, 0, i).slice(3).map(x => x.p);
    const seg = (quoi, n, mot, courant, joueursDe) => `<span class="t-seg" data-u="${quoi}">${
      [...Array(n).keys()].map(i => {
        const so = souffleUnite(joueursDe(i));
        return `<button type="button" data-v="${i}" class="${courant === i ? 'on' : ''} ${so <= 0 ? 'vide' : ''}"
          title="Souffle moyen de l'unité : ${so}">${i + 1}<sup>${i ? 'e' : mot === 'trio' ? 'er' : 're'}</sup> ${mot}<em>${'●'.repeat(Math.min(4, Math.max(0, so)))}${'○'.repeat(Math.max(0, 4 - so))}</em></button>`;
      }).join('')}</span>`;
    return `
      <div class="t-unites">
        <span class="t-unites-t">Qui saute ?</span>
        ${seg('tri', 4, 'trio', A.tri, trio)}
        ${seg('pai', 3, 'paire', A.pai, paire)}
      </div>`;
  }

  /*
   * LES RÈGLES, LISIBLES PENDANT QU'ON JOUE. Un jeu de table dont il faut
   * sortir pour lire les règles n'est pas un jeu de table. Le volet se pose
   * par-dessus le plateau, et son contenu vient de `reglesDuPlateau()` —
   * la même source que la page des règles du jeu, avec les constantes lues
   * en direct, donc jamais en retard sur le code.
   */
  const reglesHtml = () => `
    <div class="t-regles">
      <div class="t-regles-tete">
        <h3>Les règles du plateau</h3>
        <button type="button" class="t-regles-fermer">Retour au match</button>
      </div>
      ${reglesDuPlateau().map(sec => `
        <section>
          <h4>${esc(sec.titre)}</h4>
          ${sec.points ? `<ul>${sec.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          ${sec.rangees ? `<div class="tbl-wrap"><table class="tbl">
            <thead><tr>${sec.colonnes.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
            <tbody>${sec.rangees.map(r => `<tr>${r.map((v, i) => `<td${i === 0 ? ' class="t-regle-nom"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table></div>` : ''}
        </section>`).join('')}
    </div>`;

  /* ---------- le fil ---------- */
  const fil = () => `<div class="t-fil">${m.fil.slice(0, 7).map(e =>
    `<div class="t-evt t-evt-${e.genre}">${esc(e.texte)}</div>`).join('')}</div>`;

  /* ---------- le rendu ---------- */
  function rendre() {
    // Le volet des règles couvre le match ; le plateau se CACHE, il ne se
    // vide pas — la grille est bâtie une fois et les pièces glissent dessus.
    $('.t-tete').hidden = regles;
    $('.t-plateau').hidden = regles;
    if (regles) { $('.t-bas').innerHTML = reglesHtml(); return; }
    veillerButs();
    $('.t-tete').innerHTML = tete() + banniere();
    if (!grilleFaite) batirGlace();
    majGlace();
    $('.t-bas').innerHTML = unites() + de() + carte() + boutons() + fil();
  }

  /* La bannière d'un but : elle passe une seconde sur le tableau indicateur. */
  const banniere = () => (eclat
    ? `<div class="t-eclat t-eclat-${eclat.eq}">BUT ! <span>${esc(eclat.texte)}</span></div>` : '');

  function boutons() {
    if (m.fini) return '<div class="t-actions"><button type="button" class="t-resultat t-evident">Voir le résultat</button></div>';
    if (!aMoi() || attente) return '<div class="t-actions"></div>';
    const reste = eqDe(m, 'A').pieces.filter(aDesOptions).length;
    return `<div class="t-actions">
      ${sel && reste > 1 ? '<button type="button" class="t-deselect">Choisir une autre pièce</button>' : ''}
      <button type="button" class="t-passer ${reste ? '' : 't-evident'}">Finir ma présence</button>
    </div>`;
  }

  /* ---------- jouer un geste ---------- */

  /*
   * Un jet part : le dé tombe SUR LA CASE du geste, et la suite attend que le
   * joueur confirme. `ou` est l'endroit du geste, capturé MAINTENANT — après
   * l'application, la pièce a bougé, la rondelle a changé de camp, et on ne
   * saurait plus où poser le verdict.
   */
  function lancer(jet, cote, appliquer, ou) {
    attente = { jet, cote, appliquer, ou };
    deGlace = { jet, cote, r: ou.defaut.r, c: ou.defaut.c, n: ++noJet };
    flash = null;
    rendre();
  }

  function resoudre() {
    if (!attente) return;
    const { jet, appliquer, ou } = attente;
    attente = null;
    cible = null;
    deGlace = null;
    const avant = m.fil.length;
    appliquer(jet);
    verdict(avant, ou);
    apres();
  }

  /*
   * LA PIÈCE CHOISIE SE GÈRE TOUTE SEULE. Deux gestes d'interface qui
   * valaient dix clics : une pièce qui n'a plus ni déplacement ni geste se
   * DÉSÉLECTIONNE (sinon on reste devant une carte sans options, à chercher
   * le bouton « choisir une autre pièce »), et au début de ta présence c'est
   * le PORTEUR qui s'offre en premier — c'est lui qui a la décision, et
   * c'est ce qu'on venait faire.
   */
  function choisirSeul() {
    if (!aMoi()) { sel = null; return; }
    if (sel && !aDesOptions(sel)) sel = null;
    if (!sel) {
      const p = porteur(m);
      if (p && p.eq === 'A' && !p.gardien && aDesOptions(p)) sel = p;
    }
  }

  /* Après chaque geste : si la présence a changé de camp, l'adversaire joue. */
  function apres() {
    choisirSeul();
    rendre();
    if (!m.fini && m.tour === 'B' && !iaEnCours) tourAdverse();
  }

  function agir(o) {
    if (o.type === 'duel') { cible = o.cible; rendre(); return; }
    if (o.type === 'deplacer') {
      const piece = sel, vers = o.vers, ou = placesDe(piece, null), avant = m.fil.length;
      const d = deplacer(m, piece, vers);
      // Patiner d'une case libre ne demande pas de dé : le geste est déjà
      // joué, il ne reste qu'à dire ce que le moteur en a fait.
      if (!d.jet) { verdict(avant, ou); apres(); return; }
      lancer(d.jet, 'A', j => appliquerEsquive(m, piece, vers, j), ou);
      return;
    }
    if (o.type === 'passe') {
      const piece = sel, cible = o.cible;
      lancer(passer(m, piece, cible), 'A', j => appliquerPasse(m, piece, cible, j), placesDe(piece, cible));
      return;
    }
    if (o.type === 'echec') {
      const piece = sel, cible = o.cible;
      lancer(mettreEnEchec(m, piece, cible), 'A', j => appliquerEchec(m, piece, cible, j), placesDe(piece, cible));
    }
  }

  /* Un geste SANS dé (se placer devant, foncer) a droit à son verdict aussi. */
  function sansDe(piece, faire) {
    const ou = placesDe(piece, null), avant = m.fil.length;
    faire();
    verdict(avant, ou);
  }

  /* ---------- la présence de l'adversaire, geste par geste ---------- */

  /*
   * L'ADVERSAIRE JOUE DEVANT TOI, PAS AVANT TOI. La première version
   * demandait au moteur la présence ENTIÈRE (`iaPresence`), puis rejouait le
   * fil au rythme de la lecture — donc le plateau montrait déjà l'état final
   * pendant qu'on lisait le premier geste. Maintenant `iaGeste` ne joue QU'UN
   * geste : on le montre (la pièce se cercle, sa cible clignote, son dé
   * s'affiche), on attend, puis on demande le suivant. Ce qui est joué ne
   * change pas d'un iota — c'est le même moteur, la même graine, le même
   * ordre. Seul le moment où on le regarde change.
   */
  const PAUSE_DE = 780;     // un geste avec un dé : on lit le jet
  const PAUSE_SEC = 520;    // un geste sans dé : écran, foncer

  function tourAdverse() {
    iaEnCours = true;
    sel = null; cible = null;
    const cote = m.tour;
    let garde = 0;

    const fin = () => {
      // Le garde-fou doit quand même rendre la main : sans ça, une présence
      // qui tourne en rond gèlerait le match sur le tour de l'adversaire.
      if (!m.fini && m.tour === cote) finirPresence(m);
      dernier = null; deGlace = null;
      iaEnCours = false;
      choisirSeul();
      rendre();
      if (!m.fini && m.tour === 'B') tourAdverse();
    };

    const pas = () => {
      if (m.fini || m.tour !== cote || garde++ >= GESTES_MAX) { fin(); return; }
      const avant = m.fil.length;
      const joue = iaGeste(m);
      if (!joue) { fin(); return; }        // iaGeste a fini la présence lui-même
      dernier = { piece: joue.piece, cible: joue.cible || null };
      // Le dé de l'adversaire tombe sur SA case, comme le tien sur la tienne,
      // et son verdict éclate au même endroit que le tien l'aurait fait.
      deGlace = joue.jet ? { jet: joue.jet, cote, r: joue.piece.r, c: joue.piece.c, n: ++noJet } : null;
      verdict(avant, placesDe(joue.piece, joue.cible || null));
      rendre();
      setTimeout(pas, joue.jet ? PAUSE_DE : PAUSE_SEC);
    };
    setTimeout(pas, 320);
  }

  /*
   * UN BUT SE VOIT AVANT DE SE LIRE. Le pointage montait d'un cran et c'était
   * tout : au milieu d'une présence adverse, on ne savait même pas quel geste
   * l'avait fait entrer. Un seul veilleur sert les deux camps — le tien comme
   * le sien — parce qu'un but est un but, et il n'y a qu'un endroit où le
   * pointage change.
   */
  const butsVus = { A: A.buts, B: B.buts };
  function veillerButs() {
    for (const [c, eq] of [['A', A], ['B', B]]) {
      if (eq.buts > butsVus[c]) {
        butsVus[c] = eq.buts;
        eclat = { eq: c, texte: eq.nom };
        setTimeout(() => { eclat = null; if (!regles) $('.t-tete').innerHTML = tete() + banniere(); }, 1800);
      }
    }
  }

  /* ---------- les clics ---------- */
  modal.onclick = ev => {
    const t = ev.target;
    if (t.closest('.table-regles')) { regles = !regles; rendre(); return; }
    if (t.closest('.t-regles-fermer')) { regles = false; rendre(); return; }
    if (regles) return;                       // le volet des règles couvre tout
    if (t.closest('.t-resultat') || t.closest('.table-close')) { fermer(); return; }
    if (iaEnCours) return;      // le récit de la présence adverse court encore
    const caseGlace = t.closest('.t-case');
    if (caseGlace && aMoi() && !attente) {
      const r = +caseGlace.dataset.r, c = +caseGlace.dataset.c;
      const o = offre(r, c);
      if (o) { agir(o); return; }
      const piece = surLaGlace(m).find(x => x.r === r && x.c === c);
      if (piece && piece.eq === 'A' && !piece.gardien && aDesOptions(piece)) { sel = piece === sel ? null : piece; cible = null; rendre(); }
      return;
    }
    const geste = t.closest('[data-geste]');
    if (geste && sel && aMoi() && !attente) {
      const piece = sel, quoi = geste.dataset.geste, vise = cible;
      if (quoi === 'tir') lancer(tirer(m, piece), 'A', j => appliquerTir(m, piece, j), placesDe(piece, null));
      else if (quoi === 'echec' && vise) { cible = null; lancer(mettreEnEchec(m, piece, vise), 'A', j => appliquerEchec(m, piece, vise, j), placesDe(piece, vise)); }
      else if (quoi === 'vol' && vise) { cible = null; lancer(voler(m, piece, vise), 'A', j => appliquerVol(m, piece, vise, j), placesDe(piece, vise)); }
      else if (quoi === 'ecran') { sansDe(piece, () => seMettreDevant(m, piece)); cible = null; apres(); }
      else if (quoi === 'foncer') { sansDe(piece, () => foncer(m, piece)); cible = null; rendre(); }
      return;
    }
    if (t.closest('.t-relancer')) { attente.jet = relancer(m, attente.jet, 'A'); deGlace = { ...deGlace, jet: attente.jet, n: ++noJet }; rendre(); return; }
    if (t.closest('.t-suite')) { resoudre(); return; }
    if (t.closest('.t-deselect')) { sel = null; cible = null; rendre(); return; }
    if (t.closest('.t-passer')) { sel = null; cible = null; deGlace = null; flash = null; finirPresence(m); apres(); return; }
    const uni = t.closest('.t-seg button');
    if (uni) {
      const quoi = uni.parentElement.dataset.u, v = +uni.dataset.v;
      changerUnite(m, 'A', quoi === 'tri' ? v : A.tri, quoi === 'pai' ? v : A.pai);
      sel = null; cible = null; choisirSeul(); rendre();
      return;
    }
  };

  function fermer() {
    // Fermer avant la fin, c'est laisser jouer le reste : le match compte au
    // classement, on ne peut pas s'en sauver.
    let garde = 0;
    while (!m.fini && garde++ < 400) iaPresence(m);
    modal.style.display = 'none';
    document.body.style.overflow = '';
    modal.onclick = null;
    onTermine(resultatDe(m));
  }

  $('.t-titre').innerHTML = `<span class="t-titre-1">${esc(titre)}</span><span class="t-titre-2">${esc(sousTitre)}</span>`;
  // Pas d'écouteur direct sur le bouton « ? » : `modal.onclick` le sert déjà
  // par délégation, et les deux ensemble basculaient le volet deux fois — il
  // s'ouvrait et se refermait dans le même clic.
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  choisirSeul();
  rendre();
  if (m.tour === 'B') tourAdverse();
}
