/**
 * LE TOURNOI SUR TABLE — la mini-saison et les séries du mode bonus.
 *
 * JP : *viser un modèle à la blood bowl, mais plus rapide, surtout pour genre
 * les séries, ou faire mini saisons et séries qqchose de même là*.
 *
 * Six clubs, cinq matchs de saison (tout le monde une fois), les quatre
 * premiers en séries, demi-finale et finale à match unique. Sept matchs sur
 * table, et c'est fini. C'est l'échelle d'une ligue de Blood Bowl, pas d'une
 * saison de 82 : un tournoi se joue dans une soirée, et c'est le but.
 *
 * UN SEUL JEU DE RÈGLES POUR TOUT LE MONDE. Les matchs que tu ne joues pas —
 * les deux autres qui se disputent la même journée — passent par le MÊME
 * moteur de plateau (`jouerMatchAuto`), joués à vide sous la même graine.
 * Personne n'est résolu par une formule à part, donc le classement veut dire
 * quelque chose : les six clubs jouent au même jeu que toi.
 *
 * L'écran réutilise la coquille `#hubModal` de `js/saison.js` (en-tête, carte,
 * actions, onglets, volet) : c'est le même poste de directeur général, et un
 * joueur qui a déjà vu l'écran de saison n'a rien à réapprendre.
 */

import { equipeDeTable, jouerMatchAuto, resultatDe, gagnantDuMatch } from './table.js';
import { getPlayerKey } from './sim.js';
import { ouvrirTable } from './plateau.js';

export const CLUBS = 6;              // toi et cinq vrais clubs
export const EN_SERIES = 4;

const ordP = n => (n === 1 ? '1re' : `${n}e`);

/**
 * Le calendrier d'un tournoi à six : le cercle de Berger, cinq journées, trois
 * matchs par journée, chacun contre chacun une fois. Ta formation est
 * toujours l'indice 0, donc elle joue chaque journée.
 */
export function calendrierRondRobin(n) {
  const idx = [...Array(n).keys()];
  const journees = [];
  for (let j = 0; j < n - 1; j++) {
    const matchs = [];
    for (let k = 0; k < n / 2; k++) matchs.push([idx[k], idx[n - 1 - k]]);
    journees.push(matchs);
    // On fixe le premier et on fait tourner les autres : le cercle de Berger.
    idx.splice(1, 0, idx.pop());
  }
  return journees;
}

/** La fiche vierge d'un club au classement. */
const ficheVierge = () => ({ V: 0, D: 0, BP: 0, BC: 0, PTS: 0, PJ: 0 });

/**
 * Joue tout le tournoi SAUF tes matchs, qui restent à jouer sur table. Rend
 * la structure ; l'écran la révèle journée par journée.
 */
export function nouveauTournoi(clubs, graine) {
  const journees = calendrierRondRobin(clubs.length).map((matchs, j) =>
    matchs.map(([a, b], k) => ({ a, b, j, k, graine: `${graine}-j${j}-${k}`, r: null })));
  return {
    clubs, graine, journees,
    fiches: clubs.map(ficheVierge),
    jour: 0,
    series: null,
    champion: null,
  };
}

/** Une équipe de plateau à partir d'un club du tournoi. */
const surTable = (club, cote) => equipeDeTable(club.nom, club.tag, club.roster, cote);

/**
 * Joue un match à vide. `compte` dit s'il entre au classement : un match de
 * séries n'y entre PAS, sinon le premier de la saison finissait 7-0 dans un
 * calendrier de cinq matchs et le classement ne voulait plus rien dire.
 */
export function jouerAuto(T, match, compte = true) {
  const A = surTable(T.clubs[match.a], 'A');
  const B = surTable(T.clubs[match.b], 'B');
  match.r = jouerMatchAuto(A, B, match.graine);
  // CE MATCH SE REJOUE : même graine, mêmes clubs, même résultat. C'est ce
  // qui permet à la sauvegarde de ne porter QUE tes matchs (voir la reprise
  // en bas de fichier). Le marquer ici plutôt que de le deviner à la case :
  // « Le laisser se jouer » joue TON match à vide, et rien dans sa position
  // ne le dirait.
  match.auto = true;
  if (compte) inscrire(T, match);
  return match.r;
}

