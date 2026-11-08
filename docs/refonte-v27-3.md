# V27, tranche 3 — La boutique à ses nœuds

L'extrait de la tranche 3 du devis de la V27 (docs/refonte-v27.md, § 4.8, § 5, § 9 et « Les tranches »), au gabarit de `docs/gabarits/devis.md`, fait avec `/refonte` le 8 nov. 2026. Le devis entier prime : cet extrait dit seulement ce que la tranche 3 livre, ce qu'elle fait partir et comment on le prouve. Elle se construit sur la branche `claude/v27-run`, après la tranche 2, et sort vers main avec les tranches 2 à 6.

## 1. Ce que JP a dit

- JP, 7 nov. 2026, à la revue du devis : la pièce de banc **s'achète en boutique** (décision 2 d'après la revue) ; les jetons qui restent à la fin de la run sont **perdus** (décision 10 : une conversion pousserait à garder au lieu d'acheter).
- JP, 27 oct. 2026 (sa run 1 : onze packs Bronze dans la saison, *on a été vraiment plus fort qu'on aurait dû*) : la hausse des packs (`hausseDesPacks`) est née là ; la V27 la garde, mais la remet à zéro à chaque nœud (§ 4.8 : *sans remise, l'équipe ne grandit pas aux actes II et III*, mesuré au prototype).
- Sur les maquettes (docs/maquettes/v27.html, 7 nov.) : *Maquettes ok* ; *montrer, pas dire* ; *garder une partie du coloré et broadcast actuel* ; *faut des logos, et garder anciens looks des cartes*. La maquette 5 est la boutique ouverte.
- JP (1.0, oct. 2026), tenu : *je veux RIEN de la boutique dans club/accueil*.

## 2. Ce que le joueur ressent

« La boutique, c'est un rendez-vous : sept fois dans la saison, je passe au marché avec ce que j'ai gagné, je prends une pièce ou des packs, et ce qui reste attend le prochain. » Le pic : le nœud de fin d'acte, après le rival, la caisse pleine et les prix remis à zéro. Le jour ordinaire ne change pas : la boutique est fermée, le Marché dit « Dans 9 matchs », Jour suivant en un geste.

## 3. Les règles du jeu (ce que la tranche code ; le devis, § 4.8)

- **Les nœuds** : la boutique n'ouvre qu'avant ton 1er match, puis après tes 14e, 27e, 41e, 54e, 68e et 82e matchs (*NOEUDS_BOUTIQUE*, js/actes.js), et reste ouverte jusqu'à ton match suivant ; après le 82e, jusqu'aux séries, où elle est fermée. Hors d'un nœud, la page Marché montre la boutique fermée : sa bande « Fermée », « Dans N matchs », et quand elle rouvre ; aucun pack. L'avance (« Jour suivant », « Jusqu'à lundi ») s'arrête une fois au nœud (*noeudsVus*), et une ligne de la boîte qui ne bloque pas, « Le marché est ouvert », mène au Marché (elle nomme le marché sans rendre la boutique, comme le pack qui attend sa signature). La piste de Ce soir dessine le prochain nœud (le sac, sans le mot), la route ses matchs de nœud, le soir de fin d'acte son étape « Le marché ».
- **Le prix au nœud** : le premier achat d'un nœud coûte le prix de base ; chacun des suivants monte de 40 % (*hausseDesPacks*, compté sur les achats **de ce nœud** : *estUnAchat* et le compte de tes matchs le jour de l'achat). Au nœud suivant, tout repart de la base.
- **Quatre achats au plus** par nœud (*ACHATS_PAR_NOEUD*), packs et pièce confondus ; ton club (un nom, des couleurs) et l'ouverture d'un pack scellé n'en sont pas. Au bout, les packs et la pièce se grisent : « Quatre achats à ce nœud ».
- **La pièce de banc** : trois tirées de la graine à chaque nœud (*piecesDuNoeud*), une seule s'achète, à `arrondi(PRIX_PIECE × hausseDesPacks(n))`, *PRIX_PIECE* 32 🪙 (*prixDeLaPiece*). Tant que le banc de cinq n'existe pas (tranche 5), **une pièce est un adjoint pour ta main**, à son niveau (*adjointsOfferts*, *niveauOffert*) : la carte qui deviendra une pièce ; prise, c'est une décision `embauche` avec son achat (`bq:<nœud>`), et une main pleine dit qui part.
- **Les jetons perdus** : après le nœud du 82e match, ils ne servent plus à rien ; la bande de ce nœud dit « Dernière boutique » et « les jetons qui restent sont perdus ».
- **La prime de série passe en 🏅** : 20 🏅 la ronde gagnée (*ecussonsDesSeries*, déjà versée à la fin de la run) ; la ronde ne paie plus de jetons.
- **L'écran, reproduit de la maquette 5** : la bande du marché (« Boutique · Après le 41e », « Le marché », tes jetons en or, quatre pastilles d'achat, jusqu'où tu signes) ; « Une pièce de banc · 1 seule » et trois vraies cartes de jeu (*carteHtml*, *carteLigne*), la choisie cerclée d'or, sa première ligne dessous, « Prendre · 32 » ; « Les packs » en plaques de métal (le nom sur la bande de son métal, le prix du moment dessous), les seuls packs ouverts ; ton club en rangée ; « Fermer · prochaine dans 13 ». La fiche d'un pack (ses chances, le joueur d'une carte, la garantie, « Acheter ») reste telle quelle.
- **Le robot** (scripts/lib/rogue_actes.mjs) achète aux mêmes nœuds et aux mêmes prix en important les mêmes fonctions (*noeudOuvert*, *prixDeLaPiece*, *piecesDuNoeud*, *ACHATS_PAR_NOEUD*, *hausseDesPacks* par *prixAuAchat*) : la pièce d'abord si la caisse la paie (*pieceDuRobot*, le choix de l'adjoint qu'il faisait au palier), puis des packs ; passé la date limite (*DATE_LIMITE_MATCH*, le 62e match), un pack ne se signe plus au jeu, et le robot n'en achète plus.

