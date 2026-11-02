/*
 * CE QUE LES ROBOTS FONT DU COACH-PERSONNAGE (V21, docs/refonte-v21.md ; V22, js/adjoints.js). Le coach d'une run a ses
 * pouvoirs et sa main d'adjoints ; le robot, comme le gérant, choisit ses talents, ses adjoints, les poste et répond aux
 * histoires. Selon la politique (scripts/lib/rogue_sim.mjs) :
 *   - l'attentif lit : le talent va au pouvoir qui a le plus joué ; l'adjoint offert, celui dont le style rend le plus
 *     à SON effectif, lu au moteur (`fit`, scripts/lib/rogue_sim.mjs `fitDAdjoint` ; 31 oct. 2026), sinon celui de la
 *     voie de son coach ; dès qu'une case est libre, il poste la carte prête qui rend le plus ; à une histoire, la
 *     réponse qui rend le plus, en conséquences concrètes (l'expérience, un adjoint, des jetons, des jambes) ;
 *   - le distrait clique au hasard, sur son propre générateur ;
 *   - le robot d'avant ('defaut') prend la première option de chaque écran : un gérant grossier, qui garde un coach.
 * Le robot ne voit que ce que l'écran montre : les feuilles jouées, la cédule de la semaine, ses jambes, sa caisse.
 */
import { dosADos, energieDe, SLOTS, rivalChoisi, getPlayerKey } from '../../js/sim.js';
import { DOSSIERS, dossierDeLaSemaine, semaineAHistoire, faitsDeLaCourse, FENETRE_JOUEUR, PUNITIONS_CHICANE } from '../../js/dossiers.js';
import { PALIERS_PACK, SEMAINE } from '../../js/inventaire.js';
import { joueurDuFait } from '../../js/vie-gm.js';
import { COACHS } from '../../js/coachs.js';
import { POUVOIRS, niveauDuPerso, talentsDus, pouvoirsOuverts, TALENT_CASE } from '../../js/pouvoirs.js';
import { ADJOINTS, adjointsOfferts, pretesDe, casesLibres, niveauOffert, momentFort } from '../../js/adjoints.js';

/* MESURE seulement (jamais lu par le jeu) : ROBOT_TALENT=case ou pouvoir force le premier talent de l'attentif (scripts/mesure_main.mjs). */
const TALENT_FORCE = process.env.ROBOT_TALENT || null;

const JETON = 0.01;   // une victoire vaut une centaine de jetons, à la louche (le barème : 5 par victoire, les packs à 12 et plus)
/* Ce que vaut une conséquence, grossièrement, en victoires : un adjoint, un point d'expérience, des jambes, un match d'infirmerie. */
const VAUT = { adjoint: 0.5, xp: 0.05, jambes: 0.02, absent: 0.15, soin: 0.1 };

