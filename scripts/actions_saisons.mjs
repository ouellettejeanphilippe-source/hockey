/**
 * UNE PHOTO PAR SAISON (oct. 2026).
 *
 *   node scripts/actions_saisons.mjs --brut <dossier>                       # la collecte, le cadrage, l'écriture
 *   node scripts/actions_saisons.mjs --brut <dossier> --collecte            # la collecte seulement (Commons), puis s'arrête
 *   node scripts/actions_saisons.mjs --brut <dossier> --planche <dossier>   # plus les planches de la vérification à l'œil
 *   node scripts/actions_saisons.mjs --brut <dossier> --sec                 # mesure seulement : rien n'est écrit au dépôt
 *
 * JP : *photos libres aussi pour saisons récentes, si possible une photo par joueur par an pour pas toujours
 * utiliser celle de sa dernière saison, ça a l'air fou*. La photo de la LNH (scripts/actions.mjs) est celle
 * d'aujourd'hui, souvent sous un autre chandail : la carte de Daniel Sedin 2003-04 le montrait en 2018. Ce script
 * cherche, pour chaque joueur-saison de nos données, une photo de match de CETTE saison, sous licence libre (les
 * mêmes règles que scripts/actions_commons.mjs : domaine public, CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA ;
 * jamais ND, jamais sans licence), et l'écrit dans img/actions/{id}-{saison}.webp. Une carte de cette saison la
 * prend avant la photo générale (`actionSrc(id, saison)`, js/actions.js) ; une autre saison garde la générale.
 *
 * 1. LA COLLECTE. Wikidata relie un joueur à la LNH (P3522, notre `id`) et à sa catégorie de Commons (P373). Ses
 *    sous-catégories qui portent son nom (« Daniel Sedin with the Vancouver Canucks ») la suivent, deux niveaux
 *    au plus. Les fichiers se lisent par la recherche de Commons (`incategory:A|B|…`, plusieurs catégories par
 *    requête) avec leur date (DateTimeOriginal), leur licence, leur auteur, leur taille et leurs catégories.
 *    Commons limite les anonymes d'une même adresse (429 et `retry-after`, que `poli` suit) : la collecte garde
 *    chaque réponse dans le brut et reprend où elle s'est arrêtée.
 *
 * 2. UNE DATE → UNE SAISON. Une catégorie de saison (« 2008-09 Vancouver Canucks season ») la dit d'abord ; sinon
 *    la date de la prise (ou, à défaut, celle du titre), au mois près : de septembre (le camp) à juin. Juillet et
 *    août sont hors glace ; une date sans mois, une « date de téléversement », deux saisons à la fois : écartées.
 *    Seules comptent les saisons où le joueur est dans nos données.
 *
 * 3. LE CLASSEMENT D'UNE SAISON. Le club de cette saison nommé (la catégorie de saison, puis son surnom dans les
 *    catégories ou le titre) d'abord ; un autre club de la LNH nommé seul, en dernier. Puis la résolution utile
 *    (en 5:7), puis le paysage (le recadrage est fait pour lui). Écartés d'office : une cérémonie, un défilé, des
 *    autographes, un portrait, un banc, un entraîneur, une carte de hockey, l'équipe nationale, les Étoiles, une
 *    ligue mineure ou d'Europe sans le club nommé.
 *
 * 4. LE TÉLÉCHARGEMENT, UN À LA FOIS : la vignette de 960 px du premier candidat ; s'il ne passe pas, le suivant,
 *    trois au plus. Le visage (YuNet, scripts/visages_actions.py --json) : un visage principal — aucun (sauf un
 *    gardien masqué, laissé à l'œil) ou trois et plus (un groupe) écarte ; un portrait posé (la face à plus de 40 %
 *    de la carte, 28 % en noir et blanc) écarte. Le recadrage 5:7 de js/recadrage-action.js, dans Chromium, centré
 *    sur la face, 400 × 560, comme les autres.
 *
 * 5. L'ŒIL (`scripts/actions_saisons.oeil.json`). Les planches (--planche) montrent chaque photo recadrée avec le
 *    nom, la saison et le club attendu. Une photo n'entre qu'une fois gardée à l'œil (`gardees`) ; les autres
 *    listes écartent, par motif, chacune par son numéro de page de Commons (stable quand un fichier est renommé).
 *    Une relance ne reprend jamais un fichier écarté : elle passe au candidat suivant, qui attend l'œil.
 *
 * 6. LE BUDGET (≈ 150 Mo d'images au plus) : d'abord les saisons de 40 matchs et plus, puis par points.
 *
 * 7. data/actions.json, en forme compacte (le fichier se lit au démarrage) : `saisons` { id → { saison → [le
 *    fichier, son dossier sur upload.wikimedia.org (les deux premiers caractères du md5 de son nom), la largeur de
 *    la vignette (0 : l'original), l'auteur (index dans `auteurs`), la licence (index dans `licences`), le centre
 *    du visage dans la vignette (pour le recadrage de l'appareil, ou null), le centre de la face dans la photo
 *    5:7 [x, y] (scripts/visages_actions.py --cadres, ou null)] } }. Le reste du fichier ne bouge pas.
 *
 * Le brut (les réponses, les vignettes) vit hors du dépôt, dans --brut.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { recadrerAction } from '../js/recadrage-action.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (nom, def) => { const i = process.argv.indexOf(`--${nom}`); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const UA = 'Cap82-0/1.0 (https://github.com/ouellettejeanphilippe-source/hockey)';
const LARGEUR = 400, HAUTEUR = 560, QUALITE = 0.8, VIGNETTE = 960, UTILE_MIN = 300, CANDIDATS = 3;
const BUDGET = Number(arg('budget', 150)) * 1048576;
const BRUT = arg('brut', path.join(os.tmpdir(), 'cap82-saisons'));
const SEC = !!arg('sec', false), PLANCHE = arg('planche', null), COLLECTE = !!arg('collecte', false);
const SORTIE = path.join(ROOT, 'img', 'actions');
const LISTE = path.join(ROOT, 'data', 'actions.json');
const OEIL = path.join(ROOT, 'scripts', 'actions_saisons.oeil.json');
const pause = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
for (const d of ['', 'img']) fs.mkdirSync(path.join(BRUT, d), { recursive: true });
const lireJson = (f, def) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : def);

/* Nos joueurs-saisons : le nom, le poste, et, par saison, le club, les matchs et les points. */
const joueurs = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json')).sort()) {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8'));
  for (const p of s.players) {
    if (!p.id) continue;
    const id = Number(p.id), j = joueurs.get(id) || { id, n: p.n, g: p.p === 'G', saisons: new Map(), pts: 0 };
    // Un joueur échangé a une ligne par club, chacune avec la saison entière : ses clubs, une seule fois ses chiffres.
    const deja = j.saisons.get(s.season);
    if (deja) { deja.ts.push(p.t); continue; }
    j.saisons.set(s.season, { ts: [p.t], gp: p.gp || 0, pt: p.pt ?? ((p.g || 0) + (p.a || 0)) });
    j.pts += j.g ? (p.gp || 0) : (p.pt || 0) + (p.gp || 0) * 0.3;
    joueurs.set(id, j);
  }
}

