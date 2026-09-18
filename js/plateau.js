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
  COLS, RANGS, BUT_COL, MI_GLACE, FILET_HAUT, FILET_BAS, estFilet, PERIODES, POSSESSIONS_PAR_PERIODE, POSSESSIONS_PROLONGATION, chancesDe, avec, ecartDuel,
  HABILETES, GABARITS, TIRS, nouveauMatch, surLaGlace, eqDe, adverse, porteur, libre, actives, peutJouer,
  deplacementsDe, receveursDe, ciblesEchecDe, ciblesVolDe, ciblesFondDe, natureCase, dist, batons, chances,
  modTir, modPasse, modEchec, modEsquive, modVol, esquiveRequise, peutTirer, distanceAuFilet, PORTEE_TIR,
  deplacer, appliquerEsquive, passer, appliquerPasse, tirer, appliquerTir,
  mettreEnEchec, appliquerEchec, voler, appliquerVol,
  souffleDe, essouffle, uniteDe, statsDeTable, AXE_MOT,
  ciblesDejouerDe, modDejouer, dejouer, appliquerDejouer,
  receptionPossible, tirerSurReception,
  relancer, activer, finirMain, renoncer, iaPresence, iaGeste, GESTES_MAX, resultatDe, changerUnite, nomDe, reglesDuPlateau,
  peutBouger, peutAgir, mainEpuisee, souffleMax, etatSouffle, couvreurs, pressionDe, PUNITION_TOURS,
  bataillePossible, modBataille, appliquerBataille,
} from './table.js';
import { archetypeKey, ARCHETYPES } from './ratings.js';
import { TRAITS } from './traits.js';
import { jouerSon, sonsActifs } from './sons.js';

const ordP = n => (n === 1 ? '1re' : `${n}e`);
const nomCourt = p => {
  const n = (p && p.n) || 'Rappel';
  const bouts = n.split(' ');
  return bouts.length > 1 ? bouts[bouts.length - 1] : n;
};

