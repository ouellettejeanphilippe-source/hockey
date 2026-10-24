/*
 * L'ALIGNEMENT (sorti de js/game.js en 1.0) : les cases, les trios et les
 * paires, leur système réglé en fenêtre, le résumé d'équipe, le bouton
 * principal — et, en mode Sur table, les nombres du plateau au repêchage.
 */

import { TRAITS, getTraits } from './traits.js';
import { MT } from './charge-table.js';
import { esc, estD as isD, glyphe, money, pct3 } from './util.js';
import { IMPORTANCES, AD_DE_CONSIGNE, badgesDe, getPlayerKey, penaliteAffichee, SLOTS, fits, getUnitSynergy, identiteUnite, origineUnite, lignesDe, getPositionPenalty, ADAPT_MATCHS, partDesDeparts, lignesAuMieux, activeLineup, profilMatch, TACTIQUES, ROULEMENTS, partsDuRoulement, lienDePaire, joueursDesCoachs, lignesDeGros, planProbable, PART_UNITE, specialesDuSoir } from './sim.js';
import { alignementAuMieux, unitesDuSoir, alignementDuSoir, chiffresDuSoir, statsDe, motsDeStats, specialesEnStats, clubLu } from './impact.js';
import { COACHS, SEUILS, ROMAINS, JOUEUR_COACH, palierDe, avantProchain } from './coachs.js';
import { buildDe, coachsActifs, reglesDePalier } from './banque.js';
import { matchsJoues } from './echelons.js';
import { jambesHtml, motDuBadge, strategieDeLigne, ouvrirStrategie, ouvrirChoix, puces } from './gerant.js';
import { couleurVive, fondEquipe, getTeamBand, getTeamLogoHtml } from './logos.js';
import { teamShort } from './bilan.js';
import { $, G, MODE, ZONE_DESSUS_TITLE, ZONE_SOUS_TITLE, capLeft, capUsed, caseOuverte, chiffreCle, displayStats, estRenfort, formatName, headshotHtml, ico, positionClass, positionLabel, render, roleTag, saveGame, saveOpts, setView, slotsLeft, toast, totalCases, zoneEcart, zoneTag } from './game.js';
import { ajusterCartes, choisirSpeciale, pastilleNiveau, rareteJoueur, relacherReserviste, slotShort } from './repechage.js';
import { ouvrirFiche, porteeRevele, showPlayerModal } from './fiche.js';

/* La carte d'un joueur de l'alignement : sa fiche de saison (à ce jour) une fois la ligue lancée, sa carte sinon. */
function ouvrirCarteDe(p) {
  const L = G.ligue;
  if (L) ouvrirFiche(p, L.you, porteeRevele('saison') === 'jour' ? 'jour' : 'saison');
  else showPlayerModal(p, {});
}

/* =====================================================================
   Rendu — alignement
   ===================================================================== */

/*
 * LA CASE NE PORTE QUE LE VERDICT DE PLACEMENT : la zone d'efficacité,
 * l'écart à cette zone, la pénalité de position. Rien d'autre.
 *
 * Elle portait aussi les traits et l'archétype, et c'est ce qui la salissait :
 * quatre cases par trio sur un quart d'écran font des cases de cent pixels,
 * où la quatrième étiquette se coupait en deux et laissait un moignon au
 * bord. Les traits n'ont pas disparu — ils sont sur la carte du bassin, au
 * moment où on décide de signer, et sur la fiche. Le tableau de profondeur,
 * lui, répond à une seule question : ce joueur est-il à sa place ?
 */
const SLOT_TAGS_MAX = 8;   // les icônes de traits devant le verdict, la rangée se réduit à l'échelle au besoin
/*
 * La case porte le verdict de placement — zone, écart, pénalité — et, devant,
 * les ICÔNES du joueur : ses traits et ses étiquettes mesurées. JP : *à voir
 * les icônes dans l'alignement* — on lit d'un coup d'œil son trio
 * d'étouffement et ses colosses une fois l'alignement monté.
 */
/* =====================================================================
   SUR TABLE : le repêchage montre les nombres du PLATEAU
   =====================================================================
   JP : *le mode Blood Bowl, montrer les stats du jeu de table, pas les
   vraies stats*. On repêchait sous un jeu de règles et on jouait sous un
   autre : la carte disait 78 PTS, la case disait « ▼ sous sa zone », la
   rangée disait « chimie +2/+2 », les tuiles comptaient les unités
   « optimales » — et le plateau se joue sur PA MA TI FO SO, le gabarit, le
   tir signature et l'habileté. Pire que les vraies stats : `js/table.js` ne
   lit NI les zones, NI la pénalité de position, NI la chimie (vérifié : zéro
   occurrence), donc ces verdicts-là parlaient d'un moteur qui n'allait pas
   jouer.

   Quand `G.bonus` vaut TABLE, le repêchage lit donc `statsDeTable` — la
   même fonction que la carte du plateau, aucun nombre neuf — et tait ce que
   le plateau ignore. Le repêchage lui-même ne change pas : mêmes 23 cases,
   même plafond, même roulette.
   ===================================================================== */
export const surTable = () => G.bonus === 'TABLE';

/* Les cinq nombres d'un joueur, mémorisés : le tri les demande n log n fois. */
const STATS_TABLE = new WeakMap();
export function tableStats(p) {
  let st = STATS_TABLE.get(p);
  if (!st) { st = MT.statsDeTable(p); STATS_TABLE.set(p, st); }
  return st;
}

const AXES_PATINEUR = ['PA', 'MA', 'TI', 'FO', 'DE', 'SO'];
export const axesDe = p => (p.p === 'G' ? ['AR'] : AXES_PATINEUR);

/* Un axe : son sigle, son nombre, et le trait qui le majore dans l'infobulle
   — « le trait EST le nombre », comme sur la carte du plateau. */
function axeHtml(p, k, cls = 't-axe') {
  const st = tableStats(p);
  const tr = (st.traits || {})[k];
  const T = tr && TRAITS[tr];
  return `<span class="${cls}${T ? ' majore' : ''}" title="${esc(MT.AXE_MOT[k])}${T ? ` — ${T.icon} ${T.label} : +1` : ''}"><i>${k}</i><b>${st[k]}</b></span>`;
}
export const axesTableHtml = p => axesDe(p).map(k => axeHtml(p, k)).join('');

/* Le gabarit, le tir signature et l'habileté : ce qui nomme une pièce. Pas
   d'étiquette de trait à côté — ⚡ Vitesse et ⚡ Coup de patin se liraient
   comme un doublon, et le second vient du premier. */
export function tagsTableHtml(p, full = false) {
  const st = tableStats(p);
  const gab = MT.GABARITS[st.gb], tir = MT.TIRS[st.ts] || MT.TIRS.P;
  const hab = MT.HABILETES[MT.habileteDe(p)];
  const tag = (o, t) => `<span class="tag tag-table" title="${esc(t)}">${o.icon}${full ? ` ${esc(o.nom)}` : ''}</span>`;
  return [
    tag(gab, `${gab.nom} — ${gab.desc}`),
    p.p === 'G' ? '' : tag(tir, `${tir.nom} — ${tir.desc}`),
    hab ? tag(hab, `${hab.nom}, une fois par période — ${hab.desc}`) : '',
  ].join('');
}

/* Dans la case de l'alignement, étroite : les trois nombres qui décident
   d'un geste, serrés ; le patin et le souffle passent en étiquette. */
function slotAxesTexte(p) {
  const st = tableStats(p);
  // Neuf caractères tiennent sur la ligne d'une case de trio à 390 px, à
  // côté du visage — « TI2 MA2 FO6 » se coupait. Deux nombres par rôle ici,
  // les trois autres dans l'étiquette, qui se réduit à l'échelle.
  return p.p === 'G' ? `AR${st.AR}` : isD(p) ? `FO${st.FO} MA${st.MA}` : `TI${st.TI} MA${st.MA}`;
}
function slotAxesReste(p) {
  const st = tableStats(p);
  return p.p === 'G' ? '' : isD(p) ? `TI${st.TI} PA${st.PA} SO${st.SO}` : `FO${st.FO} PA${st.PA} SO${st.SO}`;
}

/*
 * LE TRI SUIT LE JEU. Trier sur les points, en mode Sur table, c'est trier
 * sur un nombre que le plateau ne lit pas. Les options du `<select>` sont
 * donc bâties d'ici, par mode, et un choix qui n'existe plus dans l'autre
 * mode retombe sur le premier de la liste.
 */
const SORTS_SAISON = [
  ['PTS', 'Points / %ARR'], ['PPG', 'Pts par match'], ['SAL', 'Salaire'], ['VAL', 'Pts par M$'],
  ['PM', 'Différentiel'], ['DEF', 'Défensive'], ['ROB', 'Robustesse'], ['AGE', 'Âge'], ['NAME', 'Nom'],
];
const SORTS_TABLE = [
  ['TI', 'Tir'], ['MA', 'Maniement'], ['FO', 'Force'], ['DE', 'Défense'], ['PA', 'Patin'], ['SO', 'Souffle'],
  ['SAL', 'Salaire'], ['NAME', 'Nom'],
];
export function syncSortOptions() {
  const sort = $('sortSelect');
  if (!sort) return;
  const jeu = surTable() ? 'table' : 'saison';
  const liste = surTable() ? SORTS_TABLE : SORTS_SAISON;
  if (sort.dataset.jeu !== jeu) {
    sort.innerHTML = liste.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    sort.dataset.jeu = jeu;
  }
  if (!liste.some(([v]) => v === G.sortBy)) { G.sortBy = liste[0][0]; saveOpts(); }
  sort.value = G.sortBy;
}

