/*
 * LES PETITS OUTILS PARTAGÉS (1.0, jalon 3). Chacun existait en deux à six
 * copies identiques, une par module ; ils vivent ici une fois. Un module les
 * importe sous le nom qu'il employait déjà (`ordF as ordP`, `estD as isD`),
 * donc aucun appel n'a changé. Aucune dépendance, aucun DOM : Node et le
 * navigateur les lisent pareil.
 *
 * Ce qui n'est PAS ici exprès : les outils qui se ressemblent sans faire la
 * même chose (`nomCourt` en quatre variantes, `mmss`, `motFit`, `pct`, les
 * `lire`/`ecrire` de localStorage à clé fixe ou libre) — les fondre
 * changerait un affichage.
 */

/** Le texte d'une valeur, sûr à poser dans du HTML. */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Un défenseur, quelle que soit la façon dont la saison écrit son poste. */
export const estD = p => p && (p.p === 'D' || p.p === 'LD' || p.p === 'RD');

/** « 1er », « 2e » ; au féminin « 1re », « 2e » (une passe, une période). */
export const ord = n => (n === 1 ? '1er' : `${n}e`);
export const ordF = n => (n === 1 ? '1re' : `${n}e`);

/** La première lettre en capitale. */
export const cap = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Le nom d'un joueur, ou rien. */
export const nom = p => (p && p.n) || '';

/** La virgule décimale ; le signe devant un nombre positif. */
export const virgule = x => String(x).replace('.', ',');
/* Les vraies couleurs d'un club (js/logos.js `getTeamBand`) en variables CSS : un but les porte partout (`.but-eq`). */
export const varsEquipe = b => `--eq-band:${b.bg};--eq-ink:${b.ink};--eq-stripe:${b.stripe}`;
/* Les mêmes couleurs posées sur un carton (`.carton` lit --team-*) : une carte de jeu aux couleurs d'un vrai club (V25 B2). */
export const varsCarton = b => `--team-band:${b.bg};--team-ink:${b.ink};--team-stripe:${b.stripe}`;
export const signe = n => (n > 0 ? `+${n}` : `${n}`);

/**
 * Le +/- d'un joueur, PAR MATCH (« +0,9 »).
 *
 * Le total de saison d'un défenseur des années 1970 (+70, +87) a le même
 * gabarit que ses points. Posé à côté, on dirait que la colonne a copié les
 * points. Par match, +0,9 n'est plus le même chiffre — et c'est encore son
 * vrai différentiel.
 */
export const pmMatch = (pm, gp) => {
  if (!gp) return '—';
  const v = Math.round((pm / gp) * 10) / 10;
  if (!v) return '0,0';
  return (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',');
};

/** Un nombre gardé entre deux bornes. */
export const borne = (x, min, max) => Math.max(min, Math.min(max, x));

/**
 * Un pourcentage d'arrêts à la façon d'une fiche québécoise : « ,912 » (et
 * « 1,000 » pour un blanchissage parfait). Une seule forme dans tout le jeu
 * (1.0, gel des chaînes) : on lisait aussi « .912 » et « 91,2 % ».
 */
export const pct3 = x => (Number.isFinite(x) ? x.toFixed(3).replace(/^0\./, ',').replace('.', ',') : '—');

/*
 * DE L'ARGENT, À LA QUÉBÉCOISE : « 9,3 M$ », « 0,78 M$ », « −1,2 M$ » (1.0,
 * gel des chaînes ; la barre du haut écrivait « $9.3M » et la boutique
 * « 9,3 M$ »). Deux décimales sous 10 M$, une au-delà, sans zéro de trop.
 * L'espace avant « M$ » est insécable : le symbole ne passe jamais seul à la
 * ligne. Une seule fonction pour tout le jeu : la boutique écrivait aussi
 * « 82,0 M$ » quand la barre disait « 82 M$ ».
 */
const ESPACE_INSECABLE = '\u00a0';
export const money = n => {
  const m = Math.abs(n) / 1e6;
  let s = m >= 10 ? m.toFixed(1) : m.toFixed(2);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return (n < 0 ? '−' : '') + s.replace('.', ',') + ESPACE_INSECABLE + 'M$';
};

