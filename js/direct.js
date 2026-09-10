/**
 * UN MATCH EN DIRECT.
 *
 * Le moteur a déjà joué chaque match lancer par lancer et gardé sa feuille
 * (`playGame`, js/sim.js). Ce module ne décide de rien : il REJOUE la
 * feuille dans le temps, un événement à la fois, pour que le résultat se
 * découvre comme à la télé plutôt que d'un coup dans un tableau. Le mystère
 * tient à une seule chose : on ne montre rien avant que l'horloge y arrive.
 *
 * On n'y entre plus d'office. L'écran de saison et l'écran des séries
 * (js/saison.js) proposent « Regarder le match » pour le prochain match de
 * ta formation ; le reste de la journée ou de la ronde se lit en tableau.
 * Un seul match à la fois, saison ou séries, c'est la même diffusion.
 *
 * Ce que la feuille porte : les buts avec leur instant, leur marqueur, leurs
 * passeurs et le gardien battu ; chaque lancer, daté, avec son tireur et le
 * gardien ; les punitions. Une feuille plus ancienne (partie sauvegardée)
 * n'a que les comptes de tirs par période, et on date les arrêts nous-mêmes,
 * au hasard dans leur période et de façon DÉTERMINISTE (graine sur le
 * match) : rejouer un match redonne la même diffusion.
 *
 * Le module est aveugle aux données du jeu : il reçoit dans `ctx` les
 * fonctions d'affichage de js/game.js (noms, écussons, échappement).
 */

import { periodeDe } from './sim.js';
import { recitDeBut, tempsRestant, NOM_PERIODE } from './recit.js';

/*
 * L'HORLOGE DESCEND. Un tableau indicateur de hockey compte à rebours,
 * 20:00 vers 0:00, et le fil du direct dit le temps qu'il restait quand le
 * but est entré — c'est ce qu'on voit à la télé. La feuille officielle du
 * sommaire, elle, garde le temps écoulé (js/bilan.js) : les deux conventions
 * existent dans la vraie ligue, chacune à sa place.
 */
const tempsDeJeu = tempsRestant;

/* Une graine, un générateur : mulberry32, assez pour des instants de tirs. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VITESSES = [0.5, 1, 2, 4, 8];  // minutes de jeu par seconde réelle
const ETIQ_VITESSE = { 0.5: '×½', 1: '×1', 2: '×2', 4: '×4', 8: '×8' };
const CLE_VITESSE = 'cap82_direct_vitesse';
const PAUSE_BUT = 1400;              // ms : l'horloge s'arrête sur un but
const PAUSE_PERIODE = 1100;          // ms : entre deux périodes

/* « ta formation » en tête de phrase devient « Ta formation ». */
const cap = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
/* Le nom d'un joueur, en texte brut : le fil est du texte, pas des cartes. */
const nom = p => (p && p.n) || '';
const famille = p => nom(p).split(' ').slice(-1)[0];
/* « 1er », « 12e » : le rang d'un but ou d'une passe dans les séries ou la saison. */
const ord = n => (n === 1 ? '1er' : `${n}e`);
const ordF = n => (n === 1 ? '1re' : `${n}e`);   // « 1re passe »

/*
 * LES ONGLETS DE LA PAUSE. Le direct n'a qu'un fil ; en pause, une barre
 * d'onglets s'ouvre au-dessus et laisse lire autre chose que le fil — les
 * statistiques du match à cet instant. `rendre` fabrique le contenu d'un
 * onglet au moment où on l'ouvre, et le fil revient dès qu'on reprend.
 */
function ongletsDePause(modal, onglets, rendre) {
  const barre = modal.querySelector('.live-onglets'), stats = modal.querySelector('.live-stats'), feed = modal.querySelector('.live-feed'), etat = modal.querySelector('.live-etat');
  if (!barre || !stats) return { ouvrir() {}, fermer() {}, rafraichir() {} };
  let courant = onglets[0].cle;
  const montrer = cle => {
    courant = cle;
    barre.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.onglet === cle));
    const fil = cle === onglets[0].cle;
    feed.hidden = !fil;
    stats.hidden = fil;
    if (etat) etat.hidden = !fil;
    if (!fil) stats.innerHTML = rendre(cle);
  };
  return {
    ouvrir() {
      barre.innerHTML = onglets.map(o => `<button type="button" data-onglet="${o.cle}" class="${o.cle === courant ? 'on' : ''}">${o.titre}</button>`).join('');
      barre.querySelectorAll('button').forEach(b => { b.onclick = () => montrer(b.dataset.onglet); });
      barre.hidden = false;
      montrer(courant);
    },
    fermer() {
      barre.hidden = true;
      feed.hidden = false;
      stats.hidden = true;
      if (etat) etat.hidden = false;
      stats.innerHTML = '';
      courant = onglets[0].cle;
    },
    rafraichir() { if (!stats.hidden) stats.innerHTML = rendre(courant); },
  };
}

