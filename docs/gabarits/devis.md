# Gabarit — le devis d'une refonte, d'un écran ou d'un système

Copier ce fichier, remplir chaque partie, puis le faire juger par `/revue-design <chemin>` avant de coder. Une partie qui ne s'applique pas dit pourquoi en une ligne ; elle ne disparaît pas. Adapté du gabarit de GDD de Claude-Code-Game-Studios (Donchitos, licence MIT), ramené aux règles de ce dépôt.

## 1. Ce que JP a dit

Ses mots, en italique, avec la date (JP, 2 nov. 2026 : *…*). Ce qu'il reproche, ce qu'il cite en exemple.

## 2. Ce que le joueur ressent

Le fantasme en une phrase (« je bâtis un club autour de mon coach », « j'ouvre un pack et mon cœur arrête »). Le pic visé et le jour ordinaire : qu'est-ce qui doit être spectaculaire, qu'est-ce qui doit rester rapide. La boucle nourrie : le soir, la semaine, la saison, la run, la carrière.

## 3. Les règles du jeu

Ce qui arrive, quand, à qui, dans quel ordre ; ce que le joueur voit et touche, écran par écran (parcours toucher par toucher). Assez précis pour qu'un autre le code sans deviner.

## 4. Les chiffres

Chaque formule : son nom, son expression, ses variables (symbole, plage, sens), son résultat et ses bornes, un exemple fait à la main. Les effets en vraies stats de match (tirs, précision, tirs contre, % d'arrêts), jamais en victoires à l'écran.

## 5. Les cas limites

La main pleine, le joueur parti ou blessé, l'histoire sans porteur, les séries, la fin de saison, la vieille partie (`check_sauvegardes`), le jeu hors ligne (`sw.js`), le clavier et la manette.

## 6. Ce qu'il touche

Les fichiers ; les règles fermes de `.claude/rules/` (nommées : respectée ou défaite, avec la décision de `docs/decisions.md`) ; les clés de sauvegarde, qui ne bougent jamais ; ce qui part.

## 7. Les réglages

Les constantes, leur valeur, leur plage sûre, ce qui casse au-delà.

## 8. Les critères d'acceptation

Chacun vérifiable, avec le script qui le prouve, existant ou à écrire (nommé) :

- [ ] … — `check_…`
- [ ] … — `essai_rogue` (…)
- [ ] À juger par JP à l'essai : … (seulement ce qui ne se mesure pas)

## Les tranches

Une petite PR chacune, dans l'ordre ; chaque tranche nomme son juge.
