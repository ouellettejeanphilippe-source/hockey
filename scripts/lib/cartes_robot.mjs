/*
 * CE QUE LES ROBOTS FONT DU COACH-PERSONNAGE (V21, docs/refonte-v21.md). Le coach d'une run a ses pouvoirs et son
 * staff ; le robot, comme le gérant, choisit ses talents, ses adjoints et ses réponses aux histoires. Selon la politique
 * (scripts/lib/rogue_sim.mjs) :
 *   - l'attentif lit : le talent va au pouvoir qui a le plus joué ; l'adjoint, le bras droit de son coach d'abord (la
 *     synergie, js/adjoints.js), puis dans l'ordre de ce que les échanges rendent en moyenne (`PREFERE`, mesuré par
 *     check_pouvoirs), et ses trois meilleurs en poste, son bras droit d'abord ; à une
 *     histoire, la réponse qui rend le plus, en conséquences concrètes (l'expérience, un adjoint, des jetons, des jambes) ;
 *   - le distrait clique au hasard, sur son propre générateur ;
 *   - le robot d'avant ('defaut') prend la première option de chaque écran : un gérant grossier, qui garde un coach.
 * Le robot ne voit que ce que l'écran montre : les feuilles jouées, la cédule de la semaine, ses jambes, sa caisse.
 */
import { dosADos, energieDe, SLOTS, rivalChoisi, getPlayerKey } from '../../js/sim.js';
import { DOSSIERS, dossierDeLaSemaine, semaineAHistoire, FENETRE_JOUEUR } from '../../js/dossiers.js';
import { PALIERS_PACK, SEMAINE } from '../../js/inventaire.js';
import { joueurDuFait } from '../../js/vie-gm.js';
import { COACHS } from '../../js/coachs.js';
import { POUVOIRS, niveauDuPerso, talentsDus, pouvoirsOuverts } from '../../js/pouvoirs.js';
import { ADJOINTS, ADJOINTS_MAX, adjointsOfferts, avecAdjoint, staffDe } from '../../js/adjoints.js';

const JETON = 0.01;   // une victoire vaut une centaine de jetons, à la louche (le barème : 5 par victoire, les packs à 12 et plus)
/* Ce que vaut une conséquence, grossièrement, en victoires : un adjoint, un point d'expérience, des jambes, un match d'infirmerie. */
const VAUT = { adjoint: 0.5, xp: 0.05, jambes: 0.02, absent: 0.15, soin: 0.1 };

/* L'ordre de l'attentif : les échanges qui paient le plus souvent d'abord (check_pouvoirs, la section des adjoints). */
const PREFERE = ['rouleur', 'cogneur', 'trappeur', 'vedettiste', 'soigneur', 'canonnier', 'prof', 'tireur', 'numeroDeux', 'numeroUn', 'mitrailleur', 'mur'];
const rangDe = (k, coach = null) => (coach && ADJOINTS[k] && ADJOINTS[k].voie === coach ? -1 : PREFERE.includes(k) ? PREFERE.indexOf(k) : PREFERE.length);
/* Le coach du jour, comme l'écran le lit pour offrir ses adjoints (`adjointsOfferts`) : sa clé et son niveau. */
const coachDuJour = perso => (perso ? { cle: perso.cle, niveau: niveauDuPerso(perso) } : null);
const feuillesDe = (L, you) => L.calendrier.slice(0, L.jour).flatMap(j => j.filter(m => (m.A === you || m.B === you) && m.feuille)).map(m => ({ m, f: m.feuille, cote: m.A === you ? 'A' : 'B' }));
/* Combien de périodes chaque pouvoir a joué cette saison, lu dans les feuilles (`feuille.pouvoirs`). */
function foisDesPouvoirs(L, you) {
  const n = [0, 0, 0];
  for (const { f, cote } of feuillesDe(L, you)) for (const x of f.pouvoirs || []) if (x.cote === cote && !x.contagion) n[x.p]++;
  return n;
}
const persoDe = you => (you.perso ? { ...you.perso, xpSaison: you.xpSaison || 0 } : null);

