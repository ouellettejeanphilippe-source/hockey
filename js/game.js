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
  getHiddenRatings, getUnitSynergy, getPlayerKey, getPersonKey, createTeam, simulateLeague,
  playSeries, autoRoster, tirsTotal, periodeDe, MODES, casesDuMode, uniteDeCase,
} from './sim.js';
import { recitDeBut, recitDeMatch, recitDeSerie, tempsDeJeu, NOM_PERIODE } from './recit.js';
import { getTeamLogoHtml, TEAM_COLORS, getTeamAccent, getTeamInk, getTeamBand, teamSeasonUrl } from './logos.js';
import { diffuserSeries } from './direct.js';

/* Une icône du sprite de `index.html` : trait de 2, couleur du texte. */
const ico = n => `<svg class="ico" aria-hidden="true"><use href="#${n}"/></svg>`;
import { getArchetype, getEraFactor, getEraSalary, getLineZone, ageAtSeason, SEASON_ERA_CAP, getSecondaryPosition, seasonLancers, passesRelatives } from './ratings.js';
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
  statsProrata: false,
  salaryMode: '2026',   // '2026' | 'ERA'
  onlyFit: false,
  mode: 'CLASSIQUE',    // CLASSIQUE | TRIOS | EXPRESS (voir MODES dans sim.js)
  renfort: null,        // EXPRESS : l'équipe qui fournit le reste de l'alignement
  view: 'pool',         // volet affiché sur petit écran
  done: false,
  loading: false,
  shards: new Map(),
};

const MODE = () => MODES[G.mode] || MODES.CLASSIQUE;
/** Les cases que TU combles : les 23 d'habitude, six en express. */
const casesActives = () => casesDuMode(G.mode);
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
 * L'unité qu'on est en train de bâtir : en mode PAR UNITÉ, on comble le
 * premier trio au complet avant de passer au deuxième, et tout ce qui ne
 * va pas dans cette unité-là n'est pas signable ce tour-ci. C'est ce qui
 * fait sortir un trio entier d'un seul vestiaire — sans cette contrainte,
 * la destination automatique envoyait chaque joueur dans SA zone et la
 * roulette tournait presque à chaque signature.
 */
const uniteCourante = () => uniteDeCase(nextNeed());

/** Cases ouvertes pour un joueur, la plus sensée d'abord. */
const openSlots = p => {
  let libres = casesActives().filter(s => !G.roster[s.i] && fits(p, s));
  if (MODE().parUnite) {
    const u = uniteCourante();
    const dedans = libres.filter(s => uniteDeCase(s) === u);
    if (dedans.length || u) libres = dedans;
  }
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
      left: G.left,
      cur: G.cur ? { season: G.cur.season, team: G.cur.team } : null,
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
      statsProrata: G.statsProrata, salaryMode: G.salaryMode,
      onlyFit: G.onlyFit, sortBy: G.sortBy, mode: G.mode, poolView: G.poolView,
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
    if (o.mode && MODES[o.mode]) G.mode = o.mode;
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
        // Un renfort reste un renfort : sans la marque, il compterait au
        // plafond au rechargement et la partie deviendrait injouable.
        data.roster[i] = saved._renfort ? { ...(fresh || saved), _renfort: true } : (fresh || saved);
      }
    }

    // Le mode fait partie de la partie, pas des préférences : une partie
    // express reprise en classique n'aurait plus le bon plafond.
    if (data.mode && MODES[data.mode]) G.mode = data.mode;
    G.renfort = data.renfort || null;
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
  const pool = G.cur ? G.cur.pool : [];
  return pool.some(p => p.bd) || picked().some(p => p.bd);
}

/** Valeur de tri « points par million », utile pour repérer les aubaines. */
const valuePerM = p => ((p.p === 'G' ? (p.w ?? 0) * 2.4 : (p.pt || 0)) / Math.max(0.775, p.$ / 1e6));

function zoneTag(p) {
  const z = getLineZone(p, getHiddenRatings(p).v);
  const where = z.idealUnits.map(u => u + 1).join(', ');
  const unit = isD(p) ? 'paires' : p.p === 'G' ? 'rôles' : 'trios';
  return `<span class="tag tag-zone lz${z.level}" title="${esc(z.label)}. Rend à 100 % sur les ${unit} ${where}.">${esc(z.short)}</span>`;
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
    // Les segments démarrent sur la valeur écrite dans le HTML : sans cette
    // ligne, un réglage relu du stockage s'appliquait au rendu mais pas au
    // bouton, qui montrait alors autre chose que ce qu'on regardait.
    syncOptionsUI();
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
const openModal = id => { const m = $(id); if (m) m.style.display = 'flex'; };

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
  else if (key === 'mode') {
    if (!MODES[val] || val === G.mode) return;
    G.mode = val;
    saveOpts();
    // L'alignement en cours n'a plus de sens sous d'autres règles.
    newGame().then(() => toast(`${MODES[val].nom} : ${MODES[val].desc}`));
    return;
  }
  saveOpts();
}

