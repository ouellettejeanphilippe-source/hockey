/**
 * LE MÉTA DU ROGUE — ce qui reste d'une run à l'autre (S77 ; réécrit à la V28, tranche 5, docs/refonte-v28-5.md).
 *
 * JP : *mode rogue like, que tu pars avec des joueurs de marde et gagne des cartes/unlock avec packs, monnaie, etc?* ;
 * 7 nov. 2026 : le prestige et la méta, *variété seulement*. La run elle-même vit ailleurs (js/run.js, js/run-scenes.js,
 * js/run-jeu.js). Ici, un seul état, `cap82_rogue`, hors du moteur :
 *
 *   - LES MÉDAILLES 🏅 : gagnées à la fin d'une run, payées une seule fois (`payerEcussons`) ; celles qu'on a, et celles
 *     gagnées à vie (`ecussonsAVie`), qui ne baissent jamais ;
 *   - LA VARIÉTÉ : ce que les médailles ouvrent — des philosophies de coach au loto du départ (`voiesOuvertes`,
 *     `ouvrirUneVoie`), jamais de la force. Ton club (son nom, ses couleurs) s'achète dans js/club.js ;
 *   - LE PRESTIGE : un titre, par médailles à vie et par exploit (`PRESTIGES`, `rangDePrestige`) ;
 *   - LES EXIGENCES 🔺 : après une Coupe, des crans qui durcissent la run et paient plus (`EXIGENCES`, `cranOuvert`) ;
 *   - LE SOLDE, deux fois une : l'ancien Rogue arrêté (`solderLAncienRogue`, tranche 4), ses déblocages remboursés
 *     (`solderLesDeblocages`, tranche 5).
 *
 * Il garde aussi ce que la run lit pour se bâtir : les jetons du départ, ce que la règle du coach lit dans une
 * feuille, les éditions des adversaires (`habillerLaLigue`).
 */
import { retirerLesRuns } from './sauvegardes.js';
import { VOIES } from './coachs.js';
import { EDITIONS } from './rarete.js';

const CLE_META = 'cap82_rogue';

/*
 * LES CHIFFRES D'UN SOIR, de ton côté, lus dans sa feuille (V23) : ce que la règle du coach lit. Les tirs de barrage ne
 * comptent pas pour un buteur. Le but gagnant : celui qui met ton club un but devant le compte final de l'adversaire.
 */
export function chiffresDuSoirDe(f, cote) {
  const autre = cote === 'A' ? 'B' : 'A';
  const buts = (f.buts || []).filter(b => !b.fusillade);
  const miens = buts.filter(b => b.cote === cote), contre = buts.length - miens.length;
  const pts = new Map();
  for (const b of miens) for (const p of [b.marqueur, ...(b.passeurs || [])]) if (p) pts.set(p, (pts.get(p) || 0) + 1);
  const gagnant = miens.length > contre ? miens[contre] : null;
  return {
    tirs: (f.tirs[cote] || []).reduce((a, x) => a + x, 0), tirsContre: (f.tirs[autre] || []).reduce((a, x) => a + x, 0),
    buts: miens.length, buteurs: new Set(miens.map(b => b.marqueur).filter(Boolean)).size, pointsMax: Math.max(0, ...pts.values()),
    coups: (f.coups && f.coups[cote]) || 0, punitions: (f.punitions || []).filter(p => p.cote === cote).length,
    butGagnantTard: !!gagnant && gagnant.instant >= 40,
  };
}
/* Les jetons d'une run : la caisse de départ, la même pour tous (ce qu'un match paie : js/run.js `RUN`). */
export const JETONS = { depart: 40 };

/* ---------- l'état ---------- */
/*
 * `ecussons` : les médailles qu'on a ; `ecussonsAVie` : celles gagnées à vie ; `voies` : les philosophies achetées ;
 * `nouvelle` : celle qu'on vient d'ouvrir, qui a sa case au prochain loto ; `club` : ton club (js/club.js) ; `runs`,
 * `coupes`, `meilleur`, `jalons` : le palmarès ; `exigence` : le plus haut cran gagné ; `cran` : le dernier joué ;
 * `recompenses` : ce qui est déjà payé ; `solde`, `arret` : les deux soldes de l'ancien Rogue. Un méta d'avant porte
 * d'autres clés (ses déblocages, son inventaire) : le solde les lit une fois, puis plus rien.
 */
