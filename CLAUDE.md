# Cap 82-0 — instructions pour l'agent

## Le projet en une phrase

Jeu web statique en français québécois : la roulette sort une saison et une équipe de la LNH, tu piges un joueur dans ce vestiaire, tu bâtis un alignement de 23 sous le plafond salarial, et tu simules 82 matchs.

Hébergé sur GitHub Pages. Aucun backend, aucune dépendance npm, aucun framework.

## Avant de coder

Lis `ARCHITECTURE.md` — il explique pourquoi le découpage se fait par saison et non par équipe. Ce choix n'est pas arbitraire et le défaire casse la normalisation par époque.

Lis `MOTEUR.md` — c'est la spécification de la refonte de la simulation par événements, avec les mesures qui appuient chaque choix. Si tu touches à `js/sim.js`, lis-le avant.

Lis `PLAN.md` — il contient l'état exact du projet, ce qui est fait, ce qui reste, et l'ordre de priorité. Coche les cases au fur et à mesure et ajoute une ligne au journal en bas.

## Structure

```
.github/workflows/verifier.yml    Action : à chaque PR, check_graine, check_feuilles
                            (une ligue) et le test de fumée dans Chromium
.github/workflows/build-data.yml  Action : bâtit les shards depuis l'API LNH et
                            les commite (modes bios, rerate, seed, full). C'est
                            la voie pour ajouter les dates de naissance quand
                            l'API n'est pas joignable depuis le poste de travail
index.html                  page unique (barre de plafond, roulette, tableau de
                            bord, deux volets vestiaire / alignement, modales)
favicon.svg                 la marque : la jauge de plafond et une rondelle
icon-180/192/512.png        rasterisées depuis favicon.svg (iOS, écran d'accueil)
site.webmanifest            nom, couleurs et icônes pour l'installation
style.css                   tous les styles, mobile d'abord (390 px), deux
                            volets à partir de 1080 px
js/ratings.js               calcul des cotes cachées (partagé navigateur + build)
                            étage 1 : sous-cotes en z-score (exige l'API)
                            étage 2 : valeur, salaire, archétype, zone (rejouable hors ligne)
js/data.js                  chargeur trois niveaux + cache IndexedDB
js/logos.js                 couleurs et écussons des 44 franchises ; `getTeamBand`
                            (l'aplat du bandeau, encre mesurée, liseré), `getTeamAccent`
                            (le contour éclairci) et `teamSeasonUrl` (la saison d'une
                            équipe sur Hockey-Reference, adresse vérifiée)
fonts/                      Barlow Condensed (OFL 1.1), trois graisses, hébergée ici :
                            la police des chiffres et des titres, aucune requête tierce
js/traits.js                les traits, tirés des votes de `data/trophees.js`
js/recit.js                 les mots du sommaire d'un match : il ne décide de
                            rien, il raconte ce que le moteur a déjà joué
js/direct.js                les séries en direct : rejoue la feuille d'un match
                            dans le temps, plein écran, un match à la fois
js/sim.js                   structure de l'alignement + simulation de saison + ligue complète ;
                            TOUT son hasard passe par `hasard()`, graine par saison
js/bilan.js                 le bilan de saison : onglets, palmarès, calendrier, séries et
                            sommaires ; branché au contrôleur par `brancherBilan`
js/game.js                  contrôleur d'interface
sw.js                       travailleur de service : la coquille hors ligne (réseau d'abord),
                            les portraits en cache ; les shards restent à IndexedDB
scripts/build_shards.py     aspire l'API LNH, écrit les shards ; --rerate = étage 2 sans API
scripts/rate.mjs            pont Node vers js/ratings.js (étage 1 + 2)
scripts/rerate.mjs          étage 2 sur les shards existants (contrats d'entrée, salaires réels)
scripts/build_salaries.py   assemble data/salaries/<saison>.json depuis data/salaries/sources/
scripts/fetch_markerzone.py dépose les salaires publiés par MarkerZone (1989-90+) dans sources/ ; manuel, jamais dans l'Action
scripts/check_ratings.mjs   distribution des valeurs, zones, archétypes, force d'équipe vs classement
scripts/build_lancers.mjs   régénère SEASON_LANCERS de js/ratings.js depuis les shards
                            (onze nombres par saison : les parts de buts dans
                            les points servent à la création, les deux derniers
                            — occasions et % d'avantage numérique — valent 0
                            tant que les shards n'ont pas le bloc `an`)
scripts/calibrate_sim.mjs   tableau de calibration (de vrais joueurs d'une même cote)
scripts/check_monotonie.mjs améliorer son équipe la rend-elle meilleure ? (vraies équipes)
scripts/mock_zones.mjs      le malus de zone ferme-t-il l'empilement ?
scripts/check_lancers.mjs   les deux constantes d'époque du moteur (voir MOTEUR.md)
scripts/mock_moteur.mjs     maquette du moteur par événements, comparée aux vrais totaux
scripts/check_suppression.mjs  la défensive de l'alignement : volume de lancers
                            concédés ou qualité ? (réponse : la qualité)
scripts/check_neutre.mjs    de quoi est faite l'équipe MOYENNE, une fois alignée
                            (les cinq nombres de REF dans js/sim.js)
scripts/check_feuilles.mjs  les égalités de la feuille de match, les repères
                            d'époque, et les totaux des joueurs (échoue si une
                            égalité casse : c'est ce que l'Action vérifie)
scripts/check_graine.mjs    la même graine rejoue-t-elle la même saison ? (un
                            `Math.random` glissé dans js/sim.js le fait échouer)
scripts/check_plafond.mjs   le plafond du jeu en victoires et en Coupes
scripts/check_tireurs.mjs   les deux alignements que la valeur ne voit pas :
                            TIREURS sans zones (~52 V) et PARFAIT (~68-70 V,
                            le vrai plafond du jeu)
scripts/check_chimie.mjs    la chimie de trio dit-elle ce que le hockey dit ?
scripts/check_traits.mjs    les traits : rareté, couverture d'époque, effet mesuré
scripts/smoke.mjs           test de fumée Playwright à 390 px
data/trophees.js            Selke, Norris, Vezina, Conn Smythe — gagnants et finalistes
data/reputations.js         les réputations curées : 179 joueurs marquants
data/index.json             liste des saisons disponibles
data/seasons/<saison>.json  un shard par saison
data/seed.json              filet hors ligne
data/salaries/<saison>.json salaires réels publiés (playerId -> $ de l'époque), facultatif
```

## Règles fermes