## 4. Les chiffres

*NOEUDS_BOUTIQUE* 0 · 14 · 27 · 41 · 54 · 68 · 82 ; *ACHATS_PAR_NOEUD* 4 ; *PRIX_PIECE* 32 ; la hausse 40 % par achat du nœud. Exemple fait (devis § 4.8) : au nœud du 41e match, la pièce en premier coûte 32 🪙 ; après un pack Bronze (14 🪙), elle coûte `32 × 1,4 = 44,8`, soit 45 🪙 ; un deuxième Bronze au même nœud coûte `14 × 1,4 = 19,6`, soit 20 🪙 ; au nœud du 54e, le Bronze repart à 14. Mesuré sur une run de l'attentif (graine 3, `jouerLaRun`) : 5 pièces et 4 packs sur la saison, 86 🪙 au plus riche ; la cible du devis (7 à 10 packs pour l'attentif) se lit sur 64 graines à `check_profondeur`, en CI.

## 5. Les cas limites

- **La vieille partie** : une run d'avant la V27 est déjà versée et retirée au démarrage (tranche 2). Une décision d'achat d'avant (une hausse comptée sur la saison) se relit telle quelle : son prix est écrit dans la décision, la caisse le déduit ; un vieux palier `pp:` ne joue que son `embauche` (`check_deck`, `check_sauvegardes`). Les clés de sauvegarde ne bougent pas, et `G.rogue` ne gagne aucun champ : le nœud se relit du jour de chaque achat.
- **Un nœud qui dure** : la boutique reste ouverte les jours de congé jusqu'à ton match suivant ; les achats de ces jours comptent au même nœud.
- **Le 82e nœud** : ouvert à l'écran de la saison finie (« Voir le bilan »), fermé aux séries (leur écran ne prête pas la boutique).
- **La main pleine** : la pièce prise fait partir la plus ancienne carte hors poste, et l'offre le dit (« Ta main est pleine : X part »).
- **La caisse courte** : la pièce et chaque pack disent ce qui manque (« Il te manque 12 🪙 ») ; une boutique restée ouverte recompte les jetons au clic.
- **Un pack scellé** : il s'achète au nœud et compte ; il s'ouvre quand on veut, même boutique fermée (« Déjà à toi »).
- **Hors ligne** : aucun module neuf, sw.js ne change pas — `check_coquille`.
- **Le clavier et la manette** : une pièce se choisit au toucher ou à la touche (`role="button"`, `tabindex`) ; Échap ferme la boutique — `essai_rogue`.

## 6. Ce qu'il touche