/*
 * LA PAGE DU CLUB (Jalon U : bâtie une fois) : « ‹ » pour revenir, l'icône, le titre et sa sous-ligne (déjà du HTML),
 * le corps, le pied (`.choix-pied`, celui des fenêtres). L'écran des séries (js/saison.js) l'ouvre ici ; « ‹ » et tout
 * `.hub-page-fermer` appellent `fermer`. Rend la section.
 */
export function pageDuClub({ genre, retour, ico = '', titre, sous = '', corps = '', pied = '', fermer }) {
  const el = document.createElement('section');
  el.className = 'hub-page';
  el.dataset.genre = genre;
  el.setAttribute('aria-label', String(titre).replace(/<[^>]*>/g, '').trim());
  el.innerHTML = `<div class="hub-page-tete">
      <button type="button" class="hub-page-retour" aria-label="${esc(retour)}" title="${esc(retour)}">‹</button>
      ${ico ? `<span class="hub-page-ico" aria-hidden="true">${ico}</span>` : ''}
      <div class="hub-page-titres"><h2 class="hub-page-titre">${titre}</h2>${sous ? `<div class="hub-page-sous">${sous}</div>` : ''}</div>
    </div>
    <div class="hub-page-corps">${corps}</div>
    ${pied ? `<div class="choix-pied hub-page-pied">${pied}</div>` : ''}`;
  el.querySelectorAll('.hub-page-retour, .hub-page-fermer').forEach(b => { b.onclick = () => fermer(); });
  return el;
}


/* ======================================================================
   LE HASARD ET LE HACHAGE (V25 A2) : une seule source pour les trois modes — le moteur de la saison (js/sim.js), Sur
   table (js/table.js) et Sur glace (js/physique.js) tirent du même générateur, de la même gaussienne et du même hachage.
   La mulberry32 et la gaussienne de Sur glace, et `hacherMise` du moteur, sont parties ; `hache` (plus bas) reste le
   nombre pur tiré de mots.
   ====================================================================== */
/** Hache un texte ou un nombre en 32 bits (cyrb53 tronqué, suffit ici). */
function graineDe(x) {
  const str = String(x);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** Un générateur sfc32 sur une graine 32 bits, uniforme dans [0, 1). */
export function generateur(graine) {
  let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = graineDe(graine) | 0;
  const suivant = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) suivant();   // on jette l'échauffement
  return suivant;
}

/** La gaussienne (Box-Muller) sur un générateur `de` uniforme dans [0, 1). */
export function gauss(de) {
  let u = 0, v = 0;
  while (u === 0) u = de();
  while (v === 0) v = de();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
/*
 * LA GRAINE EN ENTIER (refonte coachs-cartes-incidents, tranche 2, oct. 2026). Les tirages purs (`situationsDuJour`, `objectifsOfferts`, `ajustementsOfferts`) faisaient `Number(graine) >>> 0` : la graine d'une
 * partie est en base 36 (`nouvelleGraine`) et celle du matin `graine:dé`, donc NaN, donc 0 — toutes les runs tiraient
 * les mêmes dilemmes, situations et accidents aux mêmes jours. Un hachage de la chaîne (FNV-1a) : la même graine
 * tire pareil, une autre tire autrement — `check_verite`.
 */
export function entierDeGraine(graine) {
  let x = 2166136261;
  for (const ch of String(graine)) x = Math.imul(x ^ ch.charCodeAt(0), 16777619) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12;
  return x >>> 0;
}


/** Un nombre de 0 à 1 tiré de mots : la même entrée, le même nombre (le hasard pur des packs, des variantes, du deck). */
export function hache(...parts) {
  let h = 2166136261 >>> 0;
  for (const c of parts.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* Une semaine du calendrier, en journées : le repos d'une histoire sortie, la semaine des faits, le lundi d'un verdict. */
export const SEMAINE = 7;

/** Une icône en présentation texte (sans l'emoji en couleur) : elle se teinte de la couleur de son palier. */
export const glyphe = ico => String(ico ?? '').replace(/\uFE0F/g, '\uFE0E');

/*
 * PYTHAGORE AU HOCKEY : la part de victoires que des buts pour et contre annoncent (des totaux de saison ou des
 * moyennes par match). L'exposant 2 : le différentiel y pèse moins qu'au baseball. Le bilan s'en sert pour l'attente.
 */
const PYTHAGORE = 2;
export const pythagore = (gf, ga) => {
  const a = Math.pow(Math.max(1, gf), PYTHAGORE), b = Math.pow(Math.max(1, ga), PYTHAGORE);
  return a / (a + b);
};
