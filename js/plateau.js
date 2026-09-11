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
  HABILETES, nouveauMatch, surLaGlace, eqDe, adverse, porteur, libre, actives, peutJouer,
  deplacementsDe, receveursDe, ciblesEchecDe, natureCase, dist, batons, chances,
  modTir, modPasse, modEchec, modEsquive, modRamasser,
  deplacer, appliquerEsquive, passer, appliquerPasse, tirer, appliquerTir,
  mettreEnEchec, appliquerEchec, ramasser, appliquerRamasser,
  relancer, finirPresence, iaPresence, resultatDe, changerUnite, auCentre, nomDe,
} from './table.js';

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
  let sel = null;          // la pièce choisie
  let attente = null;      // un jet en attente : { jet, appliquer }
  let iaEnCours = false;
  let changement = true;   // on offre le changement de trio après chaque mise au jeu

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
      if (piece.eq === 'B' && porteur(m) === piece && dist(sel, piece) === 1 && !sel.agi) {
        return { type: 'echec', cible: piece, mod: modEchec(m, sel, piece) + bonus('ACTIF') + bonus('EPAULE'), seuil: SEUIL };
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
      if (p === piece) return true;                                   // tirer, passer
      if (l && l.r === piece.r && l.c === piece.c) return true;       // ramasser
      if (p && p.eq !== piece.eq && dist(piece, p) === 1) return true; // mettre en échec
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
        if (o) cls.push(`t-offre t-offre-${o.type}`);
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
        if (o && (o.type === 'passe' || o.type === 'echec')) {
          dedans += `<span class="t-cote">${cote(o.mod, o.seuil)}</span>`;
        }
        html += `<button type="button" class="${cls.join(' ')}" data-r="${r}" data-c="${c}"
                   ${filet || (!o && !jouable) ? 'tabindex="-1"' : ''}>${dedans}</button>`;
      }
    }
    return html + '</div>';
  }

  /* ---------- la carte de la pièce choisie et les boutons ---------- */

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
    const aLaRondelle = porteur(m) === sel;
    const surRondelle = libre(m) && libre(m).r === sel.r && libre(m).c === sel.c;
    const gestes = [];
    if (aLaRondelle && !sel.agi) {
      const mod = modTir(m, sel) + bonus('DECOCHE');
      gestes.push(`<button type="button" class="t-geste t-tir" data-geste="tir">Tirer <b>${cote(mod, SEUIL_TIR)}</b><i>${pourcent(mod, SEUIL_TIR)}</i></button>`);
    }
    if (surRondelle && !sel.agi && !aLaRondelle) {
      const mod = modRamasser(m, sel, sel);
      gestes.push(`<button type="button" class="t-geste" data-geste="ramasser">Ramasser <b>${cote(mod, SEUIL)}</b><i>${pourcent(mod, SEUIL)}</i></button>`);
    }
    const aide = aLaRondelle
      ? 'Touche une case allumée pour patiner, un coéquipier pour lui passer.'
      : porteur(m) && porteur(m).eq === 'B' && dist(sel, porteur(m)) === 1
        ? 'Touche le porteur pour le mettre en échec.'
        : 'Touche une case allumée pour patiner.';
    return `
      <div class="t-carte">
        <div class="t-fiche">
          <span class="t-fiche-role">${esc(sel.role)}</span>
          <span class="t-fiche-nom">${esc((sel.p && sel.p.n) || 'Rappel')}</span>
          <span class="t-axes">
            ${['PA', 'MA', 'TI', 'FO'].map(k => `<span class="t-axe" title="${esc(AXE_MOT[k])}"><i>${k}</i><b>${st[k]}</b></span>`).join('')}
          </span>
        </div>
        ${h ? `<button type="button" class="t-hab ${sel.habDispo ? 'on' : ''}" title="${esc(h.desc)}" disabled>
                 ${h.icon} ${esc(h.nom)} ${sel.habDispo ? '+2' : '· utilisée'}</button>` : ''}
        <div class="t-gestes">${gestes.join('')}</div>
        <p class="t-aide">${esc(aide)}</p>
      </div>`;
  }

  const AXE_MOT = {
    PA: 'Patin : de combien de cases il bouge',
    MA: 'Maniement : passer, esquiver, ramasser',
    TI: 'Tir : faire entrer la rondelle',
    FO: 'Force : enlever la rondelle, et la garder',
  };

  /* ---------- le dé ---------- */

  function de() {
    if (!attente) return '';
    const j = attente.jet;
    const mot = { tir: 'Tir', passe: 'Passe', echec: 'Mise en échec', esquive: 'Esquive', ramasser: 'Rondelle' }[j.quoi] || 'Jet';
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

  function unites() {
    if (!changement || !aMoi() || attente) return '';
    return `
      <div class="t-unites">
        <span class="t-unites-t">Qui saute ?</span>
        <span class="t-seg" data-u="tri">${[0, 1, 2, 3].map(i => `<button type="button" data-v="${i}" class="${A.tri === i ? 'on' : ''}">${i + 1}<sup>${i ? 'e' : 'er'}</sup> trio</button>`).join('')}</span>
        <span class="t-seg" data-u="pai">${[0, 1, 2].map(i => `<button type="button" data-v="${i}" class="${A.pai === i ? 'on' : ''}">${i + 1}<sup>${i ? 'e' : 're'}</sup> paire</button>`).join('')}</span>
      </div>`;
  }

  /* ---------- le fil ---------- */
  const fil = () => `<div class="t-fil">${m.fil.slice(0, 7).map(e =>
    `<div class="t-evt t-evt-${e.genre}">${esc(e.texte)}</div>`).join('')}</div>`;

  /* ---------- le rendu ---------- */
  function rendre() {
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
    changement = !m.fini && m.tour === 'A' && auCentre(m, 'A');
    choisirSeul();
    rendre();
    if (!m.fini && m.tour === 'B' && !iaEnCours) tourAdverse();
  }

  function agir(o) {
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
        changement = !m.fini && m.tour === 'A' && auCentre(m, 'A');
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
    if (t.closest('.t-resultat') || t.closest('.table-close')) { fermer(); return; }
    if (iaEnCours) return;      // le récit de la présence adverse court encore
    const caseGlace = t.closest('.t-case');
    if (caseGlace && aMoi() && !attente) {
      const r = +caseGlace.dataset.r, c = +caseGlace.dataset.c;
      const o = offre(r, c);
      if (o) { agir(o); return; }
      const piece = surLaGlace(m).find(x => x.r === r && x.c === c);
      if (piece && piece.eq === 'A' && !piece.gardien && aDesOptions(piece)) { sel = piece === sel ? null : piece; rendre(); }
      return;
    }
    const geste = t.closest('[data-geste]');
    if (geste && sel && aMoi() && !attente) {
      const piece = sel;
      if (geste.dataset.geste === 'tir') lancer(tirer(m, piece), 'A', j => appliquerTir(m, piece, j));
      else lancer(ramasser(m, piece), 'A', j => appliquerRamasser(m, piece, j));
      return;
    }
    if (t.closest('.t-relancer')) { attente.jet = relancer(m, attente.jet, 'A'); rendre(); return; }
    if (t.closest('.t-suite')) { resoudre(); return; }
    if (t.closest('.t-deselect')) { sel = null; rendre(); return; }
    if (t.closest('.t-passer')) { sel = null; finirPresence(m); apres(); return; }
    const uni = t.closest('.t-seg button');
    if (uni) {
      const quoi = uni.parentElement.dataset.u, v = +uni.dataset.v;
      changerUnite(m, 'A', quoi === 'tri' ? v : A.tri, quoi === 'pai' ? v : A.pai);
      sel = null; rendre();
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
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  choisirSeul();
  rendre();
  if (m.tour === 'B') tourAdverse();
}
