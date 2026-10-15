/*
 * CE QUI A FAIT LE MATCH (oct.). JP : *ya moyen de savoir quand le proc d'un bonus sur carte a fait la
 * différence* ; *tout ce qui a influencé le jeu. Le joueur doit comprendre ce qui se passe et avoir un impact.*
 *
 * Le moteur nomme, lancer par lancer, les causes qui ont DÉCIDÉ de son dé (`causesDuLancer`, js/sim.js) : retirée
 * seule, la cause aurait changé le lancer — un but qui n'entrait pas, un arrêt qui ne se faisait pas. Ici, on
 * les compte et on les dit, du point de vue de ton club. Pur (aucun DOM) : la même feuille donne les mêmes mots.
 * Rien n'est estimé : chaque chiffre se recompte dans `f.lancers`.
 */
import { MUTATIONS, TACTIQUES, SYSTEMES_D, periodeDe } from './sim.js';
import { nomCourt, tempsRestant } from './recit.js';
import { ord, ordF, pct3 } from './util.js';

const nomDe = p => (p && p.n ? nomCourt(p.n) : 'un joueur');
const plur = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
function uniteDe(u) {
  if (!u) return 'une ligne';
  const sys = u.tac && (u.d ? SYSTEMES_D : TACTIQUES)[u.tac];
  const ligne = u.d ? `la ${ordF(u.rang + 1)} paire` : `le ${ord(u.rang + 1)} trio`;
  return sys && u.tac !== 'hourra' ? `${ligne} (${sys.nom})` : ligne;
}
/* Les modifs d'un joueur qui touchent ce canal, par leur nom : une carte posée, une amélioration, un accident de saison. */
function modifsDe(p, ch, accident = false) {
  const cles = [...((p && p._mutCles) || []), ...((p && p._si) || []).map(e => e.cle)];
  const noms = [...new Set(cles.filter(k => MUTATIONS[k] && MUTATIONS[k][ch] && (MUTATIONS[k].source === 'accident') === accident).map(k => `« ${MUTATIONS[k].nom} »`))];
  return noms.length ? noms.join(' et ') : accident ? 'un accident' : 'sa carte';
}
/* Le sujet d'une cause : ce que le joueur reconnaît à l'écran. */
const SUJET = {
  carte: c => `${modifsDe(c.qui, c.ch)} (${nomDe(c.qui)})`,
  accident: c => `${modifsDe(c.qui, c.ch, true)} (${nomDe(c.qui)})`,
  monte: c => `le badge monté de ${nomDe(c.qui)}`,
  cartesClub: () => 'les cartes et les décisions du club',
  carteClub: c => `${c.qui.ico ? `${c.qui.ico} ` : ''}« ${c.qui.nom} »`,
  plafond: () => 'le plafond de finition du jeu',
  plafondG: c => `le plafond du gardien (${nomDe(c.qui)})`,
  fantome: c => `le fantôme ${nomDe(c.qui)}`,
  ombre: () => 'la chasse à la vedette',
  ligne: c => `le système et la chimie : ${uniteDe(c.qui)}`,
  special: c => `l'action spéciale : ${uniteDe(c.qui)}`,
  systemeDef: c => `le système en défense : ${uniteDe(c.qui)}`,
  power: () => 'le power forward devant le filet',
  badges: c => `les badges qui étouffent : ${uniteDe(c.qui)}`,
  badgeG: c => `le badge de ${nomDe(c.qui)}`,
  jambes: c => `les jambes de ${nomDe(c.qui)}`,
  // Le gardien et la défense se jugent contre la moyenne de la ligue : le sujet le dit.
  gardien: c => (c.qui ? `${nomDe(c.qui)} au filet (${pct3(c.qui.sv)}, ${c.f > 1 ? 'sous' : 'au-dessus de'} la moyenne)` : 'un filet sans vrai gardien'),
  defense: c => `les défenseurs sur la glace (${c.f > 1 ? 'sous' : 'au-dessus de'} la moyenne)`,
  creation: () => 'le jeu des coéquipiers',
  trait: c => `les traits de ${nomDe(c.qui)}`,
  traitsClub: () => 'les traits du club',
  traitG: c => `les traits de ${nomDe(c.qui)}`,
  lancee: c => `la lancée de ${nomDe(c.qui)}`,
  elan: () => "l'élan du match",
  situation: c => `la situation de ${nomDe(c.qui)}`,
  arc: c => `l'histoire de ${nomDe(c.qui)}`,
  robustesse: () => 'la robustesse',
  chance: () => 'la chance du soir',
};
/* Les groupes que TU règles, dans l'ordre où l'écran les dit. */
const GROUPES_A_TOI = [['cartes', 'tes cartes'], ['systemes', 'tes systèmes'], ['badges', 'tes badges'], ['gardien', 'ton gardien'], ['jambes', 'les jambes']];

