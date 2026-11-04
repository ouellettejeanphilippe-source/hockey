/*
 * LES PHOTOS D'ACTION (1.0). JP : *pense à des cartes complexes, trouve des
 * images, pas juste des faces, si tu peux*.
 *
 * La LNH publie une photo de match pour la plupart des joueurs d'après 2005.
 * `data/actions.json` (scripts/actions.mjs) dit qui en a une : un joueur
 * absent n'est jamais demandé, et sa carte garde son portrait. Une carte
 * demande `actionSrc(id)` — une adresse d'image 5:7 (400 × 560), ou null.
 *
 * Les photos sont recadrées à la fabrication (img/actions/, versionnées
 * depuis oct. 2026 pour que GitHub Pages les serve ; scripts/actions.mjs les
 * refait) et servies par le travailleur de service (sw.js), qui les garde
 * dans son tiroir après le premier rendu. Au démarrage, on en demande UNE ;
 * absente, aucune carte n'en demande d'autre. Toute carte la montre dès
 * qu'elle existe (`photoAction`, js/cartes.js). Web seulement depuis le
 * 4 nov. 2026 : l'application Android, qui téléchargeait et recadrait les
 * photos sur l'appareil, est partie.
 *
 * LES PHOTOS LIBRES (oct. 2026, scripts/actions_commons.mjs). Pour un joueur que
 * la LNH ne montre pas, une photo de son époque sous licence libre : Wikimedia
 * Commons (`commons`) ou Openverse (`libres`). Le jeu lit le même
 * img/actions/{id}.webp. `creditPhoto(id)` rend l'auteur, la licence et la
 * page de l'œuvre, pour le crédit que la licence demande.
 *
 * UNE PHOTO PAR SAISON (oct. 2026, scripts/actions_saisons.mjs). JP : *une photo par joueur par an pour pas
 * toujours utiliser celle de sa dernière saison, ça a l'air fou*. Quand Commons a une photo de match libre de
 * CETTE saison, la carte de cette saison la prend avant toute autre : `actionSrc(id, saison)`,
 * `cadreAction(id, saison)` et `creditPhoto(id, saison)` rendent la sienne, img/actions/{id}-{saison}.webp ;
 * une saison sans la sienne garde la photo générale.
 *
 * LES PHOTOS COUCHÉES (oct. 2026, scripts/actions_couchees.mjs). JP : *cartes spéciales action horizontales quand
 * t'as des photos qui gossent vertical*. Une photo de la LNH dont la fenêtre debout coupe le jeu a aussi sa version
 * 7:5, la photo générale comme celle d'une saison, de la LNH comme de Commons (img/actions/couchees/{id}.webp ou
 * {id}-{saison}.webp ; `couchees` : sa clé → le centre du visage) ; `actionCouchee(id, saison, club)` rend celle de
 * la photo que la carte montre, et la carte se couche (`cartonHtml`, js/cartes.js).
 */

let liste = null;            // les joueurs qui ont une photo (data/actions.json)
let libres = {};             // id → la photo libre (Commons ou Openverse) : sa vignette, son auteur, sa licence
let cadres = {};             // id → le centre du visage dans la photo 5:7 [x, y], pour la fenêtre de chaque série
let clubs = {};              // id → le ou les clubs de sa photo générale (scripts/actions_clubs.mjs)
let couchees = {};           // « id » ou « id-saison » → le centre du visage dans sa photo couchée [x, y] (scripts/actions_couchees.mjs)
let saisons = {};            // id → { saison → [fichier, dossier, largeur de la vignette, auteur, licence, centre du visage, cadre, club ?] }
let auteurs = [], licences = [];   // les auteurs et les licences des photos de saison, par index
let chargement = null;       // la promesse de actionsDisponibles()
let surLeWeb = false;        // les fichiers img/actions/ répondent

/*
 * LA PHOTO DE FOND (1.0, oct.). JP : *mettre des images en action dans le background avec un noir
 * opacité .7 pour s'assurer que ça reste lisible*. La photo du meilleur pointeur d'un groupe qui en a
 * une, par `actionSrc` — la même que sur sa carte, img/actions. Jamais la LNH depuis la page (le smoke
 * le refuse). Rend son adresse, ou null.
 */
export function photoDeFond(joueurs) {
  if (!liste) return null;
  const pts = p => (p.pt ?? ((p.g || 0) + (p.a || 0))) || 0;
  const p = joueurs.filter(x => x && (liste.has(Number(x.id)) || deSaison(x.id, x.s, x.t))).sort((a, b) => pts(b) - pts(a))[0];
  return p ? actionSrc(p.id, p.s, p.t) : null;
}

/*
 * Au démarrage : la liste, et si les photos se montrent. Rend les joueurs
 * dont une carte peut montrer la photo.
 */
