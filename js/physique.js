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
import { facteurPunitionsEpoque } from './sim.js';
import { generateur, gauss, entierDeGraine } from './util.js';

const PIED = 0.3048;
/*
 * LA PATINOIRE DE SUR GLACE (JP, 2 nov. 2026 : *resize la patinoire, pour qu'en 16:9 la zone offensive ou défensive
 * remplisse, et adapte la zone neutre aussi* ; *rapetisser*). La largeur de la LNH (85 pieds), la longueur rapetissée
 * (44,6 m au lieu de 61) : la largeur de la glace en travers d'un écran 16:9 montre en long une zone entière, de la
 * bleue à la bande du fond, ou toute la zone neutre, d'une bleue à l'autre. Les filets, les cercles, l'enclave, les
 * coins et la ligne des buts gardent leurs vraies mesures.
 */
export const W = 85 * PIED;                  // 25,91 : la largeur de la LNH
export const BLEUE = 7.5;                    // la ligne bleue, de part et d'autre du centre (7,62 à la LNH) : la zone neutre fait 15 m
const ZONE_GLACE = 14.8;                     // une zone, de la bleue à la bande du fond (22,9 m à la LNH)
export const L = 2 * (BLEUE + ZONE_GLACE);   // 44,6 m (61 à la LNH)
export const COIN = 28 * PIED;               // 8,53
export const LIGNE_BUT = L / 2 - 11 * PIED;  // 18,95 : la ligne de but, à 3,35 m de la bande
/* Les points de mise en jeu de la zone, ceux de la zone neutre, et le rayon des cercles. */
export const POINT = { x: L / 2 - 31 * PIED, y: 22 * PIED, r: 15 * PIED, neutre: BLEUE - 5 * PIED };
export const FILET = { large: 6 * PIED, profond: 44 / 12 * PIED, haut: 4 * PIED, poteau: 0.03, enclave: 6 * PIED };   // `haut` : la barre horizontale, 1,22 m

const PAS = 1 / 120;
const G = 9.81;

export const RONDELLE = { masse: 0.17, rayon: 0.038, frottement: 0.15, bande: 0.55, poteau: 0.70, filet: 0.10, rebondSol: 0.35, vitre: 2.3, longe: 0.15, colle: 1.5 };   // `frottement` à 0.15 : la rondelle roule moins loin, les passes ne glissent pas à l'infini (JP : *snappy*) ; `vitre` : plus haut que ça contre la bande, la rondelle sort du jeu
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
  // L'ÉCART ENTRE DEUX PATINEURS (JP, 1er nov. : *que les joueurs soient pas trop différents côté vitesse, pour éviter que
  // ça soit injouable, les défenseurs étant naturellement plus gros*) : la cote ne bouge la pointe et la poussée que de
  // ±`ecart` entre un 1 et un 20 (±17 % avant), le trait de vitesse en ajoute la moitié, et le poids ne change le virage
  // que de ±`agilite` (un défenseur de 100 kg tournait 10 % moins court qu'un ailier de 75). Le poids reste la masse d'une
  // mise en échec : un gros frappe plus fort, il ne patine pas moins vite.
  ecart: 0.06,
  agilite: 0.05,
};
/*
 * LA FOULÉE (1er nov. 2026 ; JP : *patin pas le fun, ça feel zéro comme patiner*). On ne pousse pas comme un moteur :
 * une jambe, puis l'autre. La phase de la foulée (`s.foulee`, de 0 à 1, deux coups de patin par tour) avance à la
 * cadence du patineur pendant qu'il pousse et s'arrête quand il glisse ; la poussée monte au coup de patin et retombe
 * entre deux, sans rien changer à sa moyenne. Le sprite dessine la même phase : la jambe tendue, c'est le coup.
 */
export const FOULEE = {
  cadence: 1.0,     // les tours de foulée par seconde, au départ (deux coups de patin chacun)
  parVitesse: 0.05, // ce qu'un m/s ajoute à la cadence : à pleine vitesse, un peu plus de trois coups par seconde
  coup: 0.6,        // la poussée au coup de patin monte de ça, et retombe d'autant entre deux
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
  // LA DÉVIATION MALGRÉ SOI (2 nov. 2026) : un tir qui frappe une lame posée à moins de `devant` m du filet visé ne
  // meurt pas comme une passe bloquée : il change de route, de `devie` rad (écart-type), et garde `garde` de sa vitesse.
  devant: 5, devie: 0.35, garde: 0.8,
  // LA MAIN DU JOUEUR (2 nov. 2026, le lot 3) : la lame tient la rondelle à `cote` m du côté de sa main (un gaucher à
  // gauche) ; elle change de côté à `lameVite` m/s, la rondelle la suit au ressort.
  cote: 0.25, lameVite: 8,
};
/*
 * LES GESTES DU PORTEUR (2 nov. 2026, le lot 3 ; docs/revue-sur-glace-2026-11.md, la proposition 4).
 *
 * LE REVERS : la rondelle part de l'autre côté du corps — la lame passée du côté de sa main à l'autre, ou lancée à plus
 * de `angle` rad du cap vers ce côté-là. Le tir y perd (× `tir` de vitesse, × `ecart` d'écart), la passe aussi.
 */
export const REVERS = { angle: 1.3, cote: 0.1, tir: 0.82, ecart: 1.5, passe: 0.85, ecartPasse: 1.6 };
/*
 * PROTÉGER LA RONDELLE : le porteur plus lent que `vitesse` m/s, un adversaire debout à `pres` m, passe sa lame de
 * l'autre côté de son corps (à `cote` m de côté, `avant` m devant) : de lui-même, sans bouton. Un harpon qui doit
 * passer par le corps du porteur pour atteindre la rondelle (la ligne du harponneur à elle à `marge` m de plus que son
 * corps) réussit `harpon` fois moins : c'est tourner le dos au poursuivant qui le rend dur à harponner. En chargeant un
 * tir, la lame revient au coup droit : tirer vite de là où l'on protège, c'est tirer du revers.
 */
export const PROTEGE = { vitesse: 5.5, pres: 2.6, cote: 0.75, avant: 0.55, marge: 0.15, harpon: 0.3 };
/*
 * LA FEINTE (Y avec la rondelle) : la lame part d'`ecart` m de côté (le bâton dit lequel ; au neutre, vers le revers) le
 * temps de `duree` s, puis revient ; `repos` s avant la suivante ; pendant la feinte, on pousse à `pousse`. Un harpon,
 * un bâton soulevé lancés pendant la feinte ratent, une mise en échec ne renverse pas : ils ont mordu. SAUF S'IL LA LIT
 * (le lot 6 : elle passait à tout coup, 0 harpon sur 40) : un défenseur la lit `lit` fois les points de sa Défense sur 20
 * au-dessus d'`aveugle` (à 8 et moins, il mord toujours ; à 18, quatre fois sur dix), et `relue` de plus quand le même
 * porteur feintait déjà moins de `usee` s plus tôt. Lue, son geste se joue comme sans feinte.
 */
export const FEINTE = { ecart: 1.0, duree: 0.3, repos: 1.0, pousse: 0.6, lit: 0.04, aveugle: 8, usee: 3, relue: 0.35 };
/* Le défenseur `s` lit-il la feinte du porteur `p` ? Un dé, à sa Défense, plus si la feinte est répétée (`FEINTE`). */
const litLaFeinte = (etat, s, p) => etat.de() < clamp(FEINTE.lit * (s.p.defense * 20 - FEINTE.aveugle), 0, 1) + (p.feinteUsee ? FEINTE.relue : 0);
/*
 * LA PASSE LAISSÉE (A, le bâton tiré vers l'arrière, à plus de `arriere` rad du cap) : un coéquipier qui le suit —
 * derrière lui, à `cone` rad de l'arrière et `portee` m au plus, lancé dans le même sens à `suit` m/s au moins —, le
 * porteur lui laisse la rondelle : elle part vers lui à `vitesse` m/s seulement, et il patine dessus ; le porteur, lui,
 * passe par-dessus sans la reprendre (`lachee` s). Personne qui suit : c'est une passe.
 */
export const LAISSEE = { arriere: 2.2, cone: 1.0, portee: 6, suit: 2.5, vitesse: 1.5, lachee: 0.6 };
export const GARDIEN = {
  reaction: 0.17, vMax: 5, accel: 14, profondeur: 0.3,   // `reaction` : le retard d'un gardien de cote 10 (sa cote Arrêts l'ôte ou l'ajoute)
  demi: 0.58,        // la demi-largeur qu'il couvre, à une cote de 10, m (0,5 avant la glace courte : de la bleue, à 11 m, il ne reste que 0,28 s pour aller au coin)
  trous: { haut: 0.35, cinq: 0.25, corps: 0.04 },   // ce qui passe quand même : le coin du haut (la mitaine, le bloqueur), entre les jambières, sur le corps (le lot 5 : 0,2 et 0,03 avant, les buts perdus avec les avantages numériques)
  sortie: 1.1,       // à combien devant la ligne il défie, m
  couvre: 0.5,       // la part des arrêts gelés ; l'autre part rebondit
  rebond: 0.35,      // ce qu'un rebond garde de la vitesse
  mitaine: 0.75,     // un tir haut arrêté se gèle aussi souvent que ça : la mitaine l'attrape
  coin: [0.75, 1.3], // le rebond contrôlé part de côté, vers le coin, à cet angle de l'axe du filet, rad ; l'autre sort devant
  demiCercle: 1.8,   // le demi-cercle : une rondelle libre plus lente que `lente` dedans, il va la couvrir, s'il y est le premier
  // L'ÉCRAN (2 nov. 2026) : un patineur, de l'une ou l'autre équipe, sur la ligne de la rondelle au gardien (à `ecranLarge`
  // m de plus que son corps), entre les deux et à `ecranPres` m au moins du gardien, la rondelle à `ecranLoin` m au moins :
  // le gardien la voit `ecran` s plus tard encore, et ce qu'il a vu en dernier reste devant ses yeux le temps de la retrouver.
  ecran: 0.12, ecranLarge: 0.25, ecranPres: 0.7, ecranLoin: 3,
  lente: 3,          // m/s : plus lente que ça, la rondelle qui touche le gardien se gèle
  harpon: { portee: 1.7, repos: 1.2, chance: 0.12, parArret: 0.012 },   // le harpon du gardien sur le porteur qui arrive seul devant lui
  // LE GARDIEN JOUE LA RONDELLE (le lot 5) : libre, plus lente que `lente` m/s, à `derriere` m au moins derrière sa ligne
  // des buts, dans le trapèze, et lui dessus `avance` s avant tout adversaire (un coéquipier, s'il y est `avance` s avant
  // lui, la prend) : il sort la jouer — une remise au coéquipier
  // ouvert (un défenseur d'abord ; aucun adversaire à `couloir` m de la ligne), sinon le long de la bande à `bande` m/s —,
  // puis revient, et n'y retourne pas avant `repos` s. LE TRAPÈZE (la règle de 2005) : derrière la ligne des buts, il
  // ne la joue qu'entre deux lignes à `trapeze` m de l'axe, à la ligne des buts et à la bande (18 et 28 pieds de large) ;
  // dehors, deux minutes. Il la voit `reaction` s en retard : celle qui glisse dehors pendant qu'il y va, c'est la punition.
  jouer: { lente: 5, derriere: 0.3, avance: 0.3, portee: 0.9, couloir: 1.6, bande: 16, repos: 2, trapeze: [9 * PIED, 14 * PIED] },
};
/*
 * L'OBSTRUCTION SUR LE GARDIEN (la règle 69 de la LNH ; JP, 7 nov. 2026 : *l'obstruction sur le gardien*). Un attaquant
 * debout qui entre dans le gardien (à `touche` m/s ou plus vers lui) dans l'enclave (lui ou le gardien à `FILET.enclave` m
 * du centre de la ligne des buts, devant) le bouscule : le gardien recule de l'élan reçu, son corps pèse `masse` kg. Un
 * but dans ce filet moins de `fenetre` s après ce contact est refusé : le sifflet, l'arbitre l'annule, la mise en jeu au
 * point de la zone neutre le plus près, et le tir ne compte pas. Poussé dedans par un adversaire (une mise en échec
 * reçue moins de `pousse` s plus tôt), ou glissant au sol, il n'y est pour rien. Entré à plus de `fort` m/s, sans la
 * rondelle et elle à plus de `loin` m du gardien (il ne la cherchait pas) : deux minutes, l'obstruction sur le gardien
 * (à retardement si le club du gardien a la rondelle).
 */
export const OBSTRUCTION = { touche: 0.5, fort: 5, loin: 3, fenetre: 1.0, pousse: 0.6, masse: 90 };
/*
 * LE PLONGEON DÉSESPÉRÉ DU GARDIEN (7 nov. 2026) : un tir adverse (jamais une passe) qu'il voit venir (avec son retard) vers le filet, là où il
 * n'arrivera pas en glissant (sa vitesse de pointe le temps qui reste), mais à `portee` m de plus : il plonge de ce côté
 * à `elan` m/s. Pendant `duree` s, il couvre `portee` m de plus de ce côté, mais, tendu de tout son long, il laisse
 * passer `trou` des tirs et ne gèle rien ; puis il reste couché `sol` s, glissant sur son élan (`frein` par seconde)
 * sans se replacer : le retour est pour qui le prend.
 */
export const PLONGEON = { portee: 0.45, elan: 3.5, duree: 0.35, sol: 0.7, frein: 8, trou: 0.6 };
export const CHUTE = { seuil: 300, bande: 1.5 };   // l'écart d'élan, kg·m/s, au-delà duquel le moins lancé des deux tombe ; contre la bande, le coup pèse plus
export const HARPON = { duree: 0.25, portee: 2.2, largeur: 0.55, repos: 0.7, pousse: 5, trebuche: 0.04 };   // le harponnage : un coup de bâton devant soi ; raté sur le porteur, un sur vingt-cinq l'accroche
/*
 * LE JEU PHYSIQUE ET LES FAUTES (2 nov. 2026, le lot 4 ; docs/revue-sur-glace-2026-11.md, la proposition 6).
 *
 * SOULEVER LE BÂTON (X sans la rondelle, comme le harpon) : collé au porteur adverse (à `pres` m de lui au plus), de
 * côté (à `cote` rad de son cap : ni devant lui, ni dans son dos), la rondelle à `portee` m de sa lame, il lui lève le
 * bâton et la lui prend. Sans contact, sans punition ; le corps du porteur n'y change rien (il protège ? le harpon passe
 * `PROTEGE.harpon` fois moins, pas le bâton soulevé), sa feinte oui. Il réussit `force` fois ce qu'un harpon ouvert
 * réussirait (la Défense contre le Jeu) ; le porteur ne la reprend pas avant `lachee` s.
 */
export const LEVE = { pres: 1.5, cote: [0.9, 2.3], portee: 1.8, force: 0.8, lachee: 0.5 };
/*
 * LES FAUTES DE BÂTON, chacune un fait et un dé, deux minutes (`punir`). Un harpon raté sur le porteur :
 *   - par-derrière, sur un porteur lancé à plus de `rapide` m/s : l'accrochage (`accroche` des fois), qui le ralentit à `ralenti` ;
 *   - en fonçant sur lui à plus de `fonce` m/s : le cinglage (`cinglage` des fois) ;
 *   - à travers son corps (il protège, le harpon passe par lui) : le bâton élevé (`eleve` des fois).
 * Le trébuchement (`HARPON.trebuche`) reste à part : par-derrière, à toute vitesse, il le fait tomber.
 */
export const FAUTES = { rapide: 6, accroche: 0.1, ralenti: 0.55, fonce: 5, cinglage: 0.025, eleve: 0.08 };
/*
 * LA BAGARRE (NHL 94 l'avait ; le moteur de la saison aussi, `tirerPhysique`, js/sim.js) : après une grosse mise en
 * échec (`gros` fois le seuil de chute) ou une punition, le frappé et le frappeur (le puni et sa victime) laissent tomber
 * les gants, rarement : `chance` × ce que chacun a de rude. Rude, c'est sa Robustesse au-dessus de `robuste` sur 20 (en
 * deçà, jamais), fois ses vraies minutes de punition par match à la LNH sur `pim` (de `pimMin` à `pimMax` fois ; sans
 * donnée, une fois). Une par joueur par match, jamais en prolongation. Le jeu s'arrête ; `duree` s de duel au bouton : A ou
 * X martelés pour toi, `cadence` coups par seconde pour l'IA (sa Robustesse en ajoute ou en ôte le quart) ; chaque coup
 * pèse sa Robustesse et sa masse. Cinq minutes chacun au cachot (`minutes`), coïncidentes : les deux clubs restent à cinq.
 */
/*
 * LE DOUBLE-ÉCHEC (7 nov. 2026) : la mise en échec donnée le bâton levé à deux mains — le bouton d'échec pendant le coup
 * de bâton (X puis B, ou B puis X, à moins de `fenetre` s l'un de l'autre). Le manche frappe : le coup pèse `force` fois plus
 * (il renverse plus souvent), et l'arbitre le voit `siffle` des fois : deux minutes.
 *
 * LA RUDESSE APRÈS LE SIFFLET : le jeu arrêté (pas après un but, ni à la fin d'une période), le bouton d'échec à `portee` m d'un adversaire le bouscule (il recule de
 * `recul` m) : deux minutes, sur-le-champ. L'IA ne le fait que si elle est rude (sa Robustesse et ses minutes de
 * punition à la LNH, comme la bagarre), une fois par arrêt de jeu au plus, `ia` × sa rudesse des fois.
 */