/* Les faits du lundi, comme l'écran les lit (js/saison.js `faitsDuLundi`), à partir de ce que la ligue a joué. */
function faitsDuRobot(L, you, jetons) {
  const pats = SLOTS.filter(s => !s.scratch && s.group !== 'G').map(s => you.roster[s.i]).filter(Boolean).map(p => ({ n: p.n, cle: getPlayerKey(p), j: Math.round(energieDe(p)) }));
  const jours = [];
  for (let j = L.jour; j < Math.min(L.calendrier.length, L.jour + SEMAINE); j++) if (L.calendrier[j].some(m => m.A === you || m.B === you)) jours.push(j);
  const soirs = jours.map(j => L.calendrier[j].find(m => m.A === you || m.B === you));
  const advs = soirs.map(m => (m.A === you ? m.B : m.A));
  const miens = feuillesDe(L, you).filter(x => Number.isFinite(x.m.gfA));
  const der = miens.length ? miens[miens.length - 1].m : null, chez = der && der.A === you;
  const rang = [...L.teams].sort((a, b) => (b.PTS || 0) - (a.PTS || 0)).indexOf(you) + 1;
  const habilles = new Set(SLOTS.filter(sl => !sl.scratch).map(sl => you.roster[sl.i]).filter(Boolean));
  const porte = sorte => { const x = joueurDuFait(sorte, miens.slice(-FENETRE_JOUEUR).map(({ f, cote }) => ({ f, cote })), habilles); return x ? { n: x.p.n, cle: getPlayerKey(x.p), fait: x.fait } : null; };
  let defaites = 0;
  for (let i = miens.length - 1; i >= 0; i--) { const { m } = miens[i], c = m.A === you; if ((c ? m.gfA : m.gfB) < (c ? m.gfB : m.gfA)) defaites++; else break; }
  const perso = persoDe(you), C = perso && COACHS[perso.cle];
  return {
    n: miens.length,
    jambes: pats.length ? Math.round(pats.reduce((a, x) => a + x.j, 0) / pats.length) : 100,
    pire: pats.reduce((b, x) => (!b || x.j < b.j ? x : b), null),
    blesses: [...(you.injured || new Map()).entries()].sort((a, b) => b[1] - a[1]).map(([p, m]) => ({ n: p.n, m, cle: getPlayerKey(p) })),
    vedette: porte('vedette'), gardien: porte('gardien'),
    soirs: soirs.length, dos: jours.filter(j => dosADos(you, j)).length,
    visiteur: soirs.filter(m => m.B === you).length, domicile: soirs.filter(m => m.A === you).length,
    rival: advs.some(a => rivalChoisi(you, a)) ? 'rival' : null,
    bete: advs.includes(you.beteNoire) ? 'bête noire' : null,
    caisse: jetons, dernier: der ? { pour: chez ? der.gfA : der.gfB, contre: chez ? der.gfB : der.gfA, adv: 'eux' } : null,
    rang, equipes: L.teams.length, defaites,
    coach: C ? { cle: perso.cle, nom: C.nom, ico: C.ico, niveau: niveauDuPerso(perso), adjoints: (perso.adjoints || []).length } : null,
  };
}

/* L'ADJOINT D'UN MOMENT FORT (js/saison.js `adjointsDuMoment`) : un parmi trois, tirés de la graine. Rend la décision. */
function adjointDuRobot({ you, graine, cle, politique, clic }) {
  const perso = persoDe(you);
  const offre = adjointsOfferts((perso || {}).adjoints, graine, cle, 3, coachDuJour(perso));
  if (!offre.length || !perso) return null;
  const k = clic ? offre[Math.floor(clic() * offre.length)] : politique === 'defaut' ? offre[0] : offre.reduce((a, b) => (rangDe(b, perso.cle) < rangDe(a, perso.cle) ? b : a));
  return { adjoint: { cle: k } };
}
/* La valeur d'une réponse d'histoire, en conséquences concrètes, pour l'attentif. */
function valeurDeReponse(o) {
  let v = (o.gain || 0) * JETON + (o.xp || 0) * VAUT.xp + (o.adjoint ? VAUT.adjoint : 0) - (o.perdAdjoint ? VAUT.adjoint : 0) + (o.soin || 0) * VAUT.soin;
  if (o.action) v += (o.action.energieTous || 0) * VAUT.jambes - (o.action.absents || 0) * VAUT.absent + (o.action.energie || 0) * VAUT.jambes / 4;
  return v;
}

/*
 * LE LUNDI DU ROBOT : l'histoire de la semaine (un lundi tiré de la graine, V20), l'adjoint d'un palier (quand le
 * compte de matchs le franchit), celui d'un gros match gagné, le talent quand le niveau le donne, et son staff tiré de
 * sa main. Rend les décisions
 * à pousser au jour de la ligue. `etat` : ce que la saison retient (les dossiers ouverts, les paliers et les butins pris).
 */
