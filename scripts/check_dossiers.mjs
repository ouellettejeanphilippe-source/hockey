/*
 * LES DOSSIERS DE LA SEMAINE (V10, tranche 5 — js/dossiers.js). Les événements quittent la banque : ce qui arrive à
 * ton club est un choix d'À faire, dit par une voix. Ce qu'on exige :
 *   1. les événements sont partis (V10, tranche 6) : leur famille n'existe plus, et rien n'en tire (ni pack, ni palier,
 *      ni route de la semaine) ;
 *   2. la forme : une voix d'`EXPEDITEURS`, deux répliques au moins, deux ou trois réponses nommées, chacune un bon
 *      côté, sur des champs que la porte des dilemmes lit déjà (`effetDeMoment`, `appliquerGestes`, `gain`), un moment
 *      que le moteur connaît, hors du duel ;
 *   3. pur : la même graine, la même semaine et les mêmes faits rendent le même dossier ; jamais deux fois le même dans
 *      une saison ; la pratique du mardi seulement quand rien d'autre n'est vrai ;
 *   4. chacun s'ouvre : sur des lundis fabriqués, chaque dossier sort au moins une fois ;
 *   5. la porte : une réponse devient un effet qui garde son moment, ses gestes et ses jetons.
 * La valeur de chaque réponse, en paires : `check_places` (sous la borne d'une commune).
 */
import { DOSSIERS, dossierDeLaSemaine, semaineAHistoire } from '../js/dossiers.js';
import { EXPEDITEURS } from '../js/vie-gm.js';
import { BANQUE, ORDRE_CATEGORIES } from '../js/banque.js';
import { PACKS_CARTES, tirerCartesPack } from '../js/packs.js';
import { MOMENTS_SI, effetDeMoment } from '../js/sim.js';
import { exiger, informer, verdict } from './verdict.mjs';

/* ---------- 1. les événements sont partis ---------- */
{
  const tires = new Set();
  for (let n = 0; n < 300; n++) {
    for (const k of Object.keys(PACKS_CARTES)) tirerCartesPack(k, `ev${n}`, n).forEach(id => tires.add(id));
    for (const p of [9, 18, 26]) tirerCartesPack('mixte', `ev${n}`, `palier${p}`, { sans: ['match'] }).forEach(id => tires.add(id));
  }
  const restes = [...tires, ...Object.keys(BANQUE)].filter(id => id.startsWith('evenement:'));
  exiger('les événements sont partis : ni famille, ni pack, ni palier, ni route', !ORDRE_CATEGORIES.includes('evenement') && !restes.length, restes.slice(0, 4).join(', ') || `${tires.size} cartes tirées, aucun événement`);
}

