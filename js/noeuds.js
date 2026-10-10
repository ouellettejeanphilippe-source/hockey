/*
 * LE NŒUD DE LA SEMAINE (V5, docs/refonte-v5.md). JP : *s'assurer que chaque semaine et gros match soit des nodes,
 * des combats*. Au bureau du lundi, en Rogue, la semaine se choisit comme une case de la carte de Slay the Spire :
 * trois routes, une seule. Se soigner, prendre de la force ou de l'argent — l'arbitrage du roguelike.
 *   🛌 le repos        : une carte de soin, de jambes ou de filet (la journée de congé, la ronde de l'infirmerie…) ;
 *   🏋️ l'entraînement : une carte qui change la forme des prochains matchs (le seau de rondelles, la glace du bas…) ;
 *   ❓ l'événement     : une carte d'événement de la banque, commune ou peu commune ;
 *   💰 la commandite   : des jetons (la vente de garage, le dépanneur, le garagiste).
 * VARIER (JP : *varier ces choix*) : chaque nœud offre trois des quatre routes, jamais les trois mêmes que le nœud
 * d'avant, et chaque route pige dans tout ce que la banque a de cette sorte.
 * AUCUNE MÉCANIQUE NEUVE : chaque route EST une carte existante de la banque, et la décision porte sa charge
 * (`payloadDe` : des gestes, un effet, un gain), lue par le moteur et par la caisse comme une carte jouée. Le tirage
 * est pur : la graine de la partie et la semaine (`hache`), donc une saison reprise retrouve les mêmes routes.
 * Le gros match reste annoncé par le moteur au fil de la saison (`annoncerGros`, JP : *décidés au fur et à mesure*).
 */
import { BANQUE, CONSOMMABLES, idsDe, payloadDe } from './banque.js';
import { hache } from './util.js';

export const ROUTES = {
  repos: { ico: '🛌', nom: 'Le repos' },
  entrainement: { ico: '🏋️', nom: 'L\'entraînement' },
  evenement: { ico: '❓', nom: 'L\'événement' },
  commandite: { ico: '💰', nom: 'La commandite' },
};
const SORTES = Object.keys(ROUTES);
const piger = (liste, graine, w, sorte) => liste[Math.floor(hache(graine, 'noeud', sorte, w) * liste.length)];
/* Les cartes qu'une route peut offrir : communes ou peu communes, sans cible (elles touchent l'équipe), sans pari ni règlement. */
const simple = c => c.cible === 'aucune' && (c.rarete === 'commune' || c.rarete === 'peu') && !c.pari && !c.regle && !c.espace && !c.maitrise && !c.cout;
const consommables = garde => Object.keys(CONSOMMABLES).filter(k => simple(CONSOMMABLES[k]) && garde(CONSOMMABLES[k])).map(k => `consommable:${k}`);
const BASSINS = {
  repos: () => consommables(c => !c.gain && (c.gestes || (c.effet && Object.keys(c.effet).join() === 'blessure'))),
  entrainement: () => consommables(c => !c.gain && !c.gestes && c.effet && Object.keys(c.effet).join() !== 'blessure'),
  evenement: () => idsDe('evenement').filter(id => (BANQUE[id].rarete === 'commune' || BANQUE[id].rarete === 'peu') && payloadDe(id)),
  // Les trois plus petites (10, 12 et 18 🪙) : la phase 4 calibre.
  commandite: () => consommables(c => c.gain && !c.effet && !c.gestes && c.gain <= 18),
};
/*
 * Les nœuds se tirent l'un après l'autre, des semaines 1 à `w` (un sur deux, les semaines impaires) : la route
 * laissée de côté n'est jamais celle du nœud d'avant, et une route n'offre jamais la carte qu'elle offrait alors.
 */
export function noeudsDeLaSemaine(graine, w) {
  const avant = {};
  let omise = -1, routes = [];
  for (let v = 1; v <= Math.max(1, w); v += 2) {
    const k = Math.floor(hache(graine, 'noeud', 'omise', v) * (omise < 0 ? SORTES.length : SORTES.length - 1));
    omise = omise < 0 ? k : (omise + 1 + k) % SORTES.length;
    routes = SORTES.filter((_, i) => i !== omise).map(route => {
      const bassin = BASSINS[route]().filter(id => id !== avant[route]);
      return { route, id: piger(bassin, graine, v, route) };
    });
    for (const n of routes) avant[n.route] = n.id;
  }
  return routes;
}
/* La décision d'une route prise : sa charge (celle de la carte), datée du lundi par l'écran. */
export const decisionDeNoeud = (w, n) => ({ palier: `n:${w}`, noeud: { route: n.route, id: n.id }, ...payloadDe(n.id) });
