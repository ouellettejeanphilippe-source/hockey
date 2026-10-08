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

## 4. L'ordre proposé

1. **A (la semaine)** : c'est le plus gros gain de rythme, sans toucher l'équilibre.
2. **C (un choix, un but)** : le choix doit peser avant qu'on en coupe d'autres.
3. **B (trois sortes)**, une famille à la fois, mesurée en paires.
4. **D et E**.
