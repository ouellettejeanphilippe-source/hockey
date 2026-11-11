/*
 * L'ALIGNEMENT (sorti de js/game.js en 1.0) : les cases, les trios et les
 * paires, l'affinité de chaque ligne, le résumé d'équipe, le bouton
 * principal — et, en mode Sur table, les nombres du plateau au repêchage.
 */

import { TRAITS, getTraits } from './traits.js';
import { MT } from './charge-table.js';
import { esc, estD as isD, glyphe, money } from './util.js';
import { badgesDe, SLOTS, CASES_DE_BASE, fits, getUnitSynergy, identiteUnite, origineUnite, getPositionPenalty, ADAPT_MATCHS, partDesDeparts, lienDePaire, accordsDeLigne, PALIERS, AGRESSIVITES, agressiviteDeLigne } from './sim.js';
import { alignementAuMieux, penaliteAffichee } from './impact.js';
import { glisserDeposer } from './deposer.js';
import { motDuBadge } from './gerant.js';
import { couleurVive, fondEquipe, getTeamBand, getTeamLogoHtml } from './logos.js';
import { nomCourt } from './recit.js';
import { $, G, MODE, ZONE_DESSUS_TITLE, ZONE_SOUS_TITLE, capLeft, capUsed, chiffreCle, displayStats, estRenfort, formatName, headshotHtml, positionClass, positionLabel, render, roleTag, saveGame, saveOpts, setOption, setView, slotsLeft, toast, totalCases, zoneEcart, zoneTag } from './game.js';
import { ajusterCartes, lesCotes, pastilleNiveau, rareteJoueur, slotShort } from './repechage.js';
import { ouvrirFiche, porteeRevele, showPlayerModal } from './fiche.js';

/* La carte d'un joueur de l'alignement : sa fiche de saison une fois la ligue lancée, sa carte sinon. */
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
 * en a un. Sa production : ses PTS (ou V) ; le visage et tout le reste sont dans la fiche, à un toucher.
 */
/* La forme courte d'une cote, dans une rangée : le tir, les passes, la défense d'un patineur, les arrêts d'un gardien ; le reste est à l'hexagone de sa fiche. */
const COURT_DE_COTE = { tir: 'T', jeu: 'P', defense: 'D', arrets: 'Arrêts' };
function celluleJoueur(p, s, { ecart, penTag }) {
  // LE RÔLE EN MOTS, COMME À LA SIGNATURE (Jalon U, JP : *refaire l'alignement plus comme la page signature*) : la même
  // étiquette que la rangée du vestiaire (`roleTag`) — « Passeur Or », le second badge en icône, les modifs posées.
  const tag = roleTag(p);
  const marque = ecart === 'sous' ? `<span class="cell-zone sous" title="${esc(ZONE_SOUS_TITLE)}">▼</span>`
    : ecart === 'dessus' ? `<span class="cell-zone dessus" title="${esc(ZONE_DESSUS_TITLE)}">▲</span>`
    : '<span class="cell-zone ok" title="Dans sa zone : il rend à plein ici.">✓</span>';
  // TOUS SES TRAITS (1.0, R3), pas le premier seul : chacun joue dans le moteur (js/traits.js), chacun se voit.
  const traits = getTraits(p).map(x => TRAITS[x.cle]).filter(Boolean);
  // SA PART DES DÉPARTS (V2.2) : la rotation suit les vrais matchs joués des deux gardiens ; la case le dit.
  const departs = s.group === 'G' && !s.scratch ? (() => {
    const d = partDesDeparts(G.roster), part = s.unit === 0 ? d.partant : d.aux;
    return part > 0 ? `<span class="cell-departs" title="La rotation lui donne cette part des départs : sa vraie saison (${p.gp || 0} matchs) contre celle de l'autre gardien.">${Math.round(part * 82)} départs</span>` : '';
  })() : '';
  const c = lesCotes(p);
  const cle = chiffreCle(p);
  const cotes = c ? `<small class="cell-cote" title="${esc(c.map(x => `${x.mot} ${x.v}`).join(' · '))} (cotes sur 20, dans sa saison : un appui, le niveau et le rôle se lisent d'abord)">${c.filter(x => x.cle in COURT_DE_COTE).map(x => `${COURT_DE_COTE[x.cle]} ${x.v}`).join(' · ')}</small>` : '';
  const verdicts = `${marque}${zoneTag(p, true)}${penTag}${traits.length ? `<span class="cell-trait" title="${esc(traits.map(t => t.short || t.nom || '').join(' · '))}">${traits.map(t => t.icon).join('')}</span>` : ''}${departs}`;
  const sec = p.p !== 'G' && cle.u !== 'PTS' ? `<small class="cell-sec" title="Ses points dans sa vraie saison">${displayStats(p).pt} pts · ${displayStats(p).ppgStr.replace('.', ',')}/m</small>` : '';
  // Trois rangées : le rôle et son mot ; le niveau et la zone ; le chiffre clé.
  return `<div class="cell-l1">${tag ? `<span class="slot-roles cell-role">${tag}</span>` : ''}</div>
        <div class="slot-tags cell-l2">${pastilleNiveau(p)}${cotes}${verdicts}</div>
        <div class="cell-l3"><span class="cell-prod slot-faits" title="${esc(`Son chiffre clé : ${cle.mot}`)}"><span class="pcard-big"><b>${esc(cle.v)}</b> <span>${esc(cle.u)}</span></span></span>${sec}</div>`;
}

