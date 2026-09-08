/**
 * LES SÉRIES EN DIRECT.
 *
 * Le moteur a déjà joué chaque match lancer par lancer et gardé sa feuille
 * (`playSeries`, js/sim.js). Ce module ne décide de rien : il REJOUE la
 * feuille dans le temps, un événement à la fois, pour que le résultat se
 * découvre comme à la télé plutôt que d'un coup dans un tableau. Le mystère
 * tient à une seule chose : on ne montre rien avant que l'horloge y arrive.
 *
 * Ce que la feuille porte : les buts avec leur instant, leur marqueur, leurs
 * passeurs et le gardien battu ; le nombre de tirs par période et par côté ;
 * les arrêts. Les tirs arrêtés n'ont pas d'instant, on le leur donne ici, au
 * hasard dans leur période et de façon DÉTERMINISTE (graine sur la série et
 * le match) : rejouer un match redonne la même diffusion.
 *
 * Le module est aveugle aux données du jeu : il reçoit dans `ctx` les
 * fonctions d'affichage de js/game.js (noms, écussons, échappement).
 */

import { tirsTotal, periodeDe } from './sim.js';
import { recitDeBut, tempsDeJeu, NOM_PERIODE } from './recit.js';

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
const CLE_ENCHAINER = 'cap82_direct_enchainer';
const PAUSE_ENCHAINER = 2600;        // ms : avant le match suivant, en mode enchaîné
const PAUSE_BUT = 1400;              // ms : l'horloge s'arrête sur un but
const PAUSE_PERIODE = 1100;          // ms : entre deux périodes

/* « ta formation » en tête de phrase devient « Ta formation ». */
const cap = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
/* Le nom d'un joueur, en texte brut : le fil est du texte, pas des cartes. */
const nom = p => (p && p.n) || '';

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
  for (let per = 1; per <= 3; per++) ev.push({ type: 'periode', per, instant: per * 20 - 1e-6 });
  ev.push({ type: 'fin', instant: f.ot ? finOT + 1e-6 : 60 });
  ev.sort((x, y) => x.instant - y.instant);
  return ev;
}

/** `DAL mène 2-1`, `Égalité 1-1`, `DAL remporte la série 4-2`. */
function etatDeSerie(ctx, s, wA, wB) {
  const nA = ctx.teamShort(s.A), nB = ctx.teamShort(s.B);
  if (wA >= 4) return `${nA} remporte la série ${wA}-${wB}`;
  if (wB >= 4) return `${nB} remporte la série ${wB}-${wA}`;
  if (wA === wB) return `Égalité ${wA}-${wB}`;
  return wA > wB ? `${nA} mène ${wA}-${wB}` : `${nB} mène ${wB}-${wA}`;
}

/**
 * Diffuse les séries du joueur, ronde après ronde, match après match, puis
 * appelle `onTermine` — c'est là que le tableau complet se dessine.
 *
 *   series   toutes les séries jouées (G.series), avec `ronde`, `A`, `B`,
 *            `wA`, `wB`, `feuilles`
 *   rondes   les noms des rondes
 *   ctx      { esc, formatName, teamLabel, teamShort, tagCourt, logo, band }
 */
