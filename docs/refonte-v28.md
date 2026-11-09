# V28 — Le Rogue a l'air d'un vrai jeu

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 9 nov. 2026. Les maquettes sont dans docs/maquettes/v28.html : trois directions, deux écrans chacune, à 390 × 844, avec les vraies cartes du jeu et la glace de Sur glace. **Rien n'est codé.** JP choisit une direction (§ 11) ; on dessine ensuite tous ses écrans, puis on code.

**La mécanique ne bouge pas.** La V27 reste ce qu'elle est : les actes, les cœurs, le rival, le banc de cinq, la boutique à ses nœuds, les élites. Ce devis change ce que le joueur voit et touche, pas les règles.

## En une page

**Le constat.** L'interface du Rogue est un site web de sports, pas un jeu :

- un en-tête de site, avec le club, la fiche, la journée et un menu ☰ ;
- une barre d'onglets en bas (les cinq portes), plus des sous-onglets ;
- des pages qui défilent, faites de blocs à bandeaux, de rangées et de jetons ;
- une boîte de réception, « Tes choix » ;
- un bouton vert « Jour suivant », touché 186 fois par saison ;
- un match en direct fait de points sur un schéma et d'un fil de texte.

Vingt refontes ont changé la peinture et la place des blocs (le plateau, la télé, les maquettes de la V27), jamais cette charpente-là. C'est pour ça que ça « retourne le même ».

**La preuve que le jeu sait faire mieux** : Sur glace, dans le même dépôt, a déjà la foule, la glace, les patineurs en 16 bits, un tableau indicateur et des sons. C'est un jeu. Le Rogue est une appli à côté.

**Le plan.**

1. **Une scène par moment, plein écran, qui ne défile jamais.** Plus d'en-tête de site, plus de barre d'onglets, plus de sous-onglets dans le Rogue.
2. **Un HUD de jeu** : tes cœurs, tes jetons, l'acte et ton rang, dessinés dans les coins.
3. **Un menu pause** (le classement, le calendrier, les joueurs, l'album, le palmarès, les règles) qui s'ouvre par-dessus, comme dans un jeu.
4. **Le temps avance comme dans un jeu** : un toucher, et la saison file en rafale jusqu'à la prochaine chose qui compte (le marché, l'élite, le rival, une blessure, une histoire). Plus de « Jour suivant » 186 fois.
5. **Le match se voit pour vrai** : le rival, l'élite et les séries se regardent avec un vrai spectacle (direction A : les patineurs de Sur glace).
6. **Les cartes restent telles quelles** (JP, deux fois). Elles sont les objets du jeu ; le reste de l'écran est le décor autour d'elles.
7. **L'ancienne coquille part en bloc** : les portes, le Bureau, la boîte, le plateau à bandeaux, leur juge.

**Ce que je te demande** : choisir A, B ou C sur les maquettes (§ 11). Ma recommandation : **A**, avec la carte de l'acte de C comme écran d'accueil.

## 1. Ce que JP a dit

JP, 9 nov. 2026 : *Tu travailles beaucoup sur le jeu, mais tu gardes tellement les anciennes mécaniques que tu bâtis sur ce qui marche pas au lieu de vraiment repartir comme il faut à chaque fois. Donne-moi un vrai plan clair qui en fait un roguelike complet, complexe pis le fun, pas juste un roguelike coat of paint sur un jeu qui marche pas.* Puis : *Je parle de l'interface. J'hais l'interface. On dirait pas un vrai jeu.*

Le même reproche, depuis un mois :

- 3 nov. : *I don't feel you really redid the UI, you feel sports broadcast, neither the game itself.*
- 4 nov. : *Je pense pas que tu comprends, refais tous les écrans, de zéro.* ; *ça fait une bonne vingtaine de fois qu'on retravaille le UI et retourne le même, depuis des semaines, ya sûrement une raison ?* ; *faut arrêter de juste changer la peinture.*
- 2 nov. : *l'interface utilisateur et les mécaniques actuelles font un peu « cheap »* ; *une vraie expérience digne d'un roguelike ou card game le fun à la Balatro, Slay the Spire, Pokémon TCG.*
- 5 nov. : *En gros, tu fais la version Windows d'un jeu Flash Newgrounds.*
- 11 oct. : *le roguelike, c'est une lettre d'amour aux cartes de hockey, ça devrait pas être aussi messy.*
- 1er nov., sur Sur glace : *ya moyen d'avoir un vrai pixel art de qualité ?* ; *ça, c'est des sprites.*

