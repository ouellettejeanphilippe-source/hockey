---
name: hors-moyenne
description: "Arrête le choix moyen, celui qui vient en premier, quand un choix de création est laissé à l'agent : une histoire de la carte, une réplique, un titre, le nom d'une pièce de banc, d'un coach ou d'un mode, une idée de mécanique, les options d'une question à JP, une maquette. Aussi quand JP dit « générique », « plate », « déjà vu », « ça sonne IA », « trop safe », « cliché ». Pas pour un nom de fonction, un correctif, ni un choix que JP a déjà fait."
argument-hint: "[ce qu'on écrit ou invente : une histoire | une réplique | un nom | une idée | une maquette]"
user-invocable: true
---

# Hors moyenne — pas la première idée venue

Le sujet : `$ARGUMENTS` (vide : le choix de création qu'on s'apprête à faire).

La première réponse qui vient est la moyenne de tout ce qui s'est déjà fait. Elle sonne juste parce qu'on la connaît, et JP l'a déjà lue mille fois. Cette commande fait nommer cette réponse-là, puis s'en éloigner pour une raison prise dans Cap 82-0.

Adapté de la commande `antialgorithm` (mankidev, licence MIT : https://github.com/mankidev/antialgorithm ; `.claude/docs/LICENSE-antialgorithm.txt`), ramené à ce dépôt : en français québécois, sans ses scripts (la graine tirée au hasard, le SVG rendu rugueux et son juge), parce qu'ici le point de départ ne manque jamais.

## 1. D'où partir

Jamais de ce qui serait « le plus intéressant » : cette pensée-là atterrit au même endroit pour tout le monde. Ici, le point de départ est toujours dans le dépôt :

- **Une histoire, une réplique** : le fait arrivé dans les matchs joués de la run (`faitsDeLaRun`, js/run.js), le joueur qui le porte, son vrai chiffre, la voix qui parle (`EXPEDITEURS`, js/vie-gm.js) et ce qu'elle a toujours en tête (le proprio l'argent, le capitaine le vestiaire, le physio les jambes).
- **Un nom** (une pièce de banc, un coach, une case, un mode) : les mots de `.claude/rules/vocabulaire.md` et la façon dont on parle de hockey au Québec, à l'aréna, à la radio, à la taverne. Pas la traduction du mot anglais, pas le mot du jeu vidéo.
- **Une idée de jeu** : ce que JP a dit, dans ses mots (`docs/decisions.md`, le devis ouvert dans `LIVRAISON.md`), et ce que le moteur sait jouer (les canaux de js/effets.js, les moments de js/sim.js). Une idée que la run ne sait pas jouer n'est pas une idée, c'est un souhait.
- **Une maquette** : le sujet lui-même, son époque, son club, sa matière (le carton d'une carte de 1972, le tableau d'un vieil aréna), sous les règles de `.claude/rules/interface.md`.

S'il manque le fait dont tout dépend, on pose à JP une seule question courte, sur ce fait (pour qui, où ça vit), pas une permission de recommencer.

## 2. La règle

Avant de répondre, trouve la réponse évidente et dis-la en une ligne dans ton raisonnement : « ici, la réponse moyenne, c'est X. » Puis ne prends pas X, sauf si le projet le demande vraiment.

- Un bon choix ne pourrait vivre qu'ici. Un choix moyen irait dans n'importe quel jeu de hockey, ou dans n'importe quel roguelike.
- Ne remplace pas un cliché par son contraire connu (« sombre au lieu de clair », « dépouillé au lieu de chargé ») : c'est la deuxième réponse la plus commune.
- Le bizarre n'est pas le but. Un choix étrange sans raison est aussi vide qu'un choix sûr. Chaque choix a une raison qui se dit en une phrase, et cette raison vient du projet, pas du bon goût en général.

## 3. Les textes du jeu

Une phrase qu'on pourrait coller dans un autre jeu sans y toucher se réécrit jusqu'à ce qu'on ne le puisse plus. Le détail concret plutôt que l'affirmation générale, le mot simple plutôt que le mot qui impressionne, l'angle vrai qu'on n'attendait pas plutôt que le résumé attendu.

Les marques du texte moyen, à ne pas écrire :

- La réplique que n'importe quelle voix pourrait dire à n'importe quel joueur (« Il faut se regrouper », « Les gars sont fatigués »).
- Le sentiment nommé (« le vestiaire est tendu ») là où un détail le montrerait (qui ne parle plus à qui, depuis quel match).
- Les choses qui viennent par trois par habitude : trois adjectifs, trois exemples.
- Les paires en miroir et les slogans en deux moitiés qui se répondent.
- La dernière ligne qui résume, remonte le moral ou fait une boucle. Une réplique s'arrête, c'est tout.
- Le point d'exclamation qui encourage, la question qui ne sert qu'à faire monter l'attente.
- La formule qui va à tout club et à tout joueur, la grosse affirmation sans rien derrière.
- Des phrases longues et égales, du même rythme d'un bout à l'autre.
- Le jargon de jeu vidéo (« buff », « build », « système ») dans la bouche d'une voix.

