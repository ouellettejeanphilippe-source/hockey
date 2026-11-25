/*
 * LA SAUVEGARDE QUI SUIT D'UN APPAREIL À L'AUTRE (js/synchro.js ; JP, 25 nov. 2026 : *Github sync*, *un Gist secret*,
 * *toute seule*). Deux appareils (deux stockages), un faux GitHub (ses Gists en mémoire, son refus d'un mauvais jeton, son
 * réseau qui tombe) : on joue ici, on joue là-bas, et l'on exige que personne n'écrase personne.
 *
 *   node scripts/check_synchro.mjs
 */
import { gunzipSync } from 'node:zlib';
import { exiger, verdict } from './verdict.mjs';
import { VERSION } from '../js/version.js';

/* ---------- deux stockages, un faux GitHub ---------- */
const stockage = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, clear: () => m.clear(), carte: m };
};
const A = stockage(), B = stockage();
const sur = app => { globalThis.localStorage = app; };

const JETON = 'ghp_bon', github = { gists: new Map(), appels: [], panne: false, no: 0 };
const reponse = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) });
globalThis.fetch = async (url, { method = 'GET', headers = {}, body } = {}) => {
  if (github.panne) throw new TypeError('réseau');
  const chemin = String(url).replace('https://api.github.com', '');
  github.appels.push(`${method} ${chemin.replace(/\?.*/, '')}`);
  if (headers.Authorization !== `Bearer ${JETON}`) return reponse(401, { message: 'Bad credentials' });
  const corps = body ? JSON.parse(body) : null;
  if (method === 'GET' && chemin.startsWith('/gists?')) return reponse(200, [...github.gists.values()].map(g => ({ id: g.id, files: Object.fromEntries(Object.keys(g.files).map(n => [n, { filename: n }])) })));
  if (method === 'POST' && chemin === '/gists') {
    const g = { id: `g${++github.no}`, public: corps.public, files: Object.fromEntries(Object.entries(corps.files).map(([n, f]) => [n, { content: f.content, truncated: false }])), versions: 1 };
    github.gists.set(g.id, g);
    return reponse(201, g);
  }
  const g = github.gists.get(chemin.replace('/gists/', ''));
  if (!g) return reponse(404, { message: 'Not Found' });
  if (method === 'PATCH') { for (const [n, f] of Object.entries(corps.files)) g.files[n] = { content: f.content, truncated: false }; g.versions++; }
  return reponse(200, g);
};
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone)' }, configurable: true });

sur(A);
const { brancher, debrancher, synchroniser, etatDeLaSynchro, decider, resumeDe, FICHIER, ECARTEE } = await import('../js/synchro.js');
/* Un fichier du Gist, lu comme le jeu le lit : ses clés compressées (`gz`) rendues en clair. */
const lire = texte => { const s = JSON.parse(texte); if (s.gz) { s.cles = JSON.parse(gunzipSync(Buffer.from(s.gz, 'base64')).toString('utf8')); delete s.gz; } return s; };
const enLigne = () => { const g = [...github.gists.values()][0]; return g ? lire(g.files[FICHIER].content) : null; };
const jouer = (app, k, v) => app.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
const run = n => ({ phase: 'bureau', matchs: Array.from({ length: n }, (_, i) => ({ i })), quart: { n: 0 } });
const meta = (runs, ecussons) => ({ ecussons, voies: [], runs, coupes: 0 });

