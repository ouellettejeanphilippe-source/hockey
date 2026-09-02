/**
 * Contrôleur d'interface — poste de directeur général.
 *
 * Trois zones : la roulette (quelle saison, quelle équipe, quelles relances),
 * le tableau de bord (ce qu'il reste à combler et avec quel budget) et les
 * deux volets vestiaire / alignement.
 *
 * Règle ferme : aucune cote cachée dans le DOM avant la simulation. Les
 * cotes vivent dans le coffre de js/sim.js ; seules la zone d'efficacité
 * (`lz`) et l'archétype (`ak`), qui sont dans le shard et volontairement
 * publics, sont affichés. L'hexagone n'apparaît que si le joueur lève
 * lui-même le brouillard de guerre dans les options.
 */

import { loadIndex, loadSeason, prefetch, state, cacheClear } from './data.js';
import {
  SLOTS, CAP, REROLLS, fits, simulate, getPositionPenalty, registerHiddenRatings,
  getHiddenRatings, getUnitSynergy, getPlayerKey, createTeam, simulateLeague,
  playSeries, autoRoster,
} from './sim.js';
import { getTeamLogoHtml, TEAM_COLORS } from './logos.js';
import { getArchetype, getEraFactor, getEraSalary, getLineZone, ageAtSeason, SEASON_ERA_CAP } from './ratings.js';

const $ = id => document.getElementById(id);
const rnd = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Salaire plancher de la LNH dans le barème du jeu : sert au calcul du budget restant. */
const MIN_SAL = 775_000;

const money = n => {
  const m = n / 1e6;
  const s = Math.abs(m) >= 10 ? m.toFixed(1) : m.toFixed(2);
  return (n < 0 ? '−$' : '$') + s.replace('-', '').replace(/\.?0+$/, '') + 'M';
};
const pctCap = n => (n / CAP * 100).toFixed(1) + ' %';

const TEAMFULL = {
  QUE: 'Nordiques de Québec', HFD: 'Whalers de Hartford', MNS: 'North Stars du Minnesota',
  AFM: "Flames d'Atlanta", ATL: "Thrashers d'Atlanta", KCS: 'Scouts de Kansas City',
  CLR: 'Rockies du Colorado', CLE: 'Barons de Cleveland', CGS: 'Golden Seals de Californie',
  OAK: "Seals d'Oakland", WIN: 'Jets de Winnipeg (1979-96)', PHX: 'Coyotes de Phoenix',
  ARI: "Coyotes de l'Arizona", MDA: "Mighty Ducks d'Anaheim",
  MTL: 'Canadiens de Montréal', TOR: 'Maple Leafs de Toronto', BOS: 'Bruins de Boston',
  NYR: 'Rangers de New York', DET: 'Red Wings de Détroit', CHI: 'Blackhawks de Chicago',
  EDM: "Oilers d'Edmonton", CGY: 'Flames de Calgary', VAN: 'Canucks de Vancouver',
  OTT: "Sénateurs d'Ottawa", WPG: 'Jets de Winnipeg', PIT: 'Penguins de Pittsburgh',
  PHI: 'Flyers de Philadelphie', STL: 'Blues de St. Louis', LAK: 'Kings de Los Angeles',
  BUF: 'Sabres de Buffalo', NYI: 'Islanders de New York', WSH: 'Capitals de Washington',
  NJD: 'Devils du New Jersey', COL: 'Avalanche du Colorado', DAL: 'Stars de Dallas',
  SJS: 'Sharks de San Jose', TBL: 'Lightning de Tampa Bay', FLA: 'Panthers de la Floride',
  ANA: "Ducks d'Anaheim", NSH: 'Predators de Nashville', CBJ: 'Blue Jackets de Columbus',
  MIN: 'Wild du Minnesota', CAR: 'Hurricanes de la Caroline', VGK: 'Golden Knights de Vegas',
  SEA: 'Kraken de Seattle', UTA: 'Utah', UTM: 'Utah',
};
const DEFUNCT = new Set(['QUE', 'HFD', 'MNS', 'AFM', 'ATL', 'KCS', 'CLR', 'CLE', 'CGS', 'OAK', 'WIN', 'PHX', 'MDA', 'ARI']);

/* =====================================================================
   État
   ===================================================================== */

const G = {
  roster: {},
  cur: null,            // { season, team, pool }
  left: { ...REROLLS },
  target: null,         // case ciblée par le joueur
  selectedSlot: null,   // case sélectionnée pour un déplacement
  filter: 'ALL',
  sortBy: 'PTS',
  search: '',
  statsProrata: false,
  salaryMode: '2026',   // '2026' | 'ERA'
  fogOfWar: true,
  onlyFit: false,
  view: 'pool',         // volet affiché sur petit écran
  done: false,
  loading: false,
  shards: new Map(),
};

const picked = () => Object.values(G.roster);
const capUsed = () => picked().reduce((s, p) => s + p.$, 0);
const capLeft = () => CAP - capUsed();
const slotsLeft = () => 23 - picked().length;

/** Cases ouvertes pour un joueur, les moins pénalisantes d'abord. */
const openSlots = p => SLOTS.filter(s => !G.roster[s.i] && fits(p, s))
  .sort((a, b) => getPositionPenalty(p, a) - getPositionPenalty(p, b) || a.i - b.i);

const nextNeed = () => SLOTS.find(s => !G.roster[s.i]) || null;

/**
 * Somme maximale qu'on peut mettre sur ce joueur-ci sans se rendre incapable
 * de remplir les cases suivantes au salaire plancher. C'est le vrai budget
 * du directeur général, pas seulement le plafond restant.
 */
const maxForPick = () => capLeft() - Math.max(0, slotsLeft() - 1) * MIN_SAL;

/* ---------- sauvegarde ---------- */

function saveGame() {
  if (G.done) { clearSave(); return; }
  try {
    localStorage.setItem('cap82_save', JSON.stringify({
      roster: G.roster,
      left: G.left,
      cur: G.cur ? { season: G.cur.season, team: G.cur.team } : null,
      target: G.target,
    }));
  } catch { /* stockage indisponible */ }
}

function clearSave() {
  try { localStorage.removeItem('cap82_save'); } catch { /* ignore */ }
}

function saveOpts() {
  try {
    localStorage.setItem('cap82_opts', JSON.stringify({
      statsProrata: G.statsProrata, salaryMode: G.salaryMode,
      fogOfWar: G.fogOfWar, onlyFit: G.onlyFit, sortBy: G.sortBy,
    }));
  } catch { /* ignore */ }
}

function loadOpts() {
  try {
    const o = JSON.parse(localStorage.getItem('cap82_opts') || '{}');
    if (typeof o.statsProrata === 'boolean') G.statsProrata = o.statsProrata;
    if (o.salaryMode === 'ERA' || o.salaryMode === '2026') G.salaryMode = o.salaryMode;
    if (typeof o.fogOfWar === 'boolean') G.fogOfWar = o.fogOfWar;
    if (typeof o.onlyFit === 'boolean') G.onlyFit = o.onlyFit;
    if (typeof o.sortBy === 'string') G.sortBy = o.sortBy;
  } catch { /* ignore */ }
}

async function restoreSave() {
  try {
    const raw = localStorage.getItem('cap82_save');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.cur || !data.cur.season) return false;

    const shard = await getShard(data.cur.season);
    if (!shard || !shard.byTeam[data.cur.team]) return false;

    // Recharger les saisons des joueurs signés pour repeupler le coffre de cotes
    if (data.roster) {
      const seasons = new Set(Object.values(data.roster).filter(Boolean).map(p => p.s));
      for (const label of seasons) {
        if (label && label !== data.cur.season) {
          try { await getShard(label); } catch { /* saison indisponible */ }
        }
      }
      // Relier chaque joueur sauvegardé à l'objet frais du shard
      for (const [i, saved] of Object.entries(data.roster)) {
        if (!saved) continue;
        const entry = G.shards.get(saved.s);
        const key = getPlayerKey(saved);
        const fresh = entry && entry.players.find(q => getPlayerKey(q) === key);
        data.roster[i] = fresh || saved;
      }
    }

    G.cur = { season: data.cur.season, team: data.cur.team, pool: shard.byTeam[data.cur.team] };
    G.roster = data.roster || {};
    G.left = data.left || { ...REROLLS };
    G.target = data.target ?? null;
    applyTeamColors(data.cur.team);
    return true;
  } catch {
    return false;
  }
}

/* =====================================================================
   Outils d'affichage
   ===================================================================== */

function applyTeamColors(team) {
  const c = TEAM_COLORS[team] || { primary: '#112236', accent: '#38bdf8' };
  document.documentElement.style.setProperty('--team-primary', c.primary);
  document.documentElement.style.setProperty('--team-accent', c.accent);
}

const isD = p => p && (p.p === 'D' || p.p === 'LD' || p.p === 'RD');

function positionLabel(p) {
  if (!p) return '';
  if (p.p === 'G') return 'G';
  if (isD(p)) return (p.np === 'RD' || p.np === 'DD' || p.np === 'R') ? 'DD' : 'DG';
  if (p.np === 'C') return 'C';
  if (p.np === 'R' || p.np === 'AD') return 'AD';
  if (p.np === 'L' || p.np === 'AG') return 'AG';
  return p.np || 'F';
}

function positionClass(p) {
  if (!p) return 'pos-f';
  if (p.p === 'G') return 'pos-g';
  if (isD(p)) return 'pos-d';
  return 'pos-f';
}

function positionColor(p) {
  if (!p) return 'var(--line)';
  if (p.p === 'G') return '#fcd34d';
  if (isD(p)) return '#c4b5fd';
  return '#7dd3fc';
}