/** La fiche d'un joueur à ce jour, telle que le banc la lit : « 12-18-30 · +7 », « 14-6 · ,918 ». */
const nomDeFamille = n => String(n || '').trim().split(' ').pop();
function ficheDuJour(p) {
  // Un blessé : qui joue sa case ce soir ; un réserviste qui monte : où (`G.banc.remplace`, js/banc.js).
  if (G.banc && G.banc.remplace && G.banc.remplace.has(p)) { const q = G.banc.remplace.get(p); return q ? `${nomDeFamille(q.n)} le remplace` : 'personne pour le remplacer'; }
  const pour = G.banc && G.banc.monte && G.banc.monte.get(p);
  if (pour) { const sl = SLOTS.find(x => G.roster[x.i] === pour); return sl ? `Ce soir : ${slotShort(sl)}` : ''; }
  const c = G.banc && G.banc.compte.get(p);
  if (!c || !c.gp) return 'aucun match';
  // 1,000 : un blanchissage en début de saison s'écrivait « 1.000 » (le remplacement ne visait que « 0. »).
  // CHAQUE CHIFFRE DIT CE QU'IL EST (JP : *−3, ça veut dire quoi ?*) : « 0-1-1 · −3 » se lisait comme une pénalité.
  if (p.p === 'G') return `${c.w} V · ${c.l} D · ${c.sa ? pct3(c.sv / c.sa) : '—'}`;
  return `${c.g} B · ${c.a} A · diff. ${c.pm > 0 ? '+' : c.pm < 0 ? '−' : ''}${Math.abs(c.pm)}`;
}

function slotTags(p, zoneEcartTag, penTag) {
  if (surTable()) {
    // Le plateau ne lit ni zone ni pénalité : la case porte le gabarit, le
    // tir et l'habileté, et les deux nombres qui n'ont pas tenu sur la ligne.
    const st = tableStats(p);
    const gab = MT.GABARITS[st.gb], tir = MT.TIRS[st.ts] || MT.TIRS.P, hab = MT.HABILETES[MT.habileteDe(p)];
    const icones = [gab, p.p === 'G' ? null : tir, hab].filter(Boolean);
    return `<span class="slot-icones" title="${esc(icones.map(i => i.nom).join(' · '))}">${icones.map(i => i.icon).join('')}</span>`
      + (p.p === 'G' ? '' : `<span class="tag tag-table" title="${esc(isD(p) ? MT.AXE_MOT.TI : MT.AXE_MOT.FO)} · ${esc(MT.AXE_MOT.PA)} · ${esc(MT.AXE_MOT.SO)}">${slotAxesReste(p)}</span>`);
  }
  /*
   * SES RÔLES D'ABORD (S79). JP : *ce qu'on voit sur la page d'alignement …
   * ses icônes, ça doit aider à savoir d'un coup d'oeil ce que les joueurs
   * peuvent faire pour matcher comme des vraies lignes*. Le rôle premier et,
   * s'il en a un, le second : lus dans ses vraies stats, jamais une cote.
   */
  const [pp, r2] = badgesDe(p);
  const roles = pp ? `<span class="slot-roles" title="${esc(motDuBadge(pp))}${r2 ? ` · second badge : ${esc(motDuBadge(r2))}` : ''}"><i class="badge pal-${pp.palier}">${glyphe(pp.ico)}</i>${r2 ? `<i class="badge pal-${r2.palier}">${glyphe(r2.ico)}</i>` : ''}</span>` : '';
  // Les icônes, serrées, sans cadre : la case est étroite. Le survol donne le mot.
  const icones = getTraits(p).map(t => TRAITS[t.cle]);
  const compact = icones.length
    ? `<span class="slot-icones" title="${esc(icones.map(i => i.short).join(' · '))}">${icones.map(i => i.icon).join('')}</span>` : '';
  // LES VERDICTS D'ABORD (S78) : sa zone, puis ce qui cloche — c'est ce qu'on
  // lit pour ranger un alignement ; les icônes suivent, et c'est elles qui
  // rétrécissent quand la rangée déborde.
  return [roles, zoneTag(p, true), zoneEcartTag, penTag, compact]
    .filter(Boolean).slice(0, SLOT_TAGS_MAX).join('');
}

/*
 * LA CASE D'UN JOUEUR, SANS PHOTO (1.0, les lignes). JP : *au lieu des photos,
 * icônes et cote générale à sa position dans l'alignement*. Un joueur se lit
 * en trois choses (LIVRAISON.md, jalon C) : son RÔLE (une icône et un mot),
 * son NIVEAU (la pastille, son rang dans sa saison) et sa ZONE (✓ chez lui,
 * ▼ trop bas, ▲ trop haut) — plus ↔ hors poste, 🩹 blessé, un trophée s'il
 * en a un, et derrière le banc ses JAMBES. Sa production : ses PTS (ou V)
 * au repêchage, sa fiche à ce jour derrière le banc ; le visage et tout le reste sont dans la fiche, à un toucher.
 */
function celluleJoueur(p, s, { ecart, penTag, blesseTag }) {
  // LE RÔLE EN MOTS, COMME À LA SIGNATURE (Jalon U, JP : *refaire l'alignement plus comme la page signature*) : la même
  // étiquette que la rangée du vestiaire (`roleTag`) — « Passeur Or », le second badge en icône, les modifs posées.
  const tag = roleTag(p);
  const role = tag ? `<span class="slot-roles cell-role">${tag}</span>` : '';
  const zone = zoneTag(p, true);
  const marque = ecart === 'sous' ? `<span class="cell-zone sous" title="${esc(ZONE_SOUS_TITLE)}">▼</span>`
    : ecart === 'dessus' ? `<span class="cell-zone dessus" title="${esc(ZONE_DESSUS_TITLE)}">▲</span>`
    : '<span class="cell-zone ok" title="Dans sa zone : il rend à plein ici.">✓</span>';
  // TOUS SES TRAITS (1.0, R3), pas le premier seul : chacun joue dans le moteur (js/traits.js), chacun se voit.
  const traits = getTraits(p).map(x => TRAITS[x.cle]).filter(Boolean);
  const trophee = traits.length ? `<span class="cell-trait" title="${esc(traits.map(t => t.short || t.nom || '').join(' · '))}">${traits.map(t => t.icon).join('')}</span>` : '';
  const jambes = G.banc ? jambesHtml(G.banc.energie[getPlayerKey(p)] ?? 100, { gardien: p.p === 'G' }) : '';
  // SA PART DES DÉPARTS (V2.2) : la rotation suit les vrais matchs joués des deux gardiens ; la case le dit.
  const departs = s.group === 'G' && !s.scratch ? (() => {
    const d = partDesDeparts(G.roster), part = s.unit === 0 ? d.partant : d.aux;
    return part > 0 ? `<span class="cell-departs" title="La rotation lui donne cette part des départs : sa vraie saison (${p.gp || 0} matchs) contre celle de l'autre gardien.">${Math.round(part * 82)} départs</span>` : '';
  })() : '';
  // Trois rangées : le rôle et son mot ; le niveau et la zone ; le chiffre clé (sa fiche à ce jour derrière le banc).
  return `<div class="cell-l1">${role}</div>
        <div class="slot-tags cell-l2">${pastilleNiveau(p)}${blesseTag}${marque}${zone}${penTag}${trophee}${departs}</div>
        <div class="cell-l3"><span class="cell-prod slot-faits" title="${esc(G.banc ? 'Sa fiche à ce jour' : `Son chiffre clé : ${chiffreCle(p).mot}`)}">${G.banc ? esc(ficheDuJour(p)) : `<span class="pcard-big"><b>${esc(chiffreCle(p).v)}</b> <span>${esc(chiffreCle(p).u)}</span></span>`}</span>${!G.banc && p.p !== 'G' && chiffreCle(p).u !== 'PTS' ? `<small class="cell-sec" title="Ses points dans sa vraie saison">${displayStats(p).pt} pts · ${displayStats(p).ppgStr.replace('.', ',')}/m</small>` : ''}</div>
        ${jambes}`;
}

