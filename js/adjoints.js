/*
 * LES ADJOINTS : UNE MAIN, DES SÉJOURS, UN STYLE (V22, docs/refonte-v22.md). JP, 31 oct. 2026 : *coach plus adjoints
 * dans une main, qui sont là x matchs et changent le style de l'équipe* ; *simple, impactant, le fun, marquant*.
 *
 * SIMPLE. Un adjoint est une carte : un style de jeu en deux lignes — ce qu'il donne, ce qu'il coûte, en vraies stats
 * de match — et un séjour, en matchs. Ta MAIN tient `MAIN_MAX` cartes, en poste comprises. Tu en POSTES une quand tu
 * veux (Bureau › Coach) : elle joue `SEJOUR` matchs, puis elle revient dans ta main et se repose `REPOS` matchs avant
 * de se rejouer. Les cases en poste suivent le niveau du coach (`CASES_PAR_NIVEAU`) : une au niveau 1, deux au 3,
 * trois au 5.
 *
 * IMPACTANT. Un échange permanent devait rester petit pour tenir sous sa borne sur 82 matchs ; un séjour de douze
 * matchs frappe bien plus fort chaque soir (±3 tirs, ±0,4 but) et reste sous ±1,5 V sur la saison : une carte ne joue
 * qu'un match sur deux au plus (`SEJOUR / (SEJOUR + REPOS)`). Sans repos, la rejouer de suite en referait un échange
 * permanent — c'est pour ça qu'il y en a un. Deux canaux par style, jamais plus (`check_pouvoirs`).
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

export const SEJOUR = 12;
export const SEJOUR_SYNERGIE = 16;
export const REPOS = 12;
export const MAIN_MAX = 4;
/* Les cases en poste, par niveau du coach (1 à 5). */
export const CASES_PAR_NIVEAU = [1, 1, 2, 2, 3];
export const casesDuNiveau = n => CASES_PAR_NIVEAU[Math.min(CASES_PAR_NIVEAU.length, Math.max(1, n || 1)) - 1];

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
    effet: { finition: 1.12, volume: 0.9 } },
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
    effet: { discipline: 0.7, robustesse: -2, volume: 0.94 } },
  rouleur: { ico: '🔁', nom: 'Le rouleur', style: 'Quatre trios', voie: 'profondeur',
    dit: 'Tout le monde joue, tout le monde est frais en troisième. C\'est là que ça se gagne.',
    effet: { F: [0.82, 1, 1.1, 1.2], blessure: 0.7 }, adv: { volume: 0.92 } },
  vedettiste: { ico: '🎤', nom: 'Le vedettiste', style: 'Le premier trio', voie: 'etoiles',
    dit: 'On paie des vedettes pour qu\'elles jouent. Mets-les sur la glace et laisse-les faire.',
    effet: { F: [1.2, 1, 0.92, 0.84], finition: 1.03, blessure: 1.3 }, adv: { volume: 1.08 } },
};

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
};
/* CE QU'UN ADJOINT DIT : ses lignes vertes d'abord, puis ses rouges, chacune en vraies stats. */
export function lignesDeLAdjoint(cle) {
  const A = ADJOINTS[cle];
  if (!A) return [];
  const out = [];
  for (const [k, v] of Object.entries(A.effet || {})) {
    if (k === 'F') {
      const haut = v[0] > 1;
      out.push({ txt: haut ? 'Ton 1er trio joue plus' : 'Tes 3e et 4e trios jouent plus', bon: true }, { txt: haut ? 'Le bas de l\'alignement joue moins' : 'Ton 1er trio joue moins', bon: false });
    } else if (MOTS[k]) out.push(MOTS[k](v));
  }
  for (const [k, v] of Object.entries(A.adv || {})) if (MOTS_ADV[k]) out.push(MOTS_ADV[k](v));
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
export const casesLibres = (perso, games, niveau) => Math.max(0, casesDuNiveau(niveau) - postesDe(perso, games).length);

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
/* Embaucher : la carte entre dans la main, neuve ; pleine, la plus ancienne hors poste part. Rend la main. */
export function embaucher(perso, cle, games) {
  const main = mainDe(perso);
  if (!ADJOINTS[cle] || main.some(c => c.cle === cle)) return main;
  const part = quiPartDeLaMain(perso, games);
  return [...main.filter(c => c.cle !== part), { cle, depuis: null, fin: null, sejours: [] }];
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
    return { cle: c.cle, depuis: null, fin: games, sejours: [...(c.sejours || []), s] };
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