export const DOUBLE = { force: 1.25, siffle: 0.5, fenetre: 0.35 };
export const RUDESSE = { portee: 1.5, recul: 0.4, ia: 0.02 };
/*
 * SE JETER DEVANT UN TIR (7 nov. 2026) : sans la rondelle, le bouton d'échec en reculant (LB tenu, puis B) couche le
 * patineur sur la glace, en travers de son cap, `duree` s : il glisse sur son élan, son corps fait un mur de `long` m
 * (`epais` m d'épaisseur) jusqu'à `haut` m de haut — un tir bas s'y bloque, un tir haut passe par-dessus. Puis il se
 * relève, comme après une chute : le prix du geste.
 */
export const PLONGE = { duree: 1.1, long: 1.7, epais: 0.2, haut: 0.35 };
export const BAGARRE = { gros: 3, chance: 0.75, robuste: 11, pim: 1.0, pimMin: 0.3, pimMax: 3, duree: 3.5, cadence: 5, minutes: 5 };
const ECHEC = { duree: 0.35, repos: 1.2, accel: 2, vMax: 1.15, derriere: 0.8, recent: 1.0 };   // l'élan d'une mise en échec ; par-derrière et sur qui n'a pas la rondelle, c'est puni
// La fatigue d'une présence : ce qu'elle coûte par seconde, ce que le banc rend, quand on change à l'arrêt ; À LA VOLÉE (le lot 3),
// la ligne dont les jambes passent sous `volee` file au banc si une ligne du banc en a `frais` (js/glace-ia.js le décide).
export const JAMBES = { usure: 1.8, repos: 6, changement: 55, presence: 45, volee: 60, frais: 80 };
/*
 * LE BANC (le lot 3) : chaque club a sa porte sur la bande du haut (+y), à `x` m du centre, du côté de son filet de la
 * première période (les clubs changent de bout, pas de banc : en deuxième, la longue présence). Un patineur qui arrive à
 * `porte` m de sa porte en demandant le banc sort ; le plus reposé de son groupe saute sur la glace par la même porte,
 * au même instant : jamais un patineur de trop.
 */
export const BANC = { x: 5, porte: 1.4 };
/*
 * LA CÉLÉBRATION D'UN BUT (le lot 5) : le jeu arrêté, pendant `duree` s, les coéquipiers du buteur patinent vers lui (à
 * `vitesse` m/s au plus) et se serrent à `rayon` m autour de lui ; les autres freinent (`frein`, par seconde). Puis l'écran
 * passe la reprise (js/sur-glace.js). Rien qui compte : la mise en jeu au centre replace tout le monde.
 */
export const CELEBRATION = { duree: 2.5, vitesse: 5, rayon: 1.0, frein: 1.5 };
export const porteDuBanc = eq => ({ x: (eq === 'A' ? -1 : 1) * BANC.x, y: W / 2 - PATIN.rayon - 0.1 });
const TAMPON = 0.10;   // le tampon d'entrée, s : un appui de passe ou de tir dans cette fenêtre avant la prise compte quand même
export const MATCH = {
  periode: 180, prolongation: 120, surglace: 5, surglaceOT: 3, rondesFusillade: 3, retraitGardien: 90, tirDePunition: 12,
  punition: 120, pauses: { but: 3.5, refuse: 2.5, gel: 1.2, horsjeu: 1.2, degagement: 1.2, punition: 1.5, bagarre: 1.5, periode: 3, fin: 0 },
};

/* ---------- les outils ---------- */
const hyp = Math.hypot;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const plier = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const autre = eq => (eq === 'A' ? 'B' : 'A');

/* La lame d'un patineur : devant lui, du côté de sa main (`s.av` devant, `s.lat` de côté, + à sa droite). */
export function lame(s) {
  const c = Math.cos(s.cap), n = Math.sin(s.cap);
  const av = s.av ?? BATON.lame[0], lat = s.lat ?? BATON.lame[1];
  return { x: s.x + c * av - n * lat, y: s.y + n * av + c * lat };
}

/* ---------- les vrais joueurs → des paramètres physiques ---------- */
/*
 * Les cotes sur 20 (js/niveaux.js, `axes20` et `cote20`) deviennent des mètres par seconde. Rien de neuf : la cote
 * générale (le niveau), Tir, Jeu, Défense, Robustesse, et le poids de la LNH. Sans cote (un joueur qui a peu joué),
 * un patineur ordinaire (10).
 */
export function parametresDuPatineur({ cote = 10, tir = 10, jeu = 10, defense = 10, robustesse = 10, poidsLb = null, vitesse = false, main = 'G', pim = null } = {}) {
  // Les cotes se sentent (JP, 1er nov. : *que les stats des joueurs aient un impact*) : ±20 % de lancer ; la pointe et la
  // poussée, elles, restent proches (`PATIN.ecart`) : la vitesse ne doit pas rendre un club injouable.
  const f = 1 + PATIN.ecart * (clamp(cote, 1, 20) - 10.5) / 9.5;
  const masse = poidsLb ? poidsLb * 0.4536 : PATIN.masse;
  return {
    vMax: PATIN.vMax * f * (vitesse ? 1 + PATIN.ecart / 2 : 1),
    accel: PATIN.accel * f,
    tir: 0.8 + 0.02 * tir,                // × la vitesse du lancer
    precision: 1.4 - 0.04 * tir,          // × l'écart de la visée
    passe: 1.5 - 0.04 * jeu,              // × l'écart de la passe
    mej: clamp(jeu, 1, 20) / 20,          // la mise en jeu : sa cote Jeu, sur 20 (`MEJ.jeu`)
    defense: defense / 20,                // le harpon
    masse,
    equilibre: 0.7 + 0.03 * robustesse,   // × le seuil de chute
    agilite: 1 + clamp((PATIN.masse - masse) / 300, -PATIN.agilite, PATIN.agilite),   // un petit tourne un peu plus court : × l'adhérence et le pivot
    main: main === 'D' ? 1 : -1,          // sa main (le côté de sa lame, + à sa droite) : un droitier, un gaucher (la LNH le dit)
    robuste: clamp(robustesse, 1, 20) / 20,          // la bagarre : sa Robustesse sur 20 (le lot 4)
    pim: pim == null ? null : Math.max(0, pim),      // … et ses vraies minutes de punition par match à la LNH, si le shard les a
  };
}
/* La difficulté : ce que le club de l'IA vaut de plus ou de moins (JP : *toutes les mécaniques*). */
export const DIFFICULTES = { facile: 0.93, normal: 1, difficile: 1.07 };
export function parametresDuGardien({ arrets = 10 } = {}) {
  // `controle` : la part de ses rebonds qu'il envoie au coin, et sa chance au harpon, de sa cote Arrêts.
  return { reaction: GARDIEN.reaction - 0.004 * (arrets - 10), demi: GARDIEN.demi + 0.005 * (arrets - 10), vMax: GARDIEN.vMax, controle: 0.25 + 0.025 * arrets, harpon: GARDIEN.harpon.chance + GARDIEN.harpon.parArret * arrets };
}

/* ---------- l'état ---------- */
function patineur(id, equipe, x, y, cap, extra = {}) {
  const p = extra.p || parametresDuPatineur();
  return {
    id, equipe, poste: extra.poste || 'C', nom: extra.nom || id, visage: extra.visage || null, ligne: extra.ligne ?? 0,
    x, y, vx: 0, vy: 0, cap, masse: p.masse, rayon: PATIN.rayon, p,
    auSol: 0, foulee: 0, pousse: 0, virage: 0, freine: false, charge: 0, lachee: 0, tenaitTir: false, tenaitPasse: false, tenaitEchec: false,
    harpon: 0, harponRepos: 0, elan: 0, elanRepos: 0, jambes: 100, surGlace: true, boxe: false, touche: -10, tamponPasse: -1, tamponTir: -1,
    av: BATON.lame[0], lat: (p.main || -1) * BATON.cote, protege: false, feinte: 0, feinteRepos: 0, feinteCote: 0, feinteT: -99, feinteUsee: false, tenaitFeinte: false, mordu: null,
    poste0: extra.poste0 || null, ia: null, stats: { buts: 0, aides: 0, tirs: 0, echecs: 0, blocs: 0, tg: 0 },
  };
}
function gardienNeuf(equipe, sens, extra = {}) {
  const p = extra.p || parametresDuGardien();
  return { equipe, sens, nom: extra.nom || 'le gardien', visage: extra.visage || null, p, x: sens * (LIGNE_BUT - GARDIEN.sortie), y: 0, vx: 0, vy: 0, memoire: [], retire: false, arrets: 0, harponRepos: 0, joue: false, jouerRepos: 0 };
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
    mode: 'match', graine, de: generateur(graine), t: 0, reste: 0, ia, humains: quiJoue, controles: { A: null, B: null }, changeTenu: {}, ligneTenue: {},
    rondelle: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, porteur: null, dernier: null, passeDe: null, passeVers: null },
    patineurs: [], gardiens: [], equipes: {},
    compte: { tirs: 0, buts: 0, arrets: 0, poteaux: 0, echecs: 0 },
    arret: null, dernierTir: 0, enJeu: false, mej: null,
    regles: { horsjeu: regles.horsjeu !== false, degagement: regles.degagement !== false },
    match: {
      periode: 1, duree: periode, reste: periode, dureeOT: prolongation, prolongation: false, series: !!series, fini: false, vainqueur: null,
      pointage: { A: 0, B: 0 }, refuses: { A: 0, B: 0 }, tirs: { A: 0, B: 0 }, echecs: { A: 0, B: 0 }, mej: { A: 0, B: 0 }, pim: { A: 0, B: 0 }, blocs: { A: 0, B: 0 },
      penalites: [], enAttente: null, horsJeuDiffere: null, fusillade: null, ronde: null, tirDePunition: null, journal: [], touches: { A: [], B: [] }, etoiles: [],
      bagarre: null, bagarres: [],
    },
  };
  const f = DIFFICULTES[difficulte] || 1;
  for (const [eq, club] of [['A', A], ['B', B]]) {
    const attaque = eq === 'A' ? 1 : -1;
    // LES PUNITIONS À L'ÉPOQUE DU CLUB (V25 A2) : les fautes de bâton se sifflent au rythme de sa saison, lu dans le moteur.
    const E = { attaque, nom: club.nom || eq, tag: club.tag || eq, lignes: { F: [[], [], []], D: [[], []] }, enPoste: { F: 0, D: 0 }, presence: 0, punitions: facteurPunitionsEpoque(club.annee) };
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
  // Placés dès le coup de sifflet du début (ils attendaient, les cinq empilés au même point, la première mise en jeu).
  placerMiseEnJeu(etat, { x: 0, y: 0 }); etat.mej = null;
  arreter(etat, 'debut', { x: 0, y: 0 }, 0.5);
  return etat;
}

const gardienDe = (etat, eq) => etat.gardiens.find(g => g.equipe === eq) || etat.gardiens[0];
export const surGlace = (etat, eq) => etat.patineurs.filter(s => s.equipe === eq && s.surGlace);
const parId = (etat, id) => etat.patineurs.find(s => s.id === id);
/* Les punis qui comptent pour l'avantage numérique : une majeure de bagarre est coïncidente (`avantage`, les secondes qui comptent encore). */
export const penalisesDe = (etat, eq) => etat.match.penalites.filter(p => p.equipe === eq && p.avantage > 0).length;
/* Combien de patineurs une équipe a droit sur la glace : cinq, trois en prolongation, moins ses punis, trois au moins. */
export function droitSurGlace(etat, eq) {
  const base = etat.match.prolongation && !etat.match.series ? MATCH.surglaceOT : MATCH.surglace;
  const sixieme = gardienDe(etat, eq).retire ? 1 : 0;
  return Math.max(3, base - penalisesDe(etat, eq)) + sixieme;
}
/*
 * RETIRER LE GARDIEN (un sixième attaquant) : il va au banc tout de suite, le patineur le plus reposé du banc saute sur
 * la glace par la porte ; remis en plein jeu, il attend qu'un patineur sorte par la porte (le lot 3 : il revenait avec
 * les six sur la glace), et à l'arrêt de jeu, il revient tout de suite. L'IA le fait d'elle-même en fin de match quand
 * elle tire de l'arrière (`MATCH.retraitGardien` secondes), et le remet si elle revient à égalité.
 */