function slotEl(s) {
  const p = G.roster[s.i];
  const el = document.createElement('div');
  const adapt = p ? penaliteAffichee(p, s) : { pen: 0, base: 0, matchs: 0 };
  const pen = adapt.pen;

  el.className = 'slot'
    + (p ? '' : ' empty')
    + (G.selectedSlot === s.i ? ' selected' : '')
    + (!p && G.target === s.i ? ' target' : '')
    + (pen > 0 ? ' oop' : '');

  if (p) {
    el.style.setProperty('--slot-line', couleurVive(p.t));
    el.style.setProperty('--slot-fond', fondEquipe(p.t, 0.035) || '');
    const band = getTeamBand(p.t);
    el.style.setProperty('--slot-band', band.bg);
    el.style.setProperty('--slot-ink', band.ink);
    el.style.setProperty('--slot-stripe', band.stripe);
    const st = displayStats(p);
    // Le chiffre clé suit le rôle (`chiffreCle`, js/game.js) : ses punitions pour un bagarreur, ses mises en échec pour un checker.
    const cle = chiffreCle(p);
    const main = `${cle.v} ${cle.u}`;
    /* La case est étroite : la ligne de statistiques y tient en une seule,
       donc on abrège « PTS/M » en « /M ». La fiche donne le libellé complet.
       Quand le chiffre clé n'est pas ses points, ses points suivent. */
    const secondary = p.p === 'G' ? `${p.sv ?? '—'} %ARR` : cle.u === 'PTS' ? `${st.ppgStr}/M` : `${st.pt} PTS`;
    // Sur table : les nombres du plateau, et rien de ce qu'il ne lit pas.
    // Derrière le banc : la fiche À CE JOUR, jamais celle de fin de saison.
    const ligneStats = G.banc ? ficheDuJour(p) : surTable() ? slotAxesTexte(p) : `${main} · ${secondary}`;
    const blesseTag = G.banc && G.banc.blesses.has(p)
      ? `<span class="tag tag-pen" title="Blessé : il lui reste ${G.banc.blesses.get(p)} match${G.banc.blesses.get(p) > 1 ? 's' : ''}. Un réserviste prend sa place le soir du match.">🩹 ${G.banc.blesses.get(p)}</span>` : '';
    // LA LANCÉE (V3.6, Rogue) : son état au prochain match, en un mot ; le détail est dans les règles.
    const lancee = G.banc && G.banc.lancees ? G.banc.lancees.get(p) : null;
    const lanceeTag = !lancee ? '' : lancee === 'doute'
      ? '<span class="tag tag-doute" title="Il doute : un vrai marqueur sans but depuis dix matchs finit moins bien, jusqu\'à son prochain but">Doute</span>'
      : `<span class="tag tag-lancee" title="${lancee === 'vive' ? 'Sur une lancée vive (l\'étincelle) : il finit beaucoup mieux tant qu\'il marque' : 'Sur sa lancée : il finit mieux tant qu\'il marque'}">${lancee === 'vive' ? '☄ Vive' : 'Lancée'}</span>`;
    /* HORS POSTE, EN MOTS (JP : *−3, ça veut dire quoi ? Ya même pas de overall aux joueurs*). Le chiffre de la
       pénalité est sur l'échelle des cotes, qu'aucun écran ne montre : la case porte ↔, le signe du jeu pour
       « hors de sa position » (js/gerant.js), et l'infobulle dit s'il s'y adapte, sans chiffre. */
    const penTag = !surTable() && pen > 0 ? `<span class="tag tag-pen" title="${adapt.matchs ? `Hors de sa position naturelle, mais il s'y adapte : la pénalité fond en jouant ici (${adapt.matchs} m.)` : 'Hors de sa position naturelle : il rend moins ici, et s\'y fera en jouant là'}">↔</span>` : '';
    const ecart = zoneEcart(p, s);
    /* Une flèche seule : « ▼ zone » et « ▲ zone » poussaient la pénalité de
       position hors de la case sur les écrans où un trio n'a que cent pixels
       par joueur. L'infobulle dit la phrase entière. */
    const zoneEcartTag = surTable() ? '' : ecart === 'sous' ? `<span class="tag tag-pen" title="${esc(ZONE_SOUS_TITLE)}">▼</span>`
      : ecart === 'dessus' ? `<span class="tag tag-zone-up" title="${esc(ZONE_DESSUS_TITLE)}">▲</span>` : '';
    if (estRenfort(p)) el.classList.add('renfort');
    /*
     * LA CASE D'ABORD LISIBLE (S78). JP : *améliorer l'alignement pour que
     * l'information soit plus claire, quitte à être moins beau et complexe*.
     * La case était une carte en miniature : un visage de 34 px, le poste
     * DEUX fois (la pastille de la case et « AG / AD » dans la ligne), le club
     * deux fois (l'écusson et « EDM '94 »), et un nom de famille qui n'avait
     * que 60 px — six noms coupés à 390 px, dix à 1 280. Elle garde ce qui
     * DÉCIDE d'un alignement, chacun une fois, dans cet ordre de lecture :
     *   1. la bande : la case qu'il occupe (sa pastille), son salaire ;
     *   2. son NOM, sur toute la largeur de la case, l'écusson de son club devant (U19) ;
     *   3. sa production (au repêchage) ou sa fiche à ce jour (derrière le banc) ;
     *   4. les verdicts : 🩹 blessé, sa zone (T1-3), ▼ ▲ hors de sa zone, −N
     *      hors position, puis ses icônes.
     * Le visage, la saison et ses positions naturelles sont dans la fiche, à un
     * toucher. Une case n'est PAS debout comme la carte du vestiaire : trois
     * cartes debout par trio feraient un alignement trois fois plus haut, qu'on
     * ne lirait plus d'un coup d'oeil. Elle reste une carte par sa bande aux
     * couleurs du club et son cadre ; une variante brillante y garde un liseré.
     */
    const rarete = rareteJoueur(p);
    el.classList.add('cj-case', `tc-${rarete}`);
    if (ecart === 'sous') el.classList.add('sous-zone');
    // LA CARTE QU'ON VIENT DE SIGNER ENTRE DANS LE CARTABLE (S77) : sa case
    // luit une fois, là où elle vient d'arriver. Rien ne se rejoue au rendu
    // suivant : l'horodatage vieillit.
    if (G.dernierSigne && G.dernierSigne.p === p && Date.now() - G.dernierSigne.t < 1500) el.classList.add('cj-arrive');
    // EN ROGUE (S80), le ✕ RELÂCHE un réserviste — avant la saison comme derrière le banc ; un habillé ne se retire pas (rien ne comblerait sa case).
    const relachable = G.bonus === 'ROGUE' && s.scratch && !estRenfort(p);
    el.innerHTML = `
      ${relachable ? `<button class="slot-remove slot-relacher" title="Relâcher ${esc(p.n)} : sa carte va à ton cartable" aria-label="Relâcher ${esc(p.n)}">✕</button>`
        : estRenfort(p) || G.banc || G.bonus === 'ROGUE' ? ''
        : `<button class="slot-remove" title="Retirer ${esc(p.n)}" aria-label="Retirer ${esc(p.n)}">✕</button>`}
      <div class="slot-band${estRenfort(p) ? ' off' : ''}">
        <span class="sb-role ${positionClass(p)}" title="Ses positions : ${esc(positionLabel(p))} — ce qu'il peut jouer (la case, elle, se lit à sa place dans le trio)">${esc(positionLabel(p).split(' / ').join('/'))}</span>
        ${estRenfort(p)
          ? '<span class="slot-salary renfort" title="Fourni par ton club de renfort : ne coûte rien au plafond et ne se modifie pas.">renfort</span>'
          : `<span class="slot-salary">${st.salaryMain}</span>`}
      </div>
      <div class="slot-inner">
        <span class="slot-mug" aria-hidden="true">${headshotHtml(p)}</span>
        <span class="slot-qui"><span class="slot-logo" aria-hidden="true">${getTeamLogoHtml(p.t, 20)}</span><button type="button" class="slot-name lien-joueur slot-fiche" title="Sa carte">${formatName(p.n)}</button></span>
        ${surTable() ? `<div class="slot-meta slot-faits">${ligneStats}</div>
        <div class="slot-tags">${blesseTag}${slotTags(p, zoneEcartTag, penTag)}</div>` : celluleJoueur(p, s, { ecart, penTag, blesseTag: blesseTag + lanceeTag })}
      </div>`;
    // LE NOM OUVRE SA CARTE (1.0, JP : *dans alignement, peser sur nom ouvre carte*). Le reste de
    // la case garde son geste : la toucher la choisit pour déplacer ou permuter.
    el.querySelector('.slot-fiche')?.addEventListener('click', ev => { ev.stopPropagation(); ouvrirCarteDe(p); });
    el.querySelector('.slot-relacher')?.addEventListener('click', ev => { ev.stopPropagation(); relacherReserviste(s); });
    el.querySelector('.slot-remove:not(.slot-relacher)')?.addEventListener('click', ev => {
      ev.stopPropagation();
      delete G.roster[s.i];
      G.selectedSlot = null;
      // Le tour est déjà joué : la prochaine signature comble cette case sans
      // faire tourner la roulette. Sans ça, « signer le moins cher puis ✕ »
      // était un « Passer » gratuit et illimité.
      if (!estRenfort(p)) G.dette++;
      saveGame();
      render();
      toast(`${p.n} retiré. ${money(capLeft())} de disponible, `
        + `et la roulette ne tournera pas pour cette case.`, 'warn');
    });
  } else if (G.bonus === 'ROGUE' && s.extra && !caseOuverte(s)) {
    // UNE CASE DE RÉSERVE À DÉBLOQUER (S80) : visible, grisée, et elle dit où la débloquer.
    el.classList.add('verrou');
    el.innerHTML = `<div class="slot-role">🔒 ${esc(s.role)}</div><div class="slot-sub">Aux déblocages</div>`;
    el.onclick = () => toast('Cette case de réserve se débloque aux déblocages, dans le menu (ou par un jalon).');
    return el;
  } else if (G.bonus === 'ROGUE' && s.scratch) {
    el.innerHTML = `<div class="slot-role">${esc(s.role)}</div><div class="slot-sub">Case libre</div>`;
  } else {
    // Sur table, la case vide ne promet pas de zone : le plateau n'en lit pas.
    el.innerHTML = `<div class="slot-role">${esc(s.role)}</div><div class="slot-sub">${surTable() ? '' : esc(s.label)}</div>`;
  }

  el.onclick = () => {
    if (estRenfort(p)) { toast('Les renforts sont fournis : tu ne peux pas les déplacer.', 'warn'); return; }
    if (G.selectedSlot !== null) {
      if (G.selectedSlot === s.i) {
        G.selectedSlot = null;
      } else {
        const src = G.selectedSlot;
        const a = G.roster[src], b = G.roster[s.i];
        // Refuser un déplacement qui viole le groupe de poste (D vers F, G vers D…)
        if (a && !fits(a, s)) {
          G.selectedSlot = null;
          toast(`${a.n} ne peut pas jouer à ce poste.`, 'bad');
          render();
          return;
        }
        if (b && SLOTS[src] && !fits(b, SLOTS[src])) {
          G.selectedSlot = null;
          toast(`${b.n} ne peut pas jouer à ce poste.`, 'bad');
          render();
          return;
        }
        if (a) G.roster[s.i] = a; else delete G.roster[s.i];
        if (b) G.roster[src] = b; else delete G.roster[src];
        // RANGER NE RECOMPOSE PAS LA MAIN (S71) : si le déplacement remplit la
        // case de la main, l'épingle passe à la case libérée, du même poste.
        if (MODE().loto && G.mainCase === s.i && !G.roster[src] && SLOTS[src] && SLOTS[src].role === SLOTS[s.i].role) G.mainCase = src;
        G.selectedSlot = null;
        G.target = null;
        saveGame();
      }
    } else if (p) {
      G.selectedSlot = s.i;
      toast('Touche une autre case pour déplacer ou permuter.');
    } else if (G.bonus === 'ROGUE') {
      // En saison, le Rogue n'a pas de vestiaire où piger (son repêchage vient entre deux saisons) : une case libre se remplit à la boutique, ou en y déplaçant un joueur.
      toast('Case libre : un joueur signé à la boutique pourra y entrer sans que personne sorte. Tu peux aussi y déplacer un joueur.');
      return;
    } else {
      G.target = (G.target === s.i ? null : s.i);
      // Retirer sa visée rend la main à la première case vide.
      if (G.target === null) { G.mainCase = null; G.mainRang = null; }
      if (G.target !== null) {
        setView('pool');
        toast(`Case ciblée : ${slotShort(s)}. ${MODE().loto ? 'Les trois clubs te tendent leur joueur de cette case.' : 'Les signatures iront là.'}`);
      }
    }
    render();
  };
  return el;
}

