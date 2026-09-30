# La refonte de l'interface : un jeu, pas une page web

JP (30 sept.) : *je crois qu'il faut une refonte COMPLÈTE de ce que voit le joueur ; tu repars du même UI et UX depuis le début, c'est ok d'en garder de bons éléments, mais ça te bloque à créer un vrai UI de gamer*.

Ce document est le système de design de la refonte et la feuille de route de `style.css`, réécrit depuis zéro. Le moteur, les sauvegardes, les règles et le DOM (les noms de classes que `js/` rend et que le smoke touche) ne bougent pas : c'est la PEAU et la MISE EN SCÈNE qui sont neuves. Ce qu'on garde parce que c'est bon : les cartons de collection (`cartonHtml`, dix séries), les cinq sections dans le même ordre, le noir comme décor et les vraies couleurs d'équipe.

## Ce qu'on regarde

Trois références, une idée chacune :

- **Football Manager 26** : un écran de gérant est un TABLEAU DE BORD — de grands chiffres, des panneaux plats, une seule action principale par écran, et la couleur du club comme fil conducteur.
- **NHL (EA) et la diffusion télé** : l'habillage d'un match est un BANDEAU — bord à bord, condensé, en capitales, deux couleurs de club, des filets plutôt que des cadres.
- **Balatro, Slay the Spire** : un jeu de cartes se joue avec de GROSSES cartes qui bougent ; ce qu'on choisit se voit à un mètre.

Et le contraire de ce qu'on a mesuré (docs/decisions.md, « La peau ») : 973 émojis, 71 tailles de police, 322 couleurs, 53 rayons, 200 dégradés, des pastilles partout. Un produit professionnel se reconnaît à ce qu'il s'interdit.

## Les règles du système