function formatName(full) {
  if (!full) return '';
  const parts = String(full).trim().split(' ');
  if (parts.length === 1) return `<strong class="lname">${esc(full)}</strong>`;
  const last = parts.pop();
  return `<span class="fname">${esc(parts.join(' '))}</span> <strong class="lname">${esc(last)}</strong>`;
}

const seasonMaxGP = season =>
  (season === '1994-95' || season === '2012-13') ? 48
    : season === '2020-21' ? 56
    : season === '2019-20' ? 70
    : 82;

/** Statistiques telles qu'affichées, selon les options (prorata, salaire). */
function displayStats(p) {
  const maxGP = seasonMaxGP(p.s);
  const factor = (G.statsProrata && maxGP < 82) ? (82 / maxGP) : 1;
  const eraF = G.statsProrata ? getEraFactor(p.s) : 1;

  const gp = Math.round((p.gp || 0) * factor);
  const g = Math.round((p.g || 0) * factor * eraF);
  const a = Math.round((p.a || 0) * factor * eraF);
  const pt = Math.round((p.pt || 0) * factor * eraF);
  const pm = Math.round((p.pm || 0) * factor);
  const w = Math.round((p.w ?? 0) * factor);
  const l = Math.round((p.l ?? 0) * factor);
  const so = p.so ?? 0;

  const ppg = p.p === 'G' ? null : (gp > 0 ? pt / gp : 0);
  const eraSal = p.realSal ?? getEraSalary(p.$, p.s);
  const isEra = G.salaryMode === 'ERA';

  return {
    factor, gp, g, a, pt, pm, w, l, so,
    ppg, ppgStr: ppg == null ? '' : ppg.toFixed(2),
    eraSal, isReal: !!p.isReal,
    salaryMain: isEra ? money(eraSal) : money(p.$),
    salarySub: isEra
      ? `${p.s} · 2026 : ${money(p.$)}`
      : `${pctCap(p.$)} du plafond`,
  };
}

/**
 * Les dates de naissance (`bd`) ne sont dans les shards que si le build a pu
 * joindre l'endpoint bios de la LNH. Sans elles, on masque tout ce qui parle
 * d'âge plutôt que d'afficher des tirets partout.
 */
function agesAvailable() {
  const pool = G.cur ? G.cur.pool : [];
  return pool.some(p => p.bd) || picked().some(p => p.bd);
}

/** Valeur de tri « points par million », utile pour repérer les aubaines. */
const valuePerM = p => ((p.p === 'G' ? (p.w ?? 0) * 2.4 : (p.pt || 0)) / Math.max(0.775, p.$ / 1e6));

function zoneTag(p) {
  const z = getLineZone(p, getHiddenRatings(p).v);
  const where = z.idealUnits.map(u => u + 1).join(', ');
  const unit = isD(p) ? 'paires' : p.p === 'G' ? 'rôles' : 'trios';
  return `<span class="tag tag-zone lz${z.level}" title="Zone d'efficacité : ${esc(z.label)}. Rend à 100 % sur les ${unit} ${where}.">📍 ${esc(z.short)}</span>`;
}

function archTag(p) {
  const a = getArchetype(p, getHiddenRatings(p));
  return `<span class="tag tag-arch" title="${esc(a.desc)}">${a.icon} ${esc(a.label)}</span>`;
}

function ageTag(p) {
  const age = ageAtSeason(p.bd, p.s);
  return age ? `<span class="tag tag-age" title="Âge au début de la saison ${p.s}">${age} ans</span>` : '';
}

function elcTag(p) {
  return p.elc
    ? `<span class="tag tag-elc" title="Contrat d'entrée : premier contrat d'un joueur de 24 ans ou moins. Base plafonnée selon l'époque, plus bonis.">🐣 Contrat d'entrée</span>`
    : '';
}

function realTag(p) {
  return p.isReal
    ? `<span class="tag tag-real" title="Salaire réellement publié cette saison-là, converti au prorata du plafond de l'année.">Salaire réel</span>`
    : `<span class="tag tag-est" title="Salaire estimé par le barème de cote globale : aucun montant publié pour cette saison.">Salaire estimé</span>`;
}

function headshotHtml(p) {
  const fallback = `<span class="headshot-fallback">👤</span>`;
  if (!p.id) return fallback;
  return `${fallback}<img src="https://assets.nhle.com/mugs/nhl/latest/${p.id}.png" alt="" loading="lazy" onerror="this.remove()">`;
}

/* ---------- toast ---------- */

let toastTimer = null;
function toast(msg, kind = '') {
  const el = $('toast');
  if (!el) return;
  el.className = 'toast on' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

/* =====================================================================
   Démarrage
   ===================================================================== */

async function boot() {
  try {
    loadOpts();
    await loadIndex();
    if (!state.index.seasons.length) throw new Error('aucune saison disponible');
    setupEvents();
    const restored = await restoreSave();
    if (!restored) await nextSpin(true, true);
    $('boot').style.display = 'none';
    $('game').style.display = '';
    $('actionbar').style.display = '';
    render();
  } catch (e) {
    $('boot').innerHTML = `<div class="err">Impossible de charger les données.<br>
      <span class="mono">${esc(e.message)}</span><br><br>
      Vérifie que <span class="mono">data/index.json</span> existe, ou lance
      <span class="mono">python3 scripts/build_shards.py</span>.</div>`;
  }
}

function setupEvents() {
  // Recherche et tri
  const search = $('searchInput');
  if (search) {
    search.value = G.search;
    search.oninput = () => { G.search = search.value.trim(); renderPool(); renderPoolMeta(); };
  }
  const sort = $('sortSelect');
  if (sort) {
    sort.value = G.sortBy;
    sort.onchange = () => { G.sortBy = sort.value; saveOpts(); renderPool(); };
  }
  syncAgeControls();

  // Onglets (petits écrans)
  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => setView(t.dataset.view);
  });

  // Modales
  bindModal('leaderboardModal', 'openLeaderboardBtn', 'closeLeaderboardBtn', showLeaderboard);
  bindModal('bibleModal', 'openBibleBtn', 'closeBibleBtn');
  bindModal('optionsModal', 'openOptionsBtn', 'closeOptionsBtn', syncOptionsUI);
  bindModal('hockeyCardModal', null, 'closeHockeyCardBtn');

  // Options
  document.querySelectorAll('.seg').forEach(seg => {
    seg.querySelectorAll('button').forEach(b => {
      b.onclick = () => { setOption(seg.dataset.opt, b.dataset.val); syncOptionsUI(); render(); };
    });
  });

  const reset = $('resetBtn');
  if (reset) {
    reset.onclick = async () => {
      closeModal('optionsModal');
      await newGame();
      toast('Nouvelle partie : la roulette repart à zéro.');
    };
  }

  window.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop').forEach(m => { m.style.display = 'none'; });
      if (G.selectedSlot !== null || G.target !== null) {
        G.selectedSlot = null; G.target = null; render();
      }
    }
  });

  $('mainBtn').onclick = runSeason;
}

function bindModal(modalId, openId, closeId, onOpen) {
  const modal = $(modalId);
  if (!modal) return;
  if (openId && $(openId)) $(openId).onclick = () => { if (onOpen) onOpen(); modal.style.display = 'flex'; };
  if (closeId && $(closeId)) $(closeId).onclick = () => { modal.style.display = 'none'; };
  modal.onclick = ev => { if (ev.target === modal) modal.style.display = 'none'; };
}

const closeModal = id => { const m = $(id); if (m) m.style.display = 'none'; };

function setOption(key, val) {
  if (key === 'stats') G.statsProrata = val === 'prorata';
  else if (key === 'salary') G.salaryMode = val;
  else if (key === 'fog') { G.fogOfWar = val === 'on'; if (G.fogOfWar) hideRadar(); }
  else if (key === 'onlyFit') G.onlyFit = val === 'on';
  saveOpts();
}

function syncOptionsUI() {
  const cur = {
    stats: G.statsProrata ? 'prorata' : 'real',
    salary: G.salaryMode,
    fog: G.fogOfWar ? 'on' : 'off',
    onlyFit: G.onlyFit ? 'on' : 'off',
  };
  document.querySelectorAll('.seg').forEach(seg => {
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.val === cur[seg.dataset.opt]);
    });
  });
}

function setView(view) {
  G.view = view;
  $('panes').dataset.view = view;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.view === view));
}

/* =====================================================================
   Roulette
   ===================================================================== */

async function getShard(label) {
  if (G.shards.has(label)) return G.shards.get(label);
  const shard = await loadSeason(label);
  const byTeam = {};
  for (const p of shard.players) {
    if (isD(p) && (!p.np || p.np === 'D')) {
      p.np = (p.shootsCatches === 'R' || p.shoots === 'R') ? 'RD' : 'LD';
    }
    registerHiddenRatings(p);
    (byTeam[p.t] = byTeam[p.t] || []).push(p);
  }
  const entry = { players: shard.players, byTeam };
  G.shards.set(label, entry);
  return entry;
}

async function nextSpin(newSeason, newTeam) {
  G.loading = true;
  renderSpin();

  const need = nextNeed();
  const seasons = state.index.seasons;

  for (let attempt = 0; attempt < 25; attempt++) {
    const season = (!newSeason && G.cur) ? G.cur.season : rnd(seasons);
    let shard;
    try { shard = await getShard(season); } catch { continue; }

    let teams = Object.keys(shard.byTeam).filter(t => shard.byTeam[t].length >= 8);
    if (!newTeam && G.cur && shard.byTeam[G.cur.team]?.length >= 8) {
      teams = [G.cur.team];
    } else if (G.cur) {
      teams = teams.filter(t => !(season === G.cur.season && t === G.cur.team));
    }
    if (!teams.length) continue;

    const team = rnd(teams);
    const pool = shard.byTeam[team];
    if (need && !pool.some(p => openSlots(p).length)) continue;

    G.cur = { season, team, pool };
    G.loading = false;
    applyTeamColors(team);
    saveGame();
    prefetch([rnd(seasons), rnd(seasons)]);
    return;
  }

  G.loading = false;
  G.cur = G.cur || { season: '—', team: '—', pool: [] };
}

