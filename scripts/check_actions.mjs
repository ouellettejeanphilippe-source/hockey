/*
 * LES PHOTOS D'ACTION (1.0) — scripts/actions.mjs, js/recadrage-action.js, js/actions.js.
 *
 *   node scripts/check_actions.mjs                          sans réseau
 *
 * 1. La liste (data/actions.json) : des joueurs du jeu, triés, sans doublon ;
 *    et si img/actions/ est là, une image par joueur listé, aucune en double.
 *    Les photos libres (scripts/actions_commons.mjs, `commons` et `libres`) :
 *    chacune listée, une licence permise (jamais ND), un auteur, une vignette
 *    https ; `creditPhoto` rend leur crédit, null pour une photo de la LNH.
 * 2. Le recadrage, dans Chromium, par le texte de la fonction (comme le script
 *    la reçoit) : il rend du 400 × 560, et sa fenêtre suit un
 *    sujet net posé à droite, à gauche ou au centre d'un fond flou.
 * 3. `actionSrc` : null pour un joueur sans photo, null tant que les images
 *    ne répondent pas, `img/actions/{id}.webp` quand elles répondent.
 *    LES PHOTOS DE SAISON (scripts/actions_saisons.mjs, `saisons`) : chacune
 *    a son WebP, une saison de nos données (et son club pour un échangé), une
 *    licence permise, un auteur ; aucune n'est en double. Une carte de cette
 *    saison prend la sienne, une autre saison retombe sur la générale, et le
 *    crédit et le cadre suivent la saison.
 *    LES PHOTOS COUCHÉES (scripts/actions_couchees.mjs, `couchees`) : des
 *    photos listées (générales ou de saison), chacune son WebP, aucune de trop.
 *
 * L'application Android simulée (un faux Capacitor, le point 4 d'avant) est
 * partie avec elle : web seulement depuis le 4 nov. 2026.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { exiger, informer, verdict } from './verdict.mjs';
import { recadrerAction } from '../js/recadrage-action.js';
import { actionSrc, vignetteCommons } from '../js/actions.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* 1. La liste. */
const liste = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'actions.json'), 'utf8'));
const joueurs = new Set(), clubsDe = new Map();   // clubsDe : « id-saison » → ses clubs
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json'))) {
  const sh = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8'));
  for (const p of sh.players) {
    if (!p.id) continue;
    joueurs.add(Number(p.id));
    const k = `${p.id}-${sh.season}`;
    clubsDe.set(k, [...(clubsDe.get(k) || []), p.t]);
  }
}
const ids = liste.ids;
const etrangers = ids.filter(id => !joueurs.has(id));
exiger('data/actions.json : 400 × 560', JSON.stringify(liste.taille) === '[400,560]', JSON.stringify(liste.taille));
// La face dans le cadre (scripts/visages_actions.py) : un centre de visage, entre 0 et 1, pour presque chaque photo.
const visages = Object.entries(liste.visages || {});
exiger('data/actions.json : le visage trouvé sur au moins 90 % des photos, chacun dans l\'image', visages.length >= 0.9 * ids.length && visages.every(([k, v]) => ids.includes(Number(k)) && v >= 0 && v <= 1),
  `${visages.length} visages sur ${ids.length} photos`);
exiger('data/actions.json : des joueurs du jeu', ids.length > 0 && !etrangers.length, etrangers.length ? `${etrangers.length} inconnus : ${etrangers.slice(0, 5).join(', ')}` : `${ids.length} joueurs sur ${joueurs.size}`);
exiger('data/actions.json : triée, sans doublon', ids.every((id, i) => i === 0 || id > ids[i - 1]), '');
const DOSSIER = path.join(ROOT, 'img', 'actions');
if (fs.existsSync(DOSSIER)) {
  const manquent = ids.filter(id => !fs.existsSync(path.join(DOSSIER, `${id}.webp`)));
  exiger('img/actions : une image par joueur listé', !manquent.length, manquent.length ? `${manquent.length} manquent (node scripts/actions.mjs)` : `${ids.length} images`);
  const vus = new Map(), doubles = [];
  for (const id of ids) {
    const f = path.join(DOSSIER, `${id}.webp`);
    if (!fs.existsSync(f)) continue;
    const h = createHash('md5').update(fs.readFileSync(f)).digest('hex');
    if (vus.has(h)) doubles.push(`${vus.get(h)}=${id}`); else vus.set(h, id);
  }
  exiger('img/actions : aucune image en double (md5)', !doubles.length, doubles.length ? doubles.slice(0, 5).join(', ') : `${vus.size} images distinctes`);
} else informer('img/actions', 'absent (une copie fraîche) : node scripts/actions.mjs les refait ; le jeu montre les portraits');

