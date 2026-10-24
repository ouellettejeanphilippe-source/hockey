/*
 * LE CLUB DE LA PHOTO GÉNÉRALE (oct. 2026). JP : *les photos d'actions sont souvent d'un autre club que le joueur a
 * joué* ; il a choisi : la photo générale seulement quand le club concorde, sinon le portrait.
 *
 * La photo générale d'un joueur (img/actions/{id}.webp) n'est pas de sa saison : la LNH n'en publie qu'une, prise
 * dans sa dernière saison chez elle ; une photo libre (Commons, Openverse) est de l'année où on l'a prise. Ce script
 * écrit, dans data/actions.json, `clubs` : { id → le ou les clubs de cette photo, séparés d'une espace }.
 *   — à l'œil d'abord (`actions_clubs.oeil.json` : id → le club que le chandail montre, lu sur des planches où
 *     chaque photo a les écussons de ses clubs ; « » pour un chandail qu'on ne reconnaît pas) ;
 *   — un joueur d'un seul club dans nos saisons : ce club ;
 *   — la LNH, plusieurs clubs, rien à l'œil : aucun. La photo de la LNH n'est PAS de sa dernière saison : sur un
 *     échantillon de 24 vétérans, la moitié portait le chandail d'un club d'avant (oct. 2026) ;
 *   — Commons : la date de la prise (DateTimeOriginal, au mois près ; sinon l'année du titre) donne la saison, et
 *     la saison son club dans nos données ; une année seule couvre les deux saisons qu'elle touche ;
 *   — sans club, la photo ne se montre que là où aucun club n'est demandé (`actionSrc` sans club).
 * Une carte d'un autre club garde son portrait (`actionSrc`, js/actions.js). Les photos de saison ont déjà le leur.
 *
 *     node scripts/actions_clubs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LISTE = path.join(ROOT, 'data', 'actions.json');
const UA = 'Cap82-0/1.0 (https://github.com/ouellettejeanphilippe-source/hockey)';
const liste = JSON.parse(fs.readFileSync(LISTE, 'utf8'));
const libres = liste.libres || {}, commons = liste.commons || {};
const OEIL = path.join(ROOT, 'scripts', 'actions_clubs.oeil.json');
const oeil = fs.existsSync(OEIL) ? JSON.parse(fs.readFileSync(OEIL, 'utf8')) : {};

// Nos saisons : id → saison → ses clubs.
const parSaison = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json')).sort()) {
  const s = f.slice(0, -5);
  for (const p of JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8')).players) {
    if (!p.id || !p.t) continue;
    if (!parSaison.has(p.id)) parSaison.set(p.id, new Map());
    const m = parSaison.get(p.id);
    m.set(s, [...new Set([...(m.get(s) || []), p.t])]);
  }
}
const saisonDe = an => `${an}-${String((an + 1) % 100).padStart(2, '0')}`;
const clubsDes = (id, saisonsVoulues) => [...new Set(saisonsVoulues.flatMap(s => (parSaison.get(id) && parSaison.get(id).get(s)) || []))];

// Les dates de Commons, cinquante fichiers par requête, en se nommant (Wikimedia l'exige).
const pause = ms => new Promise(r => setTimeout(r, ms));
async function dates(fichiers) {
  const lu = new Map();
  for (let i = 0; i < fichiers.length; i += 50) {
    const titres = fichiers.slice(i, i + 50).map(f => `File:${f}`).join('|');
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=extmetadata&iiextmetadatafilter=DateTimeOriginal&titles=${encodeURIComponent(titres)}`;
    for (let essai = 0; essai < 5; essai++) {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } }).catch(() => null);
      if (r && r.ok) {
        const d = await r.json();
        const normal = new Map((d.query.normalized || []).map(n => [n.to, n.from]));
        for (const pg of d.query.pages || []) {
          const v = pg.imageinfo && pg.imageinfo[0].extmetadata && pg.imageinfo[0].extmetadata.DateTimeOriginal;
          lu.set((normal.get(pg.title) || pg.title).replace(/^File:/, ''), v ? String(v.value).replace(/<[^>]*>/g, ' ') : '');
        }
        break;
      }
      await pause(5000 * (essai + 1));
    }
    await pause(1000);
  }
  return lu;
}

/* Les saisons qu'une date touche : au mois près, une ; à l'année, les deux ; sinon aucune. */
function saisonsDe(date, titre) {
  const m = String(date).match(/\b(19[4-9]\d|20[0-2]\d)[-:/](\d\d)\b/);
  if (m) {
    const an = Number(m[1]), mois = Number(m[2]);
    return [saisonDe(mois >= 7 ? an : an - 1)];
  }
  const ans = [...new Set(`${date} ${titre.replace(/\.[a-z]+$/i, '')}`.match(/(?<![\d.])(19[4-9]\d|20[0-2]\d)(?![\d])/g) || [])].map(Number);
  if (ans.length !== 1) return [];
  return [saisonDe(ans[0] - 1), saisonDe(ans[0])];
}

const lues = await dates(Object.values(commons).map(c => c.f));
const clubs = {}, compte = { oeil: 0, unClub: 0, commons: 0, sansDate: 0, libres: 0, lnhSansOeil: 0, horsDonnees: 0 };
for (const id of liste.ids) {
  const cle = String(id);
  const tous = parSaison.has(id) ? [...new Set([...parSaison.get(id).values()].flat())] : [];
  let cs = [];
  if (cle in oeil) {
    if (oeil[cle]) { clubs[cle] = oeil[cle]; compte.oeil++; }
    continue;
  } else if (tous.length === 1) { cs = tous; compte.unClub++; }
  else if (commons[cle]) {
    const ss = saisonsDe(lues.get(commons[cle].f) || '', commons[cle].f);
    if (!ss.length) { compte.sansDate++; continue; }
    cs = clubsDes(id, ss);
    if (cs.length) compte.commons++;
  } else if (libres[cle]) { compte.libres++; continue; }
  else { compte.lnhSansOeil++; continue; }
  if (!cs.length) { compte.horsDonnees++; continue; }
  clubs[cle] = cs.join(' ');
}
liste.clubs = clubs;
fs.writeFileSync(LISTE, JSON.stringify(liste));
console.log(`\n  ${Object.keys(clubs).length} photos générales avec leur club sur ${liste.ids.length} : à l'œil ${compte.oeil}, un seul club ${compte.unClub}, Commons datées ${compte.commons}`);
console.log(`  sans club (portrait sur toute carte qui demande un club) : la LNH sans œil ${compte.lnhSansOeil}, Commons sans date ${compte.sansDate}, Openverse ${compte.libres}, hors de nos saisons ${compte.horsDonnees}\n`);
