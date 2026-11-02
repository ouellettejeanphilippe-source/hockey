/*
 * LES ADJOINTS : UNE MAIN, DES SÉJOURS, UN STYLE (V22, docs/refonte-v22.md). JP, 31 oct. 2026 : *coach plus adjoints
 * dans une main, qui sont là x matchs et changent le style de l'équipe* ; *simple, impactant, le fun, marquant*.
 *
 * SIMPLE. Un adjoint est une carte : un style de jeu en deux lignes — ce qu'il donne, ce qu'il coûte, en vraies stats
 * de match — et un séjour, en matchs. Ta MAIN tient `MAIN_MAX` cartes, en poste comprises. Tu en POSTES une quand tu
 * veux (Bureau › Coach) : elle joue `SEJOUR` matchs, puis elle revient dans ta main et se repose `REPOS` matchs avant
 * de se rejouer. Les cases en poste suivent le niveau du coach (`CASES_PAR_NIVEAU`) : une au niveau 1, deux au 3,
 * trois au 5 ; le premier talent du coach peut en ouvrir une de plus (`CASE_DE_PLUS`, js/pouvoirs.js `TALENT_CASE`).
 *
 * IMPACTANT. Un échange permanent devait rester petit pour tenir sous sa borne sur 82 matchs ; un séjour de douze
 * matchs frappe bien plus fort chaque soir (±3 tirs, ±0,4 but) et reste sous ±1,5 V sur la saison : une carte ne joue
 * qu'un match sur deux au plus (`SEJOUR / (SEJOUR + REPOS)`). Sans repos, la rejouer de suite en referait un échange
 * permanent — c'est pour ça qu'il y en a un. Il dure plus que le séjour (nov. 2026, docs/decisions.md) : deux cartes en
 * alternance ne couvrent plus une case toute la saison, la troisième compte (`scripts/mesure_main.mjs`). Deux canaux par
 * style, jamais plus (`check_pouvoirs`).
 *
 * LE FUN. Jouer une carte est un choix de moment : le canonnier avant la semaine à la maison, le mur avant ta bête noire.
 * Un style qui rejoint la philosophie de ton coach (`voie`) dure `SEJOUR_SYNERGIE` matchs au lieu de `SEJOUR` : la
 * synergie, pas un chiffre plus gros. Les cartes arrivent aux moments forts, un parmi trois, gratuit
 * (`adjointsOfferts`) ; une main pleine laisse partir la plus ancienne hors poste (`quiPartDeLaMain`), et l'offre le dit.
 *
 * MARQUANT. La carte se souvient : chaque séjour s'écrit à son verso avec sa fiche (`sejours`), et Hier soir le dit
 * quand il finit (js/sim.js `finirLesSejours`). Chaque adjoint a une réplique (`dit`), sans chiffre.
 *
 * Pur : le moteur (js/sim.js `poserLesAdjoints`, `appliquerPerso`) et l'écran (js/alignement.js) lisent la même table.
 * La main d'un personnage : `perso.main = [{ cle, depuis, fin, sejours: [{ debut, fin, v, d, dp }] }]` — `depuis`, le
 * compte de matchs du club à la pose (en poste tant que `games - depuis < sejour`) ; `fin`, celui de la fin du dernier
 * séjour (au repos tant que `games - fin < REPOS`).
 */
import { hache } from './util.js';
import { COACHS } from './coachs.js';
import { aLaCaseDePlus } from './pouvoirs.js';

export const SEJOUR = 12;
export const SEJOUR_SYNERGIE = 16;
export const REPOS = 20;
export const MAIN_MAX = 4;
/* Les cases en poste, par niveau du coach (1 à 5). */
export const CASES_PAR_NIVEAU = [1, 1, 2, 2, 3];
export const casesDuNiveau = n => CASES_PAR_NIVEAU[Math.min(CASES_PAR_NIVEAU.length, Math.max(1, n || 1)) - 1];
/*
 * LA CASE DE PLUS (2 nov. 2026 ; docs/revue-rogue-2026-11.md § 2.4 B) : le premier talent, pris au niveau 2 à la place
 * du pouvoir I grandi, ouvre une case de plus, pour la run (`CASE_DE_PLUS`, par niveau). Les cases d'un personnage :
 * celles de son niveau, plus la sienne.
 */
export const CASE_DE_PLUS = [0, 1, 1, 1, 1];
export const casesDuPerso = (perso, n) => casesDuNiveau(n) + (aLaCaseDePlus(perso) ? CASE_DE_PLUS[Math.min(CASE_DE_PLUS.length, Math.max(1, n || 1)) - 1] : 0);