/*
 * Titres des rangées du tableau de profondeur. On les nomme par leur RANG —
 * 1er trio, 2e paire — et non par leur zone : deux rangées s'appelaient
 * « Top 6 » et deux autres « Top 4 », si bien qu'on ne savait plus laquelle
 * on regardait. La zone reste écrite sur la case vide et sur l'étiquette du
 * joueur, là où elle sert à décider.
 */
export const UNIT_NAMES_F = ['1er trio', '2e trio', '3e trio', '4e trio'];
export const UNIT_NAMES_D = ['1re paire', '2e paire', '3e paire'];

/*
 * LA PUCE D'ORIGINE (1.0). Ce que l'unité a en commun, sans chiffre (la carte les porte) : au plus deux
 * mots, du plus rare au plus courant. Les icônes sont celles des cartes d'origine (js/combat.js).
 */
function puceOrigine(o, group) {
  if (!o) return '';
  const mots = [];
  if (o.ligneOrigine) mots.push(['🧩', group === 'D' ? 'Paire d\'origine' : 'Ligne d\'origine', 'Tous du même club, la même saison : la carte « La ligne d\'origine » la paie.']);
  else if (o.coequipiers) mots.push(['👬', 'Coéquipiers', 'Deux vrais coéquipiers (même club, même saison) : la carte « Les vrais coéquipiers » les paie.']);
  if (!o.ligneOrigine && o.famille) mots.push(['🎽', 'Même franchise', 'Tous de la même franchise, d\'une époque ou d\'une autre : « La même famille » et « La dynastie de club » la comptent.']);
  if (o.decennie != null && mots.length < 2) mots.push(['🕰', `Années ${String(o.decennie).slice(2)}`, 'Trois joueurs de la même décennie : la carte « La décennie » les paie.']);
  return mots.slice(0, 2).map(([ico, mot, titre]) => `<span class="line-orig" title="${esc(titre)}">${ico} ${esc(mot)}</span>`).join('');
}

/*
 * LES LIENS (V6, phase 3). JP : *trouver des synergies*. Entre deux voisins d'une unité, une pastille dit ce qui les
 * lie — 👬 de vrais coéquipiers, 🎽 la même franchise — et, touchée, ce que ce lien rapporte.
 * Rien qu'une lecture (`lienDePaire`, js/sim.js) : l'origine se paie par sa carte.
 */
function liensEntre(a, b) {
  const L = lienDePaire(a, b), out = [];
  const court = p => String(p.n || '').trim().split(' ').pop();
  const qui = `${court(a)} et ${court(b)}`;
  if (L.coequipiers) out.push(['👬', `${qui} : coéquipiers pour vrai (${a.t} ${a.s}). La carte 👬 Les vrais coéquipiers les paie.`]);
  else if (L.famille) out.push(['🎽', `${qui} : la même franchise. La carte 🎽 La même famille les compte.`]);
  return out;
}
function poserLiens(row, slots) {
  const cases = [...row.children];
  row.style.setProperty('--n', slots.length);
  const pastille = (i, j) => {
    const a = G.roster[slots[i].i], b = G.roster[slots[j].i];
    if (!a || !b || a.p === 'G' || b.p === 'G') return null;
    const liens = liensEntre(a, b);
    if (!liens.length) return null;
    const texte = liens.map(l => l[1]).join(' ');
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'lien';
    el.textContent = liens.map(l => l[0]).join('');
    el.title = texte;
    el.setAttribute('aria-label', texte);
    el.onclick = ev => { ev.stopPropagation(); toast(texte); };
    return el;
  };
  for (let i = 0; i + 1 < slots.length; i++) {
    const el = pastille(i, i + 1);
    if (!el) continue;
    // Entre les deux cases : sous la première en rangée (le téléphone), sur l'écart des deux en colonnes.
    const place = document.createElement('span');
    place.className = 'lien-place';
    place.style.setProperty('--k', i + 1);
    place.appendChild(el);
    cases[i].after(place);
  }
  // LES DEUX AILIERS (JP : *pourquoi un LW et un RW peuvent pas avoir d'affinités ?*). Le moteur compte l'entente de
  // chaque paire du trio, les ailiers aussi : leur pastille se pose sur la case du centre, qui est entre eux.
  if (slots.length === 3) {
    const el = pastille(0, 2);
    if (el) { el.classList.add('lien-ailes'); cases[1].appendChild(el); }
  }
}
function lineEl(title, slots, group, unit, cls = '') {
  const wrap = document.createElement('div');
  wrap.className = 'line';
  // L'onglet du téléphone (style.css, body[data-effectif]) : l'attaque, la défense, ou le filet et la réserve.
  wrap.dataset.groupe = group === 'F' || group === 'D' ? group : 'G';

  let chemHtml = '<span class="line-chem">incomplet</span>';
  // Sur table, pas de chimie : le plateau joue chaque pièce sur ses nombres,
  // et annoncer « +2/+2 » serait promettre un bonus que rien n'applique.
  if (group != null && !surTable()) {
    /*
     * LA LIGNE, DANS LA LANGUE DES LIGNES (S72). L'en-tête d'un trio disait
     * « Trio complet · optimal +2/+2 » — une autre chimie que celle de « Mes
     * lignes ». Il dit si ses joueurs sont à leur place ; la paire aussi.
     * La tactique et le fit ne s'y écrivent plus depuis S78 : ils ont leur
     * tiroir sous le trio (`strategieDeLigne`), et l'en-tête les répétait —
     * coupés, en plus, à 1 280 px (« ⚠ un joueur ma… »).
     */
    const syn = getUnitSynergy(G.roster, group, unit);
    const filled = slots.filter(s => G.roster[s.i]).length;
    const place = syn.zoneEtat === 'optimal' ? '✨ à leur place' : syn.zoneEtat === 'hors' ? '🚨 hors de leurs lignes' : syn.zoneEtat === 'mal' ? '⚠ un joueur mal placé' : '';
    if (filled === slots.length) {
      const kind = syn.zoneEtat === 'optimal' ? 'good' : syn.zoneEtat ? 'bad' : '';
      if (kind) wrap.classList.add(kind);
      chemHtml = place ? `<span class="line-chem ${kind}" title="${kind === 'good' ? 'Chacun joue dans sa zone : l\'unité rend à plein.' : 'Au moins un joueur joue hors de sa zone : voir ▼ ▲ sur sa case.'}">${esc(place)}</span>` : '';
    } else {
      chemHtml = `<span class="line-chem">${filled}/${slots.length} comblés</span>`;
    }
  } else {
    // Une case cadenassée (S80, le Rogue) ne compte pas : elle n'est pas à combler.
    const filled = slots.filter(s => G.roster[s.i]).length, ouvertes = slots.filter(caseOuverte).length;
    chemHtml = `<span class="line-chem">${filled}/${ouvertes} comblés</span>`;
  }

  // L'appariement et la glace (V6) vivent dans l'onglet Équipe, au plan de match : l'unité ne les répète pas.
  // QUI EST CETTE UNITÉ (S79) : « Trio de snipers », « Paire classique » — les icônes sont dans les cases.
  const id = (group === 'F' || group === 'D') && !surTable() ? identiteUnite(G.roster, group, unit) : null;
  const idHtml = id ? `<span class="line-id" title="${esc(id.roles.join(' · '))}">${esc(id.nom)}</span>` : '';
  // D'OÙ ILS VIENNENT (1.0) : la puce se voit même sans la carte, pour qu'on apprenne à bâtir pour elle ; la carte d'origine la paie.
  const orig = (group === 'F' || group === 'D') && !surTable() ? puceOrigine(origineUnite(G.roster, group, unit), group) : '';
  /*
   * CE QUE L'UNITÉ PRODUIT (1.0). JP : *la stat unique par joueur, je trouve pas utile pour savoir si le trio va
   * produire*. Un bagarreur lit ses punitions, un checker ses mises en échec : ça dit son métier, pas la production
   * du trio. L'en-tête additionne donc les points par match des joueurs habillés, dans leur vraie saison — une vraie
   * stat, jamais une cote — dès que l'unité est complète.
   */
  const patineurs = (group === 'F' || group === 'D') && !surTable() ? slots.map(s => G.roster[s.i]).filter(p => p && p.p !== 'G') : [];
  // Derrière le banc, LE CHIFFRE DU MOTEUR (V6) remplace les points additionnés : il suit le système et les cases.
  const note = (group === 'F' || group === 'D') && patineurs.length === slots.length ? noteDesUnites() : null;
  const u = note ? (group === 'D' ? note.D : note.F)[unit] : null;
  // Ses vraies stats sur la glace (V7, JP : *des lancers, précision de lancer, pourcentage d'arrêt*) : à forces égales, par match.
  // Dites en mots (oct., JP : *je comprends pas les tirs rouges et verts*) : « 5,7–8,0 » se lisait comme un intervalle, et
  // le sens ne vivait que dans une bulle qu'un téléphone n'ouvre pas. Ses tirs, en vert s'il en tire plus qu'il en donne.
  const st = u && u.stats;
  const prodHtml = st && st.tirs + st.contre > 0
    ? `<span class="line-net" title="${esc(`Sur la glace, à forces égales, par match contre ${teamShort(G.banc.prochain.adv)} : ${v1(st.tirs)} tirs (${v1(st.pctTir * 100)} % de précision), ${v1(st.contre)} tirs contre (${pct3(st.pctArr)} d'arrêts).`)}">Tirs <b class="${st.tirs >= st.contre ? 'bon' : 'mauvais'}">${v1(st.tirs)}</b> pour · <b>${v1(st.contre)}</b> contre</span>`
    : patineurs.length && patineurs.length === slots.length
    ? `<span class="line-prod" title="Ce que ${group === 'D' ? 'la paire' : 'le trio'} a produit dans ses vraies saisons : les points par match des ${patineurs.length} additionnés. Une vraie stat, pas une cote.">${patineurs.reduce((a, p) => a + (displayStats(p).ppg || 0), 0).toFixed(1).replace('.', ',')} pts/m</span>`
    : '';
  wrap.innerHTML = `<div class="line-head"><span class="line-name">${esc(title)}</span>${idHtml}${prodHtml}${orig}${chemHtml}</div>`;
  // UN TOUCHER SUR L'EN-TÊTE OUVRE LE SYSTÈME DE L'UNITÉ (1.0, les lignes).
  if ((group === 'F' || group === 'D') && !surTable()) {
    const tete = wrap.querySelector('.line-head');
    tete.classList.add('line-head-regle');
    tete.title = `Régler le système ${group === 'D' ? 'de la paire' : 'du trio'}`;
    tete.onclick = () => ouvrirReglage(unit, group);
  }
  const row = document.createElement('div');
  row.className = 'line-slots' + (cls ? ' ' + cls : '');
  slots.forEach(s => row.appendChild(slotEl(s)));
  if ((group === 'F' || group === 'D') && !surTable()) poserLiens(row, slots);
  wrap.appendChild(row);
  // LA STRATÉGIE SOUS SON TRIO (S78 ; en fenêtre depuis 1.0). Sur table, rien :
  // le plateau ne lit ni tactique ni glace.
  if ((group === 'F' || group === 'D') && !surTable()) wrap.appendChild(rangeeStrategie(unit, group));
  return wrap;
}

/*
 * LA NOTE QUI BOUGE (V6). Derrière le banc, ce que le moteur ferait de chaque unité contre ton prochain
 * adversaire, sur tes cases d'aujourd'hui (le blessé cède la sienne) et tes lignes en vigueur (js/impact.js
 * `unitesDuSoir`). Une lecture par rendu : la mémoire d'impact.js la garde le temps d'un écran.
 */
function noteDesUnites() {
  const b = G.banc, L = G.ligue;
  if (!b || !L || !L.you || !b.prochain || surTable()) return null;
  try {
    const lu = activeLineup({ ...L.you, roster: G.roster, injured: b.blesses, jourCourant: b.jour });
    // Le plan de match du banc (V6), posé le temps de la lecture : l'appariement et la glace qu'on essaie.
    return auSoirDuBanc(L.you, () => unitesDuSoir(L.you, lu, b.prochain.adv, b.lignes));
  } catch { return null; }
}

/*
 * LA STRATÉGIE D'UNE UNITÉ (S78 ; en fenêtre depuis 1.0). JP : *au lieu de
 * dropdown, modal*. Sous chaque trio et chaque paire, une rangée dit le
 * système, le fit et la glace ; la toucher (ou toucher l'en-tête de l'unité)
 * ouvre la fenêtre de réglage (`ouvrirStrategie`, js/gerant.js). Rien ne
 * s'applique avant « Appliquer » : avant la saison le réglage va dans
 * `G.lignes` (sauvegardé), derrière le banc dans `G.banc.lignes`, qui part
 * avec la décision au « Retour au match ».
 */
/*
 * LEURS LIGNES CE SOIR. Un gros match (et chaque match de série) a son dépistage : ses lignes se lisent SOUS LE PLAN LE
 * PLUS PROBABLE (le vrai reste caché), sur l'alignement qui jouera, et l'écran dit « selon le dépistage ».
 */
const lignesEnFace = b => (b.depistage
  ? lignesDeGros(b.prochain.adv, activeLineup(b.prochain.adv), planProbable(b.depistage))
  : lignesDe(b.prochain.adv, b.prochain.adv.roster));
function specStrategie() {
  const b = G.banc;
  if (!b) return { lineup: G.roster, lignes: lignesDe({ lignes: G.lignes }, G.roster), adv: null };
  return {
    lineup: G.roster, lignes: b.lignes,
    adv: b.prochain ? { nom: teamShort(b.prochain.adv), lignes: lignesEnFace(b), selonDepistage: !!b.depistage } : null,
  };
}
function rangeeStrategie(unit, groupe = 'F') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `ln-strat ln-som${groupe === 'D' ? ' ln-strat-d' : ''}`;
  b.dataset.u = unit;
  b.dataset.g = groupe;
  b.innerHTML = strategieDeLigne(specStrategie(), unit, false, groupe).sommaire;
  b.onclick = () => ouvrirReglage(unit, groupe);
  return b;
}
function ouvrirReglage(unit, groupe) {
  // La glace du système montre les visages (js/gerant.js, `glaceHtml`).
  const spec = { ...specStrategie(), visage: headshotHtml };
  ouvrirStrategie(spec, unit, groupe, ligne => {
    const lignes = spec.lignes.map(l => ({ ...l }));
    lignes[unit] = { ...lignes[unit], ...ligne };
    if (G.banc) G.banc.lignes = lignes;
    else { G.lignes = lignes; saveGame(); }
    render();
  });
}

