/*
 * LES MOTS D'UN CHOIX SONT SES LIGNES (oct. 2026 ; V25 B1b). JP, captures à l'appui : *tous les events et cie, ça a vraiment
 * aucun sens* ; *le texte fitte pas totalement avec les stats des choix*. Une réponse d'histoire (js/dossiers.js) est un
 * effet de la grammaire (js/effets.js) : ses lignes se DÉRIVENT de ce que le moteur joue (`motsDe`, js/impact.js
 * `effetEnChiffres`), plus aucun `bon` ni `prix` écrit à côté qui pourrait les contredire. Ce qui reste à exiger :
 *   1. chaque réponse qui touche le match se VOIT : sur plusieurs vrais clubs, ses canaux, ce qui va au joueur nommé
 *      (`lui`) ou les jambes d'un geste donnent au moins une ligne ; jamais « à peine perceptible » seule ;
 *   2. chaque réponse se DIT : `motsDe` rend au moins une ligne, chacune verte, rouge ou grise, sans accolade oubliée,
 *      et une issue de pari se dit à son nom ;
 *   3. les jetons et l'expérience se versent une fois, à la décision : jamais sous un `quand`, jamais dans une issue de
 *      pari (la caisse reste recomptée des décisions, `check_rogue`, `check_verite`).
 *
 *   node scripts/check_mots.mjs            (une dizaine de secondes ; CLUBS=6 en lit plus)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam } from '../js/sim.js';
import { effetEnChiffres } from '../js/impact.js';
import { CANAUX, motsDe } from '../js/effets.js';
import { DOSSIERS } from '../js/dossiers.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const N_CLUBS = Number(process.env.CLUBS || 4);

/* Des clubs de plusieurs époques : le premier club de shards espacés. */
function clubs(n) {
  const out = [];
  for (let i = 0; i < SAISONS.length && out.length < n; i += Math.max(1, Math.floor(SAISONS.length / n))) {
    const sh = JSON.parse(fs.readFileSync(path.join(DIR, SAISONS[i]), 'utf8'));
    const tags = [...new Set(sh.players.map(p => p.t))];
    for (const tag of tags) {
      let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
      if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
      const p = un.flat().map(x => ({ ...x })); p.forEach(registerHiddenRatings);
      out.push(createTeam(`${tag} ${sh.season}`, tag, autoRoster(p), { season: sh.season }));
      break;
    }
  }
  return out;
}
const TEAMS = clubs(N_CLUBS);

const canauxDe = e => Object.fromEntries(Object.entries(e || {}).filter(([k]) => CANAUX.includes(k)));
/* Les lignes d'un effet sur chaque club, puis celles qui tiennent sur la plupart : { cle → bon }. */
function lignesTenues(effet, duree) {
  const compte = new Map();
  for (const t of TEAMS) {
    for (const m of effetEnChiffres(effet, t, null, null, { duree, par: 'par soir' })) {
      const k = `${m.cle}|${m.bon}`;
      compte.set(k, (compte.get(k) || 0) + 1);
    }
  }
  const tenues = new Map();
  for (const [k, n] of compte) if (n * 2 >= TEAMS.length) { const [cle, bon] = k.split('|'); tenues.set(cle, bon === 'true' ? true : bon === 'false' ? false : null); }
  return tenues;
}
const MAX_FAUTES = Number(process.env.FAUTES || 12), DETAIL = !!process.env.DETAIL;
const fautes = [], faute = t => { if (fautes.length < MAX_FAUTES) fautes.push(t); };
const LIGNE_DU_JOUEUR = { lancers: ['tir', v => v > 1], finition: ['pctTir', v => v > 1], arrets: ['pctArr', v => v < 1], blessure: ['blessure', v => v < 1] };
let nOptions = 0, nLignes = 0;
const versees = [], issues = [];
for (const [k, D] of Object.entries(DOSSIERS)) for (const o of D.options) {
  const id = `${k}.${o.cle}`;
  // 3. Les jetons et l'expérience, une fois, à la décision.
  if (o.quand && (o.jetons || o.xp)) versees.push(`${id} : sous un quand`);
  if (o.pari) for (const b of ['gagne', 'perd']) { const e = o.pari[b] || {}; if (e.jetons || e.xp) versees.push(`${id} : dans l'issue ${b}`); }
  // 2. Chaque réponse se dit.
  const mots = motsDe(o, { qui: 'Lui' });
  if (!mots.length) faute(`${id} : aucune ligne`);
  for (const m of mots) {
    nLignes++;
    if (!m.txt || /[{}]/.test(m.txt) || ![true, false, null].includes(m.bon)) faute(`${id} : la ligne « ${m.txt} »`);
  }
  if (o.pari) {
    const dit = mots.filter(m => /^🎲/.test(m.txt));
    if (dit.length !== 2 || !dit.every(m => /Lui/.test(m.txt) || /rien ne change/.test(m.txt))) issues.push(id);
  }
  // 1. Chaque réponse qui touche le match se voit.
  if (o.pari) continue;
  const e = canauxDe(o.canaux), g = o.gestes || {};
  const geste = g.energieTous || g.energie;
  const siennes = Object.entries(o.lui || {}).filter(([c, v]) => LIGNE_DU_JOUEUR[c] && v !== 1);
  if (!Object.keys(e).length && !geste && !siennes.length) continue;
  nOptions++;
  const lignes = Object.keys(e).length ? lignesTenues(e, o.duree) : new Map();
  if (geste) lignes.set('jambes', geste > 0);
  for (const [c, v] of siennes) lignes.set(LIGNE_DU_JOUEUR[c][0], LIGNE_DU_JOUEUR[c][1](v));
  if (DETAIL) informer(id, `${JSON.stringify(e)} → ${[...lignes].map(([c, b]) => `${b === true ? '🟢' : b === false ? '🔴' : '⚪'}${c}`).join(' ')} | ${mots.map(m => m.txt).join(' · ')}`);
  if (!lignes.size || (lignes.size === 1 && lignes.has('rien'))) faute(`${id} : ne se voit sur aucun club`);
}
informer('les clubs lus', TEAMS.map(t => t.name).join(' · '));
if (!nOptions) informer('les dossiers : banque vide (V22, phase 4)', 'aucune réponse à lire');
exiger('chaque réponse qui touche le match se voit sur la plupart des clubs, et chacune se dit en lignes dérivées', !fautes.length, fautes.join(' · ') || `${nOptions} réponses qui touchent le match, ${nLignes} lignes`);
exiger('une audace dit ses deux issues au nom du joueur', !issues.length, issues.join(' · ') || 'chaque dé');
exiger('les jetons et l\'expérience se versent une fois, à la décision : jamais sous un quand ni dans une issue', !versees.length, versees.join(' · ') || 'aucun');
verdict('Les mots d\'un choix sont ses lignes');
