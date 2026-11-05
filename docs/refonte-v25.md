# V25 — La suite, pour aujourd'hui : le moteur, les cartes, les histoires, l'interface

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec la commande `/refonte` (5 nov. 2026) : quatre inventaires en lecture seule (le moteur, les cartes et l'économie, les événements et les choix, l'interface), puis ce devis. Jugé par `/revue-design` le 5 nov. 2026 (À REPRENDRE, corrigé le jour même ; les huit réponses de JP au bas). **Rien n'est codé** : la tranche A1 vient ensuite.

La V24 (docs/refonte-v24.md, 3 nov. : le banc qui s'active, une horloge à la place du séjour et du repos, seize adjoints en quatre familles de conditions) reste le devis des **règles** des adjoints ; la V25 ne les touche pas : elle leur donne la grammaire d'effet et la carte de tout le jeu, et ce que la V24 décide se code dans cette grammaire-là. Les deux se livrent dans l'ordre que JP choisit.

## 1. Ce que JP a dit

JP, 5 nov. 2026 :
- *Imagine que ça fait cinq ans que le jeu est sorti et que tu travailles sur une suite, même jeu, mais en mieux : mécaniques, UI, design, équilibre, etc.*
- *Les modes de jeux doivent être séparés encore, c'est le moteur et les cartes et interface, événements et cie qui doivent changer.*
- *En gros, tu fais la version Windows d'un jeu Flash Newgrounds.*
- *Je veux que tu penses comme une suite complète, pour aujourd'hui, pas un genre de weird wet dream, c'est pour penser une refonte.*

Et ce qui pèse encore, des semaines d'avant : *ça fait une bonne vingtaine de fois qu'on retravaille le UI et retourne le même* (4 nov.) ; *les UI et les mécaniques font un peu « cheap »* (2 nov.) ; *le roguelike, il est pas facile à rendre le fun et balancé* (2 nov.) ; *garder les cartes actuelles du jeu, pas les refondre* (4 nov., deux fois).

**La taille est décidée** : une suite. Ce devis ne la négocie pas à la baisse ; il dit ce qui part, couche par couche, et ce qui reste avec sa raison.

## 2. Ce que le joueur ressent

**Le fantasme** : c'est le même jeu, celui que je connais, mais fini. Chaque mode reste chez lui (le 82-0, le Rogue, Sur table, l'exhibition, Sur glace) ; ce qui change, c'est ce qu'ils partagent, et je le sens partout à la fois : le match se joue mieux et se lit mieux, une carte est une carte où que je sois, une histoire ne revient jamais deux fois dans une run et parle de mes joueurs, et l'écran parle une seule langue d'un mode à l'autre.

**Le pic** : la Coupe en Rogue, un match de séries vu en direct, la carte Holo au pack. Ils ne bougent pas ; ils arrêtent d'être entourés de choses qui les diluent. **Le jour ordinaire** reste rapide : un soir du Rogue en moins de 400 ms, un match du 82-0 en un geste.