/* ---------- 2. la forme ---------- */
const CANAUX = ['finition', 'volume', 'defense', 'discipline', 'blessure', 'energie', 'robustesse', 'F', 'D'];
// V16 (tranche 6) : la masse salariale (`plafond`, lu par `plafondDe`) et le congédiement (`coachNeuf`), deux décisions qui existent.
const CHAMPS = new Set(['cle', 'nom', 'bon', 'prix', 'si', 'duree', 'action', 'gain', 'rien', 'lui', 'plafond', 'coachNeuf', 'pari', ...CANAUX]);
const ACTIONS = new Set(['energieTous', 'gardienAux', 'energie']);
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
      if (o.si && (!MOMENTS_SI[o.si] || MOMENTS_SI[o.si].duel || MOMENTS_SI[o.si].choix)) fautes.push(`${cle}/${o.cle} : le moment ${o.si}`);
      if (o.action && Object.keys(o.action).some(k => !ACTIONS.has(k))) fautes.push(`${cle}/${o.cle} : le geste`);
      const canaux = CANAUX.some(k => k in o);
      if (canaux && !o.duree) fautes.push(`${cle}/${o.cle} : un effet sans durée`);
      if (!o.rien && !canaux && !o.action && !o.gain && !o.lui && !o.pari && !o.plafond && o.coachNeuf == null) fautes.push(`${cle}/${o.cle} : ne fait rien`);
      // L'AUDACE (V20) : un dé sur le joueur que le dossier nomme — ses deux issues sur ses canaux à lui, chacune une durée, rien à l'équipe.
      if (o.pari) {
        const issues = [o.pari.gagne, o.pari.perd];
        if (!D.joueur || !(o.pari.chance > 0 && o.pari.chance < 1) || issues.some(e => !e || !e.duree || !e.lui || Object.keys(e).some(k => !['duree', 'lui'].includes(k)) || Object.keys(e.lui).some(k => !CANAUX_LUI.has(k))))
          fautes.push(`${cle}/${o.cle} : l'audace`);
      }
      // Le gros d'un joueur (V11) : seulement dans un dossier qui le nomme, sur ses canaux à lui, le temps d'une durée.
      if ((o.lui || (o.action && o.action.energie)) && !D.joueur) fautes.push(`${cle}/${o.cle} : un effet sur un joueur que le dossier ne nomme pas`);
      if (o.lui && (!o.duree || Object.keys(o.lui).some(k => !CANAUX_LUI.has(k)))) fautes.push(`${cle}/${o.cle} : ce qui va au joueur`);
      // Un rachat vise le contrat que le dossier nomme ; de l'espace, lui, va au club.
      if (o.plafond && (Object.keys(o.plafond).some(k => !['espace', 'facteur'].includes(k)) || (o.plafond.facteur && !D.joueur))) fautes.push(`${cle}/${o.cle} : le plafond`);
    }
  }
  exiger('chaque dossier a sa voix, ses répliques et deux ou trois réponses, sur les champs que le moteur lit déjà', !fautes.length, fautes.slice(0, 4).join(' · ') || `${Object.keys(DOSSIERS).length} dossiers`);
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
  // Des lundis fabriqués : chaque fait balaie ses valeurs, sur une graine qui ne se répète pas.
  let x = 7;
  const r = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pige = a => a[Math.floor(r() * a.length)];
  const lundi = () => {
    const soirs = pige([1, 2, 3, 3, 4]), visiteur = Math.floor(r() * (soirs + 1));
    const joueur = (p, x) => (r() < p ? { n: 'Untel', cle: 'u', m: 10, ...x } : null);
    return { n: pige([0, 6, 14, 28, 50]), jambes: pige([76, 85, 90, 94]), pire: { n: 'Untel', cle: 'u', j: pige([70, 78, 84, 92]) },
      boude: joueur(0.15, { zone: 'Top 6', ou: '4e trio', pts: 2 }), puni: joueur(0.15, { pun: 5 }), muet: joueur(0.1, { sal: '7,5 M$', pts: 1 }),
      blesses: Array.from({ length: pige([0, 1, 2, 3]) }, (_, i) => ({ n: `B${i}`, m: 4 })), soirs, dos: pige([0, 0, 1]), visiteur, domicile: soirs - visiteur,
      rival: r() < 0.2 ? 'Rival' : null, bete: r() < 0.08 ? 'Bête' : null, caisse: pige([5, 40, 60, 120]),
      dernier: { pour: pige([0, 2, 4]), contre: pige([1, 3, 6]), adv: 'Eux' }, rang: pige([1, 5, 16, 30]), equipes: 32,
      masse: { espace: pige([-500_000, 800_000, 4_000_000, 9_000_000]), libre: '0,8 M$', lourd: { n: 'Lourd', cle: 'l', sal: '9,5 M$' } },
      defaites: pige([0, 0, 1, 2, 4, 5]), coach: 'La Tortue', coachs: [{ cle: 'a', nom: 'Le Frelon', ico: '🐝' }, { cle: 'b', nom: "L'Aigle", ico: '🦅' }] };
  };
  let purs = true, uneFois = true, reserve = true;
  const sortis = new Map();
  for (let g = 0; g < 400; g++) {
    const deja = [];
    for (let w = 2; w < 26; w += 2) {
      const f = lundi();
      const a = dossierDeLaSemaine(g, w, f, deja), b = dossierDeLaSemaine(g, w, f, deja.slice());
      if (a !== b) purs = false;
      if (!a) continue;
      if (deja.includes(a)) uneFois = false;
      const autres = Object.keys(DOSSIERS).filter(k => k !== 'laPratique' && !deja.includes(k) && DOSSIERS[k].quand(f));
      if (a === 'laPratique' && autres.length) reserve = false;
      deja.push(a);
      sortis.set(a, (sortis.get(a) || 0) + 1);
    }
  }
  exiger('pur : la même graine, la même semaine et les mêmes faits rendent le même dossier', purs);
  exiger('jamais deux fois le même dossier dans une saison', uneFois);
  exiger('la pratique du mardi, seulement quand rien d\'autre n\'est vrai', reserve);
  const jamais = Object.keys(DOSSIERS).filter(k => !sortis.has(k));
  exiger('chaque dossier s\'ouvre', !jamais.length, jamais.join(', ') || `${sortis.size} dossiers sur 400 saisons`);
  informer('le plus et le moins ouverts', [...sortis.entries()].sort((p, q) => q[1] - p[1]).filter((_, i, t) => i < 3 || i >= t.length - 3).map(([k, n]) => `${DOSSIERS[k].titre} ${n}`).join(' · '));
}

/* ---------- 5. la porte des dilemmes ---------- */
{
  const fautes = [];
  for (const [cle, D] of Object.entries(DOSSIERS)) for (const o of D.options) {
    const e = effetDeMoment({ jour: 10, moment: { famille: 'dossier', cle, choix: o.cle } }, null);
    const canaux = CANAUX.some(k => k in o);
    if (canaux !== !!e) fautes.push(`${cle}/${o.cle} : l'effet`);
    if (e && (e.si || null) !== (o.si || null)) fautes.push(`${cle}/${o.cle} : le moment se perd`);
    if (e && 'gain' in e) fautes.push(`${cle}/${o.cle} : les jetons entrent dans l'effet`);
  }
  exiger('une réponse devient un effet qui garde son moment, et ses jetons restent à la décision', !fautes.length, fautes.slice(0, 4).join(' · ') || 'toutes');
}

verdict('Les dossiers de la semaine');
