# V18 · Sans systèmes, l'affinité

JP, 25 oct. 2026, après la mesure de `docs/sans-systemes.md` : *enlever partout* ; *enlever [la chimie] comme avant, mais permettre affinité entre joueurs dont les styles marchent ensemble* ; *ajuste [l'Abbé]* ; puis, sur la capture du panneau « Plan de match » des Lignes (la glace, l'appariement, la consigne, le filet) : *ça aussi, enlever*. Et sur la carte des écrans de `docs/ecrans-rogue.md` : *good*.

## 1. Ce qui part

| Parti | Où il vivait | Ce qui en reste |
|---|---|---|
| Les systèmes de trio et de paire (`TACTIQUES`, `SYSTEMES_D`), leur fit, leur gain et leur prix, le cycle de qui étouffe qui | js/sim.js ; la rangée « Système » sous chaque unité et sa fenêtre (js/gerant.js) ; le conseil de système du dépistage (js/pronostic.js) ; le rapport d'éclaireur des séries | L'affinité (§ 2) : la chimie d'une ligne vient de ses joueurs, rien ne se règle |
| La glace de chaque trio en secondes et le roulement (`ROULEMENTS`, `sec`) | Lignes › Équipe ; les décisions du banc | Les minutes suivent `PART_UNITE` ; un coach, un adjoint ou un moment les déplacent (`F`, `D`), comme avant |
| L'appariement des trios (`appariement`, `planDeLIA`) | Lignes › Équipe | L'appariement par rang, le dernier changement à domicile (`APPARIEMENT`), le trio de fermeture (le 3e) |
| La consigne du match (`IMPORTANCES`, `d.match`) | Lignes › Équipe ; les règles | Les plans de match de la V17 (`PLANS`), qui disaient déjà mieux « attaque » et « défense » |
| Les conseils d'avant-match (`conseilsDuMatch`) | Effectif › Dépistage | « Ton plan », six tuiles en vraies stats de CE match |

« Devant le filet » reste : c'est le seul réglage du soir derrière le banc, avec les unités spéciales (AN · DN). Une vieille sauvegarde porte encore des lignes réglées, un roulement, un appariement ou une consigne : elle se relit, et rien de tout ça ne joue (`check_graine`). `VERSION_MOTEUR` passe à S121 : une saison en cours se rejoue.

## 2. L'affinité

Une ligne, c'est un trio et sa paire ; le 4e trio joue seul. Deux joueurs de la ligne **s'accordent** quand leurs badges marchent ensemble (`AFFINITES`, js/sim.js). Les accords sont ceux que les systèmes réunissaient déjà dans leurs cases : rien de neuf sur la glace, seulement la source.

| Accord | Les deux badges | D'où il vient |
|---|---|---|
| La passe et le tir | 🎯 sniper · 🅰 passeur | Volume de tirs, Contre-attaque |
| L'enclave | 🦍 power forward · 🅰 passeur | Jeu d'enclave |
| Les rebonds | 🎯 sniper · 🦍 power forward | Volume de tirs |
| L'échec avant | 🔧 checker · 🪠 plombier | Échec avant 2-1-2 |
| Les plombiers | 🪠 plombier · 👊 bagarreur | Trio de plombiers |
| La trappe | ☯ two-way · 🔧 checker | Trappe 1-3-1 |
| La paire classique | 🏒 manieur · 🛑 défensif | Rester à la maison, Sortie rapide |
| Un qui monte, un qui reste | 🚀 offensif · 🛑 défensif | Activer les défenseurs |
| Le garde du corps | 💪 physique · 🚀 offensif | Nettoyer l'enclave |
| La relance | ☯ two-way · 🏒 manieur | Jeu à deux sens |
| La sortie rapide | 🏒 manieur (paire) · 🎯 sniper (trio) | Sortie rapide |
| La pointe et l'écran | 🚀 offensif (paire) · 🦍 power forward (trio) | Activer les défenseurs, Jeu d'enclave |

