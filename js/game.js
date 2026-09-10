/**
 * Contrôleur d'interface — poste de directeur général.
 *
 * Trois zones : la roulette (quelle saison, quelle équipe, quelle unité), le
 * tableau de bord (ce qu'il reste à combler et avec quel budget) et les deux
 * volets main / alignement.
 *
 * DEUX TIRAGES. En VESTIAIRE — le jeu d'origine — la roulette sort une
 * équipe et tout son club : trente cartes, six colonnes par poste, tri,
 * recherche, et les relances d'année, d'équipe et de passe. En LOTO, elle
 * sort trois équipes et ne montre que le joueur que chacune met à la case
 * qu'on comble : une main de trois cartes, DÉRIVÉE à chaque rendu du tirage
 * et de la case courante, donc viser une autre case dans l'alignement
 * recompose la main sans relancer.
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
  getHiddenRatings, getUnitSynergy, getPlayerKey, getPersonKey, createTeam, simulateLeague,
  autoRoster, MODES, modeDe, casesDuMode, joueurEquivalent,
} from './sim.js';
import { getTeamLogoHtml, TEAM_COLORS, getTeamAccent, getTeamBand, teamSeasonUrl } from './logos.js';
import { diffuserSaison } from './direct.js';
import { brancherBilan, renderResult, teamShort, teamLabel, tagCourt, cleDeSommaire } from './bilan.js';

/* Une icône du sprite de `index.html` : trait de 2, couleur du texte. */
const ico = n => `<svg class="ico" aria-hidden="true"><use href="#${n}"/></svg>`;
import { getArchetype, getEraFactor, getEraSalary, getLineZone, ageAtSeason, SEASON_ERA_CAP, getSecondaryPosition, seasonLancers, passesRelatives, mesuresDeSaison, SEUIL_MESURE } from './ratings.js';
import { getTraits, TRAITS } from './traits.js';

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
  YOU: 'NHL Stars',
};
const DEFUNCT = new Set(['QUE', 'HFD', 'MNS', 'AFM', 'ATL', 'KCS', 'CLR', 'CLE', 'CGS', 'OAK', 'WIN', 'PHX', 'MDA', 'ARI']);

/* =====================================================================
   État
   ===================================================================== */

const G = {
  roster: {},
  /*
   * Ce que la roulette a sorti : une liste de vestiaires `{ season, team,
   * pool }` — un seul en tirage VESTIAIRE, trois en tirage LOTO. La main
   * qu'on te tend s'en déduit à chaque rendu (`candidats`).
   */
  tirage: [],
  left: { ...REROLLS }, // relances d'année, d'équipe et de passe (tirage VESTIAIRE)
  relances: 0,          // relances restantes (tirage LOTO)
  target: null,         // case ciblée par le joueur
  selectedSlot: null,   // case sélectionnée pour un déplacement
  filter: 'ALL',
  /*
   * Deux façons de lire le même vestiaire, et c'est un vrai choix de lecture.
   * 'POS' range en six colonnes, une par poste — sur téléphone on les balaie
   * du doigt plutôt que de dérouler six sections empilées, parce qu'un
   * vestiaire de trente joueurs faisait six écrans de haut. 'LIST' les met
   * tous ensemble dans l'ordre du tri : c'est la vue du chasseur d'aubaine,
   * qui veut voir le meilleur pointeur du vestiaire sans se demander à quel
   * poste il joue.
   */
  poolView: 'POS',      // POS | LIST
  sortBy: 'PTS',
  search: '',
  onlyFit: false,
  statsProrata: false,
  salaryMode: '2026',   // '2026' | 'ERA'
  mode: 'CLASSIQUE',    // CLASSIQUE | LOTO | EXPRESS | LOTO_EXPRESS (voir MODES dans sim.js)
  renfort: null,        // EXPRESS : l'équipe qui fournit le reste de l'alignement
  view: 'pool',         // volet affiché sur petit écran
  done: false,
  loading: false,
  shards: new Map(),
};

const MODE = () => MODES[G.mode] || MODES.CLASSIQUE;
/** Les cases que TU combles : les 23 d'habitude, six en express. */
const casesActives = () => casesDuMode(G.mode);
/** Le premier vestiaire sorti — celui qui colore l'interface en tirage VESTIAIRE. */
const vestiaire = () => G.tirage[0] || null;
/** Un renfort est fourni par le mode express : il occupe une case, ne coûte rien. */
const estRenfort = p => !!(p && p._renfort);

const picked = () => Object.values(G.roster);
/** Les joueurs que tu as signés toi-même — les seuls qui touchent au plafond. */
const signes = () => picked().filter(p => !estRenfort(p));
/**
 * Ce joueur-SAISON est-il déjà signé ? Comparer les objets ne suffit pas :
 * un joueur échangé est dans le vestiaire de chacune de ses équipes, avec un
 * objet par équipe, et on pouvait donc le signer deux fois.
 */
const isPicked = p => {
  const k = getPersonKey(p);
  return picked().some(x => getPersonKey(x) === k);
};
const capUsed = () => signes().reduce((s, p) => s + p.$, 0);
const capLeft = () => MODE().cap - capUsed();
const slotsLeft = () => casesActives().filter(s => !G.roster[s.i]).length;
const totalCases = () => casesActives().length;

/**
 * Où ce joueur va-t-il naturellement ? On classe les cases libres par ordre
 * de bon sens : d'abord sa vraie position, puis sa zone d'efficacité, puis
 * l'unité la plus haute de cette zone. Un joueur de calibre quatrième trio
 * se propose donc au quatrième trio, pas au premier parce qu'il était vide.
 */
function slotFitScore(p, s) {
  const pen = getPositionPenalty(p, s);
  if (s.scratch) return 1000 + pen * 40 + s.i;      // les réservistes en dernier
  const ideal = getLineZone(p, getHiddenRatings(p).v).idealUnits;
  const dist = Math.min(...ideal.map(u => Math.abs(u - s.unit)));
  return pen * 40 + (dist === 0 ? 0 : 12 + dist * 6) + s.unit;
}

/**
 * Où ce joueur se situe par rapport à sa zone dans cette case : 'sous' (un
 * Top 6 au 4e trio, le talent gaspillé que le moteur punit fort), 'dessus'
 * (un Bottom 6 au 1er trio, puni à peine) ou null. Les gardiens et les
 * réservistes n'ont pas de malus de zone.
 */
function zoneEcart(p, s) {
  if (!p || !s || s.scratch || s.group === 'G' || p.p === 'G') return null;
  const ideal = getLineZone(p, getHiddenRatings(p).v).idealUnits;
  if (s.unit > Math.max(...ideal)) return 'sous';
  if (s.unit < Math.min(...ideal)) return 'dessus';
  return null;
}

const ZONE_SOUS_TITLE = 'Sous sa zone : ici, son talent est gaspillé et toute l\'unité porte un malus proportionnel à ce qu\'on perd. Vise une autre case dans l\'alignement ou déplace quelqu\'un.';
const ZONE_DESSUS_TITLE = 'Au-dessus de sa zone : −3 par cran, léger. Il tient la case faute de mieux.';

const nextNeed = () => casesActives().find(s => !G.roster[s.i]) || null;

/**
 * LA CASE COURANTE : celle que tu vises, sinon la première vide dans l'ordre
 * de l'alignement (premier trio, puis le deuxième… les paires, les gardiens,
 * les réservistes). En tirage LOTO c'est elle qui dit quel joueur exact les
 * trois clubs te tendent.
 */
const caseCourante = () => (G.target !== null && !G.roster[G.target] && casesActives().includes(SLOTS[G.target]))
  ? SLOTS[G.target] : nextNeed();

/**
 * LES JOUEURS QU'ON TE PROPOSE À CE TOUR. En VESTIAIRE, tout le club sorti.
 * En LOTO, la main : le joueur que chacun des trois clubs met à la case
 * courante, dérivée à chaque rendu et jamais stockée — viser une autre case
 * la recompose des mêmes clubs. Les joueurs déjà signés sont exclus de
 * l'alignement, donc un club qui ressort montre son trio recomposé sans eux.
 */
function candidats() {
  if (!G.tirage.length) return [];
  if (!MODE().loto) return vestiaire().pool;
  const c = caseCourante();
  if (!c) return [];
  const exclude = new Set(picked().map(getPersonKey));
  const vus = new Set();
  const out = [];
  for (const v of G.tirage) {
    const p = joueurEquivalent(v.pool, c, exclude);
    if (!p || vus.has(getPersonKey(p))) continue;
    vus.add(getPersonKey(p));
    out.push(p);
  }
  return out;
}

/**
 * Cases ouvertes pour un joueur, la plus sensée d'abord. En VESTIAIRE,
 * n'importe quelle case libre qui lui convient ; en LOTO, la main est celle
 * d'une seule case, et il n'y en a pas d'autre.
 */
const openSlots = p => {
  let libres = casesActives().filter(s => !G.roster[s.i] && fits(p, s));
  if (MODE().loto) { const c = caseCourante(); libres = libres.filter(s => s === c); }
  return libres.sort((a, b) => slotFitScore(p, a) - slotFitScore(p, b) || a.i - b.i);
};

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
      relances: G.relances,
      left: G.left,
      tirage: G.tirage.map(v => ({ season: v.season, team: v.team })),
      target: G.target,
      mode: G.mode,
      renfort: G.renfort,
    }));
  } catch { /* stockage indisponible */ }
}

function clearSave() {
  try { localStorage.removeItem('cap82_save'); } catch { /* ignore */ }
}

function saveOpts() {
  try {
    localStorage.setItem('cap82_opts', JSON.stringify({
      statsProrata: G.statsProrata, salaryMode: G.salaryMode, mode: G.mode,
      onlyFit: G.onlyFit, sortBy: G.sortBy, poolView: G.poolView,
    }));
  } catch { /* ignore */ }
}

function loadOpts() {
  try {
    const o = JSON.parse(localStorage.getItem('cap82_opts') || '{}');
    if (typeof o.statsProrata === 'boolean') G.statsProrata = o.statsProrata;
    if (o.salaryMode === 'ERA' || o.salaryMode === '2026') G.salaryMode = o.salaryMode;
    if (typeof o.onlyFit === 'boolean') G.onlyFit = o.onlyFit;
    if (typeof o.sortBy === 'string') G.sortBy = o.sortBy;
    if (o.poolView === 'POS' || o.poolView === 'LIST') G.poolView = o.poolView;
    // Un mode disparu (l'ancien « Par unité ») retombe sur le classique.
    if (o.mode && MODES[o.mode]) G.mode = o.mode;
  } catch { /* ignore */ }
}

async function restoreSave() {
  try {
    const raw = localStorage.getItem('cap82_save');
    if (!raw) return false;
    const data = JSON.parse(raw);
    // Une sauvegarde d'avant les mains (`cur` au lieu de `tirage`) ne se
    // reprend pas : le vestiaire qu'elle décrit n'existe plus sous ces règles.
    if (!data || !Array.isArray(data.tirage) || !data.tirage.length || !MODES[data.mode]) return false;

    const tirage = [];
    for (const v of data.tirage) {
      const shard = await getShard(v.season);
      if (!shard || !shard.byTeam[v.team]) return false;
      tirage.push({ season: v.season, team: v.team, pool: shard.byTeam[v.team] });
    }

    // Recharger les saisons des joueurs signés pour repeupler le coffre de cotes
    if (data.roster) {
      const seasons = new Set(Object.values(data.roster).filter(Boolean).map(p => p.s));
      for (const label of seasons) {
        if (label && !G.shards.has(label)) {
          try { await getShard(label); } catch { /* saison indisponible */ }
        }
      }
      // Relier chaque joueur sauvegardé à l'objet frais du shard
      for (const [i, saved] of Object.entries(data.roster)) {
        if (!saved) continue;
        const entry = G.shards.get(saved.s);
        const key = getPlayerKey(saved);
        const fresh = entry && entry.players.find(q => getPlayerKey(q) === key);
        // Un renfort reste un renfort : sans la marque, il compterait au
        // plafond au rechargement et la partie deviendrait injouable.
        data.roster[i] = saved._renfort ? { ...(fresh || saved), _renfort: true } : (fresh || saved);
      }
    }

    // Le mode fait partie de la partie, pas des préférences : une partie
    // express reprise en classique n'aurait plus le bon plafond.
    G.mode = data.mode;
    G.renfort = data.renfort || null;
    G.tirage = tirage;
    G.roster = data.roster || {};
    G.relances = Number.isFinite(data.relances) ? data.relances : MODE().relances;
    G.left = data.left || { ...REROLLS };
    G.target = data.target ?? null;
    applyTeamColors(MODE().loto ? null : tirage[0].team);
    return true;
  } catch {
    return false;
  }
}

