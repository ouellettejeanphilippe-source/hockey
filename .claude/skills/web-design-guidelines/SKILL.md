---
name: web-design-guidelines
description: "Passe une interface du jeu (un gabarit de js/, une partie de style.css, index.html) contre les Web Interface Guidelines de Vercel : l'accessibilité, le focus, les formulaires, le mouvement, la typographie, le contenu qui déborde, le toucher, les zones sûres. À utiliser quand on refait ou qu'on relit un écran, ou quand JP dit « revue UI », « accessibilité », « toutes les tailles d'écran »."
argument-hint: "<fichiers ou motif : js/run-scenes.js, style.css…>"
user-invocable: true
---

# Web Interface Guidelines — la revue d'une interface

Le sujet : `$ARGUMENTS` (vide : demander quels fichiers relire).

JP (25 nov. 2026) : *use the web design one from this* — la skill `web-design-guidelines` de vercel-labs/agent-skills (licence MIT, `.claude/docs/LICENSE-vercel-agent-skills.txt`). Les règles sont figées dans [references/command.md](references/command.md), copiées telles quelles du dépôt (la même empreinte que leur source : SHA-256 `d246b026f4f29b5823a9cc857f9edf3d2507002e055e32040cadeaf3b38e0234`, vercel-labs/web-interface-guidelines au commit `434b7f91`). On ne les relit pas du réseau.

## Comment

1. Lire `references/command.md` avant chaque revue.
2. Lire les fichiers du sujet.
3. Passer chaque règle, puis rendre les constats au format du fichier : groupés par fichier, `fichier:ligne - le constat`, sans préambule.

## Ce qui ne s'applique pas ici, et ce qui cède devant nos règles

Le jeu est un site statique en modules ES natifs, sans React ni routeur : ses écrans sont des gabarits en chaînes (`js/*.js`) et une seule feuille (`style.css`).

- **Sans objet** : l'hydratation, `<Link>`, `nuqs`, `priority`, les entrées contrôlées — il n'y a pas de rendu serveur ni de composants. « L'URL reflète l'état » : le jeu n'a qu'une page, son état vit dans la sauvegarde.
- **Nos règles priment** (`.claude/rules/interface.md`, `vocabulaire.md`) : le français québécois (les guillemets « », pas `“ ”` ; la casse de phrase, pas le Title Case ; « tu »), les sept tailles de police `--t-1` à `--t-7`, l'anneau du focus en mode clavier ou manette seulement, rien de sélectionnable hors des champs.
- **Ce qui s'applique en plein** : un bouton pour une action et un lien pour une adresse ; une étiquette par champ ; `aria-label` sur un bouton en icône ; `aria-live` sur ce qui change tout seul ; `prefers-reduced-motion` ; `transform` et `opacity` seulement ; jamais `transition: all` ; les chiffres tabulaires ; `min-width: 0` sur un enfant flex qui doit tronquer ; les états vides ; `overscroll-behavior: contain` dans une fenêtre ; les zones sûres ; **la grille et le flex plutôt qu'une mesure en JavaScript pour la mise en page** ; une action qui détruit se confirme ; `…` et pas `...`.

Un constat qui contredit une règle ferme du dépôt se note « cède devant : <la règle> » au lieu d'être corrigé.