/** Tous les matchs du tournoi, saison et séries : une seule définition. */
export const tousLesMatchs = T => [...T.journees.flat(), ...(T.series ? T.series.rondes.flat() : [])];

export function inscrire(T, match) {
  const fa = T.fiches[match.a], fb = T.fiches[match.b];
  const { gfA, gfB } = match.r;
  fa.PJ++; fb.PJ++;
  fa.BP += gfA; fa.BC += gfB; fb.BP += gfB; fb.BC += gfA;
  // `gagnantDuMatch` et non `gfA > gfB` : un match que douze prolongations
  // n'ont pas départagé se réglait en donnant la victoire à B par accident.
  if (gagnantDuMatch(match.r) === 'A') { fa.V++; fb.D++; } else { fb.V++; fa.D++; }
  fa.PTS = fa.V * 2; fb.PTS = fb.V * 2;
}

/** Le classement : points, puis victoires, puis différentiel. */
export const classement = T => T.clubs.map((c, i) => ({ i, c, f: T.fiches[i] }))
  .sort((x, y) => y.f.PTS - x.f.PTS || y.f.V - x.f.V || (y.f.BP - y.f.BC) - (x.f.BP - x.f.BC) || y.f.BP - x.f.BP);

/**
 * LES MENEURS DU TOURNOI. Le plateau compte marqueurs, passeurs, mises en
 * échec, vols et arrêts à chaque match, et le tournoi ne gardait que six
 * nombres par club : rien ne s'accumulait d'un match à l'autre, donc aucune
 * histoire ne se construisait sur cinq soirées.
 *
 * Le cumul se fait À L'AFFICHAGE, en parcourant les matchs joués, plutôt que
 * dans un compteur tenu à jour : il n'y a alors rien à remettre à zéro, rien
 * à compter deux fois si un match est rejoué, et les séries y entrent
 * naturellement — ce sont les meneurs DU TOURNOI, pas ceux du classement (qui,
 * lui, ignore les séries exprès).
 */
export function meneursDuTournoi(T) {
  const par = new Map();
  const trouver = (club, joueur) => {
    const cle = `${club}|${(joueur && joueur.n) || '?'}`;
    let x = par.get(cle);
    if (!x) { x = { club, nom: (joueur && joueur.n) || 'Rappel', B: 0, A: 0, MÉ: 0, vols: 0, arrets: 0, alloues: 0, gardien: false }; par.set(cle, x); }
    return x;
  };
  const matchs = tousLesMatchs(T);
  for (const mt of matchs) {
    if (!mt.r || mt.a == null) continue;
    for (const [f, club] of [[mt.r.A, mt.a], [mt.r.B, mt.b]]) {
      for (const x of f.marqueurs || []) { const e = trouver(club, x.p); e.B += x.buts; e.A += x.passes; }
      for (const x of f.physique || []) { const e = trouver(club, x.p); e['MÉ'] += x.echecs; e.vols += x.vols; }
      const g = f.gardien;
      if (g && (g.arrets || g.alloues)) { const e = trouver(club, g.p); e.gardien = true; e.arrets += g.arrets; e.alloues += g.alloues; }
    }
  }
  const tous = [...par.values()];
  return {
    pointeurs: tous.filter(x => !x.gardien && (x.B + x.A) > 0).sort((a2, b2) => (b2.B + b2.A) - (a2.B + a2.A) || b2.B - a2.B).slice(0, 10),
    physiques: tous.filter(x => !x.gardien && (x['MÉ'] + x.vols) > 0).sort((a2, b2) => (b2['MÉ'] + b2.vols) - (a2['MÉ'] + a2.vols)).slice(0, 10),
    gardiens: tous.filter(x => x.gardien).sort((a2, b2) => (b2.arrets - b2.alloues) - (a2.arrets - a2.alloues)).slice(0, 10),
    matchs: matchs.filter(mt => mt.r).length,
  };
}

/**
 * Les séries : 1 contre 4, 2 contre 3, puis la finale. Match unique — c'est
 * ce qui rend les séries rapides, et c'est ce qui rend la première place
 * précieuse sans la rendre décisive.
 */
