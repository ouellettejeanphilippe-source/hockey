import { loadIndex, loadSeason, prefetch, state, cacheClear } from './data.js';
import { SLOTS, CAP, REROLLS, fits, simulate, simulateMatch, getPositionPenalty } from './sim.js';
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

/* ---------- état ---------- */

const G = {
  roster: {},
  cur: null,          // { season, team, pool }
  left: { ...REROLLS },
  target: null,
  filter: 'ALL',
  sortBy: 'PTS',
  statsProrata: false,
  salaryMode: '2026', // '2026' or 'ERA'
  fogOfWar: false,    // false = Hexagon ON, true = Fog of War (Hexagon OFF)
  done: false,
  loading: false,
  shards: new Map(),  // saison -> { players, byTeam }
};

const picked = () => Object.values(G.roster);
const capUsed = () => picked().reduce((s, p) => s + p.$, 0);
const openSlots = p => SLOTS.filter(s => !G.roster[s.i] && fits(p, s));
const nextNeed = () => SLOTS.find(s => !G.roster[s.i]) || null;

/* ---------- démarrage ---------- */

async function boot() {
  try {
    await loadIndex();
    if (!state.index.seasons.length) throw new Error('aucune saison disponible');
    setupEvents();
    await nextSpin(true, true);
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
}

/* ---------- roulette ---------- */

async function getShard(label) {
  if (G.shards.has(label)) return G.shards.get(label);
  const shard = await loadSeason(label);
  const byTeam = {};
  for (const p of shard.players) (byTeam[p.t] = byTeam[p.t] || []).push(p);
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
  if ($('subTitleCap')) {
    $('subTitleCap').textContent = `BATTEZ LES BRUINS DE '23 · PLAFOND DE ${money(CAP)}`;
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

import { getUnitSynergy } from './sim.js';

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

  d.className = 'slot-card' + (p ? '' : ' empty') + (G.target === s.i ? ' target' : '') + (pen > 0 ? ' oop' : '');

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
          <div class="slot-player-name">${p.n} ${penTag}</div>
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
    d.onclick = () => { G.target = (G.target === s.i ? null : s.i); render(); };
  }
  return d;
}

function renderRoster() {
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

  document.querySelectorAll('.slot-remove-btn').forEach(b => {
    b.onclick = ev => {
      ev.stopPropagation();
      delete G.roster[+b.dataset.i];
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
  else if (G.filter === 'AG') list = list.filter(p => p.np === 'L');
  else if (G.filter === 'AD') list = list.filter(p => p.np === 'R');
  else if (G.filter === 'LD' || G.filter === 'RD' || G.filter === 'D') list = list.filter(p => p.p === 'D');
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

  for (const p of list) {
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
      ? `${st.gp}PJ · ${st.w}V-${st.l}D · ${p.sv ?? '—'} SV · ${p.ga ?? '—'} MBA · ${st.so} BL`
      : `${st.gp}PJ · ${st.g}B ${st.a}A · <span class="${pmClass}">${pmStr}</span>${foStr}${htStr}`;

    const mainBadgeVal = p.p === 'G' ? st.w : st.pt;
    const mainBadgeLbl = p.p === 'G' ? 'VIC' : 'PTS';

    const logo = getTeamLogoHtml(p.t, 20);
    const headshot = getHeadshotHtml(p, 44);

    const hdbUrl = `https://www.hockeydb.com/ihdb/stats/findplayer.php?full_name=${encodeURIComponent(p.n)}`;
    const nhlUrl = p.id ? `https://www.nhl.com/player/${p.id}` : `https://www.nhl.com/search?q=${encodeURIComponent(p.n)}`;

    const linksHtml = `<a class="ext-link" href="${nhlUrl}" target="_blank" title="Fiche NHL.com" onclick="event.stopPropagation()">NHL🔗</a> <a class="ext-link" href="${hdbUrl}" target="_blank" title="Fiche HockeyDB" onclick="event.stopPropagation()">HDB🔗</a>`;

    const priceDisplay = st.salaryPrimary;
    const subCapStr = st.salarySub;

    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `
      <div class="card-avatar">
        ${headshot}
        <div class="team-badge-sub">${logo}</div>
      </div>
      <div class="info">
        <div class="nm">${p.n}${p.x ? '<span class="tag">échangé</span>' : ''}${penStr} ${linksHtml}</div>
        <div class="mt">${p.np} · ${p.t} ${p.s} ${st.factor > 1 ? '· <span class="tag">Prorata 82M</span>' : ''}</div>
        <div class="st"><span class="big-stat-badge"><span class="big-stat-val">${mainBadgeVal}</span><span class="big-stat-lbl">${mainBadgeLbl}</span></span>${stat}</div>
      </div>
      <div class="right-block">
        <div class="cp">${priceDisplay}${subCapStr}</div>
        <button class="add" ${already || !slot || over ? 'disabled' : ''}>${already ? '✓ SIGNÉ' : '+ SIGNER'}</button>
      </div>`;

    c.querySelector('.add').onclick = async () => {
      if (already || !slot || over) return;
      G.roster[slot.i] = p;
      G.target = null;
      await nextSpin(true, true);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!G.fogOfWar) attachRadarEvents(c, p);

    host.appendChild(c);
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

  const values = isG
    ? [p.o, p.d, p.r, p.c, p.sp ?? p.o, p.v]
    : [p.o, p.d, p.r, p.c, p.sp ?? 50, p.v];

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
    <div class="radar-sub">${p.np} · ${p.t} · COTE ${p.v}</div>
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
    return `<div class="rrow">
      <div class="rn" style="display:flex;align-items:center;gap:6px">${logo} <span>${p.n} <span class="sub">(${s.role})</span></span></div>
      <div class="rs">OFF ${p.o} · DEF ${p.d} · ROB ${p.r} · CLU ${p.c} · <b>G ${p.v}</b></div></div>`;
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
      <div style="text-align:center;margin-top:20px;display:flex;gap:10px;justify-content:center;">
        ${playerRank <= 16 ? '<button class="btn go" id="playoffsBtn" style="background:var(--gold);color:#000;">🏆 LANCER LES SÉRIES ÉLIMINATOIRES (TOP 16)</button>' : ''}
        <button class="btn go" id="again" style="margin-top:0">NOUVELLE PARTIE</button>
      </div>

      <div id="playoffsSection" style="display:none;margin-top:24px;border-top:1px solid var(--panel-border);padding-top:16px;"></div>
    </div>`;

  if (playerRank <= 16) {
    const pBtn = $('playoffsBtn');
    if (pBtn) {
      pBtn.onclick = () => simulatePlayoffs(leagueTeams.slice(0, 16));
    }
  }

  $('again').onclick = async () => {
    G.roster = {}; G.left = { ...REROLLS }; G.target = null; G.done = false;
    $('resultHost').innerHTML = '';
    await nextSpin(true, true);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  renderMain();
  $('resultHost').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.cap82 = { G, cacheClear, simulate };
boot();