/* L'attentif préfère l'adjoint de la voie de son coach (la synergie : un séjour plus long), sinon le premier offert. */
const rangDe = (k, coach = null) => (coach && ADJOINTS[k] && ADJOINTS[k].voie === coach ? -1 : Object.keys(ADJOINTS).indexOf(k));
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
  const classes = [...L.teams].sort((a, b) => (b.PTS || 0) - (a.PTS || 0)), rang = classes.indexOf(you) + 1;
  const monSoir = j => (L.calendrier[j] || []).find(m => m.A === you || m.B === you);
  const habilles = new Set(SLOTS.filter(sl => !sl.scratch).map(sl => you.roster[sl.i]).filter(Boolean));
  const porte = sorte => { const x = joueurDuFait(sorte, miens.slice(-FENETRE_JOUEUR).map(({ f, cote }) => ({ f, cote })), habilles); return x ? { n: x.p.n, cle: getPlayerKey(x.p), fait: x.fait } : null; };
  let defaites = 0;
  for (let i = miens.length - 1; i >= 0; i--) { const { m } = miens[i], c = m.A === you; if ((c ? m.gfA : m.gfB) < (c ? m.gfB : m.gfA)) defaites++; else break; }
  const perso = persoDe(you), C = perso && COACHS[perso.cle];
  // Les faits d'un joueur (js/saison.js `faitsDesJoueurs`) : celui qui va au cachot, le gros contrat muet, lus dans SES feuilles.
  const lus = SLOTS.filter(s => !s.scratch && s.group !== 'G').map(s => you.roster[s.i]).filter(Boolean).map(p => {
    const siens = miens.filter(({ f, cote }) => (f.alignes?.[cote] || []).includes(p)).slice(-FENETRE_JOUEUR);
    const compte = (champ, ok) => siens.reduce((a, { f, cote }) => a + (f[champ] || []).filter(x => x.cote === cote && ok(x)).length, 0);
    return { p, m: siens.length, pts: compte('buts', b => b.marqueur === p || (b.passeurs || []).includes(p)), pun: compte('punitions', x => x.joueur === p) };
  });
  const qui = x => ({ n: x.p.n, cle: getPlayerKey(x.p), m: x.m });
  const puni = lus.filter(x => x.pun >= PUNITIONS_CHICANE).sort((a, b) => b.pun / b.m - a.pun / a.m)[0];
  const muet = [...lus].sort((a, b) => (b.p.$ || 0) - (a.p.$ || 0)).slice(0, 3).filter(x => x.m >= FENETRE_JOUEUR - 2 && x.pts <= 1).sort((a, b) => a.pts - b.pts || (b.p.$ || 0) - (a.p.$ || 0))[0];
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
    ...faitsDeLaCourse(classes.map(t => t.PTS || 0), rang),
    dosRoute: jours.filter(j => dosADos(you, j) && monSoir(j).B === you && monSoir(j - 1) && monSoir(j - 1).B === you).length,
    coach: C ? { cle: perso.cle, nom: C.nom, ico: C.ico, niveau: niveauDuPerso(perso) } : null,
    puni: puni ? { ...qui(puni), pun: puni.pun } : null,
    muet: muet ? { ...qui(muet), sal: '', pts: muet.pts } : null,
  };
}

/* L'ADJOINT D'UN MOMENT FORT (js/saison.js `adjointsDuMoment`) : un parmi trois, tirés de la graine. Rend la décision. */
function adjointDuRobot({ you, graine, cle, politique, clic, fit }) {
  const perso = persoDe(you);
  const offre = perso ? adjointsOfferts(perso, graine, cle, 3) : [];
  if (!offre.length) return null;
  // V23 : chaque carte a son niveau, tiré comme à l'écran (`niveauOffert`).
  const niv = k => niveauOffert(graine, cle, k, momentFort(cle));
  // L'attentif lit le style sur SON effectif, à son niveau (`fit`, scripts/lib/rogue_sim.mjs) ; sans lecture, la voie de son coach d'abord.
  const k = clic ? offre[Math.floor(clic() * offre.length)] : politique === 'defaut' ? offre[0]
    : fit ? offre.reduce((a, b) => (fit(b, niv(b)) > fit(a, niv(a)) ? b : a)) : offre.reduce((a, b) => (rangDe(b, perso.cle) < rangDe(a, perso.cle) ? b : a));
  return { embauche: { cle: k, niv: niv(k) } };
}
/*
 * La valeur d'une réponse d'histoire, en conséquences concrètes, pour l'attentif. `lu` (nov. 2026, scripts/lib/rogue_sim.mjs
 * `lireLeJoueur`) : le joueur nommé lu sur son club — ce qui va à lui, un dé à la moyenne de ses deux issues, ses matchs
 * d'absence, les soirs de l'auxiliaire. Sans lecture (`ROBOT_SAUF=histoires`), la valeur d'avant : un dé ne valait rien.
 */