/* =====================================================================
   Rendu — plafond, roulette, tableau de bord
   ===================================================================== */

function renderCap() {
  const used = capUsed(), rem = capLeft(), left = slotsLeft();
  const isEra = G.salaryMode === 'ERA';
  const season = G.cur ? G.cur.season : '2025-26';
  const eraCap = SEASON_ERA_CAP[season] || CAP;

  const amt = $('capAmt');
  amt.textContent = isEra ? money(getEraSalary(rem, season)) : money(rem);

  // Serré quand il reste moins de 1,5 M$ par case à combler
  const tight = left > 0 && rem < left * 1_500_000;
  amt.classList.toggle('over', rem < 0);
  amt.classList.toggle('tight', rem >= 0 && tight);

  $('capMaxLbl').textContent = isEra ? `/ ${money(eraCap)} (${season})` : `/ ${money(CAP)}`;

  const fill = $('capFill');
  fill.style.width = Math.min(100, Math.max(0, (used / CAP) * 100)) + '%';
  fill.classList.toggle('over', rem < 0);
  fill.classList.toggle('tight', rem >= 0 && tight);

  // Repère : masse salariale « au rythme » pour 23 joueurs
  const marker = $('capMarker');
  if (marker) marker.style.left = Math.min(100, (picked().length / 23) * 100) + '%';

  $('cnt').textContent = `${picked().length} / 23`;

  const perSlot = $('perSlotLbl');
  if (perSlot) {
    perSlot.textContent = left > 0
      ? `${money(rem / left)} / case restante`
      : (rem >= 0 ? 'Sous le plafond ✓' : 'Plafond dépassé');
    perSlot.className = left === 0 && rem < 0 ? 'dash-bad' : '';
  }
}

function renderSpin() {
  const host = $('spin');
  if (!host) return;

  if (G.loading || !G.cur) {
    host.innerHTML = `<div class="spin-card"><div class="spin-top">
      <div class="spin-logo">🎲</div>
      <div class="spin-id"><div class="spin-name">La roulette tourne…</div>
      <div class="spin-full">Chargement du vestiaire</div></div></div></div>`;
    return;
  }

  const full = TEAMFULL[G.cur.team] || G.cur.team;
  const dead = DEFUNCT.has(G.cur.team) ? ` <span class="spin-dead">· disparue</span>` : '';
  const need = nextNeed();

  const targetSlot = G.target !== null ? SLOTS[G.target] : null;
  const instruction = targetSlot
    ? `Case ciblée : <span class="target-on">${esc(targetSlot.label)} · ${esc(targetSlot.role)}</span>. Signe un joueur pour l'y placer, ou touche la case à nouveau pour annuler.`
    : need
      ? `Signe <strong>un joueur</strong> de ce vestiaire, puis la roulette tourne à nouveau. Prochaine case libre : <strong>${esc(need.label)} · ${esc(need.role)}</strong>.`
      : `Alignement complet. Tu peux encore permuter tes joueurs avant de simuler.`;

  host.innerHTML = `
    <div class="spin-card">
      <div class="spin-top">
        <div class="spin-logo">${getTeamLogoHtml(G.cur.team, 38)}</div>
        <div class="spin-id">
          <div class="spin-name">${esc(G.cur.team)}<span class="spin-season">${esc(G.cur.season)}</span></div>
          <div class="spin-full">${esc(full)}${dead}</div>
        </div>
      </div>
      <div class="spin-instruction">${instruction}</div>
      <div class="rerolls">
        <button id="rrS" class="reroll" ${G.left.season ? '' : 'disabled'} title="Retirer une autre saison au hasard">
          🎲 Autre année<span class="rr-count">${G.left.season} restantes</span></button>
        <button id="rrT" class="reroll" ${G.left.team ? '' : 'disabled'} title="Garder la saison, changer d'équipe">
          🔄 Autre équipe<span class="rr-count">${G.left.team} restantes</span></button>
        <button id="rrP" class="reroll" ${G.left.pass ? '' : 'disabled'} title="Passer ce vestiaire au complet">
          ⏭️ Passer<span class="rr-count">${G.left.pass} restants</span></button>
      </div>
    </div>`;

  const reroll = async (kind, ns, nt) => {
    if (!G.left[kind]) return;
    G.left[kind]--;
    await nextSpin(ns, nt);
    render();
  };
  $('rrS').onclick = () => reroll('season', true, false);
  $('rrT').onclick = () => reroll('team', false, true);
  $('rrP').onclick = () => reroll('pass', true, true);
}

/* Besoins par position (réservistes exclus) */
const POS_NEED = [
  { key: 'AG', label: 'AG', role: 'AG', req: 4 },
  { key: 'C', label: 'C', role: 'C', req: 4 },
  { key: 'AD', label: 'AD', role: 'AD', req: 4 },
  { key: 'LD', label: 'DG', role: 'DG', req: 3 },
  { key: 'RD', label: 'DD', role: 'DD', req: 3 },
  { key: 'G', label: 'G', group: 'G', req: 2 },
];

function signedCount(def) {
  return SLOTS.filter(s => !s.scratch && G.roster[s.i] &&
    (def.group ? s.group === def.group : s.role === def.role)).length;
}

function renderDash() {
  const host = $('dash');
  if (!host) return;

  const left = slotsLeft(), rem = capLeft();
  const maxPick = maxForPick();
  const need = nextNeed();

  const needChips = POS_NEED.map(def => {
    const n = signedCount(def);
    const cls = n >= def.req ? 'done' : (need && (def.group ? need.group === def.group : need.role === def.role)) ? 'urgent' : '';
    return `<span class="need-chip ${cls}" title="${esc(def.label)} : ${n} signés sur ${def.req} requis">${esc(def.label)} ${n}/${def.req}</span>`;
  }).join('');
  const scratchN = SLOTS.filter(s => s.scratch && G.roster[s.i]).length;

  // Combien de joueurs de ce vestiaire sont réellement signables
  const pool = G.cur ? G.cur.pool : [];
  const affordable = pool.filter(p => !picked().includes(p) && openSlots(p).length && p.$ <= rem).length;
  const safe = pool.filter(p => !picked().includes(p) && openSlots(p).length && p.$ <= maxPick).length;

  const budgetNote = left === 0
    ? (rem >= 0 ? `Masse salariale : ${money(capUsed())}. Tu es sous le plafond.` : `Tu dépasses de ${money(-rem)} : retire un joueur.`)
    : maxPick < MIN_SAL
      ? `Il ne reste plus assez pour combler les ${left} cases au salaire plancher.`
      : `Au-delà de ${money(maxPick)} pour ce joueur-ci, tu ne peux plus remplir les ${left - 1 >= 0 ? left - 1 : 0} cases suivantes au plancher de ${money(MIN_SAL)}.`;

  const budgetCls = left === 0 ? (rem >= 0 ? 'dash-good' : 'dash-bad')
    : maxPick < MIN_SAL ? 'dash-bad'
    : maxPick < 2_000_000 ? 'dash-warn' : '';

  host.innerHTML = `
    <div class="dash-card">
      <h3>À combler</h3>
      <div class="needs">${needChips}<span class="need-chip ${scratchN >= 3 ? 'done' : ''}" title="Réservistes : remplacent les blessés">Rés. ${scratchN}/3</span></div>
      <div class="dash-note">${need ? `Prochaine case : <strong>${esc(need.label)} · ${esc(need.role)}</strong>` : 'Toutes les cases sont comblées.'}</div>
    </div>
    <div class="dash-card">
      <h3>Budget du prochain choix</h3>
      <div class="dash-line"><span class="dash-big ${budgetCls}">${left ? money(Math.max(0, maxPick)) : money(rem)}</span>
        <span class="dash-note" style="margin:0">${left} case${left > 1 ? 's' : ''}</span></div>
      <div class="dash-note">${budgetNote}</div>
    </div>
    <div class="dash-card">
      <h3>Ce vestiaire</h3>
      <div class="dash-line"><span class="dash-big ${affordable === 0 && left > 0 ? 'dash-bad' : safe === 0 ? 'dash-warn' : ''}">${safe}</span><span class="dash-note" style="margin:0">sans risque</span></div>
      <div class="dash-note">${affordable} joueur${affordable > 1 ? 's' : ''} sous le plafond restant, ${pool.length} au total. Relances : ${G.left.season} année${G.left.season > 1 ? 's' : ''}, ${G.left.team} équipe${G.left.team > 1 ? 's' : ''}, ${G.left.pass} passe${G.left.pass > 1 ? 's' : ''}.</div>
    </div>`;
}

/* =====================================================================
   Rendu — bassin
   ===================================================================== */

