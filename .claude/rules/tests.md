---
paths:
  - "scripts/**"
  - ".github/workflows/**"
---

# Tester

Sert la page — `python3 -m http.server 8000`, ou sans Python `node <un petit serveur statique> . 8000` — et ouvre `localhost:8000`. Les modules ES ne fonctionnent pas en `file://`.

S'il y a un runner de navigateur disponible (Playwright), `node scripts/smoke.mjs http://localhost:8000` fait le test de fumée à 390 px :

1. La page démarre, `#game` devient visible
2. Auto-draft conscient du budget : à chaque tour il lit le plafond restant, calcule ce qu'il peut mettre sur ce choix sans passer sous le plancher pour les cases suivantes, et signe, parmi les cartes qui tiennent dans ce budget, celle dont la destination ne porte aucun avertissement et dont le chiffre clé est le plus grand (voir S64 : prendre la première rendait une équipe de .500 et faisait du passage des séries une loterie). Sinon il relance (passer, autre équipe, autre année) ; en dernier recours il clique `#freeCapBtn`, le bouton de la bande de secours qui retire le plus gros contrat
3. `#mainBtn` devient actif
4. Cliquer : le 82-0 va droit au bilan (aucun `#hubModal .hub-jour`), `.result .score` affiche une fiche et `.rrow` en compte 23. Les séries : « Match suivant », le tableau en cours (`.bk-serie`), un match en direct, la fin, puis l'onglet Séries du bilan — sans les Lignes du match ni deck (le jour à jour s'éprouve en Rogue : `essai_rogue.mjs`)
5. « Rejouer la saison » (`#replayBtn`) rejoue le même alignement contre les mêmes clubs, puis l'historique (`.lb-replay`) relit un alignement et repart une saison — droit au bilan à chaque fois
6. Le même parcours en tirage Loto (`#rrL` relance quand rien ne tient dans le budget)
7. Zéro erreur console (les portraits refusés ne sont demandés qu'une fois : `PORTRAITS_ABSENTS`)

`node scripts/smoke_table.mjs http://localhost:8000` fait le même parcours en mode bonus : l'option « Sur table » dans les options, le même auto-draft, le tournoi (`#hubModal`), le plateau (`#tableModal`, 247 cases, deux filets d'une case) où il joue un match geste par geste — il touche une pièce, lit les cases allumées, choisit des modes, dégage, tire, saute des verdicts en touchant la glace, dépense des relances d'équipe, change de trio — puis le reste du tournoi et le bilan. Il échoue si moins de quinze gestes ont pu être joués : c'est ce qui attrape une interface qui se fige.

L'Action `verifier.yml` fait tout ça à chaque PR, et, chacun dans sa propre étape : `check_coquille`, `check_graine`, `check_instantane`, `check_empreinte`, `check_ballottage`, `check_lancee`, `check_moments_si`, `check_gros` (`LIGUES=4`), `check_commentaire`, `check_feuilles` (une ligue), `check_parts`, `check_table`, `check_regles` (`MATCHS=80`), `check_ratings`, `check_traits`, `check_fiches`, `check_clarte`, `check_lexique`, `check_lisibilite`, `check_glace`, `check_pouvoirs` (`MESURE=0 N=20`), `check_mort`, `check_css`, puis `tout.mjs` (les 32 rapides), `check_actions`, le smoke et `smoke_table`. Les scripts de calibration (monotonie, plafond, tireurs, familles, badges, rôles, `inferer_glace`) restent à lancer à la main.

**Avant de pousser** : la marche à suivre est dans `CLAUDE.md` (« Avant de pousser »).

`node scripts/tout.mjs` enchaîne les vérifications rapides (moins de quinze secondes chacune) ; `node scripts/tout.mjs check_deck check_packs` n'en lance que quelques-unes. `check_packs`, `check_gardiens`, `check_combat` (une demi-minute chacun), `check_jambes` (une minute) et `check_banque` (une douzaine de minutes) se lancent à part.