export function actionsDisponibles() {
  if (!chargement) chargement = (async () => {
    try {
      const r = await fetch('data/actions.json');
      if (!r.ok) return [];
      const lu = await r.json(), ids = lu.ids || [];
      liste = new Set(ids);
      libres = { ...(lu.libres || {}), ...(lu.commons || {}) };
      cadres = lu.cadres || {};
      clubs = lu.clubs || {};
      couchees = lu.couchees || {};
      saisons = lu.saisons || {};
      auteurs = lu.auteurs || [];
      licences = lu.licences || [];
      if (!ids.length) return ids;
      // Une vraie lecture (pas un HEAD : hors ligne, seul un GET passe par le tiroir du travailleur de service),
      // et le corps lu jusqu'au bout — une réponse laissée ouverte garde la page « occupée » pour toujours.
      const v = await fetch(`img/actions/${ids[0]}.webp`);
      await v.blob();
      surLeWeb = v.ok;
      return surLeWeb ? ids : [];
    } catch { return []; }
  })();
  return chargement;
}

/*
 * La photo de CETTE saison du joueur (scripts/actions_saisons.mjs), ou null : il n'en a pas, on garde la générale.
 * Un joueur échangé a une carte par club dans la même saison : sa photo porte alors son club (le 8e champ), et
 * seule la carte de ce club la prend.
 */
function deSaison(id, saison, club) {
  const e = saison && saisons[Number(id)] && saisons[Number(id)][saison];
  return e && (!e[7] || !club || e[7] === club) ? e : null;
}
/*
 * LA PHOTO GÉNÉRALE, DE SON CLUB SEULEMENT (oct. 2026, JP : *les photos d'actions sont souvent d'un autre club que le
 * joueur a joué* ; il a choisi le portrait plutôt qu'un autre chandail). Sans photo de sa saison, une carte ne prend
 * la photo générale que si elle porte le club de la carte (`clubs`, scripts/actions_clubs.mjs) ; sans club demandé,
 * toujours.
 */
const deSonClub = (id, club) => !club || (clubs[Number(id)] || '').split(' ').includes(club);
const nomCommons = f => encodeURIComponent(f.replace(/ /g, '_'));
const pageCommons = f => `https://commons.wikimedia.org/wiki/File:${nomCommons(f)}`;
/* La vignette de Commons d'une photo de saison : l'adresse que la fabrication télécharge (scripts/actions_saisons.mjs). */
export const vignetteCommons = ([f, dossier, largeur]) =>
  `https://upload.wikimedia.org/wikipedia/commons/${largeur ? 'thumb/' : ''}${dossier[0]}/${dossier}/${nomCommons(f)}${largeur ? `/${largeur}px-${nomCommons(f)}` : ''}`;

/*
 * Le crédit d'une photo libre : { auteur, licence, url } (la page de l'œuvre), ou null pour une photo de la
 * LNH ou un joueur sans photo. Avec la saison, celui de sa photo de saison s'il y en a une.
 */
export function creditPhoto(id, saison, club) {
  const ps = deSaison(id, saison, club);
  if (ps) return { auteur: auteurs[ps[3]], licence: licences[ps[4]], url: pageCommons(ps[0]) };
  const c = libres[Number(id)];
  if (!c || !deSonClub(id, club)) return null;
  return { auteur: c.a, licence: c.l, url: c.f ? pageCommons(c.f) : c.p };
}

/* Le centre du visage dans sa photo d'action, [x, y] en fractions, ou null (aucun visage sûr : la série cadre seule). */
export function cadreAction(id, saison, club) {
  const ps = deSaison(id, saison, club);
  return (ps ? ps[6] : deSonClub(id, club) && cadres[Number(id)]) || null;
}

/* L'image d'action d'un joueur, 5:7, ou null (la carte garde son portrait) ; avec sa saison (et son club), celle de cette saison d'abord, sinon la générale si elle est de son club. */
export function actionSrc(id, saison, club) {
  id = Number(id);
  const ps = deSaison(id, saison, club);
  if (!ps && (!liste || !liste.has(id) || !deSonClub(id, club))) return null;
  const cle = ps ? `${id}-${saison}` : id;
  return surLeWeb ? `img/actions/${cle}.webp` : null;
}

/* La clé de la photo que montre la carte : « id-saison » pour une photo de saison, l'id pour la générale de son club ; null sans photo. */
function cleDeLaPhoto(id, saison, club) {
  id = Number(id);
  if (deSaison(id, saison, club)) return `${id}-${saison}`;
  return liste && liste.has(id) && deSonClub(id, club) ? id : null;
}
/* La photo couchée (7:5) de la photo que montre la carte, ou null : elle tient debout. */
export function actionCouchee(id, saison, club) {
  const cle = cleDeLaPhoto(id, saison, club);
  if (cle === null || !couchees[cle]) return null;
  return surLeWeb ? `img/actions/couchees/${cle}.webp` : null;
}
/* Le centre du visage dans cette photo couchée, [x, y] en fractions. */
export function cadreCouche(id, saison, club) {
  const cle = cleDeLaPhoto(id, saison, club);
  return (cle !== null && couchees[cle]) || null;
}