/* La pastille d'un geste : ses chances, et le duel qui les fait (« TI 4 c. AR 5 »). */
const cote = d => `${Math.round(chancesDe(d) * 100)} %`;
/* « MA 4 +1 c. DE 5 » : la stat brute de chacun, et ce que la situation a donné ou retiré (S41). */
const signeDe = n => (n > 0 ? ` +${n}` : n < 0 ? ` −${-n}` : '');
const detail = d => {
  if (!d.mots) return '';
  const [ea, eb] = ecartDuel(d);
  const gauche = d.brut ? `${d.mots[0]} ${d.brut[0]}${signeDe(ea)}` : `${d.mots[0]} ${d.a}`;
  if (!d.opp) return `${gauche} c. ${d.b}`;
  const droite = d.brut && d.brut[1] !== null ? `${d.mots[1]} ${d.brut[1]}${signeDe(eb)}` : `${d.mots[1]} ${d.b}`;
  return `${gauche} c. ${droite}`;
};

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
  let feuille = false;     // la feuille du match, une fois le match fini
  let sel = null;          // la pièce choisie
  let cible = null;        // l'adversaire visé, quand deux gestes sont possibles
  let attente = null;      // un jet en attente : { jet, appliquer }
  let iaEnCours = false;
  /*
   * LE MODE : le geste qu'on a choisi AVANT de toucher la glace. JP : *des
   * boutons pour passer, dumper, frapper, esquiver, bloquer [...] pour avoir
   * un jeu tactique*. Sans mode (null), la glace propose tout à la fois —
   * patiner, passer, frapper — et une touche joue ; c'est le chemin rapide,
   * et il reste. Avec un mode, la glace n'allume QUE les cibles de ce
   * geste-là : on décide d'abord ce qu'on fait, puis où. Le dégagement n'a
   * pas de chemin rapide : ses cibles sont des coins vides, et les allumer
   * en permanence noierait le reste.
   */
  let mode = null;         // null | 'deplacer' | 'passe' | 'dejouer' | 'echec' | 'vol'
  let avancerIA = null;    // pendant la présence adverse : un clic saute l'attente
  let minuteurIA = 0;
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
  let volet = false;       // le volet de la pièce (fiche, trios, fil) est ouvert
  let actions = { modes: [], gestes: [], aide: '' };   // les actions de la pièce choisie, rendues par `dock`
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

  /* Le cachot (S38) : qui est puni, pour combien de tours — l'avantage numérique se lit ici. */
  function cachot() {
    const out = [];
    for (const eq of [A, B]) {
      if (!eq.penalite) continue;
      const qui = eq.penalite.p ? nomCourt(eq.penalite.p) : eq.penalite.role;
      out.push(`<span class="tb-cachot" title="${esc(eq.nom)} joue à quatre : ${esc(qui)} est au cachot pour ${eq.penalite.tours} tour${eq.penalite.tours > 1 ? 's' : ''}. Un but marqué contre l'équipe punie le libère.">⚠ ${esc(qui)} · ${eq.penalite.tours}</span>`);
    }
    return out.join('');
  }

  /* ---------- le tableau indicateur ---------- */
  function tete() {
    // LE TEMPO EN POSSESSIONS (S41) : la période finit au premier arrêt de jeu après la dernière.
    const total = m.prolongation ? POSSESSIONS_PROLONGATION : POSSESSIONS_PAR_PERIODE;
    const restant = Math.max(0, total - m.possessions);
    const periode = m.prolongation ? `Prolongation ${m.prolongation > 1 ? m.prolongation : ''}`.trim()
      : `${ordP(m.periode)} période`;
    return `
      <div class="tb-score">
        <div class="tb-eq tb-a"><span class="tb-logo">${logo(A.tag, 22)}</span><span class="tb-nom">${esc(A.nom)}</span><b>${A.buts}</b></div>
        <div class="tb-milieu">
          <span class="tb-periode">${esc(periode)}</span>
          <span class="tb-presence" title="Une période, c'est ${total} possessions : elle finit au premier arrêt de jeu après que la rondelle a changé de camp ${total} fois.">${m.fini ? 'Terminé' : `${restant} possession${restant > 1 ? 's' : ''}`}</span>
        </div>
        <div class="tb-eq tb-b"><b>${B.buts}</b><span class="tb-nom">${esc(B.nom)}</span><span class="tb-logo">${logo(B.tag, 22)}</span></div>
      </div>
      <div class="tb-etat">
        <span class="tb-tour ${aMoi() ? 'mien' : ''}">${m.fini ? 'Match terminé' : aMoi() ? 'À toi : un déplacement, une action' : `${esc(B.nom)} joue sa main`}</span>
        ${cachot()}
        <span class="tb-relance ${A.relance ? 'on' : ''}" title="Une relance d'équipe par période : on la dépense après avoir vu le dé.">🎲 Relance ${A.relance ? 'disponible' : 'dépensée'}</span>
      </div>`;
  }

  /* ---------- la glace ---------- */

  /* Ce qu'une case propose à la pièce choisie : rien, patiner, passer, échec. */
  function offre(r, c) {
    if (!sel || !aMoi() || attente) return null;
    const piece = surLaGlace(m).find(x => x.r === r && x.c === c);
    const veut = t => !mode || mode === t;
    if (piece) {
      // DÉJOUER et DÉVIER (S35) ne se jouent qu'en mode, comme la passe : un
      // adversaire collé se confond avec l'épaule, un coéquipier avec le choix.
      if (mode === 'dejouer' && piece.eq === 'B' && ciblesDejouerDe(m, sel).includes(piece)) {
        return { type: 'dejouer', cible: piece, duel: avec(modDejouer(m, sel, piece), bonus('PATIN')) };
      }
      // LA PASSE NE SE JOUE QUE PAR SON BOUTON. JP : *les passes doivent
      // passer par bouton ou confirmation, sinon ça passe random* — toucher
      // un coéquipier pour le CHOISIR passait la rondelle. Sans le mode
      // « Passer », toucher un coéquipier le choisit ; en mode, ça passe.
      if (mode === 'passe' && piece.eq === 'A' && piece !== sel && !piece.etourdi && porteur(m) === sel && peutAgir(m, sel)) {
        return { type: 'passe', cible: piece, duel: avec(modPasse(m, sel, piece), bonus('VOILEE')) };
      }
      // LE CONTACT VISE N'IMPORTE QUEL ADVERSAIRE ADJACENT, pas seulement le
      // porteur : frapper l'ailier devant son filet ouvre une voie. Sans mode,
      // le porteur ouvre un DUEL (l'épaule ou le bâton, la carte fait
      // choisir) ; en mode « épaule » ou « bâton », le geste est déjà choisi
      // et la touche le joue.
      if (piece.eq === 'B' && !piece.gardien && !piece.etourdi && dist(sel, piece) === 1 && peutAgir(m, sel) && porteur(m) !== sel) {
        /*
         * LA CASE DEMANDE AU MOTEUR, elle ne devine pas (S42). Elle
         * s'allumait sur la seule adjacence : une pièce en pleine course ou
         * essoufflée voyait donc la case du porteur s'allumer, et la
         * toucher n'offrait RIEN — ni Frapper ni Harponner, les deux
         * boutons lisant `ciblesEchecDe` et `ciblesVolDe`. Une case allumée
         * qui ne fait rien est exactement ce que « jouable veut dire a
         * encore quelque chose à faire » interdit.
         */
        const porte = porteur(m) === piece;
        const peutFrapper = ciblesEchecDe(m, sel).includes(piece);
        const peutVoler = ciblesVolDe(m, sel).includes(piece);
        if (mode === 'vol') return porte && peutVoler ? { type: 'vol', cible: piece, duel: avec(modVol(m, sel, piece), bonus('ACTIF')) } : null;
        if (!veut('echec')) return null;
        // Sur le PORTEUR et sans mode, la case ouvre le DUEL — la carte fait
        // choisir entre l'épaule et le bâton, et n'affiche que ce qui est
        // jouable. Elle ne joue jamais un geste à la place du choix : c'est
        // le choix qui est le geste. Ailleurs, c'est l'épaule ou rien.
        if (porte && !mode) return peutFrapper || peutVoler
          ? { type: 'duel', cible: piece, duel: avec(modEchec(m, sel, piece), bonus('ACTIF') + bonus('EPAULE')) }
          : null;
        return peutFrapper
          ? { type: 'echec', cible: piece, duel: avec(modEchec(m, sel, piece), bonus('ACTIF') + bonus('EPAULE')) }
          : null;
      }
      return null;
    }
    // LA PASSE AU FOND (S41) : en mode « Passer », une case du fond est une cible comme un coéquipier.
    if (mode === 'passe' && porteur(m) === sel && peutAgir(m, sel)) {
      const v = ciblesFondDe(m, sel).find(x => x.r === r && x.c === c);
      if (v) return { type: 'passe', cible: v, duel: modPasse(m, sel, v) };
    }
    if (!veut('deplacer') || !peutBouger(m, sel)) return null;
    const v = deplacementsDe(m, sel).find(x => x.r === r && x.c === c);
    if (!v) return null;
    // La bataille pour la rondelle libre (S37) : la cote sur la case, comme l'esquive.
    if (porteur(m) !== sel && bataillePossible(m, sel, v)) return { type: 'deplacer', vers: v, duel: modBataille(m, sel, v) };
    // L'esquive (S41) : quitter ou rejoindre une case sous pression, la cote sur la case.
    return { type: 'deplacer', vers: v, duel: esquiveRequise(m, sel, v) ? avec(modEsquive(m, sel, v), bonus('PATIN')) : null };
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
    // LE UNE-DEUX (S35) : le receveur d'une passe qui vient de réussir peut
    // tirer sur-le-champ, même s'il a déjà joué ce tour-ci — c'est la seule
    // pièce qui a une option sans être activée ni « jouable ».
    if (receptionPossible(m) === piece) return true;
    if (!peutJouer(piece) || m.tour !== piece.eq) return false;
    // UN DÉPLACEMENT ET UNE ACTION PAR MAIN (S36) : ce que le budget du tour
    // a déjà dépensé n'est plus une option pour personne.
    const p = porteur(m), l = libre(m);
    if (peutAgir(m, piece)) {
      if (p === piece) return true;                                     // tirer, passer
      if (ciblesEchecDe(m, piece).length || ciblesVolDe(m, piece).length) return true;   // frapper, harponner
    }
    if (peutBouger(m, piece) && deplacementsDe(m, piece).length) return true;
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

  /*
   * UNE VRAIE PATINOIRE SOUS LA GRILLE. JP : *je veux que la glace ressemble
   * à une vraie glace de hockey*. Les cases restent la grille du jeu — c'est
   * elles qu'on touche — mais elles sont transparentes, posées sur un SVG
   * qui dessine la patinoire en UNITÉS DE CASE (`viewBox` = COLS × RANGS) :
   * la bande et ses coins arrondis, la glace blanche, les lignes des buts
   * SOUS chaque filet, les bleues au bord de chaque zone offensive, la rouge
   * au centre, les cercles de mise au jeu, les demi-lunes des gardiens, les
   * filets avec leur maille, et le trapèze derrière chaque but. Rien n'est
   * écrit en dur : tout se déduit de `COLS`, `RANGS`, `FILET_HAUT`,
   * `FILET_BAS`, `BUT_COL` et `PORTEE_TIR`, comme les classes des cases —
   * changer la géométrie du moteur redessine la patinoire. Les couleurs sont
   * des jetons de la feuille de style (`--glace-*`), et la glace est blanche
   * dans les trois palettes : une patinoire n'est pas un décor, c'est une
   * patinoire.
   */
  function patinoireSvg() {
    const W = COLS, H = RANGS, cx = BUT_COL + 0.5;
    const yHaut = FILET_HAUT + 0.5, yBas = FILET_BAS + 0.5;      // les lignes des buts
    const bleueHaut = FILET_HAUT + PORTEE_TIR + 1, bleueBas = FILET_BAS - PORTEE_TIR;
    const centre = MI_GLACE + 0.5;
    const rond = Math.min(1.35, W / 4);                          // le rayon des coins
    const xG = 2, xD = W - 2;                                    // les cercles de bout
    const f = n => (Math.round(n * 1000) / 1000).toString();
    /* Un filet et sa demi-lune : `sens` vaut 1 quand la glace est SOUS la ligne des buts. */
    const bout = (y, sens) => {
      const rc = 0.95, prof = 0.42;
      const yFond = y - sens * prof, yPointe = sens > 0 ? 0.09 : H - 0.09;   // le trapèze finit à la bande
      return `
      <path class="t-rk-lune" d="M${f(cx - rc)} ${f(y)} A${rc} ${rc} 0 0 ${sens > 0 ? 0 : 1} ${f(cx + rc)} ${f(y)} Z"/>
      <path class="t-rk-trapeze" d="M${f(cx - 0.9)} ${f(y)} L${f(cx - 1.55)} ${f(yPointe)} M${f(cx + 0.9)} ${f(y)} L${f(cx + 1.55)} ${f(yPointe)}"/>
      <rect class="t-rk-maille" x="${f(cx - 0.34)}" y="${f(Math.min(y, yFond))}" width="0.68" height="${f(prof)}"/>
      <rect class="t-rk-filet" x="${f(cx - 0.34)}" y="${f(Math.min(y, yFond))}" width="0.68" height="${f(prof)}"/>`;
    };
    /* Les cercles de mise au jeu d'un bout, et les points de la zone neutre. */
    const cercles = (yCercle, yPoint) => [xG, xD].map(x => `
      <circle class="t-rk-cercle" cx="${x}" cy="${f(yCercle)}" r="1.05"/>
      <circle class="t-rk-point" cx="${x}" cy="${f(yCercle)}" r="0.11"/>
      <circle class="t-rk-point" cx="${x}" cy="${f(yPoint)}" r="0.1"/>`).join('');
    return `<svg class="t-rink" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
      <defs><pattern id="t-rk-mailles" width="0.12" height="0.12" patternUnits="userSpaceOnUse">
        <path d="M0 0.06H0.12M0.06 0V0.12" class="t-rk-fil"/></pattern></defs>
      <rect class="t-rk-bande" x="0" y="0" width="${W}" height="${H}" rx="${f(rond + 0.1)}"/>
      <rect class="t-rk-glace" x="0.09" y="0.09" width="${f(W - 0.18)}" height="${f(H - 0.18)}" rx="${f(rond)}"/>
      <line class="t-rk-but-ligne" x1="0.12" x2="${f(W - 0.12)}" y1="${f(yHaut)}" y2="${f(yHaut)}"/>
      <line class="t-rk-but-ligne" x1="0.12" x2="${f(W - 0.12)}" y1="${f(yBas)}" y2="${f(yBas)}"/>
      <rect class="t-rk-bleue" x="0.09" y="${f(bleueHaut - 0.09)}" width="${f(W - 0.18)}" height="0.18"/>
      <rect class="t-rk-bleue" x="0.09" y="${f(bleueBas - 0.09)}" width="${f(W - 0.18)}" height="0.18"/>
      <rect class="t-rk-rouge" x="0.09" y="${f(centre - 0.09)}" width="${f(W - 0.18)}" height="0.18"/>
      <line class="t-rk-rouge-tiret" x1="0.09" x2="${f(W - 0.09)}" y1="${f(centre)}" y2="${f(centre)}"/>
      <circle class="t-rk-cercle t-rk-cercle-centre" cx="${f(W / 2)}" cy="${f(centre)}" r="1.3"/>
      <circle class="t-rk-point t-rk-point-centre" cx="${f(W / 2)}" cy="${f(centre)}" r="0.12"/>
      ${cercles(yHaut + 2.5, bleueHaut + 0.55)}
      ${cercles(yBas - 2.5, bleueBas - 0.55)}
      ${bout(yHaut, 1)}
      ${bout(yBas, -1)}
    </svg>`;
  }

  function batirGlace() {
    // La feuille de style ne devine JAMAIS la géométrie : le nombre de colonnes
    // lui est donné par le moteur, donc changer COLS suffit.
    let html = `<div class="t-glace" role="grid" aria-label="La patinoire" style="--tcols:${COLS};--trangs:${RANGS}">`;
    html += patinoireSvg();
    for (let r = 0; r < RANGS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Chaque moitié se peint du point de vue de qui l'attaque : les zones
        // sont symétriques, et c'est ce qu'on veut lire.
        const nature = natureCase(r, c, r <= MI_GLACE ? FILET_HAUT : FILET_BAS);
        const cls = ['t-case', `t-${nature}`];
        if (estFilet(r, c)) cls.push('t-but');
        // Les lignes se DÉDUISENT de la glace : la rouge au centre, les bleues
        // au bord de chaque zone offensive, et la ligne des buts sous chaque
        // filet — la rangée derrière est de l'autre côté. Elles étaient
        // écrites en dur pour neuf rangées et auraient menti à la première
        // rangée ajoutée.
        if (r === FILET_HAUT || r === FILET_BAS) cls.push('t-ligne-but');
        if (r === MI_GLACE) cls.push('t-centre');
        if (r === FILET_HAUT + PORTEE_TIR + 1) cls.push('t-bleue');
        if (r === FILET_BAS - PORTEE_TIR - 1) cls.push('t-bleue-bas');
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
      const o = estFilet(r, c) ? null : offre(r, c);
      const piece = surLaGlace(m).find(x => x.r === r && x.c === c);
      const jouable = piece && piece.eq === 'A' && aMoi() && !attente && aDesOptions(piece);
      cel.classList.toggle('t-offre', !!o);
      for (const t of ['deplacer', 'passe', 'echec', 'dejouer']) {
        cel.classList.toggle(`t-offre-${t}`, !!o && (o.type === t || (t === 'echec' && (o.type === 'duel' || o.type === 'vol'))));
      }
      cel.classList.toggle('t-jouable', !!jouable);
      cel.classList.toggle('t-sel', !!piece && piece === sel);
      // LE RAYON ADVERSE (S38) se voit sur la glace : une case couverte est
      // ombrée, deux bâtons dessus plus sombre. C'est là qu'une passe se coupe
      // et que le porteur patine au double du prix.
      const couv = piece ? 0 : couvreurs(m, 'A', r, c).length;
      cel.classList.toggle('t-rayon', couv === 1);
      cel.classList.toggle('t-rayon-2', couv >= 2);
      cel.tabIndex = (o || jouable) ? 0 : -1;
      // L'étiquette : la cote du geste que cette case propose.
      const marque = cel.querySelector('.t-marque');
      marque.textContent = !o || !o.duel ? '' : cote(o.duel);
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
      const etat = x.gardien ? 'frais' : etatSouffle(m, x);
      const air = etat === 'vide' ? '<span class="t-vide-air" title="Vidé : deux cases de moins, un de moins à tous ses jets, plus d\'épaule">😮‍💨</span>'
        : etat === 'fatigue' ? '<span class="t-vide-air t-fatigue-air" title="Fatigué : une case de patin en moins">💨</span>' : '';
      const dedans = `<span class="t-role">${role}</span><span class="t-nom">${nom}</span>${rond}${air}`;
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
  // Le naturel qui a tranché, s'il y en a un : un 6 gagne, un 1 perd, des deux côtés.
  const naturel = j => (j.de === 6 && j.de2 !== 6 ? ' · 6 naturel' : j.de === 1 && j.de2 !== 1 ? ' · 1 naturel'
    : j.opp && j.de2 === 6 && j.de !== 6 ? ' · son 6' : j.opp && j.de2 === 1 && j.de !== 1 ? ' · son 1' : '');
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
        <span class="t-dg-calcul">${signe(j.mod)} = <b>${j.total}</b><i>${j.opp ? `c. ${j.de2} ${signe(j.mod2)} = ${j.total2}` : `c. ${j.total2}`}</i></span>
        <span class="t-dg-mot">${esc(MOT_JET[j.quoi] || 'Jet')}${j.relance ? ' · relance' : ''}${naturel(j)}</span>
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
    degage:     ['AU FOND', 'froid', 'cible'],
    dejoue:     ['FEINTÉ !', 'chaud', 'cible'],
    bataille:   ['GAGNÉE !', 'chaud', 'cible'],
    punition:   ['PUNITION', 'rouge', 'defaut'],
  };

  function verdict(avant, ou, quoi = null, delai = 0) {
    const neufs = m.fil.slice(0, Math.max(0, m.fil.length - avant)).reverse();
    sonner(neufs.map(e => e.genre), quoi, delai);
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

  /*
   * LE SON SUIT LE VERDICT, IL NE LE DEVINE PAS. Même lecture du fil que le
   * verdict — du plus ancien au plus neuf — et un son par genre qui en a un
   * (`SON_DU_GENRE`). Le GESTE joue d'abord (la lame d'un tir, le patin,
   * le bâton qui se pose), puis ce que le moteur en a dit, dans l'ordre :
   * un tir suivi d'un arrêt, c'est le claquement puis le coup mat dans la
   * jambière ; suivi d'un but, c'est le claquement puis la sirène. La mise
   * au jeu qui suit un but se tait : la sirène couvre tout. Les deux camps
   * passent par ici, comme pour le verdict — un but adverse sonne pareil.
   */
  const SON_DU_GENRE = {
    but: 'but', retour: 'retour', arret: 'arret', echec: 'echec', vol: 'vol', rate: 'rate',
    revirement: 'revirement', degage: 'degage', mj: 'mj', fin: 'fin', periode: 'periode',
    dejoue: 'patin', changement: 'tap', bataille: 'vol', punition: 'periode',
  };
  const PAS_SON = { tir: 0.22, patin: 0.12, passe: 0.1, echec: 0.28, arret: 0.2, retour: 0.25, vol: 0.15, rate: 0.15, degage: 0.45, mj: 0.1, periode: 0.5, fin: 2, but: 1.6, revirement: 0.2, tap: 0.08 };
  function sonner(genres, quoi, delai = 0) {
    let d = delai;
    if (quoi === 'tir') { jouerSon('tir', d); d += PAS_SON.tir; }
    else if (quoi === 'patin' || quoi === 'esquive' || quoi === 'dejouer' || quoi === 'bataille') { jouerSon('patin', d); d += PAS_SON.patin; }
    const but = genres.includes('but');
    for (const g of genres) {
      // « ok » est le genre des réussites ordinaires : seule la passe reçue a un son à elle.
      const nom = g === 'ok' ? (quoi === 'passe' ? 'passe' : null) : SON_DU_GENRE[g];
      if (!nom || (g === 'mj' && but)) continue;
      jouerSon(nom, d);
      d += PAS_SON[nom] || 0.2;
    }
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
    const tete = `<div class="t-volet-tete"><span>La pièce</span><button type="button" class="t-volet-fermer" aria-label="Fermer le volet">✕</button></div>`;
    actions = { modes: [], gestes: [], aide: '' };
    if (!aMoi()) return `<div class="t-carte t-attente">${tete}L'adversaire joue sa présence…</div>`;
    if (!sel) {
      const dispo = eqDe(m, 'A').pieces.filter(aDesOptions).length;
      return dispo
        ? `<div class="t-carte t-vide">${tete}Touche une de tes pièces. ${dispo} peu${dispo > 1 ? 'vent' : 't'} encore jouer.</div>`
        : `<div class="t-carte t-vide">${tete}Plus rien à jouer cette présence-ci.</div>`;
    }
    const st = sel.st, h = sel.hab ? HABILETES[sel.hab] : null;
    const arc = ARCHETYPES[archetypeKey(sel.p)] || ARCHETYPES.UNKNOWN;
    const gab = GABARITS[st.gb], tir = TIRS[st.ts] || TIRS.P;
    const aLaRondelle = porteur(m) === sel;
    const so = souffleDe(m, sel), soMax = souffleMax(st), etat = etatSouffle(m, sel);
    const gestes = [];

    /*
     * LES MODES : un bouton par geste qui a besoin d'une cible sur la glace.
     * Chacun dit ce qu'il coûte au mieux (la meilleure cote parmi ses cibles)
     * — on choisit le geste en connaissance de cause, puis on touche où.
     */
    const modes = [];
    // La meilleure cote parmi les cibles d'un geste : le duel aux plus grandes chances.
    const meilleure = (cibles, duelDe) => (cibles.length ? cibles.map(duelDe).sort((x, y) => chancesDe(y) - chancesDe(x))[0] : null);
    const pres = aLaRondelle ? pressionDe(m, sel) : null;
    const tenue = !!pres && pres.n > 0;
    if (peutBouger(m, sel)) {
      const pas = deplacementsDe(m, sel);
      if (pas.length) {
        const sous = tenue ? pas.filter(v => esquiveRequise(m, sel, v)) : [];
        const d = sous.length ? meilleure(sous, v => avec(modEsquive(m, sel, v), bonus('PATIN'))) : null;
        modes.push(modeBouton('deplacer', tenue ? 'Esquiver' : 'Patiner', d, `${pas.length} case${pas.length > 1 ? 's' : ''}`));
      }
    }
    if (aLaRondelle && peutAgir(m, sel)) {
      const rec = receveursDe(m, sel);
      const fond = ciblesFondDe(m, sel);
      if (rec.length || fond.length) modes.push(modeBouton('passe', 'Passer', meilleure([...rec, ...fond], x => avec(modPasse(m, sel, x), x.st ? bonus('VOILEE') : 0)), fond.length ? 'ou au fond' : ''));
      // FEINTER : un défenseur collé, en un contre un.
      const dej = ciblesDejouerDe(m, sel);
      if (dej.length) modes.push(modeBouton('dejouer', 'Feinter', meilleure(dej, x => avec(modDejouer(m, sel, x), bonus('PATIN'))), 'un contre un'));
    }
    if (!aLaRondelle && peutAgir(m, sel)) {
      const adv = ciblesEchecDe(m, sel);
      if (adv.length) modes.push(modeBouton('echec', 'Frapper', meilleure(adv, x => avec(modEchec(m, sel, x), bonus('ACTIF') + bonus('EPAULE')))));
      const vol = ciblesVolDe(m, sel);
      if (vol.length) modes.push(modeBouton('vol', 'Harponner', meilleure(vol, x => avec(modVol(m, sel, x), bonus('ACTIF'))), 'la rondelle'));
    }

    // Le TIR est dans la barre d'ancrage, sous la glace (`dock`) : c'est le
    // geste qu'on cherche, il ne doit pas demander d'ouvrir le volet.
    // LE DUEL : sur le porteur adverse, frapper ou harponner.
    if (cible && peutAgir(m, sel) && dist(sel, cible) === 1) {
      if (ciblesEchecDe(m, sel).includes(cible)) gestes.push(bouton('echec', `Frapper ${nomCourt(cible.p)}`, avec(modEchec(m, sel, cible), bonus('ACTIF') + bonus('EPAULE')), 't-echec'));
      if (ciblesVolDe(m, sel).includes(cible)) gestes.push(bouton('vol', 'Harponner', avec(modVol(m, sel, cible), bonus('ACTIF')), 't-vol'));
    }

    const horsPortee = aLaRondelle && !peutTirer(m, sel);
    const prof = distanceAuFilet(m, sel);
    const AIDE_MODE = {
      deplacer: tenue ? 'Touche une case allumée : il s\'y échappe s\'il réussit son esquive.' : 'Touche une case allumée : il y patine, sans dé.',
      passe: 'Touche le coéquipier à qui passer — ou, de la zone neutre, un coin du fond : la rondelle y sera libre.',
      echec: 'Touche l\'adversaire à frapper.',
      vol: 'Touche le porteur pour le harponner.',
      dejouer: 'Touche le défenseur à feinter : battu, il est hors position jusqu\'à la fin du tour et le porteur repart libre.',
    };
    const aide = cible ? `Frapper${porteur(m) === cible ? ' ou harponner' : ''} ${nomCourt(cible.p)} ?`
      : mode ? AIDE_MODE[mode]
      : horsPortee && prof <= 0 ? 'Derrière le filet on ne tire pas : une passe vers l\'enclave vaut +1 d\'ici — le gardien ne la voit pas venir.'
      : horsPortee ? `Trop loin pour tirer : il faut entrer dans la zone offensive, à ${PORTEE_TIR} cases du filet ou moins. Il en est à ${prof}.`
      : aLaRondelle ? 'Choisis un geste, ou touche directement une case allumée ou un adversaire. Pour passer, choisis « Passer » puis le coéquipier.'
      : 'Choisis un geste, ou touche directement une case allumée ou un adversaire adjacent.';
    // LES ACTIONS VONT DANS LA BARRE DU BAS (`dock`), pas dans le volet :
    // au premier toucher d'une pièce, on peut agir sans rien ouvrir.
    actions = { modes, gestes, aide };

    return `
      <div class="t-carte">
        <div class="t-volet-tete"><span>La pièce</span><button type="button" class="t-volet-fermer" aria-label="Fermer le volet">✕</button></div>
        <div class="t-fiche">
          <span class="t-fiche-role">${esc(sel.role)}</span>
          <span class="t-fiche-nom">${esc((sel.p && sel.p.n) || 'Rappel')}</span>
          ${pres ? `<span class="t-pression ${pres.n ? 'on' : ''}" title="La pression sur la rondelle : combien de rayons adverses couvrent sa case, et le meilleur DE d'entre eux. Elle entre dans tous ses duels : un bâton, une chance ; chaque bâton de plus, −1.">Pression <b>${pres.n}</b>${pres.n ? ` <i>DE ${pres.fort}</i>` : ' <i>libre</i>'}</span>` : ''}
          <span class="t-axes">
            ${['PA', 'MA', 'TI', 'FO', 'DE'].map(k => {
              // LE TRAIT EST LE NOMBRE. On ne lui donne pas d'étiquette à lui :
              // « les icônes ne doivent jamais se répéter sur la même carte »,
              // et ⚡ comme 🛡️ sont déjà pris par l'habileté Coup de patin et
              // le geste Se placer devant. Le nombre qu'il majore porte donc sa marque, et
              // l'infobulle le nomme — le trait se lit là où il agit.
              const tr = (st.traits || {})[k];
              const T = tr && TRAITS[tr];
              return `<span class="t-axe${T ? ' majore' : ''}" title="${esc(AXE_MOT[k])}${T ? ` — ${T.icon} ${T.label} : +1` : ''}"><i>${k}</i><b>${st[k]}</b></span>`;
            }).join('')}
            <span class="t-axe t-axe-so ${etat === 'vide' ? 'vide' : etat === 'fatigue' ? 'fatigue' : ''}" title="Souffle : ${so} geste${so > 1 ? 's' : ''} sur ${soMax}. Chaque geste en coûte un. Sous la moitié, une case de patin en moins ; à zéro, deux, un de moins à tous ses jets et plus d'épaule — il faut changer de trio."><i>SO</i><b>${so}<small>/${soMax}</small></b></span>
          </span>
        </div>
        <div class="t-tags">
          <span class="t-tag" title="${esc(arc.desc)} — ce qu'il a fait cette saison-là, mesuré dans ses colonnes.">${arc.icon} ${esc(arc.short)}</span>
          <span class="t-tag" title="${esc(gab.desc)}">${gab.icon} ${esc(gab.nom)}</span>
          <span class="t-tag" title="${esc(tir.desc)}">${tir.icon} ${esc(tir.nom)}</span>
          ${h ? `<span class="t-tag ${sel.habDispo ? 'on' : 'usee'}" title="${esc(h.desc)}">${h.icon} ${esc(h.nom)}${sel.habDispo ? ' +2' : ' · utilisée'}</span>` : ''}
          ${etat === 'vide' ? '<span class="t-tag alerte" title="Il n\'a plus de souffle : change de trio, c\'est instantané et gratuit.">😮‍💨 Vidé</span>' : etat === 'fatigue' ? '<span class="t-tag" title="Sous la moitié de son souffle : une case de patin en moins.">💨 Fatigué</span>' : ''}
        </div>
      </div>`;
  }

  /* Un bouton de geste : son nom, son seuil et ses chances, comme partout. */
  const bouton = (geste, nom, d, cls = '') =>
    `<button type="button" class="t-geste ${cls}" data-geste="${geste}">${esc(nom)} <b>${cote(d)}</b><i>${esc(detail(d))}</i></button>`;
  /* Un bouton de MODE : le geste qu'on choisit avant de toucher la glace ; `mod` est la meilleure cote parmi ses cibles. */
  const modeBouton = (quoi, nom, d, note = '') =>
    `<button type="button" class="t-mode ${mode === quoi ? 'on' : ''}" data-mode="${quoi}">${esc(nom)}${d === null ? '' : ` <b>${cote(d)}</b>`}${note ? `<i>${esc(note)}</i>` : ''}</button>`;

  /* ---------- le dé ---------- */

  const MOT_JET = { tir: 'Tir', passe: 'Passe', fond: 'Au fond', echec: 'Mise en échec', esquive: 'Esquive', vol: 'Harponnage', dejouer: 'Feinte', bataille: 'Bataille pour la rondelle' };

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
  /*
   * LE CHANGEMENT EST INSTANTANÉ (S38). JP : *changement instantané de ligne
   * sur le board*. À n'importe quel moment de ta main, une fois par main,
   * gratuit ; chaque entrant prend la case du sortant. Seule l'unité qui
   * porte la rondelle ne change pas — son bouton le dit.
   */
  const peutChanger = () => aMoi() && !attente && !m.main.change;

  function unites() {
    if (!peutChanger()) return '';
    const eq = eqDe(m, 'A');
    /*
     * CHAQUE UNITÉ MONTRE SON SOUFFLE, sinon le changement est un choix
     * aveugle : on ne saurait pas laquelle est reposée, et la fatigue ne
     * serait qu'une punition. Le nombre est la moyenne de l'unité.
     */
    const souffleUnite = joueurs => {
      // En part du réservoir, ramenée sur quatre points : deux gestes par SO.
      const vals = joueurs.filter(Boolean).map(p => (eq.souffle.get(p) ?? souffleMax(statsDeTable(p))) / souffleMax(statsDeTable(p)));
      return vals.length ? Math.round(4 * vals.reduce((a, b) => a + b, 0) / vals.length) : 4;
    };
    const p = porteur(m);
    const porteRole = p && p.eq === 'A' ? p.role : null;
    const trio = i => uniteDe(eq.roster, i, 0).slice(0, 3).map(x => x.p);
    const paire = i => uniteDe(eq.roster, 0, i).slice(3).map(x => x.p);
    const seg = (quoi, n, mot, courant, joueursDe) => `<span class="t-seg" data-u="${quoi}">${
      [...Array(n).keys()].map(i => {
        const so = souffleUnite(joueursDe(i));
        const tient = porteRole && (quoi === 'tri' ? ['AG', 'C', 'AD'] : ['DG', 'DD']).includes(porteRole) && courant !== i;
        return `<button type="button" data-v="${i}" class="${courant === i ? 'on' : ''} ${so <= 0 ? 'vide' : ''}" ${tient ? 'disabled' : ''}
          title="${tient ? 'On ne change pas l\'unité qui porte la rondelle' : `Souffle de l'unité : ${so} sur 4`}">${i + 1}<sup>${i ? 'e' : mot === 'trio' ? 'er' : 're'}</sup> ${mot}<em>${'●'.repeat(Math.min(4, Math.max(0, so)))}${'○'.repeat(Math.max(0, 4 - so))}</em></button>`;
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

  /* ---------- la feuille du match ----------
   *
   * LE MOTEUR COMPTAIT TOUT, ET L'ÉCRAN JETAIT TOUT. À la fin d'un match, le
   * seul bouton allait droit à `fermer()` : jamais de marqueurs, de passeurs,
   * d'arrêts, de mises en échec. `resultatDe` expose pourtant trois blocs par
   * équipe — `marqueurs`, `physique` et `gardien` — et DEUX d'entre eux
   * n'étaient lus par aucune ligne de l'interface, seulement par
   * `check_table.mjs`.
   *
   * Les trois étoiles pèsent comme celles de l'entracte (3 par but, 2 par
   * passe) pour que le jeu parle une seule langue ; le gardien compte ses
   * arrêts moins ce qu'il a laissé passer, parce qu'un match de plateau se
   * joue à huit lancers et qu'un pourcentage n'y veut rien dire.
   */
  // Les blocs de `resultatDe` portent le JOUEUR, pas son nom : `nomDe` attend
  // une pièce et non un joueur, et `esc(nomJ(x.p))` rendait « [object Object] ».
  const nomJ = j => (j && j.n) || 'Rappel';

  function etoilesDuMatch(r) {
    const gens = [];
    for (const [f, eq] of [[r.A, A], [r.B, B]]) {
      const phys = new Map((f.physique || []).map(x => [x.p, x]));
      for (const x of f.marqueurs) {
        const e = phys.get(x.p) || { echecs: 0, vols: 0 };
        gens.push({ nom: nomJ(x.p), tag: eq.tag, note: x.buts * 3 + x.passes * 2,
          quoi: [x.buts ? `${x.buts} but${x.buts > 1 ? 's' : ''}` : '', x.passes ? `${x.passes} passe${x.passes > 1 ? 's' : ''}` : '',
            e.echecs ? `${e.echecs} en échec` : ''].filter(Boolean).join(', ') });
      }
      const g = f.gardien;
      if (g && (g.arrets || g.alloues)) {
        gens.push({ nom: nomJ(g.p), tag: eq.tag, note: g.arrets - g.alloues,
          quoi: `${g.arrets} arrêt${g.arrets > 1 ? 's' : ''} sur ${g.arrets + g.alloues}` });
      }
    }
    return gens.filter(x => x.note > 0).sort((x, y) => y.note - x.note).slice(0, 3);
  }

  function feuilleHtml() {
    const r = resultatDe(m);
    const gagne = r.gfA === r.gfB ? null : (r.gfA > r.gfB ? 'A' : 'B');
    const cote = (f, eq, c) => {
      const marque = f.marqueurs.slice().sort((x, y) => y.buts - x.buts || y.passes - x.passes);
      const phys = (f.physique || []).slice().sort((x, y) => (y.echecs + y.vols) - (x.echecs + x.vols));
      const g = f.gardien;
      return `<section class="tf-cote ${gagne === c ? 'gagne' : ''}">
        <h4>${logo(eq.tag, 18)} ${esc(eq.nom)} <b>${f.buts}</b></h4>
        <div class="tf-chiffres">
          <span><b>${f.tirs}</b> lancers</span>
          <span><b>${f.echecs}</b> mises en échec</span>
          <span><b>${f.revirements}</b> revirements</span>
          <span><b>${f.punitions || 0}</b> punition${f.punitions > 1 ? 's' : ''}</span>
        </div>
        <div class="tf-bloc"><h5>Au tableau</h5>${marque.length
          ? `<table class="tf-table"><tbody>${marque.map(x => `<tr><td class="tf-nom">${esc(nomJ(x.p))}</td><td>${x.buts || '—'}</td><td>${x.passes || '—'}</td></tr>`).join('')}</tbody></table>`
          : '<div class="tf-rien">Aucun but.</div>'}</div>
        <div class="tf-bloc"><h5>Le travail sans la rondelle</h5>${phys.length
          ? `<table class="tf-table"><tbody>${phys.map(x => `<tr><td class="tf-nom">${esc(nomJ(x.p))}</td><td>${x.echecs || '—'}</td><td>${x.vols || '—'}</td></tr>`).join('')}</tbody></table>`
          : '<div class="tf-rien">Personne n\'a touché à personne.</div>'}</div>
        <div class="tf-bloc"><h5>Devant le filet</h5>
          <div class="tf-gardien">${esc(nomJ(g.p))} — <b>${g.arrets}</b> arrêt${g.arrets > 1 ? 's' : ''} sur ${g.arrets + g.alloues}</div>
        </div>
      </section>`;
    };
    const etoiles = etoilesDuMatch(r);
    return `<div class="t-feuille">
      <div class="t-feuille-tete">
        <h3>Feuille de match</h3>
        <button type="button" class="t-feuille-suite t-evident">Continuer</button>
      </div>
      ${etoiles.length ? `<div class="tf-etoiles">${etoiles.map((x, i) => `
        <div class="tf-etoile"><span class="tf-rang">${'★'.repeat(i + 1)}</span>
          <span class="tf-etoile-nom">${logo(x.tag, 14)} ${esc(x.nom)}</span>
          <span class="tf-etoile-quoi">${esc(x.quoi)}</span></div>`).join('')}</div>` : ''}
      <div class="tf-cotes">${cote(r.A, A, 'A')}${cote(r.B, B, 'B')}</div>
    </div>`;
  }

  /* ---------- le fil ---------- */
  const fil = () => `<div class="t-fil">${m.fil.slice(0, 7).map(e =>
    `<div class="t-evt t-evt-${e.genre}">${esc(e.texte)}</div>`).join('')}</div>`;

  /* ---------- le rendu ---------- */
  function rendre() {
    // Le volet des règles couvre le match ; le plateau se CACHE, il ne se
    // vide pas — la grille est bâtie une fois et les pièces glissent dessus.
    $('.t-tete').hidden = regles;
    // La feuille garde le TABLEAU INDICATEUR : c'est le pointage final qu'on
    // vient de lire, et le reprendre dans la feuille le dirait deux fois.
    $('.t-plateau').hidden = regles || feuille;
    // Les règles et la feuille prennent tout le bas : le volet ne glisse pas, il est là.
    $('.t-dock').hidden = regles || feuille;
    $('.t-bas').classList.toggle('plein', regles || feuille);
    if (regles) { $('.t-bas').innerHTML = reglesHtml(); return; }
    veillerButs();
    $('.t-tete').innerHTML = tete() + banniere();
    if (feuille) { $('.t-bas').innerHTML = feuilleHtml(); return; }
    if (!grilleFaite) batirGlace();
    majGlace();
    // LE VOLET : la fiche de la pièce, le banc des trios et le fil, au
    // deuxième clic. JP : *flyout carte du joueur avec les actions, stats,
    // etc., pour avoir moins d'infos visible ; ça peut être boutons dans le
    // bas, stats au deuxième clic, trouver ce qui est le mieux*. Les ACTIONS
    // sont dans la barre du bas dès le premier toucher (on agit sans rien
    // ouvrir), les STATS dans le volet. Sur téléphone il glisse par-dessus
    // le bas de la glace et se ferme dès qu'on touche la glace ; sur grand
    // écran il est la colonne de droite, toujours ouverte (feuille de style).
    const fiche = carte();                    // calcule aussi `actions`, que `dock` lit
    $('.t-dock').innerHTML = dock();
    $('.t-bas').classList.toggle('ouvert', volet);
    $('.t-bas').innerHTML = unites() + fiche + fil();
  }

  /*
   * LA BARRE D'ANCRAGE, sous la glace : ce qu'il faut avoir sous le pouce
   * sans ouvrir le volet. La décision d'un jet (relance ou accepter), la
   * pièce choisie et son TIR (le geste qu'on cherche), le bouton du volet,
   * et la fin de l'activation ou de la présence. Rien d'autre : le reste est
   * dans le volet.
   */
  function dock() {
    if (m.fini) return '<button type="button" class="t-resultat t-evident">Voir le résultat</button>';
    if (attente) return de();
    if (!aMoi()) return `<span class="t-dock-nom t-dock-attente">${esc(B.nom)} joue… <i>touche la glace pour accélérer</i></span>`;
    const dispo = eqDe(m, 'A').pieces.filter(aDesOptions).length;
    // La ligne du haut : qui est choisi (ou, en mode, ce qu'il reste à
    // toucher), le bouton du volet, la fin. Le mode ou le duel en cours
    // remplace le nom par la consigne : c'est ce qu'il faut lire à ce moment.
    const nom = !sel ? `<span class="t-dock-nom t-dock-vide">${dispo ? `Touche une de tes pièces <i>${dispo} peu${dispo > 1 ? 'vent' : 't'} jouer</i>` : 'Plus rien à jouer'}</span>`
      : (mode || cible) ? `<span class="t-dock-nom t-dock-aide">${esc(actions.aide)}</span>`
      : `<span class="t-dock-nom"><b class="t-fiche-role">${esc(sel.role)}</b> ${esc(nomCourt(sel.p))}</span>`;
    let tir = '';
    // LE TIR SUR RÉCEPTION (S35) prend la place du tir : la passe vient de
    // réussir, le receveur tire tout de suite, qu'il ait déjà joué ou non.
    if (sel && receptionPossible(m) === sel) {
      tir = bouton('reception', 'Tir sur réception', avec(modTir(m, sel), bonus('DECOCHE')), 't-tir');
    } else if (sel && porteur(m) === sel && peutAgir(m, sel) && peutTirer(m, sel)) {
      tir = bouton('tir', 'Tirer', avec(modTir(m, sel), bonus('DECOCHE')), 't-tir');
    }
    // LE BUDGET DE LA MAIN (S36) : un déplacement, une action — ce qui est
    // dépensé s'éteint. « Fin du tour » rend la main sans dépenser le reste ;
    // « Finir » renonce à toute la présence.
    const entamee = m.main.bouge || m.main.agi;
    const budget = `<span class="t-budget" title="À ta main : un patin, une action, et un placement — un deuxième déplacement réservé à un joueur SANS la rondelle. Puis la sienne, et c'est un tour."><i class="${m.main.bouge ? 'fait' : ''}">Patin</i><i class="${m.main.agi ? 'fait' : ''}">Action</i><i class="${m.main.place ? 'fait' : ''}">Place</i></span>`;
    const fin = entamee
      ? `<button type="button" class="t-fin-tour t-evident" title="Rendre la main sans dépenser ce qui reste">Passer la main</button>`
      : `<button type="button" class="t-passer" title="Ne rien jouer cette main-ci : l'adversaire joue la sienne.">Passer</button>`;
    const ouvre = `<button type="button" class="t-volet-btn" aria-expanded="${volet ? 'true' : 'false'}" title="${sel ? 'La fiche de la pièce, le banc et le fil' : 'Le banc des trios et le fil'}">${sel ? 'Fiche' : 'Banc'} <i>${volet ? '▾' : '▴'}</i></button>`;
    // La rangée des actions : le tir d'abord, puis les modes (un geste à
    // cible), puis les gestes sans cible. Elle se balaie si elle déborde.
    const rangee = sel ? `<div class="t-dock-actions">${tir}${actions.modes.join('')}${actions.gestes.join('')}</div>` : '';
    return `<div class="t-dock-ligne">${nom}${budget}${ouvre}${fin}</div>${rangee}`;
  }

  /* La bannière d'un but : elle passe une seconde sur le tableau indicateur. */
  const banniere = () => (eclat
    ? `<div class="t-eclat t-eclat-${eclat.eq}">BUT ! <span>${esc(eclat.texte)}</span></div>` : '');

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
    jouerSon('de');
    rendre();
  }

  function resoudre() {
    if (!attente) return;
    const { jet, appliquer, ou } = attente;
    attente = null;
    cible = null;
    mode = null;
    deGlace = null;
    const avant = m.fil.length;
    appliquer(jet);
    verdict(avant, ou, jet.quoi);
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
    if (!aMoi()) { sel = null; mode = null; return; }
    // La pièce activée reste choisie tant qu'elle joue.
    const rec = receptionPossible(m);
    if (rec && rec.eq === 'A') { sel = rec; return; }
    if (sel && !aDesOptions(sel)) { sel = null; mode = null; }
    if (!sel) {
      const p = porteur(m);
      if (p && p.eq === 'A' && !p.gardien && aDesOptions(p)) sel = p;
    }
  }

  /* Après chaque geste : si la présence a changé de camp, l'adversaire joue. */
  function apres() {
    // Le budget de la main vide — ou plus rien à en faire — la main passe…
    // sauf si une passe vient d'ouvrir le une-deux : le receveur décide.
    if (!m.fini && m.tour === 'A' && !receptionPossible(m) && !eqDe(m, 'A').pieces.some(aDesOptions)) { deGlace = null; finirMain(m); }
    choisirSeul();
    rendre();
    if (!m.fini && m.tour === 'B' && !iaEnCours) tourAdverse();
  }

  function agir(o) {
    if (o.type === 'duel') { cible = o.cible; rendre(); return; }
    activer(m, sel);
    if (o.type === 'deplacer') {
      const piece = sel, vers = o.vers, ou = placesDe(piece, null), avant = m.fil.length;
      const d = deplacer(m, piece, vers);
      // Patiner d'une case libre ne demande pas de dé : le geste est déjà
      // joué, il ne reste qu'à dire ce que le moteur en a fait.
      if (!d.jet) { verdict(avant, ou, 'patin'); apres(); return; }
      if (d.bataille) { lancer(d.jet, 'A', j => appliquerBataille(m, piece, vers, j), placesDe(piece, vers)); return; }
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
      return;
    }
    if (o.type === 'vol') {
      const piece = sel, cible = o.cible;
      lancer(voler(m, piece, cible), 'A', j => appliquerVol(m, piece, cible, j), placesDe(piece, cible));
      return;
    }
    if (o.type === 'dejouer') {
      const piece = sel, cible = o.cible;
      lancer(dejouer(m, piece, cible), 'A', j => appliquerDejouer(m, piece, cible, j), placesDe(piece, cible));
      return;
    }
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
  const PAUSE_SEC = 520;    // un geste sans dé : écran, bâton tendu

  function tourAdverse() {
    iaEnCours = true;
    sel = null; cible = null; volet = false;
    const cote = m.tour;
    let garde = 0;

    const fin = () => {
      // Le garde-fou doit quand même rendre la main : sans ça, une activation
      // qui tourne en rond gèlerait le match sur le tour de l'adversaire.
      if (!m.fini && m.tour === cote) renoncer(m);
      dernier = null; deGlace = null;
      avancerIA = null;
      iaEnCours = false;
      choisirSeul();
      rendre();
      if (!m.fini && m.tour === 'B') tourAdverse();
    };

    const pas = () => {
      clearTimeout(minuteurIA);
      // En alternance, l'adversaire enchaîne plusieurs activations quand il
      // ne me reste plus de pièce : la boucle continue tant que la main est
      // à lui, avec un garde-fou sur le tour entier (cinq pièces).
      if (m.fini || m.tour !== cote || garde++ >= GESTES_MAX * 6) { fin(); return; }
      const avant = m.fil.length;
      const joue = iaGeste(m);
      if (!joue) {                          // l'activation a fini d'elle-même
        if (!m.fini && m.tour === cote) { minuteurIA = setTimeout(pas, 200); return; }
        fin(); return;
      }
      dernier = { piece: joue.piece, cible: joue.cible || null };
      // Le dé de l'adversaire tombe sur SA case, comme le tien sur la tienne,
      // et son verdict éclate au même endroit que le tien l'aurait fait.
      deGlace = joue.jet ? { jet: joue.jet, cote, r: joue.piece.r, c: joue.piece.c, n: ++noJet } : null;
      // Son dé roule aussi, et ses sons suivent le jet — le geste est déjà
      // joué, on le fait seulement entendre au rythme où on le lit.
      if (joue.jet) jouerSon('de');
      verdict(avant, placesDe(joue.piece, joue.cible || null), joue.jet ? joue.jet.quoi : (joue.type === 'deplacer' ? 'patin' : joue.type), joue.jet ? 0.3 : 0);
      rendre();
      minuteurIA = setTimeout(pas, joue.jet ? PAUSE_DE : PAUSE_SEC);
    };
    // ON PEUT SAUTER L'ATTENTE. JP : *skip automatique de message quand on
    // clique*. Un clic sur le plateau pendant la présence adverse joue le
    // geste suivant tout de suite ; rien n'est joué autrement, on regarde
    // juste plus vite.
    avancerIA = pas;
    minuteurIA = setTimeout(pas, 320);
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
  /* Le bouton du son, dans la barre du haut : il coupe et rallume l'option. */
  function majBoutonSon() {
    const b = $('.table-son');
    if (!b) return;
    const on = sonsActifs();
    b.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#${on ? 'i-son' : 'i-muet'}"/></svg>`;
    b.title = on ? 'Couper les sons' : 'Remettre les sons';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  majBoutonSon();

  modal.onclick = ev => {
    const t = ev.target;
    if (t.closest('.table-son')) { if (ctx.basculerSons) ctx.basculerSons(); majBoutonSon(); if (sonsActifs()) jouerSon('tap'); return; }
    if (t.closest('.table-regles')) { regles = !regles; rendre(); return; }
    if (t.closest('.t-regles-fermer')) { regles = false; rendre(); return; }
    if (regles) return;                       // le volet des règles couvre tout
    /*
     * « Voir le résultat » ouvre la feuille ; c'est « Continuer » qui ferme.
     * Le bouton de la feuille porte sa PROPRE classe : `.t-suite` est déjà
     * celui qui accepte un jet de dé, et le lui emprunter faisait fermer le
     * match à chaque confirmation — le test de fumée l'a attrapé en une
     * exécution.
     */
    if (t.closest('.t-resultat')) { feuille = true; rendre(); return; }
    if (t.closest('.t-volet-btn')) { volet = !volet; rendre(); return; }
    if (t.closest('.t-volet-fermer')) { volet = false; rendre(); return; }
    if (t.closest('.t-feuille-suite') || t.closest('.table-close')) { fermer(); return; }
    // Pendant la présence adverse, un clic saute l'attente du geste suivant.
    if (iaEnCours) { if (avancerIA) avancerIA(); return; }
    if (t.closest('.t-relancer')) { attente.jet = relancer(m, attente.jet, 'A'); deGlace = { ...deGlace, jet: attente.jet, n: ++noJet }; rendre(); return; }
    if (t.closest('.t-suite')) { resoudre(); return; }
    /*
     * LE VERDICT SE SAUTE EN CLIQUANT AILLEURS. JP : *skip automatique de
     * message quand on clique après action réussie ou non*. Un jet en attente
     * bloquait tout jusqu'à « Continuer » ; maintenant, toucher la glace ou
     * un geste ACCEPTE le jet (sans relance) et continue avec ce qu'on a
     * touché — si la main est encore à nous. Seule la glace poursuit le clic :
     * ses cases sont stables, alors qu'un bouton de geste appartenait à la
     * pièce d'AVANT le verdict.
     */
    const surLaGlaceOuUnGeste = t.closest('.t-case') || t.closest('[data-geste]') || t.closest('[data-mode]') || t.closest('.t-passer');
    if (attente && surLaGlaceOuUnGeste) {
      const versLaGlace = t.closest('.t-case');
      resoudre();
      if (!versLaGlace || !aMoi() || attente) return;
    }
    const caseGlace = t.closest('.t-case');
    if (caseGlace && aMoi() && !attente) {
      volet = false;                          // toucher la glace referme le volet
      const r = +caseGlace.dataset.r, c = +caseGlace.dataset.c;
      const o = offre(r, c);
      if (o) { agir(o); return; }
      const piece = surLaGlace(m).find(x => x.r === r && x.c === c);
      if (piece && piece.eq === 'A' && !piece.gardien && aDesOptions(piece)) { sel = piece === sel ? null : piece; cible = null; mode = null; rendre(); }
      return;
    }
    const bMode = t.closest('[data-mode]');
    if (bMode && sel && aMoi() && !attente) {
      mode = mode === bMode.dataset.mode ? null : bMode.dataset.mode;
      cible = null;
      volet = false;                          // le mode choisi, on retourne à la glace
      rendre();
      return;
    }
    const geste = t.closest('[data-geste]');
    if (geste && sel && aMoi() && !attente) {
      const piece = sel, quoi = geste.dataset.geste, vise = cible;
      mode = null;
      volet = false;
      activer(m, piece);
      if (quoi === 'tir') lancer(tirer(m, piece), 'A', j => appliquerTir(m, piece, j), placesDe(piece, null));
      else if (quoi === 'echec' && vise) { cible = null; lancer(mettreEnEchec(m, piece, vise), 'A', j => appliquerEchec(m, piece, vise, j), placesDe(piece, vise)); }
      else if (quoi === 'vol' && vise) { cible = null; lancer(voler(m, piece, vise), 'A', j => appliquerVol(m, piece, vise, j), placesDe(piece, vise)); }
      else if (quoi === 'reception') { const j = tirerSurReception(m); if (j) lancer(j, 'A', jj => appliquerTir(m, piece, jj), placesDe(piece, null)); else rendre(); }
      return;
    }
    if (t.closest('.t-fin-tour')) { sel = null; cible = null; mode = null; deGlace = null; finirMain(m); apres(); return; }
    if (t.closest('.t-passer')) { sel = null; cible = null; mode = null; deGlace = null; flash = null; renoncer(m); apres(); return; }
    const uni = t.closest('.t-seg button');
    if (uni) {
      const quoi = uni.parentElement.dataset.u, v = +uni.dataset.v;
      changerUnite(m, 'A', quoi === 'tri' ? v : A.tri, quoi === 'pai' ? v : A.pai);
      jouerSon('tap');
      volet = false;
      sel = null; cible = null; choisirSeul(); rendre();
      return;
    }
  };

  function fermer() {
    // Fermer avant la fin, c'est laisser jouer le reste : le match compte au
    // classement, on ne peut pas s'en sauver.
    let garde = 0;
    while (!m.fini && garde++ < 4000) iaPresence(m);
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
