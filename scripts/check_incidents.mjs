/*
 * LES INCIDENTS (V19, tranche 5 ; JP : *les incidents, ça devrait être liés à des joueurs tout le temps* ; *plus « randoms »*).
 * Les sources d'incidents du Rogue — les histoires (V25 C1, js/histoires.js), les situations et les accidents — ont une
 * seule forme : une voix, un titre, des options qui disent leurs lignes. Ce que le script tient :
 *   1. chaque incident a une voix de `EXPEDITEURS`, un titre et au moins une option ;
 *   2. QUI : chaque histoire nomme un joueur, une vraie personne de ton effectif, lue dans les feuilles jouées (`joueurDuFait`,
 *      les situations), et son fait le dit ; aucune liste blanche (le maire s'accroche à ta vedette, C0 q. 6) ;
 *   3. QUAND : chaque effet dit sa durée en matchs, écrite dans l'option (jamais un défaut tacite), sa fenêtre est celle
 *      que le calendrier du club compte, et les matchs de la fenêtre sont joués dans les feuilles d'après. (La phrase
 *      « Du 31e au 38e match » de l'écran du choix est partie avec la boîte de l'ancien Rogue, V28, tranche 4.)
 * Les promesses de plus longue haleine ont leurs scripts : les fils suivis (`check_suivis`), le contrat d'un adjoint
 * (`check_contrats`), l'absence d'un blessé (`check_blessures`).
 *   node scripts/check_incidents.mjs        GRAINES=11,12
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, getPlayerKey, SLOTS, MUTATIONS, JOURS_SITUATIONS, matchsEntre, situationsDuJour
} from '../js/sim.js';
import { appliquerChoix } from '../js/greffes.js';
import { HISTOIRES } from '../js/histoires.js';
import { EXPEDITEURS, joueurDuFait } from '../js/vie-gm.js';
import { equipeReelle } from './lib/vestiaires.mjs';
import { exiger, informer, verdict } from './verdict.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'data', 'seasons');
const SAISONS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const RECRUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'recrues.json'), 'utf8'));
const GRAINES = String(process.env.GRAINES || '11,12').split(',').map(Number);
const C = new Map();
const shard = f => { if (!C.has(f)) C.set(f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); return C.get(f); };
const eq = (nom, tag, un, s) => {
  const rk = new Set(RECRUES[s] || []);
  const p = un.flat().map(x => ({ ...x, ...(rk.has(x.id) ? { rk: 1 } : {}) }));
  p.forEach(registerHiddenRatings);
  return createTeam(nom, tag, autoRoster(p), { season: s });
};
function ligue(seed, n = 12) {
  let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [], vus = new Set();
  while (out.length < n) {
    const sh = shard(SAISONS[Math.floor(rnd() * SAISONS.length)]);
    const tags = [...new Set(sh.players.map(p => p.t))];
    const tag = tags[Math.floor(rnd() * tags.length)];
    if (vus.has(`${sh.season}|${tag}`)) continue;
    let un; try { un = equipeReelle(sh.season, tag); } catch { continue; }
    if (un[0].length < 12 || un[1].length < 6 || un[2].length < 2) continue;
    vus.add(`${sh.season}|${tag}`);
    out.push(eq(`${tag} ${sh.season}`, tag, un, sh.season));
  }
  return out;
}
const tes = (L, you) => L.calendrier.flatMap((jour, j) => jour.filter(m => m.joue && (m.A === you || m.B === you)).map(m => ({ j, m })));

/* ---------- 1. la forme ---------- */
{
  const mal = Object.entries(HISTOIRES).filter(([, x]) => !x.titre || !Array.isArray(x.options) || x.options.length < 1).map(([k]) => k);
  exiger('histoires : chacune a un titre et des options', mal.length === 0, mal.join(' · ') || `${Object.keys(HISTOIRES).length}`);
  const sansVoix = Object.entries(HISTOIRES).filter(([, x]) => !EXPEDITEURS[x.de]).map(([k]) => k);
  exiger('chaque voix existe (`EXPEDITEURS`)', sansVoix.length === 0, sansVoix.join(' · ') || 'toutes');
}

