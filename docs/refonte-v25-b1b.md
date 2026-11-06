# V25 · B1b — Une grammaire d'effet : l'extrait du devis

L'extrait de `docs/refonte-v25.md` pour la seconde moitié de la tranche **B1** (6 nov. 2026) : la grammaire. La première (B1a, docs/refonte-v25-b1a.md) a posé l'échelle `NIVEAUX`.

    node scripts/check_refonte.mjs docs/refonte-v25-b1b.md

## Ce que B1b livre

- **Une seule grammaire d'effet**, `js/effets.js`, dix cases : `{ quand, canaux, adv, lui, duree, jetons, xp, gestes, pari, suite }`. Les pouvoirs du coach (js/pouvoirs.js), le style et le signal des adjoints (js/adjoints.js : `quand` est la condition du signal, `relais.cote` nomme `canaux` ou `adv`), les réponses des histoires (js/dossiers.js), les cartes de la banque (js/banque.js), les avant-matchs et les ajustements de série (js/sim.js), les choix de fil (js/vie-gm.js) s'écrivent dans cette grammaire : `effet` devient `canaux`, `action` devient `gestes`, `gain` devient `jetons`, `si` devient `quand`, les canaux inline d'une option deviennent `canaux: { … }`, les issues d'un pari sont des effets de la même grammaire.
- **Les chiffres se dérivent de l'effet, la réplique reste écrite** (JP, 5 nov. 2026) : `motsDe(effet, { qui, cadre, offert })` rend les lignes vertes et rouges d'une carte — les jetons, l'expérience, les canaux en vraies stats du club (js/impact.js `motsEnChiffres`), les gestes, ce qui va au joueur nommé, le dé —, les mêmes partout : la tuile de choix, la carte de choix, la carte de vestiaire du duel, l'ajustement de série, le dé d'une audace, la règle d'une carte de la banque. Les `bon` et `prix` écrits à côté des réponses d'histoire partent : une ligne ne peut plus contredire ce que le moteur joue. Les mots des gestes, du pari et du joueur nommé vivent une fois, dans effets.js (ils étaient dans gerant.js, banque.js et saison.js, trois fois avec trois tournures).
- **Le moteur lit la grammaire** : `appliquerGestes` lit `gestes`, `canaux`, `lui`, `duree`, `pari` ; `effetDeMoment` (js/greffes.js) lit `canaux` au lieu de deviner les canaux parmi dix-huit champs exclus ; l'avant-match et l'ajustement de série lisent `canaux` et `gestes`. Aucun match ne change : `check_empreinte` vert à S144.
- **Les juges suivent** : `check_mots` est réécrit (une réponse qui touche le match se voit, chacune se dit en lignes dérivées, une audace dit ses deux issues au nom du joueur, les jetons et l'expérience se versent une fois, jamais sous un `quand` ni dans une issue) ; `check_dossiers` exige les dix cases et rien d'autre (`CASES`, `GESTES`, `CANAUX_LUI`, `estVide`) ; `check_choix`, `check_incidents`, `check_effets`, `check_pouvoirs`, `check_relais`, `check_verdicts`, `check_clarte` et les robots (scripts/lib/cartes_robot.mjs, rogue_sim.mjs) lisent la grammaire.

## 7. Ce qu'il touche

- La grammaire et ses tables : `js/effets.js` (neuf), `js/pouvoirs.js`, `js/adjoints.js`, `js/dossiers.js`, `js/banque.js`, `js/vie-gm.js`, `js/sim.js` (les tables `AVANT_GROS` et `AJUSTEMENTS`, `appliquerGestes`, `effetAvant`, l'ajustement de série).
- Les lecteurs : `js/greffes.js`, `js/impact.js`, `js/gerant.js`, `js/saison.js`, `js/rogue-jeu.js`, `js/verdicts.js`, `sw.js`.
- Les juges : `scripts/check_mots.mjs`, `scripts/check_dossiers.mjs`, `scripts/check_choix.mjs`, `scripts/check_incidents.mjs`, `scripts/check_effets.mjs`, `scripts/check_pouvoirs.mjs`, `scripts/check_relais.mjs`, `scripts/check_verdicts.mjs`, `scripts/check_clarte.mjs`, `scripts/lib/cartes_robot.mjs`, `scripts/lib/rogue_sim.mjs`.
- Les règles et les docs : `.claude/rules/rogue.md`, `.claude/rules/vocabulaire.md`, `docs/structure.md`, `LIVRAISON.md`, `docs/journal/2026-11.md`, `docs/decisions.md`.

## 8. Ce qui part

Chaque nom disparaît du jeu (js/, index.html, style.css, sw.js) ; `check_refonte` le vérifie.

- Les trois tournures des mêmes mots : `motsDAction` (gerant.js), `motsConcrets` (saison.js), les motsDesGestes de banque.js (une seule, dans effets.js) ; `canauxDe` et la table des canaux de gerant.js (la grammaire les porte) ; les mots du joueur nommé (MOTS_DU_JOUEUR, FACE_DU_JOUEUR, motsSurLeJoueur) déménagent de gerant.js dans effets.js.
- Les déclencheurs en trop : `signal.quand` (la condition d'un adjoint est sa case quand) ; `o.si` (le moment d'une réponse est son quand).
- Les lecteurs des champs partis : `o.action`, `o.gain`, `o.ensuite` (aucune table n'avait plus d'investissement), `o.changeGardien`, le `gardienAux: true` de l'ajustement « Donner le filet à l'auxiliaire » (un geste, comme les autres).
- Les bon et prix écrits à côté des réponses de js/dossiers.js (41 chaînes), et la règle de `check_mots` qui les comparait aux lignes (la table des mots de chaque stat).

## 8b. Ce qui reste

- `bon`, `prix`, `enjeu`, `trou` sur les avant-matchs (`AVANT_GROS`) et les ajustements (`AJUSTEMENTS`) de js/sim.js, `bon`, `prix`, `rien`, `suivi`, `monte`, `mentor` sur les choix de fil (`CHOIX_DES_FILS`) : la tranche C les refait en histoires (le devis : « jusqu'à la V25 C ») ; leurs canaux et leurs gestes sont déjà dans la grammaire, leurs lignes déjà dérivées. L'avant-match garde `enjeu` (l'élan ou le contrecoup doublé) et `trou` (un règlement), qui ne sont pas des effets.
- `ARCS` (js/arcs.js) et ses épisodes à `effet` : la machine d'arcs part à la tranche C.
- `dit` sur les pouvoirs, les adjoints et leurs signaux : la réplique écrite à la main (JP : *la réplique écrite*).
- La décision garde ses clés (`gain`, `effet`, `gestes`, `xpCoach`) : les sauvegardes ne bougent pas — `check_sauvegardes`.
- `MOMENTS_SI` et la clé `si` d'un effet posé sur le club (js/sim.js) : le moteur, pas la carte — `check_moments_si`.
- `formeDe`, `formeDesMots`, `optionHtml`, `grosChiffre` (js/gerant.js) : la tranche B2 (une carte de jeu).
