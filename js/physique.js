/**
 * SUR GLACE — LA PHYSIQUE ET LES RÈGLES (31 oct. 2026). JP : *faire un jeu 2D avec une physique crédible, pas refaire
 * un jeu de 30 ans* ; puis *avoir toutes les mécaniques de hockey*. Le match vu de haut, joué à la manette, où la glace
 * se SENT : la rondelle glisse et meurt, la bande rend, le patineur a de l'inertie et un rayon de virage, une mise en
 * échec est une collision avec des masses. Et tout ce qu'un match de hockey a : deux vrais clubs de vrais joueurs,
 * leurs trios et leurs paires qui se fatiguent et changent, la passe à un coéquipier, le changement de joueur, la mise
 * en jeu, le hors-jeu, le dégagement refusé, les punitions et l'avantage numérique (la punition à retardement comprise),
 * le harponnage, la mise en échec et ses punitions, l'horloge, les périodes qui changent de côté, la prolongation à
 * trois contre trois, les tirs de barrage.
 *
 * Rien ici ne lit l'écran : des mètres, des secondes, des kilogrammes, un pas de temps fixe (`PAS`, 120 par seconde)
 * et un hasard semé (`de`, de la graine). Les mêmes entrées sur la même graine rejouent le même match, en Node comme
 * au navigateur — `check_physique` le prouve, et chaque chiffre d'en bas s'y mesure. Les neuf autres patineurs sont
 * joués par js/glace-ia.js, une fonction pure que le match reçoit (`ia`), jamais importée d'ici.
 *
 * CE QUE « CRÉDIBLE » VEUT DIRE, EN CHIFFRES (tous ici, et nulle part ailleurs ; `reglesDeLaGlace` les dit) :
 *   - la rondelle pèse 170 g, roule à un frottement de 0,10 sur la glace (≈ 1 m/s perdu par seconde) ; la bande
 *     rend 55 % de la vitesse normale, le coin est un arc de 28 pieds, le poteau rend 70 %, le filet arrête tout ;
 *   - le patineur pèse ce que la LNH lui donne (85 kg sans donnée), pousse à 8 m/s², file à 38 km/h, freine à 9 ;
 *     ses lames mordent de côté (`grip`), mais pas au-delà de `adherence` m/s² : cinq mètres de rayon à pleine
 *     vitesse. ARCADE (JP : *joueur trop lent ; penser à une physique arcade plus NHL 94*) : la physique reste la
 *     même, ses chiffres penchent vers la console — la pointe en deux secondes et demie, le demi-tour sur un dix
 *     cents, la roue libre qui dure (NHL 94), le tir qui vise le filet (`assist`, `large`) ;
 *   - la mise en échec est une collision entre deux masses ; celui qui a le moins d'élan tombe si l'écart
 *     dépasse `CHUTE.seuil` kg·m/s ; frapper qui n'a pas la rondelle, ou par-derrière, c'est deux minutes ;
 *   - le gardien voit la rondelle avec 150 ms de retard, bouge à 5 m/s au plus, couvre 1,0 m de large.
 *
 * LES VRAIS JOUEURS (JP : *avoir toutes les mécaniques*) : un club, c'est un alignement de js/sim.js (`autoRoster`), et
 * ses cotes sur 20 deviennent des paramètres physiques (`parametresDuPatineur`, `parametresDuGardien`) : la cote
 * générale fait la pointe et la poussée, Tir la vitesse et la précision du lancer, Jeu la passe, Défense le harpon,
 * Robustesse l'équilibre ; le poids de la LNH fait la masse ; les Arrêts du gardien font son retard et sa largeur.
 * Aucune cote neuve : c'est ce que le moteur de la saison lit déjà, dit en mètres par seconde.
 *
 * Le moteur de la saison (js/sim.js) reste le moteur des matchs du jeu : celui-ci joue UNE glace, à la main.
 */
import { LONGUEUR, LARGEUR } from './glace.js';
import { entierDeGraine } from './sim.js';

const PIED = 0.3048;
/* La patinoire, en mètres : 200 × 85 pieds, les coins arrondis à 28 pieds. */
export const L = LONGUEUR * PIED;            // 60,96
export const W = LARGEUR * PIED;             // 25,91
export const COIN = 28 * PIED;               // 8,53
export const LIGNE_BUT = L / 2 - 11 * PIED;  // 27,13 : la ligne de but, à 3,35 m de la bande
export const BLEUE = 25 * PIED;              // 7,62 : la ligne bleue, de part et d'autre du centre
/* Les points de mise en jeu de la zone, ceux de la zone neutre, et le rayon des cercles. */
export const POINT = { x: L / 2 - 31 * PIED, y: 22 * PIED, r: 15 * PIED, neutre: BLEUE - 5 * PIED };
export const FILET = { large: 6 * PIED, profond: 44 / 12 * PIED, haut: 4 * PIED, poteau: 0.03, enclave: 6 * PIED };   // `haut` : la barre horizontale, 1,22 m

const PAS = 1 / 120;
const G = 9.81;

export const RONDELLE = { masse: 0.17, rayon: 0.038, frottement: 0.15, bande: 0.55, poteau: 0.70, filet: 0.10, rebondSol: 0.35, vitre: 2.3 };   // `frottement` à 0.15 : la rondelle roule moins loin, les passes ne glissent pas à l'infini (JP : *snappy*) ; `vitre` : plus haut que ça contre la bande, la rondelle sort du jeu
export const PATIN = {
  masse: 85, rayon: 0.55,   // un peu plus gros que nature (JP : *joueur plus gros un peu*) : il se voit, il se frappe
  vMax: 10.6,       // la vitesse de pointe, m/s (38 km/h)
  accel: 14,        // la poussée, m/s² : réactif comme NHL 94 (JP, 1er nov. : *mouvement plus snappy*)
  frein: 18,        // l'arrêt, m/s² : un arrêt hockey en moins d'une demi-seconde
  glisse: 3.5,      // la roue libre, m/s² : le bâton lâché, on glisse trois secondes (arcade, entre NHL 94 et le réel) ; en poussant, les lames ne perdent rien
  grip: 15,         // la morsure des lames de côté : la vitesse en travers s'éteint à ce taux, par seconde (15 : le patineur dérive un peu, comme sur la vraie glace)
  adherence: 26,    // l'accélération latérale que les lames tiennent, m/s² : le rayon de virage, c'est v² / adherence (4 m à pleine vitesse)
  pivot: 16,        // le virage sur place, rad/s : réactif au doigt et à la manette
  portee: 1.9,      // la rondelle plus loin que ça de la lame est perdue (JP : *que la puck colle un peu plus aux bâtons*)
  virage: 0.03,     // le prix d'un virage : la part de vitesse perdue par radian tourné (couper sec coûte, un peu)
  croise: 1.25,     // les croisés : la poussée bonifiée quand on tourne à vitesse moyenne
  recul: 0.8,       // à reculons, la pointe et la poussée valent ça du droit
  sprint: 1.18,     // le turbo (le bouton tenu avec la rondelle) : la pointe et la poussée, au prix des jambes
  sprintJambes: 4,  // × l'usure des jambes pendant le turbo
  bande: 0.15,      // ce que le patineur rend sur la bande
  sol: 1.4,         // le temps au sol après une chute, s
};
export const BATON = {
  lame: [1.0, 0.0],          // où la lame tient la rondelle : un mètre devant, dans l'axe (les sprites en miroir gardent la rondelle à la lame)
  ressort: 130, amorti: 24,  // la rondelle suit la lame comme un ressort amorti (critique), serré : elle colle
  maniement: 75,             // l'accélération que la lame peut donner à la rondelle, m/s² : au-delà, elle traîne
  passe: 16,                 // la passe, m/s (58 km/h) : plus loin, plus fort (`passeLoin`)
  passeLoin: 0.4,            // ce qu'un mètre de plus ajoute à la passe, m/s, jusqu'à `passeMax`
  passeMax: 24,
  tirMin: 24, tirMax: 42,    // le tir, du poignet au lancer frappé chargé, m/s (86 à 151 km/h)
  charge: 0.45,              // le temps de charge d'un lancer frappé, s
  ecart: 0.025,              // l'écart-type de la visée, rad, plus à pleine charge
  visee: 0.6,                // le bâton vise jusqu'à ça de côté du cap, rad
  assist: 1.5,               // (V1 : le seuil d'angle pour la visée assistée ; V2, 1er nov. : le tir part TOUJOURS vers le filet, le bâton choisit le coin)
  large: 0.4,                // le bâton à fond de côté vise ça au-delà du poteau : on peut rater le filet, comme dans FIFA, m
  reception: 25,             // une rondelle qui arrive plus vite que ça ne se prend pas : elle dévie (25 m/s = 90 km/h)
  lachee: 0.25,              // après un tir ou une passe, la lame la laisse filer ce temps-là
  uneTemps: 0.9,             // le tir sur réception part à cette part du lancer frappé, sans charger
  hauteurMin: 1.2, hauteurMax: 4.2,   // la montée du lancer, m/s : le poignet reste bas, le frappé chargé monte aux coins du haut
  ecartHauteur: 0.6,         // l'écart-type de la montée, m/s (plus à pleine charge) : par-dessus la barre, ça arrive
  soulevee: 2.8,             // la passe soulevée (saucer) : sa montée, m/s, quand un bâton barre la ligne (40 cm au plus haut, par-dessus une lame)
  deviation: 0.12,           // l'écart d'une déviation volontaire vers le filet, rad
};
export const GARDIEN = {
  reaction: 0.15, vMax: 5, accel: 14, demi: 0.5, profondeur: 0.3,
  trous: { haut: 0.35, cinq: 0.2, corps: 0.03 },   // ce qui passe quand même : le coin du haut (la mitaine, le bloqueur), entre les jambières, sur le corps
  sortie: 1.1,       // à combien devant la ligne il défie, m
  couvre: 0.5,       // la part des arrêts gelés ; l'autre part rebondit
  rebond: 0.35,      // ce qu'un rebond garde de la vitesse
};
export const CHUTE = { seuil: 300, bande: 1.5 };   // l'écart d'élan, kg·m/s, au-delà duquel le moins lancé des deux tombe ; contre la bande, le coup pèse plus
export const HARPON = { duree: 0.25, portee: 2.2, largeur: 0.55, repos: 0.7, pousse: 5, trebuche: 0.04 };   // le harponnage : un coup de bâton devant soi ; raté sur le porteur, un sur vingt-cinq l'accroche
const ECHEC = { duree: 0.35, repos: 1.2, accel: 2, vMax: 1.15, derriere: 0.8, recent: 1.0 };   // l'élan d'une mise en échec ; par-derrière et sur qui n'a pas la rondelle, c'est puni
const JAMBES = { usure: 1.8, repos: 6, changement: 55, presence: 45 };   // la fatigue d'une présence : ce qu'elle coûte par seconde, ce que le banc rend, quand on change
const TAMPON = 0.10;   // le tampon d'entrée, s : un appui de passe ou de tir dans cette fenêtre avant la prise compte quand même
export const MATCH = {
  periode: 180, prolongation: 120, surglace: 5, surglaceOT: 3, rondesFusillade: 3, retraitGardien: 90, tirDePunition: 12,
  punition: 120, mej: 0.9, pauses: { but: 2.5, gel: 1.2, horsjeu: 1.2, degagement: 1.2, punition: 1.5, periode: 3, fin: 0 },
};

