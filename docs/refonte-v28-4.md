# V28, tranche 4 : le remplacement

L'extrait du devis `docs/refonte-v28.md` pour sa tranche 4, livrée le 11 nov. 2026. JP, 9 nov. : l'ancien Rogue *gelé puis supprimé*, *les runs en cours perdues, les médailles et le cartable gardés* ; 10 nov. : *fais tout je suis tanné des maquettes*.

## Ce que le joueur voit

« Le Rogue neuf » est le Rogue. Sa carte du menu dit « Commencer », ou « Continuer » quand une run est gardée, et ouvre la run en carte. L'ancien Rogue n'existe plus : ni Bureau, ni boîte, ni jour à jour, ni boutique à ses nœuds, ni calendrier placé.

Une run de l'ancien Rogue restée en cours s'arrête au démarrage : elle quitte la liste des parties, ses médailles gagnées et pas encore payées sont versées une fois, et un mot le dit. Le cartable, les médailles et le 82-0 ne bougent pas.

Dans la run, le banc joue pour vrai (voir « Le banc remesuré ») : la carte dit le jeu de chaque club et ses dos-à-dos, le tiroir dit combien de tes pièces joueront sur chaque case.

## Ce qui est parti

Les 56 noms du § 8 du devis, d'un coup. En lignes, depuis le début de la V28 (`BASE=871c6d4`) : le jeu retire 12 000 lignes pour 2 400 ajoutées, style.css passe de 7 498 à 5 903 lignes.

- **Neuf fichiers du jeu** : `js/rogue-jeu.js` (1 755 lignes), `js/ballottage.js`, `js/magasin.js`, `js/inventaire.js`, `js/depart.js`, `js/galons.js`, `js/composants.js`, `js/scenes.js`, `js/banc-du-soir.js`.
- **`ouvrirSaison`** et tout le Bureau (js/saison.js, −3 600 lignes : il reste `saisonDesFeuilles` et `ouvrirSeries`, pour le 82-0) : la boîte, le journal, Hier soir, le Proprio, l'avance jour par jour, le résumé de la semaine, les étapes de fin d'acte.
- **La run sur la cédule** (js/actes.js, js/rogue.js, js/game.js) : `poserLesRivaux`, le crochet des actes, le calendrier placé et le renfort, les nœuds de la boutique, l'élite du lundi, les objectifs du proprio, le rythme du lundi des histoires, le classeur du départ, le barème, le mandat.
- **Dans le moteur** (js/sim.js, sans changer un tirage : `check_empreinte`, `check_graine`) : `lanceesDuSoir`, `rendreEtat`, `rembobiner`, les objectifs du proprio ; puis ce qui restait inerte, le crochet `placer` de `creerLigue`, `jouerLaCedule`, et l'instantané du matin d'un duel (`instantanes`, `retenirEtat`, `retenirLaLigue`). Une vieille décision `cedule` ou `elite` ne joue rien.
- **Les écrans de choix de l'ancien Rogue** (js/gerant.js) : `ouvrirChoix` ne garde que ses trois appels (« Comment on joue », ton identité au 82-0, « Quitter le match ? ») ; le paquet, la pile, le walkout, la scène du dé, la scène d'une voix et le bouton « Les chiffres » sont partis ; `pochetteHtml` ne rend plus que la pochette scellée.
- **La page** : les modales du magasin, de l'inventaire, du départ et de la signature, les pages Cartable et Marché, le bouton AN · DN ; la section du plateau de style.css et les classes que plus rien ne pose.
- **Dix-neuf scripts** : `check_banc`, `check_calendrier`, `check_composants`, `check_galons`, `check_instantane`, `check_plateau`, `check_profondeur`, `check_rogue`, `essai_achat`, `essai_depart`, `essai_packs`, `essai_rogue`, `mesure_rogue`, `mesure_rythme`, et dans `scripts/lib/` : `bords`, `cartes_robot`, `paquet`, `rogue_actes`, `rogue_sim`. Le workflow `profondeur.yml` part avec eux.
- **Une règle du jeu** : « les lignes au 12e rang ou mieux » (`lignesFortes`), remplacée par le style d'un club (plus bas).

## Ce qui a déménagé

