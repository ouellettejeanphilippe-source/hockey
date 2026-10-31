/**
 * SUR GLACE — L'IA DES NEUF AUTRES (31 oct. 2026). JP : *avoir toutes les mécaniques de hockey*. Le moteur
 * (js/physique.js) joue la glace ; chaque patineur qui n'est pas sous ta manette reçoit d'ici son bâton et ses
 * boutons, comme toi — l'IA ne triche pas, elle pousse le même stick. Des comportements de pilotage à la Reynolds
 * (poursuivre, intercepter, arriver, se tenir à distance) et une lecture de la situation à la Simple Soccer de
 * Buckland : qui a la rondelle, où elle est, qui est le plus proche.
 *
 *   le porteur            lance quand le couloir est ouvert et le filet pas trop loin, passe quand on le presse ou
 *                         qu'un coéquipier est bien mieux placé, sinon patine vers le filet par le côté le plus libre ;
 *                         jamais un lancer de sa moitié (le dégagement refusé), sauf en désavantage
 *   ses coéquipiers       des points de soutien par poste (les ailiers aux bandes, le centre dans l'enclave, les
 *                         défenseurs à la pointe), en deçà de la bleue tant que la rondelle n'y est pas (le hors-jeu),
 *                         et le bâton prêt pour un tir sur réception dans l'enclave
 *   l'équipe sans elle    le plus proche la chasse (l'interception d'une rondelle libre, la poursuite du porteur, le
 *                         harpon à portée, la mise en échec de face et seulement sur le porteur), les autres se placent
 *                         entre la rondelle et leur filet, chacun sur un adversaire
 *   la mise en jeu        le centre presse le bouton autour de la chute, à un hasard près
 *   les tirs de barrage   le tireur fonce et lance de l'enclave
 *
 * Pur : les mêmes entrées sur la même graine rendent les mêmes décisions (le hasard vient de `etat.de`). Le moteur
 * la rappelle quelques fois par seconde ; ce qu'elle doit se rappeler (un tir en charge, le moment de la mise en jeu,
 * un côté choisi) vit sur le patineur (`s.memo`).
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

  // LA MISE EN JEU : le centre presse autour de la chute ; les autres attendent.
  if (etat.mej) {
    if (etat.mej.centres[eq] !== s.id) return { x: 0, y: 0 };
    if (memo.mej == null || memo.mejPour !== etat.mej) { memo.mejPour = etat.mej; memo.mej = (etat.de() - 0.4) * 0.3; }
    return { x: 0, y: 0, passe: etat.mej.reste <= memo.mej + 0.0001 };
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
  const fusillade = M && M.fusillade;
  const couloir = couloirOuvert(R.x, R.y, but.x, but.y, adv, 1.1, 0.75);
  // Les tirs de barrage : foncer, lancer de l'enclave.
  if (fusillade) {
    if (dBut < 7.5) return charger(memo, s, but, a, 0.35, etat);
    const e = vers(s, but.x - a * 4, (etat.de() - 0.5) * 2);
    memo.dirX = e.x; memo.dirY = e.y;
    return e;
  }
  // LANCER ? Le filet devant, pas trop loin, le couloir ouvert — ou tout près — ou pressé dans la zone. Jamais de sa moitié.
  const deSaMoitie = u(s.x) < 0;
  const peutLancer = !deSaMoitie || enDesavantage;
  const lateral = Math.abs(s.y);
  if (peutLancer && ((dBut < 11 && lateral < 8 && couloir) || dBut < 6 || (pression < 2.2 && dBut < 17 && couloir && u(s.x) > BLEUE))) {
    const charge = clamp((dBut - 4) / 14, 0.05, 0.9);
    return charger(memo, s, but, a, charge, etat);
  }
  // PASSER ? Un coéquipier ouvert et mieux placé, surtout si l'on est pressé.
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
    const sc = (ouvert ? 1 : 0) + avance * 0.12 - d * 0.02 + (pression < 2.5 ? 0.6 : 0) + (u(m.x) > BLEUE && hyp(but.x - m.x, but.y - m.y) < 14 && ouvert ? 0.8 : 0);
    if (sc > score) { score = sc; meilleur = m; }
  }
  if (meilleur && (pression < 3 || score > 1.6 || etat.de() < 0.02)) {
    const dx = meilleur.x - s.x, dy = meilleur.y - s.y, d = hyp(dx, dy) || 1;
    memo.dirX = dx / d; memo.dirY = dy / d;
    return { x: dx / d, y: dy / d, passe: true };
  }
  // PATINER : vers le filet par le côté le plus libre ; derrière le filet, on ressort devant.
  let cible;
  if (u(s.x) > LIGNE_BUT - 1) cible = { x: but.x - a * 4, y: Math.sign(s.y || 1) * 5 };
  else if (u(s.x) < BLEUE) {
    if (memo.cote == null || etat.t - (memo.coteT || -9) > 2) {
      const gauche = adv.filter(o => o.y < 0).length, droite = adv.length - gauche;
      memo.cote = gauche === droite ? (s.y < 0 ? -1 : 1) : (gauche < droite ? -1 : 1);
      memo.coteT = etat.t;
    }
    cible = { x: a * (BLEUE + 4), y: memo.cote * 7 };
  } else {
    cible = { x: but.x - a * 5.5, y: clamp(s.y * 0.4, -3, 3) };
    // Un défenseur dans le chemin : on le contourne.
    for (const o of adv) {
      const dx = o.x - s.x, dy = o.y - s.y, d = hyp(dx, dy);
      if (d < 3 && dx * a > 0) { cible.y = s.y + (dy > 0 ? -4 : 4); cible.x = s.x + a * 3; break; }
    }
  }
  cible = dansLaGlace(cible.x, cible.y);
  const e = vers(s, cible.x, cible.y, 1);
  memo.dirX = e.x; memo.dirY = e.y;
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

/* ---------- les coéquipiers du porteur ---------- */
function soutenir(etat, s, a, but, u, miens, adv, porteur) {
  const R = etat.rondelle;
  const enZone = u(R.x) > BLEUE;
  const D = miens.filter(m => m.poste === 'D'), iD = D.indexOf(s);
  const F = miens.filter(m => m.poste !== 'D');
  let cible;
  if (s.poste === 'D' || (iD >= 0)) {
    const cote = iD === 0 ? -1 : 1;
    cible = enZone ? { x: a * (BLEUE + 2.5), y: cote * 6 } : { x: a * (u(R.x) - 7), y: cote * 5 };
  } else {
    const role = s.poste === 'AG' ? -1 : s.poste === 'AD' ? 1 : 0;
    if (enZone) {
      cible = role === 0 ? { x: but.x - a * 7, y: 0 } : { x: but.x - a * 10, y: role * 6.5 };
      // Le centre dans l'enclave : si le porteur y est déjà, il va de l'autre côté.
      if (role === 0 && hyp(porteur.x - cible.x, porteur.y - cible.y) < 3) cible = { x: but.x - a * 4, y: -Math.sign(porteur.y || 1) * 4 };
    } else {
      cible = role === 0 ? { x: a * (u(R.x) + 3), y: R.y * 0.5 } : { x: a * (u(R.x) + 7), y: role * 8 };
    }
  }
  // En deçà de la bleue tant que la rondelle n'y est pas : pas de hors-jeu.
  if (!enZone && u(cible.x) > BLEUE - 0.8) cible.x = a * (BLEUE - 0.8);
  if (s.poste !== 'D' && F.length <= 2 && s.poste === 'C' && enZone) cible = { x: but.x - a * 6, y: 0 };
  cible = dansLaGlace(cible.x, cible.y);
  const e = espacer(s, miens, vers(s, cible.x, cible.y), 2.2, adv);
  // Le tir sur réception : une passe vient vers moi dans l'enclave, le bâton est prêt.
  if (R.passeVers === s.id && hyp(but.x - s.x, but.y - s.y) < 14 && u(s.x) > BLEUE) e.tir = true;
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
  const chasse = rang === 0 || (!porteur && rang === 1);
  if (chasse) {
    let cible, e;
    if (porteur) {
      cible = { x: porteur.x + porteur.vx * 0.3, y: porteur.y + porteur.vy * 0.3 };
      e = vers(s, cible.x, cible.y, 2.2);   // on arrive en freinant : la charge, c'est le bouton
      const dx = porteur.x - s.x, dy = porteur.y - s.y, d = hyp(dx, dy);
      const devant = Math.abs(plier(Math.atan2(dy, dx) - s.cap)) < 0.7;
      // Dans son dos et près de lui : on ne fonce pas (la charge par-derrière, c'est deux minutes), on se colle et on harponne.
      const dansSonDos = (dx * Math.cos(porteur.cap) + dy * Math.sin(porteur.cap)) < 0;
      if (dansSonDos && d < 3.5) { e.x *= 0.25; e.y *= 0.25; }
      // Le harpon à portée, de face ; la mise en échec de face, en fonçant — jamais par-derrière, c'est deux minutes.
      if (d < HARPON.portee + 0.3 && devant && s.harponRepos <= 0 && etat.de() < 0.5) e.tir = true;
      const vs = hyp(s.vx, s.vy) || 1e-9;
      const parDerriere = (s.vx * Math.cos(porteur.cap) + s.vy * Math.sin(porteur.cap)) / vs > 0.45;
      if (d < 2.6 && devant && !parDerriere && vs > 3 && s.elanRepos <= 0) e.echec = true;
    } else {
      const t = tempsVers(s);
      cible = { x: R.x + R.vx * Math.min(t, 2), y: R.y + R.vy * Math.min(t, 2) };
      cible = dansLaGlace(cible.x, cible.y);
      e = vers(s, cible.x, cible.y, 0.5);
    }
    return e;
  }
  // Les autres se placent : entre la rondelle et notre filet, chacun à son rang.
  const D = miens.filter(m => m.poste === 'D'), iD = D.indexOf(s);
  const notreZone = u(R.x) < -BLEUE;
  let cible;
  if (iD >= 0) {
    const cote = iD === 0 ? -1 : 1;
    cible = { x: monBut.x + (R.x - monBut.x) * (notreZone ? 0.45 : 0.6), y: R.y * 0.4 + cote * 2.5 };
    if (u(cible.x) < -(LIGNE_BUT - 2.5)) cible.x = -a * (LIGNE_BUT - 2.5);
  } else {
    const role = s.poste === 'AG' ? -1 : s.poste === 'AD' ? 1 : 0;
    // Un adversaire à couvrir : le plus proche non couvert de mon côté, sinon le poste.
    const libres = adv.filter(o => o !== porteur && (role === 0 || Math.sign(o.y || role) === role));
    let marque = null, dm = Infinity;
    for (const o of libres) {
      const d = hyp(o.x - s.x, o.y - s.y);
      if (d < dm && d < 14) { dm = d; marque = o; }
    }
    if (marque && notreZone) cible = { x: marque.x + (monBut.x - marque.x) * 0.15, y: marque.y + (monBut.y - marque.y) * 0.15 };
    else if (role === 0) cible = { x: monBut.x + (R.x - monBut.x) * 0.7, y: R.y * 0.6 };
    else cible = { x: a * (u(R.x) - 4), y: role * 7 };
  }
  cible = dansLaGlace(cible.x, cible.y);
  return espacer(s, miens, vers(s, cible.x, cible.y), 2.2, adv.filter(o => o !== porteur));
}