/* ---------- les outils ---------- */
const hyp = Math.hypot;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const plier = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
/* Un générateur semé (mulberry32) : la graine du match, hachée comme partout ailleurs. */
function generateur(graine) {
  let a = entierDeGraine(graine) || 1;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const gauss = de => Math.sqrt(-2 * Math.log(1 - de())) * Math.cos(2 * Math.PI * de());
export const autre = eq => (eq === 'A' ? 'B' : 'A');

/* La lame d'un patineur : devant lui, un peu de côté. */
export function lame(s) {
  const c = Math.cos(s.cap), n = Math.sin(s.cap);
  return { x: s.x + c * BATON.lame[0] - n * BATON.lame[1], y: s.y + n * BATON.lame[0] + c * BATON.lame[1] };
}

/* ---------- les vrais joueurs → des paramètres physiques ---------- */
/*
 * Les cotes sur 20 (js/niveaux.js, `axes20` et `cote20`) deviennent des mètres par seconde. Rien de neuf : la cote
 * générale (le niveau), Tir, Jeu, Défense, Robustesse, et le poids de la LNH. Sans cote (un joueur qui a peu joué),
 * un patineur ordinaire (10).
 */
export function parametresDuPatineur({ cote = 10, tir = 10, jeu = 10, defense = 10, robustesse = 10, poidsLb = null, vitesse = false } = {}) {
  // Les cotes se sentent (JP, 1er nov. : *que les stats des joueurs aient un impact*) : ±17 % de pointe et de poussée entre un 1 et un 20, ±20 % de lancer.
  const f = 0.84 + 0.018 * (cote - 1);
  return {
    vMax: PATIN.vMax * f * (vitesse ? 1.05 : 1),
    accel: PATIN.accel * f,
    tir: 0.8 + 0.02 * tir,                // × la vitesse du lancer
    precision: 1.4 - 0.04 * tir,          // × l'écart de la visée
    passe: 1.5 - 0.04 * jeu,              // × l'écart de la passe
    defense: defense / 20,                // le harpon
    masse: poidsLb ? poidsLb * 0.4536 : PATIN.masse,
    equilibre: 0.7 + 0.03 * robustesse,   // × le seuil de chute
    agilite: 1 + (85 - (poidsLb ? poidsLb * 0.4536 : PATIN.masse)) / 150,   // un petit tourne plus court : × l'adhérence et le pivot
  };
}
/* La difficulté : ce que le club de l'IA vaut de plus ou de moins (JP : *toutes les mécaniques*). */
export const DIFFICULTES = { facile: 0.93, normal: 1, difficile: 1.07 };
export function parametresDuGardien({ arrets = 10 } = {}) {
  return { reaction: 0.21 - 0.004 * arrets, demi: 0.42 + 0.005 * arrets, vMax: GARDIEN.vMax };
}

/* ---------- l'état ---------- */
function patineur(id, equipe, x, y, cap, extra = {}) {
  const p = extra.p || parametresDuPatineur();
  return {
    id, equipe, poste: extra.poste || 'C', nom: extra.nom || id, visage: extra.visage || null, ligne: extra.ligne ?? 0,
    x, y, vx: 0, vy: 0, cap, masse: p.masse, rayon: PATIN.rayon, p,
    auSol: 0, charge: 0, lachee: 0, tenaitTir: false, tenaitPasse: false, tenaitEchec: false,
    harpon: 0, harponRepos: 0, elan: 0, elanRepos: 0, jambes: 100, surGlace: true, boxe: false, touche: -10, tamponPasse: -1, tamponTir: -1,
    poste0: extra.poste0 || null, ia: null, stats: { buts: 0, aides: 0, tirs: 0, echecs: 0, blocs: 0, tg: 0 },
  };
}
function gardienNeuf(equipe, sens, extra = {}) {
  const p = extra.p || parametresDuGardien();
  return { equipe, sens, nom: extra.nom || 'le gardien', visage: extra.visage || null, p, x: sens * (LIGNE_BUT - GARDIEN.sortie), y: 0, vx: 0, vy: 0, memoire: [], retire: false, arrets: 0 };
}

/**
 * LE TERRAIN DE JEU (l'entraînement) : toi à gauche du centre, la rondelle au centre, un plot (un adversaire qui ne
 * fait que se tenir debout, pour sentir la mise en échec) dans la zone, et le gardien dans son filet, à droite.
 */
export function nouvelleGlace(graine = 'glace') {
  const gardien = gardienNeuf('B', 1);
  const etat = {
    mode: 'entrainement', graine, de: generateur(graine), t: 0, reste: 0, ia: null, humains: ['A'], controles: { A: 'toi', B: null }, changeTenu: {},
    rondelle: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, porteur: null, dernier: null, passeDe: null, passeVers: null },
    patineurs: [
      patineur('toi', 'A', -6, 0, 0),
      patineur('plot', 'B', LIGNE_BUT - 12, -4.5, Math.PI, { poste0: { x: LIGNE_BUT - 12, y: -4.5 } }),
    ],
    gardiens: [gardien],
    equipes: { A: { attaque: 1, nom: 'Toi', tag: 'TOI' }, B: { attaque: -1, nom: 'Le plot', tag: 'EUX' } },
    compte: { tirs: 0, buts: 0, arrets: 0, poteaux: 0, echecs: 0 },
    arret: null, dernierTir: 0,
    match: null, mej: null, enJeu: true,
  };
  etat.gardien = gardien;
  return etat;
}

/**
 * UN MATCH : deux clubs. `club` = { nom, tag, patineurs: [{ id, nom, visage, poste: 'AG'|'C'|'AD'|'D', ligne, p }],
 * gardien: { nom, visage, p } }. Les trois trios et les deux paires, dans l'ordre des lignes. `humain` : 'A' (toi),
 * ou null (deux IA, pour mesurer). `ia` : la fonction de js/glace-ia.js. `regles` : { horsjeu, degagement }.
 */
export function nouveauMatch({ graine = 'match', A, B, periode = MATCH.periode, prolongation = MATCH.prolongation, humain = 'A', humains = null, ia = null, regles = {}, series = false, difficulte = 'normal' } = {}) {
  const quiJoue = humains || (humain ? [humain] : []);
  const etat = {
    mode: 'match', graine, de: generateur(graine), t: 0, reste: 0, ia, humains: quiJoue, controles: { A: null, B: null }, changeTenu: {},
    rondelle: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, porteur: null, dernier: null, passeDe: null, passeVers: null },
    patineurs: [], gardiens: [], equipes: {},
    compte: { tirs: 0, buts: 0, arrets: 0, poteaux: 0, echecs: 0 },
    arret: null, dernierTir: 0, enJeu: false, mej: null,
    regles: { horsjeu: regles.horsjeu !== false, degagement: regles.degagement !== false },
    match: {
      periode: 1, duree: periode, reste: periode, dureeOT: prolongation, prolongation: false, series: !!series, fini: false, vainqueur: null,
      pointage: { A: 0, B: 0 }, tirs: { A: 0, B: 0 }, echecs: { A: 0, B: 0 }, mej: { A: 0, B: 0 }, pim: { A: 0, B: 0 }, blocs: { A: 0, B: 0 },
      penalites: [], enAttente: null, horsJeuDiffere: null, fusillade: null, ronde: null, tirDePunition: null, journal: [], touches: { A: [], B: [] }, etoiles: [],
    },
  };
  const f = DIFFICULTES[difficulte] || 1;
  for (const [eq, club] of [['A', A], ['B', B]]) {
    const attaque = eq === 'A' ? 1 : -1;
    const E = { attaque, nom: club.nom || eq, tag: club.tag || eq, lignes: { F: [[], [], []], D: [[], []] }, enPoste: { F: 0, D: 0 }, presence: 0 };
    // La difficulté pèse sur le club que l'IA joue seule.
    const force = quiJoue.includes(eq) ? 1 : f;
    club.patineurs.forEach((j, k) => {
      const p0 = j.p || parametresDuPatineur();
      const p = force === 1 ? p0 : { ...p0, vMax: p0.vMax * force, accel: p0.accel * force, tir: p0.tir * force, precision: p0.precision / force };
      const s = patineur(j.id != null ? `${eq}:${j.id}` : `${eq}:${k}`, eq, -attaque * 5, 0, attaque > 0 ? 0 : Math.PI,
        { poste: j.poste, nom: j.nom, visage: j.visage, ligne: j.ligne || 0, p });
      s.surGlace = false;
      etat.patineurs.push(s);
      const groupe = j.poste === 'D' ? 'D' : 'F';
      const li = E.lignes[groupe][Math.min(j.ligne || 0, E.lignes[groupe].length - 1)];
      li.push(s.id);
    });
    etat.equipes[eq] = E;
    const pg0 = (club.gardien && club.gardien.p) || parametresDuGardien();
    const pg = force === 1 ? pg0 : { ...pg0, reaction: pg0.reaction / (force * force), demi: pg0.demi * force };
    etat.gardiens.push(gardienNeuf(eq, -attaque, { nom: club.gardien && club.gardien.nom, visage: club.gardien && club.gardien.visage, p: pg }));
  }
  for (const eq of ['A', 'B']) habiller(etat, eq);
  arreter(etat, 'debut', { x: 0, y: 0 }, 0.5);
  return etat;
}

const gardienDe = (etat, eq) => etat.gardiens.find(g => g.equipe === eq) || etat.gardiens[0];
export const surGlace = (etat, eq) => etat.patineurs.filter(s => s.equipe === eq && s.surGlace);
const parId = (etat, id) => etat.patineurs.find(s => s.id === id);
const penalisesDe = (etat, eq) => etat.match.penalites.filter(p => p.equipe === eq).length;
/* Combien de patineurs une équipe a droit sur la glace : cinq, trois en prolongation, moins ses punis, trois au moins. */
export function droitSurGlace(etat, eq) {
  const base = etat.match.prolongation && !etat.match.series ? MATCH.surglaceOT : MATCH.surglace;
  const sixieme = gardienDe(etat, eq).retire ? 1 : 0;
  return Math.max(3, base - penalisesDe(etat, eq)) + sixieme;
}
/*
 * RETIRER LE GARDIEN (un sixième attaquant) : il va au banc tout de suite, le patineur le plus reposé du banc saute sur
 * la glace ; remis, il revient dans son filet à l'arrêt de jeu suivant. L'IA le fait d'elle-même en fin de match quand
 * elle tire de l'arrière (`MATCH.retraitGardien` secondes), et le remet si elle revient à égalité.
 */
export function retirerGardien(etat, eq, oui) {
  const Gd = gardienDe(etat, eq);
  if (!etat.match || Gd.retire === oui) return;
  Gd.retire = oui;
  if (oui) {
    Object.assign(Gd, { x: (eq === 'A' ? -1 : 1) * 8, y: W / 2 + 1.2, vx: 0, vy: 0 });
    const banc = etat.patineurs.filter(s => s.equipe === eq && !s.surGlace && !s.boxe).sort((a, b) => b.jambes - a.jambes)[0];
    if (banc) { banc.surGlace = true; banc.x = (eq === 'A' ? -1 : 1) * 8; banc.y = W / 2 - 1; banc.vx = 0; banc.vy = 0; banc.cap = -Math.PI / 2; }
  }
}

/* ---------- l'alignement : qui est sur la glace ---------- */
/*
 * HABILLER à un arrêt de jeu : le trio et la paire en poste, moins les punis, au nombre permis. Le changement de
 * ligne se fait ici, quand la ligne en poste est fatiguée (`JAMBES.changement`) ou a assez joué (`presence`) :
 * la suivante entre, la plus reposée d'abord.
 */
function habiller(etat, eq) {
  const E = etat.equipes[eq];
  const moyenne = ids => ids.reduce((a, id) => a + parId(etat, id).jambes, 0) / Math.max(1, ids.length);
  let change = false;
  for (const g of ['F', 'D']) {
    const lignes = E.lignes[g].filter(l => l.length);
    if (lignes.length < 2) continue;
    const actuelle = E.lignes[g][E.enPoste[g]];
    if (moyenne(actuelle) < JAMBES.changement || E.presence > JAMBES.presence) {
      let meilleure = E.enPoste[g];
      for (let k = 0; k < E.lignes[g].length; k++) if (E.lignes[g][k].length && moyenne(E.lignes[g][k]) > moyenne(E.lignes[g][meilleure])) meilleure = k;
      if (meilleure !== E.enPoste[g]) { E.enPoste[g] = meilleure; change = true; }
    }
  }
  const droit = droitSurGlace(etat, eq);
  const boxe = new Set(etat.match.penalites.map(p => p.id));
  const F = E.lignes.F[E.enPoste.F].filter(id => !boxe.has(id)), D = E.lignes.D[E.enPoste.D].filter(id => !boxe.has(id));
  // Le nombre permis : à cinq, 3 F + 2 D ; à quatre, 2 F + 2 D ; à trois, 2 F + 1 D.
  const nF = droit >= 5 ? 3 : 2, nD = droit - nF;
  const ordreF = ['C', 'AG', 'AD'];
  const choisis = [
    ...F.slice().sort((a, b) => ordreF.indexOf(parId(etat, a).poste) - ordreF.indexOf(parId(etat, b).poste)).slice(0, nF),
    ...D.slice(0, nD),
  ];
  // Il manque du monde (les lignes trop courtes, les punis) : on complète avec les plus reposés du banc.
  if (choisis.length < droit) {
    const banc = etat.patineurs.filter(s => s.equipe === eq && !choisis.includes(s.id) && !boxe.has(s.id)).sort((a, b) => b.jambes - a.jambes);
    for (const s of banc) { if (choisis.length >= droit) break; choisis.push(s.id); }
  }
  for (const s of etat.patineurs) if (s.equipe === eq && !s.boxe) s.surGlace = choisis.includes(s.id);
  if (change) E.presence = 0;
}

/* ---------- la patinoire : la bande, les coins, le filet ---------- */
export function bander(o, r, rest) {
  const X = L / 2, Y = W / 2;
  let choc = 0;
  if (Math.abs(o.x) > X - COIN && Math.abs(o.y) > Y - COIN) {
    const cx = Math.sign(o.x) * (X - COIN), cy = Math.sign(o.y) * (Y - COIN);
    const dx = o.x - cx, dy = o.y - cy, d = hyp(dx, dy) || 1e-9;
    if (d > COIN - r) {
      const nx = dx / d, ny = dy / d;
      o.x = cx + nx * (COIN - r); o.y = cy + ny * (COIN - r);
      const vn = o.vx * nx + o.vy * ny;
      if (vn > 0) { o.vx -= (1 + rest) * vn * nx; o.vy -= (1 + rest) * vn * ny; choc = vn; }
    }
    return choc;
  }
  if (o.x > X - r) { o.x = X - r; if (o.vx > 0) { choc = o.vx; o.vx = -o.vx * rest; } }
  else if (o.x < -X + r) { o.x = -X + r; if (o.vx < 0) { choc = -o.vx; o.vx = -o.vx * rest; } }
  if (o.y > Y - r) { o.y = Y - r; if (o.vy > 0) { choc = Math.max(choc, o.vy); o.vy = -o.vy * rest; } }
  else if (o.y < -Y + r) { o.y = -Y + r; if (o.vy < 0) { choc = Math.max(choc, -o.vy); o.vy = -o.vy * rest; } }
  return choc;
}

