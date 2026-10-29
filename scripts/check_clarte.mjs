/*
 * LA CLARTÉ (1.0, jalon C). JP : *je comprends pas plusieurs mécaniques … trop
 * de catégories de stats, trop floues* ; puis *je veux variété de build, pas
 * trop simple, complexe mais clair*. La profondeur reste ; ce qui se vérifie
 * ici, c'est qu'elle se lit :
 *
 *   1. UNE ICÔNE = UN SENS et UN MOT = UN SENS : déménagés dans
 *      scripts/check_lexique.mjs (js/lexique.js), tranche 1 de la refonte
 *      coachs-cartes-incidents (oct. 2026).
 *   2. « ÉNERGIE » N'EST PLUS UN MOT DE L'ÉCRAN : la fatigue s'appelle les
 *      jambes, la mana des cartes l'élan, le rôle le plombier. On lit les
 *      chaînes de js/ (commentaires enlevés) et le texte d'index.html.
 *   3. LA PAGE DES RÈGLES ne parle plus de ce qui est parti (l'archétype d'un
 *      patineur, « un match sur six », le PENCHANT, les profils de S68) et
 *      reste courte (moins de 1 800 mots).
 *   4. SES CHIFFRES SONT CEUX DU CODE : chaque nombre qu'elle annonce se
 *      reconstruit ici depuis sa constante — une règle recopiée est une règle
 *      qui ment tôt ou tard.
 *   5. CHAQUE CHOIX DIT QUI LE DEMANDE (Jalon M, js/scenes.js) : une scène
 *      parle par une voix d'EXPEDITEURS, sa réplique ne dit aucun chiffre, et
 *      son fait porte chaque nombre qu'elle a reçu.
 *
 *   node scripts/check_clarte.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, borne, informer, verdict } from './verdict.mjs';
import { chainesDe } from './lib/chaines.mjs';
import {
  PROFILS, AGRESSIVITES, CAP, REROLLS, MODES, PART_UNITE, AFFINITES, SPEC_MULT,
  ENERGIE_REF, ENERGIE_EFFET, ENERGIE_BLESSURE, NIVEAUX_JAMBES, PART_AUX_MIN, PART_AUX_MAX, PART_SANS_AUX,
  GARDIEN_SUITE_LIBRE, GARDIEN_JAMBES_PAS, GARDIEN_JAMBES_MIN, GARDIEN_USURE, ANNONCE_GROS, PALIERS_CARTES, OBJECTIF_RATE,
  INTENTIONS, PERIODES_DU_DUEL, MISE_DOUBLEE, ADAPT_MATCHS, SLOTS, getPositionPenalty, K_ROB, ROB_ORDINAIRE, DISSUASION,
  EFFET_ROLE, EFFET_PALIER, COUP_JAMBES, COUP_ABSORBE, COUP_MARQUANT_JAMBES, BLESSURE_SONNE, BAGARRE_MINUTES, ELAN_BAGARRE, ELAN_BAGARRE_PERDU, ELAN_DUREE,
  BLESSURE_BAGARRE_PERDUE, MELEE_MINUTES, BAGARRE_JAMBES, SORTES_DECK, LANCEE,
  POIDS_AN, POIDS_DN, PLANS, MOMENTS,
} from '../js/sim.js';
import { PATRONS } from '../js/banque.js';
import { BLOC, POINTS_PAR_BLOC } from '../js/chiffre.js';
/* Les blocs tenus qu'il faut, du départ (la I) à un seuil. */
const blocsDe = p => (p - SEUILS[0]) / POINTS_PAR_BLOC;
import { TRAITS } from '../js/traits.js';
import { ARCHETYPES } from '../js/ratings.js';
import { NIVEAUX } from '../js/niveaux.js';
import { RARETES } from '../js/cartes.js';
import { NOM_VARIANTE, VARIANTE_PALIERS, VARIANTE_PALIERS_G, VARIANTE_PLEINE, COTES_PAR_STATURE, EDITIONS } from '../js/rarete.js';
import { PALIERS_PACK } from '../js/inventaire.js';
import { GALONS, GALONS_MAX } from '../js/galons.js';
import { JETONS, baremeRogue, ESPACE_DE_DEPART, MANDATS, GARDES_DE_SAISON, SOUTIENS_MOINS_RANG, SOUTIENS_MOINS_SAISON, EXIGENCES, PRIME_EXIGENCE, ICO_EXIGENCE, NIVEAUX_PLEINS, ETAPES_PAR_CRAN } from '../js/rogue.js';
import { COACHS, SEUILS } from '../js/coachs.js';
import { POUSSEE, CORRECTION, PRIX_ECHELON } from '../js/echelons.js';
import { PRIX_EMBAUCHE } from '../js/personnel.js';
import { RAPPEL_MATCHS } from '../js/ballottage.js';
import { DATE_LIMITE_MATCH } from '../js/packs.js';
import { EXPEDITEURS } from '../js/vie-gm.js';
import { MOTS_DES_SCENES, sceneDeLaMise, sceneDuPalier, sceneDuDossier, sceneDuDilemme, sceneDeLaRoute, sceneDeLaBlessure, sceneDesRivaux, sceneDuButin, sceneDuMandat, sceneDesGalons, sceneDeLAdjoint } from '../js/scenes.js';
import { DOSSIERS } from '../js/dossiers.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const nombre = x => String(Math.round(x * 1000) / 1000).replace('.', ',');
const pct = x => nombre(Math.abs(x - 1) * 100);

