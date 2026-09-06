/**
 * Les réputations : le consensus des amateurs, là où aucune colonne ne parle.
 *
 * LA RÈGLE QUI GARDE CE FICHIER HONNÊTE : on n'y met que ce qu'un amateur
 * affirmerait SANS HÉSITER. Pas « il était bon », pas « il a eu de grosses
 * saisons » — ça, les colonnes le disent déjà et le moteur le lit. Seulement
 * ce dont tout le monde se souvient et qu'aucune statistique ne porte : la
 * vitesse, la puissance du lancer, l'ascendant sur un vestiaire, le poids
 * physique.
 *
 * C'est le seul endroit du dépôt qui repose sur du jugement plutôt que sur une
 * mesure, et c'est assumé. Le contrepoids est double : les effets sont petits
 * (`js/traits.js`), et `scripts/check_traits.mjs` vérifie que chaque nom
 * existe vraiment dans les shards — un nom mal orthographié serait un trait
 * mort dont personne ne saurait rien.
 *
 * Les noms suivent la forme de l'API de la LNH, seule clé qui rattache une
 * réputation à un joueur-saison : « Alex Ovechkin », pas « Alexander ».
 *
 * ⚡ VITESSE   le patinage. Ne s'applique plus passé 34 ans quand la date de
 *              naissance est connue — une réputation de vitesse ne survit pas
 *              aux jambes qui la portaient.
 * 💣 TIR       la puissance et la précision du lancer, pas le volume ni le
 *              pourcentage (ceux-là sont déjà dans le sommaire).
 * 🧭 MENEUR    l'ascendant : le gars qu'on veut sur la glace en avril et en
 *              prolongation.
 * 🥊 COLOSSE   le poids physique et l'intimidation. Le plus discutable des
 *              quatre, et le plus faible en effet, pour cette raison.
 */

export const REPUTATIONS = {
  VITESSE: [
    'Yvan Cournoyer', 'Guy Lafleur', 'Bobby Orr', 'Gilbert Perreault',
    'Paul Coffey', 'Mike Gartner', 'Sergei Fedorov', 'Pavel Bure',
    'Alexander Mogilny', 'Peter Bondra', 'Paul Kariya', 'Teemu Selanne',
    'Marian Gaborik', 'Scott Niedermayer', 'Sergei Makarov', 'Denis Savard',
    'Michael Grabner', 'Carl Hagelin', 'Bobby Hull', 'Mike Modano',
    'Connor McDavid', 'Nathan MacKinnon', 'Dylan Larkin', 'Cale Makar',
    'Erik Karlsson', 'Mathew Barzal',
  ],
  TIR: [
    'Bobby Hull', 'Brett Hull', 'Al MacInnis', 'Al Iafrate', 'Ray Bourque',
    'Mike Bossy', 'Mario Lemieux', 'Brendan Shanahan', 'Denis Potvin',
    'Guy Lafleur', 'Joe Sakic', 'Ilya Kovalchuk', 'Jarome Iginla',
    'Cam Neely', 'Pavel Bure', 'Teemu Selanne', 'Luc Robitaille',
    'Alex Ovechkin', 'Steven Stamkos', 'Shea Weber', 'Zdeno Chara',
    'Auston Matthews', 'David Pastrnak', 'Patrik Laine',
  ],
  MENEUR: [
    'Jean Beliveau', 'Gordie Howe', 'Bobby Clarke', 'Bryan Trottier', 'Denis Potvin',
    'Larry Robinson', 'Wayne Gretzky', 'Mark Messier', 'Mario Lemieux',
    'Steve Yzerman', 'Ray Bourque', 'Joe Sakic', 'Scott Stevens',
    'Nicklas Lidstrom', 'Jarome Iginla', 'Zdeno Chara', 'Sidney Crosby',
    'Jonathan Toews', 'Patrice Bergeron',
  ],
  COLOSSE: [
    'Gordie Howe', 'Larry Robinson', 'Denis Potvin', 'Clark Gillies',
    "Terry O'Reilly", 'Bob Probert', 'Cam Neely', 'Mark Messier',
    'Scott Stevens', 'Chris Chelios', 'Eric Lindros', 'Chris Pronger',
    'Adam Foote', 'Zdeno Chara', 'Dustin Byfuglien', 'Milan Lucic',
    'Tom Wilson',
  ],
};

/** Passé cet âge, une réputation de vitesse ne tient plus. */
export const AGE_MAX_VITESSE = 34;
