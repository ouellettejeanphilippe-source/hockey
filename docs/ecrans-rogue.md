# Les écrans du Rogue, refaits à neuf

18 octobre 2026. Après le jeu de cartes neuf (docs/refonte-v10.md), JP a tranché : *les écrans du Rogue refaits à neuf, maquettes d'abord*. Le Jalon M (docs/mise-en-scene-et-mobile.md) y passe : ses tranches 6 à 8 attendaient ces écrans.

## Le principe

Un écran, une intention, sans défiler, à 390 × 844. Ce qui ne tient pas dans l'écran n'y est pas : il est à un toucher (une enveloppe, le dépistage complet, « Les chiffres »). Une seule feuille à la fois. Chaque choix dit qui le demande (une voix), pourquoi maintenant (le fait, en vrais chiffres) et ce qu'il rapporte (ses options). Le bouton du bas dit toujours ce qui reste à faire.

## Les six maquettes (canevas privé de JP, « Écrans du Rogue, maquettes »)

1. **Le Bureau, un lundi à deux choix.** L'en-tête et ses quatre chiffres (fiche, rang, jetons, cartes ›). Le mandat en une ligne et sa jauge. Le prochain match en une ligne (› Ce soir). À faire en **enveloppes** : la voix, sa réplique, le fait, une flèche — l'enveloppe ne s'ouvre pas dans la page, elle ouvre sa feuille. « Déjà tranché » en une ligne. Hier soir : le pointage et la une. La route : les sept prochains soirs en puces (le gros match à ses couleurs). En bas : « 2 choix à trancher › », puis « Trancher » quand tout est coché, puis « Jour suivant ».
2. **Une enveloppe ouverte.** Une feuille par-dessus le Bureau (et seule) : la voix et le titre, sa phrase en grand, le fait en puces, deux ou trois réponses à cocher. Celle que la voix recommande porte « Ce que l'entraîneur ferait ». « Garder ce choix » coche et rend le Bureau ; « Ensuite : le médecin › » ouvre l'enveloppe suivante. La barre « Encore un choix » disparaît.
3. **Ce soir.** L'affiche (les deux clubs, leur fiche et leur forme), les deux vedettes. Trois chiffres en barres face à face (tirs, précision, arrêts) et l'avantage en une phrase. Tes places, sous l'affiche, chacune avec son verbe. Tes lignes en une rangée (› Changer). Le dépistage complet à un toucher. En bas : « Jouer ce soir ▶ ».
4. **Le duel, 2e période.** Le pointage en grand, aux couleurs de l'adversaire, les trois périodes en pastilles. L'enjeu en une ligne. L'intention répondue, pliée : « 🥷 L'ombre sur Dvorak · ✓ Contrée par La vedette se libère ». Le dossier de la période, plié pareil. La main en éventail (elle dure les trois périodes), l'élan en pastilles. « Jouer la 2e période » ne quitte jamais l'écran.
5. **La mise, avant la 3e.** Le capitaine, sa phrase, le pointage contre le rival nommé ; les deux issues côte à côte (jetons, matchs sonnés) ; « ✓ Mise doublée » dans l'or. L'intention de la 3e, ouverte : c'est elle qui reste à jouer.
6. **La fin de saison.** Le mandat en grand et le proprio qui le dit. La fiche. Les galons de la saison, un par ligne, avec le match et l'adversaire, et le mot du capitaine. Ce que la run rapporte (médailles, cartable, déblocages). La suite.

## Les tranches

Une petite PR chacune ; le juge de chacune est nommé.