/* Un cercle contre un cercle fixe (un poteau, le gardien). Rend la vitesse d'approche perdue (0 si rien n'a touché). */
function contreCercle(o, r, cx, cy, cr, rest) {
  const dx = o.x - cx, dy = o.y - cy, d = hyp(dx, dy) || 1e-9;
  if (d >= cr + r) return 0;
  const nx = dx / d, ny = dy / d;
  o.x = cx + nx * (cr + r); o.y = cy + ny * (cr + r);
  const vn = o.vx * nx + o.vy * ny;
  if (vn < 0) { o.vx -= (1 + rest) * vn * nx; o.vy -= (1 + rest) * vn * ny; return -vn; }
  return 0;
}

/* LE FILET, vu par la rondelle : deux poteaux ronds sur la ligne de but, deux côtés et un fond qui ne rendent presque rien. Ouvert devant. */
function contreFilet(o, r, etat, ev) {
  for (const s of [1, -1]) {
    const xb = s * LIGNE_BUT, xf = s * (LIGNE_BUT + FILET.profond), demi = FILET.large / 2;
    for (const yp of [-demi, demi]) {
      if (contreCercle(o, r, xb, yp, FILET.poteau, RONDELLE.poteau) > 3) { etat.compte.poteaux++; ev.push({ type: 'poteau' }); }
    }
    const dedansX = s > 0 ? (o.x > xb && o.x < xf) : (o.x < xb && o.x > xf);
    const devantFond = s > 0 ? o.x < xf : o.x > xf;
    if (dedansX && Math.abs(o.y) > demi && Math.abs(o.y) - r < demi) {
      o.y = Math.sign(o.y) * (demi + r);
      if (Math.sign(o.vy) !== Math.sign(o.y)) o.vy = -o.vy * RONDELLE.filet;
    }
    if (!devantFond && Math.abs(o.y) < demi + r && Math.abs(o.x - xf) < r) {
      o.x = xf + s * r;
      if (s > 0 ? o.vx < 0 : o.vx > 0) o.vx = -o.vx * RONDELLE.filet;
    }
  }
}

/* Le filet, vu par un patineur : une boîte pleine, on la contourne. */
function patineurContreFilet(s) {
  for (const sg of [1, -1]) {
    const x0 = Math.min(sg * LIGNE_BUT, sg * (LIGNE_BUT + FILET.profond)), x1 = Math.max(sg * LIGNE_BUT, sg * (LIGNE_BUT + FILET.profond));
    const demi = FILET.large / 2;
    const px = clamp(s.x, x0, x1), py = clamp(s.y, -demi, demi);
    const dx = s.x - px, dy = s.y - py, d = hyp(dx, dy);
    if (d >= s.rayon || d === 0) continue;
    const nx = dx / d, ny = dy / d;
    s.x = px + nx * s.rayon; s.y = py + ny * s.rayon;
    const vn = s.vx * nx + s.vy * ny;
    if (vn < 0) { s.vx -= vn * nx; s.vy -= vn * ny; }
  }
}

/* ---------- le patineur ---------- */
const formeDe = s => 0.88 + 0.12 * clamp(s.jambes, 0, 100) / 100;   // la fatigue pèse peu (JP, 1er nov. : *ou pas de fatigue*) : au pire 12 % de moins
/*
 * PATINER. Le bâton (le stick de la manette) dit où on VEUT aller ; le corps suit avec son inertie :
 *   - le cap tourne vers le bâton, au plus `pivot` rad/s à l'arrêt, et de moins en moins vite à mesure que la
 *     vitesse monte (les lames ne tiennent que `adherence` m/s² de côté) ;
 *   - on pousse dans le sens du cap, d'autant moins que le bâton en est loin ; charger un tir coûte la moitié ;
 *     l'élan d'une mise en échec pousse plus fort ; les jambes fatiguées poussent moins ;
 *   - le bâton à l'envers, lancé, c'est le frein ;
 *   - la vitesse en travers du cap s'éteint (`grip`), mais pas d'un coup : au virage serré, ça dérive.
 */
function patiner(s, e, enJeu) {
  if (s.auSol > 0) {
    s.auSol -= PAS;
    const v = hyp(s.vx, s.vy);
    if (v > 0) { const f = Math.max(0, v - 4 * PAS) / v; s.vx *= f; s.vy *= f; }
    s.charge = 0;
    s.x += s.vx * PAS; s.y += s.vy * PAS;
    return;
  }
  const forme = formeDe(s);
  const recul = !!(e && e.recul);
  const sprint = !!(e && e.sprint && s.jambes > 5);
  const vMax = s.p.vMax * forme * (s.elan > 0 ? ECHEC.vMax : 1) * (recul ? PATIN.recul : 1) * (sprint ? PATIN.sprint : 1);
  const accel = s.p.accel * forme * (s.elan > 0 ? ECHEC.accel : 1) * (recul ? PATIN.recul : 1) * (sprint ? PATIN.sprint : 1);
  const agilite = s.p.agilite || 1;
  const v = hyp(s.vx, s.vy);
  const m = e && enJeu ? Math.min(1, hyp(e.x || 0, e.y || 0)) : 0;
  let pousse = 0, omega = 0;
  if (m > 0.1) {
    const phi = Math.atan2(e.y, e.x);
    // À RECULONS : on regarde à l'opposé de là où l'on va (le défenseur face au porteur), et l'on pousse dans le bâton.
    const d = plier((recul ? phi + Math.PI : phi) - s.cap);
    if (!recul && Math.abs(d) > 2.1 && v > 1.2) {
      const f = Math.max(0, v - PATIN.frein * m * PAS) / v;
      s.vx *= f; s.vy *= f;
      s.cap += clamp(d, -1, 1) * PAS;
    } else {
      const omegaMax = Math.min(PATIN.pivot * agilite, PATIN.adherence * agilite / Math.max(v, 0.5));
      omega = clamp(d * 6, -omegaMax, omegaMax);
      s.cap += omega * PAS;
      pousse = accel * m * Math.max(0, Math.cos(d)) * (s.charge > 0 ? 0.5 : 1);
      // LES CROISÉS : en tournant à vitesse moyenne, on pousse plus fort que tout droit.
      if (Math.abs(omega) > 0.4 && v > 2 && v < 0.9 * vMax) pousse *= PATIN.croise;
      const sens = recul ? phi : s.cap;
      s.vx += Math.cos(sens) * pousse * PAS; s.vy += Math.sin(sens) * pousse * PAS;
    }
  }
  const v2 = hyp(s.vx, s.vy);
  if (v2 > 0) {
    // LE PRIX DU VIRAGE : couper sec coûte de la vitesse (les carres mordent, l'énergie part dans la glace).
    // La glisse s'estompe avec la poussée (m) au lieu de tomber d'un coup : la transition est douce.
    const dec = PATIN.glisse * (1 - m) + PATIN.accel * (v2 / vMax) ** 2 + Math.abs(omega) * PATIN.virage * v2;
    const f = Math.max(0, v2 - dec * PAS) / v2;
    s.vx *= f; s.vy *= f;
  }
  const c = Math.cos(s.cap), n = Math.sin(s.cap);
  const avant = s.vx * c + s.vy * n;
  const travers = (-s.vx * n + s.vy * c) * Math.exp(-PATIN.grip * PAS);
  s.vx = avant * c - travers * n; s.vy = avant * n + travers * c;
  s.cap = plier(s.cap);
  s.x += s.vx * PAS; s.y += s.vy * PAS;
  // Les jambes : une présence coûte, d'autant plus qu'on pousse, et le turbo quatre fois plus. Le temps de glace se compte.
  if (enJeu) { s.jambes = Math.max(0, s.jambes - JAMBES.usure * (0.4 + 0.6 * m) * (sprint ? PATIN.sprintJambes : 1) * PAS); s.stats.tg += PAS; }
}

/* Le plot : il retourne à son poste, à petite vitesse, et fait face au centre. */
function entreeDuPlot(s) {
  if (!s.poste0) return null;
  const dx = s.poste0.x - s.x, dy = s.poste0.y - s.y, d = hyp(dx, dy);
  if (d < 0.3) return { x: 0, y: 0 };
  return { x: dx / d * 0.35, y: dy / d * 0.35 };
}

/*
 * LA MISE EN ÉCHEC : deux cercles qui se chevauchent se repoussent, l'élan s'échange (restitution 0,2), et le
 * moins lancé des deux tombe si l'écart d'élan dépasse le seuil, pesé par son équilibre. Celui qui tombe lâche la
 * rondelle. En match, frapper qui n'a pas la rondelle (ni ne l'a eue depuis une seconde), c'est l'obstruction ;
 * frapper par-derrière, c'est la charge : deux minutes (`punir`).
 */
function collisions(etat, ev) {
  const P = etat.patineurs.filter(s => s.surGlace);
  for (const s of P) for (const g of etat.gardiens) contreCercle(s, s.rayon, g.x, g.y, 0.45, 0.1);
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy) || 1e-9;
    const min = a.rayon + b.rayon;
    if (d >= min) continue;
    const nx = dx / d, ny = dy / d;
    const tot = a.masse + b.masse;
    a.x -= nx * (min - d) * b.masse / tot; a.y -= ny * (min - d) * b.masse / tot;
    b.x += nx * (min - d) * a.masse / tot; b.y += ny * (min - d) * a.masse / tot;
    const qa = a.masse * Math.max(0, a.vx * nx + a.vy * ny);
    const qb = b.masse * Math.max(0, -(b.vx * nx + b.vy * ny));
    const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    // La vitesse et la direction de chacun AVANT l'échange : c'est ce qui dit la force du coup et d'où il vient.
    const avantA = { vx: a.vx, vy: a.vy }, avantB = { vx: b.vx, vy: b.vy };
    if (vrel < 0) {
      const jn = -(1 + 0.2) * vrel / (1 / a.masse + 1 / b.masse);
      a.vx -= jn * nx / a.masse; a.vy -= jn * ny / a.masse;
      b.vx += jn * nx / b.masse; b.vy += jn * ny / b.masse;
    }
    const ecart = qa - qb;
    if (Math.abs(ecart) <= CHUTE.seuil * 0.8) continue;
    const frappeur = ecart > 0 ? a : b, frappe = ecart > 0 ? b : a;
    if (frappeur.equipe === frappe.equipe && etat.mode === 'match') continue;   // deux coéquipiers qui se rentrent dedans : rien
    // Un même contact ne compte qu'une fois : une demi-seconde entre deux chocs des mêmes deux corps.
    if (frappeur.choc && frappeur.choc.sur === frappe.id && etat.t - frappeur.choc.t < 0.5) continue;
    frappeur.choc = { sur: frappe.id, t: etat.t };
    const elanAvant = frappeur === a ? avantA : avantB;
    const vf = hyp(elanAvant.vx, elanAvant.vy) || 1e-9;
    // Contre la bande, le coup pèse plus : le corps n'a nulle part où aller.
    const contreLaBande = Math.abs(frappe.x) > L / 2 - 1.6 || Math.abs(frappe.y) > W / 2 - 1.6;
    const poids = Math.abs(ecart) * (contreLaBande ? CHUTE.bande : 1);
    const fort = poids > CHUTE.seuil * frappe.p.equilibre && vf > 4;
    ev.push({ type: 'echec', fort, qui: frappeur.id, sur: frappe.id });
    etat.compte.echecs++;
    if (etat.match && fort) { etat.match.echecs[frappeur.equipe]++; frappeur.stats.echecs++; }
    if (fort) {
      if (frappe.auSol <= 0) frappe.auSol = PATIN.sol * (contreLaBande ? 1.3 : 1);
      if (etat.rondelle.porteur === frappe.id) { etat.rondelle.porteur = null; frappe.lachee = BATON.lachee; etat.rondelle.dernier = { equipe: frappe.equipe, id: frappe.id, t: etat.t, x: etat.rondelle.x, lance: false }; }
    }
    // UNE PUNITION NE TOMBE QUE SUR UNE CHARGE VOULUE (JP : *ya trop de pénalités, c'est non stop*) : le bouton d'élan
    // pressé, le coup qui renverse ; jamais sur une collision de course. Sur qui n'a pas la rondelle et n'est pas dans
    // la bataille pour elle, l'obstruction ; par-derrière, la charge (contre la bande, la charge contre la bande).
    if (fort && etat.match && !etat.match.ronde && frappeur.elan > 0) {
      // Par-derrière : le frappeur arrive dans le dos du frappé (sa position, projetée sur le cap du frappé).
      const dd = hyp(frappe.x - frappeur.x, frappe.y - frappeur.y) || 1e-9;
      const parDerriere = ((frappe.x - frappeur.x) * Math.cos(frappe.cap) + (frappe.y - frappeur.y) * Math.sin(frappe.cap)) / dd > ECHEC.derriere;
      const loinDeLaRondelle = hyp(frappe.x - etat.rondelle.x, frappe.y - etat.rondelle.y) > 3;
      const sansRondelle = etat.rondelle.porteur !== frappe.id && etat.t - frappe.touche > ECHEC.recent && loinDeLaRondelle;
      if (parDerriere) punir(etat, frappeur, contreLaBande ? 'charge contre la bande' : 'charge par-derrière', ev);
      else if (sansRondelle) punir(etat, frappeur, 'obstruction', ev);
    }
  }
}

