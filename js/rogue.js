/**
 * LE MÉTA DU ROGUE (S77 ; V28, tranche 4 : la run en carte est le Rogue).
 *
 * JP : *mode rogue like, que tu pars avec des joueurs de marde et gagne des
 * cartes/unlock avec packs, monnaie, etc?* La run elle-même vit ailleurs : son cœur pur dans js/run.js, ses scènes
 * dans js/run-scenes.js, sa coquille dans js/run-jeu.js. Ce module garde ce qui la sert et ce qui reste d'une run à
 * l'autre :
 *
 *   - LE MÉTA (`cap82_rogue`) : les médailles 🏅 gagnées, payées une seule fois par étape (`payerEcussons`), le
 *     prestige du club (`PRESTIGES`, `rangDePrestige`, les coachs qu'il ouvre), les déblocages déjà achetés et leur
 *     table (`DEBLOCAGES` : leurs prix font les médailles à vie d'un vieux méta, la caisse ajoute aux jetons du départ) ;
 *   - LE DÉPART D'UNE RUN : les bouche-trous (`bouchesTrousDuDepart`), les jetons (`JETONS`, `jetonsDeDepart`), ce que
 *     la règle du coach lit dans une feuille (`chiffresDuSoirDe`, `PRIME_COACH_MAX`) ;
 *   - LA LIGUE HABILLÉE (`habillerLaLigue`) : les éditions des adversaires, selon le niveau ;
 *   - L'ANCIEN ROGUE, SOLDÉ (`solderLAncienRogue`) : une vieille run en cours est abandonnée, ses médailles gagnées
 *     et pas encore payées le sont, une fois.
 *
 * Le jour à jour, la boutique à ses nœuds, le classeur du départ, le barème et le Bureau sont partis avec l'ancien
 * Rogue (docs/refonte-v28.md § 8). Seul le méta est un état, et il ne touche pas au moteur.
 */
import { retirerLesRuns } from './sauvegardes.js';
import { VOIES } from './coachs.js';
import { EDITIONS } from './rarete.js';
import { PACKS_TOUS, BOUTIQUE } from './packs.js';
import { BANQUE } from './banque.js';

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
/*
 * LA PRIME DU COACH (V23, js/coachs.js `REGLES_DU_COACH`) : le soir où ton club joue le hockey de ton coach, il paie.
 * Jusqu'à la journée `j` (non comprise) : { total, parJour: Map(journée → { jetons, mot }) }. Plafonnée par saison
 * (`PRIME_COACH_MAX`) pour qu'une saison parfaite ne fasse pas la caisse.
 */
export const PRIME_COACH_MAX = 50;
/* Les jetons d'une run : la caisse de départ, et ce qu'un match perdu laisse (une victoire paie selon le club, js/run.js `RUN`). */
export const JETONS = { depart: 40, prolongation: 4, defaite: 2 };

/*
 * L'UPGRADE, EN MÉDAILLES : chaque pack de la boutique monte de deux crans au vestiaire, au même prix en jetons —
 * un joueur de plus à choisir, puis les taux du métal du dessus (js/packs.js `tierDuPack`). Un cran se prend quand
 * le pack est ouvert. `monteeDesPacks` : le cran de chaque pack, FIXÉ au départ de la run (`G.rogue.montee`).
 */
