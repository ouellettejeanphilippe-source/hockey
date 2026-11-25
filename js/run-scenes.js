/*
 * LES SCÈNES DU ROGUE (V30, docs/refonte-v30-2.md § 3.8 ; JP, 16 nov. 2026 : *bureau EHM, match illustré* ; 17 nov. : les
 * écrans se codent sans tour de maquettes). Chaque scène est une fonction pure : la séance `S` (js/run.js) et la vue `V` (ce
 * que l'écran regarde : l'onglet, le joueur tenu, la porte ouverte) rendent le HTML d'un plan fixe de 390 × 844. Un bouton
 * porte `data-a` (son geste) et `data-v` (sa valeur) ; js/run-jeu.js les joue. Les cartes sont celles du jeu, telles quelles.
 *
 *   LE BUREAU   l'accueil : cinq onglets en bas (Bureau, Alignement, Masse, Ligue, Mon club), des tableaux denses ; un
 *               tableau plus long que son cadre défile DANS son cadre (`.rn-cadre`), la scène ne défile jamais.
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
  budgetDuTour, vestiaireDuRepechage, classement, rangDe, clubNo, meneursDe, matchNo, prochainSoir, etatDeLObjectif, histoireDuJour, pochetteLibre, offresVues, dernierMatch,
} from './run.js';

/* ---------- les petites briques ---------- */
const ROMAINS = ['I', 'II', 'III', 'IV'];
const coeur = plein => `<svg class="rn-co${plein ? '' : ' rn-vide'}" viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21.2 2.6 11.6a6.1 6.1 0 0 1 8.6-8.6l.8.8.8-.8a6.1 6.1 0 0 1 8.6 8.6z"/></svg>`;
const bt = (mot, a, { cls = '', v = '', petit = '', off = false } = {}) => `<button type="button" class="btn rn-bt${cls ? ` ${cls}` : ''}" data-a="${a}"${v !== '' ? ` data-v="${esc(v)}"` : ''}${off ? ' disabled' : ''}>${mot}${petit ? `<small>${petit}</small>` : ''}</button>`;
const bas = (...boutons) => `<div class="rn-bas">${boutons.join('')}</div>`;
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
  return `<div class="rn-hud">${logo('YOU', 34)}
    <span class="rn-acte">${nom}${sous ? `<small>${sous}</small>` : ''}</span>
    ${place ? `<span class="rn-cible${place <= RUN.LIGUE.PLACES ? ' rn-on' : ''}"><b>${rangTxt(place)}</b><small>${2 * L.fiches[0][0] + L.fiches[0][2]} pts</small></span>` : ''}
    ${bourse ? `<span class="rn-jt"><i class="rn-piece"></i>${R.jetons}</span>` : ''}
    <span class="rn-coeurs" role="img" aria-label="${R.coeurs} cœur${R.coeurs > 1 ? 's' : ''} sur ${RUN.COEURS}">${Array.from({ length: RUN.COEURS }, (_, i) => coeur(i < R.coeurs)).join('')}</span>
    ${pause ? `<button type="button" class="rn-pause" data-a="pause" aria-label="Pause"><i>${ico('i-menu')}</i></button>` : ''}
  </div>`;
}
const banc = (S, { joue = null, libre = false, largeur = '' } = {}) => `<div class="rn-banc"${largeur ? ` style="width:${largeur}"` : ''}>${
  S.R.banc.map(k => `<span class="${joue ? (joue.includes(k) ? 'rn-joue' : 'rn-eteinte') : ''}">${carteP(k)}</span>`).join('')
}${Array.from({ length: CASES_DU_BANC - S.R.banc.length }, (_, i) => `<span class="rn-vide${libre && i === 0 ? ' rn-on' : ''}"></span>`).join('')}</div>`;
const plafond = (S, { neuf = 0, mort = 0 } = {}) => {
  const R = S.R, pc = x => `${Math.max(0, Math.min(100, (100 * x) / R.plafond)).toFixed(1)}%`;
  const base = masseDe(S) - neuf - mort;
  return `<div class="rn-plaf"><i style="width:${pc(base)}"></i>${neuf ? `<i class="rn-neuf" style="left:${pc(base)};width:${pc(neuf)}"></i>` : ''}${mort ? `<i class="rn-mort" style="left:${pc(base + neuf)};width:${pc(mort)}"></i>` : ''}</div>`;
};
/* Un tableau : ses colonnes (`cols`, une grille), sa tête, ses lignes ; une ligne qu'on touche est un bouton de 44 px. */
const tableau = (cols, tete, lignes, cls = '') => `<div class="rn-tab${cls ? ` ${cls}` : ''}" style="--cols:${cols}"><div class="rn-l rn-tete">${tete.map(x => `<span>${x}</span>`).join('')}</div>${lignes.join('')}</div>`;
const ligne = (cellules, { cls = '', a = '', v = '' } = {}) => (a ? `<button type="button" class="rn-l${cls ? ` ${cls}` : ''}" data-a="${a}" data-v="${esc(v)}">` : `<div class="rn-l${cls ? ` ${cls}` : ''}">`) + cellules.map(x => `<span>${x}</span>`).join('') + (a ? '</button>' : '</div>');

/* ---------- l'attente, le départ ---------- */
export const sceneAttente = mot => `<div class="rn-attente"><i></i><span>${esc(mot)}</span></div>`;
/* La carte d'un entraîneur (`x` : sa philosophie, son rang, son nom, son club et sa saison) : au loto du départ, à l'Album. */
const carteDuCoachHtml = x => carteHtml({ cle: 'coach', niveau: niveauDuCoach(x.rang) - 1, genreCarte: 'synergie', ico: COACHS[x.cle].ico, nomHtml: esc(x.n), typeHtml: esc(clubMot({ t: x.tag, s: x.saison })),
  statique: true, lecture: true, style: varsCarton(getTeamBand(x.tag)) });
const pas = k => `<div class="rn-pas" style="left:14px;right:14px;top:118px">${['1 · Ton coach', '2 · Ton banc', '3 · Le repêchage'].map((mot, i) => `<span${i === k ? ' class="rn-on"' : ''}>${mot}</span>`).join('')}</div>`;
/* Le départ : ton coach, un parmi trois (le loto d'aujourd'hui), sa règle, sa pièce de départ. */
export function sceneDepart(V) {
  const c = V.loto[V.coach], C = COACHS[c.cle], regle = REGLES_DU_COACH[c.cle], piece = PIECE_DU_COACH[c.cle], k = niveauDuCoach(c.rang) - 1;
  return `<div style="left:14px;right:14px;top:22px"><div class="rn-k" style="margin-right:124px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Run ${V.numero} · une saison, toutes les époques</div><div class="rn-titre" style="margin-top:6px">Ton coach</div><div class="rn-t rn-gris" style="margin-top:4px">${V.arret != null ? `Le Rogue est devenu une saison : ta run d'avant s'arrête. <span class="rn-or">+${V.arret} médailles</span>` : 'Un parmi trois. Il fait toute la saison.'}</div></div>
  ${pas(0)}
  <div class="rn-loto" style="left:14px;right:14px;top:166px">${V.loto.map((x, i) => `<button type="button" class="${i === V.coach ? 'rn-on' : ''}" data-a="coach" data-v="${i}"><span class="rn-c">${carteDuCoachHtml(x)}</span><p>${x.nouvelle ? '<span class="rn-puce rn-v">Nouveau</span>' : ''}<b>${esc(x.n)}</b>${esc(clubMot({ t: x.tag, s: x.saison }))}<br>${x.fiche.v}-${x.fiche.d}-${x.fiche.n}${x.coupe ? ' · la Coupe' : ''}</p></button>`).join('')}</div>
  <div class="rn-panneau rn-on" style="left:14px;right:14px;top:428px">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><b class="rn-h">${C.ico} ${esc(C.nom)}</b><span class="rn-puce rn-o">${esc(nomDuNiveau(k))}</span></div>
    <div class="rn-t rn-gris" style="margin-top:6px">${esc(motDuRang(c.cle, c.rang))}, cette saison-là.</div>
    ${regle ? `<div class="rn-t" style="margin-top:8px"><span class="rn-k">Sa règle</span><br>${esc(maj(regle.dit))} : <span class="rn-or">+${regle.jetons} jetons</span> le soir.</div>` : ''}
  </div>
  <div class="rn-panneau" style="left:14px;right:14px;top:560px;display:grid;grid-template-columns:70px 1fr;gap:12px;align-items:center">${carteP(piece)}
    <div class="rn-t"><span class="rn-k">Sa pièce de départ${NIVEAUX[k].maitrise !== 1 ? ` · ×${String(NIVEAUX[k].maitrise).replace('.', ',')}` : ''}</span><br><b>${esc(PIECES[piece].nom)}</b><br><span class="rn-gris">${ligneSansRun(piece)}</span></div></div>
  <button type="button" class="rn-versclub" style="right:14px;top:18px" data-a="club" aria-label="Le Club, ${V.medailles} médailles">${logo('YOU', 26)}${medailles(V.medailles)}</button>
  ${V.cranMax > 0 ? `<div class="rn-crans" style="left:14px;right:14px;top:700px">${Array.from({ length: EXIGENCES.length + 1 }, (_, n) => `<button type="button" class="${n === V.cran ? 'rn-on' : ''}" data-a="cran" data-v="${n}"${n > V.cranMax ? ' disabled' : ''}><b>${n}</b>${n ? esc(EXIGENCES[n - 1].court) : 'Sans exigence'}</button>`).join('')}</div>` : ''}
  ${bas(bt('Menu', 'quitter'), bt(`Prendre ${esc(court({ n: c.n }))}`, 'prendre-coach', { cls: 'go' }))}`;
}
/* Une pièce offerte (le départ, le rival battu, l'élite gagnée) ; banc plein, celle qui sort. */
function etalDePieces(S, V, { titre, sous }) {
  const R = S.R, o = R.apres.offertes, plein = R.banc.length >= CASES_DU_BANC, choisie = o.includes(V.piece) ? V.piece : o[0];
  const ligneDeLaPiece = k => (R.ligue ? ligneCourte(S, k) : `Compte ${esc(PIECES[k].qui)}<br>à ${PIECES[k].seuils.join(', ')}`);
  return `<div style="margin-bottom:12px"><div class="rn-k">${titre}</div><div class="rn-h" style="margin-top:3px">${sous}</div></div>
  <div class="rn-etal">${o.map(k => `<button type="button" class="${k === choisie ? 'rn-on' : ''}" data-a="voir-piece" data-v="${k}">${carteP(k)}<p${k === choisie ? ' class="rn-or"' : ''}>${ligneDeLaPiece(k)}</p></button>`).join('')}</div>
  <div style="margin-top:22px"><div class="rn-k" style="margin-bottom:8px">Ton banc${plein ? ' · plein : touche celle qui sort' : ' · une case libre'}</div>
    <div class="rn-banc" style="width:300px">${R.banc.map(k => `<button type="button" class="${V.sort === k ? 'rn-eteinte' : ''}" data-a="piece-sort" data-v="${k}"${plein ? '' : ' disabled'}>${carteP(k)}</button>`).join('')}${Array.from({ length: CASES_DU_BANC - R.banc.length }, (_, i) => `<span class="rn-vide${i === 0 ? ' rn-on' : ''}"></span>`).join('')}</div></div>`;
}
/* Tes deux pièces de banc, avant le repêchage : elles disent quoi repêcher. Aucun « Passer ». */
export const scenePieceDuDepart = (S, V) => `<div style="left:14px;right:14px;top:22px"><div class="rn-k">Pièce ${S.R.pieces + 2} de ${RUN.PIECES_DU_DEPART + 1}</div><div class="rn-titre" style="margin-top:6px">Ton banc</div><div class="rn-t rn-gris" style="margin-top:4px">Une pièce compte les badges de tes joueurs. Choisis ce que tu vas repêcher.</div></div>
  ${pas(1)}
  <div style="left:14px;right:14px;top:176px">${etalDePieces(S, V, { titre: 'Une parmi trois', sous: 'Elle reste toute la saison' })}</div>
  ${bas(bt('Prendre', 'prendre-piece', { cls: 'gold' }))}`;

