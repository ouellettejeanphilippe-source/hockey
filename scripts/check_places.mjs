/*
 * LE PERSONNEL, CARTE PAR CARTE (V10, tranches 3 à 5 ; V16, seule carte bonus — js/personnel.js,
 * les réponses des dossiers, js/dossiers.js ; V20 : les routes de la semaine sont parties). Chaque carte attend son moment ; on la mesure EN PAIRES (CLAUDE.md),
 * match par match : deux copies d'un même vrai club, le même match sur les mêmes dés, une fois sans la carte, une fois
 * avec, son moment posé (`_lireMoment`, js/sim.js — la lecture d'un moment, qu'une partie ne pose jamais), à domicile
 * et au loin.
 *   1. hors de son moment, rien : la carte posée, son moment absent, la feuille est identique ;
 *   2. dans son moment, la borne de sa rareté (commune ±1, peu ±1,5, rare ±2,5, légendaire ±4 : un maximum) sur
 *      ce qu'elle vaut en tout — un adjoint, ses soirs d'une saison (`parSaison`, js/sim.js `MOMENTS_SI`) ; une réponse
 *      de dossier, ses soirs dans ses `duree` matchs ;
 *   3. une rare ou une légendaire se voit dans la feuille d'un soir de son moment (CLAUDE.md : ±2 tirs, ±0,3 but des
 *      deux clubs, ±0,5 punition, ±4 mises en échec, ou ±3 blessures sur une saison ; un adjoint à protégé, V16 :
 *      ±0,3 point à la ligne de son joueur) ; une commune peut être discrète ;
 *   4. cinq adjoints par coach au moins, sur trois postes au moins, six neutres (V16) ; les places, l'équipement et
 *      les clauses sont partis de la banque.
 * `N` : matchs par club et par carte (400). `FILS` : processus (4). `CARTES=a,b` : quelques cartes seulement.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, playGame, grainerHasard, feuilleVierge, SLOTS, MOMENTS_SI, MUTATIONS_ATELIER, appliquerMutation, joueurDeMutation, activeLineup, effetsDesJoueurs, getPlayerKey } from '../js/sim.js';
import { PERSONNEL, PROTEGES } from '../js/personnel.js';
import { DOSSIERS } from '../js/dossiers.js';
import { BANQUE, idsDe } from '../js/banque.js';
import { COACHS } from '../js/coachs.js';
import { TEMOINS, equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const N = Number(process.env.N ?? 400);
const FILS = Math.max(1, Number(process.env.FILS ?? 4));
const ICI = fileURLToPath(import.meta.url);
const BORNE_V = { commune: 1, peu: 1.5, rare: 2.5, legendaire: 4 };
/*
 * V14b : au premier échelon, une carte du personnel change le style, pas la force (JP : *sans la rendre vraiment plus
 * forte*). Son net, lu en buts (moins bruité que les victoires : `BUTS_PAR_V` buts font une victoire), tient sous
 * `STYLE_V` victoire sur ses soirs d'une saison.
 */
