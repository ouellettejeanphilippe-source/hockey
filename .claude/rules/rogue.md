---
paths:
  - "js/rogue.js"
  - "js/rogue-jeu.js"
  - "js/packs.js"
  - "js/cartes.js"
  - "js/rarete.js"
  - "js/banque.js"
  - "js/inventaire.js"
  - "js/magasin.js"
  - "js/club.js"
  - "js/depart.js"
  - "js/cartable.js"
  - "js/pouvoirs.js"
  - "js/adjoints.js"
  - "js/coachs.js"
  - "js/coachs-reels.js"
  - "js/dossiers.js"
  - "js/scenes.js"
  - "js/vie-gm.js"
  - "js/arcs.js"
  - "js/verdicts.js"
  - "js/profil-style.js"
  - "js/galons.js"
  - "js/gerant.js"
  - "js/saison.js"
  - "js/entracte.js"
  - "js/pronostic.js"
  - "js/deposer.js"
  - "js/combat.js"
  - "js/sim.js"
  - "scripts/lib/rogue_sim.mjs"
  - "scripts/essai_*.mjs"
  - "scripts/check_rogue.mjs"
  - "scripts/check_pouvoirs.mjs"
  - "scripts/check_packs.mjs"
  - "scripts/check_banque.mjs"
  - "scripts/check_cartes.mjs"
  - "scripts/check_profondeur.mjs"
  - "scripts/check_duel.mjs"
  - "scripts/check_gros.mjs"
  - "scripts/check_effets.mjs"
  - "scripts/check_dossiers.mjs"
  - "scripts/check_mots.mjs"
  - "scripts/check_suivis.mjs"
  - "scripts/check_fils.mjs"
  - "scripts/check_vie.mjs"
  - "scripts/check_arcs.mjs"
  - "scripts/check_galons.mjs"
  - "scripts/check_robot.mjs"
  - "scripts/check_moments_si.mjs"
  - "scripts/check_lancee.mjs"
  - "docs/refonte-v*.md"
  - "docs/ecrans-rogue.md"
---

# Le Rogue

Chaque règle est une ligne ; le script qui la prouve est nommé quand il existe. Le pourquoi de chacune est dans `docs/decisions.md` : avant de défaire une règle, lis sa décision. Les refontes, dans l'ordre : `docs/refonte-v*.md` (la dernière fait foi). Une mesure, un équilibrage, un correctif se jugent d'abord ici (`scripts/lib/rogue_sim.mjs`, `check_rogue`, `essai_rogue`).

## Le jeu : le coach, les cartes, le duel, la run

