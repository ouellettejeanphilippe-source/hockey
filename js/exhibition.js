/**
 * L'EXHIBITION (S78). JP : *ajouter mode exhibition pour simulation, que tu
 * peux choisir n'importe quelles équipes de toutes ères et les faire jouer
 * contre pour le fun*.
 *
 * Deux vrais clubs-saisons, n'importe lesquels des 55 saisons, alignés comme
 * le moteur aligne les adversaires de la ligue (`autoRoster`), et joués par
 * le VRAI moteur (`jouerExhibition`, js/sim.js) : un match, une série 4 de 7,
 * ou cent matchs pour lire les chances. Un match se regarde aussi en direct
 * (`diffuserMatch`, js/direct.js), comme ceux de la saison.
 *
 * RIEN NE TOUCHE À LA PARTIE. Les joueurs sont des copies (`copieDeJoueur`),
 * le hasard a sa propre graine et le moteur rend intact le fil de la saison
 * en cours. Seule l'affiche se retient (localStorage), pour la rejouer.
 *
 * Le module ne sait rien du jeu : `ctx` (js/game.js) lui passe les saisons,
 * le chargeur de shards et les fonctions d'affichage.
 */
import { autoRoster, jouerExhibition, copieDeJoueur, nouvelleGraine, periodeDe, tirsTotal } from './sim.js';
import { diffuserMatch } from './direct.js';
import { nomCourt, NOM_PERIODE } from './recit.js';
import { estD, pct3 as pct, varsEquipe } from './util.js';

const CLE = 'cap82_exhibition';
/* Les visiteurs à gauche, les locaux à droite, comme sur un tableau. Les locaux sont A : ils reçoivent. */
const COTES = { vis: { titre: 'Les visiteurs' }, loc: { titre: 'Les locaux' } };
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { return null; } };
const ecrire = v => { try { localStorage.setItem(CLE, JSON.stringify(v)); } catch { /* stockage fermé : rien à retenir */ } };
const auHasard = liste => liste[Math.floor(Math.random() * liste.length)];

let ctx = null, el = null;
let choix = { vis: null, loc: null };   // { saison, club }
let ouvert = null;                        // le côté dont le sélecteur est ouvert
let saisonVue = { vis: null, loc: null }; // la saison affichée dans le sélecteur de chaque côté
let resultat = null;
let occupe = false;
const CLUBS = new Map();                  // saison -> [codes], les clubs assez garnis pour s'aligner

/* Un club s'aligne s'il a de quoi remplir l'alignement : douze avants, six défenseurs, deux gardiens (comme la ligue). */
async function clubsDe(saison) {
  if (CLUBS.has(saison)) return CLUBS.get(saison);
  const e = await ctx.shard(saison);
  const codes = Object.entries(e.byTeam)
    .filter(([, pool]) => pool.filter(p => p.p === 'F').length >= 12 && pool.filter(estD).length >= 6 && pool.filter(p => p.p === 'G').length >= 2)
    .map(([t]) => t)
    .sort((a, b) => ctx.nom(a).localeCompare(ctx.nom(b), 'fr'));
  CLUBS.set(saison, codes);
  return codes;
}

/* LE HASARD D'UN CÔTÉ : une saison, puis un de ses clubs — jamais la même affiche des deux côtés. */
async function tirer(cote) {
  const autre = choix[cote === 'vis' ? 'loc' : 'vis'];
  for (let k = 0; k < 8; k++) {
    const saison = auHasard(ctx.saisons);
    const codes = await clubsDe(saison);
    const club = auHasard(codes);
    if (club && !(autre && autre.saison === saison && autre.club === club)) { choix[cote] = { saison, club }; saisonVue[cote] = saison; return; }
  }
}