1. **Sept tailles**, pas une de plus : `--t-1` 12 (étiquettes), `--t-2` 14 (le corps compact), `--t-3` 16 (le corps), `--t-4` 20 (un sous-titre, un chiffre de liste), `--t-5` 28 (un titre de panneau, un chiffre clé), `--t-6` 40 (un pointage, un montant), `--t-7` 64 (le score d'un match, le titre d'écran). Toute taille intermédiaire est une faute que `check_css` refuse.
2. **Trois rayons** : `--r-0` 0 (les bandes, les tableaux, les filets), `--r-1` 4 (boutons, cases, puces), `--r-2` 12 (panneaux, cartes, feuilles). Jamais 999.
3. **Une vingtaine de couleurs**, toutes des jetons : le décor (`--noir`, `--fond-1`, `--fond-2`, `--fond-3`, `--filet`), l'encre (`--encre`, `--encre-2`, `--encre-3`), le sens (`--bon`, `--mauvais`, `--or`, `--attention`), le club (`--club`, `--club-2`, `--club-encre`, `--club-sourd`), l'état choisi (`--choisi`, `--sur-choisi`), la glace du plateau (inchangée). Une couleur écrite en hexadécimal hors de `:root` est une faute.
4. **La couleur dit quelque chose** : vert = ce qui rapporte, rouge = ce qui coûte, or = ce qui se gagne, la couleur du club = ton identité. Un chiffre coloré remplace une pastille colorée : « +6 % » en vert, jamais « Tirs +6 % » dans une capsule.
5. **Une typographie** : Barlow Condensed porte tout ce qui est titre, chiffre, bouton, onglet, étiquette (capitales, interlettrage 0,04 à 0,1 em selon la taille) ; la police système porte les phrases. Un mot en gras dans une phrase est en gras, pas en condensée.
6. **À plat** : aucune ombre portée hors des feuilles et des fenêtres qui flottent (une seule, `--ombre`), aucun dégradé hors des cartes de collection et du bandeau de club, aucun grain, aucun vernis. Le relief vient des filets (1 px `--filet`) et des fonds (`--fond-1` sur `--noir`).
7. **Les mots du jeu ont une icône au trait**, pas un autocollant : rôles, systèmes, trophées, bonus, agressivité, consigne, carrure gardent leur émoji dans le code (un caractère, `check_clarte` le lit), mais il rend en MONOCHROME, de la couleur du texte, par la police Noto Emoji (OFL) en sous-ensemble des 310 émojis du jeu (`fonts/NotoEmoji-sous-ensemble.woff2`, 210 Ko, placée avant les polices d'émojis du système dans `--display` et `--corps`). Le même trait sur tous les appareils, sans toucher un seul gabarit. La chrome (boutons, onglets, en-têtes) garde le sprite SVG `#i-*` d'`index.html`.
8. **Une action principale par écran**, en bas, pleine largeur au téléphone, en or ou en couleur de club ; les autres en contour. Jamais deux boutons pleins côte à côte.
9. **Rien de petit** : aucun texte sous 12 px, aucune cible sous 44 px, aucune icône sous 16 px. Une étiquette est en 12 px condensée en capitales, pas en 9 px.
10. **Le bandeau plutôt que la boîte** : un en-tête d'écran, de panneau ou de rangée est une bande bord à bord avec un filet, pas une carte arrondie dans une carte arrondie. Deux niveaux d'emboîtement au plus.

11. **Au téléphone, tout descend d'un cran à la source** : sous 680 px, `:root` réécrit les jetons (t-3 15, t-4 17, t-5 22, t-6 30 ; esp-3 10, esp-4 12 ; barres 64 et 56). Rien sous 12 px, rien sous 44 px de cible. Un écran du cœur de jeu tient en un écran de téléphone : ce qui déborde s'ouvre en sous-page (une tuile à icône, une feuille par-dessus), jamais en longue page.

## La coquille

- **Le tableau indicateur** (`#topbar`) : une bande de 56 px (64 au bureau) sur `--fond-1`, filet du club de 3 px en tête ; à gauche l'écusson et le nom du club en `--t-4`, l'état en `--t-1` ; à droite trois cellules séparées par des filets — FICHE, RANG, PLAFOND — en `--t-5` condensé, l'étiquette en `--t-1` au-dessus. Le plafond garde sa barre (4 px, `--bon` → `--mauvais`).
- **Le rail** (bureau, ≥ 1000 px) : 88 px, cinq entrées, icône 24 px + mot `--t-1` ; l'entrée courante porte un filet du club à gauche et `--fond-2`. **La barre** (téléphone) : 64 px + zone de gestes, mêmes cinq entrées.
- **Un écran** = une bande de titre (`--t-6`, capitales, la couleur du club en filigrane) + un corps qui défile + une barre d'action collée en bas. La page ne défile jamais.
- **Retour** : une flèche à gauche du titre, jamais un « ✕ » flottant. Échap, B, retour Android font pareil.
- **Le focus** : un anneau de 2 px `--choisi` en mode clavier ou manette seulement ; les invites « Ⓐ Confirmer · Ⓑ Retour » en bas du rail.

## Les écrans du cœur de jeu

- **L'écran titre** : le nom du jeu en `--t-7`, le carton « Continuer » en héros (l'écusson de ton club, sa fiche, la journée), puis les modes en une rangée de trois cartons plats à filet ; Options et Règles en liens.
- **Le bureau** (Club) : à gauche la fiche du prochain match en bandeau bicolore (les deux écussons, la fiche de chacun, le lieu, « soir éreintant » en badge or) ; dessous les quatre tuiles (classement autour de toi, cinq prochains, meneurs, deck) ; à droite la boîte de réception en panneau (au téléphone, en feuille). L'action : « Journée suivante ». Un seul « Regarder », en contour. Le tableau indicateur dit déjà la journée, la fiche et le rang : le bureau n'a pas de bande de tête. Hier soir tient en une ligne (toucher : le sommaire) et le prochain match suit sans un geste. Au téléphone, l'ordre est l'affiche, la boîte, le volet, et la barre d'action est collée au bas de la feuille : rien ne flotte par-dessus le texte.
- **Le soir de match**, quatre étapes dans le même écran, un onglet par étape en tête : APERÇU (le dépistage), PRÉPARATION (consigne, filet, lignes ; la main de cartes pour un gros match), MATCH (le direct, ou son sommaire), RÉSULTAT (le pointage en `--t-7`, les trois étoiles, les jambes perdues, le +/−). On avance par l'action du bas ; on revient par l'onglet.
- **Au téléphone, une liste plutôt qu'une galerie** : le vestiaire est une rangée par joueur (le carton attend dans la fiche), l'alignement une rangée par case, le bureau un hub de huit tuiles à icône ; ce qui se compare se lit en colonne, ce qui se contemple s'ouvre au toucher.
- **L'effectif** : l'alignement en TABLEAU DE LIGNES — chaque trio et chaque paire est une bande : le titre à gauche (1ER TRIO, son système, sa chimie), les cases à droite ; une case = le nom en `--t-4`, le rôle et son mot, le niveau et la zone, le chiffre clé en `--t-5`, les jambes en barre. Le résumé d'équipe en cinq cellules sous le titre.
- **Le marché** : la roulette en bandeau bicolore du club tiré (les relances en trois cellules), le vestiaire en grille de cartons ; le bouton « Signer » est LE bouton plein de l'écran. Au téléphone, trois rangées basses (le bandeau, les relances, la case à combler et le budget du choix) puis les filtres : la première carte se lit jusqu'à Signer sans défiler, et la barre d'action n'apparaît qu'avec « Lancer la saison ». Un chiffre, une place : les signables sont le badge de l'onglet, les signés sont dans l'en-tête.
- **La fiche** : le carton de collection à gauche (inchangé), la fiche à droite en cellules de chiffres `--t-5` ; « Ce qu'il sait faire » en rangées (icône, rôle, mot, barre de maîtrise) ; Signer collé en bas.
- **La ligue** : des tableaux en bandes (rangée de 40 px, chiffres tabulaires), ta rangée en `--club-sourd`.
- **La collection** : les cartons en grille ; le cartable et l'album en onglets.