function syncOptionsUI() {
  const cur = {
    stats: G.statsProrata ? 'prorata' : 'real',
    salary: G.salaryMode,
    onlyFit: G.onlyFit ? 'on' : 'off',
    mode: G.mode,
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

  if (G.loading || !G.cur) {
    host.innerHTML = `<div class="spin-card"><div class="spin-top">
      <div class="spin-logo">${ico('i-dice')}</div>
      <div class="spin-id"><div class="spin-name">La roulette tourne…</div>
      <div class="spin-full">Chargement du vestiaire</div></div></div></div>`;
    return;
  }

  const full = TEAMFULL[G.cur.team] || G.cur.team;
  const dead = DEFUNCT.has(G.cur.team) ? ` <span class="spin-dead">· disparue</span>` : '';
  const need = nextNeed();

  const targetSlot = G.target !== null ? SLOTS[G.target] : null;
  const instruction = targetSlot
    ? `${ico('i-target')} Case ciblée : <span class="target-on">${esc(slotShort(targetSlot))}</span> — touche-la à nouveau pour annuler.`
    : need ? ''
      : `Alignement complet : permute tes joueurs ou simule.`;

  // La carte du vestiaire se lit comme une carte de pointage : le code et
  // l'année en surtitre, le NOM de l'équipe en gros, l'écusson en filigrane.
  // Le lien mène à la vraie saison de ce club sur Hockey-Reference.
  const url = teamSeasonUrl(G.cur.team, G.cur.season);
  host.innerHTML = `
    <div class="spin-card">
      <div class="spin-watermark" aria-hidden="true">${getTeamLogoHtml(G.cur.team, 150)}</div>
      <div class="spin-top">
        <div class="spin-logo">${getTeamLogoHtml(G.cur.team, 40)}</div>
        <div class="spin-id">
          <div class="spin-kicker"><span class="spin-code">${esc(G.cur.team)}</span><span class="spin-season">${esc(G.cur.season)}</span>${dead}</div>
          <div class="spin-name">${esc(full)}</div>
        </div>
        ${url ? `<a class="spin-ext" href="${url}" target="_blank" rel="noopener" title="La saison ${esc(G.cur.season)} de cette équipe sur Hockey-Reference">${ico('i-ext')}</a>` : ''}
      </div>
      ${instruction ? `<div class="spin-instruction">${instruction}</div>` : ''}
      <div class="rerolls">
        <button id="rrS" class="reroll" ${G.left.season ? '' : 'disabled'} title="Retirer une autre saison au hasard">
          <span class="rr-lbl">${ico('i-dice')}Autre année</span><span class="rr-count">${G.left.season} restantes</span></button>
        <button id="rrT" class="reroll" ${G.left.team ? '' : 'disabled'} title="Garder la saison, changer d'équipe">
          <span class="rr-lbl">${ico('i-swap')}Autre équipe</span><span class="rr-count">${G.left.team} restantes</span></button>
        <button id="rrP" class="reroll" ${G.left.pass ? '' : 'disabled'} title="Passer ce vestiaire au complet">
          <span class="rr-lbl">${ico('i-skip')}Passer</span><span class="rr-count">${G.left.pass} restants</span></button>
      </div>
    </div>`;

  const reroll = async (kind, ns, nt) => {
    if (!G.left[kind]) return;
    G.left[kind]--;
    await nextSpin(ns, nt);
    render();
  };
  ajusterCartes(host);
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

/** Raccourcis pour les rôles et cases de l'alignement. */
const SLOT_SHORT = {
  'Gardiens': 'Gardien', 'Réservistes': 'Réserve',
};
const slotShort = s => s ? `${SLOT_SHORT[s.label] || s.label} · ${s.role}` : '—';

function renderDash() {
  const host = $('dash');
  if (!host) return;

  const left = slotsLeft(), rem = capLeft();
  const maxPick = maxForPick();
  const need = nextNeed();
  const pool = G.cur ? G.cur.pool : [];
  const affordable = pool.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= rem).length;
  const safe = pool.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= maxPick).length;

  const budgetCls = left === 0 ? (rem >= 0 ? 'dash-good' : 'dash-bad')
    : maxPick < MIN_SAL ? 'dash-bad'
    : maxPick < 2_000_000 ? 'dash-warn' : '';
  const poolCls = affordable === 0 && left > 0 ? 'dash-bad' : safe === 0 ? 'dash-warn' : '';

  // Les explications vivent dans l'infobulle et dans les règles : le tableau
  // de bord ne montre que le chiffre qui sert à trancher.
  const needTitle = need
    ? `Prochaine case libre de l'alignement : ${need.label} · ${need.role}. Touche une autre case dans l'alignement pour la viser à la place.`
    : 'Les 23 cases sont comblées.';
  const budgetTitle = left === 0
    ? (rem >= 0 ? `Masse salariale : ${money(capUsed())}, sous le plafond de ${money(CAP)}.` : `Tu dépasses le plafond de ${money(-rem)} : retire un joueur.`)
    : `Le maximum que tu peux mettre sur ce joueur-ci en gardant de quoi combler les ${left - 1} case${left - 1 > 1 ? 's' : ''} suivantes au salaire plancher de ${money(MIN_SAL)}. Il te reste ${money(rem)} pour ${left} cases.`;
  const poolTitle = `${safe} joueur${safe > 1 ? 's' : ''} de ce vestiaire tiennent dans le budget du prochain choix, ${affordable} sous le plafond restant, ${pool.length} au total. Relances : ${G.left.season} année${G.left.season > 1 ? 's' : ''}, ${G.left.team} équipe${G.left.team > 1 ? 's' : ''}, ${G.left.pass} passe${G.left.pass > 1 ? 's' : ''}.`;

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
      <h3><span class="h3-long">Ce </span>vestiaire</h3>
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
    list = list.filter(p => !isPicked(p) && openSlots(p).length && p.$ <= rem);
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
  if (rMeta) rMeta.textContent = `${signes().length} / ${totalCases()} · ${money(capUsed())}`;
  const rBadge = $('tabRosterBadge');
  if (rBadge) rBadge.textContent = `${signes().length}/${totalCases()}`;
}