/**
 * Les événements d'un match, dans l'ordre du temps : les buts de la feuille,
 * les arrêts qu'on date, les fins de période. Le dernier événement est la
 * fin du match, à 60:00 ou sur le but de prolongation.
 */
function evenementsDuMatch(f, graine) {
  const alea = rng(graine);
  const ev = [];
  const finOT = f.ot ? Math.max(...f.buts.filter(b => b.instant >= 60).map(b => b.instant), 60.5) : 0;
  // Le journal moderne date chaque lancer et nomme le tireur : on le prend.
  // Une feuille plus ancienne (partie sauvegardée) n'a que les comptes par
  // période, et on date les arrêts nous-mêmes.
  if (f.lancers && f.lancers.length) {
    for (const l of f.lancers) if (!l.but) ev.push({ type: 'arret', cote: l.cote, instant: l.instant, tireur: l.tireur, gardien: l.gardien });
  } else for (const cote of ['A', 'B']) {
    for (let per = 1; per <= 4; per++) {
      const buts = f.buts.filter(b => b.cote === cote && periodeDe(b.instant) === per).length;
      const arrets = Math.max(0, (f.tirs[cote][per] || 0) - buts);
      const debut = (per - 1) * 20;
      const duree = per === 4 ? Math.max(0.2, finOT - 60 - 0.05) : 20;
      for (let i = 0; i < arrets; i++) {
        ev.push({ type: 'arret', cote, instant: debut + alea() * duree });
      }
    }
  }
  for (const b of f.buts) ev.push({ type: 'but', cote: b.cote, instant: b.instant, but: b });
  for (const x of (f.punitions || [])) {
    ev.push({ type: 'punition', cote: x.cote, instant: x.instant, joueur: x.joueur, minutes: x.minutes });
    // La fin de la mineure, quand elle est allée au bout : le puni revient.
    // Fermée par un but, c'est le but qui le dit. Une feuille d'avant
    // (sans `fin`) se contente des deux minutes.
    const fin = x.fin ?? (x.instant + x.minutes);
    if (!x.butAN && fin < 60) ev.push({ type: 'finPunition', cote: x.cote, instant: fin + 1e-4, joueur: x.joueur });
  }
  for (let per = 1; per <= 3; per++) ev.push({ type: 'periode', per, instant: per * 20 - 1e-6 });
  ev.push({ type: 'fin', instant: f.ot ? finOT + 1e-6 : 60 });
  ev.sort((x, y) => x.instant - y.instant);
  return ev;
}

/** Les victoires d'une série, en pastilles : ●●○○ contre ●○○○. */
export const pastilles = w => `<span class="live-pastilles">${'●'.repeat(w)}${'○'.repeat(Math.max(0, 4 - w))}</span>`;

/**
 * Diffuse UN match, puis appelle `onTermine` quand on continue (ou qu'on
 * ferme le direct : ce qui n'a pas été regardé est joué d'un coup, rien
 * n'est perdu).
 *
 *   feuille    la feuille du match (buts, lancers, punitions, gardiens)
 *   A, B       les deux équipes, dans l'ordre de la feuille
 *   titre      « Premier tour », « Saison régulière »
 *   sousTitre  « Match 3 », « Journée 12 »
 *   etat       la ligne d'état : « NHL Stars mène 2-1 », « 3-3-0 · 16e »
 *   tally      { wA, wB } pour les pastilles d'une série, sinon rien
 *   graine     un entier : les arrêts d'une feuille sans lancers se datent dessus
 *   avant      le compte des feuilles d'avant (compterFeuilles), pour « (12e but) »
 *   apres      un mot sur ce qui vient après (« La série se poursuit. »), facultatif
 *   ctx        { esc, teamLabel, teamShort, tagCourt, logo, band, mug }
 */