const META_VIDE = () => ({ ecussons: 0, voies: [], runs: 0, coupes: 0, meilleur: null, recompenses: {}, jalons: {}, exigence: 0 });
export function lireMeta() {
  try { return { ...META_VIDE(), ...(JSON.parse(localStorage.getItem(CLE_META) || 'null') || {}) }; } catch { return META_VIDE(); }
}
export function ecrireMeta(m) { try { localStorage.setItem(CLE_META, JSON.stringify(m)); } catch { /* le stockage plein : la run continue */ } }

/* ---------- le prestige ---------- */
/*
 * LE PRESTIGE DU CLUB, UN TITRE (JP, 7 nov. 2026 : *variété seulement*). Il monte avec les médailles gagnées À VIE (jamais
 * celles qu'on dépense) ET un exploit à chaque rang, que la fin d'une run écrit (`jalons`) : jouer les séries, gagner une
 * ronde, jouer la finale. Il n'ouvre rien au jeu ; il s'écrit au Club et au Palmarès, et quelques écussons et couleurs le
 * demandent (js/club.js `rang`). Les multiples de taux des packs, le budget du classeur et les coachs par rang sont partis.
 */
export const PRESTIGES = [
  { nom: 'Club de garage', min: 0, texte: 'Personne ne te connaît encore.' },
  { nom: 'Club de quartier', min: 120, texte: 'On commence à parler de toi au dépanneur.' },
  { nom: 'Club respecté', min: 350, jalon: 'series', exploit: 'jouer les séries', texte: 'Les agents rappellent.' },
  { nom: 'Puissance de la ligue', min: 700, jalon: 'ronde', exploit: 'gagner une ronde', texte: 'Les joueurs autonomes regardent ton club en premier.' },
  { nom: 'Dynastie', min: 1200, jalon: 'finale', exploit: 'jouer la finale', texte: 'Tout le monde veut jouer pour toi.' },
];
/* Les médailles gagnées à vie : le compte, ou, pour un méta d'avant ce compte, ce qu'on a plus ce qu'on avait dépensé. */
export const ecussonsAVie = m => (m.ecussonsAVie != null ? m.ecussonsAVie : (m.ecussons || 0) + (m.deblocages || []).reduce((a, k) => a + (PRIX_D_AVANT[k] || 0), 0));
/* Le rang d'un méta : les rangs se gagnent dans l'ordre, chacun ses médailles à vie ET son exploit. */
export function rangDePrestige(m) {
  const e = ecussonsAVie(m);
  let r = 0;
  while (r + 1 < PRESTIGES.length && e >= PRESTIGES[r + 1].min && (!PRESTIGES[r + 1].jalon || (m.jalons || {})[PRESTIGES[r + 1].jalon])) r++;
  return r;
}

/* ---------- la variété ---------- */
/*
 * LES PHILOSOPHIES (docs/refonte-v28-5.md § 3.2). Trois sont ouvertes au départ, cinq s'ouvrent en médailles, au prix de
 * leur rang d'ouverture (la première coûte 40, quelle qu'elle soit). Une philosophie ouverte met ses entraîneurs au loto
 * du départ, rien de plus : les trente-six pièces de banc sont aux offres dès la première run (ouvrir des pièces avec
 * elle montait la part des pièces du plus haut cadre dans les offres, de 39 à 54 % : de la force, pas de la variété).
 */
const VOIES_DE_DEPART = VOIES.slice(0, 3);
const PRIX_DES_VOIES = [40, 60, 80, 100, 120];
const achetees = m => (m.voies || []).filter(v => VOIES.includes(v) && !VOIES_DE_DEPART.includes(v));
export const voiesOuvertes = m => VOIES.filter(v => VOIES_DE_DEPART.includes(v) || achetees(m).includes(v));
/* Le prix de la prochaine philosophie, ou null quand tout est ouvert. */
export const prixDeLaVoie = m => PRIX_DES_VOIES[achetees(m).length] ?? null;
/* Ouvrir une philosophie : rend { ok, prix }, ou ce qui l'empêche ({ manque } : les médailles qu'il faut encore). */
export function ouvrirUneVoie(cle) {
  const m = lireMeta(), prix = prixDeLaVoie(m);
  if (!VOIES.includes(cle) || voiesOuvertes(m).includes(cle) || prix == null) return { ok: false };
  if ((m.ecussons || 0) < prix) return { ok: false, manque: prix - (m.ecussons || 0) };
  ecrireMeta({ ...m, ecussons: m.ecussons - prix, voies: [...achetees(m), cle], nouvelle: cle });
  return { ok: true, prix };
}

