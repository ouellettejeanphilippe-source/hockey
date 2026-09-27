/**
 * LE DECK DE MATCH (S74) — des cartes qu'on JOUE, pas qu'on subit.
 *
 * JP : *prends vraiment inspiration d'un jeu de deckbuilder avec choix et
 * cartes d'effets et autres, mais avec un simulateur de hockey en plus, et
 * fais une énorme variété de possibilités* ; *quand y'a un choix, c'est un
 * fullscreen modal pis ça se passe là, sauf si carte à utiliser plus tard* ;
 * *pense vraiment à un kid qui joue avec ses cartes Upper Deck comme si
 * c'était Slay the Spire*.
 *
 * LA BOUCLE, celle de Slay the Spire, posée sur le hockey :
 *   - tu commences la saison avec un DECK DE DÉPART de dix cartes simples
 *     (lancer, bloquer, changements courts, le discours du capitaine, la
 *     vidéo de l'adversaire) ;
 *   - avant chaque GROS MATCH et chaque match de tes SÉRIES, tu piges une
 *     MAIN de cinq cartes et tu as TROIS D'ÉNERGIE pour en jouer ;
 *   - une victoire dans un gros match te donne une RÉCOMPENSE (une carte
 *     parmi trois, ou passer) ; gagner une série, une carte plus rare ;
 *   - le ménage du vestiaire (une carte de palier) en RETIRE une ;
 *   - un objectif raté du proprio glisse une MALÉDICTION dans ton deck.
 *
 * CE QU'UNE CARTE FAIT EST RÉEL, et c'est le moteur qui le joue (js/sim.js,
 * `effetsDesCartes`) : un canal d'effet pour CE match (finition, volume,
 * défensive, discipline, énergie, robustesse, les minutes des lignes), un
 * effet sur l'ADVERSAIRE (ses punitions, son énergie, sa finition), son plan
 * de match qui tombe (« La vidéo »), tes deux premières lignes qui jouent son
 * contre, un pari tiré de la graine, de l'énergie rendue à tes joueurs, ou
 * une synergie qui lit ta formation (tes francs-tireurs, tes défenseurs purs,
 * tes lignes qui jouent le même système). Rien ne se lit d'une cote.
 *
 * TOUT EST PUR. Le deck se DÉDUIT des décisions (récompenses, retraits,
 * malédictions) ; la main d'un match se tire de la graine et du match ; les
 * récompenses offertes aussi. Une partie reprise retrouve les mêmes mains.
 */

export const ENERGIE_MAIN = 3;
export const TAILLE_MAIN = 5;

/*
 * Les cartes. `cout` en énergie ; `effet` : les canaux de CE match pour ta
 * formation ; `adv` : ceux de l'adversaire ; `pioche` : cartes de plus dans
 * la main ; `energiePlus` : énergie de plus ce match ; `lire` : son plan
 * tombe ; `contre` : tes deux premières lignes jouent le contre de son plan ;
 * `energieTous` : de l'énergie rendue à tes patineurs avant le match ;
 * `pari` : une chance, ce qu'on gagne, ce qu'on perd ; `synergie` : un effet
 * qui se calcule sur ta formation ; `maudite` : une malédiction ;
 * `injouable` : elle encombre la main ; `enMain` : ce qu'elle coûte si elle
 * est dans ta main au match.
 */
