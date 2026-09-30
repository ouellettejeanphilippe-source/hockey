/*
 * LES PHOTOS D'ACTION (1.0) — scripts/actions.mjs, js/recadrage-action.js, js/actions.js.
 *
 *   node scripts/check_actions.mjs                          sans réseau
 *   node scripts/check_actions.mjs http://localhost:8000    plus l'appareil Android, simulé (réseau requis)
 *
 * 1. La liste (data/actions.json) : des joueurs du jeu, triés, sans doublon,
 *    et la place du joueur (`fx`, de 0 à 100) pour chacun, et ceux dont le
 *    visage est sur fond opaque (`opaques`, parmi eux) ; si img/actions/ est
 *    là, une image par joueur listé.
 * 2. Le traitement, dans Chromium, par le texte de la fonction (comme le
 *    script et l'appareil la reçoivent) : il GARDE L'IMAGE ENTIÈRE (JP : *le
 *    maximum de pixels*), en 854 × 480, et `fx` suit un sujet net posé à
 *    droite, à gauche ou au centre d'un fond flou.
 * 3. `actionSrc` : null pour un joueur sans photo, null tant que les images
 *    ne répondent pas, `img/actions/{id}.webp` quand elles répondent ;
 *    `actionFx` rend la place listée (50 sans photo).
 * 4. (avec l'adresse du jeu) L'APPAREIL, avec un faux Capacitor : son HTTP
 *    natif passe par Node et va chercher la vraie photo à la LNH. Rien ne
 *    part hors Wi-Fi ; au retour du Wi-Fi, la carte regardée passe d'abord ;
 *    chaque photo est traitée sur l'appareil (854 × 480, entière), gardée
 *    dans son tiroir, et `actionSrc` rend son adresse blob:.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { exiger, informer, verdict } from './verdict.mjs';
import { recadrerAction } from '../js/recadrage-action.js';
import { actionFx, actionSrc, visageOpaque } from '../js/actions.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URL_JEU = process.argv[2] || null;

/* 1. La liste. */
const liste = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'actions.json'), 'utf8'));
const joueurs = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json'))) {
  for (const p of JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8')).players) if (p.id) joueurs.add(Number(p.id));
}
const ids = liste.ids;
const etrangers = ids.filter(id => !joueurs.has(id));
exiger('data/actions.json : 854 × 480, la photo entière', JSON.stringify(liste.taille) === '[854,480]', JSON.stringify(liste.taille));
exiger('data/actions.json : des joueurs du jeu', ids.length > 0 && !etrangers.length, etrangers.length ? `${etrangers.length} inconnus : ${etrangers.slice(0, 5).join(', ')}` : `${ids.length} joueurs sur ${joueurs.size}`);
exiger('data/actions.json : triée, sans doublon', ids.every((id, i) => i === 0 || id > ids[i - 1]), '');
const fx = liste.fx || [];
exiger('data/actions.json : la place du joueur (fx) pour chacun', fx.length === ids.length && fx.every(v => Number.isInteger(v) && v >= 0 && v <= 100), `${fx.length} fx pour ${ids.length} photos`);
const opaques = liste.opaques || [];
const listes = new Set(ids);
exiger('data/actions.json : les visages opaques sont des joueurs listés', Array.isArray(liste.opaques) && opaques.every(id => listes.has(id)), `${opaques.length} visages sur fond opaque`);
const DOSSIER = path.join(ROOT, 'img', 'actions');
if (fs.existsSync(DOSSIER)) {
  const manquent = ids.filter(id => !fs.existsSync(path.join(DOSSIER, `${id}.webp`)));
  exiger('img/actions : une image par joueur listé', !manquent.length, manquent.length ? `${manquent.length} manquent (node scripts/actions.mjs)` : `${ids.length} images`);
} else informer('img/actions', 'absent (une copie fraîche) : node scripts/actions.mjs les refait ; le jeu montre les portraits');

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
  return { l: img.width, h: img.height, type: r.webp.type, fenetre: r.fenetre, fx: r.fx, mesures: r.mesures };
}, centre);
for (const [nom, cx] of [['à droite', 960], ['à gauche', 170], ['au centre', 648]]) {
  const r = await essai(cx);
  const attendu = Math.round(cx / 1296 * 100);
  const ok = r.l === 854 && r.h === 480 && r.type === 'image/webp' && r.fenetre.join() === '0,0,1296,729' && Math.abs(r.fx - attendu) <= 4;
  exiger(`photo entière : sujet ${nom}, et fx sur lui`, ok, `${r.l} × ${r.h} ${r.type}, gardé ${r.fenetre.join(' ')}, fx ${r.fx} (sujet à ${attendu})`);
}

/* 3. actionSrc, dans Node : la liste chargée par un faux fetch, les images présentes ou non. */
exiger('actionSrc sans liste : null', actionSrc(ids[0]) === null && actionFx(ids[0]) === 50 && !visageOpaque(ids[0]), '');
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
  const k = ids.length >> 1;
  exiger('actionFx : la place listée, 50 sans photo', m.actionFx(ids[k]) === fx[k] && m.actionFx(absent) === 50, `${ids[k]} → ${m.actionFx(ids[k])} (liste : ${fx[k]}) ; ${absent} → ${m.actionFx(absent)}`);
  const detoure = ids.find(id => !opaques.includes(id));
  exiger('visageOpaque : les listés seulement', (!opaques.length || m.visageOpaque(opaques[0])) && !m.visageOpaque(detoure) && !m.visageOpaque(absent), `${opaques[0]} → ${m.visageOpaque(opaques[0])} ; ${detoure} → ${m.visageOpaque(detoure)}`);
}