/* ---------- 2. « énergie » n'est plus un mot de l'écran ---------- */
/* Les chaînes d'un module, sans ses commentaires : scripts/lib/chaines.mjs (partagé avec le gel des chaînes). */
{
  // Le lecteur lit vraiment : il trouve des chaînes connues, et il verrait un « énergie » glissé dans un gabarit.
  const sim = chainesDe(lire('js/sim.js')), ger = chainesDe(lire('js/gerant.js'));
  const temoin = chainesDe("// l'énergie\nconst a = `x ${b ? 'y' : `z`} énergie`; /* 'énergie' */ const r = /'/g;");
  exiger('le lecteur de chaînes lit le code', sim.includes('Plombier') && ger.some(s => /d'élan/.test(s)) && temoin.filter(s => /énergie/.test(s)).length === 1,
    `${sim.length} chaînes dans sim.js, ${ger.length} dans gerant.js`);
  const trouvés = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
    for (const ch of chainesDe(lire(`js/${f}`))) if (/énergie/i.test(ch)) trouvés.push(`${f} : « ${ch.trim().slice(0, 60)} »`);
  }
  const html = lire('index.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const texte = html.replace(/<[^>]+>/g, ' ');
  if (/énergie/i.test(texte)) trouvés.push(`index.html : « ${texte.match(/.{0,40}énergie.{0,20}/i)[0].trim()} »`);
  exiger('aucune chaîne de l\'écran ne dit « énergie » (jambes, élan, plombier)', trouvés.length === 0, trouvés.slice(0, 5).join(' · ') || 'aucune');
  /*
   * DES MOTS DE HOCKEY, PAS DE DÉVELOPPEUR (1.0, J2-9) : « hub » et « palier »
   * sont des noms de code. L'écran dit « le bureau » et « la main de la
   * journée ». On ne juge que la prose (une chaîne avec une espace) : les clés
   * et les sélecteurs (`'palier'`, `'.hub-jour'`) ne sont pas lus par le joueur.
   */
  const code = [];
  const MOTS_DE_CODE = /(^|[\s«(])(hub|paliers?)(?=[\s».,:;!?)]|$)/i;
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
    for (const ch of chainesDe(lire(`js/${f}`))) if (/\s/.test(ch.trim()) && MOTS_DE_CODE.test(ch)) code.push(`${f} : « ${ch.trim().slice(0, 60)} »`);
  }
  if (MOTS_DE_CODE.test(texte)) code.push(`index.html : « ${texte.match(/.{0,40}(hub|palier).{0,20}/i)[0].trim()} »`);
  exiger('l\'écran dit « bureau » et « main de la journée », pas « hub » ni « palier »', code.length === 0, code.slice(0, 5).join(' · ') || 'aucune');
}

