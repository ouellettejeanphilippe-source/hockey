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

    // vestiaires assez garnis pour offrir un vrai choix
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

    // Mise à jour douce de la couleur de thème selon l'équipe pigée
    const colors = TEAM_COLORS[team] || { primary: '#16273b', accent: '#42adff' };
    document.documentElement.style.setProperty('--team-primary', colors.primary);
    document.documentElement.style.setProperty('--team-accent', colors.accent);

    // précharge deux saisons probables pendant que le joueur regarde le vestiaire
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
  f.style.width = Math.min(100, (used / CAP) * 100) + '%';
  f.classList.toggle('over', rem < 0);
  $('cnt').textContent = `${picked().length} / 23`;
}

function renderSpin() {
  const host = $('spin');
  if (G.loading) {
    host.innerHTML = `<div class="season">…</div><div class="teamfull">Chargement de la saison</div>`;
    return;
  }
  const need = nextNeed();
  const full = TEAMFULL[G.cur.team];
  const dead = DEFUNCT.has(G.cur.team) ? ' · franchise disparue' : '';
  const minGP = state.index.minGP ?? 10;

  const logoHtml = getTeamLogoHtml(G.cur.team, 40);

  host.innerHTML = `
    <div class="spin-header">
      <div class="spin-logo">${logoHtml}</div>
      <div>
        <div class="season">${G.cur.season}</div>
        <div class="team">${G.cur.team}</div>
      </div>
    </div>
    <div class="teamfull">${full ? full + dead : ''}</div>
    <div class="avail">${G.cur.pool.length} joueurs à ${minGP}+ matchs dans ce vestiaire</div>
    <div class="need">${need ? 'À combler : ' + need.role + ' — ' + need.label : 'Alignement complet'}</div>
    <div class="rerolls">
      <button id="rrS" ${G.left.season ? '' : 'disabled'}>Autre année<b>${G.left.season} restants</b></button>
      <button id="rrT" ${G.left.team ? '' : 'disabled'}>Autre équipe<b>${G.left.team} restants</b></button>
      <button id="rrP" ${G.left.pass ? '' : 'disabled'}>Passer<b>${G.left.pass} restants</b></button>
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

function slotEl(s) {
  const p = G.roster[s.i];
  const d = document.createElement('div');
  const pen = p ? getPositionPenalty(p, s) : 0;
  d.className = 'slot' + (p ? '' : ' empty') + (G.target === s.i ? ' target' : '') + (pen > 0 ? ' oop' : '');
  if (p) {
    const penTag = pen > 0 ? `<span class="tag-pen">-${pen}</span>` : '';
    const stat = p.p === 'G'
      ? `${p.w}V · ${p.sv ?? '—'}`
      : `${p.pt}PTS${p.fo != null ? ` · ${Math.round(p.fo * 100)}%MJ` : ''}`;
    const logo = getTeamLogoHtml(p.t, 14);
    const cpStr = p.cp ? `${p.cp}% cap` : '';
    d.innerHTML = `<button class="rm" data-i="${s.i}">✕</button>
      <div class="pos-badge">${s.role}</div>
      <div class="pn">${p.n} ${penTag}</div>
      <div class="pm">${logo} ${p.t} ${p.s} (${p.np})</div>
      <div class="pm">${stat} · ${money(p.$)} <span class="cap-pct">(${cpStr})</span></div>`;
  } else {
    d.innerHTML = `<div class="pos-badge">${s.role}</div><div class="empty-role">${s.role}</div>`;
    d.onclick = () => { G.target = (G.target === s.i ? null : s.i); render(); };
  }
  return d;
}

function renderRoster() {
  const mk = (host, group, units, cls) => {
    host.innerHTML = '';
    for (let u = 0; u < units; u++) {
      const slots = SLOTS.filter(s => s.group === group && s.unit === u && !s.scratch);
      if (!slots.length) continue;
      const lab = document.createElement('div');
      lab.className = 'unitlbl';
      lab.textContent = slots[0].label;
      host.appendChild(lab);
      const row = document.createElement('div');
      row.className = 'unit ' + cls;
      slots.forEach(s => row.appendChild(slotEl(s)));
      host.appendChild(row);
    }
  };
  mk($('fLines'), 'F', 4, 'l3');
  mk($('dLines'), 'D', 3, 'l2');

  $('gLine').innerHTML = '';
  SLOTS.filter(s => s.group === 'G' && !s.scratch).forEach(s => $('gLine').appendChild(slotEl(s)));
  $('sLine').innerHTML = '';
  SLOTS.filter(s => s.scratch).forEach(s => $('sLine').appendChild(slotEl(s)));

  const n = g => SLOTS.filter(s => s.group === g && !s.scratch && G.roster[s.i]).length;
  $('fcnt').textContent = n('F') + '/12';
  $('dcnt').textContent = n('D') + '/6';
  $('gcnt').textContent = n('G') + '/2';
  $('scnt').textContent = SLOTS.filter(s => s.scratch && G.roster[s.i]).length + '/3';

  document.querySelectorAll('.rm').forEach(b => {
    b.onclick = ev => { ev.stopPropagation(); delete G.roster[+b.dataset.i]; render(); };
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
  if (G.loading) { host.innerHTML = '<div class="empty-msg">…</div>'; return; }

  const used = capUsed();
  let list = G.cur.pool.slice();
  if (G.filter === 'C') list = list.filter(p => p.np === 'C');
  else if (G.filter === 'AG') list = list.filter(p => p.np === 'L');
  else if (G.filter === 'AD') list = list.filter(p => p.np === 'R');
  else if (G.filter === 'D') list = list.filter(p => p.p === 'D');
  else if (G.filter === 'G') list = list.filter(p => p.p === 'G');

  list.sort((a, b) => (b.pt ?? b.w ?? 0) - (a.pt ?? a.w ?? 0) || b.$ - a.$);

  if (!list.length) {
    host.innerHTML = `<div class="empty-msg">Aucun joueur de ce type dans ce vestiaire.<br>Change de filtre ou relance la roulette.</div>`;
    return;
  }

  for (const p of list) {
    const already = picked().includes(p);
    const opts = openSlots(p);
    const slot = (G.target !== null && !G.roster[G.target] && fits(p, SLOTS[G.target]))
      ? SLOTS[G.target] : opts[0];
    const over = (used + p.$) > CAP;
    const pen = slot ? getPositionPenalty(p, slot) : 0;
    const penStr = pen > 0 ? ` <span class="tag-pen">-${pen} cote</span>` : '';
    const foStr = p.fo != null ? ` · ${Math.round(p.fo * 100)}% MJ` : '';
    const htStr = p.ht != null ? ` · ${p.ht} CH/M` : '';
    const stat = p.p === 'G'
      ? `${p.gp}PJ · ${p.w}V-${p.l}D · ${p.sv ?? '—'} · ${p.ga ?? '—'} MBA · ${p.so} BL`
      : `${p.gp}PJ · ${p.g}B ${p.a}A ${p.pt}PTS · ${p.pm > 0 ? '+' : ''}${p.pm} · ${p.pim} PUN${foStr}${htStr}`;

    const logo = getTeamLogoHtml(p.t, 24);
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
      <div class="cp">${money(p.$)}${cpStr}</div>
      <button class="add" ${already || !slot || over ? 'disabled' : ''}>${already ? '✓' : '+'}</button>`;

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
  b.textContent = G.done ? 'Saison jouée'
    : full ? 'Simuler la saison (82 matchs)'
    : `Encore ${23 - picked().length} joueurs à trouver`;
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
    ? '82-0-0. Jamais vu, jamais approché. Les Bruins de 2022-23 ont fini 65-12-5.'
    : r.W >= 65 ? `${r.W} victoires — mieux que le record de la LNH (65, Bruins 2022-23).`
    : r.W >= 55 ? 'Une saison de rouleau compresseur, mais la perfection tient à la profondeur du quatrième trio.'
    : "Le plafond t'a forcé des compromis. Regarde où ça a cédé.";

  const rows = SLOTS.filter(s => G.roster[s.i]).map(s => {
    const p = G.roster[s.i];
    const logo = getTeamLogoHtml(p.t, 16);
    return `<div class="rrow">
      <div class="rn" style="display:flex;align-items:center;gap:6px">${logo} <span>${p.n} <span class="sub">${s.role}</span></span></div>
      <div class="rs">OFF ${p.o} · DEF ${p.d} · ROB ${p.r} · CLU ${p.c} · <b>${p.v}</b></div></div>`;
  }).join('');

  $('resultHost').innerHTML = `
    <div class="result">
      <div class="score ${perfect ? 'perfect' : ''}">${r.W}-${r.L}-${r.OTL}</div>
      <div class="rec">${r.points} points · ${r.GF} BP · ${r.GA} BC · ${r.GF - r.GA > 0 ? '+' : ''}${r.GF - r.GA}</div>
      <div class="bars">
        ${bar('Attaque', r.attaque)}
        ${bar('Brigade déf.', r.brigade)}
        ${bar('Gardien', r.gRating)}
        ${bar('Robustesse', r.rob)}
        ${bar('Clutch', r.clu)}
      </div>
      <div class="note">${note}</div>
      <div class="reveal"><h3>Cotes cachées révélées</h3>${rows}</div>
      <div style="text-align:center">
        <button class="btn go" id="again" style="margin-top:16px">Nouvelle partie</button>
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

window.cap82 = { G, cacheClear, simulate };  // crochet pour les tests
boot();