Ce qu'il garde : *garder les cartes actuelles du jeu, pas les refondre, car ça permet de mieux voir les cartes* (4 nov.) ; *j'aime vraiment le format carte de hockey* ; *faut des logos, et garder anciens looks des cartes de joueurs* (7 nov.).

**La taille est décidée** : une refonte de l'interface du Rogue au complet. Ce devis ne la négocie pas à la baisse.

## 2. Pourquoi vingt refontes sont retombées sur le même look

Lu dans le code et joué au navigateur le 9 nov. 2026 (docs/captures/ et les captures d'`essai_rogue`).

| Ce qui fait « site web » | Où c'est | Ce que les refontes ont changé |
|---|---|---|
| L'en-tête de site (le club, la fiche, la journée, ☰) | `.topbar`, index.html | rien |
| La barre d'onglets en bas, les cinq portes | `SECTIONS_ROGUE`, `majNavbar` (js/game.js) | leur nombre (4, puis 5) et leurs noms |
| Les sous-onglets d'une section | `majSousNav` (js/game.js) | leurs noms |
| Une page qui défile, faite de blocs | `ouvrirSaison` (≈ 3 000 lignes de js/saison.js), js/composants.js | la place des blocs (V23), leur peinture (le plateau, la télé) |
| La boîte de réception | `messagesCourants`, `specsForces` | ses maisons, ses lignes |
| « Jour suivant », 186 fois par saison | `motDuJour`, `avancerSemaine` | le texte du bouton |
| Le match : des points sur un schéma, un fil de texte | js/direct.js, js/glace.js | les couleurs, le fil |

**La charpente n'a jamais été sur la table** : chaque refonte gardait les portes, les pages et la boîte, et changeait ce qu'il y avait dedans. Les règles de `.claude/rules/interface.md` encodent cette charpente (« cinq portes », « une maison par sujet », « Ce soir est une émission d'avant-match », « chaque titre de bloc en bandeau »), et `check_plateau` refuse une page qui ne la suit pas. Une session qui touche l'interface y revient donc d'office.

**Ce qu'un vrai jeu fait autrement** (Balatro, Slay the Spire, Marvel Snap, NHL 94, Retro Bowl) :

- Il montre **une scène à la fois** : la table, la carte, le combat, la boutique. Il ne montre jamais une page.
- Il garde **l'état dans un HUD** (les vies, l'or, l'étage) : jamais dans un en-tête de site.
- **Ce qu'on touche, ce sont les objets du jeu** (une carte, une case de la carte, l'adversaire), pas des onglets.
- **Ce qui sert peu est rangé dans un menu pause** (les stats, la collection, les options), pas dans une barre de navigation.
- **Tout bouge** : une scène entre, une carte se pose, un chiffre monte, un son répond.
- **Une direction artistique tient d'un bout à l'autre** : la police, les cadres, les couleurs.

## 3. Ce que le joueur ressent

**Le fantasme** : « j'ouvre le Rogue et je suis dans un jeu de hockey : la foule, la glace, mon club de bouche-trous, le rival au bout de l'acte ; je touche le prochain match et ça part. »

- **Le pic** : l'écran du rival, comme un boss ; le but qu'on voit entrer sur la glace ; la pochette qu'on déchire ; la Coupe.
- **Le jour ordinaire** disparaît : les soirs sans enjeu défilent en rafale, comme un tableau indicateur qui tourne, et on peut s'arrêter sur n'importe lequel.
- **On sait toujours où on est**, sans lire : les cœurs, les jetons et la piste de l'acte, au même endroit à chaque scène.

## 4. Les règles de l'interface

Elles valent pour les trois directions ; seule la peinture change de l'une à l'autre.

### 4.1 La coquille : une scène, un HUD, un menu pause

- Dans le Rogue, **aucun en-tête de site, aucune barre d'onglets, aucun sous-onglet**. L'écran entier est la scène.
- **Le HUD**, en haut de chaque scène :
  - tes cœurs, dessinés ;
  - tes jetons ;
  - l'acte et le match ;
  - ton rang sur la cible du contrôle.

  Rien d'autre. Une scène peut le cacher (le match, la pochette) ; il revient en sortant.
- **Le menu pause** (un bouton dans un coin, ou Échap, ou Start à la manette) s'ouvre par-dessus la scène : le classement, le calendrier, les meneurs, tes joueurs, l'album, le palmarès, les règles, quitter. Chacun est une page plein écran avec un seul retour.
- **Aucune scène ne défile.** Ce qui ne tient pas dans 390 × 844 se plie derrière un toucher, ou va au menu pause.

### 4.2 Les scènes

L'ordre d'une run, une scène chacune :

| La scène | Ce qu'on y voit | Ce qu'on y touche |
|---|---|---|
| L'acte (l'accueil) | la piste de l'acte (A, B) ou sa carte (C), le prochain match, ton banc | Jouer ; les Lignes ; le banc |
| La rafale | les soirs qui défilent : l'écusson de l'adversaire, le pointage qui tombe, le banc qui s'allume | s'arrêter ici ; regarder ce match |
| Le rival annoncé | un écran de combat : son écusson géant, son jeu, « Pour le battre » | Au combat (le jour venu) ; plus tard |
| L'avant-duel | les deux clubs, ta chance, les plans de ton banc en cartes | un plan ; Ton match |
| Le match | la glace et les patineurs (A), ou le pointage qui se compte (B) | la vitesse ; aller à la fin |
| L'après-match | le pointage, ce qui a joué, ce que ça rapporte | continuer |
| Le marché | le comptoir, les pochettes, la pièce parmi trois | acheter, déchirer |
| La pochette | la pile et la carte rare qui arrive (déjà un vrai moment de jeu ; elle reste) | passer, signer |
| Prendre une pièce | les trois cartes, ton banc, qui sort | prendre, passer |
| Le calendrier de l'acte | tes cases, les clubs échangeables, le renfort | échanger deux cases |
| L'élite | le club, ta chance, ce qu'elle paie | en faire une élite, non |
| Une histoire | la voix, le joueur en carte, deux cartes de réponse | une réponse |
| La fin d'acte | le contrôle, les cœurs, la pièce | continuer |
| La fin de run | la cause, les actes, les médailles | une run neuve |
| Les Lignes | tes trios debout, tes paires, ton gardien, en cartes | échanger deux cartes |