- Le coach est un personnage (V21, docs/refonte-v21.md ; JP : *coach-personnage à la Hades*) : choisi au départ de la run, il la fait au complet ; son entraîneur a un niveau, comme un joueur, lu de son rang dans la lecture de sa philosophie (V23 : `niveauDuCoach`, `MAITRISE`, js/coachs-reels.js), qui fait la force de ses pouvoirs, de ×0,9 au Soutien à ×1,3 au ★ Phénomène ; il gagne de l'expérience en gagnant (`XP`), monte de niveau (1 à 5), ouvre ses trois pouvoirs aux niveaux 1, 3 et 5 et prend un talent aux niveaux 2 et 4 (js/pouvoirs.js) ; au niveau 2, le talent est le pouvoir I grandi ou une case d'adjoint de plus pour la run, avec une carte pour la remplir (`TALENT_CASE`, `CASE_DE_PLUS` ; nov. 2026, docs/revue-rogue-2026-11.md § 2.4). Un pouvoir se joue PÉRIODE PAR PÉRIODE : il lit ce qui est déjà joué (le pointage, les tirs, le soir) et frappe la période qui vient, sur les canaux qui existent ; la feuille le garde (`feuille.pouvoirs`). Une soirée du Rogue se joue alors en trois plages, comme le duel. Chaque pouvoir joue à peu près un soir sur deux, se voit le soir où il joue, reste sous sa borne seul (I et II : 2,5 V ; l'ultime : 4 V), n'est jamais un piège, et hors de ses périodes ne change rien — `check_pouvoirs`. Sa précision, ses tirs et sa discipline passent par-dessus les plafonds du jeu (le temps d'une période : « +40 % de tirs » se joue entier, oct.) ; ses blessures, la soirée entière. Le bras droit de la V21 est parti (V22) : la synergie d'un adjoint avec son coach se paie en durée de séjour, jamais en force. Le personnage complet (niveau 5, ses talents) reste sous 16 V et peut casser le jeu : c'est la récompense d'une run qui a duré — `check_pouvoirs`.
- **La règle du coach** (V23, docs/refonte-v23.md § D ; JP : *every coach should change how you play*) : chaque philosophie paie 2 ou 3 🪙 le soir où ton club joue son hockey, une ligne lue dans la feuille jouée (`REGLES_DU_COACH`, js/coachs.js ; `primesDuCoach`, js/rogue.js), jamais d'avance et rien au moteur ; seuils pris pour à peu près un soir sur quatre, `PRIME_COACH_MAX` (50) par saison ; elle s'allume au banc du soir — `check_banc`.
- Une réponse de dossier peut ne jouer que dans son moment (`si` : un des `MOMENTS_SI` de js/sim.js — le lieu, les séries, le dos-à-dos, les jambes, le rival ou la bête noire, la forme, l'infirmerie, l'intention annoncée d'un duel ou sa 3e période). Un moment se lit sur ce qui est déjà joué, jamais d'avance, et revient assez pour qu'une carte ne soit pas morte — `check_moments_si`.
- Une carte change la FORME du match, pas sa force : le net en victoires est borné par la rareté (commune ±1, peu commune ±1,5, rare ±2,5, légendaire ±4 : un maximum, jamais une cible), chaque effet se VOIT dans la feuille d'un soir où il joue, commune comprise (JP : *0,4 pt, ça va fuck all faire* ; *recheck tous les effets*) : ±2 tirs, ±0,3 but des deux clubs, ±0,5 punition, ±4 mises en échec, ±3 blessures par saison ou ±3 de jambes ; sur un joueur nommé, ±0,3 point, ±0,15 but ou ±1 tir à sa ligne — `check_effets` (les dossiers et leurs paris, les arcs, les fils), `check_pouvoirs`, et le style ne se paie pas en force : au plus 0,5 V par seuil franchi — `check_cartes`.
- Les gros matchs portent leur plan, leur contre et leur pointage après deux périodes — `check_gros`. En Rogue (V9), ce sont des duels de trois périodes, une intention chacune, et les périodes vues ne bougent pas — `check_gros`, `check_duel`.
- Deux clubs égaux, le duel bien joué (la meilleure proposition de l'adjoint à chaque période) contre « Garder » tout le long : un avantage net, mais sous 60 % en face à face — `check_duel` (semé).
- Au duel, ta réponse est ton plan de la période (V17, docs/refonte-v17.md ; JP : *mon adjoint propose des ajustements à chaque période, j'en choisis un*) : leur intention est LEUR plan, sans contre ni porte ; avant chaque période, ton adjoint (une voix d'`EXPEDITEURS`) propose deux ou trois plans de `PLANS`, chacun en vraies stats de la période (`propositionsDuDuel`, js/impact.js), et « Garder » ; leur plan et le tien y jouent à `FORCE_DUEL` — `check_duel`.
- Le gros match se règle le jour où il se joue, en un seul arrêt (JP : *juste le jour du gros match, pas avant*) : la route le montre la veille (`ANNONCE_GROS`), son écran n'arrête l'avance que son matin ; commencé, il se vit en direct jusqu'au bout, sans ✕ ni détour par le Bureau (JP : *on vit le match, rien d'autre*) — `essai_rogue`.
- Le robot « premier Signer » ne gagne pas la Coupe — `check_robot`.
- Une carte seule reste sous la borne de sa rareté et la première run reste dure ; une run qui a duré, ou un build qui s'emboîte, a le droit de casser le jeu — c'est la récompense du Rogue (docs/refonte-v3.md, principe 5). La deuxième run est plus dure que la première (JP, 31 oct. 2026 : *plus tough la deuxième run*) : dès la deuxième, et dès la deuxième saison de la première (lot 5, nov. 2026), chaque club adverse porte une étape d'édition de plus, fixée au départ de la saison (`ETAPE_APRES_LA_PREMIERE`, `etapeDeLaRun`, js/rogue.js) — une marche, pas une pente — `check_rogue`, `check_profondeur` (la première Coupe de l'attentif à la run 3 ou plus tard). La première saison de la première run, le proprio laisse bâtir : finir dans les 24 premiers, séries ou pas (`MANDAT_DE_LA_PREMIERE`, js/rogue.js ; nov. 2026, docs/revue-rogue-2026-11.md § 1 ; 27 essayé au lot 5 : la Coupe dès la run 1) ; dès la deuxième saison et dès la deuxième run, les mandats de toujours — `check_rogue`, `check_clarte`.
- Après sa première Coupe, le gérant attentif la regagne sans la gagner d'office : il monte les exigences (V9, tranche 8) — `check_profondeur`.

## L'économie (Rogue et boutique)

- Revendre un pack de cartes rapporte au plus 40 % de son prix — `check_packs`.
- Le choix de pack compte (nov. 2026, docs/revue-rogue-2026-11.md § 2.6) : le Bronze, le moins cher, tire trois joueurs au hasard ; l'Époque, un seul, Pilier ou mieux, de la décennie et du poste de ton choix (`niveaux`, `poste`, `POSTES_DU_PACK`, js/packs.js ; lot 5) : le large contre le fort — `check_packs`, `ROBOT_PACK=bronze` et l'ablation `ROBOT_SAUF=boutique` de scripts/lib/rogue_sim.mjs.
- L'achat s'enregistre avant le butin ; la prime de série est versée — `check_rogue`.
- Le ballottage offre un dépanneur (niveau Régulier au plus), pas une vedette — `check_ballottage`.
- Une carte ne se prend qu'une fois, et un palier n'arrête l'avance qu'une fois.
- Aucun joueur ne te suit au choix (JP : *garder des joueurs de run en run devrait être fait dans une loto, pas genre tu peux prendre qui tu veux*) : le classeur, les lotos du cartable et ceux qui restent sont des lotos par niveau (`lotoDeCase`) — `check_rogue`.
- Le personnage du coach est une décision `coach` au jour 0 de chaque saison, qui porte son expérience d'avant, ses talents et sa main d'adjoints (leurs fiches, sans séjour en cours) ; `talent`, `xpCoach`, `embauche` (une carte entre dans la main) et `poste` (une carte posée pour son séjour) s'y ajoutent au jour dit ; l'expérience de la saison et la fin des séjours, le moteur les compte (`xpSaison`, `finirSejours`) ; une vieille décision `adjoint`, `staff` ou `perdAdjoint` (V21) ne joue rien — `check_pouvoirs`, `check_verite`.
- L'adversaire ne pige pas les cartes de match de la v2 (`horsAdverse`) : sa main est calibrée, la difficulté ne bouge pas — `check_gros`, `check_robot`. Au duel, il n'a pas de main : ses intentions, son plan de chaque période, en tiennent lieu.
- Les adjoints ne s'achètent pas (V21 ; JP : *1 parmi 3 gratuit aux moments forts*) : aux 10e, 30e, 50e et 70e matchs (`PALIERS_PACK`, js/inventaire.js : un moment fixe tous les dix matchs avec les mains du deck des 20e, 40e et 60e ; nov. 2026, docs/revue-rogue-2026-11.md § 2.1), après un gros match gagné, au verdict du proprio et dans une histoire, un adjoint parmi trois, gratuit, entre dans ta main (`adjointsOfferts`, pur, tiré de la graine). **Une carte, un style, un séjour** (V22, docs/refonte-v22.md ; JP : *coach plus adjoints dans une main, qui sont là x matchs et changent le style de l'équipe* ; *simple, impactant, le fun, marquant*) : un adjoint est une carte de hockey dont le verso dit son style en deux lignes — ce qu'il donne, ce qu'il coûte, en vraies stats —, sa réplique sans chiffre (`dit`) et sa fiche chez toi. Postée (Bureau › Coach, glissée sur une case libre ou « Poster » ; une décision `poste`, le jour même), elle joue `SEJOUR` matchs (12 ; `SEJOUR_SYNERGIE`, 16, si son style rejoint la philosophie du coach, `voie` : la synergie se paie en durée, jamais en force), puis revient dans la main avec sa fiche et se repose `REPOS` matchs (20, plus que le séjour : sans repos, la rejouer de suite en referait un échange permanent). Court, un style frappe fort chaque soir (±3 tirs, ±0,4 but). **Son niveau** (V23, docs/refonte-v23.md § C ; JP : *les coachs et adjoints doivent être comme les joueurs, de pas très bon à excellents*) : Soutien, Régulier, Pilier, ★ Étoile, ★ Phénomène, tiré de la graine à l'offre (`niveauOffert`, un cran de plus à un moment fort, `momentFort`) ; il règle la force de ce qu'il donne (`FORCE_NIV`, ×0,7 à ×1,3) et le prix de ce qu'il coûte (`PRIX_NIV`, ×1,05 à ×0,8), jamais ses canaux ; le Pilier est la table telle quelle, et une carte sans niveau en est un (`NIV_DEFAUT`). Ramené à ce qu'une carte joue sur une saison (un match sur deux au plus), il reste sous la borne de son niveau comme une carte sous sa rareté (`BORNE_NIV` : ±1 V au Soutien et au Régulier, ±1,5 au Pilier, ±2,5 à l'Étoile, ±4 au Phénomène), et le Phénomène rend plus que le Soutien du même style — `check_pouvoirs`. Deux canaux par style au plus, un adjoint par philosophie (`ADJOINTS`, huit) ; hors des voies, un adjoint qui ne rejoint personne se paie un salaire (V23 : 🦓 l'ancien arbitre, JP : *a ref, and pay them*). **Le salaire** (V23, `SALAIRE_NIV`, `salaireDe`) : en poste, un adjoint coûte des jetons chaque match, rien au Soutien et au Régulier, de 1 à 3 🪙 du Pilier au ★ Phénomène, plus le sien ; une carte sans niveau ne paie que le sien ; la feuille le garde et la caisse le déduit (`salairesDesAdjoints`, js/rogue.js) — `check_banc`. La main tient `MAIN_MAX` cartes (4), en poste comprises ; pleine, l'offre dit laquelle part (la plus ancienne hors poste, `quiPartDeLaMain`) et tu peux passer. Les cases en poste suivent le niveau du coach (`CASES_PAR_NIVEAU` : une au niveau 1, deux au 3, trois au 5), une de plus dès le niveau 2 si le premier talent l'a prise (`casesDuPerso`). Hier soir dit la fin d'un séjour avec sa fiche (« 12 matchs, 8-3-1 »), « Ce qui court » ce qui reste. Le staff de la V21 est parti (ses douze échanges, la main de six, les trois en poste, le bras droit, les légers et les lourds), le personnel de la V10 à la V20 avant lui. À l'écran, jamais « système ». La banque garde une petite famille de cartes rares qui montent (les retouches d'édition, le stage du coach, les soins, l'échange d'un doublon), une fois sur quatre dans un pack de joueurs (`RARE_DU_PACK`), jamais le gros d'un pack — `check_pouvoirs`, `check_packs`, `check_banque`.

## Les textes et les choix

- Ce qu'un texte affirme d'un match (un rythme, une disette, trois punitions en deux matchs) est arrivé dans les feuilles déjà jouées, et il dit les vrais chiffres — `check_fils`, `check_vie`.
- Un choix qui promet pour plus tard (l'objectif du proprio, le fil suivi) se suit : son état, en vrais chiffres, se lit chaque matin à sa maison, Hier soir dit son pas, et son verdict arrive comme un message ; un joueur parti fait tomber sa promesse, et ça se dit — `check_suivis`.
- **V22 (31 oct. 2026 ; JP : *supprimer la banque d'événements, pas le système*)** : les dix-neuf dossiers, les quatre choix de fil, les dilemmes, les séquences, les courriels, la presse et les vingt arcs sont partis, sans être repris ; le système (le tirage du lundi, la boîte, les scènes, les voix, `appliquerGestes`, les paris, les suivis) reste ; la banque neuve commence à six histoires (docs/refonte-v22.md, phase 4), deux réponses chacune, chaque réponse une chose concrète (des jetons, de l'expérience, une carte d'adjoint, une suspension, l'auxiliaire, des jambes) ou un dé sur le joueur nommé. Une histoire (V20, docs/refonte-v20.md § 4) est la seule source du lundi : un dossier, un lundi sur deux environ, tiré de la graine (`semaineAHistoire`, js/dossiers.js) ; elle ne sort que si son fait est vrai, lu sur ce qui est déjà joué, et nomme ses joueurs ; sortie, elle se repose `REPOS_HISTOIRE` semaines (5) puis peut revenir dans la saison, sur un autre joueur, `SORTIES_MAX` fois au plus (2) (nov. 2026, docs/revue-rogue-2026-11.md § 2.1 : une fois par saison, la banque était vide vers la mi-saison) ; trois histoires de deuxième moitié, après 41 matchs (la course perdue, la première place, le dos-à-dos sur la route), portent la banque à neuf ; **les suites et les rares** (V23, docs/refonte-v23.md § E) : une réponse peut planter un épisode 2 (`suite`, en matchs), qui ne s'ouvre que si ce que son joueur a fait depuis se lit dans ses feuilles (`faitsDesSuites` : le petit arrivé à 4 points en 8 matchs, ou dans le doute) et passe avant le tirage ; une histoire `rare` ne sort qu'à certains lundis (`CHANCE_RARE`), une fois par saison ; la banque compte quatorze histoires ; chaque mot de stat dit un canal que l'effet bouge, dans son sens. Son option audacieuse est un dé (`pari`) dont l'issue frappe le joueur nommé seul (`lui`), et sa scène dit les deux issues. Les routes de la semaine, les dilemmes, les séquences, les courriels et la presse ne s'offrent plus ; leurs tables restent, pour qu'une vieille partie se rejoue pareil — `check_dossiers`, `check_mots`, `check_effets`.
- Un choix du Rogue dit qui le demande (une voix d'`EXPEDITEURS`), pourquoi maintenant (le fait, en vrais chiffres) et ce qu'elle en pense (une réplique sans chiffre) : une scène de `js/scenes.js` — `check_clarte` § 5, `essai_rogue`.
- Les mots d'une réponse disent ses lignes (JP : *le texte fitte pas avec les stats des choix*) : son `bon` nomme les lignes vertes que le moteur montre pour un vrai club (tirs, tirs contre, précision, arrêts, punitions, jambes, blessures), son `prix` les rouges, rien n'est promis sans ligne, et une carte de route se voit ; l'étiquette (Cadeau, Échange, Moindre mal) suit les lignes affichées ; une ligne sous le bruit (un tir, un demi-point, un tiers de punition) ne se dit pas — `check_mots`.