/* ---------- le harpon ---------- */
/*
 * LE HARPONNAGE : un coup de bâton devant soi (`HARPON.duree`), qui dégage la rondelle d'un porteur adverse ou libre
 * dans sa zone (un couloir de `portee` sur `largeur`), selon sa Défense contre le Jeu du porteur. Sur un corps sans
 * rondelle, un sur six fait trébucher : deux minutes.
 */
function harponner(etat, s, ev) {
  const R = etat.rondelle;
  const c = Math.cos(s.cap), n = Math.sin(s.cap);
  const dansLeCouloir = (x, y) => { const u = (x - s.x) * c + (y - s.y) * n, v = -(x - s.x) * n + (y - s.y) * c; return u > 0.3 && u < HARPON.portee && Math.abs(v) < HARPON.largeur; };
  const porteur = R.porteur ? parId(etat, R.porteur) : null;
  const notrePasse = !porteur && R.passeDe && parId(etat, R.passeDe) && parId(etat, R.passeDe).equipe === s.equipe;
  if (dansLeCouloir(R.x, R.y) && R.z < 0.4 && (!porteur || porteur.equipe !== s.equipe) && !notrePasse) {
    const chance = porteur ? clamp(0.5 + (s.p.defense - (1.4 - porteur.p.passe) / 0.03 / 20) * 0.6, 0.25, 0.85) : 1;
    if (etat.de() < chance) {
      if (porteur) { R.porteur = null; porteur.lachee = 0.4; }
      R.vx = c * HARPON.pousse + (etat.de() - 0.5) * 3; R.vy = n * HARPON.pousse + (etat.de() - 0.5) * 3;
      toucher(etat, s, false);
      s.lachee = 0.2;
      ev.push({ type: 'harpon', qui: s.id });
    } else if (porteur && etat.de() < HARPON.trebuche && (porteur.x - s.x) * Math.cos(porteur.cap) + (porteur.y - s.y) * Math.sin(porteur.cap) > 0) {
      // Le harpon rate, par-derrière, et accroche les patins du porteur : il tombe, deux minutes ; sur une échappée, un tir de punition.
      porteur.auSol = PATIN.sol * 0.8;
      if (etat.match && !etat.match.ronde) {
        if (enEchappee(etat, porteur)) accorderTirDePunition(etat, porteur, s, ev);
        else punir(etat, s, 'avoir fait trébucher', ev);
      }
    }
    s.harpon = 0;
  }
}
/* Une échappée : le porteur dans la moitié adverse, aucun adversaire entre lui et le filet (le gardien à part). */
function enEchappee(etat, porteur) {
  const a = etat.equipes[porteur.equipe].attaque;
  if (porteur.x * a < 0) return false;
  return !etat.patineurs.some(o => o.surGlace && o.equipe !== porteur.equipe && o.x * a > porteur.x * a - 1);
}

/* ---------- la rondelle ---------- */
function toucher(etat, s, lance) {
  etat.rondelle.dernier = { equipe: s.equipe, id: s.id, t: etat.t, x: etat.rondelle.x, lance };
  s.touche = etat.t;
  if (!etat.match) return;
  const M = etat.match;
  // LA PUNITION À RETARDEMENT tombe au moment où les fautifs touchent la rondelle (JP, 1er nov. : elle n'attendait que l'arrêt de jeu suivant).
  if (M.enAttente && M.enAttente.equipe === s.equipe && !etat.arret) { const p = M.enAttente; M.enAttente = null; appliquerPunition(etat, p); }
  const T = M.touches;
  T[autre(s.equipe)] = [];   // l'autre équipe perd son fil
  const mien = T[s.equipe];
  if (!mien.length || mien[mien.length - 1].id !== s.id) mien.push({ id: s.id, t: etat.t });
  if (mien.length > 4) mien.shift();
}

function rondelle(etat, entrees, ev) {
  const R = etat.rondelle;
  const porteur = R.porteur ? parId(etat, R.porteur) : null;
  const avantX = R.x;
  if (porteur) {
    porteur.touche = etat.t;
    R.z = 0; R.vz = 0;
    const lm = lame(porteur);
    const dx = lm.x - R.x, dy = lm.y - R.y;
    let ax = BATON.ressort * dx - BATON.amorti * (R.vx - porteur.vx);
    let ay = BATON.ressort * dy - BATON.amorti * (R.vy - porteur.vy);
    const a = hyp(ax, ay);
    if (a > BATON.maniement) { ax *= BATON.maniement / a; ay *= BATON.maniement / a; }
    R.vx += ax * PAS; R.vy += ay * PAS;
    R.x += R.vx * PAS; R.y += R.vy * PAS;
    if (hyp(lm.x - R.x, lm.y - R.y) > PATIN.portee) { R.porteur = null; porteur.lachee = BATON.lachee; toucher(etat, porteur, false); ev.push({ type: 'perdue' }); }
    if (but(etat, avantX, ev)) return;
    const e = entrees[porteur.id];
    if (e) {
      const m = hyp(e.x || 0, e.y || 0);
      const vise = m > 0.1 ? porteur.cap + clamp(plier(Math.atan2(e.y, e.x) - porteur.cap), -BATON.visee, BATON.visee) : porteur.cap;
      if (e.passe && !porteur.tenaitPasse) passer(etat, porteur, m > 0.1 ? e : null, vise, ev);
      else if (porteur.tenaitTir && !e.tir) {
        const part = Math.min(1, porteur.charge / BATON.charge);
        const v = (BATON.tirMin + (BATON.tirMax - BATON.tirMin) * part) * porteur.p.tir;
        lancer(etat, porteur, viseeAssistee(etat, porteur, vise, m > 0.1 ? e : null), v, BATON.ecart * (1 + 0.6 * part) * porteur.p.precision, 0.5,
          BATON.hauteurMin + (BATON.hauteurMax - BATON.hauteurMin) * part + gauss(etat.de) * BATON.ecartHauteur * (1 + part));
        tirer(etat, porteur, ev, part);
      }
    }
    return;
  }
  // Libre : le frottement au sol, la gravité en l'air, la bande (et la vitre), le filet.
  const v = hyp(R.vx, R.vy);
  if (v > 0 && R.z <= 0) { const f = Math.max(0, v - RONDELLE.frottement * G * PAS) / v; R.vx *= f; R.vy *= f; }
  if (R.z > 0 || R.vz > 0) {
    R.vz -= G * PAS; R.z += R.vz * PAS;
    if (R.z <= 0) { R.z = 0; R.vz = R.vz < -0.6 ? -R.vz * RONDELLE.rebondSol : 0; if (R.vz === 0) { R.vx *= 0.85; R.vy *= 0.85; } }
  }
  R.x += R.vx * PAS; R.y += R.vy * PAS;
  const choc = bander(R, RONDELLE.rayon, RONDELLE.bande);
  if (choc > 3) ev.push({ type: 'bande', v: choc });
  // Par-dessus la vitre : hors jeu, mise en jeu au point le plus près.
  if (choc > 0 && R.z > RONDELLE.vitre && etat.match && !etat.match.ronde) {
    ev.push({ type: 'vitre' });
    R.z = 0; R.vz = 0;
    arreter(etat, 'vitre', { x: Math.sign(R.x || 1) * (Math.abs(R.x) > BLEUE ? POINT.x : POINT.neutre), y: Math.sign(R.y || 1) * POINT.y }, MATCH.pauses.horsjeu);
    return;
  }
  if (R.z < FILET.haut) contreFilet(R, RONDELLE.rayon, etat, ev);
  if (but(etat, avantX, ev)) return;
  if (etat.match && degagement(etat, avantX, ev)) return;
  // Quelqu'un la prend ? À la lame, devant, si elle n'arrive pas trop vite et qu'elle est au sol ; sinon, le corps ou
  // le bâton la dévie : un coéquipier du lanceur, le bâton prêt, la redirige vers le filet ; un adversaire la bloque.
  const vol = hyp(R.vx, R.vy) > 12;
  for (const s of etat.patineurs) {
    if (!s.surGlace) continue;
    if (s.lachee > 0) { s.lachee -= PAS; continue; }
    if (s.auSol > 0) continue;
    const lm = lame(s);
    const dl = hyp(R.x - lm.x, R.y - lm.y);
    const devant = (R.x - s.x) * Math.cos(s.cap) + (R.y - s.y) * Math.sin(s.cap) > 0;
    const vrel = hyp(R.vx - s.vx, R.vy - s.vy);
    if (R.z > 1.4) continue;   // trop haut pour tout le monde
    const passeAMoi = R.passeDe && R.passeDe !== s.id && parId(etat, R.passeDe) && parId(etat, R.passeDe).equipe === s.equipe;
    const passePourMoi = R.passeVers === s.id;
    if (dl < 1.0 || (dl < PATIN.portee && devant && (vrel < 6 || passeAMoi || passePourMoi))) {
      if (vrel <= BATON.reception * (passeAMoi ? 1.5 : 1) && R.z < 0.35) {
        R.porteur = s.id; R.z = 0; R.vz = 0;
        toucher(etat, s, false);
        if (etat.humains.includes(s.equipe)) etat.controles[s.equipe] = s.id;
        ev.push({ type: 'prise', qui: s.id, passe: !!passeAMoi });
        const e = entrees[s.id];
        // LE TIR SUR RÉCEPTION (une-temps) : le bouton tenu quand la passe arrive, le lancer part tout de suite.
        const tirTenu = e && e.tir;
        const tirTampon = !tirTenu && etat.t - s.tamponTir <= TAMPON;
        if (passeAMoi && (tirTenu || tirTampon)) {
          const vise = viseeAssistee(etat, s, s.cap, hyp(e.x || 0, e.y || 0) > 0.1 ? e : null);
          lancer(etat, s, vise, BATON.tirMax * BATON.uneTemps * s.p.tir, BATON.ecart * 2.2 * s.p.precision, 0.3, BATON.hauteurMax * 0.7 + gauss(etat.de) * BATON.ecartHauteur);
          tirer(etat, s, ev, 1, true);
          s.tamponTir = -1;
        }
        // LE TAMPON DE LA PASSE : appuyée juste avant la prise, elle repart aussitôt (le une-deux).
        else if (etat.t - s.tamponPasse <= TAMPON) {
          const m = e ? hyp(e.x || 0, e.y || 0) : 0;
          const vise = m > 0.1 ? s.cap + clamp(plier(Math.atan2(e.y, e.x) - s.cap), -BATON.visee, BATON.visee) : s.cap;
          passer(etat, s, m > 0.1 ? e : null, vise, ev);
          s.tamponPasse = -1;
        }
        s.tenaitPasse = false;
        s.tamponPasse = -1; s.tamponTir = -1;
        R.passeDe = null; R.passeVers = null;
        return;
      }
      // La déviation : vers le filet pour un coéquipier du lanceur qui tient son bâton (la lame levée jusqu'à 1,2 m).
      const d = R.dernier;
      const e = entrees[s.id];
      if (vol && d && d.equipe === s.equipe && d.id !== s.id && e && e.tir && R.z < 1.2) {
        const vise = viseeAssistee(etat, s, Math.atan2(R.vy, R.vx), null) + gauss(etat.de) * BATON.deviation;
        const vt = hyp(R.vx, R.vy) * 0.8;
        R.vx = Math.cos(vise) * vt; R.vy = Math.sin(vise) * vt; R.vz = Math.max(0, R.vz) * 0.5 + 0.5;
        toucher(etat, s, true);
        s.lachee = 0.2;
        ev.push({ type: 'deviation', qui: s.id });
        return;
      }
      // La lame sur la glace la dévie si elle rase le sol (une passe soulevée passe par-dessus) ; un lancer adverse, c'est un bloc.
      if (R.z < 0.3) {
        const nx = (R.x - lm.x) / (dl || 1e-9), ny = (R.y - lm.y) / (dl || 1e-9);
        const vn = R.vx * nx + R.vy * ny;
        if (vn < 0) {
          R.vx -= 1.4 * vn * nx; R.vy -= 1.4 * vn * ny; R.vx *= 0.4; R.vy *= 0.4; R.vz = Math.min(R.vz, 0);
          bloquer(etat, s, vol, ev);
        }
        continue;
      }
    }
    // Le corps (les patins, les jambières, le tronc jusqu'à un mètre) la dévie ; un lancer adverse, c'est un bloc.
    if (R.z < 1.0 && contreCercle(R, RONDELLE.rayon, s.x, s.y, s.rayon, 0.3) > 0) bloquer(etat, s, vol, ev);
  }
}
function bloquer(etat, s, vol, ev) {
  const d = etat.rondelle.dernier;
  if (vol && d && d.tir && d.equipe !== s.equipe && etat.match) { etat.match.blocs[s.equipe]++; s.stats.blocs++; ev.push({ type: 'bloc', qui: s.id }); }
  toucher(etat, s, false);
}

