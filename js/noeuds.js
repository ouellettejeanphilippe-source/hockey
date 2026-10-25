/*
 * LE NŒUD DE LA SEMAINE (V5, docs/refonte-v5.md). JP : *s'assurer que chaque semaine et gros match soit des nodes,
 * des combats*. Au bureau du lundi, en Rogue, la semaine se choisit comme une case de la carte de Slay the Spire :
 * trois routes, une seule. Se soigner, prendre de la force ou de l'argent — l'arbitrage du roguelike.
 *   🛌 le repos        : les jambes, l'infirmerie ou la glace des vedettes (la table de massage, l'infirmière de garde…) ;
 *   🏋 l'entraînement : la forme des prochains matchs (le vestiaire uni, le mur du dimanche…) ;
 *   💰 la commandite   : des jetons (la ristourne, les billets de saison).
 * V10 (tranche 5) : la route de l'événement est partie avec les événements ; ce qui arrive à ton club est un dossier
 * d'À faire, l'autre lundi (js/dossiers.js). VARIER (JP : *varier ces choix*) : une route n'offre jamais la carte
 * qu'elle offrait au nœud d'avant, et chacune pige dans toutes ses cartes.
 * AUCUNE MÉCANIQUE NEUVE : la décision porte sa charge (un effet de quelques matchs et son moment, ou un gain), lue
 * par le moteur et par la caisse comme celle d'un dossier. V16 : les places sont parties de la banque ; les cartes des
 * routes sont restées ici, les mêmes chiffres (`CARTES_DE_ROUTE`). Le tirage est pur : la graine de la partie et la
 * semaine (`hache`), donc une saison reprise retrouve les mêmes routes.
 * Le gros match reste annoncé par le moteur au fil de la saison (`annoncerGros`, JP : *décidés au fur et à mesure*).
 */
import { hache } from './util.js';

export const ROUTES = {
  repos: { ico: '🛌', nom: 'Le repos' },
  entrainement: { ico: '🏋', nom: 'L\'entraînement' },
  commandite: { ico: '💰', nom: 'La commandite' },
};
const SORTES = Object.keys(ROUTES);
const piger = (liste, graine, w, sorte) => liste[Math.floor(hache(graine, 'noeud', sorte, w) * liste.length)];
/*
 * LES CARTES DES ROUTES (V16 : elles étaient des places, js/places.js) : le repos ménage les jambes, l'infirmerie ou la
 * glace des vedettes ; l'entraînement change la forme des prochains matchs ; la commandite paie. Chacune joue ses
 * `duree` prochains matchs, les soirs de son moment (`si`, `MOMENTS_SI`, js/sim.js), sous la borne de sa rareté
 * (`check_places`).
 */