- [x] **E1 · La fin de saison et les galons** (M6 : A8, B8). Le proprio dit le mandat (`sceneDuMandat`) ; les galons de la saison se relisent dans l'histoire de chacun chez toi et s'écrivent au bilan, dans la run et dans « Ta run », sous le capitaine (`sceneDesGalons`) ; `toast()` a sa file d'attente. Juges : `check_clarte` § 5, `essai_rogue` (12c, 12d).
- [x] **E2 · Le gros match plus court, une feuille à la fois** (M7 : B3, B7). L'intention et la carte de vestiaire se plient en une ligne une fois répondues ; la mise doublée a son panneau ; les fenêtres empilées se cachent sous la dernière ouverte (style.css, `.choix-modal`). Juges : `essai_rogue` (20j : 1,3 écran au plus, « Jouer » à l'écran ; 20k : jamais deux feuilles).
- [x] **E3 · Les places, les troncatures, le jargon** (M8 : B6, B9, B10). Un verbe par tuile (« Jouer · ou vendre +8 🪙 »), les doubles groupés, les places sous l'affiche ; deux lignes plutôt qu'une coupée ; le % d'arrêts et les matchs en mots, la route dit « chez ». Juges : `essai_rogue` (10b), `check_clarte` (les mots réservés).
- [x] **E4 · Le Bureau en enveloppes.** À faire ne se déplie plus dans la page : chaque choix est une enveloppe (la voix, le sujet, sa réplique) ; l'ouverte devient une feuille par-dessus le Bureau, sa tête et son pied collés (« Plus tard », « Ensuite : … › »), ses options `optionHtml` telles quelles ; complète, la suivante s'ouvre. D'où tu viens et la route en puces ; « Autour de la ligue » plié. Mesuré : le Bureau passe de 1,61 à 1,35 écran. Juges : `essai_rogue` (10c ; chaque enveloppe ouverte cite sa voix ; sa première option se touche, rien ne la couvre ; le lot part d'un seul « Trancher »), smoke.
- [x] **E5 · Ce soir en trois chiffres.** Les tirs, la précision et le % d'arrêts en barres face à face, aux couleurs des deux clubs ; l'avantage en une phrase ; le tableau complet, les forces, les totaux du soir et ce qui est en jeu au dépistage. Mesuré : Ce soir à 1,58 écran (ses places au bas, sous le bouton flottant) : à reprendre avec E6. Juges : `essai_rogue` (10d : trois rangées en barres).
- [x] **E6 · La main du duel en éventail.** Les cartes du cahier en une rangée qui se balaie (E2) ; le pointage en tête de la feuille, aux couleurs de l'adversaire, avec les trois périodes en pastilles (jouées, à jouer, à venir) : il ne disparaît plus quand l'intention se plie ; les buteurs se relisent au sommaire. Mesuré : au geste pris, une période tient à 1,27 écran au plus. Juges : `essai_rogue` (20j), aucun changement au moteur.

## Ce qui reste

