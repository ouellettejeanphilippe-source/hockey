<!-- Les consignes de JP (17 oct.), versées telles quelles : le plan du Jalon M de LIVRAISON.md. Les lignes citées sont celles de 41da8b4 ; les dossiers de captures (/workspace/hockey-review/…) sont ceux de l'audit, hors du dépôt. -->

# Consignes · la mise en scène des choix et les correctifs mobiles du Rogue

17 octobre 2026. Base : main à 41da8b4 (lecture seule, rien poussé). Les lignes citées ont été relues sur ce commit. Les mesures viennent de l'audit mobile à 390 × 844 (tactile, DSF 3) et 360 × 740, dans `/workspace/hockey-review/mobile-v9/` et `passe2/`.

JP : *on n'explique pas pourquoi faire un choix plutôt qu'un autre ; pas de mise en scène, pas de contexte narratif.* Le modèle, ce sont les fils (`CHOIX_DES_FILS`, js/vie-gm.js) : une voix, un enjeu, un suivi.

## Ordre des tranches suggéré (une petite PR chacune)

1. **Le bouton flottant et la mise doublée** (B1, B2) : CSS et une ligne de JS. Juge : `essai_rogue`.
2. **La barre « Encore un choix » et les cibles de 44 px** (B4, B5). Juges : smoke `toutEstAtteignable`, `essai_rogue`.
3. **Les scènes, le socle** : le module pur des scènes et sa vérification dans `check_clarte`, puis la mise doublée, les paliers et la carte de trop (A1, A2, A7).
4. **Les scènes, la semaine** : les routes, la blessure, le butin, les rivaux (A3 à A6).
5. **La fin de saison et les galons** (A8, B8) : les galons passent des toasts à « Ta run ».
6. **Le gros match plus court et une seule feuille à la fois** (B3, B7).
7. **Les places, les troncatures, le jargon** (B6, B9, B10).

---

# A. La mise en scène des choix du Rogue

## Le principe

Chaque choix dit :
1. **qui le demande** : une voix d'`EXPEDITEURS` et une phrase, pas juste un titre ;
2. **pourquoi maintenant** : un fait de la saison, lu dans les feuilles déjà jouées (un score, une fiche, un blessé, un adversaire) ;
3. **ce que ça coûte et ce que ça rapporte**, en mots, avec les chiffres en dessous (`bon`, `prix`, `mots`) ;
4. **quand on saura**, comme `motDuSuivi` : « Dans 10 matchs… ».

Les règles qui tiennent toujours (CLAUDE.md, docs/refonte-v9.md § 6.5 et § 6.7) :
- **La voix ne dit aucun chiffre.** Elle dit le fait et y ajoute une opinion (`check_fils`) ; les chiffres vont dans le fait, sous la citation.
- **Moins de mots** : une phrase de voix, pas un paragraphe.
- **Ce qu'un texte affirme d'un match est arrivé**, avec les vrais chiffres (`check_fils`, `check_vie`).
- **Le modèle à copier** : `messageDuFil` (js/vie-gm.js l.1310) rend `{ de, sujet, mot }`, et saison.js l.3589 l'affiche en `recit: « ${x.mot} » ${C.question}`.

**Où mettre les mots.** Un module pur, partagé avec Node : par exemple `js/scenes.js`, ou une section de js/vie-gm.js à côté de `CHOIX_DES_FILS`. Chaque scène est une fonction `sceneDe…(faits)` qui rend `{ de, mot, fait }`, et les mots se pigent par `graine` comme dans `messageDuFil`. S'il s'agit d'un nouveau fichier, l'ajouter à `FICHIERS` de sw.js (`check_coquille`). Pas d'export mort (`check_mort`).

**Le juge commun.** Ajouter une section 5 à `scripts/check_clarte.mjs`, « Chaque choix dit qui le demande ». Pour chaque scène, avec des faits fabriqués :
- `de` est une voix d'`EXPEDITEURS` ;
- `mot` est non vide et ne contient ni chiffre ni accolade (`/\d|\{/`, le même motif que check_fils l.94) ;
- `fait` contient chaque nombre reçu.

Puis, dans `essai_rogue`, chaque `.hub-msg` ouvert d'un genre mis en scène montre une citation « … ».

## Les voix existantes à réutiliser

