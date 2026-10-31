/*
 * LES DOSSIERS DE LA SEMAINE (V10, tranche 5 — js/dossiers.js). Les événements quittent la banque : ce qui arrive à
 * ton club est un choix d'À faire, dit par une voix. Ce qu'on exige :
 *   1. les événements sont partis (V10, tranche 6) : leur famille n'existe plus dans la banque ;
 *   2. la forme : une voix d'`EXPEDITEURS`, deux répliques au moins, deux ou trois réponses nommées, chacune un bon
 *      côté et une CONSÉQUENCE CONCRÈTE (V21, docs/refonte-v21.md § 3) : des jetons, de l'expérience au coach, un
 *      adjoint gagné ou perdu, des jambes, une suspension, un soin, l'auxiliaire, la masse salariale, ou ce qui
 *      arrive au joueur nommé ; jamais plus un pourcentage de l'équipe pour quelques soirs ;
 *   3. pur : la même graine, la même semaine et les mêmes faits rendent le même dossier, toujours un dossier vrai ; aucun
 *      dossier vrai, aucun dossier (null) ; jamais deux fois le même dans une saison ;
 *   4. chacun s'ouvre : sur des lundis fabriqués, chaque dossier sort au moins une fois ;
 *   5. la porte : aucune réponse ne devient un effet d'équipe ; ses jetons restent à la décision.
 * La banque est vide (V22, phase 4) : les parties qui jugent un contenu (2, 4, 5) s'informent « banque vide » ; le système
 * (les lundis d'une histoire, le tirage pur, le null sans dossier vrai) se juge toujours.
 */
import { DOSSIERS, dossierDeLaSemaine, semaineAHistoire } from '../js/dossiers.js';
import { EXPEDITEURS } from '../js/vie-gm.js';
import { BANQUE, ORDRE_CATEGORIES } from '../js/banque.js';
import { effetDeMoment } from '../js/sim.js';
import { exiger, informer, verdict } from './verdict.mjs';

/* ---------- 1. les événements sont partis ---------- */
{
  const restes = Object.keys(BANQUE).filter(id => id.startsWith('evenement:'));
  exiger('les événements sont partis de la banque', !ORDRE_CATEGORIES.includes('evenement') && !restes.length, restes.slice(0, 4).join(', ') || 'aucun événement');
}

