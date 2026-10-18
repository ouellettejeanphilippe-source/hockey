/*
 * CE QUE LES ROBOTS FONT DU JEU DE CARTES NEUF (V10, tranche 6 — docs/refonte-v10.md § 8). Avant, ils n'en jouaient
 * rien, sauf le cahier au duel : la profondeur du jeu neuf ne se mesurait pas. Ils suivent maintenant les règles d'une
 * run (les deux patrons que le départ impose, js/banque.js `patronsDeDepart`) et, selon la politique
 * (scripts/lib/rogue_sim.mjs) :
 *   - l'attentif lit : il prend la route que l'entraîneur recommande (`sceneDeLaRoute`, js/scenes.js), la réponse
 *     d'un dossier qui rend le plus sur ses soirs, et, aux paliers des 9e, 18e et 26e matchs, la place qui rend le
 *     plus, qu'il joue tout de suite (elle attend son moment d'elle-même) ;
 *   - le distrait clique au hasard, sur son propre générateur ;
 *   - le robot d'avant ('defaut') ne joue pas de cartes en saison : la pente de check_rogue et de check_robot reste
 *     celle d'un gérant grossier.
 * Le robot ne voit que ce que l'écran montre : la cédule de la semaine, ses jambes, son infirmerie, sa caisse.
 */
import { MOMENTS_SI, dosADos, energieDe, SLOTS, rivalChoisi } from '../../js/sim.js';
import { DOSSIERS, dossierDeLaSemaine } from '../../js/dossiers.js';
import { sceneDeLaRoute } from '../../js/scenes.js';
import { noeudsDeLaSemaine, decisionDeNoeud } from '../../js/noeuds.js';
import { BANQUE, CONSOMMABLES, payloadDe } from '../../js/banque.js';
import { cartesDuPalier, PALIERS_PACK, SEMAINE } from '../../js/inventaire.js';

/*
 * CE QU'UN EFFET RAPPORTE, grossièrement, en victoires par soir où il joue : les poids mesurés de js/banque.js (1 % de
 * précision ou de tirs ≈ 0,18 victoire sur une saison, 1 % de buts contre ≈ 0,28, un point de robustesse ≈ 0,5),
 * ramenés à un soir. Une lecture d'attentif, pas une mesure : les vraies valeurs sont à check_places.
 */
const POIDS = { finition: 0.18, volume: 0.18, defense: 0.28, discipline: 0.05, energie: 0.05, blessure: 0.03 };
const SENS = { finition: 1, volume: 1, defense: -1, discipline: -1, energie: -1, blessure: -1 };
const parSoir = e => {
  let v = 0;
  for (const [k, w] of Object.entries(POIDS)) if (typeof e[k] === 'number') v += w * SENS[k] * (e[k] - 1) * 100;
  if (typeof e.robustesse === 'number') v += 0.5 * e.robustesse;
  return v / 82;
};
/** Ce que rend un effet sur ses soirs : `duree` matchs, et seulement ceux de son moment. */
const valeurDEffet = (e, duree) => {
  if (!e) return 0;
  const Mo = e.si && MOMENTS_SI[e.si];
  return parSoir(e) * (duree || 0) * (Mo ? Mo.parSaison / 82 : 1);
};
const JETON = 0.01;   // une victoire vaut une centaine de jetons, à la louche (le barème : 5 par victoire, les packs à 12 et plus)