/* Un tir compté : les tirs du match, le dernier tir, l'événement. */
function tirer(etat, s, ev, part, uneTemps = false) {
  etat.compte.tirs++;
  etat.rondelle.dernier.tir = true;   // un lancer au but, pas une passe : ce qu'un bloc arrête
  if (etat.match) { etat.match.tirs[s.equipe]++; s.stats.tirs++; }
  etat.dernierTir = hyp(etat.rondelle.vx, etat.rondelle.vy);
  ev.push({ type: 'tir', v: etat.dernierTir, charge: part, qui: s.id, uneTemps });
}

/* Le but : la rondelle entière passe la ligne, entre les poteaux, par devant — portée ou lancée. */
function but(etat, avantX, ev) {
  const R = etat.rondelle;
  for (const s of [1, -1]) {
    const xb = s * LIGNE_BUT;
    const entre = Math.abs(R.y) < FILET.large / 2 - RONDELLE.rayon;
    const passee = s > 0 ? (R.x - RONDELLE.rayon > xb && avantX - RONDELLE.rayon <= xb) : (R.x + RONDELLE.rayon < xb && avantX + RONDELLE.rayon >= xb);
    if (!(entre && passee)) continue;
    // LA BARRE HORIZONTALE : trop haut, la rondelle passe par-dessus ; juste à la barre, elle sonne et revient.
    if (R.z + RONDELLE.rayon > FILET.haut) {
      if (R.z - RONDELLE.rayon < FILET.haut + 0.06) { R.x = avantX; R.vx = -R.vx * RONDELLE.poteau; R.vz = -Math.abs(R.vz) * 0.5; etat.compte.poteaux++; ev.push({ type: 'poteau', barre: true }); }
      continue;
    }
    etat.compte.buts++;
    R.vx = 0; R.vy = 0; R.vz = 0; R.z = 0; R.porteur = null;
    if (!etat.match) { etat.arret = { genre: 'but', reste: 2 }; ev.push({ type: 'but', cote: s }); return true; }
    // Qui marque : l'équipe qui attaque ce filet ; un but dans son propre filet compte pour l'autre.
    const pour = etat.equipes.A.attaque === s ? 'A' : 'B';
    const d = R.dernier;
    const marqueur = d && d.equipe === pour ? d.id : null;
    marquer(etat, pour, marqueur, ev);
    return true;
  }
  return false;
}

function marquer(etat, pour, marqueur, ev) {
  const M = etat.match;
  M.pointage[pour]++;
  // Les passes décisives : les deux derniers coéquipiers à avoir touché la rondelle avant le marqueur, dans les quinze secondes.
  const aides = marqueur && !M.ronde
    ? M.touches[pour].filter(t => t.id !== marqueur && etat.t - t.t < 15).map(t => t.id).filter((id, i, l) => l.indexOf(id) === i).slice(-2).reverse()
    : [];
  M.journal.push({ t: etat.t, periode: M.periode, reste: M.reste, equipe: pour, qui: marqueur, aides, fusillade: !!M.fusillade, punition: !!M.tirDePunition });
  if (marqueur && !M.fusillade) { parId(etat, marqueur).stats.buts++; for (const a of aides) parId(etat, a).stats.aides++; }
  ev.push({ type: 'but', equipe: pour, qui: marqueur, aides });
  if (M.ronde) { finDeRonde(etat, true, ev); return; }
  // Un but en avantage numérique libère le puni qui a le moins de temps à faire ; une punition en attente contre l'autre s'annule.
  const contre = autre(pour);
  const punis = M.penalites.filter(p => p.equipe === contre).sort((a, b) => a.reste - b.reste);
  if (punis.length && penalisesDe(etat, contre) > penalisesDe(etat, pour)) liberer(etat, punis[0], ev);
  if (M.enAttente && M.enAttente.equipe === contre) M.enAttente = null;
  if (M.prolongation) { finir(etat, pour, ev); return; }
  arreter(etat, 'but', { x: 0, y: 0 }, MATCH.pauses.but);
}

/*
 * LE DÉGAGEMENT REFUSÉ : lancée de sa moitié (derrière la ligne rouge), la rondelle passe la ligne de but adverse
 * sans que personne ne l'ait touchée, et l'équipe n'est pas en désavantage : mise en jeu dans sa zone, du côté où
 * elle est passée.
 */
function degagement(etat, avantX, ev) {
  if (!etat.regles.degagement || !etat.rondelle.dernier || !etat.rondelle.dernier.lance) return false;
  const d = etat.rondelle.dernier, s = etat.equipes[d.equipe].attaque, R = etat.rondelle;
  if (d.x * s >= 0) return false;
  const passee = s > 0 ? (R.x > LIGNE_BUT && avantX <= LIGNE_BUT) : (R.x < -LIGNE_BUT && avantX >= -LIGNE_BUT);
  if (!passee || Math.abs(R.y) < FILET.large / 2 + 0.3) return false;
  if (penalisesDe(etat, d.equipe) > penalisesDe(etat, autre(d.equipe))) return false;   // en désavantage, le dégagement est permis
  ev.push({ type: 'degagement', equipe: d.equipe });
  arreter(etat, 'degagement', { x: -s * POINT.x, y: Math.sign(R.y || 1) * POINT.y }, MATCH.pauses.degagement);
  return true;
}

/*
 * LE HORS-JEU : la rondelle entre dans la zone adverse (la ligne bleue), poussée par l'équipe qui attaque, et un de
 * ses patineurs y est déjà : mise en jeu au point de la zone neutre, de ce côté. Lu à l'entrée seulement.
 */
/*
 * LE HORS-JEU, DIFFÉRÉ (1er nov. 2026 ; JP : *trop de hors-jeu*). Un attaquant déjà dans la zone quand la rondelle y
 * entre : porté dedans, c'est le sifflet ; lancé ou passé dedans, le bras se lève (`M.horsJeuDiffere`) et le jeu
 * continue — il tombe si tous les attaquants ressortent ou si la rondelle ressort, il siffle si un attaquant la
 * touche dans la zone pendant ce temps.
 */
function horsJeu(etat, avantX, ev) {
  if (!etat.regles.horsjeu || !etat.rondelle.dernier) return false;
  const R = etat.rondelle, M = etat.match;
  const siffler = (eq, fautif, genre) => {
    const s = etat.equipes[eq].attaque;
    M.horsJeuDiffere = null;
    ev.push({ type: 'horsjeu', equipe: eq, qui: fautif.id, genre });
    arreter(etat, 'horsjeu', { x: s * POINT.neutre, y: Math.sign(R.y || 1) * POINT.y }, MATCH.pauses.horsjeu);
    return true;
  };
  if (M.horsJeuDiffere) {
    const eq = M.horsJeuDiffere, s = etat.equipes[eq].attaque;
    const dedans = etat.patineurs.filter(p => p.surGlace && p.equipe === eq && p.x * s > BLEUE + 0.25);
    if (!dedans.length || R.x * s <= BLEUE) { M.horsJeuDiffere = null; ev.push({ type: 'horsjeuLeve', equipe: eq }); return false; }
    const porteur = R.porteur ? parId(etat, R.porteur) : null;
    const touche = R.dernier.equipe === eq && (R.dernier.t === etat.t || (porteur && porteur.equipe === eq));
    if (touche) return siffler(eq, dedans[0], 'touche');
    return false;
  }
  for (const eq of ['A', 'B']) {
    const s = etat.equipes[eq].attaque;
    const entre = R.x * s > BLEUE && avantX * s <= BLEUE;
    if (!entre || R.dernier.equipe !== eq) continue;
    const fautif = etat.patineurs.find(p => p.surGlace && p.equipe === eq && p.id !== R.porteur && p.x * s > BLEUE + 0.25);
    if (!fautif) continue;
    if (R.porteur && parId(etat, R.porteur).equipe === eq) return siffler(eq, fautif, 'porte');
    M.horsJeuDiffere = eq;
    ev.push({ type: 'horsjeuDiffere', equipe: eq, qui: fautif.id });
  }
  return false;
}

/*
 * LA VISÉE ASSISTÉE, COMME DANS LES JEUX DE HOCKEY ET DE SOCCER (JP : *impossible de viser et patiner* ; *je veux tir
 * comme les jeux de hockey et soccer standards*). Le bâton patine ; au moment de lâcher le tir, il dit OÙ dans le
 * filet, par rapport à la ligne rondelle-filet : droit vers le but, le centre ; penché, vers ce coin ; à fond de
 * côté, `large` au-delà du poteau — on peut rater, comme dans FIFA. Il faut que le filet ATTAQUÉ soit devant (à moins
 * de `assist` du cap) ; le dos au filet, le tir part dans le cap. La charge fait la vitesse, et écarte la visée.
 */
function viseeAssistee(etat, s, vise, baton) {
  const lm = lame(s);
  const sg = etat.equipes[s.equipe].attaque;
  const xb = sg * LIGNE_BUT;
  if ((xb - lm.x) * sg <= 0.5) return vise;   // on l'a déjà dépassé
  const dx = xb - lm.x, dy = 0 - lm.y, d = hyp(dx, dy) || 1e-9;
  // JP, 1er nov. : *tir toujours vers but* — le tir part toujours vers le filet, le bâton choisit le coin.
  const travers = baton ? clamp((-baton.x * dy + baton.y * dx) / d, -1, 1) : 0;
  const y = travers * (FILET.large / 2 + BATON.large);
  return Math.atan2(y - lm.y, xb - lm.x);
}

/* Un lancer : la rondelle part de la lame, dans la visée, à la vitesse dite plus une part de l'élan du corps. */
function lancer(etat, s, vise, v, ecart, elan, montee = 0) {
  const R = etat.rondelle;
  const ang = vise + gauss(etat.de) * ecart;
  const lm = lame(s);
  R.x = lm.x; R.y = lm.y;
  const long = s.vx * Math.cos(ang) + s.vy * Math.sin(ang);
  const vt = v + Math.max(0, long) * elan;
  R.vx = Math.cos(ang) * vt; R.vy = Math.sin(ang) * vt;
  R.z = 0.02; R.vz = Math.max(0, montee);
  R.porteur = null;
  R.passeDe = null; R.passeVers = null;
  s.lachee = BATON.lachee;
  s.charge = 0;
  toucher(etat, s, true);
}

/*
 * LA PASSE À UN COÉQUIPIER : celui que le bâton désigne (dans un cône de 70° autour du bâton ; sans bâton, le plus
 * ouvert devant), à qui l'on mène la rondelle là où il sera ; la vitesse monte avec la distance ; l'écart suit le Jeu
 * du passeur. Personne dans le cône : la rondelle part dans le bâton (un renvoi). Le receveur prend le contrôle.
 */
/** À qui la passe irait, et si la ligne est barrée : ce que l'écran montre avant l'appui. */
const PASSE_VISEE = 2.5;   // le prix d'un radian d'écart entre la poussée du bâton et le receveur : à 15°, un coéquipier perd ce que la couverture coûte
export function receveurDePasse(etat, s, baton) {
  const lm = lame(s);
  const ang0 = baton ? Math.atan2(baton.y, baton.x) : s.cap;
  let meilleur = null, score = -Infinity, barree = false;
  for (const m of etat.patineurs) {
    if (!m.surGlace || m.equipe !== s.equipe || m.id === s.id || m.auSol > 0) continue;
    const dx = m.x - lm.x, dy = m.y - lm.y, d = hyp(dx, dy) || 1e-9;
    const ecartAng = Math.abs(plier(Math.atan2(dy, dx) - ang0));
    if (baton && ecartAng > 1.22) continue;
    if (!baton && ecartAng > 1.9) continue;
    // Une passe couverte (un adversaire près de la ligne) vaut moins.
    let couvert = 0;
    for (const o of etat.patineurs) {
      if (!o.surGlace || o.equipe === s.equipe) continue;
      const u = ((o.x - lm.x) * dx + (o.y - lm.y) * dy) / (d * d);
      if (u < 0.1 || u > 1) continue;
      const px = lm.x + u * dx, py = lm.y + u * dy;
      if (hyp(o.x - px, o.y - py) < 1.3) couvert++;
    }
    // LA DIRECTION D'ABORD (JP, 1er nov. 2026 : *privilégier la passe si un joueur est dans la direction*) : celui que
    // le bâton pointe la reçoit, même couvert (elle se soulève alors) ; un autre ne la prend qu'à quelques degrés de lui.
    const sc = Math.cos(ecartAng) * 2 - ecartAng * PASSE_VISEE - d / 25 - couvert * 0.5;
    if (sc > score) { score = sc; meilleur = m; barree = couvert > 0; }
  }
  return { vers: meilleur, barree };
}
function passer(etat, s, baton, vise, ev) {
  const R = etat.rondelle;
  const lm = lame(s);
  const { vers: meilleur, barree } = receveurDePasse(etat, s, baton);
  if (!meilleur) {
    lancer(etat, s, vise, BATON.passe, BATON.ecart * 0.6 * s.p.passe, 1);
    ev.push({ type: 'passe', qui: s.id, vers: null });
    return;
  }
  // La passe menée : là où il sera quand elle arrivera.
  let d = hyp(meilleur.x - lm.x, meilleur.y - lm.y);
  let v = clamp(BATON.passe + (d - 8) * BATON.passeLoin, BATON.passe * 0.8, BATON.passeMax);
  let tx = meilleur.x, ty = meilleur.y;
  for (let k = 0; k < 2; k++) {
    const t = d / v;
    tx = meilleur.x + meilleur.vx * t * 0.8; ty = meilleur.y + meilleur.vy * t * 0.8;
    d = hyp(tx - lm.x, ty - lm.y);
    v = clamp(BATON.passe + (d - 8) * BATON.passeLoin, BATON.passe * 0.8, BATON.passeMax);
  }
  // La ligne barrée par un bâton : la passe soulevée passe par-dessus et retombe.
  lancer(etat, s, Math.atan2(ty - lm.y, tx - lm.x), v, BATON.ecart * 0.6 * s.p.passe, 0.5, barree ? BATON.soulevee : 0);
  R.passeDe = s.id; R.passeVers = meilleur.id;
  ev.push({ type: 'passe', qui: s.id, vers: meilleur.id, soulevee: barree });
}

