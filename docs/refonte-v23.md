# V23 — Un vrai jeu de cartes : facile à prendre en main, dur à maîtriser

Le devis, au gabarit de `docs/gabarits/devis.md`. Fait avec les agents `rogue-ux` et `rogue-design` + `rogue-recit` (2 nov. 2026), sur une run jouée par `essai_rogue` et capturée à 390 × 844. À juger par `/revue-design docs/refonte-v23.md` avant chaque tranche qui touche une règle ferme.

## 1. Ce que JP a dit

JP, 2 nov. 2026 :
- *Tu peux utiliser ça (Claude-Code-Game-Studios) pour refaire les UI et UX du jeu, et système d'assistants, événements, etc., tout ce qui rend le roguelike le fun et roguelike justement.*
- *En gros, l'interface utilisateur et les mécaniques actuelles font un peu « cheap », je veux une vraie expérience digne d'un roguelike ou card game le fun à la Balatro, Slay the Spire, Pokémon TCG.*
- *Copie pas nécessairement les inspirations, mais comprends que le but est que ça soit aussi le fun, complexe et poli, et engaging, bref, le bon vieux facile à prendre en main, dur à maîtriser.*
- *Je pense que les coachs et adjoints doivent être comme les joueurs, de pas très bon à excellents.*

## 2. Ce que le joueur ressent

**Le fantasme** : je bâtis un club autour de mon coach, et je le vois s'emboîter et frapper — le soir où ma ruée et mon canonnier jouent ensemble en 3e, je le sens.

**Facile à prendre en main** : chaque écran a un objet qu'on touche (une carte), un chiffre gros par option, et un bouton du bas qui dit ce qui reste. **Dur à maîtriser** : le timing (quand poser, quel match encercler), les emboîtements (quel adjoint relaie quel pouvoir), la qualité (garder un excellent adjoint pour le bon séjour), le risque (les dés, les suites).

**Les pics**, mis en scène : la carte rare au pack (déjà bon), le coach qui monte de niveau, le banc qui s'allume, le duel gagné en 3e, la Coupe, le congédiement. **Les jours ordinaires** restent rapides : 400 ms au plus, rien ne s'ouvre.

## 3. Le diagnostic : pourquoi ça fait « cheap »

### À l'écran (`rogue-ux`)

1. **Le choix, cœur du jeu, est un formulaire.** Histoires, rivaux, plans du duel, coach, classeur : des tuiles de texte (`optionHtml`, js/gerant.js ; `.choix-option`, style.css). Les cartes 5:7 n'existent qu'au pack. Causes écrites : la tuile sobre de la V19 (« ni dégradé, ni ombre, ni saut ») et les coins vifs du 23 oct., avec « À plat » (`--shadow-1: none`).
2. **Rien de ce qui gagne ne reste en vue.** Les pouvoirs et les adjoints vivent sous Bureau › Coach ; le soir où ils jouent, une ligne de texte sous « Plus de détails » le dit (`buildDuSoirHtml`, js/bilan.js).
3. **Le résultat ne se raconte pas.** Le sommaire et le duel disent leurs chiffres en prose ou en petit gris ; rien ne relie « mon plan » à « ce qui est arrivé ».
4. **Typographie plate, chiffres minuscules** : de 12,5 à 38 px, presque tout entre 13,5 et 17 ; « +,006 au % d'arrêts » est exact et impossible à sentir.
5. **Les finis.** Un toast couvre l'en-tête, « Jouer ce soir » flotte sur La route, « +45 % de précisi… » est tronqué, le 4e pack coupé, des silhouettes vides au classeur, « Journée 0 sur 186 », le sous-titre du duel illisible sur l'orange ; le jus (son, vibration) ne vit qu'au pack.

### Dans les mécaniques (`rogue-design`, `rogue-recit`)

