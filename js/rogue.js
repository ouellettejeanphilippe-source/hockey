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
 * Il garde aussi ce que la run lit pour se bâtir : les bouche-trous du départ, les jetons, ce que la règle du coach lit
 * dans une feuille, les éditions des adversaires (`habillerLaLigue`).
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
/* La règle du coach paie au plus `PRIME_COACH_MAX` jetons par run (js/coachs.js `REGLES_DU_COACH`, js/run.js `conclure`). */
export const PRIME_COACH_MAX = 50;
/* Les jetons d'une run : la caisse de départ, la même pour tous, et ce qu'un match perdu laisse (une victoire paie selon le club, js/run.js `RUN`). */
export const JETONS = { depart: 40, prolongation: 4, defaite: 2 };

/*
 * LES BOUCHE-TROUS DU DÉPART (JP, 18 oct. : *défenseurs trop forts sur nouvelle run, ça devrait être plus bas*). Les
 * défenseurs et les gardiens se tirent par leur VALEUR, les attaquants par leurs points ; dans chaque saison tirée, la
 * même bande pour tous (du 40e au 60e centile, `BANDE_DEPART`), et dans la bande, les pires contrats (le tiers le mieux
 * payé : le plafond qui mord).
 *   saisons   les joueurs de chaque saison tirée ; groupe(p) : 'F', 'D' ou 'G' ; valeur(p) : la valeur cachée
 *             (js/sim.js) ; personne(p) : la personne (une par alignement) ; exclus : les personnes déjà prises ;
 *   piger(liste, cle)   en rend un
 */
const BOUCHES_TROUS = { F: { par: 'points', n: 3 }, D: { par: 'valeur', n: 2 }, G: { par: 'valeur', n: 1 } };
const PART_DES_PIRES = 1 / 3;
/* R1 (8 nov. 2026) : 0,35-0,55 la faisait partir au 28e (la borne) et l'acte I tuait l'attentif 18 fois sur 64. */
const BANDE_DEPART = [0.40, 0.60];
const pointsParMatch = p => ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1);
export function bouchesTrousDuDepart(saisons, { groupe, valeur, personne, piger, exclus = new Set(), reserve = null }) {
  const out = [], pris = new Set(exclus);
  const [bas, haut] = BANDE_DEPART;
  const pires = t => t.slice().sort((a, b) => (b.$ || 0) - (a.$ || 0) || (personne(a) < personne(b) ? -1 : 1)).slice(0, Math.max(1, Math.ceil(t.length * PART_DES_PIRES)));
  saisons.forEach((joueurs, i) => {
    for (const g of ['F', 'D', 'G']) {
      const B = BOUCHES_TROUS[g], cle = B.par === 'points' ? pointsParMatch : valeur;
      const reg = joueurs.filter(p => groupe(p) === g && (p.gp || 0) >= (g === 'G' ? 10 : 30) && !pris.has(personne(p))).sort((a, b) => cle(a) - cle(b));
      const bande = reg.slice(Math.floor(reg.length * bas), Math.max(1, Math.floor(reg.length * haut)));
      // `reserve` : toute la bande, pour alourdir ou alléger le départ (js/run.js `effectifDeDepart`).
      if (reserve) reserve.push(...bande);
      const tranche = pires(bande);
      for (let k = 0; k < B.n && tranche.length; k++) {
        const p = piger(tranche, `${i}${g}${k}`);
        if (!p) break;
        out.push(p); pris.add(personne(p)); tranche.splice(tranche.indexOf(p), 1);
      }
    }
  });
  return out;
}

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
export const ecussonsDesSeries = (rondes, coupe) => (rondes || 0) * 20 + (coupe ? 40 : 0);
/*
 * PAYER, UNE FOIS : la clé d'une run et son étape ne paient qu'une fois (`recompenses`). `bilan` (la fin d'une run en
 * carte, étape `run`) écrit le palmarès : { pts, ronde, coupe, series, exigence } — la Coupe comptée, le cran suivant
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
    m.jalons = { ...(m.jalons || {}), ...(bilan.series ? { series: true } : {}), ...(bilan.ronde >= 1 ? { ronde: true } : {}), ...(bilan.ronde >= 2 ? { finale: true } : {}) };
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
 * chaque cran ajoute sa règle à celles d'avant, par un levier de la run en carte (js/run.js `creerLaRun`, `reglesDe`), et ses
 * médailles sont multipliées par 1 + `PRIME_EXIGENCE` par cran. La Coupe gagnée au plus haut cran ouvert ouvre le suivant.
 * Seuls deux leviers COÛTENT, mesurés un à un (11 nov. 2026, le robot qui lit, 64 graines) : la cible (+1 : 52 % de cibles
 * tenues contre 58) et la force des clubs (une étape d'édition de plus : 55 %). Moins d'espace, des adversaires plus hauts,
 * une porte de moins, un rachat plus dur ne coûtent rien aujourd'hui : un cran qui ne coûte pas serait une prime gratuite.
 * Trois crans, mesurés ensemble sur 128 graines (`CRANS=1`, scripts/mesure_run.mjs) : 59 % de cibles tenues sans exigence,
 * puis 51 %, 46 % et 33 % ; 61, 64, 65 et 58 médailles par run, la prime comprise : monter ne paie pas plus, ça se mérite.
 * Un quatrième (une étape de plus) n'ajoutait rien de mesurable.
 * Les huit crans de l'ancien Rogue (le prix des packs, le classeur, le barème, les contrôles) sont partis avec lui.
 */
export const PRIME_EXIGENCE = 0.15;
export const EXIGENCES = [
  { cle: 'barre', nom: 'La barre monte', texte: 'un point de plus à tenir par acte', court: 'Cible +1', cible: 1 },
  { cle: 'clubs', nom: 'Des clubs plus forts', texte: 'une étape d\'édition de plus à chaque adversaire', court: 'Clubs +1', etapes: 1 },
  { cle: 'barre2', nom: 'La barre monte encore', texte: 'deux points de plus à tenir par acte', court: 'Cible +2', cible: 1 },
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
 * meilleurs d'abord — le canal de tes cartes, leurs badges. La run en carte habille l'adversaire du soir selon son acte
 * (js/run.js `ETAPES`, `reglesDe`) ; le 82-0 déshabille sa ligue (étape 0).
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
