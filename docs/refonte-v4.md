# La V4 — clair, complexe, facile à prendre en main

JP, le 8 oct. :

> *T'as pas vraiment refait le moteur, les cartes, comment elles sont amenées comme mécaniques, le UI. Y'a encore trop de mots, y'a encore des events dans la boîte de réception qu'on voit pas, faut encore jouer et se rappeler que y'a des cartes randoms dans le sac. Je veux que tu prennes le jeu, qui est déjà pas pire, et que tu le rendes bon, clair, complexe, mais facile à prendre en main ; tu peux suggérer des plus gros changements.*

## 1. Ce qu'une vraie run montre (390 px, une run de 40 journées, 8 oct.)

- **La boîte perdait des messages.** Le courriel du jour (un aux deux jours) disparaissait le lendemain, lu ou pas ; une avance de plusieurs jours n'en écrivait aucun ; le point de presse durait un match ; le fil d'hier, un jour ; la situation du vestiaire et la carte qui change, une avance. « Plus tard » sur un dilemme le rendait non bloquant, **et cachait l'avant-match et la main du gros match derrière lui** : passé le soir du match, ils disparaissaient sans bruit. Au téléphone, l'onglet Boîte n'avait aucune pastille.
- **La poche était un sac sans fond.** Aucune limite ; rien ne te proposait jamais d'y jouer une carte ; le seul rappel était un chiffre sur le Marché. Les packs gratuits des matchs 9, 18 et 26 y tombaient en silence. En séries, elle était en lecture seule : ce qui restait expirait.
- **Trop de mots.** Le bureau d'un soir de match : environ 190 mots. La boutique ouvrait sur trois paragraphes, l'avant-match sur une règle qu'on connaît déjà.
- **Un choix ne pèse pas.** Une option de dilemme se lit « ≈ 1 but de plus marqué tous les 20 matchs ». Cliquer au hasard reste la stratégie rationnelle (docs/refonte-v3.md, §1, le mesurait déjà).
- **186 journées pour 82 matchs**, et deux touchers par soir de match (« Aujourd'hui », puis « Journée suivante »).

## 2. Cette tranche (V4.1) — fait

**La boîte ne contient que ce qui se règle, et tout ce qui y entre bloque la journée suivante.**
- Un choix forcé bloque toujours : « Plus tard » ferme la fenêtre, jamais le blocage. Un dilemme remis ne cache plus le gros match.
- La carte qui change, le vestiaire, les mouvements de ton alignement et le retour d'un blessé bloquent jusqu'à « Compris » (ou ta réponse). « Jusqu'à la prochaine décision » s'arrête aussi sur eux.
- La vie du DG : **un message tous les huit matchs** (`VIE_CHAQUE`) au lieu d'un courriel aux deux jours et d'un point de presse par match (environ 175 par saison → 10). Le point de presse quand le soir le demande (raclée, blanchissage, trois défaites), sinon le courriel d'une voix. Il attend ta réponse ; sa réponse est une décision, il ne disparaît plus.
- Le fil d'hier, sa voix, sa prime (Rogue) et la lancée vivent dans **la une**, au bureau, plus dans un courriel d'un jour. Le pari tranché se dit au dé et dans « En cours ». Le rapport du dépisteur est à la Saison, plié.
- Plus d'« Archiver », plus de « non lus » : rien ne se survole. La pastille de la Boîte dit qu'il y a quelque chose à régler.

**La poche a quatre places, et elle est au bureau** (`POCHE_MAX`, js/inventaire.js).
- Sous le match du soir, quatre cases : chaque carte se touche, se montre en grand, et se joue ou se vend de là (`ouvrirCarteDeLaPoche`, js/rogue-jeu.js).
- Une carte de trop **bloque** : « Ta poche déborde : 6 cartes, 4 places » — on joue ou on vend tout de suite (`ouvrirPochePleine`), comme les consommables de Balatro. Acheter un pack de cartes devient un vrai choix.
- Le pack gratuit des matchs 9, 18 et 26 s'annonce dans la boîte, avec ses cartes, et arrête l'avance.

**Moins de mots** : la boutique (« Joueurs : tu en signes un. Cartes : dans ta poche. »), le choix du coach, l'intro du Rogue, l'ouverture d'un pack, la récompense, l'avant-match.

Preuves : `essai_rogue` (la poche au bureau, au plus quatre cartes, ce qui déborde se vend), `tout.mjs` vert.

## 3. Les plus gros changements proposés

À trancher par JP avant de coder : chacun change la forme du jeu, pas seulement son écran.

### A. La semaine, pas la journée
La saison se joue par **semaines** (trois ou quatre matchs) : un écran par semaine — ses matchs, ce qui est arrivé (la une, les blessures), la boîte, et le gros match comme sommet de la semaine. 26 touchers au lieu de 186. Le moteur ne bouge pas : la ligue se joue toujours au jour le jour en dessous (`check_graine` tient), et la boîte arrête la semaine dès qu'un message bloque. « Regarder » reste offert pour chaque match.

### B. Trois sortes de cartes au lieu de sept
Aujourd'hui : patrons, événements, modifs, consommables, contrats, cartes de match, cartes de saison — sept façons de jouer, 535 cartes.
- **Le personnel** (permanent, des postes) : il joue tout seul, toujours.
- **Les tactiques** (le deck de match) : elles se jouent de la main, au gros match et en séries. Les événements de six matchs deviennent des tactiques d'une semaine.
- **Les coups** (une fois) : la poche — modifs, consommables, contrats. Se jouent sur-le-champ ou se vendent.
La banque descend vers 120 cartes ; chaque carte gardée se voit dans la feuille (`check_cartes`).

### C. Un choix, au moins un but
Une réponse de dilemme ou de courriel vaut aujourd'hui un vingtième de but par match. Proposition : l'ampleur des réponses comme celle des événements (`AMPLEUR_EVENEMENT`, ×2), bornée par la rareté d'une commune ; la face d'une option ne montre plus qu'un chiffre, sur sa durée (« ≈ +1 but sur 5 matchs »). Preuve : `check_vie`, `check_choix` (chaque option ≥ la borne visible d'une commune).

