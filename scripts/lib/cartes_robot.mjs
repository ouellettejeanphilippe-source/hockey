/*
 * CE QUE LES ROBOTS FONT DU COACH-PERSONNAGE (V21, docs/refonte-v21.md). Le coach d'une run a ses pouvoirs ; le robot,
 * comme le gérant, choisit ses talents, ses bienfaits et ses réponses aux histoires. Selon la politique
 * (scripts/lib/rogue_sim.mjs) :
 *   - l'attentif lit : le talent va au pouvoir qui a le plus joué, le bienfait à celui qui joue le plus (« plus fort »
 *     d'abord, « plus tôt » à un pouvoir qui joue peu) ; à une histoire, la réponse qui rend le plus, en conséquences
 *     concrètes (l'expérience, un bienfait, des jetons, des jambes) ;
 *   - le distrait clique au hasard, sur son propre générateur ;
 *   - le robot d'avant ('defaut') prend la première option de chaque écran : un gérant grossier, qui garde un coach.
 * Le robot ne voit que ce que l'écran montre : les feuilles jouées, la cédule de la semaine, ses jambes, sa caisse.
 */
import { dosADos, energieDe, SLOTS, rivalChoisi, getPlayerKey } from '../../js/sim.js';
import { DOSSIERS, dossierDeLaSemaine, semaineAHistoire, FENETRE_JOUEUR } from '../../js/dossiers.js';
import { PALIERS_PACK, SEMAINE } from '../../js/inventaire.js';
import { joueurDuFait } from '../../js/vie-gm.js';
import { COACHS } from '../../js/coachs.js';
import { POUVOIRS, XP_SANS_BIENFAIT, bienfaitsOfferts, niveauDuPerso, talentsDus, pouvoirsOuverts } from '../../js/pouvoirs.js';

const JETON = 0.01;   // une victoire vaut une centaine de jetons, à la louche (le barème : 5 par victoire, les packs à 12 et plus)
/* Ce que vaut une conséquence, grossièrement, en victoires : un bienfait, un point d'expérience, des jambes, un match d'infirmerie. */
const VAUT = { bienfait: 1, xp: 0.05, jambes: 0.02, absent: 0.15, soin: 0.1 };

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
    coach: C ? { cle: perso.cle, nom: C.nom, ico: C.ico, niveau: niveauDuPerso(perso), bienfaits: (perso.bienfaits || []).length } : null,
  };
}

/*
 * LE BIENFAIT D'UN MOMENT FORT (js/saison.js `bienfaitsDuMoment`) : un parmi trois, tirés de la graine. L'attentif
 * pousse le pouvoir qui joue le plus (« plus fort »), avance celui qui joue peu (« plus tôt »), puis la contagion, les
 * séries, les jetons ; rien à offrir : l'expérience. Rend la décision.
 */
const PREFERE = { fort: 5, tot: 3, contagieux: 2.5, series: 2, payant: 1.5 };
function bienfaitDuRobot({ L, you, graine, cle, politique, clic }) {
  const perso = persoDe(you);
  const offre = bienfaitsOfferts(perso, graine, cle);
  if (!offre.length) return perso ? { xpCoach: XP_SANS_BIENFAIT } : null;
  if (clic) return { bienfait: offre[Math.floor(clic() * offre.length)] };
  if (politique === 'defaut') return { bienfait: offre[0] };
  const fois = foisDesPouvoirs(L, you), total = fois.reduce((a, b) => a + b, 0) || 1;
  const score = b => PREFERE[b.b] * (b.b === 'tot' ? 1 - fois[b.p] / total : 0.5 + fois[b.p] / total);
  return { bienfait: offre.reduce((a, b) => (score(b) > score(a) ? b : a)) };
}
/* La valeur d'une réponse d'histoire, en conséquences concrètes, pour l'attentif. */
function valeurDeReponse(o) {
  let v = (o.gain || 0) * JETON + (o.xp || 0) * VAUT.xp + (o.bienfait ? VAUT.bienfait : 0) - (o.perdBienfait ? VAUT.bienfait : 0) + (o.soin || 0) * VAUT.soin;
  if (o.action) v += (o.action.energieTous || 0) * VAUT.jambes - (o.action.absents || 0) * VAUT.absent + (o.action.energie || 0) * VAUT.jambes / 4;
  return v;
}

/*
 * LE LUNDI DU ROBOT : l'histoire de la semaine (un lundi tiré de la graine, V20), le bienfait d'un palier (quand le
 * compte de matchs le franchit), celui d'un gros match gagné, et le talent quand le niveau le donne. Rend les décisions
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
      const perso = persoDe(you), partant = perso && perso.bienfaits.length ? perso.bienfaits[perso.bienfaits.length - 1] : null;
      const possibles = D.options.filter(o => !(o.gain < 0 && f.caisse < -o.gain) && !(o.perdBienfait && !partant));
      const o = clic ? auHasard(possibles) : politique === 'defaut' ? possibles[0] : possibles.reduce((b, x) => (valeurDeReponse(x) > valeurDeReponse(b) ? x : b));
      const offert = o.bienfait && perso ? bienfaitsOfferts(perso, graine, `do:${w}`, 1)[0] || null : null;
      out.push({ jour: j, palier: `do:${w}`, moment: { famille: 'dossier', cle, choix: o.cle, ...(lui ? { joueur: lui.cle, joueurs: [lui.cle] } : {}) },
        ...(o.gain ? { gain: o.gain } : {}), ...(o.xp ? { xpCoach: o.xp } : {}),
        ...(o.bienfait ? (offert ? { bienfait: offert } : { xpCoach: XP_SANS_BIENFAIT }) : {}),
        ...(o.perdBienfait && partant ? { perdBienfait: partant } : {}),
        ...(o.soin && lui ? { gestes: { soin: o.soin, joueurs: [lui.cle] } } : {}) });
    }
  }
  // LE PALIER (9e, 18e, 26e matchs) : un bienfait parmi trois.
  const pp = PALIERS_PACK.find(x => f.n >= x && !etat.paliers.has(x));
  if (pp !== undefined) {
    etat.paliers.add(pp);
    const d = bienfaitDuRobot({ L, you, graine, cle: `pp${pp}`, politique, clic });
    if (d) out.push({ jour: j, palier: `pp:${pp}`, ...d });
  }
  // LE BUTIN D'UN GROS MATCH GAGNÉ : un bienfait parmi trois (js/saison.js `recompenseOuverte`).
  for (const mb of (you.minisBoss || []).filter(x => x.gagne && !etat.butins.has(x.jour))) {
    etat.butins.add(mb.jour);
    const d = bienfaitDuRobot({ L, you, graine, cle: `r${mb.jour}`, politique, clic });
    if (d) out.push({ jour: j, palier: `r:${mb.jour}`, ...d });
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
 * LE COACH DU DÉPART D'UNE RUN, parmi ceux que le prestige ouvre : l'attentif prend celui des rôles de son effectif
 * (`coachDesRoles`, la couleur de ses meilleurs), le distrait n'importe lequel, le robot d'avant le premier.
 */
export function coachDuRobot(ouverts, { politique, clic, couleur }) {
  if (clic) return ouverts[Math.floor(clic() * ouverts.length)];
  if (politique === 'attentif' && couleur && ouverts.includes(couleur)) return couleur;
  return ouverts.find(k => POUVOIRS[k]) || ouverts[0];
}
