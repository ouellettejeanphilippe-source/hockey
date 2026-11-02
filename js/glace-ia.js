/**
 * SUR GLACE — L'IA DES NEUF AUTRES (31 oct. 2026, améliorée 1er nov.). Le moteur (js/physique.js) joue la glace ;
 * chaque patineur qui n'est pas sous ta manette reçoit d'ici son bâton et ses boutons, comme toi — l'IA ne triche pas,
 * elle pousse le même stick. Des comportements de pilotage à la Reynolds et une lecture de la situation à la Buckland.
 *
 *   le porteur            lance quand le couloir est ouvert et le tir est bon (distance ET angle), passe la transversale
 *                         pour le tir sur réception, cycle derrière le filet quand l'avant est bloqué, dégage au fond
 *                         quand la zone ne s'ouvre pas ; jamais de sa moitié, sauf en désavantage
 *   ses coéquipiers       des positions RELATIVES au porteur : en zone, un devant le filet (déviations), un dans l'enclave
 *                         opposée (le tir sur réception), un à la demi-bande ; le joueur qui vient de passer fonce au
 *                         filet (le give-and-go) ; en deçà de la bleue tant que la rondelle n'y est pas (le hors-jeu)
 *   l'équipe sans elle    en zone défensive, de vrais postes (l'essaim ou la boîte, selon la stratégie) et chacun
 *                         glisse vers l'adversaire de sa zone ; en zone neutre, le 1-2-2 avec conscience de
 *                         l'adversaire ; dans leur zone, l'échec avant de la stratégie (1-2-2, 2-1-2, la trappe 1-3-1)
 *   les stratégies        `STRATEGIES` : équilibrée, offensive, défensive — l'échec avant, la défense de zone, l'attaque
 *                         (la surcharge ou deux au filet), combien les défenseurs pincent
 *   la mise en jeu        le centre presse le bouton autour de la chute, à un hasard près
 *   les tirs de barrage   le tireur fonce et lance de l'enclave (le tir de punition pareil)
 *   l'avantage numérique  le parapluie ; en désavantage, la boîte
 *   les défenseurs        reculent face au porteur qui descend sur eux ; ne se laissent jamais déborder : entre
 *                         l'attaquant le plus avancé et leur filet, à un écart qui grandit avec sa vitesse (`duBonCote`) ;
 *                         celui qui chasse un porteur lancé le contient au lieu de foncer
 *   le turbo              le porteur fonce quand la glace devant lui est libre, tant que ses jambes tiennent
 *
 * Pur : les mêmes entrées sur la même graine rendent les mêmes décisions (le hasard vient de `etat.de`). Le moteur
 * la rappelle quelques fois par seconde ; ce qu'elle doit se rappeler vit sur le patineur (`s.memo`).
 */
import { LIGNE_BUT, BLEUE, BATON, HARPON, W, surGlace, autre } from './physique.js';

const hyp = Math.hypot;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const plier = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/* Aller vers un point : à fond loin, en douceur près. */
function vers(s, tx, ty, arrivee = 1.5) {
  const dx = tx - s.x, dy = ty - s.y, d = hyp(dx, dy);
  if (d < 0.15) return { x: 0, y: 0 };
  const m = d < arrivee ? d / arrivee : 1;
  return { x: dx / d * m, y: dy / d * m };
}
/* Se tenir à distance des coéquipiers, et contourner les adversaires qu'on ne chasse pas : une poussée quand on se marche dessus. */
function espacer(s, miens, e, rayon = 2.2, adv = []) {
  let px = 0, py = 0;
  for (const m of [...miens, ...adv]) {
    if (m === s) continue;
    const dx = s.x - m.x, dy = s.y - m.y, d = hyp(dx, dy);
    if (d > rayon || d < 1e-6) continue;
    px += dx / d * (1 - d / rayon); py += dy / d * (1 - d / rayon);
  }
  const x = e.x + px * 0.8, y = e.y + py * 0.8, m = hyp(x, y);
  return m > 1 ? { x: x / m, y: y / m } : { x, y };
}
const dansLaGlace = (x, y) => ({ x: clamp(x, -(LIGNE_BUT - 1), LIGNE_BUT - 1), y: clamp(y, -(W / 2 - 1.2), W / 2 - 1.2) });

/* Le couloir d'un lancer ou d'une passe est-il ouvert ? Aucun adversaire à moins de `marge` de la ligne, passé le premier mètre. */
function couloirOuvert(x0, y0, x1, y1, adv, marge = 1.2, jusqua = 1) {
  const dx = x1 - x0, dy = y1 - y0, d2 = dx * dx + dy * dy || 1e-9;
  for (const o of adv) {
    const u = ((o.x - x0) * dx + (o.y - y0) * dy) / d2;
    if (u < 0.08 || u > jusqua) continue;
    if (hyp(o.x - (x0 + u * dx), o.y - (y0 + u * dy)) < marge) return false;
  }
  return true;
}