/* ---------- le repêchage de 23 ---------- */
const PAR_PAGE = 5;
const vraie = p => (p.p === 'G' ? `${p.w || 0} victoires, ${pct3(p.sv || 0)} d'efficacité en ${p.gp} matchs` : `${p.g || 0} buts, ${p.pt ?? (p.g || 0) + (p.a || 0)} points en ${p.gp} matchs`);
/* Ton banc en trois lignes serrées : ce qu'il compte déjà, et le seuil d'après. */
const bancEnLignes = S => S.R.banc.map(k => { const n = compteDe(k, signesDe(S)), suivant = seuilSuivant(k, n); return `<span>${PIECES[k].ico} ${esc(PIECES[k].nom)} <b>${Math.floor(n)}${suivant != null ? ` / ${suivant}` : ''}</b> ${points(marcheDe(k, n))}</span>`; }).join('');
export function sceneRepechage(S, V) {
  const R = S.R, rep = R.rep, tous = vestiaireDuRepechage(S), dedans = tous.filter(x => x.tient), hors = tous.filter(x => !x.tient);
  const pages = Math.max(1, Math.ceil(dedans.length / PAR_PAGE)), page = Math.min(V.page || 0, pages - 1), vus = dedans.slice(page * PAR_PAGE, (page + 1) * PAR_PAGE);
  const choisi = dedans.find(x => getPlayerKey(x.p) === V.joueur) || vus[0] || null, reste = dedans.length - vus.length;
  const n = { F: 0, D: 0, G: 0 };
  for (const p of effectifDe(S)) n[groupeDe(p)]++;
  const tuile = x => { const a = apportsHtml(S, x.p); return `<button type="button" class="${choisi === x ? 'rn-on' : ''}" data-a="voir-joueur" data-v="${getPlayerKey(x.p)}">${carteJ(x.p)}${a ? `<span class="rn-coin">${a}</span>` : ''}<span class="rn-sousc">${money(prixDe(S, x.p))}</span></button>`; };
  const apport = choisi ? apportsHtml(S, choisi.p) : '';
  return `<div class="rn-hud">${logo('YOU', 34)}<span class="rn-acte">Le repêchage<small>Tour ${rep.tour + 1} de 23</small></span><span class="rn-jt">${money(Math.max(0, R.plafond - RUN.ESPACE - masseDe(S)))}</span></div>
  <div class="rn-plaque" style="left:14px;top:60px">${rep.secours ? '' : logo(rep.club.t)}<div class="rn-nom">${rep.secours ? 'Les joueurs autonomes' : esc(clubMot(rep.club))}<small>Avants ${n.F} · défenseurs ${n.D} · gardiens ${n.G}<br>Ce tour : ${money(Math.max(0, budgetDuTour(S)))} au plus</small></div></div>
  <div class="rn-grille" style="left:22px;right:22px;top:130px">${vus.map(tuile).join('')}${reste > 0 || hors.length ? `<span>${reste > 0 ? `<button type="button" class="rn-plie" data-a="page-porte">${reste} autres<br>dans ton<br>budget</button>` : '<span class="rn-plie">Rien<br>d\'autre</span>'}</span>` : ''}</div>
  ${choisi ? `<div class="rn-panneau" style="left:14px;right:14px;top:556px"><div style="display:flex;justify-content:space-between;align-items:baseline"><b class="rn-h">${esc(choisi.p.n)}</b><span class="rn-h rn-or">${money(prixDe(S, choisi.p))}</span></div>
    <div class="rn-t rn-gris" style="margin-top:6px">Cette année-là : ${vraie(choisi.p)}.<br>${badgeMot(choisi.p)}${apport ? ` · <span class="rn-vert">ton banc : ${apport}</span>` : ''}</div></div>` : '<div class="rn-panneau" style="left:14px;right:14px;top:556px"><div class="rn-t rn-gris">Personne ici ne tient dans le budget de ce tour. Relance la roulette.</div></div>'}
  <div class="rn-enlignes" style="left:14px;right:14px;top:662px">${bancEnLignes(S)}</div>
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
export function sceneQuart(S) {
  const R = S.R, Q = R.quart, rival = clubNo(S, Q.rival), kRival = Number(Object.keys(Q.gros).find(k => Q.gros[k] === 'rival')), mRival = matchNo(S, kRival), jeu = jeuDe(S, rival), I = INTENTIONS[jeu.dominante];
  const kElite = Object.keys(Q.gros).find(k => Q.gros[k] === 'elite'), elite = kElite != null ? clubNo(S, matchNo(S, Number(kElite)).i) : null;
  return `${hud(S, { petit: `Matchs ${Q.debut + 1} à ${Q.fin}` })}
  <div style="left:14px;right:14px;top:62px"><div class="rn-k">Le proprio demande</div><div class="rn-titre" style="margin-top:6px">Quart ${ROMAINS[Q.n]}</div></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:132px">${objectifsHtml(S)}
    <div class="rn-t rn-gris" style="margin-top:8px">Deux manqués sur trois : il te retire un cœur.${R.coeurs === 1 ? ' <span class="rn-rg">C\'est ton dernier.</span>' : ''}</div></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:350px;display:grid;grid-template-columns:84px 1fr;gap:14px;align-items:center">${logo(rival.t, 84)}
    <div><div class="rn-k rn-rg">Le rival du quart</div><div class="rn-h" style="margin-top:5px">${esc(clubMot(rival))}</div>
      <div class="rn-t rn-gris" style="margin-top:6px">Match ${kRival + 1}, ${mRival.visiteur ? 'chez eux' : 'chez toi'} · ${esc(jeu.mot)}${I ? `<br>${I.ico} ${esc(I.nom)}` : ''}<br><span class="rn-or">Battu : une pièce de banc parmi trois</span></div></div></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:520px"><div class="rn-k" style="margin-bottom:6px">Tes gros matchs</div>
    <div class="rn-t"><b>${RUN.AFFICHES} affiches à poser</b> <span class="rn-gris">· à la feuille du soir de ton choix. Gagnée : trois portes, à la hauteur du club battu.</span>
    ${elite ? `<br><b>◆ L'élite : ${esc(clubCourt(elite))}</b> <span class="rn-gris">· match ${Number(kElite) + 1}. Tu y mets l'enjeu, ou non.</span>` : ''}</div></div>
  ${bas(bt('Au bureau', 'vers-bureau', { cls: 'go' }))}`;
}

/* ---------- le bureau : l'accueil, en cinq onglets ---------- */
/* Les cinq onglets du bureau, chacun son icône : celles de la barre du 82-0 (la maison, les lignes, le classement, le chandail), et la pièce pour la masse. */
const ONGLETS = [['bureau', 'Bureau', 'i-club'], ['alignement', 'Alignement', 'i-list'], ['masse', 'Masse', 'i-masse'], ['ligue', 'Ligue', 'i-chart'], ['club', 'Mon club', 'i-jersey']];
const onglets = (V, premier) => `<div class="rn-onglets">${ONGLETS.map(([k, mot, icone], i) => `<button type="button" class="${(V.onglet || 'bureau') === k ? 'rn-on' : ''}" data-a="onglet" data-v="${k}">${ico(icone)}<span>${i === 0 ? premier : mot}</span></button>`).join('')}</div>`;
const segment = (a, choix, liste) => `<div class="rn-seg" style="left:14px;right:14px;top:60px">${liste.map(([k, mot]) => `<button type="button" class="${choix === k ? 'rn-on' : ''}" data-a="${a}" data-v="${k}">${mot}</button>`).join('')}</div>`;
/* Le jeu d'un club, en un mot : lu une fois par séance (son style ne dépend pas de ton club). */
function styleDe(S, c) { if (!S.jeux) S.jeux = new Map(); const k = `${c.s}:${c.t}`; if (!S.jeux.has(k)) S.jeux.set(k, jeuDe(S, c)); return S.jeux.get(k); }
const nomDuClubNo = (S, i) => (i === 0 ? 'Ton club' : esc(clubCourt(clubNo(S, i))));
const logoNo = (S, i, n = 18) => logo(i === 0 ? 'YOU' : clubNo(S, i).t, n);
const cadre = (html, haut = 112, bas0 = 66) => `<div class="rn-cadre" style="left:8px;right:8px;top:${haut}px;bottom:${bas0}px">${html}</div>`;
/*
 * LE BUREAU (JP, 16 nov. 2026 : *un EHM, mais avec un côté rogue*). L'accueil du Rogue pendant la saison, et pendant les
 * séries (son premier onglet devient le tableau des séries). Le HUD en haut, les onglets en bas, au même endroit partout.
 */
export function sceneBureau(S, V) {
  const page = { bureau: S.R.series ? pageSeries : pageBureau, alignement: pageAlignement, masse: pageMasse, ligue: pageLigue, club: pageMonClub }[V.onglet || 'bureau'] || pageBureau;
  return `${hud(S)}${page(S, V)}${onglets(V, S.R.series ? 'Séries' : 'Bureau')}`;
}
const MARQUE = { rival: '<span class="rn-puce rn-r">Le rival</span>', elite: '<span class="rn-puce rn-o">◆ L\'élite</span>', affiche: '<span class="rn-puce rn-o">Affiche</span>' };
/* Le dernier match, en une ligne : « Gagné 4-2 à Boston ». */
const hierDit = m => `${m.gagne ? 'Gagné' : m.ot ? 'Perdu en prolongation' : 'Perdu'} ${m.gf}-${m.ga} ${m.visiteur ? `à ${esc(ville(m.t))}` : `contre ${esc(surnom(m.t))}`}`;
/*
 * L'ONGLET BUREAU. De haut en bas, dans l'ordre où un DG se pose les questions : qui vient ce soir (le plus gros bloc, c'est
 * pour ça qu'on ouvre le jeu) ; ce que le proprio attend (ce qui peut finir la run) ; le fil (ce qui a changé depuis hier,
 * jamais une boîte à vider : seules l'histoire et les pochettes se touchent, et rien n'attend) ; ton banc (ce que tu
 * bâtis) ; puis « Jouer ce soir », sous le pouce.
 */
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
  const regle = REGLES_DU_COACH[R.coach.cle];
  return `<div class="rn-pile" style="left:14px;right:14px;top:60px"><div class="rn-panneau"><div class="rn-k">Ce soir · match ${soir.k + 1}</div>
    <div class="rn-plaque" style="margin-top:8px">${logo(c.t, 54)}<div class="rn-nom">${esc(clubMot(c))}<small>${rangDe(S, soir.i)}e · ${ficheMot(F)} · ${esc(styleDe(S, c).mot)}</small></div></div>
    <div class="rn-puces" style="margin-top:8px">${puces}</div></div>
  <div class="rn-panneau"><div class="rn-k" style="margin-bottom:2px">Le proprio · quart ${ROMAINS[Q.n]}</div>${objectifsHtml(S)}</div>
  <div class="rn-panneau rn-fil2">${fil}</div>
  <button type="button" class="rn-versbanc" data-a="vers-banc" aria-label="Ton banc">${banc(S, { largeur: '250px' })}<span class="rn-t">${regle ? `${COACHS[R.coach.cle].ico} ${esc(maj(regle.dit))}<br><span class="rn-or">+${regle.jetons} jetons</span> <span class="rn-gris">· ${Q.prime} / ${RUN.PRIME_DU_QUART} ce quart</span>` : esc(COACHS[R.coach.cle].nom)}</span></button></div>
  <div class="rn-bas" style="bottom:72px">${bt('Jouer ce soir', 'aller', { cls: soir.sorte === 'rival' ? 'rn-combat' : 'go' })}</div>`;
}
/*
 * L'ONGLET ALIGNEMENT. « Lignes » : tes vingt-trois en tableau, dans l'ordre de la glace (les trios, les paires, le filet,
 * les réservistes), l'accord de chaque ligne à sa tête ; toucher un joueur le tient, toucher un autre les échange, et
 * chaque ligne dit alors ce que l'échange y allumerait. « Banc » : ton coach, sa règle, tes pièces et leur compte.
 */
function pageAlignement(S, V) {
  const R = S.R, seg = V.segA || 'lignes';
  if (seg === 'banc') {
    const C = COACHS[R.coach.cle], regle = REGLES_DU_COACH[R.coach.cle];
    return `${segment('seg-a', seg, [['lignes', 'Lignes'], ['banc', 'Banc']])}
    <div class="rn-pile" style="left:14px;right:14px;top:114px"><div class="rn-panneau"><b class="rn-h">${C.ico} ${esc(R.coach.n || C.nom)}</b>
      <div class="rn-t rn-gris" style="margin-top:6px">${esc(C.nom)}${regle ? ` · ${esc(regle.dit)} : <span class="rn-or">+${regle.jetons} jetons</span> le soir` : ''}</div></div>
    ${R.banc.map(k => `<div class="rn-panneau" style="display:grid;grid-template-columns:62px 1fr;gap:12px;align-items:center;padding:8px 10px">${carteP(k)}<div class="rn-t"><b>${esc(PIECES[k].nom)}</b><br><span class="rn-gris">${ligneDe(S, k)}</span></div></div>`).join('')}
      ${R.banc.length < CASES_DU_BANC ? `<div class="rn-t rn-gris" style="text-align:center;padding:6px">${pluriel(CASES_DU_BANC - R.banc.length, 'case')} libre${CASES_DU_BANC - R.banc.length > 1 ? 's' : ''} : un rival battu, une élite, le marché du quart.</div>` : ''}</div>`;
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
  const corps = [0, 1, 2, 3].map(u => unite(`${ord(u + 1)} trio`, de('F', u), u)).join('') + [0, 1, 2].map(u => unite(`${u + 1}${u ? 'e' : 're'} paire`, de('D', u), u)).join('')
    + unite('Le filet', [...de('G', 0), ...de('G', 1)], null) + unite('En civil', SLOTS.filter(s => s.scratch && (!s.extra || S.roster[s.i])), null);
  return `${segment('seg-a', seg, [['lignes', 'Lignes'], ['banc', 'Banc']])}
  ${cadre(tableau('34px 1fr 46px 34px 26px 30px', tenu != null ? ['', `Tu tiens ${esc(court(S.roster[tenu]))}`, '', 'Où ?', '', ''] : ['Pos', 'Joueur', 'Badges', 'J', 'PJ', 'Pts'], [corps], 'rn-alig'))}`;
}
/*
 * L'ONGLET MASSE. Le plafond d'abord (la seule jauge de l'onglet : ta masse, ce que les joueurs sortis y laissent, ton
 * espace), puis les vingt-trois salaires, le plus gros en tête : c'est lui qu'on regarde quand une carte ne tient pas.
 */
function pageMasse(S) {
  const R = S.R, js = effectifDe(S).sort((a, b) => prixDe(S, b) - prixDe(S, a)), cas = p => SLOTS.find(s => S.roster[s.i] === p);
  const ou = s => (s.scratch ? 'Rés' : s.group === 'G' ? 'G' : s.role);
  return `<div class="rn-panneau" style="left:14px;right:14px;top:60px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><span class="rn-k">Ton plafond</span><span class="rn-t">${money(masseDe(S))} <span class="rn-gris">/ ${money(R.plafond)}</span></span></div>
    ${plafond(S, { mort: R.mort || 0 })}
    <div class="rn-t" style="margin-top:8px"><span class="rn-or">Espace ${money(espaceDe(S))}</span>${R.mort ? ` <span class="rn-gris">·</span> <span class="rn-rg">${money(R.mort)} des joueurs sortis</span>` : ''}</div></div>
  ${cadre(tableau('34px 1fr 76px 70px', ['Pos', 'Joueur', 'Carte', 'Salaire'], js.map(p => ligne([ou(cas(p)), `${visage(p)}${esc(court(p))}`, esc(NOM_VARIANTE[editionDe(p)]), money(prixDe(S, p))]))), 172)}`;
}
/*
 * L'ONGLET LIGUE. « Classement » : les trente-deux, la ligne des séries tracée sous le seizième, ton club allumé.
 * « Meneurs » : les dix premiers pointeurs de la ligue. « Cédule » : tes prochains matchs, le rival et l'élite marqués,
 * tes dos-à-dos ; puis les derniers joués.
 */
function pageLigue(S, V) {
  const R = S.R, L = R.ligue, seg = V.segL || 'classement', tete = segment('seg-l', seg, [['classement', 'Classement'], ['meneurs', 'Meneurs'], ['cedule', 'Cédule']]);
  if (seg === 'meneurs') {
    const nomDe = x => { const p = (x.i === 0 ? effectifDe(S) : clubNo(S, x.i).pool).find(q => getPlayerKey(q) === x.k); return p ? `${visage(p)}${esc(court(p))}` : '…'; };
    const l = meneursDe(S, 20);
    return `${tete}${cadre(l.length ? tableau('24px 1fr 104px 24px 24px 30px', ['', 'Joueur', 'Club', 'B', 'A', 'Pts'], l.map((x, r) => ligne([r + 1, nomDe(x), nomDuClubNo(S, x.i), x.g, x.a, `<b>${x.g + x.a}</b>`], { cls: x.i === 0 ? 'rn-moi' : '' }))) : '<div class="rn-t rn-gris" style="padding:14px">Personne n\'a encore marqué : la saison commence ce soir.</div>')}`;
  }
  if (seg === 'cedule') {
    const n = R.matchs.length, Q = R.quart;
    const aVenir = R.series ? [] : Array.from({ length: Math.min(12, RUN.LIGUE.MATCHS - n) }, (_, j) => matchNo(S, n + j));
    const venir = aVenir.map(m => ligne([m.k + 1, `${logoNo(S, m.i)} ${nomDuClubNo(S, m.i)}`, m.visiteur ? 'Chez eux' : 'Chez toi', `${MARQUE[Q.gros[m.k]] || ''}${m.dos ? '<span class="rn-puce rn-r">Dos-à-dos</span>' : ''}`]));
    const joues = R.matchs.slice(-8).reverse().map((m, j) => ligne([n - j, `${logo(m.t, 18)} ${esc(clubCourt(m))}`, m.visiteur ? 'Chez eux' : 'Chez toi', `<b class="${m.gagne ? 'rn-vert' : 'rn-rg'}">${m.gf}-${m.ga}${m.ot ? ' P' : ''}</b>`]));
    return `${tete}${cadre(tableau('26px 1fr 62px 96px', ['', 'Adversaire', 'Lieu', ''], [...(venir.length ? ['<div class="rn-l rn-unite"><span>À venir</span><span></span><span></span></div>', ...venir] : []), ...(joues.length ? ['<div class="rn-l rn-unite"><span>Déjà joués</span><span></span><span></span></div>', ...joues] : [])]))}`;
  }
  const rangs = classement(S).map((i, r) => { const f = L.fiches[i], d = f[3] - f[4]; return ligne([r + 1, `${logoNo(S, i)} ${nomDuClubNo(S, i)}`, f[0] + f[1] + f[2], ficheMot(f), `${d > 0 ? '+' : ''}${d}`, `<b>${2 * f[0] + f[2]}</b>`], { cls: i === 0 ? 'rn-moi' : '' }) + (r === RUN.LIGUE.PLACES - 1 ? '<div class="rn-l rn-coupe"><span>La ligne des séries</span></div>' : ''); });
  return `${tete}${cadre(tableau('24px 1fr 26px 62px 34px 32px', ['', 'Club', 'MJ', 'V-D-DP', 'Diff', 'Pts'], rangs))}`;
}
/*
 * L'ONGLET MON CLUB : ce que chacun a fait chez toi. « Patineurs », triés par la colonne qu'on touche ; « Gardiens », leurs
 * départs, leur fiche, leur % d'arrêts ; « Matchs », ta séquence et tes douze derniers.
 */
const TRIS = { pj: 0, b: 1, a: 2, pts: null, t: 3 };
function pageMonClub(S, V) {
  const R = S.R, seg = V.segC || 'patineurs', tete = segment('seg-c', seg, [['patineurs', 'Patineurs'], ['gardiens', 'Gardiens'], ['matchs', 'Matchs']]);
  const st = p => R.stats[getPlayerKey(p)] || [0, 0, 0, 0, 0, 0];
  if (seg === 'gardiens') {
    const gs = effectifDe(S).filter(p => p.p === 'G');
    return `${tete}${cadre(tableau('1fr 26px 62px 30px 46px 34px', ['Gardien', 'D', 'V-D-DP', 'BC', '% arr.', 'J'], gs.map(p => { const x = st(p); return ligne([`${visage(p)}${esc(court(p))}`, x[0], `${x[1]}-${x[2]}-${x[3]}`, x[4], x[5] ? pct3(1 - x[4] / x[5]) : '—', jambesDe(p)]); })))}`;
  }
  if (seg === 'matchs') {
    let suite = 0;
    for (let i = R.matchs.length - 1; i >= 0 && R.matchs[i].gagne === R.matchs.at(-1).gagne; i--) suite++;
    const f = R.ligue.fiches[0], dix = R.matchs.slice(-10);
    const lignes = R.matchs.slice(-12).reverse().map((m, j) => ligne([R.matchs.length - j, `${logo(m.t, 18)} ${esc(clubCourt(m))}`, MARQUE[m.sorte] || (m.sorte === 'serie' ? '<span class="rn-puce">Séries</span>' : ''), `<b class="${m.gagne ? 'rn-vert' : 'rn-rg'}">${m.gf}-${m.ga}${m.ot ? ' P' : ''}</b>`]));
    return `${tete}<div class="rn-cellules" style="left:14px;right:14px;top:114px"><div><b>${ficheMot(f)}</b><small>Ta fiche</small></div><div><b>${dix.filter(m => m.gagne).length}-${dix.filter(m => !m.gagne).length}</b><small>Tes dix derniers</small></div><div><b class="${R.matchs.length && R.matchs.at(-1).gagne ? 'rn-vert' : 'rn-rg'}">${suite}</b><small>${R.matchs.length && R.matchs.at(-1).gagne ? 'Victoires' : 'Défaites'} de suite</small></div></div>
    ${cadre(lignes.length ? tableau('26px 1fr 84px 54px', ['', 'Adversaire', '', 'Pointage'], lignes) : '<div class="rn-t rn-gris" style="padding:14px">Aucun match joué encore.</div>', 196)}`;
  }
  const tri = V.tri in TRIS ? V.tri : 'pts', val = p => { const x = st(p); return tri === 'pts' ? x[1] + x[2] : x[TRIS[tri]]; };
  const ps = effectifDe(S).filter(p => p.p !== 'G').sort((a, b) => val(b) - val(a) || st(b)[1] - st(a)[1] || getHiddenRatings(b).v - getHiddenRatings(a).v);
  const col = (k, mot) => `<button type="button" class="${tri === k ? 'rn-on' : ''}" data-a="tri" data-v="${k}">${mot}</button>`;
  return `${tete}${cadre(tableau('1fr 34px 34px 34px 38px 38px', ['Joueur', col('pj', 'PJ'), col('b', 'B'), col('a', 'A'), col('pts', 'Pts'), col('t', 'T')], ps.map(p => { const x = st(p); return ligne([`${visage(p)}${esc(court(p))} ${badgesHtml(p)}`, x[0], x[1], x[2], `<b>${x[1] + x[2]}</b>`, x[3]]); }), 'rn-tri'))}`;
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
function enjeuHtml(S, y) {
  const c = S.R.soir;
  if (c.sorte === 'serie') return '';
  const J = c.J != null ? `${c.J} jetons` : 'des jetons', sorte = c.sorte === 'elite' && !c.enjeu ? 'match' : c.sorte;
  const gagne = { match: `2 points · ${c.jetons} jetons`, affiche: `2 points · ${c.jetons} jetons<br>Trois portes`, rival: `2 points · ${c.jetons} jetons<br>Une pièce, puis trois portes`, elite: `2 points · ${J}<br>Une pièce, puis trois portes` }[sorte];
  const perdu = { match: '1 point en prolongation', affiche: '1 point en prolongation<br>Une relance gratuite', rival: 'Son objectif est manqué<br>Une relance gratuite', elite: `Sonnés 5 matchs<br>${c.J != null ? `${Math.round(c.J / 2)} jetons de moins` : 'des jetons de moins'}` }[sorte];
  return `<div class="rn-enjeu" style="left:14px;right:14px;top:${y}px"><div><b class="rn-vert">Gagné</b>${gagne}</div><div><b class="rn-rg">Perdu</b>${perdu}</div></div>`;
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
function gestesDuSoir(S, y) {
  const R = S.R, c = R.soir, filet = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => S.roster[s.i]).filter(Boolean), aux = S.toi._filetMatch === 'aux';
  const gardien = (g, i) => { const j = jambesDe(g), bl = S.toi.injured.has(g); return `<button type="button" class="${(i === 1) === aux ? 'rn-on' : ''}" data-a="filet" data-v="${i === 1 ? 'aux' : 'partant'}"${bl ? ' disabled' : ''}><b>${esc(court(g))}</b><span class="${j < 85 ? 'rn-rg' : ''}">${bl ? 'blessé' : `jambes ${j}`}</span></button>`; };
  const affiche = c.sorte === 'affiche', reste = R.quart.affiches - (affiche ? 1 : 0);
  const droite = c.sorte === 'match' || affiche ? `<div class="rn-k" style="margin-bottom:8px">Tes affiches · ${reste} à poser</div><div class="rn-filet"><button type="button" class="${affiche ? 'rn-on' : ''}" data-a="affiche" data-v="${affiche ? '' : '1'}"${!affiche && R.quart.affiches <= 0 ? ' disabled' : ''}>${affiche ? 'Affiche posée<br>Toucher : la retirer' : 'En faire une affiche<br>Un duel, trois portes'}</button></div>`
    : c.sorte === 'elite' ? `<div class="rn-k" style="margin-bottom:8px">◆ L'élite</div><div class="rn-filet"><button type="button" class="${c.enjeu ? 'rn-on' : ''}" data-a="enjeu" data-v="${c.enjeu ? '' : '1'}">${c.enjeu ? 'L\'enjeu est mis<br>Toucher : le retirer' : 'Mettre l\'enjeu<br>Une pièce, ou des sonnés'}</button></div>`
      : `<div class="rn-k" style="margin-bottom:8px">${c.sorte === 'rival' ? 'Le rival du quart' : 'Les séries'}</div><div class="rn-t rn-gris">${c.sorte === 'rival' ? 'Un des trois objectifs du proprio.' : 'Quatre victoires pour passer.'}</div>`;
  return `<div style="left:14px;right:14px;top:${y}px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="rn-panneau"><div class="rn-k" style="margin-bottom:8px">Devant le filet</div><div class="rn-filet">${filet.map(gardien).join('')}</div></div>
    <div class="rn-panneau">${droite}</div></div>`;
}
export function sceneFeuille(S, V) {
  const R = S.R, c = R.soir, club = S.clubs.find(x => x.s === c.s && x.t === c.t), duel = estDuel(c), serie = c.sorte === 'serie';
  const jeu = styleDe(S, c), eux = lignesDuClub(club.team), moi = lignesDuClub(S.toi), vedette = vedettesDe(club)[0], leur = leurBanc(S);
  const lieu = `${c.visiteur ? 'chez eux' : 'chez toi'}${c.dos && !serie ? ' · ton dos-à-dos' : ''}${c.leurDos && !serie ? ' · ils ont joué hier' : ''}`;
  const sous = serie ? `Match ${R.series.moi.w + R.series.moi.l + 1} · ${lieu}${leur ? ` · leur coach : ${COACHS[leur.cle].nom}` : ''}` : `${rangDe(S, c.i)}e · ${ficheMot(R.ligue.fiches[c.i])} · ${lieu}`;
  const petit = serie ? RONDES[R.series.ronde] : { rival: 'Le rival', elite: 'L\'élite', affiche: 'Une affiche' }[c.sorte] || null;
  const tete = `${hud(S, { petit })}
    <div class="rn-plaque" style="left:14px;top:60px">${logo(c.t)}<div class="rn-nom">${esc(clubMot(c))}<small>${esc(maj(sous))}</small></div></div>
    <div style="left:14px;right:14px;top:116px">${jaugeHtml(V, 'YOU', c.t)}</div>`;
  const pied = bas(bt(serie ? 'Le tableau' : 'Bureau', 'retour-bureau'), bt(duel ? 'Au combat' : 'Au match', 'jouer', { cls: duel ? 'rn-combat' : 'go' }));
  if (!duel) {
    const blesses = S.toi.injured.size;
    const trio = (ps, u) => { const acc = accordsDe(S, u), j = jambes(ps); return `<div class="rn-trio"><b>${u + 1}</b><span>${noms(ps)}</span><em>${acc.length ? `${icosDeLAccord(acc[0])}${acc.length > 1 ? ` +${acc.length - 1}` : ''}` : 'Aucun'}</em><div class="rn-jb${j < 70 ? ' rn-use' : ''}"><i style="width:${j}%"></i></div></div>`; };
    return `${tete}
    <div class="rn-panneau rn-leurs" style="left:14px;right:14px;top:146px">${carteJ(vedette)}<div class="rn-lignes"><div><b>Jeu</b><span class="rn-or">${esc(maj(jeu.mot))}</span></div>
      ${eux.trios.slice(0, 3).map((ps, u) => `<div${ps.includes(vedette) ? ' class="rn-etoile"' : ''}><b>${ord(u + 1)}</b><span>${noms(ps)}</span></div>`).join('')}
      ${eux.paires.slice(0, 1).map(ps => `<div${ps.includes(vedette) ? ' class="rn-etoile"' : ''}><b>D</b><span>${noms(ps)}</span></div>`).join('')}
      ${eux.gardien ? `<div><b>G</b><span>${esc(court(eux.gardien))} · ${pct3(eux.gardien.sv || 0)}</span></div>` : ''}</div></div>
    <div class="rn-panneau" style="left:14px;right:14px;top:310px"><div class="rn-k" style="margin-bottom:2px">Tes lignes · leurs accords · leurs jambes${blesses ? ` · <span class="rn-rg">${pluriel(blesses, 'blessé')}</span>` : ''}</div>
      ${moi.trios.map(trio).join('')}
      <div class="rn-trio"><b>D</b><span>${noms(moi.paires.flat().slice(0, 2))} · ${Math.max(0, moi.paires.flat().length - 2)} autres</span><em></em><div class="rn-jb"><i style="width:${jambes(moi.paires.flat())}%"></i></div></div></div>
    ${gestesDuSoir(S, 548)}
    ${enjeuHtml(S, 664)}
    ${pied}`;
  }
  // Le duel (une affiche, le rival, l'élite avec son enjeu, les séries) : leur jeu ce soir et ce qu'il te coûte, puis ton banc,
  // pièce par pièce. Aucun plan à choisir (V29) : ta réponse est le banc que tu as bâti.
  const I = V.intention && INTENTIONS[V.intention.cle], vise = V.intention && V.intention.cible ? court(V.intention.cible) : 'ta vedette';
  const leurJeu = I ? { ombre: `L'ombre suit ${vise}`, chasse: `La chasse vise ${vise}`, centre: 'Ils ferment le centre', assaut: 'Ils lancent de partout', cachot: 'Ils cherchent tes punitions' }[V.intention.cle] : '';
  const cout = motsDeStats(V.leurJeu, 3).map(m => `<span class="${m.bon ? 'rn-vert' : 'rn-rg'}">${esc(m.txt)}</span>`).join(' · ');
  return `${tete}
  <div class="rn-panneau" style="left:14px;right:14px;top:146px;padding:8px 12px"><div class="rn-k">Leur jeu ce soir · ${esc(jeu.mot)}${eux.gardien ? ` · ${esc(court(eux.gardien))} ${pct3(eux.gardien.sv || 0)}` : ''}</div>
    <div class="rn-t" style="margin-top:6px">${I ? `<span class="rn-rg">${I.ico} ${esc(leurJeu)}</span><br>${cout || '<span class="rn-gris">Rien qui se voie à la feuille</span>'}` : '<span class="rn-gris">Ils ne montrent rien avant le match.</span>'}</div></div>
  <div style="left:14px;right:14px;top:232px"><div class="rn-k" style="margin-bottom:4px">Ton banc ce soir</div>
    <div class="rn-pieces">${R.banc.map(k => `<div>${carteP(k)}<div class="rn-t"><b>${esc(PIECES[k].nom)}</b> <span class="rn-gris">· ${ligneCourte(S, k).replace('<br>', '</span><br><span class="rn-gris">')}</span></div></div>`).join('')}</div></div>
  ${leur ? `<div style="left:14px;right:14px;top:472px"><div class="rn-k" style="margin-bottom:6px">Leur banc · il compte leurs joueurs</div>${leur.banc.length ? `<div class="rn-banc" style="width:230px">${leur.banc.map(x => `<span class="${x.marche ? 'rn-joue' : 'rn-eteinte'}">${carteP(x.cle)}</span>`).join('')}</div>` : '<div class="rn-t rn-gris">Aucune pièce à cette ronde.</div>'}</div>` : ''}
  ${gestesDuSoir(S, serie ? 572 : 548)}
  ${enjeuHtml(S, 664)}
  ${pied}`;
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
export function sceneResultat(S, V) {
  const R = S.R, a = R.apres, serie = a.sorte === 'serie', X = R.series, M = dernierMatch(S), F = R.ligue.fiches[0];
  const autres = (a.autres || []).slice(0, 10).map(m => `<div><span>${logoNo(S, m.a, 16)} ${nomDuClubNo(S, m.a)}</span><b>${m.gfA}-${m.gfB}${m.ot ? ' P' : ''}</b><span>${nomDuClubNo(S, m.b)} ${logoNo(S, m.b, 16)}</span></div>`).join('');
  const rang = a.rang ? `<div class="rn-cellules"><div><b>${rangTxt(a.rang[0])}</b><small>Hier</small></div><div><b class="${a.rang[1] < a.rang[0] ? 'rn-vert' : a.rang[1] > a.rang[0] ? 'rn-rg' : ''}">${rangTxt(a.rang[1])}</b><small>Ce soir</small></div><div><b>${ficheMot(F)}</b><small>Ta fiche</small></div></div>` : '';
  const laSerie = serie ? `<div class="rn-t"><b>La série : ${X.moi.w}-${X.moi.l}</b> <span class="rn-gris">· ${R.fin ? (R.fin.coupe ? 'la Coupe est à toi.' : 'la saison s\'arrête ici.') : 'quatre victoires pour passer.'}</span></div>` : '';
  const pieces = a.pieces.length ? `<div class="rn-k">Ton banc ce soir</div>${banc(S, { joue: a.pieces })}<div class="rn-t">${a.pieces.map(k => `<span class="rn-vert">${esc(PIECES[k].nom)}</span> <span class="rn-gris">· ${ligneCourte(S, k).replace('<br>', ' · ')}</span>`).join('<br>')}</div>` : '';
  const soir = `<div class="rn-soir"><div class="rn-t">${gainsDuMatch(a) || 'Aucun point'}</div>${rang}${laSerie}${pieces}</div>`;
  const P = M ? sommaireHtml({ f: M.f, A: M.A, B: M.B, avant: M.avant, pied: serie ? 'séries' : 'saison régulière', fiche: serie ? null : { v: F[0], d: F[1], pr: F[2] }, lien: (p, t, html) => html }).parts : null;
  const vue = P && VUES_DU_RESULTAT.some(([k]) => k === V.segR) ? V.segR : 'sommaire';
  // Sous « Sommaire », les périodes ne montrent que leurs buts ; ailleurs, tout se lit (`som-plus`, js/bilan.js).
  const som = (html, tout = true) => `<div class="som-racine${tout ? ' som-plus' : ''}">${html}</div>`;
  const verdict = `<div class="rn-k ${a.gagne ? 'rn-vert' : 'rn-rg'}">${a.gagne ? 'Gagné' : a.ot ? 'Perdu en prolongation' : 'Perdu'} ${a.visiteur ? `à ${esc(ville(a.t))}` : `contre ${esc(surnom(a.t))}`}</div>`;
  const ailleurs = autres ? `<div class="rn-k">Ailleurs dans la ligue</div><div class="rn-ailleurs">${autres}</div>` : '';
  // Une run gardée avant le 25 nov. 2026 n'a pas la feuille de son dernier match : le pointage et le soir, sans le sommaire.
  const corps = !P ? `${verdict}<div class="rn-titre">${a.gf} · ${a.ga}</div>${soir}${ailleurs}`
    : vue === 'recit' ? som(P.saillants + P.periodes)
      : vue === 'chiffres' ? som(P.tableau + P.glace + P.gardiens)
        : vue === 'feuille' ? som(P.feuille)
          : `${verdict}${som(P.lignes + soir + P.etoiles + P.periodes, false)}${ailleurs}`;
  const suite = R.fin ? 'Voir la fin' : R.suite[0] === 'piece' ? 'Ta pièce' : R.suite[0] === 'portes' ? 'Tes trois portes' : R.suite[0] === 'bilan' ? 'Le bilan du proprio' : serie ? 'Le tableau' : 'Au bureau';
  return `${hud(S, { petit: serie ? RONDES[Math.min(RONDES.length - 1, X.ronde)] : null })}
  ${P ? segment('seg-r', vue, VUES_DU_RESULTAT) : ''}
  ${cadre(`<div class="rn-somm">${corps}</div>`, P ? 112 : 60, 76)}
  ${bas(bt(suite, 'continuer', { cls: 'go' }))}`;
}