- **Ce soir à un écran** : 1,5 à 1,8 écran selon le soir (l'affiche, les lignes et les places).
- **Le Bureau à un écran** : 1,35 à 1,7 écran ; ce qui varie, c'est « Hier soir » (le drame, la une, les nouvelles).

## La revue du 25 octobre : contre EHM, New Star Soccer et MLB The Show

Le chantier, relancé par JP le 25 octobre : passer chaque écran du Rogue contre EHM, New Star Soccer et MLB The Show, et dire ce qui reste, ce qui part et ce qui se fusionne. La boussole, 24 oct. : *quelqu'un qui a joué à EHM, New Star Soccer, MLB The Show mobile se retrouve facilement… on simplifie sans perdre la complexité*. Chaque écran a été capturé à 390 × 844 dans une run jouée du classeur au gros match de la 28e journée ; la page avec les captures : https://claude.ai/artifact/CXUsbFYXA6BCDiTZjhLwgC.

### Ce que les trois apprennent

- **EHM** : la boîte de réception où chaque message porte sa décision, et « Continuer » qui s'arrête à ce qui compte ; l'effectif en tableau triable ; les trios, l'AN et le DN dans un même écran ; le personnel ; le rapport sur l'adversaire avant le match ; la direction qui juge (sa confiance, ses attentes, l'argent) ; les changements entre les périodes. La tactique s'y règle pour l'équipe d'abord (une unité ou un joueur, pour qui le veut).
- **New Star Soccer** : un accueil qui dit le prochain rendez-vous et l'état des gens autour de toi (le coach, les coéquipiers, les partisans, les commanditaires) ; des choix courts qui les bougent ; le match où tu ne joues que tes moments ; très peu d'écrans.
- **MLB The Show** (Diamond Dynasty) : la collection, la boutique de packs et leurs chances, l'ouverture d'un pack, la carte recto verso ; le capitaine qui fait mieux jouer les joueurs de son genre ; Showdown, une course repêchée avec un boss au bout.

Ce que les trois ont en commun et que le Rogue n'a pas : **un écran ne renvoie pas à un autre pour régler ce qu'il montre**. Le message d'EHM porte ses boutons ; l'événement de New Star Soccer s'ouvre et se règle là ; le pack de MLB s'ouvre dans la boutique. Le Rogue range chaque choix sous une maison (V12) : la Boîte le nomme, le sous-onglet le règle, et la maison n'est pas toujours celle de la voix (le proprio parle au Marché › Butin, l'entraîneur au Vestiaire).

### Écran par écran

**Le départ d'une run**

| Écran | Repère | Verdict | Ce qui change |
|---|---|---|---|
| L'intro et l'exigence | Showdown : l'enjeu en une ligne | Reste, allégé | Une ligne d'enjeu ; l'inventaire (« 20 Soutien, 3 Régulier… 2 packs… 4 réservistes… ») va à la page des règles. La feuille s'ouvre par-dessus le repêchage du 82-0 (« Maple Leafs de Toronto · Autre année · Passer ») : le fond doit être le Rogue. |
| Ton coach | DD : le capitaine | Reste | « Tes patrons » devient « Ton personnel » (fait). |
| Ton joueur de concession | DD : la carte de départ | Se fusionne avec Ton coach | Un écran : ton coach, puis ton joueur dessous. |
| Le classeur, case par case | Showdown : le repêchage | Reste | |
| L'avant-saison aux Lignes | EHM : les trios avant le premier match | Reste | |

**Bureau**

| Sous-onglet | Repère | Verdict | Ce qui change |
|---|---|---|---|
| Boîte | EHM : l'accueil et la boîte ; NSS : l'accueil | Reste | Les choix se règlent depuis la Boîte, une ligne par choix qui l'ouvre en plein écran (V21 ; c'était « ouverts sur place ») ; un matin sans choix, elle n'est pas vide : Hier soir, le prochain match, ton rang. |
| Proprio | EHM : la direction et l'argent ; NSS : la jauge du patron | Reste | Ses dossiers (la masse salariale, la tête du coach) se rangeaient au Vestiaire : ils sont chez lui, et « L'infirmerie déborde » à l'infirmerie (fait, `maison` d'un dossier). Les rivaux disaient « 1 gros matchs » (fait). |
| Entraîneur | EHM : le personnel | Reste, allégé | « D'où tu viens » part (Hier soir et le calendrier disent les résultats) ; la route de la saison va au calendrier ; l'adjoint d'un palier y arrive (voir le Butin). |
| Presse | EHM : les conférences de presse arrivent dans la boîte | Part | Vide presque tous les jours (« Rien à régler ici ») ; ses micros et ses courriels sont des messages de la Boîte, et la une est déjà dans Hier soir. |
| Vestiaire | NSS : la jauge des coéquipiers ; EHM : la dynamique du vestiaire | Reste, allégé | Ce qu'il montre toujours (les fils suivis, ton histoire) ; ses choix s'ouvrent de la Boîte. « Ce qui court » et « Ton histoire » affichaient « Un match à la galerie de presse pour {nom} » (fait). |

**Effectif**