/*
 * Huit styles, un par philosophie (`voie` : la clé du coach de js/coachs.js), pour que la synergie se lise d'un coup
 * d'œil. `effet` sur ton club, `adv` sur l'adversaire, le temps du match ; les canaux sont ceux du moteur.
 */
export const ADJOINTS = {
  canonnier: { ico: '🏹', nom: 'Le canonnier', style: 'Tirer de partout', voie: 'essaim',
    dit: 'Une rondelle sur la palette, c\'est une rondelle au filet. On comptera après.',
    effet: { volume: 1.18, finition: 0.9 }, adv: { volume: 1.06 } },
  lunette: { ico: '🔭', nom: 'Le tireur d\'élite', style: 'Choisir ses tirs', voie: 'rapaces',
    dit: 'Un bon tir vaut trois mauvais. On attend l\'ouverture, et on la prend.',
    // V23 : sa précision bute sur le plafond du jeu (`FINITION_MAX`) chez un club qui tire déjà bien ; son style se voit à
    // ses tirs choisis, −12 % (−10 % avant), jusqu'au Phénomène qui en paie moins.
    effet: { finition: 1.15, volume: 0.88 } },
  mur: { ico: '🧱', nom: 'Le mur', style: 'Fermer la zone', voie: 'tortue',
    dit: 'Personne ne traverse la ligne bleue debout. Le reste, c\'est du détail.',
    effet: { volume: 0.9 }, adv: { volume: 0.86 } },
  cogneur: { ico: '🏋', nom: 'Le cogneur', style: 'Le jeu physique', voie: 'rhinos',
    dit: 'Finis tes mises en échec. Ils vont lever la tête, et c\'est là qu\'ils vont rater.',
    effet: { robustesse: 2, discipline: 1.4 }, adv: { finition: 0.98 } },
  preparateur: { ico: '🏃', nom: 'Le préparateur', style: 'Les jambes fraîches', voie: 'souffle',
    dit: 'Des présences courtes, du repos, de l\'eau. On ne gagne rien à l\'infirmerie.',
    effet: { blessure: 0.65, energie: 0.85, volume: 0.95 } },
  moine: { ico: '🧘', nom: 'Le moine', style: 'La discipline', voie: 'choeur',
    dit: 'Les bâtons sur la glace, la bouche fermée. L\'arbitre ne nous verra pas de la soirée.',
    // V23 : il perdait au Pilier (−0,4 V) et piégeait au Soutien (−1,1 V) : ses mises en échec perdues, −1,5 (−2 avant).
    effet: { discipline: 0.7, robustesse: -1.5, volume: 0.94 } },
  rouleur: { ico: '🔁', nom: 'Le rouleur', style: 'Quatre trios', voie: 'profondeur',
    dit: 'Tout le monde joue, tout le monde est frais en troisième. C\'est là que ça se gagne.',
    effet: { F: [0.82, 1, 1.1, 1.2], blessure: 0.7 }, adv: { volume: 0.92 } },
  vedettiste: { ico: '🎤', nom: 'Le vedettiste', style: 'Le premier trio', voie: 'etoiles',
    dit: 'On paie des vedettes pour qu\'elles jouent. Mets-les sur la glace et laisse-les faire.',
    effet: { F: [1.2, 1, 0.92, 0.84], finition: 1.03, blessure: 1.3 }, adv: { volume: 1.08 } },
  /*
   * L'ANCIEN ARBITRE (V23 ; JP, 2 nov. : *a coach or assistant that was a ref, and pay them*). Hors des huit voies : il
   * ne rejoint aucun coach, et il se paie (`salaire`, en jetons par match en poste, en plus de celui de son niveau).
   */
  arbitre: { ico: '🦓', nom: 'L\'ancien arbitre', style: 'Il connaît les arbitres', voie: null, salaire: 2,
    dit: 'J\'ai sifflé vingt ans dans cette ligue. Je sais ce qu\'ils regardent, et ce qu\'ils ne regardent pas.',
    effet: { discipline: 0.85 }, adv: { discipline: 1.1 } },
};

