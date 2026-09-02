import { loadIndex, loadSeason, prefetch, state, cacheClear } from './data.js';
import { SLOTS, CAP, REROLLS, fits, simulate, simulateMatch, getPositionPenalty, registerHiddenRatings, getHiddenRatings, getUnitSynergy } from './sim.js';
import { getTeamLogoHtml, TEAM_COLORS } from './logos.js';
import { getArchetype, getEraFactor, getEraSalary, SEASON_ERA_CAP } from './ratings.js';

const $ = id => document.getElementById(id);
const money = n => '$' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
const rnd = a => a[Math.floor(Math.random() * a.length)];

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
const DEFUNCT = new Set(['QUE','HFD','MNS','AFM','ATL','KCS','CLR','CLE','CGS','OAK','WIN','PHX','MDA','ARI']);

/* ---------- sauvegarde ---------- */

function saveGame() {
  if (G.done) {
    clearSave();
    return;
  }
  try {
    const data = {
      roster: G.roster,
      left: G.left,
      cur: G.cur ? { season: G.cur.season, team: G.cur.team } : null,
      target: G.target,
    };
    localStorage.setItem('cap82_save', JSON.stringify(data));
  } catch {}
}

function clearSave() {
  try { localStorage.removeItem('cap82_save'); } catch {}
}

async function restoreSave() {
  try {
    const raw = localStorage.getItem('cap82_save');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.cur || !data.cur.season) return false;

    const shard = await getShard(data.cur.season);
    if (!shard || !shard.byTeam[data.cur.team]) return false;

    // Charger les shards pour toutes les saisons des joueurs signés afin de remplir RATINGS_VAULT
    if (data.roster) {
      const rosterSeasons = new Set(Object.values(data.roster).filter(Boolean).map(p => p.s));
      for (const sLabel of rosterSeasons) {
        if (sLabel && sLabel !== data.cur.season) {
          try { await getShard(sLabel); } catch {}
        }
      }
    }

    G.cur = { season: data.cur.season, team: data.cur.team, pool: shard.byTeam[data.cur.team] };
    G.roster = data.roster || {};
    G.left = data.left || { ...REROLLS };
    G.target = data.target ?? null;

    const colors = TEAM_COLORS[data.cur.team] || { primary: '#112236', accent: '#38bdf8' };
    document.documentElement.style.setProperty('--team-primary', colors.primary);
    document.documentElement.style.setProperty('--team-accent', colors.accent);

    return true;
  } catch {
    return false;
  }
}

/* ---------- état ---------- */

const G = {
  roster: {},
  cur: null,          // { season, team, pool }
  left: { ...REROLLS },
  target: null,
  selectedSlot: null, // slot sélectionné pour déplacement / permutation
  filter: 'ALL',
  sortBy: 'PTS',
  compactView: true,  // true = Compact View (screenshot), false = Detailed View
  layoutMode: 'classic', // 'classic' or 'rink'
  statsProrata: false,
  salaryMode: '2026', // '2026' or 'ERA'
  fogOfWar: false,    // false = Hexagon ON, true = Fog of War (Hexagon OFF)
  done: false,
  loading: false,
  shards: new Map(),  // saison -> { players, byTeam }
};

const picked = () => Object.values(G.roster);
const capUsed = () => picked().reduce((s, p) => s + p.$, 0);
const openSlots = p => SLOTS.filter(s => !G.roster[s.i] && fits(p, s))
  .sort((a, b) => getPositionPenalty(p, a) - getPositionPenalty(p, b) || a.i - b.i);
const nextNeed = () => SLOTS.find(s => !G.roster[s.i]) || null;

function getPositionLabel(p) {
  if (!p) return '';
  if (p.np === 'LD' || p.np === 'DG') return 'DG (LD)';
  if (p.np === 'RD' || p.np === 'DD') return 'DD (RD)';
  if (p.np === 'L' || p.np === 'AG') return 'AG (LW)';
  if (p.np === 'R' || p.np === 'AD') return 'AD (RW)';
  if (p.np === 'C') return 'C';
  if (p.p === 'G') return 'G';
  return p.np || p.p;
}

/* ---------- démarrage ---------- */

async function boot() {
  try {
    await loadIndex();
    if (!state.index.seasons.length) throw new Error('aucune saison disponible');
    setupEvents();
    const restored = await restoreSave();
    if (!restored) {
      await nextSpin(true, true);
    }
    $('boot').style.display = 'none';
    $('game').style.display = '';
    render();
  } catch (e) {
    $('boot').innerHTML = `<div class="err">Impossible de charger les données.<br>
      <span class="mono">${e.message}</span><br><br>
      Vérifie que <span class="mono">data/index.json</span> existe, ou lance
      <span class="mono">python3 scripts/build_shards.py</span>.</div>`;
  }
}

function setupEvents() {
  const tLayout = $('toggleLayoutBtn');
  if (tLayout) {
    tLayout.onclick = () => {
      G.layoutMode = G.layoutMode === 'classic' ? 'rink' : 'classic';
      tLayout.textContent = G.layoutMode === 'rink' ? '🏒 INVERSÉE (RINK)' : '📐 CLASSIQUE';
      tLayout.classList.toggle('active', G.layoutMode === 'rink');
      document.body.classList.toggle('layout-rink', G.layoutMode === 'rink');
      render();
    };
  }

  const tView = $('toggleViewBtn');
  if (tView) {
    tView.onclick = () => {
      G.compactView = !G.compactView;
      tView.textContent = G.compactView ? '🎴 COMPACTE' : '🎴 DÉTAILLÉE';
      tView.classList.toggle('active', G.compactView);
      render();
    };
  }

  const tStats = $('toggleStatsBtn');
  if (tStats) {
    tStats.onclick = () => {
      G.statsProrata = !G.statsProrata;
      tStats.textContent = G.statsProrata ? '📊 PRO RATA 82M' : '📊 RÉELLES';
      tStats.classList.toggle('active', G.statsProrata);
      render();
    };
  }

  const tSal = $('toggleSalBtn');
  if (tSal) {
    tSal.onclick = () => {
      G.salaryMode = G.salaryMode === '2026' ? 'ERA' : '2026';
      tSal.textContent = G.salaryMode === 'ERA' ? '📜 VALEUR ÉPOQUE' : '💵 VALEUR 2026';
      tSal.classList.toggle('active', G.salaryMode === '2026');
      render();
    };
  }

  const tFog = $('toggleFogBtn');
  if (tFog) {
    tFog.onclick = () => {
      G.fogOfWar = !G.fogOfWar;
      tFog.textContent = G.fogOfWar ? '🔒 FOG OF WAR' : '⬢ HEXA ON';
      tFog.classList.toggle('active', !G.fogOfWar);
      if (G.fogOfWar) hideRadar();
      render();
    };
  }

  const sSelect = $('sortSelect');
  if (sSelect) {
    sSelect.onchange = () => {
      G.sortBy = sSelect.value;
      render();
    };
  }

  const lbBtn = $('openLeaderboardBtn');
  if (lbBtn) lbBtn.onclick = showLeaderboard;

  const closeLbBtn = $('closeLeaderboardBtn');
  if (closeLbBtn) closeLbBtn.onclick = hideLeaderboard;

  const bibleBtn = $('openBibleBtn');
  if (bibleBtn) bibleBtn.onclick = showBible;

  const closeBibleBtn = $('closeBibleBtn');
  if (closeBibleBtn) closeBibleBtn.onclick = hideBible;

  const closeCardBtn = $('closeHockeyCardBtn');
  if (closeCardBtn) closeCardBtn.onclick = hideHockeyCardModal;

  window.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      hideHockeyCardModal();
      hideLeaderboard();
      hideBible();
    }
  });

  const hockeyModal = $('hockeyCardModal');
  if (hockeyModal) {
    hockeyModal.onclick = ev => {
      if (ev.target === hockeyModal) hideHockeyCardModal();
    };
  }
}

/* ---------- roulette ---------- */

