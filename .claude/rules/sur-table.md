---
paths:
  - "js/table.js"
  - "js/plateau.js"
  - "js/tournoi.js"
  - "js/modes-table.js"
  - "js/charge-table.js"
  - "scripts/smoke_table.mjs"
  - "scripts/check_table.mjs"
  - "scripts/check_regles.mjs"
---

# Sur table

Chaque règle est une ligne ; le script qui la prouve est nommé quand il existe. Le pourquoi de chacune est dans `docs/decisions.md` : avant de défaire une règle, lis sa décision.

- Les règles du plateau sont ÉCRITES DANS LE CODE (`reglesDuPlateau()`) et affichées de là ; le moteur ne les viole jamais — `check_regles`.
- La rondelle ne se téléporte pas : chaque déplacement est une étape bornée — `check_regles`.
- Les nombres d'une pièce viennent des cotes sur 20 de la fiche (`axes20`, js/niveaux.js : le rang du joueur dans sa saison), sur un dé par une seule table (`surDe`), et son souffle de l'usure que le moteur lit ; aucune conversion à part, aucune cote neuve (V25 A2) ; le dé est celui de js/util.js, et une punition se siffle au rythme de l'époque du fautif (`facteurPunitionsEpoque`, les chiffres du moteur) — `check_table`, `check_couches`.
