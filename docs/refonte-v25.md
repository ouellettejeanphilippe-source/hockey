# V25 — La suite, pour aujourd'hui : le moteur, les cartes, les histoires, l'interface

Le devis, au gabarit de `docs/gabarits/devis.md`, fait avec la commande `/refonte` (5 nov. 2026) : quatre inventaires en lecture seule (le moteur, les cartes et l'économie, les événements et les choix, l'interface), puis ce devis. À juger par `/revue-design docs/refonte-v25.md` avant la première tranche. **Rien n'est codé** : JP tranche d'abord, sur les questions au bas.

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

Les modes ne bougent pas d'une règle : le 82-0 reste le repêchage puis la saison d'un coup et les séries match par match, sans carte ; le Rogue garde son jour à jour, son coach, son duel au plan, sa boutique ; Sur table et Sur glace gardent leurs règles physiques. Ce qui suit, c'est ce qu'ils partagent.

### A. Le moteur : un noyau, des greffes

**Un seul chemin pour jouer un match.** Tout match se joue en trois périodes (`jouerEnPeriodes`, qui existe), avec une liste de **greffes** reçues du mode : une greffe est `{ quand(e, periode), canaux, adv }`, lue à chaque période, et c'est tout ce que le moteur sait du Rogue. Le 82-0 n'en passe aucune : le match ordinaire d'aujourd'hui, à la feuille près (les totaux se calibrent une fois, `check_lancers`, `check_neutre`). Le Rogue en passe : ses pouvoirs, ses adjoints et leurs relais, le plan de la période, le coach adverse en séries, les mutations posées, les moments. Le gros match n'est plus un chemin : c'est un match dont les périodes sont vues une à une à l'écran, ce que `jouerEnPeriodes` sait déjà faire.

**Ce qui est du Rogue sort de sim.js** dans un module qui le porte, `js/greffes.js` : les pouvoirs posés, les adjoints posés et le relais, les plans, les moments, les situations, les mutations, l'expérience du coach, les séjours, les suivis, les histoires appliquées. sim.js redevient le moteur : le hasard, les zones, les lignes, l'affinité, les jambes, les blessures, le lancer, le gardien, les punitions, les unités spéciales, la ligue au jour le jour, les séries, l'alignement automatique. Le contrat entre les deux tient en trois fonctions : `greffesDuSoir(ligue, match)` (ce que le mode pose avant le match), `apresLeMatch(ligue, feuille)` (ce que le mode compte après : l'expérience, les séjours, les suivis), `appliquerChoix(ligue, decision)` (une décision prise à l'écran). La ligue ne connaît que ce contrat.

**Une seule source pour ce que les trois modes copient.** Le hasard et le hachage : `generateur`, `gauss`, `hache` et `entierDeGraine` dans js/util.js, lus par sim.js, table.js et physique.js ; la mulberry32 et la gaussienne de physique.js, et `hacherMise`, partent. La force d'un joueur : une lecture, `forceDe(p)` dans js/ratings.js, dérivée du coffre comme `cote20` l'est déjà, lue par le moteur, par Sur table (à la place des `*RelDe` pris directement) et par Sur glace (à la place de sa conversion à elle). Les constantes d'époque des punitions (`AVANTAGES_EPOQUE`, la durée, le taux) : Sur table et Sur glace gardent leurs règles physiques (leur `punir`, leur fusillade : ce sont d'autres jeux), mais lisent les chiffres d'époque du moteur plutôt que les leurs.

**L'affichage sort du moteur** : `lectureDuMatch` et `CADRE_DU_MATCH` vont dans js/impact.js, les mots (`motsDEffet`, `totauxDuSoir`, `motsDesTotaux`, `motCourbe`, `penaliteAffichee`, `motPenalite`) dans js/recit.js. Le moteur rend des chiffres et des feuilles ; il ne fait plus de phrases.

**La défensive, enfin mesurée plutôt qu'encadrée.** MOTEUR.md § 9 : « la défensive individuelle reste approximée », `K_DEFENSE` encadré entre 0,029 et 0,050 faute de signal, la corrélation des lancers contre avec l'alignement à −0,17. La suite ajoute un étage sous le lancer : la **possession** (une entrée de zone, un porteur, une sortie : un lancer, un revirement, un dégagement). Les revirements et les vols par joueur sont dans les shards depuis 2005-06 et à la fiche ; ils ne jouent qu'au club. Une possession par joueur donne à la défensive un canal qui lui appartient et qui ne se confond pas avec le gardien. Mesure d'abord, en paires et en retenue, comme le temps de glace inféré (docs/decisions.md, 31 oct.) ; c'est la tranche la plus incertaine, et elle est la dernière du moteur.

