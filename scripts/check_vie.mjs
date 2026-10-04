/*
 * LES COURRIELS ET LES POINTS DE PRESSE ONT DES CONSÉQUENCES (js/vie-gm.js, `REPONSES_VIE`). JP : *ça doit
 * influencer des stats de joueur, joueurs ou équipe.* Chaque courriel et chaque échange offre deux ou trois
 * réponses, dans la forme des options d'un dilemme ; une réponse prise est une décision
 * `{ moment: { famille: 'vie', cle, choix } }` que le moteur lit comme celle d'un dilemme. Ce script prouve :
 *
 *   1. la couverture : chaque courriel et chaque échange que le tirage peut sortir a ≥ 2 réponses valides ;
 *   2. les mots : aucun « % », aucune « énergie », aucune cote à l'écran ; {nom} seulement quand un joueur est nommé ;
 *      les finances ne parlent ni de jetons ni de plafond ; l'effet suit le métier de l'expéditeur ;
 *   3. les amplitudes : jamais au-delà des plus grosses de js/sim.js (MOMENTS, SÉQUENCES), pour au plus huit matchs ;
 *   4. le moteur lit chaque effet (`effetDeMoment`, `pariDeDecision`), l'effet se dit en chiffres de match
 *      (`effetEnChiffres`, js/impact.js), et son net en buts, sur toute sa durée, reste sous une victoire ;
 *   5. un joueur nommé est un joueur réel du club ce jour-là ;
 *   6. une réponse prise s'applique UNE fois, et la saison se rejoue au but près (même graine, mêmes décisions).
 * « Aucune réponse gratuite ou battue » est jugé par check_choix.mjs, qui lit aussi ces réponses.
 *
 *   node scripts/check_vie.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam, simulateLeague, MOMENTS, SEQUENCES, MUTATIONS, effetDeMoment, pariDeDecision, ciblesDe, getPlayerKey, SLOTS } from '../js/sim.js';
import { effetEnChiffres } from '../js/impact.js';
import { courrielsDe, echangeDe, REPONSES_VIE } from '../js/vie-gm.js';
import { formeDe } from '../js/gerant.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();

/* Huit vraies équipes, tirées d'une graine fixe. */
function ligue(n = 8) {
  let x = 4242; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const sh = JSON.parse(fs.readFileSync(path.join(DIR, SAISONS[Math.floor(rnd() * SAISONS.length)]), 'utf8'));
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    const p = un.flat().map(q => ({ ...q })); p.forEach(registerHiddenRatings);
    out.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(p), { season: sh.season }));
  }
  return out;
}
const toi = ligue()[0];

console.log('\n  LES RÉPONSES AUX COURRIELS ET AUX POINTS DE PRESSE\n');

/* ---------- 1. la couverture ---------- */
const MOMENTS_DE_SAISON = ['camp', 'octobre', 'decembre', 'echeance', 'mars', 'series', 'elimination', 'coupe'];
const accessibles = new Set();
for (const moment of MOMENTS_DE_SAISON) for (const etat of [[], ['sequence'], ['panne']]) {
  for (let g = 0; g < 40; g++) for (const x of courrielsDe({ moment, etat, eq: 'A', autre: 'B' }, `g${g}`, 12)) accessibles.add(x.id);
}
const echanges = new Set();
for (const occasion of ['victoire', 'defaite', 'raclee', 'serieDefaites', 'blanchissage', 'derniereChance']) {
  for (let g = 0; g < 400; g++) { const e = echangeDe({ occasion, eq: 'A', autre: 'B' }, `g${g}`); if (e) echanges.add(e.id); }
}
const cles = Object.keys(REPONSES_VIE);
const courriels = cles.filter(k => !/^e\d+$/.test(k)), presse = cles.filter(k => /^e\d+$/.test(k));
const sansReponses = [...accessibles, ...echanges].filter(k => !REPONSES_VIE[k] || REPONSES_VIE[k].options.length < 2);
informer('courriels · échanges', `${courriels.length} courriels, ${presse.length} échanges (${accessibles.size} courriels et ${echanges.size} échanges sortent au tirage)`);
exiger('chaque courriel et chaque échange a au moins deux réponses', !sansReponses.length && courriels.length >= accessibles.size && presse.length >= echanges.size, sansReponses.join(' · '));
const mal = cles.filter(k => { const os = REPONSES_VIE[k].options; return os.length > 3 || new Set(os.map(o => o.cle)).size !== os.length; });
exiger('deux ou trois réponses, aux clés distinctes', !mal.length, mal.join(' · '));

