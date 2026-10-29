/*
 * LES MOTS D'UN CHOIX DISENT SES LIGNES (oct. 2026). JP, captures à l'appui : *tous les events et cie, ça a vraiment
 * aucun sens* ; *le texte fitte pas totalement avec les stats des choix*. Une option est écrite en mots (son bon, son
 * prix) et en canaux ; le moteur la relit en lignes de stats (js/impact.js `effetEnChiffres`), avec les contrecoups
 * que les mots n'avaient pas promis. Ici, sur plusieurs vrais clubs, pour chaque réponse d'un dossier (js/dossiers.js) :
 *   1. chaque ligne verte est nommée par son bon (ou son nom), chaque ligne rouge par son prix (ou son nom), et une
 *      ligne sans couleur (la glace des trios) par l'un ou l'autre ;
 *   2. chaque mot de stat du bon ou du prix a sa ligne, de sa couleur, sur la plupart des clubs ;
 *   3. une réponse qui a des canaux se voit : jamais « à peine perceptible » seule ;
 * Les dilemmes et les routes de la semaine sont partis (V20, docs/refonte-v20.md § 3) ; restent les dossiers. Le
 * personnel écrit ses mots à partir de ses lignes (js/rogue-jeu.js `motsDeLaPersonne`), il ne peut pas les contredire.
 *
 *   node scripts/check_mots.mjs            (une dizaine de secondes ; CLUBS=6 en lit plus)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoRoster, registerHiddenRatings, createTeam } from '../js/sim.js';
import { effetEnChiffres } from '../js/impact.js';
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

/* Le mot de chaque ligne, tel qu'un bon ou un prix doit le dire. */
const MOTS = {
  tir: /\btirs?\b(?! contre)|\btire\b|\btirent\b|\blance\b|\bbombarde\b|\brondelles?\b/i,
  'tir accordé': /\btirs? contre\b|\bchances contre\b/i,
  pctTir: /\bprécision\b|\bvise\b|\bvisent\b/i,
  pctArr: /\barrêts?\b/i,
  punition: /\bpunitions?\b|\bcachot\b/i,
  coup: /\bmises? en échec\b|\bfrappe\b/i,
  blessure: /\bblessures?\b|\bblessés?\b/i,
  jambes: /\bjambes\b/i,
  glace: /\btrios?\b|\bvedettes\b/i,
};
const CANAUX = ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
const canauxDe = o => Object.fromEntries(Object.entries(o).filter(([k]) => CANAUX.includes(k)));
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
let nOptions = 0;
for (const [k, D] of Object.entries(DOSSIERS)) for (const o of D.options) {
  if (o.rien) continue;
  const e = canauxDe(o);
  if (!Object.keys(e).length) continue;
  nOptions++;
  const lignes = lignesTenues(e, o.duree);
  // Un geste sur les jambes (`action.energie`, `energieTous`) est une ligne de jambes, dite en mots par l'écran.
  const geste = o.action && (o.action.energieTous || o.action.energie);
  if (geste) lignes.set('jambes', geste > 0);
  const id = `${k}.${o.cle}`;
  if (DETAIL) informer(id, `${JSON.stringify(e)} → ${[...lignes].map(([c, b]) => `${b === true ? '🟢' : b === false ? '🔴' : '⚪'}${c}`).join(' ')} | + ${o.bon || ''} | − ${o.prix || ''}`);
  if (lignes.size === 1 && lignes.has('rien')) { faute(`${id} : ne se voit sur aucun club`); continue; }
  const bon = `${o.nom} ${o.bon || ''}`, prix = `${o.nom} ${o.prix || ''}`;
  for (const [cle, b] of lignes) {
    if (cle === 'rien') continue;
    const M = MOTS[cle];
    if (!M) { faute(`${id} : une ligne « ${cle} » sans mot connu`); continue; }
    const ou = b === true ? bon : b === false ? prix : `${bon} ${prix}`;
    if (!M.test(ou)) faute(`${id} : la ligne ${cle} (${b === true ? 'verte' : b === false ? 'rouge' : 'grise'}) n'est pas dite ${b === true ? 'au bon' : b === false ? 'au prix' : ''}`);
  }
  for (const [cle, M] of Object.entries(MOTS)) {
    const ditBon = M.test(o.bon || ''), ditPrix = M.test(o.prix || '');
    if (!ditBon && !ditPrix) continue;
    const b = lignes.get(cle);
    if (b === undefined) faute(`${id} : « ${(o.bon || '') + ' / ' + (o.prix || '')} » promet ${cle}, sans ligne`);
    else if (ditBon && b === false) faute(`${id} : le bon dit ${cle}, la ligne est rouge`);
    else if (ditPrix && b === true) faute(`${id} : le prix dit ${cle}, la ligne est verte`);
  }
}
informer('les clubs lus', TEAMS.map(t => t.name).join(' · '));
exiger('chaque réponse d\'un dossier dit ses lignes : le vert au bon, le rouge au prix, rien de promis sans ligne', !fautes.length, fautes.join(' · ') || `${nOptions} réponses`);
verdict('Les mots d\'un choix disent ses lignes');