// Les photos libres : listées, sous une licence permise (domaine public, CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA ; jamais ND), créditées.
const LICENCE_PERMISE = /^(Domaine public|CC0|CC BY(-NC)?(-SA)?( \d\.\d)?)$/;
const commons = Object.entries(liste.commons || {}), libres = Object.entries(liste.libres || {});
const fautif = (cle, [id, c]) => {
  if (!ids.includes(Number(id))) return `${id} hors de ids`;
  if (fs.existsSync(DOSSIER) && !fs.existsSync(path.join(DOSSIER, `${id}.webp`))) return `${id} sans WebP`;
  if (!LICENCE_PERMISE.test(c.l || '')) return `${id} : licence « ${c.l} »`;
  if (!String(c.a || '').trim()) return `${id} sans auteur`;
  if (!/^https:\/\//.test(c.s || '')) return `${id} : vignette « ${c.s} »`;
  if (cle === 'commons' && (!c.f || !/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(c.s))) return `${id} : fichier ou vignette de Commons`;
  if (cle === 'libres' && (!/^https:\/\//.test(c.p || '') || !c.o || /wikimedia/i.test(c.o))) return `${id} : page de l'œuvre ou source`;
  return null;
};
const fautesCommons = commons.map(e => fautif('commons', e)).filter(Boolean);
exiger('commons : listées, WebP, licence permise, auteur, vignette de Commons', !fautesCommons.length, fautesCommons.length ? fautesCommons.slice(0, 4).join(' · ') : `${commons.length} photos de Commons`);
const fautesLibres = libres.map(e => fautif('libres', e)).filter(Boolean);
exiger('libres : listées, WebP, licence permise, auteur, page de l\'œuvre', !fautesLibres.length, fautesLibres.length ? fautesLibres.slice(0, 4).join(' · ') : `${libres.length} photos d'Openverse`);
exiger('commons et libres : jamais un joueur que la LNH montre, ni les deux à la fois', commons.every(([id]) => !(liste.libres || {})[id]), '');

// Les photos de saison : [fichier, dossier, largeur, auteur, licence, centre du visage, cadre, club ?].
const auteurs = liste.auteurs || [], licences = liste.licences || [];
const deSaison = Object.entries(liste.saisons || {}).flatMap(([id, ps]) => Object.entries(ps).map(([s, e]) => [Number(id), s, e]));
const fauteSaison = ([id, s, e]) => {
  const clubs = clubsDe.get(`${id}-${s}`);
  if (!clubs) return `${id}-${s} : hors de nos saisons`;
  if (clubs.length > 1 ? !clubs.includes(e[7]) : e[7] !== undefined) return `${id}-${s} : club « ${e[7]} » pour ${clubs.join('/')}`;
  if (fs.existsSync(DOSSIER) && !fs.existsSync(path.join(DOSSIER, `${id}-${s}.webp`))) return `${id}-${s} sans WebP`;
  if (!LICENCE_PERMISE.test(licences[e[4]] || '')) return `${id}-${s} : licence « ${licences[e[4]]} »`;
  if (!String(auteurs[e[3]] || '').trim()) return `${id}-${s} sans auteur`;
  if (!e[0] || !/^[0-9a-f]{2}$/.test(e[1]) || ![0, 960].includes(e[2])) return `${id}-${s} : fichier de Commons`;
  if (!(e[5] === null || (e[5] >= 0 && e[5] <= 1)) || !(e[6] === null || (e[6].length === 2 && e[6].every(v => v >= 0 && v <= 1)))) return `${id}-${s} : visage ou cadre`;
  return null;
};
const fautesSaison = deSaison.map(fauteSaison).filter(Boolean);
exiger('saisons : une saison de nos données, son club, WebP, licence permise, auteur', !fautesSaison.length,
  fautesSaison.length ? fautesSaison.slice(0, 4).join(' · ') : `${deSaison.length} photos de saison, ${new Set(deSaison.map(([id]) => id)).size} joueurs`);
exiger('saisons : les vignettes sur upload.wikimedia.org, une adresse par fichier', deSaison.every(([, , e]) => vignetteCommons(e).startsWith(`https://upload.wikimedia.org/wikipedia/commons/${e[2] ? 'thumb/' : ''}${e[1][0]}/${e[1]}/`))
  && new Set(deSaison.map(([, , e]) => e[0])).size === deSaison.length, deSaison.length ? vignetteCommons(deSaison[0][2]) : '');
if (fs.existsSync(DOSSIER)) {
  const listees = new Set(deSaison.map(([id, s]) => `${id}-${s}.webp`));
  const orphelines = fs.readdirSync(DOSSIER).filter(f => /^\d+-\d{4}-\d\d\.webp$/.test(f) && !listees.has(f));
  exiger('img/actions : aucune photo de saison hors de la liste', !orphelines.length, orphelines.slice(0, 4).join(', '));
  const vus = new Map(ids.map(id => [createHash('md5').update(fs.readFileSync(path.join(DOSSIER, `${id}.webp`))).digest('hex'), id])), doubles = [];
  for (const [id, s] of deSaison) {
    const f = path.join(DOSSIER, `${id}-${s}.webp`);
    if (!fs.existsSync(f)) continue;
    const h = createHash('md5').update(fs.readFileSync(f)).digest('hex');
    if (vus.has(h)) doubles.push(`${vus.get(h)}=${id}-${s}`); else vus.set(h, `${id}-${s}`);
  }
  exiger('img/actions : aucune photo de saison en double (md5), ni d\'une générale', !doubles.length, doubles.slice(0, 4).join(', '));
  const octets = deSaison.reduce((a, [id, s]) => a + (fs.existsSync(path.join(DOSSIER, `${id}-${s}.webp`)) ? fs.statSync(path.join(DOSSIER, `${id}-${s}.webp`)).size : 0), 0);
  informer('saisons : le poids', `${(octets / 1048576).toFixed(1)} Mo d'images ; data/actions.json ${(fs.statSync(path.join(ROOT, 'data', 'actions.json')).size / 1024).toFixed(0)} Ko`);
}

/* LES PHOTOS COUCHÉES (scripts/actions_couchees.mjs, `couchees`) : chaque clé est une photo listée (« id », la générale ; « id-saison », celle d'une saison), son visage dans l'image, un WebP chacune, aucun de trop. */
const couchees = Object.entries(liste.couchees || {});
const DOSSIER_COUCHE = path.join(DOSSIER, 'couchees');
const photoListee = cle => { const [id, s] = cle.split(/-(.+)/); return s ? !!(liste.saisons || {})[id]?.[s] : ids.includes(Number(id)); };
const fautesCouche = couchees.filter(([cle, c]) => !photoListee(cle) || !Array.isArray(c) || c.length !== 2 || !c.every(v => v >= 0 && v <= 1)
  || (fs.existsSync(DOSSIER) && !fs.existsSync(path.join(DOSSIER_COUCHE, `${cle}.webp`)))).map(([cle]) => cle);
exiger('couchées : des photos listées, leur visage dans l\'image, un WebP chacune', !fautesCouche.length,
  fautesCouche.length ? fautesCouche.slice(0, 5).join(', ') : `${couchees.length} photos couchées, dont ${couchees.filter(([cle]) => cle.includes('-')).length} de saison`);
if (fs.existsSync(DOSSIER_COUCHE)) {
  const orphelines = fs.readdirSync(DOSSIER_COUCHE).filter(f => !(liste.couchees || {})[f.replace(/\.webp$/, '')]);
  exiger('img/actions/couchees : aucune photo hors de la liste', !orphelines.length, orphelines.slice(0, 4).join(', '));
}

/* 2. Le recadrage, sur des images de synthèse. */
const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.setContent('<body></body>');
await page.addScriptTag({ content: `window.recadrerAction = ${recadrerAction.toString()};` });
const essai = (centre) => page.evaluate(async cx => {
  // Un fond flou (dégradés doux) et un sujet net : des rayures serrées, une « tête » ronde au-dessus.
  const W = 1296, H = 729, c = new OffscreenCanvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#6a7486'); g.addColorStop(0.5, '#8d8a80'); g.addColorStop(1, '#5d6b73');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.filter = 'blur(30px)';
  for (let k = 0; k < 9; k++) { x.fillStyle = `hsl(${k * 40} 30% 55%)`; x.beginPath(); x.arc(80 + k * 150, 180 + (k % 3) * 160, 70, 0, 7); x.fill(); }
  x.filter = 'none';
  for (let y = 190; y < 700; y += 8) { x.fillStyle = (y / 8) % 2 ? '#101418' : '#f2f2f2'; x.fillRect(cx - 90, y, 180, 8); }
  x.fillStyle = '#c0392b'; x.beginPath(); x.arc(cx, 130, 55, 0, 7); x.fill();
  x.strokeStyle = '#000'; x.lineWidth = 6; x.stroke();
  const brut = await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  const r = await window.recadrerAction(brut);
  const img = await createImageBitmap(r.webp);
  return { l: img.width, h: img.height, type: r.webp.type, fenetre: r.fenetre, mesures: r.mesures };
}, centre);
for (const [nom, cx] of [['à droite', 960], ['à gauche', 170], ['au centre', 648]]) {
  const r = await essai(cx);
  const [fx, fy, fl, fh] = r.fenetre;
  const milieu = fx + fl / 2;
  // Au bord, la fenêtre bute sur l'image : elle doit alors CONTENIR le sujet, à défaut d'être centrée sur lui.
  const contient = fx <= cx - 90 && fx + fl >= cx + 90;
  const ok = r.l === 400 && r.h === 560 && r.type === 'image/webp' && contient && (Math.abs(milieu - cx) <= 50 || fx === 0 || fx + fl === 1296) && fy <= 75;
  exiger(`recadrage : sujet ${nom}, dans une fenêtre 5:7`, ok, `${r.l} × ${r.h} ${r.type}, fenêtre x ${fx}–${fx + fl} (sujet ${cx - 90}–${cx + 90}), haut ${fy}`);
}

/* 3. actionSrc, dans Node : la liste chargée par un faux fetch, les images présentes ou non. */
exiger('actionSrc sans liste : null', actionSrc(ids[0]) === null, '');
const vraiFetch = globalThis.fetch;
const charger = async (imagesLa) => {
  globalThis.fetch = async u => {
    if (String(u) === 'data/actions.json') return new Response(JSON.stringify(liste));
    return new Response('', { status: imagesLa ? 200 : 404 });
  };
  // Un module neuf à chaque fois (la liste se charge une fois par module).
  const m = await import(`${pathToFileURL(path.join(ROOT, 'js', 'actions.js')).href}?${imagesLa ? 'la' : 'absentes'}`);
  return { m, dispo: await m.actionsDisponibles() };
};
{
  const { m, dispo } = await charger(false);
  exiger('images absentes : aucune photo demandée', dispo.length === 0 && m.actionSrc(ids[0]) === null, `${dispo.length} disponibles`);
}
{
  const { m, dispo } = await charger(true);
  const absent = [...joueurs].find(id => !ids.includes(id));
  exiger('images présentes : img/actions/{id}.webp', dispo.length === ids.length && m.actionSrc(ids[0]) === `img/actions/${ids[0]}.webp`, String(m.actionSrc(ids[0])));
  exiger('joueur sans photo : null (sa carte garde son portrait)', m.actionSrc(absent) === null, `${absent}`);
  // Le crédit : celui de Commons pointe sa page de fichier, celui d'Openverse la page de l'œuvre ; la LNH n'en a pas.
  const lnh = ids.find(id => !(liste.commons || {})[id] && !(liste.libres || {})[id]);
  const [idC, c] = commons[0] || [], [idL, l] = libres[0] || [];
  const crC = idC && m.creditPhoto(idC), crL = idL && m.creditPhoto(idL);
  exiger('creditPhoto : auteur, licence et page de l\'œuvre ; null pour la LNH',
    m.creditPhoto(lnh) === null && m.creditPhoto(absent) === null
      && (!idC || (crC.auteur === c.a && crC.licence === c.l && crC.url.startsWith('https://commons.wikimedia.org/wiki/File:')))
      && (!idL || (crL.auteur === l.a && crL.url === l.p)),
    idC ? `${crC.auteur} · ${crC.licence} · ${crC.url}` : '');
  // La photo de saison : la sienne pour sa saison, la générale (ou rien) pour une autre ; le crédit et le cadre la suivent.
  if (deSaison.length) {
    // Un joueur qui a une photo générale, et une saison sans la sienne.
    const sansSienne = i => [...clubsDe.keys()].map(k => k.split(/-(.+)/)).find(([j, x]) => Number(j) === i && !(liste.saisons[i] || {})[x]);
    const [id, s, e] = deSaison.find(([i, , x]) => ids.includes(i) && !x[7] && sansSienne(i)) || deSaison[0];
    const autre = sansSienne(id);
    const club = e[7] || clubsDe.get(`${id}-${s}`)[0];
    const cr = m.creditPhoto(id, s, club), crG = m.creditPhoto(id, autre && autre[1]);
    exiger('saisons : une carte de sa saison prend sa photo', m.actionSrc(id, s, club) === `img/actions/${id}-${s}.webp`, `${id} ${s} : ${m.actionSrc(id, s, club)}`);
    exiger('saisons : une autre saison retombe sur la photo générale', !autre || m.actionSrc(id, autre[1]) === (ids.includes(id) ? `img/actions/${id}.webp` : null), autre ? `${id} ${autre[1]} : ${m.actionSrc(id, autre[1])}` : 'une seule saison');
    exiger('saisons : le crédit et le cadre suivent la saison', cr.auteur === auteurs[e[3]] && cr.licence === licences[e[4]] && cr.url.startsWith('https://commons.wikimedia.org/wiki/File:')
      && JSON.stringify(m.cadreAction(id, s, club)) === JSON.stringify(e[6]) && JSON.stringify(crG) !== JSON.stringify(cr)
      && JSON.stringify(m.cadreAction(id, autre && autre[1])) === JSON.stringify((liste.cadres || {})[id] || null), `${cr.auteur} · ${cr.licence} ; ailleurs : ${crG ? crG.auteur : 'LNH'}`);
    // Un échangé : la carte de l'autre club garde la générale.
    const echange = deSaison.find(([, , x]) => x[7]);
    if (echange) {
      const [ie, se, ee] = echange, autreClub = clubsDe.get(`${ie}-${se}`).find(t => t !== ee[7]);
      exiger('saisons : un échangé, la photo à la carte de son club seulement', m.actionSrc(ie, se, ee[7]) === `img/actions/${ie}-${se}.webp` && m.actionSrc(ie, se, autreClub) !== `img/actions/${ie}-${se}.webp`, `${ie} ${se} ${ee[7]} / ${autreClub}`);
    }
  }
  // La photo générale, de son club seulement (scripts/actions_clubs.mjs) : la carte d'un autre club garde son portrait, sans crédit ni cadre.
  const clubs = liste.clubs || {};
  const g = ids.find(i => clubs[i] && !(liste.saisons || {})[i]);
  if (g) {
    const sien = clubs[g].split(' ')[0];
    exiger('clubs : la photo générale à la carte de son club, le portrait ailleurs',
      m.actionSrc(g, '2000-01', sien) === `img/actions/${g}.webp` && m.actionSrc(g, '2000-01', 'XXX') === null
        && m.cadreAction(g, '2000-01', 'XXX') === null && m.creditPhoto(g, '2000-01', 'XXX') === null && m.actionSrc(g) === `img/actions/${g}.webp`,
      `${g} ${clubs[g]} : ${m.actionSrc(g, '2000-01', sien)} / ${m.actionSrc(g, '2000-01', 'XXX')}`);
  }
  exiger('clubs : chaque club est un club de nos saisons', Object.values(clubs).every(v => v.split(' ').every(t => /^[A-Z]{2,3}$/.test(t))), `${Object.keys(clubs).length} photos générales avec leur club`);
}

globalThis.fetch = vraiFetch;

await navigateur.close();
verdict('Les photos d\'action');
