/*
 * LES HISTOIRES (V25 C1, docs/refonte-v25.md § 4 C ; les quarante fiches : docs/histoires-v25.md). Une seule banque pour
 * tout ce que quelqu'un du club vient te dire : au lundi (28), le matin d'un gros match (6 ; jamais la veille, JP :
 * *juste le jour du gros match, pas avant*), le matin du premier match d'une ronde de séries (6). Les dossiers de la
 * semaine (js/dossiers.js, treize), les avant-matchs (`AVANT_GROS`) et les ajustements de séries (`AJUSTEMENTS`) sont
 * partis : trois chemins pour un seul.
 *
 * Chaque histoire :
 *   de        la voix (`EXPEDITEURS`, js/vie-gm.js) ; ico, titre
 *   moment    'lundi', 'gros' ou 'ronde' ; famille : le sujet, pour ne pas doubler ce qu'une saison raconte
 *   quand(f)  ce qu'elle lit dans les faits (js/faits.js `faitsDe`) : vrai, elle peut sortir
 *   joueur(f) le joueur qu'elle NOMME ({ n, cle }), lu dans ses feuilles (V19 : toujours un joueur ; le maire s'accroche
 *             à ta vedette) ; joueurs(f) quand elle en nomme deux (le duo)
 *   fait(f)   la ligne de chiffres sous la réplique, en vrais chiffres
 *   mots(f, j) LA RÉPLIQUE, ÉCRITE, QUI NOMME (JP, C0 q. 1) : le nom, le chiffre du fait — le même que la ligne sous elle,
 *             jamais une stat du moteur —, et sa vraie saison (`vraie`, bornée : « cette année-là, 60 buts en 63 matchs »)
 *   options   deux cartes de jeu : { cle, nom, niveau (0 Soutien, 1 Régulier, 2 Pilier ; rien au-dessus, C0 q. 9), ...effet }
 *             dans la grammaire de js/effets.js ; les canaux du club seulement aux moments `gros` et `ronde` (C0 q. 4) ;
 *             `suite` plante l'épisode 2 ; les jetons restent à la décision ; `gestes.piece`, une pièce pour ton banc
 *   rare      une fois par saison, à certains tirages (`CHANCE_RARE`) ; suiteDe : l'histoire dont elle est l'épisode 2
 *
 * UN SEUL TIRAGE, PUR : `tirer(graine, moment, faits, sorties)` — parmi les vraies qui ne se reposent pas, le plus haut de
 * son tirage ; une suite passe avant ; chaque moment a son pool (la ronde ne vide pas le lundi). Sa scène :
 * `sceneDe(cle, faits)` → { de, mot, fait }.
 */
import { EXPEDITEURS } from './vie-gm.js';
import { nomCourt } from './recit.js';
import { SEMAINE } from './inventaire.js';
import { vraieMot } from './faits.js';
import { hache, pct3 } from './util.js';
import { PIECES_PAR_SAISON_DES_FOURCHES } from './pieces.js';
/* Une fourche qui donne une pièce ne sort que si la saison en a donné moins de deux (V27, tranche 5 ; devis § 4.6). */
const pieceDeFourche = f => (f.fourches || 0) < PIECES_PAR_SAISON_DES_FOURCHES;

/* LE RYTHME (V20, nov. 2026, V23) : un lundi sur deux environ, le repos d'une histoire sortie, ses sorties par saison, la chance d'une rare. */
export const CHANCE_HISTOIRE = 0.55, REPOS_HISTOIRE = 5, SORTIES_MAX = 2, CHANCE_RARE = 0.4;
/* La deuxième moitié : trois histoires ne s'ouvrent qu'après MI_SAISON matchs ; la course est perdue à RETARD_FOND points des séries. */
const MI_SAISON = 41, RETARD_FOND = 8;
/* Les suites : le petit lit ses SUITE_PETIT matchs d'après et POINTS_PETIT points ; le duo, SUITE_DUO matchs et BUTS_DUO buts ensemble. */
const SUITE_PETIT = 8, POINTS_PETIT = 4, SUITE_DUO = 10, BUTS_DUO = 5;
/* La date limite des échanges : du 48e au 58e match, à moins de ESPACE_LIMITE du plafond. */
const LIMITE = [48, 58], ESPACE_LIMITE = 0.03;
/* Le partant fatigué un matin de gros match ; un blessé à mi-chemin (de 3 à 6 matchs) ; les blessures qui ne se devancent pas. */
const PARTANT_FRAIS = 78, MI_CHEMIN = [3, 6], GRAVES = ['commotion', 'fracture', 'ligaments'];

const s = n => (n > 1 ? 's' : '');
const pts = (n, m) => `${n} point${s(n)} en ${m} match${s(m)}`;
const rang = f => `${f.rang === 1 ? '1er' : `${f.rang}e`} sur ${f.equipes} après ${f.n} matchs`;
const court = j => nomCourt(j.n);
const vraie = (f, j) => { const m = vraieMot(f.vraie(j.cle)); return m ? `${m[0].toUpperCase()}${m.slice(1)}` : ''; };
const avecVraie = (f, j, suite = '') => { const v = vraie(f, j); return v ? `${v}${suite}` : ''; };
const suiteDe = (f, de, choix) => (f.suites || []).find(x => x.de === de && x.choix === choix && !x.resolue) || null;
const blesse = (f, ok) => (f.blesses || []).filter(ok).sort((a, b) => a.m - b.m)[0] || null;
const ronde = f => `Ronde ${f.ronde.k} contre ${f.ronde.adv}`;