/*
 * LA CASE D'ABORD LISIBLE (S78 ; JP : *améliorer l'alignement pour que l'information soit plus claire*) : elle garde ce qui
 * DÉCIDE d'un alignement, chacun une fois — la bande (sa case, son salaire), son nom, sa production, les verdicts (sa zone,
 * ▼ ▲ hors de sa zone, ↔ hors position, ses icônes). Le reste est à sa fiche, à un toucher. La case en carte, debout, était au
 * Rogue d'avant : la run en carte a ses Lignes (js/run-scenes.js).
 */
/** Le socle d'une case : sa classe, son rang dans SLOTS (le glisser-déposer le relit, `permuter`), son club, son édition. */
function socleDeCase(s, p) {
  const el = document.createElement('div');
  const pen = p ? penaliteAffichee(p, s).pen : 0;
  el.className = ['slot', p ? '' : 'empty', G.selectedSlot === s.i ? 'selected' : '', !p && G.target === s.i ? 'target' : '', pen > 0 ? 'oop' : ''].filter(Boolean).join(' ');
  el.dataset.case = s.i;
  if (!p) return el;
  el.style.setProperty('--slot-line', couleurVive(p.t));
  el.style.setProperty('--slot-fond', fondEquipe(p.t, 0.035) || '');
  const band = getTeamBand(p.t);
  el.style.setProperty('--slot-band', band.bg);
  el.style.setProperty('--slot-ink', band.ink);
  el.style.setProperty('--slot-stripe', band.stripe);
  if (estRenfort(p)) el.classList.add('renfort');
  el.classList.add('cj-case', `tc-${rareteJoueur(p)}`);
  if (zoneEcart(p, s) === 'sous') el.classList.add('sous-zone');
  // LA CARTE QU'ON VIENT DE SIGNER ENTRE DANS LE CARTABLE (S77) : sa case luit une fois ; l'horodatage vieillit.
  if (G.dernierSigne && G.dernierSigne.p === p && Date.now() - G.dernierSigne.t < 1500) el.classList.add('cj-arrive');
  return el;
}

/** Les verdicts d'une case : hors position (↔, sans chiffre : l'échelle des cotes ne s'affiche pas), hors de sa zone (▼ ▲). */
function verdictsDeCase(p, s) {
  const adapt = penaliteAffichee(p, s);
  const penTag = !surTable() && adapt.pen > 0 ? `<span class="tag tag-pen" title="${adapt.matchs ? `Hors de sa position naturelle, mais il s'y adapte : la pénalité fond en jouant ici (${adapt.matchs} m.)` : 'Hors de sa position naturelle : il rend moins ici, et s\'y fera en jouant là'}">↔</span>` : '';
  const ecart = zoneEcart(p, s);
  const zoneEcartTag = surTable() ? '' : ecart === 'sous' ? `<span class="tag tag-pen" title="${esc(ZONE_SOUS_TITLE)}">▼</span>`
    : ecart === 'dessus' ? `<span class="tag tag-zone-up" title="${esc(ZONE_DESSUS_TITLE)}">▲</span>` : '';
  return { ecart, penTag, zoneEcartTag };
}