Depuis la V21 : `node scripts/check_pouvoirs.mjs` (cinq minutes sur quatre processus ; `N` matchs par club et par pouvoir, 600 ; `COACHS=a,b` quelques coachs ; `MESURE=0 N=20` en CI, dix secondes) — chaque pouvoir, en paires contre un coach muet joué lui aussi en trois périodes : il joue exactement les périodes que sa condition lit dans la feuille, ne change rien hors d'elles, se voit le soir où il joue, reste sous sa borne et n'est jamais un piège ; le personnage complet ; chaque adjoint en poste, en paires (nommé à la feuille chaque soir, il se voit, et reste un style — ±1,5 V ramené à ce qu'une carte joue sur une saison) ; l'expérience, et un séjour qui joue exactement ses matchs, revient dans la main avec sa fiche et se repose, sur une saison.

Depuis le 31 oct. 2026 : `node scripts/inferer_gestes.mjs` (dix secondes) — les mises en échec, les tirs bloqués et les punitions tirées estimés en écart réduit (`zGeste`, js/sim.js) : ajustés sur 2015-2025, éprouvés en retenue vers le passé sur 2005-2012 (le rang de qui fait le geste ≥ 0,5, mieux que le repli d'avant, les coefficients du jeu à 0,01 près, l'estimation centrée et rétrécie sur une saison non mesurée) ; `check_gestes` (deux secondes, dans `tout.mjs`) joue la ligue de l'empreinte et tient les blocs (par match, leur part aux défenseurs, crédités à un habillé), les punitions tirées (nommées, du bon club, la ligue qui ne bouge pas), le compte des feuilles, les départs de qualité, les matchs-hommes perdus. `node scripts/roles_ref.mjs` refait la référence des rôles quand un shard change de colonnes.

Depuis le 31 oct. 2026 : `node scripts/inferer_glace.mjs` (une seconde) — le temps de glace inféré d'avant 1997-98 (`glaceInferee`, js/ratings.js) : la régression s'ajuste sur 2010-2025 et s'éprouve en retenue, vers le passé, sur 1997-2005 (R² ≥ 0,75 chez les avants, ≥ 0,6 chez les défenseurs ; la zone lue des minutes au moins aussi juste que le rang d'usage ; les coefficients écrits dans le jeu à 0,1 minute de l'ajustement du jour, sinon recopier la ligne « à coller » et monter `RATINGS_VERSION`), puis `python3 scripts/build_shards.py --rerate` refait les shards. Un chiffre inféré se joue dans un canal qui existe, se dit estimé (« ≈ »), et ne fait pas la valeur.

L'impact des choix en chiffres de match (`docs/impact-des-choix.md`) : `node scripts/check_chiffres.mjs` (une minute : ce que l'écran annonce égale ce que le moteur joue, en paires) et `node scripts/check_impact.mjs` (douze secondes : la base de la ligue, le témoin à zéro ; `COMPLET=1` le tableau de chaque choix).

Depuis la V3 : `node scripts/check_lancee.mjs` (une minute : la lancée et le doute du Rogue, absents du 82-0) et `node scripts/check_fils.mjs` (six secondes, dans `tout.mjs`) — les fils de la saison (la une, « Ton histoire », la section Histoire du bilan) citent des feuilles réelles, chaque chiffre s'y recompte, rien ne lit l'avenir. Le plan de la V3 : `docs/refonte-v3.md`.

Depuis la V10, tranche 1 : `node scripts/check_moments_si.mjs` (une minute, au CI) — un effet d'un moment ne joue que son soir, et dans une vraie ligue la saison diverge exactement au premier soir de son moment ; les moments d'un soir sont ceux d'une ligue jouée jusqu'à lui ; chaque moment courant revient au moins trois fois par saison de run, sans être vrai plus des trois quarts des soirs, et chaque rare au moins une fois. Le plan de la V10, le jeu de cartes neuf : `docs/refonte-v10.md`.