export const HISTOIRES = {
  /* ---------------- LE LUNDI (28) ---------------- */
  laVedette: {
    de: 'an', ico: '📸', titre: 'Tout le monde veut la vedette', moment: 'lundi', famille: 'vedette',
    quand: f => !!f.vedette && f.n >= 5, joueur: f => f.vedette,
    fait: f => `${rang(f)} · ${f.vedette.fait}${avecVraie(f, f.vedette) ? ` · ${vraieMot(f.vraie(f.vedette.cle))}` : ''}`,
    mots: (f, j) => `${court(j)}, ${pts(f.vedette.pts, f.vedette.m)}. ${avecVraie(f, j, ' : les') || 'Les'} commanditaires savent compter aussi.`,
    options: [
      { cle: 'medias', nom: 'La tournée des médias', niveau: 0, jetons: 20 },
      { cle: 'glace', nom: 'Le garder pour la glace', niveau: 0, jetons: 10 },
    ],
  },
  leMuet: {
    de: 'en', ico: '🥶', titre: 'La disette', moment: 'lundi', famille: 'contrat',
    quand: f => !!f.muet && f.n >= 8, joueur: f => f.muet,
    fait: f => `${f.muet.n} : ${f.muet.sal} · ${pts(f.muet.pts, f.muet.m)}${vraieMot(f.vraie(f.muet.cle)) ? ` · ${vraieMot(f.vraie(f.muet.cle))}` : ''}`,
    mots: (f, j) => `${court(j)} est payé ${f.muet.sal} et il a ${pts(f.muet.pts, f.muet.m)}. ${avecVraie(f, j, ', alors je sais qu\'il sait où est le filet. ') || ''}Moi, je le brasserais devant les journalistes ; toi, tu signes.`,
    options: [
      { cle: 'defi', nom: 'Le mettre au défi devant les journalistes', niveau: 1,
        pari: { chance: 3 / 6, gagne: { duree: 8, lui: { lancers: 1.5, finition: 1.3 } }, perd: { duree: 8, lui: { lancers: 1.5, finition: 0.5 } } } },
      { cle: 'repos', nom: 'Le reposer deux matchs', niveau: 0, gestes: { absents: 2 }, duree: 8, lui: { lancers: 1.5, finition: 1.1 } },
    ],
  },
  leGardienBattu: {
    de: 'en', ico: '🥅', titre: 'Le gardien battu', moment: 'lundi', famille: 'gardien',
    quand: f => !!f.gardien && !!f.dernier && f.dernier.contre >= 5, joueur: f => f.gardien,
    fait: f => `${f.dernier.pour}–${f.dernier.contre} contre ${f.dernier.adv} · ${f.gardien.fait}`,
    mots: (f, j) => `${court(j)} en a mangé ${f.dernier.contre} contre ${f.dernier.adv}. Tu le renvoies devant le filet, ou tu lui donnes deux soirs pour y repenser.`,
    options: [
      { cle: 'renvoyer', nom: 'Le renvoyer devant le filet', niveau: 1,
        pari: { chance: 4 / 6, gagne: { duree: 6, lui: { arrets: 0.8 } }, perd: { duree: 6, lui: { arrets: 1.12 } } } },
      { cle: 'auxiliaire', nom: 'L\'auxiliaire deux soirs', niveau: 0, gestes: { gardienAux: 2 }, duree: 4, lui: { arrets: 0.78 } },
    ],
  },
  laChicane: {
    de: 'ca', ico: '🥊', titre: 'La chicane au vestiaire', moment: 'lundi', famille: 'vestiaire',
    quand: f => !!f.puni, joueur: f => f.puni,
    fait: f => `${f.puni.n} : ${f.puni.pun} punitions en ${f.puni.m} matchs`,
    mots: (f, j) => `${court(j)}, ${f.puni.pun} punitions en ${f.puni.m} matchs. Il nous coûte des avantages numériques, et les gars commencent à le lui dire en face.`,
    options: [
      { cle: 'suspendre', nom: 'Le suspendre deux matchs', niveau: 0, jetons: 8, gestes: { absents: 2 } },
      { cle: 'amende', nom: 'Une amende', niveau: 0, jetons: 8 },
    ],
  },
  laRoute: {
    de: 'ph', ico: '🧳', titre: 'La semaine sur la route', moment: 'lundi', famille: 'route',
    quand: f => f.visiteur >= 3 && !!f.pire, joueur: f => f.pire,
    fait: f => `${f.visiteur} matchs à l'étranger cette semaine · jambes ${f.jambes} · ${f.pire.n} : ${f.pire.j}`,
    mots: (f, j) => `Trois soirs à l'étranger, et ${court(j)} est déjà à ${f.pire.j} de jambes. Un vol nolisé, et je te le rends frais ; l'autobus, et il arrive au troisième soir sur les genoux.`,
    options: [
      { cle: 'nolise', nom: 'Le vol nolisé', niveau: 0, jetons: -15, gestes: { energieTous: 10 } },
      { cle: 'autobus', nom: 'L\'autobus de nuit', niveau: 0, jetons: 10, gestes: { energieTous: -8 } },
    ],
  },
  leFond: {
    de: 'pr', ico: '📉', titre: 'La course perdue d\'avance', moment: 'lundi', famille: 'course',
    quand: f => f.n >= MI_SAISON && f.retard >= RETARD_FOND && !!f.vedette, joueur: f => f.vedette,
    fait: f => `${rang(f)}, à ${f.retard} points des séries · ${f.vedette.fait}`,
    mots: (f, j) => `${f.rang}e, à ${f.retard} points des séries. Les billets ne se vendent plus. Vous vendez la fin de saison, ou vous la jouez autour de ${court(j)} ?`,
    options: [
      { cle: 'vendre', nom: 'Vendre la fin de saison', niveau: 0, jetons: 20 },
      { cle: 'battre', nom: 'Se battre jusqu\'au bout', niveau: 1,
        pari: { chance: 4 / 6, gagne: { duree: 10, lui: { lancers: 1.5, finition: 1.3 } }, perd: { duree: 10, lui: { finition: 0.6 } } } },
    ],
  },
  leSommet: {
    de: 'ca', ico: '🏔', titre: 'La première place à défendre', moment: 'lundi', famille: 'course',
    quand: f => f.n >= MI_SAISON && f.rang === 1 && f.avance !== null && !!f.pire, joueur: f => f.pire,
    fait: f => `${rang(f)}, ${f.avance} point${s(f.avance)} devant le 2e · jambes ${f.jambes} · ${f.pire.n} : ${f.pire.j}`,
    mots: (f, j) => `Premiers, ${f.avance} point${s(f.avance)} devant le deuxième. Les gars veulent écraser la ligue ; moi, je regarde ${court(j)} à ${f.pire.j} de jambes et je garderais du jus pour avril.`,
    options: [
      { cle: 'menager', nom: 'Ménager les jambes pour les séries', niveau: 1, gestes: { energieTous: 10 } },
      { cle: 'pedale', nom: 'La pédale au fond', niveau: 0, jetons: 25, gestes: { energieTous: -5 } },
    ],
  },
  lePetit: {
    de: 'dp', ico: '🐣', titre: 'Le petit qui pousse', moment: 'lundi', famille: 'recrue',
    quand: f => !!f.pousse && f.n >= 5, joueur: f => f.pousse,
    fait: f => `${f.pousse.n} : ${pts(f.pousse.pts, f.pousse.m)}, au ${f.pousse.ou}${vraieMot(f.vraie(f.pousse.cle)) ? ` · ${vraieMot(f.vraie(f.pousse.cle))}` : ''}`,
    mots: (f, j) => `Je l'avais dit pour ${court(j)} : ${pts(f.pousse.pts, f.pousse.m)}, au ${f.pousse.ou}. ${avecVraie(f, j, '. ') || ''}Il frappe à la porte, tu lui ouvres ?`,
    options: [
      { cle: 'monter', nom: 'Lui donner du temps de glace', niveau: 1,
        pari: { chance: 3 / 6, gagne: { duree: 8, lui: { lancers: 1.4, finition: 1.2 } }, perd: { duree: 8, lui: { finition: 0.6 } } }, suite: SUITE_PETIT },
      { cle: 'murir', nom: 'Le laisser mûrir', niveau: 0, jetons: 8 },
    ],
  },
  lePetitArrive: {
    de: 'an', ico: '🌟', titre: 'Le petit est arrivé', moment: 'lundi', famille: 'recrue', suiteDe: 'lePetit',
    quand: f => { const x = suiteDe(f, 'lePetit', 'monter'); return !!x && x.m >= SUITE_PETIT && x.pts >= POINTS_PETIT && pieceDeFourche(f); },
    joueur: f => (suiteDe(f, 'lePetit', 'monter') || {}).joueur || null,
    fait: f => { const x = suiteDe(f, 'lePetit', 'monter'); return `${x.joueur.n} : ${pts(x.pts, x.m)} depuis qu'il joue plus`; },
    mots: (f, j) => { const x = suiteDe(f, 'lePetit', 'monter'); return `${court(j)}, ${pts(x.pts, x.m)} depuis qu'il joue plus. Tout le monde parle de lui à la télé ; le petit est devenu quelqu'un.`; },
    options: [
      { cle: 'une', nom: 'La une le réclame', niveau: 1, jetons: 36 },
      { cle: 'proteger', nom: 'Le protéger des caméras', niveau: 2, gestes: { piece: true } },
    ],
  },
  lePetitDoute: {
    de: 'ca', ico: '🌧', titre: 'Le petit doute', moment: 'lundi', famille: 'recrue', suiteDe: 'lePetit',
    quand: f => { const x = suiteDe(f, 'lePetit', 'monter'); return !!x && x.m >= SUITE_PETIT && x.pts < POINTS_PETIT; },
    joueur: f => (suiteDe(f, 'lePetit', 'monter') || {}).joueur || null,
    fait: f => { const x = suiteDe(f, 'lePetit', 'monter'); return `${x.joueur.n} : ${pts(x.pts, x.m)} depuis qu'il joue plus`; },
    mots: (f, j) => { const x = suiteDe(f, 'lePetit', 'monter'); return `${court(j)}, ${pts(x.pts, x.m)} depuis qu'on l'a monté. Il ne dort plus, il regarde ses présences en boucle. Je peux le prendre sous mon aile.`; },
    options: [
      { cle: 'aile', nom: 'Sous l\'aile du capitaine', niveau: 1, duree: 6, lui: { lancers: 1.3, finition: 1.2 }, gestes: { energie: -15 } },
      { cle: 'redescendre', nom: 'Le renvoyer en bas de l\'alignement', niveau: 0, jetons: 6 },
    ],
  },
  lesChapeaux: {
    de: 'eq', ico: '🎩', titre: 'Les chapeaux sur la glace', moment: 'lundi', famille: 'chaude', rare: true,
    quand: f => !!f.chapeau && !!f.dernier, joueur: f => f.chapeau,
    fait: f => `${f.chapeau.n} : ${f.chapeau.buts} buts au dernier match, ${f.dernier.pour}–${f.dernier.contre} contre ${f.dernier.adv}`,
    mots: (f, j) => `${court(j)}, ${f.chapeau.buts} buts hier contre ${f.dernier.adv}. J'en ai ramassé une pleine poubelle de chapeaux. On en fait quoi ?`,
    options: [
      { cle: 'encheres', nom: 'Les chapeaux aux enchères', niveau: 1, jetons: 30 },
      { cle: 'chaud', nom: 'Il garde la rondelle chaude', niveau: 1,
        pari: { chance: 4 / 6, gagne: { duree: 6, lui: { lancers: 1.5, finition: 1.3 } }, perd: { duree: 6, lui: { finition: 0.6 } } } },
    ],
  },
  leBlanchissage: {
    de: 'en', ico: '🧊', titre: 'Le blanchissage de l\'auxiliaire', moment: 'lundi', famille: 'gardien',
    quand: f => !!f.blanchissage && !!f.dernier, joueur: f => f.blanchissage,
    fait: f => `${f.blanchissage.n} : un blanchissage, ${f.dernier.pour}–0 contre ${f.dernier.adv}`,
    mots: (f, j) => `${court(j)} a fermé la porte, ${f.dernier.pour}–0 contre ${f.dernier.adv}, et le grand regarde du banc. Un blanchissage, ça se récompense ; ou ça se range, et on revient à l'ordre.`,
    options: [
      { cle: 'encore', nom: 'Encore le filet', niveau: 1, gestes: { gardienAux: 1 },
        pari: { chance: 4 / 6, gagne: { duree: 3, lui: { arrets: 0.8 } }, perd: { duree: 3, lui: { arrets: 1.15 } } } },
      { cle: 'partant', nom: 'Retour au partant', niveau: 0, jetons: 6 },
    ],
  },
  leDosADos: {
    de: 'ad', ico: '🛫', titre: 'Deux soirs de suite sur la route', moment: 'lundi', famille: 'route',
    quand: f => f.n >= MI_SAISON && f.dosRoute >= 1 && !!f.pire, joueur: f => f.pire,
    fait: f => `${f.dosRoute > 1 ? `${f.dosRoute} dos-à-dos` : 'Un dos-à-dos'} à l'étranger cette semaine · jambes ${f.jambes} · ${f.pire.n} : ${f.pire.j}`,
    mots: (f, j) => `Deux villes, deux soirs, et ${court(j)} traîne déjà la patte à ${f.pire.j}. Je l'habille les deux soirs, ou je le laisse à l'hôtel le deuxième ?`,
    options: [
      { cle: 'hotel', nom: 'Le laisser souffler un soir', niveau: 0, gestes: { absents: 1, energie: 35 } },
      { cle: 'embarque', nom: 'Il joue les deux soirs', niveau: 1,
        pari: { chance: 3 / 6, gagne: { duree: 6, lui: { lancers: 1.5, finition: 1.15 } }, perd: { duree: 6, lui: { finition: 0.6 } } } },
    ],
  },
  laCommotion: {
    de: 'me', ico: '🧠', titre: 'La commotion', moment: 'lundi', famille: 'blessure',
    quand: f => !!blesse(f, b => b.genre === 'commotion' && b.m >= 4), joueur: f => blesse(f, b => b.genre === 'commotion' && b.m >= 4),
    fait: f => { const b = blesse(f, x => x.genre === 'commotion' && x.m >= 4); return `${b.n} : une commotion cérébrale, ${b.m} matchs d'absence encore (${b.total} en tout)${b.deja ? ` · ${b.deja + 1}e de la run` : ''}`; },
    mots: (f, j) => { const b = blesse(f, x => x.genre === 'commotion' && x.m >= 4); return `${court(j)}, ${b.m} matchs encore. ${b.deja ? 'Sa deuxième commotion chez nous ; la prochaine sera plus longue.' : 'Une commotion, ça ne se négocie pas avec moi.'} Le protocole au complet, ou je le lâche dès qu'il passe les tests.`; },
    options: [
      { cle: 'protocole', nom: 'Le protocole au complet', niveau: 2, duree: 20, lui: { blessure: 0.5 } },
      { cle: 'tests', nom: 'Dès qu\'il passe les tests', niveau: 1, gestes: { soin: 3 },
        pari: { chance: 4 / 6, gagne: { duree: 8, lui: { lancers: 1.7 } }, perd: { duree: 8, lui: { blessure: 2, finition: 0.6 } } } },
    ],
  },
  leRetourDevance: {
    de: 'ph', ico: '🩹', titre: 'Le retour devancé', moment: 'lundi', famille: 'blessure',
    quand: f => !!blesse(f, b => !GRAVES.includes(b.genre) && b.m >= MI_CHEMIN[0] && b.m <= MI_CHEMIN[1]),
    joueur: f => blesse(f, b => !GRAVES.includes(b.genre) && b.m >= MI_CHEMIN[0] && b.m <= MI_CHEMIN[1]),
    fait: f => { const b = blesse(f, x => !GRAVES.includes(x.genre) && x.m >= MI_CHEMIN[0] && x.m <= MI_CHEMIN[1]); return `${b.n} : ${b.m} matchs d'absence encore (${b.total} en tout)`; },
    mots: (f, j) => { const b = blesse(f, x => !GRAVES.includes(x.genre) && x.m >= MI_CHEMIN[0] && x.m <= MI_CHEMIN[1]); return `${court(j)} est à mi-chemin : ${b.m} matchs encore sur sa table. Je peux le remettre sur ses patins jeudi, mais une blessure comme ça, ça se rappelle à toi.`; },
    options: [
      { cle: 'devancer', nom: 'Le remettre jeudi', niveau: 1, gestes: { soin: 2 }, duree: 8, lui: { blessure: 1.6 } },
      { cle: 'guerir', nom: 'Le laisser guérir', niveau: 0, jetons: 6, duree: 10, lui: { blessure: 0.7 } },
    ],
  },
  laPrime: {
    de: 'fi', ico: '🧾', titre: 'La prime au contrat', moment: 'lundi', famille: 'contrat',
    quand: f => !!f.jalon, joueur: f => f.jalon,
    fait: f => `${f.jalon.n} : ${f.jalon.total}e ${f.jalon.quoi === 'buts' ? 'but' : 'point'} au ${f.jalon.m}e match${f.jalon.sal ? ` · ${f.jalon.sal}` : ''} · une prime au contrat`,
    mots: (f, j) => `${court(j)} vient de passer ${f.jalon.total} ${f.jalon.quoi} chez nous, et son contrat${f.jalon.sal ? ` de ${f.jalon.sal}` : ''} a une prime écrite pour ça. Je la paie tout de suite, ou je l'étale et il le saura.`,
    options: [
      { cle: 'payer', nom: 'La payer rubis sur l\'ongle', niveau: 1, jetons: -15, duree: 10, lui: { lancers: 1.3, finition: 1.15 } },
      { cle: 'etaler', nom: 'L\'étaler jusqu\'en avril', niveau: 1,
        pari: { chance: 3 / 6, gagne: { duree: 10, lui: { finition: 1.4 } }, perd: { duree: 10, lui: { finition: 0.7, lancers: 0.6 } } } },
    ],
  },
  lAgent: {
    de: 'ag', ico: '🤝', titre: 'Son agent appelle', moment: 'lundi', famille: 'contrat', rare: true,
    quand: f => f.n >= 15 && !!f.vedette && f.vedette.sal != null, joueur: f => f.vedette,
    fait: f => `${f.vedette.fait} · ${f.vedette.sal}${vraieMot(f.vraie(f.vedette.cle)) ? ` · ${vraieMot(f.vraie(f.vedette.cle))}` : ''}`,
    mots: (f, j) => `Mon client, ${court(j)} : ${pts(f.vedette.pts, f.vedette.m)} chez vous. ${avecVraie(f, j, '. ') || ''}Il veut qu'on en parle avant le printemps, et il préfère qu'on en parle maintenant.`,
    options: [
      { cle: 'donner', nom: 'Lui donner ce qu\'il demande', niveau: 1, jetons: -20, duree: 8, lui: { lancers: 1.7, creation: 1.2 } },
      { cle: 'gagner', nom: 'Qu\'il le gagne sur la glace', niveau: 1,
        pari: { chance: 3 / 6, gagne: { duree: 12, lui: { lancers: 1.3, finition: 1.3 } }, perd: { duree: 12, lui: { finition: 0.6, creation: 0.7 } } } },
    ],
  },
  laDateLimite: {
    de: 'dg', ico: '⏳', titre: 'La date limite des échanges', moment: 'lundi', famille: 'contrat', rare: true,
    quand: f => f.n >= LIMITE[0] && f.n <= LIMITE[1] && !!f.masse && !!f.masse.lourd && f.masse.cap > 0 && f.masse.espace < f.masse.cap * ESPACE_LIMITE,
    joueur: f => f.masse.lourd,
    fait: f => `${f.n}e match · espace libre ${f.masse.libre} · ${f.masse.lourd.n} : ${f.masse.lourd.sal}${vraieMot(f.vraie(f.masse.lourd.cle)) ? ` · ${vraieMot(f.vraie(f.masse.lourd.cle))}` : ''}`,
    mots: (f, j) => `La date limite est vendredi, et on est à ${f.masse.libre} du plafond. J'ai une offre pour ${court(j)} : ${f.masse.lourd.sal}. ${avecVraie(f, j, '. ') || ''}Je l'écoute ou je raccroche ?`,
    options: [
      { cle: 'echanger', nom: 'L\'échanger', niveau: 2, gestes: { echange: 'lui', offres: 2 } },
      { cle: 'garder', nom: 'On garde le groupe', niveau: 1, jetons: 8, duree: 10, lui: { lancers: 1.5 } },
    ],
  },
  laPieceGagnante: {
    de: 'ad', ico: '🎯', titre: 'La pièce qui fait gagner', moment: 'lundi', famille: 'banc',
    quand: f => !!f.pieceChaude && f.pieceChaude.v > f.pieceChaude.d && !!f.vedette && pieceDeFourche(f), joueur: f => f.vedette,
    fait: f => `${f.pieceChaude.ico} ${f.pieceChaude.nom} · ${f.pieceChaude.m} soirs, ${f.pieceChaude.v}-${f.pieceChaude.d} · ${f.vedette.fait}`,
    mots: (f, j) => `${f.pieceChaude.ico} ${f.pieceChaude.nom}, ${f.pieceChaude.m} soirs sur les dix derniers, ${f.pieceChaude.v}-${f.pieceChaude.d} ces soirs-là, et ${court(j)} qui a tout mis dedans. J'ai un nom à te proposer pour le banc, ou on encaisse la prime.`,
    options: [
      { cle: 'nom', nom: "Il recommande quelqu'un", niveau: 2, gestes: { piece: true } },
      { cle: 'cahier', nom: 'La prime du proprio', niveau: 2, jetons: 16 },
    ],
  },
  laPieceQuiRate: {
    de: 'ca', ico: '🪑', titre: 'La pièce qui ne marche pas', moment: 'lundi', famille: 'banc',
    quand: f => !!f.pieceChaude && f.pieceChaude.d > f.pieceChaude.v && !!f.pire, joueur: f => f.pire,
    fait: f => `${f.pieceChaude.ico} ${f.pieceChaude.nom} · ${f.pieceChaude.m} soirs, ${f.pieceChaude.v}-${f.pieceChaude.d} · jambes ${f.jambes} · ${f.pire.n} : ${f.pire.j}`,
    mots: (f, j) => `${f.pieceChaude.ico} ${f.pieceChaude.nom}, ${f.pieceChaude.v}-${f.pieceChaude.d} sur ses ${f.pieceChaude.m} derniers soirs. Les gars n'embarquent pas, et ${court(j)} est à ${f.pire.j} de jambes à force de courir après. On revient à nos affaires.`,
    options: [
      { cle: 'base', nom: "Retour aux trios d'avant", niveau: 0, gestes: { energieTous: 8 } },
      { cle: 'lecon', nom: 'Le coach encaisse la leçon', niveau: 0, jetons: 10, gestes: { energie: -10 } },
    ],
  },
  leMandat: {
    de: 'pr', ico: '🏢', titre: 'Le mandat, à mi-chemin', moment: 'lundi', famille: 'mandat',
    quand: f => f.n >= MI_SAISON && !!f.mandat && f.mandat.rang != null && f.rang > f.mandat.rang && f.retard < RETARD_FOND && !!f.vedette, joueur: f => f.vedette,
    fait: f => `${rang(f)} · le mandat : ${f.mandat.mot} · ${f.vedette.fait}`,
    mots: (f, j) => `Je vous ai demandé de ${f.mandat.mot}. Vous êtes ${f.rang}e à ${f.n} matchs. J'ouvre le coffre une fois, ou je veux un mois de ${court(j)} ; pas les deux.`,
    options: [
      { cle: 'coffre', nom: 'Il ouvre le coffre', niveau: 1, jetons: 25 },
      { cle: 'mois', nom: 'Un mois de {nom}', niveau: 1,
        pari: { chance: 4 / 6, gagne: { duree: 12, lui: { lancers: 1.4, finition: 1.25 } }, perd: { duree: 12, lui: { finition: 0.7 } } } },
    ],
  },
  leMurEnVue: {
    de: 'pt', ico: '🧤', titre: 'Trente victoires en vue', moment: 'lundi', famille: 'gardien',
    quand: f => !!f.murEnVue, joueur: f => f.murEnVue,
    fait: f => `${f.murEnVue.n} : ${f.murEnVue.v} victoires en ${f.murEnVue.departs} départs · ${30 - f.murEnVue.v} avant le galon 🏵 Le mur`,
    mots: (f, j) => `${court(j)} en a ${f.murEnVue.v}. Les gradins comptent à voix haute à chaque arrêt, et on veut le trentième à la maison. Tu le lances jusqu'à ce qu'il l'ait, ou tu le laisses respirer un soir ?`,
    options: [
      { cle: 'jusquau', nom: 'Tous les départs jusqu\'au trentième', niveau: 1,
        pari: { chance: 4 / 6, gagne: { duree: 4, lui: { arrets: 0.85 } }, perd: { duree: 4, lui: { arrets: 1.1 } } } },
      { cle: 'respire', nom: 'Un soir à l\'auxiliaire, puis frais', niveau: 0, gestes: { gardienAux: 1 }, duree: 3, lui: { arrets: 0.85 } },
    ],
  },
  leDuo: {
    de: 'ad', ico: '🔗', titre: 'Le duo', moment: 'lundi', famille: 'vestiaire',
    quand: f => !!f.duo && f.n >= 10, joueur: f => f.duo.marqueur, joueurs: f => [f.duo.marqueur, f.duo.passeur],
    fait: f => `${f.duo.passeur.n} → ${f.duo.marqueur.n} : ${f.duo.buts} buts ensemble en ${f.duo.m} matchs`,
    mots: (f, j) => `${court(j)} et ${nomCourt(f.duo.passeur.n)} : ${f.duo.buts} buts ensemble en ${f.duo.m} matchs, un sur passe de l'autre. Ces deux-là se trouvent sans se regarder. Je les soude pour la saison, ou je garde la liberté de brasser les trios ?`,
    options: [
      { cle: 'souder', nom: 'Les garder ensemble', niveau: 2,
        pari: { chance: 4 / 6, gagne: { duree: 20, lui: { finition: 1.4, creation: 1.3 } }, perd: { duree: 8, lui: { finition: 0.7 } } }, suite: SUITE_DUO },
      { cle: 'libre', nom: 'Garder les trios libres', niveau: 0, jetons: 10 },
    ],
  },
  leDuoNomme: {
    de: 'co', ico: '📢', titre: 'Le duo a un nom', moment: 'lundi', famille: 'vestiaire', suiteDe: 'leDuo',
    quand: f => { const x = suiteDe(f, 'leDuo', 'souder'); return !!x && x.m >= SUITE_DUO && x.butsDuo >= BUTS_DUO; },
    joueur: f => (suiteDe(f, 'leDuo', 'souder') || {}).joueur || null,
    fait: f => { const x = suiteDe(f, 'leDuo', 'souder'); return `${x.joueur.n} : ${x.butsDuo} buts ensemble en ${x.m} matchs depuis qu'on les garde`; },
    mots: (f, j) => { const x = suiteDe(f, 'leDuo', 'souder'); return `${court(j)} et son passeur, ${x.butsDuo} buts ensemble en ${x.m} matchs depuis qu'on les a soudés. Les partisans leur ont trouvé un nom, et je peux l'imprimer sur des chandails d'ici vendredi.`; },
    options: [
      { cle: 'chandails', nom: 'Les chandails du duo', niveau: 1, jetons: 30 },
      { cle: 'glace', nom: 'Loin des caméras, sur la glace', niveau: 2, jetons: 6, duree: 12, lui: { creation: 1.4, lancers: 1.7 } },
    ],
  },
  laRecrue: {
    de: 'an', ico: '🐥', titre: 'La recrue', moment: 'lundi', famille: 'recrue', rare: true,
    quand: f => !!f.recrue && f.n >= 10, joueur: f => f.recrue,
    fait: f => `${f.recrue.n} : ${pts(f.recrue.pts, f.recrue.m)} · recrue${vraieMot(f.vraie(f.recrue.cle)) ? ` · ${vraieMot(f.vraie(f.recrue.cle))}` : ''}`,
    mots: (f, j) => `${court(j)}, ${pts(f.recrue.pts, f.recrue.m)}, à son âge. ${avecVraie(f, j, '. ') || ''}Le réseau veut le match des recrues, les commanditaires veulent sa face. Tu le laisses dans le cirque, ou tu fermes la porte ?`,
    options: [
      { cle: 'cirque', nom: 'Le match des recrues à la télé', niveau: 1, jetons: 20 },
      { cle: 'porte', nom: 'Fermer la porte aux caméras', niveau: 1, duree: 10, lui: { lancers: 1.5, creation: 1.2 } },
    ],
  },
  leVieux: {
    de: 'pa', ico: '🧣', titre: 'Le vieux', moment: 'lundi', famille: 'veteran', rare: true,
    quand: f => !!f.veteran && f.n >= 20, joueur: f => f.veteran,
    fait: f => `${f.veteran.n} : ${f.veteran.age} ans · ${pts(f.veteran.pts, f.veteran.m)}${vraieMot(f.vraie(f.veteran.cle)) ? ` · ${vraieMot(f.vraie(f.veteran.cle))}` : ''}`,
    mots: (f, j) => `Ça fait trente ans que j'ai mon siège, et ${court(j)}, à ${f.veteran.age} ans, c'est le seul qui joue encore comme quand j'ai commencé. ${pts(f.veteran.pts, f.veteran.m)}. Faites-lui une soirée avant qu'il parte.`,
    options: [
      { cle: 'soiree', nom: 'Une soirée en son honneur', niveau: 1, jetons: 15, duree: 6, lui: { finition: 1.2 } },
      { cle: 'tranquille', nom: 'Le laisser tranquille, il joue', niveau: 1, jetons: 10 },
    ],
  },
  laFete: {
    de: 'ma', ico: '🗳', titre: 'La ville veut une fête', moment: 'lundi', famille: 'club', rare: true,
    quand: f => f.serie >= 6 && !!f.vedette, joueur: f => f.vedette,
    fait: f => `${f.serie} victoires de suite · ${f.vedette.fait}`,
    mots: (f, j) => `${f.serie} victoires de suite, et ${court(j)} qui remplit mes rues le soir. La ville veut un rassemblement sur la place, samedi midi. Je ferme la rue ou j'attends le défilé de juin ?`,
    options: [
      { cle: 'place', nom: 'Le rassemblement sur la place', niveau: 1, jetons: 25, gestes: { energieTous: -5 } },
      { cle: 'juin', nom: 'Pas avant le défilé de juin', niveau: 0, jetons: 8 },
    ],
  },
  laLigue: {
    de: 'li', ico: '🪪', titre: 'La ligue a revu le coup', moment: 'lundi', famille: 'vestiaire',
    quand: f => !!f.coup, joueur: f => f.coup,
    fait: f => `${f.coup.n} : une majeure de ${f.coup.min} minutes contre ${f.coup.adv} · ${f.n}e match`,
    mots: (f, j) => `La ligue a revu le geste de ${court(j)} contre ${f.coup.adv}, ${f.coup.min} minutes au cachot. Deux matchs, ou vous plaidez sa cause par téléphone et il joue mercredi.`,
    options: [
      { cle: 'accepter', nom: 'Accepter la suspension', niveau: 0, jetons: 8, gestes: { absents: 2 } },
      { cle: 'plaider', nom: 'Plaider sa cause', niveau: 1, jetons: -8, duree: 6, lui: { lancers: 1.5 } },
    ],
  },

  /* ---------------- LE JOUR DU GROS MATCH (6) : le matin du duel, jamais la veille ; une option peut poser des canaux sur ton club ce soir seul (`duree: 1`). ---------------- */
  lAncien: {
    de: 'dp', ico: '👋', titre: 'Le retour de l\'ancien', moment: 'gros', famille: 'rivalite',
    quand: f => !!f.gros && !!f.gros.ancien && !!f.vedette, joueur: f => f.vedette,
    fait: f => `Contre ${f.gros.adv}, ${f.gros.fiche.v}-${f.gros.fiche.d} cette saison · ${f.gros.ancien.n} : ${pts(f.gros.ancien.pts, f.gros.ancien.m)} chez eux · ${f.vedette.fait}`,
    mots: (f, j) => `${nomCourt(f.gros.ancien.n)} joue chez eux ce soir, ${pts(f.gros.ancien.pts, f.gros.ancien.m)} depuis qu'il est parti. Il a dit qu'il avait quelque chose à prouver. ${court(j)} a entendu.`,
    options: [
      { cle: 'cibler', nom: 'Le cibler', niveau: 1, duree: 1, canaux: { robustesse: 1.5, discipline: 1.18 } },
      { cle: 'ignorer', nom: 'L\'ignorer, jouer notre match', niveau: 1, duree: 1, canaux: { defense: 0.94 } },
    ],
  },
  lesPoteaux: {
    de: 'ph', ico: '🥅', titre: 'Le gardien parle à ses poteaux', moment: 'gros', famille: 'gardien',
    quand: f => !!f.gros && !!f.gros.partant && (f.gros.partant.j < PARTANT_FRAIS || f.gros.partant.dosADos), joueur: f => f.gros.partant,
    fait: f => `${f.gros.partant.n} : jambes ${f.gros.partant.j}${f.gros.partant.dosADos ? ' · a joué hier' : ''} · gros match contre ${f.gros.adv}`,
    mots: (f, j) => `${court(j)} a ses rituels, et son aine a ${f.gros.partant.j} de jambes ce matin. Je lui coupe ses poteaux et il part frais la semaine prochaine, ou il garde sa bulle ce soir et il me le paiera demain.`,
    options: [
      { cle: 'rituels', nom: 'Laisser ses rituels', niveau: 1, duree: 1, lui: { arrets: 0.85 }, gestes: { energie: -20 } },
      { cle: 'auxiliaire', nom: 'L\'auxiliaire prend le gros match', niveau: 1, gestes: { gardienAux: 1 }, duree: 3, lui: { arrets: 0.85 } },
    ],
  },
  leVirus: {
    de: 'me', ico: '🦠', titre: 'Le virus dans le vestiaire', moment: 'gros', famille: 'blessure',
    quand: f => !!f.gros && f.gros.malades.length >= 3, joueur: f => f.gros.malades[0],
    fait: f => `${f.gros.malades.slice(0, 3).map(x => `${x.n} ${x.j}`).join(' · ')} de jambes · gros match contre ${f.gros.adv}`,
    mots: (f, j) => `${f.gros.malades.slice(0, 3).map(x => nomCourt(x.n)).join(', ')} ont passé la nuit malades ; ${court(j)} est à ${f.gros.malades[0].j}. Ils peuvent jouer, « à peu près ». Aucun bon choix : lequel fait le moins mal ?`,
    options: [
      { cle: 'jouer', nom: 'Il joue quand même', niveau: 1, duree: 1, lui: { lancers: 0.5 }, gestes: { energie: -20 } },
      { cle: 'lit', nom: 'Au lit, le remplaçant de la ligue', niveau: 0, gestes: { absents: 1, energie: 30 } },
    ],
  },
  leurVedette: {
    de: 'dp', ico: '🔎', titre: 'Leur vedette', moment: 'gros', famille: 'rivalite',
    quand: f => !!f.gros && !!f.gros.leurVedette && !!f.gros.monMur, joueur: f => f.gros.monMur,
    fait: f => `Contre ${f.gros.adv}, ${f.gros.fiche.v}-${f.gros.fiche.d} cette saison · ${f.gros.leurVedette.n} : ${pts(f.gros.leurVedette.pts, f.gros.leurVedette.m)} · ${f.gros.monMur.n} : ${f.gros.monMur.pm >= 0 ? '+' : ''}${f.gros.monMur.pm} cette saison`,
    mots: (f, j) => { const v = vraieMot(f.gros.leurVedette.vraie); return `Leur gars, c'est ${nomCourt(f.gros.leurVedette.n)} : ${pts(f.gros.leurVedette.pts, f.gros.leurVedette.m)}. ${v ? `${v[0].toUpperCase()}${v.slice(1)}. ` : ''}Je mets ${court(j)} dans ses culottes toute la soirée, ou on joue notre jeu et on le laisse venir.`; },
    options: [
      { cle: 'ombre', nom: 'L\'ombre sur leur vedette', niveau: 1, duree: 1, canaux: { defense: 0.93, volume: 0.97 }, lui: { blessure: 1.3 } },
      { cle: 'notre', nom: 'On joue notre jeu', niveau: 1, duree: 1, canaux: { finition: 1.3 } },
    ],
  },
  lesGradins: {
    de: 'pt', ico: '📣', titre: 'Les gradins pleins', moment: 'gros', famille: 'lancee',
    quand: f => !!f.gros && f.gros.domicile && f.gros.lancee >= 3 && !!f.vedette, joueur: f => f.vedette,
    fait: f => `${f.gros.lancee} victoires de suite · à domicile contre ${f.gros.adv} · ${f.vedette.fait}`,
    mots: (f, j) => `${f.gros.lancee} de suite, et c'est plein jusqu'au plafond ce soir. On veut voir ${court(j)} tirer de partout. Le show, ou le plan de match ?`,
    options: [
      { cle: 'show', nom: 'Donner le show', niveau: 1, duree: 1, canaux: { volume: 1.09, defense: 1.08 } },
      { cle: 'plan', nom: 'Jouer notre hockey', niveau: 1, duree: 1, canaux: { defense: 0.94 }, lui: { lancers: 1.5 } },
    ],
  },
  laGarantie: {
    de: 'ca', ico: '🎤', titre: 'La garantie', moment: 'gros', famille: 'rivalite',
    quand: f => !!f.gros && f.gros.sorte === 'nemesis' && !!f.vedette, joueur: f => f.vedette,
    fait: f => `Ta bête noire : ${f.gros.adv}, ${f.gros.fiche.v}-${f.gros.fiche.d} cette saison · ${f.vedette.fait}`,
    mots: (f, j) => `Ils nous ont battus ${f.gros.fiche.d} fois cette saison. Les journalistes entourent ${court(j)}, ils attendent une phrase pour la une. Il la donne, ou on parle sur la glace ?`,
    options: [
      { cle: 'garantir', nom: 'Il garantit la victoire', niveau: 2,
        pari: { chance: 3 / 6, gagne: { duree: 1, lui: { lancers: 1.6, finition: 1.4 } }, perd: { duree: 4, lui: { finition: 0.6 } } } },
      { cle: 'glace', nom: 'Un match à la fois', niveau: 1, duree: 1, canaux: { defense: 0.94 } },
    ],
  },

  /* ---------------- LA RONDE DE SÉRIES (6) : le matin du premier match d'une ronde ; `duree: 7` couvre la série. ---------------- */
  lesBillets: {
    de: 'pr', ico: '🎟', titre: 'Les billets de séries', moment: 'ronde', famille: 'mandat',
    quand: f => !!f.ronde && f.ronde.k === 1 && !!f.vedette, joueur: f => f.vedette,
    fait: f => `${ronde(f)} · ${rang(f)} · ${f.vedette.fait}`,
    mots: (f, j) => `Les séries. Je peux doubler le prix des billets, les gens paieront pour voir ${court(j)} ; ou je les laisse au prix de la saison et l'aréna sera plein à craquer dès le premier soir.`,
    options: [
      { cle: 'prix', nom: 'Le prix des séries', niveau: 1, jetons: 30 },
      { cle: 'plein', nom: 'Plein à craquer, au prix régulier', niveau: 1, jetons: 4, gestes: { energieTous: 10 } },
    ],
  },
  leurCoach: {
    de: 'dp', ico: '🔎', titre: 'Leur coach', moment: 'ronde', famille: 'series',
    quand: f => !!f.ronde && !!f.ronde.leurCoach && !!f.ronde.gardien, joueur: f => f.ronde.gardien,
    fait: f => `${ronde(f)} · leur coach : ${f.ronde.leurCoach.ico} ${f.ronde.leurCoach.nom}, ${f.ronde.leurCoach.pouvoir}${f.ronde.gardien.pctArr != null ? ` · ${f.ronde.gardien.n} : ${pct3(f.ronde.gardien.pctArr)} en ${f.ronde.gardien.departs} départ${s(f.ronde.gardien.departs)} de séries` : ''}`,
    mots: (f, j) => `Leur banc, c'est ${f.ronde.leurCoach.ico} ${f.ronde.leurCoach.nom}, et il joue ${f.ronde.leurCoach.pouvoir} chaque fois qu'il peut. J'ai la vidéo de leurs vingt derniers matchs. ${court(j)} la regarde avec moi toute la nuit, ou il dort et on lui raconte.`,
    options: [
      { cle: 'video', nom: 'La vidéo toute la nuit', niveau: 2, duree: 7, lui: { arrets: 0.9 }, gestes: { energie: -15 } },
      { cle: 'dort', nom: 'Il dort, on lui raconte', niveau: 1, duree: 7, canaux: { defense: 0.9 } },
    ],
  },
  laRevanche: {
    de: 'ca', ico: '🎖', titre: 'La revanche', moment: 'ronde', famille: 'rivalite',
    quand: f => !!f.ronde && f.ronde.ficheSaison.d >= 2 && f.ronde.ficheSaison.d > f.ronde.ficheSaison.v && !!f.vedette, joueur: f => f.vedette,
    fait: f => `${ronde(f)} · ${f.ronde.ficheSaison.v}-${f.ronde.ficheSaison.d} contre eux cette saison · ${f.vedette.fait}`,
    mots: (f, j) => `${f.ronde.adv} nous a battus ${f.ronde.ficheSaison.d} fois cette saison. Les gars veulent la leur rendre, et ils regardent ${court(j)}. Il parle au vestiaire avant le premier, ou tu fermes la porte aux médias et c'est le coach qui parle.`,
    options: [
      { cle: 'parle', nom: '{nom} parle au vestiaire', niveau: 2,
        pari: { chance: 4 / 6, gagne: { duree: 7, lui: { lancers: 1.3, finition: 1.2 } }, perd: { duree: 7, lui: { finition: 0.7 } } } },
      { cle: 'coach', nom: 'Le coach ferme le vestiaire', niveau: 1, jetons: 12 },
    ],
  },
  leBlesseDesSeries: {
    de: 'me', ico: '🩼', titre: 'Le blessé des séries', moment: 'ronde', famille: 'blessure',
    quand: f => !!f.ronde && !!blesse(f, b => b.m >= 2 && b.m <= 7 && !GRAVES.includes(b.genre)), joueur: f => blesse(f, b => b.m >= 2 && b.m <= 7 && !GRAVES.includes(b.genre)),
    fait: f => { const b = blesse(f, x => x.m >= 2 && x.m <= 7 && !GRAVES.includes(x.genre)); return `${ronde(f)} · ${b.n} : ${b.m} matchs encore (${b.total} en tout)`; },
    mots: (f, j) => { const b = blesse(f, x => x.m >= 2 && x.m <= 7 && !GRAVES.includes(x.genre)); return `${court(j)} a ${b.m} matchs à faire, et la série en a sept au plus. Il peut jouer à l'infiltration dès le premier ; je ne garantis pas le deuxième. Ou il regarde celle-là du haut et il revient entier pour la suivante.`; },
    options: [
      { cle: 'infiltration', nom: 'Il joue à l\'infiltration', niveau: 2, gestes: { soin: 4 }, duree: 7, lui: { finition: 0.5, blessure: 1.8 } },
      { cle: 'haut', nom: 'Il regarde du haut', niveau: 1, duree: 14, lui: { blessure: 0.6 } },
    ],
  },
  lesJambesDeSeries: {
    de: 'ph', ico: '🦵', titre: 'Sept matchs dans les jambes', moment: 'ronde', famille: 'blessure',
    quand: f => !!f.ronde && f.ronde.k >= 2 && !!f.ronde.precedente && f.ronde.precedente.matchs >= 6 && !!f.pire && f.pire.j < 80, joueur: f => f.pire,
    fait: f => `${ronde(f)} · la ronde d'avant en ${f.ronde.precedente.matchs} · jambes ${f.jambes} · ${f.pire.n} : ${f.pire.j}`,
    mots: (f, j) => `${f.ronde.precedente.matchs} matchs dans la ronde d'avant, et ${court(j)} est à ${f.pire.j}. Deux jours de glace légère et je te le rends ; ou il garde le rythme avec les autres et on verra au cinquième match.`,
    options: [
      { cle: 'legere', nom: 'Deux jours de glace légère', niveau: 1, gestes: { energieTous: 12 } },
      { cle: 'rythme', nom: 'Il garde le rythme', niveau: 1,
        pari: { chance: 4 / 6, gagne: { duree: 7, lui: { lancers: 1.3 } }, perd: { duree: 7, lui: { finition: 0.7, blessure: 1.5 } } } },
    ],
  },
  leMarqueurDesSeries: {
    de: 'an', ico: '📺', titre: 'Le marqueur des séries', moment: 'ronde', famille: 'vedette',
    quand: f => !!f.ronde && f.ronde.k >= 2 && !!f.ronde.meneur, joueur: f => f.ronde.meneur,
    fait: f => `${ronde(f)} · ${f.ronde.meneur.n} : ${pts(f.ronde.meneur.pts, f.ronde.meneur.m)} de séries${vraieMot(f.ronde.meneur.vraie) ? ` · ${vraieMot(f.ronde.meneur.vraie)}` : ''}`,
    mots: (f, j) => { const v = vraieMot(f.ronde.meneur.vraie); return `${court(j)}, ${pts(f.ronde.meneur.pts, f.ronde.meneur.m)} de séries. ${v ? `${v[0].toUpperCase()}${v.slice(1)}. ` : ''}Le pays entier veut l'entendre entre les matchs ; lui, il voudrait qu'on le laisse jouer.`; },
    options: [
      { cle: 'cameras', nom: 'Les caméras le suivent', niveau: 1, jetons: 20 },
      { cle: 'silence', nom: 'Il ne parle à personne avant la Coupe', niveau: 2, duree: 7, lui: { finition: 1.2, lancers: 1.5 } },
    ],
  },
};
export const MOMENTS = ['lundi', 'gros', 'ronde'];

