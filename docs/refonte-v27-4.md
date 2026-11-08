# V27, tranche 4 — Le calendrier placé et le renfort

L'extrait de la tranche 4 du devis de la V27 (docs/refonte-v27.md, § 4.4, § 5, § 6, § 9, § 10 et « Les tranches »), au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 8 nov. 2026. Le devis entier prime : cet extrait dit seulement ce que la tranche 4 livre, ce qu'elle fait partir et comment on le prouve. Elle se construit sur la branche `claude/v27-run`, après les tranches 2 et 3, et sort vers main avec les tranches 2 à 6.

## 1. Ce que JP a dit

- JP, 7 nov. 2026, au devis : le calendrier se place au premier soir de chaque acte, après l'annonce du rival ; ce qu'on recule renforce le club (*il faut vraiment bloquer le snowball* : placer n'est jamais gratuit).
- Sur les maquettes (docs/maquettes/v27.html, 7 nov.) : *Maquettes ok* ; *montrer, pas dire* ; *garder une partie du coloré et broadcast actuel* ; *faut des logos*. La maquette 3 est « Placer ses matchs » : la bande de l'acte, la grille des cases (le numéro, l'écusson, le sigle), « Choisi », « Échangeable », « Plus fort », le « +2 » sur la case, l'échange dessous (« BOS 31 → 47 », « Boston +1 ✦ », « Détroit · Gratuit »).
- JP (4 nov. 2026), tenu : *une info, une maison* ; *jamais une longue page*.

## 2. Ce que le joueur ressent

« Au premier soir de l'acte, je regarde mes 27 prochains matchs et je décide qui je joue quand : les gros clubs plus tard, mais ils arrivent plus forts. » Le pic : le soir où l'acte commence, après le rival annoncé. Le jour ordinaire ne change pas : le Calendrier montre l'acte en cases, le « +2 ✦ » suit le club à l'affiche, au Calendrier et au Face à face, et Jour suivant reste un geste.

## 3. Les règles du jeu (ce que la tranche code ; le devis, § 4.4)

