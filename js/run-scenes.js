/*
 * LES SCÈNES DU ROGUE (V30, docs/refonte-v30-2.md § 3.8 ; JP, 16 nov. 2026 : *bureau EHM, match illustré* ; 17 nov. : les
 * écrans se codent sans tour de maquettes). Chaque scène est une fonction pure : la séance `S` (js/run.js) et la vue `V` (ce
 * que l'écran regarde : l'onglet, le joueur tenu, la porte ouverte, la place dont il dispose) rendent le HTML de la scène.
 * Un bouton porte `data-a` (son geste) et `data-v` (sa valeur) ; js/run-jeu.js les joue. Les cartes sont celles du jeu,
 * telles quelles.
 *
 *   EN FLUIDE   (V31, docs/refonte-v31.md ; JP, 25 nov. 2026 : *tout le Rogue en fluide*) : une scène rend ses morceaux dans
 *               l'ordre où on les lit (l'en-tête, les onglets, le milieu, le bas) et aucune position ; la feuille les range,
 *               du téléphone à l'ordinateur. Plus aucune scène ne pose un bloc au pixel (tranche 3).
 *   LE BUREAU   l'accueil : cinq onglets (Bureau, Alignement, Masse, Ligue, Mon club), des tableaux denses ; un tableau
 *               plus long que sa boîte défile DANS sa boîte, et dès qu'il y a la place les panneaux se rangent en colonnes.
 *   LE MATCH    la feuille du soir, les portes, l'échange : illustrés, comme à la V28. Le match lui-même se suit au direct
 *               du jeu (js/direct.js, que js/run-jeu.js ouvre) ; son résultat est son sommaire complet (JP, 25 nov. 2026).
 *   L'ALLURE    celle du 82-0 (JP, 17 nov. 2026 : *interface plus proche du 82-0*, *seulement l'allure*) : son en-tête (ton
 *               écusson, l'état, les chiffres en cellules, le menu), ses boutons (`.btn`), ses icônes aux onglets, ses
 *               visages à la tête des lignes de joueurs ; les couleurs sont les jetons du jeu (style.css).
 */
import { SLOTS, activeLineup, badgesDe, energieDe, jambesGardien, getHiddenRatings, getPlayerKey, PALIERS } from './sim.js';
import { INTENTIONS } from './greffes.js';
import { PIECES, PIECE_DU_COACH, CASES_DU_BANC, apportDe, compteDe, marcheDe, seuilSuivant, forceDeLaPiece } from './pieces.js';
import { COACHS, REGLES_DU_COACH, VOIES } from './coachs.js';
import { PRESTIGES, EXIGENCES, voiesOuvertes, prixDeLaVoie, ecussonsAVie, cranOuvert } from './rogue.js';
import { LEGENDES } from './cartable.js';
import { motDuRang, niveauDuCoach } from './coachs-reels.js';
import { NIVEAUX, nomDuNiveau, groupeDuJoueur as groupeDe } from './niveaux.js';
import { PRIX_PIECE } from './actes.js';
import { lignesDeLaPiece, motsDeStats } from './impact.js';
import { cartonDe, varsEquipe } from './repechage.js';
import { carteHtml, carteDePiece, pochetteHtml } from './cartes.js';
import { getTeamBand, getTeamLogoHtml, couleurVive, separe } from './logos.js';
import { NOM_VARIANTE } from './rarete.js';
import { TEAMFULL, headshotHtml, ico } from './game.js';
import { sommaireHtml } from './bilan.js';
import { nomCourt } from './recit.js';
import { esc, money, pct3, ord, varsCarton } from './util.js';
import {
  RUN, masseDe, espaceDe, prixDe, masseApres, vestiaireDe, sortantsPour, accordsDe, siTenu, editionDe, jeuDe, leurBanc, signesDe, effectifDe, prixDeLaRelance, reglesDe, aMonter,
  budgetDuTour, vestiaireDuRepechage, classement, rangDe, clubNo, meneursDe, matchNo, prochainSoir, etatDeLObjectif, histoireDuJour, pochetteLibre, offresVues, dernierMatch, matchPasse, STATS, STATS_G,
  joueurDeLaRun, derniersMatchsDe, gardiensDe, CLUB,
} from './run.js';

