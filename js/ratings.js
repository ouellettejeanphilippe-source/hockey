/**
 * Calcul des cotes cachées à partir des stats brutes d'une saison.
 *
 * Toute modification de formule ici DOIT incrémenter RATINGS_VERSION,
 * sinon des cotes calculées avec deux formules différentes se retrouvent
 * mélangées dans le cache IndexedDB.
 *
 * Utilisé par le navigateur (API en direct) ET par scripts/rate.mjs (build
 * des shards). Une seule implémentation, un seul endroit à corriger.
 */

export const RATINGS_VERSION = 5;

/* ---------- outils statistiques ---------- */

function zfn(values) {
  const clean = values.filter(v => v !== null && v !== undefined && !Number.isNaN(v));
  if (clean.length < 2) return () => 0;
  const mu = clean.reduce((a, b) => a + b, 0) / clean.length;
  const varr = clean.reduce((a, b) => a + (b - mu) ** 2, 0) / clean.length;
  const sd = Math.sqrt(varr) || 1e-6;
  return x => (x === null || x === undefined || Number.isNaN(x)) ? 0 : (x - mu) / sd;
}

function scale(z, center = 52, spread = 13, lo = 25, hi = 99) {
  return Math.max(lo, Math.min(hi, Math.round(center + spread * z)));
}

const per = (row, key) => (row[key] || 0) / (row.gamesPlayed || 1);

/**
 * Salaire dérivé de la cote globale, sur l'échelle salariale actuelle.
 * cote 50 -> ~0,78 M$ | cote 75 -> ~4,0 M$ | cote 90 -> ~10,7 M$ | cote 99 -> ~19 M$
 */
export function salaryFor(ovr, pos) {
  let base = 775000 * Math.exp(0.0655 * Math.max(0, ovr - 50));
  if (pos === 'G') base *= 0.88;
  return Math.round(base / 25000) * 25000;
}

export function capPctFor(salary) {
  return Math.round((salary / 95_500_000) * 1000) / 10;
}

/* ---------- patineurs ---------- */

export function rateSkaters(rows, realtimeById = null) {
  const rt = id => (realtimeById && realtimeById[id]) || null;
  const hasRT = realtimeById && Object.keys(realtimeById).length > 0;

  const z = {
    pts:    zfn(rows.map(r => per(r, 'points'))),
    shots:  zfn(rows.map(r => per(r, 'shots'))),
    pp:     zfn(rows.map(r => per(r, 'ppPoints'))),
    pm:     zfn(rows.map(r => per(r, 'plusMinus'))),
    sh:     zfn(rows.map(r => per(r, 'shPoints'))),
    pim:    zfn(rows.map(r => per(r, 'penaltyMinutes'))),
    toi:    zfn(rows.map(r => (r.timeOnIcePerGame || 0) / 60)),
    gwg:    zfn(rows.map(r => ((r.gameWinningGoals || 0) + (r.otGoals || 0)) / (r.gamesPlayed || 1))),
    hits:   hasRT ? zfn(rows.filter(r => rt(r.playerId)).map(r => (rt(r.playerId).hits || 0) / (r.gamesPlayed || 1))) : () => 0,
    blocks: hasRT ? zfn(rows.filter(r => rt(r.playerId)).map(r => (rt(r.playerId).blockedShots || 0) / (r.gamesPlayed || 1))) : () => 0,
  };

  return rows.map(r => {
    const gp = r.gamesPlayed || 0;
    if (gp <= 0) return null;

    const natural = r.positionCode || 'C';
    const isD = natural === 'D';
    const extra = rt(r.playerId);
    const toiMin = (r.timeOnIcePerGame || 0) / 60;

    // OFFENSIVE
    const zOff = 0.62 * z.pts(per(r, 'points'))
               + 0.22 * z.shots(per(r, 'shots'))
               + 0.16 * z.pp(per(r, 'ppPoints'));

    // DÉFENSIVE — +/-, buts en désavantage, temps de glace, tirs bloqués
    let zDef = 0.45 * z.pm(per(r, 'plusMinus'))
             + 0.20 * z.sh(per(r, 'shPoints'))
             + 0.35 * z.toi(toiMin);
    if (extra) {
      zDef = 0.70 * zDef + 0.30 * z.blocks((extra.blockedShots || 0) / gp);
    }
    if (isD) zDef += 0.35;  // bonus positionnel

    // ROBUSTESSE
    let zRob = z.pim(per(r, 'penaltyMinutes'));
    if (extra) {
      zRob = 0.45 * zRob + 0.55 * z.hits((extra.hits || 0) / gp);
    }

    // CLUTCH — buts gagnants et en prolongation
    const zClu = 0.75 * z.gwg(((r.gameWinningGoals || 0) + (r.otGoals || 0)) / gp)
               + 0.25 * z.pts(per(r, 'points'));

    const o = scale(zOff);
    const d = scale(zDef);
    const rb = scale(zRob, 50, 12);
    const c = scale(zClu, 50, 12);

    const v = Math.max(25, Math.min(99, Math.round(
      isD ? 0.32 * o + 0.46 * d + 0.11 * rb + 0.11 * c
          : 0.54 * o + 0.24 * d + 0.10 * rb + 0.12 * c
    )));

    const htPerGame = extra && extra.hits != null ? Math.round((extra.hits / gp) * 10) / 10 : null;
    const foPct = r.faceoffWinPct != null ? Math.round(r.faceoffWinPct * 1000) / 1000 : null;
    const sal = salaryFor(v, natural);

    return {
      n: r.skaterFullName,
      p: isD ? 'D' : 'F',
      np: natural,
      gp,
      g: r.goals || 0,
      a: r.assists || 0,
      pt: r.points || 0,
      pm: r.plusMinus || 0,
      pim: r.penaltyMinutes || 0,
      ht: htPerGame,
      fo: foPct,
      toi: Math.round(toiMin * 10) / 10,
      o, d, r: rb, c, v,
      $: sal,
      cp: capPctFor(sal),
      teams: (r.teamAbbrevs || '???').split(',').map(s => s.trim()),
    };
  }).filter(Boolean);
}