/* ---------- 2. la forme ---------- */
// V21 : les champs d'une conséquence concrète ; `duree` ne sert qu'à ce qui arrive au joueur nommé (`lui`).
const CHAMPS = new Set(['cle', 'nom', 'bon', 'prix', 'duree', 'action', 'gain', 'xp', 'adjoint', 'perdAdjoint', 'soin', 'rien', 'lui', 'plafond', 'pari']);
const ACTIONS = new Set(['energieTous', 'gardienAux', 'energie', 'absents']);
/* Ce qu'un joueur nommé porte (V11, tranche 4) : ses canaux à lui (`CANAUX_MUT`, js/sim.js). */
const CANAUX_LUI = new Set(['lancers', 'finition', 'creation', 'defense', 'blessure', 'arrets']);
{
  const voix = new Set(Object.keys(EXPEDITEURS));
  const fautes = [];
  for (const [cle, D] of Object.entries(DOSSIERS)) {
    if (!voix.has(D.de)) fautes.push(`${cle} : la voix ${D.de}`);
    if (!D.titre || !D.ico || (D.mots || []).length < 2) fautes.push(`${cle} : titre, icône ou répliques`);
    if (D.options.length < 2 || D.options.length > 3) fautes.push(`${cle} : ${D.options.length} réponses`);
    for (const o of D.options) {
      if (!o.cle || !o.nom || !o.bon) fautes.push(`${cle}/${o.cle} : un nom et un bon côté`);
      const inconnus = Object.keys(o).filter(k => !CHAMPS.has(k));
      if (inconnus.length) fautes.push(`${cle}/${o.cle} : ${inconnus.join(', ')}`);
      if (o.action && Object.keys(o.action).some(k => !ACTIONS.has(k))) fautes.push(`${cle}/${o.cle} : le geste`);
      if (!o.rien && !o.action && !o.gain && !o.xp && !o.adjoint && !o.perdAdjoint && !o.soin && !o.lui && !o.pari && !o.plafond) fautes.push(`${cle}/${o.cle} : ne fait rien de concret`);
      if (o.duree && !o.lui) fautes.push(`${cle}/${o.cle} : une durée sans joueur`);
      // L'AUDACE (V20) : un dé sur le joueur que le dossier nomme — ses deux issues sur ses canaux à lui, chacune une durée, rien à l'équipe.
      if (o.pari) {
        const issues = [o.pari.gagne, o.pari.perd];
        if (!D.joueur || !(o.pari.chance > 0 && o.pari.chance < 1) || issues.some(e => !e || !e.duree || !e.lui || Object.keys(e).some(k => !['duree', 'lui'].includes(k)) || Object.keys(e.lui).some(k => !CANAUX_LUI.has(k))))
          fautes.push(`${cle}/${o.cle} : l'audace`);
      }
      // Ce qui va à un joueur : seulement dans un dossier qui le nomme.
      if ((o.lui || o.soin || (o.action && (o.action.energie || o.action.absents))) && !D.joueur) fautes.push(`${cle}/${o.cle} : un joueur que le dossier ne nomme pas`);
      if (o.lui && (!o.duree || Object.keys(o.lui).some(k => !CANAUX_LUI.has(k)))) fautes.push(`${cle}/${o.cle} : ce qui va au joueur`);
      // Un rachat vise le contrat que le dossier nomme ; de l'espace, lui, va au club.
      if (o.plafond && (Object.keys(o.plafond).some(k => !['espace', 'facteur'].includes(k)) || (o.plafond.facteur && !D.joueur))) fautes.push(`${cle}/${o.cle} : le plafond`);
    }
  }
  exiger('chaque dossier a sa voix, ses répliques et deux ou trois réponses aux conséquences concrètes', !fautes.length, fautes.slice(0, 4).join(' · ') || `${Object.keys(DOSSIERS).length} dossiers`);
  if (!Object.keys(DOSSIERS).length) informer('la forme : banque vide (V22, phase 4)', 'aucun dossier à juger');
}

/* ---------- 2b. les lundis d'une histoire (V20) : tirés de la graine, une semaine sur deux en moyenne, jamais deux runs pareilles ---------- */
{
  const grilles = Array.from({ length: 60 }, (_, g) => Array.from({ length: 26 }, (_, w) => (semaineAHistoire(`h${g}`, w) ? 1 : 0)));
  const part = grilles.flat().reduce((a, b) => a + b, 0) / (60 * 26);
  const distinctes = new Set(grilles.map(l => l.join(''))).size;
  exiger('les lundis d\'une histoire : environ une semaine sur deux, purs, et pas les mêmes d\'une graine à l\'autre', part > 0.45 && part < 0.65 && distinctes === 60
    && !semaineAHistoire('h0', 0) && semaineAHistoire('h7', 9) === semaineAHistoire('h7', 9), `${(100 * part).toFixed(0)} % des lundis, ${distinctes} grilles distinctes sur 60`);
}