## Le mouvement

Un écran entre par un fondu de 160 ms et une montée de 8 px ; un onglet glisse de 120 ms ; une carte choisie monte de 4 px ; un chiffre qui change compte (`js/mouvement.js`). `prefers-reduced-motion` éteint tout.

## La feuille de style, réécrite

`style.css` est réécrite depuis zéro dans cet ordre, une section par écran, chacune commençant par un commentaire qui la nomme :

```
0. jetons (:root, les trois palettes), la police, la remise à zéro
1. la coquille : tableau indicateur, rail et barre, écran, titre, barre d'action, retour, focus, toast, chargement
2. les briques : boutons, onglets, segments, champs, tableaux, cellules de chiffres, puces (texte), icônes
3. l'écran titre et « Nouvelle partie »
4. le marché : roulette, vestiaire, carton (gardé), fiche
5. l'effectif : lignes, cases, résumé, banc, fenêtre du système, « Préparer le match »
6. le club : bureau, tuiles, boîte de réception, soir de match (quatre étapes), direct, sommaire, entracte, mains de cartes
7. la ligue : classement, calendrier, meneurs, équipes, séries, bilan
8. la collection : historique, cartable, album, packs, inventaire, boutique, Rogue
9. les règles et les options
10. Sur table (le bloc existant, ramené aux jetons)
11. les points de rupture : 390 (défaut), 640, 1000 (le rail), 1200, 1440
```

Le contrat : les sélecteurs que `scripts/smoke.mjs`, `scripts/smoke_table.mjs` et `scripts/essai_rogue.mjs` touchent restent ; `check_css` refuse une taille hors des sept, une couleur hors des jetons, un rayon hors des trois ; `check_mort` refuse une classe sans élément ; le smoke refuse un débordement à 390 px et une cible hors de portée.

## Ce qui n'est pas dans la refonte

Le moteur, les sauvegardes, les règles du jeu, les cartons de collection (leur dessin), le plateau du mode Sur table (ramené aux jetons, pas redessiné).