/*
 * ALIGNER AU MIEUX (oct.). JP : *ajouter bouton best lines et best strategy dans l'alignement pour éviter le
 * gossage ; plusieurs best : défensive, offensive*. Un bouton, une fenêtre : le meilleur alignement (trios et
 * systèmes), penché vers l'attaque ou la défense, ou seulement les trios, ou seulement les systèmes (js/sim.js
 * `lignesAuMieux` ; js/impact.js `alignementAuMieux`). JP : *considérer positions, stratégie, etc.* : les trios
 * lisent le poste et le côté, la zone de chacun, les minutes de la ligne et le système qu'elle jouera, et le moteur
 * tranche sur les buts d'un soir ; jamais pire que l'alignement de l'IA. Derrière le banc, un blessé reste en réserve, et rien
 * ne joue avant « Retour au match ».
 */
const AU_MIEUX = [
  { cle: 'equilibre', ico: '🤖', nom: 'Le meilleur alignement', sous: 'Chacun à son poste et dans sa zone, des trios qui jouent un système ensemble.' },
  { cle: 'offensif', ico: '⚔', nom: 'Offensif', sous: 'Tes marqueurs en haut, et les systèmes qui tirent.' },
  { cle: 'defensif', ico: '🛡', nom: 'Défensif', sous: 'Tes défensifs en haut, et les systèmes qui ferment.' },
  { cle: 'trios', ico: '👥', nom: 'Seulement les trios', sous: 'Les meilleurs à chaque case ; tes systèmes ne bougent pas.' },
  { cle: 'systemes', ico: '📋', nom: 'Seulement les systèmes', sous: 'Le système qui va à chaque ligne ; tes joueurs ne bougent pas.' },
];
function alignerAuMieux(cle) {
  const style = cle === 'trios' || cle === 'systemes' ? 'equilibre' : cle;
  // En Rogue, le système paie sa famille (V9) : le meilleur alignement est celui de ton plan, comme ton coach le compte.
  const plan = G.bonus === 'ROGUE', club = clubLu(), coachs = (club && club.team && club.team.coachs) || [];
  if (cle !== 'systemes') {
    const tous = SLOTS.map(s => G.roster[s.i]).filter(Boolean);
    const blesse = p => !!(G.banc && G.banc.blesses && G.banc.blesses.has(p));
    const roster = alignementAuMieux(tous.filter(p => !blesse(p)), style, { plan, coachs });
    // Les autres (blessés, surplus) vont en réserve, dans les cases ouvertes ; sans place pour tous, rien ne bouge.
    const places = new Set(Object.values(roster));
    const reste = tous.filter(p => !places.has(p)), libres = SLOTS.filter(s => s.scratch && caseOuverte(s) && !roster[s.i]);
    if (reste.length > libres.length) { toast('Pas assez de cases de réserve pour réaligner : rien n\'a bougé.', 'bad'); return; }
    reste.forEach((p, k) => { roster[libres[k].i] = p; });
    /*
     * EN PLACE, JAMAIS UN OBJET NEUF (V4.4). JP : *des fois, le joueur pigé d'un pack s'ajoute pas*. En pleine saison,
     * `G.roster` est l'objet même que le moteur aligne (`appliquerAlignement`). Le remplacer détachait l'écran du
     * moteur : la signature suivante entrait dans l'alignement du moteur, pas dans celui qu'on voit, et la photo du
     * banc d'après l'en retirait pour de bon.
     */
    for (const k of Object.keys(G.roster)) delete G.roster[k];
    Object.assign(G.roster, roster);
  }
  if (cle !== 'trios') {
    const lignes = lignesAuMieux(G.roster, style, { plan, coachs });
    if (G.banc) G.banc.lignes = lignes; else G.lignes = lignes;
  } else if (!G.banc) G.lignes = null;   // de nouveaux trios, les systèmes que l'IA leur ferait
  saveGame();
  render();
  toast(`${AU_MIEUX.find(x => x.cle === cle).nom} : c'est fait.${G.banc ? ' Il joue dès que tu quittes les Lignes.' : ''}`);
}
function boutonAuMieux() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn ln-auto';
  b.innerHTML = '🤖 Aligner au mieux';
  b.onclick = () => ouvrirChoix({
    ico: '🤖', titre: 'Aligner au mieux', fermable: true, motFermer: 'Retour',
    recit: 'Poste, côté, zone et système, pesés ensemble. Tu peux tout retoucher après.',
    options: AU_MIEUX.map(x => ({ cle: x.cle, ico: x.ico, nom: x.nom, sous: x.sous })),
    onChoix: alignerAuMieux,
  });
  return b;
}

/*
 * LE PLAN DE MATCH (V6, docs/refonte-v6.md). JP : *donner des stratégies à chaque trio et devoir construire autour de
 * ça, avec matching de trios à domicile* ; *le matching de trio dans une liste, et la répartition du temps dans une
 * autre, overall, au lieu de par ligne. À l'étranger, l'adversaire fait de même* ; *garder les stratégies, matching,
 * répartition, mais streamline pour plus de facilité de gestion*. Derrière le banc, un seul panneau : la glace du club
 * (les trois roulements) et l'appariement (contre chacun de leurs trios, lequel des tiens — A : par rang). Ton choix
 * contre leur 1er trio est ton trio de fermeture. Chez eux, c'est leur plan qui joue (`profilMatch(...).plan`), et le
 * panneau le dit. Chaque toucher rejoue la note des unités.
 */