- **Quand** : au premier soir de chaque acte (aucun match de l'acte joué), une fois le rival annoncé (`riv:a`), une ligne de la boîte, « Ton calendrier », bloque « Jour suivant » ; la toucher ouvre l'écran (rien ne s'ouvre seul). Une fois l'acte commencé, il ne bouge plus : la ligne n'existe qu'à ce soir-là (*cal:a*).
- **L'écran** (la maquette 3) : la grille des cases de l'acte (*caseDeMatch*), six de front ; seules les cases qui s'échangent sont allumées (leur écusson en couleur, le filet bleu), les autres en sourdine (le rival, les cases sans échange possible). Toucher une case la choisit (blanche) ; ses partenaires s'allument, en or ceux qui renforceraient un club (« Plus fort »), et ceux d'un acte plus loin sous « Plus loin ». Toucher un partenaire échange les deux adversaires : **deux touchers**. Dessous, le dernier échange (« BOS 31 → 47 », « +1 ✦ » ou « Gratuit » pour chacun), « Annuler » (défait le dernier) et « Valider » (« Garder la cédule » si rien n'a bougé).
- **L'échange** (*echangeables*, *echangerTesCases*, js/actes.js) : deux de tes cases à venir, l'une dans l'acte, l'autre dans l'acte ou un acte plus loin, jamais le match d'un rival, jamais deux fois le même club ; l'échange des deux clubs ces deux jours-là (*echanger*, celui des rivaux) garde à chaque club 82 matchs, un par jour, sinon il n'est pas proposé.
- **Le renfort** (*renfortDe*, *renfortsDe*) : compté depuis la cédule d'origine (*L.origine*, posée avec les rivaux) : par club, ses matchs contre toi avant et après ; chaque match reculé vaut une étape d'édition par acte de recul, sans arrondi ; dans un même acte, une étape s'il passe le nœud du milieu (le 14e, le 41e, le 68e) ; avancé, rien. Le compte est le plus petit sur les façons d'apparier les matchs d'avant et d'après (un club te joue deux à quatre fois) : reculer un match de l'acte I à l'acte III vaut 2, même s'il décale les autres matchs du club (le robot de la tranche 1 appariait dans l'ordre, et le même échange y valait jusqu'à 4). Reculer puis ramener ne coûte rien.
- **Le renfort habille le club** (*habillerLaLigue*) dès le soir du placement, pour la saison qui reste, contre toi et contre les autres ; en séries, il s'ajoute aux étapes des séries (*etapeDesSeries*, `avantLesSeriesRogue`), jusqu'à l'Holo au plus (*editionDansLaLigue*).
- **Une décision rejouable** : le placement est la décision `{ palier: 'cal:a', cedule: [[k, q], …] }` ; le moteur la joue à son jour par le crochet `placer` de *creerLigue* (*crochetDesActes* : les rivaux à la création, les échanges et l'habillage à la décision), sans dé ; l'écran la joue au matin où elle est prise (*jouerLaCedule*, une fois), une reprise la rejoue de la graine — la même saison (`check_graine`). Rien placé : une décision sans échange, sans dé neuf (*deckSeul*).
- **Le « +N ✦ » suit le club** : sur sa case (le Calendrier, le placement), sur sa plaque de l'affiche de Ce soir, au Face à face (*renfortHtml*).
- **Le Calendrier** (Ligue › Calendrier) : la saison en cases, un acte à la fois (« Acte I · Acte II · Acte III » en jetons, l'acte en cours d'abord) ; jouée, le score dans sa couleur, qui ouvre son sommaire ; à venir, ce soir cerné, le rival, le sac du marché, le renfort. La route des trois billets et les semaines de sept journées partent (la grille dit les mêmes matchs, et le marché, le rival et le renfort en plus).
- **Le robot** (scripts/lib/rogue_actes.mjs, le robot « placé ») place au premier soir de chaque acte, case par case, le plus faible qui s'échange, sur un *brouillon* et par les mêmes fonctions (*echangeables*, *echangerTesCases*), puis pousse la même décision `cedule` ; le moteur la joue par le même crochet (`lancerLaLigue`). Ses copies de l'échange et du renfort (la tranche 1) sont parties : le jeu et le robot appellent les mêmes fonctions.

## 4. Les chiffres

*RENFORT* : 1 étape par match reculé et par acte de recul, +1 pour un match reculé au-delà du nœud du milieu de son acte (*NOEUDS_BOUTIQUE* 14, 41, 68), compté depuis la cédule d'origine. Exemple fait à la main (devis § 4.4), Boston contre toi aux matchs 5, 33 et 70 : le 5 au 60 (acte I → III, +2) et le 33 au 40 (même acte, avant le 41e, 0) : **+2** ; puis le 60 ramené au 20 (acte I, après le 14e) : **+1**. `renfortDe([4, 32, 69], [39, 59, 69])` = 2 et `renfortDe([4, 32, 69], [19, 39, 69])` = 1 (`check_rogue`). Une étape d'édition monte un tiers du club d'une édition (*editionDansLaLigue*) : à +3, chaque joueur d'un cran.

## 5. Les cas limites

- **Le calendrier sans échange possible** : la case reste en sourdine ; l'écran ne propose jamais l'échange qui casserait les 82 matchs.
- **Le club du rival** : ses autres matchs se placent et portent le renfort ; le match du rival ne bouge pas (*echangeables* refuse sa case).
- **Le match de ce soir** : il se place aussi (l'acte n'est pas commencé) ; l'affiche montre le nouvel adversaire dès la décision (*placerDuJour*, js/banc.js).
- **Une reprise** : le placement se rejoue de la graine à son jour, et l'habillage avec lui ; le matin même, il ne se joue qu'une fois (*L.cedules*).
- **Un placement refait** : impossible, la ligne n'existe plus une fois `cal:a` pris ; l'acte d'après se place depuis la cédule d'origine (reculer, puis ramener : rien).
- **Les séries** : le renfort reste et s'ajoute à *ETAPE_SERIES* ; jusqu'à l'Holo au plus.
- **La vieille partie** : une run de la tranche 2 ou 3 sans `cal:a` voit la ligne au premier soir de son acte suivant ; les clés de sauvegarde ne bougent pas, `G.rogue` ne gagne aucun champ (le placement est une décision).
- **Hors ligne** : aucun module neuf, sw.js ne change pas — `check_coquille`.
- **Le clavier et la manette** : chaque case est un bouton (A la touche, le balayage passe de case en case) ; Échap ferme la page comme toute page du Bureau.

## 6. Ce qu'il touche

`js/actes.js`, `js/sim.js`, `js/banc.js`, `js/saison.js`, `js/composants.js`, `js/rogue-jeu.js`, `style.css`, `index.html`, `scripts/lib/rogue_actes.mjs`, `scripts/lib/rogue_sim.mjs`, `scripts/check_graine.mjs`, `scripts/check_rogue.mjs`, `scripts/check_calendrier.mjs`, `scripts/check_plateau.mjs`, `scripts/check_composants.mjs`, `scripts/check_clarte.mjs`, `scripts/essai_rogue.mjs`, `scripts/smoke.mjs`, `.claude/rules/rogue.md`, `.claude/rules/interface.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/moteur.md`, `docs/refonte-v27.md`. Le moteur : une décision neuve, `cedule`, jouée par le crochet du Rogue (*jouerLaCedule*) ; elle ne tire aucun dé et ne touche que des journées à venir ; une saison sans elle se rejoue au caractère près (`check_empreinte`, `check_instantane`), donc `VERSION_MOTEUR` ne bouge pas. Les règles fermes : rogue.md — le calendrier placé et le renfort **entrent** ; interface.md — « le Calendrier, tes trois prochains matchs en billets de front, puis « ‹ S5 – S8 › » et la grille » **défaite** (la saison en cases, un acte à la fois), « la route au Calendrier » **défaite**, la grammaire des composants (« les billets » → la case de match) ; vocabulaire.md — **renfort** et **placer** entrent ; moteur.md — la décision `cedule` dite.

## 7. Ce qui part

Le § 8 du devis ne range aucun nom à la tranche 4 ; ce qui part ici est ce que le calendrier placé remplace dans le code d'aujourd'hui : la page Calendrier d'avant (la route de trois billets, les semaines de sept journées feuilletées quatre à la fois, leurs marques) et les copies de l'échange et du renfort dans le robot de la tranche 1. Le neuf (l'écran de la maquette 3, la saison en cases, le renfort qui suit le club) s'écrit depuis le § 4.4 du devis et la maquette, sans relire l'ancien calendrier ligne par ligne : la grille n'est plus par journée mais par match, un acte à la fois, et l'écran de placement et le Calendrier sont faits de la même case. C'est une refonte.

- `calendrierFiche`, `semaineDuCalendrier`, `CAL_SEMAINES`, `feuilleterCalendrier`, `calSemaine` (la grille des semaines de sept journées, ses congés, « ‹ S5 – S8 › ») → *saisonEnCases* (une case par match, un acte à la fois, les jetons des actes, *choisirLActe*).
- `marquesDeSaison` (les marques de la grille : le proprio, la carte à prendre, le verdict, le vestiaire, les accidents, les combats) → rien sur la grille : le passé vit à « Ton histoire », ce qui vient se dit dans la boîte ; la case dit le rival, le marché et le renfort.
- `routeDeuxSemaines`, `ROUTE_MATCHS`, `billet`, `.bu-route`, `.rt-marche`, `.pl-billets`, `.pl-billet`, `.pl-billet-soir`, `.pl-billet-gros`, `.pl-billet-q`, `.pl-billet-i`, `.pl-billet-n`, `.pl-billet-p` (tes trois prochains matchs en billets) → la case de ce soir et les suivantes dans la grille (*caseDeMatch*, la case de match de js/composants.js).
- `.calj`, `.calj-grille`, `.calj-sem`, `.calj-s`, `.calj-n`, `.calj-r`, `.calj-ev`, `.calj-nav`, `.calj-nav-rang` (la feuille de la grille d'avant) → *.ac-grille*, *.ac-case*.
- Dans le robot de la tranche 1 (scripts/lib/rogue_actes.mjs, hors du jeu, donc nommés ici en italique) : ses copies d'*echanger*, de *peut*, de *renfortDe* et de *MILIEUX*, son placement fait d'avance au jour 0 et son habillage à lui → les fonctions du jeu (js/actes.js) et la décision *cedule*, jouée par le crochet.

**Ce qui reste, et pourquoi** : *echanger* et *amener* (js/actes.js, ils posent les rivaux depuis la tranche 2, et *echanger* fait l'échange) ; *habillerLaLigue* et *editionDansLaLigue* (le canal de la ligue qui monte : le renfort le lit) ; la piste de la saison de Ce soir (*bu-piste*, la tranche 2 : elle dit l'acte et le rival en une ligne) ; « Ton histoire » au Calendrier hors du Rogue ; l'affiche et le Face à face (le renfort s'y ajoute, rien n'y part) ; le moteur, *jouerEnPeriodes*, les dés du jour ; les cartes de jeu et de joueurs, telles quelles (JP).

## 8. Les réglages

Ceux du devis, § 9 : *RENFORT* 1 étape par match et par acte (plage 1-2 ; à 0, placer est gratuit et dominant ; à 3 par acte, essayé, placer ne vaut plus rien) ; le +1 au-delà du nœud du milieu. La tranche n'en ajoute aucun.

## 9. Les critères d'acceptation

- [ ] Le renfort compté depuis la cédule d'origine, +1 par match et par acte, +1 au-delà du nœud du milieu (l'exemple fait à la main) — `check_rogue` (pur).
- [ ] Une cédule placée et son renfort se rejouent sur la graine : le placement au matin et la saison rejouée sont la même saison, les journées d'avant ne bougent pas, 82 matchs à chaque club, un par jour, les rivaux à leur jour, et « +N ✦ » est exactement les étapes que `habillerLaLigue` donne au club — `check_graine` (le bloc 8).
- [ ] Une saison sans placement se rejoue au caractère près — `check_empreinte`, `check_instantane`.
- [ ] Le robot « placé » place par les fonctions du jeu ; placer vaut à peu près zéro en moyenne, aide dans une graine sur quatre, ne fait pas reculer tes voisins de plus d'un point en médiane — `check_profondeur` (la variante placée, en CI).
- [ ] La ligne de la boîte au premier soir de l'acte, après le rival, qui bloque ; l'écran en deux touchers ; le Calendrier en cases, un acte à la fois — `essai_rogue` (la capture du calendrier de l'acte), `check_plateau` (le contrat du Calendrier réécrit), `check_calendrier` (la grille ne marque que ce qui est sûr).
- [ ] Les composants : la case de match à la place du billet — `check_composants`.
- [ ] Rien de mort — `check_mort` ; la coquille — `check_coquille`.
- [ ] Pas une couche de peinture — `check_refonte docs/refonte-v27-4.md` (`BASE=origin/claude/v27-run`).
- [ ] À juger par JP à l'essai : placer donne un vrai choix (le gros club plus tard, mais plus fort), et le « +2 ✦ » se voit partout où le club revient.

## Les écarts avec le devis et la maquette

1. **`check_chiffres`** n'est pas réécrit à cette tranche : ce que l'écran dit du renfort (« +2 ✦ ») est prouvé contre `habillerLaLigue` par `check_graine` (le bloc 8), sur la ligue jouée ; `check_chiffres` reste le juge des plans et des pièces (tranches 5 et 6).
2. **La maquette a un bouton « Échanger »** après les deux touchers ; ici l'échange se fait au deuxième toucher (le devis : *deux touchers*), et le bouton or est « Valider », qui envoie tout le placement de l'acte ; « Annuler » défait le dernier échange.
3. **La case du 41e** de la maquette montre le sac à la place du club ; ici la case garde son adversaire (on le joue) et le sac est en coin.
4. **« Plus loin »** : la maquette ne montre que l'acte ; un échange vers un acte plus loin (le devis) se fait par les cases de « Plus loin », qui ne paraissent qu'une fois une case choisie, et seulement celles qui s'échangent avec elle (l'écran ne montre que les échangeables, en un écran).
5. **Le Calendrier** perd ses semaines de sept journées et ses congés : c'est la saison en cases de la maquette, un acte à la fois. Les marques de la grille d'avant (le proprio, la carte à prendre, le vestiaire) ne sont reprises nulle part sur la grille ; à JP de dire s'il les veut sur la case.
6. **La page des règles** gagne une phrase (placer, le renfort) : la borne de `check_clarte` passe de 2 710 à 2 740 mots, comme chaque mécanique neuve avant elle.
7. **Le compte du renfort** : le robot de la tranche 1 appariait les matchs d'un club dans l'ordre (le premier d'avant avec le premier d'après) ; vu à l'essai, reculer un seul match de l'acte I à l'acte III y valait « +4 ✦ » quand le club te jouait trois fois. Le devis dit *+1 par match reculé et par acte de recul* : le compte prend le plus petit appariement (+2 ici). L'exemple fait à la main du devis donne le même +2 puis +1. La variante placée de `check_profondeur` se remesure sur ce compte, en CI.

## Les tranches

La tranche 4 est une PR vers `claude/v27-run`. La 5 (le banc de cinq) et la 6 (le duel à un choix) suivent sur la même branche.