/* =====================================================================
   Outils d'affichage
   ===================================================================== */

/* Sans équipe (tirage LOTO : trois clubs, aucun ne domine), les couleurs neutres. */
function applyTeamColors(team) {
  const c = (team && TEAM_COLORS[team]) || { primary: '#112236', accent: '#38bdf8' };
  const line = getTeamAccent(team);
  const root = document.documentElement.style;
  root.setProperty('--team-primary', c.primary);
  root.setProperty('--team-accent', c.accent);
  // Version éclaircie, celle qui porte les bordures et les libellés : la
  // couleur brute d'une équipe sombre serait invisible sur fond noir.
  root.setProperty('--team-line', line);
  // Le bandeau, lui, garde la couleur BRUTE : un aplat n'a pas besoin d'être
  // clair pour se voir, il a besoin d'une encre qui contraste (getTeamBand).
  const band = getTeamBand(team);
  root.setProperty('--team-band', band.bg);
  root.setProperty('--team-ink', band.ink);
  root.setProperty('--team-stripe', band.stripe);
}

const isD = p => p && (p.p === 'D' || p.p === 'LD' || p.p === 'RD');

function positionLabel(p) {
  if (!p) return '';
  if (p.p === 'G') return 'G';
  let primary = 'F';
  if (isD(p)) primary = (p.np === 'RD' || p.np === 'DD' || p.np === 'R') ? 'DD' : 'DG';
  else if (p.np === 'C') primary = 'C';
  else if (p.np === 'R' || p.np === 'AD') primary = 'AD';
  else if (p.np === 'L' || p.np === 'AG') primary = 'AG';

  const sec = getSecondaryPosition(p);
  if (!sec) return primary;
  let secLabel = sec;
  if (sec === 'LD') secLabel = 'DG';
  if (sec === 'RD') secLabel = 'DD';
  if (sec === 'L') secLabel = 'AG';
  if (sec === 'R') secLabel = 'AD';
  return `${primary} / ${secLabel}`;
}

/* Le poste écrit au long, pour le bandeau de carte. */
const POSTE_LONG = {
  AG: 'Ailier gauche', C: 'Centre', AD: 'Ailier droit',
  DG: 'Défenseur gauche', DD: 'Défenseur droit', G: 'Gardien', F: 'Attaquant',
};
const posteLong = p => POSTE_LONG[positionLabel(p).split(' / ')[0]] || '';

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
  return G.tirage.some(v => v.pool.some(p => p.bd)) || picked().some(p => p.bd);
}

function zoneTag(p, mini = false) {
  const z = getLineZone(p, getHiddenRatings(p).v);
  const where = z.idealUnits.map(u => u + 1).join(', ');
  const unit = isD(p) ? 'paires' : p.p === 'G' ? 'rôles' : 'trios';
  return `<span class="tag tag-zone lz${z.level}" title="${esc(z.label)}. Rend à 100 % sur les ${unit} ${where}.">${esc(mini ? (z.mini || z.short) : z.short)}</span>`;
}

/** Archétype : icône seulement dans le pick et le depth chart, libellé complet sur la fiche. */
function archTag(p, full = false) {
  const a = getArchetype(p, getHiddenRatings(p));
  const txt = full ? ` ${esc(a.label)}` : '';
  return `<span class="tag tag-arch" title="${esc(a.label)} — ${esc(a.desc)}">${a.icon}${txt}</span>`;
}

/**
 * Les traits : rares, donc ils ont leur place sur la carte. Un joueur sur cent
 * en porte un, et c'est la seule chose que la feuille de pointage ne dit pas —
 * afficher une icône ne coûte rien à la lisibilité et signale exactement ce
 * qu'on ne peut pas déduire des colonnes.
 */
function traitTagList(p, full = false) {
  return getTraits(p).map(t => {
    const meta = TRAITS[t.cle];
    const niveau = t.niveau === 0 ? 'Lauréat' : 'Finaliste';
    const txt = full ? ` ${esc(meta.label)}${t.niveau ? ' (finaliste)' : ''}` : '';
    return `<span class="tag tag-trait${t.niveau ? ' est-finaliste' : ''}"`
      + ` title="${esc(meta.short)} ${esc(p.s)} — ${niveau}. ${esc(meta.desc)}.">`
      + `${meta.icon}${txt}</span>`;
  });
}
const traitTags = (p, full = false) => traitTagList(p, full).join('');

function ageTag(p) {
  const age = ageAtSeason(p.bd, p.s);
  return age ? `<span class="tag tag-age" title="Âge au début de la saison ${p.s}">${age} ans</span>` : '';
}

function elcTag(p, full = false) {
  if (!p.elc) return '';
  const txt = full ? " Contrat d'entrée" : '';
  return `<span class="tag tag-elc" title="Contrat d'entrée : premier contrat d'un joueur de 24 ans ou moins. Base plafonnée selon l'époque, plus bonis.">🐣${esc(txt)}</span>`;
}

function realTag(p) {
  return p.isReal
    ? `<span class="tag tag-real" title="Salaire réellement publié cette saison-là, converti au prorata du plafond de l'année.">Salaire réel</span>`
    : `<span class="tag tag-est" title="Salaire estimé par le barème de cote globale : aucun montant publié pour cette saison.">Salaire estimé</span>`;
}

/*
 * Les portraits que le réseau a refusés. `onerror` retire l'image, mais le
 * rendu suivant la recréait et la redemandait : le test de fumée comptait
 * 1330 requêtes en échec sur une partie, du trafic mobile pour rien. Un
 * identifiant tombé ici ne sort plus que l'émoji de secours.
 */
const PORTRAITS_ABSENTS = new Set();
const portraitAbsent = id => { PORTRAITS_ABSENTS.add(Number(id)); };

function headshotHtml(p) {
  const fallback = `<span class="headshot-fallback">👤</span>`;
  if (PORTRAITS_ABSENTS.has(Number(p.id))) return fallback;
  if (!p.id) return fallback;
  return `${fallback}<img src="https://assets.nhle.com/mugs/nhl/latest/${p.id}.png" alt="" loading="lazy" onerror="this.remove();cap82.portraitAbsent(${Number(p.id)})">`;
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
  // Le bilan (js/bilan.js) reçoit ici tout ce qu'il lui faut du contrôleur.
  brancherBilan({
    $, G, TEAMFULL, bar, capUsed, esc, formatName, headshotHtml, ico, lienEquipe, lienJoueur,
    money, newGame, openModal, picked, rejouerSaison, renderMain, saveLeaderboard, statsSim, toast,
  });
  try {
    loadOpts();
    await loadIndex();
    if (!state.index.seasons.length) throw new Error('aucune saison disponible');
    setupEvents();
    // Les segments démarrent sur la valeur écrite dans le HTML : sans cette
    // ligne, un réglage relu du stockage s'appliquait au rendu mais pas au
    // bouton, qui montrait alors autre chose que ce qu'on regardait.
    syncOptionsUI();
    const restored = await restoreSave();
    if (!restored) {
      G.relances = MODE().relances;
      G.left = { ...REROLLS };
      if (MODE().renfort) await chargerRenfort();
      await nextSpin();
    }
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
  // Recherche et tri (tirage VESTIAIRE)
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
  bindModal('gameModal', null, 'closeGameBtn');

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
      document.querySelectorAll('.modal-backdrop').forEach(fermerModale);
      if (G.selectedSlot !== null || G.target !== null) {
        G.selectedSlot = null; G.target = null; render();
      }
    }
    if (ev.key === 'Tab') piegerFocus(ev);
  });

  $('mainBtn').onclick = runSeason;
}

/*
 * LE FOCUS RESTE DANS LA MODALE. Au clavier, Tab sortait de la fiche sans
 * qu'on s'en rende compte et continuait dans la page derrière. Une modale
 * qui s'ouvre prend le focus (son bouton de fermeture, sinon son premier
 * élément focalisable), Tab et Maj+Tab tournent à l'intérieur, et la
 * fermeture rend le focus à ce qui l'avait avant.
 */
const FOCALISABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let focusAvantModale = null;

const modaleOuverte = () => [...document.querySelectorAll('.modal-backdrop')].filter(m => m.style.display !== 'none' && m.offsetParent !== null).pop() || null;

function ouvrirModale(m) {
  if (!m) return;
  if (!modaleOuverte()) focusAvantModale = document.activeElement;
  m.style.display = 'flex';
  const cible = m.querySelector('.close-btn') || m.querySelector(FOCALISABLE);
  if (cible) cible.focus({ preventScroll: true });
}

function fermerModale(m) {
  if (!m || m.style.display === 'none') return;
  m.style.display = 'none';
  if (!modaleOuverte() && focusAvantModale && document.contains(focusAvantModale)) {
    focusAvantModale.focus({ preventScroll: true });
    focusAvantModale = null;
  }
}

function piegerFocus(ev) {
  const m = modaleOuverte();
  if (!m) return;
  const items = [...m.querySelectorAll(FOCALISABLE)].filter(el => el.offsetParent !== null);
  if (!items.length) { ev.preventDefault(); return; }
  const premier = items[0], dernier = items[items.length - 1];
  if (!m.contains(document.activeElement)) { ev.preventDefault(); premier.focus(); return; }
  if (ev.shiftKey && document.activeElement === premier) { ev.preventDefault(); dernier.focus(); }
  else if (!ev.shiftKey && document.activeElement === dernier) { ev.preventDefault(); premier.focus(); }
}

function bindModal(modalId, openId, closeId, onOpen) {
  const modal = $(modalId);
  if (!modal) return;
  if (openId && $(openId)) $(openId).onclick = () => { if (onOpen) onOpen(); ouvrirModale(modal); };
  if (closeId && $(closeId)) $(closeId).onclick = () => fermerModale(modal);
  modal.onclick = ev => { if (ev.target === modal) fermerModale(modal); };
}

const closeModal = id => fermerModale($(id));
const openModal = id => ouvrirModale($(id));

function setOption(key, val) {
  if (key === 'poolView') {
    G.poolView = val === 'LIST' ? 'LIST' : 'POS';
    // Demander les six colonnes quand un filtre n'en laisse qu'une seule ne
    // voudrait rien dire : le bouton lève le filtre plutôt que de ne rien
    // faire. Une commande visible doit toujours faire quelque chose.
    if (G.poolView === 'POS' && G.filter !== 'ALL') { G.filter = 'ALL'; renderFilters(); }
  }
  else if (key === 'stats') G.statsProrata = val === 'prorata';
  else if (key === 'salary') G.salaryMode = val;
  else if (key === 'onlyFit') G.onlyFit = val === 'on';
  else if (key === 'format' || key === 'tirage') {
    // Le mode est le produit du format (combien de cases) et du tirage (d'où
    // viennent les joueurs) : changer l'un garde l'autre.
    const m = modeDe(key === 'format' ? val : MODE().format, key === 'tirage' ? val : MODE().tirage);
    if (m === G.mode) return;
    G.mode = m;
    saveOpts();
    // L'alignement en cours n'a plus de sens sous d'autres règles.
    newGame().then(() => toast(`${MODES[m].nom} : ${MODES[m].desc}`));
    return;
  }
  saveOpts();
}

function syncOptionsUI() {
  const cur = {
    stats: G.statsProrata ? 'prorata' : 'real',
    salary: G.salaryMode,
    onlyFit: G.onlyFit ? 'on' : 'off',
    format: MODE().format,
    tirage: MODE().tirage,
    poolView: G.poolView,
  };
  const d = $('modeDesc');
  if (d) d.textContent = MODE().desc;
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
  // Les deux mesures que la carte ne disait pas (défensive, robustesse),
  // rangées parmi les réguliers de la saison : voir `mesuresDeSaison`.
  const entry = { players: shard.players, byTeam, mesures: mesuresDeSaison(shard.players) };
  G.shards.set(label, entry);
  return entry;
}

/** La défensive et la robustesse mesurées d'un joueur, ou null (gardien, moins de 20 matchs). */
function mesure(p) {
  const entry = p && G.shards.get(p.s);
  return (entry && entry.mesures && entry.mesures.get(p)) || null;
}

/*
 * 🛡️ Défensif, 🪨 Robuste : les étiquettes de ce que le joueur a fait sans la
 * rondelle, au 85e centile des réguliers de sa saison et de sa position. Elles
 * sont sur la carte pour qu'un bâti défensif ou robuste se trouve sans ouvrir
 * chaque fiche ; la fiche donne les colonnes derrière.
 */
