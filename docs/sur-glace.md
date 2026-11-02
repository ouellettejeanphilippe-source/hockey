# Sur glace — toutes les fonctions d'un jeu de hockey 2D

JP (1er nov. 2026) : *fais la liste de toutes les fonctions nécessaires, du game feel, au but objet physique, à la physique de changer de direction en patin, etc.* La liste complète, rangée par domaine, chaque fonction marquée **✅ faite**, **🟡 partielle** ou **⬜ à faire**, avec ce qui la porte dans le code (js/physique.js, js/glace-ia.js, js/sur-glace.js) et le check qui la prouve (`scripts/check_physique.mjs`). L'ordre de travail proposé est à la fin.

Ce qui tient tout : un pas de temps fixe de 1/120 s, des mètres et des kilogrammes, un hasard semé, et l'IA qui pousse le même bâton que la manette (CLAUDE.md, règle Sur glace). Chaque chiffre ci-dessous vient d'une constante de js/physique.js (`RONDELLE`, `PATIN`, `BATON`, `GARDIEN`, `CHUTE`, `HARPON`, `ECHEC`, `JAMBES`, `MATCH`) et se mesure.

## 1. La glace et ses objets

| Fonction | État | Où |
|---|---|---|
| La patinoire rapetissée (JP, 2 nov. : *resize la patinoire, pour qu'en 16:9 la zone offensive ou défensive remplisse, et adapte la zone neutre aussi*) : la largeur de la LNH (85 pieds), 44,6 m de long au lieu de 61 — une zone de 14,8 m de la bleue à la bande, la neutre de 15 m ; les filets, les cercles, l'enclave, les coins et la ligne des buts aux vraies mesures | ✅ | `L`, `W`, `LIGNE_BUT`, `BLEUE`, `POINT` |
| La bande, avec les coins en arc de 28 pieds, qui rend 55 % en travers et garde la vitesse le long | ✅ | `bander`, `RONDELLE.bande` — check « le rebond », « le coin » |
| Le frottement de la rondelle sur la glace (≈ 1 m/s perdu par seconde) | ✅ | `RONDELLE.frottement` — check « v² / 2µg » |
| **Le filet, un objet physique** : deux poteaux ronds qui rendent 70 %, les côtés et le fond en maille qui absorbent, ouvert devant ; la rondelle et les patineurs le contournent | ✅ | `contreFilet`, `patineurContreFilet`, `FILET` — check « le poteau se compte » |
| Le but : la rondelle entière passe la ligne, entre les poteaux, par devant, portée ou lancée ; un but dans son propre filet compte pour l'autre | ✅ | `but` — check « un tir au ras du poteau » |
| Le filet déplacé de ses amarres (un gardien ou un joueur qui le pousse ; le but refusé si le filet est sorti) | ⬜ | il faudrait le filet comme corps mobile avec des amarres élastiques |
| La barre horizontale (un tir qui frappe la barre, la rondelle qui passe dessus) | ✅ | `FILET.haut`, `but` — check « par-dessus la barre », « juste à la barre » |
| La rondelle par-dessus la baie vitrée (arrêt de jeu, mise en jeu) | ✅ | `RONDELLE.vitre`, `rondelle` (événement `vitre`, mise en jeu au point le plus près) |
| La rondelle qui longe la bande (elle roule le long, au lieu de repartir net) | 🟡 | le rebond est net ; un frottement le long de la bande manquerait |
| La rondelle dans les patins (elle rebondit sur le corps ; la pousser du pied) | 🟡 | le corps la dévie (`contreCercle` dans `rondelle`) ; le coup de patin volontaire manque |
| Le trapèze derrière le filet (le gardien ne joue la rondelle que dedans) | ⬜ | règle de 2005 ; vient avec le gardien qui joue la rondelle (§ 5) |
| Les bancs et les cachots, à leur place hors de la bande | 🟡 | dessinés (`patinoire`), les portes et les sauts par-dessus la bande ne sont pas joués |
| La glace qui s'use (la rondelle rebondit plus en fin de période) | ⬜ | un frottement qui monte avec `M.reste` serait une ligne |

## 2. Le patineur : la physique du patin

| Fonction | État | Où |
|---|---|---|
| La poussée et la vitesse de pointe (38 km/h en 2,5 s), par la cote du joueur | ✅ | `PATIN.accel`, `vMax`, `parametresDuPatineur` — check « la pointe » |
| La roue libre : le bâton lâché, on s'arrête vite ; en poussant, les lames ne perdent rien | ✅ | `PATIN.glisse` — check « la roue libre » |
| Le frein (le bâton à l'envers : l'arrêt des lames en travers) | ✅ | `patiner` — check « le frein » |
| **Changer de direction en patin** : le cap tourne vers le bâton, mais les lames ne tiennent que `adherence` m/s² de côté — le rayon de virage grandit avec la vitesse, le virage serré fait dériver (la vitesse en travers s'éteint à `grip`) | ✅ | `patiner` — check « le virage le plus serré », « pivote » |
| Le pivot sur place à l'arrêt | ✅ | `PATIN.pivot` |
| Le prix d'un virage : couper sec coûte de la vitesse (les carres mordent, l'énergie part dans la glace) | ✅ | `PATIN.virage` (∝ vitesse angulaire × vitesse) — check « couper sec coûte » |
| Les croisés : prendre de la vitesse DANS un virage (l'accélération du patineur qui croise, plus forte que la poussée droite) | ✅ | `PATIN.croise` : la poussée bonifiée quand le cap tourne à vitesse moyenne |
| **Patiner à reculons** (le défenseur face au porteur, le cap à l'opposé de la vitesse) | ✅ | `PATIN.recul`, l'entrée `recul` (LB, LT, Q) ; l'IA des défenseurs recule face au porteur — check « à reculons » |
| L'explosivité par joueur (le départ, les trois premières foulées) | 🟡 | la poussée suit la cote générale, à ±6 % (`PATIN.ecart` ; JP : *pas trop différents côté vitesse*) ; une vraie distinction départ / pointe (deux cotes) manque |
| Des vitesses proches : un 1 et un 20 ne sont jamais loin, un défenseur lourd patine aussi vite qu'un avant | ✅ | `PATIN.ecart`, `PATIN.agilite` (±5 % de virage au poids) — check « leur pointe reste proche », « un défenseur plus lourd » |
| L'agilité par joueur (un petit patineur tourne plus court) | ✅ | `p.agilite`, du poids de la LNH, bornée à ±5 % : × l'adhérence et le pivot |
| Les jambes : une présence coûte, le banc rend, un patineur fatigué pousse moins | ✅ | `JAMBES`, `formeDe` — check « des patineurs sont fatigués » |
| La masse du joueur (son poids à la LNH) | ✅ | `parametresDuPatineur`, `wgt` |
| L'équilibre : qui tombe sous un coup, par sa Robustesse | ✅ | `CHUTE.seuil`, `p.equilibre` |
| Tomber et se relever (le temps au sol, la glissade) | ✅ | `auSol`, `PATIN.sol` |
| Les patineurs qui se bousculent sans se frapper (deux coéquipiers, un frôlement) | ✅ | `collisions` (restitution 0,2, sans chute sous le seuil) |
| Le patineur contre la bande et contre le filet | ✅ | `bander`, `patineurContreFilet` |
| L'élan d'une mise en échec (le bouton : plus de poussée, un instant) | ✅ | `ECHEC`, `elan` |
| Un sprint (une réserve de souffle à dépenser) | ✅ | `PATIN.sprint`, `sprintJambes`, l'entrée `sprint` (B avec la rondelle) ; l'IA fonce quand la glace est libre — check « le turbo » |

## 3. La rondelle à la lame : passer, tirer, manier

| Fonction | État | Où |
|---|---|---|
| Porter la rondelle : elle suit la lame comme un ressort amorti, traîne à grande vitesse, se perd au virage trop serré | ✅ | `rondelle` (porteur), `BATON.ressort`, `maniement`, `PATIN.portee` — check « reste à la lame » |
| La prendre : à la lame, devant, si elle n'arrive pas trop vite ; sinon elle dévie | ✅ | `rondelle` (libre), `BATON.reception` |
| La passe menée à un coéquipier (celui que le bâton désigne, là où il sera, plus fort quand il est loin) | ✅ | `passer`, `receveurDePasse` : la direction d'abord (`PASSE_VISEE`), le pointé la reçoit même couvert — check « la passe part », « la passe va au coéquipier que le bâton pointe » |
| Le receveur prend le contrôle | ✅ | `rondelle` (prise), `etat.controle` |
| Le tir du poignet (un appui) et le lancer frappé (chargé) | ✅ | `lancer`, `BATON.tirMin`, `tirMax`, `charge` — check « le tir du poignet », « le lancer frappé » |
| Le tir sur réception (une-temps) | ✅ | `rondelle` (prise avec `e.tir`) |
| La visée comme dans les jeux de hockey et de soccer : le filet devant attire le tir, le bâton choisit où, à fond de côté on rate ; plus de charge, moins de précision | ✅ | `viseeAssistee`, `BATON.assist`, `large`, `ecart` — check « le bâton droit », « à fond de côté » |
| La vitesse et la précision du lancer par la cote Tir, la passe par Jeu | ✅ | `parametresDuPatineur` |
| **La hauteur de la rondelle** (soulevée, à ras de glace, qui retombe) | ✅ | `rondelle.z`, `vz`, la gravité, `RONDELLE.rebondSol` ; la montée d'un lancer (`BATON.hauteurMin`, `hauteurMax`, `ecartHauteur`) ; au sol seulement, elle se prend — check « retombe », « rebond » |
| La passe soulevée (saucer) par-dessus un bâton | ✅ | `BATON.soulevee`, `receveurDePasse` (la ligne barrée) — check « se soulève » |
| La passe par la bande (volontaire, l'IA la lit) | 🟡 | la physique la permet (`bander`) ; ni la visée ni l'IA ne la cherchent |
| La passe laissée (drop pass) | ⬜ | lâcher la rondelle derrière soi, une touche |
| Le revers (plus faible, moins précis) et la main du joueur (gaucher, droitier : la lame d'un côté) | ⬜ | la lame est toujours du même côté (`BATON.lame`) ; `np` du shard (LD, RD) dit la main |
| La feinte (le toe drag, le mouvement de côté qui déporte la rondelle) | ⬜ | un bouton qui décale la lame de 1 m un instant, et le harpon qui rate |
| Protéger la rondelle (le corps entre l'adversaire et la lame) | ⬜ | tourner le dos au poursuivant, la lame de l'autre côté |
| Le tir instantané (snap) et le tir en mouvement qui garde l'élan | 🟡 | l'élan du corps s'ajoute (`lancer`, `elan`) ; pas de tir distinct |
| Les déviations devant le filet (un bâton qui redirige un tir) | ✅ | la déviation volontaire vers le filet (`BATON.deviation`, le bâton tenu, la lame jusqu'à 1,2 m) ; l'IA le tient devant le filet, et quand son tir part ; **malgré soi** (2 nov.) : un tir qui frappe une lame à moins de 5 m du filet change de route (±20°) et garde 80 % de sa vitesse, au lieu de mourir comme une passe bloquée (`BATON.devant`, `devie`, `garde`) ; celle d'un adversaire reste au tireur. IA contre IA : 0,55 → 12 déviations par match — check « la déviation » |
| L'écran devant le gardien (il ne voit pas la rondelle) | ✅ | 2 nov. : un patineur, de l'une ou l'autre équipe, sur la ligne de la rondelle au gardien, fait voir la rondelle 120 ms plus tard au gardien, qui la retrouve ensuite à double vitesse (`GARDIEN.ecran`, `masque`) ; 21 % des tirs masqués, IA contre IA — check « l'écran » : le même tir, du même point, arrêté 79 % sans écran, 63 % avec |
| Le lancer au fond, le dégagement : hors de la zone d'attaque, le tir part où pointe le bâton | ✅ | 2 nov. : `viseeAssistee` ne ramène au filet que de la zone ; un lancer d'ailleurs n'est pas un tir au but (`fond` sur l'événement) — check « le tir part où pointe le bâton » |
| Le retour (le rebond du gardien, à qui le ramasse) | ✅ | `gardien` (rebond) |
| Bloquer un tir avec le corps (se jeter devant) | 🟡 | le corps et la lame au sol bloquent un lancer adverse, compté (`bloquer`, `M.blocs`, `stats.blocs`) ; se coucher volontairement manque |
| La rondelle qui saute sur un bâton (la bobble) et le mauvais rebond | 🟡 | la réception trop rapide dévie ; le hasard de glace manque |

## 4. Le jeu physique et les fautes

| Fonction | État | Où |
|---|---|---|
| La mise en échec : l'élan échangé entre deux masses, le moins lancé tombe | ✅ | `collisions` — check « un plot frappé tombe », « l'élan s'est conservé » |
| Le harpon (le bâton devant soi, par Défense contre Jeu) | ✅ | `harponner`, `HARPON` |
| L'obstruction (frapper qui n'a pas la rondelle), la charge par-derrière, faire trébucher | ✅ | `collisions`, `harponner`, `punir` — check « une charge par-derrière » |
| La punition à retardement (l'équipe lésée garde la rondelle) | ✅ | `punir`, `M.enAttente` — check « à retardement » |
| L'avantage numérique, le club à quatre (à trois), la libération sur un but | ✅ | `droitSurGlace`, `habiller`, `liberer`, `marquer` — check « le puni est au cachot », « un but le libère » |
| La charge contre la bande (plus dure, et punie si par-derrière) | ✅ | `CHUTE.bande` : contre la bande, le coup pèse 1,5 fois, la chute dure plus ; par-derrière, « charge contre la bande » |
| Soulever le bâton (stick lift, voler la rondelle sans contact) | ⬜ | une variante du harpon, de côté |
| L'accrochage, le cinglage, le double-échec | ⬜ | des fautes de bâton, chacune un geste et un dé |
| La bagarre (deux qui laissent tomber les gants, cinq minutes) | ⬜ | NHL 94 l'avait ; le moteur de la saison a déjà la bagarre (`tirerPhysique`, js/sim.js) : un duel au bouton, à la Robustesse |
| La rudesse après le sifflet | ⬜ | un coup pendant un arrêt de jeu |
| Les blessures (un coup dur qui sort un joueur du match) | ⬜ | le moteur de la saison sait les jouer ; ici, un hasard sur un coup fort |
| La punition majeure, l'inconduite, le tir de punition (sur une échappée fauchée), les mineures coïncidentes | 🟡 | le tir de punition sur une échappée fauchée (`accorderTirDePunition`, `enEchappee`, `placerRonde` : la ronde des tirs de barrage) — check « tir de punition » ; la majeure, l'inconduite et les coïncidentes manquent |
| Trop de joueurs, la main sur la rondelle, le bâton élevé, le hors-jeu par-dessus la vitre | 🟡 | le hors-jeu par-dessus la vitre est là (`vitre`) ; les trois autres manquent |
| L'obstruction sur le gardien | ⬜ | un patineur dans l'enclave qui touche le gardien |

## 5. Le gardien

| Fonction | État | Où |
|---|---|---|
| Se placer sur la ligne rondelle-filet, sortir selon la distance, coller au poteau derrière et à angle fermé | ✅ | `gardien` — check « à angle fermé » |
| Couvrir la rondelle libre et lente dans son demi-cercle, s'il y est le premier | ✅ | `rondelleACouvrir`, `GARDIEN.demiCercle`, `lente` — check « il va la couvrir » |
| Voir la rondelle en retard (150 ms, moins par sa cote Arrêts) et aller là où le tir croisera sa ligne | ✅ | `GARDIEN.reaction`, `parametresDuGardien` — check « l'enclave », « la bleue » |
| L'arrêt par sa largeur, le gel ou le retour ; le retour contrôlé de côté, vers le coin (sa cote Arrêts), la mitaine qui gèle les tirs hauts | ✅ | `gardien`, `GARDIEN.couvre`, `rebond`, `coin`, `mitaine`, `p.controle` — check « un rebond contrôlé » |
| Le papillon (visuel) sur un arrêt | ✅ | `gardien` (js/sur-glace.js) |
| La mitaine, le bloqueur, les jambières : l'arrêt selon où le tir arrive (haut, bas, de chaque côté) | ✅ | `GARDIEN.trous` : le coin du haut, entre les jambières, le corps — ce qui passe quand même, lu de la hauteur et du côté |
| Le gardien qui joue la rondelle (la sortir de derrière le filet, une passe) | ⬜ | une IA du gardien porteur, le trapèze |
| Le harpon du gardien (le porteur qui arrive sur lui) | ✅ | `harponDuGardien`, `GARDIEN.harpon` — check « le gardien harponne » |
| Le gardien retiré pour un sixième attaquant (en fin de match, à retardement) | ✅ | `retirerGardien`, `MATCH.retraitGardien` (l'IA sous 90 s, à un ou deux buts), le menu de pause pour toi — check « filet désert » |
| Le gardien battu par un écran, la déviation, le mauvais rebond | ✅ | le rebond, l'écran (`GARDIEN.ecran`), la déviation malgré soi (`BATON.devie`) ; IA contre IA, le % d'arrêts passe de 92 à 89,5 %, les buts restent à ≈ 3,8 par match |
| L'obstruction sur le gardien, le but refusé | ⬜ | |
| La fatigue du gardien, le remplacement par l'auxiliaire | ⬜ | l'auxiliaire est dans le shard (`autoRoster` unit 1) |
| Le plongeon désespéré (la mitaine qui se tend) | ⬜ | un geste d'animation et un dé |

## 6. Les règles et le déroulement

| Fonction | État | Où |
|---|---|---|
| **La mise en jeu, placée comme à la LNH** (JP, 2 nov. : *les défenseurs sont pas dans la zone à la mise au jeu*) : les deux centres face à face au point, personne d'autre dans le cercle, les ailiers sur les traits ; dans une zone, les défenseurs de l'attaque à la bleue (0,9 m en dedans), ceux de la défense au bas du cercle et devant le filet ; au centre et en neutre, 6,5 m derrière ; le hors-jeu tenu. Placés dès le début du match (ils attendaient empilés) | ✅ | `placerMiseEnJeu`, `MEJ` — check « personne d'autre dans le cercle », « les quatre défenseurs dedans », « personne hors-jeu » |
| **La mise en jeu, un duel** (JP : *l'absence de mécanique de mise au jeu*) : le bouton à la chute (+0,45 pile, rien à 200 ms), le premier appui seul ; le bâton tenu dit où elle part (derrière : le défenseur ; de côté : l'ailier), une passe que le coéquipier reçoit ; le Jeu du centre (× 0,25) et un dé (× 0,5) ; serrée (sous 0,06), la rondelle reste libre au point ; ce que ton bouton valait s'affiche (« pile ! », « 80 ms trop tôt »). Avant : le perdant reprenait la rondelle 98 fois sur 100, en 0,01 s | ✅ | `tomber`, `MEJ`, `tonTiming` (js/sur-glace.js) — check « le bouton à la chute pile », « elle va à ton défenseur », « à ton ailier », « libre au point », « un 18 bat un 4 » |
| Le hors-jeu à l'entrée de la zone | ✅ | `horsJeu` — check « le hors-jeu se siffle » |
| **La prise qui serait hors-jeu** (2 nov. ; mesuré : 4,3 à 5,9 hors-jeu par match de 6 min, l'IA contre l'IA) : le bras levé, la lame d'un attaquant dans la zone ne prend la rondelle que s'il la vise ; la rondelle hors de la zone et un coéquipier dedans, la lame ne la ramène pas dedans (la lame encore dans la zone, ou la rondelle trop vite pour s'arrêter avant la ligne) ; une rondelle qu'un adversaire envoie dans la zone et qu'un attaquant cueille au même pas n'est pas un hors-jeu | ✅ | `prendraitHorsJeu`, `VISE`, `horsJeu` (`avant`) — check « ne prend pas la rondelle qui passe à sa lame », « ne la ramène pas » ; IA contre IA, 48 matchs : 5,1 → 0,9 hors-jeu par match, les passes réussies 64 → 67 % |
| Le hors-jeu différé (le bras levé, la zone à vider) | ✅ | `M.horsJeuDiffere`, `horsJeu` : lancée dans la zone avec un attaquant dedans, le bras se lève ; levé si les attaquants ressortent, sifflé s'ils la touchent ; l'IA ressort et n'entre pas — check « le hors-jeu différé » |
| Le dégagement refusé (touché, permis en désavantage) | ✅ | `degagement` — check « le dégagement refusé » |
| Le dégagement hybride (la course aux points de mise en jeu) | ⬜ | |
| L'horloge, trois périodes, les côtés qui changent | ✅ | `pas`, `finDePeriode` |
| La prolongation à trois contre trois, les tirs de barrage (trois rondes, la mort subite) | ✅ | `finDePeriode`, `commencerFusillade`, `placerRonde`, `finDeRonde` — check « un match nul » |
| Les séries : la prolongation à cinq, sans fin | ✅ | `series` du match, l'affiche — check « en séries » |
| Les changements de ligne aux arrêts, par les jambes | ✅ | `habiller`, `JAMBES.changement` |
| Les changements à la volée (le banc qui ouvre quand la rondelle est loin) | ⬜ | la porte du banc, le patineur qui sort et celui qui entre |
| Choisir sa ligne soi-même (le bouton de trio) | ⬜ | NHL 94 l'avait ; une touche au arrêt de jeu |
| Le temps d'arrêt | ⬜ | |
| Les statistiques du match : tirs, mises en échec, mises en jeu, minutes de punition | ✅ | `M.tirs`, `echecs`, `mej`, `pim` |
| Les buts avec leur marqueur, le journal | ✅ | `marquer`, `M.journal` |
| **Les passes décisives** (les deux derniers coéquipiers à toucher) | ✅ | `M.touches` (les deux derniers coéquipiers dans les 15 s), `marquer` — check « passe décisive » |
| Les stats par joueur (buts, passes, tirs, mises en échec, temps de glace, +/−) et les trois étoiles | ✅ | `s.stats` (buts, aides, tirs, mises en échec, blocs, temps de glace), `g.arrets`, `etoilesDu` à la fin — check « trois étoiles » |
| Un match qui se sauvegarde et se reprend | ⬜ | l'état est sérialisable sauf `de` et `ia` (une graine et un compteur de tirages le rendraient) |

## 7. L'IA des neuf autres

| Fonction | État | Où |
|---|---|---|
| Le porteur : lancer quand le couloir est ouvert, passer quand on le presse, patiner par le côté libre, jamais de sa moitié | ✅ | `avecLaRondelle` (js/glace-ia.js) |
| Le soutien : des points par poste, en deçà de la bleue, le bâton prêt au tir sur réception | ✅ | `soutenir` |
| **La passe en route** (JP, 2 nov. : *le positionnement des joueurs*) : le receveur la va chercher, les autres prennent déjà leur poste au lieu de foncer tous sur la rondelle ; ratée (sous 3 m/s, ou partie ailleurs), on chasse. IA contre IA, 24 matchs de 3 × 2 min : 1,55 → 1,18 paires de coéquipiers à moins de 2,5 m | ✅ | `decisionIA` (`PASSE_VIVE`) — check « une passe des siens en route » |
| **On se remet en jeu** : la rondelle sortie de leur zone, les attaquants qui y traînent en sortent, même sans la rondelle ; le porteur qui la reprend à la bleue, un coéquipier dedans, ressort avec elle (sa lame, pas son corps, reste dehors) ; on vise la bleue moins sa distance de freinage. 2 nov. : le bras levé, on attend dehors hors de portée de la rondelle (on « tague » la bleue) ; pas de passe dans la zone depuis l'extérieur, ni vers la bleue quand un coéquipier est dedans ; la rondelle à la bleue, on la cueille du dehors ; à l'échec avant, les défenseurs tiennent la bleue en dedans, à l'attaque ils sont à 2,2 m en dedans (une passe d'une pointe à l'autre reste dans la zone). IA contre IA, 48 matchs : 5,1 → 0,9 hors-jeu par match | ✅ | `avantLaBleue`, `FREIN_BLEUE`, `HORS_PORTEE`, `PINCE_BLEUE`, `POINTE_D` — check « l'avant qui y traîne en ressort », « ressort avec elle », « l'IA, le bras levé, attend dehors », « le hors-jeu des mêlées » |
| Sans la rondelle : le plus proche chasse (l'interception, le harpon, l'échec de face), les autres couvrent | ✅ | `defendre` |
| Éviter les corps (ne pas foncer dans le dos du porteur) | ✅ | une punition ne tombe que sur une charge VOULUE (le bouton d'élan, `frappeur.elan > 0`), par-derrière lu sur les positions, et le trébuchement seulement par-derrière (`HARPON.trebuche`) ; l'IA ne fonce que de face : 0 à 3 par match de 9 min — check « collision de course » |
| La mise en jeu (le même bouton que toi, à ±0,15 s de la chute, le bâton vers son défenseur trois fois sur quatre, sinon l'ailier de la bande) et les tirs de barrage | ✅ | `miseEnJeu`, `MISE`, `avecLaRondelle` (fusillade) — check « l'IA joue la même mise en jeu » |
| Les systèmes : l'avantage numérique en parapluie, le désavantage en boîte, l'échec avant, la défense de zone, l'attaque ; trois stratégies d'équipe à la LNH (JP, 2 nov. : *des joueurs qui se positionnent à de vrais endroits de systèmes défensifs, avec des stratégies à la NHL*) | ✅ | `STRATEGIES` (js/glace-ia.js) : Équilibrée (2-1-2, l'essaim, la surcharge), Offensive (2-1-2, deux au filet, les défenseurs qui pincent), Défensive (1-2-2, la boîte, les défenseurs qui ne pincent pas) ; l'essaim : le défenseur fort au coin, l'autre devant le filet, le centre bas, l'ailier fort à la pointe, le faible dans l'enclave haute ; « Ta stratégie » sur l'affiche |
| La sortie de zone (breakout) et le dégagement volontaire sous pression | ✅ | 2 nov. : le défenseur libre derrière son filet attend 0,8 s que les siens se placent, puis passe à l'avant ouvert devant lui, l'ailier sur la bande ou le centre qui revient au milieu ; pressé sans personne d'ouvert, il la dégage le long de la bande vers son ailier (au fond s'il est en désavantage) ; plus de passe forcée de sa zone (`SORTIE`, `sortieDeZone`). IA contre IA, 48 matchs : les sorties réussies (sortie et reprise dehors) 14 → 29 %, perdues dans sa zone 73 → 48 % — check « la sortie de zone », « il la dégage le long de la bande » |
| Le dump-and-chase, le cycle dans le coin | 🟡 | 2 nov. : la bleue bouchée (deux adversaires devant), personne des siens dedans, de leur moitié : au fond, dans le coin le moins gardé, et la course (`FOND`, `lancerVers`) ; 14 par match, repris par l'équipe qui lance 27 % — check « le lancer au fond », « les siens courent après ». Le cycle : au coin et pressé, la rondelle remontée le long de la bande au coéquipier qui l'attend en haut (un poste de plus quand le porteur est au coin) — check « le cycle ». Il reste rare (≈ 1,2 par match) : la possession en zone dure 0,1 s en médiane, on la perd avant d'avoir le temps ; protéger la rondelle (§ 3) le rendra possible |
| L'écran devant le gardien, la déviation visée | ✅ | 2 nov. : un avant se place sur la ligne de la rondelle au gardien, à 1,9 m devant lui (`ECRAN_D`, `posteEcran`), le premier servi ; la rondelle libre à nous en dernier, l'avant le plus près y va au lieu de chasser ; il tient son bâton quand notre tir part (la déviation). IA contre IA : en zone, un joueur dans l'enclave 22 → 37 % du temps — check « l'IA envoie un avant au filet », « en zone offensive, un joueur dans l'enclave » |
| Retirer le gardien en fin de match quand on tire de l'arrière | ✅ | le moteur le décide pour l'IA (`MATCH.retraitGardien`) |
| Patiner à reculons en défense | ✅ | `defendre` : le défenseur recule face au porteur qui descend sur lui |
| Les défenseurs du bon côté (JP : *éviter trop d'échappées*) : entre l'attaquant le plus avancé et leur filet, l'écart selon sa vitesse ; le chasseur contient un porteur lancé ; même à l'attaque, le défenseur du côté faible reste le dernier homme | ✅ | `duBonCote`, `ECART_D`, `CONTENIR` (js/glace-ia.js) — check « les défenseurs reculent » ; IA contre IA, 24 matchs de 3 × 3 min : 16,3 → 6,9 échappées par match |
| Les niveaux de difficulté, le style d'un vrai club lu de ses vraies stats (un club qui frappe, un club qui lance) | 🟡 | `DIFFICULTES` (facile, normale, difficile : ×0,93 à ×1,07 sur la pointe, la poussée, le tir, la précision, la réaction du gardien du club de l'IA) ; le style lu des vraies stats manque |
| L'IA qui tient compte des jambes (changer, ménager) | 🟡 | `habiller` change aux arrêts ; l'IA ne le demande pas |

## 8. Le game feel et l'écran

| Fonction | État | Où |
|---|---|---|
| Le pas de temps fixe séparé du rendu, le temps réel rattrapé par petits pas | ✅ | `avancer` |
| La vue en légère plongée (26°, JP : *à angle léger, pas direct au-dessus*) : la glace se tasse en long, la bande, les baies vitrées, les buts et les gradins se lèvent ; au bout de près, tout est aplati | ✅ | `PLONGEE`, `HAUT`, `fondDeGlace` (chaque pixel suit son rayon), `dessinerBut` |
| Les vrais buts (JP : *dessiner de vrais buts*) : poteaux et barre rouges, cadre du fond arrondi, maille en damier ; on voit l'ouverture du but du fond, le dos de celui de près ; les baies vitrées et leurs montants, leurs reflets (JP : *et baies vitrées*) | ✅ | `dessinerBut`, `VITRE`, `PAL.montant` |
| La caméra, deux zooms : en 16:9, la largeur de la glace d'un bord à l'autre et l'équivalent d'une zone en long ; elle glisse sans à-coup, et dans une zone la bleue et les gradins du fond restent à l'écran (JP : *toujours voir de la bleue au gradin en zones off/def*) ; l'échelle exacte, en pixels de l'appareil (deux par pixel CSS au plus), la glace agrandie et tournée une fois par échelle ; le devancement suit une vitesse lissée (0,45 s : une passe ou un tir ne la fait plus sauter) ; à la mise en jeu, le cercle et tous les patineurs dedans | ✅ | `camera`, `MARGE_VUE`, `MARGE_FOND`, `ZONE`, `glaceALEchelle`, `vueEntiere`, `DEVANCE_T`, `MEJ_MARGE` |
| La glace en 16 bits (JP : *glace et cie plus 16-bit*) : la glace tramée (Bayer), les lignes, la bande jaune et blanche à panneaux aux couleurs des clubs, la lisse, la vitre, les gradins teints aux couleurs des locaux, la foule aux chandails des deux clubs, les locaux d'abord (JP : *gradins plus colorés des équipes* ; `FOULE`), assise et debout, les filets en damier, l'écusson, rendus une fois à la résolution des sprites et agrandis d'un nombre entier | ✅ | `fondDeGlace`, `PAL`, `BAYER`, `VITRE`, `origine` (js/sur-glace.js) |
| Le rendu old school (gros pixels, lignes de balayage, la police d'arcade) | ✅ | `RETRO`, `.sg-crt`, Bungee |
| Les jetons à la vraie face, les locaux en blanc | ✅ | `jeton`, `chandails` |
| Les animations procédurales (la foulée, le bâton, la chute, l'impact, le papillon, la lumière, la chute de la rondelle) | ✅ | `patineur`, `gardien`, `animer` |
| Des sprites dessinés (un patineur vu de haut avec chandail, casque et jambes, animé) | ✅ | rendus par scripts/sprites/rendu.mjs (→ js/sprites.js) : un joueur en volumes posé image par image, vu de trois quarts, en trois tons, son contour et son ombre portée tramée ; huit directions et dix-huit poses du patineur (la foulée en huit images lues de la phase du moteur, `FOULEE` ; la glisse, l'arrêt hockey, le virage couché), le gardien en quatre poses et quatre directions, sans miroir, teints aux couleurs du club |
| Les sons synthétisés (le tir, la passe, la bande, le but, le sifflet, l'échec) ; les patins muets (JP : *pas le bruit de patinage*) | ✅ | `SONS`, js/sons.js, js/sons-glace.js |
| La foule (une rumeur qui monte, le « ohhh » du poteau, la clameur du but), l'annonceur | ✅ | js/sons-glace.js : la foule en cinq couches de bruit pilotée par une intensité, le ohhh, la clameur, les huées, la sirène ; l'annonceur manque |
| La secousse de l'écran sur un gros coup et un but, l'arrêt sur image d'un impact (hit stop) | ✅ | `secousse`, `GEL` (l'arrêt sur image de 60 ms), js/sur-glace.js |
| L'haptique : la manette (dual-rumble) et le téléphone (`navigator.vibrate`, la permission VIBRATE de l'APK) | ✅ | `HAPTIQUE`, `vibrer` : la prise, la passe, le tir, le poteau, ton harpon, l'échec donné ou reçu, le but, le piton du doigt ; pour ton joueur seulement ; la case « Vibration » de l'affiche |
| La reprise d'un but (le ralenti), la célébration | ⬜ | rejouer les 4 dernières secondes d'états gardés |
| La mémoire d'un appui (le bouton pressé un peu trop tôt compte quand même) | ✅ | `TAMPON` (100 ms) : un appui de passe ou de tir juste avant la prise se joue à la prise ; le une-temps aussi |
| L'indicateur du receveur de la passe (qui va la recevoir) | ✅ | `receveurDePasse` (js/physique.js), l'anneau jaune, pointillé si la ligne est barrée (`receveur`, js/sur-glace.js) |
| La barre de puissance, le changement de joueur, les boutons qui changent avec la rondelle | ✅ | `hud`, `changerDeJoueur` |
| Le radar, le tableau, les punis, le flash des événements | ✅ | `radar`, `hud` |
| **Le menu de pause** (reprendre, les règles, quitter) : aujourd'hui Échap quitte le match d'un coup | ✅ | `basculerPause` : Start, Échap, ॥ ; reprendre, retirer ou remettre le gardien, les règles, quitter ; à la manette aussi |
| **Deux joueurs sur le même écran** (deux manettes, un club chacun) | ✅ | `humains`, `controles` par équipe (js/physique.js) ; l'affiche « Deux joueurs », la deuxième manette (seule, elle joue Eux) — check « à deux joueurs » |
| La présentation : les alignements au départ, les trois étoiles, les stats entre les périodes | 🟡 | les trois étoiles et les passes décisives à la fin ; les alignements et les stats d'entracte manquent |
| Jouer un gros match du Rogue sur la glace, ou une série | ⬜ | une passerelle : l'alignement du Rogue devient un club de Sur glace ; le résultat reviendrait à la saison seulement si JP le veut |
| Les réglages : la durée des périodes, les règles, la difficulté, les assistances (visée, changement automatique) | 🟡 | la durée, le hors-jeu, le dégagement, les séries, la difficulté, deux joueurs sur l'affiche ; les assistances à régler manquent |

## L'ordre de travail proposé

Le 1er nov. 2026 (JP : *applique ce que tu peux*), les points 1 à 5 et l'essentiel des 7 et 8 sont faits ; ce qui reste est dans les tableaux, en ⬜ et 🟡. Les pitons sont ceux des NHL classiques (A passe, X tir, B turbo ou mise en échec, Y change, LB recule, Start pause), le nom du porteur se montre une seconde à la prise, et les sprites sont rastérisés en seize directions (JP : *16-bit, c'est plus beau que ça*).

Ce qui donne le plus de sensation par effort, dans l'ordre :

1. **La hauteur de la rondelle** (§ 3) — une troisième coordonnée, la gravité, le rebond au sol : elle débloque d'un coup la barre horizontale, la vitre, la passe soulevée, la mitaine et le bloqueur, les déviations hautes, le tir dans le haut du filet, la rondelle qui saute. C'est la mécanique qui fait qu'un jeu de hockey n'est pas un air hockey.
2. **Le patin** (§ 2) — reculer, les croisés, le prix du virage sec, l'agilité par joueur : c'est là que *la physique de changer de direction* se sent.
3. **Le menu de pause et deux joueurs** (§ 8) — sans pause, on ne joue pas un match de dix minutes ; à deux, c'est NHL 94.
4. **Les passes décisives, les stats par joueur, les trois étoiles** (§ 6) — ce qui fait qu'un match se raconte.
5. **L'IA en systèmes** (§ 7) — l'avantage numérique, la boîte, la sortie de zone, retirer le gardien, reculer en défense ; et moins de punitions.
6. **Le jeu physique de plus** (§ 4) — soulever le bâton, la charge contre la bande, la bagarre, les blessures.
7. **Les règles de plus** (§ 6) — le hors-jeu différé, le dégagement hybride, le tir de punition, la majeure, les changements à la volée, choisir sa ligne.
8. **Le game feel de plus** (§ 8) — la secousse, l'arrêt sur image, la vibration, la reprise, la foule, l'indicateur du receveur, la mémoire d'un appui.

Chaque item, quand il arrive, prend sa ligne dans `reglesDeLaGlace()` et sa vérification dans `check_physique`, comme le reste.