- **`EXPEDITEURS`** (js/vie-gm.js l.46) : le proprio (il vouvoie), l'entraîneur, l'analyste à la télé, les partisans, le capitaine, le directeur des finances, ton adjoint, un agent de joueur, le physio, le préposé à l'équipement, le service des communications, la ligue, un partisan fidèle, le maire.
- **`DE`** (js/saison.js l.3221) : le médecin, le DG et le dépisteur sont hors d'`EXPEDITEURS`, alors que CLAUDE.md veut « une seule distribution ». Les y verser dans la tranche 3.
- **`VOIX_DES_FILS`** (js/vie-gm.js l.1232) : des répliques déjà écrites, dont celles du joueur lui-même.
- **Le panel télé** (js/panel-tv.js l.57-64), huit personnes nommées. Les plus utiles : Sylvie Archambault (« pose la question que personne ne pose au vestiaire »), Lucien Maltais-Dupré (« rappelle qu'il l'avait écrit ») et Marcel Plourde, partisan en ligne ouverte.
- **Les coachs** (La Tortue, Le Frelon…) et leurs patrons.
- **Le soigneur** (js/sim.js l.8701).
- **Le point de presse**, dont les réponses sont déjà entre guillemets.

## Les 8 choix

### A1. Doubler la mise (note 0)
- **Aujourd'hui** : « Doubler la mise · victoire : +60 🪙 · défaite : 😵 sonnés 6 matchs » (`duel-p3-mise.png`).
- **Qui parle** : le capitaine (`ca`).
- **Exemple** : « Le vestiaire veut doubler. Si on l'échappe, on va traîner ça longtemps. »
- **Le fait** : « 2-1 après deux périodes · tirs 18-22 · Stützle a marqué ».
- **À rappeler** : `moi`, `lui`, les tirs et les buteurs (déjà calculés), le rival, `prime`, `SONNE.duree * MISE_DOUBLEE`.
- **Où** :
  - js/saison.js `ouvrirPeriodeDuDuel` l.3884, à la ligne `mise` l.3898 : en faire `{ de, mot, fait, chiffres }` ;
  - js/gerant.js l.1519 : rendre la citation au-dessus de `.duel-snap`.
- **Critère** : `check_clarte` §5 sur `sceneDeLaMise`, plus `essai_rogue` : `.duel-intention` contient « » et le nom du rival.

### A2. Les paliers des 9e, 18e et 26e matchs (note 0)
- **Aujourd'hui** : « Le DG · Le 9e match : une carte parmi trois · Elle va à une place, et se joue quand tu veux. »
- **Qui parle** : le proprio (vouvoiement).
- **Exemple** : « Je vous ai laissé trois enveloppes sur le bureau. Prenez celle qui nous sort du fond. »
- **Le fait** : « 1-7-1 après 9 matchs · 32e · mandat : faire les séries ».
- **Où** : js/saison.js `messagesCourants`, bloc `pp` l.3494-3500 (`de: DE.dg`, `recit` l.3497).
- **Critère** : `check_clarte` §5 ; le fait contient la fiche et le rang.

### A3. Les routes de la semaine (note 1)
- **Aujourd'hui** : « Une seule des trois, pour la semaine. » Les faits sont là, mais personne n'en tire de conclusion.
- **Qui parle** : l'entraîneur (déjà `DE.coach`).
- **Exemple** : « Les gars sont brûlés pis l'infirmerie déborde. Moi, je les mettrais dans le bain de glace ; c'est toi qui décides. »
- **La règle** : la voix recommande la route qui répond au pire problème d'`etatDuNoeud` (jambes sous 70, blessés, dos-à-dos, caisse), comme le physio l.3605.
- **Où** : js/saison.js l.3376 (`recit`), avec `etatDuNoeud` l.3400, qui doit rendre aussi `pire`.
- **Critère** : `check_clarte` §5 ; la route recommandée est celle qui touche `pire` (jambes vers repos, blessés vers soin).

