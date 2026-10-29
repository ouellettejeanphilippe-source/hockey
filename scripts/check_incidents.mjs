/*
 * LES INCIDENTS (V19, tranche 5 ; JP : *les incidents, ça devrait être liés à des joueurs tout le temps* ; *plus « randoms »*).
 * Les sources d'incidents du Rogue — les dilemmes (`MOMENTS`), les séquences, les dossiers de la semaine, les choix des
 * fils, la presse et les courriels (`REPONSES_VIE`), les situations et les accidents — ont une seule forme : une voix, un
 * titre, des options qui disent leurs lignes. Ce que le script tient :
 *   1. chaque incident a une voix de `EXPEDITEURS`, un titre et au moins deux options (ou une, si c'est un constat) ;
 *   2. QUI : un incident dont le fait porte sur un joueur le nomme, une vraie personne de ton effectif, lue dans les feuilles
 *      jouées. Les faits d'équipe (la passoire, la disette, la route…) s'accrochent à qui les porte (`porteurs`, js/sim.js) ;
 *      les dossiers d'équipe à ta vedette, ton gardien, ton plus bas en jambes, ton plus gros contrat. Ce qui ne peut pas
 *      nommer personne est dans une liste blanche écrite ici, avec sa raison (`BLANCHE`) ;
 *   3. QUAND : chaque effet dit sa durée en matchs, écrite dans l'option (jamais un défaut tacite), la fenêtre « Du 31e
 *      au 38e match » (`fenetreDuChoix`) est celle que le calendrier du club compte, et les matchs de la fenêtre sont
 *      joués dans les feuilles d'après ; un dilemme tombe à −2…+2 matchs de sa grille (`matchDuMoment`).
 * Les promesses de plus longue haleine ont leurs scripts : les fils suivis (`check_suivis`), le contrat d'un adjoint
 * (`check_contrats`), l'absence d'un blessé (`check_blessures`).
 *   node scripts/check_incidents.mjs        GRAINES=11,12
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoRoster, registerHiddenRatings, createTeam, creerLigue, jouerJusqua, getPlayerKey, SLOTS, MOMENTS, SEQUENCES, FAITS, MUTATIONS,
  JOURS_MOMENTS, JOURS_SITUATIONS, matchDuMoment, faitsDuClub, effetDeMoment, matchsEntre, situationsDuJour, energieDe,
} from '../js/sim.js';
import { DOSSIERS } from '../js/dossiers.js';
import { CHOIX_DES_FILS, EXPEDITEURS, REPONSES_VIE, joueurDuFait } from '../js/vie-gm.js';
import { fenetreDuChoix } from '../js/impact.js';
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

/* LA LISTE BLANCHE : ce qui ne nomme personne, et pourquoi. Tout le reste nomme un joueur. */
const BLANCHE = {
  dossiers: { laCaisseDeborde: 'de l\'argent qui dort : rien n\'est joué', laTete: 'la tête du coach, pas un joueur', laPratique: 'la réserve : rien n\'est arrivé' },
  // Les courriels d'une voix d'institution (le proprio, la caisse, l'adjoint, les communications, le physio, la ligue, les partisans, la ville, le club) parlent du club ; ceux de l'agent visent la vedette.
  courriels: { pr: 'le proprio', fi: 'la caisse', ad: 'l\'adjoint', co: 'les communications', ph: 'le physio', li: 'la ligue', pa: 'les partisans', ma: 'la ville', eq: 'le club' },
};

const sources = [
  ['dilemmes', MOMENTS], ['séquences', SEQUENCES], ['dossiers', DOSSIERS], ['choix des fils', CHOIX_DES_FILS],
];
/* ---------- 1. la forme ---------- */
for (const [nom, S] of sources) {
  const mal = Object.entries(S).filter(([, x]) => !x.titre || !Array.isArray(x.options) || x.options.length < 1).map(([k]) => k);
  exiger(`${nom} : chacun a un titre et des options`, Object.keys(S).length > 0 && mal.length === 0, mal.join(' · ') || `${Object.keys(S).length}`);
}
const sansVoix = [...Object.entries(MOMENTS), ...Object.entries(DOSSIERS)].filter(([, x]) => x.de && !EXPEDITEURS[x.de]).map(([k]) => k);
exiger('chaque voix existe (`EXPEDITEURS`)', sansVoix.length === 0, sansVoix.join(' · ') || 'toutes');

