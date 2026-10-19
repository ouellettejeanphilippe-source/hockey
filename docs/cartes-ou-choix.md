# Cartes ou choix : toutes les actions du Rogue

18 octobre 2026. JP : *fais une liste de toutes les actions et décide ce qui est des cartes et ce qui est des choix en fonction de la situation* (devant une case vide de gardien qui offrait trois cartes).

## La règle

- **Une carte** est un outil que tu possèdes : elle te suit, se gagne (pack, boutique, butin, palier), se combine (la couleur de son coach, ton build) et se joue **quand tu veux**, souvent dans son moment (`si`). On la garde pour plus tard.
- **Un choix** est la réponse à une **situation** que la saison crée maintenant : il naît d'un fait (une blessure, un dossier, un rival, une intention), ses options dépendent de qui, contre qui et combien, et il se règle dans À faire (ou au duel). Il n'a pas de sens hors de sa situation.

Le test : *voudrais-je le garder pour plus tard ?* Oui : une carte. *N'existe-t-il que parce que tel fait vient d'arriver ?* Oui : un choix.

## Les choix (des situations)

| Action | Ce qui la fait naître | Où |
|---|---|---|
| La blessure : un réserviste, le ballottage, le club-école, le banc, le jouer blessé | un joueur blessé | À faire (`blessure`) |
| Le retour du blessé | sa guérison | À faire (`retour`) |
| Le physio (le ramener plus tôt) | un blessé à mi-chemin | À faire (`physio`) |
| **La case vide** : le club-école, tes lignes, le remplaçant | une case qu'aucun réserviste ne joue | À faire (`trou`) — **était trois cartes : corrigé** |
| Les fils (le Cheechoo, la disette, le duo, la recrue) | un fil fort de ta saison | À faire (`choix`) |
| Les dossiers de la semaine | un fait du lundi | À faire (`dossier`) |
| La route de la semaine | le lundi des semaines impaires | À faire |
| Tes rivaux | le premier lundi | À faire |
| L'objectif du proprio | son offre | À faire |
| Le point de presse, les courriels | la vie du DG | À faire (`courriel`) |
| La carte de trop | tes places qui débordent | À faire (`places`) |
| Le pack à signer, qui sort | un pack ouvert | À faire (`pack`), la liste |
| Le geste d'une période, la mise doublée | leur intention, la 3e d'un duel de saison | le duel |
| La carte de vestiaire d'avant-match | un gros match | le combat |
| Le coach d'une saison neuve, qui reste, les lotos | la fin d'une saison de la run | entre deux saisons |
| Ton joueur de concession | ta première run | le départ |

## Les cartes (des outils)

| Pile | Combien | Où elle joue | Quand | D'où elles viennent |
|---|---|---|---|---|
| Le cahier, le départ | 10 | ton cahier | au duel, la période de son moment | données à chaque run |
| Le cahier, à gagner | 34 | ton cahier (20 au plus) | au duel, la période de son moment | le butin d'un gros match gagné (une parmi trois), les packs |
| Les malédictions du cahier | 3 | ton cahier, malgré toi | elles encombrent ta main | la distraction (un fil mal tranché), le doute (une défaite contre ta bête noire), la blessure qui traîne (15 matchs et plus) |
| Les places | 45 | tes trois places | n'importe quel soir ; plus fort le soir de son moment | les paliers des 9e, 18e et 26e matchs (une parmi trois), les packs ; elles suivent d'une saison à l'autre |
| L'équipement | 18 | posé sur un joueur, la saison | les soirs de son moment | les packs |
| Les retouches d'édition | 10 | la carte d'un joueur | pour de bon | l'atelier (une main des journées 20, 40, 60), les packs |
| Les clauses | 12 | le contrat d'un joueur | dès la signature | les packs |
| Le personnel | 23 | tes postes (2 à 4 selon le prestige), la run | passif, les soirs de son moment | deux imposés au départ, les packs |
| Les contrats | 31 | ton plafond | dès qu'il est joué | les packs |
| Les contrats lourds | 6 | ton plafond | de l'espace tout de suite, un prix les soirs de son moment | la taxe de luxe cachée dans un pack (4 %), les autres dans les packs |

La liste carte par carte (le nom, la rareté, le coach, le moment) se lit dans le code : `BANQUE` (js/banque.js), le moment dans `si` (`MOMENTS_SI`, js/sim.js).

Les soins, les rappels et le blessé à long terme restent des cartes : on les garde pour le jour où la situation arrive, comme une assurance ; la situation elle-même (la blessure) est un choix, qui offre déjà le ballottage et le club-école.

## Les récompenses

Une récompense donne une carte : le palier du proprio (9e, 18e, 26e matchs), l'objectif réussi, le butin d'un gros match gagné. La main des paliers de la journée (20, 40, 60) en est une aussi, mais ses sortes sont des choix sur ton équipe et ton cahier (un joueur au choix, un nouveau rôle, le ménage, le camp d'entraînement, l'atelier) : elles s'ouvrent sur le moment.

## Ce qui a changé

- **La case vide** n'offre plus trois cartes de compensation : elle demande qui tient la case — un vrai joueur du club-école (gratuit, hors plafond), tes lignes remaniées derrière le banc, ou le remplaçant que le moteur y met.