function valeurDeReponse(o, lu = null) {
  let v = (o.gain || 0) * JETON + (o.xp || 0) * VAUT.xp + (o.adjoint ? VAUT.adjoint : 0) + (o.soin || 0) * VAUT.soin;
  if (o.action) v += (o.action.energieTous || 0) * VAUT.jambes + (o.action.energie || 0) * VAUT.jambes / 4
    + (lu ? lu.absent(o.action.absents || 0) + lu.auxiliaire(o.action.gardienAux || 0) : -(o.action.absents || 0) * VAUT.absent);
  if (lu && o.lui) v += lu.surLui(o.lui, o.duree);
  if (lu && o.pari) v += o.pari.chance * lu.surLui(o.pari.gagne.lui, o.pari.gagne.duree) + (1 - o.pari.chance) * lu.surLui(o.pari.perd.lui, o.pari.perd.duree);
  return v;
}

/*
 * LE LUNDI DU ROBOT : l'histoire de la semaine (un lundi tiré de la graine, V20), l'adjoint d'un palier (quand le
 * compte de matchs le franchit), celui d'un gros match gagné, le talent quand le niveau le donne, et les cartes qu'il
 * poste. Rend les décisions
 * à pousser au jour de la ligue. `etat` : ce que la saison retient (les dossiers ouverts, les paliers et les butins pris).
 */
