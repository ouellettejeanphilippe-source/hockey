/*
 * LE MODE SUR TABLE ET L'EXHIBITION (sortis de js/game.js en 1.0) : le
 * tournoi au plateau, ses règles, son bilan, et le match d'exhibition.
 */

import { esc } from './util.js';
import { getTeamBand, couleurVive, getTeamLogoHtml } from './logos.js';
import { reglesDuPlateau, equipeDeTable, gagnantDuMatch } from './table.js';
import { CLUBS as CLUBS_TOURNOI, nouveauTournoi, ouvrirTournoi, relireTournoi, classement as classementTournoi } from './tournoi.js';
import { nouvelleGraine } from './sim.js';
import { state } from './data.js';
import { ouvrirTable } from './plateau.js';
import { $, G, applyTeamColors, buildOpponents, capLeft, closeModal, headshotHtml, openModal, rebatirAdversaires, rnd, saveGame, setOption, slotsLeft, toast } from './game.js';
import { ouvrirNouvellePartie, syncOptionsUI } from './partie.js';
import { renderMain } from './alignement.js';
import { lienJoueur } from './fiche.js';
import { getShard } from './repechage.js';

/* ======================================================================
   LE TOURNOI SUR TABLE
   ======================================================================
   JP : *mode bonus genre blood bowl, fft et autres jeux de sport de table* ;
   puis *viser un modèle à la blood bowl, mais plus rapide, surtout pour genre
   les séries, ou faire mini saisons et séries*.

   Le repêchage ne change pas d'un poil : mêmes 23 cases, même plafond, même
   roulette. C'est l'aval qui change — au lieu des 82 matchs de
   `simulateLeague`, ton alignement va jouer un tournoi de six clubs sur un
   plateau, cinq matchs de saison et deux rondes de séries, et tu joues chaque
   geste toi-même.
   ====================================================================== */

/* Le niveau de l'adversaire se lit et se change d'ici (S75) : le plateau le lit, l'écran du tournoi le bascule. */
const ctxTable = () => ({
  esc, band: getTeamBand, vive: couleurVive, logo: getTeamLogoHtml, mug: headshotHtml,
  niveau: () => G.niveauTable,
  choisirNiveau: v => { setOption('niveauTable', v); syncOptionsUI(); },
});

/*
 * LES RÈGLES DU PLATEAU DANS LA PAGE DES RÈGLES, depuis la même source que
 * l'écran du match (`reglesDuPlateau`, js/table.js). `CLAUDE.md` a annoncé
 * pendant tout un temps « cinq présences par période » quand le code en
 * jouait six : une règle recopiée est une règle qui ment tôt ou tard.
 */
