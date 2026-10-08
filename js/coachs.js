/**
 * LES COACHS (v2) — les builds d'un vrai roguelike.
 *
 * JP : *une refonte complète de tout ce qui est cartes, événements et autres
 * modifications, pour avoir une plus grande variété et base de données, ainsi
 * que différents builds, comme dans un vrai roguelike* ; puis *imagine que tu
 * fais un update v2 au jeu, c'est les cartes de la v2 que je veux* ; et, à la
 * proposition des « écoles » : *tes écoles, ça pourrait être des coachs ?*
 *
 * CE QUI MANQUAIT. Deux cents cartes, et chacune se jouait seule : un
 * pourcentage de plus, un pourcentage de moins. Dans Slay the Spire, une carte
 * de poison vaut plus quand ton deck en a dix ; dans Balatro, un joker de
 * cœur vaut plus quand ta main est pleine de cœurs ; dans TFT, trois
 * champions d'une même origine allument un bonus, six en allument un plus
 * gros. C'est ça, un BUILD : une direction qui se renforce à mesure qu'on s'y
 * engage, et qui coûte ce qu'on n'a pas pris ailleurs.
 *
 * NEUF COACHS, neuf façons de gagner au hockey, et CHAQUE CARTE est de la
 * couleur de l'un d'eux — les patrons, les événements, les modifs de joueurs,
 * les consommables, les contrats, les cartes de match et de saison. La
 * couleur d'une carte n'est pas collée à la main : elle se LIT sur ce que la
 * carte fait (`coachDesCanaux`), sur les canaux que le moteur joue déjà. Une
 * carte qui fait lancer est au Frelon ; une qui ferme la porte, à la Tortue.
 * Une carte neuve n'a rien à déclarer : elle trouve son coach seule (elle
 * peut le nommer, `coach`, quand sa lecture ne suffit pas).
 *
 * LA CONFIANCE DU VESTIAIRE. Chaque carte jouée compte pour son coach, dans
 * la saison ; à 3, 6 et 9 cartes, le vestiaire croit au coach (I, II, III)
 * et sa philosophie joue pour le reste de la saison, séries comprises — comme
 * un patron, sans prendre de poste. La confiance III contient la II. Au
 * départ d'une run, on CHOISIT son coach parmi trois (le personnage de Slay
 * the Spire) : il part avec trois cartes au compteur, sa confiance I allumée.
 * Les autres coachs peuvent prendre le vestiaire aussi, carte après carte. Et
 * une run qui continue garde ses coachs : la saison suivante repart du compte
 * de la fin (`coachsDeBase`, js/rogue-jeu.js).
 *
 * AUCUNE MÉCANIQUE NEUVE (CLAUDE.md) : une confiance est une décision `coach`
 * faite des canaux que `effetsDeSaison` lit déjà (finition, volume, défense,
 * robustesse, discipline, blessures, jambes, minutes des trios) et de ce que
 * les patrons changent à la boutique (`econ`). La décision porte ses
 * CHIFFRES : une partie reprise rejoue ce qui a été joué, même si ce fichier
 * change entre-temps.
 *
 * LES POIDS (js/sim.js `CARTES`, mesurés) : 1 % de précision ou de tirs ≈
 * 0,18 victoire sur une saison, 1 % de buts contre ≈ 0,28, un point de
 * robustesse ≈ 0,5. Une confiance I vaut un patron commun (≈ +0,3 V), la III
 * un légendaire et un peu plus (≈ +1,5 V) : neuf cartes d'un même coach,
 * c'est un engagement, et il se paie en cartes qu'on n'a pas prises ailleurs.
 */

/* Les seuils de la confiance : 3 cartes (I), 6 (II), 9 (III). */
export const SEUILS = [3, 6, 9];
export const ROMAINS = ['', 'I', 'II', 'III'];

/*
 * LA COULEUR D'UN JOUEUR (v2). JP : *je veux que les cartes de joueurs aient
 * des synergies avec certaines cartes, même chose pour coach*. Un joueur est de
 * la couleur du coach de son MEILLEUR RÔLE, s'il le maîtrise (« bon » et plus,
 * `ROLE_BON`, les mots de la fiche) : lu dans ses vraies stats, jamais dans une
 * cote. Un style posé qui déplace ses rôles déplace aussi sa couleur. Un
 * gardien, ou un joueur sans rôle maîtrisé, n'en a pas. Le Comptable n'a pas
 * de joueurs : il paie.
 */