/* ---------- les médailles d'une run ---------- */
/* ---------- le contrôle ---------- */
/*
 * LE CONTRÔLE S'ACHÈTE (V33, docs/refonte-v33.md ; JP, 26 nov. 2026 : *la première saison, peu de chances de gagner ; ce sont
 * les ajustements permanents qui mènent éventuellement vers la Coupe, mais pas aisément*). La première run part pauvre et
 * sans prise : `RETENUE` de moins au repêchage, aucune relance, deux affiches par quart, trois joueurs tendus — et un proprio
 * plus patient (trois cœurs, cette run-là seulement). Chaque amélioration se prend marche par marche, en médailles, au Club.
 * Mesuré sur 32 saisons du bâtisseur : la première run fait les séries six fois sur dix ; tout acheté, 129 points et le
 * 2e rang, mais la Coupe reste rare (JP : *viser moins haut*).
 */
const RETENUE = 20_000_000;
export const AMELIORATIONS = {
  budget: { nom: 'Le budget du repêchage', dit: 'Ton repêchage retrouve 5 M$ de budget.', prix: [40, 60, 80, 100] },
  relances: { nom: 'Les relances', dit: 'Une relance de plus au repêchage : un autre vestiaire, le même tour. La sixième marche : une relance gratuite des joueurs tendus à chaque quart.', prix: [15, 20, 25, 30, 40, 60] },
  affiche: { nom: 'La troisième affiche', dit: 'Une affiche de plus à poser à chaque quart.', prix: [60] },
  offert: { nom: 'Un quatrième joueur', dit: 'Après un gros match gagné, quatre joueurs tendus au lieu de trois.', prix: [80] },
  verrou: { nom: 'Verrouiller des cartes', dit: 'Une carte de ton cartable de plus, choisie à l\'Album, imposée à coup sûr.', prix: [30, 45, 60] },
  coach: { nom: 'Choisir ton entraîneur', dit: 'Un entraîneur de plus au tirage du départ : tu choisis lequel.', prix: [40, 60] },
  piece: { nom: 'Une pièce de départ au choix', dit: 'Au départ, une des deux pièces de banc se choisit parmi trois.', prix: [50] },
  retirage: { nom: 'Refaire le tirage', dit: 'Une fois par run, avant ton premier tour : ton club imposé se tire de nouveau.', prix: [50] },
  voir: { nom: 'Voir d\'avance', dit: 'À la feuille du soir, le meilleur joueur que ce club te tendrait s\'il tombe.', prix: [40] },
};
export const marcheDeLAmelioration = (m, k) => Math.min(AMELIORATIONS[k].prix.length, Math.max(0, (m.ameliorations || {})[k] || 0));
/* Le prix de sa prochaine marche, ou null quand elle est au bout. */
export const prixDeLAmelioration = (m, k) => AMELIORATIONS[k].prix[marcheDeLAmelioration(m, k)] ?? null;
export function acheterUneAmelioration(k) {
  const m = lireMeta(), prix = AMELIORATIONS[k] ? prixDeLAmelioration(m, k) : null;
  if (prix == null) return { ok: false };
  if ((m.ecussons || 0) < prix) return { ok: false, manque: prix - (m.ecussons || 0) };
  // Achetée, elle s'active d'elle-même s'il reste une case.
  const actives = activesDe(m);
  ecrireMeta({ ...m, ecussons: m.ecussons - prix, ameliorations: { ...(m.ameliorations || {}), [k]: marcheDeLAmelioration(m, k) + 1 }, actives: actives.includes(k) || actives.length >= casesDe(m) ? actives : [...actives, k] });
  return { ok: true, prix };
}
/*
 * LES CASES (JP, 26 nov. 2026 : *comme des skill trees, comme le Witcher 3, avec un max d'upgrades en même temps*) : ce que
 * tu achètes reste à toi, mais une run n'en porte que quelques-unes, celles que tu actives au Club. Les cases s'ouvrent avec
 * tes runs jouées (`CASES` : deux d'abord, six à la douzième). Le budget du repêchage prend sa case comme les autres.
 */