export function lundiDuRobot({ L, you, graine, politique, clic, jetons, etat, fit = null, lire = null }) {
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
      const D = DOSSIERS[cle], lui = D.joueur ? D.joueur(f) : null;
      etat.dossiers.push({ cle, w, joueur: lui ? lui.cle : null });
      const perso = persoDe(you);
      const possibles = D.options.filter(o => !(o.gain < 0 && f.caisse < -o.gain));
      // L'attentif lit le joueur nommé sur son club (`lire.joueur`), une fois pour toutes les réponses.
      const lu = !clic && politique !== 'defaut' && lui && lire && lire.joueur ? lire.joueur(lui.cle) : null;
      const o = clic ? auHasard(possibles) : politique === 'defaut' ? possibles[0] : possibles.reduce((b, x) => (valeurDeReponse(x, lu) > valeurDeReponse(b, lu) ? x : b));
      const offert = o.adjoint && perso ? adjointsOfferts(perso, graine, `do:${w}`, 1)[0] || null : null;
      out.push({ jour: j, palier: `do:${w}`, moment: { famille: 'dossier', cle, choix: o.cle, ...(lui ? { joueur: lui.cle, joueurs: [lui.cle] } : {}) },
        ...(o.gain ? { gain: o.gain } : {}), ...(o.xp ? { xpCoach: o.xp } : {}),
        ...(offert ? { embauche: { cle: offert, niv: niveauOffert(graine, `do:${w}`, offert) } } : {}),
        ...(o.soin && lui ? { gestes: { soin: o.soin, joueurs: [lui.cle] } } : {}) });
    }
  }
  // LE PALIER (`PALIERS_PACK`, js/inventaire.js) : un adjoint parmi trois.
  const pp = PALIERS_PACK.find(x => f.n >= x && !etat.paliers.has(x));
  if (pp !== undefined) {
    etat.paliers.add(pp);
    const d = adjointDuRobot({ you, graine, cle: `pp${pp}`, politique, clic, fit });
    if (d) out.push({ jour: j, palier: `pp:${pp}`, ...d });
  }
  // LE BUTIN D'UN GROS MATCH GAGNÉ : un adjoint parmi trois (js/saison.js `recompenseOuverte`).
  for (const mb of (you.minisBoss || []).filter(x => x.gagne && !etat.butins.has(x.jour))) {
    etat.butins.add(mb.jour);
    const d = adjointDuRobot({ you, graine, cle: `r${mb.jour}`, politique, clic, fit });
    if (d) out.push({ jour: j, palier: `r:${mb.jour}`, ...d });
  }
  // POSTER (V22) : une case libre et une carte prête, l'attentif la poste (celle de sa voie d'abord), le distrait une au hasard ;
  // le robot d'avant ne poste rien. Une décision `poste` par case libre, le jour même ; une carte qui entre aujourd'hui attend lundi.
  const P0 = persoDe(you);
  if (P0 && politique !== 'defaut') {
    const games = you.games || 0;
    let libres = casesLibres(P0, games, niveauDuPerso(P0));
    // Celle qui rend le plus à son effectif d'abord (`fit`) ; sans lecture, la voie de son coach.
    const nivs = new Map(pretesDe(P0, games).map(c => [c.cle, c.niv]));
    const pretes = pretesDe(P0, games).map(c => c.cle).sort((a, b) => (fit ? fit(b, nivs.get(b)) - fit(a, nivs.get(a)) : rangDe(a, P0.cle) - rangDe(b, P0.cle)));
    while (libres > 0 && pretes.length) { const k = clic ? pretes.splice(Math.floor(clic() * pretes.length), 1)[0] : pretes.shift(); out.push({ jour: j, poste: { cle: k } }); libres--; }
  }
  // LE TALENT (niveaux 2 et 4) : le pouvoir qui a le plus joué grandit ; le distrait, au hasard ; le robot d'avant, le premier.
  // Au premier (nov. 2026), la case d'adjoint de plus et sa carte sont l'autre réponse (`TALENT_CASE`, la carte tirée comme à
  // l'écran) : l'attentif la prend quand son pouvoir I a joué moins d'un match sur deux (grandi, il rendrait peu), le distrait
  // au hasard, le robot d'avant jamais (le pouvoir est la première réponse).
  // Nov. 2026 (`lire.talent`, scripts/lib/rogue_sim.mjs `valeurDuTalent`) : l'attentif lit ce que chaque pouvoir grandi
  // rend à son club, en victoires par saison, contre la case (`lire.case`) ; sans lecture (`ROBOT_SAUF=talent`), la règle d'avant.
  const perso = persoDe(you);
  if (perso && talentsDus(niveauDuPerso(perso), perso.talents) > 0) {
    const ouverts = pouvoirsOuverts(niveauDuPerso(perso)), fois = foisDesPouvoirs(L, you), premier = !perso.talents.length;
    const soirs = new Set(feuillesDe(L, you).filter(({ f, cote }) => (f.pouvoirs || []).some(x => x.cote === cote && x.p === 0 && !x.contagion)).map(x => x.m)).size;
    const reponses = premier ? [...ouverts, TALENT_CASE] : ouverts;
    const forcee = premier && TALENT_FORCE && politique === 'attentif' ? (TALENT_FORCE === 'case' ? TALENT_CASE : 0) : null;
    const lus = !clic && politique !== 'defaut' && lire && lire.talent ? new Map(ouverts.map(q => [q, lire.talent(perso, q)])) : null;
    const meilleur = lus ? ouverts.reduce((a, b) => (lus.get(b) > lus.get(a) ? b : a)) : null;
    const p = forcee !== null ? forcee : clic ? auHasard(reponses) : politique === 'defaut' ? ouverts[0]
      : lus ? (premier && lire.case > lus.get(meilleur) ? TALENT_CASE : meilleur)
      : premier && soirs * 2 < Math.max(1, you.games || 0) ? TALENT_CASE : ouverts.reduce((a, b) => (fois[b] >= fois[a] ? b : a));
    const offert = p === TALENT_CASE ? adjointsOfferts(perso, graine, 'ta0', 1)[0] || null : null;
    out.push({ jour: j, palier: `ta:${perso.talents.length}`, talent: { p }, ...(offert ? { embauche: { cle: offert, niv: niveauOffert(graine, 'ta0', offert) } } : {}) });
  }
  return out;
}

/*
 * L'ENTRAÎNEUR DU DÉPART D'UNE RUN : le même loto de trois vraies cartes que le jeu (js/coachs-reels.js) ; l'attentif
 * prend celle que ses pouvoirs rendent le plus à son effectif (`fit`, scripts/lib/rogue_sim.mjs `fitDeCoach` ; la
 * couleur de l'effectif, essayée, lui coûtait 1,6 V par saison) ; le distrait n'importe laquelle ; le robot d'avant la
 * première. Rend la carte.
 */
export function coachDuRobot(loto, { politique, clic, fit }) {
  if (clic) return loto[Math.floor(clic() * loto.length)];
  if (politique === 'attentif' && fit) { const f = loto.map(fit); return loto[f.indexOf(Math.max(...f))]; }
  return loto[0];
}