| Sous-onglet | Repère | Verdict | Ce qui change |
|---|---|---|---|
| Joueurs | EHM : l'effectif | Reste | Prend les blessés en filtre 🩹, à côté d'Avants, Défenseurs, Gardiens. Le tableau glisse aussi à l'horizontale (566 px pour 368) et coupe les noms : il garde ses colonnes de jeu, le reste à la fiche. |
| Lignes | EHM : les trios, l'AN, le DN | Reste, allégé | Cinq onglets deviennent quatre : Équipe part (ses chiffres par match vont à l'avant-match, sa glace aux Attaque) ; sans systèmes, le pied « Système · Volume de tirs · Régler » et sa fenêtre partent (docs/sans-systemes.md). |
| Dépistage | EHM : le rapport sur l'adversaire | Reste, allégé | Nommé « Avant-match » ; déplié, il fait 2,2 écrans : le tableau des rangs y est deux fois, les conseils de système partent avec eux ; « ton agressivité » n'était plus un réglage (fait). |
| Infirmerie | EHM : les blessés vivent dans l'effectif | Se fusionne avec Joueurs | Le filtre 🩹 montre qui est blessé et qui joue sa case ; le choix du médecin s'ouvre de la Boîte. Défait la V12-2 (« la santé à l'infirmerie ») : à trancher. |

**Marché**

| Sous-onglet | Repère | Verdict | Ce qui change |
|---|---|---|---|
| Boutique | DD : la boutique | Reste, allégé | Les packs d'abord. Avant le premier pack, quatre blocs : les absents (l'infirmerie), la masse salariale (le proprio), le barème (la page des règles), la chance d'une Or : ils partent ou se plient. |
| Butin | — | Part | Depuis la V16, il n'y reste que l'adjoint d'un palier, que le proprio offre et qui s'engage chez l'entraîneur : trois maisons pour un choix. Il va chez l'entraîneur ; le reste du temps, l'onglet est vide. |
| Album | DD : la collection | Reste | |
| L'ouverture d'un pack | DD : l'ouverture | Reste | L'en-tête dit « Butin » pour un pack acheté : « Boutique ». « Un outil se joue chez ce qu'il touche » devient « une carte rare se joue chez ce qu'elle monte » (fait). |
| Qui sort ? | EHM : libérer un joueur | Reste, allégé | 4,2 écrans : toute la formation, case par case. La meilleure sortie d'abord (elle y est), les autres pliées par ligne. |
| Tes cartes (le bouton de l'Album) | — | Part | L'inventaire d'avant la V16 : « Permanent 0 » pendant que l'entraîneur compte « Tes cartes du personnel · 1 ». Une carte rare se joue chez ce qu'elle monte ; il disait aussi « consommable » (le mot, fait). |

**Le match**

| Écran | Repère | Verdict | Ce qui change |
|---|---|---|---|
| Le direct | EHM : le match en texte | Reste | Son fil fait 7 écrans à la fin : c'est un fil, ça défile. |
| Le sommaire | EHM : la feuille et les trois étoiles | Reste | « Tes choix ce soir » : « Patrons » devient « Personnel » (fait) ; la ligne « Systèmes » part avec eux. |
| Le gros match (le duel) | NSS : tes moments ; Showdown : le boss ; EHM : l'entracte | Reste, allégé | Avant la 1re période, deux décisions s'empilent (leur intention, puis la carte du vestiaire) avant que l'adjoint parle : la carte du vestiaire passe au matin, dans la Boîte. « Garder tirer de partout » devient « Garder ton plan » (fait). Après la 3e, aucun écran de résultat : on revient au Bureau, « Gros match perdu ». Le pointage final en grand, le butin ou les sonnés, comme la fin d'un boss de Showdown. |
| La mise doublée | Showdown : le tout pour le tout | Reste | |
| Le dé d'un pari | NSS : le pari | Reste | |

**Ligue**

| Sous-onglet | Repère | Verdict | Ce qui change |
|---|---|---|---|
| Classement | EHM : le classement | Reste | Toucher un club ouvre son effectif (ce que fait l'onglet Équipes). |
| Ta saison | EHM : le calendrier | Reste, allégé | Nommé « Calendrier » : c'est le calendrier. Il prend la route de la saison et « D'où tu viens » de l'entraîneur. La prévision du moteur et ton style restent dessous. |
| Meneurs | EHM : les meneurs de la ligue | Reste | |
| Équipes | EHM : la fiche d'un club, ouverte du classement | Se fusionne avec Classement | |
| Palmarès | EHM : l'histoire du club | Reste, refait | En Rogue, il montre l'historique du 82-0 : « Aucune saison enregistrée. Complète un alignement de 23 et simule » et un deuxième « Ton album ». Il doit montrer le panthéon du club (records, trophées, chandails retirés) et tes runs. |

**La fin de saison et autour**

| Écran | Repère | Verdict | Ce qui change |
|---|---|---|---|
| Le Bureau, saison finie | EHM : la fin de saison s'ouvre d'elle-même | Part | Un bouton « Voir le bilan » et un titre « Autour de la ligue » vide : le bilan s'ouvre directement. |
| Ta run | Showdown : l'écran de fin de course | Reste | « Rien ici. » traîne au pied de la feuille. |
| Le bilan de saison | EHM : la revue de saison | Reste, allégé | Une seule page de 6 écrans (15 après des séries) et huit sauts (Résumé, Histoire, Chiffres, Rythme, Forces, Ton impact, Cartes, Vestiaire) : quatre onglets qui tiennent chacun en un écran, Rythme, Forces et Ton impact aux Chiffres, Cartes et Vestiaire à l'Histoire. Après des séries, il parlait encore de « tes patrons » et de « tes places » (fait). |
| La fiche d'un joueur | DD : la carte recto verso | Reste | |
| Le menu pause | partout | Reste | « Tes cartes » y double l'Album du Marché. |
| Les déblocages | DD : les programmes | Reste | Son intro parlait encore des « cartes de trio (systèmes, styles, atelier, synergies) », parties à la V16 (fait). |
| La page des règles | EHM : le manuel | Reste | 13,7 écrans : c'est sa place, le détail chiffré y vit. |

**Les séries.** Le Bureau en séries n'a pas de sous-onglets : il garde le match en une ligne et l'adjoint peut jouer la série pour toi (« L'adjoint joue cette série »). À vérifier : entre deux matchs, la ligne du match a dit « M1 NHL Stars 2–1 · 0-1 » pendant que l'en-tête disait « mène 1-0 ».


### La carte qui en sort

| Section | Aujourd'hui | Proposé |
|---|---|---|
| Bureau | Boîte · Proprio · Entraîneur · Presse · Vestiaire | Boîte · Proprio · Entraîneur · Vestiaire |
| Effectif | Joueurs · Lignes (Équipe, Attaque, Défense, AN · DN, Filet · réserve) · Dépistage · Infirmerie | Joueurs (🩹 en filtre) · Lignes (Attaque, Défense, AN · DN, Filet · réserve) · Avant-match |
| Marché | Boutique · Butin · Album | Boutique · Album |
| Ligue | Classement · Ta saison · Meneurs · Équipes · Palmarès | Classement · Calendrier · Meneurs · Palmarès |

Dix-sept sous-onglets et cinq onglets de Lignes, soit vingt-deux pages, deviennent treize et quatre, soit dix-sept, et l'inventaire « Tes cartes » part. Rien de ce qu'on règle ne part : la Presse, le Butin et l'Infirmerie gardent leurs choix, qui s'ouvrent de la Boîte ; les Équipes s'ouvrent du Classement. Ce qui part, ce sont des pages qu'on visite pour rien : la Presse et le Butin sont vides presque tous les jours.

### Ce que JP tranche

1. **Régler dans la Boîte** (EHM) plutôt que la Boîte qui renvoie au sous-onglet (V12-1) : un toucher de moins par choix, et la voix reste celle qui parle. Les sous-onglets gardent ce qu'ils montrent toujours.
2. **La Presse dans la Boîte** et **le Butin chez l'entraîneur**.
3. **L'Infirmerie dans Joueurs** : défait la V12-2.
4. **Équipes dans Classement**, **Ta saison devient Calendrier**, **le Palmarès refait pour le Rogue**.
5. **Lignes › Équipe** : ses chiffres à l'avant-match, sa glace aux trios ; le Dépistage devient « Avant-match ».

JP, 25 octobre : *good* — les cinq, tels quels.

### Fait (V18-5)

| Ce qui change | Où | Ce qui le tient |
|---|---|---|
| **On règle dans la Boîte.** Un choix s'ouvre sur place sous sa maison, un à la fois — au matin, celui qui attend ; « ⏳ Encore un choix » l'ouvre là. *V21 (oct.) : la Boîte n'a plus que les lignes ; une ligne ou « ⏳ » ouvre le choix en plein écran (JP : *une boîte de réception, pas les messages*).* Les sous-onglets Proprio, Entraîneur et Vestiaire ne montrent plus que leur part (`PERMANENT`), sans choix ; le compte des sous-onglets part avec eux. | js/saison.js `rendreActions`, `vueMaison` ; js/game.js `majSousNav` ; js/coquille.js | `essai_rogue` : chaque choix réglé l'est dans la boîte, aucun sous-onglet n'en porte, trois maisons au moins |
| **La Presse dans la Boîte.** Ses micros et ses courriels sont des lignes de la boîte, sous « La presse » ; la une revient à Hier soir. | js/saison.js `MAISONS`, `voletJourneeSeul` | |
| **Le Butin chez l'entraîneur.** L'adjoint d'un palier se choisit sous l'entraîneur, qui l'engage. | js/saison.js `maisonDe` | |
| **L'Infirmerie dans Joueurs.** Le filtre 🩹 d'Effectif › Joueurs : qui est blessé, qui joue sa case, les cartes de soin. Défait la V12-2. | js/joueurs.js ; js/saison.js `infirmerieHtml`, prêtée par `tabs.hub.infirmerie` | `essai_rogue` 10c |
| **Équipes dans Classement.** En Rogue, toucher un club du classement ouvre sa feuille ; « ‹ Classement » et le retour y reviennent. Le 82-0 garde son onglet Équipes (les 44 franchises). | js/saison.js `voletClassement`, `clubsAuClassement` | |
| **Ta saison devient Calendrier.** La route de la saison et tes matchs joués ; « D'où tu viens » part de chez l'entraîneur, qui garde les deux semaines qui viennent. | js/saison.js `voletFiche`, `routeDeuxSemaines` | |
| **Le Palmarès du club.** En Rogue : ta vitrine, le panthéon (records, chandails retirés, trophées) et tes runs (`meta.lesRuns`). Ils vivaient aux déblocages ; l'historique du 82-0 et l'album qu'il déduisait (js/album.js) partent du Rogue. | js/rogue-jeu.js `palmaresDuClubHtml` ; js/game.js `showLeaderboard` | |
| **L'Avant-match.** Le Dépistage du Rogue s'appelle l'Avant-match ; son tableau des rangs n'est plus redit. Lignes › Équipe part derrière le banc : ses chiffres par match y étaient déjà (« Attendu ce soir », « Ton alignement ») ; « Devant le filet » passe sous Filet · réserve. | js/saison.js `forcesHtml` ; js/alignement.js `renderRoster` ; js/banc.js ; style.css | |

Vingt-deux pages deviennent dix-sept : Bureau (Boîte · Proprio · Entraîneur · Vestiaire), Effectif (Joueurs · Lignes · Avant-match ; Lignes : Attaque · Défense · AN · DN · Filet · réserve), Marché (Boutique · Album), Ligue (Classement · Calendrier · Meneurs · Palmarès).

Restent, de l'écran par écran plus haut : l'intro sur le fond du Rogue et le coach fusionné avec le joueur de concession ; le tableau de Joueurs qui glisse ; la boutique, les packs d'abord ; « Qui sort ? » plié par ligne ; l'en-tête « Butin » d'un pack acheté ; « Tes cartes » (l'inventaire d'avant la V16, au bouton de l'Album et au menu pause) ; la carte du vestiaire d'un duel au matin et son écran de fin ; le Bureau d'une saison finie qui ouvre le bilan ; « Rien ici. » au pied de Ta run ; le bilan en quatre onglets ; la ligne du match en séries.