1. **Rien ne s'emboîte.** Chaque adjoint est un multiplicateur isolé ; deux en poste « s'additionnent sans règle de plus » ; aucun ne lit un pouvoir, aucun pouvoir ne lit un adjoint.
2. **Le déclenchement ne se vit pas.** `feuille.pouvoirs` et `feuille.adjoints` gardent ce qui a joué ; seul un texte enfoui le dit, le lendemain.
3. **Rien n'est rare, tout est égal.** Huit adjoints sans qualité, 8 à 12 offres gratuites par saison, un dé presque toujours 3 sur 6. L'attentif ne bat le robot du premier choix que de +4,5 V par saison (seuil 5) : la maîtrise paie à peine.
4. **La saison est un couloir.** 82 matchs en ligne, des horloges fixes, des gros matchs imposés ; la boutique ne compte pas (0 à +0,9 V à l'ablation).
5. **Les histoires se ferment sur elles-mêmes.** Neuf histoires, un effet de 6 à 10 matchs, puis rien : pas de suite, pas de rare, aucune trace.

## 4. Les règles du jeu : les six chantiers

### A. Le banc s'allume (le moment du soir) — aucune règle ferme touchée

Au sommaire du soir, juste sous le pointage, **ton banc** : une rangée de petites cartes, tes pouvoirs ouverts et tes adjoints en poste. Ce qui a joué s'**allume**, l'une après l'autre (≈ 120 ms d'écart), avec les périodes où il a joué en pastilles (1re · 2e · 3e) ; ce qui n'a pas joué reste éteint, sa condition lisible à l'infobulle. L'adjoint dit ce qui lui reste (« 7 matchs »). Plus tard (tranche A2) : la même rangée en bas du Bureau, permanente, et chaque entracte du duel l'allume en direct.

- Premier soir : *je vois mon coach frapper*. Run 5 : *le compte de ce qui s'allume dit quelles conditions reviennent ; je pose mes adjoints en conséquence*.

### B. Les choix en cartes — défait la tuile sobre V19 et les coins vifs (JP tranche)