| Fonction | D'où | Vers | Pourquoi |
|---|---|---|---|
| `blessesAuJour` | js/rogue-jeu.js | js/game.js | Joueurs et le plafond du 82-0 la lisent |
| `SEMAINE` | js/inventaire.js | js/util.js | js/histoires.js et js/faits.js la lisent |
| `SAISONS`, `shard`, `generateur` | scripts/lib/rogue_sim.mjs | scripts/lib/shards.mjs | les robots de la run en ont besoin |
| `groupeDe` | js/ballottage.js | — | c'était `groupeDuJoueur` de js/niveaux.js : la run l'importe sous ce nom |

Un renommage : le `regarderProchain` des séries du 82-0 devient `regarderLeMatch` (le devis nomme l'autre dans « Ce qui part »). Ouvrir une pochette vit dans la coquille de la run (`ouvrirLaPochette`, js/run-jeu.js) depuis la tranche 2. **La page des déblocages, l'album, ton club et le palmarès n'ont pas déménagé** : ils vivaient dans le Bureau, et se réécrivent avec la méta (tranche 5). D'ici là, les médailles s'accumulent et ne se dépensent nulle part.

## Les vieilles parties

`solderLAncienRogue` (js/rogue.js), au démarrage et à l'import d'un vieux fichier : chaque partie du genre `rogue` quitte l'index, sa clé s'efface, et elle verse une fois ce qui était gagné sans être payé — la moitié de ses points pour un méta d'avant la V27 ; ses rondes de séries pour une run en actes (20 par ronde, 40 la Coupe, au multiple de son cran d'exigence), sous la même clé que l'ancien jeu, pour que rien ne se paie deux fois. `check_sauvegardes` le prouve sur 32 vérifications : trois vieilles runs (en séries, finie sur la Coupe, en saison), une partie du 82-0 voisine identique à l'octet, un second démarrage qui ne verse rien, les six clés de sauvegarde lues dans les sources.

Ce que le devis (§ 6) demandait de plus : un **écran** qui dit ce qui est versé, dont le prix des déblocages qui partent. Aujourd'hui c'est un mot à l'écran (six secondes) ; l'écran vient à la tranche 5, où les déblocages se réécrivent et où leur remboursement se calcule.

## Le banc remesuré

Le critère du § 10 : *chaque pièce se voit le soir où elle joue et n'est jamais un piège sur un acte de six matchs ; le banc complet sous sa borne recalculée*.

**Ce que la mesure a trouvé d'abord.** La run joue des matchs isolés : le moteur n'y lisait plus aucun des moments qu'il tirait de la cédule. Sur huit runs du robot, neuf moments n'arrivaient jamais (le dos-à-dos, le rival, des tireurs, des durs, un gros gardien, la bête noire, après une défaite, après trois victoires, l'infirmerie). Six pièces ne jouaient donc jamais (le mur, le rouleur, le moine, et les trois « pour le battre » que l'annonce du rival recommandait), et celles de la fatigue presque jamais. Et deux rouges dataient d'avant la V28 (la mesure complète n'est pas en CI) : quatre pièces se voyaient trop peu, la riposte jouait 60 % des soirs.

**Le soir se dit au moteur** (`poserLeSoir`, js/run.js). La run pose sur les deux clubs, le temps du match, ce que la cédule disait :

- le rival de l'acte ; ta suite (après une défaite, après trois victoires) ; ta bête noire (un club qui t'a battu deux fois sans que tu le battes : une série qui tourne mal) ; l'infirmerie (le registre des blessures suit tes blessés, soignés ou partis) ;
- **le jeu de l'adversaire est son style, un seul** : sa ligne au meilleur rang parmi les clubs de sa saison, sans toi — le mot déjà écrit sous sa case. « Contre des tireurs » joue où la case dit « Tireurs ». Essayé d'abord : « ses lignes au 12e rang ou mieux » (la règle de la V27). Contre des clubs du haut, un gros gardien était vrai 71 % des soirs et des tireurs 54 % ; et une case pouvait dire « Tireurs » sans que la pièce joue. Défait ;
- **trois matchs en trois soirs** : les deuxième et troisième rangs de chaque acte se jouent sans jour de repos, ce sont ses dos-à-dos (`RANGS_DE_DOS_A_DOS`) ; en séries, un jour de repos tous les deux matchs. Essayé d'abord : un seul dos-à-dos par acte (le troisième rang) — les pièces de la fatigue jouaient 14 % des soirs ;
- **leur coach en séries** (V23 F) : la run le pose le temps du match, la feuille du soir le nomme.

