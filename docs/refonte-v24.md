# V24 — Le banc qui s'active : des adjoints qui entrent quand le match les appelle, et une banque assez large pour bâtir

## 1. Ce que JP a dit

- JP, 3 nov. 2026 : *j'aime le concept qu'un coach ou assistant s'active en réussissant à atteindre x tirs ou autre trucs, ça fait que je dois adapter mon alignement en fonction du coach, ce qui est réaliste et logique.*
- JP, 3 nov. 2026 : *it has to make sense. Par exemple, l'effet de l'arbitre est d'avoir moins de pénalités, donc ça peut pas être la condition qui l'active dans le match.*
- JP, 3 nov. 2026 : *the coachs and adjoints devraient être comme ça et il devrait avoir une grande variété pour permettre plein de build qui synergisent ou non, etc.*

## 2. Ce que le joueur ressent

« Je bâtis mon banc comme mon alignement. » Un adjoint n'est plus un bonus de tous les soirs : il entre quand le match l'appelle — tu mènes, tu tires de l'arrière, tu joues à l'étranger, tu habilles trois francs-tireurs. Le pic : le soir où trois adjoints s'allument ensemble parce que ton club joue exactement le hockey pour lequel tu l'as bâti. Le jour ordinaire : regarder ton banc avant le match et savoir qui entrera si ça tourne mal.

## 3. Les règles du jeu

- **Une condition par adjoint, jamais son propre effet.** Elle se lit sur ce qui est déjà joué ou déjà connu au matin, comme un pouvoir du coach (`pouvoirsDeLaPeriode`, js/pouvoirs.js) : le pointage ou les tirs après une période, un moment du soir (`MOMENTS_SI` : le lieu, le dos-à-dos, les jambes, le rival, la bête noire, après une défaite, après trois victoires, l'infirmerie, les séries), ou ce que ton alignement habille (les badges des habillés : trois 🎯 francs-tireurs, trois 🔧 ou 🪠, deux 🛑 défensifs, l'auxiliaire au filet).
- **Il joue la période qui vient** quand sa condition se lit ; une condition du soir (le lieu, l'alignement) le fait jouer les trois périodes. Hors de sa condition, il ne fait rien (son salaire court quand même : il est en poste).
- **Sa carte dit sa condition d'abord**, puis ce qu'il fait en vraies stats de la période (« Quand tu mènes : −1,2 tir contre la période, −0,4 tir la période »).
- **Au banc du soir** (js/banc-du-soir.js) : il s'allume avec les périodes où il a joué, comme un pouvoir ; éteint, « pas ce soir ».
- **Au duel**, il propose le plan de son style (V24 déjà livré, `voixDuBanc`) ; sa condition ne joue pas au duel, où son plan le remplace.
- **La banque passe de 9 à 25 adjoints**, offerts un parmi trois comme avant (`adjointsOfferts`), chacun une voie (son coach) ou un salaire (hors des voies). Les builds naissent des conditions qui se répondent : un banc « qui mène » (le mur, le chasseur, le showman), un banc « qui remonte » (le canonnier, le cogneur, le vedettiste), un banc de la route, un banc de l'alignement (le spécialiste, le plombier-chef, le coach des défenseurs). Deux conditions contraires sur le même banc (mener / tirer de l'arrière) ne s'allument jamais ensemble : c'est un choix.

### La banque

| | Adjoint | Voie | Il entre… | Ce qu'il fait |
|---|---|---|---|---|
| 1 | 🏹 Le canonnier | 🐝 essaim | quand tu es dominé aux tirs | plus de tirs, moins de précision |
| 2 | 🔭 Le tireur d'élite | 🦅 rapaces | quand tu tires plus qu'eux sans mener | plus de précision, moins de tirs |
| 3 | 🧱 Le mur | 🐢 tortue | quand tu mènes | moins de tirs contre, moins de tirs |
| 4 | 🏋 Le cogneur | 🦏 rhinos | quand tu tires de l'arrière | mises en échec, plus de punitions |
| 5 | 🧘 Le moine | 😇 chœur | en 3e, à un but d'écart ou moins | moins de punitions, moins de mises en échec |
| 6 | 🔁 Le rouleur | 🪜 profondeur | en 3e période | quatre trios, moins de blessures |
| 7 | 🎤 Le vedettiste | 🌠 étoiles | à égalité ou derrière | ton 1er trio joue plus, plus de blessures |
| 8 | 🏃 Le préparateur | 🫁 souffle | un soir de dos-à-dos ou de jambes lourdes | jambes fraîches, moins de blessures |
| 9 | 🦓 L'ancien arbitre | — (salaire) | à domicile | moins de punitions pour toi, plus pour eux |
| 10 | 🧊 Le stratège | 🐢 tortue | en 1re période | moins de buts contre, un peu moins de tirs |
| 11 | 🔥 L'allumeur | 🐝 essaim | après une défaite | plus de tirs |
| 12 | 🎯 Le spécialiste | 🦅 rapaces | quand trois 🎯 francs-tireurs ou plus s'habillent | plus de précision |
| 13 | 🥅 L'entraîneur des gardiens | 🐢 tortue | quand l'auxiliaire est au filet | plus d'arrêts |
| 14 | 🪓 Le policier | 🦏 rhinos | contre un rival ou ta bête noire | mises en échec, leur précision baisse |
| 15 | 🧳 Le routier | 🫁 souffle | à l'étranger | jambes fraîches, un peu plus de tirs |
| 16 | 📣 L'animateur | — (salaire) | à domicile | plus de tirs, plus de punitions pour eux |
| 17 | 🧒 Le développeur | 🪜 profondeur | quand trois recrues ou plus s'habillent | tes 3e et 4e trios jouent plus, plus de précision |
| 18 | 🦉 Le vieux renard | 😇 chœur | en séries | moins de punitions, moins de buts contre |
| 19 | 🎬 Le showman | 🌠 étoiles | quand tu mènes à domicile | ton 1er trio joue plus, plus de précision |
| 20 | 🩺 Le médecin | — (salaire) | quand l'infirmerie déborde | moins de blessures, jambes fraîches |
| 21 | 🐺 Le chasseur | 🦅 rapaces | quand tu mènes d'un but | plus de précision |
| 22 | 🌀 Le patineur | 🫁 souffle | les jambes fraîches | plus de tirs |
| 23 | 🔨 Le plombier-chef | 🪜 profondeur | quand trois 🔧 ou 🪠 s'habillent | mises en échec, tes 4e trios jouent plus |
| 24 | 🃏 Le flambeur | — (salaire) | après trois victoires | plus de tirs et de précision, plus de buts contre |
| 25 | 🛡 Le coach des défenseurs | 🐢 tortue | quand deux 🛑 défensifs ou plus s'habillent à la ligne bleue | moins de tirs contre |