/* ---------- la règle, à nu ---------- */
exiger('qui gagne : rien en ligne, on crée ; pareil des deux côtés, rien à faire', decider({ ici: 'a', la: null }) === 'creer' && decider({ ici: 'a', la: 'a', base: 'z' }) === 'egale');
exiger('… ici n\'a pas bougé, là-bas oui : on reçoit ; ici a bougé, là-bas non : on envoie', decider({ ici: 'a', la: 'b', base: 'a' }) === 'recevoir' && decider({ ici: 'b', la: 'a', base: 'a' }) === 'envoyer');
exiger('… les deux ont bougé : un conflit, jamais un écrasement', decider({ ici: 'b', la: 'c', base: 'a' }) === 'conflit' && decider({ ici: 'b', la: 'c', base: null }) === 'conflit');
exiger('… un appareil jamais branché où rien n\'est joué reçoit sans demander ; une fois branché, vider le jeu ici s\'envoie', decider({ ici: 'v', la: 'c', base: null, vierge: true }) === 'recevoir' && decider({ ici: 'v', la: 'a', base: 'a', vierge: true }) === 'envoyer');

/* ---------- le premier appareil ---------- */
jouer(A, 'cap82_rogue', meta(2, 30));
jouer(A, 'cap82_run', run(12));
jouer(A, 'cap82_opts', { palette: 'oled' });
jouer(A, 'cap82_run_monde', { cache: 1 });
let r = await brancher('ghp_faux');
exiger('un jeton que GitHub refuse ne se garde pas, et le mot dit pourquoi', r.etat === 'erreur' && /refuse ce jeton/.test(r.mot) && !etatDeLaSynchro().branchee && !github.gists.size, r.mot);
r = await brancher('');
exiger('… un champ vide ne part pas chez GitHub', r.etat === 'erreur' && github.appels.length === 1, `${github.appels.length} appel`);
github.panne = true;
r = await brancher(JETON);
exiger('… ni un jeton qu\'on n\'a pas pu essayer (hors ligne)', r.etat === 'erreur' && /réseau/.test(r.mot) && !etatDeLaSynchro().branchee, r.mot);
github.panne = false;

r = await brancher(`  ${JETON}\n`);
const g1 = [...github.gists.values()][0];
exiger('le premier appareil crée la sauvegarde : un Gist secret, un fichier', r.etat === 'envoyee' && github.gists.size === 1 && g1.public === false && Object.keys(g1.files).join() === FICHIER, r.etat);
const S1 = enLigne();
exiger('… elle porte la run, les médailles, la version du jeu et le nom de l\'appareil', S1.cles.cap82_run === A.getItem('cap82_run') && S1.cles.cap82_rogue === A.getItem('cap82_rogue') && S1.version === VERSION && S1.appareil.nom === 'un iPhone' && /12 matchs/.test(S1.resume), S1.resume);
exiger('… jamais les options, les caches, ni le jeton', !Object.keys(S1.cles).some(k => /opts|monde|synchro/.test(k)) && !g1.files[FICHIER].content.includes(JETON) && !JSON.stringify(S1).includes(JETON), Object.keys(S1.cles).join(' '));
jouer(A, 'cap82_cartable', { v: 1, joueurs: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`2005-06_PIT_84${71000 + i}`, { v: { commune: 1 }, n: 1 }])) });
await synchroniser();
const brut = g1.files[FICHIER].content, clair = JSON.stringify(enLigne().cles);
exiger('elle voyage compressée (chaque envoi la porte entière) : le fichier pèse moins du quart de ses clés', typeof JSON.parse(brut).gz === 'string' && !JSON.parse(brut).cles && brut.length < clair.length / 4, `${brut.length} caractères pour ${clair.length}`);
A.removeItem('cap82_cartable');
await synchroniser();
exiger('… et l\'appareil se dit à jour', etatDeLaSynchro().branchee && !etatDeLaSynchro().sale && etatDeLaSynchro().quand > 0);
let avant = github.appels.length;
r = await synchroniser();
exiger('rien n\'a bougé : une lecture, aucune écriture', r.etat === 'egale' && github.appels.slice(avant).join() === 'GET /gists/g1', github.appels.slice(avant).join());