function mesureTags(p, full = false) {
  const m = mesure(p);
  if (!m) return '';
  const tags = [];
  if (m.def != null && m.def >= SEUIL_MESURE) tags.push(`<span class="tag tag-mesure" title="Défensif — ${Math.round(m.def * 100)}e centile des réguliers de ${esc(p.s)} à sa position : différentiel corrigé de son club, points en désavantage, temps de glace.">🧊${full ? ' Défensif' : ''}</span>`);
  if (m.rob != null && m.rob >= SEUIL_MESURE) tags.push(`<span class="tag tag-mesure" title="Robuste — ${Math.round(m.rob * 100)}e centile des réguliers de ${esc(p.s)} à sa position : minutes de punition et mises en échec. Il pèse les soirs éreintants et en séries.">🪨${full ? ' Robuste' : ''}</span>`);
  return tags.join('');
}

/**
 * Un vestiaire au hasard : une saison, une équipe qui a de quoi s'aligner,
 * jamais un club déjà dans `deja` (le tirage précédent, ou les deux autres
 * clubs du même loto).
 */
async function vestiaireAuHasard(deja) {
  const seasons = state.index.seasons;
  for (let essai = 0; essai < 12; essai++) {
    const season = rnd(seasons);
    let shard;
    try { shard = await getShard(season); } catch { continue; }
    const teams = Object.keys(shard.byTeam)
      .filter(t => shard.byTeam[t].length >= 8 && !deja.has(`${season}_${t}`));
    if (!teams.length) continue;
    const team = rnd(teams);
    return { season, team, pool: shard.byTeam[team] };
  }
  return null;
}

/**
 * LA ROULETTE TOURNE.
 *
 * En VESTIAIRE (le jeu d'origine) : une saison et une équipe au hasard ;
 * `newSeason` et `newTeam` disent ce qu'une relance garde — « autre année »
 * change la saison et l'équipe, « autre équipe » garde la saison. Le club
 * doit avoir au moins un joueur plaçable ; le budget, c'est aux relances et
 * à la bande de secours de s'en occuper, comme avant.
 *
 * En LOTO : trois clubs, et la main doit contenir au moins un joueur qui a
 * une case et qui tient dans le budget du choix — vingt essais sur ce
 * critère, puis sous le plafond restant, puis plaçable.
 */
async function nextSpin(newSeason = true, newTeam = true) {
  G.loading = true;
  G.selectedSlot = null;
  renderSpin();

  const besoin = nextNeed();
  const seasons = state.index.seasons;

  if (!MODE().loto) {
    const cur = vestiaire();
    for (let attempt = 0; attempt < 25 && besoin; attempt++) {
      const season = (!newSeason && cur) ? cur.season : rnd(seasons);
      let shard;
      try { shard = await getShard(season); } catch { continue; }

      let teams = Object.keys(shard.byTeam).filter(t => shard.byTeam[t].length >= 8);
      if (!newTeam && cur && shard.byTeam[cur.team]?.length >= 8) {
        teams = [cur.team];
      } else if (cur) {
        teams = teams.filter(t => !(season === cur.season && t === cur.team));
      }
      if (!teams.length) continue;

      const team = rnd(teams);
      const pool = shard.byTeam[team];
      if (!pool.some(p => !isPicked(p) && openSlots(p).length)) continue;

      G.tirage = [{ season, team, pool }];
      break;
    }
    G.loading = false;
    applyTeamColors(vestiaire()?.team);
    saveGame();
    prefetch([rnd(seasons), rnd(seasons)]);
    return;
  }

  const n = 3;
  const avant = new Set(G.tirage.map(v => `${v.season}_${v.team}`));
  let dernier = null;

  for (let attempt = 0; attempt < 30 && besoin; attempt++) {
    const deja = new Set(avant);
    const tirage = [];
    for (let k = 0; k < n; k++) {
      const v = await vestiaireAuHasard(deja);
      if (!v) break;
      deja.add(`${v.season}_${v.team}`);
      tirage.push(v);
    }
    if (tirage.length < n) continue;

    G.tirage = tirage;
    const main = candidats().filter(p => !isPicked(p) && openSlots(p).length);
    if (!main.length) continue;
    dernier = tirage;
    const plafond = attempt < 20 ? maxForPick() : attempt < 26 ? capLeft() : Infinity;
    if (!main.some(p => p.$ <= plafond)) continue;
    break;
  }

  if (dernier) G.tirage = dernier;
  G.loading = false;
  applyTeamColors(null);
  saveGame();
  prefetch([rnd(seasons), rnd(seasons)]);
}

/* =====================================================================
   Rendu — plafond, roulette, tableau de bord
   ===================================================================== */

function renderCap() {
  const used = capUsed(), rem = capLeft(), left = slotsLeft();
  const isEra = G.salaryMode === 'ERA';
  const season = vestiaire()?.season || '2025-26';
  const eraCap = SEASON_ERA_CAP[season] || CAP;

  const amt = $('capAmt');
  amt.textContent = isEra ? money(getEraSalary(rem, season)) : money(rem);

  // Serré quand il reste moins de 1,5 M$ par case à combler
  const tight = left > 0 && rem < left * 1_500_000;
  amt.classList.toggle('over', rem < 0);
  amt.classList.toggle('tight', rem >= 0 && tight);

  $('capMaxLbl').textContent = isEra ? `/ ${money(eraCap)} (${season})` : `/ ${money(MODE().cap)}`;

  const fill = $('capFill');
  fill.style.width = Math.min(100, Math.max(0, (used / MODE().cap) * 100)) + '%';
  fill.classList.toggle('over', rem < 0);
  fill.classList.toggle('tight', rem >= 0 && tight);

  // Repère : masse salariale « au rythme » pour 23 joueurs
  const marker = $('capMarker');
  if (marker) marker.style.left = Math.min(100, (signes().length / totalCases()) * 100) + '%';

  $('cnt').textContent = `${signes().length} / ${totalCases()}`;

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

  if (G.loading || !G.tirage.length) {
    host.innerHTML = `<div class="spin-card"><div class="spin-top">
      <div class="spin-logo">${ico('i-dice')}</div>
      <div class="spin-id"><div class="spin-name">La roulette tourne…</div>
      <div class="spin-full">Chargement du vestiaire</div></div></div></div>`;
    return;
  }

  const need = nextNeed();
  const c = caseCourante();
  const targetSlot = G.target !== null ? SLOTS[G.target] : null;
  const instruction = targetSlot
    ? `${ico('i-target')} Case ciblée : <span class="target-on">${esc(slotShort(targetSlot))}</span> — touche-la à nouveau pour annuler.`
    : need ? ''
      : `Alignement complet : permute tes joueurs ou simule.`;

  if (MODE().loto) {
    // TROIS CLUBS, UN CHOIX. La carte porte la case qu'on comble en gros —
    // c'est elle qu'on décide — et les trois clubs en pastilles, chacune
    // vers sa vraie saison sur Hockey-Reference. Les cartes de la main
    // portent déjà chacune la couleur de leur vestiaire.
    const clubs = G.tirage.map(v => {
      const url = teamSeasonUrl(v.team, v.season);
      const dead = DEFUNCT.has(v.team) ? ' spin-club-dead' : '';
      const inner = `${getTeamLogoHtml(v.team, 18)}<span class="spin-club-code">${esc(v.team)}</span><span class="spin-club-season">${esc(v.season)}</span>`;
      return url
        ? `<a class="spin-club${dead}" href="${url}" target="_blank" rel="noopener" title="${esc(TEAMFULL[v.team] || v.team)} ${esc(v.season)} sur Hockey-Reference">${inner}</a>`
        : `<span class="spin-club${dead}">${inner}</span>`;
    }).join('');
    host.innerHTML = `
      <div class="spin-card">
        <div class="spin-top">
          <div class="spin-logo">${ico('i-dice')}</div>
          <div class="spin-id">
            <div class="spin-kicker"><span class="spin-code">Loto</span><span class="spin-season">${G.tirage.length} clubs</span></div>
            <div class="spin-name">${c ? esc(slotShort(c)) : 'Alignement complet'}</div>
          </div>
        </div>
        <div class="spin-clubs">${clubs}</div>
        ${instruction ? `<div class="spin-instruction">${instruction}</div>` : ''}
        <div class="rerolls">
          <button id="rrL" class="reroll" ${G.relances > 0 && need ? '' : 'disabled'} title="Relancer les trois clubs d'un coup">
            <span class="rr-lbl">${ico('i-dice')}Relancer les trois</span><span class="rr-count">${G.relances} restante${G.relances > 1 ? 's' : ''}</span></button>
        </div>
      </div>`;
    ajusterCartes(host);
    $('rrL').onclick = async () => {
      if (G.relances <= 0 || !need) return;
      G.relances--;
      await nextSpin();
      render();
    };
    return;
  }

  // UN CLUB, TOUT SON VESTIAIRE — le jeu d'origine. La carte se lit comme
  // une carte de pointage : le code et l'année en surtitre, le NOM de
  // l'équipe en gros, l'écusson en filigrane, et les trois relances en pied.
  // Le lien mène à la vraie saison de ce club sur Hockey-Reference.
  const v = vestiaire();
  const full = TEAMFULL[v.team] || v.team;
  const dead = DEFUNCT.has(v.team) ? ` <span class="spin-dead">· disparue</span>` : '';
  const url = teamSeasonUrl(v.team, v.season);
  host.innerHTML = `
    <div class="spin-card">
      <div class="spin-watermark" aria-hidden="true">${getTeamLogoHtml(v.team, 150)}</div>
      <div class="spin-top">
        <div class="spin-logo">${getTeamLogoHtml(v.team, 40)}</div>
        <div class="spin-id">
          <div class="spin-kicker"><span class="spin-code">${esc(v.team)}</span><span class="spin-season">${esc(v.season)}</span>${dead}</div>
          <div class="spin-name">${esc(full)}</div>
        </div>
        ${url ? `<a class="spin-ext" href="${url}" target="_blank" rel="noopener" title="La saison ${esc(v.season)} de cette équipe sur Hockey-Reference">${ico('i-ext')}</a>` : ''}
      </div>
      ${instruction ? `<div class="spin-instruction">${instruction}</div>` : ''}
      <div class="rerolls">
        <button id="rrS" class="reroll" ${G.left.season && need ? '' : 'disabled'} title="Retirer une autre saison au hasard">
          <span class="rr-lbl">${ico('i-dice')}Autre année</span><span class="rr-count">${G.left.season} restantes</span></button>
        <button id="rrT" class="reroll" ${G.left.team && need ? '' : 'disabled'} title="Garder la saison, changer d'équipe">
          <span class="rr-lbl">${ico('i-swap')}Autre équipe</span><span class="rr-count">${G.left.team} restantes</span></button>
        <button id="rrP" class="reroll" ${G.left.pass && need ? '' : 'disabled'} title="Passer ce vestiaire au complet">
          <span class="rr-lbl">${ico('i-skip')}Passer</span><span class="rr-count">${G.left.pass} restants</span></button>
      </div>
    </div>`;

  const reroll = async (kind, ns, nt) => {
    if (!G.left[kind] || !need) return;
    G.left[kind]--;
    await nextSpin(ns, nt);
    render();
  };
  ajusterCartes(host);
  $('rrS').onclick = () => reroll('season', true, false);
  $('rrT').onclick = () => reroll('team', false, true);
  $('rrP').onclick = () => reroll('pass', true, true);
}

/*
 * UNE CASE SE NOMME PAR SON RANG, PAS PAR SA ZONE. « Top 6 · C » désignait
 * aussi bien le premier trio que le deuxième — Lemieux allait « au Top 6 »
 * et on ne savait pas lequel. « 2e trio · C » le dit. La zone reste sur la
 * pastille du joueur, là où elle sert à décider.
 */
const uniteNom = s => !s ? '' : s.scratch ? 'Réserve' : s.group === 'G' ? 'Gardiens'
  : s.group === 'D' ? UNIT_NAMES_D[s.unit] : UNIT_NAMES_F[s.unit];
const slotShort = s => s ? `${uniteNom(s)} · ${s.role}` : '—';

