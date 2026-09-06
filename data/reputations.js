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
 * 🪄 CREATEUR  la vision : il rend son équipe plus dangereuse, ce que la
 *              colonne des passes ne dit qu'à moitié.
 * 🧭 MENEUR    l'ascendant : le gars qu'on veut sur la glace en avril et en
 *              prolongation.
 * 🥊 COLOSSE   le poids physique et l'intimidation. Le plus discutable du lot,
 *              et le plus faible en effet, pour cette raison.
 * 🧤 VOLEUR    le gardien qu'on se rappelle. Il couvre TOUTES les époques, et
 *              c'est ce qui rachète le trou du Vezina : avant 1981-82 ce
 *              trophée n'était pas un vote, donc Dryden, Parent, Tony Esposito
 *              et Giacomin n'avaient aucun trait alors qu'ils sont exactement
 *              les gardiens dont on se souvient.
 *
 * COMBIEN DE NOMS ? Assez pour que « les joueurs marquants » veuille dire
 * quelque chose sur 55 saisons, pas assez pour que porter un trait cesse
 * d'être remarquable. Le juge est `scripts/check_traits.mjs` : il mesure la
 * part de joueurs-saisons qui en portent un, et l'effet sur une vraie équipe.
 * Allonger la liste sans rebaisser les magnitudes de `js/traits.js` gonflerait
 * les grandes équipes en silence.
 */