const ORD_TRIO = ['1er', '2e', '3e', '4e'];
/* Les minutes à forces égales du soir, lues au moteur (ni avantage ni désavantage : tes unités spéciales ont les leurs). */
const minutesFEduSoir = () => avecLeBanc((you, lu, adv, aVenir) => chiffresDuSoir(you, lu, adv, aVenir).minutesFE) || 60;
/* LA GLACE EN MINUTES (V6, JP : *des temps par trio genre 60-50-40-30* ; V7 : à forces égales, la part que le moteur joue) : ce qu'un roulement donne à chaque trio, coachs et patrons compris. */
const minutesDuRoulement = (k, fe) => partsDuRoulement(PART_UNITE.F, 'F', { ...G.ligue.you, roulement: k }).map(x => Math.round(fe * x));
function planDeMatchEl() {
  const b = G.banc, fe = minutesFEduSoir();
  const el = document.createElement('section');
  el.className = 'plan-match';
  const adv = b.prochain.adv;
  const leurs = lignesEnFace(b), miennes = b.lignes || [];
  const ico = l => (l && TACTIQUES[l.tac] ? TACTIQUES[l.tac].ico : '');
  const app = b.appariement || [-1, -1, -1, -1];
  // Chez eux : le plan que leur entraîneur t'impose ce soir.
  let chezEux = '';
  if (!b.prochain.domicile) {
    try {
      const pl = profilMatch(adv, activeLineup(adv), G.ligue.you).plan;
      if (pl) chezEux = `<div class="pm-eux-plan">Chez eux, leur plan joue : ${pl.map((m, r) => (m >= 0 ? `ton ${ORD_TRIO[r]} ${ico(miennes[r])} ↔ leur ${ORD_TRIO[m]} ${ico(leurs[m])}` : '')).filter(Boolean).slice(0, 2).join(' · ')}</div>`;
    } catch { chezEux = ''; }
  }
  // CE QUE LE PLAN FAIT À TES TRIOS (V6, JP : *si ton deuxième est contre le premier, peut-être que la 3 et 4 peuvent
  // scorer plus contre de moins bons trios*) : la note des quatre, rejouée à chaque toucher. Chez toi seulement : chez eux, leur plan joue.
  const note = b.prochain.domicile ? noteDesUnites() : null;
  const notesHtml = note && note.F.length ? `<div class="pm-k">Tes trios ce soir · leurs tirs</div><div class="pm-notes">${note.F.map((x, u) => `<span class="${x.stats.tirs >= x.stats.contre ? 'bon' : 'mauvais'}" title="${esc(`${v1(x.stats.pctTir * 100)} % de précision, ${pct3(x.stats.pctArr)} d'arrêts`)}">${u + 1}${ico(miennes[u])} ${v1(x.stats.tirs)} pour · ${v1(x.stats.contre)} contre</span>`).join('')}</div>` : '';
  el.innerHTML = `<div class="pm-tete"><b>Plan de match</b><span>${esc(teamShort(adv))} · ${b.prochain.domicile ? 'chez toi : ton plan joue' : 'chez eux'}${b.depistage ? ' · selon le dépistage' : ''}</span></div>
    <div class="pm-k">Glace à forces égales · minutes du 1er au 4e trio</div>
    <div class="pm-seg pm-glace">${Object.entries(ROULEMENTS).map(([k, R]) => `<button type="button" class="pm-btn${b.roulement === k ? ' on' : ''}" data-roul="${k}" aria-pressed="${b.roulement === k}" title="${esc(`${R.ico} ${R.nom} : ${R.bon}. ${R.prix}.`)}">${minutesDuRoulement(k, fe).join(' · ')}</button>`).join('')}</div>
    <div class="pm-k">Appariement</div>
    ${[0, 1, 2, 3].map(r => `<div class="pm-app"><span class="pm-leur">Leur ${ORD_TRIO[r]} ${ico(leurs[r])}</span><span class="pm-seg">${[-1, 0, 1, 2, 3].map(m => `<button type="button" class="pm-btn${app[r] === m ? ' on' : ''}" data-app="${r}:${m}" aria-pressed="${app[r] === m}" title="${m < 0 ? 'Par rang, comme le veut la rotation' : `Ton ${ORD_TRIO[m]} trio`}">${m < 0 ? 'A' : `${m + 1}${ico(miennes[m])}`}</button>`).join('')}</span></div>`).join('')}
    ${notesHtml}${chezEux}
    ${consigneHtml()}${filetHtml()}`;
  el.querySelectorAll('[data-roul]').forEach(x => { x.onclick = () => { b.roulement = x.dataset.roul; render(); }; });
  el.querySelectorAll('[data-consigne]').forEach(x => { x.onclick = () => { b.match = { importance: x.dataset.consigne, ad: AD_DE_CONSIGNE[x.dataset.consigne] }; render(); }; });
  el.querySelectorAll('[data-filet]').forEach(x => { x.onclick = () => { b.filet = x.dataset.filet; render(); }; });
  el.querySelectorAll('[data-app]').forEach(x => {
    x.onclick = () => {
      const [r, m] = x.dataset.app.split(':').map(Number);
      const a = (b.appariement || [-1, -1, -1, -1]).slice();
      // Un trio n'affronte qu'un des leurs : celui qu'on prend ailleurs y revient à « A ».
      if (m >= 0) a.forEach((v, k) => { if (v === m) a[k] = -1; });
      a[r] = m;
      b.appariement = a.some(v => v >= 0) ? a : null;
      b.fermeture = b.appariement && b.appariement[0] >= 0 ? b.appariement[0] : 'auto';
      render();
    };
  });
  return el;
}

/*
 * TES UNITÉS SPÉCIALES (V7, JP : *créer lignes avantages numériques à part*). Le moteur en joue deux d'avantage (trois
 * attaquants, deux défenseurs ; 65 et 35 % du temps) et deux de désavantage (deux et deux ; 60 et 40 %), rangées sur
 * les vrais points de chacun en avantage et en désavantage. Derrière le banc, elles se voient et se choisissent :
 * chacune dit ses minutes et ses vraies stats du soir ; toucher un joueur ouvre ceux qui peuvent prendre sa place
 * (un joueur déjà dans la situation y échange sa case). « Le choix du moteur » revient au rangement automatique.
 * Le choix part avec la décision du banc (`speciales`, js/sim.js `unitesSpeciales`).
 */
const SIT = {
  AN: { titre: 'Avantage numérique', court: 'AN', stat: p => p.ppp },
  DN: { titre: 'Désavantage numérique', court: 'DN', stat: p => p.shp },
};
/* « 1 pt AN », « 27 pts AN » : ses vrais points dans la situation, sur sa saison. */
const ptsDe = (S, n) => `${n ?? '—'} ${n === 1 || n === 0 ? 'pt' : 'pts'} ${S.court}`;
const mmss = m => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`;
function unitesSpecialesEl() {
  const b = G.banc;
  const el = document.createElement('section');
  el.className = 'unites-speciales';
  const lu = avecLeBanc((you, l, adv, aVenir) => ({ u: specialesDuSoir(you, l), st: specialesEnStats(you, l, adv, aVenir), l }));
  if (!lu) return el;
  const { u, st, l } = lu;
  const patineurs = Object.values(l).filter(p => p && p.p !== 'G');
  const statDe = (sit, i) => {
    const x = st && st[sit] && st[sit][i];
    if (!x) return '';
    return sit === 'AN' ? `≈ ${mmss(x.minutes)} · ${v1(x.tirs)} tirs · ${v1(x.pctTir * 100)} % de précision` : `≈ ${mmss(x.minutes)} · ${v1(x.contre)} tirs contre · ${pct3(x.pctArr)} d'arrêts`;
  };
  const rangee = (sit, i, j, p) => {
    const S = SIT[sit], n = S.stat(p);
    return `<button type="button" class="us-j" data-sit="${sit}" data-u="${i}" data-i="${j}"><span class="us-pos">${esc(positionLabel(p))}</span><span class="us-nom">${formatName(p.n)}</span>${n != null ? `<span class="us-stat">${ptsDe(S, n)}</span>` : ''}</button>`;
  };
  el.innerHTML = `<div class="pm-tete"><b>Unités spéciales</b>${b.speciales ? '<button type="button" class="btn us-auto">Le choix du moteur</button>' : '<span>le choix du moteur</span>'}</div>
    ${['AN', 'DN'].map(sit => `<div class="pm-k">${SIT[sit].titre}</div>${u[sit].map((js, i) => `<div class="us-unite">
      <div class="us-tete"><b>${SIT[sit].court} ${i + 1}</b><span class="us-stats">${statDe(sit, i)}</span></div>
      <div class="us-joueurs">${js.map((p, j) => rangee(sit, i, j, p)).join('')}</div></div>`).join('')}`).join('')}`;
  const auto = el.querySelector('.us-auto');
  if (auto) auto.onclick = () => { b.speciales = null; render(); };
  const cles = js => js.map(getPlayerKey);
  el.querySelectorAll('.us-j').forEach(x => {
    x.onclick = () => {
      const sit = x.dataset.sit, i = Number(x.dataset.u), j = Number(x.dataset.i), S = SIT[sit];
      const actuel = u[sit][i][j];
      // Le choix avec `q` à la place d'`actuel` ; un joueur déjà dans la situation y échange sa case avec lui.
      const avec = q => {
        const choix = { AN: u.AN.map(cles), DN: u.DN.map(cles) }, k = getPlayerKey(q);
        for (const v of [0, 1]) { const w = choix[sit][v].indexOf(k); if (w >= 0) choix[sit][v][w] = getPlayerKey(actuel); }
        choix[sit][i][j] = k;
        return choix;
      };
      const habilles = new Set(Object.values(l).filter(Boolean));
      // L'unité lue avec `q` dedans, une fois par joueur : la case, la barre et le comparatif lisent la même.
      const lus = new Map();
      const apresAvec = q => {
        if (!lus.has(q)) { const r = avecLeBanc((you, ll, adv) => specialesEnStats(you, ll, adv, aVenirDuBanc({ speciales: avec(q) }))); lus.set(q, r && r[sit][i]); }
        return lus.get(q);
      };
      choisirSpeciale({
        roster: G.roster, sortant: actuel, unite: `${S.court} ${i + 1}`,
        joue: q => (q.p === 'G' ? 'gardien' : !habilles.has(q) ? 'pas habillé ce soir' : ''),
        sous: q => ptsDe(S, S.stat(q)),
        ou: q => { const v = [0, 1].find(k => u[sit][k].includes(q)); return v == null ? '' : `${S.court} ${v + 1}`; },
        // L'écart de L'UNITÉ touchée, en vraies stats de la situation : en avantage ses tirs et sa réussite, en
        // désavantage les tirs d'en face et tes arrêts. Sur tout le match, six minutes d'avantage se perdaient (« ≈ pareil »).
        ecart: q => {
          const a = apresAvec(q), d = st && st[sit][i];
          if (!a || !d) return null;
          return sit === 'AN' ? { tirs: a.tirs - d.tirs, pctTir: a.pctTir - d.pctTir, contre: 0, pctArr: 0 } : { tirs: 0, pctTir: 0, contre: a.contre - d.contre, pctArr: a.pctArr - d.pctArr };
        },
        dans: `en ${S.court} ${i + 1}`,
        avantApres: q => {
          const a = apresAvec(q), d = st && st[sit][i];
          if (!a || !d) return '';
          const fl = (x, y, f) => `${f(x)} → <b>${f(y)}</b>`;
          return `${S.court} ${i + 1} : ${sit === 'AN'
            ? `${fl(d.tirs, a.tirs, v1)} tirs · ${fl(d.pctTir * 100, a.pctTir * 100, v1)} % de précision`
            : `${fl(d.contre, a.contre, v1)} tirs contre · ${fl(d.pctArr, a.pctArr, pct3)} d'arrêts`} par match`;
        },
        onChoix: q => { b.speciales = avec(q); render(); },
      });
    };
  });
  return el;
}