function renderDash() {
  const host = $('dash');
  if (!host) return;

  const left = slotsLeft(), rem = capLeft();
  const maxPick = maxForPick();
  const need = caseCourante();
  const pool = candidats();
  const affordable = pool.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= rem).length;
  const safe = pool.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= maxPick).length;

  const budgetCls = left === 0 ? (rem >= 0 ? 'dash-good' : 'dash-bad')
    : maxPick < MIN_SAL ? 'dash-bad'
    : maxPick < 2_000_000 ? 'dash-warn' : '';
  const poolCls = affordable === 0 && left > 0 ? 'dash-bad' : safe === 0 ? 'dash-warn' : '';

  // Les explications vivent dans l'infobulle et dans les règles : le tableau
  // de bord ne montre que le chiffre qui sert à trancher.
  const needTitle = need
    ? (MODE().loto
      ? `Case qu'on comble : ${slotShort(need)}. La main est le joueur que trois clubs mettent à cette case exacte. Touche une autre case vide dans l'alignement pour la viser à la place : la main se recompose des mêmes clubs.`
      : `Prochaine case libre de l'alignement : ${slotShort(need)}. Touche une autre case dans l'alignement pour la viser à la place.`)
    : `Les ${totalCases()} cases sont comblées.`;
  const budgetTitle = left === 0
    ? (rem >= 0 ? `Masse salariale : ${money(capUsed())}, sous le plafond de ${money(MODE().cap)}.` : `Tu dépasses le plafond de ${money(-rem)} : retire un joueur.`)
    : `Le maximum que tu peux mettre sur ce joueur-ci en gardant de quoi combler les ${left - 1} case${left - 1 > 1 ? 's' : ''} suivantes au salaire plancher de ${money(MIN_SAL)}. Il te reste ${money(rem)} pour ${left} cases.`;
  const poolTitle = `${safe} joueur${safe > 1 ? 's' : ''} de ${MODE().loto ? 'cette main' : 'ce vestiaire'} tiennent dans le budget du prochain choix, ${affordable} sous le plafond restant, ${pool.length} au total.`
    + (MODE().loto ? ` Relances : ${G.relances}.` : ` Relances : ${G.left.season} année${G.left.season > 1 ? 's' : ''}, ${G.left.team} équipe${G.left.team > 1 ? 's' : ''}, ${G.left.pass} passe${G.left.pass > 1 ? 's' : ''}.`);

  host.innerHTML = `
    <div class="dash-card" title="${esc(needTitle)}">
      <h3>À combler</h3>
      <div class="dash-big sm">${need ? esc(slotShort(need)) : 'Complet'}</div>
    </div>
    <div class="dash-card" title="${esc(budgetTitle)}">
      <h3>Budget <span class="h3-long">du choix</span></h3>
      <div class="dash-big ${budgetCls}">${left ? money(Math.max(0, maxPick)) : money(rem)}</div>
    </div>
    <div class="dash-card" title="${esc(poolTitle)}">
      <h3>${MODE().loto ? '<span class="h3-long">Cette </span>main' : '<span class="h3-long">Ce </span>vestiaire'}</h3>
      <div class="dash-big ${poolCls}">${safe}<span class="dash-unit">signables</span></div>
    </div>
    ${G.renfort ? `<div class="dash-card" title="Les dix-sept autres cases sont comblées par cette vraie équipe. Elles ne coûtent rien au plafond et ne se modifient pas.">
      <h3>Renfort</h3>
      <div class="dash-big sm">${getTeamLogoHtml(G.renfort.team, 15)} ${esc(G.renfort.team)} <span class="dash-unit">${esc(G.renfort.season)}</span></div>
    </div>` : ''}`;
}

/* =====================================================================
   Rendu — bassin
   ===================================================================== */

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

/** Valeur de tri « points par million », utile pour repérer les aubaines. */
const valuePerM = p => ((p.p === 'G' ? (p.w ?? 0) * 2.4 : (p.pt || 0)) / Math.max(0.775, p.$ / 1e6));

function renderFilters() {
  const host = $('filters');
  if (!host) return;
  /*
   * TOUJOURS AG, C, AD, DG, DD, G — le même ordre et les mêmes sigles que les
   * colonnes du bassin, les rangées du tableau de profondeur et les bandeaux
   * de carte. Les pastilles disaient « Centres » avant « Ailiers G. », donc
   * dans un ordre qui n'était celui de rien d'autre dans le jeu, et les
   * libellés longs débordaient la rangée à 390 px : on ne voyait plus les
   * gardiens. Le mot complet reste dans l'infobulle.
   */
  const defs = [
    ['ALL', 'Tous', 'Tout le vestiaire', null],
    ['AG', 'AG', 'Ailiers gauches', POS_NEED[0]],
    ['C', 'C', 'Centres', POS_NEED[1]],
    ['AD', 'AD', 'Ailiers droits', POS_NEED[2]],
    ['LD', 'DG', 'Défenseurs gauches', POS_NEED[3]],
    ['RD', 'DD', 'Défenseurs droits', POS_NEED[4]],
    ['G', 'G', 'Gardiens', POS_NEED[5]],
  ];
  host.innerHTML = defs.map(([key, label, titre, def]) => {
    let badge = '';
    if (key === 'ALL') {
      badge = `<span class="chip-need${slotsLeft() === 0 ? ' full' : ''}">${signes().length}/${totalCases()}</span>`;
    } else if (def) {
      const n = signedCount(def);
      badge = `<span class="chip-need${n >= def.req ? ' full' : ''}">${n}/${def.req}</span>`;
    }
    return `<button class="chip${G.filter === key ? ' on' : ''}" data-f="${key}" role="tab"`
      + ` title="${esc(titre)}" aria-label="${esc(titre)}" aria-selected="${G.filter === key}">${esc(label)}${badge}</button>`;
  }).join('');

  host.querySelectorAll('.chip').forEach(b => {
    b.onclick = () => { G.filter = b.dataset.f; renderFilters(); renderPool(); renderPoolMeta(); };
  });
}

/*
 * En VESTIAIRE, le club entier passe par le filtre de position, la recherche,
 * l'option « signables seulement » et le tri. En LOTO, la main se lit telle
 * quelle, dans l'ordre des trois clubs : trois cartes n'ont besoin de rien.
 */
function poolFiltered() {
  if (MODE().loto) return candidats();
  let list = candidats().slice();

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
    list = list.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= rem);
  }

  const key = p => (p.p === 'G' ? (p.w ?? 0) : (p.pt ?? 0));
  const cmp = {
    PTS: (a, b) => key(b) - key(a) || b.$ - a.$,
    PPG: (a, b) => (displayStats(b).ppg ?? -1) - (displayStats(a).ppg ?? -1) || key(b) - key(a),
    SAL: (a, b) => b.$ - a.$ || key(b) - key(a),
    VAL: (a, b) => valuePerM(b) - valuePerM(a),
    PM: (a, b) => (b.pm ?? 0) - (a.pm ?? 0) || key(b) - key(a),
    DEF: (a, b) => ((mesure(b) || {}).def ?? -1) - ((mesure(a) || {}).def ?? -1) || key(b) - key(a),
    ROB: (a, b) => ((mesure(b) || {}).rob ?? -1) - ((mesure(a) || {}).rob ?? -1) || key(b) - key(a),
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
  const loto = MODE().loto;
  // Le volet change de nom avec le tirage : « Vestiaire » (tout le club) ou
  // « La main » (trois cartes) — et cache ses outils en loto.
  $('panePool')?.classList.toggle('loto', loto);
  const titre = $('poolTitle');
  if (titre) titre.textContent = loto ? 'La main' : 'Vestiaire';
  const tabLbl = $('tabPoolLbl');
  if (tabLbl) tabLbl.textContent = loto ? 'La main' : 'Vestiaire';
  const meta = $('poolCount');
  if (meta) {
    const c = caseCourante();
    meta.textContent = loto
      ? (c ? `${list.length} joueur${list.length > 1 ? 's' : ''} · ${slotShort(c)}` : 'Complet')
      : `${list.length} joueur${list.length > 1 ? 's' : ''}`;
  }
  const badge = $('tabPoolBadge');
  if (badge) badge.textContent = String(list.length);
  const rMeta = $('rosterMeta');
  if (rMeta) rMeta.textContent = `${signes().length} / ${totalCases()} · ${money(capUsed())}`;
  const rBadge = $('tabRosterBadge');
  if (rBadge) rBadge.textContent = `${signes().length}/${totalCases()}`;
}

/** Case où irait ce joueur : la cible si compatible, sinon la moins pénalisée. */
function destinationFor(p) {
  const vise = G.target !== null ? SLOTS[G.target] : null;
  const viseOK = vise && !G.roster[G.target] && fits(p, vise) && (!MODE().loto || vise === caseCourante());
  if (viseOK) return vise;
  return openSlots(p)[0] || null;
}

function playerCardEl(p) {
  const already = isPicked(p);
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
  el.title = 'Toucher la carte pour la fiche complète';
  const band = getTeamBand(p.t);
  el.style.setProperty('--team-line', getTeamAccent(p.t));
  el.style.setProperty('--team-band', band.bg);
  el.style.setProperty('--team-ink', band.ink);
  el.style.setProperty('--team-stripe', band.stripe);

  // La carte ne porte que l'essentiel : qui, combien, ce qu'il vaut et où il
  // va. Le détail des statistiques est dans la fiche, à un clic.
  const bigVal = p.p === 'G' ? st.w : st.pt;
  const bigUnit = p.p === 'G' ? 'V' : 'PTS';

  const tags = [
    traitTags(p),
    archTag(p),
    mesureTags(p),
    zoneTag(p),
  ].filter(Boolean).join('');

  let dest;
  if (already) {
    const cur = SLOTS.find(s => G.roster[s.i] === p);
    dest = `<span class="dest-ok">✓ signé</span>${cur ? ` · ${esc(slotShort(cur))}` : ''}`;
  } else if (!slot) {
    dest = `<span class="dest-bad">aucune case libre</span>`;
  } else if (over) {
    dest = `<span class="dest-bad">hors budget</span>`;
  } else {
    // La destination n'est dite que quand elle mérite un avertissement : la
    // case visée, une pénalité de position, ou une case hors de sa zone. Le
    // « sous sa zone » est celui qui coûte cher, il se dit en rouge AVANT la
    // signature plutôt qu'après dans le volet de l'alignement.
    const ecart = zoneEcart(p, slot);
    const bits = [];
    if (isTargeted) bits.push(`<span class="dest-target">${ico('i-target')} ${esc(slotShort(slot))}</span>`);
    if (risky) bits.push(`<span class="dest-bad" title="Ce salaire laisse moins que le plancher pour les cases restantes : tu ne pourrais plus compléter les ${totalCases()}.">⚠ bloque la fin</span>`);
    if (pen > 0) bits.push(`<span class="dest-bad">−${pen} hors position</span>`);
    if (ecart === 'sous') bits.push(`<span class="dest-bad" title="${esc(ZONE_SOUS_TITLE)}">▼ sous sa zone${isTargeted ? '' : ` : ${esc(slotShort(slot))}`}</span>`);
    else if (ecart === 'dessus') bits.push(`<span class="dest-warn" title="${esc(ZONE_DESSUS_TITLE)}">▲ au-dessus de sa zone</span>`);
    dest = bits.join(' · ');
  }

  const label = already ? '✓ Signé' : !slot ? 'Position pleine' : over ? 'Hors budget' : 'Signer';

  // Le bandeau dit d'un coup d'oeil ce qu'on regarde — le poste — et change
  // de couleur quand la carte change d'état. Il porte un fond, jamais du
  // texte de contenu : la même règle que les couleurs d'équipe.
  const etat = already ? 'signe' : over || !slot ? 'off' : '';
  // LE BANDEAU PORTE LA COULEUR DE L'ÉQUIPE, le poste et la provenance : tout
  // ce qui identifie la carte tient sur une ligne au lieu d'être éparpillé.
  // Le corps range le reste sur deux lignes à côté du portrait, plutôt que de
  // l'empiler : même information, deux fois moins de hauteur.
  el.innerHTML = `
    <div class="pcard-band">
      <span class="pb-pos ${positionClass(p)} ${etat}">${esc(positionLabel(p))}</span>
      <span class="pb-team">${getTeamLogoHtml(p.t, 14)}<span>${esc(p.t)}</span></span>
      <span class="pb-season">${esc(p.s)}</span>
    </div>
    <div class="pcard-inner">
      <div class="pcard-avatar">${headshotHtml(p)}</div>
      <div class="pcard-body">
        <div class="pcard-head">
          <div class="pcard-name">${formatName(p.n)}</div>
          <div class="pcard-price">${st.salaryMain}</div>
        </div>
        <div class="pcard-mid">
          <div class="pcard-big"><b>${bigVal}</b><span>${bigUnit}</span></div>
          <div class="tags">${tags}</div>
        </div>
      </div>
      <div class="pcard-dest">${dest}</div>
      <button class="btn-sign${already ? ' is-signed' : ''}" ${already || !slot || over ? 'disabled' : ''}>${label}</button>
    </div>`;

  el.onclick = ev => {
    if (ev.target.closest('.btn-sign')) return;
    showPlayerModal(p);
  };
  el.querySelector('.btn-sign').onclick = ev => {
    ev.stopPropagation();
    signPlayer(p);
  };
  return el;
}