/* ---------- le deuxième appareil, vierge ---------- */
sur(B);
jouer(B, 'cap82_rogue', meta(0, 0));          // ce qu'un premier démarrage écrit
jouer(B, 'cap82_opts', { palette: 'glace' });
r = await brancher(JETON);
exiger('un appareil vierge qu\'on branche reçoit la sauvegarde sans demander, et retrouve le Gist par son fichier', r.etat === 'recue' && B.getItem('cap82_run') === A.getItem('cap82_run') && B.getItem('cap82_rogue') === A.getItem('cap82_rogue') && github.gists.size === 1, r.etat);
exiger('… ses options à lui ne bougent pas', B.getItem('cap82_opts') === JSON.stringify({ palette: 'glace' }));

/* ---------- on joue là-bas, on revient ici ---------- */
jouer(B, 'cap82_run', run(13));
exiger('jouer un match salit l\'appareil', etatDeLaSynchro().sale);
const versions = g1.versions;
r = await synchroniser();
exiger('… et il part en ligne', r.etat === 'envoyee' && JSON.parse(enLigne().cles.cap82_run).matchs.length === 13 && g1.versions === versions + 1 && !etatDeLaSynchro().sale, r.etat);
sur(A);
r = await synchroniser();
exiger('l\'autre appareil, qui n\'a pas bougé, la reçoit et retient d\'où elle vient', r.etat === 'recue' && JSON.parse(A.getItem('cap82_run')).matchs.length === 13 && etatDeLaSynchro().source === 'un iPhone' && !etatDeLaSynchro().sale, r.etat);

/* ---------- une clé qui part, une partie qui arrive ---------- */
jouer(A, 'cap82_parties', { actif: 'x1', parties: [{ id: 'x1', genre: 'saison', resume: { etape: 'Match 40' } }] });
jouer(A, 'cap82_partie_x1', { tirage: [1], graine: 7 });
A.removeItem('cap82_run');
await synchroniser();
sur(B);
r = await synchroniser();
exiger('une partie du 82-0 suit avec son index ; une run finie là-bas s\'efface ici', r.etat === 'recue' && B.getItem('cap82_partie_x1') === A.getItem('cap82_partie_x1') && B.getItem('cap82_parties') === A.getItem('cap82_parties') && B.getItem('cap82_run') === null, r.etat);

/* ---------- les deux avancent : le conflit ---------- */
jouer(B, 'cap82_run', run(3));
sur(A);
jouer(A, 'cap82_run', run(5));
await synchroniser();                               // A envoie d'abord
sur(B);
r = await synchroniser();
exiger('les deux ont joué : un conflit, et rien ne bouge, ni ici ni en ligne', r.etat === 'conflit' && JSON.parse(B.getItem('cap82_run')).matchs.length === 3 && JSON.parse(enLigne().cles.cap82_run).matchs.length === 5, r.etat);
const c = etatDeLaSynchro().conflit;
exiger('… le menu a de quoi montrer les deux : ce que chacune porte, et d\'où vient l\'autre', !!c && /3 matchs/.test(c.ici.resume) && /5 matchs/.test(c.la.resume) && c.la.appareil === 'un iPhone' && c.la.quand > 0, c && `${c.ici.resume} | ${c.la.resume}`);
r = await synchroniser({ garder: 'la' });
exiger('« celle de là-bas » : ici prend la sienne', r.etat === 'recue' && JSON.parse(B.getItem('cap82_run')).matchs.length === 5 && !etatDeLaSynchro().conflit, r.etat);
const ecartee = g1.files[ECARTEE] ? lire(g1.files[ECARTEE].content) : null;
exiger('… et celle d\'ici qu\'on écarte, jamais envoyée, part d\'abord au Gist dans un fichier à part : rien n\'est perdu', !!ecartee && JSON.parse(ecartee.cles.cap82_run).matchs.length === 3 && JSON.parse(enLigne().cles.cap82_run).matchs.length === 5, ecartee ? ecartee.resume : 'aucun fichier');
jouer(B, 'cap82_run', run(6));
sur(A);
jouer(A, 'cap82_run', run(7));
await synchroniser();
sur(B);
await synchroniser();
r = await synchroniser({ garder: 'ici' });
exiger('« celle d\'ici » : elle part en ligne, et l\'autre appareil la recevra', r.etat === 'envoyee' && JSON.parse(enLigne().cles.cap82_run).matchs.length === 6 && !etatDeLaSynchro().conflit, r.etat);
exiger('… ce qu\'on écrase reste à l\'historique du Gist : chaque envoi est une version de plus', g1.versions >= 6, `${g1.versions} versions`);
sur(A);
r = await synchroniser();
exiger('… A, qui n\'a pas bougé depuis son envoi, la reçoit', r.etat === 'recue' && JSON.parse(A.getItem('cap82_run')).matchs.length === 6, r.etat);