function renderFilters() {
  const host = $('filters');
  if (!host) return;
  const defs = [
    ['ALL', 'Tous', null],
    ['C', 'Centres', POS_NEED[1]],
    ['AG', 'Ailiers G.', POS_NEED[0]],
    ['AD', 'Ailiers D.', POS_NEED[2]],
    ['LD', 'Déf. gauche', POS_NEED[3]],
    ['RD', 'Déf. droit', POS_NEED[4]],
    ['G', 'Gardiens', POS_NEED[5]],
  ];
  host.innerHTML = defs.map(([key, label, def]) => {
    let badge = '';
    if (key === 'ALL') {
      badge = `<span class="chip-need${picked().length >= 23 ? ' full' : ''}">${picked().length}/23</span>`;
    } else if (def) {
      const n = signedCount(def);
      badge = `<span class="chip-need${n >= def.req ? ' full' : ''}">${n}/${def.req}</span>`;
    }
    return `<button class="chip${G.filter === key ? ' on' : ''}" data-f="${key}" role="tab" aria-selected="${G.filter === key}">${esc(label)}${badge}</button>`;
  }).join('');

  host.querySelectorAll('.chip').forEach(b => {
    b.onclick = () => { G.filter = b.dataset.f; renderFilters(); renderPool(); renderPoolMeta(); };
  });
}

function poolFiltered() {
  if (!G.cur) return [];
  let list = G.cur.pool.slice();

  const f = G.filter;
  if (f === 'C') list = list.filter(p => !isD(p) && p.p !== 'G' && p.np === 'C');
  else if (f === 'AG') list = list.filter(p => !isD(p) && p.p !== 'G' && (p.np === 'L' || p.np === 'AG'));
  else if (f === 'AD') list = list.filter(p => !isD(p) && p.p !== 'G' && (p.np === 'R' || p.np === 'AD'));
  else if (f === 'LD') list = list.filter(p => isD(p) && (p.np === 'LD' || p.np === 'DG' || p.np === 'L'));
  else if (f === 'RD') list = list.filter(p => isD(p) && (p.np === 'RD' || p.np === 'DD' || p.np === 'R'));
  else if (f === 'G') list = list.filter(p => p.p === 'G');

  if (G.search) {
    const q = G.search.toLowerCase();
    list = list.filter(p => p.n.toLowerCase().includes(q));
  }

  if (G.onlyFit) {
    const rem = capLeft();
    list = list.filter(p => !picked().includes(p) && openSlots(p).length && p.$ <= rem);
  }

  const key = p => (p.p === 'G' ? (p.w ?? 0) : (p.pt ?? 0));
  const cmp = {
    PTS: (a, b) => key(b) - key(a) || b.$ - a.$,
    PPG: (a, b) => (displayStats(b).ppg ?? -1) - (displayStats(a).ppg ?? -1) || key(b) - key(a),
    SAL: (a, b) => b.$ - a.$ || key(b) - key(a),
    VAL: (a, b) => valuePerM(b) - valuePerM(a),
    PM: (a, b) => (b.pm ?? 0) - (a.pm ?? 0) || key(b) - key(a),
    AGE: (a, b) => (ageAtSeason(a.bd, a.s) ?? 99) - (ageAtSeason(b.bd, b.s) ?? 99) || key(b) - key(a),
    NAME: (a, b) => a.n.localeCompare(b.n, 'fr'),
  }[G.sortBy] || ((a, b) => key(b) - key(a));

  return list.sort(cmp);
}

/** Masque le tri par âge quand aucune date de naissance n'est disponible. */
function syncAgeControls() {
  const sort = $('sortSelect');
  if (!sort) return;
  const opt = sort.querySelector('option[value="AGE"]');
  if (!opt) return;
  const ok = agesAvailable();
  opt.hidden = !ok;
  opt.disabled = !ok;
  if (!ok && G.sortBy === 'AGE') { G.sortBy = 'PTS'; saveOpts(); }
  sort.value = G.sortBy;
}

/* Une colonne par position, comme au tableau d'un vrai vestiaire. */
const POOL_COLS = [
  { key: 'AG', title: 'AG · ailier g.', need: POS_NEED[0], test: p => p.p === 'F' && (p.np === 'L' || p.np === 'AG') },
  { key: 'C',  title: 'C · centre',         need: POS_NEED[1], test: p => p.p === 'F' && p.np !== 'L' && p.np !== 'AG' && p.np !== 'R' && p.np !== 'AD' },
  { key: 'AD', title: 'AD · ailier d.',  need: POS_NEED[2], test: p => p.p === 'F' && (p.np === 'R' || p.np === 'AD') },
  { key: 'DG', title: 'DG · déf. gauche', need: POS_NEED[3], test: p => isD(p) && p.np !== 'RD' && p.np !== 'DD' && p.np !== 'R' },
  { key: 'DD', title: 'DD · déf. droit',  need: POS_NEED[4], test: p => isD(p) && (p.np === 'RD' || p.np === 'DD' || p.np === 'R') },
  { key: 'G',  title: 'G · gardien',        need: POS_NEED[5], test: p => p.p === 'G' },
];

function renderPoolMeta() {
  const list = poolFiltered();
  const meta = $('poolCount');
  if (meta) meta.textContent = `${list.length} joueur${list.length > 1 ? 's' : ''}`;
  const badge = $('tabPoolBadge');
  if (badge) badge.textContent = String(list.length);
  const rMeta = $('rosterMeta');
  if (rMeta) rMeta.textContent = `${picked().length} / 23 · ${money(capUsed())}`;
  const rBadge = $('tabRosterBadge');
  if (rBadge) rBadge.textContent = `${picked().length}/23`;
}

/** Case où irait ce joueur : la cible si compatible, sinon la moins pénalisée. */
function destinationFor(p) {
  if (G.target !== null && !G.roster[G.target] && fits(p, SLOTS[G.target])) return SLOTS[G.target];
  return openSlots(p)[0] || null;
}

function playerCardEl(p) {
  const already = picked().includes(p);
  const slot = destinationFor(p);
  const rem = capLeft();
  const over = p.$ > rem;
  const risky = !over && p.$ > maxForPick();
  const pen = slot ? getPositionPenalty(p, slot) : 0;
  const st = displayStats(p);
  const isTargeted = G.target !== null && slot === SLOTS[G.target];

  const el = document.createElement('div');
  el.className = 'pcard'
    + (already ? ' signed' : '')
    + ((already || !slot || over) ? ' locked' : '');
  el.style.setProperty('--pos-color', positionColor(p));

  // Statistiques visibles selon le poste
  const pmCls = st.pm > 0 ? 'pm-pos' : st.pm < 0 ? 'pm-neg' : '';
  const pmStr = st.pm > 0 ? `+${st.pm}` : `${st.pm}`;
  const stats = p.p === 'G'
    ? `<span class="stat-big"><b>${st.w}</b><span>V</span></span>
       <span><span class="k">PJ</span> <span class="v">${st.gp}</span></span>
       <span><span class="k">D</span> <span class="v">${st.l}</span></span>
       <span><span class="k">%ARR</span> <span class="v">${p.sv ?? '—'}</span></span>
       <span><span class="k">MBA</span> <span class="v">${p.ga ?? '—'}</span></span>
       <span><span class="k">BL</span> <span class="v">${st.so}</span></span>`
    : `<span class="stat-big"><b>${st.pt}</b><span>PTS</span></span>
       <span><span class="k">PJ</span> <span class="v">${st.gp}</span></span>
       <span><span class="k">B-A</span> <span class="v">${st.g}-${st.a}</span></span>
       <span class="ptsm">${st.ppgStr} PTS/M</span>
       <span><span class="k">+/-</span> <span class="${pmCls}">${pmStr}</span></span>`;

  // Destination et conséquence budgétaire
  let dest;
  if (already) {
    const cur = SLOTS.find(s => G.roster[s.i] === p);
    dest = `<span class="dest-slot">✓ Signé</span>${cur ? ` · ${esc(cur.label)} · ${esc(cur.role)}` : ''}`;
  } else if (!slot) {
    dest = `<span class="dest-bad">Aucune case libre à cette position</span>`;
  } else if (over) {
    dest = `<span class="dest-bad">Hors budget</span> · il te reste ${money(rem)}`;
  } else {
    const after = rem - p.$;
    const left = slotsLeft() - 1;
    const penTxt = pen > 0 ? ` <span class="dest-bad">−${pen} hors position</span>` : '';
    dest = `<span class="${isTargeted ? 'dest-target' : 'dest-slot'}">${isTargeted ? '🎯 ' : '→ '}${esc(slot.label)} · ${esc(slot.role)}</span>${penTxt}`
      + `<br><span class="dest-after">Après : ${money(after)}${left > 0 ? ` · ${money(after / left)} / case` : ''}</span>`;
  }

  const tags = [
    archTag(p), zoneTag(p), ageTag(p), elcTag(p),
    p.x ? `<span class="tag tag-traded" title="Joueur échangé en cours de saison : il apparaît dans le vestiaire de chaque équipe.">↔ Échangé</span>` : '',
    risky ? `<span class="tag tag-pen" title="Ce salaire laisse moins que le plancher pour les cases restantes : tu ne pourrais plus compléter les 23.">⚠ Bloque la fin</span>` : '',
  ].filter(Boolean).join('');

  const label = already ? '✓ Signé' : !slot ? 'Position pleine' : over ? 'Hors budget' : (isTargeted ? '🎯 Signer' : '+ Signer');

  el.innerHTML = `
    <div class="pcard-avatar">${headshotHtml(p)}
      <span class="pcard-team-badge">${getTeamLogoHtml(p.t, 13)}</span>
    </div>
    <div class="pcard-body">
      <div class="pcard-row1">
        <div class="pcard-name"><span class="pos-badge ${positionClass(p)}">${esc(positionLabel(p))}</span>${formatName(p.n)}</div>
        <div class="pcard-price">
          <span class="amt">${st.salaryMain}</span>
          <span class="sub">${st.salarySub}</span>
        </div>
      </div>
      <div class="pcard-stats">${stats}</div>
      <div class="tags">${tags}</div>
      <div class="pcard-foot">
        <div class="pcard-dest">${dest}</div>
        <button class="btn-sign${already ? ' is-signed' : ''}" ${already || !slot || over ? 'disabled' : ''}>${label}</button>
      </div>
    </div>`;

  el.onclick = ev => {
    if (ev.target.closest('.btn-sign')) return;
    showPlayerModal(p);
  };
  el.querySelector('.btn-sign').onclick = ev => {
    ev.stopPropagation();
    signPlayer(p);
  };
  if (!G.fogOfWar) attachRadar(el, p);
  return el;
}