/* ---------- le gardien ---------- */
/*
 * LE GARDIEN se place sur la ligne rondelle-filet, sort d'autant plus qu'elle est loin, colle au poteau quand elle
 * est derrière lui. Il la voit avec `reaction` de retard : un tir rapide de près le bat parce qu'il réagit tard,
 * un tir de la bleue lui laisse le temps de se mettre devant. Devant un tir, il va là où elle croisera sa ligne.
 */
function gardien(etat, Gd, ev) {
  const R = etat.rondelle, s = Gd.sens;
  if (Gd.retire) return;   // au banc : le filet est désert
  const n = Math.round(Gd.p.reaction / PAS);
  const vueDuJour = { x: R.x, y: R.y, vx: R.vx, vy: R.vy, libre: !R.porteur };
  while (Gd.memoire.length < n) Gd.memoire.push(vueDuJour);
  Gd.memoire.push(vueDuJour);
  Gd.memoire.shift();
  const vu = Gd.memoire[0];
  let cible;
  const xb = s * LIGNE_BUT;
  const xMin = LIGNE_BUT - 1.6, xMax = LIGNE_BUT - 0.15;   // en profondeur, côté centre
  const versMoi = vu.vx * s > 8 && vu.x * s < LIGNE_BUT;
  if (vu.libre && versMoi) {
    const t = (Gd.x - vu.x) / vu.vx;
    cible = { x: Gd.x, y: clamp(vu.y + vu.vy * t, -1.1, 1.1) };
  } else if (vu.x * s > LIGNE_BUT) {
    cible = { x: s * xMax, y: Math.sign(vu.y || 1) * 0.75 };
  } else {
    const cx = xb + s * 0.3, dx = vu.x - cx, dy = vu.y, d = hyp(dx, dy) || 1e-9;
    const sortie = 0.3 + GARDIEN.sortie * clamp(d / 12, 0.3, 1);
    cible = { x: s * clamp(Math.abs(cx + dx / d * sortie), xMin, xMax), y: clamp(dy / d * sortie, -1.4, 1.4) };
  }
  const k = 40, c = 2 * Math.sqrt(k);
  let ax = k * (cible.x - Gd.x) - c * Gd.vx, ay = k * (cible.y - Gd.y) - c * Gd.vy;
  const a = hyp(ax, ay);
  if (a > GARDIEN.accel) { ax *= GARDIEN.accel / a; ay *= GARDIEN.accel / a; }
  Gd.vx += ax * PAS; Gd.vy += ay * PAS;
  const v = hyp(Gd.vx, Gd.vy);
  if (v > Gd.p.vMax) { Gd.vx *= Gd.p.vMax / v; Gd.vy *= Gd.p.vMax / v; }
  Gd.x += Gd.vx * PAS; Gd.y += Gd.vy * PAS;
  if (R.porteur || etat.arret) return;
  const dansY = Math.abs(R.y - Gd.y) < Gd.p.demi + RONDELLE.rayon;
  const dansX = Math.abs(R.x - Gd.x) < GARDIEN.profondeur + RONDELLE.rayon;
  if (!(dansY && dansX) || R.z > FILET.haut) return;
  const vr = hyp(R.vx, R.vy);
  if (vr < 2 && R.z < 0.3) { geler(etat, Gd, ev); return; }
  if (R.vx * s <= 0) return;
  // LES TROUS : le coin du haut (la mitaine, le bloqueur), entre les jambières, le corps — ce qui passe quand même.
  const dy = Math.abs(R.y - Gd.y);
  const trou = R.z > 0.85 && dy > 0.35 ? GARDIEN.trous.haut : R.z < 0.2 && dy < 0.18 ? GARDIEN.trous.cinq : GARDIEN.trous.corps;
  if (etat.de() < trou) return;   // elle passe
  etat.compte.arrets++;
  Gd.arrets++;
  R.x = Gd.x - s * (GARDIEN.profondeur + RONDELLE.rayon + 0.02);
  if (etat.de() < GARDIEN.couvre) { geler(etat, Gd, ev, true); }
  else {
    const ang = (s > 0 ? Math.PI : 0) + (etat.de() - 0.5) * 1.4;
    const vt = vr * GARDIEN.rebond;
    R.vx = Math.cos(ang) * vt; R.vy = Math.sin(ang) * vt; R.vz = 0.5; R.z = Math.min(R.z, 0.3);
    ev.push({ type: 'arret', gele: false, equipe: Gd.equipe, haut: R.z > 0.6, cote: Math.sign((R.y - Gd.y) * s || 1) });
  }
}
function geler(etat, Gd, ev, arret = false) {
  const R = etat.rondelle;
  R.vx = 0; R.vy = 0;
  ev.push(arret ? { type: 'arret', gele: true, equipe: Gd.equipe } : { type: 'gel', equipe: Gd.equipe });
  if (!etat.match) { etat.arret = { genre: 'gel', reste: 1.5 }; return; }
  if (etat.match.ronde) { finDeRonde(etat, false, ev); return; }
  arreter(etat, 'gel', { x: Gd.sens * POINT.x, y: Math.sign(R.y || 1) * POINT.y }, MATCH.pauses.gel);
}

/* ---------- les arrêts de jeu, les mises en jeu, les punitions ---------- */
/* Un arrêt de jeu : le sifflet, la pause, puis la mise en jeu au point dit. */
function arreter(etat, genre, point, pause) {
  etat.enJeu = false;
  etat.arret = { genre, reste: pause, point };
  etat.rondelle.porteur = null; etat.rondelle.z = 0; etat.rondelle.vz = 0;
  etat.rondelle.passeDe = null; etat.rondelle.passeVers = null;
  for (const s of etat.patineurs) { s.charge = 0; s.harpon = 0; s.elan = 0; }
  if (etat.match) etat.match.horsJeuDiffere = null;
  // Une punition en attente tombe à l'arrêt de jeu.
  if (etat.match && etat.match.enAttente) { const p = etat.match.enAttente; etat.match.enAttente = null; appliquerPunition(etat, p); }
}

/*
 * LA MISE EN JEU : tout le monde à sa place autour du point (les centres au point, les ailiers sur les traits, les
 * défenseurs derrière), la rondelle tombe après `MATCH.mej` ; chaque centre a sa chance (son Jeu, le hasard, et le
 * bouton pressé juste à la chute : +0,35), le gagnant la tire derrière lui, vers un défenseur.
 */
function placerMiseEnJeu(etat, point) {
  if (etat.match && !etat.match.ronde) for (const eq of ['A', 'B']) habiller(etat, eq);
  const R = etat.rondelle;
  R.x = point.x; R.y = point.y; R.z = 0; R.vx = 0; R.vy = 0; R.vz = 0; R.porteur = null; R.dernier = null;
  if (etat.match) { etat.match.touches.A = []; etat.match.touches.B = []; }
  const centres = {};
  for (const eq of ['A', 'B']) {
    const s = etat.equipes[eq].attaque;
    const sur = surGlace(etat, eq);
    const F = sur.filter(p => p.poste !== 'D'), D = sur.filter(p => p.poste === 'D');
    const centre = F.find(p => p.poste === 'C') || F[0] || D[0];
    const ailiers = F.filter(p => p !== centre);
    const place = (p, x, y) => {
      p.x = clamp(x, -(LIGNE_BUT - 1.2), LIGNE_BUT - 1.2); p.y = clamp(y, -(W / 2 - 1), W / 2 - 1);
      // Jamais dans le filet.
      if (Math.abs(p.x) > LIGNE_BUT - 1.2 && Math.abs(p.y) < FILET.large / 2 + 1) p.y = Math.sign(p.y || 1) * (FILET.large / 2 + 1.2);
      p.vx = 0; p.vy = 0; p.cap = s > 0 ? 0 : Math.PI; p.auSol = 0; p.charge = 0; p.lachee = 0; p.harpon = 0; p.elan = 0; p.ia = null;
    };
    if (centre) place(centre, point.x - s * 0.75, point.y);
    // L'ailier gauche à gauche en regardant le filet attaqué (−y quand on attaque vers +x), le droit à droite.
    ailiers.forEach((p, i) => place(p, point.x - s * 2.0, point.y + s * 4.8 * (p.poste === 'AG' ? -1 : p.poste === 'AD' ? 1 : (i === 0 ? -1 : 1))));
    D.forEach((p, i) => place(p, point.x - s * 8, point.y + (i === 0 ? -3.5 : 3.5)));
    centres[eq] = centre ? centre.id : null;
    const Gd = gardienDe(etat, eq);
    if (!Gd.retire) Object.assign(Gd, { x: Gd.sens * (LIGNE_BUT - GARDIEN.sortie), y: 0, vx: 0, vy: 0, memoire: [] });
  }
  // Les joueurs hors glace : au banc, ou au cachot.
  for (const s of etat.patineurs) if (!s.surGlace) { s.x = (s.equipe === 'A' ? -1 : 1) * (s.boxe ? 3 : 8); s.y = (s.boxe ? -1 : 1) * (W / 2 + 1.2); s.vx = 0; s.vy = 0; }
  etat.mej = { point, reste: MATCH.mej, centres, appuis: { A: null, B: null } };
  for (const eq of etat.humains) {
    const mien = surGlace(etat, eq);
    etat.controles[eq] = centres[eq] || (mien[0] && mien[0].id) || null;
  }
}
function tomber(etat, ev) {
  const M = etat.mej, R = etat.rondelle;
  etat.mej = null;
  etat.enJeu = true;
  const chances = {};
  for (const eq of ['A', 'B']) {
    const c = M.centres[eq] ? parId(etat, M.centres[eq]) : null;
    const jeu = c ? (1.4 - c.p.passe) / 0.03 / 20 : 0.5;
    const appui = M.appuis[eq];
    const timing = appui != null && Math.abs(appui) < 0.15 ? 0.35 : 0;
    chances[eq] = jeu * 0.5 + etat.de() * 0.5 + timing;
  }
  const gagnant = chances.A >= chances.B ? 'A' : 'B';
  const c = M.centres[gagnant] ? parId(etat, M.centres[gagnant]) : null;
  const s = etat.equipes[gagnant].attaque;
  R.vx = -s * 5; R.vy = (etat.de() < 0.5 ? -1 : 1) * 3;
  if (c) { toucher(etat, c, false); c.lachee = 0.15; }
  if (etat.match) etat.match.mej[gagnant]++;
  ev.push({ type: 'mej', equipe: gagnant });
}

/* Une punition : deux minutes au cachot, tout de suite si son équipe a la rondelle (ou personne), en attente sinon. */
function punir(etat, s, genre, ev) {
  const M = etat.match;
  if (!M || M.fini) return;
  if (M.penalites.some(p => p.id === s.id) || M.enAttente || M.tirDePunition) return;   // une punition en attente à la fois
  const p = { id: s.id, equipe: s.equipe, genre, reste: MATCH.punition };
  ev.push({ type: 'punition', qui: s.id, equipe: s.equipe, genre, attente: false });
  const porteur = etat.rondelle.porteur ? parId(etat, etat.rondelle.porteur) : null;
  const fautifs = porteur && porteur.equipe === s.equipe;
  if (fautifs) { appliquerPunition(etat, p); return; }
  // À retardement : l'autre équipe garde la rondelle tant qu'elle l'a ; le sifflet viendra quand les fautifs la touchent.
  M.enAttente = p;
  ev[ev.length - 1].attente = true;
}
function appliquerPunition(etat, p) {
  const M = etat.match;
  const s = parId(etat, p.id);
  M.penalites.push(p);
  M.pim[p.equipe] += 2;
  s.surGlace = false; s.boxe = true;
  s.x = (s.equipe === 'A' ? -1 : 1) * 3; s.y = -(W / 2 + 1.2); s.vx = 0; s.vy = 0;
  for (const eq of ['A', 'B']) if (etat.controles[eq] === s.id) etat.controles[eq] = null;
  if (!etat.arret) {
    const sg = etat.equipes[p.equipe].attaque;
    arreter(etat, 'punition', { x: -sg * POINT.x, y: Math.sign(etat.rondelle.y || 1) * POINT.y }, MATCH.pauses.punition);
  }
}
function liberer(etat, p, ev) {
  const M = etat.match;
  M.penalites = M.penalites.filter(q => q !== p);
  const s = parId(etat, p.id);
  s.boxe = false; s.surGlace = true;
  s.x = (s.equipe === 'A' ? -1 : 1) * 3; s.y = -(W / 2 - 1); s.vx = 0; s.vy = 0; s.cap = Math.PI / 2;
  ev.push({ type: 'liberation', qui: s.id, equipe: s.equipe });
}