async function getShard(label) {
  if (G.shards.has(label)) return G.shards.get(label);
  const shard = await loadSeason(label);
  const byTeam = {};
  for (const p of shard.players) {
    if ((p.p === 'D' || p.p === 'LD' || p.p === 'RD') && (!p.np || p.np === 'D')) {
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
  render();

  const need = nextNeed();
  const seasons = state.index.seasons;

  for (let attempt = 0; attempt < 25; attempt++) {
    let season = (!newSeason && G.cur) ? G.cur.season : rnd(seasons);
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

    const colors = TEAM_COLORS[team] || { primary: '#112236', accent: '#38bdf8' };
    document.documentElement.style.setProperty('--team-primary', colors.primary);
    document.documentElement.style.setProperty('--team-accent', colors.accent);

    saveGame();
    prefetch([rnd(seasons), rnd(seasons)]);
    return;
  }

  G.loading = false;
  G.cur = G.cur || { season: '—', team: '—', pool: [] };
}

/* ---------- rendu ---------- */

function renderCap() {
  const used = capUsed(), rem = CAP - used;
  const isEra = G.salaryMode === 'ERA';
  const curSeason = G.cur ? G.cur.season : '2025-26';
  const eraCapMax = SEASON_ERA_CAP[curSeason] || CAP;
  const remEra = getEraSalary(rem, curSeason);

  const a = $('capAmt');
  if (isEra) {
    a.textContent = money(remEra);
  } else {
    a.textContent = money(rem);
  }
  a.classList.toggle('over', rem < 0);

  const f = $('capFill');
  f.style.width = Math.min(100, Math.max(0, (used / CAP) * 100)) + '%';
  f.classList.toggle('over', rem < 0);
  $('cnt').textContent = `${picked().length} / 23`;

  if ($('capMaxLbl')) {
    $('capMaxLbl').textContent = isEra ? `/ ${money(eraCapMax)} (${curSeason})` : `/ ${money(CAP)}`;
  }

  const need = nextNeed();
  const lbl = $('nextNeedLbl');
  if (lbl) {
    lbl.textContent = need ? `À COMBLER: ${need.role} (${need.label})` : 'ALIGNEMENT COMPLET';
  }
}

function renderSpin() {
  const host = $('spin');
  if (G.loading) {
    host.innerHTML = `<div class="spin-card"><div class="spin-team-name">CHARGEMENT…</div></div>`;
    return;
  }
  const full = TEAMFULL[G.cur.team];
  const dead = DEFUNCT.has(G.cur.team) ? ' · DISPARUE' : '';

  const logoHtml = getTeamLogoHtml(G.cur.team, 52);

  host.innerHTML = `
    <div class="spin-card">
      <div class="spin-badge-top">${picked().length}/23 SIGNÉS</div>
      <div class="spin-header">
        <div class="spin-logo">${logoHtml}</div>
        <div class="spin-title-group">
          <div class="spin-team-name">${G.cur.team}</div>
          <div class="spin-team-full">${full ? full + dead : ''} · ${G.cur.season}</div>
        </div>
      </div>
      <div class="spin-instruction">
        Pige <strong>un joueur</strong> pour n'importe quel poste disponible — puis la roulette tourne à nouveau
      </div>
      <div class="rerolls">
        <button id="rrS" class="reroll-btn" ${G.left.season ? '' : 'disabled'}>
          🎲 AUTRE ANNÉE
          <span class="badge">${G.left.season} RESTANTS</span>
        </button>
        <button id="rrT" class="reroll-btn" ${G.left.team ? '' : 'disabled'}>
          🔄 AUTRE ÉQUIPE
          <span class="badge">${G.left.team} RESTANTS</span>
        </button>
        <button id="rrP" class="reroll-btn" ${G.left.pass ? '' : 'disabled'}>
          ⏭️ PASSER
          <span class="badge">${G.left.pass} RESTANTS</span>
        </button>
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

function getSeasonMaxGP(season) {
  if (season === '1994-95' || season === '2012-13') return 48;
  if (season === '2020-21') return 56;
  if (season === '2019-20') return 70;
  return 82;
}

function getPlayerDisplayStats(p) {
  const maxGP = getSeasonMaxGP(p.s);
  const factor = (G.statsProrata && maxGP < 82) ? (82 / maxGP) : 1;
  const eraFactor = G.statsProrata ? getEraFactor(p.s) : 1;

  const gp = Math.round(p.gp * factor);
  const g = Math.round(p.g * factor * eraFactor);
  const a = Math.round(p.a * factor * eraFactor);
  const pt = Math.round(p.pt * factor * eraFactor);
  const pm = Math.round(p.pm * factor);
  const w = Math.round((p.w ?? 0) * factor);
  const l = Math.round((p.l ?? 0) * factor);
  const so = Math.round((p.so ?? 0) * factor);

  const eraSal = getEraSalary(p.$, p.s);
  const isEra = G.salaryMode === 'ERA';

  const salaryPrimary = isEra ? `${money(eraSal)} ('${p.s.slice(-2)})` : money(p.$);
  const salarySub = isEra
    ? `<span class="cap-pct">Jeu 2026: ${money(p.$)}</span>`
    : `<span class="cap-pct">Réel ${p.s}: ${money(eraSal)}</span>`;

  return { factor, eraFactor, maxGP, gp, g, a, pt, pm, w, l, so, eraSal, salaryPrimary, salarySub };
}

function formatPlayerName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return `<strong class="lname">${fullName}</strong>`;
  const lastName = parts.pop();
  const firstName = parts.join(' ');
  return `<span class="fname">${firstName}</span> <strong class="lname">${lastName}</strong>`;
}

function getHeadshotHtml(p, size = 44) {
  if (p.id) {
    return `<img class="headshot-img" src="https://assets.nhle.com/mugs/nhl/latest/${p.id}.png" alt="${p.n}" onerror="this.onerror=null;this.replaceWith(document.createRange().createContextualFragment('<div class=\\'headshot-fallback\\'>👤</div>'));">`;
  }
  return `<div class="headshot-fallback">👤</div>`;
}

function slotCardEl(s) {
  const p = G.roster[s.i];
  const d = document.createElement('div');
  const pen = p ? getPositionPenalty(p, s) : 0;

  d.className = 'slot-card' + (p ? '' : ' empty') + (G.selectedSlot === s.i ? ' selected' : G.target === s.i ? ' target' : '') + (pen > 0 ? ' oop' : '');

  if (p) {
    const penTag = pen > 0 ? `<span class="tag-pen">-${pen}</span>` : '';
    const logo = getTeamLogoHtml(p.t, 14);
    const st = getPlayerDisplayStats(p);
    const arch = getArchetype(p);

    let statValue = p.p === 'G' ? st.w : st.pt;
    let statUnit = p.p === 'G' ? 'V' : 'PTS';

    const pmClass = st.pm > 0 ? 'pm-pos' : st.pm < 0 ? 'pm-neg' : '';
    const pmStr = st.pm > 0 ? `+${st.pm}` : `${st.pm}`;

    let subStats = p.p === 'G'
      ? `${p.sv ?? '—'} SV · ${p.ga ?? '—'} MBA`
      : `${st.g}G ${st.a}A · <span class="${pmClass}">${pmStr}</span>`;

    const headshotMini = p.id
      ? `<img class="slot-headshot" src="https://assets.nhle.com/mugs/nhl/latest/${p.id}.png" onerror="this.style.display='none'">`
      : '';

    d.innerHTML = `
      <button class="slot-remove-btn" data-i="${s.i}" title="Retirer">✕</button>
      <div class="slot-top">
        <div class="slot-player-group">
          ${headshotMini}
          <div class="slot-player-name">${formatPlayerName(p.n)} ${penTag}</div>
        </div>
        <div class="slot-salary">${st.salaryPrimary}</div>
      </div>
      <div class="slot-arch-badge" title="${arch.desc}">${arch.icon} ${arch.label}</div>
      <div class="slot-big-stat">${statValue}<span class="stat-unit">${statUnit}</span></div>
      <div class="slot-bottom">
        <div class="slot-team-info">${logo} ${p.t} '${p.s.slice(-2)}</div>
        <div>${subStats}</div>
      </div>`;

    if (!G.fogOfWar) attachRadarEvents(d, p);
  } else {
    d.innerHTML = `<div class="empty-role-lbl">+ ${s.role}</div><div style="font-size:9.5px;color:var(--muted);margin-top:2px">${s.label}</div>`;
  }

  d.onclick = () => {
    if (G.selectedSlot !== null) {
      if (G.selectedSlot === s.i) {
        G.selectedSlot = null;
      } else {
        const srcIndex = G.selectedSlot;
        const srcPlayer = G.roster[srcIndex];
        const destPlayer = G.roster[s.i];

        if (srcPlayer) G.roster[s.i] = srcPlayer; else delete G.roster[s.i];
        if (destPlayer) G.roster[srcIndex] = destPlayer; else delete G.roster[srcIndex];

        G.selectedSlot = null;
        G.target = null;
        saveGame();
      }
    } else {
      if (p) {
        G.selectedSlot = s.i;
      } else {
        G.target = (G.target === s.i ? null : s.i);
      }
    }
    render();
  };
  return d;
}

function renderRoster() {
  const board = $('rosterBoard');
  if (!board) return;

  if (G.layoutMode === 'rink') {
    board.className = 'roster-board rink-mode';
    board.innerHTML = `
      <div class="rink-surface">
        <div class="rink-marking red-line"></div>
        <div class="rink-marking blue-line-top"></div>
        <div class="rink-marking blue-line-bottom"></div>
        <div class="rink-marking center-circle"></div>
        <div class="rink-marking crease"></div>

        <div class="rink-zone zone-forwards">
          <div class="rink-zone-title">💥 ATTAQUE (4 TRIOS)</div>
          <div class="rink-lines-container" id="rinkForwards"></div>
        </div>

        <div class="rink-zone zone-defense">
          <div class="rink-zone-title">🛡️ DÉFENSE (3 PAIRES)</div>
          <div class="rink-lines-container" id="rinkDefense"></div>
        </div>

        <div class="rink-zone zone-goalies">
          <div class="rink-zone-title">🥅 GARDIENS & RÉSERVES</div>
          <div class="rink-lines-container" id="rinkGoalies"></div>
        </div>
      </div>`;

    const fwHost = $('rinkForwards');
    if (fwHost) {
      for (let u = 0; u < 4; u++) {
        const lineEl = document.createElement('div');
        lineEl.className = 'rink-line-row';
        const lwSlot = SLOTS.find(s => s.role === 'AG' && s.unit === u);
        const cSlot = SLOTS.find(s => s.role === 'C' && s.unit === u);
        const rwSlot = SLOTS.find(s => s.role === 'AD' && s.unit === u);
        if (lwSlot) lineEl.appendChild(slotCardEl(lwSlot));
        if (cSlot) lineEl.appendChild(slotCardEl(cSlot));
        if (rwSlot) lineEl.appendChild(slotCardEl(rwSlot));
        fwHost.appendChild(lineEl);
      }
    }

    const defHost = $('rinkDefense');
    if (defHost) {
      for (let u = 0; u < 3; u++) {
        const pairEl = document.createElement('div');
        pairEl.className = 'rink-line-row def-pair';
        const ldSlot = SLOTS.find(s => s.role === 'DG' && s.unit === u);
        const rdSlot = SLOTS.find(s => s.role === 'DD' && s.unit === u);
        if (ldSlot) pairEl.appendChild(slotCardEl(ldSlot));
        if (rdSlot) pairEl.appendChild(slotCardEl(rdSlot));
        defHost.appendChild(pairEl);
      }
    }

    const gHost = $('rinkGoalies');
    if (gHost) {
      const gRow = document.createElement('div');
      gRow.className = 'rink-line-row goalies-row';
      const gSlots = SLOTS.filter(s => s.group === 'G' || s.scratch);
      gSlots.forEach(s => gRow.appendChild(slotCardEl(s)));
      gHost.appendChild(gRow);
    }

  } else {
    board.className = 'roster-board';
    board.innerHTML = `
      <div class="roster-col col-lw"><div class="col-header"><span class="col-title">AG / LW</span><span class="col-count" id="lwCnt">0/4</span></div><div class="col-slots" id="lwSlots"></div></div>
      <div class="roster-col col-c"><div class="col-header"><span class="col-title">C</span><span class="col-count" id="cCnt">0/4</span></div><div class="col-slots" id="cSlots"></div></div>
      <div class="roster-col col-rw"><div class="col-header"><span class="col-title">AD / RW</span><span class="col-count" id="rwCnt">0/4</span></div><div class="col-slots" id="rwSlots"></div></div>
      <div class="roster-col col-ld"><div class="col-header"><span class="col-title">DG / LD</span><span class="col-count" id="ldCnt">0/3</span></div><div class="col-slots" id="ldSlots"></div></div>
      <div class="roster-col col-rd"><div class="col-header"><span class="col-title">DD / RD</span><span class="col-count" id="rdCnt">0/3</span></div><div class="col-slots" id="rdSlots"></div></div>
      <div class="roster-col col-g"><div class="col-header"><span class="col-title">G / RÉSERVES</span><span class="col-count" id="gCnt">0/5</span></div><div class="col-slots" id="gSlots"></div></div>`;

    const categories = {
      LW: SLOTS.filter(s => s.role === 'AG'),
      C: SLOTS.filter(s => s.role === 'C'),
      RW: SLOTS.filter(s => s.role === 'AD'),
      LD: SLOTS.filter(s => s.role === 'DG'),
      RD: SLOTS.filter(s => s.role === 'DD'),
      G: SLOTS.filter(s => s.group === 'G' || s.scratch)
    };

    const populateCol = (containerId, cntId, slotsList) => {
      const container = $(containerId);
      if (!container) return;
      container.innerHTML = '';
      let filled = 0;
      slotsList.forEach(s => {
        if (G.roster[s.i]) filled++;
        container.appendChild(slotCardEl(s));
      });
      const cntEl = $(cntId);
      if (cntEl) cntEl.textContent = `${filled}/${slotsList.length}`;
    };

    populateCol('lwSlots', 'lwCnt', categories.LW);
    populateCol('cSlots', 'cCnt', categories.C);
    populateCol('rwSlots', 'rwCnt', categories.RW);
    populateCol('ldSlots', 'ldCnt', categories.LD);
    populateCol('rdSlots', 'rdCnt', categories.RD);
    populateCol('gSlots', 'gCnt', categories.G);
  }

  renderChemistry();

  document.querySelectorAll('.slot-remove-btn').forEach(b => {
    b.onclick = ev => {
      ev.stopPropagation();
      delete G.roster[+b.dataset.i];
      saveGame();
      render();
    };
  });
}

function renderFilters() {
  const h = $('filters');
  h.innerHTML = '';
  [
    ['ALL', 'Tous'],
    ['C', 'Centres (C)'],
    ['AG', 'Ailiers G (AG)'],
    ['AD', 'Ailiers D (AD)'],
    ['LD', 'Déf. Gauche (DG)'],
    ['RD', 'Déf. Droit (DD)'],
    ['D', 'Défenseurs (Tous)'],
    ['G', 'Gardiens (G)'],
  ].forEach(([k, l]) => {
    const b = document.createElement('button');
    b.className = G.filter === k ? 'on' : '';
    b.textContent = l;
    b.onclick = () => { G.filter = k; render(); };
    h.appendChild(b);
  });
}

function renderPool() {
  const host = $('pool');
  host.innerHTML = '';
  if (G.loading) { host.innerHTML = '<div class="empty-msg">Recherche des joueurs dans le vestiaire…</div>'; return; }

  const used = capUsed();
  let list = G.cur.pool.slice();
  if (G.filter === 'C') list = list.filter(p => p.np === 'C');
  else if (G.filter === 'AG') list = list.filter(p => p.np === 'L' || p.np === 'AG');
  else if (G.filter === 'AD') list = list.filter(p => p.np === 'R' || p.np === 'AD');
  else if (G.filter === 'LD') list = list.filter(p => (p.p === 'D' || p.p === 'LD' || p.p === 'RD') && (p.np === 'LD' || p.np === 'L' || p.np === 'DG'));
  else if (G.filter === 'RD') list = list.filter(p => (p.p === 'D' || p.p === 'LD' || p.p === 'RD') && (p.np === 'RD' || p.np === 'R' || p.np === 'DD'));
  else if (G.filter === 'D') list = list.filter(p => p.p === 'D' || p.p === 'LD' || p.p === 'RD');
  else if (G.filter === 'G') list = list.filter(p => p.p === 'G');

  if (G.sortBy === 'SAL') {
    list.sort((a, b) => b.$ - a.$ || (b.pt ?? b.w ?? 0) - (a.pt ?? a.w ?? 0));
  } else if (G.sortBy === 'PM') {
    list.sort((a, b) => (b.pm ?? 0) - (a.pm ?? 0) || (b.pt ?? b.w ?? 0) - (a.pt ?? a.w ?? 0));
  } else if (G.sortBy === 'NAME') {
    list.sort((a, b) => a.n.localeCompare(b.n));
  } else {
    // PTS
    list.sort((a, b) => (b.pt ?? b.w ?? 0) - (a.pt ?? a.w ?? 0) || b.$ - a.$);
  }

  const cntEl = $('poolCount');
  if (cntEl) cntEl.textContent = `${list.length} disponibles`;

  if (!list.length) {
    host.innerHTML = `<div class="empty-msg">Aucun joueur correspondant dans ce vestiaire.<br>Change de filtre ou utilise les options de relance.</div>`;
    return;
  }

  const poolColsDef = [
    { key: 'AG', title: 'AG / LW', test: p => p.p !== 'G' && p.p !== 'D' && p.p !== 'LD' && p.p !== 'RD' && (p.np === 'L' || p.np === 'AG') },
    { key: 'C',  title: 'C',       test: p => p.p !== 'G' && p.p !== 'D' && p.p !== 'LD' && p.p !== 'RD' && (p.np === 'C' || (p.np !== 'L' && p.np !== 'R' && p.np !== 'AG' && p.np !== 'AD')) },
    { key: 'AD', title: 'AD / RW', test: p => p.p !== 'G' && p.p !== 'D' && p.p !== 'LD' && p.p !== 'RD' && (p.np === 'R' || p.np === 'AD') },
    { key: 'LD', title: 'DG / LD', test: p => (p.p === 'D' || p.p === 'LD' || p.p === 'RD') && (p.np === 'LD' || p.np === 'L' || p.np === 'DG') },
    { key: 'RD', title: 'DD / RD', test: p => (p.p === 'D' || p.p === 'LD' || p.p === 'RD') && (p.np === 'RD' || p.np === 'R' || p.np === 'DD') },
    { key: 'G',  title: 'G',       test: p => p.p === 'G' },
  ];

  const colsMap = new Map();
  poolColsDef.forEach(col => {
    const players = list.filter(col.test);
    colsMap.set(col.key, { ...col, players });
  });

  const slotFilters = {
    AG: s => s.role === 'AG',
    C:  s => s.role === 'C',
    AD: s => s.role === 'AD',
    LD: s => s.role === 'DG',
    RD: s => s.role === 'DD',
    G:  s => s.group === 'G' || s.scratch
  };

  poolColsDef.forEach(colDef => {
    const colData = colsMap.get(colDef.key);
    const colEl = document.createElement('div');
    colEl.className = 'pool-col';

    const catSlots = SLOTS.filter(slotFilters[colDef.key] || (() => false));
    const filledCount = catSlots.filter(s => G.roster[s.i]).length;
    const totalCount = catSlots.length;

    const headerEl = document.createElement('div');
    headerEl.className = 'pool-col-header';
    headerEl.innerHTML = `<span class="pool-col-title">${colDef.title}</span> <span class="pool-col-count">${filledCount}/${totalCount}</span>`;
    colEl.appendChild(headerEl);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'pool-col-cards';

    if (!colData.players.length) {
      cardsContainer.innerHTML = `<div class="empty-msg" style="padding:16px 4px;font-size:11px;">Aucun</div>`;
    } else {
      for (const p of colData.players) {
        const already = picked().includes(p);
        const opts = openSlots(p);
        const slot = (G.target !== null && !G.roster[G.target] && fits(p, SLOTS[G.target]))
          ? SLOTS[G.target] : opts[0];
        const over = (used + p.$) > CAP;
        const pen = slot ? getPositionPenalty(p, slot) : 0;
        const penStr = pen > 0 ? ` <span class="tag-pen">-${pen}</span>` : '';
        const foStr = p.fo != null ? ` · ${Math.round(p.fo * 100)}% MJ` : '';
        const htStr = p.ht != null ? ` · ${p.ht} CH/M` : '';

        const st = getPlayerDisplayStats(p);

        const pmClass = st.pm > 0 ? 'pm-pos' : st.pm < 0 ? 'pm-neg' : '';
        const pmStr = st.pm > 0 ? `+${st.pm}` : `${st.pm}`;

        const stat = p.p === 'G'
          ? `${st.gp}PJ · ${st.w}V-${st.l}D · ${p.sv ?? '—'} SV`
          : `${st.gp}PJ · ${st.g}B ${st.a}A · <span class="${pmClass}">${pmStr}</span>`;

        const mainBadgeVal = p.p === 'G' ? st.w : st.pt;
        const mainBadgeLbl = p.p === 'G' ? 'VIC' : 'PTS';

        const logo = getTeamLogoHtml(p.t, 18);
        const headshot = getHeadshotHtml(p, 36);

        const hdbUrl = `https://www.hockeydb.com/ihdb/stats/findplayer.php?full_name=${encodeURIComponent(p.n)}`;
        const nhlUrl = p.id ? `https://www.nhl.com/player/${p.id}` : `https://www.nhl.com/search?q=${encodeURIComponent(p.n)}`;

        const linksHtml = `<a class="ext-link" href="${nhlUrl}" target="_blank" title="Fiche NHL.com" onclick="event.stopPropagation()">NHL🔗</a> <a class="ext-link" href="${hdbUrl}" target="_blank" title="Fiche HockeyDB" onclick="event.stopPropagation()">HDB🔗</a>`;

        const priceDisplay = st.salaryPrimary;
        const subCapStr = st.salarySub;

        let btnLabel = '+ SIGNER';
        if (already) btnLabel = '✓ SIGNÉ';
        else if (!slot) btnLabel = '× POSITION PLEINE';
        else if (over) btnLabel = '× HORS BUDGET';

        const compactSubStats = p.p === 'G'
          ? `${st.gp}PJ · ${p.sv ?? '—'} SV · ${p.ga ?? '—'} MBA`
          : `${st.g}G ${st.a}A · <span class="${pmClass}">${pmStr}</span>`;

        const c = document.createElement('div');
        c.style.cursor = 'pointer';

        if (G.compactView) {
          c.className = 'card compact' + (already || !slot || over ? ' dimmed' : '');
          c.innerHTML = `
            <div class="compact-top">
              <div class="compact-name">${formatPlayerName(p.n)}${p.x ? ' <span class="tag">échangé</span>' : ''}${penStr}</div>
              <div class="compact-price">${priceDisplay}</div>
            </div>
            <div class="compact-middle">
              <div class="compact-big-stat">
                <span class="compact-stat-num">${mainBadgeVal}</span>
                <span class="compact-stat-unit">${mainBadgeLbl}</span>
              </div>
              <div class="compact-headshot">
                ${headshot}
                <div class="team-badge-sub" style="width:14px;height:14px;">${logo}</div>
              </div>
            </div>
            <div class="compact-sub-stats">${compactSubStats}</div>
            <div class="card-row-bottom" style="margin-top:2px;">
              <button class="add compact-add" ${already || !slot || over ? 'disabled' : ''}>${btnLabel}</button>
            </div>`;
        } else {
          c.className = 'card' + (already || !slot || over ? ' dimmed' : '');
          c.innerHTML = `
            <div class="card-row-top">
              <div class="card-avatar" style="width:36px;height:36px;">
                ${headshot}
                <div class="team-badge-sub" style="width:14px;height:14px;">${logo}</div>
              </div>
              <div class="info">
                <div class="nm" style="font-size:13.5px;">${formatPlayerName(p.n)}${p.x ? '<span class="tag">échangé</span>' : ''}${penStr}</div>
                <div class="mt" style="font-size:10px;">${getPositionLabel(p)} · ${p.t} ${p.s}</div>
              </div>
            </div>
            <div style="font-size:10.5px;color:var(--text);display:flex;justify-content:space-between;align-items:center;">
              <span><span class="big-stat-badge" style="padding:0 4px;"><span class="big-stat-val" style="font-size:12px;">${mainBadgeVal}</span><span class="big-stat-lbl">${mainBadgeLbl}</span></span>${stat}</span>
              ${linksHtml}
            </div>
            <div class="card-row-bottom">
              <div class="cp" style="font-size:12px;">${priceDisplay}${subCapStr}</div>
              <button class="add" style="padding:5px 10px;font-size:11px;" ${already || !slot || over ? 'disabled' : ''}>${btnLabel}</button>
            </div>`;
        }

        c.onclick = (ev) => {
          if (ev.target.closest('.add') || ev.target.closest('.ext-link')) return;
          showHockeyCardModal(p);
        };

        c.querySelector('.add').onclick = async (ev) => {
          ev.stopPropagation();
          if (already || !slot || over) return;
          G.roster[slot.i] = p;
          G.target = null;
          await nextSpin(true, true);
          saveGame();
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        if (!G.fogOfWar) attachRadarEvents(c, p);

        cardsContainer.appendChild(c);
      }
    }
    colEl.appendChild(cardsContainer);
    host.appendChild(colEl);
  });
}

function renderChemistry() {
  const chemBar = $('chemBar');
  if (!chemBar) return;

  const trioNames = ['1er Trio', '2e Trio', '3e Trio', '4e Trio'];
  const pairNames = ['1re Paire', '2e Paire', '3e Paire'];
  let badges = [];

  trioNames.forEach((name, unit) => {
    const syn = getUnitSynergy(G.roster, 'F', unit);
    if (syn && (syn.bonusOff !== 0 || syn.bonusDef !== 0)) {
      const isGood = (syn.bonusOff + syn.bonusDef) > 0;
      const isBad = (syn.bonusOff + syn.bonusDef) < 0;
      const cls = isGood ? 'good' : isBad ? 'bad' : '';
      badges.push(`<div class="chem-badge ${cls}"><strong>${name}:</strong> ${syn.name} (${syn.desc})</div>`);
    }
  });

  pairNames.forEach((name, unit) => {
    const syn = getUnitSynergy(G.roster, 'D', unit);
    if (syn && (syn.bonusOff !== 0 || syn.bonusDef !== 0)) {
      const isGood = (syn.bonusOff + syn.bonusDef) > 0;
      const isBad = (syn.bonusOff + syn.bonusDef) < 0;
      const cls = isGood ? 'good' : isBad ? 'bad' : '';
      badges.push(`<div class="chem-badge ${cls}"><strong>${name}:</strong> ${syn.name} (${syn.desc})</div>`);
    }
  });

  if (badges.length) {
    chemBar.style.display = 'flex';
    chemBar.innerHTML = badges.join('');
  } else {
    chemBar.style.display = 'none';
  }
}

function renderMain() {
  const b = $('mainBtn');
  const full = picked().length === 23;
  b.disabled = !full || G.done;
  b.textContent = G.done ? 'SAISON COMPLÉTÉE'
    : full ? 'SIMULER LA SAISON (82 MATCHS)'
    : `SIGNER ENCORE ${23 - picked().length} JOUEURS`;
}

function render() {
  renderCap(); renderSpin(); renderFilters(); renderPool(); renderRoster(); renderMain();
}

/* ---------- FIFA Radar Chart Tooltip ---------- */

function attachRadarEvents(el, p) {
  el.addEventListener('mouseenter', ev => showRadar(ev, p));
  el.addEventListener('mousemove', ev => positionRadar(ev));
  el.addEventListener('mouseleave', hideRadar);
}

function showRadar(ev, p) {
  if (G.fogOfWar) return;
  const tooltip = $('radarTooltip');
  if (!tooltip) return;

  const isG = p.p === 'G';
  const labels = isG
    ? ['TEC', 'BLI', 'ROB', 'CLU', 'RÉF', 'OVR']
    : ['ATT', 'DÉF', 'ROB', 'CLU', 'VIT', 'OVR'];

  const r = getHiddenRatings(p);
  const values = isG
    ? [r.o, r.d, r.r, r.c, r.sp ?? r.o, r.v]
    : [r.o, r.d, r.r, r.c, r.sp ?? 50, r.v];

  // Draw 6-axis polygon SVG
  const size = 160;
  const center = size / 2;
  const radius = 52;

  const getCoord = (val, i) => {
    const angle = (i * 60 - 90) * (Math.PI / 180);
    const r = (val / 100) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };

  // Background Grid (25, 50, 75, 100)
  let gridSvg = '';
  [0.25, 0.50, 0.75, 1.0].forEach(level => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 - 90) * (Math.PI / 180);
      const r = level * radius;
      points.push(`${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`);
    }
    gridSvg += `<polygon points="${points.join(' ')}" fill="none" stroke="rgba(26,50,77,0.6)" stroke-width="1"/>`;
  });

  // Axis lines & labels
  let axesSvg = '';
  let labelsSvg = '';
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 90) * (Math.PI / 180);
    const x2 = center + radius * Math.cos(angle);
    const y2 = center + radius * Math.sin(angle);
    axesSvg += `<line x1="${center}" y1="${center}" x2="${x2}" y2="${y2}" stroke="rgba(26,50,77,0.8)" stroke-width="1"/>`;

    const lx = center + (radius + 15) * Math.cos(angle);
    const ly = center + (radius + 15) * Math.sin(angle);
    labelsSvg += `<text x="${lx}" y="${ly + 3}" fill="#829ab3" font-size="8" font-weight="800" text-anchor="middle">${labels[i]}</text>`;
  }

  // Player Value Polygon
  const valPoints = values.slice(0, 6).map((v, i) => getCoord(v, i).join(',')).join(' ');
  const polygonSvg = `<polygon points="${valPoints}" fill="rgba(244,196,48,0.35)" stroke="#f4c430" stroke-width="2"/>`;

  // Value Dots
  let dotsSvg = '';
  values.slice(0, 6).forEach((v, i) => {
    const [cx, cy] = getCoord(v, i);
    dotsSvg += `<circle cx="${cx}" cy="${cy}" r="3" fill="#38bdf8"/>`;
  });

  const eraSal = getEraSalary(p.$, p.s);
  tooltip.innerHTML = `
    <div class="radar-header">${p.n}</div>
    <div class="radar-sub">${p.np} · ${p.t} · COTE ${r.v}</div>
    <div style="font-size:9.5px;color:var(--green-neon);margin-bottom:6px;font-weight:700;">
      Jeu 2026: ${money(p.$)} · Réel (${p.s}): ${money(eraSal)}
    </div>
    <svg class="radar-chart-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${gridSvg}
      ${axesSvg}
      ${polygonSvg}
      ${dotsSvg}
      ${labelsSvg}
    </svg>`;

  tooltip.style.display = 'block';
  positionRadar(ev);
}