/*
 * LE NIVEAU D'UN ADJOINT (V23, docs/refonte-v23.md § C ; JP, 2 nov. : *les coachs et adjoints doivent être comme les
 * joueurs, de pas très bon à excellents*). Les mots des joueurs (js/niveaux.js) : Soutien, Régulier, Pilier, ★ Étoile,
 * ★ Phénomène. Son style ne change pas — ses canaux, ce qu'il donne, ce qu'il coûte — : son niveau règle la FORCE de ce
 * qu'il donne (`FORCE_NIV`) et le PRIX de ce qu'il coûte (`PRIX_NIV`, qui bouge moins que la force : un style reste un style, son prix se voit encore au Phénomène, et le Soutien est faible sans être un piège), écart par écart au match ordinaire. Un Phénomène
 * donne plus et coûte moins ; un Soutien, l'inverse. Le Pilier, c'est la table telle quelle : une carte d'avant la V23,
 * sans niveau, en est un (`NIV_DEFAUT`), et une vieille partie se rejoue au but près (`check_sauvegardes`). Sa borne
 * suit son niveau comme une carte suit sa rareté (`RARETE_NIV`, `BORNE_NIV` : ±1 V à ±4 V) — `check_pouvoirs`.
 */
export const NOMS_NIV = ['Soutien', 'Régulier', 'Pilier', '★ Étoile', '★ Phénomène'];
export const FORCE_NIV = [0.7, 0.85, 1, 1.15, 1.3];
const PRIX_NIV = [1.05, 1.025, 1, 0.9, 0.8];
export const RARETE_NIV = ['commune', 'commune', 'peu', 'rare', 'legendaire'];
export const BORNE_NIV = [1, 1, 1.5, 2.5, 4];
export const NIV_DEFAUT = 3;
/*
 * LE SALAIRE (V23 ; JP : *pay them*) : un adjoint en poste se paie, en jetons, chaque match — plus il est bon, plus il
 * coûte (`SALAIRE_NIV` : rien au Soutien et au Régulier, 1, 2 puis 3 🪙 au Phénomène), plus le sien (`salaire`, l'ancien
 * arbitre). Une carte d'avant la V23, sans niveau, ne coûte rien. La feuille le garde (`feuille.adjoints[].salaire`), la
 * caisse le déduit (js/rogue.js `salairesDesAdjoints`) : le poster est un choix d'argent autant que de hockey.
 */
export const SALAIRE_NIV = [0, 0, 1, 2, 3];
export const salaireDe = c => (c && ADJOINTS[c.cle] ? (c.niv ? SALAIRE_NIV[nivDe(c) - 1] : 0) + (ADJOINTS[c.cle].salaire || 0) : 0);
export const nivDe = c => Math.min(5, Math.max(1, Math.round(Number(c && c.niv) || NIV_DEFAUT)));
/* Ce qu'un canal fait de bon de ton côté (`effet`) ou de l'adversaire (`adv`) : plus de tirs à toi, moins des leurs… */
const BON_SI_HAUT = { effet: new Set(['volume', 'finition', 'robustesse', 'F']), adv: new Set(['discipline']) };
const echelle = (v, bon, niv) => 1 + (v - 1) * (bon ? FORCE_NIV : PRIX_NIV)[niv - 1];
const canalAuNiveau = (cote, k, v, niv) => {
  if (Array.isArray(v)) return v.map(x => echelle(x, x > 1, niv));
  if (k === 'robustesse') return v * (v > 0 ? FORCE_NIV : PRIX_NIV)[niv - 1];
  const haut = BON_SI_HAUT[cote].has(k);
  return echelle(v, haut ? v > 1 : v < 1, niv);
};
/* Le style d'un adjoint à son niveau : `{ effet, adv }`, les canaux du moteur. Au Pilier, la table telle quelle. */
export function styleAuNiveau(cle, niv = NIV_DEFAUT) {
  const A = ADJOINTS[cle];
  if (!A) return { effet: null, adv: null };
  const n = nivDe({ niv });
  const passe = (cote, o) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, n === NIV_DEFAUT ? v : canalAuNiveau(cote, k, v, n)])) : null);
  return { effet: passe('effet', A.effet), adv: passe('adv', A.adv) };
}
/*
 * LE NIVEAU D'UNE OFFRE, tiré de la graine (pur) : la plupart Régulier ou Pilier, l'Étoile une fois sur cinq, le
 * Phénomène rare. Un moment plus fort (un gros match gagné, le verdict du proprio : `fort`) monte d'un cran, jusqu'au
 * Phénomène. `cle` : le moment, `k` : l'adjoint.
 */