/* ---------- 2. les mots ---------- */
const toutesLesOptions = cles.flatMap(k => REPONSES_VIE[k].options.map(o => ({ k, fam: REPONSES_VIE[k], o })));
const texte = ({ o, fam }) => [o.nom, o.bon, o.prix, fam.titre].join(' ');
const interdits = toutesLesOptions.filter(x => /%|énergie|energie|\bcotes?\b|rating/i.test(texte(x))).map(x => `${x.k}.${x.o.cle}`);
exiger('aucun « % », aucune « énergie », aucune cote dans les mots', !interdits.length, interdits.join(' · '));
const sansBonPrix = toutesLesOptions.filter(x => !x.o.bon || !x.o.prix).map(x => `${x.k}.${x.o.cle}`);
exiger('chaque réponse dit ce qu\'elle rapporte et ce qu\'elle coûte', !sansBonPrix.length, sansBonPrix.join(' · '));
const nomSansJoueur = toutesLesOptions.filter(x => !x.fam.cible && /\{nom\}/.test(texte(x))).map(x => `${x.k}.${x.o.cle}`);
exiger('{nom} seulement quand un joueur est nommé', !nomSansJoueur.length, nomSansJoueur.join(' · '));
const finances = toutesLesOptions.filter(x => /^fi\d+$/.test(x.k) && (/jeton|plafond|🪙/i.test([x.o.nom, x.o.bon, x.o.prix].join(' ')) || x.o.mutation)).map(x => `${x.k}.${x.o.cle}`);
exiger('les finances restent dans les canaux de match (ni jetons, ni plafond)', !finances.length, finances.join(' · '));
/* Le métier de l'expéditeur : chaque courriel a au moins une réponse dans les canaux de son métier. */
const METIER = {
  pr: ['finition', 'discipline'], fi: ['volume', 'finition', 'defense', 'discipline', 'energie'], ad: ['F', 'D'], ag: ['mutation', 'action', 'F', 'finition'],
  ph: ['blessure', 'energie', 'action'], eq: ['energie', 'discipline'], co: ['discipline'], li: ['discipline'], pa: ['volume', 'finition', 'pari'], ma: ['volume'],
};
const horsMetier = courriels.filter(k => !REPONSES_VIE[k].options.some(o => METIER[k.slice(0, 2)].some(c => o[c] != null)));
exiger('chaque courriel a une réponse dans les canaux du métier de son expéditeur', !horsMetier.length, horsMetier.join(' · '));