**Les boucles nourries** : le soir (le moteur et le banc qui s'allume), la semaine (une histoire vraie), la saison (la courbe du coach), la run (la collection), la carrière (le prestige). Aucune boucle neuve : les cinq existent, chacune porte aujourd'hui trop de systèmes pour qu'on sente lequel compte.

## 3. L'inventaire : ce qui existe, en chiffres

Quatre inventaires (5 nov. 2026), relus dans le code. Les noms sont ceux du dépôt.

### Le moteur (js/sim.js, 9 029 lignes ; js/game.js, 2 688)

| Part | Lignes | Ce que c'est |
|---|---|---|
| Moteur pur | ≈ 4 800 (53 %) | le hasard, les zones, les lignes, les jambes, les blessures, le lancer, le gardien, les punitions, les unités spéciales, la ligue au jour le jour, les séries |
| L'alignement et l'IA partagés | ≈ 700 (8 %) | les 23 cases, `autoRoster`, `trioAuMieux` |
| Le Rogue et l'affichage logés là | ≈ 3 500 (39 %) | les moments, les situations, les mutations, les gros matchs, le duel, les pouvoirs et les adjoints posés, l'expérience, les séjours, les suivis, les mots des totaux |

- `playGame` est un aiguillage de **quatre chemins** : `jouerSoixanteMinutes` (le soir ordinaire), `jouerEnPeriodes` (le soir en Rogue), `jouerDuel` (le gros match en Rogue), et le gros match du 82-0 avec `apres40De` et `effetEntracte` en ligne. Avant même de jouer, il pose `persoSeries`, `momentsDuSoir`, `poserLancees`, `poserLesPlans`, `poserLesAdjoints` ; le 82-0 les appelle pour rien.
- sim.js importe 15 modules, dont 7 du Rogue pur (combat, rarete, coachs, pouvoirs, adjoints, dossiers, vie-gm, arcs). Vingt-six commentaires de pierre tombale (« est parti »).
- **Trois modes, trois copies** : trois générateurs ou hachages (`generateur` de sim.js et de physique.js, `hacherMise`, `entierDeGraine`, `hache`) ; trois prolongations et fusillades (`butProlongation`, `finirMatch` de table.js, `commencerFusillade` de physique.js) ; trois modèles de punitions (`tirageDe`, `punir` de table.js, `punir` de physique.js) ; trois lectures de la force d'un joueur (`teamStrength` et `profilMatch`, les `*RelDe` de Sur table, `cote20` de Sur glace).
- L'affichage vit dans le moteur : `lectureDuMatch` (appelé des centaines de fois par js/impact.js), `CADRE_DU_MATCH`, `motsDEffet`, `totauxDuSoir`, `motsDesTotaux`, `motCourbe`, `penaliteAffichee`, `motPenalite`.
- Ce qui tient : le noyau du lancer a une seule source (`profilMatch`, `jouerCote`, `facteurGardienDe`, `tirageDe`), le hasard est un (`hasard`, `deDuJour`), les feuilles se ferment par construction (`compterFeuilles`), et plus de trente juges le prouvent (MOTEUR.md § 7).

### Les cartes et l'économie

- **Six squelettes de carte** : `cartonHtml` et `carteCouchee` (le joueur), `carteHtml` en carte de jeu, `carteHtml` en joueur offert, `optionHtml` (la tuile de choix, js/gerant.js), `paquetHtml`, la pochette `.pk-sachet` ; plus deux dessins mineurs (`.main-adverse-carte`, la plaque `.ej-coach-tete` du coach, qui n'a **aucun dessin de carte**).
- **Huit grammaires d'effet** : les canaux multiplicatifs `{ volume, finition, defense, discipline, robustesse, blessure, energie, F }` avec `adv` ; les champs à part des consommables (`gestes`, `xp`, `echange`, `offres`) ; les `MUTATIONS` ; les paliers de badges des éditions (`VARIANTE_PALIERS`) ; le relais `{ cote, canal, valeur }` ; les prédicats à jetons (`REGLES_DU_COACH.lit`) ; les drapeaux du méta (`DEBLOCAGES`, `JALONS`) ; et l'affichage, toujours écrit à côté de l'effet (`dit`, `texte`, `bon`, `prix`, `mots[{txt, bon}]`), sauf dans `optionHtml` qui l'extrait du texte par expression régulière (`grosChiffre`). Le déclenchement a **trois formes** : `quand(e)`, `signal.quand(e)`, `si`.
- **Cinq vocabulaires de rang** pour la même idée : `RARETES` (4 : commune, peu, rare, légendaire), `EDITIONS` et `NOM_VARIANTE` (5 : Base, Cadre, Hors-cadre, Or, Holo), `NIVEAUX` et `NOMS_NIV` (5 : Soutien → Phénomène), `MAITRISE` (5, le coach) ; **trois tables de bornes** en victoires (`MAX_V` dans un juge cassé, `BORNE_NIV`, `BORNE_V`) ; **quatre ponts** (`RARETE_NIV`, `RARETE_POUVOIR`, `edition()`, `PALIERS_RARETE`) ; quatre tables de cotes de tirage.
- **Onze systèmes de progression** se superposent : les éditions, le niveau du joueur, les cartes de la banque, la main du deck (`PALIERS_CARTES`, `SORTES_DECK`), les pouvoirs et talents, les adjoints (séjour, repos, relais, salaire), la règle du coach, la maîtrise, les galons, le méta (déblocages, crans, jalons, prestiges, missions), et `CARTES_MATCH` pour l'adversaire seul. Cinq se lisent l'un l'autre ; les isolés : les galons (affichage seul), `effetCarte` (la recrue seulement), `CARTES_MATCH`, `rareteDeSalaire` et `PALIERS_RARETE` (morts), `PARTIS` (héritage).
- `scripts/check_cartes.mjs` est **cassé** (il importe `CARTES` de sim.js, qui n'existe plus) ; il n'est pas au CI.
- L'économie tient : une seule caisse (`jetonsDe`), recomptée des décisions ; les médailles et le prestige font une méta lisible (docs/revue-rogue-2026-11.md). Ce qui reste ouvert là-bas : le choix de pack vaut 0 V pour le robot (§ 2.6), le coach plafonne dès la saison 2 ou 3 (§ 2.4), `check_profondeur` est rouge à +4,5 V pour un seuil de 5 (§ 2.1).

### Les événements, les histoires, les choix

- **Treize histoires** dans `DOSSIERS` (js/dossiers.js), 17 voix, 8 groupes de répliques ; `mesure_rythme` : trou médian de 10 matchs, 8,7 histoires par saison. Les répliques (`mots`) sont fixes et ne nomment pas le joueur ; aucune histoire ne lit la vraie saison d'un joueur (les shards l'ont) ; seul `AVANT_GROS.irl` cite de vrais faits, écrits en dur.
- **Trois chemins de choix** à la forme proche et aux voies séparées : le dossier (`moment.famille`), le fil (`CHOIX_DES_FILS`, `engagerSuivi`), l'avant-match (`d.avant`, sa propre branche dans `appliquerDecision` et `pariDeDecision`). Deux promesses suivies en double (`suivisEnCours` et `verdictsDeLaSemaine`).
- **Une deuxième banque vivante dans sim.js**, hors de `DOSSIERS` : `AVANT_GROS` (12), `SITUATIONS` (12, aux `JOURS_SITUATIONS`), `ENTRACTES` (≈ 23), `INCIDENTS` (8), `AJUSTEMENTS` (11, en séries). La V22 disait « une seule source » ; il y en a deux.
- Les faits du lundi (`faitsDuLundi`, `faitsDesJoueurs`, `faitsDuProprio`) sont écrits dans js/saison.js, l'écran, pas dans un module de faits ; les mots d'une réponse (`motsDuDossier`, `motsConcrets`, `coinDe`, `icoDe`) aussi.
- **Des restes de la V22** : la machine d'arcs est vide (`ARCS = {}`) mais `episodesDuMatin` et `faitsDuMatin` tournent chaque matin pour rien ; trois familles mortes dans js/verdicts.js ; les clés mortes `mutation`, `ensuite`, `enjeu`, `trou`, `monte` dans `effetDeMoment` ; un `m.genre === 'courriel'` ; des branches `plafond`, `soin`, `si`, `{sal}`, `{apres}` du dossier sans contenu ; la réplique du butin (`MOTS_DES_SCENES.butin`) qui promet un adjoint que le butin ne donne plus.

### L'interface (style.css, 7 402 lignes ; index.html, 525)

| Part | Lignes | |
|---|---|---|
| Les jetons et les polices | ≈ 290 | `check_css` vert : 0 px, 0 couleur en dur |
| Les composants partagés (coquille, briques, menu, fiche) | ≈ 1 130 | |
| Le carton de collection | 1 880 | dont 1 220 pour les 55 séries |
| Le plateau du Rogue (`.pl-*`) | 127 | |
| Les sections par écran | ≈ 4 700 (64 %) | 6a le club 752, 6c les choix 539, 10 Sur table 507, 5 l'effectif 470, 6b le match 393, 7 la ligue 365, 8 la collection 370… |

- **Soixante-douze surcharges `body.mode-rogue`** : 24 pour les Lignes (`#rosterBoard.en-cartes .line / .slot`), 13 pour la Boutique (`.pk-rayon-debut .pk-tuile`), 17 pour l'habillage (l. 310-338 : `.seg`, `.stat-tab`, `.ct-vue`, `.inv-filtre`, `.hub-chips` repeints en jetons, onze titres posés en bandeau). L'en-tête du plateau dit « rien ici ne surcharge une classe du 82-0 ».
- **Les familles de composants pour la même idée** : 9 onglets (`.navtab`, `.soustab`, `.stat-tab`, `.inv-onglet`, `.ct-vue`, `.eq-onglets`, `.hub-onglets`, `.live-onglets`, `.pl-jeton`), 9 segments et filtres, 8 boutons, plus de 14 panneaux, 13 tableaux, 9 modales et feuilles, 4 toasts, 13 jauges. Une seule famille est une grammaire (`.pl-*`) ; elle fait 12 fonctions d'une ligne, appelées 45 fois, presque toutes dans js/saison.js (53 fonctions de rendu, 131 `class="hub-`).
- Le Classement et les Meneurs sont des tableaux du direct coiffés d'un bandeau ; le Proprio, `.pr-bloc` plus des cellules ; le Calendrier mêle les billets et l'ancienne grille `.calj`. `check_plateau` les laisse passer : il juge des formes, pas l'absence des anciens gabarits.
- Cinq modes, **cinq navigations** : des écouteurs `keydown` à eux dans direct.js, gerant.js (le duel), saison.js (les séries), sur-glace.js, bilan.js ; trois sorties hors de la pile (`.t-dock`, `.exh-fermer`, `.sg-fermer`), cliquées par js/pile.js.
- index.html : 78 lignes d'atelier du 82-0 (`.pane-head`, `.seg-view`, `.seg-effectif`) restent visibles en Rogue sous `.en-cartes`.
- Ce qui tient : les jetons, le carton (`carteHtml`, `cartonDe`, `.cs-*`), la coquille de navigation (pile, glisser, manette), la barre des cinq portes.

**Le constat**, en une phrase par couche : le moteur est propre au centre et empilé aux bords ; les cartes sont un objet avec six squelettes et huit grammaires ; les histoires sont une banque et demie avec les faits dans l'écran ; l'interface est une grammaire sur une page et un empilement sur les autres.

## 4. Les règles du jeu : la suite, en quatre couches

Les modes ne bougent pas d'une règle : le 82-0 reste le repêchage puis la saison d'un coup et les séries match par match, sans carte ; le Rogue garde son jour à jour, son coach, son duel au plan, sa boutique ; Sur table et Sur glace gardent leurs règles physiques. Ce qui suit, c'est ce qu'ils partagent. **Revu le 5 nov.** (`/revue-design`, cinq relecteurs en adversaires ; les huit réponses de JP au bas) : les corrections sont dans le texte.

### A. Le moteur : un noyau, des greffes

**Un seul chemin pour jouer un match.** Tout match se joue en trois périodes (`jouerEnPeriodes`, qui existe), avec une liste de **greffes** reçues du mode : une greffe est `{ quand(e, periode), canaux, adv }`, lue à chaque période, et c'est tout ce que le moteur sait du Rogue. Le 82-0 n'en passe aucune : le match ordinaire d'aujourd'hui, à la feuille près (les règles de la plage, les mineures qui s'épuisent, le plancher, les blessures au tiers, se jouent par période comme aujourd'hui). Le Rogue en passe : ses pouvoirs, ses adjoints et leurs relais, le plan de la période, le coach adverse en séries, les mutations posées, les moments, les situations (qui ne sont pas des choix : une mutation posée sur un joueur, calibrée à zéro en paires, `check_situations`). **Le gros match du 82-0** (JP, 5 nov., deux fois : *comme au devis*) se regarde en trois périodes vues, sans aucun choix : plus de main adverse, plus de dépistage, plus d'entracte à 40:00 ; l'adversaire n'y reçoit rien non plus (en saison, rien : `horsAdverse`, respectée). La règle « plus de Compris » (docs/refonte-v9.md) se réécrit pour ce cas : les trois périodes vues sont un match qui se regarde, pas trois arrêts qui demandent quelque chose ; une seule touche avance la période.

**Ce qui est du Rogue sort de sim.js** dans un module qui le porte, `js/greffes.js` : les pouvoirs posés, les adjoints posés et le relais, les plans, les moments, les situations, les mutations, l'expérience du coach, les séjours, les suivis, les histoires appliquées. sim.js redevient le moteur : le hasard, les zones, les lignes, l'affinité, les jambes, les blessures, le lancer, le gardien, les punitions, les unités spéciales, la ligue au jour le jour, les séries, l'alignement automatique. Le contrat entre les deux tient en trois fonctions : `greffesDuSoir(ligue, match)` (ce que le mode pose avant le match), `apresLeMatch(ligue, feuille)` (ce que le mode compte après : l'expérience, les séjours, les suivis), `appliquerChoix(ligue, decision)` (une décision prise à l'écran). La ligue ne connaît que ce contrat.

**Une seule source pour ce que les trois modes copient.** Le hasard et le hachage : `generateur`, `gauss`, `hache` et `entierDeGraine` dans js/util.js, lus par sim.js, table.js et physique.js ; la mulberry32 et la gaussienne de physique.js, et `hacherMise`, partent. La force d'un joueur : **aucune cote neuve** (une formule de cote fait monter `RATINGS_VERSION` et refait les shards ; ce n'est pas le sujet) : le moteur garde sa lecture (`teamStrength`, `profilMatch`), et Sur table comme Sur glace lisent `cote20` et `axes20` de js/niveaux.js, qui existent, au lieu de leurs conversions à eux. Les constantes d'époque des punitions (`AVANTAGES_EPOQUE`, la durée, le taux) : Sur table et Sur glace gardent leurs règles physiques (leur `punir`, leur fusillade : ce sont d'autres jeux), mais lisent les chiffres d'époque du moteur plutôt que les leurs.