export const REPUTATIONS = {
  VITESSE: [
    // 1970-80 : le patinage qu'on décrivait avant que quiconque le chronomètre
    'Yvan Cournoyer', 'Guy Lafleur', 'Bobby Orr', 'Bobby Hull', 'Gilbert Perreault',
    'Marcel Dionne', 'Rick Middleton', 'Steve Shutt', 'Paul Coffey', 'Mike Gartner',
    'Denis Savard', 'Sergei Makarov',
    // 1990-2005 : l'ère des ailiers fusée
    'Sergei Fedorov', 'Pavel Bure', 'Alexander Mogilny', 'Peter Bondra',
    'Paul Kariya', 'Teemu Selanne', 'Ziggy Palffy', 'Tony Amonte',
    'Sami Kapanen', 'Brian Leetch', 'Scott Niedermayer', 'Mike Modano',
    'Marian Gaborik', 'Michael Grabner', 'Carl Hagelin',
    // aujourd'hui
    'Connor McDavid', 'Nathan MacKinnon', 'Dylan Larkin', 'Cale Makar',
    'Erik Karlsson', 'Quinn Hughes', 'Mathew Barzal', 'Jack Eichel',
    'Johnny Gaudreau', 'Taylor Hall', 'Kyle Connor', 'Andrei Svechnikov',
    'Sebastian Aho', 'Mika Zibanejad',
  ],
  TIR: [
    'Bobby Hull', 'Guy Lafleur', 'Phil Esposito', 'Marcel Dionne', 'Denis Potvin',
    'Mike Bossy', 'Michel Goulet', 'Charlie Simmer', 'Al Secord', 'Ray Bourque',
    'Al MacInnis', 'Al Iafrate', 'Brett Hull', 'Mario Lemieux', 'Cam Neely',
    'Dino Ciccarelli', 'Brendan Shanahan', 'Kevin Stevens', 'Dave Andreychuk',
    'Bernie Nicholls', 'Pavel Bure', 'Teemu Selanne', 'Luc Robitaille',
    'Jaromir Jagr', 'Keith Tkachuk', 'John LeClair', 'Markus Naslund',
    'Joe Sakic', 'Ilya Kovalchuk', 'Jarome Iginla', 'Shea Weber', 'Zdeno Chara',
    'Alex Ovechkin', 'Steven Stamkos', 'Evgeni Malkin', 'Phil Kessel',
    'Vladimir Tarasenko', 'Auston Matthews', 'David Pastrnak', 'Patrik Laine',
    'Leon Draisaitl', 'Nathan MacKinnon',
  ],
  CREATEUR: [
    'Bobby Orr', 'Bobby Clarke', 'Marcel Dionne', 'Bryan Trottier',
    'Denis Savard', 'Peter Stastny', 'Bobby Smith', 'Neal Broten',
    'Wayne Gretzky', 'Mario Lemieux', 'Paul Coffey', 'Adam Oates',
    'Dale Hawerchuk', 'Doug Gilmour', 'Ron Francis', 'Steve Yzerman',
    'Craig Janney', 'Brian Leetch', 'Igor Larionov', 'Peter Forsberg',
    'Joe Thornton', 'Nicklas Backstrom', 'Henrik Sedin', 'Sidney Crosby',
    'Pavel Datsyuk', 'Nikita Kucherov', 'Connor McDavid', 'Artemi Panarin',
    'Mitch Marner',
  ],
  MENEUR: [
    'Jean Beliveau', 'Gordie Howe', 'Phil Esposito', 'Bobby Clarke',
    'Bryan Trottier', 'Denis Potvin', 'Larry Robinson', 'Wayne Gretzky',
    'Mark Messier', 'Mario Lemieux', 'Steve Yzerman', 'Ray Bourque',
    'Guy Carbonneau', 'Doug Gilmour', 'Chris Chelios', 'Trevor Linden',
    'Joe Nieuwendyk', 'Brian Bellows', 'Joe Sakic', 'Scott Stevens',
    'Nicklas Lidstrom', "Rod Brind'Amour", 'Mats Sundin', 'Daniel Alfredsson',
    'Jarome Iginla', 'Zdeno Chara', 'Shea Weber', 'Sidney Crosby',
    'Jonathan Toews', 'Patrice Bergeron', 'Anze Kopitar',
  ],
  COLOSSE: [
    'Gordie Howe', 'Dave Schultz', 'Larry Robinson', 'Denis Potvin',
    'Clark Gillies', "Terry O'Reilly", 'Bob Probert', 'Cam Neely',
    'Wendel Clark', 'Rick Tocchet', 'Mark Messier', 'Scott Stevens',
    'Chris Chelios', 'Ulf Samuelsson', 'Marty McSorley', 'Owen Nolan',
    'Keith Tkachuk', 'Gary Roberts', 'Darius Kasparaitis', 'Eric Lindros',
    'Chris Pronger', 'Adam Foote', 'Zdeno Chara', 'Dion Phaneuf',
    'Dustin Byfuglien', 'Milan Lucic', 'Brad Marchand', 'Matthew Tkachuk',
    'Tom Wilson', 'Ryan Reaves',
  ],
  VOLEUR: [
    // Avant 1981-82 le Vezina n'était pas un vote : sans cette liste, les
    // gardiens dont on se souvient le mieux n'auraient aucun trait.
    'Jacques Plante', 'Glenn Hall', 'Gump Worsley', 'Eddie Giacomin',
    'Tony Esposito', 'Ken Dryden', 'Bernie Parent', 'Rogie Vachon',
    'Gerry Cheevers', 'Billy Smith',
    'Grant Fuhr', 'Ron Hextall', 'Mike Vernon', 'Andy Moog', 'Tom Barrasso',
    'Patrick Roy', 'Ed Belfour', 'Dominik Hasek', 'Martin Brodeur',
    'Curtis Joseph', 'Mike Richter', 'John Vanbiesbrouck', 'Felix Potvin',
    'Olie Kolzig', 'Nikolai Khabibulin', 'Jose Theodore', 'Miikka Kiprusoff',
    'Roberto Luongo', 'Henrik Lundqvist', 'Tim Thomas', 'Ryan Miller',
    'Cam Ward', 'Corey Crawford', 'Jonathan Quick', 'Carey Price',
    'Marc-Andre Fleury', 'Pekka Rinne', 'Braden Holtby', 'Sergei Bobrovsky',
    'Andrei Vasilevskiy', 'Connor Hellebuyck', 'Igor Shesterkin',
  ],
};

/** Passé cet âge, une réputation de vitesse ne tient plus. */
export const AGE_MAX_VITESSE = 34;