const TIRAGE_NIV = [[0.12, 1], [0.45, 2], [0.8, 3], [0.95, 4], [1, 5]];
/* Les moments forts : le butin d'un gros match gagné (`r…`) et le verdict du proprio (`v…`) ; les paliers, les talents et les histoires, non. */
export const momentFort = cle => /^[rv]\d/.test(String(cle));
export function niveauOffert(graine, cle, k, fort = false) {
  const u = hache(String(graine), 'niveau', cle, k);
  const n = TIRAGE_NIV.find(([s]) => u < s)[1];
  return Math.min(5, n + (fort ? 1 : 0));
}

/* Un canal, en mots, de ton côté : ce qu'il dit et s'il aide (`bon`). */
const pct = v => `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)} %`;
const MOTS = {
  volume: v => ({ txt: `Tes tirs ${pct(v)}`, bon: v > 1 }),
  finition: v => ({ txt: `Ta précision ${pct(v)}`, bon: v > 1 }),
  defense: v => ({ txt: `Buts contre ${pct(v)}`, bon: v < 1 }),
  discipline: v => ({ txt: `Tes punitions ${pct(v)}`, bon: v < 1 }),
  blessure: v => ({ txt: `Tes blessures ${pct(v)}`, bon: v < 1 }),
  energie: v => ({ txt: `Usure des jambes ${pct(v)}`, bon: v < 1 }),
  robustesse: v => ({ txt: `${v > 0 ? 'Plus' : 'Moins'} de mises en échec`, bon: v > 0 }),
};
const MOTS_ADV = {
  volume: v => ({ txt: `Leurs tirs ${pct(v)}`, bon: v < 1 }),
  finition: v => ({ txt: `Leur précision ${pct(v)}`, bon: v < 1 }),
  discipline: v => ({ txt: `Leurs punitions ${pct(v)}`, bon: v > 1 }),
};
/* CE QU'UN ADJOINT DIT, à son niveau : ses lignes vertes d'abord, puis ses rouges, chacune en vraies stats. */
export function lignesDeLAdjoint(cle, niv = null) {
  const A = ADJOINTS[cle] && styleAuNiveau(cle, niv || NIV_DEFAUT);
  if (!A) return [];
  const out = [];
  for (const [k, v] of Object.entries(A.effet || {})) {
    if (k === 'F') {
      const haut = v[0] > 1;
      out.push({ txt: haut ? 'Ton 1er trio joue plus' : 'Tes 3e et 4e trios jouent plus', bon: true }, { txt: haut ? 'Le bas de l\'alignement joue moins' : 'Ton 1er trio joue moins', bon: false });
    } else if (MOTS[k]) out.push(MOTS[k](v));
  }
  for (const [k, v] of Object.entries(A.adv || {})) if (MOTS_ADV[k]) out.push(MOTS_ADV[k](v));
  // V23 : son salaire est un prix comme un autre (une carte sans niveau ne paie que le sien).
  const paye = salaireDe({ cle, niv });
  if (paye) out.push({ txt: `Salaire : ${paye} 🪙 par match en poste`, bon: false });
  return [...out.filter(x => x.bon), ...out.filter(x => !x.bon)];
}

/* Le séjour d'un adjoint chez un coach : plus long s'il rejoint sa philosophie. */
export const sejourDe = (cle, coach) => (ADJOINTS[cle] && ADJOINTS[cle].voie === coach ? SEJOUR_SYNERGIE : SEJOUR);
/* La ligne de synergie, à dire sur la carte : « Rejoint le Frelon : 16 matchs ». */
export const motDeSynergie = (cle, coach) => (ADJOINTS[cle] && ADJOINTS[cle].voie === coach && COACHS[coach] ? `Rejoint ${COACHS[coach].nom.replace(/^(Le|La|L')\s?/, m => m.toLowerCase())} : ${SEJOUR_SYNERGIE} matchs` : null);

/* La main d'un personnage, propre : ses cartes connues, dans l'ordre d'arrivée. */
export const mainDe = perso => ((perso && perso.main) || []).filter(c => c && ADJOINTS[c.cle]);
/* Une carte est en poste si son séjour court : `games`, le compte de matchs du club. */
export const enPoste = (c, games, coach) => c.depuis != null && games - c.depuis < sejourDe(c.cle, coach);
/* Ce qui lui reste en poste, en matchs. */
export const resteDe = (c, games, coach) => (enPoste(c, games, coach) ? sejourDe(c.cle, coach) - (games - c.depuis) : 0);
/* Au repos : son dernier séjour est fini depuis moins de `REPOS` matchs. */
export const auRepos = (c, games) => c.depuis == null && c.fin != null && games - c.fin < REPOS;
export const reposDe = (c, games) => (auRepos(c, games) ? REPOS - (games - c.fin) : 0);
/* Les cartes en poste d'un personnage, et celles de la main prêtes à l'être. */
export const postesDe = (perso, games) => mainDe(perso).filter(c => enPoste(c, games, perso.cle));
export const pretesDe = (perso, games) => mainDe(perso).filter(c => !enPoste(c, games, perso.cle) && !auRepos(c, games));
/* Les cases libres, au niveau du coach. */
export const casesLibres = (perso, games, niveau) => Math.max(0, casesDuPerso(perso, niveau) - postesDe(perso, games).length);

