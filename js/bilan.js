/**
 * Le bilan de saison — les onglets, les palmarès, le calendrier, les séries
 * et leurs sommaires. C'est la moitié « après le match » de l'interface, à
 * part du contrôleur, comme `js/direct.js` (le direct) et `js/recit.js` (les
 * mots) le sont déjà.
 *
 * Ce module ne tient aucun état de partie : ce qu'il lui faut du contrôleur
 * (l'état `G`, les outils d'affichage, les liens vers les fiches, les deux
 * actions « Nouvelle partie » et « Rejouer ») lui est branché une fois, au
 * démarrage, par `brancherBilan` — le même patron de contexte que le direct.
 */

import { CAP, SLOTS, getPlayerKey, photoStats, playSeries, separerSeries, tirsTotal, periodeDe, compterFeuilles } from './sim.js';
import { recitDeBut, recitDeMatch, recitDeSaison, recitDeSerie, tempsDeJeu, NOM_PERIODE } from './recit.js';
import { getTeamBand, getTeamLogoHtml, teamSeasonUrl } from './logos.js';
import { ouvrirSeries } from './saison.js';

/* Ce que le contrôleur branche au démarrage (voir `brancherBilan`). */
let $, G, TEAMFULL, bar, capUsed, esc, formatName, headshotHtml, ico, lienEquipe, lienJoueur, money, newGame, openModal, picked, rejouerSaison, renderMain, saveLeaderboard, statsSim, toast;

export function brancherBilan(c) {
  ({ $, G, TEAMFULL, bar, capUsed, esc, formatName, headshotHtml, ico, lienEquipe, lienJoueur, money, newGame, openModal, picked, rejouerSaison, renderMain, saveLeaderboard, statsSim, toast } = c);
}

/* =====================================================================
   Résultat — noms d'équipe, statistiques de ligue, sommaires de match
   ===================================================================== */

/**
 * Le nom court pour un récit : « Bruins 1970-71 ». Le nom complet porte la
 * ville, ce qui donne « Bruins de Boston 1997-98 s'en tire contre Bruins de
 * Boston 1990-91 » — vrai, mais illisible.
 */
