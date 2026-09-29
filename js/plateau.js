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
  COLS, RANGS, BUT_COL, MI_GLACE, FILET_HAUT, FILET_BAS, estFilet, POSSESSIONS_PAR_PERIODE, POSSESSIONS_PROLONGATION, chancesDe, avec, ecartDuel,
  HABILETES, GABARITS, TIRS, nouveauMatch, surLaGlace, eqDe, porteur, libre, peutJouer,
  deplacementsDe, cheminVers, receveursDe, enCourse, ciblesEchecDe, ciblesVolDe, ciblesFondDe, natureCase, dist, 
  modTir, modPasse, modEchec, modEsquive, modVol, esquiveRequise, peutTirer, distanceAuFilet, PORTEE_TIR,
  deplacer, appliquerEsquive, passer, appliquerPasse, tirer, appliquerTir,
  mettreEnEchec, appliquerEchec, voler, appliquerVol,
  souffleDe, essouffle, uniteDe, statsDeTable, AXE_MOT,
  ciblesDejouerDe, modDejouer, dejouer, appliquerDejouer,
  receptionPossible, tirerSurReception,
  relancer, activer, finirMain, renoncer, iaPresence, iaGeste, GESTES_MAX, resultatDe, gagnantDuMatch, changerUnite, reglesDuPlateau,
  peutBouger, peutAgir, souffleMax, etatSouffle, couvreurs, pressionDe, PAS_PAR_MAIN, pasRestants, porteeDe,
  enPositionHorsJeu, POINTS_MJ, MJ_CENTRE, MJ_FOND,
  bataillePossible, modBataille, appliquerBataille, enJeu,
  peutRetirerGardien, retirerGardien, expliquerGeste,
} from './table.js';
import { archetypeKey, ARCHETYPES } from './ratings.js';
import { TRAITS } from './traits.js';
import { jouerSon, sonsActifs } from './sons.js';
import { ouvrirChoix } from './gerant.js';
import { ordF as ordP } from './util.js';

/* Les demis d'un budget de pas, écrits en pas : 9 demis, c'est « 4½ ». */
const demisEnPas = n => (n % 2 ? `${(n - 1) / 2}½` : `${n / 2}`);
const nomCourt = p => {
  const n = (p && p.n) || 'Rappel';
  const bouts = n.split(' ');
  return bouts.length > 1 ? bouts[bouts.length - 1] : n;
};
/*
 * TROIS LETTRES, COMME À LA TÉLÉ (S75). Dans une case de 26 px, le nom se
 * coupait à deux lettres et des points de suspension — « Sa… », « Sn… » :
 * personne ne se lit. Les diffusions de hockey ont réglé ça depuis
 * longtemps : trois capitales (SAN, SNO). Le nom entier revient dès que la
 * case est assez large (`t-etroite`, mesurée sur la glace).
 */
const nomTrois = p => {
  const n = nomCourt(p);
  return (n.replace(/[^\p{L}]/gu, '') || n).slice(0, 3).toUpperCase();
};