Depuis la V9, tranche 5 (récrit en V17) : `node scripts/check_duel.mjs` (six minutes ; `N` matchs par club et par bras, 1200) — deux copies d'un même vrai club, l'attentif (la meilleure proposition de l'adjoint) contre « Garder », sur les mêmes dés, semés ; le plan pris est celui que la période joue ; les périodes vues ne bougent pas.

Depuis la V9, tranche 6 : `node scripts/check_retours.mjs` (deux minutes ; `GRAINES=83,85,86`) — le choix d'un fil ne touche pas aux journées d'avant, son retour arrive le matin qui suit son dernier match et se recompte dans ces feuilles-là ; le jouer blessé, l'aggravation, la mémoire des commotions.

Depuis le Jalon P : `node scripts/check_arcs.mjs` (deux minutes) — chaque arc naît d'un fait relu dans le journal du club, joue son effet, se rejoue pareil ; sa valeur se mesure en blocs appariés (ses matchs avec et sans son effet, les mêmes dés), jamais en saisons appariées, qui divergent au moindre écart.

`node scripts/essai_poids.mjs <adresse>` (une demi-minute) mesure le premier écran comme un téléphone le vit, processeur ×4 : les requêtes, les octets compressés, le temps du titre ; sur le www/ de l'APK (`mobile/assembler-www.mjs`, servi à part), les trois tiennent.

`node scripts/essai_packs.mjs http://localhost:8000` (une vingtaine de minutes) signe des packs de joueurs tour après tour, avec « Aligner au mieux » un tour sur deux et « Plus tard » puis la boîte : chaque joueur signé reste dans l'alignement de l'écran, qui est celui du moteur.

Depuis la V18 : `node scripts/check_affinite.mjs` (trois minutes : chaque badge a un accord, un accord est porté par deux joueurs de la ligne à leur plus petit badge, plus d'accords font plus de chimie, la ligue garde son bonus de chimie, le levier de la chimie). Depuis la V9 (docs/refonte-v9.md § 10) : `node scripts/check_profondeur.mjs` (un quart d'heure ; `GRAINES=1 CAMPAGNES=1 RUNS_CAMPAGNE=2` en deux minutes : trois robots sur les mêmes dés, `politique` de scripts/lib/rogue_sim.mjs — le robot d'avant, l'attentif, le distrait ; les deux bouts, la première Coupe des campagnes ; `CAMPAGNES=0 GRAINES=4 FILS=2` mesure les clubs seuls en un quart d'heure, ± 1,4 V). L'ablation de l'attentif : `ROBOT_SAUF=plan,net,duel,aumieux,coach,lundi,fit` lui retire un geste à la fois, `ROBOT_COACH=tortue` lui force une philosophie, pour mesurer d'où vient son avance sur le robot d'avant, sur les mêmes dés (mesure seulement, jamais lu par le jeu). Ce n'est pas une vérification de la CI : `check_profondeur` est rouge tant que la première Coupe arrive avant la run 3, ou qu'après elle l'attentif gagne la Coupe d'office (les campagnes montent les exigences ; le point de départ : docs/refonte-v9.md § 14, la tranche 8 : § 21).

Depuis nov. 2026 : `node scripts/mesure_main.mjs` (une minute et demie sur huit fils ; `GRAINES`, `SAISONS`, `FILS`) — la main d'adjoints de l'attentif sur les clubs de check_profondeur, trois saisons de suite : la part des cartes d'adjoint entrées dans la main qui n'y jouent jamais un séjour (sous 25 %) et l'occupation des cases (docs/revue-rogue-2026-11.md § 2.3).

Depuis oct. 2026 : `node scripts/check_suivis.mjs` (une demi-minute par ligue ; `GRAINES=83,85`) — chaque fil suivi a son état chaque matin, recompté dans les feuilles, et son retour ; un joueur parti fait tomber la promesse ; l'objectif du proprio se recompte et se lève si son joueur part.

Depuis oct. 2026 : `node scripts/check_effets.mjs` (une vingtaine de minutes ; `N` matchs par club, 200 ; `IDS=q:,a:` quelques familles) — chaque effet du Rogue, en paires, se voit dans la feuille d'un soir où il joue, et sa force reste bornée (un adjoint : le style, pas la force).

Depuis la V19 : `node scripts/check_prolongation.mjs` (dans `tout.mjs`) — la prolongation, les tirs de barrage et la mort subite.

Depuis la 1.0 : `node scripts/check_robot.mjs` (le robot « premier Signer », 40 saisons, avec et sans ballottage ; `BALLOTTAGE=1`, `MODE=rogue`) et `RUNS=40 CAMPAGNES=6 node scripts/check_rogue.mjs` (la courbe des runs). Les photos d'action : `node scripts/actions.mjs` les refait (deux minutes, 700 Mo téléchargés une fois) et `node scripts/check_actions.mjs` les vérifie (avec l'adresse du jeu en argument, il simule aussi l'application Android ; réseau requis). Playwright peut vivre ailleurs que dans le dépôt : `NODE_PATH=<dossier>/node_modules`.