const CASES = [0, 0, 2, 4, 7, 11];              // la run jouée qui ouvre chaque case : deux d'office, puis aux runs 3, 5, 8 et 12
export const casesDe = m => CASES.filter(n => (m.runs || 0) >= n).length;
/* La prochaine case : dans combien de runs, ou null quand elles sont toutes ouvertes. */
export const prochaineCase = m => { const n = CASES.find(x => x > (m.runs || 0)); return n == null ? null : n - (m.runs || 0); };
export const activesDe = m => [...new Set(m.actives || [])].filter(k => AMELIORATIONS[k] && marcheDeLAmelioration(m, k) > 0).slice(0, casesDe(m));
/* Activer ou retirer : rend { ok }, ou { plein } quand il n'y a plus de case. */
/* Les cartes verrouillées à l'Album (des clés du cartable), autant que la marche achetée ; la run les impose d'abord. */
export const verrousDe = m => (m.verrous || []).slice(0, marcheDeLAmelioration(m, 'verrou'));
export function verrouillerUneCarte(k) {
  const m = lireMeta(), v = verrousDe(m);
  if (!k) return { ok: false };
  if (!v.includes(k) && v.length >= marcheDeLAmelioration(m, 'verrou')) return { ok: false, plein: true };
  ecrireMeta({ ...m, verrous: v.includes(k) ? v.filter(x => x !== k) : [...v, k] });
  return { ok: true };
}
export function activerUneAmelioration(k) {
  const m = lireMeta(), actives = activesDe(m);
  if (!AMELIORATIONS[k] || !marcheDeLAmelioration(m, k)) return { ok: false };
  if (!actives.includes(k) && actives.length >= casesDe(m)) return { ok: false, plein: true };
  ecrireMeta({ ...m, actives: actives.includes(k) ? actives.filter(x => x !== k) : [...actives, k] });
  return { ok: true };
}
/* Ce que la prochaine run reçoit (`controleDe`, js/run.js). */
export const controleDuMeta = m => {
  const n = k => (activesDe(m).includes(k) ? marcheDeLAmelioration(m, k) : 0);
  return {
    relances: Math.min(5, n('relances')), relanceOfferte: n('relances') > 5, affiches: 2 + n('affiche'), offerts: 3 + n('offert'),
    retenue: RETENUE * (1 - n('budget') / AMELIORATIONS.budget.prix.length), coeurs: (m.runs || 0) > 0 ? 2 : 3,
    verrous: verrousDe(m).slice(0, n('verrou')), coachs: 1 + n('coach'), piece: n('piece') > 0, retirage: n('retirage') > 0, voir: n('voir') > 0,
  };
};

export const ecussonsDesSeries = (rondes, coupe) => (rondes || 0) * 20 + (coupe ? 40 : 0);
/*
 * PAYER, UNE FOIS : la clé d'une run et son étape ne paient qu'une fois (`recompenses`). `bilan` (la fin d'une run en
 * saison, étape `run`) écrit le palmarès : { pts, ronde, coupe, series, finale, exigence } — la Coupe comptée, le cran suivant
 * ouvert par une Coupe gagnée à son cran, les exploits du prestige (les séries jouées, une ronde gagnée, la finale jouée).
 */
export function payerEcussons(cleRun, etape, n, { bilan = null } = {}) {
  const m = lireMeta(), k = `${cleRun}:${etape}`;
  if (m.recompenses[k]) return 0;
  m.recompenses[k] = true;
  const gain = Math.max(0, Math.round(n));
  m.ecussonsAVie = ecussonsAVie(m) + gain;
  m.ecussons = (m.ecussons || 0) + gain;
  if (bilan) {
    if (bilan.coupe) { m.coupes = (m.coupes || 0) + 1; m.exigence = Math.max(m.exigence || 0, Math.min(EXIGENCES.length, bilan.exigence || 0)); }
    m.jalons = { ...(m.jalons || {}), ...(bilan.series ? { series: true } : {}), ...(bilan.ronde >= 1 ? { ronde: true } : {}), ...((bilan.finale ?? bilan.ronde >= 2) ? { finale: true } : {}) };
    if (!m.meilleur || (bilan.ronde || 0) > (m.meilleur.ronde || 0) || ((bilan.ronde || 0) === (m.meilleur.ronde || 0) && (bilan.pts || 0) > (m.meilleur.pts || 0))) m.meilleur = { pts: bilan.pts || 0, ronde: bilan.ronde || 0, coupe: !!bilan.coupe };
  }
  // Les vieilles runs payées s'oublient : la liste ne doit pas grossir sans fin.
  const cles = Object.keys(m.recompenses);
  if (cles.length > 200) for (const x of cles.slice(0, cles.length - 200)) delete m.recompenses[x];
  ecrireMeta(m);
  return gain;
}