export function ouvrirLesSeries(T) {
  const cl = classement(T).slice(0, EN_SERIES);
  T.series = {
    ronde: 0,
    rondes: [
      [{ a: cl[0].i, b: cl[3].i, graine: `${T.graine}-d0`, r: null },
       { a: cl[1].i, b: cl[2].i, graine: `${T.graine}-d1`, r: null }],
      [{ a: null, b: null, graine: `${T.graine}-f`, r: null }],
    ],
  };
  return T.series;
}

/** Le gagnant d'un match des séries, par indice de club. */
export const gagnantDe = mt => (!mt.r ? null : gagnantDuMatch(mt.r) === 'A' ? mt.a : mt.b);

/** Une fois la demi-finale jouée, la finale connaît ses deux clubs. */
export function composerFinale(T) {
  const demi = T.series.rondes[0];
  if (demi.some(x => !x.r)) return false;
  T.series.rondes[1][0].a = gagnantDe(demi[0]);
  T.series.rondes[1][0].b = gagnantDe(demi[1]);
  return true;
}

/* ======================================================================
   LA REPRISE — ce qui se rejoue, et ce qui ne se rejoue pas
   ======================================================================
   Sept matchs sur table, c'est une soirée : la perdre au premier
   rafraîchissement n'est pas tenable, et c'était le cas.

   La règle du dépôt est « on rejoue plutôt qu'on relit », et elle ne vaut ici
   QU'À MOITIÉ, pour une raison de fond. Les matchs joués À VIDE se rejouent
   exactement — même graine, mêmes clubs, `jouerMatchAuto` est déterministe —
   donc la sauvegarde n'en garde qu'un drapeau. TES matchs, eux, ne se
   rejouent pas : c'est toi qui as pris les décisions, et aucune graine ne les
   redonne. Leur feuille est donc la seule chose que la sauvegarde porte
   vraiment, en forme compacte — les joueurs par CLÉ, puisqu'un objet joueur
   ne traverse pas un JSON, et sans le fil des événements ni les
   modificateurs de tir, que plus rien ne lit une fois le match fini.

   Le BARÈME des séries ne se sauve pas non plus : `ouvrirLesSeries` le
   dérive du classement, et le classement est reconstruit à l'identique.
   Recopier le tableau dans la sauvegarde serait une deuxième définition de la
   même règle, donc une qui dérive.

   ET SI UNE SEULE CLÉ NE SE RETROUVE PAS, la reprise est refusée en entier :
   un tournoi dont les meneurs ont des trous ment plus qu'il ne sauve. On
   retombe alors sur l'ancien comportement — l'alignement complet, prêt à
   repartir — qui est honnête.
   ====================================================================== */

/** La clé d'un match dans la sauvegarde : le suffixe de sa graine, déjà unique et stable. */
const cleDeMatch = (T, mt) => String(mt.graine).slice(String(T.graine).length + 1);

const compacterCote = f => ({
  nom: f.nom, tag: f.tag, buts: f.buts, tirs: f.tirs,
  revirements: f.revirements, echecs: f.echecs, punitions: f.punitions,
  marqueurs: (f.marqueurs || []).map(x => ({ k: getPlayerKey(x.p), b: x.buts, a: x.passes })),
  physique: (f.physique || []).map(x => ({ k: getPlayerKey(x.p), e: x.echecs, v: x.vols, p: x.punitions })),
  gardien: f.gardien && f.gardien.p
    ? { k: getPlayerKey(f.gardien.p), arrets: f.gardien.arrets, alloues: f.gardien.alloues }
    : null,
});

/** Ce que la sauvegarde emporte d'un tournoi en cours. */
export function etatDuTournoi(T) {
  if (!T) return null;
  const matchs = {};
  for (const mt of tousLesMatchs(T)) {
    if (!mt.r || mt.a == null) continue;
    matchs[cleDeMatch(T, mt)] = mt.auto ? 1 : {
      gfA: mt.r.gfA, gfB: mt.r.gfB,
      prolongation: !!mt.r.prolongation, nul: !!mt.r.nul,
      vainqueur: mt.r.vainqueur || null, fusillade: mt.r.fusillade || null,
      A: compacterCote(mt.r.A), B: compacterCote(mt.r.B),
    };
  }
  return {
    graine: T.graine,
    jour: T.jour,
    champion: T.champion,
    ronde: T.series ? T.series.ronde : 0,
    matchs,
  };
}