**Deux formats, deux tirages, un seul moteur.** `MODES` dans `js/sim.js` est le produit de deux réglages, et `modeDe(format, tirage)` donne la clé. Le **format** dit combien de cases : **Complet** (les 23, 95,5 M$) ou **Express** (six cases — un trio, une paire, un partant — le reste fourni par une vraie équipe tirée au hasard, hors plafond et non modifiable, sous 34 M$, la médiane mesurée de ce qu'une vraie équipe met sur ces six cases-là). Le **tirage** dit d'où viennent les joueurs. **Vestiaire** est le jeu d'origine, intact : une équipe et tout son club, un joueur par tour pour n'importe quelle case libre, six colonnes par poste, tri, recherche, et les relances d'année, d'équipe et de passe (`REROLLS`, 6 / 6 / 4). **Loto** : trois équipes, et de chacune le joueur qui **joue la position** de la **case courante** — la case visée, sinon la première vide — au rang de la case : le deuxième ailier gauche de trois clubs pour ton deuxième trio (les joueurs du club à ce poste sans pénalité, rangés par valeur, `joueurEquivalent`). JP : *ça me semblait évident, mais trois joueurs qui peuvent jouer à la position établie* — la première version prenait ce qu'`autoRoster` posait à la case, donc un centre à −3 quand il valait plus que l'ailier. Tu en choisis un, et les relances (huit en complet, trois en express) relancent les trois. JP : *un nouveau mode où le jeu te propose l'ailier numéro un de trois équipes, ça ferait plus loto, et les rerolls seraient pertinents, autant pour le mode à six que l'alignement complet*. Une première passe avait REMPLACÉ le vestiaire par une « unité équivalente » sans relance, et JP l'a refusée : *fallait pas enlever l'ancien mode de jeu, je voulais une variation*. Le Loto est la variation, le Vestiaire reste. Seul le mode « Par unité » (un trio entier d'un même club) a disparu. `joueurEquivalent` (`js/sim.js`) est la primitive du loto ; `candidats()` (`js/game.js`) rend tout le club en vestiaire et dérive la main à chaque rendu en loto, donc viser une autre case recompose la main des mêmes trois clubs sans relancer. En loto la roulette refuse une main où rien ne tient dans le budget du choix tant qu'elle peut faire autrement (vingt essais, puis sous le plafond restant, puis plaçable). Le moteur, les 23 cases, le malus de zone et la ligue de 32 équipes ne changent jamais.

**`autoRoster` comble le centre avant les ailes.** Case par case dans l'ordre AG, C, AD, le glouton mettait le meilleur attaquant du club à l'aile gauche quel que soit son poste — Yzerman à −3, parce que trois points de pénalité ne pèsent rien contre trente de valeur. `ORDRE_AUTO` passe le centre de chaque trio avant ses ailiers. Mesuré sur quatre ligues (`check_feuilles.mjs`) : 3,19 → 3,30 buts par équipe par match, les vraies équipes finissent un peu mieux une fois leurs centres au centre ; les égalités, les lancers (28,5) et la part d'avantage (25,6 % contre 26,7 % réel) ne bougent pas. `LANCERS_BASE` et `CIBLE_PCT_TIR` n'ont pas été retouchés — une seule lecture, et JP trouve déjà l'équipe du joueur un peu trop avantagée en attaque.

**Le cache clone avant la première attente.** `cachePut` (`js/data.js`) n'est pas attendu, et `getShard` sort aussitôt les cotes `o d r c v` des objets joueurs vers le coffre. Le `put` arrivait après `await openDB()`, donc clonait des joueurs DÉJÀ dépouillés, et à la visite suivante, servie du cache, tout le monde valait 50 : Lemieux 1986-87 « Middle 6 » au deuxième trio, Ponikarovsky « Top 6 » parce que sa saison venait d'être chargée fraîche. `structuredClone` avant le premier `await`, et un cache sans cotes est jeté (`cacheEntier`). Toute mutation d'un objet du shard après `loadSeason` est suspecte : c'est le même objet que le cache va cloner.

**Un joueur-saison ne peut habiller qu'une équipe.** Un joueur échangé est dans le vestiaire de CHAQUE club où il a passé, avec un objet distinct par club : comparer les objets laissait signer deux fois le même homme (Budaj 2015-16 avec le Colorado, puis avec Los Angeles) et l'aligner dans deux équipes de la même ligue. `getPersonKey` identifie la personne, `getPlayerKey` reste la clé du coffre des cotes — les deux existent et ne servent pas à la même chose.

**Il n'y a plus de cote globale.** La valeur d'un joueur (`v`) est son **rang statistique** dans sa saison, projeté sur la distribution historique par position (`valeurDeSaison` et `VALEUR_CENTILES` dans `js/ratings.js`). Le rang vient des colonnes — production, volume de lancers, différentiel lissé du vestiaire, usage — et l'échelle est celle que le jeu utilisait déjà. Cette séparation est délibérée : **changer qui est premier est un choix de conception, changer combien de joueurs valent 70 en serait un autre**, et on n'en veut qu'un à la fois. C'est ce qui garantit que les seuils de zone, la courbe des salaires et l'économie du plafond continuent de valoir ce qu'ils valaient.

**Les cotes ne s'affichent nulle part.** Ni hexagone au survol, ni chiffre global sur la carte, ni grille ATT/DÉF/ROB/CLU sur la fiche, ni option « brouillard de guerre » — elle n'existait que pour les révéler. La fiche porte à la place un **profil mesuré** : production, lancers, penchant et robustesse, chacun en écart au régulier moyen de la saison du joueur. Un joueur se juge sur ce qu'il a fait.

**Les sous-cotes `o`, `d`, `r`, `c` restent internes** : le moteur lit `d` pour la défensive d'équipe, `r` pour l'usure et `c` pour la prolongation. Elles ne sortent jamais dans le DOM.

**Un taux sur huit matchs ne veut rien dire.** Chaque terme de taux est ramené vers la moyenne au prorata de l'échantillon (`gp / (gp + FIABILITE)`, FIABILITE = 22). Sans ça la corrélation force/classement tombait à 0,77 et les rappels occupaient les hauts de classement.

**Une seule implémentation des cotes.** `js/ratings.js` est la source unique. Le navigateur l'importe, et `scripts/build_shards.py` y accède via `scripts/rate.mjs`. Ne réimplémente jamais la formule en Python — ça produirait deux définitions qui divergent silencieusement.

**Toucher à une formule de cote veut dire incrémenter `RATINGS_VERSION`** dans `js/ratings.js`. La version est dans la clé du cache IndexedDB. Sans incrément, un joueur se retrouve avec des cotes calculées par deux formules différentes dans le même alignement.

**Deux étages de cotes.** L'étage 1 (`rateSkaters`, `rateGoalies` : sous-cotes o, d, r, c) exige les stats brutes de l'API. L'étage 2 (`finalizeSeason` : valeur `v`, salaire, archétype `ak`, zone `lz`, contrat d'entrée `elc`, contexte de création `cx`) ne lit que le shard, donc `python3 scripts/build_shards.py --rerate` le rejoue sur les 55 saisons en une seconde, sans réseau. Si tu changes l'étage 2, c'est la commande à lancer ; si tu changes l'étage 1, il faut l'API. Le build normal enchaîne toujours un `--rerate` à la fin, parce que les contrats d'entrée dépendent de la première saison de chaque joueur dans toute la base et de sa cohorte d'identifiant (âge estimé quand l'API bios n'a pas donné la date de naissance `bd` ; `python3 scripts/build_shards.py --bios-only` l'ajoute aux shards existants en ~110 requêtes, et les cartes affichent alors l'âge). Règles d'époque dans `elcEra` : rien avant 1995-96.

**La valeur est relative à la saison par construction** : c'est un rang à l'intérieur de la saison, donc 1975 (18 équipes) et 2024 (32) s'équilibrent d'eux-mêmes. Vérifie avec `node scripts/check_ratings.mjs` : la corrélation entre la force d'une équipe et son vrai classement (reconstitué des fiches de gardiens) doit rester autour de 0,8 — elle est à **0,777** depuis que la production pèse plus chez les attaquants (voir ci-dessous ; 0,793 avant).

**Ce qui a été essayé sur la valeur, et écarté, mesuré.** La littérature des cotes toutes époques tient en quatre familles — les *adjusted stats* de Hockey-Reference (82 matchs, 6 buts par match, 18 patineurs, environnement de passes), ses *Point Shares* (buts créés `B + 0,5 A`, part défensive par le temps de glace et les buts alloués de l'équipe), le GVT d'Awad et le GAR/WAR d'Evolving-Hockey (qui exigent le jeu par jeu, donc 2007 et après). Le rang à l'intérieur de la saison fait déjà ce que la première famille fait, sans dépendre de l'échelle. Les deux idées transposables ont été essayées hors ligne sur les 55 saisons, contre la corrélation force/classement qui fait autorité : **les buts créés** à la place des points (`B + 0,5 A`, `0,6 A`, `0,75 A`) donnent 0,791 à 0,792 contre 0,793, et un **GSAA** pour les gardiens (l'écart d'arrêts pondéré par la charge, au lieu d'une somme) donne 0,794 — du bruit dans les deux cas, pour un changement de qui est premier. On garde la formule. Ce qui manque vraiment, ce sont les colonnes que le shard ne porte pas, et aucune pondération ne les invente.

**La production pèse plus que le reste chez les attaquants, et un mauvais club coûte moins** (`POIDS_VALEUR.F` 0,54 / 0,10 / 0,12 / 0,24, `PROD_PUISSANCE_F` 0,75, `PM_PLANCHER_F` −0,75, `RATINGS_VERSION` 25). JP a montré Adam Oates 2001-02 — 78 points, cinquième pointeur de la ligue — étiqueté « Top 9 » : 102 lancers et un −4 le tiraient à 68. Ce n'était pas un cas : 89 des 550 « dix meilleurs pointeurs » des 55 saisons sortaient sous Top 3 (Stastny 1981-82 à 71 avec 139 points). Mesuré sur onze variantes (`check_ratings.mjs` et le compte des top 10 sous 78) : la corrélation force/classement passe de 0,793 à **0,777** et les aberrations de 89 à **17**, toutes des vedettes de clubs en perdition (Sakic 1989-90 à −40) qui restent Top 6. Une part des 0,016 perdus est l'artefact du +/- décrit plus bas. Les défenseurs ne bougent pas. Le tableau des variantes est dans le commentaire de `POIDS_VALEUR`.

**Ce que le rang statistique ne peut pas voir, et c'est assumé.** `finalizeSeason` ne lit que le shard, qui ne porte ni les points en désavantage numérique ni les tirs bloqués — deux signaux défensifs que l'ancienne cote pouvait utiliser parce qu'elle était calculée à l'étage 1, sur l'API. Le différentiel lissé les remplace, et il porte donc plus de poids chez les défenseurs (0,36) que chez les attaquants (0,20). C'est aussi le terme le plus discutable : le +/- est en partie un résultat d'équipe, et lui donner du poids gonfle mécaniquement la corrélation qu'on mesure ensuite. `LISSAGE_EQUIPE` en retranche la moitié.

**Modules ES natifs, pas de build step.** `<script type="module">`. Aucun bundler, aucun transpileur, aucun `node_modules`. Le dépôt doit pouvoir être servi tel quel.

**Français québécois** dans toute l'interface et tous les commentaires. Abréviations de hockey en français : PJ, B, A, PTS, PUN, V, D, BL, MBA (moyenne de buts alloués), AG/C/AD, DG/DD.

**Mobile d'abord.** Cible 390 px de large. Teste à cette largeur avant de déclarer une tâche terminée. Rien ne doit déborder horizontalement de `document.documentElement` — seuls les conteneurs prévus (bande du tableau de bord, tableaux du résultat) défilent en x.

**Pas de titre de page.** La barre du haut ne porte que le plafond restant, le compte de signés, le budget par case et les trois accès (historique, règles, options). Le nom du jeu vit dans l'onglet du navigateur, pas dans une bannière qui vole de la hauteur utile.

**Le haut de la page est UN bloc, pas trois.** JP : *le haut me semble trop complexe visuellement, les infos sont bonnes, mais c'est trop de sections, de colonnes*. La jauge encadrée dans la barre encadrée, la carte de la roulette encadrée, le tableau de bord en trois boîtes : trois cadres empilés pour dire quatre choses. Maintenant la jauge est plate dans la barre (une seule ligne dès 680 px : étiquette, montant, barre, signés, budget par case), et la roulette et ses trois chiffres de décision vivent dans un seul bloc à la couleur du vestiaire — le nom et les relances en haut, la bande des chiffres en pied, sur un fond plus sombre avec un filet, sans cadre. La ligne d'instruction ne s'affiche que quand elle dit quelque chose que la bande ne dit pas : une case ciblée, ou l'alignement complet. Même principe à l'écran de résultat : sous le pointage, six chiffres sur une bande de tableau indicateur (points, rang, buts pour, contre, différentiel, masse) plutôt qu'une phrase.

**À plat.** JP : *y a trop de 3D dans l'interface*. Plus d'ombres portées (`--shadow-1` et `--shadow-2` valent `none`), plus de reflets `inset`, plus de dégradés sur les boutons, les cartes, la jauge, le bloc de la roulette ou la tête de la fiche, plus de halo radial derrière le fond de page ni de lueur sous le pointage. Des aplats, des filets d'un pixel, et la couleur qui dit quelque chose. Ce qui reste et qui n'est pas de la 3D : le liseré dessiné dans un bandeau (une ligne), les hachures d'une case vide (une texture plate), l'anneau pulsé d'une case ciblée (un état).

**Deux rangées avant les cartes, pas quatre.** Sur téléphone, le titre du volet répétait l'onglet du bas (« Vestiaire · 27 ») et la bascule, la recherche et le tri prenaient chacun leur rangée. Tant qu'il y a des onglets (sous 1080 px) le titre s'efface, la bascule « Par poste / Tous » devient deux icônes, le tri porte des libellés courts (« Points / V », « Pts par M$ »), et les trois tiennent sur une ligne au-dessus des sept pastilles.

**Le bassin se range par position, sur une colonne par poste.** Le volet du bassin est un conteneur de requête nommé `pool` ; quand il dépasse 1000 px, `.pool.by-pos` devient six vraies colonnes (AG, C, AD, DG, DD, G), sinon les en-têtes redeviennent de simples séparateurs et les cartes reprennent une grille fluide. Chaque colonne est elle-même un conteneur nommé `col` : sous 235 px la carte compacte ses chiffres et rétrécit son portrait, sous 200 px elle le perd, sous 190 px le code d'équipe s'efface du bandeau. **Les conteneurs de requête doivent rester nommés** — sans nom, l'en-tête d'une colonne interroge la largeur de sa colonne au lieu de celle du volet, et la mise en page se défait en silence.

**Le bassin se lit de deux façons, et le bouton « Par poste / Tous » choisit.** *Par poste* range en six colonnes ; sur téléphone elles deviennent une **bande qu'on balaie**, une colonne par écran, la suivante affleurant à 87 % de largeur. *Tous* met tout le vestiaire ensemble dans l'ordre du tri : la vue du chasseur d'aubaine. Demander les six colonnes pendant qu'un filtre n'en laisse qu'une lève le filtre plutôt que de ne rien faire. **Tout ce qui vit dans `#pool` est une colonne de la bande** : la bande de secours d'impasse a son propre conteneur, `#poolNotice`, au-dessus.

**En loto, le volet devient « La main » et cache ses outils.** Trois cartes n'ont besoin ni de tri, ni de recherche, ni de pastilles : `renderPoolMeta` pose la classe `loto` sur le volet, qui les masque et garde le titre visible même sous 1080 px. La main se lit dans l'ordre des trois clubs.

**Une série est un tableau indicateur.** Deux rangées, une par équipe, le nombre de victoires en gros à droite en police d'affichage, le gagnant en clair et son chiffre en or, le perdant en gris ; le titre de ronde est une ligne avec un filet à droite ; le champion porte un bandeau d'or comme toutes les cartes. Les palmarès suivent : onglets en condensée, en-têtes de tableau en condensée, chiffres en condensée, la colonne vedette en or.

**La fiche porte le portrait en grand, comme une carte de collection.** Détouré (les portraits de la LNH ont un fond transparent), sans cadre, 126 px, posé sur la ligne du bandeau, le nom et le salaire à sa droite. Le petit carré encadré d'avant ressemblait à une photo de passeport.

**Le tableau de profondeur est une trame de six colonnes.** `.line-slots` pose toujours six colonnes : un trio prend deux colonnes par case, une paire trois. Les rangées s'alignent donc les unes sous les autres quel que soit l'effectif de l'unité, et `align-items: stretch` garde les blocs à la même largeur — c'est `align-items: start` qui les faisait rétrécir à la largeur de leur titre.

**Le portrait est posé par-dessus l'émoji de secours, jamais à côté.** La boîte de l'avatar contient les deux (l'émoji réapparaît si l'image ne charge pas) ; tant qu'ils étaient deux enfants d'une grille, l'émoji prenait sa rangée, l'image n'avait que la moitié de la hauteur et `cover` coupait les têtes en deux — JP : *les têtes des joueurs sont coupées en deux*. L'image est absolue sur toute la boîte, zoomée à 1,35 sur le visage (les portraits de la LNH sont carrés, le visage dans la moitié haute). Même règle pour le visage dans la case de l'alignement (`.slot-face`) et dans la bannière de but du direct (`.live-visage`). Disposition des volets : onglets sous 1080 px, volets empilés pleine largeur de 1080 à 1600 px, côte à côte au-delà.

**Chaque carte commence par un bandeau qui dit ce qu'on regarde.** C'est le langage des cartes de pointage, et il vaut partout : une carte du bassin porte en tête le poste (bleu attaquant, violet défenseur, ambre gardien), une case de l'alignement porte son rôle et le salaire, une carte de match porte son numéro — en or si ce match a réglé la série, en rose s'il est allé en prolongation. On lit la nature de la chose avant son contenu, et la couleur transporte une information plutôt qu'une décoration.

**Des aplats pleins, aux vraies couleurs, pas des teintes.** Le bandeau d'une carte du bassin ou d'une case de l'alignement est un aplat plein de la couleur **brute** de l'équipe — le rouge de Chicago, le marine de Toronto, le noir des Kings — avec l'encre que `getTeamBand` mesure et un liseré de la couleur secondaire dessiné à l'intérieur du bandeau (la hauteur ne bouge pas) ; les pastilles de zone sont pleines elles aussi, du doré (Top 3, Top 2) au bleu clair puis au gris sourd, pour qu'on trouve des yeux le calibre d'un joueur. Une version teintée à basse opacité a été essayée et écartée : elle rendait tout gris et ne servait ni la lecture ni le plaisir. Ce qui se répète peut porter de la couleur pleine tant que la couleur DIT quelque chose — le vestiaire d'où sort la carte, le calibre du joueur, le match qui a réglé la série.

**Ranger, ne pas retirer.** Une passe a essayé de simplifier la carte du bassin en enlevant le portrait, l'archétype, l'écusson et la saison. C'était le mauvais geste, et JP l'a dit : *les mêmes informations, une présentation plus propre*. Ce qui rendait la carte lourde n'était pas ce qu'elle disait mais la façon dont c'était éparpillé — un badge de poste noyé dans le nom, un écusson collé au portrait, une année dans une ligne de contexte, sept rangées empilées. La carte porte donc toujours tout, en trois zones : le **bandeau** réunit poste, équipe et année ; le **corps** met le portrait à gauche et deux lignes à droite (nom et prix, puis chiffre clé et étiquettes) au lieu de quatre rangées ; le **pied** garde l'avertissement et le bouton. Même information, deux fois moins de hauteur.

**La couleur d'équipe cerne la carte, elle ne lui colle pas une barre au flanc.** Un trait fin de `--team-line` fait tout le pourtour d'une carte du bassin ou d'une case de l'alignement, et la même teinte revient en fond du bandeau et du dégradé : c'est ce qui détache la carte du fond et donne à chaque vestiaire son air, sans bande épaisse sur un seul côté.

**La couleur d'équipe porte du texte à un seul endroit : le bandeau de carte, avec une encre mesurée.** La règle disait autrefois « jamais », faute de savoir lire la couleur ; `getTeamBand` (`js/logos.js`) la mesure maintenant — elle calcule les deux rapports de contraste WCAG sur la couleur **brute** et garde la meilleure encre, blanc ou bleu nuit. Une première version posait la couleur *éclaircie* de `getTeamAccent` en aplat : le rouge de Chicago devenait rose saumon, le marine un bleu poudre, et JP a dit que ça faisait « cheap ». Un aplat n'a pas besoin d'être clair pour se voir, il a besoin d'une encre qui contraste : le blanc lit à 5:1 sur le rouge de Chicago et à 14:1 sur le marine de Toronto, le bleu nuit à 11:1 sur l'or de Boston. Si aucune encre n'atteint 4,5:1 sur la couleur brute, `getTeamBand` éclaircit juste assez. **`getTeamAccent` reste ce qu'il était, pour les contours** : une bordure d'un pixel, elle, doit être claire pour exister sur le fond sombre. **Partout ailleurs la règle ne bouge pas** : `--team-primary` et `--team-accent` ne teintent que fonds, bordures et lueurs, et les états sélectionnés (chips, segments d'options) gardent `--ui-accent`, fixe.

**Les chiffres et les titres sont en condensée, le corps en système.** `--display` (Barlow Condensed, dans `fonts/`, licence OFL) porte les montants, les pointages, les noms de famille en capitales, les titres de volet et de rangée, les boutons. C'est la lettre des cartes de pointage et des maillots, et c'est ce qui fait qu'un chiffre a l'air d'un pointage plutôt que d'un paragraphe en gras. La police est servie par le dépôt, pas par Google : aucune requête tierce, aucun bandeau qui change de forme quand le réseau tarde, et le jeu reste entier hors ligne. **Pas d'émoji dans la chrome** : les boutons du haut, les relances, la recherche et les liens externes prennent les icônes du sprite SVG de `index.html` (`ico('i-…')` dans `js/game.js`), qui rendent pareil sur tous les appareils. Les émojis restent pour ce qui est un mot du jeu — les traits, les archétypes, la chimie.

**Chaque équipe-saison pointe vers sa vraie page sur Hockey-Reference.** `teamSeasonUrl(code, saison)` (`js/logos.js`) : une adresse par équipe et par saison, année de FIN dans l'adresse, codes de Hockey-Reference là où ils diffèrent des nôtres (ATF, HAR, VEG, CBH jusqu'en 1985-86, MDA jusqu'en 2005-06). **Vérifiée pour les 44 codes du dépôt** le 8 septembre 2026, une requête par code, toutes à 200 avec le bon titre — sauf les Thrashers, testés par erreur sur 2004-05, la saison annulée, et déduits des 43 autres. Ce n'est pas du scraping : on y envoie, on n'en lit rien. La carte de la roulette, le classement, les séries, les palmarès et la fiche du joueur passent tous par là.

**La carte ne porte que l'essentiel, la fiche porte tout.** Une carte du bassin montre le poste, le nom, le salaire, le chiffre clé, les traits, l'archétype, la zone d'efficacité, la case de destination et le bouton. Rien d'autre : les statistiques détaillées, le profil mesuré, l'âge, le contrat d'entrée, l'origine du salaire et l'impact sur l'alignement sont dans la fiche, à un clic. Même principe au tableau de bord — trois chiffres, l'explication en infobulle. On ne bloque pas une décision sous un mur de texte.

**On réserve la place, on ne la prend pas.** C'est la règle qui rend l'interface propre, et elle vaut partout : une carte du bassin, une case de l'alignement, une tuile de résumé ont une hauteur **fixe**, remplie ou non. Mesuré avant : la carte d'« Eric Daze » faisait 175 px et celle de « Michael Nylander » 188, parce que le nom coulait sur une ou deux lignes selon sa longueur — deux colonnes voisines ne s'alignaient jamais et les boutons « Signer » formaient un escalier. Le nom tient donc sur deux lignes par construction (prénom petit dessus, nom de famille gros dessous, chacun coupé aux points de suspension), la ligne d'avertissement existe même vide, et les étiquettes tiennent sur une rangée. **Un contenu qui déborde ne grandit pas la boîte.** Mais **le nom de famille, les points, le salaire et les icônes sont toujours entiers** — c'est la règle de JP, et elle remplace les points de suspension sur ces quatre-là : une carte qu'on signe sans avoir lu le nom ne sert à rien. `ajusterCartes` (`js/game.js`) mesure après chaque rendu, puis au chargement de la police et au redimensionnement : le nom rétrécit sa police jusqu'à tenir (plancher 10 px), la rangée d'étiquettes se réduit à l'échelle vers la droite, et les points comme le salaire ne bougent jamais, c'est le nom qui cède. Lectures d'abord, écritures ensuite. Le reste — prénom, ligne d'avertissement, nom dans une case de l'alignement plus étroite qu'un nom — se coupe aux points de suspension, et la fiche le donne en entier. Corollaire dans un bandeau : le poste et le salaire ne se coupent jamais — c'est l'écusson qui cède, puisque la couleur du bandeau dit déjà l'équipe.

**Une rangée de tuiles est une rangée, pas un pavage.** Les cinq chiffres de l'alignement et les cinq axes du profil mesuré se lisent ensemble : en `auto-fit` ils tombaient trois-plus-deux et quatre-plus-un, avec un trou au bout. `repeat(5, minmax(0, 1fr))` et `grid-auto-flow: column` les gardent sur une ligne, et ce sont les libellés qui raccourcissent.

**Une rangée du tableau de profondeur porte son RANG, pas sa zone** — 1er trio, 2e trio, 1re paire. Deux rangées s'appelaient « Top 6 » et deux autres « Top 4 », si bien qu'on ne savait plus laquelle on regardait. La zone reste écrite sur la case vide et sur l'étiquette du joueur, là où elle sert à décider. Et la case ne porte que le **verdict de placement** — zone, écart de zone, pénalité de position : les traits et l'archétype sont sur la carte du bassin, au moment où on décide de signer, et sur la fiche.

**Sur téléphone, un tableau garde sa colonne vedette.** Sept colonnes dans 390 px se coupaient au « PJ » : on ouvrait le palmarès des pointeurs sans jamais voir un point. `heros` dans `PALMARES` (`js/game.js`) nomme la colonne qui donne son titre au palmarès — elle n'est pas toujours la dernière — et c'est la seule que le téléphone garde.

**Toujours AG, C, AD, DG, DD, G.** Le même ordre et les mêmes sigles partout : les colonnes du bassin, les pastilles de filtre, les cases du tableau de profondeur, les bandeaux de carte, les tables d'équipe. Le mot complet vit dans l'infobulle. Sept pastilles ne tiennent pas en pilules sur une rangée de téléphone : sous 560 px elles deviennent une grille de sept colonnes égales, le compteur empilé sous le sigle.

**Une case se nomme par son rang, jamais par sa zone.** « Top 6 · C » désignait aussi bien le premier trio que le deuxième — Lemieux allait « au Top 6 » et JP a demandé *Top 6 ?*. `slotShort` et `uniteNom` (`js/game.js`) disent « 2e trio · C », « 1re paire · DG », « Gardiens · Partant », « Réserve · Réserve D » partout : carte, fiche, toasts, tableau de bord, roulette. La zone reste sur la pastille du joueur.

**Ton équipe s'appelle les NHL Stars.** Noir, blanc, orange (`TEAM_COLORS.YOU`, écusson `INLINE_LOGOS.YOU` dessiné dans `js/logos.js`, pas emprunté), code `NHL` au tableau indicateur, « NHL Stars » partout où une équipe est nommée. Les phrases du récit gardent « ta formation » quand elles s'adressent au joueur.

**Après la simulation, tout nom ouvre une fiche et toute équipe ouvre sa page.** `lienJoueur` et `lienEquipe` (`js/game.js`) rendent un bouton et l'inscrivent dans un registre ; un seul écouteur délégué sur le document sert tout — feuille de match, palmarès, sommaire, tables d'équipe, calendrier. La fiche d'après (`showPlayerModal(p, { sim })`) montre les statistiques **simulées** en premier, la vraie saison dessous pour comparer, ni destination ni bouton Signer. La page d'équipe (`showTeamModal`) montre les 23 fiches simulées et les 82 résultats du journal. Les palmarès rangent **tous** les joueurs qui ont joué, pas dix, construits onglet par onglet au clic (`tablePalmares`) parce que neuf tables de sept cents rangées d'un coup, c'est six mille lignes de DOM pour en lire une.

**Le joueur va où il rend.** `slotFitScore` dans `js/game.js` classe les cases libres par position naturelle d'abord, puis par zone d'efficacité : un joueur de calibre quatrième trio se propose au quatrième trio, pas au premier parce qu'il était vide. Les réservistes viennent en dernier.

**Le vocabulaire est celui du hockey.** Les zones s'appellent Top 6, Top 9, Bottom 6 et 4e trio chez les attaquants ; Top 4, Top 6 D, Bottom 4 et 3e paire chez les défenseurs ; partant numéro un, partant et auxiliaire chez les gardiens. Jamais « calibre 2 ».

**La couleur d'équipe passe par `getTeamAccent`** (`js/logos.js`), qui éclaircit la teinte jusqu'à ce qu'elle reste visible sur fond sombre, et sert de `--team-line` : bordure des cartes du bassin, et bordure de chaque case de l'alignement à la couleur de l'équipe du joueur qui l'occupe. La couleur brute d'une équipe sombre ne porte jamais rien.

**Toute commande visible doit fonctionner.** Si une donnée manque, on retire la commande plutôt que d'afficher des tirets : les dates de naissance (`bd`) ne sont pas dans les shards actuels, donc le tri par âge et la tuile « âge moyen » se masquent d'eux-mêmes (`agesAvailable()` dans `js/game.js`). `python3 scripts/build_shards.py --bios-only` les ajoute et tout réapparaît sans autre changement.

**Aucune cote dans le DOM, jamais.** `registerHiddenRatings` sort `o`, `d`, `r`, `c`, `v` de l'objet joueur vers un coffre privé dès le chargement, et `sp` est simplement supprimée — aucune formule ne la lit. Un joueur curieux qui ouvre l'inspecteur ne doit rien pouvoir en tirer.

**Pas de localStorage pour les données de saison** — trop petit. IndexedDB, comme dans `js/data.js`.

## Le moteur de match

**Tout le hasard du moteur passe par `hasard()`, et chaque saison porte sa graine.** `js/sim.js` n'appelle jamais `Math.random` directement : `grainerHasard(graine)` remplace le générateur par un sfc32 déterministe, `simulateLeague` tire une graine s'il n'en reçoit pas et la rend (`league.graine`), et le générateur reste en place pour les séries jouées ensuite. La chance de saison (`t.luck`) est tirée SOUS la graine, dans `simulateLeague`, pas à `createTeam` — c'est ce qui a fait échouer le premier essai de `check_graine.mjs`. C'est ce qui rend « Rejouer la saison » et l'historique possibles, et ce qui rend le défi du jour (S1) à portée : il ne manque plus que la roulette. `node scripts/check_graine.mjs` le vérifie à chaque PR.

**Les départs des gardiens se partagent selon la vraie saison des deux** (`partAuxiliaire`, bornée par `PART_AUX_MIN` 0,12 et `PART_AUX_MAX` 0,50). L'auxiliaire jouait un match sur six quel que fût son rôle : un partant qui avait joué 30 matchs en jouait 68, un tandem 1A-1B ne valait rien de plus qu'un partant et un rappel, et la case auxiliaire était de l'argent mort. Mesuré après (`check_monotonie.mjs`, 4 essais) : monotone sur dix déciles, 27,1 / 41,7 / 51,0 (c'était 28,1 / 42,0 / 52,0 ; le dernier décile perd un match parce que les grandes équipes donnent maintenant ses vrais départs à leur second). `check_feuilles.mjs` sur cinq ligues : 28,3 lancers, 3,20 buts, égalités intactes.

**L'événement de base est le lancer, pas le but.** C'est la refonte décrite dans `MOTEUR.md`, et ce qui la motive est mesuré : sur 55 saisons les lancers par équipe par match vont de 27 à 31 (17 % d'amplitude) pendant que les buts varient de 55 %. Le tempo n'a pas bougé, la finition oui. Un match se joue donc lancer par lancer — un tireur, un gardien, deux issues — et toute la feuille de match en découle.

Les trois égalités se ferment **par construction**, jamais par un ajustement après coup, et `node scripts/check_feuilles.mjs` les vérifie sur les 1312 matchs d'une ligue :

```
buts d'une équipe    = somme des buts de ses joueurs
lancers d'un gardien = ses arrêts + les buts alloués
passes              <= 2 par but
lancers pour        = lancers contre, à l'échelle de la ligue
```

**La défensive agit sur la qualité des lancers, pas sur leur nombre.** Mesuré sur 1392 équipes-saisons : la cote défensive d'un alignement corrèle à −0,17 avec les lancers concédés et à +0,45 avec le pourcentage d'arrêts de l'équipe. Une bonne brigade ne réduit pas le volume de rondelles vers son filet, elle réduit la probabilité que chacune entre. Le volume, lui, ne tient qu'à la possession (`possession^0,150`). Ne recâble pas la défensive sur le volume : la mesure dit non.

**Un seul nombre du moteur ne se mesure pas : `PCT_TIR_NEUTRE`.** L'adversaire de la saison solo n'a pas d'unités, donc il ne porte ni création, ni chimie, ni malus de zone, alors qu'il encaisse une attaque qui en porte. Lui donner la finition brute mesurée (`REF.pctTir`) laissait toute vraie équipe gagner une victoire de trop en solo (44,4 en moyenne sur 465 équipes-saisons contre 43,4 réelles). Il se règle donc sur la SORTIE, comme `LANCERS_BASE` et `CIBLE_PCT_TIR` : 1,045 avant les unités spéciales, **0,965** depuis — parce que l'adversaire neutre profite de la finition d'avantage (`AN_QUALITE`) sans payer le prix d'une unité, il gagnait trois matchs de trop à tous les déciles, et `check_monotonie.mjs` l'a montré. `check_neutre.mjs` sort les cinq nombres de `REF` et le rappelle.

**Tout est exprimé en écart à `REF`**, l'équipe moyenne une fois alignée — pas le joueur moyen de la ligue. La distinction n'est pas cosmétique : un alignement retient les 18 meilleurs patineurs d'un club et son gardien numéro un, qui tirent 27 % de plus que le régulier moyen, finissent 2 % mieux et arrêtent 10 % de plus. Normaliser sur le joueur moyen donnait une équipe médiane à 60 victoires. `node scripts/check_neutre.mjs` remesure ces quatre nombres.

**Trois bornes au 99e centile des vraies équipes, et le vrai plafond du jeu.** Le volume d'une unité est plafonné à `VOLUME_UNITE_MAX` (2,0 fois le régulier moyen), la pression d'équipe à `PRESSION_MAX` (1,35 fois la référence, environ 38 lancers par match) et la finition d'équipe — le % de tir des patineurs habillés, pondéré par leurs lancers — à `FINITION_MAX` (1,20 fois la ligue). Chacune est le 99e centile mesuré sur les vraies équipes alignées, donc elles ne touchent qu'une vraie équipe sur cent. `node scripts/check_tireurs.mjs` mesure les deux alignements que la valeur ne voit pas : **TIREURS**, glouton sur lancers × finition en ignorant les zones, faisait 70,8 victoires en solo et la Coupe trois fois sur trois avant les bornes — son premier trio, trois étoiles à leur place, prenait 52 % des lancers ; il fait maintenant **53**, sous l'empilement par valeur (58-60). **PARFAIT**, chaque joueur dans sa zone, chaque trio deux tireurs et un passeur en chimie parfaite, chaque paire équilibrée, faisait 78 victoires et 628 buts ; il fait maintenant **71 à 72**, quelques matchs de mieux que le Canadien de 1976-77 (67), et c'est le plafond voulu : monter son alignement parfaitement vaut huit à dix victoires sur le simple empilement, on bat la meilleure équipe de l'histoire, la Coupe reste un pari. Le malus de zone n'est pas touché : il punit le talent mal placé, les bornes empêchent le talent bien placé de compenser à lui seul, et la chimie s'applique par-dessus les bornes parce que c'est elle qu'on récompense.

**Les passes causent les buts.** Chaque lancer porte la **création** des quatre coéquipiers sur la glace — leurs passes par match, relatives au régulier moyen de leur position et de leur saison (`passesRelatives`, `js/ratings.js`) — rapportée au **contexte** que le tireur a vraiment eu (`p.cx`, posé dans le shard par `contexteDeCreation` à l'étage 2, en rangeant son équipe par valeur en trios et en paires) et élevée à `BETA_CREATION` (0,5). Le contexte est ce qui évite de compter deux fois : le % de tir d'un joueur contient déjà ses vrais coéquipiers, et sans lui l'erreur systématique par joueur de `check_feuilles.mjs` passait de 19,5 à 24,8 % et le Canadien de 1976-77 gagnait deux matchs de plus sans qu'on ait touché à ses joueurs. Avec le contexte, un joueur rejoué avec ses vrais coéquipiers marque comme dans la vraie vie — **Kurri 1984-85 marque 71 buts à côté de Gretzky, son vrai total, 49 à côté d'un centre de quatrième trio, 17 au quatrième trio** — et les déciles ne bougent pas. `BETA_CREATION` est la deuxième constante libre du moteur avec `SYN_ECHELLE` : les colonnes ne peuvent pas la mesurer, pour la raison ci-dessus ; elle se règle sur l'ordre des plafonds de `check_tireurs.mjs` et sur ce que Kurri gagne à côté de Gretzky. La création entre dans la finition d'équipe, donc sous `FINITION_MAX`. L'attribution des passes après le but (95 % une première, 75 % une seconde — 1,66 passe par but, la mesure sur 55 saisons — au prorata de la propension, un défenseur pesant `PASSE_D` 0,3 pour que les défenseurs récoltent leurs 29,7 % réels des passes) ne change pas la cause : c'est la feuille de match. `REF.crea` (1,260) est la création moyenne de l'équipe alignée, mesurée par `check_neutre.mjs`, et ne sert que de contexte de secours quand le shard n'en porte pas.

**Les punitions et les unités spéciales se jouent comme un petit match dans le match** (`jouerSoixanteMinutes`, MOTEUR.md 4.7). Chaque équipe prend des punitions au rythme de sa saison — mesuré dans les shards depuis 1977-78 (colonne [9] de `SEASON_LANCERS` : 4,25 en 1980-81, 4,63 en 1985-86, 5,85 en 2005-06, 2,88 en 2025-26 ; `AVANTAGES_EPOQUE` ne sert plus que de repli avant 1977-78) multiplié par son **indiscipline** — les minutes de punition par match de ses patineurs habillés, relatives au régulier moyen de leur saison (colonne [7] de `SEASON_LANCERS`) — et le plus puni va au banc. Chaque mineure ouvre une fenêtre de deux minutes : l'avantage tire `AN_TIRS_MIN` par minute avec ses deux unités (trois attaquants et deux défenseurs rangés par création et finition, 65/35), le désavantage tire peu avec ses deux unités de quatre meilleures cotes défensives (60/40), et le premier but ferme la fenêtre. Le cinq contre cinq se joue sur les minutes qui restent. **Ce qui a été trouvé en mesurant** : un joueur d'avantage tirait deux fois, parce que son volume réel contient déjà ses tirs d'avantage — Bondra 2001-02 faisait 93 buts au lieu de 46 et l'erreur systématique de `check_feuilles.mjs` passait de 20 à 36 %. `PART_AN_TIRS` (35 % pour la première unité, 15 % pour la deuxième) retire cette part à forces égales, la pointe tire plus en avantage (`PART_LANCERS_D_AN`), le tireur d'avantage se tire sur la racine de son volume, et la création n'y compte qu'à moitié. **La finition d'avantage est réglée sur une mesure, plus sur un goût** : depuis que les shards portent les buts en avantage réels, `check_feuilles.mjs` compare, chez les mêmes patineurs à 40 matchs et plus, la part de leurs buts marqués en avantage simulée et réelle — `AN_QUALITE` = 1,35 les fait coïncider (**25,8 % contre 25,8 %** sur cinq ligues, 1543 patineurs). Mesuré sur cinq ligues : 28,5 lancers, 3,1 buts, 3,8 punitions par équipe par match, 24,7 % des buts de la ligue en avantage (0,77 par match), erreur systématique par joueur 20,1 % (identique à avant les unités spéciales), Datsyuk 2006-07 à 28 buts pour 27, Holmström 30 pour 30. Le +/- ne compte pas les buts en avantage (règle de la ligue). **Les shards portent les unités spéciales depuis `RATINGS_VERSION` 24** (Action en mode `full`, 8 septembre 2026) : `skater/summary` donne les buts et points en avantage et en désavantage (`ppg`, `ppp`, `shg`, `shp` sur chaque patineur), et `team/powerplay` donne par équipe les occasions et les buts en avantage depuis 1977-78 (bloc `an` du shard, que `rerateShard` conserve ; 48 saisons l'ont). Le moteur **les lit au lieu de deviner** : les unités d'avantage viennent des points en avantage, celles de désavantage des points en désavantage, la part d'avantage d'un joueur est ses buts en avantage sur ses buts (`PART_AN_TIRS` ne sert qu'à qui a moins de dix buts), et les occasions par saison viennent de `build_lancers.mjs`. Les sept saisons d'avant 1977-78 gardent le repli `AVANTAGES_EPOQUE`. Si tu changes quelque chose aux unités spéciales, la ligne « part des buts en avantage, joueurs » de `check_feuilles.mjs` est celle qui juge.

**Deux constantes sont libres : `SYN_ECHELLE`** (42) **et `BETA_CREATION`** (0,5, voir ci-dessus). `SYN_ECHELLE` Elle convertit un bonus de chimie ou un malus de zone (en points de cote) en facteur multiplicatif sur les buts attendus d'une unité, moitié par le volume moitié par la qualité. Tout le reste — `LANCERS_BASE`, `ALPHA_POSSESSION`, `K_DEFENSE`, `REF` — est mesuré. `LANCERS_BASE` et `CIBLE_PCT_TIR` sont réglés sur la *sortie* de `check_feuilles.mjs` (≈ 28,5 lancers et ≈ 3,1 buts par équipe par match), pas sur la moyenne brute des shards.

## Les séries se jouent match par match

**Chaque match de séries garde sa feuille**, et c'est la même simulation qu'avant : on ne jetait simplement pas ce que le moteur produisait déjà. `feuilleVierge()` ouvre un journal, `playGame` le remplit lancer par lancer — buts avec leur instant, leurs passeurs et le gardien battu, tirs par période, arrêts — et `playSeries` retourne les feuilles de tous les matchs. Les égalités de la feuille de match tiennent ici aussi : les buts d'un côté sont ceux du journal, et les tirs d'un côté valent les arrêts de l'autre plus les buts.

**Tes séries se regardent en direct, un match à la fois, et le tableau ne se dessine qu'après.** JP : *les séries, ça devrait être simulé un match à la fois, en plein écran, jeu par jeu, pour avoir un côté mystère et excitant*. `js/direct.js` ne décide de rien : `runPlayoffs` a déjà tout joué, et `diffuserSeries` REJOUE la feuille de chaque match du joueur dans le temps — l'horloge avance (×1, ×2 ou ×4 minutes de jeu par seconde, mémorisé), les tirs et les buts tombent à leur instant, l'horloge s'arrête une seconde sur un but, la fin de période et la fin du match sont des lignes du fil. Le fil met le plus récent en tête, donc rien ne défile. Le journal d'un match garde maintenant **chaque lancer** (`feuille.lancers` : côté, instant, tireur, gardien, but), donc le fil dit qui a tiré et qui a arrêté ; une feuille sans `lancers` (partie sauvegardée avant) retombe sur des arrêts datés au hasard, avec une graine sur la série et le match. Un but prend les couleurs du marqueur (bandeau, encre, liseré) et une bannière passe sur le tableau indicateur ; un arrêt est teinté à 9 % de la couleur du tireur. Vitesses ×½ à ×8, et « Enchaîner » (mémorisé) fait partir le match suivant tout seul. Après la série, un bilan (remportée ou éliminé, et « pendant ce temps » les autres séries de la ronde), puis la ronde suivante ; à la fin, ou si on ferme le direct, `dessinerTableauDesSeries` dessine le tableau complet comme avant. **Le mystère tient à ce seul ordre** : rien du tableau n'existe dans le DOM tant que le direct n'est pas fini.

**Chaque match de saison garde sa feuille, comme un match de séries.** `simulateLeague` ouvre un `feuilleVierge()` par match et la pose dans le calendrier (`jour[k].feuille`) et dans le journal de chaque équipe (`journal[n].feuille`). `compterFeuilles` (`js/sim.js`) cumule ce que des feuilles disent de chaque joueur — buts, passes, points ; matchs, victoires, tirs, arrêts, buts alloués d'un gardien — et redonne exactement les fiches simulées (vérifié : Gretzky 1984-85 83-87-170 des deux côtés). C'est ce qui permet trois choses : les **statistiques du jour** en pause de saison, le **sommaire de n'importe quel match** du calendrier ou de la page d'équipe (`data-sommaire`, un écouteur délégué dans `js/bilan.js`, `cleDeSommaire` retrouve la clé d'une feuille), et le **xième but**.

**La pause ouvre des onglets, et le xième but s'écrit entre parenthèses.** JP : *pause dans les matchs avec onglet de stats du match, et pause dans la saison ouvre les stats à ce point ; dans les matchs, mettre entre parenthèses xième but ou passe*. `ongletsDePause` (`js/direct.js`) : une barre plate au-dessus du fil, cachée tant que le temps court. En **séries**, Pause (bouton ou barre d'espace) arrête l'horloge où elle est et offre « Fil » et « Statistiques du match » — buts, tirs par période, punitions, avantage numérique, arrêts de chaque gardien, la liste des buts, tenus au fil des événements. En **saison**, la pause entre deux journées offre « Journée », « Classement » (les 32, complet) et « Statistiques » (pointeurs, buteurs, gardiens à cinq matchs, cumulés des feuilles jusqu'à ce jour) ; « Journée suivante » les rafraîchit, et l'état (le haut du classement) s'efface pour laisser la hauteur au tableau. Le fil d'un match dit **« Gretzky (12e but) (Kurri, 8e passe) »** : le compte des séries avant ce match (toutes les rondes d'avant, puis les matchs d'avant de la série), avancé but par but ; ton match du jour en saison liste ses buts avec le rang de chacun dans la saison, et le sommaire d'un match porte « (32e) » après le marqueur et chaque passeur. « 1er but », « 1re passe » : l'ordinal s'accorde.

**L'arbre des séries est un vrai tableau.** `arbreHtml` (`js/bilan.js`) part de la finale et remonte, pour chaque équipe, la série qu'elle a gagnée à la ronde d'avant — il ne suppose rien de l'ordre des séries. Sept colonnes (trois rondes de chaque côté, la finale et le champion au centre), chaque colonne répartit ses séries sur la hauteur pour que deux séries mères encadrent leur fille, et chaque nœud est une carte de pointage miniature qui mène au détail de sa série dessous. Sur téléphone l'arbre garde sa largeur et se balaie dans son propre conteneur : c'est un tableau, un des conteneurs prévus pour défiler en x.

**Le temps n'est pas simulé, il est attribué.** Le moteur ne modélise pas l'horloge ; quand un journal est ouvert, chaque lancer reçoit un instant tiré uniformément dans les 60 minutes (ou dans les 5 premières de la prolongation), et la feuille se lit dans l'ordre une fois les deux côtés fusionnés. Assez pour un sommaire crédible, et **aucune probabilité n'en dépend**.

**Les punitions vivent sur une seule ligne du temps.** Chaque côté tirait ses instants d'avantage dans son coin, et le direct montrait les deux clubs en avantage en même temps, des fenêtres qui n'en finissaient pas — JP : *ça dure tout le temps et les deux équipes compètent en avantage*. `jouerSoixanteMinutes` tire d'abord TOUTES les mineures du match (Poisson par équipe, comme avant), les mêle, puis les pose sur les soixante minutes sans chevauchement (partition uniforme du temps libre) et les joue dans l'ordre. Ce qui est joué ne change pas — même nombre de fenêtres, mêmes lancers, mêmes probabilités — seul l'instant change. Règles portées : deux minutes, le premier but de l'avantage ferme la fenêtre, un but en désavantage ne la ferme pas, le puni écope de ses minutes ; le cinq contre trois et le quatre contre quatre ne sont pas modélisés. La punition du journal porte `fin` et `butAN`, donc le direct annonce la fin de la mineure quand elle est allée au bout.

**L'horloge du direct descend, la feuille officielle monte.** JP : *le temps descend, pas monte, dans la simulation*. `tempsRestant` (`js/recit.js`) donne ce qu'il reste à la période, et c'est ce que le tableau indicateur et le fil du direct affichent (20:00 → 00:00, PROL. 05:00 → 00:00) ; `tempsDeJeu` garde le temps écoulé pour le sommaire, comme la feuille officielle de la ligue. Les deux conventions existent dans la vraie ligue, chacune à sa place.

**La saison se regarde jour par jour, et se vérifie après.** `simulateLeague` rend le `calendrier` (une journée par ronde, ses seize matchs) et chaque équipe tient un `journal` de ses matchs ; `diffuserSaison` (`js/direct.js`) rejoue les 82 journées — ton match du jour en gros, les quinze autres en fil, le classement recalculé du jour — à ×1, ×2, ×4 ou ×8 journées par seconde, et le bilan ne se dessine qu'après ou dès qu'on passe à la fin. **La pause tombe entre deux journées** (JP : *pause possible during season between games*) : le bouton « Pause » ou la barre d'espace arrête le temps une fois la journée dessinée entière, « Reprendre » repart, et « Journée suivante », visible seulement en pause, avance d'un jour — la classe `en-pause` sur `#liveModal` porte l'état. Le bilan porte le **récit de la saison** (`recitDeSaison`, `js/recit.js` : la fiche et le rang, le départ, les séquences, les soirs qu'on retient, les vedettes, le gardien, l'infirmerie, tiré sur une graine de la saison), le calendrier consultable journée par journée, et le classement dont chaque rangée ouvre l'équipe. Rien n'est inventé : seulement la tournure, et le récit ne décide de rien.

**Le bilan est un tableau de bord à onglets, pas une longue page.** JP : *better season tabs for information instead of long page, like a manager game*. Le pointage, la bande des six chiffres et les trois boutons (séries, copier, nouvelle partie) restent en tête ; `ONGLETS_BILAN` (`js/game.js`) ouvre un volet à la fois — Bilan (la note, le récit, les forces, l'infirmerie), Classement, Calendrier, Statistiques, Alignement — et l'onglet **Séries** n'apparaît qu'une fois les séries jouées, quand `dessinerTableauDesSeries` le révèle et l'ouvre. Tous les volets sont dans le DOM (les palmarès restent construits onglet par onglet), seul `hidden` change, donc le test de fumée compte toujours ses 23 `.rrow`. La barre d'onglets est collée sous la barre du haut (`.result-tabs`, `position: sticky`), défile en x sur téléphone et garde l'onglet ouvert en vue en déplaçant la barre, jamais la page. **`--topbar-h` est mesurée** par un `ResizeObserver` sur `.topbar` (84 px sur téléphone, 55 px dès 680 px) : la constante à 88 px laissait un jour de 33 px sous tout ce qui s'y colle en grand écran.

**Les statistiques des séries sont tenues à part.** Le moteur n'a qu'un jeu de compteurs `sim*` ; plutôt qu'en câbler un second dans chaque lancer, `photoStats` photographie les fiches et les compteurs d'équipe avant les séries, `playSeries(A, B, true)` laisse les séries s'y inscrire, et `separerSeries` rend à la saison ses chiffres en posant la différence dans `p.po` (et `t.po`, `t.poJournal`). `statsSim(p, 'saison' | 'series')` (`js/game.js`) lit l'un ou l'autre ; les palmarès des séries, les pages d'équipe en séries et les fiches du sommaire passent par là.

**`js/recit.js` met des mots, jamais des buts.** Si une phrase et la feuille se contredisent, c'est la phrase qui est fausse. La tournure suit le marqueur (un défenseur décoche de la ligne bleue, un franc-tireur du cercle), ses traits (💣 Lancer et ⚡ Vitesse sont exactement ce que le sommaire ne dit pas), le nombre de passes et le moment. Le tirage est **déterministe** sur le nom et l'instant : rouvrir un sommaire redonne le même récit, parce qu'un texte qui change quand on le relit fait douter du reste.

**Les statistiques de la ligue** sortent des rosters à la fin de la saison : pointeurs, buteurs, passeurs, différentiel, et les gardiens au pourcentage d'arrêts, à la moyenne et aux victoires. Les deux premiers palmarès de gardiens exigent 25 départs, comme la vraie ligue. Chaque équipe historique porte son nom complet et pointe vers sa saison sur Hockey-Reference (`teamSeasonUrl`, adresse vérifiée, voir plus haut).

## La chimie et les archétypes se lisent dans la fiche, pas dans la cote

**C'était le dernier endroit du moteur qui raisonnait sur une cote.** La chimie lisait l'archétype, et l'archétype comparait `o`, `d` et `r` à des seuils : un trio pouvait donc basculer en « conflit de rôles » parce que trois z-scores franchissaient ensemble une frontière, sans qu'aucun de ces joueurs n'ait le même profil de production. Les deux se calculent maintenant sur les vraies statistiques, en écart au régulier moyen de la saison du joueur.

**Le penchant d'un attaquant** est la part de ses points qui vient de ses buts, moins celle de sa ligue (mesurée, ≈ 0,42 et remarquablement stable sur 55 ans). Positif = il finit, négatif = il sert.

**Deux nombres décident d'un trio**, et ils disent ce que le hockey dit :

| | |
|---|---|
| **écart** | entre le plus tireur et le plus passeur — un trio a besoin de quelqu'un qui finit *et* de quelqu'un qui sert |
| **excès** | à quel point tout le trio penche du même bord — trois francs-tireurs se disputent la même rondelle |

Mesuré avec de vrais joueurs (`node scripts/check_chimie.mjs`) : deux francs-tireurs et un fabricant **+8,5**, un franc-tireur et deux fabricants +7,7, trois francs-tireurs **−2,2**, trois fabricants **−4,9**, trois joueurs moyens +2,0.

**La mesure est sans échelle** — elle ne regarde que l'équilibre, jamais le niveau. C'est délibéré : le moteur modélise déjà le volume de tirs et la finition de chacun, donc récompenser un trio parce qu'il produit beaucoup le compterait deux fois. Seul le *poids* de l'effet suit la production, parce qu'organiser les rôles compte davantage quand il y a de l'offensive à organiser.

**La chimie de trio ne touche que l'attaque.** La défensive passe par la cote `d` et par les traits, où elle est mesurée ; la faire agir ici aussi reviendrait à la compter deux fois. Chez les défenseurs, en revanche, la composition a un effet défensif réel et mesuré : une paire dont les deux montent laisse plus de retours.

**L'archétype suit les mêmes quatre axes**, tous disponibles depuis 1970-71 : production, penchant, volume de lancers, minutes de punition — chacun divisé par le régulier moyen de sa saison. `archetypeKey(p)` ne prend plus de cotes en second argument, il n'y en a plus à passer.

**Ce que l'archétype décrit, c'est la SAISON, pas la légende.** Gretzky 1981-82 (92 buts) sort franc-tireur ; Gretzky 1985-86 (163 passes) sort fabricant d'élite. C'est correct : la réputation 🪄 Créateur est là pour dire ce que le joueur *était*, l'archétype dit ce qu'il *a fait cette année-là*.

**Ce que ça ne mesure pas, et c'est assumé** : rien ici ne voit la défensive d'un attaquant, parce que le sommaire ne la porte pas avant 1998. Un attaquant peu productif et peu puni sort « complet » plutôt que « défensif » — c'est la meilleure lecture possible de ses colonnes, et le trait Selke existe pour les cas où le vote sait ce que le sommaire ignore.

## Les traits

**Un trait n'existe que là où le sommaire est aveugle.** C'est la règle qui tient `js/traits.js`, et elle décide de tout le reste. Le moteur lit déjà les lancers, les buts par lancer, le pourcentage d'arrêts, le +/- et les matchs joués — un trait « franc-tireur » ou « homme de fer » ne ferait que recompter ce que le moteur compte déjà, et il le compterait moins bien. Ce qui manque au sommaire, c'est le reste : qui défendait vraiment, qui patinait vite, qui avait le lancer qu'on craignait, qui menait un vestiaire.

**Deux étages, et rien d'autre.**

Les **votés** (`data/trophees.js`) — scrutins publics, population complète, une saison à la fois :

| trait | effet | quand |
|---|---|---|
| 🛡️ Selke | moins de buts alloués | saison et séries |
| 🧱 Norris | idem, pour un défenseur | saison et séries |
| 🥅 Vezina | facteur sur chaque lancer qu'il voit | saison et séries |
| 🏆 Conn Smythe | bonus offensif, ou un gardien plus dur à battre | **séries seulement** |

Les **réputations** (`data/reputations.js`) — le consensus des amateurs, sur toute une carrière, **179 joueurs marquants** :

| trait | effet | porte sur |
|---|---|---|
| ⚡ Vitesse | il obtient plus de lancers | le joueur |
| 💣 Lancer | ses lancers entrent plus souvent | le joueur |
| 🪄 Créateur | son équipe finit mieux | l'équipe |
| 🧭 Meneur | prolongation et séries | l'équipe |
| 🥊 Colosse | l'adversaire finit moins bien | l'équipe |
| 🧤 Voleur | le gardien laisse passer moins | l'équipe |

**🧤 Voleur rachète le trou du Vezina.** Avant 1981-82 ce trophée n'était pas un vote, donc Dryden, Parent, Tony Esposito et Giacomin n'avaient aucun trait — alors qu'ils sont exactement les gardiens dont on se souvient. La réputation couvre toutes les époques et comble ça.

Un vote dit ce qu'une **saison** valait ; une réputation dit ce qu'un **joueur** était. Ni l'un ni l'autre n'est dans le sommaire, et c'est pour ça qu'ils existent.

**La règle qui garde `data/reputations.js` honnête : on n'y met que ce qu'un amateur affirmerait sans hésiter.** Pas « il était bon » — ça, les colonnes le disent. C'est le seul endroit du dépôt qui repose sur du jugement plutôt que sur une mesure, et le contrepoids est double : les effets sont petits, et `check_traits.mjs` vérifie que **chaque nom existe dans les shards**, parce qu'un nom mal orthographié serait un trait mort dont personne ne saurait rien. Une réputation de vitesse s'éteint après 34 ans quand la date de naissance est connue.

**Un trait appartient au joueur, pas à sa case.** Il rend partout dans l'alignement : un lauréat du Selke au quatrième trio défend aussi bien qu'au premier. C'est le malus de zone qui punit de mal placer un joueur, et il le fait déjà — faire porter la punition deux fois reviendrait à dire qu'un Selke oublie comment défendre quand on l'écrit sur la troisième ligne de la feuille. Seule condition : être **habillé**. Un trait sur un réserviste ne compte pas, il regarde le match. `check_traits.mjs` le vérifie en inversant l'ordre de l'alignement : le facteur doit être identique au dix-millième.

**Les deux étages n'ont pas la même rareté, et c'est voulu.** Mesuré : **1,02 %** des 36 820 joueurs-saisons portent un trait voté, **8,8 %** une réputation, **9,8 %** au total. Un vote est décerné une fois par saison ; une réputation dure une carrière, et « les joueurs marquants de 55 saisons » se compte en centaines. Ne pas en avoir veut dire « rien de particulier », ce qui est vrai — contrairement à une cote, qui doit exister pour tout le monde et ment donc quand elle est inconnue.

**Les canaux d'équipe saturent, et c'est ce qui empêche les traits de devenir un deuxième axe d'empilement.** Mesuré : le meilleur alignement légal sous le plafond ramasse **25 traits** contre 9 au Canadien de 1976-77 — l'optimiseur choisit les joueurs les mieux cotés, qui sont exactement les joueurs marquants. Sans borne, sa Coupe passait à 67 %, au-dessus de la meilleure vraie équipe de l'histoire. Le quatrième Norris d'un vestiaire n'apporte pas autant que le premier : on ne défend pas deux fois la même rondelle. Les canaux d'**équipe** sont donc bornés (`BORNES` dans `js/traits.js`) ; ceux de **joueur** — vitesse, lancer — ne le sont pas, puisqu'ils portent sur les lancers de leur seul porteur et ne s'additionnent pas.

**Les magnitudes suivent la longueur de la liste.** Passer de 86 à 215 entrées a fait grimper l'effet d'une grande équipe de +3,9 à **+5,5 victoires sans qu'on touche à un seul nombre** — une équipe des années Lemieux porte treize traits, pas quatre. Vitesse et lancer sont donc redescendus de 1,060 et 1,050 à 1,035 et 1,030. **Allonger `data/reputations.js` sans refaire tourner `check_traits.mjs` gonflerait les grandes équipes en silence** : c'est le piège de ce fichier-là.

**Effet mesuré : +6,1 buts marqués, −8,4 buts alloués et +3,1 victoires** (avec les unités spéciales, où un Selke ou un Norris défend aussi le désavantage ; c'était +14,0 / −3,3 / +3,4 avant) pour une vraie équipe qui en porte onze à treize (les Penguins de Lemieux, les Red Wings de 2002), la même équipe rejouée sans. Les victoires sont bruitées ; les deux colonnes de buts sont le signal propre — les votés pèsent sur les buts alloués, la vitesse et le lancer sur les buts marqués. Un trait doit se voir sans décider la saison à lui seul.

**Deux limites d'époque, écrites pour qu'on ne les redécouvre pas.** Le Selke naît en 1977-78 : sept saisons n'ont aucun attaquant défensif décoré, et rien ne peut le corriger puisque le vote n'a pas eu lieu. Et le Vezina d'avant 1981-82 n'était **pas un vote** — il allait aux gardiens du club ayant alloué le moins de buts, ce qui récompense la brigade autant que le gardien, et le moteur mesure déjà cette brigade. Ces onze saisons sont donc écartées du trait même si `data/trophees.js` les porte.

**Pourquoi les traits agissent en propre plutôt que par la cote `d`.** `K_DEFENSE` est mesuré à 0,04 par écart-type d'alignement, donc un point de cote défensive vaut moins d'un pour cent de probabilité de but : faire passer un Selke par sa cote `d` lui ferait sauver un but par saison, invisible. C'est justement l'aveu du sommaire — le +/- ne voit pas ce que le vote voit.

**L'unité qui tire se tire au poids offensif, celle qui l'accompagne à la présence.** À chaque lancer, le trio ET la paire se tiraient au poids offensif (présence × volume × chimie), et les cinq étaient crédités du but : une première paire qui tire beaucoup était « sur la glace » pour la majorité des buts pour, en récoltait les passes et la création, et ne payait que sa part de présence sur les buts contre — Bourque et Potvin à +144 sur une équipe à +150 (JP : *+140 quand t'as genre 80 points c'est cave en sale*), les défenseurs à +22 % de passes. Maintenant on tire d'abord si le lancer vient de la pointe (`PART_LANCERS_D`), l'unité qui tire au poids offensif, l'autre à la présence (`choisirPresence`). La comptabilité du +/- se vérifie : la somme des +/- des 18 patineurs vaut 0,75 × 5 × le différentiel de l'équipe, exactement la part hors avantage numérique — le +/- ne compte pas les buts en avantage, règle de la ligue. Ce qui reste d'ampleur au +/- individuel est celle du différentiel de l'équipe, et l'écart des différentiels simulés sur une vraie saison entière rejouée (2021-22, 1990-91, 1980-81, 2008-09) n'est pas plus large que le vrai.

**La défense se joue présence par présence.** Le moteur tire l'unité défensive adverse à chaque lancer, au prorata de son temps de glace seul (jamais de son volume de tirs : une unité ne défend pas plus souvent parce qu'elle attaque plus). C'est ce qui rend un quatrième trio poreux coûteux pendant ses propres treize minutes, et c'est ce qui donne au +/- des joueurs qui étaient vraiment sur la glace. **Les traits, eux, ne passent pas par là** — ils sont attachés au joueur et agissent sur tout le match.

## Recalibrer la simulation

Repères actuels, de vrais joueurs-saisons d'une même cote, moyenne sur 12 essais (`node scripts/calibrate_sim.mjs`) :

| Cote | Fiche | BP-BC |
|---|---|---|
| 50 | 6-71-5 | 108-367 |
| 60 | 23-53-5 | 194-317 |
| 70 | 43-35-4 | 279-275 |
| 80 | 41-36-5 | 236-239 |
| 90 | 52-29-2 | 262-218 |
| 99 | 68-14-0 | 300-150 |

La marche à 80 est l'artefact que le paragraphe suivant décrit : 23 joueurs à 80 franchissent ensemble le seuil « Top 3 » (78), donc les trios 2 à 4 sont tous « sous leur zone ». Elle était déjà là avant les bornes de possession (34-42 mesuré sur l'ancien moteur) et n'apparaît sur aucune vraie équipe. Le palier 99 est passé de 69 à 64 victoires avec `FINITION_MAX` : 23 joueurs de 99 sont exactement l'addition de pourcentages de tir que la borne refuse.

Le banc **ne peut plus être synthétique**. L'ancienne table alignait 23 joueurs inventés `{o:r, d:r, …}` ; le moteur par événements se nourrit des vraies statistiques — lancers, buts par lancer, pourcentage d'arrêts — que des joueurs inventés n'ont pas, et un tel banc joue comme 23 rappels de la ligue mineure quelle que soit sa cote. On tire donc de vrais joueurs-saisons dont la cote est celle du palier.

Il reste dégénéré par nature : 23 joueurs de même calibre franchissent tous ensemble les seuils de zone, ce qui fabrique des marches artificielles.

**Le vrai test de monotonie est ailleurs.** `node scripts/check_monotonie.mjs` range les 1395 vraies équipes-saisons par force, les aligne avec `autoRoster` et les fait jouer. C'est ce test qui fait autorité — améliorer ses joueurs ne doit jamais rendre l'équipe pire. Il suit maintenant le réel de très près :

| décile | victoires simulées | vraies victoires |
|---|---|---|
| 1 | 27,1 | 27,5 |
| 5 | 41,7 | 42,9 |
| 10 | 51,0 | 56,3 |

(Remesuré après le partage des départs des gardiens : monotone sur les dix déciles ; c'était 28,1 / 42,0 / 52,0 après `RATINGS_VERSION` 25 et le centre-d'abord d'`autoRoster`, et 27,6 / 42,9 / 52,3 avant.)

**Le plafond du jeu se mesure en victoires et en Coupes, pas en indice.** `node scripts/check_plafond.mjs` (avec les unités spéciales) : le meilleur alignement légal atteignable sous le plafond (cueillette libre sur 55 saisons) fait **64,3-17,3** en ligue et gagne la Coupe 1 fois sur 3 ; le Canadien de 1976-77, meilleure vraie équipe de l'histoire, fait 60,7-18,3 et 1 fois sur 3 (3 ligues chacun, donc du bruit pur sur les Coupes — il en faut 40 pour conclure). Les deux se tiennent, et l'ordre est le bon : dominer est possible, le 82-0 ne l'est pas, et la Coupe reste un pari. **Les réputations ont poussé ces deux chiffres vers le haut** — de 41 et 44 % avant elles — parce qu'elles favorisent exactement les joueurs marquants dont les grandes équipes sont faites. C'est voulu ; si la Coupe devient trop facile, le curseur est dans `EFFET` et `BORNES`. L'ancien moteur donnait la Coupe à 99 % dès le niveau 80.

`node scripts/mock_zones.mjs` garde le repère sur l'indice de valeur : le meilleur alignement légal est à **65,0**, exactement le Canadien de 1976-77, contre 65,5 pour les Bruins de 1970-71. Sans malus de zone il serait à 79,5. La valeur bâtie sur les statistiques a resserré cet écart d'elle-même — l'ancienne cote plaçait l'empilement à 69,3, au-dessus de toutes les vraies équipes.

`ZONE_PEN_SOUS` et `ZONE_PEN_MAX` ne tirent pas sur la même chose. Sur un alignement empilé la pénalité sature, donc seul le plafond mord ; sur une vraie équipe elle reste dessous, donc seul le coefficient mord. Un coefficient bas avec un plafond haut ferme donc l'empilement sans toucher aux vraies équipes — monter le coefficient punit les deux.

**Les zones sont calibrées sur la réalité.** Une vraie équipe aligne 6 attaquants de top 6, 4 défenseurs de top 4 et 1 partant. `ZONE_THRESHOLDS` est réglé pour que la ligue y atterrisse **en moyenne** — 6,5 / 3,9 / 1,05 mesurés sur les 1396 équipes-saisons — et non au plancher : le Canadien de 1976-77 en a neuf, Detroit la même année en a trois. Si tu retouches ces seuils, revérifie cette distribution avant tout le reste.

Si tu changes `POIDS_TRIO`, `POIDS_PAIRE`, `SYN_ECHELLE`, `K_DEFENSE`, `REF`, la courbe du clutch, `ZONE_THRESHOLDS` ou les constantes `ZONE_PEN_*`, refais tourner les quatre et reporte-les ici et dans `PLAN.md` :

```bash
node scripts/check_graine.mjs        # la même graine rejoue la même saison
LIGUES=5 node scripts/check_feuilles.mjs   # les égalités et les repères d'époque
node scripts/calibrate_sim.mjs       # la table par palier de cote
node scripts/check_monotonie.mjs     # monotone sur dix déciles
node scripts/check_plafond.mjs       # victoires et Coupes au plafond
node scripts/check_tireurs.mjs       # tireurs sans zones ~52, alignement parfait ~68-70
node scripts/check_traits.mjs        # les traits restent rares et se voient
```

**Ne règle jamais `LANCERS_BASE` ni `CIBLE_PCT_TIR` sur une seule exécution de `check_feuilles.mjs`.** Le script tire 32 équipes au hasard dans 55 saisons, ce qui fait varier le repère de ±0,15 but. En élargissant les réputations j'ai lu 3,19 buts sur cinq exécutions, conclu à une inflation de 3 %, rabaissé les deux constantes — puis relu 2,99. Les deux lectures étaient du bruit : sur cinq ligues moyennées (`LIGUES=5`), les valeurs d'origine retombent sur la cible et n'ont pas eu à bouger.

**Les chances de Coupe demandent 40 ligues, pas 6.** Une Coupe est un événement composé de quatre séries : à 6 ligues j'ai lu 33 %, à 16 ligues 38 %, à 16 autres 75 %. À 40 ligues c'est stable à ±8 points. Ne conclus rien d'un `ESSAIS=6`.

La partie réelle se joue dans `simulateLeague` : 32 équipes (le joueur + 31 vraies équipes historiques alignées automatiquement), 82 rondes d'appariements, 1 312 matchs, avec chance, continuité des trios et blessures au prorata des matchs vraiment joués. **Les blessures s'appliquent aussi en séries** — c'est ce que l'ancien moteur sautait, et pourquoi la Coupe se gagnait à tout coup.

## Tester

Sert la page — `python3 -m http.server 8000` — et ouvre `localhost:8000`. Les modules ES ne fonctionnent pas en `file://`.

S'il y a un runner de navigateur disponible (Playwright), `node scripts/smoke.mjs http://localhost:8000` fait le test de fumée à 390 px :

1. La page démarre, `#game` devient visible
2. Auto-draft conscient du budget : à chaque tour il lit le plafond restant, calcule ce qu'il peut mettre sur ce choix sans passer sous le plancher pour les cases suivantes, et clique le premier `.pcard .btn-sign:not([disabled])` qui tient dans ce budget. Sinon il relance (passer, autre équipe, autre année) ; en dernier recours il clique `#freeCapBtn`, le bouton de la bande de secours qui retire le plus gros contrat
3. `#mainBtn` devient actif
4. Cliquer : la saison se rejoue jour par jour dans `#liveModal` (`.live-fin` passe à la fin, `.live-suite` ouvre le bilan), puis `.result .score` affiche une fiche et `.rrow` en compte 23
5. « Rejouer la saison » (`#replayBtn`) rejoue le même alignement contre les mêmes clubs, puis l'historique (`.lb-replay`) relit un alignement et repart une saison
6. Le même parcours en tirage Loto (`#rrL` relance quand rien ne tient dans le budget)
7. Zéro erreur console (les portraits refusés ne sont demandés qu'une fois : `PORTRAITS_ABSENTS`)

L'Action `verifier.yml` fait tout ça à chaque PR, plus `check_graine.mjs` et `check_feuilles.mjs` sur une ligue. Les scripts de calibration (monotonie, plafond, tireurs) restent à lancer à la main.

## Ce qu'il ne faut pas faire

- Ne scrape pas hockey-reference ni hockeydb. Leurs conditions l'interdisent. L'API de la LNH est publique et couvre 1917 à aujourd'hui.
- N'ajoute pas de dépendance npm sans une bonne raison écrite dans `PLAN.md`.
- Ne commite pas `data/seasons/*.json` à la main — c'est le job du script et de l'Action.
- Ne mets pas les cotes cachées dans le DOM avant la simulation. Un joueur curieux qui ouvre l'inspecteur ne devrait pas pouvoir les lire. (Actuellement elles sont dans l'objet JS en mémoire — voir PLAN.md tâche J4.)
