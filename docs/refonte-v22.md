# V22 — La banque d'événements et les adjoints, refaits à neuf

JP, 31 oct. 2026 : *les événements et adjoints, c'est encore à chier. Supprime tout, fais un plan de quoi on fait, et repars sans reprendre* ; *je veux supprimer la banque d'événements, pas le système* ; *coach plus adjoints dans une main, qui sont là x matchs et changent le style de l'équipe* ; *soumets pas de PR avant d'avoir refait*.

On casse les vieilles parties (JP, V21 : *on s'en fout de briser les saves*). Une vieille décision dont la famille n'existe plus ne joue rien et ne plante pas (`check_sauvegardes`).

## Ce qui est parti (phases 1 et 2)

**La banque d'événements** — le contenu, pas le système :

- les 19 dossiers de la semaine (`DOSSIERS`, js/dossiers.js), dont `laMasse` et `laTete` ;
- les quatre choix de fil (`CHOIX_DES_FILS`, js/vie-gm.js : le Cheechoo, la disette, le duo, la recrue) ;
- les courriels, les points de presse et les dilemmes de la vie d'un DG-coach (js/vie-gm.js, ~760 lignes) ;
- les 23 dilemmes (`MOMENTS`), les séquences (`SEQUENCES`), leurs faits (`FAITS`, `faitsDuClub`) et leurs tirages (`momentDuJour`, `matchDuMoment`, `JOURS_MOMENTS`) ;
- les 20 arcs (`ARCS`, js/arcs.js) ;
- `CARTES_MATCH_VIE` (js/cartes-vie.js, déjà vide).

**Les adjoints du staff de la V21** (js/adjoints.js) : les douze échanges, la main de six, les trois en poste, le bras droit (`BRAS_DROIT`), les « légers d'abord », l'écran Bureau › Coach › Ton staff, les offres des 9e, 18e et 26e matchs, du butin d'un gros match gagné, du verdict du proprio et des dossiers.

## Ce qui reste (le système)

La boîte « À faire » et ses spécifications (`messagesCourants`, `specsForces`), `semaineAHistoire` et `dossierDeLaSemaine` (qui rend `null` tant que la banque est vide), `appliquerGestes`, `pariDeDecision`, `familleDeMoment` (les familles `fil` et `dossier`), `js/scenes.js`, `EXPEDITEURS`, `joueurDuFait`, `VOIX_DES_FILS` et la une, les suivis et leurs retours, la boucle des arcs (`episodesDuMatin`, `DEFIS`, `avanceDuDefi`), `MOMENTS_SI`, `SITUATIONS`, `deposer.js` (les Lignes s'en servent), tous les choix du gros match, de la signature, de la blessure, du physio, du proprio, des rivaux, du talent du coach, et le duel avec son adjoint qui propose les plans (V17).

Le coach garde ses pouvoirs seuls : `forceDuPouvoir` = talents × maîtrise de l'entraîneur.

## Ce qui reste à refaire

### Phase 3 — Les adjoints : une main, des séjours, un style

À valider avec JP avant de coder (les défauts sont ceux du plan) :

1. Ton coach plus une **main** d'adjoints (quatre cartes au plus). Un adjoint **se joue** depuis la main et reste en poste **X matchs** (défaut : 12), puis il part de lui-même.
2. **Un style, pas une force** : chaque adjoint change la forme du match sur deux canaux du moteur, un gain et un prix, en vraies stats de match. Au plus ±1,5 V seul (`check_pouvoirs`). Une liste neuve, écrite de zéro, à partir du profil de style (`js/profil-style.js`).
3. En poste : 1 au niveau 1-2 du coach, 2 au 3-4, 3 au 5.
4. Ils arrivent aux mêmes occasions qu'avant (paliers, butin d'un gros match, verdict, histoires), un parmi trois, gratuit.
5. Pas de bras droit. Un adjoint dont le style rejoint la philosophie du coach reste +3 matchs.
6. Deux champs de décision neufs (`main`, `joue`) ; le moteur compte les matchs *joués* du club depuis la pose.
7. L'écran : Bureau › Coach, la main en cartes (`deposer.js`) et les cases en poste avec le compte à rebours.

### Phase 4 — La banque d'événements neuve

Écrite de zéro, petite d'abord : six histoires, une par fait de hockey lisible dans les feuilles. Les trois premières sont soumises à JP (ton et mécanique) avant le reste. Récompenses concrètes seulement : de l'expérience au coach, des jetons, une carte d'adjoint dans la main, un blessé qui revient, un dépanneur. Puis les quatre choix de fil, un à la fois, avec leur retour. Les règles de CLAUDE.md tiennent déjà (`check_dossiers`, `check_mots`, `check_effets`).

## Les vérifications

Les scripts qui mesuraient du contenu parti sont vides-vacuement-vrais tant que la banque est vide ; ils se réarment avec la banque neuve (phase 4) : `check_dossiers`, `check_mots`, `check_effets`, `check_arcs`, `check_retours`, `check_suivis`, `check_verdicts`, `check_incidents`, `check_lisibilite`. `check_moments.mjs` est supprimé. `check_pouvoirs` perd ses sections sur les adjoints ; la borne du personnage complet sous 16 V est à remesurer sans le bras droit (phase 5).

Aucune PR avant que les phases 3 et 4 soient faites et vertes.