/** Case où irait ce joueur : la cible si compatible, sinon la moins pénalisée. */
function destinationFor(p) {
  const vise = G.target !== null ? SLOTS[G.target] : null;
  const viseOK = vise && !G.roster[G.target] && fits(p, vise)
    && (!MODE().parUnite || uniteDeCase(vise) === uniteCourante());
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
    zoneTag(p),
  ].filter(Boolean).join('');

  let dest;
  if (already) {
    const cur = SLOTS.find(s => G.roster[s.i] === p);
    dest = `<span class="dest-ok">✓ signé</span>${cur ? ` · ${esc(cur.label)} · ${esc(cur.role)}` : ''}`;
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
    if (isTargeted) bits.push(`<span class="dest-target">${ico('i-target')} ${esc(slot.label)} · ${esc(slot.role)}</span>`);
    if (risky) bits.push(`<span class="dest-bad" title="Ce salaire laisse moins que le plancher pour les cases restantes : tu ne pourrais plus compléter les 23.">⚠ bloque la fin</span>`);
    if (pen > 0) bits.push(`<span class="dest-bad">−${pen} hors position</span>`);
    if (ecart === 'sous') bits.push(`<span class="dest-bad" title="${esc(ZONE_SOUS_TITLE)}">▼ sous sa zone${isTargeted ? '' : ` : ${esc(slot.label)} · ${esc(slot.role)}`}</span>`);
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
  toast(`${p.n} → ${slot.label} · ${slot.role}`
    + (pen > 0 ? ` (−${pen} hors position)` : '')
    + (sous ? ' · ▼ sous sa zone' : ''), pen > 0 || sous ? 'warn' : '');
  if (risky && slotsLeft() > 0) {
    // Le message se compose maintenant : composé au déclenchement, il disait
    // « pour 0 cases » quand la dernière signature arrivait entre-temps.
    const msg = `Attention : ${money(capLeft())} pour ${slotsLeft()} cases, sous le plancher.`;
    setTimeout(() => toast(msg, 'warn'), 2700);
  }

  // Mode PAR UNITÉ : on reste dans le même vestiaire tant que le trio (ou la
  // paire) n'est pas complet, et seulement si ce vestiaire peut encore le
  // compléter. Sinon la roulette tourne, comme d'habitude.
  const suite = nextNeed();
  const memeUnite = MODE().parUnite && suite && uniteDeCase(suite) === uniteDeCase(slot)
    && G.cur?.pool.some(x => !isPicked(x) && fits(x, suite) && x.$ <= capLeft());
  if (!memeUnite) await nextSpin(true, true);
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
  const free = G.cur.pool.filter(p => !isPicked(p) && openSlots(p).length);
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
    host.innerHTML = `<div class="empty-msg">Aucun joueur ne correspond.<br>
      ${G.search ? 'Efface la recherche' : G.onlyFit ? 'Désactive « signables seulement » dans les options' : 'Change de filtre'} ou utilise une relance.</div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  /*
   * Six colonnes, une par poste — sauf si on a demandé la liste complète, ou
   * si un filtre de position ne laisse déjà qu'un seul poste : ranger une
   * colonne en six colonnes n'a pas de sens. La feuille de style décide
   * ensuite de leur forme : de vraies colonnes côte à côte sur grand écran,
   * une bande qu'on balaie du doigt sur téléphone.
   */
  const byPos = G.poolView === 'POS' && G.filter === 'ALL';
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
const SLOT_TAGS_MAX = 3;
function slotTags(p, zoneEcartTag, penTag) {
  return [zoneTag(p), zoneEcartTag, penTag]
    .filter(Boolean).slice(0, SLOT_TAGS_MAX).join('');
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
        <div class="slot-name">${formatName(p.n)}</div>
        <div class="slot-meta">${esc(positionLabel(p))} · ${esc(p.t)} '${esc(p.s.slice(-2))}</div>
        <div class="slot-meta">${main} · ${secondary}</div>
        <div class="slot-tags">${slotTags(p, zoneEcartTag, penTag)}</div>
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
        toast(`Case ciblée : ${s.label} · ${s.role}. Les signatures iront là.`);
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

  return `<div class="profil-grid">
    ${cell('PRODUCTION', r(prod), `Points par match, sur le régulier moyen de ${p.s}. 1,00 = la moyenne.`)}
    ${cell('LANCERS', r(vol), `Lancers par match, sur le régulier moyen de ${p.s}.`)}
    ${cell('CRÉATION', r(passesRelatives(p)), `Passes par match, sur le régulier moyen de ${p.s} à sa position. C'est ce qu'il apporte aux lancers des autres : ses coéquipiers finissent mieux à ses côtés.`)}
    ${cell('PENCHANT', (pen >= 0 ? '+' : '') + pen.toFixed(2), pen >= 0
      ? 'Il finit plus que la moyenne : ses points sont surtout des buts.'
      : 'Il sert plus qu\'il ne finit : ses points sont surtout des passes.')}
    ${cell('ROBUSTESSE', r(dur), `Minutes de punition par match, sur le régulier moyen de ${p.s}.`)}
  </div>`;
}


/* =====================================================================
   Fiche complète du joueur
   ===================================================================== */

function showPlayerModal(p) {
  const modal = $('hockeyCardModal');
  const body = $('hockeyCardBody');
  if (!modal || !body) return;

  const already = isPicked(p);
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
    : `<div class="dash-note${zoneEcart(p, slot) === 'sous' ? ' dash-bad' : ''}">Ira au <strong>${esc(slot.label)} · ${esc(slot.role)}</strong>${pen > 0 ? ` avec une pénalité de <strong>−${pen}</strong> hors position` : ' sans pénalité de position'}${zoneEcart(p, slot) === 'sous' ? `, <strong>sous sa zone</strong> : son talent y est gaspillé et l'unité porte un malus. Vise une autre case ou déplace quelqu'un.` : zoneEcart(p, slot) === 'dessus' ? ', au-dessus de sa zone (−3 par cran, léger).' : ', dans sa zone.'} Il resterait ${money(rem - p.$)} pour ${slotsLeft() - 1} case${slotsLeft() - 1 > 1 ? 's' : ''}.</div>`;

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
              <span class="pos-chip ${positionClass(p)}">${esc(positionLabel(p))}</span></div>
            <div class="tags pcard-full-tags">${traitTags(p, true)}${archTag(p, true)}${zoneTag(p)}${ageTag(p)}${elcTag(p, true)}${realTag(p)}${p.x ? '<span class="tag tag-traded">↔ Échangé</span>' : ''}</div>
            <div class="pcard-full-salary">
              <span class="big">${st.salaryMain}</span>
              <span class="small">${st.salarySub}</span>
              <span class="small">${G.salaryMode === 'ERA' ? '' : `${p.s} : ${money(st.eraSal)}`}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-body">
        <div class="section-label">Statistiques ${G.statsProrata ? '(prorata 82 matchs, ajusté à l\'époque)' : `de la saison ${esc(p.s)}`}</div>
        <div class="stat-grid">${stats}</div>
        <div class="section-label">Profil mesuré, en écart au régulier moyen de sa saison</div>
        ${ratings}
        <div class="section-label">Impact sur ton alignement</div>
        ${destNote}
      </div>
      <div class="pcard-full-foot">
        <div class="ext-links">
          <a class="ext-link" href="${nhlUrl}" target="_blank" rel="noopener">Fiche LNH ${ico('i-ext')}</a>
          <a class="ext-link" href="${hdbUrl}" target="_blank" rel="noopener">HockeyDB ${ico('i-ext')}</a>
          ${teamSeasonUrl(p.t, p.s) ? `<a class="ext-link" href="${teamSeasonUrl(p.t, p.s)}" target="_blank" rel="noopener" title="La saison ${esc(p.s)} de son équipe sur Hockey-Reference">${esc(p.t)} ${esc(p.s)} ${ico('i-ext')}</a>` : ''}
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

async function runSeason() {
  if (slotsLeft() > 0 || G.done || capLeft() < 0) return;
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

/* =====================================================================
   Résultat — noms d'équipe, statistiques de ligue, sommaires de match
   ===================================================================== */

/**
 * Le nom court pour un récit : « Bruins 1970-71 ». Le nom complet porte la
 * ville, ce qui donne « Bruins de Boston 1997-98 s'en tire contre Bruins de
 * Boston 1990-91 » — vrai, mais illisible.
 */
function teamShort(t) {
  if (!t) return '—';
  if (t.isPlayer) return 'ta formation';
  const full = TEAMFULL[t.tag] || t.tag;
  const nom = full.split(/ (?:de |des |du |d')/)[0];
  return t.season ? `${nom} ${t.season}` : nom;
}

/** « Bruins de Boston 1970-71 » plutôt que « BOS 1970-71 ». */
function teamLabel(t) {
  if (!t) return '—';
  if (t.isPlayer) return t.name;
  const full = TEAMFULL[t.tag] || t.tag;
  return t.season ? `${full} ${t.season}` : full;
}

/**
 * Le nom d'une équipe historique, cliquable vers SA saison sur
 * Hockey-Reference (`teamSeasonUrl`, js/logos.js) : une adresse par
 * équipe-saison, pas la page de la ligue où il fallait ensuite la chercher.
 */
function teamCell(t, taille = 15) {
  const label = esc(teamLabel(t));
  const url = t.isPlayer ? null : teamSeasonUrl(t.tag, t.season);
  const nom = url
    ? `<a class="team-link" href="${url}" target="_blank" rel="noopener" title="La saison ${esc(t.season)} de cette équipe sur Hockey-Reference">${label}</a>`
    : `<span>${label}</span>`;
  return `<div class="team-cell">${getTeamLogoHtml(t.tag, taille)}${nom}</div>`;
}

/**
 * Les meneurs de la ligue, toutes équipes confondues. Le classement seul ne
 * dit pas qui a marqué : après 1 312 matchs, c'est la première chose qu'on
 * veut lire.
 */
function leagueStats(teams) {
  const patineurs = [], gardiens = [];
  for (const t of teams) {
    for (const s of SLOTS) {
      const p = t.roster[s.i];
      if (!p || !p.simGP) continue;
      (p.p === 'G' ? gardiens : patineurs).push({ p, t });
    }
  }
  const top = (list, cle, n = 10) => list.slice().sort((a, b) => cle(b) - cle(a)).slice(0, n);
  return {
    points: top(patineurs, x => x.p.simPTS * 1000 + x.p.simG),
    buts: top(patineurs, x => x.p.simG * 1000 + x.p.simPTS),
    passes: top(patineurs, x => x.p.simA * 1000 + x.p.simPTS),
    plusmoins: top(patineurs, x => x.p.simPM),
    avantage: top(patineurs, x => (x.p.simPPG || 0) * 1000 + x.p.simG),
    punitions: top(patineurs, x => (x.p.simPIM || 0) * 1000 + x.p.simPTS),
    // Un gardien a besoin d'un vrai échantillon : 25 départs, comme la ligue
    // l'exige pour ses propres championnats.
    arrets: top(gardiens.filter(x => x.p.simGP >= 25), x => (x.p.simSA ? x.p.simSV / x.p.simSA : 0)),
    moyenne: top(gardiens.filter(x => x.p.simGP >= 25), x => -(x.p.simGA / Math.max(1, x.p.simGP))),
    victoires: top(gardiens, x => x.p.simW * 1000 + x.p.simSO),
  };
}

/*
 * Les sept palmarès, chacun avec ses colonnes. `heros` est l'indice de la
 * COLONNE QUI DONNE SON NOM AU PALMARÈS — les points chez les pointeurs, les
 * buts chez les buteurs. Elle est écrite ici plutôt que devinée à la dernière
 * colonne parce qu'elle n'y est pas toujours, et c'est la seule que le
 * téléphone garde : à 390 px un tableau de sept colonnes défilait
 * horizontalement, si bien qu'un palmarès des pointeurs s'ouvrait sans
 * montrer les points.
 */
const PALMARES = [
  { cle: 'points', titre: 'Pointeurs', cols: ['PJ', 'B', 'A', 'PTS'], heros: 3,
    vals: p => [p.simGP, p.simG, p.simA, `<b>${p.simPTS}</b>`] },
  { cle: 'buts', titre: 'Buteurs', cols: ['PJ', 'B', 'L', '%'], heros: 1,
    vals: p => [p.simGP, `<b>${p.simG}</b>`, p.simSH || 0, p.simSH ? (100 * p.simG / p.simSH).toFixed(1) : '—'] },
  { cle: 'passes', titre: 'Passeurs', cols: ['PJ', 'A', 'PTS'], heros: 1,
    vals: p => [p.simGP, `<b>${p.simA}</b>`, p.simPTS] },
  { cle: 'plusmoins', titre: 'Différentiel', cols: ['PJ', 'PTS', '+/-'], heros: 2,
    vals: p => [p.simGP, p.simPTS, `<b>${p.simPM > 0 ? '+' : ''}${p.simPM}</b>`] },
  { cle: 'avantage', titre: 'Avantage numérique', cols: ['PJ', 'B', 'BAN'], heros: 2,
    vals: p => [p.simGP, p.simG, `<b>${p.simPPG || 0}</b>`] },
  { cle: 'punitions', titre: 'Punitions', cols: ['PJ', 'PTS', 'PUN'], heros: 2,
    vals: p => [p.simGP, p.simPTS, `<b>${p.simPIM || 0}</b>`] },
  { cle: 'moyenne', titre: 'Gardiens · MBA', cols: ['PJ', 'V', 'BL', 'MBA'], heros: 3,
    vals: p => [p.simGP, p.simW, p.simSO, `<b>${(p.simGA / Math.max(1, p.simGP)).toFixed(2)}</b>`] },
  { cle: 'arrets', titre: 'Gardiens · %ARR', cols: ['PJ', 'ARR', 'TIRS', '%ARR'], heros: 3,
    vals: p => [p.simGP, p.simSV || 0, p.simSA || 0, `<b>${p.simSA ? (p.simSV / p.simSA).toFixed(3).slice(1) : '—'}</b>`] },
  { cle: 'victoires', titre: 'Gardiens · victoires', cols: ['PJ', 'V', 'D', 'BL'], heros: 1,
    vals: p => [p.simGP, `<b>${p.simW}</b>`, p.simL, p.simSO] },
];

function palmaresHtml(stats) {
  const onglets = PALMARES.map((d, i) =>
    `<button class="stat-tab${i === 0 ? ' on' : ''}" data-stat="${d.cle}">${esc(d.titre)}</button>`).join('');
  const tables = PALMARES.map((d, i) => {
    const rows = stats[d.cle].map((x, n) => `
      <tr class="${x.t.isPlayer ? 'you' : ''}">
        <td>${n + 1}</td>
        <td class="left"><div class="team-cell">${getTeamLogoHtml(x.t.tag, 14)}<span>${esc(x.p.n)}</span></div></td>
        <td class="sub-cell">${esc(x.t.isPlayer ? 'toi' : `${x.t.tag} ${(x.t.season || '').slice(2)}`)}</td>
        ${d.vals(x.p).map((v, c) => `<td class="stat${c === d.heros ? ' heros' : ''}">${v}</td>`).join('')}
      </tr>`).join('');
    return `<div class="stat-table" data-stat="${d.cle}"${i === 0 ? '' : ' hidden'}>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>#</th><th class="left">Joueur</th><th>Éq.</th>${d.cols.map((c, i) => `<th class="stat${i === d.heros ? ' heros' : ''}">${c}</th>`).join('')}</tr></thead>
        <tbody>${rows || '<tr><td colspan="8">Aucun joueur admissible.</td></tr>'}</tbody>
      </table></div></div>`;
  }).join('');
  return `<div class="stat-tabs" role="tablist">${onglets}</div>${tables}`;
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
    : 'Le plafond a coûté cher. La feuille de match ci-dessous montre où le bât blesse.';

  const rows = SLOTS.filter(s => G.roster[s.i]).map(s => {
    const p = G.roster[s.i];
    const pmCls = (p.simPM || 0) > 0 ? 'pm-pos' : (p.simPM || 0) < 0 ? 'pm-neg' : '';
    const pmStr = (p.simPM || 0) > 0 ? `+${p.simPM}` : `${p.simPM || 0}`;
    const inj = p.simInj ? ` · <span class="inj">🩹 ${p.simInj} PJ ratés</span>` : '';
    const stats = p.p === 'G'
      ? `${p.simGP || 0} PJ · ${p.simW || 0}-${p.simL || 0}-${p.simOTL || 0} · ${((p.simGA || 0) / Math.max(1, p.simGP || 1)).toFixed(2)} MBA · ${p.simSO || 0} BL${inj}`
      : `${p.simGP || 0} PJ · <b>${p.simG || 0} B</b> ${p.simA || 0} A · <b>${p.simPTS || 0} PTS</b> · <span class="${pmCls}">${pmStr}</span>${inj}`;
    return `<div class="rrow">
      <div class="rn">${getTeamLogoHtml(p.t, 15)} <span>${formatName(p.n)} <span class="sub">${esc(s.role)}</span></span></div>
      <div class="rs">${stats}${p.p === 'G' ? '' : ` · <span class="sub">${p.simSH || 0} lancers</span>`}</div>
    </div>`;
  }).join('');

  const standings = teams.map((t, i) => `
    <tr class="${t.isPlayer ? 'you' : ''}${i === 15 ? ' cut' : ''}">
      <td>${i + 1}</td>
      <td class="left">${teamCell(t)}</td>
      <td>${t.W + t.L + t.OTL}</td><td>${t.W}</td><td>${t.L}</td><td>${t.OTL}</td>
      <td class="pts">${t.PTS}</td><td>${t.GF}</td><td>${t.GA}</td>
      <td>${t.GF - t.GA > 0 ? '+' : ''}${t.GF - t.GA}</td>
    </tr>`).join('');

  const stats = teams.length > 1 ? leagueStats(teams) : null;

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
        <div class="hero-band ${rank === 1 ? 'or' : rank <= 16 ? '' : 'out'}">
          ${rank === 1 ? '1er de la ligue' : rank <= 16 ? `${rank}e de ${nTeams} · en séries` : `${rank}e de ${nTeams} · éliminé`}
        </div>
        <div class="score ${perfect ? 'perfect' : ''}">${r.W}-${r.L}-${r.OTL}</div>
        <div class="result-strip">
          <div class="rs-cell"><span class="k">PTS</span><b>${r.points}</b></div>
          <div class="rs-cell"><span class="k">Rang</span><b>${rank}<small>/${nTeams}</small></b></div>
          <div class="rs-cell"><span class="k">BP</span><b>${r.GF}</b></div>
          <div class="rs-cell"><span class="k">BC</span><b>${r.GA}</b></div>
          <div class="rs-cell"><span class="k">Diff</span><b class="${r.GF - r.GA >= 0 ? 'pm-pos' : 'pm-neg'}">${r.GF - r.GA > 0 ? '+' : ''}${r.GF - r.GA}</b></div>
          <div class="rs-cell"><span class="k">Masse</span><b>${money(capUsed())}</b></div>
        </div>
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

      ${stats ? `<div class="result-section">
        <h3>Statistiques de la ligue</h3>
        ${palmaresHtml(stats)}
      </div>` : ''}

      <div class="result-section">
        <h3>Infirmerie</h3>
        ${injuries}
      </div>

      <div class="result-section">
        <h3>Feuille de match de ta formation</h3>
        ${rows}
      </div>

      <div class="result-actions">
        <button class="btn blue" id="shareBtn">${ico('i-copy')}Copier le résultat</button>
        ${rank <= 16 ? `<button class="btn gold" id="playoffsBtn">${ico('i-cup')}Jouer les séries</button>` : ''}
        <button class="btn go" id="againBtn">Nouvelle partie</button>
      </div>
      <div id="playoffsSection"></div>
    </div>`;

  document.querySelectorAll('.stat-tab').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.stat-tab').forEach(x => x.classList.toggle('on', x === b));
      document.querySelectorAll('.stat-table').forEach(t => { t.hidden = t.dataset.stat !== b.dataset.stat; });
    };
  });

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