/*
 * DU BON CÔTÉ (JP, 1er nov. : *meilleure position des défenseurs, pour éviter trop d'échappées*) : un défenseur ne se
 * laisse jamais déborder. Il reste entre l'attaquant le plus avancé vers son filet et ce filet, avec un ÉCART qui grandit
 * avec la vitesse de l'attaquant (il recule avant qu'on le dépasse, pas après) ; quand la règle le tire en arrière, il
 * glisse aussi vers le couloir de cet attaquant. `marge` : la profondeur qu'il peut laisser de plus (pincer en zone).
 */
export const ECART_D = { base: 3, parVitesse: 1.2, couloir: 0.5 };
/*
 * LES STRATÉGIES D'ÉQUIPE (JP, 2 nov. : *des joueurs qui se positionnent à de vrais endroits de systèmes défensifs, avec
 * des stratégies à la NHL*) : trois réglages d'un club, comme dans les jeux de la LNH — l'échec avant (1-2-2, 2-1-2,
 * la trappe 1-3-1), la défense de zone (l'essaim : le défenseur fort au coin, l'autre devant le filet, le centre bas,
 * l'ailier fort à la pointe, le faible dans l'enclave haute ; la boîte : tout le monde serré devant le filet),
 * l'attaque (la surcharge du côté de la rondelle, ou deux au filet), et combien les défenseurs pincent à la bleue.
 */
export const STRATEGIES = {
  equilibree: { echecAvant: '2-1-2', zone: 'essaim', attaque: 'surcharge', pince: 3 },
  offensive: { echecAvant: '2-1-2', zone: 'essaim', attaque: 'filet', pince: 6 },
  defensive: { echecAvant: '1-2-2', zone: 'boite', attaque: 'surcharge', pince: 0.5 },
};
const strategieDe = (etat, eq) => STRATEGIES[etat.equipes[eq].strategie] || STRATEGIES.equilibree;
const CONTENIR = { base: 1.4, parVitesse: 0.9, max: 10 };   // l'écart du défenseur qui contient le porteur, m (et par m/s du porteur)
function duBonCote(cible, a, u, adv, marge = 0) {
  let plusLoin = null;
  for (const o of adv) if (!plusLoin || u(o.x) < u(plusLoin.x)) plusLoin = o;
  if (!plusLoin) return cible;
  const fonce = Math.max(0, -(plusLoin.vx * a));   // sa vitesse vers notre filet
  const limite = Math.max(-(LIGNE_BUT - 2.5), u(plusLoin.x) - ECART_D.base - ECART_D.parVitesse * fonce + marge);
  if (u(cible.x) <= limite) return cible;
  const tire = Math.min(1, (u(cible.x) - limite) / 6);
  return { x: a * limite, y: cible.y + (plusLoin.y * 0.8 - cible.y) * ECART_D.couloir * tire };
}

/** L'entrée d'un patineur joué par l'IA : { x, y, passe, tir, echec }, en coordonnées de glace. */
export function decisionIA(etat, s) {
  const memo = s.memo || (s.memo = {});
  const R = etat.rondelle;
  const eq = s.equipe, a = etat.equipes[eq].attaque;
  const but = { x: a * LIGNE_BUT, y: 0 }, monBut = { x: -a * LIGNE_BUT, y: 0 };
  const u = x => x * a;   // la profondeur vers le filet attaqué
  const miens = surGlace(etat, eq), adv = surGlace(etat, autre(eq));
  const porteur = R.porteur ? etat.patineurs.find(p => p.id === R.porteur) : null;
  const M = etat.match;

  if (porteur === s) memo.dernierePossession = etat.t;

  // LA MISE EN JEU : le centre presse autour de la chute ; les autres attendent.
  if (etat.mej) {
    if (etat.mej.centres[eq] !== s.id) return { x: 0, y: 0 };
    if (memo.mej == null || memo.mejPour !== etat.mej) { memo.mejPour = etat.mej; memo.mej = (etat.de() - 0.4) * 0.3; }
    return { x: 0, y: 0, passe: etat.mej.reste <= memo.mej + 0.0001 };
  }

  // LE HORS-JEU DIFFÉRÉ contre nous : on ressort de la zone, vite, et personne n'y entre tant que le bras est levé.
  if (M && M.horsJeuDiffere === eq && porteur !== s) {
    if (u(s.x) > BLEUE - 0.6) return vers(s, a * (BLEUE - 2), s.y, 0.5);
    if (u(R.x) > BLEUE) return vers(s, a * (BLEUE - 1.5), clamp(R.y, -8, 8), 1);
  }

  // UN TIR EN CHARGE : on tient, puis on lâche.
  if (memo.tir && porteur === s) {
    memo.tir.reste -= 4 / 120;
    if (memo.tir.reste > 0) return { x: memo.tir.x, y: memo.tir.y, tir: true };
    memo.tir = null;
    return { x: memo.dirX || 0, y: memo.dirY || 0, tir: false };
  }
  memo.tir = null;

  if (porteur === s) return avecLaRondelle(etat, s, memo, a, but, u, miens, adv, M);
  if (porteur && porteur.equipe === eq) return soutenir(etat, s, a, but, u, miens, adv, porteur);
  return defendre(etat, s, memo, a, but, monBut, u, miens, adv, porteur);
}

