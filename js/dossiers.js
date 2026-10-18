/*
 * LES DOSSIERS DE LA SEMAINE (V10, tranche 5 — docs/refonte-v10.md § 4). Les événements quittent la banque : ce
 * ne sont plus des cartes qu'on tire, ce sont des choix d'À faire, dits par une voix (les scènes du Jalon M,
 * js/scenes.js). Au bureau du lundi, la semaine où le nœud ne s'ouvre pas (js/noeuds.js), un dossier s'ouvre s'il
 * est VRAI : trois soirs sur la route, l'infirmerie qui déborde, un rival dans la semaine, la caisse à sec.
 *
 * Chaque dossier :
 *   de       la voix qui la demande (`EXPEDITEURS`, js/vie-gm.js)
 *   quand    ce qu'elle lit dans les faits du lundi (`faits`, posés par js/saison.js sur ce qui est déjà joué et la
 *            cédule déjà connue — rien d'avance) ; vrai, il peut s'ouvrir
 *   fait     la ligne de chiffres sous la citation, en vrais chiffres
 *   mots     les répliques de la voix : une opinion, aucun chiffre (check_clarte § 5)
 *   options  deux ou trois réponses, sur les canaux qui existent — un effet (souvent d'un moment, `si`, js/sim.js
 *            `MOMENTS_SI`, qui ne joue que ses soirs), des gestes (`action`), des jetons (`gain`, un prix s'il est
 *            négatif), ou rien
 * Elles passent par la même porte que les dilemmes (`familleDeMoment`, `effetDeMoment`, `appliquerGestes`) : aucune
 * mécanique neuve. `check_places` mesure chaque réponse en paires, sous la borne d'une commune (1 V).
 *
 *   faits : { n, jambes, pire: { n, j }, blesses: [{ n, m }], soirs, dos, visiteur, domicile, rival, bete,
 *             caisse, dernier: { pour, contre, adv }, rang, equipes }
 */
import { hache } from './util.js';

