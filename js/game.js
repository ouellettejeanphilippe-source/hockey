import { loadIndex, loadSeason, prefetch, state, cacheClear } from './data.js';
import { SLOTS, CAP, REROLLS, fits, simulate, getPositionPenalty } from './sim.js';
import { getTeamLogoHtml, TEAM_COLORS } from './logos.js';

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
  const a = $('capAmt');
  a.textContent = money(rem);
  a.classList.toggle('over', rem < 0);
  const f = $('capFill');
  f.style.width = Math.min(100, Math.max(0, (used / CAP) * 100)) + '%';
  f.classList.toggle('over', rem < 0);
  $('cnt').textContent = `${picked().length} / 23`;

  if ($('capMaxLbl')) $('capMaxLbl').textContent = `/ ${money(CAP)}`;
  if ($('subTitleCap')) $('subTitleCap').textContent = `BATTEZ LES BRUINS DE '23 · PLAFOND DE ${money(CAP)}`;

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

function slotCardEl(s) {
  const p = G.roster[s.i];
  const d = document.createElement('div');
  const pen = p ? getPositionPenalty(p, s) : 0;

  d.className = 'slot-card' + (p ? '' : ' empty') + (G.target === s.i ? ' target' : '') + (pen > 0 ? ' oop' : '');

  if (p) {
    const penTag = pen > 0 ? `<span class="tag-pen">-${pen}</span>` : '';
    const logo = getTeamLogoHtml(p.t, 14);

    let statValue = p.pt ?? p.w ?? 0;
    let statUnit = p.p === 'G' ? 'V' : 'PTS';
    let subStats = p.p === 'G'
      ? `${p.sv ?? '—'} SV · ${p.ga ?? '—'} MBA`
      : `${p.g}G ${p.a}A · ${p.pm > 0 ? '+' : ''}${p.pm}`;

    d.innerHTML = `
      <button class="slot-remove-btn" data-i="${s.i}" title="Retirer">✕</button>
      <div class="slot-top">
        <div class="slot-player-name">${p.n} ${penTag}</div>
        <div class="slot-salary">${money(p.$)}</div>
      </div>
      <div class="slot-big-stat">${statValue}<span class="stat-unit">${statUnit}</span></div>
      <div class="slot-bottom">
        <div class="slot-team-info">${logo} ${p.t} '${p.s.slice(-2)}</div>
        <div>${subStats}</div>
      </div>`;
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
    D: SLOTS.filter(s => s.group === 'D'),
    G: SLOTS.filter(s => s.group === 'G' || s.scratch)
  };

  const populateCol = (containerId, cntId, slotsList, titleLabel) => {
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
  populateCol('dSlots', 'dCnt', categories.D);
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
    ['D', 'Défenseurs (D)'],
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
  else if (G.filter === 'D') list = list.filter(p => p.p === 'D');
  else if (G.filter === 'G') list = list.filter(p => p.p === 'G');

  list.sort((a, b) => (b.pt ?? b.w ?? 0) - (a.pt ?? a.w ?? 0) || b.$ - a.$);

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
    const stat = p.p === 'G'
      ? `${p.gp}PJ · ${p.w}V-${p.l}D · ${p.sv ?? '—'} SV · ${p.ga ?? '—'} MBA · ${p.so} BL`
      : `${p.gp}PJ · ${p.g}B ${p.a}A ${p.pt}PTS · ${p.pm > 0 ? '+' : ''}${p.pm}${foStr}${htStr}`;

    const logo = getTeamLogoHtml(p.t, 28);
    const cpStr = p.cp ? `<span class="cap-pct">${p.cp}% du cap</span>` : '';
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `
      <div class="card-logo">${logo}</div>
      <div class="info">
        <div class="nm">${p.n}${p.x ? '<span class="tag">échangé</span>' : ''}${penStr}</div>
        <div class="mt">${p.np} · ${p.t} ${p.s}</div>
        <div class="st">${stat}</div>
      </div>
      <div class="right-block">
        <div class="cp">${money(p.$)}${cpStr}</div>
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

  $('resultHost').innerHTML = `
    <div class="result">
      <div class="score ${perfect ? 'perfect' : ''}">${r.W}-${r.L}-${r.OTL}</div>
      <div class="rec">${r.points} POINTS · ${r.GF} BP · ${r.GA} BC · DIFF ${r.GF - r.GA > 0 ? '+' : ''}${r.GF - r.GA}</div>
      <div class="bars">
        ${bar('Attaque', r.attaque)}
        ${bar('Brigade déf.', r.brigade)}
        ${bar('Gardien', r.gRating)}
        ${bar('Robustesse', r.rob)}
        ${bar('Clutch', r.clu)}
      </div>
      <div class="note">${note}</div>
      <div class="reveal"><h3>COTES CACHÉES RÉVÉLÉES</h3>${rows}</div>
      <div style="text-align:center">
        <button class="btn go" id="again" style="margin-top:20px">NOUVELLE PARTIE</button>
      </div>
    </div>`;

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
