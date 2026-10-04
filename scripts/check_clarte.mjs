/*
 * LA CLARTÉ (1.0, jalon C). JP : *je comprends pas plusieurs mécaniques … trop
 * de catégories de stats, trop floues* ; puis *je veux variété de build, pas
 * trop simple, complexe mais clair*. La profondeur reste ; ce qui se vérifie
 * ici, c'est qu'elle se lit :
 *
 *   1. UNE ICÔNE = UN SENS dans les familles d'étiquettes qu'on voit en
 *      jouant (rôles, systèmes, traits, bonus de carte, styles de gardien,
 *      carrure, agressivité, consigne). « Two-way » en attaque et en défense,
 *      c'est le même sens ; 🎯 sniper et 🎯 précision, deux.
 *   2. « ÉNERGIE » N'EST PLUS UN MOT DE L'ÉCRAN : la fatigue s'appelle les
 *      jambes, la mana des cartes l'élan, le rôle le plombier. On lit les
 *      chaînes de js/ (commentaires enlevés) et le texte d'index.html.
 *   3. LA PAGE DES RÈGLES ne parle plus de ce qui est parti (l'archétype d'un
 *      patineur, « un match sur six », le PENCHANT, les profils de S68) et
 *      reste courte (moins de 1 800 mots).
 *   4. SES CHIFFRES SONT CEUX DU CODE : chaque nombre qu'elle annonce se
 *      reconstruit ici depuis sa constante — une règle recopiée est une règle
 *      qui ment tôt ou tard.
 *
 *   node scripts/check_clarte.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exiger, borne, informer, verdict } from './verdict.mjs';
import { chainesDe } from './lib/chaines.mjs';
import {
  PROFILS, TACTIQUES, SYSTEMES_D, AGRESSIVITES, IMPORTANCES, CAP, REROLLS, MODES, SEC_MIN, SEC_MAX, SEC_DEFAUT, PART_UNITE,
  ENERGIE_REF, ENERGIE_EFFET, ENERGIE_BLESSURE, NIVEAUX_JAMBES, PART_AUX_MIN, PART_AUX_MAX, PART_SANS_AUX,
  GARDIEN_SUITE_LIBRE, GARDIEN_JAMBES_PAS, GARDIEN_JAMBES_MIN, GARDIEN_USURE, ANNONCE_GROS, PALIERS_CARTES, OBJECTIF_RATE,
  PREP_JUSTE, PREP_RATEE, ADAPT_MATCHS, SLOTS, getPositionPenalty, effetDeMoment, AD_DE_CONSIGNE, K_ROB, ROB_ORDINAIRE, DISSUASION,
  EFFET_ROLE, BADGE_CHIMIE, COUP_JAMBES, COUP_ABSORBE, COUP_MARQUANT_JAMBES, BLESSURE_SONNE, BAGARRE_MINUTES, ELAN_BAGARRE, ELAN_BAGARRE_PERDU, ELAN_DUREE,
  BLESSURE_BAGARRE_PERDUE, MELEE_MINUTES,
} from '../js/sim.js';
import { TRAITS } from '../js/traits.js';
import { BONUS } from '../js/rarete.js';
import { ARCHETYPES } from '../js/ratings.js';
import { NIVEAUX } from '../js/niveaux.js';
import { TAILLE_MAIN, ENERGIE_MAIN, DECK_DEPART, energieAdverse, MATCH_ADVERSE_FORT } from '../js/combat.js';
import { JETONS, baremeRogue, PLAFOND_ROGUE, MANDATS, GARDES_DE_SAISON, SOUTIENS_MOINS_RANG, SOUTIENS_MOINS_SAISON } from '../js/rogue.js';
import { COACHS, SEUILS } from '../js/coachs.js';
import { RAPPEL_MATCHS } from '../js/ballottage.js';
import { DATE_LIMITE_MATCH } from '../js/packs.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const nombre = x => String(Math.round(x * 1000) / 1000).replace('.', ',');
const pct = x => nombre(Math.abs(x - 1) * 100);
// Une consigne telle que le moteur la pose (importance + répartition), arrondie au point comme l'écran l'affiche.
const pctE = (k, canal) => String(Math.round(Math.abs(effetDeMoment({ jour: 0, match: { importance: k, ad: AD_DE_CONSIGNE[k] } })[canal] - 1) * 100));

/* ---------- 1. une icône = un sens ---------- */
{
  const sens = new Map();   // icône → Set de sens
  const noter = (ico, quoi, famille) => {
    if (!ico) return;
    const k = ico.replace(/️/g, '');
    if (!sens.has(k)) sens.set(k, new Map());
    sens.get(k).set(quoi.toLowerCase(), famille);
  };
  for (const g of ['F', 'D']) for (const R of Object.values(PROFILS[g])) noter(R.ico, `rôle ${R.nom}`, 'rôle');
  // « Hourra » et « Sans consigne » : le même sens, aucun système.
  for (const [k, T] of Object.entries(TACTIQUES)) noter(T.ico, k === 'hourra' ? 'aucun système' : `système ${T.nom}`, 'système');
  for (const [k, S] of Object.entries(SYSTEMES_D)) noter(S.ico, k === 'hourra' ? 'aucun système' : `système ${S.nom}`, 'système');
  for (const T of Object.values(TRAITS)) noter(T.icon, `trophée ${T.label}`, 'trait');
  for (const B of Object.values(BONUS)) noter(B.ico, `bonus ${B.nom}`, 'bonus de carte');
  for (const k of ['WALL', 'ACROBAT', 'WORKHORSE', 'HYBRID_G']) noter(ARCHETYPES[k].icon, `gardien ${ARCHETYPES[k].label}`, 'style de gardien');
  for (const A of AGRESSIVITES) noter(A.ico, `agressivité ${A.nom}`, 'agressivité');
  for (const I of Object.values(IMPORTANCES)) noter(I.ico, `consigne ${I.nom}`, 'consigne');
  // La carrure vit dans js/gerant.js (`carrureDe`) : ses deux icônes, lues dans la source.
  const gerant = lire('js/gerant.js');
  const carrure = gerant.match(/^(?:export )?const carrureDe = [^\n]+/m);
  exiger('la carrure a ses deux icônes, 🪨 costaud et 🪶 léger', !!carrure && /🪨', mot: 'Costaud'/.test(carrure[0]) && /🪶', mot: 'Léger'/.test(carrure[0]), carrure ? '' : 'carrureDe introuvable');
  noter('🪨', 'carrure costaud', 'carrure'); noter('🪶', 'carrure léger', 'carrure');
  // v2 : les coachs (js/coachs.js) — un totem chacun, qu'aucune autre étiquette ne porte.
  for (const C of Object.values(COACHS)) noter(C.ico, `coach ${C.nom}`, 'coach');
  // « Two-way » en attaque et en défense : un seul sens.
  const doublons = [...sens].filter(([, m]) => m.size > 1).map(([ico, m]) => `${ico} = ${[...m.keys()].join(' / ')}`);
  informer('icônes lues', `${sens.size} icônes dans 10 familles`);
  exiger('une icône = un sens', doublons.length === 0, doublons.join(' · ') || 'aucun doublon');
  exiger('« Défensif » ne nomme qu\'un rôle', Object.values(BONUS).every(B => B.nom !== 'Défensif') && ARCHETYPES.WALL.label !== TRAITS.VEZINA.label,
    'le bonus de carte s\'appelle Étanche ; le gardien-mur ne s\'appelle plus « Gardien d\'élite » (le trophée Vézina)');
  exiger('« Régulier » ne nomme qu\'un niveau', ARCHETYPES.HYBRID_G.label.indexOf('régulier') < 0 && ARCHETYPES.HYBRID_G.short !== 'Régulier', ARCHETYPES.HYBRID_G.label);
}

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
  borne('la page des règles est courte', mots, 300, 1800, 'mots');
  // L'IMPACT EN CHIFFRES DE MATCH (js/impact.js) : un effet se lit en tirs et en buts par match ; la page le dit, et ne le dit plus en « Tirs +8 % ».
  exiger('la page dit qu\'un effet se lit en chiffres de match, par match', /chiffres de match/.test(texte) && /par match/.test(texte), 'chiffres de match · par match');
  exiger('la page ne lit plus un effet en pourcentage (« Tirs +8 % »)', !/(Tirs|Précision|Buts contre) [+−]\d+ ?%/.test(texte), 'plus de « Tirs +8 % »');
  const partis = [[/archétype/i, 'l\'archétype'], [/un match sur six/i, '« un match sur six »'], [/PENCHANT/, 'le PENCHANT'], [/franc-tireur|fabricant de jeu/i, 'les profils de S68'],
    [/chimie de trio/i, 'la chimie de trio de S72'], [/Trio d'énergie/i, 'le Trio d\'énergie']];
  const encore = partis.filter(([re]) => re.test(texte)).map(([, nom]) => nom);
  exiger('la page ne parle plus de ce qui est parti', encore.length === 0, encore.join(' · ') || 'rien de parti');

  // Chaque chiffre annoncé, reconstruit depuis sa constante.
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
    [`de ${SEC_MIN} à ${SEC_MAX} secondes par présence, ${SEC_DEFAUT} par défaut`, 'la glace'],
    [`à ${PART_UNITE.F.slice(0, 3).map(x => nombre(x * 100)).join(', ')} et ${nombre(PART_UNITE.F[3] * 100)} %, les paires à ${PART_UNITE.D.slice(0, 2).map(x => nombre(x * 100)).join(', ')} et ${nombre(PART_UNITE.D[2] * 100)} %`, 'les parts de glace'],
    // 1.0 (J2-11) : la consigne porte la répartition attaque / défense ; ses chiffres sont ceux que le moteur pose (`effetDeMoment`).
    [`basse (précision −${pctE('basse', 'finition')} %, usure des jambes −${pctE('basse', 'energie')} %)`, 'la consigne basse'],
    [`haute (précision +${pctE('haute', 'finition')} %, buts contre −${pctE('haute', 'defense')} %, blessures +${pctE('haute', 'blessure')} %, usure des jambes +${pctE('haute', 'energie')} %)`, 'la consigne haute'],
    // La robustesse (1.0, le dur de quatrième trio) : un écart-type, un soir ordinaire et un soir éreintant, et la dissuasion.
    [`ta finition monte de ${nombre(Math.round((Math.exp(K_ROB * ROB_ORDINAIRE) - 1) * 1000) / 10)} % et la sienne baisse d'autant ; un soir éreintant (un dos-à-dos) de ${nombre(Math.round((Math.exp(K_ROB) - 1) * 1000) / 10)} %`, 'la robustesse'],
    [`réduit les blessures de tes joueurs de ${nombre(Math.round((1 - Math.exp(-DISSUASION)) * 100))} %`, 'la dissuasion'],
    // Les badges (refonte 1) : chaque effet Platine, depuis EFFET_ROLE et BADGE_CHIMIE ; les coups, depuis COUP_JAMBES et COUP_ABSORBE.
    [`(lancers adverses −${nombre(EFFET_ROLE.checker * 100)} %, two-way et physique −${nombre(EFFET_ROLE.deuxsens * 100)} %)`, 'les badges qui étouffent'],
    [`(finition −${nombre(EFFET_ROLE.bagarreur * 100)} %)`, 'le bagarreur'],
    [`(ses coéquipiers +${nombre(EFFET_ROLE.power * 100)} %)`, 'le power forward'],
    [`(usure −${nombre(EFFET_ROLE.energie * 100)} %)`, 'le plombier'],
    [`(${nombre(1 + EFFET_ROLE.sniper)} fois plus)`, 'le sniper'],
    [`(sa paire +${nombre(EFFET_ROLE.offensif * 100)} %)`, 'le défenseur offensif'],
    [`(comme ${nombre(BADGE_CHIMIE)} points de fit)`, 'le passeur et le manieur'],
    [`Chaque coup reçu coûte ${nombre(COUP_JAMBES)} jambes à un joueur moyen : ${nombre(COUP_JAMBES * (1 - COUP_ABSORBE))} à un costaud 🪨, ${nombre(COUP_JAMBES * (1 + COUP_ABSORBE))} à un léger 🪶.`, 'les coups'],
    // Le jeu physique en événements (1.0).
    [`le frappé perd ${nombre(COUP_MARQUANT_JAMBES)} jambes sur-le-champ et se blesse ${nombre(BLESSURE_SONNE)} fois plus ce soir`, 'le coup marquant'],
    [`${BAGARRE_MINUTES} minutes chacun, hors de leurs unités pendant ce temps ; le club du vainqueur gagne ${nombre(Math.round((ELAN_BAGARRE - 1) * 100))} % de finition pendant ${ELAN_DUREE} minutes, le perdant en perd ${nombre(Math.round((1 - ELAN_BAGARRE_PERDU) * 100))} %, et le battu se blesse ${nombre(BLESSURE_BAGARRE_PERDUE)} fois plus ce soir`, 'la bagarre'],
    [`${MELEE_MINUTES} minutes qui s'annulent`, 'la mêlée'],
    [`à ${ENERGIE_REF}, il rend sa moyenne ; chaque point de moins lui coûte ${nombre(ENERGIE_EFFET)} %`, 'l\'effet des jambes'],
    [`Frais (${NIVEAUX_JAMBES[0].min} et plus), Correct (${NIVEAUX_JAMBES[1].min}), Lourd (${NIVEAUX_JAMBES[2].min}), Vidé`, 'les niveaux de fatigue'],
    [`sous ${ENERGIE_BLESSURE}, il se blesse plus`, 'le seuil de blessure'],
    [`entre ${nombre(PART_AUX_MIN * 100)} et ${nombre(PART_AUX_MAX * 100)} %`, 'la part de l\'auxiliaire'],
    [`en prend ${nombre(PART_SANS_AUX * 100)} %`, 'le gardien rappelé'],
    [`${['zéro', 'un', 'deux', 'trois', 'quatre'][GARDIEN_SUITE_LIBRE]} départs de suite ; au ${['', 'deuxième', 'troisième', 'quatrième', 'cinquième'][GARDIEN_SUITE_LIBRE]}, il en perd ${GARDIEN_JAMBES_PAS} par départ, jamais sous ${GARDIEN_JAMBES_MIN}, et chaque ${GARDIEN_JAMBES_PAS} points perdus lui coûtent ${nombre(GARDIEN_USURE * 100)} %`, 'la fatigue des gardiens'],
    [ANNONCE_GROS === 1 ? 'annoncé la veille' : `annoncé ${ANNONCE_GROS} journées d'avance`, 'l\'annonce du gros match'],
    [`<strong>main de ${TAILLE_MAIN} cartes</strong> et tu as <strong>${ENERGIE_MAIN} d'élan</strong>`, 'la main'],
    [`à partir du ${MATCH_ADVERSE_FORT}e match et dès la troisième ronde des séries, il a ${energieAdverse({ nMatch: MATCH_ADVERSE_FORT })} d'élan`, 'l\'élan adverse'],
    [`précision +${pct(PREP_JUSTE.finition)} % et buts contre −${pct(PREP_JUSTE.defense)} %`, 'la préparation juste'],
    [`précision −${pct(PREP_RATEE.finition)} % et buts contre +${pct(PREP_RATEE.defense)} %`, 'la préparation ratée'],
    [`commence avec ${DECK_DEPART.length} cartes`, 'le deck de départ'],
    [`${PALIERS_CARTES.slice(0, -1).map(k => `${k}e`).join(', ')} et ${PALIERS_CARTES[PALIERS_CARTES.length - 1]}e matchs`, 'les paliers'],
    [`de ${pct(OBJECTIF_RATE.energie)} % de plus pendant ${OBJECTIF_RATE.duree} matchs`, 'l\'objectif raté'],
    [`sous ${nombre(plafBal * 100)} % du plafond`, 'le plafond du ballottage'],
    [`de ${RAPPEL_MATCHS[0]} à ${RAPPEL_MATCHS[1]} matchs dans sa saison`, 'le rappel au ballottage'],
    [`Après ton ${DATE_LIMITE_MATCH}e match, la date limite des échanges`, 'la date limite'],
    [`${JETONS.depart} jetons et un plafond de ${nombre(PLAFOND_ROGUE / 1e6)} M$`, 'le départ Rogue'],
    [`une victoire ${B.victoire} jetons (${B.victoire + 3}, puis ${B.victoire + 5} avec les commanditaires), une défaite en prolongation ${B.prolongation}, une défaite ${B.defaite}, un gros match gagné ${B.grosMatch}, un objectif du proprio ${B.objectif}, une ronde de séries gagnée ${B.serie}`, 'le barème des jetons'],
    [`une réclamation coûte ${coutBal} jetons`, 'la réclamation Rogue'],
    [`tu gardes jusqu'à ${GARDES_DE_SAISON} joueurs`, 'les gardés entre deux saisons'],
    [SOUTIENS_MOINS_RANG === SOUTIENS_MOINS_SAISON ? `tes cartes Soutien, ${SOUTIENS_MOINS_RANG} de moins par rang de prestige et par saison` : '(le quota de Soutien change autrement par rang et par saison)', 'le quota de Soutien'],
    // v2 : les coachs (js/coachs.js) — leur nombre et les seuils de la confiance.
    [`la couleur d'un de ${Object.keys(COACHS).length} coachs`, 'le nombre de coachs'],
    [`À ${SEUILS.slice(0, -1).join(', ')} et ${SEUILS[SEUILS.length - 1]} cartes jouées d'un coach, le vestiaire croit à lui pour la saison`, 'les seuils de la confiance'],
  ];
  // Les commanditaires : +3 puis +2 (js/rogue.js, `baremeRogue`).
  const src = lire('js/rogue.js');
  exiger('les commanditaires valent +3 puis +2 par victoire', /victoire: 5 \+ \(aDebloque\(m, 'commanditaire1'\) \? 3 : 0\) \+ \(aDebloque\(m, 'commanditaire2'\) \? 2 : 0\)/.test(src));
  const manquants = ecrits.filter(([t]) => !brut.includes(t)).map(([t, nom]) => `${nom} (« ${t.slice(0, 70)} »)`);
  exiger('chaque chiffre de la page vient de sa constante', manquants.length === 0, manquants.join(' · ') || `${ecrits.length} chiffres vérifiés`);
  const mandats = MANDATS.map(m => m.mot);
  exiger('les mandats du proprio sont ceux du code', /faire les séries, puis gagner une ronde, puis atteindre les demi-finales, puis la finale/.test(texte) && mandats.length === 4,
    mandats.join(' → '));
}

verdict('La clarté');