export const CARTES_DE_ROUTE = {
  repos: {
    tableMassage: { nom: 'La table de massage', ico: '🛏', rarete: 'commune', si: 'dosADos', duree: 8, effet: { energie: 0.8, robustesse: -0.3 }, texte: 'Vingt minutes chacun, entre les deux matchs.' },
    infirmiereDeGarde: { nom: 'L\'infirmière de garde', ico: '💉', rarete: 'peu', si: 'infirmerie', duree: 8, effet: { blessure: 0.5, energie: 0.9, robustesse: -0.3 }, texte: 'Elle dort à l\'aréna tant que l\'infirmerie déborde.' },
    boucheTrousDuMardi: { nom: 'Les bouche-trous du mardi', ico: '🔧', rarete: 'peu', si: 'dosADos', duree: 8, effet: { F: [0.85, 0.95, 1.1, 1.3], energie: 0.9 }, texte: 'Le deuxième soir, le quatrième trio a les clés du camion.' },
    pratiqueDuBas: { nom: 'La pratique du bas', ico: '🪚', rarete: 'commune', si: 'jambesLourdes', duree: 8, effet: { F: [0.85, 0.95, 1.1, 1.3] }, texte: 'Les vedettes s\'assoient. Les autres apprennent à porter le match.' },
    chantier: { nom: 'Le chantier', ico: '🏗', rarete: 'peu', si: 'infirmerie', duree: 8, effet: { F: [0.85, 0.95, 1.1, 1.35], blessure: 0.85 }, texte: 'Des blessés partout : on rebâtit avec ce qui reste.' },
    quatriemeTrio: { nom: 'Le quatrième trio', ico: '🔀', rarete: 'commune', si: 'domicile', duree: 6, effet: { F: [0.88, 0.95, 1.08, 1.25] }, texte: 'Chez toi, tu as le dernier changement : ton quatrième trio, personne ne le suit.' },
    toutLeMonde: { nom: 'Tout le monde joue', ico: '👷', rarete: 'peu', si: 'apresDefaite', duree: 6, effet: { F: [0.88, 0.96, 1.06, 1.22], energie: 0.93 }, texte: 'Après une défaite, quatre trios, et personne ne regarde le tableau des minutes.' },
  },
  entrainement: {
    semaineChargee: { nom: 'La semaine chargée', ico: '🗓', rarete: 'commune', si: 'dosADos', duree: 8, effet: { energie: 0.85, finition: 1.05, volume: 0.96 }, texte: 'Le calendrier sur le babillard, surligné en jaune.' },
    vestiaireUni: { nom: 'Le vestiaire uni', ico: '🫂', rarete: 'commune', si: 'apresDefaite', duree: 6, effet: { finition: 1.06, defense: 0.94, volume: 0.95 }, texte: 'Personne ne sort avant que tout le monde ait parlé.' },
    soireeDesAnciens: { nom: 'La soirée des anciens', ico: '🎩', rarete: 'peu', si: 'domicile', duree: 6, effet: { volume: 1.08, defense: 0.94, finition: 0.97 }, texte: 'Les anciens au premier rang. Personne ne veut avoir l\'air fou devant eux.' },
    retourFoule: { nom: 'Le retour devant la foule', ico: '🎺', rarete: 'peu', si: 'domicile', duree: 4, effet: { volume: 1.15, discipline: 1.06 }, texte: 'La fanfare joue à chaque tir au but. Alors on tire.' },
    coinPeint: { nom: 'Le coin du haut, peint', ico: '🪧', rarete: 'commune', si: 'visiteur', duree: 6, effet: { finition: 1.12, volume: 0.94 }, texte: 'Un carré orange dans le coin du filet de pratique, à chaque arrêt du voyage.' },
    systemeDeRoute: { nom: 'Le système de route', ico: '🗺', rarete: 'commune', si: 'visiteur', duree: 6, effet: { defense: 0.88, volume: 0.93 }, texte: 'Loin de chez soi, on joue simple : la bande, le centre, la bande.' },
    murDuDimanche: { nom: 'Le mur du dimanche', ico: '⛓', rarete: 'peu', si: 'dosADos', duree: 8, effet: { defense: 0.88, volume: 0.93 }, texte: 'Le deuxième soir, les jambes partent ; la structure, elle, reste.' },
    gymSousSol: { nom: 'Le gym du sous-sol', ico: '🏋', rarete: 'commune', si: 'jambesFraiches', duree: 8, effet: { robustesse: 1, energie: 1.05 }, texte: 'Des poids rouillés et une radio qui ne capte qu\'une station.' },
    soupeAuxPois: { nom: 'La soupe aux pois', ico: '🍲', rarete: 'peu', si: 'rival', duree: 10, effet: { robustesse: 1.2, discipline: 1.1 }, texte: 'La recette de la mère du capitaine. Ça colle aux côtes.' },
    doubleEchec: { nom: 'Le double échec', ico: '👁', rarete: 'commune', si: 'apresDefaite', duree: 6, effet: { robustesse: 0.9, discipline: 1.08 }, texte: 'Ils nous ont battus ? Deux de tes gars vont chercher le premier qui bouge.' },
    dansLeTas: { nom: 'On rentre dans le tas', ico: '🪖', rarete: 'peu', si: 'visiteur', duree: 6, effet: { robustesse: 1.1, discipline: 1.1 }, texte: 'Dans leur aréna, le centre est fermé. On l\'ouvre à l\'épaule.' },
    retraiteFermee: { nom: 'La retraite fermée', ico: '⛪', rarete: 'commune', si: 'apresDefaite', duree: 6, effet: { discipline: 0.75, robustesse: -0.4 }, texte: 'Une fin de semaine au monastère. On revient les mains calmes.' },
    voeuSilence: { nom: 'Le vœu de silence', ico: '🤐', rarete: 'peu', si: 'visiteur', duree: 6, effet: { discipline: 0.75, finition: 1.02, robustesse: -0.4 }, texte: 'Pas un mot à leur banc, pas un mot à l\'arbitre.' },
    autreJoue: { nom: 'Tendre l\'autre joue', ico: '🌷', rarete: 'commune', si: 'domicile', duree: 6, effet: { discipline: 0.78, robustesse: -0.35 }, texte: 'Devant les familles, le coup de bâton arrive ; tu souris à l\'arbitre.' },
    chapelet: { nom: 'Le chapelet', ico: '📿', rarete: 'peu', si: 'jambesLourdes', duree: 8, effet: { discipline: 0.75, finition: 1.02, robustesse: -0.4 }, texte: 'Les jambes lourdes, les bâtons partent tout seuls. Un grain à chaque présence.' },
    microDuBanc: { nom: 'Le micro du banc', ico: '🎙', rarete: 'peu', si: 'domicile', duree: 4, effet: { F: [1.25, 1.05, 0.9, 0.8], finition: 1.03, energie: 1.03 }, texte: 'La télé a branché le premier trio. Il joue pour la caméra.' },
  },
  commandite: {
    ristourne: { nom: 'La ristourne', ico: '🧾', rarete: 'commune', gain: 12, texte: 'Le fournisseur de bâtons s\'est trompé dans la facture. En ta faveur.' },
    billetsSaison: { nom: 'Les billets de saison', ico: '🎫', rarete: 'peu', gain: 18, texte: 'Les abonnés renouvellent. La caisse respire.' },
  },
};
/* La carte d'une route tirée : `{ route, id }`. */
export const carteDeRoute = n => CARTES_DE_ROUTE[n.route][n.id];
/* Sa charge, celle qu'une carte jouée portait : un effet de ses `duree` matchs, à son moment, ou un gain. */
export function chargeDeRoute(n) {
  const C = carteDeRoute(n);
  return C.gain ? { gain: C.gain } : { effet: { nom: C.nom, ico: C.ico, duree: C.duree, ...C.effet, ...(C.si ? { si: C.si } : {}) } };
}
/*
 * Les nœuds se tirent l'un après l'autre, des semaines 1 à `w` (un sur deux, les semaines impaires) : une route
 * n'offre jamais la carte qu'elle offrait au nœud d'avant.
 */
