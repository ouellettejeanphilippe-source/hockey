/**
 * SITUATIONS DE RUN — catalogue + tireur.
 *
 * Une situation n'invente pas de cote. Elle pose un choix dont l'effet
 * est un tag déjà jouable (proprio, jambes, repos, ligne, fermeture…).
 * Brancher plus tard depuis le hub : chargerSituations() puis pigerSituation(etat).
 */
export let SITUATIONS = [];

export async function chargerSituations() {
  if (SITUATIONS.length) return SITUATIONS;
  const r = await fetch('data/situations.json');
  const catalogue = await r.json();
  SITUATIONS = catalogue.situations || [];
  return SITUATIONS;
}

const SI = {
  'pct<0.40': e => pct(e) < 0.4 && (e.w + e.l + (e.otl || 0)) >= 8,
  'pct<0.45': e => pct(e) < 0.45 && (e.w + e.l + (e.otl || 0)) >= 12,
  'serieDef>=4': e => (e.serieDef || 0) >= 4,
  'serieDef>=3': e => (e.serieDef || 0) >= 3,
  'serieVic>=5': e => (e.serieVic || 0) >= 5,
  'vedetteSeche>=8': e => (e.vedetteSeche || 0) >= 8,
  'soirsEreintants>=3': e => (e.soirsEreintants || 0) >= 3,
  'blessure&&capSerre': e => !!(e.blessure && e.capSerre),
  'departsPartant>=12': e => (e.departsPartant || 0) >= 12,
  'toi4<0.14': e => (e.toi4 || 1) < 0.14,
  rival: e => !!e.rival,
  advTop: e => !!e.advTop,
  retourBlessure: e => !!e.retourBlessure,
  vedetteChere: e => !!e.vedetteChere,
  jeuneChaud: e => !!e.jeuneChaud,
  veteranLent: e => !!e.veteranLent,
  auxChaud: e => !!e.auxChaud,
  identite: e => !!e.identite,
  objectifRate: e => !!e.objectifRate,
  ppSec: e => !!e.ppSec,
  pkMou: e => !!e.pkMou,
  soirMarque: e => !!e.soirMarque,
  true: () => true,
  recrue: e => !!e.recrue,
  gfBas: e => !!e.gfBas,
  matchChaud: e => !!e.matchChaud,
  series: e => !!e.series,
  game7: e => !!e.game7,
  uneFois: e => !(e.deja && e.deja.has && e.deja.has('malediction-une')),
  trioFroid: e => !!e.trioFroid,
  placeSeries: e => !!e.placeSeries,
};

function pct(e) {
  const n = (e.w || 0) + (e.l || 0) + (e.otl || 0);
  return n ? (e.w || 0) / n : 0.5;
}

export function situationsPossibles(etat = {}) {
  const j = etat.jour || 0;
  const vues = etat.deja instanceof Set ? etat.deja : new Set(etat.deja || []);
  return SITUATIONS.filter(s => {
    if (vues.has(s.id)) return false;
    const [a, b] = s.quand;
    if (j < a || j > b) return false;
    const test = SI[s.si];
    return test ? test({ ...etat, deja: vues }) : false;
  });
}

export function pigerSituation(etat = {}, alea = Math.random) {
  const pool = situationsPossibles(etat);
  if (!pool.length) return null;
  return pool[Math.floor(alea() * pool.length) % pool.length];
}

export function remplir(texte, vars = {}) {
  return String(texte || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
