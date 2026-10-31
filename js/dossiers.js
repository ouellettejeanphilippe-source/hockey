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
 *            moins), une carte d'adjoint dans ta main (`adjoint`, nommée à l'écran : js/adjoints.js),
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
 * LA BANQUE NEUVE (V22, docs/refonte-v22.md, phase 4 ; JP : *simple, impactant, le fun, marquant*). Les dix-neuf dossiers
 * d'avant sont partis, sans être repris. Chaque histoire : DEUX réponses, chacune UNE chose concrète et grosse — des
 * jetons, de l'expérience au coach, une carte d'adjoint dans ta main (`adjoint`), un joueur suspendu, l'auxiliaire au
 * filet, des jambes —, jamais un pourcentage ni une durée à l'équipe ; l'audace est un dé sur le joueur nommé (`pari`).
 * Chacune nomme un joueur et ses vrais chiffres (le fait), une voix la dit, et son issue se lit à Hier soir.
 */
const avec = x => (x ? ` · ${x.fait}` : '');
export const DOSSIERS = {
  // La vedette qui porte le club : ton meilleur pointeur des dix derniers matchs.
  laVedette: {
    de: 'an', ico: '📸', titre: 'Tout le monde veut la vedette',
    quand: f => !!f.vedette && f.n >= 5,
    joueur: f => f.vedette,
    fait: f => `${f.rang === 1 ? '1er' : `${f.rang}e`} sur ${f.equipes} après ${f.n} matchs${avec(f.vedette)}`,
    mots: ['Les commanditaires se l\'arrachent. Une soirée avec lui, et le compte du club respire.',
      'Il porte l\'équipe. On peut le vendre aux caméras, ou le garder pour la glace.'],
    options: [
      { cle: 'medias', nom: 'La tournée des médias', bon: 'Les commanditaires paient', gain: 20 },
      { cle: 'glace', nom: 'Le garder pour la glace', bon: 'Ton coach bâtit autour de lui', xp: 5 },
    ],
  },
  // Le gros contrat qui ne produit pas.
  leMuet: {
    de: 'en', ico: '🥶', titre: 'La disette',
    quand: f => !!f.muet && f.n >= 8,
    joueur: f => f.muet,
    fait: f => (f.muet ? `${f.muet.n} : ${f.muet.sal} · ${f.muet.pts} point${f.muet.pts > 1 ? 's' : ''} en ${f.muet.m} matchs` : `${f.n} matchs`),
    mots: ['Il ne touche plus la rondelle. Moi, je le brasserais devant les journalistes ; toi, tu signes.',
      'Payé comme un marqueur, il joue comme un passager. Il faut faire quelque chose cette semaine.'],
    options: [
      { cle: 'defi', nom: 'Le mettre au défi devant les journalistes', bon: 'Si ça passe : il répond, plus de tirs et de précision', prix: 'Sinon : il force ses tirs, moins de précision',
        pari: { chance: 3 / 6, gagne: { duree: 8, lui: { lancers: 1.5, finition: 1.3 } }, perd: { duree: 8, lui: { lancers: 1.5, finition: 0.5 } } } },
      { cle: 'repos', nom: 'Le reposer deux matchs', bon: 'Il revient la tête vidée', prix: 'Deux matchs sans lui', action: { absents: 2 } },
    ],
  },
  // Le gardien battu au dernier match.
  leGardienBattu: {
    de: 'en', ico: '🥅', titre: 'Le gardien battu',
    quand: f => !!f.gardien && !!f.dernier && f.dernier.contre >= 5,
    joueur: f => f.gardien,
    fait: f => `${f.dernier ? `${f.dernier.pour}–${f.dernier.contre} contre ${f.dernier.adv}` : `${f.n} matchs`}${avec(f.gardien)}`,
    mots: ['Il en a mangé une. Tu le renvoies devant le filet, ou tu lui donnes deux soirs pour y repenser.',
      'Cinq buts, ça laisse des traces. Le prochain départ décide s\'il rebondit ou s\'il coule.'],
    options: [
      { cle: 'renvoyer', nom: 'Le renvoyer devant le filet', bon: 'Si ça passe : il se venge, moins de buts accordés', prix: 'Sinon : il coule encore, plus de buts accordés',
        pari: { chance: 3 / 6, gagne: { duree: 6, lui: { arrets: 0.85 } }, perd: { duree: 6, lui: { arrets: 1.15 } } } },
      { cle: 'auxiliaire', nom: 'L\'auxiliaire deux soirs', bon: 'Ton partant souffle', prix: 'Deux soirs avec l\'auxiliaire', action: { gardienAux: 2 } },
    ],
  },
  // Celui qui va au cachot.
  laChicane: {
    de: 'ca', ico: '🥊', titre: 'La chicane au vestiaire',
    quand: f => !!f.puni,
    joueur: f => f.puni,
    fait: f => (f.puni ? `${f.puni.n} : ${f.puni.pun} punitions en ${f.puni.m} matchs` : `${f.n} matchs`),
    mots: ['Il nous coûte des avantages numériques, et les gars commencent à le lui dire en face.',
      'Ça a brassé après le match. Il faut que quelqu\'un tranche, et ce n\'est pas moi.'],
    options: [
      { cle: 'suspendre', nom: 'Le suspendre deux matchs', bon: 'Ton coach montre qui mène', prix: 'Il manque deux matchs', action: { absents: 2 }, xp: 4 },
      { cle: 'amende', nom: 'Une amende', bon: 'L\'amende va à la caisse', gain: 8 },
    ],
  },
  // Trois soirs sur la route.
  laRoute: {
    de: 'ph', ico: '🧳', titre: 'La semaine sur la route',
    quand: f => f.visiteur >= 3 && !!f.pire,
    joueur: f => f.pire,
    fait: f => `${f.visiteur} matchs à l\'étranger cette semaine · jambes ${f.jambes}${f.pire ? ` · ${f.pire.n} : ${f.pire.j}` : ''}`,
    mots: ['Les valises sont faites, les jambes, pas encore. Un vol nolisé, et je te les rends frais.',
      'L\'autobus, l\'avion, l\'hôtel. Si on ne fait rien, on arrive au troisième soir sur les genoux.'],
    options: [
      { cle: 'nolise', nom: 'Le vol nolisé', bon: 'Les jambes de tous reviennent', prix: 'Le vol se paie', gain: -15, action: { energieTous: 10 } },
      { cle: 'autobus', nom: 'L\'autobus de nuit', bon: 'Des jetons d\'économie', prix: 'Les jambes de tous paient', gain: 10, action: { energieTous: -8 } },
    ],
  },
  // Un adjoint en vue, quand la caisse le permet.
  leRecruteur: {
    de: 'dg', ico: '📋', titre: 'Un adjoint en vue',
    quand: f => f.caisse !== null && f.caisse >= 50 && !!f.vedette,
    joueur: f => f.vedette,
    fait: f => `${f.caisse ?? 0} 🪙 en caisse · ${f.n} matchs, ${f.rang === 1 ? '1er' : `${f.rang}e`} sur ${f.equipes}${avec(f.vedette)}`,
    mots: ['J\'ai un nom pour toi. Il coûte, mais il change la façon dont ce club joue.',
      'La caisse est pleine et le téléphone sonne. Un adjoint de plus dans ta main, si tu signes le chèque.'],
    options: [
      { cle: 'signer', nom: 'Signer le chèque', bon: 'Une carte d\'adjoint dans ta main', prix: 'Son salaire', gain: -25, adjoint: true },
      { cle: 'garder', nom: 'Garder l\'argent', bon: 'La caisse reste pleine', rien: true },
    ],
  },
};
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