/**
 * Rebâtit un tournoi depuis sa sauvegarde et ses clubs (l'ordre compte : le
 * tien est l'indice 0). Rend `null` si quoi que ce soit ne se recolle pas.
 */
export function relireTournoi(etat, clubs) {
  if (!etat || !etat.graine || !Array.isArray(clubs) || clubs.length !== CLUBS) return null;
  const T = nouveauTournoi(clubs, etat.graine);
  // La table clé -> joueur de chaque club : c'est elle qui rend leurs objets
  // aux feuilles, et son échec qui refuse la reprise.
  const parCle = clubs.map(c => {
    const m = new Map();
    for (const p of Object.values((c && c.roster) || {})) if (p) m.set(getPlayerKey(p), p);
    return m;
  });
  let brise = false;
  const joueur = (club, k) => {
    const p = parCle[club] && parCle[club].get(k);
    if (!p) brise = true;
    return p || null;
  };
  const relireCote = (f, club) => ({
    nom: f.nom, tag: f.tag, buts: f.buts, tirs: f.tirs,
    revirements: f.revirements, echecs: f.echecs, punitions: f.punitions,
    modsTir: [],
    marqueurs: (f.marqueurs || []).map(x => ({ p: joueur(club, x.k), buts: x.b, passes: x.a })),
    physique: (f.physique || []).map(x => ({ p: joueur(club, x.k), echecs: x.e, vols: x.v, punitions: x.p })),
    gardien: f.gardien
      ? { p: joueur(club, f.gardien.k), arrets: f.gardien.arrets, alloues: f.gardien.alloues }
      : { p: null, arrets: 0, alloues: 0 },
  });
  /* Remet un match en place : rejoué s'il l'a été à vide, relu s'il est de toi. */
  const poser = (mt, compte) => {
    const v = etat.matchs && etat.matchs[cleDeMatch(T, mt)];
    if (!v) return;
    if (v === 1) { jouerAuto(T, mt, compte); return; }
    mt.r = {
      A: relireCote(v.A, mt.a), B: relireCote(v.B, mt.b),
      gfA: v.gfA, gfB: v.gfB,
      prolongation: !!v.prolongation, nul: !!v.nul,
      vainqueur: v.vainqueur || null, fusillade: v.fusillade || null,
      fil: [], graine: mt.graine,
    };
    mt.auto = false;
    if (compte) inscrire(T, mt);
  };

  for (const mt of T.journees.flat()) poser(mt, true);
  T.jour = Math.max(0, Math.min(etat.jour || 0, T.journees.length));
  // LE BARÈME SE DÉRIVE DU CLASSEMENT, il ne se relit pas : même condition
  // que `finirJournee`, donc la même façon d'ouvrir les séries.
  if (T.jour >= T.journees.length) {
    ouvrirLesSeries(T);
    for (const mt of T.series.rondes[0]) poser(mt, false);
    if (T.series.rondes[0].every(x => x.r)) {
      composerFinale(T);
      poser(T.series.rondes[1][0], false);
    }
    T.series.ronde = Math.max(0, Math.min(etat.ronde || 0, T.series.rondes.length - 1));
  }
  T.champion = Number.isInteger(etat.champion) ? etat.champion : null;
  return brise ? null : T;
}

/* ======================================================================
   L'ÉCRAN
   ====================================================================== */

function coquille(label) {
  const modal = document.getElementById('hubModal');
  if (!modal) return null;
  const $ = s => modal.querySelector(s);
  const sheet = $('.hub-sheet');
  if (sheet) sheet.setAttribute('aria-label', label);
  return { modal, head: $('.hub-head'), carte: $('.hub-carte'), actions: $('.hub-actions'), barre: $('.hub-onglets'), volet: $('.hub-volet'), close: $('.hub-close') };
}

/**
 * L'écran du tournoi. `toi` est l'indice de ta formation (toujours 0) ;
 * `onTermine(T)` reçoit le tournoi fini, pour le bilan ; `onAvance(T)` est
 * appelé chaque fois que le tournoi bouge, pour la sauvegarde.
 */