**Les pièces réglées** (js/pieces.js) :

| Pièce | Avant | Maintenant | Pourquoi |
|---|---|---|---|
| 🦅 La riposte | à deux buts près, finition ×1,28 | à un but près, ×1,34 | 56 % des soirs, et sous le seuil de ce qui se voit |
| 🐢 Le verrou | défense ×0,85 | ×0,78 | 0,23 but par soir : sous le seuil (0,3) |
| ⛏ La tranchée | leurs tirs ×0,75 | ×0,70 | 1,7 tir de moins : sous le seuil (2) |
| 💥 Le choc | robustesse 2,8 | 3,1 | 3,8 mises en échec : sous le seuil (4) |
| 🫁 Le second souffle, 🛠 l'atelier, 🏃 le préparateur | un soir de dos-à-dos ou de jambes lourdes | … ou contre le rival | la famille du Souffle joue aussi le match qui compte double |

**Le verdict** (`FILS=3 node scripts/check_pouvoirs.mjs`, 600 matchs par club et par pièce, la présence sur seize runs du robot malin) : 27 vérifications vertes.

- Chaque pièce se lit 30 à 50 % des soirs (la plus rare, le tueur, 30 % ; les plus présentes, 43 %). Une pièce « pour le battre » répond à un style que la carte montre et que le chemin choisit : sa borne basse est un soir par acte (le patineur, contre des durs : 18 %).
- Chaque pièce se voit dans la feuille d'un soir où elle joue.
- Aucune n'est un piège (la pire, le préparateur : −0,03 V sur un acte, pour −0,11 permis) ; aucune ne rend plus que le net d'un pouvoir d'avant sur six matchs (+0,18 V : l'atelier et le tir parfait y sont).
- Le banc complet d'un coach rend +0,2 à +0,9 V sur un acte (borne : +1,11).

Les bornes sont celles de la V27, ramenées de 27 soirs à 6 au même rythme ; aucune n'est plus lâche par match. La bande de présence (30 à 50 %) n'a pas bougé.

**L'écran le dit.** La carte marque le troisième rang « Dos-à-dos » ; le tiroir et la feuille du soir disent le lieu, le dos-à-dos, et combien de tes pièces de la soirée joueront sur chaque case (`piecesDuSoir`) ; la feuille d'une série nomme leur coach.

## Ce que la mesure de la run dit maintenant

`GRAINES=64 FILS=3 node scripts/mesure_run.mjs`, les mêmes graines qu'avant, le banc qui joue et la fatigue :

| 64 graines | Malin | Chiffre | Premier |
|---|---|---|---|
| Coupes | 8 | 8 | 0 |
| Cibles tenues | 64 % | 59 % | 31 % |
| Acte I · II · III | 67 · 55 · 72 % | 53 · 59 · 68 % | 44 · 27 · 17 % |
| Runs finies sans cœur | 11 | 17 | 28 |
| Rondes de séries gagnées par run | 0,70 | 0,69 | 0,03 |

