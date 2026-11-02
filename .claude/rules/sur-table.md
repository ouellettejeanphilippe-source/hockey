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
