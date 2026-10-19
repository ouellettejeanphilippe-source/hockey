# V11 · Le joueur porte le gros

19 octobre 2026. JP :
- *au final, les actions, ça devrait être blessures, bonus, malus, stratégies (bonus et malus liés au style de l'équipe), événements randoms auxquels joueurs précis, interview, demandes du proprio, cartes de matchs (doivent plus changer comment l'équipe joue que donner un bonus)* ;
- *c'est vraiment plus facile de balancer le jeu et créer des histoires, si les bonus et malus plus importants touchent des joueurs et non l'équipe*.

## Le principe

1. **Ce qui touche l'équipe est petit et change la forme du match.** Une carte de match, un coach, un patron, une place d'équipe : un gain sur un canal, un prix sur un autre (plus de tirs, moins bien placés), ou des minutes déplacées d'un trio à l'autre. Jamais un bonus net qui monte toute l'équipe.
2. **Le gros bonus et le gros malus vont sur un joueur nommé.** Ses tirs, sa précision, ses jambes, sa discipline, sa lancée, son doute : `MUTATIONS` (js/sim.js) les porte déjà, par joueur. Un effet sur un joueur se borne mieux (il joue 18 minutes sur 60 ; il peut se blesser, s'asseoir, être échangé) et il se raconte (« Gourde est en feu », « Dvorak boude »).
3. **L'histoire naît d'un fait du joueur.** Un événement ou un malus qui arrive seul nomme qui, et pourquoi, en vrais chiffres de ses feuilles.

## Les huit familles, et où chacune vit

| Famille | Équipe ou joueur | Où | Aujourd'hui | À faire |
|---|---|---|---|---|
| Blessures | joueur | À faire | blessure, retour, physio, jouer blessé, case vide | complet |
| Bonus | joueur surtout | places, équipement, butin, paliers | 30 places d'équipe, 40 cartes sur un joueur | les places d'équipe deviennent des échanges ; le gros passe sur un joueur |
| Malus | joueur | À faire, Hier soir | 3 malédictions de cahier, 6 contrats lourds, l'objectif raté | des malus qui arrivent seuls, sur un joueur, d'un fait de ses feuilles |
| Stratégies | équipe, petit | le coach, le plan | 9 coachs en bonus pur | chaque coach : son gain et son prix ; son gros va aux joueurs de sa couleur |
| Événements sur un joueur | joueur | À faire | 4 fils, 1 dossier sur 19 nomme un joueur | des dossiers qui nomment un de tes joueurs |
| Interviews | joueur ou équipe | À faire | le point de presse, les courriels aux 8 matchs | la question vise un joueur quand le fait vient de lui |
| Demandes du proprio | équipe | À faire | le mandat, 2 objectifs, les paliers 9-18-26 | un objectif peut viser un joueur (« fais jouer la recrue ») |
| Cartes de match | équipe, petit | le duel | 30 cartes sur 44 en bonus pur | chacune un échange, ou des minutes, ou un joueur nommé |

## Les tranches

Une PR chacune ; son juge est nommé.

- [x] **T1 · Le cahier change la forme.** Les 30 cartes de bonus pur deviennent des échanges (un gain, un prix) ou visent un joueur nommé (« La vedette se libère » le fait déjà). Juge : `check_cartes` (une carte d'équipe porte un canal pour et un contre, ou déplace des minutes ; son net reste sous sa borne), `check_duel` (62 à 65 %).
- [x] **T2 · Les coachs : un style, un prix.** Chaque coach paie sa famille et coûte sur une autre (le Frelon tire plus, ses jambes s'usent ; la Tortue ferme la porte, tire moins ; le Rhino frappe, se fait punir). Son gros effet va aux joueurs de sa couleur. Juges : `check_coachs`, `check_voies`.
- [x] **T3a · Les places et le personnel d'équipe deviennent des échanges.** Fait : chaque patron et chaque place d'équipe qui donnait un gain sec porte maintenant son prix sur un autre canal (35 cartes) ; celles qui déplacent les minutes restent telles quelles. La route « Le repos » se lit sur le gain (une carte dont le gain ne touche qu'aux jambes et aux blessures). Juges : `check_banque` (le personnel, 60/60), `check_si`, `check_noeuds`.
- [x] **T3b · Le gros d'une place sur un joueur.** Fait : une place `surUn` (js/places.js) se joue sur un de tes joueurs, que tu nommes ; ses canaux à lui (`joueur` : ses tirs, sa précision, ses passes, sa défense) jouent le temps de ses matchs et ses soirs seulement (`surJoueur` → `effetsCibles`, lus par `siDe`), et l'équipe garde un petit prix ou rien. Cinq places : 🏹 Cent tirs après la pratique, 📽 La vidéo de leur gardien, 🪵 Les bâtons neufs, 🧷 La réunion des défenseurs, 📸 La couverture du magazine. Une rare sur un joueur se voit à SA ligne de la feuille (±0,3 point au joueur nommé) : la production d'un joueur se prend à ses coéquipiers (`check_parts`), et son club n'en gagne que la moitié. Juges : `check_places`, `check_banque`.
- [ ] **T3 (suite) · Les places et le personnel d'équipe.** Les places d'équipe deviennent des échanges ; leur gros passe sur un joueur (« Cent tirs après la pratique » : un joueur, pas l'équipe). Juge : `check_cartes`, `check_banque`.
- [x] **T4 · Les malus et les événements sur un joueur.** Fait : trois dossiers nomment un de tes joueurs sur un fait de SES dix derniers matchs (js/saison.js `faitsDesJoueurs`) — 😒 Il boude (un Top 6 au 4e trio, sa zone et ses points), 🥊 La chicane au vestiaire (4 punitions et plus), 📞 L'agent appelle (un des trois gros contrats, un point ou moins) — et « Les jambes lourdes » offre un congé à celui qu'elle nomme. Le gros de chaque réponse va à lui (`lui`, posé par `poserSurJoueur` comme une place sur un joueur) ; l'équipe garde un peu de discipline ou de robustesse. La disette reste au fil qui la porte déjà (V9). Juges : `check_dossiers` (un effet sur un joueur seulement dans un dossier qui le nomme, sur ses canaux à lui), `check_clarte` § 5, `check_places`, `check_banque`.
- [x] **T5 · L'interview et le proprio visent un joueur.** Fait : une question de presse ou un courriel qui vise un joueur vise celui dont le fait vient, lu dans les feuilles des huit matchs qu'il raconte (`joueurDuFait`, js/vie-gm.js) — le gardien qui a reçu les tirs du soir, le meilleur pointeur, le plus puni — et le fait se dit sous la question, en vrais chiffres ; personne dans les feuilles, la cible d'avant. Le proprio a un objectif de plus, 💼 le gros contrat : le patineur habillé qui coûte le plus cher fait ses points au rythme de sa vraie saison (`joueurDeLObjectif`, `PART_DU_RYTHME`). Au passage, la prime d'un objectif réussi est versée de nouveau (le compte lisait `carte`, le verdict écrit `place` depuis la V10). Juges : `check_vie`, `check_moments` (le taux de réussite), `check_pronostic`.

La recalibration suit chaque tranche (`check_profondeur`, `check_rogue`) : retirer du bonus d'équipe rend la run plus dure, et le gros passé sur les joueurs la rend plus inégale. C'est voulu : le bon joueur au bon moment fait l'histoire.