- **La difficulté tient** : le malin 8 Coupes (la cible : 4 à 12), « premier » aucune, la première Coupe à la sixième run en médiane.
- **Lire paie en cibles, pas en Coupes.** Le malin tient ses cibles 5 points plus souvent (c'était le critère de la porte 0) et perd moins de cœurs ; mais il gagne autant de Coupes que le robot du chiffre. Sept façons de lire ont été essayées (le prix de l'espace sous le plafond de 0 à 6, l'affiche haute ou non, le banc lu ou non) : 6 à 8 Coupes à chaque fois, sauf une sortie à 13 que ses voisines démentent. À 64 graines, le bruit sur l'écart est de ±6 Coupes. Le « 8 contre 7 » des tranches 2 et 3, et le « 14 contre 11 » sur 128 graines, étaient donc sous le bruit : `mesure_run` jugeait une inégalité à pile ou face.
- **Le juge corrigé** : il exige ce qui se mesure (*lire ne coûte pas* : le robot du chiffre ne gagne pas nettement plus, en paires, à deux écarts-types) et imprime *lire paie* avec son bruit, sans le juger. Le critère du devis (« le robot du chiffre moins souvent en paires ») reste **ouvert**, à côté de *tu peux exploser le jeu* (6 runs sur 64, 9 % ; la cible, 10 %).
- **Pourquoi lire ne paie pas plus** : les deux robots signent presque à chaque porte (19 signatures sur 21 occasions) et finissent aussi forts (192 et 194). Une bonne affaire (une forte cote à petit salaire dans sa saison) se trouve à presque chaque porte : le plafond ne force pas à renoncer. C'est le même manque que *tu peux exploser le jeu*, et la même décision pour JP : un levier de plus.
- **Le robot qui lit, lui, lit plus** (scripts/lib/run_robot.mjs) : la pièce qui répond au rival de l'acte, sinon la plus haute ; ni élite ni affiche haute un soir de dos-à-dos ; l'affiche haute seulement quand son club est nettement plus fort (5 %).

## Le sort de chaque juge

- **Réécrits** : `check_pronostic` (la chance d'un soir isolé), `check_blessures` (le moteur seul), `check_hauteur` (ton identité au 82-0, trois cartes), `check_sauvegardes` (le solde de l'ancien Rogue).
- **Rebranchés sur la run en carte** : `check_moments_si` (chaque moment arrive dans des runs jouées ; l'infirmerie, rare dans une run, est nommée), `check_pouvoirs` (la présence sur des runs, les bornes d'un acte de six matchs), `check_elites` (un style par club), `check_run` (les cœurs recomptés des matchs : une série perdue se rachète une fois par cœur).
- **Élagués** de ce qui est parti : `check_verite`, `check_lexique`, `check_fils`, `check_histoires`, `check_atelier`, `check_totaux`, `check_profil`, `check_incidents`, `check_impact`, `check_speciales`, `check_ballottage`, `check_graine`, `check_gros`, `check_relais`, `check_robot`, `check_banque`, `check_chiffres`, `check_jambes`, `check_packs`, `check_suivis`, `check_clarte`, `check_couches`, `check_lisibilite`, `check_choix`, le smoke.
- **La CI** (`verifier.yml`) : les étapes de `check_instantane` et de `check_plateau` partent ; `profondeur.yml` est supprimé ; `check_scene`, `essai_run` et `mesure_run` y sont depuis la tranche 2.

**Connus, hors de cette tranche** (ni en CI ni dans `tout.mjs`, rouges avant elle) : `check_robot` (la Coupe du robot « premier Signer » du 82-0 à 7,5 %, pour 5 % attendus), `check_banque` (« un soin rend un blessé plus tôt »), et `check_situations`, qui ne démarre plus depuis la V25 A1 (il importe des noms partis de js/sim.js).

## Ce qui reste, et pourquoi

- **Le moteur** (js/sim.js, js/greffes.js), les pièces, le duel, les histoires et leurs voix, les cartes, le cartable, les coachs : la run en carte les joue.
- **js/rogue.js** : le méta (les médailles, le prestige, la table des déblocages et celle des exigences) attend la tranche 5, qui le réécrit sur la run en carte.
- **js/packs.js** définit huit packs, la run en ouvre deux ; **js/banque.js** garde ses cartes rares, que la run ne tire pas : la variété en médailles (tranche 5) dira ce qui revient.
- **js/gerant.js** garde la carte de choix et ses barres (`pucesDeFace`) pour ton identité au 82-0 et « Quitter le match ? ».
- **Le 82-0, Sur table, l'exhibition, Sur glace** : aucun ne change (`check_empreinte`, `check_feuilles`, les deux fumées).

## Ce qui reste ouvert

- **La tranche 5** : la méta (ce que les médailles achètent, les exigences sur les leviers neufs, les galons à l'échelle d'une run), l'écran de ce qui est versé, l'album, ton club et le palmarès dans la run.
- **« Tu peux exploser le jeu »**, à trancher par JP (docs/decisions.md).
- **La porte 2** : la run à l'essai, au téléphone.
