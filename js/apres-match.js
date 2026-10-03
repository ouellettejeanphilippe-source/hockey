/**
 * LE PLATEAU D'APRÈS-MATCH.
 *
 * Comme à la télé : l'animateur résume la soirée, sérieux et pince-sans-rire.
 * Le format est celui d'un vrai bulletin sportif (une accroche, le fait, une
 * analyse, une chute) ; l'humour vient du sérieux avec lequel on traite le
 * banal du hockey. Jamais de gag annoncé, jamais de point d'exclamation.
 *
 * LA RÈGLE DE CE FICHIER (la même que js/recit.js) : il ne décide de RIEN.
 * Le moteur a joué le match ; ici on lit la feuille et on met des mots dessus.
 * Une pièce est ÉTIQUETÉE par la situation qui la rend vraie, et ne se dit que
 * si toutes ses étiquettes sont vraies sur CETTE feuille : une phrase drôle qui
 * serait fausse est pire qu'une phrase plate. Aucun chiffre n'est écrit en dur :
 * ceux qu'on lit viennent de la feuille, par les gabarits.
 *
 * Quatre banques en pièces à assembler, `[texte, étiquettes]` :
 *   OUVERTURE  l'accroche de l'animateur
 *   CONSTAT    le fait du match
 *   ANALYSE    ce que le plateau en conclut
 *   CHUTE      la dernière phrase
 * Les étiquettes sont séparées par une espace, `!` nie ; aucune étiquette =
 * vraie toujours. Elles viennent de `situationDe` :
 *
 *   issue      V D · OT (but en prolongation) · barrage (tirs de barrage) ·
 *              BL (on a blanchi l'autre) BLsubi · remontee (victoire après
 *              un retard d'au moins deux buts) gaspille (défaite après une
 *              avance d'au moins deux buts) · assur (but d'assurance de notre
 *              côté) assurAdv · raclee (victoire d'au moins quatre buts)
 *              raclSubie · un (écart d'un but) · desert (défaite d'un but, le
 *              gardien sorti pour un attaquant de plus : ctx.filetDesert) ·
 *              egalite3 (égalité brisée dans les cinq dernières minutes de la
 *              3e) · tardif (but gagnant dans les dix dernières minutes) ·
 *              gagnantAN (le but gagnant est sur l'avantage numérique)
 *   gardien    g35 (le nôtre, 35 arrêts et plus) adv35 (le leur) · gmauvais
 *              advmauvais (quatre buts alloués et moins de ,880)
 *   unités     anMoi anAdv (un but en avantage numérique) · anRate (trois
 *              avantages ou plus, aucun but) · dnParfait (trois désavantages ou
 *              plus, aucun but accordé) · dnBut dnButAdv (un but en infériorité)
 *   punitions  punMoi punAdv (quatre et plus) · sansPun (aucune, des deux
 *              côtés) · propre (aucune chez nous, au moins une chez eux)
 *   bagarre    bag (au moins une) · bagMoi bagAdv (on l'a gagnée / ils l'ont
 *              gagnée) · bagNul (aucune n'a de gagnant)
 *   séquence   premiere (ctx.sequence : première victoire après {n} défaites)
 *              derniere (la dernière victoire d'une séquence de {n})
 *   série      serie · m1 à m7 (le numéro du match) · meneSerie tireDerriere
 *              egaleSerie · passes sortis · balai balaiSubi · sursis
 *   saison     rs (saison régulière) · course elimine premier vengeance
 *              (ctx.saison, ctx.vengeance)
 *
 * Les gabarits : {eq} notre équipe, {autre} l'autre, {s} le pointage (le
 * vainqueur d'abord : 4-2), {m} le marqueur du but gagnant (ou celui du doublé
 * d'une pièce qui n'en parle pas autrement), {g} le gardien dont parle l'étiquette
 * (g35 et gmauvais : le nôtre ; adv35 et advmauvais : le leur), {n} le nombre
 * de l'unique étiquette qui en porte un, {per} la période du but gagnant,
 * {ser} la série après le match (3-1, de notre côté). Un gabarit qui ne peut
 * pas se résoudre retire la pièce.
 *
 * Le tirage est DÉTERMINISTE : la même feuille, le même contexte et la même
 * graine redonnent le même texte, et aucune pièce ne se répète dans un texte.
 */

import { nomCourt } from './recit.js';
import { cap } from './util.js';

