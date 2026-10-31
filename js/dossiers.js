/*
 * LES DOSSIERS DE LA SEMAINE (V10, tranche 5 — docs/refonte-v10.md § 4). Les événements quittent la banque : ce
 * ne sont plus des cartes qu'on tire, ce sont des choix d'À faire, dits par une voix (les scènes du Jalon M,
 * js/scenes.js). Au bureau d'un lundi tiré de la graine (`semaineAHistoire`, V20), un dossier s'ouvre s'il est VRAI : trois
 * soirs sur la route, l'infirmerie qui déborde, un rival dans la semaine, la caisse à sec. V20 : c'est la seule source.
 *
 * Chaque dossier :
 *   de       la voix qui la demande (`EXPEDITEURS`, js/vie-gm.js)
 *   quand    ce qu'elle lit dans les faits du lundi (`faits`, posés par js/saison.js sur ce qui est déjà joué et la
 *            cédule déjà connue — rien d'avance) ; vrai, il peut s'ouvrir
 *   fait     la ligne de chiffres sous la citation, en vrais chiffres
 *   mots     les répliques de la voix : une opinion, aucun chiffre (check_clarte § 5)
 *   joueur   (V11, tranche 4) le joueur que le dossier nomme, lu dans les faits (`{ n, cle }`) : sa disette, ses
 *            punitions, ses jambes, son contrat, sa place sous sa zone — un fait de SES feuilles
 *   maison   (oct.) le sous-onglet où il se règle quand son sujet a sa maison (V12-3 : l'argent et le congédiement au
 *            proprio, les blessés à l'infirmerie) ; sans elle, au vestiaire
 *   options  deux ou trois réponses aux CONSÉQUENCES CONCRÈTES (V21, docs/refonte-v21.md § 3 ; JP : *le système actuel
 *            marche pas*) : des jetons (`gain`, un prix s'il est négatif), de l'expérience au coach (`xp`, en plus ou en
 *            moins), un adjoint pour le staff (`adjoint`, nommé à l'écran) ou le dernier entré qui part (`perdAdjoint`),
 *            des jambes (`action` : `energie` au joueur nommé, `energieTous` à tous), une suspension (`action.absents`),
 *            un soin (`soin`, au blessé nommé), l'auxiliaire au filet, la masse salariale (`plafond`), ou rien ; et,
 *            quand il nomme un joueur, ce qui lui arrive à LUI (`lui`, ou le dé de l'audace, `pari`). Jamais plus un
 *            pourcentage de l'équipe pour quelques soirs.
 * Elles passent par la même porte que les dilemmes (`familleDeMoment`, `appliquerGestes`).
 *
 *   faits : { n, jambes, pire: { n, cle, j }, blesses: [{ n, m }], soirs, dos, visiteur, domicile, rival, bete,
 *             caisse, masse: { espace, libre, lourd: { n, cle, sal } }, defaites, coach: { cle, nom, ico, niveau, adjoints }, dernier: { pour, contre, adv }, rang, equipes,
 *             boude: { n, cle, zone, ou, pts, m }, puni: { n, cle, pun, m }, muet: { n, cle, sal, pts, m },
 *             vedette: { n, cle, fait }, gardien: { n, cle, fait } }
 *   (un joueur absent des faits : null)
 *
 * TOUJOURS UN JOUEUR (V19, tranche 5 ; JP : *les incidents, toujours liés à des joueurs*). Un dossier d'équipe s'accroche
 * à celui qui le porte dans les feuilles : ton meilleur pointeur des dix derniers matchs (`vedette`), le gardien du dernier
 * soir (`gardien`), le plus bas en jambes (`pire`), le plus gros contrat. Seuls trois dossiers n'en nomment pas (la liste blanche
 * de `check_incidents`) : la caisse qui déborde, la tête du coach et la pratique du mardi. Nommer ne change aucune
 * réponse : l'effet d'un dossier va au joueur que ses réponses visent (`lui`, `action.energie`), et elles ne visent que ceux d'avant.
 */
import { hache } from './util.js';

/* Les faits d'un joueur se lisent sur ses FENETRE_JOUEUR derniers matchs ; la chicane, à PUNITIONS_CHICANE punitions. */
export const FENETRE_JOUEUR = 10, PUNITIONS_CHICANE = 4;

/*
 * LA BANQUE EST VIDE (V22, docs/refonte-v22.md ; JP : *les événements, c'est encore à chier : supprime la banque, pas
 * le système*). Les dix-neuf dossiers de la V10 à la V21 sont partis, sans être repris ; la phase 4 de la V22 écrit une
 * banque neuve. Le système reste : un lundi tiré de la graine, le fait lu sur ce qui est déjà joué, la voix, la scène,
 * les options qui passent par `appliquerGestes`.
 */
export const DOSSIERS = {};
/*
 * LA SEMAINE D'UNE HISTOIRE (V20, docs/refonte-v20.md § 3 ; JP : *oui à tout* ; le 27 oct. : *les événements devraient
 * être plus « randoms »*). Le dossier était la semaine paire, la route l'impaire, un dilemme aux journées fixes, un courriel
 * aux huit matchs : cinq horloges qu'un joueur apprenait vite. Il reste une source, le dossier, un lundi tiré de la graine
 * et de la semaine (`hache`), `CHANCE_HISTOIRE` en moyenne, dès la première ; la même graine rejoue les mêmes lundis.
 */
const CHANCE_HISTOIRE = 0.55;
export const semaineAHistoire = (graine, w) => w >= 1 && hache(String(graine), 'histoire', String(w)) < CHANCE_HISTOIRE;
const tirer = (graine, w, cle) => hache(String(graine), 'dossier', String(w), cle);
/*
 * LE DOSSIER D'UNE SEMAINE : PUR, la graine, la semaine et les faits du lundi. Parmi les vrais qui ne se sont pas
 * encore ouverts cette saison (`deja`), le plus haut de son tirage ; aucun vrai, aucun dossier (null).
 */
export function dossierDeLaSemaine(graine, w, faits, deja = []) {
  const vraies = Object.keys(DOSSIERS).filter(k => !deja.includes(k) && DOSSIERS[k].quand(faits));
  return vraies.length ? vraies.reduce((b, k) => (tirer(graine, w, k) > tirer(graine, w, b) ? k : b)) : null;
}