/*
 * TON ÉQUIPE CE SOIR (V7, JP : *mettre le coach et l'explication des bonus dans effectif/équipe* ; *pas facile d'avoir
 * numériquement quels trucs sont déjà actifs*). En tête de l'onglet Équipe, derrière le banc : ce que vaut ton
 * alignement (systèmes, badges, chimie, jambes), puis ce qui joue un par un (le coach, les patrons, les cartes, les
 * effets qui courent), chacun en vraies stats de match (tirs, réussite, tirs contre, arrêts), et ton coach avec sa confiance. Tout se lit par différence dans le
 * moteur (js/impact.js), au soir du prochain match, avec les lignes du banc.
 */
/* Un écart de stats en pastilles : les deux qui bougent le plus, en vert ou en rouge. */
const pastillesDeStats = (d, max = 2) => motsDeStats(d, max).map(x => `<span class="st-p ${x.bon ? 'bon' : 'mauvais'}">${esc(x.txt)}</span>`).join('') || '<span class="st-p">rien</span>';
const v1 = x => x.toFixed(1).replace('.', ',');
/*
 * LE SOIR DU BANC, POSÉ LE TEMPS D'UNE LECTURE : le prochain match, avec ce qui se règle ici (les lignes, la glace,
 * l'appariement, la consigne, le filet) à la place de ce qui était décidé. `plan` remplace la consigne ou le filet
 * le temps d'essayer. `fn(you, lu, adv, aVenir)`.
 */
function aVenirDuBanc(plan = {}) {
  const b = G.banc, L = G.ligue, you = L.you, j = b.prochain.j ?? b.jour;
  // EN SÉRIES (V7), le match de ta série : ses décisions déjà prises (un ajustement, une main), sans celles que le banc règle.
  if (b.serie) {
    return [...(L.decisionsSeries || []).filter(d => d.ronde === b.serie.ronde && d.match_no === b.serie.k && !d.entracte && !(d.duel && d.duel.p > 0) && !d.cases && !d.lignes && !d.match && !d.filet),
      { lignes: b.lignes, match: b.match, filet: b.filet, speciales: b.speciales || null, ...plan }];
  }
  return [...(L.decisions || []).filter(d => d.jour >= (you.jourCourant || 0) && d.jour <= j && !d.entracte && !(d.duel && d.duel.p > 0) && !d.lignes && !(d.jour === j && (d.match || d.filet))),
    { jour: j, lignes: b.lignes, match: b.match, filet: b.filet, speciales: b.speciales || null, ...plan }];
}
/*
 * Le soir du banc posé sur ton club le temps d'une lecture : le plan de match et les unités spéciales qu'on essaie et, en séries, le match
 * qui vient (`jourCourant` à l'infini : le moteur lit `effetsSerie`, que chaque match de série repart à vide).
 */
function auSoirDuBanc(you, fn) {
  const b = G.banc, serie = !!b.serie;
  const jc = you.jourCourant, es = you.effetsSerie, avant = [you.appariement, you.roulement, you.speciales];
  you.appariement = b.appariement; you.roulement = b.roulement; you.speciales = b.speciales || null;
  if (serie) { you.jourCourant = Infinity; you.effetsSerie = []; }
  try { return fn(); } finally { you.jourCourant = jc; you.effetsSerie = es; [you.appariement, you.roulement, you.speciales] = avant; }
}
function avecLeBanc(fn) {
  const b = G.banc, L = G.ligue, you = L && L.you;
  if (!b || !you || !b.prochain || surTable()) return null;
  const j = b.prochain.j ?? b.jour;
  const aVenir = aVenirDuBanc();
  try {
    return auSoirDuBanc(you, () => { you.jourCourant = j; return fn(you, activeLineup({ ...you, roster: G.roster, injured: b.blesses, jourCourant: j }), b.prochain.adv, aVenir); });
  } catch { return null; }
}
function lectureDuBanc() {
  return avecLeBanc((you, lu, adv, aVenir) => ({ stats: statsDe(chiffresDuSoir(you, lu, adv, aVenir)), parts: alignementDuSoir(you, lu, adv, aVenir) }));
}
/* Ce qu'un autre réglage du soir (`plan` : la consigne, le filet) change aux stats du match, contre celui en place. */
const ecartDuSoir = plan => avecLeBanc((you, lu, adv, aVenir) => {
  const a = statsDe(chiffresDuSoir(you, lu, adv, aVenirDuBanc(plan))), b = statsDe(chiffresDuSoir(you, lu, adv, aVenir));
  return { tirs: a.tirs - b.tirs, pctTir: a.pctTir - b.pctTir, contre: a.contre - b.contre, pctArr: a.pctArr - b.pctArr };
});
/*
 * TON COACH ET SA CONFIANCE (V16 : ses points, ses adjoints en poste, leurs échelons et leurs matchs à ton service). `injured` : les
 * blessés du jour, qui ne portent pas sa confiance.
 */
export function coachHtml(decs, j, injured = new Set()) {
  if (G.bonus !== 'ROGUE' || !G.rogue) return '';
  const [actif] = coachsActifs(decs, j + 1);
  const k = actif ? actif.cle : G.rogue.coach, C = COACHS[k];
  if (!C) return '';
  const n = buildDe(decs, j + 1, { joues: (de, a) => (G.ligue ? matchsJoues(G.ligue.calendrier, G.ligue.you, de, a) : 0) })[k] || 0, pal = Math.max(palierDe(n), actif ? actif.palier : 0), manque = avantProchain(n);
  const J = joueursDesCoachs({ roster: G.roster, injured })[k] || { joueurs: 0, paliers: 0 };
  const fin = SEUILS[SEUILS.length - 1];
  return `<div class="ej-coach">
    <div class="ej-coach-tete"><span class="ej-coach-ico" aria-hidden="true">${C.ico}</span><b>${esc(C.nom)}</b>${pal ? `<span class="ej-rang">${ROMAINS[pal]}</span>` : ''}<small>${esc(C.mot)}</small></div>
    <div class="ej-jauge" role="img" aria-label="${n} point${n > 1 ? 's' : ''} de confiance"><i style="width:${Math.min(100, Math.round((n / fin) * 100))}%"></i>${SEUILS.map(x => `<em style="left:${Math.round((x / fin) * 100)}%"${n >= x ? ' class="fait"' : ''}><b>${ROMAINS[SEUILS.indexOf(x) + 1]}</b></em>`).join('')}</div>
    <div class="ej-coach-l">${n} point${n > 1 ? 's' : ''} de confiance${manque ? ` · ${ROMAINS[pal + 1]} dans ${manque}` : ''} · ${J.joueurs} joueur${J.joueurs > 1 ? 's' : ''} de sa couleur${pal && J.paliers ? ` · ×${(1 + JOUEUR_COACH * J.paliers).toFixed(1).replace('.', ',')}` : ''}</div>
    ${pal ? `<div class="ej-coach-l"><span class="ej-k">Joue</span> ${puces(reglesDePalier(k, pal))}</div>` : ''}
    ${manque ? `<div class="ej-coach-l suite detail"><span class="ej-k">${ROMAINS[pal + 1]}</span> ${puces(reglesDePalier(k, pal + 1))}</div>` : ''}
  </div>`;
}
function equipeDuSoirEl() {
  const el = document.createElement('section');
  el.className = 'ej-soir';
  const lu = lectureDuBanc();
  if (!lu) return el;
  const t = lu.stats;
  const rangee = (nom, d) => `<li class="ej-r"><span class="ej-nom">${esc(nom)}</span><span class="ej-stats">${pastillesDeStats(d)}</span></li>`;
  el.innerHTML = `<div class="ej-tete">Par match, ${G.banc.prochain.domicile ? 'contre' : 'chez'} ${esc(teamShort(G.banc.prochain.adv))}</div>
    <div class="ej-feuille">
      <div><b>${v1(t.tirs)}</b><small>Tirs</small></div><div><b>${v1(t.pctTir * 100)} %</b><small>Au tir</small></div>
      <div><b>${v1(t.contre)}</b><small>Tirs contre</small></div><div><b>${pct3(t.pctArr)}</b><small>Arrêts</small></div>
    </div>
    <div class="ej-k">Ton alignement</div>
    <ul class="ej-liste">${lu.parts.map(x => rangee({ systemes: 'Systèmes', badges: 'Badges', chimie: 'Chimie', jambes: 'Jambes' }[x.cle] || x.cle, x.d)).join('')}</ul>
`;
  return el;
}