/* Ce que le club a vraiment fait cette saison-là : son meilleur pointeur et son gardien numéro un. */
async function faits({ saison, club }) {
  const e = await ctx.shard(saison);
  const pool = e.byTeam[club] || [];
  const pts = p => p.pt ?? ((p.g || 0) + (p.a || 0));
  const meneur = pool.filter(p => p.p !== 'G').sort((a, b) => pts(b) - pts(a))[0];
  const gardien = pool.filter(p => p.p === 'G').sort((a, b) => (b.gp || 0) - (a.gp || 0))[0];
  return [
    meneur ? `${nomCourt(meneur.n)} ${pts(meneur)} pts` : null,
    gardien && gardien.sv ? `${nomCourt(gardien.n)} ${pct(gardien.sv)}` : null,
  ].filter(Boolean).join(' · ');
}

/* L'alignement du club, bâti comme la ligue bâtit ses adversaires, sur des COPIES de ses joueurs. */
async function club(cote) {
  const { saison, club: code } = choix[cote];
  const e = await ctx.shard(saison);
  return { nom: `${code} ${saison}`, tag: code, saison, roster: autoRoster((e.byTeam[code] || []).map(copieDeJoueur)) };
}

function fermerExhibition() {
  if (el) el.remove();
  el = null;
  document.body.classList.remove('exh-ouverte');
}

export async function ouvrirExhibition(c) {
  ctx = c;
  const memo = lire();
  const valide = x => x && ctx.saisons.includes(x.saison) && typeof x.club === 'string';
  choix = { vis: valide(memo && memo.vis) ? memo.vis : null, loc: valide(memo && memo.loc) ? memo.loc : null };
  resultat = null; ouvert = null;
  if (!el) {
    el = document.createElement('div');
    el.id = 'exhibitionModal';
    el.className = 'exh';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Exhibition');
    document.body.appendChild(el);
  }
  document.body.classList.add('exh-ouverte');
  // Une première visite part d'une affiche tirée au hasard : on joue tout de suite.
  if (!choix.vis) await tirer('vis');
  if (!choix.loc) await tirer('loc');
  for (const k of ['vis', 'loc']) saisonVue[k] = choix[k] ? choix[k].saison : ctx.saisons[ctx.saisons.length - 1];
  await dessiner();
}

function fermer() {
  fermerExhibition();
  if (ctx && ctx.onFerme) ctx.onFerme();
}

/* ------------------------------------------------------------------ */
/* L'écran                                                              */
/* ------------------------------------------------------------------ */
async function bandeau(cote) {
  const c = choix[cote];
  const esc = ctx.esc;
  if (!c) return `<div class="exh-bandeau vide">Choisis un club</div>`;
  const b = ctx.band(c.club);
  const f = await faits(c);
  return `<button type="button" class="exh-bandeau" data-exh="ouvrir" data-cote="${cote}" aria-expanded="${ouvert === cote}"
      style="--eq-bg:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
    <span class="exh-logo">${ctx.logo(c.club, 44)}</span>
    <span class="exh-qui"><b>${esc(ctx.nom(c.club))}</b><small>${esc(c.saison)}${f ? ` · ${esc(f)}` : ''}</small></span>
    <span class="exh-changer" aria-hidden="true">${ouvert === cote ? '▲' : 'Changer'}</span>
  </button>`;
}