/* Le sel d'un tirage : le lundi et le gros match par les matchs joués, la ronde par son rang (l'écran et le robot tirent pareil). */
const instantDe = (moment, f) => (moment === 'ronde' ? `ronde:${f.ronde ? f.ronde.k : 0}` : `${moment}:${f.n}`);
/*
 * LES LUNDIS D'UNE HISTOIRE (V20) : tirés de la graine et de la semaine, `CHANCE_HISTOIRE` en moyenne, jamais la première.
 * V25 C2 : jamais plus de `DISETTE_MAX` lundis de suite sans histoire — le suivant en a une (mesuré, `mesure_rythme` : six
 * lundis vides de suite, une saison sur cent, laissaient le premier quart sans histoire). Le tirage ne fait qu'en ajouter.
 */
export const DISETTE_MAX = 3;
export function lundiAHistoire(graine, w) {
  if (w < 1) return false;
  for (let k = 1, sans = 0; ; k++) {
    const oui = sans >= DISETTE_MAX || hache(String(graine), 'histoire', String(k)) < CHANCE_HISTOIRE;
    if (k === w) return oui;
    sans = oui ? 0 : sans + 1;
  }
}
/*
 * UNE HISTOIRE SE REPOSE (nov. 2026) : sortie, `REPOS_HISTOIRE` semaines avant de revenir, sur un AUTRE joueur que celui
 * qu'elle a déjà nommé (une run ne revoit jamais la même histoire sur le même joueur), `SORTIES_MAX` fois par saison ; un
 * gros match et une ronde ne revoient jamais la même ; une rare, une fois par saison. `sorties` : celles de la saison, { cle, joueur, j },
 * et celles des saisons d'avant de la run, `{ cle, joueur, avant: true }` (`memoireDeLaRun`), lues pour le joueur seulement.
 */