function positionRadar(ev) {
  const tooltip = $('radarTooltip');
  if (!tooltip || tooltip.style.display === 'none') return;
  const x = Math.min(window.innerWidth - 225, ev.clientX + 15);
  const y = Math.min(window.innerHeight - 240, ev.clientY + 15);
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

function hideRadar() {
  const tooltip = $('radarTooltip');
  if (tooltip) tooltip.style.display = 'none';
}

/* ---------- Leaderboard ---------- */

function saveLeaderboard(entry) {
  try {
    const raw = localStorage.getItem('cap82_leaderboard');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    localStorage.setItem('cap82_leaderboard', JSON.stringify(list.slice(0, 20)));
  } catch {}
}

function showLeaderboard() {
  const modal = $('leaderboardModal');
  const body = $('leaderboardBody');
  if (!modal || !body) return;

  try {
    const raw = localStorage.getItem('cap82_leaderboard');
    const list = raw ? JSON.parse(raw) : [];

    if (!list.length) {
      body.innerHTML = `<div class="empty-msg">Aucune saison enregistrée pour l'instant.<br>Complétez une saison pour figurer dans l'historique !</div>`;
    } else {
      body.innerHTML = list.map(item => `
        <div class="leaderboard-item">
          <div>
            <div class="lb-score ${item.W === 82 ? 'perfect' : ''}">${item.W}-${item.L}-${item.OTL}</div>
            <div style="font-size:10px;color:var(--text);margin-top:2px">${item.points} pts · Diff ${item.GF - item.GA > 0 ? '+' : ''}${item.GF - item.GA}</div>
          </div>
          <div class="lb-details">
            <div>Masse: ${money(item.capUsed)} / ${money(CAP)}</div>
            <div>${item.date}</div>
          </div>
        </div>`).join('');
    }
  } catch {
    body.innerHTML = `<div class="empty-msg">Impossible d'accéder à l'historique.</div>`;
  }

  modal.style.display = 'flex';
}

function hideLeaderboard() {
  const modal = $('leaderboardModal');
  if (modal) modal.style.display = 'none';
}

function simulatePlayoffs(top16Teams) {
  const host = $('playoffsSection');
  if (!host) return;

  host.style.display = 'block';
  host.scrollIntoView({ behavior: 'smooth' });

  let roundTeams = top16Teams.slice();
  let roundNum = 1;
  const roundNames = ['Huitièmes de Finale', 'Quarts de Finale', 'Demi-Finales', 'FINALE DE LA COUPE STANLEY 🏆'];
  let html = `<h2 style="color:var(--gold);text-align:center;font-size:20px;text-transform:uppercase;">🏆 SÉRIES ÉLIMINATOIRES — EN ROUTE VERS LA COUPE STANLEY</h2>`;

  while (roundTeams.length > 1) {
    const nextRound = [];
    html += `<div style="background:rgba(10,20,32,0.8);border:1px solid var(--panel-border);border-radius:12px;padding:14px;margin-top:14px;">
      <h3 style="color:var(--blue-bright);margin:0 0 10px;font-size:14px;text-transform:uppercase;">Ronde ${roundNum} : ${roundNames[roundNum - 1]}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:10px;">`;

    for (let i = 0; i < roundTeams.length / 2; i++) {
      const teamA = roundTeams[i];
      const teamB = roundTeams[roundTeams.length - 1 - i];

      let winsA = 0, winsB = 0;
      let gameLog = [];

      while (winsA < 4 && winsB < 4) {
        // match sim
        const isPlayerA = teamA.isPlayer;
        const isPlayerB = teamB.isPlayer;

        let winnerA = Math.random() < (teamA.PTS / (teamA.PTS + teamB.PTS));
        if (winnerA) winsA++; else winsB++;
      }

      const seriesWinner = winsA === 4 ? teamA : teamB;
      nextRound.push(seriesWinner);

      const isPlayerSeries = teamA.isPlayer || teamB.isPlayer;

      html += `<div style="background:var(--panel-card);border:1px solid ${isPlayerSeries ? 'var(--gold)' : 'var(--panel-border)'};border-radius:8px;padding:10px;font-size:11.5px;">
        <div style="display:flex;justify-content:space-between;font-weight:800;color:${teamA.isPlayer ? 'var(--gold)' : 'var(--text)'};">
          <span>${getTeamLogoHtml(teamA.tag, 14)} ${teamA.name}</span>
          <span>${winsA}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:800;color:${teamB.isPlayer ? 'var(--gold)' : 'var(--text)'};margin-top:4px;">
          <span>${getTeamLogoHtml(teamB.tag, 14)} ${teamB.name}</span>
          <span>${winsB}</span>
        </div>
        <div style="font-size:9.5px;color:var(--sub);margin-top:6px;text-align:right;font-weight:700;">
          Série : <strong>${seriesWinner.name} gagne (4-${Math.min(winsA, winsB)})</strong>
        </div>
      </div>`;
    }

    html += `</div></div>`;
    roundTeams = nextRound;
    roundNum++;
  }

  const champion = roundTeams[0];
  const championIsPlayer = champion.isPlayer;

  html += `<div style="text-align:center;margin-top:24px;background:rgba(244,196,48,0.15);border:2px solid var(--gold);border-radius:14px;padding:20px;">
    <h2 style="color:var(--gold);font-size:26px;margin:0 0 6px;">🎉 CHAMPION DE LA COUPE STANLEY</h2>
    <div style="font-size:22px;font-weight:900;color:var(--text);">${getTeamLogoHtml(champion.tag, 32)} ${champion.name}</div>
    <p style="color:var(--sub);font-size:13px;margin-top:8px;">${championIsPlayer ? 'FÉLICITATIONS ! VOTRE FORMATION A CONQUIS LA COUPE STANLEY ! 🏆' : 'Votre équipe a donné son maximum. Tentez votre chance à nouveau pour le trophée ultime !'}</p>
  </div>`;

  host.innerHTML = html;
}

function showBible() {
  const modal = $('bibleModal');
  if (modal) modal.style.display = 'flex';
}

function hideBible() {
  const modal = $('bibleModal');
  if (modal) modal.style.display = 'none';
}

/* ---------- Hockey Card Modal ---------- */

function showHockeyCardModal(p) {
  const modal = $('hockeyCardModal');
  const body = $('hockeyCardBody');
  if (!modal || !body) return;

  const used = capUsed();
  const already = picked().includes(p);
  const opts = openSlots(p);
  const slot = (G.target !== null && !G.roster[G.target] && fits(p, SLOTS[G.target]))
    ? SLOTS[G.target] : opts[0];
  const over = (used + p.$) > CAP;
  const pen = slot ? getPositionPenalty(p, slot) : 0;
  const penTag = pen > 0 ? ` <span class="tag-pen">-${pen} Pos</span>` : '';

  const st = getPlayerDisplayStats(p);
  const arch = getArchetype(p);
  const logo = getTeamLogoHtml(p.t, 24);
  const logoBg = getTeamLogoHtml(p.t, 140);
  const headshot = getHeadshotHtml(p, 90);
  const colors = TEAM_COLORS[p.t] || { primary: '#112236', accent: '#38bdf8' };

  const pmClass = st.pm > 0 ? 'pm-pos' : st.pm < 0 ? 'pm-neg' : '';
  const pmStr = st.pm > 0 ? `+${st.pm}` : `${st.pm}`;

  const hdbUrl = `https://www.hockeydb.com/ihdb/stats/findplayer.php?full_name=${encodeURIComponent(p.n)}`;
  const nhlUrl = p.id ? `https://www.nhl.com/player/${p.id}` : `https://www.nhl.com/search?q=${encodeURIComponent(p.n)}`;

  let btnLabel = '+ SIGNER CE JOUEUR';
  if (already) btnLabel = '✓ DÉJÀ SIGNÉ';
  else if (!slot) btnLabel = '× AUCUNE POSITION DISPONIBLE';
  else if (over) btnLabel = '× HORS BUDGET SALARIAL';

  let statsTableHtml = '';
  if (p.p === 'G') {
    statsTableHtml = `
      <table class="hockey-card-stats-table">
        <thead>
          <tr>
            <th>PJ</th><th>V</th><th>D</th><th>DP</th><th>MBA</th><th>%ARR</th><th>BL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${st.gp}</td>
            <td style="color:var(--gold);font-weight:900;">${st.w}</td>
            <td>${st.l}</td>
            <td>${st.so ?? 0}</td>
            <td>${p.ga ?? '—'}</td>
            <td>${p.sv ?? '—'}</td>
            <td>${p.so ?? 0}</td>
          </tr>
        </tbody>
      </table>`;
  } else {
    const shotStr = p.sOG != null ? Math.round(p.sOG * (st.factor || 1)) : '—';
    const hitStr = p.ht != null ? (p.ht * (st.factor || 1)).toFixed(1) : '—';
    const foStr = p.fo != null ? `${Math.round(p.fo * 100)}%` : '—';

    statsTableHtml = `
      <table class="hockey-card-stats-table">
        <thead>
          <tr>
            <th>PJ</th><th>B</th><th>A</th><th>PTS</th><th>+/-</th><th>TIRS</th><th>CH/M</th><th>MJ%</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${st.gp}</td>
            <td style="font-weight:800;">${st.g}</td>
            <td style="font-weight:800;">${st.a}</td>
            <td style="color:var(--gold);font-weight:900;font-size:15px;">${st.pt}</td>
            <td class="${pmClass}">${pmStr}</td>
            <td>${shotStr}</td>
            <td>${hitStr}</td>
            <td>${foStr}</td>
          </tr>
        </tbody>
      </table>`;
  }

  let ratingsHtml = '';
  if (!G.fogOfWar) {
    const hr = getHiddenRatings(p);
    const isG = p.p === 'G';
    ratingsHtml = `
      <div class="hockey-card-ratings">
        <div class="rating-badge-item"><span>${isG ? 'TEC' : 'ATT'}</span> <strong>${hr.o}</strong></div>
        <div class="rating-badge-item"><span>DÉF</span> <strong>${hr.d}</strong></div>
        <div class="rating-badge-item"><span>ROB</span> <strong>${hr.r}</strong></div>
        <div class="rating-badge-item"><span>CLU</span> <strong>${hr.c}</strong></div>
        <div class="rating-badge-item ovr"><span>COTE</span> <strong>${hr.v}</strong></div>
      </div>`;
  } else {
    ratingsHtml = `<div class="hockey-card-fog-msg">🔒 COTES CACHÉES (Fog of War actif)</div>`;
  }

  body.innerHTML = `
    <div class="hockey-card-wrapper" style="--card-primary: ${colors.primary}; --card-accent: ${colors.accent};">
      <div class="hockey-card-watermark">${logoBg}</div>
      <div class="hockey-card-top-bar">
        <div class="hockey-card-team-info">${logo} <span>${TEAMFULL[p.t] || p.t} · ${p.s}</span></div>
        <div class="hockey-card-pos-tag">${getPositionLabel(p)}${penTag}</div>
      </div>

      <div class="hockey-card-main-area">
        <div class="hockey-card-headshot-frame">
          ${headshot}
        </div>
        <div class="hockey-card-identity">
          <div class="hockey-card-player-name">${formatPlayerName(p.n)}</div>
          <div class="hockey-card-archetype" title="${arch.desc}">${arch.icon} ${arch.label}</div>
          <div class="hockey-card-salary-block">
            <span class="salary-main">${st.salaryPrimary}</span>
            <span class="salary-sub">${st.salarySub}</span>
          </div>
        </div>
      </div>

      <div class="hockey-card-stats-section">
        <div class="hockey-card-section-title">STATISTIQUES DE LA SAISON (${p.s})</div>
        ${statsTableHtml}
      </div>

      <div class="hockey-card-ratings-section">
        <div class="hockey-card-section-title">PROFIL & COTES DU JOUEUR</div>
        ${ratingsHtml}
      </div>

      <div class="hockey-card-footer">
        <div class="hockey-card-links">
          <a href="${nhlUrl}" target="_blank" class="ext-link">Fiche LNH 🔗</a>
          <a href="${hdbUrl}" target="_blank" class="ext-link">Fiche HDB 🔗</a>
        </div>
        <button id="modalSignBtn" class="add" style="padding:8px 14px;font-size:12px;font-weight:900;" ${already || !slot || over ? 'disabled' : ''}>${btnLabel}</button>
      </div>
    </div>`;

  const modalSignBtn = $('modalSignBtn');
  if (modalSignBtn) {
    modalSignBtn.onclick = async () => {
      if (already || !slot || over) return;
      G.roster[slot.i] = p;
      G.target = null;
      hideHockeyCardModal();
      await nextSpin(true, true);
      saveGame();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  modal.style.display = 'flex';
}

function hideHockeyCardModal() {
  const modal = $('hockeyCardModal');
  if (modal) modal.style.display = 'none';
}

/* ---------- simulation ---------- */

const bar = (label, val) => {
  const pct = Math.max(0, Math.min(100, (val - 25) / 74 * 100));
  return `<div class="bar"><div class="bl">${label}</div>
    <div class="bt"><div class="bf" style="width:${pct}%"></div></div>
    <div class="bv">${Math.round(val)}</div></div>`;
};

$('mainBtn').onclick = () => {
  if (picked().length !== 23 || G.done) return;
  G.done = true;

  const r = simulate(G.roster);
  const perfect = (r.L + r.OTL) === 0;

  const note = perfect
    ? '82-0-0. Saison historique parfaite ! Les Bruins de 2022-23 ont fini 65-12-5.'
    : r.W >= 65 ? `${r.W} victoires — mieux que le record réel de la LNH (65, Bruins 2022-23).`
    : r.W >= 55 ? 'Une saison impressionnante, mais la perfection exige de la profondeur sur tous les trios.'
    : "Le plafond a exigé des compromis. Analysez vos lignes ci-dessous pour voir où retravailler.";

  const rows = SLOTS.filter(s => G.roster[s.i]).map(s => {
    const p = G.roster[s.i];
    const logo = getTeamLogoHtml(p.t, 16);
    const hr = getHiddenRatings(p);
    const pmCls = (p.simPM || 0) > 0 ? 'pm-pos' : (p.simPM || 0) < 0 ? 'pm-neg' : '';
    const pmStr = (p.simPM || 0) > 0 ? `+${p.simPM}` : `${p.simPM || 0}`;

    const simStatStr = p.p === 'G'
      ? `${p.simGP || 0}PJ · ${p.simW || 0}V-${p.simL || 0}D-${p.simOTL || 0}DP · ${((p.simGA || 0) / Math.max(1, p.simGP || 1)).toFixed(2)} MBA · ${p.simSO || 0} BL`
      : `${p.simGP || 0}PJ · <b>${p.simG || 0}B</b> ${p.simA || 0}A · <b style="color:var(--gold);font-size:13px;">${p.simPTS || 0} PTS</b> · <span class="${pmCls}">${pmStr}</span>`;

    return `<div class="rrow">
      <div class="rn" style="display:flex;align-items:center;gap:6px">${logo} <span>${formatPlayerName(p.n)} <span class="sub">(${s.role})</span></span></div>
      <div class="rs">${simStatStr} &nbsp;|&nbsp; <span style="color:var(--gold);font-weight:800;">OVR ${hr.v}</span> (OFF ${hr.o} DEF ${hr.d} ROB ${hr.r} CLU ${hr.c})</div>
    </div>`;
  }).join('');

  saveLeaderboard({
    W: r.W, L: r.L, OTL: r.OTL, points: r.points,
    GF: r.GF, GA: r.GA, capUsed: capUsed(),
    date: new Date().toLocaleDateString('fr-CA')
  });

  // Simulation de la ligue à 32 équipes
  const leagueTeams = [
    { name: 'Votre Formation', tag: 'YOU', isPlayer: true, roster: G.roster, W: r.W, L: r.L, OTL: r.OTL, GF: r.GF, GA: r.GA, PTS: r.points },
  ];

  // Sélection de 31 adversaires aléatoires dans l'histoire
  const sampleOpponents = [
    { name: 'MTL 1976-77', tag: 'MTL' }, { name: 'EDM 1983-84', tag: 'EDM' }, { name: 'BOS 2022-23', tag: 'BOS' },
    { name: 'NYI 1981-82', tag: 'NYI' }, { name: 'PIT 1991-92', tag: 'PIT' }, { name: 'COL 2000-01', tag: 'COL' },
    { name: 'DET 2001-02', tag: 'DET' }, { name: 'CHI 2012-13', tag: 'CHI' }, { name: 'VGK 2022-23', tag: 'VGK' },
    { name: 'TPA 2018-19', tag: 'TBL' }, { name: 'WSH 2017-18', tag: 'WSH' }, { name: 'LAK 2011-12', tag: 'LAK' },
    { name: 'NJD 1999-00', tag: 'NJD' }, { name: 'DAL 1998-99', tag: 'DAL' }, { name: 'NYR 1993-94', tag: 'NYR' },
    { name: 'CGY 1988-89', tag: 'CGY' }, { name: 'PHI 1974-75', tag: 'PHI' }, { name: 'STL 2018-19', tag: 'STL' },
    { name: 'CAR 2005-06', tag: 'CAR' }, { name: 'ANA 2006-07', tag: 'ANA' }, { name: 'SJS 2015-16', tag: 'SJS' },
    { name: 'NSH 2016-17', tag: 'NSH' }, { name: 'FLA 2023-24', tag: 'FLA' }, { name: 'VAN 2010-11', tag: 'VAN' },
    { name: 'BUF 1998-99', tag: 'BUF' }, { name: 'OTT 2006-07', tag: 'OTT' }, { name: 'WPG 2017-18', tag: 'WPG' },
    { name: 'MIN 2021-22', tag: 'MIN' }, { name: 'TOR 1992-93', tag: 'TOR' }, { name: 'QUE 1992-93', tag: 'QUE' },
    { name: 'HFD 1986-87', tag: 'HFD' }
  ];

  for (const opp of sampleOpponents) {
    // Generer fiches réalistes simulees
    const w = Math.floor(Math.random() * 32) + 28;
    const otl = Math.floor(Math.random() * 10) + 4;
    const l = 82 - w - otl;
    const gf = Math.floor(w * 3.4 + Math.random() * 20);
    const ga = Math.floor(l * 3.2 + Math.random() * 20);
    leagueTeams.push({
      name: opp.name, tag: opp.tag, isPlayer: false, W: w, L: l, OTL: otl, GF: gf, GA: ga, PTS: w * 2 + otl
    });
  }

  leagueTeams.sort((a, b) => b.PTS - a.PTS || (b.GF - b.GA) - (a.GF - a.GA));
  const playerRank = leagueTeams.findIndex(t => t.isPlayer) + 1;

  const standingsRows = leagueTeams.map((t, idx) => `
    <tr style="${t.isPlayer ? 'background:rgba(56,189,248,0.2);font-weight:800;color:var(--gold);' : ''}">
      <td style="padding:6px;text-align:center;">${idx + 1}</td>
      <td style="padding:6px;">${getTeamLogoHtml(t.tag, 16)} ${t.name}</td>
      <td style="padding:6px;text-align:center;">82</td>
      <td style="padding:6px;text-align:center;">${t.W}</td>
      <td style="padding:6px;text-align:center;">${t.L}</td>
      <td style="padding:6px;text-align:center;">${t.OTL}</td>
      <td style="padding:6px;text-align:center;font-weight:900;color:var(--green-neon);">${t.PTS}</td>
      <td style="padding:6px;text-align:center;">${t.GF}</td>
      <td style="padding:6px;text-align:center;">${t.GA}</td>
    </tr>`).join('');

  $('resultHost').innerHTML = `
    <div class="result">
      <div class="score ${perfect ? 'perfect' : ''}">${r.W}-${r.L}-${r.OTL}</div>
      <div class="rec">${r.points} POINTS · RANG AU CLASSEMENT : ${playerRank}e / 32</div>
      <div class="bars">
        ${bar('Attaque', r.attaque)}
        ${bar('Brigade déf.', r.brigade)}
        ${bar('Gardien', r.gRating)}
        ${bar('Robustesse', r.rob)}
        ${bar('Clutch', r.clu)}
      </div>

      <div style="margin-top:24px;">
        <h3 style="color:var(--gold);font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">🏆 CLASSEMENT GÉNÉRAL DE LA LIGUE (32 ÉQUIPES)</h3>
        <div style="max-height:280px;overflow-y:auto;border:1px solid var(--panel-border);border-radius:10px;">
          <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
            <thead>
              <tr style="background:rgba(0,0,0,0.4);color:var(--sub);text-align:center;">
                <th style="padding:6px;">RANG</th>
                <th style="padding:6px;text-align:left;">ÉQUIPE</th>
                <th style="padding:6px;">PJ</th>
                <th style="padding:6px;">V</th>
                <th style="padding:6px;">D</th>
                <th style="padding:6px;">DP</th>
                <th style="padding:6px;">PTS</th>
                <th style="padding:6px;">BP</th>
                <th style="padding:6px;">BC</th>
              </tr>
            </thead>
            <tbody>
              ${standingsRows}
            </tbody>
          </table>
        </div>
      </div>

      <div class="note">${note}</div>
      <div class="reveal"><h3>COTES CACHÉES RÉVÉLÉES</h3>${rows}</div>
      <div style="text-align:center;margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button class="btn go" id="shareBtn" style="background:#0284c7;color:#fff;margin-top:0;">📋 COPIER LE RÉSULTAT</button>
        ${playerRank <= 16 ? '<button class="btn go" id="playoffsBtn" style="background:var(--gold);color:#000;margin-top:0;">🏆 SÉRIES (TOP 16)</button>' : ''}
        <button class="btn go" id="again" style="margin-top:0">NOUVELLE PARTIE</button>
      </div>

      <div id="playoffsSection" style="display:none;margin-top:24px;border-top:1px solid var(--panel-border);padding-top:16px;"></div>
    </div>`;

  const sBtn = $('shareBtn');
  if (sBtn) {
    sBtn.onclick = () => {
      const topPlayer = picked().sort((a,b) => (b.pt ?? b.w ?? 0) - (a.pt ?? a.w ?? 0))[0];
      const shareText = `🏒 Cap 82-0 — Alignement de 23 joueurs\n` +
        `📊 Fiche : ${r.W}-${r.L}-${r.OTL} (${r.points} pts)\n` +
        `🏆 Rang ligue : ${playerRank}e / 32\n` +
        `💵 Masse salariale : ${money(capUsed())} / ${money(CAP)}\n` +
        `⭐ Vedette : ${topPlayer ? `${topPlayer.n} ('${topPlayer.s.slice(-2)})` : 'Inconnue'}\n` +
        `👉 Essayez de faire 82-0 !`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareText).then(() => {
          sBtn.textContent = '✓ COPIÉ !';
          setTimeout(() => { sBtn.textContent = '📋 COPIER LE RÉSULTAT'; }, 2500);
        }).catch(() => {
          sBtn.textContent = '✓ Fiche copiée';
        });
      } else {
        sBtn.textContent = '✓ ' + `${r.W}-${r.L}-${r.OTL}`;
      }
    };
  }

  if (playerRank <= 16) {
    const pBtn = $('playoffsBtn');
    if (pBtn) {
      pBtn.onclick = () => simulatePlayoffs(leagueTeams.slice(0, 16));
    }
  }

  $('again').onclick = async () => {
    clearSave();
    G.roster = {}; G.left = { ...REROLLS }; G.target = null; G.done = false;
    $('resultHost').innerHTML = '';
    await nextSpin(true, true);
    saveGame();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  renderMain();
  $('resultHost').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.cap82 = { G, cacheClear, simulate };
boot();