/* ---------- le réseau, le jeton, la version ---------- */
jouer(A, 'cap82_run', run(8));
github.panne = true;
r = await synchroniser();
exiger('hors ligne : rien ne se perd, l\'appareil reste sale et branché', r.etat === 'erreur' && /Hors ligne/.test(r.mot) && etatDeLaSynchro().sale && etatDeLaSynchro().branchee && !etatDeLaSynchro().refus, r.mot);
github.panne = false;
r = await synchroniser();
exiger('… au retour du réseau, ça part', r.etat === 'envoyee' && JSON.parse(enLigne().cles.cap82_run).matchs.length === 8, r.etat);

const fichier = enLigne();
g1.files[FICHIER].content = JSON.stringify({ ...fichier, version: '99.0.0', cles: { ...fichier.cles, cap82_run: JSON.stringify(run(20)), cap82_demain: 'une clé que ce code ne connaît pas' } });
const garde = A.getItem('cap82_run');
r = await synchroniser();
exiger('une sauvegarde d\'une version plus récente du jeu ne se reçoit pas : le mot demande la mise à jour', r.etat === 'erreur' && /99\.0\.0/.test(r.mot) && A.getItem('cap82_run') === garde, r.mot);
jouer(A, 'cap82_run', run(9));
r = await synchroniser({ garder: 'ici' });
exiger('… et si l\'on envoie par-dessus, la clé que ce code ne suit pas reste en ligne', r.etat === 'envoyee' && enLigne().cles.cap82_demain === 'une clé que ce code ne connaît pas' && JSON.parse(enLigne().cles.cap82_run).matchs.length === 9 && A.getItem('cap82_demain') === null, Object.keys(enLigne().cles).join(' '));

g1.files[FICHIER].content = JSON.stringify({ ...enLigne(), cles: { ...enLigne().cles, cap82_run: JSON.stringify(run(10)), cap82_synchro: '{"jeton":"vol"}', cap82_opts: '{"palette":"x"}', cap82_rogue: 12 } });
r = await synchroniser();
exiger('un Gist retouché à la main ne pose ici que les clés suivies, en texte : ni le réglage de la synchro, ni les options', r.etat === 'recue' && JSON.parse(A.getItem('cap82_synchro')).jeton === JETON && A.getItem('cap82_opts') === JSON.stringify({ palette: 'oled' }) && JSON.parse(A.getItem('cap82_run')).matchs.length === 10, r.etat);

const plein = A.setItem;
A.setItem = (k, v) => { if (k === 'cap82_run' && JSON.parse(v).matchs.length === 11) throw new Error('QuotaExceededError'); plein(k, v); };
g1.files[FICHIER].content = JSON.stringify({ ...enLigne(), cles: { ...enLigne().cles, cap82_rogue: JSON.stringify(meta(9, 99)), cap82_run: JSON.stringify(run(11)) } });
const tout = JSON.stringify([...A.carte].filter(([k]) => k !== 'cap82_synchro'));
r = await synchroniser();
exiger('un stockage plein : tout ou rien, ce qu\'il y avait revient', r.etat === 'erreur' && /plein/.test(r.mot) && JSON.stringify([...A.carte].filter(([k]) => k !== 'cap82_synchro')) === tout, r.mot);
A.setItem = plein;

