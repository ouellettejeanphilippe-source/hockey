# V12 · Un sous-onglet par usage

19 octobre 2026. JP : *les écrans de roguelike, je pense que c'est mieux d'avoir plusieurs écrans avec un usage, et la boîte de réception renvoie à ces pages, que tout rentrer dans la boîte ; je préfère quinze pages claires que cinq passages clairs.*

Puis, le même jour : *je veux des onglets ou sous-onglets, un usage par sous-onglet.* Les pages ouvertes par-dessus le Bureau deviennent des sous-onglets de leur section, dans la rangée sous l'en-tête du club (`#sousNav`).

La V8 le disait déjà (« chaque élément d'À faire ouvre l'endroit exact où il se règle, avec son contexte, puis revient », docs/refonte-v8.md) ; la V9 avait fait l'inverse, tout dans la boîte, une feuille par-dessus le Bureau. La V12 revient à la V8, et va plus loin : chaque usage a sa page.

## Le principe

1. **La boîte nomme, le sous-onglet règle.** Une ligne par chose à régler — qui parle, de quoi, son état — rangée sous la maison où elle se règle. Toucher la ligne ouvre le sous-onglet de sa maison (Bureau › Proprio, Effectif › Infirmerie, Marché › Butin…) ; il montre chacun de ses choix en entier (la voix, le fait, ses options). Le sous-onglet compte ce qui y attend.
2. **Un sous-onglet, un usage.** Le proprio, la route, la presse, le vestiaire, l'infirmerie, le butin. Un sous-onglet existe aussi quand rien n'y attend : il le dit (« Rien à régler ici ») et, à la tranche 2, montre ce qui le concerne. Le gros match et la signature gardent leur écran : la boîte en montre la porte sur place.
3. **Le lot reste.** Toucher une option la coche ; « Trancher » envoie tout le coché, du sous-onglet ou de la boîte : la saison ne se rejoue qu'une fois. Un sous-onglet réglé en entier rend la boîte. Toucher Bureau rouvre toujours la boîte.

## Les sous-onglets

| Section › sous-onglet | Ce qui s'y règle | Ce qu'il montre toujours (tranche 2) |
|---|---|---|
| Bureau › Boîte | rien : elle renvoie (et montre la porte du gros match, de la signature) | une ligne par chose à régler, rangée par maison ; Hier soir |
| Bureau › 🏢 Proprio | l'objectif offert, son verdict, les rivaux | le mandat, l'objectif en cours, tes rivaux |
| Bureau › 🗺 Route | la route de la semaine | d'où tu viens, les deux semaines qui viennent |
| Bureau › 🎤 Presse | le point de presse, les courriels | la une, les primes des fils |
| Bureau › 🚪 Vestiaire | les fils, les dossiers, les dilemmes, les séquences | les fils de la saison, les arcs en cours |
| Effectif › 🚑 Infirmerie | le blessé, le physio, le retour, la case vide | les blessés et leurs matchs à faire |
| Marché › 🃏 Butin | la carte du palier, la carte de trop, le paquet | tes places, ton deck |
| (sur place) ⚔ Le gros match | la main du combat — son écran | — |
| (sur place) 🛒 La signature | le pack à signer — sa liste | — |

## Les tranches

- [x] **V12-1 · La boîte renvoie aux sous-onglets.** Chaque choix d'À faire a sa maison (`MAISONS`, `maisonDe`, js/saison.js) ; chaque maison est un volet de l'écran de saison (`vueMaison`) et un sous-onglet de sa section (`MAISONS_DE`, `PAGES_DE`, js/game.js), qui compte ce qui y attend (`aRegler`, `signalerComptes`, js/coquille.js). La boîte range ses lignes par maison ; toucher une ligne ouvre son sous-onglet, où ses choix se cochent. L'enveloppe par-dessus le Bureau (E4, docs/ecrans-rogue.md) et la page par-dessus (la première version de la tranche) sont parties. Juges : `essai_rogue` (20m : « À régler » ouvre un sous-onglet allumé dans sa rangée, l'écran d'un choix à une seule porte, ou la porte sur place ; trois sous-onglets au moins), `smoke`, `essai_packs`.
- [ ] **V12-2 · Chaque sous-onglet a son contenu permanent.** La boîte garde Hier soir ; le mandat et l'objectif vont au proprio, la route à la route, la une à la presse, les fils au vestiaire, les blessés à l'infirmerie, tes places au butin.
- [ ] **V12-3 · Chaque sous-onglet tient en un écran.** Un sous-onglet à plusieurs choix les plie, sauf le premier qui attend ; les juges mesurent la hauteur de chacun à 390 × 844.