/* ---------- 2. qui : le catalogue ---------- */
// Un dilemme nomme un joueur si son fait en rend un (`joueur`, `joueurs`) ou, pour un fait d'équipe, celui qui le porte (`porte`).
const nomme = f => /\b(joueurs?|porteDe)\b/.test(String(FAITS[f].lire));
const dilemmesSans = Object.entries(MOMENTS).filter(([, m]) => !nomme(m.fait)).map(([k, m]) => `${k} (${m.fait})`);
exiger('chaque dilemme nomme un joueur : son fait en rend un', dilemmesSans.length === 0, dilemmesSans.join(', ') || `${Object.keys(MOMENTS).length} sur ${Object.keys(MOMENTS).length}`);

const lundiPlein = {
  n: 20, jambes: 88, pire: { n: 'Lebas', cle: 'lb', j: 70 }, vedette: { n: 'Lavedette', cle: 'lv', fait: 'Lavedette : 9 points en 10 matchs' },
  gardien: { n: 'Legardien', cle: 'lg', fait: 'Legardien : 6 buts sur 31 tirs ce soir-là' },
  boude: { n: 'Leboudeur', cle: 'bd', zone: 'Top 6', ou: '4e trio', pts: 2, m: 10 }, puni: { n: 'Lepuni', cle: 'pn', pun: 5, m: 10 }, muet: { n: 'Lemuet', cle: 'mt', sal: '7,5 M$', pts: 1, m: 10 },
  blesses: [{ n: 'Leblesse', m: 12, cle: 'bl' }, { n: 'Unautre', m: 4, cle: 'ua' }], soirs: 4, dos: 1, visiteur: 3, domicile: 1, rival: 'Rival', bete: 'Bête', caisse: 10,
  dernier: { pour: 0, contre: 5, adv: 'Eux' }, rang: 30, equipes: 32,
  masse: { espace: 500_000, libre: '0,5 M$', lourd: { n: 'Legros', cle: 'gr', sal: '9,5 M$', dollars: 9_500_000 } },
  defaites: 5, coach: 'La Tortue', coachs: [{ cle: 'a', nom: 'Le Frelon', ico: '🐝' }, { cle: 'b', nom: "L'Aigle", ico: '🦅' }],
};
{
  const fautes = [];
  for (const [k, D] of Object.entries(DOSSIERS)) {
    if (BLANCHE.dossiers[k]) { if (D.joueur) fautes.push(`${k} : sur la liste blanche, mais il nomme un joueur`); continue; }
    const j = D.joueur ? D.joueur(lundiPlein) : null;
    if (!j || !j.n || !j.cle) { fautes.push(`${k} : aucun joueur`); continue; }
    const fait = D.fait(lundiPlein);
    if (!fait.includes(j.n)) fautes.push(`${k} : le fait ne dit pas ${j.n} (« ${fait} »)`);
    // Au début d'une saison, personne n'a encore de feuille : le fait se dit sans lui, sans planter.
    const vide = { ...lundiPlein, vedette: null, gardien: null };
    try { const f = D.fait(vide); if (typeof f !== 'string' || /undefined|null/.test(f)) fautes.push(`${k} : « ${f} » sans feuille`); D.joueur && D.joueur(vide); } catch (e) { fautes.push(`${k} : plante sans feuille (${e.message})`); }
  }
  const noms = Object.keys(DOSSIERS).filter(k => !BLANCHE.dossiers[k]);
  exiger('chaque dossier nomme un joueur et le dit dans son fait, sauf trois (liste blanche)', !fautes.length && Object.keys(BLANCHE.dossiers).every(k => DOSSIERS[k]), fautes.slice(0, 4).join(' · ') || `${noms.length} sur ${Object.keys(DOSSIERS).length} ; hors : ${Object.keys(BLANCHE.dossiers).join(', ')}`);
}
{
  const presse = Object.entries(REPONSES_VIE).filter(([k]) => /^e\d+$/.test(k));
  const sansCible = presse.filter(([, x]) => !['gardien', 'vedette', 'dur', 'trois'].includes(x.cible)).map(([k]) => k);
  exiger('chaque point de presse vise un joueur (le gardien, la vedette)', presse.length > 0 && !sansCible.length, sansCible.slice(0, 6).join(', ') || `${presse.length} sur ${presse.length}`);
  const courriels = Object.entries(REPONSES_VIE).filter(([k]) => !/^e\d+$/.test(k));
  const voix = k => k.replace(/\d+$/, '');
  const hors = courriels.filter(([k, x]) => !x.cible && !BLANCHE.courriels[voix(k)]).map(([k]) => k);
  const agentsSans = courriels.filter(([k, x]) => voix(k) === 'ag' && !x.cible).map(([k]) => k);
  exiger('un courriel d\'agent vise la vedette ; les autres voix d\'institution sont sur la liste blanche', !hors.length && !agentsSans.length, hors.slice(0, 6).join(', ') || `${courriels.filter(([, x]) => x.cible).length} sur ${courriels.length} nomment un joueur`);
  const sq = Object.keys(SEQUENCES).sort().join(',');
  exiger('les deux séquences (glissade, série de victoires) disent leur gardien ou leur vedette (`joueurDuFait`)', sq === 'defaites,victoires', sq);
  informer('les fils, les situations et les accidents', `${Object.keys(CHOIX_DES_FILS).length} fils : le joueur du fil · situations : un porté et un pesé de l'effectif · accidents : un patineur de l'effectif (${Object.values(MUTATIONS).filter(m => m.source === 'accident').length} sortes)`);
}