### D. Le bureau en trois lignes
Le soir : l'adversaire, **un** fait qui décide (« leur gardien arrête ,920 ; le tien ,884 »), **une** action conseillée (« Ton 4e trio coule : Aligner au mieux »). Le tableau des forces, les totaux et le dos-à-dos passent sous « Le dépistage ». Cible : moins de 60 mots par soir.

### E. La poche en séries
La poche devient jouable en séries (aujourd'hui en lecture seule) ; ce qui reste à la fin de la saison se vend tout seul au prix de vente.

## 3 bis. Fait (V4.2, 8 oct. — JP : *teste ça, on va voir*)

- **A, la semaine.** « Semaine suivante » joue jusqu'à la fin de la semaine du calendrier (`SEMAINE`, sept jours, environ trois matchs) et s'arrête avant sur tout ce qui demande le joueur ; le sommaire dit la semaine (« Semaine 1 · 2-1-0 »). « Un jour » reste offert. Mesuré dans une run à 390 px : 30 passages au bureau mènent au match 18, contre le match 10 au jour le jour. « Jusqu'à la prochaine décision » est parti : la semaine le remplace.
- **C, un choix pèse.** L'écart de chaque canal des options (dilemmes, séquences, avant-match, réponses à la presse et aux courriels, leurs paris et leurs suites) est multiplié par `AMPLEUR_CHOIX` (2,5), borné entre × 0,5 et × 2, une fois à la source (js/sim.js). « Donner la glace au bas de l'alignement » passe de « 1 but tous les 20 matchs » à « +0,15 but par match » sur huit matchs. `VERSION_MOTEUR` S99. `check_robot` : 0 Coupe sur 40, 40 % en séries (inchangé) ; `check_gros` vert.
- **D, le bureau court.** L'affiche d'un soir garde le match, une phrase d'avantage, le dos-à-dos en quatre mots et la poche ; le tableau des forces, « ce qui devrait décider », les totaux du soir et les effets en cours vont au dépistage. Environ 200 mots → 60.
- Reste : **B** (trois sortes de cartes) et **E** (la poche en séries, qui demande au moteur des séries de lire les cartes de la poche).

## 3 ter. Fait (V4.3, 8 oct.) — la main de la semaine

JP : *ça pioche x cartes, pis tu choisis ce que tu joues pour la semaine, ce qui force à les jouer ou pas les jouer consciemment, tout en gardant de bâtir un deck de bonnes cartes pour de bonnes pioches* ; *ce système justifie encore plus les coachs*.

- La poche n'a plus de places : c'est ta pile. Chaque semaine, `MAIN_SEMAINE` (4) de ses cartes sortent en main, au bureau ; tu en joues `JOUEES_SEMAINE` (2) au plus ; les autres retournent dans la poche (`mainDeLaSemaine`, js/inventaire.js, pure : la graine, la semaine, la carte). Une carte reçue en cours de semaine complète une main qui n'est pas pleine.
- La main bloque la semaine jusqu'à ce qu'on l'ait réglée : jouer une ou deux cartes, puis « C'est réglé », ou « Ne rien jouer cette semaine ». Une carte jouée reste dans la main, éteinte, jusqu'à la semaine suivante.
- Une carte ne se joue que de la main : le bureau, « Tes cartes » au Marché et « + Poser une amélioration » au verso le respectent. Vendre reste toujours permis : c'est ainsi qu'on amincit la poche.
- Les coachs pigent leurs cartes : le tirage d'une carte de la couleur d'un coach auquel l'équipe croit est élevé à la puissance 1 + sa confiance (I, II, III), donc elle sort plus souvent ; sa case dit l'icône du coach et la confiance. Au jeu, elle grandit déjà avec ses cartes jouées (`grandi`, js/banque.js).
- « Ta poche déborde » et ses quatre places sont partis : la main les remplace.

## 3 quater. Fait (V4.4, 8 oct.) — le tour, c'est la semaine

JP : *ya un bug avec le système par semaine, les gros matchs ont pas le bon score, c'est pas clair les piges, ya encore des courriels qu'on voit pas. L'idée est bonne, mais le « tour » du joueur est pas encore efficace, clair, ludique* ; puis *on dirait que le système fucke toujours car il tente de simuler à l'avance, pourquoi ?*

Mesuré d'abord, dans de vraies runs à 390 px (un script qui joue semaine par semaine et note chaque écran) :
- **Le gros match changeait de pointage.** 1–1 au deuxième entracte, 0–2 au final ; 0–2 à l'entracte, « 1–4 après deux périodes » au bilan. L'entracte joue le soir pour le montrer, le choix porte donc sur une journée déjà jouée et la ligue se reconstruit du jour 0 (`continuerSaison`). Ce rejeu ne redonnait pas le passé : `trioAuMieux` réalignait les clubs de l'IA depuis leur alignement déjà placé et avec les jambes de la saison jouée (la remise à zéro venait après), et 34 clubs sur 220 en sortaient autrement. Dès la journée 0, des matchs entre clubs de l'IA finissaient autrement. Correctif : l'IA s'aligne après la remise à zéro, depuis ses joueurs triés par clé (`creerLigue`, js/sim.js). Seule la 3e période du gros match bouge maintenant. Preuve : `check_graine` (5 bis), qui échoue sans le correctif. `VERSION_MOTEUR` S101.
- **Une semaine, quatre passages au bureau.** La carte qui change, le vestiaire, le courriel, le pack gratuit et la main complétée en route arrêtaient chacun « Semaine suivante », et chaque arrêt redemandait « Aujourd'hui › ». Maintenant, ce qui se LIT attend la fin de la semaine, dans la boîte. Ce qui se DÉCIDE avant le prochain match l'arrête encore : un blessé à remplacer, un choix forcé, l'avant-match, la main et l'entracte d'un gros match, le retour d'un blessé (`arretDeSemaine`). Le matin d'hier (« Aujourd'hui › ») a disparu : le bureau s'ouvre sur le prochain match, et l'étape Résultat rouvre hier.
- **La main bloque au lundi.** Elle bloque au début de la semaine seulement. Une carte reçue en route se joue de la main sans arrêter la semaine.
- **Le sommaire dit toute la semaine** (`boite.semaine`) : ses matchs d'avant un arrêt compris, et ses nouvelles. Ce sont les fils de chaque soir, avec leur voix et leur prime en jetons. Avant, la une ne disait que le fil d'hier. En route, aucun sommaire, sauf le soir d'un gros match.
- **Des messages qu'on ne voyait pas.** Une avance ne gardait que la dernière situation et le dernier accident ; ils vivent maintenant dans `boite.infos` jusqu'à « Compris ». La blessure et la case vide croisées en route restent aussi. Le pack gratuit restait trois matchs : une semaine en compte quatre. Le passage télé (3,5 s) couvrait la boîte ; il ne s'affiche plus quand un message attend, ni sur un sommaire.
- **Les piges se lisent.** Chaque case de la main dit ce que sa carte donne (en vert), ce qu'elle coûte (en rouge) et sa durée. La main dit dans quoi elle pige : « Pigées dans ta poche (9 cartes). Joue-en 2 ; les autres y retournent. »

Preuves : `check_graine`, `check_au_mieux`, `tout.mjs`, `smoke`, `essai_rogue`.

## 4. L'ordre proposé

1. **A (la semaine)** : c'est le plus gros gain de rythme, sans toucher l'équilibre.
2. **C (un choix, un but)** : le choix doit peser avant qu'on en coupe d'autres.
3. **B (trois sortes)**, une famille à la fois, mesurée en paires.
4. **D et E**.