### A4. La blessure (note 1)
- **Aujourd'hui** : « Le médecin · Al Secord est blessé : 9 matchs · … il sort de ton alignement : qui joue sa case ? »
- **Qui parle** : le médecin pour le diagnostic, puis ton adjoint (`ad`) pour le remplacement.
- **Exemple** : « C'était ton seul bagarreur Or au 3e trio. Demain, personne ne protège ta vedette. »
- **À rappeler** : la case et le badge (déjà dans `note` l.3540), le prochain adversaire, un gros match à venir sur la route.
- **Où** : js/saison.js bloc `alerte` l.3520-3543. Séparer la voix (`recit`) des faits, qui restent en puces.
- **Critère** : `check_clarte` §5 ; `essai_rogue` : la blessure ouverte cite une voix et nomme le prochain adversaire.

### A5. Les 3 rivaux (note 1)
- **Aujourd'hui** : « Le proprio · Tes 3 rivaux · Prends-en 3… Plus il est fort, plus il paie. »
- **Qui parle** : le proprio, et une ligne du panel par club.
- **Exemple** : « Choisissez ceux que vous voulez battre devant moi. » Puis, sur une option : « Maltais-Dupré l'avait écrit : ceux-là vont nous causer des ennuis. »
- **À rappeler** : `forts[x.cinquieme]`, `matchsContre`, et à partir de la 2e run l'historique contre ce club.
- **Où** : js/saison.js bloc `ro` l.3297-3309 (`recit` l.3306, `sous` l.3307).
- **Critère** : `check_clarte` §5 ; chaque option a sa phrase, sans chiffre.

### A6. Le butin d'une victoire (note 1)
- **Aujourd'hui** : « Victoire contre … Une carte pour ton deck, ou retires-en une… »
- **Qui parle** : l'entraîneur (ajouter une carte) contre ton adjoint (en retirer une), une voix par option.
- **Exemple** : « Le coach veut une page de plus dans son cahier ; ton adjoint trouve le cahier déjà trop épais. »
- **Le fait** : le score, et la carte qui a compté si `check_causes` la nomme.
- **Où** : js/saison.js bloc `rc` l.3286-3295 (`de: DE.dg`, `recit` l.3290).
- **Critère** : `check_clarte` §5 ; le fait contient le score de la feuille.

### A7. Une carte de trop (note 0)
- **Aujourd'hui** : « Le DG · Une carte de trop : 3 places · Laquelle vendre ? Ou joues-en une ce soir. »
- **Qui parle** : le préposé à l'équipement (`eq`).
- **Exemple** : « J'ai trois casiers, pas quatre. On en vend une, ou on la sort ce soir ? »
- **À rappeler** : `valeurDe` pour chaque carte, le prochain gros match.
- **Où** : js/saison.js bloc `pl` l.3505-3511.
- **Critère** : `check_clarte` §5.

### A8. La fin de saison et les galons (notes 1 et 0)
- **Aujourd'hui** : « Mandat manqué : il fallait faire les séries. » puis un tableau. Les galons ne sont que des toasts.
- **Qui parle** : le proprio pour le mandat, le capitaine pour chaque galon.
- **Exemples** :
  - le proprio : « Pas de séries. Je ne vous ai pas payé pour regarder le printemps à la télé. »
  - un galon : « Naslund · 40e but, au 71e match, contre Boston » (`texteDuGalon`), puis le capitaine : « On va s'en souvenir dans le vestiaire. »
- **Où** :
  - js/rogue-jeu.js `montrerTaRun` l.1485 (`recit` l.1506, `contexte`) ;
  - `graverLaSaisonRogue` l.1347 doit rendre `neufs`, qui partent aujourd'hui en toasts l.1360.
- **Critère** : `essai_rogue` étape 12c : « Ta run » contient chaque galon compté à 14b (« 3 galon(s) ») et une citation du proprio.

---

# B. Les correctifs UI mobiles, par gravité

### B1. Le bouton flottant écrasé (grave)
- **Ce qu'on voit** : `#hubFlottant` mesuré à **230 × 16 px**, 7 fois en passe 2 (`passe2/ce-soir-places.png`, « Jour suivant · Congé »).
- **La cause** : une boucle. `.btn.go.hub-flottant` (style.css l.614) pose `min-height: var(--flottant-h)`, qui écrase le `min-height: 44px` de `.btn`. Or `mesurer()` (js/saison.js l.626) écrit dans `--flottant-h` la hauteur que le bouton a au moment de la mesure. Quand il est masqué par le CSS (l.615) mais pas `hidden`, il mesure 0, puis à son retour seulement son contenu (14 + 2 = 16 px), et il reste coincé là.
- **La correction** :
  - garder `min-height: 48px` sur le bouton ;
  - ne lire `--flottant-h` que pour la réserve du volet (l.2838) ;
  - dans `mesurer()`, ne rien écrire si la hauteur vaut 0.
