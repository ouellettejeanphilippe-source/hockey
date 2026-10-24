/*
 * LES PHOTOS D'ACTION (1.0) — scripts/actions.mjs, js/recadrage-action.js, js/actions.js.
 *
 *   node scripts/check_actions.mjs                          sans réseau
 *   node scripts/check_actions.mjs http://localhost:8000    plus l'appareil Android, simulé (réseau requis)
 *
 * 1. La liste (data/actions.json) : des joueurs du jeu, triés, sans doublon ;
 *    et si img/actions/ est là, une image par joueur listé, aucune en double.
 *    Les photos libres (scripts/actions_commons.mjs, `commons` et `libres`) :
 *    chacune listée, une licence permise (jamais ND), un auteur, une vignette
 *    https ; `creditPhoto` rend leur crédit, null pour une photo de la LNH.
 * 2. Le recadrage, dans Chromium, par le texte de la fonction (comme le script
 *    et l'appareil la reçoivent) : il rend du 400 × 560, et sa fenêtre suit un
 *    sujet net posé à droite, à gauche ou au centre d'un fond flou.
 * 3. `actionSrc` : null pour un joueur sans photo, null tant que les images
 *    ne répondent pas, `img/actions/{id}.webp` quand elles répondent.
 *    LES PHOTOS DE SAISON (scripts/actions_saisons.mjs, `saisons`) : chacune
 *    a son WebP, une saison de nos données (et son club pour un échangé), une
 *    licence permise, un auteur ; aucune n'est en double. Une carte de cette
 *    saison prend la sienne, une autre saison retombe sur la générale, et le
 *    crédit et le cadre suivent la saison.
 * 4. (avec l'adresse du jeu) L'APPAREIL, avec un faux Capacitor : son HTTP
 *    natif passe par Node et va chercher la vraie photo à la LNH. Rien ne
 *    part hors Wi-Fi ; au retour du Wi-Fi, la carte regardée passe d'abord ;
 *    chaque photo est recadrée sur l'appareil (400 × 560), gardée dans son
 *    tiroir, et `actionSrc` rend son adresse blob:. Une photo de saison ne
 *    part que regardée, jamais dans la file de fond.
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
const URL_JEU = process.argv[2] || null;

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
    const [id, s, e] = deSaison.find(([i]) => ids.includes(i)) || deSaison[0];
    const autre = [...clubsDe.keys()].map(k => k.split(/-(.+)/)).find(([i, x]) => Number(i) === id && x !== s && !(liste.saisons[id] || {})[x]);
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
}

globalThis.fetch = vraiFetch;

/* 4. L'appareil, simulé. */
if (URL_JEU) {
  const ctx = await navigateur.newContext();
  const p = await ctx.newPage();
  const demandes = [];
  // Le HTTP natif : Node va chercher la vraie photo (hors des règles CORS, comme Android).
  const entetes = [];
  await p.exposeFunction('httpNatif', async (url, headers) => {
    demandes.push(url); entetes.push(headers || {});
    const r = await fetch(url, { redirect: 'follow', headers: headers || {} });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, url: r.url, data: buf.toString('base64') };
  });
  await p.addInitScript(() => {
    const connexion = { type: 'cellular', saveData: false, ecouteurs: [], addEventListener(t, f) { this.ecouteurs.push(f); } };
    Object.defineProperty(navigator, 'connection', { get: () => connexion });
    window.connexionTest = connexion;
    window.Capacitor = { isNativePlatform: () => true, Plugins: { CapacitorHttp: { request: ({ url, headers }) => window.httpNatif(url, headers) } } };
  });
  // Une page vide à l'origine du jeu : les modules et data/actions.json se lisent comme dans l'application.
  const base = URL_JEU.replace(/\/?$/, '/');
  await p.route(`${base}sonde-actions.html`, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body></body>' }));
  await p.goto(`${base}sonde-actions.html`);
  await p.addScriptTag({ type: 'module', content: `import * as A from './js/actions.js'; window.A = A; window.evenements = []; addEventListener('cap82:action', e => evenements.push(e.detail.id));` });
  await p.waitForFunction(() => window.A);
  // Le plus vieux joueur : une photo libre, s'il y en a (Wikimedia exige qu'on se nomme).
  const vieux = ids[0], recent = ids[ids.length - 1];
  const libreDe = id => (liste.commons || {})[id] || (liste.libres || {})[id];
  const sourceDe = id => libreDe(id) ? libreDe(id).s : `/${id}.jpg`;
  // Une photo de saison : regardée, elle part ; jamais dans la file de fond.
  const [idS, sS, eS] = deSaison[0] || [];
  const res = await p.evaluate(async ({ vieux, idS, sS }) => {
    const dispo = await A.actionsDisponibles();
    if (idS) A.actionSrc(idS, sS);                         // une carte regarde une photo de saison
    const avant = A.actionSrc(vieux);                      // une carte regarde un vieux joueur
    await A.demarrerActions();                            // hors Wi-Fi : rien ne part
    await new Promise(r => setTimeout(r, 800));
    return { dispo: dispo.length, avant };
  }, { vieux, idS, sS });
  exiger('appareil : la liste se lit, rien avant le recadrage', res.dispo === ids.length && res.avant === null, `${res.dispo} photos à télécharger`);
  exiger('appareil : rien ne part hors Wi-Fi', demandes.length === 0, `${demandes.length} téléchargements en données cellulaires`);
  // Le Wi-Fi revient : on laisse partir quelques photos, puis on coupe.
  await p.evaluate(() => { connexionTest.type = 'wifi'; connexionTest.ecouteurs.forEach(f => f()); });
  await p.waitForFunction(cle => evenements.length >= 4 && (!cle || evenements.includes(cle)), idS ? `${idS}-${sS}` : null, { timeout: 90000 });
  await p.evaluate(() => { connexionTest.type = 'cellular'; });
  await p.waitForTimeout(1500);
  const fin = await p.evaluate(async ({ vieux, recent, idS, sS }) => {
    const t = await caches.open('cap82img-actions-visage');
    const cles = await t.keys();
    const tailles = [];
    for (const k of cles.slice(0, 4)) { const b = await (await t.match(k)).blob(); const img = await createImageBitmap(b); tailles.push(`${img.width}×${img.height} ${b.type} ${Math.round(b.size / 1024)} Ko`); }
    const saison = idS ? { src: A.actionSrc(idS, sS), garde: !!(await t.match(`https://cap82.appareil/actions/${idS}-${sS}.webp`)) } : null;
    return { gardees: cles.length, tailles, src: A.actionSrc(vieux), srcRecent: A.actionSrc(recent), evenements: evenements.length, saison };
  }, { vieux, recent, idS, sS });
  // Deux téléchargements à la fois : la carte regardée part la première, même si une autre finit avant elle.
  exiger('appareil : la carte regardée passe en tête de file', demandes[0].includes(sourceDe(vieux)) && String(fin.src).startsWith('blob:'), `téléchargées dans l'ordre : ${demandes.slice(0, 3).map(u => u.split('/').pop()).join(', ')}`);
  const nommees = demandes.map((u, k) => [u, entetes[k]]).filter(([u]) => !u.includes('assets.nhle.com'));
  exiger('appareil : une photo libre se télécharge en se nommant (User-Agent)', nommees.every(([, h]) => /^Cap82-0\//.test(h['User-Agent'] || '')),
    `${nommees.length} photos libres parmi ${demandes.length}${libreDe(vieux) ? ` (dont ${vieux}, ${libreDe(vieux).l})` : ''}`);
  exiger('appareil : photos recadrées sur place et gardées', fin.gardees >= 4 && fin.tailles.every(t => t.startsWith('400×560 image/webp')), `${fin.gardees} dans le tiroir : ${fin.tailles.join(' · ')}`);
  exiger('appareil : actionSrc rend une adresse blob:', String(fin.src).startsWith('blob:'), String(fin.src).slice(0, 40));
  exiger('appareil : la file s\'arrête hors Wi-Fi', demandes.length <= fin.gardees + 2, `${demandes.length} téléchargements pour ${fin.gardees} gardées`);
  if (idS) {
    const url = vignetteCommons(eS), deSaisons = new Set(deSaison.map(([, , e]) => vignetteCommons(e)));
    exiger('appareil : la photo de saison regardée se télécharge, se recadre et se garde sous {id}-{saison}', demandes.includes(url) && fin.saison.garde && String(fin.saison.src).startsWith('blob:'), `${idS}-${sS} : ${url.split('/').pop()}`);
    exiger('appareil : aucune autre photo de saison dans la file de fond', demandes.filter(u => deSaisons.has(u)).length === 1, `${demandes.filter(u => deSaisons.has(u)).length} photos de saison téléchargées`);
  }
  informer('appareil : ordre de la file', `la carte regardée (${vieux}), puis des plus récents aux plus anciens (${recent} d'abord : ${String(fin.srcRecent).slice(0, 5) || '—'})`);
  await ctx.close();
} else informer('appareil', 'donne l\'adresse du jeu (node scripts/check_actions.mjs http://localhost:8000) pour simuler l\'application Android (réseau requis)');

await navigateur.close();
verdict('Les photos d\'action');