/*
 * LES EXIGENCES 🔺 (V28, tranche 5, docs/refonte-v28-5.md § 3.4). Après ta première Coupe, une run peut se lancer à un cran :
 * chaque cran ajoute sa règle à celles d'avant, par un levier de la run (js/run.js `creerLaRun`, `reglesDe`), et ses
 * médailles sont multipliées par 1 + `PRIME_EXIGENCE` par cran. La Coupe gagnée au plus haut cran ouvert ouvre le suivant.
 * Les deux leviers sont ceux qui coûtaient à la V28, mesurés un à un sur la run en carte (11 nov. 2026 : la cible, la force
 * des clubs ; moins d'espace, une porte de moins, un rachat plus dur ne coûtaient rien) : un cran qui ne coûte pas serait
 * une prime gratuite. À LA V30, la cible est devenue l'objectif de points du proprio, à chaque quart. Traduit tel quel
 * (un point de plus par quart), le cran 1 ne coûtait plus rien : un bâtisseur tient ses points avec huit à dix d'avance,
 * et un bilan n'est manqué qu'à deux objectifs sur trois. Mesuré sur 128 saisons du bâtisseur (17 nov. 2026, `CRANS=1`,
 * scripts/mesure_run.mjs), les points de plus par quart au cran 1 : +1, moins de 0,05 cœur perdu de plus par run ; +2,
 * 0,04 ; +3, 0,08 ; +5, 0,13 ; +7, 0,33. JP tranche : cinq au cran 1, dix au cran 3 (le sommet). L'échelle, cran par cran :
 * 0,30 cœur perdu par run sans exigence (congédié 9 fois sur 128), puis 0,43 (12 fois), 0,59 (21 fois) et 0,98 (39 fois,
 * dans les séries 70 % au lieu de 91) ; 109, 123, 120 et 120 médailles par run, la prime comprise : monter ne paie pas
 * plus, ça se mérite.
 * Les huit crans de l'ancien Rogue (le prix des packs, le classeur, le barème, les contrôles) sont partis avec lui.
 */
export const PRIME_EXIGENCE = 0.15;
export const EXIGENCES = [
  { cle: 'barre', nom: 'La barre monte', texte: 'cinq points de plus demandés par le proprio à chaque quart', court: 'Points +5', cible: 5 },
  { cle: 'clubs', nom: 'Des clubs plus forts', texte: 'une étape d\'édition de plus à chaque adversaire', court: 'Clubs +1', etapes: 1 },
  { cle: 'barre2', nom: 'La barre monte encore', texte: 'dix points de plus demandés par le proprio à chaque quart', court: 'Points +10', cible: 5 },
];
/* Ce que `n` crans exigent ensemble : chaque levier additionné, et le multiple des médailles. */
export function exigencesDe(n = 0) {
  const k = Math.max(0, Math.min(EXIGENCES.length, Math.floor(n || 0)));
  const out = { n: k, cible: 0, etapes: 0, medailles: 1 + PRIME_EXIGENCE * k };
  for (const E of EXIGENCES.slice(0, k)) { out.cible += E.cible || 0; out.etapes += E.etapes || 0; }
  return out;
}
/* Le plus haut cran qu'un méta peut prendre : aucun avant sa première Coupe, puis un de plus que le plus haut gagné. */
export const cranOuvert = m => ((m.coupes || 0) > 0 ? Math.min(EXIGENCES.length, (m.exigence || 0) + 1) : 0);

/* ---------- l'ancien Rogue, soldé ---------- */
/*
 * UN MÉTA D'AVANT LA V27 (docs/refonte-v27.md § 6) : ses runs d'alors versent la moitié de leurs points, lus dans leur
 * résumé (« … · 31-20-4 »), une fois (`jeu`). Rend { meta, verse }, ou null s'il est déjà converti.
 */