export const CARTES_MATCH = {
  // ---- le deck de départ ----
  lancer: { nom: 'Lancer de la pointe', ico: '🏒', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Les défenseurs décochent à la moindre ouverture.', effet: { volume: 1.06 } },
  bloquer: { nom: 'Bloquer des tirs', ico: '🛡️', cout: 1, rarete: 'commune', genre: 'defense',
    texte: 'Tout le monde se jette devant la rondelle.', effet: { defense: 0.95 } },
  changements: { nom: 'Changements courts', ico: '⏱️', cout: 0, rarete: 'commune', genre: 'tactique',
    texte: 'Des présences de trente secondes : des jambes fraîches toute la soirée.', effet: { energie: 0.9 } },
  discours: { nom: 'Le discours du capitaine', ico: '🧭', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Pige deux cartes.', pioche: 2 },
  video: { nom: 'La vidéo de l\'adversaire', ico: '📼', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Leur plan de match ne tient plus : leurs lignes reprennent leur réglage de la saison.', lire: true },

  // ---- communes ----
  echecAvant: { nom: 'Échec avant', ico: '🥊', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'On va chercher la rondelle dans leur zone.', effet: { volume: 1.08, discipline: 1.1 } },
  trappe: { nom: 'La trappe', ico: '🧊', cout: 1, rarete: 'commune', genre: 'defense',
    texte: 'Cinq joueurs en zone neutre. Personne ne passe.', effet: { defense: 0.93, volume: 0.95 } },
  sagesse: { nom: 'Pas de punition bête', ico: '🧘', cout: 0, rarete: 'commune', genre: 'defense',
    texte: 'Les bâtons en bas, les mains à soi.', effet: { discipline: 0.8 } },
  frapper: { nom: 'On frappe tout ce qui bouge', ico: '🦍', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Chaque présence, une mise en échec.', effet: { robustesse: 1.4, discipline: 1.1 } },
  partout: { nom: 'Tirer de partout', ico: '🎯', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Tout ce qui ressemble à un angle, on lance.', effet: { volume: 1.1, finition: 0.97 } },
  retour: { nom: 'Au filet pour le retour', ico: '🥅', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Deux joueurs dans l\'enclave, à chaque lancer.', effet: { finition: 1.05, energie: 1.05 } },
  conge: { nom: 'Matinée de congé', ico: '😴', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Pas de patin ce matin : tes patineurs reprennent 15 d\'énergie avant le match.', energieTous: 15 },
  prudence: { nom: 'Jouer de prudence', ico: '🔒', cout: 0, rarete: 'commune', genre: 'defense',
    texte: 'On ne force rien.', effet: { defense: 0.97, finition: 0.97 } },
  provoquer: { nom: 'Les provoquer', ico: '😈', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Un mot de trop après chaque sifflet : ils vont au banc des punitions.', adv: { discipline: 1.25 } },
  quatrieme: { nom: 'Le trio d\'énergie', ico: '🔋', cout: 0, rarete: 'commune', genre: 'tactique',
    texte: 'Ton quatrième trio joue plus, et tes vedettes respirent.', effet: { F: [0.95, 0.95, 1, 1.25], energie: 0.93 } },
  enclave: { nom: 'Devant le filet', ico: '🏗️', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Un gros bonhomme plante sa tente devant leur gardien.', effet: { finition: 1.04, robustesse: 1.2 } },
  poignets: { nom: 'Le tir des poignets', ico: '🌀', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Vite, précis, sans élan : le gardien ne le voit pas partir.', effet: { finition: 1.03, volume: 1.03 } },
  blitz: { nom: 'Le blitz', ico: '⚡', cout: 1, rarete: 'commune', genre: 'attaque',
    texte: 'Tout de suite, tout le monde : on veut les sortir du match avant qu\'ils y entrent.', effet: { volume: 1.12, energie: 1.12 } },
  presse: { nom: 'La conférence de presse', ico: '🎤', cout: 1, rarete: 'commune', genre: 'tactique',
    texte: 'Tu as dit ce qu\'il fallait dire la veille : ils jouent crispés.', adv: { discipline: 1.12, finition: 0.98 } },

  // ---- peu communes ----
  doublePresence: { nom: 'Double présence', ico: '🔥', cout: 1, rarete: 'peu', genre: 'attaque',
    texte: 'Ta première ligne saute sur la glace un tour sur deux.', effet: { F: [1.3, 1, 0.9, 0.8], energie: 1.05 } },
  contrePlan: { nom: 'Le contre parfait', ico: '🧠', cout: 2, rarete: 'peu', genre: 'tactique',
    texte: 'Tes deux premières lignes jouent le système qui étouffe leur plan, ce soir. Moins rodé, mais taillé pour eux.', contre: true, effet: { finition: 1.02 } },
  gardienFeu: { nom: 'Le gardien en feu', ico: '🧤', cout: 2, rarete: 'peu', genre: 'defense',
    texte: 'Il a vu la rondelle grosse comme un ballon toute la journée.', effet: { defense: 0.92 } },
  avantage: { nom: 'L\'avantage numérique en or', ico: '💥', cout: 2, rarete: 'peu', genre: 'attaque',
    texte: 'Le jeu de puissance répété toute la semaine.', effet: { finition: 1.07 } },
  systeme: { nom: 'Le système maison', ico: '📘', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Si au moins deux de tes lignes jouent le même système : finition +6 % ce soir.', synergie: 'systeme' },
  gachettes: { nom: 'Les gâchettes', ico: '🎯', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Finition +2 % par franc-tireur dans tes deux premiers trios (jusqu\'à +6 %).', synergie: 'gachettes' },
  murBleu: { nom: 'Le mur bleu', ico: '🧱', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Buts contre −2 % par défenseur pur habillé (jusqu\'à −6 %).', synergie: 'mur' },
  jambes: { nom: 'Les jambes', ico: '⚡', cout: 1, rarete: 'peu', genre: 'synergie',
    texte: 'Lancers +2 % par patineur rapide dans ton top 6 (jusqu\'à +8 %).', synergie: 'jambes' },
  des: { nom: 'Coup de dés', ico: '🎲', cout: 0, rarete: 'peu', genre: 'tactique',
    texte: 'Une chance sur deux : une soirée où tout rentre (finition +10 %). Sinon, une soirée où rien ne tient (buts contre +8 %).',
    pari: { chance: 0.5, gagne: { finition: 1.1 }, perd: { defense: 1.08 } } },
  user: { nom: 'Les user', ico: '😮‍💨', cout: 1, rarete: 'peu', genre: 'tactique',
    texte: 'On les fait patiner : leurs jambes brûlent plus vite ce soir.', adv: { energie: 1.15 } },
  ombre: { nom: 'Une ombre sur leur vedette', ico: '👤', cout: 2, rarete: 'peu', genre: 'defense',
    texte: 'Ton meilleur défensif la suit jusqu\'au banc.', adv: { finition: 0.94 } },
  adrenaline: { nom: 'Adrénaline', ico: '💉', cout: 0, rarete: 'peu', genre: 'tactique',
    texte: '+1 énergie ce match. Les jambes vont brûler un peu plus.', energiePlus: 1, effet: { energie: 1.08 } },
  fermeture: { nom: 'La paire de fermeture', ico: '🔐', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Ta première paire joue la moitié du match.', effet: { D: [1.25, 1, 0.8], defense: 0.97 } },
  barrage: { nom: 'Le barrage', ico: '🚧', cout: 2, rarete: 'peu', genre: 'defense',
    texte: 'Cinq joueurs entre la rondelle et ton filet, toute la soirée.', effet: { defense: 0.9, volume: 0.92, energie: 1.05 } },
  zamboni: { nom: 'La glace molle', ico: '🧽', cout: 0, rarete: 'peu', genre: 'tactique',
    texte: 'Le préposé à la surfaceuse est un ami : la rondelle roule mal pour tout le monde.', effet: { volume: 0.97 }, adv: { volume: 0.94 } },
  vieux: { nom: 'Le vétéran parle', ico: '🧓', cout: 1, rarete: 'peu', genre: 'defense',
    texte: 'Pas de panique : on joue notre match, on ne donne rien.', effet: { discipline: 0.85, defense: 0.97 } },
  tueur: { nom: 'L\'instinct du tueur', ico: '🗡️', cout: 2, rarete: 'peu', genre: 'attaque',
    texte: 'Quand on mène, on en veut un autre.', effet: { finition: 1.06, defense: 1.02 } },

  // ---- rares ----
  miracle: { nom: 'Le miracle sur glace', ico: '✨', cout: 3, rarete: 'rare', genre: 'attaque',
    texte: 'Une soirée comme celle de 1980.', effet: { finition: 1.08, defense: 0.93 } },
  legende: { nom: 'Le gardien de légende', ico: '🏆', cout: 2, rarete: 'rare', genre: 'defense',
    texte: 'Le genre de soirée qu\'on raconte trente ans plus tard.', effet: { defense: 0.88 } },
  chapeau: { nom: 'Le soir du tour du chapeau', ico: '🎩', cout: 2, rarete: 'rare', genre: 'attaque',
    texte: 'Les chapeaux vont pleuvoir.', effet: { finition: 1.1, discipline: 1.1 } },
  coach: { nom: 'Le coach dans leur tête', ico: '🎙️', cout: 2, rarete: 'rare', genre: 'tactique',
    texte: 'Leur plan tombe, et ils perdent leur calme.', lire: true, adv: { discipline: 1.15 } },
  preparation: { nom: 'Préparation totale', ico: '📋', cout: 1, rarete: 'rare', genre: 'tactique',
    texte: 'Pige trois cartes.', pioche: 3 },
  espion: { nom: 'Leur cahier de jeux', ico: '🕵️', cout: 2, rarete: 'rare', genre: 'tactique',
    texte: 'Tu connais leur cahier par cœur : leur main de ce soir ne fait rien.', annule: true },
  capitaine: { nom: 'Le capitaine prend le match', ico: '©️', cout: 2, rarete: 'rare', genre: 'attaque',
    texte: 'Il saute sur la glace un tour sur deux, et tout le monde le suit.', effet: { F: [1.35, 1, 0.9, 0.75], finition: 1.04, energie: 1.08 } },
  mur: { nom: 'Le mur de briques', ico: '🧱', cout: 3, rarete: 'rare', genre: 'defense',
    texte: 'Ils peuvent tirer toute la soirée.', effet: { defense: 0.85, volume: 0.95 } },

  // ---- légendaires (seulement après une série gagnée) ----
  butEnOr: { nom: 'Le but en or', ico: '🥇', cout: 3, rarete: 'legendaire', genre: 'attaque',
    texte: 'Le genre de soirée qui finit sur une affiche dans une chambre d\'enfant.', effet: { finition: 1.12, defense: 0.92 } },
  dynastie: { nom: 'La dynastie', ico: '👑', cout: 2, rarete: 'legendaire', genre: 'synergie',
    texte: 'Tes lignes jouent leur système les yeux fermés : si deux lignes jouent le même, finition +6 %, et leur main ne fait rien.', synergie: 'systeme', annule: true },
  ferveur: { nom: 'La ferveur', ico: '📣', cout: 1, rarete: 'rare', genre: 'attaque',
    texte: 'L\'aréna tremble dès la mise au jeu.', effet: { finition: 1.05, volume: 1.05, energie: 1.1 } },

  // ---- malédictions ----
  distraction: { nom: 'La distraction', ico: '📰', cout: 1, rarete: 'maudite', genre: 'malediction', maudite: true,
    texte: 'Le proprio fait les manchettes. Elle encombre ta main : la jouer coûte une énergie et ne fait rien.' },
  doute: { nom: 'Le doute', ico: '🌧️', cout: 0, rarete: 'maudite', genre: 'malediction', maudite: true, injouable: true,
    texte: 'Injouable. Si elle est dans ta main au match : finition −3 %.', enMain: { finition: 0.97 } },
  trainee: { nom: 'Une blessure qui traîne', ico: '🩹', cout: 0, rarete: 'maudite', genre: 'malediction', maudite: true, injouable: true,
    texte: 'Injouable. Si elle est dans ta main au match : fatigue +5 %.', enMain: { energie: 1.05 } },
};

export const DECK_DEPART = ['lancer', 'lancer', 'lancer', 'bloquer', 'bloquer', 'bloquer', 'changements', 'changements', 'discours', 'video'];

/* Un nombre de 0 à 1 tiré de la graine et de mots : la même entrée, le même nombre. */
function hache(...parts) {
  let h = 2166136261 >>> 0;
  for (const c of parts.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/*
 * LE DECK À UN MOMENT DE LA SAISON : le départ, plus les récompenses, moins
 * les retraits, plus les malédictions. `avant` borne les décisions de saison
 * (celles prises avant ce jour-là) ; `serie` ajoute les récompenses de séries
 * gagnées avant la ronde `ronde`.
 */
export function deckDe(decisions = [], { avant = Infinity, serie = [], ronde = Infinity, pertes = [], blessures = [] } = {}) {
  const deck = DECK_DEPART.slice();
  const retirer = cle => { const i = deck.lastIndexOf(cle); if (i >= 0) deck.splice(i, 1); };
  const saison = decisions.filter(d => d && d.jour != null && d.jour < avant).slice().sort((a, b) => a.jour - b.jour);
  // Les retraits se font APRÈS tous les ajouts : « Le ménage » peut retirer une
  // malédiction de cicatrice (le doute, une blessure qui traîne), qui s'ajoute
  // plus bas. Le retrait vise une carte qui est dans le deck à ce moment-là.
  const retraits = [];
  for (const d of saison) {
    if (d.recompense && CARTES_MATCH[d.recompense]) deck.push(d.recompense);
    if (d.retrait && CARTES_MATCH[d.retrait]) retraits.push(d.retrait);
    // Un objectif raté : le proprio fait les manchettes, et ça te suit.
    if (typeof d.palier === 'string' && d.palier.startsWith('v:') && d.effet) deck.push('distraction');
  }
  for (const d of serie) if (d && d.ronde < ronde && d.recompense && CARTES_MATCH[d.recompense]) deck.push(d.recompense);
  /*
   * CE QUE LA SAISON LAISSE (S74) : un gros match perdu contre ta RIVALITÉ
   * glisse le doute dans ton deck, une blessure de quinze matchs et plus une
   * blessure qui traîne. Ce sont des résultats du moteur — donc des faits de
   * la graine et des décisions, comme le reste du deck.
   */
  for (const j of pertes) if (j < avant) deck.push('doute');
  for (const j of blessures) if (j < avant) deck.push('trainee');
  for (const cle of retraits) retirer(cle);
  return deck;
}

/* La main d'un match : le deck battu par la graine et le match, cinq cartes, et la pioche dans l'ordre. */
export function mainDuMatch(graine, cle, deck, n = TAILLE_MAIN) {
  const ordre = deck.map((c, i) => [c, hache(graine, 'main', cle, i, c)]).sort((a, b) => a[1] - b[1]).map(([c]) => c);
  return { main: ordre.slice(0, n), pioche: ordre.slice(n) };
}

/*
 * LES RÉCOMPENSES : trois cartes différentes, jamais une malédiction ni une
 * carte du départ. Après un gros match, surtout des communes ; après une
 * série gagnée, des peu communes et des rares.
 */
export function recompensesOffertes(graine, cle, { serie = false } = {}) {
  const poids = serie ? { commune: 0, peu: 50, rare: 42, legendaire: 8 } : { commune: 60, peu: 30, rare: 10, legendaire: 0 };
  const pool = Object.keys(CARTES_MATCH).filter(k => !CARTES_MATCH[k].maudite && !DECK_DEPART.includes(k) && poids[CARTES_MATCH[k].rarete] > 0);
  const out = [];
  for (let t = 0; out.length < 3 && t < 40; t++) {
    const r = hache(graine, 'recompense', cle, t) * 100;
    const rarete = r < poids.commune ? 'commune' : r < poids.commune + poids.peu ? 'peu' : r < poids.commune + poids.peu + poids.rare ? 'rare' : 'legendaire';
    const choix = pool.filter(k => CARTES_MATCH[k].rarete === rarete && !out.includes(k));
    if (!choix.length) continue;
    out.push(choix[Math.floor(hache(graine, 'recompense-carte', cle, t) * choix.length)]);
  }
  return out;
}

/*
 * LA MAIN DE L'ADVERSAIRE (S74). JP : *les adversaires aussi ont des bonus,
 * malus, stratégies, et le jeu est de trouver comment contrer, surtout en
 * séries — sans changer la difficulté*. Dans un gros match et en séries,
 * l'adversaire joue AUSSI trois d'énergie de cartes, et on le SAIT d'avance :
 * ce sont les « intentions » de Slay the Spire. Sa main se tire de la graine et
 * du match — l'écran la montre, le moteur la joue, la même. Il ne joue que des
 * cartes qui ont un sens pour lui (pas de pioche, pas de plan à lire), et les
 * rares moins souvent. Ta main répond : « Pas de punition bête » contre « Les
 * provoquer », « Leur cahier de jeux » pour l'annuler toute.
 */
const POIDS_ADVERSE = { commune: 3, peu: 2, rare: 1, legendaire: 0 };
const POOL_ADVERSE = Object.keys(CARTES_MATCH).filter(k => {
  const C = CARTES_MATCH[k];
  return !C.maudite && !C.lire && !C.contre && !C.pioche && !C.energiePlus && !C.annule && C.cout > 0 && C.rarete !== 'legendaire'
    && (C.effet || C.adv || C.pari || C.synergie || C.energieTous);
});
export function mainAdverse(graine, cle, energie = ENERGIE_MAIN) {
  const out = [];
  let e = energie;
  for (let t = 0; t < 12 && e > 0; t++) {
    const choix = POOL_ADVERSE.filter(k => CARTES_MATCH[k].cout <= e);
    if (!choix.length) break;
    const total = choix.reduce((a, k) => a + POIDS_ADVERSE[CARTES_MATCH[k].rarete], 0);
    let r = hache(graine, 'adverse', cle, t) * total, k = choix[0];
    for (const c of choix) { r -= POIDS_ADVERSE[CARTES_MATCH[c].rarete]; if (r < 0) { k = c; break; } }
    out.push(k);
    e -= CARTES_MATCH[k].cout;
  }
  return out;
}
/* Un interrupteur de MESURE : `check_combat.mjs` compare avec et sans la main adverse. */
export const OPTIONS_COMBAT = { adverses: true };

/* Une main est-elle jouable telle quelle ? Le coût, l'énergie gagnée et les cartes injouables. */
export function energieDepensee(jouees) {
  let e = ENERGIE_MAIN;
  for (const c of jouees) { const C = CARTES_MATCH[c]; if (!C) continue; e -= C.cout; e += C.energiePlus || 0; }
  return e;
}
