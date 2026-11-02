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
 *   la mise en jeu        le centre presse le bouton autour de la chute, à un hasard près (`MISE`), le bâton vers le
 *                         coéquipier où il veut l'envoyer : son défenseur le plus souvent, sinon l'ailier de la bande
 *   les tirs de barrage   le tireur fonce et lance de l'enclave (le tir de punition pareil)
 *   l'avantage numérique  le parapluie ; en désavantage, la boîte
 *   les défenseurs        reculent face au porteur qui descend sur eux ; ne se laissent jamais déborder : entre
 *                         l'attaquant le plus avancé et leur filet, à un écart qui grandit avec sa vitesse (`duBonCote`) ;
 *                         celui qui chasse un porteur lancé le contient au lieu de foncer
 *   le turbo              le porteur fonce quand la glace devant lui est libre, tant que ses jambes tiennent
 *   la sortie de zone     (2 nov. 2026) le défenseur qui la reprend derrière son filet attend que les siens se placent,
 *                         puis passe à l'ailier sur la bande ou au centre qui revient au milieu (`SORTIE`) ; pressé et
 *                         sans personne d'ouvert, il la dégage le long de la bande vers son ailier
 *   le hors-jeu           (2 nov. 2026) le bras levé, on attend dehors hors de portée de la rondelle (on « tague » la
 *                         bleue) ; pas de passe dans la zone depuis l'extérieur ; on cueille à la bleue du dehors
 *   l'attaque construite  la bleue bouchée devant lui, le porteur la lance au fond, dans le coin le moins gardé, et les
 *                         siens courent après (`FOND`) ; dans le coin, pressé, il la remonte le long de la bande au
 *                         coéquipier qui l'attend en haut (le cycle) ; un joueur fait l'écran devant le gardien, sur la
 *                         ligne du tir (`ECRAN_D`), et tient son bâton quand le tir part (la déviation)
 *
 * Pur : les mêmes entrées sur la même graine rendent les mêmes décisions (le hasard vient de `etat.de`). Le moteur
 * la rappelle quelques fois par seconde ; ce qu'elle doit se rappeler vit sur le patineur (`s.memo`).
 */
import { LIGNE_BUT, BLEUE, BATON, HARPON, PATIN, W, surGlace, autre, lame } from './physique.js';

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
/*
 * LA BLEUE SANS LA DÉPASSER (JP : *trop de hors-jeu*) : un patineur lancé vers la bleue ne s'arrête pas sur un dix
 * cents. La limite qu'il vise recule de sa distance de freinage (sa vitesse vers la zone, au carré, sur deux fois
 * `FREIN_BLEUE`, le frein que l'IA se donne, un peu sous celui des lames) : il freine à temps, sans entrer avant la rondelle.
 */
const FREIN_BLEUE = 12;   // m/s²
const PASSE_VIVE = 3;     // m/s : plus lente, une passe est une rondelle libre, qu'on chasse
const HORS_PORTEE = BATON.lame[0] + PATIN.portee + 0.3;   // m : plus loin que ça de la rondelle, la lame ne la touche pas
/* Un coéquipier de `s` (autre que `sauf`) déjà dans la zone d'attaque : y faire entrer la rondelle serait un hors-jeu. */
const unDesNotresDedans = (s, miens, a, sauf = null) => miens.some(m => m !== s && m !== sauf && m.x * a > BLEUE + 0.25);
const avantLaBleue = (s, a, marge) => BLEUE - marge - Math.max(0, s.vx * a) ** 2 / (2 * FREIN_BLEUE);
const dansLaGlace = (x, y) => ({ x: clamp(x, -(LIGNE_BUT - 1), LIGNE_BUT - 1), y: clamp(y, -(W / 2 - 1.2), W / 2 - 1.2) });

