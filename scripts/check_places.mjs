/*
 * LES PLACES ET L'ÉQUIPEMENT NEUFS, CARTE PAR CARTE (V10, tranches 3 à 5 — js/places.js, js/equipement.js, js/personnel.js, et
 * les réponses des dossiers, js/dossiers.js). Chaque carte
 * attend son moment ; on la mesure EN PAIRES (CLAUDE.md), match par match : deux copies d'un même vrai club, le même
 * match sur les mêmes dés, une fois sans la carte, une fois avec, son moment posé (`_lireMoment`, js/sim.js — la
 * lecture d'un moment, qu'une partie ne pose jamais), à domicile et au loin. Un équipement du duel (en 3e, en retard)
 * se mesure par sa jumelle de tous les soirs, au tiers : il ne joue qu'une période.
 *   1. hors de son moment, rien : la carte posée, son moment absent, la feuille est identique ;
 *   2. dans son moment, la borne de sa rareté (commune ±1, peu ±1,5, rare ±2,5, légendaire ±4 : un maximum) sur
 *      ce qu'elle vaut en tout — une place, ses soirs dans ses `duree` matchs ; un équipement, ses soirs d'une saison
 *      (`parSaison`, js/sim.js `MOMENTS_SI`) ;
 *   3. une rare ou une légendaire se voit dans la feuille d'un soir de son moment (CLAUDE.md : ±2 tirs, ±0,3 but des
 *      deux clubs, ±0,5 punition, ±4 mises en échec, ou ±3 blessures sur une saison) ; une commune peut être discrète ;
 *   4. trois cartes par coach et par pile (l'équipement : les coachs qui ont un canal de joueur), trois neutres ;
 *      l'ancien jeu de tous les soirs ne s'offre plus.
 * `N` : matchs par club et par carte (400). `FILS` : processus (4). `CARTES=a,b` : quelques cartes seulement.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, SLOTS, MOMENTS_SI, MUTATIONS, appliquerMutation, joueurDeMutation } from '../js/sim.js';
import { PLACES_NEUVES } from '../js/places.js';
import { EQUIPEMENT } from '../js/equipement.js';
import { PERSONNEL, CONTRATS_MAUDITS } from '../js/personnel.js';
import { DOSSIERS } from '../js/dossiers.js';
import { BANQUE, idsDe } from '../js/banque.js';
import { COACHS } from '../js/coachs.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 400);
const FILS = Math.max(1, Number(process.env.FILS ?? 4));
const ICI = fileURLToPath(import.meta.url);
const BORNE_V = { commune: 1, peu: 1.5, rare: 2.5, legendaire: 4 };
const VISIBLE = { tirs: 2, buts: 0.3, punitions: 0.5, coups: 4, blessures: 3 };
const JUMELLE = '__jumelle';
/* Les piles mesurées : les places, l'équipement, le personnel, les contrats lourds, et les réponses des dossiers (V10-5). */
const PILE = { p: 'place', e: 'équipement', q: 'personnel', k: 'contrat lourd', d: 'dossier' };
const CANAUX = ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
/* Une réponse de dossier (« dossier.réponse ») se mesure comme une place : un effet du soir, sa durée, son moment ; une commune. */
const reponseDe = id => {
  const [d, o] = id.split('.'), D = DOSSIERS[d], O = D.options.find(x => x.cle === o);
  return { nom: `${D.titre} : ${O.nom}`, ico: D.ico, rarete: 'commune', si: O.si, duree: O.duree, effet: Object.fromEntries(CANAUX.filter(k => k in O).map(k => [k, O[k]])) };
};
const carteDe = (sorte, cle) => (sorte === 'd' ? reponseDe(cle) : ({ p: PLACES_NEUVES, e: EQUIPEMENT, q: PERSONNEL, k: CONTRATS_MAUDITS })[sorte][cle]);
/* Une réponse de tous les soirs n'a pas de moment : sa durée entière compte. */
const TOUS_LES_SOIRS = { mot: 'Tous les soirs', parSaison: 82 };