- **Critère** : `essai_rogue` à chaque bureau : `#hubFlottant` visible, de 44 px ou plus.

### B2. La mise doublée qui a l'air éteinte (grave)
- **Ce qu'on voit** : une fois touchée, fond sombre, texte sombre, bordure orange (`outil/crops/snap-on.png`).
- **La cause** : `.btn:hover:not(:disabled)` (style.css l.678, spécificité 0,3,0) bat `.duel-snap.on` (l.4156, 0,2,0). Au toucher, le survol reste collé : le fond passe à `--fond-2` alors que le texte reste `--encre-sur-or`.
- **La correction** : mettre les règles de survol de `.btn` (l.678-679) sous `@media (hover: hover)`, et monter `.duel-snap.on` à `.btn.duel-snap.on`. Ajouter une coche (« ✓ Mise doublée »).
- **Critère** : `essai_rogue` avec `hasTouch` : après un toucher, le `background-color` calculé de `.duel-snap.on` vaut `--or`.

### B3. Le gros match trop long (grave)
- **Ce qu'on voit** : la feuille `.choix-corps` d'une période fait 1 752 px pour 765 visibles (2,1 écrans) ; à 360 px, 2,3 écrans.
- **Où** : js/gerant.js `ouvrirMainDeMatch` l.1437 (blocs l.1506-1525).
- **La correction** : une fois le geste choisi, l'intention se plie en une ligne (« 🥷 L'ombre · ✓ Naslund au 2e trio »). Le plan et « Ce qu'ils jouent ce soir » restent pliés, et « Jouer » reste à l'écran.
- **Critère** : `essai_rogue` à 390 × 844, geste choisi : `scrollHeight` de `.choix-corps` au plus 1,3 fois sa hauteur visible, et `.main-jouer` à l'écran.

### B4. La barre « Encore un choix » (grave)
- **Ce qu'on voit** : la barre collée (style.css l.2822) cache les options du choix ouvert :
  - les rivaux, options de y 711 à 884 sous une barre à 787 ;
  - le fil, de 734 à 871 ;
  - le physio, de 797 à 877.
- **Son mot** : il recopie tout le sujet sur deux lignes, en rouge (« ⏳ Encore un choix : Naslund doit 8 de ses 12 buts… », js/saison.js l.3776-3779, style l.3036).
- **La correction** :
  - le volet réserve la hauteur de la barre (`padding-bottom` mesuré) ;
  - le mot devient court (« ⏳ Encore un choix · Tes rivaux ») ;
  - le toucher fait défiler jusqu'au choix (l.3846) ;
  - une teinte neutre plutôt que `--mauvais`.
