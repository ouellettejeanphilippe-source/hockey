---
paths:
  - "js/physique.js"
  - "js/glace-ia.js"
  - "js/sur-glace.js"
  - "js/sprites.js"
  - "js/sons-glace.js"
  - "js/sons.js"
  - "scripts/sprites/**"
  - "scripts/check_physique.mjs"
  - "docs/sur-glace.md"
---

# Sur glace

Chaque règle est une ligne ; le script qui la prouve est nommé quand il existe. Le pourquoi de chacune est dans `docs/decisions.md` : avant de défaire une règle, lis sa décision. L'inventaire de toutes les fonctions d'un jeu de hockey 2D, faites ou à faire, et l'ordre de travail : `docs/sur-glace.md`. Les sprites : `scripts/sprites/GUIDE.md` ; `js/sprites.js` est écrit par `node scripts/sprites/rendu.mjs`, jamais à la main.

- Sur glace (js/physique.js) : chaque chiffre qu'une phrase de l'écran affirme (une vitesse, un rayon, un rebond, un retard) est une constante du moteur et se rejoue en Node sur un pas fixe ; la même graine et les mêmes entrées rendent la même empreinte, IA comprise ; une règle (le hors-jeu, le dégagement, la punition, l'avantage) se siffle sur un fait mis en scène dans le check ; l'IA (js/glace-ia.js) pousse le même bâton que toi, jamais un raccourci du moteur ; un vrai joueur n'apporte que ses cotes sur 20 et son poids de la LNH, aucune cote neuve — `check_physique`. Le moteur de la saison (js/sim.js) reste le moteur des matchs du jeu.