/* Ce qu'une cause a fait, vue de son club : elle l'a aidé ou lui a nui, sur un but ou sur un arrêt. */
function effet(c, attaque) {
  if (attaque) return c.d === 'but' ? { aide: true, mot: 'but' } : { aide: false, mot: 'rate' };
  return c.d === 'arret' ? { aide: true, mot: 'arret' } : { aide: false, mot: 'passe' };
}
/* Le verbe s'accorde au sujet : « les jambes de Getzlaf ont coûté ». */
const MOTS = {
  but: (n, pl) => `${pl ? 'ont' : 'a'} fait entrer ${plur(n, 'but')}`,
  arret: (n, pl) => `${pl ? 'ont' : 'a'} empêché ${plur(n, 'but')}`,
  rate: (n, pl) => `${pl ? 'ont' : 'a'} fait rater ${plur(n, 'but')}`,
  passe: (n, pl) => `${pl ? 'ont' : 'a'} laissé passer ${plur(n, 'but')}`,
};
const pluriel = sujet => /^les /.test(sujet);
const phrase = (sujet, mot, n) => `${sujet} ${MOTS[mot](n, pluriel(sujet))}`;
/* « X, Y et Z ». */
const enListe = xs => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`);
const PERIODE_COURTE = ['1re', '2e', '3e', 'Prol.'];
/* Un tir que tes causes ont changé, dit à ton club : quand, qui, ce qui est arrivé, et ce qui l'a décidé. */
function phraseDuTir(t) {
  const qui = t.tireur, par = enListe(t.sujets);
  const quoi = t.attaque
    ? (t.but ? `Ton but (${qui}) : il entre grâce à ${par}` : `Tir de ${qui} arrêté, à cause de ${par}`)
    : (t.but ? `But de ${qui} contre toi : il entre à cause de ${par}` : `Tir de ${qui} arrêté grâce à ${par}`);
  return `${t.quand} · ${quoi}`;
}
const cleDe = c => `${c.k}|${c.qui && c.qui.n ? c.qui.n : c.qui && c.qui.nom ? c.qui.nom : c.qui && c.qui.rang != null ? `${c.qui.d ? 'D' : 'F'}${c.qui.rang}` : ''}`;

/**
 * Les causes d'un match, pour le club `moi` ('A' ou 'B') : { pour[], contre[], sans[] }.
 * `pour` et `contre` : { texte, n, poids } — ce qui l'a aidé, ce qui lui a nui, les plus lourds d'abord ;
 * `sans` : pour chaque groupe à toi qui a décidé d'un lancer, le pointage sans lui et s'il change le résultat ;
 * `tirs` : chaque tir que tes causes ont changé, dans l'ordre du match, avec ce qui l'a décidé — un tir, une ligne :
 * deux causes du même tir ne s'additionnent pas. La chance seule ne fait pas une ligne : elle n'est à personne.
 */
export function causesDuMatch(f, moi) {
  const lancers = (f && f.lancers) || [];
  if (!lancers.some(l => l.causes)) return null;
  const tas = new Map();
  for (const l of lancers) {
    if (!l.causes) continue;
    for (const c of l.causes.liste) {
      if (c.c !== moi || !SUJET[c.k]) continue;
      const e = effet(c, l.cote === c.c);
      const k = `${cleDe(c)}|${e.mot}`;
      const x = tas.get(k) || { c, e, n: 0 };
      x.n++;
      tas.set(k, x);
    }
  }
  const lignes = [...tas.entries()].map(([cle, x]) => { const sujet = SUJET[x.c.k](x.c); return { cle, sujet, mot: x.e.mot, aide: x.e.aide, n: x.n, texte: phrase(sujet, x.e.mot, x.n) }; })
    .sort((a, b) => b.n - a.n);
  const tirs = [];
  for (const l of lancers) {
    const mes = l.causes ? l.causes.liste.filter(c => c.c === moi && SUJET[c.k]) : [];
    if (!mes.some(c => c.k !== 'chance')) continue;
    // Tes causes d'un même lancer vont toutes du même bord : le dé est tombé entre la chance avec et sans chacune.
    const t = { instant: l.instant, quand: `${PERIODE_COURTE[Math.min(4, periodeDe(l.instant)) - 1]} ${tempsRestant(l.instant)}`, attaque: l.cote === moi, but: !!l.but, tireur: nomDe(l.tireur), sujets: [...new Set(mes.map(c => SUJET[c.k](c)))] };
    t.aide = t.attaque === t.but;
    t.texte = phraseDuTir(t);
    tirs.push(t);
  }
  tirs.sort((a, b) => a.instant - b.instant);
  const gf = { A: f.gfA ?? 0, B: f.gfB ?? 0 };
  const eux = moi === 'A' ? 'B' : 'A';
  const sans = [];
  for (const [g, mot] of GROUPES_A_TOI) {
    const d = { A: 0, B: 0 };
    let n = 0;
    for (const l of lancers) {
      if (!l.causes || !l.causes.groupes.some(x => x.c === moi && x.g === g)) continue;
      n++;
      d[l.cote] += l.but ? -1 : 1;
    }
    if (!n) continue;
    const apres = { A: gf.A + d.A, B: gf.B + d.B };
    const res = x => Math.sign(x[moi] - x[eux]);
    sans.push({ groupe: g, mot, n, moi: apres[moi], eux: apres[eux], change: res(apres) !== res(gf), ecart: (gf[moi] - gf[eux]) - (apres[moi] - apres[eux]) });
  }
  return { pour: lignes.filter(x => x.aide), contre: lignes.filter(x => !x.aide), sans, tirs };
}

/** La cause la plus lourde d'un but, dite au marqueur : « la carte de Nieuwendyk », ou null. */
export function causeDuBut(but) {
  const liste = but && but.causes && but.causes.liste;
  if (!liste || !liste.length) return null;
  // Celles du club qui marque d'abord (ce qu'il a fait), puis ce que l'autre a laissé passer.
  const tri = liste.filter(c => SUJET[c.k] && c.k !== 'chance').sort((a, b) => (b.c === but.cote) - (a.c === but.cote) || Math.abs(Math.log(b.f)) - Math.abs(Math.log(a.f)));
  const c = tri[0];
  if (!c) return null;
  const sujet = SUJET[c.k](c), pl = pluriel(sujet) ? 'ont' : 'a';
  return c.c === but.cote ? `${sujet} l'${pl} fait entrer` : `${sujet} l'${pl} laissé passer`;
}

/**
 * TA SAISON, CE QUI L'A FAITE : chaque groupe à toi, l'écart de buts qu'il a fait sur tes matchs joués et les résultats
 * qu'il a fait tourner ; puis les causes qui ont le plus souvent décidé pour toi, et contre toi. Les matchs de `club`
 * seulement, ceux qui portent leurs causes ; null s'il n'y en a aucun.
 */
export function causesDeSaison(calendrier, club) {
  const groupes = GROUPES_A_TOI.map(([g, mot]) => ({ g, mot, ecart: 0, tournes: 0, perdus: 0 }));
  const tas = new Map();
  let n = 0;
  for (const m of (calendrier || []).flat()) {
    if (!m || !m.joue || !m.feuille || (m.A !== club && m.B !== club)) continue;
    const r = causesDuMatch(m.feuille, m.A === club ? 'A' : 'B');
    if (!r) continue;
    n++;
    for (const x of r.sans) {
      const G = groupes.find(y => y.g === x.groupe);
      G.ecart += x.ecart;
      if (x.change) { if (x.ecart > 0) G.tournes++; else G.perdus++; }
    }
    for (const x of [...r.pour, ...r.contre]) {
      const y = tas.get(x.cle) || { ...x, n: 0 };
      y.n += x.n;
      tas.set(x.cle, y);
    }
  }
  if (!n) return null;
  const lignes = [...tas.values()].map(x => ({ aide: x.aide, n: x.n, texte: phrase(x.sujet, x.mot, x.n) })).sort((a, b) => b.n - a.n);
  return { n, groupes: groupes.filter(x => x.ecart || x.tournes || x.perdus), pour: lignes.filter(x => x.aide), contre: lignes.filter(x => !x.aide) };
}
