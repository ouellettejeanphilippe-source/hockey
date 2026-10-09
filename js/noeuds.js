/*
 * LE NŒUD DE LA SEMAINE (V5, docs/refonte-v5.md). JP : *s'assurer que chaque semaine et gros match soit des nodes,
 * des combats*. Au bureau du lundi, en Rogue, la semaine se choisit comme une case de la carte de Slay the Spire :
 * trois routes, une seule. Se soigner, prendre de la force ou de l'argent — l'arbitrage du roguelike.
 *   🛌 le repos     : une carte de soin ou de jambes (la journée de congé, la ronde de l'infirmerie…) ;
 *   ❓ l'événement  : une carte d'événement de la banque, commune ou peu commune ;
 *   💰 la commandite : des jetons (la commandite du dépanneur, la vente de garage).
 * AUCUNE MÉCANIQUE NEUVE : chaque route EST une carte existante de la banque, et la décision porte sa charge
 * (`payloadDe` : des gestes, un effet, un gain), lue par le moteur et par la caisse comme une carte jouée. Le tirage
 * est pur : la graine de la partie et la semaine (`hache`), donc une saison reprise retrouve les mêmes routes.
 * Le gros match reste annoncé par le moteur au fil de la saison (`annoncerGros`, JP : *décidés au fur et à mesure*).
 */
import { BANQUE, idsDe, payloadDe } from './banque.js';
import { hache } from './util.js';

const REPOS = ['consommable:conge', 'consommable:infirmerie', 'consommable:tisane', 'consommable:bainGlace'];
const COMMANDITES = ['consommable:depanneur', 'consommable:venteGarage'];   // les deux plus petites (10 et 12 🪙) : la phase 4 calibre
export const ROUTES = {
  repos: { ico: '🛌', nom: 'Le repos' },
  evenement: { ico: '❓', nom: 'L\'événement' },
  commandite: { ico: '💰', nom: 'La commandite' },
};
const piger = (liste, graine, w, sorte) => liste[Math.floor(hache(graine, 'noeud', sorte, w) * liste.length)];
/* Les événements qu'une route peut offrir : communs ou peu communs, sans cible (ils touchent l'équipe). */
const evenementsDeRoute = () => idsDe('evenement').filter(id => (BANQUE[id].rarete === 'commune' || BANQUE[id].rarete === 'peu') && payloadDe(id));
/* Les trois routes de la semaine `w`, pures : [{ route, id }]. */
export function noeudsDeLaSemaine(graine, w) {
  return [
    { route: 'repos', id: piger(REPOS, graine, w, 'repos') },
    { route: 'evenement', id: piger(evenementsDeRoute(), graine, w, 'evenement') },
    { route: 'commandite', id: piger(COMMANDITES, graine, w, 'commandite') },
  ];
}
/* La décision d'une route prise : sa charge (celle de la carte), datée du lundi par l'écran. */
export const decisionDeNoeud = (w, n) => ({ palier: `n:${w}`, noeud: { route: n.route, id: n.id }, ...payloadDe(n.id) });