async function signPlayer(p) {
  if (picked().includes(p)) return;
  const slot = destinationFor(p);
  if (!slot) { toast('Aucune case libre pour ce joueur.', 'bad'); return; }
  if (p.$ > capLeft()) { toast('Hors budget : il te reste ' + money(capLeft()) + '.', 'bad'); return; }

  const risky = p.$ > maxForPick();
  G.roster[slot.i] = p;
  G.target = null;
  G.selectedSlot = null;

  const pen = getPositionPenalty(p, slot);
  toast(`${p.n} → ${slot.label} · ${slot.role}` + (pen > 0 ? ` (−${pen} hors position)` : ''), pen > 0 ? 'warn' : '');
  if (risky && slotsLeft() > 0) {
    setTimeout(() => toast(`Attention : ${money(capLeft())} pour ${slotsLeft()} cases, sous le plancher.`, 'warn'), 2700);
  }

  await nextSpin(true, true);
  saveGame();
  render();
  document.getElementById('topbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Impasse : plus aucune signature possible dans ce vestiaire (tout est hors
 * budget ou sans case libre). C'est récupérable — il faut libérer de la masse
 * salariale — mais il faut le dire clairement plutôt que de laisser le joueur
 * devant une grille de cartes toutes grisées.
 */
function blockedState() {
  if (G.done || slotsLeft() === 0 || !G.cur) return null;
  const rem = capLeft();
  const free = G.cur.pool.filter(p => !picked().includes(p) && openSlots(p).length);
  if (free.some(p => p.$ <= rem)) return null;
  const cheapest = free.length ? free.reduce((a, b) => (b.$ < a.$ ? b : a)) : null;
  const priciest = picked().slice().sort((a, b) => b.$ - a.$)[0] || null;
  const rerolls = G.left.season + G.left.team + G.left.pass;
  return { rem, cheapest, priciest, rerolls };
}

function blockedBannerEl(st) {
  const el = document.createElement('div');
  el.className = 'blocked';
  const slot = st.priciest ? SLOTS.find(s => G.roster[s.i] === st.priciest) : null;
  el.innerHTML = `
    <div class="blocked-title">⚠ Aucune signature possible ici</div>
    <p>Il te reste <strong>${money(st.rem)}</strong> pour <strong>${slotsLeft()} case${slotsLeft() > 1 ? 's' : ''}</strong>.
      ${st.cheapest ? `Le moins cher de ce vestiaire qui a une case libre coûte ${money(st.cheapest.$)}.` : 'Aucun joueur de ce vestiaire ne convient à une case libre.'}
      ${st.rerolls ? `Tu peux relancer (${st.rerolls} relance${st.rerolls > 1 ? 's' : ''} restante${st.rerolls > 1 ? 's' : ''}) ou libérer de la masse salariale.` : 'Tes relances sont épuisées : il faut libérer de la masse salariale.'}</p>
    ${st.priciest ? `<button class="btn danger" id="freeCapBtn">Retirer ${esc(st.priciest.n)} · ${money(st.priciest.$)}${slot ? ` (${esc(slot.role)})` : ''}</button>` : ''}`;
  const btn = el.querySelector('#freeCapBtn');
  if (btn && slot) {
    btn.onclick = () => {
      delete G.roster[slot.i];
      G.selectedSlot = null;
      saveGame();
      render();
      toast(`${st.priciest.n} retiré. ${money(capLeft())} de disponible.`, 'warn');
    };
  }
  return el;
}

function renderPool() {
  const host = $('pool');
  if (!host) return;

  if (G.loading) {
    host.className = 'pool';
    host.innerHTML = `<div class="empty-msg">Ouverture du vestiaire…</div>`;
    return;
  }

  const blocked = blockedState();
  const list = poolFiltered();
  if (!list.length) {
    host.className = 'pool';
    host.innerHTML = '';
    if (blocked) host.appendChild(blockedBannerEl(blocked));
    host.insertAdjacentHTML('beforeend', `<div class="empty-msg">Aucun joueur ne correspond.<br>
      ${G.search ? 'Efface la recherche' : G.onlyFit ? 'Désactive « signables seulement » dans les options' : 'Change de filtre'} ou utilise une relance.</div>`);
    return;
  }

  const frag = document.createDocumentFragment();
  if (blocked) frag.appendChild(blockedBannerEl(blocked));

  // Sans filtre de position, on range le vestiaire en six colonnes. La feuille
  // de style décide si elles deviennent de vraies colonnes (écran large) ou de
  // simples séparateurs dans une grille de cartes (écran étroit).
  const byPos = G.filter === 'ALL';
  host.className = 'pool' + (byPos ? ' by-pos' : '');

  if (byPos) {
    for (const col of POOL_COLS) {
      const players = list.filter(col.test);
      const n = signedCount(col.need);
      const el = document.createElement('div');
      el.className = 'pool-col';
      el.innerHTML = `<div class="pool-col-head">
        <span class="pool-col-title">${esc(col.title)}</span>
        <span class="pool-col-meta"><span>${players.length} dispo</span>
        <span class="chip-need${n >= col.need.req ? ' full' : ''}" title="Signés sur requis à cette position">${n}/${col.need.req}</span></span>
      </div>`;
      const cards = document.createElement('div');
      cards.className = 'pool-col-cards';
      if (!players.length) cards.innerHTML = `<div class="empty-msg small">Aucun</div>`;
      else for (const p of players) cards.appendChild(playerCardEl(p));
      el.appendChild(cards);
      frag.appendChild(el);
    }
  } else {
    for (const p of list) frag.appendChild(playerCardEl(p));
  }

  host.innerHTML = '';
  host.appendChild(frag);
}

/* =====================================================================
   Rendu — alignement
   ===================================================================== */

function slotEl(s) {
  const p = G.roster[s.i];
  const el = document.createElement('div');
  const pen = p ? getPositionPenalty(p, s) : 0;

  el.className = 'slot'
    + (p ? '' : ' empty')
    + (G.selectedSlot === s.i ? ' selected' : '')
    + (!p && G.target === s.i ? ' target' : '')
    + (pen > 0 ? ' oop' : '');

  if (p) {
    const st = displayStats(p);
    const main = p.p === 'G' ? `${st.w} V` : `${st.pt} PTS`;
    const secondary = p.p === 'G' ? `${p.sv ?? '—'} %ARR` : `${st.ppgStr} PTS/M`;
    const penTag = pen > 0 ? `<span class="tag tag-pen" title="Pénalité de position : −${pen} sur ses cotes">−${pen}</span>` : '';
    el.innerHTML = `
      <button class="slot-remove" title="Retirer ${esc(p.n)}" aria-label="Retirer ${esc(p.n)}">✕</button>
      <div class="slot-top">
        <span class="slot-role-tag">${esc(s.role)}</span>
        <span class="slot-salary">${st.salaryMain}</span>
      </div>
      <div class="slot-name">${formatName(p.n)}</div>
      <div class="slot-meta"><span>${esc(positionLabel(p))} · ${esc(p.t)} '${esc(p.s.slice(-2))}</span></div>
      <div class="slot-meta"><span>${main}</span><span>${secondary}</span></div>
      <div class="slot-tags">${zoneTag(p)}${penTag}</div>`;
    if (!G.fogOfWar) attachRadar(el, p);
    el.querySelector('.slot-remove').onclick = ev => {
      ev.stopPropagation();
      delete G.roster[s.i];
      G.selectedSlot = null;
      saveGame();
      render();
      toast(`${p.n} retiré. ${money(capLeft())} de disponible.`);
    };
  } else {
    el.innerHTML = `<div class="slot-role">${esc(s.role)}</div><div class="slot-sub">${esc(s.label)}</div>`;
  }

  el.onclick = () => {
    if (G.selectedSlot !== null) {
      if (G.selectedSlot === s.i) {
        G.selectedSlot = null;
      } else {
        const src = G.selectedSlot;
        const a = G.roster[src], b = G.roster[s.i];
        if (a) G.roster[s.i] = a; else delete G.roster[s.i];
        if (b) G.roster[src] = b; else delete G.roster[src];
        G.selectedSlot = null;
        G.target = null;
        saveGame();
        toast(b ? 'Joueurs permutés.' : 'Joueur déplacé.');
      }
    } else if (p) {
      G.selectedSlot = s.i;
      toast('Touche une autre case pour déplacer ou permuter.');
    } else {
      G.target = (G.target === s.i ? null : s.i);
      if (G.target !== null) {
        setView('pool');
        toast(`Case ciblée : ${s.label} · ${s.role}. Les signatures iront là.`);
      }
    }
    render();
  };
  return el;
}

const UNIT_NAMES_F = ['Premier trio', 'Deuxième trio', 'Troisième trio', 'Quatrième trio'];
const UNIT_NAMES_D = ['Première paire', 'Deuxième paire', 'Troisième paire'];

function lineEl(title, slots, group, unit, cls = '') {
  const wrap = document.createElement('div');
  wrap.className = 'line';

  let chemHtml = '<span class="line-chem">incomplet</span>';
  if (group != null) {
    const syn = getUnitSynergy(G.roster, group, unit);
    const sum = (syn.bonusOff || 0) + (syn.bonusDef || 0);
    const filled = slots.filter(s => G.roster[s.i]).length;
    if (filled === slots.length) {
      const kind = sum > 0 ? 'good' : sum < 0 ? 'bad' : '';
      if (kind) wrap.classList.add(kind);
      const sign = v => (v > 0 ? `+${v}` : `${v}`);
      chemHtml = `<span class="line-chem ${kind}" title="${esc(syn.desc || '')}">${esc(syn.name)} · ATT ${sign(syn.bonusOff || 0)} / DÉF ${sign(syn.bonusDef || 0)}</span>`;
    } else {
      chemHtml = `<span class="line-chem">${filled}/${slots.length} · chimie à venir</span>`;
    }
  } else {
    const filled = slots.filter(s => G.roster[s.i]).length;
    chemHtml = `<span class="line-chem">${filled}/${slots.length} comblés</span>`;
  }

  wrap.innerHTML = `<div class="line-head"><span class="line-name">${esc(title)}</span>${chemHtml}</div>`;
  const row = document.createElement('div');
  row.className = 'line-slots' + (cls ? ' ' + cls : '');
  slots.forEach(s => row.appendChild(slotEl(s)));
  wrap.appendChild(row);
  return wrap;
}

function renderRoster() {
  const host = $('rosterBoard');
  if (!host) return;
  host.innerHTML = '';

  UNIT_NAMES_F.forEach((name, u) => {
    const slots = SLOTS.filter(s => s.group === 'F' && s.unit === u && !s.scratch);
    host.appendChild(lineEl(name, slots, 'F', u));
  });
  UNIT_NAMES_D.forEach((name, u) => {
    const slots = SLOTS.filter(s => s.group === 'D' && s.unit === u && !s.scratch);
    host.appendChild(lineEl(name, slots, 'D', u, 'pair'));
  });
  host.appendChild(lineEl('Gardiens', SLOTS.filter(s => s.group === 'G' && !s.scratch), null, null, 'pair'));
  host.appendChild(lineEl('Réservistes', SLOTS.filter(s => s.scratch), null, null, 'wide'));
}

function renderTeamSummary() {
  const host = $('teamSummary');
  if (!host) return;

  const ps = picked();
  const ages = ps.map(p => ageAtSeason(p.bd, p.s)).filter(Boolean);
  const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : null;
  const oop = SLOTS.filter(s => G.roster[s.i] && getPositionPenalty(G.roster[s.i], s) > 0).length;

  let optimal = 0, miscast = 0;
  for (let u = 0; u < 4; u++) {
    const syn = getUnitSynergy(G.roster, 'F', u);
    if (syn.zone && syn.zone.startsWith('✨')) optimal++;
    if (syn.zone && syn.zone.startsWith('⚠️')) miscast++;
  }
  for (let u = 0; u < 3; u++) {
    const syn = getUnitSynergy(G.roster, 'D', u);
    if (syn.zone && syn.zone.startsWith('✨')) optimal++;
    if (syn.zone && syn.zone.startsWith('⚠️')) miscast++;
  }

  const totalPts = ps.filter(p => p.p !== 'G').reduce((s, p) => s + displayStats(p).pt, 0);
  const topSal = ps.length ? Math.max(...ps.map(p => p.$)) : 0;

  host.innerHTML = `
    <div class="sum-item"><div class="k">Masse</div><div class="v">${money(capUsed())}</div></div>
    <div class="sum-item"><div class="k">Plus gros contrat</div><div class="v">${ps.length ? money(topSal) : '—'}</div></div>
    <div class="sum-item"><div class="k">Points cumulés</div><div class="v">${totalPts}</div></div>
    ${avgAge
      ? `<div class="sum-item"><div class="k">Âge moyen</div><div class="v">${avgAge}</div></div>`
      : `<div class="sum-item"><div class="k">Cases vides</div><div class="v ${slotsLeft() ? 'dash-warn' : 'dash-good'}">${slotsLeft()}</div></div>`}
    <div class="sum-item"><div class="k">Unités optimales</div><div class="v ${optimal ? 'dash-good' : ''}">${optimal}/7</div></div>
    <div class="sum-item"><div class="k">Mal assorties</div><div class="v ${miscast ? 'dash-bad' : ''}">${miscast}</div></div>
    <div class="sum-item"><div class="k">Hors position</div><div class="v ${oop ? 'dash-warn' : ''}">${oop}</div></div>`;
}

function renderMain() {
  const b = $('mainBtn');
  const n = picked().length;
  const over = capLeft() < 0;
  b.disabled = n !== 23 || G.done || over;
  b.textContent = G.done ? 'Saison simulée'
    : over ? `Plafond dépassé de ${money(-capLeft())}`
    : n === 23 ? 'Simuler la saison · 82 matchs'
    : `Encore ${23 - n} joueur${23 - n > 1 ? 's' : ''}`;
}

function render() {
  syncAgeControls();
  renderCap();
  renderSpin();
  renderDash();
  renderFilters();
  renderPool();
  renderPoolMeta();
  renderRoster();
  renderTeamSummary();
  renderMain();
  const hint = $('rosterHint');
  if (hint) {
    hint.textContent = G.selectedSlot !== null
      ? 'Touche une autre case pour déplacer ou permuter le joueur choisi.'
      : G.target !== null
        ? 'Une case est ciblée : la prochaine signature ira là.'
        : 'Touche un joueur signé pour le déplacer, une case vide pour la cibler.';
  }
}

/* =====================================================================
   Hexagone (seulement si le brouillard est levé)
   ===================================================================== */

function attachRadar(el, p) {
  el.addEventListener('mouseenter', ev => showRadar(ev, p));
  el.addEventListener('mousemove', positionRadar);
  el.addEventListener('mouseleave', hideRadar);
}

function showRadar(ev, p) {
  if (G.fogOfWar) return;
  const tip = $('radarTooltip');
  if (!tip) return;

  const isG = p.p === 'G';
  const labels = isG ? ['TEC', 'BLI', 'ROB', 'CLU', 'RÉF', 'COTE'] : ['ATT', 'DÉF', 'ROB', 'CLU', 'VIT', 'COTE'];
  const r = getHiddenRatings(p);
  const values = [r.o, r.d, r.r, r.c, r.sp ?? 50, r.v];

  const size = 150, c = size / 2, rad = 48;
  const coord = (val, i) => {
    const ang = (i * 60 - 90) * Math.PI / 180;
    const rr = (val / 100) * rad;
    return [c + rr * Math.cos(ang), c + rr * Math.sin(ang)];
  };

  let grid = '';
  for (const lvl of [0.25, 0.5, 0.75, 1]) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i * 60 - 90) * Math.PI / 180;
      pts.push(`${c + lvl * rad * Math.cos(ang)},${c + lvl * rad * Math.sin(ang)}`);
    }
    grid += `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(28,52,80,0.8)" stroke-width="1"/>`;
  }
  let axes = '', lbls = '';
  for (let i = 0; i < 6; i++) {
    const ang = (i * 60 - 90) * Math.PI / 180;
    axes += `<line x1="${c}" y1="${c}" x2="${c + rad * Math.cos(ang)}" y2="${c + rad * Math.sin(ang)}" stroke="rgba(28,52,80,1)" stroke-width="1"/>`;
    lbls += `<text x="${c + (rad + 14) * Math.cos(ang)}" y="${c + (rad + 14) * Math.sin(ang) + 3}" fill="#93a9c0" font-size="8" font-weight="800" text-anchor="middle">${labels[i]}</text>`;
  }
  const poly = values.map((v, i) => coord(v, i).join(',')).join(' ');
  const dots = values.map((v, i) => { const [x, y] = coord(v, i); return `<circle cx="${x}" cy="${y}" r="2.5" fill="#38bdf8"/>`; }).join('');

  tip.innerHTML = `
    <div class="radar-header">${esc(p.n)}</div>
    <div class="radar-sub">${esc(positionLabel(p))} · ${esc(p.t)} ${esc(p.s)} · cote ${r.v}</div>
    <svg class="radar-chart-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${grid}${axes}
      <polygon points="${poly}" fill="rgba(244,196,48,0.32)" stroke="#f4c430" stroke-width="2"/>
      ${dots}${lbls}
    </svg>`;
  tip.style.display = 'block';
  positionRadar(ev);
}

