/*
 * LES SCÈNES DE LA RUN (V28, docs/refonte-v28.md § 4.9 ; docs/maquettes/v28-ecrans.html, les dix-sept écrans qui font foi :
 * JP, 10 nov. 2026, *fais tout je suis tanné des maquettes*). Chaque scène est une fonction pure : la séance `S` (js/run.js)
 * et la vue `V` (ce que l'écran regarde : la case touchée, la porte ouverte, la carte tenue) rendent le HTML d'un plan fixe
 * de 390 × 844. Un bouton porte `data-a` (son geste) et `data-v` (sa valeur) ; js/run-jeu.js les joue. Les cartes sont
 * celles du jeu, telles quelles (`cartonDe`, `carteHtml`, `carteDePiece`, `pochetteHtml`).
 */
import { SLOTS, activeLineup, badgesDe, energieDe, getHiddenRatings, getPlayerKey, periodeDe, PALIERS } from './sim.js';
import { PLANS, INTENTIONS } from './greffes.js';
import { PIECES, PIECE_DU_COACH, CASES_DU_BANC } from './pieces.js';
import { COACHS, REGLES_DU_COACH } from './coachs.js';
import { motDuRang, niveauDuCoach } from './coachs-reels.js';
import { NIVEAUX, nomDuNiveau } from './niveaux.js';
import { PRIX_PIECE } from './actes.js';
import { lignesDeLaPiece, motsDeStats } from './impact.js';
import { cartonDe, varsEquipe } from './repechage.js';
import { carteHtml, carteDePiece, pochetteHtml } from './cartes.js';
import { getTeamBand, getTeamLogoHtml } from './logos.js';
import { NOM_VARIANTE } from './rarete.js';
import { groupeDe } from './ballottage.js';
import { TEAMFULL } from './game.js';
import { esc, money, pct3, ord, varsCarton } from './util.js';
import {
  RUN, RANG_DU_RIVAL, casesOffertes, caseA, suivantes, masseDe, espaceDe, prixDe, masseApres, tient, vestiaireDe, sortantsPour, accordsDe, siTenu, editionDe, jeuDe,
} from './run.js';