/* ---------- 3 et 4 : pur, une fois par saison, chacun s'ouvre ---------- */
{
  // La banque est vide : deux dossiers d'essai, qui ne servent qu'à tirer (ils partent à la fin du bloc).
  const ESSAIS = Object.keys(DOSSIERS).length ? [] : ['essaiRoute', 'essaiRival'];
  if (ESSAIS.length) { DOSSIERS.essaiRoute = { titre: 'Essai : la route', quand: f => f.visiteur >= 3, options: [] }; DOSSIERS.essaiRival = { titre: 'Essai : le rival', quand: f => !!f.rival, options: [] }; }
  // Des lundis fabriqués : chaque fait balaie ses valeurs, sur une graine qui ne se répète pas.
  let x = 7;
  const r = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pige = a => a[Math.floor(r() * a.length)];
  const lundi = () => {
    const soirs = pige([1, 2, 3, 3, 4]), visiteur = Math.floor(r() * (soirs + 1));
    const joueur = (p, x) => (r() < p ? { n: 'Untel', cle: 'u', m: 10, ...x } : null);
    return { n: pige([0, 6, 14, 28, 50]), jambes: pige([76, 85, 90, 94]), pire: { n: 'Untel', cle: 'u', j: pige([70, 78, 84, 92]) },
      boude: joueur(0.15, { zone: 'Top 6', ou: '4e trio', pts: 2 }), puni: joueur(0.15, { pun: 5 }), muet: joueur(0.1, { sal: '7,5 M$', pts: 1 }),
      vedette: joueur(0.6, { fait: 'Untel : 9 points en 10 matchs' }), gardien: joueur(0.6, { fait: 'Untel : 4 buts sur 30 tirs ce soir-là' }),
      blesses: Array.from({ length: pige([0, 1, 2, 3]) }, (_, i) => ({ n: `B${i}`, m: 4 })), soirs, dos: pige([0, 0, 1]), visiteur, domicile: soirs - visiteur,
      rival: r() < 0.2 ? 'Rival' : null, bete: r() < 0.08 ? 'Bête' : null, caisse: pige([5, 40, 60, 120]),
      dernier: { pour: pige([0, 2, 4]), contre: pige([1, 3, 6]), adv: 'Eux' }, rang: pige([1, 5, 16, 30]), equipes: 32,
      masse: { espace: pige([-500_000, 800_000, 4_000_000, 9_000_000]), libre: '0,8 M$', lourd: { n: 'Lourd', cle: 'l', sal: '9,5 M$' } },
      defaites: pige([0, 0, 1, 2, 4, 5]), coach: { cle: 'tortue', nom: 'La Tortue', ico: '🐢', niveau: 2, adjoints: 1 } };
  };
  let purs = true, uneFois = true, vrai = true, nul = true;
  const sortis = new Map();
  for (let g = 0; g < 400; g++) {
    const deja = [];
    for (let w = 2; w < 26; w += 2) {
      const f = lundi();
      const a = dossierDeLaSemaine(g, w, f, deja), b = dossierDeLaSemaine(g, w, f, deja.slice());
      if (a !== b) purs = false;
      if (!Object.keys(DOSSIERS).some(k => !deja.includes(k) && DOSSIERS[k].quand(f)) && a !== null) nul = false;
      if (!a) continue;
      if (deja.includes(a)) uneFois = false;
      if (!DOSSIERS[a].quand(f)) vrai = false;
      deja.push(a);
      sortis.set(a, (sortis.get(a) || 0) + 1);
    }
  }
  exiger('pur : la même graine, la même semaine et les mêmes faits rendent le même dossier', purs);
  exiger('jamais deux fois le même dossier dans une saison', uneFois);
  exiger('le dossier rendu est toujours un dossier vrai, et sans dossier vrai la semaine n\'en a pas (null)', vrai && nul);
  const jamais = Object.keys(DOSSIERS).filter(k => !sortis.has(k));
  exiger('chaque dossier s\'ouvre', !jamais.length, jamais.join(', ') || `${sortis.size} dossiers sur 400 saisons`);
  if (ESSAIS.length) informer('les lundis fabriqués : banque vide (V22, phase 4)', `${ESSAIS.length} dossiers d'essai, pour le tirage seulement`);
  informer('le plus et le moins ouverts', [...sortis.entries()].sort((p, q) => q[1] - p[1]).filter((_, i, t) => i < 3 || i >= t.length - 3).map(([k, n]) => `${DOSSIERS[k].titre} ${n}`).join(' · '));
  for (const k of ESSAIS) delete DOSSIERS[k];
}

/* ---------- 5. la porte des dilemmes ---------- */
{
  const fautes = [];
  for (const [cle, D] of Object.entries(DOSSIERS)) for (const o of D.options) {
    const e = effetDeMoment({ jour: 10, moment: { famille: 'dossier', cle, choix: o.cle } }, null);
    if (e) fautes.push(`${cle}/${o.cle} : un effet d'équipe`);
  }
  exiger('aucune réponse ne pose un effet d\'équipe (V21 : des conséquences concrètes)', !fautes.length, fautes.slice(0, 4).join(' · ') || 'aucune');
}

verdict('Les dossiers de la semaine');