Une histoire, une offre d'adjoint, un plan de duel : **deux ou trois cartes face à face**, chacune un chiffre gros au centre (« +20 🪙 », « +5 XP », « +3 tirs »), le coût en rouge dessous, le joueur nommé en vraie carte au-dessus. Toucher envoie toujours (JP : *le fait que ça reste*, non) : la carte touchée **s'envole vers sa maison** (les jetons vers le compteur, l'expérience vers le coach), l'autre se retourne. Le dé devient une rondelle qui tourne, ses deux faces lisibles avant. Une carte tenue a son ombre et monte de 8 px : « À plat » vaut pour le décor, pas pour ce qu'on tient.

### C. Coachs et adjoints, du pas très bon à l'excellent (JP, 2 nov.)

Comme les joueurs, chaque **entraîneur** et chaque **adjoint** a un **niveau** : Soutien, Régulier, Pilier, ★ Étoile, ★ Phénomène (les mots de `js/niveaux.js`, la même pastille).

- **L'entraîneur** : son niveau vient de son rang dans la lecture des vraies stats de son club (ce que `maitriseDu` fait déjà en trois marches, ×1 · ×1,1 · ×1,2, js/coachs-reels.js) ; il passe à cinq marches, de ×0,9 (Soutien : ses pouvoirs jouent moins fort) à ×1,3 (Phénomène). Le loto du départ en montre trois, de niveaux différents : prendre le Phénomène d'une philosophie qui va mal à ton classeur, ou le Régulier qui va bien, est un vrai choix.
- **L'adjoint** : la même carte, cinq niveaux. Son **style** ne change pas (ses deux canaux, ce qu'il donne et ce qu'il coûte) ; son niveau règle la **force** de ce qu'il donne (×0,7 à ×1,3) et le **prix** de ce qu'il coûte (×1,2 à ×0,7) — un Phénomène donne plus et coûte moins. La borne suit la rareté d'une carte (`.claude/rules/rogue.md` : commune ±1, peu commune ±1,5, rare ±2,5, légendaire ±4) : Soutien et Régulier ±1 V, Pilier ±1,5, ★ Étoile ±2,5, ★ Phénomène ±4, ramené à un match sur deux. Les offres tirent le niveau de la graine, plus haut au verdict du proprio et après un gros match gagné que d'un palier ordinaire ; le prestige en ajoute, comme aux packs.
- Premier soir : *une pastille, comme sur mes joueurs ; le Phénomène est meilleur*. Run 5 : *garder le ★ Étoile pour le bon séjour, prendre un Régulier qui rejoint mon coach plutôt qu'un Pilier qui ne le rejoint pas*.
- Touche la règle « chaque adjoint reste un style, ±1,5 V » : elle devient « chaque adjoint reste sous la borne de son niveau ». JP tranche.

### D. Les emboîtements : le relais — défait « la synergie se paie en durée, jamais en force » (JP tranche)

Chaque adjoint a, en plus de son style, un **signal** de hockey lu période par période comme un pouvoir : « quand un pouvoir de ton coach joue », « en 3e, à un but près », « quand le mur est aussi en poste ». Quand il se lit, l'adjoint **relaie** sur un de ses canaux, la période même (« 🏹 Le canonnier relaie 🐝 la ruée »). La chaîne s'arrête à deux maillons. Une paire rend 1,2 à 1,6 fois la somme de ses pièces, comme la lancée l'a fait (V16, `check_combo`). Avec C : un adjoint excellent relaie plus fort. Et **moins d'offres** (revue § 2.3 B) : le butin d'un gros match gagné donne des jetons ou de l'expérience, plus un adjoint ; sans ça, on tient toutes les cartes et le relais n'est plus un choix.

### D'. Chaque coach change ta façon de jouer, et les adjoints se paient (JP, 2 nov. : *every coach should change how you play, you can be creative about it, like a coach or assistant that was a ref and pay them and stuff like that*)

**La règle du coach** (`REGLES_DU_COACH`, js/coachs.js ; `primesDuCoach`, js/rogue.js). Chaque philosophie paie le soir où ton club joue SON hockey, lu dans la feuille : facile (une phrase), dur à maîtriser (bâtir l'effectif qui la tient sans perdre les matchs pour elle). Les seuils sont mesurés sur les clubs témoins, pour à peu près un soir sur quatre ; les plus rares paient 3 ; 50 🪙 au plus par saison (`PRIME_COACH_MAX`).

| Coach | La règle | Paie | Un soir sur… |
|---|---|---|---|
| 🐝 Le Frelon | 35 tirs ou plus | 2 🪙 | 4,5 (22 %) |
| 🐢 La Tortue | 24 tirs contre ou moins | 2 🪙 | 3,3 (30 %) |
| 🦅 L'Aigle | 13 % au tir ou mieux | 2 🪙 | 3,3 (30 %) |
| 🦏 Le Rhino | 28 mises en échec ou plus | 2 🪙 | 4 (25 %) |
| 😇 L'Abbé | deux punitions ou moins | 3 🪙 | 5,5 (18 %) |
| 🫁 Le Doc | le but gagnant en 3e ou en prolongation | 3 🪙 | 7 (14 %) |
| 🪜 Le Contremaître | quatre buteurs ou plus | 2 🪙 | 4 (25 %) |
| 🌠 Le Showman | un joueur à trois points ou plus | 2 🪙 | 4,3 (23 %) |

Un club qui joue le style le tient plus souvent : la saison test de `check_banc` (le Frelon, ses pouvoirs) touche 35 tirs 46 soirs sur 82, et le plafond mord. La règle s'allume au banc du soir, se dit à Hier soir (« 🐝 Le Frelon : 35 tirs ou plus : +2 🪙 »), au choix de l'entraîneur et chez le coach (combien de fois, combien de jetons cette saison).

**Le salaire** (`SALAIRE_NIV`, `salaireDe`, js/adjoints.js ; `salairesDesAdjoints`, js/rogue.js). En poste, un adjoint se paie chaque match : rien au Soutien et au Régulier, 1, 2 puis 3 🪙 du Pilier au ★ Phénomène. Le niveau devient un choix d'argent : le Phénomène coûte 36 🪙 sur un séjour de 12 matchs. Une carte d'avant la V23, sans niveau, ne coûte rien.

**🦓 L'ancien arbitre** (JP : *an assistant that was a ref, and pay them*). Hors des huit voies : il ne rejoint aucun coach (12 matchs, jamais 16) et se paie 2 🪙 de plus par match. *« J'ai sifflé vingt ans dans cette ligue. Je sais ce qu'ils regardent, et ce qu'ils ne regardent pas. »* Tes punitions −15 %, les leurs +10 %. Mesuré (`check_pouvoirs`, N = 600) : +1,0 V au Soutien (borne ±1, au ras), +1,4 au Pilier (±1,5), +1,8 au Phénomène (±4) — le plus fort des adjoints au Pilier, et le plus cher : 3 🪙 par match au Pilier, 5 au Phénomène.

À venir, dans le même esprit (l'adjoint libre, JP) : le relais (D), et d'autres adjoints hors des voies qui changent une règle plutôt qu'un canal — le dépisteur (une carte de plus aux offres), le comptable (la prime de victoire), le médecin (les retours de blessure).

### E. Les histoires : des suites et des rares

Une réponse peut planter un **épisode 2** (`suite: { cle, apres, si }`), qui ne s'ouvre que si le fait de l'issue est vrai dans les feuilles jouées depuis (« il a fait 4 points pendant son défi »), et passe avant le tirage du lundi. Une histoire **rare** sort une fois par run au plus, sur un fait rare, avec un enjeu plus gros. Six fiches neuves, écrites par `rogue-recit` (les durées des dés à peser par `check_effets DETAIL=1`) :

| Histoire | Voix | Le fait | Réponse 1 | Réponse 2 |
|---|---|---|---|---|
| 🐣 Le kid qui pousse (1 de 2) | l'entraîneur | une recrue au 3e ou 4e trio, 4 points ou plus en 10 matchs | le monter au 2e trio : un dé sur lui (tirs ×1,4, précision ×1,2 ; ou précision ×0,6), 8 matchs | le laisser mûrir : +4 d'expérience |
| 🌟 Le kid est arrivé (2, le dé passé, 4 points en 8) | l'analyste | ses points depuis | la une le réclame : +25 🪙 | le protéger des caméras : une carte d'adjoint |
| 🌧 Le kid doute (2, le dé raté) | le capitaine | ses points depuis | sous l'aile du capitaine : sa précision ×1,2, 6 matchs ; le capitaine −10 de jambes | retour au 4e trio : +3 d'expérience |
| 🎩 Les chapeaux sur la glace (rare) | le préposé à l'équipement | un tour du chapeau au dernier match | les chapeaux aux enchères : +30 🪙 | il garde le 1er trio : un dé (tirs ×1,4, précision ×1,2 ; ou ×0,7), 6 matchs |
| 🏟 Le retour à la maison | les communications | le prochain adversaire est la franchise de sa vraie carte | la conférence de presse : +15 🪙 | régler ses comptes : un dé pour ce match (tirs ×1,6, précision ×1,3 ; ou ×0,6) |
| 🧊 Le blanchissage de l'auxiliaire | l'entraîneur | ton auxiliaire a blanchi l'adversaire | encore le filet : il part au prochain match, un dé sur ses arrêts (×0,8 ou ×1,2 des buts accordés) | retour au partant : +3 d'expérience |
| 🎙 La promesse du capitaine | le capitaine | trois défaites de suite | il garantit la victoire : ses tirs ×1,4 au prochain match, puis gagné +20 🪙, perdu −5 d'expérience | pas de promesse : +8 🪙 |

### F. La saison choisie : le match encerclé, et leur coach en séries

À chaque palier, le vrai calendrier des 20 matchs qui viennent propose trois adversaires (ta bête noire, le 1er, un rival) : tu en **encercles** un, il devient ton duel avec son enjeu annoncé, plus gros contre plus fort. En séries, l'adversaire a un **coach-personnage avec un pouvoir visible** (une Tortue : « quand ils mènent, −25 % de buts contre » — il faut marquer le premier), neutre en V sur une saison ; ton choix d'adjoint devient la réponse. Les routes de la semaine (retirées en V20 comme « une horloge de plus ») ne reviennent pas.

### G. Les finis et le jus, partout

Un module (`js/mouvement.js`, qui existe) et des jetons dans `:root` :

| Palier | Quand | Durée | Bloque ? |
|---|---|---|---|
| Ordinaire | un jour sans choix, un onglet | ≤ 400 ms | jamais |
| Notable | ce qui s'allume, des jetons, un choix envoyé | ≤ 1,2 s | non, sauté au toucher |
| Pic | carte rare, gros match gagné, niveau du coach, Coupe, congédiement | ≤ 3 s | oui, sauté au toucher |

Une sortie `cubic-bezier(.2,.8,.2,1)` pour tout déplacement, le ressort (`--e-ressort`) pour ce qui se pose ; trois sons neufs (le bâton sur la glace, la rondelle sur la bande, le klaxon) ; `vibrer(palier)` (8, 20, 30-40-60 ms ; jamais un soir ordinaire) ; une secousse de 4 px aux pics seulement ; 12 particules au plus. Sous `prefers-reduced-motion`, l'état final tout de suite ; le DOM porte toujours le vrai chiffre ; Joueurs, Ligue et les tableaux ne bougent pas.

## 5. Les cas limites

Un coach sans pouvoir ouvert (niveau 0) : le banc montre l'adjoint seul, ou rien. Un adjoint dont le séjour finit ce soir : il s'allume une dernière fois, « dernier match ». Les séries : le banc joue pareil. Une vieille partie : un adjoint sans niveau est un Pilier, la table d'avant, et ne se paie pas, une histoire sans suite n'en a pas. L'APK hors ligne : aucun fichier neuf sans `sw.js` (`check_coquille`). Le clavier et la manette : chaque carte du banc a son infobulle et son focus.

## 6. Ce qu'il touche

| Chantier | Fichiers | Règle ferme |
|---|---|---|
| A | js/bilan.js, style.css ; puis js/saison.js, js/entracte.js | aucune |
| B | js/gerant.js, js/scenes.js, style.css | `interface.md` : la tuile sobre, les coins vifs ; « À plat » (décision du 23 oct.) |
| C | js/coachs-reels.js, js/adjoints.js, js/sim.js, scripts/lib/cartes_robot.mjs | `rogue.md` : « ±1,5 V » d'un adjoint |
| D | js/adjoints.js, js/pouvoirs.js, js/sim.js | `rogue.md` : « la synergie se paie en durée, jamais en force » |
| E | js/dossiers.js, js/saison.js, js/verdicts.js | aucune (le fait reste vrai et déjà joué) |
| F | js/sim.js (`grosMatchAvant`), js/saison.js, js/coachs.js | `rogue.md` : la difficulté de l'adversaire ne bouge pas (son pouvoir neutre en V) |
| G | js/mouvement.js, js/sons.js, js/util.js, style.css | `interface.md` : « À plat » amendé pour ce qu'on tient |

Les clés de sauvegarde ne bougent jamais.

## 7. Les réglages

`FORCE_NIV` (×0,7 · ×0,85 · ×1 · ×1,15 · ×1,3), `PRIX_NIV` (×1,05 · ×1,025 · ×1 · ×0,9 · ×0,8 : le prix bouge moins que la force, pour qu'un style se voie encore au Phénomène et que le Soutien soit faible sans piéger), `SALAIRE_NIV` (0 · 0 · 1 · 2 · 3 🪙 par match), `MAITRISE` en cinq marches (×0,9 à ×1,3), `REGLES_DU_COACH` et `PRIME_COACH_MAX` (50 🪙 par saison), le relais (une reprise de 0,3 à 0,6 fois le canal, deux maillons), `ECART_BANC` (120 ms entre deux cartes qui s'allument), l'enjeu du match encerclé (selon le rang de l'adversaire, borné par `BUTIN_RIVAL`).

## 8. Les critères d'acceptation

- [x] **A1** : au sommaire du soir, le banc montre chaque pouvoir ouvert et chaque adjoint en poste ; ce qui a joué porte `.joue` et ses périodes, recomptées dans `feuille.pouvoirs` ; sous `prefers-reduced-motion`, aucune animation — `check_banc` (neuf, dans `tout.mjs`).
- [ ] A2 : le banc au Bureau et allumé aux entractes du duel — `essai_rogue`.
- [x] B : un gros chiffre par option à `--t-6`, pris parmi ses lignes visibles (deux au plus en tout) ; la carte sans dégradé, avec son relief, qui se soulève et s'envole — `check_lisibilite` § 6. *Ouvert* : une histoire en 1,0 écran (`essai_rogue`).
- [x] C : chaque niveau d'adjoint sous sa borne, et le Phénomène bat le Soutien du même style en paires (chacun à 0,3 V près, +0,7 V en moyenne) — `check_pouvoirs` ; une carte sans niveau est un Pilier, la table telle quelle.
- [x] D' : la règle du coach s'allume les soirs où elle paie et la caisse les paie ; les salaires sont ceux de la feuille — `check_banc` ; l'ancien arbitre sous la borne de chaque niveau — `check_pouvoirs`.
- [ ] D : chaque relais se voit le soir où il joue ; une paire rend 1,2 à 1,6 fois ses pièces — `check_relais` (à écrire) ; l'attentif qui lit les relais bat celui qui ne les lit pas d'au moins 1 V par saison — `check_profondeur` (`ROBOT_SAUF=relais`).
- [ ] E : une suite ne s'ouvre que sur un fait vrai ; une rare au plus une fois par run ; les deux réponses à 0,3 V — `check_dossiers`, `check_effets DETAIL=1`, `check_mots`, `mesure_rythme`.
- [ ] F (réduit, JP : pas d'encerclement) : leur coach en séries, son pouvoir neutre sur une saison — `check_gros`, `check_robot`.
- [ ] G : sous `reducedMotion`, aucune animation active ; un jour ordinaire rend le Bureau stable en moins de 500 ms ; aucun toast sur l'en-tête, le bouton flottant ne couvre rien de touchable, aucun « … » dans une ligne de pouvoir — `essai_rogue` (`bords.mjs`).
- [ ] La maîtrise, jugée sur la run (JP) : la première Coupe de l'attentif à la run 3 ou plus tard, le distrait jamais — `check_profondeur` ; l'écart sur le robot du premier choix, en information.
- [ ] À juger par JP à l'essai : le ton (« Mise au jeu ▶ » ou « Jour suivant »), les noms (le banc), la vibration par défaut.

## Les tranches, dans l'ordre

1. **A1 · Le banc s'allume au sommaire** — fait (2 nov.) : `banc` (js/profil-style.js), `bancHtml` (js/bilan.js), `.banc` (style.css), `check_banc`.
2. **G1 · Les finis** — fait (2 nov.) : le toast, les pouvoirs fermés, la journée, le sous-titre du duel ; trois défauts écartés (LIVRAISON.md).
3. **C · Les niveaux des entraîneurs et des adjoints** — fait (2 nov.) : `NOMS_NIV`, `FORCE_NIV`, `PRIX_NIV`, `BORNE_NIV`, `niveauOffert` (js/adjoints.js), `MAITRISE` en cinq niveaux (js/coachs-reels.js) — `check_pouvoirs`.
3'. **D' · La règle du coach, le salaire, l'ancien arbitre** — fait (2 nov.) — `check_banc`, `check_pouvoirs`, `check_clarte`.
4. **A2 · Le banc au Bureau et aux entractes.**
5. **B · Les choix en cartes** — fait (2 nov.) : la carte de choix (relief, forme, gros chiffre, envol) ; le pari en rondelle qui tourne et le joueur nommé en vraie carte restent à faire.
6. **E · Les suites et les rares** — fait (2 nov.) : le petit (trois épisodes), les chapeaux (rare), le blanchissage ; le retour à la maison et la promesse du capitaine restent à écrire.
7. **D · Le relais et moins d'offres** — après le oui de JP.
8. **F · Leur coach en séries** (l'encerclement est écarté par JP).

Pour chaque tranche de mécanique, le robot attentif apprend le geste avant la mesure ; sinon `ROBOT_SAUF` mesure zéro.

## Ce que JP a tranché (2 nov. 2026)

JP : *Oui, oui, oui, l'adjoint peut être ce que tu veux, je pense que c'est plus organique de pas choisir, oui, tsé, c'est tough à évaluer car tout roguelike, on finit par être pété lors de la run gagnante, ou presque.*

1. **Les niveaux (C)** : oui. La borne d'un adjoint suit son niveau (±1 à ±4 V), comme une carte suit sa rareté.
2. **Les choix en cartes (B)** : oui. La tuile sobre de la V19 et les coins vifs partent pour les choix ; une carte tenue a son ombre.
3. **Le relais (D)** : oui, et l'adjoint est libre (*l'adjoint peut être ce que tu veux*) : son signal, son relais, ses canaux se dessinent au mieux du jeu, sous la borne de son niveau.
4. **Le match encerclé (F)** : non (*plus organique de pas choisir*). Les gros matchs restent ceux que le classement amène ; F se réduit à leur coach en séries, à faire plus tard.
5. **Une histoire rare** laisse une trace permanente au verso du joueur : oui.
6. **Le juge de la maîtrise** : la run, pas la saison (*tout roguelike, on finit par être pété lors de la run gagnante*). `check_profondeur` juge la première Coupe (à la run 3 ou plus tard) et l'écart attentif contre distrait ; les 5 V par saison contre le robot du premier choix deviennent une information, plus un rouge.