/* ---------- les petites briques ---------- */
const ROMAINS = ['I', 'II', 'III', 'IV'];
const coeur = plein => `<svg class="rn-co${plein ? '' : ' rn-vide'}" viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21.2 2.6 11.6a6.1 6.1 0 0 1 8.6-8.6l.8.8.8-.8a6.1 6.1 0 0 1 8.6 8.6z"/></svg>`;
const bt = (mot, a, { cls = '', v = '', petit = '', off = false } = {}) => `<button type="button" class="btn rn-bt${cls ? ` ${cls}` : ''}" data-a="${a}"${v !== '' ? ` data-v="${esc(v)}"` : ''}${off ? ' disabled' : ''}>${mot}${petit ? `<small>${petit}</small>` : ''}</button>`;
const bas = (...boutons) => `<footer class="rn-bas">${boutons.join('')}</footer>`;
const logo = (t, n = 46) => getTeamLogoHtml(t, n);
/* « Bruins de Boston » : son surnom, sa ville. */
const surnom = t => String(TEAMFULL[t] || t).split(/ (?:de |du |des |d['’])/)[0];
const ville = t => String(TEAMFULL[t] || t).split(/ (?:de |du |des |d['’])/)[1] || surnom(t);
const clubMot = c => `${surnom(c.t)} ${c.s}`;
const clubCourt = c => `${surnom(c.t)} ${c.s.slice(2, 4)}-${c.s.slice(5)}`;
const court = p => nomCourt(p && p.n);
const maj = s => s.charAt(0).toUpperCase() + s.slice(1);
const pluriel = (n, mot, s = 's') => `${n} ${mot}${n > 1 ? s : ''}`;
const jambes = ps => (ps.length ? Math.round(ps.reduce((a, p) => a + energieDe(p), 0) / ps.length) : 100);
const jambesDe = p => Math.round(p.p === 'G' ? jambesGardien(p) : energieDe(p));
const carteJ = p => `<span class="rn-c rn-cj" style="${varsEquipe(p)}">${cartonDe(p, { rar: editionDe(p) })}</span>`;
const carteP = cle => `<span class="rn-c">${carteDePiece(cle, { lecture: true, statique: true })}</span>`;
/* Les trois marches d'une pièce, en points. */
const points = marche => `<span class="rn-or">${'●'.repeat(marche)}</span><span class="rn-gris">${'○'.repeat(3 - marche)}</span>`;
/*
 * CE QU'UNE PIÈCE COMPTE CHEZ TOI (V29) : son compte chez tes signés, le seuil d'après, ses marches, et ce qu'elle rend en
 * vraies stats de match — sous sa première marche, ce que la première rendrait. Aucun mot de code, aucun pourcentage.
 */
function ligneCourte(S, cle) {
  const P = PIECES[cle], n = compteDe(cle, signesDe(S)), marche = marcheDe(cle, n), suivant = seuilSuivant(cle, n);
  const l = lignesDeLaPiece(cle, marche || 1, forceDeLaPiece(S.toi.perso, cle))[0], effet = l ? esc(l.txt.charAt(0).toLowerCase() + l.txt.slice(1)) : '';
  return `${Math.floor(n)}${suivant != null ? ` / ${suivant}` : ''} ${points(marche)}${effet ? `<br>${marche ? effet : `À ${P.seuils[0]} : ${effet}`}` : ''}`;
}
const ligneDe = (S, cle) => `Compte ${esc(PIECES[cle].qui)} · ${ligneCourte(S, cle)}`;
/* Avant le repêchage, personne n'est signé : ce qu'elle compte et ses trois seuils. */
const ligneSansRun = cle => `Compte ${esc(PIECES[cle].qui)} · à ${PIECES[cle].seuils.join(', ')}`;
const icoDuBadge = (p, cle) => { const b = badgesDe(p).find(x => x.cle === cle); return b ? b.ico : ''; };
const icosDeLAccord = x => `${icoDuBadge(x.a, x.aff.a[1])}${icoDuBadge(x.b, x.aff.b[1])}`;
const badgeMot = p => { const b = badgesDe(p)[0]; return b ? `${b.ico} ${esc(b.nom)} ${PALIERS[b.palier].nom}` : ''; };
const badgesHtml = p => badgesDe(p).slice(0, 2).map(b => `<i class="pal-${b.palier}" title="${esc(b.nom)} ${PALIERS[b.palier].nom}">${b.ico}</i>`).join('');
/* Ce qu'un joueur ajoute à ton banc : « 🦍 +2 », pour chaque pièce qui le compte. */
const apportsHtml = (S, p) => S.R.banc.map(k => [k, apportDe(k, p)]).filter(x => x[1] > 0).map(([k, n]) => `${PIECES[k].ico} +${String(n).replace('.', ',')}`).join(' · ');
/* Le visage d'un joueur à la tête de sa ligne de tableau : le rond des listes du 82-0 (`.rond-visage`), sa photo recadrée, sa silhouette sinon. */
const visage = p => `<span class="rond-visage rn-vis" aria-hidden="true">${headshotHtml(p)}</span>`;
const rangTxt = n => `${n}${n === 1 ? 'er' : 'e'}`;
/* Un écart avec son signe (« +12 », « −3 »), un nombre à virgule. */
const signe = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const virgule = (x, d = 1) => x.toFixed(d).replace('.', ',');
const ficheMot = f => `${f[0]}-${f[1]}-${f[2]}`;
/*
 * L'EN-TÊTE, toujours au même endroit, bâti comme celui du 82-0 (JP, 17 nov. 2026) : ton écusson, où tu en es (le quart, le
 * match), puis tes chiffres en cellules — ton rang et tes points, tes jetons, tes cœurs dessinés — et le menu. Rien de ce
 * qu'il dit ne se répète dans la scène.
 */
function hud(S, { titre = null, petit = null, rang = true, bourse = true, pause = true } = {}) {
  const R = S.R, L = R.ligue, enSerie = !!R.series, n = R.matchs.length;
  const nom = titre || (enSerie ? 'Les séries' : R.quart ? `Quart ${ROMAINS[R.quart.n]}` : 'Le départ');
  const sous = petit != null ? petit : enSerie || !R.quart ? '' : `Match ${Math.min(RUN.LIGUE.MATCHS, n + (R.phase === 'resultat' || R.phase === 'bilan' || R.phase === 'marche' ? 0 : 1))} de ${RUN.LIGUE.MATCHS}`;
  const place = rang && L && !enSerie ? rangDe(S, 0) : null;
  return `<header class="rn-hud">${logo('YOU', 34)}
    <span class="rn-acte">${nom}${sous ? `<small>${sous}</small>` : ''}</span>
    ${place ? `<span class="rn-cible${place <= RUN.LIGUE.PLACES ? ' rn-on' : ''}"><b>${rangTxt(place)}</b><small>${2 * L.fiches[0][0] + L.fiches[0][2]} pts</small></span>` : ''}
    ${bourse ? `<span class="rn-jt"><i class="rn-piece"></i>${R.jetons}</span>` : ''}
    <span class="rn-coeurs" role="img" aria-label="${R.coeurs} cœur${R.coeurs > 1 ? 's' : ''} sur ${RUN.COEURS}">${Array.from({ length: RUN.COEURS }, (_, i) => coeur(i < R.coeurs)).join('')}</span>
    ${pause ? `<button type="button" class="rn-pause" data-a="pause" aria-label="Pause"><i>${ico('i-menu')}</i></button>` : ''}
  </header>`;
}
const banc = (S, { joue = null, libre = false } = {}) => `<div class="rn-banc">${
  S.R.banc.map(k => `<span class="${joue ? (joue.includes(k) ? 'rn-joue' : 'rn-eteinte') : ''}">${carteP(k)}</span>`).join('')
}${Array.from({ length: CASES_DU_BANC - S.R.banc.length }, (_, i) => `<span class="rn-vide${libre && i === 0 ? ' rn-on' : ''}"></span>`).join('')}</div>`;
/* La jauge du plafond : `masse` (la tienne, ou celle d'après un échange), dont ce qui arrive (`neuf`) et ce que les joueurs sortis y laissent (`mort`). */
const plafond = (S, { masse = masseDe(S), neuf = 0, mort = 0 } = {}) => {
  const pc = x => `${Math.max(0, Math.min(100, (100 * x) / S.R.plafond)).toFixed(1)}%`, base = masse - neuf - mort;
  return `<div class="rn-plaf"><i style="width:${pc(base)}"></i>${neuf ? `<i class="rn-neuf" style="left:${pc(base)};width:${pc(neuf)}"></i>` : ''}${mort ? `<i class="rn-mort" style="left:${pc(base + neuf)};width:${pc(mort)}"></i>` : ''}</div>`;
};
/* Ton plafond en panneau, partout où l'on signe : la masse, le plafond, ton espace, la jauge. `apres` : la masse d'après un échange, sa jauge et sa phrase. */
const panneauDuPlafond = (S, { apres = null, jauge = plafond(S, { mort: S.R.mort || 0 }), sous = '' } = {}) => `<section class="rn-panneau"><div class="rn-entete"><span class="rn-k">Ton plafond</span><span class="rn-t${apres != null && apres > S.R.plafond ? ' rn-rg' : ''}">${money(apres ?? masseDe(S))} <span class="rn-gris">/ ${money(S.R.plafond)}</span>${apres == null ? ` · <span class="rn-or">Espace ${money(espaceDe(S))}</span>` : ''}</span></div>${jauge}${sous}</section>`;
/* Un tableau : ses colonnes (`cols`, une grille), sa tête, ses lignes ; une ligne qu'on touche est un bouton de 44 px. */
const tableau = (cols, tete, lignes, cls = '') => `<div class="rn-tab${cls ? ` ${cls}` : ''}" style="--cols:${cols}"><div class="rn-l rn-tete">${tete.map(x => `<span>${x}</span>`).join('')}</div>${lignes.join('')}</div>`;
const ligne = (cellules, { cls = '', a = '', v = '' } = {}) => (a ? `<button type="button" class="rn-l${cls ? ` ${cls}` : ''}" data-a="${a}" data-v="${esc(v)}">` : `<div class="rn-l${cls ? ` ${cls}` : ''}">`) + cellules.map(x => `<span>${x}</span>`).join('') + (a ? '</button>' : '</div>');

/* ---------- l'attente, le départ ---------- */
export const sceneAttente = mot => `<main class="rn-milieu rn-attente"><i></i><span>${esc(mot)}</span></main>`;
/* La carte d'un entraîneur (`x` : sa philosophie, son rang, son nom, son club et sa saison) : au loto du départ, à l'Album. */
const carteDuCoachHtml = x => carteHtml({ cle: 'coach', niveau: niveauDuCoach(x.rang) - 1, genreCarte: 'synergie', ico: COACHS[x.cle].ico, nomHtml: esc(x.n), typeHtml: esc(clubMot({ t: x.tag, s: x.saison })),
  statique: true, lecture: true, style: varsCarton(getTeamBand(x.tag)) });
/* L'en-tête d'une scène sans run (le départ, le repêchage, la fin, le Club, le solde) : la même bande, à la même place — ton écusson, où tu es, et à droite ce que la scène compte. */
const entete = (titre, petit = '', droite = '') => `<header class="rn-hud">${logo('YOU', 34)}<span class="rn-acte">${titre}${petit ? `<small>${petit}</small>` : ''}</span>${droite}</header>`;
/* Deux blocs sous ce qui les coiffe (le segment des pages du Club) : il reste à sa place d'une page à l'autre. */
const sousTete = (nom, tete, offre, toi) => milieu(`${tete}<div class="rn-comptoir" data-defile="${nom}">${colonne(`${nom}-offre`, offre)}${colonne(`${nom}-toi`, toi)}</div>`, 'rn-tables');
/* Une lecture d'un trait, bornée (l'ouverture du quart, le bilan, le solde, le départ) : rien à peser, on lit et on avance. */
const trait = (nom, html) => milieu(html, 'rn-lecture rn-trait', nom);
/*
 * LE DÉPART (JP, 25 nov. 2026 : *moins de choix de cartes, plus de cartes imposées*). Ton entraîneur est tiré pour toi : sa
 * carte, sa philosophie, sa règle, sa pièce de départ. Tes crans d'exigence, si une Coupe les a ouverts. Le Club est dans
 * l'en-tête. « Commencer » tire ton club de ton cartable.
 */
export function sceneDepart(V) {
  const c = V.loto[0], C = COACHS[c.cle], regle = REGLES_DU_COACH[c.cle], piece = PIECE_DU_COACH[c.cle], k = niveauDuCoach(c.rang) - 1;
  return `${entete('Le départ', `Run ${V.numero}`, `<button type="button" class="rn-bande" data-a="club" aria-label="Le Club, ${V.medailles} médailles">Le Club${medailles(V.medailles)}</button>`)}${trait('depart', `
  ${V.arret != null ? `<div class="rn-t rn-gris">Le Rogue est devenu une saison : ta run d'avant s'arrête. <span class="rn-or">+${V.arret} médailles</span></div>` : ''}
  ${chapeau('Ton entraîneur, cette run', 'Tiré pour toi')}
  <section class="rn-panneau rn-on rn-vignette"><span class="rn-c">${carteDuCoachHtml(c)}</span><div>
    <div class="rn-entete"><b class="rn-h">${esc(c.n)}</b><span class="rn-puce rn-o">${esc(nomDuNiveau(k))}</span></div>
    <div class="rn-t rn-gris">${esc(clubMot({ t: c.tag, s: c.saison }))} · ${c.fiche.v}-${c.fiche.d}-${c.fiche.n}${c.coupe ? ' · la Coupe' : ''}<br>${C.ico} ${esc(C.nom)} : ${esc(motDuRang(c.cle, c.rang))}, cette saison-là.</div>
    ${regle ? `<div class="rn-t rn-pied"><span class="rn-k">Sa règle</span><br>${esc(maj(regle.dit))} : <span class="rn-or">+${regle.jetons} jetons</span> le soir.</div>` : ''}</div></section>
  <section class="rn-panneau rn-vignette">${carteP(piece)}<div class="rn-t"><span class="rn-k">Sa pièce de départ${NIVEAUX[k].maitrise !== 1 ? ` · ×${String(NIVEAUX[k].maitrise).replace('.', ',')}` : ''}</span><br><b>${esc(PIECES[piece].nom)}</b><br><span class="rn-gris">${ligneSansRun(piece)}</span></div></section>
  <div class="rn-t rn-gris">Ton club sort de ton cartable : dix-sept joueurs au plus, deux pièces de banc. Tu repêches le reste.</div>
  ${V.cranMax > 0 ? `<div class="rn-crans">${Array.from({ length: EXIGENCES.length + 1 }, (_, n) => `<button type="button" class="${n === V.cran ? 'rn-on' : ''}" aria-pressed="${n === V.cran}" data-a="cran" data-v="${n}"${n > V.cranMax ? ' disabled' : ''}><b>${n}</b>${n ? esc(EXIGENCES[n - 1].court) : 'Sans exigence'}</button>`).join('')}</div>` : ''}`)}
  ${bas(bt('Menu', 'quitter'), bt('Commencer', 'prendre-coach', { cls: 'go' }))}`;
}
/* Un titre de scène : son étiquette, puis sa ligne. */
const chapeau = (k, h, cls = '') => `<div class="rn-chapo${cls ? ` ${cls}` : ''}"><div class="rn-k">${k}</div><div class="rn-h">${h}</div></div>`;
/* Une pièce offerte (le départ, le rival battu, l'élite gagnée) : trois cartes, chacune avec ce qu'elle compte chez toi. */
function etalDePieces(S, V, ici = false) {
  const R = S.R, o = R.apres.offertes, choisie = o.includes(V.piece) ? V.piece : o[0];
  const ligneDeLaPiece = k => (R.ligue ? ligneCourte(S, k) : `Compte ${esc(PIECES[k].qui)}<br>à ${PIECES[k].seuils.join(', ')}`);
  return `<div class="rn-etal">${o.map(k => `<button type="button" class="${k === choisie ? 'rn-on' : ''}" aria-pressed="${k === choisie}" data-a="voir-piece" data-v="${k}"${ici && k === choisie ? ' data-ici' : ''}>${carteP(k)}<p${k === choisie ? ' class="rn-or"' : ''}>${ligneDeLaPiece(k)}</p></button>`).join('')}</div>`;
}
/*
 * TON BANC QUAND UNE PIÈCE ARRIVE. Une case libre : ses cartes en rangée. Plein, on choisit celle qui sort : pièce par pièce
 * avec son compte et ses marches (JP, 25 nov. 2026 : *partout où on décide*), à toutes les largeurs. `ferme` : plus rien à sortir.
 */
function bancQuiRecoit(S, V, ferme = false) {
  const R = S.R, plein = R.banc.length >= CASES_DU_BANC, tete = `<div class="rn-k">Ton banc${plein ? ' · plein : touche celle qui sort' : ' · une case libre'}</div>`;
  if (plein && !ferme) return `<div class="rn-pilier">${tete}${R.banc.map(k => { const n = compteDe(k, signesDe(S)), suivant = seuilSuivant(k, n); return `<button type="button" class="rn-sortie${V.sort === k ? ' rn-on' : ''}" aria-pressed="${V.sort === k}" data-a="piece-sort" data-v="${k}"><span>${PIECES[k].ico} ${esc(PIECES[k].nom)}</span><b>${Math.floor(n)}${suivant != null ? ` / ${suivant}` : ''}</b>${points(marcheDe(k, n))}${V.sort === k ? '<em>Elle sort</em>' : ''}</button>`; }).join('')}</div>`;
  return `<div class="rn-pilier">${tete}<div class="rn-banc">${R.banc.map(k => `<span>${carteP(k)}</span>`).join('')}${Array.from({ length: CASES_DU_BANC - R.banc.length }, (_, i) => `<span class="rn-vide${i === 0 ? ' rn-on' : ''}"></span>`).join('')}</div></div>`;
}
/* ---------- le repêchage : ce qui manque à ton club imposé ---------- */
const vraie = p => (p.p === 'G' ? `${p.w || 0} victoires, ${pct3(p.sv || 0)} d'efficacité en ${p.gp} matchs` : `${p.g || 0} buts, ${p.pt ?? (p.g || 0) + (p.a || 0)} points en ${p.gp} matchs`);
/* Ton banc en lignes serrées : ce qu'il compte déjà, et le seuil d'après. */
const bancEnLignes = S => S.R.banc.map(k => { const n = compteDe(k, signesDe(S)), suivant = seuilSuivant(k, n); return `<span>${PIECES[k].ico} ${esc(PIECES[k].nom)} <b>${Math.floor(n)}${suivant != null ? ` / ${suivant}` : ''}</b> ${points(marcheDe(k, n))}</span>`; }).join('');
const panneauDuBanc = S => (S.R.banc.length ? `<section class="rn-panneau"><div class="rn-k">Ton banc</div><div class="rn-enlignes">${bancEnLignes(S)}</div></section>` : '');
/*
 * LES JOUEURS D'UN VESTIAIRE (le repêchage, une porte, une pochette) : ceux qui tiennent, le plus fort en tête — autant que
 * l'écran en montre d'un coup, sans défiler : trois, quatre ou six de front par la largeur (`DE_FRONT`), sur une, deux ou
 * trois rangées par la hauteur (`RANGEES` ; au téléphone, toujours deux). S'il en reste, la dernière tuile mène à la page
 * suivante, dit sa page et revient à la première. Rend la grille et le joueur choisi. `ici` : le choisi porte le focus du clavier.
 */
const DE_FRONT = { etroit: 3, moyen: 4, large: 6 }, RANGEES = { court: 1, moyen: 2, haut: 3 };
export const tuilesDe = V => (DE_FRONT[V.largeur] || 3) * (etroit(V) ? 2 : RANGEES[V.hauteur] || 2);
function vestiaireVu(S, V, dedans, mot, ici = false) {
  const tuiles = tuilesDe(V), n = dedans.length <= tuiles ? tuiles : tuiles - 1;
  const pages = Math.max(1, Math.ceil(dedans.length / n)), page = (V.page || 0) % pages, vus = dedans.slice(page * n, (page + 1) * n);
  const choisi = dedans.find(x => getPlayerKey(x.p) === V.joueur) || vus[0] || null;
  const tuile = x => { const a = apportsHtml(S, x.p); return `<button type="button" class="${choisi === x ? 'rn-on' : ''}" aria-pressed="${choisi === x}" data-a="voir-joueur" data-v="${getPlayerKey(x.p)}"${ici && choisi === x ? ' data-ici' : ''}>${carteJ(x.p)}${a ? `<span class="rn-coin">${a}</span>` : ''}<span class="rn-sousc">${money(prixDe(S, x.p))}</span></button>`; };
  const autres = pages > 1 ? `<button type="button" class="rn-plie" data-a="page-porte">${pluriel(dedans.length - vus.length, 'autre')}<br>dans ton<br>${mot}<small>Page ${page + 1} de ${pages}</small></button>` : '';
  return { choisi, grille: `<div class="rn-grille" style="--n:${DE_FRONT[V.largeur] || 3}">${vus.map(tuile).join('')}${autres}</div>` };
}
/* Le joueur choisi d'un vestiaire : son année, son badge, ce qu'il ajoute à ton banc, l'accord qu'il allume. */
function leChoisi(S, choisi, vide) {
  if (!choisi) return `<section class="rn-panneau"><div class="rn-t rn-gris">${vide}</div></section>`;
  const acc = accordQuIlAllume(S, choisi.p), apport = apportsHtml(S, choisi.p);
  return `<section class="rn-panneau"><div class="rn-entete"><b class="rn-h">${esc(choisi.p.n)}</b><span class="rn-h rn-or">${money(prixDe(S, choisi.p))}</span></div>
    <div class="rn-t rn-gris">Cette année-là : ${vraie(choisi.p)}.<br>${badgeMot(choisi.p)}${apport ? ` · <span class="rn-vert">ton banc : ${apport}</span>` : ''}${acc ? ` · il allume <span class="rn-vert">${esc(acc.aff.nom.charAt(0).toLowerCase() + acc.aff.nom.slice(1))}</span>` : ''}</div></section>`;
}
/*
 * LE REPÊCHAGE. Ton club est déjà là, tiré de ton cartable ; il reste quelques tours pour le finir. Ce qu'on te tend : le
 * vestiaire qui sort (de toute la ligue) et ses joueurs qui tiennent dans le budget du tour. Ton côté : le joueur choisi,
 * ton banc en lignes, et ton club tel qu'il est (ses cartes : celles de ton cartable, puis ceux que tu repêches ; un nom
 * ouvre sa fiche). Au clavier, le focus est sur le joueur choisi : « Entrée » ne repêche pas à ta place.
 */
export function sceneRepechage(S, V) {
  const R = S.R, rep = R.rep, debut = rep.debut || 0, tous = vestiaireDuRepechage(S), { choisi, grille } = vestiaireVu(S, V, tous.filter(x => x.tient), 'budget', true);
  const n = { F: 0, D: 0, G: 0 }, miens = effectifDe(S);
  for (const p of miens) n[groupeDe(p)]++;
  return `${entete('Le repêchage', `Tour ${rep.tour - debut + 1} de ${23 - debut}`, `<span class="rn-cible"><b>${money(Math.max(0, R.plafond - RUN.ESPACE - masseDe(S)))}</b><small>À dépenser</small></span>`)}${comptoir('repechage',
    `<div class="rn-plaque">${rep.secours ? '' : logo(rep.club.t)}<div class="rn-nom">${rep.secours ? 'Les joueurs autonomes' : esc(clubMot(rep.club))}<small>Ce tour : ${money(Math.max(0, budgetDuTour(S)))} au plus</small></div></div>${grille}`,
    `${leChoisi(S, choisi, 'Personne ici ne tient dans le budget de ce tour. Relance la roulette.')}
    <section class="rn-panneau rn-tonclub">${R.banc.length ? `<div class="rn-enlignes">${bancEnLignes(S)}</div>` : ''}<div class="rn-k">Ton club${R.imposes.length ? ` · ${R.imposes.length} de ton cartable` : ''}</div>
      ${miens.length ? [['F', 'Avants'], ['D', 'Défenseurs'], ['G', 'Gardiens']].map(([g, mot]) => `<div class="rn-t"><span class="rn-gris">${mot} ${n[g]} ·</span> ${miens.filter(p => groupeDe(p) === g).map(p => esc(court(p))).join(', ') || '—'}</div>`).join('') : '<div class="rn-t rn-gris">Ton cartable est vide : cette run, tu repêches tout ton club.</div>'}</section>`)}
  ${bas(bt('Relancer', 'relancer-roulette', { petit: rep.secours ? 'Plus de vestiaire' : `Il t'en reste ${rep.relances}`, off: rep.relances <= 0 || !!rep.secours }), bt(choisi ? `Repêcher ${esc(court(choisi.p))}` : 'Repêcher', 'repecher', { cls: 'go', v: choisi ? getPlayerKey(choisi.p) : '', off: !choisi }))}`;
}

/* ---------- l'ouverture du quart : le proprio, le rival ---------- */
const NOM_DE_L_OBJECTIF = { points: 'Les points', rival: 'Le rival', place: 'Ta place', gros: 'Tes affiches', hockey: 'Son hockey' };
/* Ce qu'un objectif demande, en une ligne : le chiffre, et où tu en es. */
function objectifDit(S, o) {
  const R = S.R, Q = R.quart, rival = clubNo(S, Q.rival);
  return { points: `${o.cible} points en ${Q.fin - Q.debut} matchs`, rival: `Battre ${esc(surnom(rival.t))}, au match ${Number(Object.keys(Q.gros).find(k => Q.gros[k] === 'rival')) + 1}`,
    place: `Finir ${o.cible === 1 ? 'premier' : `dans les ${o.cible} premiers`}`, gros: `Gagner ${o.cible} de tes ${RUN.AFFICHES} affiches`,
    hockey: `${maj((REGLES_DU_COACH[R.coach.cle] || { dit: 'jouer son hockey' }).dit)}, ${o.cible} soirs` }[o.sorte];
}
const etatDit = (o, fini) => (o.sorte === 'place' ? rangTxt(o.valeur) : o.sorte === 'rival' ? (o.tenu ? 'Battu' : fini ? 'Perdu' : 'À battre') : `${o.valeur} / ${o.cible}`);
const objectifsHtml = (S, fini = null) => (fini || S.R.quart.objectifs.map(o => ({ ...o, ...etatDeLObjectif(S, o) }))).map(o => `<div class="rn-obj${o.tenu ? ' rn-on' : ''}"><b>${NOM_DE_L_OBJECTIF[o.sorte]}</b><span>${objectifDit(S, o)}</span><em${fini && !o.tenu ? ' class="rn-rg"' : ''}>${etatDit(o, !!fini)}</em></div>`).join('');
/* L'OUVERTURE DU QUART : ce que le proprio demande, le rival, tes gros matchs. On lit, on avance : d'un trait. */
export function sceneQuart(S) {
  const R = S.R, Q = R.quart, rival = clubNo(S, Q.rival), kRival = Number(Object.keys(Q.gros).find(k => Q.gros[k] === 'rival')), mRival = matchNo(S, kRival), jeu = jeuDe(S, rival), I = INTENTIONS[jeu.dominante];
  const kElite = Object.keys(Q.gros).find(k => Q.gros[k] === 'elite'), elite = kElite != null ? clubNo(S, matchNo(S, Number(kElite)).i) : null;
  return `${hud(S, { petit: `Matchs ${Q.debut + 1} à ${Q.fin}` })}${trait('quart', `${chapeau('Le proprio demande', `Quart ${ROMAINS[Q.n]}`, 'rn-grand')}
  <section class="rn-panneau">${objectifsHtml(S)}
    <div class="rn-t rn-gris rn-pied">Deux manqués sur trois : il te retire un cœur.${R.coeurs === 1 ? ' <span class="rn-rg">C\'est ton dernier.</span>' : ''}</div></section>
  <section class="rn-panneau rn-vignette">${logo(rival.t, 84)}
    <div><div class="rn-k rn-rg">Le rival du quart</div><div class="rn-h">${esc(clubMot(rival))}</div>
      <div class="rn-t rn-gris rn-pied">Match ${kRival + 1}, ${mRival.visiteur ? 'chez eux' : 'chez toi'} · ${esc(jeu.mot)}${I ? `<br>${I.ico} ${esc(I.nom)}` : ''}<br><span class="rn-or">Battu : une pièce de banc parmi trois</span></div></div></section>
  <section class="rn-panneau"><div class="rn-k">Tes gros matchs</div>
    <div class="rn-t"><b>${RUN.AFFICHES} affiches à poser</b> <span class="rn-gris">· à la feuille du soir de ton choix. Gagnée : trois portes, à la hauteur du club battu.</span>
    ${elite ? `<br><b>◆ L'élite : ${esc(clubCourt(elite))}</b> <span class="rn-gris">· match ${Number(kElite) + 1}. Tu y mets l'enjeu, ou non.</span>` : ''}</div></section>`)}
  ${bas(bt('Au bureau', 'vers-bureau', { cls: 'go' }))}`;
}

/* ---------- le bureau : l'accueil, en cinq onglets ---------- */
/* Les cinq onglets du bureau, chacun son icône : celles de la barre du 82-0 (la maison, les lignes, le classement, le chandail), et la pièce pour la masse. */
const ONGLETS = [['bureau', 'Bureau', 'i-club'], ['alignement', 'Alignement', 'i-list'], ['masse', 'Masse', 'i-masse'], ['ligue', 'Ligue', 'i-chart'], ['club', 'Mon club', 'i-jersey']];
/* Les cinq onglets du bureau : en bas, ou en rail à gauche quand l'écran le permet (la feuille). `seul` : à une page ouverte du bureau, le rail seulement. */
const onglets = (V, premier, seul = false) => `<nav class="rn-onglets${seul ? ' rn-rail-seul' : ''}" aria-label="Le bureau">${ONGLETS.map(([k, mot, icone], i) => `<button type="button" class="${(V.onglet || 'bureau') === k ? 'rn-on' : ''}"${(V.onglet || 'bureau') === k ? ' aria-current="page"' : ''} data-a="onglet" data-v="${k}">${ico(icone)}<span>${i === 0 ? premier : mot}</span></button>`).join('')}</nav>`;
const segment = (a, choix, liste) => `<div class="rn-seg">${liste.map(([k, mot]) => `<button type="button" class="${choix === k ? 'rn-on' : ''}" aria-pressed="${choix === k}" data-a="${a}" data-v="${k}">${mot}</button>`).join('')}</div>`;
/* Le jeu d'un club, en un mot : lu une fois par séance (son style ne dépend pas de ton club). */
function styleDe(S, c) { if (!S.jeux) S.jeux = new Map(); const k = `${c.s}:${c.t}`; if (!S.jeux.has(k)) S.jeux.set(k, jeuDe(S, c)); return S.jeux.get(k); }
const nomDuClubNo = (S, i) => (i === 0 ? 'Ton club' : esc(clubCourt(clubNo(S, i))));
const logoNo = (S, i, n = 18) => logo(i === 0 ? 'YOU' : clubNo(S, i).t, n);
/*
 * LA MISE EN PAGE (V31, docs/refonte-v31.md ; JP, 25 nov. 2026 : *tout le Rogue en fluide*). Une scène rend ses morceaux
 * dans l'ordre où on les lit — l'en-tête (`hud`), les onglets, le milieu, le bas — et aucune position : la feuille les range
 * en grille, à toutes les tailles d'écran. `V.largeur` dit la place dont la scène dispose (étroit, moyen, large :
 * js/run-jeu.js), et elle rend le contenu qui va avec : pas de bloc caché en double.
 * UN SEUL DÉFILEMENT DE HAUT EN BAS PAR COLONNE : le milieu d'une lecture (`rn-lecture`), une colonne de panneaux (`colonne`),
 * ou la boîte d'un tableau (`boite`). Chacune porte un nom (`data-defile`) : la coquille garde sa place quand la même page
 * se redessine.
 */
const etroit = V => !V.largeur || V.largeur === 'etroit', large = V => V.largeur === 'large';
const milieu = (html, cls = '', nom = 'milieu') => `<main class="rn-milieu${cls ? ` ${cls}` : ''}" data-defile="${nom}">${html}</main>`;
const boite = (nom, html) => `<div class="rn-boite" data-defile="${nom}">${html}</div>`;
const colonne = (nom, ...blocs) => `<div class="rn-col" data-defile="${nom}">${blocs.join('')}</div>`;
/* Des vues côte à côte ; `pile` : ce qui s'empile dans une d'elles, au-dessus de sa boîte. */
const cote = (...vues) => `<div class="rn-cote">${vues.join('')}</div>`;
const pile = (...blocs) => `<div class="rn-pilier">${blocs.join('')}</div>`;
const rien = mot => `<div class="rn-t rn-gris rn-rien">${mot}</div>`;
/*
 * LE COMPTOIR (V31, tranche 2, docs/refonte-v31-2.md) : une scène où la run te tend quelque chose — un joueur, une pièce,
 * une pochette, une réponse. Deux blocs, dans l'ordre où on les lit : ce qu'on te tend (`offre`, avec en tête pourquoi on est
 * là), puis ton côté (`toi` : celui que tu choisis, qui sort, ton plafond, tes réponses). La feuille les met d'un trait, ou
 * côte à côte quand l'écran est large ou couché (la règle du rail) : le même contenu à toutes les largeurs.
 */
const comptoir = (nom, offre, toi) => milieu(`${colonne(`${nom}-offre`, offre)}${colonne(`${nom}-toi`, toi)}`, 'rn-comptoir', nom);
/*
 * LE BUREAU (JP, 16 nov. 2026 : *un EHM, mais avec un côté rogue*). L'accueil du Rogue pendant la saison, et pendant les
 * séries (son premier onglet devient le tableau des séries). Le HUD en haut, les onglets en bas, au même endroit partout.
 */
export function sceneBureau(S, V) {
  const page = { bureau: S.R.series ? pageSeries : pageBureau, alignement: pageAlignement, masse: pageMasse, ligue: pageLigue, club: pageMonClub }[V.onglet || 'bureau'] || pageBureau;
  return `${hud(S)}${onglets(V, S.R.series ? 'Séries' : 'Bureau')}${page(S, V)}`;
}
const MARQUE = { rival: '<span class="rn-puce rn-r">Le rival</span>', elite: '<span class="rn-puce rn-o">◆ L\'élite</span>', affiche: '<span class="rn-puce rn-o">Affiche</span>' };
/* Le dernier match, en une ligne : « Gagné 4-2 à Boston ». */
const hierDit = m => `${m.gagne ? 'Gagné' : m.ot ? 'Perdu en prolongation' : 'Perdu'} ${m.gf}-${m.ga} ${m.visiteur ? `à ${esc(ville(m.t))}` : `contre ${esc(surnom(m.t))}`}`;
/*
 * L'ONGLET BUREAU. Au téléphone, de haut en bas, dans l'ordre où un DG se pose les questions : qui vient ce soir (le plus
 * gros bloc, c'est pour ça qu'on ouvre le jeu) ; ce que le proprio attend (ce qui peut finir la run) ; le fil (ce qui a
 * changé depuis hier, jamais une boîte à vider : seules l'histoire et les pochettes se touchent, et rien n'attend) ; ton
 * banc (ce que tu bâtis). « Jouer ce soir » est dans le bas, sous le pouce.
 * DÈS QU'IL Y A DEUX COLONNES (JP, 25 nov. 2026 : *le bureau s'étale en panneaux*), une colonne par horizon — à gauche ce
 * qu'on décide, à droite ce qu'on lit : AUJOURD'HUI (ce soir, le fil) · LE QUART (le proprio, et « ton quart » : les matchs
 * qui restent, pour poser tes affiches) · LA SAISON (« autour de toi » : tes voisins au classement en écarts, la ligne des
 * séries ; ton banc, chaque pièce avec son compte et son prochain seuil). À deux colonnes, la saison passe sous aujourd'hui. Ces deux panneaux de plus ont leur maison à la Ligue : au téléphone, c'est là qu'on les lit.
 */
/* Tes voisins au classement, en écarts de points (ton rang et tes points, l'en-tête les dit) ; puis la ligne des séries. */
function panneauAutour(S) {
  const R = S.R, F = R.ligue.fiches, C = classement(S), r = C.indexOf(0), pts = i => 2 * F[i][CLUB.V] + F[i][CLUB.DP], joues = F.some(f => f[CLUB.V] + f[CLUB.P] + f[CLUB.DP] > 0);
  const voisin = i => ligne([`<b class="rn-rang">${C.indexOf(i) + 1}</b>${logoNo(S, i)} ${nomDuClubNo(S, i)}`, ficheMot(F[i]), `<b>${signe(pts(i) - pts(0))}</b>`], { a: 'club-vu', v: i });
  const moi = '<div class="rn-l rn-moi rn-toi"><span>Toi</span><span></span><span></span></div>';
  const P = RUN.LIGUE.PLACES, bord = r < P ? C[P] : C[P - 1], ecart = bord != null ? Math.abs(pts(0) - pts(bord)) : 0;
  const seriesMot = r < P ? `Dans les séries : <b class="rn-vert">${pluriel(ecart, 'point')}</b> d'avance sur le ${P + 1}e` : `Hors des séries : <b class="rn-rg">${pluriel(ecart, 'point')}</b> à reprendre au ${P}e`;
  return `<section class="rn-panneau rn-sans"><button type="button" class="rn-k rn-tetiere" data-a="onglet" data-v="ligue">Autour de toi<i>›</i></button>
    ${joues ? `${tableau('1fr 62px 44px', ['Club', 'V-D-DP', 'Écart'], [...C.slice(Math.max(0, r - 2), r).map(voisin), moi, ...C.slice(r + 1, r + 3).map(voisin)], 'rn-autour')}<div class="rn-t rn-pied">${seriesMot}</div>` : rien('La saison commence : personne n\'a d\'avance.')}</section>`;
}
/* Les matchs qui restent au quart après ce soir (la brique de la cédule), et ceux déjà joués en pastilles : où poser tes affiches. */
function panneauDuQuart(S) {
  const R = S.R, Q = R.quart, n = R.matchs.length, restent = Array.from({ length: Math.max(0, Q.fin - n - 1) }, (_, j) => matchNo(S, n + 1 + j));
  const joues = R.matchs.slice(Q.debut).map(m => `<i class="${m.gagne ? 'rn-g' : m.ot ? 'rn-o' : 'rn-p'}"></i>`).join('');
  const lignes = restent.map(m => ligne([m.k + 1, `${logoNo(S, m.i)} ${nomDuClubNo(S, m.i)}`, `${rangDe(S, m.i)}e`, m.visiteur ? 'Chez eux' : 'Chez toi', `${MARQUE[Q.gros[m.k]] || ''}${m.dos ? '<span class="rn-puce rn-r">Dos-à-dos</span>' : ''}`]));
  // Jusqu'à vingt matchs : la liste défile dans sa boîte, pour que la colonne tienne à l'écran avec le proprio au-dessus.
  return `<section class="rn-panneau rn-sans rn-quart"><div class="rn-k rn-tetiere">Ton quart · ${restent.length ? `${pluriel(restent.length, 'match')} après ce soir` : 'le bilan vient après ce soir'}${joues ? `<span class="rn-joues" role="img" aria-label="${R.matchs.slice(Q.debut).filter(m => m.gagne).length} gagnés sur ${n - Q.debut} ce quart">${joues}</span>` : ''}</div>
    ${lignes.length ? boite('quart-matchs', tableau('26px 1fr 34px 62px 96px', ['', 'Adversaire', 'Rang', 'Lieu', ''], lignes)) : ''}</section>`;
}
function pageBureau(S, V) {
  const R = S.R, Q = R.quart, soir = prochainSoir(S), c = clubNo(S, soir.i), F = R.ligue.fiches[soir.i], dernier = R.matchs.at(-1), h = histoireDuJour(S);
  const puces = [MARQUE[soir.sorte] || '', `<span class="rn-puce">${soir.visiteur ? 'Chez eux' : 'Chez toi'}</span>`, soir.dos ? '<span class="rn-puce rn-r">Ton dos-à-dos</span>' : '', soir.leurDos ? '<span class="rn-puce rn-v">Ils ont joué hier</span>' : ''].filter(Boolean).join('');
  const blesses = [...S.toi.injured].sort((a, b) => b[1] - a[1]);
  const restent = Q.fin - R.matchs.length, pochettes = Object.keys(RUN.POCHETTES).filter(k => !Q.pochettes.includes(k));
  const fil = [
    dernier ? `<div class="rn-fl"><b>Hier</b><span class="${dernier.gagne ? 'rn-vert' : ''}">${hierDit(dernier)}</span></div>` : '<div class="rn-fl"><b>Ce matin</b><span>La saison commence. Vingt-trois joueurs, 82 matchs.</span></div>',
    blesses.length ? `<div class="rn-fl"><b>Infirmerie</b><span class="rn-rg">${blesses.slice(0, 2).map(([p, m]) => `${esc(court(p))}, ${pluriel(m, 'match')}`).join(' · ')}${blesses.length > 2 ? ` · +${blesses.length - 2}` : ''}</span></div>` : '',
    Q.affiches > 0 ? `<div class="rn-fl"><b>Affiches</b><span>${Q.affiches} à poser, ${pluriel(restent, 'match')} au quart</span></div>` : '',
    h ? `<button type="button" class="rn-fl" data-a="ouvrir-histoire"><b>Histoire</b><span>On veut te parler de ${esc(court(h.joueur))}</span><i>›</i></button>` : '',
    pochettes.length ? `<button type="button" class="rn-fl" data-a="etal"><b>Pochettes</b><span>${pochettes.map(k => `${k === 'j:bronze' ? 'Bronze' : 'Époque'} ${RUN.POCHETTES[k]}`).join(' · ')}</span><i>›</i></button>` : '',
  ].filter(Boolean).join('');
  const regle = REGLES_DU_COACH[R.coach.cle], coach = regle ? `${COACHS[R.coach.cle].ico} ${esc(maj(regle.dit))}<br><span class="rn-or">+${regle.jetons} jetons</span> <span class="rn-gris">· ${Q.prime} / ${RUN.PRIME_DU_QUART} ce quart</span>` : esc(COACHS[R.coach.cle].nom);
  const ceSoir = `<section class="rn-panneau rn-p-soir"><div class="rn-k">Ce soir · match ${soir.k + 1}</div>
    <button type="button" class="rn-plaque" data-a="club-vu" data-v="${soir.i}" aria-label="La page de ce club">${logo(c.t, 54)}<div class="rn-nom">${esc(clubMot(c))}<small>${rangDe(S, soir.i)}e · ${ficheMot(F)} · ${esc(styleDe(S, c).mot)}</small></div><i class="rn-vers">›</i></button>
    <div class="rn-puces">${puces}</div></section>`;
  const proprio = `<section class="rn-panneau rn-p-proprio"><div class="rn-k">Le proprio · quart ${ROMAINS[Q.n]}</div>${objectifsHtml(S)}</section>`;
  const leFil = `<section class="rn-panneau rn-fil2">${fil}</section>`;
  const pied = bas(bt('Jouer ce soir', 'aller', { cls: soir.sorte === 'rival' ? 'rn-combat' : 'go' }));
  // Au téléphone : ton banc en une rangée de cartes, qui mène au Banc de l'Alignement.
  if (etroit(V)) return `${milieu(`${ceSoir}${proprio}${leFil}<button type="button" class="rn-panneau rn-lebanc" data-a="vers-banc" aria-label="Ton banc">${banc(S)}<span class="rn-t">${coach}</span></button>`, 'rn-lecture', 'bureau')}${pied}`;
  const tonBanc = `<section class="rn-panneau"><button type="button" class="rn-k rn-tetiere" data-a="vers-banc">Ton banc<i>›</i></button>
    <div class="rn-pieces">${R.banc.map(k => `<div>${carteP(k)}<div class="rn-t"><b>${esc(PIECES[k].nom)}</b> <span class="rn-gris">· ${ligneCourte(S, k).replace('<br>', '</span><br><span class="rn-gris">')}</span></div></div>`).join('')}</div>
    <div class="rn-t rn-pied">${coach}</div></section>`;
  const cols = large(V) ? [colonne('aujourdhui', ceSoir, leFil), colonne('quart', proprio, panneauDuQuart(S)), colonne('saison', panneauAutour(S), tonBanc)]
    // À deux colonnes : « ton quart » peut porter vingt matchs ; tes voisins au classement passent à gauche, pour que la droite tienne sans défiler.
    : [colonne('aujourdhui', ceSoir, leFil, panneauAutour(S), tonBanc), colonne('quart', proprio, panneauDuQuart(S))];
  return `${milieu(cols.join(''), 'rn-colonnes')}${pied}`;
}
/*
 * L'ONGLET ALIGNEMENT. « Lignes » : tes vingt-trois en tableau, dans l'ordre de la glace (les trios, les paires, le filet,
 * les réservistes), l'accord de chaque ligne à sa tête ; toucher un joueur le tient, toucher un autre les échange, et
 * chaque ligne dit alors ce que l'échange y allumerait ; le joueur tenu ouvre sa fiche de la tête du tableau (la ligne, elle,
 * garde son geste : le tenir). « Banc » : ton coach, sa règle, tes pièces et leur compte.
 */
function pageAlignement(S, V) {
  const R = S.R, seg = V.segA || 'lignes';
  if (seg === 'banc') {
    const C = COACHS[R.coach.cle], regle = REGLES_DU_COACH[R.coach.cle];
    return milieu(`${segment('seg-a', seg, [['lignes', 'Lignes'], ['banc', 'Banc']])}
    <div class="rn-lebanc-liste"><div class="rn-panneau"><b class="rn-h">${C.ico} ${esc(R.coach.n || C.nom)}</b>
      <div class="rn-t rn-gris rn-pied">${esc(C.nom)}${regle ? ` · ${esc(regle.dit)} : <span class="rn-or">+${regle.jetons} jetons</span> le soir` : ''}</div></div>
    ${R.banc.map(k => `<div class="rn-panneau rn-piece-ligne">${carteP(k)}<div class="rn-t"><b>${esc(PIECES[k].nom)}</b><br><span class="rn-gris">${ligneDe(S, k)}</span></div></div>`).join('')}
      ${R.banc.length < CASES_DU_BANC ? rien(`${pluriel(CASES_DU_BANC - R.banc.length, 'case')} libre${CASES_DU_BANC - R.banc.length > 1 ? 's' : ''} : un rival battu, une élite, le marché du quart.`) : ''}</div>`, 'rn-lecture', 'banc');
  }
  const tenu = V.tenu, stat = p => R.stats[getPlayerKey(p)] || [];
  const rangee = s => {
    const p = S.roster[s.i];
    if (!p) return ligne([s.scratch ? 'Rés' : s.role.slice(0, 3), '<span class="rn-gris">Case vide</span>', '', '', '', ''], { cls: 'rn-non' });
    const bl = S.toi.injured.get(p), si = tenu != null && tenu !== s.i ? siTenu(S, tenu, s.i) : null, st = stat(p), j = jambesDe(p);
    const fin = tenu != null && tenu !== s.i ? [si ? (si.plus.length ? `<span class="rn-vert">+ ${pluriel(si.plus.length, 'accord')}</span>` : '<span class="rn-gris">Échanger</span>') : '', '', ''] : [`<span class="${j < 70 ? 'rn-rg' : j < 85 ? 'rn-or' : ''}">${j}</span>`, st[0] || 0, p.p === 'G' ? st[1] || 0 : (st[1] || 0) + (st[2] || 0)];
    return ligne([s.scratch ? 'Rés' : s.group === 'G' ? 'G' : s.role, `${visage(p)}${esc(court(p))}${bl ? ` <small class="rn-rg">blessé · ${bl}</small>` : ''}`, badgesHtml(p), ...fin], { a: s.extra ? '' : 'case', v: s.i, cls: tenu === s.i ? 'rn-on' : tenu != null && !si ? 'rn-non' : '' });
  };
  const unite = (mot, cases, u) => { const acc = u != null ? accordsDe(S, u) : [], ps = cases.map(s => S.roster[s.i]).filter(Boolean); return `<div class="rn-l rn-unite"><span>${mot}</span><span>${acc.length ? `${icosDeLAccord(acc[0])} ${esc(acc[0].aff.nom)}${acc.length > 1 ? ` +${acc.length - 1}` : ''}` : ''}</span><span>${u != null && ps.length ? `jambes ${jambes(ps)}` : ''}</span></div>${cases.map(rangee).join('')}`; };
  const de = (g, u) => SLOTS.filter(s => !s.scratch && s.group === g && s.unit === u);
  const avants = [0, 1, 2, 3].map(u => unite(`${ord(u + 1)} trio`, de('F', u), u)).join('');
  const arriere = [0, 1, 2].map(u => unite(`${u + 1}${u ? 'e' : 're'} paire`, de('D', u), u)).join('') + unite('Le filet', [...de('G', 0), ...de('G', 1)], null) + unite('En civil', SLOTS.filter(s => s.scratch && (!s.extra || S.roster[s.i])), null);
  const COLS = '34px 1fr 46px 34px 26px 30px', tete = ['Pos', 'Joueur', 'Badges', 'J', 'PJ', 'Pts'];
  const teteTenue = tenu != null ? ['', `<button type="button" data-a="fiche" data-v="${esc(getPlayerKey(S.roster[tenu]))}">${esc(court(S.roster[tenu]))} · sa fiche ›</button>`, '', 'Où ?', '', ''] : tete;
  // Au téléphone, un tableau ; dès qu'il y a la place, les avants à gauche et l'arrière à droite : tes vingt-trois sans défiler.
  const lignes = etroit(V) ? boite('lignes', tableau(COLS, teteTenue, [avants + arriere], 'rn-alig'))
    : cote(boite('avants', tableau(COLS, teteTenue, [avants], 'rn-alig')), boite('arriere', tableau(COLS, tenu != null ? ['', '', '', 'Où ?', '', ''] : tete, [arriere], 'rn-alig')));
  return milieu(`${segment('seg-a', seg, [['lignes', 'Lignes'], ['banc', 'Banc']])}${lignes}`, 'rn-tables');
}
/*
 * L'ONGLET MASSE. Le plafond d'abord (la seule jauge de l'onglet : ta masse, ce que les joueurs sortis y laissent, ton
 * espace), puis les vingt-trois salaires, le plus gros en tête : c'est lui qu'on regarde quand une carte ne tient pas.
 */
function pageMasse(S, V) {
  const R = S.R, js = effectifDe(S).sort((a, b) => prixDe(S, b) - prixDe(S, a)), cas = p => SLOTS.find(s => S.roster[s.i] === p);
  const ou = s => (s.scratch ? 'Rés' : s.group === 'G' ? 'G' : s.role);
  const table = ps => tableau('34px 1fr 76px 70px', ['Pos', 'Joueur', 'Carte', 'Salaire'], ps.map(p => ligne([ou(cas(p)), `${visage(p)}${esc(court(p))}`, esc(NOM_VARIANTE[editionDe(p)]), money(prixDe(S, p))], { a: 'fiche', v: getPlayerKey(p) })));
  const moitie = Math.ceil(js.length / 2);
  return milieu(`<div class="rn-panneau"><div class="rn-entete"><span class="rn-k">Ton plafond</span><span class="rn-t">${money(masseDe(S))} <span class="rn-gris">/ ${money(R.plafond)}</span></span></div>
    ${plafond(S, { mort: R.mort || 0 })}
    <div class="rn-t rn-pied"><span class="rn-or">Espace ${money(espaceDe(S))}</span>${R.mort ? ` <span class="rn-gris">·</span> <span class="rn-rg">${money(R.mort)} des joueurs sortis</span>` : ''}</div></div>
  ${etroit(V) ? boite('masse', table(js)) : cote(boite('masse', table(js.slice(0, moitie))), boite('masse2', table(js.slice(moitie))))}`, 'rn-tables');
}
/*
 * L'ONGLET LIGUE (JP, 25 nov. 2026 : *la ligue*, détaillée). « Classement » : les trente-deux, la ligne des séries tracée
 * sous le seizième, ton club allumé ; au premier coup d'œil ce qu'il a toujours dit (les matchs, la fiche, l'écart, les
 * points), et en glissant ce que chaque club fait — ses buts, ses tirs, son avantage, son désavantage, ses punitions ;
 * toucher un club ouvre sa page. « Meneurs » : les trente premiers patineurs de la colonne qu'on touche. « Gardiens » : ceux
 * qui tiennent le filet de leur club, triés de même. « Cédule » : tes prochains matchs, le rival et l'élite marqués, tes
 * dos-à-dos ; puis les derniers joués.
 */
const parMatch = (x, mj) => (mj ? virgule(x / mj) : '—');
const pourCent = (n, d) => (d ? virgule((100 * n) / d) : '—');
/* Ce qu'un club fait, lu dans sa fiche (`CLUB`, js/run.js) : par match, et ses unités spéciales en pourcentage. */
const chiffresDuClub = f => { const n = k => f[k] || 0, mj = n(CLUB.V) + n(CLUB.P) + n(CLUB.DP); return { mj, bp: parMatch(n(CLUB.BP), mj), bc: parMatch(n(CLUB.BC), mj), tp: parMatch(n(CLUB.TP), mj), tc: parMatch(n(CLUB.TC), mj), an: pourCent(n(CLUB.BAN), n(CLUB.OAN)), dn: pourCent(n(CLUB.ODN) - n(CLUB.BDN), n(CLUB.ODN)), pun: parMatch(n(CLUB.PUN), mj) }; };
const sigleNo = (S, i) => (i === 0 ? 'Toi' : esc(clubNo(S, i).t));
const joueurNo = (S, x) => { const p = (x.i === 0 ? effectifDe(S) : clubNo(S, x.i).pool).find(q => getPlayerKey(q) === x.k); return p ? `${visage(p)}${esc(court(p))}` : '…'; };
const tetesDeTri = (a, cols, tri) => cols.map(([k, mot]) => `<button type="button" class="${tri[0] === k ? 'rn-on' : ''}" data-a="${a}" data-v="${k}">${mot}</button>`);
const largeurs = cols => cols.map(c => (c[1].length > 3 ? '50px' : '34px')).join(' ');
const MENEURS = [
  ['pj', 'PJ', x => x.pj], ['b', 'B', x => x.g], ['a', 'A', x => x.a], ['pts', 'PTS', x => x.g + x.a, v => `<b>${v}</b>`], ['pm', '+/−', x => x.pm, signe],
  ['t', 'T', x => x.t], ['pct', '% tir', x => (x.t ? (100 * x.g) / x.t : -1), v => (v < 0 ? '—' : virgule(v))], ['pun', 'PUN', x => x.pun],
];
/* Un gardien de la ligue, sa ligne `STATS_G` : la moyenne se trie à l'envers (la plus basse d'abord). */
const GARDIENS = [
  ['d', 'D', x => x[STATS_G.D]], ['v', 'V', x => x[STATS_G.V], v => `<b>${v}</b>`], ['p', 'P', x => x[STATS_G.P]], ['dp', 'DP', x => x[STATS_G.DP]],
  ['pct', '% arr.', x => (x[STATS_G.TR] ? 1 - x[STATS_G.BC] / x[STATS_G.TR] : 0), v => pct3(v)], ['moy', 'Moy.', x => (x[STATS_G.D] ? -x[STATS_G.BC] / x[STATS_G.D] : -99), v => virgule(-v, 2)],
  ['bl', 'BL', x => x[STATS_G.BL]], ['bc', 'BC', x => x[STATS_G.BC]], ['tr', 'TR', x => x[STATS_G.TR]],
];
function pageLigue(S, V) {
  const R = S.R, L = R.ligue, seg = V.segL || 'classement', vide = rien('Personne n\'a encore joué : la saison commence ce soir.');
  const vues = {
    meneurs: () => {
      const tri = MENEURS.find(c => c[0] === V.triL) || MENEURS[3], l = meneursDe(S, 30, tri[2]).filter(x => x.pj);
      return boite('meneurs', l.length ? tableau(`150px 44px ${largeurs(MENEURS)}`, ['Joueur', 'Club', ...tetesDeTri('tri-l', MENEURS, tri)], l.map(x => ligne([joueurNo(S, x), sigleNo(S, x.i), ...MENEURS.map(c => { const v = c[2](x); return c[3] ? c[3](v) : v; })], { cls: x.i === 0 ? 'rn-moi' : '', a: 'fiche', v: x.k })), 'rn-tri rn-large') : vide);
    },
    gardiens: () => {
      const tri = GARDIENS.find(c => c[0] === V.triG) || GARDIENS[1], l = gardiensDe(S).sort((a, b) => tri[2](b.x) - tri[2](a.x) || b.x[STATS_G.V] - a.x[STATS_G.V] || (a.k < b.k ? -1 : 1));
      return boite('gardiens', l.length ? tableau(`150px 44px ${largeurs(GARDIENS)}`, ['Gardien', 'Club', ...tetesDeTri('tri-g', GARDIENS, tri)], l.map(g => ligne([joueurNo(S, g), sigleNo(S, g.i), ...GARDIENS.map(c => { const v = c[2](g.x); return c[3] ? c[3](v) : v; })], { cls: g.i === 0 ? 'rn-moi' : '', a: 'fiche', v: g.k })), 'rn-tri rn-large') : vide);
    },
    cedule: () => {
      const n = R.matchs.length, Q = R.quart;
      const aVenir = R.series ? [] : Array.from({ length: Math.min(12, RUN.LIGUE.MATCHS - n) }, (_, j) => matchNo(S, n + j));
      const venir = aVenir.map(m => ligne([m.k + 1, `${logoNo(S, m.i)} ${nomDuClubNo(S, m.i)}`, m.visiteur ? 'Chez eux' : 'Chez toi', `${MARQUE[Q.gros[m.k]] || ''}${m.dos ? '<span class="rn-puce rn-r">Dos-à-dos</span>' : ''}`]));
      const joues = R.matchs.slice(-8).reverse().map((m, j) => ligne([n - j, `${logo(m.t, 18)} ${esc(clubCourt(m))}`, m.visiteur ? 'Chez eux' : 'Chez toi', `<b class="${m.gagne ? 'rn-vert' : 'rn-rg'}">${m.gf}-${m.ga}${m.ot ? ' P' : ''}</b>`], quiRouvre(S, n - j - 1)));
      return boite('cedule', tableau('26px 1fr 62px 96px', ['', 'Adversaire', 'Lieu', ''], [...(venir.length ? ['<div class="rn-l rn-unite"><span>À venir</span><span></span><span></span></div>', ...venir] : []), ...(joues.length ? ['<div class="rn-l rn-unite"><span>Déjà joués</span><span></span><span></span></div>', ...joues] : [])]));
    },
    classement: () => {
      const rangs = classement(S).map((i, r) => {
        const f = L.fiches[i], d = f[CLUB.BP] - f[CLUB.BC], c = chiffresDuClub(f);
        return ligne([`<b class="rn-rang">${r + 1}</b>${logoNo(S, i)} ${nomDuClubNo(S, i)}`, c.mj, ficheMot(f), signe(d), `<b>${2 * f[CLUB.V] + f[CLUB.DP]}</b>`, f[CLUB.BP], f[CLUB.BC], c.tp, c.tc, c.an, c.dn, c.pun], { cls: i === 0 ? 'rn-moi' : '', a: 'club-vu', v: i })
          + (r === RUN.LIGUE.PLACES - 1 ? '<div class="rn-l rn-coupe"><span>La ligne des séries</span></div>' : '');
      });
      return boite('classement', tableau('172px 26px 62px 34px 32px 34px 34px 40px 40px 44px 44px 50px', ['Club', 'MJ', 'V-D-DP', 'Diff', 'Pts', 'BP', 'BC', 'T/M', 'TC/M', 'AN %', 'DN %', 'PUN/M'], rangs, 'rn-large'));
    },
  };
  // En large, un segment se déplie quand ses vues tiennent côte à côte : le classement et ta cédule (où poser tes affiches), les meneurs et les gardiens.
  if (large(V)) {
    const joueurs = seg === 'meneurs' || seg === 'gardiens';
    return milieu(`${segment('seg-l', joueurs ? 'meneurs' : 'classement', [['classement', 'Classement et cédule'], ['meneurs', 'Meneurs et gardiens']])}${joueurs ? cote(vues.meneurs(), vues.gardiens()) : cote(vues.classement(), vues.cedule())}`, 'rn-tables');
  }
  return milieu(`${segment('seg-l', seg, [['classement', 'Classement'], ['meneurs', 'Meneurs'], ['gardiens', 'Gardiens'], ['cedule', 'Cédule']])}${(vues[seg] || vues.classement)()}`, 'rn-tables');
}
/*
 * LA PAGE D'UN CLUB DE LA LIGUE (JP, 25 nov. 2026 : *la page d'un club*) : qui il est (son rang, sa fiche, son jeu), ce
 * qu'il fait par match (ses buts, ses tirs, son avantage et son désavantage : ce que le classement dit en glissant), ce
 * que tu as fait contre lui, puis qui y joue — ses patineurs par leurs points, ses gardiens ; toucher un
 * joueur ouvre sa fiche. Un seul bouton : le retour au classement.
 */
export function sceneClubVu(S, V) {
  const R = S.R, i = V.clubVu, c = clubNo(S, i), F = R.ligue.fiches[i], x = chiffresDuClub(F), P = R.ligue.pts, Gd = R.ligue.gardiens || {};
  const contre = R.matchs.filter(m => m.i === i && m.s === c.s && m.t === c.t), v = contre.filter(m => m.gagne).length;
  const ps = c.pool.filter(p => p.p !== 'G').map(p => { const [g = 0, a = 0, pj = 0, t = 0, pm = 0, pun = 0] = P[getPlayerKey(p)] || []; return { p, g, a, pj, t, pm, pun }; }).filter(y => y.pj).sort((a, b) => (b.g + b.a) - (a.g + a.a) || b.g - a.g || b.pj - a.pj);
  const gs = c.pool.filter(p => p.p === 'G' && Gd[getPlayerKey(p)]).map(p => ({ p, g: Gd[getPlayerKey(p)] })).sort((a, b) => b.g[STATS_G.D] - a.g[STATS_G.D]);
  const patineurs = tableau('150px 30px 30px 30px 34px 34px 34px 34px', ['Joueur', 'PJ', 'B', 'A', 'PTS', '+/−', 'T', 'PUN'], ps.map(y => ligne([`${visage(y.p)}${esc(court(y.p))} ${badgesHtml(y.p)}`, y.pj, y.g, y.a, `<b>${y.g + y.a}</b>`, signe(y.pm), y.t, y.pun], { a: 'fiche', v: getPlayerKey(y.p) })), 'rn-large');
  const gardiens = gs.length ? tableau('150px 30px 62px 48px 44px', ['Gardien', 'D', 'V-D-DP', '% arr.', 'Moy.'], gs.map(({ p, g }) => ligne([`${visage(p)}${esc(court(p))}`, g[STATS_G.D], `${g[STATS_G.V]}-${g[STATS_G.P]}-${g[STATS_G.DP]}`, g[STATS_G.TR] ? pct3(1 - g[STATS_G.BC] / g[STATS_G.TR]) : '—', g[STATS_G.D] ? virgule(g[STATS_G.BC] / g[STATS_G.D], 2) : '—'], { a: 'fiche', v: getPlayerKey(p) })), 'rn-large') : '';
  const joueurs = boite('club', ps.length ? patineurs + gardiens : rien('Il n\'a pas encore joué.'));
  const fiche = `<div class="rn-plaque">${logo(c.t, 54)}<div class="rn-nom">${esc(clubMot(c))}<small>${rangTxt(rangDe(S, i))} · ${ficheMot(F)} · ${esc(maj(styleDe(S, c).mot))}</small></div></div>
  <div class="rn-panneau rn-fil2">
    <div class="rn-fl"><b>Buts</b><span>${x.bp} pour · ${x.bc} contre par match</span></div>
    <div class="rn-fl"><b>Tirs</b><span>${x.tp} pour · ${x.tc} contre par match</span></div>
    <div class="rn-fl"><b>Unités</b><span>AN ${x.an} % · DN ${x.dn} %</span></div>
    <div class="rn-fl"><b>Contre toi</b><span>${contre.length ? `${v} gagné${v > 1 ? 's' : ''}, ${contre.length - v} perdu${contre.length - v > 1 ? 's' : ''} <span class="rn-gris">· ${contre.map(m => `${m.gf}-${m.ga}${m.ot ? ' P' : ''}`).join(', ')}</span>` : '<span class="rn-gris">Pas encore affronté</span>'}</span></div></div>`;
  // Au téléphone, ses chiffres puis ses joueurs ; en large, ses chiffres à gauche, ses joueurs à droite.
  return `${hud(S)}${onglets(V, S.R.series ? 'Séries' : 'Bureau', true)}${milieu(large(V) ? cote(pile(fiche), joueurs) : fiche + joueurs, 'rn-tables rn-c-club')}${bas(bt('Retour', 'fermer-club-vu'))}`;
}
/*
 * L'ONGLET MON CLUB : ce que chacun a fait chez toi. « Patineurs » et « Gardiens » : tout ce que les feuilles comptent (JP,
 * 25 nov. 2026 : *stats super détaillées*), dans un tableau qui glisse de côté, le nom figé à gauche (*glisser de côté*).
 * Les colonnes vont de ce qu'on cherche d'abord à ce qu'on fouille : le pointage, le +/−, le tir, la glace, le jeu
 * physique, les unités spéciales, les buts gagnants ; toucher un en-tête trie par lui. « Matchs » : ta séquence, puis
 * chaque match de la run, le dernier en tête ; en toucher un rouvre sa feuille de match (`sceneMatchVu`).
 */
/* [la clé du tri, l'en-tête, la valeur qu'on trie, ce qu'on lit] */
const COLONNES = [
  ['pj', 'PJ', x => x[STATS.PJ]], ['b', 'B', x => x[STATS.B]], ['a', 'A', x => x[STATS.A]], ['pts', 'PTS', x => x[STATS.B] + x[STATS.A], v => `<b>${v}</b>`], ['pm', '+/−', x => x[STATS.PM], signe],
  ['t', 'T', x => x[STATS.T]], ['pct', '% tir', x => (x[STATS.T] ? (100 * x[STATS.B]) / x[STATS.T] : -1), v => (v < 0 ? '—' : virgule(v))], ['tg', 'TG', x => (x[STATS.PJ] ? x[STATS.TG] / x[STATS.PJ] : 0), v => virgule(v)],
  ['pun', 'PUN', x => x[STATS.PUN]], ['me', 'MÉ', x => x[STATS.ME]], ['bl', 'BL', x => x[STATS.BL]], ['pan', 'PTS AN', x => x[STATS.PAN]], ['pdn', 'PTS DN', x => x[STATS.PDN]], ['bg', 'BG', x => x[STATS.BG]],
];
function pageMonClub(S, V) {
  const R = S.R, seg = V.segC || 'patineurs', st = (p, n) => Array.from({ length: n }, (_, i) => (R.stats[getPlayerKey(p)] || [])[i] || 0);
  const vues = {
    gardiens: () => {
      const gs = effectifDe(S).filter(p => p.p === 'G'), G = STATS_G;
      return boite('gardiens', tableau('150px 30px 30px 30px 30px 48px 44px 30px 30px 34px 40px 30px', ['Gardien', 'D', 'V', 'P', 'DP', '% arr.', 'Moy.', 'BL', 'DQ', 'BC', 'TR', 'J'], gs.map(p => { const x = st(p, 8); return ligne([`${visage(p)}${esc(court(p))}`, x[G.D], x[G.V], x[G.P], x[G.DP], x[G.TR] ? pct3(1 - x[G.BC] / x[G.TR]) : '—', x[G.D] ? virgule(x[G.BC] / x[G.D], 2) : '—', x[G.BL], x[G.DQ], x[G.BC], x[G.TR], jambesDe(p)], { a: 'fiche', v: getPlayerKey(p) }); }), 'rn-large'));
    },
    matchs: () => {
      let suite = 0;
      for (let i = R.matchs.length - 1; i >= 0 && R.matchs[i].gagne === R.matchs.at(-1).gagne; i--) suite++;
      const f = R.ligue.fiches[0], dix = R.matchs.slice(-10);
      const lignes = R.matchs.slice().reverse().map((m, j) => ligne([R.matchs.length - j, `${logo(m.t, 18)} ${esc(clubCourt(m))}`, MARQUE[m.sorte] || (m.sorte === 'serie' ? '<span class="rn-puce">Séries</span>' : ''), `<b class="${m.gagne ? 'rn-vert' : 'rn-rg'}">${m.gf}-${m.ga}${m.ot ? ' P' : ''}</b>`], quiRouvre(S, R.matchs.length - j - 1)));
      return pile(`<div class="rn-cellules"><div><b>${ficheMot(f)}</b><small>Ta fiche</small></div><div><b>${dix.filter(m => m.gagne).length}-${dix.filter(m => !m.gagne).length}</b><small>Tes dix derniers</small></div><div><b class="${R.matchs.length && R.matchs.at(-1).gagne ? 'rn-vert' : 'rn-rg'}">${suite}</b><small>${R.matchs.length && R.matchs.at(-1).gagne ? 'Victoires' : 'Défaites'} de suite</small></div></div>`,
        boite('matchs', lignes.length ? tableau('26px 1fr 84px 54px', ['', 'Adversaire', '', 'Pointage'], lignes) : rien('Aucun match joué encore.')));
    },
    patineurs: () => {
      const tri = COLONNES.find(c => c[0] === V.tri) || COLONNES[3], val = p => tri[2](st(p, 12));
      const ps = effectifDe(S).filter(p => p.p !== 'G').sort((a, b) => val(b) - val(a) || st(b, 12)[STATS.B] - st(a, 12)[STATS.B] || getHiddenRatings(b).v - getHiddenRatings(a).v);
      return boite('patineurs', tableau(`150px ${largeurs(COLONNES)}`, ['Joueur', ...tetesDeTri('tri', COLONNES, tri)], ps.map(p => { const x = st(p, 12); return ligne([`${visage(p)}${esc(court(p))} ${badgesHtml(p)}`, ...COLONNES.map(c => { const v = c[2](x); return c[3] ? c[3](v) : v; })], { a: 'fiche', v: getPlayerKey(p) }); }), 'rn-tri rn-large'));
    },
  };
  // En large, les patineurs et tes matchs côte à côte ; les gardiens gardent leur segment.
  if (large(V)) return milieu(`${segment('seg-c', seg === 'gardiens' ? 'gardiens' : 'patineurs', [['patineurs', 'Patineurs et matchs'], ['gardiens', 'Gardiens']])}${seg === 'gardiens' ? vues.gardiens() : cote(vues.patineurs(), vues.matchs())}`, 'rn-tables');
  return milieu(`${segment('seg-c', seg, [['patineurs', 'Patineurs'], ['gardiens', 'Gardiens'], ['matchs', 'Matchs']])}${(vues[seg] || vues.patineurs)()}`, 'rn-tables');
}
/* ---------- la fiche d'un joueur ---------- */
/* Un nom qui ouvre sa fiche : le bouton des noms du jeu (`.lien-joueur`, sa cible de 44 px), le geste du Rogue. */
export const nomQuiOuvre = (p, html) => `<button type="button" class="lien-joueur" data-a="fiche" data-v="${esc(getPlayerKey(p))}">${html}</button>`;
/*
 * LA FICHE QU'UN NOM OUVRE (JP, 25 nov. 2026 : *la fiche d'un joueur*) : celle du jeu (js/fiche.js `showPlayerModal`), sa
 * carte recto verso telle quelle. La run y dit ce qu'elle sait de lui, rien de plus : chez toi, sa saison (`R.stats`), à
 * son édition et à son salaire de la run, puis ses dix derniers matchs ; dans un autre club, sa saison dans ta ligue. Rend
 * { p, opts }, ou rien si la clé n'est à personne.
 */
export function ficheDuJoueur(S, cle) {
  const x = joueurDeLaRun(S, cle);
  if (!x) return null;
  const { p, club } = x, R = S.R, s = (R.stats || {})[cle] || [], n = i => s[i] || 0, td = v => `<td>${v}</td>`;
  const G = p.p === 'G';
  if (club) {
    // Dans un autre club : ce que la ligue compte de lui (`LIGUEUR` ; un gardien, `STATS_G`), sous le nom de son club.
    const [b = 0, a = 0, pj = 0, t = 0, pm = 0, pun = 0] = (R.ligue && R.ligue.pts[cle]) || [], g = (R.ligue && (R.ligue.gardiens || {})[cle]) || [], ng = i => g[i] || 0;
    const sim = G ? { GP: ng(STATS_G.D), W: ng(STATS_G.V), L: ng(STATS_G.P), OTL: ng(STATS_G.DP), GA: ng(STATS_G.BC), SA: ng(STATS_G.TR), SV: ng(STATS_G.TR) - ng(STATS_G.BC), SO: ng(STATS_G.BL) } : { GP: pj, G: b, A: a, PTS: b + a, PM: pm, SH: t, PIM: pun };
    return { p, opts: { sim, team: clubNo(S, club).team, titreSim: 'Sa saison dans ta ligue', rar: editionDe(p) } };
  }
  const J = derniersMatchsDe(S, p);
  const sim = G ? { GP: n(STATS_G.D), W: n(STATS_G.V), L: n(STATS_G.P), OTL: n(STATS_G.DP), GA: n(STATS_G.BC), SA: n(STATS_G.TR), SV: n(STATS_G.TR) - n(STATS_G.BC), SO: n(STATS_G.BL), DQ: n(STATS_G.DQ) }
    : { GP: n(STATS.PJ), G: n(STATS.B), A: n(STATS.A), PTS: n(STATS.B) + n(STATS.A), PM: n(STATS.PM), SH: n(STATS.T), PIM: n(STATS.PUN), TOI: n(STATS.TG), PPP: n(STATS.PAN), SHP: n(STATS.PDN), GWG: n(STATS.BG), HT: n(STATS.ME), BL: n(STATS.BL) };
  const suite = J.length ? `<div class="section-label">Ses ${J.length > 1 ? `${J.length} derniers matchs` : 'derniers matchs'} chez toi</div>
    <div class="jr-scroll"><table class="jr-table"><thead><tr><th class="jr-col-nom">Match</th><th></th>${(G ? ['BC'] : ['B', 'A', 'PTS']).map(k => `<th>${k}</th>`).join('')}</tr></thead>
    <tbody>${J.map(m => `<tr><td class="jr-col-nom">${m.n} · ${logo(m.adv.tag, 16)} ${esc(surnom(m.adv.tag))}</td>${td(`<b class="${m.gagne ? 'rn-vert' : 'rn-rg'}">${m.gf}-${m.ga}</b>`)}${(G ? [m.bc] : [m.b, m.a, m.b + m.a]).map(td).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  return { p, opts: { sim, team: S.toi, titreSim: 'Sa saison chez toi', rar: editionDe(p), salaire: [money(prixDe(S, p)), 'Son salaire dans ta run'], suite } };
}

/* ---------- la feuille du soir ---------- */
const lignesDuClub = t => {
  const L = activeLineup(t), de = (g, u) => SLOTS.filter(s => !s.scratch && s.group === g && s.unit === u).map(s => L[s.i]).filter(Boolean);
  return { trios: [0, 1, 2, 3].map(u => de('F', u)), paires: [0, 1, 2].map(u => de('D', u)), gardien: de('G', 0)[0] || null };
};
const noms = ps => ps.map(p => esc(court(p))).join(' · ');
const vedettesDe = club => { const ps = club.pool.filter(p => groupeDe(p) !== 'G').sort((a, b) => getHiddenRatings(b).v - getHiddenRatings(a).v); const g = club.pool.filter(p => groupeDe(p) === 'G')[0]; return [ps[0], g].filter(Boolean); };
const estDuel = c => c.sorte === 'rival' || c.sorte === 'affiche' || c.sorte === 'serie' || (c.sorte === 'elite' && !!c.enjeu);
/* Ce que le match paie, gagné et perdu : la sorte du soir décide. */
function enjeuHtml(S) {
  const c = S.R.soir;
  if (c.sorte === 'serie') return '';
  const J = c.J != null ? `${c.J} jetons` : 'des jetons', sorte = c.sorte === 'elite' && !c.enjeu ? 'match' : c.sorte;
  const gagne = { match: `2 points · ${c.jetons} jetons`, affiche: `2 points · ${c.jetons} jetons<br>Trois portes`, rival: `2 points · ${c.jetons} jetons<br>Une pièce, puis trois portes`, elite: `2 points · ${J}<br>Une pièce, puis trois portes` }[sorte];
  const perdu = { match: '1 point en prolongation', affiche: '1 point en prolongation<br>Une relance gratuite', rival: 'Son objectif est manqué<br>Une relance gratuite', elite: `Sonnés 5 matchs<br>${c.J != null ? `${Math.round(c.J / 2)} jetons de moins` : 'des jetons de moins'}` }[sorte];
  return `<div class="rn-enjeu"><div><b class="rn-vert">Gagné</b>${gagne}</div><div><b class="rn-rg">Perdu</b>${perdu}</div></div>`;
}
/* La jauge se lit sur le noir : ta part à la couleur de ton club (celle qui teinte le Rogue), la leur à leur couleur vive — neutre si les deux se confondent. */
const leurCouleur = (toi, eux) => (separe(couleurVive(toi), couleurVive(eux)) ? ` style="--eux:${couleurVive(eux)}"` : '');
const jaugeHtml = (V, toi, eux) => {
  const pc = V.chance ? Math.round((100 * V.chance.v) / V.chance.n) : null;
  return `<div class="rn-jauge"${leurCouleur(toi, eux)}><span>${pc == null ? '…' : `${pc} %`}</span><div><i style="width:${pc == null ? 50 : pc}%"></i></div><span>${pc == null ? '…' : `${100 - pc} %`}</span></div>`;
};
/* La jauge de ce soir, seule : la coquille la remplace sur place pendant que ta chance se calcule, sans refaire la scène. */
export const jaugeDeCeSoir = (S, V) => jaugeHtml(V, 'YOU', S.R.soir.t);
const RONDES = ['Première ronde', 'Deuxième ronde', 'Demi-finale', 'La finale'];
/*
 * TES DEUX GESTES DU SOIR, côte à côte, à la même place sur chaque feuille : devant le filet (le partant ou l'auxiliaire,
 * chacun ses jambes : le jeu ne les fait pas tourner pour toi), et ce que tu fais de ce match — l'affiche à poser un soir
 * ordinaire, l'enjeu d'une élite.
 */
function gestesDuSoir(S) {
  const R = S.R, c = R.soir, filet = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => S.roster[s.i]).filter(Boolean), aux = S.toi._filetMatch === 'aux';
  const gardien = (g, i) => { const j = jambesDe(g), bl = S.toi.injured.has(g); return `<button type="button" class="${(i === 1) === aux ? 'rn-on' : ''}" data-a="filet" data-v="${i === 1 ? 'aux' : 'partant'}"${bl ? ' disabled' : ''}><b>${esc(court(g))}</b><span class="${j < 85 ? 'rn-rg' : ''}">${bl ? 'blessé' : `jambes ${j}`}</span></button>`; };
  const affiche = c.sorte === 'affiche', reste = R.quart.affiches - (affiche ? 1 : 0);
  const droite = c.sorte === 'match' || affiche ? `<div class="rn-k">Tes affiches · ${reste} à poser</div><div class="rn-filet"><button type="button" class="${affiche ? 'rn-on' : ''}" data-a="affiche" data-v="${affiche ? '' : '1'}"${!affiche && R.quart.affiches <= 0 ? ' disabled' : ''}>${affiche ? 'Affiche posée<br>Toucher : la retirer' : 'En faire une affiche<br>Un duel, trois portes'}</button></div>`
    : c.sorte === 'elite' ? `<div class="rn-k">◆ L'élite</div><div class="rn-filet"><button type="button" class="${c.enjeu ? 'rn-on' : ''}" data-a="enjeu" data-v="${c.enjeu ? '' : '1'}">${c.enjeu ? 'L\'enjeu est mis<br>Toucher : le retirer' : 'Mettre l\'enjeu<br>Une pièce, ou des sonnés'}</button></div>`
      : `<div class="rn-k">${c.sorte === 'rival' ? 'Le rival du quart' : 'Les séries'}</div><div class="rn-t rn-gris">${c.sorte === 'rival' ? 'Un des trois objectifs du proprio.' : 'Quatre victoires pour passer.'}</div>`;
  return `<div class="rn-gestes">
    <div class="rn-panneau"><div class="rn-k">Devant le filet</div><div class="rn-filet">${filet.map(gardien).join('')}</div></div>
    <div class="rn-panneau">${droite}</div></div>`;
}
/*
 * LA FEUILLE DU SOIR. Au téléphone, de haut en bas : le club qui vient et ta chance ; leurs lignes ; les tiennes ; tes deux
 * gestes ; ce que le match paie. Dès qu'il y a la place, les deux clubs se font face (leur club à gauche, le tien à droite)
 * et ce que tu décides est entre les deux : ta chance, tes deux gestes, ce que le match paie. « Au match » est dans le bas.
 */
export function sceneFeuille(S, V) {
  const R = S.R, c = R.soir, club = S.clubs.find(x => x.s === c.s && x.t === c.t), duel = estDuel(c), serie = c.sorte === 'serie';
  const jeu = styleDe(S, c), eux = lignesDuClub(club.team), moi = lignesDuClub(S.toi), vedette = vedettesDe(club)[0], leur = leurBanc(S);
  const lieu = `${c.visiteur ? 'chez eux' : 'chez toi'}${c.dos && !serie ? ' · ton dos-à-dos' : ''}${c.leurDos && !serie ? ' · ils ont joué hier' : ''}`;
  const sous = serie ? `Match ${R.series.moi.w + R.series.moi.l + 1} · ${lieu}${leur ? ` · leur coach : ${COACHS[leur.cle].nom}` : ''}` : `${rangDe(S, c.i)}e · ${ficheMot(R.ligue.fiches[c.i])} · ${lieu}`;
  const petit = serie ? RONDES[R.series.ronde] : { rival: 'Le rival', elite: 'L\'élite', affiche: 'Une affiche' }[c.sorte] || null;
  const plaque = `<div class="rn-plaque">${logo(c.t)}<div class="rn-nom">${esc(clubMot(c))}<small>${esc(maj(sous))}</small></div></div>`;
  const chance = jaugeHtml(V, 'YOU', c.t);
  const pied = bas(bt(serie ? 'Le tableau' : 'Bureau', 'retour-bureau'), bt(duel ? 'Au combat' : 'Au match', 'jouer', { cls: duel ? 'rn-combat' : 'go' }));
  let leurs, miens;
  if (!duel) {
    const blesses = S.toi.injured.size;
    const trio = (ps, u) => { const acc = accordsDe(S, u), j = jambes(ps); return `<div class="rn-trio"><b>${u + 1}</b><span>${noms(ps)}</span><em>${acc.length ? `${icosDeLAccord(acc[0])}${acc.length > 1 ? ` +${acc.length - 1}` : ''}` : 'Aucun'}</em><div class="rn-jb${j < 70 ? ' rn-use' : ''}"><i style="width:${j}%"></i></div></div>`; };
    // Au téléphone, leurs trois premiers trios et leur première paire, tes défenseurs en une ligne ; face à face, chaque ligne des deux clubs.
    const tout = !etroit(V), paire = (ps, u) => `<div class="rn-trio"><b>D${u + 1}</b><span>${noms(ps)}</span><em></em><div class="rn-jb${jambes(ps) < 70 ? ' rn-use' : ''}"><i style="width:${jambes(ps)}%"></i></div></div>`;
    leurs = `<div class="rn-panneau rn-leurs">${carteJ(vedette)}<div class="rn-lignes"><div><b>Jeu</b><span class="rn-or">${esc(maj(jeu.mot))}</span></div>
      ${eux.trios.slice(0, tout ? 4 : 3).map((ps, u) => `<div${ps.includes(vedette) ? ' class="rn-etoile"' : ''}><b>${ord(u + 1)}</b><span>${noms(ps)}</span></div>`).join('')}
      ${eux.paires.slice(0, tout ? 3 : 1).map((ps, u) => `<div${ps.includes(vedette) ? ' class="rn-etoile"' : ''}><b>D${tout ? u + 1 : ''}</b><span>${noms(ps)}</span></div>`).join('')}
      ${eux.gardien ? `<div><b>G</b><span>${esc(court(eux.gardien))} · ${pct3(eux.gardien.sv || 0)}</span></div>` : ''}</div></div>`;
    miens = `<div class="rn-panneau"><div class="rn-k">Tes lignes · leurs accords · leurs jambes${blesses ? ` · <span class="rn-rg">${pluriel(blesses, 'blessé')}</span>` : ''}</div>
      ${moi.trios.map(trio).join('')}
      ${tout ? moi.paires.map(paire).join('') : `<div class="rn-trio"><b>D</b><span>${noms(moi.paires.flat().slice(0, 2))} · ${Math.max(0, moi.paires.flat().length - 2)} autres</span><em></em><div class="rn-jb"><i style="width:${jambes(moi.paires.flat())}%"></i></div></div>`}</div>`;
  } else {
    // Le duel (une affiche, le rival, l'élite avec son enjeu, les séries) : leur jeu ce soir et ce qu'il te coûte, puis ton banc,
    // pièce par pièce. Aucun plan à choisir (V29) : ta réponse est le banc que tu as bâti.
    const I = V.intention && INTENTIONS[V.intention.cle], vise = V.intention && V.intention.cible ? court(V.intention.cible) : 'ta vedette';
    const leurJeu = I ? { ombre: `L'ombre suit ${vise}`, chasse: `La chasse vise ${vise}`, centre: 'Ils ferment le centre', assaut: 'Ils lancent de partout', cachot: 'Ils cherchent tes punitions' }[V.intention.cle] : '';
    const cout = motsDeStats(V.leurJeu, 3).map(m => `<span class="${m.bon ? 'rn-vert' : 'rn-rg'}">${esc(m.txt)}</span>`).join(' · ');
    leurs = `<div class="rn-panneau"><div class="rn-k">Leur jeu ce soir · ${esc(jeu.mot)}${eux.gardien ? ` · ${esc(court(eux.gardien))} ${pct3(eux.gardien.sv || 0)}` : ''}</div>
      <div class="rn-t rn-pied">${I ? `<span class="rn-rg">${I.ico} ${esc(leurJeu)}</span><br>${cout || '<span class="rn-gris">Rien qui se voie à la feuille</span>'}` : '<span class="rn-gris">Ils ne montrent rien avant le match.</span>'}</div></div>
      ${leur ? `<div class="rn-panneau"><div class="rn-k">Leur banc · il compte leurs joueurs</div>${leur.banc.length ? `<div class="rn-banc rn-petit">${leur.banc.map(x => `<span class="${x.marche ? 'rn-joue' : 'rn-eteinte'}">${carteP(x.cle)}</span>`).join('')}</div>` : '<div class="rn-t rn-gris rn-pied">Aucune pièce à cette ronde.</div>'}</div>` : ''}`;
    miens = `<div class="rn-panneau"><div class="rn-k">Ton banc ce soir</div>
      <div class="rn-pieces">${R.banc.map(k => `<div>${carteP(k)}<div class="rn-t"><b>${esc(PIECES[k].nom)}</b> <span class="rn-gris">· ${ligneCourte(S, k).replace('<br>', '</span><br><span class="rn-gris">')}</span></div></div>`).join('')}</div></div>`;
  }
  const decide = `${gestesDuSoir(S)}${enjeuHtml(S)}`;
  const corps = etroit(V) ? milieu(`${plaque}${chance}${leurs}${miens}${decide}`, 'rn-lecture', 'feuille')
    : large(V) ? milieu(`${colonne('eux', plaque, leurs)}${colonne('soir', chance, decide)}${colonne('toi', miens)}`, 'rn-colonnes rn-c-feuille')
      : milieu(`${colonne('eux', plaque, leurs, miens)}${colonne('soir', chance, decide)}`, 'rn-colonnes');
  return `${hud(S, { petit })}${corps}${pied}`;
}
/* ---------- le match au direct, son résultat ---------- */
/*
 * CE QUE LE BANDEAU DU DIRECT DIT DE CE SOIR (js/direct.js : `titre`, `sousTitre`, `etat`, et `tally`, les victoires de la
 * série en pastilles), lu AVANT que le match compte : la sorte du soir, le match, ton rang et ta fiche — en séries, la ronde
 * et où en est la série. Les deux clubs sont dans l'ordre de la feuille : celui qui joue chez lui d'abord.
 */
export function afficheDuDirect(S) {
  const R = S.R, c = R.soir, X = R.series;
  if (c.sorte !== 'serie') return { titre: { rival: 'Le rival du quart', affiche: 'Une affiche', elite: c.enjeu ? 'L\'élite, avec son enjeu' : 'Saison régulière' }[c.sorte] || 'Saison régulière', sousTitre: `Match ${c.k + 1}`, etat: `${ficheMot(R.ligue.fiches[0])} · ${rangTxt(rangDe(S, 0))}` };
  const { w, l } = X.moi;
  return { titre: RONDES[X.ronde], sousTitre: `Match ${w + l + 1}`, etat: w === l ? (w ? `Série égale ${w}-${l}` : 'La série commence') : w > l ? `Tu mènes ${w}-${l}` : `Tu tires de l'arrière ${l}-${w}`, tally: c.visiteur ? { wA: l, wB: w } : { wA: w, wB: l } };
}
/* ---------- le résultat : le sommaire du match, la ligue qui bouge ---------- */
/* Le galon du soir (js/run.js `galonsDuSoir`) : « 🎩 Le Chapeau, Lafleur », et « +1 » s'il y en a d'autres. */
const galonsDuSoirHtml = a => { const l = a.galons || [], g = l[0]; return g ? `<span class="rn-or">${LEGENDES[g.type].ico} ${esc(LEGENDES[g.type].nom)}, ${esc(court(g))}${l.length > 1 ? ` +${l.length - 1}` : ''}</span>` : ''; };
const gainsDuMatch = a => [a.pts ? `<span class="rn-vert">+${a.pts} point${a.pts > 1 ? 's' : ''}</span>` : '', a.jetons + a.prime > 0 ? `<span class="rn-or">+${a.jetons + a.prime} jetons</span>` : a.jetons < 0 ? `<span class="rn-rg">${a.jetons} jetons</span>` : '', galonsDuSoirHtml(a) || (a.etoile ? `${esc(court(a.etoile))} ${a.etoile.buts} buts` : '')].filter(Boolean).join(' · ');
/*
 * LE RÉSULTAT EST LE SOMMAIRE DU MATCH (JP, 25 nov. 2026 : *je m'ennuie de l'ancien moteur de match, avec stats super
 * détaillées*) : celui du jeu (js/bilan.js `sommaireHtml`), le même qu'aux séries du 82-0. D'un trait, il fait dix écrans :
 * il se range en quatre vues, une intention chacune, dans un cadre qui défile.
 *   « Sommaire »  ce qu'on vient chercher : qui a gagné et le pointage ; ce que le match t'a donné et ton rang, hier et ce
 *                 soir (c'est lui que le proprio lit) ; les pièces de ton banc qui ont joué ; les trois étoiles ; les buts ;
 *                 puis les autres pointages du soir, pour que la ligue existe.
 *   « Récit »     le match raconté : les faits saillants, puis chaque période avec ses récits, ses punitions, ses coups.
 *   « Chiffres »  le match compté : les tirs par période, l'avantage numérique, les punitions ; la glace et ses tirs ; les
 *                 gardiens.
 *   « Feuille »   ce que chaque patineur des deux clubs a fait ce soir : TG, B, A, PTS, +/−, T, MÉ, BL, PUN (elle glisse de côté).
 * Un seul bouton : la suite.
 */
const VUES_DU_RESULTAT = [['sommaire', 'Sommaire'], ['recit', 'Récit'], ['chiffres', 'Chiffres'], ['feuille', 'Feuille']];
/* Une vue du sommaire d'un match (`sommaireHtml`, js/bilan.js). Sous « Sommaire », les périodes ne montrent que leurs buts ; ailleurs, tout se lit (`som-plus`). */
const som = (html, tout = true) => `<div class="som-racine${tout ? ' som-plus' : ''}">${html}</div>`;
const vueDuSommaire = (P, vue, tete, soir = '') => (vue === 'recit' ? som(P.saillants + P.periodes) : vue === 'chiffres' ? som(P.tableau + P.glace + P.gardiens) : vue === 'feuille' ? som(P.feuille) : `${tete}${som(P.lignes + soir + P.etoiles + P.periodes, false)}`);
/*
 * LES VUES D'UN MATCH, À L'ÉCRAN. Au téléphone, un segment à quatre et une boîte qui défile. En large, le Sommaire reste à
 * gauche (qui a gagné, ton soir) et un segment à trois ouvre le reste à droite : le récit, les chiffres, la feuille.
 * `geste` : le geste du segment ; `fin` : ce qui suit le Sommaire (les autres pointages de la ligue).
 */
function vuesDuMatch(P, V, geste, choix, tete, soir = '', fin = '') {
  const vue = VUES_DU_RESULTAT.some(([k]) => k === choix) ? choix : 'sommaire', dans = html => `<div class="rn-somm">${html}</div>`;
  if (!large(V)) return `${segment(geste, vue, VUES_DU_RESULTAT)}${boite('vue', dans(`${vueDuSommaire(P, vue, tete, soir)}${vue === 'sommaire' ? fin : ''}`))}`;
  const droite = vue === 'sommaire' ? 'recit' : vue;
  return cote(boite('sommaire', dans(`${vueDuSommaire(P, 'sommaire', tete, soir)}${fin}`)), pile(segment(geste, droite, VUES_DU_RESULTAT.slice(1)), boite('vue', dans(vueDuSommaire(P, droite, '')))));
}
/* Ce qui fait d'une ligne de match une ligne qui rouvre sa feuille de match : rien, pour un match d'avant les archives. */
const quiRouvre = (S, k) => { const a = (S.R.archives || [])[k]; return a && !a.b.vieux ? { a: 'match-vu', v: k } : {}; };
/*
 * UN MATCH PASSÉ, ROUVERT (JP, 25 nov. 2026 : *la feuille de match, partout*) : les quatre vues du résultat, lues de sa
 * feuille de match gardée. Elle ne garde ni chaque lancer ni chaque coup : le récit dit les buts, les punitions, les
 * bagarres et les blessures, sans les coups d'épaule ni les faits saillants ; les chiffres, sans la carte des tirs. Ouvert
 * de Mon club et de la cédule ; « Retour » y ramène.
 */
export function sceneMatchVu(S, V) {
  const k = V.matchVu, m = S.R.matchs[k], M = matchPasse(S, k), serie = m.sorte === 'serie';
  const P = sommaireHtml({ f: M.f, A: M.A, B: M.B, avant: M.avant, pied: serie ? 'séries' : 'saison régulière', lien: (p, t, html) => nomQuiOuvre(p, html) }).parts;
  const tete = `<div class="rn-k ${m.gagne ? 'rn-vert' : 'rn-rg'}">Match ${k + 1} · ${m.gagne ? 'gagné' : m.ot ? 'perdu en prolongation' : 'perdu'} ${m.visiteur ? `à ${esc(ville(m.t))}` : `contre ${esc(surnom(m.t))}`}</div>`;
  return `${hud(S)}${onglets(V, S.R.series ? 'Séries' : 'Bureau', true)}${milieu(vuesDuMatch(P, V, 'seg-m', V.segM, tete), 'rn-tables')}${bas(bt('Retour', 'fermer-match-vu'))}`;
}
export function sceneResultat(S, V) {
  const R = S.R, a = R.apres, serie = a.sorte === 'serie', X = R.series, M = dernierMatch(S), F = R.ligue.fiches[0];
  const autres = (a.autres || []).slice(0, 10).map(m => `<div><span>${logoNo(S, m.a, 16)} ${nomDuClubNo(S, m.a)}</span><b>${m.gfA}-${m.gfB}${m.ot ? ' P' : ''}</b><span>${nomDuClubNo(S, m.b)} ${logoNo(S, m.b, 16)}</span></div>`).join('');
  const rang = a.rang ? `<div class="rn-cellules"><div><b>${rangTxt(a.rang[0])}</b><small>Hier</small></div><div><b class="${a.rang[1] < a.rang[0] ? 'rn-vert' : a.rang[1] > a.rang[0] ? 'rn-rg' : ''}">${rangTxt(a.rang[1])}</b><small>Ce soir</small></div><div><b>${ficheMot(F)}</b><small>Ta fiche</small></div></div>` : '';
  const laSerie = serie ? `<div class="rn-t"><b>La série : ${X.moi.w}-${X.moi.l}</b> <span class="rn-gris">· ${R.fin ? (R.fin.coupe ? 'la Coupe est à toi.' : 'la saison s\'arrête ici.') : 'quatre victoires pour passer.'}</span></div>` : '';
  const pieces = a.pieces.length ? `<div class="rn-k">Ton banc ce soir</div>${banc(S, { joue: a.pieces })}<div class="rn-t">${a.pieces.map(k => `<span class="rn-vert">${esc(PIECES[k].nom)}</span> <span class="rn-gris">· ${ligneCourte(S, k).replace('<br>', ' · ')}</span>`).join('<br>')}</div>` : '';
  const soir = `<div class="rn-soir"><div class="rn-t">${gainsDuMatch(a) || 'Aucun point'}</div>${rang}${laSerie}${pieces}</div>`;
  const P = M ? sommaireHtml({ f: M.f, A: M.A, B: M.B, avant: M.avant, pied: serie ? 'séries' : 'saison régulière', fiche: serie ? null : { v: F[0], d: F[1], pr: F[2] }, lien: (p, t, html) => nomQuiOuvre(p, html) }).parts : null;
  const verdict = `<div class="rn-k ${a.gagne ? 'rn-vert' : 'rn-rg'}">${a.gagne ? 'Gagné' : a.ot ? 'Perdu en prolongation' : 'Perdu'} ${a.visiteur ? `à ${esc(ville(a.t))}` : `contre ${esc(surnom(a.t))}`}</div>`;
  const ailleurs = autres ? `<div class="rn-k">Ailleurs dans la ligue</div><div class="rn-ailleurs">${autres}</div>` : '';
  // Une run gardée avant le 25 nov. 2026 n'a pas la feuille de son dernier match : le pointage et le soir, sans le sommaire.
  const corps = P ? vuesDuMatch(P, V, 'seg-r', V.segR, verdict, soir, ailleurs) : boite('vue', `<div class="rn-somm">${verdict}<div class="rn-titre">${a.gf} · ${a.ga}</div>${soir}${ailleurs}</div>`);
  const suite = R.fin ? 'Voir la fin' : R.suite[0] === 'piece' ? 'Ta pièce' : R.suite[0] === 'portes' ? 'Tes trois portes' : R.suite[0] === 'bilan' ? 'Le bilan du proprio' : serie ? 'Le tableau' : 'Au bureau';
  return `${hud(S, { petit: serie ? RONDES[Math.min(RONDES.length - 1, X.ronde)] : null })}${milieu(corps, 'rn-tables')}${bas(bt(suite, 'continuer', { cls: 'go' }))}`;
}

/* ---------- les portes, la porte ouverte, l'échange ---------- */
/* Le match gagné qui ouvre la scène : son pointage, ce qu'on a battu, ce que ça donne. Les portes et la pièce gagnée le disent du même bloc. */
const verdict = (S, donne) => { const a = S.R.apres; return a && a.gf != null ? `<section class="rn-panneau rn-verdict"><b class="rn-titre rn-vert">${a.gf}-${a.ga}</b><div class="rn-t"><b>${{ rival: 'Le rival est battu', elite: 'L\'élite est battue', affiche: 'L\'affiche est gagnée' }[a.sorte] || 'Gagné'}</b><br><span class="rn-gris">${donne}</span></div></section>` : ''; };
/*
 * LES TROIS PORTES, après un gros match gagné : le pic de la run. Dans l'ordre : le match gagné, les trois vrais vestiaires
 * (chacun avec ce qu'on y trouve dans ton espace), ton plafond. Dès que l'écran s'élargit, les portes prennent la rangée et
 * grandissent, le match gagné et ton plafond côte à côte au-dessus (la feuille : `.rn-les-portes`). Au clavier, on arrive sur
 * une porte, jamais sur « Passer ».
 */
export function scenePortes(S) {
  const R = S.R, P = R.portes, a = R.apres, relance = prixDeLaRelance(S);
  const portes = P.clubs.map((c, i) => { const n = vestiaireDe(S, c).filter(x => x.tient).length; return `<button type="button" class="rn-porte" data-a="ouvrir-porte" data-v="${i}"${i === 0 ? ' data-ici' : ''}>${P.affronte === `${c.s}:${c.t}` ? '<span class="rn-tag">Le club battu</span>' : ''}${logo(c.t, 66)}<b>${esc(surnom(c.t))}<small>${c.s}</small></b><strong>${n}<small>dans ton espace</small></strong></button>`; }).join('');
  return `${hud(S)}${milieu(`${verdict(S, a && a.sorte === 'rival' ? 'Des vestiaires du haut de l\'échelle.' : `Des vestiaires à la hauteur de ${esc(surnom(a ? a.t : ''))}.`)}
    ${chapeau('Trois vrais vestiaires', 'Un joueur, dans un de ces vestiaires', 'rn-centre')}<div class="rn-portes">${portes}</div>${panneauDuPlafond(S)}`, 'rn-lecture rn-les-portes', 'portes')}
  ${bas(bt('Passer', 'passer', { petit: `+${RUN.PASSER} jetons` }), bt('Relancer', 'relancer', { petit: relance === 0 ? `Gratuite · il t'en reste ${R.relances}` : relance == null ? 'Plus ce soir' : `${relance} jetons`, off: relance == null || relance > R.jetons }))}`;
}
/* Ce qu'un joueur allumerait chez toi : le premier accord neuf, à la place de qui sortirait. */
function accordQuIlAllume(S, p) {
  const g = groupeDe(p);
  if (g === 'G') return null;
  for (const s of SLOTS.filter(x => !x.scratch && !x.extra && x.group === g)) {
    const essai = { ...S.roster, [s.i]: p }, u = g === 'F' ? s.unit : Math.min(2, s.unit);
    const avant = new Set(accordsDe(S, u).map(x => x.aff.cle));
    const neuf = accordsDe({ roster: essai }, u).find(x => !avant.has(x.aff.cle) && (x.a === p || x.b === p));
    if (neuf) return { ...neuf, i: s.i };
  }
  return null;
}
/*
 * LA PORTE OUVERTE (et la pochette ouverte : la même, sans club). Ce qu'on te tend : le vestiaire, ses joueurs qui tiennent
 * dans ton espace (`vestiaireVu`). Ton côté : le joueur choisi, ton banc en lignes. La pochette ouverte a été payée :
 * « Ne rien signer » n'est pas un retour (Échap ouvre la pause, il n'y renonce pas).
 */
export function scenePorte(S, V) {
  const P = S.R.portes, c = P.pochette ? null : P.clubs[V.porte];
  const tous = vestiaireDe(S, c), dedans = tous.filter(x => x.tient), hors = tous.filter(x => !x.tient), { choisi, grille } = vestiaireVu(S, V, dedans, 'espace');
  return `${hud(S)}${comptoir('porte',
    `<div class="rn-plaque">${c ? logo(c.t) : ''}<div class="rn-nom">${c ? esc(clubMot(c)) : 'Ta pochette'}<small>${dedans.length} tien${dedans.length > 1 ? 'nent' : 't'} dans ton espace · ${money(espaceDe(S))}</small></div></div>${grille}
      ${hors[0] ? `<div class="rn-t rn-gris rn-centre">${esc(court(hors[0].p))}, ${money(prixDe(S, hors[0].p))} : hors de ton espace${hors.length > 1 ? `, comme ${pluriel(hors.length - 1, 'autre')}` : ''}.</div>` : ''}`,
    `${leChoisi(S, choisi, 'Personne ici ne tient dans ton espace.')}${panneauDuBanc(S)}`)}
  ${bas(P.pochette ? bt('Ne rien signer', 'rien-signer') : bt('Retour', 'fermer-porte'), bt('Voir l\'échange', 'vers-echange', { cls: 'go', v: choisi ? getPlayerKey(choisi.p) : '', off: !choisi }))}`;
}
const statsDuJoueur = p => (p.p === 'G' ? [['Victoires', p.w || 0, x => x], ['% d\'arrêts', p.sv || 0, pct3], ['Matchs', p.gp || 0, x => x]]
  : [['Points / match', (p.pt ?? (p.g || 0) + (p.a || 0)) / Math.max(1, p.gp), x => x.toFixed(2).replace('.', ',')], ['Tirs / match', (p.sh || 0) / Math.max(1, p.gp), x => x.toFixed(1).replace('.', ',')], ['% au tir', p.sh ? (100 * (p.g || 0)) / p.sh : 0, x => `${x.toFixed(1).replace('.', ',')} %`]]);
/*
 * L'ÉCHANGE (JP : *un comparatif en haut entre les deux joueurs, style Yahoo Fantasy*). Ce qu'on te tend : l'arrivant face à
 * celui qui sort, et leurs chiffres ligne à ligne. Ton côté : qui sort (la sortie proposée d'avance, V29 : le plus faible que
 * ton banc ne compte pas ; ceux qu'il compte ne sortent que si tu les touches) et ton plafond après ; « Signer » le redit,
 * pour qu'on ne signe jamais sans l'avoir à l'écran.
 */
export function sceneEchange(S, V) {
  const R = S.R, p = V.arrivant, compte = x => (R.banc.some(k => apportDe(k, x) > 0) ? 1 : 0);
  const sortants = sortantsPour(S, p).sort((a, b) => compte(a) - compte(b) || getHiddenRatings(a).v - getHiddenRatings(b).v);
  const sortant = sortants.find(x => getPlayerKey(x) === V.sortant) || sortants.find(x => masseApres(S, p, x) <= R.plafond) || sortants[0];
  const apres = masseApres(S, p, sortant), ok = apres <= R.plafond, reste = (1 - RUN.RACHAT) * prixDe(S, sortant);
  const A = statsDuJoueur(p), B = statsDuJoueur(sortant);
  const cas = SLOTS.find(s => S.roster[s.i] === sortant), ou = cas.scratch ? 'en civil' : cas.group === 'G' ? cas.role.toLowerCase() : `${ord(cas.unit + 1)} ${cas.group === 'F' ? 'trio' : 'paire'}`;
  const lui = (mot, cls, x) => `<span><b class="${cls}">${mot}</b>${carteJ(x)}</span>`;
  const chiffres = `<section class="rn-panneau rn-cmp">${A.map(([nom, a, dire], i) => `<span${a > B[i][1] ? ' class="rn-mieux"' : ''}>${dire(a)}</span><em>${nom}</em><span${B[i][1] > a ? ' class="rn-mieux"' : ''}>${dire(B[i][1])}</span>`).join('')}
    <span${prixDe(S, p) < prixDe(S, sortant) ? ' class="rn-mieux"' : ''}>${money(prixDe(S, p))}</span><em>Salaire</em><span${prixDe(S, sortant) < prixDe(S, p) ? ' class="rn-mieux"' : ''}>${money(prixDe(S, sortant))}</span></section>`;
  return `${hud(S, { titre: 'Signer', petit: `À la place de ${esc(court(sortant))}, ${esc(ou)} · tes lignes se rangent`, rang: false })}${comptoir('echange',
    // En large, le comparatif tient entre les deux cartes ; sinon dessous.
    large(V) ? `<div class="rn-face rn-entre">${lui('Il arrive', 'rn-vert', p)}${chiffres}${lui('Il sort', 'rn-rg', sortant)}</div>`
      : `<div class="rn-face">${lui('Il arrive', 'rn-vert', p)}<i>›‹</i>${lui('Il sort', 'rn-rg', sortant)}</div>${chiffres}`,
    `<section class="rn-panneau"><div class="rn-k">Qui sort · touche un joueur</div>
        <div class="rn-sortants">${sortants.slice(0, 14).map(x => `<button type="button" class="${x === sortant ? 'rn-on' : masseApres(S, p, x) > R.plafond ? 'rn-non' : ''}" aria-pressed="${x === sortant}" data-a="sortant" data-v="${getPlayerKey(x)}" aria-label="${esc(x.n)}">${carteJ(x)}</button>`).join('')}</div></section>
      ${panneauDuPlafond(S, { apres, ...(ok ? { jauge: plafond(S, { masse: apres, neuf: prixDe(S, p), mort: reste }) } : {}),
        sous: `<div class="rn-t rn-gris rn-pied">${esc(court(p))} : <span class="rn-or">+${money(prixDe(S, p))}</span>. ${esc(court(sortant))} sort : <span class="rn-rg">${money(reste)} restent à ton plafond</span> pour la saison.${ok ? '' : ' <span class="rn-rg">Ça ne passe pas.</span>'}</div>` })}`)}
  ${bas(bt('Retour', 'fermer-echange'), bt('Signer', 'signer', { cls: 'gold', off: !ok, v: getPlayerKey(sortant), petit: ok ? `${money(apres)} / ${money(R.plafond)}` : 'Ça ne passe pas' }))}`;
}
/*
 * UN RIVAL OU UNE ÉLITE BATTUS : leur pièce, avant leurs portes. Ce qu'on te tend : le match gagné, trois pièces, chacune avec
 * ce qu'elle compte chez toi. Ton côté : ton banc — la case libre, ou celle qui sort.
 */
export const scenePieceGagnee = (S, V) => `${hud(S)}${comptoir('piece',
  `${verdict(S, `${esc(surnom(S.R.apres.t))} te laissent une pièce de banc : une parmi trois.`)}${etalDePieces(S, V, true)}`, bancQuiRecoit(S, V))}
  ${bas(bt('Passer', 'piece-passee'), bt('Prendre', 'prendre-piece', { cls: 'gold', off: S.R.banc.length >= CASES_DU_BANC && !V.sort }))}`;

/* ---------- le bilan du quart, le marché du quart ---------- */
/*
 * LE BILAN. Le verdict en tête (c'est la question : est-ce que je perds un cœur ?), puis les trois objectifs avec leur
 * chiffre, puis ce que le quart laisse : tes cœurs, tes médailles, ton rang.
 */
export function sceneBilan(S) {
  const R = S.R, x = R.quarts.at(-1), congedie = R.coeurs <= 0, dernier = x.n === RUN.QUARTS.length - 1, seize = x.rang <= RUN.LIGUE.PLACES;
  const titre = congedie ? 'Congédié' : x.tenu ? 'Le proprio est content' : 'Le proprio grogne';
  const suite = congedie ? 'Le proprio te remercie. La saison s\'arrête ici.' : dernier ? (seize ? 'Tu es des seize : les séries commencent.' : 'Hors des seize : la saison s\'arrête après le marché.') : `Ensuite : le marché, puis le quart ${ROMAINS[x.n + 1]}.`;
  return `${hud(S, { petit: 'Le bilan' })}${trait('bilan', `${chapeau(`<span class="${x.tenu ? 'rn-vert' : 'rn-rg'}">${x.tenus} objectif${x.tenus > 1 ? 's tenus' : ' tenu'} sur trois</span>`, titre, 'rn-grand rn-centre')}
  <section class="rn-panneau">${objectifsHtml(S, x.objectifs)}</section>
  <div class="rn-cellules">
    <div><b>${Array.from({ length: RUN.COEURS }, (_, i) => coeur(i < R.coeurs)).join('')}</b><small>${x.coeur ? 'Un cœur perdu' : 'Tes cœurs gardés'}</small></div>
    <div><b class="${seize ? 'rn-vert' : 'rn-rg'}">${rangTxt(x.rang)}</b><small>Au classement</small></div>
    <div><b class="rn-or">+${x.medailles}</b><small>Médailles</small></div></div>
  <div class="rn-t rn-gris rn-centre">${suite}</div>`)}
  ${bas(bt(congedie ? 'Voir la fin' : 'Le marché du quart', 'apres-bilan', { cls: 'go' }))}`;
}
/*
 * LE MARCHÉ DU QUART. Ce qu'on te tend : une pièce de banc parmi trois, avec ton banc juste dessous (plein : celle qui sort
 * se choisit là, avec son compte). Ton côté : une carte à monter, un de tes joueurs une édition plus haut (la toucher passe
 * à la suivante). Les pochettes, elles, sont au bureau. Le bas ne dépense que ce qu'on a choisi.
 */
export function sceneMarche(S, V) {
  const R = S.R, M = R.marche, plein = R.banc.length >= CASES_DU_BANC;
  const piece = k => { const ok = !M.piece && R.jetons >= PRIX_PIECE; return `<button type="button" class="${V.piece === k ? 'rn-on' : ''}" aria-pressed="${V.piece === k}" data-a="voir-piece" data-v="${k}"${ok ? '' : ' disabled'}>${carteP(k)}<span class="rn-prix${ok ? '' : ' rn-non'}">${M.piece ? 'Prise' : `<i class="rn-piece"></i>${PRIX_PIECE}`}</span><p>${ligneCourte(S, k)}</p></button>`; };
  const candidats = aMonter(S), cm = candidats.find(x => getPlayerKey(x.p) === V.montee) || candidats[0] || null, peut = !M.montee && R.jetons >= RUN.MONTER;
  const gains = cm && cm.gains.length ? cm.gains.map(g => `${PIECES[g.cle].ico} +${String(g.d).replace('.', ',')}`).join(' · ') : 'Rien pour ton banc';
  const k = cm ? Object.keys(NOM_VARIANTE).indexOf(editionDe(cm.p)) : -1, apres = cm ? Object.keys(NOM_VARIANTE)[k + 1] : null;
  const monter = cm ? `<section class="rn-panneau rn-monter"><button type="button" data-a="voir-montee" aria-label="Une autre carte"${peut ? '' : ' disabled'}>${carteJ(cm.p)}</button><b class="rn-h rn-or">›</b><span class="rn-c rn-cj" style="${varsEquipe(cm.p)}">${cartonDe(cm.p, { rar: apres })}</span>
      <div class="rn-t"><b>${esc(court(cm.p))}</b><br><span class="rn-gris">${esc(NOM_VARIANTE[editionDe(cm.p)])} › </span><span class="rn-vert">${esc(NOM_VARIANTE[apres])}</span><br>${gains}<span class="rn-prix${peut ? '' : ' rn-non'}">${M.montee ? 'Montée' : `<i class="rn-piece"></i>${RUN.MONTER}`}</span></div></section>`
    : '<section class="rn-panneau"><div class="rn-t rn-gris">Toutes tes cartes sont au sommet.</div></section>';
  return `${hud(S, { titre: 'Le marché', petit: `Quart ${ROMAINS[R.quart.n]}` })}${comptoir('marche',
    `<div class="rn-k">Une pièce de banc · une seule</div><div class="rn-etal">${M.pieces.map(piece).join('')}</div>${bancQuiRecoit(S, V, !!M.piece)}`,
    `<div class="rn-k">Une carte à monter · toucher la carte : une autre</div>${monter}`)}
  ${V.piece && !M.piece ? bas(bt('Continuer', 'quitter-marche'), bt('Prendre la pièce', 'acheter-piece', { cls: 'gold', v: V.piece, off: plein && !V.sort }))
    : cm && peut ? bas(bt('Continuer', 'quitter-marche'), bt(`Monter ${esc(court(cm.p))}`, 'monter-au-marche', { cls: 'gold', v: getPlayerKey(cm.p) }))
      : bas(bt('Continuer', 'quitter-marche', { cls: 'go' }))}`;
}
/*
 * LES POCHETTES, au bureau : le Bronze et l'Époque, une de chaque par quart. Ce qu'on te tend : les deux pochettes, leur prix,
 * ce qu'elles donnent ; toucher l'une la paie et l'ouvre. Ton côté : ce qu'est une pochette, ton plafond (ce qu'on y signe doit
 * tenir dans ton espace). Sans rail, comme la pochette qu'on y ouvre : d'ici à « Signer », rien ne saute.
 */
export function sceneEtal(S) {
  const R = S.R;
  const pochette = (cle, mot, ico, metal, quoi) => { const prix = RUN.POCHETTES[cle], prise = R.quart.pochettes.includes(cle), ok = pochetteLibre(S, cle); return `<button type="button" data-a="pochette" data-v="${cle}"${ok ? '' : ' disabled'}><span class="rn-c" style="--pk-a:var(${metal})">${pochetteHtml({ mot, ico })}</span><span class="rn-prix${ok ? '' : ' rn-non'}">${prise ? 'Ouverte ce quart' : `<i class="rn-piece"></i>${prix}`}</span><p>${quoi}</p></button>`; };
  return `${hud(S, { titre: 'Les pochettes', petit: `Quart ${ROMAINS[R.quart.n]}` })}${comptoir('etal',
    `<section class="rn-panneau"><div class="rn-t">Une pochette s'ouvre comme une porte : tu y signes un joueur, ou aucun.<br><span class="rn-gris">Une de chaque par quart.</span></div></section>
      <div class="rn-etal rn-deux">${pochette('j:bronze', 'Bronze', '🥉', '--attention', 'Trois joueurs au hasard')}${pochette('j:epoque', 'Époque', '🕰', '--rn-bleu', 'Un pilier ou mieux, d\'une époque au hasard')}</div>`,
    panneauDuPlafond(S))}
  ${bas(bt('Retour au bureau', 'fermer-etal', { cls: 'go' }))}`;
}

/* ---------- le ballottage, une histoire ---------- */
/*
 * LE BALLOTTAGE, seulement s'il le faut (JP, 16 nov. 2026) : trois vrais joueurs pas chers, pour la case que personne chez
 * toi ne peut tenir. Ce qu'on te tend : la case à tenir et pourquoi, puis les trois. Ton côté : le joueur choisi.
 */
export function sceneBallottage(S, V) {
  const R = S.R, B = R.ballottage, cas = SLOTS.find(s => s.i === B.i), blesse = S.roster[B.i], offres = offresVues(S), choisi = offres.find(p => getPlayerKey(p) === V.joueur) || offres[0];
  const ou = cas.group === 'G' ? cas.role.toLowerCase() : `${cas.role}, ${ord(cas.unit + 1)} ${cas.group === 'F' ? 'trio' : 'paire'}`;
  return `${hud(S, { titre: 'Le ballottage', petit: '' })}${comptoir('ballottage',
    `<section class="rn-panneau"><div class="rn-t"><b>${blesse ? `${esc(court(blesse))} est à l'infirmerie` : 'Une case est vide'}</b> <span class="rn-gris">· ${esc(ou)}</span><br><span class="rn-gris">Personne chez toi ne peut tenir sa case. Réclame un joueur le temps de la blessure : il ne compte ni à ton plafond ni à ton banc.</span></div></section>
      <div class="rn-etal">${offres.map(p => `<button type="button" class="${p === choisi ? 'rn-on' : ''}" aria-pressed="${p === choisi}" data-a="voir-joueur" data-v="${getPlayerKey(p)}">${carteJ(p)}<p>${esc(court(p))}<br>${badgeMot(p)}</p></button>`).join('')}</div>`,
    choisi ? `<section class="rn-panneau"><b class="rn-h">${esc(choisi.n)}</b><div class="rn-t rn-gris rn-pied">Cette année-là : ${vraie(choisi)}.</div></section>` : '')}
  ${bas(bt('Personne', 'reclamer', { petit: 'Un remplaçant de la ligue' }), bt(choisi ? `Réclamer ${esc(court(choisi))}` : 'Réclamer', 'reclamer', { cls: 'go', v: choisi ? getPlayerKey(choisi) : '', off: !choisi }))}`;
}
/*
 * UNE HISTOIRE : quelqu'un du club vient te parler d'un de tes joueurs. Elle se lit avant de se répondre : ce qu'on te tend,
 * c'est la voix, sa réplique, le joueur et le fait ; ton côté, tes deux réponses en cartes de jeu, chacune avec ce qu'elle
 * change, et rien n'est coupé. Les deux « Prendre » sont dans le bas, au nom de leur carte : ce qui décide est à l'écran
 * avant tout défilement ; « Plus tard » la laisse au fil.
 */
export function sceneHistoire(S, V) {
  const H = V.histoire;
  return `${hud(S, { titre: 'Une histoire', petit: '' })}${comptoir('histoire',
    `<div><span class="rn-voix">${esc(H.voix)}</span><div class="rn-bulle">${H.dit}</div></div>
      ${H.joueur ? `<div class="rn-vignette rn-fait">${carteJ(H.joueur)}<div><div class="rn-h">${esc(H.joueur.n)}</div><div class="rn-t rn-gris rn-pied">${H.fait}</div></div></div>` : ''}`,
    H.options.length ? `<div class="rn-etal rn-deux">${H.options.map(o => `<div><span class="rn-c">${o.carte}</span><p>${o.lignes}</p></div>`).join('')}</div>` : '')}
  ${H.options.length ? bas(bt('Plus tard', 'fermer-histoire'), ...H.options.map((o, i) => bt('Prendre', 'reponse', { cls: 'gold', v: i, petit: o.nom }))) : ''}`;
}

/* ---------- les séries : les vraies, seize clubs, quatre rondes ---------- */
const pointsDeSerie = (w, l) => `<div class="rn-pts">${Array.from({ length: 7 }, (_, i) => `<i class="${i < w ? 'rn-g' : i < w + l ? 'rn-p' : ''}"></i>`).join('')}</div>`;
/*
 * LE TABLEAU DES SÉRIES, le premier onglet du bureau quand la saison est finie. Ta série d'abord, grosse (c'est le prochain
 * match) ; puis les autres séries de la ronde, en lignes (qui tu croiseras) ; puis tes rondes gagnées.
 */
function pageSeries(S, V) {
  const R = S.R, X = R.series, M = X.moi, adv = clubNo(S, M.adv), ronde = X.rondes[X.ronde], tete = i => X.tetes.indexOf(i) + 1;
  const autres = ronde.filter(x => x.a !== 0 && x.b !== 0).map(x => ligne([`${tete(x.a)}`, `${logoNo(S, x.a)} ${nomDuClubNo(S, x.a)}`, `<b>${x.w}-${x.l}</b>`, `${logoNo(S, x.b)} ${nomDuClubNo(S, x.b)}`, `${tete(x.b)}`]));
  const maSerie = `<div class="rn-k">${RONDES[X.ronde]} · quatre victoires pour passer</div>
    <div class="rn-ronde rn-on">${logo(adv.t, 44)}<b>${esc(clubMot(adv))}<small>${tete(M.adv)}e contre toi, ${tete(0)}e · ${M.w}-${M.l}</small></b>${pointsDeSerie(M.w, M.l)}</div>
    ${X.faites.length ? `<div class="rn-t rn-gris">Déjà battus : ${X.faites.map(f => `${esc(surnom(f.t))} ${f.w}-${f.l}`).join(' · ')}</div>` : ''}`;
  const lesAutres = autres.length ? `<section class="rn-panneau rn-sans">${tableau('22px 1fr 44px 1fr 22px', ['', 'Les autres séries', '', '', ''], autres, 'rn-series')}</section>` : '';
  const pied = bas(bt('La feuille du soir', 'match-de-serie', { cls: 'rn-combat' }));
  // Ta série d'abord (c'est le prochain match), puis les autres séries de la ronde : côte à côte dès qu'il y a la place.
  return `${etroit(V) ? milieu(`${maSerie}${lesAutres}`, 'rn-lecture', 'series') : milieu(`${colonne('serie', maSerie)}${colonne('autres', lesAutres)}`, 'rn-colonnes')}${pied}`;
}
/* ---------- la fin, la pause ---------- */
const CAUSES = { congedie: 'Congédié', saison: 'Hors des séries', serie: 'Éliminé en séries', coupe: 'La Coupe', quitte: 'Run quittée' };
export function sceneFin(S, V) {
  const R = S.R, F = R.fin, x = R.series;
  const quarts = R.quarts.map(q => `<div class="rn-recap"><span>Quart ${ROMAINS[q.n]}</span><span${q.tenu ? '' : ' class="rn-rg"'}>${q.tenus} objectif${q.tenus > 1 ? 's' : ''} sur trois · ${q.rang}e<small>${q.rival ? 'Rival battu' : 'Rival perdu'}, ${esc(surnom(q.t))}${q.coeur ? ' · un cœur perdu' : ''}</small></span><span class="rn-or">+${q.medailles}</span></div>`).join('');
  const series = x ? `<div class="rn-recap"><span>Séries</span><span>${F.coupe ? 'La Coupe' : F.rondes ? `${F.rondes} ronde${F.rondes > 1 ? 's gagnées' : ' gagnée'}` : 'Aucune ronde gagnée'}<small>${x.faites.map(f => `${esc(surnom(f.t))} ${f.w}-${f.l}`).join(', ') || esc(clubMot(clubNo(S, x.moi.adv)))}</small></span><span class="rn-or">+${F.medailles - (F.caisse || 0) - R.quarts.reduce((a, y) => a + y.medailles, 0)}</span></div>` : '';
  const caisse = F.caisse ? `<div class="rn-recap"><span>Caisse</span><span>${R.jetons} jetons qui restent<small>${RUN.JETONS_PAR_MEDAILLE} jetons, une médaille</small></span><span class="rn-or">+${F.caisse}</span></div>` : '';
  const etoile = V.etoile;
  // Ce qu'on te tend : le verdict de la run et son récit, quart par quart. Ton côté : ce qu'elle te laisse — ton joueur de la saison, tes trois chiffres, le Club où les dépenser.
  return `${entete('La fin', `Run ${R.numero} · ${esc(R.coach.n || COACHS[R.coach.cle].nom)}`)}${comptoir('fin',
    `${chapeau(`<span class="${F.coupe ? 'rn-vert' : 'rn-rg'}">${F.coupe ? 'Tu as gagné' : 'La run est finie'}</span>`, CAUSES[F.cause], 'rn-grand rn-centre')}
    <section class="rn-panneau">${quarts}${series}${caisse}${!quarts && !series && !caisse ? '<div class="rn-t rn-gris">La saison n\'avait pas commencé.</div>' : ''}</section>`,
    `${etoile ? `<div class="rn-vignette">${carteJ(etoile.p)}<div><div class="rn-k">Ton joueur de la saison</div><div class="rn-h">${esc(etoile.p.n)}</div><div class="rn-t rn-gris rn-pied">${etoile.mot}<br><span class="rn-vert">Sa carte entre à ton cartable</span>${(R.galons || []).length ? `<br><span class="rn-or">🏵 ${R.galons.length} galon${R.galons.length > 1 ? 's gravés' : ' gravé'} cette saison</span>` : ''}</div></div></div>` : ''}
    <div class="rn-cellules"><div><b class="rn-or">${F.medailles}</b><small>Médailles${reglesDe(R).prime > 1 ? ` · ×${String(reglesDe(R).prime).replace('.', ',')}` : ''}</small></div><div><b>${F.rang ? rangTxt(F.rang) : '—'}</b><small>${F.pts} points</small></div><div><b>${F.matchs}</b><small>Matchs joués</small></div></div>
    <button type="button" class="rn-bande" data-a="club">Le Club${medailles(V.medailles)}</button>`)}
  ${bas(bt('Menu', 'quitter'), bt('Une run neuve', 'run-neuve', { cls: 'go' }))}`;
}
export function scenePause(S, V) {
  const R = S.R, L = R.ligue;
  return `<div class="rn-pauseur"><div class="rn-pause-carte" role="dialog" aria-modal="true" aria-label="Pause">
    <div class="rn-k">Pause · run ${R.numero}</div><div class="rn-titre">${R.series ? 'Les séries' : R.quart ? `Quart ${ROMAINS[R.quart.n]}` : 'Le départ'}</div>
    <div class="rn-t rn-gris">${L ? `${rangDe(S, 0)}e · ${ficheMot(L.fiches[0])} · ` : ''}${pluriel(R.coeurs, 'cœur')} · ${R.jetons} jetons</div>
    <div class="rn-menu"><button type="button" class="rn-on" data-a="reprendre">Reprendre</button>
      <button type="button" data-a="menu">Le menu du jeu<small>La run est gardée</small></button>
      <button type="button" class="rn-quitter" data-a="abandonner">${V.sur ? 'Toucher encore : la run finit ici' : 'Quitter la run'}</button></div></div></div>`;
}
/* ---------- le Club : entre deux runs (V28, tranche 5, docs/refonte-v28-5.md § 3.1) ---------- */
/* Les médailles ont leur dessin, jamais la pièce des jetons. */
const medailles = n => `<span class="rn-jt rn-md"><i class="rn-medaille"></i>${n}</span>`;
const PAGES_DU_CLUB = [['variete', 'Variété'], ['club', 'Ton club'], ['album', 'Album'], ['palmares', 'Palmarès']];
/*
 * LE CLUB (`C` : ce que la coquille en sait — { meta, rang, nom, page, voie, coachs, rayons, rayon, objet }). Sa tête
 * remplace le HUD : ton écusson, ton nom, ton rang, tes médailles ; trois pages en segment, chacune tient en un écran.
 */
export function sceneClub(C, V) {
  const page = { variete: pageVariete, club: pageTonClub, album: pageAlbum, palmares: pagePalmares }[C.page] || pageVariete;
  const [offre, toi, pied] = page(C, V);
  return `${entete(esc(C.nom), esc(PRESTIGES[C.rang].nom), medailles(C.meta.ecussons || 0))}${sousTete('club', `<div class="rn-seg">${PAGES_DU_CLUB.map(([k, mot]) => `<button type="button" class="${C.page === k ? 'rn-on' : ''}" aria-pressed="${C.page === k}" data-a="page" data-v="${k}">${mot}</button>`).join('')}</div>`, offre, toi)}${pied}`;
}
/* Variété : les huit philosophies, celle qu'on touche à côté ; l'achat répond sur place. « Ouvrir » dépense : il n'a jamais le focus d'office. */
function pageVariete(C) {
  const m = C.meta, ouvertes = voiesOuvertes(m), prix = prixDeLaVoie(m), v = C.voie, P = COACHS[v], regle = REGLES_DU_COACH[v], ouverte = ouvertes.includes(v);
  const piece = PIECE_DU_COACH[v], x = C.coachs && C.coachs[v], manque = ouverte || prix == null ? 0 : Math.max(0, prix - (m.ecussons || 0));
  const carte = k => `<button type="button" class="${k === v ? 'rn-on' : ''}${ouvertes.includes(k) ? '' : ' rn-fermee'}" aria-pressed="${k === v}" data-a="voir-voie" data-v="${k}" aria-label="${esc(COACHS[k].nom)}${ouvertes.includes(k) ? '' : ', à ouvrir'}"><span class="rn-c">${
    carteHtml({ cle: k, niveau: 0, genreCarte: 'synergie', ico: COACHS[k].ico, nomHtml: esc(COACHS[k].nom), typeHtml: 'Philosophie', lecture: true, statique: true })}</span></button>`;
  return [`<div class="rn-k">${ouvertes.length} de ${VOIES.length} philosophies${prix != null ? ` · la prochaine : ${prix}` : ''}</div><div class="rn-voies">${VOIES.map(carte).join('')}</div>`,
    `<section class="rn-panneau rn-on">
    <div class="rn-entete"><b class="rn-h">${P.ico} ${esc(P.nom)}</b><span class="rn-puce ${ouverte ? 'rn-v' : 'rn-o'}">${ouverte ? (m.nouvelle === v ? 'Nouvelle' : 'Ouverte') : `À ouvrir · ${prix}`}</span></div>
    <div class="rn-t rn-gris">${esc(P.mot)}</div>
    ${regle ? `<div class="rn-t rn-pied"><span class="rn-k">Sa règle</span><br>${esc(regle.dit.charAt(0).toUpperCase() + regle.dit.slice(1))} : <span class="rn-or">+${regle.jetons} jetons</span> le soir.</div>` : ''}
    <div class="rn-vignette rn-pied">${carteP(piece)}<div class="rn-t"><span class="rn-k">Sa pièce de départ</span><br><b>${esc(PIECES[piece].nom)}</b><br><span class="rn-gris">${ligneSansRun(piece)}</span></div></div>
    ${x ? `<div class="rn-t rn-gris rn-pied">${x.n} entraîneurs au tirage, dont ${esc(x.exemple)}.</div>` : ''}</section>`,
    bas(bt('Retour', 'fermer-club'), ouverte || prix == null ? bt('Une run neuve', 'run-neuve', { cls: 'go' }) : bt(manque ? `Il te manque ${manque}` : `Ouvrir · ${prix}`, 'ouvrir-voie', { cls: 'gold', v, off: manque > 0 }))];
}
/* Ton club : son écusson et son nom (vendus ensemble), ses couleurs ; un acquis se porte d'un toucher. « Acheter » dépense : jamais le focus d'office. */
function pageTonClub(C) {
  const R = C.rayons.find(r => r.cle === C.rayon) || C.rayons[0], o = R.objets.find(x => x.cle === C.objet) || R.objets.find(x => x.porte) || R.objets[0];
  const manque = o.acquis ? 0 : Math.max(0, o.prix - (C.meta.ecussons || 0));
  const etat = o.porte ? 'Porté' : o.acquis ? 'À toi' : o.verrou ? `Demande le rang ${o.verrou}` : `${o.prix} médailles`;
  const tuile = x => `<button type="button" class="${[x.cle === o.cle ? 'rn-on' : '', x.porte ? 'rn-revetu' : '', x.acquis ? '' : 'rn-fermee'].filter(Boolean).join(' ')}" aria-pressed="${x.cle === o.cle}" data-a="voir-objet" data-v="${x.cle}" aria-label="${esc(x.nom)}"${
    x.nuance ? ` style="--a:${x.nuance[0]};--b:${x.nuance[1]}"></button>` : `>${x.apercu}</button>`}`;
  const action = o.porte ? bt('Porté', 'prendre-objet', { v: o.cle, off: true })
    : bt(o.acquis ? 'Porter' : o.verrou ? 'Rang trop bas' : manque ? `Il te manque ${manque}` : `Acheter · ${o.prix}`, 'prendre-objet', { cls: o.acquis ? 'go' : 'gold', v: o.cle, off: !o.acquis && (!!o.verrou || manque > 0) });
  return [`<div class="rn-seg">${C.rayons.map(r => `<button type="button" class="${r.cle === R.cle ? 'rn-on' : ''}" aria-pressed="${r.cle === R.cle}" data-a="rayon" data-v="${r.cle}">${r.cle === 'club' ? 'Écusson' : 'Couleurs'}</button>`).join('')}</div>
    <section class="rn-panneau rn-apercu">${o.apercu}<div><b class="rn-h">${esc(o.nom)}</b><div class="rn-t rn-gris">${esc(etat)}</div></div></section>`,
    `<div class="${R.cle === 'club' ? 'rn-clubs' : 'rn-couleurs'}">${R.objets.map(tuile).join('')}</div>`,
    bas(bt('Retour', 'fermer-club'), action)];
}
/*
 * L'Album (tranche 5b) : ton cartable, les plus belles cartes d'abord — autant que l'écran en tient (JP, 25 nov. 2026 ;
 * `tuilesDe`), qu'on feuillette du bas ; celle qu'on touche dit son édition, ses copies et ce qui est gravé dessus. `A`
 * (`C.album`) : l'album à plat (js/cartable.js `albumDuCartable`), le segment, la page, la carte vue, et les joueurs des
 * saisons déjà chargées (`A.joueurs` : la clé → le joueur).
 */
export const listeDeLAlbum = A => (A.seg === 'coachs' ? A.coachs : A.seg === 'gravees' ? A.cartes.filter(x => x.legendes.length) : A.cartes);
function pageAlbum(C, V) {
  const A = C.album, liste = listeDeLAlbum(A), parPage = tuilesDe(V), pages = Math.max(1, Math.ceil(liste.length / parPage)), page = Math.min(A.page, pages - 1);
  const ici = liste.slice(page * parPage, (page + 1) * parPage), id = x => x.k || x.id, vue = ici.find(x => id(x) === A.vue) || ici[0];
  const tuile = x => { const p = x.k && A.joueurs.get(x.k); return `<button type="button" class="${x === vue ? 'rn-on' : ''}" aria-pressed="${x === vue}" data-a="voir-carte" data-v="${esc(id(x))}" aria-label="${esc(x.k ? (p ? p.n : x.k) : x.n)}">${
    x.k ? (p ? `<span class="rn-c rn-cj" style="${varsEquipe(p)}">${cartonDe(p, { rar: x.ed })}</span>` : '<span class="rn-c rn-vide"></span>') : `<span class="rn-c">${carteDuCoachHtml(x)}</span>`}${x.k && x.legendes.length ? `<span class="rn-tag">${x.legendes.length} 🏵</span>` : ''}</button>`; };
  const gravures = l => l.slice(-3).reverse().map(g => `${LEGENDES[g.type].ico} <b>${esc(LEGENDES[g.type].nom)}</b> · ${esc(LEGENDES[g.type].recit(g))}`).join('<br>') + (l.length > 3 ? `<br><span class="rn-gris">et ${l.length - 3} de plus</span>` : '');
  const detail = !vue ? '' : vue.k ? (() => { const p = A.joueurs.get(vue.k); return `<div class="rn-entete"><b class="rn-h">${esc(p ? p.n : '…')}</b><span class="rn-puce rn-o">${esc(NOM_VARIANTE[vue.ed])}${vue.n > 1 ? ` · ${vue.n} copies` : ''}</span></div>
      <div class="rn-t rn-gris">${esc(clubMot({ t: vue.club, s: vue.saison }))}</div><div class="rn-t rn-pied">${vue.legendes.length ? gravures(vue.legendes) : '<span class="rn-gris">Rien de gravé encore : un chapeau, un jeu blanc, dix buts dans une run s\'y graveront.</span>'}</div>`; })()
    : `<div class="rn-entete"><b class="rn-h">${esc(vue.n)}</b><span class="rn-puce rn-o">${vue.r || 1} run${(vue.r || 1) > 1 ? 's' : ''}</span></div>
      <div class="rn-t rn-gris">${esc(clubMot({ t: vue.tag, s: vue.saison }))}${vue.fiche ? ` · ${esc(vue.fiche)}` : ''}</div><div class="rn-t rn-pied">${COACHS[vue.cle].ico} <b>${esc(COACHS[vue.cle].nom)}</b> · ${esc(motDuRang(vue.cle, vue.rang))}</div>`;
  const segs = [['joueurs', `Joueurs · ${A.cartes.length}`], ['gravees', `Gravées · ${A.cartes.filter(x => x.legendes.length).length}`], ['coachs', `Entraîneurs · ${A.coachs.length}`]];
  const vide = A.seg === 'gravees' ? 'Aucune carte gravée encore. Un chapeau, un jeu blanc, dix buts dans une run se gravent sur la carte du joueur.' : A.seg === 'coachs' ? 'Aucun entraîneur encore : celui d\'une run entre ici.' : 'Ton album est vide. Un joueur de ton effectif y entre, à la fin de la run.';
  return [`<div class="rn-k">${A.cartes.length} carte${A.cartes.length > 1 ? 's' : ''} de ${A.clubs} club${A.clubs > 1 ? 's' : ''}-saison${A.clubs > 1 ? 's' : ''} · ${A.galons} galon${A.galons > 1 ? 's' : ''}</div>
    <div class="rn-seg">${segs.map(([k, mot]) => `<button type="button" class="${A.seg === k ? 'rn-on' : ''}" aria-pressed="${A.seg === k}" data-a="album-seg" data-v="${k}">${mot}</button>`).join('')}</div>
    ${ici.length ? `<div class="rn-grille rn-album" style="--n:${DE_FRONT[V.largeur] || 3}">${ici.map(tuile).join('')}</div>` : `<section class="rn-panneau"><div class="rn-t rn-gris">${vide}</div></section>`}`,
    ici.length ? `<section class="rn-panneau rn-on">${detail}</section>` : '',
    bas(bt('Retour', 'fermer-club'), bt('‹', 'album-page', { v: '-1', off: page <= 0 }), bt(`${page + 1} / ${pages} ›`, 'album-page', { v: '1', cls: 'go', off: page >= pages - 1 }))];
}
/* Palmarès : tes runs, l'échelle du prestige (le rang d'après dit ce qui manque), tes exigences, la trace du solde. */
function pagePalmares(C) {
  const m = C.meta, M = m.meilleur, cran = cranOuvert(m);
  const meilleur = !M ? 'Aucune run finie' : M.coupe ? 'La Coupe' : M.ronde ? `${M.ronde} ronde${M.ronde > 1 ? 's gagnées' : ' gagnée'} en séries` : `${M.pts} points dans la run`;
  const echelon = (P, i) => `<div class="rn-recap"><span>${i + 1}</span><span${i > C.rang ? ' class="rn-gris"' : ''}>${esc(P.nom)}<small>${i <= C.rang ? esc(P.texte) : `${P.min} médailles à vie${P.exploit ? ` · ${P.exploit}` : ''}`}</small></span><span class="${i === C.rang ? 'rn-or' : 'rn-gris'}">${i === C.rang ? 'Ton rang' : i < C.rang ? 'Fait' : ''}</span></div>`;
  return [`<div class="rn-cellules"><div><b>${m.runs || 0}</b><small>Runs</small></div><div><b>${m.coupes || 0}</b><small>Coupes</small></div><div><b class="rn-or">${ecussonsAVie(m)}</b><small>Médailles à vie</small></div></div>
    <section class="rn-panneau"><div class="rn-k">Le prestige</div>${PRESTIGES.map(echelon).join('')}</section>`,
    `<section class="rn-panneau">
    <div class="rn-recap"><span>Record</span><span>${esc(meilleur)}</span><span></span></div>
    <div class="rn-recap"><span>Exigence</span><span>${(m.coupes || 0) > 0 ? `Cran ${m.exigence || 0} gagné<small>Le cran ${cran} est ouvert${cran ? ` : ${esc(EXIGENCES[cran - 1].texte)}` : ''}</small>` : 'Fermée<small>La première Coupe ouvre le cran 1</small>'}</span><span></span></div>
    ${m.solde && (m.solde.rendu || m.arret) ? `<div class="rn-recap"><span>Solde</span><span>L'ancien Rogue<small>${m.solde.rendu} médailles remboursées${m.arret && m.arret.verse ? `, ${m.arret.verse} versées à l'arrêt` : ''}</small></span><span></span></div>` : ''}
  </section>`, bas(bt('Retour', 'fermer-club'))];
}
/*
 * LE SOLDE DE L'ANCIEN ROGUE, une fois (`s` : { avant, rendu, familles, voies, arret, apres }) : ce que l'arrêt de la vieille
 * run a versé, chaque famille de déblocages remboursée, les philosophies gardées ; « tu avais, tu as ». D'un trait.
 */
export function sceneSolde(s) {
  const lignes = [
    ...(s.arret ? [`<div class="rn-recap"><span>Arrêt</span><span>${s.arret.runs} run${s.arret.runs > 1 ? 's arrêtées' : ' arrêtée'}, ses séries payées</span><span class="rn-or">+${s.arret.verse}</span></div>`] : []),
    ...s.familles.map(f => `<div class="rn-recap"><span>×${f.n}</span><span>${esc(f.nom)}</span><span class="rn-or">+${f.prix}</span></div>`),
    ...(s.voies.length ? [`<div class="rn-recap"><span>×${s.voies.length}</span><span>${s.voies.length > 1 ? 'Philosophies gardées' : 'Philosophie gardée'}<small>${s.voies.map(v => esc(COACHS[v].nom)).join(', ')}</small></span><span class="rn-vert">À toi</span></div>`] : []),
  ];
  return `${entete('Le solde', 'Une fois')}${trait('solde', `${chapeau('Une fois', 'L\'ancien Rogue est parti', 'rn-grand')}
    <div class="rn-t rn-gris">Tes médailles achetaient de la force. Elles ouvrent maintenant de la variété : ce que tu avais acheté t'est rendu, à son prix.</div>
  <section class="rn-panneau rn-solde">${lignes.join('')}</section>
  <div class="rn-cellules"><div><b>${Math.max(0, s.avant - (s.arret ? s.arret.verse : 0))}</b><small>Tu avais</small></div><div><b class="rn-or">+${s.rendu + (s.arret ? s.arret.verse : 0)}</b><small>Rendu</small></div><div><b class="rn-or">${s.apres}</b><small>Tu as</small></div></div>`)}
  ${bas(bt('Au Club', 'solde-club'), bt('Continuer', 'solde-depart', { cls: 'go' }))}`;
}