/* ---------- 2c. ce qui est parti ne se promet plus ---------- */
{
  const prose = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
    for (const { s, ligne } of chainesDe(lire(`js/${f}`), { lignes: true })) prose.push({ ou: `js/${f}:${ligne}`, t: s.trim() });
  }
  const html = lire('index.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  html.split('\n').forEach((l, k) => prose.push({ ou: `index.html:${k + 1}`, t: l.trim() }));
  // Ce qui est parti ne se promet plus : les factions de S72 (partisans, médias) et la garantie « qui vaut double ».
  const partis = prose.filter(x => /partisans montent|médias s'acharnent|vaudra double/i.test(x.t)).map(x => `${x.ou} « ${x.t.slice(0, 50)} »`);
  exiger('l\'écran ne promet plus ce qui est parti (les factions, la victoire qui vaut double)', partis.length === 0, partis.slice(0, 3).join(' · ') || 'rien de parti');
}

/*
 * ---------- 2d. LES BONS CHIFFRES (V2.2) ----------
 * Ce que l'écran dit des zones, de la carrure, de la glace et des jambes est
 * calculé depuis la constante que le moteur joue, jamais recopié : le malus
 * au-dessus de sa zone (ZONE_PEN_DESSUS × crans^ZONE_PUISSANCE), le coût d'un
 * coup pour CE joueur (`coutDuCoup`), et l'infobulle d'un gardien sur la
 * règle des gardiens.
 */
{
  const src = f => lire(`js/${f}`);
  const sans = (f, re) => !re.test(src(f));
  const faits = [
    ['le malus au-dessus de sa zone vient de ZONE_PEN_DESSUS et ZONE_PUISSANCE', /ZONE_DESSUS_TITLE = `[^`]*malusDessus\(1\)/.test(src('game.js')) && /ZONE_PEN_DESSUS \* n \*\* ZONE_PUISSANCE/.test(src('game.js')) && sans('game.js', /−3 par cran/)],
    ['la fiche dit le coût d\'un coup pour CE joueur (`coutDuCoup`)', /coutDuCoup\(p\)/.test(src('fiche.js')) && sans('fiche.js', /1 - COUP_ABSORBE|1 \+ COUP_ABSORBE/)],
    ['la fiche dit l\'effet NET d\'un badge (`maitrise`, centré sur la ligue), pas le brut', /\(EFFET_ROLE\[b\.cle\] \|\| 0\) \* maitrise\(p, b\.cle\)/.test(src('fiche.js')) && sans('fiche.js', /b\.palier \/ \(b\.second/)],
    ['un joueur sans badge qui défend le lit sur sa fiche', /Sans badge qui défend/.test(src('fiche.js'))],
    ['l\'agressivité d\'une ligne est celle de ses joueurs (`agressiviteDeLigne`), sans menu', /agressiviteDeLigne\(G\.roster, unit\)/.test(src('alignement.js')) && sans('alignement.js', /data-agr/)],
    ['le niveau, la zone et le badge disent chacun à quoi ils servent', /ne joue pas au match|ne jouent? pas/.test(lire('index.html')) && /Il dit sa saison ; au match/.test(src('repechage.js')) && /Elle dit OÙ il joue/.test(src('game.js')) && /Il dit CE QU'IL FAIT au match/.test(src('gerant.js'))],
    ['les jambes d\'un gardien ont l\'infobulle des gardiens', /jambesHtml\(e, \{ gardien: true \}\)/.test(src('alignement.js')) && /GARDIEN_JAMBES_PAS/.test(src('gerant.js'))],
  ];
  for (const [nom, ok] of faits) exiger(nom, ok);
}

/*
 * ---------- 2b. le gel des chaînes (1.0, J5) ----------
 * Une seule forme par sorte de nombre, et la typographie du jeu : l'argent à
 * la québécoise (« 95,5 M$ », jamais « $95.5M »), les ordinaux « 1er, 2e »
 * (jamais « 2ème »), le « … » d'un seul caractère, une espace avant « ; ! ? »
 * comme partout ailleurs. On juge la prose de l'écran : les chaînes de js/
 * sans leurs balises, et le texte d'index.html.
 */
{
  const prose = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
    for (const { s, ligne } of chainesDe(lire(`js/${f}`), { lignes: true })) {
      const t = s.replace(/<[^>]*>/g, ' ');
      if (/\p{L}{2,}\s+\p{L}{2,}/u.test(t)) prose.push({ ou: `js/${f}:${ligne}`, t });
    }
  }
  const html = lire('index.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  prose.push({ ou: 'index.html', t: html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ') });
  // La contre-épreuve : chaque motif attrape bien la faute qu'il vise, et laisse passer la bonne forme.
  const TEMOINS = [
    [/\$\d|\b\d+(?:[.,]\d+)?M\b(?!\$)/u, 'il reste $9.3M', 'il reste 9,3 M$'],
    [/\d\s?(?:ème|eme|ième)s?\b|\b1ère\b/u, 'la 2ème période', 'la 2e période'],
    [/\p{L}\.\.\./u, 'on attend...', 'on attend…'],
    [/\p{L}[;!?](?=\s|$|["'»<])/u, 'laquelle tu prends?', 'laquelle tu prends ?'],
  ];
  exiger('les motifs du gel des chaînes attrapent ce qu\'ils visent', TEMOINS.every(([re, faux, bon]) => re.test(faux) && !re.test(bon)), `${TEMOINS.length} témoins`);
  const fautes = (nom, re) => {
    const vus = prose.filter(x => re.test(x.t)).map(x => `${x.ou} « ${(x.t.match(new RegExp(`.{0,24}${re.source}.{0,12}`, re.flags.replace('g', ''))) || [x.t])[0].trim()} »`);
    exiger(nom, vus.length === 0, vus.slice(0, 4).join(' · ') || 'aucune');
  };
  fautes('l\'argent s\'écrit « 95,5 M$ », jamais « $95.5M »', /\$\d|\b\d+(?:[.,]\d+)?M\b(?!\$)/u);
  fautes('les ordinaux s\'écrivent « 2e », jamais « 2ème »', /\d\s?(?:ème|eme|ième)s?\b|\b1ère\b/u);
  fautes('les points de suspension sont « … », pas « ... »', /\p{L}\.\.\./u);
  fautes('une espace avant « ; ! ? » (la typographie du jeu)', /\p{L}[;!?](?=\s|$|["'»<])/u);
  // Un % d'arrêts passe par pct3, l'argent par money (js/util.js) : aucun « .912 » ni « 82,0 M$ » fabriqué à la main.
  const aLaMain = [], argentMain = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js') && f !== 'util.js')) {
    lire(`js/${f}`).split('\n').forEach((l, k) => {
      if (/toFixed\(3\)\.(?:slice\(1\)|replace\(\/\^0)/.test(l)) aLaMain.push(`js/${f}:${k + 1}`);
      if (/\/\s*1e6\b[^\n]*M\$/.test(l)) argentMain.push(`js/${f}:${k + 1}`);
    });
  }
  exiger('un % d\'arrêts s\'écrit « ,912 », par pct3 (js/util.js)', aLaMain.length === 0, aLaMain.slice(0, 5).join(' · ') || 'une seule forme');
  exiger('un montant s\'écrit par money (js/util.js), jamais à la main', argentMain.length === 0, argentMain.slice(0, 5).join(' · ') || 'une seule forme');
}

/* ---------- 3 et 4. la page des règles ---------- */
{
  const html = lire('index.html');
  const a = html.indexOf('<section id="pageRegles"'), b = html.indexOf('</section>', a);
  exiger('la page des règles existe', a >= 0 && b > a);
  const brut = html.slice(a, b).replace(/<!--[\s\S]*?-->/g, ' ');
  const texte = brut.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const mots = texte.split(' ').filter(w => /[\p{L}\d]/u.test(w)).length;
  // V2.2 : la page dit ce qu'elle taisait (l'avantage numérique, la prolongation, le loto et ses retraits, l'ajustement
  // de série, l'adjoint, les sept sortes de la main, la case vide, ce qui ne vit qu'au Rogue) : 2 100 mots, pas plus.
  // Oct. 2026 : la page dit les raretés (JP : *spas clair les niveaux de rareté des cartes*) : 2 250 mots.
  // V9, tranche 8 : la page dit les exigences, cran par cran (JP : *les exigences*), et la ligue qui monte : 2 400 mots.
  // V17 : la page dit les six plans de match, chacun avec ses chiffres : 2 500 mots.
  borne('la page des règles est courte', mots, 300, 2500, 'mots');
  const taisait = [[/avantage numérique<\/strong> se joue avec tes unités spéciales/, 'l\'avantage numérique'], [/en <strong>prolongation<\/strong>, au premier but/, 'la prolongation'],
    [/le tour est dû/, 'le retrait au loto'], [/ajustement de série/, 'l\'ajustement de série'], [/L'adjoint peut jouer la série/, 'l\'adjoint en séries'],
    [/Une case vide ce soir-là : un adjoint parmi trois/, 'la carte de la case vide'], [/ne vivent qu'au Rogue/, 'ce qui ne vit qu\'au Rogue']];
  const encoreTu = taisait.filter(([re]) => !re.test(brut)).map(([, nom]) => nom);
  exiger('la page dit ce qu\'elle taisait (V2.2)', encoreTu.length === 0, encoreTu.join(' · ') || `${taisait.length} sujets dits`);
  // L'IMPACT EN CHIFFRES DE MATCH (js/impact.js) : un effet se lit en tirs et en buts par match ; la page le dit, et ne le dit plus en « Tirs +8 % ».
  exiger('la page dit qu\'un effet se lit en chiffres de match, par match', /chiffres de match/.test(texte) && /par match/.test(texte), 'chiffres de match · par match');
  exiger('la page ne lit plus un effet en pourcentage (« Tirs +8 % »)', !/(Tirs|Précision|Buts contre) [+−]\d+ ?%/.test(texte), 'plus de « Tirs +8 % »');
  const partis = [[/archétype/i, 'l\'archétype'], [/un match sur six/i, '« un match sur six »'], [/PENCHANT/, 'le PENCHANT'], [/franc-tireur|fabricant de jeu/i, 'les profils de S68'],
    [/chimie de trio/i, 'la chimie de trio de S72'], [/Trio d'énergie/i, 'le Trio d\'énergie'],
    [/système/i, 'les systèmes de ligne (V18)'], [/consigne du match/i, 'la consigne du match (V18)'], [/secondes par présence/i, 'la glace en secondes (V18)'], [/\bfit\b/i, 'le fit (V18)']];
  const encore = partis.filter(([re]) => re.test(texte)).map(([, nom]) => nom);
  exiger('la page ne parle plus de ce qui est parti', encore.length === 0, encore.join(' · ') || 'rien de parti');

  // Chaque chiffre annoncé, reconstruit depuis sa constante.
  const RARES = ['commune', 'peu', 'rare', 'legendaire'];
  const brille = stature => COTES_PAR_STATURE[stature].rare + COTES_PAR_STATURE[stature].legendaire;
  const minSal = Number((lire('js/game.js').match(/const MIN_SAL = ([\d_]+);/) || [])[1].replace(/_/g, ''));
  // Le ballottage vit dans js/banc.js depuis le découpage de js/game.js (1.0, J3-6).
  const coutBal = Number((lire('js/banc.js').match(/const COUT_BALLOTTAGE_ROGUE = (\d+);/) || [])[1]);
  const plafBal = Number((lire('js/banc.js').match(/const PLAFOND_BALLOTTAGE = ([\d.]+);/) || [])[1]);
  const slot = role => SLOTS.find(s => s.role === role && !s.scratch);
  const pen = (p, role) => getPositionPenalty(p, slot(role));
  const B = baremeRogue({});
  const ecrits = [
    [`<strong>${REROLLS.season}</strong> relances d'année, <strong>${REROLLS.team}</strong> d'équipe et <strong>${REROLLS.pass}</strong> « passer »`, 'les relances'],
    [`<strong>${nombre(CAP / 1e6)} M$</strong>`, 'le plafond'],
    [`6 cases sous ${nombre(MODES.EXPRESS.cap / 1e6)} M$`, 'le plafond Express'],
    [`moins ${nombre(minSal / 1e6)} M$ par case`, 'le budget du choix'],
    [`★ Étoile (le ${nombre(NIVEAUX.find(n => n.cle === 'etoile').haut * 100)} % du haut), ★ Phénomène (le ${nombre(NIVEAUX.find(n => n.cle === 'phenomene').haut * 100)} % du haut)`, 'les niveaux'],
    [`un centre à l'aile perd ${pen({ p: 'C', np: 'C', secP: null }, 'AG')}, un ailier au centre ${pen({ p: 'LW', np: 'L', secP: null }, 'C')}, un ailier sur l'autre aile ${pen({ p: 'LW', np: 'L', secP: null }, 'AD')}, un défenseur du mauvais côté ${pen({ p: 'D', np: 'L', secP: null }, 'DD')}`, 'les pénalités de position'],
    [`des deux tiers en ${ADAPT_MATCHS} matchs`, 'l\'adaptation'],
    [`à ${PART_UNITE.F.slice(0, 3).map(x => nombre(x * 100)).join(', ')} et ${nombre(PART_UNITE.F[3] * 100)} %, les paires à ${PART_UNITE.D.slice(0, 2).map(x => nombre(x * 100)).join(', ')} et ${nombre(PART_UNITE.D[2] * 100)} %`, 'les parts de glace'],
    // V18 : les accords d'une ligne, dans l'ordre d'AFFINITES, et ce que fait son action spéciale (SPEC_MULT).
    ...(() => {
      const mot = ([g, r]) => `${PROFILS[g][r].ico} ${PROFILS[g][r].nom.toLowerCase()}`;
      return AFFINITES.map(a => [`${mot(a.a)} et ${mot(a.b)}`, `l'accord ${a.nom}`]);
    })(),
    [`un tir qui entre ${nombre(SPEC_MULT)} fois plus souvent`, 'l\'action spéciale'],
    // La robustesse (1.0, le dur de quatrième trio) : un écart-type, un soir ordinaire et un soir éreintant, et la dissuasion.
    [`ta finition monte de ${nombre(Math.round((Math.exp(K_ROB * ROB_ORDINAIRE) - 1) * 1000) / 10)} % et la sienne baisse d'autant ; un soir éreintant (un dos-à-dos) de ${nombre(Math.round((Math.exp(K_ROB) - 1) * 1000) / 10)} %`, 'la robustesse'],
    [`réduit les blessures de tes joueurs de ${nombre(Math.round((1 - Math.exp(-DISSUASION)) * 100))} %`, 'la dissuasion'],
    // Les badges (refonte 1) : chaque effet Platine, depuis EFFET_ROLE ; les coups, depuis COUP_JAMBES et COUP_ABSORBE.
    [`(lancers adverses −${nombre(EFFET_ROLE.checker * 100)} %, two-way et physique −${nombre(EFFET_ROLE.deuxsens * 100)} %)`, 'les badges qui étouffent'],
    [`(finition −${nombre(EFFET_ROLE.bagarreur * 100)} %)`, 'le bagarreur'],
    [`(ses coéquipiers +${nombre(EFFET_ROLE.power * 100)} %)`, 'le power forward'],
    [`(usure −${nombre(EFFET_ROLE.energie * 100)} %)`, 'le plombier'],
    [`(${nombre(1 + EFFET_ROLE.sniper)} fois plus)`, 'le sniper'],
    [`(sa paire +${nombre(EFFET_ROLE.offensif * 100)} %)`, 'le défenseur offensif'],
    [`finition +${nombre(EFFET_PALIER.finition * 100)} %, jeu +${nombre(EFFET_PALIER.creation * 100)} %, lancers +${nombre(EFFET_PALIER.lancers * 100)} %, lancers adverses −${nombre(EFFET_PALIER.defense * 100)} %, buts accordés au gardien −${nombre(EFFET_PALIER.arrets * 100)} %`, 'un palier gagné'],
    [`Chaque coup reçu coûte ${nombre(COUP_JAMBES)} jambes à un joueur moyen, de ${nombre(COUP_JAMBES * (1 - COUP_ABSORBE))} au plus costaud 🪨 à ${nombre(COUP_JAMBES * (1 + COUP_ABSORBE))} au plus léger 🪶 : la fiche dit le sien.`, 'les coups'],
    // Le jeu physique en événements (1.0).
    [`le frappé perd ${nombre(COUP_MARQUANT_JAMBES)} jambes sur-le-champ et se blesse ${nombre(BLESSURE_SONNE)} fois plus ce soir`, 'le coup marquant'],
    [`${BAGARRE_MINUTES} minutes et ${BAGARRE_JAMBES} jambes chacun, hors de leurs unités pendant ce temps ; le club du vainqueur gagne ${nombre(Math.round((ELAN_BAGARRE - 1) * 100))} % de finition pendant ${ELAN_DUREE} minutes, le perdant en perd ${nombre(Math.round((1 - ELAN_BAGARRE_PERDU) * 100))} %, et le battu se blesse ${nombre(BLESSURE_BAGARRE_PERDUE)} fois plus ce soir`, 'la bagarre'],
    [`${MELEE_MINUTES} minutes qui s'annulent`, 'la mêlée'],
    [`à ${ENERGIE_REF}, il rend sa moyenne ; chaque point de moins lui coûte ${nombre(ENERGIE_EFFET)} %`, 'l\'effet des jambes'],
    [`Frais (${NIVEAUX_JAMBES[0].min} et plus), Correct (${NIVEAUX_JAMBES[1].min}), Lourd (${NIVEAUX_JAMBES[2].min}), Vidé`, 'les niveaux de fatigue'],
    [`sous ${ENERGIE_BLESSURE}, il se blesse plus`, 'le seuil de blessure'],
    [`entre ${nombre(PART_AUX_MIN * 100)} et ${nombre(PART_AUX_MAX * 100)} %`, 'la part de l\'auxiliaire'],
    [`en prend ${nombre(PART_SANS_AUX * 100)} %`, 'le gardien rappelé'],
    [`${['zéro', 'un', 'deux', 'trois', 'quatre'][GARDIEN_SUITE_LIBRE]} départs de suite ; au ${['', 'deuxième', 'troisième', 'quatrième', 'cinquième'][GARDIEN_SUITE_LIBRE]}, il en perd ${GARDIEN_JAMBES_PAS} par départ, jamais sous ${GARDIEN_JAMBES_MIN}, et chaque ${GARDIEN_JAMBES_PAS} points perdus lui coûtent ${nombre(GARDIEN_USURE * 100)} %`, 'la fatigue des gardiens'],
    [ANNONCE_GROS === 1 ? 'annoncé la veille' : `annoncé ${ANNONCE_GROS} journées d'avance`, 'l\'annonce du gros match'],
    [`<strong>duel en ${['zéro', 'une', 'deux', 'trois', 'quatre'][PERIODES_DU_DUEL.length]} périodes</strong>`, 'le duel'],
    [`${INTENTIONS.ombre.ico} l'ombre suit ta vedette, ${INTENTIONS.chasse.ico} la chasse vise ton défenseur, ${INTENTIONS.centre.ico} il ferme le centre, ${INTENTIONS.assaut.ico} il lance de partout, ${INTENTIONS.cachot.ico} il cherche tes punitions`, 'les intentions'],
    [MISE_DOUBLEE === 2 ? 'tu peux doubler la mise' : '(la mise ne double plus)', 'la mise doublée'],
    // V9, tranche 7 : les galons (js/galons.js) et le chandail retiré (`CHANDAIL_GALONS`, js/rogue.js).
    [`${GALONS.buts.seuil} buts, ${GALONS.passes.seuil} passes, ${GALONS.victoires.seuil} victoires, un point dans ${GALONS.grandsSoirs.seuil} gros matchs gagnés ou ${GALONS.recrue.seuil} points d'une recrue montent son badge d'un métal pour la run (${['zéro', 'un', 'deux', 'trois'][GALONS_MAX]} au plus) ; ${['zéro', 'un', 'deux', 'trois', 'quatre'][Number((lire('js/rogue.js').match(/const CHANDAIL_GALONS = (\d+);/) || [])[1])]} retirent son chandail`, 'les galons'],
    // V9, tranche 6 : la commotion qui se souvient (`COMMOTION_MEMOIRE`, js/sim.js) — « de moitié » pour 0,5.
    [`Une commotion allonge la suivante de ${{ 0.5: 'moitié', 1: 'son double' }[Number((lire('js/sim.js').match(/const COMMOTION_MEMOIRE = ([\d.]+);/) || [])[1])] || '?'}`, 'la commotion'],
    // V9, tranche 5b, puis V16 : tes adjoints et les paliers de la saison.
    [`aux ${PALIERS_PACK.slice(0, -1).map(k => `${k}e`).join(', ')} et ${PALIERS_PACK.at(-1)}e matchs, un adjoint parmi trois`, 'les paliers de la saison'],
    [`${PALIERS_CARTES.slice(0, -1).map(k => `${k}e`).join(', ')} et ${PALIERS_CARTES[PALIERS_CARTES.length - 1]}e matchs`, 'les paliers'],
    [`de ${pct(OBJECTIF_RATE.energie)} % de plus pendant ${OBJECTIF_RATE.duree} matchs.`, 'l\'objectif raté'],
    [`sous ${nombre(plafBal * 100)} % du plafond`, 'le plafond du ballottage'],
    [`de ${RAPPEL_MATCHS[0]} à ${RAPPEL_MATCHS[1]} matchs dans sa saison`, 'le rappel au ballottage'],
    [`Après ton ${DATE_LIMITE_MATCH}e match, la date limite des échanges`, 'la date limite'],
    [`${JETONS.depart} jetons et ${nombre(ESPACE_DE_DEPART / 1e6)} M$ sous le plafond`, 'le départ Rogue'],
    [`une victoire ${B.victoire} jetons (${B.victoire + 3}, puis ${B.victoire + 5} avec les commanditaires), une défaite en prolongation ${B.prolongation}, une défaite ${B.defaite}, un gros match gagné ${B.grosMatch}, un objectif du proprio ${B.objectif}, une ronde de séries gagnée ${B.serie}`, 'le barème des jetons'],
    [`une réclamation coûte ${coutBal} jetons`, 'la réclamation Rogue'],
    [`tu gardes ${GARDES_DE_SAISON.map(k => `un ${NIVEAUX[k].nom}`).join(' et ')}, chacun tiré au loto de ton équipe`, 'les gardés entre deux saisons'],
    [`<strong>Les exigences</strong> ${ICO_EXIGENCE} :`, 'l\'icône des exigences'],
    [`paie ${nombre(PRIME_EXIGENCE * 100)} % de médailles de plus : ${EXIGENCES.map(E => E.texte).join(' ; ')}.`, 'les exigences'],
    // La ligue qui monte (tranche 8, puis le 27 oct.) : des clubs de toute l'histoire aux premiers rangs, puis les éditions.
    [`des clubs de toute l'histoire aux ${NIVEAUX_PLEINS === 2 ? 'deux' : NIVEAUX_PLEINS} premiers rangs`, 'les premières ligues'],
    [`Un cran d'exigence en vaut ${ETAPES_PAR_CRAN}.`, 'la ligue et les exigences'],
    [SOUTIENS_MOINS_RANG === SOUTIENS_MOINS_SAISON ? `tes cartes Soutien, ${SOUTIENS_MOINS_RANG} de moins par rang de prestige et par saison` : '(le quota de Soutien change autrement par rang et par saison)', 'le quota de Soutien'],
    // v2 : les coachs (js/coachs.js) — leur nombre et les seuils de la confiance.
    [`la couleur d'un de ${Object.keys(COACHS).length} coachs`, 'le nombre de coachs'],
    [`ses <strong>${MODES.LOTO.relances}</strong> relances relancent les trois d'un coup`, 'les relances du loto'],
    [`trois cartes : ${Object.keys(SORTES_DECK).length === 3 ? 'un vrai joueur, un nouveau rôle, l\'atelier' : '(les sortes ont changé)'}`, 'les sortes de la main'],
    // V20 : la confiance par le seul chiffre tenu (js/chiffre.js).
    [`chaque bloc de ${BLOC === 10 ? 'dix' : BLOC} matchs où son chiffre est tenu vaut ${POINTS_PAR_BLOC} point${POINTS_PAR_BLOC > 1 ? 's' : ''} : II à ${SEUILS[1]} (${blocsDe(SEUILS[1])} blocs), III à ${SEUILS[2]} (${blocsDe(SEUILS[2])} blocs)`, 'les seuils de la confiance'],
    // V14 : les échelons du personnel (js/echelons.js) ; V20 : achetés quand on veut, la couleur, l'embauche (js/personnel.js).
    [`Un échelon s'achète quand tu veux : ${PRIX_ECHELON.slice(2, -1).join(', ')} puis ${PRIX_ECHELON[3]} jetons ; un doublon tiré d'un pack en paie un. À chaque échelon, tu choisis : sa force grandit de ${nombre(POUSSEE * 100)} %, ou son défaut fond de ${nombre((1 - CORRECTION) * 100)} %.`, 'les échelons du personnel'],
    [`Engager est gratuit au camp, puis coûte ${Object.values(PRIX_EMBAUCHE).slice(0, -1).join(', ')} ou ${Object.values(PRIX_EMBAUCHE).at(-1)} jetons selon sa rareté`, 'le prix d\'embauche'],
    // V7 : tes unités spéciales (js/sim.js `unitesSpeciales`), leurs parts du temps.
    [`${nombre(POIDS_AN[0] * 100)} et ${nombre(POIDS_AN[1] * 100)} % du temps, deux en désavantage à ${nombre(POIDS_DN[0] * 100)} et ${nombre(POIDS_DN[1] * 100)} %`, 'les unités spéciales'],
    // V3.6 : la lancée, le doute et le feu qui s'entretient (`LANCEE`, js/sim.js ; le vendeur de chandails, js/banque.js).
    [`${LANCEE.buts} buts en ${LANCEE.matchs} matchs, et ${nombre(LANCEE.facteur)} fois son vrai rythme, mettent un joueur <strong>sur sa lancée</strong> : précision +${pct(LANCEE.lancee.finition)} %, tirs +${pct(LANCEE.lancee.lancers)} %`, 'la lancée'],
    [`sans but en ${LANCEE.doute.matchs} matchs <strong>doute</strong> : précision −${pct(LANCEE.doute.finition)} %`, 'le doute'],
    [`l'allume à ${LANCEE.etincelle.buts} buts et la rend vive (précision +${pct(LANCEE.vive.finition)} %, tirs +${pct(LANCEE.vive.lancers)} %)`, 'l\'étincelle'],
    [`la garde jusqu'à ${LANCEE.braise.fenetre} matchs de plus tant qu'il marque une fois en ${LANCEE.braise.sans}`, 'la braise'],
    [`paie ${PATRONS.dir_chandails.econ.jetonsLancee} jeton par joueur sur sa lancée, chaque soir`, 'le vendeur de chandails'],
    // Les raretés (oct. 2026) : les gemmes et les noms de la carte (js/cartes.js, js/rarete.js), les cotes d'une brillante par stature.
    [RARES.map(r => `${RARETES[r].gemme} ${RARETES[r].nom.toLowerCase()}`).join(', '), 'les gemmes des cartes de jeu'],
    [`de 1 à ${EDITIONS.length}, qui change la carte entière : ${NOM_VARIANTE.commune} ; ${NOM_VARIANTE.peu}, un cadre de métal`, 'les éditions d\'une carte de joueur'],
    [`; ${NOM_VARIANTE.hors}, la photo prend toute la carte`, 'le Hors-cadre'],
    [`; ${NOM_VARIANTE.rare}, la feuille d'or`, 'l\'Or'],
    [`; ${NOM_VARIANTE.legendaire}, le prisme`, 'la Holo'],
    [`monte d'un, deux ou trois métaux`.replace('un, deux ou trois', ['peu', 'rare', 'legendaire'].map(r => ['zéro', 'un', 'deux', 'trois'][VARIANTE_PALIERS_G[r]]).join(', ').replace(/, (\S+)$/, ' ou $1')), 'les métaux d\'un gardien'],
    [`Or ou Holo : ${nombre(brille(0))} % des cartes d'un Soutien, ${nombre(brille(NIVEAUX.findIndex(n => n.cle === 'phenomene')))} % d'un ★ Phénomène`, 'les cotes d\'une brillante'],
    // V17 : les plans de match, chacun depuis PLANS (js/sim.js) ; un facteur se dit en écart (×0,88 : −12 %).
    ...(() => {
      const ec = x => `${x > 1 ? '+' : '−'}${nombre(Math.round(Math.abs(x - 1) * 1000) / 10)} %`;
      const { tirer, ombre, centre, assaut, discipline } = PLANS;
      return [
        [`${tirer.ico} ${tirer.nom} : tirs ${ec(tirer.toi.volume)}, précision ${ec(tirer.toi.finition)}, usure des jambes ${ec(tirer.toi.energie)}`, 'le plan 🌧'],
        [`${ombre.ico} ${ombre.nom} : leur meilleur marqueur, tirs ${ec(ombre.vedette.lancers)}, précision et jeu ${ec(ombre.vedette.finition)} ; ton attaquant le plus défensif le suit, tirs ${ec(ombre.colle.lancers)} et jeu ${ec(ombre.colle.creation)} ; tes tirs ${ec(ombre.toi.volume)}`, 'le plan 🥷'],
        [`${centre.ico} ${centre.nom} : leurs tirs ${ec(centre.adv.volume)}, leur précision ${ec(centre.adv.finition)}, tes tirs ${ec(centre.toi.volume)}`, 'le plan ⛔'],
        [`${assaut.ico} ${assaut.nom} : tirs ${ec(assaut.toi.volume)}, précision ${ec(assaut.toi.finition)}, punitions ${ec(assaut.toi.discipline)}, usure des jambes ${ec(assaut.toi.energie)}`, 'le plan 🐗'],
        [`${discipline.ico} ${discipline.nom} : punitions ${ec(discipline.toi.discipline)}, robustesse −${nombre(-discipline.toi.robustesse)}, tirs ${ec(discipline.toi.volume)}`, 'le plan 🧘'],
      ];
    })(),
  ];
  // Ce que la page dit d'une édition, en mots : le Cadre monte le second badge d'un métal, le Hors-cadre les deux, l'Or
  // aussi et son second rend plein, la Holo les deux de deux métaux.
  exiger('les éditions sont celles que la page dit', JSON.stringify(VARIANTE_PALIERS) === JSON.stringify({ commune: [0, 0], peu: [0, 1], hors: [1, 1], rare: [1, 1], legendaire: [2, 2] })
    && VARIANTE_PLEINE.rare && VARIANTE_PLEINE.legendaire && !VARIANTE_PLEINE.peu && !VARIANTE_PLEINE.hors, EDITIONS.map(r => NOM_VARIANTE[r]).join(' · '));
  // Les commanditaires : +3 puis +2 (js/rogue.js, `baremeRogue`).
  const parVictoire = d => baremeRogue({ deblocages: d }).victoire;
  exiger('les commanditaires valent +3 puis +2 par victoire', parVictoire([]) === B.victoire && parVictoire(['commanditaire1']) === B.victoire + 3 && parVictoire(['commanditaire1', 'commanditaire2']) === B.victoire + 5,
    `${parVictoire([])} · ${parVictoire(['commanditaire1'])} · ${parVictoire(['commanditaire1', 'commanditaire2'])}`);
  const manquants = ecrits.filter(([t]) => !brut.includes(t)).map(([t, nom]) => `${nom} (« ${t.slice(0, 70)} »)`);
  exiger('chaque chiffre de la page vient de sa constante', manquants.length === 0, manquants.join(' · ') || `${ecrits.length} chiffres vérifiés`);
  const mandats = MANDATS.map(m => m.mot);
  exiger('les mandats du proprio sont ceux du code', /faire les séries, puis finir dans les dix premiers, puis les six, puis les trois premiers/.test(texte) && mandats.length === 4,
    mandats.join(' → '));
}

/*
 * ---------- 5. chaque choix dit qui le demande ----------
 * Chaque scène, sur des faits fabriqués (toutes les situations, quarante graines) : sa voix est une voix d'EXPEDITEURS,
 * sa réplique n'est pas vide et ne dit ni chiffre ni gabarit (le motif de check_fils), son fait porte chaque nombre
 * reçu. Et chaque réplique écrite, pas seulement celles que les graines pigent.
 */
{
  const voix = new Set(Object.values(EXPEDITEURS));
  const fautes = [];
  const juger = (nom, sc, nombres) => {
    if (!voix.has(sc.de)) fautes.push(`${nom} : la voix « ${sc.de && sc.de.nom} » n'est pas d'EXPEDITEURS`);
    if (!sc.mot || /\d|\{/.test(sc.mot)) fautes.push(`${nom} : « ${sc.mot} »`);
    for (const x of nombres) if (!sc.fait.includes(String(x))) fautes.push(`${nom} : le fait « ${sc.fait} » ne dit pas ${x}`);
  };
  let n = 0;
  for (let g = 0; g < 40; g++) {
    for (const [moi, lui] of [[3, 1], [2, 2], [0, 4]]) { juger('la mise', sceneDeLaMise({ moi, lui, rival: 'Bruins 1995-96', graine: g }), [moi, lui, 'Bruins 1995-96']); n++; }
    for (const rang of [2, 16, 31]) { juger('le palier', sceneDuPalier({ n: 18, fiche: { V: 7, D: 9, DP: 2 }, rang, equipes: 32, mandat: 'faire les séries', graine: g }), [18, '7-9-2', `${rang}e`, 'faire les séries']); n++; }
  }
  // A3 à A6 (V10, tranche 5) : la route recommandée répond au pire problème (les jambes et l'infirmerie au repos, la caisse à la commandite).
  for (let g = 0; g < 40; g++) {
    for (const [f, route, nombres] of [[{ jambes: 64, blesses: 1, dos: 0, caisse: 50 }, 'repos', [64]], [{ jambes: 88, blesses: 3, dos: 1, caisse: 50 }, 'repos', [3]],
      [{ jambes: 80, blesses: 0, dos: 2, caisse: 50 }, 'repos', [2, 80]], [{ jambes: 90, blesses: 1, dos: 0, caisse: 12 }, 'commandite', [12]], [{ jambes: 91, blesses: 0, dos: 1, caisse: 60 }, 'entrainement', [91]]]) {
      const sc = sceneDeLaRoute({ ...f, graine: g });
      juger('la route', sc, nombres); n++;
      if (sc.route !== route) fautes.push(`la route : ${JSON.stringify(f)} recommande ${sc.route}, pas ${route}`);
    }
    for (const [k, t] of [[3, 3], [9, 12]]) { juger('la blessure', sceneDeLaBlessure({ joueur: 'Al Secord', n: k, total: t, ou: 'T2 · ailier gauche', adv: 'Wild 2010-11', graine: g }), ['Al Secord', k, ...(t > k ? [t] : []), 'T2 · ailier gauche', 'Wild 2010-11']); n++; }
    for (const multi of [3, 1]) { juger('les rivaux', sceneDesRivaux({ multi, offerts: 5, graine: g }), [multi, 5]); n++; }
    for (const [pour, contre] of [[4, 2], [6, 1]]) { juger('le butin', sceneDuButin({ pour, contre, adv: 'Bruins 1995-96', graine: g }), [pour, contre, 'Bruins 1995-96']); n++; }
    // A8 (Jalon M) : le proprio dit le mandat, le capitaine les galons.
    for (const sort of ['rate', 'rempli', 'coupe']) { juger('le mandat', sceneDuMandat({ sort, fiche: { V: 21, D: 52, DP: 9 }, rang: 30, equipes: 32, mandat: 'faire les séries', graine: g }), ['21-52-9', '30e', 32, 'faire les séries']); n++; }
    // V17 : ton adjoint, à chaque entracte d'un duel ; le fait nomme leur intention, ton visé, le rival et le pointage.
    for (const raison of Object.keys(MOTS_DES_SCENES.adjoint)) for (const k of [0, 2]) {
      juger('l\'adjoint', sceneDeLAdjoint({ intention: { ico: '🥷', nom: 'L\'ombre' }, cible: 'Sundin', raison, moi: 2, lui: 1, k, rival: 'Bruins 1995-96', graine: g }), ['Sundin', 'Bruins 1995-96', ...(k ? [2, 1] : [])]); n++;
    }
    for (const noms of [['Radek Dvorak'], ['Radek Dvorak', 'Hampus Lindholm', 'Radek Dvorak']]) { juger('les galons', sceneDesGalons({ noms, graine: g }), [noms.length, ...new Set(noms)]); n++; }
  }
  /*
   * LES DOSSIERS (V10, tranche 5) : sur des faits fabriqués, chacun aux nombres distincts, le fait d'un dossier ne dit que
   * des nombres reçus, et il en dit au moins un — ou le club nommé.
   */
  const F = { n: 24, jambes: 91, pire: { n: 'Doug Gilmour', cle: 'g', j: 74 },
    boude: { n: 'Radek Bonk', cle: 'b', zone: 'Top 6', ou: '4e trio', pts: 3, m: 10 }, puni: { n: 'Tie Domi', cle: 'd', pun: 5, m: 8 },
    muet: { n: 'Alexei Yashin', cle: 'y', sal: '7,6 M$', pts: 1, m: 10 }, blesses: [{ n: 'Al Secord', m: 9 }, { n: 'Tie Domi', m: 5 }, { n: 'Rob Ray', m: 2 }],
    soirs: 4, dos: 1, visiteur: 3, domicile: 3, rival: 'Bruins 1995-96', bete: 'Wild 2010-11', caisse: 18,
    dernier: { pour: 0, contre: 6, adv: 'Kings 1993-94' }, rang: 30, equipes: 32,
    masse: { espace: 800_000, libre: '0,8 M$', lourd: { n: 'Alexei Yashin', cle: 'y', sal: '7,6 M$' } }, defaites: 5, coach: 'La Tortue',
    coachs: [{ cle: 'essaim', nom: 'Le Frelon', ico: '🐝' }, { cle: 'aigle', nom: 'L\'Aigle', ico: '🦅' }] };
  const recus = new Set(JSON.stringify(F).match(/\d+/g));
  for (let g = 0; g < 40; g++) for (const cle of Object.keys(DOSSIERS)) {
    const sc = sceneDuDossier(cle, F, g);
    juger(`le dossier ${cle}`, sc, []);
    const nombres = sc.fait.match(/\d+/g) || [];
    if (nombres.some(x => !recus.has(x))) fautes.push(`le dossier ${cle} : « ${sc.fait} » dit un nombre qu'il n'a pas reçu`);
    if (!nombres.length && !/Bruins|Wild|Kings/.test(sc.fait)) fautes.push(`le dossier ${cle} : « ${sc.fait} » ne dit aucun fait`);
    n++;
  }
  /*
   * LES DILEMMES (oct. 2026) : sur un fait fabriqué, la voix du dilemme, une réplique de son fait, et un fait qui ne
   * dit que des nombres reçus et nomme quelqu'un ou dit un nombre. Le vrai fait de chacun : scripts/check_dilemmes.mjs.
   */
  const FD = { joueur: { n: 'Al Secord' }, joueurs: [{ n: 'Al Secord' }, { n: 'Tie Domi' }], n: 7, m: 3, vieux: 'Larry Robinson', aux: 'Ron Hextall' };
  for (let g = 0; g < 40; g++) for (const cle of Object.keys(MOMENTS)) {
    const sc = sceneDuDilemme(cle, FD, g);
    juger(`le dilemme ${cle}`, sc, []);
    const nombres = sc.fait.match(/\d+/g) || [];
    if (nombres.some(x => !['7', '3'].includes(x))) fautes.push(`le dilemme ${cle} : « ${sc.fait} » dit un nombre qu'il n'a pas reçu`);
    if (!nombres.length && !/Secord|Domi|Robinson/.test(sc.fait)) fautes.push(`le dilemme ${cle} : « ${sc.fait} » ne dit aucun fait`);
    n++;
  }
  const repliques = [...Object.entries(MOTS_DES_SCENES).flatMap(([sc, sits]) => Object.entries(sits).flatMap(([sit, mots]) => mots.map(m => [`${sc}/${sit}`, m]))),
    ...Object.entries(DOSSIERS).flatMap(([cle, D]) => D.mots.map(m => [`dossier/${cle}`, m]))];
  for (const [ou, m] of repliques) if (!m || /\d|\{/.test(m)) fautes.push(`${ou} : « ${m} »`);
  informer('les scènes', `${n} scènes jouées, ${repliques.length} répliques écrites`);
  exiger('chaque choix dit qui le demande : une voix, une réplique sans chiffre, un fait qui porte ses nombres', fautes.length === 0, fautes.slice(0, 4).join(' · ') || 'la mise, le palier, la carte de trop, la route, la blessure, les rivaux, le butin, le mandat, les galons, les dossiers, les dilemmes');
}

verdict('La clarté');
