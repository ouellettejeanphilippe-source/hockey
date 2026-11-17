---
name: equilibrer
description: "Mesure l'équilibre d'un sujet du Rogue (la saison, ses objectifs, ses portes et son plafond, le banc et ses pièces, le marché du quart et les pochettes, le duel, l'élite, les histoires) avec les juges du dépôt, en paires, et propose un réglage chiffré. Ne change rien sans accord."
argument-hint: "[sujet : saison | objectifs | portes | banc | marché | histoires | duel | run | <nom d'un coach ou d'une pièce>]"
user-invocable: true
---

# Équilibrer — le Rogue, mesuré

Le sujet : `$ARGUMENTS` (vide : la run et le banc, `mesure_run` puis `check_pouvoirs`).

## 1. Lire avant de mesurer

- `.claude/rules/rogue.md` : les bornes du sujet (les Coupes des robots sur 64 graines, « bâtir ne coûte pas » et « un bon DG garde ses cœurs » en paires, les cinq bornes du build à 256 graines, les marches d'une pièce et la borne d'un canal, les bornes de l'élite, la borne en victoires d'une réponse d'histoire) ; `.claude/rules/tests.md` : ce que chaque juge exige (la part de victoires d'un duel entre égaux, 40 à 55 %).
- `docs/refonte-v30-2.md` (§ 4 les chiffres, § 8 les réglages, § 9 les critères, § 12 ce qui reste ouvert), `docs/refonte-v29.md` pour le banc (§ 4 les chiffres, § 9 les critères) et `docs/decisions.md` (« La V30 », « La V29 : le build décide ») : ce qui est déjà mesuré et ce qui reste ouvert. Les lignes d'équilibre de « À faire » dans `PLAN.md` datent de l'ancien Rogue.
- Le code du sujet : la constante qui le règle, son fichier. Les leviers de la run sont l'objet `RUN` de `js/run.js` (les objectifs du proprio `OBJECTIFS`, le plafond `RACHAT`, les étapes d'édition `ETAPES` 1·3·6·12, puis 12 en séries, les bandes `REPECHAGE.BANDE` et `LIGUE.BANDE`, la hauteur des portes `PORTES_AUTOUR`, les affiches `AFFICHES`, la relance `RELANCE`, les jetons `JETONS_DU_MATCH`, `JETONS_DE_L_AFFICHE` et `JETONS_DU_RIVAL`, les prix `POCHETTES` et `MONTER`) ; ceux du banc sont dans `js/pieces.js` (les seuils de `PIECES`, `MARCHES`, `BORNE_DU_CANAL`, `BANC_DES_SERIES`) ; **2 ❤️** ne se règle pas (JP, 7 nov. 2026).

## 2. Choisir le juge le plus court qui répond