/** La bande : ses positions, son salaire (un renfort ne coûte rien). */
const bandeDeCase = p => `<div class="slot-band${estRenfort(p) ? ' off' : ''}">
        <span class="sb-role ${positionClass(p)}" title="Ses positions : ${esc(positionLabel(p))} — ce qu'il peut jouer (la case, elle, se lit à sa place dans le trio)">${esc(positionLabel(p).split(' / ').join('/'))}</span>
        ${estRenfort(p)
          ? '<span class="slot-salary renfort" title="Fourni par ton club de renfort : ne coûte rien au plafond et ne se modifie pas.">renfort</span>'
          : `<span class="slot-salary">${displayStats(p).salaryMain}</span>`}
      </div>`;

/*
 * LA CASE EN RANGÉE (le 82-0, Sur table) : pas debout comme la carte du vestiaire, une rangée aux couleurs du club — le visage,
 * l'écusson et le nom (U19 ; LE NOM OUVRE SA CARTE, 1.0), puis la cellule du joueur ; sur table, les nombres du plateau et rien de
 * ce qu'il ne lit pas. Le ✕ retire un joueur avant la saison : la prochaine signature comble sa case sans faire tourner la roulette.
 */
function slotEl(s) {
  const p = G.roster[s.i];
  const el = socleDeCase(s, p);
  if (p) {
    const v = verdictsDeCase(p, s);
    el.innerHTML = `
      ${estRenfort(p) ? '' : `<button class="slot-remove" title="Retirer ${esc(p.n)}" aria-label="Retirer ${esc(p.n)}">✕</button>`}
      ${bandeDeCase(p)}
      <div class="slot-inner">
        <span class="slot-mug" aria-hidden="true">${headshotHtml(p)}</span>
        <span class="slot-qui"><span class="slot-logo" aria-hidden="true">${getTeamLogoHtml(p.t, 20)}</span><button type="button" class="slot-name lien-joueur slot-fiche" title="Sa carte">${formatName(p.n)}</button></span>
        ${surTable() ? `<div class="slot-meta slot-faits">${slotAxesTexte(p)}</div>
        <div class="slot-tags">${slotTags(p, v.zoneEcartTag, v.penTag)}</div>` : celluleJoueur(p, s, v)}
      </div>`;
    el.querySelector('.slot-fiche').addEventListener('click', ev => { ev.stopPropagation(); ouvrirCarteDe(p); });
    el.querySelector('.slot-remove')?.addEventListener('click', ev => {
      ev.stopPropagation();
      delete G.roster[s.i];
      G.selectedSlot = null;
      // Sans la dette, « signer le moins cher puis ✕ » était un « Passer » gratuit et illimité.
      if (!estRenfort(p)) G.dette++;
      saveGame();
      render();
      toast(`${p.n} retiré. ${money(capLeft())} de disponible, et la roulette ne tournera pas pour cette case.`, 'warn');
    });
  } else {
    // Sur table, la case vide ne promet pas de zone : le plateau n'en lit pas.
    el.innerHTML = `<div class="slot-role">${esc(s.role)}</div><div class="slot-sub">${surTable() ? '' : esc(s.label)}</div>`;
  }
  el.onclick = toucherLaCase(s, p);
  return el;
}