function positionRadar(ev) {
  const tip = $('radarTooltip');
  if (!tip || tip.style.display === 'none') return;
  tip.style.left = Math.min(window.innerWidth - 222, ev.clientX + 14) + 'px';
  tip.style.top = Math.min(window.innerHeight - 250, ev.clientY + 14) + 'px';
}

function hideRadar() {
  const tip = $('radarTooltip');
  if (tip) tip.style.display = 'none';
}

/* =====================================================================
   Fiche complète du joueur
   ===================================================================== */

function showPlayerModal(p) {
  const modal = $('hockeyCardModal');
  const body = $('hockeyCardBody');
  if (!modal || !body) return;

  const already = picked().includes(p);
  const slot = destinationFor(p);
  const rem = capLeft();
  const over = p.$ > rem;
  const pen = slot ? getPositionPenalty(p, slot) : 0;
  const st = displayStats(p);
  const colors = TEAM_COLORS[p.t] || { primary: '#112236', accent: '#38bdf8' };

  const cell = (k, v, hl = false) => `<div class="stat-cell${hl ? ' hl' : ''}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const pmStr = st.pm > 0 ? `+${st.pm}` : `${st.pm}`;

  const stats = p.p === 'G'
    ? cell('PJ', st.gp) + cell('V', st.w, true) + cell('D', st.l) + cell('BL', st.so)
      + cell('%ARR', p.sv ?? '—') + cell('MBA', p.ga ?? '—')
    : cell('PJ', st.gp) + cell('B', st.g) + cell('A', st.a) + cell('PTS', st.pt, true)
      + cell('PTS/M', st.ppgStr) + cell('+/-', pmStr) + cell('PUN', p.pim ?? '—')
      + cell('TG/M', p.toi != null ? p.toi.toFixed ? p.toi.toFixed(1) : p.toi : '—')
      + (p.ht != null ? cell('MÉ/M', p.ht) : '')
      + (p.fo != null ? cell('MJ %', Math.round(p.fo * 100)) : '');

  let ratings;
  if (G.fogOfWar) {
    ratings = `<div class="fog-msg">🔒 Les cotes cachées restent secrètes jusqu'à la simulation.<br>
      Tu peux les afficher dans <strong>Options → brouillard de guerre</strong>, mais c'est le mode entraînement.</div>`;
  } else {
    const r = getHiddenRatings(p);
    const rc = (k, v, cls = '') => `<div class="rating-cell ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    ratings = `<div class="rating-grid">
      ${rc(p.p === 'G' ? 'TEC' : 'ATT', r.o)}${rc(p.p === 'G' ? 'BLI' : 'DÉF', r.d)}
      ${rc('ROB', r.r)}${rc('CLU', r.c)}${rc(p.p === 'G' ? 'RÉF' : 'VIT', r.sp ?? '—')}${rc('COTE', r.v, 'ovr')}
    </div>`;
  }

  const label = already ? '✓ Déjà signé' : !slot ? 'Aucune case libre' : over ? 'Hors budget' : `Signer · ${slot.role}`;
  const destNote = already ? ''
    : !slot ? `<div class="dash-note dash-bad">Toutes les cases compatibles sont prises. Déplace un joueur ou vise une autre position.</div>`
    : over ? `<div class="dash-note dash-bad">${money(p.$)} pour ${money(rem)} restants.</div>`
    : `<div class="dash-note">Ira au <strong>${esc(slot.label)} · ${esc(slot.role)}</strong>${pen > 0 ? ` avec une pénalité de <strong>−${pen}</strong> sur ses cotes` : ' sans pénalité'}. Il resterait ${money(rem - p.$)} pour ${slotsLeft() - 1} case${slotsLeft() - 1 > 1 ? 's' : ''}.</div>`;

  const nhlUrl = p.id ? `https://www.nhl.com/player/${p.id}` : `https://www.nhl.com/search?q=${encodeURIComponent(p.n)}`;
  const hdbUrl = `https://www.hockeydb.com/ihdb/stats/findplayer.php?full_name=${encodeURIComponent(p.n)}`;

  body.innerHTML = `
    <div class="pcard-full" style="--card-primary:${colors.primary};--card-accent:${colors.accent}">
      <div class="pcard-full-head">
        <div class="pcard-full-watermark">${getTeamLogoHtml(p.t, 128)}</div>
        <div class="pcard-full-top">
          <div class="pcard-full-photo">${headshotHtml(p)}</div>
          <div class="pcard-full-id">
            <div class="pcard-full-name">${formatName(p.n)}</div>
            <div class="pcard-full-team">${getTeamLogoHtml(p.t, 16)} ${esc(TEAMFULL[p.t] || p.t)} · ${esc(p.s)}
              <span class="pos-badge ${positionClass(p)}">${esc(positionLabel(p))}</span></div>
            <div class="tags pcard-full-tags">${archTag(p)}${zoneTag(p)}${ageTag(p)}${elcTag(p)}${realTag(p)}${p.x ? '<span class="tag tag-traded">↔ Échangé</span>' : ''}</div>
          </div>
        </div>
        <div class="pcard-full-salary">
          <span class="big">${st.salaryMain}</span>
          <span class="small">${st.salarySub}</span>
          <span class="small">${G.salaryMode === 'ERA' ? '' : `${p.s} : ${money(st.eraSal)}`}</span>
        </div>
      </div>
      <div class="modal-body">
        <div class="section-label">Statistiques ${G.statsProrata ? '(prorata 82 matchs, ajusté à l\'époque)' : `de la saison ${esc(p.s)}`}</div>
        <div class="stat-grid">${stats}</div>
        <div class="section-label">Profil et cotes</div>
        ${ratings}
        <div class="section-label">Impact sur ton alignement</div>
        ${destNote}
      </div>
      <div class="pcard-full-foot">
        <div class="ext-links">
          <a class="ext-link" href="${nhlUrl}" target="_blank" rel="noopener">Fiche LNH ↗</a>
          <a class="ext-link" href="${hdbUrl}" target="_blank" rel="noopener">HockeyDB ↗</a>
        </div>
        <button class="btn go" id="modalSignBtn" ${already || !slot || over ? 'disabled' : ''}>${label}</button>
      </div>
    </div>`;

  const btn = $('modalSignBtn');
  if (btn) {
    btn.onclick = () => {
      closeModal('hockeyCardModal');
      signPlayer(p);
    };
  }
  modal.style.display = 'flex';
}