**L'affichage sort du moteur** : `lectureDuMatch` et `CADRE_DU_MATCH` vont dans js/impact.js, les mots (`motsDEffet`, `totauxDuSoir`, `motsDesTotaux`, `motCourbe`, `penaliteAffichee`, `motPenalite`) dans js/recit.js. Le moteur rend des chiffres et des feuilles ; il ne fait plus de phrases.

**La défensive, mesurée avant d'être jouée** (A3, la dernière ; JP : *check_suppression étendu d'abord*). MOTEUR.md § 9 : la défensive individuelle reste approximée, et le signal mesuré dit qu'elle passe par la **qualité** des tirs concédés (la brigade pèse +0,45 sur le % d'arrêts), pas par leur volume (−0,17). Les vols et les revirements par joueur sont dans les shards depuis 2005-06. A3 commence par `scripts/check_suppression.mjs` étendu : un canal de défense par joueur (vols moins revirements, pondéré par la glace, par poste), ajusté sur 2005-2012 et éprouvé en retenue sur 2013-2025 ; il doit battre le club seul et se séparer du gardien. S'il tient, la **possession** (une entrée de zone, un porteur, une sortie : un lancer, un revirement, un dégagement) s'écrit sous le lancer, et sa cible s'écrit alors sur la qualité des tirs concédés, pas sur leur nombre. S'il ne tient pas, A3 tombe sans retarder le reste.

### B. Les cartes : un objet, une échelle, une grammaire

**La carte de joueur reste telle quelle** (JP, deux fois) : `cartonHtml`, `carteCouchee`, `dosDeCarton`, les 55 séries `.cs-*`, les éditions Base à Holo (le « shiny » par-dessus le joueur, qui monte ses paliers de badges). Elle ne bouge pas d'un pixel.

**Tout le reste est une carte de jeu, et il n'y a qu'une carte de jeu** : `carteHtml`, un squelette, pour le pouvoir du coach, l'adjoint, le coach lui-même (qui n'avait pas de carte), le plan d'une période, la réponse d'une histoire, le joueur offert (la carte de joueur enchâssée, comme aujourd'hui), la carte de l'adversaire en séries. La tuile de choix (`optionHtml`) part : un choix, c'est **deux ou trois cartes de jeu côte à côte** (JP, 5 nov. : *trois petites côte à côte* ; la règle d'interface.md « jamais trois étroites côte à côte » est défaite, elle se réécrit : trois cartes tiennent de front à 390 px, le joueur nommé se lit, mesuré par un `check_hauteur` neuf à 390 × 844 avec la scène, trois options et un joueur nommé). **La pochette** fusionne le paquet de récompense et le sachet de boutique en un objet scellé à deux états nommés : achetée, elle peut rester scellée jusqu'à sa date limite (`DATE_LIMITE_MATCH`, le remboursement en fin de run) ; récompense d'une série ou d'un jalon, elle s'ouvre avec la sortie de sa vedette (le walkout, dès ★ Étoile).

**Une seule grammaire d'effet**, `js/effets.js`, dix cases : `{ quand, canaux, adv, lui, duree, jetons, xp, gestes, pari, suite }`. `quand` est la seule forme de déclenchement (elle remplace `quand(e)`, `signal.quand(e)` et `si`) ; `canaux` et `adv` sont les canaux du moteur (la robustesse y reste additive, c'est écrit dans le canal) ; `lui` ce qui va au joueur nommé ; `duree` en matchs ; `jetons` et `xp` **se versent une fois, à la décision, jamais sous un `quand`** (la caisse reste recomptée des décisions, `check_rogue`, `check_verite`) ; `gestes` les gestes d'aujourd'hui (le soin, les absents, les jambes, l'auxiliaire au filet, l'échange, les offres) ; `pari` deux effets de la même grammaire, `gagne` et `perd`, tirés au dé (la rondelle qui tourne) ; `suite` l'histoire qui suivra. Le relais de l'adjoint est un `quand` qui rejoue un canal : il reste écrit dans js/adjoints.js, dans cette grammaire. **Les chiffres se dérivent de l'effet, la réplique reste écrite** (JP, 5 nov.) : `motsDe(effet)` rend le gros chiffre et les lignes vertes et rouges, dans les mots que `check_mots` exige, et elles ne peuvent plus mentir ; la réplique de hockey (« Ils hésitent à venir », « Cinq minutes au cachot ») reste écrite à la main par la voix, parce que c'est elle qui fait lire une carte comme du hockey. Partent `bon`, `prix` et `texte` écrits à côté de l'effet ; `dit` reste.