| Sujet | Juge | Le court | Le plein |
|---|---|---|---|
| run, saison, objectifs, portes | `check_run` · `mesure_run` | `node scripts/check_run.mjs` (une vingtaine de secondes : deux saisons du bâtisseur) · `GRAINES=8 FILS=2 node scripts/mesure_run.mjs` (les bornes s'impriment sans se juger) | `GRAINES=64 FILS=3 node scripts/mesure_run.mjs` (une douzaine de minutes ; jamais plus de 3 fils ici) ; `REGLAGES='{"RACHAT":0.6}'` essaie un levier de `RUN` sans toucher au code (un objet, comme `OBJECTIFS`, se fond dans celui de `RUN`) ; `ROBOTS=malin,distrait` juge le gardien ; `CRANS=1 GRAINES=128 FILS=3`, les exigences |
| banc, une pièce, un coach | `check_pouvoirs` · `mesure_run` · `check_gros` (leur banc en séries) | `MESURE=0 N=20 node scripts/check_pouvoirs.mjs` (quelques secondes, sans les chiffres de valeur) · `PIECES=a,b` | `node scripts/check_pouvoirs.mjs` (une minute) ; ce qu'une pièce vaut dans une run : `GRAINES=256 FILS=3 GRAINE0=4000 node scripts/mesure_run.mjs` (une heure) ; `SEUILS='{"gros":[7,14,20]}'` essaie les seuils d'une pièce sans toucher au code |
| un moment (le `quand` d'une réponse d'histoire) | `check_moments_si` | `node scripts/check_moments_si.mjs` (une demi-minute) | le même |
| duel, élite | `check_duel` · `check_elites` | `N=200` · une seconde | `N=1200` (une minute) |
| marché, pochettes | `check_packs` · `check_run` | une seconde et demie · une vingtaine de secondes | `mesure_run` avec `REGLAGES` (les jetons d'un match, d'une affiche, d'une porte passée, le prix des pochettes) ; il imprime, sans les juger, les jetons gagnés, la caisse à la fin, les pochettes, les relances et les cartes montées par run ; les robots habiles ouvrent des pochettes et montent une carte, mais aucun juge ne dit encore ce que vaut une pochette dans une run |
| histoires | `check_histoires` · `check_mots` · `check_effets` | quelques secondes · `IDS=d:<histoire>` pour cibler | `check_effets` (une vingtaine de minutes) |

Dis la commande et sa durée avant de la lancer. Plus de cinq minutes : demande d'abord. Un repère se juge sur plusieurs graines (64 pour `mesure_run` ; sous 32, rien ne se juge), jamais sur une seule. Un compte de Coupes sur 64 runs tire au sort à ±5 ; un écart entre deux robots se lit en paires, à son erreur type, que `mesure_run` imprime ; les bornes du build (« bâtir paie », « dur, mais ça explose », « les séries sont le mur », « aucune marche d'office », « chaque pièce vit ») se jugent à 256 (`GRAINES=256 FILS=3 GRAINE0=4000 node scripts/mesure_run.mjs`, une heure) : à 64, elles s'impriment sans se juger, et le rapport le dit. Un résultat au bord du bruit se rejoue sur des graines neuves avant de se proposer : le 11 nov. 2026, un levier « gagnant » sur 128 graines ne l'était plus sur les 128 suivantes.

## 3. Lancer et lire

`node scripts/<juge>.mjs` avec ses variables. Cite le verdict tel que `verdict.mjs` l'imprime : les lignes rouges, les chiffres contre leurs bornes.

## 4. Rapporter

En français québécois, avec les mots du vocabulaire :

```
## Équilibre — <sujet> (<date>, <commit>)

Mesuré : <commande> — <durée>, <N, graines>

| Ce qu'on mesure | Borne | Mesuré | État |
|---|---|---|---|
| <pièce, objectif, levier de la run…> | <sa marche, ±V, points sur 82, Coupes sur 64…> | <mesuré [intervalle]> | sous la borne / au-dessus / mort / piège / non jugé (trop peu de graines) |

**Le problème** : <une phrase, chiffrée>
**Le réglage proposé** : `<CONSTANTE>` (<fichier>) de <avant> à <après> — effet attendu : <V, points sur 82, cœurs perdus, Coupes>
**La preuve** : <le juge, et ce qu'il doit dire après>
**À trancher par JP** : <s'il y a lieu>
```

« Mort » : ne se voit jamais dans la feuille d'un soir où il joue ; pour une pièce de banc, sa première marche atteinte moins d'une fois sur deux. « Piège » : le prendre fait perdre.

## 5. Appliquer, seulement si JP dit oui

Un réglage à la fois. Puis : `VERSION_MOTEUR` monté dans `js/game.js` si un match ne se rejoue plus pareil, et `EMPREINTE=ecrire node scripts/check_empreinte.mjs` ; le juge relancé ; `node scripts/tout.mjs` et `node scripts/check_mort.mjs` ; une entrée courte au journal de `LIVRAISON.md` (et dans `docs/journal/AAAA-MM.md`) ; une décision neuve dans `docs/decisions.md`.

Pour un avis de design (est-ce le fun, est-ce un vrai choix), passe la main à l'agent `rogue-design` ; pour l'argent de la run, à `rogue-economie`.