/* ---------- le porteur ---------- */
function avecLaRondelle(etat, s, memo, a, but, u, miens, adv, M) {
  const R = etat.rondelle;
  const dBut = hyp(but.x - s.x, but.y - s.y);
  const pression = Math.min(Infinity, ...adv.map(o => hyp(o.x - s.x, o.y - s.y)));
  const enDesavantage = M && M.penalites.filter(p => p.equipe === s.equipe).length > M.penalites.filter(p => p.equipe !== s.equipe).length;
  const fusillade = M && M.ronde;
  const couloir = couloirOuvert(R.x, R.y, but.x, but.y, adv, 1.1, 0.75);
  // Les tirs de barrage, le tir de punition : foncer, lancer de l'enclave.
  if (fusillade) {
    if (dBut < 7.5) return charger(memo, s, but, a, 0.35, etat);
    const e = vers(s, but.x - a * 4, (etat.de() - 0.5) * 2);
    memo.dirX = e.x; memo.dirY = e.y;
    return e;
  }
  // LANCER ? La qualité du tir : la distance ET l'angle. Jamais de sa moitié, sauf en désavantage.
  const deSaMoitie = u(s.x) < 0;
  const peutLancer = !deSaMoitie || enDesavantage;
  const lateral = Math.abs(s.y);
  const angleFilet = Math.abs(Math.atan2(s.y, but.x - s.x));
  const bonTir = dBut < 11 && lateral < 8 && couloir && angleFilet < 0.9;
  if (peutLancer && (bonTir || dBut < 6 || (pression < 2.2 && dBut < 17 && couloir && u(s.x) > BLEUE))) {
    const charge = clamp((dBut - 4) / 14, 0.05, 0.9);
    return charger(memo, s, but, a, charge, etat);
  }
  // DERRIÈRE LE FILET : chercher une passe devant (l'enclave, le devant du filet) ou ressortir de l'autre côté.
  const derriere = u(s.x) > LIGNE_BUT - 2.5 && dBut > 4;
  if (derriere) {
    for (const m of miens) {
      if (m === s || m.auSol > 0) continue;
      const ouvert = Math.min(Infinity, ...adv.map(o => hyp(o.x - m.x, o.y - m.y))) > 2.5;
      if (!ouvert) continue;
      const devantFilet = u(m.x) > BLEUE && hyp(but.x - m.x, but.y - m.y) < 10 && Math.abs(m.y) < 6;
      if (devantFilet && couloirOuvert(R.x, R.y, m.x, m.y, adv, 1.3)) {
        const dx = m.x - s.x, dy = m.y - s.y, d = hyp(dx, dy) || 1;
        memo.dirX = dx / d; memo.dirY = dy / d;
        return { x: dx / d, y: dy / d, passe: true };
      }
    }
    const cible = { x: but.x - a * 5, y: -Math.sign(s.y || 1) * 5 };
    const e = vers(s, cible.x, cible.y, 1);
    memo.dirX = e.x; memo.dirY = e.y;
    return e;
  }
  // PASSER ? La transversale pour le tir sur réception, un coéquipier ouvert et bien placé.
  let meilleur = null, score = 0.6;
  for (const m of miens) {
    if (m === s || m.auSol > 0) continue;
    const d = hyp(m.x - s.x, m.y - s.y);
    if (d < 3 || d > 28) continue;
    const ouvert = Math.min(Infinity, ...adv.map(o => hyp(o.x - m.x, o.y - m.y))) > 2.2;
    const ligne = couloirOuvert(R.x, R.y, m.x, m.y, adv, 1.3);
    if (!ligne) continue;
    const avance = u(m.x) - u(s.x);
    const horsJeu = u(m.x) > BLEUE + 0.2 && u(R.x) < BLEUE;   // il est déjà dans la zone, la rondelle pas : un hors-jeu
    if (horsJeu) continue;
    const dansEnclave = u(m.x) > BLEUE && hyp(but.x - m.x, but.y - m.y) < 14;
    const transversale = dansEnclave && ouvert && Math.sign(m.y) !== Math.sign(s.y);
    const sc = (ouvert ? 1 : 0) + avance * 0.12 - d * 0.02 + (pression < 2.5 ? 0.6 : 0)
      + (dansEnclave && ouvert ? 0.8 : 0) + (transversale ? 0.7 : 0);
    if (sc > score) { score = sc; meilleur = m; }
  }
  if (meilleur && (pression < 3 || score > 1.6 || etat.de() < 0.02)) {
    const dx = meilleur.x - s.x, dy = meilleur.y - s.y, d = hyp(dx, dy) || 1;
    memo.dirX = dx / d; memo.dirY = dy / d;
    return { x: dx / d, y: dy / d, passe: true };
  }
  // DÉGAGER AU FOND quand l'entrée de zone est bloquée et qu'on est pressé.
  const presEntree = u(s.x) > BLEUE - 8 && u(s.x) < BLEUE + 2 && pression < 3.5;
  const entreePleine = adv.filter(o => u(o.x) > BLEUE - 4 && u(o.x) < BLEUE + 8 && Math.abs(o.y - s.y) < 6).length >= 2;
  if (presEntree && entreePleine && !enDesavantage && etat.de() < 0.15) {
    const coin = s.y < 0 ? -1 : 1;
    memo.dirX = a; memo.dirY = coin * 0.3;
    return { x: a, y: coin * 0.3, tir: true };
  }
  // PATINER : vers le filet par le côté le plus libre ; derrière le filet, on ressort devant.
  let cible;
  // Un coéquipier déjà dans la zone : on n'entre pas (le hors-jeu), on tient la bleue le long de la bande le temps qu'il ressorte.
  const unDedans = u(s.x) < BLEUE && u(s.x) > BLEUE - 6 && miens.some(m => m !== s && u(m.x) > BLEUE + 0.25);
  if (unDedans) cible = { x: a * (BLEUE - 1.5), y: Math.sign(s.y || 1) * 9 };
  else if (u(s.x) > LIGNE_BUT - 1) cible = { x: but.x - a * 4, y: Math.sign(s.y || 1) * 5 };
  else if (u(s.x) < BLEUE) {
    if (memo.cote == null || etat.t - (memo.coteT || -9) > 2) {
      const gauche = adv.filter(o => o.y < 0).length, droite = adv.length - gauche;
      memo.cote = gauche === droite ? (s.y < 0 ? -1 : 1) : (gauche < droite ? -1 : 1);
      memo.coteT = etat.t;
    }
    cible = { x: a * (BLEUE + 4), y: memo.cote * 7 };
  } else {
    // En zone : couper vers l'enclave en contournant les défenseurs.
    const coteY = Math.sign(s.y || (etat.de() < 0.5 ? -1 : 1));
    cible = { x: but.x - a * 5.5, y: coteY * clamp(Math.abs(s.y) - 1.5, 0, 3) };
    for (const o of adv) {
      const dx = o.x - s.x, dy = o.y - s.y, d = hyp(dx, dy);
      if (d < 3.5 && dx * a > 0) { cible.y = s.y + (dy > 0 ? -4 : 4); cible.x = s.x + a * 3; break; }
    }
  }
  cible = dansLaGlace(cible.x, cible.y);
  const e = vers(s, cible.x, cible.y, 1);
  memo.dirX = e.x; memo.dirY = e.y;
  // LE TURBO : la glace libre devant, les jambes qui tiennent, on fonce.
  const libreDevant = !adv.some(o => { const dx = o.x - s.x, dy = o.y - s.y; return hyp(dx, dy) < 5 && dx * e.x + dy * e.y > 0; });
  if (libreDevant && s.jambes > 40 && u(s.x) > -BLEUE) e.sprint = true;
  return e;
}
/* Tenir le tir le temps de la charge, puis lâcher (la visée assistée fait le reste ; le bâton choisit le coin). */
function charger(memo, s, but, a, part, etat) {
  const coin = etat.de() < 0.5 ? -1 : 1;
  // Le bâton penché vers un coin, par rapport à la ligne du filet : la composante en travers choisit où.
  const dx = but.x - s.x, dy = but.y - s.y, d = hyp(dx, dy) || 1;
  const x = dx / d - dy / d * coin * 0.4, y = dy / d + dx / d * coin * 0.4, m = hyp(x, y) || 1;
  memo.tir = { reste: part * BATON.charge + 0.02, x: x / m, y: y / m };
  return { x: x / m, y: y / m, tir: true };
}