/* ---------- le tirage déterministe (la même mécanique que js/recit.js) ---------- */
function graine(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/* ---------- OUVERTURE : l'accroche de l'animateur ---------- */
export const OUVERTURE = [
  // Toujours vraies.
  ["Bonsoir. Voici ce qu'il faut retenir de la soirée de {eq}.", ""],
  ["Mesdames et messieurs, bonsoir. Le dossier {eq} contre {autre} est sur la table.", ""],
  ["Bonsoir et bienvenue. Nous passons au match de {eq}, sans autre préambule.", ""],
  ["Merci de rester avec nous. Le plateau revient sur la rencontre entre {eq} et {autre}.", ""],
  ["Les faits d'abord, les opinions ensuite : {eq} affrontait {autre}.", ""],
  ["Le plateau est en place et les statistiques sont devant nous. {eq} contre {autre}.", ""],
  ["Bonsoir. Nous reprenons le match depuis le début, comme le veut la tradition.", ""],
  ["Bienvenue à ce bilan de soirée. On commence par {eq}, parce qu'il faut bien commencer par quelqu'un.", ""],
  ["Bonsoir. Notre régie me confirme que le match est bel et bien terminé. Nous pouvons donc en parler.", ""],
  ["Bonsoir. J'ai relu la feuille de pointage plusieurs fois ; elle dit toujours la même chose.", ""],
  ["Bonsoir. La feuille de match est officielle, ce qui nous évite beaucoup de débats.", ""],
  ["Bonsoir. Prenez place : il y a des chiffres à lire et nous allons les lire.", ""],
  ["Bonsoir. Un match de hockey s'est tenu ce soir, et {eq} y était.", ""],
  ["Nous ouvrons le dossier du soir : {eq} contre {autre}, pièces à l'appui.", ""],
  ["Bonsoir. Le jury d'analystes est réuni, café à la main, pour {eq} et {autre}.", ""],
  ["Bonsoir. Au sommaire : un pointage, des arrêts et une conclusion que nous prendrons au sérieux.", ""],
  ["Bonsoir. Le hockey a eu lieu, {eq} y a participé, et le plateau a pris des notes.", ""],
  ["Bonsoir. Les faits sont rassemblés ; il ne reste qu'à les dire avec un air grave.", ""],
  ["Bonsoir. Nous allons procéder par ordre : le pointage, les faits, puis les conséquences.", ""],
  ["Bonsoir. La soirée de {eq} mérite qu'on s'y attarde, ne serait-ce que pour la forme.", ""],
  ["Bonsoir. Je vous demanderais un instant de calme pour la lecture du résumé.", ""],
  ["Bonsoir. Voici le résumé, tel qu'établi par des gens qui ont regardé le match jusqu'au bout.", ""],
  ["Bonsoir. Le match de {eq} est terminé ; l'analyse, elle, commence à peine.", ""],
  ["Bonsoir. Rien de ce que vous entendrez ne figure à l'horaire de la soirée, sauf le match.", ""],
  ["Bonsoir. Nos recherchistes ont travaillé sur {eq} et {autre} jusqu'à la dernière minute, au sens propre.", ""],
  ["Bonsoir. On ne présente plus {eq} ; on présente le résumé de son match.", ""],
  ["Bonsoir. Nous avons les images, les chiffres et un tableau blanc. Commençons.", ""],
  ["Bonsoir. Le moment est venu de dire ce qui s'est passé entre {eq} et {autre}.", ""],
  ["Bonsoir. Un résumé de match, c'est un acte de foi appuyé sur des statistiques.", ""],
  ["Bonsoir. Aucun commentaire ne sera fait avant d'avoir regardé la feuille.", ""],
  // Victoire / défaite.
  ["Bonsoir. Bonne soirée pour {eq}, et nous le dirons sans exagérer.", "V"],
  ["Bonsoir. {eq} a gagné. Nous allons expliquer comment, mais le plus important est dit.", "V"],
  ["Bonsoir. Deux points de plus au classement de {eq}, et un sourire discret dans l'entourage.", "V rs"],
  ["Bonsoir. Du côté de {eq}, on rentre avec la victoire. Le trajet sera agréable.", "V"],
  ["Bonsoir. {eq} l'emporte contre {autre}. Le plateau reste calme, c'est une consigne.", "V"],
  ["Bonsoir. Le vestiaire de {eq} a de bonnes raisons de sourire ce soir ; il le fera avec retenue.", "V"],
  ["Bonsoir. {eq} s'est imposé. Nous n'en dirons pas plus avant d'avoir les chiffres.", "V"],
  ["Bonsoir. Soirée satisfaisante pour {eq}, au sens que lui donne le règlement.", "V"],
  ["Bonsoir. Victoire de {eq} : un résultat que nous accueillons avec un enthousiasme mesuré.", "V"],
  ["Bonsoir. {eq} a gagné. {autre}, lui, a pris note.", "V"],
  ["Bonsoir. Le résultat du jour : {eq} {s}. Le reste n'est que commentaire.", "V !barrage"],
  ["Bonsoir. Les gens de {eq} peuvent dormir tranquilles ; ils l'ont mérité, selon la feuille.", "V"],
  ["Bonsoir. Soirée sans histoire pour {eq}, si l'on exclut la victoire.", "V"],
  ["Bonsoir. {eq} a obtenu ce qu'il était venu chercher. Ce n'est pas si fréquent.", "V"],
  ["Bonsoir. Le plateau est unanime : {eq} a gagné. C'est la seule unanimité de la soirée.", "V"],
  ["Bonsoir. Soirée difficile pour {eq}. Nous allons la décrire avec tout le tact que permet un pointage.", "D"],
  ["Bonsoir. {eq} s'est incliné. Le plateau observe une minute de réflexion, sans minuterie.", "D"],
  ["Bonsoir. Défaite de {eq} contre {autre}. Commençons par les faits, qui sont têtus.", "D"],
  ["Bonsoir. Le résultat n'est pas celui que {eq} avait prévu à son horaire.", "D"],
  ["Bonsoir. {autre} a pris la mesure de {eq} ce soir. Voyons comment.", "D"],
  ["Bonsoir. Soirée à oublier chez {eq}, mais nous la raconterons quand même : c'est notre travail.", "D"],
  ["Bonsoir. Mauvaise nouvelle du côté de {eq}, confirmée par la feuille officielle.", "D"],
  ["Bonsoir. {eq} perd. Nous avons vérifié plusieurs fois, parce que personne ne voulait y croire.", "D"],
  ["Bonsoir. Le pointage est défavorable à {eq}. Les causes sont multiples et nous les listerons.", "D"],
  ["Bonsoir. Soirée instructive pour {eq}, au sens où l'on apprend surtout de ses défaites.", "D"],
  ["Bonsoir. {eq} s'incline face à {autre}, {s}. Nous allons procéder avec délicatesse.", "D !barrage"],
  ["Bonsoir. Les partisans de {eq} sont invités à respirer profondément avant la suite.", "D"],
  ["Bonsoir. Le dossier {eq} comporte ce soir une pièce défavorable : le pointage.", "D"],
  ["Bonsoir. Nous avons de moins bonnes nouvelles pour {eq}. Elles sont toutefois bien documentées.", "D"],
  // Prolongation et tirs de barrage.
  ["Bonsoir. Il a fallu une prolongation pour départager {eq} et {autre}, et nous allons en parler longuement.", "OT"],
  ["Bonsoir. Le règlement prévoit du temps supplémentaire, et ce soir il s'est avéré utile.", "OT"],
  ["Bonsoir. L'horaire prévoyait soixante minutes. {eq} et {autre} ont jugé que ce n'était pas assez.", "OT"],
  ["Bonsoir. Égalité au terme de la troisième période, donc prolongation. Nous remercions les spectateurs de leur patience.", "OT"],
  ["Bonsoir. Une rencontre qui a refusé de se terminer à l'heure : prolongation entre {eq} et {autre}.", "OT"],
  ["Bonsoir. Il a fallu une prolongation pour en arriver là. Nos recherchistes dorment moins, mais ne se plaignent pas.", "OT"],
  ["Bonsoir. {eq} a gagné en prolongation, ce qui est parfaitement permis par le règlement.", "OT V"],
  ["Bonsoir. {eq} s'incline en prolongation. Il a tout de même quitté la glace avec un point.", "OT D rs"],
  ["Bonsoir. {eq} s'incline en prolongation, un genre de défaite qui laisse le temps d'y penser.", "OT D"],
  ["Bonsoir. Rien n'a pu départager {eq} et {autre} sur la glace : il a fallu les tirs de barrage.", "barrage"],
  ["Bonsoir. La soirée s'est terminée aux tirs de barrage, que le règlement tolère et que le sérieux déconseille.", "barrage"],
  ["Bonsoir. Tirs de barrage : un exercice où l'on a toujours raison après coup.", "barrage"],
  ["Bonsoir. {eq} a gagné aux tirs de barrage. Le tableau blanc n'avait rien prévu de tel.", "barrage V"],
  ["Bonsoir. {eq} perd aux tirs de barrage, c'est-à-dire en tête à tête, sans témoins ni excuses.", "barrage D"],
  // Les grands scénarios.
  ["Bonsoir. Un blanchissage, et nous le prononçons avec la solennité qui lui est due.", "BL"],
  ["Bonsoir. {eq} a blanchi {autre}. Ce n'est pas un gros mot, mais ça en a le poids.", "BL"],
  ["Bonsoir. {eq} n'a pas marqué ce soir. Nous disposons de nombreux témoins.", "BLsubi"],
  ["Bonsoir. Pas un seul but pour {eq}. Le plateau a vérifié, la rondelle n'est pas restée dans un coin.", "BLsubi"],
  ["Bonsoir. Ce ne fut pas serré. {eq} a gagné largement, et nous ne chercherons pas de nuance.", "raclee"],
  ["Bonsoir. Soirée à sens unique pour {eq}, et ce sens était le bon.", "raclee"],
  ["Bonsoir. Le pointage de {eq} ce soir demande une certaine préparation psychologique. Respirez.", "raclSubie"],
  ["Bonsoir. Un de ces matchs où l'on se demande s'il n'y avait pas un autre événement ailleurs dans l'édifice.", "raclSubie"],
  ["Bonsoir. {eq} a gagné après avoir été mené par au moins deux buts. Nous y reviendrons avec le sérieux requis.", "remontee"],
  ["Bonsoir. Il y avait un retard à rattraper, et {eq} s'en est chargé. Voici le dossier.", "remontee"],
  ["Bonsoir. {eq} menait par au moins deux buts. Cette phrase, vous allez le constater, ne finit pas bien.", "gaspille"],
  ["Bonsoir. Une avance de deux buts ne tient pas toujours. Le cas de {eq} ce soir sera étudié.", "gaspille"],
  ["Bonsoir. {eq} s'est assuré la victoire en fin de match. Un but d'assurance est une police comme une autre.", "assur"],
  ["Bonsoir. {autre} a ajouté un but d'assurance tard dans le match. C'est ce qu'on appelle une résiliation de contrat.", "assurAdv"],
  ["Bonsoir. L'égalité tenait encore tard en troisième période. Elle a cédé, comme toutes les égalités.", "egalite3"],
  ["Bonsoir. Tout s'est joué dans les dernières minutes de la troisième période. Nous détaillons.", "egalite3"],
  ["Bonsoir. Un seul but d'écart, et pas beaucoup de marge pour les commentaires.", "un !OT"],
  ["Bonsoir. {eq} a gagné par un seul but. Les mathématiciens du plateau y voient une victoire complète.", "un !OT V"],
  ["Bonsoir. {eq} a perdu par un seul but. Les mathématiciens du plateau y voient une défaite complète.", "un !OT D"],
  ["Bonsoir. {eq} a sorti son gardien pour un attaquant de plus, et le dossier le dit sans détour.", "desert"],
  ["Bonsoir. Un filet désert, un but d'écart : voici un résumé qui se lit à voix basse.", "desert"],
  // Le gardien.
  ["Bonsoir. Notre premier mot ira à {g}, qui a vu beaucoup de rondelles ce soir.", "g35"],
  ["Bonsoir. {g} a travaillé tard ce soir, et nous tenons à le souligner.", "g35"],
  ["Bonsoir. Soirée occupée devant le filet de {eq} : {g} a effectué {n} arrêts.", "g35"],
  ["Bonsoir. Le gardien adverse, {g}, a retenu l'attention de tout le plateau.", "adv35"],
  ["Bonsoir. {g} s'est dressé devant {eq} avec une constance que nous qualifierons d'inconfortable.", "adv35"],
  ["Bonsoir. Notre gardien, {g}, a connu une soirée que son agent ne mentionnera pas.", "gmauvais"],
  ["Bonsoir. Le dossier de {g} sera court ce soir, et pas très flatteur.", "gmauvais"],
  ["Bonsoir. Le gardien adverse, {g}, a connu une soirée difficile. Nous en parlerons avec égards.", "advmauvais"],
  ["Bonsoir. {eq} a trouvé la faille chez {g}, et le plateau en prend acte.", "advmauvais"],
  // Les unités spéciales, les punitions, les gants.
  ["Bonsoir. Le jeu de puissance de {eq} a parlé, et il a dit des choses utiles.", "anMoi"],
  ["Bonsoir. {autre} a profité d'un avantage numérique contre {eq}. C'est une politesse que nous ne souhaitons à personne.", "anAdv"],
  ["Bonsoir. {eq} a eu de nombreux avantages numériques et n'en a rien fait. Nous allons y revenir.", "anRate"],
  ["Bonsoir. {eq} a passé beaucoup de temps en désavantage numérique et n'a rien accordé. Soirée remarquable, en quelque sorte.", "dnParfait"],
  ["Bonsoir. {eq} a marqué en infériorité numérique, ce qui est à la fois permis et rare.", "dnBut"],
  ["Bonsoir. {autre} a marqué en infériorité numérique contre {eq}. Nous sommes sous le choc, de façon professionnelle.", "dnButAdv"],
  ["Bonsoir. {eq} a passé beaucoup de temps au cachot ce soir. Nous avons les chiffres.", "punMoi"],
  ["Bonsoir. {autre} a passé la soirée à écouter les arbitres. Nous avons les chiffres.", "punAdv"],
  ["Bonsoir. Aucune punition ce soir. Les arbitres ont eu une soirée tranquille ; nous aussi.", "sansPun"],
  ["Bonsoir. {eq} n'a écopé d'aucune punition. La discipline, comme on dit, ça existe.", "propre"],
  ["Bonsoir. Il y a eu bagarre ce soir, et nous devons le mentionner pour l'intégrité du dossier.", "bag"],
  ["Bonsoir. Quelques gants ont été lancés. Le plateau a eu une pensée pour la buanderie.", "bag"],
  // Les séquences.
  ["Bonsoir. {eq} met fin à une séquence de {n} défaites. Nous ne dirons pas à quel point on l'attendait.", "premiere V"],
  ["Bonsoir. La séquence de {n} défaites de {eq} s'arrête ici. Le calendrier en prend note.", "premiere V"],
  ["Bonsoir. {eq} signe sa {n}e victoire de suite, dernière d'une séquence. Nous reviendrons sur le moment.", "derniere V"],
  // Les séries.
  ["Bonsoir. Premier match de la série : on y lit déjà des signes, comme dans le marc de café.", "m1"],
  ["Bonsoir. Deuxième match de la série. Les tendances sont encore fragiles, mais le plateau en a quand même vu.", "m2"],
  ["Bonsoir. Troisième match de la série. La série prend sa forme, et nous aussi.", "m3"],
  ["Bonsoir. Quatrième match de la série. Les calculs deviennent sérieux, ce qui n'est pas peu dire.", "m4"],
  ["Bonsoir. Cinquième match. À ce stade, chaque but est annoncé avec une voix plus grave.", "m5"],
  ["Bonsoir. Sixième match. Le calendrier se resserre et les cafés se multiplient.", "m6"],
  ["Bonsoir. Septième match. Je demande à tous les téléphones de rester éteints.", "m7"],
  ["Bonsoir. {eq} remporte la série. Nous le disons sans trembler.", "passes"],
  ["Bonsoir. La saison de {eq} se termine ici. Nous ne ferons pas de discours.", "sortis"],
  ["Bonsoir. Un balayage. Nous prononçons ce mot avec le respect que lui accordent les statisticiens.", "balai V"],
  ["Bonsoir. {eq} vient de se faire balayer. Le plateau s'abstient de tout commentaire sur le balai.", "balaiSubi"],
  ["Bonsoir. {eq} reste en vie, ce qui est le minimum syndical d'une série.", "sursis"],
  ["Bonsoir. La série est égale, ce qui est la définition même d'une série.", "egaleSerie"],
  ["Bonsoir. {eq} mène la série. Rien n'est joué, mais quelque chose est inscrit.", "meneSerie"],
  ["Bonsoir. {eq} tire de l'arrière dans la série. Nous restons sur la glace, symboliquement.", "tireDerriere"],
  // La saison.
  ["Bonsoir. Dans la course aux séries, chaque match de {eq} est un petit référendum.", "course"],
  ["Bonsoir. {eq} est en pleine course aux séries, et le plateau s'est habillé en conséquence.", "course"],
  ["Bonsoir. {eq} jouait ce soir sans enjeu mathématique, mais avec toute sa dignité.", "elimine"],
  ["Bonsoir. {eq} est éliminé des séries, ce qui n'empêche pas la rondelle d'être mise au jeu.", "elimine"],
  ["Bonsoir. {eq}, premier au classement, jouait ce soir avec un certain poids sur les épaules.", "premier"],
  ["Bonsoir. Au sommet du classement, {eq} a joué ce soir. Rien de moins, rien de plus.", "premier"],
  ["Bonsoir. Un joueur de {eq} affrontait son ancien club ce soir. Le dossier est classé « sensible ».", "vengeance"],
  ["Bonsoir. Un ancien du club d'en face portait le chandail de {eq}. Les retrouvailles furent cordiales, jusqu'à la mise au jeu.", "vengeance"],
];

/* ---------- CONSTAT : le fait du match ---------- */
export const CONSTAT = [
  // Le pointage.
  ["{eq} l'emporte {s} contre {autre}.", "V !barrage"],
  ["{eq} a battu {autre} par la marque de {s}.", "V !barrage"],
  ["Le pointage final est de {s} en faveur de {eq}.", "V !barrage"],
  ["La feuille de match est claire : {eq} {s}.", "V !barrage"],
  ["{autre} n'a pas trouvé la solution : {eq} gagne {s}.", "V !barrage"],
  ["Au terme du match, {eq} s'en tire avec la victoire, {s}.", "V !barrage"],
  ["Résultat officiel : victoire de {eq}, {s}.", "V !barrage"],
  ["{autre} a battu {eq} {s}.", "D !barrage"],
  ["Le pointage final est de {s} en faveur de {autre}.", "D !barrage"],
  ["La feuille de match est claire : {autre} {s}.", "D !barrage"],
  ["{eq} n'a pas trouvé la solution : {autre} gagne {s}.", "D !barrage"],
  ["Au terme du match, {autre} s'en tire avec la victoire, {s}.", "D !barrage"],
  ["Résultat officiel : défaite de {eq}, {s}.", "D !barrage"],
  ["{eq} a perdu contre {autre}, {s}. Le dossier est complet.", "D !barrage"],
  ["{eq} et {autre} se sont affrontés ; le pointage final est de {s}.", "!barrage"],
  // Le but gagnant.
  ["Le but gagnant, marqué par {m} en {per}, a donné la victoire à {eq}.", "V"],
  ["C'est {m} qui a fait pencher la balance pour {eq}, en {per}.", "V"],
  ["{m} a inscrit le but gagnant de {eq} en {per}.", "V"],
  ["Le but qui a décidé du match porte la signature de {m}, pour {eq}.", "V"],
  ["Le but gagnant porte la signature de {m}, de {autre}, en {per}.", "D"],
  ["{m} a marqué le but gagnant pour {autre}, en {per}.", "D"],
  ["C'est {m} qui a fait pencher la balance, du côté de {autre}, en {per}.", "D"],
  ["Le but qui a décidé du match est celui de {m}, de {autre}.", "D"],
  // La prolongation et les tirs de barrage.
  ["{m} a donné la victoire à {eq} en prolongation, {s}.", "OT V"],
  ["{eq} l'emporte {s} grâce à un but de {m} en prolongation.", "OT V"],
  ["Il a fallu une prolongation, et {m} y a mis fin pour {eq}.", "OT V"],
  ["{m} a réglé la question en prolongation : {eq} {s}.", "OT V"],
  ["{m} a marqué en prolongation pour {autre}, qui l'emporte {s}.", "OT D"],
  ["{eq} s'incline {s} en prolongation, sur un but de {m}.", "OT D"],
  ["La prolongation a été fatale à {eq} : {m} a marqué pour {autre}.", "OT D"],
  ["Une prolongation, un but de {m}, et {autre} repart avec la victoire {s}.", "OT D"],
  ["{eq} et {autre} étaient à égalité {s} après le temps réglementaire. Il a fallu départager, et {eq} a gagné aux tirs de barrage.", "barrage V"],
  ["{eq} a remporté les tirs de barrage, après une égalité de {s}.", "barrage V"],
  ["{eq} et {autre} étaient à égalité {s} après le temps réglementaire. Il a fallu départager, et {autre} a gagné aux tirs de barrage.", "barrage D"],
  ["{eq} a perdu les tirs de barrage, après une égalité de {s}.", "barrage D"],
  // Les blanchissages.
  ["{eq} blanchit {autre} {s}.", "BL"],
  ["{autre} n'a pas marqué : {eq} gagne {s}.", "BL"],
  ["Blanchissage pour {eq}, qui ne laisse rien à {autre}. Pointage de {s}.", "BL"],
  ["{autre} blanchit {eq} {s}.", "BLsubi"],
  ["{eq} n'a pas marqué : {autre} gagne {s}.", "BLsubi"],
  ["Blanchissage pour {autre}, qui ne laisse rien à {eq}. Pointage de {s}.", "BLsubi"],
  // Les remontées, les avances gaspillées, les assurances.
  ["{eq} a effacé un retard d'au moins deux buts pour gagner {s}.", "remontee"],
  ["{eq} tirait de l'arrière par au moins deux buts, et a quand même gagné {s}.", "remontee"],
  ["La remontée est de {eq} : un retard d'au moins deux buts, puis la victoire {s}.", "remontee"],
  ["{eq} menait par au moins deux buts, et a perdu {s}.", "gaspille"],
  ["{autre} a effacé un retard d'au moins deux buts pour battre {eq} {s}.", "gaspille"],
  ["{eq} avait deux buts d'avance, au moins, puis le match a changé de propriétaire : {autre} gagne {s}.", "gaspille"],
  ["{eq} a scellé la victoire en fin de match avec un but d'assurance.", "assur"],
  ["Un but d'assurance de {eq} tard dans la rencontre a réglé le dossier.", "assur"],
  ["{autre} a scellé le match tard dans la rencontre avec un but d'assurance.", "assurAdv"],
  ["Un but d'assurance de {autre} en fin de match a fermé la porte à {eq}.", "assurAdv"],
  // Les écarts.
  ["{eq} l'emporte par au moins quatre buts, {s}.", "raclee"],
  ["Victoire par au moins quatre buts pour {eq} : {s}.", "raclee"],
  ["{eq} a battu {autre} {s}. L'écart est d'au moins quatre buts.", "raclee"],
  ["{eq} perd par au moins quatre buts, {s}.", "raclSubie"],
  ["Défaite par au moins quatre buts pour {eq} : {s}.", "raclSubie"],
  ["{autre} a battu {eq} {s}. L'écart est d'au moins quatre buts.", "raclSubie"],
  ["Un seul but a séparé {eq} et {autre} : {s}, en faveur de {eq}.", "un V !OT !barrage"],
  ["Un seul but a séparé {eq} et {autre} : {s}, en faveur de {autre}.", "un D !OT !barrage"],
  ["{eq} a joué la fin de match sans gardien pour ajouter un attaquant, et s'incline {s}.", "desert"],
  ["{eq} a sorti son gardien en fin de match. Le pointage final est de {s}, pour {autre}.", "desert"],
  ["L'égalité a tenu jusque tard en troisième période : {m} l'a brisée pour {eq}, {s}.", "egalite3 V"],
  ["Égalité brisée dans les dernières minutes de la troisième : {m} marque pour {eq}.", "egalite3 V"],
  ["{m} a brisé l'égalité tard en troisième période pour {autre}, qui gagne {s}.", "egalite3 D"],
  ["Dans les dernières minutes de la troisième, {m} a brisé l'égalité du côté de {autre}.", "egalite3 D"],
  ["Le but gagnant est venu tard, dans les dix dernières minutes, de {m}.", "tardif"],
  ["Rien n'était réglé avant les dix dernières minutes, où {m} a marqué le but gagnant.", "tardif"],
  ["Le but gagnant, celui de {m}, est arrivé sur l'avantage numérique.", "gagnantAN"],
  ["{m} a profité d'une punition adverse pour inscrire le but gagnant.", "gagnantAN"],
  // Les gardiens.
  ["{g} a repoussé {n} tirs pour {eq}.", "g35"],
  ["{g} a bloqué {n} tirs ce soir.", "g35"],
  ["Devant le filet de {eq}, {g} a effectué {n} arrêts.", "g35"],
  ["{n} arrêts pour {g}, qui a vu passer beaucoup de rondelles.", "g35"],
  ["{g}, de {autre}, a bloqué {n} tirs.", "adv35"],
  ["{eq} a lancé, lancé, et {g} a bloqué : {n} arrêts.", "adv35"],
  ["Devant le filet de {autre}, {g} a effectué {n} arrêts.", "adv35"],
  ["{n} arrêts pour {g}, de l'autre côté de la patinoire.", "adv35"],
  ["{g} a accordé {n} buts, ce qui ne figurera pas à son dossier de vedette.", "gmauvais"],
  ["Le filet de {eq} a cédé {n} fois, et {g} était dedans.", "gmauvais"],
  ["{g} a alloué {n} buts à {autre}.", "gmauvais"],
  ["{g}, de {autre}, a accordé {n} buts à {eq}.", "advmauvais"],
  ["Le filet de {autre} a cédé {n} fois, et {g} était dedans.", "advmauvais"],
  ["{eq} a marqué {n} fois contre {g}.", "advmauvais"],
  // Les unités spéciales.
  ["{eq} a marqué en avantage numérique.", "anMoi"],
  ["Le jeu de puissance de {eq} a inscrit au moins un but.", "anMoi"],
  ["{autre} a marqué en avantage numérique contre {eq}.", "anAdv"],
  ["Le jeu de puissance de {autre} a inscrit au moins un but.", "anAdv"],
  ["{eq} a profité de {n} avantages numériques sans marquer.", "anRate"],
  ["Le jeu de puissance de {eq} a eu {n} occasions et zéro but.", "anRate"],
  ["{eq} a purgé {n} punitions sans accorder un seul but en désavantage.", "dnParfait"],
  ["Avec {n} punitions à purger, {eq} n'a pas cédé en désavantage numérique.", "dnParfait"],
  ["{eq} a marqué en infériorité numérique.", "dnBut"],
  ["{autre} a marqué en infériorité numérique contre {eq}.", "dnButAdv"],
  // Les punitions.
  ["{eq} a écopé de {n} punitions.", "punMoi"],
  ["L'arbitre a sifflé {eq} à {n} reprises.", "punMoi"],
  ["{autre} a écopé de {n} punitions.", "punAdv"],
  ["L'arbitre a sifflé {autre} à {n} reprises.", "punAdv"],
  ["Aucune punition n'a été décernée pendant le match.", "sansPun"],
  ["Le carnet de l'arbitre est resté vide : aucune punition des deux côtés.", "sansPun"],
  ["{eq} n'a écopé d'aucune punition.", "propre"],
  ["Aucun joueur de {eq} n'a pris le chemin du banc des punitions.", "propre"],
  // Les bagarres.
  ["Bagarres inscrites à la feuille de match pour la soirée : {n}.", "bag"],
  ["Le nombre de bagarres de la soirée, selon la feuille : {n}.", "bag"],
  ["Un joueur de {eq} a eu le dessus dans une bagarre.", "bagMoi"],
  ["Une bagarre s'est soldée en faveur de {eq}, de l'avis de la feuille.", "bagMoi"],
  ["Un joueur de {autre} a eu le dessus dans une bagarre contre {eq}.", "bagAdv"],
  ["Une bagarre s'est soldée en faveur de {autre}, de l'avis de la feuille.", "bagAdv"],
  ["Une bagarre a eu lieu, sans gagnant désigné.", "bagNul"],
  ["La bagarre de la soirée s'est terminée sans décision claire.", "bagNul"],
  // Les séquences.
  ["{eq} met fin à une séquence de {n} défaites.", "premiere V"],
  ["La séquence de {n} défaites de {eq} est terminée.", "premiere V"],
  ["{eq} remporte sa première victoire après {n} défaites.", "premiere V"],
  ["Cette victoire de {eq} est la dernière d'une séquence de {n} gains.", "derniere V"],
  ["{eq} termine ici une séquence de {n} victoires.", "derniere V"],
  // Les séries.
  ["Dans la série, {eq} et {autre} en sont maintenant à {ser}.", "serie"],
  ["La série est rendue à {ser} du point de vue de {eq}.", "serie"],
  ["{eq} mène la série {ser}.", "meneSerie"],
  ["{eq} est devant dans la série : {ser}.", "meneSerie"],
  ["{eq} tire de l'arrière dans la série, {ser}.", "tireDerriere"],
  ["La série penche du côté de {autre}, {ser} du point de vue de {eq}.", "tireDerriere"],
  ["La série est égale, {ser}.", "egaleSerie"],
  ["{eq} et {autre} sont à égalité dans la série, {ser}.", "egaleSerie"],
  ["{eq} gagne la série {ser}.", "passes"],
  ["{eq} termine la série {ser} : quatre victoires, ce qui est le nombre requis.", "passes"],
  ["{eq} perd la série {ser} et est éliminé.", "sortis"],
  ["La série se termine {ser} pour {eq}, qui est éliminé.", "sortis"],
  ["{eq} balaie {autre}, quatre matchs à zéro.", "balai"],
  ["{autre} balaie {eq}, quatre matchs à zéro.", "balaiSubi"],
  ["{eq} évite l'élimination et reste en vie, {ser}.", "sursis"],
  ["{eq} gagne ce match pour rester dans la série : {ser}.", "sursis"],
  ["Ce match marque le premier de la série entre {eq} et {autre}.", "m1"],
  ["Deuxième match de la série entre {eq} et {autre}.", "m2"],
  ["Troisième match de la série entre {eq} et {autre}.", "m3"],
  ["Quatrième match de la série entre {eq} et {autre}.", "m4"],
  ["Cinquième match de la série entre {eq} et {autre}.", "m5"],
  ["Sixième match de la série entre {eq} et {autre}.", "m6"],
  ["Septième et dernier match de la série entre {eq} et {autre}.", "m7"],
  // La saison.
  ["{eq} reste dans la course aux séries avec ce résultat.", "course V"],
  ["{eq} voit la course aux séries se compliquer avec ce résultat.", "course D"],
  ["{eq} est mathématiquement éliminé des séries et jouait ce match pour l'honneur.", "elimine"],
  ["{eq} occupe le premier rang au classement et jouait ce match en conséquence.", "premier"],
  ["Un joueur de {eq} a retrouvé son ancien club ce soir, et {eq} a gagné {s}.", "vengeance V !barrage"],
  ["Un joueur de {eq} a retrouvé son ancien club ce soir, et {autre} a gagné {s}.", "vengeance D !barrage"],
  ["Pour un joueur de {eq}, c'était un match contre son ancien club.", "vengeance"],
];

/* ---------- ANALYSE : ce que le plateau en conclut ---------- */
export const ANALYSE = [
  ["Un résultat de {s} ne se discute pas ; il se commente, ce que nous allons faire.", "!barrage"],
  ["Le plateau n'a pas de théorie du complot à offrir : le pointage est de {s}, et il est exact.", "!barrage"],
  // Gardiens.
  ["{g} a fait la différence : {n} arrêts, et personne n'a pu lui reprocher quoi que ce soit.", "g35 V"],
  ["{g} a tout donné avec {n} arrêts ; ça n'a pas suffi, et c'est regrettable.", "g35 D"],
  ["Sans {g}, le pointage aurait eu une tout autre allure. Nous n'osons pas y penser.", "g35"],
  ["{n} arrêts : un gardien qui travaille autant mérite au moins une bouteille d'eau.", "g35"],
  ["Le gardien {g} s'est occupé de tout ce qui se présentait. Les défenseurs, eux, ont regardé.", "g35"],
  ["À {n} arrêts, {g} a été le meilleur joueur de {eq} ce soir, selon une méthode qui n'a rien de scientifique.", "g35"],
  ["{g} a vu beaucoup de tirs. Dans les circonstances, il a réagi avec calme et efficacité.", "g35"],
  ["{eq} a lancé sans relâche, mais {g} a bloqué {n} tirs. La note est claire.", "adv35"],
  ["{g} a gagné son duel contre {eq}, qui lui a pourtant donné du travail.", "adv35"],
  ["Avec {n} arrêts, {g} a donné à {autre} des raisons de croire au match.", "adv35"],
  ["Il y a une leçon dans tout ça : un gardien hot, c'est un gardien hot. Nous n'ajouterons rien.", "adv35"],
  ["{g} n'a pas eu la soirée qu'il espérait, avec {n} buts accordés, et le plateau ne peut qu'en prendre acte.", "gmauvais"],
  ["Quand un gardien accorde {n} buts, il y a rarement un seul coupable. Il y en a plusieurs, et {g} est le plus visible.", "gmauvais"],
  ["{g} a eu une mauvaise soirée. Il en aura d'autres, de bonnes, nous le souhaitons.", "gmauvais"],
  ["Le plateau a peu de choses à dire sur {g} ce soir, et c'est mieux ainsi.", "gmauvais"],
  ["{eq} a su trouver la faille : {n} buts contre {g}. Ce n'est pas un hasard, ou alors c'est un hasard répété.", "advmauvais V"],
  ["{g} a eu une mauvaise soirée. {eq} en est l'une des causes, et c'est tout à son honneur.", "advmauvais"],
  ["Contre {g}, {eq} a su se montrer efficace. Nous parlons ici de {n} buts, ce qui est une façon d'être efficace.", "advmauvais"],
  // Remontées, avances, assurances.
  ["Une remontée de cette ampleur ne s'improvise pas : elle s'improvise, mais avec beaucoup de conviction.", "remontee"],
  ["Mené par au moins deux buts, {eq} a gardé son calme. Ce détail est rare et mérite un paragraphe.", "remontee"],
  ["Le plateau a longtemps cru que le match était réglé. Le plateau avait tort, et le dit sans gêne.", "remontee"],
  ["Une remontée, c'est un match en deux parties, et {eq} a bien choisi laquelle gagner.", "remontee"],
  ["Une avance de deux buts, au moins, est un atout. Elle devient un fardeau quand elle disparaît.", "gaspille"],
  ["{eq} a pris les devants avec tout ce qu'il fallait. Il a ensuite perdu une partie de ce qu'il fallait.", "gaspille"],
  ["Quand on mène par deux buts, il y a deux écoles : celle qui protège et celle qui continue. {eq} a fait un choix, et nous en connaissons le résultat.", "gaspille"],
  ["Le but d'assurance a joué son rôle, qui est de rassurer. Il a rassuré {eq}, et beaucoup de monde dans l'immeuble.", "assur"],
  ["Un but d'assurance, c'est le moment où le match cesse d'être une question pour devenir une formalité.", "assur"],
  ["{autre} a ajouté un but d'assurance, et le doute a quitté l'immeuble en même temps que les spectateurs pressés.", "assurAdv"],
  ["Ce but d'assurance a retiré à {eq} l'une de ses rares occasions de se mettre à espérer.", "assurAdv"],
  // Écarts.
  ["Quand l'écart est d'au moins quatre buts, il n'y a plus d'analyse ; il y a un constat.", "raclee"],
  ["Personne ne pourra dire que {eq} a gagné de justesse. Ce serait inexact.", "raclee"],
  ["Une victoire aussi nette invite à la prudence, ce qui n'est pas dans le tempérament du plateau, mais nous nous y efforçons.", "raclee"],
  ["{eq} n'a laissé aucune place au débat, et le plateau, privé de débat, a rempli le temps comme il l'a pu.", "raclee"],
  ["Un écart d'au moins quatre buts se décrit mal. Disons qu'il s'est présenté avec insistance.", "raclSubie"],
  ["Le plateau n'a pas de remède pour un tel écart. Il a une couverture, qu'il offre à {eq}.", "raclSubie"],
  ["Dans un match comme celui-là, la seule chose à faire est de passer au suivant. C'est exactement ce que fera {eq}.", "raclSubie"],
  ["On peut toujours chercher des causes à un écart pareil. On en trouve plusieurs, et elles sont toutes inconfortables.", "raclSubie"],
  ["Un seul but d'écart : le genre de match qui tourne sur un détail, et le détail est en général une rondelle.", "un !OT"],
  ["Un but d'écart, c'est trop peu pour parler de domination et trop pour parler de hasard.", "un !OT"],
  ["La victoire de {eq} s'est jouée sur un fil, et le fil a tenu.", "un !OT V"],
  ["La défaite de {eq} s'est jouée sur un fil, et le fil a cassé.", "un !OT D"],
  ["Un but de plus, un but de moins : voilà ce qui fait la différence entre un résumé joyeux et un résumé prudent.", "un !OT"],
  ["Un match de cette étroitesse se gagne sur un détail. Le détail s'appelle {m}.", "un !OT"],
  ["Le plateau reconnaît que {eq} aurait pu gagner. Le plateau reconnaît aussi qu'il n'a pas gagné.", "un !OT D"],
  ["Retirer le gardien pour un attaquant de plus est un pari, et {eq} l'a pris. Les paris, comme les matchs, ont une conclusion.", "desert"],
  ["Sortir le gardien est une décision courageuse qui, parfois, se termine comme une décision courageuse.", "desert"],
  ["Le filet désert est le dernier recours du hockey. {eq} y a eu recours, et la feuille en fait foi.", "desert"],
  ["{eq} a misé sur un attaquant de plus. Le plateau respecte le pari et déplore le résultat.", "desert"],
  // Fins de match.
  ["Une égalité brisée aussi tard est la forme la plus pure du hockey : tout est simple jusqu'à ce que ça ne le soit plus.", "egalite3"],
  ["{m} a choisi son moment. Il l'a choisi tard, comme tout le monde dans cette industrie.", "egalite3"],
  ["Tard en troisième, l'égalité est un état de grâce. {m} l'a rompu, et personne ne lui en tiendra rigueur, sauf {autre}.", "egalite3"],
  ["Quand on brise l'égalité tard dans la troisième période, on ne laisse plus beaucoup de temps aux commentaires du banc.", "egalite3"],
  ["Un but gagnant dans les dernières minutes laisse peu de temps pour répondre. Il laisse tout le temps pour en parler.", "tardif"],
  ["Un but tardif, ça change l'ambiance. Il ne change pas le pointage de façon rétroactive, mais il le déclare avec force.", "tardif"],
  ["Le but de {m} est venu tard, et c'est lui qui a mis le plateau d'accord.", "tardif"],
  ["Gagner sur l'avantage numérique, c'est gagner grâce à la générosité de l'adversaire. Nous ne le disons pas méchamment.", "gagnantAN"],
  ["Le but gagnant est venu d'une punition. C'est un cas d'école, que nous enseignerons en septembre.", "gagnantAN"],
  ["Il faut du talent pour marquer le but gagnant. Il faut aussi une punition adverse, et {eq} l'a su.", "gagnantAN V"],
  ["Une punition au mauvais moment : voilà ce qui a coûté ce but à {eq}.", "gagnantAN D"],
  // Prolongation et tirs de barrage.
  ["La prolongation est un exercice de tension où chaque mise au jeu est une question de santé publique.", "OT"],
  ["Le temps supplémentaire n'a duré que le temps d'un but, mais il a duré tout de même.", "OT"],
  ["Il y a deux façons de gagner une prolongation : la patience et {m}. Dans ce cas-ci, ce fut {m}.", "OT"],
  ["{eq} a su garder la tête froide en prolongation, ce qui est un exploit en soi, surtout en prolongation.", "OT V"],
  ["{eq} a perdu sa concentration pour la durée d'un but, et c'était l'unique but qui comptait.", "OT D"],
  ["Après soixante minutes sans décision, la prolongation a décidé en moins de temps qu'il n'en faut pour commenter.", "OT"],
  ["Les tirs de barrage n'ont pas de logique. Ils ont un vainqueur, ce qui est mieux que de la logique.", "barrage"],
  ["Les tirs de barrage sont un spectacle où le talent se retrouve seul avec sa conscience.", "barrage"],
  ["Un tir de barrage ne se prépare pas. Il se prépare, en réalité, mais personne ne s'en vante.", "barrage"],
  ["Le temps réglementaire n'a pas suffi, et le plateau en a conclu que ce match n'avait pas de plan B, sauf celui-ci.", "barrage"],
  // Unités spéciales.
  ["Le jeu de puissance de {eq} a été efficace ce soir. Les chiffres sont là, et ils sont très polis.", "anMoi"],
  ["Un but en avantage numérique, c'est la preuve qu'une punition adverse peut être une bonne nouvelle.", "anMoi"],
  ["{eq} a su tirer parti d'une punition adverse. C'est un art, et il se pratique en général avec une rondelle.", "anMoi"],
  ["{autre} a su tirer parti d'une punition de {eq}. Ce n'est pas un talent méprisable, mais il aurait pu rester inutilisé.", "anAdv"],
  ["Une punition de {eq}, un but de {autre} : la logique du hockey en trois mots.", "anAdv"],
  ["{eq} a eu des occasions en jeu de puissance, et n'a pas marqué. On parle ici de {n} avantages numériques sans conséquence.", "anRate"],
  ["{n} avantages numériques sans but, c'est une statistique qu'on cite surtout quand on cherche une explication.", "anRate"],
  ["Le jeu de puissance de {eq} a eu les occasions, mais il en a fait un usage discret.", "anRate"],
  ["Avec {n} punitions à purger, {eq} s'est défendu avec discipline. Le mot « discipline » est ici employé à contresens.", "dnParfait"],
  ["{eq} a su tenir le fort chaque fois qu'il a joué en infériorité numérique. {n} fois, pour être précis.", "dnParfait"],
  ["Le désavantage numérique de {eq} a connu une soirée parfaite, et il en parlera pendant des semaines dans les corridors.", "dnParfait"],
  ["Marquer en infériorité numérique est un geste d'une impolitesse élégante. {eq} s'est offert ce plaisir.", "dnBut"],
  ["Un but en infériorité, ça change la physionomie d'un match, et surtout l'humeur de l'entraîneur adverse.", "dnBut"],
  ["Accorder un but en infériorité numérique est une expérience que {eq} préfère ne pas répéter.", "dnButAdv"],
  ["{autre} a marqué à court d'un joueur, ce qui est plutôt le contraire de ce que le règlement prévoyait.", "dnButAdv"],
  // Punitions.
  ["{n} punitions, c'est beaucoup. Un joueur qui en prend autant est un joueur qui est occupé.", "punMoi"],
  ["Un match avec {n} punitions de {eq}, c'est un match où l'arbitre a eu un rôle de premier plan.", "punMoi"],
  ["Le banc des punitions de {eq} était bien fréquenté ce soir, avec {n} visites au dossier.", "punMoi"],
  ["{eq} a pris {n} punitions et l'a appris à ses dépens.", "punMoi"],
  ["{autre} a pris {n} punitions, et {eq} en a retiré une certaine satisfaction, que nous ne jugerons pas.", "punAdv"],
  ["Quand l'adversaire prend {n} punitions, l'avantage numérique devient un mode de vie.", "punAdv"],
  ["{autre} a pris {n} punitions, ce qui est un bon indicateur d'une soirée dans laquelle on n'a pas tout contrôlé.", "punAdv"],
  ["Un match sans punition est un match propre. Un match propre est un match où les arbitres ont eu le temps de lire.", "sansPun"],
  ["Aucune punition : le sifflet n'a servi qu'à arrêter le jeu, et c'est un progrès.", "sansPun"],
  ["La discipline de {eq} a été exemplaire. Le plateau a vérifié : aucune punition à son nom.", "propre"],
  ["{eq} n'a pris aucune punition. C'est sans doute le résultat d'un long travail, ou d'une soirée tranquille.", "propre"],
  // Bagarres.
  ["Une bagarre, c'est un bref échange d'opinions que les règlements encadrent en minutes de punition.", "bag"],
  ["Il y a eu bagarre. Le plateau y voit un signe que les deux équipes tenaient à leurs opinions.", "bag"],
  ["La bagarre a eu lieu, et le hockey a repris sa forme ordinaire quelques instants plus tard.", "bag"],
  ["Une bagarre dans le match ne change pas le pointage. Elle change le ton, ce qui est un autre genre de pointage.", "bag"],
  ["Un joueur de {eq} a gagné sa bagarre. Nous le disons sans commentaire, mais avec une certaine fierté contenue.", "bagMoi"],
  ["{eq} a eu le dessus dans une bagarre, ce qui n'est pas inscrit au pointage mais figure bien au vestiaire.", "bagMoi"],
  ["{autre} a eu le dessus dans une bagarre. La feuille de match le note avec neutralité, comme il se doit.", "bagAdv"],
  ["Un joueur de {eq} a perdu sa bagarre. Il a, dit-on, bien tenu ses gants.", "bagAdv"],
  ["La bagarre s'est terminée sans gagnant. C'est la forme la plus diplomatique de ce sport.", "bagNul"],
  ["Une bagarre sans gagnant ne laisse que des punitions. C'est un résultat très équitable.", "bagNul"],
  // Séquences.
  ["Après {n} défaites de suite, une victoire est une rareté qu'on ne peut que respecter.", "premiere V"],
  ["Mettre fin à une séquence de {n} défaites est le genre de geste que les équipes aiment faire discrètement.", "premiere V"],
  ["{eq} sort enfin de sa séquence de {n} défaites. Le plateau lui ouvre la porte, poliment.", "premiere V"],
  ["Une séquence de {n} victoires, c'est un sujet de conversation. Cette victoire en est la dernière au dossier.", "derniere V"],
  // Séries.
  ["Un premier match de série ne décide rien, mais il donne le ton, comme une première note.", "m1"],
  ["Après un premier match, une série n'a pas encore de personnalité. Elle a toutefois un pointage.", "m1"],
  ["Le deuxième match d'une série est celui qui commence à compter pour les statistiques.", "m2"],
  ["À deux matchs, une série devient une tendance, et une tendance devient une opinion de chroniqueur.", "m2"],
  ["Au troisième match, on commence à comprendre ce que l'adversaire a dans la tête.", "m3"],
  ["Le troisième match est celui où les équipes se mettent à se connaître, avec les inconvénients que cela comporte.", "m3"],
  ["Au quatrième match, une série cesse d'être une hypothèse. Elle devient une réalité, aussi petite soit-elle.", "m4"],
  ["Le quatrième match est celui qui sépare ceux qui espèrent de ceux qui calculent.", "m4"],
  ["Au cinquième match, la série n'a plus de secret. Elle a, par contre, beaucoup de tension.", "m5"],
  ["Au cinquième match, les entraîneurs commencent à parler en phrases très courtes.", "m5"],
  ["Au sixième match, une équipe peut terminer sa série. L'autre peut la prolonger. C'est le genre de moment qui fait vendre du café.", "m6"],
  ["Le sixième match est un match où chacun fait semblant de ne pas compter les victoires.", "m6"],
  ["Au septième match, il n'y a plus de stratégie. Il y a un pointage, et il est final.", "m7"],
  ["Un septième match est un événement où le hockey se débarrasse de tout ce qui n'est pas essentiel.", "m7"],
  ["{eq} mène la série. L'avance est mince, mais elle a l'avantage d'exister.", "meneSerie"],
  ["Mener une série, c'est avoir l'avantage et les nerfs qui vont avec.", "meneSerie"],
  ["{eq} tire de l'arrière. Dans une série, c'est une situation qui a l'avantage de n'être pas permanente.", "tireDerriere"],
  ["Tirer de l'arrière dans une série oblige à regarder devant. C'est généralement une bonne chose.", "tireDerriere"],
  ["La série est égale, et le plateau est donc dans une situation neutre. Il s'en accommode très bien.", "egaleSerie"],
  ["Une série égale est le meilleur argument en faveur du match suivant.", "egaleSerie"],
  ["{eq} remporte la série. Le plateau a hâte de voir la suite, ou plutôt de ne pas la voir trop tôt.", "passes"],
  ["Gagner une série est l'objectif de toute équipe de séries, et {eq} l'a atteint avec méthode.", "passes"],
  ["La saison de {eq} se termine ici. Elle aura eu le mérite d'exister, et de durer.", "sortis"],
  ["Être éliminé est un événement que le règlement a prévu, que l'humeur n'a jamais accepté.", "sortis"],
  ["Un balayage est une victoire dont la plus grande qualité est qu'elle laisse du temps libre à la suite.", "balai"],
  ["Balayer une série, c'est une façon de dire à l'adversaire qu'il peut rentrer chez lui dès maintenant.", "balai"],
  ["Se faire balayer est une expérience complète, au sens où aucun détail n'est omis.", "balaiSubi"],
  ["{eq} a survécu, et le plateau, qui ne sait pas voir sans conclure, y voit déjà un signe.", "sursis"],
  ["Un sursis, c'est une victoire dont on ne peut pas se vanter longtemps, mais qui permet de se préparer au prochain match.", "sursis"],
  // Saison.
  ["Dans la course aux séries, une victoire est un point, une défaite est un autre, et le plateau est tenu de les compter tous.", "course"],
  ["La course aux séries est un exercice où chaque match prend une importance qu'il ne méritait pas la veille.", "course"],
  ["Chaque point compte dans cette course. Les analystes du plateau comptent également, pour leur part, le café.", "course"],
  ["Éliminé, {eq} joue maintenant pour le principe. Le principe, en hockey, est un sujet de discussion très répandu.", "elimine"],
  ["Une équipe éliminée peut encore gagner un match. Elle n'y gagne rien, sauf le droit d'en parler.", "elimine"],
  ["{eq} joue sans pression, ce qui est un état que le sport professionnel connaît mal.", "elimine"],
  ["Être premier au classement, c'est être regardé. {eq} a été regardé, et il a répondu avec la rigueur qu'on lui connaît.", "premier"],
  ["Au premier rang, chaque match devient une démonstration. {eq} en a donné une, avec le pointage en pièce jointe.", "premier"],
  ["Le premier du classement est celui qu'on veut battre, et c'est ce qui rend la tâche intéressante.", "premier"],
  ["Affronter son ancien club est un exercice de contenance. {eq} l'a fait avec ce qu'il avait sous la main.", "vengeance"],
  ["Un ancien joueur contre son club d'origine, c'est un classique du hockey, au même titre que le café refroidi.", "vengeance"],
  ["Les retrouvailles avec un ancien club ont toujours une part de politesse et une part de mise en échec.", "vengeance"],
  // Pointage et issue, sans contexte rare.
  ["Le plateau n'a trouvé qu'une explication à cette victoire : {eq} a marqué plus de buts que {autre}.", "V"],
  ["Le plateau n'a trouvé qu'une explication à cette défaite : {autre} a marqué plus de buts que {eq}.", "D"],
  ["Gagner un match, c'est marquer plus que l'autre. {eq} a respecté cette règle avec beaucoup de rigueur.", "V"],
  ["Perdre un match, c'est marquer moins que l'autre. {eq} a respecté cette règle, à son corps défendant.", "D"],
  ["La victoire de {eq} est le fruit d'un travail d'équipe, ce qui est une manière élégante de ne désigner personne.", "V"],
  ["La défaite de {eq} est le fruit d'un travail d'équipe, ce qui est une manière élégante de ne désigner personne.", "D"],
  ["Une victoire n'est jamais un accident, sauf quand elle en est un. Celle de {eq} était, de l'avis du plateau, méritée.", "V"],
  ["Le plateau a longuement cherché la clé de ce match. Elle se trouve sur la feuille, à la ligne du pointage.", ""],
  ["Le moment charnière de ce match, c'est le but de {m} en {per}.", "V"],
  ["Le moment charnière de ce match, c'est le but de {m}, de {autre}, en {per}.", "D"],
  ["Les statistiques sont un guide, pas une vérité. Cela dit, le pointage de {s} est une vérité.", "!barrage"],
  ["Les chiffres ne mentent pas. Ils ne disent pas tout non plus, mais ils sont très fiables sur le pointage de {s}.", "!barrage"],
  ["L'analyse est sans appel : le match s'est terminé quand il s'est terminé, et pas avant.", ""],
  ["Les analystes se sont réunis une fois le match terminé, ce qui est une méthode qui a fait ses preuves.", ""],
  ["Aucun trait de génie n'est à signaler. Il y a du travail, de la rigueur, et une rondelle dans le filet adverse.", "V"],
  ["Rien dans ce match n'était écrit d'avance, sinon l'heure du début.", ""],
  ["Un résumé n'est pas une explication. C'est une façon d'organiser les faits pour qu'ils aient l'air d'en être une.", ""],
  ["Le plateau tient à rappeler qu'il n'a aucune influence sur les résultats, malgré les nombreux efforts de ses analystes.", ""],
  ["Il serait imprudent de tirer des conclusions d'un seul match. Nous en tirons quand même, comme tout le monde.", ""],
  ["Un seul match ne fait pas une saison. Il en fait une partie, cependant, et c'est la partie dont nous parlons.", "rs"],
  ["Chaque match de saison compte, dans un compte que personne ne tient en direct, mais que tout le monde consulte en avril.", "rs"],
  ["Dans une série, chaque match est un chapitre. Celui-ci en était un, et il est maintenant fermé.", "serie"],
  ["Une série est un livre, et ce match en est une page. Les pages précédentes sont consultables au vestiaire.", "serie"],
  ["Au hockey, les séries sont un sport à part : on y retrouve les mêmes joueurs, avec plus de sérieux et moins de sommeil.", "serie"],
];

/* ---------- CHUTE : la dernière phrase ---------- */
export const CHUTE = [
  // Toujours vraies.
  ["Ce fut le résumé. Il n'engage que ceux qui l'ont écouté.", ""],
  ["Voilà pour le résumé. Le hockey, lui, reprendra comme prévu.", ""],
  ["C'est tout pour ce soir. Les statistiques seront conservées, au cas où.", ""],
  ["Nous vous remercions de votre attention et de votre indulgence.", ""],
  ["C'est ce qui s'est passé. Nous n'avons rien inventé, ce qui est rare dans notre métier.", ""],
  ["Tel est le bilan. Bonne nuit, et surtout, bon sommeil.", ""],
  ["Voilà qui conclut ce bulletin. Le plateau rend l'antenne, et les chaises restent en place.", ""],
  ["Nous reviendrons au prochain match, sauf imprévu majeur.", ""],
  ["Ce fut la soirée. Merci d'avoir été là, ou d'avoir fait semblant.", ""],
  ["Le dossier est clos. Il pourra toutefois être rouvert au prochain match.", ""],
  ["Ainsi se termine le résumé. Le café, lui, est froid depuis un moment.", ""],
  ["Rien de plus à ajouter, sinon que le hockey est un sport, et que ce soir, c'en était un.", ""],
  ["C'est ce que nous retenons. Le reste appartient aux souvenirs et aux archives.", ""],
  ["Le plateau lève la séance. Nous serons de retour avec de nouveaux faits.", ""],
  ["Bref, il y a eu un match. Nous l'avons vu. Nous l'avons résumé. Nous l'avons trouvé sérieux.", ""],
  ["Voilà. La rondelle est maintenant dans les archives, et c'est là qu'elle sera le mieux.", ""],
  ["Notre conclusion est simple, et personne ne pourra nous la reprocher : il y a eu un match.", ""],
  ["Merci à notre régie, qui n'a rien dit de toute la soirée et qui continuera.", ""],
  ["C'est ainsi que se termine le bulletin. Aucune question ne sera acceptée, sauf celles qui ont déjà des réponses.", ""],
  ["Bonne fin de soirée à tous. Le hockey n'attend personne, surtout pas le prochain match.", ""],
  ["Voilà le bilan. Il est exact, ce qui est son principal mérite.", ""],
  ["Le plateau vous souhaite une bonne soirée, sans aucune garantie sur la suite du calendrier.", ""],
  ["Fin du bulletin. Les analystes retournent à leurs tableaux.", ""],
  ["Le hockey reprend bientôt, et le plateau aussi.", ""],
  // Victoire et défaite.
  ["{eq} a gagné, et le plateau en conclut que c'était le but.", "V"],
  ["Une victoire est une victoire. Nous avons consulté plusieurs sources, qui s'accordent toutes sur ce point.", "V"],
  ["Le vestiaire de {eq} sera de bonne humeur. Nous n'y étions pas, mais nous le croyons volontiers.", "V"],
  ["{eq} rentre avec deux points dans le sac et le sentiment du devoir accompli.", "V rs"],
  ["Une soirée tranquille pour {eq}, et une victoire dans la poche. C'est un bon format.", "V"],
  ["Dans le vestiaire de {eq}, on dit que le travail a payé. Le plateau n'a pas vérifié, mais il n'a aucune raison d'en douter.", "V"],
  ["{eq} a gagné. On s'en souviendra jusqu'au prochain match.", "V"],
  ["Pour {eq}, une victoire de plus à inscrire au tableau. Le tableau, lui, n'a fait aucun commentaire.", "V"],
  ["{eq} a perdu. Le plateau n'ose pas dire que c'est le pire résultat possible, car il y en a de pires.", "D"],
  ["Une défaite n'est qu'une victoire qui a manqué de précision.", "D"],
  ["Dans le vestiaire de {eq}, on parle de « points à corriger ». Il y en a, effectivement, au moins un : le pointage.", "D"],
  ["{eq} rentre bredouille. Le trajet, selon nos sources, sera silencieux.", "D"],
  ["{eq} reviendra, et nous serons là pour le dire, ce qui est une forme de soutien.", "D"],
  ["Le plateau offre à {eq} ses condoléances, sous forme de statistiques.", "D"],
  ["Une défaite, ça se digère. Il suffit d'un bon repas et de beaucoup de temps.", "D"],
  ["Le prochain match offrira une occasion de corriger le tir. Pour l'instant, la rondelle est ailleurs.", "D"],
  // Les grands scénarios.
  ["Un blanchissage. Dans la langue du hockey, c'est un compliment ; dans la langue des attaquants adverses, c'est un souvenir.", "BL"],
  ["{eq} n'a rien accordé. Le plateau n'a rien à ajouter non plus.", "BL"],
  ["Zéro but pour {autre}. Le chiffre est modeste, mais il pèse.", "BL"],
  ["Pas de but pour {eq}. Le plateau ne s'attarde pas, par égard pour les attaquants.", "BLsubi"],
  ["Un zéro au tableau, c'est une expérience que même les meilleurs ont connue. Nous le disons pour consoler.", "BLsubi"],
  ["La victoire de {eq} est nette, et le plateau n'y trouve rien à redire, malgré ses efforts.", "raclee"],
  ["Après une telle soirée, {eq} est autorisé à sourire largement. Le plateau y consent.", "raclee"],
  ["Certains soirs, le hockey est simple. Ce soir, il l'était, et {eq} s'en est bien tiré.", "raclee"],
  ["Certains soirs, le hockey est simple. Ce soir, il l'était, mais pas pour {eq}.", "raclSubie"],
  ["Après une telle soirée, le plateau suggère à {eq} de dormir. C'est le seul conseil, et il est sincère.", "raclSubie"],
  ["Le plateau n'a pas d'autre commentaire sur cet écart, sinon qu'il était grand.", "raclSubie"],
  ["Une remontée comme celle-là se raconte longtemps, avec des détails de plus chaque fois.", "remontee"],
  ["{eq} a remonté la pente, ce qui est une expression de montagne appliquée à un sport de glace.", "remontee"],
  ["Mené par deux buts, au moins, et vainqueur au bout du compte : les chroniqueurs auront du travail.", "remontee"],
  ["Avoir deux buts d'avance, au moins, et perdre quand même : le plateau a vu pire, mais il ne s'en souvient plus.", "gaspille"],
  ["Une avance ne vaut que ce qu'on en fait. {eq} en a fait ce que nous venons de dire.", "gaspille"],
  ["Le plateau offre à {eq} un conseil gratuit : quand on mène par deux buts, il faut continuer à jouer. C'est tout.", "gaspille"],
  ["Un but d'assurance de {eq}, et la soirée s'est terminée sans autre suspense.", "assur"],
  ["{eq} s'est assuré de ne rien laisser au hasard dans les dernières minutes, ce qui est un luxe.", "assur"],
  ["Un but d'assurance de {autre} a mis fin à la soirée pour {eq}, un peu plus tôt que prévu.", "assurAdv"],
  ["La victoire s'est jouée sur un but, et le plateau tient à lui rendre hommage : un but, c'est parfois tout ce qu'il faut.", "un !OT V"],
  ["Une défaite par un but, c'est la défaite des gens qui ont essayé. Nous y voyons un certain mérite.", "un !OT D"],
  ["Un but de moins, et nous aurions parlé d'autre chose. Un but de plus, et nous aurions parlé de la même chose, plus longtemps.", "un !OT"],
  ["Le gardien en moins, {eq} a joué son va-tout. Le plateau n'a pas de critique : il a de l'admiration, un peu décontenancée.", "desert"],
  ["Sortir son gardien est un pari. Le plateau ne juge pas : il mesure.", "desert"],
  ["Un filet désert, un but de retard, et un résultat qui n'a surpris personne, surtout pas le filet.", "desert"],
  ["Tard en troisième, {m} a brisé l'égalité. Nous ne dirons rien de plus, de peur d'allonger inutilement la soirée.", "egalite3"],
  ["Une égalité qui dure jusqu'à la fin de la troisième est une égalité qui mérite le respect. Celle-ci a tenu.", "egalite3"],
  ["Le but de {m} a mis fin à une longue égalité. Les égalités, comme les bonnes choses, ont une fin.", "egalite3"],
  ["Le but gagnant est venu tard. Le plateau, qui aime l'ordre, l'aurait préféré tôt, mais s'en accommode.", "tardif"],
  ["Gagner tard est une qualité. {m} la possède, et le plateau le note dans un petit carnet.", "tardif"],
  ["Le but gagnant est arrivé sur une punition adverse. Le hockey, c'est aussi savoir attendre son avantage.", "gagnantAN"],
  // Prolongation et barrage.
  ["Une prolongation, c'est du temps gagné. Pour quelqu'un, évidemment.", "OT"],
  ["Soixante minutes n'ont pas suffi. Nous ne ferons pas de commentaire sur la durée du bulletin.", "OT"],
  ["Une prolongation termine bien un match, ou mal, selon le côté du banc où l'on se trouve.", "OT"],
  ["{eq} a gagné en prolongation. C'est un genre de victoire qui se savoure lentement, comme un thé.", "OT V"],
  ["{eq} perd en prolongation, avec en poche un point que le plateau qualifie de consolation arithmétique.", "OT D rs"],
  ["{eq} perd en prolongation. La nuit sera longue, et la prolongation aussi, dans les souvenirs.", "OT D"],
  ["Les tirs de barrage ont tranché, ce qui est exactement leur fonction, et ils s'en sont bien acquittés.", "barrage"],
  ["Il a fallu en arriver aux tirs de barrage. Le plateau remercie les spectateurs d'avoir tenu leur place.", "barrage"],
  ["Un match qui se termine aux tirs de barrage est un match qui a pris un chemin de traverse.", "barrage"],
  // Gardiens.
  ["{g} mérite une soirée de repos. Il en aura peut-être une, si le calendrier est généreux.", "g35"],
  ["À {n} arrêts, {g} a mérité qu'on lui tape sur les jambières, et c'est exactement ce que fera le plateau.", "g35"],
  ["Si on devait choisir un joueur du match, ce serait {g}. Nous n'avons pas de vote, mais nous avons des opinions.", "g35 V"],
  ["Le gardien a tout donné. Le reste de l'équipe, apparemment, a fait ce qu'il a pu.", "g35 D"],
  ["{g} a tenu, et c'est précisément ce qu'on attend de lui. {n} arrêts, ça se remarque.", "g35"],
  ["{g} a été solide. Le plateau lui tire son chapeau, dans la limite de ses moyens.", "adv35"],
  ["{g} a bloqué {n} tirs de {eq}. Le mur a gagné.", "adv35 D"],
  ["{eq} a lancé beaucoup, et {g} a bloqué beaucoup. C'est la loi des grands nombres, appliquée au hockey.", "adv35"],
  ["{g} a eu un soir de ceux qu'on préfère oublier. Il y a des soirs comme ça, et nous lui souhaitons de ne pas en avoir un autre trop vite.", "gmauvais"],
  ["Le plateau offre à {g} une pensée sincère et une soirée tranquille, dès qu'il y en aura une.", "gmauvais"],
  ["{g} était dans le filet. Il y est resté, ce qui est déjà un mérite.", "gmauvais"],
  ["{g} n'a pas connu une soirée mémorable, et le plateau se promet d'en parler le moins possible.", "advmauvais"],
  ["{eq} a su exploiter {g}, et le plateau salue cet effort de précision.", "advmauvais V"],
  // Unités spéciales, punitions.
  ["Le jeu de puissance a parlé. Les arbitres, eux, ont bien fait leur travail, ce qui est rarement remarqué.", "anMoi"],
  ["{eq} a profité de l'avantage numérique. C'est à ça qu'il sert, ont dit nos experts.", "anMoi"],
  ["{autre} a profité de l'avantage numérique. Il en avait le droit, et il l'a utilisé.", "anAdv"],
  ["Un avantage numérique inutilisé est un souvenir. {eq} en a plusieurs à raconter.", "anRate"],
  ["Une soirée d'avantages numériques qui n'ont mené à rien. Le plateau n'ajoute rien, par respect.", "anRate"],
  ["Tenir le fort en désavantage numérique, c'est exactement ce que {eq} a fait, avec la ténacité d'un locataire.", "dnParfait"],
  ["Un but en infériorité est une impolitesse élégante. Nous la saluons.", "dnBut"],
  ["Un but en infériorité numérique contre {eq} est un cadeau dont personne ne voulait.", "dnButAdv"],
  ["L'arbitre a eu beaucoup à dire à {eq}. {eq} a écouté, et recommencé.", "punMoi"],
  ["L'arbitre a eu beaucoup à dire à {autre}, et {eq} en a tiré ses conclusions, que nous ne commenterons pas.", "punAdv"],
  ["Une soirée sans punition est une soirée où chacun a respecté les consignes. Nous ne voulons pas jeter un froid, mais c'est exceptionnel.", "sansPun"],
  ["{eq} a joué proprement. Le plateau, qui avait des gants blancs, n'a pas eu à s'en servir.", "propre"],
  // Bagarres.
  ["Les gants sont tombés, puis ramassés. Le plateau y voit une forme de savoir-vivre.", "bag"],
  ["Une bagarre est une conversation animée. Celle-ci a été brève, et sans suite.", "bag"],
  ["Après la bagarre, le hockey a repris. C'est ce qui s'appelle la résilience.", "bag"],
  ["Un joueur de {eq} a remporté sa bagarre. Aucune médaille n'est prévue, mais le vestiaire en parlera.", "bagMoi"],
  ["Un joueur de {eq} a perdu sa bagarre. Aucune médaille n'est prévue non plus, et c'est dommage.", "bagAdv"],
  ["Une bagarre sans gagnant est une bagarre diplomatique. Le plateau en recommande davantage.", "bagNul"],
  // Séquences.
  ["La séquence est terminée. Le plateau tient à saluer ceux qui l'avaient pressentie, s'il y en a.", "premiere V"],
  ["{eq} a retrouvé le chemin de la victoire, sans passer par les raccourcis habituels.", "premiere V"],
  ["{eq} a remporté sa première victoire après {n} défaites. Nous n'avons pas d'adjectif à la hauteur.", "premiere V"],
  ["La séquence de {eq} se termine ici. Ce n'est pas la fin du monde, mais c'est la fin de la séquence.", "derniere V"],
  ["Une séquence de {n} victoires se termine. Le plateau lui rend un hommage sincère.", "derniere V"],
  // Séries.
  ["Un premier match, un premier pointage. La suite appartient aux prochains jours.", "m1"],
  ["Deux matchs, une tendance. Le plateau suit ça avec attention, et un café.", "m2"],
  ["Trois matchs, une série qui prend forme. Il reste du temps, mais pas autant qu'au début.", "m3"],
  ["Quatre matchs : la série est maintenant un sujet sérieux, et le plateau le traite comme tel.", "m4"],
  ["Cinq matchs. À partir d'ici, chaque victoire se compte à voix basse.", "m5"],
  ["Six matchs. Il reste un match, peut-être. Nous ne le disons pas trop fort.", "m6"],
  ["Sept matchs. Le règlement n'en prévoit pas un huitième, et le plateau s'en félicite.", "m7"],
  ["{eq} remporte la série. Le plateau en prend acte, car il n'a pas le choix.", "passes"],
  ["La saison de {eq} se termine ici. Le plateau garde le silence, ce qui est son plus grand compliment.", "sortis"],
  ["Un balayage. Le plateau n'en demandait pas tant, et il en a eu quatre.", "balai"],
  ["{eq} sort de la série par la porte arrière, et le plateau n'ose pas dire que c'est la porte des balais.", "balaiSubi"],
  ["Un sursis, c'est un match de plus, et c'est tout ce qui compte pour {eq}.", "sursis"],
  ["La série continue, et le plateau aussi, avec une certaine fierté d'être indispensable.", "serie"],
  ["La série est égale, et le plateau se promet de ne rien en conclure avant le prochain match.", "egaleSerie"],
  ["{eq} mène la série. Le plateau a hâte de voir si cela durera, et il compte bien être là pour en parler.", "meneSerie"],
  ["{eq} tire de l'arrière, mais les séries sont longues, et il y a des remontées dans l'histoire de ce sport.", "tireDerriere"],
  // Saison.
  ["La course aux séries continue. Le plateau, qui a une carrière de comptable, s'en réjouit.", "course"],
  ["Chaque point compte dans la course aux séries. Le plateau vérifie ses calculs, par prudence.", "course"],
  ["{eq} est éliminé, mais il a gagné quelque chose : la sérénité, et un peu de temps libre.", "elimine V"],
  ["{eq} est éliminé. Le plateau tient tout de même à saluer son sens du devoir.", "elimine"],
  ["{eq} est premier au classement. Le plateau n'a rien à ajouter, par respect pour le poids du titre.", "premier"],
  ["Au premier rang, chaque match est un test. {eq} l'a passé ou l'a raté, selon le pointage : voir plus haut.", "premier"],
  ["Les retrouvailles d'un joueur avec son ancien club ont eu lieu. Le plateau note l'absence de tout incident diplomatique.", "vengeance"],
  ["Il y avait une histoire personnelle dans ce match, et elle est maintenant rangée aux archives.", "vengeance"],
];

/* ---------- la situation : tout ce que la feuille permet d'affirmer ---------- */
const N_TAGS = ['g35', 'adv35', 'gmauvais', 'advmauvais', 'punMoi', 'punAdv', 'anRate', 'dnParfait', 'bag', 'premiere', 'derniere'];
const COMMUNES = new Set(['V', 'D', 'rs', 'serie', '!OT', '!barrage']);
const PERIODE = { 1: '1re période', 2: '2e période', 3: '3e période' };
const NUM_SERIE = [null, 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];

const compte = (liste, f) => liste.reduce((n, x) => n + (f(x) ? 1 : 0), 0);
const periodeDe = instant => (instant >= 60 ? 4 : Math.min(3, Math.floor(instant / 20) + 1));

/**
 * Ce que la feuille permet d'affirmer, du point de vue de `ctx.cote` ('A' par
 * défaut). `ctx` : { eq, autre, cote, serie, saison, sequence, vengeance,
 * filetDesert, fusillade } — tout ce que la feuille ne sait pas, l'appelant le
 * dit ou le tait, et une étiquette que le contexte ne soutient pas reste fausse.
 * Retourne null si le match n'a pas de vainqueur lisible.
 */
export function situationDe(f, ctx = {}) {
  const nous = ctx.cote === 'B' ? 'B' : 'A';
  const eux = nous === 'A' ? 'B' : 'A';
  const buts = (f.buts || []).slice().sort((x, y) => x.instant - y.instant);
  const gf = { A: f.gfA ?? compte(buts, b => b.cote === 'A'), B: f.gfB ?? compte(buts, b => b.cote === 'B') };
  const fus = f.fusillade || ctx.fusillade || null;
  let vainqueur = gf.A > gf.B ? 'A' : gf.B > gf.A ? 'B' : null;
  const barrage = !vainqueur && !!fus && fus.A !== fus.B;
  if (barrage) vainqueur = fus.A > fus.B ? 'A' : 'B';
  if (!vainqueur) return null;
  const perdant = vainqueur === 'A' ? 'B' : 'A';
  const V = vainqueur === nous;
  const ot = !barrage && (f.ot === true || f.prolongation === true);
  const ecart = Math.abs(gf.A - gf.B);
  const tags = new Set([V ? 'V' : 'D']);
  const vals = { eq: ctx.eq || 'le club', autre: ctx.autre || "l'adversaire", n: {} };
  const ajoute = t => tags.add(t);

  vals.s = `${Math.max(gf.A, gf.B)}-${Math.min(gf.A, gf.B)}`;
  if (ot) ajoute('OT');
  if (barrage) ajoute('barrage');
  if (gf[eux] === 0 && V) ajoute('BL');
  if (gf[nous] === 0 && !V) ajoute('BLsubi');
  if (ecart === 1 && !barrage) ajoute('un');
  if (ecart >= 4 && !barrage) ajoute(V ? 'raclee' : 'raclSubie');
  if (ctx.filetDesert && !V && ecart === 1 && !ot && !barrage) ajoute('desert');

  // Le fil du match : les écarts par où le pointage est passé, le but gagnant.
  let a = 0, b = 0, creuxMax = 0, avanceMax = 0, gagnant = null, avantGagnant = null, nV = 0;
  for (const but of buts) {
    const avant = { A: a, B: b };
    if (but.cote === 'A') a++; else b++;
    const pourNous = nous === 'A' ? a : b, pourEux = nous === 'A' ? b : a;
    creuxMax = Math.max(creuxMax, pourEux - pourNous);
    avanceMax = Math.max(avanceMax, pourNous - pourEux);
    if (!barrage && but.cote === vainqueur && ++nV === gf[perdant] + 1) { gagnant = but; avantGagnant = avant; }
  }
  if (!barrage && V && creuxMax >= 2) ajoute('remontee');
  if (!barrage && !V && avanceMax >= 2) ajoute('gaspille');

  const dernier = buts[buts.length - 1];
  if (!barrage && dernier && dernier.cote === vainqueur && dernier.instant >= 50 && dernier.instant < 60 && ecart >= 2) ajoute(V ? 'assur' : 'assurAdv');
  if (gagnant) {
    const marqueur = gagnant.marqueur && gagnant.marqueur.n ? nomCourt(gagnant.marqueur.n) : null;
    if (marqueur) vals.m = marqueur;
    vals.per = gagnant.instant >= 60 ? 'prolongation' : PERIODE[periodeDe(gagnant.instant)];
    if (!ot && ecart === 1 && gagnant.instant >= 55 && gagnant.instant < 60 && avantGagnant && avantGagnant.A === avantGagnant.B) ajoute('egalite3');
    if (!ot && gagnant.instant >= 50 && gagnant.instant < 60) ajoute('tardif');
    if (gagnant.an) ajoute('gagnantAN');
  }

  // Les gardiens : les tirs reçus, moins les buts, donnent les arrêts (la règle de ceQuiADecide).
  const tirsDe = c => (f.tirs && f.tirs[c] ? f.tirs[c].reduce((x, y) => x + y, 0) : 0);
  const gard = { A: f.gardienA, B: f.gardienB };
  for (const [c, moi] of [[nous, true], [eux, false]]) {
    const g = gard[c];
    if (!g || !g.n) continue;
    const recus = tirsDe(c === 'A' ? 'B' : 'A'), alloues = compte(buts, x => x.cote !== c), arrets = recus - alloues;
    if (recus < 1) continue;
    if (arrets >= 35) { ajoute(moi ? 'g35' : 'adv35'); vals.n[moi ? 'g35' : 'adv35'] = arrets; }
    if (alloues >= 4 && arrets / recus < 0.88) { ajoute(moi ? 'gmauvais' : 'advmauvais'); vals.n[moi ? 'gmauvais' : 'advmauvais'] = alloues; }
    vals[moi ? 'gNous' : 'gEux'] = nomCourt(g.n);
  }

  // Les unités spéciales et les punitions.
  const punitions = f.punitions || [];
  const punNous = compte(punitions, p => p.cote === nous), punEux = compte(punitions, p => p.cote === eux);
  const anNous = compte(buts, x => x.cote === nous && x.an), anEux = compte(buts, x => x.cote === eux && x.an);
  if (anNous >= 1) ajoute('anMoi');
  if (anEux >= 1) ajoute('anAdv');
  if (punEux >= 3 && anNous === 0) { ajoute('anRate'); vals.n.anRate = punEux; }
  if (punNous >= 3 && anEux === 0) { ajoute('dnParfait'); vals.n.dnParfait = punNous; }
  if (compte(buts, x => x.cote === nous && x.dn) >= 1) ajoute('dnBut');
  if (compte(buts, x => x.cote === eux && x.dn) >= 1) ajoute('dnButAdv');
  if (punNous >= 4) { ajoute('punMoi'); vals.n.punMoi = punNous; }
  if (punEux >= 4) { ajoute('punAdv'); vals.n.punAdv = punEux; }
  if (punNous === 0 && punEux === 0) ajoute('sansPun');
  if (punNous === 0 && punEux > 0) ajoute('propre');

  // Les bagarres.
  const bagarres = (f.physique || []).filter(e => e.type === 'bagarre');
  if (bagarres.length) {
    ajoute('bag'); vals.n.bag = bagarres.length;
    if (bagarres.some(e => e.gagnant === nous)) ajoute('bagMoi');
    if (bagarres.some(e => e.gagnant === eux)) ajoute('bagAdv');
    if (bagarres.every(e => !e.gagnant)) ajoute('bagNul');
  }

  // Les séquences, la série, la saison : ce que le contexte affirme.
  const seq = ctx.sequence;
  if (seq && V && seq.n >= 2 && (seq.genre === 'premiere' || seq.genre === 'derniere')) { ajoute(seq.genre); vals.n[seq.genre] = seq.n; }
  const ser = /^(\d+)-(\d+)$/.exec(f.serie || '');
  const numero = (ctx.serie && ctx.serie.numero) || (ser ? f.numero : null);
  if (ser || ctx.serie) ajoute('serie'); else ajoute('rs');
  if (numero >= 1 && numero <= 7) ajoute(NUM_SERIE[numero]);
  if (ser) {
    const wA = Number(ser[1]), wB = Number(ser[2]);
    const n = nous === 'A' ? wA : wB, e = nous === 'A' ? wB : wA;
    vals.ser = `${n}-${e}`;
    if (n === 4) ajoute('passes');
    if (e === 4) ajoute('sortis');
    if (n === 4 && e === 0) ajoute('balai');
    if (e === 4 && n === 0) ajoute('balaiSubi');
    if (V && e === 3 && n < 4) ajoute('sursis');
    if (n === e) ajoute('egaleSerie');
    else if (n > e && n < 4) ajoute('meneSerie');
    else if (e > n && e < 4) ajoute('tireDerriere');
  }
  if (!tags.has('serie') && ctx.saison && ['course', 'elimine', 'premier'].includes(ctx.saison)) ajoute(ctx.saison);
  if (ctx.vengeance) ajoute('vengeance');
  return { tags, vals };
}

/* ---------- l'assemblage ---------- */

/** Une pièce, rendue pour cette situation ; null si une étiquette est fausse ou un gabarit sans valeur. */
export function pieceTexte(piece, sit) {
  const [texte, etiquettes] = piece;
  const liste = etiquettes ? etiquettes.split(' ') : [];
  for (const t of liste) {
    const nie = t[0] === '!';
    if (sit.tags.has(nie ? t.slice(1) : t) === nie) return null;
  }
  let echec = false;
  const rendu = texte.replace(/\{(\w+)\}/g, (_, cle) => {
    let v;
    if (cle === 'n') { const t = N_TAGS.find(x => liste.includes(x)); v = t ? sit.vals.n[t] : null; }
    else if (cle === 'g') { v = liste.some(x => x === 'g35' || x === 'gmauvais') ? sit.vals.gNous : liste.some(x => x === 'adv35' || x === 'advmauvais') ? sit.vals.gEux : null; }
    else v = sit.vals[cle];
    if (v == null) { echec = true; return ''; }
    return String(v);
  });
  return echec ? null : cap(rendu);
}

/** Le poids d'une pièce : une situation rare qui est vraie pèse plus qu'une phrase toujours vraie. */
const poidsDe = piece => 1 + 6 * Math.min(2, (piece[1] ? piece[1].split(' ') : []).filter(t => !COMMUNES.has(t)).length);

function piger(banque, sit, seed, nom, dejaDit, ecarte) {
  const eligibles = [];
  for (const piece of banque) {
    const texte = pieceTexte(piece, sit);
    if (!texte || dejaDit.has(texte) || (ecarte && ecarte(piece))) continue;
    eligibles.push({ piece, texte, poids: poidsDe(piece) });
  }
  if (!eligibles.length) return null;
  const total = eligibles.reduce((s, x) => s + x.poids, 0);
  let r = graine(`${seed}|${nom}`) * total;
  for (const x of eligibles) { r -= x.poids; if (r < 0) { dejaDit.add(x.texte); return x; } }
  const x = eligibles[eligibles.length - 1];
  dejaDit.add(x.texte);
  return x;
}

/** La première étiquette rare d'une pièce : son thème, pour ne pas dire deux fois la même chose. */
const themeDe = piece => (piece[1] ? piece[1].split(' ') : []).find(t => !COMMUNES.has(t)) || '';

/**
 * Le plateau d'après-match : { titre, lignes[] }. Pure : même feuille, même
 * contexte, même graine = même texte. `ctx` : voir `situationDe`.
 */
export function apresMatch(feuille, ctx = {}, graineDuMatch = '') {
  const sit = situationDe(feuille, ctx);
  const eq = ctx.eq || 'le club', autre = ctx.autre || "l'adversaire";
  const nous = ctx.cote === 'B' ? 'B' : 'A';
  const gfNous = feuille.gfA !== undefined ? (nous === 'A' ? feuille.gfA : feuille.gfB) : (feuille.buts || []).filter(x => x.cote === nous).length;
  const gfEux = feuille.gfA !== undefined ? (nous === 'A' ? feuille.gfB : feuille.gfA) : (feuille.buts || []).filter(x => x.cote !== nous).length;
  const titre = `${eq} ${gfNous}, ${autre} ${gfEux}`
    + (sit && sit.tags.has('barrage') ? ' (tirs de barrage)' : sit && sit.tags.has('OT') ? ' (prolongation)' : '');
  if (!sit) return { titre, lignes: [] };

  const seed = `${graineDuMatch}|${nous}|${eq}|${autre}|${feuille.gfA}-${feuille.gfB}|${(feuille.buts || []).length}`;
  const dejaDit = new Set();
  const lignes = [];
  const ouv = piger(OUVERTURE, sit, seed, 'ouverture', dejaDit);
  if (ouv) lignes.push(ouv.texte);
  const con = piger(CONSTAT, sit, seed, 'constat', dejaDit);
  if (con) lignes.push(con.texte);
  const an1 = piger(ANALYSE, sit, seed, 'analyse1', dejaDit);
  if (an1) lignes.push(an1.texte);
  const th = an1 ? themeDe(an1.piece) : '';
  const an2 = piger(ANALYSE, sit, seed, 'analyse2', dejaDit, p => themeDe(p) === th);
  if (an2) lignes.push(an2.texte);
  const chu = piger(CHUTE, sit, seed, 'chute', dejaDit);
  if (chu) lignes.push(chu.texte);
  return { titre, lignes };
}