/** Le toucher d'une case : la choisir, puis l'autre case déplace ou permute ; une case vide se vise. */
const toucherLaCase = (s, p) => () => {
  if (estRenfort(p)) { toast('Les renforts sont fournis : tu ne peux pas les déplacer.', 'warn'); return; }
  if (G.selectedSlot !== null) {
    if (G.selectedSlot === s.i) G.selectedSlot = null;
    else { permuter(G.selectedSlot, s.i); return; }
  } else if (p) {
    G.selectedSlot = s.i;
    toast('Touche une autre case pour déplacer ou permuter, ou glisse-la.');
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

/*
 * DÉPLACER OU PERMUTER, une seule règle pour le toucher (une case, puis l'autre) et pour le geste (la carte glissée sur une
 * case, js/deposer.js). Un joueur ne va qu'où son poste le permet (`fits` : un défenseur reste en défense, un gardien
 * devant le filet), dans les deux sens ; un renfort ne bouge pas.
 */
const refusDe = (src, dst) => {
  const a = G.roster[src], b = G.roster[dst];
  if (estRenfort(a) || estRenfort(b)) return { p: estRenfort(a) ? a : b, renfort: true };
  if (a && !fits(a, SLOTS[dst])) return { p: a };
  if (b && SLOTS[src] && !fits(b, SLOTS[src])) return { p: b };
  return null;
};
function permuter(src, dst) {
  G.selectedSlot = null;
  const refus = refusDe(src, dst);
  if (refus) {
    toast(refus.renfort ? 'Les renforts sont fournis : tu ne peux pas les déplacer.' : `${refus.p.n} ne peut pas jouer à ce poste.`, refus.renfort ? 'warn' : 'bad');
    render();
    return;
  }
  const a = G.roster[src], b = G.roster[dst];
  if (a) G.roster[dst] = a; else delete G.roster[dst];
  if (b) G.roster[src] = b; else delete G.roster[src];
  // RANGER NE RECOMPOSE PAS LA MAIN (S71) : si le déplacement remplit la
  // case de la main, l'épingle passe à la case libérée, du même poste.
  if (MODE().loto && G.mainCase === dst && !G.roster[src] && SLOTS[src] && SLOTS[src].role === SLOTS[dst].role) G.mainCase = src;
  G.target = null;
  saveGame();
  render();
}
/*
 * LA CARTE SE GLISSE (oct., JP : *possibilité de drag and drop les cartes*). Au doigt, un appui tenu la soulève ; à la
 * souris, elle part dès qu'elle bouge. La case dessous s'allume, en rouge si son poste la refuse ; tenue sur l'onglet
 * Attaque, Défense ou Filet · réserve, elle l'ouvre. Lâchée, elle déplace ou permute, comme au toucher.
 */
glisserDeposer({
  prise: '#rosterBoard .slot[data-case]:not(.empty, .renfort)',
  cible: '#rosterBoard .slot[data-case]',
  permis: (de, vers) => !refusDe(+de.dataset.case, +vers.dataset.case),
  deposer: (de, vers) => permuter(+de.dataset.case, +vers.dataset.case),
  passe: '.seg-effectif button',
  // L'onglet s'ouvre sans redessiner l'alignement (l'onglet n'est que du style) : la carte qu'on porte reste la même.
  ouvrir: o => setOption('effectif', o.dataset.val),
});

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
 * mots, du plus rare au plus courant.
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
     * L'affinité de la ligne a sa rangée sous l'unité (`affiniteEl`, V18) :
     * l'en-tête ne la répète pas.
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
    chemHtml = `<span class="line-chem">${slots.filter(s => G.roster[s.i]).length}/${slots.length} comblés</span>`;
  }

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
  const prodHtml = patineurs.length && patineurs.length === slots.length
    ? `<span class="line-prod" title="Ce que ${group === 'D' ? 'la paire' : 'le trio'} a produit dans ses vraies saisons : les points par match des ${patineurs.length} additionnés. Une vraie stat, pas une cote.">${patineurs.reduce((a, p) => a + (displayStats(p).ppg || 0), 0).toFixed(1).replace('.', ',')} pts/m</span>`
    : '';
  wrap.innerHTML = `<div class="line-head"><span class="line-name">${esc(title)}</span>${idHtml}${prodHtml}${orig}${chemHtml}</div>`;
  const row = document.createElement('div');
  row.className = 'line-slots' + (cls ? ' ' + cls : '');
  slots.forEach(s => row.appendChild(slotEl(s)));
  if ((group === 'F' || group === 'D') && !surTable()) poserLiens(row, slots);
  wrap.appendChild(row);
  // L'AFFINITÉ SOUS SON UNITÉ (V18). Sur table, rien : le plateau ne la lit pas.
  if ((group === 'F' || group === 'D') && !surTable() && patineurs.length === slots.length) wrap.appendChild(affiniteEl(unit, group));
  return wrap;
}

/*
 * L'AFFINITÉ D'UNE LIGNE (V18, docs/refonte-v18.md). JP : *permettre affinité entre joueurs dont les styles marchent
 * ensemble*. Sous chaque trio, les accords de ses avants (le passeur et le sniper, le checker et le plombier…) ; sous
 * chaque paire, ceux de ses défenseurs et ceux qu'elle fait avec le trio de sa ligne (`accordsDeLigne`, js/sim.js).
 * Un accord vaut le plus petit badge des deux (Bronze à Platine), et sa couleur le dit. Sous le trio aussi,
 * l'agressivité de la ligne, celle de sa carrure (`agressiviteDeLigne`, V7). Rien ne se règle : on change l'une et
 * l'autre en changeant les joueurs. La chimie qu'elles donnent est déjà dans les tirs de l'en-tête.
 */