/* Le poste de `s` parmi `postes`, les candidats se servant du plus près au plus loin (le même calcul chez chacun : la même réponse). */
function posteDe(s, candidats, postes) {
  const libres = postes.slice(), restants = candidats.slice();
  while (libres.length && restants.length) {
    let meilleur = null;
    for (const m of restants) for (const p of libres) { const d = hyp(m.x - p.x, m.y - p.y); if (!meilleur || d < meilleur.d) meilleur = { m, p, d }; }
    if (meilleur.m === s) return meilleur.p;
    restants.splice(restants.indexOf(meilleur.m), 1); libres.splice(libres.indexOf(meilleur.p), 1);
  }
  return postes[postes.length - 1];
}

/* L'adversaire que `s` couvre parmi `adversaires`, les plus proches d'abord (le même calcul chez chacun : la même réponse). */
function marqueDe(s, couvreurs, adversaires) {
  const libres = adversaires.slice(), restants = couvreurs.slice();
  while (libres.length && restants.length) {
    let meilleur = null;
    for (const m of restants) for (const o of libres) { const d = hyp(m.x - o.x, m.y - o.y); if (!meilleur || d < meilleur.d) meilleur = { m, o, d }; }
    if (meilleur.m === s) return meilleur.o;
    restants.splice(restants.indexOf(meilleur.m), 1); libres.splice(libres.indexOf(meilleur.o), 1);
  }
  return null;
}