export function ouvrirTournoi({ T, ctx, onTermine, onAvance = null }) {
  const ui = coquille('Le tournoi sur table');
  if (!ui) { onTermine(T); return; }
  const { modal, head, carte, actions, barre, volet, close } = ui;
  const { esc, logo } = ctx;
  const MOI = 0;
  let onglet = 'journee';

  const nomDe = i => T.clubs[i].nom;
  const monMatch = () => (T.series ? matchSerieMien() : (T.journees[T.jour] || []).find(x => x.a === MOI || x.b === MOI));
  const matchSerieMien = () => {
    const r = T.series.rondes[T.series.ronde];
    return r ? r.find(x => (x.a === MOI || x.b === MOI) && !x.r) : null;
  };

  /* ---------- la tête ---------- */
  function dessinerTete() {
    const cl = classement(T);
    const rang = cl.findIndex(x => x.i === MOI) + 1;
    const f = T.fiches[MOI];
    head.innerHTML = `
      <div class="hub-titre">Tournoi sur table</div>
      <div class="hub-sous">${T.series
        ? (T.champion != null ? `Champion : ${esc(nomDe(T.champion))}` : `Séries — ${T.series.ronde === 0 ? 'demi-finales' : 'finale'}`)
        : `Journée ${Math.min(T.jour + 1, T.journees.length)} sur ${T.journees.length} · ${f.V}-${f.D} · ${rang}<sup>${rang === 1 ? 're' : 'e'}</sup> place`}</div>`;
  }

  /* ---------- la carte du prochain match ---------- */
  function dessinerCarte() {
    const mt = monMatch();
    if (T.champion != null) {
      const gagne = T.champion === MOI;
      carte.innerHTML = `<div class="hub-carte-fin ${gagne ? 'gagne' : ''}">
        <div class="hub-gros">${gagne ? 'Le tournoi est à toi.' : `${esc(nomDe(T.champion))} remporte le tournoi.`}</div>
      </div>`;
      return;
    }
    if (!mt) { carte.innerHTML = `<div class="hub-carte-fin"><div class="hub-gros">Ton tournoi est fini.</div></div>`; return; }
    const adv = mt.a === MOI ? mt.b : mt.a;
    const quoi = T.series ? (T.series.ronde === 0 ? 'Demi-finale' : 'Finale') : `Journée ${mt.j + 1}`;
    carte.innerHTML = `
      <div class="hub-prochain">
        <div class="hub-quoi">${esc(quoi)}</div>
        <div class="hub-duel">
          <span class="hub-club">${logo(T.clubs[MOI].tag, 26)} ${esc(nomDe(MOI))}</span>
          <span class="hub-vs">contre</span>
          <span class="hub-club">${logo(T.clubs[adv].tag, 26)} ${esc(nomDe(adv))}</span>
        </div>
      </div>`;
  }

  /* ---------- les actions ---------- */
  function dessinerActions() {
    if (T.champion != null) {
      actions.innerHTML = '<button type="button" class="hub-suite">Voir le bilan du tournoi</button>';
      return;
    }
    const mt = monMatch();
    actions.innerHTML = mt
      ? `<button type="button" class="hub-jouer">Jouer le match sur table</button>
         <button type="button" class="hub-sauter">Le laisser se jouer</button>`
      : '<button type="button" class="hub-suite">Voir le bilan du tournoi</button>';
  }

  /* ---------- les volets ---------- */
  const ONGLETS = () => (T.series
    ? [{ cle: 'series', titre: 'Séries' }, { cle: 'classement', titre: 'Saison' }, { cle: 'meneurs', titre: 'Meneurs' }, { cle: 'clubs', titre: 'Les clubs' }]
    : [{ cle: 'journee', titre: 'La journée' }, { cle: 'classement', titre: 'Classement' }, { cle: 'meneurs', titre: 'Meneurs' }, { cle: 'clubs', titre: 'Les clubs' }]);

  function dessinerBarre() {
    const liste = ONGLETS();
    if (!liste.some(o => o.cle === onglet)) onglet = liste[0].cle;
    barre.innerHTML = liste.map(o => `<button type="button" data-onglet="${o.cle}" class="${o.cle === onglet ? 'on' : ''}">${o.titre}</button>`).join('');
  }

  const ligneMatch = mt => {
    const fini = !!mt.r;
    const gagnantA = fini && mt.r.gfA > mt.r.gfB;
    return `<div class="tr-match ${mt.a === MOI || mt.b === MOI ? 'mien' : ''}">
      <span class="tr-c ${fini && gagnantA ? 'gagne' : ''}">${logo(T.clubs[mt.a].tag, 18)} ${esc(nomDe(mt.a))}</span>
      <span class="tr-p">${fini ? `${mt.r.gfA} – ${mt.r.gfB}` : '—'}${fini && mt.r.prolongation ? '<i>PROL.</i>' : ''}</span>
      <span class="tr-c ${fini && !gagnantA ? 'gagne' : ''}">${esc(nomDe(mt.b))} ${logo(T.clubs[mt.b].tag, 18)}</span>
    </div>`;
  };

  function dessinerVolet() {
    if (onglet === 'journee') {
      const j = Math.min(T.jour, T.journees.length - 1);
      volet.innerHTML = T.journees.slice(0, T.jour + 1).reverse().map((matchs, n) => `
        <h3 class="tr-jour">Journée ${T.journees.length - (T.journees.length - 1 - (T.jour - n))}</h3>
        ${matchs.map(ligneMatch).join('')}`).join('');
      if (!T.jour && !T.journees[0][0].r) volet.innerHTML = `<h3 class="tr-jour">Journée 1</h3>${T.journees[0].map(ligneMatch).join('')}`;
      return;
    }
    if (onglet === 'classement') {
      volet.innerHTML = `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>#</th><th>Club</th><th>PJ</th><th>V</th><th>D</th><th>BP</th><th>BC</th><th>PTS</th></tr></thead>
        <tbody>${classement(T).map((x, n) => `<tr class="${x.i === MOI ? 'mien' : ''} ${n === EN_SERIES - 1 ? 'coupure' : ''}">
          <td>${n + 1}</td><td>${logo(x.c.tag, 18)} ${esc(x.c.nom)}</td>
          <td>${x.f.PJ}</td><td>${x.f.V}</td><td>${x.f.D}</td><td>${x.f.BP}</td><td>${x.f.BC}</td><td><b>${x.f.PTS}</b></td>
        </tr>`).join('')}</tbody></table></div>
        <p class="tr-note">Les quatre premiers passent en séries.</p>`;
      return;
    }
    if (onglet === 'series') {
      volet.innerHTML = T.series.rondes.map((r, n) => `
        <h3 class="tr-jour">${n === 0 ? 'Demi-finales' : 'Finale'}</h3>
        ${r.map(mt => (mt.a == null ? '<div class="tr-match tr-attente">À venir</div>' : ligneMatch(mt))).join('')}`).join('');
      return;
    }
    if (onglet === 'meneurs') {
      const M = meneursDuTournoi(T);
      const table = (titre, liste, cols, vals) => (liste.length ? `
        <h3 class="tr-jour">${titre}</h3>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>#</th><th>Joueur</th><th>Club</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${liste.map((x, n) => `<tr class="${x.club === MOI ? 'mien' : ''}">
            <td>${n + 1}</td><td>${esc(x.nom)}</td><td>${logo(T.clubs[x.club].tag, 16)} ${esc(T.clubs[x.club].tag)}</td>
            ${vals(x).map(v => `<td>${v}</td>`).join('')}
          </tr>`).join('')}</tbody></table></div>` : '');
      volet.innerHTML = M.matchs
        ? table('Pointeurs', M.pointeurs, ['B', 'A', 'PTS'], x => [x.B, x.A, `<b>${x.B + x.A}</b>`])
          + table('Sans la rondelle', M.physiques, ['MÉ', 'Vols'], x => [x['MÉ'], x.vols])
          + table('Gardiens', M.gardiens, ['ARR', 'BA'], x => [`<b>${x.arrets}</b>`, x.alloues])
          + `<p class="tr-note">Cumulé sur les ${M.matchs} match${M.matchs > 1 ? 's' : ''} joués, séries comprises.</p>`
        : '<p class="tr-note">Aucun match joué pour l\'instant.</p>';
      return;
    }
    // Les clubs : ce que chacun aligne sur le plateau.
    volet.innerHTML = T.clubs.map((c, i) => `
      <h3 class="tr-jour">${logo(c.tag, 20)} ${esc(c.nom)}${i === MOI ? ' · ta formation' : ''}</h3>
      <div class="tr-club">${T.fiches[i].V}-${T.fiches[i].D}, ${T.fiches[i].BP} buts pour, ${T.fiches[i].BC} contre.</div>`).join('');
  }

  function rendre() {
    // LA SAUVEGARDE SUIT LE RENDU, et c'est le seul endroit qui l'appelle :
    // rien ne bouge dans un tournoi sans redessiner, alors que semer l'appel
    // dans `finirJournee`, `finirRonde` et la fin d'un match sur table ferait
    // trois endroits à ne pas oublier au prochain bouton.
    if (onAvance) onAvance(T);
    dessinerTete(); dessinerCarte(); dessinerActions(); dessinerBarre(); dessinerVolet();
  }

  /* ---------- avancer ---------- */

  /** Joue les matchs de la journée que tu ne joues pas, puis passe à la suite. */
  function finirJournee() {
    for (const mt of T.journees[T.jour]) if (!mt.r) jouerAuto(T, mt);
    T.jour++;
    if (T.jour >= T.journees.length) { ouvrirLesSeries(T); }
    rendre();
  }

  function finirRonde() {
    const r = T.series.rondes[T.series.ronde];
    for (const mt of r) if (!mt.r) jouerAuto(T, mt, false);
    if (T.series.ronde === 0) { composerFinale(T); T.series.ronde = 1; }
    else T.champion = gagnantDe(r[0]);
    rendre();
  }

  /** Le match joué sur table, puis la suite de la journée ou de la ronde. */
  function jouerLeMien(mt) {
    // Tu joues TOUJOURS du côté A : tu attaques vers le haut, à toutes les
    // périodes. Un plateau qui se retourne, c'est un joueur qui se trompe de
    // filet à la deuxième.
    const advI = mt.a === MOI ? mt.b : mt.a;
    const A = surTable(T.clubs[MOI], 'A');
    const B = surTable(T.clubs[advI], 'B');
    const serie = !!T.series;
    ouvrirTable({
      A, B, graine: mt.graine, ctx,
      titre: serie ? (T.series.ronde === 0 ? 'Demi-finale' : 'Finale') : `Journée ${mt.j + 1}`,
      sousTitre: `${T.clubs[MOI].nom} contre ${T.clubs[advI].nom}`,
      onTermine: r => {
        // La feuille est écrite du point de vue du plateau (A = toi) ; le
        // tournoi, lui, range les clubs dans l'ordre du calendrier.
        mt.r = mt.a === MOI ? r : { ...r, A: r.B, B: r.A, gfA: r.gfB, gfB: r.gfA };
        if (!serie) inscrire(T, mt);
        if (serie) finirRonde(); else finirJournee();
      },
    });
  }

  /* ---------- les clics ---------- */
  const clic = ev => {
    const t = ev.target;
    const o = t.closest('[data-onglet]');
    if (o) { onglet = o.dataset.onglet; rendre(); return; }
    if (t.closest('.hub-jouer')) { const mt = monMatch(); if (mt) jouerLeMien(mt); return; }
    if (t.closest('.hub-sauter')) {
      const mt = monMatch();
      if (mt) { jouerAuto(T, mt, !T.series); if (T.series) finirRonde(); else finirJournee(); }
      return;
    }
    if (t.closest('.hub-suite') || t.closest('.hub-close')) { fermer(); }
  };
  modal.addEventListener('click', clic);

  function fermer() {
    // Fermer, c'est jouer le reste : le tournoi va au bout, comme une saison.
    let garde = 0;
    while (T.champion == null && garde++ < 40) {
      if (!T.series) finirJournee(); else finirRonde();
    }
    // Fermer ne redessine pas : c'est le seul chemin que `rendre` ne couvre pas.
    if (onAvance) onAvance(T);
    modal.removeEventListener('click', clic);
    modal.style.display = 'none';
    document.body.style.overflow = '';
    onTermine(T);
  }

  if (close) close.setAttribute('aria-label', 'Laisser jouer le reste du tournoi');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  rendre();
}