/* =====================================================================
   Historique
   ===================================================================== */

function saveLeaderboard(entry) {
  try {
    const list = JSON.parse(localStorage.getItem('cap82_leaderboard') || '[]');
    list.unshift(entry);
    localStorage.setItem('cap82_leaderboard', JSON.stringify(list.slice(0, 20)));
  } catch { /* ignore */ }
}

function showLeaderboard() {
  const body = $('leaderboardBody');
  if (!body) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem('cap82_leaderboard') || '[]'); } catch { /* ignore */ }

  if (!list.length) {
    body.innerHTML = `<div class="empty-msg">Aucune saison enregistrée.<br>Complète un alignement de 23 et simule pour apparaître ici.</div>`;
    return;
  }
  const best = Math.max(...list.map(i => i.points || 0));
  body.innerHTML = list.map(i => `
    <div class="lb-item">
      <div>
        <div class="lb-score ${i.W === 82 ? 'perfect' : ''}">${i.W}-${i.L}-${i.OTL}</div>
        <div class="dash-note">${i.points} pts · différentiel ${i.GF - i.GA > 0 ? '+' : ''}${i.GF - i.GA}${i.points === best ? ' · <span class="dash-warn">meilleure</span>' : ''}</div>
      </div>
      <div class="lb-details">
        <div>${i.rank ? `${i.rank}e de ${i.nTeams}` : ''}</div>
        <div>Masse : ${money(i.capUsed)}</div>
        <div>${esc(i.date)}</div>
      </div>
    </div>`).join('');
}

/* =====================================================================
   Simulation
   ===================================================================== */

const bar = (label, val) => {
  const pct = Math.max(0, Math.min(100, (val - 25) / 74 * 100));
  return `<div class="bar"><div class="bl">${label}</div>
    <div class="bt"><div class="bf" style="width:${pct}%"></div></div>
    <div class="bv">${Math.round(val)}</div></div>`;
};

/**
 * Adversaires : de vraies équipes historiques prises dans les saisons déjà
 * chargées, alignées automatiquement. Les joueurs déjà signés sont exclus.
 */
async function buildOpponents(count) {
  const exclude = new Set(picked().map(getPlayerKey));
  const cands = [], seen = new Set();
  const collect = () => {
    for (const [season, entry] of G.shards) {
      for (const [team, pool] of Object.entries(entry.byTeam)) {
        const key = `${season}_${team}`;
        if (seen.has(key)) continue;
        const nF = pool.filter(p => p.p === 'F').length;
        const nD = pool.filter(p => isD(p)).length;
        const nG = pool.filter(p => p.p === 'G').length;
        if (nF < 12 || nD < 6 || nG < 2) continue;
        seen.add(key);
        cands.push({ season, team, pool });
      }
    }
  };
  collect();
  let tries = 0;
  while (cands.length < count && tries++ < 12) {
    try { await getShard(rnd(state.index.seasons)); } catch { /* on réessaie */ }
    collect();
  }
  return cands.sort(() => Math.random() - 0.5).slice(0, count)
    .map(c => createTeam(`${c.team} ${c.season}`, c.team, autoRoster(c.pool, exclude), { season: c.season }));
}

async function runSeason() {
  if (picked().length !== 23 || G.done || capLeft() < 0) return;
  G.done = true;
  const mb = $('mainBtn');
  mb.disabled = true;
  mb.textContent = 'Simulation de la ligue… 1 312 matchs';
  await new Promise(r => setTimeout(r, 20));

  let opponents = [];
  try { opponents = await buildOpponents(31); } catch { opponents = []; }
  if (opponents.length && opponents.length % 2 === 0) opponents.pop();

  const you = createTeam('Votre formation', 'YOU', G.roster, { isPlayer: true });
  let r, teams, leaders = [];
  if (opponents.length) {
    const league = simulateLeague([you, ...opponents]);
    teams = league.standings;
    leaders = league.leaders;
    r = {
      W: you.W, L: you.L, OTL: you.OTL, GF: you.GF, GA: you.GA, points: you.PTS,
      attaque: you.strength.att, brigade: you.strength.def,
      rob: you.strength.rob, clu: you.strength.clu, gRating: you.strength.g,
    };
  } else {
    r = simulate(G.roster);
    Object.assign(you, { W: r.W, L: r.L, OTL: r.OTL, GF: r.GF, GA: r.GA, PTS: r.points });
    teams = [you];
  }

  renderResult(r, you, teams, leaders);
}