/*
 * LES ADJOINTS OFFERTS (un parmi trois, gratuits, aux moments forts) : tirés de la graine parmi ceux qui ne sont pas
 * déjà dans la main. `cle` : le moment fort (le palier, le butin, le verdict, l'histoire) ; deux moments n'offrent pas
 * les mêmes.
 */
export function adjointsOfferts(perso, graine, cle, n = 3) {
  const pris = new Set(mainDe(perso).map(c => c.cle));
  return Object.keys(ADJOINTS).filter(k => !pris.has(k))
    .sort((a, b) => hache(String(graine), 'adjoint', cle, a) - hache(String(graine), 'adjoint', cle, b)).slice(0, n);
}
/* Celle qu'une main pleine laisse partir à la prochaine arrivée : la plus ancienne hors poste ; personne si elle a de la place. */
export function quiPartDeLaMain(perso, games) {
  const main = mainDe(perso);
  return main.length >= MAIN_MAX ? (main.find(c => !enPoste(c, games, perso.cle)) || {}).cle || null : null;
}
/* Embaucher : la carte entre dans la main, neuve, à son niveau (`niv`, le Pilier sans lui) ; pleine, la plus ancienne hors poste part. Rend la main. */
export function embaucher(perso, cle, games, niv = null) {
  const main = mainDe(perso);
  if (!ADJOINTS[cle] || main.some(c => c.cle === cle)) return main;
  const part = quiPartDeLaMain(perso, games);
  return [...main.filter(c => c.cle !== part), { cle, ...(niv ? { niv: nivDe({ niv }) } : {}), depuis: null, fin: null, sejours: [] }];
}
/* Poster : une carte prête, une case libre ; sinon la main ne bouge pas. Rend la main. */
export function poster(perso, cle, games, niveau, fiche0 = null) {
  const main = mainDe(perso), c = main.find(x => x.cle === cle);
  if (!c || enPoste(c, games, perso.cle) || auRepos(c, games) || !casesLibres(perso, games, niveau)) return main;
  return main.map(x => (x === c ? { ...x, depuis: games, fin: null, fiche0: fiche0 ? { W: fiche0.W || 0, L: fiche0.L || 0, OTL: fiche0.OTL || 0 } : null } : x));
}
/*
 * LA FIN D'UN SÉJOUR : au compte de matchs `games`, les cartes dont le séjour est fait reviennent dans la main avec leur
 * fiche (`v`, `d`, `dp`, lue sur la fiche du club entre la pose et maintenant). Rend { main, finis: [{ cle, debut, fin, v, d, dp }] }.
 */
export function finirLesSejours(perso, games, fiche) {
  const finis = [];
  const main = mainDe(perso).map(c => {
    if (c.depuis == null || games - c.depuis < sejourDe(c.cle, perso.cle)) return c;
    const f0 = c.fiche0 || { W: 0, L: 0, OTL: 0 };
    const s = { debut: c.depuis, fin: games, v: (fiche.W || 0) - f0.W, d: (fiche.L || 0) - f0.L, dp: (fiche.OTL || 0) - f0.OTL };
    finis.push({ cle: c.cle, ...s });
    return { cle: c.cle, ...(c.niv ? { niv: c.niv } : {}), depuis: null, fin: games, sejours: [...(c.sejours || []), s] };
  });
  return { main, finis };
}
/* La fiche d'une carte chez toi, tous séjours confondus : « 2 séjours · 15-7-2 ». */
export function ficheDeLaCarte(c) {
  const s = (c && c.sejours) || [];
  if (!s.length) return null;
  const t = s.reduce((a, x) => ({ v: a.v + x.v, d: a.d + x.d, dp: a.dp + x.dp }), { v: 0, d: 0, dp: 0 });
  return `${s.length} séjour${s.length > 1 ? 's' : ''} · ${t.v}-${t.d}-${t.dp}`;
}