globalThis.fetch = vraiFetch;

/* 4. L'appareil, simulé. */
if (URL_JEU) {
  const ctx = await navigateur.newContext();
  const p = await ctx.newPage();
  const demandes = [];
  // Le HTTP natif : Node va chercher la vraie photo (hors des règles CORS, comme Android).
  await p.exposeFunction('httpNatif', async url => {
    demandes.push(url);
    const r = await fetch(url, { redirect: 'follow' });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, url: r.url, data: buf.toString('base64') };
  });
  await p.addInitScript(() => {
    const connexion = { type: 'cellular', saveData: false, ecouteurs: [], addEventListener(t, f) { this.ecouteurs.push(f); } };
    Object.defineProperty(navigator, 'connection', { get: () => connexion });
    window.connexionTest = connexion;
    window.Capacitor = { isNativePlatform: () => true, Plugins: { CapacitorHttp: { request: ({ url }) => window.httpNatif(url) } } };
  });
  // Une page vide à l'origine du jeu : les modules et data/actions.json se lisent comme dans l'application.
  const base = URL_JEU.replace(/\/?$/, '/');
  await p.route(`${base}sonde-actions.html`, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body></body>' }));
  await p.goto(`${base}sonde-actions.html`);
  await p.addScriptTag({ type: 'module', content: `import * as A from './js/actions.js'; window.A = A; window.evenements = []; addEventListener('cap82:action', e => evenements.push(e.detail.id));` });
  await p.waitForFunction(() => window.A);
  const vieux = ids[0], recent = ids[ids.length - 1];
  const res = await p.evaluate(async ({ vieux }) => {
    // Le tiroir 5:7 d'avant (`cap82img-actions-400`), comme sur un appareil qui a joué la version d'avant.
    await (await caches.open('cap82img-actions-400')).put('https://cap82.appareil/actions/1.webp', new Response('vieux'));
    const dispo = await A.actionsDisponibles();
    const avant = A.actionSrc(vieux);                      // une carte regarde un vieux joueur
    await A.demarrerActions();                            // hors Wi-Fi : rien ne part
    await new Promise(r => setTimeout(r, 800));
    return { dispo: dispo.length, avant };
  }, { vieux });
  exiger('appareil : la liste se lit, rien avant le recadrage', res.dispo === ids.length && res.avant === null, `${res.dispo} photos à télécharger`);
  exiger('appareil : rien ne part hors Wi-Fi', demandes.length === 0, `${demandes.length} téléchargements en données cellulaires`);
  // Le Wi-Fi revient : on laisse partir quelques photos, puis on coupe.
  await p.evaluate(() => { connexionTest.type = 'wifi'; connexionTest.ecouteurs.forEach(f => f()); });
  await p.waitForFunction(() => evenements.length >= 4, null, { timeout: 90000 });
  await p.evaluate(() => { connexionTest.type = 'cellular'; });
  await p.waitForTimeout(1500);
  const fin = await p.evaluate(async ({ vieux, recent }) => {
    const t = await caches.open('cap82img-actions-854');
    const cles = await t.keys();
    const tailles = [];
    for (const k of cles.slice(0, 4)) { const b = await (await t.match(k)).blob(); const img = await createImageBitmap(b); tailles.push(`${img.width}×${img.height} ${b.type} ${Math.round(b.size / 1024)} Ko`); }
    return { gardees: cles.length, tailles, src: A.actionSrc(vieux), srcRecent: A.actionSrc(recent), evenements: evenements.length, ancien: await caches.has('cap82img-actions-400') };
  }, { vieux, recent });
  // Deux téléchargements à la fois : la carte regardée part la première, même si une autre finit avant elle.
  exiger('appareil : la carte regardée passe en tête de file', demandes[0].includes(`/${vieux}.jpg`) && String(fin.src).startsWith('blob:'), `téléchargées dans l'ordre : ${demandes.slice(0, 3).map(u => u.split('/').pop()).join(', ')}`);
  exiger('appareil : photos entières traitées sur place et gardées', fin.gardees >= 4 && fin.tailles.every(t => t.startsWith('854×480 image/webp')), `${fin.gardees} dans le tiroir : ${fin.tailles.join(' · ')}`);
  exiger('appareil : actionSrc rend une adresse blob:', String(fin.src).startsWith('blob:'), String(fin.src).slice(0, 40));
  exiger('appareil : le tiroir 5:7 d\'avant est jeté', fin.ancien === false, fin.ancien ? 'cap82img-actions-400 est encore là' : 'cap82img-actions-400 effacé');
  exiger('appareil : la file s\'arrête hors Wi-Fi', demandes.length <= fin.gardees + 2, `${demandes.length} téléchargements pour ${fin.gardees} gardées`);
  informer('appareil : ordre de la file', `la carte regardée (${vieux}), puis des plus récents aux plus anciens (${recent} d'abord : ${String(fin.srcRecent).slice(0, 5) || '—'})`);
  await ctx.close();
} else informer('appareil', 'donne l\'adresse du jeu (node scripts/check_actions.mjs http://localhost:8000) pour simuler l\'application Android (réseau requis)');

await navigateur.close();
verdict('Les photos d\'action');