/* ---------- les coéquipiers du porteur ---------- */
function soutenir(etat, s, a, but, u, miens, adv, porteur) {
  const R = etat.rondelle;
  const enZone = u(R.x) > BLEUE;
  const F = miens.filter(m => m.poste !== 'D');
  const memo = s.memo || (s.memo = {});
  let cible;
  // L'AVANTAGE NUMÉRIQUE, en zone : le parapluie. Les postes se prennent dans l'ordre, le porteur en garde un.
  if (enZone && miens.length > adv.length && miens.length >= 5) {
    const postes = [{ x: a * (BLEUE + 1.5), y: 0 }, { x: a * (BLEUE + 6), y: -7.5 }, { x: a * (BLEUE + 6), y: 7.5 }, { x: but.x - a * 6, y: 0 }, { x: but.x - a * 2.2, y: 1.5 }];
    const ordre = miens.slice().sort((p, q) => (p.poste === 'D' ? 0 : 1) - (q.poste === 'D' ? 0 : 1) || p.id.localeCompare(q.id));
    cible = postes[Math.min(ordre.indexOf(s), postes.length - 1)];
  } else {
    const c = Math.sign(R.y || 1);
    const notreZone = u(R.x) < -BLEUE;
    const devance = u(R.x) > BLEUE - 6 ? Math.min(u(R.x) - 1, BLEUE - 1.5) : u(R.x) + 5;   // près de la bleue, les ailiers TRAÎNENT la rondelle d'un mètre
    // LE GIVE-AND-GO : le joueur qui vient de passer fonce au filet 1,5 s.
    const vientDePasser = enZone && s.poste !== 'D' && memo.dernierePossession && etat.t - memo.dernierePossession < 1.5 && etat.t - memo.dernierePossession > 0.05;
    if (vientDePasser) {
      cible = { x: but.x - a * 3, y: clamp(s.y * 0.3, -3, 3) };
    } else if (enZone) {
      // LES POSTES EN ZONE : RELATIFS AU PORTEUR — un devant le filet (déviations, rebonds), un dans l'enclave opposée
      // (le tir sur réception, la transversale), un à la demi-bande loin du porteur.
      const cp = Math.sign(porteur.y || 1), st = strategieDe(etat, s.equipe);
      const derriereFilet = u(porteur.x) > LIGNE_BUT - 3;
      // LA SURCHARGE : un au filet, un bas du côté de la rondelle, un dans l'enclave haute ; le défenseur fort à sa pointe,
      // l'autre qui glisse vers le milieu de la bleue. AU FILET : deux devant le gardien, un haut, les défenseurs aux pointes.
      const postesF = derriereFilet
        ? [{ x: but.x - a * 3, y: -cp * 2 }, { x: but.x - a * 6.5, y: cp * 1.5 }, { x: a * (BLEUE + 3.5), y: -cp * 4 }]
        : st.attaque === 'filet'
          ? [{ x: but.x - a * 2, y: -1.2 }, { x: but.x - a * 2.2, y: 1.2 }, { x: but.x - a * 7, y: -cp * 1.5 }]
          : [{ x: but.x - a * 2.2, y: -cp * 1 }, { x: but.x - a * 4, y: cp * 6 }, { x: but.x - a * 7.5, y: cp * 1.5 }];
      const postesD = st.attaque === 'filet'
        ? [{ x: a * (BLEUE + 1.2), y: -6.5 }, { x: a * (BLEUE + 1.2), y: 6.5 }]
        : [{ x: a * (BLEUE + 1.5), y: cp * 6.5 }, { x: a * (BLEUE + 1.5), y: -cp * 2 }];
      cible = posteDe(s, miens.filter(m => m !== porteur && (m.poste === 'D') === (s.poste === 'D')), s.poste === 'D' ? postesD : postesF);
    } else if (notreZone) {
      // LA SORTIE DE ZONE : le centre haut, les ailiers aux demi-bandes.
      const postesF = [{ x: -a * (LIGNE_BUT - 9), y: 0 }, { x: -a * (BLEUE + 3), y: -8 }, { x: -a * (BLEUE + 3), y: 8 }];
      const postesD = [{ x: -a * (LIGNE_BUT - 2.5), y: -c * 3 }, { x: -a * (LIGNE_BUT - 7), y: c * 4 }];
      cible = posteDe(s, miens.filter(m => m !== porteur && (m.poste === 'D') === (s.poste === 'D')), s.poste === 'D' ? postesD : postesF);
    } else {
      // LA ZONE NEUTRE : le centre dans l'autre couloir, les ailiers larges, jamais devant la rondelle près de la bleue.
      const postesF = [{ x: a * (u(R.x) + 1), y: -R.y * 0.5 }, { x: a * devance, y: -8 }, { x: a * devance, y: 8 }];
      const postesD = [{ x: a * (u(R.x) - 8), y: -5 }, { x: a * (u(R.x) - 8), y: 5 }];
      cible = posteDe(s, miens.filter(m => m !== porteur && (m.poste === 'D') === (s.poste === 'D')), s.poste === 'D' ? postesD : postesF);
    }
  }
  // En deçà de la bleue tant que la rondelle n'y est pas : pas de hors-jeu.
  if (!enZone && u(cible.x) > BLEUE - 0.8) cible.x = a * (BLEUE - 0.8);
  // LES DÉFENSEURS, même à l'attaque, restent du bon côté de l'adversaire qui traîne haut : celui du côté fort peut
  // pincer de quelques mètres, l'autre reste le dernier homme.
  if (s.poste === 'D') {
    const D = miens.filter(m => m.poste === 'D' && m !== porteur);
    const fort = D.slice().sort((p, q) => hyp(p.x - R.x, p.y - R.y) - hyp(q.x - R.x, q.y - R.y))[0] === s && D.length > 1;
    cible = duBonCote(cible, a, u, adv, fort ? strategieDe(etat, s.equipe).pince : 1);
  }
  if (s.poste !== 'D' && F.length <= 2 && s.poste === 'C' && enZone) cible = { x: but.x - a * 6, y: 0 };
  cible = dansLaGlace(cible.x, cible.y);
  const e = espacer(s, miens, vers(s, cible.x, cible.y), 2.2, adv);
  // Le tir sur réception : une passe vient vers moi dans l'enclave, le bâton est prêt ; devant le filet, la déviation aussi.
  if ((R.passeVers === s.id || hyp(but.x - s.x, but.y - s.y) < 5) && hyp(but.x - s.x, but.y - s.y) < 14 && u(s.x) > BLEUE) e.tir = true;
  return e;
}