export function remplirReglesDuPlateau() {
  const hote = $('reglesPlateau');
  if (!hote || hote.dataset.pret) return;
  hote.dataset.pret = '1';
  hote.innerHTML = reglesDuPlateau().map(sec => `
    <h4>${esc(sec.titre)}</h4>
    ${sec.points ? `<ul>${sec.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${sec.rangees ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr>${sec.colonnes.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${sec.rangees.map(r => `<tr>${r.map((v, i) => `<td${i === 0 ? ' class="t-regle-nom"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>` : ''}`).join('');
}

export async function lancerTournoi() {
  applyTeamColors('YOU');
  const mb = $('mainBtn');
  mb.disabled = true;
  mb.textContent = `Tirage des ${CLUBS_TOURNOI - 1} clubs du tournoi…`;
  await new Promise(r => setTimeout(r, 20));
  let rivaux = [];
  try { rivaux = await buildOpponents(CLUBS_TOURNOI - 1); } catch { rivaux = []; }
  if (rivaux.length < CLUBS_TOURNOI - 1) {
    toast('Impossible de réunir assez de clubs pour le tournoi.');
    mb.disabled = false; renderMain();
    return;
  }
  // `G.done` est posé par `afficherTournoi` : un seul endroit ouvre un
  // tournoi, qu'il vienne d'un tirage neuf ou d'une reprise.
  // LA SAISON DE CHAQUE CLUB EST GARDÉE : c'est la moitié de sa clé, et sans
  // elle la reprise n'a aucun moyen de rebâtir les cinq rivaux.
  const clubs = [
    { nom: 'NHL Stars', tag: 'YOU', roster: G.roster },
    ...rivaux.slice(0, CLUBS_TOURNOI - 1).map(t => ({ nom: t.name, tag: t.tag, roster: t.roster, season: t.season })),
  ];
  afficherTournoi(nouveauTournoi(clubs, nouvelleGraine()));
}

/* L'écran du tournoi, d'où qu'il vienne — un tirage neuf ou une reprise. */
function afficherTournoi(T) {
  G.done = true;
  G.tournoi = T;
  applyTeamColors('YOU');
  ouvrirTournoi({
    T, ctx: ctxTable(), onTermine: montrerBilanTournoi,
    // Le tournoi bouge, la sauvegarde suit — comme la journée en saison.
    onAvance: () => saveGame(),
  });
}

/*
 * REPRENDRE UN TOURNOI SUR TABLE. Les cinq rivaux se rebâtissent par leurs
 * clés, exactement comme les 31 clubs d'une ligue (`rebatirAdversaires` rejoue
 * la boucle de `buildOpponents`, même ordre et même `exclude` qui s'accumule),
 * puis `relireTournoi` rejoue les matchs joués à vide et relit les tiens.
 * Rend faux si quoi que ce soit ne se recolle pas : on retombe alors sur
 * l'alignement complet, prêt à repartir, plutôt que sur un tournoi troué.
 */
export async function reprendreTournoi(etat) {
  const rivaux = await rebatirAdversaires(etat.clubs || []);
  if (rivaux.length !== CLUBS_TOURNOI - 1) return false;
  const clubs = [
    { nom: 'NHL Stars', tag: 'YOU', roster: G.roster },
    ...rivaux.map(t => ({ nom: t.name, tag: t.tag, roster: t.roster, season: t.season })),
  ];
  const T = relireTournoi(etat, clubs);
  if (!T) return false;
  afficherTournoi(T);
  return true;
}

/**
 * Le bilan du tournoi : le classement final, les séries, et ce que TES
 * joueurs ont fait sur le plateau. Les fiches se cumulent des feuilles de
 * chaque match — comme `compterFeuilles` le fait pour la saison, en plus
 * petit : un match sur table ne compte que des buts et des passes.
 */
function montrerBilanTournoi(T) {
  const cl = classementTournoi(T);
  const finale = T.series && T.series.rondes[1][0];
  // Ce que les tiens ont fait, cumulé des feuilles de tes matchs.
  const fiches = new Map();
  for (const mt of [...T.journees.flat(), ...(T.series ? T.series.rondes.flat() : [])]) {
    if (!mt.r) continue;
    for (const cote of ['A', 'B']) {
      const idx = cote === 'A' ? mt.a : mt.b;
      if (idx !== 0) continue;
      for (const l of mt.r[cote].marqueurs) {
        const f = fiches.get(l.p) || { p: l.p, b: 0, a: 0 };
        f.b += l.buts; f.a += l.passes;
        fiches.set(l.p, f);
      }
    }
  }
  const meneurs = [...fiches.values()].sort((x, y) => (y.b + y.a) - (x.b + x.a) || y.b - x.b).slice(0, 10);
  const gagne = T.champion === 0;
  $('gameModalTitle').textContent = 'Le tournoi sur table';
  $('gameModalBody').innerHTML = `
    <p class="tr-verdict ${gagne ? 'gagne' : ''}">${gagne
      ? 'Tu remportes le tournoi sur table.'
      : `${esc(T.clubs[T.champion ?? 0].nom)} remporte le tournoi.`}</p>
    ${finale && finale.r ? `<p class="tr-note">Finale : ${esc(T.clubs[finale.a].nom)} ${finale.r.gfA} – ${finale.r.gfB} ${esc(T.clubs[finale.b].nom)}.</p>` : ''}
    <h3 class="tr-jour">Le classement de la saison</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>#</th><th>Club</th><th>PJ</th><th>V</th><th>D</th><th>BP</th><th>BC</th><th>PTS</th></tr></thead>
      <tbody>${cl.map((x, n) => `<tr class="${x.i === 0 ? 'mien' : ''}">
        <td>${n + 1}</td><td>${getTeamLogoHtml(x.c.tag, 18)} ${esc(x.c.nom)}</td>
        <td>${x.f.PJ}</td><td>${x.f.V}</td><td>${x.f.D}</td><td>${x.f.BP}</td><td>${x.f.BC}</td><td><b>${x.f.PTS}</b></td>
      </tr>`).join('')}</tbody></table></div>
    ${meneurs.length ? `<h3 class="tr-jour">Tes meneurs sur le plateau</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Joueur</th><th>B</th><th>A</th><th>PTS</th></tr></thead>
      <tbody>${meneurs.map(f => `<tr><td>${lienJoueur(f.p)}</td><td>${f.b}</td><td>${f.a}</td><td><b>${f.b + f.a}</b></td></tr>`).join('')}</tbody>
    </table></div>` : ''}
    <div class="tr-actions"><button type="button" id="tournoiNouveau" class="btn">Nouvelle partie</button></div>`;
  openModal('gameModal');
  const b = $('tournoiNouveau');
  if (b) b.onclick = () => { closeModal('gameModal'); ouvrirNouvellePartie(); };
  renderMain();
}

/* ======================================================================
   L'EXHIBITION : LE PLATEAU TOUT DE SUITE, SANS REPÊCHAGE
   ======================================================================
   JP : *créer exhibition pour jeu de table pour plus facile de tester ?*.

   Pour toucher le plateau, il fallait bâtir vingt-trois cases, lancer le
   tournoi, puis ouvrir son premier match : dix minutes avant le premier
   geste, sur le mode qu'on retouche le plus. Un match d'exhibition tire deux
   vrais clubs — dans la saison que l'écran « Nouvelle partie » affiche, sinon
   dans les 55 — et ouvre le plateau directement ; ta formation prend la
   place du premier club si elle est complète, parce qu'un alignement qu'on
   vient de bâtir est ce qu'on a le plus envie d'essayer.

   RIEN N'EST ÉCRIT : ni la partie en cours, ni la sauvegarde, ni
   l'historique. C'est une partie de pratique. Le match fini, la feuille sort
   comme au tournoi, puis un mot du résultat offre un autre match — deux
   clubs neufs, ou les mêmes sur d'autres dés — parce que tester, c'est
   rejouer.
   ====================================================================== */

let exhibition = null;        // { epoque, A, B } — le dernier match, pour le rejouer
let exhibitionEnCours = false;

export async function jouerExhibition({ memes = false } = {}) {
  if (exhibitionEnCours) return;
  exhibitionEnCours = true;
  const bouton = $('npExhibition');
  const libelle = bouton ? bouton.textContent : '';
  if (bouton) { bouton.disabled = true; bouton.textContent = 'Tirage des clubs…'; }
  try {
    // La saison est celle que l'ÉCRAN montre tant que le brouillon existe :
    // l'exhibition suit ce qu'on lit, sans rien appliquer à la partie. Le
    // brouillon est jeté à la fermeture, donc « Un autre match » relit la
    // saison mémorisée au premier tirage.
    const epoque = G.brouillon ? G.brouillon.epoque : exhibition ? exhibition.epoque : G.epoque;
    let A, B;
    if (memes && exhibition) ({ A, B } = exhibition);
    else {
      const mienne = slotsLeft() === 0 && capLeft() >= 0;
      const n = mienne ? 1 : 2;
      // Deux saisons de plus dans le sac avant de tirer : `buildOpponents` ne
      // charge que s'il manque des clubs, et au premier match il n'y a que la
      // saison de la roulette — l'exhibition ressortait 1978-79 contre 1978-79
      // à chaque coup. Une saison, c'est une requête, et le cache la garde.
      if (!epoque) for (let i = 0; i < 2; i++) { try { await getShard(rnd(state.index.seasons)); } catch { /* on tire avec ce qu'on a */ } }
      let clubs = [];
      try { clubs = await buildOpponents(n, { epoque, tous: false }); } catch { clubs = []; }
      if (clubs.length < n) { toast('Impossible de réunir deux clubs pour l\'exhibition.', 'bad'); return; }
      const club = t => ({ nom: t.name, tag: t.tag, roster: t.roster });
      A = mienne ? { nom: 'NHL Stars', tag: 'YOU', roster: { ...G.roster } } : club(clubs[0]);
      B = club(clubs[n - 1]);
    }
    exhibition = { epoque, A, B };
    closeModal('partieModal');
    ouvrirTable({
      A: equipeDeTable(A.nom, A.tag, A.roster, 'A'),
      B: equipeDeTable(B.nom, B.tag, B.roster, 'B'),
      graine: nouvelleGraine(), ctx: ctxTable(),
      titre: 'Exhibition', sousTitre: `${A.nom} contre ${B.nom}`,
      onTermine: r => montrerFinExhibition(A, B, r),
    });
  } finally {
    exhibitionEnCours = false;
    if (bouton) { bouton.disabled = false; bouton.textContent = libelle; }
  }
}

/** Le mot du résultat, et la suite : un autre match, les mêmes clubs, ou rien. */
function montrerFinExhibition(A, B, r) {
  if (!r) return;
  const gagneA = gagnantDuMatch(r) === 'A';
  const mienne = A.tag === 'YOU';
  $('gameModalTitle').textContent = 'Match d\'exhibition';
  $('gameModalBody').innerHTML = `
    <p class="tr-verdict ${mienne && gagneA ? 'gagne' : ''}">${getTeamLogoHtml(A.tag, 22)} ${esc(A.nom)} ${r.gfA} – ${r.gfB} ${esc(B.nom)} ${getTeamLogoHtml(B.tag, 22)}${r.fusillade ? ` <i>TB ${r.fusillade.A}-${r.fusillade.B}</i>` : r.prolongation ? ' <i>PROL.</i>' : ''}</p>
    <p class="tr-note">${esc(gagneA ? A.nom : B.nom)} l'emporte${r.fusillade ? ' aux tirs de barrage' : ''}. Rien n'est écrit : la partie en cours et l'historique ne bougent pas.</p>
    <div class="tr-actions">
      <button type="button" id="exhibitionEncore" class="btn">Un autre match</button>
      <button type="button" id="exhibitionMemes" class="btn">Les mêmes clubs</button>
      <button type="button" id="exhibitionFin" class="btn">Fermer</button>
    </div>`;
  openModal('gameModal');
  $('exhibitionEncore').onclick = () => { closeModal('gameModal'); jouerExhibition(); };
  $('exhibitionMemes').onclick = () => { closeModal('gameModal'); jouerExhibition({ memes: true }); };
  $('exhibitionFin').onclick = () => closeModal('gameModal');
}

