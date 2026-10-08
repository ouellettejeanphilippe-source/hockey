# La V3 — ça pèse, ça se raconte

JP, le 7 oct., en sept messages :

> *Le jeu se joue tout seul, je n'ai pas beaucoup d'impact, et il ne raconte pas vraiment d'histoire.*
> *Je veux sentir que mes choix comptent, que je dois les faire. Je veux une saison bizarre où un joueur de troisième trio est en feu, comme les 56 buts de Cheechoo, mais pas totalement irréaliste.*
> *Dans les autres modes, le réalisme et rien d'autre ; le roguelike peut être plus funky, tant que ça ne le rend pas trop facile.*
> *Le commentateur, les courriels, tout : je devrais toujours les voir, et ce devrait toujours être quelque chose dont on se souvient, pas un truc que je survole pour cliquer un choix. Beaucoup de choix, en ce moment, je clique n'importe quoi parce qu'ils n'ont aucun poids.*
> *Du réalisme au sens où, si tu y joues mille fois, ça a du sens ; mais un peu de hasard qui crée du mémorable ici et là, assez pour garder ça engageant.*
> *Le roguelike devrait avoir du chaos.*
> *Les cartes, les événements et les autres jouables : il y en a trop, on ne sait jamais comment s'en servir. Des decks pour des moments précis, un maximum, quelque chose qui force à les jouer, à les gérer, pas juste « utiliser ». Regarde ce que font les roguelikes, les jeux de cartes et les jeux de sport.*

## 1. Le diagnostic, en chiffres

Lu dans le code le 7 oct. (le détail des lignes est dans les commits qui suivront).

**Trop de tout.** 528 cartes dans la banque (46 patrons, 160 événements, 67 modifs, 81 consommables, 33 contrats, 123 cartes de match, 18 cartes de saison), 243 cartes de match avec leurs « + », 99 dilemmes, 219 messages à réponses (135 courriels, 84 points de presse). Une saison de Rogue fait **environ 60 décisions forcées et 250 invites facultatives** : un courriel un jour sur deux (93), un point de presse après chaque match (82), huit dilemmes, neuf gros matchs (avant-match, dépistage, main de cinq, entracte, récompense : une quarantaine de choix), trois paliers du deck, trois packs gratuits.

**Rien ne pèse.** Le bruit d'une saison est de ±4,5 victoires. Mesuré (docs/impact-des-choix.md) : un événement vaut 0,03 V en médiane, un dilemme 0,04 V, une carte de match 0,02 V sur son match, un consommable 0,02 V ; une réponse à un courriel, ×1,05 sur la finition pendant trois à cinq matchs — des centièmes de victoire. La seule grosse manette est la confiance III d'un coach (+6 à +8 V sur une équipe bâtie, V2.3). Cliquer au hasard est la stratégie rationnelle : c'est le diagnostic de JP, et il a raison.

**Rien ne se gère.** La main de match a cinq cartes et trois élans, mais le deck n'a **aucun maximum** et grossit à chaque récompense ; la poche (les cartes des packs) n'a **aucune limite** : les cartes s'empilent toute la saison. Personne n'a à choisir quoi garder.

**Rien ne se voit, rien ne reste.** Le commentateur ne parle que si on touche « Regarder » ; « Journée suivante » ne joue jamais le direct. Le courriel du jour disparaît le lendemain. Le seul jalon d'un joueur (10, 20, 30 buts) est une bannière de trois secondes. « Ton histoire » est un journal de décisions, rangé dans un volet. **Aucun fil ne suit un joueur sur sa saison** : ni disette, ni course aux 50 buts, ni recrue qui gagne sa place.

**Rien ne sort de l'ordinaire.** La production est épinglée à la vraie saison (check_parts : au plus 1 % des joueurs de 40 points en font 60). Le seul imprévu est la situation « En feu », jumelée à un « pesant » pour rester neutre.

## 2. Ce que font les autres

