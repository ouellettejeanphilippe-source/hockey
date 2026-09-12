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
  modTir, modPasse, modEchec, modEsquive, modVol,
  deplacer, appliquerEsquive, passer, appliquerPasse, tirer, appliquerTir,
  mettreEnEchec, appliquerEchec, voler, appliquerVol,
  seMettreDevant, foncer, souffleDe, essouffle, pasDe, uniteDe, statsDeTable,
  relancer, finirPresence, iaPresence, resultatDe, changerUnite, nomDe, reglesDuPlateau,
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

  function glace() {
    const l = libre(m), p = porteur(m);
    let html = '<div class="t-glace" role="grid" aria-label="La patinoire">';
    for (let r = 0; r < RANGS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Les gardiens ne sont pas sur la glace des patineurs : chacun tient
        // le centre de son filet, sur sa rangée à lui.
        const gard = r === 0 ? B.piece_g : r === RANGS - 1 ? A.piece_g : null;
        const piece = surLaGlace(m).find(x => x.r === r && x.c === c)
          || (gard && gard.c === c ? gard : null);
        const nature = natureCase(r, c, 0);
        const filet = r === 0 || r === RANGS - 1;
        const o = filet ? null : offre(r, c);
        const cls = ['t-case', `t-${nature}`];
        if (filet) cls.push('t-but');
        if (r === 4) cls.push('t-centre');
        if (r === 3 || r === 5) cls.push('t-bleue');
        if (o) cls.push(`t-offre t-offre-${o.type === 'duel' ? 'echec' : o.type}`);
        if (piece && piece === sel) cls.push('t-sel');
        if (l && l.r === r && l.c === c) cls.push('t-rondelle-libre');
        const jouable = piece && piece.eq === 'A' && !piece.gardien && aMoi() && !attente && aDesOptions(piece);
        if (jouable) cls.push('t-jouable');
        let dedans = '';
        if (piece) {
          const b = piece.eq === 'A' ? bA : bB;
          dedans = `<span class="t-piece ${piece.eq === 'A' ? 'mienne' : 'sienne'} ${piece.gardien ? 'gardien' : ''} ${piece.etourdi ? 'etourdi' : ''}"
             style="--pf:${b.bg};--pi:${b.ink};--pl:${piece.eq === 'A' ? vA : vB}">
             <span class="t-role">${piece.gardien ? 'G' : esc(piece.role)}</span>
             <span class="t-nom">${esc(nomCourt(piece.p))}</span>
             ${p === piece ? '<span class="t-rondelle" aria-label="a la rondelle"></span>' : ''}
             ${!piece.gardien && essouffle(m, piece) ? '<span class="t-vide-air" title="Essoufflé">😮‍💨</span>' : ''}
             ${piece.ecran ? '<span class="t-ecran" title="Il se place devant les tirs">🛡️</span>' : ''}
           </span>`;
        } else if (l && l.r === r && l.c === c) {
          dedans = '<span class="t-rondelle t-seule" aria-label="rondelle libre"></span>';
        } else if (o && o.type === 'deplacer') {
          dedans = `<span class="t-pas">${o.mod === null ? '' : cote(o.mod, SEUIL)}</span>`;
        }
        /*
         * CHAQUE CIBLE PORTE SA COTE. JP : *je pense à hoops tactics sur
         * Android genre*. C'est la même famille — un plateau qu'on touche,
         * et chaque option annoncée avec ses chances AVANT qu'on s'engage.
         * Une case de déplacement montre son seuil d'esquive ; un coéquipier
         * et un porteur adverse montrent le leur aussi, sinon on choisit à
         * l'aveugle celui qu'on veut rejoindre.
         */
        if (o && (o.type === 'passe' || o.type === 'echec' || o.type === 'duel')) {
          dedans += `<span class="t-cote">${cote(o.mod, o.seuil)}</span>`;
        }
        html += `<button type="button" class="${cls.join(' ')}" data-r="${r}" data-c="${c}"
                   ${filet || (!o && !jouable) ? 'tabindex="-1"' : ''}>${dedans}</button>`;
      }
    }
    return html + '</div>';
  }

  /* ---------- la carte de la pièce choisie et les boutons ---------- */

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

    if (aLaRondelle && !sel.agi) {
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

    const aide = cible ? `Choisis l'épaule ou le bâton sur ${esc(nomCourt(cible.p))}.`
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

  function de() {
    if (!attente) return '';
    const j = attente.jet;
    const mot = { tir: 'Tir', passe: 'Passe', echec: 'Mise en échec', esquive: 'Esquive', vol: 'Vol de rondelle' }[j.quoi] || 'Jet';
    const peutRelancer = !j.reussi && !j.relance && A.relance && attente.cote === 'A';
    return `
      <div class="t-de ${j.reussi ? 'ok' : 'rate'}" role="status">
        <span class="t-de-face">${j.de}</span>
        <span class="t-de-calcul">${esc(mot)} · ${j.de}${j.mod >= 0 ? ` + ${j.mod}` : ` − ${-j.mod}`} = <b>${j.total}</b> contre ${j.seuil}+</span>
        <span class="t-de-verdict">${j.reussi ? 'Réussi' : 'Raté'}${j.relance ? ' (relance)' : ''}</span>
        <span class="t-de-boutons">
          ${peutRelancer ? '<button type="button" class="t-relancer">🎲 Relance d\'équipe</button>' : ''}
          <button type="button" class="t-suite">${peutRelancer ? 'Accepter' : 'Continuer'}</button>
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
    if (regles) {
      $('.t-tete').innerHTML = '';
      $('.t-plateau').innerHTML = '';
      $('.t-bas').innerHTML = reglesHtml();
      return;
    }
    $('.t-tete').innerHTML = tete();
    $('.t-plateau').innerHTML = glace();
    $('.t-bas').innerHTML = unites() + de() + carte() + boutons() + fil();
  }

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

  /* Un jet part : on le montre, et la suite attend que le joueur confirme. */
  function lancer(jet, cote, appliquer) {
    attente = { jet, cote, appliquer };
    rendre();
  }

  function resoudre() {
    if (!attente) return;
    const { jet, appliquer } = attente;
    attente = null;
    cible = null;
    appliquer(jet);
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
      const d = deplacer(m, sel, o.vers);
      if (!d.jet) { apres(); return; }
      const piece = sel, vers = o.vers;
      lancer(d.jet, 'A', j => appliquerEsquive(m, piece, vers, j));
      return;
    }
    if (o.type === 'passe') {
      const piece = sel, cible = o.cible;
      lancer(passer(m, piece, cible), 'A', j => appliquerPasse(m, piece, cible, j));
      return;
    }
    if (o.type === 'echec') {
      const piece = sel, cible = o.cible;
      lancer(mettreEnEchec(m, piece, cible), 'A', j => appliquerEchec(m, piece, cible, j));
    }
  }

  /* ---------- la présence de l'adversaire, geste par geste ---------- */
  function tourAdverse() {
    iaEnCours = true;
    const avant = m.fil.length;
    iaPresence(m);
    // On rejoue le fil de sa présence au rythme de la lecture : d'un coup,
    // on ne comprendrait pas ce qui vient d'arriver.
    const nouveaux = m.fil.length - avant;
    let montre = 0;
    const cache = m.fil.slice();
    const tic = () => {
      montre++;
      m.fil = cache.slice(Math.max(0, nouveaux - montre));
      rendre();
      if (montre < nouveaux) setTimeout(tic, 620);
      else {
        m.fil = cache;
        iaEnCours = false;
        choisirSeul();
        rendre();
        if (!m.fini && m.tour === 'B') tourAdverse();
      }
    };
    if (nouveaux > 0) setTimeout(tic, 260); else { iaEnCours = false; rendre(); }
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
      if (quoi === 'tir') lancer(tirer(m, piece), 'A', j => appliquerTir(m, piece, j));
      else if (quoi === 'echec' && vise) { cible = null; lancer(mettreEnEchec(m, piece, vise), 'A', j => appliquerEchec(m, piece, vise, j)); }
      else if (quoi === 'vol' && vise) { cible = null; lancer(voler(m, piece, vise), 'A', j => appliquerVol(m, piece, vise, j)); }
      else if (quoi === 'ecran') { seMettreDevant(m, piece); cible = null; apres(); }
      else if (quoi === 'foncer') { foncer(m, piece); cible = null; rendre(); }
      return;
    }
    if (t.closest('.t-relancer')) { attente.jet = relancer(m, attente.jet, 'A'); rendre(); return; }
    if (t.closest('.t-suite')) { resoudre(); return; }
    if (t.closest('.t-deselect')) { sel = null; cible = null; rendre(); return; }
    if (t.closest('.t-passer')) { sel = null; cible = null; finirPresence(m); apres(); return; }
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