export function lundiDuRobot({ L, you, graine, politique, clic, jetons, etat }) {
  const out = [];
  const auHasard = l => l[Math.floor(clic() * l.length)];
  const j = L.jour;
  const w = j / SEMAINE;
  const lundi = j % SEMAINE === 0 && j < L.calendrier.length;
  const f = faitsDuRobot(L, you, jetons);
  // L'histoire de la semaine.
  if (lundi && semaineAHistoire(graine, w)) {
    const cle = dossierDeLaSemaine(graine, w, f, etat.dossiers);
    if (cle) {
      etat.dossiers.push(cle);
      const D = DOSSIERS[cle], lui = D.joueur ? D.joueur(f) : null;
      const perso = persoDe(you), partant = perso && perso.adjoints.length ? perso.adjoints[perso.adjoints.length - 1] : null;
      const possibles = D.options.filter(o => !(o.gain < 0 && f.caisse < -o.gain) && !(o.perdAdjoint && !partant));
      const o = clic ? auHasard(possibles) : politique === 'defaut' ? possibles[0] : possibles.reduce((b, x) => (valeurDeReponse(x) > valeurDeReponse(b) ? x : b));
      const offert = o.adjoint && perso ? adjointsOfferts(perso.adjoints, graine, `do:${w}`, 1, coachDuJour(perso))[0] || null : null;
      out.push({ jour: j, palier: `do:${w}`, moment: { famille: 'dossier', cle, choix: o.cle, ...(lui ? { joueur: lui.cle, joueurs: [lui.cle] } : {}) },
        ...(o.gain ? { gain: o.gain } : {}), ...(o.xp ? { xpCoach: o.xp } : {}),
        ...(offert ? { adjoint: { cle: offert } } : {}),
        ...(o.perdAdjoint && partant ? { perdAdjoint: partant } : {}),
        ...(o.soin && lui ? { gestes: { soin: o.soin, joueurs: [lui.cle] } } : {}) });
    }
  }
  // LE PALIER (9e, 18e, 26e matchs) : un adjoint parmi trois.
  const pp = PALIERS_PACK.find(x => f.n >= x && !etat.paliers.has(x));
  if (pp !== undefined) {
    etat.paliers.add(pp);
    const d = adjointDuRobot({ you, graine, cle: `pp${pp}`, politique, clic });
    if (d) out.push({ jour: j, palier: `pp:${pp}`, ...d });
  }
  // LE BUTIN D'UN GROS MATCH GAGNÉ : un adjoint parmi trois (js/saison.js `recompenseOuverte`).
  for (const mb of (you.minisBoss || []).filter(x => x.gagne && !etat.butins.has(x.jour))) {
    etat.butins.add(mb.jour);
    const d = adjointDuRobot({ you, graine, cle: `r${mb.jour}`, politique, clic });
    if (d) out.push({ jour: j, palier: `r:${mb.jour}`, ...d });
  }
  // LE STAFF (la main d'adjoints, Bureau › Coach) : après les arrivées et les départs du jour, l'attentif met en poste ses
  // trois meilleurs (son bras droit d'abord), le distrait trois au hasard ; le robot d'avant laisse le moteur faire (un
  // arrivant prend une case libre, sinon il attend). Une décision `staff` quand ça change ce qui joue.
  const P0 = persoDe(you);
  if (P0 && politique !== 'defaut' && out.some(d => d.adjoint || d.perdAdjoint)) {
    let P = { ...P0 };
    for (const d of out) {
      if (d.adjoint) P = { ...P, ...avecAdjoint(P, d.adjoint.cle) };
      if (d.perdAdjoint) P = { ...P, adjoints: P.adjoints.filter(k => k !== d.perdAdjoint), staff: staffDe(P).filter(k => k !== d.perdAdjoint) };
    }
    const main = P.adjoints.filter(k => ADJOINTS[k]);
    const melange = l => { const m = [...l]; for (let i = m.length - 1; i > 0; i--) { const k = Math.floor(clic() * (i + 1)); [m[i], m[k]] = [m[k], m[i]]; } return m; };
    const voulu = (clic ? melange(main) : [...main].sort((a, b) => rangDe(a, P.cle) - rangDe(b, P.cle))).slice(0, ADJOINTS_MAX);
    const avant = staffDe(P);
    if (voulu.length !== avant.length || voulu.some(k => !avant.includes(k))) out.push({ jour: j, staff: voulu });
  }
  // LE TALENT (niveaux 2 et 4) : le pouvoir qui a le plus joué grandit ; le distrait, au hasard ; le robot d'avant, le premier.
  const perso = persoDe(you);
  if (perso && talentsDus(niveauDuPerso(perso), perso.talents) > 0) {
    const ouverts = pouvoirsOuverts(niveauDuPerso(perso)), fois = foisDesPouvoirs(L, you);
    const p = clic ? auHasard(ouverts) : politique === 'defaut' ? ouverts[0] : ouverts.reduce((a, b) => (fois[b] >= fois[a] ? b : a));
    out.push({ jour: j, palier: `ta:${perso.talents.length}`, talent: { p } });
  }
  return out;
}

/*
 * L'ENTRAÎNEUR DU DÉPART D'UNE RUN : le même loto de trois vraies cartes que le jeu (js/coachs-reels.js) ; l'attentif
 * prend celle de la couleur de son effectif, sinon la plus grande maîtrise ; le distrait n'importe laquelle ; le robot
 * d'avant la première. Rend la carte.
 */
export function coachDuRobot(loto, { politique, clic, couleur }) {
  if (clic) return loto[Math.floor(clic() * loto.length)];
  if (politique === 'attentif') return loto.find(c => c.cle === couleur) || loto.reduce((a, b) => (b.maitrise > a.maitrise ? b : a));
  return loto[0];
}