/* ---------- 2. qui : le catalogue, sur des faits pleins où chaque histoire est vraie (check_histoires les varie) ---------- */
const J = (n, cle, x = {}) => ({ n, cle, ...x });
const lundiPlein = {
  jour: 70, n: 55, jambes: 84, pire: J('Lebas', 'lb', { j: 66 }), vedette: J('Lavedette', 'lv', { fait: 'Lavedette : 14 points en 10 matchs', pts: 14, m: 10, sal: '3,0 M$' }),
  gardien: J('Legardien', 'lg', { fait: 'Legardien : 6 buts sur 31 tirs ce soir-là', m: 10, contre: 6 }), puni: J('Lepuni', 'pn', { pun: 5, m: 9 }), muet: J('Lemuet', 'mt', { sal: '7,5 M$', pts: 1, m: 10 }),
  pousse: J('Lepetit', 'pt', { pts: 5, m: 7, ou: '3e trio' }), blesses: [J('Leblesse', 'bl', { m: 9, total: 14, genre: 'commotion', deja: 1 }), J('Unautre', 'ua', { m: 4, total: 9, genre: 'aine', deja: 0 })],
  soirs: 4, dos: 1, visiteur: 3, domicile: 1, rival: 'Rival', bete: 'Bête', caisse: 60, dernier: { pour: 2, contre: 6, adv: 'Eux' }, rang: 13, equipes: 32, retard: 0, avance: 6, dosRoute: 1,
  masse: { espace: 400_000, libre: '0,4 M$', cap: 60_000_000, lourd: J('Legros', 'gr', { sal: '9,5 M$' }) }, defaites: 0, serie: 6, coach: null, chapeau: J('Lechapeau', 'ch', { buts: 3 }), blanchissage: J('Lauxiliaire', 'ax'),
  suites: [{ de: 'lePetit', choix: 'monter', joueur: J('Lepetit', 'pt'), m: 8, pts: 5, butsDuo: 0, resolue: false }, { de: 'leDuo', choix: 'souder', joueur: J('Lemarqueur', 'mq'), m: 10, pts: 12, butsDuo: 7, resolue: false }],
  jalon: J('Lejalon', 'ja', { quoi: 'buts', total: 20, m: 38, sal: '4,2 M$' }), duo: { marqueur: J('Lemarqueur', 'mq'), passeur: J('Lepasseur', 'pa'), buts: 6, m: 10 },
  recrue: J('Larecrue', 'rk', { pts: 9, m: 12 }), veteran: J('Levieux', 'vx', { age: 41, pts: 7, m: 10 }), murEnVue: J('Legardien', 'lg', { v: 28, departs: 46 }), coup: J('Lepuni', 'pn', { min: 5, adv: 'Eux' }),
  pieceChaude: { cle: 'canonnier', nom: 'Le canonnier', ico: '🏹', m: 7, v: 5, d: 2 }, mandat: { mot: 'finir dans les dix premiers', rang: 10 },
  gros: { adv: 'Eux', sorte: 'nemesis', domicile: true, fiche: { v: 0, d: 2 }, dernier: { pour: 1, contre: 3 }, ancien: J('Lancien', 'an', { pts: 9, m: 12, vraie: null }), leurVedette: { n: 'Leurgars', pts: 21, m: 10, vraie: null },
    monMur: J('Lemur', 'mu', { pm: 6 }), lancee: 4, malades: [J('Malade1', 'm1', { j: 58 }), J('Malade2', 'm2', { j: 62 }), J('Malade3', 'm3', { j: 64 })], partant: J('Legardien', 'lg', { j: 72, dosADos: true }) },
  ronde: { k: 1, adv: 'Eux', domicile: true, leurCoach: { nom: 'Le Frelon', ico: '🐝', pouvoir: 'La ruée' }, ficheSaison: { v: 1, d: 3 }, precedente: { matchs: 7 }, meneur: J('Lavedette', 'lv', { pts: 11, m: 6, vraie: null }), gardien: J('Legardien', 'lg', { pctArr: 0.931, departs: 5 }) },
  vraie: () => null,
};
{
  const fautes = [];
  let n = 0;
  for (const [k, D] of Object.entries(HISTOIRES)) {
    if (!D.quand(lundiPlein)) continue;
    n++;
    const j = D.joueur(lundiPlein);
    if (!j || !j.n || !j.cle) { fautes.push(`${k} : aucun joueur`); continue; }
    const fait = D.fait(lundiPlein);
    if (!fait.includes(j.n)) fautes.push(`${k} : le fait ne dit pas ${j.n} (« ${fait} »)`);
  }
  exiger('chaque histoire nomme un joueur et le dit dans son fait', !fautes.length && n >= 30, fautes.slice(0, 4).join(' · ') || `${n} histoires vraies sur les faits pleins`);
  // Au début d'une saison, personne n'a encore de feuille : aucune histoire ne plante, et aucune ne nomme personne.
  const vide = { ...lundiPlein, n: 0, vedette: null, gardien: null, puni: null, muet: null, pousse: null, blesses: [], suites: [], jalon: null, duo: null, recrue: null, veteran: null, murEnVue: null, coup: null, pieceChaude: null, chapeau: null, blanchissage: null, dernier: null, gros: null, ronde: null, serie: 0, dosRoute: 0, visiteur: 0 };
  const plantes = [];
  for (const [k, D] of Object.entries(HISTOIRES)) { try { if (D.quand(vide) && D.joueur(vide)) plantes.push(`${k} : vraie sans feuille`); } catch (e) { plantes.push(`${k} : plante sans feuille (${e.message})`); } }
  exiger('sans feuille jouée, aucune histoire ne sort ni ne plante', !plantes.length, plantes.slice(0, 4).join(' · ') || `${Object.keys(HISTOIRES).length} histoires`);
}
informer('les situations et les accidents', `situations : un porté et un pesé de l'effectif · accidents : un patineur de l'effectif (${Object.values(MUTATIONS).filter(m => m.source === 'accident').length} accidents)`);

