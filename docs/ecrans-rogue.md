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
- [ ] **E4 · Le Bureau en enveloppes.** À faire ne se déplie plus dans la page : chaque choix est une enveloppe qui ouvre sa feuille (`optionHtml` y vit tel quel) ; la route en puces ; « Trancher » au bouton du bas. Juges : `essai_rogue` (le Bureau tient à un écran, chaque enveloppe cite sa voix, le lot part d'un seul « Trancher »), smoke.
- [ ] **E5 · Ce soir en trois chiffres.** Les barres face à face, l'avantage en une phrase ; le tableau complet au dépistage. Juges : `essai_rogue` (Ce soir tient à un écran), `check_chiffres` (les chiffres de l'affiche sont ceux du moteur).
- [ ] **E6 · La main du duel en éventail.** Les cartes du cahier en rangée, l'élan en pastilles, le pointage en tête aux couleurs de l'adversaire. Juges : `essai_rogue`, `check_duel` (rien ne bouge au moteur).