/* ---------- gardiens ---------- */

export function rateGoalies(rows) {
  const z = {
    svp:  zfn(rows.map(r => r.savePct)),
    gaa:  zfn(rows.map(r => r.goalsAgainstAverage)),
    gp:   zfn(rows.map(r => r.gamesPlayed)),
    so:   zfn(rows.map(r => (r.shutouts || 0) / (r.gamesPlayed || 1))),
    wpct: zfn(rows.map(r => (r.wins || 0) / (r.gamesPlayed || 1))),
  };

  return rows.map(r => {
    const gp = r.gamesPlayed || 0;
    if (gp <= 0) return null;

    const o = scale(z.svp(r.savePct));                                    // Technique
    const d = scale(r.goalsAgainstAverage != null ? -z.gaa(r.goalsAgainstAverage) : 0);  // Blindage
    const rb = scale(z.gp(gp), 50, 12);                                   // Charge de travail
    const c = scale(0.6 * z.so((r.shutouts || 0) / gp)
                  + 0.4 * z.wpct((r.wins || 0) / gp), 50, 12);            // Clutch

    const v = Math.max(25, Math.min(99, Math.round(
      0.42 * o + 0.34 * d + 0.09 * rb + 0.15 * c
    )));
    const sal = salaryFor(v, 'G');

    return {
      n: r.goalieFullName,
      p: 'G',
      np: 'G',
      gp,
      w: r.wins || 0,
      l: r.losses || 0,
      sv: r.savePct != null ? Math.round(r.savePct * 1000) / 1000 : null,
      ga: r.goalsAgainstAverage != null ? Math.round(r.goalsAgainstAverage * 100) / 100 : null,
      so: r.shutouts || 0,
      o, d, r: rb, c, v,
      $: sal,
      cp: capPctFor(sal),
      teams: (r.teamAbbrevs || '???').split(',').map(s => s.trim()),
    };
  }).filter(Boolean);
}

/**
 * Assemble un shard de saison. Un joueur échangé est dupliqué dans le
 * vestiaire de CHAQUE équipe où il a passé, marqué x:1.
 */
export function buildSeasonShard(label, skaterRows, goalieRows, realtimeById, minGP) {
  const skaters = skaterRows.filter(r => (r.gamesPlayed || 0) >= minGP);
  const goalies = goalieRows.filter(r => (r.gamesPlayed || 0) >= minGP);

  const entries = [];
  for (const rec of [...rateSkaters(skaters, realtimeById), ...rateGoalies(goalies)]) {
    const { teams, ...base } = rec;
    for (const t of teams) {
      entries.push({ ...base, t, s: label, x: teams.length > 1 ? 1 : 0 });
    }
  }
  return { season: label, minGP, v: RATINGS_VERSION, players: entries };
}