/* Les surnoms des clubs, par code (les catégories de Commons sont en anglais). */
const SURNOMS = {
  MTL: 'Canadiens|Habs', TOR: 'Maple Leafs', BOS: 'Bruins', NYR: 'Rangers', DET: 'Red Wings', CHI: 'Blackhawks|Black Hawks',
  PHI: 'Flyers', PIT: 'Penguins', STL: 'Blues', LAK: 'Kings', BUF: 'Sabres', VAN: 'Canucks', MNS: 'North Stars',
  DAL: 'Dallas Stars', CGS: 'Golden Seals|California Seals', CLE: 'Cleveland Barons', NYI: 'Islanders', AFM: 'Atlanta Flames',
  CGY: 'Calgary Flames', WSH: 'Capitals', KCS: 'Kansas City Scouts', CLR: 'Colorado Rockies', NJD: 'Devils', EDM: 'Oilers',
  QUE: 'Nordiques', COL: 'Avalanche', HFD: 'Whalers', CAR: 'Hurricanes', WIN: 'Winnipeg Jets', PHX: 'Phoenix Coyotes',
  ARI: 'Arizona Coyotes', UTA: 'Utah Hockey Club|Utah Mammoth', SJS: 'Sharks', OTT: 'Senators', TBL: 'Lightning', ANA: 'Ducks',
  FLA: 'Panthers', NSH: 'Predators', ATL: 'Thrashers', WPG: 'Winnipeg Jets', CBJ: 'Blue Jackets', MIN: 'Minnesota Wild',
  VGK: 'Golden Knights', SEA: 'Kraken',
};
const REGEX_CLUB = Object.fromEntries(Object.entries(SURNOMS).map(([c, s]) => [c, new RegExp(`\\b(${s})\\b`, 'i')]));

const sansAccent = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nettoyer = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, '\'').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