- **Le réalisme n'a pas de « main chaude ».** Les études ne la trouvent presque pas (les gardiens de la LNH : arxiv.org/pdf/2102.09689 ; le basket, quelques joueurs seulement : PMC8789340), et les simulateurs de baseball (OOTP) n'en ont pas besoin : les séquences sortent des dés. **Les 56 buts de Cheechoo** (2005-06) viennent de deux choses réelles : la chance au tir (17,7 %) et un changement de contexte — 0,29 but par match avant l'arrivée de Thornton, 0,84 après ; 39 de ses buts sur une passe de Thornton. Notre moteur a déjà les deux : le hasard à chaque lancer, et la création d'un passeur qui fait mieux finir ses compagnons de trio. **Un Cheechoo peut naître d'un choix** (mettre un franc-tireur avec un passeur d'élite) — réaliste sur mille saisons — si le jeu le voit et le raconte.
- **Slay the Spire** : dix cartes en main au plus, trois fioles ; un deck mince vaut plus qu'un deck gros (« deck thinning »), et retirer une carte est une récompense. **Balatro** : cinq jokers, **deux** emplacements de consommables ; une carte se joue ou se vend, elle ne dort pas. **Monster Train / Wildfrost** : peu de cartes, chacune avec un rôle lisible au moment où on la pige.
- **Football Manager** : la causerie d'avant-match se lit contre l'enjeu (favori ou pas), et la dynamique du vestiaire a une mémoire — une promesse non tenue revient. **Hades** : la difficulté (la Chaleur) se choisit, contre plus de récompense.
- **Les jeux de sport à carrière** (MLB The Show, NHL « Be a Pro ») racontent par jalons et par rivalités qui reviennent : le moment dont on se souvient est annoncé, vécu, puis rappelé.

## 3. Les principes

1. **Moins de choix, et chacun pèse.** Un choix forcé doit valoir quelque chose qu'on voit : un but, une victoire, un joueur qui change de rôle. Ce qui ne pèse pas devient automatique ou disparaît.
2. **L'enjeu avant, la conséquence après.** Avant : ce que ça risque, en mots de match. Après : ce que ça a changé — et le moteur peut le dire EXACTEMENT, parce qu'un match se rejoue de sa graine : *« Sans ton changement de trio, vous perdiez 3-2 : le but de Cheechoo n'existe pas. »*
3. **Ce qui raconte se voit toujours, et se souvient.** Un fil de saison par joueur qui en mérite un ; le commentateur dit le moment du soir sans qu'on le demande ; un message reste dans le journal et revient quand sa conséquence arrive.
4. **Réaliste sur mille saisons.** Dans le 82-0 et Sur table, rien de neuf dans le moteur : l'imprévu vient de ce qui existe (la chance au tir, le contexte de ligne) et le jeu le raconte. Les bornes de check_parts tiennent.
5. **Le Rogue a du chaos, pas de cadeau.** Des feux et des disettes rares, des cartes qui bousculent ; la courbe des runs (check_rogue) et le robot (check_robot) disent que ce n'est pas plus facile.
6. **Les cartes se gèrent.** Peu d'emplacements, un deck borné, des cartes liées à un moment ; une main pleine force à choisir ; ce qu'on ne joue pas expire ou se vend.

## 4. Les jalons proposés

Chaque item porte son fichier et sa preuve, comme la V2.

### V3.1 — Ce que ton choix a changé
- **Le contrefactuel du soir.** Après un gros match, une décision de banc ou un « Aligner au mieux » : le même match rejoué sans elle, sur les mêmes dés, et la différence dite en mots (le pointage, le but qui n'existe pas, le joueur qui n'a pas joué). — `js/sim.js, js/saison.js` — preuve : `check_contrefactuel` (la décision retirée, la feuille redevient celle du témoin, au caractère près)
- **L'enjeu avant.** Chaque choix forcé dit ce qu'il risque en chiffres de match (la couche d'impact, V2.2), et rien d'autre. — `js/gerant.js` — preuve : `check_chiffres`

### V3.2 — Le fil de la saison
- [x] **Les arcs.** Le jeu repère, dans les feuilles déjà jouées, ce qui mérite d'être raconté : la course (« sur un rythme de 52 buts »), la séquence et la disette, la recrue, le changement de contexte (« 14 buts en 18 matchs depuis qu'il joue avec Thornton »), le jalon, le retour de blessure. Tous les modes : c'est de la lecture, pas du moteur. — `js/recit.js` (nouveau `fils`) — preuve : `check_fils` (chaque arc cite des feuilles réelles ; aucun arc inventé)
- [x] **La une.** Le bureau ouvre sur la une du jour (le fil qui a bougé), qui reste dans un journal de la saison ; le bilan devient l'histoire de la saison, par fils. — `js/saison.js, js/bilan.js` — preuve : smoke
- [ ] **Le commentateur sans qu'on le demande.** « Journée suivante » montre le moment du soir (le but qui fait avancer un fil), deux phrases du commentateur, et on passe. — `js/saison.js, js/commentaire.js` — preuve : smoke