- **La force d'un accord** est le plus petit des deux badges (Bronze 1 à Platine 4 ; un second badge à moitié) ; un accord ne compte qu'une fois par ligne, porté par sa meilleure paire de joueurs (`accordsDeLigne`). **L'affinité** d'une ligne est la somme de ses accords (`affiniteDeLigne`).
- **Sa chimie** : `chimieMax(AFF_BASE + AFF_PALIER × affinité) × CHIMIE_PART` (`chimieLigne`). Une ligne sans accord joue quand même ensemble (`AFF_BASE`, le plancher qu'un système donnait à toute ligne) ; une ligne incomplète n'a pas de chimie.
- **Ce qu'elle fait** est ce que la chimie faisait : son bonus (`bonusChimie`, autour de `CHIMIE_PIVOT`) et l'action spéciale de la ligne (`SPEC_BASE` × sa chimie, un tir qui entre `SPEC_MULT` fois plus). L'étouffé part avec le cycle des systèmes.
- **À l'écran** : sous chaque trio, l'agressivité de sa carrure et ses accords en puces de palier ; sous chaque paire, les siens et ceux qu'elle fait avec son trio (`affiniteEl`, js/alignement.js) ; dans la fiche, « S'accorde avec » après chaque badge (js/fiche.js) ; sur l'affiche du match et au rapport de tes lignes, l'accord de chaque ligne ; « ce qui a fait le match » dit « l'affinité » (js/causes.js) ; le commentateur raconte l'accord de la ligne qui tire (les étiquettes de js/commentaire.js : tir, filet, rebonds, pointe, sortie, échec, trappe). Le bouton « Aligner au mieux » pèse l'affinité avec le poste et la zone ; ses choix « seulement les trios », « seulement les systèmes », « Offensif » et « Défensif » partent : les deux derniers penchaient par leurs systèmes, et mesurés sans eux (`check_au_mieux`, six vrais clubs), ils rendaient le même alignement à Detroit et Tampa, et l'inverse de leur nom à Pittsburgh (le défensif y marquait 3,92 buts contre 3,77) et au New Jersey.
- **Dans la lecture neutre** (`alignementDuSoir`, js/impact.js), la part « Affinité » remplace « Systèmes » et « Chimie » : le soir tel quel contre chaque ligne sans accord.

## 3. Le plan adverse

Le plan d'un adversaire de gros match du 82-0 (`PLANS_ADV`) n'est plus un réglage de ses systèmes : c'est un des plans de match que tout le monde a (`PLANS`) — ⛔ fermer le centre, 🐗 forechecker fort, 🌧 tirer de partout, 🥷 coller ta vedette — ou ⭐ leur premier trio qui joue une éternité (ses minutes, `F`). Le moteur le joue comme n'importe quel plan (`poserPlanAdverse`, `planDe`). Le contrer, c'est s'y préparer : une préparation juste le fait tomber. Le dépisteur penche vers un plan selon les badges de leurs habillés qui le servent (`BADGES_DU_PLAN_ADV`). Les clés d'avant gardent leur nom ; « le jeu rapide » et « la possession », qui n'étaient qu'un système, partent.

## 4. La ligue garde ses chiffres

Calibré sur douze ligues de 32 vrais clubs (scripts/lib/voies.mjs, graines 7000 à 7011), la saison entière, contre main :

| | Buts par match | Tirs par match | Chimie moyenne des lignes, chaque journée |
|---|---|---|---|
| 82-0, avec les systèmes | 3,093 | 28,36 | 47,95 |
| 82-0, V18 | 3,097 | 28,35 | 47,65 |
| Rogue, avec les systèmes | 3,129 | 28,41 | 47,88 |
| Rogue, V18 | 3,154 | 28,40 | 47,63 |

- `FE_TIRS` 1,20 → 1,22 : les tirs que les systèmes ajoutaient (le volume de l'échec avant, du volume de tirs, de l'activation des défenseurs).
- `REF_STYLE_VOL` 1,03 → 1 et `REF_STYLE_DEF` 0,962 → 0,977 : le style moyen d'une ligue de base, sans système.
- `AFF_BASE` 66,2 et `AFF_PALIER` 4,2 : la chimie de saison d'avant. Calée d'abord sur le premier soir (64,5), elle tombait sous main sur la saison : un blessé remplacé casse un accord plus qu'il ne cassait un système. Calée sur la saison entière.
- Le Rogue tire 0,8 % de buts de plus, des deux côtés : ses lignes n'ont plus de styles fermés (V15), et l'action spéciale n'est plus étouffée.

## 5. Les coachs

`check_voies` (chaque coach à sa III, sur une équipe bâtie pour lui, en paires) : voir le tableau ci-dessous, rempli à la mesure.

## 6. Les écrans du Rogue

La carte tranchée par JP (`docs/ecrans-rogue.md`, « La carte qui en sort ») suit dans une PR à elle : la Presse dans la Boîte, le Butin chez l'entraîneur, l'Infirmerie en filtre de Joueurs, les Équipes dans le Classement, Ta saison devient Calendrier, le Palmarès refait pour le Rogue, le Dépistage devient « Avant-match » et reprend les chiffres de Lignes › Équipe, et on règle dans la Boîte. Ici, Lignes › Équipe ne garde que ton équipe ce soir, « Devant le filet » et les unités spéciales.

## 7. Les preuves

- `check_affinite` (remplace `check_chimie`) : chaque badge a un accord, un accord est porté par deux joueurs de la ligne à leur plus petit badge, plus d'accords font plus de chimie, une ligne sans accord joue ensemble, la ligue garde son bonus de chimie, le levier de la chimie.
- `check_graine` : chaque plan de match déplace la saison ; les lignes réglées, le roulement, l'appariement et la consigne d'une vieille sauvegarde ne jouent plus.
- `check_gros` : chaque plan adverse est un plan de match ou les minutes d'un trio, et il joue (« Tirer de partout » leur donne plus de tirs que « Fermer le centre »).
- `check_clarte` : la page des règles dit les douze accords dans l'ordre d'`AFFINITES` et l'action spéciale depuis `SPEC_MULT` ; elle ne dit plus « système », « consigne du match », « secondes par présence » ni « fit ».
- `check_totaux`, `check_au_mieux`, `check_impact`, `check_profil`, `check_jambes` : leurs épreuves des systèmes, de la consigne et de la glace sont réécrites en affinité, en effets du soir et en minutes d'un coach.
- Partis : `check_styles`, `check_tactiques`, `check_plans`, `mesure_sans_systemes` et deux copies de débogage.