async function signPlayer(p) {
  if (isPicked(p)) { toast(`${p.n} est déjà dans ton alignement.`, 'warn'); return; }
  const slot = destinationFor(p);
  if (!slot) { toast('Aucune case libre pour ce joueur.', 'bad'); return; }
  if (p.$ > capLeft()) { toast('Hors budget : il te reste ' + money(capLeft()) + '.', 'bad'); return; }

  const risky = p.$ > maxForPick();
  G.roster[slot.i] = p;
  G.target = null;
  G.selectedSlot = null;

  const pen = getPositionPenalty(p, slot);
  const sous = zoneEcart(p, slot) === 'sous';
  toast(`${p.n} → ${slotShort(slot)}`
    + (pen > 0 ? ` (−${pen} hors position)` : '')
    + (sous ? ' · ▼ sous sa zone' : ''), pen > 0 || sous ? 'warn' : '');
  if (risky && slotsLeft() > 0) {
    // Le message se compose maintenant : composé au déclenchement, il disait
    // « pour 0 cases » quand la dernière signature arrivait entre-temps.
    const msg = `Attention : ${money(capLeft())} pour ${slotsLeft()} cases, sous le plancher.`;
    setTimeout(() => toast(msg, 'warn'), 2700);
  }

  // Une signature, un tour : la roulette tourne à chaque fois, dans les
  // deux tirages. Ton premier trio sort de trois clubs, pas d'un seul.
  await nextSpin();
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
  if (G.done || slotsLeft() === 0 || !G.tirage.length) return null;
  const rem = capLeft();
  const free = candidats().filter(p => !isPicked(p) && openSlots(p).length);
  if (free.some(p => p.$ <= rem)) return null;
  const cheapest = free.length ? free.reduce((a, b) => (b.$ < a.$ ? b : a)) : null;
  // Seuls tes propres contrats se libèrent : un renfort ne coûte rien.
  const priciest = signes().slice().sort((a, b) => b.$ - a.$)[0] || null;
  const rerolls = MODE().loto ? G.relances : G.left.season + G.left.team + G.left.pass;
  return { rem, cheapest, priciest, rerolls };
}