function auRepos(k, f, sorties) {
  const H = HISTOIRES[k], lui = H.joueur(f), siennes = sorties.filter(x => x.cle === k), cetteSaison = siennes.filter(x => !x.avant);
  if (H.moment !== 'lundi' && cetteSaison.length) return true;
  if (cetteSaison.length >= SORTIES_MAX || cetteSaison.some(x => f.jour - x.j <= REPOS_HISTOIRE * SEMAINE)) return true;
  return !!lui && siennes.some(x => x.joueur === lui.cle);
}
/*
 * LES SORTIES D'UNE SAISON (V25 C2), lues dans ses décisions : une histoire du lundi ou d'un gros match à son jour, celle
 * d'une ronde après la saison (`N` + la ronde). L'écran, ses séries et les robots les lisent pareil.
 */
export const sortiesDe = (decisions, N = 0) => decisions.filter(d => d && d.moment && d.moment.famille === 'histoire')
  .map(d => ({ cle: d.moment.cle, choix: d.moment.choix, joueur: d.moment.joueur || null, joueurs: d.moment.joueurs || [], j: Number.isFinite(d.jour) ? d.jour : N + (d.ronde || 0) }));
/* LA MÉMOIRE D'UNE RUN (V25 C2) : les histoires des saisons d'avant ne comptent que pour « jamais la même sur le même joueur ». */
export const memoireDeLaRun = (avant = [], sorties = []) => [...avant, ...sorties.filter(x => x.joueur).map(x => ({ cle: x.cle, joueur: x.joueur, avant: true }))];
/*
 * LE TIRAGE, PUR : la graine, le moment, les faits et les sorties de la saison. Parmi les vraies de ce moment qui ne se reposent
 * pas, le plus haut de son tirage ; une suite passe avant ; une rare ne se tire qu'à certains instants (`CHANCE_RARE`), une par
 * saison. Au lundi, seulement un lundi à histoire. Rien de vrai : null.
 */