/* =====================================================================
   Séries — match par match, avec sommaire
   ===================================================================== */

const RONDES = ['Premier tour', 'Deuxième tour', 'Demi-finales', 'Finale de la Coupe Stanley'];

/**
 * Les séries, jouées match par match. Chaque match garde sa feuille — buts
 * avec leur instant, tirs par période, arrêts — et le sommaire s'ouvre d'un
 * clic. C'est la même simulation qu'avant : on ne jetait simplement pas ce
 * que le moteur produisait déjà.
 */
function runPlayoffs(top16) {
  const host = $('playoffsSection');
  if (!host) return;

  G.series = [];
  let ronde = top16.slice(), n = 0;
  while (ronde.length > 1) {
    const suivant = [];
    for (let i = 0; i < ronde.length / 2; i++) {
      const A = ronde[i], B = ronde[ronde.length - 1 - i];
      const s = playSeries(A, B);
      suivant.push(s.winner);
      G.series.push({ ...s, A, B, ronde: n, i: G.series.length });
    }
    ronde = suivant;
    n++;
  }
  const champion = ronde[0];
  const btn = $('playoffsBtn');
  if (btn) btn.disabled = true;

  // LE DIRECT D'ABORD. Tout est déjà joué ; on ne dessine le tableau qu'une
  // fois que le joueur a regardé ses séries match par match — ou qu'il a
  // fermé le direct. Le mystère tient à ce seul ordre.
  diffuserSeries({
    series: G.series, rondes: RONDES,
    ctx: { esc, formatName, teamLabel, teamShort, tagCourt, logo: getTeamLogoHtml, band: getTeamBand },
    onTermine: () => dessinerTableauDesSeries(host, n, champion),
  });
}