**Une seule échelle de rang** : `NIVEAUX` (Soutien, Régulier, Pilier, ★ Étoile, ★ Phénomène), pour le joueur (déjà), le coach (`MAITRISE` disparaît dans `NIVEAUX` : ses cinq multiplicateurs, de ×0,9 à ×1,3, y vivent), l'adjoint (déjà presque), la carte de jeu. `RARETES` et ses quatre clés partent, avec les quatre ponts. **Les bornes en victoires, avec leur unité** :
- une carte de jeu ou une réponse d'histoire : `BORNE_V` par niveau, 1 · 1 · 1,5 · 2,5 · 4, mesurée sur les soirs où elle joue, en paires (`check_effets`) ;
- un adjoint : la même table, par niveau, mesurée sur son séjour (`MATCHS_PAR_SAISON`, `check_pouvoirs`) ;
- **un pouvoir n'a pas de niveau** : il garde sa borne par rang, 2,5 V pour I et II, 4 V pour l'ultime, mesurée sur une saison de 82 soirs **à la maîtrise la plus forte** (×1,3, le ★ Phénomène), pour que la borne tienne chez tous les coachs ; le personnage complet (le coach et sa main) sous 16 V ;
- le style ne se paie pas en force, au plus 0,5 V par seuil franchi, et une carte se mesure en paires : les deux règles de `check_cartes` (cassé) passent dans `check_effets`.
Les éditions restent la seule deuxième échelle, et elle n'habille que la carte de joueur : un Soutien peut sortir en Holo, c'est le shiny.

**La banque au niveau.** Les neuf cartes de la banque (js/banque.js) reçoivent chacune un niveau à la place de leur rareté ; la carte rare d'un pack (`RARE_DU_PACK`) se tire par niveau avec la table d'aujourd'hui (55 · 30 · 12 · 3, les deux premiers niveaux ensemble) ; la revente par niveau garde ses valeurs (1 · 1 · 1 · 2 · 5) et reste sous 40 % du prix ; `check_packs` se réécrit par niveau. Le méta ne pointe sur rien qui part : `DEBLOCAGES`, `PRESTIGES`, `JALONS`, `MISSIONS` lisent les packs, les niveaux et les éditions, qui restent.

**Moins de systèmes de progression.** Onze aujourd'hui ; la suite en garde sept, chacun lu par un autre : le niveau (ce que vaut une carte ; lu par les bornes, les packs, le coach), les éditions (le shiny du joueur ; lues par les badges et les missions), le coach (ses pouvoirs, son expérience, sa règle ; lu par le relais des adjoints et les cases), la main d'adjoints (ses règles sont celles de la V24 : la condition, l'horloge, le relais, le salaire ; lue par le banc et la caisse), la main du deck (les cartes de jeu gagnées aux paliers ; lue par les mutations), **les galons** (JP, 5 nov. : *garder l'effet, perdre l'écran* : un galon monte un badge du joueur pour la run et trois galons chez toi retirent un chandail au panthéon ; ils se lisent au verso de la carte du joueur, leur bloc du Palmarès part), le méta (déblocages, crans, jalons, prestiges ; lu par la boutique et le classeur). Partent : `effetCarte` (la recrue seule), `CARTES_MATCH` et js/combat.js (l'adversaire d'un gros match du 82-0 ne reçoit plus rien, A), les restes morts.

### C. Les histoires : une banque, un module de faits, une porte

**Une seule banque**, `js/histoires.js`, et chaque entrée a la même forme : `{ de, moment, quand(f), joueur(f), fait(f), mots(f, j), options, suite, rare }`. Le `moment` dit quand elle peut sortir, et il n'y en a que **trois** : le lundi, **le jour du gros match** (jamais la veille : JP, *juste le jour du gros match, pas avant*), la ronde de séries. Les trois avant-matchs qui lisent un fait (l'ancien, les poteaux, le virus) entrent dans la banque au moment « gros match » ; les neuf autres, qui ne lisaient rien et servaient Messier 1994 à un club de 1975, partent, et leurs faits vrais vont au verso de la carte du joueur qui les a vécus. Les entractes et les incidents ne s'offraient qu'au gros match du 82-0, qui n'a plus de choix (A) : ils partent. Les ajustements de séries sont des plans de période, pas des histoires : ils entrent dans la grammaire des plans du duel (`PLANS`), au moment « ronde ». Les situations restent une greffe (A). Un seul tirage, `tirer(graine, moment, faits, sorties)`, les règles d'aujourd'hui (le repos de cinq semaines, deux sorties par saison au plus, jamais deux fois le même joueur, une rare par saison, la suite avant le tirage) ; la ronde de séries ne vide pas le pool du lundi : chaque moment a le sien.

**Les options d'une histoire sont des cartes de jeu** (B), avec la grammaire d'effet. **Chaque option qui touche un joueur (`lui`, `pari`) engage un suivi** (`engagerSuivi`) : son issue se lit le lundi d'après, en vrais chiffres, comme un message (la règle « son verdict arrive comme un message ») ; c'est ce que js/verdicts.js faisait à part, et il part.

**Les faits sortent de l'écran** : `js/faits.js`, `faitsDe(ligue, jour)`, tout ce que `faitsDuLundi`, `faitsDesJoueurs`, `faitsDuProprio`, `faitsDeLaCourse`, `faitsDuDernier` et `faitsDesSuites` lisaient, en un objet, lu dans les feuilles jouées et la cédule connue, rien d'avance. Il gagne **la vraie saison, avec ses bornes** (JP, 5 nov.) : pour chaque joueur, `{ buts, passes, gp, matchsDeSaSaison, clubs, enCours }`. La voix dit « cette année-là, 34 buts en 47 matchs » : toujours les matchs joués, sans nommer de club si `clubs > 1` (un joueur échangé porte les mêmes totaux dans chaque club : 84 doublons en 1994-95), « jusqu'ici » si la saison est en cours, jamais « a fini », et jamais face à un chiffre d'une autre époque (une ligue de Rogue en mélange).

**Les répliques nomment**. `mots(f, j)` reçoit le joueur et les faits : la voix dit son nom, son chiffre, son club.