export function retirerGardien(etat, eq, oui) {
  const Gd = gardienDe(etat, eq);
  if (!etat.match) return;
  if (!oui) { if (Gd.retire) { if (etat.enJeu && !etat.arret) Gd.retour = true; else { Gd.retire = false; Gd.retour = false; } } return; }
  if (Gd.retour) { Gd.retour = false; return; }
  if (Gd.retire) return;
  Gd.retire = true;
  Object.assign(Gd, { x: (eq === 'A' ? -1 : 1) * BANC.x, y: W / 2 + 1.2, vx: 0, vy: 0 });
  const banc = etat.patineurs.filter(s => s.equipe === eq && !s.surGlace && !s.boxe).sort((a, b) => b.jambes - a.jambes)[0];
  if (banc) { const porte = porteDuBanc(eq); banc.surGlace = true; banc.x = porte.x; banc.y = porte.y; banc.vx = 0; banc.vy = 0; banc.cap = -Math.PI / 2; }
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
  // LE TRIO QUE TU CHOISIS (Y à l'arrêt de jeu, comme NHL 94) : c'est lui qui joue, les jambes n'y changent rien.
  if (E.choix != null && E.lignes.F[E.choix] && E.lignes.F[E.choix].length) { if (E.choix !== E.enPoste.F) { E.enPoste.F = E.choix; change = true; } }
  for (const g of ['F', 'D']) {
    const lignes = E.lignes[g].filter(l => l.length);
    if (lignes.length < 2 || (g === 'F' && E.choix != null)) continue;
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
  E.choix = null;
}
/*
 * CHOISIR SON TRIO (le lot 3) : à un arrêt de jeu, Y (`ligne`) passe au trio suivant ; il saute sur la glace pour la
 * mise en jeu, qui se replace (la rondelle tombe `MEJ.chute` s plus tard). Une fois que la rondelle est tombée, c'est fini.
 */
function choisirTrio(etat, eq, ev) {
  const E = etat.equipes[eq];
  const n = E.lignes.F.length;
  let k = E.choix != null ? E.choix : E.enPoste.F;
  for (let i = 0; i < n; i++) { k = (k + 1) % n; if (E.lignes.F[k].length) break; }
  E.choix = k;
  if (etat.mej) placerMiseEnJeu(etat, etat.mej.point);
  const ids = E.lignes.F[k];
  ev.push({ type: 'trio', equipe: eq, ligne: k, jambes: Math.round(ids.reduce((a, id) => a + parId(etat, id).jambes, 0) / Math.max(1, ids.length)) });
}
/* Y à l'arrêt de jeu, pour chaque humain : un appui, un trio. */
function lireLesTrios(etat, entrees, ev) {
  for (const eq of etat.humains) {
    const ctl = etat.controles[eq], e = ctl ? entrees[ctl] : null;
    const veut = !!(e && e.ligne);
    if (veut && !etat.ligneTenue[eq] && !(etat.mej && etat.mej.appuis[eq])) choisirTrio(etat, eq, ev);
    etat.ligneTenue[eq] = veut;
  }
}

/* ---------- la patinoire : la bande, les coins, le filet ---------- */
/* LA RONDELLE QUI LONGE LA BANDE (7 nov. 2026) : `mu` freine ce qui file le long d'elle, à cette part de la poussée qui
 * la frappe (Coulomb : un coup franc freine plus qu'un frôlement) ; ce qui la frôle à moins de `colle` m/s en travers ne
 * rebondit pas : il reste collé et roule le long. Le patineur n'a ni l'un ni l'autre (0). */
export function bander(o, r, rest, mu = 0, colle = 0) {
  const X = L / 2, Y = W / 2;
  const rend = vn => vn < colle ? 0 : rest;
  const frotte = (t, imp) => Math.sign(t) * Math.max(0, Math.abs(t) - mu * imp);
  let choc = 0;
  if (Math.abs(o.x) > X - COIN && Math.abs(o.y) > Y - COIN) {
    const cx = Math.sign(o.x) * (X - COIN), cy = Math.sign(o.y) * (Y - COIN);
    const dx = o.x - cx, dy = o.y - cy, d = hyp(dx, dy) || 1e-9;
    if (d > COIN - r) {
      const nx = dx / d, ny = dy / d;
      o.x = cx + nx * (COIN - r); o.y = cy + ny * (COIN - r);
      const vn = o.vx * nx + o.vy * ny;
      if (vn > 0) {
        const re = rend(vn), tx = o.vx - vn * nx, ty = o.vy - vn * ny, vt = hyp(tx, ty);
        const k = vt > 0 ? Math.max(0, vt - mu * (1 + re) * vn) / vt : 0;
        o.vx = tx * k - re * vn * nx; o.vy = ty * k - re * vn * ny; choc = vn;
      }
    }
    return choc;
  }
  if (o.x > X - r) { o.x = X - r; if (o.vx > 0) { choc = o.vx; const re = rend(o.vx); o.vy = frotte(o.vy, (1 + re) * o.vx); o.vx = -o.vx * re; } }
  else if (o.x < -X + r) { o.x = -X + r; if (o.vx < 0) { choc = -o.vx; const re = rend(-o.vx); o.vy = frotte(o.vy, (1 + re) * -o.vx); o.vx = -o.vx * re; } }
  if (o.y > Y - r) { o.y = Y - r; if (o.vy > 0) { choc = Math.max(choc, o.vy); const re = rend(o.vy); o.vx = frotte(o.vx, (1 + re) * o.vy); o.vy = -o.vy * re; } }
  else if (o.y < -Y + r) { o.y = -Y + r; if (o.vy < 0) { choc = Math.max(choc, -o.vy); const re = rend(-o.vy); o.vx = frotte(o.vx, (1 + re) * -o.vy); o.vy = -o.vy * re; } }
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
    if (s.couche > 0) s.couche -= PAS;
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
  s.freine = false;
  if (m > 0.1) {
    const phi = Math.atan2(e.y, e.x);
    // À RECULONS : on regarde à l'opposé de là où l'on va (le défenseur face au porteur), et l'on pousse dans le bâton.
    const d = plier((recul ? phi + Math.PI : phi) - s.cap);
    if (!recul && Math.abs(d) > 2.1 && v > 1.2) {
      const f = Math.max(0, v - PATIN.frein * m * PAS) / v;
      s.vx *= f; s.vy *= f;
      s.cap += clamp(d, -1, 1) * PAS;
      s.freine = true;   // l'arrêt hockey : le sprite met les lames en travers, la glace gicle
    } else {
      const omegaMax = Math.min(PATIN.pivot * agilite, PATIN.adherence * agilite / Math.max(v, 0.5));
      omega = clamp(d * 6, -omegaMax, omegaMax);
      s.cap += omega * PAS;
      pousse = accel * m * Math.max(0, Math.cos(d)) * (s.charge > 0 ? 0.5 : 1) * (s.feinte > 0 ? FEINTE.pousse : 1);
      // LES CROISÉS : en tournant à vitesse moyenne, on pousse plus fort que tout droit.
      if (Math.abs(omega) > 0.4 && v > 2 && v < 0.9 * vMax) pousse *= PATIN.croise;
      // LA FOULÉE : le coup de patin, une jambe puis l'autre ; la phase n'avance que si l'on pousse.
      if (pousse > 0) s.foulee = (s.foulee + (FOULEE.cadence + FOULEE.parVitesse * v) * PAS) % 1;
      pousse *= 1 + FOULEE.coup * Math.cos(4 * Math.PI * (s.foulee + 0.125));   // au milieu de la poussée de chaque jambe (la droite pousse de ½ à 1, la gauche de 0 à ½)
      const sens = recul ? phi : s.cap;
      s.vx += Math.cos(sens) * pousse * PAS; s.vy += Math.sin(sens) * pousse * PAS;
    }
  }
  s.pousse = pousse > 0 ? m : 0; s.virage = omega;   // ce que le sprite lit : pousse-t-il, et tourne-t-il
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

/*
 * LA LAME (le lot 3) : où elle tient la rondelle, à chaque pas. Du côté de sa main ; le porteur lent qui a un adversaire
 * collé la passe de l'autre côté de son corps (PROTÉGER) ; la feinte la déporte d'un mètre un instant (`FEINTE`). Elle y
 * va à `BATON.lameVite` m/s, pas d'un coup : la rondelle la suit au ressort.
 */
function manier(etat, s, e, ev) {
  if (s.feinte > 0) s.feinte -= PAS;
  if (s.feinteRepos > 0) s.feinteRepos -= PAS;
  const porte = etat.rondelle.porteur === s.id;
  const main = s.p.main || -1;
  let av = BATON.lame[0], lat = main * BATON.cote;
  s.protege = false;
  if (porte && s.auSol <= 0) {
    const c = Math.cos(s.cap), n = Math.sin(s.cap);
    // LA FEINTE : Y avec la rondelle (le bâton dit de quel côté ; au neutre, vers le revers).
    if (e && e.feinte && !s.tenaitFeinte && s.feinteRepos <= 0 && s.charge <= 0) {
      const travers = -(e.x || 0) * n + (e.y || 0) * c;
      s.feinte = FEINTE.duree; s.feinteRepos = FEINTE.repos;
      s.feinteUsee = etat.t - s.feinteT < FEINTE.usee; s.feinteT = etat.t;
      s.feinteCote = Math.abs(travers) > 0.3 ? Math.sign(travers) : -main;
      ev.push({ type: 'feinte', qui: s.id, cote: s.feinteCote });
    }
    if (s.feinte > 0) lat = clamp(main * BATON.cote + s.feinteCote * FEINTE.ecart, -FEINTE.ecart, FEINTE.ecart);
    else if (hyp(s.vx, s.vy) < PROTEGE.vitesse && s.charge <= 0) {
      // PROTÉGER : l'adversaire debout le plus près, à portée : la lame de l'autre côté du corps.
      let o = null, d = PROTEGE.pres;
      for (const q of etat.patineurs) if (q.surGlace && q.equipe !== s.equipe && q.auSol <= 0) { const dq = hyp(q.x - s.x, q.y - s.y); if (dq < d) { d = dq; o = q; } }
      if (o) {
        const travers = -(o.x - s.x) * n + (o.y - s.y) * c;
        s.protege = true;
        av = PROTEGE.avant;
        lat = Math.abs(travers) > 0.2 ? -Math.sign(travers) * PROTEGE.cote : Math.sign(s.lat || main) * PROTEGE.cote;
      }
    }
  } else s.feinte = 0;
  const pas = BATON.lameVite * PAS;
  s.lat += clamp(lat - s.lat, -pas, pas);
  s.av += clamp(av - s.av, -pas, pas);
}
/* La feinte de `p` lue par `s` (`litLaFeinte`) : le geste se joue comme sans elle, et l'écran le dit. */
function lue(etat, s, p, geste, ev) {
  if (!litLaFeinte(etat, s, p)) return false;
  ev.push({ type: 'feinteLue', qui: s.id, sur: p.id, geste });
  return true;
}
/* Le corps du porteur entre le harponneur et la rondelle : la ligne de l'un à l'autre passe par lui. */
function corpsEntre(h, p, R) {
  const dx = R.x - h.x, dy = R.y - h.y, d2 = dx * dx + dy * dy || 1e-9;
  const t = ((p.x - h.x) * dx + (p.y - h.y) * dy) / d2;
  if (t <= 0 || t >= 1) return false;
  return hyp(p.x - (h.x + t * dx), p.y - (h.y + t * dy)) < p.rayon + PROTEGE.marge;
}
/* LE REVERS : la rondelle part-elle de l'autre côté du corps (la lame passée de l'autre côté, ou lancée trop loin vers lui) ? */
export function auRevers(s, ang) {
  const main = s.p.main || -1;
  return s.lat * main < -REVERS.cote || plier(ang - s.cap) * main < -REVERS.angle;
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
/* `q` montre le dos à `s` : `s` est derrière lui, à moins de `ECHEC.derriere` (en cosinus) de l'axe de son dos. */
function dosTourne(s, q) {
  const d = hyp(q.x - s.x, q.y - s.y) || 1e-9;
  return ((q.x - s.x) * Math.cos(q.cap) + (q.y - s.y) * Math.sin(q.cap)) / d > ECHEC.derriere;
}
function collisions(etat, ev) {
  const P = etat.patineurs.filter(s => s.surGlace);
  for (const s of P) for (const g of etat.gardiens) {
    if (g.retire) continue;
    const vn = contreCercle(s, s.rayon, g.x, g.y, 0.45, 0.1);
    if (vn >= OBSTRUCTION.touche) contreLeGardien(etat, s, g, vn, ev);
  }
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
    // Le bâton levé à deux mains (`DOUBLE`) : le manche frappe, le coup pèse plus.
    const deuxMains = frappeur.elan > 0 && etat.t - (frappeur.harponT ?? -Infinity) < DOUBLE.fenetre;
    const poids = Math.abs(ecart) * (contreLaBande ? CHUTE.bande : 1) * (deuxMains ? DOUBLE.force : 1);
    // Lancé pendant la feinte du porteur, l'élan a mordu : il le frôle sans le renverser.
    const mordu = frappeur.elan > 0 && frappeur.mordu === frappe.id;
    const fort = poids > CHUTE.seuil * frappe.p.equilibre && vf > 4 && !mordu;
    ev.push({ type: 'echec', fort, qui: frappeur.id, sur: frappe.id, poids: Math.round(poids), deuxMains });
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
      // Par-derrière : le frappeur arrive dans le dos du frappé (sa position, projetée sur le cap du frappé), et le frappé
      // le lui montrait déjà quand il s'est élancé (le lot 5, la règle 43 de la LNH : celui qui se retourne au dernier
      // instant, la rondelle partie, se met lui-même en danger ; c'était 0,8 punition par match sur 1,9, chaque fois un
      // joueur qui venait de passer et se détournait, chargé de face).
      const parDerriere = dosTourne(frappeur, frappe) && (frappeur.elanDos || []).includes(frappe.id);
      const loinDeLaRondelle = hyp(frappe.x - etat.rondelle.x, frappe.y - etat.rondelle.y) > 3;
      const sansRondelle = etat.rondelle.porteur !== frappe.id && etat.t - frappe.touche > ECHEC.recent && loinDeLaRondelle;
      if (parDerriere) punir(etat, frappeur, contreLaBande ? 'charge contre la bande' : 'charge par-derrière', ev, frappe);
      else if (deuxMains && etat.de() < DOUBLE.siffle) punir(etat, frappeur, 'double-échec', ev, frappe);
      else if (sansRondelle) punir(etat, frappeur, 'obstruction', ev, frappe);
    }
    // UN GROS COUP (le lot 4) : le frappé, s'il est rude, peut laisser tomber les gants.
    if (fort && poids > CHUTE.seuil * BAGARRE.gros) gants(etat, frappe, frappeur, ev);
  }
}

/* L'OBSTRUCTION SUR LE GARDIEN (`OBSTRUCTION`) : le patineur `s` vient d'entrer dans le gardien `g` à `vn` m/s. */
function contreLeGardien(etat, s, g, vn, ev) {
  const xb = g.sens * LIGNE_BUT, dansLEnclave = q => q.x * g.sens <= LIGNE_BUT && hyp(q.x - xb, q.y) < FILET.enclave + (q.rayon || 0);
  // le gardien reçoit l'élan que le patineur perd (son rebond à 0,1), dans la direction du choc
  const dx = g.x - s.x, dy = g.y - s.y, d = hyp(dx, dy) || 1e-9, dv = 1.1 * vn * s.masse / OBSTRUCTION.masse;
  g.vx += dx / d * dv; g.vy += dy / d * dv;
  if (s.equipe === g.equipe || !etat.match || !(dansLEnclave(s) || dansLEnclave(g))) return;
  if (s.auSol > 0) return;   // il glisse au sol : il n'y est pour rien
  if (etat.patineurs.some(q => q.equipe !== s.equipe && q.choc && q.choc.sur === s.id && etat.t - q.choc.t < OBSTRUCTION.pousse)) return;   // un adversaire l'a poussé dedans
  g.obstrue = { t: etat.t, qui: s.id, equipe: s.equipe };
  ev.push({ type: 'obstrue', qui: s.id, equipe: s.equipe, gardien: g.equipe, v: Math.round(vn * 10) / 10 });
  // la punition : entré fort, sans la rondelle et la rondelle loin du gardien (il ne la cherchait pas) ; le porteur qui
  // file au filet, ou qui court au retour, le heurte sans le vouloir : le but refusé suffit
  const R = etat.rondelle;
  if (vn > OBSTRUCTION.fort && !etat.match.ronde && R.porteur !== s.id && hyp(R.x - g.x, R.y - g.y) > OBSTRUCTION.loin) punir(etat, s, 'obstruction sur le gardien', ev);
}

/* ---------- le harpon ---------- */
/*
 * LE HARPONNAGE : un coup de bâton devant soi (`HARPON.duree`), qui dégage la rondelle d'un porteur adverse ou libre
 * dans sa zone (un couloir de `portee` sur `largeur`), selon sa Défense contre le Jeu du porteur. Sur un corps sans
 * rondelle, un sur six fait trébucher : deux minutes.
 */
/* Le Jeu du porteur contre la Défense de celui qui lui prend la rondelle : la chance d'un harpon ouvert. */
const duelDeBaton = (s, p) => clamp(0.5 + (s.p.defense - (1.4 - p.p.passe) / 0.03 / 20) * 0.6, 0.25, 0.85);
function harponner(etat, s, ev) {
  const R = etat.rondelle;
  const c = Math.cos(s.cap), n = Math.sin(s.cap);
  const dansLeCouloir = (x, y) => { const u = (x - s.x) * c + (y - s.y) * n, v = -(x - s.x) * n + (y - s.y) * c; return u > 0.3 && u < HARPON.portee && Math.abs(v) < HARPON.largeur; };
  const porteur = R.porteur ? parId(etat, R.porteur) : null;
  const notrePasse = !porteur && R.passeDe && parId(etat, R.passeDe) && parId(etat, R.passeDe).equipe === s.equipe;
  if (dansLeCouloir(R.x, R.y) && R.z < 0.4 && (!porteur || porteur.equipe !== s.equipe) && !notrePasse) {
    // Le porteur qui feinte : le harpon va où la rondelle était, il a mordu. Le corps du porteur entre lui et la rondelle :
    // il protège, le harpon passe moins (`PROTEGE.harpon`).
    const mordu = !!porteur && porteur.feinte > 0 && !lue(etat, s, porteur, 'harpon', ev);
    const protege = !!porteur && corpsEntre(s, porteur, R);
    const chance = !porteur ? 1 : mordu ? 0 : duelDeBaton(s, porteur) * (protege ? PROTEGE.harpon : 1);
    if (mordu) ev.push({ type: 'mordu', qui: s.id, sur: porteur.id, geste: 'harpon' });
    if (etat.de() < chance) {
      if (porteur) { R.porteur = null; porteur.lachee = 0.4; }
      R.vx = c * HARPON.pousse + (etat.de() - 0.5) * 3; R.vy = n * HARPON.pousse + (etat.de() - 0.5) * 3;
      toucher(etat, s, false);
      s.lachee = 0.2;
      ev.push({ type: 'harpon', qui: s.id });
    } else if (porteur) fauteDeBaton(etat, s, porteur, protege, ev);
    s.harpon = 0;
  }
}
/*
 * LE HARPON RATÉ SUR LE PORTEUR, ses fautes (`HARPON.trebuche`, `FAUTES`) : par-derrière, il trébuche (sur une échappée,
 * un tir de punition) ; par-derrière sur un porteur lancé, l'accrochage ; en fonçant sur lui, le cinglage ; à travers
 * son corps, le bâton élevé.
 */
function fauteDeBaton(etat, s, p, protege, ev) {
  const d = hyp(p.x - s.x, p.y - s.y) || 1e-9;
  const derriere = (p.x - s.x) * Math.cos(p.cap) + (p.y - s.y) * Math.sin(p.cap) > 0;
  const fonce = ((s.vx - p.vx) * (p.x - s.x) + (s.vy - p.vy) * (p.y - s.y)) / d;
  const enMatch = etat.match && !etat.match.ronde;
  const epoque = (etat.equipes[s.equipe] && etat.equipes[s.equipe].punitions) || 1;
  if (derriere && etat.de() < HARPON.trebuche) {
    // Le harpon rate, par-derrière, et accroche les patins du porteur : il tombe, deux minutes ; sur une échappée, un tir de punition.
    p.auSol = PATIN.sol * 0.8;
    if (enMatch) {
      if (enEchappee(etat, p)) accorderTirDePunition(etat, p, s, ev);
      else punir(etat, s, 'avoir fait trébucher', ev, p);
    }
  } else if (derriere && hyp(p.vx, p.vy) > FAUTES.rapide && etat.de() < FAUTES.accroche * epoque) {
    p.vx *= FAUTES.ralenti; p.vy *= FAUTES.ralenti;
    if (enMatch) punir(etat, s, 'accrochage', ev, p);
  } else if (protege && etat.de() < FAUTES.eleve * epoque) {
    if (enMatch) punir(etat, s, 'bâton élevé', ev, p);
  } else if (!protege && fonce > FAUTES.fonce && etat.de() < FAUTES.cinglage * epoque) {
    if (enMatch) punir(etat, s, 'cinglage', ev, p);
  }
}
/* SOULEVER LE BÂTON : le porteur adverse à qui `s` le lèverait (collé, de côté, la rondelle à portée de sa lame), sinon null. */
export function leveraitLeBaton(etat, s) {
  const R = etat.rondelle, p = R.porteur ? parId(etat, R.porteur) : null;
  if (!p || p.equipe === s.equipe || s.auSol > 0 || !s.surGlace) return null;
  const dx = s.x - p.x, dy = s.y - p.y;
  if (hyp(dx, dy) > LEVE.pres) return null;
  const ang = Math.abs(plier(Math.atan2(dy, dx) - p.cap));
  if (ang < LEVE.cote[0] || ang > LEVE.cote[1]) return null;
  const lm = lame(s);
  return hyp(R.x - lm.x, R.y - lm.y) < LEVE.portee && !prendraitHorsJeu(etat, s) ? p : null;
}
function soulever(etat, s, p, ev) {
  const R = etat.rondelle;
  const mordu = p.feinte > 0 && !lue(etat, s, p, 'leve', ev);
  if (mordu) ev.push({ type: 'mordu', qui: s.id, sur: p.id, geste: 'leve' });
  const ok = !mordu && etat.de() < duelDeBaton(s, p) * LEVE.force;
  ev.push({ type: 'leve', qui: s.id, sur: p.id, ok });
  if (!ok) return;
  R.porteur = s.id; p.lachee = LEVE.lachee;
  s.leve = true;   // X encore tenu : le lâcher ne tirera pas
  toucher(etat, s, false);
  if (etat.humains.includes(s.equipe)) etat.controles[s.equipe] = s.id;
  ev.push({ type: 'prise', qui: s.id, passe: false });
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

/*
 * LA PRISE QUI SERAIT HORS-JEU (2 nov. 2026 ; mesuré : 4,3 hors-jeu par match de 6 min, l'IA contre l'IA, la plupart
 * dans les mêlées à la bleue). La lame prend d'elle-même la rondelle qui passe à sa portée. Le bras levé pour son équipe,
 * un joueur dans la zone lève son bâton : il ne la prend que s'il la VISE, le bâton poussé vers elle (`VISE.appui` au
 * moins, à `VISE.cone` rad près). La rondelle hors de la zone, un coéquipier dedans, la lame ne la prend pas si la prendre
 * la ramènerait dans la zone, hors-jeu : la lame encore dedans, ou la rondelle trop vite pour s'arrêter avant la ligne.
 * Pour toi comme pour l'IA ; le corps, lui, la dévie toujours.
 */
const VISE = { appui: 0.5, cone: 1.0 };
function viseLaRondelle(s, e, R) {
  const m = e ? hyp(e.x || 0, e.y || 0) : 0;
  if (m < VISE.appui) return false;
  const dx = R.x - s.x, dy = R.y - s.y, d = hyp(dx, dy) || 1e-9;
  return (e.x * dx + e.y * dy) / (m * d) > Math.cos(VISE.cone);
}
/* Toucher la rondelle, pour `s`, serait-il un hors-jeu ? 'differe' : le bras levé ; 'ramene' : sa lame la ramènerait dans la zone. */
function prendraitHorsJeu(etat, s) {
  const M = etat.match;
  if (!M || !etat.regles.horsjeu || M.ronde) return null;
  const a = etat.equipes[s.equipe].attaque, R = etat.rondelle;
  if (M.horsJeuDiffere === s.equipe) return R.x * a > BLEUE ? 'differe' : null;
  if (R.x * a > BLEUE) return null;
  // Où la rondelle s'arrêtera sur sa lame : la lame, plus ce qu'elle glisse encore le temps que la lame l'amortisse.
  const lm = lame(s), vx = R.vx - s.vx, vy = R.vy - s.vy, vr = hyp(vx, vy);
  const fin = lm.x + vx * vr / (2 * BATON.maniement);
  if (Math.max(lm.x * a, fin * a) <= BLEUE) return null;
  return etat.patineurs.some(p => p.surGlace && p !== s && p.equipe === s.equipe && p.x * a > BLEUE + 0.25) ? 'ramene' : null;
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
      // LA PASSE LAISSÉE : A, le bâton tiré vers l'arrière, un coéquipier qui suit.
      const laisse = e.passe && !porteur.tenaitPasse && m > 0.5 && Math.abs(plier(Math.atan2(e.y, e.x) - porteur.cap)) > LAISSEE.arriere ? suiveur(etat, porteur) : null;
      if (laisse) laisser(etat, porteur, laisse, ev);
      else if (e.passe && !porteur.tenaitPasse) passer(etat, porteur, m > 0.1 ? e : null, vise, ev);
      else if (porteur.tenaitTir && !e.tir && !porteur.leve) {
        const part = Math.min(1, porteur.charge / BATON.charge);
        const ang = viseeAssistee(etat, porteur, vise, m > 0.1 ? e : null), revers = auRevers(porteur, ang);
        const v = (BATON.tirMin + (BATON.tirMax - BATON.tirMin) * part) * porteur.p.tir * (revers ? REVERS.tir : 1);
        lancer(etat, porteur, ang, v, BATON.ecart * (1 + 0.6 * part) * porteur.p.precision * (revers ? REVERS.ecart : 1), 0.5,
          BATON.hauteurMin + (BATON.hauteurMax - BATON.hauteurMin) * part + gauss(etat.de) * BATON.ecartHauteur * (1 + part));
        tirer(etat, porteur, ev, part, false, revers);
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
  const choc = bander(R, RONDELLE.rayon, RONDELLE.bande, RONDELLE.longe, RONDELLE.colle);
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
    if (s.auSol > 0) { if (s.couche > 0) bloquerCouche(etat, s, vol, ev); continue; }
    const lm = lame(s);
    const dl = hyp(R.x - lm.x, R.y - lm.y);
    const devant = (R.x - s.x) * Math.cos(s.cap) + (R.y - s.y) * Math.sin(s.cap) > 0;
    const vrel = hyp(R.vx - s.vx, R.vy - s.vy);
    if (R.z > 1.4) continue;   // trop haut pour tout le monde
    const passeAMoi = R.passeDe && R.passeDe !== s.id && parId(etat, R.passeDe) && parId(etat, R.passeDe).equipe === s.equipe;
    const passePourMoi = R.passeVers === s.id;
    if (dl < 1.0 || (dl < PATIN.portee && devant && (vrel < 6 || passeAMoi || passePourMoi))) {
      // Le bâton levé : la toucher serait un hors-jeu, et il ne la vise pas ; elle passe (le corps la dévie encore).
      const hj = prendraitHorsJeu(etat, s);
      if (hj === 'ramene' || (hj === 'differe' && !viseLaRondelle(s, entrees[s.id], R))) {
        if (R.z < 1.0 && contreCercle(R, RONDELLE.rayon, s.x, s.y, s.rayon, 0.3) > 0) bloquer(etat, s, vol, ev);
        continue;
      }
      if (vrel <= BATON.reception * (passeAMoi ? 1.5 : 1) && R.z < 0.35) {
        R.porteur = s.id; R.z = 0; R.vz = 0;
        toucher(etat, s, false);
        if (etat.humains.includes(s.equipe)) etat.controles[s.equipe] = s.id;
        ev.push({ type: 'prise', qui: s.id, passe: !!passeAMoi });
        const e = entrees[s.id];
        // LE TIR SUR RÉCEPTION (une-temps) : le bouton tenu quand la passe arrive, le lancer part tout de suite — du coup
        // droit seulement : le filet du côté du revers, il la reçoit (la main du joueur : l'ailier sur son « mauvais » côté).
        const tirTenu = e && e.tir;
        const tirTampon = !tirTenu && etat.t - s.tamponTir <= TAMPON;
        const vise = passeAMoi && (tirTenu || tirTampon) ? viseeAssistee(etat, s, s.cap, e && hyp(e.x || 0, e.y || 0) > 0.1 ? e : null) : null;
        if (vise != null && !auRevers(s, vise)) {
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
        ev.push({ type: 'deviation', qui: s.id, voulue: true });
        return;
      }
      // UN TIR QUI FRAPPE UNE LAME DEVANT LE FILET change de route au lieu de mourir : la déviation malgré soi. Celle d'un
      // coéquipier lui revient (il l'a touchée en dernier) ; celle d'un adversaire reste au tireur.
      const filetVise = d && etat.equipes[d.equipe] ? etat.equipes[d.equipe].attaque * LIGNE_BUT : null;
      if (vol && d && d.tir && d.id !== s.id && R.z < 0.6 && filetVise != null && hyp(lm.x - filetVise, lm.y) < BATON.devant) {
        const vt = hyp(R.vx, R.vy) * BATON.garde, ang = Math.atan2(R.vy, R.vx) + gauss(etat.de) * BATON.devie;
        R.vx = Math.cos(ang) * vt; R.vy = Math.sin(ang) * vt; R.vz = Math.max(0, R.vz) * 0.5 + etat.de() * 1.5;
        if (d.equipe === s.equipe) toucher(etat, s, true); else s.touche = etat.t;
        s.lachee = 0.2;
        ev.push({ type: 'deviation', qui: s.id, voulue: false });
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
/* Le corps couché (`PLONGE`) : un segment en travers de son cap, que la rondelle basse frappe. */
function bloquerCouche(etat, s, vol, ev) {
  const R = etat.rondelle;
  if (R.z > PLONGE.haut) return;
  const tx = -Math.sin(s.coucheCap), ty = Math.cos(s.coucheCap), h = PLONGE.long / 2;
  const t = clamp((R.x - s.x) * tx + (R.y - s.y) * ty, -h, h);
  if (contreCercle(R, RONDELLE.rayon, s.x + tx * t, s.y + ty * t, PLONGE.epais, 0.25) > 0) bloquer(etat, s, vol, ev);
}
function bloquer(etat, s, vol, ev) {
  const d = etat.rondelle.dernier;
  if (vol && d && d.tir && d.equipe !== s.equipe && etat.match) { etat.match.blocs[s.equipe]++; s.stats.blocs++; ev.push({ type: 'bloc', qui: s.id }); }
  toucher(etat, s, false);
}

/* Un tir tenté : le dernier tir, l'événement ; le tir au but, lui, se compte à l'arrêt ou au but (`tirAuBut`). */
function tirer(etat, s, ev, part, uneTemps = false, revers = false) {
  // Lancée de hors de la zone d'attaque, c'est un lancer au fond (ou un dégagement) : pas un tir au but.
  const fond = etat.rondelle.dernier.x * etat.equipes[s.equipe].attaque <= BLEUE;
  etat.dernierTir = hyp(etat.rondelle.vx, etat.rondelle.vy);
  const Gd = gardienDe(etat, autre(s.equipe));
  ev.push({ type: 'tir', v: etat.dernierTir, charge: part, qui: s.id, uneTemps, fond, revers, contour: !fond && auContour(lame(s), etat.equipes[s.equipe].attaque), ecran: !fond && !Gd.retire && !!masque(etat, Gd) });
  if (fond) return;
  etat.compte.tirs++;
  etat.rondelle.dernier.tir = true;   // un lancer au but, pas une passe : ce qu'un bloc arrête
}
/*
 * UN TIR AU BUT, compté comme la LNH le compte (le lot 5) : un arrêt ou un but, rien d'autre. Le tir à côté, sur le
 * poteau, bloqué ou par-dessus la barre est tenté, pas au but ; la rondelle déviée compte à qui l'a déviée ; les tirs
 * de barrage ne comptent pas. Ainsi, pour chaque club, ses tirs = les arrêts du gardien d'en face + ses buts —
 * `check_physique`. (Avant, chaque tir tenté de la zone comptait : 2 tirs pour 1 but et 0 arrêt à l'entracte.)
 */
function tirAuBut(etat, eq, qui) {
  const M = etat.match;
  if (!M || M.fusillade) return;
  M.tirs[eq]++;
  const s = qui != null ? etat.patineurs.find(p => p.id === qui) : null;
  if (s && s.equipe === eq) s.stats.tirs++;
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
    R.vx = 0; R.vy = 0; R.vz = 0; R.z = 0; R.porteur = null;
    if (!etat.match) { etat.compte.buts++; etat.arret = { genre: 'but', reste: 2 }; ev.push({ type: 'but', cote: s }); return true; }
    // Qui marque : l'équipe qui attaque ce filet ; un but dans son propre filet compte pour l'autre.
    const pour = etat.equipes.A.attaque === s ? 'A' : 'B';
    // LE BUT REFUSÉ (`OBSTRUCTION`) : un attaquant a bousculé le gardien de ce filet il y a moins de `fenetre` s.
    const Gd = etat.gardiens.find(g => g.sens === s), o = Gd && Gd.obstrue;
    if (o && o.equipe === pour && etat.t - o.t < OBSTRUCTION.fenetre) { refuser(etat, pour, s, Gd, ev); return true; }
    etat.compte.buts++;
    const d = R.dernier;
    const marqueur = d && d.equipe === pour ? d.id : null;
    marquer(etat, pour, marqueur, ev);
    return true;
  }
  return false;
}

/* Le but refusé : le sifflet, l'arbitre l'annule, la mise en jeu au point de la zone neutre du côté du filet ; un tir de barrage, raté. */
function refuser(etat, pour, s, Gd, ev) {
  const M = etat.match, o = Gd.obstrue;
  Gd.obstrue = null;
  M.refuses[pour]++;
  ev.push({ type: 'butRefuse', equipe: pour, qui: o.qui, genre: 'obstruction sur le gardien' });
  if (M.ronde) { finDeRonde(etat, false, ev); return; }
  arreter(etat, 'refuse', { x: s * POINT.neutre, y: Math.sign(etat.rondelle.y || 1) * POINT.y }, MATCH.pauses.refuse);
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
  tirAuBut(etat, pour, marqueur);
  ev.push({ type: 'but', equipe: pour, qui: marqueur, aides });
  if (M.ronde) { finDeRonde(etat, true, ev); return; }
  // Un but en avantage numérique libère le puni qui a le moins de temps à faire ; une punition en attente contre l'autre s'annule.
  const contre = autre(pour);
  const punis = M.penalites.filter(p => p.equipe === contre && p.avantage > 0).sort((a, b) => a.reste - b.reste);
  if (punis.length && penalisesDe(etat, contre) > penalisesDe(etat, pour)) {
    // la part mineure s'efface ; une majeure qui suit reste à faire
    const p = punis[0];
    if (p.reste - p.avantage > 0.01) { p.reste -= p.avantage; p.avantage = 0; } else liberer(etat, p, ev);
  }
  if (M.enAttente && M.enAttente.equipe === contre) M.enAttente = null;
  if (M.prolongation) { finir(etat, pour, ev); return; }
  arreter(etat, 'but', { x: 0, y: 0 }, MATCH.pauses.but);
  etat.arret.fete = { eq: pour, qui: marqueur, fin: MATCH.pauses.but - CELEBRATION.duree };
}
/* La célébration (`CELEBRATION`) : les coéquipiers vont au buteur et s'y serrent sans se rentrer dedans ; les autres freinent. */
function feter(etat, F) {
  const C = CELEBRATION, buteur = F.qui ? parId(etat, F.qui) : null, enFete = !!buteur && buteur.surGlace && etat.arret.reste > F.fin;
  const fetards = etat.patineurs.filter(s => s.surGlace && s.equipe === F.eq);
  for (const s of etat.patineurs) {
    if (!s.surGlace) continue;
    s.pousse = 0;
    let ax = -s.vx * C.frein, ay = -s.vy * C.frein;
    if (enFete && s.equipe === F.eq && s !== buteur) {
      const dx = buteur.x - s.x, dy = buteur.y - s.y, d = hyp(dx, dy) || 1e-9, v = Math.min(C.vitesse, Math.max(0, d - C.rayon) * 2);
      ax = (dx / d * v - s.vx) * 4; ay = (dy / d * v - s.vy) * 4;
      if (d > 0.5) s.cap = Math.atan2(dy, dx);
    }
    s.vx += ax * PAS; s.vy += ay * PAS;
    s.x += s.vx * PAS; s.y += s.vy * PAS;
  }
  // serrés, pas empilés : deux fêtards à moins de deux rayons se poussent l'un l'autre
  for (let i = 0; i < fetards.length; i++) for (let j = i + 1; j < fetards.length; j++) {
    const a = fetards[i], b = fetards[j], dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy) || 1e-9, min = a.rayon + b.rayon;
    if (d < min) { const k = (min - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
  }
  for (const s of etat.patineurs) if (s.surGlace) { bander(s, s.rayon, PATIN.bande); patineurContreFilet(s); }
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
function horsJeu(etat, avantX, ev, avant = { dernier: etat.rondelle.dernier, porteur: etat.rondelle.porteur }) {
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
  // Qui l'a fait entrer : portée, son porteur ; libre au début du pas, le dernier à l'avoir touchée AVANT la ligne (la
  // rondelle qu'un adversaire envoie dans la zone et qu'un attaquant cueille au même instant n'est pas un hors-jeu).
  const portee = !!R.porteur && R.porteur === avant.porteur;
  const d = portee ? R.dernier : avant.dernier;
  for (const eq of ['A', 'B']) {
    const s = etat.equipes[eq].attaque;
    const entre = R.x * s > BLEUE && avantX * s <= BLEUE;
    if (!entre || !d || d.equipe !== eq) continue;
    const fautif = etat.patineurs.find(p => p.surGlace && p.equipe === eq && !(portee && p.id === R.porteur) && p.x * s > BLEUE + 0.25);
    if (!fautif) continue;
    if (portee && parId(etat, R.porteur).equipe === eq) return siffler(eq, fautif, 'porte');
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
/*
 * LE CONTOURNEMENT DU FILET (le wraparound ; JP, 7 nov. 2026 : *toutes les mécaniques d'un jeu comme NHL 94*). Le porteur
 * qui sort de derrière le filet, la lame à côté du poteau (devant la ligne des buts de `avant` m au plus, à `cote` m au
 * plus du poteau, dehors, ou `dedans` m en deçà) : le tir la glisse dans le filet, au ras de ce poteau : il passe la
 * ligne à `ras` m en dedans du poteau. Le gardien qui couvre ce poteau l'arrête ; celui resté
 * à l'autre, avec son retard, arrive trop tard.
 */
export const CONTOUR = { avant: 0.6, cote: 0.8, dedans: 0.1, ras: 0.12 };
function auContour(lm, sg) {
  const devant = (sg * LIGNE_BUT - lm.x) * sg, cote = Math.abs(lm.y) - FILET.large / 2;
  return devant > 0 && devant <= CONTOUR.avant && cote > -CONTOUR.dedans && cote <= CONTOUR.cote;
}
function viseeAssistee(etat, s, vise, baton) {
  const lm = lame(s);
  const sg = etat.equipes[s.equipe].attaque;
  const xb = sg * LIGNE_BUT;
  if (auContour(lm, sg)) return Math.atan2(Math.sign(lm.y) * (FILET.large / 2 - CONTOUR.ras) - lm.y, xb - lm.x);
  if ((xb - lm.x) * sg <= 0.5) return vise;   // on l'a déjà dépassé
  // HORS DE LA ZONE D'ATTAQUE, le tir part où pointe le bâton : le lancer au fond, le dégagement le long de la bande.
  if (lm.x * sg <= BLEUE) return vise;
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
  // La ligne barrée par un bâton : la passe soulevée passe par-dessus et retombe. Du revers, elle part moins fort, moins juste.
  const ang = Math.atan2(ty - lm.y, tx - lm.x), revers = auRevers(s, ang);
  lancer(etat, s, ang, v * (revers ? REVERS.passe : 1), BATON.ecart * 0.6 * s.p.passe * (revers ? REVERS.ecartPasse : 1), 0.5, barree ? BATON.soulevee : 0);
  R.passeDe = s.id; R.passeVers = meilleur.id;
  ev.push({ type: 'passe', qui: s.id, vers: meilleur.id, soulevee: barree, revers });
}
/* Le coéquipier qui suit le porteur : derrière lui, assez près, lancé dans son sens (`LAISSEE`). */
function suiveur(etat, s) {
  let mieux = null, dm = LAISSEE.portee;
  for (const m of etat.patineurs) {
    if (!m.surGlace || m.equipe !== s.equipe || m === s || m.auSol > 0) continue;
    const dx = m.x - s.x, dy = m.y - s.y, d = hyp(dx, dy);
    const suit = m.vx * Math.cos(s.cap) + m.vy * Math.sin(s.cap);
    if (d < dm && suit >= LAISSEE.suit && Math.abs(plier(Math.atan2(dy, dx) - s.cap - Math.PI)) < LAISSEE.cone) { dm = d; mieux = m; }
  }
  return mieux;
}
/* LA PASSE LAISSÉE : la rondelle laissée derrière soi, presque morte, au coéquipier qui suit ; le porteur passe par-dessus. */
function laisser(etat, s, m, ev) {
  const R = etat.rondelle, lm = lame(s);
  lancer(etat, s, Math.atan2(m.y - lm.y, m.x - lm.x), LAISSEE.vitesse, BATON.ecart * s.p.passe, 0);
  R.passeDe = s.id; R.passeVers = m.id;
  s.lachee = LAISSEE.lachee;   // il patine par-dessus sans la reprendre
  ev.push({ type: 'passe', qui: s.id, vers: m.id, laissee: true });
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
  Gd.masque = masque(etat, Gd);
  const n = Math.round((Gd.p.reaction + (Gd.masque ? GARDIEN.ecran : 0)) / PAS);
  const vueDuJour = { x: R.x, y: R.y, vx: R.vx, vy: R.vy, libre: !R.porteur };
  // Masqué, il garde la dernière image vue (la mémoire s'allonge par le bout le plus vieux) ; démasqué, il la retrouve
  // à double vitesse, pas d'un coup : il lui faut le temps de la retrouver.
  while (Gd.memoire.length < n) Gd.memoire.unshift(Gd.memoire[0] || vueDuJour);
  if (Gd.memoire.length > n) Gd.memoire.shift();
  Gd.memoire.push(vueDuJour);
  Gd.memoire.shift();
  const vu = Gd.memoire[0];
  let cible;
  const xb = s * LIGNE_BUT;
  // LE PLONGEON (`PLONGEON`) : en l'air, puis couché ; il ne se commande plus, il glisse.
  if (Gd.plonge > 0) { Gd.plonge -= PAS; if (Gd.plonge <= 0) Gd.auSol = PLONGEON.sol; }
  else if (Gd.auSol > 0) Gd.auSol -= PAS;
  const plonge = Gd.plonge > 0 || Gd.auSol > 0;
  const tirAdverse = R.dernier && R.dernier.tir && R.dernier.equipe !== Gd.equipe;   // un tir, pas une passe qui traverse
  if (!plonge && !etat.arret && tirAdverse && vu.libre && vu.vx * s > 8 && vu.x * s < LIGNE_BUT) {
    const t = (Gd.x - vu.x) / vu.vx, y = vu.y + vu.vy * t, reste = t - Gd.p.reaction;
    const manque = Math.abs(y - Gd.y) - Gd.p.demi - Gd.p.vMax * Math.max(0, reste);
    if (Math.abs(y) < FILET.large / 2 && reste > 0 && manque > 0 && manque < PLONGEON.portee) {
      Gd.plonge = PLONGEON.duree; Gd.plongeCote = Math.sign(y - Gd.y) || 1;
      Gd.vy = Gd.plongeCote * PLONGEON.elan; Gd.vx = 0;
      ev.push({ type: 'plongeon', equipe: Gd.equipe, cote: Gd.plongeCote * s });
    }
  }
  const xMin = LIGNE_BUT - 1.6, xMax = LIGNE_BUT - 0.15;   // en profondeur, côté centre
  const versMoi = vu.vx * s > 8 && vu.x * s < LIGNE_BUT;
  // LE GARDIEN JOUE LA RONDELLE (le lot 5, `GARDIEN.jouer`) : il y va, sa lame à `portee` d'elle, du côté d'où il vient.
  if (Gd.jouerRepos > 0) Gd.jouerRepos -= PAS;
  Gd.joue = Gd.jouerRepos <= 0 && !etat.arret && !(etat.match && etat.match.ronde) && vu.libre && aJouer(etat, Gd, vu);
  if (Gd.joue) {
    const dx = Gd.x - vu.x, dy = Gd.y - vu.y, d = hyp(dx, dy) || 1e-9;
    cible = { x: vu.x + dx / d * 0.5, y: vu.y + dy / d * 0.5 };
  } else if (vu.libre && versMoi) {
    const t = (Gd.x - vu.x) / vu.vx;
    cible = { x: Gd.x, y: clamp(vu.y + vu.vy * t, -1.1, 1.1) };
  } else if (vu.x * s > LIGNE_BUT) {
    cible = { x: s * xMax, y: Math.sign(vu.y || 1) * 0.75 };
  } else if (vu.libre && rondelleACouvrir(etat, Gd, vu)) {
    // LA RONDELLE LIBRE DANS SON DEMI-CERCLE, lente, et lui le premier dessus : il va la couvrir.
    cible = { x: s * clamp(Math.abs(vu.x), xMin - 0.6, xMax), y: clamp(vu.y, -1.6, 1.6) };
  } else {
    const cx = xb + s * 0.3, dx = vu.x - cx, dy = vu.y, d = hyp(dx, dy) || 1e-9;
    const sortie = 0.3 + GARDIEN.sortie * clamp(d / 12, 0.3, 1);
    // À ANGLE FERMÉ, il colle au poteau : jamais plus loin de côté que le poteau lui-même (au-delà, il ouvrait le haut du filet).
    cible = { x: s * clamp(Math.abs(cx + dx / d * sortie), xMin, xMax), y: clamp(dy / d * sortie, -FILET.large / 2, FILET.large / 2) };
  }
  // Entre devant et derrière son filet, il en fait le tour par le côté (le filet ne se traverse pas).
  const devant = x => x * s < LIGNE_BUT + FILET.profond / 2;
  if (devant(Gd.x) !== devant(cible.x) && Math.abs(Gd.y) < FILET.large / 2 + 0.45) cible = { x: s * (LIGNE_BUT + FILET.profond / 2), y: (Math.sign(Gd.y || cible.y) || 1) * (FILET.large / 2 + 0.7) };
  const k = 40, c = 2 * Math.sqrt(k);
  let ax = k * (cible.x - Gd.x) - c * Gd.vx, ay = k * (cible.y - Gd.y) - c * Gd.vy;
  const a = hyp(ax, ay);
  if (a > GARDIEN.accel) { ax *= GARDIEN.accel / a; ay *= GARDIEN.accel / a; }
  if (plonge) { ax = -Gd.vx * (Gd.plonge > 0 ? 0 : PLONGEON.frein); ay = -Gd.vy * (Gd.plonge > 0 ? 0 : PLONGEON.frein); }   // en plongeon, il glisse
  Gd.vx += ax * PAS; Gd.vy += ay * PAS;
  const v = hyp(Gd.vx, Gd.vy), vMax = plonge ? PLONGEON.elan : Gd.p.vMax;
  if (v > vMax) { Gd.vx *= vMax / v; Gd.vy *= vMax / v; }
  Gd.x += Gd.vx * PAS; Gd.y += Gd.vy * PAS;
  // Sorti de son demi-cercle (derrière ou à côté du filet), le filet l'arrête comme un patineur.
  if (Gd.x * s > LIGNE_BUT - 0.1 || Math.abs(Gd.y) > FILET.large / 2) { Gd.rayon = 0.4; patineurContreFilet(Gd); }
  if (Gd.harponRepos > 0) Gd.harponRepos -= PAS;
  if (R.porteur && !etat.arret) { harponDuGardien(etat, Gd, ev); return; }
  if (R.porteur || etat.arret) return;
  if (Gd.joue && R.z < 0.3 && hyp(R.x - Gd.x, R.y - Gd.y) < GARDIEN.jouer.portee) { jouerLaRondelle(etat, Gd, ev); return; }
  const tendu = plonge;   // tendu de tout son long
  const dansY = Math.abs(R.y - Gd.y) < Gd.p.demi + (plonge && Math.sign(R.y - Gd.y) === Gd.plongeCote ? PLONGEON.portee : 0) + RONDELLE.rayon;
  const dansX = Math.abs(R.x - Gd.x) < GARDIEN.profondeur + RONDELLE.rayon;
  if (!(dansY && dansX) || R.z > FILET.haut || Gd.x * s > LIGNE_BUT) return;   // derrière sa ligne, il ne gèle rien
  const vr = hyp(R.vx, R.vy);
  if (vr < GARDIEN.lente && R.z < 0.3 && !tendu) { geler(etat, Gd, ev); return; }
  if (R.vx * s <= 0) return;
  // LES TROUS : le coin du haut (la mitaine, le bloqueur), entre les jambières, le corps — ce qui passe quand même.
  const dy = Math.abs(R.y - Gd.y);
  const trou = tendu ? PLONGEON.trou : R.z > 0.85 && dy > 0.35 ? GARDIEN.trous.haut : R.z < 0.2 && dy < 0.18 ? GARDIEN.trous.cinq : GARDIEN.trous.corps;
  if (etat.de() < trou) return;   // elle passe
  etat.compte.arrets++;
  // L'arrêt d'un tir au but : la rondelle venue de l'adversaire (pas d'un coéquipier), hors des tirs de barrage.
  const dT = R.dernier;
  if (!(dT && dT.equipe === Gd.equipe) && !(etat.match && etat.match.fusillade)) { Gd.arrets++; tirAuBut(etat, autre(Gd.equipe), dT && dT.id); }
  R.x = Gd.x - s * (GARDIEN.profondeur + RONDELLE.rayon + 0.02);
  const haut = R.z > 0.85;
  if (!tendu && etat.de() < (haut ? GARDIEN.mitaine : GARDIEN.couvre)) { geler(etat, Gd, ev, true); }
  else {
    // LE REBOND : contrôlé (sa cote Arrêts), il part de côté vers le coin, loin de l'enclave ; sinon, il sort devant.
    const cote = Math.sign(R.y - Gd.y) || (etat.de() < 0.5 ? -1 : 1);
    const controle = etat.de() < (Gd.p.controle ?? 0.5);
    const th = controle ? GARDIEN.coin[0] + etat.de() * (GARDIEN.coin[1] - GARDIEN.coin[0]) : (etat.de() - 0.5) * 1.4;
    const ang = s > 0 ? Math.PI - cote * th : cote * th;
    const vt = vr * GARDIEN.rebond * (controle ? 0.8 : 1);
    R.vx = Math.cos(ang) * vt; R.vy = Math.sin(ang) * vt; R.vz = 0.5; R.z = Math.min(R.z, 0.3);
    ev.push({ type: 'arret', gele: false, equipe: Gd.equipe, haut: R.z > 0.6, cote: Math.sign((R.y - Gd.y) * s || 1), plongeon: tendu });
  }
}
/* LE TRAPÈZE (`GARDIEN.jouer.trapeze`) : devant sa ligne des buts, partout ; derrière, entre ses deux lignes, qui s'ouvrent vers la bande. */
function dansLeTrapeze(x, y, s) {
  const u = x * s - LIGNE_BUT;
  if (u <= 0) return true;
  const [a, b] = GARDIEN.jouer.trapeze;
  return Math.abs(y) <= a + (b - a) * Math.min(1, u / (L / 2 - LIGNE_BUT));
}
/* Le gardien va-t-il jouer la rondelle qu'il voit (`vu`) ? Lente, derrière sa ligne, dans le trapèze, et lui dessus le premier. */
function aJouer(etat, Gd, vu) {
  const J = GARDIEN.jouer, s = Gd.sens;
  if (Gd.retire || etat.rondelle.z > 0.3 || vu.x * s < LIGNE_BUT + J.derriere || hyp(vu.vx, vu.vy) > J.lente || !dansLeTrapeze(vu.x, vu.y, s)) return false;
  // parti, il continue tant qu'aucun adversaire n'y arrive avant lui ; pour partir, il lui faut `avance` s d'avance
  const moi = hyp(vu.x - Gd.x, vu.y - Gd.y) / Gd.p.vMax, marge = Gd.joue ? 0 : J.avance;
  return !etat.patineurs.some(o => {
    if (!o.surGlace || o.auSol > 0) return false;
    const t = hyp(lame(o).x - vu.x, lame(o).y - vu.y) / o.p.vMax;
    return o.equipe === Gd.equipe ? t + J.avance < moi : t < moi + marge;
  });
}
/* La distance d'un point au segment de a à b. */
function auSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy || 1e-9;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / d2, 0, 1);
  return hyp(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
/*
 * LE GARDIEN JOUE LA RONDELLE : hors du trapèze, deux minutes ; sinon une remise au coéquipier ouvert (un défenseur
 * d'abord), menée là où il patine, ou, personne d'ouvert, le long de la bande de son côté, vers le haut de la glace.
 */
function jouerLaRondelle(etat, Gd, ev) {
  const R = etat.rondelle, s = Gd.sens, J = GARDIEN.jouer;
  Gd.joue = false; Gd.jouerRepos = J.repos;
  R.dernier = { equipe: Gd.equipe, id: `G:${Gd.equipe}`, t: etat.t, x: R.x, lance: false };
  R.passeDe = null; R.passeVers = null;
  if (!dansLeTrapeze(R.x, R.y, s)) {
    R.vx = 0; R.vy = 0;
    if (etat.match && !etat.match.ronde) punirLeGardien(etat, Gd, ev);
    return;
  }
  let vers = null, mieux = Infinity;
  for (const m of etat.patineurs) {
    if (!m.surGlace || m.auSol > 0 || m.equipe !== Gd.equipe) continue;
    const d = hyp(m.x - R.x, m.y - R.y);
    if (d < 4 || d > 25 || etat.patineurs.some(o => o.surGlace && o.equipe !== Gd.equipe && auSegment(o, R, m) < J.couloir)) continue;
    const note = d + (m.poste === 'D' ? 0 : 6);
    if (note < mieux) { mieux = note; vers = m; }
  }
  if (vers) {
    const d = hyp(vers.x - R.x, vers.y - R.y), v = Math.min(BATON.passeMax, BATON.passe + BATON.passeLoin * d), t = d / v;
    const tx = vers.x + vers.vx * t, ty = vers.y + vers.vy * t, dd = hyp(tx - R.x, ty - R.y) || 1e-9;
    R.vx = (tx - R.x) / dd * v; R.vy = (ty - R.y) / dd * v;
    R.passeVers = vers.id;
  } else {
    const ang = Math.atan2((Math.sign(R.y) || 1) * W / 2 - R.y, -s * 12);
    R.vx = Math.cos(ang) * J.bande; R.vy = Math.sin(ang) * J.bande;
  }
  R.vz = 0;
  ev.push({ type: 'jeuDuGardien', equipe: Gd.equipe, vers: vers ? vers.id : null });
}
/* Le gardien puni (le trapèze) : ses deux minutes, purgées par un patineur sur la glace, le jeu arrêté sur-le-champ. */
function punirLeGardien(etat, Gd, ev) {
  const M = etat.match;
  if (M.penalites.some(p => p.equipe === Gd.equipe && p.trapeze) || M.enAttente || M.tirDePunition) return;
  const servant = surGlace(etat, Gd.equipe).filter(q => q.poste !== 'D' && !M.penalites.some(p => p.id === q.id))[0] || surGlace(etat, Gd.equipe)[0];
  if (!servant) return;
  const p = { id: servant.id, equipe: Gd.equipe, genre: 'le gardien hors du trapèze', reste: MATCH.punition, avantage: MATCH.punition, trapeze: true };
  ev.push({ type: 'punition', qui: servant.id, equipe: Gd.equipe, genre: p.genre, attente: false, gardien: true });
  appliquerPunition(etat, p);
}
/* L'écran : le patineur (pas le porteur) qui se tient sur la ligne de la rondelle au gardien, entre les deux. */
function masque(etat, Gd) {
  const R = etat.rondelle, dx = Gd.x - R.x, dy = Gd.y - R.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
  if (d < GARDIEN.ecranLoin) return null;
  for (const p of etat.patineurs) {
    if (!p.surGlace || p.id === R.porteur || p.auSol > 0) continue;
    const t = ((p.x - R.x) * dx + (p.y - R.y) * dy) / d2;
    if (t <= 0 || (1 - t) * d < GARDIEN.ecranPres) continue;
    if (hyp(p.x - (R.x + t * dx), p.y - (R.y + t * dy)) < p.rayon + GARDIEN.ecranLarge) return p.id;
  }
  return null;
}
/* La rondelle à couvrir : libre, lente, au sol, dans son demi-cercle, et aucun adversaire n'y est avant lui. */
function rondelleACouvrir(etat, Gd, vu) {
  const R = etat.rondelle, s = Gd.sens;
  if (R.z > 0.3 || hyp(vu.vx, vu.vy) > GARDIEN.lente) return false;
  const dx = s * LIGNE_BUT - vu.x;
  if (dx * s < 0 || hyp(dx, vu.y) > GARDIEN.demiCercle) return false;
  const moi = hyp(vu.x - Gd.x, vu.y - Gd.y);
  return !etat.patineurs.some(o => o.surGlace && !o.auSol && o.equipe !== Gd.equipe && hyp(lame(o).x - vu.x, lame(o).y - vu.y) < moi);
}
/*
 * LE HARPON DU GARDIEN : le porteur adverse qui arrive devant lui, de face, à portée de son bâton — une chance (sa cote
 * Arrêts) de lui sortir la rondelle vers le coin ; raté, il attend `repos` avant de retenter.
 */
function harponDuGardien(etat, Gd, ev) {
  const R = etat.rondelle, s = Gd.sens;
  if (Gd.harponRepos > 0) return;
  const porteur = parId(etat, R.porteur);
  if (!porteur || porteur.equipe === Gd.equipe) return;
  const devant = (Gd.x - R.x) * s;   // la rondelle devant lui, côté glace
  if (devant < 0.2 || hyp(R.x - Gd.x, R.y - Gd.y) > GARDIEN.harpon.portee) return;
  Gd.harponRepos = GARDIEN.harpon.repos;
  if (etat.de() >= (Gd.p.harpon ?? GARDIEN.harpon.chance)) return;
  R.porteur = null; porteur.lachee = 0.4;
  const cote = Math.sign(R.y - Gd.y) || 1;
  R.vx = -s * 3 + (etat.de() - 0.5) * 2; R.vy = cote * 5 + (etat.de() - 0.5) * 2;
  R.dernier = { equipe: Gd.equipe, id: `G:${Gd.equipe}`, t: etat.t, x: R.x, lance: false };
  R.passeDe = null; R.passeVers = null;
  ev.push({ type: 'harpon', qui: `G:${Gd.equipe}`, gardien: true });
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
  for (const s of etat.patineurs) { s.charge = 0; s.harpon = 0; s.elan = 0; s.feinte = 0; s.mordu = null; s.couche = 0; }
  for (const g of etat.gardiens) { g.plonge = 0; g.auSol = 0; }
  if (etat.match) etat.match.horsJeuDiffere = null;
  // Une punition en attente tombe à l'arrêt de jeu.
  if (etat.match && etat.match.enAttente) { const p = etat.match.enAttente; etat.match.enAttente = null; appliquerPunition(etat, p); }
}

/*
 * LA MISE EN JEU (JP, 2 nov. : *les défenseurs sont pas dans la zone à la mise au jeu, l'absence de mécanique de mise
 * au jeu*). LE PLACEMENT, celui de la LNH, selon le point : les deux centres face à face au point (`MEJ.face` chacun de
 * son côté), personne d'autre dans le cercle ; les ailiers sur les traits du cercle, chacun de son côté ; les défenseurs
 * en deçà — au centre et en zone neutre, `MEJ.recul` derrière ; dans une zone, ceux de l'attaque à la bleue
 * (`MEJ.bleue` en dedans), le fort à la pointe de son côté, l'autre au milieu, et ceux de la défense, l'un au bas du
 * cercle derrière son centre, l'autre à côté du cercle, devant le filet. Le hors-jeu tient : personne dans sa zone d'attaque si le point
 * n'y est pas, chacun dans sa moitié au centre.
 */
export const MEJ = {
  chute: 0.9,        // la rondelle tombe après ça, s
  face: 0.6,         // chaque centre, à ça du point, de son côté, m
  trait: 0.95,       // les ailiers, à ça du point en long, de leur côté, sur les traits du cercle (au rayon, plus `horsCercle`)
  horsCercle: 0.35,  // m au-delà du cercle : personne d'autre que les centres dedans
  recul: 6.5,        // les défenseurs au centre et en zone neutre, à ça derrière le point, m
  bleue: 0.9,        // ceux de l'attaque, dans une zone : à ça en dedans de la bleue, m
  pointe: 4,         // … le fort à ça de la bande, l'autre à `milieu` du centre de la glace, de l'autre côté, m
  milieu: 1.5,
  arriere: 2.8,      // ceux de la défense, dans leur zone : celui du milieu à ça du point vers leur but, à côté du cercle, m ;
  fond: [4.7, 1.8],  // … celui de la bande au bas du cercle, derrière son centre : à ça vers le but, et ça vers la bande, m
  // LE DUEL : chaque centre vaut sa cote Jeu sur 20 × `jeu`, plus un dé × `hasard`, plus le bouton : à la chute pile,
  // `timing`, moins à mesure qu'on s'en éloigne, rien à `fenetre` de la chute, avant ou après. Seul le premier appui
  // compte ; le bâton tenu à cet instant dit où il l'envoie. Le duel se joue quand les deux ont pressé, au plus tôt à la
  // chute, ou `tard` après elle. Un écart sous `nette` : la rondelle reste libre au point, une petite bataille.
  jeu: 0.25, hasard: 0.5, timing: 0.45, fenetre: 0.2, tard: 0.2, nette: 0.06,
  // GAGNÉE NETTE : vers le coéquipier que le bâton pointe (à `cone` rad près ; le bâton au neutre, droit derrière),
  // assez fort pour qu'elle lui arrive à `arrivee` m/s, `vitesse` au plus, à `ecart` rad près ; personne dans le cône,
  // elle part dans le sens du bâton. Les bâtons des centres restent liés `lies` s ; le perdant, battu, `battu` s.
  cone: 0.9, arrivee: 5, vitesse: 9, ecart: 0.1, lies: 0.6, battu: 0.6,
  libre: 1.2,        // la rondelle libre glisse à ça, m/s, dans un sens au hasard
};
function placerMiseEnJeu(etat, point) {
  for (const Gd of etat.gardiens) if (Gd.retour) { Gd.retire = false; Gd.retour = false; }
  if (etat.match && !etat.match.ronde) for (const eq of ['A', 'B']) habiller(etat, eq);
  const R = etat.rondelle;
  R.x = point.x; R.y = point.y; R.z = 0; R.vx = 0; R.vy = 0; R.vz = 0; R.porteur = null; R.dernier = null;
  if (etat.match) { etat.match.touches.A = []; etat.match.touches.B = []; }
  const centres = {};
  const auCentre = Math.abs(point.x) < 0.5;
  const enZone = Math.abs(point.x) > BLEUE;
  const bande = Math.sign(point.y) || 1;   // le côté de la bande la plus près
  const rTrait = POINT.r + MEJ.horsCercle;
  for (const eq of ['A', 'B']) {
    const s = etat.equipes[eq].attaque;
    const sur = surGlace(etat, eq);
    const F = sur.filter(p => p.poste !== 'D'), D = sur.filter(p => p.poste === 'D');
    const centre = F.find(p => p.poste === 'C') || F[0] || D[0];
    const ailiers = F.filter(p => p !== centre), defenseurs = D.filter(p => p !== centre);
    const place = (p, x, y) => {
      p.x = clamp(x, -(LIGNE_BUT - 1.2), LIGNE_BUT - 1.2); p.y = clamp(y, -(W / 2 - 1), W / 2 - 1);
      // Jamais dans le filet.
      if (Math.abs(p.x) > LIGNE_BUT - 1.2 && Math.abs(p.y) < FILET.large / 2 + 1) p.y = Math.sign(p.y || 1) * (FILET.large / 2 + 1.2);
      p.vx = 0; p.vy = 0; p.cap = s > 0 ? 0 : Math.PI; p.auSol = 0; p.charge = 0; p.lachee = 0; p.harpon = 0; p.elan = 0; p.ia = null;
    };
    if (centre) place(centre, point.x - s * MEJ.face, point.y);
    // L'ailier gauche à gauche en regardant le filet attaqué (−y quand on attaque vers +x), le droit à droite.
    ailiers.forEach((p, i) => {
      const g = p.poste === 'AG' ? -1 : p.poste === 'AD' ? 1 : (i === 0 ? -1 : 1);
      place(p, point.x - s * MEJ.trait, point.y + s * g * rTrait);
    });
    const attaque = enZone && point.x * s > 0, defense = enZone && point.x * s < 0;
    // Le premier de la paire prend le côté de la bande (le même calcul chaque fois).
    defenseurs.forEach((p, i) => {
      const cote = i === 0 ? bande : -bande;
      if (attaque) place(p, s * (BLEUE + MEJ.bleue), cote === bande ? bande * (W / 2 - MEJ.pointe) : -bande * MEJ.milieu);
      else if (defense) { if (cote === bande) place(p, point.x - s * MEJ.fond[0], point.y + bande * MEJ.fond[1]); else place(p, point.x - s * MEJ.arriere, point.y - bande * (rTrait + 0.5)); }
      else place(p, (auCentre ? 0 : point.x) - s * MEJ.recul, (auCentre ? 0 : point.y * 0.4) + (i === 0 ? -1 : 1) * 4);
    });
    centres[eq] = centre ? centre.id : null;
    const Gd = gardienDe(etat, eq);
    if (!Gd.retire) Object.assign(Gd, { x: Gd.sens * (LIGNE_BUT - GARDIEN.sortie), y: 0, vx: 0, vy: 0, memoire: [], harponRepos: 0 });
  }
  // Les joueurs hors glace : au banc, ou au cachot.
  for (const s of etat.patineurs) if (!s.surGlace) { s.x = (s.equipe === 'A' ? -1 : 1) * (s.boxe ? 3 : 8); s.y = (s.boxe ? -1 : 1) * (W / 2 + 1.2); s.vx = 0; s.vy = 0; }
  etat.mej = { point, reste: MEJ.chute, centres, appuis: { A: null, B: null }, batons: {} };
  for (const eq of etat.humains) {
    const mien = surGlace(etat, eq);
    etat.controles[eq] = centres[eq] || (mien[0] && mien[0].id) || null;
  }
}
/* Le bonus du bouton : `MEJ.timing` à la chute pile, rien à `MEJ.fenetre` avant ou après ; sans appui, rien. */
const bonusDeMej = appui => (appui ? MEJ.timing * Math.max(0, 1 - Math.abs(appui.t) / MEJ.fenetre) : 0);
/* Le duel : le Jeu, le dé, le bouton ; net, la rondelle va où le bâton du gagnant pointe ; serré, elle reste libre. */
function tomber(etat, ev) {
  const M = etat.mej, R = etat.rondelle;
  etat.mej = null;
  etat.enJeu = true;
  const score = {}, c = {};
  for (const eq of ['A', 'B']) {
    c[eq] = M.centres[eq] ? parId(etat, M.centres[eq]) : null;
    score[eq] = MEJ.jeu * (c[eq] ? c[eq].p.mej : 0.5) + MEJ.hasard * etat.de() + bonusDeMej(M.appuis[eq]);
  }
  const gagnant = score.A >= score.B ? 'A' : 'B', perdant = autre(gagnant);
  const timing = { A: M.appuis.A ? M.appuis.A.t : null, B: M.appuis.B ? M.appuis.B.t : null };
  if (Math.abs(score.A - score.B) < MEJ.nette) {
    const ang = etat.de() * 2 * Math.PI;
    R.vx = Math.cos(ang) * MEJ.libre; R.vy = Math.sin(ang) * MEJ.libre;
    for (const eq of ['A', 'B']) if (c[eq]) c[eq].lachee = MEJ.lies;
    ev.push({ type: 'mej', equipe: null, libre: true, timing });
    return;
  }
  const s = etat.equipes[gagnant].attaque, cg = c[gagnant];
  // Le bâton du gagnant : tenu à l'appui (sans appui, le dernier poussé) ; au neutre, droit derrière lui.
  const appui = M.appuis[gagnant], tenu = appui || M.batons[gagnant] || { x: 0, y: 0 };
  const dir = hyp(tenu.x, tenu.y) < 0.3 ? (s > 0 ? Math.PI : 0) : Math.atan2(tenu.y, tenu.x);
  let cible = null, mieux = MEJ.cone;
  for (const m of surGlace(etat, gagnant)) {
    if (m === cg) continue;
    const ecart = Math.abs(plier(Math.atan2(m.y - R.y, m.x - R.x) - dir));
    if (ecart < mieux) { mieux = ecart; cible = m; }
  }
  const d = cible ? hyp(cible.x - R.x, cible.y - R.y) : 6;
  const vise = (cible ? Math.atan2(cible.y - R.y, cible.x - R.x) : dir) + gauss(etat.de) * MEJ.ecart;
  const v = clamp(Math.sqrt(MEJ.arrivee ** 2 + 2 * RONDELLE.frottement * G * d), 2, MEJ.vitesse);
  R.vx = Math.cos(vise) * v; R.vy = Math.sin(vise) * v;
  // Une passe tirée au coéquipier : il la prend comme une passe, et les siens le savent.
  if (cg) { toucher(etat, cg, false); cg.lachee = MEJ.lies; if (cible) { R.passeDe = cg.id; R.passeVers = cible.id; } }
  if (c[perdant]) c[perdant].lachee = MEJ.battu;
  if (etat.match) etat.match.mej[gagnant]++;
  ev.push({ type: 'mej', equipe: gagnant, vers: cible ? cible.id : null, timing });
}

/*
 * Une punition : deux minutes au cachot, tout de suite si son équipe a la rondelle (ou personne), en attente sinon.
 * `victime` : celui qu'elle a visé ; s'il est rude, et le puni aussi, les gants peuvent tomber (`gants`).
 */
function punir(etat, s, genre, ev, victime = null) {
  const M = etat.match;
  if (!M || M.fini) return;
  if (M.penalites.some(p => p.id === s.id) || M.enAttente || M.tirDePunition) return;   // une punition en attente à la fois
  const p = { id: s.id, equipe: s.equipe, genre, reste: MATCH.punition, avantage: MATCH.punition };
  ev.push({ type: 'punition', qui: s.id, equipe: s.equipe, genre, attente: false });
  const porteur = etat.rondelle.porteur ? parId(etat, etat.rondelle.porteur) : null;
  const fautifs = porteur && porteur.equipe === s.equipe;
  if (fautifs) appliquerPunition(etat, p);
  else {
    // À retardement : l'autre équipe garde la rondelle tant qu'elle l'a ; le sifflet viendra quand les fautifs la touchent.
    M.enAttente = p;
    ev[ev.length - 1].attente = true;
  }
  if (victime) gants(etat, victime, s, ev);
}
/* Au cachot : hors de la glace, sur le banc des punitions de son club. */
function auCachot(etat, s) {
  s.surGlace = false; s.boxe = true;
  s.x = (s.equipe === 'A' ? -1 : 1) * 3; s.y = -(W / 2 + 1.2); s.vx = 0; s.vy = 0;
  for (const eq of ['A', 'B']) if (etat.controles[eq] === s.id) etat.controles[eq] = null;
}
function appliquerPunition(etat, p) {
  const M = etat.match;
  const s = parId(etat, p.id);
  M.penalites.push(p);
  M.pim[p.equipe] += 2;
  auCachot(etat, s);
  if (!etat.arret) {
    const sg = etat.equipes[p.equipe].attaque;
    arreter(etat, 'punition', { x: -sg * POINT.x, y: Math.sign(etat.rondelle.y || 1) * POINT.y }, MATCH.pauses.punition);
  }
}
function liberer(etat, p, ev) {
  const M = etat.match;
  M.penalites = M.penalites.filter(q => q !== p);
  const s = parId(etat, p.id);
  s.boxe = false;
  // Son club y joue à court d'un patineur : il saute sur la glace ; sinon (une majeure coïncidente), il rentre au banc.
  if (surGlace(etat, s.equipe).length < droitSurGlace(etat, s.equipe)) {
    s.surGlace = true;
    s.x = (s.equipe === 'A' ? -1 : 1) * 3; s.y = -(W / 2 - 1); s.vx = 0; s.vy = 0; s.cap = Math.PI / 2;
  } else Object.assign(s, { surGlace: false, x: (s.equipe === 'A' ? -1 : 1) * BANC.x, y: W / 2 + 1.2, vx: 0, vy: 0 });
  ev.push({ type: 'liberation', qui: s.id, equipe: s.equipe });
}
/* Sa mineure finie, le puni reste au cachot pour sa majeure : son club, à court, envoie un patineur reposé par la porte. */
function renfort(etat, eq) {
  if (surGlace(etat, eq).length >= droitSurGlace(etat, eq)) return;
  const r = etat.patineurs.filter(s => s.equipe === eq && !s.surGlace && !s.boxe).sort((a, b) => b.jambes - a.jambes)[0];
  if (!r) return;
  const porte = porteDuBanc(eq);
  Object.assign(r, { surGlace: true, x: porte.x, y: porte.y, vx: 0, vy: -2, cap: -Math.PI / 2, auSol: 0, charge: 0, lachee: 0, harpon: 0, elan: 0, ia: null, memo: null });
}

/* ---------- la bagarre (le lot 4) ---------- */
/* Ce qu'un joueur a de rude : sa Robustesse au-dessus du seuil, fois ses minutes de punition à la LNH (`BAGARRE`) ; 0, il ne se bat pas. */
export function rudesse(s) {
  const r = clamp((s.p.robuste * 20 - BAGARRE.robuste) / (20 - BAGARRE.robuste), 0, 1);
  const pim = s.p.pim == null ? 1 : clamp(s.p.pim / BAGARRE.pim, BAGARRE.pimMin, BAGARRE.pimMax);
  return r * pim;
}
/*
 * APRÈS LE SIFFLET (`RUDESSE`) : le bouton d'échec, nouvellement pressé, près d'un adversaire debout, le bouscule —
 * deux minutes sur-le-champ. Une punition par joueur à la fois, comme `punir`.
 */
function apresLeSifflet(etat, entrees, ev) {
  const M = etat.match;
  for (const s of etat.patineurs) {
    if (!s.surGlace) continue;
    const e = entrees[s.id] || (etat.ia ? etat.ia(etat, s) : null);
    const presse = !!(e && e.echec) && !s.tenaitEchec;
    s.tenaitEchec = !!(e && e.echec);
    if (!presse || !s.surGlace || M.penalites.some(p => p.id === s.id)) continue;
    const q = etat.patineurs.filter(o => o.surGlace && o.equipe !== s.equipe && o.auSol <= 0).sort((a, b) => hyp(a.x - s.x, a.y - s.y) - hyp(b.x - s.x, b.y - s.y))[0];
    const d = q ? hyp(q.x - s.x, q.y - s.y) : Infinity;
    if (d > RUDESSE.portee) continue;
    q.x += (q.x - s.x) / (d || 1) * RUDESSE.recul; q.y += (q.y - s.y) / (d || 1) * RUDESSE.recul;
    ev.push({ type: 'rudesse', qui: s.id, sur: q.id, equipe: s.equipe });
    const p = { id: s.id, equipe: s.equipe, genre: 'rudesse', reste: MATCH.punition, avantage: MATCH.punition };
    ev.push({ type: 'punition', qui: s.id, equipe: s.equipe, genre: 'rudesse', attente: false });
    appliquerPunition(etat, p);
  }
}
/* Les gants tombent-ils ? Le frappé (ou la victime) et le frappeur (ou le puni), au dé de leur rudesse. */
function gants(etat, a, b, ev) {
  const M = etat.match;
  if (!M || M.fini || M.ronde || M.fusillade || M.prolongation || M.bagarre || M.tirDePunition || !a || !b || a.equipe === b.equipe) return;
  if (M.bagarres.some(x => [x.A, x.B].includes(a.id) || [x.A, x.B].includes(b.id))) return;   // une par joueur par match
  const chance = BAGARRE.chance * rudesse(a) * rudesse(b);
  if (!(chance > 0) || etat.de() >= chance) return;
  const ids = { [a.equipe]: a.id, [b.equipe]: b.id };
  // Le jeu s'arrête : les deux face à face, en travers de la glace, là où ils sont ; la mise en jeu suivra au point le plus près.
  const x = clamp((a.x + b.x) / 2, -LIGNE_BUT + 1, LIGNE_BUT - 1), y = clamp((a.y + b.y) / 2, -W / 2 + 1.4, W / 2 - 1.4);
  arreter(etat, 'bagarre', { x: Math.sign(x || 1) * (Math.abs(x) > BLEUE ? POINT.x : POINT.neutre), y: Math.sign(y || 1) * POINT.y }, MATCH.pauses.bagarre);
  const c = Math.sign(b.y - a.y) || 1;
  for (const [s, k] of [[a, -c], [b, c]]) Object.assign(s, { x, y: y + k * 0.55, vx: 0, vy: 0, auSol: 0, cap: -k * Math.PI / 2 });
  // Tes mains sont celles du bagarreur de ton club.
  for (const eq of etat.humains) etat.controles[eq] = ids[eq];
  M.bagarre = { ...ids, coups: { A: 0, B: 0 }, tenu: { A: true, B: true }, prochain: { A: 0.3, B: 0.3 }, reste: BAGARRE.duree };
  ev.push({ type: 'gants', A: ids.A, B: ids.B });
}
/* Le duel au bouton : un appui de A ou X, un coup pour toi ; l'IA frappe à sa cadence ; chaque coup pèse sa Robustesse et sa masse. */
function duel(etat, entrees, ev) {
  const M = etat.match, B = M.bagarre;
  B.reste -= PAS;
  for (const eq of ['A', 'B']) {
    const s = parId(etat, B[eq]);
    let frappe = false;
    if (etat.humains.includes(eq)) {
      const e = entrees[B[eq]];
      const appui = !!(e && (e.passe || e.tir));
      frappe = appui && !B.tenu[eq];
      B.tenu[eq] = appui;
    } else {
      B.prochain[eq] -= PAS;
      if (B.prochain[eq] <= 0) { frappe = true; B.prochain[eq] = (0.6 + 0.8 * etat.de()) / (BAGARRE.cadence * (0.875 + 0.25 * s.p.robuste)); }
    }
    if (frappe) { B.coups[eq] += (0.6 + 0.8 * s.p.robuste) * Math.sqrt(s.masse / PATIN.masse); ev.push({ type: 'coup', qui: s.id, equipe: eq }); }
  }
  if (B.reste > 0) return;
  M.bagarre = null;
  const ecart = B.coups.A - B.coups.B, tot = B.coups.A + B.coups.B;
  const gagnant = Math.abs(ecart) <= 0.05 * tot ? null : ecart > 0 ? 'A' : 'B';
  for (const eq of ['A', 'B']) {
    const s = parId(etat, B[eq]), min = BAGARRE.minutes * 60;
    M.pim[eq] += BAGARRE.minutes;
    // La majeure s'ajoute à sa punition s'il en a une ; sinon, une neuve, coïncidente (`avantage` 0).
    const deja = M.penalites.find(p => p.id === s.id);
    if (deja) deja.reste += min; else M.penalites.push({ id: s.id, equipe: eq, genre: 'bagarre', reste: min, avantage: 0 });
    auCachot(etat, s);
  }
  M.bagarres.push({ A: B.A, B: B.B, gagnant, coups: { A: Math.round(B.coups.A * 10) / 10, B: Math.round(B.coups.B * 10) / 10 } });
  ev.push({ type: 'bagarre', A: B.A, B: B.B, gagnant });
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
  for (const g of etat.gardiens) { g.retire = false; Object.assign(g, { x: g.sens * (LIGNE_BUT - GARDIEN.sortie), y: 0, vx: 0, vy: 0, memoire: [], harponRepos: 0 }); }
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
  for (const g of etat.gardiens) Object.assign(g, { x: g.sens * (LIGNE_BUT - GARDIEN.sortie), y: 0, vx: 0, vy: 0, memoire: [], harponRepos: 0 });
  etat.arret = null;
  etat.enJeu = true;
}

/* ---------- un pas ---------- */
function pas(etat, entrees, ev) {
  etat.t += PAS;
  const M = etat.match;
  if (M && M.bagarre) { duel(etat, entrees, ev); return; }
  if (M && !M.ronde && !M.fusillade && !M.tirDePunition && (etat.arret || etat.mej) && !(etat.arret && etat.arret.reste === Infinity)) lireLesTrios(etat, entrees, ev);
  if (etat.arret) {
    if (etat.arret.reste === Infinity) return;
    if (etat.arret.fete) feter(etat, etat.arret.fete);
    if (M && !M.fini && !M.ronde && !M.fusillade && etat.arret.genre !== 'periode' && etat.arret.genre !== 'but') apresLeSifflet(etat, entrees, ev);
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
  // Le premier appui de chaque centre se garde, avec son instant (par rapport à la chute) et son bâton : un bouton déjà
  // tenu quand tout le monde se place ne compte pas, il faut presser.
  if (etat.mej) {
    const Mj = etat.mej;
    Mj.reste -= PAS;
    for (const eq of ['A', 'B']) {
      const c = Mj.centres[eq], s = c ? parId(etat, c) : null;
      const e = c ? (entrees[c] || (etat.ia ? etat.ia(etat, s) : null)) : null;
      if (e && hyp(e.x || 0, e.y || 0) > 0.3) Mj.batons[eq] = { x: e.x, y: e.y };
      if (e && e.passe && !s.tenaitPasse && Mj.appuis[eq] == null) Mj.appuis[eq] = { t: -Mj.reste, x: e.x || 0, y: e.y || 0 };
      if (s) s.tenaitPasse = !!(e && e.passe);
    }
    for (const s of etat.patineurs) if (s.surGlace && !Object.values(Mj.centres).includes(s.id)) { const e = entrees[s.id]; s.tenaitPasse = !!(e && e.passe); s.tenaitTir = !!(e && e.tir); }
    if (Mj.reste <= -MEJ.tard || (Mj.reste <= 0 && Mj.appuis.A && Mj.appuis.B)) tomber(etat, ev);
    return;
  }
  // L'horloge.
  if (M && etat.enJeu && !M.fusillade) {
    M.reste -= PAS;
    etat.equipes.A.presence += PAS; etat.equipes.B.presence += PAS;
    for (const p of M.penalites) {
      p.reste -= PAS;
      if (p.avantage > 0 && (p.avantage -= PAS) <= 0) { p.avantage = 0; if (p.reste > 0.01) renfort(etat, p.equipe); }
    }
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
      if (e && e.tir && !s.tenaitTir && s.harponRepos <= 0 && s.auSol <= 0) {
        const p = leveraitLeBaton(etat, s);
        if (p) soulever(etat, s, p, ev); else s.harpon = HARPON.duree;
        s.harponT = etat.t;
        s.harponRepos = HARPON.repos;
      }
      if (e && e.echec && e.recul && !s.tenaitEchec && s.elanRepos <= 0 && s.auSol <= 0) {
        // SE JETER DEVANT UN TIR (`PLONGE`) : couché en travers de son cap, il glisse sur son élan.
        s.auSol = s.couche = PLONGE.duree; s.coucheCap = s.cap; s.elanRepos = ECHEC.repos;
        ev.push({ type: 'plonge', qui: s.id });
      } else if (e && e.echec && !s.tenaitEchec && s.elanRepos <= 0 && s.auSol <= 0) {
        s.elan = ECHEC.duree; s.elanRepos = ECHEC.repos; ev.push({ type: 'elan', qui: s.id });
        // Qui lui montre déjà le dos quand il s'élance (le lot 5) : la charge par-derrière ne se siffle que sur eux.
        s.elanDos = etat.patineurs.filter(q => q.surGlace && q.equipe !== s.equipe && dosTourne(s, q)).map(q => q.id);
        // Lancé pendant la feinte du porteur adverse : il a mordu (`FEINTE`), la charge ne le renversera pas.
        const p = etat.rondelle.porteur ? parId(etat, etat.rondelle.porteur) : null;
        s.mordu = p && p.equipe !== s.equipe && p.feinte > 0 && !lue(etat, s, p, 'echec', ev) ? p.id : null;
      }
    }
    manier(etat, s, e, ev);
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
  const avantX = etat.rondelle.x, avant = { dernier: etat.rondelle.dernier, porteur: etat.rondelle.porteur };
  rondelle(etat, toutes, ev);
  if (M && !etat.arret && !M.ronde) horsJeu(etat, avantX, ev, avant);
  for (const Gd of etat.gardiens) gardien(etat, Gd, ev);
  for (const s of etat.patineurs) {
    const e = toutes[s.id];
    s.tenaitTir = !!(e && e.tir);
    s.tenaitPasse = !!(e && e.passe);
    s.tenaitEchec = !!(e && e.echec);
    s.tenaitFeinte = !!(e && e.feinte);
    if (!s.tenaitTir) { s.charge = 0; s.leve = false; }
  }
  if (M && !M.ronde && etat.enJeu && !etat.arret) volee(etat, toutes, ev);
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
/*
 * LE CHANGEMENT À LA VOLÉE (le lot 3 ; docs/sur-glace.md § 6). Un patineur qui demande le banc (`banc`, l'IA le décide
 * par les jambes, js/glace-ia.js) et arrive à `BANC.porte` m de sa porte sort ; au même instant, le plus reposé de son
 * groupe (les avants pour un avant, les défenseurs pour un défenseur), de la ligne la plus reposée du banc d'abord, saute
 * sur la glace par la même porte. Un pour un : jamais un patineur de trop. Le gardien qui revient (`Gd.retour`) prend la
 * place du premier qui sort, sans remplaçant. Toi, le patineur que tu joues sort de même s'il arrive fatigué à la porte.
 */
function volee(etat, entrees, ev) {
  for (const eq of ['A', 'B']) {
    const porte = porteDuBanc(eq), E = etat.equipes[eq], Gd = gardienDe(etat, eq);
    const boxe = new Set(etat.match.penalites.map(p => p.id));
    for (const s of etat.patineurs) {
      if (!s.surGlace || s.equipe !== eq || etat.rondelle.porteur === s.id || hyp(s.x - porte.x, s.y - porte.y) > BANC.porte) continue;
      const e = entrees[s.id];
      const toi = etat.humains.includes(eq) && etat.controles[eq] === s.id;
      if (!(e && e.banc) && !(toi && s.jambes < JAMBES.volee)) continue;
      if (Gd.retour) {
        sortir(etat, s);
        Gd.retire = false; Gd.retour = false;
        Object.assign(Gd, { x: porte.x, y: porte.y, vx: 0, vy: 0, memoire: [] });
        ev.push({ type: 'volee', equipe: eq, sort: s.id, entre: null, gardien: true });
      } else {
        const g = s.poste === 'D' ? 'D' : 'F';
        const banc = etat.patineurs.filter(p => p.equipe === eq && !p.surGlace && !boxe.has(p.id) && (p.poste === 'D') === (g === 'D'));
        if (!banc.length) continue;
        // la ligne la plus reposée du banc, puis le même poste, puis les jambes
        const moyenne = l => { const b = l.map(id => parId(etat, id)).filter(p => banc.includes(p)); return b.length ? b.reduce((a, p) => a + p.jambes, 0) / b.length : -1; };
        const lignes = E.lignes[g].map((l, k) => ({ k, m: moyenne(l) })).filter(x => x.m >= 0).sort((a, b) => b.m - a.m);
        const ligne = new Set(E.lignes[g][lignes[0].k]);
        const r = banc.slice().sort((a, b) => (ligne.has(b.id) - ligne.has(a.id)) || ((b.poste === s.poste) - (a.poste === s.poste)) || (b.jambes - a.jambes))[0];
        sortir(etat, s);
        r.surGlace = true;
        Object.assign(r, { x: porte.x, y: porte.y, vx: 0, vy: -2, cap: -Math.PI / 2, auSol: 0, charge: 0, lachee: 0, harpon: 0, elan: 0, ia: null, memo: null });
        ev.push({ type: 'volee', equipe: eq, sort: s.id, entre: r.id });
        // La ligne entière est sur la glace : c'est elle qui est en poste.
        const sur = surGlace(etat, eq).filter(p => (p.poste === 'D') === (g === 'D')).map(p => p.id);
        const k = E.lignes[g].findIndex(l => l.length && sur.every(id => l.includes(id)));
        if (k >= 0 && k !== E.enPoste[g]) { E.enPoste[g] = k; E.presence = 0; }
      }
      if (etat.controles[eq] === s.id) changerDeJoueur(etat, eq, false, ev);
    }
  }
}
/* Un patineur qui sort par la porte de son banc. */
function sortir(etat, s) {
  s.surGlace = false;
  Object.assign(s, { x: (s.equipe === 'A' ? -1 : 1) * BANC.x, y: W / 2 + 1.2, vx: 0, vy: 0, charge: 0, harpon: 0, elan: 0, feinte: 0, ia: null, memo: null });
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
    `La patinoire fait ${dec(L, 1)} m sur ${dec(W, 1)} (${dec(200 * PIED, 0)} sur ${dec(W, 1)} à la LNH) : rapetissée pour qu'une zone, ${dec(L / 2 - BLEUE, 1)} m de la bleue à la bande, ou la zone neutre, ${dec(2 * BLEUE, 0)} m, remplisse un écran 16:9 ; les coins sont des arcs de ${dec(COIN, 1)} m, la ligne de but est à ${dec(L / 2 - LIGNE_BUT, 2)} m de la bande.`,
    `La rondelle pèse ${Math.round(RONDELLE.masse * 1000)} g et perd ≈ ${dec(RONDELLE.frottement * G, 1)} m/s par seconde : une passe à ${kmh(BATON.passe)} km/h meurt après ${Math.round(arretDe(BATON.passe))} m, un tir à ${kmh(BATON.tirMax)} km/h traverserait ${Math.round(arretDe(BATON.tirMax))} m.`,
    `La bande rend ${Math.round(RONDELLE.bande * 100)} % de la vitesse qui la frappe, le poteau ${Math.round(RONDELLE.poteau * 100)} %, la maille du filet ${Math.round(RONDELLE.filet * 100)} %. Le long de la bande, elle perd ${Math.round(RONDELLE.longe * 100)} % de la poussée qui la frappe ; celle qui la frôle à moins de ${kmh(RONDELLE.colle)} km/h en travers ne rebondit pas : elle la longe, collée.`,
    `Un patineur ordinaire pèse ${PATIN.masse} kg (un vrai joueur, son poids à la LNH), pousse à ${dec(PATIN.accel)} m/s² jusqu'à ${kmh(PATIN.vMax)} km/h, freine à ${PATIN.frein} m/s² (le bâton à l'envers) et perd ${dec(PATIN.glisse)} m/s² en roue libre ; sa cote sur 20 fait sa pointe, à ±${Math.round(PATIN.ecart * 100)} % d'un 1 à un 20 (deux patineurs ne sont jamais loin l'un de l'autre), ses cotes Tir, Jeu, Défense et Robustesse son lancer, sa passe, son harpon et son équilibre.`,
    `Il pousse par coups de patin, une jambe puis l'autre : ${dec(2 * FOULEE.cadence)} par seconde au départ, ${dec(2 * (FOULEE.cadence + FOULEE.parVitesse * PATIN.vMax))} à pleine vitesse ; le coup pousse ${Math.round(FOULEE.coup * 100)} % plus fort que la moyenne, et l'entre-deux d'autant moins.`,
    `Ses lames tiennent ${PATIN.adherence} m/s² de côté : à pleine vitesse, le virage le plus serré fait ${dec(PATIN.vMax ** 2 / PATIN.adherence, 0)} m de rayon ; à l'arrêt, il pivote à ${PATIN.pivot} rad/s. Une présence coûte ${dec(JAMBES.usure)} jambes par seconde à fond, le banc en rend ${JAMBES.repos} ; sous ${JAMBES.changement}, ou après ${JAMBES.presence} s, la ligne change à l'arrêt de jeu.`,
    `La lame tient la rondelle à ${dec(BATON.lame[0])} m devant ; plus loin que ${dec(PATIN.portee)} m, elle est perdue. Une rondelle qui arrive à plus de ${kmh(BATON.reception)} km/h ne se prend pas : elle dévie. Le harpon porte à ${dec(HARPON.portee)} m devant, ${dec(HARPON.duree, 2)} s, et repose ${dec(HARPON.repos)} s.`,
    `La passe part à ${kmh(BATON.passe)} km/h, plus ${dec(BATON.passeLoin)} m/s par mètre de plus, menée là où le coéquipier sera ; le tir du poignet à ${kmh(BATON.tirMin)} km/h, le lancer frappé chargé ${dec(BATON.charge, 2)} s à ${kmh(BATON.tirMax)} km/h, le tir sur réception à ${Math.round(BATON.uneTemps * 100)} % du frappé sans charger ; la visée s'écarte de ±${dec(BATON.ecart * 57.3)}° (plus à pleine charge), et le tir part toujours vers le filet attaqué : le bâton choisit où (droit, le centre ; penché, le coin ; à fond de côté, ${Math.round(BATON.large * 100)} cm à côté du poteau).`,
    `Une mise en échec échange l'élan des deux corps (masse × vitesse) ; le moins lancé tombe ${dec(PATIN.sol)} s si l'écart dépasse ${CHUTE.seuil} kg·m/s (× son équilibre), et lâche la rondelle. L'élan du bouton pousse ${ECHEC.accel} fois plus fort pendant ${dec(ECHEC.duree, 2)} s. Frapper qui n'a pas la rondelle depuis ${dec(ECHEC.recent)} s, ou par-derrière (qui te montrait déjà le dos quand tu t'es élancé) : ${MATCH.punition / 60} minutes.`,
    `Le gardien de cote 10 voit la rondelle ${Math.round(GARDIEN.reaction * 1000)} ms en retard et couvre ${dec(GARDIEN.demi * 2, 2)} m des ${dec(FILET.large, 2)} m du filet (sa cote Arrêts le rend plus vif et plus large) ; il bouge à ${kmh(GARDIEN.vMax)} km/h au plus ; il gèle ${Math.round(GARDIEN.couvre * 100)} % de ses arrêts (${Math.round(GARDIEN.mitaine * 100)} % des tirs hauts, la mitaine), les autres rebondissent à ${Math.round(GARDIEN.rebond * 100)} % de la vitesse — de côté, vers le coin, selon sa cote Arrêts. À angle fermé, il colle au poteau ; une rondelle libre sous ${GARDIEN.lente} m/s à ${dec(GARDIEN.demiCercle)} m de son filet, il va la couvrir s'il y est le premier ; le porteur qui arrive à ${dec(GARDIEN.harpon.portee)} m de lui, il le harponne (une chance sur ${Math.round(1 / (GARDIEN.harpon.chance + GARDIEN.harpon.parArret * 10))} à une cote de 10).`,
    `Le hors-jeu se siffle à l'entrée de la zone quand on y porte la rondelle ; lancée ou passée dedans, il est différé, levé si les attaquants ressortent, sifflé s'ils la touchent ; le dégagement refusé quand la rondelle lancée de sa moitié passe la ligne de but sans être touchée (permis en désavantage) ; Trois périodes, puis ${MATCH.prolongation / 60} minutes à ${MATCH.surglaceOT} contre ${MATCH.surglaceOT}, puis ${MATCH.rondesFusillade} tirs de barrage et la mort subite ; en séries, la prolongation à cinq, autant qu'il en faut.`,
    `La mise en jeu : les deux centres face à face au point, personne d'autre dans le cercle (${dec(POINT.r, 2)} m de rayon), les ailiers sur ses traits, les défenseurs de l'attaque à ${dec(MEJ.bleue)} m en dedans de la bleue ; la rondelle tombe après ${dec(MEJ.chute)} s. Chaque centre vaut sa cote Jeu sur 20 × ${dec(MEJ.jeu)}, plus un dé × ${dec(MEJ.hasard)}, plus le bouton : +${dec(MEJ.timing, 2)} à la chute pile, moins à mesure qu'on s'en éloigne, rien à ${Math.round(MEJ.fenetre * 1000)} ms avant ou après ; seul le premier appui compte. Gagnée par plus de ${dec(MEJ.nette, 2)}, la rondelle part vers le coéquipier que le bâton pointe (au neutre, droit derrière : le défenseur) ; plus serrée, elle reste libre au point, à qui la prend.`,
    `La rondelle a une hauteur : le poignet monte à ${dec(BATON.hauteurMin)} m/s, le frappé chargé à ${dec(BATON.hauteurMax)} m/s (±${dec(BATON.ecartHauteur)}), la gravité la ramène, le sol lui rend ${Math.round(RONDELLE.rebondSol * 100)} % ; la barre est à ${dec(FILET.haut, 2)} m, la vitre à ${dec(RONDELLE.vitre)} m (par-dessus, hors jeu) ; une passe dont la ligne est barrée se soulève à ${dec(BATON.soulevee)} m/s ; au sol seulement, elle se prend. Le gardien laisse passer ${Math.round(GARDIEN.trous.haut * 100)} % des tirs dans le coin du haut, ${Math.round(GARDIEN.trous.cinq * 100)} % entre les jambières, ${Math.round(GARDIEN.trous.corps * 100)} % sur le corps.`,
    `Le bras levé (le hors-jeu différé), un attaquant dans la zone ne prend la rondelle que s'il la vise : le bâton poussé vers elle, à ${Math.round(VISE.appui * 100)} % au moins, à ${Math.round(VISE.cone * 57.3)}° près. La rondelle hors de la zone et un coéquipier dedans, ta lame ne la ramène pas dans la zone : elle la prend dehors. Hors de la zone d'attaque, le tir part où pointe le bâton : le lancer au fond, le dégagement le long de la bande.`,
    `Un patineur, de l'une ou l'autre équipe, sur la ligne de la rondelle au gardien (à ${dec(GARDIEN.ecranPres)} m de lui ou plus, la rondelle à ${GARDIEN.ecranLoin} m ou plus) fait l'écran : le gardien la voit ${Math.round(GARDIEN.ecran * 1000)} ms plus tard encore. Un tir qui frappe une lame à moins de ${BATON.devant} m du filet dévie (±${Math.round(BATON.devie * 57.3)}°, écart-type) et garde ${Math.round(BATON.garde * 100)} % de sa vitesse.`,
    `À reculons, la pointe et la poussée valent ${Math.round(PATIN.recul * 100)} % ; le turbo les monte à ${Math.round(PATIN.sprint * 100)} % et use les jambes ${PATIN.sprintJambes} fois plus vite ; en tournant à vitesse moyenne, les croisés poussent ${Math.round((PATIN.croise - 1) * 100)} % plus fort ; couper sec coûte ${Math.round(PATIN.virage * 100)} % de vitesse par radian ; un patineur plus léger que ${PATIN.masse} kg tourne un peu plus court (${Math.round(PATIN.agilite * 100)} % au plus), un plus lourd frappe plus fort sans patiner moins vite. Un harpon raté par-derrière sur le porteur l'accroche une fois sur ${Math.round(1 / HARPON.trebuche)} : deux minutes, ou un tir de punition sur une échappée. Le gardien se retire pour un sixième attaquant (l'IA, sous ${MATCH.retraitGardien} s, à un ou deux buts) ; une charge contre la bande pèse ${dec(CHUTE.bande)} fois ; une punition ne tombe que sur une charge voulue, le bouton pressé.`,
    `La lame tient la rondelle du côté de la main du joueur, à ${Math.round(BATON.cote * 100)} cm (un gaucher à gauche, comme la LNH le dit). Le revers — la rondelle de l'autre côté du corps, ou lancée à plus de ${Math.round(REVERS.angle * 57.3)}° du cap vers ce côté — part à ${Math.round(REVERS.tir * 100)} % de la vitesse et ${dec(REVERS.ecart)} fois plus écarté (la passe, ${Math.round(REVERS.passe * 100)} % et ${dec(REVERS.ecartPasse)} fois) ; le tir sur réception ne part que du coup droit. Plus lent que ${kmh(PROTEGE.vitesse)} km/h, un adversaire à ${dec(PROTEGE.pres)} m, le porteur protège : sa lame passe de l'autre côté du corps, et un harpon qui doit passer par son corps réussit ${Math.round(PROTEGE.harpon * 100)} % aussi souvent. La feinte déporte la lame de ${dec(FEINTE.ecart)} m pendant ${dec(FEINTE.duree, 2)} s (${dec(FEINTE.repos)} s avant la suivante) : un harpon ou une charge lancés pendant ce temps ratent, sauf si le défenseur la lit : ${Math.round(FEINTE.lit * 100)} % par point de Défense sur 20 au-dessus de ${FEINTE.aveugle} (à 18, ${Math.round(FEINTE.lit * (18 - FEINTE.aveugle) * 100)} %), ${Math.round(FEINTE.relue * 100)} % de plus si tu feintais déjà moins de ${FEINTE.usee} s plus tôt. La passe laissée, le bâton tiré vers l'arrière : un coéquipier qui te suit, à ${LAISSEE.portee} m au plus et lancé à ${kmh(LAISSEE.suit)} km/h, la trouve à ${dec(LAISSEE.vitesse)} m/s.`,
    `Collé au porteur, de côté (ni devant lui ni dans son dos, à ${dec(LEVE.pres)} m au plus), X lui soulève le bâton et lui prend la rondelle : sans contact ni punition, ${Math.round(LEVE.force * 100)} % de ce qu'un harpon ouvert réussirait, qu'il protège ou non (le harpon, lui, passe par son corps ${Math.round(PROTEGE.harpon * 100)} % aussi souvent). Un harpon raté a ses fautes, deux minutes : par-derrière sur un porteur lancé à plus de ${kmh(FAUTES.rapide)} km/h, l'accrochage (${Math.round(FAUTES.accroche * 100)} %) ; en fonçant sur lui à plus de ${kmh(FAUTES.fonce)} km/h, le cinglage (${dec(FAUTES.cinglage * 100)} %) ; à travers son corps, le bâton élevé (${Math.round(FAUTES.eleve * 100)} %).`,
    `Le double-échec : la mise en échec donnée pendant le coup de bâton, le manche à deux mains, pèse ${dec(DOUBLE.force, 2)} fois et se siffle ${Math.round(DOUBLE.siffle * 100)} fois sur 100 : ${MATCH.punition / 60} minutes. Après le sifflet, le bouton d'échec à ${dec(RUDESSE.portee)} m d'un adversaire le bouscule : la rudesse, ${MATCH.punition / 60} minutes sur-le-champ.`,
    `Se jeter devant un tir : sans la rondelle, B en reculant (LB tenu) te couche ${dec(PLONGE.duree)} s en travers de ton cap ; ton corps bloque sur ${dec(PLONGE.long)} m les tirs plus bas que ${Math.round(PLONGE.haut * 100)} cm, puis tu te relèves.`,
    `La bagarre : après une mise en échec de plus de ${Math.round(CHUTE.seuil * BAGARRE.gros)} kg·m/s ou une punition, deux joueurs de Robustesse ${BAGARRE.robuste + 1} ou plus sur 20 peuvent laisser tomber les gants, plus souvent s'ils passaient du temps au cachot à la LNH (jusqu'à ${BAGARRE.pimMax} fois pour ${BAGARRE.pimMax * BAGARRE.pim} minutes par match) ; une par joueur, jamais en prolongation. ${dec(BAGARRE.duree)} s de duel : martèle A ou X, chaque coup pèse ta Robustesse et ta masse ; l'IA frappe ${BAGARRE.cadence} fois par seconde. ${BAGARRE.minutes} minutes chacun, coïncidentes : les deux clubs restent à cinq.`,
    `À l'arrêt de jeu, Y choisit ton trio : il joue, quelles que soient ses jambes. À la volée, la rondelle loin, la ligne qui passe sous ${JAMBES.volee} jambes file à la porte de son banc, s'il y en a une à ${JAMBES.frais} au banc (l'IA comme tes coéquipiers ; toi, fatigué, tu y patines) ; à ${dec(BANC.porte)} m de la porte, l'un sort et le plus reposé entre, au même instant : jamais un patineur de trop. Les bancs sont à ${BANC.x} m du centre, chacun du côté de son filet de la première période : en deuxième, la présence est plus longue. Le gardien remis en jeu revient quand un patineur sort.`,
    `L'obstruction sur le gardien : un attaquant debout qui entre dans le gardien dans son enclave (${dec(FILET.enclave, 2)} m) le bouscule ; un but dans ce filet moins de ${dec(OBSTRUCTION.fenetre)} s après est refusé, et la mise en jeu va à la zone neutre ; entré à plus de ${kmh(OBSTRUCTION.fort)} km/h sans aller à la rondelle, ${MATCH.punition / 60} minutes. Poussé dedans par un adversaire, ou au sol, il n'y est pour rien.`,
    `Le contournement du filet : sorti de derrière, la lame à côté du poteau (${dec(CONTOUR.avant)} m devant la ligne des buts au plus, ${dec(CONTOUR.cote)} m du poteau au plus), le tir la glisse au ras du poteau ; le gardien qui le couvre l'arrête, celui resté à l'autre arrive trop tard.`,
    `Le plongeon désespéré : un tir qu'il n'atteindra pas en glissant, mais à ${dec(PLONGEON.portee, 2)} m de plus, le gardien plonge de ce côté ; tendu de tout son long, il en laisse passer ${Math.round(PLONGEON.trou * 100)} % et ne gèle rien, puis il reste couché ${dec(PLONGEON.sol)} s.`,
    `Le gardien joue la rondelle libre derrière son filet, plus lente que ${kmh(GARDIEN.jouer.lente)} km/h, s'il y est le premier : une remise au coéquipier ouvert, sinon le long de la bande, puis il revient. Derrière sa ligne, il ne la joue que dans le trapèze (${dec(2 * GARDIEN.jouer.trapeze[0] / PIED, 0)} pieds de large à la ligne des buts, ${dec(2 * GARDIEN.jouer.trapeze[1] / PIED, 0)} à la bande) : dehors, ${MATCH.punition / 60} minutes. Un tir au but est un arrêt ou un but, comme la LNH les compte ; un but, et les coéquipiers du buteur se regroupent ${dec(CELEBRATION.duree)} s.`,
  ];
}