export function diffuserSeries({ series, rondes, ctx, onTermine }) {
  const modal = document.getElementById('liveModal');
  if (!modal) { onTermine(); return; }
  const $ = id => modal.querySelector(id);
  const head = $('.live-head'), board = $('.live-board'), feed = $('.live-feed'),
    controls = $('.live-controls'), etat = $('.live-etat');

  let vitesse = Number(localStorage.getItem(CLE_VITESSE)) || 2;
  if (!VITESSES.includes(vitesse)) vitesse = 2;

  let timer = null, termine = false;
  const stop = () => { if (timer) { cancelAnimationFrame(timer); timer = null; } };
  const fermer = () => {
    if (termine) return;
    termine = true;
    stop();
    modal.style.display = 'none';
    document.body.style.overflow = '';
    onTermine();
  };
  $('.live-close').onclick = fermer;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  /* Les séries du joueur, dans l'ordre des rondes. */
  const miennes = series.filter(s => s.A.isPlayer || s.B.isPlayer).sort((a, b) => a.ronde - b.ronde);
  let iSerie = 0;

  const boutons = html => { controls.innerHTML = html; };
  const ligne = (cls, html, style = '') => {
    const el = document.createElement('div');
    el.className = `live-ligne ${cls}`;
    if (style) el.setAttribute('style', style);
    el.innerHTML = html;
    feed.prepend(el);
  };
  /* Les victoires de la série, en pastilles : ●●○○ contre ●○○○. */
  const pastilles = (w, vainqueur) => `<span class="live-pastilles${vainqueur ? ' on' : ''}">${'●'.repeat(w)}${'○'.repeat(4 - w)}</span>`;

  let enchainer = localStorage.getItem(CLE_ENCHAINER) === '1';

  /* Le tableau indicateur : deux équipes, le pointage, l'horloge. */
  function dessinerBoard(s, gA, gB, horloge) {
    const cote = (t, buts, pos) => {
      const b = ctx.band(t.tag);
      return `<div class="live-eq ${pos}" style="--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
        <div class="live-eq-band">${ctx.logo(t.tag, 22)}<span>${ctx.esc(ctx.tagCourt(t))}</span></div>
        <div class="live-eq-nom">${ctx.esc(ctx.teamLabel(t))}</div>
        <div class="live-eq-buts" data-cote="${pos === 'a' ? 'A' : 'B'}">${buts}</div>
      </div>`;
    };
    board.innerHTML = `${cote(s.A, gA, 'a')}
      <div class="live-horloge"><span class="live-per">${horloge.per}</span><span class="live-temps">${horloge.temps}</span><span class="live-tirs">${horloge.tirs}</span></div>
      ${cote(s.B, gB, 'b')}`;
  }

  function jouerMatch(s, iMatch) {
    const f = s.feuilles[iMatch];
    const wAvant = s.feuilles.slice(0, iMatch).filter(x => x.vainqueur === 'A').length;
    const wBvant = iMatch - wAvant;
    const ev = evenementsDuMatch(f, (s.i + 1) * 1000 + iMatch);
    let iEv = 0, t = 0, gA = 0, gB = 0, tA = 0, tB = 0, pause = 0, fini = false, dernier = performance.now();

    head.innerHTML = `<span class="live-ronde">${ctx.esc(rondes[s.ronde] || `Ronde ${s.ronde + 1}`)}</span>
      <span class="live-match">Match ${iMatch + 1}</span>
      <span class="live-serie">${ctx.esc(cap(etatDeSerie(ctx, s, wAvant, wBvant)))}</span>
      <span class="live-tally">${pastilles(wAvant)} <span class="live-tally-sep">${ctx.esc(ctx.tagCourt(s.A))} · ${ctx.esc(ctx.tagCourt(s.B))}</span> ${pastilles(wBvant)}</span>`;
    feed.innerHTML = '';
    etat.textContent = '';
    ligne('debut', `Mise au jeu. ${ctx.esc(cap(ctx.teamShort(s.A)))} contre ${ctx.esc(ctx.teamShort(s.B))}, ${ctx.esc((rondes[s.ronde] || '').toLowerCase())}, match ${iMatch + 1}.`);

    const horloge = () => {
      // Sans prolongation, 60:00 est la fin de la 3e période, pas 00:00 de la 4e.
      const enOT = f.ot && t >= 60;
      const per = enOT ? 4 : t >= 60 ? 3 : periodeDe(t);
      const temps = !enOT && t >= 60 ? '20:00' : tempsDeJeu(Math.min(t, 64.999));
      return { per: per === 4 ? 'PROL.' : `${per}${per === 1 ? 're' : 'e'} PÉR.`, temps, tirs: `${tA} – ${tB} tirs` };
    };
    dessinerBoard(s, gA, gB, horloge());

    const majBoard = () => {
      const h = horloge();
      board.querySelector('.live-per').textContent = h.per;
      board.querySelector('.live-temps').textContent = h.temps;
      board.querySelector('.live-tirs').textContent = h.tirs;
      board.querySelector('[data-cote="A"]').textContent = gA;
      board.querySelector('[data-cote="B"]').textContent = gB;
    };

    const gardien = cote => (cote === 'A' ? f.gardienB : f.gardienA);   // le gardien qui FAIT face au tir
    const equipe = cote => (cote === 'A' ? s.A : s.B);
    /* Les couleurs de l'équipe qui tire, posées sur la ligne du fil. */
    const couleurs = cote => { const b = ctx.band(equipe(cote).tag); return `--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}`; };

    const appliquer = e => {
      if (e.type === 'arret') {
        if (e.cote === 'A') tA++; else tB++;
        const g = e.gardien || gardien(e.cote);
        const qui = e.tireur ? `Lancer de <b>${ctx.esc(nom(e.tireur))}</b>` : `Tir de ${ctx.esc(ctx.teamShort(equipe(e.cote)))}`;
        ligne(`arret ${e.cote === 'A' ? 'a' : 'b'}`, `<span class="live-tps">${tempsDeJeu(e.instant)}</span>${ctx.logo(equipe(e.cote).tag, 13)}
          <span>${qui}${g ? `, arrêt de <b>${ctx.esc(nom(g))}</b>` : ', arrêt'}.</span>`, couleurs(e.cote));
        return 0;
      }
      if (e.type === 'but') {
        if (e.cote === 'A') { tA++; gA++; } else { tB++; gB++; }
        const b = e.but;
        const aides = b.passeurs.length ? ` (${b.passeurs.map(nom).join(', ')})` : ' (sans aide)';
        ligne(`but ${e.cote === 'A' ? 'a' : 'b'}${b.gagnant ? ' gagnant' : ''}`, `<span class="live-tps">${tempsDeJeu(b.instant)}</span>${ctx.logo(equipe(e.cote).tag, 15)}
          <span><b class="live-but-mot">BUT</b> <b>${ctx.esc(nom(b.marqueur))}</b>${ctx.esc(aides)} — ${ctx.esc(recitDeBut(b))} <span class="live-score">${gA}-${gB}</span></span>`, couleurs(e.cote));
        majBoard();
        const cell = board.querySelector(`[data-cote="${e.cote}"]`);
        cell.classList.remove('flash'); void cell.offsetWidth; cell.classList.add('flash');
        // La bannière de but, aux couleurs du marqueur, le temps de la pause.
        const ban = document.createElement('div');
        ban.className = 'live-banniere';
        ban.setAttribute('style', couleurs(e.cote));
        ban.innerHTML = `<span>${b.gagnant ? 'BUT GAGNANT' : 'BUT'}</span><b>${ctx.esc(nom(b.marqueur))}</b>`;
        board.appendChild(ban);
        setTimeout(() => ban.remove(), PAUSE_BUT + 200);
        return PAUSE_BUT;
      }
      if (e.type === 'periode') {
        ligne('periode', `Fin de la ${ctx.esc(NOM_PERIODE[e.per])} · <b>${gA}-${gB}</b> · tirs ${f.tirs.A[e.per]} – ${f.tirs.B[e.per]}${e.per === 3 && f.ot ? ' · égalité, on va en prolongation' : ''}`);
        return PAUSE_PERIODE;
      }
      if (e.type === 'fin') {
        fini = true;
        const vainqueur = f.vainqueur === 'A' ? s.A : s.B;
        const wA = wAvant + (f.vainqueur === 'A' ? 1 : 0), wB = wBvant + (f.vainqueur === 'B' ? 1 : 0);
        ligne('fin', `<b>Fin du match.</b> ${ctx.esc(cap(ctx.teamShort(vainqueur)))} l'emporte ${Math.max(gA, gB)}-${Math.min(gA, gB)}${f.ot ? ' en prolongation' : ''}. ${ctx.esc(cap(etatDeSerie(ctx, s, wA, wB)))}.`);
        head.querySelector('.live-serie').textContent = cap(etatDeSerie(ctx, s, wA, wB));
        finDeMatch(s, iMatch, wA, wB);
        return 0;
      }
      return 0;
    };

    const tick = now => {
      if (fini || termine) return;
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
      while (iEv < ev.length && !fini) appliquer(ev[iEv++]);
      t = f.ot ? 65 : 60;
      majBoard();
    };

    boutons(`<div class="seg live-vitesse" title="Minutes de jeu par seconde">${VITESSES.map(v => `<button data-v="${v}" class="${v === vitesse ? 'on' : ''}">${ETIQ_VITESSE[v]}</button>`).join('')}</div>
      <button class="chip live-enchainer${enchainer ? ' on' : ''}" title="Passer au match suivant tout seul, sans cliquer">Enchaîner</button>
      <button class="btn live-fin">Fin du match</button>`);
    controls.querySelectorAll('.live-vitesse button').forEach(b => {
      b.onclick = () => {
        vitesse = Number(b.dataset.v);
        localStorage.setItem(CLE_VITESSE, String(vitesse));
        controls.querySelectorAll('.live-vitesse button').forEach(x => x.classList.toggle('on', x === b));
      };
    });
    controls.querySelector('.live-enchainer').onclick = ev => {
      enchainer = !enchainer;
      localStorage.setItem(CLE_ENCHAINER, enchainer ? '1' : '0');
      ev.currentTarget.classList.toggle('on', enchainer);
    };
    controls.querySelector('.live-fin').onclick = jusquAuBout;

    dernier = performance.now();
    timer = requestAnimationFrame(tick);
  }

  function finDeMatch(s, iMatch, wA, wB) {
    stop();
    const serieFinie = wA >= 4 || wB >= 4;
    if (!serieFinie) {
      boutons(`<button class="btn go live-suite">Match ${iMatch + 2}</button>`);
      const suivant = () => jouerMatch(s, iMatch + 1);
      controls.querySelector('.live-suite').onclick = suivant;
      // En mode enchaîné, le match suivant part tout seul — sauf si on a
      // sauté à la fin, signe qu'on veut lire le résultat.
      if (enchainer) {
        const attente = setTimeout(() => { if (!termine && controls.querySelector('.live-suite')) suivant(); }, PAUSE_ENCHAINER);
        controls.querySelector('.live-suite').addEventListener('click', () => clearTimeout(attente), { once: true });
      }
      return;
    }
    const moi = s.A.isPlayer ? s.A : s.B;
    const gagne = s.winner === moi;
    const autres = series.filter(x => x.ronde === s.ronde && x !== s);
    etat.innerHTML = `<div class="live-bilan ${gagne ? 'gagne' : 'perdu'}">
      <div class="live-bilan-titre">${gagne ? 'Série remportée' : 'Éliminé'} ${Math.max(s.wA, s.wB)}-${Math.min(s.wA, s.wB)}</div>
      ${autres.length ? `<div class="live-autres"><span class="k">Pendant ce temps</span>${autres.map(x =>
        `<div class="live-autre"><span>${ctx.esc(cap(ctx.teamShort(x.winner)))}</span><span class="v">${Math.max(x.wA, x.wB)}-${Math.min(x.wA, x.wB)}</span><span class="p">${ctx.esc(ctx.teamShort(x.winner === x.A ? x.B : x.A))}</span></div>`).join('')}</div>` : ''}
    </div>`;
    iSerie++;
    if (gagne && iSerie < miennes.length) {
      boutons(`<button class="btn go live-suite">${ctx.esc(rondes[miennes[iSerie].ronde] || 'Ronde suivante')}</button>`);
      controls.querySelector('.live-suite').onclick = () => { etat.innerHTML = ''; jouerMatch(miennes[iSerie], 0); };
    } else {
      if (gagne) etat.insertAdjacentHTML('afterbegin', `<div class="live-coupe">Ta formation soulève la Coupe Stanley.</div>`);
      boutons(`<button class="btn gold live-suite">Voir le tableau des séries</button>`);
      controls.querySelector('.live-suite').onclick = fermer;
    }
  }

  if (!miennes.length) { fermer(); return; }
  jouerMatch(miennes[0], 0);
}
