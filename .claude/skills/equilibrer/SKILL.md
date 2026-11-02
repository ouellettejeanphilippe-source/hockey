---
name: equilibrer
description: "Mesure l'équilibre d'un sujet du Rogue (un coach, un pouvoir, un adjoint, une carte, un pack, le duel, la courbe des runs) avec les juges du dépôt, en paires, et propose un réglage chiffré. Ne change rien sans accord."
argument-hint: "[sujet : pouvoirs | adjoints | cartes | packs | duel | runs | economie | <nom d'un coach, d'un pouvoir ou d'une carte>]"
user-invocable: true
---

# Équilibrer — le Rogue, mesuré

Le sujet : `$ARGUMENTS` (vide : la courbe des runs et les pouvoirs, les deux « À faire » d'équilibre de `PLAN.md`).

## 1. Lire avant de mesurer

- `.claude/rules/rogue.md` : les bornes du sujet (la rareté d'une carte, les 2,5 V et 4 V d'un pouvoir, les ±1,5 V d'un adjoint, les 60 % du duel, la première Coupe à la run 3 ou plus tard).
- `PLAN.md`, « À faire » : les déséquilibres déjà connus et leurs chiffres.
- Le code du sujet : la constante qui le règle, son fichier.

## 2. Choisir le juge le plus court qui répond

| Sujet | Juge | Le court | Le plein |
|---|---|---|---|
| pouvoirs, adjoints, un coach | `check_pouvoirs` | `MESURE=0 N=20` (10 s) · `COACHS=a,b` | `N=600` (~5 min) |
| cartes | `check_cartes` · `check_effets` | `IDS=…` pour cibler | ~20 min |
| packs, economie | `check_packs` · `mesure_rogue` · `check_rogue` | `RUNS=10 CAMPAGNES=2` | `RUNS=40 CAMPAGNES=6` |
| duel | `check_duel` | `N=200` | `N=1200` (~6 min) |
| runs | `check_profondeur` | `GRAINES=1 CAMPAGNES=1 RUNS_CAMPAGNE=2` (2 min) | ~15 min |

Dis la commande et sa durée avant de la lancer. Plus de cinq minutes : demande d'abord. Un repère décimal se juge sur la médiane de plusieurs graines (`GRAINES=1,2,3`), jamais sur une seule.

## 3. Lancer et lire

`node scripts/<juge>.mjs` avec ses variables. Cite le verdict tel que `verdict.mjs` l'imprime : les lignes rouges, les chiffres contre leurs bornes.

## 4. Rapporter

En français québécois, avec les mots du vocabulaire :

```
## Équilibre — <sujet> (<date>, <commit>)

Mesuré : <commande> — <durée>, <N, graines>

| Ce qu'on mesure | Borne | Mesuré | État |
|---|---|---|---|
| <pouvoir, carte…> | <±V> | <V [intervalle]> | sous la borne / au-dessus / mort / piège |

**Le problème** : <une phrase, chiffrée>
**Le réglage proposé** : `<CONSTANTE>` (<fichier>) de <avant> à <après> — effet attendu : <V>
**La preuve** : <le juge, et ce qu'il doit dire après>
**À trancher par JP** : <s'il y a lieu>
```

« Mort » : ne se voit jamais dans la feuille d'un soir où il joue. « Piège » : le prendre fait perdre.

## 5. Appliquer, seulement si JP dit oui

Un réglage à la fois. Puis : `VERSION_MOTEUR` monté dans `js/game.js` si un match ne se rejoue plus pareil, et `EMPREINTE=ecrire node scripts/check_empreinte.mjs` ; le juge relancé ; `node scripts/tout.mjs` et `node scripts/check_mort.mjs` ; une entrée courte au journal de `LIVRAISON.md` (et dans `docs/journal/AAAA-MM.md`) ; une décision neuve dans `docs/decisions.md`.

Pour un avis de design (est-ce le fun, est-ce un vrai choix), passe la main à l'agent `rogue-design` ; pour l'argent de la run, à `rogue-economie`.