/* ---------- les portes, la porte ouverte, l'échange ---------- */
const bandeDuMatch = S => {
  const a = S.R.apres;
  if (!a || a.gf == null) return '<div class="rn-panneau" style="left:14px;right:14px;top:60px"><div class="rn-t"><b>Ta pochette</b><br><span class="rn-gris">Un joueur à signer, ou rien.</span></div></div>';
  return `<div class="rn-panneau" style="left:14px;right:14px;top:60px;display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center"><div class="rn-titre rn-vert">${a.gf}-${a.ga}</div>
    <div class="rn-t"><b>${{ rival: 'Le rival est battu', elite: 'L\'élite est battue', affiche: 'L\'affiche est gagnée' }[a.sorte] || 'Gagné'}</b><br><span class="rn-gris">${a.sorte === 'rival' ? 'Des vestiaires du haut de l\'échelle.' : `Des vestiaires à la hauteur de ${esc(surnom(a.t))}.`}</span></div></div>`;
};
export function scenePortes(S) {
  const R = S.R, P = R.portes, relance = prixDeLaRelance(S);
  const portes = P.clubs.map((c, i) => { const n = vestiaireDe(S, c).filter(x => x.tient).length; return `<button type="button" class="rn-porte" data-a="ouvrir-porte" data-v="${i}">${P.affronte === `${c.s}:${c.t}` ? '<span class="rn-tag">Le club battu</span>' : ''}${logo(c.t, 66)}<b>${esc(surnom(c.t))}<small>${c.s}</small></b><strong>${n}<small>dans ton espace</small></strong></button>`; }).join('');
  return `${hud(S)}
  ${bandeDuMatch(S)}
  <div style="left:14px;right:14px;top:166px;text-align:center"><div class="rn-k">Trois vrais vestiaires</div><div class="rn-h" style="margin-top:6px">Un joueur, dans un de ces vestiaires</div></div>
  <div class="rn-portes" style="left:14px;right:14px;top:254px">${portes}</div>
  <div class="rn-panneau" style="left:14px;right:14px;top:596px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><span class="rn-k">Ton plafond</span><span class="rn-t">${money(masseDe(S))} <span class="rn-gris">/ ${money(R.plafond)}</span> · <span class="rn-or">Espace ${money(espaceDe(S))}</span></span></div>${plafond(S, { mort: R.mort || 0 })}</div>
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
export function scenePorte(S, V) {
  const R = S.R, P = R.portes, c = P.pochette ? null : P.clubs[V.porte];
  const tous = vestiaireDe(S, c), dedans = tous.filter(x => x.tient), hors = tous.filter(x => !x.tient);
  const pages = Math.max(1, Math.ceil(dedans.length / PAR_PAGE)), page = Math.min(V.page || 0, pages - 1), vus = dedans.slice(page * PAR_PAGE, (page + 1) * PAR_PAGE);
  const choisi = dedans.find(x => getPlayerKey(x.p) === V.joueur) || vus[0] || null, acc = choisi ? accordQuIlAllume(S, choisi.p) : null, apport = choisi ? apportsHtml(S, choisi.p) : '';
  const tuile = x => { const a = apportsHtml(S, x.p); return `<button type="button" class="${choisi === x ? 'rn-on' : ''}" data-a="voir-joueur" data-v="${getPlayerKey(x.p)}">${carteJ(x.p)}${a ? `<span class="rn-coin">${a}</span>` : ''}<span class="rn-sousc">${money(prixDe(S, x.p))}</span></button>`; };
  const reste = dedans.length - vus.length;
  return `${hud(S)}
  <div class="rn-plaque" style="left:14px;top:60px">${c ? logo(c.t) : ''}<div class="rn-nom">${c ? esc(clubMot(c)) : 'Ta pochette'}<small>${dedans.length} tien${dedans.length > 1 ? 'nent' : 't'} dans ton espace · ${money(espaceDe(S))}</small></div></div>
  <div class="rn-grille" style="left:22px;right:22px;top:122px">${vus.map(tuile).join('')}${reste > 0 || hors.length ? `<span>${reste > 0 ? `<button type="button" class="rn-plie" data-a="page-porte">${reste} autres<br>dans ton<br>espace</button>` : '<span class="rn-plie">Rien<br>d\'autre</span>'}${hors[0] ? `<span class="rn-sousc rn-gris"><small class="rn-gris">${esc(court(hors[0].p))}, ${money(prixDe(S, hors[0].p))} : hors de ton espace</small></span>` : ''}</span>` : ''}</div>
  ${choisi ? `<div class="rn-panneau" style="left:14px;right:14px;top:584px"><div style="display:flex;justify-content:space-between;align-items:baseline"><b class="rn-h">${esc(choisi.p.n)}</b><span class="rn-h rn-or">${money(prixDe(S, choisi.p))}</span></div>
    <div class="rn-t rn-gris" style="margin-top:6px">Cette année-là : ${vraie(choisi.p)}.<br>${badgeMot(choisi.p)}${apport ? ` · <span class="rn-vert">ton banc : ${apport}</span>` : ''}${acc ? ` · il allume <span class="rn-vert">${esc(acc.aff.nom.charAt(0).toLowerCase() + acc.aff.nom.slice(1))}</span>` : ''}</div></div>` : '<div class="rn-panneau" style="left:14px;right:14px;top:584px"><div class="rn-t rn-gris">Personne ici ne tient dans ton espace.</div></div>'}
  ${bas(bt(P.pochette ? 'Ne rien signer' : 'Retour', 'fermer-porte'), bt('Voir l\'échange', 'vers-echange', { cls: 'go', v: choisi ? getPlayerKey(choisi.p) : '', off: !choisi }))}`;
}
const statsDuJoueur = p => (p.p === 'G' ? [['Victoires', p.w || 0, x => x], ['% d\'arrêts', p.sv || 0, pct3], ['Matchs', p.gp || 0, x => x]]
  : [['Points / match', (p.pt ?? (p.g || 0) + (p.a || 0)) / Math.max(1, p.gp), x => x.toFixed(2).replace('.', ',')], ['Tirs / match', (p.sh || 0) / Math.max(1, p.gp), x => x.toFixed(1).replace('.', ',')], ['% au tir', p.sh ? (100 * (p.g || 0)) / p.sh : 0, x => `${x.toFixed(1).replace('.', ',')} %`]]);
export function sceneEchange(S, V) {
  // La sortie proposée d'avance (V29) : le plus faible que ton banc ne compte pas ; ceux qu'il compte ne sortent que si tu les touches.
  const R = S.R, p = V.arrivant, compte = x => (R.banc.some(k => apportDe(k, x) > 0) ? 1 : 0);
  const sortants = sortantsPour(S, p).sort((a, b) => compte(a) - compte(b) || getHiddenRatings(a).v - getHiddenRatings(b).v);
  const sortant = sortants.find(x => getPlayerKey(x) === V.sortant) || sortants.find(x => masseApres(S, p, x) <= R.plafond) || sortants[0];
  const apres = masseApres(S, p, sortant), ok = apres <= R.plafond, reste = (1 - RUN.RACHAT) * prixDe(S, sortant);
  const A = statsDuJoueur(p), B = statsDuJoueur(sortant);
  const cas = SLOTS.find(s => S.roster[s.i] === sortant), ou = cas.scratch ? 'en civil' : cas.group === 'G' ? cas.role.toLowerCase() : `${ord(cas.unit + 1)} ${cas.group === 'F' ? 'trio' : 'paire'}`;
  return `${hud(S, { titre: 'Signer', petit: esc(ou), rang: false })}
  <div class="rn-face" style="left:14px;right:14px;top:62px"><span><b class="rn-vert">Il arrive</b>${carteJ(p)}</span><i>›‹</i><span><b class="rn-rg">Il sort</b>${carteJ(sortant)}</span></div>
  <div class="rn-panneau rn-cmp" style="left:14px;right:14px;top:276px">${A.map(([nom, a, dire], i) => `<span${a > B[i][1] ? ' class="rn-mieux"' : ''}>${dire(a)}</span><em>${nom}</em><span${B[i][1] > a ? ' class="rn-mieux"' : ''}>${dire(B[i][1])}</span>`).join('')}
    <span${prixDe(S, p) < prixDe(S, sortant) ? ' class="rn-mieux"' : ''}>${money(prixDe(S, p))}</span><em>Salaire</em><span${prixDe(S, sortant) < prixDe(S, p) ? ' class="rn-mieux"' : ''}>${money(prixDe(S, sortant))}</span></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:408px"><div class="rn-k" style="margin-bottom:8px">Qui sort · touche un joueur</div>
    <div class="rn-sortants">${sortants.slice(0, 14).map(x => `<button type="button" class="${x === sortant ? 'rn-on' : masseApres(S, p, x) > R.plafond ? 'rn-non' : ''}" data-a="sortant" data-v="${getPlayerKey(x)}" aria-label="${esc(x.n)}">${carteJ(x)}</button>`).join('')}</div></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:${sortants.length > 7 ? 600 : 530}px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><span class="rn-k">Ton plafond</span><span class="rn-t${ok ? '' : ' rn-rg'}">${money(apres)} <span class="rn-gris">/ ${money(R.plafond)}</span></span></div>
    ${ok ? plafondApres(S, p, sortant) : plafond(S)}
    <div class="rn-t rn-gris" style="margin-top:8px">${esc(court(p))} : <span class="rn-or">+${money(prixDe(S, p))}</span>. ${esc(court(sortant))} sort : <span class="rn-rg">${money(reste)} restent à ton plafond</span> pour la saison.${ok ? '' : ' <span class="rn-rg">Ça ne passe pas.</span>'}</div></div>
  ${bas(bt('Retour', 'fermer-echange'), bt('Signer', 'signer', { cls: 'gold', off: !ok, v: getPlayerKey(sortant) }))}`;
}
function plafondApres(S, p, sortant) {
  const R = S.R, pc = x => `${Math.max(0, Math.min(100, (100 * x) / R.plafond)).toFixed(1)}%`;
  const base = masseDe(S) - prixDe(S, sortant), neuf = prixDe(S, p), mort = (1 - RUN.RACHAT) * prixDe(S, sortant);
  return `<div class="rn-plaf"><i style="width:${pc(base)}"></i><i class="rn-neuf" style="left:${pc(base)};width:${pc(neuf)}"></i><i class="rn-mort" style="left:${pc(base + neuf)};width:${pc(mort)}"></i></div>`;
}
/* Un rival ou une élite battus : leur pièce, avant leurs portes. */
export const scenePieceGagnee = (S, V) => `${hud(S)}
  <div style="left:14px;right:14px;top:66px;text-align:center"><div class="rn-k rn-vert">${S.R.apres.sorte === 'rival' ? 'Le rival est battu' : 'L\'élite est battue'}</div><div class="rn-titre" style="margin-top:6px">${S.R.apres.gf}-${S.R.apres.ga}</div></div>
  <div style="left:14px;right:14px;top:170px">${etalDePieces(S, V, { titre: `${esc(surnom(S.R.apres.t))} te laissent une pièce`, sous: 'Une parmi trois' })}</div>
  ${bas(bt('Passer', 'piece-passee'), bt('Prendre', 'prendre-piece', { cls: 'gold' }))}`;

/* ---------- le bilan du quart, le marché du quart ---------- */
/*
 * LE BILAN. Le verdict en tête (c'est la question : est-ce que je perds un cœur ?), puis les trois objectifs avec leur
 * chiffre, puis ce que le quart laisse : tes cœurs, tes médailles, ton rang.
 */
export function sceneBilan(S) {
  const R = S.R, x = R.quarts.at(-1), congedie = R.coeurs <= 0, dernier = x.n === RUN.QUARTS.length - 1, seize = x.rang <= RUN.LIGUE.PLACES;
  const titre = congedie ? 'Congédié' : x.tenu ? 'Le proprio est content' : 'Le proprio grogne';
  const suite = congedie ? 'Le proprio te remercie. La saison s\'arrête ici.' : dernier ? (seize ? 'Tu es des seize : les séries commencent.' : 'Hors des seize : la saison s\'arrête après le marché.') : `Ensuite : le marché, puis le quart ${ROMAINS[x.n + 1]}.`;
  return `${hud(S, { petit: 'Le bilan' })}
  <div style="left:14px;right:14px;top:66px;text-align:center"><div class="rn-k ${x.tenu ? 'rn-vert' : 'rn-rg'}">${x.tenus} objectif${x.tenus > 1 ? 's tenus' : ' tenu'} sur trois</div><div class="rn-titre" style="margin-top:6px;white-space:nowrap">${titre}</div></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:150px">${objectifsHtml(S, x.objectifs)}</div>
  <div class="rn-cellules" style="left:14px;right:14px;top:300px">
    <div><b>${Array.from({ length: RUN.COEURS }, (_, i) => coeur(i < R.coeurs)).join('')}</b><small>${x.coeur ? 'Un cœur perdu' : 'Tes cœurs gardés'}</small></div>
    <div><b class="${seize ? 'rn-vert' : 'rn-rg'}">${rangTxt(x.rang)}</b><small>Au classement</small></div>
    <div><b class="rn-or">+${x.medailles}</b><small>Médailles</small></div></div>
  <div class="rn-t rn-gris" style="left:14px;right:14px;top:404px;text-align:center">${suite}</div>
  ${bas(bt(congedie ? 'Voir la fin' : 'Le marché du quart', 'apres-bilan', { cls: 'go' }))}`;
}
/* Le marché du quart : une pièce de banc parmi trois, une carte à monter. Les pochettes, elles, sont au bureau. */
export function sceneMarche(S, V) {
  const R = S.R, M = R.marche, plein = R.banc.length >= CASES_DU_BANC;
  const piece = k => { const ok = !M.piece && R.jetons >= PRIX_PIECE; return `<button type="button" class="${V.piece === k ? 'rn-on' : ''}" data-a="voir-piece" data-v="${k}"${ok ? '' : ' disabled'}>${carteP(k)}<span class="rn-prix${ok ? '' : ' rn-non'}">${M.piece ? 'Prise' : `<i class="rn-piece"></i>${PRIX_PIECE}`}</span><p>${ligneCourte(S, k)}</p></button>`; };
  // UNE CARTE À MONTER (JP, 14 nov. 2026) : un de tes signés, une édition de plus, une par marché. La tuile montre celui qui
  // avance le plus ton banc ; la toucher encore passe au suivant.
  const candidats = aMonter(S), cm = candidats.find(x => getPlayerKey(x.p) === V.montee) || candidats[0] || null, peut = !M.montee && R.jetons >= RUN.MONTER;
  const gains = cm && cm.gains.length ? cm.gains.map(g => `${PIECES[g.cle].ico} +${String(g.d).replace('.', ',')}`).join(' · ') : 'Rien pour ton banc';
  const k = cm ? Object.keys(NOM_VARIANTE).indexOf(editionDe(cm.p)) : -1, apres = cm ? Object.keys(NOM_VARIANTE)[k + 1] : null;
  const monter = cm ? `<div class="rn-panneau" style="display:grid;grid-template-columns:84px 24px 84px 1fr;gap:8px;align-items:center"><button type="button" data-a="voir-montee" aria-label="Une autre carte"${peut ? '' : ' disabled'}>${carteJ(cm.p)}</button><div class="rn-h rn-or" style="text-align:center">›</div><span class="rn-c rn-cj" style="${varsEquipe(cm.p)}">${cartonDe(cm.p, { rar: apres })}</span>
      <div class="rn-t"><b>${esc(court(cm.p))}</b><br><span class="rn-gris">${esc(NOM_VARIANTE[editionDe(cm.p)])} › </span><span class="rn-vert">${esc(NOM_VARIANTE[apres])}</span><br>${gains}<br><span class="rn-prix${peut ? '' : ' rn-non'}" style="margin-top:6px">${M.montee ? 'Montée' : `<i class="rn-piece"></i>${RUN.MONTER}`}</span></div></div>`
    : '<div class="rn-panneau"><div class="rn-t rn-gris">Toutes tes cartes sont au sommet.</div></div>';
  return `${hud(S, { titre: 'Le marché', petit: `Quart ${ROMAINS[R.quart.n]}` })}
  <div style="left:14px;right:14px;top:62px"><div class="rn-k" style="margin-bottom:10px">Une pièce de banc · une seule</div><div class="rn-etal">${M.pieces.map(piece).join('')}</div></div>
  <div style="left:14px;right:14px;top:350px"><div class="rn-k" style="margin-bottom:10px">Une carte à monter · toucher la carte : une autre</div>${monter}</div>
  <div style="left:14px;right:14px;top:596px"><div class="rn-k" style="margin-bottom:8px">Ton banc${plein ? ' · plein : touche celle qui sort' : ' · une case libre'}</div>
    <div class="rn-banc" style="width:292px">${R.banc.map(b => `<button type="button" class="${V.sort === b ? 'rn-eteinte' : ''}" data-a="piece-sort" data-v="${b}"${plein && !M.piece ? '' : ' disabled'}>${carteP(b)}</button>`).join('')}${Array.from({ length: CASES_DU_BANC - R.banc.length }, (_, i) => `<span class="rn-vide${i === 0 ? ' rn-on' : ''}"></span>`).join('')}</div></div>
  ${V.piece && !M.piece ? bas(bt('Continuer', 'quitter-marche'), bt('Prendre la pièce', 'acheter-piece', { cls: 'gold', v: V.piece, off: plein && !V.sort }))
    : cm && peut ? bas(bt('Continuer', 'quitter-marche'), bt(`Monter ${esc(court(cm.p))}`, 'monter-au-marche', { cls: 'gold', v: getPlayerKey(cm.p) }))
      : bas(bt('Continuer', 'quitter-marche', { cls: 'go' }))}`;
}
/* Les pochettes, au bureau : le Bronze et l'Époque, une de chaque par quart. */
export function sceneEtal(S) {
  const R = S.R;
  const pochette = (cle, mot, ico, metal, quoi) => { const prix = RUN.POCHETTES[cle], prise = R.quart.pochettes.includes(cle), ok = pochetteLibre(S, cle); return `<button type="button" data-a="pochette" data-v="${cle}"${ok ? '' : ' disabled'}><span class="rn-c" style="--pk-a:var(${metal})">${pochetteHtml({ mot, ico })}</span><span class="rn-prix${ok ? '' : ' rn-non'}">${prise ? 'Ouverte ce quart' : `<i class="rn-piece"></i>${prix}`}</span><p>${quoi}</p></button>`; };
  return `${hud(S, { titre: 'Les pochettes', petit: `Quart ${ROMAINS[R.quart.n]}` })}
  <div class="rn-panneau" style="left:14px;right:14px;top:62px"><div class="rn-t">Une pochette s'ouvre comme une porte : tu y signes un joueur, ou aucun.<br><span class="rn-gris">Une de chaque par quart.</span></div></div>
  <div class="rn-etal" style="left:60px;right:60px;top:160px;grid-template-columns:repeat(2, 1fr);gap:24px">${pochette('j:bronze', 'Bronze', '🥉', '--attention', 'Trois joueurs au hasard')}${pochette('j:epoque', 'Époque', '🕰', '--rn-bleu', 'Un pilier ou mieux, d\'une époque au hasard')}</div>
  <div class="rn-panneau" style="left:14px;right:14px;top:560px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><span class="rn-k">Ton plafond</span><span class="rn-t">${money(masseDe(S))} <span class="rn-gris">/ ${money(R.plafond)}</span> · <span class="rn-or">Espace ${money(espaceDe(S))}</span></span></div>${plafond(S, { mort: R.mort || 0 })}</div>
  ${bas(bt('Retour au bureau', 'fermer-etal', { cls: 'go' }))}`;
}

/* ---------- le ballottage, une histoire ---------- */
/* Le ballottage, seulement s'il le faut (JP, 16 nov. 2026) : trois vrais joueurs pas chers, pour la case que personne chez toi ne peut tenir. */
export function sceneBallottage(S, V) {
  const R = S.R, B = R.ballottage, cas = SLOTS.find(s => s.i === B.i), blesse = S.roster[B.i], offres = offresVues(S), choisi = offres.find(p => getPlayerKey(p) === V.joueur) || offres[0];
  const ou = cas.group === 'G' ? cas.role.toLowerCase() : `${cas.role}, ${ord(cas.unit + 1)} ${cas.group === 'F' ? 'trio' : 'paire'}`;
  return `${hud(S, { titre: 'Le ballottage', petit: '' })}
  <div class="rn-panneau" style="left:14px;right:14px;top:62px"><div class="rn-t"><b>${blesse ? `${esc(court(blesse))} est à l'infirmerie` : 'Une case est vide'}</b> <span class="rn-gris">· ${esc(ou)}</span><br><span class="rn-gris">Personne chez toi ne peut tenir sa case. Réclame un joueur le temps de la blessure : il ne compte ni à ton plafond ni à ton banc.</span></div></div>
  <div class="rn-etal" style="left:14px;right:14px;top:190px">${offres.map(p => `<button type="button" class="${p === choisi ? 'rn-on' : ''}" data-a="voir-joueur" data-v="${getPlayerKey(p)}">${carteJ(p)}<p>${esc(court(p))}<br>${badgeMot(p)}</p></button>`).join('')}</div>
  ${choisi ? `<div class="rn-panneau" style="left:14px;right:14px;top:520px"><b class="rn-h">${esc(choisi.n)}</b><div class="rn-t rn-gris" style="margin-top:6px">Cette année-là : ${vraie(choisi)}.</div></div>` : ''}
  ${bas(bt('Personne', 'reclamer', { petit: 'Un remplaçant de la ligue' }), bt(choisi ? `Réclamer ${esc(court(choisi))}` : 'Réclamer', 'reclamer', { cls: 'go', v: choisi ? getPlayerKey(choisi) : '', off: !choisi }))}`;
}
export function sceneHistoire(S, V) {
  const H = V.histoire;
  return `${hud(S, { titre: 'Une histoire', petit: '' })}
  <div style="left:14px;right:14px;top:66px"><span class="rn-voix">${esc(H.voix)}</span><div class="rn-bulle">${H.dit}</div></div>
  ${H.joueur ? `<div style="left:14px;right:14px;top:250px;display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:center">${carteJ(H.joueur)}<div><div class="rn-h">${esc(H.joueur.n)}</div><div class="rn-t rn-gris" style="margin-top:6px">${H.fait}</div></div></div>` : ''}
  <div class="rn-reps" style="left:14px;right:14px;top:404px;bottom:76px">${H.options.map((o, i) => `<div><span class="rn-c">${o.carte}</span><p>${o.lignes}</p><button type="button" class="rn-prendre" data-a="reponse" data-v="${i}">Prendre</button></div>`).join('')}</div>
  ${H.options.length ? bas(bt('Plus tard', 'fermer-histoire')) : ''}`;
}

/* ---------- les séries : les vraies, seize clubs, quatre rondes ---------- */
const pointsDeSerie = (w, l) => `<div class="rn-pts">${Array.from({ length: 7 }, (_, i) => `<i class="${i < w ? 'rn-g' : i < w + l ? 'rn-p' : ''}"></i>`).join('')}</div>`;
/*
 * LE TABLEAU DES SÉRIES, le premier onglet du bureau quand la saison est finie. Ta série d'abord, grosse (c'est le prochain
 * match) ; puis les autres séries de la ronde, en lignes (qui tu croiseras) ; puis tes rondes gagnées.
 */
function pageSeries(S) {
  const R = S.R, X = R.series, M = X.moi, adv = clubNo(S, M.adv), ronde = X.rondes[X.ronde], tete = i => X.tetes.indexOf(i) + 1;
  const autres = ronde.filter(x => x.a !== 0 && x.b !== 0).map(x => ligne([`${tete(x.a)}`, `${logoNo(S, x.a)} ${nomDuClubNo(S, x.a)}`, `<b>${x.w}-${x.l}</b>`, `${logoNo(S, x.b)} ${nomDuClubNo(S, x.b)}`, `${tete(x.b)}`]));
  return `<div style="left:14px;right:14px;top:60px"><div class="rn-k">${RONDES[X.ronde]} · quatre victoires pour passer</div></div>
  <div class="rn-ronde rn-on" style="left:14px;right:14px;top:84px">${logo(adv.t, 44)}<b>${esc(clubMot(adv))}<small>${tete(M.adv)}e contre toi, ${tete(0)}e · ${M.w}-${M.l}</small></b>${pointsDeSerie(M.w, M.l)}</div>
  ${X.faites.length ? `<div class="rn-t rn-gris" style="left:14px;right:14px;top:166px">Déjà battus : ${X.faites.map(f => `${esc(surnom(f.t))} ${f.w}-${f.l}`).join(' · ')}</div>` : ''}
  ${autres.length ? cadre(tableau('22px 1fr 44px 1fr 22px', ['', 'Les autres séries', '', '', ''], autres, 'rn-series'), 196, 144) : ''}
  <div class="rn-bas" style="bottom:72px">${bt('La feuille du soir', 'match-de-serie', { cls: 'rn-combat' })}</div>`;
}

/* ---------- la fin, la pause ---------- */
const CAUSES = { congedie: 'Congédié', saison: 'Hors des séries', serie: 'Éliminé en séries', coupe: 'La Coupe', quitte: 'Run quittée' };
export function sceneFin(S, V) {
  const R = S.R, F = R.fin, x = R.series;
  const quarts = R.quarts.map(q => `<div class="rn-recap"><span>Quart ${ROMAINS[q.n]}</span><span${q.tenu ? '' : ' class="rn-rg"'}>${q.tenus} objectif${q.tenus > 1 ? 's' : ''} sur trois · ${q.rang}e<small>${q.rival ? 'Rival battu' : 'Rival perdu'}, ${esc(surnom(q.t))}${q.coeur ? ' · un cœur perdu' : ''}</small></span><span class="rn-or">+${q.medailles}</span></div>`).join('');
  const series = x ? `<div class="rn-recap"><span>Séries</span><span>${F.coupe ? 'La Coupe' : F.rondes ? `${F.rondes} ronde${F.rondes > 1 ? 's gagnées' : ' gagnée'}` : 'Aucune ronde gagnée'}<small>${x.faites.map(f => `${esc(surnom(f.t))} ${f.w}-${f.l}`).join(', ') || esc(clubMot(clubNo(S, x.moi.adv)))}</small></span><span class="rn-or">+${F.medailles - (F.caisse || 0) - R.quarts.reduce((a, y) => a + y.medailles, 0)}</span></div>` : '';
  const caisse = F.caisse ? `<div class="rn-recap"><span>Caisse</span><span>${R.jetons} jetons qui restent<small>${RUN.JETONS_PAR_MEDAILLE} jetons, une médaille</small></span><span class="rn-or">+${F.caisse}</span></div>` : '';
  const etoile = V.etoile;
  return `<div style="left:14px;right:14px;top:30px;text-align:center"><div class="rn-k ${F.coupe ? 'rn-vert' : 'rn-rg'}">${F.coupe ? 'Tu as gagné' : 'La run est finie'}</div><div class="rn-titre" style="margin-top:8px;white-space:nowrap">${CAUSES[F.cause]}</div>
    <div class="rn-t rn-gris" style="margin-top:8px">Run ${R.numero} · ${esc(R.coach.n || COACHS[R.coach.cle].nom)}</div></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:122px">${quarts}${series}${caisse}${!quarts && !series && !caisse ? '<div class="rn-t rn-gris">La saison n\'avait pas commencé.</div>' : ''}</div>
  ${etoile ? `<div style="left:14px;right:14px;top:470px;display:grid;grid-template-columns:104px 1fr;gap:14px;align-items:center">${carteJ(etoile.p)}<div><div class="rn-k">Ton joueur de la saison</div><div class="rn-h" style="margin-top:5px">${esc(etoile.p.n)}</div><div class="rn-t rn-gris" style="margin-top:6px">${etoile.mot}<br><span class="rn-vert">Sa carte entre à ton cartable</span>${(R.galons || []).length ? `<br><span class="rn-or">🏵 ${R.galons.length} galon${R.galons.length > 1 ? 's gravés' : ' gravé'} cette saison</span>` : ''}</div></div></div>` : ''}
  <div class="rn-cellules" style="left:14px;right:14px;top:636px"><div><b class="rn-or">${F.medailles}</b><small>Médailles${reglesDe(R).prime > 1 ? ` · ×${String(reglesDe(R).prime).replace('.', ',')}` : ''}</small></div><div><b>${F.rang ? rangTxt(F.rang) : '—'}</b><small>${F.pts} points</small></div><div><b>${F.matchs}</b><small>Matchs joués</small></div></div>
  <button type="button" class="rn-bande" style="left:14px;right:14px;top:716px" data-a="club">Le Club${medailles(V.medailles)}</button>
  ${bas(bt('Menu', 'quitter'), bt('Une run neuve', 'run-neuve', { cls: 'go' }))}`;
}
export function scenePause(S, V) {
  const R = S.R, L = R.ligue;
  return `<div class="rn-voile"></div>
  <div style="left:28px;right:28px;top:70px"><div class="rn-k">Pause · run ${R.numero}</div><div class="rn-titre" style="margin-top:6px">${R.series ? 'Les séries' : R.quart ? `Quart ${ROMAINS[R.quart.n]}` : 'Le départ'}</div>
    <div class="rn-t rn-gris" style="margin-top:6px">${L ? `${rangDe(S, 0)}e · ${ficheMot(L.fiches[0])} · ` : ''}${pluriel(R.coeurs, 'cœur')} · ${R.jetons} jetons</div></div>
  <div class="rn-menu"><button type="button" class="rn-on" data-a="reprendre">Reprendre</button>
    <button type="button" data-a="menu">Le menu du jeu<small>La run est gardée</small></button>
    <button type="button" class="rn-quitter" data-a="abandonner">${V.sur ? 'Toucher encore : la run finit ici' : 'Quitter la run'}</button></div>`;
}
/* ---------- le Club : entre deux runs (V28, tranche 5, docs/refonte-v28-5.md § 3.1) ---------- */
/* Les médailles ont leur dessin, jamais la pièce des jetons. */
const medailles = n => `<span class="rn-jt rn-md"><i class="rn-medaille"></i>${n}</span>`;
const PAGES_DU_CLUB = [['variete', 'Variété'], ['club', 'Ton club'], ['album', 'Album'], ['palmares', 'Palmarès']];
/*
 * LE CLUB (`C` : ce que la coquille en sait — { meta, rang, nom, page, voie, coachs, rayons, rayon, objet }). Sa tête
 * remplace le HUD : ton écusson, ton nom, ton rang, tes médailles ; trois pages en segment, chacune tient en un écran.
 */
export function sceneClub(C) {
  const page = { variete: pageVariete, club: pageTonClub, album: pageAlbum, palmares: pagePalmares }[C.page] || pageVariete;
  return `<div class="rn-hud">${logo('YOU', 34)}<span class="rn-acte">${esc(C.nom)}<small>${esc(PRESTIGES[C.rang].nom)}</small></span>${medailles(C.meta.ecussons || 0)}</div>
  <div class="rn-seg" style="left:14px;right:14px;top:62px">${PAGES_DU_CLUB.map(([k, mot]) => `<button type="button" class="${C.page === k ? 'rn-on' : ''}" data-a="page" data-v="${k}">${mot}</button>`).join('')}</div>
  ${page(C)}`;
}
/* Variété : les huit philosophies en grille, celle qu'on touche dessous ; l'achat répond sur place. */
function pageVariete(C) {
  const m = C.meta, ouvertes = voiesOuvertes(m), prix = prixDeLaVoie(m), v = C.voie, P = COACHS[v], regle = REGLES_DU_COACH[v], ouverte = ouvertes.includes(v);
  const piece = PIECE_DU_COACH[v], x = C.coachs && C.coachs[v], manque = ouverte || prix == null ? 0 : Math.max(0, prix - (m.ecussons || 0));
  const carte = k => `<button type="button" class="${k === v ? 'rn-on' : ''}${ouvertes.includes(k) ? '' : ' rn-fermee'}" data-a="voir-voie" data-v="${k}" aria-label="${esc(COACHS[k].nom)}${ouvertes.includes(k) ? '' : ', à ouvrir'}"><span class="rn-c">${
    carteHtml({ cle: k, niveau: 0, genreCarte: 'synergie', ico: COACHS[k].ico, nomHtml: esc(COACHS[k].nom), typeHtml: 'Philosophie', lecture: true, statique: true })}</span></button>`;
  return `<div class="rn-k" style="left:14px;top:120px">${ouvertes.length} de ${VOIES.length} philosophies${prix != null ? ` · la prochaine : ${prix}` : ''}</div>
  <div class="rn-voies" style="left:14px;right:14px;top:144px">${VOIES.map(carte).join('')}</div>
  <div class="rn-panneau rn-on" style="left:14px;right:14px;top:418px">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><b class="rn-h">${P.ico} ${esc(P.nom)}</b><span class="rn-puce ${ouverte ? 'rn-v' : 'rn-o'}">${ouverte ? (m.nouvelle === v ? 'Nouvelle' : 'Ouverte') : `À ouvrir · ${prix}`}</span></div>
    <div class="rn-t rn-gris" style="margin-top:6px">${esc(P.mot)}</div>
    ${regle ? `<div class="rn-t" style="margin-top:8px"><span class="rn-k">Sa règle</span><br>${esc(regle.dit.charAt(0).toUpperCase() + regle.dit.slice(1))} : <span class="rn-or">+${regle.jetons} jetons</span> le soir.</div>` : ''}
    <div style="display:grid;grid-template-columns:62px 1fr;gap:12px;align-items:center;margin-top:10px">${carteP(piece)}<div class="rn-t"><span class="rn-k">Sa pièce de départ</span><br><b>${esc(PIECES[piece].nom)}</b><br><span class="rn-gris">${ligneSansRun(piece)}</span></div></div>
    ${x ? `<div class="rn-t rn-gris" style="margin-top:8px">${x.n} entraîneurs au loto, dont ${esc(x.exemple)}.</div>` : ''}
  </div>
  ${bas(bt('Retour', 'fermer-club'), ouverte || prix == null ? bt('Une run neuve', 'run-neuve', { cls: 'go' }) : bt(manque ? `Il te manque ${manque}` : `Ouvrir · ${prix}`, 'ouvrir-voie', { cls: 'go', v, off: manque > 0 }))}`;
}
/* Ton club : son écusson et son nom (vendus ensemble), ses couleurs ; un acquis se porte d'un toucher. */
function pageTonClub(C) {
  const R = C.rayons.find(r => r.cle === C.rayon) || C.rayons[0], o = R.objets.find(x => x.cle === C.objet) || R.objets.find(x => x.porte) || R.objets[0];
  const manque = o.acquis ? 0 : Math.max(0, o.prix - (C.meta.ecussons || 0));
  const etat = o.porte ? 'Porté' : o.acquis ? 'À toi' : o.verrou ? `Demande le rang ${o.verrou}` : `${o.prix} médailles`;
  const tuile = x => `<button type="button" class="${[x.cle === o.cle ? 'rn-on' : '', x.porte ? 'rn-revetu' : '', x.acquis ? '' : 'rn-fermee'].filter(Boolean).join(' ')}" data-a="voir-objet" data-v="${x.cle}" aria-label="${esc(x.nom)}"${
    x.nuance ? ` style="--a:${x.nuance[0]};--b:${x.nuance[1]}"></button>` : `>${x.apercu}</button>`}`;
  const action = o.porte ? bt('Porté', 'prendre-objet', { cls: 'go', v: o.cle, off: true })
    : bt(o.acquis ? 'Porter' : o.verrou ? 'Rang trop bas' : manque ? `Il te manque ${manque}` : `Acheter · ${o.prix}`, 'prendre-objet', { cls: 'go', v: o.cle, off: !o.acquis && (!!o.verrou || manque > 0) });
  return `<div class="rn-seg" style="left:14px;right:14px;top:118px">${C.rayons.map(r => `<button type="button" class="${r.cle === R.cle ? 'rn-on' : ''}" data-a="rayon" data-v="${r.cle}">${r.cle === 'club' ? 'Écusson' : 'Couleurs'}</button>`).join('')}</div>
  <div class="rn-panneau rn-apercu" style="left:14px;right:14px;top:174px">${o.apercu}<div><b class="rn-h">${esc(o.nom)}</b><div class="rn-t rn-gris" style="margin-top:5px">${esc(etat)}</div></div></div>
  <div class="${R.cle === 'club' ? 'rn-clubs' : 'rn-couleurs'}" style="left:14px;right:14px;top:268px">${R.objets.map(tuile).join('')}</div>
  ${bas(bt('Retour', 'fermer-club'), action)}`;
}
/* Palmarès : tes runs, l'échelle du prestige (le rang d'après dit ce qui manque), tes exigences, la trace du solde. */
/*
 * L'Album (tranche 5b) : ton cartable, six cartes par écran, les plus belles d'abord ; celle qu'on touche dit son édition,
 * ses copies et ce qui est gravé dessus. `A` (`C.album`) : l'album à plat (js/cartable.js `albumDuCartable`), le segment,
 * la page, la carte vue, et les joueurs des saisons déjà chargées (`A.joueurs` : la clé → le joueur).
 */
export const ALBUM_PAR_PAGE = 6;
export const listeDeLAlbum = A => (A.seg === 'coachs' ? A.coachs : A.seg === 'gravees' ? A.cartes.filter(x => x.legendes.length) : A.cartes);
function pageAlbum(C) {
  const A = C.album, liste = listeDeLAlbum(A), pages = Math.max(1, Math.ceil(liste.length / ALBUM_PAR_PAGE)), page = Math.min(A.page, pages - 1);
  const ici = liste.slice(page * ALBUM_PAR_PAGE, (page + 1) * ALBUM_PAR_PAGE), id = x => x.k || x.id, vue = ici.find(x => id(x) === A.vue) || ici[0];
  const tuile = x => { const p = x.k && A.joueurs.get(x.k); return `<button type="button" class="${x === vue ? 'rn-on' : ''}" data-a="voir-carte" data-v="${esc(id(x))}" aria-label="${esc(x.k ? (p ? p.n : x.k) : x.n)}">${
    x.k ? (p ? `<span class="rn-c rn-cj" style="${varsEquipe(p)}">${cartonDe(p, { rar: x.ed })}</span>` : '<span class="rn-c rn-vide"></span>') : `<span class="rn-c">${carteDuCoachHtml(x)}</span>`}${x.k && x.legendes.length ? `<span class="rn-tag">${x.legendes.length} 🏵</span>` : ''}</button>`; };
  const gravures = l => l.slice(-3).reverse().map(g => `${LEGENDES[g.type].ico} <b>${esc(LEGENDES[g.type].nom)}</b> · ${esc(LEGENDES[g.type].recit(g))}`).join('<br>') + (l.length > 3 ? `<br><span class="rn-gris">et ${l.length - 3} de plus</span>` : '');
  const detail = !vue ? '' : vue.k ? (() => { const p = A.joueurs.get(vue.k); return `<div style="display:flex;justify-content:space-between;align-items:baseline"><b class="rn-h">${esc(p ? p.n : '…')}</b><span class="rn-puce rn-o">${esc(NOM_VARIANTE[vue.ed])}${vue.n > 1 ? ` · ${vue.n} copies` : ''}</span></div>
      <div class="rn-t rn-gris" style="margin-top:5px">${esc(clubMot({ t: vue.club, s: vue.saison }))}</div><div class="rn-t" style="margin-top:8px">${vue.legendes.length ? gravures(vue.legendes) : '<span class="rn-gris">Rien de gravé encore : un chapeau, un jeu blanc, dix buts dans une run s\'y graveront.</span>'}</div>`; })()
    : `<div style="display:flex;justify-content:space-between;align-items:baseline"><b class="rn-h">${esc(vue.n)}</b><span class="rn-puce rn-o">${vue.r || 1} run${(vue.r || 1) > 1 ? 's' : ''}</span></div>
      <div class="rn-t rn-gris" style="margin-top:5px">${esc(clubMot({ t: vue.tag, s: vue.saison }))}${vue.fiche ? ` · ${esc(vue.fiche)}` : ''}</div><div class="rn-t" style="margin-top:8px">${COACHS[vue.cle].ico} <b>${esc(COACHS[vue.cle].nom)}</b> · ${esc(motDuRang(vue.cle, vue.rang))}</div>`;
  const segs = [['joueurs', `Joueurs · ${A.cartes.length}`], ['gravees', `Gravées · ${A.cartes.filter(x => x.legendes.length).length}`], ['coachs', `Entraîneurs · ${A.coachs.length}`]];
  return `<div class="rn-k" style="left:14px;right:14px;top:120px">${A.cartes.length} carte${A.cartes.length > 1 ? 's' : ''} de ${A.clubs} club${A.clubs > 1 ? 's' : ''}-saison${A.clubs > 1 ? 's' : ''} · ${A.galons} galon${A.galons > 1 ? 's' : ''}</div>
  <div class="rn-seg" style="left:14px;right:14px;top:142px">${segs.map(([k, mot]) => `<button type="button" class="${A.seg === k ? 'rn-on' : ''}" data-a="album-seg" data-v="${k}">${mot}</button>`).join('')}</div>
  ${ici.length ? `<div class="rn-album" style="left:14px;right:14px;top:198px">${ici.map(tuile).join('')}</div>
  <div class="rn-panneau rn-on" style="left:14px;right:14px;top:560px">${detail}</div>`
    : `<div class="rn-panneau" style="left:14px;right:14px;top:198px"><div class="rn-t rn-gris">${A.seg === 'gravees' ? 'Aucune carte gravée encore. Un chapeau, un jeu blanc, dix buts dans une run se gravent sur la carte du joueur.' : A.seg === 'coachs' ? 'Aucun entraîneur encore : celui que tu prends au départ d\'une run entre ici.' : 'Ton album est vide. Un joueur signé dans une run y entre, à la fin de la run.'}</div></div>`}
  ${bas(bt('Retour', 'fermer-club'), bt('‹', 'album-page', { v: '-1', off: page <= 0 }), bt(`${page + 1} / ${pages} ›`, 'album-page', { v: '1', cls: 'go', off: page >= pages - 1 }))}`;
}
function pagePalmares(C) {
  const m = C.meta, M = m.meilleur, cran = cranOuvert(m);
  const meilleur = !M ? 'Aucune run finie' : M.coupe ? 'La Coupe' : M.ronde ? `${M.ronde} ronde${M.ronde > 1 ? 's gagnées' : ' gagnée'} en séries` : `${M.pts} points dans la run`;
  const echelon = (P, i) => `<div class="rn-recap"><span>${i + 1}</span><span${i > C.rang ? ' class="rn-gris"' : ''}>${esc(P.nom)}<small>${i <= C.rang ? esc(P.texte) : `${P.min} médailles à vie${P.exploit ? ` · ${P.exploit}` : ''}`}</small></span><span class="${i === C.rang ? 'rn-or' : 'rn-gris'}">${i === C.rang ? 'Ton rang' : i < C.rang ? 'Fait' : ''}</span></div>`;
  return `<div class="rn-cellules" style="left:14px;right:14px;top:118px"><div><b>${m.runs || 0}</b><small>Runs</small></div><div><b>${m.coupes || 0}</b><small>Coupes</small></div><div><b class="rn-or">${ecussonsAVie(m)}</b><small>Médailles à vie</small></div></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:200px"><div class="rn-k" style="margin-bottom:2px">Le prestige</div>${PRESTIGES.map(echelon).join('')}</div>
  <div class="rn-panneau" style="left:14px;right:14px;top:520px">
    <div class="rn-recap"><span>Record</span><span>${esc(meilleur)}</span><span></span></div>
    <div class="rn-recap"><span>Exigence</span><span>${(m.coupes || 0) > 0 ? `Cran ${m.exigence || 0} gagné<small>Le cran ${cran} est ouvert${cran ? ` : ${esc(EXIGENCES[cran - 1].texte)}` : ''}</small>` : 'Fermée<small>La première Coupe ouvre le cran 1</small>'}</span><span></span></div>
    ${m.solde && (m.solde.rendu || m.arret) ? `<div class="rn-recap"><span>Solde</span><span>L'ancien Rogue<small>${m.solde.rendu} médailles remboursées${m.arret && m.arret.verse ? `, ${m.arret.verse} versées à l'arrêt` : ''}</small></span><span></span></div>` : ''}
  </div>
  ${bas(bt('Retour', 'fermer-club'))}`;
}
/*
 * LE SOLDE DE L'ANCIEN ROGUE, une fois (`s` : { avant, rendu, familles, voies, arret, apres }) : ce que l'arrêt de la vieille
 * run a versé, chaque famille de déblocages remboursée, les philosophies gardées ; « tu avais, tu as ». Onze lignes au
 * plus (l'arrêt, neuf familles, les philosophies), chacune sur une ligne, pour tenir au-dessus du compte (`.rn-solde`).
 */
export function sceneSolde(s) {
  const lignes = [
    ...(s.arret ? [`<div class="rn-recap"><span>Arrêt</span><span>${s.arret.runs} run${s.arret.runs > 1 ? 's arrêtées' : ' arrêtée'}, ses séries payées</span><span class="rn-or">+${s.arret.verse}</span></div>`] : []),
    ...s.familles.map(f => `<div class="rn-recap"><span>×${f.n}</span><span>${esc(f.nom)}</span><span class="rn-or">+${f.prix}</span></div>`),
    ...(s.voies.length ? [`<div class="rn-recap"><span>×${s.voies.length}</span><span>${s.voies.length > 1 ? 'Philosophies gardées' : 'Philosophie gardée'}<small>${s.voies.map(v => esc(COACHS[v].nom)).join(', ')}</small></span><span class="rn-vert">À toi</span></div>`] : []),
  ];
  return `<div style="left:14px;right:14px;top:30px"><div class="rn-k">Une fois</div><div class="rn-titre" style="margin-top:8px">L'ancien Rogue est parti</div>
    <div class="rn-t rn-gris" style="margin-top:8px">Tes médailles achetaient de la force. Elles ouvrent maintenant de la variété : ce que tu avais acheté t'est rendu, à son prix.</div></div>
  <div class="rn-panneau rn-solde" style="left:14px;right:14px;top:150px">${lignes.join('')}</div>
  <div class="rn-cellules" style="left:14px;right:14px;top:636px"><div><b>${Math.max(0, s.avant - (s.arret ? s.arret.verse : 0))}</b><small>Tu avais</small></div><div><b class="rn-or">+${s.rendu + (s.arret ? s.arret.verse : 0)}</b><small>Rendu</small></div><div><b class="rn-or">${s.apres}</b><small>Tu as</small></div></div>
  ${bas(bt('Au Club', 'solde-club'), bt('Continuer', 'solde-depart', { cls: 'go' }))}`;
}