/*
 * UNE CARTE QUI PEUT JOUER (oct., JP : *ces choix-là, c'est moi ou y'a rien de cohérent ?*). La route pigeait dans toute
 * sa famille : « Le chantier » (les soirs où l'infirmerie déborde) sortait sous « Personne à l'infirmerie ». Le nœud du
 * jour ne pige que les cartes dont le moment peut arriver dans leurs matchs (`possible(si, duree)`, lu par l'écran sur
 * ce qui est déjà joué et sur le calendrier) ; s'il n'en reste aucune, toute la famille, comme avant.
 */
export function noeudsDeLaSemaine(graine, w, possible = () => true) {
  const avant = {};
  let routes = [];
  for (let v = 1; v <= Math.max(1, w); v += 2) {
    const ici = v + 2 > Math.max(1, w);
    routes = SORTES.map(route => {
      let ids = Object.keys(CARTES_DE_ROUTE[route]).filter(id => id !== avant[route]);
      if (ici) { const C = id => CARTES_DE_ROUTE[route][id]; const vivantes = ids.filter(id => !C(id).si || possible(C(id).si, C(id).duree)); if (vivantes.length) ids = vivantes; }
      return { route, id: piger(ids, graine, v, route) };
    });
    for (const n of routes) avant[n.route] = n.id;
  }
  return routes;
}
/* La décision d'une route prise : sa charge, datée du lundi par l'écran. */
export const decisionDeNoeud = (w, n) => ({ palier: `n:${w}`, noeud: { route: n.route, id: n.id }, ...chargeDeRoute(n) });
