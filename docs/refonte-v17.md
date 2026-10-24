# V17 · Le plan de match

JP, 24 oct. 2026, sur la capture d'un duel (l'intention « Les punitions », huit menus à régler) : *je veux plus ce système de matching* ; *ça devrait être des choix avant le match et pendant, mais plus stratégiques, genre tirer plus, suivre un joueur de près, qqchose qui change vraiment le match, mais sans briser les équipes au complet*. JP a tranché : **pour tous les matchs**.

## 1. Ce qui change

| Avant (V13) | V17 |
|---|---|
| Au duel, leur intention se contre en réglant ton tableau : le système de chaque unité, la consigne, le geste ; chaque réglage qui mord est une porte | Avant chaque match, tu choisis **ton plan** : un levier de hockey, avec son gain et son prix en vraies stats. Pas de casse-tête : aucun plan n'est « la bonne réponse » à leur intention |
| Seuls les gros matchs ont des choix pendant | Pendant un match regardé en direct, tu changes ton plan aux entractes ; un gros match garde ses trois périodes, avec un plan à chaque entracte |
| Leur intention, le seul levier qui « change le match » | Leur plan s'annonce encore, pour l'info : tu le lis au dépistage et à l'entracte |

## 2. Les plans

Les mêmes leviers que l'adversaire, sur les canaux qui existent : les intentions (`INTENTIONS`, js/sim.js), la consigne du match (`d.match`) et les canaux d'équipe. Une icône garde son sens : 🥷 l'ombre, ⛔ fermer le centre, 🐗 l'assaut, 🦂 les punitions sont les mêmes des deux côtés.

| Plan | Ce qu'il fait | Son prix |
|---|---|---|
| 🏒 Ton match | rien : ton alignement tel quel | — |
| 🌧 Tirer de partout | plus de tirs (volume ×1,15) | moins de précision (×0,965), plus d'usure des jambes |
| 🥷 Coller leur vedette | leur meilleur marqueur habillé tire deux fois moins, finit et crée moins | ton attaquant le plus fort en Défense, qui le suit, tire et crée moins ; ton club tire un peu moins |
| ⛔ Fermer le centre | moins de tirs contre (×0,92), et de moins bonne qualité | moins de tirs pour toi (×0,88) |
| 🐗 Forechecker fort | plus de tirs (×1,12), de la pression | plus de punitions (×1,25), plus d'usure |
| 🧘 Rester discipliné | moins de punitions (×0,7) | moins de mises en échec, un peu moins de tirs |

Mesuré (`check_plan_de_match`, NYI 92-93 contre six vrais adversaires, 4000 matchs en paires par plan) : chacun tient entre +0,2 et +0,9 V sur une saison, en moyenne des adversaires. Chacun se voit : 🌧 ±2,6 tirs, 🥷 ±0,37 point à leur vedette, ⛔ ±2,3 tirs de chaque côté, 🐗 ±0,75 punition, 🧘 ±0,73 punition. Le meilleur contre chacun : ⛔ contre les attaques (BOS, PHI, MTL), 🥷 contre une vedette (NJD, MTL, PHI), 🐗 contre le faible (DET), 🧘 contre Gretzky, 🌧 contre la trappe.

**La borne** : un plan change la FORME du match, pas sa force. Sur une saison, joué tous les soirs, le net d'un plan tient sous la borne d'une commune (±1 V), et il se voit dans la feuille (au moins ±2 tirs, ou ±0,5 punition, ou ±0,3 point à la ligne de la vedette collée). Aucun plan ne domine : chacun est le meilleur contre au moins un type d'adversaire (`check_plan_de_match`).

## 3. Où ça se joue

