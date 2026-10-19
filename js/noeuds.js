/*
 * LE NŒUD DE LA SEMAINE (V5, docs/refonte-v5.md). JP : *s'assurer que chaque semaine et gros match soit des nodes,
 * des combats*. Au bureau du lundi, en Rogue, la semaine se choisit comme une case de la carte de Slay the Spire :
 * trois routes, une seule. Se soigner, prendre de la force ou de l'argent — l'arbitrage du roguelike.
 *   🛌 le repos        : une carte de soin, de jambes ou de filet (la journée de congé, la ronde de l'infirmerie…) ;
 *   🏋 l'entraînement : une carte qui change la forme des prochains matchs (le seau de rondelles, la glace du bas…) ;
 *   💰 la commandite   : des jetons (la vente de garage, le dépanneur, le garagiste).
 * V10 (tranche 5) : la route de l'événement est partie avec les événements ; ce qui arrive à ton club est un dossier
 * d'À faire, l'autre lundi (js/dossiers.js). VARIER (JP : *varier ces choix*) : une route n'offre jamais la carte
 * qu'elle offrait au nœud d'avant, et chacune pige dans tout ce que la banque a de cette sorte.
 * AUCUNE MÉCANIQUE NEUVE : chaque route EST une carte existante de la banque, et la décision porte sa charge
 * (`payloadDe` : des gestes, un effet, un gain), lue par le moteur et par la caisse comme une carte jouée. Le tirage
 * est pur : la graine de la partie et la semaine (`hache`), donc une saison reprise retrouve les mêmes routes.
 * Le gros match reste annoncé par le moteur au fil de la saison (`annoncerGros`, JP : *décidés au fur et à mesure*).
 */
import { CONSOMMABLES, payloadDe } from './banque.js';
import { hache } from './util.js';

export const ROUTES = {
  repos: { ico: '🛌', nom: 'Le repos' },
  entrainement: { ico: '🏋', nom: 'L\'entraînement' },
  commandite: { ico: '💰', nom: 'La commandite' },
};
const SORTES = Object.keys(ROUTES);
const piger = (liste, graine, w, sorte) => liste[Math.floor(hache(graine, 'noeud', sorte, w) * liste.length)];
/* Les cartes qu'une route peut offrir : communes ou peu communes, sans cible (elles touchent l'équipe), sans pari ni règlement. */
const simple = c => c.cible === 'aucune' && (c.rarete === 'commune' || c.rarete === 'peu') && !c.pari && !c.regle && !c.espace && !c.maitrise && !c.cout;
const consommables = garde => Object.keys(CONSOMMABLES).filter(k => simple(CONSOMMABLES[k]) && garde(CONSOMMABLES[k])).map(k => `consommable:${k}`);
/*
 * Le repos : des gestes, ou un effet dont le GAIN ne touche qu'aux jambes et aux blessures (V11 : son prix peut être
 * ailleurs — « La table de massage » coûte de la robustesse).
 */
const gagne = (k, v) => (k === 'robustesse' ? v > 0 : k === 'blessure' || k === 'energie' || k === 'defense' || k === 'discipline' ? v < 1 : v > 1);
const deRepos = c => c.gestes || (c.effet && Object.entries(c.effet).filter(([k, v]) => typeof v === 'number' && gagne(k, v)).every(([k]) => k === 'blessure' || k === 'energie'));
const BASSINS = {
  repos: () => consommables(c => !c.gain && deRepos(c)),
  entrainement: () => consommables(c => !c.gain && !c.gestes && c.effet && !deRepos(c)),
  // Les trois plus petites (10, 12 et 18 🪙) : la phase 4 calibre.
  commandite: () => consommables(c => c.gain && !c.effet && !c.gestes && c.gain <= 18),
};
/*
 * Les nœuds se tirent l'un après l'autre, des semaines 1 à `w` (un sur deux, les semaines impaires) : une route
 * n'offre jamais la carte qu'elle offrait au nœud d'avant.
 */
export function noeudsDeLaSemaine(graine, w) {
  const avant = {};
  let routes = [];
  for (let v = 1; v <= Math.max(1, w); v += 2) {
    routes = SORTES.map(route => ({ route, id: piger(BASSINS[route]().filter(id => id !== avant[route]), graine, v, route) }));
    for (const n of routes) avant[n.route] = n.id;
  }
  return routes;
}
/* La décision d'une route prise : sa charge (celle de la carte), datée du lundi par l'écran. */
export const decisionDeNoeud = (w, n) => ({ palier: `n:${w}`, noeud: { route: n.route, id: n.id }, ...payloadDe(n.id) });