function renderResult(r, you, teams, leaders) {
  const nTeams = teams.length;
  const rank = teams.findIndex(t => t.isPlayer) + 1;
  const perfect = (r.L + r.OTL) === 0;

  const note = perfect
    ? '82-0-0. Saison parfaite. Les Bruins de 2022-23, meilleure saison de l\'histoire, ont fini 65-12-5.'
    : r.W >= 65 ? `${r.W} victoires : mieux que le record réel de la LNH (65, Bruins de 2022-23).`
    : r.W >= 55 ? 'Grosse saison, mais la perfection exige de la profondeur sur les quatre trios.'
    : r.W >= 41 ? 'Saison au-dessus de la moyenne. Regarde tes trois derniers trios : c\'est souvent là que ça se joue.'
    : 'Le plafond a coûté cher. Les cotes révélées ci-dessous montrent où le bât blesse.';

  const rows = SLOTS.filter(s => G.roster[s.i]).map(s => {
    const p = G.roster[s.i];
    const hr = getHiddenRatings(p);
    const pmCls = (p.simPM || 0) > 0 ? 'pm-pos' : (p.simPM || 0) < 0 ? 'pm-neg' : '';
    const pmStr = (p.simPM || 0) > 0 ? `+${p.simPM}` : `${p.simPM || 0}`;
    const inj = p.simInj ? ` · <span class="inj">🩹 ${p.simInj} PJ ratés</span>` : '';
    const stats = p.p === 'G'
      ? `${p.simGP || 0} PJ · ${p.simW || 0}-${p.simL || 0}-${p.simOTL || 0} · ${((p.simGA || 0) / Math.max(1, p.simGP || 1)).toFixed(2)} MBA · ${p.simSO || 0} BL${inj}`
      : `${p.simGP || 0} PJ · <b>${p.simG || 0} B</b> ${p.simA || 0} A · <b>${p.simPTS || 0} PTS</b> · <span class="${pmCls}">${pmStr}</span>${inj}`;
    return `<div class="rrow">
      <div class="rn">${getTeamLogoHtml(p.t, 15)} <span>${formatName(p.n)} <span class="sub">${esc(s.role)}</span></span></div>
      <div class="rs">${stats} · <span class="ovr">cote ${hr.v}</span> <span class="sub">(ATT ${hr.o} DÉF ${hr.d} ROB ${hr.r} CLU ${hr.c})</span></div>
    </div>`;
  }).join('');

  const standings = teams.map((t, i) => `
    <tr class="${t.isPlayer ? 'you' : ''}${i === 15 ? ' cut' : ''}">
      <td>${i + 1}</td>
      <td class="left"><div class="team-cell">${getTeamLogoHtml(t.tag, 15)}<span>${esc(t.name)}</span></div></td>
      <td>${t.W + t.L + t.OTL}</td><td>${t.W}</td><td>${t.L}</td><td>${t.OTL}</td>
      <td class="pts">${t.PTS}</td><td>${t.GF}</td><td>${t.GA}</td>
      <td>${t.GF - t.GA > 0 ? '+' : ''}${t.GF - t.GA}</td>
    </tr>`).join('');

  const leadersRows = leaders.map((l, i) => `
    <tr class="${l.team.isPlayer ? 'you' : ''}">
      <td>${i + 1}</td>
      <td class="left"><div class="team-cell">${getTeamLogoHtml(l.team.tag, 15)}<span>${esc(l.player.n)}</span></div></td>
      <td>${l.player.simGP}</td><td>${l.player.simG}</td><td>${l.player.simA}</td>
      <td class="pts">${l.player.simPTS}</td>
    </tr>`).join('');

  const injuries = you.injuriesLog && you.injuriesLog.length
    ? `<ul class="inj-list">${you.injuriesLog.map(i => `<li><strong>${esc(i.player.n)}</strong> — ${i.games} match${i.games > 1 ? 's' : ''} ratés à partir du match ${i.at}</li>`).join('')}</ul>`
    : `<div class="dash-note">Aucune blessure cette saison. Chanceux.</div>`;

  saveLeaderboard({
    W: r.W, L: r.L, OTL: r.OTL, points: r.points, GF: r.GF, GA: r.GA,
    capUsed: capUsed(), rank, nTeams, date: new Date().toLocaleDateString('fr-CA'),
  });

  $('resultHost').style.display = '';
  $('resultHost').innerHTML = `
    <div class="result">
      <div class="result-hero">
        <div class="score ${perfect ? 'perfect' : ''}">${r.W}-${r.L}-${r.OTL}</div>
        <div class="rec">${r.points} points · ${rank}e de ${nTeams} · ${r.GF} buts pour, ${r.GA} contre · masse ${money(capUsed())}</div>
      </div>
      <div class="note">${note}</div>

      <div class="result-section">
        <h3>Forces de votre formation</h3>
        <div class="bars">
          ${bar('Attaque', r.attaque)}
          ${bar('Brigade déf.', r.brigade)}
          ${bar('Gardien', r.gRating)}
          ${bar('Robustesse', r.rob)}
          ${bar('Clutch', r.clu)}
        </div>
      </div>

      <div class="result-section">
        <h3>Classement général · ${nTeams} équipes, ${(nTeams * 82 / 2).toLocaleString('fr-CA')} matchs</h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Rang</th><th class="left">Équipe</th><th>PJ</th><th>V</th><th>D</th><th>DP</th><th>PTS</th><th>BP</th><th>BC</th><th>Diff</th></tr></thead>
          <tbody>${standings}</tbody>
        </table></div>
      </div>

      ${leaders.length ? `<div class="result-section">
        <h3>Meneurs de la ligue</h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>#</th><th class="left">Joueur</th><th>PJ</th><th>B</th><th>A</th><th>PTS</th></tr></thead>
          <tbody>${leadersRows}</tbody>
        </table></div>
      </div>` : ''}

      <div class="result-section">
        <h3>Infirmerie</h3>
        ${injuries}
      </div>

      <div class="result-section">
        <h3>Cotes cachées révélées</h3>
        ${rows}
      </div>

      <div class="result-actions">
        <button class="btn blue" id="shareBtn">📋 Copier le résultat</button>
        ${rank <= 16 ? '<button class="btn gold" id="playoffsBtn">🏆 Jouer les séries</button>' : ''}
        <button class="btn go" id="againBtn">Nouvelle partie</button>
      </div>
      <div id="playoffsSection"></div>
    </div>`;

  $('shareBtn').onclick = () => {
    const top = picked().slice().sort((a, b) => (b.pt ?? b.w ?? 0) - (a.pt ?? a.w ?? 0))[0];
    const txt = `🏒 Cap 82-0\n`
      + `Fiche : ${r.W}-${r.L}-${r.OTL} (${r.points} pts)\n`
      + `Rang : ${rank}e de ${nTeams}\n`
      + `Masse salariale : ${money(capUsed())} / ${money(CAP)}\n`
      + `Vedette : ${top ? `${top.n} (${top.t} ${top.s})` : '—'}\n`
      + `Essaie de faire 82-0.`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(txt)
        .then(() => toast('Fiche copiée dans le presse-papier.'))
        .catch(() => toast('Copie impossible sur ce navigateur.', 'bad'));
    } else {
      toast('Copie impossible sur ce navigateur.', 'bad');
    }
  };

  if (rank <= 16) $('playoffsBtn').onclick = () => runPlayoffs(teams.slice(0, 16));
  $('againBtn').onclick = () => newGame();

  renderMain();
  $('resultHost').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function runPlayoffs(top16) {
  const host = $('playoffsSection');
  if (!host) return;

  const names = ['Premier tour', 'Deuxième tour', 'Demi-finales', 'Finale de la Coupe Stanley'];
  let round = top16.slice(), n = 0;
  let html = `<div class="result-section"><h3>🏆 Séries éliminatoires</h3>`;

  while (round.length > 1) {
    const next = [];
    html += `<div class="series-round"><h4>${names[n] || `Ronde ${n + 1}`}</h4><div class="series-grid">`;
    for (let i = 0; i < round.length / 2; i++) {
      const A = round[i], B = round[round.length - 1 - i];
      const s = playSeries(A, B);
      next.push(s.winner);
      const rowA = `<div class="series-row ${s.winner === A ? 'win' : 'lose'}"><div class="team-cell">${getTeamLogoHtml(A.tag, 15)}<span>${esc(A.name)}</span></div><span>${s.wA}</span></div>`;
      const rowB = `<div class="series-row ${s.winner === B ? 'win' : 'lose'}"><div class="team-cell">${getTeamLogoHtml(B.tag, 15)}<span>${esc(B.name)}</span></div><span>${s.wB}</span></div>`;
      html += `<div class="series ${A.isPlayer || B.isPlayer ? 'you' : ''}">${rowA}${rowB}</div>`;
    }
    html += `</div></div>`;
    round = next;
    n++;
  }

  const champ = round[0];
  html += `<div class="champion">
    <h3>Champion de la Coupe Stanley</h3>
    <div class="champ-name">${getTeamLogoHtml(champ.tag, 30)} ${esc(champ.name)}</div>
    <p>${champ.isPlayer ? 'Ta formation soulève la Coupe. 🏆' : 'Ta formation est tombée en chemin. Rebâtis et réessaie.'}</p>
  </div></div>`;

  host.innerHTML = html;
  const btn = $('playoffsBtn');
  if (btn) btn.disabled = true;
  host.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function newGame() {
  clearSave();
  G.roster = {};
  G.left = { ...REROLLS };
  G.target = null;
  G.selectedSlot = null;
  G.done = false;
  G.search = '';
  G.filter = 'ALL';
  const search = $('searchInput');
  if (search) search.value = '';
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  setView('pool');
  await nextSpin(true, true);
  saveGame();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.cap82 = { G, cacheClear, simulate };
boot();