**Quarante histoires au lancement de la V25** (treize aujourd'hui), **livrées en fiches avant C1** (le fait lu, la voix, le joueur nommé, le moment, les options), écrites avec `rogue-recit`. Les familles qui manquent vraiment, mesurées sur 400 saisons : la blessure (`f.blesses`, que personne ne lit), le contrat (`f.masse`, mort depuis la V22), la fin de séjour d'un adjoint, le mandat à mi-saison ; les familles déjà doublées (la disette, la route, la chaude, le petit) ne gagnent rien. Chacune des dix-sept voix porte au moins une histoire, sinon la voix part (six parlent aujourd'hui). La cible du rythme ne change pas (`mesure_rythme` : aucun trou de plus de dix matchs), et une run de trois saisons ne revoit aucune histoire sur le même joueur. **Le robot attentif apprend la banque** (`lundiDuRobot`, scripts/lib/cartes_robot.mjs) dans la même tranche : sinon le juge mesure son ignorance.

### D. L'interface : une grammaire, le Rogue d'abord

**Un module de composants**, `js/composants.js`, qui remplace js/plateau-rogue.js et le dépasse : la grammaire de la maquette A (le bandeau, les jetons, la carte et sa ligne, le coin, la grille, les cellules, le visage, le billet, la marche, le podium) plus ce qui manque pour que les pages du Rogue n'aient plus de gabarit à elles : **une** rangée d'onglets, **un** segment, **un** bouton et ses variantes, **un** bloc (le panneau avec son bandeau), **une** liste de rangées, **un** tableau triable (distinct des rangées : le Classement à 32 clubs, les Meneurs, l'effectif gardent leurs en-têtes qui trient), **une** feuille, **un** toast (sans « Compris »), **une** jauge. Chaque page l'appelle avec ses données et sa couleur ; aucune ne redessine.

**D1, le Rogue seul** (JP, 5 nov. : *D1 sur le Rogue d'abord, D2 avec son devis*). Les douze pages du Rogue faites des composants, sans hybride (le Classement et les Meneurs en tableau du direct coiffé d'un bandeau, le Proprio en `.pr-bloc`, le Calendrier en `.calj`) ; les 72 surcharges `body.mode-rogue` partent ; les Lignes du Rogue (`.en-cartes`, 24 surcharges) sont remplacées par **un composant nommé**, la case en carte, à côté de la case en rangée du 82-0 (ce que les deux partagent, la ligne, le dépôt, les verdicts, reste un ; ce qui diffère, la case, est deux composants, pas une classe de mode ni quarante `if`). style.css réécrit par sections : les jetons ; les composants ; le carton (les 1 880 lignes, telles quelles) ; le Rogue n'a plus de section à lui ; les sections des autres modes restent telles quelles jusqu'à D2. Les sélecteurs que les smokes touchent restent (docs/decisions.md, 30 sept.). Cible : 7 402 → moins de 6 000 lignes après D1 (moins de 5 000 après D2).

**D2, les autres modes, avec son propre devis** (la V26) : le 82-0, Sur table, l'exhibition, Sur glace, chacun avec un parcours toucher par toucher, une maquette par écran dans la direction A (JP : *une seule direction*), le tableau triable, la navigation laissée à js/pile.js (Sur table refuse exprès qu'une touche quitte un match, Sur glace met en pause : ce sont des règles, pas des doublons), les 78 lignes d'atelier d'index.html. Rien de D2 n'est dans « Ce qui part » de la V25.

## 5. Les chiffres

- **Les totaux du moteur ne bougent pas** : 3,06 à 3,11 buts par match, 28,2 à 28,5 lancers, les quatre égalités de la feuille (MOTEUR.md § 7). La preuve : `check_feuilles` sur **quatre ligues appariées** (la même graine, avant et après A1 : 5 248 matchs), buts par match à ±0,04 et lancers à ±0,3 (le bruit d'une ligue est ±0,035 ; ±0,02 demanderait 8 000 matchs), plus `check_empreinte` qui exige que `VERSION_MOTEUR` monte (S142) quand les matchs changent. Le même numéro de graine ne rendra pas la même saison ; la partie en cours se rejoue avec les nouvelles règles, et js/game.js le dit au joueur.
- **Les bornes**, avec leur unité (§ 4 B) : une carte 1 · 1 · 1,5 · 2,5 · 4 V par niveau sur ses soirs ; un adjoint la même table sur son séjour ; un pouvoir 2,5 · 2,5 · 4 V par rang sur 82 soirs à ×1,3 ; le personnage complet sous 16 V ; le coach adverse en séries neutre à ±1,5 V (`check_pouvoirs`, `check_effets`, `check_gros`).
- **La profondeur se juge sur la run** (JP, 5 nov. ; V23 : *tout roguelike, on finit par être pété lors de la run gagnante*). Le critère de la suite : **la première Coupe de l'attentif arrive au moins deux runs avant celle du robot d'avant** (aujourd'hui : la même run, 6 et 4) ; la première Coupe de l'attentif à la run 3 ou plus tard ; après elle, il la regagne sans la gagner d'office (25 à 67 %). L'écart par saison reste une information, avec 8 V pour cible, jamais un rouge : les options sont bornées à ±1 V et ne sont jamais un piège, l'arithmétique ne porte pas plus. Mesurer la run demande les campagnes de `check_profondeur` (deux campagnes de douze runs, quatre graines, un quart d'heure) ; l'écart par saison à ±1 V demanderait sept graines.
- **Le rythme** : aucun trou de plus de 10 matchs sans décision, au moins une histoire par quart de saison ; aucune histoire revue sur le même joueur dans une run de trois saisons (`mesure_rythme`, à étendre).
- **La défensive** (A3) : `check_suppression` étendu, en retenue 2005-2012 → 2013-2025 : le canal par joueur bat le club seul et se sépare du gardien ; la cible chiffrée de la possession s'écrit après, sur la qualité des tirs concédés.
- **L'interface** : style.css sous 6 000 lignes après D1 ; zéro sélecteur `body.mode-rogue` et zéro `if` de mode neuf dans le rendu des pages du Rogue (le compte des embranchements `ctx.rogue` de js/saison.js ne monte pas : 22 aujourd'hui) ; les douze pages faites des composants (`check_composants`) ; un choix à trois cartes avec un joueur nommé tient à 390 × 844 (`check_hauteur`).

## 6. Les cas limites

- **La vieille partie** : les clés de sauvegarde ne bougent jamais ; une décision d'avant (un adjoint à un poste d'alors, un soin, une option de dossier par sa clé, un galon posé en report) se relit ; une partie dont le `moteur` diffère se rejoue avec les nouvelles règles, et le jeu le dit (ce qui existe) — `check_sauvegardes`, étendu aux galons.
- **Une histoire sans porteur** : `quand(f)` faux, elle ne sort pas ; la liste blanche de `check_incidents` reste pour les trois d'équipe.
- **Le joueur parti** fait tomber la promesse et la suite, et ça se dit — `check_suivis`.
- **Le joueur échangé, la saison écourtée, la saison en cours** : `clubs > 1` tait le club, `enCours` dit « jusqu'ici », les matchs joués se disent toujours — `check_vie` (étendu à la vraie saison).
- **Les séries** : les ajustements sont des plans du duel au moment « ronde » ; le coach adverse reste une greffe ; les séries se rejouent match par match — `check_series_pas`, `check_gros`, `check_duel`.
- **Le gros match du 82-0** : trois périodes vues, une touche par période, aucun choix, aucune greffe adverse — `check_gros` (en saison, rien : ±0 V).
- **La fin de saison et la fin de run** : le mandat, les médailles, le remboursement des pochettes scellées : rien ne change.
- **Hors ligne** : sw.js liste les modules neufs (greffes, effets, histoires, faits, composants) et oublie les partis — `check_coquille`.
- **Le clavier et la manette** : rien ne change à la navigation dans la V25 (D2) ; chaque page du Rogue refaite répond à A, B, Échap et au balayage comme avant — smoke, `essai_rogue`.
- **Sur table et Sur glace** : leur jeu ne change pas d'une règle ; leurs replays changent (le générateur unique, la lecture de la force), ce qu'aucune sauvegarde ne garde — `check_table`, `check_physique`.

## 7. Ce qu'il touche

Les fichiers, par tranche (§ Les tranches) :

- **A, le moteur** : `js/sim.js`, `js/game.js`, `js/impact.js`, `js/recit.js`, `js/util.js`, `js/table.js`, `js/physique.js`, `js/sur-glace.js`, `js/greffes.js` (neuf), `js/saison.js`, `js/banc.js`, `js/bilan.js`, `js/combat.js`, `sw.js`, `MOTEUR.md`, `.claude/rules/moteur.md`, `scripts/check_empreinte.mjs`, `scripts/check_suppression.mjs`.
- **B, les cartes** : `js/cartes.js`, `js/effets.js` (neuf), `js/rarete.js`, `js/niveaux.js`, `js/pouvoirs.js`, `js/adjoints.js`, `js/coachs-reels.js`, `js/gerant.js`, `js/alignement.js`, `js/packs.js`, `js/banque.js`, `js/inventaire.js`, `js/magasin.js`, `js/rogue.js`, `js/rogue-jeu.js`, `js/galons.js`, `style.css`, `sw.js`, `.claude/rules/rogue.md`, `.claude/rules/interface.md`, `scripts/check_pouvoirs.mjs`, `scripts/check_effets.mjs`, `scripts/check_packs.mjs`, `scripts/check_cartes.mjs`, `scripts/check_hauteur.mjs` (neuf).
- **C, les histoires** : `js/histoires.js` (neuf), `js/faits.js` (neuf), `js/dossiers.js`, `js/scenes.js`, `js/vie-gm.js`, `js/arcs.js`, `js/verdicts.js`, `js/saison.js`, `js/sim.js`, `js/greffes.js`, `sw.js`, `.claude/rules/rogue.md`, `scripts/check_dossiers.mjs`, `scripts/check_vie.mjs`, `scripts/mesure_rythme.mjs`, `scripts/lib/cartes_robot.mjs`.
- **D1, l'interface du Rogue** : `js/composants.js` (neuf), `js/plateau-rogue.js`, `style.css`, `js/saison.js`, `js/gerant.js`, `js/alignement.js`, `js/joueurs.js`, `js/magasin.js`, `js/inventaire.js`, `js/cartable.js`, `js/rogue-jeu.js`, `sw.js`, `.claude/rules/interface.md`, `scripts/check_plateau.mjs`, `scripts/check_css.mjs`.

**Les règles fermes touchées** (chacune réécrite pour décrire le neuf, jamais défaite en silence) :
- moteur.md : les règles qui nomment `playGame` et ses chemins ; « tout le hasard passe par `hasard()` » (respectée : un seul générateur, dans util.js) ; « on mesure une carte en paires, `check_cartes` » (reprise par `check_effets`) ; `check_combat` part avec js/combat.js.
- rogue.md : « borné par la rareté (commune ±1…) » devient « borné par le niveau, avec son unité ; un pouvoir par son rang », les mêmes chiffres ; « au plus 0,5 V par seuil de style, `check_cartes` » passe à `check_effets` ; « en saison, rien » et `horsAdverse` : respectées (le 82-0 ne reçoit plus rien) ; « le gros match se règle le jour où il se joue » : respectée (le moment « veille » n'existe pas) ; « les adjoints ne s'achètent pas », « aucun joueur ne te suit au choix » : respectées ; « V22 : la banque neuve… le système reste » : la banque devient la seule ; « les gros matchs portent leur plan, leur contre et leur pointage après deux périodes, `check_gros` » : **défaite pour le 82-0** (JP, 5 nov. : périodes vues sans choix), tenue pour le duel du Rogue.
- interface.md : « au téléphone, les cartes à choisir se balaient en grand, une à la fois ; jamais trois étroites côte à côte » : **défaite** (JP, 5 nov. : *trois petites côte à côte*), réécrite comme « trois cartes de front tiennent à 390 px et le joueur nommé se lit, `check_hauteur` » ; le contrat du plateau devient le contrat des composants.
- docs/refonte-v9.md « plus de Compris » : **défaite pour le gros match du 82-0** (JP), tenue partout ailleurs (le toast unique n'a pas de « Compris »).
- vocabulaire.md : « dossier » devient « histoire » (un mot par idée, `check_lexique`) ; « galon » garde sa définition, sa maison devient le verso.
- tests.md : les juges renommés ou neufs (§ 10).
- **Les clés de sauvegarde ne bougent jamais** (`check_sauvegardes`).

## 8. Ce qui part

La pièce maîtresse. Chaque nom ci-dessous disparaît du jeu (js/, index.html, style.css, sw.js), et check_refonte le vérifie à la PR de sa tranche. Le test du zéro : chaque module neuf (greffes, effets, histoires, faits, composants) s'écrit à partir de ce devis et des règles, sans relire l'ancien ligne par ligne ; c'est une refonte. (Revu le 5 nov. : les galons, `.pl-barre`, les situations et les lectures de la force sont sortis de cette liste ; les classes des autres modes attendent le devis D2.)

### A. Le moteur

- Les chemins de playGame : `jouerSoixanteMinutes`, `jouerDuel`, `apres40De` ; un seul reste, le match en trois périodes avec ses greffes (A1 : simulerGrosMatch reste, c'est un gros match isolé pour la mesure, pas un chemin).
- Le plan adverse, le dépistage et la préparation du gros match du 82-0 : `PLANS_ADV`, `commentContrer`, `reglageDuPlan`, `planDeSerie`, `depistageDe`, `planDuDepistage`, `PREP_JUSTE`, `PREP_RATEE`, `poserPlanAdverse`, `poserPreparation`, `poserCartes`, `effetsDesCartes`, `planAdverseHtml`, `optionDeCarteMatch`, `regleDeCarte`, `motsDeCarteAdverse`, `entractesDu`, `incidentDuMatch`, `planDuMatchDeSerie`, `statsEntracte`, `tableEntracte`, `lignesEntracte`, `suiteDuPlan`, `originesDe`, `SENS_DES_CANAUX`, `scripts/mesure_prep.mjs` ; et leurs classes `.plan-adv`, `.depistage`, `.dep-piste`, `.main-adverse`, `.ent2-incident`.
- Le gros match du 82-0 à choix : `js/combat.js`, `CARTES_MATCH`, `mainAdverse`, `energieAdverse`, `FRANCHISE_MATCH`, `mainAdverseHtml`, `depistageHtml`, `pistesDuRapport`, `FRANCHISE_ENTRACTE`, `ENTRACTES`, `INCIDENTS`, `entractesOfferts`, `effetEntracte`, `scripts/check_combat.mjs`.
- Les doubles du hasard : `hacherMise` ; la mulberry32 et la gaussienne de js/physique.js (mêmes noms que celles qui restent, dans util.js : le juge les compte en lignes).
- L'affichage qui vivait dans le moteur, parti de sim.js vers impact.js et recit.js (il bouge, § 8b).
- Les vingt-six pierres tombales de sim.js, et la ligne d'historique de VERSION_MOTEUR (elle va dans docs/moteur-recalibrer.md ; la constante reste).

### B. Les cartes

- Les squelettes en trop : `optionHtml`, `grosChiffre`, `paquetHtml`, `.choix-option-nom`, `.choix-option-gros`, `.choix-option-bon`, `.choix-option-prix`, `.main-adverse-carte`, `.ej-coach-tete`, `.paquet`.
- Les vocabulaires de rang en trop : `RARETES`, `NOMS_NIV`, `MAITRISE`, `RARETE_NIV`, `RARETE_POUVOIR`, `RARETE_SORTE`, `PALIERS_RARETE`, `rareteDeSalaire`, `COTES_CARTES`, `BORNE_NIV`.
- Les systèmes isolés : `effetCarte` ; `PARTIS` ; le bloc des galons au Palmarès (`galonsHtml`).
- Le juge cassé : `scripts/check_cartes.mjs` (ses deux règles passent dans `check_effets`).

### C. Les histoires

- La banque et son tirage d'aujourd'hui, refaits dans histoires.js : `js/dossiers.js`, `DOSSIERS`, `dossierDeLaSemaine`, `semaineAHistoire`, `sceneDuDossier`, `dossierOuvert`, `motsDuDossier`, `motsConcrets`.
- La deuxième banque de sim.js : `AVANT_GROS`, `avantDuCombat`, `AJUSTEMENTS`, `ajustementsOfferts`, `AMPLEUR_CHOIX` (les entractes et les incidents sont au § A).
- Les faits écrits dans l'écran : `faitsDuLundi`, refaits dans faits.js.
- Les trois chemins pour un seul : `CHOIX_DES_FILS`, `VOIX_DES_FILS`, `messageDuFil`, `voixDuFil`, `filOuvert`, `pariDeDecision`, `familleDeMoment`, `effetDeMoment`, `appliquerGestes` (une porte, appliquerChoix).
- La promesse en double : `js/verdicts.js`, `verdictsDeLaSemaine` (chaque option qui touche un joueur engage un suivi).
- La machine d'arcs vide : `js/arcs.js`, `episodesDuMatin`, `faitsDuMatin`, `ordreDesArcs`, `ARCS_PAR_SAISON`, `DEFIS`, `avanceDuDefi`, `motDuDefi`, `scripts/check_arcs.mjs` (un défi devient une suite d'histoire).

### D1. L'interface du Rogue

- Le module d'une page : `js/plateau-rogue.js` (refait en composants.js).
- Les surcharges de mode : `body.mode-rogue` (72 règles), `.en-cartes` (remplacée par le composant nommé de la case en carte).
- Les gabarits des pages du Rogue : `.hub-onglets`, `.hub-chips`, `.hub-carte`, `.hub-volet`, `.hub-boite`, `.hub-tuile`, `.hub-table`, `.hub-sheet`, `.hub-barre`, `.rl-table`, `.pr-bloc`, `.bu-run-jauge`, `.tuile-jauge`, `.ff-barre`, `.ej-jauge`, `.impact-barre`, `.pk-tuile`, `.ct-vues`, `.ct-vue`, `.ct-feuille`, `.inv-onglets`, `.inv-onglet`, `.inv-filtres`, `.inv-filtre`, `.inv-pl-barre`, `.choix-modal`, `.choix-sheet`, `.main-sheet`, la grille `.calj`.

## 8b. Ce qui reste, ce qui bouge, ce qui attend D2

**Reste tel quel, et pourquoi** :
- La carte de joueur : `cartonHtml`, `carteCouchee`, `dosDeCarton`, `cartonDe`, les 55 séries `.cs-*`, `EDITIONS`, `NOM_VARIANTE`, `VARIANTE_PALIERS` — JP, deux fois : *garder les cartes actuelles du jeu*.
- Le noyau du lancer et ses juges : `profilMatch`, `jouerCote`, `facteurGardienDe`, `tirageDe`, `compterFeuilles`, `hasard`, `deDuJour`, `jouerEnPeriodes`, `simulerGrosMatch` (un gros match isolé, pour la mesure), `teamStrength`, `pctTirRelDe`, `lancersRelDe`, `passesRelDe` — une seule source, prouvée (MOTEUR.md § 6, § 7) ; aucune cote neuve.
- Le coach-personnage et sa main : `POUVOIRS`, `ADJOINTS`, `REGLES_DU_COACH`, le relais, `dit` — les idées qui ont fait du Rogue un jeu (V21 à V23) ; elles changent de grammaire d'effet, pas de règle, et les règles des adjoints sont celles que la V24 fixe.
- Les galons : `js/galons.js`, `GALONS`, `GALONS_MAX`, `galonsDeLaSaison`, `CHANDAIL_GALONS`, `scripts/check_galons.mjs` — ils montent un badge pour la run et comptent pour le panthéon (JP, 5 nov.) ; seul leur écran part.
- Les situations : `SITUATIONS`, `JOURS_SITUATIONS`, `situationsDuJour`, `effetDeSituation` — une mutation posée, pas un choix, calibrée à zéro en paires (`check_situations`) ; elles deviennent une greffe.
- L'économie : `jetonsDe`, `baremeRogue`, les packs et leurs prix, `DEBLOCAGES`, `PRESTIGES`, `JALONS`, `MISSIONS` — une caisse recomptée des décisions, lisible (docs/revue-rogue-2026-11.md).
- Les suivis : `engagerSuivi`, `suivisEnCours`, `retoursDuMatin` — la promesse suivie qui sait déjà tomber avec un joueur parti.
- La coquille : les cinq portes, `.navtab`, `.sousnav`, `.soustab`, `js/pile.js`, `js/glisser.js`, `js/manette.js`, les jetons `:root`, les palettes, `.pl-barre` et toute la grammaire `.pl-*` jusqu'à composants.js — la seule grammaire qui a tenu depuis la 1.0.
- Les règles de Sur table et de Sur glace (leurs punitions, leurs fusillades, leur IA, leur sortie protégée) — d'autres jeux, à part exprès (JP : *les modes de jeux doivent être séparés*).
- Les dix-sept voix (`EXPEDITEURS`) et les scènes (`js/scenes.js`) — elles parlent ; chacune porte une histoire ou part à C2.

**Bouge sans changer de nom** (le juge ne le compte pas, le diff le montre) : `lectureDuMatch`, `CADRE_DU_MATCH` vers impact.js ; `motsDEffet`, `totauxDuSoir`, `motsDesTotaux`, `motCourbe`, `penaliteAffichee`, `motPenalite` vers recit.js ; les pouvoirs posés, les adjoints posés, le relais, les plans, les moments, les situations, les mutations, l'expérience, les séjours vers greffes.js ; `generateur`, `gauss` vers util.js ; les trois avant-matchs à fait (l'ancien, les poteaux, le virus) vers histoires.js ; les ajustements vers `PLANS`.

**Attend le devis D2** (la V26) : les gabarits des autres modes (`.stat-tabs`, `.jr-table`, `.live-tableau`, `.live-sheet`, `.live-onglets`, `.live-filtre`, `.eq-*`, `.cjv-*`, `.ent-*`, `.niv-*`, `.bl-tuile`, `.mcard`, `.dash-card`, `.seg-view`, `.seg-effectif`, `.chip-need`, `.t-seg`, `.t-feuille`, `.table-sheet`, `.pm-seg`, `.exh-*`, `.sig-liste`), la navigation, les 78 lignes d'atelier d'index.html.

## 9. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| `BORNE_V` (carte et adjoint, par niveau) | 1 · 1 · 1,5 · 2,5 · 4 | les chiffres de la règle | au-dessus, une carte seule casse le jeu ; en dessous, rien ne se voit dans la feuille |
| La borne d'un pouvoir (par rang, à ×1,3) | 2,5 · 2,5 · 4 | les chiffres d'aujourd'hui | idem |
| La Coupe de l'attentif avant celle du robot d'avant | 2 runs | 1 à 3 | sous 1, lire ses choix ne change pas la carrière ; au-dessus de 3, le robot d'avant ne gagne jamais |
| L'écart par saison (information) | cible 8 V | 5 à 10 | une cible, jamais un rouge |
| Le trou du rythme | 10 matchs | 8 à 12 | au-dessus, la saison est un couloir ; en dessous, le soir ordinaire n'existe plus |
| Les histoires au lancement | 40, en fiches avant C1 | 30 et plus | sous 30, une run de trois saisons se répète |
| La vraie saison | matchs joués toujours, club tu si `clubs > 1`, « jusqu'ici » si en cours | | sinon la voix ment |
| style.css après D1 | < 6 000 lignes | | au-dessus, des sections de mode ont repoussé |

## 10. Les critères d'acceptation

- [ ] Un seul chemin de match : `playGame` n'a plus d'aiguillage ; quatre ligues appariées rendent les mêmes buts par match à ±0,04 et les mêmes lancers à ±0,3 — `check_feuilles` (appariées), `check_empreinte`, `check_graine` (à la nouvelle version).
- [ ] sim.js n'importe plus un module du Rogue ; greffes.js est le seul à les importer — `check_couches` (neuf : les imports par couche).
- [ ] Un seul générateur, un seul hachage ; Sur table et Sur glace lisent `cote20` — `check_couches`, `check_table`, `check_physique`.
- [ ] Le gros match du 82-0 : trois périodes vues, aucun choix, aucune greffe adverse, ±0 V — `check_gros`.
- [ ] Toute carte de jeu passe par `carteHtml` ; chaque effet est de effets.js ; ses chiffres sont dérivés (`motsDe`), sa réplique écrite ; `jetons` et `xp` versés une fois à la décision — `check_mots` (étendu), `check_rogue`, `check_verite`.
- [ ] Trois cartes de front avec un joueur nommé tiennent à 390 × 844 — `check_hauteur` (neuf).
- [ ] Une seule échelle de rang ; chaque carte et adjoint sous `BORNE_V` de son niveau dans son unité, chaque pouvoir sous sa borne de rang à ×1,3, et chacun se voit dans la feuille le soir où il joue ; au plus 0,5 V par seuil de style — `check_effets` (reprend `check_cartes`), `check_pouvoirs`, `check_relais`, `check_banc`.
- [ ] La banque au niveau : la carte rare se tire par niveau, la revente reste sous 40 % — `check_packs` (réécrit).
- [ ] Les galons montent toujours leur badge et comptent au panthéon ; ils se lisent au verso — `check_galons`, `check_sauvegardes`.
- [ ] Une seule banque d'histoires, trois moments ; chaque entrée a une voix, nomme son joueur, dit ses vrais chiffres avec les matchs joués, et ses options sont des cartes ; chaque voix porte une histoire — `check_dossiers` (refait), `check_incidents`, `check_clarte` § 5, `check_choix`, `check_vie` (la vraie saison).
- [ ] Les faits se lisent dans faits.js, jamais dans l'écran ; rien d'avance — `check_moments_si`, `check_fils`.
- [ ] Chaque option qui touche un joueur engage un suivi lisible le lundi d'après — `check_suivis`.
- [ ] Le rythme : aucun trou de plus de 10 matchs, une histoire par quart, aucune histoire revue sur le même joueur en trois saisons — `mesure_rythme` (étendu).
- [ ] La profondeur : la première Coupe de l'attentif deux runs avant celle du robot d'avant, à la run 3 ou plus tard ; le robot lit la banque — `check_profondeur` (le critère de run), `check_robot`.
- [ ] L'interface du Rogue : zéro `body.mode-rogue`, moins de 6 000 lignes, aucun `if` de mode neuf dans le rendu, les douze pages faites des composants, la case en carte un composant nommé — `check_css` (étendu), `check_composants` (ce que `check_plateau` devient), `check_mort`.
- [ ] La défensive : le canal par joueur bat le club seul et se sépare du gardien en retenue — `check_suppression` (étendu), avant toute ligne d'A3.
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire au moins une ligne pour deux ajoutées, style.css fait moins de la moitié du diff — `check_refonte docs/refonte-v25-<tranche>.md` à chaque PR.
- [ ] La vieille partie se relit et se rejoue — `check_sauvegardes`.
- [ ] Hors ligne — `check_coquille`.
- [ ] À juger par JP à l'essai : les quarante fiches d'histoires avant C1 ; une run capturée après chaque tranche (`essai_rogue CAPTURES_PAGES=1`) ; que le match en trois périodes du 82-0 se sente comme avant, et que son gros match ne soit pas trois « Compris ».

## Les tranches

Dans l'ordre. Chacune est une ou plusieurs petites PR, porte **son extrait du § 8** dans `docs/refonte-v25-<lettre>.md` (sa partie « Ce qui part » et « Ce qu'il touche », copiées d'ici), et passe `check_refonte` sur cet extrait avant la PR. La revue de design est faite (5 nov.) ; une tranche qui s'écarte du devis repasse par elle.

1. **A1 · Le noyau et les greffes** — un chemin dans `playGame`, greffes.js, le contrat en trois fonctions, le gros match du 82-0 en périodes vues, js/combat.js parti, l'affichage sorti du moteur, les pierres tombales, `VERSION_MOTEUR` S142 — `check_feuilles` (appariées), `check_empreinte`, `check_gros`, `check_duel`, `check_pouvoirs`, `check_situations`, `check_couches` (neuf).
2. **A2 · Une source pour trois modes** — le hasard dans util.js, `cote20` lu par table.js et physique.js — `check_table`, `check_physique`, `check_couches`.
3. **B1 · Une grammaire d'effet et une échelle** — effets.js, `motsDe`, `NIVEAUX` partout, `BORNE_V` avec son unité, la borne des pouvoirs par rang, la banque au niveau, les raretés et les ponts partis, `check_cartes` repris par `check_effets` — `check_effets`, `check_pouvoirs`, `check_relais`, `check_banc`, `check_mots`, `check_packs`.
4. **B2 · Une carte de jeu** — le choix en trois cartes de front, le coach en carte, la pochette à deux états, le bloc des galons parti et leur trace au verso — `check_hauteur` (neuf), `check_lisibilite`, `check_choix`, `check_galons`, `essai_rogue`, `essai_packs`.
5. **C0 · Les quarante fiches** — avec `rogue-recit` : le fait, la voix, le joueur, le moment, les options ; JP les lit avant C1.
6. **C1 · Les faits et la banque** — faits.js (la vraie saison avec ses bornes), histoires.js (trois moments), la deuxième banque fondue ou partie, une porte, une promesse — `check_dossiers`, `check_incidents`, `check_clarte`, `check_suivis`, `check_moments_si`, `check_vie`.
7. **C2 · Quarante histoires et le robot qui les lit** — `lundiDuRobot` apprend la banque ; `mesure_rythme` étendu — `mesure_rythme`, `check_profondeur` (le critère de run).
8. **D1 · Les composants et la feuille, le Rogue seul** — composants.js, style.css réécrit par sections, zéro surcharge de mode, la case en carte nommée, les douze pages sans hybride — `check_composants` (neuf), `check_css`, `check_mort`, `essai_rogue CAPTURES_PAGES=1`.
9. **A3 · La défensive** — `check_suppression` étendu d'abord ; la possession seulement s'il tient — `check_suppression`, puis `mock_moteur`, `check_ratings`, `check_monotonie`.

Après la V25 : **D2, les autres modes**, avec son devis (la V26).

## Les questions à JP, et ses réponses

**Les six du devis (5 nov. 2026)** : le gros match du 82-0 en périodes vues, sans choix (A1) ; les galons partent, leur trace au verso de la carte (B2) ; le seuil de profondeur à 8 V (C2) ; la vraie saison dite dans les histoires (C1) ; les écrans des autres modes sur une seule direction, la A du Rogue (D2) ; la possession en dernier, si la mesure tient (A3).

**Les huit de la revue (5 nov. 2026, `/revue-design`, cinq relecteurs en adversaires)** — deux faits du devis étaient faux et deux questions avaient été tranchées dessus :
1. **Les galons** ne sont pas affichage seul (un badge pour la run, le chandail à trois) : *garder l'effet, perdre l'écran*.
2. **La profondeur** : l'écart par saison est une information depuis la V23 et aucune constante ne porterait 8 V : *la run : la première Coupe de l'attentif deux runs avant celle du robot d'avant* ; 8 V reste une cible.
3. **Le gros match du 82-0** : *comme au devis, périodes vues sans choix* ; la règle « plus de Compris » se réécrit pour ce cas, et le 82-0 perd la main adverse, le dépistage et l'entracte.
4. **Le choix à trois options** : *trois petites côte à côte* ; la règle d'interface « jamais trois étroites côte à côte » est défaite et réécrite, `check_hauteur` la mesure.
5. **D2** : *D1 sur le Rogue d'abord, D2 avec son devis* (la V26 : un parcours par mode, un tableau triable, la navigation laissée à pile.js).
6. **A3** : *check_suppression étendu d'abord* ; la cible se réécrit sur la qualité des tirs concédés.
7. **La vraie saison** : *avec ses bornes* (les matchs joués, le club tu si deux clubs, « jusqu'ici » si en cours, jamais « a fini », jamais face à une autre époque).
8. **Le texte des cartes** : *les chiffres dérivés, la réplique écrite*.

La suite : A1.