function blockedBannerEl(st) {
  const el = document.createElement('div');
  el.className = 'blocked';
  const slot = st.priciest ? SLOTS.find(s => G.roster[s.i] === st.priciest) : null;
  const vise = G.target !== null;
  const issue = st.rerolls
    ? `Tu peux relancer (${st.rerolls} relance${st.rerolls > 1 ? 's' : ''} restante${st.rerolls > 1 ? 's' : ''})${vise ? ', viser une autre case' : ''} ou libérer de la masse salariale.`
    : vise ? 'Vise une autre case, ou libère de la masse salariale.'
      : 'Tes relances sont épuisées : il faut libérer de la masse salariale.';
  const ici = MODE().loto ? 'cette main' : 'ce vestiaire';
  el.innerHTML = `
    <div class="blocked-title">⚠ Aucune signature possible ici</div>
    <p>Il te reste <strong>${money(st.rem)}</strong> pour <strong>${slotsLeft()} case${slotsLeft() > 1 ? 's' : ''}</strong>.
      ${st.cheapest ? `Le moins cher de ${ici} qui a une case libre coûte ${money(st.cheapest.$)}.` : `Aucun joueur de ${ici} ne convient à une case libre.`}
      ${issue}</p>
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

  /*
   * L'avertissement d'impasse a son propre conteneur, au-dessus du bassin.
   * Dans le bassin il devenait une colonne de la bande qu'on balaie — donc
   * un panneau de plus à faire défiler, alors que c'est justement le moment
   * où le joueur est bloqué et doit le lire tout de suite.
   */
  const notice = $('poolNotice');
  if (notice) notice.innerHTML = '';

  if (G.loading) {
    host.className = 'pool';
    host.innerHTML = `<div class="empty-msg">Ouverture du vestiaire…</div>`;
    return;
  }

  const blocked = blockedState();
  if (blocked && notice) notice.appendChild(blockedBannerEl(blocked));

  const list = poolFiltered();
  if (!list.length) {
    host.className = 'pool';
    host.innerHTML = `<div class="empty-msg">${MODE().loto
      ? (slotsLeft() === 0 ? 'Alignement complet : permute tes joueurs ou simule.'
        : 'Ce tirage ne met personne à cette case.<br>Vise une autre case dans l\'alignement' + (G.relances ? ' ou relance.' : '.'))
      : `Aucun joueur ne correspond.<br>${G.search ? 'Efface la recherche' : G.onlyFit ? 'Désactive « signables seulement » dans les options' : 'Change de filtre'} ou utilise une relance.`}</div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  /*
   * En VESTIAIRE : six colonnes, une par poste — sauf si on a demandé la liste
   * complète, ou si un filtre de position ne laisse déjà qu'un seul poste :
   * ranger une colonne en six colonnes n'a pas de sens. La feuille de style
   * décide ensuite de leur forme : de vraies colonnes côte à côte sur grand
   * écran, une bande qu'on balaie du doigt sur téléphone. En LOTO : la main,
   * trois cartes dans l'ordre des clubs, rien d'autre à ranger.
   */
  const byPos = !MODE().loto && G.poolView === 'POS' && G.filter === 'ALL';
  host.className = 'pool' + (byPos ? ' by-pos' : '');

  if (byPos) {
    for (const col of POOL_COLS) {
      const players = list.filter(col.test);
      const n = signedCount(col.need);
      const el = document.createElement('div');
      el.className = 'pool-col';
      // Le liseré relie l'en-tête à la couleur des cartes de la colonne :
      // on retrouve son poste sans relire le titre.
      const ton = col.key === 'G' ? 'pos-g' : (col.key === 'DG' || col.key === 'DD') ? 'pos-d' : 'pos-f';
      el.innerHTML = `<div class="pool-col-head ${ton}">
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
  ajusterCartes(host);
}

/*
 * LE NOM DE FAMILLE, LES POINTS, LE SALAIRE ET LES ICÔNES SONT TOUJOURS
 * ENTIERS. C'est la règle de JP, et elle remplace les points de suspension
 * sur ces quatre-là : une carte qu'on signe sans avoir lu le nom ne sert à
 * rien. La boîte ne grandit toujours pas — les hauteurs restent fixes — mais
 * le contenu s'adapte : le nom rétrécit sa police jusqu'à tenir (plancher
 * 10 px), et la rangée d'étiquettes se réduit à l'échelle quand elle est
 * plus large que sa place (elle est alignée à droite, on la réduit vers la
 * droite). Les points et le salaire ne rétrécissent jamais : c'est le nom
 * qui cède la place, puisque c'est lui qui a le plus de marge.
 *
 * Lectures d'abord, écritures ensuite : mesurer puis écrire élément par
 * élément forcerait une remise en page par carte.
 */
function ajusterCartes(root) {
  const noms = [...root.querySelectorAll('.pcard-name .lname, .slot-name, .spin-name')];
  const tags = [...root.querySelectorAll('.pcard-mid .tags, .slot-tags')];
  for (const el of noms) el.style.fontSize = '';
  for (const el of tags) el.style.transform = '';
  const mesN = noms.map(el => [el, el.scrollWidth, el.clientWidth, parseFloat(getComputedStyle(el).fontSize)]);
  const mesT = tags.map(el => [el, el.scrollWidth, el.clientWidth]);
  for (const [el, sw, cw, fs] of mesN) {
    // Le nom du vestiaire a un plancher plus haut : c'est un titre, pas une étiquette.
    const plancher = el.classList.contains('spin-name') ? 17 : 10;
    if (sw > cw && cw > 0) el.style.fontSize = `${Math.max(plancher, Math.floor(fs * cw / sw * 10) / 10 - 0.2)}px`;
  }
  for (const [el, sw, cw] of mesT) {
    if (sw > cw && cw > 0) el.style.transform = `scale(${Math.max(0.6, cw / sw).toFixed(3)})`;
  }
}
let ajusteTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(ajusteTimer);
  ajusteTimer = setTimeout(() => ajusterCartes(document), 120);
});
// La police d'affichage arrive après le premier rendu : on remesure avec elle.
if (document.fonts?.ready) document.fonts.ready.then(() => ajusterCartes(document));

// LA HAUTEUR RÉELLE DE LA BARRE DU HAUT. Elle fait 84 px sur téléphone et
// 55 px à partir de 680 px, et deux choses se collent dessous — le volet de
// l'alignement en grand écran, la barre d'onglets du bilan. `--topbar-h`
// était une constante à 88 px, donc un jour de 33 px en grand écran ; on la
// mesure, et elle suit la police et le redimensionnement.
const topbar = document.querySelector('.topbar');
if (topbar && 'ResizeObserver' in window) {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--topbar-h', `${Math.round(topbar.offsetHeight)}px`);
  }).observe(topbar);
}

/* =====================================================================
   Rendu — alignement
   ===================================================================== */

/*
 * LE BANDEAU D'UNE CASE EST ÉTROIT — trois cases par trio sur un quart de
 * l'écran, soit environ cent pixels. « Réserve F » n'y tient pas à côté du
 * salaire, et le libellé se coupait à « RÉ… ». On abrège donc dans le
 * bandeau seulement, et seulement là où c'est nécessaire : la case vide, elle,
 * garde le mot entier puisqu'elle a toute la place, et les gardiens gardent
 * « Partant » et « Auxiliaire » puisqu'ils ne sont que deux par rangée.
 */
const ROLE_COURT = {
  'Réserve F': 'Rés. F', 'Réserve D': 'Rés. D', 'Réserve': 'Rés.',
};
const roleCourt = r => ROLE_COURT[r] || r;

/*
 * LA CASE NE PORTE QUE LE VERDICT DE PLACEMENT : la zone d'efficacité,
 * l'écart à cette zone, la pénalité de position. Rien d'autre.
 *
 * Elle portait aussi les traits et l'archétype, et c'est ce qui la salissait :
 * quatre cases par trio sur un quart d'écran font des cases de cent pixels,
 * où la quatrième étiquette se coupait en deux et laissait un moignon au
 * bord. Les traits n'ont pas disparu — ils sont sur la carte du bassin, au
 * moment où on décide de signer, et sur la fiche. Le tableau de profondeur,
 * lui, répond à une seule question : ce joueur est-il à sa place ?
 */
const SLOT_TAGS_MAX = 8;   // les icônes de traits devant le verdict, la rangée se réduit à l'échelle au besoin
/*
 * La case porte le verdict de placement — zone, écart, pénalité — et, devant,
 * les ICÔNES du joueur : ses traits et ses étiquettes mesurées. JP : *à voir
 * les icônes dans l'alignement* — on lit d'un coup d'œil son trio
 * d'étouffement et ses colosses une fois l'alignement monté.
 */
function slotTags(p, zoneEcartTag, penTag) {
  // Les icônes, serrées, sans cadre : la case est étroite. Le survol donne le mot.
  const icones = [...getTraits(p).map(t => TRAITS[t.cle]), ...mesureIcones(p)];
  const compact = icones.length
    ? `<span class="slot-icones" title="${esc(icones.map(i => i.short).join(' · '))}">${icones.map(i => i.icon).join('')}</span>` : '';
  return [compact, zoneTag(p, true), zoneEcartTag, penTag]
    .filter(Boolean).slice(0, SLOT_TAGS_MAX).join('');
}

/** Les étiquettes mesurées d'un joueur, en icônes : `[{ icon, short }]`. */
function mesureIcones(p) {
  const m = mesure(p);
  if (!m) return [];
  const out = [];
  if (m.def != null && m.def >= SEUIL_MESURE) out.push({ icon: '🧊', short: 'Défensif' });
  if (m.rob != null && m.rob >= SEUIL_MESURE) out.push({ icon: '🪨', short: 'Robuste' });
  return out;
}

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
    el.style.setProperty('--slot-line', getTeamAccent(p.t));
    const band = getTeamBand(p.t);
    el.style.setProperty('--slot-band', band.bg);
    el.style.setProperty('--slot-ink', band.ink);
    el.style.setProperty('--slot-stripe', band.stripe);
    const st = displayStats(p);
    const main = p.p === 'G' ? `${st.w} V` : `${st.pt} PTS`;
    /* La case est étroite : la ligne de statistiques y tient en une seule,
       donc on abrège « PTS/M » en « /M ». La fiche donne le libellé complet. */
    const secondary = p.p === 'G' ? `${p.sv ?? '—'} %ARR` : `${st.ppgStr}/M`;
    const penTag = pen > 0 ? `<span class="tag tag-pen" title="Pénalité de position : −${pen}">−${pen}</span>` : '';
    const ecart = zoneEcart(p, s);
    /* Une flèche seule : « ▼ zone » et « ▲ zone » poussaient la pénalité de
       position hors de la case sur les écrans où un trio n'a que cent pixels
       par joueur. L'infobulle dit la phrase entière. */
    const zoneEcartTag = ecart === 'sous' ? `<span class="tag tag-pen" title="${esc(ZONE_SOUS_TITLE)}">▼</span>`
      : ecart === 'dessus' ? `<span class="tag tag-zone-up" title="${esc(ZONE_DESSUS_TITLE)}">▲</span>` : '';
    if (estRenfort(p)) el.classList.add('renfort');
    // Le visage dans la case aussi : on reconnaît son alignement d'un coup
    // d'oeil, comme sur un tableau de vestiaire.
    el.innerHTML = `
      ${estRenfort(p) ? ''
        : `<button class="slot-remove" title="Retirer ${esc(p.n)}" aria-label="Retirer ${esc(p.n)}">✕</button>`}
      <div class="slot-band${estRenfort(p) ? ' off' : ''}">
        <span class="sb-role ${positionClass(p)}">${esc(roleCourt(s.role))}</span>
        <span class="sb-logo">${getTeamLogoHtml(p.t, 12)}</span>
        ${estRenfort(p)
          ? '<span class="slot-salary renfort" title="Fourni par ton club de renfort : ne coûte rien au plafond et ne se modifie pas.">renfort</span>'
          : `<span class="slot-salary">${st.salaryMain}</span>`}
      </div>
      <div class="slot-inner">
        <div class="slot-face pcard-avatar">${headshotHtml(p)}</div>
        <div class="slot-texte">
          <div class="slot-name">${formatName(p.n)}</div>
          <div class="slot-meta">${esc(positionLabel(p))} · ${esc(p.t)} '${esc(p.s.slice(-2))}</div>
          <div class="slot-meta">${main} · ${secondary}</div>
          <div class="slot-tags">${slotTags(p, zoneEcartTag, penTag)}</div>
        </div>
      </div>`;
    el.querySelector('.slot-remove')?.addEventListener('click', ev => {
      ev.stopPropagation();
      delete G.roster[s.i];
      G.selectedSlot = null;
      saveGame();
      render();
      toast(`${p.n} retiré. ${money(capLeft())} de disponible.`);
    });
  } else {
    el.innerHTML = `<div class="slot-role">${esc(s.role)}</div><div class="slot-sub">${esc(s.label)}</div>`;
  }

  el.onclick = () => {
    if (estRenfort(p)) { toast('Les renforts sont fournis : tu ne peux pas les déplacer.', 'warn'); return; }
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
        toast(`Case ciblée : ${slotShort(s)}. ${MODE().loto ? 'La main se recompose pour cette case.' : 'Les signatures iront là.'}`);
      }
    }
    render();
  };
  return el;
}

/*
 * Titres des rangées du tableau de profondeur. On les nomme par leur RANG —
 * 1er trio, 2e paire — et non par leur zone : deux rangées s'appelaient
 * « Top 6 » et deux autres « Top 4 », si bien qu'on ne savait plus laquelle
 * on regardait. La zone reste écrite sur la case vide et sur l'étiquette du
 * joueur, là où elle sert à décider.
 */
const UNIT_NAMES_F = ['1er trio', '2e trio', '3e trio', '4e trio'];
const UNIT_NAMES_D = ['1re paire', '2e paire', '3e paire'];

/* Version courte des libellés de chimie : l'en-tête d'une unité est étroit,
   le texte complet reste dans l'infobulle. */
const CHEM_SHORT = {
  'Chimie parfaite 🌟': '🌟 Parfaite',
  'Tandem moteur 🎯': '🎯 Tandem',
  'Conflit de rôles ⚠️': '⚠️ Conflit',
  'Chimie standard 👍': '👍 Standard',
  'Paire équilibrée ⚖️': '⚖️ Équilibrée',
  'Paire hyper-offensive 🚀': '🚀 Hyper-off.',
  'Paire hermétique 🔒': '🔒 Hermétique',
  'Paire standard 👍': '👍 Standard',
  'Trio standard 👍': '👍 Standard',
};
const chemShort = name => CHEM_SHORT[name] || name;
const zoneShort = tag => !tag ? '' : tag.replace('Trio ', '').replace('Paire ', '').replace('optimale', 'optimal');

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
      const sign = x => { const v = Math.round(x * 10) / 10; return v > 0 ? `+${v}` : `${v}`; };
      const bits = [chemShort(syn.chem || syn.name)];
      if (syn.zone) bits.push(zoneShort(syn.zone));
      const full = `${syn.name}${syn.desc ? ' — ' + syn.desc : ''} · attaque ${sign(syn.bonusOff || 0)}, défense ${sign(syn.bonusDef || 0)}`;
      chemHtml = `<span class="line-chem ${kind}" title="${esc(full)}">${esc(bits.join(' · '))} <b>${sign(syn.bonusOff || 0)}/${sign(syn.bonusDef || 0)}</b></span>`;
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
  host.appendChild(lineEl('Réservistes', SLOTS.filter(s => s.scratch), null, null));
  ajusterCartes(host);
}

function renderTeamSummary() {
  const host = $('teamSummary');
  if (!host) return;

  const oop = SLOTS.filter(s => G.roster[s.i] && getPositionPenalty(G.roster[s.i], s) > 0).length;
  let optimal = 0, miscast = 0;
  const units = [...Array(4).keys()].map(u => ['F', u]).concat([...Array(3).keys()].map(u => ['D', u]));
  for (const [g, u] of units) {
    const syn = getUnitSynergy(G.roster, g, u);
    if (syn.zone && syn.zone.startsWith('✨')) optimal++;
    if (syn.zone && syn.zone.startsWith('⚠️')) miscast++;
  }

  const tile = (k, v, cls, title) =>
    `<div class="sum-item" title="${esc(title)}"><div class="k">${k}</div><div class="v ${cls || ''}">${v}</div></div>`;

  host.innerHTML =
    tile('Masse', money(capUsed()), '', `Somme des salaires signés, sur un plafond de ${money(MODE().cap)}. Il reste ${money(capLeft())}.`)
    + tile('Vides', slotsLeft(), slotsLeft() ? 'dash-warn' : 'dash-good', `Cases encore à combler sur les ${totalCases()}.`)
    + tile('Optimales', `${optimal}/7`, optimal ? 'dash-good' : '', "Trios et paires dont tous les joueurs sont dans leur zone d'efficacité : +2 en attaque et +2 en défense. Les quatre trios et les trois paires comptent.")
    + tile('Mal assorties', miscast, miscast ? 'dash-bad' : '', 'Unités où au moins un joueur joue hors de sa zone.')
    + tile('Hors position', oop, oop ? 'dash-warn' : '', 'Joueurs placés ailleurs qu\'à leur position naturelle. Chacun perd de 2 à 5 points sur toutes ses cotes.');
}

function renderMain() {
  const b = $('mainBtn');
  const reste = slotsLeft();
  const over = capLeft() < 0;
  b.disabled = reste > 0 || G.done || over;
  b.textContent = G.done ? 'Saison simulée'
    : over ? `Plafond dépassé de ${money(-capLeft())}`
    : reste === 0 ? 'Simuler la saison · 82 matchs'
    : `Encore ${reste} joueur${reste > 1 ? 's' : ''}`;
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

/**
 * Le profil mesuré : les mêmes axes que ceux qui décident de l'archétype et
 * de la valeur, exprimés en écart au régulier moyen de la saison du joueur.
 * 1,00 = exactement le régulier moyen ; 2,00 = le double.
 */
function profilMesure(p) {
  const gp = Math.max(1, p.gp || 1);
  const [, pctTir, shF, shD, ptF, ptD, partButs, pimF] = seasonLancers(p.s);
  const cell = (k, v, t) =>
    `<div class="profil-cell" title="${esc(t)}"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;

  if (p.p === 'G') {
    const svLigue = 1 - (pctTir || 10.5) / 100;
    const ecart = ((p.sv ?? svLigue) - svLigue) * 1000;
    return `<div class="profil-grid">
      ${cell('ARRÊTS', (ecart >= 0 ? '+' : '') + ecart.toFixed(1), `Millièmes d'arrêts au-dessus de sa ligue en ${p.s} (${(svLigue * 1000).toFixed(0)}).`)}
      ${cell('CHARGE', ((p.sa || 0) / gp).toFixed(1), 'Lancers vus par match.')}
      ${cell('DÉPARTS', p.gp, 'Matchs joués — un partant se reconnaît autant à sa charge qu\'à son pourcentage.')}
    </div>`;
  }

  const est_D = p.p === 'D';
  const r = (x) => x.toFixed(2);
  const prod = (p.pt || 0) / gp / (est_D ? (ptD || 0.35) : (ptF || 0.62));
  const vol = (p.sh || 0) / gp / (est_D ? (shD || 1.35) : (shF || 1.75));
  const pen = (p.pt || 0) >= 15 ? (p.g || 0) / p.pt - (partButs || 0.40) : 0;
  const dur = (p.pim || 0) / gp / (pimF || 0.90);

  // Avec la rondelle, puis sans : la seconde rangée porte ce qui décide des
  // étiquettes 🛡️ Défensif et 🪨 Robuste, en colonnes claires.
  const m = mesure(p);
  const signe = x => (x >= 0 ? '+' : '') + Math.round(x);
  return `<div class="profil-titre">Avec la rondelle</div>
  <div class="profil-grid">
    ${cell('PRODUCTION', r(prod), `Points par match, sur le régulier moyen de ${p.s}. 1,00 = la moyenne.`)}
    ${cell('LANCERS', r(vol), `Lancers par match, sur le régulier moyen de ${p.s}.`)}
    ${cell('CRÉATION', r(passesRelatives(p)), `Passes par match, sur le régulier moyen de ${p.s} à sa position. C'est ce qu'il apporte aux lancers des autres : ses coéquipiers finissent mieux à ses côtés.`)}
    ${cell('PENCHANT', (pen >= 0 ? '+' : '') + pen.toFixed(2), pen >= 0
      ? 'Il finit plus que la moyenne : ses points sont surtout des buts.'
      : 'Il sert plus qu\'il ne finit : ses points sont surtout des passes.')}
  </div>
  <div class="profil-titre">Sans la rondelle${m ? ` · défensive ${Math.round(m.def * 100)}e centile, robustesse ${Math.round(m.rob * 100)}e` : ''}</div>
  <div class="profil-grid">
    ${m ? cell('DIFFÉRENTIEL', signe(m.diff82), `Son +/- par 82 matchs, corrigé à moitié de celui de son club — un bon joueur d'un mauvais club n'est pas puni deux fois.`) : ''}
    ${m && m.dn82 != null ? cell('DÉSAVANTAGE', Math.round(m.dn82), `Points en désavantage numérique par 82 matchs : qui tue les punitions.`) : ''}
    ${p.toi ? cell('MINUTES', p.toi.toFixed(1), 'Temps de glace par match, en minutes.') : ''}
    ${cell('ROBUSTESSE', r(dur), `Minutes de punition par match, sur le régulier moyen de ${p.s}${p.ht != null ? ` · ${p.ht} mises en échec par match` : ''}.`)}
  </div>`;
}


/* =====================================================================
   Fiche complète du joueur
   ===================================================================== */

/*
 * LES STATISTIQUES SIMULÉES D'UN JOUEUR, saison ou séries, sous une même
 * forme. La saison vit dans les compteurs `sim*` que le moteur écrit ; les
 * séries dans `p.po`, posé par `separerSeries` une fois les séries jouées.
 */
function statsSim(p, mode = 'saison') {
  if (mode === 'series') return p.po || null;
  if (p.simGP === undefined) return null;
  const o = {};
  for (const k of ['GP', 'G', 'A', 'PTS', 'PM', 'Inj', 'SH', 'PIM', 'PPG', 'W', 'L', 'OTL', 'GA', 'SO', 'SA', 'SV']) {
    if (p['sim' + k] !== undefined) o[k] = p['sim' + k];
  }
  return o;
}

/*
 * UN NOM CLIQUABLE OUVRE LA FICHE. Partout où un joueur est nommé après la
 * simulation — feuille de match, palmarès, sommaire, alignement d'une
 * équipe — son nom est un bouton qui ouvre sa fiche avec ses statistiques
 * SIMULÉES, saison ou séries. Le registre relie l'identifiant du DOM à
 * l'objet joueur ; un seul écouteur délégué sert tout le document.
 */
const FICHES = new Map();
function lienJoueur(p, t, mode = 'saison', html = null) {
  const cle = `${getPlayerKey(p)}|${mode}`;
  FICHES.set(cle, { p, t, mode });
  return `<button type="button" class="lien-joueur" data-fiche="${esc(cle)}" title="Fiche et statistiques ${mode === 'series' ? 'des séries' : 'de la saison simulée'}">${html ?? formatName(p.n)}</button>`;
}
const EQUIPES = new Map();
function lienEquipe(t, mode = 'saison', html = null) {
  const cle = `${t.tag}|${t.season || ''}|${mode}`;
  EQUIPES.set(cle, { t, mode });
  return `<button type="button" class="lien-equipe" data-equipe="${esc(cle)}" title="L'alignement et la saison complète de cette équipe">${html ?? esc(teamLabel(t))}</button>`;
}
document.addEventListener('click', ev => {
  const bj = ev.target.closest('[data-fiche]');
  if (bj && FICHES.has(bj.dataset.fiche)) {
    ev.preventDefault(); ev.stopPropagation();
    const { p, t, mode } = FICHES.get(bj.dataset.fiche);
    showPlayerModal(p, { sim: mode, team: t });
    return;
  }
  const be = ev.target.closest('[data-equipe]');
  if (be && EQUIPES.has(be.dataset.equipe)) {
    ev.preventDefault(); ev.stopPropagation();
    const { t, mode } = EQUIPES.get(be.dataset.equipe);
    showTeamModal(t, mode);
  }
});

const cellStat = (k, v, hl = false) => `<div class="stat-cell${hl ? ' hl' : ''}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
const signe = n => (n > 0 ? `+${n}` : `${n}`);

/** La grille de statistiques simulées d'un joueur (patineur ou gardien). */
function grilleSim(p, S) {
  if (!S) return '<div class="dash-note">Aucun match joué.</div>';
  if (p.p === 'G') {
    const pct = S.SA ? (S.SV / S.SA).toFixed(3).slice(1) : '—';
    return cellStat('PJ', S.GP || 0) + cellStat('V', S.W || 0, true) + cellStat('D', S.L || 0) + cellStat('DP', S.OTL || 0)
      + cellStat('BL', S.SO || 0) + cellStat('MBA', ((S.GA || 0) / Math.max(1, S.GP || 1)).toFixed(2)) + cellStat('%ARR', pct)
      + cellStat('ARR', S.SV || 0) + cellStat('TIRS', S.SA || 0);
  }
  return cellStat('PJ', S.GP || 0) + cellStat('B', S.G || 0) + cellStat('A', S.A || 0) + cellStat('PTS', S.PTS || 0, true)
    + cellStat('PTS/M', S.GP ? ((S.PTS || 0) / S.GP).toFixed(2) : '—') + cellStat('+/-', signe(S.PM || 0))
    + cellStat('PUN', S.PIM || 0) + cellStat('L', S.SH || 0) + cellStat('%', S.SH ? (100 * (S.G || 0) / S.SH).toFixed(1) : '—')
    + cellStat('BAN', S.PPG || 0) + (S.Inj ? cellStat('RATÉS', S.Inj) : '');
}

/**
 * La fiche. Sans option, c'est celle du bassin : la vraie saison, le profil,
 * l'impact sur ton alignement et le bouton Signer. Avec `sim`, c'est la
 * fiche d'APRÈS : les statistiques simulées d'abord (saison ou séries),
 * la vraie saison dessous pour comparer, et ni destination ni signature.
 */
function showPlayerModal(p, opts = {}) {
  const modal = $('hockeyCardModal');
  const body = $('hockeyCardBody');
  if (!modal || !body) return;

  const sim = opts.sim ? statsSim(p, opts.sim) : null;
  const apres = !!opts.sim;
  const already = isPicked(p);
  const slot = apres ? null : destinationFor(p);
  const rem = capLeft();
  const over = p.$ > rem;
  const pen = slot ? getPositionPenalty(p, slot) : 0;
  const st = displayStats(p);
  const colors = TEAM_COLORS[p.t] || { primary: '#112236', accent: '#38bdf8' };

  const cell = cellStat;
  const pmStr = signe(st.pm);

  const stats = p.p === 'G'
    ? cell('PJ', st.gp) + cell('V', st.w, true) + cell('D', st.l) + cell('BL', st.so)
      + cell('%ARR', p.sv ?? '—') + cell('MBA', p.ga ?? '—')
    : cell('PJ', st.gp) + cell('B', st.g) + cell('A', st.a) + cell('PTS', st.pt, true)
      + cell('PTS/M', st.ppgStr) + cell('+/-', pmStr) + cell('PUN', p.pim ?? '—')
      + cell('TG/M', p.toi ? Number(p.toi).toFixed(1) : '—')
      + (p.ht != null ? cell('MÉ/M', p.ht) : '')
      + (p.fo != null ? cell('MJ %', Math.round(p.fo * 100)) : '');

  /*
   * Plus de cotes sur la fiche. Un joueur se juge sur ce qu'il a fait, et
   * « ce qu'il a fait » se lit en écart au régulier moyen de SA saison —
   * sinon 60 points en 1981 et 60 points en 2003 auraient l'air pareils.
   */
  const ratings = profilMesure(p);

  const label = already ? '✓ Déjà signé' : !slot ? 'Aucune case libre' : over ? 'Hors budget' : `Signer · ${slot.role}`;
  const destNote = already ? ''
    : !slot ? `<div class="dash-note dash-bad">Toutes les cases compatibles sont prises. Déplace un joueur ou vise une autre position.</div>`
    : over ? `<div class="dash-note dash-bad">${money(p.$)} pour ${money(rem)} restants.</div>`
    : `<div class="dash-note${zoneEcart(p, slot) === 'sous' ? ' dash-bad' : ''}">Ira au <strong>${esc(slotShort(slot))}</strong>${pen > 0 ? ` avec une pénalité de <strong>−${pen}</strong> hors position` : ' sans pénalité de position'}${zoneEcart(p, slot) === 'sous' ? `, <strong>sous sa zone</strong> : son talent y est gaspillé et l'unité porte un malus. Vise une autre case ou déplace quelqu'un.` : zoneEcart(p, slot) === 'dessus' ? ', au-dessus de sa zone (−3 par cran, léger).' : ', dans sa zone.'} Il resterait ${money(rem - p.$)} pour ${slotsLeft() - 1} case${slotsLeft() - 1 > 1 ? 's' : ''}.</div>`;

  const nhlUrl = p.id ? `https://www.nhl.com/player/${p.id}` : `https://www.nhl.com/search?q=${encodeURIComponent(p.n)}`;
  const hdbUrl = `https://www.hockeydb.com/ihdb/stats/findplayer.php?full_name=${encodeURIComponent(p.n)}`;

  const equipeSim = opts.team ? `<span class="pcard-full-club">${getTeamLogoHtml(opts.team.tag, 14)} ${esc(teamLabel(opts.team))}</span>` : '';
  const corps = apres
    ? `<div class="section-label">${opts.sim === 'series' ? 'Statistiques des séries' : 'Statistiques de la saison simulée'} ${equipeSim}</div>
       <div class="stat-grid">${grilleSim(p, sim)}</div>
       ${opts.sim === 'series' && statsSim(p, 'saison') ? `<div class="section-label">Saison régulière simulée</div><div class="stat-grid">${grilleSim(p, statsSim(p, 'saison'))}</div>` : ''}
       <div class="section-label">Sa vraie saison ${esc(p.s)}${G.statsProrata ? ' (prorata 82, ajusté)' : ''}</div>
       <div class="stat-grid">${stats}</div>
       <div class="section-label">Profil mesuré, en écart au régulier moyen de sa saison</div>
       ${ratings}`
    : `<div class="section-label">Statistiques ${G.statsProrata ? '(prorata 82 matchs, ajusté à l\'époque)' : `de la saison ${esc(p.s)}`}</div>
       <div class="stat-grid">${stats}</div>
       <div class="section-label">Profil mesuré, en écart au régulier moyen de sa saison</div>
       ${ratings}
       <div class="section-label">Impact sur ton alignement</div>
       ${destNote}`;

  body.innerHTML = `
    <div class="pcard-full" style="--card-primary:${colors.primary};--card-accent:${colors.accent}">
      <div class="pcard-full-head">
        <div class="pcard-full-watermark">${getTeamLogoHtml(p.t, 128)}</div>
        <div class="pcard-full-top">
          <div class="pcard-full-photo">${headshotHtml(p)}</div>
          <div class="pcard-full-id">
            <div class="pcard-full-name">${formatName(p.n)}</div>
            <div class="pcard-full-team">${getTeamLogoHtml(p.t, 16)} ${esc(TEAMFULL[p.t] || p.t)} · ${esc(p.s)}
              <span class="pos-chip ${positionClass(p)}">${esc(positionLabel(p))}</span></div>
            <div class="tags pcard-full-tags">${traitTags(p, true)}${archTag(p, true)}${mesureTags(p, true)}${zoneTag(p)}${ageTag(p)}${elcTag(p, true)}${realTag(p)}${p.x ? '<span class="tag tag-traded">↔ Échangé</span>' : ''}</div>
            <div class="pcard-full-salary">
              <span class="big">${st.salaryMain}</span>
              <span class="small">${st.salarySub}</span>
              <span class="small">${G.salaryMode === 'ERA' ? '' : `${p.s} : ${money(st.eraSal)}`}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-body">${corps}</div>
      <div class="pcard-full-foot">
        <div class="ext-links">
          <a class="ext-link" href="${nhlUrl}" target="_blank" rel="noopener">Fiche LNH ${ico('i-ext')}</a>
          <a class="ext-link" href="${hdbUrl}" target="_blank" rel="noopener">HockeyDB ${ico('i-ext')}</a>
          ${teamSeasonUrl(p.t, p.s) ? `<a class="ext-link" href="${teamSeasonUrl(p.t, p.s)}" target="_blank" rel="noopener" title="La saison ${esc(p.s)} de son équipe sur Hockey-Reference">${esc(p.t)} ${esc(p.s)} ${ico('i-ext')}</a>` : ''}
        </div>
        ${apres ? '' : `<button class="btn go" id="modalSignBtn" ${already || !slot || over ? 'disabled' : ''}>${label}</button>`}
      </div>
    </div>`;

  const btn = $('modalSignBtn');
  if (btn) {
    btn.onclick = () => {
      closeModal('hockeyCardModal');
      signPlayer(p);
    };
  }
  ouvrirModale(modal);
}

/*
 * L'ALIGNEMENT COMPLET D'UNE ÉQUIPE, ET SA SAISON. Ce que la ligue a joué
 * se vérifie ici, équipe par équipe : les 23 fiches simulées (patineurs par
 * points, gardiens à part), puis les 82 résultats dans l'ordre du calendrier.
 * En mode séries, ce sont les statistiques et les matchs des séries.
 */
function showTeamModal(t, mode = 'saison') {
  const joueurs = SLOTS.map(s => t.roster[s.i]).filter(Boolean);
  const pat = joueurs.filter(p => p.p !== 'G').map(p => [p, statsSim(p, mode)]).filter(([, S]) => S)
    .sort((a, b) => (b[1].PTS || 0) - (a[1].PTS || 0) || (b[1].G || 0) - (a[1].G || 0));
  const gar = joueurs.filter(p => p.p === 'G').map(p => [p, statsSim(p, mode)]).filter(([, S]) => S)
    .sort((a, b) => (b[1].GP || 0) - (a[1].GP || 0));
  const ligneP = ([p, S]) => `<tr>
    <td class="left"><div class="team-cell">${lienJoueur(p, t, mode, `<span>${esc(p.n)}</span>`)}</div></td>
    <td class="sub-cell">${esc(positionLabel(p).split(' / ')[0])}</td>
    <td class="stat">${S.GP || 0}</td><td class="stat">${S.G || 0}</td><td class="stat">${S.A || 0}</td>
    <td class="stat heros">${S.PTS || 0}</td><td class="stat">${signe(S.PM || 0)}</td><td class="stat">${S.PIM || 0}</td>
    <td class="stat">${S.SH || 0}</td><td class="stat">${S.PPG || 0}</td></tr>`;
  const ligneG = ([p, S]) => `<tr>
    <td class="left"><div class="team-cell">${lienJoueur(p, t, mode, `<span>${esc(p.n)}</span>`)}</div></td>
    <td class="sub-cell">G</td>
    <td class="stat">${S.GP || 0}</td><td class="stat heros">${S.W || 0}</td><td class="stat">${S.L || 0}</td><td class="stat">${S.OTL || 0}</td>
    <td class="stat">${((S.GA || 0) / Math.max(1, S.GP || 1)).toFixed(2)}</td><td class="stat">${S.SA ? (S.SV / S.SA).toFixed(3).slice(1) : '—'}</td>
    <td class="stat">${S.SO || 0}</td></tr>`;

  const journal = mode === 'series' ? (t.poJournal || []) : (t.journal || []);
  // Chaque match de la liste ouvre son sommaire, quand sa feuille existe.
  const resultats = journal.map(m => { const cle = cleDeSommaire(m.feuille); return `<tr class="${m.win ? 'gagne' : 'perdu'}${cle ? ' ouvrable' : ''}"${cle ? ` data-sommaire="${esc(cle)}" title="Sommaire du match"` : ''}>
    <td class="sub-cell">${m.n}</td>
    <td class="left"><div class="team-cell">${getTeamLogoHtml(m.adv.tag, 14)}${lienEquipe(m.adv, mode, `<span>${esc(teamLabel(m.adv))}</span>`)}</div></td>
    <td class="stat ${m.win ? 'v' : 'd'}">${m.win ? 'V' : m.ot ? 'DP' : 'D'}</td>
    <td class="stat">${m.gf}-${m.ga}${m.ot ? ' <small>P</small>' : ''}</td>
    <td class="sub-cell">${m.gardien ? esc(m.gardien.n) : ''}</td></tr>`; }).join('');

  const bilan = mode === 'series' && t.po ? t.po : t;
  $('gameModalTitle').innerHTML = `${getTeamLogoHtml(t.tag, 20)} ${esc(teamLabel(t))} <span class="som-ot">${mode === 'series' ? 'séries' : `${bilan.W}-${bilan.L}-${bilan.OTL} · ${bilan.PTS} pts`}</span>`;
  $('gameModalBody').innerHTML = `
    <div class="section-label">${mode === 'series' ? 'Statistiques des séries' : 'Alignement et statistiques de la saison'}</div>
    <div class="table-wrap haute"><table class="data">
      <thead><tr><th class="left">Joueur</th><th>Pos</th><th>PJ</th><th>B</th><th>A</th><th class="heros">PTS</th><th>+/-</th><th>PUN</th><th>L</th><th>BAN</th></tr></thead>
      <tbody>${pat.map(ligneP).join('') || '<tr><td colspan="10">Aucun patineur.</td></tr>'}</tbody>
    </table></div>
    <div class="table-wrap" style="margin-top:8px"><table class="data">
      <thead><tr><th class="left">Gardien</th><th>Pos</th><th>PJ</th><th class="heros">V</th><th>D</th><th>DP</th><th>MBA</th><th>%ARR</th><th>BL</th></tr></thead>
      <tbody>${gar.map(ligneG).join('') || '<tr><td colspan="9">Aucun gardien.</td></tr>'}</tbody>
    </table></div>
    <div class="section-label" style="margin-top:14px">${mode === 'series' ? 'Les matchs des séries' : `Les ${journal.length} matchs de la saison`}</div>
    <div class="table-wrap haute"><table class="data calendrier-equipe">
      <thead><tr><th>#</th><th class="left">Adversaire</th><th>R</th><th>Pointage</th><th class="left">Gardien</th></tr></thead>
      <tbody>${resultats || '<tr><td colspan="5">Aucun match.</td></tr>'}</tbody>
    </table></div>`;
  openModal('gameModal');
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
  body.innerHTML = list.map((i, idx) => `
    <div class="lb-item">
      <div>
        <div class="lb-score ${i.W === 82 ? 'perfect' : ''}">${i.W}-${i.L}-${i.OTL}</div>
        <div class="dash-note">${i.points} pts · différentiel ${i.GF - i.GA > 0 ? '+' : ''}${i.GF - i.GA}${i.points === best ? ' · <span class="dash-warn">meilleure</span>' : ''}</div>
      </div>
      <div class="lb-details">
        <div>${i.rank ? `${i.rank}e de ${i.nTeams}` : ''}</div>
        <div>Masse : ${money(i.capUsed)}</div>
        <div>${esc(i.date)}</div>
        ${Array.isArray(i.alignement) ? `<button class="btn small lb-replay" data-idx="${idx}" title="Relire ces 23 joueurs et jouer une nouvelle saison">${ico('i-dice')}Rejouer</button>` : ''}
      </div>
    </div>`).join('');
  body.querySelectorAll('.lb-replay').forEach(b => {
    b.onclick = () => reprendreAlignement(list[Number(b.dataset.idx)]);
  });
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
  // Par joueur-SAISON : sans ça, un adversaire pouvait aligner le même homme
  // que toi sous les couleurs de l'autre équipe où il a passé cette année-là.
  const exclude = new Set(picked().map(getPersonKey));
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
  // `exclude` s'accumule : deux équipes de la ligue ne peuvent pas habiller
  // le même joueur-saison, ce qui arrivait pour un joueur échangé quand les
  // deux clubs de la transaction sortaient tous les deux au tirage.
  const out = [];
  for (const c of cands.sort(() => Math.random() - 0.5)) {
    if (out.length >= count) break;
    const roster = autoRoster(c.pool, exclude);
    for (const p of Object.values(roster)) exclude.add(getPersonKey(p));
    out.push(createTeam(`${c.team} ${c.season}`, c.team, roster, { season: c.season }));
  }
  return out;
}

/**
 * La saison. Sans option, 31 vraies équipes sont tirées et le moteur tire
 * sa graine ; `adversaires` rejoue les mêmes 31 clubs (« Rejouer la
 * saison ») et `graine` la même suite de dés. La ligue jouée garde les deux
 * dans `G.ligue`, et l'historique les emporte.
 */
async function runSeason(opts = {}) {
  if (slotsLeft() > 0 || G.done || capLeft() < 0) return;
  G.done = true;
  const mb = $('mainBtn');
  mb.disabled = true;
  mb.textContent = 'Simulation de la ligue… 1 312 matchs';
  await new Promise(r => setTimeout(r, 20));

  let opponents = [];
  if (opts.adversaires) {
    opponents = opts.adversaires.map(a => createTeam(a.name, a.tag, a.roster, { season: a.season }));
  } else {
    try { opponents = await buildOpponents(31); } catch { opponents = []; }
  }
  if (opponents.length && opponents.length % 2 === 0) opponents.pop();

  const you = createTeam('NHL Stars', 'YOU', G.roster, { isPlayer: true });
  let r, teams, leaders = [], calendrier = [], graine = null;
  if (opponents.length) {
    const league = simulateLeague([you, ...opponents], 82, { graine: opts.graine || null });
    teams = league.standings;
    leaders = league.leaders;
    calendrier = league.calendrier;
    graine = league.graine;
    r = {
      W: you.W, L: you.L, OTL: you.OTL, GF: you.GF, GA: you.GA, points: you.PTS,
      attaque: you.strength.att, brigade: you.strength.def,
      rob: you.strength.rob, clu: you.strength.clu, gRating: you.strength.g,
    };
  } else {
    r = simulate(G.roster, { graine: opts.graine || null });
    graine = r.graine;
    Object.assign(you, { W: r.W, L: r.L, OTL: r.OTL, GF: r.GF, GA: r.GA, PTS: r.points });
    teams = [you];
  }
  G.ligue = {
    you, teams, calendrier, graine,
    // De quoi rejouer : les mêmes 31 clubs, à partir des mêmes alignements.
    adversaires: opponents.map(t => ({ name: t.name, tag: t.tag, roster: t.roster, season: t.season })),
  };

  // LA SAISON SE REGARDE JOUR PAR JOUR. Tout est joué ; l'écran rejoue le
  // calendrier, une journée à la fois, et le résultat ne se dessine qu'après
  // — ou dès qu'on saute à la fin.
  const montrer = () => renderResult(r, you, teams, leaders, calendrier);
  if (calendrier.length) {
    diffuserSaison({
      calendrier, teams, you,
      ctx: { esc, teamLabel, teamShort, tagCourt, logo: getTeamLogoHtml, band: getTeamBand },
      onTermine: montrer,
    });
  } else montrer();
}

/**
 * EXPRESS : le reste de l'alignement vient d'une vraie équipe, tirée au
 * hasard. Ces joueurs occupent leur case, ne coûtent rien au plafond et ne
 * se déplacent pas — ils sont le club dont tu hérites, et c'est par-dessus
 * qu'on te demande de bâtir un trio, une paire et un partant.
 */
async function chargerRenfort() {
  G.renfort = null;
  const actives = new Set(casesActives().map(s => s.i));
  for (let essai = 0; essai < 14; essai++) {
    const season = rnd(state.index.seasons);
    let shard;
    try { shard = await getShard(season); } catch { continue; }
    const teams = Object.keys(shard.byTeam).filter(t => shard.byTeam[t].length >= 20);
    if (!teams.length) continue;
    const team = rnd(teams);
    const roster = autoRoster(shard.byTeam[team]);
    if (Object.keys(roster).length < 20) continue;
    for (const s of SLOTS) {
      if (actives.has(s.i) || !roster[s.i]) continue;
      G.roster[s.i] = { ...roster[s.i], _renfort: true };
    }
    G.renfort = { season, team };
    return true;
  }
  return false;
}

/**
 * REJOUER LA SAISON : le même alignement, les mêmes 31 clubs, d'autres dés.
 * Après vingt minutes à bâtir 23 joueurs, une seule saison ne dit pas grand-
 * chose — la variance du moteur vaut facilement cinq victoires. Les équipes
 * sont recréées à partir des mêmes alignements (le moteur remet les fiches à
 * zéro), le moteur tire une nouvelle graine, et l'écran rejoue tout.
 */
async function rejouerSaison() {
  if (!G.ligue || !G.done) return;
  const adversaires = G.ligue.adversaires || [];
  G.done = false;
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  renderMain();
  await runSeason(adversaires.length ? { adversaires } : {});
}

/**
 * REPRENDRE UN ALIGNEMENT DE L'HISTORIQUE : les 23 joueurs sont relus dans
 * leurs shards (rechargés au besoin), le mode de l'époque est remis, et la
 * saison part tout de suite — contre 31 nouveaux clubs, sur de nouveaux dés.
 */
async function reprendreAlignement(entree) {
  if (!entree || !Array.isArray(entree.alignement)) return;
  closeModal('leaderboardModal');
  toast('On relit l\'alignement…');
  const roster = {};
  for (const a of entree.alignement) {
    if (!a) continue;
    if (!G.shards.has(a.s)) { try { await getShard(a.s); } catch { /* saison indisponible */ } }
    const entry = G.shards.get(a.s);
    const fresh = entry && entry.players.find(q => getPlayerKey(q) === a.k);
    if (!fresh) { toast(`La saison ${a.s} n'est plus disponible : impossible de reprendre cet alignement.`, 'bad'); return; }
    roster[a.i] = a.r ? { ...fresh, _renfort: true } : fresh;
  }
  if (entree.mode && MODES[entree.mode] && entree.mode !== G.mode) { G.mode = entree.mode; saveOpts(); }
  clearSave();
  G.roster = roster;
  G.tirage = [];
  G.target = null;
  G.selectedSlot = null;
  G.done = false;
  G.ligue = null;
  $('resultHost').innerHTML = '';
  $('resultHost').style.display = 'none';
  render();
  await runSeason();
}

async function newGame() {
  clearSave();
  G.roster = {};
  G.tirage = [];
  G.relances = MODE().relances;
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
  if (MODE().renfort) await chargerRenfort();
  await nextSpin();
  saveGame();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.cap82 = { G, cacheClear, simulate, portraitAbsent };
boot();