const STYLE_V = 0.5, BUTS_PAR_V = 6;
const VISIBLE = { tirs: 2, buts: 0.3, punitions: 0.5, coups: 4, blessures: 3 };
/* Les piles mesurées : le personnel, les réponses des dossiers (V10-5 ; V16, tranche 6 : le contrat lourd en est une) (V20 : les routes de la semaine sont parties). */
const PILE = { q: 'personnel', d: 'dossier' };
const CANAUX = ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
/* Une réponse de dossier (« dossier.réponse ») : un effet du soir, sa durée, son moment ; une commune. */
const reponseDe = id => {
  const [d, o] = id.split('.'), D = DOSSIERS[d], O = D.options.find(x => x.cle === o);
  return { nom: `${D.titre} : ${O.nom}`, ico: D.ico, rarete: 'commune', si: O.si, duree: O.duree, effet: Object.fromEntries(CANAUX.filter(k => k in O).map(k => [k, O[k]])), ...(O.lui ? { joueur: O.lui } : {}) };
};
const carteDe = (sorte, cle) => (sorte === 'd' ? reponseDe(cle) : PERSONNEL[cle]);
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
    // Le joueur nommé d'une réponse ou le protégé d'un adjoint (V11, V16) : ses points du soir, à sa ligne de la feuille.
    pj: toi._nomme ? (f.buts || []).filter(b => b.cote === moi && [b.marqueur, ...(b.passeurs || [])].some(q => q && getPlayerKey(q) === toi._nomme)).length : 0,
    jambes: pats.reduce((a, p) => a + (p.energie ?? 100), 0) / (pats.length || 1) };
}
/* UN FILS : chaque carte de `cles` (« q:cle » un adjoint, « d:dossier.réponse »), `n` matchs par club. */
function mesurer(cles, n) {
  const out = {};
  for (const id of cles) {
    const [sorte, cle] = id.split(':');
    const C = carteDe(sorte, cle);
    const m = out[id] = { n: 0, dpj: 0, dv: 0, dgf: 0, dga: 0, dtp: 0, dtc: 0, dpun: 0, dcoups: 0, dbl: 0, djambes: 0, hors: 0, horsPareil: 0 };
    for (const [lab, s, t] of TEMOINS) {
      const un = equipeReelle(s, t);
      const moment = C.si && C.si !== 'domicile' && C.si !== 'visiteur' ? C.si : null;
      // Trois clubs neufs à chaque match : une copie garde son gardien du soir et ses statistiques d'un match à
      // l'autre, et deux histoires différentes ne sont plus une paire.
      const trois = lire => {
        // Un club neuf tire sa chance de saison : semée pour chacun, elle est la même pour les deux bras.
        const club = (nom, role) => { grainerHasard(`places:${lab}:${role}`); return equipe(nom, t, un, s); };
        const sans = club('Sans', 'toi'), avec = club('Avec', 'toi'), adv = club('Eux', 'eux');
        // Une réponse : un effet du soir ; un poste : un patron engagé (`team.patrons`).
        if (sorte === 'k' || sorte === 'd') avec.effets = [{ debut: 0, fin: 1e9, source: 'decision', nom: C.nom, ico: C.ico, si: C.si, ...C.effet }];
        // Une réponse sur un joueur (V11) : sur le centre du premier trio, ou le premier défenseur si elle ferme le jeu.
        if (sorte === 'd' && C.joueur) {
          const ferme = (C.joueur.defense ?? 1) < 1, lu = activeLineup(avec);
          const p = lu[SLOTS.find(sl => !sl.scratch && sl.unit === 0 && (ferme ? sl.group === 'D' : sl.group === 'F' && sl.role === 'C')).i];
          avec.effetsCibles = [{ debut: 0, fin: 1e9, source: 'decision', nom: C.nom, si: C.si, joueur: p, ...C.joueur }];
          effetsDesJoueurs(avec, 0);
          sans._nomme = avec._nomme = getPlayerKey(p);
        }
        else {
          avec.patrons = [{ cle, role: C.role, nom: C.nom, ico: C.ico, si: C.si, ...C.effet }];
          // V16 : un adjoint à protégé pose aussi sa mutation, sur le joueur que le moteur désigne ; ses points se lisent à sa ligne.
          if (PROTEGES[cle]) { const p = joueurDeMutation(avec, null, cle); appliquerMutation(avec, p, cle, 0, 'personnel'); sans._nomme = avec._nomme = getPlayerKey(p); }
        }
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
        m.n++; m.dpj += b.pj - a.pj; m.dv += b.v - a.v; m.dgf += b.gf - a.gf; m.dga += b.ga - a.ga; m.dtp += b.tp - a.tp; m.dtc += b.tc - a.tc; m.dpun += b.pun - a.pun;
        m.dcoups += b.coups - a.coups; m.dbl += b.bl - a.bl; m.djambes += b.jambes - a.jambes;
        // 1. Hors de son moment : la carte posée, le moment absent (l'autre lieu, ou rien de forcé).
        if (C.si && i % 8 === 0) {
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
const toutes = [...Object.keys(PERSONNEL).filter(k => (PERSONNEL[k].effet && Object.keys(PERSONNEL[k].effet).length) || (PROTEGES[k] && !PROTEGES[k].feu)).map(k => `q:${k}`), 
  ...Object.entries(DOSSIERS).flatMap(([d, D]) => D.options.filter(o => o.lui || CANAUX.some(k => k in o)).map(o => `d:${d}.${o.cle}`))]
  .filter(id => !process.env.CARTES || process.env.CARTES.split(',').some(c => id.slice(2) === c || id.slice(2).startsWith(`${c}.`)));
console.log(`\n  Le personnel (V16) · ${toutes.length} cartes · ${N} matchs par club et par carte, ${TEMOINS.length} clubs, en paires\n`);

/* ---------- 4 : la forme ---------- */
{
  const compte = (src, cat) => { const o = {}; for (const k of Object.keys(src)) { const c = BANQUE[`${cat}:${k}`]; const co = (c && c.coach) || 'neutre'; o[co] = (o[co] || 0) + 1; } return o; };
  const dit = o => Object.entries(o).map(([k, x]) => `${COACHS[k] ? COACHS[k].ico : k} ${x}`).join(' · ');
  // V16 (docs/refonte-v16.md § 5) : le personnel remplace les autres cartes bonus — cinq adjoints par coach au moins, sur trois postes, six neutres.
  const pe = compte(PERSONNEL, 'patron');
  const postes = k => new Set(Object.keys(PERSONNEL).filter(c => (BANQUE[`patron:${c}`].coach || 'neutre') === k).map(c => PERSONNEL[c].role)).size;
  exiger('le personnel : cinq adjoints par coach au moins, sur trois postes au moins ; six neutres', Object.keys(COACHS).every(k => pe[k] >= 5 && postes(k) >= 3) && pe.neutre === 6, `${dit(pe)} · postes : ${Object.keys(COACHS).map(k => `${COACHS[k].ico} ${postes(k)}`).join(' ')}`);
  exiger('chaque carte d\'un moment attend un moment que le moteur connaît', Object.values(PERSONNEL).every(C => !C.si || MOMENTS_SI[C.si]), `${toutes.length} cartes`);
  // V16, tranche 4 : les places, l'équipement et les clauses sont partis. Restent au joueur les retouches d'édition (l'atelier),
  // et aux consommables les gestes de gérant : un blessé, un coach, un joueur du cartable.
  const offertes = [...idsDe('consommable'), ...idsDe('joueur')].map(id => BANQUE[id]);
  const vieilles = offertes.filter(c => (c.cat === 'joueur' && !MUTATIONS_ATELIER.includes(c.cle)) || (c.cat === 'consommable' && !['blesse', 'coach', 'adjoint', 'cartable'].includes(c.cible)));
  exiger('ni place, ni équipement, ni clause ne reste dans la banque', !vieilles.length, vieilles.slice(0, 4).map(c => c.nom).join(', ') || `${offertes.length} outils de gérant`);
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
const tropFortes = [], invisibles = [], pasStyle = [];
for (const id of toutes) {
  const [sorte, cle] = id.split(':');
  const C = carteDe(sorte, cle), m = res[id], Mo = C.si ? MOMENTS_SI[C.si] : TOUS_LES_SOIRS;
  hors += m.hors; horsPareil += m.horsPareil;
  const par = x => x / m.n;
  // Ce qu'elle vaut en tout : une réponse, ses soirs dans sa fenêtre ; le reste, ses soirs d'une saison.
  const soirs = sorte === 'd' ? (C.duree * Mo.parSaison) / 82 : Mo.parSaison;
  const v = par(m.dv) * soirs;
  const tirs = Math.max(Math.abs(par(m.dtp)), Math.abs(par(m.dtc)), Math.abs(par(m.dtp + m.dtc)));
  const buts = Math.abs(par(m.dgf)) + Math.abs(par(m.dga));
  // Se voir : la règle de CLAUDE.md, un soir de son moment ; les blessures, sur une saison.
  const vu1 = x => x / m.n;
  const vu = Math.max(Math.abs(vu1(m.dtp)), Math.abs(vu1(m.dtc)), Math.abs(vu1(m.dtp + m.dtc))) >= VISIBLE.tirs || Math.abs(vu1(m.dgf)) + Math.abs(vu1(m.dga)) >= VISIBLE.buts
    // Un effet sur un joueur (V11, V16) se voit à SA ligne : ±0,3 point au joueur nommé, un soir de son moment.
    || Math.abs(vu1(m.dpj)) >= VISIBLE.buts
    || Math.abs(vu1(m.dpun)) >= VISIBLE.punitions || Math.abs(vu1(m.dcoups)) >= VISIBLE.coups || Math.abs(vu1(m.dbl) * 82) >= VISIBLE.blessures;
  informer(`${C.ico} ${C.nom} (${PILE[sorte]}, ${C.rarete}, ${Mo.mot.toLowerCase()})`,
    `${soirs.toFixed(1).replace('.', ',')} soirs · ${f1(v)} V · par soir : tirs ${f1(par(m.dtp))} / contre ${f1(par(m.dtc))} · buts ${f2(par(m.dgf))} / ${f2(par(m.dga))} · punitions ${f2(par(m.dpun))} · mises en échec ${f1(par(m.dcoups))} · blessures ${f2(par(m.dbl) * 82)} par saison · jambes ${f1(par(m.djambes))}${C.joueur || C.protege ? ` · le joueur nommé ${f2(m.dpj / m.n)} point` : ''}`);
  if (Math.abs(v) > BORNE_V[C.rarete]) tropFortes.push(`${C.nom} ${f1(v)} V (borne ${BORNE_V[C.rarete]})`);
  const vButs = (par(m.dgf - m.dga) * soirs) / BUTS_PAR_V;
  if (sorte === 'q' && Math.abs(vButs) > STYLE_V) pasStyle.push(`${C.nom} ${f1(vButs)} V`);
  if ((C.rarete === 'rare' || C.rarete === 'legendaire') && !vu) invisibles.push(C.nom);
}
exiger('hors de son moment, une carte ne change rien à la feuille', hors > 0 && horsPareil === hors, `${horsPareil} feuilles identiques sur ${hors}`);
exiger('dans son moment, chaque carte reste sous la borne de sa rareté', !tropFortes.length, tropFortes.join(' · ') || 'toutes');
exiger('une rare ou une légendaire se voit dans la feuille d\'un soir de son moment', !invisibles.length, invisibles.join(' · ') || 'toutes');
if (toutes.some(id => id.startsWith('q:'))) exiger(`au premier échelon, le personnel change le style, pas la force (±${String(STYLE_V).replace('.', ',')} V en buts, ses soirs)`, !pasStyle.length, pasStyle.join(' · ') || 'toutes');
informer('le temps', `${Math.round((Date.now() - t0) / 1000)} s (${lots.length} fils)`);
verdict();