/* ---------- l'horloge, les périodes, la fin ---------- */
function finDePeriode(etat, ev) {
  const M = etat.match;
  ev.push({ type: 'periode', periode: M.periode });
  if (M.periode >= 3 || M.prolongation) {
    if (M.pointage.A !== M.pointage.B) { finir(etat, M.pointage.A > M.pointage.B ? 'A' : 'B', ev); return; }
    // En séries, la prolongation à cinq, autant qu'il en faut ; en saison, une à trois, puis les tirs de barrage.
    if (M.series) { M.prolongation = true; M.periode++; M.reste = M.duree; }
    else if (!M.prolongation) { M.prolongation = true; M.periode++; M.reste = M.dureeOT; }
    else { commencerFusillade(etat, ev); return; }
  } else { M.periode++; M.reste = M.duree; }
  for (const g of etat.gardiens) g.retire = false;
  for (const eq of ['A', 'B']) etat.equipes[eq].attaque = -etat.equipes[eq].attaque;
  for (const g of etat.gardiens) g.sens = -g.sens;
  for (const s of etat.patineurs) s.jambes = Math.min(100, s.jambes + 40);
  arreter(etat, 'periode', { x: 0, y: 0 }, MATCH.pauses.periode);
}
/* Les trois étoiles : les buts, les passes, les tirs et les mises en échec ; un gardien vaut ses arrêts. */
function etoilesDu(etat) {
  const M = etat.match;
  const notes = etat.patineurs.map(s => ({ id: s.id, nom: s.nom, equipe: s.equipe, visage: s.visage, note: s.stats.buts * 3 + s.stats.aides * 2 + s.stats.tirs * 0.3 + s.stats.echecs * 0.2 + s.stats.blocs * 0.2, stats: s.stats }));
  for (const g of etat.gardiens) notes.push({ id: `G:${g.equipe}`, nom: g.nom, equipe: g.equipe, visage: g.visage, gardien: true, note: g.arrets * 0.5 + (M.pointage[autre(g.equipe)] === 0 && g.arrets > 0 ? 3 : 0), stats: { arrets: g.arrets } });
  return notes.sort((a, b) => b.note - a.note).slice(0, 3);
}
function finir(etat, vainqueur, ev) {
  const M = etat.match;
  M.fini = true; M.vainqueur = vainqueur;
  M.etoiles = etoilesDu(etat);
  etat.enJeu = false;
  etat.arret = { genre: 'fin', reste: Infinity, point: null };
  etat.rondelle.porteur = null;
  ev.push({ type: 'fin', vainqueur });
}

/*
 * LES TIRS DE BARRAGE : trois rondes, puis la mort subite ; un tireur part du centre avec la rondelle, seul devant
 * le gardien. La ronde finit au but, à l'arrêt, ou quand la rondelle recule ou passe la ligne de but.
 */
function commencerFusillade(etat, ev) {
  const M = etat.match;
  M.fusillade = { ronde: 1, tireur: 'A', buts: { A: 0, B: 0 }, essais: { A: 0, B: 0 }, ordre: { A: [], B: [] }, reste: 0 };
  for (const eq of ['A', 'B']) {
    M.fusillade.ordre[eq] = etat.patineurs.filter(s => s.equipe === eq && !s.boxe).sort((a, b) => b.p.tir - a.p.tir).map(s => s.id);
  }
  ev.push({ type: 'fusillade' });
  arreter(etat, 'fusillade', null, 1.5);
}
/* Une ronde : un tireur seul devant le gardien, du centre — les tirs de barrage, ou un tir de punition. */
function placerRonde(etat, eq, tireurId, genre) {
  const M = etat.match, R = etat.rondelle;
  const s = etat.equipes[eq].attaque;
  const tireur = parId(etat, tireurId);
  for (const p of etat.patineurs) { p.surGlace = p.id === tireur.id; p.x = (p.equipe === 'A' ? -1 : 1) * 8; p.y = W / 2 + 1.2; p.vx = 0; p.vy = 0; p.auSol = 0; p.charge = 0; }
  tireur.x = -s * 2; tireur.y = 0; tireur.cap = s > 0 ? 0 : Math.PI; tireur.surGlace = true; tireur.lachee = 0; tireur.ia = null;
  R.x = 0; R.y = 0; R.z = 0; R.vx = 0; R.vy = 0; R.vz = 0; R.porteur = null; R.dernier = null;
  for (const g of etat.gardiens) { g.retire = false; Object.assign(g, { x: g.sens * (LIGNE_BUT - GARDIEN.sortie), y: 0, vx: 0, vy: 0, memoire: [] }); }
  etat.controles = { A: null, B: null };
  if (etat.humains.includes(eq)) etat.controles[eq] = tireur.id;
  M.ronde = { eq, tireur: tireur.id, genre, reste: MATCH.tirDePunition };
  etat.enJeu = true;
}
/* Le tir de punition : accordé sur une échappée fauchée ; joué comme une ronde, puis le match reprend. */
function accorderTirDePunition(etat, porteur, fautif, ev) {
  const M = etat.match;
  M.tirDePunition = { eq: porteur.equipe, tireur: porteur.id, fautif: fautif.id };
  ev.push({ type: 'tirpunition', equipe: porteur.equipe, qui: porteur.id, fautif: fautif.id });
  arreter(etat, 'tirpunition', null, MATCH.pauses.punition);
}
function finDeRonde(etat, but, ev) {
  const M = etat.match, R0 = M.ronde;
  if (!R0) return;
  const eq = R0.eq;
  M.ronde = null;
  ev.push({ type: 'ronde', equipe: eq, but, genre: R0.genre });
  etat.rondelle.porteur = null; etat.rondelle.vx = 0; etat.rondelle.vy = 0; etat.rondelle.z = 0; etat.rondelle.vz = 0;
  if (R0.genre === 'punition') {
    // Le match reprend : au centre après un but, dans la zone du gardien sinon.
    M.tirDePunition = null;
    const sg = etat.equipes[eq].attaque;
    arreter(etat, but ? 'but' : 'gel', but ? { x: 0, y: 0 } : { x: sg * POINT.x, y: Math.sign(etat.rondelle.y || 1) * POINT.y }, but ? MATCH.pauses.but : MATCH.pauses.gel);
    return;
  }
  const F = M.fusillade;
  F.essais[eq]++;
  if (but) F.buts[eq]++;
  // Décidé ? Après trois rondes chacun, celui qui mène ; avant, si l'autre ne peut plus rattraper.
  const nA = F.essais.A, nB = F.essais.B, bA = F.buts.A, bB = F.buts.B, R = MATCH.rondesFusillade;
  const resteA = Math.max(0, R - nA), resteB = Math.max(0, R - nB);
  let vainqueur = null;
  if (bA > bB + resteB) vainqueur = 'A';
  else if (bB > bA + resteA) vainqueur = 'B';
  else if (nA >= R && nB >= R && nA === nB && bA !== bB) vainqueur = bA > bB ? 'A' : 'B';
  if (vainqueur) { M.pointage[vainqueur]++; finir(etat, vainqueur, ev); return; }
  F.tireur = autre(eq);
  if (F.tireur === 'A') F.ronde++;
  arreter(etat, 'fusillade', null, 1.5);
}

/* ---------- la remise (l'entraînement) ---------- */
/* Après un but, tout au centre ; après un gel, une mise en jeu au point du côté de la rondelle. */
export function remise(etat, genre = 'but') {
  const R = etat.rondelle, toi = etat.patineurs[0];
  R.vx = 0; R.vy = 0; R.z = 0; R.vz = 0; R.porteur = null; R.dernier = null;
  if (genre === 'but') { R.x = 0; R.y = 0; toi.x = -6; toi.y = 0; }
  else { R.x = POINT.x; R.y = Math.sign(R.y || -1) * POINT.y; toi.x = POINT.x - 2.5; toi.y = R.y; }
  toi.vx = 0; toi.vy = 0; toi.cap = 0; toi.auSol = 0; toi.charge = 0; toi.lachee = 0;
  for (const p of etat.patineurs) if (p.poste0) { p.x = p.poste0.x; p.y = p.poste0.y; p.vx = 0; p.vy = 0; p.auSol = 0; }
  for (const g of etat.gardiens) Object.assign(g, { x: g.sens * (LIGNE_BUT - GARDIEN.sortie), y: 0, vx: 0, vy: 0, memoire: [] });
  etat.arret = null;
  etat.enJeu = true;
}