/* ---------- 3. qui : sur de vraies ligues, des vraies personnes de ton effectif ---------- */
{
  const fautes = [];
  const faute = t => { if (fautes.length < 8) fautes.push(t); };
  let lectures = 0, situations = 0, forces = 0;
  for (const seed of GRAINES) {
    const teams = ligue(seed), you = teams[0];
    you.isPlayer = true;
    const L = creerLigue(teams, 82, { graine: `incidents-${seed}`, courbe: true });
    const N = L.calendrier.length;
    const dans = new Set(Object.values(you.roster).filter(Boolean).map(getPlayerKey));
    const ici = g => SLOTS.filter(s => !s.scratch && s.group === g).map(s => you.roster[s.i]).filter(Boolean);
    for (const jEv of JOURS_MOMENTS) {
      jouerJusqua(L, jEv);
      const miens = tes(L, you), av = miens.filter(x => x.j < jEv);
      const c = faitsDuClub(you, miens, jEv, N);
      const cote = m => (m.A === you ? 'A' : 'B'), fe = m => m.feuille || { buts: [], lancers: [], punitions: [], alignes: {} };
      const gardienDe = m => { const n = new Map(); for (const l of fe(m).lancers || []) if (l.cote !== cote(m) && l.gardien) n.set(l.gardien, (n.get(l.gardien) || 0) + 1); return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
      const matin = ((you.jourLignes || [])[jEv] || {}).energie || {};
      const jambes = p => Math.round(matin[getPlayerKey(p)] ?? energieDe(p));
      const P = c.porteurs;
      // Les cinq porteurs, recomptés dans les feuilles d'avant la journée.
      const tirs = (liste, p) => liste.reduce((a, { m }) => a + (fe(m).lancers || []).filter(l => l.cote === cote(m) && l.tireur === p).length, 0);
      const patineurs = [...ici('F'), ...ici('D')];
      const auFilet = (liste, g) => liste.filter(({ m }) => gardienDe(m) === g).length;
      const verifie = (nom, x, liste, f, plusHaut = true) => {
        if (!liste.length) return;
        if (!x) return faute(`${nom} : personne, ligue ${seed}, journée ${jEv}`);
        if (!dans.has(getPlayerKey(x.p))) faute(`${nom} : ${x.p.n} n'est pas dans l'effectif`);
        if (f(x.p) !== x.n) faute(`${nom} : ${x.p.n} ${x.n}, recompté ${f(x.p)} (ligue ${seed}, journée ${jEv})`);
        const meilleur = (nom === 'bas' ? patineurs : nom.startsWith('filet') ? ici('G') : patineurs).map(f);
        if (plusHaut ? meilleur.some(v => v > x.n) : meilleur.some(v => v < x.n)) faute(`${nom} : ${x.p.n} n'est pas le premier`);
        lectures++;
      };
      if (av.length >= 5) {
        verifie('filet5', P.filet5, av.slice(-5), g => auFilet(av.slice(-5), g));
        verifie('tirs5', P.tirs5, av.slice(-5), p => tirs(av.slice(-5), p));
      }
      if (av.length >= 4) verifie('tirs4', P.tirs4, av.slice(-4), p => tirs(av.slice(-4), p));
      if (av.length >= 1) verifie('tirsDernier', P.tirsDernier, av.slice(-1), p => tirs(av.slice(-1), p));
      verifie('bas', P.bas, patineurs, jambes, false);
      // Chaque fait d'équipe, forcé vrai sur ce contexte : il rend son porteur, et le dit dans la scène.
      if (av.length >= 5) {
        const forces6 = {
          passoire: { ...c, cinq: { pour: 10, contre: 20, m: 5 } }, disette: { ...c, cinq: { pour: 2, contre: 5, m: 5 } },
          route: { ...c, route: 4 }, jambesEquipe: { ...c, moyenneJambes: 80 },
          avantagesRares: { ...c, quatre: { punisEux: 2, m: 4 } }, defaiteParUn: { ...c, dernier: { ...c.dernier, pour: 2, contre: 3 } },
        };
        for (const [f, ctx] of Object.entries(forces6)) {
          const r = FAITS[f].lire(ctx);
          forces++;
          if (!r || !r.porte || !dans.has(getPlayerKey(r.porte)) || !Number.isFinite(r.np)) { faute(`${f} : aucun porteur de l'effectif (ligue ${seed}, journée ${jEv})`); continue; }
          const dit = FAITS[f].dire(r);
          if (!dit.includes(r.porte.n) || !dit.includes(String(r.np))) faute(`${f} : « ${dit} » ne dit pas ${r.porte.n} et ${r.np}`);
        }
      }
      // La vedette et le gardien du lundi (`joueurDuFait`, js/saison.js `faitsDuLundi`) : de l'effectif, et leur fait se recompte.
      const feuilles = av.slice(-10).map(({ m }) => ({ f: fe(m), cote: cote(m) }));
      const habilles = new Set(SLOTS.filter(s => !s.scratch).map(s => you.roster[s.i]).filter(Boolean));
      if (feuilles.length >= 5) {
        const v = joueurDuFait('vedette', feuilles, habilles), g = joueurDuFait('gardien', feuilles, habilles);
        if (!v || !habilles.has(v.p)) faute(`vedette : personne dans l'effectif (ligue ${seed}, journée ${jEv})`);
        else {
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
  exiger('les porteurs d\'un fait d\'équipe (gardien, tireur, plus bas en jambes) sont de ton effectif et se recomptent dans les feuilles ; chaque fait forcé les nomme',
    !fautes.length && lectures > 0 && forces > 0, fautes.join(' · ') || `${lectures} porteurs recomptés, ${forces} faits forcés`);
  exiger('les situations nomment deux joueurs de l\'effectif', situations > 0 && !fautes.some(f => f.startsWith('situation')), `${situations} paires tirées`);
}

/* ---------- 4. quand : chaque effet dit sa durée en matchs ---------- */
const CANAUX = ['volume', 'finition', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
const durees = [
  ['dilemmes', MOMENTS], ['séquences', SEQUENCES], ['dossiers', DOSSIERS], ['presse et courriels', REPONSES_VIE],
];
{
  const fautes = [];
  let n = 0;
  const entier = d => Number.isInteger(d) && d >= 1;
  for (const [nom, S] of durees) for (const [k, M] of Object.entries(S)) for (const o of M.options) {
    if (CANAUX.some(c => c in o) || o.lui) { n++; if (!entier(o.duree)) fautes.push(`${nom}.${k}.${o.cle} : un effet sans durée écrite`); }
    if (o.ensuite && !entier(o.ensuite.duree)) fautes.push(`${nom}.${k}.${o.cle} : « ensuite » sans durée`);
    if (o.pari) for (const z of ['gagne', 'perd']) if (!entier(o.pari[z].duree)) fautes.push(`${nom}.${k}.${o.cle} : le pari (${z}) sans durée`);
  }
  for (const [k, M] of Object.entries(CHOIX_DES_FILS)) for (const o of M.options) {
    if (!o.suivi) continue;
    n++;
    for (const z of ['gagne', 'perd']) if (o.suivi[z] && !entier(o.suivi[z].duree)) fautes.push(`fils.${k}.${o.cle} : ${z} sans durée`);
    if (!entier(o.suivi.apres)) fautes.push(`fils.${k}.${o.cle} : aucune échéance en matchs`);
  }
  exiger('chaque effet (et chaque suite, pari ou suivi) dit sa durée en matchs, écrite dans l\'option', !fautes.length, fautes.slice(0, 5).join(' · ') || `${n} options`);
  const cas = [[0, 3, 'Du 1er au 3e match'], [30, 8, 'Du 31e au 38e match'], [5, 1, 'Au 6e match'], [0, 1, 'Au 1er match'], [12, 0, '']];
  const mal = cas.filter(([j, d, att]) => fenetreDuChoix(j, d) !== att).map(([j, d, att]) => `${j}/${d} → « ${fenetreDuChoix(j, d)} », attendu « ${att} »`);
  exiger('la fenêtre d\'un choix se dit en rangs de matchs', !mal.length, mal.join(' · ') || `${cas.length} cas`);
}
{
  // La fenêtre dite = celle que le calendrier du club compte, et ses matchs sont joués dans les feuilles d'après.
  const fautes = [];
  let comptes = 0, joues = 0;
  const teams = ligue(GRAINES[0]), you = teams[0];
  you.isPlayer = true;
  const L = creerLigue(teams, 82, { graine: 'incidents-fenetres', courbe: true });
  const J0 = 12, dejaJoues = matchsEntre(you, 0, J0);
  jouerJusqua(L, L.calendrier.length);
  const siens = tes(L, you);
  const familles = [['moment', MOMENTS], ['sequence', SEQUENCES], ['dossier', DOSSIERS], ['vie', REPONSES_VIE]];
  for (const [famille, S] of familles) for (const [cle, M] of Object.entries(S)) for (const o of M.options) {
    if (!o.duree || o.rien || o.mutation || !(CANAUX.some(c => c in o))) continue;
    const e = effetDeMoment({ jour: J0, moment: { famille, cle, choix: o.cle } }, you);
    if (!e) { fautes.push(`${famille}.${cle}.${o.cle} : aucun effet posé`); continue; }
    const premier = matchsEntre(you, 0, e.debut) + 1, dernier = matchsEntre(you, 0, e.fin);
    // Une durée qui dépasse la saison (le contrat de télé, 82 matchs) court jusqu'à son dernier match.
    if (dejaJoues + o.duree > siens.length) { if (dernier !== siens.length) fautes.push(`${famille}.${cle}.${o.cle} : finit au ${dernier}e match, la saison en compte ${siens.length}`); continue; }
    comptes++;
    if (e.debut !== J0 || premier !== dejaJoues + 1 || dernier - premier + 1 !== o.duree) { fautes.push(`${famille}.${cle}.${o.cle} : du ${premier}e au ${dernier}e match, ${o.duree} dits`); continue; }
    if (fenetreDuChoix(dejaJoues, o.duree) !== (o.duree === 1 ? `Au ${premier}e match` : `Du ${premier === 1 ? '1er' : `${premier}e`} au ${dernier}e match`)) fautes.push(`${famille}.${cle}.${o.cle} : la fenêtre dite n'est pas celle du calendrier`);
    // Les feuilles d'après : les matchs de la fenêtre sont ceux qui ont été joués, ni un de plus ni un de moins.
    const dedans = siens.filter(x => x.j >= e.debut && x.j < e.fin && x.m.feuille);
    if (e.fin <= L.calendrier.length) { joues++; if (dedans.length !== o.duree) fautes.push(`${famille}.${cle}.${o.cle} : ${dedans.length} feuilles dans la fenêtre, ${o.duree} dits`); }
  }
  exiger('la fenêtre dite (« Du 13e au 20e match ») est celle du calendrier du club, et ses matchs sont joués dans les feuilles d\'après', !fautes.length && comptes > 50 && joues > 40,
    fautes.slice(0, 4).join(' · ') || `${comptes} options, ${joues} fenêtres recomptées dans les feuilles`);
}

/* ---------- 5. quand : un dilemme tombe à −2…+2 matchs de sa grille ---------- */
const graines = Array.from({ length: 60 }, (_, i) => `g${i}`);
const mauvais = graines.filter(g => { const m = JOURS_MOMENTS.map(k => matchDuMoment(g, k)); return m.some((x, i) => i && x <= m[i - 1]) || m.some((x, i) => Math.abs(x - JOURS_MOMENTS[i]) > 2); });
exiger('les dates tirées restent dans l\'ordre de la grille, à deux matchs près, sans jamais se confondre', mauvais.length === 0, `${mauvais.length} graines sur ${graines.length}`);
verdict('Les incidents');