const abime = '{"format":"cap82-synchro","gz":"pas du gzip"}';
g1.files[FICHIER].content = abime;
jouer(A, 'cap82_run', run(12));
r = await synchroniser();
exiger('un fichier en ligne qui ne se lit pas n\'est jamais « rien » : on n\'écrit pas par-dessus, et la synchro n\'insiste pas toute seule', r.etat === 'erreur' && /ne se lit pas/.test(r.mot) && g1.files[FICHIER].content === abime && etatDeLaSynchro().arret && !etatDeLaSynchro().refus, r.mot);
const compresse = globalThis.CompressionStream;
delete globalThis.CompressionStream;
g1.files[FICHIER].content = JSON.stringify({ format: 'cap82-synchro', v: 1, cles: {} });
r = await synchroniser({ garder: 'ici' });
exiger('un navigateur qui ne sait pas compresser envoie ses clés en clair, et elles se relisent', r.etat === 'envoyee' && !JSON.parse(g1.files[FICHIER].content).gz && JSON.parse(JSON.parse(g1.files[FICHIER].content).cles.cap82_run).matchs.length === 12, r.etat);
globalThis.CompressionStream = compresse;

github.gists.clear();
jouer(A, 'cap82_run', run(14));
r = await synchroniser();
exiger('le Gist supprimé sur GitHub se recrée de la sauvegarde d\'ici', r.etat === 'envoyee' && github.gists.size === 1 && JSON.parse(enLigne().cles.cap82_run).matchs.length === 14, r.etat);

sur(B);
const baseDeB = JSON.parse(B.getItem('cap82_synchro'));
r = await synchroniser();
exiger('un autre Gist que celui qu\'on connaissait repart de rien : B, resté sur l\'ancien, ne reçoit ni n\'écrase sans qu\'on choisisse', r.etat === 'conflit' && baseDeB.gist === 'g1' && [...github.gists.keys()].join() === 'g2' && JSON.parse(B.getItem('cap82_run')).matchs.length === 6 && JSON.parse(enLigne().cles.cap82_run).matchs.length === 14, r.etat);
sur(A);

const bon = JSON.parse(A.getItem('cap82_synchro'));
A.setItem('cap82_synchro', JSON.stringify({ ...bon, jeton: 'ghp_expire' }));
jouer(A, 'cap82_run', run(15));
r = await synchroniser();
exiger('un jeton expiré : le refus se retient (la synchro toute seule n\'insistera pas), l\'appareil reste branché pour qu\'on le change', r.etat === 'erreur' && etatDeLaSynchro().refus === 401 && etatDeLaSynchro().arret && etatDeLaSynchro().branchee, r.mot);
r = await brancher(JETON);
exiger('… rebranché, il envoie ce qui attendait', r.etat === 'envoyee' && !etatDeLaSynchro().refus && !etatDeLaSynchro().arret && JSON.parse(enLigne().cles.cap82_run).matchs.length === 15, r.etat);

debrancher();
exiger('débrancher oublie le jeton ; la partie reste ici, la sauvegarde reste en ligne', !etatDeLaSynchro().branchee && !/ghp_/.test(A.getItem('cap82_synchro')) && JSON.parse(A.getItem('cap82_run')).matchs.length === 15 && github.gists.size === 1);
r = await synchroniser();
exiger('… et plus rien ne part', r.etat === 'debranchee');

exiger('le résumé d\'une sauvegarde où rien n\'est joué est vide (c\'est ce qui fait un appareil vierge)', resumeDe({ cap82_rogue: JSON.stringify(meta(0, 0)) }) === '' && resumeDe({}) === '' && resumeDe({ cap82_run: JSON.stringify({ ...run(82), phase: 'fin' }), cap82_rogue: JSON.stringify(meta(0, 0)) }) === '');

verdict();