/* ---------- 3. qui : sur de vraies ligues, des vraies personnes de ton effectif ---------- */
// Les lundis où l'on lit le club (les faits d'équipe `porteurs` sont partis avec la banque : V22).
const JOURS_LECTURE = [8, 14, 25, 33, 42, 51, 60, 70];   // les lundis où l'on lit le club
{
  const fautes = [];
  const faute = t => { if (fautes.length < 8) fautes.push(t); };
  let lectures = 0, situations = 0;
  for (const seed of GRAINES) {
    const teams = ligue(seed), you = teams[0];
    you.isPlayer = true;
    const L = creerLigue(teams, 82, { graine: `incidents-${seed}`, courbe: true });
    const dans = new Set(Object.values(you.roster).filter(Boolean).map(getPlayerKey));
    for (const jEv of JOURS_LECTURE) {
      jouerJusqua(L, jEv);
      const av = tes(L, you).filter(x => x.j < jEv);
      const cote = m => (m.A === you ? 'A' : 'B'), fe = m => m.feuille || { buts: [], lancers: [], punitions: [], alignes: {} };
      // La vedette et le gardien du lundi (`joueurDuFait`, js/faits.js `faitsDe`) : de l'effectif, et leur fait se recompte.
      const feuilles = av.slice(-10).map(({ m }) => ({ f: fe(m), cote: cote(m) }));
      const habilles = new Set(SLOTS.filter(s => !s.scratch).map(s => you.roster[s.i]).filter(Boolean));
      if (feuilles.length >= 5) {
        const v = joueurDuFait('vedette', feuilles, habilles), g = joueurDuFait('gardien', feuilles, habilles);
        if (!v || !habilles.has(v.p)) faute(`vedette : personne dans l'effectif (ligue ${seed}, journée ${jEv})`);
        else {
          lectures++;
          const pts = av.slice(-10).reduce((a, { m }) => a + fe(m).buts.filter(b => b.cote === cote(m) && (b.marqueur === v.p || (b.passeurs || []).includes(v.p))).length, 0);
          if (v.fait !== `${v.p.n} : ${pts} point${pts > 1 ? 's' : ''} en ${feuilles.length} matchs`) faute(`vedette : « ${v.fait} », recompté ${pts} points`);
        }
        if (g && !habilles.has(g.p)) faute(`gardien : ${g.p.n} n'est pas dans l'effectif`);
      }
    }
    // Les situations : un porté et un pesé, deux joueurs de l'effectif.
    for (const j of JOURS_SITUATIONS) {
      const s = situationsDuJour(you, `incidents-${seed}`, j, 0);
      if (!s) continue;
      situations++;
      for (const x of [s.porte, s.pese]) if (!x.p || !dans.has(getPlayerKey(x.p))) faute(`situation ${x.cle} : personne dans l'effectif`);
    }
  }
  exiger('la vedette et le gardien du lundi (`joueurDuFait`) sont de ton effectif et se recomptent dans les feuilles',
    !fautes.length && lectures > 0, fautes.join(' · ') || `${lectures} vedettes recomptées`);
  exiger('les situations nomment deux joueurs de l\'effectif', situations > 0 && !fautes.some(f => f.startsWith('situation')), `${situations} paires tirées`);
}