export function diffuserMatch({ feuille: f, A, B, titre = '', sousTitre = '', etat: etatTexte = '', tally = null, graine = 1, avant = new Map(), apres = '', ctx, onTermine }) {
  const modal = document.getElementById('liveModal');
  if (!modal || !f) { onTermine(); return; }
  const $ = id => modal.querySelector(id);
  const head = $('.live-head'), board = $('.live-board'), feed = $('.live-feed'),
    controls = $('.live-controls'), etat = $('.live-etat');

  let vitesse = Number(localStorage.getItem(CLE_VITESSE)) || 2;
  if (!VITESSES.includes(vitesse)) vitesse = 2;

  let timer = null, termine = false, enPause = false, fini = false;
  const stop = () => { if (timer) { cancelAnimationFrame(timer); timer = null; } };
  const onglets = ongletsDePause(modal, [{ cle: 'fil', titre: 'Fil' }, { cle: 'stats', titre: 'Statistiques du match' }], () => statsDuMatch());
  const fermer = () => {
    if (termine) return;
    termine = true;
    stop();
    onglets.fermer();
    window.removeEventListener('keydown', clavier);
    modal.style.display = 'none';
    modal.classList.remove('en-pause');
    document.body.style.overflow = '';
    onTermine();
  };
  $('.live-close').onclick = fermer;
  // La barre d'espace met en pause et repart, comme un lecteur vidéo.
  const clavier = ev => {
    if (ev.key !== ' ' || ev.target.closest('input, textarea, select')) return;
    if (!controls.querySelector('.live-pause')) return;
    ev.preventDefault();
    pauser(!enPause);
  };
  window.addEventListener('keydown', clavier);

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const boutons = html => { controls.innerHTML = html; };
  const ligne = (cls, html, style = '') => {
    const el = document.createElement('div');
    el.className = `live-ligne ${cls}`;
    if (style) el.setAttribute('style', style);
    el.innerHTML = html;
    feed.prepend(el);
  };

  const equipe = cote => (cote === 'A' ? A : B);
  const gardien = cote => (cote === 'A' ? f.gardienB : f.gardienA);   // le gardien qui FAIT face au tir
  /* Les couleurs de l'équipe qui tire, posées sur la ligne du fil. */
  const couleurs = cote => { const b = ctx.band(equipe(cote).tag); return `--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}`; };

  /* Le tableau indicateur : deux équipes, le pointage, l'horloge. */
  function dessinerBoard(gA, gB, h) {
    const cote = (t, buts, pos) => {
      const b = ctx.band(t.tag);
      return `<div class="live-eq ${pos}" style="--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
        <div class="live-eq-band">${ctx.logo(t.tag, 22)}<span>${ctx.esc(ctx.tagCourt(t))}</span></div>
        <div class="live-eq-nom">${ctx.esc(ctx.teamLabel(t))}</div>
        <div class="live-eq-buts" data-cote="${pos === 'a' ? 'A' : 'B'}">${buts}</div>
      </div>`;
    };
    board.innerHTML = `${cote(A, gA, 'a')}
      <div class="live-horloge"><span class="live-per">${h.per}</span><span class="live-temps">${h.temps}</span><span class="live-tirs">${h.tirs}</span><span class="live-situation">${h.situation || ''}</span></div>
      ${cote(B, gB, 'b')}`;
  }

  const ev = evenementsDuMatch(f, graine);
  let iEv = 0, t = 0, gA = 0, gB = 0, tA = 0, tB = 0, pause = 0, dernier = performance.now();
  // LE XIÈME BUT. Le compte d'avant ce match, cloné : chaque but l'avance,
  // et le fil dit « (12e but) », « (8e passe) ». L'écran qui nous a appelés
  // garde le sien intact et cumule la feuille lui-même après.
  const compte = new Map([...avant].map(([p, c]) => [p, { ...c }]));
  const avancer = (p, cle) => { let c = compte.get(p); if (!c) { c = { g: 0, a: 0, pts: 0 }; compte.set(p, c); } c[cle]++; return c[cle]; };
  /* Les statistiques du match, tenues au fil des événements. */
  const st = { tirs: { A: [0, 0, 0, 0, 0], B: [0, 0, 0, 0, 0] }, buts: [], arrets: { A: 0, B: 0 }, pun: { A: 0, B: 0 }, anOcc: { A: 0, B: 0 }, anButs: { A: 0, B: 0 } };
  /* Les fenêtres d'avantage : [début, fin, côté qui en profite]. La fin est
     celle que le moteur a jouée (la mineure entière, ou le but en avantage
     qui l'a fermée) ; une feuille d'avant la retrouve par le but. */
  const fenetres = (f.punitions || []).map(x => {
    const profite = x.cote === 'A' ? 'B' : 'A';
    if (x.fin != null) return [x.instant, x.fin, profite];
    const but = f.buts.find(b => b.an && b.cote === profite && b.instant >= x.instant && b.instant <= x.instant + x.minutes);
    return [x.instant, but ? but.instant : x.instant + x.minutes, profite];
  });

  head.innerHTML = `<span class="live-ronde">${ctx.esc(titre)}</span>
    <span class="live-match">${ctx.esc(sousTitre)}</span>
    <span class="live-serie">${ctx.esc(cap(etatTexte))}</span>
    ${tally ? `<span class="live-tally">${pastilles(tally.wA)} <span class="live-tally-sep">${ctx.esc(ctx.tagCourt(A))} · ${ctx.esc(ctx.tagCourt(B))}</span> ${pastilles(tally.wB)}</span>` : ''}`;
  feed.innerHTML = '';
  etat.innerHTML = '';
  ligne('debut', `Mise au jeu. ${ctx.esc(cap(ctx.teamShort(A)))} contre ${ctx.esc(ctx.teamShort(B))}${titre ? `, ${ctx.esc(titre.toLowerCase())}` : ''}${sousTitre ? `, ${ctx.esc(sousTitre.toLowerCase())}` : ''}.`);

  const statsDuMatch = () => {
    const per = [1, 2, 3, 4].filter(k => k < 4 || st.tirs.A[4] + st.tirs.B[4] > 0);
    const rangee = (lib, fa, fb) => `<tr><th>${lib}</th><td>${fa}</td><td>${fb}</td></tr>`;
    const gA_ = f.gardienA, gB_ = f.gardienB;
    return `<div class="live-tableau"><div class="live-tableau-titre">Statistiques du match · ${ctx.esc(tempsDeJeu(Math.min(t, 64.999)))}</div>
      <table class="live-face"><thead><tr><th></th><th>${ctx.esc(ctx.tagCourt(A))}</th><th>${ctx.esc(ctx.tagCourt(B))}</th></tr></thead><tbody>
        ${rangee('Buts', gA, gB)}
        ${rangee('Tirs', tA, tB)}
        ${per.map(k => rangee(`Tirs, ${NOM_PERIODE[k]}`, st.tirs.A[k], st.tirs.B[k])).join('')}
        ${rangee('Punitions', st.pun.A, st.pun.B)}
        ${rangee('Avantage numérique', `${st.anButs.A} / ${st.anOcc.A}`, `${st.anButs.B} / ${st.anOcc.B}`)}
        ${rangee('Arrêts', gA_ ? `${ctx.esc(famille(gA_))} ${st.arrets.A} / ${st.arrets.A + gB}` : '—', gB_ ? `${ctx.esc(famille(gB_))} ${st.arrets.B} / ${st.arrets.B + gA}` : '—')}
      </tbody></table></div>
      ${st.buts.length ? `<div class="live-tableau"><div class="live-tableau-titre">Les buts</div>${st.buts.map(x => `<div class="live-but-ligne"><span class="live-tps">${tempsDeJeu(x.instant)}</span>${ctx.logo(equipe(x.cote).tag, 13)}<span><b>${ctx.esc(nom(x.marqueur))}</b> (${ord(x.nG)} but)${x.aides.length ? `, ${x.aides.map(a => `${ctx.esc(nom(a.p))} (${ordF(a.n)} passe)`).join(', ')}` : ''}${x.an ? ' · AN' : x.dn ? ' · DN' : ''} <span class="live-score">${x.score}</span></span></div>`).join('')}</div>` : ''}`;
  };

  const horloge = () => {
    // Sans prolongation, 60:00 est la fin de la 3e période (0:00 au
    // tableau), pas le début de la 4e.
    const enOT = f.ot && t >= 60;
    const per = enOT ? 4 : t >= 60 ? 3 : periodeDe(t);
    const temps = !enOT && t >= 60 ? '00:00' : tempsDeJeu(Math.min(t, 64.999));
    // L'avantage en cours : la fenêtre de deux minutes d'une punition, ou
    // moins si un but l'a fermée — c'est le tableau indicateur qui le dit.
    const an = fenetres.find(([a, b]) => t >= a && t < b);
    return { per: per === 4 ? 'PROL.' : `${per}${per === 1 ? 're' : 'e'} PÉR.`, temps, tirs: `${tA} – ${tB} tirs`,
      situation: an ? `AN ${ctx.tagCourt(equipe(an[2]))} · ${Math.max(0, Math.ceil((an[1] - t) * 60 / 5) * 5)} s` : '' };
  };
  dessinerBoard(gA, gB, horloge());

  const majBoard = () => {
    const h = horloge();
    board.querySelector('.live-per').textContent = h.per;
    board.querySelector('.live-temps').textContent = h.temps;
    board.querySelector('.live-tirs').textContent = h.tirs;
    const sit = board.querySelector('.live-situation');
    sit.textContent = h.situation || '';
    sit.classList.toggle('on', !!h.situation);
    board.querySelector('[data-cote="A"]').textContent = gA;
    board.querySelector('[data-cote="B"]').textContent = gB;
  };

  const appliquer = e => {
    if (e.type === 'arret') {
      if (e.cote === 'A') tA++; else tB++;
      st.tirs[e.cote][periodeDe(Math.min(e.instant, 64.999))]++;
      st.arrets[e.cote === 'A' ? 'B' : 'A']++;
      const g = e.gardien || gardien(e.cote);
      const qui = e.tireur ? `Lancer de <b>${ctx.esc(nom(e.tireur))}</b>` : `Tir de ${ctx.esc(ctx.teamShort(equipe(e.cote)))}`;
      ligne(`arret ${e.cote === 'A' ? 'a' : 'b'}`, `<span class="live-tps">${tempsDeJeu(e.instant)}</span>${ctx.logo(equipe(e.cote).tag, 13)}
        <span>${qui}${g ? `, arrêt de <b>${ctx.esc(nom(g))}</b>` : ', arrêt'}.</span>`, couleurs(e.cote));
      return 0;
    }
    if (e.type === 'but') {
      if (e.cote === 'A') { tA++; gA++; } else { tB++; gB++; }
      const b = e.but;
      st.tirs[e.cote][periodeDe(Math.min(b.instant, 64.999))]++;
      if (b.an) st.anButs[e.cote]++;
      const nG = avancer(b.marqueur, 'g');
      const aidesN = b.passeurs.map(p => ({ p, n: avancer(p, 'a') }));
      const aides = aidesN.length ? ` (${aidesN.map(a => `${nom(a.p)}, ${ordF(a.n)} passe`).join(' ; ')})` : ' (sans aide)';
      st.buts.push({ cote: e.cote, instant: b.instant, marqueur: b.marqueur, nG, aides: aidesN, an: b.an, dn: b.dn, score: `${gA}-${gB}` });
      ligne(`but ${e.cote === 'A' ? 'a' : 'b'}${b.gagnant ? ' gagnant' : ''}`, `<span class="live-tps">${tempsDeJeu(b.instant)}</span>${ctx.logo(equipe(e.cote).tag, 15)}
        <span><b class="live-but-mot">BUT${b.an ? ' · AN' : b.dn ? ' · DN' : ''}</b> <b>${ctx.esc(nom(b.marqueur))}</b> <span class="live-xe">(${ord(nG)} but)</span>${ctx.esc(aides)} — ${ctx.esc(recitDeBut(b))} <span class="live-score">${gA}-${gB}</span></span>`, couleurs(e.cote));
      majBoard();
      const cell = board.querySelector(`[data-cote="${e.cote}"]`);
      cell.classList.remove('flash'); void cell.offsetWidth; cell.classList.add('flash');
      // La bannière de but, aux couleurs du marqueur, le temps de la pause.
      const ban = document.createElement('div');
      ban.className = 'live-banniere';
      ban.setAttribute('style', couleurs(e.cote));
      // Le visage du marqueur dans la bannière : c'est lui qu'on célèbre.
      ban.innerHTML = `${ctx.mug ? `<span class="live-visage">${ctx.mug(b.marqueur)}</span>` : ''}<span class="live-ban-txt"><span>${b.gagnant ? 'BUT GAGNANT' : 'BUT'}${b.an ? ' · AN' : b.dn ? ' · DN' : ''}</span><b>${ctx.esc(nom(b.marqueur))}</b></span>`;
      board.appendChild(ban);
      setTimeout(() => ban.remove(), PAUSE_BUT + 200);
      return PAUSE_BUT;
    }
    if (e.type === 'punition') {
      const puni = equipe(e.cote), profite = equipe(e.cote === 'A' ? 'B' : 'A');
      st.pun[e.cote]++;
      st.anOcc[e.cote === 'A' ? 'B' : 'A']++;
      ligne(`punition ${e.cote === 'A' ? 'a' : 'b'}`, `<span class="live-tps">${tempsDeJeu(e.instant)}</span>${ctx.logo(puni.tag, 13)}
        <span><b class="live-pun-mot">PUNITION</b> ${e.joueur ? `<b>${ctx.esc(nom(e.joueur))}</b>, ` : ''}${e.minutes} min — avantage numérique pour ${ctx.esc(ctx.teamShort(profite))}.</span>`, couleurs(e.cote));
      return 500;
    }
    if (e.type === 'finPunition') {
      const puni = equipe(e.cote);
      ligne('periode', `<span class="live-tps">${tempsDeJeu(e.instant)}</span>${ctx.logo(puni.tag, 13)}
        <span>Fin de la punition${e.joueur ? ` de <b>${ctx.esc(nom(e.joueur))}</b>` : ''} : ${ctx.esc(ctx.teamShort(puni))} revient à cinq.</span>`);
      return 0;
    }
    if (e.type === 'periode') {
      ligne('periode', `Fin de la ${ctx.esc(NOM_PERIODE[e.per])} · <b>${gA}-${gB}</b> · tirs ${f.tirs.A[e.per]} – ${f.tirs.B[e.per]}${e.per === 3 && f.ot ? ' · égalité, on va en prolongation' : ''}`);
      return PAUSE_PERIODE;
    }
    if (e.type === 'fin') {
      fini = true;
      const vainqueur = f.vainqueur === 'A' ? A : B;
      ligne('fin', `<b>Fin du match.</b> ${ctx.esc(cap(ctx.teamShort(vainqueur)))} l'emporte ${Math.max(gA, gB)}-${Math.min(gA, gB)}${f.ot ? ' en prolongation' : ''}.${apres ? ` ${ctx.esc(apres)}` : ''}`);
      finDeMatch();
      return 0;
    }
    return 0;
  };

  const tick = now => {
    if (fini || termine || enPause) return;
    const dt = Math.min(0.1, (now - dernier) / 1000);
    dernier = now;
    if (pause > 0) { pause -= dt * 1000; timer = requestAnimationFrame(tick); return; }
    t += dt * vitesse;
    while (iEv < ev.length && ev[iEv].instant <= t && !fini) {
      const p = appliquer(ev[iEv++]);
      if (p) { pause = p; t = Math.max(t, ev[iEv - 1].instant); break; }
    }
    if (!fini) { majBoard(); timer = requestAnimationFrame(tick); }
  };

  const jusquAuBout = () => {
    stop();
    enPause = false;
    modal.classList.remove('en-pause');
    onglets.fermer();
    while (iEv < ev.length && !fini) appliquer(ev[iEv++]);
    t = f.ot ? 65 : 60;
    majBoard();
  };
  /* LA PAUSE DANS LE MATCH. L'horloge s'arrête où elle est ; les onglets
     s'ouvrent au-dessus du fil, avec les statistiques du match à cet
     instant. Reprendre referme les onglets et repart l'horloge. */
  const pauser = oui => {
    if (termine || fini) return;
    enPause = oui;
    modal.classList.toggle('en-pause', oui);
    const b = controls.querySelector('.live-pause');
    if (b) { b.textContent = oui ? 'Reprendre' : 'Pause'; b.setAttribute('aria-pressed', oui ? 'true' : 'false'); }
    if (oui) { stop(); onglets.ouvrir(); }
    else { onglets.fermer(); dernier = performance.now(); timer = requestAnimationFrame(tick); }
  };

  function finDeMatch() {
    stop();
    boutons(`<button class="btn gold live-suite">Continuer</button>`);
    controls.querySelector('.live-suite').onclick = fermer;
  }

  boutons(`<div class="seg live-vitesse" title="Minutes de jeu par seconde">${VITESSES.map(v => `<button data-v="${v}" class="${v === vitesse ? 'on' : ''}">${ETIQ_VITESSE[v]}</button>`).join('')}</div>
    <button class="btn live-pause" aria-pressed="false" title="Arrêter l'horloge et lire les statistiques du match (barre d'espace)">Pause</button>
    <button class="btn live-fin">Fin du match</button>`);
  controls.querySelector('.live-pause').onclick = () => pauser(!enPause);
  controls.querySelectorAll('.live-vitesse button').forEach(b => {
    b.onclick = () => {
      vitesse = Number(b.dataset.v);
      localStorage.setItem(CLE_VITESSE, String(vitesse));
      controls.querySelectorAll('.live-vitesse button').forEach(x => x.classList.toggle('on', x === b));
    };
  });
  controls.querySelector('.live-fin').onclick = jusquAuBout;

  dernier = performance.now();
  timer = requestAnimationFrame(tick);
}