/*
 * LA CONSIGNE ET LE FILET DU SOIR (V7 : « Préparer le match » fondu dans les Lignes). Chaque consigne dit ce qu'elle
 * change aux stats du match ; chaque gardien, son % d'arrêts et ses jambes. Ils jouent au « Retour au match ».
 */
function consigneHtml() {
  const b = G.banc, cle = (b.match && b.match.importance) || 'normale';
  return `<div class="pm-k">Consigne du match</div><div class="pm-seg pm-consigne">${Object.entries(IMPORTANCES).map(([k, I]) => {
    const d = k === cle ? null : ecartDuSoir({ match: { importance: k, ad: AD_DE_CONSIGNE[k] } });
    return `<button type="button" class="pm-btn${k === cle ? ' on' : ''}" data-consigne="${k}" aria-pressed="${k === cle}" title="${esc(I.mot)}"><b>${I.ico} ${esc(I.nom)}</b>${d ? `<span class="pm-stats">${pastillesDeStats(d, 1)}</span>` : '<small>en jeu</small>'}</button>`;
  }).join('')}</div>`;
}
function filetHtml() {
  const b = G.banc, F = b.filetEtat;
  if (!F) return '';
  const gardien = cle => Object.values(G.roster).find(p => p && getPlayerKey(p) === cle) || null;
  const choix = b.filet === 'auto' ? F.rotation : b.filet;
  const bouton = qui => {
    const g = gardien(F[qui]);
    const e = g ? ((b.energie || {})[getPlayerKey(g)] ?? 100) : 100;
    // Ses jambes, avec la règle des gardiens en infobulle (`jambesHtml`) : elles tombent par départs de suite.
    return `<button type="button" class="pm-btn${choix === qui ? ' on' : ''}" data-filet="${qui === F.rotation ? 'auto' : qui}" aria-pressed="${choix === qui}"><b>${g ? esc(g.n) : 'Le rappel'}</b><small>${g && Number.isFinite(g.sv) ? pct3(g.sv) : '—'}${qui === F.rotation ? ' · son tour' : ''}</small>${g ? jambesHtml(e, { gardien: true }) : ''}</button>`;
  };
  return `<div class="pm-k">Devant le filet</div><div class="pm-seg pm-filet">${bouton('partant')}${bouton('aux')}</div>`;
}

export function renderRoster() {
  const host = $('rosterBoard');
  if (!host) return;
  host.innerHTML = '';
  // Le bouton d'alignement sert partout où l'alignement se règle : au repêchage, et derrière le banc en pleine saison
  // (`G.done` y reste vrai : la saison est lancée) — jamais sur table, ni au bilan.
  if (!surTable() && (G.banc || !G.done) && SLOTS.some(s => G.roster[s.i])) host.appendChild(boutonAuMieux());
  if (!surTable() && G.banc && G.banc.prochain && G.ligue && G.ligue.you) host.appendChild(equipeDuSoirEl());
  if (!surTable() && G.banc && G.banc.prochain && G.ligue && G.ligue.you) host.appendChild(planDeMatchEl());
  if (!surTable() && G.banc && G.banc.prochain && G.ligue && G.ligue.you) host.appendChild(unitesSpecialesEl());

  UNIT_NAMES_F.forEach((name, u) => {
    const slots = SLOTS.filter(s => s.group === 'F' && s.unit === u && !s.scratch);
    host.appendChild(lineEl(name, slots, 'F', u));
  });
  UNIT_NAMES_D.forEach((name, u) => {
    const slots = SLOTS.filter(s => s.group === 'D' && s.unit === u && !s.scratch);
    host.appendChild(lineEl(name, slots, 'D', u, 'pair'));
  });
  host.appendChild(lineEl('Gardiens', SLOTS.filter(s => s.group === 'G' && !s.scratch), null, null, 'pair'));
  // Les réservistes : les trois de toujours, les cases débloquées de la run (S80), et la prochaine à débloquer, grisée.
  const prochaine = G.bonus === 'ROGUE' ? SLOTS.find(s => s.extra && !caseOuverte(s)) : null;
  host.appendChild(lineEl('Réservistes', SLOTS.filter(s => s.scratch && (caseOuverte(s) || s === prochaine)), null, null));
  ajusterCartes(host);
}

export function renderTeamSummary() {
  const host = $('teamSummary');
  if (!host) return;

  const oop = SLOTS.filter(s => G.roster[s.i] && getPositionPenalty(G.roster[s.i], s) > 0).length;
  let optimal = 0, miscast = 0, hors = 0;
  const units = [...Array(4).keys()].map(u => ['F', u]).concat([...Array(3).keys()].map(u => ['D', u]));
  for (const [g, u] of units) {
    const syn = getUnitSynergy(G.roster, g, u);
    // `zoneEtat`, PAS l'émoji du libellé : ajouter une étiquette (S62 en a
    // ajouté une, « hors de ses lignes ») ferait sinon rater les pires unités
    // sans que rien ne casse.
    if (syn.zoneEtat === 'optimal') optimal++;
    if (syn.zoneEtat === 'mal' || syn.zoneEtat === 'hors') miscast++;
    if (syn.zoneEtat === 'hors') hors++;
  }

  const tile = (k, v, cls, title) =>
    `<div class="sum-item" title="${esc(title)}"><div class="k">${k}</div><div class="v ${cls || ''}">${v}</div></div>`;

  if (surTable()) {
    // Sur table, ni zone ni chimie ni pénalité : les tuiles disent ce que
    // le plateau va lire — le tir des attaquants, la force des patineurs,
    // l'arrêt du partant. Des moyennes de nombres qui existent, rien de neuf.
    const habilles = SLOTS.filter(s => !s.scratch && G.roster[s.i]).map(s => [s, G.roster[s.i]]);
    const moy = (xs, k) => (xs.length ? (xs.reduce((a, p) => a + tableStats(p)[k], 0) / xs.length).toFixed(1) : '—');
    const att = habilles.filter(([s, p]) => s.group === 'F' && p.p !== 'G').map(([, p]) => p);
    const pat = habilles.filter(([, p]) => p.p !== 'G').map(([, p]) => p);
    const partant = habilles.find(([s]) => s.group === 'G')?.[1];
    host.innerHTML =
      tile('Masse', money(capUsed()), '', `Somme des salaires signés, sur un plafond de ${money(MODE().cap)}. Il reste ${money(capLeft())}.`)
      + tile('Vides', slotsLeft(), slotsLeft() ? 'dash-warn' : 'dash-good', `Cases encore à combler sur les ${totalCases()}.`)
      + tile('Tir', moy(att, 'TI'), '', `TI moyen des ${att.length} attaquants habillés — ${MT.AXE_MOT.TI.toLowerCase()}. Sur six.`)
      + tile('Force', moy(pat, 'FO'), '', `FO moyen des ${pat.length} patineurs habillés — ${MT.AXE_MOT.FO.toLowerCase()}. Sur six.`)
      + tile('Arrêt', partant ? tableStats(partant).AR : '—', '', `AR de ton partant — ${MT.AXE_MOT.AR.toLowerCase()}. Sur six.`);
    return;
  }
  host.innerHTML =
    tile('Masse', money(capUsed()), '', `Somme des salaires signés, sur un plafond de ${money(MODE().cap)}. Il reste ${money(capLeft())}.`)
    + tile('Vides', slotsLeft(), slotsLeft() ? 'dash-warn' : 'dash-good', `Cases encore à combler sur les ${totalCases()}.`)
    // TROIS TUILES, DEUX UNITÉS DE COMPTE (S78) : les deux premières comptent des
    // TRIOS ET PAIRES (sur 7), la dernière des JOUEURS. Le libellé le dit ; il
    // disait « Mal placées » à côté de « Hors position » et on lisait deux fois
    // la même chose.
    + tile('Unités en place', `${optimal}/7`, optimal ? 'dash-good' : '', "Trios et paires dont tous les joueurs sont dans leur zone : le trio rend à plein. Les quatre trios et les trois paires comptent.")
    + tile('Unités mal placées', hors ? `${miscast} · ${hors}🚨` : miscast, miscast ? 'dash-bad' : '',
      `Unités où au moins un joueur joue hors de sa zone. Un cran d'écart ne coûte presque rien ; ${hors ? `${hors} unité${hors > 1 ? 's sont' : ' est'} à deux crans ou plus, et là ça coûte cher.` : 'à deux crans ou plus, ça coûte cher.'}`)
    + tile('Joueurs hors position', oop, oop ? 'dash-warn' : '', `Joueurs placés ailleurs qu'à leur position naturelle : chacun y perd de 2 à 5 points, et s'adapte en jouant (la pénalité fond des deux tiers en ${ADAPT_MATCHS} matchs).`);
}
export function renderMain() {
  const b = $('mainBtn');
  const reste = slotsLeft();
  const over = capLeft() < 0;
  if (G.banc) {
    b.disabled = reste > 0;
    b.textContent = G.banc.serie ? `Retour aux séries · match ${G.banc.serie.k + 1}` : `Retour au match · journée ${G.banc.jour}`;
    return;
  }
  b.disabled = reste > 0 || G.done || over;
  // UNE JAUGE, PAS UN BOUTON ÉTEINT (1.0, J2-6f) : « 14 / 23 · encore 9 » se remplit à chaque signature.
  const total = totalCases();
  const jauge = !G.done && !over && reste > 0;
  b.classList.toggle('jauge', jauge);
  b.style.setProperty('--pct', `${Math.round(100 * (total - reste) / Math.max(1, total))}%`);
  b.textContent = G.done ? (G.bonus === 'TABLE' ? 'Tournoi joué' : 'Saison jouée')
    : over ? `Plafond dépassé de ${money(-capLeft())}`
    : reste === 0 ? (G.bonus === 'TABLE' ? `Au tournoi sur table · ${MT.CLUBS_TOURNOI} clubs` : 'Lancer la saison · 82 matchs')
    : `${total - reste} / ${total} · encore ${reste}`;
}

