/**
 * Chargeur de données à trois niveaux.
 *
 *   1. shard  — data/seasons/<saison>.json, même origine, aucun souci de CORS
 *   2. live   — api.nhle.com, cotes calculées dans le navigateur
 *   3. seed   — data/seed.json, filet hors ligne
 *
 * Chaque saison chargée est mise en cache dans IndexedDB, clé par saison ET
 * par RATINGS_VERSION.
 */

import { buildSeasonShard, RATINGS_VERSION } from './ratings.js';

const API = 'https://api.nhle.com/stats/rest/en';
const DB_NAME = 'cap82';
const STORE = 'seasons';

export const state = {
  index: null,      // { seasons: [...], hasShards: bool }
  liveOK: null,     // null = pas encore testé
  source: null,     // 'shard' | 'live' | 'seed'
  seed: null,
};

/* ---------- IndexedDB ---------- */

function openDB() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

async function cacheGet(key) {
  try {
    const db = await openDB();
    return await new Promise(res => {
      const rq = db.transaction(STORE).objectStore(STORE).get(key);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => res(null);
    });
  } catch { return null; }
}

async function cachePut(key, val) {
  try {
    const db = await openDB();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key);
  } catch { /* cache best-effort */ }
}

export async function cacheClear() {
  try {
    const db = await openDB();
    db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
  } catch { /* ignore */ }
}

/* ---------- API en direct ---------- */

const seasonId = label => {
  const y = parseInt(label.slice(0, 4), 10);
  return `${y}${y + 1}`;
};

async function apiGet(path, params) {
  const url = `${API}/${path}?` + new URLSearchParams(params);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()).data || [];
}

/** Teste une fois si le navigateur peut joindre l'API (CORS). */
export async function probeLive() {
  if (state.liveOK !== null) return state.liveOK;
  try {
    const d = await apiGet('skater/summary', {
      limit: 1, sort: 'points', cayenneExp: 'seasonId=20232024 and gameTypeId=2',
    });
    state.liveOK = d.length > 0;
  } catch {
    state.liveOK = false;
  }
  return state.liveOK;
}

async function fetchLive(label, minGP) {
  const sid = seasonId(label);
  const exp = `seasonId=${sid} and gameTypeId=2`;
  const fact = `gamesPlayed>=${minGP}`;

  const [skaters, goalies] = await Promise.all([
    apiGet('skater/summary', { limit: -1, sort: 'points', cayenneExp: exp, factCayenneExp: fact }),
    apiGet('goalie/summary', { limit: -1, sort: 'wins', cayenneExp: exp, factCayenneExp: fact }),
  ]);

  let realtime = null;
  if (parseInt(label.slice(0, 4), 10) >= 2005) {
    try {
      const rows = await apiGet('skater/realtime', { limit: -1, sort: 'hits', cayenneExp: exp });
      realtime = Object.fromEntries(rows.map(r => [r.playerId, r]));
    } catch { /* facultatif */ }
  }

  return buildSeasonShard(label, skaters, goalies, realtime, minGP);
}

/* ---------- index ---------- */

export async function loadIndex() {
  try {
    const r = await fetch('data/index.json', { cache: 'no-cache' });
    if (r.ok) {
      const idx = await r.json();
      if (idx.seasons?.length) {
        state.index = { ...idx, hasShards: true };
        return state.index;
      }
    }
  } catch { /* pas de shards */ }

  // pas de shards : on se rabat sur le seed pour connaître les saisons dispo
  const seed = await loadSeed();
  const live = await probeLive();

  state.index = {
    seasons: live ? allSeasonLabels() : (seed ? seed.seasons : []),
    minGP: seed?.minGP ?? 10,
    hasShards: false,
  };
  return state.index;
}

function allSeasonLabels() {
  const out = [];
  const end = new Date().getFullYear();
  for (let y = 1970; y <= end; y++) out.push(`${y}-${String(y + 1).slice(2)}`);
  return out;
}

async function loadSeed() {
  if (state.seed !== undefined && state.seed !== null) return state.seed;
  try {
    const r = await fetch('data/seed.json');
    state.seed = r.ok ? await r.json() : null;
  } catch { state.seed = null; }
  return state.seed;
}

/* ---------- chargement d'une saison ---------- */

const inflight = new Map();

export function loadSeason(label) {
  if (inflight.has(label)) return inflight.get(label);
  const p = _loadSeason(label).finally(() => inflight.delete(label));
  inflight.set(label, p);
  return p;
}

async function _loadSeason(label) {
  const key = `${label}@${RATINGS_VERSION}`;

  const hit = await cacheGet(key);
  if (hit) return hit;

  const minGP = state.index?.minGP ?? 10;

  // 1. shard
  if (state.index?.hasShards) {
    try {
      const r = await fetch(`data/seasons/${label}.json`);
      if (r.ok) {
        const shard = await r.json();
        state.source = 'shard';
        cachePut(key, shard);
        return shard;
      }
    } catch { /* on descend d'un niveau */ }
  }

  // 2. API en direct
  if (await probeLive()) {
    try {
      const shard = await fetchLive(label, minGP);
      state.source = 'live';
      cachePut(key, shard);
      return shard;
    } catch { /* on descend d'un niveau */ }
  }

  // 3. seed
  const seed = await loadSeed();
  if (seed) {
    const players = seed.players.filter(p => p.s === label);
    if (players.length) {
      state.source = 'seed';
      return { season: label, minGP: seed.minGP, v: RATINGS_VERSION, players };
    }
  }

  throw new Error(`Saison ${label} introuvable`);
}

/** Précharge sans bloquer et sans lever d'erreur. */
export function prefetch(labels) {
  for (const l of labels) loadSeason(l).catch(() => {});
}
