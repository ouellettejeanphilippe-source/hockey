# V12 · Une page par usage

19 octobre 2026. JP : *les écrans de roguelike, je pense que c'est mieux d'avoir plusieurs écrans avec un usage, et la boîte de réception renvoie à ces pages, que tout rentrer dans la boîte ; je préfère quinze pages claires que cinq passages clairs.*

La V8 le disait déjà (« chaque élément d'À faire ouvre l'endroit exact où il se règle, avec son contexte, puis revient », docs/refonte-v8.md) ; la V9 avait fait l'inverse, tout dans la boîte, une feuille par-dessus le Bureau. La V12 revient à la V8, et va plus loin : chaque usage a sa page.

## Le principe

1. **La boîte nomme, la page règle.** Une ligne par chose à régler — qui parle, de quoi, son état — rangée sous la page où elle se règle. Toucher la ligne ouvre la page ; la page montre chacun de ses choix en entier (la voix, le fait, ses options) et « ‹ La boîte » pour revenir.
2. **Une page, un usage.** Le proprio, la route, la presse, le vestiaire, l'infirmerie, tes cartes, le marché, le gros match. Une page existe aussi quand rien n'y attend : elle dit ce qui la concerne (tranche 2).
3. **Le lot reste.** Toucher une option la coche ; « Trancher » envoie tout le coché, de la page ou de la boîte : la saison ne se rejoue qu'une fois.

## Les pages

| Section | Page | Ce qui s'y règle | Ce qu'elle montre toujours (tranche 2) |
|---|---|---|---|
| Bureau | 📥 La boîte | rien : elle renvoie | une ligne par chose à régler, rangée par page |
| Bureau | 🌙 Hier soir | — | le résultat, la une, les nouvelles |
| Bureau | 🏢 Le bureau du proprio | l'objectif offert, son verdict, les rivaux | le mandat, l'objectif en cours, tes rivaux |
| Bureau | 🗺 La route | la route de la semaine | d'où tu viens, les deux semaines qui viennent |
| Bureau | 🎤 La presse | le point de presse, les courriels | la une, les primes des fils |
| Bureau | 🚪 Le vestiaire | les fils, les dossiers, les dilemmes, les séquences | les fils de la saison, les arcs en cours |
| Ce soir | ⚔ Le gros match | la main du combat | le plan adverse, la mise |
| Effectif | 🚑 L'infirmerie | le blessé, le physio, le retour, la case vide | les blessés et leurs matchs à faire |
| Marché | 🃏 Tes cartes | la carte du palier, la carte de trop, la main | tes places, ton deck |
| Marché | 🛒 Le marché | le pack à signer | la boutique |

## Les tranches

- [x] **V12-1 · La boîte renvoie aux pages.** Chaque choix d'À faire a sa maison (`MAISONS`, `maisonDe`, js/saison.js) ; la boîte range ses lignes par page, et toucher une ligne ouvre la page (`ouvrirPage`), où ses choix se cochent. L'enveloppe ouverte par-dessus le Bureau (E4, docs/ecrans-rogue.md) est partie. Juges : `essai_rogue` (20m : « À régler » ouvre une page ou l'écran d'un choix à une seule porte, et la boîte renvoie à trois pages au moins), `smoke`, `essai_packs`.
- [ ] **V12-2 · Chaque page a son contenu permanent.** Le Bureau garde Hier soir et la boîte ; le mandat et l'objectif vont au proprio, la route à la route, la une à la presse, les blessés à l'infirmerie. Une rangée de pages au Bureau les ouvre toutes, qu'elles aient un choix ou non.
- [ ] **V12-3 · Chaque page tient en un écran.** Une page à plusieurs choix les plie, sauf le premier qui attend ; les juges mesurent la hauteur de chaque page à 390 × 844.