const equipe = (nom, tag, un, s) => { const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings); return createTeam(nom, tag, autoRoster(p), { season: s }); };
/* Un match isolé : des jambes fraîches, une infirmerie vide, les dés de la graine. */
function match(toi, adv, graine, visiteur) {
  for (const t of [toi, adv]) { for (const sl of SLOTS) { const p = t.roster[sl.i]; if (p) p.energie = 100; } if (t.injured) t.injured.clear(); t.jourCourant = 0; }
  grainerHasard(graine);
  const f = feuilleVierge();
  const r = visiteur ? playGame(adv, toi, 1, false, false, f) : playGame(toi, adv, 1, false, false, f);
  const moi = visiteur ? 'B' : 'A', eux = visiteur ? 'A' : 'B';
  const somme = a => (a || []).reduce((x, y) => x + y, 0);
  const pats = Object.values(toi.roster).filter(p => p && p.p !== 'G');
  return { v: r.winner === toi ? 1 : 0, gf: visiteur ? r.gfB : r.gfA, ga: visiteur ? r.gfA : r.gfB,
    tp: somme(f.tirs && f.tirs[moi]), tc: somme(f.tirs && f.tirs[eux]), pun: (f.punitions || []).filter(p => p.cote === moi).length,
    coups: (f.coups || {})[moi] || 0, bl: (f.blessures || []).filter(b => b.cote === moi).length,
    jambes: pats.reduce((a, p) => a + (p.energie ?? 100), 0) / (pats.length || 1) };
}
/* UN FILS : chaque carte de `cles` (« p:cle » une place, « e:cle » un équipement), `n` matchs par club. */
function mesurer(cles, n) {
  const out = {};
  for (const id of cles) {
    const [sorte, cle] = id.split(':');
    const C = carteDe(sorte, cle);
    const duel = !!C.si && MOMENTS_SI[C.si].duel;
    if (sorte === 'e' && duel) { const { si, ...sans } = C; void si; MUTATIONS[JUMELLE] = sans; }
    const m = out[id] = { n: 0, dv: 0, dgf: 0, dga: 0, dtp: 0, dtc: 0, dpun: 0, dcoups: 0, dbl: 0, djambes: 0, hors: 0, horsPareil: 0 };
    for (const [lab, s, t] of TEMOINS) {
      const un = equipeReelle(s, t);
      const moment = !duel && C.si && C.si !== 'domicile' && C.si !== 'visiteur' ? C.si : null;
      // Trois clubs neufs à chaque match : une copie garde son gardien du soir et ses statistiques d'un match à
      // l'autre, et deux histoires différentes ne sont plus une paire.
      const trois = lire => {
        // Un club neuf tire sa chance de saison : semée pour chacun, elle est la même pour les deux bras.
        const club = (nom, role) => { grainerHasard(`places:${lab}:${role}`); return equipe(nom, t, un, s); };
        const sans = club('Sans', 'toi'), avec = club('Avec', 'toi'), adv = club('Eux', 'eux');
        // Une place ou le prix d'un contrat lourd : un effet du soir ; un poste : un patron engagé (`team.patrons`).
        if (sorte === 'p' || sorte === 'k' || sorte === 'd') avec.effets = [{ debut: 0, fin: 1e9, source: 'decision', nom: C.nom, ico: C.ico, si: C.si, ...C.effet }];
        else if (sorte === 'q') avec.patrons = [{ cle, role: C.role, nom: C.nom, ico: C.ico, si: C.si, ...C.effet }];
        else { const k = duel ? JUMELLE : cle; appliquerMutation(avec, joueurDeMutation(avec, null, k), k, 0, 'equipement'); }
        for (const T of [sans, avec]) T._lireMoment = lire;
        return { sans, avec, adv };
      };
      for (let i = 0; i < n; i++) {
        const visiteur = C.si === 'visiteur' ? true : C.si === 'domicile' ? false : i % 2 === 1;
        const g = `places:${lab}:${id}:${i}`;
        const P = trois(moment);
        const a = match(P.sans, P.adv, g, visiteur);
        const P2 = trois(moment);
        const b = match(P2.avec, P2.adv, g, visiteur);
        m.n++; m.dv += b.v - a.v; m.dgf += b.gf - a.gf; m.dga += b.ga - a.ga; m.dtp += b.tp - a.tp; m.dtc += b.tc - a.tc; m.dpun += b.pun - a.pun;
        m.dcoups += b.coups - a.coups; m.dbl += b.bl - a.bl; m.djambes += b.jambes - a.jambes;
        // 1. Hors de son moment : la carte posée, le moment absent (l'autre lieu, ou rien de forcé).
        if (!duel && C.si && i % 8 === 0) {
          const hv = C.si === 'domicile' ? true : C.si === 'visiteur' ? false : visiteur;
          const H = trois(null), ha = match(H.sans, H.adv, `${g}:hors`, hv);
          const H2 = trois(null), hb = match(H2.avec, H2.adv, `${g}:hors`, hv);
          const momentReel = C.si === 'domicile' || C.si === 'visiteur' ? false : (H2.avec._soir || {})[C.si];
          if (!momentReel) { m.hors++; if (JSON.stringify(ha) === JSON.stringify(hb)) m.horsPareil++; }
        }
      }
    }
  }
  return out;
}
if (process.env.PART) {
  process.stdout.write(JSON.stringify(mesurer(process.env.PART.split(','), Number(process.env.NPART))));
  process.exit(0);
}