### V3.3 — Des messages qui comptent
- **Peu, et qui reviennent.** Une dizaine de messages par saison au lieu de 175, chacun attaché à un fil (le joueur en feu qui veut plus de glace, la recrue qui doute, la vedette en disette) ; la réponse pèse (un but, une victoire, un rôle) et revient plus tard dans le fil. — `js/vie-gm.js, js/saison.js` — preuve : `check_vie` (chaque message pèse au moins ce qu'une carte commune peut peser ; chaque réponse a un rappel)
- **Toujours vus.** Un message bloque « Journée suivante » comme un dilemme ; il se lit en deux phrases. — `js/saison.js` — preuve : smoke

### V3.4 — Les cartes se gèrent
- **Des emplacements.** Trois emplacements de cartes de saison (patrons et staff), deux de consommables, comme Balatro ; une carte de plus force à en vendre une. — `js/banque.js, js/inventaire.js` — preuve : `check_banque`
- **Un deck borné, qu'on amincit.** Le deck de match a un maximum ; une récompense peut être de RETIRER une carte ; la main reste à cinq. — `js/combat.js` — preuve : `check_deck`
- **Des cartes de moment.** Une carte se joue à son moment (l'avant-match, l'entracte, la date limite des échanges, les séries), et seulement là ; pigée à son moment, jouée ou perdue. — `js/banque.js, js/combat.js` — preuve : `check_combat`
- **Moins de cartes.** Les familles se fondent en cinq types (V2.4) et la banque passe de 528 à environ 150 cartes qui pèsent ; une carte trop faible pour qu'on la sente part. — `js/banque.js` — preuve : `check_cartes` (chaque carte gardée se voit dans la feuille)

### V3.5 — Les grandes décisions
- **Les chapitres.** La saison se lit en quelques chapitres (le camp, la route, la date limite, le sprint, les séries), chacun avec UNE décision qui pèse (1 à 3 V), payée par un vrai prix. Rogue. — `js/saison.js, js/sim.js` — preuve : `check_choix` (chaque décision de chapitre vaut au moins 1 V ou se voit dans la feuille)
- **Le choix du Cheechoo.** Quand un joueur de bas d'alignement est en feu, le jeu le dit et offre le choix : le monter au premier trio (et risquer le retour sur terre), ou le laisser où il rend. — `js/saison.js` — preuve : `check_fils`

### V3.6 — Le chaos du Rogue
- **Les feux et les disettes.** Rarement, un joueur de ta run sort de sa vraie saison — vers le haut (un Cheechoo) ou vers le bas — dans les bornes de ce que la LNH a vu (la queue de la distribution des % de tir) ; jamais dans le 82-0. — `js/sim.js` — preuve : `check_parts` (le 82-0 inchangé), `check_rogue` (la courbe des runs pas plus facile)
- **La difficulté se choisit** (V2.5) : la Chaleur de Hades, un mandat plus dur contre plus de médailles. — `js/rogue.js` — preuve : `check_rogue`

## 4 bis. Fait

- **V3.2, les arcs et la une** (7 oct.) : `filsDeSaison` (js/recit.js) lit tes feuilles jouées, match après match, et rend huit sortes de fils — la course (un rythme de 40 buts ou 100 points), le jalon, la séquence et sa fin, la disette d'un vrai marqueur et sa fin, le feu (le Cheechoo : 1,6 fois son vrai rythme), le duo (60 % de ses buts sur la passe du même joueur), la recrue, le retour. Un fil qui dure ne revient qu'à un nouveau cran. Le bureau ouvre sur **la une** (le fil le plus lourd d'hier soir, et le but qui l'a fait bouger, dit par `recitDeBut`) ; « Ton histoire » garde ceux qui pèsent (`FIL_MARQUANT`) ; le bilan a sa section « Histoire » (les six plus lourds, où chacun a fini). Aucune ligne du moteur ne bouge. Preuve : `check_fils` (6 s, dans `tout.mjs`) — chaque chiffre se recompte sur les seules feuilles citées, rien ne lit l'avenir ; une saison de 32 clubs : environ 54 fils qui bougent par club, la une un soir sur trois environ.
- **Un dilemme dit un fait vrai** (JP, 7 oct. : *faudrait que ça soit vrai qu'il a eu trois pénalités en deux matchs*) : un dilemme de js/vie-gm.js peut porter une `preuve` ; « La mise au point » ne sort que si un joueur a vraiment pris trois punitions sur ses deux à quatre derniers matchs, et dit lesquelles (« {n} punitions en {m} matchs »). Preuve : `check_vie`.

- **Les messages viennent de quelqu'un** (JP, 7 oct. : *intégrer que les messages sont des trucs du proprio, coach, joueurs, partisans, analystes*) : une seule distribution de voix pour toute la boîte (`EXPEDITEURS`, js/vie-gm.js — les choix forcés du proprio et de l'entraîneur y puisent aussi). Le fil d'hier soir arrive dans la boîte de la voix qui a une raison d'en parler (`messageDuFil`) : la course et le duo, l'analyste à la télé ; le Cheechoo et la séquence, les partisans ; le jalon, le proprio ; la disette, l'entraîneur, puis le joueur quand elle finit ; la recrue, le capitaine ; le retour, le physio. Un soir où un fil bouge, il prend la place du courriel tiré au hasard. Le sujet est le fait du fil au caractère près ; la voix ajoute une opinion, sans chiffre. Preuve : `check_fils`. Reste de la V3.3 : une réponse qui pèse et qui revient dans le fil.

- **Le hasard paie, en Rogue** (JP, 7 oct. : *si des trucs arrivent random, genre justement Cheechoo, c'est là que ça pourrait proc un bonus*) : le soir où un fil NAÎT et fait la une, sa voix paie en jetons (`primesDesFils`, js/rogue.js) — le Cheechoo 10 🪙 (les partisans s'arrachent son chandail), la recrue 5, un jalon de 40 buts et plus 5, un rythme de 50 buts 5 ; au plus 30 🪙 par saison (`PRIME_FILS_MAX`). Rien de neuf dans le moteur : des jetons déduits des feuilles, comme les victoires ; le message du fil dit la prime. Jamais dans le 82-0. Mesuré : environ 15 🪙 par saison en moyenne (de 0 à 30 selon les dés), trois victoires de barème. Preuves : `check_fils` (la prime ne se verse qu'au soir où un fil naît, sous le plafond), `check_rogue` (la courbe des runs, `RUNS=20 CAMPAGNES=3`, sans puis avec la prime : première Coupe d'une campagne à la run 5 en médiane les deux fois, Coupe sans déblocage 0 % → 5 %, tout débloqué 80 % → 65 % — dans le bruit de vingt runs ; 32 vérifications vertes).

## 5. L'ordre proposé

1. **V3.2 (le fil) et V3.1 (le contrefactuel)** d'abord : ils répondent aux deux plaintes (aucune histoire, aucun impact) sans toucher l'équilibre du moteur — on raconte ce que les dés font déjà, et on montre ce que les choix ont changé.
2. **V3.4 (les cartes se gèrent)** ensuite : couper et borner avant d'ajouter.
3. **V3.3 (les messages)**, qui s'appuie sur les fils.
4. **V3.5 et V3.6** : les grandes décisions et le chaos du Rogue, mesurés contre check_rogue.

La V2.4 restante (les cinq types, le prix des rôles, une carte dit ce qu'elle vaut) se fond dans la V3.4.