/* Le couloir d'un lancer ou d'une passe est-il ouvert ? Aucun adversaire à moins de `marge` de la ligne, passé le premier mètre. */
function couloirOuvert(x0, y0, x1, y1, adv, marge = 1.2, jusqua = 1, depuis = 0.08) {
  const dx = x1 - x0, dy = y1 - y0, d2 = dx * dx + dy * dy || 1e-9;
  for (const o of adv) {
    const u = ((o.x - x0) * dx + (o.y - y0) * dy) / d2;
    if (u < depuis || u > jusqua) continue;
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
/* À l'échec avant 2-1-2, les défenseurs tiennent la bleue en dedans : une rondelle dégagée s'y arrête, gardée dans la zone. */
const PINCE_BLEUE = 0.8;   // m
/* À l'attaque, les défenseurs aux pointes, à ça en dedans de la bleue : une passe d'une pointe à l'autre reste dans la zone. */
const POINTE_D = 2.2;      // m
/*
 * LA SORTIE DE ZONE (2 nov. 2026 ; JP : *dix joueurs qui courent*) : le défenseur qui reprend la rondelle derrière son
 * filet, sans personne sur lui à `attenteLibre` m, l'y garde `attente` s, le temps que les siens se placent ; il passe
 * ensuite au coéquipier ouvert (personne à `ouvert` m) devant lui, l'ailier sur la bande (|y| au-delà de `largeBande`,
 * +`bande`) ou le centre qui revient au milieu (+`centre`) ; pressé à moins de `presse` m, sans personne d'ouvert, il
 * la dégage le long de la bande vers son ailier, même couvert (au fond, un dégagement refusé), et au fond s'il est en
 * désavantage (permis).
 */
export const SORTIE = { attente: 0.8, attenteLibre: 5, ouvert: 3, largeBande: 7, bande: 0.6, centre: 0.5, presse: 2.2 };
/*
 * LE LANCER AU FOND (le dump-and-chase) : de leur moitié (pas de dégagement refusé), la bleue bouchée — `bouchee`
 * adversaires ou plus devant lui, à `couloir` m de son couloir, de `avant` m avant leur bleue à `dedans` m dedans —
 * personne des siens dans la zone : il la lance au fond, dans le coin le moins gardé, `part` fois sur cent par décision.
 */
const FOND = { bouchee: 2, couloir: 7, avant: 3, dedans: 6, part: 0.35 };
/* L'ÉCRAN : le joueur au filet se tient sur la ligne de la rondelle au gardien, à `distance` m devant lui. */
export const ECRAN_D = { distance: 1.9, prof: 1.1, large: 2.5 };
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

  if (porteur === s) { if (!(memo.dernierePossession > etat.t - 0.1)) memo.dernierePrise = etat.t; memo.dernierePossession = etat.t; }

  // LA MISE EN JEU : le centre presse autour de la chute, le bâton vers où il l'envoie ; les autres attendent.
  if (etat.mej) {
    if (etat.mej.centres[eq] !== s.id) return { x: 0, y: 0 };
    return miseEnJeu(etat, s, memo, a, miens);
  }

  // LE HORS-JEU DIFFÉRÉ contre nous : on ressort de la zone, vite, et personne n'y entre tant que le bras est levé.
  if (M && M.horsJeuDiffere === eq && porteur !== s) {
    // on ressort en contournant la rondelle : la toucher dedans, c'est le sifflet ; on s'écarte d'elle, et de sa route
    if (u(s.x) > BLEUE - 0.6) {
      const e = vers(s, a * (BLEUE - 2), s.y, 0.5);
      let dx = s.x - R.x, dy = s.y - R.y, d = hyp(dx, dy) || 1;
      const vr = hyp(R.vx, R.vy);
      if (vr > 2) {
        // le point de sa route le plus près de moi, dans la seconde qui vient
        const t = clamp((-dx * -R.vx + -dy * -R.vy) / (vr * vr), 0, 1);
        dx = s.x - (R.x + R.vx * t); dy = s.y - (R.y + R.vy * t); d = hyp(dx, dy) || 1;
      }
      if (d < 5) { e.x += dx / d * (5 - d) * 0.5; e.y += dy / d * (5 - d) * 0.5; const m = hyp(e.x, e.y); if (m > 1) { e.x /= m; e.y /= m; } }
      return e;
    }
    // … et on attend à la bleue que la zone se vide (on « tague » la bleue), hors de portée de la rondelle : la lame
    // devant soi, la prise porte à `HORS_PORTEE` de son corps.
    if (u(R.x) > BLEUE) return vers(s, a * (BLEUE - HORS_PORTEE), clamp(R.y, -8, 8), 1);
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
  // NOTRE TIR EN ROUTE : celui qui est au filet tient sa place, le bâton sur la glace (la déviation, le retour).
  const tirEnRoute = !porteur && R.dernier && R.dernier.equipe === eq && R.dernier.tir && hyp(R.vx, R.vy) > 12;
  if (tirEnRoute && u(s.x) > LIGNE_BUT - 6 && Math.abs(s.y) < 4) return { x: 0, y: 0, tir: true };
  if (porteur && porteur.equipe === eq) return soutenir(etat, s, a, but, u, miens, adv, porteur);
  // UNE PASSE DES NÔTRES EN ROUTE : le receveur va la chercher ; les autres prennent déjà leur poste autour de lui, au
  // lieu de foncer tous sur la rondelle (JP : *le positionnement des joueurs*). Ratée (elle file ailleurs ou meurt), on chasse.
  const receveur = !porteur && R.passeVers ? miens.find(m => m.id === R.passeVers) : null;
  const enRoute = receveur && hyp(R.vx, R.vy) > PASSE_VIVE && (receveur.x - R.x) * R.vx + (receveur.y - R.y) * R.vy > 0;
  if (enRoute && receveur !== s) return soutenir(etat, s, a, but, u, miens, adv, receveur);
  return defendre(etat, s, memo, a, but, monBut, u, miens, adv, porteur);
}

/*
 * LA MISE EN JEU de l'IA : la même que la tienne — le bouton A au moment qu'elle croit être la chute, à `ecart` s près
 * (un dé, avant ou après), le bâton vers le coéquipier qu'elle vise : un défenseur derrière elle `versD` fois sur
 * cent, sinon l'ailier du côté de la bande. Une fois par mise en jeu ; le moteur fait le reste (`MEJ`).
 */
const MISE = { ecart: 0.15, versD: 0.75 };
function miseEnJeu(etat, s, memo, a, miens) {
  const M = etat.mej, P = M.point;
  if (memo.mejPour !== M) {
    memo.mejPour = M;
    memo.mejT = (2 * etat.de() - 1) * MISE.ecart;
    const autres = miens.filter(m => m !== s);
    const D = autres.filter(m => m.poste === 'D'), F = autres.filter(m => m.poste !== 'D');
    const bande = Math.sign(P.y) || 1;
    // le défenseur le plus près de l'axe derrière le point ; l'ailier le plus près de la bande
    const derriere = m => Math.abs(m.y - P.y) - (P.x - m.x) * a * 0.5;
    const versD = etat.de() < MISE.versD;
    const cible = (versD && D.length ? D.slice().sort((p, q) => derriere(p) - derriere(q))[0] : F.slice().sort((p, q) => (q.y - p.y) * bande)[0]) || autres[0];
    const dx = cible ? cible.x - P.x : -a, dy = cible ? cible.y - P.y : 0, d = hyp(dx, dy) || 1;
    memo.mejX = dx / d; memo.mejY = dy / d;
  }
  return { x: memo.mejX, y: memo.mejY, passe: -M.reste >= memo.mejT };
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
  // LA SORTIE DE ZONE, de notre zone.
  if (u(s.x) < -BLEUE) {
    const r = sortieDeZone(etat, s, memo, a, u, miens, adv, pression);
    if (r) return r;
  }
  // LE CYCLE : dans le coin, pressé, sans tir, on la remonte le long de la bande au coéquipier qui attend en haut.
  const enCoin = u(s.x) > LIGNE_BUT - 6 && Math.abs(s.y) > 4.5;
  if (enCoin && pression < 3.5) {
    const haut = miens.find(m => m !== s && m.auSol <= 0 && Math.sign(m.y) === Math.sign(s.y) && Math.abs(m.y) > 5 && u(m.x) < u(s.x) - 2.5 && u(m.x) > BLEUE + 1
      && Math.min(Infinity, ...adv.map(o => hyp(o.x - m.x, o.y - m.y))) > 2 && couloirOuvert(R.x, R.y, m.x, m.y, adv, 1.1));
    if (haut) return passerA(memo, s, haut);
  }
  // PASSER ? La transversale pour le tir sur réception, un coéquipier ouvert et bien placé (de notre zone, la sortie
  // a déjà choisi : pas de passe forcée).
  let meilleur = null, score = 0.6;
  for (const m of u(s.x) < -BLEUE ? [] : miens) {
    if (m === s || m.auSol > 0) continue;
    const d = hyp(m.x - s.x, m.y - s.y);
    if (d < 3 || d > 28) continue;
    const ouvert = Math.min(Infinity, ...adv.map(o => hyp(o.x - m.x, o.y - m.y))) > 2.2;
    const ligne = couloirOuvert(R.x, R.y, m.x, m.y, adv, 1.3);
    if (!ligne) continue;
    const avance = u(m.x) - u(s.x);
    // La rondelle hors de la zone (la passe part de la lame : c'est elle qui compte), pas de passe à qui est déjà dedans,
    // ni à qui y sera quand elle arrivera (la passe est menée : elle entrerait après lui), ni vers la bleue quand un
    // coéquipier est dedans (ratée, elle y glisserait : le hors-jeu différé).
    const mene = u(m.x + m.vx * d / BATON.passe * 0.8);
    const versLaBleue = (m.x - s.x) * a > 0 && mene > BLEUE - 6 && unDesNotresDedans(s, miens, a, m);
    const horsJeu = Math.min(u(R.x), u(lame(s).x)) < BLEUE && (u(m.x) > BLEUE + 0.2 || mene > BLEUE - 1 || versLaBleue);
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
  // LE LANCER AU FOND quand la bleue est bouchée : dans le coin le moins gardé, puis la course.
  const devantLaBleue = u(s.x) > 0.5 && u(s.x) < BLEUE - 0.5;
  const bouchee = adv.filter(o => u(o.x) > u(s.x) && u(o.x) > BLEUE - FOND.avant && u(o.x) < BLEUE + FOND.dedans && Math.abs(o.y - s.y) < FOND.couloir).length >= FOND.bouchee;
  if (devantLaBleue && bouchee && !enDesavantage && !unDesNotresDedans(s, miens, a) && etat.de() < FOND.part) {
    const gardes = c => adv.filter(o => Math.sign(o.y) === c && u(o.x) > BLEUE).length;
    const coin = gardes(-1) < gardes(1) ? -1 : gardes(1) < gardes(-1) ? 1 : (Math.sign(s.y) || 1);
    const r = lancerVers(memo, s, { x: a * (LIGNE_BUT + 1.5), y: coin * (W / 2 - 2) });
    if (r) return r;
  }
  // PATINER : vers le filet par le côté le plus libre ; derrière le filet, on ressort devant.
  let cible;
  // Un coéquipier déjà dans la zone : on n'entre pas (le hors-jeu), on tient la bleue le long de la bande le temps qu'il
  // ressorte. C'est la rondelle qui compte, pas le porteur : reprise juste hors de la zone, on ressort avec elle.
  const unDedans = u(R.x) < BLEUE && u(R.x) > BLEUE - 6 && miens.some(m => m !== s && u(m.x) > BLEUE + 0.25);
  // La lame est devant lui : c'est elle, pas son corps, qui doit rester hors de la zone.
  if (unDedans) cible = { x: a * Math.min(BLEUE - 1.5 - BATON.lame[0], avantLaBleue(s, a, 1 + BATON.lame[0])), y: Math.sign(s.y || 1) * 9 };
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
  if (libreDevant && s.jambes > 40 && u(s.x) > -BLEUE && !unDedans) e.sprint = true;
  return e;
}
/* Une passe à `m` : le bâton vers lui. */
function passerA(memo, s, m) {
  const dx = m.x - s.x, dy = m.y - s.y, d = hyp(dx, dy) || 1;
  memo.dirX = dx / d; memo.dirY = dy / d;
  return { x: dx / d, y: dy / d, passe: true };
}
/*
 * Un lancer vers un point, hors de la zone d'attaque (là, le tir part où pointe le bâton) : un tir du poignet, à condition
 * que le point soit dans ce que le bâton peut viser de son cap (`BATON.visee`) ; sinon rien, il tourne d'abord.
 */
function lancerVers(memo, s, cible) {
  const dx = cible.x - s.x, dy = cible.y - s.y, d = hyp(dx, dy) || 1;
  if (Math.abs(plier(Math.atan2(dy, dx) - s.cap)) > BATON.visee) return null;
  memo.tir = { reste: 0.03, x: dx / d, y: dy / d };
  memo.dirX = dx / d; memo.dirY = dy / d;
  return { x: dx / d, y: dy / d, tir: true };
}
/* La sortie de zone (`SORTIE`) : attendre derrière le filet, la passe à l'ailier sur la bande ou au centre, le dégagement. */
function sortieDeZone(etat, s, memo, a, u, miens, adv, pression) {
  const R = etat.rondelle;
  const derriere = u(s.x) < -(LIGNE_BUT - 0.3);
  if (memo.sortiePour !== memo.dernierePrise) { memo.sortiePour = memo.dernierePrise; memo.sortieT = etat.t; }
  let meilleur = null, score = 0;
  for (const m of miens) {
    if (m === s || m.auSol > 0) continue;
    const avance = u(m.x) - u(s.x);
    if (avance < 1.5 || u(m.x) > 0) continue;
    const ouvert = Math.min(Infinity, ...adv.map(o => hyp(o.x - m.x, o.y - m.y)));
    // le couloir ouvert dès la lame : un adversaire tout près de lui sur la ligne coupe la passe aussi
    if (ouvert < SORTIE.ouvert || !couloirOuvert(R.x, R.y, m.x, m.y, adv, 1.4, 1, 0)) continue;
    const sc = 0.2 * Math.min(ouvert, 6) + (Math.abs(m.y) > SORTIE.largeBande ? SORTIE.bande : 0) + (m.poste === 'C' && Math.abs(m.y) < 5 ? SORTIE.centre : 0)
      + 0.03 * avance - 0.02 * hyp(m.x - s.x, m.y - s.y);
    if (sc > score) { score = sc; meilleur = m; }
  }
  // Derrière son filet, libre : il attend que les siens se placent.
  if (derriere && pression > SORTIE.attenteLibre && etat.t - memo.sortieT < SORTIE.attente) return { x: 0, y: 0 };
  if (meilleur) return passerA(memo, s, meilleur);
  if (pression >= SORTIE.presse) return null;
  // Pressé, personne d'ouvert : le dégagement le long de la bande, vers l'ailier de ce côté même couvert (la passe
  // soulevée passe le bâton) ; en désavantage, le dégagement est permis : au fond.
  const cote = Math.sign(s.y) || 1;
  const ailier = miens.find(m => m !== s && m.poste !== 'D' && Math.sign(m.y) === cote && Math.abs(m.y) > 4 && u(m.x) > u(s.x) + 2);
  if (ailier) return passerA(memo, s, ailier);
  const M = etat.match, enDesavantage = M && M.penalites.filter(p => p.equipe === s.equipe).length > M.penalites.filter(p => p.equipe !== s.equipe).length;
  if (enDesavantage) return lancerVers(memo, s, { x: a * 1, y: cote * (W / 2 - 0.8) });
  return null;
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
  let cible, ecran = null;
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
      const auCoin = !derriereFilet && u(porteur.x) > LIGNE_BUT - 6 && Math.abs(porteur.y) > 4.5;
      ecran = posteEcran(etat, s.equipe, a, R);
      // LA SURCHARGE : un au filet, un bas du côté de la rondelle, un dans l'enclave haute ; le défenseur fort à sa pointe,
      // l'autre qui glisse vers le milieu de la bleue. AU FILET : deux devant le gardien, un haut, les défenseurs aux pointes.
      // LE CYCLE, le porteur au coin : un à l'écran, un en haut de la bande de son côté (il l'attend), un dans l'enclave haute.
      const postesF = derriereFilet
        ? [{ x: but.x - a * 3, y: -cp * 2 }, { x: but.x - a * 6.5, y: cp * 1.5 }, { x: a * (BLEUE + 3.5), y: -cp * 4 }]
        : auCoin
          ? [ecran, { x: but.x - a * 8, y: cp * 9.5 }, { x: but.x - a * 8.5, y: -cp * 2 }]
          : st.attaque === 'filet'
            ? [ecran, { x: but.x - a * 2.2, y: -Math.sign(ecran.y || cp) * 1.4 }, { x: but.x - a * 7, y: -cp * 1.5 }]
            : [ecran, { x: but.x - a * 4, y: cp * 6 }, { x: but.x - a * 7.5, y: cp * 1.5 }];
      const postesD = st.attaque === 'filet'
        ? [{ x: a * (BLEUE + POINTE_D), y: -6.5 }, { x: a * (BLEUE + POINTE_D), y: 6.5 }]
        : [{ x: a * (BLEUE + POINTE_D), y: cp * 6.5 }, { x: a * (BLEUE + POINTE_D), y: -cp * 2 }];
      const Fs = miens.filter(m => m !== porteur && m.poste !== 'D');
      // L'ÉCRAN D'ABORD : l'avant le plus près de la ligne du tir y va, les autres se partagent le reste.
      const auFiletF = postesF[0] === ecran ? Fs.slice().sort((p, q) => hyp(p.x - ecran.x, p.y - ecran.y) - hyp(q.x - ecran.x, q.y - ecran.y))[0] : null;
      if (s.poste === 'D') cible = posteDe(s, miens.filter(m => m !== porteur && m.poste === 'D'), postesD);
      else if (auFiletF) cible = auFiletF === s ? ecran : posteDe(s, Fs.filter(m => m !== auFiletF), postesF.slice(1));
      else cible = posteDe(s, Fs, postesF);
    } else if (notreZone) {
      // LA SORTIE DE ZONE : le centre qui revient bas, au milieu ; les ailiers sur la bande, à la hauteur des cercles.
      const postesF = [{ x: -a * (LIGNE_BUT - 7), y: -c * 1.5 }, { x: -a * (BLEUE + 3), y: -(W / 2 - 2.4) }, { x: -a * (BLEUE + 3), y: W / 2 - 2.4 }];
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
  if (!enZone) { const lim = avantLaBleue(s, a, 0.8); if (u(cible.x) > lim) cible.x = a * lim; }
  // LES DÉFENSEURS, même à l'attaque, restent du bon côté de l'adversaire qui traîne haut : celui du côté fort peut
  // pincer de quelques mètres, l'autre reste le dernier homme.
  if (s.poste === 'D') {
    const D = miens.filter(m => m.poste === 'D' && m !== porteur);
    const fort = D.slice().sort((p, q) => hyp(p.x - R.x, p.y - R.y) - hyp(q.x - R.x, q.y - R.y))[0] === s && D.length > 1;
    cible = duBonCote(cible, a, u, adv, fort ? strategieDe(etat, s.equipe).pince : 1);
  }
  if (s.poste !== 'D' && F.length <= 2 && s.poste === 'C' && enZone) cible = { x: but.x - a * 6, y: 0 };
  const auFilet = !!ecran && cible === ecran;
  cible = dansLaGlace(cible.x, cible.y);
  // À l'écran, on se bat pour sa place : on ne contourne pas les défenseurs devant le filet.
  const e = espacer(s, miens, vers(s, cible.x, cible.y), 2.2, auFilet ? [] : adv);
  // Le tir sur réception : une passe vient vers moi dans l'enclave, le bâton est prêt ; devant le filet, la déviation aussi.
  if ((R.passeVers === s.id || hyp(but.x - s.x, but.y - s.y) < 5) && hyp(but.x - s.x, but.y - s.y) < 14 && u(s.x) > BLEUE) e.tir = true;
  return e;
}

/* `s` est-il, parmi les avants de `groupe`, le plus près du poste de l'écran ? */
function plusPresDuFilet(etat, s, groupe, a) {
  const ecran = posteEcran(etat, s.equipe, a, etat.rondelle);
  const F = groupe.filter(m => m.poste !== 'D');
  return F.length > 0 && F.slice().sort((p, q) => hyp(p.x - ecran.x, p.y - ecran.y) - hyp(q.x - ecran.x, q.y - ecran.y))[0] === s;
}
/* L'écran : sur la ligne de la rondelle au gardien adverse, à `ECRAN_D.distance` devant lui, hors du demi-cercle. */
function posteEcran(etat, eq, a, R) {
  const Gd = etat.gardiens.find(g => g.equipe !== eq);
  const gx = Gd && !Gd.retire ? Gd.x : a * LIGNE_BUT, gy = Gd && !Gd.retire ? Gd.y : 0;
  const dx = R.x - gx, dy = R.y - gy, d = hyp(dx, dy) || 1;
  return { x: a * Math.min((gx + dx / d * ECRAN_D.distance) * a, LIGNE_BUT - ECRAN_D.prof), y: clamp(gy + dy / d * ECRAN_D.distance, -ECRAN_D.large, ECRAN_D.large) };
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
  // La rondelle libre dans leur zone, à nous en dernier : le deuxième chasseur, s'il est l'avant le plus près du filet,
  // y va plutôt (le retour, l'écran) ; le premier chasse toujours.
  const attaqueLibre = !porteur && R.dernier && R.dernier.equipe === s.equipe && u(R.x) > BLEUE;
  const versLeFilet = attaqueLibre && rang === 1 && s.poste !== 'D' && plusPresDuFilet(etat, s, miens, a);
  const chasse = desavantage ? (rang === 0 && (dansLeCarre || !porteur)) : (rang === 0 || (!porteur && rang === 1 && !versLeFilet));
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
      // À notre bleue d'attaque, un coéquipier encore dedans : on la cueille du dehors, sans la ramener dans la zone.
      if (u(R.x) <= BLEUE && u(cible.x) > BLEUE - 4 && unDesNotresDedans(s, miens, a)) cible.x = a * Math.min(u(cible.x), BLEUE - 1.2);
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
        ? [{ x: a * (u(R.x) - 2.5), y: -c * 3.5 }, { x: a * (BLEUE + 3), y: 0 }, { x: a * (BLEUE + PINCE_BLEUE), y: -6 }, { x: a * (BLEUE + PINCE_BLEUE), y: 6 }]
        : st.echecAvant === '1-3-1'
          ? [{ x: a * 1.5, y: -7 }, { x: a * 1.5, y: 7 }, { x: a * 1, y: 0 }, { x: -a * (BLEUE - 1), y: 0 }]
          : [{ x: a * (BLEUE + 1.5), y: -c * 6 }, { x: a * (BLEUE + 1.5), y: c * 6 }, { x: a * (BLEUE - 7), y: -5.5 }, { x: a * (BLEUE - 7), y: 5.5 }];
      const D2 = miensSans.filter(m => m.poste === 'D'), F2 = miensSans.filter(m => m.poste !== 'D');
      const hauts = postes.slice(0, 2), bas = postes.slice(2);
      cible = s.poste === 'D' ? posteDe(s, D2, D2.length > bas.length ? [...bas, ...hauts] : bas) : posteDe(s, F2, F2.length > hauts.length ? [...hauts, ...bas] : hauts);
      // LA RONDELLE LIBRE, À NOUS EN DERNIER (un tir, un retour, une passe ratée) : on attaque encore, un avant qui ne
      // chasse pas va au filet, sur la ligne du tir (le retour, l'écran).
      if (!porteur && R.dernier && R.dernier.equipe === s.equipe && s.poste !== 'D' && (versLeFilet || plusPresDuFilet(etat, s, F2, a))) {
        cible = posteEcran(etat, s.equipe, a, R); memo.auFilet = etat.t;
      }
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
  // LE HORS-JEU, aussi sans la rondelle : elle est sortie de leur zone, on en sort aussi (on se remet en jeu), pour
  // pouvoir y revenir avec elle ; sinon, la reprendre à la bleue, c'est un hors-jeu.
  if (u(R.x) <= BLEUE) { const lim = avantLaBleue(s, a, 0.8); if (u(cible.x) > lim) cible = { x: a * lim, y: cible.y }; }
  // LES DÉFENSEURS ne se laissent pas déborder : entre l'attaquant le plus avancé et notre filet, l'écart selon sa vitesse.
  if (iD >= 0 && !desavantage) cible = duBonCote(cible, a, u, adv);
  cible = dansLaGlace(cible.x, cible.y);
  const e = espacer(s, miens, vers(s, cible.x, cible.y, 1), 2.2, memo.auFilet === etat.t ? [] : adv.filter(o => o !== porteur));
  if (memo.auFilet === etat.t && hyp(but.x - s.x, but.y - s.y) < 5) e.tir = true;   // le bâton sur la glace : la déviation
  // LE DÉFENSEUR RECULE face au porteur qui descend sur lui, quand il est près : il va vers son filet, le cap tenu vers
  // la rondelle. Loin, il se retourne et patine de face, plus vite, pour garder son écart.
  if (iD >= 0 && porteur && u(porteur.x) < u(s.x) + 7 && u(porteur.x) > u(s.x) - 1 && e.x * -a > 0.3) e.recul = true;
  return e;
}