export const DOSSIERS = {
  laRoute: {
    de: 'ph', ico: '🧳', titre: 'La semaine sur la route',
    quand: f => f.visiteur >= 3,
    fait: f => `${f.visiteur} matchs à l'étranger cette semaine · jambes ${f.jambes}`,
    mots: ['Les valises sont faites, les jambes, pas encore. Je veux des bas de compression dans chaque sac.',
      'L\'autobus, l\'avion, l\'hôtel. Si on ne fait rien, on va arriver au troisième soir sur les genoux.'],
    options: [
      { cle: 'compression', nom: 'Les bas de compression', bon: 'Les jambes tiennent sur la route', si: 'visiteur', duree: 6, energie: 0.85 },
      { cle: 'pratique', nom: 'Pratiquer à chaque arrêt', bon: 'Les mains restent chaudes', prix: 'Les jambes paient', si: 'visiteur', duree: 6, finition: 1.08, energie: 1.06 },
    ],
  },
  laSemaineChezNous: {
    de: 'co', ico: '🏟', titre: 'La semaine à la maison',
    quand: f => f.domicile >= 3,
    fait: f => `${f.domicile} matchs à domicile cette semaine`,
    mots: ['Toute la semaine chez nous : les commanditaires veulent voir les gars, et la foule veut du spectacle.',
      'On a la glace à nous pour une semaine. Dis-moi si on vend des billets ou si on ferme les portes.'],
    options: [
      { cle: 'famille', nom: 'La soirée familiale', bon: 'La caisse se remplit', prix: 'Les gars signent des autographes au lieu de se concentrer', gain: 12, si: 'domicile', duree: 6, defense: 1.04 },
      { cle: 'huis', nom: 'Les pratiques à huis clos', bon: 'Le plan de match, répété sur notre glace', si: 'domicile', duree: 6, finition: 1.07 },
    ],
  },
  leDosADos: {
    de: 'en', ico: '🔁', titre: 'Deux soirs de suite',
    quand: f => f.dos >= 1,
    fait: f => `${f.dos} dos-à-dos cette semaine · jambes ${f.jambes}`,
    mots: ['Le deuxième soir, c\'est là qu\'on perd des matchs. Je veux savoir qui joue avant de monter dans l\'autobus.',
      'Deux soirs de suite. Moi, je partagerais la glace ; les vedettes vont chialer.'],
    options: [
      { cle: 'partager', nom: 'Partager la glace', bon: 'Le quatrième trio porte le deuxième soir', prix: 'Tes vedettes jouent moins', si: 'dosADos', duree: 10, F: [0.88, 0.97, 1.08, 1.25], energie: 0.88 },
      { cle: 'vedettes', nom: 'Les vedettes, les deux soirs', bon: 'Le premier trio ne sort pas', prix: 'Les jambes lâchent le deuxième soir', si: 'dosADos', duree: 10, F: [1.2, 1.05, 0.9, 0.8], energie: 1.08 },
    ],
  },
  lInfirmerie: {
    de: 'me', ico: '🚑', titre: 'L\'infirmerie déborde',
    quand: f => f.blesses.length >= 2,
    fait: f => `🚑 ${f.blesses.slice(0, 3).map(b => `${b.n} ${b.m} m.`).join(', ')}${f.blesses.length > 3 ? ` et ${f.blesses.length - 3} autre${f.blesses.length > 4 ? 's' : ''}` : ''}`,
    mots: ['Ma table est pleine. Il y a un spécialiste à Toronto, mais il ne travaille pas gratuitement.',
      'Je manque de lits. Ou on paie le spécialiste, ou on joue plus prudent le temps qu\'ils reviennent.'],
    options: [
      { cle: 'specialiste', nom: 'Le spécialiste de Toronto', bon: 'Moins de blessures tant que l\'infirmerie déborde', gain: -15, si: 'infirmerie', duree: 10, blessure: 0.55 },
      { cle: 'prudent', nom: 'Jouer prudent', bon: 'On ferme le jeu sans eux', prix: 'L\'attaque s\'éteint', si: 'infirmerie', duree: 10, defense: 0.92, volume: 0.94 },
    ],
  },
  leRival: {
    de: 'pt', ico: '⚔', titre: 'Le rival s\'en vient',
    quand: f => !!f.rival,
    fait: f => `Contre ${f.rival} cette semaine`,
    mots: ['Contre eux, on veut voir du sang sur la glace. Pas une partie de cartes.',
      'On a nos billets depuis un mois. Faites-leur mal, ou au moins faites-les tirer de loin.'],
    options: [
      { cle: 'chauffer', nom: 'Chauffer la foule', bon: 'On les bombarde', prix: 'Les têtes chaudes vont au cachot', si: 'rival', duree: 12, volume: 1.15, discipline: 1.3 },
      { cle: 'froid', nom: 'Garder la tête froide', bon: 'Personne ne mord à l\'hameçon', si: 'rival', duree: 12, discipline: 0.7 },
    ],
  },
  laBeteNoire: {
    de: 'ca', ico: '😤', titre: 'Ta bête noire',
    quand: f => !!f.bete,
    fait: f => `Contre ${f.bete} cette semaine : ils t'ont battu deux fois`,
    mots: ['Ils nous ont battus deux fois. Le vestiaire ne veut pas d\'une troisième.',
      'Je n\'ai pas oublié, et les gars non plus. Dis-moi comment on les règle.'],
    options: [
      { cle: 'comptes', nom: 'Régler nos comptes', bon: 'On frappe tout ce qui bouge', prix: 'Et l\'arbitre le voit', si: 'beteNoire', duree: 30, robustesse: 1.6, discipline: 1.3 },
      { cle: 'tableau', nom: 'Les battre au tableau', bon: 'Leur gardien, on l\'a étudié', si: 'beteNoire', duree: 30, finition: 1.3 },
    ],
  },
  lesJambesLourdes: {
    de: 'ph', ico: '🦵', titre: 'Les jambes lourdes',
    quand: f => !!f.pire && f.pire.j < 80,
    fait: f => `${f.pire.n} : jambes ${f.pire.j} · l'équipe : ${f.jambes}`,
    mots: ['Il y en a un qui patine dans le ciment. Une journée de congé, et je te le rends.',
      'Les jambes ne suivent plus. Moi, j\'annulerais la pratique ; l\'entraîneur ne sera pas content.'],
    options: [
      { cle: 'conge', nom: 'Annuler la pratique', bon: 'Les jambes reviennent', prix: 'Les systèmes rouillent', action: { energieTous: 10 }, duree: 4, defense: 1.04 },
      { cle: 'bas', nom: 'La glace au bas de l\'alignement', bon: 'Les fatigués s\'assoient les soirs lourds', prix: 'Tes vedettes jouent moins', si: 'jambesLourdes', duree: 12, F: [0.88, 0.97, 1.08, 1.2] },
    ],
  },
  lesJambesFraiches: {
    de: 'en', ico: '🌬', titre: 'Tout le monde est frais',
    quand: f => f.jambes >= 93,
    fait: f => `Jambes ${f.jambes} · personne sous ${f.pire ? f.pire.j : f.jambes}`,
    mots: ['Les gars volent. C\'est le temps de pousser, ou de travailler les systèmes pendant qu\'ils ont du jus.',
      'Je n\'ai jamais vu le vestiaire aussi frais. On en profite comment ?'],
    options: [
      { cle: 'pousser', nom: 'On pousse', bon: 'On tire de partout les soirs frais', si: 'jambesFraiches', duree: 12, volume: 1.15 },
      { cle: 'systemes', nom: 'Les systèmes', bon: 'Une structure qui tient', si: 'jambesFraiches', duree: 12, defense: 0.9 },
    ],
  },
  laCaisseVide: {
    de: 'fi', ico: '🧾', titre: 'La caisse à sec',
    quand: f => f.caisse !== null && f.caisse < 25,
    fait: f => `${f.caisse} 🪙 en caisse`,
    mots: ['On roule sur la réserve. Un commanditaire offre de l\'argent pour une soirée avec les gars.',
      'Les comptes ne balancent pas. Je peux vendre une soirée aux commanditaires, mais les gars vont se coucher tard.'],
    options: [
      { cle: 'soiree', nom: 'La soirée des commanditaires', bon: 'La caisse respire', prix: 'Les jambes, le lendemain', gain: 20, duree: 3, energie: 1.1 },
      { cle: 'autobus', nom: 'L\'autobus au lieu de l\'avion', bon: 'Quelques jetons d\'économie', prix: 'Les voyages fatiguent', gain: 10, si: 'visiteur', duree: 8, energie: 1.06 },
      { cle: 'non', nom: 'Refuser', bon: 'Rien ne change', rien: true },
    ],
  },
  laCaisseDeborde: {
    de: 'fi', ico: '💰', titre: 'La caisse déborde',
    quand: f => f.caisse !== null && f.caisse >= 90,
    fait: f => `${f.caisse} 🪙 en caisse`,
    mots: ['Pour une fois, il reste de l\'argent. L\'entraîneur veut une salle de vidéo, le physio un bain froid.',
      'L\'argent dort dans le compte. Investis-le, ou garde-le pour la boutique.'],
    options: [
      { cle: 'video', nom: 'La salle de vidéo', bon: 'On connaît leurs gardiens', gain: -25, duree: 12, finition: 1.08 },
      { cle: 'bain', nom: 'Le bain froid', bon: 'Les jambes lourdes récupèrent', gain: -20, si: 'jambesLourdes', duree: 20, energie: 0.8 },
      { cle: 'garder', nom: 'Garder l\'argent', bon: 'La caisse reste pleine', rien: true },
    ],
  },
  leBlanchi: {
    de: 'an', ico: '🥅', titre: 'Blanchis',
    quand: f => !!f.dernier && f.dernier.pour === 0,
    fait: f => `0–${f.dernier.contre} contre ${f.dernier.adv}`,
    mots: ['Pas un but. Moi, je dirais qu\'ils ont oublié où était le filet, mais je ne suis qu\'à la télé.',
      'Un blanchissage, ça laisse des traces. On va voir s\'ils tirent plus, ou s\'ils visent mieux.'],
    options: [
      { cle: 'partout', nom: 'Tirer de partout', bon: 'Plus de rondelles au filet', prix: 'Des tirs de loin', duree: 5, volume: 1.12, finition: 0.95 },
      { cle: 'devant', nom: 'Le travail devant le filet', bon: 'Des tirs de près', prix: 'Moins de tirs', duree: 5, finition: 1.1, volume: 0.95 },
    ],
  },
  laRaclee: {
    de: 'pr', ico: '🧯', titre: 'Une raclée',
    quand: f => !!f.dernier && f.dernier.contre - f.dernier.pour >= 4,
    fait: f => `${f.dernier.pour}–${f.dernier.contre} contre ${f.dernier.adv}`,
    mots: ['Je ne veux plus jamais voir ça. Fermez la porte du vestiaire, ou fermez votre zone.',
      'J\'ai eu honte dans ma loge. Vous allez me dire ce que vous comptez faire.'],
    options: [
      { cle: 'porte', nom: 'La porte fermée', bon: 'Après une défaite, on ferme le jeu', si: 'apresDefaite', duree: 10, defense: 0.88 },
      { cle: 'tourner', nom: 'Tourner la page', bon: 'On repart à zéro', prix: 'Le proprio retient son chèque', gain: -5, duree: 4, finition: 1.06, volume: 1.04 },
    ],
  },
  leFond: {
    de: 'ca', ico: '🪫', titre: 'Le fond du classement',
    quand: f => f.n >= 20 && f.rang > (3 * f.equipes) / 4,
    fait: f => `${f.rang}e sur ${f.equipes} après ${f.n} matchs`,
    mots: ['Le vestiaire est à plat. Laisse-moi leur parler, ou parle-leur toi-même.',
      'On joue comme une équipe qui a déjà fait ses valises. Il faut faire quelque chose.'],
    options: [
      { cle: 'joueurs', nom: 'La réunion des joueurs', bon: 'Les bâtons restent en bas', duree: 8, discipline: 0.75 },
      { cle: 'capitaine', nom: 'Le capitaine prend la parole', bon: 'Après une défaite, on se relève', si: 'apresDefaite', duree: 12, finition: 1.08, defense: 0.96 },
    ],
  },
  leSommet: {
    de: 'an', ico: '📸', titre: 'En haut du classement',
    quand: f => f.n >= 20 && f.rang <= 3,
    fait: f => `${f.rang === 1 ? '1er' : `${f.rang}e`} sur ${f.equipes} après ${f.n} matchs`,
    mots: ['Tout le monde vous regarde. Je me demande si vos vedettes vont aimer les caméras.',
      'Les projecteurs sont sur vous. On verra si ça monte à la tête.'],
    options: [
      { cle: 'show', nom: 'Le spectacle', bon: 'Chez nous, les vedettes jouent', prix: 'Le bas de l\'alignement rouille', si: 'domicile', duree: 10, F: [1.25, 1.05, 0.9, 0.78] },
      { cle: 'humble', nom: 'Rester humble', bon: 'On ne relâche rien derrière', duree: 8, defense: 0.93 },
    ],
  },
  leMaire: {
    de: 'ma', ico: '🗝', titre: 'La clé de la ville',
    quand: f => f.n >= 20 && f.rang <= f.equipes / 4 && f.domicile >= 2,
    fait: f => `${f.rang === 1 ? '1er' : `${f.rang}e`} sur ${f.equipes} · ${f.domicile} matchs à domicile cette semaine`,
    mots: ['La ville est fière de vous. J\'aimerais remettre la clé au capitaine, devant les caméras.',
      'Une cérémonie à l\'hôtel de ville, une photo, un chèque. Ça ne prend qu\'un après-midi.'],
    options: [
      { cle: 'cle', nom: 'La cérémonie', bon: 'Un chèque de la ville', prix: 'Un après-midi debout', gain: 15, duree: 3, energie: 1.08 },
      { cle: 'non', nom: 'Poliment refuser', bon: 'Les gars se reposent', rien: true },
    ],
  },
  leCalendrierCharge: {
    de: 'li', ico: '📆', titre: 'Le calendrier chargé',
    quand: f => f.soirs >= 4,
    fait: f => `${f.soirs} matchs cette semaine${f.dos ? `, dont ${f.dos} dos-à-dos` : ''}`,
    mots: ['La cédule est ce qu\'elle est. Votre gardien partant ne peut pas tous les jouer.',
      'Une semaine chargée, comme pour tout le monde. On attend votre feuille de match.'],
    options: [
      { cle: 'auxiliaire', nom: 'L\'auxiliaire devant le filet', bon: 'Ton partant souffle', prix: 'Un soir avec l\'auxiliaire', action: { gardienAux: 1 } },
      { cle: 'tout', nom: 'Ton partant, tous les soirs', bon: 'Le meilleur devant le filet', prix: 'Les jambes de devant paient', duree: 4, energie: 1.06 },
    ],
  },
  laSemaineTranquille: {
    de: 'en', ico: '🛋', titre: 'Une semaine tranquille',
    quand: f => f.soirs <= 2,
    fait: f => `${f.soirs} match${f.soirs > 1 ? 's' : ''} cette semaine · jambes ${f.jambes}`,
    mots: ['Une semaine creuse. On peut faire un mini-camp, ou tout le monde au chalet.',
      'Du temps libre, enfin. Moi, je les ferais travailler ; ils te diront le contraire.'],
    options: [
      { cle: 'camp', nom: 'Le mini-camp', bon: 'Les tirs et les systèmes', prix: 'Les jambes', duree: 6, volume: 1.06, finition: 1.04, energie: 1.06 },
      { cle: 'chalet', nom: 'Tout le monde au chalet', bon: 'Les jambes reviennent', action: { energieTous: 12 } },
    ],
  },
  lesHuees: {
    de: 'pa', ico: '🧣', titre: 'Les huées',
    quand: f => f.n >= 6 && f.dernier && f.dernier.contre > f.dernier.pour && f.domicile >= 2,
    fait: f => `${f.dernier.pour}–${f.dernier.contre} contre ${f.dernier.adv} · ${f.domicile} matchs à domicile cette semaine`,
    mots: ['Ça fait trente ans que j\'ai mes billets. Ce soir, j\'ai hué. Je n\'en suis pas fier.',
      'On a hué, oui. Montrez-nous qu\'on a eu tort, chez nous.'],
    options: [
      { cle: 'parler', nom: 'Leur parler', bon: 'Chez nous, on garde son calme', si: 'domicile', duree: 10, discipline: 0.75 },
      { cle: 'jouer', nom: 'Jouer pour eux', bon: 'Chez nous, on attaque', prix: 'La porte s\'ouvre derrière', si: 'domicile', duree: 10, volume: 1.1, defense: 1.04 },
    ],
  },
  laPratique: {
    de: 'en', ico: '📋', titre: 'La pratique du mardi',
    quand: () => true,
    fait: f => `${f.soirs} match${f.soirs > 1 ? 's' : ''} cette semaine · jambes ${f.jambes}`,
    mots: ['Une semaine ordinaire. Dis-moi sur quoi on travaille mardi.',
      'Rien qui brûle. Les tirs, ou la zone : à toi de choisir.'],
    options: [
      { cle: 'tirs', nom: 'Les tirs', bon: 'Plus de rondelles au filet', duree: 5, volume: 1.07 },
      { cle: 'zone', nom: 'La zone', bon: 'Moins de chances contre', duree: 5, defense: 0.95 },
    ],
  },
};
/* La pratique du mardi ne s'ouvre que si rien d'autre n'est vrai : elle ne prend jamais la place d'un vrai dossier. */
const DE_RESERVE = 'laPratique';
const tirer = (graine, w, cle) => hache(String(graine), 'dossier', String(w), cle);
/*
 * LE DOSSIER D'UNE SEMAINE : PUR, la graine, la semaine et les faits du lundi. Parmi les vrais qui ne se sont pas
 * encore ouverts cette saison (`deja`), le plus haut de son tirage ; aucun, la pratique du mardi.
 */
export function dossierDeLaSemaine(graine, w, faits, deja = []) {
  const vraies = Object.keys(DOSSIERS).filter(k => k !== DE_RESERVE && !deja.includes(k) && DOSSIERS[k].quand(faits));
  if (!vraies.length) return deja.includes(DE_RESERVE) ? null : DE_RESERVE;
  return vraies.reduce((b, k) => (tirer(graine, w, k) > tirer(graine, w, b) ? k : b));
}