Chaque voie compte trois adjoints au moins ; quatre sont hors des voies, avec un salaire. Aucune condition n'est l'effet de son adjoint (le moine n'entre pas « quand tu prends peu de punitions », l'arbitre n'entre pas « quand ils en prennent »).

## 4. Les chiffres

- **La force d'une période active** : la table de l'adjoint à son niveau (`styleAuNiveau`, ×0,7 à ×1,3 pour ce qu'il donne). Un adjoint qui joue une période sur deux rend la moitié de ce qu'il rendait chaque soir : la table de chacun est remontée jusqu'à ce que le soir où il joue se voie dans la feuille (±2 tirs, ±0,3 but, ±0,5 punition, ±4 mises en échec : la règle des cartes, rogue.md).
- **La borne** ne change pas : ramené à une saison, il reste sous la borne de son niveau (`BORNE_NIV`, ±1 V au Soutien à ±4 V au Phénomène) et n'est jamais un piège.
- **La fréquence** : chaque condition s'allume à peu près une période ou un soir sur trois à deux sur trois (une condition rare, les séries ou l'auxiliaire, joue plus fort quand elle joue, comme une carte d'un moment rare).

## 5. Les cas limites

- Un adjoint d'avant la V24 dans une vieille partie : la même clé, la même table au même niveau, sa condition en plus ; une partie en cours se rejoue (`VERSION_MOTEUR`).
- Les séries : les conditions du soir y valent ; « en séries » est la condition du vieux renard.
- Un alignement incomplet (un blessé, le remplaçant de la ligue) : les badges se comptent sur les habillés du soir.
- Le duel : la condition ne joue pas ; le plan proposé, oui.

## 6. Ce qu'il touche

- js/adjoints.js (la banque, `quand`, `dit`), js/sim.js (`jouerEnPeriodes` : les adjoints posés par période comme les pouvoirs ; `poserLesAdjoints` ne pose plus que le journal), js/impact.js (`lignesDeLAdjointEnChiffres` : la condition devant, la période), js/profil-style.js et js/banc-du-soir.js (le banc allume les périodes), js/rogue.js (aucun changement de l'économie), scripts/check_pouvoirs.mjs (chaque adjoint mesuré sur les périodes où il joue), scripts/check_banc.mjs.
- Règles : rogue.md, « Court, un style frappe fort chaque soir » devient « un style frappe fort quand il entre » ; vocabulaire.md, la **condition** d'un adjoint.

## 7. Les réglages

- Les tables des 25 adjoints, réglées une à une par `check_pouvoirs` (visibles, sous leur borne, jamais un piège).
- Les seuils d'alignement : trois francs-tireurs, trois 🔧 ou 🪠, deux 🛑 défensifs, trois recrues (pris pour qu'un alignement bâti exprès les atteigne, et un alignement ordinaire rarement).

## 8. Les critères d'acceptation

- [ ] Chaque adjoint ne joue que les périodes où sa condition se lit, et rien hors d'elles — `check_pouvoirs`
- [ ] Le soir où il joue, il se voit dans la feuille ; sur une saison, il reste sous la borne de son niveau, jamais un piège — `check_pouvoirs`
- [ ] Aucune condition n'est l'effet de son adjoint — `check_pouvoirs` (la liste des canaux de l'effet contre la lecture de la condition)
- [ ] Le banc du soir allume les périodes jouées — `check_banc`
- [ ] La courbe des runs tient — `check_rogue`, `check_profondeur`
- [ ] À juger par JP à l'essai : les builds se sentent ; on regarde son banc avant le match.

## Les tranches

1. Les neuf adjoints conditionnels, leurs tables remontées, le moteur par période, la carte et le banc — `check_pouvoirs`, `check_banc`.
2. Les seize neufs, en deux lots de huit, chacun mesuré — `check_pouvoirs`.
3. Les conditions d'alignement (badges habillés) — `check_pouvoirs`, `check_moments_si`.
4. Plus tard, si JP le veut : la même variété pour les coachs (deux arbres de pouvoirs par philosophie).
