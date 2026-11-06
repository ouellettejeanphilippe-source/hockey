# Ce soir, passé à l'audit d'unslop (5 nov. 2026)

JP a envoyé le fil Reddit sur **unslop** (Damir Sokolovsky, heydamir/unslop, CC BY 4.0), une skill qui fait passer une interface « générée par IA » à une interface dessinée : l'audit des signes de slop, l'ampleur, une direction en cinq lignes qu'on approuve avant le code, puis neuf passes (espacements, couleur, icônes, textes, typo, mise en page, détails, visuels, mouvement). JP : *go*. Voici l'audit de la page **Ce soir** du Rogue (la capture de `check_plateau`, journée 1 d'une run neuve, 390 px), fait avec ses critères (`references/signs.md`), et la direction. **Rien n'est codé** : la skill s'arrête ici et attend la réponse.

## L'audit, signe par signe

Ce que la page a déjà de dessiné : un noir teinté de la couleur du club (`--noir`, 3 % du vif), l'affiche-héros aux vraies couleurs de l'adversaire (le moment), la main de vraies cartes de hockey (le deuxième moment), un seul jeu d'icônes en trait à la barre du bas, aucune lueur colorée, aucun `transition: all`, les animations nommées et coupées sous `prefers-reduced-motion`. C'est une direction, pas un gabarit : la télé d'avant-match.

Les signes trouvés, avec leur emplacement :

| Signe (signs.md) | Où, sur Ce soir | La correction que la skill propose |
|---|---|---|
| L'accent partout, rien ne ressort | l'or (`--or`) sur le soulignement de l'onglet, la languette « Le proprio », « Touche une carte », le coin « Ton match », la barre « Encore 2 choix », le coin des cartes : six fois sur un écran | un accent une ou deux fois : le chiffre qui compte (ta jauge) et l'action primaire ; le reste en encre ou en sourd |
| Majuscules espacées sur chaque étiquette | 11 étiquettes sur 12 : CE SOIR, PROPRIO, MATCH 1, CE SOIR · CHEZ TOI, FACE À FACE ›, LE PROPRIO, TON BANC CE SOIR, TOUCHE UNE CARTE, TON MATCH, L'USURE, CASE LIBRE, les cinq portes (218 `text-transform: uppercase` et 288 `letter-spacing` de 0,02 à 0,12 em dans la feuille du plateau) | la casse de phrase partout, sauf là où la majuscule est la signature : le bandeau de bas d'écran (un par bloc) |
| Graisses 700 à 800 pour la hiérarchie | 47 déclarations à 600-800 contre 3 à 400-500 ; « NHL » et « PHI '84 » en 800 | la hiérarchie par la taille ; les plaques de l'affiche gardent leur gras (c'est le moment), le chrome descend à 500-600 |
| Un paragraphe dans le chrome, avec ses points | la phrase du départ (« Ton effectif : 0 Soutien et 1 Régulier de ton cartable, 20 bouche-trous de la ligue, avec Jamie Langenbrunner, Stefan Persson. Le proprio veut : finir dans les vingt-quatre premiers. Lance la saison quand tu veux. »), en toast au-dessus du banc ; « 0 Soutien » compte un zéro | une ligne de chiffres (« 1 Régulier · 20 bouche-trous · mandat : 24 premiers ») ou rien : Hier soir et le Proprio le disent déjà (interface.md : aucune phrase hors des histoires) |
| Une consigne dans le chrome | « Touche une carte », à droite du bandeau du banc | à l'infobulle ou nulle part (interface.md : ce qui explique va à l'infobulle) |
| Un emoji dans un bouton | « ⏳ Encore 2 choix · Tes 3 rivaux » | le mot seul, ou l'icône de la boîte en trait |
| Un seul élément aux coins doux sur une page de rectangles | la barre « Encore 2 choix » (le rayon des cartes, ~12 px) quand les bandeaux, les onglets et les plaques sont à 0 | un rayon par taille et une règle (contrôles 8, cartes 12, bandeaux 0), tenue partout |
| Un chiffre au format flou | la jauge du proprio : « ▬ / 24 » (un tiret dans la case du rang, journée 1) | « — » n'est pas un rang : « Pas encore classé · 24 à atteindre », ou la jauge seule sans chiffre tant qu'il n'y a pas de match |
| Une bande morte dans le héros | sous les bandeaux « Match 1 · Ce soir · chez toi » et au-dessus des plaques, le filigrane de l'écusson adverse occupe ~100 px sans rien dire | l'écusson ramené dans la plaque, l'affiche plus courte (240 px tient avec le VS) ou la bande remplie par la forme des deux clubs |
| Un dégradé de teinte à teinte | `.hub-face` : `linear-gradient(108deg, A 0 49,6 %, B 50,4 % 100 %)` — deux couleurs de club côte à côte, pas un fondu : **pas un signe**, c'est la coupe en biais du VS | garder |

Non trouvés : lueur, verre, néon, texte en dégradé, blobs, `animate-pulse`, `hover:scale`, points d'exclamation, mots de hype, fausses données, badges « New ✨ ».

## L'ampleur

**Slop léger, mode polish.** La page est dessinée (une direction, deux moments, un jeu d'icônes), il reste une poignée de signes, tous dans le chrome : l'accent dispersé, la majuscule partout, deux textes qui n'ont pas leur place, un emoji, un rayon, un chiffre, une bande morte. La skill dit : on corrige ce que l'audit a trouvé, la direction vient de la marque qui existe, on ne touche ni à la palette, ni à la police, ni à la mise en page, ni aux visuels. Les grandes idées vont au rapport, pas au code.

## La direction, en cinq lignes

- **Produit.** Un jeu de gestion de hockey où tu bâtis un club sous le plafond avec de vraies cartes de joueurs de toutes les époques, et tu vis la saison soir après soir.
- **Caractère.** La télé d'avant-match : sec, chaleureux, pressé (le gradin, pas le bureau).
- **Monde.** L'aréna le soir : le noir des gradins, la lumière aux couleurs du club, le carton glacé d'une carte de hockey.
- **Moments.** L'affiche-héros aux vraies couleurs de l'adversaire, et la main de cartes ; rien d'autre ne porte de couleur.
- **Signature.** Le bandeau de bas d'écran de la télé, un par bloc, le seul texte en majuscules de la page.

Le test du gabarit : si on changeait le nom du jeu, l'écran tiendrait-il pour un autre jeu de hockey ? L'affiche et les cartes non ; le chrome (or + condensé en majuscules) un peu : c'est ce que le polish resserre.

## Ce que le polish changerait, en valeurs

1. Espacements : rien à corriger (la grille de 4 px est tenue par `--esp-*`), sauf l'affiche : 240 px, le filigrane dans la plaque.
2. Couleur : l'or sur deux choses, la jauge du proprio et l'action primaire ; les coins des cartes et « Le proprio » en encre à 70 %.
3. Icônes : le ⏳ du bouton part ; les emojis des cartes restent (ce sont les icônes du jeu, `check_lexique`).
4. Textes : la phrase du départ devient une ligne de chiffres (ou part) ; « Touche une carte » part ; « — / 24 » devient « 24 à atteindre ».
5. Typo : Barlow Condensed reste ; la casse de phrase sur tout ce qui n'est pas un bandeau (les onglets, les portes, les coins, les languettes) ; `letter-spacing` 0,02 em au plus hors bandeau ; 600 au lieu de 700-800 dans le chrome.
6. Mise en page : la même.
7. Détails : un rayon par taille, écrit une fois (`--rayon-controle: 8px; --rayon-carte: 12px`), le bandeau à 0.
8. Visuels : les mêmes.
9. Mouvement : le même.

## Où ça vit, et les deux règles qui frottent

- **Ce n'est pas une refonte** : rien ne part, c'est une passe de polish sur un écran. `check_refonte` ne s'applique pas ; `check_plateau`, `check_lisibilite` et `check_clarte` jugent. Deux façons de le livrer : une petite PR de polish sur Ce soir maintenant (puis les onze autres pages, une à une), ou dans la tranche D1 du devis V25 (les composants du Rogue), où ces valeurs deviennent celles du module de composants et ne se posent qu'une fois.
- **Les emojis comme icônes** : la skill les veut tous partis ; chez nous une icône égale un sens (les rôles, les coachs, les moments : `ICONES`, `check_lexique`) et ils vivent dans les cartes. Proposition : les garder dans le contenu (cartes, fiches, histoires), les sortir du chrome (boutons, bandeaux, onglets).
- **Les majuscules** : la skill les bannit ; chez nous le bandeau est la signature. Proposition : la majuscule au bandeau seul.

Les règles d'unslop qui recoupent les nôtres (une phrase n'a pas sa place dans le chrome, un chiffre une fois, le chrome calme et la richesse dans un ou deux moments) sont déjà dans `interface.md` ; sa checklist pourrait entrer dans `check_lisibilite` (la casse hors bandeau, l'accent compté, le rayon par taille) quand JP aura tranché.

## Les onze autres pages (JP : *fais les onze autres pages*)

Le même polish, aux mêmes décisions, sur les captures de `check_plateau` :

| Page | Les signes trouvés | Ce qui a changé |
|---|---|---|
| Proprio | « 💀 Saison 1 · le mandat », « 💵 L'argent », « ⚔ Tes rivaux », « 🧾 Ses verdicts » (des emojis dans les titres de bloc) ; « — / 24 » ; « 🔮 Prévoir » ; Caisse / Libre en capitales | les titres sans emoji ; « 24 à atteindre » ; « Prévoir » ; les cellules en casse de phrase |
| Face à face | le titre de page et les étiquettes de rangée (Tirs, Précision, Attaque…) en capitales espacées ; le VS avec une lueur | casse de phrase (600, 0,02 em) ; le VS reste or, sans lueur |
| Lignes | « ‹ Retour » en pilule claire ; « 🤖 Aligner au mieux » ; les trios en capitales | le retour sur le fond sombre ; les jetons et boutons en casse de phrase |
| Joueurs | les lignes sous les cartes (« 1er trio · C ») et le tri en capitales | casse de phrase ; le coin doré reste le chiffre qui compte |
| Coach | les coins « Pas encore », « Niveau 3 » et les conditions sous les cartes en capitales ; « Case libre » | casse de phrase |
| Vestiaire | « Ton histoire s'écrit match après match. » (une phrase, un point) | « Ton histoire commence ce soir » |
| Boutique | « 80 🪙 · tu signes jusqu'à 14 M$ » en or et en capitales ; « 🎒 Pour commencer », « 🏅 Ton club » ; « Bronze », « Pack Bronze » en capitales espacées | la tête en encre, casse de phrase ; les titres sans emoji ; le prix reste le seul or |
| Album | « 28 cartes · 2 doublons », « Feuille 1 / 3 », les variantes en capitales ; « Tes joueurs, dans le cartable. Touche une carte. » | casse de phrase ; « Tes joueurs » |
| Classement | l'en-tête du tableau en capitales espacées | casse de phrase ; la colonne des points reste or |
| Calendrier | les étiquettes des billets en capitales | casse de phrase ; la case du jour garde son filet or |
| Meneurs | « Aucun match joué encore. » | sans point |
| Palmarès | « 📈 Le prestige du club », « 🏅 Les déblocages » ; « ▲ cran 1 » en or à droite du bandeau ; les marches (Dynastie…) en capitales ; le podium avec une lueur or | les titres sans emoji ; la droite des bandeaux en encre ; casse de phrase ; le podium en filet |
| Partout | le bouton flottant « … ▶ » ; le toast « 📥 Les 3 912 visages… hors ligne. » | sans flèche ; « Le jeu marche hors ligne · 3 912 visages et 45 écussons sur ton appareil » |

Ce que le 82-0 partage avec ces pages (l'en-tête du hub, les lignes d'hier, les tableaux du volet, les messages) reçoit la casse de phrase par une surcharge `body.mode-rogue`, à côté de sa règle : les autres modes attendent le devis D2. Les titres de bloc gardent la capitale : `.pl-bandeau`, `.pr-k`, `.pk-rayon h3`, `.vs-sec`, `.hub-titre`, `.bu-prochain-k` (les jetons du héros), `.bu-vedette`.