/* Une requête polie : le User-Agent, une à la fois, et le `retry-after` suivi (Commons limite l'adresse entière). */
let derniere = 0, n429 = 0, nReq = 0;
async function poli(url, { json = true, ecart = 700, essais = 40 } = {}) {
  for (let essai = 0; essai < essais; essai++) {
    const attente = derniere + ecart - Date.now();
    if (attente > 0) await pause(attente);
    derniere = Date.now();
    try {
      nReq++;
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: AbortSignal.timeout(90000) });
      if (r.status === 429 || r.status >= 500) {
        n429++;
        await pause((Number(r.headers.get('retry-after')) || 10) * 1000 + 500); continue;
      }
      if (!r.ok) return null;
      return json ? await r.json() : Buffer.from(await r.arrayBuffer());
    } catch { await pause(3000 * Math.min(essai + 1, 5)); }
  }
  return null;
}
const api = params => poli(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', ...params })}`);

/* ---------- 1. La collecte ---------- */

const WD = path.join(BRUT, 'wd_cat.json');
if (!fs.existsSync(WD)) {
  const q = 'SELECT ?nhl ?cat WHERE { ?p wdt:P3522 ?nhl ; wdt:P373 ?cat . }';
  const d = await poli(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`);
  fs.writeFileSync(WD, JSON.stringify(d));
}
const catDe = new Map();   // id → la catégorie du joueur
for (const b of lireJson(WD).results.bindings) {
  const id = Number(b.nhl.value);
  if (joueurs.has(id) && !catDe.has(id)) catDe.set(id, b.cat.value.replace(/_/g, ' '));
}
// Les joueurs les plus importants d'abord : si la collecte s'arrête, ce sont eux qui ont leurs photos.
const ordre = [...catDe.keys()].sort((a, b) => joueurs.get(b).pts - joueurs.get(a).pts);
console.log(`\n  ${joueurs.size} joueurs, ${[...joueurs.values()].reduce((a, j) => a + j.saisons.size, 0)} joueurs-saisons ; ${catDe.size} avec une catégorie de Commons · brut dans ${BRUT}`);

// Les catégories : leur taille (fichiers, sous-catégories), puis les sous-catégories qui portent le nom du joueur.
const CINFO = path.join(BRUT, 'cinfo.json'), SOUS = path.join(BRUT, 'sous.json');
const cinfo = lireJson(CINFO, {}), sous = lireJson(SOUS, {});
async function tailles(cats) {
  const manquent = [...new Set(cats)].filter(c => !(c in cinfo));
  for (let i = 0; i < manquent.length; i += 50) {
    const lot = manquent.slice(i, i + 50);
    const d = await api({ prop: 'categoryinfo', titles: lot.map(c => `Category:${c}`).join('|'), redirects: '1' });
    const vers = new Map(lot.map(c => [`Category:${c}`, c]));
    for (const n of [...(d?.query?.normalized || []), ...(d?.query?.redirects || [])]) if (vers.has(n.from)) vers.set(n.to, vers.get(n.from));
    for (const p of d?.query?.pages || []) { const c = vers.get(p.title); if (c) cinfo[c] = p.categoryinfo ? { f: p.categoryinfo.files, s: p.categoryinfo.subcats } : { f: 0, s: 0 }; }
    for (const c of lot) if (!(c in cinfo)) cinfo[c] = { f: 0, s: 0 };
    fs.writeFileSync(CINFO, JSON.stringify(cinfo));
    process.stdout.write(`\r  catégories : ${Math.min(i + 50, manquent.length)} / ${manquent.length} mesurées`);
  }
  if (manquent.length) console.log('');
}
// Une sous-catégorie qui n'est pas lui en match : sa famille, son chandail, ses cartes, ses autographes…
const SOUS_INTERDITES = /\b(jerseys?|family|families|autographs?|signatures?|cards?|statues?|portraits?|coach|coaching|draft|awards?|ceremon|wedding|retire|house|honou?rs?|logos?|art|drawings?|videos?)\b/i;
const catsDe = new Map();   // id → ses catégories (la sienne et les sous-catégories retenues)
await tailles([...catDe.values()]);
for (let niveau = 0; niveau < 2; niveau++) {
  for (const id of ordre) {
    const j = joueurs.get(id), nom = sansAccent(j.n.split(' ').slice(-1)[0]);
    const cats = catsDe.get(id) || [catDe.get(id)];
    catsDe.set(id, cats);
    for (const c of [...cats]) {
      if (!cinfo[c] || !cinfo[c].s) continue;
      if (!(c in sous)) {
        const d = await api({ list: 'categorymembers', cmtitle: `Category:${c}`, cmtype: 'subcat', cmlimit: '500' });
        sous[c] = (d?.query?.categorymembers || []).map(m => m.title.replace(/^Category:/, ''));
        fs.writeFileSync(SOUS, JSON.stringify(sous));
      }
      for (const s of sous[c]) if (sansAccent(s).includes(nom) && !SOUS_INTERDITES.test(s) && !cats.includes(s)) cats.push(s);
    }
  }
  await tailles([...catsDe.values()].flat());
  console.log(`  sous-catégories, niveau ${niveau + 1} : ${[...catsDe.values()].reduce((a, l) => a + l.length, 0)} catégories pour ${catsDe.size} joueurs (${nReq} requêtes, ${n429} refus)`);
}

// Les fichiers, par la recherche : plusieurs catégories par requête (« incategory:A|B|C »), 500 résultats au plus.
const FICHIERS = path.join(BRUT, 'fichiers.json'), FAITES = path.join(BRUT, 'faites.json');
const fichiers = lireJson(FICHIERS, {}), faites = new Set(lireJson(FAITES, []));
const aLire = [...new Set(ordre.flatMap(id => catsDe.get(id)))].filter(c => cinfo[c]?.f > 0 && !faites.has(c));
const totalFichiers = aLire.reduce((a, c) => a + cinfo[c].f, 0);
console.log(`  fichiers : ${aLire.length} catégories à lire (${totalFichiers} fichiers), ${faites.size} déjà lues`);
const METAS = 'DateTimeOriginal|LicenseShortName|License|Artist|NonFree|Categories|ObjectName';
let lus = 0;
for (let i = 0; i < aLire.length;) {
  const lot = [];
  let somme = 0;
  while (i < aLire.length && lot.length < 12 && (somme + cinfo[aLire[i]].f <= 450 || !lot.length)) { somme += cinfo[aLire[i]].f; lot.push(aLire[i++]); }
  // Une catégorie qui a un « | » ou des guillemets ne se cherche pas ainsi (rare) : elle est sautée.
  const propres = lot.filter(c => !/[|"]/.test(c));
  let offset = 0;
  for (let page = 0; page < 20 && propres.length; page++) {
    const d = await api({ generator: 'search', gsrsearch: `incategory:${propres.map(c => c.replace(/ /g, '_')).join('|')}`, gsrnamespace: '6', gsrlimit: '500', gsroffset: String(offset), prop: 'imageinfo', iiprop: 'size|mime|extmetadata|url', iiextmetadatafilter: METAS });
    if (!d) break;
    for (const p of d.query?.pages || []) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata || {};
      fichiers[p.pageid] = {
        t: p.title.replace(/^File:/, ''), w: ii.width, h: ii.height, mime: ii.mime, url: ii.url,
        dto: nettoyer(m.DateTimeOriginal?.value).slice(0, 120), lic: nettoyer(m.LicenseShortName?.value), licc: String(m.License?.value || ''),
        nf: m.NonFree?.value && String(m.NonFree.value) !== 'false' ? 1 : 0, art: nettoyer(m.Artist?.value).slice(0, 200),
        cats: String(m.Categories?.value || '').split('|').filter(Boolean), on: nettoyer(m.ObjectName?.value).slice(0, 200),
      };
    }
    if (!d.continue?.gsroffset) break;
    offset = d.continue.gsroffset;
  }
  for (const c of lot) faites.add(c);
  lus += lot.length;
  if (lus % 60 < lot.length || i >= aLire.length) {
    fs.writeFileSync(FICHIERS, JSON.stringify(fichiers)); fs.writeFileSync(FAITES, JSON.stringify([...faites]));
    console.log(`   ${lus} / ${aLire.length} catégories, ${Object.keys(fichiers).length} fichiers (${nReq} requêtes, ${n429} refus, ${Math.round((Date.now() - t0) / 60000)} min)`);
  }
}
fs.writeFileSync(FICHIERS, JSON.stringify(fichiers)); fs.writeFileSync(FAITES, JSON.stringify([...faites]));
if (COLLECTE) { console.log(`  collecte faite : ${Object.keys(fichiers).length} fichiers (${nReq} requêtes, ${n429} refus)\n`); process.exit(0); }

/* ---------- 2. Les candidats, saison par saison ---------- */

const NOMS = {
  MTL: 'Montr[eé]al Canadiens', TOR: 'Toronto Maple Leafs', BOS: 'Boston Bruins', NYR: 'New York Rangers', DET: 'Detroit Red Wings',
  CHI: 'Chicago Black ?hawks', PHI: 'Philadelphia Flyers', PIT: 'Pittsburgh Penguins', STL: 'St\\.? Louis Blues', LAK: 'Los Angeles Kings',
  BUF: 'Buffalo Sabres', VAN: 'Vancouver Canucks', MNS: 'Minnesota North Stars', DAL: 'Dallas Stars', CGS: 'California Golden Seals',
  CLE: 'Cleveland Barons', NYI: 'New York Islanders', AFM: 'Atlanta Flames', CGY: 'Calgary Flames', WSH: 'Washington Capitals',
  KCS: 'Kansas City Scouts', CLR: 'Colorado Rockies', NJD: 'New Jersey Devils', EDM: 'Edmonton Oilers', QUE: 'Quebec Nordiques',
  COL: 'Colorado Avalanche', HFD: 'Hartford Whalers', CAR: 'Carolina Hurricanes', WIN: 'Winnipeg Jets', PHX: 'Phoenix Coyotes',
  ARI: 'Arizona Coyotes', UTA: 'Utah (Hockey Club|Mammoth)', SJS: 'San Jose Sharks', OTT: 'Ottawa Senators', TBL: 'Tampa Bay Lightning',
  ANA: '(Mighty Ducks of )?Anaheim( Mighty)? Ducks', FLA: 'Florida Panthers', NSH: 'Nashville Predators', ATL: 'Atlanta Thrashers',
  WPG: 'Winnipeg Jets', CBJ: 'Columbus Blue Jackets', MIN: 'Minnesota Wild', VGK: 'Vegas Golden Knights', SEA: 'Seattle Kraken',
};
const REGEX_NOM = Object.fromEntries(Object.entries(NOMS).map(([c, s]) => [c, new RegExp(`\\b(${s})\\b`, 'i')]));
// Écartés d'office : pas lui en match (une cérémonie, un banc, un portrait, une carte…).
const EXCLUS = /\b(autograph\w*|signing|signs|ceremon\w*|parade|banquet|awards?|draft|press conference|interview|head ?shots?|mug ?shots?|portraits?|statues?|hall of fame|famil(y|ies)|wedding|golf|charity|white house|red carpet|trading cards?|hockey cards?|panini|topps|stickers?|retire\w*|banners?|fan ?fest|meet and greet|hospital|military|troops|bench|coach\w*|stanley cup (celebration|rally|parade)|day with the cup|mascots?|cheerleaders?|anthem|alumni|old-?timers|legends game|podcast|studio|broadcast\w*|commentator)\b/i;
// L'équipe nationale, les Étoiles : pas le chandail de son club.
const NATIONALE = /\b(olympics?|olympic games|world (ice hockey )?championships?|world juniors?|world cup of hockey|national (ice hockey )?team|men's national|iihf|team (canada|usa|sweden|finland|russia|czech)|tre kronor|spengler|4 nations|four nations|summit series|canada cup|all-?star\w*|skills competition|euro hockey|l[aä]nderspiel|deutschland gegen|match de pools)\b/i;
// Une ligue mineure ou d'Europe : écartée, sauf si son club de la LNH est nommé en toutes lettres.
const AILLEURS = /\b(AHL|American Hockey League|ECHL|IHL|OHL|WHL|QMJHL|LHJMQ|NCAA|college|university|KHL|SHL|Elitserien|Allsvenskan|Liiga|SM-liiga|DEL|National League A|Swiss League|Extraliga|junior|Calder Cup|Memorial Cup|Hockey East|minor league)\b/i;
const PRATIQUE = /\b(practice|training camp|morning skate|scrimmage|development camp|dev camp|prospects)\b/i;
const MOIS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const MOT_MOIS = Object.keys(MOIS).join('|');
const saisonDe = (y, m) => (m >= 9 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : m <= 6 ? `${y - 1}-${String(y % 100).padStart(2, '0')}` : 'été');
/* Les saisons que dit un texte (une date au mois près) : [« 2009-10 », …] ; « été » pour juillet et août. */
function saisonsDeTexte(t) {
  const out = new Set();
  for (const m of String(t).matchAll(/(?<![\d.])(19[5-9]\d|20[0-2]\d)[-:./](0[1-9]|1[0-2])(?![\d])/g)) out.add(saisonDe(+m[1], +m[2]));
  for (const m of String(t).matchAll(new RegExp(`\\b(${MOT_MOIS})\\.?\\s+(?:\\d{1,2}(?:st|nd|rd|th)?,?\\s+)?(19[5-9]\\d|20[0-2]\\d)\\b`, 'gi'))) out.add(saisonDe(+m[2], MOIS[m[1].toLowerCase()]));
  for (const m of String(t).matchAll(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(${MOT_MOIS})\\s+(19[5-9]\\d|20[0-2]\\d)\\b`, 'gi'))) out.add(saisonDe(+m[2], MOIS[m[1].toLowerCase()]));
  return [...out];
}
/* La licence courte, et si elle est permise (les règles de scripts/actions_commons.mjs). */
function licence(x) {
  const court = x.lic, code = x.licc.toLowerCase();
  if (x.nf) return null;
  if (/\bnd\b/i.test(court) || /-nd\b/.test(code)) return null;
  if (code === 'pd' || /^public domain$/i.test(court) || /^pd\b/i.test(court)) return 'Domaine public';
  if (code.startsWith('cc0') || /^cc0\b/i.test(court)) return 'CC0';
  const cc = court.match(/^CC BY(-NC)?(-SA)? (\d\.\d)(?: ([a-z]{2}(?:-[a-z]+)?))?$/i);
  return cc ? `CC BY${cc[1] ? '-NC' : ''}${cc[2] ? '-SA' : ''} ${cc[3]}` : null;
}
const auteurDe = x => {
  let a = x.art.replace(/^(photo|photograph|photographer|author)\s*(by|:)\s*/i, '').replace(/\s*\(talk\)$/i, '');
  if (!a || /^(unknown|unknown author|anonymous)\b/i.test(a)) a = 'Auteur inconnu';
  return a.length > 60 ? `${a.slice(0, 57).replace(/\s+\S*$/, '')}…` : a;
};