/* ---------- 3. les amplitudes ---------- */
const CANAUX = ['volume', 'finition', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
const lesPlusGrosses = {};
for (const [, fam] of [...Object.entries(MOMENTS).filter(([k]) => !k.startsWith('vie_')), ...Object.entries(SEQUENCES)]) {
  for (const o of fam.options) for (const c of CANAUX) {
    for (const v of [o[c], o.pari && o.pari.gagne[c], o.pari && o.pari.perd[c]].flat()) {
      if (typeof v === 'number' && c !== 'robustesse') { const m = lesPlusGrosses[c] || (lesPlusGrosses[c] = { min: 1, max: 1 }); m.min = Math.min(m.min, v); m.max = Math.max(m.max, v); }
    }
  }
}
const hors = [];
const effetsDe = o => [o, ...(o.ensuite ? [o.ensuite] : []), ...(o.pari ? [o.pari.gagne, o.pari.perd] : [])];
for (const { k, o } of toutesLesOptions) for (const e of effetsDe(o)) {
  for (const c of CANAUX) {
    for (const v of [e[c]].flat()) {
      const b = lesPlusGrosses[c] || { min: 1, max: 1 };
      if (typeof v === 'number' && c !== 'robustesse' && (v < b.min - 1e-9 || v > b.max + 1e-9)) hors.push(`${k}.${o.cle} ${c} ${v}`);
    }
  }
  if (e.duree != null && !(e.duree >= 1 && e.duree <= 8)) hors.push(`${k}.${o.cle} durée ${e.duree}`);
}
informer('plus gros canaux des dilemmes', Object.entries(lesPlusGrosses).map(([c, m]) => `${c} ${m.min}–${m.max}`).join(' · '));
exiger('aucun canal au-delà des plus gros des dilemmes, aucune durée au-delà de huit matchs', !hors.length, hors.slice(0, 6).join(' · '));

/* ---------- 4. le moteur lit, les chiffres de match le disent, le net reste sous une victoire ---------- */
const decisionDe = (k, o, joueurs = []) => ({ jour: 30, moment: { famille: 'vie', cle: k, choix: o.cle, joueur: joueurs[0] || null, joueurs }, sel: 'sel-de-test' });
const canauxDe = e => Object.fromEntries(Object.entries(e).filter(([c]) => CANAUX.includes(c)));
const nombre = s => Number(s.replace(',', '.'));
/* Les buts nets par match (pour − contre) que disent les mots de match : la même moyenne que le moteur joue. */
function netParMatch(lignes) {
  let net = 0;
  for (const l of lignes) {
    let m = /≈ ([+−])(\d+(?:,\d+)?) but (?:marqué|accordé)/.exec(l.txt), x = null;
    if (m) x = nombre(m[2]) * (m[1] === '+' ? 1 : -1);
    else if ((m = /≈ 1 but (de plus|de moins) (?:marqué|accordé) tous les (\d+) matchs/.exec(l.txt))) x = (m[1] === 'de plus' ? 1 : -1) / Number(m[2]);
    if (x != null) net += l.cle === 'but' ? x : -x;
  }
  return net;
}
const BUTS_PAR_VICTOIRE = 6;   // la règle du pouce de la LNH : six buts de différentiel valent une victoire
const lectureFautes = [], moteurFautes = [], invisibles = [], pariFautes = [], gestesFautes = [];
let netMax = { v: 0, qui: '' };
const lu = new Map();
const chiffres = (e, duree) => { const c = JSON.stringify([e, duree]); if (!lu.has(c)) lu.set(c, effetEnChiffres(e, toi, null, null, { duree })); return lu.get(c); };
const vedette = ciblesDe(toi, 'vedette')[0], gardien = ciblesDe(toi, 'gardien')[0];
for (const { k, fam, o } of toutesLesOptions) {
  const joueurs = fam.cible ? ciblesDe(toi, fam.cible).map(getPlayerKey) : [];
  const x = `${k}.${o.cle}`;
  const eff = effetDeMoment(decisionDe(k, o, joueurs), toi);
  const canaux = canauxDe(o);
  if (Object.keys(canaux).length) {
    if (!eff || eff.choix !== o.nom || !(eff.fin > eff.debut) || Object.keys(canaux).some(c => JSON.stringify(eff[c]) !== JSON.stringify(canaux[c]))) moteurFautes.push(x);
  } else if (eff) moteurFautes.push(`${x} (un effet sans canal)`);
  if (o.mutation && !MUTATIONS[o.mutation]) moteurFautes.push(`${x} (modif inconnue ${o.mutation})`);
  if (o.mutation && !fam.cible) moteurFautes.push(`${x} (une modif sans joueur nommé)`);
  const gestes = [o.action, o.ensuite && o.ensuite.action, o.pari && o.pari.gagne.action, o.pari && o.pari.perd.action].filter(Boolean);
  for (const a of gestes) {
    if (Object.keys(a).some(c => !['absents', 'energie', 'energieTous', 'gardienAux'].includes(c))) gestesFautes.push(`${x} (geste inconnu)`);
    if ((a.absents || a.energie) && !fam.cible) gestesFautes.push(`${x} (un geste sur personne)`);
  }
  if (o.pari) {
    const p = pariDeDecision(decisionDe(k, o, joueurs), 'graine-de-test', toi);
    if (!p || !(p.face >= 1 && p.face <= 6)) pariFautes.push(x);
  }
  // Les chiffres de match, et le net en buts sur toute la durée (la pire des issues d'un pari).
  for (const issue of o.pari ? [o.pari.gagne, o.pari.perd] : [{}]) {
    const parts = [{ ...canaux, ...canauxDe(issue), duree: issue.duree || o.duree }, ...(o.ensuite ? [{ ...canauxDe(o.ensuite), duree: o.ensuite.duree }] : [])].filter(e => Object.keys(canauxDe(e)).length);
    let v = 0;
    for (const e of parts) {
      const lignes = chiffres(canauxDe(e), e.duree);
      if (!lignes.length || lignes.every(l => l.cle === 'rien')) invisibles.push(x);
      v += netParMatch(lignes) * (e.duree || 5) / BUTS_PAR_VICTOIRE;
    }
    if (Math.abs(v) > Math.abs(netMax.v)) netMax = { v, qui: x };
  }
  if (!(Object.keys(canaux).length || o.mutation || gestes.length || o.pari || o.ensuite)) lectureFautes.push(x);
}
exiger('chaque réponse a un effet que le moteur lit (canaux, modif, geste, pari ou plus tard)', !lectureFautes.length && !moteurFautes.length && !gestesFautes.length && !pariFautes.length,
  [...lectureFautes, ...moteurFautes, ...gestesFautes, ...pariFautes].slice(0, 6).join(' · '));
exiger('chaque effet de canal se dit en chiffres de match (jamais « à peine perceptible » seul)', !invisibles.length, [...new Set(invisibles)].slice(0, 6).join(' · '));
exiger('le net en buts d\'une réponse, sur sa durée, reste sous une victoire', Math.abs(netMax.v) <= 1, `${netMax.v.toFixed(2)} V (${netMax.qui}), ${toutesLesOptions.length} réponses`);

/* Une réponse est un échange : ni cadeau (que du bon), ni moindre mal (que du mauvais) — sauf si un geste, un pari, une modif ou un plus-tard la nuance. */
const pasUnEchange = toutesLesOptions.filter(({ o }) => !o.mutation && ['Cadeau', 'Moindre mal'].includes(formeDe(o))).map(({ k, o }) => `${k}.${o.cle}`);
exiger('aucune réponse n\'est un cadeau ni un simple moindre mal : chacune paie son effet', !pasUnEchange.length, pasUnEchange.slice(0, 6).join(' · '));

/* ---------- 5. les joueurs nommés sont ceux du club ce jour-là ---------- */
const habilles = new Set(SLOTS.filter(s => !s.scratch).map(s => toi.roster[s.i]).filter(Boolean).map(getPlayerKey));
const cibles = [...new Set(cles.map(k => REPONSES_VIE[k].cible).filter(Boolean))];
const faux = cibles.filter(c => { const l = ciblesDe(toi, c); return l.length !== 1 || !habilles.has(getPlayerKey(l[0])) || (c === 'gardien') !== (l[0].p === 'G'); });
exiger('chaque cible (vedette, gardien) est un joueur habillé du club, et le gardien est le gardien', !faux.length && cibles.length >= 2, `${cibles.join(', ')}${faux.length ? ` ; fautives : ${faux.join(', ')}` : ''}`);

/* ---------- 6. une réponse prise s'applique une fois, et la saison se rejoue au but près ---------- */
const avec = (pred, choix, rang = 0) => { const k = cles.filter(c => pred(c) && REPONSES_VIE[c].options.some(o => o.cle === choix))[rang]; return { k, o: REPONSES_VIE[k].options.find(o => o.cle === choix) }; };
const choisies = [
  { jour: 3, ...avec(c => c.startsWith('ag'), 'annee') },
  { jour: 5, ...avec(c => c.startsWith('ag'), 'conge', 1) },
  { jour: 7, ...avec(c => c.startsWith('ph'), 'conge') },
  { jour: 9, ...avec(c => /^e\d+$/.test(c) && REPONSES_VIE[c].cible === 'gardien', 'repos') },
  { jour: 11, ...avec(c => c.startsWith('pa'), 'victoire') },
  { jour: 13, ...avec(c => c.startsWith('eq'), 'commander') },
  { jour: 15, ...avec(c => c.startsWith('ad'), 'premier') },
];
const decisions = () => choisies.map(({ jour, k, o }) => {
  const fam = REPONSES_VIE[k], joueurs = fam.cible ? ciblesDe(toi, fam.cible).map(getPlayerKey) : [];
  return { jour, equipe: 0, palier: `vie:${jour}:${k}`, moment: { famille: 'vie', cle: k, choix: o.cle, joueur: joueurs[0] || null, joueurs }, sel: `sel-${jour}` };
});
function jouer(decs) {
  const t = ligue();
  const L = simulateLeague(t, 82, { graine: 'courriels', decisions: decs });
  const ligne = m => `${m.A.name}|${m.B.name}|${m.gfA}-${m.gfB}${m.ot ? 'p' : ''}`;
  return {
    t: t[0],
    feuilles: L.calendrier.flat().map(ligne).join('\n'),
    jours: L.calendrier.map(j => j.map(ligne).join(';')),
    fiches: L.standings.map(e => `${e.name} ${e.W}-${e.L}-${e.OTL} ${e.GF}-${e.GA}`).join('\n'),
    joueurs: L.standings.flatMap(e => SLOTS.map(s => e.roster[s.i]).filter(Boolean).map(p => `${p.n} ${p.simGP} ${p.simG} ${p.simA} ${p.simPM} ${p.simSV || 0}`)).join('\n'),
  };
}
const a = jouer(decisions()), b = jouer(decisions()), sans = jouer([]);
exiger('mêmes décisions, même graine : mêmes pointages, mêmes fiches, mêmes joueurs', a.feuilles === b.feuilles && a.joueurs === b.joueurs && a.fiches === b.fiches, a.fiches.split('\n')[0]);
exiger('les journées d\'avant la première réponse ne bougent pas', a.jours.slice(0, 3).join('\n') === sans.jours.slice(0, 3).join('\n'), 'jours 0 à 2');
exiger('et les réponses changent la suite', a.jours.slice(3).join('\n') !== sans.jours.slice(3).join('\n'), `${sans.fiches.split('\n')[0]} → ${a.fiches.split('\n')[0]}`);

const t = a.t;
const effetsPoses = choisies.map(({ k }) => (t.effets || []).filter(e => e.nom === REPONSES_VIE[k].titre).length);
const attendus = choisies.map(({ o }) => (Object.keys(canauxDe(o)).length || o.ensuite || o.pari ? 1 : 0));
exiger('chaque réponse pose son effet une seule fois (jamais deux)', effetsPoses.every((n, i) => n === attendus[i]), `posés ${effetsPoses.join(',')} · attendus ${attendus.join(',')}`);
const cleVedette = getPlayerKey(vedette);
const absents = [...(t.absents || new Map()).keys()].map(getPlayerKey);
const annees = (t.mutations || []).filter(m => m.cle === 'contrat_annee');
exiger('la modif de l\'agent se pose sur la vedette, une fois', annees.length === 1 && annees[0].joueur === cleVedette, vedette.n);
exiger('le congé de l\'agent met la vedette au vestiaire', absents.includes(cleVedette), vedette.n);
exiger('le repos du gardien appelle l\'auxiliaire', (t.gardienAux || 0) > 0, gardien.n);
exiger('le pari est tiré une seule fois', (t.paris || []).length === 1, `${(t.paris || []).length} pari`);

verdict('Courriels et points de presse');
