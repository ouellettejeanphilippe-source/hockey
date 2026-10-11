# La V7 · le cheval (ce qui va où, de zéro)

11 octobre 2026. JP :
- *Aucun des quinze jeux qui nous ont inspirés, pourtant complexes, n'est aussi chiant à naviguer. Même EHM, qui a cent fois plus d'infos, est plus clair.*
- *Faut une vraie logique dans les menus, l'info claire, au bon endroit. Pas juste améliorer les pages existantes : revoir ce qui va où, de zéro.*
- *Mêmes Lego. On avait un dragon, on veut un cheval.*
- *Je veux gérer mon équipe, pas des maths absolues. Des lancers, la précision, le % d'arrêts : des vraies stats.*

## Le principe : un onglet = une question de gérant

Les jeux qui marchent (EHM, FM, HUT) rangent par **question** : « qu'est-ce qui se passe aujourd'hui ? », « qui j'ai ? », « comment on joue ? ». Le Cap range aujourd'hui par **historique** : chaque demande a ajouté un sous-onglet là où il y avait de la place. Résultat : la même chose vit à trois endroits (le coach : Saison, Effectif, Mes cartes ; les jambes : Club et Effectif ; les lignes : Effectif et « Préparer le match » ; le calendrier : Saison et Ligue), et la réponse à une question est éparpillée.

Trois règles pour le cheval :
1. **Chaque lego a UNE maison.** Ailleurs, au plus un lien vers elle.
2. **L'écran répond, il ne raconte pas.** Une stat, un nom, un bouton. L'explication est dans la page des règles.
3. **Des vraies stats, toujours.** Tirs par match, % au tir, tirs contre, % d'arrêts, avantage et désavantage numérique, punitions ; pour un joueur : PJ, B, A, PTS, +/−, tirs, % au tir, temps de glace ; pour un gardien : % d'arrêts, moyenne. Jamais une note, jamais des victoires, jamais un but net.

## Les cinq onglets