/** Le tableau complet des séries, toutes rondes, tous les matchs cliquables. */
function dessinerTableauDesSeries(host, n, champion) {
  let html = `<div class="result-section"><h3>${ico('i-cup')}Séries éliminatoires</h3>
    <p class="series-legende">Touche un match pour son sommaire.
      <span class="lg lg-or">or</span> le match qui a réglé la série ·
      <span class="lg lg-ot">rose</span> réglé en prolongation</p>`;
  for (let r = 0; r < n; r++) {
    const dedans = G.series.filter(s => s.ronde === r);
    html += `<div class="series-round"><h4>${esc(RONDES[r] || `Ronde ${r + 1}`)}</h4><div class="series-grid">`;
    for (const s of dedans) html += serieHtml(s);
    html += '</div></div>';
  }
  html += `<div class="champion">
    <h3>Champion de la Coupe Stanley</h3>
    <div class="champ-name">${getTeamLogoHtml(champion.tag, 30)} ${esc(teamLabel(champion))}</div>
    <p>${champion.isPlayer ? 'Ta formation soulève la Coupe. 🏆' : 'Ta formation est tombée en chemin. Rebâtis et réessaie.'}</p>
  </div></div>`;

  host.innerHTML = html;
  host.querySelectorAll('.mcard').forEach(b => {
    b.onclick = () => showGameModal(Number(b.dataset.serie), Number(b.dataset.match));
  });
  host.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Le tag et l'année courte : « MTL '76 », ce qui tient dans une carte. */
const tagCourt = t => t.isPlayer ? 'TOI' : `${t.tag}${t.season ? ` '${t.season.slice(2, 4)}` : ''}`;

/**
 * Une carte de match, dans le langage des cartes de pointage : un bandeau
 * coloré qui dit ce qu'on regarde, les deux écussons, puis les deux lignes
 * de pointage — le gagnant en clair, le perdant en gris. Le bandeau porte
 * la couleur, jamais le texte de la carte : c'est la même règle que pour
 * les couleurs d'équipe.
 */
function matchCardHtml(s, f, i) {
  // Le bandeau porte une information, pas une décoration : l'or marque le
  // match qui a réglé la série, le rose celui qui est allé en prolongation.
  const decisif = i === s.feuilles.length - 1;
  const ton = decisif ? 'or' : f.ot ? 'ot' : '';
  const titre = f.ot ? `M${i + 1} · prolongation` : `Match ${i + 1}`;
  const ligne = (t, buts, gagne) => `<span class="mcard-row ${gagne ? 'win' : 'lose'}">
      <span class="mcard-eq">${esc(tagCourt(t))}</span><b>${buts}</b></span>`;
  return `<button class="mcard ${ton}${f.ot ? ' ot' : ''}" data-serie="${s.i}" data-match="${i}"
    title="Sommaire du match ${i + 1}">
    <span class="mcard-top">${esc(titre)}</span>
    <span class="mcard-body">
      <span class="mcard-logos">${getTeamLogoHtml(s.A.tag, 34)}${getTeamLogoHtml(s.B.tag, 34)}</span>
      <span class="mcard-rows">
        ${ligne(s.A, f.gfA, f.vainqueur === 'A')}
        ${ligne(s.B, f.gfB, f.vainqueur === 'B')}
      </span>
      <span class="mcard-foot">${tirsTotal(f, 'A')} — ${tirsTotal(f, 'B')} tirs</span>
    </span>
  </button>`;
}

/** Une série : les deux équipes, et chaque match cliquable vers son sommaire. */
function serieHtml(s) {
  const gagne = s.winner === s.A;
  const nomV = teamShort(gagne ? s.A : s.B), nomP = teamShort(gagne ? s.B : s.A);
  const rangee = (t, w, vain) => `<div class="series-row ${vain ? 'win' : 'lose'}">
    ${teamCell(t, 15)}<span>${w}</span></div>`;
  const matchs = s.feuilles.map((f, i) => matchCardHtml(s, f, i)).join('');
  return `<div class="series ${s.A.isPlayer || s.B.isPlayer ? 'you' : ''}">
    ${rangee(s.A, s.wA, gagne)}${rangee(s.B, s.wB, !gagne)}
    <div class="serie-recit">${esc(recitDeSerie(Math.max(s.wA, s.wB), Math.min(s.wA, s.wB), nomV, nomP, s.feuilles))}</div>
    <div class="serie-games">${matchs}</div>
  </div>`;
}

/** Le sommaire d'un match : buts période par période, tirs, gardiens, récit. */
function showGameModal(iSerie, iMatch) {
  const s = G.series[iSerie];
  if (!s) return;
  const f = s.feuilles[iMatch];
  const A = s.A, B = s.B;
  const tirsA = tirsTotal(f, 'A'), tirsB = tirsTotal(f, 'B');
  const nomA = teamLabel(A), nomB = teamLabel(B);

  const parPeriode = [1, 2, 3, 4].map(per => {
    const buts = f.buts.filter(b => periodeDe(b.instant) === per).map(b => ({ ...b, type: 'but' }));
    const punitions = (f.punitions || []).filter(x => periodeDe(x.instant) === per).map(x => ({ ...x, type: 'punition' }));
    if (!buts.length && per === 4) return '';
    const items = [...buts, ...punitions].sort((x, y) => x.instant - y.instant);
    const lignes = items.map(b => {
      const t = b.cote === 'A' ? A : B;
      if (b.type === 'punition') {
        return `<div class="som-but som-pun">
          <span class="som-tps">${tempsDeJeu(b.instant)}</span>
          <span class="som-eq">${getTeamLogoHtml(t.tag, 13)}</span>
          <span class="som-qui">Punition${b.joueur ? ` à <strong>${formatName(b.joueur.n)}</strong>` : ''} · ${b.minutes} min</span>
        </div>`;
      }
      const aides = b.passeurs.length
        ? `<span class="som-aides">${b.passeurs.map(p => formatName(p.n)).join(', ')}</span>`
        : '<span class="som-aides sans">sans aide</span>';
      const situation = b.an ? '<span class="som-sit an">AN</span>' : b.dn ? '<span class="som-sit dn">DN</span>' : '';
      return `<div class="som-but">
        <span class="som-tps">${tempsDeJeu(b.instant)}</span>
        <span class="som-eq">${getTeamLogoHtml(t.tag, 13)}</span>
        <span class="som-qui">${situation}<strong>${formatName(b.marqueur.n)}</strong> ${aides}</span>
        <span class="som-recit">${esc(recitDeBut(b))}</span>
      </div>`;
    }).join('') || '<div class="som-vide">Aucun but.</div>';
    return `<div class="som-per">
      <div class="som-per-head"><span>${esc(NOM_PERIODE[per])}</span>
        <span class="som-tirs">tirs ${f.tirs.A[per]} — ${f.tirs.B[per]}</span></div>
      ${lignes}</div>`;
  }).join('');

  const gard = (g, arrets, tirs) => g
    ? `<div class="som-gard"><span>${formatName(g.n)}</span><span>${arrets} arrêts sur ${tirs}</span></div>`
    : '';

  /* Le titre ne répète pas le pointage : les deux lignes juste dessous le
     donnent, avec les écusson et les tirs. Trois lignes de titre sur un
     téléphone repoussaient le sommaire sous le pli pour rien. */
  $('gameModalTitle').innerHTML = `Match ${iMatch + 1} · ${esc(teamShort(A))} — ${esc(teamShort(B))}`
    + (f.ot ? ' <span class="som-ot">prolongation</span>' : '');
  $('gameModalBody').innerHTML = `
    <div class="som-recap">${esc(recitDeMatch(f, teamShort(A), teamShort(B), tirsA, tirsB))}</div>
    <div class="som-lignes">
      <div class="som-ligne"><span>${teamCell(A, 15)}</span><span>${f.gfA}</span><span>${tirsA} tirs</span></div>
      <div class="som-ligne"><span>${teamCell(B, 15)}</span><span>${f.gfB}</span><span>${tirsB} tirs</span></div>
    </div>
    ${parPeriode}
    <div class="som-per">
      <div class="som-per-head"><span>Gardiens</span><span class="som-tirs">après ${iMatch + 1} match${iMatch ? 's' : ''} : ${f.serie}</span></div>
      ${gard(f.gardienA, f.arrets.A, tirsB)}
      ${gard(f.gardienB, f.arrets.B, tirsA)}
    </div>`;
  openModal('gameModal');
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
  if (MODE().renfort) await chargerRenfort();
  await nextSpin(true, true);
  saveGame();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.cap82 = { G, cacheClear, simulate };
boot();