/* ---------- un pas ---------- */
function pas(etat, entrees, ev) {
  etat.t += PAS;
  const M = etat.match;
  if (etat.arret) {
    if (etat.arret.reste === Infinity) return;
    etat.arret.reste -= PAS;
    if (etat.arret.reste > 0) return;
    const genre = etat.arret.genre, point = etat.arret.point;
    etat.arret = null;
    if (!M) { remise(etat, genre); ev.push({ type: 'remise' }); return; }
    if (M.tirDePunition) { placerRonde(etat, M.tirDePunition.eq, M.tirDePunition.tireur, 'punition'); ev.push({ type: 'remise' }); return; }
    if (M.fusillade) {
      const F = M.fusillade, ids = F.ordre[F.tireur];
      placerRonde(etat, F.tireur, ids[F.essais[F.tireur] % ids.length], 'fusillade');
      ev.push({ type: 'remise' });
      return;
    }
    placerMiseEnJeu(etat, point);
    ev.push({ type: 'remise', point });
    return;
  }
  // La mise en jeu : tout le monde attend, les centres guettent la chute.
  if (etat.mej) {
    etat.mej.reste -= PAS;
    for (const eq of ['A', 'B']) {
      const c = etat.mej.centres[eq];
      const e = c ? (entrees[c] || (etat.ia ? etat.ia(etat, parId(etat, c)) : null)) : null;
      if (e && e.passe && etat.mej.appuis[eq] == null) etat.mej.appuis[eq] = etat.mej.reste;
    }
    for (const s of etat.patineurs) if (s.surGlace) { const e = entrees[s.id]; s.tenaitPasse = !!(e && e.passe); s.tenaitTir = !!(e && e.tir); }
    if (etat.mej.reste <= 0) tomber(etat, ev);
    return;
  }
  // L'horloge.
  if (M && etat.enJeu && !M.fusillade) {
    M.reste -= PAS;
    etat.equipes.A.presence += PAS; etat.equipes.B.presence += PAS;
    for (const p of M.penalites) p.reste -= PAS;
    for (const p of M.penalites.filter(p => p.reste <= 0)) liberer(etat, p, ev);
    for (const s of etat.patineurs) if (!s.surGlace && !s.boxe) s.jambes = Math.min(100, s.jambes + JAMBES.repos * PAS);
    if (M.reste <= 0) { M.reste = 0; finDePeriode(etat, ev); return; }
  }
  if (M && M.ronde) {
    M.ronde.reste -= PAS;
    const s = etat.equipes[M.ronde.eq].attaque, R = etat.rondelle, tireur = parId(etat, M.ronde.tireur);
    const recule = R.vx * s < -1 && !R.porteur, trop = M.ronde.reste <= 0, passee = Math.abs(R.x) > LIGNE_BUT + 0.5 && !R.porteur;
    const perduePres = !R.porteur && hyp(R.vx, R.vy) < 0.5 && hyp(R.x - tireur.x, R.y - tireur.y) > 3;
    if (recule || trop || passee || perduePres) { finDeRonde(etat, false, ev); return; }
  }
  // L'IA retire son gardien en fin de match quand elle tire de l'arrière, et le remet si elle revient.
  if (M && etat.enJeu && !M.ronde && (etat.tic & 63) === 0) {
    for (const eq of ['A', 'B']) {
      if (etat.humains.includes(eq)) continue;
      const Gd = gardienDe(etat, eq), a = etat.equipes[eq].attaque;
      const ecart = M.pointage[autre(eq)] - M.pointage[eq];
      const veut = M.periode === 3 && !M.prolongation && M.reste < MATCH.retraitGardien && ecart >= 1 && ecart <= 2 && etat.rondelle.x * a > 0;
      if (veut && !Gd.retire) retirerGardien(etat, eq, true);
      else if (Gd.retire && ecart <= 0) retirerGardien(etat, eq, false);
    }
  }
  // Les entrées de chacun : l'humain, sinon l'IA.
  const entreesDe = s => {
    if (entrees[s.id]) return entrees[s.id];
    if (etat.mode === 'entrainement') return entreeDuPlot(s);
    if (!etat.ia) return null;
    if (!s.ia || (etat.tic & 3) === 0) s.ia = etat.ia(etat, s);
    return s.ia;
  };
  etat.tic = (etat.tic || 0) + 1;
  const toutes = {};
  for (const s of etat.patineurs) {
    if (!s.surGlace) continue;
    const e = entreesDe(s);
    toutes[s.id] = e;
    if (e && e.tir && !s.auSol) s.charge = Math.min(BATON.charge, s.charge + PAS); else if (!(e && e.tir)) { if (!s.tenaitTir) s.charge = 0; }
    // Le harpon et l'élan : le bouton tir sans la rondelle, le bouton échec.
    if (etat.rondelle.porteur !== s.id) {
      if (e && e.tir && !s.tenaitTir && s.harponRepos <= 0 && s.auSol <= 0) { s.harpon = HARPON.duree; s.harponRepos = HARPON.repos; }
      if (e && e.echec && !s.tenaitEchec && s.elanRepos <= 0 && s.auSol <= 0) { s.elan = ECHEC.duree; s.elanRepos = ECHEC.repos; ev.push({ type: 'elan', qui: s.id }); }
    }
    // Le tampon d'entrée : un appui de passe ou de tir sans la rondelle se mémorise pour la prise.
    if (etat.rondelle.porteur !== s.id && etat.humains.includes(s.equipe)) {
      if (e && e.passe && !s.tenaitPasse) s.tamponPasse = etat.t;
      if (e && e.tir && !s.tenaitTir) s.tamponTir = etat.t;
    }
    if (s.harpon > 0) { harponner(etat, s, ev); s.harpon -= PAS; }
    if (s.harponRepos > 0) s.harponRepos -= PAS;
    if (s.elan > 0) s.elan -= PAS;
    if (s.elanRepos > 0) s.elanRepos -= PAS;
    patiner(s, e, etat.enJeu);
  }
  collisions(etat, ev);
  for (const s of etat.patineurs) if (s.surGlace) { bander(s, s.rayon, PATIN.bande); patineurContreFilet(s); }
  const avantX = etat.rondelle.x;
  rondelle(etat, toutes, ev);
  if (M && !etat.arret && !M.ronde) horsJeu(etat, avantX, ev);
  for (const Gd of etat.gardiens) gardien(etat, Gd, ev);
  for (const s of etat.patineurs) {
    const e = toutes[s.id];
    s.tenaitTir = !!(e && e.tir);
    s.tenaitPasse = !!(e && e.passe);
    s.tenaitEchec = !!(e && e.echec);
    if (!s.tenaitTir) s.charge = 0;
  }
  // Le changement de joueur de chaque humain : demandé, ou quand l'adversaire a la rondelle et que le contrôlé en est loin.
  if (M) for (const eq of etat.humains) {
    const ctl = etat.controles[eq];
    const e = ctl ? entrees[ctl] : null;
    const porteur = etat.rondelle.porteur ? parId(etat, etat.rondelle.porteur) : null;
    // Sans la rondelle, le bouton de la passe change de joueur (comme à la console) ; `changer` le fait aussi.
    const veut = !!(e && (e.changer || (e.passe && etat.rondelle.porteur !== ctl)));
    const demande = veut && !etat.changeTenu[eq];
    etat.changeTenu[eq] = veut;
    if (demande || !ctl || !parId(etat, ctl).surGlace) changerDeJoueur(etat, eq, demande, ev);
    else if (porteur && porteur.equipe !== eq && (etat.tic & 15) === 0) {
      const proches = plusProches(etat, eq, etat.rondelle);
      if (proches.length > 1 && proches[0] !== ctl && proches[1] !== ctl) changerDeJoueur(etat, eq, false, ev);
    }
  }
}
function plusProches(etat, eq, o) {
  return surGlace(etat, eq).map(s => [s.id, hyp(s.x - o.x, s.y - o.y)]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
}
/* Le changement de joueur : le plus proche de la rondelle ; demandé, le suivant si c'est déjà lui. */
function changerDeJoueur(etat, eq, demande, ev) {
  const proches = plusProches(etat, eq, etat.rondelle);
  if (!proches.length) { etat.controles[eq] = null; return; }
  let vers = proches[0];
  if (demande && vers === etat.controles[eq] && proches.length > 1) vers = proches[1];
  if (vers !== etat.controles[eq]) { etat.controles[eq] = vers; ev.push({ type: 'changement', qui: vers, equipe: eq }); }
}

/**
 * AVANCER le temps réel écoulé, en pas fixes. `entrees` : par id de patineur, { x, y, passe, tir, echec, changer } —
 * le bâton en coordonnées de glace (|·| ≤ 1), la passe (un appui ; sans la rondelle, le changement de joueur), le tir
 * (tenu : il charge ; lâché : il part ; sans la rondelle, le harpon), l'échec (l'élan d'une mise en échec). Rend les
 * événements du laps (le son, l'écran). Au plus un dixième de seconde d'un coup.
 */
export function avancer(etat, entrees, dt) {
  const ev = [];
  etat.reste += Math.min(0.1, Math.max(0, dt));
  while (etat.reste >= PAS - 1e-9) { etat.reste -= PAS; pas(etat, entrees, ev); }
  return ev;
}

/** L'empreinte d'un état : les mêmes entrées sur la même graine la rendent pareille. */
export function empreinte(etat) {
  const r = x => Math.round(x * 1000);
  const R = etat.rondelle;
  const mots = [r(etat.t), r(R.x), r(R.y), r(R.z), r(R.vx), r(R.vy), R.porteur || '-',
    ...etat.gardiens.flatMap(g => [r(g.x), r(g.y)]),
    ...etat.patineurs.flatMap(s => [r(s.x), r(s.y), r(s.vx), r(s.vy), r(s.cap), r(s.auSol), r(s.jambes)]),
    etat.compte.tirs, etat.compte.buts, etat.compte.arrets, etat.compte.poteaux];
  if (etat.match) mots.push(etat.match.periode, r(etat.match.reste), etat.match.pointage.A, etat.match.pointage.B, etat.match.penalites.length);
  return entierDeGraine(mots.join(',')).toString(36);
}

/* ---------- les règles, écrites de là ---------- */
const kmh = v => Math.round(v * 3.6);
const dec = (v, n = 1) => v.toFixed(n).replace('.', ',');
/** Ce que la glace fait, en phrases, chaque chiffre lu des constantes : l'écran les affiche de là. */
export function reglesDeLaGlace() {
  const arretDe = v => v * v / (2 * RONDELLE.frottement * G);
  return [
    `La patinoire fait ${dec(L, 0)} m sur ${dec(W, 0)}, les coins sont des arcs de ${dec(COIN, 1)} m, la ligne de but est à ${dec(L / 2 - LIGNE_BUT, 2)} m de la bande.`,
    `La rondelle pèse ${Math.round(RONDELLE.masse * 1000)} g et perd ≈ ${dec(RONDELLE.frottement * G, 1)} m/s par seconde : une passe à ${kmh(BATON.passe)} km/h meurt après ${Math.round(arretDe(BATON.passe))} m, un tir à ${kmh(BATON.tirMax)} km/h traverserait ${Math.round(arretDe(BATON.tirMax))} m.`,
    `La bande rend ${Math.round(RONDELLE.bande * 100)} % de la vitesse qui la frappe, le poteau ${Math.round(RONDELLE.poteau * 100)} %, la maille du filet ${Math.round(RONDELLE.filet * 100)} %.`,
    `Un patineur ordinaire pèse ${PATIN.masse} kg (un vrai joueur, son poids à la LNH), pousse à ${dec(PATIN.accel)} m/s² jusqu'à ${kmh(PATIN.vMax)} km/h, freine à ${PATIN.frein} m/s² (le bâton à l'envers) et perd ${dec(PATIN.glisse)} m/s² en roue libre ; sa cote sur 20 fait sa pointe, ses cotes Tir, Jeu, Défense et Robustesse son lancer, sa passe, son harpon et son équilibre.`,
    `Ses lames tiennent ${PATIN.adherence} m/s² de côté : à pleine vitesse, le virage le plus serré fait ${dec(PATIN.vMax ** 2 / PATIN.adherence, 0)} m de rayon ; à l'arrêt, il pivote à ${PATIN.pivot} rad/s. Une présence coûte ${dec(JAMBES.usure)} jambes par seconde à fond, le banc en rend ${JAMBES.repos} ; sous ${JAMBES.changement}, ou après ${JAMBES.presence} s, la ligne change à l'arrêt de jeu.`,
    `La lame tient la rondelle à ${dec(BATON.lame[0])} m devant ; plus loin que ${dec(PATIN.portee)} m, elle est perdue. Une rondelle qui arrive à plus de ${kmh(BATON.reception)} km/h ne se prend pas : elle dévie. Le harpon porte à ${dec(HARPON.portee)} m devant, ${dec(HARPON.duree, 2)} s, et repose ${dec(HARPON.repos)} s.`,
    `La passe part à ${kmh(BATON.passe)} km/h, plus ${dec(BATON.passeLoin)} m/s par mètre de plus, menée là où le coéquipier sera ; le tir du poignet à ${kmh(BATON.tirMin)} km/h, le lancer frappé chargé ${dec(BATON.charge, 2)} s à ${kmh(BATON.tirMax)} km/h, le tir sur réception à ${Math.round(BATON.uneTemps * 100)} % du frappé sans charger ; la visée s'écarte de ±${dec(BATON.ecart * 57.3)}° (plus à pleine charge), et le tir part toujours vers le filet attaqué : le bâton choisit où (droit, le centre ; penché, le coin ; à fond de côté, ${Math.round(BATON.large * 100)} cm à côté du poteau).`,
    `Une mise en échec échange l'élan des deux corps (masse × vitesse) ; le moins lancé tombe ${dec(PATIN.sol)} s si l'écart dépasse ${CHUTE.seuil} kg·m/s (× son équilibre), et lâche la rondelle. L'élan du bouton pousse ${ECHEC.accel} fois plus fort pendant ${dec(ECHEC.duree, 2)} s. Frapper qui n'a pas la rondelle depuis ${dec(ECHEC.recent)} s, ou par-derrière : ${MATCH.punition / 60} minutes.`,
    `Le gardien voit la rondelle ${Math.round(GARDIEN.reaction * 1000)} ms en retard (sa cote Arrêts le raccourcit), bouge à ${kmh(GARDIEN.vMax)} km/h au plus, couvre ${dec(GARDIEN.demi * 2, 2)} m des ${dec(FILET.large, 2)} m du filet ; il gèle ${Math.round(GARDIEN.couvre * 100)} % de ses arrêts, les autres rebondissent à ${Math.round(GARDIEN.rebond * 100)} % de la vitesse.`,
    `Le hors-jeu se siffle à l'entrée de la zone quand on y porte la rondelle ; lancée ou passée dedans, il est différé, levé si les attaquants ressortent, sifflé s'ils la touchent ; le dégagement refusé quand la rondelle lancée de sa moitié passe la ligne de but sans être touchée (permis en désavantage) ; la mise en jeu tombe après ${dec(MATCH.mej)} s, le bouton pressé juste à la chute vaut un bonus. Trois périodes, puis ${MATCH.prolongation / 60} minutes à ${MATCH.surglaceOT} contre ${MATCH.surglaceOT}, puis ${MATCH.rondesFusillade} tirs de barrage et la mort subite ; en séries, la prolongation à cinq, autant qu'il en faut.`,
    `La rondelle a une hauteur : le poignet monte à ${dec(BATON.hauteurMin)} m/s, le frappé chargé à ${dec(BATON.hauteurMax)} m/s (±${dec(BATON.ecartHauteur)}), la gravité la ramène, le sol lui rend ${Math.round(RONDELLE.rebondSol * 100)} % ; la barre est à ${dec(FILET.haut, 2)} m, la vitre à ${dec(RONDELLE.vitre)} m (par-dessus, hors jeu) ; une passe dont la ligne est barrée se soulève à ${dec(BATON.soulevee)} m/s ; au sol seulement, elle se prend. Le gardien laisse passer ${Math.round(GARDIEN.trous.haut * 100)} % des tirs dans le coin du haut, ${Math.round(GARDIEN.trous.cinq * 100)} % entre les jambières, ${Math.round(GARDIEN.trous.corps * 100)} % sur le corps.`,
    `À reculons, la pointe et la poussée valent ${Math.round(PATIN.recul * 100)} % ; le turbo les monte à ${Math.round(PATIN.sprint * 100)} % et use les jambes ${PATIN.sprintJambes} fois plus vite ; en tournant à vitesse moyenne, les croisés poussent ${Math.round((PATIN.croise - 1) * 100)} % plus fort ; couper sec coûte ${Math.round(PATIN.virage * 100)} % de vitesse par radian ; un patineur plus léger que ${PATIN.masse} kg tourne plus court. Un harpon raté par-derrière sur le porteur l'accroche une fois sur ${Math.round(1 / HARPON.trebuche)} : deux minutes, ou un tir de punition sur une échappée. Le gardien se retire pour un sixième attaquant (l'IA, sous ${MATCH.retraitGardien} s, à un ou deux buts) ; une charge contre la bande pèse ${dec(CHUTE.bande)} fois ; une punition ne tombe que sur une charge voulue, le bouton pressé.`,
  ];
}