/* ---------- les petites briques ---------- */
const ROMAINS = ['I', 'II', 'III'];
const coeur = plein => `<svg class="rn-co${plein ? '' : ' rn-vide'}" viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21.2 2.6 11.6a6.1 6.1 0 0 1 8.6-8.6l.8.8.8-.8a6.1 6.1 0 0 1 8.6 8.6z"/></svg>`;
const ICONES = {
  marche: '<path d="M4 9h16l-1.4 10H5.4z"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2"/>',
  vestiaire: '<path d="M12 7v10M7 12h10"/><rect x="4" y="4" width="16" height="16" rx="4"/>',
  histoire: '<path d="M5 5h14v10H10l-5 4z"/>',
};
const icone = k => `<svg class="rn-ico" viewBox="0 0 24 24" aria-hidden="true">${ICONES[k]}</svg>`;
const bt = (mot, a, { cls = '', v = '', petit = '', off = false } = {}) => `<button type="button" class="rn-bt${cls ? ` ${cls}` : ''}" data-a="${a}"${v !== '' ? ` data-v="${esc(v)}"` : ''}${off ? ' disabled' : ''}>${mot}${petit ? `<small>${petit}</small>` : ''}</button>`;
const bas = (...boutons) => `<div class="rn-bas">${boutons.join('')}</div>`;
const logo = (t, n = 46) => getTeamLogoHtml(t, n);
/* « Bruins de Boston » : son surnom, sa ville. */
const surnom = t => String(TEAMFULL[t] || t).split(/ (?:de |du |des |d['’])/)[0];
const ville = t => String(TEAMFULL[t] || t).split(/ (?:de |du |des |d['’])/)[1] || surnom(t);
const clubMot = c => `${surnom(c.t)} ${c.s}`;
const clubCourt = c => `${surnom(c.t)} ${c.s.slice(2, 4)}-${c.s.slice(5)}`;
const court = p => String((p && p.n) || '').trim().split(' ').slice(-1)[0];
const jetons = n => `<span class="rn-jt"><i class="rn-piece"></i>${n}</span>`;
const jambes = ps => (ps.length ? Math.round(ps.reduce((a, p) => a + energieDe(p), 0) / ps.length) : 100);
const couleurs = (toi, eux) => `--toi:${getTeamBand(toi).bg};--eux:${getTeamBand(eux).bg === getTeamBand(toi).bg ? getTeamBand(eux).stripe : getTeamBand(eux).bg}`;
const carteJ = p => `<span class="rn-c rn-cj" style="${varsEquipe(p)}">${cartonDe(p, { rar: editionDe(p) })}</span>`;
const carteP = cle => `<span class="rn-c">${carteDePiece(cle, { lecture: true, statique: true })}</span>`;
const ligneDe = cle => { const P = PIECES[cle], l = lignesDeLaPiece(cle)[0]; return `${esc(P.quandMot)}${l ? ` : ${esc(l.txt.charAt(0).toLowerCase() + l.txt.slice(1))}` : ''}`; };
const icoDuBadge = (p, cle) => { const b = badgesDe(p).find(x => x.cle === cle); return b ? b.ico : ''; };
const icosDeLAccord = x => `${icoDuBadge(x.a, x.aff.a[1])}${icoDuBadge(x.b, x.aff.b[1])}`;
const badgeMot = p => { const b = badgesDe(p)[0]; return b ? `${b.ico} ${esc(b.nom)} ${PALIERS[b.palier].nom}` : ''; };
/* Le HUD : les cœurs dessinés, l'acte, tes points sur la cible, tes jetons, la pause. */
function hud(S, { titre = null, petit = '', cible = true, bourse = true, pause = true } = {}) {
  const R = S.R, enSerie = !!R.series;
  const nom = titre || (enSerie ? 'Les séries' : `Acte ${ROMAINS[R.acte]}`);
  const tenue = !enSerie && R.pts >= RUN.CIBLES[R.acte];
  return `<div class="rn-hud">
    <span class="rn-coeurs" role="img" aria-label="${R.coeurs} cœur${R.coeurs > 1 ? 's' : ''} sur ${RUN.COEURS}">${Array.from({ length: RUN.COEURS }, (_, i) => coeur(i < R.coeurs)).join('')}</span>
    <span class="rn-acte">${nom}${petit ? `<small>${petit}</small>` : ''}</span>
    ${cible && !enSerie ? `<span class="rn-cible${tenue ? ' rn-on' : ''}">${R.pts}<small>/ ${RUN.CIBLES[R.acte]} pts</small></span>` : ''}
    ${bourse ? `<span class="rn-jt${cible && !enSerie ? '' : ' rn-droite'}"><i class="rn-piece"></i>${R.jetons}</span>` : ''}
    ${pause ? '<button type="button" class="rn-pause" data-a="pause" aria-label="Pause"><i></i></button>' : ''}
  </div>`;
}
const banc = (S, { joue = null, libre = false, largeur = '' } = {}) => `<div class="rn-banc"${largeur ? ` style="width:${largeur}"` : ''}>${
  S.R.banc.map(k => `<span class="${joue ? (joue.includes(k) ? 'rn-joue' : 'rn-eteinte') : ''}">${carteP(k)}</span>`).join('')
}${Array.from({ length: CASES_DU_BANC - S.R.banc.length }, (_, i) => `<span class="rn-vide${libre && i === 0 ? ' rn-on' : ''}"></span>`).join('')}</div>`;
const plafond = (S, { neuf = 0, mort = 0 } = {}) => {
  const R = S.R, pc = x => `${Math.max(0, Math.min(100, (100 * x) / R.plafond)).toFixed(1)}%`;
  const base = masseDe(S) - neuf - mort;
  return `<div class="rn-plaf"><i style="width:${pc(base)}"></i>${neuf ? `<i class="rn-neuf" style="left:${pc(base)};width:${pc(neuf)}"></i>` : ''}${mort ? `<i class="rn-mort" style="left:${pc(base + neuf)};width:${pc(mort)}"></i>` : ''}</div>`;
};

/* ---------- l'attente, le départ ---------- */
export const sceneAttente = mot => `<div class="rn-attente"><i></i><span>${esc(mot)}</span></div>`;
/* Le départ : ton coach, un parmi trois (le loto d'aujourd'hui), sa règle, sa pièce de départ. */
export function sceneDepart(V) {
  const c = V.loto[V.coach], C = COACHS[c.cle], regle = REGLES_DU_COACH[c.cle], piece = PIECE_DU_COACH[c.cle], k = niveauDuCoach(c.rang) - 1;
  const carte = x => carteHtml({ cle: 'coach', niveau: niveauDuCoach(x.rang) - 1, genreCarte: 'synergie', ico: COACHS[x.cle].ico, nomHtml: esc(x.n), typeHtml: esc(clubMot({ t: x.tag, s: x.saison })),
    statique: true, lecture: true, style: varsCarton(getTeamBand(x.tag)) });
  return `<div style="left:14px;right:14px;top:22px"><div class="rn-k">Run ${V.numero} · les années ${V.decennie}</div><div class="rn-titre" style="margin-top:6px">Ton coach</div><div class="rn-t rn-gris" style="margin-top:4px">Un parmi trois. Il fait toute la run.</div></div>
  <div class="rn-pas" style="left:14px;right:14px;top:118px"><span class="rn-on">1 · Ton coach</span><span>2 · Le camp</span><span>3 · L'acte I</span></div>
  <div class="rn-loto" style="left:14px;right:14px;top:166px">${V.loto.map((x, i) => `<button type="button" class="${i === V.coach ? 'rn-on' : ''}" data-a="coach" data-v="${i}"><span class="rn-c">${carte(x)}</span><p><b>${esc(x.n)}</b>${esc(clubMot({ t: x.tag, s: x.saison }))}<br>${x.fiche.v}-${x.fiche.d}-${x.fiche.n}${x.coupe ? ' · la Coupe' : ''}</p></button>`).join('')}</div>
  <div class="rn-panneau rn-on" style="left:14px;right:14px;top:428px">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><b class="rn-h">${C.ico} ${esc(C.nom)}</b><span class="rn-puce rn-o">${esc(nomDuNiveau(k))}</span></div>
    <div class="rn-t rn-gris" style="margin-top:6px">${esc(motDuRang(c.cle, c.rang))}, cette saison-là.</div>
    ${regle ? `<div class="rn-t" style="margin-top:8px"><span class="rn-k">Sa règle</span><br>${esc(regle.dit.charAt(0).toUpperCase() + regle.dit.slice(1))} : <span class="rn-or">+${regle.jetons} jetons</span> le soir.</div>` : ''}
  </div>
  <div class="rn-panneau" style="left:14px;right:14px;top:560px;display:grid;grid-template-columns:70px 1fr;gap:12px;align-items:center">${carteP(piece)}
    <div class="rn-t"><span class="rn-k">Sa pièce de départ${NIVEAUX[k].maitrise !== 1 ? ` · ×${String(NIVEAUX[k].maitrise).replace('.', ',')}` : ''}</span><br><b>${esc(PIECES[piece].nom)}</b><br><span class="rn-gris">${ligneDe(piece)}</span></div></div>
  ${bas(bt('Menu', 'quitter'), bt(`Prendre ${esc(court({ n: c.n }))}`, 'prendre-coach', { cls: 'rn-go' }))}`;
}

/* ---------- la carte de l'acte ---------- */
const X_DES_CASES = { 2: [130, 260], 3: [70, 195, 320] }, Y_DES_RANGS = [578, 516, 454, 392, 330, 268, 206], Y_DU_RIVAL = 112;
const xy = (r, i) => (r >= RANG_DU_RIVAL ? [195, Y_DU_RIVAL] : [X_DES_CASES[S_LARGEURS[r]][i], Y_DES_RANGS[r]]);
const S_LARGEURS = [2, 3, 2, 3, 2, 3, 2];
const MOT_DU_JEU = { tirs: 'Tireurs', durs: 'Durs', gardien: 'Gardien' };
const SORTE_CLS = { marche: 'rn-marche', vestiaire: 'rn-vest', histoire: 'rn-hist', elite: 'rn-elite', rival: 'rn-rival' };
function styleDe(S, c) { if (!S.jeux) S.jeux = new Map(); const k = `${c.s}:${c.t}`; if (!S.jeux.has(k)) S.jeux.set(k, jeuDe(S, c)); return S.jeux.get(k); }
/* Ce qu'une case offre, dans le tiroir : qui, son jeu, ce que ça paie. */
function optionDe(S, c, i, on) {
  const tete = c.s ? `${logo(c.t, 30)}${esc(clubCourt(c))}` : `${icone(c.sorte)}${{ marche: 'Le marché', vestiaire: 'Le vestiaire', histoire: 'Une histoire' }[c.sorte]}`;
  const jeu = c.s ? styleDe(S, c) : null, lieu = c.visiteur ? 'chez eux' : 'chez toi';
  const mot = { match: () => `${jeu.mot} · ${lieu}`, elite: () => `Élite · ${jeu.mot}`, rival: () => `Le rival · il compte double · ${lieu}`,
    marche: () => 'Une pièce de banc, les pochettes', vestiaire: () => 'Te soigner, ou monter une carte', histoire: () => 'Quelqu\'un du club veut te parler' }[c.sorte]();
  const puces = { match: () => `<span class="rn-puce rn-o">${c.jetons} jetons</span><span class="rn-puce">${RUN.PORTES} portes</span>`,
    elite: () => '<span class="rn-puce rn-m">Une pièce</span><span class="rn-puce rn-o">Des jetons</span>',
    rival: () => `<span class="rn-puce rn-m">Une pièce</span><span class="rn-puce rn-o">${c.jetons} jetons</span>`,
    marche: () => `<span class="rn-puce rn-o">Pièce : ${PRIX_PIECE}</span>`, vestiaire: () => `<span class="rn-puce">${S.toi.injured.size} blessé${S.toi.injured.size > 1 ? 's' : ''}</span>`, histoire: () => '' }[c.sorte]();
  return `<button type="button" class="rn-opt${on ? ' rn-on' : ''}" data-a="voir-case" data-v="${i}"><b>${tete}</b><span>${esc(mot.charAt(0).toUpperCase() + mot.slice(1))}</span><i>${puces}</i></button>`;
}
export function sceneCarte(S, V) {
  const R = S.R, offertes = casesOffertes(S), vue = offertes.includes(V.caseVue) ? V.caseVue : offertes[0];
  const liens = [], pris = [], offerts = [];
  const trait = ([x0, y0], [x1, y1]) => `M${x0} ${y0}L${x1} ${y1}`;
  for (let r = 0; r < RANG_DU_RIVAL; r++) for (let i = 0; i < S_LARGEURS[r]; i++) {
    const vers = r === RANG_DU_RIVAL - 1 ? [[RANG_DU_RIVAL, 0]] : suivantes(r, i).map(k => [r + 1, k]);
    for (const [r2, k] of vers) {
      const d = trait(xy(r, i), xy(r2, k));
      if (R.chemin[r] === i && (R.chemin[r2] === k)) pris.push(d);
      else if (r === R.rang - 1 && R.chemin[r] === i && offertes.includes(k)) offerts.push(d);
      else liens.push(d);
    }
  }
  const noeud = (c, r, i) => {
    const [x, y] = xy(r, i), fait = r < R.rang, pris2 = fait && R.chemin[r] === i, offert = r === R.rang && offertes.includes(i);
    const cls = ['rn-noeud', SORTE_CLS[c.sorte] || '', pris2 ? 'rn-fait' : fait ? 'rn-saute' : '', offert && i === vue ? 'rn-choisi' : offert ? 'rn-offert' : ''].filter(Boolean).join(' ');
    const dedans = c.s ? logo(c.t, 32) : icone(c.sorte);
    const etq = c.sorte === 'rival' ? `<span class="rn-etq rn-rg" style="left:${x}px;top:${y + 48}px">Le rival · ${esc(clubMot(c))}</span>`
      : c.sorte === 'elite' ? `<span class="rn-etq" style="left:${x}px;top:${y + 34}px">Élite</span>`
        : c.sorte === 'match' && !fait ? `<span class="rn-etq" style="left:${x}px;top:${y + 28}px">${MOT_DU_JEU[styleDe(S, c).cle]}</span>` : '';
    return `<button type="button" class="${cls}" style="left:${x}px;top:${y}px"${offert ? ` data-a="voir-case" data-v="${i}"` : ' disabled'} aria-label="${esc(c.s ? clubMot(c) : c.sorte)}">${dedans}</button>${etq}`;
  };
  return `<svg class="rn-chemin" viewBox="0 0 390 844" aria-hidden="true"><path d="${liens.join('')}"/>${pris.length ? `<path class="rn-pris" d="${pris.join('')}"/>` : ''}${offerts.length ? `<path class="rn-offert" d="${offerts.join('')}"/>` : ''}</svg>
  ${hud(S, { petit: R.rang >= RANG_DU_RIVAL ? 'Le rival' : `Case ${R.rang + 1} de ${RANG_DU_RIVAL}` })}
  ${noeud(R.carte.rival, RANG_DU_RIVAL, 0)}${R.carte.rangs.map((rang, r) => rang.map((c, i) => noeud(c, r, i)).join('')).join('')}
  <div class="rn-tiroir"><div class="rn-k">Ta prochaine case${offertes.length > 1 ? ' · une des deux' : ''}</div>
    <div class="rn-deux">${offertes.map(i => optionDe(S, caseA(S, R.rang, i), i, i === vue)).join('')}</div>
    <div style="display:flex;gap:8px">${bt('Lignes', 'lignes')}${bt('Banc', 'banc')}${bt('Y aller', 'aller', { cls: 'rn-go', v: vue })}</div></div>`;
}

/* ---------- le rival annoncé ---------- */
const rangMot = n => `${n}<small>${n === 1 ? 'er' : 'e'}</small>`;
function sonJeuHtml(jeu) {
  return jeu.lignes.map(l => `<div class="rn-stat"><span${l.rangToi < l.rang ? ' class="rn-or"' : ''}>${rangMot(l.rangToi)}</span><div class="rn-bar"><i style="width:${Math.round(100 * l.toi)}%"></i></div><em>${esc(l.nom)}</em><div class="rn-bar rn-bd"><i style="width:${Math.round(100 * l.lui)}%"></i></div><span${l.rang <= l.rangToi ? ' class="rn-or"' : ''}>${rangMot(l.rang)}</span></div>`).join('');
}
const vedettesDe = club => { const ps = club.pool.filter(p => groupeDe(p) !== 'G').sort((a, b) => getHiddenRatings(b).v - getHiddenRatings(a).v); const g = club.pool.filter(p => groupeDe(p) === 'G')[0]; return [ps[0], g].filter(Boolean); };
const faitDe = p => (p.p === 'G' ? `${esc(court(p))} · ${pct3(p.sv || 0)}` : `${esc(court(p))} · ${p.pt ?? (p.g || 0) + (p.a || 0)} pts`);
export function sceneAnnonce(S) {
  const R = S.R, c = R.carte.rival, club = S.clubs.find(x => x.s === c.s && x.t === c.t), jeu = jeuDe(S, c), I = INTENTIONS[jeu.dominante];
  const surBanc = jeu.contre.filter(k => R.banc.includes(k)), aTrouver = jeu.contre.filter(k => !R.banc.includes(k)).slice(0, 2 - Math.min(2, surBanc.length));
  return `${hud(S, { petit: 'Le rival' })}
  <div class="rn-lui"><div class="rn-sous">Au bout de l'acte ${ROMAINS[R.acte]}</div>${logo(c.t, 120)}<div class="rn-gros">${esc(surnom(c.t))}<br>${c.s}</div></div>
  <div class="rn-vs" style="left:14px;top:196px">VS</div>
  <div class="rn-panneau" style="left:14px;right:14px;top:330px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="rn-k">Son jeu · son rang</span>${I ? `<span class="rn-puce rn-r">${I.ico} ${esc(I.nom)}</span>` : ''}</div>
    <div class="rn-stat rn-gris"><span>Toi</span><span></span><span></span><span></span><span>Lui</span></div>${sonJeuHtml(jeu)}</div>
  <div style="left:14px;top:486px;display:flex;gap:8px;align-items:flex-end">${vedettesDe(club).map(p => `<div style="width:86px">${carteJ(p)}</div>`).join('')}
    <div style="padding-bottom:6px"><div class="rn-k" style="margin-bottom:6px">Ses vedettes</div><div class="rn-h">${vedettesDe(club).map(faitDe).join('<br>')}</div></div></div>
  <div style="left:14px;right:14px;top:626px"><div class="rn-k" style="margin-bottom:8px">Pour le battre</div>
    <div style="display:grid;grid-template-columns:${[...surBanc, ...aTrouver].map(() => '74px').join(' ')} 1fr;gap:10px;align-items:center">
      ${surBanc.slice(0, 2).map(k => `<div>${carteP(k)}</div>`).join('')}${aTrouver.map(k => `<div class="rn-atrouver">${carteP(k)}<b>À trouver</b></div>`).join('')}
      <div class="rn-t rn-gris">${surBanc.length ? `<span class="rn-vert">${esc(PIECES[surBanc[0]].nom)}</span> est sur ton banc. ` : ''}${aTrouver.length ? `${esc(PIECES[aTrouver[0]].nom)} est à trouver. ` : ''}Son match compte double.</div></div></div>
  ${bas(bt('Voir la carte de l\'acte', 'vers-carte', { cls: 'rn-combat' }))}`;
}

/* ---------- la feuille du soir ---------- */
const lignesDuClub = t => {
  const L = activeLineup(t), de = (g, u) => SLOTS.filter(s => !s.scratch && s.group === g && s.unit === u).map(s => L[s.i]).filter(Boolean);
  return { trios: [0, 1, 2, 3].map(u => de('F', u)), paires: [0, 1, 2].map(u => de('D', u)), gardien: de('G', 0)[0] || null };
};
const noms = ps => ps.map(p => esc(court(p))).join(' · ');
function enjeuHtml(S) {
  const c = S.R.case;
  if (c.sorte === 'serie') return '';
  const gagne = { match: `2 points · ${c.jetons} jetons<br>${c.haute ? 'Des portes plus hautes' : `${RUN.PORTES} portes`}`, rival: `4 points · ${c.jetons} jetons<br>Une pièce parmi trois`, elite: `2 points · ${c.J != null ? `${c.J} jetons` : 'des jetons'}<br>Une pièce parmi trois` }[c.sorte];
  const perdu = { match: '1 point en prolongation<br>Des portes, une relance', rival: '2 points en prolongation<br>Aucun cœur de plus', elite: `Sonnés 5 matchs<br>${c.J != null ? `${Math.round(c.J / 2)} jetons de moins` : 'des jetons de moins'}` }[c.sorte];
  return `<div class="rn-enjeu" style="left:14px;right:14px;top:${c.sorte === 'match' ? 664 : 556}px"><div><b class="rn-vert">Gagné</b>${gagne}</div><div><b class="rn-rg">Perdu</b>${perdu}</div></div>`;
}
const jaugeHtml = (V, toi, eux) => {
  const pc = V.chance ? Math.round((100 * V.chance.v) / V.chance.n) : null;
  return `<div class="rn-jauge" style="${couleurs(toi, eux)}"><span>${pc == null ? '…' : `${pc} %`}</span><div><i style="width:${pc == null ? 50 : pc}%"></i></div><span>${pc == null ? '…' : `${100 - pc} %`}</span></div>`;
};
export function sceneFeuille(S, V) {
  const R = S.R, c = R.case, club = S.clubs.find(x => x.s === c.s && x.t === c.t), duel = c.sorte !== 'match';
  const jeu = styleDe(S, c), eux = lignesDuClub(club.team), moi = lignesDuClub(S.toi), vedette = vedettesDe(club)[0];
  const lieu = c.visiteur ? 'chez eux' : 'chez toi';
  const sous = { match: `${jeu.mot} · ${lieu}`, rival: `Le rival · il compte double · ${lieu}`, elite: `Élite · ${jeu.mot} · ${lieu}`, serie: `Match ${R.series ? R.series.w + R.series.l + 1 : 1} · ${lieu}` }[c.sorte];
  const petit = { match: `Case ${R.rang + 1} de ${RANG_DU_RIVAL}`, rival: 'Le rival', elite: 'L\'élite', serie: ['Quart de finale', 'Demi-finale', 'La finale'][R.series ? R.series.ronde : 0] }[c.sorte];
  const filet = SLOTS.filter(s => s.group === 'G' && !s.scratch).map(s => S.roster[s.i]).filter(Boolean), aux = S.toi._filetMatch === 'aux';
  const civil = [...S.toi.injured].map(([p, m]) => `<span class="rn-puce rn-r">${esc(court(p))} · blessé, ${m} match${m > 1 ? 's' : ''}</span>`);
  if (!duel) {
    const trio = (ps, u) => { const acc = accordsDe(S, u), j = jambes(ps); return `<div class="rn-trio"><b>${u + 1}</b><span>${noms(ps)}</span><em>${acc.length ? `${icosDeLAccord(acc[0])}${acc.length > 1 ? ` +${acc.length - 1}` : ''}` : 'Aucun'}</em><div class="rn-jb${j < 70 ? ' rn-use' : ''}"><i style="width:${j}%"></i></div></div>`; };
    return `${hud(S, { petit })}
    <div class="rn-plaque" style="left:14px;top:60px">${logo(c.t)}<div class="rn-nom">${esc(clubMot(c))}<small>${esc(sous.charAt(0).toUpperCase() + sous.slice(1))}</small></div></div>
    <div class="rn-panneau rn-leurs" style="left:14px;right:14px;top:114px">${carteJ(vedette)}<div class="rn-lignes">
      ${eux.trios.map((ps, u) => `<div${ps.includes(vedette) ? ' class="rn-etoile"' : ''}><b>${ord(u + 1)}</b><span>${noms(ps)}</span></div>`).join('')}
      ${eux.paires.slice(0, 2).map(ps => `<div${ps.includes(vedette) ? ' class="rn-etoile"' : ''}><b>D</b><span>${noms(ps)}</span></div>`).join('')}
      ${eux.gardien ? `<div><b>G</b><span>${esc(court(eux.gardien))} · ${pct3(eux.gardien.sv || 0)}</span></div>` : ''}</div></div>
    <div style="left:14px;right:14px;top:276px"><div class="rn-k" style="margin-bottom:6px">Ta chance</div>${jaugeHtml(V, 'YOU', c.t)}</div>
    <div class="rn-panneau" style="left:14px;right:14px;top:330px"><div class="rn-k" style="margin-bottom:2px">Tes lignes · leurs accords · leurs jambes</div>
      ${moi.trios.map(trio).join('')}
      <div class="rn-trio"><b>D</b><span>${noms(moi.paires.flat().slice(0, 2))} · ${Math.max(0, moi.paires.flat().length - 2)} autres</span><em></em><div class="rn-jb"><i style="width:${jambes(moi.paires.flat())}%"></i></div></div></div>
    <div style="left:14px;right:14px;top:566px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="rn-panneau"><div class="rn-k" style="margin-bottom:8px">Devant le filet</div><div class="rn-filet">${filet.map((g, i) => `<button type="button" class="${(i === 1) === aux ? 'rn-on' : ''}" data-a="filet" data-v="${i === 1 ? 'aux' : 'partant'}">${esc(court(g))}<br>${Math.round(energieDe(g))}</button>`).join('')}</div></div>
      <div class="rn-panneau"><div class="rn-k" style="margin-bottom:8px">En civil</div>${civil.slice(0, 2).join(' ') || '<span class="rn-puce">Aucun blessé</span>'}</div></div>
    ${enjeuHtml(S)}
    ${bas(bt('Lignes', 'lignes'), bt('Au match', 'jouer', { cls: 'rn-go' }))}`;
  }
  // Le duel (le rival, l'élite, les séries) : leur intention, ton plan, un seul choix.
  const I = V.intention && INTENTIONS[V.intention.cle], plans = V.plans || [];
  const lignesDuPlan = x => { const l = motsDeStats(x.stats, 2); const repond = V.intention && (PLANS[x.cle].repond || []).includes(V.intention.cle); return `${l.map(m => `<span class="${m.bon ? 'rn-vert' : m.bon === false ? 'rn-rg' : 'rn-gris'}">${esc(m.txt)}</span>`).join('<br>')}${repond ? '<br><span class="rn-or">Répond à leur jeu</span>' : ''}`; };
  return `${hud(S, { petit })}
  <div class="rn-plaque" style="left:14px;top:62px">${logo(c.t, 58)}<div class="rn-nom">${esc(clubMot(c))}<small>${esc(sous.charAt(0).toUpperCase() + sous.slice(1))}</small></div></div>
  <div style="left:14px;right:14px;top:134px;display:flex;justify-content:space-between;align-items:center">${I ? `<span class="rn-puce rn-r">${I.ico} ${esc(I.nom)}</span>` : '<span></span>'}<span class="rn-puce">${esc(jeu.mot.charAt(0).toUpperCase() + jeu.mot.slice(1))}</span>${eux.gardien ? `<span class="rn-puce">${esc(court(eux.gardien))} · ${pct3(eux.gardien.sv || 0)}</span>` : ''}</div>
  <div style="left:14px;right:14px;top:172px">${jaugeHtml(V, 'YOU', c.t)}</div>
  <div style="left:14px;right:14px;top:214px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><span class="rn-k">Ton plan · un seul choix</span><span class="rn-t rn-gris">Proposé par ton banc</span></div>
    <div class="rn-plans">${plans.map((x, i) => `<button type="button" class="${V.plan === i ? 'rn-on' : ''}" data-a="plan" data-v="${i}"><span class="rn-c">${carteHtml({ cle: x.cle, niveau: x.qui.genre === 'coach' ? 1 : 2, genreCarte: 'tactique', ico: PLANS[x.cle].ico, nomHtml: esc(PLANS[x.cle].nom), typeHtml: 'Plan', lecture: true, statique: true })}</span><p>${lignesDuPlan(x)}</p></button>`).join('')}</div></div>
  <button type="button" class="rn-bt${V.plan == null ? ' rn-on' : ''}" data-a="plan" data-v="-1" style="left:14px;right:14px;top:498px;height:44px">Ton match · aucun plan</button>
  ${enjeuHtml(S)}
  <div style="left:14px;right:14px;top:${c.sorte === 'serie' ? 566 : 650}px"><div class="rn-k" style="margin-bottom:6px">Ton banc</div>${banc(S, { largeur: '300px' })}</div>
  ${bas(bt('Lignes', 'lignes'), bt('Au combat', 'jouer', { cls: 'rn-combat' }))}`;
}

/* ---------- le match, en temps forts ---------- */
const GLACE = `<rect class="rn-fond" x="3" y="3" width="356" height="354" rx="70"/><path class="rn-lb" d="M3 118h356M3 242h356"/><path class="rn-lr" style="stroke-width:5" d="M3 180h356"/><path class="rn-lr" d="M40 34h282M40 326h282"/>
  <circle class="rn-lb" style="stroke-width:2.5" cx="181" cy="180" r="34"/><g class="rn-lr"><circle cx="96" cy="76" r="30"/><circle cx="266" cy="76" r="30"/><circle cx="96" cy="284" r="30"/><circle cx="266" cy="284" r="30"/></g>`;
/* La minute d'un instant de la feuille, dans sa période : « 12:40 de la 2e ». */
export const minuteDe = t => { const per = periodeDe(t), dans = t - 20 * (per - 1), m = Math.floor(dans), s = Math.floor((dans - m) * 60); return `${m}:${String(s).padStart(2, '0')} ${per > 3 ? 'de la prolongation' : `de la ${per === 1 ? '1re' : `${per}e`}`}`; };
export function sceneMatch(S, V) {
  const M = V.match, c = S.R.case, e = M.evts[M.i] || null, per = e ? Math.min(3, periodeDe(e.t)) : 1, fini = M.i >= M.evts.length - 1;
  const vus = M.evts.slice(0, M.i + 1), buts = vus.filter(x => x.type === 'but');
  // Le pointage : les buts vus jusqu'ici ; à la fin, celui de la feuille (le but des tirs de barrage compris).
  const score = fini ? [M.res.gf, M.res.ga] : buts.reduce((a, x) => { a[x.moi ? 0 : 1]++; return a; }, [0, 0]);
  const tirs = e ? e.tirs : [0, 0];
  const haut = e && e.moi ? 30 : 330, cote = e && e.moi ? 1 : -1;
  const x0 = e ? 90 + Math.round(180 * e.h) : 181, y0 = e ? 180 - cote * (40 + Math.round(70 * e.h2)) : 180;
  const dessin = e && (e.type === 'but' || e.type === 'arret') ? `<path class="rn-tir" d="M${x0} ${y0}L${181} ${haut + cote * 12}"/><circle class="rn-tireur" cx="${x0}" cy="${y0}" r="11"${e.moi ? '' : ' style="fill:var(--eux)"'}/><circle class="rn-gardien" cx="181" cy="${haut}" r="9"${e.moi ? '' : ' style="fill:var(--toi)"'}/>` : '';
  const mot = !e ? '' : e.type === 'but' ? (e.moi ? 'But !' : 'But contre') : e.type === 'arret' ? 'Arrêt !' : e.type === 'punition' ? 'Punition' : e.type === 'barrage' ? 'Tirs de barrage' : '';
  const legende = !e ? '' : e.type === 'but' ? `<b>${esc(court(e.qui))} · ${score[0]}-${score[1]}</b><small>${e.passeurs.length ? `${e.passeurs.map(p => esc(court(p))).join(', ')} · ` : 'Sans aide · '}${minuteDe(e.t)}${e.an ? ' · en avantage' : ''}</small>`
    : e.type === 'arret' ? `<b>${esc(court(e.gardien))} dit non</b><small>Contre ${esc(court(e.qui))} · ${minuteDe(e.t)}</small>`
      : e.type === 'punition' ? `<b>${esc(court(e.qui))} au cachot</b><small>${e.moi ? 'Ton club à court d\'un homme' : 'Tu joues en avantage'} · ${minuteDe(e.t)}</small>`
        : `<b>${e.moi ? 'Gagnés' : 'Perdus'}</b><small>Les tirs de barrage tranchent</small>`;
  const marques = k => buts.filter(x => Math.min(3, periodeDe(x.t)) === k).map(x => `<i class="${x.moi ? '' : 'rn-eux'}" style="left:${Math.min(96, Math.round(5 * (x.t - 20 * (k - 1))))}%"></i>`).join('');
  return `<div class="rn-score" style="${couleurs('YOU', c.t)}"><div class="rn-eq">${logo('YOU', 44)}Toi</div><div class="rn-pointage">${score[0]} · ${score[1]}<small>${fini ? 'Final' : e ? `${per === 1 ? '1re' : `${per}e`} · tirs ${tirs[0]}-${tirs[1]}` : 'La mise au jeu'}</small></div><div class="rn-eq">${esc(ville(c.t))}${logo(c.t, 44)}</div></div>
  <svg class="rn-glace" viewBox="0 0 362 360" aria-hidden="true" style="${couleurs('YOU', c.t)}">${GLACE}${dessin}</svg>
  ${mot ? `<div class="rn-but${e.moi === (e.type !== 'punition') ? '' : ' rn-eux'}" style="top:330px">${mot}</div>` : ''}
  ${e ? `<div class="rn-buteur" style="left:14px;right:14px;top:452px">${e.qui ? `<span>${carteJ(e.qui)}</span>` : ''}<div>${legende}</div></div>` : ''}
  <div class="rn-fil" style="left:14px;right:14px;top:546px">${[1, 2, 3].map(k => `<div>${k === 1 ? '1re' : `${k}e`}${marques(k)}${e && per === k && !fini ? `<u style="left:${Math.min(98, Math.round(5 * (e.t - 20 * (k - 1))))}%"></u>` : ''}</div>`).join('')}</div>
  <div style="left:14px;right:14px;top:588px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><span class="rn-k">Ton banc</span><span class="rn-t rn-vert">${M.pieces.length ? `${M.pieces.length} pièce${M.pieces.length > 1 ? 's jouent' : ' joue'} ce soir` : 'Aucune pièce ce soir'}</span></div>${banc(S, { joue: M.pieces })}
    <div class="rn-t" style="margin-top:10px">${M.pieces.slice(0, 2).map(k => `<span class="rn-vert">${esc(PIECES[k].nom)}</span>${lignesDeLaPiece(k)[0] ? ` <span class="rn-gris">· ${esc(lignesDeLaPiece(k)[0].txt)}</span>` : ''}`).join('<br>')}</div></div>
  ${bas(bt(`Vitesse ×${V.vitesse}`, 'vitesse', { off: fini }), bt(fini ? 'Continuer' : 'À la fin', fini ? 'apres-match' : 'fin-du-match', { cls: 'rn-go' }))}`;
}

/* ---------- les portes, la porte ouverte, l'échange ---------- */
const bandeDuMatch = S => {
  const a = S.R.apres;
  if (!a) return '';
  const gain = [a.pts ? `<span class="rn-vert">+${a.pts} point${a.pts > 1 ? 's' : ''}</span>` : '', a.jetons > 0 ? `<span class="rn-or">+${a.jetons + a.prime} jetons</span>` : a.jetons < 0 ? `<span class="rn-rg">${a.jetons} jetons</span>` : '', a.etoile ? `${esc(court(a.etoile))} ${a.etoile.buts} buts` : ''].filter(Boolean).join(' · ');
  return `<div class="rn-panneau" style="left:14px;right:14px;top:60px;display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center"><div class="rn-titre ${a.gagne ? 'rn-vert' : 'rn-rg'}">${a.gf}-${a.ga}</div>
    <div class="rn-t"><b>${a.gagne ? 'Gagné' : a.ot ? 'Perdu en prolongation' : 'Perdu'} ${a.visiteur ? `à ${esc(ville(a.t))}` : `contre ${esc(surnom(a.t))}`}</b><br>${gain || 'Aucun point'}${a.pieces.length ? `<br><span class="rn-gris">Ont joué : ${a.pieces.map(k => esc(PIECES[k].nom.toLowerCase())).join(', ')}</span>` : ''}</div></div>`;
};
export function scenePortes(S) {
  const R = S.R, P = R.portes, camp = R.phase === 'camp';
  const portes = P.clubs.map((c, i) => { const n = vestiaireDe(S, c).filter(x => x.tient).length; return `<button type="button" class="rn-porte" data-a="ouvrir-porte" data-v="${i}">${P.affronte === `${c.s}:${c.t}` ? '<span class="rn-tag">Le club affronté</span>' : ''}${logo(c.t, 66)}<b>${esc(surnom(c.t))}<small>${c.s}</small></b><strong>${n}<small>dans ton espace</small></strong></button>`; }).join('');
  return `${camp ? hud(S, { titre: 'Le camp', petit: `Porte ${R.camp + 1} de ${RUN.CAMP}`, cible: false }) : hud(S, { petit: R.case && R.case.sorte === 'rival' ? 'Le rival' : `Case ${R.rang + 1} de ${RANG_DU_RIVAL}` })}
  ${camp ? `<div class="rn-panneau" style="left:14px;right:14px;top:60px"><div class="rn-t"><b>Avant la première case</b><br><span class="rn-gris">Trois fois trois portes : trois joueurs signés, ou passés.</span></div></div>` : bandeDuMatch(S)}
  <div style="left:14px;right:14px;top:166px;text-align:center"><div class="rn-k">${R.apres && R.apres.gagne && !camp ? 'Gagné : des vestiaires à ta mesure' : 'Trois vrais vestiaires'}</div><div class="rn-h" style="margin-top:6px">Un joueur, dans un de ces vestiaires</div></div>
  <div class="rn-portes" style="left:14px;right:14px;top:254px">${portes}</div>
  <div class="rn-panneau" style="left:14px;right:14px;top:596px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><span class="rn-k">Ton plafond</span><span class="rn-t">${money(masseDe(S))} <span class="rn-gris">/ ${money(R.plafond)}</span> · <span class="rn-or">Espace ${money(espaceDe(S))}</span></span></div>${plafond(S)}</div>
  ${bas(bt('Passer', 'passer', { petit: `+${RUN.PASSER} jetons` }), bt('Relance', 'relancer', { petit: R.relances ? `Il t'en reste ${R.relances}` : 'Après une défaite', off: !R.relances || camp }))}`;
}
/* Ce qu'un joueur allumerait chez toi : le premier accord neuf, à la place de qui sortirait. */
function accordQuIlAllume(S, p) {
  const g = groupeDe(p);
  if (g === 'G') return null;
  for (const s of SLOTS.filter(x => !x.scratch && !x.extra && x.group === g)) {
    const essai = { ...S.roster, [s.i]: p }, u = g === 'F' ? s.unit : Math.min(2, s.unit);
    const avant = new Set(accordsDe(S, u).map(x => x.aff.cle));
    const neuf = accordsDe({ roster: essai }, u).find(x => !avant.has(x.aff.cle) && (x.a === p || x.b === p));
    if (neuf) return { ...neuf, i: s.i };
  }
  return null;
}
const PAR_PAGE = 5;
export function scenePorte(S, V) {
  const R = S.R, P = R.portes, c = P.pochette ? null : P.clubs[V.porte];
  const tous = vestiaireDe(S, c), dedans = tous.filter(x => x.tient), hors = tous.filter(x => !x.tient);
  const pages = Math.max(1, Math.ceil(dedans.length / PAR_PAGE)), page = Math.min(V.page || 0, pages - 1), vus = dedans.slice(page * PAR_PAGE, (page + 1) * PAR_PAGE);
  const choisi = dedans.find(x => getPlayerKey(x.p) === V.joueur) || vus[0] || null, acc = choisi ? accordQuIlAllume(S, choisi.p) : null;
  const tuile = x => { const a = accordQuIlAllume(S, x.p); return `<button type="button" class="${choisi === x ? 'rn-on' : ''}" data-a="voir-joueur" data-v="${getPlayerKey(x.p)}">${carteJ(x.p)}${a ? `<span class="rn-coin">${icosDeLAccord(a)}</span>` : ''}<span class="rn-sousc">${money(prixDe(S, x.p))}<small>${a ? esc(a.aff.nom) : ''}</small></span></button>`; };
  const reste = dedans.length - vus.length;
  const vraie = p => (p.p === 'G' ? `${p.w || 0} victoires, ${pct3(p.sv || 0)} d'efficacité en ${p.gp} matchs` : `${p.g || 0} buts, ${p.pt ?? (p.g || 0) + (p.a || 0)} points en ${p.gp} matchs`);
  return `${hud(S, R.phase === 'camp' ? { titre: 'Le camp', petit: `Porte ${R.camp + 1} de ${RUN.CAMP}`, cible: false } : {})}
  <div class="rn-plaque" style="left:14px;top:60px">${c ? logo(c.t) : ''}<div class="rn-nom">${c ? esc(clubMot(c)) : 'Ta pochette'}<small>${dedans.length} tien${dedans.length > 1 ? 'nent' : 't'} dans ton espace · ${money(espaceDe(S))}</small></div></div>
  <div class="rn-grille" style="left:22px;right:22px;top:122px">${vus.map(tuile).join('')}${reste > 0 || hors.length ? `<span>${reste > 0 ? `<button type="button" class="rn-plie" data-a="page-porte">${reste} autres<br>dans ton<br>espace</button>` : '<span class="rn-plie">Rien<br>d\'autre</span>'}${hors[0] ? `<span class="rn-sousc rn-gris"><small class="rn-gris">${esc(court(hors[0].p))}, ${money(prixDe(S, hors[0].p))} : hors de ton espace</small></span>` : ''}</span>` : ''}</div>
  ${choisi ? `<div class="rn-panneau" style="left:14px;right:14px;top:584px"><div style="display:flex;justify-content:space-between;align-items:baseline"><b class="rn-h">${esc(choisi.p.n)}</b><span class="rn-h rn-or">${money(prixDe(S, choisi.p))}</span></div>
    <div class="rn-t rn-gris" style="margin-top:6px">Cette année-là : ${vraie(choisi.p)}.<br>${badgeMot(choisi.p)}${acc ? ` · il allume <span class="rn-vert">${esc(acc.aff.nom.charAt(0).toLowerCase() + acc.aff.nom.slice(1))}</span>` : ''}</div></div>` : '<div class="rn-panneau" style="left:14px;right:14px;top:584px"><div class="rn-t rn-gris">Personne ici ne tient dans ton espace. Passer paie toujours.</div></div>'}
  ${bas(bt('Retour', 'fermer-porte'), bt('Voir l\'échange', 'vers-echange', { cls: 'rn-go', v: choisi ? getPlayerKey(choisi.p) : '', off: !choisi }))}`;
}
const statsDuJoueur = p => (p.p === 'G' ? [['Victoires', p.w || 0, x => x], ['% d\'arrêts', p.sv || 0, pct3], ['Matchs', p.gp || 0, x => x]]
  : [['Points / match', (p.pt ?? (p.g || 0) + (p.a || 0)) / Math.max(1, p.gp), x => x.toFixed(2).replace('.', ',')], ['Tirs / match', (p.sh || 0) / Math.max(1, p.gp), x => x.toFixed(1).replace('.', ',')], ['% au tir', p.sh ? (100 * (p.g || 0)) / p.sh : 0, x => `${x.toFixed(1).replace('.', ',')} %`]]);
export function sceneEchange(S, V) {
  const R = S.R, p = V.arrivant, sortants = sortantsPour(S, p).sort((a, b) => getHiddenRatings(a).v - getHiddenRatings(b).v);
  const sortant = sortants.find(x => getPlayerKey(x) === V.sortant) || sortants.find(x => masseApres(S, p, x) <= R.plafond) || sortants[0];
  const apres = masseApres(S, p, sortant), ok = apres <= R.plafond, reste = (1 - RUN.RACHAT) * prixDe(S, sortant);
  const A = statsDuJoueur(p), B = statsDuJoueur(sortant);
  const cas = SLOTS.find(s => S.roster[s.i] === sortant), ou = cas.scratch ? 'en civil' : cas.group === 'G' ? cas.role.toLowerCase() : `${ord(cas.unit + 1)} ${cas.group === 'F' ? 'trio' : 'paire'}`;
  return `${hud(S, { titre: 'Signer', petit: esc(ou), cible: false })}
  <div class="rn-face" style="left:14px;right:14px;top:62px"><span><b class="rn-vert">Il arrive</b>${carteJ(p)}</span><i>›‹</i><span><b class="rn-rg">Il sort</b>${carteJ(sortant)}</span></div>
  <div class="rn-panneau rn-cmp" style="left:14px;right:14px;top:276px">${A.map(([nom, a, dire], i) => `<span${a > B[i][1] ? ' class="rn-mieux"' : ''}>${dire(a)}</span><em>${nom}</em><span${B[i][1] > a ? ' class="rn-mieux"' : ''}>${dire(B[i][1])}</span>`).join('')}
    <span${prixDe(S, p) < prixDe(S, sortant) ? ' class="rn-mieux"' : ''}>${money(prixDe(S, p))}</span><em>Salaire</em><span${prixDe(S, sortant) < prixDe(S, p) ? ' class="rn-mieux"' : ''}>${money(prixDe(S, sortant))}</span></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:408px"><div class="rn-k" style="margin-bottom:8px">Qui sort · touche un joueur</div>
    <div class="rn-sortants">${sortants.slice(0, 14).map(x => `<button type="button" class="${x === sortant ? 'rn-on' : masseApres(S, p, x) > R.plafond ? 'rn-non' : ''}" data-a="sortant" data-v="${getPlayerKey(x)}" aria-label="${esc(x.n)}">${carteJ(x)}</button>`).join('')}</div></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:${sortants.length > 7 ? 600 : 530}px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><span class="rn-k">Ton plafond</span><span class="rn-t${ok ? '' : ' rn-rg'}">${money(apres)} <span class="rn-gris">/ ${money(R.plafond)}</span></span></div>
    ${ok ? plafondApres(S, p, sortant) : plafond(S)}
    <div class="rn-t rn-gris" style="margin-top:8px">${esc(court(p))} : <span class="rn-or">+${money(prixDe(S, p))}</span>. ${esc(court(sortant))} sort : <span class="rn-rg">${money(reste)} restent à ton plafond</span> pour la run.${ok ? '' : ' <span class="rn-rg">Ça ne passe pas.</span>'}</div></div>
  ${bas(bt('Retour', 'fermer-echange'), bt('Signer', 'signer', { cls: 'rn-orb', off: !ok, v: getPlayerKey(sortant) }))}`;
}
function plafondApres(S, p, sortant) {
  const R = S.R, pc = x => `${Math.max(0, Math.min(100, (100 * x) / R.plafond)).toFixed(1)}%`;
  const base = masseDe(S) - prixDe(S, sortant), neuf = prixDe(S, p), mort = (1 - RUN.RACHAT) * prixDe(S, sortant);
  return `<div class="rn-plaf"><i style="width:${pc(base)}"></i><i class="rn-neuf" style="left:${pc(base)};width:${pc(neuf)}"></i><i class="rn-mort" style="left:${pc(base + neuf)};width:${pc(mort)}"></i></div>`;
}

/* ---------- les Lignes, le banc ---------- */
export function sceneLignes(S, V) {
  const seg = V.seg || 'F', tenu = V.tenu, pTenu = tenu != null ? S.roster[tenu] : null;
  const cas = (s, large) => {
    const p = S.roster[s.i];
    if (!p) return '<span class="rn-vide"></span>';
    const si = tenu != null && tenu !== s.i ? siTenu(S, tenu, s.i) : null;
    const dessus = tenu === s.i ? '' : si ? `<span class="rn-ici${si.plus.length ? '' : ' rn-non'}"><span>${si.plus.length ? `+ ${si.plus.length} accord${si.plus.length > 1 ? 's' : ''}` : 'Rien'}</span></span>` : '';
    return `<button type="button" class="rn-cs${tenu === s.i ? ' rn-leve' : ''}" data-a="case" data-v="${s.i}"${large ? ` style="width:${large}px"` : ''} aria-label="${esc(p.n)}">${carteJ(p)}${dessus}</button>`;
  };
  const cote = (u, ps) => { const acc = accordsDe(S, u), j = jambes(ps.filter(Boolean)); return `<div class="rn-cote"><b>${acc[0] ? icosDeLAccord(acc[0]) : ''}</b>${acc[0] ? `${esc(acc[0].aff.nom)}${acc.length > 1 ? ` +${acc.length - 1}` : ''}` : 'Aucun accord'}<strong class="${j < 70 ? 'rn-use' : ''}">${j}</strong></div>`; };
  const de = (g, u) => SLOTS.filter(s => !s.scratch && !s.extra && s.group === g && s.unit === u);
  const corps = seg === 'F' ? [0, 1, 2, 3].map(u => `<div class="rn-ligne"><b>${ord(u + 1)}</b>${de('F', u).map(s => cas(s)).join('')}${cote(u, de('F', u).map(s => S.roster[s.i]))}</div>`).join('')
    : seg === 'D' ? [0, 1, 2].map(u => `<div class="rn-ligne" style="grid-template-columns:18px repeat(2,84px) 1fr"><b>${u + 1}re</b>${de('D', u).map(s => cas(s)).join('')}${cote(u, de('D', u).map(s => S.roster[s.i]))}</div>`).join('')
      : `<div class="rn-k" style="margin-bottom:8px">Devant le filet</div><div class="rn-ligne" style="grid-template-columns:repeat(2,84px) 1fr">${de('G', 0).concat(de('G', 1)).map(s => cas(s)).join('')}<span></span></div>
         <div class="rn-k" style="margin:14px 0 8px">En civil</div><div class="rn-ligne" style="grid-template-columns:repeat(3,84px)">${SLOTS.filter(s => s.scratch && !s.extra).map(s => cas(s)).join('')}</div>
         ${S.toi.injured.size ? `<div class="rn-t rn-rg" style="margin-top:10px">${[...S.toi.injured].map(([p, m]) => `${esc(court(p))} : blessé, ${m} match${m > 1 ? 's' : ''}`).join(' · ')}</div>` : ''}`;
  return `${hud(S, { titre: 'Tes lignes', cible: false, bourse: false, pause: false })}
  <div class="rn-seg" style="left:14px;right:14px;top:54px">${[['F', 'Attaque'], ['D', 'Défense'], ['G', 'Filet · civil']].map(([k, mot]) => `<button type="button" class="${seg === k ? 'rn-on' : ''}" data-a="seg" data-v="${k}">${mot}</button>`).join('')}</div>
  <div style="left:14px;right:14px;top:108px">${corps}</div>
  <div class="rn-panneau${pTenu ? ' rn-on' : ''}" style="left:14px;right:14px;bottom:80px;display:grid;grid-template-columns:${pTenu ? '50px ' : ''}1fr;gap:10px;align-items:center;padding:8px 10px">
    ${pTenu ? `<span>${carteJ(pTenu)}</span><div class="rn-t"><b>Tu tiens ${esc(court(pTenu))}</b> · ${badgeMot(pTenu)}<br><span class="rn-gris">Chaque case dit ce qu'il y allumerait. Touche une case pour échanger.</span></div>` : '<div class="rn-t rn-gris">Touche une carte pour la tenir, puis la case où elle va. Tes trios se rangent du plus fort au moins fort.</div>'}</div>
  ${bas(pTenu ? bt('Lâcher', 'case', { v: tenu }) : '', bt('Retour', 'fermer-lignes', { cls: 'rn-go' }))}`;
}
export function sceneBanc(S) {
  const R = S.R, C = COACHS[R.coach.cle], regle = REGLES_DU_COACH[R.coach.cle];
  return `${hud(S, { titre: 'Ton banc', cible: false, pause: false })}
  <div class="rn-panneau" style="left:14px;right:14px;top:60px"><b class="rn-h">${C.ico} ${esc(R.coach.n || C.nom)}</b>
    <div class="rn-t rn-gris" style="margin-top:6px">${esc(C.nom)}${regle ? ` · ${esc(regle.dit)} : <span class="rn-or">+${regle.jetons} jetons</span> le soir` : ''}</div></div>
  <div style="left:14px;right:14px;top:150px;display:flex;flex-direction:column;gap:8px">${R.banc.map(k => `<div class="rn-panneau" style="display:grid;grid-template-columns:62px 1fr;gap:12px;align-items:center;padding:8px 10px">${carteP(k)}<div class="rn-t"><b>${esc(PIECES[k].nom)}</b><br><span class="rn-gris">${ligneDe(k)}</span></div></div>`).join('')}
    ${R.banc.length < CASES_DU_BANC ? `<div class="rn-t rn-gris" style="text-align:center;padding:10px">${CASES_DU_BANC - R.banc.length} case${CASES_DU_BANC - R.banc.length > 1 ? 's libres' : ' libre'} : un rival battu, une élite, le marché.</div>` : ''}</div>
  ${bas(bt('Retour', 'fermer-banc', { cls: 'rn-go' }))}`;
}

/* ---------- le marché, le vestiaire, l'histoire, une pièce offerte ---------- */
export function sceneMarche(S, V) {
  const R = S.R, M = R.marche, plein = R.banc.length >= CASES_DU_BANC;
  const piece = k => { const ok = !M.piece && R.jetons >= PRIX_PIECE; return `<button type="button" class="${V.piece === k ? 'rn-on' : ''}" data-a="voir-piece" data-v="${k}"${ok ? '' : ' disabled'}>${carteP(k)}<span class="rn-prix${ok ? '' : ' rn-non'}">${M.piece ? 'Prise' : `<i class="rn-piece"></i>${PRIX_PIECE}`}</span><p>${ligneDe(k)}</p></button>`; };
  const pochette = (cle, mot, ico, metal, quoi) => { const prix = RUN.POCHETTES[cle], pris = M.pochettes.includes(cle), ok = !pris && R.jetons >= prix; return `<button type="button" data-a="pochette" data-v="${cle}"${ok ? '' : ' disabled'}><span class="rn-c" style="--pk-a:var(${metal})">${pochetteHtml({ etat: 'scellee', mot, ico })}</span><span class="rn-prix${ok ? '' : ' rn-non'}">${pris ? 'Ouverte' : `<i class="rn-piece"></i>${prix}`}</span><p>${quoi}</p></button>`; };
  return `${hud(S, { titre: 'Le marché', cible: false })}
  <div style="left:14px;right:14px;top:62px"><div class="rn-k" style="margin-bottom:10px">Une pièce de banc · une seule</div><div class="rn-etal">${M.pieces.map(piece).join('')}</div></div>
  <div style="left:14px;right:14px;top:350px"><div class="rn-k" style="margin-bottom:10px">Les pochettes</div><div class="rn-etal">${pochette('j:bronze', 'Bronze', '🥉', '--attention', 'Trois joueurs au hasard')}${pochette('j:epoque', 'Époque', '🕰', '--rn-bleu', `Un pilier ou mieux des années ${R.decennie}`)}</div></div>
  <div style="left:14px;right:14px;top:626px"><div class="rn-k" style="margin-bottom:8px">Ton banc${plein ? ' · plein : une pièce neuve en fait sortir une' : ' · une case libre'}</div>${banc(S, { libre: true, largeur: '292px' })}</div>
  ${V.piece && !M.piece ? bas(bt('Retour', 'quitter-marche'), bt('Prendre la pièce', 'acheter-piece', { cls: 'rn-orb', v: V.piece })) : bas(bt('Retour à la carte', 'quitter-marche', { cls: 'rn-go' }))}`;
}
export function sceneVestiaire(S, V) {
  const R = S.R, choix = V.choix || 'repos', joueurs = Object.values(S.roster).filter(Boolean);
  const uses = [0, 1, 2, 3].map(u => ({ mot: `${ord(u + 1)} trio`, j: jambes(SLOTS.filter(s => !s.scratch && s.group === 'F' && s.unit === u).map(s => S.roster[s.i]).filter(Boolean)) })).sort((a, b) => a.j - b.j).slice(0, 3);
  const blesse = [...S.toi.injured].sort((a, b) => b[1] - a[1])[0];
  const p = joueurs.find(x => getPlayerKey(x) === V.joueur) || joueurs.filter(x => groupeDe(x) !== 'G').sort((a, b) => getHiddenRatings(b).v - getHiddenRatings(a).v)[0];
  const ed = editionDe(p), k = Object.keys(NOM_VARIANTE).indexOf(ed), apres = Object.keys(NOM_VARIANTE)[k + 1] || null;
  const restants = RANG_DU_RIVAL - R.rang - 1;
  return `${hud(S, { titre: 'Le vestiaire', cible: false, bourse: false })}
  <button type="button" class="rn-choix${choix === 'repos' ? ' rn-on' : ''}" data-a="choix-vestiaire" data-v="repos" style="left:14px;right:14px;top:62px;width:362px"><b class="rn-h">Reposer et soigner</b><div class="rn-t rn-gris" style="margin:4px 0 8px">Tout le monde retrouve ses jambes. Un blessé revient.</div>
    ${uses.map(x => `<div class="rn-avap"><span>${x.mot}</span><div class="rn-jb${x.j < 70 ? ' rn-use' : ''}"><i style="width:${x.j}%"></i></div><span class="rn-gris">${x.j}</span><span class="rn-vert">100</span></div>`).join('')}
    <div style="margin-top:8px"><span class="rn-puce${blesse ? ' rn-v' : ''}">${blesse ? `${esc(court(blesse[0]))} revient · il manquait ${blesse[1]} match${blesse[1] > 1 ? 's' : ''}` : 'Aucun blessé'}</span></div></button>
  <div class="rn-choix${choix === 'monter' ? ' rn-on' : ''}" style="left:14px;right:14px;top:306px"><button type="button" data-a="choix-vestiaire" data-v="monter" style="display:block;width:100%"><b class="rn-h">Monter une carte</b><div class="rn-t rn-gris" style="margin:4px 0 8px">Une carte de ton choix monte d'une édition.</div></button>
    <div style="display:grid;grid-template-columns:104px 30px 104px 1fr;gap:8px;align-items:center">${carteJ(p)}<div class="rn-h rn-or" style="text-align:center">›</div>${apres ? `<span class="rn-c rn-cj" style="${varsEquipe(p)}">${cartonDe(p, { rar: apres })}</span>` : '<span class="rn-vide"></span>'}
      <div class="rn-t" style="text-align:center"><span class="rn-gris">${esc(NOM_VARIANTE[ed])}</span><br>›<br><span class="rn-vert">${apres ? esc(NOM_VARIANTE[apres]) : 'Au sommet'}</span></div></div>
    <div style="margin-top:10px"><button type="button" class="rn-puce" data-a="autre-carte" style="min-height:44px">${esc(court(p))} · toucher pour une autre carte</button></div></div>
  <div class="rn-t rn-gris" style="left:14px;right:14px;top:640px;text-align:center">Le rival est dans ${restants} case${restants > 1 ? 's' : ''}.</div>
  ${bas(bt(choix === 'repos' ? 'Reposer et soigner' : `Monter ${esc(court(p))}`, choix === 'repos' ? 'reposer' : 'monter', { cls: 'rn-go', v: getPlayerKey(p), off: choix === 'monter' && !apres }))}`;
}
/* Une pièce offerte (le rival battu, l'élite gagnée) ; banc plein, celle qui sort. */
function scenePiece(S, V, { titre, sous }) {
  const R = S.R, o = R.apres.offertes, plein = R.banc.length >= CASES_DU_BANC, choisie = o.includes(V.piece) ? V.piece : o[0];
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div><div class="rn-k">${titre}</div><div class="rn-h" style="margin-top:3px">${sous}</div></div></div>
  <div class="rn-etal">${o.map(k => `<button type="button" class="${k === choisie ? 'rn-on' : ''}" data-a="voir-piece" data-v="${k}">${carteP(k)}<p${k === choisie ? ' class="rn-or"' : ''}>${ligneDe(k)}</p></button>`).join('')}</div>
  <div style="margin-top:22px"><div class="rn-k" style="margin-bottom:8px">Ton banc${plein ? ' · plein : touche celle qui sort' : ' · une case libre'}</div>
    <div class="rn-banc" style="width:300px">${R.banc.map(k => `<button type="button" class="${V.sort === k ? 'rn-eteinte' : ''}" data-a="piece-sort" data-v="${k}"${plein ? '' : ' disabled'}>${carteP(k)}</button>`).join('')}${Array.from({ length: CASES_DU_BANC - R.banc.length }, (_, i) => `<span class="rn-vide${i === 0 ? ' rn-on' : ''}"></span>`).join('')}</div></div>`;
}
export function sceneHistoire(S, V) {
  const H = V.histoire;
  if (!H) return `${hud(S, { titre: 'Une histoire', cible: false })}<div style="left:14px;right:14px;top:120px"><span class="rn-voix">Le vestiaire</span><div class="rn-bulle">« Rien à signaler, coach. Tout le monde est prêt pour le prochain match. »</div></div>
    <div class="rn-t rn-gris" style="left:14px;right:14px;top:280px;text-align:center">Une soirée tranquille : <span class="rn-or">+${RUN.PASSER} jetons</span>.</div>${bas(bt('Retour à la carte', 'histoire-calme', { cls: 'rn-go' }))}`;
  return `${hud(S, { titre: 'Une histoire', cible: false })}
  <div style="left:14px;right:14px;top:66px"><span class="rn-voix">${esc(H.voix)}</span><div class="rn-bulle">${H.dit}</div></div>
  ${H.joueur ? `<div style="left:14px;right:14px;top:250px;display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:center">${carteJ(H.joueur)}<div><div class="rn-h">${esc(H.joueur.n)}</div><div class="rn-t rn-gris" style="margin-top:6px">${H.fait}</div></div></div>` : ''}
  <div class="rn-reps" style="left:14px;right:14px;top:404px">${H.options.map((o, i) => `<div><span class="rn-c">${o.carte}</span><p>${o.lignes}</p><button type="button" class="rn-prendre" data-a="reponse" data-v="${i}">Prendre</button></div>`).join('')}</div>`;
}

/* ---------- la fin d'acte, les séries, la fin, la pause ---------- */
export function sceneFinDActe(S, V) {
  const R = S.R, a = R.acte, x = R.actes[a], A = R.apres, c = R.carte.rival;
  const titre = A.fin ? (A.fin === 'coeurs' ? 'Plus de cœur' : 'Pas de séries') : 'La run continue';
  const suite = A.fin ? '' : a < 2 ? `Ensuite : l'acte ${ROMAINS[a + 1]} et son rival.` : 'Ensuite : les séries.';
  return `${hud(S, { petit: 'Fini', cible: false })}
  <div style="left:14px;right:14px;top:66px;text-align:center"><div class="rn-k ${x.tenu ? 'rn-vert' : 'rn-rg'}">${x.tenu ? 'La cible est tenue' : 'La cible est ratée'}</div><div class="rn-titre" style="margin-top:6px;white-space:nowrap">${titre}</div></div>
  <div class="rn-cellules" style="left:14px;right:14px;top:150px">
    <div><b class="${x.tenu ? 'rn-vert' : 'rn-rg'}">${x.pts} <span class="rn-gris rn-h">/ ${x.cible}</span></b><small>Points de l'acte</small></div>
    <div><b>${Array.from({ length: RUN.COEURS }, (_, i) => coeur(i < R.coeurs)).join('')}</b><small>${x.coeur ? 'Un cœur perdu' : `${R.coeurs} cœur${R.coeurs > 1 ? 's' : ''} · gardé${R.coeurs > 1 ? 's' : ''}`}</small></div>
    <div><b class="${x.rival ? 'rn-or' : 'rn-gris'}">${x.gf}-${x.ga}</b><small>${x.rival ? 'Le rival battu' : 'Le rival perdu'}</small></div></div>
  <div style="left:14px;right:14px;top:256px">${A.offertes.length ? scenePiece(S, V, { titre: `${esc(surnom(c.t))} battus te laissent une pièce`, sous: 'Une parmi trois' })
    : `<div class="rn-panneau"><div class="rn-t">${A.fin ? `<b>${A.fin === 'coeurs' ? 'Deux cibles ratées' : 'L\'acte III demandait les séries'}</b><br><span class="rn-gris">La run s'arrête ici. Tes médailles te suivent.</span>` : `<b>${x.rival ? 'Ton banc est plein : rien à prendre' : `${esc(clubMot(c))} garde sa pièce`}</b><br><span class="rn-gris">${x.rival ? '' : 'Battu, un rival laisse une pièce parmi trois.'}</span>`}</div></div>`}</div>
  ${suite ? `<div class="rn-t rn-gris" style="left:14px;right:14px;top:716px;text-align:center">${suite}</div>` : ''}
  ${A.fin ? bas(bt('Voir la fin', 'apres-acte', { cls: 'rn-go' })) : A.offertes.length ? bas(bt('Passer', 'apres-acte'), bt('Prendre', 'prendre-piece', { cls: 'rn-orb' })) : bas(bt('Continuer', 'apres-acte', { cls: 'rn-go' }))}`;
}
/* L'élite gagnée : sa pièce, avant ses portes. */
export const scenePieceGagnee = (S, V) => `${hud(S, { petit: 'L\'élite', cible: false })}
  <div style="left:14px;right:14px;top:66px;text-align:center"><div class="rn-k rn-vert">L'élite est battue</div><div class="rn-titre" style="margin-top:6px">${S.R.apres.gf}-${S.R.apres.ga}</div></div>
  <div style="left:14px;right:14px;top:170px">${scenePiece(S, V, { titre: 'Elle te laisse une pièce', sous: 'Une parmi trois' })}</div>
  ${bas(bt('Passer', 'piece-passee'), bt('Prendre', 'prendre-piece', { cls: 'rn-orb' }))}`;
const RONDES = ['Quart de finale', 'Demi-finale', 'La finale'];
export function sceneSeries(S) {
  const R = S.R, x = R.series;
  const points = (w, l, ordre = []) => `<div class="rn-pts">${Array.from({ length: 5 }, (_, i) => `<i class="${ordre[i] === true ? 'rn-g' : ordre[i] === false ? 'rn-p' : i < w ? 'rn-g' : i < w + l ? 'rn-p' : ''}"></i>`).join('')}</div>`;
  const joues = x.w + x.l ? R.matchs.filter(m => m.sorte === 'serie').slice(-(x.w + x.l)).map(m => m.gagne) : [];
  const ronde = k => {
    const c = x.adv[k], faite = x.faites[k];
    if (k > x.ronde) return `<div class="rn-ronde rn-avenir"><span class="rn-h" style="text-align:center">?</span><b>${RONDES[k]}<small>${esc(clubMot(c))}</small></b>${points(0, 0)}</div>`;
    if (faite) return `<div class="rn-ronde rn-fait">${logo(c.t, 44)}<b>${esc(clubMot(c))}<small>${RONDES[k]} · gagné ${faite.w}-${faite.l}</small></b>${points(faite.w, faite.l)}</div>`;
    return `<div class="rn-ronde rn-on">${logo(c.t, 44)}<b>${esc(clubMot(c))}<small>${RONDES[k]} · ${x.w}-${x.l}${x.essai ? ' · rejouée' : ''}</small></b>${points(x.w, x.l, joues)}</div>`;
  };
  return `${hud(S, { petit: RONDES[Math.min(2, x.ronde)], cible: false })}
  <div class="rn-t rn-gris" style="left:14px;right:14px;top:66px;text-align:center">Trois rondes · trois victoires pour passer</div>
  <div style="left:14px;right:14px;top:104px;display:flex;flex-direction:column;gap:12px">${[2, 1, 0].map(ronde).join('')}</div>
  <div class="rn-panneau" style="left:14px;right:14px;top:380px;display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:center">${coeur(R.coeurs > 0)}
    <div class="rn-t"><b>${R.coeurs > 0 ? `${R.coeurs === 1 ? 'Ton dernier cœur' : 'Tes cœurs'}` : 'Plus de cœur'}</b><br><span class="rn-gris">${R.coeurs > 0 && !x.essai ? 'Une série perdue te coûte un cœur, et tu la rejoues une fois contre le même club.' : 'Une série perdue, et la run finit.'}</span></div></div>
  <div class="rn-t rn-gris" style="left:14px;right:14px;top:500px;text-align:center">${jambes(Object.values(S.roster).filter(Boolean))} de jambes · ${S.toi.injured.size} blessé${S.toi.injured.size > 1 ? 's' : ''}</div>
  ${bas(bt('Lignes', 'lignes'), bt('La feuille du soir', 'match-de-serie', { cls: 'rn-go' }))}`;
}
const CAUSES = { coeurs: 'Plus de cœur', cible: 'Pas de séries', serie: 'Éliminé en séries', coupe: 'La Coupe', quitte: 'Run quittée' };
export function sceneFin(S, V) {
  const R = S.R, F = R.fin, x = R.series;
  const actes = R.actes.map((a, i) => `<div class="rn-recap"><span>Acte ${ROMAINS[i]}</span><span${a.tenu ? '' : ' class="rn-rg"'}>Cible ${a.tenu ? 'tenue' : 'ratée'} · ${a.pts} / ${a.cible}<small>${a.rival ? 'Rival battu' : 'Rival perdu'}, ${esc(surnom(a.t))}${a.coeur ? ' · un cœur perdu' : ''}</small></span><span class="rn-or">+${a.medailles}</span></div>`).join('');
  const series = x ? `<div class="rn-recap"><span>Séries</span><span>${F.coupe ? 'La Coupe' : F.rondes ? `${F.rondes} ronde${F.rondes > 1 ? 's gagnées' : ' gagnée'}` : 'Aucune ronde gagnée'}<small>${x.faites.map(f => `${esc(surnom(f.t))} ${f.w}-${f.l}`).join(', ') || esc(clubMot(x.adv[0]))}</small></span><span class="rn-or">+${F.medailles - R.actes.reduce((a, y) => a + y.medailles, 0)}</span></div>` : '';
  const etoile = V.etoile;
  return `<div style="left:14px;right:14px;top:30px;text-align:center"><div class="rn-k ${F.coupe ? 'rn-vert' : 'rn-rg'}">${F.coupe ? 'Tu as gagné' : 'La run est finie'}</div><div class="rn-titre" style="margin-top:8px;white-space:nowrap">${CAUSES[F.cause]}</div>
    <div class="rn-t rn-gris" style="margin-top:8px">Run ${R.numero} · les années ${R.decennie} · ${esc(R.coach.n || COACHS[R.coach.cle].nom)}</div></div>
  <div class="rn-panneau" style="left:14px;right:14px;top:132px">${actes}${series}</div>
  ${etoile ? `<div style="left:14px;right:14px;top:430px;display:grid;grid-template-columns:118px 1fr;gap:14px;align-items:center">${carteJ(etoile.p)}<div><div class="rn-k">Ton joueur de la run</div><div class="rn-h" style="margin-top:5px">${esc(etoile.p.n)}</div><div class="rn-t rn-gris" style="margin-top:6px">${etoile.mot}<br><span class="rn-vert">Sa carte entre à ton cartable</span></div></div></div>` : ''}
  <div class="rn-cellules" style="left:14px;right:14px;top:636px"><div><b class="rn-or">${F.medailles}</b><small>Médailles</small></div><div><b>${R.vus.length - 23}</b><small>Joueurs signés</small></div><div><b>${F.matchs}</b><small>Matchs joués</small></div></div>
  ${bas(bt('Menu', 'quitter'), bt('Une run neuve', 'run-neuve', { cls: 'rn-go' }))}`;
}
export function scenePause(S, V) {
  const R = S.R;
  return `<div class="rn-voile"></div>
  <div style="left:28px;right:28px;top:70px"><div class="rn-k">Pause · run ${R.numero} · les années ${R.decennie}</div><div class="rn-titre" style="margin-top:6px">${R.series ? 'Les séries' : `Acte ${ROMAINS[R.acte]} · case ${Math.min(RANG_DU_RIVAL, R.rang) + 1}`}</div>
    <div class="rn-t rn-gris" style="margin-top:6px">${R.series ? '' : `${R.pts} / ${RUN.CIBLES[R.acte]} points · `}${R.coeurs} cœur${R.coeurs > 1 ? 's' : ''} · ${R.jetons} jetons</div></div>
  <div class="rn-menu"><button type="button" class="rn-on" data-a="reprendre">Reprendre</button>
    <button type="button" data-a="lignes">Tes joueurs<small>23 · ${money(masseDe(S))}</small></button>
    <button type="button" data-a="banc">Ton coach et ton banc<small>${R.banc.length} pièce${R.banc.length > 1 ? 's' : ''}</small></button>
    <button type="button" data-a="menu">Le menu du jeu<small>La run est gardée</small></button>
    <button type="button" class="rn-quitter" data-a="abandonner">${V.sur ? 'Toucher encore : la run finit ici' : 'Quitter la run'}</button></div>`;
}