/* Deux couleurs « #rrggbb » : leur écart perçu (CIE76, dans Lab), et leur mélange. */
const rvb = h => { const x = String(h).replace('#', ''); const y = x.length === 3 ? x.split('').map(c => c + c).join('') : x; return [0, 2, 4].map(i => parseInt(y.slice(i, i + 2), 16) || 0); };
function lab(h) {
  const [r, g, b] = rvb(h).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const ecartCouleur = (a, b) => { const [x, y] = [lab(a), lab(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const melange = (a, b, t) => `#${rvb(a).map((v, i) => Math.round(v * (1 - t) + rvb(b)[i] * t).toString(16).padStart(2, '0')).join('')}`;

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

  /*
   * RECRUE OU PRO (S75) : la tête de l'IA d'en face, choisie aux options ou à
   * l'écran du tournoi. Recrue par défaut — voir `NIVEAU_RECRUE_MOTS` (js/table.js)
   * pour ce qui change, et ce qui ne change pas : les règles et les dés.
   */
  const niveau = ctx.niveau ? ctx.niveau() : 'PRO';
  const m = nouveauMatch(A, B, graine, { recrue: niveau === 'RECRUE' ? 'B' : null });
  // LA COUTURE DES ESSAIS (S75b) : `smoke_table` amène un match jusqu'aux tirs de barrage avant
  // de l'ouvrir, pour vérifier qu'ils se VOIENT. Le jeu ne la passe jamais.
  if (typeof ctx.preparer === 'function') ctx.preparer(m);
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
  let minuteurEclat = 0;
  /*
   * LA LIGNE DU DÉPLACEMENT (S44). JP : *ajouter « ligne » qui montre
   * déplacement*. Deux moments, un seul trait. `survol` est l'APERÇU : la
   * route vers la case qu'on pointe, avant de s'engager — elle n'existe que
   * sur un écran qui a un curseur, puisqu'un doigt ne survole rien. `trace`
   * est la route qu'on VIENT de patiner, qui reste une seconde : c'est ce
   * qui la donne au téléphone, où toucher une case la joue sur-le-champ.
   * Les deux comptent, parce que 40 % des routes font un coude (mesuré sur
   * 181 179) : le jeton glisse en ligne droite, la route, non.
   */
  /*
   * LA RONDELLE VOYAGE ÉTAPE PAR ÉTAPE (S74). JP : *la puck se teleporte*.
   * L'écran posait le jeton sur la case FINALE d'un geste et laissait la
   * transition le faire glisser en ligne droite : un arrêt suivi de la
   * relance du gardien devenait un seul glissement du tireur jusqu'à un
   * ailier, sans passer par le filet ; un but glissait du tireur au point de
   * mise au jeu. Le moteur tient maintenant le trajet (`m.trajet`, une étape
   * par règle) et l'écran le JOUE : la passe traverse, le tir va au filet,
   * le retour sort du gardien, le patin suit sa route, et le sifflet fige la
   * glace le temps de dire pourquoi avant que tout le monde se replace.
   *
   * `pilotes` est ce que la lecture impose en ce moment (clé de jeton ou
   * « rondelle » → case, durée du pas) ; `photo` est la glace au sifflet,
   * que les pièces gardent jusqu'à la remise en place. Tout le reste suit le
   * moteur, comme avant.
   */
  let trajetLu = m.trajet.length;   // les étapes que l'écran a déjà jouées (la mise au jeu d'ouverture est déjà là)
  let patinVu = m.patin || null;     // le dernier patin déjà joué à l'écran
  const pilotes = new Map();
  let photo = null;
  let coupDeSifflet = null;          // { r, c, mot, ou, n } — le sifflet, posé sur le point de mise au jeu
  let fileLecture = [];              // les pas qui restent à jouer : { duree, faire }
  let minuteurLecture = 0;
  let minuteurSifflet = 0;
  let finLecture = 0;                // l'heure où la lecture en cours sera jouée
  let flashAuBut = null;             // le verdict, retenu jusqu'à ce que la rondelle arrive
  /*
   * TOUCHER POUR ACCÉLÉRER JOUE LA SUITE PLUS VITE, IL NE LA SAUTE PAS (S75).
   * Le toucher vidait la lecture d'un coup (`vider`) : la rondelle et les dix
   * pièces glissaient en ligne droite de neuf à seize cases, et la
   * téléportation revenait par la porte d'en arrière — le passage du testeur
   * l'a vu à chaque match. Le premier toucher joue les pas qui restent QUATRE
   * fois plus vite, dans le même ordre et par les mêmes cases ; le second les
   * pose sans glisser (`sansTransition`) : un saut franc se lit comme un saut,
   * un glissement en travers de la glace se lit comme un geste qui n'a pas
   * eu lieu. Pendant la main adverse, l'accéléré tient jusqu'à ce que la
   * main revienne (`presse`) : on a demandé d'aller plus vite, pas d'aller
   * plus vite une fois.
   */
  const VITE = 4;
  let vitesse = 1;
  let presse = false;
  let sansTransition = false;
  let pasCourant = null;             // { duree, depart, attend } — le pas qui se joue en ce moment
  let enPause = false;               // S75b : la question du ✕ est ouverte, rien n'avance
  const reprise = { lecture: false, ia: null };   // ce qui attend la fin de la pause
  /*
   * CE QUE L'ÉCRAN A MONTRÉ, PAS CE QUE LE MOTEUR SAIT DÉJÀ (S75). Le moteur
   * joue un geste d'un coup ; l'écran le raconte ensuite, le dé puis la
   * rondelle. Le pointage, la bannière du but et le fil lisaient le MOTEUR :
   * le but était au tableau pendant que le dé roulait encore et que la
   * rondelle n'avait pas quitté la palette. `vu` est ce qui a été montré :
   * le pointage monte quand la rondelle ARRIVE (là où éclate le verdict), le
   * reste — le fil, la période, la fin du match — quand la lecture finit.
   */
  const vu = { A: A.buts, B: B.buts, fil: m.fil.length, fini: m.fini, periode: m.periode, prolongation: m.prolongation, possessions: m.possessions };
  let survol = null;       // { chemin, demis } — l'aperçu sous le curseur
  let trace = null;        // { chemin } — le patin qui vient d'être joué
  let minuteurTrace = 0;
  const auCurseur = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  /*
   * POURQUOI TA MAIN VIENT DE FINIR. JP : *je comprends définitivement pas
   * comment se jouent les mains*. La main finit de trois façons — tu la
   * passes, il ne reste rien à dépenser, un jet raté avec la rondelle te la
   * coûte — et l'écran n'en disait aucune : la glace passait à l'adversaire
   * sans un mot, et on ne savait pas si on avait fini ou été puni. Le mot se
   * lit dans la barre d'ancrage pendant SA main, là où on regarde à ce
   * moment-là, et il s'efface quand la main revient.
   */
  let finDeMain = null;
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
  /*
   * DEUX MARINES, ET L'ADVERSAIRE PASSE EN BLANC (S75). Le passage du testeur
   * a joué Tampa contre Québec et la Floride contre Toronto : dix jetons
   * marine sur la même glace, et on ne savait plus qui était qui. Quand les
   * deux aplats sont trop proches (écart ΔE76 sous `PROCHES` ; mesuré sur les
   * 47 clubs : Floride-Toronto 16, Tampa-Québec 19, Toronto-Québec 23, les
   * Kings noirs contre un marine 27), l'adversaire porte ses couleurs comme
   * on les porte à l'étranger : un jeton clair, la couleur du club en encre
   * et en contour. On ne change pas la couleur du club, on change de chandail.
   */
  const PROCHES = 30;
  const chandailClair = ecartCouleur(bA.bg, bB.bg) < PROCHES;
  const pB = chandailClair ? { bg: melange(bB.bg, '#ffffff', 0.86), ink: bB.bg } : bB;
  const lB = chandailClair ? bB.bg : vB;
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
      // DEUX PUNIS TIENNENT AU TABLEAU (S46) : le cinq contre trois se lit.
      for (const pen of eq.penalites) {
        const qui = pen.p ? nomCourt(pen.p) : pen.role;
        // En prolongation la punie reste à trois ; c'est l'autre qui ajoute un patineur (S75b).
        const n = m.prolongation ? 3 : 5 - eq.penalites.length;
        out.push(`<span class="tb-cachot" title="${esc(eq.nom)} joue à ${n} : ${esc(qui)} est au cachot pour ${pen.tours} tour${pen.tours > 1 ? 's' : ''}. Un but marqué contre l'équipe punie libère le premier.">⚠ ${esc(qui)} · ${pen.tours}</span>`);
      }
    }
    return out.join('');
  }

  /* ---------- le tableau indicateur ---------- */
  function tete() {
    // LE TEMPO EN POSSESSIONS (S41) : la sirène sonne à la fin du tour de la dernière (S74 : le
    // texte disait « au premier arrêt de jeu », ce que le moteur n'a jamais fait).
    // Le tableau dit ce que l'écran a MONTRÉ (`vu`, S75), jamais ce que le moteur sait déjà.
    const total = vu.prolongation ? POSSESSIONS_PROLONGATION : POSSESSIONS_PAR_PERIODE;
    const restant = Math.max(0, total - vu.possessions);
    const periode = vu.fini && m.fusillade ? 'Tirs de barrage'
      : vu.prolongation ? `Prolongation ${vu.prolongation > 1 ? vu.prolongation : ''}`.trim()
      : `${ordP(vu.periode)} période`;
    return `
      <div class="tb-score">
        <div class="tb-eq tb-a"><span class="tb-logo">${logo(A.tag, 22)}</span><span class="tb-nom">${esc(A.nom)}</span><b>${vu.A}</b></div>
        <div class="tb-milieu">
          <span class="tb-periode">${esc(periode)}</span>
          <span class="tb-presence" title="Une période, c'est ${total} possessions : la sirène sonne à la fin du tour où la rondelle change de camp pour la ${total}e fois.">${vu.fini ? 'Terminé' : `${restant} possession${restant > 1 ? 's' : ''}`}</span>
        </div>
        <div class="tb-eq tb-b"><b>${vu.B}</b><span class="tb-nom">${esc(B.nom)}</span><span class="tb-logo">${logo(B.tag, 22)}</span></div>
      </div>
      <div class="tb-etat">
        ${(() => {
          // Avec une pastille de punition, la ligne se dit court (S75b) : « À TOI : UN PATIN ET UNE … » se coupait.
          const puni = A.penalites.length || B.penalites.length;
          const mot = vu.fini ? 'Match terminé' : aMoi() ? (puni ? 'À toi' : PAS_PAR_MAIN > 0 ? `À toi : ${PAS_PAR_MAIN} pas et une action` : 'À toi : un patin et une action')
            : puni ? `${esc(B.tag)} joue` : `${esc(B.nom)} joue sa main`;
          return `<span class="tb-tour ${aMoi() ? 'mien' : ''}">${mot}</span>`;
        })()}
        ${cachot()}
        <span class="tb-relance ${A.relance ? 'on' : ''}" title="Une relance d'équipe par période : on la dépense après avoir vu le dé.">🎲 Relance ${A.relance ? 'disponible' : 'dépensée'}</span>
      </div>`;
  }

  /* ---------- la glace ---------- */

  /* Ce qu'une case propose à la pièce choisie : rien, patiner, passer, échec. */
  function offre(r, c) {
    // Rien ne s'offre pendant la lecture (S74) : la glace qu'on voit n'est pas encore celle du moteur.
    if (!sel || !enJeu(m, sel) || !aMoi() || attente || enLecture()) return null;
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
        /*
         * LA COTE DU DUEL EST CELLE D'UN GESTE QU'ON PEUT JOUER (S75). Elle
         * lisait toujours l'épaule : un ailier qui venait de patiner — le
         * bâton seul lui reste — voyait « 42 % » sur le porteur, puis
         * « Harponner 28 % » dans la barre. C'est la meilleure des deux,
         * parmi celles qui sont offertes.
         */
        if (porte && !mode) {
          const offerts = [peutFrapper && avec(modEchec(m, sel, piece), bonus('ACTIF') + bonus('EPAULE')),
            peutVoler && avec(modVol(m, sel, piece), bonus('ACTIF'))].filter(Boolean);
          return offerts.length
            ? { type: 'duel', cible: piece, duel: offerts.sort((x, y) => chancesDe(y) - chancesDe(x))[0] }
            : null;
        }
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
    /*
     * LES POINTS VIENNENT DU MOTEUR (S45). Ils étaient dessinés ici, à leurs
     * propres coordonnées, et le moteur les ignorait : de la décoration. Il
     * les porte maintenant (`POINTS_MJ`), parce qu'une mise au jeu se joue
     * SUR une case — et la patinoire les lit, au centre de leur case. Deux
     * définitions d'un même point auraient divergé à la première retouche
     * de géométrie.
     */
    const marque = (pt, cercle) => `
      ${cercle ? `<circle class="t-rk-cercle" cx="${f(pt.c + 0.5)}" cy="${f(pt.r + 0.5)}" r="1.05"/>` : ''}
      <circle class="t-rk-point" cx="${f(pt.c + 0.5)}" cy="${f(pt.r + 0.5)}" r="${cercle ? 0.11 : 0.1}"/>`;
    const points = POINTS_MJ.filter(pt => pt !== MJ_CENTRE)
      .map(pt => marque(pt, MJ_FOND.includes(pt.r))).join('');
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
      <circle class="t-rk-cercle t-rk-cercle-centre" cx="${f(MJ_CENTRE.c + 0.5)}" cy="${f(MJ_CENTRE.r + 0.5)}" r="1.3"/>
      <circle class="t-rk-point t-rk-point-centre" cx="${f(MJ_CENTRE.c + 0.5)}" cy="${f(MJ_CENTRE.r + 0.5)}" r="0.12"/>
      ${points}
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
        html += `<button type="button" class="${cls.join(' ')}" data-r="${r}" data-c="${c}"><span class="t-marque"></span><span class="t-risque"></span></button>`;
      }
    }
    // LA LIGNE se dessine dans les mêmes unités que la patinoire (une case
    // vaut 1), donc elle suit la géométrie du moteur sans rien coder en dur.
    html += `<svg class="t-trace" viewBox="0 0 ${COLS} ${RANGS}" preserveAspectRatio="none" aria-hidden="true"></svg>`;
    html += '<div class="t-pieces" aria-hidden="true"></div>';
    html += '<div class="t-rondelle-libre-jeton" hidden></div>';
    // Les cotes posées SUR une pièce (S75) : au-dessus du jeton, jamais dessous.
    html += '<div class="t-cotes" aria-hidden="true"></div>';
    // Le dé et le verdict vivent SUR la glace, posés sur la case du geste.
    html += '<div class="t-cmd" hidden></div>';
    html += '<div class="t-de-glace" role="status" hidden></div>';
    html += '<div class="t-flash" role="status" aria-live="polite" hidden></div>';
    // Le sifflet : sur le point de mise au jeu, le mot de l'arbitre (S74).
    html += '<div class="t-sifflet" role="status" aria-live="polite" hidden></div>';
    // Les tirs de barrage, rejoués tireur par tireur sur la glace (S75b).
    html += '<div class="t-barrage" role="status" hidden></div>';
    html += '</div>';
    $('.t-plateau').innerHTML = html;
    grilleFaite = true;
    // Une case étroite porte trois lettres au lieu du nom coupé (S75) : c'est la case DESSINÉE qui décide.
    const grille = $('.t-glace');
    const mesurer = () => grille.classList.toggle('t-etroite', grille.offsetWidth / COLS < 38);
    mesurer();
    if (typeof ResizeObserver === 'function') new ResizeObserver(mesurer).observe(grille);
  }

  /* Toutes les pièces à dessiner, gardiens compris, avec leur clé stable. */
  /* UN GARDIEN RETIRÉ N'EST PLUS SUR LA GLACE (S46) : le filet est vide, et
     ça doit se VOIR — c'est toute l'information du moment. */
  const jetons = () => [
    ...surLaGlace(m).map(x => [`${x.eq}-${x.role}`, x]),
    ...(A.piece_g.sorti ? [] : [['A-G', A.piece_g]]),
    ...(B.piece_g.sorti ? [] : [['B-G', B.piece_g]]),
  ];

  /*
   * LE TRAIT : une polyligne qui passe par le CENTRE de chaque case de la
   * route, plus un point de départ et une pointe à l'arrivée. L'aperçu est
   * pointillé (rien n'est joué), la trace du patin joué est pleine et
   * s'efface. On ne dessine jamais une route d'une seule case : d'un voisin
   * à l'autre, la ligne droite ne dit rien que la case n'a pas déjà dit.
   */
  function majTrace() {
    const svg = $('.t-trace');
    if (!svg) return;
    const quoi = trace ? { chemin: trace.chemin, cls: 'jouee' } : survol ? { chemin: survol.chemin, cls: 'apercu' } : null;
    const dedans = !quoi || quoi.chemin.length < 3 ? '' : (() => {
      const pts = quoi.chemin.map(x => `${x.c + 0.5},${x.r + 0.5}`).join(' ');
      const d = quoi.chemin[0], f = quoi.chemin[quoi.chemin.length - 1];
      // UN LISERÉ SOUS LE TRAIT : la route croise la glace BLANCHE et les
      // pastilles SOMBRES des prix, et un seul trait se perd sur l'une ou
      // sur l'autre. Le liseré est de la couleur de la glace, donc il ne
      // dit rien — il fait seulement que le trait existe partout.
      return `<polyline class="t-trace-liseré ${quoi.cls}" points="${pts}"/>`
        + `<polyline class="t-trace-ligne ${quoi.cls}" points="${pts}"/>`
        + `<circle class="t-trace-bout ${quoi.cls}" cx="${d.c + 0.5}" cy="${d.r + 0.5}" r="0.13"/>`
        + `<circle class="t-trace-fin ${quoi.cls}" cx="${f.c + 0.5}" cy="${f.r + 0.5}" r="0.2"/>`;
    })();
    if (svg.dataset.contenu !== dedans) { svg.innerHTML = dedans; svg.dataset.contenu = dedans; }
  }

  /* La route qu'on vient de patiner reste le temps de la suivre des yeux. */
  function montrerTrace(chemin) {
    survol = null;
    trace = chemin && chemin.length > 2 ? { chemin } : null;
    clearTimeout(minuteurTrace);
    if (trace) minuteurTrace = setTimeout(() => { trace = null; if (!regles) majTrace(); }, 1100);
  }

  function majGlace() {
    if (!grilleFaite) batirGlace();
    const l = libre(m), p = porteur(m);
    const grille = $('.t-glace');

    /*
     * LE FOND, C'EST UNE ZONE, PAS VINGT CIBLES (S75). En mode « Passer »,
     * chaque case du fond portait son « 83 % » — une vingtaine d'étiquettes
     * identiques, coupées sur deux lignes dans des cases de 26 px, et la
     * glace devenait illisible. La zone garde son contour ; UNE case porte la
     * cote : la meilleure, et à égalité la plus proche du centre, derrière le
     * filet si elle est libre.
     */
    let fondCote = null;
    if (mode === 'passe' && sel && enJeu(m, sel) && porteur(m) === sel && aMoi() && !attente && !enLecture() && peutAgir(m, sel)) {
      const but = eqDe(m, 'A').but;
      const fonds = ciblesFondDe(m, sel).map(v => ({ v, ch: chancesDe(modPasse(m, sel, v)) }));
      fonds.sort((x, y) => y.ch - x.ch || Math.abs(x.v.c - BUT_COL) - Math.abs(y.v.c - BUT_COL) || Math.abs(x.v.r - but) - Math.abs(y.v.r - but));
      if (fonds.length) fondCote = fonds[0].v;
    }
    const cotesSurPiece = [];

    // 1. Les cases : ce qu'elles PROPOSENT à la pièce choisie.
    for (const cel of grille.querySelectorAll('.t-case')) {
      const r = +cel.dataset.r, c = +cel.dataset.c;
      const o = estFilet(r, c) ? null : offre(r, c);
      const piece = surLaGlace(m).find(x => x.r === r && x.c === c);
      const jouable = piece && piece.eq === 'A' && aMoi() && !attente && !enLecture() && aDesOptions(piece);
      cel.classList.toggle('t-offre', !!o);
      for (const t of ['deplacer', 'passe', 'echec', 'dejouer']) {
        cel.classList.toggle(`t-offre-${t}`, !!o && (o.type === t || (t === 'echec' && (o.type === 'duel' || o.type === 'vol'))));
      }
      cel.classList.toggle('t-jouable', !!jouable);
      // Pendant la lecture, rien n'est choisi (S74) : rien ne peut se jouer, la carte est fermée.
      cel.classList.toggle('t-sel', !!piece && piece === sel && !enLecture());
      // LE RAYON ADVERSE (S38) se voit sur la glace : une case couverte est
      // ombrée, deux bâtons dessus plus sombre. C'est là qu'une passe se coupe
      // et que le porteur patine au double du prix.
      const couv = piece ? 0 : couvreurs(m, 'A', r, c).length;
      cel.classList.toggle('t-rayon', couv === 1);
      cel.classList.toggle('t-rayon-2', couv >= 2);
      cel.tabIndex = (o || jouable) ? 0 : -1;
      /*
       * DEUX ÉTIQUETTES, ET CHACUNE DIT UNE SEULE CHOSE (S43). JP : *nombre
       * de cases de déplacement clairement indiqué*. La case d'un patin
       * n'écrivait RIEN tant qu'aucun dé n'y pendait : on voyait où on
       * pouvait aller, jamais ce que ça coûtait — et le budget de la main se
       * compte en pas (« 4½/6 »), pas en cases allumées. Le PRIX est donc
       * écrit en haut à gauche de chaque case, en pas comme la pastille du
       * budget (une diagonale en vaut un et demi), et le RISQUE — la cote
       * d'un duel : esquive, bataille, passe, contact — en bas à droite, où
       * il était. Deux coins, jamais l'un sur l'autre : une case de 26 px
       * n'en porte pas deux au centre. Une case verte sans chiffre en bas
       * est une case où rien ne peut mal tourner.
       */
      const marque = cel.querySelector('.t-marque');
      const prix = o && o.type === 'deplacer' && o.vers ? demisEnPas(o.vers.demis) : '';
      marque.textContent = prix;
      marque.className = `t-marque${prix ? ' t-pas' : ''}`;
      /*
       * SUR UNE PIÈCE, LA COTE PASSE AU-DESSUS DU JETON (S75). Le coin bas de
       * la case est SOUS le jeton — la couche des pièces est par-dessus la
       * grille — donc la chance d'une passe au coéquipier, d'une feinte ou
       * d'un contact ne se lisait pas. Elle va dans sa propre couche
       * (`.t-cotes`), posée sur le haut du jeton.
       */
      const risque = cel.querySelector('.t-risque');
      const auFond = o && o.type === 'passe' && !o.cible.st;
      let texte = !o || !o.duel ? '' : cote(o.duel);
      if (auFond) texte = fondCote && fondCote.r === r && fondCote.c === c ? `au fond ${texte}` : '';
      if (texte && piece) { cotesSurPiece.push({ r, c, texte }); texte = ''; }
      risque.textContent = texte;
    }
    const coucheCotes = grille.querySelector('.t-cotes');
    /*
     * ET ELLE NE COUVRE PAS LA PIÈCE D'AU-DESSUS (S75b). Posée sur le haut du
     * jeton, elle mordait un tiers de la pièce de la rangée d'au-dessus (sept
     * écrans de passe sur trente-cinq, mesuré). Elle se met au-dessus quand la
     * case d'au-dessus est libre, sinon au-dessous, sinon sur le bas du jeton.
     */
    const occupe = (rr, cc) => rr < 0 || rr >= RANGS || jetons().some(([, x]) => x.r === rr && x.c === cc);
    const cotesHtml = cotesSurPiece.map(x => {
      const ou = !occupe(x.r - 1, x.c) ? '' : !occupe(x.r + 1, x.c) ? ' dessous' : ' dedans';
      return `<span class="t-cote-piece${ou}" style="--tr:${x.r};--tc:${x.c}">${esc(x.texte)}</span>`;
    }).join('');
    if (coucheCotes && coucheCotes.dataset.contenu !== cotesHtml) { coucheCotes.innerHTML = cotesHtml; coucheCotes.dataset.contenu = cotesHtml; }

    majTrace();

    /*
     * 2. LA RONDELLE NE SE TÉLÉPORTE PAS (S45). JP : *genre pas de puck qui
     * se téléporte lol*. Le jeton n'existait QUE libre : une passe, un tir,
     * un dégagement la faisaient disparaître d'une case et reparaître à
     * l'autre bout, sans rien traverser. Il est maintenant TOUJOURS là, posé
     * sur la case de la rondelle — portée ou libre — donc la transition CSS
     * la fait voyager d'elle-même, comme elle fait glisser les pièces. Le
     * point d'or ne s'allume que quand elle est libre : c'est l'état qui
     * change, pas l'objet. Seul un SIFFLET a le droit de la reposer ailleurs
     * d'un coup (`.saute`), parce que là c'est l'arbitre qui la pose.
     */
    /*
     * ET LE SIFFLET N'EST PLUS UN SAUT MUET (S74). `.saute` reposait la
     * rondelle d'un coup à chaque arrêt de jeu, mais le compteur qu'il lisait
     * (`m.arrets`) ignorait le but et la fin de période — la rondelle y
     * GLISSAIT du tireur jusqu'au point du centre. C'est la lecture du
     * trajet qui décide maintenant où est le jeton, à chaque instant ; hors
     * lecture, il est là où le trajet l'a laissé (`m.ici` : au fond du filet
     * après le but qui finit le match).
     */
    const jeton = grille.querySelector('.t-rondelle-libre-jeton');
    const pilote = pilotes.get('rondelle');
    const pos = pilote || m.ici || (l || (p ? { r: p.r, c: p.c } : null));
    // Le second toucher pose tout sans glisser (S75) : la position est prise, pas animée.
    const coupe = sansTransition;
    sansTransition = false;
    const glisse = ms => (coupe ? 'none' : ms ? `transform ${Math.round(ms / vitesse)}ms linear` : '');
    jeton.hidden = !pos;
    jeton.classList.toggle('libre', pilote ? !!pilote.libre : !!l);
    rondelleLibreVue = jeton.classList.contains('libre');
    jeton.classList.toggle('saute', !!(pilote && pilote.saute));
    jeton.style.transition = glisse(pilote && pilote.ms);
    /*
     * LE POINT DU PORTEUR SUIT LA RONDELLE QU'ON VOIT (S75). Il lisait le
     * porteur du MOTEUR : pendant que la glace restait figée au sifflet, il
     * sautait déjà sur le centre qui allait gagner la mise au jeu. Pendant
     * une lecture, il va à la pièce MONTRÉE sur la case de la rondelle
     * montrée, si quelqu'un la tient (`tenue`) — le gardien qui l'a gelée,
     * le porteur pris hors-jeu —, et à personne pendant qu'elle voyage.
     */
    const tenueVue = pilote ? (pilote.tenue ? pilote : null) : p;
    if (pos) {
      jeton.style.setProperty('--tr', pos.r);
      jeton.style.setProperty('--tc', pos.c);
    }

    // 3. Les pièces : on DÉPLACE les éléments, on ne les recrée pas.
    const couche = grille.querySelector('.t-pieces');
    const vues = new Set();
    for (const [cle, x] of jetons()) {
      vues.add(cle);
      let el = couche.querySelector(`[data-jeton="${cle}"]`);
      if (!el) {
        el = document.createElement('div');
        el.dataset.jeton = cle;
        // UNE PIÈCE QUI ENTRE, ENTRE (S74) : le puni qui sort du cachot, le
        // sixième patineur, le trio de la prolongation. Elle apparaissait
        // d'un coup au centre de la glace ; elle s'y pose maintenant, et
        // l'attribut survit aux classes que chaque rendu réécrit.
        el.dataset.neuf = '1';
        // Retiré après, sinon l'entrée rejouerait chaque fois qu'une autre animation (`.visee`) la quitte.
        setTimeout(() => { delete el.dataset.neuf; }, 450);
        el.className = 't-jeton';
        couche.appendChild(el);
      }
      const b = x.eq === 'A' ? bA : pB;
      // La lecture d'abord (le patin le long de sa route), puis la photo du
      // sifflet, puis le moteur : la pièce n'est jamais montrée là où elle
      // n'est pas encore arrivée.
      const ici = pilotes.get(cle) || (photo && photo[cle]) || x;
      el.style.transition = glisse(pilotes.get(cle) && pilotes.get(cle).ms);
      el.style.setProperty('--tr', ici.r);
      el.style.setProperty('--tc', ici.c);
      el.style.setProperty('--pf', b.bg);
      el.style.setProperty('--pi', b.ink);
      el.style.setProperty('--pl', x.eq === 'A' ? vA : lB);
      /*
       * LE HORS-JEU SE VOIT AVANT DE SE SIFFLER (S45). Une pièce qui devance
       * la rondelle est en position de hors-jeu : elle porte sa marque, et
       * la rondelle qui entre derrière elle est un sifflet. Sans ça, la
       * règle ne se lit qu'au moment où elle coûte quelque chose.
       */
      const horsJeuIci = !x.gardien && enPositionHorsJeu(m, x);
      const jouableIci = x.eq === 'A' && !x.gardien && aMoi() && !attente && !enLecture() && aDesOptions(x);
      el.className = `t-jeton t-piece ${x.eq === 'A' ? 'mienne' : 'sienne'}`
        + (x.gardien ? ' gardien' : '') + (x.etourdi ? ' etourdi' : '')
        + (jouableIci ? ' jouable' : '')
        + (x === sel && !enLecture() ? ' choisie' : '')
        + (dernier && dernier.piece === x ? ' agit' : '')
        + (dernier && dernier.cible === x ? ' visee' : '')
        + (horsJeuIci ? ' horsjeu' : '');
      const nom = `<span class="t-nom-long">${esc(nomCourt(x.p))}</span><span class="t-nom-court">${esc(nomTrois(x.p))}</span>`;
      const role = x.gardien ? 'G' : esc(x.role);
      const rond = tenueVue && ici.r === tenueVue.r && ici.c === tenueVue.c ? '<span class="t-rondelle" aria-label="a la rondelle"></span>' : '';
      const etat = x.gardien ? 'frais' : etatSouffle(m, x);
      const air = etat === 'vide' ? '<span class="t-vide-air" title="Vidé : deux cases de moins, un de moins à tous ses jets, plus d\'épaule">😮‍💨</span>'
        : etat === 'fatigue' ? '<span class="t-vide-air t-fatigue-air" title="Fatigué : une case de patin en moins">💨</span>' : '';
      const hj = horsJeuIci ? '<span class="t-hj" title="En position de hors-jeu : elle devance la rondelle. Si la rondelle entre en zone maintenant, c\'est un sifflet.">⚑</span>' : '';
      const dedans = `<span class="t-role">${role}</span><span class="t-nom">${nom}</span>${rond}${air}${hj}`;
      if (el.dataset.contenu !== dedans) { el.innerHTML = dedans; el.dataset.contenu = dedans; }
    }
    for (const el of couche.querySelectorAll('[data-jeton]')) {
      if (!vues.has(el.dataset.jeton)) el.remove();
    }
    // Sans transition, la nouvelle case doit être PRISE avant que le rendu suivant rende la transition : on force le calcul.
    if (coupe) void grille.offsetWidth;

    // 4. Le dé, posé sur la case du geste, et le verdict qui suit.
    /*
     * LA CARTE DE COMMANDES, À LA FFT (S45). JP : *surtout, quand on clique
     * sur le gars, popup à la fft ?* — et, juste avant : *je sais pas
     * toujours ce que je peux faire pour vrai*. Les deux ont la même
     * réponse. Les gestes vivaient dans une barre au bas de l'écran, loin de
     * la pièce, et seuls les JOUABLES y paraissaient : un geste absent
     * pouvait aussi bien ne pas exister qu'être refusé. Ils sont maintenant
     * À CÔTÉ DU GARS, tous les six, dans le même ordre à chaque fois, chacun
     * avec sa cote ou sa raison. On lit ce qu'on peut faire là où on
     * regarde. `poserSurGlace` la pose comme le dé, avec les mêmes trois
     * ancrages, donc elle ne sort jamais du plateau.
     */
    poserSurGlace(grille.querySelector('.t-cmd'), commandes(), () => actions.carte, ancrerCarte);
    poserSurGlace(grille.querySelector('.t-de-glace'), deGlace, deGlaceHtml);
    poserSurGlace(grille.querySelector('.t-flash'), flash, flashHtml);
    poserSurGlace(grille.querySelector('.t-sifflet'), coupDeSifflet, siffletHtml);
    // LA FUSILLADE SE VOIT (S75b) : dès que la fin du match est montrée.
    const barrage = grille.querySelector('.t-barrage');
    if (barrage) {
      const voir = !!(vu.fini && m.fusillade);
      barrage.hidden = !voir;
      if (voir && !barrage.dataset.fait) { barrage.innerHTML = barrageHtml(); barrage.dataset.fait = '1'; }
    }
  }

  /*
   * LE DÉ NE COUVRE PAS CE QU'IL VISE (S75). Il se pose au-dessus de la case
   * du geste, donc sur les rangées d'au-dessus — et c'est souvent là qu'est
   * la cible d'un duel : on frappait un ailier qu'on ne voyait plus. Quand la
   * cible est dans les deux rangées d'au-dessus, à trois colonnes près (la
   * largeur de la boîte), le dé se pose dessous — sauf tout en bas de la
   * glace, où dessous n'existe pas.
   */
  const dessousDe = (ici, vise) => ici.r <= 1
    || (!!vise && ici.r < RANGS - 2 && vise.r < ici.r && ici.r - vise.r <= 2 && Math.abs(vise.c - ici.c) <= 3);

  /*
   * LA BOÎTE NE SORT PAS DE LA GLACE, ET C'EST MESURÉ (S75). Trois ancrages
   * choisis par la colonne (`bord-g` jusqu'à la deuxième, `bord-d` dès
   * l'onzième) ne suffisaient pas : un dé de 170 px centré sur la dixième
   * colonne sortait encore à droite et se faisait couper — le testeur l'a
   * vu. On pose la boîte, on lit où le navigateur l'a mise, et on la ramène
   * dans la glace (`--dx`) : c'est ce qui est DESSINÉ qui décide, comme pour
   * la carte de commandes.
   */
  function garderDedans(el) {
    const boite = el.firstElementChild;
    if (!boite) return;
    /*
     * La LARGEUR DE MISE EN PAGE, pas le rectangle dessiné : l'animation
     * d'entrée part à 60 % de sa taille (le verdict) ou à 90 % (le dé), donc
     * le rectangle lu à l'insertion est trop petit — « AU FOND » sortait
     * encore à gauche. Les trois boîtes sont CENTRÉES sur leur case : leurs
     * bords se déduisent du centre de la case et de `offsetWidth`, que ni
     * `transform` ni `scale` ne touchent.
     */
    const g = el.parentElement.getBoundingClientRect(), cel = el.getBoundingClientRect();
    const w = boite.offsetWidth;
    if (!w) return;
    const cx = cel.left + cel.width / 2, marge = 3;
    const gauche = cx - w / 2, droite = cx + w / 2;
    const dx = gauche - marge < g.left ? g.left + marge - gauche : droite + marge > g.right ? g.right - marge - droite : 0;
    el.style.setProperty('--dx', `${Math.round(dx)}px`);
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

  /* Où poser la carte de commandes : sur la pièce choisie, et nulle part
     sinon — pendant un jet, un mode ou la main adverse, elle se retire. */
  /*
   * ELLE SE FERME QUAND ON A CHOISI. Comme dans FFT : le menu s'ouvre sur la
   * pièce, on prend une commande, il se retire et la glace est à nouveau
   * entière — sinon la carte couvre justement les cases qu'il faut toucher,
   * et la consigne de la barre du bas dit déjà quoi viser.
   */
  /*
   * ET LE DUEL N'EST PAS UNE COMMANDE, C'EST UNE DÉCISION (S46). S45 a
   * déménagé les gestes de la barre du bas vers cette carte ET l'a fermée
   * sur `cible` : le duel — qui n'existe QUE quand une cible est choisie —
   * s'est retrouvé sans nulle part où s'afficher. La barre annonçait
   * « Frapper ou harponner Vaive ? » au-dessus de ZÉRO bouton, et frapper
   * comme harponner sont devenus impossibles pour tout le monde.
   * `smoke_table` a tourné 3 689 fois sur la même case avant de le dire.
   * L'ouvrir sur `cible` ne marche pas non plus — mesuré : elle couvre les
   * cases qu'il reste à toucher, et c'est pour ça qu'elle se ferme. Le duel
   * va donc où vont les décisions, dans la BARRE, à côté du dé : c'est le
   * panneau de confirmation de FFT, pas son menu de commandes.
   */
  const commandes = () => (sel && aMoi() && !attente && !regles && !mode && !cible && !enLecture() && actions.carte ? { r: sel.r, c: sel.c } : null);

  /* Poser une chose sur une case, ou la cacher. `html(x)` en fait le contenu. */
  function poserSurGlace(el, x, html, ancrer = null) {
    if (!el) return;
    el.hidden = !x;
    if (!x) { el.dataset.cle = ''; el.innerHTML = ''; return; }
    el.style.setProperty('--tr', x.r);
    el.style.setProperty('--tc', x.c);
    /*
     * ON NE SORT JAMAIS DE LA GLACE. La rangée du haut n'a rien au-dessus
     * d'elle : la boîte s'y pose dessous (ou là où la chose le demande,
     * `x.dessous`). Sur les côtés, c'est la mesure qui décide (`garderDedans`).
     */
    el.classList.toggle('dessous', x.dessous ?? x.r <= 1);
    const cle = html(x, true);
    const neuf = el.dataset.cle !== cle;
    if (neuf) { el.dataset.cle = cle; el.innerHTML = html(x); }
    // L'ancrage MESURÉ vient après le contenu : la taille de la boîte en dépend.
    if (ancrer) ancrer(el);
    else if (neuf) garderDedans(el);
  }

  /*
   * LA CARTE NE COUVRE JAMAIS UNE PIÈCE QU'ON PEUT ENCORE TOUCHER.
   *
   * Mesuré à 390 px : posée à côté de la pièce, elle fait 168 px sur 221 —
   * cinq colonnes et sept rangées d'un plateau de treize sur vingt-trois — et
   * comme les cinq patineurs partent groupés, elle en couvrait QUATRE. La
   * couche des pièces est en `pointer-events: none` pour que le clic atteigne
   * la case dessous, donc un jeton sous la carte n'est plus touchable du
   * tout : on ne peut même plus choisir un autre joueur. JP : *les menus sont
   * fucked*. Les adversaires, eux, ne comptent pas — la carte se ferme dès
   * qu'on choisit un mode, et c'est par le mode qu'on les vise.
   *
   * L'ancrage est MESURÉ, pas déduit : on essaie les quatre côtés, on lit le
   * rectangle que le navigateur a vraiment donné, et on garde celui qui sort
   * le moins du plateau et couvre le moins de pièces jouables. Refaire le
   * calcul en JavaScript doublerait la formule de la feuille de style, donc
   * elle dériverait ; c'est ce qui est DESSINÉ qui décide.
   */
  // S75b : centrée au-dessus ou au-dessous de la pièce, les deux derniers recours — à la mise au jeu au centre,
  // la carte à droite couvrait l'AD et le DD, à gauche l'AG et le DG, et au-dessus des côtés elle sortait de la glace.
  const ANCRAGES = ['', 'dessus', 'dessous', 'bord-d', 'bord-d dessus', 'bord-d dessous', 'centre dessus', 'centre dessous'];
  const chevauche = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

  function ancrerCarte(el) {
    const plateau = el.parentElement.getBoundingClientRect();
    const jouables = [...el.parentElement.querySelectorAll('.t-piece.jouable')].map(x => x.getBoundingClientRect());
    /*
     * LA RONDELLE LIBRE ET LE VERDICT NE SE COUVRENT PAS (S75b). Après un
     * retour ou un revirement, la carte s'ouvrait sur ta pièce et cachait la
     * rondelle libre — en disant « la rondelle est libre » par-dessus elle.
     * C'est ce qu'on vient de regarder, et ce qu'on veut aller chercher :
     * les couvrir coûte cinquante fois une pièce.
     */
    const interdits = [el.parentElement.querySelector('.t-rondelle-libre-jeton.libre:not([hidden])'),
      el.parentElement.querySelector('.t-flash:not([hidden]) .t-flash-mot')].filter(Boolean).map(x => x.getBoundingClientRect());
    let meilleur = null;
    for (const a of ANCRAGES) {
      el.className = a ? `t-cmd ${a}` : 't-cmd';
      const r = el.getBoundingClientRect();
      const dehors = Math.max(0, plateau.left - r.left) + Math.max(0, r.right - plateau.right)
        + Math.max(0, plateau.top - r.top) + Math.max(0, r.bottom - plateau.bottom);
      // Sortir du plateau est rédhibitoire ; couvrir une pièce est un coût.
      const score = dehors * 10000 + interdits.reduce((s, p) => s + 50 * chevauche(r, p), 0) + jouables.reduce((s, p) => s + chevauche(r, p), 0);
      if (!meilleur || score < meilleur.score) meilleur = { a, score };
      if (!score) break;
    }
    el.className = meilleur.a ? `t-cmd ${meilleur.a}` : 't-cmd';
  }

  /*
   * LES SIX FACES DÉFILENT, PUIS LE DÉ S'ARRÊTE. Le tambour est un ruban de
   * six chiffres qu'une animation CSS fait passer derrière une fenêtre de la
   * taille d'un chiffre ; il se fige sur la face tirée. Aucune minuterie en
   * JavaScript : l'animation part toute seule quand l'élément est écrit, et
   * `prefers-reduced-motion` la coupe sans rien casser — le bon chiffre est
   * déjà à la bonne place.
   */
  /*
   * LE DÉ SE LIT COMME UN MATCH, PAS COMME UNE ÉQUATION (S75). Il disait
   * « +8 = 10 c. 1 +8 = 9 · son 1 » : le passage du testeur l'a appelé du
   * jargon, et un enfant n'y lit rien. Il dit maintenant qui contre qui —
   * « Toi 10 contre 9 », « MTL 8 contre toi 11 », « Toi 7 · il faut 4 » —
   * puis le geste et son verdict. Le détail des modificateurs reste sur la
   * cote du geste, AVANT de s'engager, là où il sert à décider.
   *
   * ET QUAND LE DÉ CONTREDIT LES TOTAUX, IL DIT POURQUOI. Une passe à 9
   * contre 3 qui rate sur un 1 lisait « RATÉ » sans un mot : c'est la règle
   * (un 1 naturel perd, un 6 naturel gagne, des deux côtés), mais une règle
   * qui ne se dit pas au moment où elle frappe ressemble à un bogue. La
   * ligne dit donc « 1 naturel : raté » exactement quand le naturel a
   * renversé les totaux, et « égalité » quand les totaux étaient égaux.
   */
  const parLesTotaux = j => (j.rondelle ? j.total >= j.total2 : j.total > j.total2);
  /*
   * ET LE DÉ ADVERSE SE LIT DE TON CÔTÉ (S75b). Le jet de l'adversaire
   * disait « WSH 6 contre toi 6 · Bataille · 1 d'en face : réussi », en
   * vert : une mauvaise nouvelle pour toi, écrite et colorée comme une
   * bonne. Son jet dit maintenant ce qu'IL fait — « il passe », « il
   * rate » — et le naturel qui a tranché est « ton 1 » ou « son 6 » ; la
   * couleur est la tienne : vert quand ça t'arrange, rouge sinon.
   */
  const REUSSITE_SIENNE = { tir: 'il marque', passe: 'il passe', fond: 'il passe', esquive: 'il passe', dejouer: 'il passe', echec: 'il frappe', vol: 'il te la prend', bataille: 'il gagne' };
  function motDuJet(j, moi = true) {
    const ok = moi ? (j.reussi ? 'réussi' : 'raté') : (j.reussi ? REUSSITE_SIENNE[j.quoi] || 'il réussit' : 'il rate');
    const sien = moi ? 'naturel' : 'son';
    const tien = moi ? 'd\'en face' : 'ton';
    if (parLesTotaux(j) !== j.reussi) {
      // Le naturel qui a tranché : celui qui lance d'abord, sinon celui d'en face.
      if (j.de === 6 && j.reussi) return moi ? `6 naturel : ${ok}` : `${sien} 6 : ${ok}`;
      if (j.de === 1 && !j.reussi) return moi ? `1 naturel : ${ok}` : `${sien} 1 : ${ok}`;
      if (j.opp && j.de2 === 6 && !j.reussi) return moi ? `6 ${tien} : ${ok}` : `${tien} 6 : ${ok}`;
      if (j.opp && j.de2 === 1 && j.reussi) return moi ? `1 ${tien} : ${ok}` : `${tien} 1 : ${ok}`;
    }
    if (j.opp && j.total === j.total2) return `égalité : ${ok}`;
    return ok;
  }
  function deGlaceHtml(d, cleSeule) {
    const j = d.jet;
    if (cleSeule) return `${d.n}`;
    // Le tambour porte TROIS fois les six faces : l'animation le fait défiler
    // du premier bloc jusqu'à la bonne face du troisième, donc douze à
    // dix-sept chiffres passent avant qu'il s'arrête. Avec un seul bloc, il
    // n'y aurait rien à faire défiler.
    const faces = [0, 1, 2].map(() => [1, 2, 3, 4, 5, 6].map(n => `<b>${n}</b>`).join('')).join('');
    const moi = d.cote === 'A';
    // Sans adversaire, le seuil se dit en « il faut » : le total à atteindre.
    const face = j.opp ? `contre ${moi ? '' : 'toi '}<b>${j.total2}</b>` : `· il faut <b>${j.rondelle ? j.total2 : j.total2 + 1}</b>`;
    // Le verdict se RÉVÈLE quand le tambour s'arrête (feuille de style) : pas avant.
    // `ok` / `rate` sont TES couleurs (S75b) : le jet adverse réussi est rouge.
    const pourToi = moi ? j.reussi : !j.reussi;
    return `
      <span class="t-dg ${pourToi ? 'ok' : 'rate'} ${moi ? 'mien' : 'sien'}">
        <span class="t-dg-fenetre"><span class="t-dg-tambour" style="--face:${j.de - 1}">${faces}</span></span>
        <span class="t-dg-texte">
          <span class="t-dg-calcul">${moi ? 'Toi' : esc(B.tag)} <b>${j.total}</b> ${face}</span>
          <span class="t-dg-mot">${esc(MOT_JET[j.quoi] || 'Jet')}${j.relance ? ' relancé' : ''} · <em>${esc(motDuJet(j, moi))}</em></span>
        </span>
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
  /*
   * LE MOT, CE QU'IL VAUT POUR CELUI QUI A JOUÉ, ET OÙ IL TOMBE. La couleur
   * se déduit du camp (S75b) : un « GAGNÉE ! » vert quand l'adversaire gagne
   * la bataille, c'est une mauvaise nouvelle déguisée en bonne. +1 : bon
   * pour qui a joué — vert si c'est toi, rouge si c'est lui ; −1 : l'inverse ;
   * 0 : neutre, en bleu. Ton but est en or, le sien en rouge. Quelques mots
   * se disent autrement quand c'est lui (`motSien`).
   */
  const VERDICTS = {
    but:        ['BUT !', 1, 'filet'],
    retour:     ['RETOUR !', 1, 'filet'],
    arret:      ['ARRÊT', -1, 'filet'],
    vol:        ['VOLÉE !', 1, 'cible'],
    echec:      ['ÉCHEC !', 1, 'cible'],
    rate:       ['MANQUÉ', -1, 'cible'],
    revirement: ['REVIREMENT', -1, 'defaut'],
    degage:     ['AU FOND', 0, 'cible'],
    dejoue:     ['FEINTÉ !', 1, 'cible'],
    bataille:   ['GAGNÉE !', 1, 'cible', 'PERDUE'],
    punition:   ['PUNITION', -1, 'defaut'],
    horsjeu:    ['HORS-JEU', -1, 'defaut'],
    desert:     ['FILET DÉSERT', 0, 'defaut'],
    icing:      ['DÉGAGEMENT REFUSÉ', -1, 'defaut'],
  };
  const tonDe = (genre, sens, camp) => {
    const pourToi = camp === 'A' ? sens : -sens;
    if (genre === 'but') return camp === 'A' ? 'or' : 'rouge';
    return pourToi > 0 ? 'chaud' : pourToi < 0 ? 'rouge' : 'froid';
  };

  function verdict(avant, ou, quoi = null, delai = 0, camp = 'A') {
    // La lecture d'abord (S74) : elle dit QUAND la rondelle arrive, et le mot
    // attend ce moment-là — un ARRÊT qui éclate pendant que la rondelle vole
    // encore vers le filet, c'est lire la fin avant l'histoire.
    const impact = preparerLecture(delai ? ROULE : 0);
    const neufs = m.fil.slice(0, Math.max(0, m.fil.length - avant)).reverse();
    // Le geste s'entend quand le dé s'arrête, ce que le moteur en a dit quand la rondelle arrive (S75).
    sonner(neufs.map(e => e.genre), quoi, delai ? ROULE / 1000 / vitesse : 0, impact / 1000);
    flash = null;
    flashAuBut = null;
    let f = null;
    for (const e of neufs) {
      const v = VERDICTS[e.genre];
      if (!v) continue;
      const place = ou[v[2]] || ou.defaut;
      if (!place) break;
      f = { r: place.r, c: place.c, texte: camp !== 'A' && v[3] ? v[3] : v[0], ton: tonDe(e.genre, v[1], camp), n: ++noJet };
      break;
    }
    clearTimeout(minuteurFlash);
    if (f && impact > 0 && enLecture()) flashAuBut = f;
    else if (f) montrerFlash(f);
  }

  /** Le verdict éclate, et s'efface tout seul. */
  function montrerFlash(f) {
    flash = f;
    flashAuBut = null;
    clearTimeout(minuteurFlash);
    minuteurFlash = setTimeout(() => { flash = null; if (!regles) majGlace(); }, 1200);
    if (!regles && grilleFaite) majGlace();
  }

  /* ======================================================================
     LA LECTURE DU TRAJET (S74)
     ======================================================================
     Après chaque geste — le tien ou le sien — on lit ce que le moteur a
     ajouté au trajet de la rondelle (`m.trajet`) et au dernier patin
     (`m.patin`), et on le JOUE, une étape après l'autre :

       le patin       la pièce suit sa route case par case (elle contourne
                      qui elle a contourné, jamais à travers le filet), et
                      la rondelle avec elle si c'est le porteur
       la passe, le tir, la relance, l'interception
                      la rondelle traverse, à une vitesse qui suit la distance
       le rebond      elle va d'abord là où elle a été perdue (le gardien,
                      le receveur manqué), puis roule à côté
       le sifflet     la glace reste figée comme l'arbitre l'a vue, le
                      sifflet se pose sur le point avec son mot ; puis tout
                      le monde se replace et la rondelle est posée au point

     Toucher la glace pendant la lecture la finit d'un coup : le mot du
     sifflet reste le temps d'être lu. Et rien ne se joue pendant qu'elle
     roule — la glace qu'on voit n'est pas encore celle du moteur.
     ====================================================================== */
  const PAS_PATIN = 85;          // une case de patin
  const PAS_RONDELLE = 45;       // une case de rondelle qui voyage
  const ROULE = 540;             // le dé de l'adversaire roule avant que la rondelle parte
  const SIFFLET_TIENT = 900;     // la glace figée, le mot de l'arbitre posé
  const SIFFLET_RESTE = 1200;    // le mot reste encore, le temps que tout le monde se replace
  const REBOND = 150;
  const voyage = n => Math.min(560, Math.max(170, n * PAS_RONDELLE));
  const ecart = (a, b) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
  const cleDe = x => (x.gardien ? `${x.eq}-G` : `${x.eq}-${x.role}`);
  // Après ces étapes-là, la rondelle est LIBRE : le point d'or s'allume.
  const LIBRE_APRES = new Set(['fond', 'retour', 'ricochet', 'echappe', 'large', 'banc']);
  let rondelleLibreVue = false;

  const enLecture = () => fileLecture.length > 0 || !!minuteurLecture;
  const resteLecture = () => (enLecture() ? Math.max(0, finLecture - Date.now()) : 0);

  /** Le sifflet sur la glace : le mot de l'arbitre, et où la rondelle sera remise en jeu. */
  const siffletHtml = (s, cleSeule) => (cleSeule ? `${s.n}`
    : `<span class="t-sifflet-mot"><b>🔔 ${esc(s.mot)}</b><i>mise au jeu ${esc(s.ou)}</i></span>`);

  /*
   * Prépare et lance la lecture de ce que le moteur vient de jouer. Rend le
   * temps (ms) qu'il faudra à la rondelle pour ARRIVER — c'est là que le
   * verdict éclate. `attente` : le dé de l'adversaire roule d'abord.
   */
  function preparerLecture(attente = 0) {
    const etapes = m.trajet.slice(trajetLu);
    // Un patin n'est lu qu'une fois la pièce ARRIVÉE : pendant qu'un dé
    // d'esquive attend ta décision, elle n'a pas encore bougé.
    const arrive = m.patin && m.patin !== patinVu && m.patin.piece.r === m.patin.vers.r && m.patin.piece.c === m.patin.vers.c;
    const patin = arrive ? m.patin : null;
    // LE DÉ ADVERSE ROULE MÊME QUAND LA RONDELLE NE BOUGE PAS (S75) : une mise
    // en échec ratée n'a pas de trajet, et son MANQUÉ, son fil et son son
    // tombaient pendant que le dé tournait encore. L'attente est une lecture
    // à elle seule, et ce que le moteur en dit attend qu'elle finisse.
    if (!etapes.length && !patin && !attente) return 0;
    trajetLu = m.trajet.length;
    if (patin) patinVu = patin;
    // Jamais deux lectures l'une sur l'autre : la précédente se POSE, elle ne glisse pas en travers (S75).
    if (enLecture()) { vider(); sansTransition = true; }
    vitesse = presse ? VITE : 1;
    const pas = [];
    // `attend` : un pas où rien ne glisse (le dé qui roule, la glace figée au sifflet) — l'accéléré peut le raccourcir.
    const pousser = (duree, faire, attend = false) => pas.push({ duree, faire, attend });
    // Le point de départ est ce que l'écran montre DÉJÀ : sans ça, le premier
    // rendu poserait tout à l'arrivée, et la lecture repartirait de là.
    if (etapes.length) pilotes.set('rondelle', { r: etapes[0].de.r, c: etapes[0].de.c, libre: rondelleLibreVue, tenue: !rondelleLibreVue });
    if (attente) pousser(attente, () => {}, true);
    /*
     * LE POINT DU PORTEUR ARRIVE AVEC LA RONDELLE, PAS AVANT (S75b). Le pas
     * d'une passe posait la rondelle à l'arrivée ET la disait tenue : le
     * receveur portait son point dès le départ de la passe, pendant que la
     * rondelle volait encore — deux rondelles à l'écran, jusqu'à onze cases
     * l'une de l'autre (44 fois en cinq matchs, mesuré par le passage de
     * vérification). Le voyage la montre libre de mains ; un pas de durée
     * nulle, quand elle arrive, la donne au receveur.
     */
    const arrivee = () => pousser(0, () => { const x = pilotes.get('rondelle'); if (x) pilotes.set('rondelle', { ...x, tenue: true }); });
    const surRoute = (cle, route, avecRondelle) => {
      if (cle) pilotes.set(cle, { r: route[0].r, c: route[0].c });
      for (const x of route.slice(1)) pousser(PAS_PATIN, () => {
        if (cle) pilotes.set(cle, { r: x.r, c: x.c, ms: PAS_PATIN });
        if (avecRondelle) pilotes.set('rondelle', { r: x.r, c: x.c, ms: PAS_PATIN, libre: false, tenue: true });
      });
    };
    // Le patin d'une pièce SANS la rondelle, avant tout le reste : c'est lui
    // qui arrive sur une rondelle libre, ou qui se place.
    const duPorteur = patin && etapes.some(e => e.genre === 'patin' && e.a.r === patin.vers.r && e.a.c === patin.vers.c);
    if (patin && !duPorteur) surRoute(cleDe(patin.piece), patin.chemin.length ? patin.chemin : [patin.de, patin.vers], false);
    // La glace QUAND l'arbitre a sifflé : les pièces y restent jusqu'à la remise en place.
    const mj = etapes.find(e => e.genre === 'mj');
    if (mj && mj.photo) photo = mj.photo;
    let impact = -1;
    for (const e of etapes) {
      if (e.genre === 'mj') {
        if (impact < 0) impact = pas.length;
        pousser(SIFFLET_TIENT, () => {
          clearTimeout(minuteurSifflet);
          // LE MOT NE COUVRE PAS LES DEUX CENTRES (S75) : ils se font face sur les rangées collées au point ;
          // il se pose deux rangées plus loin, du côté qui s'éloigne du filet le plus proche.
          coupDeSifflet = { r: e.point.r, c: e.point.c, mot: e.mot, ou: e.point.nom, n: ++noJet, dessous: e.point.r <= MI_GLACE };
        }, true);
        // L'arbitre pose la rondelle au point, tout le monde se replace, le centre la gagne.
        pousser(260, () => {
          photo = null;
          // Le jeu est arrêté : le dé du geste qui l'a arrêté n'a plus rien à dire sur la glace.
          deGlace = null;
          for (const k of [...pilotes.keys()]) if (k !== 'rondelle') pilotes.delete(k);
          pilotes.set('rondelle', { r: e.point.r, c: e.point.c, saute: true, libre: true, tenue: false });
          // En accéléré, le mot reste moins longtemps : la suite arrive plus vite, il ne doit pas la couvrir.
          minuteurSifflet = setTimeout(() => { coupDeSifflet = null; if (!regles && grilleFaite) majGlace(); }, SIFFLET_RESTE / (vitesse > 1 ? 2 : 1));
        });
        pousser(REBOND, () => pilotes.set('rondelle', { r: e.a.r, c: e.a.c, ms: REBOND, libre: false, tenue: false }));
        arrivee();
        continue;
      }
      if (e.genre === 'patin') {
        surRoute(duPorteur ? cleDe(patin.piece) : null, e.chemin || [e.de, e.a], true);
        continue;
      }
      const libreApres = LIBRE_APRES.has(e.genre);
      // Quelqu'un la tient à l'arrivée — sauf libre, ou en vol vers le filet (le but la laisse au fond).
      const tenue = !libreApres && e.genre !== 'tir';
      const via = e.pivot && ecart(e.pivot, e.de) > 0 ? e.pivot : null;
      if (via) { const d = voyage(ecart(e.de, via)); pousser(d, () => pilotes.set('rondelle', { r: via.r, c: via.c, ms: d, libre: false, tenue: false })); }
      const n = ecart(via || e.de, e.a);
      /*
       * AU FOND, LA RONDELLE TRAVERSE LA GLACE (S75). Elle était rangée avec les
       * rebonds (`REBOND`, 150 ms) parce qu'elle finit libre : un dégagement de
       * quinze cases durait autant qu'un ricochet d'une case. Elle voyage à la
       * vitesse d'une passe, case par case ; seul un vrai rebond — collé à ce
       * qui l'a fait — claque en 150 ms.
       */
      const d = !n ? 0 : via || (libreApres && e.genre !== 'fond') ? REBOND : voyage(n);
      // Personne ne la tient PENDANT qu'elle voyage : le receveur la reçoit à l'arrivée (S75b).
      pousser(d, () => pilotes.set('rondelle', { r: e.a.r, c: e.a.c, ms: d, libre: libreApres, tenue: tenue && !d }));
      if (tenue && d) arrivee();
    }
    // Le verdict éclate quand la rondelle ARRIVE — avant le sifflet, s'il y en a un —
    // et le pointage monte à ce moment-là, pas quand le moteur l'a décidé (S75).
    if (impact < 0) impact = pas.length;
    pas.splice(impact, 0, { duree: 0, faire: () => {
      if (rattraper('but') && !regles) ecrire($('.t-tete'), tete() + banniere());
      if (flashAuBut) montrerFlash(flashAuBut);
    } });
    const tImpact = pas.slice(0, impact).reduce((s, x) => s + x.duree, 0) / vitesse;
    fileLecture = pas;
    finLecture = Date.now() + pas.reduce((s, x) => s + x.duree, 0) / vitesse;
    enchainer();
    return tImpact;
  }

  function enchainer() {
    minuteurLecture = 0;
    // La question du ✕ est ouverte : la lecture attend la réponse (S75b).
    if (enPause) { reprise.lecture = true; return; }
    const pas = fileLecture.shift();
    if (!pas) { pasCourant = null; lectureFinie(); return; }
    pas.faire();
    if (!regles && grilleFaite) majGlace();
    pasCourant = { duree: pas.duree / vitesse, depart: Date.now(), attend: pas.attend };
    minuteurLecture = setTimeout(enchainer, pas.duree / vitesse);
  }

  /*
   * LE PREMIER TOUCHER ACCÉLÈRE (S75). Les pas qui restent se jouent à VITE ;
   * celui qui glisse en ce moment finit sa course — relancé tout de suite,
   * il repartirait en travers vers la case d'après — mais une ATTENTE (le dé,
   * la glace figée au sifflet) se raccourcit. Rend faux si c'était déjà fait.
   */
  function accelerer() {
    if (!enLecture() || vitesse >= VITE) return false;
    vitesse = VITE;
    const reste = pasCourant ? Math.max(0, pasCourant.duree - (Date.now() - pasCourant.depart)) : 0;
    const ceLuiCi = pasCourant && pasCourant.attend ? reste / VITE : reste;
    clearTimeout(minuteurLecture);
    minuteurLecture = setTimeout(enchainer, ceLuiCi);
    finLecture = Date.now() + ceLuiCi + fileLecture.reduce((s, x) => s + x.duree, 0) / vitesse;
    return true;
  }

  /** Joue d'un coup ce qui reste de la lecture, sans redessiner : une autre la suit. */
  function vider() {
    clearTimeout(minuteurLecture);
    minuteurLecture = 0;
    while (fileLecture.length) fileLecture.shift().faire();
    pilotes.clear();
    photo = null;
  }

  /** Finir la lecture maintenant, SANS GLISSER (S75) : le second toucher, ou le geste adverse qui suit. */
  function sauterLecture() {
    if (!enLecture()) return;
    vider();
    sansTransition = true;
    lectureFinie();
  }

  /** Un toucher pendant la lecture : accélérer d'abord, poser ensuite. */
  function toucherLecture() {
    if (!accelerer()) sauterLecture();
  }

  function lectureFinie() {
    minuteurLecture = 0;
    pasCourant = null;
    fileLecture = [];
    pilotes.clear();
    photo = null;
    if (flashAuBut) montrerFlash(flashAuBut);
    if (regles) return;
    // La glace est de nouveau celle du moteur : ce qui s'allume, qui peut jouer.
    if (!iaEnCours) choisirSeul();
    rendre();
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
    dejoue: 'patin', changement: 'tap', bataille: 'vol', punition: 'periode', horsjeu: 'periode', icing: 'periode', desert: 'periode',
    relance: 'passe',   // S74 : la sortie de zone du gardien est une passe, elle s'entend comme une passe
  };
  const PAS_SON = { tir: 0.22, patin: 0.12, passe: 0.1, echec: 0.28, arret: 0.2, retour: 0.25, vol: 0.15, rate: 0.15, degage: 0.45, mj: 0.1, periode: 0.5, fin: 2, but: 1.6, revirement: 0.2, tap: 0.08 };
  // `arrivee` (S75) : ce que le moteur en a dit sonne quand la rondelle arrive, pas avant.
  function sonner(genres, quoi, delai = 0, arrivee = 0) {
    let d = delai;
    if (quoi === 'tir') { jouerSon('tir', d); d += PAS_SON.tir; }
    else if (quoi === 'patin' || quoi === 'esquive' || quoi === 'dejouer' || quoi === 'bataille') { jouerSon('patin', d); d += PAS_SON.patin; }
    d = Math.max(d, arrivee);
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
    // DERRIÈRE le filet (S75) : posé SUR le filet, « BUT ! » cachait le gardien qu'il venait de battre.
    filet: piece ? { r: eqDe(m, piece.eq).but === FILET_HAUT ? FILET_HAUT - 1 : FILET_BAS + 1, c: BUT_COL } : null,
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
    /*
     * « ESQUIVER » VEUT DIRE QU'UN DÉ PEND, PAS QU'UN RAYON TOUCHE (S43). Le
     * bouton lisait la PRESSION, qui porte à deux cases : il annonçait donc
     * une esquive là où patiner est devenu libre. Il lit maintenant ce que
     * les cases offrent — s'il existe une destination qui demande un jet, il
     * dit « Esquiver » et porte sa meilleure cote ; sinon « Patiner ».
     */
    let doitEsquiver = false;
    if (peutBouger(m, sel)) {
      const pas = deplacementsDe(m, sel);
      if (pas.length) {
        const sous = aLaRondelle ? pas.filter(v => esquiveRequise(m, sel, v)) : [];
        doitEsquiver = sous.length > 0;
        const d = sous.length ? meilleure(sous, v => avec(modEsquive(m, sel, v), bonus('PATIN'))) : null;
        /*
         * LE BOUTON DIT JUSQU'OÙ, PAS COMBIEN DE CASES (S43). JP : *nombre
         * de cases de déplacement clairement indiqué*. Il annonçait le
         * nombre de DESTINATIONS allumées — « 36 cases » — un chiffre qui ne
         * se décide avec rien : on ne choisit pas entre 36 et 24 cases, on
         * choisit jusqu'où aller. Il annonce maintenant la PORTÉE de cette
         * pièce-ci, en pas, dans la même unité que le budget de la main
         * (« 4½/6 Pas ») et que le prix écrit sur chaque case.
         */
        modes.push(modeBouton('deplacer', doitEsquiver ? 'Esquiver' : 'Patiner', d, `${demisEnPas(porteeDe(m, sel))} pas`));
      } else modes.push(modeEteint('deplacer', 'Patiner', 'aucune case libre'));
    } else {
      modes.push(modeEteint('deplacer', 'Patiner', sel.deplace ? 'elle a déjà patiné' : 'patin dépensé'));
    }
    /*
     * LA RAISON EST TOUJOURS LA PLUS PROCHE : on dit d'abord ce qui manque au
     * JOUEUR (l'action déjà dépensée, la rondelle qu'il n'a pas), puis ce qui
     * manque sur la GLACE (personne à qui passer, personne à frapper). Dans
     * l'autre ordre, un ailier sans rondelle lisait « personne à frapper »
     * alors que le vrai empêchement était qu'il porte la rondelle.
     */
    const sansAction = !peutAgir(m, sel) ? (m.main.agi ? 'action dépensée' : 'a déjà agi') : null;
    if (aLaRondelle) {
      const rec = peutAgir(m, sel) ? receveursDe(m, sel) : [];
      const fond = peutAgir(m, sel) ? ciblesFondDe(m, sel) : [];
      if (rec.length || fond.length) modes.push(modeBouton('passe', 'Passer', meilleure([...rec, ...fond], x => avec(modPasse(m, sel, x), x.st ? bonus('VOILEE') : 0)), fond.length ? 'ou au fond' : ''));
      else modes.push(modeEteint('passe', 'Passer', sansAction || 'personne à qui passer'));
      // FEINTER : un défenseur collé, en un contre un.
      const dej = peutAgir(m, sel) ? ciblesDejouerDe(m, sel) : [];
      if (dej.length) modes.push(modeBouton('dejouer', 'Feinter', meilleure(dej, x => avec(modDejouer(m, sel, x), bonus('PATIN'))), 'un contre un'));
      else modes.push(modeEteint('dejouer', 'Feinter', sansAction || 'aucun défenseur collé'));
      modes.push(modeEteint('echec', 'Frapper', 'pas avec la rondelle'));
      modes.push(modeEteint('vol', 'Harponner', 'pas avec la rondelle'));
    } else {
      modes.push(modeEteint('passe', 'Passer', 'il n\'a pas la rondelle'));
      modes.push(modeEteint('dejouer', 'Feinter', 'il n\'a pas la rondelle'));
      const adv = peutAgir(m, sel) ? ciblesEchecDe(m, sel) : [];
      if (adv.length) modes.push(modeBouton('echec', 'Frapper', meilleure(adv, x => avec(modEchec(m, sel, x), bonus('ACTIF') + bonus('EPAULE')))));
      else modes.push(modeEteint('echec', 'Frapper', sansAction || (essouffle(m, sel) ? 'à bout de souffle' : enCourse(m, sel) ? 'il vient de patiner' : 'personne de collé')));
      const vol = peutAgir(m, sel) ? ciblesVolDe(m, sel) : [];
      /*
       * LA RAISON DIT CE QUI EST VRAI (S75). « Le porteur n'est pas collé »
       * s'affichait quand la rondelle était LIBRE — il n'y avait pas de
       * porteur — ou quand c'était un coéquipier qui la portait. Harponner
       * vise le porteur adverse : sans lui, la raison dit pourquoi.
       */
      const pv = porteur(m);
      const sansPorteur = !pv ? (libre(m) ? 'la rondelle est libre' : 'personne ne la porte')
        : pv.eq === sel.eq ? 'on a la rondelle' : 'le porteur n\'est pas collé';
      if (vol.length) modes.push(modeBouton('vol', 'Harponner', meilleure(vol, x => avec(modVol(m, sel, x), bonus('ACTIF'))), 'la rondelle'));
      else modes.push(modeEteint('vol', 'Harponner', sansAction || (essouffle(m, sel) ? 'à bout de souffle' : enCourse(m, sel) ? 'il vient de patiner' : sansPorteur)));
    }

    // Le TIR est dans la barre d'ancrage, sous la glace (`dock`) : c'est le
    // geste qu'on cherche, il ne doit pas demander d'ouvrir le volet.
    // LE DUEL : sur le porteur adverse, frapper ou harponner.
    if (cible && peutAgir(m, sel) && dist(sel, cible) === 1) {
      // « Frapper », sans le nom : la question au-dessus le dit déjà, et la barre tient sur une ligne (S75).
      if (ciblesEchecDe(m, sel).includes(cible)) gestes.push(bouton('echec', 'Frapper', avec(modEchec(m, sel, cible), bonus('ACTIF') + bonus('EPAULE')), 't-echec'));
      if (ciblesVolDe(m, sel).includes(cible)) gestes.push(bouton('vol', 'Harponner', avec(modVol(m, sel, cible), bonus('ACTIF')), 't-vol'));
    }

    const horsPortee = aLaRondelle && !peutTirer(m, sel);
    const prof = distanceAuFilet(m, sel);
    /*
     * UNE CONSIGNE TIENT SUR UNE LIGNE (S75b). Celle de la passe faisait trois
     * lignes et poussait la barre à 741 px sur une glace qui finit à 760 : les
     * coéquipiers derrière ton filet étaient cachés aux trois quarts, dans le
     * mode même qui sert à les viser. Le détail (le prix, la cote, le fond)
     * est déjà écrit sur les cases ; la consigne dit seulement quoi toucher.
     */
    const AIDE_MODE = {
      deplacer: doitEsquiver ? 'Touche une case : son prix, et sa cote si tu esquives.' : 'Touche une case pour y patiner.',
      passe: 'Touche un coéquipier, ou le fond.',
      echec: 'Touche l\'adversaire à frapper.',
      vol: 'Touche le porteur à harponner.',
      dejouer: 'Touche le défenseur à feinter.',
    };
    // La question nomme les gestes OFFERTS (S75) : « Frapper ou harponner » quand seul le bâton reste mentait.
    const duelMots = cible ? [ciblesEchecDe(m, sel).includes(cible) && 'Frapper', ciblesVolDe(m, sel).includes(cible) && 'harponner'].filter(Boolean) : [];
    const aide = cible ? `${duelMots.join(' ou ').replace(/^h/, 'H') || 'Frapper'} ${nomCourt(cible.p)} ?`
      : mode ? AIDE_MODE[mode]
      : horsPortee && prof <= 0 ? 'Derrière le filet on ne tire pas : une passe vers l\'enclave vaut +1 d\'ici — le gardien ne la voit pas venir.'
      : horsPortee ? `Trop loin pour tirer : il faut entrer dans la zone offensive, à ${PORTEE_TIR} cases du filet ou moins. Il en est à ${prof}.`
      : aLaRondelle ? 'Choisis un geste, ou touche directement une case allumée ou un adversaire. Pour passer, choisis « Passer » puis le coéquipier.'
      : 'Choisis un geste, ou touche directement une case allumée ou un adversaire adjacent.';
    // LES ACTIONS VONT DANS LA BARRE DU BAS (`dock`), pas dans le volet :
    // au premier toucher d'une pièce, on peut agir sans rien ouvrir.
    /*
     * LA CARTE PORTE LE TIR AUSSI. Il vivait dans la barre du bas parce que
     * c'est « le geste qu'on cherche » ; maintenant que tous les gestes sont
     * à côté de la pièce, l'en sortir serait le cacher. Il garde sa place :
     * PREMIER de la liste, et en plein quand il est jouable.
     */
    const tirCarte = receptionPossible(m) === sel
      ? bouton('reception', 'Tir sur réception', avec(modTir(m, sel), bonus('DECOCHE')), 't-tir')
      : (aLaRondelle && peutAgir(m, sel) && peutTirer(m, sel))
        ? bouton('tir', 'Tirer', avec(modTir(m, sel), bonus('DECOCHE')), 't-tir')
        : modeEteint('tir', 'Tirer', !aLaRondelle ? 'il n\'a pas la rondelle'
          : sansAction || (horsPortee ? (prof <= 0 ? 'derrière le filet' : `à ${prof} du filet, il en faut ${PORTEE_TIR}`) : 'impossible'));
    /*
     * LA CARTE SE FERME PAR UN BOUTON, pas par une manoeuvre à deviner.
     * `ancrerCarte` prend le côté qui couvre le moins de pièces jouables,
     * mais quand les cinq patineurs sont groupés il n'existe parfois aucun
     * côté propre : la pièce qui reste dessous ne se touche plus. On pouvait
     * s'en sortir en retouchant la pièce choisie — elle n'est jamais couverte,
     * la carte lui est tangente — mais « un chemin qu'il faut deviner n'existe
     * pas » (S46). Le ✕ le dit, et c'est l'Annuler de FFT.
     */
    const carte = `<div class="t-cmd-tete"><b>${esc(sel.role)}</b> ${esc(nomCourt(sel.p))}<button type="button" class="t-cmd-fermer" aria-label="Fermer le menu">✕</button></div>`
      + `<div class="t-cmd-liste">${tirCarte}${modes.join('')}${gestes.join('')}</div>`;
    actions = { modes, gestes, aide, carte };

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
  const aideDe = quoi => `<button type="button" class="t-aide" data-aide="${quoi}" title="La règle de ce geste, dans le fil" aria-label="La règle : ${esc(quoi)}">?</button>`;
  const modeBouton = (quoi, nom, d, note = '') =>
    `<button type="button" class="t-mode ${mode === quoi ? 'on' : ''}" data-mode="${quoi}">${esc(nom)}${d === null ? '' : ` <b>${cote(d)}</b>`}${note ? `<i>${esc(note)}</i>` : ''}</button>${aideDe(quoi)}`;
  /*
   * UN GESTE IMPOSSIBLE RESTE À L'ÉCRAN, ÉTEINT, AVEC SA RAISON (S45). JP :
   * *je sais pas toujours ce que je peux faire pour vrai*. La barre ne
   * montrait QUE les gestes jouables : un geste absent pouvait aussi bien ne
   * pas exister qu'être refusé, et rien ne disait lequel des deux. On ne
   * peut pas apprendre les règles d'un jeu qui cache ce qu'il refuse. Les
   * six gestes sont donc toujours là, dans le même ordre ; celui qu'on ne
   * peut pas jouer est éteint et dit pourquoi, en un mot sous son nom.
   */
  /* Il ne porte PAS `data-mode` : un sélecteur qui matche un bouton désactivé
     est un test qui clique dans le vide (la leçon du changement de trio). */
  const modeEteint = (quoi, nom, pourquoi) =>
    `<button type="button" class="t-mode t-mode-non" data-non="${quoi}" disabled title="${esc(pourquoi)}">${esc(nom)}<i>${esc(pourquoi)}</i></button>${aideDe(quoi)}`;

  /* ---------- le dé ---------- */

  const MOT_JET = { tir: 'Tir', passe: 'Passe', fond: 'Au fond', echec: 'Mise en échec', esquive: 'Esquive', vol: 'Harponnage', dejouer: 'Feinte', bataille: 'Bataille' };

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
    /*
     * « RÉUSSI » ATTEND QUE LE DÉ S'ARRÊTE (S75). La barre le disait pendant
     * que le tambour tournait encore — et le bouton de relance, qui n'existe
     * que sur un échec, le disait aussi. Le verdict et les boutons se
     * révèlent quand le tambour s'arrête (feuille de style) ; d'ici là, la
     * barre dit seulement que le dé roule. Toucher la glace accepte toujours.
     */
    return `
      <div class="t-de ${j.reussi ? 'ok' : 'rate'}" data-jet="${deGlace ? deGlace.n : 0}">
        <span class="t-de-roule">🎲 Le dé roule…</span>
        <span class="t-de-verdict">${esc(MOT_JET[j.quoi] || 'Jet')} · <em>${esc(motDuJet(j))}</em></span>
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
  const peutChanger = () => aMoi() && !attente && !enLecture() && !m.main.change;

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
        ${peutRetirerGardien(m, 'A') && aMoi() ? '<button type="button" class="t-desert" title="Mené d\'un ou deux buts à la fin de la troisième : un sixième patineur, et ton filet reste ouvert.">🥅 Sortir le gardien</button>' : ''}
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
   * passe) pour que le jeu parle une seule langue.
   *
   * LE GARDIEN AUSSI, DEPUIS S75. Il comptait ses arrêts MOINS ses buts
   * alloués : 23 arrêts et 8 buts donnaient 15, plus qu'un tour du chapeau,
   * et le passage du testeur a vu le gardien d'une défaite à 8 buts nommé
   * première étoile. Il vaut maintenant ce qu'il a VOLÉ, comme à l'entracte :
   * ses arrêts au-dessus d'un gardien ordinaire, une prime s'il gagne, une
   * autre s'il blanchit. L'ordinaire n'est pas le 90 % de la ligue : sur la
   * table on arrête deux lancers sur trois (2,81 buts pour 8,45 lancers,
   * `check_table`), et `ARRETS_ORDINAIRES` arrondit vers le haut pour qu'un
   * soir moyen ne fasse pas une étoile.
   */
  const ARRETS_ORDINAIRES = 0.7;
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
      const vus = g ? g.arrets + g.alloues : 0;
      if (vus) {
        const gagne = gagnantDuMatch(r) === (eq === A ? 'A' : 'B');
        const note = (g.arrets - ARRETS_ORDINAIRES * vus) * 1.5 + (gagne ? 1.5 : 0) + (g.alloues ? 0 : 2);
        gens.push({ nom: nomJ(g.p), tag: eq.tag, note,
          quoi: `${g.arrets} arrêt${g.arrets > 1 ? 's' : ''} sur ${vus}` });
      }
    }
    return gens.filter(x => x.note > 0).sort((x, y) => y.note - x.note).slice(0, 3);
  }

  /* ---------- les tirs de barrage ----------
   *
   * LA FUSILLADE ÉTAIT INVISIBLE (S75b). Un 0-0 finissait « Prolongation ·
   * Terminé », la feuille disait 0-0, et le tournoi inscrivait une DÉFAITE :
   * le moteur avait joué la fusillade (`m.fusillade`) et l'écran ne l'avait
   * jamais montrée. Elle se rejoue maintenant sur la glace, tireur par
   * tireur, avec le dé de chaque tir tel que le moteur l'a jeté (il le garde,
   * `ja`/`jb`) : rien n'est tiré à l'écran, tout est déjà joué. Chaque tir
   * paraît `BARRAGE_PAS` secondes après le précédent (feuille de style, pas
   * de minuterie), le vainqueur en dernier ; toucher montre tout. Couleurs
   * de TON point de vue : ton but et l'arrêt de ton gardien en vert.
   */
  const BARRAGE_PAS = 0.8;
  const barrageFin = () => (m.fusillade.tours.length * 2 * BARRAGE_PAS).toFixed(1);
  const vainqueurBarrage = () => (m.fusillade.A > m.fusillade.B ? A : B);
  function barrageHtml() {
    const fs = m.fusillade;
    const tir = (p, j, ok, k, pourToi) => `<span class="tbg-tir ${pourToi ? 'bon' : 'mauvais'}" style="--k:${k}">
        <b>${esc(nomTrois(p))}</b>${j ? `<i>${j.total} contre ${j.total2}</i>` : ''}<em>${ok ? 'BUT' : 'ARRÊT'}</em></span>`;
    const rangs = fs.tours.map((t, i) => `<li><span class="tbg-num">${i + 1}</span>
        ${tir(t.a, t.ja, t.ra, 2 * i, t.ra)}${tir(t.b, t.jb, t.rb, 2 * i + 1, !t.rb)}</li>`).join('');
    const g = vainqueurBarrage();
    return `<div class="t-barrage-boite">
      <div class="t-barrage-titre">Tirs de barrage</div>
      <div class="t-barrage-camps"><span></span><span>${logo(A.tag, 16)} ${esc(A.tag)}</span><span>${logo(B.tag, 16)} ${esc(B.tag)}</span></div>
      <ol class="t-barrage-tours">${rangs}</ol>
      <div class="t-barrage-fin ${g === A ? 'bon' : 'mauvais'}" style="--k:${2 * fs.tours.length}">${esc(g.nom)} gagne ${Math.max(fs.A, fs.B)}-${Math.min(fs.A, fs.B)}</div>
    </div>`;
  }
  const barrageMot = () => `<div class="t-barrage-mot ${vainqueurBarrage() === A ? 'bon' : 'mauvais'}" style="--fin:${barrageFin()}s">Tirs de barrage : <b>${esc(vainqueurBarrage().nom)}</b> gagne ${Math.max(m.fusillade.A, m.fusillade.B)}-${Math.min(m.fusillade.A, m.fusillade.B)}</div>`;
  const barrageFeuille = () => `<section class="tf-barrage"><h4>Tirs de barrage <b>${m.fusillade.A} – ${m.fusillade.B}</b></h4>
      <table class="tf-table"><tbody>${m.fusillade.tours.map((t, i) => `<tr><td class="tf-rond">${i + 1}</td>
        <td class="tf-nom">${esc(nomJ(t.a))} <span class="${t.ra ? 'tf-oui' : 'tf-non'}">${t.ra ? 'but' : 'arrêté'}</span></td>
        <td class="tf-nom">${esc(nomJ(t.b))} <span class="${t.rb ? 'tf-oui' : 'tf-non'}">${t.rb ? 'but' : 'arrêté'}</span></td></tr>`).join('')}</tbody></table></section>`;

  function feuilleHtml() {
    const r = resultatDe(m);
    // Le gagnant des tirs de barrage est un gagnant (S75b) : `gagnantDuMatch`, pas les buts.
    const gagne = r.gfA === r.gfB && !r.vainqueur ? null : gagnantDuMatch(r);
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
      ${m.fusillade ? barrageFeuille() : ''}
      <div class="tf-cotes">${cote(r.A, A, 'A')}${cote(r.B, B, 'B')}</div>
    </div>`;
  }

  /* ---------- le fil ---------- */
  // Le fil dit ce que l'écran a montré (S75) : les lignes du geste en cours attendent la fin de sa lecture.
  const fil = () => `<div class="t-fil">${m.fil.slice(m.fil.length - vu.fil).slice(0, 7).map(e =>
    `<div class="t-evt t-evt-${e.genre}">${esc(e.texte)}</div>`).join('')}</div>`;

  /* ---------- le rendu ---------- */
  /*
   * ON NE RÉÉCRIT QUE CE QUI A CHANGÉ (S74). La lecture du trajet finit sur
   * une minuterie, donc un rendu peut maintenant tomber pendant TA main, entre
   * le moment où le doigt vise un bouton et celui où il le touche : réécrire
   * la barre pour rien remplaçait le bouton sous le doigt. Le test de fumée
   * l'a attrapé du premier coup (« element is not attached to the DOM »).
   */
  const ecrire = (el, html) => { if (el._html !== html) { el.innerHTML = html; el._html = html; } };

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
    if (regles) { ecrire($('.t-bas'), reglesHtml()); return; }
    // Ce que le moteur vient de jouer se lit avant de se dessiner (S74) ; sans
    // rien de neuf au trajet, c'est sans effet.
    preparerLecture();
    // Hors lecture, l'écran rattrape le moteur (S75) ; pendant, il attend que la rondelle arrive.
    if (!enLecture()) rattraper();
    ecrire($('.t-tete'), tete() + banniere());
    if (feuille) { ecrire($('.t-bas'), feuilleHtml()); return; }
    if (!grilleFaite) batirGlace();
    /*
     * `carte()` D'ABORD, LA GLACE ENSUITE — ET C'EST UN ORDRE, PAS UN GOÛT.
     * `carte()` ne rend pas que le volet : elle CALCULE `actions`, et trois
     * choses la lisent ensuite — la carte de commandes que `majGlace` pose
     * à côté de la pièce (`.t-cmd`, la seule façon de choisir « Passer »),
     * la barre du bas (`dock`) et le volet lui-même.
     *
     * L'ordre inverse datait de S34, quand rien sur la GLACE ne lisait
     * `actions` ; la carte de commandes est née en S45 et l'a hérité. La
     * glace dessinait donc les actions du rendu PRÉCÉDENT : au premier
     * toucher d'une pièce il n'y avait aucun menu (`actions.carte` n'existait
     * pas encore), et au toucher suivant c'était le menu de la pièce d'AVANT
     * — avec ses cotes et ses cibles. JP : *je suis incapable de passer, les
     * menus sont fucked*. Mesuré : on touchait Alfredsson et la carte disait
     * « C Heatley ».
     *
     * Une valeur qui se calcule à un endroit et se dessine à un autre doit
     * se calculer AVANT tout ce qui la dessine, et rien dans `carte()` ne
     * dépend de la glace : elle ne lit que le moteur et la sélection.
     */
    const fiche = carte();                    // calcule `actions` : la glace, la barre et le volet le lisent
    majGlace();
    // LE VOLET : la fiche de la pièce, le banc des trios et le fil, au
    // deuxième clic. JP : *flyout carte du joueur avec les actions, stats,
    // etc., pour avoir moins d'infos visible ; ça peut être boutons dans le
    // bas, stats au deuxième clic, trouver ce qui est le mieux*. Les ACTIONS
    // sont dans la barre du bas dès le premier toucher (on agit sans rien
    // ouvrir), les STATS dans le volet. Sur téléphone il glisse par-dessus
    // le bas de la glace et se ferme dès qu'on touche la glace ; sur grand
    // écran il est la colonne de droite, toujours ouverte (feuille de style).
    ecrire($('.t-dock'), dock());
    $('.t-bas').classList.toggle('ouvert', volet);
    ecrire($('.t-bas'), unites() + fiche + fil());
  }

  /*
   * LA BARRE D'ANCRAGE, sous la glace : ce qu'il faut avoir sous le pouce
   * sans ouvrir le volet. La décision d'un jet (relance ou accepter), la
   * pièce choisie et son TIR (le geste qu'on cherche), le bouton du volet,
   * et la fin de l'activation ou de la présence. Rien d'autre : le reste est
   * dans le volet.
   */
  function dock() {
    if (m.fini) return vu.fini ? `${m.fusillade ? barrageMot() : ''}<button type="button" class="t-resultat t-evident">Voir le résultat</button>`
      : '<span class="t-dock-nom t-dock-attente">Le dernier jeu se joue… <i>touche la glace pour accélérer</i></span>';
    if (attente) return de();
    if (!aMoi()) return `<span class="t-dock-nom t-dock-attente">${finDeMain ? `<b>${esc(finDeMain)}.</b> ` : ''}Sa main : ${esc(B.nom)} joue… <i>touche la glace pour accélérer</i></span>`;
    const dispo = eqDe(m, 'A').pieces.filter(aDesOptions).length;
    /*
     * CE QUE LA MAIN ACHÈTE, ET CE QU'IL EN RESTE (S44). Un patin, une
     * action, et le placement — un deuxième déplacement réservé à une pièce
     * qui n'a PAS la rondelle. La pastille et la consigne se dérivent des
     * mêmes trois drapeaux du moteur, jamais d'un compte tenu à part : le
     * budget partagé de S42 avait laissé « 4½/6 Pas » à l'écran, et quand
     * JP l'a éteint (*un seul joueur finalement vu souffle et vitesse*) la
     * pastille aurait annoncé « 0/0 » sans que rien ne casse — une pastille
     * qui ment est pire que pas de pastille.
     */
    const reste = pasRestants(m);
    const partage = PAS_PAR_MAIN > 0;
    const placeDispo = !partage && !m.main.place && eqDe(m, 'A').pieces.some(x => peutBouger(m, x) && porteur(m) !== x && !x.deplace);
    const entamee = m.main.agi || m.main.mobiles.length > 0;
    const premiere = !(m.tours || 0) && !m.mains.A && !entamee;   // la toute première main du match
    /*
     * LA CONSIGNE DIT LA MAIN. « Touche une de tes pièces » ne disait ni ce
     * qu'une main achète, ni ce qu'il en reste : à la première main du match
     * la phrase est la règle entière, ensuite elle dit ce qui reste à
     * dépenser. Le nombre de pièces qui peuvent encore jouer reste à côté.
     */
    const bouts = partage
      ? [reste ? `${demisEnPas(m.main.reserve)} pas` : '', m.main.agi ? '' : 'l\'action']
      : [m.main.bouge ? '' : 'le patin', m.main.agi ? '' : 'l\'action', placeDispo ? 'le placement' : ''];
    const restants = bouts.filter(Boolean);
    const resteMots = restants.length ? restants.join(' et ') : 'plus rien';
    const regleDeLaMain = partage
      ? `Ta main : ${PAS_PAR_MAIN} pas à répartir entre tes pièces, et une action. Touche une pièce.`
      : 'Ta main : un patin, une action, un placement. Touche une pièce.';
    const consigne = !dispo ? 'Plus rien à jouer : passe la main'
      : premiere ? regleDeLaMain
      : !entamee ? 'Ta main. Touche une pièce'
      : `Il reste ${resteMots}. Touche une pièce`;
    // La ligne du haut : qui est choisi (ou, en mode, ce qu'il reste à
    // toucher), le bouton du volet, la fin. Le mode ou le duel en cours
    // remplace le nom par la consigne : c'est ce qu'il faut lire à ce moment.
    // Sans pièce choisie, la consigne prend SA ligne : à côté de la pastille
    // et de deux boutons, il lui restait 85 px sur un téléphone et la règle de
    // la première main faisait six lignes.
    const avis = !sel ? `<div class="t-dock-consigne ${premiere ? 't-dock-regle' : ''}">${consigne}${dispo ? ` <i>${dispo} peu${dispo > 1 ? 'vent' : 't'} jouer</i>` : ''}</div>` : '';
    const nom = !sel ? ''
      : (mode || cible) ? `<span class="t-dock-nom t-dock-aide">${esc(actions.aide)}</span>`
      : `<span class="t-dock-nom"><b class="t-fiche-role">${esc(sel.role)}</b> ${esc(nomCourt(sel.p))}</span>`;
    // LES GESTES ONT DÉMÉNAGÉ SUR LA GLACE (S45), dans la carte de commandes
    // posée à côté de la pièce. La barre du bas garde ce qui n'appartient à
    // aucune pièce : le budget de la main, le volet, et passer la main.

    const budget = partage
      ? `<span class="t-budget" title="À ta main : ${PAS_PAR_MAIN} pas à répartir sur qui tu veux — chaque pièce patine au plus une fois, jamais plus loin que son PA — et une action. Puis la sienne, et c'est un tour."><i class="${reste ? '' : 'fait'}"><b>${demisEnPas(m.main.reserve)}/${PAS_PAR_MAIN}</b> Pas</i><i class="${m.main.agi ? 'fait' : ''}">Action</i></span>`
      : `<span class="t-budget" title="À ta main : UNE pièce patine (aussi loin que son PA le permet), UNE agit — pas forcément la même — et une pièce sans la rondelle peut se PLACER. Puis la sienne, et c'est un tour."><i class="${m.main.bouge ? 'fait' : ''}">Patin</i><i class="${m.main.agi ? 'fait' : ''}">Action</i>${!partage && (m.main.place || placeDispo) ? `<i class="${m.main.place ? 'fait' : ''}">Placement</i>` : ''}</span>`;
    // « Passer la main », dans les deux cas. Le bouton disait « Passer » tant
    // que la main n'était pas entamée — à côté du mode « Passer », celui qui
    // passe la RONDELLE : on touchait « Passer » pour faire une passe, et
    // c'est la main qui partait.
    const fin = entamee
      ? `<button type="button" class="t-fin-tour t-evident" title="Rendre la main sans dépenser ce qui reste">Passer la main</button>`
      : `<button type="button" class="t-passer" title="Ne rien jouer cette main-ci : l'adversaire joue la sienne.">Passer la main</button>`;
    const ouvre = `<button type="button" class="t-volet-btn" aria-expanded="${volet ? 'true' : 'false'}" title="${sel ? 'La fiche de la pièce, le banc et le fil' : 'Le banc des trios et le fil'}">${sel ? 'Fiche' : 'Banc'} <i>${volet ? '▾' : '▴'}</i></button>`;
    // La rangée des actions : le tir d'abord, puis les modes (un geste à
    // cible), puis les gestes sans cible. Elle se balaie si elle déborde.
    /*
     * LE DUEL PREND LA BARRE, comme le dé (S46). Choisir le porteur adverse
     * n'est pas un geste, c'est l'ouverture d'un choix à deux : l'épaule ou
     * le bâton. La carte de commandes s'est retirée (elle couvrirait la
     * glace), donc les deux boutons vivent ici, avec la question et de quoi
     * changer d'avis — un choix sans sortie est un cul-de-sac.
     *
     * ET LE MODE A LE MÊME BESOIN. La carte se ferme quand on prend un
     * mode, et c'est elle qui portait les boutons de mode : une fois
     * « Passer » choisi, plus RIEN à l'écran ne permettait d'en sortir. On
     * pouvait encore toucher sa propre pièce pour tout annuler, mais rien
     * ne le disait — un chemin qu'il faut deviner n'existe pas. La barre
     * porte donc la sortie dans les deux cas, à côté de la consigne qui dit
     * déjà quoi viser.
     */
    /*
     * ET RIEN NE SORT DE L'ÉCRAN (S75). La barre du duel était une seule ligne
     * qui se balayait, barre de défilement cachée : à 390 px, « Harponner »,
     * « Annuler » et « Passer la main » étaient hors champ, et rien ne disait
     * qu'on pouvait balayer. La question et « Annuler » tiennent la première
     * ligne — Annuler épinglé à droite, toujours au même endroit — et les
     * gestes passent à la ligne suivante, qui se replie au lieu de déborder.
     */
    if (cible || mode) {
      const annuler = `<button type="button" class="t-annuler" title="${cible ? 'Revenir sans frapper' : 'Sortir du mode'}">Annuler</button>`;
      // Un mode tient sur UNE ligne (S75b) : la consigne, Annuler, la fin de la main. Le duel en prend deux, ses gestes à la seconde.
      if (!cible) return `<div class="t-dock-ligne t-dock-duel">${nom}${annuler}${fin}</div>`;
      return `<div class="t-dock-ligne t-dock-duel">${nom}${annuler}</div>`
        + `<div class="t-dock-ligne t-dock-gestes">${actions.gestes.join('')}${fin}</div>`;
    }
    return `${avis}<div class="t-dock-ligne ${sel ? '' : 't-dock-sans'}">${nom}${budget}${ouvre}${fin}</div>`;
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
    // Le moteur a refusé le geste (S75 : une pièce qui n'est plus en jeu) : rien ne roule, on repose la pièce.
    if (!jet) { sel = null; cible = null; mode = null; choisirSeul(); rendre(); return; }
    attente = { jet, cote, appliquer, ou };
    deGlace = { jet, cote, r: ou.defaut.r, c: ou.defaut.c, n: ++noJet, dessous: dessousDe(ou.defaut, ou.cible) };
    flash = null;
    jouerSon('de');
    rendre();
  }

  /*
   * POURQUOI MA MAIN A FINI, lu dans ce que le moteur vient d'écrire. Le but
   * et le revirement se disaient ; le SIFFLET non (S74) : un hors-jeu, un
   * dégagement refusé ou une punition finissaient ta main et la barre disait
   * « Ta main est jouée », comme si tu l'avais passée.
   */
  const SIFFLETS_DE_MAIN = { horsjeu: 'Hors-jeu : coup de sifflet', icing: 'Dégagement refusé : coup de sifflet', punition: 'Punition : coup de sifflet', periode: 'Fin de la période' };
  function noterFinDeMain(avant) {
    const genres = m.fil.slice(0, Math.max(0, m.fil.length - avant)).map(e => e.genre);
    const sifflet = genres.find(g => SIFFLETS_DE_MAIN[g]);
    if (genres.includes('but')) finDeMain = 'But';
    else if (sifflet) finDeMain = SIFFLETS_DE_MAIN[sifflet];
    else if (genres.includes('mj')) finDeMain = 'Le gardien la gèle : coup de sifflet';
    else if (genres.includes('revirement')) finDeMain = 'Revirement : la main passe';
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
    // Si ce jet vient de finir ma main, la barre le dira pendant la sienne.
    noterFinDeMain(avant);
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
    /*
     * LA PIÈCE CHOISIE AVANT LE SIFFLET N'EXISTE PLUS (S75). `poser()` refait
     * les pièces à chaque mise au jeu ; quand la main restait à toi après ton
     * but, un hors-jeu ou le début d'une période, `sel` pointait encore
     * l'objet d'avant : le menu s'ouvrait sur une case vide, et un toucher
     * dépensait le patin sans que rien ne bouge. Même chose pour la cible.
     */
    if (sel && !enJeu(m, sel)) { sel = null; cible = null; mode = null; }
    if (cible && !enJeu(m, cible)) cible = null;
    if (!aMoi()) { sel = null; mode = null; return; }
    finDeMain = null;
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
    if (!m.fini && m.tour === 'A' && !receptionPossible(m) && !eqDe(m, 'A').pieces.some(aDesOptions)) {
      deGlace = null;
      finDeMain = finDeMain || 'Ta main est jouée';
      finirMain(m);
    }
    choisirSeul();
    rendre();
    if (!m.fini && m.tour === 'B' && !iaEnCours) tourAdverse();
  }

  function agir(o) {
    if (o.type === 'duel') { cible = o.cible; rendre(); return; }
    activer(m, sel);
    if (o.type === 'deplacer') {
      const piece = sel, vers = o.vers, ou = placesDe(piece, null), avant = m.fil.length;
      // LA ROUTE SE LIT AVANT DE PARTIR : après `deplacer`, la pièce est
      // arrivée et le moteur ne saurait plus par où elle est passée.
      montrerTrace(cheminVers(m, piece, vers));
      const d = deplacer(m, piece, vers);
      if (!d.ok) { trace = null; sel = null; mode = null; choisirSeul(); rendre(); return; }
      // Patiner d'une case libre ne demande pas de dé : le geste est déjà
      // joué, il ne reste qu'à dire ce que le moteur en a fait.
      if (!d.jet) { noterFinDeMain(avant); verdict(avant, ou, 'patin'); apres(); return; }
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
      presse = false;                         // la main revient : on regarde de nouveau à la vitesse du jeu
      choisirSeul();
      rendre();
      if (!m.fini && m.tour === 'B') tourAdverse();
    };

    const pas = () => {
      clearTimeout(minuteurIA);
      // La question du ✕ est ouverte : l'adversaire attend la réponse (S75b).
      if (enPause) { reprise.ia = pas; return; }
      // La minuterie est tombée avant la fin du trajet : on l'attend, on ne le saute pas (S75).
      if (enLecture()) { minuteurIA = setTimeout(pas, resteLecture() + 60); return; }
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
      // Un patin avec esquive : le dé tombe là d'où il PART (S74) — la pièce y
      // est encore à l'écran, la lecture la fera patiner après le jet.
      const depart = joue.type === 'deplacer' && m.patin && m.patin.piece === joue.piece ? m.patin.de : joue.piece;
      deGlace = joue.jet ? { jet: joue.jet, cote, r: depart.r, c: depart.c, n: ++noJet, dessous: dessousDe(depart, joue.cible) } : null;
      // Son dé roule aussi, et ses sons suivent le jet — le geste est déjà
      // joué, on le fait seulement entendre au rythme où on le lit.
      if (joue.jet) jouerSon('de');
      verdict(avant, placesDe(joue.piece, joue.cible || null), joue.jet ? joue.jet.quoi : (joue.type === 'deplacer' ? 'patin' : joue.type), joue.jet ? 0.3 : 0, cote);
      rendre();
      // Le geste suivant attend que la rondelle ait fini son trajet (S74) ; en accéléré, la pause aussi raccourcit.
      const pause = (joue.jet ? PAUSE_DE : PAUSE_SEC) / (presse ? 2 : 1);
      minuteurIA = setTimeout(pas, Math.max(pause, resteLecture() + (presse ? 80 : 220)));
    };
    /*
     * ON PEUT ACCÉLÉRER. JP : *skip automatique de message quand on clique*.
     * Un clic pendant qu'un trajet se lit l'accélère (S75) — il ne le vide
     * plus d'un coup, ce qui faisait glisser la rondelle et les dix pièces en
     * ligne droite — et la suite de sa main se joue en accéléré ; un second
     * clic la pose. Entre deux gestes, le clic joue le suivant tout de suite.
     * Rien n'est joué autrement : on regarde juste plus vite.
     */
    avancerIA = () => {
      if (enLecture()) {
        presse = true;
        toucherLecture();
        clearTimeout(minuteurIA);
        minuteurIA = setTimeout(pas, resteLecture() + 80);
        return;
      }
      presse = true;
      pas();
    };
    minuteurIA = setTimeout(pas, Math.max(320, resteLecture() + 180));
  }

  /*
   * UN BUT SE VOIT AVANT DE SE LIRE — ET PAS AVANT QU'IL ARRIVE (S75). Le
   * pointage montait d'un cran et c'était tout ; puis la bannière est venue,
   * mais elle et le pointage lisaient le MOTEUR : le but était au tableau
   * pendant que le dé de l'adversaire roulait encore. Un seul rattrapage sert
   * les deux camps, appelé quand la rondelle arrive (le pointage, la
   * bannière) et quand la lecture finit (tout le reste : le fil, la période,
   * la fin du match). Rend vrai quand un but vient d'être montré.
   */
  function rattraper(quoi = 'tout') {
    let but = false;
    for (const [c, eq] of [['A', A], ['B', B]]) {
      if (eq.buts > vu[c]) {
        but = true;
        eclat = { eq: c, texte: eq.nom };
        clearTimeout(minuteurEclat);
        minuteurEclat = setTimeout(() => { eclat = null; if (!regles) ecrire($('.t-tete'), tete() + banniere()); }, 1800);
      }
      vu[c] = eq.buts;
    }
    if (quoi === 'tout') Object.assign(vu, { fil: m.fil.length, fini: m.fini, periode: m.periode, prolongation: m.prolongation, possessions: m.possessions });
    return but;
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

  /*
   * L'APERÇU SOUS LE CURSEUR, sur un écran qui en a un. Un doigt ne survole
   * rien et toucher une case la JOUE, donc sur téléphone c'est la trace du
   * patin joué qui rend la route — d'où les deux. On ne redessine que la
   * couche du trait : un `rendre()` complet à chaque pixel de souris
   * repeindrait la glace entière.
   */
  if (auCurseur) {
    modal.addEventListener('pointermove', ev => {
      if (regles || attente || !sel || !aMoi() || trace) return;
      const cel = ev.target.closest && ev.target.closest('.t-case');
      const r = cel ? +cel.dataset.r : -1, c = cel ? +cel.dataset.c : -1;
      if (survol && survol.r === r && survol.c === c) return;
      const o = cel ? offre(r, c) : null;
      survol = o && o.type === 'deplacer' && o.vers ? { r, c, chemin: cheminVers(m, sel, o.vers) } : null;
      majTrace();
    });
    modal.addEventListener('pointerleave', () => { if (survol) { survol = null; majTrace(); } });
  }

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
    // Toucher la fusillade la montre d'un coup : on a le droit d'être pressé.
    if (t.closest('.t-barrage')) { t.closest('.t-barrage').classList.add('tout'); const mot = $('.t-dock .t-barrage-mot'); if (mot) mot.classList.add('tout'); return; }
    if (t.closest('.t-volet-btn')) { volet = !volet; rendre(); return; }
    if (t.closest('.t-volet-fermer')) { volet = false; rendre(); return; }
    if (t.closest('.t-feuille-suite')) { fermer(); return; }
    if (t.closest('.table-close')) { demanderFermer(); return; }
    // Pendant la présence adverse, un clic saute l'attente du geste suivant.
    if (iaEnCours) { if (avancerIA) avancerIA(); return; }
    // Pendant qu'un trajet se lit (S74), toucher la glace ou la barre l'accélère,
    // puis le pose (S75) — la main n'est pas jouable tant qu'on regarde l'ancienne glace.
    if (enLecture() && (t.closest('.t-plateau') || t.closest('.t-dock'))) { toucherLecture(); return; }
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
    // Le ✕ de la carte de commandes : on repose la pièce, la glace se dégage.
    if (t.closest('.t-cmd-fermer')) { sel = null; cible = null; mode = null; rendre(); return; }
    if (t.closest('.t-annuler')) { cible = null; mode = null; rendre(); return; }
    if (t.closest('.t-fin-tour')) { sel = null; cible = null; mode = null; deGlace = null; finDeMain = 'Main passée'; finirMain(m); apres(); return; }
    if (t.closest('.t-passer')) { sel = null; cible = null; mode = null; deGlace = null; flash = null; finDeMain = 'Main passée sans jouer'; renoncer(m); apres(); return; }
    // LE FILET DÉSERT SE DÉCIDE ICI (1.0 · J4-P2) : le moteur le permettait à
    // l'IA seule ; le joueur a maintenant le même bouton, aux mêmes conditions.
    if (t.closest('.t-desert')) {
      if (aMoi() && retirerGardien(m, 'A')) { jouerSon('tap'); volet = false; sel = null; cible = null; choisirSeul(); }
      rendre();
      return;
    }
    // LE « ? » D'UN GESTE : sa règle, écrite dans le fil.
    const aide = t.closest('.t-aide');
    if (aide) { expliquerGeste(m, aide.dataset.aide); rendre(); return; }
    const uni = t.closest('.t-seg button');
    if (uni) {
      // LE BANC N'EST OUVERT QUE PENDANT TA MAIN (1.0 · J4-P3) : le moteur le
      // refuse aussi, l'écran ne fait pas semblant.
      if (!aMoi()) return;
      const quoi = uni.parentElement.dataset.u, v = +uni.dataset.v;
      if (changerUnite(m, 'A', quoi === 'tri' ? v : A.tri, quoi === 'pai' ? v : A.pai)) jouerSon('tap');
      volet = false;
      sel = null; cible = null; choisirSeul(); rendre();
      return;
    }
  };

  /*
   * LE ✕ DEMANDE AVANT DE LAISSER FILER LE MATCH (S75). Il le jouait jusqu'au
   * bout sans un mot : un enfant qui touche ✕ pour « fermer » voyait son match
   * fini, perdu, et compté au classement — le passage du testeur l'a fait par
   * accident. Même question que le ✕ de l'écran de saison (S74b). Un match
   * fini se ferme sans question : il n'y a plus rien à perdre.
   */
  /*
   * ET LE MATCH S'ARRÊTE PENDANT QU'ON RÉFLÉCHIT (S75b). L'adversaire
   * continuait sa main derrière la question, et « Non, je reste » ramenait
   * sur une glace qui avait bougé sans toi. La lecture et la main adverse
   * se suspendent au pas suivant (`enPause`) et reprennent là où elles
   * étaient ; seul le mouvement déjà lancé finit sa course.
   */
  function reprendre() {
    if (!enPause) return;
    enPause = false;
    const r = { ...reprise };
    reprise.lecture = false; reprise.ia = null;
    if (r.lecture) enchainer();
    if (r.ia) r.ia();
  }

  function demanderFermer() {
    if (m.fini) { fermer(); return; }
    enPause = true;
    ouvrirChoix({
      ico: '🏒', titre: 'Quitter le match ?', genre: 'confirmer', fermable: true, motFermer: 'Rester',
      recit: `Le reste du match se joue sans toi, d'un coup, et le résultat compte. C'est ${vu.A} – ${vu.B}, ${vu.prolongation ? 'en prolongation' : `en ${ordP(vu.periode)} période`}.`,
      options: [
        { cle: 'quitter', ico: '⏩', nom: 'Oui, qu\'il se joue sans moi', bon: 'Le résultat tout de suite', prix: 'Tu ne joues plus ce match' },
        { cle: 'rester', ico: '🏒', nom: 'Non, je reste', bon: 'On continue à jouer' },
      ],
      onChoix: k => { if (k === 'quitter') { enPause = false; fermer(); } else reprendre(); },
      onFerme: reprendre,
    });
  }

  function fermer() {
    // Fermer avant la fin, c'est laisser jouer le reste : le match compte au
    // classement, on ne peut pas s'en sauver.
    let garde = 0;
    while (!m.fini && garde++ < 4000) iaPresence(m);
    /*
     * LES MINUTERIES MEURENT AVEC LE MATCH. La présence adverse, le verdict et
     * la bannière d'un but se lisent sur des minuteries, et fermer ne les
     * coupait pas : un match rouvert dans la foulée (« Un autre match » en
     * exhibition, ou le tournoi qui enchaîne) héritait d'un `rendre()` du
     * match d'AVANT, qui repeignait la glace neuve avec un match fini. Le
     * modale est partagé, donc les fermetures de l'un sont le décor de
     * l'autre.
     */
    clearTimeout(minuteurIA); clearTimeout(minuteurFlash); clearTimeout(minuteurEclat); clearTimeout(minuteurTrace);
    clearTimeout(minuteurLecture); clearTimeout(minuteurSifflet); fileLecture = []; minuteurLecture = 0;
    iaEnCours = false; avancerIA = null;
    modal.style.display = 'none';
    document.body.style.overflow = '';
    modal.onclick = null;
    onTermine(resultatDe(m));
  }

  // Le niveau se lit sur la première ligne (S75) : sur la seconde, il la faisait passer sur deux lignes à 390 px.
  $('.t-titre').innerHTML = `<span class="t-titre-1">${esc(titre)} · ${niveau === 'RECRUE' ? 'Recrue' : 'Pro'}</span><span class="t-titre-2">${esc(sousTitre)}</span>`;
  // Pas d'écouteur direct sur le bouton « ? » : `modal.onclick` le sert déjà
  // par délégation, et les deux ensemble basculaient le volet deux fois — il
  // s'ouvrait et se refermait dans le même clic.
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  choisirSeul();
  rendre();
  if (m.tour === 'B') tourAdverse();
}