Écris ce qu'une vraie personne de hockey dirait dans cette situation : plus court, bâti sur le fait de ce soir-là.

Nos règles tiennent par-dessus (`.claude/rules/rogue.md`, « Les histoires, les textes et les choix ») :

- **Le chiffre est le vrai chiffre du fait**, lu dans les feuilles déjà jouées. L'original se méfie du chiffre posé pour faire concret ; ici un chiffre inventé est une faute, et le vrai est obligatoire.
- **On n'invente aucun fait.** Ce qu'un texte affirme d'un match est arrivé. Le détail vient de la run, du joueur, de sa saison (data/), ou il ne s'écrit pas.
- Les lignes d'une carte se dérivent de l'effet (`motsDe`) ; seule la réplique s'écrit à la main, et c'est elle que cette commande juge.

## 4. Les idées, les noms, les options

- Pas la première idée du genre (ce que Slay the Spire fait déjà, tel quel), pas la mécanique la plus connue, pas le nom fait des deux mots les plus évidents. Tiens pour acquis que JP y a déjà pensé.
- Des options **de nature différente** (le sûr contre le dé, les jetons contre le joueur, ce soir contre plus tard), jamais trois variantes de la même idée sûre. L'option sûre a le droit d'être là si on la nomme comme telle ; elle n'est jamais le seul vrai choix.
- **Une recommandation, avec sa raison.** Pas une longue liste neutre. C'est la question à JP de CLAUDE.md (« Une décision de design se demande ») : deux à quatre options courtes, celle qu'on recommande en premier, chacune avec ce qu'elle coûte.

## 5. Le visuel

- **L'interface garde sa grille** : les boutons, le HUD, les cartes de jeu et le pouce à 390 px restent alignés et lisibles (`.claude/rules/interface.md`). Cette commande y choisit la palette, la forme et les mots, jamais un tremblé.
- **Les sprites de Sur glace** appartiennent à `glace-graphiste` et à `.claude/rules/sur-glace.md` : ici on ne choisit que le sujet et la composition.
- Pour une pièce faite pour être regardée (une carte de collection, une affiche, un écran de fin) : pas le fini que l'outil donne sans consigne (dégradé lisse, lueur douce, tout centré, tout au même poli). Une décision forte mène, prise dans le sujet, et le reste la sert. Ce qui n'a pas de travail part.
- **Un défaut change l'allure, jamais l'usage** : ce qu'on doit lire, toucher ou reconnaître reste entier, net et à sa place.

## 6. L'échappée devient une habitude

Une sortie qui a marché une fois devient le nouveau choix sûr. Surveille, dans ce dépôt :

- Le même tour d'une histoire à l'autre : toujours le vétéran qui cogne à la porte, toujours le proprio qui compte ses sous, toujours la chute en une phrase sèche.
- Des noms tous tirés du même fond (toujours la taverne, toujours les années 70, toujours le sacre adouci).
- Le « québécois de carte postale » : la poutine, le char, la tuque posés là pour faire couleur locale. Le parler vient de la voix et de la situation, pas d'une liste d'objets.
- Le cadre emprunté à un autre monde (un formulaire, une cédule, un bulletin) plaqué sur le sujet parce qu'il a fait sourire la dernière fois.

Si la réponse partage son tour principal avec la dernière réponse hors moyenne qu'on a donnée, c'est devenu une moyenne : change de tour, ou garde-le en disant pourquoi ce cas-ci le demande.

## 7. Avant de montrer

Trois questions :

1. Ça pourrait être la réponse pour un autre jeu, un autre club, un autre joueur ? Alors c'est trop général.
2. C'est ce que la plupart feraient en premier ? Alors on le déplace.
3. Je peux dire pourquoi ce choix va ici, en une phrase, avec un fait du projet ? Sinon le choix n'a pas de raison.

Puis ce qui ne se discute pas :

- Français québécois, les mots du vocabulaire.
- La longueur et le format demandés : quatre phrases demandées, quatre phrases. Pas de notes, d'options ni de parties en plus.
- Les juges du terrain restent les juges : `check_histoires`, `check_mots`, `check_effets` pour une histoire, `check_pouvoirs` pour une pièce. Cette commande ne remplace aucun check ; elle travaille avant.
- **Si JP demande la version simple, standard, attendue, on la donne.** Cette commande sert aux choix qu'il nous laisse, jamais à passer par-dessus ce qu'il a demandé.