const lu = lireJson(LISTE);
const generale = new Map(Object.entries(lu.commons || {}).map(([id, c]) => [Number(id), c.f]));
const deCat = new Map();
for (const [id, cats] of catsDe) for (const c of cats) deCat.set(c, [...new Set([...(deCat.get(c) || []), id])]);
const motifs = {};
const compter = m => { motifs[m] = (motifs[m] || 0) + 1; };
const cibles = new Map();   // « id-saison » → { id, saison, ts, candidats: [{ pid, t, rang, … }] }
for (const [pid, x] of Object.entries(fichiers)) {
  const ids = [...new Set(x.cats.flatMap(c => deCat.get(c) || []))];
  if (!ids.length) continue;
  const l = licence(x);
  if (!l) { compter('licence non permise'); continue; }
  if (!/^image\/(jpeg|png|webp)$/.test(x.mime)) { compter('pas une photo (svg, gif, tiff…)'); continue; }
  const w = Math.min(x.w, VIGNETTE), h = x.h * w / x.w, utile = Math.min(w, h * LARGEUR / HAUTEUR);
  if (utile < UTILE_MIN) { compter('trop petite'); continue; }
  const texte = `${x.t} ${x.cats.join(' | ')} ${x.on}`;
  if (EXCLUS.test(texte)) { compter('une cérémonie, un banc, un portrait, une carte…'); continue; }
  if (NATIONALE.test(texte)) { compter('l\'équipe nationale ou les Étoiles'); continue; }
  const dossier = (x.url.match(/\/commons\/([0-9a-f])\/([0-9a-f]{2})\//) || [])[2];
  if (!dossier) { compter('adresse inattendue'); continue; }
  // La saison : une catégorie de saison d'abord, sinon la date de la prise, sinon celle du titre.
  const deSaisonCat = x.cats.map(c => c.match(/^(\d{4})[-–](\d{2}) (.+) season$/)).filter(Boolean);
  const upload = /upload/i.test(x.dto);
  const parDate = upload ? [] : saisonsDeTexte(x.dto);
  const parTitre = saisonsDeTexte(x.t.replace(/\.[a-z]+$/i, ''));
  for (const id of ids) {
    const j = joueurs.get(id);
    const sesCats = deSaisonCat.map(m => `${m[1]}-${m[2]}`).filter(s => j.saisons.has(s));
    const dates = parDate.length ? parDate : parTitre;
    let saison = null;
    // La catégorie de saison et la date se contredisent : le doute écarte.
    if (new Set(sesCats).size === 1) saison = dates.length === 1 && dates[0] !== sesCats[0] && parDate.length ? null : sesCats[0];
    else if (dates.length === 1 && dates[0] !== 'été') saison = dates[0];
    if (!saison) { compter(dates.includes('été') && dates.length === 1 && !sesCats.length ? 'datée de juillet ou août (hors glace)' : dates.length > 1 || sesCats.length ? 'deux saisons à la fois' : 'sans date au mois près'); continue; }
    const s = j.saisons.get(saison);
    if (!s) { compter('une saison hors de nos données'); continue; }
    if (generale.get(id) === x.t) { compter('déjà sa photo générale'); continue; }
    // Le club : la catégorie de saison de son club (3), son nom entier (2), son surnom (1) ; un autre club seul (−1).
    const club = s.ts.map(t => {
      const cat = deSaisonCat.some(m => `${m[1]}-${m[2]}` === saison && REGEX_NOM[t].test(m[3]));
      return [t, cat ? 3 : REGEX_NOM[t].test(texte) ? 2 : REGEX_CLUB[t].test(texte) ? 1 : 0];
    }).sort((a, b) => b[1] - a[1])[0];
    const autres = Object.keys(NOMS).filter(c => !s.ts.includes(c) && NOMS[c] !== NOMS[club[0]] && REGEX_NOM[c].test(texte));
    let score = club[1] || (autres.length ? -1 : 0);
    if (AILLEURS.test(texte) && club[1] < 2) { compter('une ligue mineure ou d\'Europe'); continue; }
    // Un joueur échangé : la photo doit nommer le club de la carte.
    if (s.ts.length > 1 && club[1] < 1) { compter('échangé dans la saison, sans le club nommé'); continue; }
    if (PRATIQUE.test(texte)) score -= 0.5;
    const cle = `${id}-${saison}`;
    const c = cibles.get(cle) || { id, saison, ts: s.ts, gp: s.gp, pt: s.pt, candidats: [] };
    c.candidats.push({ pid: Number(pid), t: s.ts.length > 1 ? club[0] : null, score, chez: ids.length, utile: Math.min(utile, HAUTEUR), paysage: x.w > x.h ? 1 : 0,
      f: x.t, dossier, largeur: x.w > VIGNETTE ? VIGNETTE : 0, a: auteurDe(x), l, date: x.dto.slice(0, 30) || '(titre)' });
    cibles.set(cle, c);
  }
}
for (const c of cibles.values()) c.candidats.sort((a, b) => b.score - a.score || a.chez - b.chez || b.utile - a.utile || b.paysage - a.paysage || a.pid - b.pid);
// L'ordre : les saisons de 40 matchs et plus d'abord, puis par points (le budget les prend dans cet ordre).
const ordreCibles = [...cibles.values()].sort((a, b) => (b.gp >= 40) - (a.gp >= 40) || b.pt - a.pt || a.id - b.id);
console.log(`\n  CANDIDATS : ${[...cibles.values()].reduce((a, c) => a + c.candidats.length, 0)} fichiers pour ${cibles.size} joueurs-saisons (${ordreCibles.filter(c => c.gp >= 40).length} de 40 matchs et plus)`);
for (const [m, n] of Object.entries(motifs).sort((a, b) => b[1] - a[1])) console.log(`     écartés : ${m} ${n}`);

/* ---------- 3. Le téléchargement, le visage, le cadrage : un candidat à la fois, trois au plus par saison ---------- */

const oeil = lireJson(OEIL, { gardees: [] });
const VU = new Map();
for (const [motif, liste] of Object.entries(oeil)) for (const pid of liste) VU.set(pid, motif);
const RECAD = path.join(BRUT, 'recad.json'), VIS = path.join(BRUT, 'visages.json');
const recad = lireJson(RECAD, {});          // pid → { fenetre, largeurImage, couleur, octets }
let visages = lireJson(VIS, {});
const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.setContent('<body></body>');
await page.addScriptTag({ content: `window.recadrerActionBlob = ${recadrerAction.toString()};` });
await page.evaluate(({ LARGEUR, HAUTEUR, QUALITE }) => {
  window.recadrer = async (b64, centre) => {
    const blob = await (await fetch(`data:application/octet-stream;base64,${b64}`)).blob();
    const { webp, fenetre } = await window.recadrerActionBlob(blob, { largeur: LARGEUR, hauteur: HAUTEUR, qualite: QUALITE, centre });
    // Noir et blanc ? La couleur moyenne (le max moins le min de chaque point) d'une image réduite.
    const img = await createImageBitmap(blob), largeurImage = img.width;
    const c = new OffscreenCanvas(64, 64), x = c.getContext('2d');
    x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data;
    let couleur = 0;
    for (let k = 0; k < d.length; k += 4) couleur += Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]);
    img.close();
    const buf = new Uint8Array(await webp.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { webp: btoa(s), fenetre, largeurImage, couleur: couleur / 4096 };
  };
}, { LARGEUR, HAUTEUR, QUALITE });
fs.mkdirSync(path.join(BRUT, 'webp'), { recursive: true });
const { vignetteCommons } = await import('../js/actions.js');
const brutDe = pid => path.join(BRUT, 'img', `${pid}.jpg`);
/*
 * Le verdict de la machine sur un candidat téléchargé : null (il passe), ou son motif. Un portrait posé : la face à
 * plus de 40 % de la largeur de la carte (28 % en noir et blanc, ou avant 1990). Une face minuscule (moins de 5 %) :
 * une vue des gradins, où la carte ne le montrerait pas.
 */
const PORTRAIT = 0.40, PORTRAIT_ANCIEN = 0.28, NOIR_ET_BLANC = 10, VISAGE_MIN = 0.05;
function machine(c, cand) {
  const v = visages[cand.pid], r = recad[cand.pid];
  if (!v || !r) return 'illisible';
  if (v[2] >= 3) return 'un groupe (trois visages et plus)';
  if (v[2] === 0 && !joueurs.get(c.id).g) return 'aucun visage';
  if (v[2] === 0) return null;   // un gardien masqué : l'œil dira
  const face = v[3] * r.largeurImage / r.fenetre[2];
  if (face > PORTRAIT || (face > PORTRAIT_ANCIEN && (r.couleur < NOIR_ET_BLANC || c.saison < '1990'))) return 'un portrait posé';
  if (face < VISAGE_MIN) return 'trop loin (une face minuscule)';
  return null;
}
const MAX_TELE = Number(arg('max', Infinity));
let telecharges = 0;
const etat = new Map();   // cle → { k : l'index du candidat courant, st : 'gardee' | 'oeil' | 'aucun', motifs }
// Un fichier retenu pour deux joueurs-saisons (deux joueurs sur la photo) : la photo d'aucun des deux.
const doubles = new Set();
const ecarte = pid => doubles.has(pid) || (VU.has(pid) && VU.get(pid) !== 'gardees');
for (let passe = 0; passe < 4; passe++) {
for (let tour = 0; tour < CANDIDATS + 2; tour++) {
  // Les candidats courants qu'il faut télécharger.
  const aFaire = [];
  for (const c of ordreCibles) {
    const cle = `${c.id}-${c.saison}`, e = etat.get(cle) || { k: 0, essais: 0, motifs: [] };
    etat.set(cle, e);
    if (e.st) continue;
    // Un fichier écarté à l'œil : le suivant, sans compter un essai.
    while (e.k < c.candidats.length && ecarte(c.candidats[e.k].pid)) { const pid = c.candidats[e.k].pid; e.motifs.push(doubles.has(pid) ? 'le même fichier, deux joueurs' : VU.get(pid)); e.k++; }
    if (e.k >= c.candidats.length || e.essais >= CANDIDATS) { e.st = 'aucun'; continue; }
    aFaire.push([c, c.candidats[e.k]]);
  }
  if (!aFaire.length) break;
  // Trois téléchargements à la fois au plus (ce que Wikimedia demande), chacun à son pas.
  const file = aFaire.map(([, cand]) => cand).filter(cand => !fs.existsSync(brutDe(cand.pid)));
  await Promise.all([0, 1, 2].map(async () => {
    for (let cand; (cand = file.shift()) && telecharges < MAX_TELE;) {
      telecharges++;
      let buf = null;
      for (let essai = 0; essai < 20 && !buf; essai++) {
        const r = await fetch(vignetteCommons([cand.f, cand.dossier, cand.largeur]), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(90000) }).catch(() => null);
        nReq++;
        if (r && (r.status === 429 || r.status >= 500)) { n429++; await pause((Number(r.headers.get('retry-after')) || 10) * 1000 + 500); continue; }
        if (!r) { await pause(5000); continue; }
        buf = r.ok ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0);
      }
      fs.writeFileSync(brutDe(cand.pid), buf && buf.length > 4096 ? buf : '');
      if (telecharges % 200 === 0) console.log(`   ${telecharges} vignettes téléchargées (${nReq} requêtes, ${n429} refus, ${Math.round((Date.now() - t0) / 60000)} min)`);
      await pause(400);
    }
  }));
  const py = spawnSync('python3', [path.join(ROOT, 'scripts', 'visages_actions.py'), path.join(BRUT, 'img'), '--json', VIS], { stdio: 'inherit' });
  if (py.status !== 0) throw new Error('scripts/visages_actions.py a échoué (pip install opencv-python-headless)');
  visages = lireJson(VIS, {});
  for (const [c, cand] of aFaire) {
    const e = etat.get(`${c.id}-${c.saison}`);
    if (!fs.existsSync(brutDe(cand.pid))) { e.st = 'attente'; continue; }   // --max atteint
    if (!(cand.pid in recad) && visages[cand.pid]) {
      try {
        const x = await page.evaluate(([b, ctr]) => window.recadrer(b, ctr), [fs.readFileSync(brutDe(cand.pid)).toString('base64'), visages[cand.pid][0]]);
        const webp = Buffer.from(x.webp, 'base64');
        fs.writeFileSync(path.join(BRUT, 'webp', `${cand.pid}.webp`), webp);
        recad[cand.pid] = { fenetre: x.fenetre, largeurImage: x.largeurImage, couleur: x.couleur, octets: webp.length };
      } catch { recad[cand.pid] = null; }
    }
    const motif = machine(c, cand);
    e.essais++;
    if (motif) { e.motifs.push(motif); e.k++; continue; }
    e.st = VU.get(cand.pid) === 'gardees' ? 'gardee' : 'oeil';
  }
  fs.writeFileSync(RECAD, JSON.stringify(recad));
}
  const qui = new Map();
  for (const c of ordreCibles) {
    const e = etat.get(`${c.id}-${c.saison}`);
    if (e.st === 'gardee' || e.st === 'oeil') { const pid = c.candidats[e.k].pid; qui.set(pid, [...(qui.get(pid) || []), e]); }
  }
  const neufs = [...qui].filter(([, l]) => l.length > 1);
  if (!neufs.length) break;
  for (const [pid, l] of neufs) { doubles.add(pid); for (const e of l) e.st = undefined; }
}