const t0 = Date.now();
const toutes = [...Object.keys(PLACES_NEUVES).filter(k => PLACES_NEUVES[k].si).map(k => `p:${k}`), ...Object.keys(EQUIPEMENT).map(k => `e:${k}`),
  ...Object.keys(PERSONNEL).filter(k => PERSONNEL[k].si).map(k => `q:${k}`), ...Object.keys(CONTRATS_MAUDITS).map(k => `k:${k}`),
  ...Object.entries(DOSSIERS).flatMap(([d, D]) => D.options.filter(o => CANAUX.some(k => k in o)).map(o => `d:${d}.${o.cle}`))]
  .filter(id => !process.env.CARTES || process.env.CARTES.split(',').some(c => id.slice(2) === c || id.slice(2).startsWith(`${c}.`)));
console.log(`\n  Les places et l'équipement neufs (V10) · ${toutes.length} cartes · ${N} matchs par club et par carte, ${TEMOINS.length} clubs, en paires\n`);

/* ---------- 4 : la forme ---------- */
{
  const compte = (src, cat) => { const o = {}; for (const k of Object.keys(src)) { const c = BANQUE[`${cat}:${k}`]; const co = (c && c.coach) || 'neutre'; o[co] = (o[co] || 0) + 1; } return o; };
  const pl = compte(PLACES_NEUVES, 'consommable'), eq = compte(EQUIPEMENT, 'joueur');
  const dit = o => Object.entries(o).map(([k, x]) => `${COACHS[k] ? COACHS[k].ico : k} ${x}`).join(' · ');
  exiger('les places : trois par coach, trois neutres', Object.keys(COACHS).every(k => pl[k] === 3) && pl.neutre === 3, dit(pl));
  const AVEC_CANAL = ['essaim', 'rapaces', 'tortue', 'souffle', 'etoiles'];
  exiger('l\'équipement : trois par coach qui a un canal de joueur, trois neutres', AVEC_CANAL.every(k => eq[k] === 3) && eq.neutre === 3 && Object.keys(eq).every(k => k === 'neutre' || AVEC_CANAL.includes(k)), dit(eq));
  const pe = compte(PERSONNEL, 'patron');
  exiger('le personnel : deux postes par coach, trois neutres', Object.keys(COACHS).every(k => pe[k] === 2) && pe.neutre === 3, dit(pe));
  exiger('chaque carte d\'un moment attend un moment que le moteur connaît', [...Object.values(PLACES_NEUVES), ...Object.values(EQUIPEMENT), ...Object.values(PERSONNEL), ...Object.values(CONTRATS_MAUDITS)].every(C => !C.si || MOMENTS_SI[C.si]), `${toutes.length} cartes`);
  const offertes = [...idsDe('consommable'), ...idsDe('joueur')].map(id => BANQUE[id]);
  const vieilles = offertes.filter(c => c.cat === 'consommable' && !PLACES_NEUVES[c.cle] && ['aucune', 'joueur'].includes(c.cible));
  exiger('l\'ancien jeu de tous les soirs ne s\'offre plus', !vieilles.length, vieilles.slice(0, 4).map(c => c.nom).join(', ') || `${offertes.length} cartes offertes`);
}