/* ---------- l'équipe sans la rondelle ---------- */
function defendre(etat, s, memo, a, but, monBut, u, miens, adv, porteur) {
  const R = etat.rondelle;
  // Qui chasse : le plus proche de la rondelle (par le temps pour y arriver), un deuxième si elle est libre.
  const tempsVers = m => {
    if (porteur) return hyp(porteur.x - m.x, porteur.y - m.y) / 9;
    let meilleur = Infinity;
    for (let t = 0; t <= 2.5; t += 0.25) {
      const f = Math.max(0, 1 - 0.98 * t / Math.max(0.1, hyp(R.vx, R.vy)));
      const px = R.x + R.vx * t * (1 - (1 - f) / 2), py = R.y + R.vy * t * (1 - (1 - f) / 2);
      if (hyp(px - m.x, py - m.y) / 9 <= t) { meilleur = t; break; }
      meilleur = Math.min(meilleur, Math.max(t, hyp(px - m.x, py - m.y) / 9));
    }
    return meilleur;
  };
  const ordre = miens.slice().sort((p, q) => tempsVers(p) - tempsVers(q));
  const rang = ordre.indexOf(s);
  const notreZone = u(R.x) < -BLEUE;
  // LE DÉSAVANTAGE, en zone : la boîte devant notre gardien ; le plus proche ne sort que si le porteur entre dans le carré.
  const desavantage = miens.length < adv.length && notreZone && !(porteur && porteur.equipe === s.equipe);
  const dansLeCarre = porteur && u(porteur.x) < -(LIGNE_BUT - 9.5) && Math.abs(porteur.y) < 5;
  const chasse = desavantage ? (rang === 0 && (dansLeCarre || !porteur)) : (rang === 0 || (!porteur && rang === 1));
  if (chasse) {
    let cible, e;
    if (porteur) {
      cible = { x: porteur.x + porteur.vx * 0.3, y: porteur.y + porteur.vy * 0.3 };
      // LE DÉFENSEUR CONTIENT au lieu de foncer : encore du bon côté du porteur qui monte, hors de notre fond de zone, il
      // se place devant lui sur sa ligne vers notre filet, à un écart qui suit sa vitesse, et l'attend.
      const ligne = { x: monBut.x - porteur.x, y: monBut.y - porteur.y }, dl = hyp(ligne.x, ligne.y) || 1;
      const contient = s.poste === 'D' && u(s.x) < u(porteur.x) && u(porteur.x) > -(LIGNE_BUT - 9);
      if (contient) {
        const fonce = Math.max(0, -(porteur.vx * a));
        const ecart = clamp(CONTENIR.base + CONTENIR.parVitesse * fonce, CONTENIR.base, CONTENIR.max);
        cible = { x: porteur.x + ligne.x / dl * ecart, y: porteur.y + ligne.y / dl * ecart };
      }
      e = vers(s, cible.x, cible.y, contient ? 1 : 2.2);   // on arrive en freinant : la charge, c'est le bouton
      const dx = porteur.x - s.x, dy = porteur.y - s.y, d = hyp(dx, dy);
      if (contient && d < 8 && e.x * -a > 0.2) e.recul = true;
      const devant = Math.abs(plier(Math.atan2(dy, dx) - s.cap)) < 0.7;
      // Dans son dos et près de lui : on ne fonce pas (la charge par-derrière, c'est deux minutes), on se colle et on harponne.
      const dansSonDos = (dx * Math.cos(porteur.cap) + dy * Math.sin(porteur.cap)) > 0.3 * d;
      if (dansSonDos && d < 3.5) { e.x *= 0.25; e.y *= 0.25; }
      // Le harpon à portée, de face ; la mise en échec de face, en fonçant — jamais par-derrière, c'est deux minutes.
      if (d < HARPON.portee + 0.3 && devant && s.harponRepos <= 0 && etat.de() < 0.5) e.tir = true;
      const vs = hyp(s.vx, s.vy) || 1e-9;
      // De face seulement : le porteur vient vers nous (son cap contre notre vitesse) ; de côté ou dans son dos, on ne fonce pas.
      const deFace = (s.vx * Math.cos(porteur.cap) + s.vy * Math.sin(porteur.cap)) / vs < -0.2;
      const enFaceDeLui = (dx * Math.cos(porteur.cap) + dy * Math.sin(porteur.cap)) < -0.3 * d;
      if (d < 2.6 && devant && deFace && enFaceDeLui && vs > 3 && s.elanRepos <= 0) e.echec = true;
    } else {
      const t = tempsVers(s);
      cible = { x: R.x + R.vx * Math.min(t, 2), y: R.y + R.vy * Math.min(t, 2) };
      cible = dansLaGlace(cible.x, cible.y);
      e = vers(s, cible.x, cible.y, 0.5);
    }
    return e;
  }
  // Les autres se placent : entre la rondelle et notre filet, chacun sur un adversaire.
  const D = miens.filter(m => m.poste === 'D'), iD = D.indexOf(s);
  let cible;
  if (desavantage) {
    const coins = [{ x: monBut.x + a * 3.5, y: -2.8 }, { x: monBut.x + a * 3.5, y: 2.8 }, { x: monBut.x + a * 8.5, y: -3.5 }, { x: monBut.x + a * 8.5, y: 3.5 }];
    const ordreBoite = miens.slice().sort((p, q) => (p.poste === 'D' ? 0 : 1) - (q.poste === 'D' ? 0 : 1) || p.id.localeCompare(q.id));
    cible = coins[Math.min(ordreBoite.indexOf(s), coins.length - 1)];
    // Le carré glisse vers le côté de la rondelle.
    cible = { x: cible.x, y: cible.y + clamp(R.y, -4, 4) * 0.35 };
  } else {
    const c = Math.sign(R.y || 1);
    const leurZone = u(R.x) > BLEUE;
    const chasseur = ordre[0];
    const miensSans = miens.filter(m => m !== chasseur && (porteur || m !== ordre[1]));

    const st = strategieDe(etat, s.equipe);
    if (notreZone) {
      // LA DÉFENSE DE ZONE, à de vrais postes (le chasseur presse la rondelle). L'ESSAIM : le défenseur du côté fort au
      // coin ou au poteau, l'autre devant le filet, le centre bas en soutien, l'ailier fort entre la rondelle et sa
      // pointe, le faible dans l'enclave haute. LA BOÎTE : les deux défenseurs aux poteaux, les ailiers dans l'enclave
      // haute, le centre au milieu. Chacun, de son poste, glisse vers l'adversaire le plus près qui est dans sa zone.
      const cs = Math.sign(R.y || c), basse = -u(R.x) > LIGNE_BUT - 6;   // la rondelle sous les cercles, au coin
      const prof = d => monBut.x + a * d;   // à d mètres devant notre ligne des buts
      const haut = LIGNE_BUT - BLEUE;       // la profondeur de la zone, de la ligne des buts à la bleue
      const postesD = st.zone === 'boite'
        ? [{ x: prof(2.4), y: cs * 2.2 }, { x: prof(2.4), y: -cs * 2.2 }]
        : [{ x: prof(basse ? 1.2 : 2.6), y: cs * (basse ? 3.5 : 2.4) }, { x: prof(1.8), y: -cs * 0.7 }];
      const postesF = st.zone === 'boite'
        ? [{ x: prof(5.5), y: 0 }, { x: prof(haut - 3.5), y: cs * 3.5 }, { x: prof(haut - 3.5), y: -cs * 3.5 }]
        : [{ x: prof(basse ? 3.8 : 4.5), y: cs * 2.2 }, { x: prof(haut - 2.2), y: cs * 7.5 }, { x: prof(haut - 4), y: -cs * 3 }];
      const D2 = miensSans.filter(m => m.poste === 'D'), F2 = miensSans.filter(m => m.poste !== 'D');
      cible = s.poste === 'D' ? posteDe(s, D2, D2.length > postesD.length ? [...postesD, ...postesF] : postesD) : posteDe(s, F2, F2.length > postesF.length ? [...postesF, ...postesD] : postesF);
      // de son poste, vers l'adversaire le plus près, s'il est dans sa zone : entre lui et notre filet
      let proche = null;
      for (const o of adv) { if (o === porteur) continue; const d = hyp(o.x - cible.x, o.y - cible.y); if (d < 4 && (!proche || d < proche.d)) proche = { o, d }; }
      if (proche) { const o = proche.o, t = 0.45; cible = { x: cible.x + ((o.x * 0.7 + monBut.x * 0.3) - cible.x) * t, y: cible.y + ((o.y * 0.8) - cible.y) * t }; }
    } else if (leurZone) {
      // L'ÉCHEC AVANT. 1-2-2 : un presse, deux couvrent les bandes à leur bleue, les défenseurs au centre. 2-1-2 : deux
      // pressent, un dans leur enclave haute, les défenseurs pincent à leur bleue. 1-3-1 (la trappe) : un presse
      // doucement, trois en travers de la zone neutre, un défenseur loin derrière.
      const postes = st.echecAvant === '2-1-2'
        ? [{ x: a * (u(R.x) - 2.5), y: -c * 3.5 }, { x: a * (BLEUE + 3), y: 0 }, { x: a * (BLEUE - 0.8), y: -6 }, { x: a * (BLEUE - 0.8), y: 6 }]
        : st.echecAvant === '1-3-1'
          ? [{ x: a * 1.5, y: -7 }, { x: a * 1.5, y: 7 }, { x: a * 1, y: 0 }, { x: -a * (BLEUE - 1), y: 0 }]
          : [{ x: a * (BLEUE + 1.5), y: -c * 6 }, { x: a * (BLEUE + 1.5), y: c * 6 }, { x: a * (BLEUE - 7), y: -5.5 }, { x: a * (BLEUE - 7), y: 5.5 }];
      const D2 = miensSans.filter(m => m.poste === 'D'), F2 = miensSans.filter(m => m.poste !== 'D');
      const hauts = postes.slice(0, 2), bas = postes.slice(2);
      cible = s.poste === 'D' ? posteDe(s, D2, D2.length > bas.length ? [...bas, ...hauts] : bas) : posteDe(s, F2, F2.length > hauts.length ? [...hauts, ...bas] : hauts);
    } else {
      // LE 1-2-2 en zone neutre avec conscience de l'adversaire : les avants couvrent leur adversaire, les D tiennent la ligne.
      const adversaires = porteur ? adv.filter(o => o !== porteur) : adv;
      const marque = s.poste !== 'D' ? marqueDe(s, miensSans.filter(m => m.poste !== 'D'), adversaires) : null;
      if (marque) {
        cible = { x: marque.x - a * 4, y: marque.y * 0.55 };
      } else {
        const postes = [{ x: a * (u(R.x) - 5), y: -6 }, { x: a * (u(R.x) - 5), y: 6 }, { x: -a * (BLEUE + 1), y: -4.5 }, { x: -a * (BLEUE + 1), y: 4.5 }];
        const D2 = miensSans.filter(m => m.poste === 'D'), F2 = miensSans.filter(m => m.poste !== 'D');
        const hauts = postes.slice(0, 2), bas = postes.slice(2);
        cible = s.poste === 'D' ? posteDe(s, D2, D2.length > bas.length ? [...bas, ...hauts] : bas) : posteDe(s, F2, F2.length > hauts.length ? [...hauts, ...bas] : hauts);
      }
    }
  }
  // LES DÉFENSEURS ne se laissent pas déborder : entre l'attaquant le plus avancé et notre filet, l'écart selon sa vitesse.
  if (iD >= 0 && !desavantage) cible = duBonCote(cible, a, u, adv);
  cible = dansLaGlace(cible.x, cible.y);
  const e = espacer(s, miens, vers(s, cible.x, cible.y, 1), 2.2, adv.filter(o => o !== porteur));
  // LE DÉFENSEUR RECULE face au porteur qui descend sur lui, quand il est près : il va vers son filet, le cap tenu vers
  // la rondelle. Loin, il se retourne et patine de face, plus vite, pour garder son écart.
  if (iD >= 0 && porteur && u(porteur.x) < u(s.x) + 7 && u(porteur.x) > u(s.x) - 1 && e.x * -a > 0.3) e.recul = true;
  return e;
}