`js/actes.js`, `js/packs.js`, `js/rogue.js`, `js/rogue-jeu.js`, `js/magasin.js`, `js/saison.js`, `js/scenes.js`, `js/inventaire.js`, `style.css`, `index.html`, `scripts/lib/rogue_actes.mjs`, `scripts/lib/cartes_robot.mjs`, `scripts/lib/rogue_sim.mjs`, `scripts/check_rogue.mjs`, `scripts/check_packs.mjs`, `scripts/check_clarte.mjs`, `scripts/check_verite.mjs`, `scripts/check_deck.mjs`, `scripts/check_plateau.mjs`, `scripts/check_profondeur.mjs`, `scripts/mesure_rythme.mjs`, `scripts/essai_rogue.mjs`, `scripts/essai_packs.mjs`, `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `.claude/rules/interface.md`, `docs/refonte-v27.md`. Les règles fermes : rogue.md — « la prime de série est versée » **tenue**, en 🏅 ; « les adjoints ne s'achètent pas » **défaite** (décision 2 d'après la revue : une pièce s'achète) ; la boutique à ses nœuds **entre**. vocabulaire.md — **nœud** entre ; les paliers des 10e à 70e matchs partent. interface.md — « rien de la boutique dans le Club » **tenue** (le Bureau dit « le marché », dessine le sac, ne rend rien) ; le club s'achète hors des quatre achats.

## 7. Ce qui part

Le § 8 du devis ne range aucun nom à la tranche 3 ; ce qui part ici est ce que la boutique de la V5 à la V26 faisait et que le § 4.8 remplace, et l'adjoint gratuit des paliers, que le devis range à la tranche 5 (« `PALIERS_PACK` → *piecesOffertes* … à la boutique ») et que la pièce de la boutique remplace dès maintenant. Le neuf (les nœuds, le compte au nœud, la pièce, l'écran de la maquette 5) s'écrit depuis le § 4.8 du devis et la maquette, sans relire l'ancienne boutique ligne par ligne : la vitrine de rayons et de pochettes (*ouvrirMagasin*, son *dessiner*) est réécrite ; seules la fiche d'un pack et celle du club restent. C'est une refonte.

- `achatsDePacks` (la hausse comptée sur toute la saison : le prix ne redescendait jamais) → *estUnAchat* et le compte de tes matchs le jour de l'achat (*noeudOuvert*), *ACHATS_PAR_NOEUD*.
- `packsOuvertsBoutique` (la boutique ouverte en tout temps, et « tout » hors du Rogue) → *noeudOuvert*, *prochainNoeud* ; la boutique ne vit qu'au Rogue (*packsOuverts*).
- `packDuJour`, `duJour`, `RAYONS`, `pk-rayon-jour`, `pk-jour`, `pk-rabais` (le pack de la semaine à −25 % et les rayons « Au hasard » et « À ton choix ») → le prix remis à zéro à chaque nœud ; les packs ouverts en une rangée (*mk-rangee*).
- `debutant`, `pk-rayon-debut`, `pk-tout` (les quatre packs du début et « Voir les N packs ») → les seuls packs ouverts, sans pack sous clé dans la vitrine.
- `pk-tete`, `pk-n`, `pk-manque`, `pk-aller` (l'en-tête en une ligne, la tuile en pochette et ce qu'il manque dessous, le renvoi aux scellés) → la bande du marché (*mk-bande*), la plaque de métal (*mk-pack*), le manque au titre de la tuile et sur « Acheter ».
- `PALIERS_PACK`, `sceneDuPalier`, `packsVus`, `rt-pack` (l'adjoint gratuit parmi trois aux 10e, 30e, 50e et 70e matchs, sa scène du proprio, son arrêt de l'avance et son 🎁 sur la route) → la pièce parmi trois à chaque nœud (*piecesDuNoeud*), l'arrêt au nœud (*noeudsVus*), le sac sur la route (*rt-marche*).
- `JETONS.serie`, `B.serie` (40 🪙 la ronde de séries gagnée) → *ecussonsDesSeries* (20 🏅 la ronde).

**Ce qui reste, et pourquoi** : *hausseDesPacks* et *HAUSSE_PACK* (devis § 8b : l'économie à une caisse ; seul son compte change) ; *prixDe*, *BOUTIQUE*, *packsOuverts* ; la fiche d'un pack et ses chances (*chancesDe*, *niveauxHtml*), la garantie (*PITIE*) ; les packs scellés (JP, oct. : *achat de pack sans ouvrir possible*) ; ton club en jetons (*offresDuClub* ; la question 2 du § 11, ce que paient les jetons, reste à JP) ; *DATE_LIMITE_MATCH* (la date limite des échanges, une règle du hockey ; voir les écarts) ; *jetonsDe* et *baremeRogue* ; la pochette (*pochetteHtml*) pour les scellés ; les cartes de jeu et de joueurs, telles quelles (JP).

## 8. Les réglages

Ceux du devis, § 9 : *NOEUDS_BOUTIQUE* (5 à 8 nœuds), le prix au nœud remis à zéro, *ACHATS_PAR_NOEUD* 4 (3-5), *PRIX_PIECE* 32 (24-40). La tranche n'en ajoute aucun ; le prix de la pièce (§ 11, question 1) garde la valeur recommandée, la mesure de la tranche 5 le réglera entre 24 et 40.

## 9. Les critères d'acceptation

- [ ] La boutique n'ouvre qu'à ses sept nœuds ; le premier achat d'un nœud coûte le prix de base, la pièce 32 🪙 puis 45 après un pack ; au plus quatre achats ; trois pièces pures de la graine ; la prime de série en médailles — `check_rogue` (le bloc « la boutique à ses nœuds »), `check_packs` (le prix au nœud ; la revente sous 40 % reste).
- [ ] L'attentif achète 7 à 10 packs par saison — `check_profondeur` (en CI : il l'imprime, avec ses pièces ; la borne se pose sur le vrai banc, tranche 5).
- [ ] La boutique au Marché, fermée entre deux nœuds (« Dans N matchs », aucun pack), ouverte au nœud (la bande, trois pièces en cartes, les packs ouverts à leur prix, la pièce prise une fois, son prix monté après un pack), jamais dans le Club — `essai_rogue`, `essai_achat`, `essai_packs`, `check_plateau` (le contrat de la page Boutique réécrit).
- [ ] La page des règles dit les nœuds, le prix au nœud, la pièce et la prime en médailles, chaque chiffre lu du code — `check_clarte`.
- [ ] Rien de mort — `check_mort` ; la coquille — `check_coquille`.
- [ ] Pas une couche de peinture — `check_refonte docs/refonte-v27-3.md` (`BASE=origin/claude/v27-run`).
- [ ] À juger par JP à l'essai : passer au marché donne envie de garder ses jetons pour le prochain nœud, sans que la boutique devienne une corvée.

## Les écarts avec le devis et la maquette

1. **La pièce est un adjoint** jusqu'à la tranche 5 (son séjour, son repos, sa main de quatre) : le banc de cinq n'existe pas encore ; c'est la carte qui deviendra une pièce (`adjointsOfferts` y entrera dans *piecesOffertes*). « Banc plein » se dit donc « Ta main est pleine : X part ».
2. **L'adjoint gratuit des paliers part dès la tranche 3**, pas à la 5 : c'est la même offre (un adjoint parmi trois), et la garder gratuite à côté de la pièce payante la viderait de sens.
3. **La vedette du pack** de la maquette (« Pack Or · Peut sortir · Ray Bourque ») n'est pas reproduite : il faut un vrai joueur qu'un pack ouvert peut tirer, hors de la ligue ; à faire avec la Dynastie ou à la demande de JP.
4. **La date limite** (le 62e match) : aux nœuds des 68e et 82e matchs, un pack de joueurs ne se signe plus (ses joueurs vont au cartable, ses cartes de jeu jouent encore), et le robot n'en achète plus. Le devis compte des packs à ces nœuds (§ 4.8, le tableau) : **une question pour JP** — déplacer la date limite au 68e, ou laisser ces nœuds à la pièce et aux cartes.
5. **Ton club** (un nom, des couleurs) s'achète seulement à un nœud ouvert, hors des quatre achats ; la question 2 du § 11 (les clubs en 🏅 ?) reste à JP.
6. **La page des règles** gagne trois phrases : sa borne de `check_clarte` passe de 2 650 à 2 710 mots, comme chaque mécanique neuve avant elle.
7. **Le Bureau dit « le marché »**, jamais « boutique », et dessine le sac sans emoji : la règle *rien de la boutique dans le Club* tient (`essai_rogue`, `verifClubSansBoutique`).

## Les tranches

La tranche 3 est une PR vers `claude/v27-run`. La 4 (le calendrier placé), la 5 (le banc de cinq, qui fait de la pièce une vraie pièce de banc) et la 6 (le duel à un choix) suivent sur la même branche.