- **Avant le match** (tranche 2, faite) : Effectif › Dépistage, sous tes chances et avant les conseils, « Ton plan » en six tuiles à coins vifs (`planHtml`, js/saison.js ; la forme des options d'À faire, `optionHtml`), deux par rangée au téléphone. Chacune dit deux vraies stats de CE match (`planEnChiffres`, js/impact.js : le moteur lit le soir avec le plan contre « Ton match », les mêmes dés, `lectureDuMatch({ plan })`) ; 🥷 nomme les deux joueurs (« Hogue suit Gretzky », `cibleDuPlan`). Le plan en force porte l'or ; toucher un autre envoie la décision `{ jour, plan: { cle, vise } }` datée du soir du match, et la saison se rejoue. Il tient jusqu'à la suivante ; une autre du même soir le remplace (`ajouterDecision`, js/banc.js). Au Bureau, la ligne du match le dit en un mot (`PLANS[k].mot`).
  - **Ce qui part** : le conseil « 🎯 Consigne : attaque / 🛡 défense » du dépistage (js/pronostic.js) — il disait ce que ⛔ et 🌧 disent mieux, avec leurs chiffres. La consigne reste réglable aux Lignes.
  - **Le robot** (scripts/lib/rogue_sim.mjs, `planDuRobot`) : l'attentif lit le moteur à la première rencontre de chaque club (`planEnChiffres`, chaque plan contre « Ton match ») et garde contre lui celui qui rend le plus de buts nets, « Ton match » si aucun ne rend ; le distrait en tire un au hasard chaque soir ; le robot d'avant n'en pose aucun : la pente de check_rogue et check_robot reste celle d'un gérant grossier.
  - **Les règles** : un paragraphe, chaque chiffre lu dans `PLANS` (`check_clarte`).
- **Pendant un match ordinaire regardé** (pas fait) : le direct ne s'arrête pas aux entractes. Le duel s'arrête déjà aux siens (le même code, ses périodes rejouées sur des dés neufs), mais un match ordinaire se joue d'un bloc (`playGame`) : l'arrêter demande de le couper en périodes comme le duel, un chantier à lui seul.
- **Le gros match** (tranche 3, faite) : ses trois périodes restent, et l'enjeu aussi (le butin, ou sonnés ; la mise doublée avant la 3e). JP, 24 oct. : *les gros matchs, je veux que mon adjoint propose des ajustements à chaque période, j'en choisis un, il impacte la simulation* ; la boussole : *quelqu'un qui a joué à EHM, New Star Soccer, MLB The Show mobile se retrouve facilement*.
  - **Leur intention est leur plan** (`INTENTIONS`, js/sim.js) : les mêmes leviers que `PLANS`, posés par eux, chacun avec son prix (🥷 ton meilleur marqueur tire deux fois moins, leur joueur qui le suit crée moins ; ⛔ moins de tirs des deux bords ; 🐗 plus de tirs et de punitions pour eux ; 🦈 ton défenseur visé frappé, eux plus punis ; 🦂 tes punitions). Plus de contre, de porte ni de « contrée ».
  - **Ton adjoint propose** (`propositionsDuDuel`, js/impact.js) : son œil de hockey (`IDEES_DE_LADJOINT` : leur intention, le pointage en 3e, des jambes lourdes, leur vedette) donne deux ou trois plans de `PLANS` — jamais un système de ligne (JP : *même les stratégies de lignes, c'est à jeter*) —, chacun dit ensuite en vraies stats de LA période (le moteur lit la période avec lui contre ton plan en force, sous leur intention). Il peut se tromper, ou deux idées s'équivalent. Sa scène (`sceneDeLAdjoint`, js/scenes.js) : « Ils vont lui coller un homme aux fesses. Moi, je ferais tirer tout le monde. » — Avant la 2e contre Bruins · 1–0 · ils annoncent 🥷 L'ombre sur Sundin. Toucher un plan joue la période ; « Garder » laisse le tien.
  - **La force du duel** (`FORCE_DUEL` = 2) : au gros match, leur plan et le tien jouent plus fort qu'un soir ordinaire, chaque canal à la puissance 2, le gain comme le prix. Mesuré (`check_duel`, 1200 matchs par club et par bras, quatre clubs) : à 1, prendre la meilleure proposition ne se distinguait pas de garder (≈ +1 point) ; à 2, l'attentif gagne 52,7 % contre la même IA, le distrait 47,9 %, celui qui garde 46,8 % — 55,9 % en face à face, sous les 60 %.
  - **Le jour du match, pas la veille** : JP, *juste le jour du gros match, pas avant, ça gosse : décision, puis jour suivant*. Le moteur l'annonce toujours la veille (`ANNONCE_GROS`, la route le montre) ; son écran n'arrête l'avance que le matin où il se joue (`mainOuverte`, js/saison.js : `p.j === jour`). Un congé la veille passe sans rien demander.
  - **Le robot** (scripts/lib/duel.mjs) : l'attentif prend la proposition qui rend le plus de buts nets, garde si aucune ne rend ; le distrait en prend une au hasard ; le robot d'avant garde.

## 4. Ce qui part

Le tableau du duel (`lireLeTableau`, l'écran de huit menus, les gestes, les portes pleines et à moitié, la contrée qui se retourne contre eux, `FORCE_CONTRE`), `check_tableau`, et les règles fermes qui les nomment : partis (tranche 3). `check_duel` est la mesure du duel joué au plan, semée : deux clubs égaux, la meilleure proposition contre « Garder » tout le long, un avantage net mais sous 60 % en face à face.

## 5. Les tranches

| Tranche | Ce qu'elle fait | Ce qui la prouve |
|---|---|---|
| 1. Les plans | `PLANS` dans le moteur, la décision `plan` d'un match et d'une période | `check_plan_de_match` (en paires : la borne, se voit, aucun ne domine), `check_graine` |
| 2. Avant le match ✓ | « Ton plan » sous Effectif › Dépistage ; le robot choisit le sien | `essai_rogue` (10d : six tuiles, une en force, 🥷 nomme, la décision écrite, le Bureau la dit), `check_rogue` |
| 3. Pendant ✓ | le duel au plan que ton adjoint propose, le tableau part ; le gros match se règle son matin (le direct d'un match ordinaire ne s'arrête pas : à faire) | `check_duel` récrit et semé, `check_gros`, `essai_rogue` (20d, 20j : l'adjoint parle, deux ou trois plans, le plan pris dans la décision, pas d'ouverture la veille) |
| 4. Les règles | CLAUDE.md, docs/decisions.md, le journal | `check_mort`, `tout.mjs` |