const cinq = x => Math.round(x / 5) * 5;
const CRANS_DE_PACK = [
  { mot: 'un joueur de plus', texte: P => `Le ${P.nom} tire un joueur de plus, au même prix.`, prix: P => cinq(30 + 2 * P.prix) },
  { mot: 'le métal du dessus', texte: P => `Le ${P.nom} tire aux taux du métal du dessus, au même prix.`, prix: P => cinq(2 * (30 + 2 * P.prix)) },
];
const cleDeCran = (pack, i) => `monte_${pack.slice(2)}_${i + 1}`;
/* ---------- les déblocages (le vestiaire) ---------- */
const DEBLOCAGES = {
  // 24 oct. (JP : *garder des joueurs de run en run devrait être fait dans une loto*) : chacun ouvre une case d'un niveau (`gardesDeLaDerniere`).
  garder1: { ico: '🤝', nom: 'Garder un Pilier', prix: 40, texte: 'Au début d\'une run, un loto de trois Piliers de ta dernière équipe : tu en gardes un.' },
  garder2: { ico: '🤝', nom: 'Garder un deuxième Pilier', prix: 120, requis: 'garder1', texte: 'Un deuxième loto Pilier, de ta dernière équipe.' },
  garder3: { ico: '🤝', nom: 'Garder une Étoile', prix: 240, requis: 'garder2', texte: 'Un loto ★ Étoile de plus, de ta dernière équipe.' },
  caisse1: { ico: '🪙', nom: 'Une caisse de départ', prix: 30, texte: '+20 jetons au début de chaque run.' },
  caisse2: { ico: '🪙', nom: 'Une grosse caisse', prix: 100, requis: 'caisse1', texte: '+20 jetons de plus au départ (+40 en tout).' },
  // S80 : le barème d'une run (`baremeRogue`) — 5 🪙 par victoire sans commanditaire.
  commanditaire1: { ico: '📺', nom: 'Un commanditaire', prix: 60, texte: '+3 🪙 par victoire : 8 au lieu de 5, à chaque saison de la run.' },
  commanditaire2: { ico: '📺', nom: 'Le commanditaire principal', prix: 150, requis: 'commanditaire1', texte: '+2 🪙 de plus par victoire : 10.' },
  packDefenseurs: { ico: '❄', nom: 'Les spécialistes défensifs', prix: 35, texte: 'Le Pack Spécialistes offre le rôle Défensif : les joueurs au meilleur différentiel de leur saison.' },
  packGardiens: { ico: '🥅', nom: 'Les spécialistes gardiens', prix: 50, texte: 'Le Pack Spécialistes offre le rôle Gardiens : les partants au meilleur pourcentage d\'arrêts.' },
  packAnnees80: { ico: '📼', nom: 'Les années 80', prix: 60, texte: 'Le Pack Époque offre les années 80, l\'époque des 400 buts par saison.' },
  packVedettes: { ico: '🌟', nom: 'Les vedettes des séries', prix: 150, texte: 'Une série gagnée donne un pack d\'un cran plus haut : l\'Or dès le premier tour, les Étoiles au deuxième, les Légendes en finale.' },
  plombiersPlus: { ico: '🛠', nom: 'Des bouche-trous moins pires', prix: 80, texte: 'Tes bouche-trous de départ sortent du bas de la ligue, pas du fond du baril.' },
  // S79 : la masse salariale se débloque aussi.
  plafond1: { ico: '💵', nom: 'Une masse salariale indexée', prix: 45, texte: '+3\u00a0M$ de plafond au début de chaque run.' },
  plafond2: { ico: '💰', nom: 'Le proprio dépense', prix: 110, requis: 'plafond1', texte: '+4\u00a0M$ de plus au début de chaque run (+7\u00a0M$ en tout).' },
  /*
   * S80 : LE DÉPART DU CLASSEUR. JP : *le classeur, on peut piger x cartes aux
   * départ, ou random, selon upgrades*. Puis, le 24 oct. : *garder des joueurs
   * de run en run devrait être fait dans une loto, pas genre tu peux prendre qui
   * tu veux* ; *choix d'un joueur Pilier, un Régulier, etc. Peut-être débloquer
   * les Piliers et plus*. Chaque page ouvre une case d'un niveau (`casesDuClasseur`),
   * le tri montre cinq cartes à chaque loto ; plus rien ne se prend au choix.
   */
  classeur1: { ico: '📒', nom: 'Une page Pilier', prix: 50, texte: 'Au départ d\'une run, une case Pilier de plus à ton classeur : un loto de tes Piliers, tu en gardes un. Entre deux saisons, un loto Pilier de plus.' },
  classeur2: { ico: '📒', nom: 'Une page Étoile', prix: 130, requis: 'classeur1', texte: 'Une case ★ Étoile au départ, et un loto Étoile de plus entre deux saisons.' },
  classeur3: { ico: '📒', nom: 'Une deuxième page Pilier', prix: 240, requis: 'classeur2', texte: 'Une deuxième case Pilier au départ, et un loto Pilier de plus entre deux saisons.' },
  classeur4: { ico: '📒', nom: 'Une deuxième page Étoile', prix: 280, requis: 'classeur2', texte: 'Une deuxième case ★ Étoile au départ, et un loto Étoile de plus entre deux saisons.' },
  classeurTri: { ico: '🔍', nom: 'Le tri du classeur', prix: 90, texte: 'Chaque loto du classeur montre cinq cartes au lieu de trois : au départ, entre deux saisons, et chez ceux qui restent.' },
  /*
   * S80 : LES CASES DE RÉSERVE DE PLUS. JP : *débloquer des slots de
   * remplacement*. Une case de réserviste qui prend n'importe qui : un joueur
   * signé y entre sans que personne sorte, et il monte quand un habillé se
   * blesse (js/sim.js `activeLineup`).
   */
  banc1: { ico: '🪑', nom: 'Une case de réserve de plus', prix: 60, texte: 'Quatre réservistes au lieu de trois : un joueur de plus sans que personne sorte.' },
  banc2: { ico: '🪑', nom: 'Deux cases de réserve de plus', prix: 150, requis: 'banc1', texte: 'Cinq réservistes.' },
};
// V10 : les crans de chaque pack de la boutique (`CRANS_DE_PACK`, plus bas), le second après le premier, quand le pack est ouvert.
for (const k of BOUTIQUE) {
  const P = PACKS_TOUS[k];
  CRANS_DE_PACK.forEach((C, i) => {
    DEBLOCAGES[cleDeCran(k, i)] = { ico: P.ico, nom: `${P.nom} : ${C.mot}`, prix: C.prix(P), pack: k, texte: C.texte(P), ...(i ? { requis: cleDeCran(k, i - 1) } : {}) };
  });
}