export const ROLE_BON = 55;
export const COACH_DU_ROLE = {
  F: { sniper: 'rapaces', passeur: 'etoiles', deuxsens: 'tortue', power: 'essaim', checker: 'profondeur', energie: 'souffle', bagarreur: 'rhinos' },
  D: { defensif: 'tortue', offensif: 'essaim', manieur: 'choeur', physique: 'rhinos', deuxsens: 'tortue' },
};
/* Le coach de ces rôles (`profilsDe`, js/sim.js) pour un avant ('F') ou un défenseur ('D'), ou null. */
export function coachDesRoles(roles, groupe) {
  if (!roles || !COACH_DU_ROLE[groupe]) return null;
  const [role, score] = Object.entries(roles).filter(([k]) => COACH_DU_ROLE[groupe][k]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
  return role && score >= ROLE_BON ? COACH_DU_ROLE[groupe][role] : null;
}
/*
 * SES JOUEURS PORTENT UN COACH : la confiance d'un coach joue `JOUEUR_COACH`
 * plus fort (l'écart de chaque canal à 1) par PALIER de badge de sa couleur
 * habillé (V2.3 : un Platine compte pour quatre, un Bronze pour un, et plus de
 * plafond à cinq joueurs — un build qui va au bout est récompensé), compté au
 * soir du match (js/sim.js `coachsJoues`) : signer un sniper Or renforce
 * l'Aigle de trois paliers dès le lendemain.
 */
export const JOUEUR_COACH = 0.10;
/*
 * Au plus PALIERS_COACH_MAX paliers comptés (V2.3, check_voies) : sans plafond, un club tout d'une couleur
 * triplait l'effet de son coach, et un facteur comme les blessures du Doc (×0,44) passait sous zéro. Et chaque
 * canal s'amplifie EN PUISSANCE (×0,88 porté deux fois vaut ×0,77), qui reste positif.
 */
export const PALIERS_COACH_MAX = 24;
/* L'effet d'une confiance, porté par `n` paliers de sa couleur : chaque canal s'éloigne de 1 d'autant plus (les minutes et la boutique restent). */
export function porteParSesJoueurs(c, n) {
  const k = 1 + JOUEUR_COACH * Math.min(PALIERS_COACH_MAX, n || 0);
  if (k === 1) return c;
  const out = { ...c };
  for (const [cle, v] of Object.entries(c)) {
    if (typeof v !== 'number' || cle === 'palier') continue;
    out[cle] = cle === 'robustesse' ? v * k : Math.pow(v, k);
  }
  return out;
}
/* La maîtrise que la confiance II d'un coach donne à son système (js/sim.js, `maitrise` d'une décision). */
export const GAIN_SYSTEME = 0.35;
/*
 * Un coach : son visage (`ico`, un totem : une icône, un coach), son surnom,
 * `de` pour les phrases (« une carte du Frelon »), sa philosophie en une
 * ligne, et ce que chaque confiance joue pour la saison. Les SYSTÈMES SE
 * TIENNENT (v2, JP : *mieux ficeler les systèmes entre eux*) : `systeme`, le
 * système que ses joueurs apprennent à sa confiance II (la maîtrise du stage
 * de système, `GAIN_SYSTEME`), et qu'il joue alors un palier plus haut
 * (`bonusDuCoach`, js/sim.js). V2.3 : c'est le système qui DEMANDE ses badges
 * — l'Aigle le Volume de tirs (deux snipers), le Frelon l'enclave (deux power
 * forwards), l'Abbé et le Rhino un système de paire (manieurs, physiques) ; `recrute`, le style de joueur que son
 * dépisteur fait pencher dans les packs de joueurs de la run (js/packs.js). `econ` : comme un
 * patron (js/banque.js `modificateurs`, `plafondDe`).
 */
export const COACHS = {
  essaim: { ico: '🐝', nom: 'Le Frelon', de: 'du Frelon', mot: 'Tirer de partout, tout le temps.', systeme: 'derriere', recrute: 'des power forwards et des défenseurs offensifs',
    paliers: [{ volume: 1.028 }, { volume: 1.055 }, { volume: 1.092, plafonds: { pression: 0.15 } }] },
  rapaces: { ico: '🦅', nom: 'L\'Aigle', de: 'de l\'Aigle', mot: 'Chaque lancer doit rentrer.', systeme: 'bleue', recrute: 'des snipers',
    paliers: [{ finition: 1.028 }, { finition: 1.056 }, { finition: 1.094, plafonds: { finition: 0.15 } }] },
  tortue: { ico: '🐢', nom: 'La Tortue', de: 'de la Tortue', mot: 'Fermer la porte, gagner 2-1.', systeme: 'defensive', recrute: 'des two-way et des défenseurs défensifs',
    paliers: [{ defense: 0.973 }, { defense: 0.953 }, { defense: 0.919 }] },
  rhinos: { ico: '🦏', nom: 'Le Rhino', de: 'du Rhino', mot: 'Cogner et tenir, jusqu\'en avril.', systeme: 'rude', recrute: 'des bagarreurs et des défenseurs physiques',
    paliers: [{ robustesse: 0.4 }, { robustesse: 0.8 }, { robustesse: 1.3, blessure: 0.80, plafonds: { robustesse: 3.2 } }] },
  souffle: { ico: '🫁', nom: 'Le Doc', de: 'du Doc', mot: 'Des jambes fraîches et personne à l\'infirmerie.', systeme: 'energie', recrute: 'des plombiers',
    paliers: [{ energie: 0.79, blessure: 0.564 }, { energie: 0.694, blessure: 0.409, volume: 1.03 }, { energie: 0.607, blessure: 0.26, volume: 1.06 }] },
  choeur: { ico: '😇', nom: 'L\'Abbé', de: 'de l\'Abbé', mot: 'Jamais au cachot ; eux, souvent.', systeme: 'relance', recrute: 'des manieurs de rondelle',
    paliers: [{ discipline: 0.91 }, { discipline: 0.84 }, { discipline: 0.76, finition: 1.04, plafonds: { discipline: 0.15 } }] },
  profondeur: { ico: '🪜', nom: 'Le Contremaître', de: 'du Contremaître', mot: 'Quatre trios qui jouent, pas trois.', systeme: 'echec', recrute: 'des checkers',
    paliers: [{ F: [0.9, 1, 1.11, 1.27], energie: 0.853, blessure: 0.784 }, { F: [0.79, 1, 1.23, 1.57], energie: 0.751, blessure: 0.594, robustesse: 0.95 },
      { F: [0.68, 1, 1.34, 1.95], energie: 0.654, blessure: 0.428, robustesse: 1.71, volume: 1.097 }] },
  etoiles: { ico: '🌠', nom: 'Le Showman', de: 'du Showman', mot: 'Les vedettes sur la glace, toute la soirée.', systeme: 'courtes', recrute: 'des passeurs',
    paliers: [{ F: [1.08, 1.02, 0.95, 0.92], finition: 1.021 }, { F: [1.17, 1.06, 0.92, 0.83], finition: 1.042 },
      { F: [1.28, 1.1, 0.86, 0.74], finition: 1.069 }] },
  banque: { ico: '🏦', nom: 'Le Comptable', de: 'du Comptable', mot: 'Chaque jeton, chaque dollar du plafond.', recrute: 'des aubaines pour leur salaire',
    paliers: [{ econ: { rabais: 0.92 } }, { econ: { rabais: 0.86, jetonsVictoire: 2 } }, { econ: { rabais: 0.80, jetonsVictoire: 3, plafond: 0.05 } }] },
};
export const ORDRE_COACHS = Object.keys(COACHS);
/*
 * LES HUIT VOIES D'UNE RUN (V2.3, docs/refonte-systeme.md § 10). Le Comptable n'est plus un coach qu'on choisit
 * au départ : il est un patron (js/banque.js, `dir_comptable`), à côté de n'importe quel coach ; sa couleur reste
 * celle des cartes d'argent. Les huit autres, dans l'ordre où le prestige les ouvre (js/rogue.js `coachsOuverts`).
 */
export const VOIES = ['tortue', 'essaim', 'rhinos', 'rapaces', 'souffle', 'choeur', 'profondeur', 'etoiles'];

/* La confiance d'un compte (le palier) : 0 (rien), 1, 2 ou 3. */
export const palierDe = n => SEUILS.filter(s => (n || 0) >= s).length;
/* Combien il en manque pour le palier suivant (null au III). */
export const avantProchain = n => { const s = SEUILS.find(x => (n || 0) < x); return s ? s - (n || 0) : null; };

/*
 * LE COACH D'UNE CARTE, LU SUR CE QU'ELLE FAIT. `c` : tout ce qu'une carte
 * peut porter, quelle que soit sa famille — `effet` (les canaux, dont les
 * minutes F et D), `adv` (l'adversaire), `gestes` (soins, jambes, le filet),
 * `econ`, `gain`, `pari`, `plafond`, et les champs d'une MUTATION de joueur
 * (`lancers`, `creation`, `arrets`, `profils`, l'atelier). Chaque BON côté
 * marque des points pour son coach, rapporté à l'AMPLEUR ordinaire de son
 * canal (`AMPLEUR` : ce qu'une carte y met d'habitude) — sinon la défense,
 * qui vaut le plus en victoires, avalerait tout, et une carte de discipline à
 * −15 % se lirait moins qu'une précision à +1 %. Le coach qui a le plus de
 * points gagne ; le malus ne compte pas : il est le prix, pas le build. Rend
 * null — une carte NEUTRE — pour une carte qui ne touche à aucun canal (piocher,
 * lire leur plan), qui y touche à peine, ou qui sert deux coachs à parts égales.
 */
/* Une carte neutre : son meilleur coach marque moins que ça, ou le deuxième en marque au moins cette part. */
const SIGNAL_MIN = 0.7, PARTAGE = 0.8;
const AMPLEUR = { finition: 3, volume: 4, defense: 3, robustesse: 0.6, discipline: 10, blessure: 20, energie: 8, minutes: 15 };
export function coachDesCanaux(c = {}) {
  const s = {};
  const plus = (k, x) => { if (x > 0) s[k] = (s[k] || 0) + x; };
  const pc = (x, k) => (x * 100) / AMPLEUR[k];
  const lire = (e, cote = 1) => {
    if (!e) return;
    const v = (k, d = 1) => (typeof e[k] === 'number' ? e[k] : d);
    if (cote > 0) {
      plus('rapaces', pc(v('finition') - 1, 'finition'));
      plus('essaim', pc(v('volume') - 1, 'volume'));
      plus('tortue', pc(1 - v('defense'), 'defense'));
      plus('rhinos', v('robustesse', 0) / AMPLEUR.robustesse);
      plus('souffle', pc(1 - v('blessure'), 'blessure') + pc(1 - v('energie'), 'energie'));
      plus('choeur', pc(1 - v('discipline'), 'discipline'));
    } else {
      // Sur l'adversaire, le bon côté s'inverse : ses punitions montent, sa finition baisse.
      plus('choeur', pc(v('discipline') - 1, 'discipline'));
      plus('tortue', pc(1 - v('finition'), 'finition') + pc(1 - v('volume'), 'volume'));
      plus('souffle', pc(v('energie') - 1, 'energie'));
    }
    // Les minutes : le bas de l'alignement qui monte, ou le haut.
    for (const [g, k] of [['F', 3], ['D', 2]]) {
      const m = e[g];
      if (!Array.isArray(m)) continue;
      const pente = (m[k] ?? 1) - (m[0] ?? 1);
      plus(pente > 0 ? 'profondeur' : 'etoiles', pc(Math.abs(pente), 'minutes'));
    }
  };
  lire(c.effet);
  lire(c.adv, -1);
  const g = c.gestes || {};
  plus('souffle', (g.soin || 0) * 0.8 + Math.max(0, g.energie || 0) / 15 + Math.max(0, g.energieTous || 0) / 6 + (g.gardienAux ? 1.5 : 0));
  if (c.econ || c.gain || c.pari || c.plafond) plus('banque', 3);
  // Une MUTATION de joueur : ses canaux à elle, et ce que l'atelier lui apprend.
  if (c.mutation) {
    const M = c.mutation;
    lire({ finition: M.finition, volume: M.lancers, defense: M.defense ?? M.arrets, blessure: M.blessure });
    if (M.ombre) plus('tortue', pc(1 - M.ombre, 'defense') / 3);
    plus('etoiles', pc((M.creation || 1) - 1, 'finition') + (M.lustre ? 2 : 0));
    plus('profondeur', (M.cran || M.partout || M.enBas) ? 2.5 : 0);
    // Le feu qui s'entretient (V3.6) : la lancée, c'est de la finition.
    plus('rapaces', M.feu ? 2 : 0);
    plus('souffle', M.physio ? 2 : 0);
    const pr = M.profils || {};
    plus('rhinos', (Math.max(0, pr.power || 0) + Math.max(0, pr.physique || 0)) / 12);
    // Un contrat : ce qu'il coûte au plafond, c'est la banque.
    if (M.source === 'contrat') plus('banque', 1);
  }
  // NEUTRE (v2, JP : *faudrait quand même des cartes qui sont pas liées à un coach*) : un signal faible — une carte
  // d'appoint, moins de `SIGNAL_MIN` fois l'ampleur ordinaire de son canal — ou partagé presque à égalité entre deux coachs.
  const [top, deux] = Object.entries(s).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!top || top[1] < SIGNAL_MIN || (deux && deux[1] >= top[1] * PARTAGE)) return null;
  return top[0];
}

/* L'effet d'une confiance, tel qu'une décision le porte : `{ cle, palier, nom, ico, ...canaux, econ? }`. */
export function effetDePalier(cle, palier) {
  const E = COACHS[cle];
  if (!E || palier < 1) return null;
  const { econ, ...canaux } = E.paliers[palier - 1];
  return { cle, palier, nom: `${E.nom} ${ROMAINS[palier]}`, ico: E.ico, ...canaux, ...(econ ? { econ: { ...econ } } : {}) };
}
