/*
 * L'ÉQUIPEMENT NEUF (V10, tranche 3 — docs/refonte-v10.md § 4). Une carte posée sur un joueur pour la saison, qui
 * ne joue que dans son MOMENT (`si`, `MOMENTS_SI`, js/sim.js) : à domicile, contre un rival, après trois victoires,
 * en séries, en 3e quand tu tires de l'arrière. Ce sont des MUTATIONS (js/sim.js), lues par `siDe` sur le soir du
 * joueur — le même que celui de son club, période par période au duel.
 *
 * Un joueur n'a que six canaux qui savent attendre un moment (`CANAUX_MUT` : ses tirs, sa précision, sa création, sa
 * défense, ses blessures, ses arrêts) : l'équipement est donc au Frelon, à l'Aigle, à la Tortue, au Doc et au
 * Showman, trois chacun, et trois neutres. Le Rhino, l'Abbé, le Contremaître et le Comptable ont leurs cartes aux
 * places et au personnel — pas de mécanique neuve pour leur en donner ici. Un patineur ne pèse pas assez pour qu'une
 * carte posée sur lui se voie dans la feuille de son club (la règle d'une rare) : son équipement est commun ou peu
 * commun ; seul un gardien porte une rare.
 */
const eq = { cible: 'libre', source: 'equipement' };
const gardien = { cible: 'libre', source: 'equipement', gardien: true };
export const EQUIPEMENT = {
  // ---- 🐝 le Frelon : ses tirs ----
  patinsAiguises: { nom: 'Les patins aiguisés', ico: '⛸', rarete: 'commune', ...eq, si: 'jambesFraiches', lancers: 1.3, finition: 1.15,
    quoi: 'Les jambes fraîches : il fonce au filet à chaque présence.' },
  batonLong: { nom: 'Le bâton plus long', ico: '🏑', rarete: 'peu', ...eq, si: 'visiteur', lancers: 1.25, finition: 1.1,
    quoi: 'Deux pouces de plus, et les patinoires des autres semblent plus petites.' },
  frenesie: { nom: 'La frénésie', ico: '🌪', rarete: 'peu', ...eq, si: 'enFeu', lancers: 1.5, finition: 1.15,
    quoi: 'Trois de suite : il tire de partout, et il ne veut plus s\'arrêter.' },

  // ---- 🦅 l'Aigle : sa précision ----
  rubanBlanc: { nom: 'Le ruban blanc', ico: '🏳', rarete: 'commune', ...eq, si: 'domicile', finition: 1.25, lancers: 1.08,
    quoi: 'Le même ruban depuis le junior, refait à chaque match chez lui.' },
  lameCourbe: { nom: 'La lame courbée', ico: '🌙', rarete: 'peu', ...eq, si: 'derriere', finition: 1.8, lancers: 1.2,
    quoi: 'En 3e, en retard, il sort le bâton qu\'il cache dans le sac.' },
  batonDeLOncle: { nom: 'Le bâton de ton oncle', ico: '🪃', rarete: 'peu', ...eq, si: 'rival', finition: 1.5, lancers: 1.15,
    quoi: 'Un vieux bâton de bois, et l\'oncle dans les estrades contre le rival.' },

  // ---- 🐢 la Tortue : sa défense, ses arrêts ----
  casqueGrille: { nom: 'Le casque grillagé', ico: '⛑', rarete: 'commune', ...eq, si: 'apresDefaite', defense: 0.85,
    quoi: 'Après une défaite, il bloque tout ce qui passe. Même avec la figure.' },
  jambieresChalet: { nom: 'Les jambières du chalet', ico: '🛷', rarete: 'peu', ...gardien, si: 'visiteur', arrets: 0.95,
    quoi: 'Les vieilles jambières de cuir, celles des voyages.' },
  masquePeint: { nom: 'Le masque peint', ico: '🎨', rarete: 'rare', ...gardien, si: 'series', arrets: 0.88,
    quoi: 'Un masque neuf pour le printemps, peint à la main.' },

  // ---- 🫁 le Doc : ses blessures ----
  genouillere: { nom: 'La genouillère', ico: '🦿', rarete: 'commune', ...eq, si: 'dosADos', blessure: 0.4,
    quoi: 'Le deuxième soir, le genou tient. Le physio l\'a vérifiée trois fois.' },
  protegeDents: { nom: 'Le protège-dents moulé', ico: '🦷', rarete: 'peu', ...eq, si: 'rival', blessure: 0.4, defense: 0.95,
    quoi: 'Contre un rival, ça cogne. Lui, il reste debout.' },
  semelles: { nom: 'Les semelles orthopédiques', ico: '👟', rarete: 'peu', ...eq, si: 'jambesLourdes', blessure: 0.5, lancers: 1.05,
    quoi: 'Quand les jambes sont lourdes, les pieds, eux, ne lâchent pas.' },

  // ---- 🌠 le Showman : sa création ----
  gantsLumineux: { nom: 'Les gants lumineux', ico: '💫', rarete: 'commune', ...eq, si: 'domicile', creation: 1.35,
    quoi: 'Chez lui, sous les projecteurs, il fait des passes de cirque.' },
  numeroFetiche: { nom: 'Le numéro fétiche', ico: '🔢', rarete: 'peu', ...eq, si: 'enFeu', creation: 1.45,
    quoi: 'Le 99 de sa jeunesse, cousu sous son chandail les soirs de séquence.' },
  plumesDuPaon: { nom: 'Les plumes du paon', ico: '🦚', rarete: 'peu', ...eq, si: 'series', creation: 1.6, finition: 1.15,
    quoi: 'En séries, il se donne en spectacle. Et ça marche.' },

  // ---- neutres ----
  casquetteVictoire: { nom: 'La casquette de la victoire', ico: '🧢', rarete: 'commune', ...eq, si: 'apresDefaite', lancers: 1.15, finition: 1.12,
    quoi: 'La casquette passe de tête en tête. Ce soir, c\'est à son tour.' },
  coccinelle: { nom: 'La coccinelle', ico: '🐞', rarete: 'peu', ...eq, si: 'beteNoire', lancers: 1.3, finition: 1.25, defense: 0.9,
    quoi: 'Elle s\'est posée sur son casque le soir de la défaite. Elle est revenue.' },
  amuletteDuDos: { nom: 'L\'amulette du dos-à-dos', ico: '🧿', rarete: 'peu', ...eq, si: 'dosADos', lancers: 1.15, finition: 1.12,
    quoi: 'Le deuxième soir, il la serre dans son gant avant la mise au jeu.' },
};