- **Critère** : `essai_rogue` : aucune `.af-option` du choix ouvert sous le haut de `.hub-barre` après le défilement (la mesure `sousBarre` de l'audit, à reprendre).

### B5. Les cibles sous 44 px (moyen)
- **Ce qu'on a mesuré** :
  - `.rt-arret` 28 px (l.2797) ;
  - `#teteCartes` 34 (l.321) ;
  - `.hub-actions-rang .btn` 36 (l.2836) ;
  - `.aln-saut` 36 (l.4230) ;
  - `.af-encours > summary` 32 (l.3082) ;
  - `.ej-r` 32 (l.2409) ;
  - `.slot-remove` 28 × 28 (l.2549) ;
  - `.slot-name` 15 (l.2558) ;
  - `.af-chiffres` 24 (l.959) ;
  - `.sig-changer` 31 (l.1494) ;
  - `#searchInput` 18 (l.765) ;
  - à 40 : `.close-btn` (l.714), `.seg button` (l.725), `.main-outils .btn` (l.4186), `.pcard .btn-sign` (l.1487).
- **La correction** : 44 px de hauteur ou une zone de toucher élargie (`::before`, `inset: -8px`).
- **Critère** : une garde `cibles44` dans smoke, à côté de `toutEstAtteignable` : tout bouton, `summary` ou `[role=button]` visible fait au moins 44 × 44 de zone touchable, avec une liste d'exceptions nommées.

### B6. Les infos tronquées en 12 px (moyen)
- **Ce qu'on voit**, en `--t-1` (12 px, l.108) avec `nowrap` et `ellipsis` :
  - `.pcard-dest` (l.1439) : « 1ER TRIO · MASSE +5,6 M$ · +0,5 PT DE PRÉCISION, +0,4 TIR » coupé ;
  - `.slot-roles` (l.2605) ;
  - `.ct-ligne` (l.4846) ;
  - `.hub-msg-pris` (l.3070) ;
  - `.jr-sous` (l.4760) ;
  - `.live-eq-nom` (l.3504).
  - En plus, la gemme `.tc-gemme` fait 8,4 px (l.3988).
- **La correction** : deux lignes (`-webkit-line-clamp: 2`) et 12,5 px au moins. `.pcard-dest` se coupe en case et masse, puis l'effet.
- **Critère** : `essai_rogue` à 390 px : sur ces sélecteurs, `scrollWidth` ne dépasse pas `clientWidth` ; aucune police sous 10 px hors des icônes.

### B7. Les feuilles empilées (moyen)
- **Ce qu'on voit** : jusqu'à 3 feuilles ouvertes à la fois, par exemple « qui sort » = `#signatureModal` + `#choixModal` + la boutique `.pk-sheet`. La feuille de « qui sort » fait 3,8 écrans (4,3 à 360 px).
- **Où** : js/repechage.js l.517 (`feuilleDeJoueurs` sur `choixModal`), l.767 ; js/magasin.js l.122.
- **La correction** : une seule feuille visible, par js/pile.js ; « qui sort » remplace la liste au lieu de s'y empiler, et montre d'abord les trois sorties proposées.
- **Critère** : `essai_rogue` : au plus une `.choix-sheet` visible à chaque capture.

### B8. Les toasts et les galons (moyen)
- **La cause** : `toast()` (js/game.js l.1147) n'a qu'un élément et efface le précédent. Les galons partent à 900 ms d'écart (js/rogue-jeu.js l.1360), alors que chaque toast dure au moins 1 800 ms : seul le dernier se lit.
- **La correction** : une file d'attente dans `toast()`, et les galons dans « Ta run » (A8).
- **Critère** : `essai_rogue` : chaque galon de l'étape 14b est lisible à « Ta run ».

### B9. Les places (léger)
- **Ce qu'on voit** : « Tes places » est au bas de « Ce soir », qui fait 1 418 px pour 641 visibles. Les tuiles ne disent pas ce qu'un toucher fait, et deux copies identiques ne sont pas groupées (`passe2/ce-soir-places.png`).
- **Où** : js/saison.js `caseHtml` et `placesHtml` l.2375-2382, style l.2989-2997.
- **La correction** : un verbe par tuile (« Jouer · ou vendre +N 🪙 »), un « ×2 » pour les doublons, et la section remontée sous le match du soir.
- **Critère** : `essai_rogue` : chaque `.hub-poche-case` contient un verbe, et `.hub-poche` est à moins d'un écran du haut du volet.

### B10. Le jargon (léger)
- **Ce qu'on voit** :
  - « Mason · ,898 (ligue ,904) contre Hebert » (js/saison.js l.1583) ;
  - « Ton alignement : Systèmes : … Badges +,005 arr. … Chimie : rien ce soir » (l.3155) ;
  - « DP 1–2 » et « @ PHI '13 » sur la route (l.723) ;
  - « m. » pour les matchs.
- **La correction** : des mots (« Mason arrête mieux que la moyenne de la ligue »), le détail chiffré seulement dans « Les chiffres ».
- **Critère** : des entrées de plus dans `MOTS_RESERVES` de `check_clarte` (l.129), avec leurs témoins, par exemple `/\(ligue ,\d/` et `/\bDP \d/`.

### Le test « essai_rogue » sur `.vs-jalon` : pas de PR à faire
L'erreur « le vestiaire ne montre pas les jalons » venait de **mon outil d'audit**, pas du test. Mon générateur réécrivait `$$eval` avec `String.replace`, qui change `$$` en `$`, donc `$eval(...).length` donnait `undefined`.

Revérifié sur 41da8b4 : `ouvrirVestiaire()` rend **17** `.vs-jalon` dans `#choixModal`, et `scripts/essai_rogue.mjs` l.1209 utilise bien `$$eval`. Rien à corriger.
