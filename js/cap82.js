/**
 * CAP 82, LE JEU PUR (1.0, Jalon K).
 *
 * JP : *Le mode CAP 82 devrait avoir le standard que tu fais juste voir un
 * résultat avec team, sans les stratégies, packs de cartes, etc*.
 *
 * Le repêchage fini, la saison DÉFILE : la fiche monte match après match, la
 * piste des 82 matchs se colore, et le 82-0 tient jusqu'à la première
 * défaite — ce moment-là s'arrête le temps de le lire. Puis les séries, ronde
 * par ronde, et le résultat. Rien à décider : on regarde son club jouer. La
 * vitesse se règle, la pause aussi, et « Aller au résultat » saute tout.
 *
 * RIEN N'EST JOUÉ D'AVANCE (S79) : chaque journée se joue au moment d'être
 * révélée (`jouerJusqua`), chaque match de séries aussi (`jouerMatchSeries`).
 * Il n'y a aucune décision : la même graine redonne la même saison.
 *
 * L'écran vit dans `#hubModal`, ancré sous l'en-tête comme l'écran de saison
 * du Rogue (js/saison.js, dont il reprend la coquille et les tableaux), et il
 * inscrit ses volets à la coquille du jeu (js/coquille.js) : la Ligue — le
 * classement, les meneurs, les équipes, le calendrier — se lit pendant que ça
 * joue, à la dernière journée révélée. Le module est aveugle aux données du
 * jeu : `ctx` porte les fonctions d'affichage de js/game.js.
 */

import { jouerJusqua, jouerMatchSeries, compterFeuilles } from './sim.js';
import { coquille, onglets, meneursHtml, equipesHtml, brancherMenu, menuNeuf } from './saison.js';
import { retirerHub } from './coquille.js';
import { choixOuvert } from './gerant.js';
import { jouerSon } from './sons.js';

/* Le temps d'un de tes matchs à l'écran, selon la vitesse ; ×10 fait la saison en un peu plus de trois secondes. */
const VITESSES = [{ x: 1, ms: 420 }, { x: 3, ms: 140 }, { x: 10, ms: 40 }];
const CLE_VITESSE = 'cap82_vitesse';
/* Le 82-0 qui tombe, une ronde qui se règle : le temps de le lire avant que ça reparte. */
const PAUSE_REVE = 2000;
const PAUSE_RONDE = 1500;