| Onglet | La question | Ce qui y vit (les legos d'aujourd'hui) |
|---|---|---|
| **Bureau** | Qu'est-ce qui se passe aujourd'hui ? | Le prochain match : les deux clubs côte à côte en vraies stats (tirs, % au tir, tirs contre, % d'arrêts, AN %, DN %), leur forme, leur plan ; le dépistage dedans, plus derrière un bouton. Ce qui attend ta décision (la boîte, seulement ce qui se règle ; le nœud du lundi). Hier en une ligne. Le mandat du proprio en une ligne en tête. Un bouton : Jour suivant / Regarder. |
| **Joueurs** | Qui j'ai, et dans quel état ? | L'effectif en tableau triable à la EHM : poste, niveau, badge, jambes, stats de la saison, salaire, infirmerie. Filtres Avants / Défenseurs / Gardiens. Toucher = la fiche. Les jambes du Club et l'infirmerie y entrent. Au repêchage (le 82-0), cet onglet est le vestiaire. |
| **Lignes** | Comment on joue ce soir ? | Les trios, les paires, les gardiens ; le système de chaque unité et ses stats sur la glace (tirs pour–contre, % au tir, % d'arrêts) ; le plan de match (la glace, l'appariement) ; la consigne ; Aligner au mieux. En tête, la feuille attendue du soir. « Préparer le match » disparaît : c'est cet écran. |
| **Cartes** | Avec quoi je joue ? (le cœur du Rogue) | La main de la semaine (jouer, vendre) ; En jeu (ce qui est actif, chacun avec ce qu'il change en stats) ; le coach et sa confiance ; le deck de match ; le personnel ; les packs (la boutique) ; l'album (le cartable, la banque). Au 82-0 : l'album seul. |
| **Ligue** | Où j'en suis ? | Le classement, le calendrier (ta route, les gros matchs), les meneurs, les équipes, les séries ; le palmarès de tes saisons. |

Le **menu** (☰) garde le méta, qui vit entre les runs : les déblocages (médailles), les options, les règles, les parties.

## Où va chaque lego

| Lego d'aujourd'hui | Sa maison V7 |
|---|---|
| Club › Match (l'affiche, Dépistage, Préparer, la main) | Bureau (affiche + dépistage) · Lignes (Préparer) · Cartes (la main) |
| Club › Boîte | Bureau (ce qui se règle) |
| Club › Saison : la run, le mandat, le barème | Bureau (une ligne) · le barème : Cartes › Packs, là où les jetons se dépensent |
| Club › Saison : le coach | Cartes › Coach |
| Club › Saison : prévision, route, calendrier | Ligue › Calendrier (la route), Ligue › Classement (la prévision) |
| Club › Jambes | Joueurs |
| Effectif › Équipe : la feuille du soir, le plan de match | Lignes |
| Effectif › Équipe : en jeu, le coach | Cartes › En jeu, Cartes › Coach |
| Effectif › Attaque / Défense / Filet | Lignes |
| Marché › Boutique | Cartes › Packs |
| Marché › Mes cartes (poche, permanent, deck, banque) | Cartes |
| Marché › Déblocages | Menu |
| Collection › Cartable | Cartes › Album |
| Collection › Saisons | Ligue › Palmarès |
| « Préparer le match » (consigne, roulement, lignes, filet) | Lignes |

## Fait le 11 octobre

- [x] Le squelette : les cinq onglets, leurs sous-onglets, les scripts qui les suivent.
- [x] Bureau : le mandat en tête, le duel du soir en vraies stats, Dépistage et Lignes en deux boutons.
- [x] Joueurs : le tableau triable (js/joueurs.js) ; le volet Jambes du Club est parti.
- [x] Lignes : la consigne et le filet au plan de match ; « Préparer le match » a disparu de la saison.
- [x] Cartes : Ta main (la main, en jeu, le coach), la Boutique (son barème y vit), l'Album ; les déblocages au Menu.
- [x] La boîte fondue dans le Bureau : plus de sous-onglet « À régler » ; elle se range sous l'affiche, pliée tant que rien ne bloque, et « À régler » y déplie le message au-dessus de la barre. La pastille rouge passe sur la porte du Bureau, visible de partout.
- [x] Les séries au même cheval : « Préparer le match » et « Le banc » des séries ne font plus qu'un, l'onglet Lignes (« 🏒 Lignes · match N » au Bureau). Le banc d'une série porte son prochain match (l'adversaire, chez qui, la consigne, le filet, les jambes des gardiens), le plan de match s'y règle comme en saison, et « Retour aux séries » envoie tout en une décision. Le plein écran `ouvrirLignes` (js/gerant.js) et ses 32 classes sont partis.
- [ ] Reste : le gros match lit le plan probable du dépistage dans les Lignes.

## L'ordre de travail

1. **Le squelette** : les cinq onglets, leurs sous-onglets, le retour (js/pile.js), la manette ; chaque lego déménagé tel quel. Aucune perte : les scripts (smoke, essai_rogue) suivent les nouveaux chemins.
2. **Bureau** : l'affiche en vraies stats côte à côte, le dépistage à plat, la boîte réduite à ce qui se règle.
3. **Joueurs** : le tableau triable (on part du tableau de js/equipes.js, qui lit déjà les vraies statistiques).
4. **Lignes** : « Préparer le match » fondu dedans ; une seule place pour la consigne, la glace, l'appariement, le système.
5. **Cartes** : la main, En jeu, le coach, le deck, les packs, l'album sous un même toit.
6. **Le ménage** : ce qui n'a plus de maison part (`check_mort`), CLAUDE.md et les règles fermes à jour (les cinq sections changent de nom).

Chaque étape se joue en Rogue à 390 px et passe `tout.mjs`, le smoke et `essai_rogue` avant la suivante.