/*
 * LES BOUCHE-TROUS DU DÉPART (JP, 18 oct. : *défenseurs trop forts sur nouvelle run, ça devrait être plus bas*).
 * Mesuré sur 60 départs : tirés par leurs POINTS, comme les attaquants, les défenseurs sortaient au 35e rang de valeur
 * de leur saison, deux fois les attaquants (18e) — peu de points, c'est souvent un bon défenseur défensif. Les
 * défenseurs et les gardiens se tirent maintenant par leur VALEUR ; les attaquants, par leurs points. Dans chaque
 * saison tirée, la même bande pour tous (V27 : du 40e au 60e centile, `BANDE_DEPART` — l'équipe part vers le 26e rang
 * de force, docs/refonte-v27.md § 4.9 ; « Des plombiers moins pires » la monte de 20 centiles), et
 * dans la bande, les pires contrats (le tiers le mieux payé, V9 : le plafond qui mord).
 *   saisons   les joueurs de chaque saison tirée ; groupe(p) : 'F', 'D' ou 'G' ; valeur(p) : la valeur cachée
 *             (js/sim.js) ; personne(p) : la personne (une par alignement) ; exclus : les personnes déjà prises ;
 *   piger(liste, cle)   en rend un
 */
const BOUCHES_TROUS = { F: { par: 'points', n: 3 }, D: { par: 'valeur', n: 2 }, G: { par: 'valeur', n: 1 } };
const PART_DES_PIRES = 1 / 3;
/* R1 (8 nov. 2026) : 0,35-0,55 la faisait partir au 28e (la borne) et l'acte I tuait l'attentif 18 fois sur 64. */
const BANDE_DEPART = [0.40, 0.60];
const pointsParMatch = p => ((p.pt ?? ((p.g || 0) + (p.a || 0))) || 0) / Math.max(1, p.gp || 1);
export function bouchesTrousDuDepart(saisons, { groupe, valeur, personne, piger, plus = false, exclus = new Set(), reserve = null }) {
  const out = [], pris = new Set(exclus);
  const [bas, haut] = BANDE_DEPART.map(x => x + (plus ? 0.2 : 0));
  const pires = t => t.slice().sort((a, b) => (b.$ || 0) - (a.$ || 0) || (personne(a) < personne(b) ? -1 : 1)).slice(0, Math.max(1, Math.ceil(t.length * PART_DES_PIRES)));
  saisons.forEach((joueurs, i) => {
    for (const g of ['F', 'D', 'G']) {
      const B = BOUCHES_TROUS[g], cle = B.par === 'points' ? pointsParMatch : valeur;
      const reg = joueurs.filter(p => groupe(p) === g && (p.gp || 0) >= (g === 'G' ? 10 : 30) && !pris.has(personne(p))).sort((a, b) => cle(a) - cle(b));
      const bande = reg.slice(Math.floor(reg.length * bas), Math.max(1, Math.floor(reg.length * haut)));
      // `reserve` : toute la bande, pour `alourdirLaPremiere`.
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
/*
 * LE PRESTIGE DU CLUB (v2). JP : *favoriser que l'on peut avoir de plus en plus
 * de joueurs de qualité selon les runs, sans que ça soit gratuit en faisant une
 * saison, genre une progression logique*. Un club de garage n'attire pas les
 * vedettes : le prestige monte avec les écussons gagnés À VIE (jamais ceux
 * qu'on dépense) ET un exploit à chaque rang — faire les séries, gagner une
 * ronde, atteindre la finale (les jalons). Une bonne saison ne suffit pas :
 * il faut des runs, et il faut aller loin.
 *
 * Ce qu'il ouvre : les Étoiles et les Phénomènes des packs de joueurs
 * (`etoile`, `phenomene` multiplient leurs taux ; ce qu'on leur ajoute vient des
 * piliers, js/packs.js `niveauxDuPack`). V10 (JP : *sans empêcher un random
 * Crosby saison 1*) : aucun rang ne retire rien — le Club de garage tire aux taux
 * de base de ses packs, le prestige ajoute à partir du Club respecté —, et le budget du classeur
 * (`classeur`, en dollars de plus au départ d'une run). Le rang est FIXÉ au
 * départ de la run (`G.rogue.prestige`) : un rang gagné en cours de route
 * sert la run suivante, et une run reprise retrouve les mêmes packs.
 */
/*
 * V2.3 — LES COACHS AU PRESTIGE. JP : *au début, t'as genre 3 coachs seulement, pis ça augmente selon les runs*.
 * Chaque rang ouvre `coachs` coachs au choix du départ (les huit voies, dans l'ordre de `VOIES`). V21 : les postes de
 * patron et les patrons imposés sont partis avec le personnel.
 */
export const PRESTIGES = [
  { nom: 'Club de garage', min: 0, etoile: 1, phenomene: 1, classeur: 0, coachs: 3, texte: 'Personne ne te connaît encore.' },
  { nom: 'Club de quartier', min: 120, etoile: 1, phenomene: 1, classeur: 3_000_000, coachs: 4, texte: 'On commence à parler de toi au dépanneur.' },
  { nom: 'Club respecté', min: 350, jalon: 'series', etoile: 1.1, phenomene: 1.15, classeur: 6_000_000, coachs: 5, texte: 'Les agents rappellent.' },
  { nom: 'Puissance de la ligue', min: 700, jalon: 'ronde', etoile: 1.2, phenomene: 1.3, classeur: 10_000_000, coachs: 6, texte: 'Les joueurs autonomes regardent ton club en premier.' },
  { nom: 'Dynastie', min: 1200, jalon: 'finale', etoile: 1.3, phenomene: 1.5, classeur: 15_000_000, coachs: 8, texte: 'Tout le monde veut jouer pour toi.' },
];
/* Les coachs qu'une run de ce rang peut choisir. */
export const coachsOuverts = rang => VOIES.slice(0, (PRESTIGES[rang] || PRESTIGES[0]).coachs);
/* Les écussons gagnés à vie : le compte, ou — pour un méta d'avant la v2 — ce qu'on a, plus ce qu'on a dépensé au vestiaire. */
export const ecussonsAVie = m => (m.ecussonsAVie != null ? m.ecussonsAVie
  : (m.ecussons || 0) + (m.deblocages || []).reduce((a, k) => a + ((DEBLOCAGES[k] && DEBLOCAGES[k].prix) || 0), 0));
/* Le rang de prestige d'un méta : les rangs se gagnent dans l'ordre, chacun ses écussons à vie ET son jalon. */
export function rangDePrestige(m) {
  const e = ecussonsAVie(m);
  let r = 0;
  while (r + 1 < PRESTIGES.length && e >= PRESTIGES[r + 1].min && (!PRESTIGES[r + 1].jalon || (m.jalons || {})[PRESTIGES[r + 1].jalon])) r++;
  return r;
}

/* ---------- le méta ---------- */
/*
 * S79 : l'INVENTAIRE PERMANENT — `inventaire` (id → nombre de cartes rares permanentes), et `recus` (les achats déjà
 * versés au méta : une ouverture ne paie qu'une fois). V21 : le personnel est parti.
 */
/*
 * S80 : `runs` compte les runs COMMENCÉES (une run dure maintenant plusieurs
 * saisons), `saisons` les saisons jouées, `coupes` les Coupes ; `jalons` ceux
 * qui ont payé ; `sel`, tiré une fois, sème le tirage du classeur de chaque
 * run (le même tant que la run n'a pas commencé : recharger ne retire pas).
 */
/*
 * LA CONVERSION AU JEU NEUF (V10, tranche 6 — docs/refonte-v10.md § 7 ; JP : *reset toute*). Les sauvegardes rejouent
 * une saison avec les identifiants de ses cartes, et l'ancien jeu est parti : une run d'avant rejouerait un autre passé.
 * Une fois, au démarrage : les runs en cours repartent de zéro (js/sauvegardes.js `retirerLesRuns`) et l'inventaire de
 * cartes du méta se vide (l'inventaire, le personnel, les cartes). Le cartable des joueurs, les médailles, les
 * déblocages et le panthéon restent. Rend le méta converti, ou null s'il l'était déjà.
 */
/* V21 (docs/refonte-v21.md ; JP : *on s'en fout de briser les saves*) : le coach-personnage remplace le personnel ; les runs en cours repartent, une fois. */
/*
 * V27 (docs/refonte-v27.md § 6) : une run d'avant la saison en actes (ses saisons de plus, son mandat) ne se rejoue pas
 * sous les règles neuves. Elle est retirée au démarrage et verse ses médailles comme une saison finie : la moitié de ses
 * points, lus dans son résumé (« … · 31-20-4 »). `resumes` : ceux des runs retirées. Rend { meta, verse }, ou null.
 */
const JEU_DE_CARTES = 'v21', JEU_DE_LA_RUN = 'v27';
const pointsDuResume = r => { const x = /(\d+)-(\d+)-(\d+)/.exec((r && r.etape) || ''); return x ? 2 * Number(x[1]) + Number(x[3]) : 0; };
export const convertirAuJeuNeuf = (m, resumes = []) => {
  if (m.jeu === JEU_DE_LA_RUN) return null;
  const { personnel: _p, copiesPerso: _c, ...reste } = m;
  void _p; void _c;
  const base = m.jeu === JEU_DE_CARTES ? m : { ...reste, inventaire: {}, cartes: [] };
  const verse = resumes.reduce((a, r) => a + ecussonsDeLaSaison(pointsDuResume(r)), 0);
  return { meta: { ...base, ecussons: (base.ecussons || 0) + verse, ecussonsAVie: ecussonsAVie(base) + verse, jeu: JEU_DE_LA_RUN }, verse };
};
const META_VIDE = () => ({ ecussons: 0, deblocages: [], collection: [], cartes: [], runs: 0, saisons: 0, coupes: 0, meilleur: null, derniereEquipe: [], recompenses: {}, inventaire: {}, recus: {}, jalons: {}, sel: null });
/*
 * Un méta d'avant : un déblocage que le jeu ne connaît plus s'efface (V25 B1 : les remboursements des déblocages partis,
 * `PARTIS`, ont fait leur temps — écrits une fois au méta, ils n'avaient plus rien à rendre) ; une carte partie de la
 * banque (V16, tranche 6) rend encore `REMBOURSEMENT_CARTE` médailles, une fois.
 */
const REMBOURSEMENT_CARTE = 3;
function rembourserLesPartis(m) {
  const inconnus = (m.deblocages || []).filter(k => !DEBLOCAGES[k]);
  const cartes = Object.entries(m.inventaire || {}).filter(([id]) => !BANQUE[id]);
  if (!inconnus.length && !cartes.length) return m;
  return { ...m, deblocages: (m.deblocages || []).filter(k => DEBLOCAGES[k]), inventaire: Object.fromEntries(Object.entries(m.inventaire || {}).filter(([id]) => BANQUE[id])),
    ecussons: (m.ecussons || 0) + cartes.reduce((a, n) => a + (n[1] || 0), 0) * REMBOURSEMENT_CARTE };
}
export function lireMeta() {
  try { return rembourserLesPartis({ ...META_VIDE(), ...(JSON.parse(localStorage.getItem(CLE_META) || 'null') || {}) }); } catch { return META_VIDE(); }
}
export function ecrireMeta(m) { try { localStorage.setItem(CLE_META, JSON.stringify(m)); } catch { /* ignore */ } }
const aDebloque = (m, cle) => (m.deblocages || []).includes(cle);
export const jetonsDeDepart = m => JETONS.depart + (aDebloque(m, 'caisse1') ? 20 : 0) + (aDebloque(m, 'caisse2') ? 20 : 0);
export function payerEcussons(cleRun, etape, n, { equipe = null, bilan = null } = {}) {
  const m = lireMeta();
  const k = `${cleRun}:${etape}`;
  if (m.recompenses[k]) return 0;
  m.recompenses[k] = true;
  m.ecussonsAVie = ecussonsAVie(m) + Math.max(0, Math.round(n));
  m.ecussons = (m.ecussons || 0) + Math.max(0, Math.round(n));
  // S80 : une run dure plusieurs saisons — on compte les saisons ici, les runs à leur départ.
  if (etape === 'saison') m.saisons = (m.saisons || 0) + 1;
  if (etape === 'series' && bilan && bilan.coupe) m.coupes = (m.coupes || 0) + 1;
  // Les exigences (tranche 8) : la Coupe gagnée à un cran ouvre le suivant.
  if (etape === 'series' && bilan && bilan.coupe) m.exigence = Math.max(m.exigence || 0, bilan.exigence || 0);
  if (equipe) m.derniereEquipe = equipe;
  if (bilan && (!m.meilleur || (bilan.pts || 0) > (m.meilleur.pts || 0) || (bilan.ronde || 0) > (m.meilleur.ronde || 0))) m.meilleur = { ...(m.meilleur || {}), ...bilan };
  // Les vieilles runs payées s'oublient : la liste ne doit pas grossir sans fin.
  const cles = Object.keys(m.recompenses);
  if (cles.length > 200) for (const x of cles.slice(0, cles.length - 200)) delete m.recompenses[x];
  ecrireMeta(m);
  return Math.round(n);
}
const ecussonsDeLaSaison = pts => Math.floor((pts || 0) / 2);
/*
 * L'ANCIEN ROGUE, SOLDÉ (V28, tranche 4, docs/refonte-v28.md § 6 ; JP, 9 nov. 2026 : *les runs en cours perdues, les médailles
 * et le cartable gardés*). L'ancien Rogue est parti : une run en cours ne se rejoue pas. Au démarrage (et quand un fichier
 * d'avant s'importe), chaque partie du genre `rogue` est retirée de l'index (js/sauvegardes.js `retirerLesRuns`) et verse
 * ce qu'elle avait gagné sans l'avoir touché, lu dans sa sauvegarde seule :
 *   - une run d'avant la saison en actes (un méta d'avant la V27) : la moitié de ses points, comme une saison finie
 *     (`convertirAuJeuNeuf`) ;
 *   - une run en actes (V27) : ses actes et sa saison ont versé leurs médailles le soir même ; restent ses rondes de séries,
 *     payées d'un coup à la fin des séries. Finies, leur compte est écrit (`rogue.series`) ; en cours, ce sont les rondes
 *     d'avant celle qu'elle regardait (`partie.series.ronde`). La même clé que le jeu d'avant (`payerEcussons`, la graine de
 *     la run et l'étape `series`) : des séries déjà payées ne se paient pas deux fois.
 * Rend { runs, verse } : combien de runs se sont arrêtées, et les médailles versées.
 */
export function solderLAncienRogue() {
  const runs = retirerLesRuns(), converti = convertirAuJeuNeuf(lireMeta(), runs.map(r => r.resume));
  if (converti) { ecrireMeta(converti.meta); return { runs: runs.length, verse: converti.verse }; }
  let verse = 0;
  for (const { sauvegarde: S } of runs) {
    const P = S && S.partie, R = (S && S.rogue) || {};
    if (!P || !P.graine) continue;
    const finies = R.series || null, rondes = finies ? finies.rondes : P.series ? P.series.ronde || 0 : 0, coupe = !!(finies && finies.coupe);
    // Le multiple du cran de l'ancienne run (huit crans au plus, à l'époque) ; ses crans n'ouvrent rien dans la run en carte.
    verse += payerEcussons(P.graine, 'series', ecussonsDesSeries(rondes, coupe) * (1 + PRIME_EXIGENCE * Math.max(0, Math.min(8, R.exigence || 0))), { bilan: { ronde: rondes, coupe } });
  }
  return { runs: runs.length, verse };
}
export const ecussonsDesSeries = (rondes, coupe) => (rondes || 0) * 20 + (coupe ? 40 : 0);


/*
 * LES EXIGENCES 🔺 (V28, tranche 5, docs/refonte-v28-5.md § 3.4 ; le devis § 4.8 : *la cible, la bande des clubs, le plafond,
 * une porte de moins*). Après ta première Coupe, une run peut se lancer à un cran : chaque cran ajoute sa règle à celles
 * d'avant, par un levier de la run en carte (js/run.js `creerLaRun`, `reglesDe`), et ses médailles sont multipliées par
 * 1 + `PRIME_EXIGENCE` par cran. La Coupe gagnée au plus haut cran ouvert ouvre le suivant (`payerEcussons`). Les huit crans
 * de l'ancien Rogue (le prix des packs, le classeur, le barème, les contrôles) sont partis avec ce qu'ils réglaient.
 */
export const PRIME_EXIGENCE = 0.15;
export const EXIGENCES = [
  { cle: 'ceinture', nom: 'La ceinture', texte: '2 M$ d\'espace de moins au départ', espace: -2_000_000 },
  { cle: 'calendrier', nom: 'Le calendrier relevé', texte: 'des adversaires plus hauts', decalage: 0.05 },
  { cle: 'barre', nom: 'La barre monte', texte: 'un point de plus à tenir par acte', cible: 1 },
  { cle: 'porte', nom: 'Une porte de moins', texte: 'deux portes après chaque match', portes: -1 },
];
/* Ce que `n` crans exigent ensemble : chaque levier additionné, et le multiple des médailles. */
export function exigencesDe(n = 0) {
  const k = Math.max(0, Math.min(EXIGENCES.length, Math.floor(n || 0)));
  const out = { n: k, espace: 0, decalage: 0, cible: 0, portes: 0, medailles: 1 + PRIME_EXIGENCE * k };
  for (const E of EXIGENCES.slice(0, k)) for (const c of ['espace', 'decalage', 'cible', 'portes']) out[c] += E[c] || 0;
  return out;
}
/* Le plus haut cran qu'un méta peut prendre : aucun avant sa première Coupe, puis un de plus que le plus haut gagné. */
export const cranOuvert = m => ((m.coupes || 0) > 0 ? Math.min(EXIGENCES.length, (m.exigence || 0) + 1) : 0);
/*
 * LA LIGUE QUI MONTE (V9, tranche 8 ; JP, 17 oct. : *les clubs des premières runs sont globalement plus faibles et
 * montent*). Le niveau de ta ligue suit ton prestige, et chaque cran d'exigence le monte de `ETAPES_PAR_CRAN`
 * (`niveauDeLigue`). Aux `NIVEAUX_PLEINS` premiers niveaux, tes 31 adversaires sont de toute l'histoire, sans
 * édition ; ensuite, chaque niveau monte d'une édition (Cadre, Hors-cadre, Or, Holo) un tiers de plus de chaque
 * club, ses meilleurs d'abord (`editionDansLaLigue`) — le canal de tes cartes, leurs badges. Mesuré (une Dynastie de
 * l'attentif, 4 saisons) : des cartes Cadre chez tous les adversaires lui coûtent 17 points, des cartes Or 34 ;
 * choisir les clubs à leur vrai bilan ne bougeait presque rien. Les premiers niveaux devaient prendre « les plus
 * faibles d'un tirage plus large » : le tri n'a jamais trié (NaN), et trier pour vrai donnait la Coupe au robot dès
 * la run 1 (JP, 27 oct. : *on a été vraiment plus fort qu'on aurait dû*) — retiré, docs/decisions.md.
 */
const NIVEAUX_PLEINS = 2;
/* L'étape des éditions d'un niveau de ligue, plus celle de la run. */
const ligueDe = (niveau, etapeDeRun = 0) => ({ etape: Math.max(0, (niveau || 0) - NIVEAUX_PLEINS) + (etapeDeRun || 0) });
/* L'édition d'un adversaire, au rang `r` de son club (0 : son meilleur) sur `n` : un tiers de plus du club par étape. */
function editionDansLaLigue(etape, r, n) {
  const tiers = r < n / 3 ? 2 : r < (2 * n) / 3 ? 1 : 0;
  return EDITIONS[Math.min(EDITIONS.length - 1, Math.floor(((etape || 0) + (etape ? tiers : 0)) / 3))];
}
/* Habiller la ligue : les cartes des adversaires, selon le niveau ; `valeur(p)` classe chaque club, son meilleur d'abord. */
export function habillerLaLigue(adversaires, niveau, valeur, etapeDeRun = 0) {
  const { etape } = ligueDe(niveau, etapeDeRun);
  for (const t of adversaires || []) {
    const js = Object.values((t && t.roster) || {}).filter(Boolean).sort((a, b) => valeur(b) - valeur(a));
    js.forEach((p, r) => { const e = editionDansLaLigue(etape, r, js.length); if (e === 'commune') delete p._carte; else p._carte = { rar: e }; });
  }
}