const lireVitesse = () => {
  let x = 3;
  try { x = Number(localStorage.getItem(CLE_VITESSE)) || 3; } catch { /* stockage indisponible */ }
  return VITESSES.find(v => v.x === x) || VITESSES[1];
};
const ecrireVitesse = v => { try { localStorage.setItem(CLE_VITESSE, String(v.x)); } catch { /* ignore */ } };
const rangMot = r => (r === 1 ? '1er' : `${r}e`);
/* « finale de la Coupe Stanley » : la minuscule en tête seulement, les noms propres gardent la leur. */
const minus = s => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * `ctx` : esc, teamLabel, teamShort, tagCourt, logo, band, quiEst, fiche, entete (l'en-tête du club à rafraîchir).
 * `classementFinal()` joue ce qui reste et rend le classement final ;
 * `creerSeries(qualifies, revele)` rend le moteur des séries (rejoué jusqu'à
 * `revele` pour une reprise) ; `nomDeRonde(r)` son nom ; `onTermine(S)` ferme
 * sur le résultat (S : null sans séries).
 */
export function ouvrirCap82({ ligue, you, teams, calendrier, enSeries, epoque = null, ctx, depuis = 0, vues = null,
  onJour, sauver, classementFinal, creerSeries, nomDeRonde, onSeries, onTermine }) {
  const ui = coquille('Cap 82');
  if (!ui) { onTermine(null); return; }
  const { modal, carte, actions, barre, volet } = ui;
  const N = calendrier.length;
  const indexMien = j => calendrier[j].findIndex(m => m.A === you || m.B === you);
  const totalMiens = calendrier.reduce((n, _, j) => n + (indexMien(j) >= 0 ? 1 : 0), 0);

  /* ---------- ce qui est révélé ---------- */
  let jour = 0;
  const fiche = new Map(teams.map(t => [t, { W: 0, L: 0, OTL: 0, GF: 0, GA: 0, PTS: 0 }]));
  const resultats = new Map(teams.map(t => [t, []]));
  const miens = [];                       // { j, k, m, r } : tes matchs joués, r = 'V' | 'D' | 'DP'
  const compte = new Map();               // les feuilles révélées, au format des meneurs
  const equipeDe = new Map();
  for (const t of teams) for (const p of Object.values(t.roster || {})) if (p) equipeDe.set(p, t);
  for (const t of teams) if (t.rappelG) equipeDe.set(t.rappelG, t);

  const cumuler = m => {
    const a = fiche.get(m.A), b = fiche.get(m.B);
    if (!a || !b) return;
    a.GF += m.gfA; a.GA += m.gfB; b.GF += m.gfB; b.GA += m.gfA;
    const gagneA = m.gfA > m.gfB;
    if (gagneA) { a.W++; if (m.ot) b.OTL++; else b.L++; } else { b.W++; if (m.ot) a.OTL++; else a.L++; }
    a.PTS = a.W * 2 + a.OTL; b.PTS = b.W * 2 + b.OTL;
    resultats.get(m.A).push(gagneA ? 'V' : m.ot ? 'DP' : 'D');
    resultats.get(m.B).push(gagneA ? (m.ot ? 'DP' : 'D') : 'V');
  };
  // Le même bris d'égalité que le classement final (js/sim.js) et que l'écran de saison.
  const classement = () => teams.slice().sort((x, y) => {
    const a = fiche.get(x), b = fiche.get(y);
    return b.PTS - a.PTS || b.W - a.W || (b.GF - b.GA) - (a.GF - a.GA) || b.GF - a.GF
      || String(`${x.tag}${x.season || ''}`).localeCompare(String(`${y.tag}${y.season || ''}`));
  });
  const rangDe = t => classement().indexOf(t) + 1;
  const sequenceDe = t => {
    const r = resultats.get(t) || [];
    if (!r.length) return '—';
    const v = x => x === 'V';
    let n = 0;
    for (let i = r.length - 1; i >= 0 && v(r[i]) === v(r[r.length - 1]); i--) n++;
    return `${v(r[r.length - 1]) ? 'V' : 'D'}${n}`;
  };
  const maFiche = () => fiche.get(you);

  function reveler(j) {
    jouerJusqua(ligue, j + 1);
    const matchs = calendrier[j];
    for (const m of matchs) cumuler(m);
    compterFeuilles(matchs.map(m => m.feuille), compte);
    const k = indexMien(j);
    if (k >= 0) {
      const m = matchs[k];
      const gagne = (m.A === you) === (m.gfA > m.gfB);
      miens.push({ j, k, m, r: gagne ? 'V' : m.ot ? 'DP' : 'D' });
    }
    jour = j + 1;
    onJour(jour);
  }
  // Une reprise rejoue en silence jusqu'où on avait regardé.
  for (let j = 0; j < Math.min(depuis, N); j++) reveler(j);

  /* ---------- l'étape, la lecture ---------- */
  // 'saison' → 'finSaison' → 'series' → 'fin'
  let etape = jour >= N ? 'finSaison' : 'saison';
  let classementFin = null, S = null;
  let enJeu = false, minuterie = null, termine = false, vitesse = lireVitesse();
  let moment = null;                      // { cle, titre, texte } : ce qui arrête la lecture un instant
  let reveMort = miens.find(x => x.r !== 'V') || null;
  let ronde0 = null;                      // la ronde en cours à l'écran (pour savoir quand elle se règle)
  const qualifie = () => !!classementFin && classementFin.indexOf(you) + 1 <= enSeries;
  const etatSeries = () => ({ revele: S ? S.toutes.map(s => s.feuilles.length) : [] });
  const maSerie = () => (S ? S.toutes.filter(s => s.A === you || s.B === you).slice(-1)[0] || null : null);

  const finirSaison = () => {
    if (!classementFin) classementFin = classementFinal();
    jour = N;
    etape = 'finSaison';
  };
  if (etape === 'finSaison') finirSaison();
  // Des séries en cours à la reprise : on les rejoue jusqu'où on les avait vues.
  if (etape === 'finSaison' && vues && Array.isArray(vues.revele) && vues.revele.length && qualifie()) {
    S = creerSeries(classementFin.slice(0, enSeries), vues.revele);
    etape = S.fini ? 'fin' : 'series';
    ronde0 = S.ronde;
  }

  function pas() {
    if (etape === 'saison') {
      const avant = miens.length;
      while (jour < N && miens.length === avant) reveler(jour);
      const dernier = miens.length > avant ? miens[miens.length - 1] : null;
      // LE 82-0 TOMBE : la première défaite arrête la lecture, le temps de la lire.
      if (dernier && dernier.r !== 'V' && !reveMort) {
        reveMort = dernier;
        const adv = dernier.m.A === you ? dernier.m.B : dernier.m.A;
        moment = { cle: 'reve', titre: 'Le 82-0 s\'arrête ici', texte: `Match ${miens.length} · ${dernier.r === 'DP' ? 'défaite en prolongation' : 'défaite'} ${scoreDe(dernier.m)} contre ${ctx.teamShort(adv)}` };
        jouerSon('refus');
      }
      if (jour >= N) {
        finirSaison();
        enJeu = false;
        jouerSon('fin');
      }
      return;
    }
    if (etape === 'series') {
      const r = S.ronde;
      jouerMatchSeries(S);
      onSeries(etatSeries());
      if (!S.fini && S.ronde === r) return;
      // UNE RONDE SE RÈGLE : ta série, en une ligne ; éliminé, le reste des séries se joue d'un coup.
      const s = S.toutes.filter(x => x.ronde === r && (x.A === you || x.B === you))[0];
      if (s && s.winner === you) {
        moment = S.fini
          ? { cle: 'coupe', titre: 'La Coupe Stanley', texte: `Les NHL Stars sont champions${epoque ? ` de ${epoque}` : ''}.` }
          : { cle: 'ronde', titre: `${nomDeRonde(r)} · gagné`, texte: `${serieMot(s)}. Prochaine ronde : ${nomDeRonde(S.ronde)}.` };
        jouerSon(S.fini ? 'recompense' : 'but');
      } else if (s) {
        while (!S.fini) jouerMatchSeries(S);
        onSeries(etatSeries());
        moment = { cle: 'elimine', titre: `Éliminés · ${minus(nomDeRonde(r))}`, texte: `${serieMot(s)}. Champion : ${ctx.teamShort(S.champion)}.` };
        jouerSon('refus');
      }
      ronde0 = S.ronde;
      if (S.fini) { etape = 'fin'; enJeu = false; }
    }
  }

  const planifier = ms => { clearTimeout(minuterie); minuterie = setTimeout(boucle, ms); };
  function boucle() {
    if (termine || !enJeu) return;
    pas();
    dessiner();
    if (termine) return;
    if (moment) {
      const m = moment;
      moment = null;
      // L'annonce reste à l'écran ; la lecture reprend seule si elle tournait.
      if (enJeu) planifier(m.cle === 'reve' ? PAUSE_REVE : PAUSE_RONDE);
      return;
    }
    if (enJeu) planifier(vitesse.ms);
  }
  const jouer = () => { if (etape !== 'saison' && etape !== 'series') return; enJeu = true; dessiner(); planifier(80); };
  const pause = () => { enJeu = false; clearTimeout(minuterie); sauver(); dessiner(); };

  function allerAuResultat() {
    enJeu = false;
    clearTimeout(minuterie);
    if (etape === 'saison') { jouerJusqua(ligue, Infinity); finirSaison(); onJour(N); }
    if (etape === 'finSaison' && qualifie()) { S = S || creerSeries(classementFin.slice(0, enSeries)); etape = 'series'; }
    if (etape === 'series') { while (!S.fini) jouerMatchSeries(S); onSeries(etatSeries()); etape = 'fin'; }
    fermer();
  }
  function lancerSeries() {
    S = creerSeries(classementFin.slice(0, enSeries));
    ronde0 = S.ronde;
    etape = 'series';
    onSeries(etatSeries());
    sauver();
    tabs.montrer('club');
    jouer();
  }

  /* ---------- les mots ---------- */
  const scoreDe = m => { const pour = m.A === you ? m.gfA : m.gfB, contre = m.A === you ? m.gfB : m.gfA; return `${pour}–${contre}${m.ot ? ' (P)' : ''}`; };
  const serieMot = s => {
    const toi = s.A === you ? s.wA : s.wB, eux = s.A === you ? s.wB : s.wA, adv = s.A === you ? s.B : s.A;
    return `${toi > eux ? 'Victoire' : 'Défaite'} ${toi}-${eux} contre ${ctx.teamShort(adv)}`;
  };
  const etatMot = () => (etape === 'saison' ? `Saison régulière · match ${miens.length} / ${totalMiens}`
    : etape === 'finSaison' ? 'Saison régulière · terminée'
    : etape === 'series' ? `Séries · ${minus(nomDeRonde(S.ronde))}`
    : 'Séries · terminées');

  /* ---------- le tableau d'affichage ---------- */
  const piste = () => {
    const cases = [];
    for (let i = 0; i < totalMiens; i++) {
      const x = miens[i];
      cases.push(`<i class="${x ? x.r.toLowerCase() : i === miens.length && etape === 'saison' ? 'ici' : ''}"${x ? ` title="Match ${i + 1} · ${x.r} ${scoreDe(x.m)}"` : ''}></i>`);
    }
    return `<div class="c82-piste" aria-hidden="true">${cases.join('')}</div>`;
  };
  const reveHtml = () => {
    const f = maFiche();
    if (!reveMort) {
      return miens.length
        ? `<div class="c82-reve vivant">★ Le 82-0 tient : ${f.W} victoire${f.W > 1 ? 's' : ''} de suite</div>`
        : '<div class="c82-reve vivant">★ 82-0 : le rêve commence au premier match</div>';
    }
    return `<div class="c82-reve mort">Le 82-0 s'est arrêté au match ${miens.indexOf(reveMort) + 1}</div>`;
  };
  const dernierHtml = () => {
    const x = miens[miens.length - 1];
    if (!x) return '<div class="c82-dernier">Le premier match s\'en vient.</div>';
    const adv = x.m.A === you ? x.m.B : x.m.A;
    return `<div class="c82-dernier ${x.r.toLowerCase()}"><b>${x.r}</b> ${scoreDe(x.m)} ${x.m.A === you ? 'contre' : 'à'} ${ctx.logo(adv.tag, 18)}<span>${ctx.esc(ctx.teamShort(adv))}</span></div>`;
  };
  const pips = (n, cls) => `<span class="c82-pips ${cls}">${[0, 1, 2, 3].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
  const serieAffiche = s => {
    const toiA = s.A === you, toi = toiA ? s.A : s.B, adv = toiA ? s.B : s.A;
    const wT = toiA ? s.wA : s.wB, wE = toiA ? s.wB : s.wA;
    const b = ctx.band(adv.tag);
    return `<div class="c82-serie">
      <div class="c82-eq toi">${ctx.logo(toi.tag, 34)}<span>${ctx.esc(ctx.tagCourt(toi))}</span>${pips(wT, 'toi')}</div>
      <div class="c82-serie-mi"><b>${wT}–${wE}</b><small>${ctx.esc(nomDeRonde(s.ronde))}</small></div>
      <div class="c82-eq eux" style="--eq-band:${b.bg}">${ctx.logo(adv.tag, 34)}<span>${ctx.esc(ctx.tagCourt(adv))}</span>${pips(wE, 'eux')}</div>
    </div>`;
  };

  function dessinerCarte() {
    const f = maFiche();
    const rang = jour ? rangDe(you) : null;
    let corps = '';
    if (etape === 'saison' || etape === 'finSaison') {
      corps = `
        <div class="c82-fiche" aria-label="Fiche ${f.W}-${f.L}-${f.OTL}">
          <span class="c82-n v">${f.W}<small>V</small></span><span class="c82-sep">-</span><span class="c82-n d">${f.L}<small>D</small></span><span class="c82-sep">-</span><span class="c82-n dp">${f.OTL}<small>DP</small></span>
        </div>
        <div class="c82-infos">
          <span><small>Match</small><b>${miens.length}<i>/${totalMiens}</i></b></span>
          <span><small>Rang</small><b>${rang ? rangMot(rang) : '—'}</b></span>
          <span><small>Points</small><b>${f.PTS}</b></span>
          <span><small>Séquence</small><b>${miens.length ? sequenceDe(you) : '—'}</b></span>
        </div>
        ${reveHtml()}
        ${piste()}
        ${etape === 'saison' ? dernierHtml() : `<div class="c82-verdict ${qualifie() ? 'dedans' : 'dehors'}">${qualifie()
          ? `${rangMot(classementFin.indexOf(you) + 1)} de ${teams.length} · en séries`
          : `${rangMot(classementFin.indexOf(you) + 1)} de ${teams.length} · hors des séries (les ${enSeries} premiers y vont)`}</div>`}`;
    } else {
      const s = maSerie();
      const champion = etape === 'fin' && S.champion;
      corps = `
        ${s ? serieAffiche(s) : ''}
        ${etape === 'fin' ? `<div class="c82-verdict ${champion === you ? 'coupe' : 'dehors'}">${champion === you
          ? `🏆 Les NHL Stars gagnent la Coupe Stanley`
          : `Champion : ${ctx.logo(champion.tag, 18)} ${ctx.esc(ctx.teamLabel(champion))}`}</div>` : ''}
        <div class="c82-infos">
          <span><small>Saison</small><b>${f.W}-${f.L}-${f.OTL}</b></span>
          <span><small>Rang</small><b>${rangMot(classementFin.indexOf(you) + 1)}</b></span>
          <span><small>Séries</small><b>${seriesVD()}</b></span>
        </div>`;
    }
    // Le tableau se redessine à chaque match : l'annonce reprend son animation où elle en était (1.0) — sinon, à ×10,
    // chaque rendu relançait le fondu à zéro et elle restait presque transparente.
    const annonce = momentAffiche ? `<div class="c82-moment ${momentAffiche.cle}" role="status" style="animation-delay:${-Math.max(0, Date.now() - momentDebut)}ms"><b>${ctx.esc(momentAffiche.titre)}</b><span>${ctx.esc(momentAffiche.texte)}</span></div>` : '';
    carte.innerHTML = `<div class="c82 etape-${etape}${enJeu ? ' en-jeu' : ''}">${corps}${annonce}</div>`;
  }
  const seriesVD = () => {
    let V = 0, D = 0;
    for (const s of (S ? S.toutes : [])) {
      if (s.A !== you && s.B !== you) continue;
      V += s.A === you ? s.wA : s.wB; D += s.A === you ? s.wB : s.wA;
    }
    return `${V}-${D}`;
  };

  function dessinerActions() {
    const vit = `<div class="c82-vitesses" role="group" aria-label="Vitesse">${VITESSES.map(v =>
      `<button type="button" class="c82-vit${v === vitesse ? ' on' : ''}" data-x="${v.x}" aria-pressed="${v === vitesse}">×${v.x}</button>`).join('')}</div>`;
    let html = '';
    if (etape === 'saison' || etape === 'series') {
      html = `<button type="button" class="btn go c82-jouer">${enJeu ? '⏸ Pause' : miens.length || S ? '▶ Reprendre' : '▶ Jouer'}</button>
        ${vit}
        <button type="button" class="btn c82-fin">Aller au résultat</button>`;
    } else if (etape === 'finSaison') {
      html = qualifie()
        ? `<button type="button" class="btn gold c82-series">Jouer les séries</button><button type="button" class="btn c82-fin">Aller au résultat</button>`
        : '<button type="button" class="btn go c82-resultat">Voir le résultat</button>';
    } else {
      html = '<button type="button" class="btn go c82-resultat">Voir le résultat</button>';
    }
    actions.innerHTML = `<div class="c82-commandes">${html}</div>`;
    const b = s => actions.querySelector(s);
    if (b('.c82-jouer')) b('.c82-jouer').onclick = () => (enJeu ? pause() : jouer());
    if (b('.c82-fin')) b('.c82-fin').onclick = allerAuResultat;
    if (b('.c82-series')) b('.c82-series').onclick = lancerSeries;
    if (b('.c82-resultat')) b('.c82-resultat').onclick = fermer;
    actions.querySelectorAll('.c82-vit').forEach(x => {
      x.onclick = () => {
        vitesse = VITESSES.find(v => v.x === Number(x.dataset.x)) || vitesse;
        ecrireVitesse(vitesse);
        dessinerActions();
        if (enJeu) planifier(vitesse.ms);
      };
    });
  }

  /* ---------- les volets ---------- */
  const menu = menuNeuf();
  const matchsDe = t => { const g = fiche.get(t); return g ? g.W + g.L + g.OTL : 0; };
  const blessesDe = (t, joues) => {
    const m = new Map();
    for (const b of (t.injuriesLog || [])) {
      const reste = b.at + b.games - (joues + 1);
      if (b.at <= joues + 1 && reste > 0) m.set(b.player, reste);
    }
    return m;
  };
  const ligneJeu = ({ j, k, m, r }, n) => {
    const adv = m.A === you ? m.B : m.A;
    return `<div class="hub-jeu ${r === 'V' ? 'v' : 'd'}" data-sommaire="saison|${j}|${k}" role="button" tabindex="0" title="Le sommaire du match"><span class="hub-jeu-n">M${n}</span><span class="hub-jeu-res">${r}</span><span class="hub-jeu-score">${scoreDe(m).replace(' (P)', '')}</span>${ctx.logo(adv.tag, 15)}<span class="hub-jeu-adv">${ctx.esc(ctx.teamLabel(adv))}</span>${m.ot ? '<em>P</em>' : ''}</div>`;
  };
  const tesMeneurs = () => {
    const pat = Object.values(you.roster || {}).filter(p => p && p.p !== 'G').map(p => ({ p, c: compte.get(p) }))
      .filter(x => x.c && x.c.gp).sort((a, b) => b.c.pts - a.c.pts || b.c.g - a.c.g).slice(0, 5);
    if (!pat.length) return '';
    return `<div class="hub-titre">Tes meneurs</div><div class="c82-meneurs">${pat.map(({ p, c }) =>
      `<div class="c82-men"><span class="nom">${ctx.fiche ? ctx.fiche(p, you, ctx.esc(p.n)) : ctx.esc(p.n)}</span><b>${c.pts}</b><small>${c.g} B · ${c.a} A</small></div>`).join('')}</div>`;
  };
  const voletClub = () => {
    if (etape === 'series' || etape === 'fin') {
      const r = S.fini ? S.nRondes - 1 : S.ronde;
      const dedans = S.toutes.filter(s => s.ronde === r);
      const s = maSerie();
      // Les matchs de ta série, du plus récent au premier ; chacun ouvre son sommaire.
      const jeux = s ? s.feuilles.map((f, k) => {
        const toiA = s.A === you, adv = toiA ? s.B : s.A;
        const pour = f.buts.filter(b => b.cote === (toiA ? 'A' : 'B')).length, contre = f.buts.length - pour;
        const r = pour > contre ? 'V' : 'D';
        return `<div class="hub-jeu ${r === 'V' ? 'v' : 'd'}" data-sommaire="series|${s.i}|${k}" role="button" tabindex="0" title="Le sommaire du match"><span class="hub-jeu-n">M${k + 1}</span><span class="hub-jeu-res">${r}</span><span class="hub-jeu-score">${pour}–${contre}</span>${ctx.logo(adv.tag, 15)}<span class="hub-jeu-adv">${ctx.esc(ctx.teamLabel(adv))}</span>${f.prolongation ? '<em>P</em>' : ''}</div>`;
      }).reverse().join('') : '';
      return `${jeux ? `<div class="hub-titre">Ta série · ${ctx.esc(nomDeRonde(s.ronde))}</div><div class="hub-jeux">${jeux}</div>` : ''}
        <div class="hub-titre">${ctx.esc(nomDeRonde(r))}</div>
        <div class="c82-ronde">${dedans.map(x => `<div class="c82-ronde-l${x.A === you || x.B === you ? ' toi' : ''}">
          <span class="c82-rl-eq${x.winner === x.A ? ' gagne' : ''}">${ctx.logo(x.A.tag, 16)}${ctx.esc(ctx.tagCourt(x.A))}</span>
          <b>${x.wA}–${x.wB}</b>
          <span class="c82-rl-eq d${x.winner === x.B ? ' gagne' : ''}">${ctx.esc(ctx.tagCourt(x.B))}${ctx.logo(x.B.tag, 16)}</span>
        </div>`).join('')}</div>`;
    }
    const recents = miens.slice(-8).map((x, i, a) => ligneJeu(x, miens.length - a.length + i + 1)).reverse().join('');
    /*
     * LA COURSE AUX SÉRIES (1.0). À 1440 px, le volet du club laissait sa moitié du bas vide : un jeu de sport
     * de console y met la course — les huit premiers, la ligne des séries, et ton club s'il est plus bas.
     * Rien à décider : ça se lit en passant, pendant que la saison défile.
     */
    const cl = classement(), moi = cl.indexOf(you);
    const rangs = [...new Set([...cl.keys()].slice(0, Math.min(8, cl.length)).concat(moi >= 8 ? [moi] : []))];
    const course = jour ? `<div class="hub-titre">La course aux séries</div><div class="c82-course">${rangs.map(i => {
      const t = cl[i], g = fiche.get(t);
      return `<div class="c82-cr${t === you ? ' toi' : ''}${i === enSeries - 1 ? ' cut' : ''}${i >= 8 ? ' loin' : ''}"><span class="n">${i + 1}</span>${ctx.logo(t.tag, 16)}<span class="eq">${ctx.esc(ctx.teamShort(t))}</span><span class="f">${g.W}-${g.L}-${g.OTL}</span><b>${g.PTS}</b></div>`;
    }).join('')}</div>` : '';
    return `<div class="c82-club"><div class="c82-club-col">${tesMeneurs()}${course}</div>
      <div class="c82-club-col"><div class="hub-titre">Tes derniers matchs</div><div class="hub-jeux">${recents || '<div class="hub-note">Aucun match joué encore.</div>'}</div></div></div>`;
  };
  const voletClassement = () => {
    const rangee = (t, i) => {
      const g = fiche.get(t);
      return `<tr class="${t === you ? 'toi' : ''}${i === enSeries - 1 ? ' cut' : ''}"><td>${i + 1}</td><td class="nom">${ctx.logo(t.tag, 14)} <span class="nom-long">${ctx.esc(ctx.teamShort(t))}</span><span class="nom-court">${ctx.esc(ctx.tagCourt(t))}</span></td><td>${g.W + g.L + g.OTL}</td><td>${g.W}</td><td>${g.L}</td><td>${g.OTL}</td><td class="heros">${g.PTS}</td><td>${g.GF - g.GA > 0 ? '+' : ''}${g.GF - g.GA}</td><td>${sequenceDe(t)}</td></tr>`;
    };
    return `<div class="live-tableau hub-classement"><div class="live-tableau-titre">Classement · ${jour >= N ? 'final' : `journée ${jour}`} · les ${enSeries} premiers vont en séries</div>
      <table><thead><tr><th>#</th><th>Équipe</th><th>PJ</th><th>V</th><th>D</th><th>DP</th><th class="heros">PTS</th><th>Diff</th><th title="La séquence en cours">Séq.</th></tr></thead>
      <tbody>${classement().map(rangee).join('')}</tbody></table></div>`;
  };
  const voletCalendrier = () => {
    const joues = miens.map((x, i) => ligneJeu(x, i + 1));
    const aVenir = [];
    for (let j = jour; j < N && aVenir.length < 6; j++) {
      const k = indexMien(j);
      if (k < 0) continue;
      const m = calendrier[j][k], adv = m.A === you ? m.B : m.A;
      aVenir.push(`<div class="hub-jeu avenir"><span class="hub-jeu-n">M${joues.length + aVenir.length + 1}</span><span class="hub-jeu-res">·</span><span class="hub-jeu-score">${m.A === you ? 'contre' : 'à'}</span>${ctx.logo(adv.tag, 15)}<span class="hub-jeu-adv">${ctx.esc(ctx.teamLabel(adv))}</span></div>`);
    }
    const f = maFiche();
    return `<div class="hub-titre">Tes ${miens.length} matchs · ${f.W}-${f.L}-${f.OTL} · ${f.GF} BP · ${f.GA} BC</div>
      <div class="hub-jeux">${joues.reverse().join('')}${aVenir.length ? `<div class="hub-titre">À venir</div>${aVenir.join('')}` : ''}</div>`;
  };

  const tabs = onglets(barre, volet, [
    { cle: 'club', ico: 'i-club', titre: 'Match', page: 'match' },
    { cle: 'classement', ico: 'i-chart', titre: 'Classement', page: 'classement' },
    { cle: 'meneurs', ico: 'i-star', titre: 'Meneurs', page: 'meneurs' },
    { cle: 'equipes', ico: 'i-jersey', titre: 'Équipes', page: 'equipes' },
    { cle: 'calendrier', ico: 'i-cal', titre: 'Calendrier', page: 'calendrier' },
  ], cle => {
    if (cle === 'classement') return voletClassement();
    if (cle === 'meneurs') return meneursHtml(ctx, compte, equipeDe, you, jour >= N ? 'la saison' : `journée ${jour}`, menu);
    if (cle === 'equipes') return equipesHtml(ctx, {
      teams: classement(), compte, you, menu, matchsDe, blessesDe,
      ficheDe: t => { const g = fiche.get(t); return `${g.W}-${g.L}-${g.OTL} · ${g.PTS} pts · ${rangMot(rangDe(t))} · ${g.GF} BP · ${g.GA} BC`; },
    });
    if (cle === 'calendrier') return voletCalendrier();
    return voletClub();
  });
  tabs.hub.etat = etatMot;
  const debrancherMenu = brancherMenu(volet, menu, () => classement(), () => tabs.rafraichir(), cle => tabs.montrer(cle));

  /* ---------- dessiner ---------- */
  let momentAffiche = null, momentJusqua = 0, momentDebut = 0, rendus = 0;
  function dessiner() {
    if (termine) return;
    // Une annonce reste le temps de sa pause, puis s'efface au rendu suivant.
    if (moment) { if (moment !== momentAffiche) momentDebut = Date.now(); momentAffiche = moment; momentJusqua = Date.now() + (moment.cle === 'reve' ? PAUSE_REVE : PAUSE_RONDE); }
    else if (momentAffiche && Date.now() > momentJusqua) momentAffiche = null;
    // L'en-tête du club dit déjà le club et où en est la partie : l'écran n'a pas de titre à lui.
    if (ctx.entete) ctx.entete();
    dessinerCarte();
    dessinerActions();
    // Le volet ouvert suit : le club à chaque match, les tableaux de la ligue un match sur six (ou à l'arrêt).
    rendus++;
    const cle = tabs.courant();
    if (cle === 'club' || !enJeu || rendus % 6 === 0) tabs.rafraichir();
    // La sauvegarde suit un rendu sur huit, et chaque arrêt : une reprise recommence au pire quelques matchs plus tôt.
    if (rendus % 8 === 0 || !enJeu) sauver();
  }

  /* ---------- fermer ---------- */
  // Sans rangée de titre (l'en-tête du club la porte) ni ✕ : on ne quitte pas une saison à moitié jouée.
  modal.classList.add('cap82');
  const clavier = ev => {
    if (ev.key !== ' ' || ev.target.closest('input, textarea, select, button, [role="button"], a')) return;
    if (choixOuvert() || document.body.classList.contains('hub-cache') || document.getElementById('liveModal')?.style.display === 'flex') return;
    ev.preventDefault();
    if (etape === 'saison' || etape === 'series') { if (enJeu) pause(); else jouer(); }
  };
  function fermer() {
    if (termine) return;
    termine = true;
    enJeu = false;
    clearTimeout(minuterie);
    debrancherMenu();
    retirerHub(tabs.hub);
    window.removeEventListener('keydown', clavier);
    modal.classList.remove('cap82');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    onTermine(S);
  }
  window.addEventListener('keydown', clavier);

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  dessiner();
  tabs.montrer('club');
  // Une saison neuve part toute seule ; une reprise attend « Reprendre ».
  if (!depuis && etape === 'saison') jouer();
}