const JEU_DE_CARTES = 'v21', JEU_DE_LA_RUN = 'v27';
const pointsDuResume = r => { const x = /(\d+)-(\d+)-(\d+)/.exec((r && r.etape) || ''); return x ? 2 * Number(x[1]) + Number(x[3]) : 0; };
export const convertirAuJeuNeuf = (m, resumes = []) => {
  if (m.jeu === JEU_DE_LA_RUN) return null;
  const { personnel: _p, copiesPerso: _c, ...reste } = m;
  void _p; void _c;
  const base = m.jeu === JEU_DE_CARTES ? m : { ...reste, inventaire: {}, cartes: [] };
  const verse = resumes.reduce((a, r) => a + Math.floor(pointsDuResume(r) / 2), 0);
  return { meta: { ...base, ecussons: (base.ecussons || 0) + verse, ecussonsAVie: ecussonsAVie(base) + verse, jeu: JEU_DE_LA_RUN }, verse };
};
/*
 * L'ANCIEN ROGUE, ARRÊTÉ (V28, tranche 4 ; JP, 9 nov. 2026 : *les runs en cours perdues, les médailles et le cartable
 * gardés*). Au démarrage, et quand un fichier d'avant s'importe, chaque partie du genre `rogue` quitte l'index
 * (js/sauvegardes.js `retirerLesRuns`) et verse ce qu'elle avait gagné sans l'avoir touché :
 *   - une run d'avant la saison en actes : la moitié de ses points (`convertirAuJeuNeuf`) ;
 *   - une run en actes (V27) : ses rondes de séries, au multiple de son cran d'alors, sous la même clé que le jeu d'avant
 *     (des séries déjà payées ne se paient pas deux fois), sa Coupe et ses exploits au palmarès.
 * Le méta garde ce qui s'est arrêté (`arret`), pour l'écran du solde. Rend { runs, verse }.
 */
export function solderLAncienRogue() {
  const runs = retirerLesRuns(), converti = convertirAuJeuNeuf(lireMeta(), runs.map(r => r.resume));
  let verse = 0;
  if (converti) { ecrireMeta(converti.meta); verse = converti.verse; } else {
    for (const { sauvegarde: S } of runs) {
      const P = S && S.partie, R = (S && S.rogue) || {};
      if (!P || !P.graine) continue;
      const finies = R.series || null, rondes = finies ? finies.rondes : P.series ? P.series.ronde || 0 : 0, coupe = !!(finies && finies.coupe);
      const gain = payerEcussons(P.graine, 'series', ecussonsDesSeries(rondes, coupe) * (1 + PRIME_EXIGENCE * Math.max(0, Math.min(8, R.exigence || 0))));
      verse += gain;
      // Ce que ces séries pas encore payées avaient gagné au palmarès : la Coupe, et les exploits du prestige (quatre rondes alors).
      if (gain) { const m = lireMeta(); ecrireMeta({ ...m, coupes: (m.coupes || 0) + (coupe ? 1 : 0), jalons: { ...(m.jalons || {}), series: true, ronde: true, ...(rondes >= 3 ? { finale: true } : {}) } }); }
    }
  }
  if (runs.length) { const m = lireMeta(); ecrireMeta({ ...m, arret: { runs: (m.arret ? m.arret.runs : 0) + runs.length, verse: (m.arret ? m.arret.verse : 0) + verse } }); }
  return { runs: runs.length, verse };
}
/*
 * LES DÉBLOCAGES D'AVANT, REMBOURSÉS (V28, tranche 5, docs/refonte-v28-5.md § 3.5 ; le devis § 6 : *le prix des déblocages
 * qui partent*). Ce que les médailles achetaient rendait la run plus facile (la caisse, le plafond, les joueurs gardés, le
 * classeur, les packs qui montent) : tout part. Une fois (`solde`) : chaque déblocage acheté est remboursé à son prix
 * d'alors (`PRIX_D_AVANT`, figé) ; les médailles à vie ne bougent pas (elles comptaient déjà ces achats) ; les philosophies
 * que le rang de prestige ouvrait sont données ; le plus haut cran retombe à zéro (une Coupe d'avant garde le droit au
 * cran 1) ; l'inventaire de cartes rares s'efface. Rend le solde ({ avant, rendu, familles, voies }), ou null s'il est fait.
 */