export function tirer(graine, moment, f, sorties = []) {
  if (moment === 'lundi' && !lundiAHistoire(graine, Math.floor(f.jour / SEMAINE))) return null;
  const instant = instantDe(moment, f);
  const rareOk = k => !HISTOIRES[k].rare || (hache(String(graine), 'rare', instant) < CHANCE_RARE && !sorties.some(x => !x.avant && HISTOIRES[x.cle] && HISTOIRES[x.cle].rare));
  const vraies = Object.keys(HISTOIRES).filter(k => HISTOIRES[k].moment === moment && HISTOIRES[k].quand(f) && !!HISTOIRES[k].joueur(f) && !auRepos(k, f, sorties) && rareOk(k));
  const suites = vraies.filter(k => HISTOIRES[k].suiteDe);
  const pool = suites.length ? suites : vraies;
  const h = k => hache(String(graine), 'histoire', instant, k);
  return pool.length ? pool.reduce((b, k) => (h(k) > h(b) ? k : b)) : null;
}
/* LA SCÈNE D'UNE HISTOIRE : sa voix, sa réplique qui nomme, le fait sous elle. */
export function sceneDe(cle, f) {
  const H = HISTOIRES[cle], j = H.joueur(f);
  return { de: EXPEDITEURS[H.de], mot: H.mots(f, j), fait: H.fait(f) };
}
/* Le nom d'une option, son joueur posé (« Un mois de Gretzky »). */
export const nomDOption = (o, j) => String(o.nom).replace(/\{nom\}/g, j ? nomCourt(j.n) : 'lui');