const PALIER_ACCORD = f => Math.min(4, Math.max(1, Math.floor(f)));
function affiniteEl(unit, groupe) {
  const el = document.createElement('div');
  el.className = 'ln-aff';
  const tous = accordsDeLigne(G.roster, unit);
  const ici = tous.filter(x => (groupe === 'F' ? x.aff.a[0] === 'F' && x.aff.b[0] === 'F' : x.aff.a[0] === 'D' || x.aff.b[0] === 'D'));
  const nom = p => esc(nomCourt(p.n));
  const A = groupe === 'F' ? AGRESSIVITES[agressiviteDeLigne(G.roster, unit)] : null;
  const agr = A ? `<span class="puce neutre" title="L'agressivité de la ligne : celle de sa carrure.">${A.ico} ${esc(A.nom)}</span>` : '';
  el.innerHTML = agr + (ici.length
    ? ici.map(x => `<span class="puce badge pal-${PALIER_ACCORD(x.force)}" title="${esc(`${x.aff.nom} : ${x.a.n} et ${x.b.n}, accord ${PALIERS[PALIER_ACCORD(x.force)].nom}`)}">${esc(x.aff.nom)} <small>${nom(x.a)} · ${nom(x.b)}</small></span>`).join('')
    : `<span class="ln-aff-rien">${groupe === 'F' ? 'Aucun accord entre ces trois-là' : 'Aucun accord dans cette paire'}</span>`);
  return el;
}

/*
 * ALIGNER AU MIEUX (oct.). JP : *ajouter bouton best lines et best strategy dans l'alignement pour éviter le
 * gossage*. Un bouton : le meilleur alignement (js/impact.js `alignementAuMieux`). JP : *considérer positions,
 * stratégie, etc.* : les trios lisent le poste et le côté, la zone de chacun, les minutes de la ligne et l'affinité de
 * ses joueurs, et le moteur tranche sur les buts d'un soir ; jamais pire que l'alignement de l'IA. (V18 : l'offensif et
 * le défensif sont partis avec les systèmes qui les faisaient pencher.)
 */
function alignerAuMieux() {
  const tous = SLOTS.map(s => G.roster[s.i]).filter(Boolean);
  const roster = alignementAuMieux(tous);
  // Le surplus va en réserve ; sans place pour tous, rien ne bouge.
  const places = new Set(Object.values(roster));
  const reste = tous.filter(p => !places.has(p)), libres = CASES_DE_BASE.filter(s => s.scratch && !roster[s.i]);
  if (reste.length > libres.length) { toast('Pas assez de cases de réserve pour réaligner : rien n\'a bougé.', 'bad'); return; }
  reste.forEach((p, k) => { roster[libres[k].i] = p; });
  // En place, jamais un objet neuf : `G.roster` est l'objet que la saison alignera.
  for (const k of Object.keys(G.roster)) delete G.roster[k];
  Object.assign(G.roster, roster);
  saveGame();
  render();
  toast('Le meilleur alignement : c\'est fait.');
}
function boutonAuMieux() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn ln-auto';
  b.innerHTML = '🤖 Aligner au mieux';
  b.title = 'Poste, côté, zone et affinité, pesés ensemble. Tu peux tout retoucher après.';
  // Nov. 2026 : le bouton agit (il ouvrait une fenêtre à une seule option : un toucher pour rien).
  b.onclick = alignerAuMieux;
  return b;
}

export function renderRoster() {
  const host = $('rosterBoard');
  if (!host) return;
  host.innerHTML = '';
  // Le bouton d'alignement sert où l'alignement se règle, au repêchage — jamais sur table, ni au bilan.
  if (!surTable() && !G.done && SLOTS.some(s => G.roster[s.i])) host.appendChild(boutonAuMieux());

  UNIT_NAMES_F.forEach((name, u) => {
    const slots = SLOTS.filter(s => s.group === 'F' && s.unit === u && !s.scratch);
    host.appendChild(lineEl(name, slots, 'F', u));
  });
  UNIT_NAMES_D.forEach((name, u) => {
    const slots = SLOTS.filter(s => s.group === 'D' && s.unit === u && !s.scratch);
    host.appendChild(lineEl(name, slots, 'D', u, 'pair'));
  });
  host.appendChild(lineEl('Gardiens', SLOTS.filter(s => s.group === 'G' && !s.scratch), null, null, 'pair'));
  host.appendChild(lineEl('Réservistes', CASES_DE_BASE.filter(s => s.scratch), null, null));
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