const parSt = st => [...etat.values()].filter(e => e.st === st).length;
const motifsMachine = {};
for (const e of etat.values()) for (const m of e.motifs) motifsMachine[m] = (motifsMachine[m] || 0) + 1;
console.log(`\n  ${telecharges} vignettes téléchargées cette fois ; ${parSt('gardee')} gardées à l'œil, ${parSt('oeil')} attendent l'œil, ${parSt('aucun')} sans photo, ${parSt('attente')} pas encore téléchargées`);
console.log(`  candidats écartés : ${Object.entries(motifsMachine).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

/* ---------- 4. Le budget, l'écriture ---------- */

const courant = c => c.candidats[etat.get(`${c.id}-${c.saison}`).k];
const md5 = b => createHash('md5').update(b).digest('hex');
const finales = [];
let octets = 0;
const vusMd5 = new Set();
for (const c of ordreCibles) {
  if (etat.get(`${c.id}-${c.saison}`).st !== 'gardee') continue;
  const cand = courant(c), webp = fs.readFileSync(path.join(BRUT, 'webp', `${cand.pid}.webp`));
  if (octets + webp.length > BUDGET) break;
  const h = md5(webp);
  if (vusMd5.has(h)) continue;   // le même fichier, deux joueurs-saisons : la photo d'aucun
  vusMd5.add(h);
  octets += webp.length;
  finales.push([c, cand, webp]);
}
const restent = ordreCibles.filter(c => etat.get(`${c.id}-${c.saison}`).st === 'gardee').length - finales.length;
console.log(`  ENTRENT : ${finales.length} photos de saison (${(octets / 1048576).toFixed(1)} Mo)${restent ? `, ${restent} gardées hors du budget` : ''}`);
const decennies = {};
for (const [c] of finales) { const d = `${c.saison.slice(0, 3)}0`; decennies[d] = (decennies[d] || 0) + 1; }
console.log(`  par décennie : ${Object.entries(decennies).sort().map(([k, v]) => `${k} ${v}`).join(' · ')} ; 40 matchs et plus : ${finales.filter(([c]) => c.gp >= 40).length}`);
const parLicence = {};
for (const [, cand] of finales) { const l = cand.l.replace(/ \d\.\d$/, ''); parLicence[l] = (parLicence[l] || 0) + 1; }
console.log(`  licences : ${Object.entries(parLicence).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

if (!SEC && !COLLECTE) {
  const garder = new Set(finales.map(([c]) => `${c.id}-${c.saison}.webp`));
  for (const f of fs.readdirSync(SORTIE)) if (/^\d+-\d{4}-\d\d\.webp$/.test(f) && !garder.has(f)) fs.rmSync(path.join(SORTIE, f));
  const auteurs = [], licences = [], saisons = {};
  const index = (t, v) => { let i = t.indexOf(v); if (i < 0) { i = t.length; t.push(v); } return i; };
  const avant = lireJson(LISTE);   // relu juste avant d'écrire : un autre script a pu l'écrire entre-temps
  for (const [c, cand, webp] of finales.sort((a, b) => a[0].id - b[0].id || (a[0].saison < b[0].saison ? -1 : 1))) {
    fs.writeFileSync(path.join(SORTIE, `${c.id}-${c.saison}.webp`), webp);
    const v = visages[cand.pid];
    const e = [cand.f, cand.dossier, cand.largeur, index(auteurs, cand.a), index(licences, cand.l), v && v[0] != null ? v[0] : null, avant.saisons?.[c.id]?.[c.saison]?.[0] === cand.f ? avant.saisons[c.id][c.saison][6] : null];
    if (cand.t) e.push(cand.t);
    (saisons[c.id] = saisons[c.id] || {})[c.saison] = e;
  }
  fs.writeFileSync(LISTE, JSON.stringify({ ...avant, saisons, auteurs, licences }));
  // Les cadres de la face dans chaque photo 5:7 (la générale et celles de saison).
  const py = spawnSync('python3', [path.join(ROOT, 'scripts', 'visages_actions.py'), '--cadres'], { stdio: 'inherit' });
  if (py.status !== 0) throw new Error('scripts/visages_actions.py --cadres a échoué');
  console.log(`  écrit : ${finales.length} WebP, data/actions.json (${(fs.statSync(LISTE).size / 1024).toFixed(0)} Ko)`);
}

/* ---------- 5. Les planches de la vérification à l'œil ---------- */

if (PLANCHE) {
  fs.mkdirSync(PLANCHE, { recursive: true });
  // Celles qui attendent l'œil, joueur par joueur (ses saisons côte à côte) ; --revoir les gardées aussi.
  const st = arg('revoir', false) ? ['oeil', 'gardee'] : ['oeil'];
  const liste = ordreCibles.filter(c => st.includes(etat.get(`${c.id}-${c.saison}`).st)).sort((a, b) => joueurs.get(b.id).pts - joueurs.get(a.id).pts || a.id - b.id || (a.saison < b.saison ? -1 : 1));
  const PAR = 32;
  await page.setViewportSize({ width: 1440, height: 900 });
  const cles = [];
  for (let k = 0; k < liste.length; k += PAR) {
    const cases = liste.slice(k, k + PAR).map((c, i) => {
      const cand = courant(c), j = joueurs.get(c.id), v = visages[cand.pid];
      cles.push([k + i + 1, cand.pid, j.n, c.saison, cand.f]);
      return `<figure style="margin:3px;display:inline-block;width:172px;vertical-align:top;color:#ddd;font:10px/1.25 sans-serif">
        <img src="data:image/webp;base64,${fs.readFileSync(path.join(BRUT, 'webp', `${cand.pid}.webp`)).toString('base64')}" style="width:172px;height:241px;display:block">
        <figcaption><b style="color:#fc6">${k + i + 1}. ${j.n}</b><br>${c.saison} · <b>${c.ts.join('/')}</b> · ${cand.score} · ${v ? v[2] : '?'} vis.<br><span style="color:#999">${cand.f.slice(0, 44)}</span></figcaption></figure>`;
    }).join('');
    await page.setContent(`<body style="background:#111;margin:4px;width:1432px">${cases}</body>`);
    await page.screenshot({ path: path.join(PLANCHE, `oeil-${String(k / PAR + 1).padStart(3, '0')}.png`), fullPage: true });
  }
  fs.writeFileSync(path.join(PLANCHE, 'cles.json'), JSON.stringify(cles));
  console.log(`  planches : ${Math.ceil(liste.length / PAR)} (${liste.length} photos) dans ${PLANCHE}`);
}
await navigateur.close();
console.log(`  ${Math.round((Date.now() - t0) / 1000)} s (${nReq} requêtes, ${n429} refus)\n`);