### 4.3 Le temps

- **Un toucher sur Jouer** fait partir la saison. Elle file en rafale, environ un soir par demi-seconde, et s'arrête d'elle-même sur ce qui arrête l'avance aujourd'hui : un nœud de boutique, l'élite du lundi, le matin d'un duel, une étape de l'acte, une blessure à régler, une histoire. La règle d'arrêt est celle de la V27, seule la présentation change.
- Pendant la rafale, un toucher **arrête** ; un toucher sur un soir le **montre** (le match, ou son résumé).
- « Jour suivant » et « Jusqu'à lundi » partent.

### 4.4 Le match

- **A** : le match vu (le rival, l'élite, chaque match de séries, ou n'importe quel soir qu'on choisit) se joue sur la glace de Sur glace, avec ses patineurs, sa foule et ses sons. Les **temps forts de la feuille** (chaque but, les gros arrêts, les punitions) sont mis en scène ; entre eux, l'horloge file. Les tireurs, les passeurs et les gardiens sont les vrais, aux couleurs de leur club. Tes pièces de banc s'allument sous la glace quand elles jouent.
- **B** : le match se compte période par période. Le pointage monte, et chaque pièce qui joue calcule son effet en vrais tirs, comme les jetons de Balatro.
- Dans les deux cas, **le match est celui que le moteur a joué** : la même feuille, les mêmes buts, au caractère près (la règle du direct, tenue).

### 4.5 Le jus

- Chaque scène **entre** : un glissé, un rideau, une carte qui se retourne. La rafale a son tic de tableau indicateur, le but sa sirène, le rival sa musique (js/sons.js, js/sons-glace.js).
- Les trois paliers de js/mouvement.js restent (l'ordinaire, le notable, le pic). Sous `prefers-reduced-motion`, rien ne bouge et le DOM porte le vrai chiffre.

### 4.6 Les cartes

- Les cartes de joueurs (`cartonHtml`, les 55 séries, les éditions) et les cartes de jeu (`carteHtml`) passent **telles quelles**.
- Dans la direction A, elles restent en haute définition au milieu du pixel art, comme un objet de collection posé sur la table.

## 5. Les trois directions (docs/maquettes/v28.html)

| | A · Arcade 16 bits | B · La table de cartes | C · La carte de la saison |
|---|---|---|---|
| Comme | NHL 94, Sur glace, Retro Bowl | Balatro, Marvel Snap | Slay the Spire |
| L'accueil | le tableau indicateur (cœurs, jetons, rang, piste de l'acte), le prochain match en boîte de menu, ton banc, un gros JOUER | une table : leurs cartes en haut, ton trio debout, ton banc en main, les jetons en pile, les cœurs en pions | la carte de l'acte : les matchs sur un chemin, le marché, l'élite et le rival dessinés ; le tiroir du prochain match |
| Le match | la glace et les patineurs de Sur glace, les temps forts mis en scène | le pointage qui se compte, période par période, les effets calculés à l'écran | (celui de A ou de B) |
| Le rival | — | — | un écran de combat, comme un boss |
| La police | une police pixel (*Press Start 2P*, OFL), et Barlow pour les chiffres | Barlow Condensed, gros et gras | Barlow Condensed |
| Ce qu'il coûte | le plus : mettre en scène une feuille avec les sprites | moyen | moyen : la carte se calcule des nœuds de la V27 |
| Le risque | des temps forts qui sonnent faux s'ils sont trop répétitifs | une table chargée à 390 px | une carte qui ment si l'acte n'a pas de vrais embranchements |

**Ma recommandation : A, avec la carte de l'acte de C comme écran d'accueil.**

- **A** : le dépôt a déjà la glace, la foule, les patineurs, les sons et le tableau indicateur. C'est la seule direction où le match lui-même devient un spectacle de jeu. Et c'est ce que JP a appelé *des sprites* et *la version Windows d'un jeu Flash Newgrounds*.
- **La carte de C** donne à l'accueil la forme d'un roguelike : les nœuds de la V27 (le marché, l'élite, le rival) existent déjà, il ne reste qu'à les dessiner.

## 6. Les cas limites

- **La vieille partie** : une run en cours s'ouvre sur la scène de l'acte au jour où elle était ; aucune clé de sauvegarde ne bouge — `check_sauvegardes`.
- **La rafale interrompue** (l'appli fermée au milieu) : on reprend au dernier soir joué ; la ligue se rejoue d'elle-même comme aujourd'hui.
- **Une blessure en pleine rafale** : la rafale s'arrête sur la scène du médecin.
- **Un écran plus petit (360 px) ou plus grand (l'ordinateur)** : la scène se centre à 390 × 844 au plus et s'agrandit en entier ; le décor remplit le reste (le pixel art se met à l'échelle par nombres entiers).
- **Le clavier et la manette** : A et Entrée jouent, B et Échap reviennent, Start ouvre le menu pause, les flèches choisissent une carte.
- **`prefers-reduced-motion`** : la rafale devient une liste qui se remplit, le match une suite d'images fixes.
- **Hors ligne** : `sw.js` liste les modules et la police neufs, oublie les partis — `check_coquille`.
- **Le 82-0, Sur table et l'exhibition** gardent leur interface : la refonte vise le Rogue seul.

## 7. Ce qu'il touche

**Les fichiers** : `js/saison.js`, `js/game.js`, `js/rogue-jeu.js`, `js/alignement.js`, `js/gerant.js`, `js/magasin.js`, `index.html`, `style.css`, `sw.js` ; des modules neufs pour la coquille de jeu, la rafale et le match en scène ; js/sprites.js et le dessin de la glace de js/sur-glace.js, lus par le match en scène (direction A) ; `fonts/` (la police pixel).

**Les règles fermes de `.claude/rules/interface.md`**, réécrites pour décrire la coquille de jeu :

- **Défaites** :
  - « cinq portes » et les sections du Rogue ;
  - « Le Rogue est le plateau » : son contrat page par page, ses bandeaux, ses jetons, ses coins ;
  - « Le contenu des pages » ;
  - « À faire ne contient que ce qui se règle » : la boîte part, chaque choix est une scène ;
  - « Ta plaque » : elle devient le HUD.
- **Tenues** :
  - la carte de jeu au format carte de hockey, les cartes telles quelles ;
  - mobile d'abord, 44 × 44, rien ne colle au bord ;
  - le jus en trois paliers ;
  - un choix se dit en vraies stats de match ;
  - le noir et les vraies couleurs des clubs ;
  - les écussons dessinés, jamais empruntés.
- **Réécrite** : « une maison par sujet » devient « l'état dans le HUD, le reste au menu pause ».

**Le vocabulaire** : entrent **scène**, **HUD**, **menu pause**, **rafale** ; partent **porte** (au sens d'onglet), **Bureau**, **Tes choix** (la boîte), **plateau**, **bandeau**.

**Les clés de sauvegarde ne bougent jamais** — `check_sauvegardes`.

## 8. Ce qui part

Chaque nom ci-dessous disparaît du jeu au remplacement (tranche 4), et *check_refonte* le vérifie sur la somme. Chacun a été cherché dans js/ le 9 nov. 2026. Ce qui n'appartient qu'au Rogue part ; ce que le 82-0 partage (l'en-tête, la barre d'onglets hors du Rogue, js/direct.js pour l'exhibition) reste pour lui, et le Rogue cesse de s'en servir. Le test du zéro : la coquille, la rafale et le match en scène s'écrivent depuis le § 4 et la maquette choisie, sans rouvrir le Bureau.

### La navigation du Rogue

- `SECTIONS_ROGUE` → le HUD et le menu pause.

### Le Bureau, ses pages et sa boîte

- `ouvrirSaison`, `rendreActions`, `messagesCourants`, `specsForces`, `PRESSE`, `auBureau`, `ouvrirJournal`, `nouvellesDuJour`, `autourHtml`, `semainePasseeHtml`, `prochainHtml`, `bancDuMatinHtml`, `proprioHtml`, `voletFiche`, `annonceHtml` → les scènes du § 4.2.

### Le temps à un toucher par jour

- `motDuJour`, `motDeLaSemaine`, `avancerSemaine` → la rafale.

### Le plateau à bandeaux

- `js/composants.js`, `pl-bandeau`, `pl-jetons`, `pl-coin`, `pl-cellules`, `pl-marche`, `pl-podium` → la direction choisie, écrite pour une scène.
- `scripts/check_plateau.mjs`, `scripts/check_composants.mjs` → un juge de la scène (*check_scene*, § 10).

**Le compte** : 28 noms, dont la plus grosse fonction du dépôt (`ouvrirSaison`, ≈ 3 000 lignes) et la section du plateau de style.css (≈ 840 lignes, de « LE PLATEAU DU ROGUE » à « 6a. LE CLUB »).

**À vérifier à la tranche 1, avant de l'ajouter** (en italique, pour que `check_refonte` ne le compte pas encore) : les gabarits *hub-* de js/saison.js que le tournoi de Sur table partage ; *js/direct.js* et *js/glace.js*, si l'exhibition peut prendre le match en scène à son tour ; les pages de la Ligue (*Classement*, *Meneurs*, *Palmarès*), qui passent au menu pause, réécrites ou gardées.

## 8b. Ce qui reste, et pourquoi

- **Toute la mécanique de la V27** (js/actes.js, js/pieces.js, js/greffes.js, les histoires, la boutique, le moteur) : JP parle de l'interface.
- **Les cartes** (`cartonHtml`, `carteHtml`, les séries, `EDITIONS`, la pochette et sa pile) : JP, deux fois. La pile d'une pochette est déjà un moment de jeu.
- **Sur glace** (js/sur-glace.js, js/sprites.js, js/sons-glace.js) : il devient la scène du match, il ne change pas de règles.
- **Les sons et le jus** (js/sons.js, js/mouvement.js).
- **Les écussons** (js/logos.js, img/logos/) et les photos (img/actions/, img/mugs/).
- **L'échange d'un joueur** (`choisirQuiSort`) et les Lignes en cartes (`caseEnCarte`) : refaits dans la scène, leur logique reste.
- **Le 82-0, Sur table, l'exhibition** et leur interface.

## 9. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| *RAFALE_MS*, la durée d'un soir dans la rafale | 500 ms | 250-900 | plus vite, on ne lit plus les scores ; plus lent, c'est le « Jour suivant » d'avant |
| *ECHELLE_PIXEL* (A), l'échelle de la glace et des sprites | 2 | 2-3, par nombres entiers | une échelle fractionnaire floute le pixel art |
| *TEMPS_FORTS_MAX* (A), les temps forts mis en scène par match | 8 | 5-12 | trop, le match dure ; trop peu, on ne voit pas son build jouer |
| La durée d'un match vu (A) | ≈ 60 s à ×1 | 30-90 s | plus long, le rival devient une corvée |
| La scène, au plus | 390 × 844 | — | jamais de défilement |

## 10. Les critères d'acceptation

- [ ] **La porte 0, la direction** — à juger par JP sur les maquettes : il choisit A, B ou C (ou un mélange), et dit « ça, c'est un jeu ».
- [ ] **La porte 1, tous les écrans** — à juger par JP : chaque scène du § 4.2 dessinée dans la direction choisie, à 390 × 844 ; il tranche avant le code.
- [ ] **Une scène, jamais une page** : dans le Rogue, aucune scène ne défile, aucun en-tête de site ni barre d'onglets n'est visible, le HUD est au même endroit dans chaque scène, chaque cible fait 44 × 44 — *check_scene* (neuf, à 390 × 844, une run lancée, chaque scène capturée).
- [ ] **Le temps** : une saison complète jouée de l'ouverture à la fin des séries demande au plus 60 touchers hors des choix eux-mêmes (aujourd'hui : 186 « Jour suivant » et ≈ 90 « Compris ») — *essai_rogue*.
- [ ] **Le match vu est le match joué** : chaque but montré a son tireur, ses passeurs et sa minute de la feuille, au caractère près — le smoke (la règle du direct, tenue).
- [ ] **Le match en scène tient au téléphone** (A) : 60 images par seconde sur l'essai de `glace-perf`, le premier temps fort en moins d'une seconde — `essai_poids`, `check_physique` (Sur glace ne bouge pas).
- [ ] **Les cartes ne bougent pas** : `cartonHtml` et `carteHtml` rendent le même HTML avant et après — `essai_rogue` (les captures des cartes).
- [ ] **Les vieilles parties** s'ouvrent sur la scène de l'acte — `check_sauvegardes`.
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire au moins une ligne pour deux ajoutées, style.css fait moins de la moitié du diff — `check_refonte` (sur la somme).
- [ ] Rien de mort — `check_mort`.
- [ ] À juger par JP à l'essai, au téléphone : on dirait un jeu ; on sait où on en est sans lire ; on a envie de toucher Jouer.

## Les tranches

Chaque tranche porte son extrait `docs/refonte-v28-<n>.md`.

**0. Les directions** — fait : docs/maquettes/v28.html, trois directions, deux écrans chacune. *JP choisit.*

**1. Tous les écrans** — les quinze scènes du § 4.2 et le menu pause, dans la direction choisie, à 390 × 844, avec les vraies cartes. *JP tranche ; aucune ligne de code.*

**2. La coquille** — la scène, le HUD, le menu pause, la rafale ; « Le Rogue neuf » s'ouvre à côté de l'ancien, avec la scène de l'acte, les Lignes et la fin de run. Juge : *check_scene*, `essai_rogue`, `check_sauvegardes`.

**3. Le match en scène** — d'abord un essai d'un jour : trois temps forts d'une vraie feuille mis en scène avec les sprites de Sur glace, au téléphone. Si ça sonne faux, la direction B prend le match. Juge : le smoke (les buts au caractère près), `essai_poids`, JP.

**4. Toutes les scènes, et le remplacement** — le rival, l'avant-duel, le marché, la pièce, le calendrier, l'élite, l'histoire, la fin d'acte. Le Rogue neuf devient le Rogue : tout le § 8 part, `interface.md` réécrite, `check_plateau` et `check_composants` partent. Juge : `check_refonte` sur la somme, `check_mort`, `check_coquille`, *check_scene*.

**5. Le jus** — les entrées de scène, les sons, la musique du rival, la rafale qui tique. Juge : JP à l'essai, `check_mort`.

## 11. Les questions à JP

1. **La direction** : A (arcade 16 bits), B (la table de cartes) ou C (la carte de la saison) ? — **Recommandé : A, avec la carte de l'acte de C comme accueil.**
2. **La rafale** : plus de « Jour suivant » ; un toucher, et les soirs filent jusqu'à la prochaine chose qui compte ? — **Recommandé : oui.**
3. **Le menu pause** : le classement, le calendrier, les meneurs, tes joueurs, l'album et le palmarès sortent de la barre du bas et vont au menu pause ? — **Recommandé : oui.**

## 12. Ce qui a été écarté

- **Repeindre les pages** (une autre palette, d'autres bandeaux, d'autres cartes de blocs) : c'est ce qu'ont fait les vingt refontes d'avant.
- **Garder les cinq portes** avec des scènes dedans : la barre d'onglets suffit à faire un site.
- **Refaire les cartes** : JP, deux fois.
- **Changer la mécanique en même temps** : un devis du 9 nov. (un match neuf, une run de dix-huit matchs) répondait à une autre question. JP parlait de l'interface ; la V27 reste.