async function selecteur(cote) {
  const esc = ctx.esc;
  const s = saisonVue[cote];
  const codes = await clubsDe(s);
  const c = choix[cote];
  return `<div class="exh-choix">
    <div class="exh-choix-tete">
      <select class="opt-select exh-saison" data-cote="${cote}" aria-label="La saison">
        ${ctx.saisons.slice().reverse().map(x => `<option value="${x}"${x === s ? ' selected' : ''}>${x}</option>`).join('')}
      </select>
      <button type="button" class="btn small exh-des" data-exh="hasard" data-cote="${cote}">🎲 Au hasard</button>
    </div>
    <div class="exh-grille">
      ${codes.map(t => `<button type="button" class="exh-club${c && c.saison === s && c.club === t ? ' on' : ''}" data-exh="club" data-cote="${cote}" data-club="${t}" title="${esc(ctx.nom(t))}">
        ${ctx.logo(t, 30)}<span>${esc(ctx.nom(t).split(/ (?:de |des |du |d')/)[0])}</span></button>`).join('')}
    </div>
  </div>`;
}

async function dessiner() {
  if (!el) return;
  const esc = ctx.esc;
  const cote = async k => `<section class="exh-cote" data-cote="${k}">
      <div class="exh-cote-t">${COTES[k].titre}</div>
      ${await bandeau(k)}
      ${ouvert === k ? await selecteur(k) : ''}
    </section>`;
  const pret = choix.vis && choix.loc;
  el.innerHTML = `<div class="exh-feuille">
    <header class="exh-tete">
      <div>
        <h2 class="exh-titre">🏟️ Exhibition</h2>
        <p class="exh-sous">N'importe quels clubs, toutes les époques. Le vrai moteur, pour le fun : rien ne compte pour ta partie.</p>
      </div>
      <button type="button" class="menu-fermer exh-fermer" data-exh="fermer" aria-label="Fermer l'exhibition">✕</button>
    </header>
    <div class="exh-affiche">
      ${await cote('vis')}
      <div class="exh-at" aria-hidden="true">@</div>
      ${await cote('loc')}
    </div>
    <div class="exh-actions">
      <button type="button" class="btn go exh-jouer" data-exh="match"${pret ? '' : ' disabled'}>▶ Jouer le match</button>
      <button type="button" class="btn" data-exh="serie"${pret ? '' : ' disabled'}>Série 4 de 7</button>
      <button type="button" class="btn" data-exh="fois"${pret ? '' : ' disabled'} title="Cent matchs joués par le moteur : les chances de chaque club">100 fois</button>
    </div>
    <div class="exh-resultat" aria-live="polite">${resultat ? rendreResultat() : ''}</div>
  </div>`;
  brancher();
}

function brancher() {
  el.querySelectorAll('[data-exh]').forEach(b => {
    b.onclick = async () => {
      if (occupe) return;
      const quoi = b.dataset.exh, cote = b.dataset.cote;
      if (quoi === 'fermer') { fermer(); return; }
      if (quoi === 'ouvrir') { ouvert = ouvert === cote ? null : cote; if (ouvert) saisonVue[cote] = choix[cote] ? choix[cote].saison : saisonVue[cote]; await dessiner(); return; }
      if (quoi === 'hasard') { await tirer(cote); ouvert = null; memoriser(); resultat = null; await dessiner(); return; }
      if (quoi === 'club') { choix[cote] = { saison: saisonVue[cote], club: b.dataset.club }; ouvert = null; memoriser(); resultat = null; await dessiner(); return; }
      if (quoi === 'regarder') { regarder(); return; }
      if (quoi === 'boite') { resultat.ouverte = resultat.ouverte === Number(b.dataset.n) ? null : Number(b.dataset.n); await dessiner(); return; }
      if (quoi === 'match' || quoi === 'serie' || quoi === 'fois') await jouer(quoi);
    };
  });
  el.querySelectorAll('.exh-saison').forEach(s => {
    s.onchange = async () => { saisonVue[s.dataset.cote] = s.value; await dessiner(); };
  });
}

const memoriser = () => ecrire({ vis: choix.vis, loc: choix.loc });

async function jouer(quoi) {
  if (!choix.vis || !choix.loc) return;
  occupe = true;
  el.classList.add('occupe');
  try {
    const [loc, vis] = await Promise.all([club('loc'), club('vis')]);
    // Un souffle avant les cent matchs : la page montre qu'elle travaille.
    if (quoi === 'fois') { el.querySelector('.exh-resultat').innerHTML = '<div class="exh-attente">Le moteur joue cent matchs…</div>'; await new Promise(r => setTimeout(r, 30)); }
    const graine = nouvelleGraine();
    const r = jouerExhibition([loc, vis], graine, quoi, 100);
    resultat = { quoi, graine, ...r, ouverte: quoi === 'serie' ? null : undefined };
  } catch (e) {
    resultat = { quoi: 'erreur', mot: 'Impossible de charger une de ces saisons. Réessaie.' };
    void e;
  } finally {
    occupe = false;
    el.classList.remove('occupe');
  }
  await dessiner();
  const r = el.querySelector('.exh-resultat');
  if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ */
/* Le résultat                                                          */
/* ------------------------------------------------------------------ */
const court = t => ctx.nom(t.tag).split(/ (?:de |des |du |d')/)[0];
const nomEq = t => `${court(t)} ${t.season.slice(2, 4)}-${t.season.slice(5, 7)}`;
const temps = instant => {
  const per = periodeDe(instant);
  const t = instant - (per - 1) * 20;
  const mm = Math.floor(t), ss = Math.floor((t - mm) * 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
};

/* Le tableau du pointage : les visiteurs (B) en haut, les locaux (A) en bas, par période. */
function tableau(f, A, B) {
  const esc = ctx.esc;
  const pers = f.prolongation ? [1, 2, 3, 4] : [1, 2, 3];
  const buts = cote => pers.map(p => f.buts.filter(b => b.cote === cote && periodeDe(b.instant) === p).length);
  const rang = (cote, t) => {
    const bb = buts(cote);
    return `<tr><th scope="row">${ctx.logo(t.tag, 20)} ${esc(nomEq(t))}</th>${bb.map(x => `<td>${x}</td>`).join('')}<td class="exh-tot">${cote === 'A' ? f.gfA : f.gfB}</td><td class="exh-tirs">${tirsTotal(f, cote)}</td></tr>`;
  };
  return `<table class="exh-tableau">
    <thead><tr><th></th>${pers.map(p => `<th>${p === 4 ? 'P' : p}</th>`).join('')}<th>T</th><th class="exh-tirs">Tirs</th></tr></thead>
    <tbody>${rang('B', B)}${rang('A', A)}</tbody>
  </table>`;
}

/* Les buts, période par période, avec le pointage qui monte. */
function buts(f, A, B) {
  const esc = ctx.esc;
  if (!f.buts.length) return '<p class="exh-vide">Aucun but. Les deux gardiens ont tout arrêté.</p>';
  let a = 0, b = 0;
  const lignes = f.buts.slice().sort((x, y) => x.instant - y.instant).map(g => {
    if (g.cote === 'A') a++; else b++;
    const t = g.cote === 'A' ? A : B;
    const passes = (g.passeurs || []).map(p => esc(nomCourt(p.n))).join(', ');
    const genre = g.an ? ' <span class="exh-an">AN</span>' : g.dn ? ' <span class="exh-an">DN</span>' : '';
    return { per: periodeDe(g.instant), html: `<li class="but-eq" style="${varsEquipe(ctx.band(t.tag))}"><span class="exh-t">${temps(g.instant)}</span>${ctx.logo(t.tag, 18)}
      <span class="exh-but"><b>${esc(nomCourt(g.marqueur.n))}</b>${passes ? ` <small>(${passes})</small>` : ' <small>(sans aide)</small>'}${genre}</span>
      <span class="exh-pt">${b}-${a}</span></li>` };
  });
  return [1, 2, 3, 4].map(p => {
    const l = lignes.filter(x => x.per === p);
    return l.length ? `<div class="exh-per">${NOM_PERIODE[p]}</div><ul class="exh-buts">${l.map(x => x.html).join('')}</ul>` : '';
  }).join('');
}

/* Les deux gardiens : arrêts sur tirs, et le pourcentage du soir. */
function gardiens(f, A, B) {
  const esc = ctx.esc;
  const un = (g, cote, t) => {
    if (!g) return '';
    const contre = tirsTotal(f, cote === 'A' ? 'B' : 'A');
    const accordes = cote === 'A' ? f.gfB : f.gfA;
    const arrets = Math.max(0, contre - accordes);
    return `<li>${ctx.logo(t.tag, 18)} <b>${esc(g.n)}</b> <span>${arrets} arrêts sur ${contre}${contre ? ` · ${pct(arrets / contre)}` : ''}</span></li>`;
  };
  return `<ul class="exh-gardiens">${un(f.gardienB, 'B', B)}${un(f.gardienA, 'A', A)}</ul>`;
}

/* Les trois étoiles : les points d'abord, un gardien qui a volé le match passe devant. */
function etoiles(f, A, B) {
  const esc = ctx.esc;
  const score = new Map();
  const ajoute = (p, x, t) => { if (!p) return; const c = score.get(p) || { p, x: 0, t, g: 0, a: 0 }; c.x += x; score.set(p, c); return c; };
  for (const g of f.buts) {
    const t = g.cote === 'A' ? A : B;
    const c = ajoute(g.marqueur, 3 + (g.gagnant ? 1 : 0), t); if (c) c.g++;
    for (const p of g.passeurs || []) { const d = ajoute(p, 2, t); if (d) d.a++; }
  }
  for (const [g, cote, t] of [[f.gardienA, 'A', A], [f.gardienB, 'B', B]]) {
    if (!g) continue;
    const contre = tirsTotal(f, cote === 'A' ? 'B' : 'A');
    const acc = cote === 'A' ? f.gfB : f.gfA;
    const gagne = cote === 'A' ? f.gfA > f.gfB : f.gfB > f.gfA;
    const sv = contre ? (contre - acc) / contre : 0;
    const c = ajoute(g, Math.max(0, (sv - 0.9) * 60) + (gagne ? 2 : 0) + (acc === 0 ? 3 : 0), t);
    if (c) c.sv = { sv, contre, acc };
  }
  const top = [...score.values()].sort((x, y) => y.x - x.x).slice(0, 3);
  if (!top.length) return '';
  return `<ol class="exh-etoiles">${top.map((c, i) => `<li><span class="exh-etoile">${'★'.repeat(3 - i)}</span>
    <span class="exh-mug">${ctx.mug ? ctx.mug(c.p) : ''}</span>
    <span class="exh-qui"><b>${esc(c.p.n)}</b><small>${ctx.logo(c.t.tag, 14)} ${esc(nomEq(c.t))} · ${c.sv ? `${c.sv.contre - c.sv.acc} arrêts${c.sv.acc === 0 ? ', blanchissage' : ''}` : `${c.g} B, ${c.a} A`}</small></span></li>`).join('')}</ol>`;
}

function boite(f, A, B, { regarder = false } = {}) {
  const gagnant = f.gfA > f.gfB ? A : B;
  const esc = ctx.esc;
  return `<div class="exh-boite">
    <div class="exh-final"><span>${esc(nomEq(B))} <b>${f.gfB}</b></span><span class="exh-tiret">–</span><span><b>${f.gfA}</b> ${esc(nomEq(A))}</span></div>
    <div class="exh-mot">Final${f.prolongation ? ' en prolongation' : ''} · ${esc(court(gagnant))} gagne</div>
    ${tableau(f, A, B)}
    ${regarder ? '<button type="button" class="btn go exh-regarder" data-exh="regarder">📺 Regarder le match en direct</button>' : ''}
    <h4 class="exh-h">Les trois étoiles</h4>${etoiles(f, A, B)}
    <h4 class="exh-h">Les buts</h4>${buts(f, A, B)}
    <h4 class="exh-h">Les gardiens</h4>${gardiens(f, A, B)}
  </div>`;
}

function rendreResultat() {
  const r = resultat;
  const esc = ctx.esc;
  if (r.quoi === 'erreur') return `<p class="exh-vide">${esc(r.mot)}</p>`;
  const { A, B } = r;
  if (r.quoi === 'match') {
    return `${boite(r.feuille, A, B, { regarder: true })}
      <div class="exh-actions exh-encore"><button type="button" class="btn go" data-exh="match">↻ Rejouer</button></div>`;
  }
  if (r.quoi === 'serie') {
    const gagnant = r.winner;
    const wG = gagnant === A ? r.wA : r.wB, wP = gagnant === A ? r.wB : r.wA;
    const b = ctx.band(gagnant.tag);
    // L'état de la série après chaque match, dit par celui qui mène : « Oilers 2-1 », « Égalité 2-2 ».
    let wA = 0, wB = 0;
    const matchs = r.feuilles.map((f, i) => {
      const gA = f.gfA > f.gfB;
      if (gA) wA++; else wB++;
      const etat = wA === wB ? `Égalité ${wA}-${wB}` : wA > wB ? `${court(A)} ${wA}-${wB}` : `${court(B)} ${wB}-${wA}`;
      return `<li class="${r.ouverte === i ? 'ouverte' : ''}">
        <button type="button" class="exh-match" data-exh="boite" data-n="${i}" aria-expanded="${r.ouverte === i}">
          <span class="exh-no">Match ${i + 1}</span>
          <span class="exh-sc"><span class="${gA ? '' : 'gagne'}">${ctx.logo(B.tag, 16)} ${f.gfB}</span> – <span class="${gA ? 'gagne' : ''}">${f.gfA} ${ctx.logo(A.tag, 16)}</span>${f.prolongation ? ' <small>(P)</small>' : ''}</span>
          <span class="exh-etat">${esc(etat)}</span>
        </button>
        ${r.ouverte === i ? boite(f, A, B) : ''}
      </li>`;
    }).join('');
    return `<div class="exh-serie" style="--eq-bg:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}">
        <div class="exh-serie-tete">${ctx.logo(gagnant.tag, 40)}<div><b>${esc(nomEq(gagnant))}</b><span>gagne la série ${wG}-${wP}</span></div></div>
      </div>
      <p class="exh-aide">Touche un match pour sa feuille.</p>
      <ol class="exh-matchs">${matchs}</ol>
      <div class="exh-actions exh-encore"><button type="button" class="btn go" data-exh="serie">↻ Rejouer la série</button></div>`;
  }
  if (r.quoi === 'fois') {
    const pA = Math.round(100 * r.wA / r.n), pB = 100 - pA;
    const bA = ctx.band(A.tag), bB = ctx.band(B.tag);
    const moy = x => (x / r.n).toFixed(1).replace('.', ',');
    return `<div class="exh-fois">
      <div class="exh-fois-t">Sur ${r.n} matchs, chez ${esc(court(A))}</div>
      <div class="exh-barre" role="img" aria-label="${esc(nomEq(B))} ${pB} %, ${esc(nomEq(A))} ${pA} %">
        <span style="flex:${Math.max(pB, 1)};background:${bB.bg};color:${bB.ink}">${pB} %</span>
        <span style="flex:${Math.max(pA, 1)};background:${bA.bg};color:${bA.ink}">${pA} %</span>
      </div>
      <div class="exh-fois-noms">
        <span><b>${ctx.logo(B.tag, 18)} ${esc(nomEq(B))}</b><small>${r.wB} victoires</small></span>
        <span><b>${esc(nomEq(A))} ${ctx.logo(A.tag, 18)}</b><small>${r.wA} victoires</small></span>
      </div>
      <p class="exh-aide">Pointage moyen ${moy(r.gfB)} – ${moy(r.gfA)} · ${r.prolongations} en prolongation. Chaque match repart d'équipes reposées : c'est le moteur de la saison, sans la fatigue ni les blessures d'un calendrier.</p>
    </div>
    <div class="exh-actions exh-encore"><button type="button" class="btn go" data-exh="fois">↻ Encore 100 fois</button></div>`;
  }
  return '';
}

/* REGARDER : le direct de la saison rejoue la feuille, puis on revient ici. */
function regarder() {
  const r = resultat;
  if (!r || r.quoi !== 'match' || !ctx.direct) return;
  el.style.display = 'none';
  diffuserMatch({
    feuille: r.feuille, A: r.A, B: r.B,
    titre: 'Exhibition',
    etat: 'Pour le fun : rien ne compte', graine: Number.parseInt(String(r.graine), 36) || 1,
    ctx: ctx.direct,
    onTermine: () => { if (el) el.style.display = ''; },
  });
}