### B. Les cartes : un objet, une échelle, une grammaire

**La carte de joueur reste telle quelle** (JP, deux fois) : `cartonHtml`, `carteCouchee`, `dosDeCarton`, les 55 séries `.cs-*`, les éditions Base à Holo (le « shiny » par-dessus le joueur, qui monte ses paliers de badges). Elle ne bouge pas d'un pixel.

**Tout le reste est une carte de jeu, et il n'y a qu'une carte de jeu** : `carteHtml`, un squelette, pour le pouvoir du coach, l'adjoint, le coach lui-même (qui n'avait pas de carte), le plan d'une période, la réponse d'une histoire, le joueur offert (la carte de joueur enchâssée, comme aujourd'hui), la carte de l'adversaire. La tuile de choix (`optionHtml`) part : un choix, c'est deux ou trois cartes de jeu face à face, ce que la V23 B voulait et n'a fait qu'à moitié. Le paquet de récompense et la pochette de boutique fusionnent en un seul objet scellé, la pochette.

**Une seule grammaire d'effet**, `js/effets.js` : `{ quand, canaux, adv, lui, jetons, xp, duree }`. `quand` est la seule forme de déclenchement (elle remplace `quand(e)`, `signal.quand(e)` et `si`) ; `canaux` et `adv` sont les canaux du moteur d'aujourd'hui ; `lui` ce qui va au joueur nommé ; `jetons` et `xp` ce qui va à la caisse et au coach ; `duree` en matchs. Et **le texte se dérive de l'effet** : `motsDe(effet)` rend le gros chiffre, les lignes vertes et les rouges, dans les mots que `check_mots` exige déjà (le `bon` nomme les lignes vertes que le moteur montre). Plus de `dit`, de `texte`, de `bon`, de `prix` écrits à côté de l'effet et qui finissent par mentir (la réplique du butin).

**Une seule échelle de rang** : `NIVEAUX` (Soutien, Régulier, Pilier, ★ Étoile, ★ Phénomène), pour le joueur (déjà), le coach (`MAITRISE` disparaît dans `NIVEAUX`), l'adjoint (déjà presque), le pouvoir, la carte de jeu. `RARETES` et ses quatre clés partent, avec les quatre ponts. **Une seule table de bornes** en victoires, `BORNE_V` par niveau : 1 · 1 · 1,5 · 2,5 · 4 (les chiffres de `BORNE_NIV`, qui sont ceux de la règle), lue par tous les juges. Les éditions restent la seule deuxième échelle, et elle n'habille que la carte de joueur : un Soutien peut sortir en Holo, c'est le shiny.

**Moins de systèmes de progression.** Onze aujourd'hui ; la suite en garde six, chacun lu par un autre : le niveau (ce que vaut une carte), les éditions (le shiny du joueur), le coach (ses pouvoirs, son expérience, sa règle), la main d'adjoints (ses règles sont celles de la V24 : la condition, l'horloge, le relais, le salaire), la main du deck (les cartes de jeu gagnées aux paliers), le méta (déblocages, crans, jalons, prestiges). Partent : les galons (affichage seul, lus par une seule ligne de rogue-jeu.js ; leur trace va au verso de la carte du joueur, où une rare laisse déjà la sienne), `effetCarte` (la recrue seule), `CARTES_MATCH` et js/combat.js (l'adversaire d'un gros match du 82-0 devient un `persoAdverse`, comme en séries), les restes morts.

### C. Les histoires : une banque, un module de faits, une porte

**Une seule banque**, `js/histoires.js`, et chaque entrée a la même forme : `{ de, moment, quand(f), joueur(f), fait(f), mots(f, j), options, suite, rare }`. Le `moment` dit quand elle peut sortir : le lundi, la veille d'un gros match, un entracte, une ronde de séries, un jour fixe de la saison. Les douze avant-matchs, les douze situations, les entractes, les incidents et les ajustements de séries **deviennent des entrées de cette banque** avec leur moment, et leurs tables de sim.js partent. Les quatre choix de fil aussi. Un seul tirage, `tirer(graine, moment, faits, sorties)`, les règles d'aujourd'hui (le repos de cinq semaines, deux sorties par saison au plus, jamais deux fois le même joueur, une rare par saison, la suite avant le tirage).

**Les options d'une histoire sont des cartes de jeu** (B), avec la grammaire d'effet : plus de `gain`, `xp`, `adjoint`, `action`, `lui`, `pari` à part. Le pari est un `quand` tiré au dé, et le dé reste la rondelle qui tourne.

**Les faits sortent de l'écran** : `js/faits.js`, `faitsDe(ligue, jour)`, tout ce que `faitsDuLundi`, `faitsDesJoueurs`, `faitsDuProprio`, `faitsDeLaCourse`, `faitsDuDernier`, `faitsDesSuites` et `faitsDuMatin` lisaient, en un objet, lu dans les feuilles jouées et la cédule connue, rien d'avance. Il gagne **la vraie saison** : pour chaque joueur, ce qu'il a fait cette année-là dans la vraie ligue (les shards l'ont, l'onglet Joueurs le montre déjà). Une histoire peut alors dire « dans la vraie vie, il a fini la saison à 52 buts ; chez toi, il en a 11 après 40 matchs » : la banque lit l'histoire vraie, elle ne la réécrit pas à la main.

**Les répliques nomment**. `mots(f, j)` reçoit le joueur et les faits : la voix dit son nom, son chiffre, son club. Les dix-sept voix restent.

**Une seule porte** : `appliquerChoix` (A), pour tout choix pris à l'écran, et **une seule promesse suivie** : `engagerSuivi`, `suivisEnCours`, `retoursDuMatin`, qui existent et savent déjà faire tomber une promesse avec un joueur parti ; js/verdicts.js part.

**Quarante histoires au lancement de la V25** (treize aujourd'hui), écrites avec `rogue-recit`, par famille de fait (la disette, la chaude, la blessure, le dos-à-dos, la route, le fond, le sommet, le petit, le gardien, la chicane, le contrat, la vraie saison), chacune pour un moment ; la cible du rythme ne change pas (`mesure_rythme` : aucun trou de plus de dix matchs), et une run de trois saisons ne revoit aucune histoire sur le même joueur.

### D. L'interface : une grammaire pour les cinq modes

**Un module de composants, pour tout le jeu** : `js/composants.js`, qui remplace js/plateau-rogue.js et le dépasse. La grammaire de la maquette A (le bandeau, les jetons, la carte et sa ligne, le coin, la grille, les cellules, le visage, le billet, la marche, le podium) plus ce qui manque pour que les autres pages n'aient plus de gabarit à elles : **une** rangée d'onglets, **un** segment, **un** bouton et ses variantes, **un** bloc (le panneau avec son bandeau), **une** liste de rangées (ce que treize tableaux font), **une** feuille (ce que neuf modales font), **un** toast, **une** jauge. Chaque mode l'appelle avec ses données et sa couleur ; aucun ne redessine.

**style.css réécrit par sections, dans cet ordre** : les jetons ; les composants ; le carton (les 1 880 lignes, telles quelles) ; puis, par mode, **seulement ce qui n'existe que là** : le plateau de Sur table (la glace, les pièces), le canevas et le HUD de Sur glace, la roulette du 82-0. Zéro `body.mode-rogue` : la règle d'interface.md le dit déjà, le juge le mesurera (`check_css` : aucun sélecteur de mode). Cible : 7 402 → moins de 5 000 lignes, sans toucher au carton.

**Les écrans se refont sur maquettes**, comme le plateau du Rogue : pour le 82-0 (la roulette, le vestiaire, l'alignement, le bilan), Sur table, l'exhibition et l'écran de Sur glace, des maquettes à 390 × 844 dans la grammaire, deux directions chacune, JP tranche, le code reproduit. Les douze pages du Rogue ont déjà leur maquette (A) ; les hybrides (le Classement et les Meneurs en tableau du direct, le Proprio en `.pr-bloc`, le Calendrier en `.calj`) se refont avec les composants.

**Une seule navigation** : les cinq écouteurs `keydown` de mode passent par js/manette.js, les trois sorties de mode par `[data-retour]` et js/pile.js ; les 78 lignes d'atelier du 82-0 d'index.html sont construites par le JS du mode qui les montre, et le Rogue ne les cache plus.

## 5. Les chiffres

- **Les totaux du moteur ne bougent pas** : 3,06 à 3,11 buts par match, 28,2 à 28,5 lancers, les quatre égalités de la feuille (MOTEUR.md § 7) ; une saison du 82-0 avant et après la tranche A rend les mêmes buts par match à ±0,02 (`check_lancers`, `check_neutre`, `check_feuilles`). Le même numéro de graine ne rendra pas la même saison : `VERSION_MOTEUR` monte (S142), et la partie en cours se rejoue avec les nouvelles règles, comme à chaque changement du moteur (js/game.js l. 760 le dit au joueur).
- **Les bornes** : `BORNE_V` = [1, 1, 1,5, 2,5, 4] V par niveau, la même pour une carte de jeu, un adjoint, un pouvoir ; le personnage complet (coach + main) sous 16 V ; le coach adverse neutre à ±1,5 V (les chiffres d'aujourd'hui, `check_pouvoirs`, `check_gros`).
- **La profondeur, la vraie cible de la suite** : l'attentif contre le robot du premier choix, aujourd'hui +4,5 V par saison (seuil 5, rouge). La suite pose le seuil à **8 V** : moins de systèmes au même budget de victoires, c'est la même profondeur concentrée sur moins de choix, et chacun doit se lire. L'attentif contre le distrait reste au-dessus de 15 V ; la première Coupe de l'attentif à la run 3 ou plus tard, celle du robot d'avant au moins une run après la sienne (ce qui n'est pas le cas aujourd'hui : les deux à la run 6 et 4).
- **Le rythme** : aucun trou de plus de 10 matchs sans décision, au moins une histoire par quart de saison ; aucune histoire revue sur le même joueur dans une run de trois saisons (`mesure_rythme`, à étendre).
- **La possession** (A, dernière tranche) : la corrélation des lancers contre avec l'alignement défensif passe de −0,17 à au moins 0,35 sur 2005-06 et après, en retenue sur les saisons qui ont les revirements ; la défense se sépare des attaquants (aujourd'hui 0,450 contre 0,452) ; sinon la tranche ne se livre pas.
- **L'interface** : style.css sous 5 000 lignes ; zéro sélecteur de mode ; les douze pages du Rogue et les pages des autres modes faites des composants (le compte des classes locales par page, `check_composants`).

## 6. Les cas limites

- **La vieille partie** : les clés de sauvegarde ne bougent jamais ; une décision d'avant (un adjoint à un poste d'alors, un soin, une option de dossier par sa clé) se relit ; une partie dont le `moteur` diffère se rejoue avec les nouvelles règles, et le jeu le dit (ce qui existe) — `check_sauvegardes`.
- **Une histoire sans porteur** : `quand(f)` faux, elle ne sort pas ; la liste blanche de `check_incidents` reste pour les trois d'équipe.
- **Le joueur parti** fait tomber la promesse et la suite, et ça se dit — `check_suivis`.
- **Les séries** : les ajustements deviennent des histoires au moment « ronde » ; le coach adverse reste une greffe ; les séries se rejouent match par match — `check_series_pas`, `check_gros`.
- **La fin de saison et la fin de run** : le mandat, les médailles, le remboursement des pochettes scellées : rien ne change.
- **Hors ligne** : sw.js liste les modules neufs (greffes, effets, histoires, faits, composants) et oublie les partis — `check_coquille`.
- **Le clavier et la manette** : une seule navigation, donc chaque écran de chaque mode répond à A, B, Échap et au balayage — smoke, `essai_rogue`.
- **Sur table et Sur glace** : leur jeu ne change pas d'une règle ; leurs replays changent (le générateur unique), ce qu'aucune sauvegarde ne garde — `check_table`, `check_physique`.

## 7. Ce qu'il touche

Les fichiers, par tranche (§ Les tranches) :

- **A, le moteur** : `js/sim.js`, `js/game.js`, `js/impact.js`, `js/recit.js`, `js/util.js`, `js/ratings.js`, `js/table.js`, `js/physique.js`, `js/sur-glace.js`, `js/greffes.js` (neuf), `js/saison.js`, `js/banc.js`, `js/bilan.js`, `sw.js`, `MOTEUR.md`, `.claude/rules/moteur.md`, `scripts/check_empreinte.mjs`.
- **B, les cartes** : `js/cartes.js`, `js/effets.js` (neuf), `js/rarete.js`, `js/niveaux.js`, `js/pouvoirs.js`, `js/adjoints.js`, `js/coachs-reels.js`, `js/gerant.js`, `js/alignement.js`, `js/packs.js`, `js/banque.js`, `js/inventaire.js`, `js/magasin.js`, `js/rogue.js`, `js/rogue-jeu.js`, `js/galons.js`, `js/combat.js`, `style.css`, `sw.js`, `.claude/rules/rogue.md`, `scripts/check_pouvoirs.mjs`, `scripts/check_effets.mjs`, `scripts/check_cartes.mjs`.
- **C, les histoires** : `js/histoires.js` (neuf), `js/faits.js` (neuf), `js/dossiers.js`, `js/scenes.js`, `js/vie-gm.js`, `js/arcs.js`, `js/verdicts.js`, `js/saison.js`, `js/sim.js`, `js/greffes.js`, `sw.js`, `.claude/rules/rogue.md`, `scripts/check_dossiers.mjs`, `scripts/mesure_rythme.mjs`.
- **D, l'interface** : `js/composants.js` (neuf), `js/plateau-rogue.js`, `style.css`, `index.html`, `js/saison.js`, `js/gerant.js`, `js/bilan.js`, `js/repechage.js`, `js/alignement.js`, `js/joueurs.js`, `js/magasin.js`, `js/inventaire.js`, `js/cartable.js`, `js/equipes.js`, `js/fiche.js`, `js/direct.js`, `js/entracte.js`, `js/game.js`, `js/plateau.js`, `js/tournoi.js`, `js/exhibition.js`, `js/sur-glace.js`, `js/manette.js`, `js/pile.js`, `sw.js`, `.claude/rules/interface.md`, `scripts/check_plateau.mjs`, `scripts/check_css.mjs`.

**Les règles fermes touchées** (chacune réécrite pour décrire le neuf, jamais défaite en silence) :
- moteur.md : les règles qui nomment `playGame` et ses chemins, et « tout le hasard passe par `hasard()` » (respectée : un seul générateur, dans util.js).
- rogue.md : « une carte change la FORME du match, pas sa force ; le net en victoires est borné par la rareté (commune ±1…) » devient « borné par le niveau (`BORNE_V`) », les mêmes chiffres ; « les adjoints ne s'achètent pas », « le gros match se règle le jour où il se joue », « aucun joueur ne te suit au choix » : respectées ; « V22 : la banque neuve commence à six histoires… le système reste » : la banque devient la seule (les tables de sim.js y entrent).
- interface.md : le contrat du plateau devient le contrat des composants, pour les cinq modes.
- tests.md : les juges renommés ou neufs (§ 9).
- **Les clés de sauvegarde ne bougent jamais** (`check_sauvegardes`).

## 8. Ce qui part

La pièce maîtresse. Chaque nom ci-dessous disparaît du jeu (js/, index.html, style.css, sw.js), et `check_refonte` le vérifie à la PR de sa tranche. Le test du zéro : chaque module neuf (greffes, effets, histoires, faits, composants) s'écrit à partir de ce devis et des règles, sans relire l'ancien ligne par ligne ; c'est une refonte.

### A. Le moteur

- Les quatre chemins de playGame : `jouerSoixanteMinutes`, `jouerDuel`, `simulerGrosMatch`, `apres40De` ; un seul reste, le match en trois périodes avec ses greffes.
- Les doubles du hasard : `hacherMise` ; la mulberry32 et la gaussienne de js/physique.js (mêmes noms que celles qui restent, dans util.js : le juge les compte en lignes).
- Les lectures de la force propres à un mode : `pctTirRelDe`, `lancersRelDe`, `passesRelDe` (Sur table les prenait tels quels), `parametresDuPatineur`, `parametresDuGardien` (Sur glace), remplacées par une lecture dans ratings.js.
- L'affichage qui vivait dans le moteur, parti de sim.js vers impact.js et recit.js (il bouge, § 8b).
- Les vingt-six pierres tombales de sim.js, et la ligne d'historique de VERSION_MOTEUR (elle va dans docs/moteur-recalibrer.md ; la constante reste).

### B. Les cartes

- Les squelettes en trop : `optionHtml`, `grosChiffre`, `paquetHtml`, `mainAdverseHtml`, `.choix-option-nom`, `.choix-option-gros`, `.choix-option-bon`, `.choix-option-prix`, `.main-adverse-carte`, `.ej-coach-tete`, `.paquet`.
- Les vocabulaires de rang en trop : `RARETES`, `NOMS_NIV`, `MAITRISE`, `RARETE_NIV`, `RARETE_POUVOIR`, `PALIERS_RARETE`, `rareteDeSalaire`, `COTES_CARTES`, `BORNE_NIV`.
- Les systèmes isolés : `js/galons.js`, `GALONS`, `GALONS_MAX`, `galonsDeLaSaison`, `scripts/check_galons.mjs` ; `effetCarte` ; `js/combat.js`, `CARTES_MATCH`, `mainAdverse`, `energieAdverse`, `FRANCHISE_MATCH` ; `PARTIS`.
- Le juge cassé : `scripts/check_cartes.mjs` (ce qu'il promettait, `check_effets` le mesure déjà en paires).

### C. Les histoires

- La banque et son tirage d'aujourd'hui, refaits dans histoires.js : `js/dossiers.js`, `DOSSIERS`, `dossierDeLaSemaine`, `semaineAHistoire`, `sceneDuDossier`, `dossierOuvert`, `motsDuDossier`, `motsConcrets`.
- La deuxième banque de sim.js : `AVANT_GROS`, `SITUATIONS`, `JOURS_SITUATIONS`, `ENTRACTES`, `INCIDENTS`, `AJUSTEMENTS`, `avantDuCombat`, `entractesOfferts`, `effetEntracte`, `ajustementsOfferts`, `situationsDuJour`, `effetDeSituation`, `AMPLEUR_CHOIX`.
- Les faits écrits dans l'écran : `faitsDuLundi`, refaits dans faits.js.
- Les trois chemins pour un seul : `CHOIX_DES_FILS`, `VOIX_DES_FILS`, `messageDuFil`, `voixDuFil`, `filOuvert`, `pariDeDecision`, `familleDeMoment`, `effetDeMoment`, `appliquerGestes` (une porte, appliquerChoix).
- La promesse en double : `js/verdicts.js`, `verdictsDeLaSemaine`.
- La machine d'arcs vide : `js/arcs.js`, `episodesDuMatin`, `faitsDuMatin`, `ordreDesArcs`, `ARCS_PAR_SAISON`, `DEFIS`, `avanceDuDefi`, `motDuDefi`, `scripts/check_arcs.mjs` (un défi devient une suite d'histoire).

### D. L'interface

- Le module d'une page : `js/plateau-rogue.js` (refait en composants.js, pour tout le jeu).
- Les surcharges de mode : `body.mode-rogue` (72 règles), `.en-cartes`.
- Les onglets en trop : `.stat-tabs`, `.stat-tab`, `.inv-onglets`, `.inv-onglet`, `.ct-vues`, `.ct-vue`, `.eq-onglets`, `.hub-onglets`, `.live-onglets`, `.sousnav`, `.soustab`.
- Les segments et filtres en trop : `.seg-view`, `.seg-effectif`, `.chip-need`, `.inv-filtres`, `.inv-filtre`, `.hub-chips`, `.t-seg`, `.pm-seg`, `.live-filtre`.
- Les panneaux en trop : `.dash-card`, `.hub-carte`, `.hub-volet`, `.hub-boite`, `.hub-tuile`, `.pr-bloc`, `.mcard`, `.niv-tuile`, `.bl-tuile`, `.eq-carte`, `.cjv-panneau`, `.ent-carte`, `.pk-tuile`.
- Les tableaux en trop : `.hub-table`, `.rl-table`, `.jr-table`, `.eq-table`, `.ent-table`, `.cjv-table`, `.niv-table`, `.exh-tableau`, `.sig-liste`, `.live-tableau`.
- Les feuilles en trop : `.choix-modal`, `.choix-sheet`, `.live-sheet`, `.hub-sheet`, `.table-sheet`, `.main-sheet`, `.ct-feuille`, `.t-feuille`.
- Les jauges en trop : `.bu-run-jauge`, `.tuile-jauge`, `.hub-barre`, `.ff-barre`, `.ej-jauge`, `.impact-barre`, `.exh-barre`, `.inv-pl-barre`, `.pl-barre`.
- L'atelier du 82-0 écrit dans index.html et caché en Rogue (les 78 lignes, construites par le mode).

## 8b. Ce qui reste, et ce qui bouge

**Reste tel quel, et pourquoi** :
- La carte de joueur : `cartonHtml`, `carteCouchee`, `dosDeCarton`, `cartonDe`, les 55 séries `.cs-*`, `EDITIONS`, `NOM_VARIANTE`, `VARIANTE_PALIERS` — JP, deux fois : *garder les cartes actuelles du jeu*.
- Le noyau du lancer et ses juges : `profilMatch`, `jouerCote`, `facteurGardienDe`, `tirageDe`, `compterFeuilles`, `hasard`, `deDuJour`, `jouerEnPeriodes` — une seule source, prouvée (MOTEUR.md § 6, § 7).
- Le coach-personnage et sa main : `POUVOIRS`, `ADJOINTS`, `REGLES_DU_COACH`, le relais — les idées qui ont fait du Rogue un jeu (V21 à V23) ; elles changent de grammaire d'effet, pas de règle, et les règles des adjoints sont celles que la V24 fixe.
- L'économie : `jetonsDe`, `baremeRogue`, les packs et leurs prix, `DEBLOCAGES`, `PRESTIGES`, `JALONS` — une caisse recomptée des décisions, lisible (docs/revue-rogue-2026-11.md).
- Les suivis : `engagerSuivi`, `suivisEnCours`, `retoursDuMatin` — la promesse suivie qui sait déjà tomber avec un joueur parti.
- La coquille : les cinq portes, `js/pile.js`, `js/glisser.js`, `js/manette.js`, les jetons `:root`, les palettes — la seule grammaire qui a tenu depuis la 1.0.
- Les règles de Sur table et de Sur glace (leurs punitions, leurs fusillades, leur IA) — d'autres jeux, à part exprès (JP : *les modes de jeux doivent être séparés*).
- Les dix-sept voix (`EXPEDITEURS`) et les scènes (`js/scenes.js`) — elles parlent ; elles apprendront à nommer.

**Bouge sans changer de nom** (le juge ne le compte pas, le diff le montre) : `lectureDuMatch`, `CADRE_DU_MATCH` vers impact.js ; `motsDEffet`, `totauxDuSoir`, `motsDesTotaux`, `motCourbe`, `penaliteAffichee`, `motPenalite` vers recit.js ; les pouvoirs posés, les adjoints posés, le relais, les plans, les moments, les mutations, l'expérience, les séjours vers greffes.js ; `generateur`, `gauss` vers util.js.

## 9. Les réglages

| Constante | Valeur | Plage sûre | Au-delà |
|---|---|---|---|
| `BORNE_V` (par niveau) | 1 · 1 · 1,5 · 2,5 · 4 | les chiffres de la règle | au-dessus, une carte seule casse le jeu ; en dessous, rien ne se voit dans la feuille |
| Le seuil de profondeur (attentif − premier choix) | 8 V | 6 à 10 | sous 6, lire ses choix ne paie pas ; au-dessus de 10, le distrait ne gagne jamais rien |
| Le trou du rythme | 10 matchs | 8 à 12 | au-dessus, la saison est un couloir ; en dessous, le soir ordinaire n'existe plus |
| Les histoires au lancement | 40 | 30 et plus | sous 30, une run de trois saisons se répète |
| La possession, part des lancers contre lue au joueur | à mesurer | 0 (l'équipe seule, aujourd'hui) à 0,5 | au-dessus, la défense compte la production deux fois |
| style.css | < 5 000 lignes | | au-dessus, des sections de mode ont repoussé |

## 10. Les critères d'acceptation

- [ ] Un seul chemin de match : `playGame` n'a plus d'aiguillage ; le 82-0 rend les mêmes buts par match à ±0,02 et les mêmes lancers à ±0,2 avant et après — `check_lancers`, `check_neutre`, `check_feuilles`, `check_graine` (à la nouvelle version).
- [ ] sim.js n'importe plus un module du Rogue ; greffes.js est le seul à les importer — `check_mort` (les imports), un juge d'imports à écrire : `check_couches`.
- [ ] Un seul générateur, un seul hachage, une seule lecture de la force pour les trois modes — `check_couches`, `check_table`, `check_physique`.
- [ ] Toute carte de jeu passe par `carteHtml` et toute carte porte un effet de effets.js dont le texte est dérivé ; aucun texte d'effet écrit à la main — `check_mots` (étendu : le texte égale `motsDe(effet)`), `check_lisibilite`.
- [ ] Une seule échelle de rang et une seule table de bornes ; chaque carte, adjoint et pouvoir sous `BORNE_V` de son niveau, et se voit dans la feuille le soir où il joue — `check_effets`, `check_pouvoirs`, `check_relais`, `check_banc`.
- [ ] Une seule banque d'histoires : rien de ce qui s'offre au joueur ne vient d'ailleurs que histoires.js ; chaque entrée a une voix, nomme son joueur, dit ses vrais chiffres, et ses options sont des cartes — `check_dossiers` (refait pour la banque), `check_incidents`, `check_clarte` § 5, `check_choix`.
- [ ] Les faits se lisent dans faits.js, jamais dans l'écran ; rien d'avance — `check_moments_si`, `check_fils`, `check_vie`.
- [ ] Le rythme : aucun trou de plus de 10 matchs, une histoire par quart, aucune histoire revue sur le même joueur en trois saisons — `mesure_rythme` (étendu).
- [ ] La profondeur : l'attentif bat le robot du premier choix de 8 V par saison ou plus ; la première Coupe de l'attentif à la run 3 ou plus tard, celle du robot d'avant au moins une run après — `check_profondeur` (le seuil monte à 8).
- [ ] L'interface : zéro sélecteur de mode dans style.css, moins de 5 000 lignes ; chaque page de chaque mode faite des composants (le compte des classes locales par page) — `check_css` (étendu), `check_composants` (ce que `check_plateau` fait pour douze pages, pour toutes).
- [ ] Une seule navigation : chaque écran de chaque mode répond à Échap, B, A et au balayage — smoke, `essai_rogue`.
- [ ] Pas une couche de peinture : ce qui part est parti, le jeu retire au moins une ligne pour deux ajoutées, style.css fait moins de la moitié du diff — `check_refonte docs/refonte-v25-<tranche>.md` à chaque PR.
- [ ] La vieille partie se relit et se rejoue — `check_sauvegardes`.
- [ ] Hors ligne — `check_coquille`.
- [ ] À juger par JP à l'essai : les maquettes des écrans du 82-0, de Sur table, de l'exhibition et de Sur glace (deux directions chacune, à 390 × 844) ; les quarante histoires, lues sur une run capturée (`essai_rogue CAPTURES_PAGES=1`) ; que le match en trois périodes du 82-0 se sente comme avant.

## Les tranches

Dans l'ordre. Chacune est une ou plusieurs petites PR, porte **son extrait du § 8** dans `docs/refonte-v25-<lettre>.md` (sa partie « Ce qui part » et « Ce qu'il touche », copiées d'ici), et passe `check_refonte` sur cet extrait avant la PR ; `/revue-design` juge ce devis une fois, avant A, et l'extrait de D avant D (les maquettes).

1. **A1 · Le noyau et les greffes** — un chemin dans `playGame`, greffes.js, le contrat en trois fonctions, l'affichage sorti du moteur, les pierres tombales, `VERSION_MOTEUR` S142 — `check_lancers`, `check_neutre`, `check_feuilles`, `check_gros`, `check_duel`, `check_pouvoirs`, `check_couches` (neuf).
2. **A2 · Une source pour trois modes** — le hasard et la force dans util.js et ratings.js, lus par table.js et physique.js — `check_table`, `check_physique`, `check_couches`.
3. **B1 · Une grammaire d'effet et une échelle** — effets.js, `motsDe`, `NIVEAUX` partout, `BORNE_V`, les ponts et les raretés partis, `check_cartes` parti — `check_effets`, `check_pouvoirs`, `check_relais`, `check_banc`, `check_mots`.
4. **B2 · Une carte de jeu** — le choix en cartes, le coach en carte, l'adversaire en `persoAdverse`, la pochette, les galons au verso — `check_lisibilite`, `check_choix`, `essai_rogue`, `essai_packs`.
5. **C1 · Les faits et la banque** — faits.js avec la vraie saison, histoires.js avec les moments, les deux banques fondues, une porte, une promesse ; les treize histoires d'aujourd'hui réécrites dans la forme neuve — `check_dossiers`, `check_incidents`, `check_clarte`, `check_suivis`, `check_moments_si`.
6. **C2 · Quarante histoires** — avec `rogue-recit`, par famille de fait et par moment ; `mesure_rythme` étendu — `mesure_rythme`, `check_profondeur` (le seuil à 8 se mesure ici pour la première fois ; rouge, on continue, on ne baisse pas).
7. **D1 · Les composants et la feuille** — composants.js, style.css réécrit par sections, zéro surcharge de mode, les douze pages du Rogue sans hybride — `check_composants`, `check_css`, `check_plateau` (le temps de la migration), `check_mort`.
8. **D2 · Les autres modes sur maquettes** — le 82-0, Sur table, l'exhibition, Sur glace : maquettes en deux directions, JP tranche, le code reproduit ; une navigation — smoke, `essai_rogue`, `check_coquille`.
9. **A3 · La possession** — la dernière, la plus incertaine : mesurée en retenue avant d'être jouée ; ne se livre que si la défense se sépare du gardien et des attaquants (§ 5) — `mock_moteur`, `check_ratings`, `check_monotonie`, un `check_possession` à écrire.

## Les questions à JP

Six, comme pour la V23. Chacune change une tranche.

1. **Le gros match du 82-0 en trois périodes vues** (A1) : aujourd'hui le 82-0 regarde ses gros matchs avec un entracte à 40:00 et un choix ; avec un seul chemin, il les regarde période par période, sans choix (pas de carte au 82-0). Oui, ou garder l'entracte unique comme une greffe du 82-0 ?
2. **Les galons partent** (B2), leur trace au verso de la carte du joueur. Oui ?
3. **Le seuil de profondeur à 8 V** (C2, § 5) plutôt que 5 : on accepte que `check_profondeur` reste rouge plus longtemps, et on ne le baisse pas. Oui ?
4. **La vraie saison dans les histoires** (C1) : une voix qui dit « dans la vraie vie, il a fini à 52 buts » casse-t-elle le fantasme (tu joues ta version de 1993) ou le nourrit-elle ? Oui, non, ou seulement au verso de la carte ?
5. **Les écrans du 82-0, de Sur table, de l'exhibition et de Sur glace sur maquettes** (D2) : deux directions chacune, ou une seule dans la direction A du Rogue, déjà tranchée ?
6. **La possession** (A3) : on la fait, mesurée en retenue, ou on la laisse à la V25 et la V25 s'arrête à D2 ?