/* Les faits du lundi, comme l'écran les lit (js/saison.js `faitsDuLundi`), à partir de ce que la ligue a joué. */
function faitsDuRobot(L, you, jetons) {
  const pats = SLOTS.filter(s => !s.scratch && s.group !== 'G').map(s => you.roster[s.i]).filter(Boolean).map(p => ({ n: p.n, j: Math.round(energieDe(p)) }));
  const jours = [];
  for (let j = L.jour; j < Math.min(L.calendrier.length, L.jour + SEMAINE); j++) if (L.calendrier[j].some(m => m.A === you || m.B === you)) jours.push(j);
  const soirs = jours.map(j => L.calendrier[j].find(m => m.A === you || m.B === you));
  const advs = soirs.map(m => (m.A === you ? m.B : m.A));
  const joues = L.calendrier.slice(0, L.jour).flatMap(j => j.filter(m => (m.A === you || m.B === you) && Number.isFinite(m.gfA)));
  const der = joues[joues.length - 1] || null, chez = der && der.A === you;
  const rang = [...L.teams].sort((a, b) => (b.PTS || 0) - (a.PTS || 0)).indexOf(you) + 1;
  return {
    n: joues.length,
    jambes: pats.length ? Math.round(pats.reduce((a, x) => a + x.j, 0) / pats.length) : 100,
    pire: pats.reduce((b, x) => (!b || x.j < b.j ? x : b), null),
    blesses: [...(you.injured || new Map()).keys()].map(p => ({ n: p.n, m: 1 })),
    soirs: soirs.length, dos: jours.filter(j => dosADos(you, j)).length,
    visiteur: soirs.filter(m => m.B === you).length, domicile: soirs.filter(m => m.A === you).length,
    rival: advs.some(a => rivalChoisi(you, a)) ? 'rival' : null,
    bete: advs.includes(you.beteNoire) ? 'bête noire' : null,
    caisse: jetons, dernier: der ? { pour: chez ? der.gfA : der.gfB, contre: chez ? der.gfB : der.gfA, adv: 'eux' } : null,
    rang, equipes: L.teams.length,
  };
}

/*
 * LE LUNDI DU ROBOT : la route (les semaines impaires), le dossier (les paires, dès la deuxième), la carte d'un palier
 * (quand le compte de matchs le franchit). Rend les décisions à pousser au jour de la ligue. `etat` : ce que la saison
 * retient (les dossiers déjà ouverts, les paliers pris).
 */
export function lundiDuRobot({ L, you, graine, politique, clic, jetons, etat }) {
  const out = [];
  if (politique === 'defaut') return out;
  const auHasard = l => l[Math.floor(clic() * l.length)];
  const j = L.jour;
  const w = j / SEMAINE;
  const lundi = j % SEMAINE === 0 && j < L.calendrier.length;
  const f = lundi || etat.paliers.size < PALIERS_PACK.length ? faitsDuRobot(L, you, jetons) : null;
  if (lundi && w % 2 === 1) {
    const routes = noeudsDeLaSemaine(graine, w);
    const prise = clic ? auHasard(routes) : routes.find(n => n.route === sceneDeLaRoute({ jambes: f.jambes, blesses: f.blesses.length, dos: f.dos, caisse: f.caisse }).route) || routes[0];
    out.push({ jour: j, ...decisionDeNoeud(w, prise) });
  }
  if (lundi && w >= 2 && w % 2 === 0) {
    const cle = dossierDeLaSemaine(graine, w, f, etat.dossiers);
    if (cle) {
      etat.dossiers.push(cle);
      const D = DOSSIERS[cle];
      const possibles = D.options.filter(o => !(o.gain < 0 && f.caisse < -o.gain));
      const o = clic ? auHasard(possibles) : possibles.reduce((b, x) => {
        const v = valeurDEffet(x, x.duree) + (x.gain || 0) * JETON;
        return !b || v > b.v ? { o: x, v } : b;
      }, null).o;
      out.push({ jour: j, palier: `do:${w}`, moment: { famille: 'dossier', cle, choix: o.cle }, ...(o.gain ? { gain: o.gain } : {}) });
    }
  }
  // LA CARTE D'UN PALIER (9e, 18e, 26e matchs) : une place parmi trois, jouée tout de suite.
  const pp = f && PALIERS_PACK.find(x => f.n >= x && !etat.paliers.has(x));
  if (pp !== undefined && pp !== null && f) {
    etat.paliers.add(pp);
    const ids = cartesDuPalier(graine, pp).filter(id => BANQUE[id] && BANQUE[id].cat === 'consommable' && CONSOMMABLES[BANQUE[id].cle] && CONSOMMABLES[BANQUE[id].cle].cible === 'aucune');
    if (ids.length) {
      const C = id => CONSOMMABLES[BANQUE[id].cle];
      const id = clic ? auHasard(ids) : ids.reduce((b, x) => {
        const v = valeurDEffet(C(x).effet && { ...C(x).effet, si: C(x).si }, C(x).duree) + (C(x).gain || 0) * JETON;
        return !b || v > b.v ? { id: x, v } : b;
      }, null).id;
      const P = payloadDe(id);
      out.push({ jour: j, palier: `pp:${pp}`, place: id });
      if (P) out.push({ jour: j, joue: { src: 'partie', ref: `pp:${pp}`, id }, ...P });
    }
  }
  return out;
}