/* ---------- 4. quand : chaque effet dit sa durée en matchs ---------- */
const CANAUX = ['volume', 'finition', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
{
  const fautes = [];
  let n = 0;
  const entier = d => Number.isInteger(d) && d >= 1;
  for (const [k, M] of Object.entries(HISTOIRES)) for (const o of M.options) {
    if ((o.canaux && CANAUX.some(c => c in o.canaux)) || o.lui) { n++; if (!entier(o.duree)) fautes.push(`${k}.${o.cle} : un effet sans durée écrite`); }
    if (o.pari) for (const z of ['gagne', 'perd']) if (!entier(o.pari[z].duree)) fautes.push(`${k}.${o.cle} : le pari (${z}) sans durée`);
  }
  exiger('chaque effet (et chaque issue de pari) dit sa durée en matchs, écrite dans l\'option', !fautes.length && n > 0, fautes.slice(0, 5).join(' · ') || `${n} options`);
}
{
  // La fenêtre d'un effet = celle que le calendrier du club compte, et ses matchs sont joués dans les feuilles d'après.
  const fautes = [];
  let comptes = 0, joues = 0, candidats = 0;
  const teams = ligue(GRAINES[0]), you = teams[0];
  you.isPlayer = true;
  const L = creerLigue(teams, 82, { graine: 'incidents-fenetres', courbe: true });
  const J0 = 12, dejaJoues = matchsEntre(you, 0, J0);
  jouerJusqua(L, L.calendrier.length);
  const siens = tes(L, you);
  // Les canaux du club d'une histoire (le gros match, la ronde) posés par la porte au jour J0, comme la décision les pose.
  for (const [cle, M] of Object.entries(HISTOIRES)) for (const o of M.options) {
    if (!o.duree || !(o.canaux && CANAUX.some(c => c in o.canaux))) continue;
    candidats++;
    const avant = (you.effets || []).length;
    appliquerChoix(you, { jour: J0, moment: { famille: 'histoire', cle, choix: o.cle, joueurs: [] } }, 'g');
    const e = (you.effets || []).slice(avant).find(x => x.source === 'histoire');
    if (!e) { fautes.push(`${cle}.${o.cle} : aucun effet posé`); continue; }
    const premier = matchsEntre(you, 0, e.debut) + 1, dernier = matchsEntre(you, 0, e.fin);
    comptes++;
    if (e.debut !== J0 || premier !== dejaJoues + 1 || dernier - premier + 1 !== o.duree) { fautes.push(`${cle}.${o.cle} : du ${premier}e au ${dernier}e match, ${o.duree} dits`); continue; }
    // Les feuilles d'après : les matchs de la fenêtre sont ceux qui ont été joués, ni un de plus ni un de moins.
    const dedans = siens.filter(x => x.j >= e.debut && x.j < e.fin && x.m.feuille);
    if (e.fin <= L.calendrier.length) { joues++; if (dedans.length !== o.duree) fautes.push(`${cle}.${o.cle} : ${dedans.length} feuilles dans la fenêtre, ${o.duree} dits`); }
  }
  exiger('la fenêtre d\'un effet (sa durée dite, en matchs) est celle du calendrier du club, et ses matchs sont joués dans les feuilles d\'après', !fautes.length && (!candidats || (comptes > 0 && joues > 0)),
    fautes.slice(0, 4).join(' · ') || `${comptes} options, ${joues} fenêtres recomptées dans les feuilles`);
}

verdict('Les incidents');