const PRIX_D_AVANT = {
  garder1: 40, garder2: 120, garder3: 240, caisse1: 30, caisse2: 100, commanditaire1: 60, commanditaire2: 150, packDefenseurs: 35, packGardiens: 50, packAnnees80: 60,
  packVedettes: 150, plombiersPlus: 80, plafond1: 45, plafond2: 110, classeur1: 50, classeur2: 130, classeur3: 240, classeur4: 280, classeurTri: 90, banc1: 60, banc2: 150,
  monte_bronze_1: 60, monte_bronze_2: 115, monte_argent_1: 75, monte_argent_2: 150, monte_or_1: 105, monte_or_2: 210, monte_epoque_1: 80, monte_epoque_2: 165,
  monte_specialistes_1: 85, monte_specialistes_2: 170, monte_club_1: 85, monte_club_2: 170, monte_coach_1: 90, monte_coach_2: 180, monte_vedettes_1: 170, monte_vedettes_2: 340,
};
const FAMILLES_D_AVANT = [['garder', 'Les joueurs gardés'], ['caisse', 'La caisse de départ'], ['commanditaire', 'Les commanditaires'], ['pack', 'Les packs de spécialistes'],
  ['plombiers', 'Les bouche-trous moins pires'], ['plafond', 'Le plafond indexé'], ['classeur', 'Les pages du classeur'], ['banc', 'Les cases de réserve'], ['monte_', 'Les packs qui montent']];
/* Les philosophies que chaque rang de prestige ouvrait dans l'ancien Rogue. */
const COACHS_D_AVANT = [3, 4, 5, 6, 8];
export function solderLesDeblocages() {
  const m = lireMeta();
  if (m.solde) return null;
  const achats = (m.deblocages || []).filter(k => PRIX_D_AVANT[k]), prix = l => l.reduce((a, k) => a + PRIX_D_AVANT[k], 0);
  const familles = FAMILLES_D_AVANT.map(([prefixe, nom]) => ({ nom, cles: achats.filter(k => k.startsWith(prefixe)) })).filter(f => f.cles.length).map(f => ({ nom: f.nom, n: f.cles.length, prix: prix(f.cles) }));
  const voies = VOIES.slice(VOIES_DE_DEPART.length, COACHS_D_AVANT[rangDePrestige(m)]).filter(v => !achetees(m).includes(v));
  const { deblocages: _d, inventaire: _i, cartes: _c, recus: _r, ...reste } = m;
  void _d; void _i; void _c; void _r;
  const solde = { avant: m.ecussons || 0, rendu: prix(achats), familles, voies };
  ecrireMeta({ ...reste, ecussonsAVie: ecussonsAVie(m), ecussons: (m.ecussons || 0) + solde.rendu, voies: [...achetees(m), ...voies], exigence: 0, solde });
  return solde;
}

/* ---------- la ligue habillée ---------- */
/*
 * LES ÉDITIONS DES ADVERSAIRES (V9, tranche 8 ; JP, 17 oct. : *les clubs des premières runs sont globalement plus faibles
 * et montent*). Chaque étape monte d'une édition (Cadre, Hors-cadre, Or, Holo) un tiers de plus de chaque club, ses
 * meilleurs d'abord — le canal de tes cartes, leurs badges. La saison du Rogue habille l'adversaire du soir selon son quart
 * (js/run.js `RUN.ETAPES`, `reglesDe`) ; le 82-0 déshabille sa ligue (étape 0).
 */
/* L'édition d'un adversaire, au rang `r` de son club (0 : son meilleur) sur `n` : un tiers de plus du club par étape. */
function editionDansLaLigue(etape, r, n) {
  const tiers = r < n / 3 ? 2 : r < (2 * n) / 3 ? 1 : 0;
  return EDITIONS[Math.min(EDITIONS.length - 1, Math.floor(((etape || 0) + (etape ? tiers : 0)) / 3))];
}
/* Habiller des clubs à une étape : `valeur(p)` classe chaque club, son meilleur d'abord. */
export function habillerLaLigue(adversaires, etape, valeur) {
  for (const t of adversaires || []) {
    const js = Object.values((t && t.roster) || {}).filter(Boolean).sort((a, b) => valeur(b) - valeur(a));
    js.forEach((p, r) => { const e = editionDansLaLigue(etape, r, js.length); if (e === 'commune') delete p._carte; else p._carte = { rar: e }; });
  }
}