export function teamShort(t) {
  if (!t) return '—';
  if (t.isPlayer) return 'NHL Stars';
  const full = TEAMFULL[t.tag] || t.tag;
  const nom = full.split(/ (?:de |des |du |d')/)[0];
  return t.season ? `${nom} ${t.season}` : nom;
}

/** « Bruins de Boston 1970-71 » plutôt que « BOS 1970-71 ». */
export function teamLabel(t) {
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
export function teamCell(t, taille = 15) {
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
/**
 * TOUS LES JOUEURS, PAS DIX. Chaque palmarès range la ligue entière (ceux
 * qui ont joué) : après 1 312 matchs on veut pouvoir vérifier n'importe qui,
 * pas seulement le podium. Les gardiens des deux premiers palmarès exigent
 * un quart des matchs, comme la vraie ligue (25 départs sur 82).
 */
export function leagueStats(teams, mode = 'saison') {
  const patineurs = [], gardiens = [];
  for (const t of teams) {
    for (const s of SLOTS) {
      const p = t.roster[s.i];
      const S = p && statsSim(p, mode);
      if (!S || !S.GP) continue;
      (p.p === 'G' ? gardiens : patineurs).push({ p, t, S });
    }
  }
  const matchs = Math.max(1, ...teams.map(t => (mode === 'series' && t.po ? t.po.games : t.games) || 0));
  const seuilG = Math.max(1, Math.round(matchs * 25 / 82));
  const top = (list, cle) => list.slice().sort((a, b) => cle(b) - cle(a));
  return {
    points: top(patineurs, x => x.S.PTS * 1000 + x.S.G),
    buts: top(patineurs, x => x.S.G * 1000 + x.S.PTS),
    passes: top(patineurs, x => x.S.A * 1000 + x.S.PTS),
    plusmoins: top(patineurs, x => x.S.PM),
    avantage: top(patineurs, x => (x.S.PPG || 0) * 1000 + x.S.G),
    punitions: top(patineurs, x => (x.S.PIM || 0) * 1000 + x.S.PTS),
    arrets: top(gardiens.filter(x => x.S.GP >= seuilG), x => (x.S.SA ? x.S.SV / x.S.SA : 0)),
    moyenne: top(gardiens.filter(x => x.S.GP >= seuilG), x => -(x.S.GA / Math.max(1, x.S.GP))),
    victoires: top(gardiens, x => x.S.W * 1000 + x.S.SO),
  };
}

/*
 * Les neuf palmarès, chacun avec ses colonnes. `heros` est l'indice de la
 * COLONNE QUI DONNE SON NOM AU PALMARÈS — les points chez les pointeurs, les
 * buts chez les buteurs. Elle est écrite ici plutôt que devinée à la dernière
 * colonne parce qu'elle n'y est pas toujours, et c'est la seule que le
 * téléphone garde : à 390 px un tableau de sept colonnes défilait
 * horizontalement, si bien qu'un palmarès des pointeurs s'ouvrait sans
 * montrer les points.
 */
const PALMARES = [
  { cle: 'points', titre: 'Pointeurs', cols: ['PJ', 'B', 'A', 'PTS'], heros: 3,
    vals: S => [S.GP, S.G, S.A, `<b>${S.PTS}</b>`] },
  { cle: 'buts', titre: 'Buteurs', cols: ['PJ', 'B', 'L', '%'], heros: 1,
    vals: S => [S.GP, `<b>${S.G}</b>`, S.SH || 0, S.SH ? (100 * S.G / S.SH).toFixed(1) : '—'] },
  { cle: 'passes', titre: 'Passeurs', cols: ['PJ', 'A', 'PTS'], heros: 1,
    vals: S => [S.GP, `<b>${S.A}</b>`, S.PTS] },
  { cle: 'plusmoins', titre: 'Différentiel', cols: ['PJ', 'PTS', '+/-'], heros: 2,
    vals: S => [S.GP, S.PTS, `<b>${S.PM > 0 ? '+' : ''}${S.PM}</b>`] },
  { cle: 'avantage', titre: 'Avantage numérique', cols: ['PJ', 'B', 'BAN'], heros: 2,
    vals: S => [S.GP, S.G, `<b>${S.PPG || 0}</b>`] },
  { cle: 'punitions', titre: 'Punitions', cols: ['PJ', 'PTS', 'PUN'], heros: 2,
    vals: S => [S.GP, S.PTS, `<b>${S.PIM || 0}</b>`] },
  { cle: 'moyenne', titre: 'Gardiens · MBA', cols: ['PJ', 'V', 'BL', 'MBA'], heros: 3,
    vals: S => [S.GP, S.W, S.SO, `<b>${(S.GA / Math.max(1, S.GP)).toFixed(2)}</b>`] },
  { cle: 'arrets', titre: 'Gardiens · %ARR', cols: ['PJ', 'ARR', 'TIRS', '%ARR'], heros: 3,
    vals: S => [S.GP, S.SV || 0, S.SA || 0, `<b>${S.SA ? (S.SV / S.SA).toFixed(3).slice(1) : '—'}</b>`] },
  { cle: 'victoires', titre: 'Gardiens · victoires', cols: ['PJ', 'V', 'D', 'BL'], heros: 1,
    vals: S => [S.GP, `<b>${S.W}</b>`, S.L, S.SO] },
];

/*
 * Les tables se construisent À LA DEMANDE, onglet par onglet : neuf tables de
 * sept cents rangées d'un coup, c'est six mille lignes de DOM pour en lire
 * une. Le premier onglet est construit tout de suite, les autres au clic.
 */
function palmaresHtml(stats, mode = 'saison') {
  const id = `palm-${mode}`;
  const onglets = PALMARES.map((d, i) =>
    `<button class="stat-tab${i === 0 ? ' on' : ''}" data-stat="${d.cle}">${esc(d.titre)}</button>`).join('');
  const tables = PALMARES.map((d, i) =>
    `<div class="stat-table" data-stat="${d.cle}"${i === 0 ? '' : ' hidden'}>${i === 0 ? tablePalmares(d, stats, mode) : ''}</div>`).join('');
  return `<div class="palmares" data-mode="${mode}" id="${id}"><div class="stat-tabs" role="tablist">${onglets}</div>${tables}</div>`;
}
function tablePalmares(d, stats, mode) {
  const rows = stats[d.cle].map((x, n) => `
    <tr class="${x.t.isPlayer ? 'you' : ''}">
      <td>${n + 1}</td>
      <td class="left"><div class="team-cell">${getTeamLogoHtml(x.t.tag, 14)}${lienJoueur(x.p, x.t, mode, `<span>${esc(x.p.n)}</span>`)}</div></td>
      <td class="sub-cell">${lienEquipe(x.t, mode, esc(x.t.isPlayer ? 'NHL' : `${x.t.tag} ${(x.t.season || '').slice(2)}`))}</td>
      ${d.vals(x.S).map((v, c) => `<td class="stat${c === d.heros ? ' heros' : ''}">${v}</td>`).join('')}
    </tr>`).join('');
  return `<div class="table-wrap haute"><table class="data">
      <thead><tr><th>#</th><th class="left">Joueur</th><th>Éq.</th>${d.cols.map((c, i) => `<th class="stat${i === d.heros ? ' heros' : ''}">${c}</th>`).join('')}</tr></thead>
      <tbody>${rows || '<tr><td colspan="8">Aucun joueur admissible.</td></tr>'}</tbody>
    </table></div>`;
}
function brancherPalmares(host, stats, mode) {
  host.querySelectorAll('.stat-tab').forEach(b => {
    b.onclick = () => {
      host.querySelectorAll('.stat-tab').forEach(x => x.classList.toggle('on', x === b));
      host.querySelectorAll('.stat-table').forEach(t => {
        t.hidden = t.dataset.stat !== b.dataset.stat;
        if (!t.hidden && !t.innerHTML) t.innerHTML = tablePalmares(PALMARES.find(d => d.cle === t.dataset.stat), stats, mode);
      });
    };
  });
}

/**
 * LE CALENDRIER, CONSULTABLE. Une journée à la fois, ses seize matchs, et
 * un curseur pour aller à n'importe quel jour. C'est la preuve que la ligue
 * a vraiment joué : chaque pointage est là, chaque équipe est cliquable.
 */
function calendrierHtml(calendrier, jour) {
  const j = calendrier[jour];
  if (!j) return '';
  const carte = (m, k) => {
    const gagneA = m.gfA > m.gfB;
    const eq = (t, buts, gagne) => `<div class="cal-eq ${gagne ? 'win' : 'lose'}${t.isPlayer ? ' toi' : ''}">${getTeamLogoHtml(t.tag, 16)}${lienEquipe(t, 'saison', `<span>${esc(tagCourt(t))}</span>`)}<b>${buts}</b></div>`;
    // Chaque match de saison a sa feuille : la carte ouvre son sommaire.
    const somm = m.feuille ? ` data-sommaire="saison|${jour}|${k}" role="button" tabindex="0" title="Sommaire du match"` : '';
    return `<div class="cal-match${m.A.isPlayer || m.B.isPlayer ? ' toi' : ''}${m.feuille ? ' ouvrable' : ''}"${somm}>${eq(m.A, m.gfA, gagneA)}${eq(m.B, m.gfB, !gagneA)}${m.ot ? '<span class="cal-ot">P</span>' : ''}</div>`;
  };
  return `<div class="cal-grille">${j.map(carte).join('')}</div>`;
}

/*
 * LES ONGLETS DU BILAN. Le pointage, la bande de six chiffres et les trois
 * boutons restent en tête ; chaque onglet ouvre un seul volet. « Séries »
 * n'apparaît qu'une fois les séries jouées, et c'est là que le tableau et
 * leurs statistiques se dessinent.
 */
const ONGLETS_BILAN = [
  { cle: 'bilan', titre: 'Bilan' },
  { cle: 'classement', titre: 'Classement' },
  { cle: 'calendrier', titre: 'Calendrier' },
  { cle: 'stats', titre: 'Statistiques' },
  { cle: 'alignement', titre: 'Alignement' },
  { cle: 'series', titre: 'Séries' },
];
function montrerVolet(cle) {
  const tabs = $('resultTabs');
  if (!tabs) return;
  tabs.querySelectorAll('.result-tab').forEach(b => {
    const on = b.dataset.volet === cle;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    // Sur téléphone la barre défile en x : l'onglet ouvert reste visible.
    // On déplace la barre elle-même, jamais la page.
    if (on) {
      const g = b.offsetLeft - 12, d = b.offsetLeft + b.offsetWidth + 12 - tabs.clientWidth;
      if (tabs.scrollLeft > g) tabs.scrollTo({ left: g, behavior: 'smooth' });
      else if (tabs.scrollLeft < d) tabs.scrollTo({ left: d, behavior: 'smooth' });
    }
  });
  document.querySelectorAll('#resultHost .result-pane').forEach(p => { p.hidden = p.dataset.volet !== cle; });
  // L'onglet reste en vue : si la page a défilé sous la barre, on y remonte.
  const haut = tabs.getBoundingClientRect().top;
  const barre = parseFloat(getComputedStyle(tabs).top) || 0;
  if (haut < barre - 1) tabs.scrollIntoView({ block: 'start' });
}
function brancherOnglets(tabs) {
  tabs.querySelectorAll('.result-tab').forEach(b => { b.onclick = () => montrerVolet(b.dataset.volet); });
}

export function renderResult(r, you, teams, leaders, calendrier = []) {
  const nTeams = teams.length;
  const rank = teams.findIndex(t => t.isPlayer) + 1;
  const enSeries = nTeams > 1 ? nombreEnSeries(nTeams) : 0;
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
      <div class="rn">${getTeamLogoHtml(p.t, 15)} ${lienJoueur(p, you, 'saison', `<span>${formatName(p.n)} <span class="sub">${esc(s.role)}</span></span>`)}</div>
      <div class="rs">${stats}${p.p === 'G' ? '' : ` · <span class="sub">${p.simSH || 0} lancers</span>`}</div>
    </div>`;
  }).join('');

  // Chaque rangée du classement ouvre l'équipe : son alignement, ses 82
  // matchs. Le lien vers Hockey-Reference reste dans la cellule.
  const standings = teams.map((t, i) => `
    <tr class="${t.isPlayer ? 'you' : ''}${i === enSeries - 1 ? ' cut' : ''}">
      <td>${i + 1}</td>
      <td class="left"><div class="team-cell">${getTeamLogoHtml(t.tag, 15)}${lienEquipe(t, 'saison', `<span>${esc(teamLabel(t))}</span>`)}${t.isPlayer || !teamSeasonUrl(t.tag, t.season) ? '' : `<a class="team-ext" href="${teamSeasonUrl(t.tag, t.season)}" target="_blank" rel="noopener" title="La saison ${esc(t.season)} de cette équipe sur Hockey-Reference">${ico('i-ext')}</a>`}</div></td>
      <td>${t.W + t.L + t.OTL}</td><td>${t.W}</td><td>${t.L}</td><td>${t.OTL}</td>
      <td class="pts">${t.PTS}</td><td>${t.GF}</td><td>${t.GA}</td>
      <td>${t.GF - t.GA > 0 ? '+' : ''}${t.GF - t.GA}</td>
    </tr>`).join('');

  const stats = teams.length > 1 ? leagueStats(teams) : null;
  const recit = teams.length > 1 ? recitDeSaison(you, rank, nTeams, { nomEquipe: teamShort }) : [];

  const injuries = you.injuriesLog && you.injuriesLog.length
    ? `<ul class="inj-list">${you.injuriesLog.map(i => `<li><strong>${esc(i.player.n)}</strong> — ${i.games} match${i.games > 1 ? 's' : ''} ratés à partir du match ${i.at}</li>`).join('')}</ul>`
    : `<div class="dash-note">Aucune blessure cette saison. Chanceux.</div>`;

  saveLeaderboard({
    W: r.W, L: r.L, OTL: r.OTL, points: r.points, GF: r.GF, GA: r.GA,
    capUsed: capUsed(), rank, nTeams, date: new Date().toLocaleDateString('fr-CA'),
    // De quoi rouvrir et rejouer cette équipe : la clé de chaque joueur-
    // saison (légère), le mode, et la graine de la saison jouée.
    mode: G.mode,
    epoque: G.ligue && G.ligue.epoque || null,
    graine: G.ligue && G.ligue.graine || null,
    alignement: SLOTS.map(s => {
      const p = G.roster[s.i];
      return p ? { i: s.i, s: p.s, k: getPlayerKey(p), n: p.n, r: p._renfort ? 1 : 0 } : null;
    }),
  });

  // LE BILAN EST UN TABLEAU DE BORD À ONGLETS, PAS UNE LONGUE PAGE. JP :
  // *better season tabs for information instead of long page, like a manager
  // game*. Le pointage et les trois boutons restent en tête ; tout le reste
  // vit dans un volet à la fois. Les volets sont tous dans le DOM (les
  // palmarès restent construits onglet par onglet), seul l'affichage change.
  const volets = {
    bilan: `<div class="note">${note}</div>
      ${recit.length ? `<div class="result-section recit-saison">
        <h3>Le récit de la saison</h3>
        ${recit.map(p => `<p>${esc(p)}</p>`).join('')}
      </div>` : ''}
      <div class="result-section">
        <h3>Forces des NHL Stars</h3>
        <div class="bars">
          ${bar('Attaque', r.attaque)}
          ${bar('Brigade déf.', r.brigade)}
          ${bar('Gardien', r.gRating)}
          ${bar('Robustesse', r.rob)}
          ${bar('Clutch', r.clu)}
        </div>
      </div>
      <div class="result-section">
        <h3>Infirmerie</h3>
        ${injuries}
      </div>`,
    classement: `<div class="result-section">
        <h3>Classement général · ${nTeams} équipes, ${(nTeams * 82 / 2).toLocaleString('fr-CA')} matchs</h3>
        <p class="series-legende">Touche une équipe pour son alignement et ses 82 matchs.</p>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Rang</th><th class="left">Équipe</th><th>PJ</th><th>V</th><th>D</th><th>DP</th><th>PTS</th><th>BP</th><th>BC</th><th>Diff</th></tr></thead>
          <tbody>${standings}</tbody>
        </table></div>
      </div>`,
    calendrier: calendrier.length ? `<div class="result-section" id="calendrierSection">
        <h3>Calendrier · ${calendrier.length} journées</h3>
        <div class="cal-barre">
          <button class="btn small" id="calPrev" title="Journée précédente">‹</button>
          <input type="range" id="calJour" min="1" max="${calendrier.length}" value="${calendrier.length}" aria-label="Journée">
          <span class="cal-titre" id="calTitre">Journée ${calendrier.length}</span>
          <button class="btn small" id="calNext" title="Journée suivante">›</button>
        </div>
        <div id="calHost">${calendrierHtml(calendrier, calendrier.length - 1)}</div>
      </div>` : '',
    stats: stats ? `<div class="result-section">
        <h3>Statistiques de la ligue · tous les joueurs</h3>
        ${palmaresHtml(stats, 'saison')}
      </div>` : '',
    alignement: `<div class="result-section">
        <h3>Feuille de match des NHL Stars</h3>
        <p class="series-legende">Touche un nom pour sa fiche et ses statistiques simulées.</p>
        ${rows}
      </div>`,
    series: `<div id="playoffsSection"></div>`,
  };

  $('resultHost').style.display = '';
  $('resultHost').innerHTML = `
    <div class="result">
      <div class="result-hero">
        <div class="hero-band ${rank === 1 ? 'or' : rank <= enSeries ? '' : 'out'}">
          ${rank === 1 ? '1er de la ligue' : rank <= enSeries ? `${rank}e de ${nTeams} · en séries` : `${rank}e de ${nTeams} · éliminé`}
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

      <div class="result-actions">
        ${rank <= enSeries ? `<button class="btn gold" id="playoffsBtn">${ico('i-cup')}Jouer les séries</button>` : ''}
        <button class="btn blue" id="shareBtn">${ico('i-copy')}Copier le résultat</button>
        <button class="btn" id="replayBtn" title="Le même alignement, les mêmes 31 clubs, d'autres dés">${ico('i-dice')}Rejouer la saison</button>
        <button class="btn go" id="againBtn">Nouvelle partie</button>
      </div>

      <div class="result-tabs" role="tablist" id="resultTabs">
        ${ONGLETS_BILAN.map(o => `<button class="result-tab${o.cle === 'bilan' ? ' on' : ''}" role="tab" data-volet="${o.cle}" aria-selected="${o.cle === 'bilan'}"${volets[o.cle] && o.cle !== 'series' ? '' : ' hidden'}>${esc(o.titre)}</button>`).join('')}
      </div>
      ${ONGLETS_BILAN.map(o => `<div class="result-pane" data-volet="${o.cle}"${o.cle === 'bilan' ? '' : ' hidden'}>${volets[o.cle]}</div>`).join('')}
    </div>`;

  brancherOnglets($('resultTabs'));
  if (stats) brancherPalmares($('palm-saison'), stats, 'saison');

  if (calendrier.length) {
    const range = $('calJour');
    const montrerJour = j => {
      j = Math.max(1, Math.min(calendrier.length, j));
      range.value = j;
      $('calTitre').textContent = `Journée ${j}`;
      $('calHost').innerHTML = calendrierHtml(calendrier, j - 1);
    };
    range.oninput = () => montrerJour(Number(range.value));
    $('calPrev').onclick = () => montrerJour(Number(range.value) - 1);
    $('calNext').onclick = () => montrerJour(Number(range.value) + 1);
  }

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

  if (rank <= enSeries) $('playoffsBtn').onclick = () => runPlayoffs(teams.slice(0, enSeries));
  $('againBtn').onclick = () => newGame();
  $('replayBtn').onclick = () => rejouerSaison();

  renderMain();
  $('resultHost').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* =====================================================================
   Séries — match par match, avec sommaire
   ===================================================================== */

/* Les noms des rondes, selon combien il y en a : seize équipes en font quatre,
   huit en font trois (les ligues d'avant 1980 n'ont pas seize clubs). */
const RONDES_PAR_N = {
  4: ['Premier tour', 'Deuxième tour', 'Demi-finales', 'Finale de la Coupe Stanley'],
  3: ['Quarts de finale', 'Demi-finales', 'Finale de la Coupe Stanley'],
  2: ['Demi-finales', 'Finale de la Coupe Stanley'],
  1: ['Finale de la Coupe Stanley'],
};
let RONDES = RONDES_PAR_N[4];
/** Combien d'équipes vont en séries : seize, ou la plus grande puissance de deux qui tient dans la ligue. */
export function nombreEnSeries(nTeams) {
  return Math.min(16, 2 ** Math.floor(Math.log2(Math.max(2, nTeams))));
}

/**
 * Les séries, jouées match par match. Chaque match garde sa feuille — buts
 * avec leur instant, tirs par période, arrêts — et le sommaire s'ouvre d'un
 * clic. C'est la même simulation qu'avant : on ne jetait simplement pas ce
 * que le moteur produisait déjà.
 */
export function runPlayoffs(top16) {
  const host = $('playoffsSection');
  if (!host) return;
  RONDES = RONDES_PAR_N[Math.round(Math.log2(top16.length))] || RONDES_PAR_N[4];

  // LES SÉRIES ONT LEURS STATISTIQUES À PART : photo des fiches de saison,
  // les séries s'inscrivent par-dessus, puis on sépare (js/sim.js).
  const photo = photoStats(G.ligue ? G.ligue.teams : top16);
  G.series = [];
  let ronde = top16.slice(), n = 0;
  while (ronde.length > 1) {
    const suivant = [];
    for (let i = 0; i < ronde.length / 2; i++) {
      const A = ronde[i], B = ronde[ronde.length - 1 - i];
      const s = playSeries(A, B, true, n);   // la ronde : l'usure s'accumule
      suivant.push(s.winner);
      G.series.push({ ...s, A, B, ronde: n, i: G.series.length });
    }
    ronde = suivant;
    n++;
  }
  separerSeries(G.ligue ? G.ligue.teams : top16, photo);
  const champion = ronde[0];
  const btn = $('playoffsBtn');
  if (btn) btn.disabled = true;

  // L'ÉCRAN DES SÉRIES D'ABORD. Tout est déjà joué ; on ne dessine le
  // tableau complet qu'une fois que le joueur a révélé ses séries match par
  // match — ou qu'il a passé à la fin. Le mystère tient à ce seul ordre.
  ouvrirSeries({
    series: G.series, rondes: RONDES, you: top16.find(t => t.isPlayer) || null,
    ctx: { esc, formatName, teamLabel, teamShort, tagCourt, logo: getTeamLogoHtml, band: getTeamBand, mug: headshotHtml },
    onTermine: () => dessinerTableauDesSeries(host, n, champion),
  });
}

/** Le tableau complet des séries, toutes rondes, tous les matchs cliquables. */
/*
 * L'ARBRE DES SÉRIES. Un vrai tableau : les seize équipes aux deux bords,
 * les rondes qui convergent vers la finale au centre, le champion au-dessus.
 * Chaque nœud est une petite carte de pointage (deux rangées, le gagnant en
 * clair, ses victoires en or) et mène au détail de sa série, dessous. La
 * structure ne suppose rien de l'ordre des séries : on part de la finale et
 * on remonte, pour chaque équipe, la série qu'elle a gagnée à la ronde
 * d'avant. Sur téléphone l'arbre se balaie en largeur, comme un tableau.
 */
function arbreHtml(n, champion) {
  const finale = G.series.find(s => s.ronde === n - 1);
  if (!finale) return '';
  const nourrit = (s, t) => G.series.find(x => x.ronde === s.ronde - 1 && x.winner === t) || null;
  // Les colonnes d'un côté : [ronde n-2, ..., ronde 0], chacune dans l'ordre
  // vertical qui met les deux séries mères sous leur fille.
  const cote = (s, t) => {
    const colonnes = Array.from({ length: n - 1 }, () => []);
    const descendre = (x) => {
      if (!x) return;
      colonnes[n - 2 - x.ronde].push(x);
      descendre(nourrit(x, x.A));
      descendre(nourrit(x, x.B));
    };
    descendre(nourrit(s, t));
    return colonnes;
  };
  const gauche = cote(finale, finale.A), droite = cote(finale, finale.B);
  const noeud = (s, pos) => {
    const rangee = (t, w, vain) => `<span class="bk-row ${vain ? 'win' : 'lose'}">${getTeamLogoHtml(t.tag, 16)}<span class="bk-nom">${esc(tagCourt(t))}</span><b>${w}</b></span>`;
    const gagne = s.winner === s.A;
    return `<a class="bk-serie ${pos}${s.A.isPlayer || s.B.isPlayer ? ' you' : ''}" href="#serie-${s.i}" title="${esc(teamShort(s.A))} — ${esc(teamShort(s.B))} : le détail de la série">
      ${rangee(s.A, s.wA, gagne)}${rangee(s.B, s.wB, !gagne)}</a>`;
  };
  const colonne = (liste, pos, r) => `<div class="bk-col ${pos}" data-ronde="${r}"><div class="bk-ronde">${esc(RONDES[r] ? RONDES[r].replace('Finale de la Coupe Stanley', 'Finale') : `Ronde ${r + 1}`)}</div><div class="bk-noeuds">${liste.map(s => noeud(s, pos)).join('')}</div></div>`;
  const colsG = gauche.slice().reverse().map((l, k) => colonne(l, 'g', k)).join('');
  const colsD = droite.map((l, k) => colonne(l, 'd', n - 2 - k)).join('');
  return `<div class="bracket-scroll"><div class="bracket" style="--rondes:${n}">
    ${colsG}
    <div class="bk-col finale"><div class="bk-ronde">Finale</div><div class="bk-noeuds">
      <div class="bk-champion">${getTeamLogoHtml(champion.tag, 34)}<span class="bk-champ-mot">Champion</span><b>${esc(teamShort(champion))}</b></div>
      ${noeud(finale, 'f')}</div></div>
    ${colsD}
  </div></div>`;
}

function dessinerTableauDesSeries(host, n, champion) {
  let html = `<div class="result-section"><h3>${ico('i-cup')}Séries éliminatoires</h3>
    <p class="series-legende">Touche une série de l'arbre pour son détail, un match pour son sommaire.
      <span class="lg lg-or">or</span> le match qui a réglé la série ·
      <span class="lg lg-ot">rose</span> réglé en prolongation</p>
    ${arbreHtml(n, champion)}
    <div class="champion">
      <h3>Champion de la Coupe Stanley</h3>
      <div class="champ-name">${getTeamLogoHtml(champion.tag, 30)} ${esc(teamLabel(champion))}</div>
      <p>${champion.isPlayer ? `Les NHL Stars soulèvent la Coupe${G.ligue && G.ligue.epoque ? ` de ${esc(G.ligue.epoque)}` : ''}. 🏆` : `Les NHL Stars sont tombés en chemin${G.ligue && G.ligue.epoque ? ` en ${esc(G.ligue.epoque)}` : ''}. Rebâtis et réessaie.`}</p>
    </div>`;
  for (let r = 0; r < n; r++) {
    const dedans = G.series.filter(s => s.ronde === r);
    html += `<div class="series-round"><h4>${esc(RONDES[r] || `Ronde ${r + 1}`)}</h4><div class="series-grid">`;
    for (const s of dedans) html += serieHtml(s);
    html += '</div></div>';
  }
  html += '</div>';

  // Les statistiques des séries, à part de celles de la saison : les seize
  // équipes, tous ceux qui ont joué un match. Le titre dit lesquelles.
  const equipes = [...new Set(G.series.flatMap(s => [s.A, s.B]))];
  const statsSeries = leagueStats(equipes, 'series');
  html += `<div class="result-section">
    <h3>Statistiques des séries · à part de la saison</h3>
    <p class="series-legende">Touche une équipe pour son alignement en séries, un nom pour sa fiche.</p>
    <div class="cal-grille equipes-series">${equipes.map(t => `<div class="cal-match"><div class="cal-eq${t.isPlayer ? ' toi' : ''}">${getTeamLogoHtml(t.tag, 16)}${lienEquipe(t, 'series', `<span>${esc(teamLabel(t))}</span>`)}<b>${t.po ? `${t.po.W}-${t.po.L + t.po.OTL}` : ''}</b></div></div>`).join('')}</div>
    ${palmaresHtml(statsSeries, 'series')}
  </div>`;

  host.innerHTML = html;
  host.querySelectorAll('.mcard').forEach(b => {
    b.onclick = () => showGameModal(Number(b.dataset.serie), Number(b.dataset.match));
  });
  brancherPalmares($('palm-series'), statsSeries, 'series');
  // L'onglet « Séries » n'existait pas encore : il apparaît et s'ouvre.
  const onglet = document.querySelector('#resultTabs .result-tab[data-volet="series"]');
  if (onglet) { onglet.hidden = false; montrerVolet('series'); }
  else host.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Le tag et l'année courte : « MTL '76 », ce qui tient dans une carte. */
export const tagCourt = t => t.isPlayer ? 'NHL' : `${t.tag}${t.season ? ` '${t.season.slice(2, 4)}` : ''}`;

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
  return `<div class="series ${s.A.isPlayer || s.B.isPlayer ? 'you' : ''}" id="serie-${s.i}">
    ${rangee(s.A, s.wA, gagne)}${rangee(s.B, s.wB, !gagne)}
    <div class="serie-recit">${esc(recitDeSerie(Math.max(s.wA, s.wB), Math.min(s.wA, s.wB), nomV, nomP, s.feuilles))}</div>
    <div class="serie-games">${matchs}</div>
  </div>`;
}

/** Le sommaire d'un match de séries : le compte d'avant vient des rondes d'avant et des matchs d'avant. */
function showGameModal(iSerie, iMatch) {
  const s = G.series[iSerie];
  if (!s) return;
  const avant = compterFeuilles(G.series.filter(x => x.ronde < s.ronde).flatMap(x => x.feuilles));
  compterFeuilles(s.feuilles.slice(0, iMatch), avant);
  sommaireDeMatch({
    f: s.feuilles[iMatch], A: s.A, B: s.B, mode: 'series', avant,
    titre: `Match ${iMatch + 1}`, pied: `après ${iMatch + 1} match${iMatch ? 's' : ''} : ${s.feuilles[iMatch].serie}`,
  });
}

/** Le sommaire d'un match de saison, depuis le calendrier : le compte d'avant, ce sont les journées d'avant. */
function sommaireDeSaison(jour, k) {
  const cal = G.ligue && G.ligue.calendrier;
  const m = cal && cal[jour] && cal[jour][k];
  if (!m || !m.feuille) return;
  const avant = compterFeuilles(cal.slice(0, jour).flat().map(x => x.feuille));
  sommaireDeMatch({ f: m.feuille, A: m.A, B: m.B, mode: 'saison', avant, titre: `Journée ${jour + 1}`, pied: 'saison régulière' });
}

// Tout ce qui porte `data-sommaire` ouvre un sommaire : « saison|jour|k »
// ou « series|iSerie|iMatch ». Un seul écouteur, comme pour les fiches.
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-sommaire]');
  if (!el || ev.target.closest('.lien-joueur, .lien-equipe')) return;
  const [quoi, a, b] = el.dataset.sommaire.split('|');
  if (quoi === 'saison') sommaireDeSaison(Number(a), Number(b));
  else if (quoi === 'series') showGameModal(Number(a), Number(b));
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const el = ev.target.closest && ev.target.closest('[data-sommaire]');
  if (!el) return;
  ev.preventDefault();
  el.click();
});

/* « 1er », « 12e » : le rang d'un but ou d'une passe. */
const ord = n => (n === 1 ? '1er' : `${n}e`);
const ordF = n => (n === 1 ? '1re' : `${n}e`);

/** La clé `data-sommaire` d'une feuille, qu'elle vienne du calendrier ou des séries ; null sinon. */
export function cleDeSommaire(feuille) {
  if (!feuille) return null;
  const cal = G.ligue && G.ligue.calendrier;
  if (cal) for (let j = 0; j < cal.length; j++) {
    const k = cal[j].findIndex(m => m.feuille === feuille);
    if (k >= 0) return `saison|${j}|${k}`;
  }
  for (const s of G.series || []) {
    const k = s.feuilles.indexOf(feuille);
    if (k >= 0) return `series|${s.i}|${k}`;
  }
  return null;
}

/**
 * Le sommaire d'un match : buts période par période, tirs, gardiens, récit.
 * `avant` est le compte des feuilles d'avant ce match (compterFeuilles), pour
 * dire « (12e) » après le marqueur et chaque passeur — le rang du but ou de
 * la passe dans la saison ou dans les séries, comme au tableau indicateur.
 */
function sommaireDeMatch({ f, A, B, mode = 'series', avant = new Map(), titre = '', pied = '' }) {
  const tirsA = tirsTotal(f, 'A'), tirsB = tirsTotal(f, 'B');
  const compte = new Map();
  const rang = (p, cle) => { const c = avant.get(p); const k = `${cle}|${getPlayerKey(p)}`; compte.set(k, (compte.get(k) || 0) + 1); return (c ? c[cle] : 0) + compte.get(k); };
  // Les buts se comptent dans l'ordre du temps, quelle que soit la période affichée.
  const rangs = new Map();
  for (const b of f.buts.slice().sort((x, y) => x.instant - y.instant)) {
    rangs.set(b, { g: b.marqueur ? rang(b.marqueur, 'g') : 0, a: (b.passeurs || []).map(p => rang(p, 'a')) });
  }

  const parPeriode = [1, 2, 3, 4].map(per => {
    const buts = f.buts.filter(b => periodeDe(b.instant) === per).map(b => ({ ...b, type: 'but', rang: rangs.get(b) }));
    const punitions = (f.punitions || []).filter(x => periodeDe(x.instant) === per).map(x => ({ ...x, type: 'punition' }));
    if (!buts.length && per === 4) return '';
    const items = [...buts, ...punitions].sort((x, y) => x.instant - y.instant);
    const lignes = items.map(b => {
      const t = b.cote === 'A' ? A : B;
      // Chaque nom ouvre la fiche avec ses statistiques des SÉRIES.
      const lien = p => lienJoueur(p, t, mode, `<strong>${formatName(p.n)}</strong>`);
      const r = b.rang || { g: 0, a: [] };
      if (b.type === 'punition') {
        return `<div class="som-but som-pun">
          <span class="som-tps">${tempsDeJeu(b.instant)}</span>
          <span class="som-eq">${getTeamLogoHtml(t.tag, 13)}</span>
          <span class="som-qui">Punition${b.joueur ? ` à ${lien(b.joueur)}` : ''} · ${b.minutes} min${b.butAN ? ' · écourtée par le but' : ''}</span>
        </div>`;
      }
      const aides = b.passeurs.length
        ? `<span class="som-aides">${b.passeurs.map((p, k) => `${lienJoueur(p, t, mode, esc(p.n))} <span class="som-xe">(${ordF(r.a[k] || 0)})</span>`).join(', ')}</span>`
        : '<span class="som-aides sans">sans aide</span>';
      const situation = b.an ? '<span class="som-sit an">AN</span>' : b.dn ? '<span class="som-sit dn">DN</span>' : '';
      return `<div class="som-but">
        <span class="som-tps">${tempsDeJeu(b.instant)}</span>
        <span class="som-eq">${getTeamLogoHtml(t.tag, 13)}</span>
        <span class="som-qui">${situation}${lien(b.marqueur)} <span class="som-xe">(${ord(r.g)})</span> ${aides}</span>
        <span class="som-recit">${esc(recitDeBut(b))}</span>
      </div>`;
    }).join('') || '<div class="som-vide">Aucun but.</div>';
    return `<div class="som-per">
      <div class="som-per-head"><span>${esc(NOM_PERIODE[per])}</span>
        <span class="som-tirs">tirs ${f.tirs.A[per]} — ${f.tirs.B[per]}</span></div>
      ${lignes}</div>`;
  }).join('');

  const gard = (g, arrets, tirs, t) => g
    ? `<div class="som-gard"><span>${lienJoueur(g, t, mode)}</span><span>${arrets} arrêts sur ${tirs}</span></div>`
    : '';

  /* Le titre ne répète pas le pointage : les deux lignes juste dessous le
     donnent, avec les écusson et les tirs. Trois lignes de titre sur un
     téléphone repoussaient le sommaire sous le pli pour rien. */
  $('gameModalTitle').innerHTML = `${esc(titre)} · ${esc(teamShort(A))} — ${esc(teamShort(B))}`
    + (f.ot ? ' <span class="som-ot">prolongation</span>' : '');
  $('gameModalBody').innerHTML = `
    <div class="som-recap">${esc(recitDeMatch(f, teamShort(A), teamShort(B), tirsA, tirsB))}</div>
    <div class="som-lignes">
      <div class="som-ligne"><span>${teamCell(A, 15)}</span><span>${f.gfA}</span><span>${tirsA} tirs</span></div>
      <div class="som-ligne"><span>${teamCell(B, 15)}</span><span>${f.gfB}</span><span>${tirsB} tirs</span></div>
    </div>
    ${parPeriode}
    <div class="som-per">
      <div class="som-per-head"><span>Gardiens</span><span class="som-tirs">${esc(pied)}</span></div>
      ${gard(f.gardienA, f.arrets.A, tirsB, A)}
      ${gard(f.gardienB, f.arrets.B, tirsA, B)}
    </div>`;
  openModal('gameModal');
}