/* ---------- 1 à 3 : la mesure ---------- */
const lancer = (cles, n) => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [ICI], { env: { ...process.env, PART: cles.join(','), NPART: String(n) } });
  let txt = '';
  p.stdout.on('data', x => { txt += x; });
  p.stderr.on('data', x => process.stderr.write(x));
  p.on('close', c => (c === 0 ? ok(JSON.parse(txt)) : ko(new Error(`le fils ${cles[0]}… a échoué (${c})`))));
});
const lots = Array.from({ length: FILS }, (_, i) => toutes.filter((_, j) => j % FILS === i)).filter(l => l.length);
const res = Object.assign({}, ...(await Promise.all(lots.map(l => lancer(l, N)))));
const f1 = x => (x >= 0 ? '+' : '') + x.toFixed(1).replace('.', ',');
const f2 = x => (x >= 0 ? '+' : '') + x.toFixed(2).replace('.', ',');
let hors = 0, horsPareil = 0;
const tropFortes = [], invisibles = [];
for (const id of toutes) {
  const [sorte, cle] = id.split(':');
  const C = carteDe(sorte, cle), m = res[id], Mo = C.si ? MOMENTS_SI[C.si] : TOUS_LES_SOIRS;
  hors += m.hors; horsPareil += m.horsPareil;
  const part = sorte === 'e' && Mo.duel ? 1 / 3 : 1;
  const par = x => (x / m.n) * part;
  // Ce qu'elle vaut en tout : une place, ses soirs dans sa fenêtre ; un équipement, ses soirs d'une saison.
  const soirs = sorte === 'p' || sorte === 'd' ? (C.duree * Mo.parSaison) / 82 : Mo.parSaison;   // une place, une réponse : sa fenêtre ; le reste, la saison
  const v = par(m.dv) * soirs;
  const tirs = Math.max(Math.abs(par(m.dtp)), Math.abs(par(m.dtc)), Math.abs(par(m.dtp + m.dtc)));
  const buts = Math.abs(par(m.dgf)) + Math.abs(par(m.dga));
  // Se voir : la règle de CLAUDE.md, un soir de son moment (au duel, la période où il joue) ; les blessures, sur une saison.
  const vu1 = x => x / m.n;
  const vu = Math.max(Math.abs(vu1(m.dtp)), Math.abs(vu1(m.dtc)), Math.abs(vu1(m.dtp + m.dtc))) >= VISIBLE.tirs || Math.abs(vu1(m.dgf)) + Math.abs(vu1(m.dga)) >= VISIBLE.buts
    || Math.abs(vu1(m.dpun)) >= VISIBLE.punitions || Math.abs(vu1(m.dcoups)) >= VISIBLE.coups || Math.abs(vu1(m.dbl) * 82) >= VISIBLE.blessures;
  informer(`${C.ico} ${C.nom} (${PILE[sorte]}, ${C.rarete}, ${Mo.mot.toLowerCase()})`,
    `${soirs.toFixed(1).replace('.', ',')} soirs · ${f1(v)} V · par soir : tirs ${f1(par(m.dtp))} / contre ${f1(par(m.dtc))} · buts ${f2(par(m.dgf))} / ${f2(par(m.dga))} · punitions ${f2(par(m.dpun))} · mises en échec ${f1(par(m.dcoups))} · blessures ${f2(par(m.dbl) * 82)} par saison · jambes ${f1(par(m.djambes))}`);
  // Un contrat lourd est un prix, pas une force : il se mesure, il ne se borne pas ; il doit seulement coûter.
  if (sorte === 'k') { if (!(v < 0)) tropFortes.push(`${C.nom} ne coûte rien (${f1(v)} V)`); continue; }
  if (Math.abs(v) > BORNE_V[C.rarete]) tropFortes.push(`${C.nom} ${f1(v)} V (borne ${BORNE_V[C.rarete]})`);
  if ((C.rarete === 'rare' || C.rarete === 'legendaire') && !vu) invisibles.push(C.nom);
}
exiger('hors de son moment, une carte ne change rien à la feuille', hors > 0 && horsPareil === hors, `${horsPareil} feuilles identiques sur ${hors}`);
exiger('dans son moment, chaque carte reste sous la borne de sa rareté', !tropFortes.length, tropFortes.join(' · ') || 'toutes');
exiger('une rare ou une légendaire se voit dans la feuille d\'un soir de son moment', !invisibles.length, invisibles.join(' · ') || 'toutes');
informer('le temps', `${Math.round((Date.now() - t0) / 1000)} s (${lots.length} fils)`);
verdict();
